/**
 * teachAI Elo Rating API
 * ─────────────────────────────────────────────────────────────
 * GET  /api/elo?topic=xxx  → ユーザーのEloレーティング取得
 * POST /api/elo            → セッション結果からElo更新
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { updateElo, getKFactor, type V3Dimension } from "@/lib/scoring-v3";

const DIMENSIONS: V3Dimension[] = [
  "completeness", "depth", "clarity",
  "structural_coherence", "pedagogical_insight",
];

// ─── GET: レーティング取得 ──────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topic = req.nextUrl.searchParams.get("topic");

  let query = supabase
    .from("user_elo_ratings")
    .select("*")
    .eq("user_id", user.id)
    .order("rating", { ascending: false });

  if (topic) {
    query = query.eq("topic", topic);
  }

  const { data, error } = await query.limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // サマリー計算
  const overall = data?.filter(d => d.dimension === "overall") ?? [];
  const avgRating = overall.length > 0
    ? Math.round(overall.reduce((s, d) => s + d.rating, 0) / overall.length)
    : 1200;

  return NextResponse.json({
    ratings: data ?? [],
    summary: {
      avg_rating: avgRating,
      total_topics: new Set(data?.map(d => d.topic)).size,
      peak_rating: Math.max(1200, ...(data?.map(d => d.peak_rating) ?? [])),
    },
  }, { headers: CORS_HEADERS });
}

// ─── POST: Elo更新 ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topic, session_id, scores } = await req.json() as {
    topic: string;
    session_id?: string;
    scores: {
      completeness: number;
      depth: number;
      clarity: number;
      structural_coherence: number;
      pedagogical_insight: number;
      weighted: number;
    };
  };

  if (!topic || !scores) {
    return NextResponse.json({ error: "topic and scores required" }, { status: 400 });
  }

  const updates: Array<{
    dimension: string;
    old_rating: number;
    new_rating: number;
    delta: number;
  }> = [];

  // 各次元 + overall のElo更新
  const allDimensions = [...DIMENSIONS, "overall" as const];

  for (const dim of allDimensions) {
    const observed = dim === "overall" ? scores.weighted : scores[dim as V3Dimension];
    if (observed == null) continue;

    // 現在のレーティング取得 or 初期化
    const { data: existing } = await supabase
      .from("user_elo_ratings")
      .select("*")
      .eq("user_id", user.id)
      .eq("topic", topic)
      .eq("dimension", dim)
      .single();

    const currentRating = existing?.rating ?? 1200;
    const sessionCount = (existing?.session_count ?? 0) + 1;
    const kFactor = getKFactor(sessionCount);

    // 期待値: 現在のレーティングから逆算 (1200 = 3.0相当)
    const expected = 1 + (currentRating - 800) / 200; // 800→1, 1200→3, 1600→5
    const clampedExpected = Math.max(1, Math.min(5, expected));

    const newRating = updateElo(currentRating, kFactor, observed, clampedExpected);
    const peakRating = Math.max(existing?.peak_rating ?? 1200, newRating);

    // Upsert
    await supabase.from("user_elo_ratings").upsert({
      user_id: user.id,
      topic,
      dimension: dim,
      rating: newRating,
      k_factor: kFactor,
      session_count: sessionCount,
      peak_rating: peakRating,
      last_updated: new Date().toISOString(),
    }, { onConflict: "user_id,topic,dimension" });

    // 履歴記録
    await supabase.from("elo_history").insert({
      user_id: user.id,
      session_id: session_id || null,
      topic,
      dimension: dim,
      rating_before: currentRating,
      rating_after: newRating,
      delta: newRating - currentRating,
    });

    updates.push({
      dimension: dim,
      old_rating: currentRating,
      new_rating: newRating,
      delta: newRating - currentRating,
    });
  }

  return NextResponse.json({ updates }, { headers: CORS_HEADERS });
}

export async function OPTIONS() { return corsResponse(); }

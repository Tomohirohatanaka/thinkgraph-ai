import { NextRequest, NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

// GET: Load user data (character + preferences) from Supabase
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ character: null, preferences: null });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ character: null, preferences: null });
    }

    const meta = user.user_metadata || {};

    // Also load profile from sessions table
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, topic, mode, grade, score_total, key_concepts, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(100);

    // Convert sessions to profile entries format
    const profile = (sessions || []).map(s => ({
      id: s.id,
      date: new Date(s.created_at).toLocaleDateString("ja-JP"),
      title: s.topic,
      mode: s.mode || "concept",
      score: s.score_total || 0,
      mastered: s.key_concepts || [],
      gaps: [],
    }));

    return NextResponse.json({
      character: meta.character || null,
      preferences: meta.preferences || null,
      profile,
      streak: meta.streak || null,
      onboarded: meta.onboarded || false,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "エラー" }, { status: 500 });
  }
}

// POST: Save user data to Supabase user metadata
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase未設定" });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.character !== undefined) updateData.character = body.character;
    if (body.preferences !== undefined) updateData.preferences = body.preferences;
    if (body.streak !== undefined) updateData.streak = body.streak;
    if (body.onboarded !== undefined) updateData.onboarded = body.onboarded;

    const { error } = await supabase.auth.updateUser({ data: updateData });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "エラー" }, { status: 500 });
  }
}

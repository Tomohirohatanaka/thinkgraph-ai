/**
 * teachAI Score v3 API (独立)
 * ─────────────────────────────────────────────────────────────
 * POST /api/score-v3 → v3スコア計算 (teach APIの外部でも使用可能)
 */

import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { calcScoreV3, v3ToLegacy, type RawScoreV3 } from "@/lib/scoring-v3";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      completeness, depth, clarity, structural_coherence, pedagogical_insight,
      mode = "concept",
      kb_mode = "mixed",
      rqs_avg = 0.5,
    } = body as {
      completeness: number;
      depth: number;
      clarity: number;
      structural_coherence: number;
      pedagogical_insight: number;
      mode?: string;
      kb_mode?: "building" | "telling" | "mixed";
      rqs_avg?: number;
    };

    // バリデーション
    const nums = { completeness, depth, clarity, structural_coherence, pedagogical_insight };
    for (const [key, val] of Object.entries(nums)) {
      if (typeof val !== "number" || val < 1 || val > 5) {
        return NextResponse.json(
          { error: `${key} must be a number between 1 and 5` },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    const raw: RawScoreV3 = { completeness, depth, clarity, structural_coherence, pedagogical_insight };
    const scoreV3 = calcScoreV3(raw, mode, kb_mode, rqs_avg);
    const legacy = v3ToLegacy(scoreV3);

    return NextResponse.json({
      v3: scoreV3,
      v2_compat: legacy,
    }, { headers: CORS_HEADERS });

  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Score calculation failed" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() { return corsResponse(); }

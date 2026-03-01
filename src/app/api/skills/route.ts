import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { resolveApiKey } from "@/lib/trial-key";

interface Character {
  name: string; emoji: string; color: string;
  personality: string; tag: string;
  growth_stages: { label: string; threshold: number }[];
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, profile, character } = await req.json() as {
      apiKey: string;
      profile: Array<{ title: string; mode: string; score: number; mastered: string[]; gaps: string[]; date?: string }>;
      character?: Character;
    };

    const resolved = resolveApiKey(apiKey);
    if (!resolved) {
      return NextResponse.json({ error: "APIキーが必要です" }, { status: 400 });
    }
    if (!profile?.length) {
      return NextResponse.json({ error: "学習履歴がありません" }, { status: 400 });
    }
    const effectiveKey = resolved.key;
    const provider = detectProvider(effectiveKey);

    const charName = character?.name ?? "キャラクター";
    const charEmoji = character?.emoji ?? "🤖";
    const charPersonality = character?.personality ?? "好奇心旺盛";

    const profileSummary = profile.map(e =>
      `- トピック「${e.title}」(${e.mode}) スコア:${e.score}点\n  教えてもらった概念:${(e.mastered || []).join("、") || "なし"}\n  まだ理解できていない概念:${(e.gaps || []).join("、") || "なし"}`
    ).join("\n");

    const avgScore = Math.round(profile.reduce((s, e) => s + e.score, 0) / profile.length);
    const totalSessions = profile.length;

    const skillPrompt = `あなたはAIキャラクター「${charName}」${charEmoji}（性格: ${charPersonality}）です。
ユーザーに様々な知識を教えてもらいました。
その学習履歴をもとに、${charName}が「どれだけ知識を身につけたか」のスキルマップを生成してください。

## ${charName}が教えてもらった学習履歴（計${totalSessions}セッション、平均スコア${avgScore}点）
${profileSummary}

## 出力形式（JSONのみ・前置き不要）
{
  "char_name": "キャラ名",
  "char_emoji": "絵文字",
  "skill_level": "見習い|成長中|一人前|熟達",
  "summary": "キャラの口調で知識の状態を2〜3文で",
  "categories": [
    {
      "name": "知識カテゴリ名",
      "color": "#hex",
      "icon": "絵文字1文字",
      "skills": [{ "name": "概念名", "level": 85, "sessions": 3 }]
    }
  ]
}`;

    const llmRes = await callLLM({
      provider, apiKey: effectiveKey,
      messages: [{ role: "user", content: skillPrompt }],
      maxTokens: 1500,
    });

    const raw = llmRes.text;
    const match = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim().match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ error: "解析失敗" }, { status: 500 });
    const data = JSON.parse(match[0]);
    return NextResponse.json(data);

  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "エラー" }, { status: 500 });
  }
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }

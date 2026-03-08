import { NextRequest, NextResponse } from "next/server";
import { callLLM, detectProvider } from "@/lib/llm";
import { corsResponse } from "@/lib/api";
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
    const profileSummary = profile.map(e =>
      `- トピック「${e.title}」(${e.mode}) スコア:${e.score}点\n  教えてもらった概念:${(e.mastered || []).join("、") || "なし"}\n  まだ理解できていない概念:${(e.gaps || []).join("、") || "なし"}`
    ).join("\n");

    const avgScore = Math.round(profile.reduce((s, e) => s + e.score, 0) / profile.length);
    const totalSessions = profile.length;

    const charStyle = character?.personality || "好奇心旺盛";

    const skillPrompt = `あなたはAIキャラクター「${charName}」${charEmoji}（性格: ${charStyle}）です。
ユーザー（先生）に様々な知識を教えてもらいました。
学習履歴をもとに、${charName}が「どれだけ知識を身につけたか」のスキルマップを${charName}の性格・口調で生成してください。

## 重要ルール
- カテゴリ名・スキル名・要約すべてを${charName}の口調・語尾で表現すること
- 例: 元気な性格なら「めっちゃわかった！光合成マスター！」、冷静なら「光合成の基礎理論は概ね理解しました」
- skill_levelの名前もキャラに合わせる（例: "見習い" → "${charName}流の表現"）

## ${charName}が教えてもらった学習履歴（計${totalSessions}セッション、平均スコア${avgScore}点）
${profileSummary}

## 出力形式（JSONのみ・前置き不要）
{
  "char_name": "${charName}",
  "char_emoji": "${charEmoji}",
  "skill_level": "${charName}の口調で今の実力を4文字以内で（例:もっと知りたい！/かなり詳しい/まだまだ…）",
  "summary": "${charName}の口調で知識の状態を2〜3文で（先生への感謝や次に教えてほしいことを含める）",
  "categories": [
    {
      "name": "${charName}の口調でカテゴリ名（例:『ちょっと得意かも？理科系』）",
      "color": "#hex",
      "icon": "絵文字1文字",
      "skills": [{ "name": "概念名（キャラ口調OK）", "level": 85, "sessions": 3 }]
    }
  ],
  "next_request": "${charName}の口調で次に教えてほしいテーマのお願い（1文）"
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

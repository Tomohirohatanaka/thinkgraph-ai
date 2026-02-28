import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { calcScoreV2, getScoringCriteria, type RawScoreV2 } from "@/lib/scoring";
import { callLLM, detectProvider } from "@/lib/llm";

interface Turn { role: "user" | "ai"; text: string; }
interface Character {
  name: string; emoji: string; color?: string;
  personality: string; speaking_style: string;
  praise: string; struggle: string; confused: string;
  lore?: string;
}

function detectLeading(aiText: string, userText: string): number {
  const patterns = [
    /それって.{2,12}ですよね/,
    /.{2,12}ということですか[？?]/,
    /つまり.{2,12}のことですか/,
    /AかBでいうと/,
  ];
  const aiW = aiText.replace(/[^\u3040-\u9fff\w]/g, " ").split(/\s+/).filter(w => w.length >= 3);
  const usW = userText.replace(/[^\u3040-\u9fff\w]/g, " ").split(/\s+/).filter(w => w.length >= 3);
  let match = 0;
  for (const uw of usW) { if (aiW.some(aw => aw.includes(uw) || uw.includes(aw))) match++; }
  const echo = usW.length > 0 ? match / usW.length : 0;
  const hasPat = patterns.some(p => p.test(aiText));
  const isEcho = echo > 0.6 && usW.length < 8;
  if (hasPat && isEcho) return 15;
  if (hasPat) return 8;
  if (isEcho) return 10;
  return 0;
}

// calcScore moved to src/lib/scoring.ts

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      apiKey, topic, coreText, mode,
      history = [], userMessage, forceFinish = false,
      character, leadingPenalty = 0, gaveUpCount = 0, consecutiveFail = 0,
    } = body as {
      apiKey: string; topic: string; coreText: string; mode: string;
      history: Turn[]; userMessage: string; forceFinish: boolean;
      character?: Character;
      leadingPenalty?: number; gaveUpCount?: number; consecutiveFail?: number;
    };

    if (!apiKey?.length) {
      return NextResponse.json({ error: "APIキーが必要です" }, { status: 400 });
    }
    const provider = detectProvider(apiKey);

    const prevUserTurns = history.filter(t => t.role === "user").length;
    const totalUserTurns = prevUserTurns + 1;
    const shouldFinish = forceFinish || totalUserTurns >= 6;

    const name = character?.name ?? "ミオ";
    const emoji = character?.emoji ?? "⭐";
    const personality = character?.personality ?? "元気で好奇心旺盛";
    const style = character?.speaking_style ?? "タメ口。語尾に「！」が多い。感嘆詞豊富。";
    const praise = character?.praise ?? "「やばい、めっちゃわかった！！」";
    const struggle = character?.struggle ?? "「えっとぉ…もう一回ゆっくり教えてくれる？」";
    const confused = character?.confused ?? "「うーん、そこがよくわかんないんだけど、なんで？」";
    const lore = character?.lore ?? "";

    if (consecutiveFail >= 3) {
      return NextResponse.json({
        type: "quit",
        message: `${emoji} ${struggle.replace(/[「」]/g, "")}… 教材をもう一度確認してから挑戦してみて！`,
      });
    }

    let thisLP = 0;
    const lastAi = [...history].reverse().find(t => t.role === "ai");
    if (lastAi && userMessage) thisLP = detectLeading(lastAi.text, userMessage);

    const modeMap: Record<string, string> = {
      whynot: "なぜそうなるの？どういう仕組み？と原因・理由を掘り下げる",
      vocabulary: "それってどういう意味？具体的な例は？と定義と具体例を求める",
      concept: "全体的にどんな構造？それぞれの関係は？と全体像を確認する",
      procedure: "次は何をするの？なんでその順番なの？と手順と理由を確認する",
    };
    const modeGuide = modeMap[mode] ?? "意味・理由・構造を掘り下げる";

    // ─── 通常ターン ───────────────────────────────────────────
    const normalSystem = `あなたは「${name}」${emoji}というキャラクターです。ユーザーから「${topic}」を教わっています。

## キャラクター（絶対に崩さない）
${lore ? `背景: ${lore}` : ""}
性格: ${personality}
口調: ${style}
褒めるとき: ${praise}
理解できないとき: ${struggle}
説明が足りないとき: ${confused}

## 参考知識（内部のみ・絶対に漏らさない）
${(coreText || "").slice(0, 3000)}

## ルール
1. ${name}の口調を完全に守る（${style}）
2. 答えを暗示しない。「〇〇ということ？」「〇〇ですよね？」は禁止
3. 正確な説明にだけ反応する。曖昧・間違いは${confused}のように返す
4. 1回の返答に質問1つだけ。${modeGuide}
5. 返答は2〜4文。箇条書き禁止。自然な会話体。
${thisLP > 0 ? "⚠️ 前の質問が誘導的でした。今回は中立的に聞き返してください。" : ""}`;

    // ─── 最終評価ターン ───────────────────────────────────────
    const coreRef = coreText ? `\n\n## 元の教材内容（採点の参照基準）\n${coreText.slice(0, 2000)}` : "";
    const finalSystem = `あなたは「${name}」${emoji}というキャラクターです。「${topic}」についての学習セッションを締めくくります。

## キャラクター設定
性格: ${personality}
口調: ${style}
褒めるとき: ${praise}
${coreRef}

${getScoringCriteria(mode)}

## 出力形式（厳守）
${name}らしいセリフを2〜3文書いた後、以下のJSONを出力してください。
JSONの各数値フィールドは整数のみ（説明文字列は禁止）:

{
  "coverage": 85,
  "depth": 78,
  "clarity": 82,
  "structural_coherence": 80,
  "spontaneity": 75,
  "total": 80,
  "feedback": "フィードバックは必ず元教材の内容と照合して具体的に。構成は(1)良かった点: ユーザーが正確に説明できた具体的な概念名・内容を引用して褒める (2)改善点: 不足・誤解があった具体的な部分を「〇〇については、本来△△なんだけど、□□って言ってたのがちょっとズレてたかな」のように指摘 (3)一言まとめ。全て${name}の口調で書く",
  "mastered": ["正確に説明できた概念A", "概念B"],
  "gaps": ["説明が不十分だった概念C"]
}

上記は例示。実際の会話内容に基づいて正確に採点してください。`;

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const t of history) {
      messages.push({ role: t.role === "user" ? "user" : "assistant", content: t.text });
    }
    messages.push({ role: "user", content: userMessage });

    const llmRes = await callLLM({
      provider,
      apiKey,
      system: shouldFinish ? finalSystem : normalSystem,
      messages,
      maxTokens: shouldFinish ? 1200 : 500,
    });

    const raw = llmRes.text.trim();

    if (shouldFinish) {
      let parsed: Record<string, unknown> | null = null;
      try {
        const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
        const bare = raw.match(/\{[\s\S]*\}/);
        const jsonStr = fence?.[1]?.trim() ?? bare?.[0] ?? null;
        if (jsonStr) parsed = JSON.parse(jsonStr);
      } catch { /* fallthrough */ }

      // 数値を安全に抽出（文字列・undefined両対応）
      const num = (v: unknown, fallback = 65): number => {
        const n = parseFloat(String(v ?? ""));
        return isNaN(n) ? fallback : Math.max(0, Math.min(100, Math.round(n)));
      };

      const rawV2: RawScoreV2 = {
        coverage:             num(parsed?.coverage ?? parsed?.raw_coverage),
        depth:                num(parsed?.depth ?? parsed?.raw_depth),
        clarity:              num(parsed?.clarity ?? parsed?.raw_clarity),
        structural_coherence: num(parsed?.structural_coherence, 65),
        spontaneity:          num(parsed?.spontaneity, 65),
      };

      const scoreV2 = calcScoreV2(rawV2, {
        leading: leadingPenalty + thisLP,
        gave_up: gaveUpCount,
        turns: totalUserTurns,
      }, mode);

      // 後方互換のため旧形式も維持
      const rawScore = { coverage: rawV2.coverage, depth: rawV2.depth, clarity: rawV2.clarity, total: scoreV2.total };
      const finalScore = { ...scoreV2.adjusted, total: scoreV2.total };

      // JSONの前のテキスト = キャラの締めセリフ
      const jsonStart = raw.search(/[\{\[`]/);
      const preText = jsonStart > 0 ? raw.slice(0, jsonStart).trim() : "";
      const messageText = preText || `${emoji} お疲れ様でした！`;

      const feedback = typeof parsed?.feedback === "string" ? parsed.feedback : "よく頑張りました！";
      const mastered = Array.isArray(parsed?.mastered) ? (parsed.mastered as string[]) : [];
      const gaps = Array.isArray(parsed?.gaps) ? (parsed.gaps as string[]) : [];

      return NextResponse.json({
        type: "complete",
        message: messageText,
        score: finalScore,
        raw_score: rawScore,
        score_breakdown: { ...rawV2, ...scoreV2.adjusted, total: scoreV2.total },
        grade: scoreV2.grade,
        insight: scoreV2.insight,
        feedback,
        mastered,
        gaps,
        leading_penalty: leadingPenalty + thisLP,
        gave_up_penalty: gaveUpCount * 12,
      });
    }

    return NextResponse.json({
      type: "continue",
      message: raw,
      leading_penalty: thisLP,
    });

  } catch (e: unknown) {
    console.error("teach API error:", e);
    return NextResponse.json({
      error: e instanceof Error ? e.message : "サーバーエラー",
    }, { status: 500 });
  }
}

// ─── CORS Preflight ──────────────────────────────────────────
export async function OPTIONS() { return corsResponse(); }

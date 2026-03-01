/**
 * teachAI Teach API — v2/v3 Dual Mode
 * ─────────────────────────────────────────────────────────────
 * v3 統合:
 *   - RQS (Real-time Response Quality Score) per turn
 *   - 適応質問ステートマシン (ORIENT → CHALLENGE)
 *   - Knowledge-Building 検出
 *   - SOLO 1-5 スケール採点 (v2と並行出力)
 *   - ペナルティ廃止
 *
 * Feature Flag:
 *   環境変数 USE_V3_SCORING=true で v3 を有効化
 *   未設定時は v2 のみ出力 (後方互換)
 */

import { NextRequest, NextResponse } from "next/server";
import { CORS_HEADERS, corsResponse } from "@/lib/api";
import { calcScoreV2, getScoringCriteria, type RawScoreV2 } from "@/lib/scoring";
import {
  calcScoreV3, calculateRQS, selectNextState, detectKnowledgeBuilding,
  getV3ScoringCriteria, getV3FinalPromptFormat, v3ToLegacy,
  V3_QUESTION_TEMPLATES,
  type RawScoreV3, type QuestionState, type StateTransition, type RQSResult,
} from "@/lib/scoring-v3";
import { callLLM, detectProvider } from "@/lib/llm";
import { resolveApiKey } from "@/lib/trial-key";
import { detectPromptInjection, sanitizeUserInput } from "@/lib/ai/prompt-engine";
import { validate, SCHEMAS } from "@/lib/security/input-validator";

const USE_V3 = process.env.USE_V3_SCORING === "true";

interface Turn { role: "user" | "ai"; text: string; }
interface Character {
  name: string; emoji: string; color?: string;
  personality: string; speaking_style: string;
  praise: string; struggle: string; confused: string;
  lore?: string; intro?: string;
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ─── Input Validation ────────────────────────────────────
    const validation = validate(body, SCHEMAS.teach);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors[0]?.message || "入力が不正です", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const {
      apiKey, topic, coreText, mode,
      history = [], userMessage, forceFinish = false,
      character, leadingPenalty = 0, gaveUpCount = 0, consecutiveFail = 0,
      question_seeds = [],       // ingest APIで生成された質問シード
      // v3 追加パラメータ
      rqsHistory = [],           // 過去ターンのRQS配列
      stateHistory = [],         // 状態遷移履歴
      currentState = "ORIENT",   // 現在のステートマシン状態
      kbSignals = [],            // KB検出シグナル履歴
    } = body as {
      apiKey: string; topic: string; coreText: string; mode: string;
      history: Turn[]; userMessage: string; forceFinish: boolean;
      character?: Character;
      leadingPenalty?: number; gaveUpCount?: number; consecutiveFail?: number;
      question_seeds?: string[];
      // v3
      rqsHistory?: RQSResult[];
      stateHistory?: StateTransition[];
      currentState?: QuestionState;
      kbSignals?: { turn: number; mode: string; signals: unknown }[];
    };

    const resolved = resolveApiKey(apiKey);
    if (!resolved) {
      return NextResponse.json({ error: "APIキーが必要です" }, { status: 400 });
    }
    const effectiveKey = resolved.key;
    const provider = detectProvider(effectiveKey);

    // ─── Prompt Injection Defense ──────────────────────────
    const sanitizedMessage = sanitizeUserInput(userMessage);
    const injectionDetected = detectPromptInjection(sanitizedMessage);
    // Log but don't block — let the prompt defense in system message handle it
    if (injectionDetected) {
      console.warn("[teach] Potential prompt injection detected", { topic, turn: history.length });
    }

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

    // ─── v2: 誘導検出 ──────────────────────────────────────
    let thisLP = 0;
    const lastAi = [...history].reverse().find(t => t.role === "ai");
    if (lastAi && userMessage) thisLP = detectLeading(lastAi.text, userMessage);

    // ─── v3: RQS 計算 ──────────────────────────────────────
    let currentRQS: RQSResult | null = null;
    let nextState: QuestionState = currentState;
    let stateReason = "";
    let currentKB: { mode: "building" | "telling" | "mixed"; signals: unknown } | null = null;

    if (USE_V3 && lastAi) {
      // RQS計算
      currentRQS = calculateRQS(userMessage, lastAi.text, coreText);

      // KB検出
      const prevUserMsgs = history.filter(t => t.role === "user").map(t => t.text);
      const kbResult = detectKnowledgeBuilding(userMessage, prevUserMsgs);
      currentKB = kbResult;

      // 誤概念判定 (簡易: RQS < 0.2 で直前のAI質問に全く答えていない)
      const hasMisconception = currentRQS.score < 0.2 && userMessage.length > 20;

      // 状態遷移
      if (!shouldFinish) {
        const transition = selectNextState(
          currentRQS.score,
          currentState,
          totalUserTurns,
          hasMisconception
        );
        nextState = transition.state;
        stateReason = transition.reason;
      }
    }

    const modeMap: Record<string, string> = {
      whynot: "因果関係と「なぜ」を重視。表面的な説明には「でも、なんでそうなるの？」と深堀り。反例を使って理解を試す",
      vocabulary: "定義の正確さと具体例を重視。「それって例えばどういうこと？」と実例を求める。類義語・対義語の区別を確認",
      concept: "概念間の関係性と構造を重視。「AとBはどう違うの？」「全体像を教えて」と体系的理解を促す",
      procedure: "手順の正確さと順序を重視。「次は何をするの？」「もし失敗したらどうなる？」と実践的理解を確認",
    };
    const modeGuide = modeMap[mode] ?? "意味・理由・構造を掘り下げる";

    // ─── v3 ステート駆動の質問ガイド ───────────────────────
    const v3StateGuide = USE_V3 ? `
## 質問戦略（現在の状態: ${nextState}）
テンプレート参考: ${V3_QUESTION_TEMPLATES[nextState]}
状態遷移理由: ${stateReason}
${currentRQS ? `前回RQS: ${currentRQS.score.toFixed(2)} (文構成:${currentRQS.signals.sentence_quality} 関連:${currentRQS.signals.relevance} 情報量:${currentRQS.signals.info_content} 詳述:${currentRQS.signals.elaboration})` : ""}
${currentKB ? `KB検出: ${currentKB.mode}` : ""}

上記テンプレートを参考にしつつ、${name}の口調で自然に質問してください。テンプレートをそのまま使わないこと。` : "";

    // ─── 通常ターン ─────────────────────────────────────────
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
${question_seeds.length > 0 ? `\n## 質問のヒント（参考にしてよいが、そのまま使わず${name}の口調で自然に聞く）\n${question_seeds.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}` : ""}
${thisLP > 0 ? "⚠️ 前の質問が誘導的でした。今回は中立的に聞き返してください。" : ""}
${v3StateGuide}`;

    // ─── 最終評価ターン ─────────────────────────────────────
    const coreRef = coreText ? `\n\n## 元の教材内容（採点の参照基準）\n${coreText.slice(0, 2000)}` : "";

    // v3スコアリング基準を使用 (v2フォールバック付き)
    const scoringCriteria = USE_V3
      ? getV3ScoringCriteria(mode)
      : getScoringCriteria(mode);

    const scoringFormat = USE_V3
      ? getV3FinalPromptFormat()
      : `JSON の各数値フィールドは整数のみ（説明文字列は禁止）:

{
  "coverage": 85,
  "depth": 78,
  "clarity": 82,
  "structural_coherence": 80,
  "spontaneity": 75,
  "total": 80,
  "feedback": "フィードバックは必ず元教材の内容と照合して具体的に。構成は(1)良かった点: ユーザーが正確に説明できた具体的な概念名・内容を引用して褒める (2)改善点: 不足・誤解があった具体的な部分を「〇〇については、本来△△なんだけど、□□って言ってたのがちょっとズレてたかな」のように指摘 (3)一言まとめ。全て${name}の口調で書く",
  "mastered": ["正確に説明できた概念A", "概念B", "...最大10個まで抽出"],
  "gaps": ["説明が不十分だった概念C"],
  "improvement_suggestions": ["具体的な改善提案1", "具体的な改善提案2", "具体的な改善提案3"]
}

masteredには会話中でユーザーが正確に説明できたキーコンセプトを最大10個まで抽出してください。
improvement_suggestionsにはユーザーの説明をより良くするための具体的な提案を3つ書いてください（例：「〇〇の因果関係をもう少し具体的に説明すると良い」「△△と□□の違いを明確にすると理解が深まる」など）。
上記は例示。実際の会話内容に基づいて正確に採点してください。`;

    const finalSystem = `あなたは「${name}」${emoji}というキャラクターです。「${topic}」についての学習セッションを締めくくります。

## キャラクター設定
性格: ${personality}
口調: ${style}
褒めるとき: ${praise}
${coreRef}

${scoringCriteria}

## 出力形式（厳守）
${name}らしいセリフを2〜3文書いた後、以下のJSONを出力してください。
${scoringFormat}`;

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const t of history) {
      messages.push({ role: t.role === "user" ? "user" : "assistant", content: t.text });
    }
    messages.push({ role: "user", content: userMessage });

    const llmRes = await callLLM({
      provider,
      apiKey: effectiveKey,
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

      const num = (v: unknown, fallback = 65): number => {
        const n = parseFloat(String(v ?? ""));
        return isNaN(n) ? fallback : Math.max(0, Math.min(100, Math.round(n)));
      };

      const numV3 = (v: unknown, fallback = 3): number => {
        const n = parseFloat(String(v ?? ""));
        return isNaN(n) ? fallback : Math.max(1, Math.min(5, Math.round(n)));
      };

      // JSON前のテキスト = キャラの締めセリフ
      const jsonStart = raw.search(/[\{\[`]/);
      const preText = jsonStart > 0 ? raw.slice(0, jsonStart).trim() : "";
      const messageText = preText || `${emoji} お疲れ様でした！`;

      const feedback = typeof parsed?.feedback === "string" ? parsed.feedback : "よく頑張りました！";
      const mastered = Array.isArray(parsed?.mastered) ? (parsed.mastered as string[]).slice(0, 10) : [];
      const gaps = Array.isArray(parsed?.gaps) ? (parsed.gaps as string[]) : [];
      const improvement_suggestions = Array.isArray(parsed?.improvement_suggestions) ? (parsed.improvement_suggestions as string[]).slice(0, 3) : [];

      // ─── v3 スコアリング ──────────────────────────────────
      if (USE_V3) {
        const rawV3: RawScoreV3 = {
          completeness: numV3(parsed?.completeness),
          depth: numV3(parsed?.depth),
          clarity: numV3(parsed?.clarity),
          structural_coherence: numV3(parsed?.structural_coherence),
          pedagogical_insight: numV3(parsed?.pedagogical_insight),
        };

        // KB mode: セッション全体の集計
        const allKB = [...kbSignals, ...(currentKB ? [{ turn: totalUserTurns, mode: currentKB.mode, signals: currentKB.signals }] : [])];
        const buildingCount = allKB.filter(k => k.mode === "building").length;
        const tellingCount = allKB.filter(k => k.mode === "telling").length;
        const sessionKBMode: "building" | "telling" | "mixed" =
          buildingCount > tellingCount * 1.5 ? "building"
            : tellingCount > buildingCount * 1.5 ? "telling"
              : "mixed";

        // RQS 平均
        const allRQS = [...rqsHistory, ...(currentRQS ? [currentRQS] : [])];
        const rqsAvg = allRQS.length > 0
          ? allRQS.reduce((sum, r) => sum + r.score, 0) / allRQS.length
          : 0.5;

        const scoreV3 = calcScoreV3(rawV3, mode, sessionKBMode, rqsAvg);

        // v2 後方互換変換
        const legacyScore = v3ToLegacy(scoreV3);

        return NextResponse.json({
          type: "complete",
          message: messageText,
          // v2 互換
          score: { coverage: legacyScore.coverage, depth: legacyScore.depth, clarity: legacyScore.clarity, total: legacyScore.total },
          raw_score: { coverage: legacyScore.coverage, depth: legacyScore.depth, clarity: legacyScore.clarity, total: legacyScore.total },
          score_breakdown: legacyScore,
          grade: legacyScore.grade,
          insight: scoreV3.insight,
          // v3 データ
          score_v3: scoreV3,
          rqs_history: allRQS,
          state_transitions: [...stateHistory, ...(stateReason ? [{
            turn: totalUserTurns,
            from_state: currentState,
            to_state: nextState,
            rqs: currentRQS?.score ?? 0,
            reason: stateReason,
          }] : [])],
          kb_mode: sessionKBMode,
          kb_signals: allKB,
          scoring_version: "v3",
          feedback,
          mastered,
          gaps,
          improvement_suggestions,
          leading_penalty: 0,  // v3ではペナルティなし
          gave_up_penalty: 0,
        });
      }

      // ─── v2 フォールバック ────────────────────────────────
      const rawV2: RawScoreV2 = {
        coverage: num(parsed?.coverage ?? parsed?.raw_coverage),
        depth: num(parsed?.depth ?? parsed?.raw_depth),
        clarity: num(parsed?.clarity ?? parsed?.raw_clarity),
        structural_coherence: num(parsed?.structural_coherence, 65),
        spontaneity: num(parsed?.spontaneity, 65),
      };

      const scoreV2 = calcScoreV2(rawV2, {
        leading: leadingPenalty + thisLP,
        gave_up: gaveUpCount,
        turns: totalUserTurns,
      }, mode);

      const rawScore = { coverage: rawV2.coverage, depth: rawV2.depth, clarity: rawV2.clarity, total: scoreV2.total };
      const finalScore = { ...scoreV2.adjusted, total: scoreV2.total };

      return NextResponse.json({
        type: "complete",
        message: messageText,
        score: finalScore,
        raw_score: rawScore,
        score_breakdown: { ...rawV2, ...scoreV2.adjusted, total: scoreV2.total },
        grade: scoreV2.grade,
        insight: scoreV2.insight,
        scoring_version: "v2",
        feedback,
        mastered,
        gaps,
        improvement_suggestions,
        leading_penalty: leadingPenalty + thisLP,
        gave_up_penalty: gaveUpCount * 12,
      });
    }

    // ─── 通常ターン応答 ────────────────────────────────────
    const response: Record<string, unknown> = {
      type: "continue",
      message: raw,
      leading_penalty: thisLP,
    };

    // v3 追加データ
    if (USE_V3) {
      response.rqs = currentRQS;
      response.next_state = nextState;
      response.state_reason = stateReason;
      response.kb = currentKB;
      response.scoring_version = "v3";
    }

    return NextResponse.json(response);

  } catch (e: unknown) {
    console.error("teach API error:", e);
    return NextResponse.json({
      error: e instanceof Error ? e.message : "セッション処理に失敗しました",
    }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function OPTIONS() { return corsResponse(); }

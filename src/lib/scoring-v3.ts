/**
 * teachAI Scoring Engine v3
 * ─────────────────────────────────────────────────────────────
 * Universal Assessment Engine based on SOLO Taxonomy (1-5 scale)
 *
 * v2→v3 変更点:
 *   - 0-100 → 1-5 SOLO基準参照スケール
 *   - ペナルティ制度廃止 (PNAS 2020)
 *   - spontaneity → pedagogical_insight に改名
 *   - RQS (Real-time Response Quality Score) 追加
 *   - Knowledge-Building vs Knowledge-Telling 検出
 *   - Elo Rating System (多変量)
 *   - Hybrid Compensatory-Conjunctive モデル
 *
 * 後方互換:
 *   v2インターフェースは維持。USE_V3_SCORING フラグで切り替え。
 */

// ─── v3 型定義 ───────────────────────────────────────────────

export interface RawScoreV3 {
  completeness: number;         // 1-5: 網羅性 (旧 coverage)
  depth: number;                // 1-5: 深さ
  clarity: number;              // 1-5: 明晰さ
  structural_coherence: number; // 1-5: 論理構造
  pedagogical_insight: number;  // 1-5: 教育的洞察 (旧 spontaneity)
}

export type V3Dimension = keyof RawScoreV3;

export interface ScoreV3 {
  raw: RawScoreV3;
  weighted: number;              // 1.0-5.0 加重平均
  grade: "A" | "B" | "C" | "D" | "F";
  conjunctive_pass: boolean;     // 全次元が最低閾値以上か
  insight: string;
  kb_mode: "building" | "telling" | "mixed";
  rqs_avg: number;               // セッション平均RQS
}

export interface EloRating {
  topic: string;
  dimension: V3Dimension;
  rating: number;                // 初期 1200
  k_factor: number;              // 初回5回は40、以降16
  session_count: number;
}

export interface RQSResult {
  score: number;                 // 0.0-1.0
  signals: {
    sentence_quality: number;    // 0-1: 文構成の質
    relevance: number;           // 0-1: 質問への関連度
    info_content: number;        // 0-1: why-informative度
    elaboration: number;         // 0-1: 詳述度
  };
}

export type QuestionState =
  | "ORIENT"
  | "CLARIFY"
  | "PROBE_DEPTH"
  | "PROBE_BREADTH"
  | "INTEGRATE"
  | "CHALLENGE";

export interface StateTransition {
  turn: number;
  from_state: QuestionState;
  to_state: QuestionState;
  rqs: number;
  reason: string;
}

// ─── v3 重み定義 (モード別) ──────────────────────────────────

export const V3_WEIGHTS: Record<string, Record<V3Dimension, number>> = {
  whynot: {
    completeness: 0.15,
    depth: 0.30,
    clarity: 0.15,
    structural_coherence: 0.20,
    pedagogical_insight: 0.20,
  },
  vocabulary: {
    completeness: 0.20,
    depth: 0.15,
    clarity: 0.30,
    structural_coherence: 0.10,
    pedagogical_insight: 0.25,
  },
  concept: {
    completeness: 0.20,
    depth: 0.25,
    clarity: 0.20,
    structural_coherence: 0.25,
    pedagogical_insight: 0.10,
  },
  procedure: {
    completeness: 0.25,
    depth: 0.15,
    clarity: 0.25,
    structural_coherence: 0.20,
    pedagogical_insight: 0.15,
  },
};

export function getV3Weights(mode: string): Record<V3Dimension, number> {
  return V3_WEIGHTS[mode] ?? V3_WEIGHTS.concept;
}

// ─── v3 グレード境界 ────────────────────────────────────────

const GRADE_BOUNDARIES = {
  A: 4.2,
  B: 3.4,
  C: 2.6,
  D: 1.8,
  // F: below 1.8
};

function getGradeV3(weighted: number): ScoreV3["grade"] {
  if (weighted >= GRADE_BOUNDARIES.A) return "A";
  if (weighted >= GRADE_BOUNDARIES.B) return "B";
  if (weighted >= GRADE_BOUNDARIES.C) return "C";
  if (weighted >= GRADE_BOUNDARIES.D) return "D";
  return "F";
}

// ─── Conjunctive Check ──────────────────────────────────────

function checkConjunctive(scores: RawScoreV3, grade: string): boolean {
  const values = Object.values(scores);
  const allAbove2 = values.every(s => s >= 2);
  const allAbove3 = values.every(s => s >= 3);

  // グレードB以上なら全次元3以上必要
  if (grade === "A" || grade === "B") {
    if (!allAbove3) return false;
  }
  // どのグレードでも全次元2以上必要
  if (!allAbove2) return false;
  return true;
}

// ─── v3 スコア計算 ──────────────────────────────────────────

export function calcScoreV3(
  raw: RawScoreV3,
  mode: string,
  kbMode: "building" | "telling" | "mixed" = "mixed",
  rqsAvg = 0.5
): ScoreV3 {
  const weights = getV3Weights(mode);

  // 加重平均
  let weighted = 0;
  for (const [dim, w] of Object.entries(weights)) {
    weighted += raw[dim as V3Dimension] * w;
  }
  weighted = Math.round(weighted * 100) / 100;

  const grade = getGradeV3(weighted);
  const conjunctive_pass = checkConjunctive(raw, grade);
  const insight = generateInsightV3(raw, grade, kbMode);

  return {
    raw,
    weighted,
    grade,
    conjunctive_pass,
    insight,
    kb_mode: kbMode,
    rqs_avg: rqsAvg,
  };
}

// ─── v2 ↔ v3 変換 ──────────────────────────────────────────

export function convertV2toV3(v2Score: number): number {
  if (v2Score >= 90) return 5;
  if (v2Score >= 75) return 4;
  if (v2Score >= 60) return 3;
  if (v2Score >= 45) return 2;
  return 1;
}

export function convertV3toV2(v3Score: number): number {
  // 1-5 → 0-100 の線形マッピング
  return Math.round(((v3Score - 1) / 4) * 100);
}

// v2 legacy形式への変換 (後方互換)
export function v3ToLegacy(v3: ScoreV3): {
  coverage: number;
  depth: number;
  clarity: number;
  structural_coherence: number;
  spontaneity: number;
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
} {
  const toV2 = convertV3toV2;
  const total = convertV3toV2(v3.weighted); // 1-5 → 0-100
  return {
    coverage: toV2(v3.raw.completeness),
    depth: toV2(v3.raw.depth),
    clarity: toV2(v3.raw.clarity),
    structural_coherence: toV2(v3.raw.structural_coherence),
    spontaneity: toV2(v3.raw.pedagogical_insight),
    total,
    grade: v3.grade === "A" ? (total >= 90 ? "S" : "A")
         : v3.grade === "B" ? "B"
         : v3.grade === "C" ? "C"
         : "D",
  };
}

// ─── RQS (Real-time Response Quality Score) ─────────────────

// 言語非依存の文分割（日本語・英語・中国語・韓国語に対応）
function splitSentences(text: string): string[] {
  return text.split(/[。！？!?\n.]+/).filter(s => s.trim().length > 3);
}

// 言語非依存のキーワード抽出（日本語・英語・多言語対応）
function extractKeywords(text: string): string[] {
  return text
    .replace(/[^\u3040-\u9fff\uAC00-\uD7AF\u4E00-\u9FFFA-Za-z0-9]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

// 説明的表現の検出（多言語対応）
function countExplanatoryPatterns(text: string): { whyCount: number; whatCount: number } {
  const jaWhy = /なぜ|だから|つまり|例えば|具体的|原因|理由|仕組み|ように|によって|ことで|のため|したがって|すなわち|要するに/g;
  const enWhy = /because|therefore|since|for example|specifically|cause|reason|mechanism|thus|hence|in other words|that is|such as|due to|as a result/gi;
  const jaWhat = /です|ます|ある|いる|する|なる|もの|こと/g;
  const enWhat = /\bis\b|\bare\b|\bwas\b|\bwere\b|\bhas\b|\bhave\b|\bdo\b|\bdoes\b/gi;

  const whyCount = (text.match(jaWhy) || []).length + (text.match(enWhy) || []).length;
  const whatCount = (text.match(jaWhat) || []).length + (text.match(enWhat) || []).length;
  return { whyCount, whatCount };
}

export function calculateRQS(
  userMessage: string,
  aiPreviousQuestion: string,
  _coreText: string
): RQSResult {
  const msgLen = userMessage.length;

  // 1. 文構成の質 — 完結する文があるか（多言語対応）
  const sentences = splitSentences(userMessage);
  // 文の質: 文数だけでなく平均文長も考慮（短文の羅列を低評価）
  const avgSentLen = sentences.length > 0
    ? sentences.reduce((sum, s) => sum + s.trim().length, 0) / sentences.length
    : 0;
  const sentCountScore = Math.min(1, sentences.length / 3);
  const sentLenScore = Math.min(1, avgSentLen / 20);
  const sentenceQuality = sentCountScore * 0.5 + sentLenScore * 0.5;

  // 2. 関連度 — AI質問のキーワードとの重複（多言語対応）
  const aiKeywords = extractKeywords(aiPreviousQuestion);
  const userWords = extractKeywords(userMessage);

  let overlap = 0;
  const matched = new Set<string>();
  for (const uw of userWords) {
    for (const ak of aiKeywords) {
      if (!matched.has(ak) && (uw.includes(ak) || ak.includes(uw))) {
        overlap++;
        matched.add(ak);
        break;
      }
    }
  }
  const relevance = aiKeywords.length > 0
    ? Math.min(1, overlap / Math.max(1, aiKeywords.length * 0.3))
    : 0.5;

  // 3. 情報量 — 説明的表現の密度（多言語対応）
  const { whyCount, whatCount } = countExplanatoryPatterns(userMessage);
  let infoContent: number;
  if (whyCount > 0) {
    // 説明的表現がある: whyの割合で評価
    infoContent = Math.min(1, whyCount / (whyCount + whatCount + 1) * 2.5);
  } else if (msgLen > 100) {
    // 長い文だが説明表現なし: 長さに応じて中程度
    infoContent = Math.min(0.5, msgLen / 300);
  } else {
    // 短い文で説明表現なし
    infoContent = Math.min(0.3, msgLen / 200);
  }

  // 4. 詳述度 — 文字数 + ユニークキーワード数（長さだけでなく多様性も）
  const uniqueWords = new Set(userWords).size;
  const lenScore = Math.min(1, msgLen / 150);
  const diversityScore = Math.min(1, uniqueWords / 10);
  const elaboration = lenScore * 0.6 + diversityScore * 0.4;

  // 総合RQS
  const score = Math.round((
    sentenceQuality * 0.2 +
    relevance * 0.3 +
    infoContent * 0.3 +
    elaboration * 0.2
  ) * 100) / 100;

  return {
    score: Math.max(0, Math.min(1, score)),
    signals: {
      sentence_quality: Math.round(sentenceQuality * 100) / 100,
      relevance: Math.round(relevance * 100) / 100,
      info_content: Math.round(infoContent * 100) / 100,
      elaboration: Math.round(elaboration * 100) / 100,
    },
  };
}

// ─── 適応質問ステートマシン ─────────────────────────────────

export function selectNextState(
  rqs: number,
  currentState: QuestionState,
  turn: number,
  hasMisconception: boolean,
  totalTurns = 6,
  stateHistory: { state: QuestionState }[] = []
): { state: QuestionState; reason: string } {
  // Turn 1: 常にORIENT
  if (turn === 1) {
    return { state: "ORIENT", reason: "初回ターン: 全体像を確認" };
  }

  // 優先オーバーライド: 誤概念検出（ただしCHALLENGE連続は避ける）
  if (hasMisconception && turn <= totalTurns - 2 && currentState !== "CHALLENGE") {
    return { state: "CHALLENGE", reason: `誤概念検出 (RQS=${rqs.toFixed(2)})` };
  }

  // Spacing callback: 最終ターンは統合
  if (turn >= totalTurns - 1) {
    return { state: "INTEGRATE", reason: "最終統合 + spacing callback" };
  }

  // サイクル検出: 同じ状態が2回連続したら別の状態へ移行
  const recentStates = stateHistory.slice(-2).map(s => s.state);
  const isStuck = recentStates.length >= 2 && recentStates.every(s => s === currentState);

  // RQS駆動遷移（サイクル回避付き）
  let nextState: QuestionState;
  let reason: string;

  if (rqs < 0.3) {
    nextState = "CLARIFY";
    reason = `低RQS (${rqs.toFixed(2)}): 明確化が必要`;
  } else if (rqs < 0.6) {
    nextState = "PROBE_DEPTH";
    reason = `中RQS (${rqs.toFixed(2)}): 深掘りへ`;
  } else if (rqs < 0.8) {
    nextState = "PROBE_BREADTH";
    reason = `高RQS (${rqs.toFixed(2)}): 幅広く探る`;
  } else {
    nextState = "INTEGRATE";
    reason = `最高RQS (${rqs.toFixed(2)}): 統合段階へ`;
  }

  // サイクル回避: 同じ状態にスタックしている場合、一段上の状態に移行
  if (isStuck && nextState === currentState) {
    const escalation: Record<QuestionState, QuestionState> = {
      ORIENT: "CLARIFY",
      CLARIFY: "PROBE_DEPTH",
      PROBE_DEPTH: "PROBE_BREADTH",
      PROBE_BREADTH: "INTEGRATE",
      INTEGRATE: "CHALLENGE",
      CHALLENGE: "INTEGRATE",
    };
    nextState = escalation[currentState];
    reason += ` → サイクル回避: ${currentState}から${nextState}へエスカレーション`;
  }

  return { state: nextState, reason };
}

// ─── Knowledge-Building 検出 ────────────────────────────────

export interface KBSignals {
  sentence_formation: "well-formed" | "fragmented";
  relevance: "direct" | "tangential";
  information_content: "why-informative" | "what-informative";
  elaboration: "descriptive" | "repetitive";
}

export function detectKnowledgeBuilding(
  userMessage: string,
  previousMessages: string[]
): { mode: "building" | "telling" | "mixed"; signals: KBSignals } {
  // 文構成品質（多言語対応）
  const sentences = splitSentences(userMessage);
  const avgLen = sentences.reduce((sum, s) => sum + s.trim().length, 0) / Math.max(1, sentences.length);
  const sentence_formation: KBSignals["sentence_formation"] =
    avgLen > 12 && sentences.length >= 2 ? "well-formed" : "fragmented";

  // 関連度（前のメッセージからの引用 vs 新情報）（多言語対応）
  const prevText = previousMessages.join(" ");
  const prevWords = new Set(extractKeywords(prevText).filter(w => w.length >= 3));
  const userWords = extractKeywords(userMessage).filter(w => w.length >= 3);
  const newWords = userWords.filter(w => !prevWords.has(w));
  const relevance: KBSignals["relevance"] = userWords.length === 0
    ? "tangential"
    : newWords.length > userWords.length * 0.3 ? "direct" : "tangential";

  // 情報内容タイプ（多言語対応）
  const { whyCount } = countExplanatoryPatterns(userMessage);
  const information_content: KBSignals["information_content"] =
    whyCount > 0 ? "why-informative" : "what-informative";

  // 詳述度（繰り返しチェック改善）
  const repetitions = previousMessages.filter(m => {
    const mWords = extractKeywords(m);
    if (userWords.length === 0 || mWords.length === 0) return false;
    const overlapCount = userWords.filter(w => mWords.some(mw => mw.includes(w) || w.includes(mw))).length;
    return overlapCount > userWords.length * 0.7;
  });
  const elaboration: KBSignals["elaboration"] =
    repetitions.length === 0 && newWords.length >= 3 ? "descriptive" : "repetitive";

  const signals = { sentence_formation, relevance, information_content, elaboration };

  // Knowledge-Building判定
  const buildingSignals = [
    sentence_formation === "well-formed",
    relevance === "direct",
    information_content === "why-informative",
    elaboration === "descriptive",
  ].filter(Boolean).length;

  const mode = buildingSignals >= 3 ? "building"
    : buildingSignals <= 1 ? "telling"
    : "mixed";

  return { mode, signals };
}

// ─── Elo Rating System ──────────────────────────────────────

export function updateElo(
  currentRating: number,
  kFactor: number,
  observed: number, // v3スコア 1-5
  expected: number  // 予測値 (previous avg)
): number {
  // observed, expected を 0-1 に正規化
  const observedNorm = (observed - 1) / 4;
  const expectedNorm = (expected - 1) / 4;
  const delta = Math.round(kFactor * (observedNorm - expectedNorm));
  return Math.max(400, Math.min(2400, currentRating + delta));
}

export function getKFactor(sessionCount: number): number {
  return sessionCount < 5 ? 40 : 16;
}

// ─── v3 スコアリングプロンプト (AI用) ───────────────────────

export function getV3ScoringCriteria(mode: string): string {
  const weights = getV3Weights(mode);
  const weightDesc = Object.entries(weights)
    .map(([k, w]) => `${k}(重み${Math.round(w * 100)}%)`)
    .join(", ");

  return `## 評価軸 — SOLO Taxonomy 1-5 スケール（${weightDesc}）

各次元を1〜5の整数で評価してください。
※ 元教材の内容と照合し、事実の正確さも考慮すること。自信満々でも内容が間違っていれば低く評価する。

completeness（網羅性）:
  5: 教材の主要概念をほぼすべて自発的に言及し、周辺知識にも触れた
  4: 大部分を説明できた。一部漏れはあるが核心は網羅
  3: 半分程度の概念に言及。重要な概念が抜けている
  2: 主要概念の一部のみ。断片的な知識
  1: ほとんど言及できなかった、またはトピックとの関連が薄い

depth（深さ）:
  5: 仕組み・原理・因果関係まで正確に説明。「なぜそうなるか」を自分の言葉で論理的に展開
  4: 概念の意味と理由を説明できるが、一部の因果関係が浅い
  3: 表面的な定義は言えるが「なぜ？」への答えが不十分
  2: 用語の定義のみ。理由や仕組みの説明がない
  1: 本質的な理解が見られない。暗記した単語の羅列

clarity（明晰さ）:
  5: 論理的で具体例あり。初めて聞く人にも理解できる説明
  4: 概ね明瞭だが、具体例や順序が若干不足
  3: やや混乱しているが、伝えたい内容は推測できる
  2: 何を言いたいかが不明瞭。説明が飛躍する
  1: 理解困難。話の筋が追えない

structural_coherence（論理構造）:
  5: 概念間の依存関係・因果・順序が正確。体系的で一貫した説明
  4: 大筋は正しいが一部に論理の飛躍や順序の前後がある
  3: 個別の概念は知っているが、概念同士の繋がりが不明確
  2: 知識が散発的で、論理的な流れがない
  1: 概念間の関係を理解していない

pedagogical_insight（教育的洞察）:
  5: 自ら比喩・具体例・身近な例えを使い、相手の理解度に合わせて説明を調整できる
  4: 質問に応じて良い説明ができ、時に自発的に補足や具体例を出す
  3: 質問には答えるが、自発的な展開や工夫がない
  2: こちらが具体的に聞かないと何も出てこない。受動的
  1: 教材の丸暗記を繰り返すだけ。自分の言葉で説明できない

## 採点の注意点
- ペナルティは適用しない（誘導・諦め・速度による減点なし）
- 純粋にユーザーの応答品質と内容の正確さで評価すること
- 教材に書いてある内容と照合し、事実関係の正誤も必ずチェックすること
- 「よく頑張った」等の感情的配慮でスコアを水増ししないこと。正直に評価する`;
}

// ─── v3 質問テンプレート ────────────────────────────────────

export const V3_QUESTION_TEMPLATES: Record<QuestionState, string> = {
  ORIENT:       "「[トピック]について教えてほしいな！ そもそも[トピック]ってどんなもので、なんで大事なの？」",
  CLARIFY:      "「[用語]って言ってたけど、具体的にどういう意味？」",
  PROBE_DEPTH:  "「表面的にはわかったけど、なんで[メカニズム]はそう動くの？」",
  PROBE_BREADTH:"「[概念A]と、さっき言ってた[概念B]ってどう関係するの？」",
  INTEGRATE:    "「全部まとめると[統合的要約]ってことで合ってる？」",
  CHALLENGE:    "「もし[もっともらしい反例]だったらどう変わる？」",
};

// ─── インサイト生成 ─────────────────────────────────────────

function generateInsightV3(
  scores: RawScoreV3,
  grade: string,
  kbMode: string
): string {
  const entries = Object.entries(scores) as [V3Dimension, number][];
  const lowest = entries.sort(([, a], [, b]) => a - b)[0];
  const highest = entries.sort(([, a], [, b]) => b - a)[0];

  const dimLabels: Record<V3Dimension, string> = {
    completeness: "網羅性",
    depth: "深さ",
    clarity: "明晰さ",
    structural_coherence: "論理構造",
    pedagogical_insight: "教育的洞察",
  };

  const suggestions: Record<V3Dimension, string> = {
    completeness: "もう少し多くの概念に触れてみよう",
    depth: "「なぜ？」「どう動く？」の説明を増やすと深みが出る",
    clarity: "具体例や順序立てた説明でさらに伝わりやすくなる",
    structural_coherence: "概念同士のつながりを意識して説明してみよう",
    pedagogical_insight: "自分の言葉で比喩や例えを使って説明してみよう",
  };

  if (grade === "A") {
    return `素晴らしい説明！特に${dimLabels[highest[0]]}が際立っている`;
  }

  const kbHint = kbMode === "telling"
    ? "。暗記した内容の再現ではなく、自分の理解で語ってみよう"
    : "";

  return `${suggestions[lowest[0]]}${kbHint}`;
}

// ─── v3 最終採点プロンプトJSON形式 ──────────────────────────

export function getV3FinalPromptFormat(): string {
  return `JSON の各数値フィールドは整数のみ (1-5)。説明文字列は禁止:

{
  "completeness": 4,
  "depth": 3,
  "clarity": 4,
  "structural_coherence": 3,
  "pedagogical_insight": 3,
  "feedback": "フィードバック文",
  "mastered": ["概念A", "概念B"],
  "gaps": ["概念C"],
  "improvement_suggestions": ["提案1", "提案2", "提案3"]
}

## feedbackの書き方（キャラの口調で書くこと）
(1) 良かった点: ユーザーが正確に説明できた具体的な概念名を引用し、何がどう良かったか褒める
(2) 改善点: 不足・誤解があった具体的な部分を「〇〇については本来△△だけど、□□って言ってたからちょっとズレがあるかな」のように教材と照合して具体的に指摘
(3) 一言まとめ: 今後どうすればもっと良くなるかの一言アドバイス

## mastered（最大10個）
会話の中でユーザーが正確に説明できたキーコンセプトのみ。曖昧な説明や誤った説明の概念は含めない。

## gaps
ユーザーが説明できなかった・誤解していた・触れなかった重要概念。教材の内容と照合して抽出する。

## improvement_suggestions（3つ）
ユーザーの実際の説明に基づいた具体的な改善提案。抽象的な助言（「もっと頑張ろう」等）は禁止。
例: 「光合成の反応式を覚えるだけでなく、なぜ光エネルギーが必要かの仕組みを説明できるようにしよう」

上記は例示。実際の会話内容と元教材を照合して正確に採点してください。`;
}

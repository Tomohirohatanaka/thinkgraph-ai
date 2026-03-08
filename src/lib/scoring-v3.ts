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
  A: 4.0,
  B: 3.0,
  C: 2.0,
  D: 1.0,
  // F: below 1.0
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
  const allAbove1 = values.every(s => s >= 1.0);
  const allAbove2_5 = values.every(s => s >= 2.5);

  // グレードB以上なら全次元2.5以上必要
  if (grade === "A" || grade === "B") {
    if (!allAbove2_5) return false;
  }
  // どのグレードでも全次元1.0以上必要（0.x は極端に弱い）
  if (!allAbove1) return false;
  return true;
}

// ─── エビデンスベース・スコア補正 ─────────────────────────────
//
// LLMは中央値バイアス（3.0付近に収束）を持つ。
// キャップ（上限制限）ではなく、RQSシグナルを乗数として
// LLMスコアを連続的にスケーリングし、0.0〜5.0のフルレンジを活用する。

export interface ConversationEvidence {
  rqsHistory: { score: number; signals: { sentence_quality: number; relevance: number; info_content: number; elaboration: number } }[];
  kbMode: "building" | "telling" | "mixed";
  userMessages: string[];  // ユーザーの全発言
  totalTurns: number;
}

/** 0.0-5.0 に丸める */
function round1(val: number): number {
  return Math.round(Math.max(0, Math.min(5.0, val)) * 10) / 10;
}

/**
 * RQSシグナル(0-1)をスコア乗数に変換する。
 * signal=0.0 → 乗数0.55 (最低でもLLMスコアの55%は保持)
 * signal=0.5 → 乗数0.85 (やや下方修正)
 * signal=1.0 → 乗数1.15 (やや上方修正)
 *
 * 緩やかなカーブでスケーリング。学習意欲を維持するため底を上げる。
 */
function signalToMultiplier(signal: number): number {
  if (signal <= 0) return 0.55;
  if (signal >= 1) return 1.15;
  // 区分線形: 0→0.55, 0.3→0.7, 0.5→0.85, 0.7→0.95, 1.0→1.15
  if (signal < 0.3) return 0.55 + signal * 0.5;          // 0→0.55, 0.3→0.70
  if (signal < 0.5) return 0.70 + (signal - 0.3) * 0.75; // 0.3→0.70, 0.5→0.85
  return 0.85 + (signal - 0.5) * 0.6;                     // 0.5→0.85, 1.0→1.15
}

/**
 * 発言量(平均文字数)をスコア乗数に変換する。
 * 日本語は情報密度が高いため、短い文字数でも高い乗数を返す。
 * 0文字 → 0.4, 20文字 → 0.75, 50文字 → 0.9, 80文字+ → 1.0
 */
function messageLengthMultiplier(avgLen: number): number {
  if (avgLen <= 0) return 0.4;
  if (avgLen >= 80) return 1.0;
  // 底を0.4にして、80文字で1.0に到達する緩やかなカーブ
  return Math.min(1.0, 0.4 + 0.6 * Math.sqrt(avgLen / 80));
}

/**
 * ターン数をスコア乗数に変換する。
 * 1ターン → 0.7, 2ターン → 0.8, 3ターン → 0.9, 4+ → 1.0
 */
function turnCountMultiplier(turns: number): number {
  if (turns <= 0) return 0.5;
  if (turns >= 4) return 1.0;
  return 0.6 + turns * 0.1; // 1→0.7, 2→0.8, 3→0.9
}

/**
 * LLMスコアをエビデンスに基づいて連続的にスケーリングする。
 * キャップ（上限制限）は使わない。各次元にRQSシグナル乗数を掛けて
 * 0.0〜5.0のフルレンジを出力する。
 */
export function adjustScoresWithEvidence(
  raw: RawScoreV3,
  evidence: ConversationEvidence
): RawScoreV3 {
  // === RQS信号の平均を計算 ===
  const hasRQS = evidence.rqsHistory.length > 0;
  const avgSignals = hasRQS ? {
    sentence_quality: evidence.rqsHistory.reduce((s, r) => s + r.signals.sentence_quality, 0) / evidence.rqsHistory.length,
    relevance: evidence.rqsHistory.reduce((s, r) => s + r.signals.relevance, 0) / evidence.rqsHistory.length,
    info_content: evidence.rqsHistory.reduce((s, r) => s + r.signals.info_content, 0) / evidence.rqsHistory.length,
    elaboration: evidence.rqsHistory.reduce((s, r) => s + r.signals.elaboration, 0) / evidence.rqsHistory.length,
  } : { sentence_quality: 0.5, relevance: 0.5, info_content: 0.5, elaboration: 0.5 };

  const rqsAvg = hasRQS
    ? evidence.rqsHistory.reduce((s, r) => s + r.score, 0) / evidence.rqsHistory.length
    : 0.5;

  // === 各次元にRQSシグナル乗数を適用 ===
  // 各シグナルと次元の対応:
  //   info_content → depth (因果説明の量)
  //   sentence_quality → clarity (文の質)
  //   relevance → structural_coherence (質問との関連性 = 構造的理解)
  //   elaboration → completeness (詳述量 = 網羅性)
  //   info_content + elaboration → pedagogical_insight (説明の質 + 量)
  const signalMultipliers = {
    completeness:          signalToMultiplier(avgSignals.elaboration),
    depth:                 signalToMultiplier(avgSignals.info_content),
    clarity:               signalToMultiplier(avgSignals.sentence_quality),
    structural_coherence:  signalToMultiplier(avgSignals.relevance),
    pedagogical_insight:   signalToMultiplier((avgSignals.info_content + avgSignals.elaboration) / 2),
  };

  // === 発言量乗数（全次元共通） ===
  const userMsgs = evidence.userMessages;
  const totalChars = userMsgs.reduce((sum, m) => sum + m.length, 0);
  const avgMsgLen = userMsgs.length > 0 ? totalChars / userMsgs.length : 0;
  const lenMult = messageLengthMultiplier(avgMsgLen);

  // === ターン数乗数（completeness, structural_coherence に影響） ===
  const turnMult = turnCountMultiplier(evidence.totalTurns);

  // === KB mode 乗数 ===
  // telling: pedagogical_insight に 0.5 乗数、depth に 0.7 乗数
  // mixed: pedagogical_insight に 0.8 乗数
  // building: 乗数なし（1.0）
  const kbMultPedagogy = evidence.kbMode === "telling" ? 0.7 : evidence.kbMode === "mixed" ? 0.9 : 1.0;
  const kbMultDepth = evidence.kbMode === "telling" ? 0.85 : 1.0;

  // === 全体RQS乗数（全次元共通のベースライン） ===
  // rqsAvg が低いほど全体的にスコアが下がる
  const globalRqsMult = signalToMultiplier(rqsAvg);

  // === 最終スコア = LLMスコア × シグナル乗数 × 発言量乗数 × KB乗数 × 全体RQS乗数 ===
  // ただし、乗数の合成は幾何平均的に適用（過度な減衰を防ぐ）
  function compositeMultiplier(...mults: number[]): number {
    // 幾何平均と算術平均のブレンド（7:3）で過度な減衰を防ぐ
    const safeMults = mults.map(m => Math.max(0.3, m));
    const product = safeMults.reduce((a, b) => a * b, 1);
    const geometric = Math.pow(product, 1 / safeMults.length);
    const arithmetic = safeMults.reduce((a, b) => a + b, 0) / safeMults.length;
    return geometric * 0.7 + arithmetic * 0.3;
  }

  const adjusted: RawScoreV3 = {
    completeness: round1(raw.completeness * compositeMultiplier(
      signalMultipliers.completeness, lenMult, turnMult, globalRqsMult
    )),
    depth: round1(raw.depth * compositeMultiplier(
      signalMultipliers.depth, lenMult, kbMultDepth, globalRqsMult
    )),
    clarity: round1(raw.clarity * compositeMultiplier(
      signalMultipliers.clarity, lenMult, globalRqsMult
    )),
    structural_coherence: round1(raw.structural_coherence * compositeMultiplier(
      signalMultipliers.structural_coherence, lenMult, turnMult, globalRqsMult
    )),
    pedagogical_insight: round1(raw.pedagogical_insight * compositeMultiplier(
      signalMultipliers.pedagogical_insight, lenMult, kbMultPedagogy, globalRqsMult
    )),
  };

  return adjusted;
}

// ─── v3 スコア計算 ──────────────────────────────────────────

export function calcScoreV3(
  raw: RawScoreV3,
  mode: string,
  kbMode: "building" | "telling" | "mixed" = "mixed",
  rqsAvg = 0.5,
  evidence?: ConversationEvidence
): ScoreV3 {
  // エビデンスベース補正（データがある場合のみ）
  const effectiveRaw = evidence
    ? adjustScoresWithEvidence(raw, evidence)
    : raw;

  const weights = getV3Weights(mode);

  // 加重平均
  let weighted = 0;
  for (const [dim, w] of Object.entries(weights)) {
    weighted += effectiveRaw[dim as V3Dimension] * w;
  }
  weighted = Math.round(weighted * 100) / 100;

  const grade = getGradeV3(weighted);
  const conjunctive_pass = checkConjunctive(effectiveRaw, grade);
  const insight = generateInsightV3(effectiveRaw, grade, kbMode);

  return {
    raw: effectiveRaw,
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
  // 0-100 → 0.0-5.0 の線形マッピング
  return Math.round((v2Score / 100) * 5 * 10) / 10;
}

export function convertV3toV2(v3Score: number): number {
  // 0.0-5.0 → 0-100 の線形マッピング
  return Math.round((v3Score / 5) * 100);
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

  return `## 評価軸 — SOLO Taxonomy 0.0-5.0 スケール（${weightDesc}）

各次元を0.0〜5.0の小数第一位まで（0.1刻み）で厳密に評価してください。
※ 0.0も正当なスコア。全く言及なし・完全に的外れなら0.0をつけること。
※ 元教材の内容と一文ずつ照合し、事実の正確さを最重視すること。
※ ユーザーが自分なりに説明しようとしている努力も適切に評価すること。
※ 平均的な学生が初見でそれなりに説明したら2.5〜3.5程度が自然。4.0以上は特に優れた説明に。

completeness（網羅性）:
  5.0: 教材の主要概念を100%自発的に言及し、教材にない周辺知識にも正確に触れた
  4.0: 大部分（80%程度）を説明。核心は網羅しているが一部の重要概念が欠落
  3.0: 半分程度の概念に言及。重要な概念が複数抜けている
  2.0: 主要概念の一部（20%程度）のみ。ほぼ断片的な知識
  1.0: トピックに関連する単語を数個挙げた程度
  0.0: 全く言及なし。トピックと無関係な発言のみ

depth（深さ）:
  5.0: 仕組み・原理・因果関係まで正確に説明。「なぜそうなるか」を自分の言葉で多層的に論理展開
  4.0: 概念の意味と主な理由を説明できるが、一部の因果関係が浅いまま
  3.0: 表面的な定義は言えるが「なぜ？」への答えが不十分。暗記レベル
  2.0: 用語の定義のみ。理由や仕組みの説明がない
  1.0: 本質的な理解が見られない。暗記した単語の羅列
  0.0: 何も説明できなかった。沈黙またはトピック外の発言のみ

clarity（明晰さ）:
  5.0: 完璧に論理的で具体例が豊富。初めて聞く人にも即座に理解できる説明
  4.0: 概ね明瞭だが、具体例や順序が若干不足
  3.0: やや混乱しているが、伝えたい内容は推測できる
  2.0: 何を言いたいかが不明瞭。説明が飛躍する
  1.0: 理解困難。話の筋が追えない
  0.0: 意味のある文が一つもない

structural_coherence（論理構造）:
  5.0: 概念間の依存関係・因果・順序が完全に正確。体系的で一貫した説明
  4.0: 大筋は正しいが一部に論理の飛躍や順序の前後がある
  3.0: 個別の概念は知っているが、概念同士の繋がりが不明確
  2.0: 知識が散発的で、論理的な流れがない
  1.0: 概念間の関係を理解していない
  0.0: 概念を一つも正しく関連づけられなかった

pedagogical_insight（教育的洞察）:
  5.0: 自ら比喩・具体例・身近な例えを使い、相手の理解度に合わせて説明を動的に調整できる
  4.0: 質問に応じて良い説明ができ、時に自発的に補足や具体例を出す
  3.0: 質問には答えるが、自発的な展開や工夫がない
  2.0: こちらが具体的に聞かないと何も出てこない。受動的
  1.0: 教材の丸暗記を繰り返すだけ。自分の言葉で説明できない
  0.0: 応答がないか、質問を完全に無視した

※ 上記は整数の目安。0.1刻みの中間値を積極的に使うこと（例: 1.3, 2.7, 3.4 など）

## 採点ガイドライン（必ず守ること）
- 教材に書いてある重要概念をユーザーが言及していない場合、completenessは減点する
- 「なぜそうなるか」の説明がなければdepthは3.5以下にする
- 概念間の関係を説明していなければstructural_coherenceは3.5以下にする
- ペナルティは適用しない（誘導・諦め・速度による減点なし）
- 純粋にユーザーの応答品質と内容の正確さで評価すること
- 教材に書いてある内容と照合し、事実関係の正誤もチェックすること
- ユーザーが自分の言葉で説明しようとしている努力は積極的に評価する
- 完璧でなくても、核心を捉えた説明には適正なスコアを与えること
- 0.1刻みの精度を活用し、微妙な差を適切に反映すること（例: 3.0と3.5の間なら3.2や3.3を使う）

## ⚠️ 中央値バイアス禁止（最重要）
あなたには「とりあえず3.0前後をつける」傾向がある。これは禁止する。
各次元を独立に評価し、次元ごとに異なるスコアを出すこと。5次元すべてが2.8〜3.2に収まるのは異常。
必ず最低1つは他より0.5以上低いスコアの次元を見つけること（その学生の弱点）。

## 採点キャリブレーション例
以下はスコアの目安。実際の会話内容を必ず照合すること。

例1: ユーザーが「わかんない」「うーん…」程度で何も説明できなかった
→ completeness: 0.5, depth: 0.3, clarity: 1.0, structural_coherence: 0.3, pedagogical_insight: 0.3
（何も説明できていない。加重平均 ≈ 0.5）

例2: ユーザーが「光合成は植物がやるやつです」「太陽の光を使います」程度の断片的な説明
→ completeness: 1.5, depth: 1.2, clarity: 2.2, structural_coherence: 1.0, pedagogical_insight: 1.0
（断片的だが基本的な理解はある。加重平均 ≈ 1.4）

例3: ユーザーが「光合成は植物が光エネルギーを使って水とCO2からグルコースを作る反応です。葉緑体で行われます」
→ completeness: 2.8, depth: 2.2, clarity: 3.2, structural_coherence: 2.3, pedagogical_insight: 2.0
（基本は説明できている。「なぜ」がもう少し欲しい。加重平均 ≈ 2.5）

例4: ユーザーが定義＋理由＋具体例を交えて説明し、質問にも的確に回答
→ completeness: 3.8, depth: 3.3, clarity: 3.8, structural_coherence: 3.0, pedagogical_insight: 3.5
（しっかり理解している。概念間の繋がりがもう少し欲しい。加重平均 ≈ 3.5）

例5: ユーザーが教材の全概念を網羅し、因果関係を多層的に説明、比喩を使って相手に合わせた説明
→ completeness: 4.5, depth: 4.3, clarity: 4.5, structural_coherence: 4.2, pedagogical_insight: 4.5
（素晴らしい説明。加重平均 ≈ 4.4）`;
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
  const sorted = [...entries].sort(([, a], [, b]) => a - b);
  const lowest = sorted[0];
  const highest = [...entries].sort(([, a], [, b]) => b - a)[0];

  const dimLabels: Record<V3Dimension, string> = {
    completeness: "網羅性",
    depth: "深さ",
    clarity: "明晰さ",
    structural_coherence: "論理構造",
    pedagogical_insight: "教育的洞察",
  };

  const suggestions: Record<V3Dimension, string> = {
    completeness: "教材の重要概念をもっと多く言及してみよう",
    depth: "「なぜ？」「どう動く？」の説明を増やすと深みが出る",
    clarity: "具体例や順序立てた説明でさらに伝わりやすくなる",
    structural_coherence: "概念同士のつながりを意識して説明してみよう",
    pedagogical_insight: "自分の言葉で比喩や例えを使って説明してみよう",
  };

  if (grade === "A") {
    return `素晴らしい説明！特に${dimLabels[highest[0]]}(${highest[1].toFixed(1)})が際立っている`;
  }

  const kbHint = kbMode === "telling"
    ? "。暗記した内容の再現ではなく、自分の理解で語ってみよう"
    : "";

  // 極端に低い場合
  const mean = sorted.reduce((s, [, v]) => s + v, 0) / sorted.length;
  if (mean < 1.0) {
    return `教材を一度しっかり読み直してから、もう一度挑戦してみよう${kbHint}`;
  }

  // 低スコアの次元が複数ある場合は指摘
  const lowDims = sorted.filter(([, v]) => v < 2.0);
  if (lowDims.length >= 3) {
    return `全体的に理解が浅い。特に${dimLabels[lowest[0]]}(${lowest[1].toFixed(1)})を重点的に復習しよう${kbHint}`;
  }

  return `${dimLabels[lowest[0]]}(${lowest[1].toFixed(1)})が課題: ${suggestions[lowest[0]]}${kbHint}`;
}

// ─── v3 最終採点プロンプトJSON形式 ──────────────────────────

export function getV3FinalPromptFormat(): string {
  return `## 採点手順（この順番で思考すること）
1. まず教材から主要概念を5-10個リストアップする
2. ユーザーの各発言を読み、どの概念に正確に言及したかチェックする
3. 「なぜ？」に答えている箇所、具体例がある箇所を特定する
4. 上記のチェック結果に基づいて各次元のスコアを決定する
5. 5次元のスコアを見直し、全部が似たスコア（±0.3以内）なら弱い次元を下方修正する

JSON の各スコアフィールドは小数第一位まで (0.0-5.0、0.1刻み)。整数ではなく必ず小数で出力すること。
0.0も正当なスコア。該当する能力が全く見られなければ0.0をつけること。
注意: 5次元すべてが同じようなスコアになるのは不自然。必ずメリハリをつけること。

{
  "completeness": 2.3,
  "depth": 1.5,
  "clarity": 2.8,
  "structural_coherence": 1.8,
  "pedagogical_insight": 1.2,
  "feedback": "フィードバック文",
  "mastered": ["概念A", "概念B"],
  "gaps": ["概念C"],
  "improvement_suggestions": ["提案1", "提案2", "提案3"]
}

## feedbackの書き方（キャラの口調で書くこと）
(1) 良かった点: ユーザーの実際の発言を「」で引用して、「〇〇って言ってくれたの、すごくわかりやすかった！」のように具体的に褒める。抽象的な「よく頑張った」は禁止。必ず会話中の具体的な発言内容に言及する
(2) 改善点: ユーザーが触れなかった・不十分だった部分を、「〇〇については△△って感じなんだけど、そこまでは説明してなかったかな」のように教材と照合して具体的に指摘。ここでもユーザーの発言を引用して比較する
(3) 一言まとめ: 次にどうすればもっとよくなるか、具体的な学習アクションを提案

## mastered（最大10個）
会話の中でユーザーが正確に説明できたキーコンセプトのみ。曖昧な説明や誤った説明の概念は含めない。

## gaps
ユーザーが説明できなかった・誤解していた・触れなかった重要概念。教材の内容と照合して抽出する。

## improvement_suggestions（3つ）
ユーザーの実際の発言を踏まえた超具体的な改善提案。必ず「あなたは〇〇と言っていたが…」のようにユーザーの発言を参照すること。
抽象的な助言（「もっと頑張ろう」「深く理解しよう」等）は禁止。
例: 「『光を使う』と言っていたけど、光エネルギーがどう化学エネルギーに変わるか（光化学反応→ATP合成）の流れも説明できるとdepthが上がるよ」

上記は例示。実際の会話内容と元教材を照合して正確に採点してください。`;
}

/**
 * teachAI Scoring Engine v2
 * ─────────────────────────────────────────────────────────────
 * 5次元評価モデル。各次元の定義と重み付けがここに集約される。
 *
 * v1からの変更点:
 *   - structural_coherence（論理構造の整合性）を追加
 *   - spontaneity（自発性）を追加
 *   - ペナルティ計算を独立モジュール化
 *   - 重み付けを設定可能に（ドメインごとにカスタマイズ可能）
 *
 * 転用:
 *   このファイルを変更するだけでスコアリングロジックが全API/MCPに反映される
 */

export interface RawScoreV2 {
  coverage: number;             // 網羅性: どれだけ多くの重要概念に言及したか
  depth: number;                // 深さ: なぜ・仕組みまで説明できたか
  clarity: number;              // 明晰さ: 論理的で具体例を含む説明か
  structural_coherence: number; // 論理構造: 因果・順序・依存関係が正しいか
  spontaneity: number;          // 自発性: 誘導なしに自分から説明できたか
}

export interface PenaltyBreakdown {
  leading: number;              // 誘導ペナルティ（AIの言葉を反復）
  gave_up: number;              // 諦めペナルティ
  too_quick: number;            // 2ターン以内に終了ペナルティ
  total: number;
}

export interface ScoreV2 {
  raw: RawScoreV2;
  penalty: PenaltyBreakdown;
  adjusted: RawScoreV2;         // ペナルティ適用後
  total: number;                // 最終スコア
  grade: "S" | "A" | "B" | "C" | "D"; // グレード
  insight: string;              // スコアに基づく1行フィードバック
}

// ─── 重み設定（ドメインごとにカスタマイズ可能）────────────

export const DEFAULT_WEIGHTS: Record<keyof RawScoreV2, number> = {
  coverage: 0.25,
  depth: 0.30,
  clarity: 0.20,
  structural_coherence: 0.15,
  spontaneity: 0.10,
};

// 手順系（procedure）は構造と網羅性を重視
export const PROCEDURE_WEIGHTS: Record<keyof RawScoreV2, number> = {
  coverage: 0.30,
  depth: 0.20,
  clarity: 0.20,
  structural_coherence: 0.25,
  spontaneity: 0.05,
};

// 概念系（concept/whynot）は深さと自発性を重視
export const CONCEPT_WEIGHTS: Record<keyof RawScoreV2, number> = {
  coverage: 0.20,
  depth: 0.35,
  clarity: 0.20,
  structural_coherence: 0.10,
  spontaneity: 0.15,
};

export function getWeights(mode: string): Record<keyof RawScoreV2, number> {
  if (mode === "procedure") return PROCEDURE_WEIGHTS;
  if (mode === "whynot" || mode === "concept") return CONCEPT_WEIGHTS;
  return DEFAULT_WEIGHTS;
}

// ─── スコア計算 ──────────────────────────────────────────────

export function calcScoreV2(
  raw: RawScoreV2,
  penalties: { leading: number; gave_up: number; turns: number },
  mode = "concept"
): ScoreV2 {
  const penaltyBreakdown: PenaltyBreakdown = {
    leading: penalties.leading,
    gave_up: penalties.gave_up * 12,
    too_quick: penalties.turns <= 2 ? 15 : 0,
    total: 0,
  };
  penaltyBreakdown.total = penaltyBreakdown.leading + penaltyBreakdown.gave_up + penaltyBreakdown.too_quick;

  const adj = (v: number) => Math.max(5, Math.min(100, Math.round(v) - penaltyBreakdown.total));

  const adjusted: RawScoreV2 = {
    coverage: adj(raw.coverage),
    depth: adj(raw.depth),
    clarity: adj(raw.clarity),
    structural_coherence: adj(raw.structural_coherence),
    spontaneity: adj(raw.spontaneity),
  };

  const weights = getWeights(mode);
  const total = Math.round(
    Object.entries(weights).reduce((sum, [key, w]) => sum + adjusted[key as keyof RawScoreV2] * w, 0)
  );

  const grade = total >= 90 ? "S" : total >= 75 ? "A" : total >= 60 ? "B" : total >= 45 ? "C" : "D";

  const insight = generateInsight(adjusted, grade);

  return { raw, penalty: penaltyBreakdown, adjusted, total, grade, insight };
}

function generateInsight(scores: RawScoreV2, grade: string): string {
  // 最も低い次元を特定して改善提案
  const entries = Object.entries(scores) as [keyof RawScoreV2, number][];
  const lowest = entries.sort(([,a],[,b]) => a - b)[0];

  const suggestions: Record<keyof RawScoreV2, string> = {
    coverage: "もう少し多くの概念に触れると良かった",
    depth: "「なぜ？」「どう動く？」という仕組みの説明をもっと入れると深みが出る",
    clarity: "具体例や順序立てた説明でさらに伝わりやすくなる",
    structural_coherence: "概念同士の因果関係や依存関係を意識して説明するとより良い",
    spontaneity: "AIの質問に頼らず自分から構造的に話せるようになると理解が深まる",
  };

  if (grade === "S") return "完璧な説明。全ての次元で高水準を達成";
  if (grade === "A") return `優秀な説明。${suggestions[lowest[0]]}`;
  return suggestions[lowest[0]];
}

// ─── AIへのプロンプト用スコア基準テキスト ────────────────────
// teach APIのプロンプトに埋め込む

export function getScoringCriteria(mode: string): string {
  const weights = getWeights(mode);
  const weightDesc = Object.entries(weights)
    .map(([k, w]) => `${k}(重み${Math.round(w*100)}%)`)
    .join(", ");

  return `## 評価軸（${weightDesc}）

coverage（網羅性）:
  90以上: 主要概念をほぼすべて自発的に言及
  70〜89: 大部分を説明、一部漏れ
  50〜69: 半分程度の概念に言及
  50未満: 重要概念の多くを見落とした

depth（深さ）:
  90以上: 仕組み・原理・因果関係まで正確に説明
  70〜89: 概念の意味は理解、理由の説明が浅い
  50〜69: 表面的な定義のみ
  50未満: 本質的な理解が見られない

clarity（明晰さ）:
  90以上: 論理的・具体例あり・聞いてわかりやすい
  70〜89: 概ね明瞭だが具体例や順序が不足
  50〜69: やや混乱した説明
  50未満: 何を言っているか理解困難

structural_coherence（論理構造）:
  90以上: 概念間の依存関係・因果・順序が正確
  70〜89: 大筋は正しいが一部論理の飛躍あり
  50〜69: 個別概念は知っているが繋がりが不明
  50未満: 論理構造が理解されていない

spontaneity（自発性）:
  90以上: 質問されなくても構造的に自分から展開
  70〜89: 質問があれば良い説明ができる
  50〜69: 質問に答えるのがやっと
  50未満: 誘導されないと何も出てこない`;
}

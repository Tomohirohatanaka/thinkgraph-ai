/**
 * teachAI Tool Registry — v3 追加分
 * ─────────────────────────────────────
 * 既存の tools.ts の TOOLS 配列に追加するツール定義
 * v3 のスコアリング・Elo・KBを MCP/OpenAPI で公開
 */

import type { ToolDefinition } from "./api";

export const V3_TOOLS: ToolDefinition[] = [
  // ── Elo Rating 取得 ──────────────────────────────────────
  {
    name: "get_elo_rating",
    description: "ユーザーのEloレーティングを取得する。トピック指定で特定分野、未指定で全トピック。次元(completeness/depth/clarity/structural_coherence/pedagogical_insight/overall)ごとのレーティングを返す。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "トピック名（省略で全トピック）" },
      },
      required: [],
    },
    outputSchema: {
      ratings: "EloRating[]",
      summary: "{ avg_rating: number, total_topics: number, peak_rating: number }",
    },
  },

  // ── Elo Rating 更新 ──────────────────────────────────────
  {
    name: "update_elo_rating",
    description: "セッション完了後にEloレーティングを更新する。v3の5次元スコアとweightedスコアを渡す。K-factor は最初5セッションは40、以降16に自動調整。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "学習トピック名", required: true },
        session_id: { type: "string", description: "セッションID（オプション）" },
        scores: {
          type: "object",
          description: "v3スコア { completeness, depth, clarity, structural_coherence, pedagogical_insight, weighted }",
          required: true,
        },
      },
      required: ["topic", "scores"],
    },
    outputSchema: {
      updates: "{ dimension: string, old_rating: number, new_rating: number, delta: number }[]",
    },
  },

  // ── v3 スコアリング (独立API) ──────────────────────────
  {
    name: "score_v3",
    description: "v3 SOLO準拠のスコアリングを独立実行する。5次元スコア(1-5)を入力し、加重平均・グレード・conjunctive check・インサイトを返す。teach_turnの内部でも使用される。",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: {
        completeness: { type: "number", description: "網羅性 (1-5)", required: true },
        depth: { type: "number", description: "深さ (1-5)", required: true },
        clarity: { type: "number", description: "明晰さ (1-5)", required: true },
        structural_coherence: { type: "number", description: "論理構造 (1-5)", required: true },
        pedagogical_insight: { type: "number", description: "教育的洞察 (1-5)", required: true },
        mode: { type: "string", description: "学習モード", enum: ["whynot", "vocabulary", "concept", "procedure"], default: "concept" },
        kb_mode: { type: "string", description: "KB検出結果", enum: ["building", "telling", "mixed"], default: "mixed" },
      },
      required: ["completeness", "depth", "clarity", "structural_coherence", "pedagogical_insight"],
    },
    outputSchema: {
      raw: "RawScoreV3",
      weighted: "number (1.0-5.0)",
      grade: "'A' | 'B' | 'C' | 'D' | 'F'",
      conjunctive_pass: "boolean",
      insight: "string",
    },
    examples: [
      {
        input: { completeness: 4, depth: 3, clarity: 4, structural_coherence: 3, pedagogical_insight: 3, mode: "concept" },
        description: "概念モードでv3スコア計算",
      },
    ],
  },
];

/**
 * 既存の tools.ts への統合方法:
 *
 * import { V3_TOOLS } from "./tools-v3";
 *
 * export const TOOLS: ToolDefinition[] = [
 *   ...existingTools,
 *   ...V3_TOOLS,
 * ];
 */

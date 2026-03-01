/**
 * teachAI Supabase Types — v3 追加分
 * ─────────────────────────────────────
 * 既存の types.ts に追加する型定義
 * sessions テーブルの v3 カラムと新テーブルの型
 */

// ─── sessions テーブル v3 追加カラム ─────────────────────────
// 以下を Database['public']['Tables']['sessions']['Row'] に追加:

export interface SessionV3Columns {
  // SOLO 1-5 スケール
  score_completeness: number | null;
  score_depth_v3: number | null;
  score_clarity_v3: number | null;
  score_structural_coherence_v3: number | null;
  score_pedagogical_insight: number | null;
  score_weighted_v3: number | null;
  grade_v3: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  conjunctive_pass: boolean | null;

  // RQS トラッキング
  rqs_scores: Array<{
    turn: number;
    score: number;
    signals: {
      sentence_quality: number;
      relevance: number;
      info_content: number;
      elaboration: number;
    };
  }> | null;
  rqs_avg: number | null;
  state_transitions: Array<{
    turn: number;
    from_state: string;
    to_state: string;
    rqs: number;
    reason: string;
  }> | null;

  // Knowledge-Building
  kb_mode: 'building' | 'telling' | 'mixed' | null;
  kb_signals: Array<{
    turn: number;
    mode: string;
    signals: Record<string, unknown>;
  }> | null;

  // バージョン管理
  scoring_version: 'v2' | 'v3' | null;
}

// ─── user_elo_ratings テーブル ───────────────────────────────

export interface EloRatingRow {
  id: string;
  user_id: string;
  tenant_id: string | null;
  topic: string;
  dimension: 'completeness' | 'depth' | 'clarity' | 'structural_coherence' | 'pedagogical_insight' | 'overall';
  rating: number;
  k_factor: number;
  session_count: number;
  peak_rating: number;
  last_updated: string;
  created_at: string;
}

export interface EloRatingInsert {
  user_id: string;
  tenant_id?: string | null;
  topic: string;
  dimension: EloRatingRow['dimension'];
  rating?: number;
  k_factor?: number;
  session_count?: number;
  peak_rating?: number;
}

// ─── elo_history テーブル ────────────────────────────────────

export interface EloHistoryRow {
  id: string;
  user_id: string;
  session_id: string | null;
  topic: string;
  dimension: string;
  rating_before: number;
  rating_after: number;
  delta: number;
  created_at: string;
}

// ─── user_stats_v3 ビュー ───────────────────────────────────

export interface UserStatsV3 {
  user_id: string;
  total_sessions: number;
  avg_score_v2: number;
  avg_score_v3: number;
  avg_rqs: number;
  total_seconds: number;
  last_session_at: string;
  unique_topics: number;
  kb_building_count: number;
  kb_telling_count: number;
  v3_session_count: number;
}

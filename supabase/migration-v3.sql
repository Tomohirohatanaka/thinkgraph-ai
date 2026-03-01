-- ============================================================
-- teachAI v3 Migration: Assessment Engine Upgrade
-- ============================================================
-- Run AFTER existing migration.sql
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS)
-- ============================================================

-- ─── 1. v3 スコアリング次元カラム追加 ─────────────────────
-- SOLO 1-5 スケール (v2の0-100と並行運用)
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS score_completeness         SMALLINT CHECK (score_completeness BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS score_depth_v3             SMALLINT CHECK (score_depth_v3 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS score_clarity_v3           SMALLINT CHECK (score_clarity_v3 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS score_structural_coherence_v3 SMALLINT CHECK (score_structural_coherence_v3 BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS score_pedagogical_insight  SMALLINT CHECK (score_pedagogical_insight BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS score_weighted_v3          FLOAT,
  ADD COLUMN IF NOT EXISTS grade_v3                   TEXT CHECK (grade_v3 IN ('A', 'B', 'C', 'D', 'F')),
  ADD COLUMN IF NOT EXISTS conjunctive_pass           BOOLEAN DEFAULT TRUE;

-- ─── 2. RQS (Real-time Response Quality Score) トラッキング
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS rqs_scores                 JSONB DEFAULT '[]',
  -- Format: [{ turn: 1, score: 0.65, signals: {...} }, ...]
  ADD COLUMN IF NOT EXISTS rqs_avg                    FLOAT,
  ADD COLUMN IF NOT EXISTS state_transitions          JSONB DEFAULT '[]';
  -- Format: [{ turn: 1, from: "ORIENT", to: "PROBE_DEPTH", rqs: 0.65, reason: "..." }, ...]

-- ─── 3. Knowledge-Building 検出 ──────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS kb_mode                    TEXT CHECK (kb_mode IN ('building', 'telling', 'mixed')),
  ADD COLUMN IF NOT EXISTS kb_signals                 JSONB DEFAULT '[]';
  -- Format: [{ turn: 1, mode: "building", signals: {...} }, ...]

-- ─── 4. スコアリングバージョン管理 ──────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS scoring_version            TEXT DEFAULT 'v2';
  -- 'v2' = legacy penalty-based, 'v3' = SOLO criterion-referenced

-- ─── 5. Elo Rating テーブル ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_elo_ratings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  dimension     TEXT NOT NULL
                  CHECK (dimension IN ('completeness', 'depth', 'clarity', 'structural_coherence', 'pedagogical_insight', 'overall')),
  rating        INTEGER NOT NULL DEFAULT 1200,
  k_factor      INTEGER NOT NULL DEFAULT 40,
  session_count INTEGER NOT NULL DEFAULT 0,
  peak_rating   INTEGER NOT NULL DEFAULT 1200,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, topic, dimension)
);

CREATE INDEX IF NOT EXISTS idx_elo_user ON public.user_elo_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_elo_user_topic ON public.user_elo_ratings(user_id, topic);
CREATE INDEX IF NOT EXISTS idx_elo_rating ON public.user_elo_ratings(rating DESC);

-- ─── 6. Elo Rating 履歴 (推移可視化用) ─────────────────
CREATE TABLE IF NOT EXISTS public.elo_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  dimension     TEXT NOT NULL,
  rating_before INTEGER NOT NULL,
  rating_after  INTEGER NOT NULL,
  delta         INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elo_hist_user ON public.elo_history(user_id, created_at DESC);

-- ─── 7. RLS ポリシー ────────────────────────────────────
ALTER TABLE public.user_elo_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own elo" ON public.user_elo_ratings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own elo" ON public.user_elo_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own elo" ON public.user_elo_ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Tenant admins
CREATE POLICY "Tenant admins can view tenant elo" ON public.user_elo_ratings
  FOR SELECT USING (
    tenant_id IS NOT NULL AND
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'admin')
    )
  );

ALTER TABLE public.elo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own elo history" ON public.elo_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own elo history" ON public.elo_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── 8. user_stats ビュー更新 (v3対応) ─────────────────
CREATE OR REPLACE VIEW public.user_stats_v3 AS
SELECT
  user_id,
  COUNT(*)::INTEGER AS total_sessions,
  ROUND(AVG(score_total)::NUMERIC, 1)::FLOAT AS avg_score_v2,
  ROUND(AVG(score_weighted_v3)::NUMERIC, 2)::FLOAT AS avg_score_v3,
  ROUND(AVG(rqs_avg)::NUMERIC, 2)::FLOAT AS avg_rqs,
  SUM(COALESCE(duration_seconds, 0))::INTEGER AS total_seconds,
  MAX(created_at) AS last_session_at,
  COUNT(DISTINCT topic)::INTEGER AS unique_topics,
  COUNT(*) FILTER (WHERE kb_mode = 'building')::INTEGER AS kb_building_count,
  COUNT(*) FILTER (WHERE kb_mode = 'telling')::INTEGER AS kb_telling_count,
  COUNT(*) FILTER (WHERE scoring_version = 'v3')::INTEGER AS v3_session_count
FROM public.sessions
WHERE status = 'completed'
GROUP BY user_id;

-- ─── 9. 既存データのバックフィル ────────────────────────
-- v2スコアをv3スケールに変換 (既存セッション)
-- completeness ← coverage/knowledge_fidelity のマッピング
-- Note: これは近似値。正確なv3スコアは再採点が必要

UPDATE public.sessions
SET
  scoring_version = 'v2',
  score_completeness = CASE
    WHEN COALESCE(score_knowledge_fidelity, score_total, 0) >= 90 THEN 5
    WHEN COALESCE(score_knowledge_fidelity, score_total, 0) >= 75 THEN 4
    WHEN COALESCE(score_knowledge_fidelity, score_total, 0) >= 60 THEN 3
    WHEN COALESCE(score_knowledge_fidelity, score_total, 0) >= 45 THEN 2
    ELSE 1
  END,
  score_depth_v3 = CASE
    WHEN COALESCE(score_thinking_depth, score_total, 0) >= 90 THEN 5
    WHEN COALESCE(score_thinking_depth, score_total, 0) >= 75 THEN 4
    WHEN COALESCE(score_thinking_depth, score_total, 0) >= 60 THEN 3
    WHEN COALESCE(score_thinking_depth, score_total, 0) >= 45 THEN 2
    ELSE 1
  END
WHERE scoring_version IS NULL AND status = 'completed';

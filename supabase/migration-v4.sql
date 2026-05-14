-- ============================================================
-- teachAI v4 Migration: Onboarding + Trial Rate Limiting
-- ============================================================
-- Run AFTER migration-v3.sql
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================================

-- ─── 1. オンボーディングセッション ───────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- A/B variant (cold review 致命傷B対応)
  variant         TEXT NOT NULL DEFAULT 'v1_full' CHECK (variant IN ('v1_full', 'v0_control')),

  current_step    TEXT NOT NULL DEFAULT 'welcome'
                    CHECK (current_step IN ('welcome', 'pick_topic', 'explain', 'reflection', 'settings', 'completed', 'abandoned')),

  topic               TEXT,
  explanation         TEXT,
  followup_question   TEXT,
  followup_answer     TEXT,

  -- 評価結果(rationale は説明可能性のため必須に近い)
  solo_score          NUMERIC(3,1),
  rqs_score           NUMERIC(4,2),
  rationale           JSONB,

  reminder_opt_in     TEXT CHECK (reminder_opt_in IS NULL OR reminder_opt_in IN ('yes', 'no', 'self')),

  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  abandoned_at    TIMESTAMPTZ,
  last_step_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_sessions_user ON public.onboarding_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_onb_sessions_variant ON public.onboarding_sessions(variant, current_step);

-- ─── 2. A/B variant 割当 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_onboarding_variant(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE v_hash INT;
BEGIN
  v_hash := abs(hashtext(p_user_id::text)) % 100;
  IF v_hash < 70 THEN RETURN 'v1_full';
  ELSE RETURN 'v0_control';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── 3. Trial Usage Log(無料利用回数制限) ────────────────
-- ユーザー答え:「オンボーディングや無料ユーザーは回数制限でキー提供、課金で解除」
CREATE TABLE IF NOT EXISTS public.trial_usage_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- セッションあり: ログインユーザー / なし: 匿名利用(将来用)
  endpoint     TEXT NOT NULL,        -- 'onboarding_followup' | 'onboarding_reflection' | 'session_eval' 等
  provider     TEXT,
  model        TEXT,
  input_tokens  INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_usage_user ON public.trial_usage_log(user_id, created_at DESC);

-- ─── 4. 利用枠チェック関数 ───────────────────────────────────
-- 月間の trial 呼び出し回数。デフォルト 50 回/月 を上限とする。
-- 課金ユーザー(将来 subscriptions.plan != 'free')はチェックをパスする実装は API 側で。
CREATE OR REPLACE FUNCTION public.trial_usage_count(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS INT AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.trial_usage_log
  WHERE user_id = p_user_id
    AND created_at > NOW() - (p_days || ' days')::interval;
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.trial_usage_count(UUID, INT) TO authenticated;

-- ─── 5. RLS ──────────────────────────────────────────────────
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_usage_log     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own onboarding"   ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Users insert own onboarding" ON public.onboarding_sessions;
DROP POLICY IF EXISTS "Users update own onboarding" ON public.onboarding_sessions;
CREATE POLICY "Users view own onboarding"   ON public.onboarding_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own onboarding" ON public.onboarding_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own onboarding" ON public.onboarding_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own trial usage" ON public.trial_usage_log;
CREATE POLICY "Users view own trial usage" ON public.trial_usage_log FOR SELECT USING (auth.uid() = user_id);
-- INSERT は service_role 経由のみ(API がサーバー側で書き込む)

-- ─── 6. updated_at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onb_set_updated_at ON public.onboarding_sessions;
CREATE TRIGGER onb_set_updated_at
  BEFORE UPDATE ON public.onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_onboarding_updated_at();

-- ─── 7. Funnel ビュー(KPI用) ────────────────────────────────
CREATE OR REPLACE VIEW public.onboarding_funnel AS
SELECT
  variant,
  DATE_TRUNC('day', started_at) AS day,
  COUNT(*) AS started,
  COUNT(*) FILTER (WHERE current_step IN ('explain','reflection','settings','completed','abandoned')) AS reached_explain,
  COUNT(*) FILTER (WHERE current_step IN ('reflection','settings','completed','abandoned')) AS reached_reflection,
  COUNT(*) FILTER (WHERE current_step = 'completed') AS completed,
  COUNT(*) FILTER (WHERE current_step = 'abandoned') AS abandoned
FROM public.onboarding_sessions
GROUP BY variant, DATE_TRUNC('day', started_at)
ORDER BY day DESC, variant;

GRANT SELECT ON public.onboarding_funnel TO authenticated;

-- ============================================================
-- ThinkGraph AI - Supabase Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USER PROFILES
-- Extends Supabase auth.users with app-specific fields
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin', 'tenant_admin')),
  tenant_id     UUID,                           -- Set for B2B users
  department    TEXT,
  preferred_language TEXT DEFAULT 'ja',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TENANTS (B2B 法人)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'poc'
                  CHECK (plan IN ('poc', 'standard', 'professional', 'enterprise')),
  status        TEXT NOT NULL DEFAULT 'trialing'
                  CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  max_users     INTEGER NOT NULL DEFAULT 50,
  billing_email TEXT,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  mrr_jpy       INTEGER DEFAULT 0,
  poc_start_date        DATE,
  poc_end_date          DATE,
  poc_contract_value_jpy INTEGER,
  subsidy_applied       BOOLEAN DEFAULT FALSE,
  industry      TEXT DEFAULT 'manufacturing',
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEARNING SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  topic         TEXT NOT NULL,
  mode          TEXT DEFAULT 'concept'
                  CHECK (mode IN ('whynot', 'vocabulary', 'concept', 'procedure')),
  persona_name  TEXT,
  status        TEXT NOT NULL DEFAULT 'completed'
                  CHECK (status IN ('active', 'completed', 'abandoned')),
  -- 5D Scores (0-100)
  score_knowledge_fidelity    FLOAT,
  score_structural_integrity  FLOAT,
  score_hypothesis_generation FLOAT,
  score_thinking_depth        FLOAT,
  score_total                 FLOAT,
  -- Session metadata
  message_count               INTEGER DEFAULT 0,
  duration_seconds            INTEGER,
  key_concepts                TEXT[],
  missing_concepts            TEXT[],
  unique_insights             TEXT[],
  ai_feedback                 TEXT,
  grade                       TEXT CHECK (grade IN ('S', 'A', 'B', 'C', 'D')),
  -- Raw conversation (stored as JSONB)
  messages                    JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON public.sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON public.sessions(created_at DESC);

-- ============================================================
-- KNOWLEDGE GRAPH NODES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  label         TEXT NOT NULL,
  node_type     TEXT DEFAULT 'concept'
                  CHECK (node_type IN ('concept', 'process', 'skill', 'equipment', 'problem', 'cause', 'solution', 'factor')),
  description   TEXT,
  confidence    FLOAT DEFAULT 1.0,
  mention_count INTEGER DEFAULT 1,
  depth         INTEGER DEFAULT 0,
  source_sessions UUID[],
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, label)
);

CREATE INDEX IF NOT EXISTS idx_nodes_user ON public.knowledge_nodes(user_id);

-- ============================================================
-- KNOWLEDGE GRAPH EDGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id     UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
  relationship  TEXT NOT NULL DEFAULT 'related_to',
  weight        FLOAT DEFAULT 1.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_id, target_id, relationship)
);

CREATE INDEX IF NOT EXISTS idx_edges_user ON public.knowledge_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON public.knowledge_edges(source_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can only see/edit their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Sessions: users can only see/insert their own sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Tenant admins can see all sessions in their tenant
CREATE POLICY "Tenant admins can view tenant sessions" ON public.sessions
  FOR SELECT USING (
    tenant_id IS NOT NULL AND
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('tenant_admin', 'admin')
    )
  );

-- Knowledge nodes: users see their own nodes
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own nodes" ON public.knowledge_nodes
  FOR ALL USING (auth.uid() = user_id);

-- Knowledge edges: users see their own edges
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own edges" ON public.knowledge_edges
  FOR ALL USING (auth.uid() = user_id);

-- Tenants: only admins can manage
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage tenants" ON public.tenants
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );
CREATE POLICY "Tenant admins can view own tenant" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Per-user learning statistics
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  s.user_id,
  COUNT(*) AS total_sessions,
  ROUND(AVG(s.score_total)::NUMERIC, 1) AS avg_score,
  SUM(s.duration_seconds) AS total_seconds,
  MAX(s.created_at) AS last_session_at,
  COUNT(DISTINCT s.topic) AS unique_topics
FROM public.sessions s
WHERE s.status = 'completed'
GROUP BY s.user_id;

-- ============================================================
-- UPDATED_AT triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_nodes_updated BEFORE UPDATE ON public.knowledge_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

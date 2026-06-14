-- ============================================================
-- Trump Posts & News Sources — extension du système de brief
-- ============================================================

-- Stockage dédié pour les posts Truth Social de Trump
-- (filtrés sur les sujets liés à Iran / guerre / pétrole)
CREATE TABLE public.trump_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  posted_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content TEXT NOT NULL,
  external_id TEXT UNIQUE,        -- guid du RSS item pour éviter les doublons
  is_iran_related BOOLEAN NOT NULL DEFAULT FALSE,
  raw_link TEXT
);

CREATE INDEX idx_trump_posts_posted_at ON public.trump_posts(posted_at DESC);
CREATE INDEX idx_trump_posts_is_iran ON public.trump_posts(is_iran_related) WHERE is_iran_related = TRUE;

ALTER TABLE public.trump_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.trump_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read trump posts" ON public.trump_posts
  FOR SELECT USING (public.is_admin(auth.uid()));

-- ============================================================
-- Étendre macro_snapshots : ajout d'une colonne pour les sources groupées
-- ============================================================
ALTER TABLE public.macro_snapshots
  ADD COLUMN IF NOT EXISTS news_by_source JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trump_posts_recent JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expert_mentions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.macro_snapshots.news_by_source IS
  'Headlines groupés par média: { "Reuters": [...], "Bloomberg": [...], ... }';
COMMENT ON COLUMN public.macro_snapshots.trump_posts_recent IS
  'Posts Truth Social Trump des dernières 24h (filtrés Iran)';

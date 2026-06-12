-- ============================================================================
-- BONZINI — SUGGESTION DE TAUX (Binance P2P) + BRIEF MACRO TELEGRAM + IA
-- 4 nouvelles tables. Colle dans Supabase → SQL Editor → Run.
-- 100% IDEMPOTENT : sûr à lancer même si des parties sont déjà appliquées.
--
-- ⚠️  CE QUE CE FICHIER NE CONTIENT PAS :
--   - Les 2 graphes "Coût d'achat USDT" et "Prix de vente USDT" du dashboard
--     Trésorerie. Ils ne demandent AUCUNE migration : ils lisent la table
--     `rate_snapshots` qui existe déjà en prod depuis l'edge function
--     `monitor-rates` (créée en mars 2026). Ils s'activent automatiquement
--     dès que le front est déployé, rien à faire côté SQL.
--   - Aucune migration de `main` (Treasury, Mola, Beneficiaries, etc.).
--     Ce fichier suppose que ta prod Supabase est déjà à jour avec `main`.
--
-- CE QUE CE FICHIER CRÉE :
--   1. rate_suggestions   — suggestions de taux Binance P2P
--                           (Edge: suggest-daily-rates)
--   2. macro_snapshots    — collecte macro pétrole/forex/crypto/news
--                           (Edge: fetch-macro)
--      briefs_log         — log des briefs Telegram envoyés
--                           (Edge: send-brief)
--   3. trump_posts        — posts Truth Social Trump (audit + dedupe)
--      + colonnes news_by_source, trump_posts_recent, expert_mentions
--        ajoutées à macro_snapshots
--   4. rate_predictions   — prédictions IA Claude à 24h
--
-- Pré-requis : table daily_rates (existe), fonction public.is_admin(uuid)
-- (existe), extension pgcrypto pour gen_random_uuid (active sur Supabase).
-- ============================================================================

-- ═══════════════════ [1/4] 20260513000000_rate_suggestions.sql ════════════════
-- Table rate_suggestions + RPC mark_suggestion_applied.
-- Source : Edge Function suggest-daily-rates qui interroge Binance P2P toutes les
-- ~15 min et propose un taux client (réplique exacte de la méthode Nelson v2).

CREATE TABLE IF NOT EXISTS public.rate_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Inputs replicating Nelson's method
  cmr_rate_max NUMERIC NOT NULL,         -- max XAF/USDT among filtered top sellers
  cmr_margin_xaf NUMERIC NOT NULL,       -- fixed +3 XAF margin
  cmr_orders JSONB NOT NULL,             -- audit trail of merchants used

  chn_rate_avg NUMERIC NOT NULL,         -- simple average CNY/USDT among filtered top buyers
  chn_orders JSONB NOT NULL,             -- audit trail of merchants used

  -- Output
  suggested_rate INTEGER NOT NULL,       -- CNY per 1M XAF, rounded to nearest 10
  method TEXT NOT NULL DEFAULT 'nelson_v1',

  -- Application tracking
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  applied_rate_id UUID REFERENCES public.daily_rates(id) ON DELETE SET NULL,
  applied_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_rate_suggestions_computed_at
  ON public.rate_suggestions(computed_at DESC);

ALTER TABLE public.rate_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.rate_suggestions;
CREATE POLICY "Service role full access" ON public.rate_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read suggestions" ON public.rate_suggestions;
CREATE POLICY "Admins can read suggestions" ON public.rate_suggestions
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can mark suggestions applied" ON public.rate_suggestions;
CREATE POLICY "Admins can mark suggestions applied" ON public.rate_suggestions
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RPC: appelée depuis la UI quand le taux est publié, pour lier la suggestion
-- à la ligne daily_rates correspondante (et l'exclure des "à appliquer").
CREATE OR REPLACE FUNCTION public.mark_suggestion_applied(
  p_suggestion_id UUID,
  p_rate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  UPDATE public.rate_suggestions
  SET applied = TRUE,
      applied_at = now(),
      applied_rate_id = p_rate_id,
      applied_by = v_admin_id
  WHERE id = p_suggestion_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ═══════════════════ [2/4] 20260607000000_macro_snapshots.sql ═════════════════
-- Tables macro_snapshots (pétrole, forex, crypto, news) et briefs_log.
-- Sources :
--   - Edge fetch-macro    : appelle Yahoo Finance + Frankfurter + Google News
--     toutes les ~15 min, insère 1 ligne
--   - Edge send-brief     : compose un brief Telegram (matin/soir/alerte) et
--     l'envoie, log dans briefs_log

CREATE TABLE IF NOT EXISTS public.macro_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  oil_brent NUMERIC,
  oil_wti NUMERIC,
  dxy NUMERIC,
  eur_usd NUMERIC,
  cny_usd NUMERIC,
  xaf_per_eur NUMERIC DEFAULT 655.957,
  btc_usd NUMERIC,
  eth_usd NUMERIC,

  news_headlines JSONB,
  errors JSONB
);

CREATE INDEX IF NOT EXISTS idx_macro_snapshots_captured_at
  ON public.macro_snapshots(captured_at DESC);

ALTER TABLE public.macro_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.macro_snapshots;
CREATE POLICY "Service role full access" ON public.macro_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read snapshots" ON public.macro_snapshots;
CREATE POLICY "Admins can read snapshots" ON public.macro_snapshots
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.briefs_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  brief_type TEXT NOT NULL CHECK (brief_type IN ('morning', 'evening', 'alert')),
  payload JSONB NOT NULL,
  message_text TEXT NOT NULL,
  telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_briefs_log_sent_at
  ON public.briefs_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefs_log_brief_type
  ON public.briefs_log(brief_type);

ALTER TABLE public.briefs_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.briefs_log;
CREATE POLICY "Service role full access" ON public.briefs_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read briefs" ON public.briefs_log;
CREATE POLICY "Admins can read briefs" ON public.briefs_log
  FOR SELECT USING (public.is_admin(auth.uid()));


-- ═══════════════════ [3/4] 20260607010000_trump_posts_and_news_sources.sql ════
-- Table trump_posts (audit Truth Social) + colonnes étendues sur macro_snapshots
-- (news groupées par source, posts Trump récents, mentions experts).

CREATE TABLE IF NOT EXISTS public.trump_posts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  posted_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content TEXT NOT NULL,
  external_id TEXT UNIQUE,
  is_iran_related BOOLEAN NOT NULL DEFAULT FALSE,
  raw_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_trump_posts_posted_at
  ON public.trump_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trump_posts_is_iran
  ON public.trump_posts(is_iran_related) WHERE is_iran_related = TRUE;

ALTER TABLE public.trump_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.trump_posts;
CREATE POLICY "Service role full access" ON public.trump_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read trump posts" ON public.trump_posts;
CREATE POLICY "Admins can read trump posts" ON public.trump_posts
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Étend macro_snapshots avec 3 colonnes JSONB (news par source, posts Trump
-- des dernières 24h, mentions experts). Les valeurs par défaut sont des objets
-- vides pour ne rien casser dans le code existant.
ALTER TABLE public.macro_snapshots
  ADD COLUMN IF NOT EXISTS news_by_source JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trump_posts_recent JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expert_mentions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.macro_snapshots.news_by_source IS
  'Headlines groupes par media: { "Reuters": [...], "Bloomberg": [...], ... }';
COMMENT ON COLUMN public.macro_snapshots.trump_posts_recent IS
  'Posts Truth Social Trump des dernieres 24h (filtres Iran)';


-- ═══════════════════ [4/4] 20260607020000_rate_predictions.sql ════════════════
-- Table rate_predictions — prédictions IA Claude à horizon 24h, avec scénarios
-- bullish/base/bearish + tracking a posteriori (error_abs).

CREATE TABLE IF NOT EXISTS public.rate_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  based_on_rate_id UUID REFERENCES public.rate_suggestions(id) ON DELETE SET NULL,
  current_rate INTEGER NOT NULL,
  predicted_rate INTEGER NOT NULL,
  direction TEXT CHECK (direction IN ('up', 'down', 'flat')),
  confidence NUMERIC,

  key_drivers JSONB,
  reasoning TEXT,
  scenarios JSONB,                       -- {bullish, base, bearish}
  action_recommended TEXT,

  -- Verification a posteriori (a remplir 24h apres)
  actual_rate INTEGER,
  error_abs INTEGER GENERATED ALWAYS AS (ABS(COALESCE(actual_rate, 0) - predicted_rate)) STORED,
  was_correct_direction BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_rate_predictions_created_at
  ON public.rate_predictions(created_at DESC);

ALTER TABLE public.rate_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.rate_predictions;
CREATE POLICY "Service role full access" ON public.rate_predictions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read predictions" ON public.rate_predictions;
CREATE POLICY "Admins can read predictions" ON public.rate_predictions
  FOR SELECT USING (public.is_admin(auth.uid()));


-- ═══════════════════ FIN ═══════════════════
-- À faire ensuite :
--   1. Déployer les 4 Edge Functions :
--        npx supabase functions deploy suggest-daily-rates
--        npx supabase functions deploy fetch-macro
--        npx supabase functions deploy send-brief
--        npx supabase functions deploy predict-rate
--   2. Configurer la clé Anthropic (Claude API) :
--        npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
--      (TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID sont déjà en place via monitor-rates.)
--   3. Programmer les jobs pg_cron (Supabase Dashboard → SQL Editor) :
--      - fetch-macro toutes les 15 min
--      - send-brief type=morning à 05:00 UTC (06:00 Douala)
--      - send-brief type=evening à 17:00 UTC (18:00 Douala)
--      - predict-rate à 06:00 UTC (07:00 Douala)

-- ============================================================
-- Macro Snapshots — context macro pour les briefs Telegram
-- Stocke prix pétrole, dollar index, EUR/USD, BTC, CNY/USD
-- + headlines news (jsonb)
-- ============================================================

CREATE TABLE public.macro_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Pétrole (USD/baril)
  oil_brent NUMERIC,
  oil_wti NUMERIC,

  -- Forex
  dxy NUMERIC,                    -- Dollar Index
  eur_usd NUMERIC,                -- 1 EUR = X USD
  cny_usd NUMERIC,                -- 1 USD = X CNY (USDCNY)
  xaf_per_eur NUMERIC DEFAULT 655.957,  -- fixe (peg)

  -- Crypto
  btc_usd NUMERIC,
  eth_usd NUMERIC,

  -- News headlines (top 3-5 articles)
  news_headlines JSONB,

  -- Source fetch metadata
  errors JSONB                    -- log des erreurs partielles si certaines APIs échouent
);

CREATE INDEX idx_macro_snapshots_captured_at ON public.macro_snapshots(captured_at DESC);

ALTER TABLE public.macro_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.macro_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read snapshots" ON public.macro_snapshots
  FOR SELECT USING (public.is_admin(auth.uid()));

-- ============================================================
-- Table briefs_log — historique des briefs envoyés à Telegram
-- ============================================================
CREATE TABLE public.briefs_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  brief_type TEXT NOT NULL CHECK (brief_type IN ('morning', 'evening', 'alert')),
  payload JSONB NOT NULL,         -- snapshot des données envoyées
  message_text TEXT NOT NULL,     -- texte brut envoyé
  telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_error TEXT
);

CREATE INDEX idx_briefs_log_sent_at ON public.briefs_log(sent_at DESC);
CREATE INDEX idx_briefs_log_brief_type ON public.briefs_log(brief_type);

ALTER TABLE public.briefs_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.briefs_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read briefs" ON public.briefs_log
  FOR SELECT USING (public.is_admin(auth.uid()));

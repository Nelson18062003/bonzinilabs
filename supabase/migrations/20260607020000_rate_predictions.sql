-- ============================================================
-- Rate Predictions — prédictions IA du taux Bonzini à 24h
-- ============================================================

CREATE TABLE public.rate_predictions (
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

  -- Vérification a posteriori (à remplir 24h après)
  actual_rate INTEGER,
  error_abs INTEGER GENERATED ALWAYS AS (ABS(COALESCE(actual_rate, 0) - predicted_rate)) STORED,
  was_correct_direction BOOLEAN
);

CREATE INDEX idx_rate_predictions_created_at ON public.rate_predictions(created_at DESC);

ALTER TABLE public.rate_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.rate_predictions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read predictions" ON public.rate_predictions
  FOR SELECT USING (public.is_admin(auth.uid()));

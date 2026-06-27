-- ============================================================
-- Rate Suggestions — Automated daily rate proposals
-- Replicates Nelson's manual Binance P2P method:
--   CMR: max price of top 15 XAF SELL ads (MTN/Orange) + 3 XAF
--   CHN: simple average of top 100-200 CNY BUY ads (Alipay/WeChat)
--   base_rate = round(1_000_000 / (cmr_rate / chn_rate) / 10) * 10
-- The admin reviews and applies via 1-click pre-fill in RateSetTab.
-- ============================================================

CREATE TABLE public.rate_suggestions (
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

CREATE INDEX idx_rate_suggestions_computed_at ON public.rate_suggestions(computed_at DESC);

ALTER TABLE public.rate_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.rate_suggestions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read suggestions" ON public.rate_suggestions
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can mark suggestions applied" ON public.rate_suggestions
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- RPC: Mark a suggestion as applied after publishing rates
-- Called from the UI right after create_daily_rates succeeds
-- ============================================================
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

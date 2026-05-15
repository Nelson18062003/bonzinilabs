-- ============================================================
-- Treasury Lot 0 — Fix daily_rates precision
--
-- daily_rates.rate_* are currently INTEGER, which prevents
-- entering fractional rates. Rates are expressed as "CNY per
-- 1 000 000 XAF" and typically sit around 11 000, so the
-- integer-step granularity translates to ~9 000 XAF on a
-- 100M XAF deal — not negligible.
--
-- This migration:
--   1. Widens the 4 rate columns to NUMERIC(10,4).
--   2. Recreates create_daily_rates() with NUMERIC params.
--   3. Recreates calculate_final_rate() with a NUMERIC local
--      v_base_rate so decimals aren't silently truncated.
--
-- Non-destructive: existing INTEGER values cast cleanly to
-- NUMERIC. No application data is lost.
-- ============================================================

-- ── 1. Widen column types ──
ALTER TABLE public.daily_rates
  ALTER COLUMN rate_cash     TYPE NUMERIC(10, 4) USING rate_cash::numeric,
  ALTER COLUMN rate_alipay   TYPE NUMERIC(10, 4) USING rate_alipay::numeric,
  ALTER COLUMN rate_wechat   TYPE NUMERIC(10, 4) USING rate_wechat::numeric,
  ALTER COLUMN rate_virement TYPE NUMERIC(10, 4) USING rate_virement::numeric;

-- ── 2. Recreate create_daily_rates with NUMERIC params ──
-- DROP first because the parameter types are part of the signature.
DROP FUNCTION IF EXISTS public.create_daily_rates(integer, integer, integer, integer, timestamptz);

CREATE OR REPLACE FUNCTION public.create_daily_rates(
  p_rate_cash NUMERIC,
  p_rate_alipay NUMERIC,
  p_rate_wechat NUMERIC,
  p_rate_virement NUMERIC,
  p_effective_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  IF p_rate_cash <= 0 OR p_rate_alipay <= 0 OR p_rate_wechat <= 0 OR p_rate_virement <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les taux doivent etre strictement positifs');
  END IF;

  UPDATE public.daily_rates SET is_active = FALSE WHERE is_active = TRUE;

  INSERT INTO public.daily_rates (rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at, created_by)
  VALUES (p_rate_cash, p_rate_alipay, p_rate_wechat, p_rate_virement, p_effective_at, v_admin_id)
  RETURNING id INTO v_rate_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'create_daily_rates', 'daily_rates', v_rate_id,
    jsonb_build_object(
      'cash', p_rate_cash,
      'alipay', p_rate_alipay,
      'wechat', p_rate_wechat,
      'virement', p_rate_virement
    )
  );

  RETURN jsonb_build_object('success', true, 'rate_id', v_rate_id);
END;
$$;

-- ── 3. Recreate calculate_final_rate with NUMERIC v_base_rate ──
-- The original v_base_rate was INTEGER and would silently truncate
-- fractional rates fetched from the now-NUMERIC columns.
CREATE OR REPLACE FUNCTION public.calculate_final_rate(
  p_payment_method TEXT,
  p_country_key TEXT,
  p_amount_xaf BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rates RECORD;
  v_country_adj RECORD;
  v_tier_adj RECORD;
  v_tier_key TEXT;
  v_base_rate NUMERIC;
  v_c DECIMAL;
  v_t DECIMAL;
  v_final_rate DECIMAL;
  v_amount_cny DECIMAL;
BEGIN
  IF p_amount_xaf < 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant minimum 10 000 XAF');
  END IF;

  SELECT * INTO v_rates FROM public.daily_rates WHERE is_active = TRUE LIMIT 1;

  IF v_rates IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun taux actif');
  END IF;

  v_base_rate := CASE p_payment_method
    WHEN 'cash' THEN v_rates.rate_cash
    WHEN 'alipay' THEN v_rates.rate_alipay
    WHEN 'wechat' THEN v_rates.rate_wechat
    WHEN 'virement' THEN v_rates.rate_virement
    ELSE NULL
  END;

  IF v_base_rate IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode de paiement invalide');
  END IF;

  SELECT * INTO v_country_adj FROM public.rate_adjustments
  WHERE type = 'country' AND key = p_country_key;

  IF v_country_adj IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pays invalide');
  END IF;

  v_c := v_country_adj.percentage / 100.0;

  IF p_amount_xaf >= 1000000 THEN
    v_tier_key := 't3';
  ELSIF p_amount_xaf >= 400000 THEN
    v_tier_key := 't2';
  ELSE
    v_tier_key := 't1';
  END IF;

  SELECT * INTO v_tier_adj FROM public.rate_adjustments
  WHERE type = 'tier' AND key = v_tier_key;

  v_t := v_tier_adj.percentage / 100.0;

  v_final_rate := v_base_rate * (1 + v_c) * (1 + v_t);
  v_amount_cny := p_amount_xaf * (v_final_rate / 1000000.0);

  RETURN jsonb_build_object(
    'success', true,
    'base_rate', v_base_rate,
    'country_adjustment', v_country_adj.percentage,
    'tier_adjustment', v_tier_adj.percentage,
    'tier', v_tier_key,
    'final_rate', ROUND(v_final_rate::numeric, 4),
    'amount_xaf', p_amount_xaf,
    'amount_cny', ROUND(v_amount_cny::numeric, 2),
    'rate_id', v_rates.id
  );
END;
$$;

COMMENT ON COLUMN public.daily_rates.rate_cash IS 'CNY per 1 000 000 XAF, cash channel — NUMERIC(10,4) since 20260515';
COMMENT ON COLUMN public.daily_rates.rate_alipay IS 'CNY per 1 000 000 XAF, alipay channel — NUMERIC(10,4) since 20260515';
COMMENT ON COLUMN public.daily_rates.rate_wechat IS 'CNY per 1 000 000 XAF, wechat channel — NUMERIC(10,4) since 20260515';
COMMENT ON COLUMN public.daily_rates.rate_virement IS 'CNY per 1 000 000 XAF, bank transfer channel — NUMERIC(10,4) since 20260515';

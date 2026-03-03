-- ============================================================
-- Daily Rates System — Multi-level exchange rate management
-- Replaces the single-rate exchange_rates system
-- ============================================================

-- Table daily_rates: 4 base rates per payment method (CNY per 1M XAF)
CREATE TABLE public.daily_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_cash INTEGER NOT NULL,
  rate_alipay INTEGER NOT NULL,
  rate_wechat INTEGER NOT NULL,
  rate_virement INTEGER NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Table rate_adjustments: country and tier percentage adjustments
CREATE TABLE public.rate_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('country', 'tier')),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_reference BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed data: countries (Cameroun = reference at 0%)
INSERT INTO public.rate_adjustments (type, key, label, percentage, is_reference, sort_order) VALUES
('country', 'cameroun', 'Cameroun', 0.00, TRUE, 1),
('country', 'gabon', 'Gabon', -1.50, FALSE, 2),
('country', 'tchad', 'Tchad', -1.50, FALSE, 3),
('country', 'rca', 'Centrafrique', -1.50, FALSE, 4),
('country', 'congo', 'Congo', -1.50, FALSE, 5),
('country', 'guinee', 'Guinee Equatoriale', -1.50, FALSE, 6);

-- Seed data: tiers (t3 >= 1M = reference at 0%)
INSERT INTO public.rate_adjustments (type, key, label, percentage, is_reference, sort_order) VALUES
('tier', 't3', '>= 1 000 000 XAF', 0.00, TRUE, 1),
('tier', 't2', '400 000 - 999 999 XAF', -1.00, FALSE, 2),
('tier', 't1', '10 000 - 399 999 XAF', -2.00, FALSE, 3);

-- RLS
ALTER TABLE public.daily_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily_rates" ON public.daily_rates FOR SELECT USING (true);
CREATE POLICY "Admins can manage daily_rates" ON public.daily_rates FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view rate_adjustments" ON public.rate_adjustments FOR SELECT USING (true);
CREATE POLICY "Admins can manage rate_adjustments" ON public.rate_adjustments FOR ALL USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_daily_rates_active ON public.daily_rates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_daily_rates_effective_at ON public.daily_rates(effective_at DESC);
CREATE INDEX idx_rate_adjustments_type ON public.rate_adjustments(type, sort_order);

-- ============================================================
-- RPC: Create a new set of daily rates (deactivates previous)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_daily_rates(
  p_rate_cash INTEGER,
  p_rate_alipay INTEGER,
  p_rate_wechat INTEGER,
  p_rate_virement INTEGER,
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

  -- Deactivate all currently active rates
  UPDATE public.daily_rates SET is_active = FALSE WHERE is_active = TRUE;

  -- Insert new rate set
  INSERT INTO public.daily_rates (rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at, created_by)
  VALUES (p_rate_cash, p_rate_alipay, p_rate_wechat, p_rate_virement, p_effective_at, v_admin_id)
  RETURNING id INTO v_rate_id;

  -- Audit log
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

-- ============================================================
-- RPC: Update a rate adjustment percentage
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_rate_adjustment(
  p_adjustment_id UUID,
  p_percentage DECIMAL(5,2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_adj RECORD;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  SELECT * INTO v_adj FROM public.rate_adjustments WHERE id = p_adjustment_id;

  IF v_adj IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ajustement non trouve');
  END IF;

  IF v_adj.is_reference THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier la reference');
  END IF;

  UPDATE public.rate_adjustments
  SET percentage = p_percentage, updated_at = now(), updated_by = v_admin_id
  WHERE id = p_adjustment_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'update_rate_adjustment', 'rate_adjustment', p_adjustment_id,
    jsonb_build_object('key', v_adj.key, 'old_percentage', v_adj.percentage, 'new_percentage', p_percentage)
  );

  RETURN jsonb_build_object('success', true, 'key', v_adj.key, 'percentage', p_percentage);
END;
$$;

-- ============================================================
-- RPC: Calculate final rate with all adjustments
-- Formula: T_final = T_mode * (1 + c) * (1 + t_n)
-- Amount_CNY = Amount_XAF * (T_final / 1_000_000)
-- ============================================================
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
  v_base_rate INTEGER;
  v_c DECIMAL;
  v_t DECIMAL;
  v_final_rate DECIMAL;
  v_amount_cny DECIMAL;
BEGIN
  -- Validate minimum amount
  IF p_amount_xaf < 10000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant minimum 10 000 XAF');
  END IF;

  -- Get active rate set
  SELECT * INTO v_rates FROM public.daily_rates WHERE is_active = TRUE LIMIT 1;

  IF v_rates IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun taux actif');
  END IF;

  -- Base rate by payment method
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

  -- Country adjustment
  SELECT * INTO v_country_adj FROM public.rate_adjustments
  WHERE type = 'country' AND key = p_country_key;

  IF v_country_adj IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pays invalide');
  END IF;

  v_c := v_country_adj.percentage / 100.0;

  -- Tier adjustment
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

  -- Calculate final rate and CNY amount
  v_final_rate := v_base_rate * (1 + v_c) * (1 + v_t);
  v_amount_cny := p_amount_xaf * (v_final_rate / 1000000.0);

  RETURN jsonb_build_object(
    'success', true,
    'base_rate', v_base_rate,
    'country_adjustment', v_country_adj.percentage,
    'tier_adjustment', v_tier_adj.percentage,
    'tier', v_tier_key,
    'final_rate', ROUND(v_final_rate::numeric, 2),
    'amount_xaf', p_amount_xaf,
    'amount_cny', ROUND(v_amount_cny::numeric, 2),
    'rate_id', v_rates.id
  );
END;
$$;

-- ============================================================
-- Remove the 10 000 XAF minimum on payments.
--
-- Product decision (Aug 2026): a payment can be any positive
-- amount (still capped at 50 M XAF by the frontends and still
-- limited by the wallet balance / SELECT FOR UPDATE guard).
--
-- Redefines, body byte-identical except the dropped minimum:
--   * create_payment          (last defined in 20260304300000)
--   * create_admin_payment    (last defined in 20260304300000)
--   * calculate_final_rate    (last defined in 20260515000001)
--     — amounts below 10 000 XAF now simply fall into tier t1.
-- Signatures are unchanged, so CREATE OR REPLACE is safe and the
-- existing @mola function comments are preserved.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_payment(
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL,
  p_cash_beneficiary_type TEXT DEFAULT NULL,
  p_cash_beneficiary_first_name TEXT DEFAULT NULL,
  p_cash_beneficiary_last_name TEXT DEFAULT NULL,
  p_cash_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_id UUID DEFAULT NULL,
  p_beneficiary_details JSONB DEFAULT NULL,
  p_rate_is_custom BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  -- Get wallet WITH pessimistic lock to prevent race conditions
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;

  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  v_reference := generate_payment_reference();

  -- Determine initial status based on beneficiary info
  v_has_beneficiary_info := (
    p_beneficiary_id IS NOT NULL OR
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );

  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;

  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    cash_beneficiary_type, cash_beneficiary_first_name, cash_beneficiary_last_name, cash_beneficiary_phone,
    balance_before, balance_after,
    beneficiary_id, beneficiary_details, rate_is_custom
  ) VALUES (
    v_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    p_cash_beneficiary_type, p_cash_beneficiary_first_name, p_cash_beneficiary_last_name, p_cash_beneficiary_phone,
    v_wallet.balance_xaf, v_new_balance,
    p_beneficiary_id, p_beneficiary_details, p_rate_is_custom
  ) RETURNING id INTO v_payment_id;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Create ledger entry
  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_wallet.id, v_user_id, 'PAYMENT_RESERVED', p_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'payment', v_payment_id,
    'Paiement ' || v_reference,
    jsonb_build_object(
      'method', p_method::text,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate
    )
  );

  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_payment_id, 'created', 'Paiement créé - Montant réservé', v_user_id);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_user_id);
  END IF;

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_user_id,
    'payment_created',
    'Paiement créé',
    format('Votre paiement %s de %s XAF (%s RMB) a été créé. Nouveau solde: %s XAF',
      v_reference,
      to_char(p_amount_xaf, 'FM999G999G999'),
      to_char(p_amount_rmb, 'FM999G999G990D00'),
      to_char(v_new_balance, 'FM999G999G999')),
    jsonb_build_object(
      'payment_id', v_payment_id,
      'reference', v_reference,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_payment(
  p_user_id UUID,
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL,
  p_client_visible_comment TEXT DEFAULT NULL,
  p_desired_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_beneficiary_id UUID DEFAULT NULL,
  p_beneficiary_details JSONB DEFAULT NULL,
  p_rate_is_custom BOOLEAN DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;

  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde client insuffisant');
  END IF;

  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  v_reference := generate_payment_reference();

  v_has_beneficiary_info := (
    p_beneficiary_id IS NOT NULL OR
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );

  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;

  v_created_at := COALESCE(p_desired_date, now());

  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after, client_visible_comment, created_at,
    beneficiary_id, beneficiary_details, rate_is_custom
  ) VALUES (
    p_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance, p_client_visible_comment, v_created_at,
    p_beneficiary_id, p_beneficiary_details, p_rate_is_custom
  ) RETURNING id INTO v_payment_id;

  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, created_by_admin_id,
    metadata, created_at
  ) VALUES (
    v_wallet.id, p_user_id, 'PAYMENT_RESERVED', p_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'payment', v_payment_id,
    'Paiement ' || v_reference,
    v_admin_id,
    jsonb_build_object(
      'method', p_method::text,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'admin_created', true,
      'rate_is_custom', p_rate_is_custom
    ),
    v_created_at
  );

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
  VALUES (v_payment_id, 'created', 'Paiement créé par l''équipe Bonzini - Montant réservé', v_admin_id, v_created_at);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id, v_created_at);
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_for_client', 'payment', v_payment_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'method', p_method,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance,
      'rate_is_custom', p_rate_is_custom,
      'beneficiary_id', p_beneficiary_id
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    'payment_created',
    'Nouveau paiement',
    format('Un paiement de %s XAF (%s RMB) a été créé pour vous. Référence: %s',
      to_char(p_amount_xaf, 'FM999G999G999'),
      to_char(p_amount_rmb, 'FM999G999G990D00'),
      v_reference),
    jsonb_build_object(
      'payment_id', v_payment_id,
      'reference', v_reference,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$$;

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
  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
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

NOTIFY pgrst, 'reload schema';

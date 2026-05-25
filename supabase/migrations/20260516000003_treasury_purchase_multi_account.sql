-- ============================================================
-- Treasury Lot 10 — Multi-account USDT purchases
--
-- A purchase can now be paid from several XAF accounts at once
-- (e.g. 20M XAF split across MTN 5M + Orange 3M + Afriland 12M).
--
-- Changes:
--   1. usdt_purchases.channel becomes nullable (field removed
--      from the UI — it was deemed useless).
--   2. usdt_purchases.xaf_account_id becomes nullable: kept for
--      single-account purchases, NULL for multi-account (the
--      breakdown lives in the ledger debit lines).
--   3. record_usdt_purchase rewritten to accept a JSON array of
--      {account_id, xaf_amount} splits. The total xaf_amount is
--      the sum of the splits. One XAF debit ledger entry is
--      posted per split; one USDT credit for the whole amount.
-- ============================================================

ALTER TABLE public.usdt_purchases ALTER COLUMN channel        DROP NOT NULL;
ALTER TABLE public.usdt_purchases ALTER COLUMN xaf_account_id DROP NOT NULL;

-- Drop the old single-account signature.
DROP FUNCTION IF EXISTS public.record_usdt_purchase(uuid, uuid, numeric, numeric, public.treasury_channel_xaf, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.record_usdt_purchase(
  p_supplier_id   UUID,
  p_usdt_amount   NUMERIC,
  p_account_splits JSONB,     -- [{"account_id": "...", "xaf_amount": 5000000}, ...]
  p_occurred_at   TIMESTAMPTZ DEFAULT now(),
  p_external_ref  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_supplier       public.treasury_counterparties%ROWTYPE;
  v_usdt_pool      public.treasury_accounts%ROWTYPE;
  v_purchase_id    UUID;
  v_new_wac        NUMERIC;
  v_total_xaf      NUMERIC := 0;
  v_split_count    INTEGER := 0;
  v_single_account UUID := NULL;
  v_split          JSONB;
  v_account_id     UUID;
  v_split_amount   NUMERIC;
  v_account        public.treasury_accounts%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_usdt_amount IS NULL OR p_usdt_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant USDT doit etre strictement positif');
  END IF;

  IF p_account_splits IS NULL OR jsonb_typeof(p_account_splits) <> 'array'
     OR jsonb_array_length(p_account_splits) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Au moins un compte XAF est requis');
  END IF;

  -- Pass 1: validate each split, compute total.
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_account_splits)
  LOOP
    v_account_id := (v_split->>'account_id')::uuid;
    v_split_amount := (v_split->>'xaf_amount')::numeric;

    IF v_account_id IS NULL OR v_split_amount IS NULL OR v_split_amount <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chaque ligne doit avoir un compte et un montant > 0');
    END IF;

    SELECT * INTO v_account FROM public.treasury_accounts WHERE id = v_account_id;
    IF v_account.id IS NULL OR v_account.currency <> 'XAF' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Compte XAF invalide dans la repartition');
    END IF;

    v_total_xaf := v_total_xaf + v_split_amount;
    v_split_count := v_split_count + 1;
    v_single_account := v_account_id;  -- meaningful only if count = 1
  END LOOP;

  SELECT * INTO v_supplier FROM public.treasury_counterparties WHERE id = p_supplier_id;
  IF v_supplier.id IS NULL OR v_supplier.type <> 'usdt_supplier' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fournisseur USDT invalide');
  END IF;

  SELECT * INTO v_usdt_pool FROM public.treasury_accounts WHERE code = 'usdt_pool';
  IF v_usdt_pool.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pool USDT introuvable');
  END IF;

  INSERT INTO public.usdt_purchases (
    occurred_at, supplier_id, xaf_account_id, xaf_amount, usdt_amount,
    channel, external_ref, notes, created_by
  ) VALUES (
    p_occurred_at, p_supplier_id,
    CASE WHEN v_split_count = 1 THEN v_single_account ELSE NULL END,
    v_total_xaf, p_usdt_amount,
    NULL, NULLIF(trim(p_external_ref), ''), NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_purchase_id;

  -- Pass 2: one XAF debit ledger entry per split.
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_account_splits)
  LOOP
    v_account_id := (v_split->>'account_id')::uuid;
    v_split_amount := (v_split->>'xaf_amount')::numeric;

    INSERT INTO public.treasury_ledger_entries (
      account_id, currency, amount, occurred_at, entry_kind,
      source_table, source_id, metadata, created_by
    )
    VALUES (
      v_account_id, 'XAF', -v_split_amount, p_occurred_at, 'usdt_purchase_debit_xaf',
      'usdt_purchase', v_purchase_id,
      jsonb_build_object('supplier_id', p_supplier_id, 'split', v_split_count > 1),
      v_user_id
    );
  END LOOP;

  -- One USDT credit for the whole amount.
  INSERT INTO public.treasury_ledger_entries (
    account_id, currency, amount, occurred_at, entry_kind,
    source_table, source_id, metadata, created_by
  )
  VALUES (
    v_usdt_pool.id, 'USDT', p_usdt_amount, p_occurred_at, 'usdt_purchase_credit_usdt',
    'usdt_purchase', v_purchase_id,
    jsonb_build_object('supplier_id', p_supplier_id, 'xaf_amount', v_total_xaf,
                       'implicit_rate', v_total_xaf / p_usdt_amount),
    v_user_id
  );

  v_new_wac := public.get_wac_usdt(p_occurred_at);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'record_usdt_purchase', 'usdt_purchase', v_purchase_id,
    jsonb_build_object(
      'xaf_amount', v_total_xaf,
      'usdt_amount', p_usdt_amount,
      'implicit_rate', v_total_xaf / p_usdt_amount,
      'supplier_id', p_supplier_id,
      'account_count', v_split_count,
      'new_wac', v_new_wac
    ));

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'total_xaf', v_total_xaf,
    'account_count', v_split_count,
    'implicit_rate', ROUND(v_total_xaf / p_usdt_amount, 8),
    'new_wac', v_new_wac
  );
END;
$$;

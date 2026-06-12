-- ============================================================
-- Treasury Lot 6 — Manual account adjustment RPC
--
-- Lets a treasury user credit or debit any account directly,
-- without going through a purchase/sale. Use cases:
--   * Initial seeding of XAF bank balances when the module is
--     deployed
--   * Reconciliation when the bank statement differs from the
--     ledger
--   * Manual entries for non-tracked operations (fees, salaries,
--     internal transfers)
--
-- Posts a single signed entry into treasury_ledger_entries with
-- entry_kind = 'inventory_adjustment' (reuses the existing enum
-- value rather than minting a new one — the semantic is the
-- same: a delta justified by a reason) and source_table =
-- 'manual_adjustment'. The source_id is the entry's own id so
-- the row stays self-referential.
-- ============================================================

CREATE OR REPLACE FUNCTION public.adjust_treasury_account(
  p_account_id   UUID,
  p_delta_amount NUMERIC,
  p_reason       TEXT,
  p_occurred_at  TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_account public.treasury_accounts%ROWTYPE;
  v_entry_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_delta_amount IS NULL OR p_delta_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit etre different de zero');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif obligatoire (10 caracteres min)');
  END IF;

  SELECT * INTO v_account FROM public.treasury_accounts WHERE id = p_account_id;
  IF v_account.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte introuvable');
  END IF;

  -- Self-referential source_id: the entry references itself so the
  -- ledger row stays a first-class source-of-truth without forcing
  -- a dedicated parent table for manual adjustments.
  v_entry_id := gen_random_uuid();
  INSERT INTO public.treasury_ledger_entries (
    id, account_id, currency, amount, occurred_at, entry_kind,
    source_table, source_id, metadata, created_by
  ) VALUES (
    v_entry_id,
    p_account_id,
    v_account.currency,
    p_delta_amount,
    p_occurred_at,
    'inventory_adjustment',
    'manual_adjustment',
    v_entry_id,
    jsonb_build_object('reason', p_reason, 'direction', CASE WHEN p_delta_amount > 0 THEN 'credit' ELSE 'debit' END),
    v_user_id
  );

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'adjust_treasury_account', 'treasury_account', p_account_id,
    jsonb_build_object(
      'delta', p_delta_amount,
      'reason', p_reason,
      'account_code', v_account.code,
      'currency', v_account.currency
    ));

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'delta', p_delta_amount,
    'direction', CASE WHEN p_delta_amount > 0 THEN 'credit' ELSE 'debit' END
  );
END;
$$;

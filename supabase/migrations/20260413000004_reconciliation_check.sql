-- ============================================================
-- RPC de réconciliation wallet ↔ ledger
--
-- Vérifie que le solde du wallet correspond à la somme nette
-- des écritures comptables. Permet de détecter les divergences.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_wallet_reconciliation(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_sum    BIGINT;
  v_wallet_balance BIGINT;
  v_match         BOOLEAN;
BEGIN
  -- Seuls les admins peuvent appeler cette fonction
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Somme de tous les mouvements qui impactent le solde
  -- Crédits : DEPOSIT_VALIDATED, ADMIN_CREDIT, PAYMENT_CANCELLED_REFUNDED
  -- Débits : PAYMENT_RESERVED, ADMIN_DEBIT
  -- Sans impact (exclus) : DEPOSIT_REFUSED, PAYMENT_EXECUTED
  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type IN ('DEPOSIT_VALIDATED', 'ADMIN_CREDIT', 'PAYMENT_CANCELLED_REFUNDED')
        THEN amount_xaf
      WHEN entry_type IN ('PAYMENT_RESERVED', 'ADMIN_DEBIT')
        THEN -amount_xaf
      ELSE 0
    END
  ), 0)
  INTO v_ledger_sum
  FROM public.ledger_entries
  WHERE user_id = p_user_id;

  -- Solde actuel du wallet
  SELECT COALESCE(balance_xaf, 0)
  INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  -- Si pas de wallet trouvé, le solde est 0
  IF v_wallet_balance IS NULL THEN
    v_wallet_balance := 0;
  END IF;

  v_match := (v_ledger_sum = v_wallet_balance);

  RETURN jsonb_build_object(
    'success', true,
    'match', v_match,
    'ledger_sum', v_ledger_sum,
    'wallet_balance', v_wallet_balance,
    'difference', v_wallet_balance - v_ledger_sum
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

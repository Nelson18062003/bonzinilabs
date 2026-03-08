-- ============================================================
-- Fix: confirm_cash_payment() doit créer une entrée PAYMENT_EXECUTED
--
-- Contexte du bug :
--   - confirm_cash_payment() a été créée le 05/01/2026
--   - Le système ledger_entries a été introduit le 10/02/2026
--   - process_payment() a été mis à jour le 21/02/2026 pour écrire
--     les entrées PAYMENT_EXECUTED → mais confirm_cash_payment() n'a
--     PAS été mis à jour en même temps.
--   - Résultat : tous les paiements cash confirmés par l'agent cash
--     (QR scan + signature) ont un statut 'completed' dans la table
--     payments MAIS aucune entrée PAYMENT_EXECUTED dans ledger_entries.
--   - Impact : l'historique client affiche le paiement comme
--     "Paiement réservé" (jamais comme "Paiement exécuté"), le relevé
--     PDF ne le comptabilise pas, et la comptabilité est faussée.
-- ============================================================

-- ============================================================
-- 1. Corriger confirm_cash_payment() pour créer PAYMENT_EXECUTED
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_id uuid,
  p_signature_url text,
  p_signed_by_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_wallet  wallets%ROWTYPE;
BEGIN
  -- Get payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  -- Verify it's a cash payment
  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;

  -- Check if already paid
  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;

  -- Get wallet (needed for the ledger entry)
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_payment.user_id;

  -- Update payment to completed
  UPDATE payments
  SET
    status                   = 'completed',
    cash_signature_url       = p_signature_url,
    cash_signature_timestamp = now(),
    cash_signed_by_name      = p_signed_by_name,
    cash_paid_at             = now(),
    cash_paid_by             = auth.uid(),
    processed_at             = now(),
    processed_by             = auth.uid(),
    updated_at               = now()
  WHERE id = p_payment_id;

  -- Create PAYMENT_EXECUTED ledger entry (identique à process_payment('complete'))
  -- balance_before = balance_after = solde courant du wallet
  -- (le débit a déjà été effectué à la création du paiement via PAYMENT_RESERVED)
  IF v_wallet IS NOT NULL THEN
    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id, metadata
    ) VALUES (
      v_wallet.id,
      v_payment.user_id,
      'PAYMENT_EXECUTED',
      v_payment.amount_xaf,
      v_wallet.balance_xaf,
      v_wallet.balance_xaf,
      'payment',
      p_payment_id,
      format('Paiement exécuté - Réf: %s', v_payment.reference),
      auth.uid(),
      jsonb_build_object(
        'method',          'cash',
        'amount_rmb',      v_payment.amount_rmb,
        'cash_signed_by',  p_signed_by_name
      )
    );
  END IF;

  -- Add timeline event
  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_paid', 'Paiement cash effectué - Signature enregistrée', auth.uid());

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- 2. Backfill : créer les entrées PAYMENT_EXECUTED manquantes
--    pour les paiements cash déjà complétés
-- ============================================================
-- Pour chaque paiement cash complété sans entrée PAYMENT_EXECUTED,
-- on récupère le solde depuis l'entrée PAYMENT_RESERVED correspondante
-- (qui est le solde exact du wallet après la réservation du débit).
-- Fallback sur payments.balance_after si l'entrée RESERVED est absente.
-- ============================================================

DO $$
DECLARE
  v_payment RECORD;
  v_wallet  RECORD;
  v_balance BIGINT;
BEGIN
  FOR v_payment IN
    SELECT p.*
    FROM payments p
    WHERE p.method    = 'cash'
      AND p.status    = 'completed'
      AND p.processed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM ledger_entries le
        WHERE le.reference_id = p.id
          AND le.entry_type   = 'PAYMENT_EXECUTED'
      )
  LOOP
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_payment.user_id;

    IF v_wallet IS NOT NULL THEN
      -- Prefer the balance_after from the PAYMENT_RESERVED entry (exact snapshot)
      SELECT le.balance_after INTO v_balance
      FROM ledger_entries le
      WHERE le.reference_id = v_payment.id
        AND le.entry_type   = 'PAYMENT_RESERVED'
      LIMIT 1;

      -- Fallback: balance_after from the payments row (set at reservation time)
      IF v_balance IS NULL THEN
        v_balance := v_payment.balance_after;
      END IF;

      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description, created_by_admin_id, metadata, created_at
      ) VALUES (
        v_wallet.id,
        v_payment.user_id,
        'PAYMENT_EXECUTED',
        v_payment.amount_xaf,
        v_balance,
        v_balance,
        'payment',
        v_payment.id,
        format('Paiement exécuté - Réf: %s', v_payment.reference),
        v_payment.processed_by,
        jsonb_build_object(
          'method',     'cash',
          'amount_rmb', v_payment.amount_rmb,
          'backfilled', true
        ),
        COALESCE(v_payment.cash_paid_at, v_payment.processed_at)
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

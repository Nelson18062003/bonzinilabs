-- ============================================================
-- Remplacement des suppressions destructrices par des annulations
--
-- Problème : delete_deposit et delete_payment effaçaient les
-- ledger_entries et modifiaient directement le wallet, rendant
-- impossible toute réconciliation comptable.
--
-- Fix : Deux nouvelles RPCs (cancel_deposit, cancel_payment) qui
-- créent des écritures de reversal au lieu d'effacer l'historique.
-- Les anciennes RPCs delete_* restent en place temporairement.
-- ============================================================

-- 1. Ajouter le statut 'cancelled_by_admin' aux enums
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'cancelled_by_admin';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'cancelled_by_admin';

-- ============================================================
-- 2. cancel_deposit — annulation propre d'un dépôt
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_deposit(p_deposit_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id  UUID;
  v_deposit   RECORD;
  v_wallet    RECORD;
  v_is_super  BOOLEAN;
  v_new_balance BIGINT;
BEGIN
  v_admin_id := auth.uid();

  -- Vérifier que l'appelant est admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Vérifier que l'appelant est super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des dépôts');
  END IF;

  -- Récupérer et verrouiller le dépôt
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Vérifier que le dépôt n'est pas déjà annulé
  IF v_deposit.status IN ('cancelled', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est déjà annulé');
  END IF;

  -- Si le dépôt était validé, il faut reverser le crédit sur le wallet
  IF v_deposit.status = 'validated' THEN
    -- Verrouiller le wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;

    IF v_wallet IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
    END IF;

    -- Rejeter si solde insuffisant (le client a dépensé une partie du dépôt)
    IF v_wallet.balance_xaf < v_deposit.amount_xaf THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Solde insuffisant pour annuler ce dépôt. Solde actuel: ' || v_wallet.balance_xaf || ' XAF, montant à reverser: ' || v_deposit.amount_xaf || ' XAF');
    END IF;

    v_new_balance := v_wallet.balance_xaf - v_deposit.amount_xaf;

    -- Créer l'écriture de reversal dans le ledger
    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf,
      balance_before, balance_after,
      reference_type, reference_id,
      description, metadata, created_by_admin_id
    ) VALUES (
      v_wallet.id, v_deposit.user_id, 'ADMIN_DEBIT', v_deposit.amount_xaf,
      v_wallet.balance_xaf, v_new_balance,
      'deposit', p_deposit_id,
      'Annulation dépôt - Réf: ' || COALESCE(v_deposit.reference, p_deposit_id::text),
      jsonb_build_object(
        'reason', 'cancelled_by_admin',
        'original_status', v_deposit.status,
        'method', v_deposit.method
      ),
      v_admin_id
    );

    -- Mettre à jour le wallet
    UPDATE public.wallets
    SET balance_xaf = v_new_balance, updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  -- Passer le statut à cancelled_by_admin (ne supprime rien)
  UPDATE public.deposits
  SET status = 'cancelled_by_admin', updated_at = now()
  WHERE id = p_deposit_id;

  -- Événement timeline
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'cancelled_by_admin', 'Dépôt annulé par le super admin');

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'cancel_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'reference',          v_deposit.reference,
      'amount_xaf',         v_deposit.amount_xaf,
      'user_id',            v_deposit.user_id,
      'status_at_cancel',   v_deposit.status,
      'was_validated',      (v_deposit.status = 'validated'),
      'wallet_reversed',    (v_deposit.status = 'validated')
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. cancel_payment — annulation propre d'un paiement
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id    UUID;
  v_payment     RECORD;
  v_wallet      RECORD;
  v_is_super    BOOLEAN;
  v_new_balance BIGINT;
BEGIN
  v_admin_id := auth.uid();

  -- Vérifier que l'appelant est admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Vérifier que l'appelant est super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des paiements');
  END IF;

  -- Récupérer et verrouiller le paiement
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Vérifier que le paiement n'est pas dans un état terminal
  IF v_payment.status IN ('rejected', 'completed', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''annuler un paiement en statut "' || v_payment.status || '"'
    );
  END IF;

  -- Le paiement est dans un état non-terminal (waiting_beneficiary_info, ready_for_payment,
  -- processing, cash_pending, cash_scanned) → il faut rembourser le wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_payment.amount_xaf;

  -- Créer l'écriture de remboursement dans le ledger
  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, created_by_admin_id
  ) VALUES (
    v_wallet.id, v_payment.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_payment.amount_xaf,
    v_wallet.balance_xaf, v_new_balance,
    'payment', p_payment_id,
    'Annulation paiement - Réf: ' || COALESCE(v_payment.reference, p_payment_id::text),
    jsonb_build_object(
      'reason', 'cancelled_by_admin',
      'original_status', v_payment.status,
      'method', v_payment.method,
      'amount_rmb', v_payment.amount_rmb
    ),
    v_admin_id
  );

  -- Mettre à jour le wallet
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Passer le statut à cancelled_by_admin (ne supprime rien)
  UPDATE public.payments
  SET status = 'cancelled_by_admin', updated_at = now()
  WHERE id = p_payment_id;

  -- Événement timeline
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description)
  VALUES (p_payment_id, 'cancelled_by_admin', 'Paiement annulé par le super admin');

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'cancel_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference',          v_payment.reference,
      'amount_xaf',         v_payment.amount_xaf,
      'amount_rmb',         v_payment.amount_rmb,
      'user_id',            v_payment.user_id,
      'status_at_cancel',   v_payment.status,
      'wallet_refunded',    true
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';

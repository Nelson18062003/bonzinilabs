-- ============================================================
-- Corrections suite à la revue de sécurité
--
-- 1. cancel_deposit : rejeter si solde insuffisant (au lieu de
--    clamper à 0), + verrouiller le dépôt avec FOR UPDATE
-- 2. cancel_payment : verrouiller le paiement avec FOR UPDATE
-- 3. validate_deposit : allowlist de statuts au lieu de blocklist
--    (empêche la re-validation d'un dépôt annulé)
-- ============================================================

-- 1. Corriger cancel_deposit
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

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des dépôts');
  END IF;

  -- Verrouiller le dépôt (empêche double annulation concurrente)
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  IF v_deposit.status IN ('cancelled', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est déjà annulé');
  END IF;

  IF v_deposit.status = 'validated' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;

    IF v_wallet IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
    END IF;

    -- Rejeter si le solde est insuffisant (le client a dépensé une partie)
    IF v_wallet.balance_xaf < v_deposit.amount_xaf THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Solde insuffisant pour annuler ce dépôt. Solde: ' || v_wallet.balance_xaf || ' XAF, à reverser: ' || v_deposit.amount_xaf || ' XAF');
    END IF;

    v_new_balance := v_wallet.balance_xaf - v_deposit.amount_xaf;

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

    UPDATE public.wallets
    SET balance_xaf = v_new_balance, updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  UPDATE public.deposits
  SET status = 'cancelled_by_admin', updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'cancelled_by_admin', 'Dépôt annulé par le super admin');

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

-- 2. Corriger cancel_payment (FOR UPDATE sur le paiement)
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

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des paiements');
  END IF;

  -- Verrouiller le paiement (empêche double annulation concurrente)
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  IF v_payment.status IN ('rejected', 'completed', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''annuler un paiement en statut "' || v_payment.status || '"'
    );
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_payment.amount_xaf;

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

  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE public.payments
  SET status = 'cancelled_by_admin', updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description)
  VALUES (p_payment_id, 'cancelled_by_admin', 'Paiement annulé par le super admin');

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

-- 3. Corriger validate_deposit (allowlist de statuts)
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL,
  p_send_notification BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id     UUID;
  v_deposit      RECORD;
  v_wallet       RECORD;
  v_credit_amount BIGINT;
  v_new_balance  BIGINT;
  v_proof_count  INT;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Allowlist : seuls les dépôts en attente peuvent être validés
  IF v_deposit.status NOT IN ('created', 'awaiting_proof', 'proof_submitted', 'admin_review', 'pending_correction') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Impossible de valider un dépôt en statut "' || v_deposit.status || '"');
  END IF;

  SELECT COUNT(*) INTO v_proof_count
  FROM public.deposit_proofs
  WHERE deposit_id = p_deposit_id AND (is_deleted IS NULL OR is_deleted = false);

  IF v_proof_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de valider sans preuve');
  END IF;

  v_credit_amount := v_deposit.amount_xaf;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (v_deposit.user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_credit_amount;

  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE public.deposits SET
    status = 'validated',
    validated_by = v_admin_id,
    validated_at = now(),
    admin_comment = COALESCE(p_admin_comment, admin_comment),
    updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, created_by_admin_id
  ) VALUES (
    v_wallet.id, v_deposit.user_id, 'DEPOSIT_VALIDATED', v_credit_amount,
    v_wallet.balance_xaf, v_new_balance,
    'deposit', p_deposit_id,
    'Dépôt validé - Réf: ' || COALESCE(v_deposit.reference, p_deposit_id::text),
    jsonb_build_object(
      'amount_xaf', v_credit_amount,
      'method', v_deposit.method
    ),
    v_admin_id
  );

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'validated', 'Dépôt validé par l''équipe Bonzini');

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'wallet_credited',
    'Solde mis à jour: +' || v_credit_amount || ' XAF → Nouveau solde: ' || v_new_balance || ' XAF');

  IF p_send_notification THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_deposit.user_id, 'deposit_validated',
      'Dépôt validé',
      'Votre dépôt de ' || v_credit_amount || ' XAF a été validé. Nouveau solde: ' || v_new_balance || ' XAF',
      jsonb_build_object(
        'deposit_id', p_deposit_id,
        'amount_xaf', v_credit_amount,
        'new_balance', v_new_balance
      )
    );
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'reference', v_deposit.reference,
      'amount_xaf', v_credit_amount,
      'user_id', v_deposit.user_id,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credit_amount', v_credit_amount
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

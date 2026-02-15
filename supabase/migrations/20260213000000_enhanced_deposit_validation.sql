-- =====================================================
-- Enhanced Deposit Validation/Rejection
-- Date: 2026-02-13
-- Features:
--   - confirmed_amount_xaf on deposits
--   - rejection_category + admin_internal_note on deposits
--   - soft-delete + metadata on deposit_proofs
--   - Rewritten validate_deposit with proof guard, confirmed amount, notifications
--   - Rewritten reject_deposit with structured rejection + notifications
-- =====================================================

-- =====================================================
-- 1. SCHEMA CHANGES: deposits table
-- =====================================================
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS confirmed_amount_xaf BIGINT,
  ADD COLUMN IF NOT EXISTS rejection_category TEXT,
  ADD COLUMN IF NOT EXISTS admin_internal_note TEXT;

-- =====================================================
-- 2. SCHEMA CHANGES: deposit_proofs table
-- =====================================================
ALTER TABLE public.deposit_proofs
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS uploaded_by_type VARCHAR(10) DEFAULT 'client'
    CHECK (uploaded_by_type IN ('client', 'admin')),
  ADD COLUMN IF NOT EXISTS is_visible_to_client BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT;

-- Partial index for active (non-deleted) proofs
CREATE INDEX IF NOT EXISTS idx_deposit_proofs_active
  ON public.deposit_proofs(deposit_id) WHERE deleted_at IS NULL;

-- =====================================================
-- 3. REWRITE: validate_deposit
-- Restores FOR UPDATE locking, adds confirmed amount,
-- proof guard, notification, and ledger entry.
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL,
  p_confirmed_amount BIGINT DEFAULT NULL,
  p_send_notification BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_credit_amount BIGINT;
  v_new_balance BIGINT;
  v_admin_id UUID;
  v_client_name TEXT;
  v_proof_count INT;
BEGIN
  v_admin_id := auth.uid();

  -- Verify caller is admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- Fetch deposit with row lock
  SELECT d.*
  INTO v_deposit
  FROM deposits d
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  -- Check deposit is not already in a terminal state
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a été rejeté et ne peut plus être validé');
  END IF;

  -- Check proof count (must have at least 1 non-deleted proof)
  SELECT COUNT(*) INTO v_proof_count
  FROM deposit_proofs
  WHERE deposit_id = p_deposit_id AND deleted_at IS NULL;

  IF v_proof_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune preuve - impossible de valider');
  END IF;

  -- Get client name for notifications
  SELECT COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')
  INTO v_client_name
  FROM clients c
  WHERE c.user_id = v_deposit.user_id;

  v_client_name := COALESCE(v_client_name, 'Client');

  -- Determine credit amount
  v_credit_amount := COALESCE(p_confirmed_amount, v_deposit.amount_xaf);

  -- Ensure wallet exists
  INSERT INTO wallets (user_id, balance_xaf)
  VALUES (v_deposit.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get wallet with row lock
  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_deposit.user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf + v_credit_amount;

  -- Update wallet balance
  UPDATE wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Update deposit status
  UPDATE deposits
  SET status = 'validated',
      admin_comment = COALESCE(p_admin_comment, admin_comment),
      confirmed_amount_xaf = CASE
        WHEN p_confirmed_amount IS NOT NULL AND p_confirmed_amount != amount_xaf
        THEN p_confirmed_amount
        ELSE NULL
      END,
      validated_by = v_admin_id,
      validated_at = now(),
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Create wallet operation (legacy)
  INSERT INTO wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by
  ) VALUES (
    v_wallet.id, 'deposit', v_credit_amount, v_wallet.balance_xaf, v_new_balance,
    p_deposit_id, 'deposit',
    format('Dépôt validé - Réf: %s', v_deposit.reference),
    v_admin_id
  );

  -- Create ledger entry
  INSERT INTO ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, created_by_admin_id,
    metadata
  ) VALUES (
    v_wallet.id, v_deposit.user_id, 'DEPOSIT_VALIDATED', v_credit_amount,
    v_wallet.balance_xaf, v_new_balance, 'deposit', p_deposit_id,
    format('Dépôt validé - Réf: %s', v_deposit.reference),
    v_admin_id,
    jsonb_build_object(
      'declared_amount', v_deposit.amount_xaf,
      'confirmed_amount', v_credit_amount,
      'method', v_deposit.method
    )
  );

  -- Timeline event: validated
  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'validated',
    'Dépôt validé par l''équipe Bonzini',
    v_admin_id
  );

  -- Timeline event: wallet credited
  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'wallet_credited',
    format('Solde mis à jour: +%s XAF → Nouveau solde: %s XAF',
           to_char(v_credit_amount, 'FM999,999,999'),
           to_char(v_new_balance, 'FM999,999,999')),
    v_admin_id
  );

  -- Notification (if enabled)
  IF p_send_notification THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_deposit.user_id,
      'deposit_validated',
      'Dépôt validé',
      format('Votre dépôt de %s XAF a été validé. Nouveau solde: %s XAF',
             to_char(v_credit_amount, 'FM999,999,999'),
             to_char(v_new_balance, 'FM999,999,999')),
      jsonb_build_object(
        'deposit_id', p_deposit_id,
        'reference', v_deposit.reference,
        'amount_xaf', v_credit_amount,
        'new_balance', v_new_balance,
        'method', v_deposit.method
      )
    );
  END IF;

  -- Audit log
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'deposit_reference', v_deposit.reference,
      'client_user_id', v_deposit.user_id,
      'client_name', v_client_name,
      'declared_amount', v_deposit.amount_xaf,
      'confirmed_amount', v_credit_amount,
      'method', v_deposit.method,
      'old_balance', v_wallet.balance_xaf,
      'new_balance', v_new_balance,
      'admin_comment', p_admin_comment,
      'notification_sent', p_send_notification
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount_credited', v_credit_amount,
    'old_balance', v_wallet.balance_xaf,
    'new_balance', v_new_balance,
    'reference', v_deposit.reference
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =====================================================
-- 4. REWRITE: reject_deposit
-- Restores FOR UPDATE locking, adds structured rejection
-- category, admin internal note, and notifications.
-- =====================================================
CREATE OR REPLACE FUNCTION public.reject_deposit(
  p_deposit_id UUID,
  p_reason TEXT,
  p_rejection_category TEXT DEFAULT NULL,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_admin_id UUID;
  v_client_name TEXT;
BEGIN
  v_admin_id := auth.uid();

  -- Verify caller is admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- Validate reason is provided
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif de rejet est obligatoire');
  END IF;

  -- Fetch deposit with row lock
  SELECT d.*
  INTO v_deposit
  FROM deposits d
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  -- Get client name for notifications
  SELECT COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')
  INTO v_client_name
  FROM clients c
  WHERE c.user_id = v_deposit.user_id;

  v_client_name := COALESCE(v_client_name, 'Client');

  -- Check deposit is not already in a terminal state
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé et ne peut plus être rejeté');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été rejeté');
  END IF;

  -- Update deposit status with structured rejection
  UPDATE deposits
  SET status = 'rejected',
      rejection_reason = p_reason,
      rejection_category = p_rejection_category,
      admin_internal_note = p_admin_note,
      validated_by = v_admin_id,
      validated_at = now(),
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Get wallet for informational ledger entry
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_deposit.user_id;

  -- Create informational ledger entry (no balance change)
  IF v_wallet IS NOT NULL THEN
    INSERT INTO ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id,
      metadata
    ) VALUES (
      v_wallet.id, v_deposit.user_id, 'DEPOSIT_REFUSED', v_deposit.amount_xaf,
      v_wallet.balance_xaf, v_wallet.balance_xaf, 'deposit', p_deposit_id,
      format('Dépôt refusé - Réf: %s - Motif: %s', v_deposit.reference, p_reason),
      v_admin_id,
      jsonb_build_object(
        'category', p_rejection_category,
        'reason', p_reason,
        'method', v_deposit.method
      )
    );
  END IF;

  -- Timeline event
  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'rejected',
    format('Dépôt refusé - Motif: %s', p_reason),
    v_admin_id
  );

  -- Notification for client
  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    v_deposit.user_id,
    'deposit_rejected',
    'Dépôt refusé',
    format('Votre dépôt de %s XAF a été refusé. Motif: %s',
           to_char(v_deposit.amount_xaf, 'FM999,999,999'),
           p_reason),
    jsonb_build_object(
      'deposit_id', p_deposit_id,
      'reference', v_deposit.reference,
      'amount_xaf', v_deposit.amount_xaf,
      'reason', p_reason,
      'category', p_rejection_category
    )
  );

  -- Audit log
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'reject_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'deposit_reference', v_deposit.reference,
      'client_user_id', v_deposit.user_id,
      'client_name', v_client_name,
      'amount_xaf', v_deposit.amount_xaf,
      'method', v_deposit.method,
      'rejection_category', p_rejection_category,
      'reason', p_reason,
      'admin_note', p_admin_note
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reference', v_deposit.reference
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =====================================================
-- 5. GRANT EXECUTE on updated functions
-- =====================================================
GRANT EXECUTE ON FUNCTION public.validate_deposit(UUID, TEXT, BIGINT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(UUID, TEXT, TEXT, TEXT) TO authenticated;

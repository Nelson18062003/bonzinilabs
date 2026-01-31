-- =====================================================
-- BRIQUE C: Validation Admin + Mise à jour du solde
-- Version reconstruite à partir de zéro
-- =====================================================

-- =====================================================
-- 1. VALIDATE DEPOSIT
-- Validates a deposit and credits the client's wallet
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet_id UUID;
  v_new_balance BIGINT;
  v_old_balance BIGINT;
  v_admin_id UUID;
  v_client_name TEXT;
BEGIN
  -- Get admin ID from auth context
  v_admin_id := auth.uid();

  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- Fetch the deposit with FOR UPDATE to lock the row
  SELECT d.*, p.first_name, p.last_name
  INTO v_deposit
  FROM deposits d
  LEFT JOIN profiles p ON p.id = d.user_id
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  -- Store client name for notification
  v_client_name := COALESCE(v_deposit.first_name, '') || ' ' || COALESCE(v_deposit.last_name, '');

  -- Check deposit is not already validated or rejected
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a été rejeté et ne peut plus être validé');
  END IF;

  -- Ensure wallet exists for user (create if not exists)
  INSERT INTO wallets (user_id, balance_xaf)
  VALUES (v_deposit.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get wallet ID and current balance with lock
  SELECT id, balance_xaf INTO v_wallet_id, v_old_balance
  FROM wallets
  WHERE user_id = v_deposit.user_id
  FOR UPDATE;

  -- Calculate new balance
  v_new_balance := v_old_balance + v_deposit.amount_xaf;

  -- Update wallet balance
  UPDATE wallets
  SET
    balance_xaf = v_new_balance,
    updated_at = now()
  WHERE id = v_wallet_id;

  -- Update deposit status
  UPDATE deposits
  SET
    status = 'validated',
    admin_comment = COALESCE(p_admin_comment, admin_comment),
    validated_by = v_admin_id,
    validated_at = now(),
    updated_at = now()
  WHERE id = p_deposit_id;

  -- Create wallet operation (ledger entry)
  INSERT INTO wallet_operations (
    wallet_id,
    operation_type,
    amount_xaf,
    balance_before,
    balance_after,
    reference_id,
    reference_type,
    description,
    performed_by,
    created_at
  ) VALUES (
    v_wallet_id,
    'deposit',
    v_deposit.amount_xaf,
    v_old_balance,
    v_new_balance,
    p_deposit_id,
    'deposit',
    format('Dépôt validé - Réf: %s', v_deposit.reference),
    v_admin_id,
    COALESCE(v_deposit.created_at, now())  -- Use deposit creation date for accurate timeline
  );

  -- Create timeline event: validated
  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by,
    created_at
  ) VALUES (
    p_deposit_id,
    'validated',
    'Dépôt validé par l''équipe Bonzini',
    v_admin_id,
    now()
  );

  -- Create timeline event: wallet credited
  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by,
    created_at
  ) VALUES (
    p_deposit_id,
    'wallet_credited',
    format('Solde mis à jour: +%s XAF → Nouveau solde: %s XAF',
           to_char(v_deposit.amount_xaf, 'FM999,999,999'),
           to_char(v_new_balance, 'FM999,999,999')),
    v_admin_id,
    now()
  );

  -- Create notification for client
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_deposit.user_id,
    'deposit_validated',
    'Dépôt validé',
    format('Votre dépôt de %s XAF a été validé. Nouveau solde: %s XAF',
           to_char(v_deposit.amount_xaf, 'FM999,999,999'),
           to_char(v_new_balance, 'FM999,999,999')),
    jsonb_build_object(
      'deposit_id', p_deposit_id,
      'reference', v_deposit.reference,
      'amount_xaf', v_deposit.amount_xaf,
      'new_balance', v_new_balance,
      'method', v_deposit.method
    )
  );

  -- Create admin audit log
  INSERT INTO admin_audit_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'validate_deposit',
    'deposit',
    p_deposit_id,
    jsonb_build_object(
      'deposit_reference', v_deposit.reference,
      'client_user_id', v_deposit.user_id,
      'client_name', v_client_name,
      'amount_xaf', v_deposit.amount_xaf,
      'method', v_deposit.method,
      'old_balance', v_old_balance,
      'new_balance', v_new_balance,
      'admin_comment', p_admin_comment
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount_credited', v_deposit.amount_xaf,
    'old_balance', v_old_balance,
    'new_balance', v_new_balance,
    'reference', v_deposit.reference
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =====================================================
-- 2. REJECT DEPOSIT
-- Rejects a deposit with a mandatory reason
-- =====================================================
CREATE OR REPLACE FUNCTION public.reject_deposit(
  p_deposit_id UUID,
  p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
  v_client_name TEXT;
BEGIN
  -- Get admin ID from auth context
  v_admin_id := auth.uid();

  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- Validate reason is provided
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif de rejet est obligatoire');
  END IF;

  -- Fetch the deposit
  SELECT d.*, p.first_name, p.last_name
  INTO v_deposit
  FROM deposits d
  LEFT JOIN profiles p ON p.id = d.user_id
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  v_client_name := COALESCE(v_deposit.first_name, '') || ' ' || COALESCE(v_deposit.last_name, '');

  -- Check deposit is not already validated
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé et ne peut plus être rejeté');
  END IF;

  -- Check deposit is not already rejected
  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été rejeté');
  END IF;

  -- Update deposit status
  UPDATE deposits
  SET
    status = 'rejected',
    rejection_reason = p_reason,
    validated_by = v_admin_id,
    validated_at = now(),
    updated_at = now()
  WHERE id = p_deposit_id;

  -- Create timeline event
  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by,
    created_at
  ) VALUES (
    p_deposit_id,
    'rejected',
    format('Dépôt rejeté - Motif: %s', p_reason),
    v_admin_id,
    now()
  );

  -- Create notification for client
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
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
      'reason', p_reason
    )
  );

  -- Create admin audit log
  INSERT INTO admin_audit_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'reject_deposit',
    'deposit',
    p_deposit_id,
    jsonb_build_object(
      'deposit_reference', v_deposit.reference,
      'client_user_id', v_deposit.user_id,
      'client_name', v_client_name,
      'amount_xaf', v_deposit.amount_xaf,
      'method', v_deposit.method,
      'reason', p_reason
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
-- 3. REQUEST CORRECTION (Demander une correction)
-- Asks client to re-upload proof without full rejection
-- =====================================================
CREATE OR REPLACE FUNCTION public.request_deposit_correction(
  p_deposit_id UUID,
  p_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif de correction est obligatoire');
  END IF;

  SELECT * INTO v_deposit
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  IF v_deposit.status IN ('validated', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne peut plus être modifié');
  END IF;

  -- Update to pending_correction status
  UPDATE deposits
  SET
    status = 'pending_correction',
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_deposit_id;

  -- Timeline event
  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by
  ) VALUES (
    p_deposit_id,
    'correction_requested',
    format('Correction demandée: %s', p_reason),
    v_admin_id
  );

  -- Notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_deposit.user_id,
    'deposit_correction_requested',
    'Correction demandée',
    format('Veuillez corriger votre dépôt %s. Motif: %s', v_deposit.reference, p_reason),
    jsonb_build_object(
      'deposit_id', p_deposit_id,
      'reference', v_deposit.reference,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'reference', v_deposit.reference);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =====================================================
-- 4. GET DEPOSIT STATS FOR ADMIN DASHBOARD
-- Returns counts by status for quick overview
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_deposit_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'Accès non autorisé');
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'awaiting_proof', COUNT(*) FILTER (WHERE status IN ('created', 'awaiting_proof')),
    'proof_submitted', COUNT(*) FILTER (WHERE status = 'proof_submitted'),
    'pending_correction', COUNT(*) FILTER (WHERE status = 'pending_correction'),
    'admin_review', COUNT(*) FILTER (WHERE status = 'admin_review'),
    'validated', COUNT(*) FILTER (WHERE status = 'validated'),
    'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
    'to_process', COUNT(*) FILTER (WHERE status IN ('proof_submitted', 'admin_review')),
    'today_validated', COUNT(*) FILTER (WHERE status = 'validated' AND validated_at::date = CURRENT_DATE),
    'today_amount', COALESCE(SUM(amount_xaf) FILTER (WHERE status = 'validated' AND validated_at::date = CURRENT_DATE), 0)
  ) INTO v_stats
  FROM deposits;

  RETURN v_stats;
END;
$$;

-- =====================================================
-- 5. RESUBMIT DEPOSIT (Client resubmits after correction)
-- =====================================================
CREATE OR REPLACE FUNCTION public.resubmit_deposit(
  p_deposit_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_deposit
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  -- Verify ownership
  IF v_deposit.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- Can only resubmit if pending_correction
  IF v_deposit.status != 'pending_correction' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne peut pas être renvoyé');
  END IF;

  -- Update status
  UPDATE deposits
  SET
    status = 'proof_submitted',
    rejection_reason = NULL,
    updated_at = now()
  WHERE id = p_deposit_id;

  -- Timeline event
  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by
  ) VALUES (
    p_deposit_id,
    'resubmitted',
    'Dépôt renvoyé après correction',
    v_user_id
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =====================================================
-- 6. MARK DEPOSIT AS IN REVIEW (Admin starts reviewing)
-- =====================================================
CREATE OR REPLACE FUNCTION public.start_deposit_review(
  p_deposit_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT * INTO v_deposit
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  IF v_deposit.status NOT IN ('proof_submitted', 'pending_correction') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne peut pas être mis en revue');
  END IF;

  UPDATE deposits
  SET
    status = 'admin_review',
    updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by
  ) VALUES (
    p_deposit_id,
    'admin_review',
    'Vérification en cours par l''équipe Bonzini',
    v_admin_id
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_deposit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_deposit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_deposit_correction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deposit_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_deposit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_deposit_review(UUID) TO authenticated;

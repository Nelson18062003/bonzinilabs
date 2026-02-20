-- ============================================================
-- Migration: Drop legacy tables (profiles, wallet_operations)
-- All RPCs have been updated to use clients/user_roles/ledger_entries
-- ============================================================

-- ============================================
-- 1. Update validate_deposit to remove wallet_operations write
-- ============================================

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

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a été rejeté et ne peut plus être validé');
  END IF;

  -- Check proof count
  SELECT COUNT(*) INTO v_proof_count
  FROM deposit_proofs
  WHERE deposit_id = p_deposit_id AND deleted_at IS NULL;

  IF v_proof_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune preuve - impossible de valider');
  END IF;

  -- Get client name from clients table
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

  -- Create ledger entry (single source of truth)
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

  -- Timeline events
  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'validated',
    'Dépôt validé par l''équipe Bonzini',
    v_admin_id
  );

  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'wallet_credited',
    format('Solde mis à jour: +%s XAF → Nouveau solde: %s XAF',
           to_char(v_credit_amount, 'FM999,999,999'),
           to_char(v_new_balance, 'FM999,999,999')),
    v_admin_id
  );

  -- Notification
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

-- ============================================
-- 2. Update admin_delete_client to not reference profiles
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_delete_client(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_has_role BOOLEAN;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  ) INTO v_has_role;

  IF v_has_role THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer un utilisateur admin/agent. Supprimez d''abord son rôle.');
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;

  -- Delete wallet adjustments
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_adjustments WHERE wallet_id = v_wallet_id;
  END IF;

  -- Delete ledger entries
  DELETE FROM ledger_entries WHERE user_id = p_user_id;

  -- Delete notifications
  DELETE FROM notifications WHERE user_id = p_user_id;

  -- Delete deposit timeline events
  DELETE FROM deposit_timeline_events WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );

  -- Delete deposit proofs
  DELETE FROM deposit_proofs WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );

  -- Delete deposits
  DELETE FROM deposits WHERE user_id = p_user_id;

  -- Delete payment timeline events
  DELETE FROM payment_timeline_events WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );

  -- Delete payment proofs
  DELETE FROM payment_proofs WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );

  -- Delete payments
  DELETE FROM payments WHERE user_id = p_user_id;

  -- Delete wallet
  DELETE FROM wallets WHERE user_id = p_user_id;

  -- Delete client record
  DELETE FROM clients WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Client supprimé avec succès'
  );
END;
$$;

-- ============================================
-- 3. Drop legacy tables
-- ============================================

-- Drop RLS policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Cash agents can view profiles" ON public.profiles;

-- Drop RLS policies on wallet_operations
DROP POLICY IF EXISTS "Users can view own wallet operations" ON public.wallet_operations;
DROP POLICY IF EXISTS "Admins can view all wallet operations" ON public.wallet_operations;
DROP POLICY IF EXISTS "Admins can insert wallet operations" ON public.wallet_operations;

-- Drop triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

-- Drop tables
DROP TABLE IF EXISTS public.wallet_operations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

NOTIFY pgrst, 'reload schema';

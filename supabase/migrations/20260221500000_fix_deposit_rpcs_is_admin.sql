-- ============================================================
-- Migration: Fix 4 deposit RPCs calling is_admin() without parameter
-- Also fix reject_deposit() which still joined on dropped profiles table
-- ============================================================

-- 1. start_deposit_review — fix is_admin() call
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

  IF NOT public.is_admin(v_admin_id) THEN
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

-- 2. reject_deposit — fix is_admin() call + replace profiles join with clients
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
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif de rejet est obligatoire');
  END IF;

  SELECT d.*
  INTO v_deposit
  FROM deposits d
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  -- Get client name from clients table
  SELECT COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')
  INTO v_client_name
  FROM clients c
  WHERE c.user_id = v_deposit.user_id;

  v_client_name := COALESCE(v_client_name, 'Client');

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé et ne peut plus être rejeté');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été rejeté');
  END IF;

  UPDATE deposits
  SET
    status = 'rejected',
    rejection_reason = p_reason,
    validated_by = v_admin_id,
    validated_at = now(),
    updated_at = now()
  WHERE id = p_deposit_id;

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

-- 3. request_deposit_correction — fix is_admin() call
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

  IF NOT public.is_admin(v_admin_id) THEN
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

  UPDATE deposits
  SET
    status = 'pending_correction',
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_deposit_id;

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

-- 4. get_deposit_stats — fix is_admin() call
CREATE OR REPLACE FUNCTION public.get_deposit_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
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

NOTIFY pgrst, 'reload schema';

-- BRIQUE C: Add pending_correction status for deposit re-upload flow
-- This allows admins to request corrections instead of rejecting

-- ============================================
-- 1. ADD NEW STATUS TO ENUM
-- ============================================

-- Add 'pending_correction' to deposit_status enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending_correction'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'deposit_status')
  ) THEN
    ALTER TYPE public.deposit_status ADD VALUE 'pending_correction';
  END IF;
END $$;

-- ============================================
-- 2. CREATE request_deposit_correction() RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.request_deposit_correction(
  p_deposit_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  -- Can only request correction for certain statuses
  IF v_deposit.status NOT IN ('created', 'awaiting_proof', 'proof_submitted', 'admin_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot request correction for this status');
  END IF;

  -- Update deposit status to pending_correction
  UPDATE public.deposits
  SET status = 'pending_correction',
      rejection_reason = p_reason,
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'correction_requested', 'Correction demandée: ' || p_reason, v_admin_id);

  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'request_correction', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'reason', p_reason
    )
  );

  -- Create notification for the client
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_deposit.user_id,
    'deposit_correction_needed',
    'Correction requise',
    format('Veuillez corriger votre dépôt %s: %s',
      v_deposit.reference,
      p_reason),
    jsonb_build_object(
      'deposit_id', p_deposit_id,
      'reference', v_deposit.reference,
      'amount_xaf', v_deposit.amount_xaf,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.request_deposit_correction IS 'Admin requests correction from client instead of rejecting deposit.';

-- ============================================
-- 3. CREATE resubmit_deposit() RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.resubmit_deposit(
  p_deposit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  -- Check ownership
  IF v_deposit.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Can only resubmit if pending_correction
  IF v_deposit.status != 'pending_correction' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit is not pending correction');
  END IF;

  -- Update status back to proof_submitted
  UPDATE public.deposits
  SET status = 'proof_submitted',
      rejection_reason = NULL,
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'proof_resubmitted', 'Preuve corrigée et renvoyée', v_user_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.resubmit_deposit IS 'Client resubmits deposit after correction.';

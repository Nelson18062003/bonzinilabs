-- ============================================================================
-- DEPOSIT MODULE: Remove rate limit + Add cancellation feature
-- ============================================================================

-- 1. Remove the deposit rate limit trigger (user requested no limit)
DROP TRIGGER IF EXISTS enforce_deposit_rate_limit ON public.deposits;
DROP FUNCTION IF EXISTS public.check_deposit_rate_limit();

-- Update the rate_limit_usage view to remove deposit section
CREATE OR REPLACE VIEW public.rate_limit_usage AS
SELECT
  'payments' as operation_type,
  user_id,
  COUNT(*) as count_last_hour,
  20 as limit_per_hour,
  CASE WHEN COUNT(*) >= 20 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.payments
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id

UNION ALL

SELECT
  'admin_adjustments' as operation_type,
  performed_by as user_id,
  COUNT(*) as count_last_hour,
  50 as limit_per_hour,
  CASE WHEN COUNT(*) >= 50 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.wallet_operations
WHERE operation_type = 'adjustment'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY performed_by;

-- 2. Add 'cancelled' status to deposit_status enum
ALTER TYPE public.deposit_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 3. RPC: Client cancels their own deposit
CREATE OR REPLACE FUNCTION public.cancel_client_deposit(
  p_deposit_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_deposit RECORD;
  v_cancellable_statuses TEXT[] := ARRAY['created', 'awaiting_proof', 'proof_submitted'];
BEGIN
  -- 1. Verify caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- 2. Fetch deposit with lock
  SELECT id, user_id, status, reference
  INTO v_deposit
  FROM public.deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- 3. Verify ownership
  IF v_deposit.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez annuler que vos propres dépôts');
  END IF;

  -- 4. Verify cancellable status
  IF NOT v_deposit.status::text = ANY(v_cancellable_statuses) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ce dépôt ne peut plus être annulé (statut: ' || v_deposit.status || ')'
    );
  END IF;

  -- 5. Cancel the deposit
  UPDATE public.deposits
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_deposit_id;

  -- 6. Create timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'cancelled', 'Dépôt annulé par le client', v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'reference', v_deposit.reference,
    'message', 'Dépôt annulé avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_client_deposit TO authenticated;
NOTIFY pgrst, 'reload schema';

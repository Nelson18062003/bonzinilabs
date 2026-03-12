-- Super admin can delete any payment regardless of status
CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_payment  RECORD;
  v_is_super BOOLEAN;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Check super_admin role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Block completed payments for non-super admins
  IF v_payment.status = 'completed' AND NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer un paiement effectué');
  END IF;

  -- Refund the balance only for non-rejected and non-completed payments
  -- (rejected = already refunded; completed = money already sent to beneficiary)
  IF v_payment.status NOT IN ('rejected', 'completed') THEN
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id;

    -- Record the refund operation
    INSERT INTO public.wallet_operations (
      wallet_id, operation_type, amount_xaf, balance_before, balance_after,
      reference_id, reference_type, description, performed_by
    )
    SELECT
      w.id, 'adjustment', v_payment.amount_xaf,
      w.balance_xaf - v_payment.amount_xaf, w.balance_xaf,
      p_payment_id, 'payment_deleted',
      'Remboursement paiement supprimé - ' || v_payment.reference,
      v_admin_id
    FROM public.wallets w WHERE w.user_id = v_payment.user_id;
  END IF;

  -- Delete related records
  DELETE FROM public.payment_timeline_events WHERE payment_id = p_payment_id;
  DELETE FROM public.payment_proofs          WHERE payment_id = p_payment_id;
  DELETE FROM public.payments                WHERE id = p_payment_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference',         v_payment.reference,
      'amount_xaf',        v_payment.amount_xaf,
      'user_id',           v_payment.user_id,
      'status_at_deletion', v_payment.status,
      'forced_by_super_admin', v_is_super
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';

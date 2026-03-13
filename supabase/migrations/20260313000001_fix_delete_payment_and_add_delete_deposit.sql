-- ============================================================
-- Fix 1: delete_payment RPC
--   - wallet_operations table was dropped; use ledger_entries
--   - Only super_admin can delete (no more partial access for other admins)
-- Fix 2: delete_deposit RPC (new)
--   - Super_admin only, any status
--   - Reverses wallet credit if deposit was validated
--   - Audit log
-- Fix 3: RLS DELETE policy on deposits for super_admin
-- ============================================================

-- ============================================================
-- 1. Fix delete_payment RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_payment  RECORD;
  v_wallet   RECORD;
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

  -- Only super_admin can delete payments
  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut supprimer des paiements');
  END IF;

  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Refund the balance only for non-rejected and non-completed payments
  -- (rejected = already refunded; completed = money already sent to beneficiary)
  IF v_payment.status NOT IN ('rejected', 'completed') THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id;

    IF v_wallet IS NOT NULL THEN
      UPDATE public.wallets
      SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
      WHERE user_id = v_payment.user_id;

      -- Record the refund in ledger_entries (wallet_operations was dropped)
      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description
      ) VALUES (
        v_wallet.id,
        v_payment.user_id,
        'PAYMENT_CANCELLED_REFUNDED',
        v_payment.amount_xaf,
        v_wallet.balance_xaf,
        v_wallet.balance_xaf + v_payment.amount_xaf,
        'payment',
        p_payment_id,
        'Remboursement paiement supprimé - ' || v_payment.reference
      );
    END IF;
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
      'reference',             v_payment.reference,
      'amount_xaf',            v_payment.amount_xaf,
      'user_id',               v_payment.user_id,
      'status_at_deletion',    v_payment.status,
      'forced_by_super_admin', true
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 2. Create delete_deposit RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_deposit(p_deposit_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_deposit  RECORD;
  v_wallet   RECORD;
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

  -- Only super_admin can delete deposits
  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut supprimer des dépôts');
  END IF;

  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- If deposit was validated, reverse the credit on the wallet
  IF v_deposit.status = 'validated' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;

    IF v_wallet IS NOT NULL THEN
      UPDATE public.wallets
      SET balance_xaf = GREATEST(0, balance_xaf - v_deposit.amount_xaf), updated_at = now()
      WHERE user_id = v_deposit.user_id;

      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description
      ) VALUES (
        v_wallet.id,
        v_deposit.user_id,
        'ADMIN_DEBIT',
        v_deposit.amount_xaf,
        v_wallet.balance_xaf,
        GREATEST(0, v_wallet.balance_xaf - v_deposit.amount_xaf),
        'deposit',
        p_deposit_id,
        'Suppression dépôt validé - ' || v_deposit.reference
      );
    END IF;
  END IF;

  -- Delete related records (storage files cleaned up by frontend)
  DELETE FROM public.deposit_proofs          WHERE deposit_id = p_deposit_id;
  DELETE FROM public.deposit_timeline_events WHERE deposit_id = p_deposit_id;
  DELETE FROM public.deposits                WHERE id = p_deposit_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'reference',             v_deposit.reference,
      'amount_xaf',            v_deposit.amount_xaf,
      'user_id',               v_deposit.user_id,
      'status_at_deletion',    v_deposit.status,
      'forced_by_super_admin', true
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. RLS DELETE policy on deposits for super_admin only
-- ============================================================
DROP POLICY IF EXISTS "Super admins can delete deposits" ON public.deposits;
DROP POLICY IF EXISTS "Admins can delete deposits" ON public.deposits;

CREATE POLICY "Super admins can delete deposits"
ON public.deposits
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND (is_disabled = false OR is_disabled IS NULL)
  )
);

NOTIFY pgrst, 'reload schema';

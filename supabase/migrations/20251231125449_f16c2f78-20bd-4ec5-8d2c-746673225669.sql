
-- Function to create a payment for a client (admin only)
-- This function:
-- 1. Validates admin has access
-- 2. Creates the payment with immediate debit from client wallet
-- 3. Supports custom exchange rate
-- 4. Supports desired payment date
-- 5. Handles all payment methods including QR code uploads

CREATE OR REPLACE FUNCTION public.create_admin_payment(
  p_user_id UUID,
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL,
  p_client_visible_comment TEXT DEFAULT NULL,
  p_desired_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Validate inputs
  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde client insuffisant');
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  
  -- Generate reference
  v_reference := generate_payment_reference();
  
  -- Determine initial status based on beneficiary info
  v_has_beneficiary_info := (
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );
  
  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;
  
  -- Use desired date or now
  v_created_at := COALESCE(p_desired_date, now());
  
  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after, client_visible_comment, created_at
  ) VALUES (
    p_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance, p_client_visible_comment, v_created_at
  ) RETURNING id INTO v_payment_id;
  
  -- Update wallet balance (immediate debit/reservation)
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create wallet operation with the desired date
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by, created_at
  ) VALUES (
    v_wallet.id, 'payment', p_amount_xaf, v_wallet.balance_xaf, v_new_balance,
    v_payment_id, 'payment', 'Paiement ' || v_reference, v_admin_id, v_created_at
  );
  
  -- Add timeline event for creation
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
  VALUES (v_payment_id, 'created', 'Paiement créé par l''équipe Bonzini - Montant réservé', v_admin_id, v_created_at);
  
  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id, v_created_at);
  END IF;
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_for_client', 'payment', v_payment_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'method', p_method,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function to delete a payment (admin only)
-- Only allowed if payment is not completed
-- Refunds the balance if payment was debited
CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_payment RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- Cannot delete completed payments
  IF v_payment.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer un paiement effectué');
  END IF;
  
  -- Refund the balance if not rejected (rejected payments are already refunded)
  IF v_payment.status != 'rejected' THEN
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id;
    
    -- Record the refund operation
    INSERT INTO public.wallet_operations (
      wallet_id, operation_type, amount_xaf, balance_before, balance_after,
      reference_id, reference_type, description, performed_by
    )
    SELECT 
      w.id, 'adjustment', v_payment.amount_xaf, w.balance_xaf - v_payment.amount_xaf, w.balance_xaf,
      p_payment_id, 'payment_deleted', 'Remboursement paiement supprimé - ' || v_payment.reference, v_admin_id
    FROM public.wallets w WHERE w.user_id = v_payment.user_id;
  END IF;
  
  -- Delete related records
  DELETE FROM public.payment_timeline_events WHERE payment_id = p_payment_id;
  DELETE FROM public.payment_proofs WHERE payment_id = p_payment_id;
  DELETE FROM public.payments WHERE id = p_payment_id;
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference', v_payment.reference,
      'amount_xaf', v_payment.amount_xaf,
      'user_id', v_payment.user_id,
      'status_at_deletion', v_payment.status
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to delete a payment proof (admin only)
-- Only allowed if payment is not in processing or completed status
CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
  v_payment RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Get proof
  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id;
  
  IF v_proof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preuve non trouvée');
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = v_proof.payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- Cannot delete proofs if payment is processing or completed
  IF v_payment.status IN ('processing', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer les preuves d''un paiement en cours ou effectué');
  END IF;
  
  -- Delete the proof
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;
  
  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Add RLS policy to allow admins to delete payment proofs
CREATE POLICY "Admins can delete payment proofs"
ON public.payment_proofs
FOR DELETE
USING (is_admin(auth.uid()));

-- Add RLS policy to allow admins to delete payments
CREATE POLICY "Admins can delete payments"
ON public.payments
FOR DELETE
USING (is_admin(auth.uid()));

-- Add RLS policy to allow admins to delete payment timeline events
CREATE POLICY "Admins can delete payment timeline events"
ON public.payment_timeline_events
FOR DELETE
USING (is_admin(auth.uid()));

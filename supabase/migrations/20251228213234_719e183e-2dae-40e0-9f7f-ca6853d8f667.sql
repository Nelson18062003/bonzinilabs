-- Function to manually adjust a client's wallet (credit or debit)
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount BIGINT,
  p_adjustment_type TEXT, -- 'credit' or 'debit'
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_operation_amount BIGINT;
  v_description TEXT;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Validate inputs
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;
  
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif est obligatoire');
  END IF;
  
  IF p_adjustment_type NOT IN ('credit', 'debit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''ajustement invalide');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;
  
  -- Calculate new balance
  IF p_adjustment_type = 'credit' THEN
    v_new_balance := v_wallet.balance_xaf + p_amount;
    v_operation_amount := p_amount;
    v_description := 'Crédit manuel: ' || p_reason;
  ELSE
    -- Check if sufficient balance for debit
    IF v_wallet.balance_xaf < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce débit');
    END IF;
    v_new_balance := v_wallet.balance_xaf - p_amount;
    v_operation_amount := p_amount;
    v_description := 'Débit manuel: ' || p_reason;
  END IF;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create wallet operation record
  INSERT INTO public.wallet_operations (
    wallet_id,
    operation_type,
    amount_xaf,
    balance_before,
    balance_after,
    description,
    performed_by
  ) VALUES (
    v_wallet.id,
    'adjustment',
    v_operation_amount,
    v_wallet.balance_xaf,
    v_new_balance,
    v_description,
    v_admin_id
  );
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'wallet_adjustment_' || p_adjustment_type,
    'wallet',
    v_wallet.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'amount', p_amount,
      'type', p_adjustment_type,
      'reason', p_reason,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount', p_amount,
    'type', p_adjustment_type
  );
END;
$$;
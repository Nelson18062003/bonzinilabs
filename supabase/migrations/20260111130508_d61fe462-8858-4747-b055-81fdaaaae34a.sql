CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_adjustment_type TEXT,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_adjustment_amount NUMERIC;
BEGIN
  -- Get the wallet
  SELECT id, balance_xaf INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate the adjustment amount (negative for debit, positive for credit)
  IF p_adjustment_type = 'debit' THEN
    v_adjustment_amount := -ABS(p_amount);
    v_new_balance := v_current_balance - ABS(p_amount);
  ELSE
    v_adjustment_amount := ABS(p_amount);
    v_new_balance := v_current_balance + ABS(p_amount);
  END IF;

  -- Check if debit would result in negative balance
  IF v_new_balance < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant pour ce débit');
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  -- Create wallet operation with correct sign
  INSERT INTO wallet_operations (
    wallet_id,
    operation_type,
    amount_xaf,
    balance_before,
    balance_after,
    description,
    performed_by
  ) VALUES (
    v_wallet_id,
    'adjustment',
    v_adjustment_amount,  -- Now correctly negative for debits
    v_current_balance,
    v_new_balance,
    CASE 
      WHEN p_adjustment_type = 'debit' THEN 'Débit manuel: ' || p_reason
      ELSE 'Crédit manuel: ' || p_reason
    END,
    auth.uid()
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount', v_adjustment_amount,
    'type', p_adjustment_type
  );
END;
$$;
-- Update validate_deposit function to use deposit's created_at date for wallet operations
CREATE OR REPLACE FUNCTION public.validate_deposit(p_deposit_id uuid, p_admin_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;
  
  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already validated');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;
  
  IF v_wallet IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (v_deposit.user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;
  
  v_new_balance := v_wallet.balance_xaf + v_deposit.amount_xaf;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Update deposit status
  UPDATE public.deposits
  SET status = 'validated',
      validated_by = v_admin_id,
      validated_at = now(),
      admin_comment = p_admin_comment,
      updated_at = now()
  WHERE id = p_deposit_id;
  
  -- Create wallet operation with deposit's created_at date (not validation date)
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by, created_at
  ) VALUES (
    v_wallet.id, 'deposit', v_deposit.amount_xaf, v_wallet.balance_xaf, v_new_balance,
    p_deposit_id, 'deposit', 'Depot valide - ' || v_deposit.reference, v_admin_id,
    v_deposit.created_at  -- Use the deposit's original date
  );
  
  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'validated', 'Depot valide par l''equipe Bonzini', v_admin_id);
  
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'wallet_credited', 'Solde mis a jour: +' || v_deposit.amount_xaf || ' XAF', v_admin_id);
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_credited', v_deposit.amount_xaf
  );
END;
$function$;
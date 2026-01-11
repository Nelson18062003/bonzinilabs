-- Create function to delete deposit and reverse wallet credit if validated
CREATE OR REPLACE FUNCTION public.delete_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance BIGINT;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Get deposit info
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- If deposit was validated, reverse the wallet credit
  IF v_deposit.status = 'validated' THEN
    -- Get wallet
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;

    IF v_wallet IS NOT NULL THEN
      v_new_balance := v_wallet.balance_xaf - v_deposit.amount_xaf;

      -- Update wallet balance
      UPDATE public.wallets 
      SET balance_xaf = v_new_balance, updated_at = now()
      WHERE id = v_wallet.id;

      -- Create wallet operation for the reversal
      INSERT INTO public.wallet_operations (
        wallet_id,
        operation_type,
        amount_xaf,
        balance_before,
        balance_after,
        reference_id,
        reference_type,
        description,
        performed_by
      ) VALUES (
        v_wallet.id,
        'adjustment',
        -v_deposit.amount_xaf,
        v_wallet.balance_xaf,
        v_new_balance,
        p_deposit_id,
        'deposit_deletion',
        'Annulation dépôt ' || v_deposit.reference || ' (supprimé par admin)',
        v_admin_id
      );
    END IF;
  END IF;

  -- Delete deposit proofs
  DELETE FROM public.deposit_proofs WHERE deposit_id = p_deposit_id;

  -- Delete timeline events
  DELETE FROM public.deposit_timeline_events WHERE deposit_id = p_deposit_id;

  -- Delete deposit
  DELETE FROM public.deposits WHERE id = p_deposit_id;

  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id,
    'delete_deposit',
    'deposit',
    p_deposit_id,
    jsonb_build_object(
      'reference', v_deposit.reference,
      'amount_xaf', v_deposit.amount_xaf,
      'status', v_deposit.status,
      'user_id', v_deposit.user_id,
      'wallet_reversed', v_deposit.status = 'validated'
    )
  );

  RETURN jsonb_build_object('success', true, 'wallet_reversed', v_deposit.status = 'validated');
END;
$function$;
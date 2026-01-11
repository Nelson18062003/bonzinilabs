-- Function to delete a client and all their related data
CREATE OR REPLACE FUNCTION public.admin_delete_client(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_has_role BOOLEAN;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  
  -- Check if the target user has any role (admin/agent) - cannot delete admins/agents
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  ) INTO v_has_role;
  
  IF v_has_role THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer un utilisateur admin/agent. Supprimez d''abord son rôle.');
  END IF;
  
  -- Get wallet ID
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  
  -- Delete wallet operations
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_operations WHERE wallet_id = v_wallet_id;
  END IF;
  
  -- Delete deposit timeline events
  DELETE FROM deposit_timeline_events WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  
  -- Delete deposit proofs
  DELETE FROM deposit_proofs WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  
  -- Delete deposits
  DELETE FROM deposits WHERE user_id = p_user_id;
  
  -- Delete payment timeline events
  DELETE FROM payment_timeline_events WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  
  -- Delete payment proofs
  DELETE FROM payment_proofs WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  
  -- Delete payments
  DELETE FROM payments WHERE user_id = p_user_id;
  
  -- Delete wallet
  DELETE FROM wallets WHERE user_id = p_user_id;
  
  -- Delete profile
  DELETE FROM profiles WHERE user_id = p_user_id;
  
  -- Note: We cannot delete from auth.users here as it requires admin API
  -- The user account will remain but without profile/data
  
  RETURN json_build_object(
    'success', true,
    'message', 'Client supprimé avec succès'
  );
END;
$$;
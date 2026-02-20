-- ============================================================
-- Migration: Fix RPCs that still read from `profiles`
-- admin_reset_client_password → read from `clients`
-- admin_delete_client → delete from `clients` instead of `profiles`
-- ============================================================

-- ============================================
-- 1. admin_reset_client_password() — read from clients instead of profiles
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_reset_client_password(
  p_target_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  temp_password TEXT;
  encrypted_pw TEXT;
  caller_role TEXT;
  target_client RECORD;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- 2. Verify caller is super_admin
  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin';

  IF caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut réinitialiser les mots de passe');
  END IF;

  -- 3. Validate target user
  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur est requis');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- 4. Get client info from clients table (not profiles)
  SELECT first_name, last_name INTO target_client
  FROM public.clients
  WHERE user_id = p_target_user_id;

  -- 5. Generate new temporary password
  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  -- 6. Update password
  UPDATE auth.users
  SET encrypted_password = encrypted_pw, updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 7. Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(), 'reset_client_password', 'client', p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || COALESCE(target_client.first_name, '') || ' ' || COALESCE(target_client.last_name, '')
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || COALESCE(target_client.first_name, '') || ' ' || COALESCE(target_client.last_name, '')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- 2. admin_delete_client() — delete from clients instead of profiles
--    Also handle ledger_entries, wallet_adjustments, notifications
-- ============================================

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

  -- Delete wallet adjustments
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_adjustments WHERE wallet_id = v_wallet_id;
  END IF;

  -- Delete ledger entries
  DELETE FROM ledger_entries WHERE user_id = p_user_id;

  -- Delete wallet operations (legacy, will be dropped later)
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_operations WHERE wallet_id = v_wallet_id;
  END IF;

  -- Delete notifications
  DELETE FROM notifications WHERE user_id = p_user_id;

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

  -- Delete client record (source of truth)
  DELETE FROM clients WHERE user_id = p_user_id;

  -- Delete legacy profile if it still exists
  DELETE FROM profiles WHERE user_id = p_user_id;

  -- Note: We cannot delete from auth.users here as it requires admin API
  -- The user account will remain but without profile/data

  RETURN json_build_object(
    'success', true,
    'message', 'Client supprimé avec succès'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_client_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_client TO authenticated;

NOTIFY pgrst, 'reload schema';

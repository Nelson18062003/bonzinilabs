-- RPC to reset a client's password (Super Admin only)
-- Similar to admin_reset_password but checks profiles instead of user_roles

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
  target_profile RECORD;
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

  -- 4. Get profile info for logging
  SELECT first_name, last_name INTO target_profile
  FROM public.profiles
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
      'description', 'Réinitialisation du mot de passe de ' || COALESCE(target_profile.first_name, '') || ' ' || COALESCE(target_profile.last_name, '')
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || COALESCE(target_profile.first_name, '') || ' ' || COALESCE(target_profile.last_name, '')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_client_password TO authenticated;
NOTIFY pgrst, 'reload schema';

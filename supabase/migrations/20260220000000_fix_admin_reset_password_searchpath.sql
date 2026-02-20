-- Fix: admin_reset_password missing 'extensions' in search_path
-- Migration 20260211100000 dropped 'extensions' from the search_path,
-- causing crypt()/gen_salt() (pgcrypto) to fail.

CREATE OR REPLACE FUNCTION public.admin_reset_password(
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
  target_role_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin';

  IF caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut réinitialiser les mots de passe');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur cible est requis');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Read role + name from user_roles (not profiles)
  SELECT role, email, first_name, last_name INTO target_role_record
  FROM public.user_roles
  WHERE user_id = p_target_user_id;

  IF target_role_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur admin non trouvé');
  END IF;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  UPDATE auth.users
  SET encrypted_password = encrypted_pw, updated_at = NOW()
  WHERE id = p_target_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'reset_admin_password',
    'admin_user',
    p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || COALESCE(target_role_record.first_name, '') || ' ' || COALESCE(target_role_record.last_name, ''),
      'target_role', target_role_record.role
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || COALESCE(target_role_record.first_name, '') || ' ' || COALESCE(target_role_record.last_name, '')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_password TO authenticated;
NOTIFY pgrst, 'reload schema';

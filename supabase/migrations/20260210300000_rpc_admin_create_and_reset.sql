-- RPC functions to replace Edge Functions for admin creation and password reset
-- This avoids Edge Function JWT issues by running entirely server-side

-- ============================================
-- 1. admin_create_admin: Create an admin user
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_create_admin(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  new_user_id UUID;
  encrypted_pw TEXT;
  temp_password TEXT;
  valid_roles TEXT[] := ARRAY['super_admin', 'ops', 'support', 'customer_success', 'cash_agent'];
  caller_role TEXT;
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
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut créer des administrateurs');
  END IF;

  -- 3. Validate required fields
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''email est requis');
  END IF;
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_role IS NULL OR TRIM(p_role) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le rôle est requis');
  END IF;

  -- 4. Validate role
  IF NOT p_role = ANY(valid_roles) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rôle invalide. Valeurs acceptées: ' || array_to_string(valid_roles, ', '));
  END IF;

  -- 5. Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  END IF;

  -- 6. Generate temporary password
  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);

  -- 7. Hash password
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  -- 8. Generate user ID
  new_user_id := gen_random_uuid();

  -- 9. Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    is_sso_user, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    LOWER(TRIM(p_email)),
    encrypted_pw,
    NOW(),
    jsonb_build_object(
      'first_name', TRIM(p_first_name),
      'last_name', TRIM(p_last_name)
    ),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    NOW(),
    NOW(),
    false, '', '', '', ''
  );

  -- 10. Insert into auth.identities
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    'email',
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', LOWER(TRIM(p_email)),
      'email_verified', true,
      'phone_verified', false
    ),
    NOW(),
    NOW(),
    NOW()
  );

  -- 11. Ensure profile exists (trigger may create it)
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (new_user_id, TRIM(p_first_name), TRIM(p_last_name))
  ON CONFLICT (user_id) DO UPDATE
  SET first_name = TRIM(p_first_name), last_name = TRIM(p_last_name);

  -- 12. Assign admin role
  INSERT INTO public.user_roles (user_id, role, email, is_disabled)
  VALUES (new_user_id, p_role::public.app_role, LOWER(TRIM(p_email)), false);

  -- 13. Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'create_admin',
    'admin_user',
    new_user_id,
    jsonb_build_object(
      'description', 'Création de l''admin ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name) || ' (' || TRIM(p_email) || ')',
      'role', p_role,
      'email', LOWER(TRIM(p_email))
    )
  );

  -- 14. Return success
  RETURN jsonb_build_object(
    'success', true,
    'userId', new_user_id,
    'email', LOWER(TRIM(p_email)),
    'tempPassword', temp_password,
    'message', 'Admin ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name) || ' créé avec succès'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec ces informations existe déjà');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- 2. admin_reset_password: Reset any user's password
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_target_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  temp_password TEXT;
  encrypted_pw TEXT;
  caller_role TEXT;
  target_profile RECORD;
  target_role_record RECORD;
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

  -- 3. Validate target user ID
  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur cible est requis');
  END IF;

  -- 4. Check target exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- 5. Check target is an admin
  SELECT role, email INTO target_role_record
  FROM public.user_roles
  WHERE user_id = p_target_user_id;

  IF target_role_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur admin non trouvé');
  END IF;

  -- 6. Get target profile for logging
  SELECT first_name, last_name INTO target_profile
  FROM public.profiles
  WHERE user_id = p_target_user_id;

  -- 7. Generate new temporary password
  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);

  -- 8. Hash password
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  -- 9. Update auth.users password
  UPDATE auth.users
  SET encrypted_password = encrypted_pw,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 10. Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'reset_admin_password',
    'admin_user',
    p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || COALESCE(target_profile.first_name, '') || ' ' || COALESCE(target_profile.last_name, ''),
      'target_role', target_role_record.role
    )
  );

  -- 11. Return success
  RETURN jsonb_build_object(
    'success', true,
    'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || COALESCE(target_profile.first_name, '') || ' ' || COALESCE(target_profile.last_name, '')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.admin_create_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password TO authenticated;

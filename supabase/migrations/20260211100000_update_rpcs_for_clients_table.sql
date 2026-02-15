-- ============================================================
-- Migration: Update RPCs to use `clients` table instead of `profiles`
-- Also update admin RPCs to use user_roles.first_name/last_name
-- Dual-write to `profiles` during transition for backward compat
-- ============================================================

-- ============================================
-- 1. handle_new_user() — insert into clients (+ dual-write profiles)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'is_client' = 'true' THEN
    -- Insert into the new clients table (primary)
    INSERT INTO public.clients (user_id, first_name, last_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Utilisateur'),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'phone'
    );

    -- Dual-write to profiles (deprecated, for backward compat)
    INSERT INTO public.profiles (user_id, first_name, last_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Utilisateur'),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'phone'
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Create wallet
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (NEW.id, 0);
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- 2. admin_create_client() — write to clients (+ dual-write profiles)
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_create_client(
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT 'OTHER',
  p_country TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_company TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  new_user_id UUID;
  encrypted_pw TEXT;
  auth_email TEXT;
  temp_password TEXT;
  wallet_id UUID;
BEGIN
  -- 1. Verify caller is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un administrateur peut créer des clients');
  END IF;

  -- 2. Validate required fields
  IF p_first_name IS NULL OR p_first_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NULL OR p_last_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le numéro WhatsApp est requis');
  END IF;

  -- 3. Check phone uniqueness in clients table
  IF EXISTS (SELECT 1 FROM public.clients WHERE phone = p_phone) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro WhatsApp est déjà utilisé par un autre client');
  END IF;

  -- 4. Build auth email
  auth_email := COALESCE(NULLIF(TRIM(p_email), ''), regexp_replace(p_phone, '[^0-9]', '', 'g') || '@bonzini-client.local');

  -- 5. Check email uniqueness in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = auth_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  END IF;

  -- 6. Generate password
  temp_password := COALESCE(NULLIF(p_password, ''),
    substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4));

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
    auth_email,
    encrypted_pw,
    NOW(),
    jsonb_build_object(
      'is_client', true,
      'first_name', TRIM(p_first_name),
      'last_name', TRIM(p_last_name),
      'phone', p_phone
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
      'email', auth_email,
      'email_verified', true,
      'phone_verified', false
    ),
    NOW(),
    NOW(),
    NOW()
  );

  -- 11. handle_new_user trigger creates client + profile + wallet
  -- Update clients table with additional info
  UPDATE public.clients
  SET phone = p_phone,
      first_name = TRIM(p_first_name),
      last_name = TRIM(p_last_name),
      email = auth_email,
      company_name = NULLIF(TRIM(p_company), ''),
      gender = COALESCE(NULLIF(TRIM(p_gender), ''), 'OTHER'),
      country = NULLIF(TRIM(p_country), ''),
      city = NULLIF(TRIM(p_city), '')
  WHERE user_id = new_user_id;

  -- Dual-write to profiles (deprecated)
  UPDATE public.profiles
  SET phone = p_phone,
      first_name = TRIM(p_first_name),
      last_name = TRIM(p_last_name)
  WHERE user_id = new_user_id;

  -- 12. Get wallet ID
  SELECT id INTO wallet_id FROM public.wallets WHERE user_id = new_user_id;

  -- 13. Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'create_client',
    'client',
    new_user_id,
    jsonb_build_object(
      'description', 'Création du client ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name),
      'firstName', TRIM(p_first_name),
      'lastName', TRIM(p_last_name),
      'phone', p_phone,
      'email', p_email,
      'country', p_country,
      'city', p_city,
      'gender', p_gender,
      'company', p_company
    )
  );

  -- 14. Return success
  RETURN jsonb_build_object(
    'success', true,
    'clientId', new_user_id,
    'walletId', wallet_id,
    'authEmail', auth_email,
    'tempPassword', temp_password,
    'message', 'Client ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name) || ' créé avec succès'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec ces informations existe déjà');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- 3. admin_setup_client() — write to clients
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_setup_client(
  p_user_id UUID,
  p_phone TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_gender TEXT DEFAULT 'OTHER',
  p_country TEXT DEFAULT '',
  p_city TEXT DEFAULT '',
  p_company TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Confirm email
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = p_user_id;

  -- Update clients table (primary)
  UPDATE public.clients
  SET phone = p_phone,
      first_name = TRIM(p_first_name),
      last_name = TRIM(p_last_name),
      company_name = NULLIF(TRIM(p_company), ''),
      gender = COALESCE(NULLIF(TRIM(p_gender), ''), 'OTHER'),
      country = NULLIF(TRIM(p_country), ''),
      city = NULLIF(TRIM(p_city), ''),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Dual-write to profiles (deprecated)
  UPDATE public.profiles
  SET phone = p_phone,
      first_name = TRIM(p_first_name),
      last_name = TRIM(p_last_name),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  SELECT id INTO wallet_id FROM public.wallets WHERE user_id = p_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'create_client',
    'client',
    p_user_id,
    jsonb_build_object(
      'description', 'Création du client ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name),
      'phone', p_phone,
      'gender', p_gender,
      'country', p_country,
      'city', p_city,
      'company', p_company
    )
  );

  RETURN jsonb_build_object('success', true, 'walletId', wallet_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- 4. admin_create_admin() — write first_name/last_name to user_roles
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
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin';

  IF caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut créer des administrateurs');
  END IF;

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
  IF NOT p_role = ANY(valid_roles) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rôle invalide');
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  END IF;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));
  new_user_id := gen_random_uuid();

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
    jsonb_build_object('first_name', TRIM(p_first_name), 'last_name', TRIM(p_last_name)),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    NOW(),
    NOW(),
    false, '', '', '', ''
  );

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

  -- Dual-write to profiles (deprecated)
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (new_user_id, TRIM(p_first_name), TRIM(p_last_name))
  ON CONFLICT (user_id) DO UPDATE
  SET first_name = TRIM(p_first_name), last_name = TRIM(p_last_name);

  -- Assign admin role WITH first_name/last_name (new)
  INSERT INTO public.user_roles (user_id, role, email, is_disabled, first_name, last_name)
  VALUES (new_user_id, p_role::public.app_role, LOWER(TRIM(p_email)), false, TRIM(p_first_name), TRIM(p_last_name));

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(),
    'create_admin',
    'admin_user',
    new_user_id,
    jsonb_build_object(
      'description', 'Création de l''admin ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name),
      'role', p_role,
      'email', LOWER(TRIM(p_email))
    )
  );

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
-- 5. update_admin_profile() — write to user_roles instead of profiles
-- ============================================

CREATE OR REPLACE FUNCTION public.update_admin_profile(
  p_target_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO v_caller_role
  FROM user_roles WHERE user_id = v_caller_id;

  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  END IF;

  SELECT role INTO v_target_role
  FROM user_roles WHERE user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Update user_roles (primary source of truth for admins)
  UPDATE user_roles
  SET first_name = p_first_name, last_name = p_last_name
  WHERE user_id = p_target_user_id;

  -- Dual-write to profiles (deprecated)
  UPDATE profiles
  SET first_name = p_first_name, last_name = p_last_name
  WHERE user_id = p_target_user_id;

  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_caller_id,
    'update_admin_profile',
    'admin_user',
    p_target_user_id,
    jsonb_build_object(
      'description', 'Modification du profil admin',
      'first_name', p_first_name,
      'last_name', p_last_name
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 6. toggle_admin_status() — read name from user_roles
-- ============================================

CREATE OR REPLACE FUNCTION public.toggle_admin_status(
  p_target_user_id UUID,
  p_disabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
  v_target_name TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre statut');
  END IF;

  SELECT role INTO v_caller_role
  FROM user_roles WHERE user_id = v_caller_id;

  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  END IF;

  SELECT role INTO v_target_role
  FROM user_roles WHERE user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Read name from user_roles (not profiles)
  SELECT COALESCE(first_name || ' ' || last_name, 'Admin') INTO v_target_name
  FROM user_roles WHERE user_id = p_target_user_id;

  UPDATE user_roles
  SET is_disabled = p_disabled
  WHERE user_id = p_target_user_id;

  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_caller_id,
    CASE WHEN p_disabled THEN 'disable_admin' ELSE 'enable_admin' END,
    'admin_user',
    p_target_user_id,
    jsonb_build_object(
      'description', CASE WHEN p_disabled
        THEN 'Désactivation de l''admin ' || v_target_name
        ELSE 'Réactivation de l''admin ' || v_target_name
      END,
      'target_role', v_target_role,
      'new_status', CASE WHEN p_disabled THEN 'DISABLED' ELSE 'ACTIVE' END
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 7. update_admin_role() — read name from user_roles
-- ============================================

CREATE OR REPLACE FUNCTION public.update_admin_role(
  p_target_user_id UUID,
  p_new_role app_role
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_old_role TEXT;
  v_target_name TEXT;
BEGIN
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre rôle');
  END IF;

  SELECT role INTO v_caller_role
  FROM user_roles WHERE user_id = v_caller_id;

  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  END IF;

  SELECT role INTO v_old_role
  FROM user_roles WHERE user_id = p_target_user_id;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Read name from user_roles (not profiles)
  SELECT COALESCE(first_name || ' ' || last_name, 'Admin') INTO v_target_name
  FROM user_roles WHERE user_id = p_target_user_id;

  UPDATE user_roles
  SET role = p_new_role
  WHERE user_id = p_target_user_id;

  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_caller_id,
    'update_admin_role',
    'admin_user',
    p_target_user_id,
    jsonb_build_object(
      'description', 'Modification du rôle de ' || v_target_name || ' de ' || v_old_role || ' à ' || p_new_role::text,
      'old_role', v_old_role,
      'new_role', p_new_role::text
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 8. admin_reset_password() — read name from user_roles
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

-- ============================================
-- 9. get_client_ledger() — admin name from user_roles
-- ============================================

CREATE OR REPLACE FUNCTION public.get_client_ledger(
  p_user_id UUID,
  p_entry_type public.ledger_entry_type DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  wallet_id UUID,
  user_id UUID,
  entry_type public.ledger_entry_type,
  amount_xaf BIGINT,
  balance_before BIGINT,
  balance_after BIGINT,
  reference_type VARCHAR(50),
  reference_id UUID,
  description TEXT,
  metadata JSONB,
  created_by_admin_id UUID,
  created_by_admin_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (auth.uid() = p_user_id OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    le.id,
    le.wallet_id,
    le.user_id,
    le.entry_type,
    le.amount_xaf,
    le.balance_before,
    le.balance_after,
    le.reference_type,
    le.reference_id,
    le.description,
    le.metadata,
    le.created_by_admin_id,
    CASE
      WHEN le.created_by_admin_id IS NOT NULL THEN
        (SELECT CONCAT(ur.first_name, ' ', ur.last_name) FROM user_roles ur WHERE ur.user_id = le.created_by_admin_id)
      ELSE NULL
    END as created_by_admin_name,
    le.created_at
  FROM ledger_entries le
  WHERE le.user_id = p_user_id
    AND (p_entry_type IS NULL OR le.entry_type = p_entry_type)
  ORDER BY le.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- 10. Grant permissions
-- ============================================

GRANT EXECUTE ON FUNCTION public.admin_create_client TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_setup_client TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_admin_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_profile(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_last_login() TO authenticated;

NOTIFY pgrst, 'reload schema';

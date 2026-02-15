-- Fix: add extensions schema to search_path for pgcrypto (crypt/gen_salt)

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

  -- 3. Check phone uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = p_phone) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro WhatsApp est déjà utilisé par un autre client');
  END IF;

  -- 4. Build auth email
  auth_email := COALESCE(NULLIF(TRIM(p_email), ''), regexp_replace(p_phone, '[^0-9]', '', 'g') || '@bonzini-client.local');

  -- 5. Check email uniqueness in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = auth_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  END IF;

  -- 6. Generate password if not provided
  temp_password := COALESCE(NULLIF(p_password, ''),
    substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4));

  -- 7. Hash password (pgcrypto from extensions schema)
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

  -- 10. Insert into auth.identities (required for email login)
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

  -- 11. handle_new_user trigger creates profile + wallet
  -- Update profile with additional info
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

GRANT EXECUTE ON FUNCTION public.admin_create_client TO authenticated;
NOTIFY pgrst, 'reload schema';

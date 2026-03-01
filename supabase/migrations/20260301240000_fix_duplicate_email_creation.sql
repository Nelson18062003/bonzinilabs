-- ============================================================
-- Fix : "Un compte avec cet email existe déjà" sur création admin/client
--
-- CAUSE : auth.users est la source de vérité pour Supabase Auth.
-- Un enregistrement fantôme peut s'y trouver si une création a
-- partiellement échoué (INSERT dans auth.users réussi, mais INSERT
-- dans user_roles ou clients raté). L'email bloque toute nouvelle
-- création, même si la table métier est vide.
--
-- CORRECTION :
--   1. Nettoyage one-shot des comptes fantômes existants
--      (dans auth.users mais absents de user_roles ET de clients)
--   2. admin_create_admin() : distinguer 3 cas
--      - Vrai admin existant → erreur explicite
--      - Client avec cet email → erreur explicite
--      - Compte fantôme → suppression auto + création
--   3. admin_create_client() : même logique
-- ============================================================


-- ============================================================
-- 1. FIX SCHÉMA : admin_audit_logs.admin_user_id
--
-- La colonne est NOT NULL mais la FK est ON DELETE SET NULL —
-- contradiction qui empêche de supprimer un utilisateur ayant
-- des logs d'audit. On rend la colonne nullable (cohérent avec
-- la FK) : les logs historiques restent, admin_user_id devient
-- NULL si l'admin est supprimé.
-- ============================================================

ALTER TABLE public.admin_audit_logs
  ALTER COLUMN admin_user_id DROP NOT NULL;


-- ============================================================
-- 2. NETTOYAGE ONE-SHOT DES COMPTES FANTÔMES
-- ============================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Identifier les fantômes : dans auth.users mais ni dans
  -- user_roles (admin) ni dans clients (client)
  SELECT COUNT(*) INTO v_count
  FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles  ur WHERE ur.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.clients      c  WHERE c.user_id  = u.id);

  RAISE NOTICE 'Comptes fantômes dans auth.users : %', v_count;

  -- Supprimer d'abord les identities liées (FK)
  DELETE FROM auth.identities i
  WHERE EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = i.user_id
      AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM public.clients     c  WHERE c.user_id  = u.id)
  );

  -- Supprimer les comptes fantômes
  -- (les audit_logs liés auront admin_user_id mis à NULL par la FK SET NULL)
  DELETE FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.clients     c  WHERE c.user_id  = u.id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Comptes fantômes supprimés : %', v_count;
END;
$$;


-- ============================================================
-- 2. FIX admin_create_admin() — gestion intelligente des emails
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_admin(
  p_email      TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_role       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  new_user_id   UUID;
  existing_id   UUID;
  encrypted_pw  TEXT;
  temp_password TEXT;
  valid_roles   TEXT[] := ARRAY['super_admin','ops','support','customer_success','cash_agent'];
  caller_role   TEXT;
BEGIN
  -- 1. Auth check
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT role INTO caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'super_admin';

  IF caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut créer des administrateurs');
  END IF;

  -- 2. Validation des champs
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''email est requis');
  END IF;
  IF p_first_name IS NULL OR TRIM(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NULL OR TRIM(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_role IS NULL OR TRIM(p_role) = '' OR NOT p_role = ANY(valid_roles) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rôle invalide');
  END IF;

  -- 3. Vérification email — 3 cas distincts
  SELECT id INTO existing_id
  FROM auth.users
  WHERE email = LOWER(TRIM(p_email));

  IF existing_id IS NOT NULL THEN

    -- Cas A : vrai admin existant
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = existing_id) THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Un administrateur avec cet email existe déjà');
    END IF;

    -- Cas B : compte client avec cet email
    IF EXISTS (SELECT 1 FROM public.clients WHERE user_id = existing_id) THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Un compte client utilise déjà cet email. Utilisez un email différent pour l''administrateur.');
    END IF;

    -- Cas C : compte fantôme (dans auth.users, absent des tables métier)
    -- → Nettoyage automatique avant recréation
    DELETE FROM auth.identities WHERE user_id = existing_id;
    DELETE FROM auth.users      WHERE id      = existing_id;

  END IF;

  -- 4. Création du compte
  temp_password := substr(md5(random()::text), 1, 8)
               || substr(md5(random()::text), 1, 4);
  encrypted_pw  := crypt(temp_password, gen_salt('bf'));
  new_user_id   := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    is_sso_user, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated',
    LOWER(TRIM(p_email)),
    encrypted_pw,
    NOW(),
    jsonb_build_object('first_name', TRIM(p_first_name), 'last_name', TRIM(p_last_name)),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    NOW(), NOW(),
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
      'sub',            new_user_id::text,
      'email',          LOWER(TRIM(p_email)),
      'email_verified', true,
      'phone_verified', false
    ),
    NOW(), NOW(), NOW()
  );

  -- 5. Enregistrement dans user_roles (source de vérité admins)
  INSERT INTO public.user_roles (user_id, role, email, is_disabled, first_name, last_name)
  VALUES (new_user_id, p_role::public.app_role,
          LOWER(TRIM(p_email)), false,
          TRIM(p_first_name), TRIM(p_last_name));

  -- 6. Audit log
  INSERT INTO public.admin_audit_logs
    (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(), 'create_admin', 'admin_user', new_user_id,
    jsonb_build_object(
      'description', 'Création de l''admin ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name),
      'role',  p_role,
      'email', LOWER(TRIM(p_email))
    )
  );

  RETURN jsonb_build_object(
    'success',      true,
    'userId',       new_user_id,
    'email',        LOWER(TRIM(p_email)),
    'tempPassword', temp_password,
    'message',      'Admin ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name) || ' créé avec succès'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Un compte avec ces informations existe déjà');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_admin TO authenticated;


-- ============================================================
-- 3. FIX admin_create_client() — même logique
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_client(
  p_first_name TEXT,
  p_last_name  TEXT,
  p_phone      TEXT,
  p_email      TEXT    DEFAULT NULL,
  p_password   TEXT    DEFAULT NULL,
  p_gender     TEXT    DEFAULT 'OTHER',
  p_country    TEXT    DEFAULT '',
  p_city       TEXT    DEFAULT '',
  p_company    TEXT    DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  new_user_id   UUID;
  existing_id   UUID;
  encrypted_pw  TEXT;
  auth_email    TEXT;
  temp_password TEXT;
  wallet_id     UUID;
BEGIN
  -- 1. Auth check
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Seul un administrateur peut créer des clients');
  END IF;

  -- 2. Validation
  IF p_first_name IS NULL OR p_first_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NULL OR p_last_name = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le numéro WhatsApp est requis');
  END IF;

  -- 3. Unicité du téléphone dans clients
  IF EXISTS (SELECT 1 FROM public.clients WHERE phone = p_phone) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Ce numéro WhatsApp est déjà utilisé par un autre client');
  END IF;

  -- 4. Construction de l'email auth
  auth_email := COALESCE(
    NULLIF(LOWER(TRIM(p_email)), ''),
    regexp_replace(p_phone, '[^0-9]', '', 'g') || '@bonzini-client.local'
  );

  -- 5. Vérification email — 3 cas distincts
  SELECT id INTO existing_id
  FROM auth.users
  WHERE email = auth_email;

  IF existing_id IS NOT NULL THEN

    -- Cas A : vrai client existant
    IF EXISTS (SELECT 1 FROM public.clients WHERE user_id = existing_id) THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Un client avec cet email existe déjà');
    END IF;

    -- Cas B : compte admin avec cet email
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = existing_id) THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Un administrateur utilise déjà cet email. Utilisez un email ou un numéro différent.');
    END IF;

    -- Cas C : compte fantôme → nettoyage automatique
    DELETE FROM auth.identities WHERE user_id = existing_id;
    DELETE FROM auth.users      WHERE id      = existing_id;

  END IF;

  -- 6. Création du compte
  temp_password := COALESCE(
    NULLIF(p_password, ''),
    substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4)
  );
  encrypted_pw := crypt(temp_password, gen_salt('bf'));
  new_user_id  := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    is_sso_user, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated',
    auth_email, encrypted_pw,
    NOW(),
    jsonb_build_object(
      'is_client',  true,
      'first_name', TRIM(p_first_name),
      'last_name',  TRIM(p_last_name),
      'phone',      p_phone
    ),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    NOW(), NOW(),
    false, '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id, new_user_id::text, 'email',
    jsonb_build_object(
      'sub',            new_user_id::text,
      'email',          auth_email,
      'email_verified', true,
      'phone_verified', false
    ),
    NOW(), NOW(), NOW()
  );

  -- 7. Le trigger handle_new_user() crée clients + wallets automatiquement
  --    (is_client = true dans les metadata)
  --    On met à jour les champs complémentaires ensuite
  UPDATE public.clients SET
    phone        = p_phone,
    first_name   = TRIM(p_first_name),
    last_name    = TRIM(p_last_name),
    email        = auth_email,
    company_name = NULLIF(TRIM(p_company),  ''),
    gender       = COALESCE(NULLIF(TRIM(p_gender),  ''), 'OTHER'),
    country      = NULLIF(TRIM(p_country), ''),
    city         = NULLIF(TRIM(p_city),    '')
  WHERE user_id = new_user_id;

  -- 8. Récupérer l'ID wallet
  SELECT id INTO wallet_id FROM public.wallets WHERE user_id = new_user_id;

  -- 9. Audit log
  INSERT INTO public.admin_audit_logs
    (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    auth.uid(), 'create_client', 'client', new_user_id,
    jsonb_build_object(
      'description', 'Création du client ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name),
      'firstName',   TRIM(p_first_name),
      'lastName',    TRIM(p_last_name),
      'phone',       p_phone,
      'email',       p_email,
      'country',     p_country,
      'city',        p_city,
      'gender',      p_gender,
      'company',     p_company
    )
  );

  RETURN jsonb_build_object(
    'success',      true,
    'clientId',     new_user_id,
    'walletId',     wallet_id,
    'authEmail',    auth_email,
    'tempPassword', temp_password,
    'message', 'Client ' || TRIM(p_first_name) || ' ' || TRIM(p_last_name) || ' créé avec succès'
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Un compte avec ces informations existe déjà');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_client FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_client TO authenticated;

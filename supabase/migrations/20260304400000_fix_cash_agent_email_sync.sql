-- Fix cash agent email: sync lina@bonzini.com across auth.users, auth.identities, and user_roles
-- This fixes the issue where the email was changed in one place but not the others

DO $$
DECLARE
  v_user_id UUID;
  v_new_email TEXT := 'lina@bonzini.com';
BEGIN
  -- Find the cash_agent user_id from user_roles
  SELECT user_id INTO v_user_id
  FROM public.user_roles
  WHERE role = 'cash_agent'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No cash_agent found in user_roles';
    RETURN;
  END IF;

  RAISE NOTICE 'Fixing email for cash_agent user_id: %', v_user_id;

  -- 1. Update auth.users
  UPDATE auth.users
  SET email = v_new_email,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- 2. Update auth.identities (identity_data contains the email used by GoTrue)
  UPDATE auth.identities
  SET identity_data = identity_data || jsonb_build_object('email', v_new_email),
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND provider = 'email';

  -- 3. Update user_roles.email
  UPDATE public.user_roles
  SET email = v_new_email
  WHERE user_id = v_user_id;

  RAISE NOTICE 'Email updated to % in auth.users, auth.identities, and user_roles', v_new_email;
END;
$$;

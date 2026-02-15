-- Simple RPC to finalize client setup after auth.signUp()
-- This only does UPDATEs (no complex INSERT into auth tables)

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
  -- 1. Verify caller is an admin
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- 2. Confirm email (in case email confirmation is enabled)
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
  WHERE id = p_user_id;

  -- 3. Update profile with phone and additional info
  UPDATE public.profiles
  SET phone = p_phone,
      first_name = TRIM(p_first_name),
      last_name = TRIM(p_last_name),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 4. Get wallet ID (created by handle_new_user trigger)
  SELECT id INTO wallet_id FROM public.wallets WHERE user_id = p_user_id;

  -- 5. Log action
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

  RETURN jsonb_build_object(
    'success', true,
    'walletId', wallet_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_setup_client TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

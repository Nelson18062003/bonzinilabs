-- ============================================================
-- Migration: Fix handle_new_user to save email in clients table
-- + Backfill missing emails from auth.users
-- ============================================================

-- 1. Update handle_new_user to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ->> 'is_client' = 'true' THEN
    -- Insert into the clients table (source of truth)
    INSERT INTO public.clients (user_id, first_name, last_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Utilisateur'),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'phone',
      NEW.email
    );

    -- Create wallet
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Backfill missing emails from auth.users into clients
UPDATE public.clients c
SET email = u.email
FROM auth.users u
WHERE c.user_id = u.id
  AND (c.email IS NULL OR c.email = '');

NOTIFY pgrst, 'reload schema';

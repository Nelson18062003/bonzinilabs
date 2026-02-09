-- Migration: Fix Admin/Client Separation
-- Date: 2026-02-09
-- Problem: Admin login creates client profiles automatically
-- Solution: Only create profile/wallet for users with is_client metadata flag

-- Replace the handle_new_user function to be conditional
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- ONLY create profile and wallet if the user is registering as a CLIENT
  -- Admin users should NOT have automatic profile/wallet creation
  -- The flag 'is_client' must be explicitly set during client signup

  IF NEW.raw_user_meta_data ->> 'is_client' = 'true' THEN
    -- Create profile for client users only
    INSERT INTO public.profiles (user_id, first_name, last_name, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Utilisateur'),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'phone'
    );

    -- Create wallet for client users only
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (NEW.id, 0);
  END IF;

  RETURN NEW;
END;
$$;

-- Note: The trigger on_auth_user_created already exists, it will now use the updated function
-- No need to recreate the trigger

-- Clean up any orphan profiles created for admin users
-- (profiles without corresponding client data - only have user_roles entry)
-- This is a safety query - run manually if needed to clean up existing data
-- DO NOT run automatically as it could delete valid data

-- To manually clean up orphan admin profiles, run:
-- DELETE FROM profiles p
-- WHERE EXISTS (
--   SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id
-- )
-- AND NOT EXISTS (
--   SELECT 1 FROM deposits d WHERE d.user_id = p.user_id
-- )
-- AND NOT EXISTS (
--   SELECT 1 FROM payments pay WHERE pay.user_id = p.user_id
-- )
-- AND p.first_name = 'Utilisateur';

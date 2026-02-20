-- ============================================================
-- Security Fix: is_admin() must exclude disabled admin accounts
-- Without this, a disabled admin's JWT remains valid and can call
-- all SECURITY DEFINER RPCs until the token expires (~1h)
-- ============================================================

-- Update is_admin() to also check is_disabled = false
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (is_disabled = false OR is_disabled IS NULL)
  )
$$;

COMMENT ON FUNCTION public.is_admin IS 'Returns true if user is a non-disabled admin. Disabled admins are denied access even if their JWT is still valid.';

NOTIFY pgrst, 'reload schema';

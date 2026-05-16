-- ============================================================
-- Treasury Lot 2 — Add the treasurer role
--
-- Extends the app_role enum so a dedicated treasurer account can
-- be issued (Bonzini father's profile). The new role:
--   * can_access_treasury() => TRUE (already handled by Lot 1
--     helper, which compared role::text — adding the enum value
--     activates it automatically)
--   * is_admin() => TRUE (any user_roles row that isn't disabled
--     counts as admin, regardless of which role)
--   * does NOT inherit canManageUsers / payment processing etc.;
--     those are enforced client-side via the ROLE_PERMISSIONS
--     matrix (extended in the same lot)
--
-- Adds a helper is_treasurer() for explicit checks in upcoming
-- RPCs (Lot 3). Voiding logic in Lot 3 will require super_admin
-- specifically, not just any treasury access.
-- ============================================================

-- ── 1. Extend the enum ──
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'treasurer';

-- ── 2. Explicit treasurer check helper ──
-- Separate from can_access_treasury() (which allows super_admin)
-- so RPCs can distinguish "treasurer only" use cases later if
-- ever needed. For now both helpers coexist.
CREATE OR REPLACE FUNCTION public.is_treasurer(_user_id UUID)
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
      AND role::text = 'treasurer'
  )
$$;

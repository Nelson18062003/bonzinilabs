-- Migration: Admin Management Module
-- Date: 2026-02-10
-- Feature: Allow Super Admin to manage other admin users

-- ============================================
-- 1. Add columns to user_roles table
-- ============================================

-- Add is_disabled column for enabling/disabling admin accounts
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add last_login_at column for tracking admin logins
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Add email column to store admin email (for easier queries without joining auth.users)
ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_user_roles_role_disabled
ON public.user_roles(role, is_disabled);

CREATE INDEX IF NOT EXISTS idx_user_roles_email
ON public.user_roles(email);

-- ============================================
-- 2. RPC Function: Toggle Admin Status
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
  -- Get the caller's user ID
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- Prevent self-disable
  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre statut');
  END IF;

  -- Check if caller is super_admin
  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = v_caller_id;

  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  END IF;

  -- Check if target exists
  SELECT role INTO v_target_role
  FROM user_roles
  WHERE user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Get target name for logging
  SELECT COALESCE(first_name || ' ' || last_name, 'Admin') INTO v_target_name
  FROM profiles
  WHERE user_id = p_target_user_id;

  -- Update the status
  UPDATE user_roles
  SET is_disabled = p_disabled
  WHERE user_id = p_target_user_id;

  -- Log the action
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
-- 3. RPC Function: Update Admin Role
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
  -- Get the caller's user ID
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- Prevent self-role modification
  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre rôle');
  END IF;

  -- Check if caller is super_admin
  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = v_caller_id;

  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  END IF;

  -- Get old role and check if target exists
  SELECT role INTO v_old_role
  FROM user_roles
  WHERE user_id = p_target_user_id;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Get target name for logging
  SELECT COALESCE(first_name || ' ' || last_name, 'Admin') INTO v_target_name
  FROM profiles
  WHERE user_id = p_target_user_id;

  -- Update the role
  UPDATE user_roles
  SET role = p_new_role
  WHERE user_id = p_target_user_id;

  -- Log the action
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
-- 4. RPC Function: Update Admin Profile
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
  -- Get the caller's user ID
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- Check if caller is super_admin
  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = v_caller_id;

  IF v_caller_role != 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  END IF;

  -- Check if target exists
  SELECT role INTO v_target_role
  FROM user_roles
  WHERE user_id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  END IF;

  -- Update the profile
  UPDATE profiles
  SET
    first_name = p_first_name,
    last_name = p_last_name
  WHERE user_id = p_target_user_id;

  -- Log the action
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
-- 5. RPC Function: Update Last Login
-- ============================================

CREATE OR REPLACE FUNCTION public.update_admin_last_login()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE user_roles
  SET last_login_at = NOW()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 6. Grant execute permissions
-- ============================================

GRANT EXECUTE ON FUNCTION public.toggle_admin_status(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_profile(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_last_login() TO authenticated;

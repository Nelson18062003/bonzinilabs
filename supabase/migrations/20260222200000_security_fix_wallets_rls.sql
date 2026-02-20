-- ============================================================
-- Security Fix: Restrict wallet UPDATE/DELETE to SECURITY DEFINER RPCs only
-- Previously, any admin could directly UPDATE wallets via supabaseAdmin.from('wallets').update(...)
-- This allows a rogue admin to credit/debit arbitrary amounts bypassing business logic
-- All legitimate wallet mutations go through SECURITY DEFINER RPCs which bypass RLS
-- ============================================================

-- Remove the overly permissive admin UPDATE policy
DROP POLICY IF EXISTS "System can update wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins can update wallets" ON public.wallets;

-- Remove any INSERT policy that allows admins to insert directly
-- (wallet creation should only happen via RPC/trigger on user registration)
DROP POLICY IF EXISTS "System can insert wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins can insert wallets" ON public.wallets;

-- Wallets: clients can only read their own wallet, no direct write
-- All writes go through SECURITY DEFINER RPCs (which bypass RLS)
CREATE POLICY "clients_select_own_wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_wallets"
  ON public.wallets FOR SELECT
  USING (public.is_admin(auth.uid()));

-- No direct INSERT or UPDATE or DELETE policies for wallets
-- All mutations are performed by SECURITY DEFINER functions which bypass RLS
-- This prevents any admin from directly manipulating wallet balances

NOTIFY pgrst, 'reload schema';

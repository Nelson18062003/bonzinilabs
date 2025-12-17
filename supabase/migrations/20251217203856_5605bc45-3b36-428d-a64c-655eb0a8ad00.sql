-- Temporarily disable RLS for development mode
-- This allows operations without Supabase auth

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users can create their own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Admins can view all deposits" ON public.deposits;
DROP POLICY IF EXISTS "Admins can update deposits" ON public.deposits;

DROP POLICY IF EXISTS "Users can view their own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can view their own wallet operations" ON public.wallet_operations;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their deposit proofs" ON public.deposit_proofs;
DROP POLICY IF EXISTS "Users can upload their deposit proofs" ON public.deposit_proofs;

DROP POLICY IF EXISTS "Users can view their deposit timeline" ON public.deposit_timeline_events;
DROP POLICY IF EXISTS "Users can create timeline events" ON public.deposit_timeline_events;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can create audit logs" ON public.admin_audit_logs;

DROP POLICY IF EXISTS "Admins can manage exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create permissive policies for development
-- Deposits
CREATE POLICY "Allow all deposits operations" ON public.deposits FOR ALL USING (true) WITH CHECK (true);

-- Wallets  
CREATE POLICY "Allow all wallets operations" ON public.wallets FOR ALL USING (true) WITH CHECK (true);

-- Wallet operations
CREATE POLICY "Allow all wallet_operations" ON public.wallet_operations FOR ALL USING (true) WITH CHECK (true);

-- Profiles
CREATE POLICY "Allow all profiles operations" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Deposit proofs
CREATE POLICY "Allow all deposit_proofs operations" ON public.deposit_proofs FOR ALL USING (true) WITH CHECK (true);

-- Timeline events
CREATE POLICY "Allow all timeline operations" ON public.deposit_timeline_events FOR ALL USING (true) WITH CHECK (true);

-- Audit logs
CREATE POLICY "Allow all audit_logs operations" ON public.admin_audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Exchange rates
CREATE POLICY "Allow all rates operations" ON public.exchange_rates FOR ALL USING (true) WITH CHECK (true);

-- User roles
CREATE POLICY "Allow all user_roles operations" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);
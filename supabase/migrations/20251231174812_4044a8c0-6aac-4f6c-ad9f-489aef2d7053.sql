-- Remove all dangerous "Allow all" policies that expose sensitive data publicly

-- 1. Profiles - Remove public access to personal information
DROP POLICY IF EXISTS "Allow all profiles operations" ON public.profiles;

-- 2. Wallets - Remove public access to financial balances
DROP POLICY IF EXISTS "Allow all wallets operations" ON public.wallets;

-- 3. Wallet Operations - Remove public access to transaction history
DROP POLICY IF EXISTS "Allow all wallet_operations" ON public.wallet_operations;

-- 4. Deposits - Remove public access to banking information
DROP POLICY IF EXISTS "Allow all deposits operations" ON public.deposits;

-- 5. Deposit Proofs - Remove public access to financial documents
DROP POLICY IF EXISTS "Allow all deposit_proofs operations" ON public.deposit_proofs;

-- 6. Admin Audit Logs - Remove public access to admin actions
DROP POLICY IF EXISTS "Allow all audit_logs operations" ON public.admin_audit_logs;

-- 7. Deposit Timeline Events - Remove public access to deposit processing
DROP POLICY IF EXISTS "Allow all timeline operations" ON public.deposit_timeline_events;

-- 8. Exchange Rates - Replace "Allow all" with SELECT-only for public access
DROP POLICY IF EXISTS "Allow all rates operations" ON public.exchange_rates;

-- Add admin policies for deposits that were missing
CREATE POLICY "Admins can view all deposits"
ON public.deposits
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update deposits"
ON public.deposits
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert deposits for clients"
ON public.deposits
FOR INSERT
WITH CHECK (is_admin(auth.uid()));
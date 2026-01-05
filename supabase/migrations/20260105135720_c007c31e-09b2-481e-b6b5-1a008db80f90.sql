-- Add indexes for frequently queried columns to improve performance

-- Index on deposits table
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON public.deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON public.deposits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON public.deposits(user_id, status);

-- Index on payments table
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);

-- Index on wallets table
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_updated_at ON public.wallets(updated_at DESC);

-- Index on wallet_operations table
CREATE INDEX IF NOT EXISTS idx_wallet_operations_wallet_id ON public.wallet_operations(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_operations_created_at ON public.wallet_operations(created_at DESC);

-- Index on profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Index on deposit_proofs table
CREATE INDEX IF NOT EXISTS idx_deposit_proofs_deposit_id ON public.deposit_proofs(deposit_id);

-- Index on payment_proofs table
CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_id ON public.payment_proofs(payment_id);

-- Index on exchange_rates table
CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_date ON public.exchange_rates(effective_date DESC);

-- Index on admin_audit_logs table
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON public.admin_audit_logs(admin_user_id);

-- Index on user_roles table
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Index on timeline events
CREATE INDEX IF NOT EXISTS idx_deposit_timeline_deposit_id ON public.deposit_timeline_events(deposit_id);
CREATE INDEX IF NOT EXISTS idx_payment_timeline_payment_id ON public.payment_timeline_events(payment_id);

-- Create enum types for roles and statuses
CREATE TYPE public.app_role AS ENUM ('super_admin', 'ops', 'support', 'customer_success');
CREATE TYPE public.deposit_status AS ENUM ('created', 'awaiting_proof', 'proof_submitted', 'admin_review', 'validated', 'rejected');
CREATE TYPE public.deposit_method AS ENUM ('bank_transfer', 'bank_cash', 'agency_cash', 'om_transfer', 'om_withdrawal', 'mtn_transfer', 'mtn_withdrawal', 'wave');
CREATE TYPE public.wallet_operation_type AS ENUM ('deposit', 'payment', 'adjustment');

-- User profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance_xaf BIGINT NOT NULL DEFAULT 0 CHECK (balance_xaf >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deposits table
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  amount_xaf BIGINT NOT NULL CHECK (amount_xaf > 0),
  method deposit_method NOT NULL,
  bank_name TEXT,
  agency_name TEXT,
  client_phone TEXT,
  status deposit_status NOT NULL DEFAULT 'created',
  admin_comment TEXT,
  rejection_reason TEXT,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deposit proofs table
CREATE TABLE public.deposit_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID REFERENCES public.deposits(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Deposit timeline events
CREATE TABLE public.deposit_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id UUID REFERENCES public.deposits(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Wallet operations (ledger)
CREATE TABLE public.wallet_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  operation_type wallet_operation_type NOT NULL,
  amount_xaf BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin audit logs
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Exchange rates table
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_xaf_to_rmb DECIMAL(10, 6) NOT NULL,
  effective_date DATE NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposit_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
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
      AND role = _role
  )
$$;

-- Function to check if user is any admin
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
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- User roles policies (only super_admin can manage)
CREATE POLICY "Admins can view roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- Wallets policies
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON public.wallets FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can update wallets"
  ON public.wallets FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert wallets"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Deposits policies
CREATE POLICY "Users can view own deposits"
  ON public.deposits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own deposits"
  ON public.deposits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all deposits"
  ON public.deposits FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update deposits"
  ON public.deposits FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Deposit proofs policies
CREATE POLICY "Users can view own deposit proofs"
  ON public.deposit_proofs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Users can upload proofs for own deposits"
  ON public.deposit_proofs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all proofs"
  ON public.deposit_proofs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Timeline events policies
CREATE POLICY "Users can view own deposit timeline"
  ON public.deposit_timeline_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_id AND d.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all timelines"
  ON public.deposit_timeline_events FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert timeline events"
  ON public.deposit_timeline_events FOR INSERT
  WITH CHECK (true);

-- Wallet operations policies
CREATE POLICY "Users can view own wallet operations"
  ON public.wallet_operations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.id = wallet_id AND w.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all wallet operations"
  ON public.wallet_operations FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert wallet operations"
  ON public.wallet_operations FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin audit logs policies
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Exchange rates policies
CREATE POLICY "Anyone can view exchange rates"
  ON public.exchange_rates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage exchange rates"
  ON public.exchange_rates FOR ALL
  USING (public.is_admin(auth.uid()));

-- Function to validate deposit and update wallet
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;
  
  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already validated');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;
  
  IF v_wallet IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (v_deposit.user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;
  
  v_new_balance := v_wallet.balance_xaf + v_deposit.amount_xaf;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Update deposit status
  UPDATE public.deposits
  SET status = 'validated',
      validated_by = v_admin_id,
      validated_at = now(),
      admin_comment = p_admin_comment,
      updated_at = now()
  WHERE id = p_deposit_id;
  
  -- Create wallet operation
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by
  ) VALUES (
    v_wallet.id, 'deposit', v_deposit.amount_xaf, v_wallet.balance_xaf, v_new_balance,
    p_deposit_id, 'deposit', 'Dépôt validé - ' || v_deposit.reference, v_admin_id
  );
  
  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'validated', 'Dépôt validé par l''équipe Bonzini', v_admin_id);
  
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'wallet_credited', 'Solde mis à jour: +' || v_deposit.amount_xaf || ' XAF', v_admin_id);
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_credited', v_deposit.amount_xaf
  );
END;
$$;

-- Function to reject deposit
CREATE OR REPLACE FUNCTION public.reject_deposit(
  p_deposit_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;
  
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;
  
  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot reject validated deposit');
  END IF;
  
  -- Update deposit status
  UPDATE public.deposits
  SET status = 'rejected',
      rejection_reason = p_reason,
      validated_by = v_admin_id,
      validated_at = now(),
      updated_at = now()
  WHERE id = p_deposit_id;
  
  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'rejected', 'Dépôt refusé: ' || p_reason, v_admin_id);
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'reject_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'reason', p_reason
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Nouveau'),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', 'Client')
  );
  
  INSERT INTO public.wallets (user_id, balance_xaf)
  VALUES (NEW.id, 0);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate deposit reference function
CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.deposits
  WHERE created_at >= date_trunc('year', now());
  
  v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_count::text, 4, '0');
  
  RETURN v_reference;
END;
$$;

-- Insert default exchange rate
INSERT INTO public.exchange_rates (rate_xaf_to_rmb, effective_date)
VALUES (0.01167, CURRENT_DATE);

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix function search path for generate_deposit_reference
CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.deposits
  WHERE created_at >= date_trunc('year', now());
  
  v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_count::text, 4, '0');
  
  RETURN v_reference;
END;
$$;

-- Create storage bucket for deposit proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-proofs', 'deposit-proofs', false);

-- Policies for deposit proofs bucket
CREATE POLICY "Users can upload own deposit proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own deposit proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deposit-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all deposit proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deposit-proofs' 
  AND public.is_admin(auth.uid())
);
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
CREATE POLICY "Allow all user_roles operations" ON public.user_roles FOR ALL USING (true) WITH CHECK (true);-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Admins can manage exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins can update wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins can insert wallets" ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallet operations" ON public.wallet_operations;
DROP POLICY IF EXISTS "Admins can insert wallet operations" ON public.wallet_operations;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Exchange rates policies (public read)
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage exchange rates" ON public.exchange_rates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- User roles policies
CREATE POLICY "Admins can view user roles" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  );

-- Admin audit logs policies
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- Admin policies for wallets and wallet operations
CREATE POLICY "Admins can view all wallets" ON public.wallets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update wallets" ON public.wallets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert wallets" ON public.wallets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all wallet operations" ON public.wallet_operations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can insert wallet operations" ON public.wallet_operations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- Admin policies for profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

-- Create trigger to auto-create wallet and profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  
  -- Create wallet
  INSERT INTO public.wallets (user_id, balance_xaf)
  VALUES (NEW.id, 0);
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();-- Rendre le bucket public pour que les preuves soient accessibles
UPDATE storage.buckets SET public = true WHERE id = 'deposit-proofs';

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can upload proofs for their deposits" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view deposit proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all proofs" ON storage.objects;

-- Policy: Les utilisateurs peuvent uploader des preuves pour leurs propres dépôts
CREATE POLICY "Users can upload proofs for their deposits"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Tout le monde peut voir les preuves (le bucket est public)
CREATE POLICY "Anyone can view deposit proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'deposit-proofs');

-- Policy: Les utilisateurs peuvent supprimer leurs propres preuves
CREATE POLICY "Users can delete their own proofs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'deposit-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);-- Fix infinite recursion in RLS policies for public.user_roles
-- Root cause: a policy referenced public.user_roles from within a policy on public.user_roles.

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Remove existing policies (some may be restrictive and still evaluated, causing recursion)
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow all user_roles operations" ON public.user_roles;

-- Read access
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Write access (only super_admin)
CREATE POLICY "Super admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));
-- Add new fields to profiles table for extended user information
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_of_birth date,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS activity_sector text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS country text;

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User date of birth (optional)';
COMMENT ON COLUMN public.profiles.company_name IS 'User company name (optional)';
COMMENT ON COLUMN public.profiles.activity_sector IS 'User activity sector (optional)';
COMMENT ON COLUMN public.profiles.neighborhood IS 'User neighborhood/quartier (optional)';
COMMENT ON COLUMN public.profiles.city IS 'User city (optional)';
COMMENT ON COLUMN public.profiles.country IS 'User country (optional)';-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('alipay', 'wechat', 'bank_transfer', 'cash');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM (
  'created',
  'waiting_beneficiary_info',
  'ready_for_payment',
  'processing',
  'completed',
  'rejected'
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reference TEXT NOT NULL,
  amount_xaf BIGINT NOT NULL,
  amount_rmb NUMERIC(15,2) NOT NULL,
  exchange_rate NUMERIC(15,6) NOT NULL,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'created',
  
  -- Beneficiary info (depends on method)
  beneficiary_name TEXT,
  beneficiary_phone TEXT,
  beneficiary_email TEXT,
  beneficiary_qr_code_url TEXT,
  beneficiary_bank_name TEXT,
  beneficiary_bank_account TEXT,
  beneficiary_notes TEXT,
  
  -- Cash specific
  cash_qr_code TEXT,
  
  -- Admin fields
  processed_by UUID,
  processed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  admin_comment TEXT,
  client_visible_comment TEXT,
  
  -- Balance tracking
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment proofs table
CREATE TABLE public.payment_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('client', 'admin')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment timeline events table
CREATE TABLE public.payment_timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments beneficiary info" ON public.payments
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('created', 'waiting_beneficiary_info'));

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE USING (is_admin(auth.uid()));

-- RLS Policies for payment_proofs
CREATE POLICY "Users can view own payment proofs" ON public.payment_proofs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM payments p WHERE p.id = payment_proofs.payment_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can upload proofs for own payments" ON public.payment_proofs
  FOR INSERT WITH CHECK (
    uploaded_by_type = 'client' AND
    EXISTS (SELECT 1 FROM payments p WHERE p.id = payment_proofs.payment_id AND p.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all payment proofs" ON public.payment_proofs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can upload payment proofs" ON public.payment_proofs
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- RLS Policies for payment_timeline_events
CREATE POLICY "Users can view own payment timeline" ON public.payment_timeline_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM payments p WHERE p.id = payment_timeline_events.payment_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all payment timelines" ON public.payment_timeline_events
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "System can insert payment timeline events" ON public.payment_timeline_events
  FOR INSERT WITH CHECK (true);

-- Create function to generate payment reference
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.payments
  WHERE created_at >= date_trunc('year', now());
  
  v_reference := 'BZ-PY-' || v_year || '-' || lpad(v_count::text, 4, '0');
  
  RETURN v_reference;
END;
$$;

-- Create function to create payment with balance deduction
CREATE OR REPLACE FUNCTION public.create_payment(
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  
  -- Generate reference
  v_reference := generate_payment_reference();
  
  -- Determine initial status based on beneficiary info
  v_has_beneficiary_info := (
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );
  
  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;
  
  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after
  ) VALUES (
    v_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance
  ) RETURNING id INTO v_payment_id;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create wallet operation
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by
  ) VALUES (
    v_wallet.id, 'payment', p_amount_xaf, v_wallet.balance_xaf, v_new_balance,
    v_payment_id, 'payment', 'Paiement ' || v_reference, v_user_id
  );
  
  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_payment_id, 'created', 'Paiement créé - Montant réservé', v_user_id);
  
  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_user_id);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$$;

-- Create function to process payment (admin)
CREATE OR REPLACE FUNCTION public.process_payment(p_payment_id UUID, p_action TEXT, p_comment TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  IF p_action = 'start_processing' THEN
    IF v_payment.status NOT IN ('ready_for_payment') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement ne peut pas être traité');
    END IF;
    
    UPDATE public.payments
    SET status = 'processing', processed_by = v_admin_id, updated_at = now()
    WHERE id = p_payment_id;
    
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'processing', 'Paiement en cours de traitement', v_admin_id);
    
  ELSIF p_action = 'complete' THEN
    IF v_payment.status NOT IN ('processing') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement doit être en cours de traitement');
    END IF;
    
    UPDATE public.payments
    SET status = 'completed', processed_at = now(), client_visible_comment = p_comment, updated_at = now()
    WHERE id = p_payment_id;
    
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'completed', 'Paiement effectué avec succès', v_admin_id);
    
  ELSIF p_action = 'reject' THEN
    IF v_payment.status = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Impossible de refuser un paiement déjà effectué');
    END IF;
    
    IF p_comment IS NULL OR p_comment = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une raison est requise pour le refus');
    END IF;
    
    -- Refund the balance
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id;
    
    -- Record the refund operation
    INSERT INTO public.wallet_operations (
      wallet_id, operation_type, amount_xaf, balance_before, balance_after,
      reference_id, reference_type, description, performed_by
    )
    SELECT 
      w.id, 'refund', v_payment.amount_xaf, w.balance_xaf - v_payment.amount_xaf, w.balance_xaf,
      p_payment_id, 'payment_refund', 'Remboursement paiement refusé - ' || v_payment.reference, v_admin_id
    FROM public.wallets w WHERE w.user_id = v_payment.user_id;
    
    UPDATE public.payments
    SET status = 'rejected', rejection_reason = p_comment, processed_by = v_admin_id, processed_at = now(), updated_at = now()
    WHERE id = p_payment_id;
    
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'rejected', 'Paiement refusé: ' || p_comment, v_admin_id);
    
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Action non reconnue');
  END IF;
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, p_action || '_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'amount_xaf', v_payment.amount_xaf,
      'amount_rmb', v_payment.amount_rmb,
      'user_id', v_payment.user_id,
      'comment', p_comment
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true);

-- Storage policies for payment proofs
CREATE POLICY "Users can upload payment proofs" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'payment-proofs' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Anyone can view payment proofs" ON storage.objects
FOR SELECT USING (bucket_id = 'payment-proofs');

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_timeline_events;-- Restrict payment proofs so only admins can add them (clients can only view)
DROP POLICY IF EXISTS "Users can upload proofs for own payments" ON public.payment_proofs;
-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update own payments beneficiary info" ON public.payments;

-- Create a new policy that allows users to update their payments
-- when status is 'created' or 'waiting_beneficiary_info'
-- and allows them to set status to 'ready_for_payment' when adding beneficiary info
CREATE POLICY "Users can update own payments beneficiary info" 
ON public.payments 
FOR UPDATE 
USING (
  (auth.uid() = user_id) AND 
  (status = ANY (ARRAY['created'::payment_status, 'waiting_beneficiary_info'::payment_status]))
)
WITH CHECK (
  (auth.uid() = user_id) AND 
  (status = ANY (ARRAY['created'::payment_status, 'waiting_beneficiary_info'::payment_status, 'ready_for_payment'::payment_status]))
);-- Function to manually adjust a client's wallet (credit or debit)
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount BIGINT,
  p_adjustment_type TEXT, -- 'credit' or 'debit'
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_operation_amount BIGINT;
  v_description TEXT;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Validate inputs
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;
  
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif est obligatoire');
  END IF;
  
  IF p_adjustment_type NOT IN ('credit', 'debit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''ajustement invalide');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;
  
  -- Calculate new balance
  IF p_adjustment_type = 'credit' THEN
    v_new_balance := v_wallet.balance_xaf + p_amount;
    v_operation_amount := p_amount;
    v_description := 'Crédit manuel: ' || p_reason;
  ELSE
    -- Check if sufficient balance for debit
    IF v_wallet.balance_xaf < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce débit');
    END IF;
    v_new_balance := v_wallet.balance_xaf - p_amount;
    v_operation_amount := p_amount;
    v_description := 'Débit manuel: ' || p_reason;
  END IF;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create wallet operation record
  INSERT INTO public.wallet_operations (
    wallet_id,
    operation_type,
    amount_xaf,
    balance_before,
    balance_after,
    description,
    performed_by
  ) VALUES (
    v_wallet.id,
    'adjustment',
    v_operation_amount,
    v_wallet.balance_xaf,
    v_new_balance,
    v_description,
    v_admin_id
  );
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'wallet_adjustment_' || p_adjustment_type,
    'wallet',
    v_wallet.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'amount', p_amount,
      'type', p_adjustment_type,
      'reason', p_reason,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount', p_amount,
    'type', p_adjustment_type
  );
END;
$$;-- Add INSERT policy for admins on deposit_proofs
CREATE POLICY "Admins can insert deposit proofs"
ON public.deposit_proofs
FOR INSERT
WITH CHECK (is_admin(auth.uid()));-- Allow admins to upload/delete files in deposit-proofs bucket (Storage)
-- Needed because admin uploads use path: admin/<depositId>/...

CREATE POLICY "Admins can upload deposit proofs files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-proofs'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete deposit proofs files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'deposit-proofs'
  AND public.is_admin(auth.uid())
);-- Fix the generate_deposit_reference function to avoid duplicates
-- Use a sequence-based approach with retry mechanism

CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  -- Get the maximum reference number for this year
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(reference, '^BZ-DP-' || v_year || '-', ''),
        reference
      )::int
    ),
    0
  ) + 1 INTO v_max_num
  FROM public.deposits
  WHERE reference LIKE 'BZ-DP-' || v_year || '-%';
  
  v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
  
  RETURN v_reference;
END;
$function$;-- Update validate_deposit function to use deposit's created_at date for wallet operations
CREATE OR REPLACE FUNCTION public.validate_deposit(p_deposit_id uuid, p_admin_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;
  
  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  
  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already validated');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;
  
  IF v_wallet IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (v_deposit.user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;
  
  v_new_balance := v_wallet.balance_xaf + v_deposit.amount_xaf;
  
  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Update deposit status
  UPDATE public.deposits
  SET status = 'validated',
      validated_by = v_admin_id,
      validated_at = now(),
      admin_comment = p_admin_comment,
      updated_at = now()
  WHERE id = p_deposit_id;
  
  -- Create wallet operation with deposit's created_at date (not validation date)
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by, created_at
  ) VALUES (
    v_wallet.id, 'deposit', v_deposit.amount_xaf, v_wallet.balance_xaf, v_new_balance,
    p_deposit_id, 'deposit', 'Depot valide - ' || v_deposit.reference, v_admin_id,
    v_deposit.created_at  -- Use the deposit's original date
  );
  
  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'validated', 'Depot valide par l''equipe Bonzini', v_admin_id);
  
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'wallet_credited', 'Solde mis a jour: +' || v_deposit.amount_xaf || ' XAF', v_admin_id);
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_credited', v_deposit.amount_xaf
  );
END;
$function$;
-- Function to create a payment for a client (admin only)
-- This function:
-- 1. Validates admin has access
-- 2. Creates the payment with immediate debit from client wallet
-- 3. Supports custom exchange rate
-- 4. Supports desired payment date
-- 5. Handles all payment methods including QR code uploads

CREATE OR REPLACE FUNCTION public.create_admin_payment(
  p_user_id UUID,
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL,
  p_client_visible_comment TEXT DEFAULT NULL,
  p_desired_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Validate inputs
  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;
  
  -- Check balance
  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde client insuffisant');
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  
  -- Generate reference
  v_reference := generate_payment_reference();
  
  -- Determine initial status based on beneficiary info
  v_has_beneficiary_info := (
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );
  
  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;
  
  -- Use desired date or now
  v_created_at := COALESCE(p_desired_date, now());
  
  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after, client_visible_comment, created_at
  ) VALUES (
    p_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance, p_client_visible_comment, v_created_at
  ) RETURNING id INTO v_payment_id;
  
  -- Update wallet balance (immediate debit/reservation)
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;
  
  -- Create wallet operation with the desired date
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by, created_at
  ) VALUES (
    v_wallet.id, 'payment', p_amount_xaf, v_wallet.balance_xaf, v_new_balance,
    v_payment_id, 'payment', 'Paiement ' || v_reference, v_admin_id, v_created_at
  );
  
  -- Add timeline event for creation
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
  VALUES (v_payment_id, 'created', 'Paiement créé par l''équipe Bonzini - Montant réservé', v_admin_id, v_created_at);
  
  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id, v_created_at);
  END IF;
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_for_client', 'payment', v_payment_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'method', p_method,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$$;

-- Function to delete a payment (admin only)
-- Only allowed if payment is not completed
-- Refunds the balance if payment was debited
CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_payment RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- Cannot delete completed payments
  IF v_payment.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer un paiement effectué');
  END IF;
  
  -- Refund the balance if not rejected (rejected payments are already refunded)
  IF v_payment.status != 'rejected' THEN
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id;
    
    -- Record the refund operation
    INSERT INTO public.wallet_operations (
      wallet_id, operation_type, amount_xaf, balance_before, balance_after,
      reference_id, reference_type, description, performed_by
    )
    SELECT 
      w.id, 'adjustment', v_payment.amount_xaf, w.balance_xaf - v_payment.amount_xaf, w.balance_xaf,
      p_payment_id, 'payment_deleted', 'Remboursement paiement supprimé - ' || v_payment.reference, v_admin_id
    FROM public.wallets w WHERE w.user_id = v_payment.user_id;
  END IF;
  
  -- Delete related records
  DELETE FROM public.payment_timeline_events WHERE payment_id = p_payment_id;
  DELETE FROM public.payment_proofs WHERE payment_id = p_payment_id;
  DELETE FROM public.payments WHERE id = p_payment_id;
  
  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference', v_payment.reference,
      'amount_xaf', v_payment.amount_xaf,
      'user_id', v_payment.user_id,
      'status_at_deletion', v_payment.status
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to delete a payment proof (admin only)
-- Only allowed if payment is not in processing or completed status
CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
  v_payment RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Get proof
  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id;
  
  IF v_proof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preuve non trouvée');
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = v_proof.payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- Cannot delete proofs if payment is processing or completed
  IF v_payment.status IN ('processing', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer les preuves d''un paiement en cours ou effectué');
  END IF;
  
  -- Delete the proof
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;
  
  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Add RLS policy to allow admins to delete payment proofs
CREATE POLICY "Admins can delete payment proofs"
ON public.payment_proofs
FOR DELETE
USING (is_admin(auth.uid()));

-- Add RLS policy to allow admins to delete payments
CREATE POLICY "Admins can delete payments"
ON public.payments
FOR DELETE
USING (is_admin(auth.uid()));

-- Add RLS policy to allow admins to delete payment timeline events
CREATE POLICY "Admins can delete payment timeline events"
ON public.payment_timeline_events
FOR DELETE
USING (is_admin(auth.uid()));
-- Add timestamp to exchange_rates for intraday rates
ALTER TABLE public.exchange_rates 
ADD COLUMN IF NOT EXISTS effective_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing rows to set effective_at from effective_date
UPDATE public.exchange_rates 
SET effective_at = (effective_date::text || ' ' || created_at::time)::timestamp with time zone
WHERE effective_at IS NULL OR effective_at = now();

-- Function to check if a rate is used in any payment
CREATE OR REPLACE FUNCTION public.is_rate_used(p_rate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payments p
    JOIN exchange_rates er ON er.id = p_rate_id
    WHERE p.exchange_rate = (1 / er.rate_xaf_to_rmb)
    AND p.created_at >= er.effective_at
    AND (
      NOT EXISTS (
        SELECT 1 FROM exchange_rates er2 
        WHERE er2.effective_at > er.effective_at
      )
      OR p.created_at < (
        SELECT MIN(er2.effective_at) FROM exchange_rates er2 
        WHERE er2.effective_at > er.effective_at
      )
    )
  );
$$;

-- Function to get rate usage count
CREATE OR REPLACE FUNCTION public.get_rate_usage_count(p_rate_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM payments p
  JOIN exchange_rates er ON er.id = p_rate_id
  WHERE p.exchange_rate = (1 / er.rate_xaf_to_rmb)
  AND p.created_at >= er.effective_at
  AND (
    NOT EXISTS (
      SELECT 1 FROM exchange_rates er2 
      WHERE er2.effective_at > er.effective_at
    )
    OR p.created_at < (
      SELECT MIN(er2.effective_at) FROM exchange_rates er2 
      WHERE er2.effective_at > er.effective_at
    )
  );
$$;

-- Function to update an exchange rate
CREATE OR REPLACE FUNCTION public.update_exchange_rate(
  p_rate_id uuid,
  p_rate_xaf_to_rmb numeric,
  p_effective_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate RECORD;
  v_is_used BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  SELECT * INTO v_rate FROM exchange_rates WHERE id = p_rate_id;
  
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux non trouvé');
  END IF;
  
  v_is_used := public.is_rate_used(p_rate_id);
  
  IF v_is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce taux a déjà été utilisé dans des paiements et ne peut pas être modifié');
  END IF;
  
  UPDATE exchange_rates
  SET rate_xaf_to_rmb = p_rate_xaf_to_rmb,
      effective_at = COALESCE(p_effective_at, effective_at),
      effective_date = COALESCE(p_effective_at, effective_at)::date
  WHERE id = p_rate_id;
  
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'update_exchange_rate', 'exchange_rate', p_rate_id,
    jsonb_build_object(
      'old_rate', v_rate.rate_xaf_to_rmb,
      'new_rate', p_rate_xaf_to_rmb
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to delete an exchange rate
CREATE OR REPLACE FUNCTION public.delete_exchange_rate(p_rate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate RECORD;
  v_is_used BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  SELECT * INTO v_rate FROM exchange_rates WHERE id = p_rate_id;
  
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux non trouvé');
  END IF;
  
  v_is_used := public.is_rate_used(p_rate_id);
  
  IF v_is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce taux a déjà été utilisé dans des paiements et ne peut pas être supprimé');
  END IF;
  
  DELETE FROM exchange_rates WHERE id = p_rate_id;
  
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_exchange_rate', 'exchange_rate', p_rate_id,
    jsonb_build_object(
      'rate', v_rate.rate_xaf_to_rmb,
      'effective_date', v_rate.effective_date
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to add a new exchange rate with datetime
CREATE OR REPLACE FUNCTION public.add_exchange_rate(
  p_rate_xaf_to_rmb numeric,
  p_effective_at timestamp with time zone DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  INSERT INTO exchange_rates (rate_xaf_to_rmb, effective_date, effective_at, created_by)
  VALUES (p_rate_xaf_to_rmb, p_effective_at::date, p_effective_at, v_admin_id)
  RETURNING id INTO v_rate_id;
  
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'add_exchange_rate', 'exchange_rate', v_rate_id,
    jsonb_build_object('rate', p_rate_xaf_to_rmb, 'effective_at', p_effective_at)
  );
  
  RETURN jsonb_build_object('success', true, 'rate_id', v_rate_id);
END;
$$;-- Remove all dangerous "Allow all" policies that expose sensitive data publicly

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
WITH CHECK (is_admin(auth.uid()));CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
  v_payment RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Get proof
  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id;
  
  IF v_proof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preuve non trouvée');
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = v_proof.payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- Cannot delete proofs if payment is completed or rejected
  IF v_payment.status IN ('completed', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer les preuves d''un paiement effectué ou rejeté');
  END IF;
  
  -- Delete the proof
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;
  
  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);
  
  RETURN jsonb_build_object('success', true);
END;
$$;-- Drop and recreate the function with proper locking to prevent race conditions
CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  -- Lock the deposits table to prevent concurrent reference generation
  LOCK TABLE public.deposits IN SHARE UPDATE EXCLUSIVE MODE;
  
  -- Get the maximum reference number for this year
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(reference, '^BZ-DP-' || v_year || '-', ''),
        reference
      )::int
    ),
    0
  ) + 1 INTO v_max_num
  FROM public.deposits
  WHERE reference LIKE 'BZ-DP-' || v_year || '-%';
  
  v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
  
  RETURN v_reference;
END;
$$;-- Create atomic function to create deposit with guaranteed unique reference
CREATE OR REPLACE FUNCTION public.create_client_deposit(
  p_user_id UUID,
  p_amount_xaf NUMERIC,
  p_method deposit_method,
  p_bank_name TEXT DEFAULT NULL,
  p_agency_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
  v_deposit_id UUID;
  v_attempts INT := 0;
  v_max_attempts INT := 5;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  -- Retry loop in case of concurrent inserts
  WHILE v_attempts < v_max_attempts LOOP
    v_attempts := v_attempts + 1;
    
    -- Lock and get max reference number
    LOCK TABLE public.deposits IN SHARE UPDATE EXCLUSIVE MODE;
    
    SELECT COALESCE(
      MAX(
        NULLIF(
          regexp_replace(reference, '^BZ-DP-' || v_year || '-', ''),
          reference
        )::int
      ),
      0
    ) + 1 INTO v_max_num
    FROM public.deposits
    WHERE reference LIKE 'BZ-DP-' || v_year || '-%';
    
    v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
    
    -- Try to insert the deposit
    BEGIN
      INSERT INTO public.deposits (
        user_id,
        reference,
        amount_xaf,
        method,
        bank_name,
        agency_name,
        client_phone,
        status
      ) VALUES (
        p_user_id,
        v_reference,
        p_amount_xaf,
        p_method,
        p_bank_name,
        p_agency_name,
        p_client_phone,
        'created'
      )
      RETURNING id INTO v_deposit_id;
      
      -- Success - add timeline event and return
      INSERT INTO public.deposit_timeline_events (
        deposit_id,
        event_type,
        description,
        performed_by
      ) VALUES (
        v_deposit_id,
        'created',
        'Demande de dépôt créée',
        p_user_id
      );
      
      RETURN json_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'reference', v_reference
      );
      
    EXCEPTION
      WHEN unique_violation THEN
        -- Reference collision, retry
        IF v_attempts >= v_max_attempts THEN
          RETURN json_build_object(
            'success', false,
            'error', 'Impossible de générer une référence unique après plusieurs tentatives'
          );
        END IF;
        -- Continue to next iteration
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', false,
    'error', 'Erreur inattendue lors de la création du dépôt'
  );
END;
$$;-- Add indexes for frequently queried columns to improve performance

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
CREATE INDEX IF NOT EXISTS idx_payment_timeline_payment_id ON public.payment_timeline_events(payment_id);-- Add cash payment specific fields to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS cash_beneficiary_type text CHECK (cash_beneficiary_type IN ('self', 'other')),
ADD COLUMN IF NOT EXISTS cash_beneficiary_first_name text,
ADD COLUMN IF NOT EXISTS cash_beneficiary_last_name text,
ADD COLUMN IF NOT EXISTS cash_beneficiary_phone text,
ADD COLUMN IF NOT EXISTS cash_signature_url text,
ADD COLUMN IF NOT EXISTS cash_signature_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS cash_signed_by_name text,
ADD COLUMN IF NOT EXISTS cash_scanned_at timestamptz,
ADD COLUMN IF NOT EXISTS cash_scanned_by uuid,
ADD COLUMN IF NOT EXISTS cash_paid_at timestamptz,
ADD COLUMN IF NOT EXISTS cash_paid_by uuid;

-- Add index for cash payments lookup
CREATE INDEX IF NOT EXISTS idx_payments_cash_method ON public.payments(method) WHERE method = 'cash';

-- Update payment_status enum to include cash-specific statuses
-- First check existing values and add new ones
DO $$
BEGIN
  -- Add 'cash_pending' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cash_pending' AND enumtypid = 'payment_status'::regtype) THEN
    ALTER TYPE payment_status ADD VALUE 'cash_pending';
  END IF;
  -- Add 'cash_scanned' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cash_scanned' AND enumtypid = 'payment_status'::regtype) THEN
    ALTER TYPE payment_status ADD VALUE 'cash_scanned';
  END IF;
END$$;

-- Create storage bucket for cash signatures if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('cash-signatures', 'cash-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cash signatures
CREATE POLICY "Admins can upload cash signatures"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cash-signatures' AND is_admin(auth.uid()));

CREATE POLICY "Admins can view cash signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'cash-signatures' AND is_admin(auth.uid()));

CREATE POLICY "Users can view own payment signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cash-signatures' AND 
  EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.cash_signature_url LIKE '%' || name || '%' 
    AND p.user_id = auth.uid()
  )
);

-- Function to process cash payment scan
CREATE OR REPLACE FUNCTION public.scan_cash_payment(
  p_payment_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
BEGIN
  -- Get payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  -- Verify it's a cash payment
  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;

  -- Check if already paid
  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;

  -- If already scanned, return success without creating duplicate timeline events
  IF v_payment.status IN ('cash_scanned', 'cash_pending') THEN
    RETURN json_build_object(
      'success', true,
      'payment', row_to_json(v_payment)
    );
  END IF;

  -- Update to scanned status
  UPDATE payments
  SET
    status = 'cash_scanned',
    cash_scanned_at = now(),
    cash_scanned_by = auth.uid(),
    updated_at = now()
  WHERE id = p_payment_id;

  -- Add timeline event
  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_scanned', 'QR Code scanné au bureau', auth.uid());

  RETURN json_build_object(
    'success', true,
    'payment', row_to_json(v_payment)
  );
END;
$$;

-- Function to confirm cash payment with signature
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_id uuid,
  p_signature_url text,
  p_signed_by_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
BEGIN
  -- Get payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;
  
  -- Verify it's a cash payment
  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;
  
  -- Check if already paid
  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;
  
  -- Update payment to completed
  UPDATE payments 
  SET 
    status = 'completed',
    cash_signature_url = p_signature_url,
    cash_signature_timestamp = now(),
    cash_signed_by_name = p_signed_by_name,
    cash_paid_at = now(),
    cash_paid_by = auth.uid(),
    processed_at = now(),
    processed_by = auth.uid(),
    updated_at = now()
  WHERE id = p_payment_id;
  
  -- Add timeline event
  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_paid', 'Paiement cash effectué - Signature enregistrée', auth.uid());
  
  RETURN json_build_object('success', true);
END;
$$;-- Step 1: Add cash_agent to the app_role enum only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cash_agent';-- Create is_cash_agent function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_cash_agent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'cash_agent'::app_role
  )
$$;

-- RLS policy for cash agents to view ONLY cash payments
CREATE POLICY "Cash agents can view cash payments only"
ON public.payments
FOR SELECT
USING (
  is_cash_agent(auth.uid()) 
  AND method = 'cash'::payment_method
);

-- Cash agents can update cash payments (for confirming payment)
CREATE POLICY "Cash agents can update cash payments"
ON public.payments
FOR UPDATE
USING (
  is_cash_agent(auth.uid()) 
  AND method = 'cash'::payment_method
  AND status IN ('cash_pending'::payment_status, 'cash_scanned'::payment_status)
);

-- Cash agents can view payment timeline for cash payments
CREATE POLICY "Cash agents can view cash payment timelines"
ON public.payment_timeline_events
FOR SELECT
USING (
  is_cash_agent(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_timeline_events.payment_id 
    AND p.method = 'cash'::payment_method
  )
);

-- Cash agents can insert timeline events for cash payments
CREATE POLICY "Cash agents can insert cash payment timeline events"
ON public.payment_timeline_events
FOR INSERT
WITH CHECK (
  is_cash_agent(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_timeline_events.payment_id 
    AND p.method = 'cash'::payment_method
  )
);

-- Cash agents can view profiles (to see beneficiary names)
CREATE POLICY "Cash agents can view profiles"
ON public.profiles
FOR SELECT
USING (is_cash_agent(auth.uid()));-- Allow super_admin to insert user roles
CREATE POLICY "Super admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'::app_role
  )
);

-- Allow super_admin to view all user roles
CREATE POLICY "Super admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'::app_role
  )
);

-- Allow super_admin to delete user roles
CREATE POLICY "Super admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'::app_role
  )
);-- Fix permissive RLS policies flagged by linter (WITH CHECK true)

-- deposit_timeline_events: replace always-true INSERT policy
DROP POLICY IF EXISTS "System can insert timeline events" ON public.deposit_timeline_events;
CREATE POLICY "Users can insert deposit timeline events"
ON public.deposit_timeline_events
FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.deposits d
    WHERE d.id = deposit_timeline_events.deposit_id
      AND (
        d.user_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  )
);

-- payment_timeline_events: replace always-true INSERT policy
DROP POLICY IF EXISTS "System can insert payment timeline events" ON public.payment_timeline_events;
CREATE POLICY "Users can insert payment timeline events"
ON public.payment_timeline_events
FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = payment_timeline_events.payment_id
      AND (
        p.user_id = auth.uid()
        OR public.is_admin(auth.uid())
        OR (public.is_cash_agent(auth.uid()) AND p.method = 'cash'::public.payment_method)
      )
  )
);

-- Clean up duplicate super_admin policies on user_roles that can cause recursion
DROP POLICY IF EXISTS "Super admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete user roles" ON public.user_roles;-- Create storage bucket for cash signatures (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cash-signatures',
  'cash-signatures',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Get proof
  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id;

  IF v_proof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preuve non trouvée');
  END IF;

  -- Allow deletion even if payment is completed or rejected (admin only)
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;

  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);

  RETURN jsonb_build_object('success', true);
END;
$function$;CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_adjustment_type TEXT,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_adjustment_amount NUMERIC;
BEGIN
  -- Get the wallet
  SELECT id, balance_xaf INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Calculate the adjustment amount (negative for debit, positive for credit)
  IF p_adjustment_type = 'debit' THEN
    v_adjustment_amount := -ABS(p_amount);
    v_new_balance := v_current_balance - ABS(p_amount);
  ELSE
    v_adjustment_amount := ABS(p_amount);
    v_new_balance := v_current_balance + ABS(p_amount);
  END IF;

  -- Check if debit would result in negative balance
  IF v_new_balance < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant pour ce débit');
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  -- Create wallet operation with correct sign
  INSERT INTO wallet_operations (
    wallet_id,
    operation_type,
    amount_xaf,
    balance_before,
    balance_after,
    description,
    performed_by
  ) VALUES (
    v_wallet_id,
    'adjustment',
    v_adjustment_amount,  -- Now correctly negative for debits
    v_current_balance,
    v_new_balance,
    CASE 
      WHEN p_adjustment_type = 'debit' THEN 'Débit manuel: ' || p_reason
      ELSE 'Crédit manuel: ' || p_reason
    END,
    auth.uid()
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount', v_adjustment_amount,
    'type', p_adjustment_type
  );
END;
$$;-- Function to delete a client and all their related data
CREATE OR REPLACE FUNCTION public.admin_delete_client(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_has_role BOOLEAN;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  
  -- Check if the target user has any role (admin/agent) - cannot delete admins/agents
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  ) INTO v_has_role;
  
  IF v_has_role THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer un utilisateur admin/agent. Supprimez d''abord son rôle.');
  END IF;
  
  -- Get wallet ID
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  
  -- Delete wallet operations
  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_operations WHERE wallet_id = v_wallet_id;
  END IF;
  
  -- Delete deposit timeline events
  DELETE FROM deposit_timeline_events WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  
  -- Delete deposit proofs
  DELETE FROM deposit_proofs WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  
  -- Delete deposits
  DELETE FROM deposits WHERE user_id = p_user_id;
  
  -- Delete payment timeline events
  DELETE FROM payment_timeline_events WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  
  -- Delete payment proofs
  DELETE FROM payment_proofs WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  
  -- Delete payments
  DELETE FROM payments WHERE user_id = p_user_id;
  
  -- Delete wallet
  DELETE FROM wallets WHERE user_id = p_user_id;
  
  -- Delete profile
  DELETE FROM profiles WHERE user_id = p_user_id;
  
  -- Note: We cannot delete from auth.users here as it requires admin API
  -- The user account will remain but without profile/data
  
  RETURN json_build_object(
    'success', true,
    'message', 'Client supprimé avec succès'
  );
END;
$$;-- Make storage buckets private to prevent unauthorized access
UPDATE storage.buckets SET public = false WHERE id = 'deposit-proofs';
UPDATE storage.buckets SET public = false WHERE id = 'payment-proofs';-- Fix wallet creation race condition in validate_deposit function
-- This migration addresses the issue where concurrent deposit validations
-- for the same new user could cause duplicate wallet creation attempts

-- Drop the old function
DROP FUNCTION IF EXISTS public.validate_deposit(UUID, TEXT);

-- Recreate with proper upsert logic to prevent race conditions
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already validated');
  END IF;

  -- Get or create wallet using UPSERT to prevent race conditions
  -- This ensures atomic wallet creation even with concurrent requests
  INSERT INTO public.wallets (user_id, balance_xaf)
  VALUES (v_deposit.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Now fetch the wallet (guaranteed to exist)
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;

  IF v_wallet IS NULL THEN
    -- This should never happen, but safeguard just in case
    RETURN jsonb_build_object('success', false, 'error', 'Failed to create or retrieve wallet');
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_deposit.amount_xaf;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Update deposit status
  UPDATE public.deposits
  SET status = 'validated',
      validated_by = v_admin_id,
      validated_at = now(),
      admin_comment = p_admin_comment,
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Create wallet operation
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by
  ) VALUES (
    v_wallet.id, 'deposit', v_deposit.amount_xaf, v_wallet.balance_xaf, v_new_balance,
    p_deposit_id, 'deposit', 'Dépôt validé - ' || v_deposit.reference, v_admin_id
  );

  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'validated', 'Dépôt validé par l''équipe Bonzini', v_admin_id);

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'wallet_credited', 'Solde mis à jour: +' || v_deposit.amount_xaf || ' XAF', v_admin_id);

  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_credited', v_deposit.amount_xaf
  );
END;
$$;

COMMENT ON FUNCTION public.validate_deposit IS 'Validates a deposit and credits the wallet. Uses UPSERT to prevent race conditions when creating wallets.';
-- Add rate limiting to prevent abuse
-- This migration adds triggers to enforce rate limits on deposits, payments, and admin operations

-- ============================================================================
-- DEPOSIT RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_deposit_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 10; -- Max deposits per hour (from constants.ts)
BEGIN
  -- Count deposits in the last hour for this user
  SELECT COUNT(*) INTO v_count
  FROM public.deposits
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % deposits per hour allowed', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_deposit_rate_limit
  BEFORE INSERT ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deposit_rate_limit();

COMMENT ON FUNCTION public.check_deposit_rate_limit() IS 'Enforces rate limit of 10 deposits per hour per user';

-- ============================================================================
-- PAYMENT RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_payment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 20; -- Max payments per hour (from constants.ts)
BEGIN
  -- Count payments in the last hour for this user
  SELECT COUNT(*) INTO v_count
  FROM public.payments
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % payments per hour allowed', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_payment_rate_limit
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_payment_rate_limit();

COMMENT ON FUNCTION public.check_payment_rate_limit() IS 'Enforces rate limit of 20 payments per hour per user';

-- ============================================================================
-- ADMIN WALLET ADJUSTMENT RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_admin_adjustment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 50; -- Max adjustments per day per admin (from constants.ts)
BEGIN
  -- Only apply to adjustment operations
  IF NEW.operation_type != 'adjustment' THEN
    RETURN NEW;
  END IF;

  -- Count adjustments in the last 24 hours by this admin
  SELECT COUNT(*) INTO v_count
  FROM public.wallet_operations
  WHERE operation_type = 'adjustment'
    AND performed_by = NEW.performed_by
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % wallet adjustments per day allowed', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_admin_adjustment_rate_limit
  BEFORE INSERT ON public.wallet_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_adjustment_rate_limit();

COMMENT ON FUNCTION public.check_admin_adjustment_rate_limit() IS 'Enforces rate limit of 50 wallet adjustments per day per admin';

-- ============================================================================
-- RATE LIMIT MONITORING VIEW
-- ============================================================================

-- View to monitor current rate limit usage
CREATE OR REPLACE VIEW public.rate_limit_usage AS
SELECT
  'deposits' as operation_type,
  user_id,
  COUNT(*) as count_last_hour,
  10 as limit_per_hour,
  CASE WHEN COUNT(*) >= 10 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.deposits
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id

UNION ALL

SELECT
  'payments' as operation_type,
  user_id,
  COUNT(*) as count_last_hour,
  20 as limit_per_hour,
  CASE WHEN COUNT(*) >= 20 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.payments
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id

UNION ALL

SELECT
  'admin_adjustments' as operation_type,
  performed_by as user_id,
  COUNT(*) as count_last_hour,
  50 as limit_per_hour,
  CASE WHEN COUNT(*) >= 50 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.wallet_operations
WHERE operation_type = 'adjustment'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY performed_by;

-- Grant access to admins
GRANT SELECT ON public.rate_limit_usage TO authenticated;

COMMENT ON VIEW public.rate_limit_usage IS 'Shows current rate limit usage for monitoring';

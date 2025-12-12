
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

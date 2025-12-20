-- Drop existing policies that might conflict
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
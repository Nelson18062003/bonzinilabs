-- ============================================================
-- Migration: Create dedicated `clients` table
-- Separate client data from admin data (previously mixed in `profiles`)
-- Also enrich `user_roles` with first_name/last_name for admins
-- ============================================================

-- ============================================
-- 1. Create the `clients` table
-- ============================================

CREATE TABLE IF NOT EXISTS public.clients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  company_name   TEXT,
  gender         TEXT DEFAULT 'OTHER' CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
  status         TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_KYC')),
  kyc_verified   BOOLEAN DEFAULT FALSE,
  country        TEXT,
  city           TEXT,
  neighborhood   TEXT,
  activity_sector TEXT,
  date_of_birth  DATE,
  avatar_url     TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. Add first_name/last_name to user_roles
-- ============================================

ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.user_roles
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- ============================================
-- 3. Migrate data from profiles
-- ============================================

-- 3a. Migrate client profiles → clients table
INSERT INTO public.clients (user_id, first_name, last_name, phone, company_name, avatar_url, date_of_birth, activity_sector, neighborhood, city, country, created_at, updated_at)
SELECT
  p.user_id,
  p.first_name,
  p.last_name,
  p.phone,
  p.company_name,
  p.avatar_url,
  p.date_of_birth,
  p.activity_sector,
  p.neighborhood,
  p.city,
  p.country,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.user_id NOT IN (SELECT ur.user_id FROM public.user_roles ur)
ON CONFLICT (user_id) DO NOTHING;

-- 3b. Populate email in clients from auth.users
UPDATE public.clients c
SET email = u.email
FROM auth.users u
WHERE u.id = c.user_id AND c.email IS NULL;

-- 3c. Migrate admin names → user_roles
UPDATE public.user_roles ur
SET first_name = p.first_name, last_name = p.last_name
FROM public.profiles p
WHERE p.user_id = ur.user_id
  AND (ur.first_name IS NULL OR ur.last_name IS NULL);

-- ============================================
-- 4. Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(first_name, last_name);

-- ============================================
-- 5. Trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION public.update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_clients_updated_at();

-- ============================================
-- 6. RLS Policies
-- ============================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client profile"
ON public.clients FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own client profile"
ON public.clients FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients"
ON public.clients FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all clients"
ON public.clients FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert clients"
ON public.clients FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));

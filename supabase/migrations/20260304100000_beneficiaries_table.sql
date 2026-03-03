-- ============================================================
-- Create beneficiaries table for saved payment recipients
-- ============================================================

CREATE TABLE public.beneficiaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method  public.payment_method NOT NULL,
  name            TEXT NOT NULL,
  identifier      TEXT,
  identifier_type TEXT CHECK (identifier_type IN ('qr', 'id', 'email', 'phone')),
  phone           TEXT,
  email           TEXT,
  bank_name       TEXT,
  bank_account    TEXT,
  bank_extra      TEXT,
  qr_code_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_beneficiaries_client_method ON public.beneficiaries (client_id, payment_method) WHERE is_active = TRUE;
CREATE INDEX idx_beneficiaries_client_id ON public.beneficiaries (client_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_beneficiaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_beneficiaries_updated_at
  BEFORE UPDATE ON public.beneficiaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_beneficiaries_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

-- Client: CRUD on own beneficiaries
CREATE POLICY "Users can view own beneficiaries"
  ON public.beneficiaries FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Users can insert own beneficiaries"
  ON public.beneficiaries FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Users can update own beneficiaries"
  ON public.beneficiaries FOR UPDATE
  USING (auth.uid() = client_id);

CREATE POLICY "Users can delete own beneficiaries"
  ON public.beneficiaries FOR DELETE
  USING (auth.uid() = client_id);

-- Admin: read all beneficiaries
CREATE POLICY "Admins can view all beneficiaries"
  ON public.beneficiaries FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert beneficiaries for clients"
  ON public.beneficiaries FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any beneficiary"
  ON public.beneficiaries FOR UPDATE
  USING (public.is_admin(auth.uid()));

NOTIFY pgrst, 'reload schema';

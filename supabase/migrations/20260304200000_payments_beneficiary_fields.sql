-- ============================================================
-- Add beneficiary_id, beneficiary_details, rate_is_custom to payments
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS beneficiary_id UUID REFERENCES public.beneficiaries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS beneficiary_details JSONB,
  ADD COLUMN IF NOT EXISTS rate_is_custom BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_payments_beneficiary_id ON public.payments(beneficiary_id);

NOTIFY pgrst, 'reload schema';

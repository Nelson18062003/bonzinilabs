-- ============================================================
-- Add dedicated beneficiary identifier + bank_extra columns
-- ------------------------------------------------------------
-- Until now the Alipay/WeChat identifier was concatenated into
-- beneficiary_notes ("ID Alipay: ..."). This made it invisible
-- in the admin payment detail and in the batch PDF export.
-- We now store it in a dedicated column, backfill existing rows,
-- and clear the notes for the rows we migrated.
-- ============================================================

-- 1. Columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS beneficiary_identifier TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_identifier_type TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_bank_extra TEXT;

-- identifier_type is open enum: 'qr' | 'id' | 'email' | 'phone'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_beneficiary_identifier_type_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_beneficiary_identifier_type_check
      CHECK (
        beneficiary_identifier_type IS NULL
        OR beneficiary_identifier_type IN ('qr', 'id', 'email', 'phone')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_beneficiary_identifier
  ON public.payments (beneficiary_identifier)
  WHERE beneficiary_identifier IS NOT NULL;

-- 2. Backfill: any note starting with "ID <Method>: " is an Alipay/WeChat id.
--    Matching is case-insensitive and covers the FR prefix we shipped
--    ("ID Alipay:", "ID WeChat:", "ID WeChat Pay:") plus the CN variants.
UPDATE public.payments
SET
  beneficiary_identifier      = regexp_replace(beneficiary_notes, '^ID [^:]+:\s*', '', 'i'),
  beneficiary_identifier_type = 'id',
  beneficiary_notes           = NULL,
  updated_at                  = now()
WHERE
  beneficiary_identifier IS NULL
  AND beneficiary_notes IS NOT NULL
  AND beneficiary_notes ~* '^ID (Alipay|WeChat|WeChat Pay|支付宝|微信)\s*:';

NOTIFY pgrst, 'reload schema';

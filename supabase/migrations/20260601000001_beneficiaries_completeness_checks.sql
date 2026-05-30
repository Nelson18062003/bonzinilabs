-- ============================================================
-- Beneficiaries — Lot 1B: per-mode completeness CHECKs (NOT VALID)
-- ------------------------------------------------------------
-- Additive, PROD-SAFE. Guarantees the "never incomplete for its mode"
-- rule for ALL NEW writes, WITHOUT rejecting legacy prod rows that may
-- predate the rule.
--
-- `NOT VALID` = the constraint is enforced on every INSERT/UPDATE from
-- now on, but Postgres does NOT scan existing rows at creation time.
-- Legacy incomplete rows are grandfathered; the audit view at the end
-- lists them so the client/admin can complete them, after which we can
-- run `VALIDATE CONSTRAINT` in a later migration.
--
-- Mirrors src/lib/beneficiaries/spec.ts (single source of truth).
--   alipay/wechat : identifier OR qr_code_url
--   bank_transfer : bank_name AND bank_account
--   cash          : phone
-- (alias NOT NULL is already enforced by Lot 1A.)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_benef_alipay_wechat_channel'
  ) THEN
    ALTER TABLE public.beneficiaries
      ADD CONSTRAINT chk_benef_alipay_wechat_channel CHECK (
        payment_method NOT IN ('alipay', 'wechat')
        OR identifier IS NOT NULL
        OR qr_code_url IS NOT NULL
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_benef_bank_fields'
  ) THEN
    ALTER TABLE public.beneficiaries
      ADD CONSTRAINT chk_benef_bank_fields CHECK (
        payment_method <> 'bank_transfer'
        OR (bank_name IS NOT NULL AND bank_account IS NOT NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_benef_cash_phone'
  ) THEN
    ALTER TABLE public.beneficiaries
      ADD CONSTRAINT chk_benef_cash_phone CHECK (
        payment_method <> 'cash'
        OR phone IS NOT NULL
      ) NOT VALID;
  END IF;
END $$;

-- ------------------------------------------------------------
-- AUDIT (read-only): legacy active rows that do NOT satisfy the new
-- completeness rule. Run manually after applying to see what clients
-- should complete. Does not modify anything.
-- ------------------------------------------------------------
--   SELECT id, client_id, payment_method, alias
--   FROM public.beneficiaries
--   WHERE is_active AND (
--        (payment_method IN ('alipay','wechat') AND identifier IS NULL AND qr_code_url IS NULL)
--     OR (payment_method = 'bank_transfer' AND (bank_name IS NULL OR bank_account IS NULL))
--     OR (payment_method = 'cash' AND phone IS NULL)
--   );

NOTIFY pgrst, 'reload schema';

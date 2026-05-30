-- ============================================================
-- Beneficiaries — Lot 1C: de-duplicate legacy rows + UNIQUE indexes
-- ------------------------------------------------------------
-- Additive, PROD-SAFE. No DROP of data — duplicates are ARCHIVED
-- (is_active = false), which is reversible and does NOT affect any past
-- payment (payments hold a frozen snapshot + FK ON DELETE SET NULL).
--
-- DESIGN NOTE — why a PLAIN index, not CONCURRENTLY:
--   `beneficiaries` is a small, low-volume per-client address book.
--   `CREATE INDEX CONCURRENTLY` cannot run inside the migration's
--   transaction, and for a small table its benefit (no exclusive lock)
--   is negligible. Building the index in the SAME transaction as the
--   de-dup is ATOMIC: there is no window in which a leftover duplicate
--   could make the unique index fail. The brief lock on a tiny table is
--   acceptable. (If this table ever grows hot, switch to a CONCURRENTLY
--   build in a separate, non-transactional migration.)
--
-- Dedup keeps the MOST RECENTLY UPDATED row per natural key and archives
-- the rest. Natural keys mirror src/lib/beneficiaries/spec.ts:
--   alipay/wechat : (client_id, payment_method, identifier)
--   bank_transfer : (client_id, bank_account, bank_name)
--   cash          : no hard key (soft UX warning only)
-- ============================================================

-- 1a. Archive duplicate account-identifier rows (Alipay/WeChat), keeping
--     the freshest. Case/space-insensitive match (mirrors the app's
--     natural-key normalisation).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY client_id, payment_method, lower(btrim(identifier))
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.beneficiaries
  WHERE is_active
    AND payment_method IN ('alipay', 'wechat')
    AND identifier IS NOT NULL
    AND btrim(identifier) <> ''
)
UPDATE public.beneficiaries b
SET is_active = false, updated_at = now()
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

-- 1b. Archive duplicate bank rows (account + bank name), keeping freshest.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY client_id, lower(btrim(bank_account)), lower(btrim(coalesce(bank_name, '')))
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.beneficiaries
  WHERE is_active
    AND payment_method = 'bank_transfer'
    AND bank_account IS NOT NULL
    AND btrim(bank_account) <> ''
)
UPDATE public.beneficiaries b
SET is_active = false, updated_at = now()
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

-- 2a. UNIQUE index for Alipay/WeChat account identifier (active rows only).
CREATE UNIQUE INDEX IF NOT EXISTS uq_benef_account
  ON public.beneficiaries (client_id, payment_method, lower(btrim(identifier)))
  WHERE is_active
    AND payment_method IN ('alipay', 'wechat')
    AND identifier IS NOT NULL;

-- 2b. UNIQUE index for bank account + bank name (active rows only).
CREATE UNIQUE INDEX IF NOT EXISTS uq_benef_bank
  ON public.beneficiaries (client_id, lower(btrim(bank_account)), lower(btrim(coalesce(bank_name, ''))))
  WHERE is_active
    AND payment_method = 'bank_transfer'
    AND bank_account IS NOT NULL;

NOTIFY pgrst, 'reload schema';

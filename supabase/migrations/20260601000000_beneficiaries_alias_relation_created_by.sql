-- ============================================================
-- Beneficiaries — Lot 1A: alias / relation_type / notes / created_by
-- ------------------------------------------------------------
-- Additive, PROD-SAFE. No DROP. `payments` is never touched.
--
-- Adds:
--   * alias          — human-readable label (LATIN), required AFTER backfill.
--                      The real holder `name` is often Chinese and hard to
--                      recognise in a list; `alias` is the recognisable tag.
--   * relation_type  — self | supplier | other (UX + reporting only).
--   * notes          — free per-beneficiary note.
--   * created_by / created_by_role — audit trail (who created it).
--
-- Existing rows are backfilled (alias := name) BEFORE alias is made
-- NOT NULL, so the migration cannot fail on prod data.
-- ============================================================

-- 1. Columns (nullable first)
ALTER TABLE public.beneficiaries
  ADD COLUMN IF NOT EXISTS alias           TEXT,
  ADD COLUMN IF NOT EXISTS relation_type   TEXT,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS created_by      UUID,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT;

-- 2. relation_type open enum guard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beneficiaries_relation_type_check'
  ) THEN
    ALTER TABLE public.beneficiaries
      ADD CONSTRAINT beneficiaries_relation_type_check
      CHECK (relation_type IS NULL OR relation_type IN ('self', 'supplier', 'other'));
  END IF;
END $$;

-- 3. created_by_role guard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beneficiaries_created_by_role_check'
  ) THEN
    ALTER TABLE public.beneficiaries
      ADD CONSTRAINT beneficiaries_created_by_role_check
      CHECK (created_by_role IS NULL OR created_by_role IN ('client', 'admin'));
  END IF;
END $$;

-- 4. Backfill alias from the existing name so no legacy row is left blank.
UPDATE public.beneficiaries
SET alias = name
WHERE alias IS NULL OR btrim(alias) = '';

-- 5. Now alias can be NOT NULL safely (all rows have a value).
ALTER TABLE public.beneficiaries
  ALTER COLUMN alias SET NOT NULL;

NOTIFY pgrst, 'reload schema';

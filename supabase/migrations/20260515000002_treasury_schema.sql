-- ============================================================
-- Treasury Lot 1 — Schema for the value chain traceability module
--
-- Adds the data model for end-to-end traceability of the XAF →
-- USDT → CNY pipeline:
--   * counterparties (USDT suppliers in Cameroon + CNY buyers
--     in China)
--   * multi-currency Bonzini accounts (XAF banks, mobile money,
--     USDT pool, CNY cash/alipay/wechat)
--   * USDT purchases (append-only)
--   * USDT sales (append-only, snapshot WAC at the moment of sale)
--   * weekly cash inventory snapshots
--   * internal multi-currency ledger (append-only strict)
--
-- All numeric amounts and rates use NUMERIC(20, 8) — same
-- precision regardless of currency. Append-only is enforced by
-- RLS: SELECT for users that pass can_access_treasury(), all
-- writes go through SECURITY DEFINER RPCs (Lot 3).
--
-- This migration only ships the schema + seed. RPCs land in
-- Lot 3, the treasurer role in Lot 2.
-- ============================================================

-- ── 1. Enums ──
CREATE TYPE public.treasury_counterparty_type AS ENUM (
  'usdt_supplier',
  'cny_buyer'
);

CREATE TYPE public.treasury_currency AS ENUM (
  'XAF',
  'USDT',
  'CNY'
);

CREATE TYPE public.treasury_account_kind AS ENUM (
  'bank',
  'mobile_money',
  'crypto_pool',
  'cash',
  'alipay',
  'wechat',
  'other'
);

CREATE TYPE public.treasury_channel_xaf AS ENUM (
  'bank_transfer',
  'mobile_money',
  'cash',
  'other'
);

CREATE TYPE public.treasury_ledger_entry_kind AS ENUM (
  'usdt_purchase_debit_xaf',
  'usdt_purchase_credit_usdt',
  'usdt_sale_debit_usdt',
  'usdt_sale_credit_cny',
  'inventory_adjustment',
  'void'
);

CREATE TYPE public.treasury_ledger_source_table AS ENUM (
  'usdt_purchase',
  'usdt_sale',
  'inventory_snapshot',
  'manual_adjustment',
  'void'
);

-- ── 2. Access helper ──
-- Treasury access is restricted to super_admin and treasurer
-- (the latter is added to user_role in Lot 2). Comparing
-- role::text lets this function ship before the enum value
-- exists; treasurer will simply match nothing until Lot 2.
CREATE OR REPLACE FUNCTION public.can_access_treasury(_user_id UUID)
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
      AND (is_disabled = false OR is_disabled IS NULL)
      AND role::text IN ('super_admin', 'treasurer')
  )
$$;

-- ── 3. Tables ──

-- 3.1 Counterparties (USDT suppliers + CNY buyers in a single directory)
CREATE TABLE public.treasury_counterparties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          public.treasury_counterparty_type NOT NULL,
  display_name  TEXT NOT NULL,
  legal_name    TEXT,
  phone         TEXT,
  wechat_id     TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

CREATE INDEX idx_treasury_counterparties_type_active
  ON public.treasury_counterparties(type, is_active);
CREATE INDEX idx_treasury_counterparties_name
  ON public.treasury_counterparties(display_name);

-- 3.2 Bonzini multi-currency accounts
CREATE TABLE public.treasury_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  currency    public.treasury_currency NOT NULL,
  kind        public.treasury_account_kind NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_treasury_accounts_currency
  ON public.treasury_accounts(currency, is_active);

-- 3.3 USDT purchases (append-only metadata table)
CREATE TABLE public.usdt_purchases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at           TIMESTAMPTZ NOT NULL,
  supplier_id           UUID NOT NULL REFERENCES public.treasury_counterparties(id),
  xaf_account_id        UUID NOT NULL REFERENCES public.treasury_accounts(id),
  xaf_amount            NUMERIC(20, 8) NOT NULL CHECK (xaf_amount > 0),
  usdt_amount           NUMERIC(20, 8) NOT NULL CHECK (usdt_amount > 0),
  implicit_rate         NUMERIC(20, 8) GENERATED ALWAYS AS (xaf_amount / usdt_amount) STORED,
  channel               public.treasury_channel_xaf NOT NULL,
  external_ref          TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  voided_at             TIMESTAMPTZ,
  voided_by             UUID REFERENCES auth.users(id),
  void_reason           TEXT,
  void_contra_entry_id  UUID
);

CREATE INDEX idx_usdt_purchases_occurred_at
  ON public.usdt_purchases(occurred_at DESC);
CREATE INDEX idx_usdt_purchases_supplier
  ON public.usdt_purchases(supplier_id, occurred_at DESC);
CREATE INDEX idx_usdt_purchases_active
  ON public.usdt_purchases(occurred_at DESC) WHERE voided_at IS NULL;

-- 3.4 USDT sales (append-only metadata table)
CREATE TABLE public.usdt_sales (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at           TIMESTAMPTZ NOT NULL,
  buyer_id              UUID NOT NULL REFERENCES public.treasury_counterparties(id),
  cny_account_id        UUID NOT NULL REFERENCES public.treasury_accounts(id),
  usdt_amount           NUMERIC(20, 8) NOT NULL CHECK (usdt_amount > 0),
  cny_amount            NUMERIC(20, 8) NOT NULL CHECK (cny_amount > 0),
  implicit_rate         NUMERIC(20, 8) GENERATED ALWAYS AS (cny_amount / usdt_amount) STORED,
  wac_at_sale           NUMERIC(20, 8) NOT NULL,
  external_ref          TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  voided_at             TIMESTAMPTZ,
  voided_by             UUID REFERENCES auth.users(id),
  void_reason           TEXT,
  void_contra_entry_id  UUID
);

CREATE INDEX idx_usdt_sales_occurred_at
  ON public.usdt_sales(occurred_at DESC);
CREATE INDEX idx_usdt_sales_buyer
  ON public.usdt_sales(buyer_id, occurred_at DESC);
CREATE INDEX idx_usdt_sales_cny_account
  ON public.usdt_sales(cny_account_id, occurred_at DESC);
CREATE INDEX idx_usdt_sales_active
  ON public.usdt_sales(occurred_at DESC) WHERE voided_at IS NULL;

-- 3.5 Weekly inventory snapshots (cash/alipay/wechat reconciliation)
CREATE TABLE public.treasury_inventory_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES public.treasury_accounts(id),
  snapshot_at           TIMESTAMPTZ NOT NULL,
  theoretical_balance   NUMERIC(20, 8) NOT NULL,
  actual_balance        NUMERIC(20, 8) NOT NULL,
  variance              NUMERIC(20, 8) GENERATED ALWAYS AS (actual_balance - theoretical_balance) STORED,
  variance_reason       TEXT,
  adjustment_entry_id   UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_inventory_snapshots_account
  ON public.treasury_inventory_snapshots(account_id, snapshot_at DESC);

-- 3.6 Internal ledger — source of truth for balances per account
-- Signed amount: positive = credit, negative = debit. Append-only
-- strict (no UPDATE/DELETE policy exists, even super_admin cannot
-- modify a posted entry; voids are new contra-entries).
CREATE TABLE public.treasury_ledger_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES public.treasury_accounts(id),
  currency        public.treasury_currency NOT NULL,
  amount          NUMERIC(20, 8) NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL,
  entry_kind      public.treasury_ledger_entry_kind NOT NULL,
  source_table    public.treasury_ledger_source_table NOT NULL,
  source_id       UUID NOT NULL,
  contra_entry_id UUID REFERENCES public.treasury_ledger_entries(id),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_treasury_ledger_account_occurred
  ON public.treasury_ledger_entries(account_id, occurred_at);
CREATE INDEX idx_treasury_ledger_source
  ON public.treasury_ledger_entries(source_table, source_id);
CREATE INDEX idx_treasury_ledger_kind
  ON public.treasury_ledger_entries(entry_kind);
CREATE INDEX idx_treasury_ledger_occurred_at
  ON public.treasury_ledger_entries(occurred_at);

-- Cross-reference FKs that couldn't be set inline (forward refs)
ALTER TABLE public.usdt_purchases
  ADD CONSTRAINT usdt_purchases_void_contra_entry_fk
  FOREIGN KEY (void_contra_entry_id) REFERENCES public.treasury_ledger_entries(id);

ALTER TABLE public.usdt_sales
  ADD CONSTRAINT usdt_sales_void_contra_entry_fk
  FOREIGN KEY (void_contra_entry_id) REFERENCES public.treasury_ledger_entries(id);

ALTER TABLE public.treasury_inventory_snapshots
  ADD CONSTRAINT inventory_adjustment_entry_fk
  FOREIGN KEY (adjustment_entry_id) REFERENCES public.treasury_ledger_entries(id);

-- ── 4. Derived view: live account balances ──
-- security_invoker = true ensures the view runs with the caller's
-- privileges, so RLS on the underlying tables applies. Without
-- this, Postgres defaults to running views as the view owner,
-- which would bypass our treasury RLS.
CREATE VIEW public.treasury_account_balances
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.code,
  a.label,
  a.currency,
  a.kind,
  a.is_active,
  a.sort_order,
  COALESCE(SUM(l.amount), 0)::numeric(20, 8) AS balance,
  MAX(l.occurred_at) AS last_entry_at,
  COUNT(l.id) AS entry_count
FROM public.treasury_accounts a
LEFT JOIN public.treasury_ledger_entries l ON l.account_id = a.id
GROUP BY a.id;

COMMENT ON VIEW public.treasury_account_balances IS
  'Live balance per account computed from the ledger. Source of truth for solde affichage.';

-- ── 5. Row Level Security ──
-- Pattern: SELECT allowed if can_access_treasury(), all writes
-- refused at the RLS level. Writes flow through SECURITY DEFINER
-- RPCs added in Lot 3, which bypass RLS by design.

ALTER TABLE public.treasury_counterparties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_purchases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_sales                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_ledger_entries      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Treasury users can view counterparties"
  ON public.treasury_counterparties FOR SELECT
  USING (public.can_access_treasury(auth.uid()));

CREATE POLICY "Treasury users can view accounts"
  ON public.treasury_accounts FOR SELECT
  USING (public.can_access_treasury(auth.uid()));

CREATE POLICY "Treasury users can view purchases"
  ON public.usdt_purchases FOR SELECT
  USING (public.can_access_treasury(auth.uid()));

CREATE POLICY "Treasury users can view sales"
  ON public.usdt_sales FOR SELECT
  USING (public.can_access_treasury(auth.uid()));

CREATE POLICY "Treasury users can view inventory snapshots"
  ON public.treasury_inventory_snapshots FOR SELECT
  USING (public.can_access_treasury(auth.uid()));

CREATE POLICY "Treasury users can view ledger entries"
  ON public.treasury_ledger_entries FOR SELECT
  USING (public.can_access_treasury(auth.uid()));

-- ── 6. Seed: 10 Bonzini accounts ──
INSERT INTO public.treasury_accounts (code, label, currency, kind, sort_order) VALUES
  ('xaf_afriland',       'Afriland First Bank',  'XAF',  'bank',         10),
  ('xaf_uba',            'UBA Cameroun',         'XAF',  'bank',         20),
  ('xaf_ecobank',        'Ecobank Cameroun',     'XAF',  'bank',         30),
  ('xaf_cca',            'CCA Bank',             'XAF',  'bank',         40),
  ('xaf_mtn_momo',       'MTN Mobile Money',     'XAF',  'mobile_money', 50),
  ('xaf_orange_money',   'Orange Money',         'XAF',  'mobile_money', 60),
  ('usdt_pool',          'Pool USDT',            'USDT', 'crypto_pool',  70),
  ('cny_cash_guangzhou', 'Cash Guangzhou',       'CNY',  'cash',         80),
  ('cny_alipay_papa',    'Alipay (Papa)',        'CNY',  'alipay',       90),
  ('cny_wechat_papa',    'WeChat Pay (Papa)',    'CNY',  'wechat',      100);

-- ── 7. Sanity check (raises if seed didn't insert the expected count) ──
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.treasury_accounts;
  IF v_count <> 10 THEN
    RAISE EXCEPTION 'Treasury seed failed: expected 10 accounts, got %', v_count;
  END IF;
END $$;

COMMENT ON TABLE public.treasury_counterparties IS
  'USDT suppliers (Cameroon) and CNY buyers (China) directory';
COMMENT ON TABLE public.treasury_accounts IS
  'Multi-currency Bonzini accounts (XAF banks/MM, USDT pool, CNY accounts)';
COMMENT ON TABLE public.usdt_purchases IS
  'Append-only log of USDT purchases paid in XAF. Voided via contra-entries.';
COMMENT ON TABLE public.usdt_sales IS
  'Append-only log of USDT sales for CNY. wac_at_sale frozen for historical audit.';
COMMENT ON TABLE public.treasury_inventory_snapshots IS
  'Periodic reconciliation of physical/digital CNY accounts (theoretical vs actual).';
COMMENT ON TABLE public.treasury_ledger_entries IS
  'Internal multi-currency ledger. Append-only strict. Signed amounts.';

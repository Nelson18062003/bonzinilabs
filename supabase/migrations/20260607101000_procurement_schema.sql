-- ============================================================
-- Centrale d'achat — Lot 0 : schéma du module procurement
--
-- Cœur 360° : missions d'achat d'un client chez N fournisseurs
-- chinois (sourcing → commande → production → QC), avec suivi
-- des paiements fournisseurs (acompte/solde) et de la commission
-- Bonzini.
--
-- Conventions reprises de la trésorerie (20260515000002) :
--   * NUMERIC(20,8) sur tout montant
--   * helper can_access_procurement() SECURITY DEFINER
--   * RLS = SELECT via le helper ; TOUTES les écritures passent
--     par des RPC SECURITY DEFINER (Lot 1), qui bypassent la RLS
--   * append-only + voiding par contre-référence sur l'argent
--     (proc_supplier_payments, proc_qc_inspections,
--      proc_production_events, proc_expenses) ; mutable + audit
--     sur le descriptif (suppliers, missions, purchase_orders,
--     order_lines, commissions, documents)
--
-- IMPORTANT : pas d'OCR/analyse de document. proc_documents ne
-- stocke que des PREUVES jointes (saisie des valeurs à la main
-- ou dictée à Mola).
--
-- Ce lot ne ships QUE le schéma. Les RPC @mola arrivent au Lot 1,
-- le rôle sourcing_agent dans 20260607101001_procurement_role.sql.
-- ============================================================

-- ── 1. Enums ──
CREATE TYPE public.proc_currency           AS ENUM ('CNY', 'XAF');
CREATE TYPE public.proc_supplier_kind      AS ENUM ('factory', 'trading_company', 'unknown');
CREATE TYPE public.proc_verification_status AS ENUM ('unverified', 'docs_seen', 'visited', 'audited');
CREATE TYPE public.proc_mission_status     AS ENUM ('active', 'closed', 'archived');
CREATE TYPE public.proc_incoterm           AS ENUM ('EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP');
CREATE TYPE public.proc_po_status          AS ENUM ('open', 'closed', 'cancelled');
CREATE TYPE public.proc_payment_leg        AS ENUM ('deposit', 'balance', 'final', 'extra');
CREATE TYPE public.proc_payment_method     AS ENUM ('cash', 'alipay', 'wechat', 'bank_transfer', 'other');
CREATE TYPE public.proc_settlement_mode    AS ENUM ('attestation', 'rail');
CREATE TYPE public.proc_paid_by            AS ENUM ('client_direct', 'father_onsite', 'bonzini');
CREATE TYPE public.proc_production_status   AS ENUM ('po_confirmed','materials_purchased','in_production','production_done','ready_for_qc','shipped');
CREATE TYPE public.proc_qc_type            AS ENUM ('PPI', 'DUPRO', 'PSI', 'loading');
CREATE TYPE public.proc_qc_inspector_kind  AS ENUM ('internal', 'third_party');
CREATE TYPE public.proc_qc_result          AS ENUM ('pass', 'fail', 'conditional');
CREATE TYPE public.proc_commission_mode    AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE public.proc_document_entity    AS ENUM ('mission','supplier','purchase_order','supplier_payment','qc','order_line');
CREATE TYPE public.proc_document_type      AS ENUM ('invoice_photo','payment_receipt','pi','contract','qc_report','packing_list','bill_of_lading','wechat_screenshot','product_photo','other');
CREATE TYPE public.proc_uploaded_by_kind   AS ENUM ('father', 'admin', 'client');
CREATE TYPE public.proc_expense_category   AS ENUM ('hotel', 'transport', 'driver', 'meals', 'other');

-- ── 2. Access helper ──
-- Procurement access = super_admin OR sourcing_agent. role::text
-- comparison lets this ship before the enum value exists
-- (sourcing_agent is added in the next migration); it simply
-- matches nothing until then. Excludes disabled accounts.
CREATE OR REPLACE FUNCTION public.can_access_procurement(_user_id UUID)
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
      AND role::text IN ('super_admin', 'sourcing_agent')
  )
$$;

-- ── 3. Tables ──

-- 3.1 Suppliers (SHARED org-wide directory: une usine ↔ N clients)
CREATE TABLE public.proc_suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name        TEXT NOT NULL,
  legal_name          TEXT,
  supplier_kind       public.proc_supplier_kind NOT NULL DEFAULT 'unknown',
  category            TEXT[] NOT NULL DEFAULT '{}',
  city                TEXT,
  province            TEXT,
  address             TEXT,
  wechat_id           TEXT,
  phone               TEXT,
  email               TEXT,
  verification_status public.proc_verification_status NOT NULL DEFAULT 'unverified',
  verification_notes  TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES auth.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at         TIMESTAMPTZ
);
CREATE INDEX idx_proc_suppliers_kind_active ON public.proc_suppliers(supplier_kind, is_active);
CREATE INDEX idx_proc_suppliers_name        ON public.proc_suppliers(display_name);
CREATE INDEX idx_proc_suppliers_category    ON public.proc_suppliers USING GIN (category);

-- 3.2 Missions (un projet d'achat d'un client donné)
CREATE TABLE public.proc_missions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT NOT NULL UNIQUE,
  client_user_id  UUID NOT NULL REFERENCES auth.users(id),
  label           TEXT NOT NULL,
  location        TEXT,
  started_on      DATE,
  ended_on        DATE,
  status          public.proc_mission_status NOT NULL DEFAULT 'active',
  summary_note    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proc_missions_client ON public.proc_missions(client_user_id);
CREATE INDEX idx_proc_missions_status ON public.proc_missions(status);

-- 3.3 Purchase orders (la colonne vertébrale)
CREATE TABLE public.proc_purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           TEXT NOT NULL UNIQUE,
  mission_id          UUID NOT NULL REFERENCES public.proc_missions(id),
  supplier_id         UUID NOT NULL REFERENCES public.proc_suppliers(id),
  currency            public.proc_currency NOT NULL DEFAULT 'CNY',
  total_amount        NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  deposit_pct         NUMERIC(5, 2) NOT NULL DEFAULT 30 CHECK (deposit_pct >= 0 AND deposit_pct <= 100),
  incoterm            public.proc_incoterm,
  status              public.proc_po_status NOT NULL DEFAULT 'open',
  expected_ready_date DATE,
  total_cbm           NUMERIC(20, 8),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES auth.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proc_po_mission  ON public.proc_purchase_orders(mission_id);
CREATE INDEX idx_proc_po_supplier ON public.proc_purchase_orders(supplier_id);
CREATE INDEX idx_proc_po_status   ON public.proc_purchase_orders(status);

-- 3.4 Order lines (produit / SKU = ligne de commande, pas de catalogue global)
CREATE TABLE public.proc_order_lines (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  UUID NOT NULL REFERENCES public.proc_purchase_orders(id) ON DELETE CASCADE,
  description        TEXT NOT NULL,
  specs              JSONB NOT NULL DEFAULT '{}'::jsonb,
  quantity           NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit               TEXT,
  unit_price         NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total         NUMERIC(20, 8) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  moq                NUMERIC(20, 8),
  lead_time_days     INTEGER,
  hs_code            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID REFERENCES auth.users(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proc_order_lines_po ON public.proc_order_lines(purchase_order_id);

-- 3.5 Supplier payments (append-only ; Cas 3 : attestation autonome OU lien rail)
CREATE TABLE public.proc_supplier_payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference          TEXT NOT NULL UNIQUE,
  purchase_order_id  UUID NOT NULL REFERENCES public.proc_purchase_orders(id),
  leg                public.proc_payment_leg NOT NULL,
  amount             NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
  currency           public.proc_currency NOT NULL DEFAULT 'CNY',
  method             public.proc_payment_method NOT NULL,
  occurred_at        TIMESTAMPTZ NOT NULL,
  settlement_mode    public.proc_settlement_mode NOT NULL DEFAULT 'attestation',
  rail_payment_id    UUID REFERENCES public.payments(id),
  paid_by            public.proc_paid_by,
  external_ref       TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         UUID NOT NULL REFERENCES auth.users(id),
  voided_at          TIMESTAMPTZ,
  voided_by          UUID REFERENCES auth.users(id),
  void_reason        TEXT,
  -- Cas 2 (rail) impose un lien vers le paiement du rail ; Cas 1 (attestation) non
  CONSTRAINT chk_proc_payment_rail_link
    CHECK (settlement_mode <> 'rail' OR rail_payment_id IS NOT NULL)
);
CREATE INDEX idx_proc_payments_po        ON public.proc_supplier_payments(purchase_order_id, occurred_at DESC);
CREATE INDEX idx_proc_payments_occurred  ON public.proc_supplier_payments(occurred_at DESC);
CREATE INDEX idx_proc_payments_active    ON public.proc_supplier_payments(purchase_order_id) WHERE voided_at IS NULL;
CREATE INDEX idx_proc_payments_rail      ON public.proc_supplier_payments(rail_payment_id) WHERE rail_payment_id IS NOT NULL;

-- 3.6 Production events (append-only timeline ; statut courant = dernier event)
CREATE TABLE public.proc_production_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id    UUID NOT NULL REFERENCES public.proc_purchase_orders(id),
  status               public.proc_production_status NOT NULL,
  occurred_at          TIMESTAMPTZ NOT NULL,
  note                 TEXT,
  evidence_document_id UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           UUID NOT NULL REFERENCES auth.users(id)
);
CREATE INDEX idx_proc_prod_events_po ON public.proc_production_events(purchase_order_id, occurred_at DESC);

-- 3.7 QC inspections (append-only ; result gate le solde côté UI/RPC)
CREATE TABLE public.proc_qc_inspections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES public.proc_purchase_orders(id),
  inspection_type     public.proc_qc_type NOT NULL,
  inspector_kind      public.proc_qc_inspector_kind NOT NULL,
  inspector_name      TEXT,
  aql_level           TEXT,
  result              public.proc_qc_result NOT NULL,
  defects             JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at         TIMESTAMPTZ NOT NULL,
  report_document_id  UUID,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  voided_at           TIMESTAMPTZ,
  voided_by           UUID REFERENCES auth.users(id),
  void_reason         TEXT
);
CREATE INDEX idx_proc_qc_po ON public.proc_qc_inspections(purchase_order_id, occurred_at DESC);

-- 3.8 Commissions (double-mode ; computed_* remplis par la RPC du Lot 1)
CREATE TABLE public.proc_commissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id          UUID NOT NULL REFERENCES public.proc_missions(id),
  purchase_order_id   UUID REFERENCES public.proc_purchase_orders(id),
  input_mode          public.proc_commission_mode NOT NULL,
  input_value         NUMERIC(20, 8) NOT NULL CHECK (input_value >= 0),
  base_amount         NUMERIC(20, 8) NOT NULL DEFAULT 0,
  computed_pct        NUMERIC(20, 8),
  computed_amount     NUMERIC(20, 8),
  factory_cost        NUMERIC(20, 8),
  client_price        NUMERIC(20, 8),
  negotiated_discount NUMERIC(20, 8),
  client_visible      BOOLEAN NOT NULL DEFAULT FALSE,
  currency            public.proc_currency NOT NULL DEFAULT 'CNY',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES auth.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proc_commissions_mission ON public.proc_commissions(mission_id);
CREATE INDEX idx_proc_commissions_po      ON public.proc_commissions(purchase_order_id);

-- 3.9 Documents = PREUVES jointes (polymorphe ; AUCUNE analyse/OCR)
CREATE TABLE public.proc_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       public.proc_document_entity NOT NULL,
  entity_id         UUID NOT NULL,
  doc_type          public.proc_document_type NOT NULL DEFAULT 'other',
  file_url          TEXT NOT NULL,
  file_name         TEXT,
  file_type         TEXT,
  caption           TEXT,
  uploaded_by_kind  public.proc_uploaded_by_kind,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id),
  archived_at       TIMESTAMPTZ
);
CREATE INDEX idx_proc_documents_entity ON public.proc_documents(entity_type, entity_id);

-- 3.10 Expenses (frais de mission ; append-only)
CREATE TABLE public.proc_expenses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id          UUID NOT NULL REFERENCES public.proc_missions(id),
  category            public.proc_expense_category NOT NULL,
  amount              NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
  currency            public.proc_currency NOT NULL DEFAULT 'CNY',
  occurred_at         TIMESTAMPTZ NOT NULL,
  billable_to_client  BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_document_id UUID,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  voided_at           TIMESTAMPTZ,
  voided_by           UUID REFERENCES auth.users(id),
  void_reason         TEXT
);
CREATE INDEX idx_proc_expenses_mission ON public.proc_expenses(mission_id, occurred_at DESC);

-- ── 4. Forward FKs vers proc_documents (preuves référencées) ──
ALTER TABLE public.proc_production_events
  ADD CONSTRAINT proc_prod_evidence_doc_fk
  FOREIGN KEY (evidence_document_id) REFERENCES public.proc_documents(id);
ALTER TABLE public.proc_qc_inspections
  ADD CONSTRAINT proc_qc_report_doc_fk
  FOREIGN KEY (report_document_id) REFERENCES public.proc_documents(id);
ALTER TABLE public.proc_expenses
  ADD CONSTRAINT proc_expense_receipt_doc_fk
  FOREIGN KEY (receipt_document_id) REFERENCES public.proc_documents(id);

-- ── 5. Reference generators (BZ-MS / BZ-PO / BZ-SP), miroir generate_deposit_reference ──
CREATE OR REPLACE FUNCTION public.generate_proc_mission_reference()
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE v_year TEXT; v_max_num INT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(reference, '^BZ-MS-' || v_year || '-', ''), reference)::int), 0) + 1
    INTO v_max_num
  FROM public.proc_missions WHERE reference LIKE 'BZ-MS-' || v_year || '-%';
  RETURN 'BZ-MS-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.generate_proc_po_reference()
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE v_year TEXT; v_max_num INT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(reference, '^BZ-PO-' || v_year || '-', ''), reference)::int), 0) + 1
    INTO v_max_num
  FROM public.proc_purchase_orders WHERE reference LIKE 'BZ-PO-' || v_year || '-%';
  RETURN 'BZ-PO-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.generate_proc_payment_reference()
RETURNS TEXT LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE v_year TEXT; v_max_num INT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(reference, '^BZ-SP-' || v_year || '-', ''), reference)::int), 0) + 1
    INTO v_max_num
  FROM public.proc_supplier_payments WHERE reference LIKE 'BZ-SP-' || v_year || '-%';
  RETURN 'BZ-SP-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
END;
$fn$;

-- ── 6. Vue dérivée : solde par commande (reste à payer) ──
-- security_invoker = true → la RLS des tables sous-jacentes s'applique.
CREATE VIEW public.proc_po_balances
WITH (security_invoker = true) AS
SELECT
  po.id                       AS purchase_order_id,
  po.reference,
  po.mission_id,
  po.supplier_id,
  po.currency,
  po.total_amount,
  COALESCE(SUM(p.amount) FILTER (WHERE p.voided_at IS NULL), 0)::numeric(20,8) AS paid_amount,
  (po.total_amount - COALESCE(SUM(p.amount) FILTER (WHERE p.voided_at IS NULL), 0))::numeric(20,8) AS outstanding_amount
FROM public.proc_purchase_orders po
LEFT JOIN public.proc_supplier_payments p ON p.purchase_order_id = po.id
GROUP BY po.id;

COMMENT ON VIEW public.proc_po_balances IS
  'Reste à payer par commande = total - somme des paiements actifs (non voided). Source d''affichage.';

-- ── 7. Row Level Security ──
-- SELECT autorisé si can_access_procurement() ; écritures refusées
-- au niveau RLS (elles passent par les RPC SECURITY DEFINER du Lot 1).
ALTER TABLE public.proc_suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_missions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_purchase_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_order_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_supplier_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_production_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_qc_inspections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_commissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proc_expenses           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Procurement users can view suppliers"        ON public.proc_suppliers          FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view missions"         ON public.proc_missions           FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view purchase orders"  ON public.proc_purchase_orders    FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view order lines"      ON public.proc_order_lines        FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view payments"         ON public.proc_supplier_payments  FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view production events" ON public.proc_production_events  FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view qc"               ON public.proc_qc_inspections     FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view commissions"      ON public.proc_commissions        FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view documents"        ON public.proc_documents          FOR SELECT USING (public.can_access_procurement(auth.uid()));
CREATE POLICY "Procurement users can view expenses"         ON public.proc_expenses           FOR SELECT USING (public.can_access_procurement(auth.uid()));

-- ── 8. Comments (documentation) ──
COMMENT ON TABLE public.proc_suppliers         IS 'Annuaire fournisseurs PARTAGÉ (usine vs trading company), org-wide. Prix privés sur la commande, pas ici.';
COMMENT ON TABLE public.proc_missions          IS 'Projet/séjour d''achat d''un client (BZ-MS). Back-dating via started_on/ended_on.';
COMMENT ON TABLE public.proc_purchase_orders   IS 'Commande à un fournisseur dans une mission (BZ-PO). Incoterm enum, deposit_pct.';
COMMENT ON TABLE public.proc_order_lines       IS 'Produit/SKU = ligne de commande (HS code, MOQ, lead time par produit).';
COMMENT ON TABLE public.proc_supplier_payments IS 'Acomptes/soldes (BZ-SP). Append-only + void. Cas 3 : attestation autonome OU lien rail (rail_payment_id → payments).';
COMMENT ON TABLE public.proc_production_events  IS 'Timeline de production append-only. Statut courant = dernier event.';
COMMENT ON TABLE public.proc_qc_inspections    IS 'Inspections QC (PPI/DUPRO/PSI/loading). result gate le solde côté UI/RPC (gate souple).';
COMMENT ON TABLE public.proc_commissions       IS 'Commission Bonzini double-mode (% ou montant). factory_cost/client_price = marge interne.';
COMMENT ON TABLE public.proc_documents         IS 'PREUVES jointes (photos/PDF). AUCUNE analyse/OCR. Polymorphe (entity_type/entity_id).';
COMMENT ON TABLE public.proc_expenses          IS 'Frais de mission (hôtel/transport/...). Append-only + void. billable_to_client.';

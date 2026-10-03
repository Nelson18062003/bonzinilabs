-- ============================================================================
-- Le dossier conteneur, réduit à ce que lisent les suites cargo_dossier :
-- permissions cargo, cargo_costs, cargo_documents, le déclencheur updated_at.
-- (schéma réel : 20260911120000_cargo_module.sql, 20260911150000_cargo_lookups_and_documents.sql,
--  20260912140000_cargo_dossier_depth.sql, 20260912180000_cargo_packages.sql)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
      AND CASE _permission
        WHEN 'canViewCargo'   THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canManageCargo' THEN ur.role::text IN ('super_admin','ops')
        ELSE false END
  )
$fn$;

CREATE OR REPLACE FUNCTION public.cargo_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.cargo_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'OTHER',
  label text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.cargo_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('BL','INVOICE','PACKING_LIST','TELEX','BESC','CUSTOMS','OTHER')),
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cargo_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_documents_read ON public.cargo_documents;
CREATE POLICY cargo_documents_read ON public.cargo_documents FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS cargo_documents_insert ON public.cargo_documents;
CREATE POLICY cargo_documents_insert ON public.cargo_documents FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND uploaded_by = auth.uid());
DROP POLICY IF EXISTS cargo_costs_read ON public.cargo_costs;
CREATE POLICY cargo_costs_read ON public.cargo_costs FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

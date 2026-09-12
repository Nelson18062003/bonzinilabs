-- ============================================================
-- Bonzini Cargo — de quoi remplir le dossier complet.
--
-- L'écran dossier gagne des onglets (Documents · Douane · Coûts · Client).
-- Trois manques côté données :
--   1. les jalons camerounais après l'arrivée (avis d'arrivée, franchise,
--      déclaration, bon à enlever, restitution du vide) — des dates simples,
--      posées sur cargo_shipments ;
--   2. les coûts réels du dossier (fret, THC, surestaries, douane, transit,
--      transport final) — une table ;
--   3. le lien vers le client Bonzini (colonne client_id déjà présente,
--      jamais alimentée) — rien à créer, juste à s'en servir.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS avant CREATE POLICY.
-- ============================================================

-- ── 1) Jalons et références douane sur le dossier ─────────────────────────
ALTER TABLE public.cargo_shipments
  ADD COLUMN IF NOT EXISTS arrival_notice_at        timestamptz,
  ADD COLUMN IF NOT EXISTS free_time_ends_on        date,
  ADD COLUMN IF NOT EXISTS customs_declaration_ref  text,
  ADD COLUMN IF NOT EXISTS customs_cleared_at       timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_order_at        timestamptz,
  ADD COLUMN IF NOT EXISTS gate_out_at              timestamptz,
  ADD COLUMN IF NOT EXISTS empty_returned_at        timestamptz,
  ADD COLUMN IF NOT EXISTS besc_number              text,
  ADD COLUMN IF NOT EXISTS goods_description        text,
  ADD COLUMN IF NOT EXISTS gross_weight_kg          numeric(12,2) CHECK (gross_weight_kg IS NULL OR gross_weight_kg >= 0),
  ADD COLUMN IF NOT EXISTS packages_count           integer CHECK (packages_count IS NULL OR packages_count >= 0);

COMMENT ON COLUMN public.cargo_shipments.free_time_ends_on IS
  'Fin de la franchise au port : au-delà, les surestaries courent. Saisi à la main depuis l''avis d''arrivée.';

-- ── 2) Les coûts du dossier ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_costs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('FREIGHT','SURCHARGE','THC','DEMURRAGE','STORAGE','CUSTOMS_DUTY','CUSTOMS_FEE','BESC','INSURANCE','TRANSIT','TRUCKING','OTHER')),
  label        text,
  amount       numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency     text NOT NULL DEFAULT 'XAF' CHECK (currency IN ('XAF','USD','EUR','CNY')),
  incurred_on  date,
  paid         boolean NOT NULL DEFAULT false,
  invoice_ref  text,
  note         text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargo_costs_shipment_idx ON public.cargo_costs (shipment_id, incurred_on);

DROP TRIGGER IF EXISTS cargo_costs_touch ON public.cargo_costs;
CREATE TRIGGER cargo_costs_touch BEFORE UPDATE ON public.cargo_costs
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();

ALTER TABLE public.cargo_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargo_costs_read ON public.cargo_costs;
CREATE POLICY cargo_costs_read ON public.cargo_costs
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

DROP POLICY IF EXISTS cargo_costs_insert ON public.cargo_costs;
CREATE POLICY cargo_costs_insert ON public.cargo_costs
  FOR INSERT TO authenticated WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND created_by = auth.uid());

-- Volontairement SANS « created_by = auth.uid() » : l'ops travaille à
-- plusieurs sur un même dossier, et un collègue doit pouvoir cocher « payé »
-- sur une ligne qu'il n'a pas saisie. La propriété est protégée autrement,
-- par le déclencheur ci-dessous — une politique ne saurait pas distinguer
-- « je modifie le montant » de « je me réattribue la ligne ».
DROP POLICY IF EXISTS cargo_costs_update ON public.cargo_costs;
CREATE POLICY cargo_costs_update ON public.cargo_costs
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));

-- Deux colonnes sont posées à la création et ne se réécrivent jamais :
-- l'auteur (sinon la trace de qui a saisi le coût se perd) et le dossier
-- (sinon un coût peut être déplacé d'un conteneur à l'autre, ce qui fausse
-- le prix de revient des deux). On les rétablit en silence plutôt que de
-- refuser la mise à jour : le reste du patch est légitime.
CREATE OR REPLACE FUNCTION public.cargo_costs_freeze_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.created_by  := OLD.created_by;
  NEW.shipment_id := OLD.shipment_id;
  NEW.created_at  := OLD.created_at;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cargo_costs_freeze_owner() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.cargo_costs_freeze_owner() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Figer auteur et dossier d''une ligne de cout (declencheur interne)"}';

DROP TRIGGER IF EXISTS cargo_costs_freeze ON public.cargo_costs;
CREATE TRIGGER cargo_costs_freeze BEFORE UPDATE ON public.cargo_costs
  FOR EACH ROW EXECUTE FUNCTION public.cargo_costs_freeze_owner();

DROP POLICY IF EXISTS cargo_costs_delete ON public.cargo_costs;
CREATE POLICY cargo_costs_delete ON public.cargo_costs
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

NOTIFY pgrst, 'reload schema';

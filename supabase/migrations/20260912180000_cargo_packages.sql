-- ============================================================
-- Bonzini Cargo — ce qu'il y a DANS la boîte.
--
-- Le dossier savait où était le conteneur, ce qu'il coûtait et quels papiers
-- lui manquaient. Il ne savait pas ce qu'il transporte : `packages_count` et
-- `gross_weight_kg` donnent un total, jamais le détail. Or c'est le détail qui
-- permet de répondre aux vraies questions de l'ops :
--   « est-ce que ça rentre ? » · « il reste combien de place ? »
--   « qu'est-ce qui est en dessous ? » · « on a payé pour du vide ? »
--
-- Une ligne = un lot de colis identiques (mêmes dimensions, même poids).
-- On ne modélise pas chaque carton : un lot porte sa quantité. C'est ce que
-- donne une packing list de fournisseur, donc c'est saisissable tel quel.
--
-- Les dimensions sont en CENTIMÈTRES et le poids en KILOGRAMMES — les unités
-- des packing lists chinoises. Aucune conversion à la saisie, donc aucune
-- erreur de conversion.
--
-- Idempotent : CREATE TABLE IF NOT EXISTS, DROP POLICY avant CREATE POLICY.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cargo_packages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  label        text NOT NULL,
  kind         text NOT NULL DEFAULT 'CARTON'
               CHECK (kind IN ('CARTON','PALLET','CRATE','BAG','DRUM','BUNDLE','OTHER')),
  qty          integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  length_cm    numeric(7,1) NOT NULL CHECK (length_cm > 0 AND length_cm <= 1400),
  width_cm     numeric(7,1) NOT NULL CHECK (width_cm  > 0 AND width_cm  <= 300),
  height_cm    numeric(7,1) NOT NULL CHECK (height_cm > 0 AND height_cm <= 300),
  -- Poids d'UN colis, pas du lot : c'est ce qui est écrit sur la packing list.
  weight_kg    numeric(9,2) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  -- Un colis non gerbable ne reçoit rien au-dessus de lui dans le plan de charge.
  stackable    boolean NOT NULL DEFAULT true,
  supplier     text,
  note         text,
  -- Ordre de saisie : le plan de chargement est déterministe, donc deux
  -- personnes qui ouvrent le dossier voient exactement la même vue.
  position     integer NOT NULL DEFAULT 0,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cargo_packages_shipment_idx
  ON public.cargo_packages (shipment_id, position, created_at);

DROP TRIGGER IF EXISTS cargo_packages_touch ON public.cargo_packages;
CREATE TRIGGER cargo_packages_touch BEFORE UPDATE ON public.cargo_packages
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();

-- Même garde-fou que sur les coûts : l'auteur et le dossier ne se réécrivent
-- pas. Sans cela, un lot peut être déplacé d'un conteneur à l'autre et les
-- deux plans de chargement deviennent faux.
CREATE OR REPLACE FUNCTION public.cargo_packages_freeze_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.created_by  := OLD.created_by;
  NEW.shipment_id := OLD.shipment_id;
  NEW.created_at  := OLD.created_at;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cargo_packages_freeze_owner() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.cargo_packages_freeze_owner() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Figer auteur et dossier d''un lot de colis (declencheur interne)"}';

DROP TRIGGER IF EXISTS cargo_packages_freeze ON public.cargo_packages;
CREATE TRIGGER cargo_packages_freeze BEFORE UPDATE ON public.cargo_packages
  FOR EACH ROW EXECUTE FUNCTION public.cargo_packages_freeze_owner();

ALTER TABLE public.cargo_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargo_packages_read ON public.cargo_packages;
CREATE POLICY cargo_packages_read ON public.cargo_packages
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

DROP POLICY IF EXISTS cargo_packages_insert ON public.cargo_packages;
CREATE POLICY cargo_packages_insert ON public.cargo_packages
  FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND created_by = auth.uid());

DROP POLICY IF EXISTS cargo_packages_update ON public.cargo_packages;
CREATE POLICY cargo_packages_update ON public.cargo_packages
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));

DROP POLICY IF EXISTS cargo_packages_delete ON public.cargo_packages;
CREATE POLICY cargo_packages_delete ON public.cargo_packages
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

NOTIFY pgrst, 'reload schema';

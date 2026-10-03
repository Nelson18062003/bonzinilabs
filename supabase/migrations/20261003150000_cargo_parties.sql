-- ============================================================
-- Bonzini Cargo — les parties prenantes d'un conteneur.
--
-- Un conteneur fait travailler une dizaine d'acteurs EXTERNES à Bonzini :
-- le transitaire en Chine (booking, camion, douane d'export), le chargeur
-- inscrit sur le B/L, l'armateur, le consignataire du navire au Cameroun,
-- le ou la déclarant(e) en douane, l'agent qui délivre le BESC, l'expert
-- qui certifie les véhicules, SGS pour le CIVIC, le terminal, le
-- transporteur… Jusqu'ici leurs noms vivaient dans les notes et les
-- messages WhatsApp.
--
--   1. cargo_parties — l'ANNUAIRE : une organisation ou une personne, avec
--      son contact, ses téléphones, son mail. Réutilisable d'un conteneur à
--      l'autre (le même transitaire revient souvent).
--   2. cargo_shipment_parties — QUI fait QUOI sur CE conteneur : une
--      partie, un rôle, une note. Une partie peut tenir deux rôles
--      (KASSUMAYE est transitaire ET chargeur sur le B/L de MIEU3611115).
--
-- Écriture par l'écran sous RLS (canManageCargo), lecture canViewCargo ;
-- pas de RPC (même règle que coûts, colis et classeur). Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cargo_parties (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  contact_name  text CHECK (contact_name IS NULL OR char_length(contact_name) <= 160),
  phone         text CHECK (phone IS NULL OR char_length(phone) <= 40),
  whatsapp      text CHECK (whatsapp IS NULL OR char_length(whatsapp) <= 40),
  email         text CHECK (email IS NULL OR char_length(email) <= 200),
  city          text CHECK (city IS NULL OR char_length(city) <= 120),
  country       text CHECK (country IS NULL OR char_length(country) <= 80),
  note          text CHECK (note IS NULL OR char_length(note) <= 2000),
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargo_parties_name_idx ON public.cargo_parties (lower(name));

COMMENT ON TABLE public.cargo_parties IS
  'Annuaire des acteurs externes du cargo (transitaire, chargeur, déclarant, armateur, agent BESC…). Le rôle sur un conteneur est dans cargo_shipment_parties.';

CREATE TABLE IF NOT EXISTS public.cargo_shipment_parties (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  party_id     uuid NOT NULL REFERENCES public.cargo_parties(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN (
    'SUPPLIER','WAREHOUSE','FORWARDER','SHIPPER','CARRIER','SHIPPING_AGENT','CONSIGNEE','NOTIFY',
    'DECLARANT','CUSTOMS_BROKER','BESC_AGENT','INSPECTION','EXPERT','TERMINAL','TRUCKER','INSURER','OTHER'
  )),
  note         text CHECK (note IS NULL OR char_length(note) <= 1000),
  position     integer NOT NULL DEFAULT 0,
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, party_id, role)
);
CREATE INDEX IF NOT EXISTS cargo_shipment_parties_shipment_idx ON public.cargo_shipment_parties (shipment_id, position);
CREATE INDEX IF NOT EXISTS cargo_shipment_parties_party_idx ON public.cargo_shipment_parties (party_id);

COMMENT ON TABLE public.cargo_shipment_parties IS
  'Qui fait quoi sur un conteneur : une partie de l''annuaire, un rôle (déclarant, transitaire, chargeur…), une note.';

DROP TRIGGER IF EXISTS cargo_parties_touch ON public.cargo_parties;
CREATE TRIGGER cargo_parties_touch BEFORE UPDATE ON public.cargo_parties
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();
DROP TRIGGER IF EXISTS cargo_shipment_parties_touch ON public.cargo_shipment_parties;
CREATE TRIGGER cargo_shipment_parties_touch BEFORE UPDATE ON public.cargo_shipment_parties
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();

-- Auteur figé ; un rôle ne change ni de conteneur ni de partie (on retire,
-- puis on ajoute : sinon l'historique d'un dossier se réécrit en silence).
CREATE OR REPLACE FUNCTION public.cargo_parties_freeze_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  IF TG_TABLE_NAME = 'cargo_shipment_parties' THEN
    NEW.shipment_id := OLD.shipment_id;
    NEW.party_id    := OLD.party_id;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cargo_parties_freeze_owner() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.cargo_parties_freeze_owner() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Figer auteur, conteneur et partie d''un intervenant cargo (declencheur interne)"}';

DROP TRIGGER IF EXISTS cargo_parties_freeze ON public.cargo_parties;
CREATE TRIGGER cargo_parties_freeze BEFORE UPDATE ON public.cargo_parties
  FOR EACH ROW EXECUTE FUNCTION public.cargo_parties_freeze_owner();
DROP TRIGGER IF EXISTS cargo_shipment_parties_freeze ON public.cargo_shipment_parties;
CREATE TRIGGER cargo_shipment_parties_freeze BEFORE UPDATE ON public.cargo_shipment_parties
  FOR EACH ROW EXECUTE FUNCTION public.cargo_parties_freeze_owner();

ALTER TABLE public.cargo_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_shipment_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargo_parties_read ON public.cargo_parties;
CREATE POLICY cargo_parties_read ON public.cargo_parties
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS cargo_parties_insert ON public.cargo_parties;
CREATE POLICY cargo_parties_insert ON public.cargo_parties
  FOR INSERT TO authenticated WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND created_by = auth.uid());
DROP POLICY IF EXISTS cargo_parties_update ON public.cargo_parties;
CREATE POLICY cargo_parties_update ON public.cargo_parties
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));
DROP POLICY IF EXISTS cargo_parties_delete ON public.cargo_parties;
CREATE POLICY cargo_parties_delete ON public.cargo_parties
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

DROP POLICY IF EXISTS cargo_shipment_parties_read ON public.cargo_shipment_parties;
CREATE POLICY cargo_shipment_parties_read ON public.cargo_shipment_parties
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS cargo_shipment_parties_insert ON public.cargo_shipment_parties;
CREATE POLICY cargo_shipment_parties_insert ON public.cargo_shipment_parties
  FOR INSERT TO authenticated WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND created_by = auth.uid());
DROP POLICY IF EXISTS cargo_shipment_parties_update ON public.cargo_shipment_parties;
CREATE POLICY cargo_shipment_parties_update ON public.cargo_shipment_parties
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));
DROP POLICY IF EXISTS cargo_shipment_parties_delete ON public.cargo_shipment_parties;
CREATE POLICY cargo_shipment_parties_delete ON public.cargo_shipment_parties
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

NOTIFY pgrst, 'reload schema';

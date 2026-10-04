-- ============================================================
-- Bonzini Cargo — les étapes de dédouanement d'un conteneur.
--
-- L'onglet « Douane & arrivée » n'avait que six dates figées. Le terrain
-- (MIEU3611115, octobre 2026) en demande bien plus : le BESC et le CIVIC
-- AVANT l'arrivée, le télex, l'avis d'arrivée, le bon à délivrer du
-- consignataire, la déclaration, la visite, la liquidation, le bon à
-- enlever, la sortie, la restitution du vide — chacune avec sa date, sa
-- référence, sa note et SES PIÈCES ; et des étapes que personne n'avait
-- prévues.
--
-- cargo_steps : une étape = un titre, une phase, un état, des dates, une
-- référence, une note, et une pièce du classeur (folder_id) qui porte ses
-- fichiers — le même fichier se voit dans Documents et dans Douane.
-- `key` identifie les étapes standard (BESC, CIVIC, DECLARATION…) ; une
-- étape ajoutée par l'équipe n'en a pas.
-- Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cargo_steps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  key          text CHECK (key IS NULL OR key ~ '^[A-Z_]{2,40}$'),
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  phase        text NOT NULL DEFAULT 'clearance' CHECK (phase IN ('before','arrival','clearance','exit')),
  status       text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done','skipped')),
  due_on       date,
  done_on      date,
  reference    text CHECK (reference IS NULL OR char_length(reference) <= 120),
  note         text CHECK (note IS NULL OR char_length(note) <= 2000),
  folder_id    uuid REFERENCES public.cargo_doc_folders(id) ON DELETE SET NULL,
  position     integer NOT NULL DEFAULT 0,
  created_by   uuid DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cargo_steps_key_uidx ON public.cargo_steps (shipment_id, key) WHERE key IS NOT NULL;
CREATE INDEX IF NOT EXISTS cargo_steps_shipment_idx ON public.cargo_steps (shipment_id, position);

COMMENT ON TABLE public.cargo_steps IS
  'Étapes de dédouanement et de sortie d''un conteneur (BESC, CIVIC, déclaration, BAE…), avec dates, référence, note et pièce du classeur.';

DROP TRIGGER IF EXISTS cargo_steps_touch ON public.cargo_steps;
CREATE TRIGGER cargo_steps_touch BEFORE UPDATE ON public.cargo_steps
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();

-- Le conteneur et l'auteur ne se réécrivent pas ; la pièce liée doit être
-- une pièce du MÊME conteneur.
CREATE OR REPLACE FUNCTION public.cargo_steps_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.shipment_id := OLD.shipment_id;
    NEW.created_by  := OLD.created_by;
    NEW.created_at  := OLD.created_at;
  END IF;
  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cargo_doc_folders f WHERE f.id = NEW.folder_id AND f.shipment_id = NEW.shipment_id
  ) THEN
    RAISE EXCEPTION 'Cette pièce appartient à un autre conteneur' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cargo_steps_guard() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.cargo_steps_guard() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Garder une étape de douane dans son conteneur (declencheur interne)"}';

DROP TRIGGER IF EXISTS cargo_steps_guard ON public.cargo_steps;
CREATE TRIGGER cargo_steps_guard BEFORE INSERT OR UPDATE ON public.cargo_steps
  FOR EACH ROW EXECUTE FUNCTION public.cargo_steps_guard();

ALTER TABLE public.cargo_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargo_steps_read ON public.cargo_steps;
CREATE POLICY cargo_steps_read ON public.cargo_steps
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS cargo_steps_insert ON public.cargo_steps;
CREATE POLICY cargo_steps_insert ON public.cargo_steps
  FOR INSERT TO authenticated WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND created_by = auth.uid());
DROP POLICY IF EXISTS cargo_steps_update ON public.cargo_steps;
CREATE POLICY cargo_steps_update ON public.cargo_steps
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));
DROP POLICY IF EXISTS cargo_steps_delete ON public.cargo_steps;
CREATE POLICY cargo_steps_delete ON public.cargo_steps
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

NOTIFY pgrst, 'reload schema';

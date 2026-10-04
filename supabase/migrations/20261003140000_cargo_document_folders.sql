-- ============================================================
-- Bonzini Cargo — le classeur du dossier, refait.
--
-- Avant : une ligne par « type » figé (BL, télex, facture, packing list,
-- BESC, douane, autre), un bouton « Ajouter » qui posait UN fichier, aucune
-- façon de renommer, de déplacer, ni de créer une pièce qui n'était pas
-- prévue. Le terrain en demande beaucoup plus : trois originaux du B/L, un
-- certificat d'identification par véhicule, l'attestation fiscale, les
-- photos du chargement, la facture de fret…
--
-- Maintenant :
--   1. cargo_doc_folders — les PIÈCES du dossier, créées librement par
--      l'équipe (titre libre + une catégorie pour les retrouver et pour la
--      liste « à faire ») ; `expected_count` dit combien de fichiers on
--      attend (3 pour « B/L originaux ») ;
--   2. cargo_documents gagne folder_id (la pièce), cost_id (le coût qu'il
--      justifie), title et note (modifiables), et les nouvelles catégories ;
--   3. une politique UPDATE sur cargo_documents (renommer, déplacer), avec
--      un déclencheur qui fige ce qui ne doit jamais bouger (dossier,
--      chemin de stockage, auteur) et refuse une pièce ou un coût d'un AUTRE
--      conteneur.
--
-- Pas de RPC : comme pour les coûts et les colis, l'écran écrit dans les
-- tables sous RLS (canManageCargo), et Mola lit ces tables.
-- Idempotent.
-- ============================================================

-- ── 1) Les catégories, une seule liste pour les deux tables ───────────────
-- BL · TELEX · INVOICE (facture commerciale) · PACKING_LIST · BESC ·
-- CUSTOMS (déclaration, quittance, BAE) · FREIGHT (facture de fret) ·
-- CERTIFICATE (CICQ, origine, inspection) · VEHICLE (carte grise, dossier
-- export d'un véhicule) · TAX (NIU, attestation d'immatriculation) ·
-- PHOTO · CORRESPONDENCE (mails, courriers) · COST (justificatif de coût) ·
-- OTHER.

ALTER TABLE public.cargo_documents DROP CONSTRAINT IF EXISTS cargo_documents_kind_check;
ALTER TABLE public.cargo_documents ADD CONSTRAINT cargo_documents_kind_check CHECK (kind IN (
  'BL','TELEX','INVOICE','PACKING_LIST','BESC','CUSTOMS','FREIGHT','CERTIFICATE',
  'VEHICLE','TAX','PHOTO','CORRESPONDENCE','COST','OTHER'
));

-- ── 2) Les pièces du dossier ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_doc_folders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id     uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  category        text NOT NULL DEFAULT 'OTHER' CHECK (category IN (
    'BL','TELEX','INVOICE','PACKING_LIST','BESC','CUSTOMS','FREIGHT','CERTIFICATE',
    'VEHICLE','TAX','PHOTO','CORRESPONDENCE','COST','OTHER'
  )),
  note            text CHECK (note IS NULL OR char_length(note) <= 2000),
  expected_count  integer CHECK (expected_count IS NULL OR expected_count BETWEEN 1 AND 99),
  position        integer NOT NULL DEFAULT 0,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargo_doc_folders_shipment_idx ON public.cargo_doc_folders (shipment_id, position);

COMMENT ON TABLE public.cargo_doc_folders IS
  'Pièces du classeur d''un conteneur (B/L originaux, certificats, photos…), créées librement. Les fichiers sont dans cargo_documents.folder_id.';
COMMENT ON COLUMN public.cargo_doc_folders.expected_count IS
  'Nombre de fichiers attendus pour cette pièce (3 pour les trois originaux du B/L). NULL = pas d''attente.';

DROP TRIGGER IF EXISTS cargo_doc_folders_touch ON public.cargo_doc_folders;
CREATE TRIGGER cargo_doc_folders_touch BEFORE UPDATE ON public.cargo_doc_folders
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();

-- Le dossier et l'auteur d'une pièce ne se réécrivent pas (même règle que
-- cargo_costs_freeze_owner) : on les rétablit en silence.
CREATE OR REPLACE FUNCTION public.cargo_doc_folders_freeze_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.shipment_id := OLD.shipment_id;
  NEW.created_by  := OLD.created_by;
  NEW.created_at  := OLD.created_at;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cargo_doc_folders_freeze_owner() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.cargo_doc_folders_freeze_owner() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Figer dossier et auteur d''une piece du classeur (declencheur interne)"}';

DROP TRIGGER IF EXISTS cargo_doc_folders_freeze ON public.cargo_doc_folders;
CREATE TRIGGER cargo_doc_folders_freeze BEFORE UPDATE ON public.cargo_doc_folders
  FOR EACH ROW EXECUTE FUNCTION public.cargo_doc_folders_freeze_owner();

ALTER TABLE public.cargo_doc_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargo_doc_folders_read ON public.cargo_doc_folders;
CREATE POLICY cargo_doc_folders_read ON public.cargo_doc_folders
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

DROP POLICY IF EXISTS cargo_doc_folders_insert ON public.cargo_doc_folders;
CREATE POLICY cargo_doc_folders_insert ON public.cargo_doc_folders
  FOR INSERT TO authenticated
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND created_by = auth.uid());

DROP POLICY IF EXISTS cargo_doc_folders_update ON public.cargo_doc_folders;
CREATE POLICY cargo_doc_folders_update ON public.cargo_doc_folders
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));

DROP POLICY IF EXISTS cargo_doc_folders_delete ON public.cargo_doc_folders;
CREATE POLICY cargo_doc_folders_delete ON public.cargo_doc_folders
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

-- ── 3) Les fichiers : pièce, coût justifié, titre, note ───────────────────
ALTER TABLE public.cargo_documents
  ADD COLUMN IF NOT EXISTS folder_id  uuid REFERENCES public.cargo_doc_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_id    uuid REFERENCES public.cargo_costs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title      text CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 160),
  ADD COLUMN IF NOT EXISTS note       text CHECK (note IS NULL OR char_length(note) <= 2000),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS cargo_documents_folder_idx ON public.cargo_documents (folder_id);
CREATE INDEX IF NOT EXISTS cargo_documents_cost_idx ON public.cargo_documents (cost_id);

COMMENT ON COLUMN public.cargo_documents.folder_id IS 'Pièce du classeur. NULL = non classé (la pièce a été supprimée, ou le fichier n''a jamais été rangé).';
COMMENT ON COLUMN public.cargo_documents.cost_id IS 'Coût que ce fichier justifie (photo du reçu, facture). Supprimer le coût ne supprime pas le fichier.';

-- Un fichier ne change jamais de conteneur, de chemin ni d'auteur ; et sa
-- pièce comme son coût doivent appartenir au MÊME conteneur — sinon une
-- facture du conteneur A pourrait justifier un coût du conteneur B.
CREATE OR REPLACE FUNCTION public.cargo_documents_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.shipment_id  := OLD.shipment_id;
    NEW.storage_path := OLD.storage_path;
    NEW.file_name    := OLD.file_name;
    NEW.mime_type    := OLD.mime_type;
    NEW.size_bytes   := OLD.size_bytes;
    NEW.uploaded_by  := OLD.uploaded_by;
    NEW.created_at   := OLD.created_at;
    NEW.updated_at   := now();
  END IF;
  IF NEW.folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cargo_doc_folders f WHERE f.id = NEW.folder_id AND f.shipment_id = NEW.shipment_id
  ) THEN
    RAISE EXCEPTION 'Cette pièce appartient à un autre conteneur' USING ERRCODE = '23514';
  END IF;
  IF NEW.cost_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cargo_costs c WHERE c.id = NEW.cost_id AND c.shipment_id = NEW.shipment_id
  ) THEN
    RAISE EXCEPTION 'Ce coût appartient à un autre conteneur' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.cargo_documents_guard() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.cargo_documents_guard() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Garder un fichier cargo dans son conteneur (declencheur interne)"}';

DROP TRIGGER IF EXISTS cargo_documents_guard ON public.cargo_documents;
CREATE TRIGGER cargo_documents_guard BEFORE INSERT OR UPDATE ON public.cargo_documents
  FOR EACH ROW EXECUTE FUNCTION public.cargo_documents_guard();

DROP POLICY IF EXISTS cargo_documents_update ON public.cargo_documents;
CREATE POLICY cargo_documents_update ON public.cargo_documents
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));

NOTIFY pgrst, 'reload schema';

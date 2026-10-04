-- ============================================================================
-- Branche claude/bonzini-cargo-logistics-dcxcys : migration CONSOLIDÉE
-- (Supabase / PostgreSQL). Générée le 2026-10-04.
--
-- CE FICHIER SUFFIT pour toute la branche : c'est la copie exacte, dans
-- l'ordre d'exécution, des 9 migrations de supabase/migrations/ qu'elle
-- ajoute. Il suppose que main (jusqu'à la PR #222) est déjà passé.
--
-- §1 à §3 (26/09) : suivi CMA CGM, clés dans Vault, correctif notification.
-- §4 à §9 (03-04/10) : le dossier conteneur refait (classeur, parties
--   prenantes, coûts, chargement mixte, suivi manuel, étapes de douane).
--
-- État en production (projet fmhsohrgbznqmcvqktjw), vérifié le 04/10/2026 :
--   TOUT EST DÉJÀ APPLIQUÉ. §4 à §9 sont inscrits dans
--   supabase_migrations.schema_migrations ; §1 à §3 sont passés par le SQL
--   Editor (migrations/20260926_consolidated.sql) et leurs fonctions sont en
--   place. Ce fichier sert pour un nouvel environnement ou une restauration.
--
-- Idempotent : CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- DROP CONSTRAINT/POLICY/TRIGGER IF EXISTS avant de recréer, CREATE OR
-- REPLACE FUNCTION. Repasser le fichier est sans effet. Chaque migration est
-- rejouée deux fois par supabase/tests/run.sh pour le prouver.
--
-- Utilisation : SQL Editor du projet, coller le fichier en entier, exécuter.
-- ============================================================================


-- ############################################################################
-- §1  CMA CGM interrogeable dans request_cargo_lookup
--     source : supabase/migrations/20260926100000_cargo_lookup_cmacgm.sql
--     (déjà dans migrations/20260926_consolidated.sql §1)
-- ############################################################################

-- ============================================================
-- Cargo : CMA CGM devient interrogeable (API Track & Trace, clé obtenue le 24/09).
--
-- request_cargo_lookup marquait toute référence CMA CGM « unsupported » sans
-- appeler l'edge function. Désormais MAERSK et CMA_CGM partent en « pending »
-- et déclenchent cargo-lookup (qui choisit le connecteur selon la ligne).
-- Corps identique à 20260911150000 hors la liste des armateurs interrogeables.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_cargo_lookup(p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref         text := upper(regexp_replace(coalesce(p_reference, ''), '[^A-Za-z0-9]', '', 'g'));
  v_carrier     text;
  v_type        text;
  v_id          uuid;
  v_url         text;
  v_service_key text;
  v_live        boolean;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_ref) < 6 OR length(v_ref) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Référence trop courte ou trop longue');
  END IF;
  SELECT d.carrier, d.reference_type INTO v_carrier, v_type FROM public.cargo_detect_carrier(v_ref) d;
  v_live := v_carrier IN ('MAERSK', 'CMA_CGM');

  INSERT INTO public.cargo_lookups (reference, reference_type, carrier, status, requested_by, error, completed_at)
  VALUES (
    v_ref, v_type, v_carrier,
    CASE WHEN v_live THEN 'pending' ELSE 'unsupported' END,
    auth.uid(),
    CASE
      WHEN v_live THEN NULL
      WHEN v_carrier = 'UNKNOWN' THEN 'Format non reconnu. Attendu : B/L Maersk (9 chiffres), B/L CMA CGM (3 lettres + 7 chiffres) ou numéro de conteneur (4 lettres + 7 chiffres).'
      ELSE 'Armateur reconnu (' || v_carrier || ') mais pas encore interrogeable : agrégateur à brancher.'
    END,
    CASE WHEN v_live THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;

  IF v_live THEN
    SELECT decrypted_secret INTO v_url         FROM vault.decrypted_secrets WHERE name = 'project_url';
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
    IF v_url IS NULL OR v_service_key IS NULL THEN
      UPDATE public.cargo_lookups SET status = 'error', error = 'Configuration serveur incomplète (Vault)', completed_at = now() WHERE id = v_id;
    ELSE
      BEGIN
        PERFORM net.http_post(
          url     := v_url || '/functions/v1/cargo-lookup',
          body    := jsonb_build_object('lookup_id', v_id),
          headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_service_key, 'Authorization', 'Bearer ' || v_service_key),
          timeout_milliseconds := 15000
        );
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.cargo_lookups SET status = 'error', error = 'Appel de la recherche impossible : ' || SQLERRM, completed_at = now() WHERE id = v_id;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'lookup_id', v_id, 'carrier', v_carrier, 'reference', v_ref, 'reference_type', v_type);
END;
$$;
REVOKE ALL ON FUNCTION public.request_cargo_lookup(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_cargo_lookup(text) TO authenticated;
COMMENT ON FUNCTION public.request_cargo_lookup(text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Suivre une reference (B/L, booking ou conteneur) chez l''armateur"}';


-- ############################################################################
-- §2  Clés armateur lues dans Vault par les edge functions (cargo_secret)
--     source : supabase/migrations/20260926110000_cargo_secret_from_vault.sql
--     (déjà dans migrations/20260926_consolidated.sql §2)
-- ############################################################################

-- ============================================================
-- Clés des armateurs lisibles depuis Vault par les edge functions cargo quand
-- le secret n'est pas posé dans l'environnement des fonctions (Edge Functions →
-- Secrets). Seule la clé service peut appeler cette RPC (REVOKE public / anon /
-- authenticated + contrôle du rôle JWT) ; liste blanche de noms, jamais de
-- lecture libre du coffre. La clé elle-même est posée dans Vault à la main
-- (vault.create_secret), jamais dans une migration ni dans le dépôt.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cargo_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF p_name NOT IN ('CMACGM_API_KEY', 'MAERSK_CONSUMER_KEY', 'AISSTREAM_API_KEY') THEN
    RAISE EXCEPTION 'Secret inconnu';
  END IF;
  SELECT decrypted_secret INTO v_value FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN v_value;
END;
$$;
REVOKE ALL ON FUNCTION public.cargo_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cargo_secret(text) TO service_role;
COMMENT ON FUNCTION public.cargo_secret(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCargo","label":"Lire une cle armateur dans Vault (interne, service role uniquement)"}';


-- ############################################################################
-- §3  Correctif min(uuid) dans cargo_shipments_notify_parcels
--     source : supabase/migrations/20260926120000_fix_cargo_notify_parcels_min_uuid.sql
--     (déjà dans migrations/20260926_consolidated.sql §3)
-- ############################################################################

-- ============================================================
-- cargo_shipments_notify_parcels : min(uuid) n'existe pas en Postgres → toute
-- transition de statut vers AT_SEA / ARRIVED échouait (« function min(uuid)
-- does not exist »), donc la synchro armateur ne pouvait plus enregistrer
-- l'arrivée d'un conteneur (constaté sur CMAU6126032 le 26/09). On prend le
-- premier dépôt par numéro, de façon stable. Idempotent (CREATE OR REPLACE).
-- ============================================================
CREATE OR REPLACE FUNCTION public.cargo_shipments_notify_parcels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('AT_SEA','ARRIVED') THEN RETURN NEW; END IF;
  FOR r IN
    SELECT d.client_user_id AS user_id, count(*) AS n, string_agg(DISTINCT d.deposit_no, ', ') AS deposits,
           (array_agg(d.id ORDER BY d.deposit_no))[1] AS deposit_id
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE p.shipment_id = NEW.id AND d.client_user_id IS NOT NULL AND p.delivered_at IS NULL
    GROUP BY d.client_user_id
  LOOP
    IF NEW.status = 'AT_SEA' THEN
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_departed',
        'Vos colis ont quitté la Chine',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont en mer dans le conteneur ' || NEW.container_number || COALESCE(', arrivée prévue le ' || to_char(COALESCE(NEW.eta_carrier::date, NEW.eta_promised), 'DD/MM'), '') || '.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'shipment_id', NEW.id, 'container_number', NEW.container_number, 'reference', NEW.container_number));
    ELSE
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_arrived',
        'Vos colis sont arrivés à Douala',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont arrivés à Douala (conteneur ' || NEW.container_number || '). Nous vous prévenons dès qu''ils sont prêts au retrait.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'shipment_id', NEW.id, 'container_number', NEW.container_number, 'reference', NEW.container_number));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;


-- ############################################################################
-- §4  Classeur du conteneur : pièces libres, plusieurs fichiers par pièce
--     source : supabase/migrations/20261003140000_cargo_document_folders.sql
-- ############################################################################

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


-- ############################################################################
-- §5  Parties prenantes : annuaire commun et rôles par conteneur
--     source : supabase/migrations/20261003150000_cargo_parties.sql
-- ############################################################################

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


-- ############################################################################
-- §6  Coûts justifiés : payé à, date de paiement, inspection, note sur le fret
--     source : supabase/migrations/20261003160000_cargo_costs_depth.sql
-- ############################################################################

-- ============================================================
-- Bonzini Cargo — des coûts qu'on peut justifier.
--
-- L'onglet Coûts notait un poste, un montant, une date. Il manquait ce qui
-- sert le jour où on refait les comptes :
--   1. À QUI on a payé (payee) et QUAND (paid_on) — « BESC, 300 EUR, payé à
--      SOFT CENTRAL LAB le 30/09 » ;
--   2. une catégorie INSPECTION (CIVIC, expertise des véhicules) qui n'avait
--      nulle part où aller ;
--   3. la SOURCE du fret annoncé (cargo_shipments.freight_note) : le
--      dossier affichait « 6 550 $ » sans dire d'où venait le chiffre
--      (tableau du transitaire du 11/09) ni qu'il contredit le BESC
--      (3 000 $).
-- Les justificatifs (photos de reçus, factures) sont des cargo_documents
-- avec cost_id (20261003140000_cargo_document_folders.sql).
-- Idempotent.
-- ============================================================

ALTER TABLE public.cargo_costs
  ADD COLUMN IF NOT EXISTS payee   text CHECK (payee IS NULL OR char_length(payee) <= 160),
  ADD COLUMN IF NOT EXISTS paid_on date;

COMMENT ON COLUMN public.cargo_costs.payee IS 'À qui ce coût a été (ou sera) payé : transitaire, agent BESC, déclarant, port…';
COMMENT ON COLUMN public.cargo_costs.paid_on IS 'Date du paiement, quand paid = true.';

ALTER TABLE public.cargo_costs DROP CONSTRAINT IF EXISTS cargo_costs_kind_check;
ALTER TABLE public.cargo_costs ADD CONSTRAINT cargo_costs_kind_check CHECK (kind IN (
  'FREIGHT','SURCHARGE','THC','DEMURRAGE','STORAGE','CUSTOMS_DUTY','CUSTOMS_FEE','BESC','INSPECTION',
  'INSURANCE','TRANSIT','TRUCKING','OTHER'
));

ALTER TABLE public.cargo_shipments
  ADD COLUMN IF NOT EXISTS freight_note text CHECK (freight_note IS NULL OR char_length(freight_note) <= 500);

COMMENT ON COLUMN public.cargo_shipments.freight_note IS
  'D''où vient freight_usd (devis, tableau du transitaire, facture) et ce qui reste à confirmer.';

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- §7  Chargement d'un groupage : véhicules, lots au volume, propriétaires
--     source : supabase/migrations/20261003170000_cargo_packages_mixed.sql
-- ############################################################################

-- ============================================================
-- Bonzini Cargo — ce qu'il y a VRAIMENT dans un conteneur de groupage.
--
-- La table cargo_packages ne savait décrire que des cartons de dimensions
-- connues. MIEU3611115 a montré ses limites : trois VÉHICULES (que le plan
-- rangeait comme des cartons, si bien que la Haval « ne tenait pas ») et
-- des effets personnels dont la packing list ne donne que le VOLUME par
-- ligne (« vêtements, 1 colis, 5,98 CBM »), jamais les cotes.
--
--   1. kind VEHICLE : un véhicule se dessine en silhouette et peut être
--      posé incliné (l'avant sur le capot du voisin), comme le fait un
--      entrepôt pour loger trois voitures dans un 40 pieds ;
--   2. cbm : le volume déclaré du LOT ; les dimensions deviennent
--      facultatives à condition d'avoir l'un ou l'autre ;
--   3. owner_label / client_id : À QUI est le lot (groupage) — « Olivier
--      Yaoundé » sur les tôles ; client_id le rattache à un client Bonzini ;
--   4. hs_code : le classement proposé, pour la douane.
-- Idempotent.
-- ============================================================

ALTER TABLE public.cargo_packages DROP CONSTRAINT IF EXISTS cargo_packages_kind_check;
ALTER TABLE public.cargo_packages ADD CONSTRAINT cargo_packages_kind_check CHECK (kind IN (
  'CARTON','PALLET','CRATE','BAG','DRUM','BUNDLE','VEHICLE','OTHER'
));

ALTER TABLE public.cargo_packages
  ALTER COLUMN length_cm DROP NOT NULL,
  ALTER COLUMN width_cm  DROP NOT NULL,
  ALTER COLUMN height_cm DROP NOT NULL;

ALTER TABLE public.cargo_packages
  ADD COLUMN IF NOT EXISTS cbm         numeric(10,3) CHECK (cbm IS NULL OR (cbm > 0 AND cbm <= 100)),
  ADD COLUMN IF NOT EXISTS owner_label text CHECK (owner_label IS NULL OR char_length(owner_label) <= 160),
  ADD COLUMN IF NOT EXISTS client_id   uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hs_code     text CHECK (hs_code IS NULL OR hs_code ~ '^[0-9.]{4,20}$');

-- Des cotes complètes, OU un volume : sans l'un ni l'autre, le lot ne se dessine pas.
ALTER TABLE public.cargo_packages DROP CONSTRAINT IF EXISTS cargo_packages_size_known;
ALTER TABLE public.cargo_packages ADD CONSTRAINT cargo_packages_size_known CHECK (
  (length_cm IS NOT NULL AND width_cm IS NOT NULL AND height_cm IS NOT NULL)
  OR (length_cm IS NULL AND width_cm IS NULL AND height_cm IS NULL AND cbm IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS cargo_packages_client_idx ON public.cargo_packages (client_id);

COMMENT ON COLUMN public.cargo_packages.cbm IS 'Volume déclaré du lot entier (m³), quand la packing list ne donne pas les cotes.';
COMMENT ON COLUMN public.cargo_packages.owner_label IS 'À qui est ce lot dans le groupage (nom porté sur les colis ou la packing list).';
COMMENT ON COLUMN public.cargo_packages.client_id IS 'Client Bonzini propriétaire du lot, si identifié.';
COMMENT ON COLUMN public.cargo_packages.hs_code IS 'Code SH proposé (à valider par le déclarant).';

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- §8  Suivi relevé à la main : arrivée, escales, position du navire (RPC cargo_set_vessel_position)
--     source : supabase/migrations/20261003180000_cargo_voyage_manual.sql
-- ############################################################################

-- ============================================================
-- Bonzini Cargo — un suivi qui reste vrai quand les flux se taisent.
--
-- Le 03/10/2026, la fiche de MIEU3611115 affichait une position vieille de
-- 22 jours (aucune source AIS n'est branchée : AISSTREAM_API_KEY absent),
-- un parcours figé sur la ligne WAX1 (Lekki avant Kribi) et une arrivée au
-- 7 octobre, alors que Flexport Atlas montrait le navire au mouillage
-- devant Kribi, escale du 3 au 4 octobre. L'équipe voyait le vrai ; la
-- fiche ne savait pas l'écrire.
--
--   1. eta_manual (+ note, + date de saisie) : l'arrivée CONSTATÉE ou
--      relevée par l'équipe, avec sa source. Elle passe devant celle de
--      l'armateur, qui reste affichée à côté ;
--   2. route_calls : les ESCALES réelles du voyage (port, arrivée, départ,
--      note), éditables, au lieu d'une ligne figée ;
--   3. cargo_set_vessel_position : poser à la main la dernière position
--      d'un navire (relevée sur Atlas, VesselFinder…), avec sa source.
--      Gardée par canManageCargo, coordonnées bornées, étiquetée @mola.
-- Idempotent.
-- ============================================================

ALTER TABLE public.cargo_shipments
  ADD COLUMN IF NOT EXISTS eta_manual      timestamptz,
  ADD COLUMN IF NOT EXISTS eta_manual_note text CHECK (eta_manual_note IS NULL OR char_length(eta_manual_note) <= 500),
  ADD COLUMN IF NOT EXISTS eta_manual_at   timestamptz,
  ADD COLUMN IF NOT EXISTS route_calls     jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.cargo_shipments DROP CONSTRAINT IF EXISTS cargo_shipments_route_calls_array;
ALTER TABLE public.cargo_shipments ADD CONSTRAINT cargo_shipments_route_calls_array
  CHECK (jsonb_typeof(route_calls) = 'array' AND jsonb_array_length(route_calls) <= 30);

COMMENT ON COLUMN public.cargo_shipments.eta_manual IS
  'Arrivée relevée par l''équipe (Atlas, consignataire, avis d''arrivée). Passe devant eta_carrier à l''affichage ; eta_manual_note dit la source.';
COMMENT ON COLUMN public.cargo_shipments.route_calls IS
  'Escales du voyage : [{id, name, unlocode, eta, etd, ata, atd, note}] (dates ISO). Vide = départ et arrivée seulement.';

ALTER TABLE public.cargo_vessel_positions
  ADD COLUMN IF NOT EXISTS note text CHECK (note IS NULL OR char_length(note) <= 300);

COMMENT ON COLUMN public.cargo_vessel_positions.note IS
  'Pour une position posée à la main (source = manual) : d''où elle vient (« Flexport Atlas, capture du 03/10 »).';

CREATE OR REPLACE FUNCTION public.cargo_set_vessel_position(
  p_imo text,
  p_latitude double precision,
  p_longitude double precision,
  p_reported_at timestamptz DEFAULT now(),
  p_speed_kn numeric DEFAULT NULL,
  p_course_deg numeric DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_mmsi text;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_imo IS NULL OR p_imo !~ '^[0-9]{7}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro IMO invalide (7 chiffres)');
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coordonnées hors limites');
  END IF;
  IF p_reported_at IS NULL OR p_reported_at > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Date de relevé dans le futur');
  END IF;
  IF p_speed_kn IS NOT NULL AND (p_speed_kn < 0 OR p_speed_kn > 40) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vitesse invraisemblable');
  END IF;
  IF p_course_deg IS NOT NULL AND (p_course_deg < 0 OR p_course_deg >= 360) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cap entre 0 et 359');
  END IF;

  -- Le navire doit être celui d'un dossier : on ne crée pas de position pour un inconnu.
  SELECT vessel_name, vessel_mmsi INTO v_name, v_mmsi
  FROM public.cargo_shipments WHERE vessel_imo = p_imo ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun conteneur suivi sur ce navire');
  END IF;

  INSERT INTO public.cargo_vessel_positions AS vp
    (vessel_imo, vessel_mmsi, vessel_name, latitude, longitude, speed_kn, course_deg, reported_at, source, note, updated_at)
  VALUES (p_imo, v_mmsi, v_name, p_latitude, p_longitude, p_speed_kn, p_course_deg, p_reported_at, 'manual', left(btrim(p_note), 300), now())
  ON CONFLICT (vessel_imo) DO UPDATE SET
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, speed_kn = EXCLUDED.speed_kn, course_deg = EXCLUDED.course_deg,
    reported_at = EXCLUDED.reported_at, source = 'manual', note = EXCLUDED.note, updated_at = now(),
    vessel_name = COALESCE(vp.vessel_name, EXCLUDED.vessel_name), vessel_mmsi = COALESCE(vp.vessel_mmsi, EXCLUDED.vessel_mmsi)
  -- Une saisie plus ancienne que la position connue ne l'écrase pas.
  WHERE vp.reported_at <= EXCLUDED.reported_at;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cargo_set_vessel_position(text, double precision, double precision, timestamptz, numeric, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cargo_set_vessel_position(text, double precision, double precision, timestamptz, numeric, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.cargo_set_vessel_position(text, double precision, double precision, timestamptz, numeric, numeric, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Poser à la main la position d''un navire (relevée sur Atlas, VesselFinder…)"}';

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- §9  Douane étape par étape (cargo_steps)
--     source : supabase/migrations/20261004090000_cargo_steps.sql
-- ############################################################################

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

-- Fin : PostgREST relit le schéma (nouvelles tables et colonnes visibles par l'API).
NOTIFY pgrst, 'reload schema';

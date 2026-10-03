-- ============================================================================
-- MIGRATION CONSOLIDÉE · 30/09/2026 · Douane (étapes 1 à 9) + délais observés
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à passer dans le SQL Editor, d'un bloc.
-- ============================================================================
--
-- Contenu, dans l'ordre d'exécution (copie conforme des cinq fichiers de
-- supabase/migrations/, qui restent la source pour `npx supabase db push --linked`) :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un ; rien n'est modifié)
--   1. Le socle douane (étape 3, complété aux étapes 4 et 5)
--        ← supabase/migrations/20260929120000_customs_foundation.sql
--   2. Le parcours d'un audit de DAU (étape 5)
--        ← supabase/migrations/20260929130000_customs_audit_workflow.sql
--   3. La veille réglementaire et les perturbations (étape 6)
--        ← supabase/migrations/20260930090000_customs_notices.sql
--   4. Les fournisseurs invités (étape 7)
--        ← supabase/migrations/20260930120000_customs_supplier_invites.sql
--   5. Les délais observés (étape 8)
--        ← supabase/migrations/20260930150000_logistics_observed_transit.sql
--
-- Les étapes 1, 2 et 9 (moteur de liquidation, simulateur, site
-- bonzinilabs.com/douane) ne touchent que le front : aucun SQL.
--
-- État de la production vérifié le 30/09/2026 (lecture seule) :
--   · NON passée : ni customs_broker dans app_role, ni tables customs_*, ni
--     seau customs-documents, ni logistics_observed_transit ;
--     admin_has_permission sans les permissions douane ;
--   · prérequis présents : app_role, user_roles, clients, notifications,
--     cargo_shipments, cargo_events, air_shipments, send_staff_push(text, text,
--     text, text, text[], uuid) (notifications push du 26/09) ; Postgres 17.
--   · admin_has_permission en production = la version du 21/09
--     (warehouse_destination) ; la section 1 la reprend ligne pour ligne et
--     n'AJOUTE que les trois permissions douane — aucune n'est retirée.
--
-- Idempotent : CREATE … IF NOT EXISTS, ADD VALUE IF NOT EXISTS, DROP POLICY /
-- TRIGGER IF EXISTS avant chaque CREATE, CREATE OR REPLACE FUNCTION, ON
-- CONFLICT sur le seau et les avis de départ. Rejouable sans dégât.
--
-- Une seule transaction : Postgres interdit d'UTILISER une valeur d'enum
-- ajoutée dans la même transaction. Ici 'customs_broker' n'est jamais converti
-- en app_role — il n'apparaît qu'en texte (ur.role::text IN (...)). Vérifié
-- sur Postgres 16 : le fichier passé deux fois de suite dans UNE transaction
-- (psql -1), puis les cinq suites de sécurité de supabase/tests/ rejouées sur
-- le résultat.
--
-- Après passage :
--   1. Types TypeScript : /gen-types (ou la commande de CLAUDE.md).
--   2. Edge functions : npx supabase functions deploy customs-ai customs-supplier
--      (customs-ai a besoin du secret ANTHROPIC_API_KEY).
--   3. Coller ce fichier n'inscrit rien dans supabase_migrations.schema_migrations ;
--      pour qu'un `db push` ultérieur ne rejoue pas (sans dommage de toute façon) :
--        npx supabase migration repair --status applied 20260929120000 20260929130000 20260930090000 20260930120000 20260930150000
--   4. Un commissionnaire agréé : lui donner le rôle customs_broker, puis
--      enregistrer son agrément (RPC customs_broker_register, super admin).
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- S'arrête avec un message clair si la base n'a pas ce que les sections
-- suivantes supposent : rien n'est modifié dans ce cas.
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF to_regtype('public.app_role') IS NULL THEN v_missing := array_append(v_missing, 'type public.app_role'); END IF;
  IF to_regclass('public.user_roles') IS NULL THEN v_missing := array_append(v_missing, 'table public.user_roles'); END IF;
  IF to_regclass('public.clients') IS NULL THEN v_missing := array_append(v_missing, 'table public.clients'); END IF;
  IF to_regclass('public.notifications') IS NULL THEN v_missing := array_append(v_missing, 'table public.notifications'); END IF;
  IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN v_missing := array_append(v_missing, 'schéma storage'); END IF;
  -- La section 5 est une fonction SQL : ses tables sont vérifiées à la création.
  IF to_regclass('public.cargo_shipments') IS NULL THEN v_missing := array_append(v_missing, 'table public.cargo_shipments (module cargo)'); END IF;
  IF to_regclass('public.cargo_events') IS NULL THEN v_missing := array_append(v_missing, 'table public.cargo_events (module cargo)'); END IF;
  IF to_regclass('public.air_shipments') IS NULL THEN v_missing := array_append(v_missing, 'table public.air_shipments (cargo aérien, 21/09)'); END IF;
  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration douane : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
  -- Facultatif : sans lui, les CAD ne reçoivent pas de push (l'action réussit quand même).
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'send_staff_push' AND pronamespace = 'public'::regnamespace) THEN
    RAISE WARNING 'send_staff_push absent (notifications push du 26/09) : les commissionnaires ne seront pas prévenus par push.';
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Le socle douane (étape 3, complété aux étapes 4 et 5)
-- ← supabase/migrations/20260929120000_customs_foundation.sql
-- rôle customs_broker et ses 3 permissions (admin_has_permission = la version
-- de production + canViewCustoms / canSignCustoms / canManageCustoms), tables
-- customs_brokers, customs_classifications (+ messages), customs_audits, seau
-- privé customs-documents, RPC client / CAD / admin.
-- ############################################################################

-- ============================================================================
-- Douane · étape 3 — le socle : le commissionnaire agréé, les classements,
-- les audits de déclaration (docs/douane/00-plan.md).
--
-- La règle qui fonde tout : L'IA PROPOSE, LE CAD SIGNE. Un code SH n'est
-- « validé » que si un Commissionnaire Agréé en Douane identifié — société,
-- numéro d'agrément — l'a signé, et ce qu'il a signé est figé sur la ligne.
-- Ni le super admin ni les opérations ne signent : c'est la responsabilité
-- professionnelle d'un agréé (code des douanes CEMAC, art. 149 à 153, 449).
--
--   1. rôle customs_broker ; permissions canViewCustoms, canSignCustoms,
--      canManageCustoms — miroir de ROLE_PERMISSIONS (AdminAuthContext.tsx)
--   2. customs_brokers : l'agrément de chaque CAD
--   3. customs_classifications + customs_classification_messages : la fiche
--      produit, la conversation avec l'IA, la décision du CAD
--   4. customs_audits : une déclaration (DAU) relue, ses constats, le
--      trop-perçu, le délai de réclamation (art. 396 : 3 ans)
--   5. seau privé customs-documents (photos, fiches techniques, DAU)
--   6. RPC — client : créer, écrire, soumettre, annuler ; équipe : file de
--      revue, prendre, décider ; admin : enregistrer un CAD
--
-- Les écritures de l'IA (messages, candidats, lecture de DAU) passent par
-- l'edge function customs-ai, avec la clé de service, après avoir vérifié
-- que l'appelant est bien le propriétaire de la fiche.
--
-- Idempotent. Suppose 20260926100000_staff_push_notifications.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Rôle + permissions
-- ─────────────────────────────────────────────────────────────────────────
-- La nouvelle valeur n'est utilisée qu'en texte dans cette migration
-- (ur.role::text IN (...)) : pas d'« unsafe use of new value » dans la transaction.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customs_broker';

CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
      AND CASE _permission
        WHEN 'canViewClients'       THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canEditClients'       THEN ur.role::text IN ('super_admin','support','customer_success')
        WHEN 'canViewDeposits'      THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canProcessDeposits'   THEN ur.role::text IN ('super_admin','ops','customer_success')
        WHEN 'canViewPayments'      THEN ur.role::text IN ('super_admin','ops','support','customer_success','cash_agent')
        WHEN 'canProcessPayments'   THEN ur.role::text IN ('super_admin','ops','cash_agent')
        WHEN 'canManageRates'       THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canViewLogs'          THEN ur.role::text IN ('super_admin','ops','support')
        WHEN 'canManageUsers'       THEN ur.role::text IN ('super_admin')
        WHEN 'canViewTreasury'      THEN ur.role::text IN ('super_admin','treasurer')
        WHEN 'canManageTreasury'    THEN ur.role::text IN ('super_admin','treasurer')
        WHEN 'canAccessSupportChat' THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canAdjustWallets'     THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canViewCargo'         THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canManageCargo'       THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canGrantOverdraft'    THEN ur.role::text IN ('super_admin')
        WHEN 'canReceiveParcels'    THEN ur.role::text IN ('super_admin','ops','receptionist')
        WHEN 'canRegisterClients'   THEN ur.role::text IN ('super_admin','ops','support','customer_success','receptionist')
        WHEN 'canPriceParcels'      THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canCollectParcelPayments' THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canReceiveAtDestination'  THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canReleaseParcels'        THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canViewCustoms'       THEN ur.role::text IN ('super_admin','ops','support','customer_success','customs_broker')
        WHEN 'canSignCustoms'       THEN ur.role::text IN ('customs_broker')
        WHEN 'canManageCustoms'     THEN ur.role::text IN ('super_admin','ops')
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les commissionnaires agréés
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customs_brokers (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company            TEXT NOT NULL CHECK (length(trim(company)) BETWEEN 2 AND 160),   -- « CITRA SARL »
  license_no         TEXT NOT NULL CHECK (length(trim(license_no)) BETWEEN 2 AND 60),  -- agrément CAD
  representative_no  TEXT CHECK (representative_no IS NULL OR length(representative_no) <= 60), -- art. 151
  active             BOOLEAN NOT NULL DEFAULT true,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customs_brokers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customs_brokers_staff_read ON public.customs_brokers;
CREATE POLICY customs_brokers_staff_read ON public.customs_brokers FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCustoms') OR public.admin_has_permission(auth.uid(), 'canManageUsers'));
-- Aucune écriture directe : customs_broker_register.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Les classements : la fiche produit, la conversation, la décision
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.customs_classification_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.customs_classifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                TEXT NOT NULL UNIQUE DEFAULT ('CL-' || lpad(nextval('public.customs_classification_no_seq')::text, 6, '0')),
  client_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name       TEXT NOT NULL CHECK (length(trim(product_name)) BETWEEN 2 AND 200),
  description        TEXT CHECK (description IS NULL OR length(description) <= 4000),
  -- Les faits établis pendant la conversation : matière, usage, état, puissance…
  facts              JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(facts) = 'object'),
  photo_paths        TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_paths) <= 8),
  -- Les propositions de l'IA : [{code, title, rate, confidence, reasoning, rules}]
  candidates         JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(candidates) = 'array'),
  proposed_code      TEXT CHECK (proposed_code IS NULL OR proposed_code ~ '^[0-9]{6}([0-9]{2}([0-9]{4})?)?$'),
  ai_model           TEXT,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','in_review','needs_info','approved','changed','cancelled')),
  submitted_at       TIMESTAMPTZ,
  -- La décision du CAD, figée au moment de la signature.
  final_code         TEXT CHECK (final_code IS NULL OR final_code ~ '^[0-9]{6}([0-9]{2}([0-9]{4})?)?$'),
  broker_note        TEXT CHECK (broker_note IS NULL OR length(broker_note) <= 4000),
  claimed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  broker_company     TEXT,
  broker_license_no  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Signé = code final + signataire + agrément, toujours ensemble.
  CONSTRAINT customs_classifications_signed_check CHECK (
    status NOT IN ('approved','changed')
    OR (final_code IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND broker_license_no IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS customs_classifications_client_idx ON public.customs_classifications (client_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customs_classifications_queue_idx ON public.customs_classifications (status, submitted_at) WHERE status IN ('submitted','in_review');

CREATE TABLE IF NOT EXISTS public.customs_classification_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id  UUID NOT NULL REFERENCES public.customs_classifications(id) ON DELETE CASCADE,
  author             TEXT NOT NULL CHECK (author IN ('client','assistant','broker','system')),
  author_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body               TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  -- Pour l'IA : la question et ses choix, ou les candidats de ce tour.
  payload            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customs_classification_messages_idx ON public.customs_classification_messages (classification_id, created_at);

ALTER TABLE public.customs_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_classification_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customs_classifications_owner_read ON public.customs_classifications;
CREATE POLICY customs_classifications_owner_read ON public.customs_classifications FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());
DROP POLICY IF EXISTS customs_classifications_staff_read ON public.customs_classifications;
CREATE POLICY customs_classifications_staff_read ON public.customs_classifications FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCustoms'));

DROP POLICY IF EXISTS customs_classification_messages_owner_read ON public.customs_classification_messages;
CREATE POLICY customs_classification_messages_owner_read ON public.customs_classification_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customs_classifications c WHERE c.id = classification_id AND c.client_user_id = auth.uid()));
DROP POLICY IF EXISTS customs_classification_messages_staff_read ON public.customs_classification_messages;
CREATE POLICY customs_classification_messages_staff_read ON public.customs_classification_messages FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCustoms'));
-- Aucune écriture directe : les RPC ci-dessous, ou l'edge function (clé de service).

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Les audits de déclaration
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.customs_audit_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.customs_audits (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                TEXT NOT NULL UNIQUE DEFAULT ('AU-' || lpad(nextval('public.customs_audit_no_seq')::text, 6, '0')),
  client_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dau_number         TEXT CHECK (dau_number IS NULL OR length(dau_number) <= 80),   -- SDSD2-2026-IMP-020399-I
  customs_office     TEXT CHECK (customs_office IS NULL OR length(customs_office) <= 80),
  registered_on      DATE,
  paid_on            DATE,
  file_paths         TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(file_paths) BETWEEN 0 AND 10),
  status             TEXT NOT NULL DEFAULT 'uploaded'
                     CHECK (status IN ('uploaded','reading','read','failed','submitted','in_review','reviewed','cancelled')),
  -- Ce que l'IA a lu : en-tête et articles (code, désignation, valeur, taxes liquidées).
  extraction         JSONB,
  -- Ce que le moteur déterministe a constaté (src/lib/customs) : [{kind, article, severity, amount_xaf, …}]
  findings           JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
  total_paid_xaf     BIGINT CHECK (total_paid_xaf IS NULL OR total_paid_xaf >= 0),
  overpaid_xaf       BIGINT CHECK (overpaid_xaf IS NULL OR overpaid_xaf >= 0),
  recoverable_xaf    BIGINT CHECK (recoverable_xaf IS NULL OR recoverable_xaf >= 0),
  claim_deadline     DATE,              -- paiement + 3 ans (code des douanes CEMAC, art. 396)
  ai_model           TEXT,
  error              TEXT,
  submitted_at       TIMESTAMPTZ,
  broker_note        TEXT CHECK (broker_note IS NULL OR length(broker_note) <= 4000),
  claimed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  broker_company     TEXT,
  broker_license_no  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customs_audits_reviewed_check CHECK (
    status <> 'reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND broker_license_no IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS customs_audits_client_idx ON public.customs_audits (client_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customs_audits_queue_idx ON public.customs_audits (status, submitted_at) WHERE status IN ('submitted','in_review');

ALTER TABLE public.customs_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customs_audits_owner_read ON public.customs_audits;
CREATE POLICY customs_audits_owner_read ON public.customs_audits FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());
DROP POLICY IF EXISTS customs_audits_staff_read ON public.customs_audits;
CREATE POLICY customs_audits_staff_read ON public.customs_audits FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCustoms'));

-- updated_at, sur les trois tables.
CREATE OR REPLACE FUNCTION public.customs_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$fn$;
DROP TRIGGER IF EXISTS customs_brokers_touch ON public.customs_brokers;
CREATE TRIGGER customs_brokers_touch BEFORE UPDATE ON public.customs_brokers FOR EACH ROW EXECUTE FUNCTION public.customs_touch_updated_at();
DROP TRIGGER IF EXISTS customs_classifications_touch ON public.customs_classifications;
CREATE TRIGGER customs_classifications_touch BEFORE UPDATE ON public.customs_classifications FOR EACH ROW EXECUTE FUNCTION public.customs_touch_updated_at();
DROP TRIGGER IF EXISTS customs_audits_touch ON public.customs_audits;
CREATE TRIGGER customs_audits_touch BEFORE UPDATE ON public.customs_audits FOR EACH ROW EXECUTE FUNCTION public.customs_touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Le seau des pièces : <uid du client>/<fichier>
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('customs-documents', 'customs-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Clients upload their customs documents" ON storage.objects;
CREATE POLICY "Clients upload their customs documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customs-documents' AND (storage.foldername(name))[1] = auth.uid()::text
              AND name ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$');
DROP POLICY IF EXISTS "Clients read their customs documents" ON storage.objects;
CREATE POLICY "Clients read their customs documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customs-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Staff read customs documents" ON storage.objects;
CREATE POLICY "Staff read customs documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customs-documents' AND public.admin_has_permission(auth.uid(), 'canViewCustoms'));

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Helpers internes
-- ─────────────────────────────────────────────────────────────────────────

-- 6.1 Prévenir le client (in-app ; e-mail/SMS si le type est activé plus tard).
CREATE OR REPLACE FUNCTION public.customs_notify_client(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('kind', 'customs'));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'customs_notify_client: échec (% pour %) : %', p_type, p_user_id, SQLERRM;
  END;
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_notify_client(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.customs_notify_client(UUID, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;
COMMENT ON FUNCTION public.customs_notify_client(UUID, TEXT, TEXT, TEXT, JSONB) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCustoms","confirm":false,"danger":false,"label":"Prévenir un client d''une étape douane (helper interne)"}';

-- 6.2 Prévenir les CAD (push de l'app du personnel). Ne fait jamais échouer l'action.
CREATE OR REPLACE FUNCTION public.customs_notify_brokers(p_title TEXT, p_body TEXT, p_path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  BEGIN
    PERFORM public.send_staff_push('canSignCustoms', p_title, p_body, p_path, NULL, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'customs_notify_brokers: %', SQLERRM;
  END;
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_notify_brokers(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.customs_notify_brokers(TEXT, TEXT, TEXT) FROM anon, authenticated;
COMMENT ON FUNCTION public.customs_notify_brokers(TEXT, TEXT, TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCustoms","confirm":false,"danger":false,"label":"Prévenir les commissionnaires agréés (helper interne)"}';

-- 6.3 Le CAD signataire : actif, avec un agrément. NULL sinon.
CREATE OR REPLACE FUNCTION public.customs_active_broker(p_user_id UUID)
RETURNS public.customs_brokers
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT b.* FROM public.customs_brokers b
  WHERE b.user_id = p_user_id AND b.active AND public.admin_has_permission(p_user_id, 'canSignCustoms');
$fn$;
REVOKE ALL ON FUNCTION public.customs_active_broker(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.customs_active_broker(UUID) FROM anon, authenticated;
COMMENT ON FUNCTION public.customs_active_broker(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canSignCustoms","confirm":false,"danger":false,"label":"Le CAD signataire et son agrément (helper interne)"}';

-- 6.4 Une fiche de classement en JSON, avec sa conversation et le client.
CREATE OR REPLACE FUNCTION public.customs_classification_json(p_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT to_jsonb(c) || jsonb_build_object(
    'client', (SELECT jsonb_build_object('user_id', cl.user_id, 'first_name', cl.first_name, 'last_name', cl.last_name,
                                         'company_name', cl.company_name, 'customer_code', cl.customer_code)
               FROM public.clients cl WHERE cl.user_id = c.client_user_id),
    'messages', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'author', m.author, 'body', m.body, 'payload', m.payload, 'created_at', m.created_at) ORDER BY m.created_at)
                          FROM public.customs_classification_messages m WHERE m.classification_id = c.id), '[]'::jsonb)
  )
  FROM public.customs_classifications c WHERE c.id = p_id;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.customs_classification_json(UUID) FROM anon, authenticated;
COMMENT ON FUNCTION public.customs_classification_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Sérialiser une fiche de classement (helper interne)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. RPC — les classements
-- ─────────────────────────────────────────────────────────────────────────

-- 7.1 Ouvrir une fiche. Le client pour lui-même ; l'équipe pour un client
--     (p_client_user_id), avec canViewCustoms. Un identifiant passé en
--     paramètre n'est pas une autorisation (.claude/rules/security.md).
CREATE OR REPLACE FUNCTION public.customs_classification_create(
  p_product_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_facts JSONB DEFAULT '{}'::jsonb,
  p_photo_paths TEXT[] DEFAULT '{}',
  p_client_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_client UUID; v_id UUID; v_ref TEXT; v_path TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Connexion requise'); END IF;
  IF p_client_user_id IS NULL OR p_client_user_id = v_uid THEN
    v_client := v_uid;
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = v_uid) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Compte client introuvable');
    END IF;
  ELSE
    IF NOT public.admin_has_permission(v_uid, 'canViewCustoms') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_client_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
    END IF;
    v_client := p_client_user_id;
  END IF;
  IF p_product_name IS NULL OR length(trim(p_product_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nom du produit requis');
  END IF;
  IF p_facts IS NOT NULL AND jsonb_typeof(p_facts) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Faits invalides');
  END IF;
  -- Les photos sont dans le dossier du client, et nulle part ailleurs.
  FOREACH v_path IN ARRAY COALESCE(p_photo_paths, '{}') LOOP
    IF split_part(v_path, '/', 1) <> v_client::text THEN
      RETURN jsonb_build_object('success', false, 'error', 'Pièce hors du dossier du client');
    END IF;
  END LOOP;

  INSERT INTO public.customs_classifications (client_user_id, created_by, product_name, description, facts, photo_paths)
  VALUES (v_client, v_uid, trim(p_product_name), NULLIF(trim(COALESCE(p_description, '')), ''), COALESCE(p_facts, '{}'::jsonb), COALESCE(p_photo_paths, '{}'))
  RETURNING id, ref INTO v_id, v_ref;
  IF p_description IS NOT NULL AND length(trim(p_description)) > 0 THEN
    INSERT INTO public.customs_classification_messages (classification_id, author, author_user_id, body)
    VALUES (v_id, 'client', v_uid, left(trim(p_description), 8000));
  END IF;
  RETURN jsonb_build_object('success', true, 'id', v_id, 'ref', v_ref);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_create(TEXT, TEXT, JSONB, TEXT[], UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_create(TEXT, TEXT, JSONB, TEXT[], UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_create(TEXT, TEXT, JSONB, TEXT[], UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Ouvrir une fiche de classement douanier pour un client","resolve":{"p_client_user_id":"client"}}';

-- 7.2 Le client répond (une précision, une réponse à la question de l'IA ou du CAD).
CREATE OR REPLACE FUNCTION public.customs_classification_post(p_id UUID, p_body TEXT, p_facts JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_classifications;
BEGIN
  SELECT * INTO v_row FROM public.customs_classifications WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.client_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable');
  END IF;
  IF v_row.status NOT IN ('draft','needs_info') THEN
    RETURN jsonb_build_object('success', false, 'error', 'La fiche est entre les mains du commissionnaire');
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 8000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message vide ou trop long');
  END IF;
  IF p_facts IS NOT NULL AND jsonb_typeof(p_facts) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Faits invalides');
  END IF;
  INSERT INTO public.customs_classification_messages (classification_id, author, author_user_id, body)
  VALUES (p_id, 'client', v_uid, trim(p_body));
  IF p_facts IS NOT NULL THEN
    UPDATE public.customs_classifications SET facts = facts || p_facts WHERE id = p_id;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_post(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_post(UUID, TEXT, JSONB) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_post(UUID, TEXT, JSONB) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Le client répond sur sa fiche de classement (action du client)"}';

-- 7.3 Envoyer au commissionnaire agréé.
CREATE OR REPLACE FUNCTION public.customs_classification_submit(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_classifications;
BEGIN
  SELECT * INTO v_row FROM public.customs_classifications WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT (v_row.client_user_id = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable');
  END IF;
  IF v_row.status NOT IN ('draft','needs_info') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Déjà envoyée au commissionnaire');
  END IF;
  UPDATE public.customs_classifications
     SET status = 'submitted', submitted_at = now(), claimed_by = NULL
   WHERE id = p_id;
  INSERT INTO public.customs_classification_messages (classification_id, author, body)
  VALUES (p_id, 'system', 'Envoyée au commissionnaire agréé en douane pour validation.');
  PERFORM public.customs_notify_brokers(
    'Classement à valider — ' || v_row.ref,
    v_row.product_name || COALESCE(' · proposé : ' || v_row.proposed_code, ''),
    '/m/douane/revue/' || p_id::text);
  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_submit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_submit(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_submit(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Envoyer une fiche de classement au commissionnaire agréé"}';

-- 7.4 Le client abandonne sa fiche (tant que rien n'est signé).
CREATE OR REPLACE FUNCTION public.customs_classification_cancel(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_classifications;
BEGIN
  SELECT * INTO v_row FROM public.customs_classifications WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.client_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable');
  END IF;
  -- Statuts terminaux : une fiche signée ne s'annule pas, elle se remplace.
  IF v_row.status IN ('approved','changed','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche déjà close');
  END IF;
  UPDATE public.customs_classifications SET status = 'cancelled' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_cancel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_cancel(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_cancel(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Le client abandonne sa fiche de classement (action du client)"}';

-- 7.5 Lire une fiche : le client la sienne, l'équipe toutes.
CREATE OR REPLACE FUNCTION public.customs_classification_get(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_owner UUID;
BEGIN
  SELECT client_user_id INTO v_owner FROM public.customs_classifications WHERE id = p_id;
  IF v_owner IS NULL OR NOT (v_owner = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'classification', public.customs_classification_json(p_id));
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_get(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_get(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_get(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Lire une fiche de classement douanier (code proposé, conversation, décision du CAD)"}';

-- 7.6 Le CAD prend la fiche (elle quitte la file des autres).
CREATE OR REPLACE FUNCTION public.customs_classification_claim(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_classifications;
BEGIN
  IF (public.customs_active_broker(v_uid)).user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservé à un commissionnaire agréé enregistré');
  END IF;
  SELECT * INTO v_row FROM public.customs_classifications WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable'); END IF;
  IF v_row.status NOT IN ('submitted','in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche n''attend pas de revue');
  END IF;
  IF v_row.status = 'in_review' AND v_row.claimed_by IS NOT NULL AND v_row.claimed_by <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un autre commissionnaire a pris cette fiche');
  END IF;
  UPDATE public.customs_classifications SET status = 'in_review', claimed_by = v_uid WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'status', 'in_review');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_claim(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_claim(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_claim(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canSignCustoms","confirm":true,"danger":false,"label":"Prendre une fiche de classement en revue (CAD)"}';

-- 7.7 La décision du CAD — signée, figée.
--   approved   : le code proposé est le bon
--   changed    : le bon code est p_final_code
--   needs_info : il manque un fait (p_note dit lequel) ; la fiche revient au client
CREATE OR REPLACE FUNCTION public.customs_classification_decide(p_id UUID, p_decision TEXT, p_final_code TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_broker public.customs_brokers;
  v_row public.customs_classifications;
  v_code TEXT := NULLIF(regexp_replace(COALESCE(p_final_code, ''), '[^0-9]', '', 'g'), '');
  v_note TEXT := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  v_broker := public.customs_active_broker(v_uid);
  IF v_broker.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservé à un commissionnaire agréé enregistré');
  END IF;
  IF p_decision NOT IN ('approved','changed','needs_info') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Décision inconnue');
  END IF;
  SELECT * INTO v_row FROM public.customs_classifications WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable'); END IF;
  IF v_row.status NOT IN ('submitted','in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche n''attend pas de décision');
  END IF;
  IF v_row.claimed_by IS NOT NULL AND v_row.claimed_by <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un autre commissionnaire a pris cette fiche');
  END IF;

  IF p_decision = 'approved' THEN
    v_code := COALESCE(v_code, v_row.proposed_code);
    IF v_code IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun code proposé à valider : indiquez le code'); END IF;
  ELSIF p_decision = 'changed' THEN
    IF v_code IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Indiquez le code retenu'); END IF;
    IF v_note IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dites pourquoi ce code et pas celui proposé'); END IF;
  ELSE
    IF v_note IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dites au client ce qui manque'); END IF;
  END IF;
  IF v_code IS NOT NULL AND v_code !~ '^[0-9]{6}([0-9]{2}([0-9]{4})?)?$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code SH invalide (6, 8 ou 12 chiffres)');
  END IF;

  IF p_decision = 'needs_info' THEN
    UPDATE public.customs_classifications SET status = 'needs_info', broker_note = v_note, claimed_by = NULL WHERE id = p_id;
  ELSE
    UPDATE public.customs_classifications
       SET status = p_decision, final_code = v_code, broker_note = v_note,
           reviewed_by = v_uid, reviewed_at = now(),
           broker_company = v_broker.company, broker_license_no = v_broker.license_no
     WHERE id = p_id;
  END IF;
  INSERT INTO public.customs_classification_messages (classification_id, author, author_user_id, body, payload)
  VALUES (p_id, 'broker', v_uid,
          -- Le code est dans payload.final_code (l'écran l'écrit formaté, 8504.40) ; le corps garde les mots du CAD.
          CASE p_decision WHEN 'approved' THEN COALESCE(v_note, 'Code validé.') ELSE v_note END,
          jsonb_build_object('decision', p_decision, 'final_code', v_code, 'broker_company', v_broker.company, 'broker_license_no', v_broker.license_no));

  PERFORM public.customs_notify_client(v_row.client_user_id,
    CASE WHEN p_decision = 'needs_info' THEN 'customs_classification_needs_info' ELSE 'customs_classification_signed' END,
    CASE WHEN p_decision = 'needs_info' THEN 'Le commissionnaire a une question' ELSE 'Code SH validé — ' || v_row.product_name END,
    CASE WHEN p_decision = 'needs_info' THEN v_note
         ELSE 'Code ' || v_code || ' signé par ' || v_broker.company || ' (agrément ' || v_broker.license_no || ').' END,
    jsonb_build_object('classification_id', p_id, 'ref', v_row.ref, 'decision', p_decision, 'final_code', v_code));
  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_decision = 'needs_info' THEN 'needs_info' ELSE p_decision END, 'final_code', v_code);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_classification_decide(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_classification_decide(UUID, TEXT, TEXT, TEXT) TO authenticated;
COMMENT ON FUNCTION public.customs_classification_decide(UUID, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canSignCustoms","confirm":true,"danger":true,"label":"Signer un classement douanier : valider, changer le code ou demander une précision (CAD)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. RPC — les audits de déclaration
-- ─────────────────────────────────────────────────────────────────────────

-- 8.1 Déposer une DAU à relire (les fichiers sont déjà dans le seau).
CREATE OR REPLACE FUNCTION public.customs_audit_create(
  p_file_paths TEXT[],
  p_dau_number TEXT DEFAULT NULL,
  p_paid_on DATE DEFAULT NULL,
  p_client_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_client UUID; v_id UUID; v_ref TEXT; v_path TEXT;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Connexion requise'); END IF;
  IF p_client_user_id IS NULL OR p_client_user_id = v_uid THEN
    v_client := v_uid;
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = v_uid) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Compte client introuvable');
    END IF;
  ELSE
    IF NOT public.admin_has_permission(v_uid, 'canViewCustoms') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_client_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
    END IF;
    v_client := p_client_user_id;
  END IF;
  IF p_file_paths IS NULL OR cardinality(p_file_paths) = 0 OR cardinality(p_file_paths) > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Une à dix pièces');
  END IF;
  FOREACH v_path IN ARRAY p_file_paths LOOP
    IF split_part(v_path, '/', 1) <> v_client::text THEN
      RETURN jsonb_build_object('success', false, 'error', 'Pièce hors du dossier du client');
    END IF;
  END LOOP;
  IF p_paid_on IS NOT NULL AND p_paid_on > current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Date de paiement dans le futur');
  END IF;
  INSERT INTO public.customs_audits (client_user_id, created_by, dau_number, paid_on, file_paths, claim_deadline)
  VALUES (v_client, v_uid, NULLIF(trim(COALESCE(p_dau_number, '')), ''), p_paid_on, p_file_paths,
          CASE WHEN p_paid_on IS NULL THEN NULL ELSE (p_paid_on + interval '3 years')::date END)
  RETURNING id, ref INTO v_id, v_ref;
  RETURN jsonb_build_object('success', true, 'id', v_id, 'ref', v_ref);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_create(TEXT[], TEXT, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_create(TEXT[], TEXT, DATE, UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_create(TEXT[], TEXT, DATE, UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Déposer une déclaration en douane (DAU) à vérifier pour un client","resolve":{"p_client_user_id":"client"}}';

-- 8.2 Enregistrer les constats du moteur (src/lib/customs) — le client ou l'équipe.
--     Indicatifs : le CAD les relit avant toute réclamation.
CREATE OR REPLACE FUNCTION public.customs_audit_save_findings(p_id UUID, p_findings JSONB, p_total_paid_xaf BIGINT DEFAULT NULL, p_overpaid_xaf BIGINT DEFAULT NULL, p_paid_on DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT (v_row.client_user_id = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  IF v_row.status NOT IN ('read','failed','uploaded') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit déjà envoyé au commissionnaire');
  END IF;
  IF p_findings IS NULL OR jsonb_typeof(p_findings) <> 'array' OR jsonb_array_length(p_findings) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Constats invalides');
  END IF;
  IF COALESCE(p_total_paid_xaf, 0) < 0 OR COALESCE(p_overpaid_xaf, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montants négatifs');
  END IF;
  IF p_paid_on IS NOT NULL AND p_paid_on > current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Date de paiement dans le futur');
  END IF;
  UPDATE public.customs_audits
     SET findings = p_findings, total_paid_xaf = p_total_paid_xaf, overpaid_xaf = p_overpaid_xaf,
         paid_on = COALESCE(p_paid_on, paid_on),
         claim_deadline = COALESCE((COALESCE(p_paid_on, paid_on) + interval '3 years')::date, claim_deadline)
   WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_save_findings(UUID, JSONB, BIGINT, BIGINT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_save_findings(UUID, JSONB, BIGINT, BIGINT, DATE) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_save_findings(UUID, JSONB, BIGINT, BIGINT, DATE) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Enregistrer les constats calculés d''un audit de DAU (moteur de l''app)"}';

-- 8.3 Envoyer l'audit au commissionnaire.
CREATE OR REPLACE FUNCTION public.customs_audit_submit(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT (v_row.client_user_id = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  IF v_row.status NOT IN ('uploaded','read','failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit déjà envoyé');
  END IF;
  UPDATE public.customs_audits SET status = 'submitted', submitted_at = now(), claimed_by = NULL WHERE id = p_id;
  PERFORM public.customs_notify_brokers(
    'DAU à relire — ' || v_row.ref,
    COALESCE(v_row.dau_number, 'Déclaration') || COALESCE(' · trop-perçu estimé ' || v_row.overpaid_xaf::text || ' XAF', ''),
    '/m/douane/revue/' || p_id::text);
  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_submit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_submit(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_submit(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Envoyer un audit de déclaration au commissionnaire agréé"}';

-- 8.4 Lire un audit.
CREATE OR REPLACE FUNCTION public.customs_audit_get(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id;
  IF v_row.id IS NULL OR NOT (v_row.client_user_id = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'audit', to_jsonb(v_row) || jsonb_build_object(
    'client', (SELECT jsonb_build_object('user_id', cl.user_id, 'first_name', cl.first_name, 'last_name', cl.last_name,
                                         'company_name', cl.company_name, 'customer_code', cl.customer_code)
               FROM public.clients cl WHERE cl.user_id = v_row.client_user_id)));
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_get(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_get(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_get(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Lire un audit de déclaration (constats, trop-perçu, délai de réclamation)"}';

-- 8.5 Le CAD rend son avis : ce qui est récupérable, et comment.
CREATE OR REPLACE FUNCTION public.customs_audit_review(p_id UUID, p_note TEXT, p_recoverable_xaf BIGINT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_broker public.customs_brokers; v_row public.customs_audits; v_note TEXT := NULLIF(trim(COALESCE(p_note, '')), '');
BEGIN
  v_broker := public.customs_active_broker(v_uid);
  IF v_broker.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservé à un commissionnaire agréé enregistré');
  END IF;
  IF v_note IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Votre avis est requis'); END IF;
  IF p_recoverable_xaf IS NOT NULL AND p_recoverable_xaf < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant négatif');
  END IF;
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable'); END IF;
  IF v_row.status NOT IN ('submitted','in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet audit n''attend pas d''avis');
  END IF;
  IF v_row.claimed_by IS NOT NULL AND v_row.claimed_by <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un autre commissionnaire a pris cet audit');
  END IF;
  UPDATE public.customs_audits
     SET status = 'reviewed', broker_note = v_note, recoverable_xaf = p_recoverable_xaf,
         reviewed_by = v_uid, reviewed_at = now(), broker_company = v_broker.company, broker_license_no = v_broker.license_no
   WHERE id = p_id;
  PERFORM public.customs_notify_client(v_row.client_user_id, 'customs_audit_reviewed',
    'Votre déclaration a été relue — ' || v_row.ref,
    CASE WHEN COALESCE(p_recoverable_xaf, 0) > 0
         THEN 'Récupérable selon le commissionnaire : ' || p_recoverable_xaf::text || ' XAF.'
         ELSE 'Le commissionnaire a rendu son avis.' END,
    jsonb_build_object('audit_id', p_id, 'ref', v_row.ref, 'recoverable_xaf', p_recoverable_xaf));
  RETURN jsonb_build_object('success', true, 'status', 'reviewed');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_review(UUID, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_review(UUID, TEXT, BIGINT) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_review(UUID, TEXT, BIGINT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canSignCustoms","confirm":true,"danger":true,"label":"Rendre l''avis du CAD sur un audit de déclaration (montant récupérable)"}';

-- 8.6 Les dossiers douane du client connecté : ses fiches et ses audits.
CREATE OR REPLACE FUNCTION public.customs_my_files()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Connexion requise'); END IF;
  RETURN jsonb_build_object(
    'success', true,
    'classifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'ref', c.ref, 'product_name', c.product_name, 'status', c.status,
        'proposed_code', c.proposed_code, 'final_code', c.final_code, 'broker_company', c.broker_company,
        'created_at', c.created_at, 'updated_at', c.updated_at) ORDER BY c.updated_at DESC)
      FROM public.customs_classifications c WHERE c.client_user_id = v_uid AND c.status <> 'cancelled'), '[]'::jsonb),
    'audits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'ref', a.ref, 'dau_number', a.dau_number, 'status', a.status, 'overpaid_xaf', a.overpaid_xaf,
        'recoverable_xaf', a.recoverable_xaf, 'claim_deadline', a.claim_deadline,
        'created_at', a.created_at, 'updated_at', a.updated_at) ORDER BY a.updated_at DESC)
      FROM public.customs_audits a WHERE a.client_user_id = v_uid AND a.status <> 'cancelled'), '[]'::jsonb)
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_my_files() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_my_files() TO authenticated;
COMMENT ON FUNCTION public.customs_my_files() IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Les dossiers douane du client connecté (vue du client)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 9. RPC — l'équipe
-- ─────────────────────────────────────────────────────────────────────────

-- 9.1 La file de revue : ce qui attend le CAD, le plus ancien d'abord.
CREATE OR REPLACE FUNCTION public.customs_review_queue()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canViewCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'is_broker', (public.customs_active_broker(v_uid)).user_id IS NOT NULL,
    'classifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'ref', c.ref, 'product_name', c.product_name, 'proposed_code', c.proposed_code, 'status', c.status,
        'submitted_at', c.submitted_at, 'claimed_by', c.claimed_by, 'mine', c.claimed_by = v_uid,
        'client', (SELECT jsonb_build_object('first_name', cl.first_name, 'last_name', cl.last_name, 'company_name', cl.company_name, 'customer_code', cl.customer_code)
                   FROM public.clients cl WHERE cl.user_id = c.client_user_id)
      ) ORDER BY c.submitted_at)
      FROM public.customs_classifications c WHERE c.status IN ('submitted','in_review')), '[]'::jsonb),
    'audits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'ref', a.ref, 'dau_number', a.dau_number, 'overpaid_xaf', a.overpaid_xaf, 'claim_deadline', a.claim_deadline,
        'status', a.status, 'submitted_at', a.submitted_at, 'claimed_by', a.claimed_by, 'mine', a.claimed_by = v_uid,
        'client', (SELECT jsonb_build_object('first_name', cl.first_name, 'last_name', cl.last_name, 'company_name', cl.company_name, 'customer_code', cl.customer_code)
                   FROM public.clients cl WHERE cl.user_id = a.client_user_id)
      ) ORDER BY a.claim_deadline NULLS LAST, a.submitted_at)
      FROM public.customs_audits a WHERE a.status IN ('submitted','in_review')), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'reviewed_at') DESC) FROM (
        SELECT jsonb_build_object('kind', 'classification', 'id', c.id, 'ref', c.ref, 'label', c.product_name, 'status', c.status,
                                  'final_code', c.final_code, 'reviewed_at', c.reviewed_at) AS row
        FROM public.customs_classifications c WHERE c.reviewed_at IS NOT NULL ORDER BY c.reviewed_at DESC LIMIT 20
      ) r), '[]'::jsonb)
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_review_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_review_queue() TO authenticated;
COMMENT ON FUNCTION public.customs_review_queue() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"La file du commissionnaire agréé : classements et déclarations à valider"}';

-- 9.2 Enregistrer (ou mettre à jour) l'agrément d'un CAD. Le compte doit avoir le rôle customs_broker.
CREATE OR REPLACE FUNCTION public.customs_broker_register(p_user_id UUID, p_company TEXT, p_license_no TEXT, p_representative_no TEXT DEFAULT NULL, p_active BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role::text = 'customs_broker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce compte n''a pas le rôle commissionnaire agréé');
  END IF;
  IF p_company IS NULL OR length(trim(p_company)) < 2 OR p_license_no IS NULL OR length(trim(p_license_no)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Société et numéro d''agrément requis');
  END IF;
  INSERT INTO public.customs_brokers (user_id, company, license_no, representative_no, active, created_by)
  VALUES (p_user_id, trim(p_company), trim(p_license_no), NULLIF(trim(COALESCE(p_representative_no, '')), ''), COALESCE(p_active, true), v_uid)
  ON CONFLICT (user_id) DO UPDATE
    SET company = EXCLUDED.company, license_no = EXCLUDED.license_no,
        representative_no = EXCLUDED.representative_no, active = EXCLUDED.active;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_broker_register(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_broker_register(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.customs_broker_register(UUID, TEXT, TEXT, TEXT, BOOLEAN) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Enregistrer l''agrément d''un commissionnaire agréé en douane"}';


-- ############################################################################
-- SECTION 2 — Le parcours d'un audit de DAU (étape 5)
-- ← supabase/migrations/20260929130000_customs_audit_workflow.sql
-- prendre, abandonner, soumettre un audit ; la file de revue du CAD réécrite
-- pour y montrer aussi les audits (remplace deux fonctions de la section 1).
-- ############################################################################

-- ============================================================================
-- Douane, étape 5 — vérifier une déclaration (DAU) : le circuit de l'audit.
--
-- Le socle (20260929120000_customs_foundation.sql) créait l'audit, ses constats
-- et l'avis du commissionnaire. Il manquait :
--   1. customs_audit_claim  — le CAD prend un audit (il quitte la file des autres),
--      comme pour les fiches de classement ;
--   2. customs_audit_cancel — le client abandonne un audit tant qu'aucun avis
--      n'est rendu ;
--   3. le lien de la notification aux CAD : /m/douane/audit/<id> (il pointait vers
--      l'écran des fiches de classement) ;
--   4. la file garde aussi les audits relus dans « récents ».
--
-- La LECTURE de la DAU est faite par l'edge function customs-ai (action
-- read_dau, clé de service) : statut reading → read ou failed, extraction,
-- numéro, bureau, dates. Les constats sont calculés par l'app
-- (src/lib/customs/audit.ts) et enregistrés par customs_audit_save_findings.
-- Idempotente : rejouable.
-- ============================================================================

-- 1. Le CAD prend l'audit.
CREATE OR REPLACE FUNCTION public.customs_audit_claim(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  IF (public.customs_active_broker(v_uid)).user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservé à un commissionnaire agréé enregistré');
  END IF;
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable'); END IF;
  IF v_row.status NOT IN ('submitted','in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet audit n''attend pas de relecture');
  END IF;
  IF v_row.status = 'in_review' AND v_row.claimed_by IS NOT NULL AND v_row.claimed_by <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un autre commissionnaire a pris cet audit');
  END IF;
  UPDATE public.customs_audits SET status = 'in_review', claimed_by = v_uid WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'status', 'in_review');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_claim(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_claim(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_claim(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canSignCustoms","confirm":true,"danger":false,"label":"Prendre un audit de déclaration en relecture (CAD)"}';

-- 2. Le client abandonne son audit — jamais après l'avis du CAD.
CREATE OR REPLACE FUNCTION public.customs_audit_cancel(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.client_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  -- Statuts terminaux : un avis rendu ne s'annule pas.
  IF v_row.status IN ('reviewed','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit déjà clos');
  END IF;
  UPDATE public.customs_audits SET status = 'cancelled' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_cancel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_cancel(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_cancel(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Le client abandonne son audit de déclaration (action du client)"}';

-- 3. L'envoi au CAD : même règle, bon lien.
CREATE OR REPLACE FUNCTION public.customs_audit_submit(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT (v_row.client_user_id = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  IF v_row.status NOT IN ('uploaded','read','failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit déjà envoyé');
  END IF;
  UPDATE public.customs_audits SET status = 'submitted', submitted_at = now(), claimed_by = NULL WHERE id = p_id;
  PERFORM public.customs_notify_brokers(
    'DAU à relire — ' || v_row.ref,
    COALESCE(v_row.dau_number, 'Déclaration') || COALESCE(' · économie estimée ' || v_row.overpaid_xaf::text || ' XAF', ''),
    '/m/douane/audit/' || p_id::text);
  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_submit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_submit(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_submit(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Envoyer un audit de déclaration au commissionnaire agréé"}';

-- 4. La file : les audits relus rejoignent l'historique.
CREATE OR REPLACE FUNCTION public.customs_review_queue()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canViewCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'is_broker', (public.customs_active_broker(v_uid)).user_id IS NOT NULL,
    'classifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'ref', c.ref, 'product_name', c.product_name, 'proposed_code', c.proposed_code, 'status', c.status,
        'submitted_at', c.submitted_at, 'claimed_by', c.claimed_by, 'mine', c.claimed_by = v_uid,
        'client', (SELECT jsonb_build_object('first_name', cl.first_name, 'last_name', cl.last_name, 'company_name', cl.company_name, 'customer_code', cl.customer_code)
                   FROM public.clients cl WHERE cl.user_id = c.client_user_id)
      ) ORDER BY c.submitted_at)
      FROM public.customs_classifications c WHERE c.status IN ('submitted','in_review')), '[]'::jsonb),
    'audits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'ref', a.ref, 'dau_number', a.dau_number, 'overpaid_xaf', a.overpaid_xaf, 'claim_deadline', a.claim_deadline,
        'status', a.status, 'submitted_at', a.submitted_at, 'claimed_by', a.claimed_by, 'mine', a.claimed_by = v_uid,
        'client', (SELECT jsonb_build_object('first_name', cl.first_name, 'last_name', cl.last_name, 'company_name', cl.company_name, 'customer_code', cl.customer_code)
                   FROM public.clients cl WHERE cl.user_id = a.client_user_id)
      ) ORDER BY a.claim_deadline NULLS LAST, a.submitted_at)
      FROM public.customs_audits a WHERE a.status IN ('submitted','in_review')), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'reviewed_at') DESC) FROM (
        (SELECT jsonb_build_object('kind', 'classification', 'id', c.id, 'ref', c.ref, 'label', c.product_name, 'status', c.status,
                                   'final_code', c.final_code, 'amount_xaf', NULL, 'reviewed_at', c.reviewed_at) AS row
           FROM public.customs_classifications c WHERE c.reviewed_at IS NOT NULL ORDER BY c.reviewed_at DESC LIMIT 20)
        UNION ALL
        (SELECT jsonb_build_object('kind', 'audit', 'id', a.id, 'ref', a.ref, 'label', COALESCE(a.dau_number, 'Déclaration'), 'status', a.status,
                                   'final_code', NULL, 'amount_xaf', a.recoverable_xaf, 'reviewed_at', a.reviewed_at) AS row
           FROM public.customs_audits a WHERE a.reviewed_at IS NOT NULL ORDER BY a.reviewed_at DESC LIMIT 20)
      ) r), '[]'::jsonb)
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_review_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_review_queue() TO authenticated;
COMMENT ON FUNCTION public.customs_review_queue() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"La file du commissionnaire agréé : classements et déclarations à valider"}';


-- ############################################################################
-- SECTION 3 — La veille réglementaire et les perturbations (étape 6)
-- ← supabase/migrations/20260930090000_customs_notices.sql
-- table customs_notices (lisible par anon : le site est public), RPC de
-- publication et d'archivage, 8 avis de départ (ON CONFLICT DO NOTHING).
-- ############################################################################

-- ============================================================================
-- Douane, étape 6 — la veille réglementaire et les perturbations.
--
-- Le « regulatory watch » et la « disruptions layer » de Flexport, pour un
-- importateur camerounais : ce qui change dans les textes (TEC, loi de
-- finances, SGS, CIVIC…) et ce qui retarde la marchandise (congés en Chine,
-- port, corridor). Une seule table, deux sortes d'avis.
--
--   customs_notices          — lisible par tous une fois publié (le hub
--                              douane est public, comme le simulateur) ;
--                              l'équipe (canViewCustoms) voit aussi les brouillons.
--   customs_notice_upsert    — l'équipe douane (canManageCustoms) écrit ou
--                              corrige un avis ; à la première publication d'un
--                              avis réglementaire, les clients dont un produit
--                              classé est visé sont prévenus.
--   customs_notice_archive   — retirer un avis de la publication.
--
-- Les avis de départ ne viennent que de textes lus (docs/douane/01-sources.md)
-- ou du calendrier ; chaque avis porte sa source et sa confiance. Aucune
-- perturbation en cours n'est inventée : l'équipe les publie quand elles arrivent.
-- Idempotente : rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customs_notices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  kind          TEXT NOT NULL CHECK (kind IN ('regulation','disruption')),
  title         TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  summary       TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 3 AND 600),
  advice        TEXT CHECK (advice IS NULL OR length(advice) <= 1000),
  -- Réglementation : en vigueur, adoptée ou annoncée (pas encore appliquée), ou à confirmer.
  status        TEXT NOT NULL DEFAULT 'in_force' CHECK (status IN ('in_force','announced','watch')),
  severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  starts_on     DATE,
  ends_on       DATE,
  -- Perturbation : le retard typique, en jours.
  delay_days    INTEGER CHECK (delay_days IS NULL OR delay_days BETWEEN 0 AND 120),
  -- Les codes SH visés, par préfixe (2 à 12 chiffres). Vide : tout le monde.
  hs_specs      TEXT[] NOT NULL DEFAULT '{}',
  -- Les lieux, en UN/LOCODE ou préfixe pays : CN, CNSHA, CMDLA, CMKBI…
  places        TEXT[] NOT NULL DEFAULT '{}',
  source_label  TEXT CHECK (source_label IS NULL OR length(source_label) <= 200),
  source_url    TEXT CHECK (source_url IS NULL OR source_url ~ '^https://[^\s]+$'),
  confidence    TEXT NOT NULL DEFAULT 'a_verifier' CHECK (confidence IN ('officiel','observe','marche','a_verifier')),
  published     BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customs_notices_dates_check CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT customs_notices_specs_check CHECK (cardinality(hs_specs) <= 60 AND array_to_string(hs_specs, ',') ~ '^([0-9]{2,12}(,[0-9]{2,12})*)?$'),
  CONSTRAINT customs_notices_places_check CHECK (cardinality(places) <= 20 AND array_to_string(places, ',') ~ '^([A-Z]{2}([A-Z0-9]{3})?(-[A-Z]{2})?(,[A-Z]{2}([A-Z0-9]{3})?(-[A-Z]{2})?)*)?$')
);
CREATE INDEX IF NOT EXISTS customs_notices_feed_idx ON public.customs_notices (published, kind, starts_on DESC);

DROP TRIGGER IF EXISTS customs_notices_touch ON public.customs_notices;
CREATE TRIGGER customs_notices_touch BEFORE UPDATE ON public.customs_notices FOR EACH ROW EXECUTE FUNCTION public.customs_touch_updated_at();

ALTER TABLE public.customs_notices ENABLE ROW LEVEL SECURITY;
-- Deux politiques : anon ne doit jamais évaluer admin_has_permission.
DROP POLICY IF EXISTS customs_notices_public_read ON public.customs_notices;
CREATE POLICY customs_notices_public_read ON public.customs_notices FOR SELECT TO anon USING (published);
DROP POLICY IF EXISTS customs_notices_member_read ON public.customs_notices;
CREATE POLICY customs_notices_member_read ON public.customs_notices FOR SELECT TO authenticated
  USING (published OR public.admin_has_permission(auth.uid(), 'canViewCustoms'));
-- Aucune écriture directe : customs_notice_upsert / customs_notice_archive.
GRANT SELECT ON public.customs_notices TO anon, authenticated;

-- ─── Écrire ou corriger un avis ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customs_notice_upsert(p_notice JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_slug TEXT := lower(trim(COALESCE(p_notice ->> 'slug', '')));
  v_prev public.customs_notices;
  v_row public.customs_notices;
  v_specs TEXT[];
  v_places TEXT[];
  v_publish BOOLEAN := COALESCE(p_notice ->> 'published', '') = 'true';
  v_notified INTEGER := 0;
  v_client UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_notice IS NULL OR jsonb_typeof(p_notice) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avis invalide');
  END IF;
  IF v_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identifiant invalide (minuscules, chiffres et tirets)');
  END IF;
  IF COALESCE(p_notice ->> 'kind', '') NOT IN ('regulation','disruption') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''avis inconnu');
  END IF;
  IF jsonb_typeof(COALESCE(p_notice -> 'hs_specs', '[]')) <> 'array' OR jsonb_typeof(COALESCE(p_notice -> 'places', '[]')) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Codes ou lieux invalides');
  END IF;
  SELECT COALESCE(array_agg(DISTINCT regexp_replace(x, '[^0-9]', '', 'g')), '{}') INTO v_specs
    FROM jsonb_array_elements_text(COALESCE(p_notice -> 'hs_specs', '[]')) x WHERE regexp_replace(x, '[^0-9]', '', 'g') <> '';
  SELECT COALESCE(array_agg(DISTINCT upper(trim(x))), '{}') INTO v_places
    FROM jsonb_array_elements_text(COALESCE(p_notice -> 'places', '[]')) x WHERE trim(x) <> '';

  SELECT * INTO v_prev FROM public.customs_notices WHERE slug = v_slug FOR UPDATE;
  BEGIN
    INSERT INTO public.customs_notices AS n (
      slug, kind, title, summary, advice, status, severity, starts_on, ends_on, delay_days, hs_specs, places,
      source_label, source_url, confidence, published, published_at, created_by)
    VALUES (
      v_slug, p_notice ->> 'kind', trim(p_notice ->> 'title'), trim(p_notice ->> 'summary'), NULLIF(trim(COALESCE(p_notice ->> 'advice', '')), ''),
      COALESCE(p_notice ->> 'status', 'in_force'), COALESCE(p_notice ->> 'severity', 'medium'),
      NULLIF(p_notice ->> 'starts_on', '')::date, NULLIF(p_notice ->> 'ends_on', '')::date, NULLIF(p_notice ->> 'delay_days', '')::integer,
      v_specs, v_places, NULLIF(trim(COALESCE(p_notice ->> 'source_label', '')), ''), NULLIF(trim(COALESCE(p_notice ->> 'source_url', '')), ''),
      COALESCE(p_notice ->> 'confidence', 'a_verifier'), v_publish, CASE WHEN v_publish THEN now() END, v_uid)
    ON CONFLICT (slug) DO UPDATE SET
      kind = EXCLUDED.kind, title = EXCLUDED.title, summary = EXCLUDED.summary, advice = EXCLUDED.advice,
      status = EXCLUDED.status, severity = EXCLUDED.severity, starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on,
      delay_days = EXCLUDED.delay_days, hs_specs = EXCLUDED.hs_specs, places = EXCLUDED.places,
      source_label = EXCLUDED.source_label, source_url = EXCLUDED.source_url, confidence = EXCLUDED.confidence,
      published = EXCLUDED.published,
      published_at = CASE WHEN EXCLUDED.published AND NOT n.published THEN now() ELSE n.published_at END
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN check_violation OR not_null_violation OR invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RETURN jsonb_build_object('success', false, 'error', 'Avis incomplet ou invalide : ' || SQLERRM);
  END;

  -- Première publication d'un avis réglementaire ciblé : les clients dont un produit
  -- classé (code signé, sinon proposé) est visé en sont prévenus, une fois chacun.
  IF v_row.published AND v_row.kind = 'regulation' AND cardinality(v_row.hs_specs) > 0
     AND (v_prev.id IS NULL OR NOT v_prev.published) THEN
    FOR v_client IN
      SELECT DISTINCT c.client_user_id FROM public.customs_classifications c
       WHERE c.status <> 'cancelled'
         AND EXISTS (SELECT 1 FROM unnest(v_row.hs_specs) s WHERE COALESCE(c.final_code, c.proposed_code) LIKE s || '%')
    LOOP
      PERFORM public.customs_notify_client(v_client, 'customs_notice', 'Veille douane — ' || v_row.title, v_row.summary,
        jsonb_build_object('notice_id', v_row.id, 'slug', v_row.slug));
      v_notified := v_notified + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_row.id, 'slug', v_row.slug, 'published', v_row.published, 'notified', v_notified);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_notice_upsert(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_notice_upsert(JSONB) TO authenticated;
COMMENT ON FUNCTION public.customs_notice_upsert(JSONB) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCustoms","confirm":true,"danger":false,"label":"Publier ou corriger un avis de veille douane (changement réglementaire ou perturbation logistique)"}';

-- ─── Retirer un avis ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customs_notice_archive(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  UPDATE public.customs_notices SET published = false WHERE id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Avis introuvable'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_notice_archive(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_notice_archive(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_notice_archive(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCustoms","confirm":true,"danger":false,"label":"Retirer un avis de veille douane de la publication"}';

-- ─── Les avis de départ : des textes lus, le calendrier ─────────────────────
INSERT INTO public.customs_notices
  (slug, kind, title, summary, advice, status, severity, starts_on, ends_on, delay_days, hs_specs, places, source_label, source_url, confidence, published, published_at)
VALUES
  ('tec-ceeac-2026', 'regulation',
   'Le tarif extérieur commun de la CEEAC s''applique depuis le 1er janvier 2026',
   'Le TEC de la CEEAC remplace celui de la CEMAC. Certaines familles peuvent passer à 40 % : vêtements, mèches et perruques, tissus, chocolat, tabac, eaux et boissons. Le taux de chaque ligne reste à confirmer sur le tarif intégré CAMCIS.',
   'Avant de commander, faites confirmer le taux de vos lignes par votre commissionnaire. Le simulateur signale les familles concernées.',
   'in_force', 'high', DATE '2026-01-01', NULL, NULL,
   ARRAY['61','62','6703','6704','5208','5209','5210','5211','5212','5407','5408','5512','5513','5514','5515','5516','1805','1806','24','2201','2202'],
   '{}', 'Conseil national des chargeurs du Cameroun (CNCC)', 'https://www.cncc.cm/fr/article/le-tarif-exterieur-commun-tec-de-la-ceeac-s-applique-au-cameroun-1031', 'officiel', true, now()),
  ('lf2026-accises-vehicules', 'regulation',
   'Accises sur les véhicules : la nouvelle table de la loi de finances 2026',
   'La loi de finances 2026 (art. 10) change les seuils d''âge et de cylindrée des accises sur les véhicules. En septembre 2026, CAMCIS appliquait encore l''ancienne table : une Yaris de 2009 payait 25 %.',
   'Le simulateur chiffre les deux règles pour votre véhicule : comparez avant d''acheter.',
   'announced', 'medium', DATE '2026-01-01', NULL, NULL,
   ARRAY['8702','8703','8704'], '{}', 'Projet de loi de finances 2026 (DGB)', 'https://www.dgb.cm/wp-content/uploads/2025/11/PROJET-DE-LOI-FINANCES-2026_FR_26112025.pdf', 'a_verifier', true, now()),
  ('lf2026-taxe-environnementale', 'regulation',
   'Taxe environnementale à l''importation (loi de finances 2026)',
   'Perçue par la douane : ciment 2 500 F la tonne, fers à béton 5 000 F, carreaux et céramiques 15 000 F, articles en plastique 5 % de la valeur (1 000 F au plus par unité). Montants lus dans le projet de loi ; texte promulgué à vérifier.',
   'Donnez le poids net dans le simulateur pour l''estimer.',
   'announced', 'medium', DATE '2026-01-01', NULL, NULL,
   ARRAY['2523','7213','7214','6907','6908','39'], '{}', 'Projet de loi de finances 2026 (DGB)', 'https://www.dgb.cm/wp-content/uploads/2025/11/PROJET-DE-LOI-FINANCES-2026_FR_26112025.pdf', 'a_verifier', true, now()),
  ('civic-vehicules-occasion', 'regulation',
   'CIVIC : 29 813 F par véhicule d''occasion',
   'Depuis le 1er juillet 2025, chaque véhicule d''occasion importé paie le contrôle d''identification (CIVIC), en dehors de la DAU.',
   'Comptez-le dans le coût de revient : le simulateur l''ajoute pour un véhicule d''occasion.',
   'in_force', 'low', DATE '2025-07-01', NULL, NULL,
   ARRAY['8702','8703','8704'], '{}', 'Mesure du ministère des Finances (presse spécialisée)', NULL, 'marche', true, now()),
  ('pvi-sgs-facture-definitive', 'regulation',
   'Inspection SGS : 0,95 % dès 2 000 000 F FOB, et la facture définitive',
   'Toute importation de 2 000 000 F FOB ou plus est inspectée par la SGS : 0,95 % de la valeur FOB. Sans facture définitive déposée à temps, la valeur retenue peut être bien plus élevée — 2 311 829 F de trop sur une Toyota Fortuner.',
   'Demandez à votre fournisseur de déposer la facture définitive sur export-cm.sgs.com dès l''expédition.',
   'in_force', 'high', DATE '2016-11-30', NULL, NULL,
   '{}', '{}', 'Instruction 000625/MINFI/CAB ; guide de l''importateur SGS Cameroun',
   'https://www.sgs.com/fr-cm/-/media/SGSCorp/Documents/Corporate/Technical-Documents/Technical-Guidelines-and-Policies/Guide-des-Importateurs-Cameroun-FR.cdn.fr-cm.pdf', 'officiel', true, now()),
  ('code-douanes-ceeac-cemac-2026', 'regulation',
   'Nouveau code des douanes CEEAC-CEMAC',
   'Un code des douanes commun CEEAC-CEMAC est en vigueur depuis le 1er janvier 2026. Les délais et voies de recours cités par Bonzini (rectification, réclamation en trois ans) viennent du code CEMAC 2019 : leur numérotation est à confirmer dans le nouveau texte.',
   'Pour une réclamation, faites vérifier l''article et le délai par votre commissionnaire.',
   'watch', 'low', DATE '2026-01-01', NULL, NULL,
   '{}', '{}', NULL, NULL, 'a_verifier', true, now()),
  ('chine-fete-nationale-2026', 'disruption',
   'Chine : congés de la fête nationale, du 1er au 7 octobre 2026',
   'Usines, transporteurs routiers et bureaux chinois s''arrêtent une semaine. Les réservations se tendent juste avant ; la production et les départs reprennent lentement après.',
   'Validez commandes et paiements fournisseurs avant le 30 septembre ; comptez une à deux semaines de plus sur ce qui devait partir en octobre.',
   'in_force', 'medium', DATE '2026-10-01', DATE '2026-10-07', 7,
   '{}', ARRAY['CN'], 'Calendrier des congés officiels chinois', NULL, 'marche', true, now()),
  ('nouvel-an-chinois-2027', 'disruption',
   'Nouvel An chinois : le 6 février 2027',
   'La plupart des usines ferment deux à quatre semaines autour du 6 février 2027. La production s''arrête avant, les ouvriers reviennent lentement après : c''est la plus longue coupure de l''année.',
   'Commandez et réglez vos fournisseurs avant la mi-janvier ; comptez trois semaines de décalage sur ce qui devait partir en février.',
   'in_force', 'high', DATE '2027-01-30', DATE '2027-02-21', 21,
   '{}', ARRAY['CN'], 'Calendrier lunaire ; pratique des usines', NULL, 'marche', true, now())
ON CONFLICT (slug) DO NOTHING;


-- ############################################################################
-- SECTION 4 — Les fournisseurs invités (étape 7)
-- ← supabase/migrations/20260930120000_customs_supplier_invites.sql
-- invitations par lien (jeton haché), documents déposés sans compte ; les
-- deux RPC d'écriture ne sont exécutables que par service_role (edge
-- function customs-supplier).
-- ############################################################################

-- ============================================================================
-- Douane, étape 7 — inviter son fournisseur chinois à déposer ses documents.
--
-- Les « invitations de partenaires » de Flexport, pour l'importateur
-- camerounais : un lien (sans compte) que le client envoie sur WeChat ou
-- WhatsApp ; le fournisseur y dépose la facture définitive (celle que la SGS
-- attend), la liste de colisage, la fiche technique, les photos, le
-- certificat d'origine. La page du fournisseur parle chinois.
--
--   customs_supplier_invites    — l'invitation ; le jeton n'est gardé que haché
--                                 (sha256), montré une seule fois au client ;
--   customs_supplier_documents  — ce que le fournisseur a déposé, dans le
--                                 dossier du client (<uid>/supplier-…).
--
--   customs_invite_create / _revoke / customs_my_invites — le client ;
--   customs_invite_public(token)                          — la page du fournisseur (anon) ;
--   customs_invite_upload_target / _record_document      — l'edge function
--                                  customs-supplier, clé de service seulement.
-- Le fournisseur n'écrit jamais en base ni dans le seau lui-même.
-- Idempotente : rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customs_supplier_invites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash         TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  supplier_name      TEXT NOT NULL CHECK (length(trim(supplier_name)) BETWEEN 2 AND 120),
  supplier_contact   TEXT CHECK (supplier_contact IS NULL OR length(supplier_contact) <= 160),
  language           TEXT NOT NULL DEFAULT 'zh' CHECK (language IN ('zh','en','fr')),
  requested          TEXT[] NOT NULL CHECK (
                       cardinality(requested) BETWEEN 1 AND 7
                       AND requested <@ ARRAY['final_invoice','proforma','packing_list','product_sheet','photos','certificate_origin','other']::text[]),
  message            TEXT CHECK (message IS NULL OR length(message) <= 1000),
  classification_id  UUID REFERENCES public.customs_classifications(id) ON DELETE SET NULL,
  due_on             DATE,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','revoked')),
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  last_upload_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customs_supplier_invites_client_idx ON public.customs_supplier_invites (client_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customs_supplier_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id       UUID NOT NULL REFERENCES public.customs_supplier_invites(id) ON DELETE CASCADE,
  client_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('final_invoice','proforma','packing_list','product_sheet','photos','certificate_origin','other')),
  file_path       TEXT NOT NULL UNIQUE,
  file_name       TEXT CHECK (file_name IS NULL OR length(file_name) <= 200),
  mime            TEXT NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes      INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  note            TEXT CHECK (note IS NULL OR length(note) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customs_supplier_documents_invite_idx ON public.customs_supplier_documents (invite_id, created_at);

DROP TRIGGER IF EXISTS customs_supplier_invites_touch ON public.customs_supplier_invites;
CREATE TRIGGER customs_supplier_invites_touch BEFORE UPDATE ON public.customs_supplier_invites FOR EACH ROW EXECUTE FUNCTION public.customs_touch_updated_at();

ALTER TABLE public.customs_supplier_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customs_supplier_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customs_supplier_invites_read ON public.customs_supplier_invites;
CREATE POLICY customs_supplier_invites_read ON public.customs_supplier_invites FOR SELECT TO authenticated
  USING (client_user_id = auth.uid() OR public.admin_has_permission(auth.uid(), 'canViewCustoms'));
DROP POLICY IF EXISTS customs_supplier_documents_read ON public.customs_supplier_documents;
CREATE POLICY customs_supplier_documents_read ON public.customs_supplier_documents FOR SELECT TO authenticated
  USING (client_user_id = auth.uid() OR public.admin_has_permission(auth.uid(), 'canViewCustoms'));
-- Aucune écriture directe : les RPC ci-dessous.

-- Le haché d'un jeton : ce qui est gardé en base, jamais le jeton.
CREATE OR REPLACE FUNCTION public.customs_invite_hash(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$ SELECT encode(sha256(convert_to(COALESCE(p_token, ''), 'UTF8')), 'hex') $fn$;
REVOKE ALL ON FUNCTION public.customs_invite_hash(TEXT) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.customs_invite_hash(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCustoms","confirm":false,"danger":false,"label":"Haché du jeton d''invitation fournisseur (helper interne)"}';

-- L'invitation valide derrière un jeton, ou rien.
CREATE OR REPLACE FUNCTION public.customs_invite_by_token(p_token TEXT)
RETURNS public.customs_supplier_invites
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT i.* FROM public.customs_supplier_invites i
   WHERE p_token ~ '^[0-9a-f]{64}$'
     AND i.token_hash = public.customs_invite_hash(p_token)
     AND i.status = 'open' AND i.expires_at > now()
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_by_token(TEXT) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.customs_invite_by_token(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCustoms","confirm":false,"danger":false,"label":"Invitation fournisseur valide derrière un jeton (helper interne)"}';

-- ─── Le client invite ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customs_invite_create(
  p_supplier_name TEXT,
  p_requested TEXT[],
  p_supplier_contact TEXT DEFAULT NULL,
  p_language TEXT DEFAULT 'zh',
  p_message TEXT DEFAULT NULL,
  p_due_on DATE DEFAULT NULL,
  p_classification_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_token TEXT; v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte client requis');
  END IF;
  IF p_classification_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.customs_classifications WHERE id = p_classification_id AND client_user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fiche introuvable');
  END IF;
  IF p_due_on IS NOT NULL AND p_due_on < current_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'Échéance dans le passé');
  END IF;
  -- Garde-fou : un lien est une porte ouverte sur le dossier ; vingt par jour suffisent.
  IF (SELECT count(*) FROM public.customs_supplier_invites WHERE client_user_id = v_uid AND created_at > now() - interval '1 day') >= 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trop d''invitations aujourd''hui');
  END IF;
  -- 2 × 122 bits d'aléa : le jeton ne se devine pas. Seul son haché est gardé.
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  BEGIN
    INSERT INTO public.customs_supplier_invites (client_user_id, token_hash, supplier_name, supplier_contact, language, requested, message, classification_id, due_on)
    VALUES (v_uid, public.customs_invite_hash(v_token), trim(p_supplier_name), NULLIF(trim(COALESCE(p_supplier_contact, '')), ''),
            COALESCE(p_language, 'zh'), (SELECT array_agg(DISTINCT r) FROM unnest(p_requested) r), NULLIF(trim(COALESCE(p_message, '')), ''),
            p_classification_id, p_due_on)
    RETURNING id INTO v_id;
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation incomplète : fournisseur, langue et documents demandés');
  END;
  RETURN jsonb_build_object('success', true, 'id', v_id, 'token', v_token);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_create(TEXT, TEXT[], TEXT, TEXT, TEXT, DATE, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_invite_create(TEXT, TEXT[], TEXT, TEXT, TEXT, DATE, UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_invite_create(TEXT, TEXT[], TEXT, TEXT, TEXT, DATE, UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Le client invite son fournisseur à déposer ses documents (action du client)"}';

CREATE OR REPLACE FUNCTION public.customs_invite_revoke(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  UPDATE public.customs_supplier_invites SET status = 'revoked' WHERE id = p_id AND client_user_id = v_uid AND status = 'open';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation introuvable ou déjà close'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_revoke(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_invite_revoke(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_invite_revoke(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Le client ferme le lien d''un fournisseur (action du client)"}';

-- Un nouveau lien pour la même invitation : l'ancien cesse de marcher (le
-- jeton n'est gardé que haché : on ne peut pas le « réafficher », on le remplace).
CREATE OR REPLACE FUNCTION public.customs_invite_rotate(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_token TEXT;
BEGIN
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  UPDATE public.customs_supplier_invites
     SET token_hash = public.customs_invite_hash(v_token), expires_at = now() + interval '30 days'
   WHERE id = p_id AND client_user_id = v_uid AND status = 'open';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invitation introuvable ou fermée'); END IF;
  RETURN jsonb_build_object('success', true, 'id', p_id, 'token', v_token);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_rotate(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_invite_rotate(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_invite_rotate(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Le client génère un nouveau lien pour son fournisseur ; l''ancien cesse de marcher (action du client)"}';

CREATE OR REPLACE FUNCTION public.customs_my_invites()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Connexion requise'); END IF;
  RETURN jsonb_build_object('success', true, 'invites', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', i.id, 'supplier_name', i.supplier_name, 'supplier_contact', i.supplier_contact, 'language', i.language,
      'requested', i.requested, 'message', i.message, 'classification_id', i.classification_id, 'due_on', i.due_on,
      'status', CASE WHEN i.status = 'open' AND i.expires_at <= now() THEN 'expired' ELSE i.status END,
      'expires_at', i.expires_at, 'last_upload_at', i.last_upload_at, 'created_at', i.created_at,
      'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'file_path', d.file_path, 'file_name', d.file_name,
                                   'mime', d.mime, 'size_bytes', d.size_bytes, 'note', d.note, 'created_at', d.created_at) ORDER BY d.created_at)
                              FROM public.customs_supplier_documents d WHERE d.invite_id = i.id), '[]'::jsonb)
    ) ORDER BY i.created_at DESC)
    FROM public.customs_supplier_invites i WHERE i.client_user_id = v_uid), '[]'::jsonb));
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_my_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_my_invites() TO authenticated;
COMMENT ON FUNCTION public.customs_my_invites() IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Les invitations fournisseur du client connecté et les documents reçus (vue du client)"}';

-- ─── La page du fournisseur (sans compte) ───────────────────────────────────
-- Ce que le fournisseur doit savoir, et rien de plus : ni l'identifiant du
-- client, ni son téléphone, ni son adresse électronique.
CREATE OR REPLACE FUNCTION public.customs_invite_public(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_inv public.customs_supplier_invites;
BEGIN
  v_inv := public.customs_invite_by_token(p_token);
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  END IF;
  RETURN jsonb_build_object('success', true, 'invite', jsonb_build_object(
    'supplier_name', v_inv.supplier_name, 'language', v_inv.language, 'requested', v_inv.requested,
    'message', v_inv.message, 'due_on', v_inv.due_on, 'expires_at', v_inv.expires_at,
    'importer', (SELECT COALESCE(NULLIF(c.company_name, ''), c.first_name) FROM public.clients c WHERE c.user_id = v_inv.client_user_id),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', d.kind, 'file_name', d.file_name, 'created_at', d.created_at) ORDER BY d.created_at)
                           FROM public.customs_supplier_documents d WHERE d.invite_id = v_inv.id), '[]'::jsonb)));
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_public(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customs_invite_public(TEXT) TO anon, authenticated;
COMMENT ON FUNCTION public.customs_invite_public(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Page publique du fournisseur invité (par jeton, sans compte)"}';

-- ─── Le dépôt, par l'edge function customs-supplier (clé de service) ───────
-- 1. Où déposer, et si c'est permis.
CREATE OR REPLACE FUNCTION public.customs_invite_upload_target(p_token TEXT, p_kind TEXT, p_mime TEXT, p_size INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_inv public.customs_supplier_invites;
BEGIN
  v_inv := public.customs_invite_by_token(p_token);
  IF v_inv.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_or_expired'); END IF;
  IF p_kind IS NULL OR NOT (p_kind = ANY (v_inv.requested) OR p_kind = 'other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'kind_not_requested');
  END IF;
  IF COALESCE(p_mime, '') NOT IN ('application/pdf','image/jpeg','image/png','image/webp') THEN
    RETURN jsonb_build_object('success', false, 'error', 'file_type');
  END IF;
  IF COALESCE(p_size, 0) NOT BETWEEN 1 AND 10485760 THEN RETURN jsonb_build_object('success', false, 'error', 'file_size'); END IF;
  IF (SELECT count(*) FROM public.customs_supplier_documents WHERE invite_id = v_inv.id) >= 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_files');
  END IF;
  RETURN jsonb_build_object('success', true, 'folder', v_inv.client_user_id::text);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_upload_target(TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customs_invite_upload_target(TEXT, TEXT, TEXT, INTEGER) TO service_role;
COMMENT ON FUNCTION public.customs_invite_upload_target(TEXT, TEXT, TEXT, INTEGER) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCustoms","confirm":false,"danger":false,"label":"Contrôle d''un dépôt fournisseur (edge function, clé de service)"}';

-- 2. Le fichier est dans le seau : on l'inscrit, et on prévient le client.
CREATE OR REPLACE FUNCTION public.customs_invite_record_document(
  p_token TEXT, p_kind TEXT, p_path TEXT, p_name TEXT, p_mime TEXT, p_size INTEGER, p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_inv public.customs_supplier_invites; v_check JSONB; v_id UUID;
BEGIN
  v_check := public.customs_invite_upload_target(p_token, p_kind, p_mime, p_size);
  IF (v_check ->> 'success')::boolean IS NOT TRUE THEN RETURN v_check; END IF;
  SELECT * INTO v_inv FROM public.customs_supplier_invites WHERE token_hash = public.customs_invite_hash(p_token) FOR UPDATE;
  -- Le fichier doit être dans le dossier de CE client, sous le préfixe des dépôts fournisseur.
  IF p_path IS NULL OR p_path !~ ('^' || v_inv.client_user_id::text || '/supplier-[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_path');
  END IF;
  INSERT INTO public.customs_supplier_documents (invite_id, client_user_id, kind, file_path, file_name, mime, size_bytes, note)
  VALUES (v_inv.id, v_inv.client_user_id, p_kind, p_path, left(NULLIF(trim(COALESCE(p_name, '')), ''), 200), p_mime, p_size,
          left(NULLIF(trim(COALESCE(p_note, '')), ''), 500))
  RETURNING id INTO v_id;
  UPDATE public.customs_supplier_invites SET last_upload_at = now() WHERE id = v_inv.id;
  PERFORM public.customs_notify_client(v_inv.client_user_id, 'customs_supplier_document',
    'Document reçu de ' || v_inv.supplier_name,
    CASE p_kind WHEN 'final_invoice' THEN 'Facture définitive' WHEN 'proforma' THEN 'Facture proforma' WHEN 'packing_list' THEN 'Liste de colisage'
                WHEN 'product_sheet' THEN 'Fiche technique' WHEN 'photos' THEN 'Photos' WHEN 'certificate_origin' THEN 'Certificat d''origine'
                ELSE 'Document' END || COALESCE(' : ' || left(p_name, 80), ''),
    jsonb_build_object('invite_id', v_inv.id, 'document_id', v_id, 'kind', p_kind));
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_invite_record_document(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customs_invite_record_document(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;
COMMENT ON FUNCTION public.customs_invite_record_document(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCustoms","confirm":false,"danger":false,"label":"Inscrire un document déposé par un fournisseur (edge function, clé de service)"}';

-- L'équipe voit les documents reçus d'un client (lecture seule).
CREATE OR REPLACE FUNCTION public.customs_client_supplier_documents(p_client_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'documents', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'file_path', d.file_path, 'file_name', d.file_name, 'supplier_name', i.supplier_name,
                                        'classification_id', i.classification_id, 'created_at', d.created_at) ORDER BY d.created_at DESC)
      FROM public.customs_supplier_documents d JOIN public.customs_supplier_invites i ON i.id = d.invite_id
     WHERE d.client_user_id = p_client_user_id), '[]'::jsonb));
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_client_supplier_documents(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_client_supplier_documents(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_client_supplier_documents(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"Les documents déposés par les fournisseurs d''un client (factures définitives, colisage, fiches)","resolve":{"p_client_user_id":"client"}}';


-- ############################################################################
-- SECTION 5 — Les délais observés (étape 8)
-- ← supabase/migrations/20260930150000_logistics_observed_transit.sql
-- agrégats de transit par ligne (médiane, quartiles, retard) calculés sur
-- cargo_shipments / cargo_events / air_shipments ; rien de nominatif, d'où
-- l'EXECUTE accordé à anon.
-- ############################################################################

-- ============================================================================
-- Douane, étape 8 — les délais OBSERVÉS par ligne (docs/douane/00-plan.md).
--
-- L'Atlas (src/lib/logistics/atlas.ts) affiche pour chaque trajet une
-- fourchette de marché ; quand nos propres expéditions ont fait la même ligne,
-- leur délai réel la remplace. Cette fonction le calcule :
--
--   mer  : départ réel (etd_actual, sinon DEPA/LOAD constaté au port de départ)
--          → arrivée réelle (ARRI/DISC constaté au port d'arrivée, sinon
--          l'ETA armateur d'une boîte arrivée) ; ligne = POL>POD (UN/LOCODE) ;
--   air  : departed_at → arrived_at ; ligne = code IATA d'origine > d'arrivée
--          (« Guangzhou (CAN) » > « Douala (DLA) »).
--
-- Seulement des agrégats (médiane, quartiles, part en retard sur la promesse),
-- sur 18 mois, et seulement pour une ligne d'au moins 3 expéditions : aucun
-- conteneur, aucun client, aucune date n'en sort. D'où l'ouverture à `anon` :
-- l'Atlas est public, comme le simulateur.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.logistics_observed_transit()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH sea AS (
    SELECT
      'sea'::text AS mode,
      upper(s.pol_unlocode) || '>' || upper(s.pod_unlocode) AS lane,
      COALESCE(s.etd_actual, dep.at) AS left_at,
      COALESCE(arr.at, s.eta_carrier) AS arrived_at,
      CASE WHEN s.etd_promised IS NOT NULL AND s.eta_promised IS NOT NULL THEN s.eta_promised - s.etd_promised END AS promised_days,
      s.eta_promised AS promised_on
    FROM public.cargo_shipments s
    LEFT JOIN LATERAL (
      SELECT min(e.event_time) AS at FROM public.cargo_events e
      WHERE e.shipment_id = s.id AND e.classifier = 'ACT' AND e.event_code IN ('DEPA', 'LOAD') AND upper(e.unlocode) = upper(s.pol_unlocode)
    ) dep ON true
    LEFT JOIN LATERAL (
      SELECT min(e.event_time) AS at FROM public.cargo_events e
      WHERE e.shipment_id = s.id AND e.classifier = 'ACT' AND e.event_code IN ('ARRI', 'DISC') AND upper(e.unlocode) = upper(s.pod_unlocode)
    ) arr ON true
    WHERE s.status IN ('ARRIVED', 'DELIVERED')
      AND s.pol_unlocode ~* '^[A-Z]{2}[A-Z0-9]{3}$' AND s.pod_unlocode ~* '^[A-Z]{2}[A-Z0-9]{3}$'
  ),
  air AS (
    SELECT
      'air'::text AS mode,
      substring(a.origin FROM '\(([A-Z]{3})\)') || '>' || substring(a.destination FROM '\(([A-Z]{3})\)') AS lane,
      a.departed_at AS left_at,
      a.arrived_at AS arrived_at,
      CASE WHEN a.etd IS NOT NULL AND a.eta IS NOT NULL THEN a.eta - a.etd END AS promised_days,
      a.eta AS promised_on
    FROM public.air_shipments a
    WHERE a.status IN ('ARRIVED', 'DELIVERED')
  ),
  trips AS (
    SELECT mode, lane, promised_days, promised_on, arrived_at,
           extract(epoch FROM arrived_at - left_at) / 86400.0 AS days
    FROM (SELECT * FROM sea UNION ALL SELECT * FROM air) t
    WHERE lane IS NOT NULL AND left_at IS NOT NULL AND arrived_at IS NOT NULL
      AND left_at >= now() - interval '18 months'
  ),
  -- Un délai absurde (saisie inversée, ETA jamais mise à jour) ne compte pas.
  clean AS (
    SELECT * FROM trips
    WHERE (mode = 'sea' AND days BETWEEN 10 AND 120) OR (mode = 'air' AND days BETWEEN 0.5 AND 30)
  ),
  -- (numeric : arrondi « au plus proche, 0,5 vers le haut », pas l'arrondi bancaire des flottants.)
  lanes AS (
    SELECT
      mode, lane, count(*) AS n,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::numeric)::int AS median,
      round(percentile_cont(0.25) WITHIN GROUP (ORDER BY days)::numeric)::int AS p25,
      round(percentile_cont(0.75) WITHIN GROUP (ORDER BY days)::numeric)::int AS p75,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY promised_days)::numeric)::int AS promised_median,
      round(avg(CASE WHEN promised_on IS NULL THEN NULL WHEN arrived_at::date > promised_on + 2 THEN 1.0 ELSE 0.0 END), 2) AS late_share
    FROM clean
    GROUP BY mode, lane
    HAVING count(*) >= 3
  )
  SELECT jsonb_build_object(
    'window_months', 18,
    'min_count', 3,
    'lanes', COALESCE(jsonb_agg(jsonb_build_object(
      'mode', mode, 'lane', lane, 'n', n, 'median', greatest(median, 1), 'p25', greatest(p25, 1), 'p75', greatest(p75, 1),
      'promised_median', promised_median, 'late_share', late_share
    ) ORDER BY mode, n DESC, lane), '[]'::jsonb)
  )
  FROM lanes;
$fn$;

REVOKE ALL ON FUNCTION public.logistics_observed_transit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.logistics_observed_transit() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.logistics_observed_transit() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Délais de transit réellement observés par ligne (port ou aéroport de départ > d''arrivée) sur 18 mois : médiane, quartiles, délai promis, part en retard"}';


-- ============================================================================
-- FIN. Vérification rapide après passage (attendu : 1, 7, 1, 8, true, true) :
--   SELECT (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
--            WHERE t.typname = 'app_role' AND e.enumlabel = 'customs_broker') AS customs_broker,
--          (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN
--            ('customs_brokers','customs_classifications','customs_classification_messages','customs_audits',
--             'customs_notices','customs_supplier_invites','customs_supplier_documents')) AS tables,
--          (SELECT count(*) FROM storage.buckets WHERE id = 'customs-documents') AS bucket,
--          (SELECT count(*) FROM public.customs_notices) AS notices,
--          public.admin_has_permission('00000000-0000-0000-0000-000000000000', 'canViewCustoms') = false AS perm_ok,
--          to_regprocedure('public.logistics_observed_transit()') IS NOT NULL AS observed_transit;
-- ============================================================================

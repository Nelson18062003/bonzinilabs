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
          CASE p_decision
            WHEN 'approved' THEN 'Code validé : ' || v_code || COALESCE(E'\n' || v_note, '')
            WHEN 'changed' THEN 'Code retenu : ' || v_code || E'\n' || v_note
            ELSE v_note END,
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

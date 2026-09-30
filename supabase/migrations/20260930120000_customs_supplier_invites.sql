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

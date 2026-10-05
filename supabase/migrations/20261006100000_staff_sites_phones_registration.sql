-- ============================================================================
-- Équipe : sites et téléphones · Clients : « Enregistré par » et origine
-- posée par la réception de Guangzhou
--
-- Le 06/10/2026, après la mise en service de « Mes équipes » :
--
--   1. SITES DU PERSONNEL — chaque collaborateur a un site (Guangzhou ·
--      bureau, Guangzhou · entrepôt, Douala, Yaoundé, ou un site ajouté par
--      le super admin). Deux personnes du même rôle dans deux villes se
--      distinguent : demain, des agents au Cameroun.
--   2. TÉLÉPHONES DU PERSONNEL — plusieurs numéros par collaborateur, au
--      format international (E.164, choisis avec leur pays et leur drapeau
--      à l'écran), le premier étant le principal (recopié dans
--      user_roles.phone, que lisent les écrans existants).
--   3. « ENREGISTRÉ PAR » — chaque client créé par un collaborateur garde,
--      pour toujours, qui l'a enregistré, son rôle et son site à ce moment-là.
--      Posé par un déclencheur à partir du JETON de la session (auth.uid()) :
--      on ne peut ni l'oublier, ni le choisir, ni le réécrire ensuite. Un
--      client inscrit lui-même (application, Google) n'en a pas. Les clients
--      créés avant ce jour par l'équipe sont rattrapés depuis le journal
--      d'audit (« create_client »), sans site (inconnu à l'époque).
--   4. ORIGINE POSÉE PAR LA RÉCEPTION — un client créé à la réception de
--      Guangzhou (colis arrivé dont le propriétaire n'existait pas) reçoit
--      d'office l'origine « Colis reçu · Entrepôt de Guangzhou (bateau) » ou
--      « … · Bureau de Guangzhou (avion) », selon le lieu de réception. Le
--      réceptionnaire ne la choisit pas. Le prospect d'un commercial reste
--      prioritaire (attribution automatique déjà posée à la création).
--      Ailleurs, l'origine est FACULTATIVE (vide = « Non renseignée »).
--
-- Idempotent. Suppose 20261005160000 (Mes équipes + commerciaux) passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Les sites
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Les sites de départ portent un code (stable) ; ceux ajoutés n'en ont pas.
  code        TEXT UNIQUE,
  label       TEXT NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 60),
  country_iso TEXT CHECK (country_iso IS NULL OR country_iso ~ '^[A-Z]{2}$'),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  position    INTEGER NOT NULL DEFAULT 100,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_sites_label_key ON public.staff_sites (lower(btrim(label)));
ALTER TABLE public.staff_sites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'staff_sites' AND policyname = 'Staff can read staff sites') THEN
    CREATE POLICY "Staff can read staff sites" ON public.staff_sites
      FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
END $$;
-- Aucune politique d'écriture : les sites s'ajoutent par team_create_site.

INSERT INTO public.staff_sites (code, label, country_iso, position) VALUES
  ('gz_office',    'Guangzhou · bureau',    'CN', 10),
  ('gz_warehouse', 'Guangzhou · entrepôt',  'CN', 20),
  ('douala',       'Douala',                'CM', 30),
  ('yaounde',      'Yaoundé',               'CM', 40)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.staff_sites(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les téléphones du personnel
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_phones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164  TEXT NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  country_iso TEXT CHECK (country_iso IS NULL OR country_iso ~ '^[A-Z]{2}$'),
  label       TEXT CHECK (label IS NULL OR length(label) <= 40),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_e164)
);
CREATE INDEX IF NOT EXISTS staff_phones_user_idx ON public.staff_phones (user_id, position);
ALTER TABLE public.staff_phones ENABLE ROW LEVEL SECURITY;
-- Aucune politique : lus par team_members (canManageUsers), écrits par team_set_member_profile.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. « Enregistré par » sur la fiche client
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registered_by      UUID;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registered_by_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registered_role    TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registered_site    TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registered_at      TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS clients_registered_by_idx ON public.clients (registered_by);

-- À l'insertion : la session (auth.uid()) est-elle un membre actif du
-- personnel, autre que le client lui-même ? Alors c'est lui qui enregistre :
-- son nom, son rôle et son site du moment. Les valeurs envoyées par
-- l'appelant sont toujours ignorées. À la mise à jour : rien ne change,
-- sauf dans la transaction de cette migration (rattrapage), qui pose
-- `bonzini.client_registration_write`.
CREATE OR REPLACE FUNCTION public.clients_stamp_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT;
  v_role TEXT;
  v_site TEXT;
  v_email TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF coalesce(current_setting('bonzini.client_registration_write', true), '') <> 'on' THEN
      NEW.registered_by      := OLD.registered_by;
      NEW.registered_by_name := OLD.registered_by_name;
      NEW.registered_role    := OLD.registered_role;
      NEW.registered_site    := OLD.registered_site;
      NEW.registered_at      := OLD.registered_at;
    END IF;
    RETURN NEW;
  END IF;

  NEW.registered_by      := NULL;
  NEW.registered_by_name := NULL;
  NEW.registered_role    := NULL;
  NEW.registered_site    := NULL;
  NEW.registered_at      := NULL;
  IF v_uid IS NULL OR v_uid = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT nullif(btrim(coalesce(ur.first_name, '') || ' ' || coalesce(ur.last_name, '')), ''),
         ur.role::text, s.label, ur.email
    INTO v_name, v_role, v_site, v_email
    FROM public.user_roles ur
    LEFT JOIN public.staff_sites s ON s.id = ur.site_id
   WHERE ur.user_id = v_uid
     AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
   LIMIT 1;
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.registered_by      := v_uid;
  NEW.registered_by_name := coalesce(v_name, v_email);
  NEW.registered_role    := v_role;
  NEW.registered_site    := v_site;
  NEW.registered_at      := now();
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS clients_stamp_registration ON public.clients;
CREATE TRIGGER clients_stamp_registration
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_stamp_registration();

-- Rattrapage : les clients créés par l'équipe avant aujourd'hui (journal
-- « create_client » d'admin_create_client). Le site n'était pas connu.
DO $$
BEGIN
  PERFORM set_config('bonzini.client_registration_write', 'on', true);
  UPDATE public.clients c
     SET registered_by      = l.admin_user_id,
         registered_by_name = coalesce(nullif(btrim(coalesce(ur.first_name, '') || ' ' || coalesce(ur.last_name, '')), ''), ur.email),
         registered_role    = ur.role::text,
         registered_at      = l.created_at
    FROM (SELECT DISTINCT ON (target_id) target_id, admin_user_id, created_at
            FROM public.admin_audit_logs
           WHERE action_type = 'create_client' AND admin_user_id IS NOT NULL AND target_id IS NOT NULL
           ORDER BY target_id, created_at) l
    LEFT JOIN public.user_roles ur ON ur.user_id = l.admin_user_id
   WHERE c.user_id = l.target_id
     AND c.registered_by IS NULL
     AND l.admin_user_id <> c.user_id;
  PERFORM set_config('bonzini.client_registration_write', '', true);
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. L'origine « Colis reçu à Guangzhou », posée par la réception
-- ─────────────────────────────────────────────────────────────────────────
-- Un nouveau type d'origine, réservé au système (jamais choisi à la main).
ALTER TABLE public.client_sources ADD COLUMN IF NOT EXISTS system_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS client_sources_system_code_key ON public.client_sources (system_code) WHERE system_code IS NOT NULL;
ALTER TABLE public.client_sources DROP CONSTRAINT IF EXISTS client_sources_kind_check;
ALTER TABLE public.client_sources ADD CONSTRAINT client_sources_kind_check
  CHECK (kind IN ('commercial', 'referral', 'social', 'online', 'event', 'other', 'unknown', 'parcel'));

INSERT INTO public.client_sources (kind, label, is_system, system_code) VALUES
  ('parcel', 'Entrepôt de Guangzhou (bateau)', true, 'parcel_warehouse'),
  ('parcel', 'Bureau de Guangzhou (avion)',    true, 'parcel_office')
ON CONFLICT (kind, lower(btrim(label))) DO NOTHING;
UPDATE public.client_sources SET system_code = 'parcel_warehouse' WHERE kind = 'parcel' AND lower(btrim(label)) = lower('Entrepôt de Guangzhou (bateau)') AND system_code IS NULL;
UPDATE public.client_sources SET system_code = 'parcel_office'    WHERE kind = 'parcel' AND lower(btrim(label)) = lower('Bureau de Guangzhou (avion)')    AND system_code IS NULL;

-- La réception vient de créer ce client (parce que le propriétaire d'un colis
-- n'existait pas) : l'origine se pose d'office selon le lieu de réception.
-- Seulement pour un client qu'elle a elle-même enregistré, et seulement s'il
-- n'a pas déjà une origine (le prospect d'un commercial reste prioritaire).
CREATE OR REPLACE FUNCTION public.reception_set_client_origin(p_user_id UUID, p_location TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_client public.clients;
  v_src public.client_sources;
  v_code TEXT := CASE p_location WHEN 'warehouse' THEN 'parcel_warehouse' WHEN 'office' THEN 'parcel_office' END;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canRegisterClients') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lieu de réception inconnu');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF v_client.registered_by IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le collaborateur qui a enregistré ce client pose son origine ainsi');
  END IF;
  IF v_client.source_id IS NOT NULL THEN
    SELECT * INTO v_src FROM public.client_sources WHERE id = v_client.source_id;
    RETURN jsonb_build_object('success', true, 'kept', true, 'source_id', v_src.id, 'label', v_src.label, 'kind', v_src.kind);
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE system_code = v_code;
  IF NOT FOUND OR NOT v_src.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Origine « colis reçu » introuvable');
  END IF;

  PERFORM set_config('bonzini.client_source_write', 'on', true);
  UPDATE public.clients
     SET source_id = v_src.id, source_set_at = now(), source_set_by = v_uid
   WHERE user_id = p_user_id;
  PERFORM set_config('bonzini.client_source_write', '', true);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_client_source', 'client', p_user_id,
          jsonb_build_object('from', NULL, 'to', v_src.id, 'auto', 'reception', 'location', p_location));

  RETURN jsonb_build_object('success', true, 'kept', false, 'source_id', v_src.id, 'label', v_src.label, 'kind', v_src.kind);
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Mes équipes : les sites, les numéros, la liste
-- ─────────────────────────────────────────────────────────────────────────
-- Les sites, avec le nombre de membres actifs de chacun.
CREATE OR REPLACE FUNCTION public.team_sites()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'sites', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', s.id, 'code', s.code, 'label', s.label, 'country_iso', s.country_iso, 'is_active', s.is_active,
             'members', (SELECT count(*) FROM public.user_roles ur WHERE ur.site_id = s.id AND (ur.is_disabled = false OR ur.is_disabled IS NULL)))
           ORDER BY s.position, lower(s.label))
      FROM public.staff_sites s), '[]'::jsonb));
END;
$fn$;

-- Ajouter un site (« Bafoussam », « Lagos »…).
CREATE OR REPLACE FUNCTION public.team_create_site(p_label TEXT, p_country_iso TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_label TEXT := btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g'));
  v_iso TEXT := nullif(upper(btrim(coalesce(p_country_iso, ''))), '');
  v_id UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_label) < 2 OR length(v_label) > 60 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom du site fait de 2 à 60 caractères');
  END IF;
  IF v_iso IS NOT NULL AND v_iso !~ '^[A-Z]{2}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pays inconnu');
  END IF;
  SELECT id INTO v_id FROM public.staff_sites WHERE lower(btrim(label)) = lower(v_label);
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce site existe déjà', 'id', v_id);
  END IF;
  INSERT INTO public.staff_sites (label, country_iso, created_by, position)
  VALUES (v_label, v_iso, v_uid, 100)
  RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'create_staff_site', 'staff_site', v_id, jsonb_build_object('label', v_label, 'country_iso', v_iso));
  RETURN jsonb_build_object('success', true, 'id', v_id, 'label', v_label);
END;
$fn$;

-- Les numéros et le site d'un membre, en une fois. `p_phones` : la liste
-- COMPLÈTE, principal d'abord — [{phone_e164, country_iso, label}] ; NULL =
-- inchangée. `p_site_id` : NULL = inchangé ; `p_clear_site` le retire.
CREATE OR REPLACE FUNCTION public.team_set_member_profile(
  p_user_id UUID,
  p_phones JSONB DEFAULT NULL,
  p_site_id UUID DEFAULT NULL,
  p_clear_site BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.user_roles;
  v_item JSONB;
  v_e164 TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
  v_pos INTEGER := 0;
  v_primary TEXT;
  v_site public.staff_sites;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.user_roles WHERE user_id = p_user_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membre introuvable');
  END IF;

  IF p_site_id IS NOT NULL THEN
    SELECT * INTO v_site FROM public.staff_sites WHERE id = p_site_id;
    IF NOT FOUND OR NOT v_site.is_active THEN
      RETURN jsonb_build_object('success', false, 'error', 'Site introuvable');
    END IF;
  END IF;

  IF p_phones IS NOT NULL THEN
    IF jsonb_typeof(p_phones) <> 'array' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Liste de numéros invalide');
    END IF;
    IF jsonb_array_length(p_phones) > 10 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Dix numéros au plus');
    END IF;
    -- Tout est vérifié AVANT d'écrire : un numéro faux ne laisse pas la liste à moitié remplacée.
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_phones) LOOP
      v_e164 := btrim(coalesce(v_item ->> 'phone_e164', ''));
      IF v_e164 !~ '^\+[1-9][0-9]{7,14}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : ' || coalesce(nullif(v_e164, ''), '(vide)') || ' — format international attendu');
      END IF;
      IF v_e164 = ANY(v_seen) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Le numéro ' || v_e164 || ' est en double');
      END IF;
      IF length(coalesce(v_item ->> 'label', '')) > 40 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Libellé trop long');
      END IF;
      v_seen := v_seen || v_e164;
    END LOOP;

    DELETE FROM public.staff_phones WHERE user_id = p_user_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_phones) LOOP
      v_e164 := btrim(v_item ->> 'phone_e164');
      INSERT INTO public.staff_phones (user_id, phone_e164, country_iso, label, position)
      VALUES (p_user_id, v_e164,
              nullif(upper(btrim(coalesce(v_item ->> 'country_iso', ''))), ''),
              nullif(btrim(coalesce(v_item ->> 'label', '')), ''),
              v_pos);
      IF v_pos = 0 THEN v_primary := v_e164; END IF;
      v_pos := v_pos + 1;
    END LOOP;
  END IF;

  UPDATE public.user_roles
     SET phone   = CASE WHEN p_phones IS NULL THEN phone ELSE v_primary END,
         site_id = CASE WHEN p_clear_site THEN NULL WHEN p_site_id IS NOT NULL THEN p_site_id ELSE site_id END
   WHERE user_id = p_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'update_admin_profile', 'admin_user', p_user_id, jsonb_build_object(
    'phones', CASE WHEN p_phones IS NULL THEN NULL ELSE to_jsonb(v_seen) END,
    'site_before', v_row.site_id,
    'site_after', CASE WHEN p_clear_site THEN NULL WHEN p_site_id IS NOT NULL THEN p_site_id ELSE v_row.site_id END));

  RETURN jsonb_build_object('success', true, 'phone', CASE WHEN p_phones IS NULL THEN v_row.phone ELSE v_primary END);
END;
$fn$;

-- La liste de l'équipe : en plus, tous les numéros (principal d'abord) et le site.
CREATE OR REPLACE FUNCTION public.team_members()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', ur.user_id,
           'role', ur.role::text,
           'email', coalesce(ur.email, u.email),
           'first_name', ur.first_name,
           'last_name', ur.last_name,
           'phone', ur.phone,
           'phones', coalesce((
             SELECT jsonb_agg(jsonb_build_object('phone_e164', sp.phone_e164, 'country_iso', sp.country_iso, 'label', sp.label) ORDER BY sp.position)
               FROM public.staff_phones sp WHERE sp.user_id = ur.user_id), '[]'::jsonb),
           'site', CASE WHEN st.id IS NULL THEN NULL
                        ELSE jsonb_build_object('id', st.id, 'code', st.code, 'label', st.label, 'country_iso', st.country_iso) END,
           'avatar_url', ur.avatar_url,
           'is_disabled', coalesce(ur.is_disabled, false),
           'created_at', ur.created_at,
           'last_sign_in_at', u.last_sign_in_at,
           'source', CASE WHEN s.id IS NULL THEN NULL
                          ELSE jsonb_build_object('id', s.id, 'label', s.label, 'phone', s.phone, 'is_active', s.is_active) END
         ) ORDER BY coalesce(ur.is_disabled, false), lower(coalesce(ur.first_name, '')), lower(coalesce(ur.last_name, ''))), '[]'::jsonb)
    INTO v_rows
    FROM public.user_roles ur
    LEFT JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN public.staff_sites st ON st.id = ur.site_id
    LEFT JOIN public.client_sources s ON s.staff_user_id = ur.user_id;

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

-- Les numéros déjà saisis (un seul, texte libre, depuis le 05/10) deviennent
-- le premier numéro de la liste quand ils sont au format international.
INSERT INTO public.staff_phones (user_id, phone_e164, position)
SELECT ur.user_id, regexp_replace(ur.phone, '[^0-9+]', '', 'g'), 0
  FROM public.user_roles ur
 WHERE ur.phone IS NOT NULL
   AND regexp_replace(ur.phone, '[^0-9+]', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
   AND NOT EXISTS (SELECT 1 FROM public.staff_phones sp WHERE sp.user_id = ur.user_id)
ON CONFLICT (user_id, phone_e164) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Droits et étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.clients_stamp_registration() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.reception_set_client_origin(uuid, text)',
    'public.team_sites()',
    'public.team_create_site(text, text)',
    'public.team_set_member_profile(uuid, jsonb, uuid, boolean)',
    'public.team_members()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.clients_stamp_registration() IS
  '@mola:{"expose":false,"kind":"write","permission":"canRegisterClients","label":"Interne : noter qui (et quel site) a enregistré un client"}';
COMMENT ON FUNCTION public.reception_set_client_origin(uuid, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canRegisterClients","confirm":false,"danger":false,"label":"Réception : poser l''origine « colis reçu à Guangzhou » d''un client qu''on vient d''enregistrer"}';
COMMENT ON FUNCTION public.team_sites() IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Mes équipes : les sites du personnel"}';
COMMENT ON FUNCTION public.team_create_site(text, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Mes équipes : ajouter un site"}';
COMMENT ON FUNCTION public.team_set_member_profile(uuid, jsonb, uuid, boolean) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Mes équipes : numéros et site d''un membre"}';
COMMENT ON FUNCTION public.team_members() IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Mes équipes : la liste du personnel (numéros, site, fiche commerciale)"}';

NOTIFY pgrst, 'reload schema';

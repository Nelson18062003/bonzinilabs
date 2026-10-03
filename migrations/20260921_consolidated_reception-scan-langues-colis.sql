-- ============================================================================
-- Réception — lot du 21/09/2026 : scan direct, correction d'un colis, création
-- d'admin pour tout rôle — migration CONSOLIDÉE (Supabase / PostgreSQL)
-- Générée le 2026-09-21 depuis la branche claude/dazzling-keller-h53f6l
--
-- CE FICHIER SUFFIT pour ce lot. Il concatène, dans l'ordre d'exécution :
--   1. supabase/migrations/20260921090000_admin_create_admin_any_role.sql
--   2. supabase/migrations/20260921100000_reception_scan_by_code.sql
--   3. supabase/migrations/20260921110000_reception_update_parcel.sql
--   4. supabase/migrations/20260921120000_reception_clients.sql
-- Il suppose que migrations/20260920_consolidated_reception-colis.sql (rôle
-- receptionist, tables parcel_deposits / parcels, RPC réception) est déjà passé.
-- Ouvre le SQL Editor du projet Bonzini « fmhsohrgbznqmcvqktjw », colle-le en
-- entier, exécute UNE fois. Idempotent : CREATE OR REPLACE partout. Repasser le
-- fichier est sans effet. Si les trois fichiers unitaires ont déjà été passés,
-- inutile de repasser celui-ci.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECTION : 20260921090000_admin_create_admin_any_role.sql                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ============================================================================
-- admin_create_admin : accepter tout rôle de l'énumération app_role
--
-- Symptôme : « Rôle invalide. Valeurs acceptées: super_admin, ops, support,
-- customer_success, cash_agent » à la création d'un réceptionnaire (et d'un
-- trésorier). La RPC portait une liste de rôles codée en dur, figée avant
-- l'ajout de `treasurer` puis de `receptionist` à l'énumération.
--
-- Correctif : la liste des rôles valides se lit dans l'énumération elle-même
-- (enum_range) — ajouter un rôle à `app_role` suffit désormais. Au passage, un
-- super admin désactivé ne peut plus créer d'administrateur (règle projet :
-- toute lecture de rôle filtre is_disabled). Le corps est celui de
-- 20260607000000 (user_roles, sans profiles). Idempotent.
-- ============================================================================

create or replace function public.admin_create_admin(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text
) returns jsonb
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  new_user_id uuid;
  encrypted_pw text;
  temp_password text;
  -- Tous les rôles de l'énumération, dans l'ordre de déclaration.
  valid_roles text[] := (select array_agg(e::text) from unnest(enum_range(null::public.app_role)) as e);
  caller_role text;
  existing_user_id uuid;
  existing_client_code text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin'
    and (is_disabled = false or is_disabled is null);

  if caller_role is null then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut créer des administrateurs');
  end if;

  if p_email is null or trim(p_email) = '' then
    return jsonb_build_object('success', false, 'error', 'L''email est requis');
  end if;
  if p_first_name is null or trim(p_first_name) = '' then
    return jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  end if;
  if p_last_name is null or trim(p_last_name) = '' then
    return jsonb_build_object('success', false, 'error', 'Le nom est requis');
  end if;
  if p_role is null or trim(p_role) = '' then
    return jsonb_build_object('success', false, 'error', 'Le rôle est requis');
  end if;
  if not p_role = any(valid_roles) then
    return jsonb_build_object('success', false, 'error', 'Rôle invalide. Valeurs acceptées: ' || array_to_string(valid_roles, ', '));
  end if;

  -- Un email = un seul compte auth. Dire À QUI il est déjà : un client (le
  -- même Gmail sert souvent à tester l'app client) ou un administrateur.
  select u.id into existing_user_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if existing_user_id is not null then
    select c.customer_code into existing_client_code from public.clients c where c.user_id = existing_user_id;
    if existing_client_code is not null then
      return jsonb_build_object('success', false, 'error',
        'Cet email est déjà celui d''un compte CLIENT (' || existing_client_code || '). Un administrateur doit avoir sa propre adresse : utilisez-en une autre.');
    end if;
    if exists (select 1 from public.user_roles r where r.user_id = existing_user_id) then
      return jsonb_build_object('success', false, 'error', 'Cet email est déjà celui d''un administrateur');
    end if;
    return jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  end if;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));
  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    is_sso_user, confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated',
    lower(trim(p_email)), encrypted_pw, now(),
    jsonb_build_object('first_name', trim(p_first_name), 'last_name', trim(p_last_name)),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    now(), now(), false, '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text, 'email',
    jsonb_build_object('sub', new_user_id::text, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );

  insert into public.user_roles (user_id, role, email, is_disabled, first_name, last_name)
  values (new_user_id, p_role::public.app_role, lower(trim(p_email)), false, trim(p_first_name), trim(p_last_name));

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    auth.uid(), 'create_admin', 'admin_user', new_user_id,
    jsonb_build_object(
      'description', 'Création de l''admin ' || trim(p_first_name) || ' ' || trim(p_last_name) || ' (' || trim(p_email) || ')',
      'role', p_role, 'email', lower(trim(p_email))
    )
  );

  return jsonb_build_object(
    'success', true, 'userId', new_user_id, 'email', lower(trim(p_email)),
    'tempPassword', temp_password,
    'message', 'Admin ' || trim(p_first_name) || ' ' || trim(p_last_name) || ' créé avec succès'
  );

exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Un compte avec ces informations existe déjà');
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

comment on function public.admin_create_admin(text, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Créer un administrateur"}';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECTION : 20260921100000_reception_scan_by_code.sql                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ============================================================================
-- Réception : le scan d'un code client va DIRECTEMENT au client
--
-- Symptôme : scanner le QR d'un client affichait une liste à choisir. La
-- recherche générique (reception_search_clients) mélangeait le code avec les
-- numéros de téléphone qui contiennent les mêmes chiffres, et l'écran
-- n'allait tout seul au client que si la liste n'avait qu'une ligne.
--
-- 1. reception_client_by_code : un code → une fiche, ou « code inconnu ».
--    C'est ce que la caméra appelle. Le code client est unique.
-- 2. reception_search_clients : quand ce qu'on tape EST un code, la réponse
--    est exacte (une ligne au plus), sans retomber sur téléphone ni nom.
-- Idempotent.
-- ============================================================================

-- 1. Une fiche par code, pour la caméra.
CREATE OR REPLACE FUNCTION public.reception_client_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid  UUID := auth.uid();
  v_q    TEXT := TRIM(COALESCE(p_code, ''));
  v_code TEXT;
  v_user UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  -- « BZ-482913 », « bz 482913 », « https://bonzinilabs.com/c/BZ-482913 », « 482913 »
  v_code := (SELECT 'BZ-' || m[1] FROM regexp_matches(upper(v_q), 'BZ[^0-9]{0,3}([1-9][0-9]{5})') m LIMIT 1);
  IF v_code IS NULL AND regexp_replace(v_q, '[^0-9]', '', 'g') ~ '^[1-9][0-9]{5}$' THEN
    v_code := 'BZ-' || regexp_replace(v_q, '[^0-9]', '', 'g');
  END IF;
  IF v_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_code', 'code', v_q);
  END IF;
  SELECT c.user_id INTO v_user FROM public.clients c WHERE c.customer_code = v_code LIMIT 1;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_code', 'code', v_code);
  END IF;
  RETURN jsonb_build_object('success', true, 'client', public.reception_client_card(v_user));
END;
$fn$;
COMMENT ON FUNCTION public.reception_client_by_code(TEXT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Trouver un client par son code BZ (scan à la réception)","resolve":{"p_code":"client"}}';

-- 2. La recherche : un code tapé donne une réponse exacte.
CREATE OR REPLACE FUNCTION public.reception_search_clients(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    UUID := auth.uid();
  v_q      TEXT := TRIM(COALESCE(p_query, ''));
  v_digits TEXT := regexp_replace(v_q, '[^0-9]', '', 'g');
  v_code   TEXT;
  v_rows   JSONB;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_q) < 2 THEN
    RETURN jsonb_build_object('success', true, 'clients', '[]'::jsonb);
  END IF;
  v_code := (SELECT 'BZ-' || m[1] FROM regexp_matches(upper(v_q), 'BZ[^0-9]{0,3}([1-9][0-9]{5})') m LIMIT 1);
  IF v_code IS NULL AND v_digits ~ '^[1-9][0-9]{5}$' THEN v_code := 'BZ-' || v_digits; END IF;

  IF v_code IS NOT NULL THEN
    -- Un code est unique : la réponse l'est aussi. Pas de téléphone, pas de nom.
    SELECT COALESCE(jsonb_agg(public.reception_client_card(c.user_id)), '[]'::jsonb) INTO v_rows
    FROM (SELECT c.user_id FROM public.clients c WHERE c.customer_code = v_code LIMIT 1) c;
    RETURN jsonb_build_object('success', true, 'clients', v_rows);
  END IF;

  SELECT COALESCE(jsonb_agg(public.reception_client_card(c.user_id)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.user_id
    FROM public.clients c
    WHERE (length(v_digits) >= 6 AND regexp_replace(COALESCE(c.phone_e164, c.phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_digits || '%')
       OR (length(v_digits) < 6 AND (
             (c.first_name || ' ' || c.last_name) ILIKE '%' || v_q || '%'
          OR (c.last_name || ' ' || c.first_name) ILIKE '%' || v_q || '%'
          OR COALESCE(c.company_name, '') ILIKE '%' || v_q || '%'))
    ORDER BY c.last_name, c.first_name
    LIMIT 8
  ) c;
  RETURN jsonb_build_object('success', true, 'clients', v_rows);
END;
$fn$;
COMMENT ON FUNCTION public.reception_search_clients(TEXT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Chercher un client pour la réception d''un colis (identité seulement)"}';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECTION : 20260921110000_reception_update_parcel.sql                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ============================================================================
-- Réception : corriger ou compléter un colis
--
-- Un colis « incomplet » (sans poids, sans dimensions, sans photo) restait
-- incomplet pour toujours : on ne pouvait que l'ajouter ou le retirer, et
-- seulement tant que le dépôt était ouvert. Or la facture a besoin du poids
-- et du m³, et on pèse parfois après coup.
--
-- reception_update_parcel : le réceptionnaire qui a reçu le dépôt (ou le
-- cargo) modifie un colis, dépôt ouvert OU fermé, tant que le colis n'est
-- pas dans une boîte. Si le dépôt est fermé, ses totaux sont recalculés et
-- la correction est journalisée. Idempotent.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reception_update_parcel(
  p_parcel_id UUID,
  p_kind TEXT DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_courier_waybill TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_par public.parcels;
  v_count INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  -- Qui : l'auteur du dépôt, ou le cargo. Sur quelle ligne : un colis pas encore dans une boîte.
  IF NOT (v_dep.received_by = v_uid OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne vous appartient pas');
  END IF;
  IF v_dep.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est annulé');
  END IF;
  IF v_par.shipment_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis est déjà dans une boîte : il ne se modifie plus ici');
  END IF;
  IF p_kind IS NOT NULL AND p_kind NOT IN ('carton','bag','bale','roll','pallet','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de colis inconnu');
  END IF;
  IF COALESCE(p_weight_kg, 0) < 0 OR COALESCE(p_length_cm, 0) < 0 OR COALESCE(p_width_cm, 0) < 0 OR COALESCE(p_height_cm, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poids et dimensions doivent être positifs');
  END IF;

  UPDATE public.parcels
     SET kind            = COALESCE(p_kind, kind),
         weight_kg       = p_weight_kg,
         length_cm       = p_length_cm,
         width_cm        = p_width_cm,
         height_cm       = p_height_cm,
         description     = NULLIF(TRIM(COALESCE(p_description, '')), ''),
         courier_waybill = NULLIF(TRIM(COALESCE(p_courier_waybill, '')), ''),
         photo_path      = COALESCE(NULLIF(TRIM(p_photo_path), ''), photo_path),
         updated_at      = now()
   WHERE id = v_par.id;

  IF v_dep.status = 'closed' THEN
    -- Les totaux figés à la fermeture suivent la correction, et on garde une trace.
    SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_count, v_kg, v_cbm
    FROM public.parcels WHERE deposit_id = v_dep.id;
    UPDATE public.parcel_deposits
       SET parcel_count = v_count, total_weight_kg = v_kg, total_cbm = v_cbm, updated_at = now()
     WHERE id = v_dep.id;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'update_parcel', 'parcel_deposit', v_dep.id,
            jsonb_build_object('description', 'Colis ' || v_par.parcel_no || ' corrigé après fermeture', 'parcel_id', v_par.id,
                               'before', jsonb_build_object('weight_kg', v_par.weight_kg, 'cbm', v_par.cbm, 'description', v_par.description),
                               'after', jsonb_build_object('weight_kg', p_weight_kg, 'length_cm', p_length_cm, 'width_cm', p_width_cm, 'height_cm', p_height_cm, 'description', p_description)));
  ELSE
    UPDATE public.parcel_deposits SET updated_at = now() WHERE id = v_dep.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_update_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Corriger ou compléter un colis reçu (poids, dimensions, description, photo)"}';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ SECTION : 20260921120000_reception_clients.sql                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- ============================================================================
-- Réception : la liste des clients, et une fiche par client
--
-- Le réceptionnaire n'avait accès à un client qu'au moment d'un dépôt. Or il
-- doit pouvoir sortir l'étiquette colis d'un client à tout moment (la
-- réimprimer, l'envoyer au client par WhatsApp / WeChat) sans ouvrir de dépôt.
--
--   reception_recent_clients : les clients récents — ceux des derniers
--     dépôts (tous réceptionnaires) puis les derniers inscrits ; identité seule.
--   reception_client : la fiche d'identité d'un client par son user_id
--     (la même carte que la recherche), pour la fiche « /r/clients/:id ».
-- Guard : canReceiveParcels. Aucun solde, aucun paiement. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reception_recent_clients(p_limit INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT COALESCE(jsonb_agg(public.reception_client_card(x.user_id) ORDER BY x.last_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.user_id,
           GREATEST(c.created_at, COALESCE((SELECT max(d.opened_at) FROM public.parcel_deposits d WHERE d.client_user_id = c.user_id AND d.status <> 'cancelled'), c.created_at)) AS last_at
    FROM public.clients c
    WHERE c.customer_code IS NOT NULL
    ORDER BY last_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100)
  ) x;
  RETURN jsonb_build_object('success', true, 'clients', v_rows);
END;
$fn$;
COMMENT ON FUNCTION public.reception_recent_clients(INTEGER) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Les clients récents à la réception (identité seule)"}';

CREATE OR REPLACE FUNCTION public.reception_client(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_card JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  v_card := public.reception_client_card(p_user_id);
  RETURN jsonb_build_object('success', true, 'client', v_card);
END;
$fn$;
COMMENT ON FUNCTION public.reception_client(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"La fiche d''identité d''un client pour la réception (code, nom, téléphone)","resolve":{"p_user_id":"client"}}';

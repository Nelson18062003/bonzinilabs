-- ============================================================================
-- MIGRATION CONSOLIDÉE · 05/10/2026 · Mes équipes + commerciaux (rôle isolé,
-- prospects, objectifs du mois, tableaux de bord)
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- À passer APRÈS migrations/20261005_consolidated_remise-vols-arrivee.sql
-- (le SQL libre de Mola y est fermé aux réglages de session : sans lui, le
-- verrou bonzini.client_source_write qui protège l'attribution des clients
-- reste contournable).
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un ; rien n'est
--      modifié) : sources des clients (PR #224), création d'un accès,
--      téléphone normalisé des clients, tables lues par les tableaux de bord.
--   1. La migration, copie conforme de
--        ← supabase/migrations/20261005160000_teams_commercials.sql
--      · rôle « commercial » ; permissions canProspect (le commercial) et
--        canManageSales (le super admin) ;
--      · ISOLATION : is_admin() exclut le commercial (une soixantaine de
--        politiques et une quinzaine de RPC lui sont donc fermées d'un coup) ;
--        portefeuilles et journal d'audit ne testent plus « a une ligne
--        user_roles » à la main ;
--      · user_roles.phone ; client_sources.staff_user_id (un compte
--        commercial = une fiche) ;
--      · Mes équipes : team_members, team_create_member (compte + fiche en
--        une transaction), team_update_member (journalisée ; jamais son
--        propre rôle ; toujours un super admin actif), team_link_commercial ;
--      · prospects (le commercial lit les siens) et leurs RPC ; un compte
--        client créé avec le numéro d'un prospect est attribué à son
--        commercial, le prospect passe « devenu client » ;
--      · set_client_source : plus de « re-tamponnage », chaque changement
--        journalisé ;
--      · objectifs du mois ; commercial_dashboard, commercial_clients,
--        sales_overview (mois de Douala).
--      Aucune donnée existante modifiée ; deux tables créées (prospects,
--      commercial_objectives), deux colonnes ajoutées.
--
-- Idempotent : rejouable sans dégât. Vérifié sur Postgres 16 : ce fichier
-- passé deux fois dans UNE transaction, puis 105 contrôles (droits de chaque
-- rôle, isolation du commercial sur les portefeuilles / le journal / les
-- sources, comptes créés ou refusés AVANT création, homonymes, fiche reprise,
-- prospects et doublons entre commerciaux, attribution automatique, origine
-- non ré-écrite, rattachement manuel, objectifs, chiffres du mois (paiements
-- terminés, avion en kg, bateau en m³, dépôts annulés exclus), changement de
-- rôle, dernier super admin, accès désactivé, droits d'exécution, étiquettes
-- @mola valides).
--
-- Après passage :
--   npx supabase migration repair --status applied 20261005160000
--   /gen-types
--   npx supabase functions deploy admin-assistant   ← AVANT de créer le premier
--     commercial : la passerelle Mola déployée aujourd'hui donnerait à un rôle
--     inconnu les droits d'un chargé de clientèle.
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  r         RECORD;
BEGIN
  FOR r IN
    SELECT t.tbl, t.origin FROM (VALUES
      ('user_roles',       'comptes du personnel'),
      ('clients',          'clients'),
      ('client_sources',   'sources des clients, PR #224 (05/10)'),
      ('client_phones',    'numéros des clients, 01/09'),
      ('wallets',          'portefeuilles'),
      ('admin_audit_logs', 'journal d''audit'),
      ('deposits',         'dépôts'),
      ('payments',         'paiements'),
      ('parcels',          'réception, 20/09'),
      ('parcel_deposits',  'réception, 20/09')
    ) AS t(tbl, origin)
    WHERE to_regclass('public.' || t.tbl) IS NULL
  LOOP
    v_missing := array_append(v_missing, 'table public.' || r.tbl || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT c.tbl, c.col, c.origin
    FROM (VALUES
      ('clients',         'source_id',      'sources des clients, PR #224'),
      ('clients',         'source_set_at',  'sources des clients, PR #224'),
      ('clients',         'source_set_by',  'sources des clients, PR #224'),
      ('clients',         'phone_e164',     'SMS, 10/08'),
      ('client_phones',   'phone_e164',     'numéros des clients, 01/09'),
      ('parcel_deposits', 'location',       'réception, 20/09'),
      ('parcel_deposits', 'client_user_id', 'réception, 20/09'),
      ('parcels',         'weight_kg',      'réception, 20/09'),
      ('parcels',         'cbm',            'réception, 20/09'),
      ('deposits',        'confirmed_amount_xaf', 'dépôts'),
      ('payments',        'cash_paid_at',   'paiements cash')
    ) AS c(tbl, col, origin)
    WHERE to_regclass('public.' || c.tbl) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = to_regclass('public.' || c.tbl) AND a.attname = c.col
                        AND a.attnum > 0 AND NOT a.attisdropped)
  LOOP
    v_missing := array_append(v_missing, 'colonne ' || r.tbl || '.' || r.col || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT f.fn, f.origin FROM (VALUES
      ('admin_has_permission', 'droits par rôle, 31/08'),
      ('admin_create_admin',   'création d''un accès, 21/09'),
      ('guard_client_source',  'sources des clients, PR #224'),
      ('set_client_source',    'sources des clients, PR #224')
    ) AS f(fn, origin)
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f.fn AND pronamespace = 'public'::regnamespace)
  LOOP
    v_missing := array_append(v_missing, 'fonction ' || r.fn || ' (' || r.origin || ')');
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    v_missing := array_append(v_missing, 'type public.app_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_client_phone_sync_e164' AND tgrelid = to_regclass('public.clients')) THEN
    v_missing := array_append(v_missing, 'déclencheur on_client_phone_sync_e164 (SMS, 10/08)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration Mes équipes / commerciaux : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Copie conforme de 20261005160000_teams_commercials.sql
-- ############################################################################
-- ============================================================
-- MES ÉQUIPES + COMMERCIAUX
--
-- Le fondateur crée lui-même tous les accès (réceptionnaires, agents,
-- commerciaux…) depuis « Mes équipes ». Le commercial a son espace : ses
-- prospects, ses clients, ses chiffres (paiements, colis avion et bateau) et
-- ses objectifs du mois. Rien d'autre.
--
--  1. Rôle « commercial » et deux permissions : canProspect (le commercial),
--     canManageSales (le super admin : tous les commerciaux, les objectifs).
--  2. ISOLATION. is_admin() voulait dire « a une ligne user_roles » : il
--     ouvre une soixantaine de politiques (portefeuilles, dépôts, paiements,
--     bénéficiaires, colis, preuves…) et une quinzaine de RPC. Un commercial
--     y aurait tout lu. is_admin() exclut désormais le commercial ; trois
--     politiques qui testaient la ligne user_roles à la main (portefeuilles,
--     journal d'audit) passent par is_admin(). Le commercial n'a donc QUE
--     ses RPC, chacune limitée à SA source.
--  3. user_roles.phone ; client_sources.staff_user_id : un compte commercial
--     = une source (celle que la réception choisit à la création d'un client).
--  4. Équipe : team_members, team_create_member (compte + source en une
--     transaction), team_update_member (audité : plus d'UPDATE direct, plus
--     de super admin orphelin), team_link_commercial.
--  5. Prospects : table (lecture : le commercial voit les siens), RPC de
--     création, modification, statut, réattribution, rattachement à un
--     client ; recherche par numéro pour pré-remplir l'origine d'un nouveau
--     client. Un compte client créé avec le numéro d'un prospect est
--     attribué à son commercial et le prospect passe « devenu client ».
--  6. set_client_source : même source = rien à faire (plus de « re-tamponnage »
--     de la date et de l'auteur) ; chaque changement est journalisé.
--  7. Objectifs mensuels et tableaux de bord : commercial_dashboard,
--     commercial_clients, sales_overview (mois de Douala, bornes semi-ouvertes).
--
-- La valeur 'commercial' n'est utilisée qu'en texte (role::text) : pas
-- d'« unsafe use of new enum value » dans la transaction. Idempotente.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Rôle + permissions
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commercial';

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
        WHEN 'canProspect'          THEN ur.role::text IN ('commercial')
        WHEN 'canManageSales'       THEN ur.role::text IN ('super_admin')
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Isolation du commercial
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (is_disabled = false OR is_disabled IS NULL)
      AND role::text <> 'commercial'
  )
$$;

COMMENT ON FUNCTION public.is_admin(UUID) IS
  'Vrai pour un membre ACTIF du personnel qui travaille dans l''administration (tous les rôles sauf commercial). Ne teste aucune permission : les RPC sensibles passent par admin_has_permission. Le commercial n''a que ses propres RPC.';

-- Quelques fonctions anciennes appellent is_admin() sans argument ; aucune
-- migration du dépôt ne la crée. Si elle existe en base, elle suit la règle.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_admin' AND p.pronargs = 0
       AND p.prorettype = 'boolean'::regtype
  ) THEN
    EXECUTE 'CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean '
         || 'LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public '
         || 'AS ''SELECT public.is_admin(auth.uid())''';
  END IF;
END $do$;

-- Politiques qui testaient « a une ligne user_roles » à la main (sans
-- is_admin ni filtre is_disabled) : un commercial aurait lu tous les soldes
-- et tout le journal d'audit.
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
CREATE POLICY "Admins can view all wallets" ON public.wallets
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Colonnes
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS phone TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_phone_length') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_phone_length CHECK (phone IS NULL OR length(phone) <= 32);
  END IF;
END $$;

-- Un compte commercial = une source « commercial ». La source garde
-- l'historique des clients attribués même si le compte change ou disparaît.
ALTER TABLE public.client_sources ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_sources_staff_user_key
  ON public.client_sources (staff_user_id) WHERE staff_user_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_sources_staff_kind_check') THEN
    ALTER TABLE public.client_sources ADD CONSTRAINT client_sources_staff_kind_check
      CHECK (staff_user_id IS NULL OR kind = 'commercial');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Aides internes
-- ─────────────────────────────────────────────────────────────────────────
-- La source du commercial connecté (actif, rôle commercial), ou NULL.
CREATE OR REPLACE FUNCTION public.current_commercial_source_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
    FROM public.client_sources s
    JOIN public.user_roles ur ON ur.user_id = s.staff_user_id
   WHERE s.staff_user_id = auth.uid()
     AND ur.role::text = 'commercial'
     AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
   LIMIT 1
$$;

-- La source sur laquelle l'appelant peut travailler : la sienne (p_source_id
-- NULL ou égal), ou n'importe laquelle avec canManageSales. NULL = refus.
CREATE OR REPLACE FUNCTION public._sales_scope(p_source_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own UUID := public.current_commercial_source_id();
BEGIN
  IF p_source_id IS NULL THEN
    RETURN v_own;
  END IF;
  IF p_source_id = v_own OR public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN p_source_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Le message d'un refus de périmètre : un commercial pas encore relié à sa
-- source doit le savoir, les autres sont simplement refusés.
CREATE OR REPLACE FUNCTION public._sales_scope_error()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('success', false, 'error',
    CASE WHEN public.admin_has_permission(auth.uid(), 'canProspect') AND public.current_commercial_source_id() IS NULL
           THEN 'Votre compte n''est pas encore relié à votre fiche commercial. Demandez-le au responsable.'
         WHEN public.admin_has_permission(auth.uid(), 'canManageSales')
           THEN 'Choisissez le commercial'
         ELSE 'Accès non autorisé' END)
$$;

-- Un numéro au format international (+237…), espaces et tirets retirés ;
-- « 00 » vaut « + ». NULL si ce n'est pas un numéro valable.
CREATE OR REPLACE FUNCTION public._phone_e164(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN v ~ '^\+[1-9][0-9]{7,14}$' THEN v END
    FROM (SELECT regexp_replace(regexp_replace(btrim(coalesce(p_phone, '')), '[\s.()\-]', '', 'g'), '^00', '+') AS v) x
$$;

-- Mois de Douala → bornes [début, fin[.
CREATE OR REPLACE FUNCTION public._sales_month(p_month DATE)
RETURNS TABLE (month DATE, from_at TIMESTAMPTZ, to_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT m, m::timestamp AT TIME ZONE 'Africa/Douala', (m + interval '1 month')::timestamp AT TIME ZONE 'Africa/Douala'
    FROM (SELECT date_trunc('month', coalesce(p_month, (now() AT TIME ZONE 'Africa/Douala')::date))::date AS m) x
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. L'équipe
-- ─────────────────────────────────────────────────────────────────────────
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
    LEFT JOIN public.client_sources s ON s.staff_user_id = ur.user_id;

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

-- Crée le compte (admin_create_admin : super admin seul, mot de passe
-- provisoire) et, pour un commercial, le relie à sa source — existante
-- (choisie dans la liste : elle garde ses clients) ou nouvelle (à son nom).
-- Tout est vérifié AVANT de créer le compte ; une panne après annule tout.
CREATE OR REPLACE FUNCTION public.team_create_member(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role TEXT,
  p_phone TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := btrim(coalesce(p_role, ''));
  v_phone TEXT := nullif(btrim(coalesce(p_phone, '')), '');
  v_label TEXT := left(btrim(btrim(coalesce(p_first_name, '')) || ' ' || btrim(coalesce(p_last_name, ''))), 80);
  v_src public.client_sources;
  v_src_id UUID;
  v_res JSONB;
  v_new UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro trop long');
  END IF;

  IF v_role = 'commercial' THEN
    IF p_source_id IS NOT NULL THEN
      SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id FOR UPDATE;
      IF NOT FOUND OR v_src.kind <> 'commercial' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Choisissez une fiche de type « commercial »');
      END IF;
      IF NOT v_src.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée');
      END IF;
      IF v_src.staff_user_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cette fiche est déjà reliée à un autre compte');
      END IF;
    ELSIF length(v_label) >= 2 AND EXISTS (
      SELECT 1 FROM public.client_sources WHERE kind = 'commercial' AND lower(btrim(label)) = lower(v_label)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Une fiche commercial « ' || v_label || ' » existe déjà : choisissez-la dans la liste pour qu''il garde ses clients.');
    END IF;
  ELSIF p_source_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un commercial se relie à une fiche');
  END IF;

  v_res := public.admin_create_admin(p_email, p_first_name, p_last_name, v_role);
  IF NOT coalesce((v_res ->> 'success')::boolean, false) THEN
    RETURN v_res;
  END IF;
  v_new := (v_res ->> 'userId')::uuid;

  IF v_phone IS NOT NULL THEN
    UPDATE public.user_roles SET phone = v_phone WHERE user_id = v_new;
  END IF;

  IF v_role = 'commercial' THEN
    IF v_src.id IS NOT NULL THEN
      UPDATE public.client_sources
         SET staff_user_id = v_new, phone = coalesce(phone, v_phone), updated_at = now()
       WHERE id = v_src.id;
      v_src_id := v_src.id;
    ELSE
      INSERT INTO public.client_sources (kind, label, phone, created_by, staff_user_id)
      VALUES ('commercial', v_label, v_phone, v_uid, v_new)
      RETURNING id INTO v_src_id;
    END IF;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'link_commercial_source', 'admin_user', v_new,
            jsonb_build_object('source_id', v_src_id, 'existing', v_src.id IS NOT NULL));
  END IF;

  RETURN v_res || jsonb_build_object('sourceId', v_src_id);
END;
$$;

-- Nom, téléphone, rôle — audité. NULL = inchangé ; '' efface le téléphone.
-- Personne ne change son propre rôle ; il reste toujours un super admin actif.
-- Un commercial qui change de rôle est détaché de sa fiche (qui garde ses clients).
CREATE OR REPLACE FUNCTION public.team_update_member(
  p_user_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.user_roles;
  v_role TEXT := nullif(btrim(coalesce(p_role, '')), '');
  v_valid TEXT[] := (SELECT array_agg(e::text) FROM unnest(enum_range(NULL::public.app_role)) AS e);
  v_phone TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.user_roles WHERE user_id = p_user_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membre introuvable');
  END IF;
  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NOT NULL AND btrim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF length(btrim(coalesce(p_first_name, ''))) > 80 OR length(btrim(coalesce(p_last_name, ''))) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nom trop long');
  END IF;
  v_phone := CASE WHEN p_phone IS NULL THEN v_row.phone ELSE nullif(btrim(p_phone), '') END;
  IF v_phone IS NOT NULL AND length(v_phone) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro trop long');
  END IF;

  IF v_role IS NOT NULL AND v_role <> v_row.role::text THEN
    IF p_user_id = v_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas changer votre propre rôle');
    END IF;
    IF NOT v_role = ANY(v_valid) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Rôle inconnu');
    END IF;
    IF v_row.role::text = 'super_admin' AND NOT EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE role::text = 'super_admin' AND user_id <> p_user_id
         AND (is_disabled = false OR is_disabled IS NULL)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Il doit rester au moins un super admin actif');
    END IF;
  ELSE
    v_role := NULL;
  END IF;

  UPDATE public.user_roles
     SET first_name = coalesce(btrim(p_first_name), first_name),
         last_name  = coalesce(btrim(p_last_name), last_name),
         phone      = v_phone,
         role       = coalesce(v_role::public.app_role, role)
   WHERE user_id = p_user_id;

  IF v_role IS NOT NULL AND v_row.role::text = 'commercial' THEN
    UPDATE public.client_sources SET staff_user_id = NULL, updated_at = now() WHERE staff_user_id = p_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'update_admin', 'admin_user', p_user_id, jsonb_build_object(
    'before', jsonb_build_object('first_name', v_row.first_name, 'last_name', v_row.last_name, 'phone', v_row.phone, 'role', v_row.role::text),
    'after',  jsonb_build_object('first_name', coalesce(btrim(p_first_name), v_row.first_name),
                                 'last_name', coalesce(btrim(p_last_name), v_row.last_name),
                                 'phone', v_phone, 'role', coalesce(v_role, v_row.role::text))));

  RETURN jsonb_build_object('success', true, 'role', coalesce(v_role, v_row.role::text));
END;
$$;

-- Relier un compte commercial à sa fiche : une fiche existante (libre) ou
-- une nouvelle à son nom. L'ancienne fiche éventuelle est détachée (elle
-- garde ses clients et ses prospects).
CREATE OR REPLACE FUNCTION public.team_link_commercial(p_user_id UUID, p_source_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.user_roles;
  v_src public.client_sources;
  v_label TEXT;
  v_src_id UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.user_roles WHERE user_id = p_user_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_row.role::text <> 'commercial' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce membre n''est pas commercial');
  END IF;

  IF p_source_id IS NOT NULL THEN
    SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id FOR UPDATE;
    IF NOT FOUND OR v_src.kind <> 'commercial' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Choisissez une fiche de type « commercial »');
    END IF;
    IF NOT v_src.is_active THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée');
    END IF;
    IF v_src.staff_user_id IS NOT NULL AND v_src.staff_user_id <> p_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette fiche est déjà reliée à un autre compte');
    END IF;
    v_src_id := v_src.id;
  ELSE
    SELECT * INTO v_src FROM public.client_sources WHERE staff_user_id = p_user_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source_id', v_src.id, 'label', v_src.label);
    END IF;
    v_label := left(btrim(btrim(coalesce(v_row.first_name, '')) || ' ' || btrim(coalesce(v_row.last_name, ''))), 80);
    IF length(v_label) < 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Renseignez d''abord le nom du commercial');
    END IF;
    IF EXISTS (SELECT 1 FROM public.client_sources WHERE kind = 'commercial' AND lower(btrim(label)) = lower(v_label)) THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Une fiche commercial « ' || v_label || ' » existe déjà : choisissez-la dans la liste.');
    END IF;
  END IF;

  UPDATE public.client_sources SET staff_user_id = NULL, updated_at = now()
   WHERE staff_user_id = p_user_id AND id IS DISTINCT FROM v_src_id;

  IF v_src_id IS NOT NULL THEN
    UPDATE public.client_sources
       SET staff_user_id = p_user_id, phone = coalesce(phone, v_row.phone), updated_at = now()
     WHERE id = v_src_id
     RETURNING label INTO v_label;
  ELSE
    INSERT INTO public.client_sources (kind, label, phone, created_by, staff_user_id)
    VALUES ('commercial', v_label, v_row.phone, v_uid, p_user_id)
    RETURNING id INTO v_src_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'link_commercial_source', 'admin_user', p_user_id, jsonb_build_object('source_id', v_src_id));

  RETURN jsonb_build_object('success', true, 'source_id', v_src_id, 'label', v_label);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Prospects
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.client_sources(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name TEXT CHECK (last_name IS NULL OR length(last_name) <= 80),
  company TEXT CHECK (company IS NULL OR length(company) <= 120),
  phone TEXT NOT NULL CHECK (length(phone) <= 32),
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  city TEXT CHECK (city IS NULL OR length(city) <= 80),
  -- Ce qui l'intéresse : payer ses fournisseurs, le fret avion, le fret bateau.
  interests TEXT[] NOT NULL DEFAULT '{}' CHECK (interests <@ ARRAY['payments','air','sea']::text[]),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','interested','won','lost')),
  lost_reason TEXT CHECK (lost_reason IS NULL OR length(lost_reason) <= 300),
  next_action_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un numéro n'est suivi que par un commercial à la fois (tant que le
-- prospect est ouvert) ; un client n'est le « devenu client » que d'un prospect.
CREATE UNIQUE INDEX IF NOT EXISTS prospects_open_phone_key
  ON public.prospects (phone_e164) WHERE status IN ('new','contacted','interested');
CREATE UNIQUE INDEX IF NOT EXISTS prospects_converted_user_key
  ON public.prospects (converted_user_id) WHERE converted_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_source_status_idx ON public.prospects (source_id, status);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commercial reads own prospects" ON public.prospects;
CREATE POLICY "Commercial reads own prospects" ON public.prospects
  FOR SELECT TO authenticated
  USING (source_id = public.current_commercial_source_id()
         OR public.admin_has_permission(auth.uid(), 'canManageSales'));
-- Aucune politique d'écriture : tout passe par les RPC ci-dessous.

-- Le numéro est-il déjà celui d'un client ?
CREATE OR REPLACE FUNCTION public._phone_is_client(p_e164 TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE phone_e164 = p_e164)
      OR EXISTS (SELECT 1 FROM public.client_phones WHERE phone_e164 = p_e164)
$$;

CREATE OR REPLACE FUNCTION public.prospect_create(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_src UUID := public._sales_scope(p_source_id);
  v_e164 TEXT := public._phone_e164(p_phone);
  v_open public.prospects;
  v_id UUID;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_src AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée ou introuvable');
  END IF;
  IF length(btrim(coalesce(p_first_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
  END IF;
  IF public._phone_is_client(v_e164) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un client Bonzini');
  END IF;
  SELECT * INTO v_open FROM public.prospects
   WHERE phone_e164 = v_e164 AND status IN ('new','contacted','interested');
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE WHEN v_open.source_id = v_src THEN 'Ce prospect est déjà dans votre liste'
           ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
  END IF;

  INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes, next_action_at, created_by)
  VALUES (v_src, btrim(p_first_name), nullif(btrim(coalesce(p_last_name, '')), ''), nullif(btrim(coalesce(p_company, '')), ''),
          btrim(p_phone), v_e164, nullif(btrim(coalesce(p_city, '')), ''),
          coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}'),
          nullif(btrim(coalesce(p_notes, '')), ''), p_next_action_at, v_uid)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- NULL = inchangé ; '' efface un champ facultatif. p_clear_next_action
-- efface la date de relance (NULL ne peut pas le dire).
CREATE OR REPLACE FUNCTION public.prospect_update(
  p_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_clear_next_action BOOLEAN DEFAULT false,
  p_interests TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_e164 TEXT;
BEGIN
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  v_e164 := v_p.phone_e164;
  IF p_phone IS NOT NULL AND public._phone_e164(p_phone) IS DISTINCT FROM v_p.phone_e164 THEN
    IF v_p.status = 'won' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : son numéro ne change plus ici');
    END IF;
    v_e164 := public._phone_e164(p_phone);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
    END IF;
    IF public._phone_is_client(v_e164) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un client Bonzini');
    END IF;
  END IF;

  UPDATE public.prospects
     SET first_name = coalesce(btrim(p_first_name), first_name),
         last_name  = CASE WHEN p_last_name IS NULL THEN last_name ELSE nullif(btrim(p_last_name), '') END,
         company    = CASE WHEN p_company IS NULL THEN company ELSE nullif(btrim(p_company), '') END,
         city       = CASE WHEN p_city IS NULL THEN city ELSE nullif(btrim(p_city), '') END,
         notes      = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(btrim(p_notes), '') END,
         phone      = CASE WHEN p_phone IS NULL THEN phone ELSE btrim(p_phone) END,
         phone_e164 = v_e164,
         interests  = CASE WHEN p_interests IS NULL THEN interests
                           ELSE coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}') END,
         next_action_at = CASE WHEN p_clear_next_action THEN NULL ELSE coalesce(p_next_action_at, next_action_at) END,
         updated_at = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- « Devenu client » ne se pose pas à la main : il vient de la création du
-- compte (même numéro) ou du rattachement par le responsable.
CREATE OR REPLACE FUNCTION public.prospect_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('new','contacted','interested','lost') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut inconnu');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà devenu client');
  END IF;
  IF p_status = 'lost' AND (v_reason IS NULL OR length(v_reason) < 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dites en quelques mots pourquoi il est perdu');
  END IF;
  IF v_p.status = 'lost' AND p_status <> 'lost' AND public._phone_is_client(v_p.phone_e164) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un client Bonzini');
  END IF;

  UPDATE public.prospects
     SET status = p_status,
         lost_reason = CASE WHEN p_status = 'lost' THEN v_reason ELSE NULL END,
         status_changed_at = CASE WHEN status = p_status THEN status_changed_at ELSE now() END,
         updated_at = now()
   WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
END;
$$;

CREATE OR REPLACE FUNCTION public.prospect_reassign(p_id UUID, p_source_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = p_source_id AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choisissez un commercial actif');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà devenu client : changez l''origine du client');
  END IF;
  UPDATE public.prospects SET source_id = p_source_id, updated_at = now() WHERE id = p_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'prospect_reassign', 'prospect', p_id, jsonb_build_object('from', v_p.source_id, 'to', p_source_id));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Le responsable rattache un prospect au compte client qu'il est devenu
-- (numéro différent, compte créé avant…). Le client sans origine (ou « Je ne
-- sais pas ») est attribué au commercial du prospect ; une autre origine
-- déjà posée n'est pas écrasée.
CREATE OR REPLACE FUNCTION public.prospect_link_client(p_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.prospects;
  v_client public.clients;
  v_attributed BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà rattaché à un client');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF EXISTS (SELECT 1 FROM public.prospects WHERE converted_user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
  END IF;
  IF v_client.source_id IS NOT NULL AND v_client.source_id <> v_p.source_id
     AND NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_client.source_id AND is_system) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client est déjà attribué à une autre source : changez d''abord son origine');
  END IF;

  IF v_client.source_id IS DISTINCT FROM v_p.source_id THEN
    PERFORM set_config('bonzini.client_source_write', 'on', true);
    UPDATE public.clients SET source_id = v_p.source_id, source_set_at = now(), source_set_by = v_uid WHERE user_id = p_user_id;
    PERFORM set_config('bonzini.client_source_write', '', true);
    v_attributed := true;
  END IF;

  UPDATE public.prospects
     SET status = 'won', converted_user_id = p_user_id, converted_at = now(),
         status_changed_at = now(), lost_reason = NULL, updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'prospect_link_client', 'prospect', p_id,
          jsonb_build_object('client_user_id', p_user_id, 'source_id', v_p.source_id, 'attributed', v_attributed));
  RETURN jsonb_build_object('success', true, 'attributed', v_attributed);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
END;
$$;

-- Pour le formulaire « Nouveau client » : ce numéro est-il le prospect d'un
-- commercial ? L'origine se pré-remplit avec sa fiche.
CREATE OR REPLACE FUNCTION public.prospect_lookup_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_e164 TEXT := public._phone_e164(p_phone);
  v_row RECORD;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canRegisterClients')
          OR public.admin_has_permission(v_uid, 'canEditClients')
          OR public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  SELECT p.id, p.first_name, p.last_name, p.source_id, s.label, s.is_active
    INTO v_row
    FROM public.prospects p JOIN public.client_sources s ON s.id = p.source_id
   WHERE p.phone_e164 = v_e164 AND p.status IN ('new','contacted','interested')
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  RETURN jsonb_build_object('success', true, 'found', true,
    'prospect_id', v_row.id,
    'prospect_name', btrim(v_row.first_name || ' ' || coalesce(v_row.last_name, '')),
    'source_id', v_row.source_id, 'source_label', v_row.label, 'source_active', v_row.is_active);
END;
$$;

-- Attribution automatique : un compte client créé (ou qui reçoit son premier
-- numéro) avec le numéro d'un prospect ouvert est attribué à son commercial,
-- si aucune origine n'est encore posée ; et le prospect dont le commercial
-- est l'origine du client passe « devenu client ». Le nom du déclencheur le
-- fait passer APRÈS clients_guard_source et on_client_phone_sync_e164 (ordre
-- alphabétique) : phone_e164 est à jour, le verrou de l'origine a déjà joué.
-- Jamais d'erreur : une inscription ne doit pas échouer pour un prospect.
CREATE OR REPLACE FUNCTION public.clients_match_prospect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
BEGIN
  IF NEW.phone_e164 IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.phone_e164 IS NOT DISTINCT FROM OLD.phone_e164
     AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT * INTO v_p FROM public.prospects
     WHERE phone_e164 = NEW.phone_e164 AND status IN ('new','contacted','interested')
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Première origine seulement : à la création, ou quand le compte reçoit
    -- son tout premier numéro. Un client qui change de numéro plus tard ne
    -- se ré-attribue pas.
    IF NEW.source_id IS NULL AND (TG_OP = 'INSERT' OR OLD.phone_e164 IS NULL) THEN
      NEW.source_id := v_p.source_id;
      NEW.source_set_at := now();
      NEW.source_set_by := NULL;
    END IF;

    IF NEW.source_id = v_p.source_id THEN
      UPDATE public.prospects
         SET status = 'won', converted_user_id = NEW.user_id, converted_at = now(),
             status_changed_at = now(), updated_at = now()
       WHERE id = v_p.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clients_match_prospect: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospect_match_client ON public.clients;
CREATE TRIGGER prospect_match_client
  BEFORE INSERT OR UPDATE OF phone, source_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_match_prospect();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. set_client_source : pas de re-tamponnage, chaque changement journalisé
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_client_source(p_user_id uuid, p_source_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client public.clients;
  v_src public.client_sources;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canRegisterClients') OR public.admin_has_permission(v_uid, 'canEditClients')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  -- Même origine : rien à faire. L'auteur et la date de l'attribution
  -- d'origine restent ceux d'origine (ils décident des commissions).
  IF v_client.source_id IS NOT DISTINCT FROM p_source_id THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true);
  END IF;
  IF v_client.source_id IS NOT NULL
     AND NOT public.admin_has_permission(v_uid, 'canEditClients') THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''origine de ce client est déjà renseignée');
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id;
  IF NOT FOUND OR NOT v_src.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source introuvable ou archivée');
  END IF;

  PERFORM set_config('bonzini.client_source_write', 'on', true);
  UPDATE public.clients
     SET source_id = p_source_id, source_set_at = now(), source_set_by = v_uid
   WHERE user_id = p_user_id;
  PERFORM set_config('bonzini.client_source_write', '', true);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_client_source', 'client', p_user_id,
          jsonb_build_object('from', v_client.source_id, 'to', p_source_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.set_client_source(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Renseigner ou changer l''origine d''un client (quel commercial ou canal l''a apporté)","resolve":{"p_user_id":"client"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Objectifs et tableaux de bord
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.client_sources(id) ON DELETE CASCADE,
  month DATE NOT NULL CHECK (month = date_trunc('month', month)::date),
  metric TEXT NOT NULL CHECK (metric IN ('new_clients','payments_xaf','air_kg','sea_cbm','prospects_new','prospects_won')),
  target NUMERIC NOT NULL CHECK (target > 0 AND target < 1e13),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, month, metric)
);

ALTER TABLE public.commercial_objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commercial reads own objectives" ON public.commercial_objectives;
CREATE POLICY "Commercial reads own objectives" ON public.commercial_objectives
  FOR SELECT TO authenticated
  USING (source_id = public.current_commercial_source_id()
         OR public.admin_has_permission(auth.uid(), 'canManageSales'));

-- p_target NULL ou ≤ 0 : l'objectif est retiré.
CREATE OR REPLACE FUNCTION public.set_commercial_objective(p_source_id UUID, p_month DATE, p_metric TEXT, p_target NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_month DATE := date_trunc('month', p_month)::date;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_month IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mois requis');
  END IF;
  IF p_metric IS NULL OR p_metric NOT IN ('new_clients','payments_xaf','air_kg','sea_cbm','prospects_new','prospects_won') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Objectif inconnu');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = p_source_id AND kind = 'commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commercial introuvable');
  END IF;
  IF p_target IS NOT NULL AND p_target >= 1e13 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Objectif trop grand');
  END IF;

  IF p_target IS NULL OR p_target <= 0 THEN
    DELETE FROM public.commercial_objectives WHERE source_id = p_source_id AND month = v_month AND metric = p_metric;
  ELSE
    INSERT INTO public.commercial_objectives (source_id, month, metric, target, created_by)
    VALUES (p_source_id, v_month, p_metric, p_target, v_uid)
    ON CONFLICT (source_id, month, metric) DO UPDATE SET target = EXCLUDED.target, updated_at = now();
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_commercial_objective', 'client_source', p_source_id,
          jsonb_build_object('month', v_month, 'metric', p_metric, 'target', p_target));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Les chiffres de plusieurs sources sur [p_from, p_to[ : clients apportés,
-- paiements TERMINÉS, dépôts VALIDÉS, colis déposés (avion = bureau, kg ;
-- bateau = entrepôt, m³), prospects ajoutés et devenus clients.
CREATE OR REPLACE FUNCTION public._commercial_metrics(p_source_ids UUID[], p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
  source_id UUID, clients INT, new_clients INT, active_clients INT,
  payments_xaf BIGINT, payments_count INT, deposits_xaf BIGINT, deposits_count INT,
  air_parcels INT, air_kg NUMERIC, sea_parcels INT, sea_cbm NUMERIC,
  prospects_open INT, prospects_new INT, prospects_won INT, prospects_due INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cl AS (
    SELECT c.user_id, c.source_id, c.created_at FROM public.clients c WHERE c.source_id = ANY(p_source_ids)
  ), pay AS (
    SELECT p.user_id, sum(p.amount_xaf)::bigint amt, count(*)::int n
      FROM public.payments p JOIN cl ON cl.user_id = p.user_id
     WHERE p.status = 'completed'
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) >= p_from
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) <  p_to
     GROUP BY 1
  ), dep AS (
    SELECT d.user_id, sum(coalesce(d.confirmed_amount_xaf, d.amount_xaf))::bigint amt, count(*)::int n
      FROM public.deposits d JOIN cl ON cl.user_id = d.user_id
     WHERE d.status = 'validated' AND d.validated_at >= p_from AND d.validated_at < p_to
     GROUP BY 1
  ), par AS (
    SELECT pd.client_user_id user_id,
           count(*) FILTER (WHERE pd.location = 'office')::int air_n,
           coalesce(sum(pa.weight_kg) FILTER (WHERE pd.location = 'office'), 0) air_kg,
           count(*) FILTER (WHERE pd.location = 'warehouse')::int sea_n,
           coalesce(sum(pa.cbm) FILTER (WHERE pd.location = 'warehouse'), 0) sea_cbm
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
     WHERE pd.status <> 'cancelled' AND pa.created_at >= p_from AND pa.created_at < p_to
     GROUP BY 1
  ), agg AS (
    SELECT cl.source_id,
           count(*)::int clients,
           count(*) FILTER (WHERE cl.created_at >= p_from AND cl.created_at < p_to)::int new_clients,
           count(*) FILTER (WHERE pay.user_id IS NOT NULL OR dep.user_id IS NOT NULL OR par.user_id IS NOT NULL)::int active_clients,
           coalesce(sum(pay.amt), 0)::bigint payments_xaf, coalesce(sum(pay.n), 0)::int payments_count,
           coalesce(sum(dep.amt), 0)::bigint deposits_xaf, coalesce(sum(dep.n), 0)::int deposits_count,
           coalesce(sum(par.air_n), 0)::int air_parcels, coalesce(sum(par.air_kg), 0) air_kg,
           coalesce(sum(par.sea_n), 0)::int sea_parcels, coalesce(sum(par.sea_cbm), 0) sea_cbm
      FROM cl
      LEFT JOIN pay ON pay.user_id = cl.user_id
      LEFT JOIN dep ON dep.user_id = cl.user_id
      LEFT JOIN par ON par.user_id = cl.user_id
     GROUP BY cl.source_id
  ), pr AS (
    SELECT p.source_id,
           count(*) FILTER (WHERE p.status IN ('new','contacted','interested'))::int open_n,
           count(*) FILTER (WHERE p.created_at >= p_from AND p.created_at < p_to)::int new_n,
           count(*) FILTER (WHERE p.status = 'won' AND p.converted_at >= p_from AND p.converted_at < p_to)::int won_n,
           count(*) FILTER (WHERE p.status IN ('new','contacted','interested') AND p.next_action_at <= now())::int due_n
      FROM public.prospects p
     WHERE p.source_id = ANY(p_source_ids)
     GROUP BY 1
  )
  SELECT s.id,
         coalesce(agg.clients, 0), coalesce(agg.new_clients, 0), coalesce(agg.active_clients, 0),
         coalesce(agg.payments_xaf, 0), coalesce(agg.payments_count, 0),
         coalesce(agg.deposits_xaf, 0), coalesce(agg.deposits_count, 0),
         coalesce(agg.air_parcels, 0), coalesce(agg.air_kg, 0),
         coalesce(agg.sea_parcels, 0), coalesce(agg.sea_cbm, 0),
         coalesce(pr.open_n, 0), coalesce(pr.new_n, 0), coalesce(pr.won_n, 0), coalesce(pr.due_n, 0)
    FROM unnest(p_source_ids) AS s(id)
    LEFT JOIN agg ON agg.source_id = s.id
    LEFT JOIN pr ON pr.source_id = s.id
$$;

-- Une ligne de tableau de bord (chiffres + objectifs du mois) au format JSON.
CREATE OR REPLACE FUNCTION public._commercial_card(p_source_id UUID, p_month DATE, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'source', jsonb_build_object('id', s.id, 'label', s.label, 'phone', s.phone, 'is_active', s.is_active),
    'staff', CASE WHEN ur.user_id IS NULL THEN NULL ELSE jsonb_build_object(
               'user_id', ur.user_id,
               'name', btrim(coalesce(ur.first_name, '') || ' ' || coalesce(ur.last_name, '')),
               'is_disabled', coalesce(ur.is_disabled, false)) END,
    'metrics', jsonb_build_object(
      'clients', m.clients, 'new_clients', m.new_clients, 'active_clients', m.active_clients,
      'payments_xaf', m.payments_xaf, 'payments_count', m.payments_count,
      'deposits_xaf', m.deposits_xaf, 'deposits_count', m.deposits_count,
      'air_parcels', m.air_parcels, 'air_kg', m.air_kg,
      'sea_parcels', m.sea_parcels, 'sea_cbm', m.sea_cbm,
      'prospects_open', m.prospects_open, 'prospects_new', m.prospects_new,
      'prospects_won', m.prospects_won, 'prospects_due', m.prospects_due),
    'objectives', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'metric', o.metric, 'target', o.target,
               'actual', CASE o.metric
                 WHEN 'new_clients'   THEN m.new_clients::numeric
                 WHEN 'payments_xaf'  THEN m.payments_xaf::numeric
                 WHEN 'air_kg'        THEN m.air_kg
                 WHEN 'sea_cbm'       THEN m.sea_cbm
                 WHEN 'prospects_new' THEN m.prospects_new::numeric
                 WHEN 'prospects_won' THEN m.prospects_won::numeric END)
             ORDER BY o.metric)
        FROM public.commercial_objectives o
       WHERE o.source_id = s.id AND o.month = p_month), '[]'::jsonb))
    FROM public.client_sources s
    LEFT JOIN public.user_roles ur ON ur.user_id = s.staff_user_id
    CROSS JOIN LATERAL public._commercial_metrics(ARRAY[s.id], p_from, p_to) m
   WHERE s.id = p_source_id
$$;

-- Le tableau de bord d'UN commercial pour un mois : le sien (p_source_id
-- NULL), ou celui de n'importe quel commercial avec canManageSales.
CREATE OR REPLACE FUNCTION public.commercial_dashboard(p_month DATE DEFAULT NULL, p_source_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src UUID := public._sales_scope(p_source_id);
  v_m RECORD;
  v_card JSONB;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  SELECT * INTO v_m FROM public._sales_month(p_month);
  v_card := public._commercial_card(v_src, v_m.month, v_m.from_at, v_m.to_at);
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commercial introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'month', v_m.month) || v_card;
END;
$$;

-- Les clients d'un commercial, un par un, avec leurs chiffres du mois.
CREATE OR REPLACE FUNCTION public.commercial_clients(p_month DATE DEFAULT NULL, p_source_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src UUID := public._sales_scope(p_source_id);
  v_m RECORD;
  v_rows JSONB;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  SELECT * INTO v_m FROM public._sales_month(p_month);

  WITH cl AS (
    SELECT c.user_id, c.first_name, c.last_name, c.company_name, c.customer_code, c.phone, c.created_at, c.source_set_at
      FROM public.clients c WHERE c.source_id = v_src
  ), pay AS (
    SELECT p.user_id, sum(p.amount_xaf)::bigint amt, count(*)::int n
      FROM public.payments p JOIN cl ON cl.user_id = p.user_id
     WHERE p.status = 'completed'
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) >= v_m.from_at
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) <  v_m.to_at
     GROUP BY 1
  ), par AS (
    SELECT pd.client_user_id user_id,
           count(*) FILTER (WHERE pd.location = 'office')::int air_n,
           coalesce(sum(pa.weight_kg) FILTER (WHERE pd.location = 'office'), 0) air_kg,
           count(*) FILTER (WHERE pd.location = 'warehouse')::int sea_n,
           coalesce(sum(pa.cbm) FILTER (WHERE pd.location = 'warehouse'), 0) sea_cbm
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
     WHERE pd.status <> 'cancelled' AND pa.created_at >= v_m.from_at AND pa.created_at < v_m.to_at
     GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', cl.user_id,
           'name', btrim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')),
           'company', cl.company_name, 'customer_code', cl.customer_code, 'phone', cl.phone,
           'created_at', cl.created_at, 'source_set_at', cl.source_set_at,
           'payments_xaf', coalesce(pay.amt, 0), 'payments_count', coalesce(pay.n, 0),
           'air_parcels', coalesce(par.air_n, 0), 'air_kg', coalesce(par.air_kg, 0),
           'sea_parcels', coalesce(par.sea_n, 0), 'sea_cbm', coalesce(par.sea_cbm, 0)
         ) ORDER BY coalesce(pay.amt, 0) DESC, coalesce(par.air_kg, 0) + coalesce(par.sea_cbm, 0) * 167 DESC, cl.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM cl
    LEFT JOIN pay ON pay.user_id = cl.user_id
    LEFT JOIN par ON par.user_id = cl.user_id;

  RETURN jsonb_build_object('success', true, 'month', v_m.month, 'rows', v_rows);
END;
$$;

-- Tous les commerciaux pour un mois (le responsable) : fiches « commercial »
-- actives ou reliées à un compte, plus celles qui ont des clients ou des prospects.
CREATE OR REPLACE FUNCTION public.sales_overview(p_month DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m RECORD;
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_m FROM public._sales_month(p_month);

  SELECT coalesce(jsonb_agg(public._commercial_card(s.id, v_m.month, v_m.from_at, v_m.to_at)
                            ORDER BY (s.staff_user_id IS NULL), s.is_active DESC, lower(s.label)), '[]'::jsonb)
    INTO v_rows
    FROM public.client_sources s
   WHERE s.kind = 'commercial'
     AND (s.is_active OR s.staff_user_id IS NOT NULL
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.source_id = s.id)
          OR EXISTS (SELECT 1 FROM public.prospects p WHERE p.source_id = s.id));

  RETURN jsonb_build_object('success', true, 'month', v_m.month, 'rows', v_rows);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Droits
-- ─────────────────────────────────────────────────────────────────────────
-- Internes : jamais appelables depuis l'API.
REVOKE ALL ON FUNCTION public._sales_scope(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sales_scope_error() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._phone_is_client(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._commercial_metrics(UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._commercial_card(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clients_match_prospect() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sales_scope(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public._commercial_metrics(UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- Lues par les politiques RLS (current_commercial_source_id) ou inoffensives.
REVOKE ALL ON FUNCTION public.current_commercial_source_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_commercial_source_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._phone_e164(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._phone_e164(TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._sales_month(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._sales_month(DATE) TO authenticated, service_role;

-- Les actions : membres du personnel connectés ; chaque RPC vérifie la permission.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.team_members()',
    'public.team_create_member(text, text, text, text, text, uuid)',
    'public.team_update_member(uuid, text, text, text, text)',
    'public.team_link_commercial(uuid, uuid)',
    'public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid)',
    'public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[])',
    'public.prospect_set_status(uuid, text, text)',
    'public.prospect_reassign(uuid, uuid)',
    'public.prospect_link_client(uuid, uuid)',
    'public.prospect_lookup_phone(text)',
    'public.set_commercial_objective(uuid, date, text, numeric)',
    'public.commercial_dashboard(date, uuid)',
    'public.commercial_clients(date, uuid)',
    'public.sales_overview(date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Les comptes du personnel ne se gèrent pas par Mola (comme admin_create_admin).
-- Le commercial n'a pas Mola (la passerelle le refuse) : les actions de vente
-- sont ouvertes à Mola pour le responsable (canManageSales).
COMMENT ON FUNCTION public.team_members() IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Liste des membres de l''équipe (rôle, statut, dernière connexion, fiche commercial)"}';
COMMENT ON FUNCTION public.team_create_member(text, text, text, text, text, uuid) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Créer un accès pour un membre de l''équipe (et la fiche d''un commercial)"}';
COMMENT ON FUNCTION public.team_update_member(uuid, text, text, text, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Modifier un membre de l''équipe (nom, téléphone, rôle)"}';
COMMENT ON FUNCTION public.team_link_commercial(uuid, uuid) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Relier un compte commercial à sa fiche"}';
COMMENT ON FUNCTION public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Ajouter un prospect pour un commercial (prénom, numéro +237…, entreprise, ville, intérêts : payments / air / sea)"}';
COMMENT ON FUNCTION public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Modifier un prospect (coordonnées, notes, date de relance)"}';
COMMENT ON FUNCTION public.prospect_set_status(uuid, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Changer le statut d''un prospect (new, contacted, interested, lost avec motif)"}';
COMMENT ON FUNCTION public.prospect_reassign(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Confier un prospect à un autre commercial"}';
COMMENT ON FUNCTION public.prospect_link_client(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Rattacher un prospect au compte client qu''il est devenu (attribue le client à son commercial s''il n''a pas d''origine)","resolve":{"p_user_id":"client"}}';
COMMENT ON FUNCTION public.prospect_lookup_phone(text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canRegisterClients","label":"Ce numéro est-il le prospect d''un commercial ? (pour l''origine d''un nouveau client)"}';
COMMENT ON FUNCTION public.set_commercial_objective(uuid, date, text, numeric) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Fixer l''objectif du mois d''un commercial (new_clients, payments_xaf, air_kg, sea_cbm, prospects_new, prospects_won ; 0 le retire)"}';
COMMENT ON FUNCTION public.commercial_dashboard(date, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Tableau de bord d''un commercial pour un mois : clients, paiements, colis avion (kg) et bateau (m³), prospects, objectifs"}';
COMMENT ON FUNCTION public.commercial_clients(date, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Les clients d''un commercial avec leurs paiements et colis du mois"}';
COMMENT ON FUNCTION public.sales_overview(date) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Tous les commerciaux pour un mois : chiffres et objectifs côte à côte"}';
COMMENT ON FUNCTION public.current_commercial_source_id() IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : la fiche du commercial connecté"}';
COMMENT ON FUNCTION public._sales_scope(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : périmètre d''un commercial"}';
COMMENT ON FUNCTION public._sales_scope_error() IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : message de refus de périmètre"}';
COMMENT ON FUNCTION public._phone_e164(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : numéro au format international"}';
COMMENT ON FUNCTION public._sales_month(date) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : bornes d''un mois à Douala"}';
COMMENT ON FUNCTION public._phone_is_client(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : ce numéro est-il celui d''un client"}';
COMMENT ON FUNCTION public._commercial_metrics(uuid[], timestamptz, timestamptz) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : chiffres des commerciaux sur une période"}';
COMMENT ON FUNCTION public._commercial_card(uuid, date, timestamptz, timestamptz) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : carte d''un commercial"}';
COMMENT ON FUNCTION public.clients_match_prospect() IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","label":"Interne : attribution d''un nouveau client au commercial qui l''a prospecté"}';

NOTIFY pgrst, 'reload schema';

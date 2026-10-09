-- ============================================================================
-- MIGRATION CONSOLIDÉE · 06/10 → 08/10/2026 · QUATRE MIGRATIONS, UN SEUL FICHIER
--   A. Équipe : sites et numéros · Clients : « Enregistré par » et origine
--      posée par la réception de Guangzhou                       (06/10)
--   B. Prospects : la fiche complète (nom, sexe, ville, tous ses numéros,
--      ses plus gros problèmes) · Clients : sexe et date de naissance (06/10)
--   C. Prospects : numéro déjà client (« À vérifier » + notification du
--      super admin) · le super admin repasse un client sans opération en
--      prospect                                                    (07/10)
--   D. Ventes : l'évolution mois par mois ou semaine par semaine, par
--      commercial et pour l'équipe (sales_series, lecture seule)   (08/10)
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- À coller APRÈS migrations/20261005_consolidated.sql (Mes équipes +
-- commerciaux) — le contrôle des prérequis ci-dessous s'arrête net sinon,
-- sans rien modifier.
--
-- Pourquoi un seul fichier (et pas un 20261007_consolidated.sql à part) : les
-- deux migrations du 06/10 ne sont pas encore collées en production, et la
-- partie C redéfinit des fonctions de la partie B (prospect_create,
-- prospect_update, prospect_set_status, _prospect_number_conflict…). Un seul
-- collage dans le bon ordre évite d'en oublier un ou de les inverser (la
-- partie B passée APRÈS la C remettrait le refus du numéro d'un client). Le
-- fichier reste rejouable si son ancienne version (A seule, A + B, ou
-- A + B + C) a déjà été collée. La partie D (08/10) ne redéfinit rien des
-- autres : elle ajoute une fonction de lecture et compte le statut « À
-- vérifier » de la partie C ; elle vient ici pour qu'il n'y ait toujours
-- qu'UN collage.
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis (rien n'est modifié s'il en manque un).
--   1. Partie A, copie conforme de
--        ← supabase/migrations/20261006100000_staff_sites_phones_registration.sql
--      · staff_sites (Guangzhou · bureau, Guangzhou · entrepôt, Douala,
--        Yaoundé ; le super admin en ajoute) et user_roles.site_id ;
--      · staff_phones : plusieurs numéros par collaborateur, au format
--        international, le premier recopié dans user_roles.phone ; les
--        numéros déjà saisis au format international y sont repris ;
--      · clients.registered_* : « Enregistré par » (nom, rôle, site du jour),
--        posé par un déclencheur depuis la session, jamais réécrit ;
--        rattrapage des clients créés par l'équipe depuis le journal ;
--      · origine « Colis reçu · Entrepôt / Bureau de Guangzhou » (type
--        `parcel`, système) et reception_set_client_origin ;
--      · team_sites, team_create_site, team_set_member_profile ;
--        team_members renvoie aussi les numéros et le site.
--   2. Partie B, copie conforme de
--        ← supabase/migrations/20261006120000_prospect_details_client_identity.sql
--      · prospects : sexe (MALE / FEMALE), date de naissance, email, « ses
--        plus gros problèmes aujourd'hui », « ce que nous pouvons faire pour
--        l'aider » ; nom, sexe et ville obligatoires à la saisie ;
--      · prospect_phones : ses AUTRES numéros (neuf au plus), lus comme la
--        fiche (RLS), écrits seulement par les RPC ; tout est vérifié avant
--        d'écrire ;
--      · prospect_create / prospect_update recréées avec leurs nouveaux
--        paramètres (anciennes signatures supprimées) ; prospect_set_status
--        vérifie aussi les autres numéros d'un prospect perdu qu'on rouvre ;
--      · prospect_lookup_phone : trouve aussi par un autre numéro et renvoie
--        la fiche (nom, entreprise, ville, email, sexe, naissance, numéros) ;
--      · clients_match_prospect : un compte client créé avec l'UN des numéros
--        d'un prospect est attribué à son commercial ;
--      · admin_set_client_identity : sexe et date de naissance d'un client
--        (canEditClients, ou la personne qui l'a enregistré), journalisée.
--   3. Partie C, copie conforme de
--        ← supabase/migrations/20261007100000_prospect_client_control.sql
--      · cloisonnement : RIEN n'est ouvert au commercial ; la nouvelle table
--        lui est illisible, la vérification d'un numéro ne dit rien du client ;
--      · prospects.status accepte « to_verify » (« À vérifier »), qui n'est
--        pas un statut ouvert (index, compteurs, attribution automatique) ;
--      · prospect_client_claims : une vérification par (fiche, client
--        reconnu) ; lecture canManageSales seulement, aucune écriture directe ;
--      · prospect_create / prospect_update (mêmes signatures) : le numéro
--        (principal ou autre) d'un de SES clients est refusé ; celui d'un
--        AUTRE client fait partir la fiche « À vérifier », ouvre les
--        vérifications et notifie le super admin (to_verify: true) ;
--        prospect_set_status : une fiche « À vérifier » attend la direction ;
--        prospect_link_client : pas sur une fiche « À vérifier » ;
--      · prospect_phone_check (pendant la saisie, aucune identité),
--        prospect_claims_pending et prospect_resolve_claim (attribuer /
--        refuser ; journalisé ; commerciaux notifiés), send_staff_push_user ;
--      · admin_client_prospect_eligibility et admin_client_to_prospect :
--        client SANS AUCUNE opération → prospect (instantané au journal,
--        compte supprimé par admin_delete_client, prospect rouvert ou créé).
--   4. Partie D, copie conforme de
--        ← supabase/migrations/20261008100000_sales_series.sql
--      · sales_series(p_from, p_to, p_grain, p_source_id) : clients
--        (cumul, nouveaux, actifs), prospects (ajoutés, gagnés, perdus),
--        paiements, dépôts, colis avion (kg) et vols distincts, colis bateau
--        (m³) — par mois ou par semaine de Douala, sans trou, avec les totaux,
--        la plage précédente et l'entonnoir des prospects ; par fiche et pour
--        l'équipe. Le commercial : sa fiche seulement ; la direction
--        (canManageSales) : toutes ou une. Lecture seule, @mola exposée.
--   Tables créées : staff_sites, staff_phones, prospect_phones,
--   prospect_client_claims. Seules données modifiées : le rattrapage
--   « Enregistré par » et la reprise des numéros du personnel (partie A).
--
-- Idempotent : rejouable sans dégât, y compris si une ancienne version de ce
-- fichier (A seule, A + B, ou A + B + C) a déjà été collée. Vérifié sur Postgres 16 avec
-- la base de Mes équipes : ce fichier passé deux fois dans UNE transaction,
-- puis les 40 contrôles de la partie A, les 80 de la partie B (deux attendus
-- adaptés : le numéro d'un client part désormais « À vérifier »), les 104 de
-- la partie C, et les 105 contrôles de Mes équipes / commerciaux repassés ;
-- avec la partie D : fichier passé deux fois dans UNE transaction, après
-- l'ancienne version (A + B + C), les 87 contrôles de sales_series en plus
-- de tous les précédents.
--
-- Après passage :
--   npx supabase migration repair --status applied 20261006100000 20261006120000 20261007100000 20261008100000
--   /gen-types
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
      ('user_roles',       'équipe'),
      ('clients',          'clients'),
      ('client_phones',    'numéros des clients'),
      ('client_sources',   'sources des clients, 05/10'),
      ('admin_audit_logs', 'journal d''audit'),
      ('prospects',        'commerciaux, 05/10 — coller migrations/20261005_consolidated.sql AVANT ce fichier'),
      ('wallets',          'portefeuilles'),
      ('deposits',         'dépôts'),
      ('payments',         'paiements'),
      ('ledger_entries',   'grand livre'),
      ('wallet_adjustments', 'ajustements de solde'),
      ('staff_push_devices', 'notifications du personnel, 26/09'),
      ('parcel_deposits',  'réception des colis, 20/09'),
      ('parcels',          'réception des colis, 20/09'),
      ('air_shipments',    'expéditions aériennes, 21/09')
    ) AS t(tbl, origin)
    WHERE to_regclass('public.' || t.tbl) IS NULL
  LOOP
    v_missing := array_append(v_missing, 'table public.' || r.tbl || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT c.tbl, c.col, c.origin
    FROM (VALUES
      ('user_roles',     'phone',         'Mes équipes, 05/10'),
      ('client_sources', 'staff_user_id', 'Mes équipes, 05/10'),
      ('clients',        'source_id',     'sources des clients, 05/10'),
      ('clients',        'phone_e164',    'numéro normalisé des clients'),
      ('clients',        'gender',        'fiche client'),
      ('clients',        'date_of_birth', 'fiche client'),
      ('client_phones',  'phone_e164',    'numéros des clients'),
      ('client_phones',  'country_iso',   'numéros des clients'),
      ('client_phones',  'is_primary',    'numéros des clients'),
      ('clients',        'customer_code', 'identifiant client'),
      ('wallets',        'overdraft_limit_xaf', 'découvert, 18/09'),
      ('deposits',       'created_at',    'dépôts'),
      ('payments',       'created_at',    'paiements'),
      ('deposits',       'validated_at',  'dépôts'),
      ('deposits',       'confirmed_amount_xaf', 'dépôts'),
      ('payments',       'processed_at',  'paiements'),
      ('payments',       'cash_paid_at',  'paiements en espèces'),
      ('parcel_deposits', 'location',     'réception des colis, 20/09'),
      ('parcels',        'air_shipment_id', 'expéditions aériennes, 21/09'),
      ('air_shipments',  'departed_at',   'expéditions aériennes, 21/09')
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
      ('admin_has_permission',         'droits par rôle'),
      ('is_admin',                     'droits par rôle'),
      ('guard_client_source',          'sources des clients, 05/10'),
      ('team_create_member',           'Mes équipes, 05/10 — coller migrations/20261005_consolidated.sql AVANT ce fichier'),
      ('prospect_create',              'commerciaux, 05/10'),
      ('prospect_update',              'commerciaux, 05/10'),
      ('prospect_set_status',          'commerciaux, 05/10'),
      ('prospect_lookup_phone',        'commerciaux, 05/10'),
      ('clients_match_prospect',       'commerciaux, 05/10'),
      ('current_commercial_source_id', 'commerciaux, 05/10'),
      ('_sales_scope',                 'commerciaux, 05/10'),
      ('_sales_scope_error',           'commerciaux, 05/10'),
      ('_phone_e164',                  'commerciaux, 05/10'),
      ('_phone_is_client',             'commerciaux, 05/10'),
      ('prospect_link_client',         'commerciaux, 05/10'),
      ('send_staff_push',              'notifications du personnel, 26/09'),
      ('admin_delete_client',          'suppression d''un client')
    ) AS f(fn, origin)
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f.fn AND pronamespace = 'public'::regnamespace)
  LOOP
    v_missing := array_append(v_missing, 'fonction ' || r.fn || ' (' || r.origin || ')');
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migrations du 06/10 au 08/10 (équipe, « Enregistré par », fiche prospect, « À vérifier », évolution des ventes) : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Partie A : copie conforme de 20261006100000_staff_sites_phones_registration.sql
-- ############################################################################
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


-- ############################################################################
-- SECTION 2 — Partie B : copie conforme de 20261006120000_prospect_details_client_identity.sql
-- ############################################################################
-- ============================================================================
-- Prospects : la fiche complète · Clients : sexe et date de naissance
--
-- Le 06/10/2026, le directeur veut une vraie différence entre le PROSPECT
-- (quelqu'un que le commercial démarche, sans compte) et le CLIENT (compte
-- Bonzini), et une fiche prospect qui serve vraiment à vendre :
--
--   1. LA FICHE PROSPECT — en plus du prénom et du numéro : le NOM, le SEXE
--      (homme / femme) et la VILLE où il est installé au Cameroun deviennent
--      obligatoires ; la date de naissance, l'email et l'entreprise restent
--      facultatifs. Surtout, deux champs libres, le cœur de l'entretien :
--      « ses plus gros problèmes aujourd'hui » (payer ses fournisseurs et
--      faire arriver l'argent en Chine, manque de capital, gestion du
--      capital, transport avion ou bateau, trouver les bons fournisseurs, la
--      douane et sa procédure, fixer ses prix de vente…) et « ce que nous
--      pouvons faire pour l'aider ». Le formulaire exige le premier ; le
--      serveur les accepte vides (un prospect saisi avant ce jour n'en a pas).
--   2. TOUS SES NUMÉROS — un importateur a souvent deux ou trois numéros
--      (Orange, MTN, WhatsApp chinois…). Le principal reste prospects.phone /
--      phone_e164 ; les autres vont dans prospect_phones (neuf au plus). Un
--      numéro n'est suivi que par UN prospect ouvert à la fois, qu'il soit
--      principal ou non, et jamais s'il est déjà celui d'un client : la
--      règle du 05/10 est étendue aux autres numéros, des deux côtés.
--      Le compte client créé avec l'UN de ces numéros est attribué à son
--      commercial (déclencheur clients_match_prospect), et la recherche par
--      numéro du formulaire « Nouveau client » renvoie toute la fiche (nom,
--      entreprise, ville, email, sexe, date de naissance, numéros) pour la
--      reprendre d'office — sauf l'email, seulement PROPOSÉ à l'écran : il
--      deviendrait l'adresse de connexion (confirmée) du client, et c'est
--      un commercial qui l'a saisi, sans vérification.
--   3. CÔTÉ CLIENT — le sexe et la date de naissance existent déjà en base
--      (clients.gender MALE / FEMALE / OTHER, clients.date_of_birth) mais
--      aucune RPC de l'équipe ne les écrivait. admin_set_client_identity :
--      canEditClients, ou canRegisterClients pour un client qu'on a
--      soi-même enregistré (« Enregistré par » = soi), sans limite de temps
--      — comme reception_set_client_origin ; journalisée.
--
-- Mêmes règles partout (et dans src/lib/people.ts) : sexe MALE / FEMALE,
-- date de naissance de 16 à 110 ans, email en minuscules et de forme
-- x@y.z, numéros au format international. Tout est vérifié AVANT d'écrire :
-- un numéro refusé ne laisse jamais une fiche à moitié enregistrée.
--
-- Idempotente (rejouable sans dégât). Suppose 20261005160000 (Mes équipes +
-- commerciaux) et 20261006100000 (« Enregistré par ») passées.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. La fiche prospect : sexe, date de naissance, email, problèmes, aide
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS gender      TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS birth_date  DATE;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pain_points TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS help_needed TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_gender_check' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_gender_check
      CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_email_check' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_email_check
      CHECK (email IS NULL OR (length(email) <= 254 AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_pain_points_length' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_pain_points_length
      CHECK (pain_points IS NULL OR length(pain_points) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_help_needed_length' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_help_needed_length
      CHECK (help_needed IS NULL OR length(help_needed) <= 2000);
  END IF;
END $$;

COMMENT ON COLUMN public.prospects.gender IS 'MALE / FEMALE. Obligatoire à la création depuis le 06/10 ; NULL pour un prospect saisi avant.';
COMMENT ON COLUMN public.prospects.birth_date IS 'Facultative ; de 16 à 110 ans au jour de la saisie.';
COMMENT ON COLUMN public.prospects.email IS 'Facultatif ; en minuscules.';
COMMENT ON COLUMN public.prospects.pain_points IS 'Ses plus gros problèmes aujourd''hui (champ libre) : payer ses fournisseurs, capital, transport, fournisseurs, douane, prix de vente…';
COMMENT ON COLUMN public.prospects.help_needed IS 'Ce que nous pouvons faire pour l''aider (champ libre).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Ses autres numéros
-- ─────────────────────────────────────────────────────────────────────────
-- Le principal reste prospects.phone / phone_e164 (index unique des
-- prospects ouverts, lu par les écrans du 05/10). Ici : les AUTRES.
CREATE TABLE IF NOT EXISTS public.prospect_phones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  phone_e164  TEXT NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  country_iso TEXT CHECK (country_iso IS NULL OR country_iso ~ '^[A-Z]{2}$'),
  label       TEXT CHECK (label IS NULL OR length(label) <= 40),
  position    INTEGER NOT NULL DEFAULT 1 CHECK (position >= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, phone_e164)
);
-- « Ce numéro est-il suivi ? » se pose à chaque saisie et à chaque création de client.
CREATE INDEX IF NOT EXISTS prospect_phones_phone_idx ON public.prospect_phones (phone_e164);

-- Lecture : comme la fiche (le commercial lit les numéros de SES prospects,
-- le responsable tous). Aucune politique d'écriture : tout passe par
-- prospect_create / prospect_update.
ALTER TABLE public.prospect_phones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commercial reads own prospect phones" ON public.prospect_phones;
CREATE POLICY "Commercial reads own prospect phones" ON public.prospect_phones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prospects p
     WHERE p.id = prospect_phones.prospect_id
       AND (p.source_id = public.current_commercial_source_id()
            OR public.admin_has_permission(auth.uid(), 'canManageSales'))
  ));

-- Mêmes droits que prospects : aucune ligne GRANT n'y est écrite (droits par
-- défaut de Supabase sur le schéma public) ; la lecture par `authenticated`
-- est rappelée ici pour que la jointure `phones:prospect_phones(…)` de
-- l'espace commercial ne dépende pas de ces droits par défaut. Les écritures
-- restent fermées par la RLS (aucune politique).
GRANT SELECT ON TABLE public.prospect_phones TO authenticated;
GRANT ALL ON TABLE public.prospect_phones TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Règles communes (internes)
-- ─────────────────────────────────────────────────────────────────────────
-- Date de naissance : NULL si elle est absente ou bonne, sinon le message.
-- Âge révolu entre 16 et 110 ans au jour même (même règle que people.ts).
CREATE OR REPLACE FUNCTION public._birth_date_error(p_date DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_date IS NULL THEN NULL
           WHEN extract(year FROM age(current_date, p_date)) BETWEEN 16 AND 110 THEN NULL
           ELSE 'Date de naissance invalide (âge entre 16 et 110 ans)'
         END
$$;

-- Email DÉJÀ nettoyé (btrim, minuscules, '' → NULL) : NULL s'il est absent
-- ou bon, sinon le message.
CREATE OR REPLACE FUNCTION public._email_error(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_email IS NULL THEN NULL
           WHEN length(p_email) <= 254 AND p_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN NULL
           ELSE 'Adresse email invalide'
         END
$$;

-- La liste des AUTRES numéros envoyée par l'écran : [{phone_e164,
-- country_iso?, label?}] (une simple chaîne est aussi acceptée). Rien n'est
-- lu en base : forme seulement. Renvoie {"phones": [...]} nettoyée (format
-- international, pays en majuscules, libellé sans espaces autour, le
-- principal et les doubles retirés), ou {"error": "..."}.
CREATE OR REPLACE FUNCTION public._prospect_phone_list(p_phones JSONB, p_primary TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_item  JSONB;
  v_raw   TEXT;
  v_e164  TEXT;
  v_iso   TEXT;
  v_label TEXT;
  v_seen  TEXT[] := ARRAY[]::TEXT[];
  v_out   JSONB := '[]'::jsonb;
BEGIN
  IF p_phones IS NULL OR jsonb_typeof(p_phones) = 'null' THEN
    RETURN jsonb_build_object('phones', v_out);
  END IF;
  IF jsonb_typeof(p_phones) <> 'array' THEN
    RETURN jsonb_build_object('error', 'Liste de numéros invalide');
  END IF;
  IF jsonb_array_length(p_phones) > 20 THEN
    RETURN jsonb_build_object('error', 'Dix numéros au plus (le principal et neuf autres)');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_phones) LOOP
    v_raw := btrim(coalesce(CASE jsonb_typeof(v_item)
                              WHEN 'object' THEN v_item ->> 'phone_e164'
                              WHEN 'string' THEN v_item #>> '{}'
                            END, ''));
    v_e164 := public._phone_e164(v_raw);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('error', 'Numéro invalide : ' || coalesce(nullif(left(v_raw, 32), ''), '(vide)'));
    END IF;
    v_iso := CASE WHEN jsonb_typeof(v_item) = 'object'
                  THEN nullif(upper(btrim(coalesce(v_item ->> 'country_iso', ''))), '') END;
    IF v_iso IS NOT NULL AND v_iso !~ '^[A-Z]{2}$' THEN
      RETURN jsonb_build_object('error', 'Pays inconnu pour le numéro ' || v_e164);
    END IF;
    v_label := CASE WHEN jsonb_typeof(v_item) = 'object'
                    THEN nullif(btrim(coalesce(v_item ->> 'label', '')), '') END;
    IF length(v_label) > 40 THEN
      RETURN jsonb_build_object('error', 'Libellé trop long (40 caractères au plus)');
    END IF;
    -- Le principal, ou un numéro déjà dans la liste : ignoré.
    IF v_e164 = p_primary OR v_e164 = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || v_e164;
    v_out := v_out || jsonb_build_array(jsonb_build_object('phone_e164', v_e164, 'country_iso', v_iso, 'label', v_label));
  END LOOP;

  IF coalesce(array_length(v_seen, 1), 0) > 9 THEN
    RETURN jsonb_build_object('error', 'Dix numéros au plus (le principal et neuf autres)');
  END IF;
  RETURN jsonb_build_object('phones', v_out);
END;
$$;

-- Deux saisies simultanées du même numéro (deux commerciaux, ou le même deux
-- fois) passent l'une après l'autre : sans ce verrou, toutes deux vérifient
-- avant que l'une ait écrit (aucun index unique ne couvre les AUTRES numéros).
-- Ordre trié : pas d'interblocage. Relâché à la fin de la transaction.
CREATE OR REPLACE FUNCTION public._prospect_lock_numbers(p_numbers TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_n TEXT;
BEGIN
  FOR v_n IN SELECT DISTINCT n FROM unnest(coalesce(p_numbers, ARRAY[]::TEXT[])) AS n WHERE n IS NOT NULL ORDER BY n LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('bonzini.prospect_phone:' || v_n, 0));
  END LOOP;
END;
$$;

-- Ce numéro est-il pris ? 'client' (celui d'un client Bonzini), 'other'
-- (suivi — principal OU autre numéro — par un prospect ouvert d'une autre
-- fiche commercial), 'mine' (par un autre prospect ouvert de la même fiche),
-- NULL s'il est libre. p_except : le prospect qu'on modifie.
CREATE OR REPLACE FUNCTION public._prospect_number_conflict(p_e164 TEXT, p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN public._phone_is_client(p_e164) THEN 'client'
           WHEN bool_or(h.source_id IS DISTINCT FROM p_source_id) THEN 'other'
           WHEN count(h.source_id) > 0 THEN 'mine'
         END
    FROM (
      SELECT p.source_id
        FROM public.prospects p
       WHERE p.phone_e164 = p_e164
         AND p.status IN ('new','contacted','interested')
         AND p.id IS DISTINCT FROM p_except
      UNION ALL
      SELECT p.source_id
        FROM public.prospect_phones pp
        JOIN public.prospects p ON p.id = pp.prospect_id
       WHERE pp.phone_e164 = p_e164
         AND p.status IN ('new','contacted','interested')
         AND p.id IS DISTINCT FROM p_except
    ) h
$$;

-- Le premier des AUTRES numéros qui est pris, dit en clair ; NULL si tous
-- sont libres.
CREATE OR REPLACE FUNCTION public._prospect_numbers_error(p_numbers TEXT[], p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n TEXT;
  v_c TEXT;
BEGIN
  FOREACH v_n IN ARRAY coalesce(p_numbers, ARRAY[]::TEXT[]) LOOP
    v_c := public._prospect_number_conflict(v_n, p_source_id, p_except);
    IF v_c = 'client' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà celui d''un client Bonzini';
    ELSIF v_c = 'other' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà suivi par un autre commercial';
    ELSIF v_c = 'mine' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà dans votre liste';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Ajouter un prospect
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid);

CREATE OR REPLACE FUNCTION public.prospect_create(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
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
  v_gender TEXT := upper(btrim(coalesce(p_gender, '')));
  v_email TEXT := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_pain TEXT := nullif(btrim(coalesce(p_pain_points, '')), '');
  v_help TEXT := nullif(btrim(coalesce(p_help_needed, '')), '');
  v_list JSONB;
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
  v_id UUID;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_src AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée ou introuvable');
  END IF;

  -- Qui : prénom, nom, sexe, ville — obligatoires.
  IF length(btrim(coalesce(p_first_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF length(btrim(coalesce(p_last_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF v_gender NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF length(btrim(coalesce(p_city, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  -- Facultatifs, mais justes s'ils sont donnés.
  v_err := coalesce(public._birth_date_error(p_birth_date), public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(v_pain) > 2000 OR length(v_help) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Les numéros : la forme d'abord, tous.
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
  END IF;
  v_list := public._prospect_phone_list(p_phones, v_e164);
  IF v_list ? 'error' THEN
    RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
  END IF;
  SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
    INTO v_others
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  -- Puis, verrouillés, s'ils sont libres : le principal, puis les autres.
  PERFORM public._prospect_lock_numbers(v_e164 || v_others);
  v_conflict := public._prospect_number_conflict(v_e164, v_src, NULL);
  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE v_conflict WHEN 'client' THEN 'Ce numéro est déjà celui d''un client Bonzini'
                      WHEN 'mine'   THEN 'Ce prospect est déjà dans votre liste'
                      ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
  END IF;
  v_err := public._prospect_numbers_error(v_others, v_src, NULL);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;

  -- Tout est bon : on écrit.
  INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes, next_action_at, created_by,
                                gender, birth_date, email, pain_points, help_needed)
  VALUES (v_src, btrim(p_first_name), btrim(p_last_name), nullif(btrim(coalesce(p_company, '')), ''),
          btrim(p_phone), v_e164, btrim(p_city),
          coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}'),
          nullif(btrim(coalesce(p_notes, '')), ''), p_next_action_at, v_uid,
          v_gender, p_birth_date, v_email, v_pain, v_help)
  RETURNING id INTO v_id;

  INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
  SELECT v_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Modifier un prospect
-- ─────────────────────────────────────────────────────────────────────────
-- NULL = inchangé, partout. Nom, ville, sexe : '' est refusé (obligatoires),
-- mais un prospect saisi avant le 06/10 sans eux reste modifiable tant
-- qu'on ne les envoie pas vides. '' efface un champ facultatif (entreprise,
-- email, notes, problèmes, aide) ; p_clear_birth_date efface la date de
-- naissance, p_clear_next_action la relance. p_phones non NULL = la liste
-- COMPLÈTE des autres numéros ([] = aucun). Un prospect « devenu client »
-- garde ses numéros (le compte client a été reconnu par l'un d'eux).
DROP FUNCTION IF EXISTS public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[]);

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
  p_interests TEXT[] DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_clear_birth_date BOOLEAN DEFAULT false,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_e164 TEXT;
  v_email TEXT := CASE WHEN p_email IS NULL THEN NULL ELSE nullif(lower(btrim(p_email)), '') END;
  v_clear_birth BOOLEAN := coalesce(p_clear_birth_date, false);
  v_current TEXT[];
  v_existing TEXT[];
  v_others TEXT[];
  v_new_others TEXT[];
  v_list JSONB;
  v_conflict TEXT;
  v_err TEXT;
BEGIN
  -- Verrouillée AVANT d'être lue : deux modifications simultanées passent l'une après l'autre.
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;

  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NOT NULL AND btrim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_gender IS NOT NULL AND upper(btrim(p_gender)) NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF p_city IS NOT NULL AND btrim(p_city) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  v_err := coalesce(CASE WHEN v_clear_birth THEN NULL ELSE public._birth_date_error(p_birth_date) END,
                    public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(btrim(coalesce(p_pain_points, ''))) > 2000 OR length(btrim(coalesce(p_help_needed, ''))) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Ses numéros d'avant : le principal, puis les autres.
  SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
    INTO v_current
    FROM public.prospect_phones WHERE prospect_id = p_id;
  v_existing := v_p.phone_e164 || v_current;

  -- Le principal.
  v_e164 := v_p.phone_e164;
  IF p_phone IS NOT NULL AND public._phone_e164(p_phone) IS DISTINCT FROM v_p.phone_e164 THEN
    IF v_p.status = 'won' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
    v_e164 := public._phone_e164(p_phone);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
    END IF;
  END IF;

  -- Les autres (liste complète), s'ils sont envoyés.
  IF p_phones IS NOT NULL THEN
    v_list := public._prospect_phone_list(p_phones, v_e164);
    IF v_list ? 'error' THEN
      RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
    END IF;
    SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
      INTO v_others
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
    -- Devenu client : la même liste (libellés et ordre mis à part) est acceptée, pas une autre.
    IF v_p.status = 'won'
       AND ARRAY(SELECT x FROM unnest(v_others) x ORDER BY x) IS DISTINCT FROM ARRAY(SELECT x FROM unnest(v_current) x ORDER BY x) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
  END IF;

  -- Seuls les numéros NOUVEAUX pour cette fiche sont vérifiés (comme le
  -- principal avant le 06/10 : vérifié quand il change), après verrou.
  v_new_others := ARRAY(SELECT n FROM unnest(coalesce(v_others, ARRAY[]::TEXT[])) n WHERE NOT n = ANY(v_existing));
  PERFORM public._prospect_lock_numbers(
    CASE WHEN v_e164 = ANY(v_existing) THEN ARRAY[]::TEXT[] ELSE ARRAY[v_e164] END || v_new_others);
  IF NOT v_e164 = ANY(v_existing) THEN
    v_conflict := public._prospect_number_conflict(v_e164, v_p.source_id, p_id);
    IF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error',
        CASE v_conflict WHEN 'client' THEN 'Ce numéro est déjà celui d''un client Bonzini'
                        WHEN 'mine'   THEN 'Ce numéro est déjà dans votre liste'
                        ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
    END IF;
  END IF;
  v_err := public._prospect_numbers_error(v_new_others, v_p.source_id, p_id);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;

  -- Tout est bon : on écrit.
  UPDATE public.prospects
     SET first_name  = coalesce(btrim(p_first_name), first_name),
         last_name   = CASE WHEN p_last_name IS NULL THEN last_name ELSE btrim(p_last_name) END,
         company     = CASE WHEN p_company IS NULL THEN company ELSE nullif(btrim(p_company), '') END,
         city        = CASE WHEN p_city IS NULL THEN city ELSE btrim(p_city) END,
         notes       = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(btrim(p_notes), '') END,
         phone       = CASE WHEN p_phone IS NULL THEN phone ELSE btrim(p_phone) END,
         phone_e164  = v_e164,
         interests   = CASE WHEN p_interests IS NULL THEN interests
                            ELSE coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}') END,
         next_action_at = CASE WHEN p_clear_next_action THEN NULL ELSE coalesce(p_next_action_at, next_action_at) END,
         gender      = CASE WHEN p_gender IS NULL THEN gender ELSE upper(btrim(p_gender)) END,
         birth_date  = CASE WHEN v_clear_birth THEN NULL ELSE coalesce(p_birth_date, birth_date) END,
         email       = CASE WHEN p_email IS NULL THEN email ELSE v_email END,
         pain_points = CASE WHEN p_pain_points IS NULL THEN pain_points ELSE nullif(btrim(p_pain_points), '') END,
         help_needed = CASE WHEN p_help_needed IS NULL THEN help_needed ELSE nullif(btrim(p_help_needed), '') END,
         updated_at  = now()
   WHERE id = p_id;

  IF p_phones IS NOT NULL THEN
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id;
    INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
    SELECT p_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
  ELSIF v_e164 IS DISTINCT FROM v_p.phone_e164 THEN
    -- Un autre numéro devenu le principal ne reste pas en double dans la liste.
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id AND phone_e164 = v_e164;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Rouvrir un prospect perdu : ses AUTRES numéros aussi
-- ─────────────────────────────────────────────────────────────────────────
-- Même fonction qu'au 05/10. En plus : un prospect « perdu » qu'on rouvre ne
-- doit pas reprendre un numéro (principal ou autre) devenu entre-temps celui
-- d'un client, ou suivi par un autre prospect ouvert.
CREATE OR REPLACE FUNCTION public.prospect_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
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
  IF v_p.status = 'lost' AND p_status <> 'lost' THEN
    SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
      INTO v_others
      FROM public.prospect_phones WHERE prospect_id = p_id;
    PERFORM public._prospect_lock_numbers(v_p.phone_e164 || v_others);
    v_conflict := public._prospect_number_conflict(v_p.phone_e164, v_p.source_id, p_id);
    IF v_conflict = 'client' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un client Bonzini');
    ELSIF v_conflict = 'mine' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un autre de vos prospects');
    ELSIF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
    END IF;
    v_err := public._prospect_numbers_error(v_others, v_p.source_id, p_id);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_err);
    END IF;
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

-- ─────────────────────────────────────────────────────────────────────────
-- 7. « Ce numéro est-il un prospect ? » — et toute sa fiche
-- ─────────────────────────────────────────────────────────────────────────
-- Pour le formulaire « Nouveau client » : le numéro tapé peut être le
-- principal du prospect OU l'un de ses autres numéros. La fiche revient
-- entière pour être reprise d'office (nom, numéros, entreprise, ville,
-- email, sexe, date de naissance). Même garde qu'au 05/10.
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
  v_p public.prospects;
  v_src public.client_sources;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canRegisterClients')
          OR public.admin_has_permission(v_uid, 'canEditClients')
          OR public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  SELECT p.* INTO v_p
    FROM public.prospects p
   WHERE p.status IN ('new','contacted','interested')
     AND (p.phone_e164 = v_e164
          OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = v_e164))
   ORDER BY (p.phone_e164 = v_e164) DESC, p.created_at
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE id = v_p.source_id;

  RETURN jsonb_build_object('success', true, 'found', true,
    'prospect_id', v_p.id,
    'prospect_name', btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, '')),
    'source_id', v_p.source_id, 'source_label', v_src.label, 'source_active', v_src.is_active,
    'first_name', v_p.first_name,
    'last_name', v_p.last_name,
    'company', v_p.company,
    'city', v_p.city,
    'email', v_p.email,
    'gender', v_p.gender,
    'birth_date', to_char(v_p.birth_date, 'YYYY-MM-DD'),
    'phone_e164', v_p.phone_e164,
    'phones', coalesce((
      SELECT jsonb_agg(jsonb_build_object('phone_e164', pp.phone_e164, 'country_iso', pp.country_iso, 'label', pp.label)
                       ORDER BY pp.position, pp.created_at)
        FROM public.prospect_phones pp WHERE pp.prospect_id = v_p.id), '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Attribution automatique : par l'un QUELCONQUE de ses numéros
-- ─────────────────────────────────────────────────────────────────────────
-- Dernière définition (20261005160000), à l'identique, sauf la recherche du
-- prospect : son principal OU l'un de ses autres numéros (le principal
-- d'abord). Toujours sans erreur ; le déclencheur prospect_match_client
-- (BEFORE INSERT OR UPDATE OF phone, source_id) et son nom, qui le font
-- passer après clients_guard_source et on_client_phone_sync_e164, ne
-- changent pas.
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
    SELECT p.* INTO v_p
      FROM public.prospects p
     WHERE p.status IN ('new','contacted','interested')
       AND (p.phone_e164 = NEW.phone_e164
            OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = NEW.phone_e164))
     ORDER BY (p.phone_e164 = NEW.phone_e164) DESC, p.created_at
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

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Client : sexe et date de naissance
-- ─────────────────────────────────────────────────────────────────────────
-- canEditClients : tout client. canRegisterClients seul (réception,
-- opérations) : seulement le client qu'on a soi-même enregistré
-- (« Enregistré par », posé par la session à la création, jamais réécrit),
-- sans limite de temps — deux champs, journalisés, comme l'origine posée par
-- la réception.
-- p_gender NULL = inchangé, sinon MALE / FEMALE ; p_date_of_birth NULL =
-- inchangée, p_clear_birth_date l'efface. Journalisée.
CREATE OR REPLACE FUNCTION public.admin_set_client_identity(
  p_user_id UUID,
  p_gender TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_clear_birth_date BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_can_edit BOOLEAN := public.admin_has_permission(v_uid, 'canEditClients');
  v_clear BOOLEAN := coalesce(p_clear_birth_date, false);
  v_client public.clients;
  v_gender TEXT;
  v_dob DATE;
  v_err TEXT;
BEGIN
  -- Sans aucun des deux droits : refusé avant même de chercher le client.
  IF NOT (v_can_edit OR public.admin_has_permission(v_uid, 'canRegisterClients')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_gender IS NOT NULL AND upper(btrim(p_gender)) NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF NOT v_clear THEN
    v_err := public._birth_date_error(p_date_of_birth);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_err);
    END IF;
  END IF;

  -- Verrouillée AVANT d'être lue.
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF NOT v_can_edit AND v_client.registered_by IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  v_gender := CASE WHEN p_gender IS NULL THEN v_client.gender ELSE upper(btrim(p_gender)) END;
  v_dob := CASE WHEN v_clear THEN NULL ELSE coalesce(p_date_of_birth, v_client.date_of_birth) END;

  IF v_gender IS NOT DISTINCT FROM v_client.gender AND v_dob IS NOT DISTINCT FROM v_client.date_of_birth THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true,
                              'gender', v_gender, 'date_of_birth', to_char(v_dob, 'YYYY-MM-DD'));
  END IF;

  UPDATE public.clients
     SET gender = v_gender, date_of_birth = v_dob, updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_client_identity', 'client', p_user_id, jsonb_build_object(
    'before', jsonb_build_object('gender', v_client.gender, 'date_of_birth', v_client.date_of_birth),
    'after',  jsonb_build_object('gender', v_gender, 'date_of_birth', v_dob)));

  RETURN jsonb_build_object('success', true, 'gender', v_gender, 'date_of_birth', to_char(v_dob, 'YYYY-MM-DD'));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Droits
-- ─────────────────────────────────────────────────────────────────────────
-- Internes : jamais appelables depuis l'API (les RPC ci-dessous, SECURITY
-- DEFINER, les appellent avec les droits de leur propriétaire).
REVOKE ALL ON FUNCTION public._birth_date_error(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._email_error(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_phone_list(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_lock_numbers(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_number_conflict(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_numbers_error(TEXT[], UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clients_match_prospect() FROM PUBLIC, anon, authenticated;

-- Les actions : membres du personnel connectés ; chaque RPC vérifie la permission.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text)',
    'public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text)',
    'public.prospect_set_status(uuid, text, text)',
    'public.prospect_lookup_phone(text)',
    'public.admin_set_client_identity(uuid, text, date, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Les anciennes signatures de prospect_create / prospect_update ont été
-- supprimées avec leur étiquette : les nouvelles en reçoivent une à jour.
COMMENT ON FUNCTION public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Ajouter un prospect pour un commercial — obligatoires : prénom, nom, sexe (p_gender MALE ou FEMALE), ville au Cameroun, numéro principal (+237…) ; facultatifs : autres numéros (p_phones [{phone_e164, country_iso, label}], neuf au plus), entreprise, date de naissance (AAAA-MM-JJ, 16 à 110 ans), email, intérêts (payments / air / sea), ses plus gros problèmes aujourd''hui (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed)"}';
COMMENT ON FUNCTION public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Modifier un prospect (NULL = inchangé) : nom, sexe (MALE / FEMALE) et ville ne se vident pas ; numéro principal, autres numéros (p_phones = la liste complète, [] = aucun), entreprise, date de naissance (p_clear_birth_date l''efface), email, ses plus gros problèmes (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed), notes, date de relance"}';
COMMENT ON FUNCTION public.prospect_set_status(uuid, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Changer le statut d''un prospect (new, contacted, interested, lost avec motif)"}';
COMMENT ON FUNCTION public.prospect_lookup_phone(text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canRegisterClients","label":"Ce numéro (principal ou autre) est-il le prospect d''un commercial ? Renvoie son commercial et sa fiche (nom, entreprise, ville, email, sexe, date de naissance, numéros) pour un nouveau client"}';
COMMENT ON FUNCTION public.admin_set_client_identity(uuid, text, date, boolean) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Renseigner le sexe et la date de naissance d''un client","resolve":{"p_user_id":"client"}}';
COMMENT ON FUNCTION public.clients_match_prospect() IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","label":"Interne : attribution d''un nouveau client au commercial qui l''a prospecté (par l''un de ses numéros)"}';
COMMENT ON FUNCTION public._birth_date_error(date) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : date de naissance (16 à 110 ans)"}';
COMMENT ON FUNCTION public._email_error(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : forme d''une adresse email"}';
COMMENT ON FUNCTION public._prospect_phone_list(jsonb, text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : la liste des autres numéros d''un prospect, nettoyée"}';
COMMENT ON FUNCTION public._prospect_lock_numbers(text[]) IS
  '@mola:{"expose":false,"kind":"write","permission":"canProspect","label":"Interne : verrou des numéros saisis (deux saisies simultanées)"}';
COMMENT ON FUNCTION public._prospect_number_conflict(text, uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : ce numéro est-il celui d''un client ou d''un prospect ouvert"}';
COMMENT ON FUNCTION public._prospect_numbers_error(text[], uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : le premier des autres numéros déjà pris, dit en clair"}';

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- SECTION 3 — Partie C : copie conforme de 20261007100000_prospect_client_control.sql
-- ############################################################################
-- ============================================================================
-- Prospects : numéro déjà client (« À vérifier ») · Le super admin passe un
-- prospect en client, et un client sans aucune opération en prospect
--
-- Le 07/10/2026, le directeur (super admin) :
--
--   1. CLOISONNEMENT — le commercial n'a accès qu'à SES clients et à SES
--      prospects, jamais à la base des clients. C'est déjà le cas depuis le
--      05/10 (is_admin() l'exclut ; ses lectures passent par des RPC limitées
--      à sa fiche) : cette migration n'ouvre RIEN. La nouvelle table des
--      fiches « à vérifier » ne lui est jamais lisible (RLS : canManageSales
--      seulement), et la vérification d'un numéro pendant la saisie
--      (prospect_phone_check) ne dit rien du client — seulement ce que
--      prospect_create lui dirait déjà.
--   2. NUMÉRO DÉJÀ CLIENT — un commercial saisit un numéro (principal ou
--      autre) qui est déjà celui d'un client Bonzini. Il ne sait pas de quel
--      client il s'agit (les noms sont souvent imprécis : c'est LE NUMÉRO qui
--      reconnaît le client) et remplit sa fiche normalement. Avant : refusé.
--      Désormais :
--        · le client est l'un de SES clients (origine = sa fiche) → refusé,
--          « Le numéro X est déjà celui d'un de vos clients » ;
--        · un AUTRE client → la fiche est enregistrée au statut particulier
--          « À vérifier » (to_verify), une vérification est ouverte par client
--          reconnu (prospect_client_claims), et le super admin est notifié
--          (c'est peut-être que le commercial a rencontré ce client et l'a
--          convaincu). La réponse porte to_verify: true.
--      Le super admin tranche (prospect_resolve_claim) : ATTRIBUER ce client
--      au commercial (son origine passe à la fiche du commercial, le prospect
--      devient « devenu client » ; un ancien prospect « devenu client » de ce
--      client est détaché ; les autres commerciaux qui l'avaient aussi saisi
--      sont prévenus) ou REFUSER (le prospect passe « perdu »). Le commercial
--      concerné reçoit une notification. Tant que la direction n'a pas
--      tranché, le commercial ne change pas le statut de la fiche (il peut
--      en modifier les autres champs).
--      « À vérifier » n'est pas un statut ouvert : il n'entre ni dans l'index
--      des numéros suivis, ni dans les compteurs « ouverts » / « à relancer »
--      des tableaux de bord, ni dans l'attribution automatique d'un nouveau
--      client (clients_match_prospect, inchangé : il ne lit que new /
--      contacted / interested). Un numéro d'une fiche « À vérifier » reste
--      en revanche « suivi » pour les autres saisies (pas de doublon).
--   3. PROSPECT ↔ CLIENT PAR LE SUPER ADMIN —
--        · prospect → client : le formulaire « Nouveau client » existant,
--          pré-rempli depuis la fiche prospect (prospect_lookup_phone, déjà
--          en place) ; le déclencheur clients_match_prospect attribue le
--          compte et passe le prospect « devenu client ». Rien à ajouter ici.
--        · client → prospect (admin_client_to_prospect) : SEULEMENT pour un
--          client qui n'a fait AUCUNE opération (ni dépôt, ni paiement, ni
--          écriture au grand livre, ni ajustement, solde nul, aucun découvert,
--          aucun colis, envoi cargo ou dossier de douane), sans fiche « à
--          vérifier » en attente. Un instantané complet du client part dans
--          le journal d'audit, son compte est supprimé (admin_delete_client),
--          puis son ancien prospect est rouvert, ou un prospect est créé avec
--          ses coordonnées, chez le commercial choisi, qui est notifié.
--          admin_client_prospect_eligibility dit à l'écran ce qui bloque.
--      Les deux sens demandent canManageUsers ET canManageSales (le super
--      admin aujourd'hui).
--
-- Mêmes règles que le 06/10 : tout est vérifié AVANT d'écrire, les numéros
-- saisis sont verrouillés (advisory locks), les lignes lues puis écrites sont
-- verrouillées (FOR UPDATE) avant d'être lues. Les notifications ne font
-- jamais échouer une opération.
--
-- Idempotente (rejouable sans dégât, y compris deux fois dans une même
-- transaction). Suppose 20261005160000 (Mes équipes + commerciaux),
-- 20261006120000 (fiche prospect complète), 20260926100000 (notifications du
-- personnel, send_staff_push) et admin_delete_client (20260831160000).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le statut « À vérifier »
-- ─────────────────────────────────────────────────────────────────────────
-- La contrainte d'origine (05/10) est anonyme dans CREATE TABLE : Postgres
-- l'a nommée prospects_status_check. On retire toute contrainte de statut
-- qui ne connaît pas to_verify, puis on pose la nouvelle, nommée.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.prospects'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%status%'
       AND pg_get_constraintdef(oid) LIKE '%''won''%'
       AND pg_get_constraintdef(oid) NOT LIKE '%''to_verify''%'
  LOOP
    EXECUTE format('ALTER TABLE public.prospects DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.prospects'::regclass AND conname = 'prospects_status_check') THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
      CHECK (status IN ('new', 'contacted', 'interested', 'to_verify', 'won', 'lost'));
  END IF;
END $$;

COMMENT ON COLUMN public.prospects.status IS
  'new / contacted / interested (ouverts) · to_verify (un numéro est déjà celui d''un client : la direction tranche) · won (devenu client) · lost (perdu, avec motif).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les vérifications : « ce numéro saisi par un commercial est celui de
--    tel client »
-- ─────────────────────────────────────────────────────────────────────────
-- Une ligne par (prospect, client reconnu). Lue par la direction seulement :
-- le commercial n'y a JAMAIS accès (il ne doit pas savoir de quel client il
-- s'agit). Aucune politique d'écriture : tout passe par les RPC.
CREATE TABLE IF NOT EXISTS public.prospect_client_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id    UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Le numéro saisi qui a reconnu le client (le premier, s'il y en a plusieurs).
  matched_phone  TEXT NOT NULL CHECK (matched_phone ~ '^\+[1-9][0-9]{7,14}$'),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attributed', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note           TEXT CHECK (note IS NULL OR length(note) <= 300),
  UNIQUE (prospect_id, client_user_id)
);
-- La dernière fois que la DIRECTION a refusé ce client pour cette fiche :
-- gardée quand la vérification se rouvre (le commercial ressaisit le numéro),
-- pour que la direction le voie (« Déjà refusé le … »). Les autres clôtures
-- (numéro retiré, client attribué ailleurs, compte supprimé) ne la posent pas.
ALTER TABLE public.prospect_client_claims ADD COLUMN IF NOT EXISTS direction_rejected_at TIMESTAMPTZ;
-- « Qu'est-ce qui attend la direction ? » et « ce client est-il réclamé ? »
CREATE INDEX IF NOT EXISTS prospect_client_claims_pending_idx
  ON public.prospect_client_claims (client_user_id, created_at) WHERE status = 'pending';

ALTER TABLE public.prospect_client_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Direction reads prospect claims" ON public.prospect_client_claims;
CREATE POLICY "Direction reads prospect claims" ON public.prospect_client_claims
  FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageSales'));

-- Les droits par défaut de Supabase ouvrent tout à anon et authenticated :
-- on les retire, puis on rend la seule lecture (filtrée par la RLS).
REVOKE ALL ON TABLE public.prospect_client_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.prospect_client_claims TO authenticated;
GRANT ALL ON TABLE public.prospect_client_claims TO service_role;

COMMENT ON TABLE public.prospect_client_claims IS
  'Fiches « À vérifier » : un numéro saisi par un commercial est déjà celui d''un client Bonzini. Lue par la direction (canManageSales) seulement ; écrite par prospect_create / prospect_update / prospect_resolve_claim.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Règles communes (internes)
-- ─────────────────────────────────────────────────────────────────────────
-- Ce numéro est-il pris ? Même signature qu'au 06/10, une réponse de plus :
--   'own_client' : celui d'un client dont l'origine est CETTE fiche commercial ;
--   'client'     : celui d'un AUTRE client Bonzini (la fiche partira « À vérifier ») ;
--   'mine'       : suivi par un autre prospect de cette fiche (ouvert ou à vérifier) ;
--   'other'      : suivi par un prospect d'une autre fiche (ouvert ou à vérifier) ;
--   NULL         : libre. p_except : le prospect qu'on modifie.
-- Un numéro de client déjà saisi dans la liste du même commercial répond
-- 'mine' (pas de seconde fiche « à vérifier » pour le même client).
CREATE OR REPLACE FUNCTION public._prospect_number_conflict(p_e164 TEXT, p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cl AS (
    SELECT c.source_id FROM public.clients c WHERE c.phone_e164 = p_e164
    UNION ALL
    SELECT c.source_id
      FROM public.client_phones cp JOIN public.clients c ON c.id = cp.client_id
     WHERE cp.phone_e164 = p_e164
  ), h AS (
    SELECT p.source_id
      FROM public.prospects p
     WHERE p.phone_e164 = p_e164
       AND p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM p_except
    UNION ALL
    SELECT p.source_id
      FROM public.prospect_phones pp
      JOIN public.prospects p ON p.id = pp.prospect_id
     WHERE pp.phone_e164 = p_e164
       AND p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM p_except
  )
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM cl WHERE cl.source_id = p_source_id) THEN 'own_client'
           WHEN EXISTS (SELECT 1 FROM cl) THEN
             CASE WHEN EXISTS (SELECT 1 FROM h WHERE h.source_id = p_source_id) THEN 'mine' ELSE 'client' END
           WHEN EXISTS (SELECT 1 FROM h WHERE h.source_id IS DISTINCT FROM p_source_id) THEN 'other'
           WHEN EXISTS (SELECT 1 FROM h) THEN 'mine'
         END
$$;

-- Le premier des numéros donnés qui est REFUSÉ, dit en clair ; NULL si aucun.
-- p_client_ok : le numéro d'un autre client n'est pas un refus (saisie d'un
-- commercial : la fiche part « À vérifier ») ; il l'est pour rouvrir un
-- prospect perdu.
CREATE OR REPLACE FUNCTION public._prospect_numbers_refusal(p_numbers TEXT[], p_source_id UUID, p_except UUID, p_client_ok BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n TEXT;
  v_c TEXT;
BEGIN
  FOREACH v_n IN ARRAY coalesce(p_numbers, ARRAY[]::TEXT[]) LOOP
    v_c := public._prospect_number_conflict(v_n, p_source_id, p_except);
    IF v_c = 'own_client' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà celui d''un de vos clients';
    ELSIF v_c = 'client' AND NOT coalesce(p_client_ok, false) THEN
      RETURN 'Le numéro ' || v_n || ' est déjà celui d''un client Bonzini';
    ELSIF v_c = 'other' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà suivi par un autre commercial';
    ELSIF v_c = 'mine' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà dans votre liste';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Même signature qu'au 06/10 (rouvrir un prospect perdu) : le numéro d'un
-- client y reste un refus.
CREATE OR REPLACE FUNCTION public._prospect_numbers_error(p_numbers TEXT[], p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._prospect_numbers_refusal(p_numbers, p_source_id, p_except, false)
$$;

-- Les clients reconnus par ces numéros (principal OU autre numéro du
-- client), un par client, avec le premier numéro saisi qui l'a reconnu ;
-- jamais les clients de la fiche p_source_id (ceux-là sont refusés plus haut).
CREATE OR REPLACE FUNCTION public._prospect_client_matches(p_numbers TEXT[], p_source_id UUID)
RETURNS TABLE (client_user_id UUID, matched_phone TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, m.phone
    FROM (
      SELECT DISTINCT ON (x.user_id) x.user_id, x.phone, x.ord
        FROM (
          SELECT c.user_id, c.source_id, n.phone, n.ord
            FROM unnest(coalesce(p_numbers, ARRAY[]::TEXT[])) WITH ORDINALITY AS n(phone, ord)
            JOIN public.clients c ON c.phone_e164 = n.phone
          UNION ALL
          SELECT c.user_id, c.source_id, n.phone, n.ord
            FROM unnest(coalesce(p_numbers, ARRAY[]::TEXT[])) WITH ORDINALITY AS n(phone, ord)
            JOIN public.client_phones cp ON cp.phone_e164 = n.phone
            JOIN public.clients c ON c.id = cp.client_id
        ) x
       WHERE x.user_id IS NOT NULL
         AND x.source_id IS DISTINCT FROM p_source_id
       ORDER BY x.user_id, x.ord
    ) m
   ORDER BY m.ord, m.user_id
$$;

-- Notification ciblée : les téléphones d'UNE personne du personnel (active),
-- sur le modèle de send_staff_push. Interne ; ne fait JAMAIS échouer
-- l'opération métier (une notification ratée se lit dans les journaux).
CREATE OR REPLACE FUNCTION public.send_staff_push_user(p_user_id UUID, p_title TEXT, p_body TEXT, p_path TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_msgs JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
           'to', d.expo_token,
           'title', p_title,
           'body', p_body,
           'data', jsonb_build_object('path', p_path),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default'))
    INTO v_msgs
    FROM public.staff_push_devices d
   WHERE d.user_id = p_user_id
     AND EXISTS (SELECT 1 FROM public.user_roles r
                  WHERE r.user_id = d.user_id AND (r.is_disabled = false OR r.is_disabled IS NULL));
  IF v_msgs IS NULL THEN
    RETURN 0;
  END IF;
  -- Une personne a quelques téléphones : bien moins que les 100 messages
  -- qu'accepte une requête à l'API Expo.
  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_msgs,
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN jsonb_array_length(v_msgs);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'send_staff_push_user: %', SQLERRM;
  RETURN 0;
END;
$$;

-- Ouvre (ou rouvre) une vérification par client reconnu, puis prévient le
-- super admin s'il y a du nouveau. Appelée APRÈS l'écriture de la fiche, une
-- fois tout validé. Renvoie le nombre de vérifications ouvertes.
CREATE OR REPLACE FUNCTION public._prospect_claim_clients(p_prospect_id UUID, p_numbers TEXT[], p_source_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
  v_phone TEXT;
  v_p public.prospects;
  v_label TEXT;
BEGIN
  WITH ins AS (
    INSERT INTO public.prospect_client_claims AS k (prospect_id, client_user_id, matched_phone, created_by)
    SELECT p_prospect_id, m.client_user_id, m.matched_phone, auth.uid()
      FROM public._prospect_client_matches(p_numbers, p_source_id) m
    ON CONFLICT (prospect_id, client_user_id) DO UPDATE
       SET status = 'pending', matched_phone = EXCLUDED.matched_phone, created_at = now(),
           created_by = EXCLUDED.created_by, resolved_at = NULL, resolved_by = NULL, note = NULL
     WHERE k.status <> 'pending'
    RETURNING k.id
  )
  SELECT count(*)::int INTO v_n FROM ins;

  IF v_n > 0 THEN
    BEGIN
      SELECT m.matched_phone INTO v_phone FROM public._prospect_client_matches(p_numbers, p_source_id) m LIMIT 1;
      SELECT * INTO v_p FROM public.prospects WHERE id = p_prospect_id;
      SELECT label INTO v_label FROM public.client_sources WHERE id = v_p.source_id;
      PERFORM public.send_staff_push('canManageSales', 'Numéro déjà client',
        coalesce(v_label, 'Un commercial') || ' a saisi ' || btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, ''))
          || ' (' || v_phone || ') : déjà client Bonzini — à vérifier',
        '/m/equipe/ventes/a-verifier', ARRAY['super_admin'], auth.uid());
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '_prospect_claim_clients (notification) : %', SQLERRM;
    END;
  END IF;
  RETURN v_n;
END;
$$;

-- Une fiche « À vérifier » qui n'attend plus AUCUNE vérification sur un
-- client existant (le commercial a retiré ou corrigé le numéro ; le compte du
-- client a été supprimé) ne reste pas figée : ses vérifications encore « en
-- attente » sont closes, ses numéros revérifiés comme pour rouvrir une fiche
-- perdue, puis elle redevient « À contacter » — ou « Perdu » si l'un d'eux
-- est celui d'un client, ou suivi ailleurs. Renvoie le nouveau statut, NULL
-- si la fiche ne change pas. p_notify : prévenir le commercial (quand ce
-- n'est pas lui qui agit). Appelée sous le verrou de la fiche ou le prend.
CREATE OR REPLACE FUNCTION public._prospect_release_if_unclaimed(p_prospect_id UUID, p_notify BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_numbers TEXT[];
  v_n TEXT;
  v_c TEXT;
  v_conflict TEXT;
  v_status TEXT := 'new';
  v_reason TEXT;
BEGIN
  SELECT * INTO v_p FROM public.prospects WHERE id = p_prospect_id FOR UPDATE;
  IF NOT FOUND OR v_p.status <> 'to_verify' THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.prospect_client_claims k
               JOIN public.clients c ON c.user_id = k.client_user_id
              WHERE k.prospect_id = p_prospect_id AND k.status = 'pending') THEN
    RETURN NULL;
  END IF;

  -- Ce qui reste « en attente » vise un compte qui n'existe plus.
  UPDATE public.prospect_client_claims
     SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), note = 'Compte client supprimé'
   WHERE prospect_id = p_prospect_id AND status = 'pending';

  -- Ses numéros, verrouillés puis revérifiés (comme une réouverture).
  SELECT v_p.phone_e164 || coalesce(array_agg(pp.phone_e164 ORDER BY pp.position, pp.created_at), ARRAY[]::TEXT[])
    INTO v_numbers
    FROM public.prospect_phones pp WHERE pp.prospect_id = p_prospect_id;
  PERFORM public._prospect_lock_numbers(v_numbers);
  FOREACH v_n IN ARRAY v_numbers LOOP
    v_c := public._prospect_number_conflict(v_n, v_p.source_id, p_prospect_id);
    IF v_c IS NOT NULL THEN
      v_conflict := v_c;
      EXIT;
    END IF;
  END LOOP;
  IF v_conflict IS NOT NULL THEN
    v_status := 'lost';
    v_reason := CASE v_conflict
                  WHEN 'own_client' THEN 'Déjà un de vos clients'
                  WHEN 'client'     THEN 'Déjà client de Bonzini'
                  WHEN 'mine'       THEN 'Doublon d''un autre de vos prospects'
                  ELSE 'Déjà suivi par un autre commercial' END;
  END IF;

  BEGIN
    UPDATE public.prospects
       SET status = v_status, lost_reason = v_reason, status_changed_at = now(), updated_at = now()
     WHERE id = p_prospect_id;
  EXCEPTION WHEN unique_violation THEN
    -- Son numéro principal est repris par un prospect ouvert (index des numéros suivis).
    v_status := 'lost';
    v_reason := 'Déjà suivi par un autre commercial';
    UPDATE public.prospects
       SET status = v_status, lost_reason = v_reason, status_changed_at = now(), updated_at = now()
     WHERE id = p_prospect_id;
  END;

  IF coalesce(p_notify, false) THEN
    PERFORM public.send_staff_push_user(
      (SELECT staff_user_id FROM public.client_sources WHERE id = v_p.source_id),
      CASE WHEN v_status = 'new' THEN 'Fiche rouverte' ELSE 'Fiche classée' END,
      btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, ''))
        || CASE WHEN v_status = 'new' THEN ' : la vérification est close, la fiche est de nouveau à contacter'
                ELSE ' : vérification close, fiche classée (' || v_reason || ')' END,
      '/v/prospects/' || p_prospect_id);
  END IF;
  RETURN v_status;
END;
$$;

-- Ce qui empêche de repasser un client en prospect, en clair (vide = rien).
-- « Aucune transaction » au sens large : la moindre trace d'activité bloque.
CREATE OR REPLACE FUNCTION public._client_prospect_blockers(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b TEXT[] := ARRAY[]::TEXT[];
  v_client public.clients;
  v_n BIGINT;
  v_bal BIGINT;
  v_od BIGINT;
  r RECORD;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    v_b := v_b || 'Compte du personnel, pas un client'::TEXT;
  END IF;

  -- L'argent : dépôts (tous statuts), paiements, grand livre, ajustements, solde, découvert.
  SELECT count(*) INTO v_n FROM public.deposits WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'dépôts' ELSE 'dépôt' END); END IF;
  SELECT count(*) INTO v_n FROM public.payments WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'paiements' ELSE 'paiement' END); END IF;
  SELECT count(*) INTO v_n FROM public.ledger_entries WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'écritures au grand livre' ELSE 'écriture au grand livre' END); END IF;
  SELECT count(*) INTO v_n FROM public.wallet_adjustments WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'ajustements de solde' ELSE 'ajustement de solde' END); END IF;
  SELECT sum(balance_xaf), max(overdraft_limit_xaf) INTO v_bal, v_od FROM public.wallets WHERE user_id = p_user_id;
  IF coalesce(v_bal, 0) <> 0 THEN
    v_b := v_b || ('Solde de ' || replace(to_char(v_bal, 'FM999,999,999,999,999'), ',', ' ') || ' XAF');
  END IF;
  IF coalesce(v_od, 0) > 0 THEN
    v_b := v_b || ('Découvert accordé (' || replace(to_char(v_od, 'FM999,999,999,999,999'), ',', ' ') || ' XAF)');
  END IF;

  -- Colis, cargo, douane : lus seulement si la table (et sa colonne) existe.
  FOR r IN
    SELECT * FROM (VALUES
      ('payment_batches',          'user_id',        false, 'lot de paiements',                       'lots de paiements'),
      ('parcel_deposits',          'client_user_id', false, 'dépôt de colis',                         'dépôts de colis'),
      ('parcel_releases',          'client_user_id', false, 'bon de retrait de colis',                'bons de retrait de colis'),
      ('cargo_shipments',          'client_id',      true,  'conteneur à son nom',                    'conteneurs à son nom'),
      ('cargo_packages',           'client_id',      true,  'lot de marchandise en conteneur',        'lots de marchandise en conteneur'),
      ('customs_classifications',  'client_user_id', false, 'classement en douane',                   'classements en douane'),
      ('customs_audits',           'client_user_id', false, 'audit de déclaration en douane',         'audits de déclaration en douane'),
      ('customs_supplier_invites', 'client_user_id', false, 'demande de documents à un fournisseur',  'demandes de documents à des fournisseurs')
    ) AS t(tbl, col, by_client_id, one, many)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = to_regclass('public.' || r.tbl) AND a.attname = r.col
                  AND a.attnum > 0 AND NOT a.attisdropped) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tbl, r.col)
        INTO v_n
        USING CASE WHEN r.by_client_id THEN v_client.id ELSE p_user_id END;
      IF v_n > 0 THEN
        v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN r.many ELSE r.one END);
      END IF;
    END IF;
  END LOOP;

  -- Une fiche « à vérifier » d'un commercial attend une décision sur ce client.
  SELECT count(*) INTO v_n
    FROM public.prospect_client_claims k
    JOIN public.prospects p ON p.id = k.prospect_id
   WHERE k.client_user_id = p_user_id AND k.status = 'pending' AND p.status = 'to_verify';
  IF v_n = 1 THEN
    v_b := v_b || 'Une fiche « À vérifier » d''un commercial attend votre décision sur ce client'::TEXT;
  ELSIF v_n > 1 THEN
    v_b := v_b || (v_n || ' fiches « À vérifier » de commerciaux attendent votre décision sur ce client');
  END IF;

  -- Le prospect a besoin d'un numéro principal au format international.
  IF v_client.user_id IS NOT NULL
     AND coalesce(public._phone_e164(v_client.phone_e164), public._phone_e164(v_client.phone)) IS NULL THEN
    v_b := v_b || 'Numéro principal absent ou sans indicatif (+237…) : corrigez-le d''abord'::TEXT;
  END IF;

  RETURN v_b;
END;
$$;

-- Ce que la suppression du compte efface AUSSI et que les blocages ne
-- retiennent pas (ce ne sont pas des opérations), recensé d'après les clés
-- étrangères (ON DELETE CASCADE vers auth.users ou clients) et
-- admin_delete_client :
--   · beneficiaries        ses bénéficiaires (comptes de ses fournisseurs :
--                          Alipay, WeChat, banque) — lignes complètes ;
--   · chat_conversations + chat_messages   ses échanges avec le support —
--                          conversations et messages complets (les images
--                          restent dans le stockage : leur adresse est gardée),
--                          plus un résumé (support) pour l'écran ;
--   · auth.users / identities   son compte de connexion : email, téléphone,
--                          dates, moyens de connexion (jamais le mot de passe) ;
--   · prospect_client_claims    les décisions déjà prises sur lui (fiches
--                          « À vérifier » tranchées).
-- La fiche clients entière et ses numéros sont pris par l'appelant. Le reste
-- ne se garde pas : opérations (bloquantes, donc absentes), portefeuille à
-- zéro (bloquant sinon), notifications, vérifications de numéro par SMS,
-- clés d'accès (passkeys) — technique, sans valeur une fois le compte parti.
-- Les dossiers de douane sont bloquants ; les documents des fournisseurs
-- n'existent pas sans dossier. Chaque partie n'est lue que si sa table (et
-- ses colonnes) existe.
CREATE OR REPLACE FUNCTION public._client_erasable_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_benef JSONB := '[]'::jsonb;
  v_support JSONB := jsonb_build_object('conversations', 0, 'messages', 0);
  v_convs JSONB := '[]'::jsonb;
  v_account JSONB;
  v_claims JSONB := '[]'::jsonb;
BEGIN
  SELECT id INTO v_client_id FROM public.clients WHERE user_id = p_user_id;
  BEGIN
    EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(b)), ''[]''::jsonb) FROM public.beneficiaries b WHERE b.client_id = $1'
      INTO v_benef USING p_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_benef := '[]'::jsonb;
  END;
  IF v_client_id IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT jsonb_build_object(''conversations'', count(DISTINCT c.id), ''messages'', count(m.id),
                                        ''first_message_at'', min(m.created_at), ''last_message_at'', max(m.created_at))
                 FROM public.chat_conversations c LEFT JOIN public.chat_messages m ON m.conversation_id = c.id
                WHERE c.client_id = $1'
        INTO v_support USING v_client_id;
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(''messages'',
                        coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at, m.id)
                                    FROM public.chat_messages m WHERE m.conversation_id = c.id), ''[]''::jsonb))
                      ORDER BY c.id), ''[]''::jsonb)
                 FROM public.chat_conversations c WHERE c.client_id = $1'
        INTO v_convs USING v_client_id;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      v_support := jsonb_build_object('conversations', 0, 'messages', 0);
      v_convs := '[]'::jsonb;
    END;
  END IF;
  -- Le compte de connexion : quelques champs choisis (pas de secret).
  BEGIN
    SELECT jsonb_build_object('email', u.j -> 'email', 'phone', u.j -> 'phone',
                              'created_at', u.j -> 'created_at', 'last_sign_in_at', u.j -> 'last_sign_in_at',
                              'email_confirmed_at', u.j -> 'email_confirmed_at',
                              'providers', (SELECT coalesce(jsonb_agg(DISTINCT i.provider), '[]'::jsonb)
                                              FROM auth.identities i WHERE i.user_id = p_user_id))
      INTO v_account
      FROM (SELECT to_jsonb(au) AS j FROM auth.users au WHERE au.id = p_user_id) u;
  EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
    v_account := NULL;
  END;
  SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.created_at, k.id), '[]'::jsonb)
    INTO v_claims
    FROM public.prospect_client_claims k WHERE k.client_user_id = p_user_id;
  RETURN jsonb_build_object('beneficiaries', v_benef, 'support', v_support, 'support_conversations', v_convs,
                            'account', v_account, 'prospect_claims', v_claims);
END;
$$;

-- Pour l'écran : ce qui sera effacé avec le compte sans bloquer (ce ne sont
-- pas des opérations), en clair, pour que la direction décide en
-- connaissance de cause. Vide = rien de tel.
CREATE OR REPLACE FUNCTION public._client_prospect_warnings(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w TEXT[] := ARRAY[]::TEXT[];
  v_client JSONB;
  v_data JSONB := public._client_erasable_data(p_user_id);
  v_n BIGINT;
BEGIN
  SELECT to_jsonb(c) INTO v_client FROM public.clients c WHERE c.user_id = p_user_id;
  v_n := jsonb_array_length(v_data -> 'beneficiaries');
  IF v_n > 0 THEN
    v_w := v_w || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'bénéficiaires enregistrés' ELSE 'bénéficiaire enregistré' END
                   || ' (comptes de ses fournisseurs)');
  END IF;
  v_n := coalesce((v_data -> 'support' ->> 'messages')::bigint, 0);
  IF coalesce((v_data -> 'support' ->> 'conversations')::bigint, 0) > 0 THEN
    v_w := v_w || ('Sa conversation avec le support'
                   || CASE WHEN v_n > 0 THEN ' (' || v_n || ' ' || CASE WHEN v_n > 1 THEN 'messages' ELSE 'message' END || ')' ELSE '' END);
  END IF;
  IF coalesce((v_client ->> 'kyc_verified')::boolean, false) THEN
    v_w := v_w || 'Son identité vérifiée (KYC)'::TEXT;
  END IF;
  IF length(btrim(coalesce(v_client ->> 'notes', ''))) > 0 THEN
    v_w := v_w || 'Les notes de l''équipe sur ce client'::TEXT;
  END IF;
  RETURN v_w;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Ajouter un prospect (même signature qu'au 06/10)
-- ─────────────────────────────────────────────────────────────────────────
-- Seul changement : le numéro (principal ou autre) d'un AUTRE client
-- Bonzini n'est plus refusé — la fiche part « À vérifier » et la direction
-- est prévenue ; celui d'un de SES clients est refusé.
CREATE OR REPLACE FUNCTION public.prospect_create(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
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
  v_gender TEXT := upper(btrim(coalesce(p_gender, '')));
  v_email TEXT := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_pain TEXT := nullif(btrim(coalesce(p_pain_points, '')), '');
  v_help TEXT := nullif(btrim(coalesce(p_help_needed, '')), '');
  v_list JSONB;
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
  v_to_verify BOOLEAN;
  v_id UUID;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_src AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée ou introuvable');
  END IF;

  -- Qui : prénom, nom, sexe, ville — obligatoires.
  IF length(btrim(coalesce(p_first_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF length(btrim(coalesce(p_last_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF v_gender NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF length(btrim(coalesce(p_city, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  -- Facultatifs, mais justes s'ils sont donnés.
  v_err := coalesce(public._birth_date_error(p_birth_date), public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(v_pain) > 2000 OR length(v_help) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Les numéros : la forme d'abord, tous.
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
  END IF;
  v_list := public._prospect_phone_list(p_phones, v_e164);
  IF v_list ? 'error' THEN
    RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
  END IF;
  SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
    INTO v_others
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  -- Puis, verrouillés : le principal, puis les autres. Un refus (le numéro
  -- d'un de SES clients, déjà dans sa liste, suivi par un autre commercial)
  -- arrête tout ; le numéro d'un AUTRE client fait partir la fiche « À vérifier ».
  PERFORM public._prospect_lock_numbers(v_e164 || v_others);
  v_conflict := public._prospect_number_conflict(v_e164, v_src, NULL);
  IF v_conflict IS NOT NULL AND v_conflict <> 'client' THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE v_conflict WHEN 'own_client' THEN 'Le numéro ' || v_e164 || ' est déjà celui d''un de vos clients'
                      WHEN 'mine'       THEN 'Ce prospect est déjà dans votre liste'
                      ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
  END IF;
  v_err := public._prospect_numbers_refusal(v_others, v_src, NULL, true);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  v_to_verify := EXISTS (SELECT 1 FROM public._prospect_client_matches(v_e164 || v_others, v_src));

  -- Tout est bon : on écrit.
  INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes, next_action_at, created_by,
                                gender, birth_date, email, pain_points, help_needed, status)
  VALUES (v_src, btrim(p_first_name), btrim(p_last_name), nullif(btrim(coalesce(p_company, '')), ''),
          btrim(p_phone), v_e164, btrim(p_city),
          coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}'),
          nullif(btrim(coalesce(p_notes, '')), ''), p_next_action_at, v_uid,
          v_gender, p_birth_date, v_email, v_pain, v_help,
          CASE WHEN v_to_verify THEN 'to_verify' ELSE 'new' END)
  RETURNING id INTO v_id;

  INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
  SELECT v_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  IF v_to_verify THEN
    PERFORM public._prospect_claim_clients(v_id, v_e164 || v_others, v_src);
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'to_verify', v_to_verify);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Modifier un prospect (même signature qu'au 06/10)
-- ─────────────────────────────────────────────────────────────────────────
-- Seuls les numéros NOUVEAUX pour la fiche sont vérifiés (comme au 06/10).
-- L'un d'eux est celui d'un autre client : la fiche passe « À vérifier »
-- (sauf « devenu client », figé comme avant) et la direction est prévenue.
-- Une fiche « À vérifier » dont le commercial retire ou corrige le numéro
-- d'un client : la vérification de ce client est close (sinon une faute de
-- frappe corrigée pourrait encore lui faire attribuer un client sans
-- rapport) ; s'il n'en reste aucune, la fiche sort de « À vérifier »
-- (_prospect_release_if_unclaimed). La réponse dit le statut FINAL :
-- to_verify (la fiche attend la direction), status, notified (une
-- vérification vient d'être ouverte : la direction est prévenue), released
-- (la fiche vient de sortir de « À vérifier »).
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
  p_interests TEXT[] DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_clear_birth_date BOOLEAN DEFAULT false,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_e164 TEXT;
  v_email TEXT := CASE WHEN p_email IS NULL THEN NULL ELSE nullif(lower(btrim(p_email)), '') END;
  v_clear_birth BOOLEAN := coalesce(p_clear_birth_date, false);
  v_current TEXT[];
  v_existing TEXT[];
  v_others TEXT[];
  v_new_others TEXT[];
  v_new_numbers TEXT[];
  v_list JSONB;
  v_conflict TEXT;
  v_err TEXT;
  v_to_verify BOOLEAN := false;
  v_notified BOOLEAN := false;
  v_after TEXT[];
  v_released TEXT;
  v_final TEXT;
BEGIN
  -- Verrouillée AVANT d'être lue : deux modifications simultanées passent l'une après l'autre.
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;

  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NOT NULL AND btrim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_gender IS NOT NULL AND upper(btrim(p_gender)) NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF p_city IS NOT NULL AND btrim(p_city) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  v_err := coalesce(CASE WHEN v_clear_birth THEN NULL ELSE public._birth_date_error(p_birth_date) END,
                    public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(btrim(coalesce(p_pain_points, ''))) > 2000 OR length(btrim(coalesce(p_help_needed, ''))) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Ses numéros d'avant : le principal, puis les autres.
  SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
    INTO v_current
    FROM public.prospect_phones WHERE prospect_id = p_id;
  v_existing := v_p.phone_e164 || v_current;

  -- Le principal.
  v_e164 := v_p.phone_e164;
  IF p_phone IS NOT NULL AND public._phone_e164(p_phone) IS DISTINCT FROM v_p.phone_e164 THEN
    IF v_p.status = 'won' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
    v_e164 := public._phone_e164(p_phone);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
    END IF;
  END IF;

  -- Les autres (liste complète), s'ils sont envoyés.
  IF p_phones IS NOT NULL THEN
    v_list := public._prospect_phone_list(p_phones, v_e164);
    IF v_list ? 'error' THEN
      RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
    END IF;
    SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
      INTO v_others
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
    -- Devenu client : la même liste (libellés et ordre mis à part) est acceptée, pas une autre.
    IF v_p.status = 'won'
       AND ARRAY(SELECT x FROM unnest(v_others) x ORDER BY x) IS DISTINCT FROM ARRAY(SELECT x FROM unnest(v_current) x ORDER BY x) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
  END IF;

  -- Seuls les numéros NOUVEAUX pour cette fiche sont vérifiés, après verrou.
  -- Une fiche « À vérifier » peut en sortir (plus bas) : tous ses numéros
  -- sont alors revérifiés — verrouillés ici, d'un coup et dans l'ordre (pas
  -- d'interblocage avec une saisie simultanée).
  v_new_others := ARRAY(SELECT n FROM unnest(coalesce(v_others, ARRAY[]::TEXT[])) n WHERE NOT n = ANY(v_existing));
  v_new_numbers := CASE WHEN v_e164 = ANY(v_existing) THEN ARRAY[]::TEXT[] ELSE ARRAY[v_e164] END || v_new_others;
  PERFORM public._prospect_lock_numbers(v_new_numbers || CASE WHEN v_p.status = 'to_verify' THEN v_existing ELSE ARRAY[]::TEXT[] END);
  IF NOT v_e164 = ANY(v_existing) THEN
    v_conflict := public._prospect_number_conflict(v_e164, v_p.source_id, p_id);
    IF v_conflict IS NOT NULL AND v_conflict <> 'client' THEN
      RETURN jsonb_build_object('success', false, 'error',
        CASE v_conflict WHEN 'own_client' THEN 'Le numéro ' || v_e164 || ' est déjà celui d''un de vos clients'
                        WHEN 'mine'       THEN 'Ce numéro est déjà dans votre liste'
                        ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
    END IF;
  END IF;
  v_err := public._prospect_numbers_refusal(v_new_others, v_p.source_id, p_id, true);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  v_to_verify := v_p.status <> 'won'
                 AND EXISTS (SELECT 1 FROM public._prospect_client_matches(v_new_numbers, v_p.source_id));

  -- Tout est bon : on écrit.
  UPDATE public.prospects
     SET first_name  = coalesce(btrim(p_first_name), first_name),
         last_name   = CASE WHEN p_last_name IS NULL THEN last_name ELSE btrim(p_last_name) END,
         company     = CASE WHEN p_company IS NULL THEN company ELSE nullif(btrim(p_company), '') END,
         city        = CASE WHEN p_city IS NULL THEN city ELSE btrim(p_city) END,
         notes       = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(btrim(p_notes), '') END,
         phone       = CASE WHEN p_phone IS NULL THEN phone ELSE btrim(p_phone) END,
         phone_e164  = v_e164,
         interests   = CASE WHEN p_interests IS NULL THEN interests
                            ELSE coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}') END,
         next_action_at = CASE WHEN p_clear_next_action THEN NULL ELSE coalesce(p_next_action_at, next_action_at) END,
         gender      = CASE WHEN p_gender IS NULL THEN gender ELSE upper(btrim(p_gender)) END,
         birth_date  = CASE WHEN v_clear_birth THEN NULL ELSE coalesce(p_birth_date, birth_date) END,
         email       = CASE WHEN p_email IS NULL THEN email ELSE v_email END,
         pain_points = CASE WHEN p_pain_points IS NULL THEN pain_points ELSE nullif(btrim(p_pain_points), '') END,
         help_needed = CASE WHEN p_help_needed IS NULL THEN help_needed ELSE nullif(btrim(p_help_needed), '') END,
         status      = CASE WHEN v_to_verify THEN 'to_verify' ELSE status END,
         lost_reason = CASE WHEN v_to_verify THEN NULL ELSE lost_reason END,
         status_changed_at = CASE WHEN v_to_verify AND status <> 'to_verify' THEN now() ELSE status_changed_at END,
         updated_at  = now()
   WHERE id = p_id;

  IF p_phones IS NOT NULL THEN
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id;
    INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
    SELECT p_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
  ELSIF v_e164 IS DISTINCT FROM v_p.phone_e164 THEN
    -- Un autre numéro devenu le principal ne reste pas en double dans la liste.
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id AND phone_e164 = v_e164;
  END IF;

  IF v_to_verify THEN
    v_notified := public._prospect_claim_clients(p_id, v_new_numbers, v_p.source_id) > 0;
  END IF;

  -- Une vérification dont le client n'a plus AUCUN des numéros de la fiche
  -- (le commercial a retiré ou corrigé le sien) est close ; plus aucune en
  -- attente : la fiche sort de « À vérifier ».
  IF v_p.status = 'to_verify' THEN
    SELECT v_e164 || coalesce(array_agg(pp.phone_e164 ORDER BY pp.position, pp.created_at), ARRAY[]::TEXT[])
      INTO v_after
      FROM public.prospect_phones pp WHERE pp.prospect_id = p_id;
    UPDATE public.prospect_client_claims k
       SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), note = 'Numéro retiré par le commercial'
     WHERE k.prospect_id = p_id AND k.status = 'pending'
       AND EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = k.client_user_id)
       AND NOT EXISTS (SELECT 1 FROM public.clients c
                        WHERE c.user_id = k.client_user_id
                          AND (c.phone_e164 = ANY (v_after)
                               OR EXISTS (SELECT 1 FROM public.client_phones cp
                                           WHERE cp.client_id = c.id AND cp.phone_e164 = ANY (v_after))));
    v_released := public._prospect_release_if_unclaimed(p_id, false);
  END IF;

  SELECT status INTO v_final FROM public.prospects WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'to_verify', v_final = 'to_verify', 'status', v_final,
                            'notified', v_notified, 'released', v_released IS NOT NULL);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Statut : une fiche « À vérifier » attend la direction
-- ─────────────────────────────────────────────────────────────────────────
-- Même fonction qu'au 06/10. En plus : tant qu'une vérification est en
-- attente, le commercial ne change pas le statut. Si plus aucune ne l'est
-- (le client a été supprimé entre-temps), la fiche se rouvre comme une
-- fiche perdue : ses numéros sont revérifiés.
CREATE OR REPLACE FUNCTION public.prospect_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
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
  IF v_p.status = 'to_verify'
     AND EXISTS (SELECT 1 FROM public.prospect_client_claims k
                   JOIN public.clients c ON c.user_id = k.client_user_id
                  WHERE k.prospect_id = p_id AND k.status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche attend la vérification de la direction');
  END IF;
  IF p_status = 'lost' AND (v_reason IS NULL OR length(v_reason) < 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dites en quelques mots pourquoi il est perdu');
  END IF;
  IF v_p.status IN ('lost', 'to_verify') AND p_status <> 'lost' THEN
    SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
      INTO v_others
      FROM public.prospect_phones WHERE prospect_id = p_id;
    PERFORM public._prospect_lock_numbers(v_p.phone_e164 || v_others);
    v_conflict := public._prospect_number_conflict(v_p.phone_e164, v_p.source_id, p_id);
    IF v_conflict = 'own_client' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un de vos clients');
    ELSIF v_conflict = 'client' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un client Bonzini');
    ELSIF v_conflict = 'mine' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un autre de vos prospects');
    ELSIF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
    END IF;
    v_err := public._prospect_numbers_error(v_others, v_p.source_id, p_id);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_err);
    END IF;
  END IF;

  UPDATE public.prospects
     SET status = p_status,
         lost_reason = CASE WHEN p_status = 'lost' THEN v_reason ELSE NULL END,
         status_changed_at = CASE WHEN status = p_status THEN status_changed_at ELSE now() END,
         updated_at = now()
   WHERE id = p_id;
  -- Une vérification restée « en attente » sans client (compte supprimé) est close.
  IF v_p.status = 'to_verify' THEN
    UPDATE public.prospect_client_claims
       SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), note = 'Compte client supprimé'
     WHERE prospect_id = p_id AND status = 'pending';
  END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6 bis. Un client supprimé pendant une vérification : la fiche se libère
-- ─────────────────────────────────────────────────────────────────────────
-- « Supprimer le client » (admin_delete_client) efface la ligne clients,
-- puis le compte de connexion, qui emporte ses vérifications (cascade). Sans
-- ceci, la fiche resterait « À vérifier » sans plus rien à vérifier : absente
-- de la liste de la direction, figée chez le commercial (qui ne change pas
-- le statut d'une fiche « À vérifier »). Si le compte de connexion reste
-- (email non libéré), les vérifications restent, sans client.
-- Déclencheurs DIFFÉRÉS : ils jouent à la fin de la transaction, quand
-- toutes les cascades sont passées (leur ordre n'est pas garanti). Chaque
-- fiche concernée qui n'attend plus rien est libérée et son commercial
-- prévenu. Une erreur ici ne fait jamais échouer la suppression.
CREATE OR REPLACE FUNCTION public._clients_release_prospect_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT k.prospect_id FROM public.prospect_client_claims k
     WHERE k.client_user_id = OLD.user_id AND k.status = 'pending'
     ORDER BY k.prospect_id
  LOOP
    PERFORM public._prospect_release_if_unclaimed(r.prospect_id, true);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_clients_release_prospect_claims : %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._prospect_claims_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._prospect_release_if_unclaimed(OLD.prospect_id, true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_prospect_claims_release : %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS clients_release_prospect_claims ON public.clients;
CREATE CONSTRAINT TRIGGER clients_release_prospect_claims
  AFTER DELETE ON public.clients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._clients_release_prospect_claims();

DROP TRIGGER IF EXISTS prospect_claims_release ON public.prospect_client_claims;
CREATE CONSTRAINT TRIGGER prospect_claims_release
  AFTER DELETE ON public.prospect_client_claims
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.status = 'pending')
  EXECUTE FUNCTION public._prospect_claims_release();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Rattacher un prospect à un client : pas une fiche « À vérifier »
-- ─────────────────────────────────────────────────────────────────────────
-- Même fonction qu'au 05/10, avec un refus de plus : une fiche « À
-- vérifier » se tranche par prospect_resolve_claim (sinon ses vérifications
-- resteraient « en attente » pour toujours).
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
  IF v_p.status = 'to_verify' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Cette fiche est « À vérifier » : attribuez ou refusez le client depuis la liste à vérifier');
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

-- ─────────────────────────────────────────────────────────────────────────
-- 8. « Ce numéro est-il libre ? » pendant la saisie
-- ─────────────────────────────────────────────────────────────────────────
-- Exactement ce que prospect_create dirait déjà, et RIEN sur l'identité du
-- client : free / client / own_client / mine (+ l'id de SON prospect) /
-- other / invalid. p_exclude_prospect_id : la fiche en cours de
-- modification (ses propres numéros ne comptent pas ; sa fiche commercial
-- sert de référence). Le commercial (sa fiche) ou la direction.
CREATE OR REPLACE FUNCTION public.prospect_phone_check(p_phone TEXT, p_exclude_prospect_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src UUID := public.current_commercial_source_id();
  v_e164 TEXT := public._phone_e164(p_phone);
  v_status TEXT;
  v_pid UUID;
BEGIN
  IF v_src IS NULL AND NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN public._sales_scope_error();
  END IF;
  IF p_exclude_prospect_id IS NOT NULL THEN
    SELECT source_id INTO v_src FROM public.prospects WHERE id = p_exclude_prospect_id;
    IF NOT FOUND OR public._sales_scope(v_src) IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
    END IF;
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'invalid');
  END IF;

  v_status := coalesce(public._prospect_number_conflict(v_e164, v_src, p_exclude_prospect_id), 'free');
  IF v_status = 'mine' THEN
    SELECT p.id INTO v_pid
      FROM public.prospects p
     WHERE p.source_id = v_src
       AND p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM p_exclude_prospect_id
       AND (p.phone_e164 = v_e164
            OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = v_e164))
     ORDER BY (p.phone_e164 = v_e164) DESC, p.created_at
     LIMIT 1;
    RETURN jsonb_build_object('success', true, 'status', v_status, 'prospect_id', v_pid);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Les fiches « À vérifier » qui attendent la direction
-- ─────────────────────────────────────────────────────────────────────────
-- Une ligne par vérification en attente : la fiche prospect complète (avec
-- ses autres numéros), le commercial (et si sa fiche est encore active : une
-- fiche archivée se confie d'abord à un autre), le numéro qui a reconnu le
-- client, la dernière fois que la direction a déjà refusé ce client à ce
-- commercial (previously_rejected_at, sur cette fiche ou une autre), et le
-- client (coordonnées, origine actuelle, activité) pour décider.
CREATE OR REPLACE FUNCTION public.prospect_claims_pending()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'claim_id', k.id,
           'prospect', to_jsonb(p) || jsonb_build_object('phones', coalesce((
               SELECT jsonb_agg(jsonb_build_object('phone_e164', pp.phone_e164, 'country_iso', pp.country_iso,
                                                   'label', pp.label, 'position', pp.position)
                                ORDER BY pp.position, pp.created_at)
                 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id), '[]'::jsonb)),
           'source_id', p.source_id,
           'source_label', s.label,
           'source_active', coalesce(s.is_active, false),
           'matched_phone', k.matched_phone,
           'created_at', k.created_at,
           'previously_rejected_at', (SELECT max(k2.direction_rejected_at)
                                        FROM public.prospect_client_claims k2
                                        JOIN public.prospects p2 ON p2.id = k2.prospect_id
                                       WHERE k2.client_user_id = k.client_user_id AND p2.source_id = p.source_id),
           'client', jsonb_build_object(
             'user_id', c.user_id,
             'name', coalesce(nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.company_name, 'Client'),
             'company', c.company_name,
             'customer_code', c.customer_code,
             'phone_e164', c.phone_e164,
             -- L'adresse technique d'un compte « téléphone seul » n'en est pas une.
             'email', CASE WHEN lower(coalesce(c.email, '')) LIKE '%@bonzini-client.local' THEN NULL ELSE c.email END,
             'city', c.city,
             'created_at', c.created_at,
             'source_id', c.source_id,
             'source_label', cs.label,
             'source_kind', cs.kind,
             'deposits_count', (SELECT count(*) FROM public.deposits d WHERE d.user_id = c.user_id),
             'payments_count', (SELECT count(*) FROM public.payments y WHERE y.user_id = c.user_id),
             'last_activity_at', (SELECT max(t) FROM (
                 SELECT max(d.created_at) AS t FROM public.deposits d WHERE d.user_id = c.user_id
                 UNION ALL
                 SELECT max(y.created_at) FROM public.payments y WHERE y.user_id = c.user_id) a)
           )) ORDER BY k.created_at DESC, k.id), '[]'::jsonb)
    INTO v_rows
    FROM public.prospect_client_claims k
    JOIN public.prospects p ON p.id = k.prospect_id AND p.status = 'to_verify'
    JOIN public.client_sources s ON s.id = p.source_id
    JOIN public.clients c ON c.user_id = k.client_user_id
    LEFT JOIN public.client_sources cs ON cs.id = c.source_id
   WHERE k.status = 'pending';

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. La décision de la direction
-- ─────────────────────────────────────────────────────────────────────────
-- 'attribute' : le client (p_client_user_id, obligatoire si la fiche en a
--   reconnu plusieurs) devient celui du commercial du prospect : son origine
--   passe à cette fiche commercial, le prospect devient « devenu client ».
--   Un AUTRE prospect déjà « devenu client » de ce client est détaché
--   (perdu). Les autres vérifications en attente sur ce client (d'autres
--   commerciaux) sont refusées et leurs fiches, sans autre vérification en
--   attente, passent « perdu » (un doublon du MÊME commercial le dit, sans
--   seconde notification). Refusé si le client n'a plus aucun des numéros
--   de la fiche (le commercial l'a corrigé entre-temps).
-- 'reject' : le prospect passe « perdu » avec un motif FIXE, « Déjà client
--   de Bonzini » : c'est tout ce que lit le commercial, qui ne doit pas
--   apprendre de quel client il s'agit. La note libre de la direction reste
--   INTERNE (sur la vérification et au journal d'audit). Toutes ses
--   vérifications sont refusées et la date du refus gardée
--   (direction_rejected_at).
-- Journalisée ; chaque commercial dont une fiche change est notifié, de même
-- que le commercial qui perd ce client (son origine d'avant).
-- Verrous : le client AVANT le prospect (même ordre que la réouverture d'un
-- client en prospect), le prospect AVANT ses vérifications.
CREATE OR REPLACE FUNCTION public.prospect_resolve_claim(
  p_prospect_id UUID,
  p_decision TEXT,
  p_client_user_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_note TEXT := nullif(btrim(coalesce(p_note, '')), '');
  v_client_id UUID := p_client_user_id;
  v_candidates UUID[];
  v_client public.clients;
  v_p public.prospects;
  v_src public.client_sources;
  v_old public.prospects;
  v_other public.prospects;
  v_k RECORD;
  v_closed UUID[] := ARRAY[]::UUID[];
  v_name TEXT;
  v_dup BOOLEAN;
  v_rejected UUID[];
  v_prev_staff UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('attribute', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Décision inconnue (attribute ou reject)');
  END IF;
  IF length(v_note) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Note trop longue (300 caractères au plus)');
  END IF;

  -- Attribuer : le client d'abord, verrouillé.
  IF p_decision = 'attribute' THEN
    IF v_client_id IS NULL THEN
      SELECT array_agg(k.client_user_id ORDER BY k.created_at)
        INTO v_candidates
        FROM public.prospect_client_claims k
        JOIN public.clients c ON c.user_id = k.client_user_id
       WHERE k.prospect_id = p_prospect_id AND k.status = 'pending';
      IF coalesce(cardinality(v_candidates), 0) > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Plusieurs clients ont ces numéros : choisissez lequel attribuer');
      END IF;
      v_client_id := v_candidates[1];
    END IF;
    IF v_client_id IS NOT NULL THEN
      SELECT * INTO v_client FROM public.clients WHERE user_id = v_client_id FOR UPDATE;
    END IF;
  END IF;

  SELECT * INTO v_p FROM public.prospects WHERE id = p_prospect_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status <> 'to_verify' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche n''attend plus de vérification');
  END IF;
  PERFORM 1 FROM public.prospect_client_claims WHERE prospect_id = p_prospect_id AND status = 'pending' FOR UPDATE;
  SELECT * INTO v_src FROM public.client_sources WHERE id = v_p.source_id;
  v_name := btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, ''));

  -- ── Refuser ──
  IF p_decision = 'reject' THEN
    WITH r AS (
      UPDATE public.prospect_client_claims
         SET status = 'rejected', resolved_at = now(), resolved_by = v_uid, note = v_note, direction_rejected_at = now()
       WHERE prospect_id = p_prospect_id AND status = 'pending'
      RETURNING client_user_id
    )
    SELECT coalesce(array_agg(client_user_id ORDER BY client_user_id), ARRAY[]::UUID[]) INTO v_rejected FROM r;
    UPDATE public.prospects
       SET status = 'lost', lost_reason = 'Déjà client de Bonzini',
           status_changed_at = now(), updated_at = now()
     WHERE id = p_prospect_id;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'prospect_resolve_claim', 'prospect', p_prospect_id,
            jsonb_build_object('decision', 'reject', 'source_id', v_p.source_id, 'note', v_note,
                               'client_user_ids', to_jsonb(v_rejected)));
    PERFORM public.send_staff_push_user(v_src.staff_user_id, 'Fiche classée',
      v_name || ' : déjà client Bonzini — fiche classée par la direction', '/v/prospects/' || p_prospect_id);
    RETURN jsonb_build_object('success', true, 'decision', 'reject', 'prospect_id', p_prospect_id);
  END IF;

  -- ── Attribuer ──
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client reconnu pour cette fiche : refusez-la');
  END IF;
  IF v_client.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prospect_client_claims
                  WHERE prospect_id = p_prospect_id AND client_user_id = v_client_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client n''est pas reconnu pour cette fiche');
  END IF;
  -- Une vérification a pu s'ajouter entre la lecture et le verrou.
  IF p_client_user_id IS NULL
     AND (SELECT count(*) FROM public.prospect_client_claims k JOIN public.clients c ON c.user_id = k.client_user_id
           WHERE k.prospect_id = p_prospect_id AND k.status = 'pending') > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plusieurs clients ont ces numéros : choisissez lequel attribuer');
  END IF;
  IF v_src.kind IS DISTINCT FROM 'commercial' OR NOT coalesce(v_src.is_active, false) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Cette fiche commercial est archivée : confiez d''abord le prospect à un commercial actif');
  END IF;
  -- Le client doit avoir encore au moins un des numéros de la fiche (principal ou autre).
  IF NOT EXISTS (
    SELECT 1
      FROM unnest(v_p.phone_e164 || ARRAY(SELECT pp.phone_e164 FROM public.prospect_phones pp WHERE pp.prospect_id = p_prospect_id)) AS n(phone)
     WHERE n.phone = v_client.phone_e164
        OR EXISTS (SELECT 1 FROM public.client_phones cp WHERE cp.client_id = v_client.id AND cp.phone_e164 = n.phone)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client n''a plus aucun des numéros de cette fiche : refusez-la');
  END IF;

  -- Un autre prospect « devenu client » de ce client : détaché.
  SELECT * INTO v_old FROM public.prospects
   WHERE converted_user_id = v_client_id AND id <> p_prospect_id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.prospects
       SET status = 'lost', lost_reason = 'Client réattribué par la direction',
           converted_user_id = NULL, converted_at = NULL, status_changed_at = now(), updated_at = now()
     WHERE id = v_old.id;
  END IF;

  -- Le prospect AVANT l'origine du client : le déclencheur d'attribution ne
  -- le trouve donc plus « ouvert » et ne le touche pas.
  UPDATE public.prospects
     SET status = 'won', converted_user_id = v_client_id, converted_at = now(),
         status_changed_at = now(), lost_reason = NULL, updated_at = now()
   WHERE id = p_prospect_id;

  IF v_client.source_id IS DISTINCT FROM v_p.source_id THEN
    PERFORM set_config('bonzini.client_source_write', 'on', true);
    UPDATE public.clients
       SET source_id = v_p.source_id, source_set_at = now(), source_set_by = v_uid
     WHERE user_id = v_client_id;
    PERFORM set_config('bonzini.client_source_write', '', true);
  END IF;

  UPDATE public.prospect_client_claims
     SET status = 'attributed', resolved_at = now(), resolved_by = v_uid, note = v_note
   WHERE prospect_id = p_prospect_id AND client_user_id = v_client_id AND status = 'pending';
  UPDATE public.prospect_client_claims
     SET status = 'rejected', resolved_at = now(), resolved_by = v_uid, note = 'Un autre client a été attribué à cette fiche'
   WHERE prospect_id = p_prospect_id AND status = 'pending';

  -- Les autres fiches qui avaient saisi ce même client : d'autres
  -- commerciaux, ou un doublon du même (son principal sur l'une, un autre de
  -- ses numéros sur l'autre).
  FOR v_k IN
    SELECT k.id, k.prospect_id FROM public.prospect_client_claims k
     WHERE k.client_user_id = v_client_id AND k.status = 'pending' AND k.prospect_id <> p_prospect_id
     ORDER BY k.prospect_id
  LOOP
    SELECT * INTO v_other FROM public.prospects WHERE id = v_k.prospect_id FOR UPDATE;
    v_dup := v_other.source_id IS NOT DISTINCT FROM v_p.source_id;
    UPDATE public.prospect_client_claims
       SET status = 'rejected', resolved_at = now(), resolved_by = v_uid,
           note = CASE WHEN v_dup THEN 'Doublon d''une fiche attribuée au même commercial' ELSE 'Client attribué à un autre commercial' END
     WHERE id = v_k.id AND status = 'pending';
    UPDATE public.prospects p
       SET status = 'lost',
           lost_reason = CASE WHEN v_dup THEN 'Doublon : ce client vous est attribué par une autre de vos fiches'
                              ELSE 'Client attribué à un autre commercial' END,
           status_changed_at = now(), updated_at = now()
     WHERE p.id = v_k.prospect_id AND p.status = 'to_verify'
       AND NOT EXISTS (SELECT 1 FROM public.prospect_client_claims x WHERE x.prospect_id = p.id AND x.status = 'pending');
    IF FOUND THEN
      v_closed := v_closed || v_other.id;
      -- Le même commercial reçoit déjà « la direction vous attribue ce client ».
      IF NOT v_dup THEN
        PERFORM public.send_staff_push_user(
          (SELECT staff_user_id FROM public.client_sources WHERE id = v_other.source_id), 'Fiche classée',
          btrim(v_other.first_name || ' ' || coalesce(v_other.last_name, '')) || ' : déjà client Bonzini, suivi par un autre commercial',
          '/v/prospects/' || v_other.id);
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'prospect_resolve_claim', 'prospect', p_prospect_id,
          jsonb_build_object('decision', 'attribute', 'client_user_id', v_client_id, 'source_id', v_p.source_id,
                             'client_source_from', v_client.source_id, 'note', v_note,
                             'detached_prospect_id', v_old.id, 'closed_prospect_ids', to_jsonb(v_closed)));

  PERFORM public.send_staff_push_user(v_src.staff_user_id, 'Client attribué',
    v_name || ' : la direction vous attribue ce client', '/v/prospects/' || p_prospect_id);
  IF v_old.id IS NOT NULL THEN
    PERFORM public.send_staff_push_user(
      (SELECT staff_user_id FROM public.client_sources WHERE id = v_old.source_id), 'Client réattribué',
      btrim(v_old.first_name || ' ' || coalesce(v_old.last_name, '')) || ' : client réattribué par la direction',
      '/v/prospects/' || v_old.id);
  END IF;
  -- Son origine d'avant était un AUTRE commercial (attribué par la réception
  -- ou par l'origine posée à la main, sans prospect chez lui) : prévenu aussi.
  -- C'était son client : il le connaît par son nom.
  IF v_client.source_id IS DISTINCT FROM v_p.source_id
     AND (v_old.id IS NULL OR v_old.source_id IS DISTINCT FROM v_client.source_id) THEN
    SELECT staff_user_id INTO v_prev_staff FROM public.client_sources
     WHERE id = v_client.source_id AND kind = 'commercial';
    IF v_prev_staff IS NOT NULL THEN
      PERFORM public.send_staff_push_user(v_prev_staff, 'Client réattribué',
        coalesce(nullif(btrim(coalesce(v_client.first_name, '') || ' ' || coalesce(v_client.last_name, '')), ''), v_client.company_name, 'Un de vos clients')
          || ' : client réattribué par la direction',
        '/v/clients');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'decision', 'attribute', 'prospect_id', p_prospect_id,
                            'client_user_id', v_client_id, 'detached_prospect_id', v_old.id,
                            'closed_prospect_ids', to_jsonb(v_closed));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Client → prospect : ce qui bloque
-- ─────────────────────────────────────────────────────────────────────────
-- Pour l'écran : peut-on repasser ce client en prospect ? Ce qui bloque, en
-- clair ; ce qui serait effacé AUSSI sans bloquer (warnings : bénéficiaires,
-- conversation avec le support, KYC, notes — gardés au journal) ; la fiche
-- commercial proposée (son origine, si c'est un commercial actif, sinon
-- celle de son ancien prospect) ; le prospect « devenu client » qui serait
-- rouvert. Super admin (canManageUsers ET canManageSales).
CREATE OR REPLACE FUNCTION public.admin_client_prospect_eligibility(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_client public.clients;
  v_blockers TEXT[];
  v_reopen public.prospects;
  v_suggested UUID;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canManageUsers') AND public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  v_blockers := public._client_prospect_blockers(p_user_id);
  SELECT * INTO v_reopen FROM public.prospects WHERE converted_user_id = p_user_id;
  SELECT s.id INTO v_suggested FROM public.client_sources s
   WHERE s.id = v_client.source_id AND s.kind = 'commercial' AND s.is_active;
  IF v_suggested IS NULL AND v_reopen.id IS NOT NULL THEN
    SELECT s.id INTO v_suggested FROM public.client_sources s
     WHERE s.id = v_reopen.source_id AND s.kind = 'commercial' AND s.is_active;
  END IF;
  RETURN jsonb_build_object('success', true,
    'eligible', coalesce(cardinality(v_blockers), 0) = 0,
    'blockers', to_jsonb(v_blockers),
    'warnings', to_jsonb(public._client_prospect_warnings(p_user_id)),
    'suggested_source_id', v_suggested,
    'reopen_prospect_id', v_reopen.id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 12. Client → prospect
-- ─────────────────────────────────────────────────────────────────────────
-- Seulement un client SANS AUCUNE opération (les mêmes règles, recalculées
-- sous verrou). Dans l'ordre : client, portefeuille, compte de connexion et
-- ancien prospect verrouillés, numéros verrouillés, tout revérifié. Le
-- compte de connexion en FOR UPDATE : une insertion EN COURS qui le
-- référence (dépôt, paiement, grand livre, colis, douane, bénéficiaire…)
-- tient un verrou « clé partagée » sur lui ; on attend qu'elle se termine,
-- puis les blocages la voient — sans cela, un dépôt saisi au même instant
-- échappait au contrôle puis disparaissait avec le compte (cascade). Puis,
-- d'un bloc (tout ou rien) : instantané COMPLET du client dans le journal
-- d'audit (sa fiche entière, ses numéros, ses bénéficiaires, ses échanges
-- avec le support, son compte de connexion), compte supprimé
-- par admin_delete_client (la même logique que « Supprimer le client »),
-- puis son ancien prospect « devenu client » rouvert (contacté, chez
-- p_source_id, champs vides complétés), ou un prospect créé avec ses
-- coordonnées. Le commercial est notifié. Jamais l'adresse technique
-- @bonzini-client.local comme email.
CREATE OR REPLACE FUNCTION public.admin_client_to_prospect(p_user_id UUID, p_source_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_src public.client_sources;
  v_client public.clients;
  v_e164 TEXT;
  v_phones JSONB;
  v_numbers TEXT[];
  v_check TEXT[];
  v_blockers TEXT[];
  v_reopen public.prospects;
  v_n TEXT;
  v_holder UUID;
  v_email TEXT;
  v_gender TEXT;
  v_birth DATE;
  v_note TEXT;
  v_label TEXT;
  v_del JSON;
  v_id UUID;
  v_name TEXT;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canManageUsers') AND public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_reason) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif trop long (300 caractères au plus)');
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id;
  IF NOT FOUND OR v_src.kind <> 'commercial' OR NOT v_src.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choisissez un commercial actif');
  END IF;

  -- Verrouillés AVANT d'être lus : le client, son portefeuille (même ordre
  -- qu'un paiement : portefeuille, puis le compte qu'il référence), puis son
  -- compte de connexion (voir plus haut).
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  PERFORM 1 FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;

  -- Ses numéros : le principal, puis ses autres numéros valables (neuf au plus).
  v_e164 := coalesce(public._phone_e164(v_client.phone_e164), public._phone_e164(v_client.phone));
  SELECT coalesce(jsonb_agg(jsonb_build_object('phone_e164', x.e, 'country_iso', x.iso, 'label', x.label) ORDER BY x.o), '[]'::jsonb)
    INTO v_phones
    FROM (
      SELECT d.*, row_number() OVER (ORDER BY d.is_primary DESC, d.created_at, d.e) AS o
        FROM (
          SELECT DISTINCT ON (public._phone_e164(cp.phone_e164))
                 public._phone_e164(cp.phone_e164) AS e,
                 CASE WHEN cp.country_iso ~ '^[A-Z]{2}$' THEN cp.country_iso END AS iso,
                 left(nullif(btrim(coalesce(cp.label, '')), ''), 40) AS label,
                 cp.is_primary, cp.created_at
            FROM public.client_phones cp
           WHERE cp.client_id = v_client.id
             AND public._phone_e164(cp.phone_e164) IS NOT NULL
             AND public._phone_e164(cp.phone_e164) IS DISTINCT FROM v_e164
           ORDER BY public._phone_e164(cp.phone_e164), cp.is_primary DESC, cp.created_at
        ) d
    ) x
   WHERE x.o <= 9;
  SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[]) INTO v_numbers
    FROM jsonb_array_elements(v_phones) WITH ORDINALITY AS t(e, o);
  v_numbers := v_e164 || v_numbers;

  -- Son ancien prospect « devenu client » (rouvert plutôt que recréé) : ses
  -- numéros à lui comptent aussi.
  SELECT * INTO v_reopen FROM public.prospects WHERE converted_user_id = p_user_id FOR UPDATE;
  v_check := v_numbers;
  IF v_reopen.id IS NOT NULL THEN
    v_check := v_check || v_reopen.phone_e164
               || ARRAY(SELECT pp.phone_e164 FROM public.prospect_phones pp WHERE pp.prospect_id = v_reopen.id ORDER BY pp.position);
  END IF;
  v_check := ARRAY(SELECT DISTINCT n FROM unnest(v_check) AS n WHERE n IS NOT NULL ORDER BY n);

  -- Numéros verrouillés (une saisie simultanée d'un commercial attend), puis
  -- tout revérifié : rien ne doit bloquer.
  PERFORM public._prospect_lock_numbers(v_check);
  v_blockers := public._client_prospect_blockers(p_user_id);
  IF coalesce(cardinality(v_blockers), 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client ne peut pas redevenir prospect : ' || array_to_string(v_blockers, ' · '), 'blockers', to_jsonb(v_blockers));
  END IF;

  -- Aucun de ces numéros ne doit être suivi ailleurs, ni être celui d'un autre client.
  FOREACH v_n IN ARRAY v_check LOOP
    SELECT p.source_id INTO v_holder
      FROM public.prospects p
     WHERE p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM v_reopen.id
       AND (p.phone_e164 = v_n
            OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = v_n))
     ORDER BY (p.source_id = p_source_id), p.created_at
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error',
        CASE WHEN v_holder = p_source_id THEN 'Le numéro ' || v_n || ' est déjà dans la liste de ce commercial'
             ELSE 'Le numéro ' || v_n || ' est déjà suivi par un autre commercial' END);
    END IF;
    IF EXISTS (SELECT 1 FROM public.clients c WHERE c.phone_e164 = v_n AND c.user_id <> p_user_id)
       OR EXISTS (SELECT 1 FROM public.client_phones cp JOIN public.clients c ON c.id = cp.client_id
                   WHERE cp.phone_e164 = v_n AND c.user_id <> p_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le numéro ' || v_n || ' est aussi celui d''un autre client');
    END IF;
  END LOOP;

  -- Ce que la fiche prospect reprend du client (sa forme vérifiée).
  v_email := nullif(lower(btrim(coalesce(v_client.email, ''))), '');
  IF v_email LIKE '%@bonzini-client.local' OR public._email_error(v_email) IS NOT NULL THEN
    v_email := NULL;
  END IF;
  v_gender := CASE WHEN upper(coalesce(v_client.gender, '')) IN ('MALE', 'FEMALE') THEN upper(v_client.gender) END;
  v_birth := CASE WHEN public._birth_date_error(v_client.date_of_birth) IS NULL THEN v_client.date_of_birth END;
  v_note := 'Ancien compte client ' || coalesce(v_client.customer_code, '(sans code)') || ' repassé en prospect le '
            || to_char((now() AT TIME ZONE 'Africa/Douala')::date, 'DD/MM/YYYY') || coalesce(' : ' || v_reason, '');
  SELECT label INTO v_label FROM public.client_sources WHERE id = v_client.source_id;

  BEGIN
    -- L'instantané : tout ce que la suppression va effacer. Les champs
    -- principaux à plat (lisibles d'un coup d'œil), puis la fiche client
    -- ENTIÈRE (notes de l'équipe, KYC, secteur, quartier, inscription…), ses
    -- numéros, ses bénéficiaires, ses échanges avec le support (messages
    -- compris), son compte de connexion et les décisions déjà prises sur lui
    -- (_client_erasable_data).
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'client_to_prospect', 'client', p_user_id, public._client_erasable_data(p_user_id) || jsonb_build_object(
      'client', to_jsonb(v_client),
      'customer_code', v_client.customer_code,
      'first_name', v_client.first_name,
      'last_name', v_client.last_name,
      'company', v_client.company_name,
      'phone', v_client.phone,
      'phone_e164', v_client.phone_e164,
      'phones', coalesce((SELECT jsonb_agg(jsonb_build_object('phone_e164', cp.phone_e164, 'country_iso', cp.country_iso,
                                                              'label', cp.label, 'is_primary', cp.is_primary)
                                           ORDER BY cp.is_primary DESC, cp.created_at)
                            FROM public.client_phones cp WHERE cp.client_id = v_client.id), '[]'::jsonb),
      'email', v_client.email,
      'city', v_client.city,
      'country', v_client.country,
      'gender', v_client.gender,
      'date_of_birth', v_client.date_of_birth,
      'source_id', v_client.source_id,
      'source_label', v_label,
      'registered_at', v_client.created_at,
      'registered_by_name', to_jsonb(v_client) ->> 'registered_by_name',
      'reason', v_reason,
      'prospect_source_id', p_source_id,
      'prospect_source_label', v_src.label,
      'reopened_prospect_id', v_reopen.id));

    -- Ses vérifications (déjà tranchées) n'ont plus d'objet ; l'ancien
    -- prospect est détaché avant que le compte disparaisse.
    DELETE FROM public.prospect_client_claims WHERE client_user_id = p_user_id;
    IF v_reopen.id IS NOT NULL THEN
      UPDATE public.prospects SET converted_user_id = NULL, converted_at = NULL WHERE id = v_reopen.id;
    END IF;

    -- Le compte : même logique que « Supprimer le client ».
    v_del := public.admin_delete_client(p_user_id);
    IF NOT coalesce((v_del ->> 'success')::boolean, false) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = coalesce(v_del ->> 'error', 'Suppression du compte refusée');
    END IF;

    IF v_reopen.id IS NOT NULL THEN
      UPDATE public.prospects
         SET status = 'contacted', source_id = p_source_id,
             converted_user_id = NULL, converted_at = NULL, lost_reason = NULL,
             status_changed_at = now(), updated_at = now(),
             last_name  = coalesce(last_name, left(nullif(btrim(coalesce(v_client.last_name, '')), ''), 80)),
             company    = coalesce(company, left(nullif(btrim(coalesce(v_client.company_name, '')), ''), 120)),
             city       = coalesce(city, left(nullif(btrim(coalesce(v_client.city, '')), ''), 80)),
             email      = coalesce(email, v_email),
             gender     = coalesce(gender, v_gender),
             birth_date = coalesce(birth_date, v_birth),
             notes      = CASE WHEN notes IS NULL THEN v_note
                               ELSE left(notes, greatest(0, 1000 - length(v_note) - 1)) || E'\n' || v_note END
       WHERE id = v_reopen.id;
      -- Ses numéros de client absents de la fiche s'y ajoutent (neuf autres au plus).
      INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
      SELECT v_reopen.id, y.e, y.iso, y.label,
             coalesce((SELECT max(position) FROM public.prospect_phones WHERE prospect_id = v_reopen.id), 0) + row_number() OVER (ORDER BY y.o)
        FROM (
          SELECT n.e, NULL::TEXT AS iso, NULL::TEXT AS label, n.o
            FROM unnest(v_numbers) WITH ORDINALITY AS n(e, o)
           WHERE n.o = 1
          UNION ALL
          SELECT e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o + 1
            FROM jsonb_array_elements(v_phones) WITH ORDINALITY AS t(e, o)
        ) y
       WHERE y.e IS DISTINCT FROM v_reopen.phone_e164
         AND NOT EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = v_reopen.id AND pp.phone_e164 = y.e)
       ORDER BY y.o
       LIMIT greatest(0, 9 - (SELECT count(*) FROM public.prospect_phones WHERE prospect_id = v_reopen.id));
      v_id := v_reopen.id;
      v_name := btrim(v_reopen.first_name || ' ' || coalesce(v_reopen.last_name, v_client.last_name, ''));
    ELSE
      v_name := left(coalesce(nullif(btrim(coalesce(v_client.first_name, '')), ''), nullif(btrim(coalesce(v_client.company_name, '')), ''), 'Client'), 80);
      INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes,
                                    created_by, gender, birth_date, email, status)
      VALUES (p_source_id, v_name,
              left(nullif(btrim(coalesce(v_client.last_name, '')), ''), 80),
              left(nullif(btrim(coalesce(v_client.company_name, '')), ''), 120),
              v_e164, v_e164,
              left(nullif(btrim(coalesce(v_client.city, '')), ''), 80),
              '{}', v_note, v_uid, v_gender, v_birth, v_email, 'contacted')
      RETURNING id INTO v_id;
      INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
      SELECT v_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
        FROM jsonb_array_elements(v_phones) WITH ORDINALITY AS t(e, o);
      v_name := btrim(v_name || ' ' || coalesce(v_client.last_name, ''));
    END IF;
  EXCEPTION
    WHEN raise_exception THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    WHEN unique_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Un de ses numéros est déjà suivi par un commercial');
    WHEN check_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une coordonnée du client ne tient pas dans la fiche prospect');
    WHEN foreign_key_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce client a encore des données liées : suppression impossible');
  END;

  PERFORM public.send_staff_push_user(v_src.staff_user_id, 'Nouveau prospect',
    v_name || ' vous est confié par la direction (ancien compte client)', '/v/prospects/' || v_id);

  RETURN jsonb_build_object('success', true, 'prospect_id', v_id, 'reopened', v_reopen.id IS NOT NULL,
                            'email_freed', (v_del ->> 'email_freed')::boolean);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 13. Droits
-- ─────────────────────────────────────────────────────────────────────────
-- Internes : jamais appelables depuis l'API (les RPC ci-dessous, SECURITY
-- DEFINER, les appellent avec les droits de leur propriétaire).
REVOKE ALL ON FUNCTION public._prospect_number_conflict(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_numbers_error(TEXT[], UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_numbers_refusal(TEXT[], UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_client_matches(TEXT[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_claim_clients(UUID, TEXT[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._client_prospect_blockers(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_staff_push_user(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_release_if_unclaimed(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._client_erasable_data(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._client_prospect_warnings(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._clients_release_prospect_claims() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_claims_release() FROM PUBLIC, anon, authenticated;

-- Les actions : membres du personnel connectés ; chaque RPC vérifie la permission.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text)',
    'public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text)',
    'public.prospect_set_status(uuid, text, text)',
    'public.prospect_link_client(uuid, uuid)',
    'public.prospect_phone_check(text, uuid)',
    'public.prospect_claims_pending()',
    'public.prospect_resolve_claim(uuid, text, uuid, text)',
    'public.admin_client_prospect_eligibility(uuid)',
    'public.admin_client_to_prospect(uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 14. Étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Le commercial n'a pas Mola (la passerelle le refuse). La décision sur une
-- fiche « À vérifier » est ouverte à Mola pour la direction ; repasser un
-- client en prospect (suppression de son compte) ne l'est pas.
COMMENT ON FUNCTION public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Ajouter un prospect pour un commercial — obligatoires : prénom, nom, sexe (p_gender MALE ou FEMALE), ville au Cameroun, numéro principal (+237…) ; facultatifs : autres numéros (p_phones [{phone_e164, country_iso, label}], neuf au plus), entreprise, date de naissance (AAAA-MM-JJ, 16 à 110 ans), email, intérêts (payments / air / sea), ses plus gros problèmes aujourd''hui (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed). Un numéro déjà celui d''un client (pas de ce commercial) : la fiche part « À vérifier » (to_verify) et la direction tranche"}';
COMMENT ON FUNCTION public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Modifier un prospect (NULL = inchangé) : nom, sexe (MALE / FEMALE) et ville ne se vident pas ; numéro principal, autres numéros (p_phones = la liste complète, [] = aucun), entreprise, date de naissance (p_clear_birth_date l''efface), email, ses plus gros problèmes (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed), notes, date de relance. Un nouveau numéro déjà celui d''un client : la fiche passe « À vérifier » ; le numéro d''un client retiré d''une fiche « À vérifier » clôt sa vérification (plus aucune : la fiche redevient à contacter)"}';
COMMENT ON FUNCTION public.prospect_set_status(uuid, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Changer le statut d''un prospect (new, contacted, interested, lost avec motif) ; une fiche « À vérifier » se tranche par prospect_resolve_claim"}';
COMMENT ON FUNCTION public.prospect_link_client(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Rattacher un prospect au compte client qu''il est devenu (attribue le client à son commercial s''il n''a pas d''origine ; pas une fiche « À vérifier »)","resolve":{"p_user_id":"client"}}';
COMMENT ON FUNCTION public.prospect_phone_check(text, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Pendant la saisie d''un prospect : ce numéro est-il libre, déjà client, déjà suivi ? (aucune identité de client)"}';
COMMENT ON FUNCTION public.prospect_claims_pending() IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Les fiches prospect « À vérifier » : un numéro saisi par un commercial est déjà celui d''un client — la fiche, le commercial (fiche active ou non), le client reconnu et son activité, un refus antérieur"}';
COMMENT ON FUNCTION public.prospect_resolve_claim(uuid, text, uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Trancher une fiche « À vérifier » : attribute = le client devient celui du commercial (son origine change, le prospect devient client), reject = le prospect passe perdu, motif fixe « Déjà client de Bonzini » (la note reste interne : le commercial ne la voit pas)","resolve":{"p_client_user_id":"client"}}';
COMMENT ON FUNCTION public.admin_client_prospect_eligibility(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Ce client peut-il redevenir prospect ? (ce qui bloque : dépôts, paiements, solde, colis…)"}';
COMMENT ON FUNCTION public.admin_client_to_prospect(uuid, uuid, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Repasser en prospect un client sans aucune opération (son compte est supprimé, la fiche va au commercial choisi)"}';
COMMENT ON FUNCTION public.send_staff_push_user(uuid, text, text, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push à une personne du personnel (interne)"}';
COMMENT ON FUNCTION public._prospect_number_conflict(text, uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : ce numéro est-il celui d''un client (du commercial ou non) ou d''un prospect suivi"}';
COMMENT ON FUNCTION public._prospect_numbers_error(text[], uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : le premier des autres numéros déjà pris, dit en clair"}';
COMMENT ON FUNCTION public._prospect_numbers_refusal(text[], uuid, uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : le premier numéro refusé, dit en clair (le numéro d''un autre client accepté ou non)"}';
COMMENT ON FUNCTION public._prospect_client_matches(text[], uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : les clients reconnus par les numéros saisis"}';
COMMENT ON FUNCTION public._prospect_claim_clients(uuid, text[], uuid) IS
  '@mola:{"expose":false,"kind":"write","permission":"canProspect","label":"Interne : ouvrir les vérifications d''une fiche « À vérifier » et prévenir la direction"}';
COMMENT ON FUNCTION public._client_prospect_blockers(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Interne : ce qui empêche un client de redevenir prospect"}';
COMMENT ON FUNCTION public._client_erasable_data(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Interne : ce qu''efface aussi la suppression d''un compte client — bénéficiaires, échanges avec le support, compte de connexion, décisions sur ses fiches « À vérifier » (pour l''instantané du journal)"}';
COMMENT ON FUNCTION public._client_prospect_warnings(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Interne : ce que repasser un client en prospect efface aussi sans le bloquer (bénéficiaires, support, KYC, notes)"}';
COMMENT ON FUNCTION public._prospect_release_if_unclaimed(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Interne : une fiche « À vérifier » qui n''attend plus aucune vérification redevient à contacter (ou perdue)"}';
COMMENT ON FUNCTION public._clients_release_prospect_claims() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Interne (déclencheur) : un client supprimé libère les fiches « À vérifier » qui l''attendaient"}';
COMMENT ON FUNCTION public._prospect_claims_release() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Interne (déclencheur) : une vérification en attente effacée libère sa fiche « À vérifier »"}';

NOTIFY pgrst, 'reload schema';


-- ############################################################################
-- SECTION 4 — Partie D : copie conforme de 20261008100000_sales_series.sql
-- ############################################################################
-- ============================================================================
-- Ventes : l'ÉVOLUTION mois par mois (ou semaine par semaine)
--
-- Le 08/10/2026, le directeur : les tableaux de bord des commerciaux ne
-- montrent qu'UN mois, sans aucune évolution. Il veut voir, pour chaque
-- commercial et pour l'équipe, comment évoluent les clients, les prospects,
-- les paiements, les dépôts, le fret avion, les vols et le bateau.
--
-- sales_series(p_from, p_to, p_grain, p_source_id) → une série SANS TROU de
-- périodes (une valeur par mois ou par semaine, zéro compris), les totaux de
-- la plage, ceux de la plage de même longueur juste avant (pour les
-- tendances) et l'entonnoir des prospects — par fiche commercial et pour
-- l'équipe. Lecture seule ; rien n'est modifié.
--
-- PORTÉE (même règle que les tableaux du mois) :
--   · le commercial ne reçoit QUE sa fiche (current_commercial_source_id) ;
--     p_source_id est ignoré — passer la fiche d'un collègue ne lui donne
--     rien de plus ;
--   · la direction (canManageSales) : toutes les fiches « commercial » —
--     les actives, plus les archivées qui ont une activité dans la plage
--     (un chiffre non nul : client arrivé, paiement, dépôt, colis, vol,
--     prospect ajouté, gagné ou perdu) — ou seulement p_source_id (même
--     archivée, même sans activité : elle est demandée) ;
--   · tout autre appelant : refusé, avec le message de _sales_scope_error
--     (« Accès non autorisé », ou « pas encore relié à votre fiche » pour un
--     commercial sans fiche) ; anon n'a pas l'EXECUTE.
--
-- PÉRIODES, à l'heure de Douala (Africa/Douala, UTC+1, sans heure d'été) :
--   'month' = du 1er au 1er, 'week' = du lundi au lundi. p_from est ramené
--   au début de sa période ; p_to est EXCLUSIF, ramené au début de la
--   période suivante s'il tombe au milieu d'une période (p_to = 09/10 en
--   mois → jusqu'au 01/11, octobre compris). Au plus 24 mois ou 26
--   semaines (« Plage trop longue ») ; p_from < p_to ; dates entre 2000 et
--   2100 (une date extrême ne déborde jamais en erreur SQL) ; grain month |
--   week (NULL = month).
--   Un paiement du 30/09 à 23 h 30 UTC est le 1er octobre à Douala : il
--   compte en octobre.
--
-- LES CHIFFRES, par période et par fiche (mêmes définitions que le tableau
-- du mois, _commercial_metrics, pour les mêmes noms) :
--   clients_total   clients dont la fiche est l'origine (clients.source_id),
--                   créés AVANT la fin de la période (un cumul). C'est
--                   l'attribution ACTUELLE : un client confié à un autre
--                   commercial part avec tout son historique (il n'existe
--                   pas d'historique des attributions) ; un client sans
--                   date de création compte depuis toujours.
--   new_clients     clients de la fiche créés dans la période.
--   active_clients  clients de la fiche qui ont, dans la période, un
--                   paiement terminé, un dépôt validé ou un colis reçu.
--   prospects_new   prospects ajoutés (created_at), quel que soit leur
--                   statut aujourd'hui (« À vérifier » compris).
--   prospects_won   devenus clients (status = won, daté par converted_at).
--   prospects_lost  perdus (status = lost, daté par status_changed_at).
--   payments_*      paiements TERMINÉS (completed) de ses clients, datés par
--                   coalesce(processed_at, cash_paid_at, updated_at) ;
--                   montant amount_xaf.
--   deposits_*      dépôts VALIDÉS, datés par validated_at ; montant
--                   coalesce(confirmed_amount_xaf, amount_xaf).
--   air_*           colis reçus au BUREAU de Guangzhou (dépôt « office ») :
--                   nombre et kg ; sea_* : à l'ENTREPÔT (« warehouse ») :
--                   nombre et m³. Datés par parcels.created_at ; colis des
--                   dépôts annulés exclus.
--   flights         vols (air_shipments) DISTINCTS qui emportent au moins
--                   un colis d'un client de la fiche (parcels.air_shipment_id,
--                   colis des dépôts annulés exclus). Un vol est daté par
--                   son DÉPART RÉEL (departed_at), à défaut par la création
--                   de l'expédition (vol encore en préparation) : il compte
--                   dans une seule période, et passe à celle de son départ
--                   quand il part. C'est l'état ACTUEL des chargements : un
--                   paquet refusé à l'aéroport ou retiré de l'expédition
--                   (colis détachés) ne compte plus pour ce vol.
--
-- totals          la plage entière : sommes, sauf clients_total (à la fin
--                 de la plage) et active_clients (clients distincts actifs
--                 au moins une fois dans la plage) ; flights = vols
--                 distincts (un vol n'a qu'une date : c'est aussi la somme).
-- previous_totals même calcul sur la plage de même longueur juste avant
--                 (12 mois → les 12 mois précédents).
-- funnel          les prospects AJOUTÉS dans la plage, par statut ACTUEL
--                 (aucun historique des statuts n'est tenu).
-- team            l'équipe : la somme des fiches RENVOYÉES (points, totals,
--                 previous_totals, funnel). Deux exceptions, pour ne rien
--                 compter deux fois : active_clients compte des clients
--                 distincts (un client n'a qu'une origine : c'est la somme),
--                 et flights des vols DISTINCTS — un même avion qui emporte
--                 les colis des clients de trois commerciaux est UN vol
--                 pour l'équipe.
--
-- Une seule requête ensembliste : les événements de la fenêtre (plage
-- précédente + plage) sont lus une fois, rangés dans leur période par
-- date_trunc à l'heure de Douala, puis agrégés par GROUPING SETS (fiche ×
-- période, fiche × plage, équipe × période, équipe × plage) ; une ligne
-- vide par (fiche, période) garantit les zéros. Aucune boucle par période.
-- Index utilisés (tous existants, aucun à créer) : clients_source_id_idx
-- (les clients des fiches), idx_payments_user_status, idx_deposits_user_status,
-- parcel_deposits_client_idx, parcels_deposit_idx, air_shipments_pkey,
-- prospects_source_status_idx.
--
-- Idempotente (CREATE OR REPLACE ; rejouable, y compris deux fois dans une
-- même transaction). Suppose 20261005160000 (Mes équipes + commerciaux :
-- current_commercial_source_id, _sales_scope_error, admin_has_permission
-- avec canManageSales, prospects), 20261007100000 (statut « À vérifier »)
-- et 20260921150000 (expéditions aériennes, parcels.air_shipment_id).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sales_series(
  p_from DATE,
  p_to DATE,
  p_grain TEXT DEFAULT 'month',
  p_source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager BOOLEAN := public.admin_has_permission(auth.uid(), 'canManageSales');
  v_own     UUID := public.current_commercial_source_id();
  v_grain   TEXT := lower(btrim(coalesce(p_grain, 'month')));
  v_all     BOOLEAN := false;   -- la direction, sans fiche choisie
  v_ids     UUID[];
  v_step    INTERVAL;
  v_max     INT;
  v_n       INT;
  v_from    DATE;
  v_to      DATE;
  v_prev    DATE;
  v_from_at TIMESTAMPTZ;
  v_to_at   TIMESTAMPTZ;
  v_prev_at TIMESTAMPTZ;
  v_res     JSONB;
BEGIN
  -- 1. Qui voit quoi. Le commercial : sa fiche, quoi qu'il demande.
  IF v_manager THEN
    IF p_source_id IS NULL THEN
      v_all := true;
      SELECT coalesce(array_agg(s.id), ARRAY[]::UUID[]) INTO v_ids
        FROM public.client_sources s
       WHERE s.kind = 'commercial';
    ELSIF EXISTS (SELECT 1 FROM public.client_sources WHERE id = p_source_id AND kind = 'commercial') THEN
      v_ids := ARRAY[p_source_id];
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Commercial introuvable');
    END IF;
  ELSIF v_own IS NOT NULL THEN
    v_ids := ARRAY[v_own];
  ELSE
    RETURN public._sales_scope_error();
  END IF;

  -- 2. La plage, en périodes entières de Douala.
  IF v_grain NOT IN ('month', 'week') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Découpage inconnu : « month » (mois) ou « week » (semaine)');
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le début et la fin de la plage');
  END IF;
  -- Dates extrêmes (infinity, an 300 000…) : refusées avant tout calcul de date.
  IF p_from < DATE '2000-01-01' OR p_to > DATE '2100-01-01' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plage hors limites : entre 2000 et 2100');
  END IF;
  IF p_from >= p_to THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le début de la plage doit précéder sa fin');
  END IF;

  v_step := CASE v_grain WHEN 'month' THEN interval '1 month' ELSE interval '7 days' END;
  v_max  := CASE v_grain WHEN 'month' THEN 24 ELSE 26 END;
  v_from := date_trunc(v_grain, p_from::timestamp)::date;
  v_to   := date_trunc(v_grain, p_to::timestamp)::date;
  IF v_to < p_to THEN
    v_to := (v_to + v_step)::date;
  END IF;
  v_n := CASE v_grain
           WHEN 'month' THEN (extract(year FROM v_to)::int - extract(year FROM v_from)::int) * 12
                             + extract(month FROM v_to)::int - extract(month FROM v_from)::int
           ELSE (v_to - v_from) / 7 END;
  IF v_n > v_max THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE v_grain WHEN 'month' THEN 'Plage trop longue : 24 mois au plus' ELSE 'Plage trop longue : 26 semaines au plus' END);
  END IF;
  v_prev    := (v_from - v_step * v_n)::date;
  v_from_at := v_from::timestamp AT TIME ZONE 'Africa/Douala';
  v_to_at   := v_to::timestamp AT TIME ZONE 'Africa/Douala';
  v_prev_at := v_prev::timestamp AT TIME ZONE 'Africa/Douala';

  -- 3. Les chiffres.
  WITH src AS (
    SELECT s.id, s.label, s.is_active, s.staff_user_id
      FROM public.client_sources s
     WHERE s.id = ANY(v_ids)
  ), cl AS (
    SELECT c.user_id, c.source_id, c.created_at
      FROM public.clients c
     WHERE c.source_id = ANY(v_ids)
  ), ev AS (
    -- Tout ce qui s'est passé dans la fenêtre [plage précédente, fin de la plage[ :
    -- une ligne par événement (un vol : une ligne par fiche).
    SELECT cl.source_id, NULL::uuid AS user_id, cl.created_at AS at, 'client'::text AS kind,
           NULL::numeric AS qty, NULL::uuid AS flight_id
      FROM cl
     WHERE cl.created_at >= v_prev_at AND cl.created_at < v_to_at
    UNION ALL
    SELECT cl.source_id, p.user_id, coalesce(p.processed_at, p.cash_paid_at, p.updated_at), 'pay',
           p.amount_xaf::numeric, NULL
      FROM public.payments p
      JOIN cl ON cl.user_id = p.user_id
     WHERE p.status = 'completed'
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) >= v_prev_at
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) <  v_to_at
    UNION ALL
    SELECT cl.source_id, d.user_id, d.validated_at, 'dep',
           coalesce(d.confirmed_amount_xaf, d.amount_xaf)::numeric, NULL
      FROM public.deposits d
      JOIN cl ON cl.user_id = d.user_id
     WHERE d.status = 'validated' AND d.validated_at >= v_prev_at AND d.validated_at < v_to_at
    UNION ALL
    SELECT cl.source_id, pd.client_user_id, pa.created_at,
           CASE pd.location WHEN 'office' THEN 'air' ELSE 'sea' END,
           CASE pd.location WHEN 'office' THEN pa.weight_kg ELSE pa.cbm END, NULL
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
     WHERE pd.status <> 'cancelled' AND pd.location IN ('office', 'warehouse')
       AND pa.created_at >= v_prev_at AND pa.created_at < v_to_at
    UNION ALL
    SELECT DISTINCT cl.source_id, NULL::uuid, coalesce(a.departed_at, a.created_at), 'flight',
           NULL::numeric, a.id
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
      JOIN public.air_shipments a ON a.id = pa.air_shipment_id
     WHERE pd.status <> 'cancelled'
       AND coalesce(a.departed_at, a.created_at) >= v_prev_at
       AND coalesce(a.departed_at, a.created_at) <  v_to_at
    UNION ALL
    SELECT p.source_id, NULL, p.created_at, 'p_new', NULL, NULL
      FROM public.prospects p
     WHERE p.source_id = ANY(v_ids) AND p.created_at >= v_prev_at AND p.created_at < v_to_at
    UNION ALL
    SELECT p.source_id, NULL, p.converted_at, 'p_won', NULL, NULL
      FROM public.prospects p
     WHERE p.source_id = ANY(v_ids) AND p.status = 'won'
       AND p.converted_at >= v_prev_at AND p.converted_at < v_to_at
    UNION ALL
    SELECT p.source_id, NULL, p.status_changed_at, 'p_lost', NULL, NULL
      FROM public.prospects p
     WHERE p.source_id = ANY(v_ids) AND p.status = 'lost'
       AND p.status_changed_at >= v_prev_at AND p.status_changed_at < v_to_at
  ), keep AS (
    -- Les fiches renvoyées : toutes celles demandées ; sans fiche choisie, les
    -- actives et les archivées qui ont une activité dans la plage.
    SELECT src.*
      FROM src
     WHERE NOT v_all OR src.is_active
        OR src.id IN (SELECT ev.source_id FROM ev WHERE ev.at >= v_from_at)
  ), wper AS (
    SELECT g::date AS period
      FROM generate_series(v_prev::timestamp, v_to::timestamp - v_step, v_step) g
  ), w AS (
    SELECT ev.source_id, ev.user_id, ev.kind, ev.qty, ev.flight_id,
           date_trunc(v_grain, ev.at AT TIME ZONE 'Africa/Douala')::date AS period
      FROM ev
     WHERE ev.source_id IN (SELECT id FROM keep)
    UNION ALL
    -- Une ligne vide par (fiche renvoyée, période) et par période pour
    -- l'équipe (fiche NULL) : chaque groupe existe, à zéro s'il le faut.
    SELECT k.id, NULL, 'tick', NULL, NULL, wper.period
      FROM (SELECT id FROM keep UNION ALL SELECT NULL::uuid) k
      CROSS JOIN wper
  ), agg AS (
    SELECT GROUPING(x.source_id, x.period, x.cur) AS g, x.source_id, x.period, x.cur,
           count(*) FILTER (WHERE x.kind = 'client')::int                                AS new_clients,
           count(DISTINCT x.user_id) FILTER (WHERE x.kind IN ('pay', 'dep', 'air', 'sea'))::int AS active_clients,
           count(*) FILTER (WHERE x.kind = 'p_new')::int                                 AS prospects_new,
           count(*) FILTER (WHERE x.kind = 'p_won')::int                                 AS prospects_won,
           count(*) FILTER (WHERE x.kind = 'p_lost')::int                                AS prospects_lost,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'pay'), 0)::bigint                 AS payments_xaf,
           count(*) FILTER (WHERE x.kind = 'pay')::int                                   AS payments_count,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'dep'), 0)::bigint                 AS deposits_xaf,
           count(*) FILTER (WHERE x.kind = 'dep')::int                                   AS deposits_count,
           count(*) FILTER (WHERE x.kind = 'air')::int                                   AS air_parcels,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'air'), 0)                         AS air_kg,
           count(DISTINCT x.flight_id) FILTER (WHERE x.kind = 'flight')::int             AS flights,
           count(*) FILTER (WHERE x.kind = 'sea')::int                                   AS sea_parcels,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'sea'), 0)                         AS sea_cbm
      FROM (SELECT w.*, w.period >= v_from AS cur FROM w) x
     -- g = 0 : fiche × période · 2 : fiche × plage (cur) ou plage précédente ·
     -- 4 : équipe × période · 6 : équipe × plage ou plage précédente.
     -- active_clients et flights comptent des clients et des vols DISTINCTS
     -- à chaque niveau (un client actif en janvier et en mars = 1 sur la plage).
     GROUP BY GROUPING SETS ((x.source_id, x.period, x.cur), (x.source_id, x.cur), (x.period, x.cur), (x.cur))
  ), base AS (
    -- Les clients de chaque fiche renvoyée arrivés AVANT la plage (ou sans date).
    SELECT k.id AS source_id, count(cl.user_id)::int AS n
      FROM keep k
      LEFT JOIN cl ON cl.source_id = k.id AND (cl.created_at IS NULL OR cl.created_at < v_from_at)
     GROUP BY k.id
  ), fig AS (
    SELECT a.g, a.source_id, a.cur,
           to_char(a.period, 'YYYY-MM-DD') AS period,
           (CASE WHEN a.g IN (0, 2) THEN (SELECT b.n FROM base b WHERE b.source_id = a.source_id)
                 ELSE (SELECT coalesce(sum(b.n), 0) FROM base b) END)
           + CASE WHEN a.g IN (0, 4) THEN sum(a.new_clients) OVER (PARTITION BY a.g, a.source_id ORDER BY a.period)
                  WHEN a.cur THEN a.new_clients
                  ELSE 0 END AS clients_total,
           a.new_clients, a.active_clients,
           a.prospects_new, a.prospects_won, a.prospects_lost,
           a.payments_xaf, a.payments_count, a.deposits_xaf, a.deposits_count,
           a.air_parcels, a.air_kg, a.flights, a.sea_parcels, a.sea_cbm
      FROM agg a
     WHERE (a.g = 0 AND a.source_id IS NOT NULL AND a.cur)
        OR (a.g = 2 AND a.source_id IS NOT NULL)
        OR (a.g = 4 AND a.cur)
        OR a.g = 6
  ), fun AS (
    SELECT k.id AS source_id,
           count(p.id)::int                                            AS total,
           count(p.id) FILTER (WHERE p.status = 'new')::int            AS "new",
           count(p.id) FILTER (WHERE p.status = 'contacted')::int      AS contacted,
           count(p.id) FILTER (WHERE p.status = 'interested')::int     AS interested,
           count(p.id) FILTER (WHERE p.status = 'to_verify')::int      AS to_verify,
           count(p.id) FILTER (WHERE p.status = 'won')::int            AS won,
           count(p.id) FILTER (WHERE p.status = 'lost')::int           AS lost
      FROM keep k
      LEFT JOIN public.prospects p
        ON p.source_id = k.id AND p.created_at >= v_from_at AND p.created_at < v_to_at
     GROUP BY k.id
  )
  SELECT jsonb_build_object(
           'success', true,
           'grain', v_grain,
           'from', to_char(v_from, 'YYYY-MM-DD'),
           'to', to_char(v_to, 'YYYY-MM-DD'),
           'periods', (SELECT jsonb_agg(to_char(g::date, 'YYYY-MM-DD') ORDER BY g)
                         FROM generate_series(v_from::timestamp, v_to::timestamp - v_step, v_step) g),
           'sources', coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'source_id', k.id,
                      'label', k.label,
                      'is_active', k.is_active,
                      'staff_user_id', k.staff_user_id,
                      'points', (SELECT jsonb_agg(to_jsonb(f) - ARRAY['g', 'source_id', 'cur'] ORDER BY f.period)
                                   FROM fig f WHERE f.g = 0 AND f.source_id = k.id),
                      'totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                                   FROM fig f WHERE f.g = 2 AND f.source_id = k.id AND f.cur),
                      'previous_totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                                            FROM fig f WHERE f.g = 2 AND f.source_id = k.id AND NOT f.cur),
                      'funnel', (SELECT to_jsonb(u) - 'source_id' FROM fun u WHERE u.source_id = k.id))
                    ORDER BY (k.staff_user_id IS NULL), k.is_active DESC, lower(k.label), k.id)
               FROM keep k), '[]'::jsonb),
           'team', jsonb_build_object(
             'points', (SELECT jsonb_agg(to_jsonb(f) - ARRAY['g', 'source_id', 'cur'] ORDER BY f.period)
                          FROM fig f WHERE f.g = 4),
             'totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                          FROM fig f WHERE f.g = 6 AND f.cur),
             'previous_totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                                   FROM fig f WHERE f.g = 6 AND NOT f.cur),
             'funnel', (SELECT to_jsonb(t) FROM (
                          SELECT coalesce(sum(u.total), 0)::int      AS total,
                                 coalesce(sum(u."new"), 0)::int      AS "new",
                                 coalesce(sum(u.contacted), 0)::int  AS contacted,
                                 coalesce(sum(u.interested), 0)::int AS interested,
                                 coalesce(sum(u.to_verify), 0)::int  AS to_verify,
                                 coalesce(sum(u.won), 0)::int        AS won,
                                 coalesce(sum(u.lost), 0)::int       AS lost
                            FROM fun u) t)))
    INTO v_res;

  RETURN v_res;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Droits : membres du personnel connectés ; la fonction vérifie elle-même
-- le périmètre (commercial : sa fiche ; direction : canManageSales).
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sales_series(DATE, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_series(DATE, DATE, TEXT, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Étiquette Mola (le commercial n'a pas Mola : la direction seulement)
-- ─────────────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.sales_series(date, date, text, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Évolution des ventes par commercial, mois par mois ou semaine par semaine (clients, prospects, paiements, dépôts, fret avion, vols, bateau)"}';

NOTIFY pgrst, 'reload schema';

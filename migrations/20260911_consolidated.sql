-- ============================================================================
-- Bonzini Cargo — migration CONSOLIDÉE (Supabase / PostgreSQL)
-- Générée le 2026-09-11 depuis la branche claude/bonzini-cargo-logistics-dcxcys
--
-- Contenu, dans l'ordre d'exécution :
--   1. supabase/migrations/20260911120000_cargo_module.sql
--      permissions canViewCargo / canManageCargo (admin_has_permission),
--      tables cargo_shipments / cargo_events / cargo_vessel_positions, RLS,
--      run_cargo_sync + request_cargo_sync (edge function via pg_net),
--      cron horaire, amorçage des 5 dossiers du 11/09/2026.
--   2. supabase/migrations/20260911150000_cargo_lookups_and_documents.sql
--      cargo_lookups (recherche libre), cargo_detect_carrier,
--      request_cargo_lookup, add_cargo_shipment, remove_cargo_shipment,
--      cargo_documents + bucket privé cargo-documents et ses politiques.
--
-- Idempotence : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS avant chaque CREATE POLICY, INSERT … ON CONFLICT DO
-- NOTHING pour l'amorçage, cron.unschedule avant cron.schedule. Le fichier
-- peut être rejoué sans effet de bord.
--
-- Prérequis (déjà en place pour les SMS) : secrets Vault `project_url` et
-- `service_role_key`, extensions pg_net et pg_cron. Après exécution :
--   npx supabase secrets set MAERSK_CONSUMER_KEY=…   (AISSTREAM_API_KEY facultatif)
--   npx supabase functions deploy cargo-sync
--   npx supabase functions deploy cargo-lookup
--
-- NB : les deux fichiers d'origine restent la source pour `supabase db push`.
-- N'exécute ce fichier consolidé QUE si tu appliques le SQL à la main (SQL
-- editor) — pas les deux.
-- ============================================================================

-- ############################################################################
-- SECTION 1 — 20260911120000_cargo_module.sql
-- ############################################################################
-- ============================================================
-- Bonzini Cargo — module de suivi des conteneurs (étape 1 : la carte).
--
-- Trois tables :
--   cargo_shipments        une ligne par conteneur suivi (le dossier)
--   cargo_events           les jalons DCSA renvoyés par l'armateur
--   cargo_vessel_positions la dernière position AIS connue de chaque navire
--
-- Les écritures viennent de l'edge function `cargo-sync` (service role) ;
-- l'app admin ne fait que LIRE, sous garde `admin_has_permission`.
-- Deux permissions nouvelles, miroir de ROLE_PERMISSIONS :
--   canViewCargo   → super_admin, ops, support, customer_success
--   canManageCargo → super_admin, ops
-- ============================================================

-- ── 1) Permissions : redéfinition intégrale du miroir SQL ─────────────────
-- (le test src/tests/security/rolePermissionParity.test.ts lit la DERNIÈRE
--  migration qui définit cette fonction — garder la matrice complète ici.)
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
        ELSE false
      END
  );
$fn$;

COMMENT ON FUNCTION public.admin_has_permission(UUID, TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewLogs","label":"Verifier une permission admin (miroir SQL de ROLE_PERMISSIONS)"}';

-- ── 2) Tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_shipments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_label      text NOT NULL,                       -- « PRC », « GAUSS »… (libellé du transitaire)
  client_id         uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  carrier           text NOT NULL CHECK (carrier IN ('MAERSK','CMA_CGM','MSC','COSCO','OTHER')),
  bl_number         text NOT NULL,
  container_number  text NOT NULL UNIQUE,
  container_iso     text,                                -- 45G1 = 40' High Cube
  pol_name          text,  pol_unlocode text,
  pod_name          text NOT NULL, pod_unlocode text,
  etd_promised      date,                                -- ce que le transitaire a annoncé
  eta_promised      date,
  etd_actual        timestamptz,                         -- ce que l'armateur a mesuré
  eta_carrier       timestamptz,
  vessel_name       text, vessel_imo text, vessel_mmsi text, voyage text,
  freight_usd       numeric(12,2) CHECK (freight_usd IS NULL OR freight_usd >= 0),
  freight_paid      boolean NOT NULL DEFAULT false,
  telex_released    boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'UNKNOWN'
                    CHECK (status IN ('BOOKED','AT_ORIGIN','AT_SEA','ARRIVED','DELIVERED','UNKNOWN')),
  last_event_at     timestamptz,
  last_event_label  text,
  last_synced_at    timestamptz,
  sync_error        text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cargo_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id    uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  carrier_event_id text NOT NULL,
  event_type     text NOT NULL,                          -- SHIPMENT | EQUIPMENT | TRANSPORT
  event_code     text NOT NULL,                          -- CONF, GTIN, LOAD, DEPA, ARRI…
  classifier     text NOT NULL DEFAULT 'ACT',            -- ACT (réel) | EST (prévu) | PLN
  event_time     timestamptz NOT NULL,
  location_name  text, unlocode text,
  latitude       double precision, longitude double precision,
  vessel_name    text, vessel_imo text, voyage text,
  raw            jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shipment_id, carrier_event_id)
);
CREATE INDEX IF NOT EXISTS cargo_events_shipment_time_idx ON public.cargo_events (shipment_id, event_time);

CREATE TABLE IF NOT EXISTS public.cargo_vessel_positions (
  vessel_imo   text PRIMARY KEY,
  vessel_mmsi  text,
  vessel_name  text,
  latitude     double precision NOT NULL,
  longitude    double precision NOT NULL,
  speed_kn     numeric(5,1),
  course_deg   numeric(5,1),
  destination  text,
  eta          timestamptz,
  reported_at  timestamptz NOT NULL,
  source       text NOT NULL DEFAULT 'manual',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.cargo_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS cargo_shipments_touch ON public.cargo_shipments;
CREATE TRIGGER cargo_shipments_touch BEFORE UPDATE ON public.cargo_shipments
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();
DROP TRIGGER IF EXISTS cargo_vessel_positions_touch ON public.cargo_vessel_positions;
CREATE TRIGGER cargo_vessel_positions_touch BEFORE UPDATE ON public.cargo_vessel_positions
  FOR EACH ROW EXECUTE FUNCTION public.cargo_touch_updated_at();

-- ── 3) RLS : lecture sous permission, écriture réservée au service role ──
ALTER TABLE public.cargo_shipments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_vessel_positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargo_shipments_read ON public.cargo_shipments;
CREATE POLICY cargo_shipments_read ON public.cargo_shipments
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
-- Les seuls champs que l'admin édite à la main (paiement, télex, notes) :
-- l'edge function ne les touche jamais.
DROP POLICY IF EXISTS cargo_shipments_manage ON public.cargo_shipments;
CREATE POLICY cargo_shipments_manage ON public.cargo_shipments
  FOR UPDATE TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageCargo'))
  WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo'));

DROP POLICY IF EXISTS cargo_events_read ON public.cargo_events;
CREATE POLICY cargo_events_read ON public.cargo_events
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

DROP POLICY IF EXISTS cargo_vessel_positions_read ON public.cargo_vessel_positions;
CREATE POLICY cargo_vessel_positions_read ON public.cargo_vessel_positions
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

-- ── 4) Synchronisation : appel de l'edge function via pg_net ─────────────
-- Fonction interne (cron) — jamais exposée.
CREATE OR REPLACE FUNCTION public.run_cargo_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url         TEXT;
  v_service_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url         FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  IF v_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'run_cargo_sync: secrets Vault manquants (project_url / service_role_key) — appel ignoré';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/cargo-sync',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        v_service_key,
      'Authorization', 'Bearer ' || v_service_key
    ),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'run_cargo_sync failed: %', SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.run_cargo_sync() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.run_cargo_sync() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Lancer la synchronisation cargo (interne, cron)"}';

-- Bouton « Rafraîchir » de l'écran : un admin autorisé déclenche le même appel.
CREATE OR REPLACE FUNCTION public.request_cargo_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  PERFORM public.run_cargo_sync();
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.request_cargo_sync() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_cargo_sync() TO authenticated;
COMMENT ON FUNCTION public.request_cargo_sync() IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCargo","confirm":false,"danger":false,"label":"Rafraîchir le suivi des conteneurs (positions et jalons)"}';

-- Toutes les heures : les jalons Maersk et les positions bougent lentement.
DO $$
BEGIN
  PERFORM cron.unschedule('cargo-sync-hourly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cargo-sync-hourly');
  PERFORM cron.schedule('cargo-sync-hourly', '15 * * * *', $cron$ SELECT public.run_cargo_sync(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Planification cron cargo-sync-hourly impossible (pg_cron activé ?): %', SQLERRM;
END;
$$;

-- ── 5) Amorçage : les cinq dossiers du transitaire (tableau du 11/09/2026) ─
INSERT INTO public.cargo_shipments
  (client_label, carrier, bl_number, container_number, container_iso, pol_name, pol_unlocode, pod_name, pod_unlocode,
   etd_promised, eta_promised, etd_actual, eta_carrier, vessel_name, vessel_imo, vessel_mmsi, voyage, freight_usd, status, last_event_at, last_event_label)
VALUES
  ('PRC',    'CMA_CGM', 'GGZ3133535', 'CMAU6126032', NULL,   NULL,     NULL,    'Douala', 'CMDLA', '2026-08-04', '2026-09-17', NULL, NULL, NULL, NULL, NULL, NULL, 6650, 'UNKNOWN', NULL, NULL),
  ('GAUSS',  'MAERSK',  '274428633',  'MIEU3611115', '45G1', 'Nansha', 'CNNSA', 'Kribi',  'CMKBI', '2026-08-15', '2026-09-27', '2026-08-15T23:38:00Z', '2026-10-11T10:00:00Z', 'CMA CGM LAPEROUSE', '9454412', '215930000', '631W', 6550, 'AT_SEA', '2026-08-15T23:38:00Z', 'Navire parti de Nansha'),
  ('PRC',    'MAERSK',  '275558999',  'MRKU4617437', '45G1', 'Nansha', 'CNNSA', 'Kribi',  'CMKBI', '2026-08-23', '2026-10-05', '2026-08-24T02:26:00Z', '2026-10-15T01:00:00Z', 'CMA CGM CEDRUS',    '9938121', '256615000', '633W', 5950, 'AT_SEA', '2026-08-24T02:26:00Z', 'Navire parti de Nansha'),
  ('PRC',    'MAERSK',  '275926835',  'MRSU7972968', '45G1', 'Nansha', 'CNNSA', 'Kribi',  'CMKBI', '2026-09-05', '2026-10-12', '2026-09-04T18:31:00Z', '2026-10-18T11:00:00Z', 'CMA CGM PRIDE',     '9924429', '229997000', '634W', 5650, 'AT_SEA', '2026-09-04T18:31:00Z', 'Navire parti de Nansha'),
  ('DJIANI', 'MAERSK',  '275926916',  'CAJU5023560', '45G1', 'Nansha', 'CNNSA', 'Kribi',  'CMKBI', '2026-09-05', '2026-10-12', '2026-09-04T18:31:00Z', '2026-10-18T11:00:00Z', 'CMA CGM PRIDE',     '9924429', '229997000', '634W', 5750, 'AT_SEA', '2026-09-04T18:31:00Z', 'Navire parti de Nansha')
ON CONFLICT (container_number) DO NOTHING;

-- Dernières positions AIS relevées à la main le 11/09/2026 (remplacées par
-- la synchronisation dès qu'une source AIS est branchée).
INSERT INTO public.cargo_vessel_positions
  (vessel_imo, vessel_mmsi, vessel_name, latitude, longitude, speed_kn, course_deg, destination, eta, reported_at, source)
VALUES
  ('9454412', '215930000', 'CMA CGM LAPEROUSE', -20.42261,   9.91970, 12.4, 333.2, 'CIABJ', '2026-09-17T06:00:00Z', '2026-09-10T22:47:00Z', 'manual'),
  ('9938121', '256615000', 'CMA CGM CEDRUS',      2.56352, 101.51508, 13.6, 310.6, 'CIABJ', '2026-09-27T17:00:00Z', '2026-09-01T12:46:00Z', 'manual'),
  ('9924429', '229997000', 'CMA CGM PRIDE',       1.78142, 102.62114, 17.4, 301.6, 'CIABJ', '2026-10-04T07:00:00Z', '2026-09-11T21:49:00Z', 'manual')
ON CONFLICT (vessel_imo) DO NOTHING;

-- ############################################################################
-- SECTION 2 — 20260911150000_cargo_lookups_and_documents.sql
-- ############################################################################
-- ============================================================
-- Bonzini Cargo v2 — suivre une référence, ajouter à la flotte, documents.
--
-- cargo_lookups   : une recherche (B/L, booking ou conteneur) et son résultat
--                   normalisé. Le front sonde la ligne jusqu'à `done`.
-- cargo_documents : les pièces d'un dossier (B/L, facture, télex…), fichiers
--                   dans le bucket privé `cargo-documents`.
-- RPC             : request_cargo_lookup · add_cargo_shipment · remove_cargo_shipment
-- ============================================================

-- ── 1) Recherches ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_lookups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text NOT NULL,
  reference_type text NOT NULL CHECK (reference_type IN ('BL','CONTAINER')),
  carrier        text NOT NULL CHECK (carrier IN ('MAERSK','CMA_CGM','MSC','COSCO','UNKNOWN')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','error','unsupported')),
  result         jsonb,
  error          text,
  requested_by   uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS cargo_lookups_created_idx ON public.cargo_lookups (created_at DESC);
ALTER TABLE public.cargo_lookups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_lookups_read ON public.cargo_lookups;
CREATE POLICY cargo_lookups_read ON public.cargo_lookups
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));

-- Détection de l'armateur depuis la forme de la référence. Volontairement
-- simple : ce qu'on sait interroger aujourd'hui (Maersk), et ce qu'on sait
-- reconnaître sans pouvoir l'interroger (CMA CGM), pour le dire honnêtement.
CREATE OR REPLACE FUNCTION public.cargo_detect_carrier(p_ref text)
RETURNS TABLE (carrier text, reference_type text)
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT
    CASE
      WHEN p_ref ~ '^[0-9]{9}$' THEN 'MAERSK'
      WHEN p_ref ~ '^(MAEU|MRKU|MRSU|MSKU|MIEU|SUDU|SEAU|MWCU|MNBU|HASU|TCNU)[0-9]{7}$' THEN 'MAERSK'
      WHEN p_ref ~ '^(CMAU|ECMU|CGMU|APZU|APHU|APRU|CMCU|ANNU)[0-9]{7}$' THEN 'CMA_CGM'
      WHEN p_ref ~ '^(MSCU|MEDU|MSMU|MSDU)[0-9]{7}$' THEN 'MSC'
      WHEN p_ref ~ '^(COSU|CBHU|CCLU|CSNU|CSLU|OOLU|OOCU)[0-9]{7}$' THEN 'COSCO'
      WHEN p_ref ~ '^[A-Z]{4}[0-9]{7}$' THEN 'MAERSK'          -- boîte louée (CAJU, TGHU…) : on tente Maersk
      WHEN p_ref ~ '^[A-Z]{3}[0-9]{7}$' THEN 'CMA_CGM'         -- B/L CMA CGM : GGZ1234567
      WHEN p_ref ~ '^MEDU[A-Z0-9]{6,}$' THEN 'MSC'
      ELSE 'UNKNOWN'
    END,
    CASE WHEN p_ref ~ '^[A-Z]{4}[0-9]{7}$' THEN 'CONTAINER' ELSE 'BL' END;
$$;
REVOKE ALL ON FUNCTION public.cargo_detect_carrier(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cargo_detect_carrier(text) TO authenticated;
COMMENT ON FUNCTION public.cargo_detect_carrier(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Reconnaitre l''armateur d''une reference (pure)"}';

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
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_ref) < 6 OR length(v_ref) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Référence trop courte ou trop longue');
  END IF;
  SELECT d.carrier, d.reference_type INTO v_carrier, v_type FROM public.cargo_detect_carrier(v_ref) d;

  INSERT INTO public.cargo_lookups (reference, reference_type, carrier, status, requested_by, error, completed_at)
  VALUES (
    v_ref, v_type, v_carrier,
    CASE WHEN v_carrier = 'MAERSK' THEN 'pending' ELSE 'unsupported' END,
    auth.uid(),
    CASE
      WHEN v_carrier = 'CMA_CGM' THEN 'Référence CMA CGM reconnue : l''accès à leur API est en attente. Vérifie sur cma-cgm.com en attendant.'
      WHEN v_carrier = 'UNKNOWN' THEN 'Format non reconnu. Attendu : B/L Maersk (9 chiffres) ou numéro de conteneur (4 lettres + 7 chiffres).'
      WHEN v_carrier <> 'MAERSK' THEN 'Armateur reconnu (' || v_carrier || ') mais pas encore interrogeable : agrégateur à brancher.'
      ELSE NULL
    END,
    CASE WHEN v_carrier = 'MAERSK' THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;

  IF v_carrier = 'MAERSK' THEN
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

-- ── 2) Ajouter un conteneur trouvé à la flotte ────────────────────────────
CREATE OR REPLACE FUNCTION public.add_cargo_shipment(
  p_lookup_id uuid,
  p_container_number text,
  p_client_label text,
  p_freight_usd numeric DEFAULT NULL,
  p_eta_promised date DEFAULT NULL,
  p_etd_promised date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lookup  public.cargo_lookups%ROWTYPE;
  v_ctr     jsonb;
  v_ev      jsonb;
  v_id      uuid;
  v_ctr_num text := upper(regexp_replace(coalesce(p_container_number, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le fret doit être positif');
  END IF;
  IF length(trim(coalesce(p_client_label, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indique le client');
  END IF;
  SELECT * INTO v_lookup FROM public.cargo_lookups WHERE id = p_lookup_id;
  IF v_lookup.id IS NULL OR v_lookup.status <> 'done' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recherche introuvable ou non terminée');
  END IF;
  SELECT c INTO v_ctr FROM jsonb_array_elements(coalesce(v_lookup.result->'containers', '[]'::jsonb)) c
   WHERE upper(c->>'number') = v_ctr_num LIMIT 1;
  IF v_ctr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce conteneur ne fait pas partie du résultat');
  END IF;
  IF EXISTS (SELECT 1 FROM public.cargo_shipments WHERE container_number = v_ctr_num) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce conteneur est déjà dans la flotte');
  END IF;

  INSERT INTO public.cargo_shipments
    (client_label, carrier, bl_number, container_number, container_iso, pol_name, pol_unlocode, pod_name, pod_unlocode,
     etd_promised, eta_promised, etd_actual, eta_carrier, vessel_name, vessel_imo, vessel_mmsi, voyage, freight_usd,
     status, last_event_at, last_event_label, last_synced_at)
  VALUES
    (trim(p_client_label), v_lookup.carrier, coalesce(v_lookup.result->>'bl_number', v_lookup.reference), v_ctr_num,
     v_ctr->>'iso', v_ctr->'pol'->>'name', v_ctr->'pol'->>'unlocode',
     coalesce(v_ctr->'pod'->>'name', 'Destination inconnue'), v_ctr->'pod'->>'unlocode',
     p_etd_promised, p_eta_promised,
     (v_ctr->>'etd_actual')::timestamptz, (v_ctr->>'eta_carrier')::timestamptz,
     v_ctr->'vessel'->>'name', v_ctr->'vessel'->>'imo', NULL, v_ctr->>'voyage', p_freight_usd,
     coalesce(v_ctr->>'status', 'UNKNOWN'), (v_ctr->>'last_event_at')::timestamptz, v_ctr->>'last_event_label', now())
  RETURNING id INTO v_id;

  FOR v_ev IN SELECT e FROM jsonb_array_elements(coalesce(v_ctr->'events', '[]'::jsonb)) e LOOP
    INSERT INTO public.cargo_events
      (shipment_id, carrier_event_id, event_type, event_code, classifier, event_time, location_name, unlocode,
       latitude, longitude, vessel_name, vessel_imo, voyage, raw)
    VALUES
      (v_id, v_ev->>'id', v_ev->>'type', v_ev->>'code', coalesce(v_ev->>'classifier', 'ACT'), (v_ev->>'time')::timestamptz,
       v_ev->>'location', v_ev->>'unlocode', (v_ev->>'lat')::double precision, (v_ev->>'lon')::double precision,
       v_ev->>'vessel', v_ev->>'imo', v_ev->>'voyage', v_ev->'raw')
    ON CONFLICT (shipment_id, carrier_event_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'shipment_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.add_cargo_shipment(uuid, text, text, numeric, date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.add_cargo_shipment(uuid, text, text, numeric, date, date) TO authenticated;
COMMENT ON FUNCTION public.add_cargo_shipment(uuid, text, text, numeric, date, date) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Ajouter un conteneur trouve a la flotte suivie"}';

CREATE OR REPLACE FUNCTION public.remove_cargo_shipment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  DELETE FROM public.cargo_shipments WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dossier introuvable');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.remove_cargo_shipment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_cargo_shipment(uuid) TO authenticated;
COMMENT ON FUNCTION public.remove_cargo_shipment(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":true,"label":"Retirer un conteneur de la flotte suivie"}';

-- ── 3) Documents du dossier ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  uuid NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('BL','INVOICE','PACKING_LIST','TELEX','BESC','CUSTOMS','OTHER')),
  file_name    text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type    text,
  size_bytes   integer CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by  uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cargo_documents_shipment_idx ON public.cargo_documents (shipment_id, created_at DESC);
ALTER TABLE public.cargo_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cargo_documents_read ON public.cargo_documents;
CREATE POLICY cargo_documents_read ON public.cargo_documents
  FOR SELECT TO authenticated USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS cargo_documents_insert ON public.cargo_documents;
CREATE POLICY cargo_documents_insert ON public.cargo_documents
  FOR INSERT TO authenticated WITH CHECK (public.admin_has_permission(auth.uid(), 'canManageCargo') AND uploaded_by = auth.uid());
DROP POLICY IF EXISTS cargo_documents_delete ON public.cargo_documents;
CREATE POLICY cargo_documents_delete ON public.cargo_documents
  FOR DELETE TO authenticated USING (public.admin_has_permission(auth.uid(), 'canManageCargo'));

-- Bucket privé, 10 Mo, PDF et images — même garde-fou que les preuves.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cargo-documents', 'cargo-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Cargo staff can read cargo documents" ON storage.objects;
CREATE POLICY "Cargo staff can read cargo documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cargo-documents' AND public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS "Cargo managers can upload cargo documents" ON storage.objects;
CREATE POLICY "Cargo managers can upload cargo documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cargo-documents' AND public.admin_has_permission(auth.uid(), 'canManageCargo'));
DROP POLICY IF EXISTS "Cargo managers can delete cargo documents" ON storage.objects;
CREATE POLICY "Cargo managers can delete cargo documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cargo-documents' AND public.admin_has_permission(auth.uid(), 'canManageCargo'));

-- ############################################################################
-- FIN — recharger le cache PostgREST pour exposer les nouvelles RPC.
-- ############################################################################
NOTIFY pgrst, 'reload schema';

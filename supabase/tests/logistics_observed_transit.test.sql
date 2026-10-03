-- ============================================================================
-- Douane, étape 8 — les délais observés (20260930150000_logistics_observed_transit.sql) :
-- le bon calcul, les bonnes exclusions, et rien d'individuel ne sort.
-- ============================================================================
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public._assert(cond BOOLEAN, msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', msg; END IF; END $$;
GRANT EXECUTE ON FUNCTION public._assert(BOOLEAN, TEXT) TO anon, authenticated, service_role;

-- ── Nansha > Kribi : 4 boîtes arrivées (38, 41, 44, 50 jours), promises à 35 jours.
INSERT INTO public.cargo_shipments (container_number, pol_unlocode, pod_unlocode, etd_promised, eta_promised, etd_actual, eta_carrier, status) VALUES
  ('NSA0000001', 'CNNSA', 'CMKBI', current_date - 100, current_date - 65, now() - interval '100 days', now() - interval '62 days', 'DELIVERED'),
  ('NSA0000002', 'cnnsa', 'cmkbi', current_date - 90,  current_date - 55, now() - interval '90 days',  now() - interval '49 days', 'ARRIVED'),
  ('NSA0000003', 'CNNSA', 'CMKBI', current_date - 80,  current_date - 45, now() - interval '80 days',  now() - interval '36 days', 'DELIVERED'),
  -- Celle-ci : l'ETA armateur est fausse (70 j), mais l'arrivée constatée (ARRI à Kribi) dit 50 jours.
  ('NSA0000004', 'CNNSA', 'CMKBI', current_date - 70,  current_date - 35, now() - interval '70 days',  now(), 'DELIVERED');
INSERT INTO public.cargo_events (shipment_id, event_code, classifier, event_time, unlocode)
  SELECT id, 'ARRI', 'ACT', now() - interval '20 days', 'CMKBI' FROM public.cargo_shipments WHERE container_number = 'NSA0000004';
-- Un ARRI seulement prévu (EST) ou ailleurs (escale à Lomé) ne compte pas.
INSERT INTO public.cargo_events (shipment_id, event_code, classifier, event_time, unlocode)
  SELECT id, 'ARRI', 'EST', now() - interval '90 days', 'CMKBI' FROM public.cargo_shipments WHERE container_number = 'NSA0000001';
INSERT INTO public.cargo_events (shipment_id, event_code, classifier, event_time, unlocode)
  SELECT id, 'ARRI', 'ACT', now() - interval '80 days', 'TGLFW' FROM public.cargo_shipments WHERE container_number = 'NSA0000001';

-- ── Exclus : en mer, trop vieux, absurde, sans départ, sans ligne.
INSERT INTO public.cargo_shipments (container_number, pol_unlocode, pod_unlocode, etd_actual, eta_carrier, status) VALUES
  ('OUT0000001', 'CNNSA', 'CMKBI', now() - interval '20 days', now() + interval '20 days', 'AT_SEA'),
  ('OUT0000002', 'CNNSA', 'CMKBI', now() - interval '700 days', now() - interval '660 days', 'DELIVERED'),
  ('OUT0000003', 'CNNSA', 'CMKBI', now() - interval '30 days', now() - interval '28 days', 'DELIVERED'),
  ('OUT0000004', 'CNNSA', 'CMKBI', NULL, now() - interval '10 days', 'DELIVERED'),
  ('OUT0000005', NULL, 'CMKBI', now() - interval '60 days', now() - interval '15 days', 'DELIVERED');
-- Sans etd_actual mais avec un DEPA constaté au port de départ : compte (Shanghai > Douala, 2 boîtes seulement).
INSERT INTO public.cargo_shipments (container_number, pol_unlocode, pod_unlocode, etd_actual, eta_carrier, status) VALUES
  ('SHA0000001', 'CNSHA', 'CMDLA', now() - interval '60 days', now() - interval '15 days', 'DELIVERED'),
  ('SHA0000002', 'CNSHA', 'CMDLA', NULL, now() - interval '10 days', 'DELIVERED');
INSERT INTO public.cargo_events (shipment_id, event_code, classifier, event_time, unlocode)
  SELECT id, 'DEPA', 'ACT', now() - interval '58 days', 'CNSHA' FROM public.cargo_shipments WHERE container_number = 'SHA0000002';

-- ── Avion Guangzhou > Douala : 5, 6, 9 jours ; un vol encore en l'air ne compte pas.
INSERT INTO public.air_shipments (awb_number, origin, destination, status, etd, eta, departed_at, arrived_at) VALUES
  ('071-00000001', 'Guangzhou (CAN)', 'Douala (DLA)', 'DELIVERED', current_date - 40, current_date - 35, now() - interval '40 days', now() - interval '35 days'),
  ('071-00000002', 'Guangzhou (CAN)', 'Douala (DLA)', 'ARRIVED',   current_date - 30, current_date - 25, now() - interval '30 days', now() - interval '24 days'),
  ('071-00000003', 'Guangzhou (CAN)', 'Douala (DLA)', 'DELIVERED', current_date - 20, current_date - 15, now() - interval '20 days', now() - interval '11 days'),
  ('071-00000004', 'Guangzhou (CAN)', 'Douala (DLA)', 'DEPARTED',  current_date - 2,  current_date + 3,  now() - interval '2 days', NULL),
  ('071-00000005', 'Canton', 'Douala', 'DELIVERED', NULL, NULL, now() - interval '20 days', now() - interval '14 days');

-- ── Tout le monde peut lire (l'Atlas est public), et ne lit que des agrégats.
SET ROLE anon;
DO $$
DECLARE r JSONB := public.logistics_observed_transit(); v JSONB; w JSONB;
BEGIN
  PERFORM _assert((r ->> 'window_months')::int = 18 AND (r ->> 'min_count')::int = 3, 'fenêtre et seuil annoncés');
  PERFORM _assert(jsonb_array_length(r -> 'lanes') = 2, 'deux lignes : Nansha>Kribi et Guangzhou>Douala (Shanghai n''a que 2 boîtes) — ' || (r -> 'lanes')::text);

  SELECT x INTO v FROM jsonb_array_elements(r -> 'lanes') x WHERE x ->> 'lane' = 'CNNSA>CMKBI';
  PERFORM _assert(v ->> 'mode' = 'sea' AND (v ->> 'n')::int = 4, 'mer : 4 boîtes, casse des codes ignorée — ' || v::text);
  PERFORM _assert((v ->> 'median')::int = 43, 'mer : médiane de 38, 41, 44, 50 = 42,5 → 43 — ' || v::text);
  PERFORM _assert((v ->> 'p25')::int = 40 AND (v ->> 'p75')::int = 46, 'mer : quartiles 40,25 → 40 et 45,5 → 46 — ' || v::text);
  PERFORM _assert((v ->> 'promised_median')::int = 35, 'mer : promis 35 jours');
  PERFORM _assert((v ->> 'late_share')::numeric = 1.00, 'mer : toutes arrivées plus de 2 jours après la promesse');
  PERFORM _assert(NOT (v ? 'container_number') AND NOT (v ? 'client_label') AND NOT (v ? 'arrived_at'), 'aucun détail individuel');

  SELECT x INTO w FROM jsonb_array_elements(r -> 'lanes') x WHERE x ->> 'lane' = 'CAN>DLA';
  PERFORM _assert(w ->> 'mode' = 'air' AND (w ->> 'n')::int = 3 AND (w ->> 'median')::int = 6, 'air : 3 vols, médiane 6 jours — ' || w::text);
  PERFORM _assert((w ->> 'late_share')::numeric = 0.33, 'air : un vol sur trois en retard de plus de 2 jours — ' || w::text);
END $$;
RESET ROLE;

-- ── Le seuil : une troisième boîte Shanghai > Douala fait apparaître la ligne.
INSERT INTO public.cargo_shipments (container_number, pol_unlocode, pod_unlocode, etd_actual, eta_carrier, status) VALUES
  ('SHA0000003', 'CNSHA', 'CMDLA', now() - interval '70 days', now() - interval '22 days', 'DELIVERED');
SET ROLE authenticated;
SELECT _assert(jsonb_array_length(public.logistics_observed_transit() -> 'lanes') = 3, 'trois boîtes : la ligne Shanghai > Douala apparaît');
SELECT _assert((SELECT (x ->> 'median')::int FROM jsonb_array_elements(public.logistics_observed_transit() -> 'lanes') x WHERE x ->> 'lane' = 'CNSHA>CMDLA') = 48,
               'Shanghai > Douala : 45, 48 (départ lu sur le DEPA constaté), 48 → médiane 48');
RESET ROLE;

-- ── Les tables restent fermées : la fonction est la seule porte.
SET ROLE anon;
SELECT _assert((SELECT count(*) FROM public.cargo_shipments) = 0, 'anon ne lit pas les conteneurs');
RESET ROLE;

-- ── L'étiquette Mola.
SELECT _assert(obj_description('public.logistics_observed_transit()'::regprocedure, 'pg_proc') LIKE '@mola:{"expose":true,"kind":"read"%', 'étiquette Mola');

\echo '✓ logistics_observed_transit : toutes les règles tiennent'

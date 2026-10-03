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

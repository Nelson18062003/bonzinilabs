-- ============================================================
-- Bonzini Cargo — un suivi qui reste vrai quand les flux se taisent.
--
-- Le 03/10/2026, la fiche de MIEU3611115 affichait une position vieille de
-- 22 jours (aucune source AIS n'est branchée : AISSTREAM_API_KEY absent),
-- un parcours figé sur la ligne WAX1 (Lekki avant Kribi) et une arrivée au
-- 7 octobre, alors que Flexport Atlas montrait le navire au mouillage
-- devant Kribi, escale du 3 au 4 octobre. L'équipe voyait le vrai ; la
-- fiche ne savait pas l'écrire.
--
--   1. eta_manual (+ note, + date de saisie) : l'arrivée CONSTATÉE ou
--      relevée par l'équipe, avec sa source. Elle passe devant celle de
--      l'armateur, qui reste affichée à côté ;
--   2. route_calls : les ESCALES réelles du voyage (port, arrivée, départ,
--      note), éditables, au lieu d'une ligne figée ;
--   3. cargo_set_vessel_position : poser à la main la dernière position
--      d'un navire (relevée sur Atlas, VesselFinder…), avec sa source.
--      Gardée par canManageCargo, coordonnées bornées, étiquetée @mola.
-- Idempotent.
-- ============================================================

ALTER TABLE public.cargo_shipments
  ADD COLUMN IF NOT EXISTS eta_manual      timestamptz,
  ADD COLUMN IF NOT EXISTS eta_manual_note text CHECK (eta_manual_note IS NULL OR char_length(eta_manual_note) <= 500),
  ADD COLUMN IF NOT EXISTS eta_manual_at   timestamptz,
  ADD COLUMN IF NOT EXISTS route_calls     jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.cargo_shipments DROP CONSTRAINT IF EXISTS cargo_shipments_route_calls_array;
ALTER TABLE public.cargo_shipments ADD CONSTRAINT cargo_shipments_route_calls_array
  CHECK (jsonb_typeof(route_calls) = 'array' AND jsonb_array_length(route_calls) <= 30);

COMMENT ON COLUMN public.cargo_shipments.eta_manual IS
  'Arrivée relevée par l''équipe (Atlas, consignataire, avis d''arrivée). Passe devant eta_carrier à l''affichage ; eta_manual_note dit la source.';
COMMENT ON COLUMN public.cargo_shipments.route_calls IS
  'Escales du voyage : [{id, name, unlocode, eta, etd, ata, atd, note}] (dates ISO). Vide = départ et arrivée seulement.';

ALTER TABLE public.cargo_vessel_positions
  ADD COLUMN IF NOT EXISTS note text CHECK (note IS NULL OR char_length(note) <= 300);

COMMENT ON COLUMN public.cargo_vessel_positions.note IS
  'Pour une position posée à la main (source = manual) : d''où elle vient (« Flexport Atlas, capture du 03/10 »).';

CREATE OR REPLACE FUNCTION public.cargo_set_vessel_position(
  p_imo text,
  p_latitude double precision,
  p_longitude double precision,
  p_reported_at timestamptz DEFAULT now(),
  p_speed_kn numeric DEFAULT NULL,
  p_course_deg numeric DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_mmsi text;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_imo IS NULL OR p_imo !~ '^[0-9]{7}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro IMO invalide (7 chiffres)');
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Coordonnées hors limites');
  END IF;
  IF p_reported_at IS NULL OR p_reported_at > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Date de relevé dans le futur');
  END IF;
  IF p_speed_kn IS NOT NULL AND (p_speed_kn < 0 OR p_speed_kn > 40) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vitesse invraisemblable');
  END IF;
  IF p_course_deg IS NOT NULL AND (p_course_deg < 0 OR p_course_deg >= 360) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cap entre 0 et 359');
  END IF;

  -- Le navire doit être celui d'un dossier : on ne crée pas de position pour un inconnu.
  SELECT vessel_name, vessel_mmsi INTO v_name, v_mmsi
  FROM public.cargo_shipments WHERE vessel_imo = p_imo ORDER BY updated_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun conteneur suivi sur ce navire');
  END IF;

  INSERT INTO public.cargo_vessel_positions AS vp
    (vessel_imo, vessel_mmsi, vessel_name, latitude, longitude, speed_kn, course_deg, reported_at, source, note, updated_at)
  VALUES (p_imo, v_mmsi, v_name, p_latitude, p_longitude, p_speed_kn, p_course_deg, p_reported_at, 'manual', left(btrim(p_note), 300), now())
  ON CONFLICT (vessel_imo) DO UPDATE SET
    latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, speed_kn = EXCLUDED.speed_kn, course_deg = EXCLUDED.course_deg,
    reported_at = EXCLUDED.reported_at, source = 'manual', note = EXCLUDED.note, updated_at = now(),
    vessel_name = COALESCE(vp.vessel_name, EXCLUDED.vessel_name), vessel_mmsi = COALESCE(vp.vessel_mmsi, EXCLUDED.vessel_mmsi)
  -- Une saisie plus ancienne que la position connue ne l'écrase pas.
  WHERE vp.reported_at <= EXCLUDED.reported_at;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cargo_set_vessel_position(text, double precision, double precision, timestamptz, numeric, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cargo_set_vessel_position(text, double precision, double precision, timestamptz, numeric, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.cargo_set_vessel_position(text, double precision, double precision, timestamptz, numeric, numeric, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Poser à la main la position d''un navire (relevée sur Atlas, VesselFinder…)"}';

NOTIFY pgrst, 'reload schema';

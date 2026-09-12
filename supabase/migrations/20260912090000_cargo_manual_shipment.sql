-- ============================================================
-- Bonzini Cargo — ajouter un conteneur SANS suivi armateur.
--
-- Tant qu'un armateur n'est pas interrogeable (CMA CGM : accès API en
-- attente), l'ops doit pouvoir enregistrer le dossier à la main : client,
-- armateur, B/L, boîte, port d'arrivée, dates promises, fret. Le navire
-- peut être renseigné ensuite depuis le dossier (menu ⋯ → Renseigner le
-- navire) ; la position vient alors de l'AIS, comme pour les autres.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_cargo_shipment_manual(
  p_client_label text,
  p_carrier text,
  p_bl_number text,
  p_container_number text,
  p_pod_name text,
  p_pod_unlocode text DEFAULT NULL,
  p_pol_name text DEFAULT NULL,
  p_pol_unlocode text DEFAULT NULL,
  p_etd_promised date DEFAULT NULL,
  p_eta_promised date DEFAULT NULL,
  p_freight_usd numeric DEFAULT NULL,
  p_vessel_name text DEFAULT NULL,
  p_vessel_imo text DEFAULT NULL,
  p_vessel_mmsi text DEFAULT NULL,
  p_voyage text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctr text := upper(regexp_replace(coalesce(p_container_number, ''), '[^A-Za-z0-9]', '', 'g'));
  v_bl  text := upper(regexp_replace(coalesce(p_bl_number, ''), '[^A-Za-z0-9]', '', 'g'));
  v_id  uuid;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(trim(coalesce(p_client_label, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indique le client');
  END IF;
  IF p_carrier IS NULL OR p_carrier NOT IN ('MAERSK','CMA_CGM','MSC','COSCO','OTHER') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Armateur inconnu');
  END IF;
  IF v_ctr !~ '^[A-Z]{4}[0-9]{7}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro de conteneur invalide (4 lettres + 7 chiffres)');
  END IF;
  IF length(v_bl) < 6 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro de bill of lading trop court');
  END IF;
  IF length(trim(coalesce(p_pod_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indique le port d''arrivée');
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le fret doit être positif');
  END IF;
  IF EXISTS (SELECT 1 FROM public.cargo_shipments WHERE container_number = v_ctr) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce conteneur est déjà dans la flotte');
  END IF;

  INSERT INTO public.cargo_shipments
    (client_label, carrier, bl_number, container_number, pol_name, pol_unlocode, pod_name, pod_unlocode,
     etd_promised, eta_promised, freight_usd, vessel_name, vessel_imo, vessel_mmsi, voyage, status)
  VALUES
    (trim(p_client_label), p_carrier, v_bl, v_ctr, nullif(trim(p_pol_name), ''), nullif(upper(p_pol_unlocode), ''),
     trim(p_pod_name), nullif(upper(p_pod_unlocode), ''), p_etd_promised, p_eta_promised, p_freight_usd,
     nullif(trim(p_vessel_name), ''), nullif(trim(p_vessel_imo), ''), nullif(trim(p_vessel_mmsi), ''), nullif(trim(p_voyage), ''),
     CASE WHEN p_etd_promised IS NOT NULL AND p_etd_promised <= current_date THEN 'AT_SEA' ELSE 'UNKNOWN' END)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'shipment_id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.create_cargo_shipment_manual(text, text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_cargo_shipment_manual(text, text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.create_cargo_shipment_manual(text, text, text, text, text, text, text, text, date, date, numeric, text, text, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Ajouter un conteneur a la flotte sans suivi armateur (saisie manuelle)"}';

NOTIFY pgrst, 'reload schema';

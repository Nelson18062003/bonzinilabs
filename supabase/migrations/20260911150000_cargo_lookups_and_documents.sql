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

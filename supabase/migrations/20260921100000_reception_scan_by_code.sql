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

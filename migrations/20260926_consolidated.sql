-- ============================================================
-- Consolidé du 26/09/2026 — tout ce qui n'est pas encore appliqué depuis 20260918_consolidated.sql
-- §1 = supabase/migrations/20260926100000_cargo_lookup_cmacgm.sql
-- §2 = supabase/migrations/20260926110000_cargo_secret_from_vault.sql
-- §3 = supabase/migrations/20260926120000_fix_cargo_notify_parcels_min_uuid.sql
-- Idempotent : CREATE OR REPLACE partout.
-- ============================================================

-- ── §1 CMA CGM interrogeable dans request_cargo_lookup ─────────────────
-- ============================================================
-- Cargo : CMA CGM devient interrogeable (API Track & Trace, clé obtenue le 24/09).
--
-- request_cargo_lookup marquait toute référence CMA CGM « unsupported » sans
-- appeler l'edge function. Désormais MAERSK et CMA_CGM partent en « pending »
-- et déclenchent cargo-lookup (qui choisit le connecteur selon la ligne).
-- Corps identique à 20260911150000 hors la liste des armateurs interrogeables.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

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
  v_live        boolean;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_ref) < 6 OR length(v_ref) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Référence trop courte ou trop longue');
  END IF;
  SELECT d.carrier, d.reference_type INTO v_carrier, v_type FROM public.cargo_detect_carrier(v_ref) d;
  v_live := v_carrier IN ('MAERSK', 'CMA_CGM');

  INSERT INTO public.cargo_lookups (reference, reference_type, carrier, status, requested_by, error, completed_at)
  VALUES (
    v_ref, v_type, v_carrier,
    CASE WHEN v_live THEN 'pending' ELSE 'unsupported' END,
    auth.uid(),
    CASE
      WHEN v_live THEN NULL
      WHEN v_carrier = 'UNKNOWN' THEN 'Format non reconnu. Attendu : B/L Maersk (9 chiffres), B/L CMA CGM (3 lettres + 7 chiffres) ou numéro de conteneur (4 lettres + 7 chiffres).'
      ELSE 'Armateur reconnu (' || v_carrier || ') mais pas encore interrogeable : agrégateur à brancher.'
    END,
    CASE WHEN v_live THEN NULL ELSE now() END
  )
  RETURNING id INTO v_id;

  IF v_live THEN
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

-- ── §2 Clés armateur depuis Vault (cargo_secret) ─────────────────────
-- ============================================================
-- Clés des armateurs lisibles depuis Vault par les edge functions cargo quand
-- le secret n'est pas posé dans l'environnement des fonctions (Edge Functions →
-- Secrets). Seule la clé service peut appeler cette RPC (REVOKE public / anon /
-- authenticated + contrôle du rôle JWT) ; liste blanche de noms, jamais de
-- lecture libre du coffre. La clé elle-même est posée dans Vault à la main
-- (vault.create_secret), jamais dans une migration ni dans le dépôt.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cargo_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF p_name NOT IN ('CMACGM_API_KEY', 'MAERSK_CONSUMER_KEY', 'AISSTREAM_API_KEY') THEN
    RAISE EXCEPTION 'Secret inconnu';
  END IF;
  SELECT decrypted_secret INTO v_value FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN v_value;
END;
$$;
REVOKE ALL ON FUNCTION public.cargo_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cargo_secret(text) TO service_role;
COMMENT ON FUNCTION public.cargo_secret(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCargo","label":"Lire une cle armateur dans Vault (interne, service role uniquement)"}';

-- ── §3 Correctif min(uuid) dans cargo_shipments_notify_parcels ───────
-- ============================================================
-- cargo_shipments_notify_parcels : min(uuid) n'existe pas en Postgres → toute
-- transition de statut vers AT_SEA / ARRIVED échouait (« function min(uuid)
-- does not exist »), donc la synchro armateur ne pouvait plus enregistrer
-- l'arrivée d'un conteneur (constaté sur CMAU6126032 le 26/09). On prend le
-- premier dépôt par numéro, de façon stable. Idempotent (CREATE OR REPLACE).
-- ============================================================
CREATE OR REPLACE FUNCTION public.cargo_shipments_notify_parcels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('AT_SEA','ARRIVED') THEN RETURN NEW; END IF;
  FOR r IN
    SELECT d.client_user_id AS user_id, count(*) AS n, string_agg(DISTINCT d.deposit_no, ', ') AS deposits,
           (array_agg(d.id ORDER BY d.deposit_no))[1] AS deposit_id
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE p.shipment_id = NEW.id AND d.client_user_id IS NOT NULL AND p.delivered_at IS NULL
    GROUP BY d.client_user_id
  LOOP
    IF NEW.status = 'AT_SEA' THEN
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_departed',
        'Vos colis ont quitté la Chine',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont en mer dans le conteneur ' || NEW.container_number || COALESCE(', arrivée prévue le ' || to_char(COALESCE(NEW.eta_carrier::date, NEW.eta_promised), 'DD/MM'), '') || '.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'shipment_id', NEW.id, 'container_number', NEW.container_number, 'reference', NEW.container_number));
    ELSE
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_arrived',
        'Vos colis sont arrivés à Douala',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont arrivés à Douala (conteneur ' || NEW.container_number || '). Nous vous prévenons dès qu''ils sont prêts au retrait.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'shipment_id', NEW.id, 'container_number', NEW.container_number, 'reference', NEW.container_number));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

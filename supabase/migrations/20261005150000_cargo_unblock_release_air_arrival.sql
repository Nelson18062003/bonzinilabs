-- ============================================================================
-- Cargo · débloquer la remise à Douala et les vols, marquer un conteneur arrivé ;
-- sécurité : l'outil SQL de Mola ne peut plus changer les réglages de session.
-- 05/10/2026
--
-- Vérifié en production le 05/10 (lecture seule) :
--   · warehouse_release_parcels et air_shipments_notify contenaient encore
--     min(uuid), que Postgres refuse (même défaut que F-085, corrigé le 26/09
--     pour les conteneurs seulement) : la PREMIÈRE remise à Douala et le
--     PREMIER vol auraient échoué. Aucun n'avait encore eu lieu.
--   · assistant_readonly_query (le SQL libre de Mola, ouvert à canViewClients)
--     laissait passer `select set_config('…', '…', false)`. Un réglage de
--     SESSION survit à la requête et reste sur la connexion PostgREST, qui sert
--     ensuite d'autres utilisateurs. Or auth.uid() lit d'abord
--     `request.jwt.claim.sub`, que PostgREST ne pose plus : un membre du
--     personnel pouvait faire passer les requêtes suivantes de cette connexion
--     pour celles d'un autre compte. Les verrous « bonzini.* » (origine des
--     clients, statut des conteneurs) se forgeaient de la même façon.
--
--   1. warehouse_release_parcels : sans min(uuid), et un colis sans propriétaire
--      n'est jamais remis. Corps identique à la production sinon.
--   2. air_shipments_notify : sans min(uuid). Corps identique sinon.
--   3. parcels_follow_shipment : un conteneur « livré » par l'armateur ne fait
--      plus passer ses colis non remis en « livré ».
--   4. Le statut d'un conteneur n'avance que dans un sens. Deux exceptions :
--      la synchro armateur (service_role) peut corriger un statut qu'elle n'a
--      jamais confirmé (dossier saisi à la main, statut deviné) ; l'annulation
--      ci-dessous, par un jeton propre à SA transaction.
--      warehouse_checkin_many verrouille la boîte avant les colis.
--   5. cargo_mark_shipment_arrived / cargo_unmark_shipment_arrived
--      (canManageCargo, journalisées, @mola) : marquer à la main un conteneur
--      parti dont l'armateur ne signale pas l'arrivée ; annuler une arrivée
--      posée par l'équipe — statut, arrivée relevée et dernier mouvement
--      d'avant restaurés — tant que rien n'est pointé, remis ou déclaré
--      manquant à Douala et que l'armateur ne l'a pas confirmée.
--   6. cargo_shipments_notify_parcels : « arrivés au port de Kribi / Douala » ;
--      rien n'est envoyé sur une annulation.
--   7. assistant_readonly_query : la requête s'exécute dans une
--      sous-transaction toujours annulée (le résultat est gardé) — tout
--      set_config qu'elle ferait est défait ; set_config et les identifiants
--      U&"…" sont en plus refusés d'emblée.
--
-- Idempotent : CREATE OR REPLACE, DROP TRIGGER IF EXISTS, COMMENT. Aucune
-- table ni colonne créée, aucune donnée modifiée (vérifié : 0 colis « livré »
-- sans bon de retrait en production).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. La remise à Douala.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.warehouse_release_parcels(
  p_parcel_ids UUID[],
  p_picked_by_name TEXT,
  p_picked_by_phone TEXT DEFAULT NULL,
  p_signature_path TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid(); v_client UUID; v_clients INTEGER; v_orphan BOOLEAN; v_bad TEXT; v_r public.parcel_releases; v_n INTEGER; v_air UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReleaseParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi'); END IF;
  IF NULLIF(TRIM(p_picked_by_name), '') IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Indiquez qui emporte les colis'); END IF;

  -- Dédoublonner : le bon de retrait compte ce qui part, pas ce qu'on a tapé.
  SELECT array_agg(DISTINCT x) INTO p_parcel_ids FROM unnest(p_parcel_ids) x WHERE x IS NOT NULL;
  -- La signature : un PNG que CET agent vient de déposer, jamais réutilisé.
  IF NULLIF(TRIM(p_signature_path), '') IS NOT NULL THEN
    IF p_signature_path !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[A-Za-z0-9._-]+\.png$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Signature invalide');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'parcel-signatures' AND o.name = p_signature_path AND (o.owner = v_uid OR o.owner_id = v_uid::text)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Signature introuvable : refaites signer');
    END IF;
    IF EXISTS (SELECT 1 FROM public.parcel_releases r WHERE r.signature_path = p_signature_path) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette signature est déjà rattachée à un bon de retrait');
    END IF;
  END IF;
  -- Verrouiller les colis ET leurs devis (le garde-fou « soldé » se lit sous verrou), tous du même client, tous prêts.
  PERFORM 1 FROM public.parcels WHERE id = ANY(p_parcel_ids) FOR UPDATE;
  PERFORM 1 FROM public.parcel_quotes q WHERE q.deposit_id IN (SELECT DISTINCT p.deposit_id FROM public.parcels p WHERE p.id = ANY(p_parcel_ids)) FOR UPDATE;
  -- array_agg et non min : Postgres n'a pas de min(uuid) — la remise échouait toujours.
  -- Un colis sans propriétaire n'est jamais remis, même mêlé aux colis d'un client.
  SELECT count(DISTINCT d.client_user_id), (array_agg(d.client_user_id) FILTER (WHERE d.client_user_id IS NOT NULL))[1], bool_or(d.client_user_id IS NULL)
    INTO v_clients, v_client, v_orphan
  FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.id = ANY(p_parcel_ids);
  IF v_clients <> 1 OR v_client IS NULL OR v_orphan THEN RETURN jsonb_build_object('success', false, 'error', 'Les colis doivent appartenir à un seul client, connu'); END IF;
  SELECT string_agg(p.parcel_no, ', ') INTO v_bad FROM public.parcels p
   WHERE p.id = ANY(p_parcel_ids) AND NOT (p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL);
  IF v_bad IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Pas prêts à être remis : ' || v_bad); END IF;

  -- Le garde-fou : chaque dépôt concerné doit avoir un devis SOLDÉ.
  SELECT string_agg(d.deposit_no || CASE WHEN q.id IS NULL OR q.total_xaf <= 0 THEN ' (sans prix)' ELSE ' (reste ' || (q.total_xaf - q.amount_paid_xaf) || ' XAF)' END, ', ') INTO v_bad
  FROM (SELECT DISTINCT p.deposit_id FROM public.parcels p WHERE p.id = ANY(p_parcel_ids)) x
  JOIN public.parcel_deposits d ON d.id = x.deposit_id
  LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
  WHERE q.id IS NULL OR q.total_xaf <= 0 OR q.amount_paid_xaf < q.total_xaf;
  IF v_bad IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Remise bloquée, devis non soldé : ' || v_bad, 'code', 'unpaid'); END IF;

  INSERT INTO public.parcel_releases (client_user_id, picked_by_name, picked_by_phone, signature_path, note, parcel_count, released_by)
  VALUES (v_client, TRIM(p_picked_by_name), NULLIF(TRIM(p_picked_by_phone), ''), NULLIF(TRIM(p_signature_path), ''), NULLIF(TRIM(p_note), ''), 0, v_uid)
  RETURNING * INTO v_r;

  UPDATE public.parcels SET status = 'delivered', delivered_at = now(), release_id = v_r.id, updated_at = now() WHERE id = ANY(p_parcel_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.parcel_releases SET parcel_count = v_n WHERE id = v_r.id;
  v_r.parcel_count := v_n;

  -- Un avion dont tous les colis sont remis est livré.
  FOR v_air IN SELECT DISTINCT p.air_shipment_id FROM public.parcels p WHERE p.id = ANY(p_parcel_ids) AND p.air_shipment_id IS NOT NULL LOOP
    IF NOT EXISTS (SELECT 1 FROM public.parcels p WHERE p.air_shipment_id = v_air AND p.delivered_at IS NULL AND COALESCE(p.condition, '') <> 'missing') THEN
      UPDATE public.air_shipments SET status = 'DELIVERED', delivered_at = now(), updated_at = now() WHERE id = v_air AND status <> 'DELIVERED';
    END IF;
  END LOOP;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'release_parcels', 'parcel_release', v_r.id,
          jsonb_build_object('description', 'Bon de retrait ' || v_r.release_no || ' : ' || v_n || ' colis remis à ' || TRIM(p_picked_by_name), 'release_no', v_r.release_no,
                             'client_user_id', v_client, 'parcel_ids', to_jsonb(p_parcel_ids), 'count', v_n, 'signed', v_r.signature_path IS NOT NULL));
  RETURN jsonb_build_object('success', true, 'release', public.warehouse_release_json(v_r.id));
END;
$fn$;

COMMENT ON FUNCTION public.warehouse_release_parcels(UUID[], TEXT, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReleaseParcels","confirm":true,"danger":true,"label":"Remettre des colis au client à Douala (bloqué si le devis n''est pas soldé) et établir le bon de retrait"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les messages au départ et à l'arrivée d'un vol.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.air_shipments_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r RECORD; v_flight TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('DEPARTED','ARRIVED') THEN RETURN NEW; END IF;
  v_flight := COALESCE(NEW.flight_no, 'Air cargo');
  FOR r IN
    SELECT d.client_user_id AS user_id, count(*) AS n, string_agg(DISTINCT d.deposit_no, ', ') AS deposits, (array_agg(d.id ORDER BY d.deposit_no))[1] AS deposit_id
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE p.air_shipment_id = NEW.id AND d.client_user_id IS NOT NULL AND p.delivered_at IS NULL
    GROUP BY d.client_user_id
  LOOP
    IF NEW.status = 'DEPARTED' THEN
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_departed',
        'Vos colis ont quitté la Chine',
        'Vos ' || r.n || ' colis (' || r.deposits || ') ont quitté Guangzhou par avion, vol ' || v_flight || COALESCE(', arrivée prévue le ' || to_char(NEW.eta, 'DD/MM'), '') || '.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'air_shipment_id', NEW.id, 'awb_number', NEW.awb_number, 'flight_no', NEW.flight_no, 'eta', NEW.eta, 'reference', NEW.awb_number));
    ELSE
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_arrived',
        'Vos colis sont arrivés à Douala',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont arrivés à Douala. Nous vous prévenons dès qu''ils sont prêts au retrait.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'air_shipment_id', NEW.id, 'awb_number', NEW.awb_number, 'reference', NEW.awb_number));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Un conteneur « livré » ne remet pas les colis à la place de Douala.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parcels_follow_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_status TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  -- « Livré » côté armateur (conteneur vidé, rendu) ne veut pas dire « remis au
  -- client » : un colis n'est remis que par le bon de retrait. Les colis encore
  -- à l'entrepôt restent « arrivés » — sinon ils sortaient des compteurs de
  -- Douala et la remise les refusait.
  v_status := CASE WHEN NEW.status = 'DELIVERED' THEN 'arrived' ELSE public.parcel_status_for_shipment(NEW.status) END;
  UPDATE public.parcels SET status = v_status, updated_at = now()
   WHERE shipment_id = NEW.id AND status <> v_status AND delivered_at IS NULL AND COALESCE(condition, '') <> 'missing';
  RETURN NEW;
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Le statut d'un conteneur n'avance que dans un sens.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_status_rank(p_status TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE p_status
    WHEN 'BOOKED'    THEN 1
    WHEN 'AT_ORIGIN' THEN 2
    WHEN 'AT_SEA'    THEN 3
    WHEN 'ARRIVED'   THEN 4
    WHEN 'DELIVERED' THEN 5
    ELSE 0                -- UNKNOWN
  END
$fn$;
REVOKE ALL ON FUNCTION public.cargo_status_rank(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cargo_status_rank(TEXT) TO authenticated, service_role;
COMMENT ON FUNCTION public.cargo_status_rank(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Rang d''un statut de conteneur (helper interne du garde-fou)"}';

-- Le jeton d'annulation : propre à la transaction qui le pose. Un réglage forgé
-- ailleurs (autre requête, autre transaction de la même connexion) ne le vaut pas.
CREATE OR REPLACE FUNCTION public.cargo_status_override_token()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $fn$
  SELECT 'tx:' || txid_current()::text
$fn$;
REVOKE ALL ON FUNCTION public.cargo_status_override_token() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.cargo_status_override_token() IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCargo","confirm":false,"danger":false,"label":"Jeton d''annulation d''arrivée (helper interne)"}';

CREATE OR REPLACE FUNCTION public.cargo_shipments_status_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status
     OR public.cargo_status_rank(NEW.status) >= public.cargo_status_rank(OLD.status) THEN
    RETURN NEW;
  END IF;
  -- L'annulation d'une arrivée (cargo_unmark_shipment_arrived) : son jeton, dans
  -- SA transaction, et seulement depuis une fonction du propriétaire (jamais par
  -- un appel direct de l'API : anon / authenticated / service_role).
  IF COALESCE(current_setting('bonzini.cargo_status_override', true), '') = 'tx:' || txid_current()::text
     AND current_user NOT IN ('anon', 'authenticated', 'service_role') THEN
    RETURN NEW;
  END IF;
  -- La synchro armateur corrige un statut qu'elle n'avait jamais confirmé
  -- (dossier saisi à la main : « en mer » deviné à la date promise).
  IF current_user = 'service_role' AND OLD.last_synced_at IS NULL THEN
    RETURN NEW;
  END IF;
  -- Sinon on garde le statut atteint ; le reste de la mise à jour (dates, jalons) passe.
  NEW.status := OLD.status;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS cargo_shipments_status_guard ON public.cargo_shipments;
CREATE TRIGGER cargo_shipments_status_guard
  BEFORE UPDATE OF status ON public.cargo_shipments
  FOR EACH ROW EXECUTE FUNCTION public.cargo_shipments_status_guard();

-- ─────────────────────────────────────────────────────────────────────────
-- 4 bis. Pointer en lot : la boîte verrouillée avant les colis.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.warehouse_checkin_many(p_parcel_ids UUID[], p_location TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi'); END IF;
  -- La boîte d'abord (partagé), puis les colis : une annulation d'arrivée en cours
  -- attend, ou bien elle a fini et l'UPDATE ci-dessous (nouvelle instruction,
  -- nouvel instantané) voit le conteneur revenu en mer.
  PERFORM 1 FROM public.cargo_shipments cs
   WHERE cs.id IN (SELECT p.shipment_id FROM public.parcels p WHERE p.id = ANY(p_parcel_ids) AND p.shipment_id IS NOT NULL)
   FOR SHARE;
  PERFORM 1 FROM public.parcels WHERE id = ANY(p_parcel_ids) FOR UPDATE;
  WITH done AS (
    UPDATE public.parcels SET
      status = 'arrived', checked_in_at = COALESCE(checked_in_at, now()), checked_in_by = COALESCE(checked_in_by, v_uid),
      warehouse_location = COALESCE(NULLIF(TRIM(p_location), ''), warehouse_location),
      condition = COALESCE(NULLIF(condition, 'missing'), 'ok'), updated_at = now()
    WHERE id = ANY(p_parcel_ids) AND (shipment_id IS NOT NULL OR air_shipment_id IS NOT NULL) AND status IN ('shipped','arrived') AND delivered_at IS NULL
      AND (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = parcels.air_shipment_id AND a.status IN ('ARRIVED','DELIVERED'))
        OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = parcels.shipment_id AND cs.status IN ('ARRIVED','DELIVERED')))
    RETURNING id
  ) SELECT count(*) INTO v_n FROM done;
  RETURN jsonb_build_object('success', true, 'checked', v_n);
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_checkin_many(UUID[], TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":true,"danger":false,"label":"Pointer plusieurs colis arrivés d''un coup (conformes)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Marquer un conteneur arrivé, ou annuler une arrivée posée par l'équipe.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_mark_shipment_arrived(
  p_shipment_id UUID,
  p_arrived_at TIMESTAMPTZ DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_s public.cargo_shipments;
  v_at TIMESTAMPTZ := COALESCE(p_arrived_at, now());
  v_note TEXT := NULLIF(left(btrim(COALESCE(p_note, '')), 300), '');
  v_departed TIMESTAMPTZ;
  v_parcels INTEGER;
  v_clients INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_shipment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteneur manquant');
  END IF;
  IF v_at > now() + interval '10 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''arrivée ne peut pas être dans le futur');
  END IF;

  SELECT * INTO v_s FROM public.cargo_shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteneur introuvable');
  END IF;
  IF v_s.status IN ('ARRIVED', 'DELIVERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce conteneur est déjà marqué arrivé');
  END IF;
  -- Un conteneur arrive après être parti : en mer, ou un départ connu.
  IF v_s.status <> 'AT_SEA' AND v_s.etd_actual IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce conteneur n''est pas encore parti : renseignez d''abord le navire et son départ');
  END IF;
  v_departed := COALESCE(v_s.etd_actual, v_s.etd_promised::timestamptz);
  IF v_departed IS NOT NULL AND v_at < v_departed THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''arrivée ne peut pas précéder le départ du navire');
  END IF;

  -- Les déclencheurs font le reste : les colis passent « arrivés » (pointables
  -- à Douala), et leurs clients sont prévenus.
  UPDATE public.cargo_shipments SET
    status = 'ARRIVED',
    eta_manual = v_at,
    eta_manual_note = COALESCE(v_note, 'Arrivée constatée par l''équipe'),
    eta_manual_at = now(),
    last_event_at = v_at,
    last_event_label = 'Arrivé (constaté par l''équipe)',
    updated_at = now()
  WHERE id = p_shipment_id;

  -- Ce que l'arrivée change à Douala : les colis pointables, et les clients prévenus.
  SELECT count(*), count(DISTINCT d.client_user_id) INTO v_parcels, v_clients
  FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
  WHERE p.shipment_id = p_shipment_id AND p.delivered_at IS NULL AND COALESCE(p.condition, '') <> 'missing';

  -- Tout ce que l'annulation devra remettre est gardé ici.
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_mark_arrived', 'cargo_shipment', p_shipment_id,
          jsonb_build_object('description', 'Conteneur ' || COALESCE(v_s.container_number, v_s.bl_number, '?') || ' marqué arrivé', 'container_number', v_s.container_number,
                             'arrived_at', v_at, 'note', v_note, 'parcels', v_parcels, 'clients', v_clients,
                             'previous_status', v_s.status,
                             'previous_eta_manual', v_s.eta_manual, 'previous_eta_manual_note', v_s.eta_manual_note, 'previous_eta_manual_at', v_s.eta_manual_at,
                             'previous_last_event_at', v_s.last_event_at, 'previous_last_event_label', v_s.last_event_label));
  RETURN jsonb_build_object('success', true, 'shipment_id', p_shipment_id, 'status', 'ARRIVED', 'parcels', v_parcels, 'clients', v_clients);
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_mark_shipment_arrived(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cargo_mark_shipment_arrived(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
COMMENT ON FUNCTION public.cargo_mark_shipment_arrived(UUID, TIMESTAMPTZ, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":true,"label":"Marquer un conteneur arrivé au port quand l''armateur ne le signale pas : ses colis deviennent pointables à Douala et les clients sont prévenus (message non rappelable)","resolve":{"p_shipment_id":"cargo"}}';

CREATE OR REPLACE FUNCTION public.cargo_unmark_shipment_arrived(
  p_shipment_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_s public.cargo_shipments;
  v_reason TEXT := NULLIF(left(btrim(COALESCE(p_reason, '')), 300), '');
  v_mark public.admin_audit_logs;
  v_prev TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez pourquoi l''arrivée est annulée');
  END IF;

  SELECT * INTO v_s FROM public.cargo_shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteneur introuvable');
  END IF;
  IF v_s.status <> 'ARRIVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce conteneur n''est pas marqué arrivé');
  END IF;
  -- Seule une arrivée posée par l'équipe s'annule : la dernière action
  -- d'arrivée sur ce conteneur doit être un marquage, pas une annulation.
  SELECT * INTO v_mark FROM public.admin_audit_logs
   WHERE target_id = p_shipment_id AND action_type IN ('cargo_mark_arrived', 'cargo_unmark_arrived')
   ORDER BY created_at DESC, id DESC LIMIT 1;
  IF v_mark.id IS NULL OR v_mark.action_type <> 'cargo_mark_arrived' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette arrivée vient de l''armateur, pas de l''équipe : elle ne s''annule pas ici');
  END IF;
  -- L'armateur a confirmé l'arrivée au port depuis : la synchro la remettrait.
  IF EXISTS (SELECT 1 FROM public.cargo_events e
              WHERE e.shipment_id = p_shipment_id AND e.classifier = 'ACT' AND e.event_code IN ('ARRI', 'DISC')
                AND (v_s.pod_unlocode IS NULL OR e.unlocode IS NULL OR e.unlocode = v_s.pod_unlocode)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''armateur a confirmé l''arrivée au port : elle ne s''annule plus');
  END IF;
  -- Ce qui a déjà été traité à Douala ne se défait pas.
  PERFORM 1 FROM public.parcels WHERE shipment_id = p_shipment_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.parcels WHERE shipment_id = p_shipment_id
              AND (checked_in_at IS NOT NULL OR delivered_at IS NOT NULL OR COALESCE(condition, '') = 'missing')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce conteneur sont déjà pointés, remis ou déclarés manquants à Douala : l''arrivée ne s''annule plus');
  END IF;

  v_prev := COALESCE(v_mark.details->>'previous_status', CASE WHEN v_s.etd_actual IS NOT NULL THEN 'AT_SEA' ELSE 'UNKNOWN' END);
  IF public.cargo_status_rank(v_prev) >= public.cargo_status_rank('ARRIVED') THEN v_prev := 'AT_SEA'; END IF;

  -- Le seul retour en arrière permis : le garde-fou reconnaît le jeton de CETTE
  -- transaction, et aucun message ne part aux clients.
  PERFORM set_config('bonzini.cargo_status_override', public.cargo_status_override_token(), true);
  UPDATE public.cargo_shipments SET
    status = v_prev,
    eta_manual = (v_mark.details->>'previous_eta_manual')::timestamptz,
    eta_manual_note = v_mark.details->>'previous_eta_manual_note',
    eta_manual_at = (v_mark.details->>'previous_eta_manual_at')::timestamptz,
    last_event_at = (v_mark.details->>'previous_last_event_at')::timestamptz,
    last_event_label = v_mark.details->>'previous_last_event_label',
    updated_at = now()
  WHERE id = p_shipment_id;
  PERFORM set_config('bonzini.cargo_status_override', '', true);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_unmark_arrived', 'cargo_shipment', p_shipment_id,
          jsonb_build_object('description', 'Arrivée annulée pour ' || COALESCE(v_s.container_number, v_s.bl_number, '?') || ' : ' || v_reason,
                             'container_number', v_s.container_number, 'reason', v_reason, 'restored_status', v_prev, 'mark_log_id', v_mark.id));
  RETURN jsonb_build_object('success', true, 'shipment_id', p_shipment_id, 'status', v_prev);
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_unmark_shipment_arrived(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cargo_unmark_shipment_arrived(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.cargo_unmark_shipment_arrived(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":true,"label":"Annuler l''arrivée d''un conteneur posée par erreur par l''équipe (statut et dates d''avant remis ; impossible si l''armateur l''a confirmée ou si des colis sont déjà traités à Douala)","resolve":{"p_shipment_id":"cargo"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Le message « arrivés » nomme le vrai port ; rien ne part sur une annulation.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_shipments_notify_parcels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r RECORD; v_port TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('AT_SEA','ARRIVED') THEN RETURN NEW; END IF;
  -- Une arrivée annulée (jeton de la transaction d'annulation) ne prévient personne.
  IF COALESCE(current_setting('bonzini.cargo_status_override', true), '') = 'tx:' || txid_current()::text THEN RETURN NEW; END IF;
  -- Kribi ou Douala ; un autre port camerounais tel quel ; sinon Douala.
  v_port := CASE
    WHEN NEW.pod_unlocode = 'CMKBI' OR NEW.pod_name ILIKE '%kribi%' THEN 'Kribi'
    WHEN NEW.pod_unlocode = 'CMDLA' OR NEW.pod_name ILIKE '%douala%' THEN 'Douala'
    WHEN NEW.pod_unlocode LIKE 'CM%' AND NULLIF(btrim(NEW.pod_name), '') IS NOT NULL THEN initcap(btrim(NEW.pod_name))
    ELSE 'Douala'
  END;
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
        'Vos colis sont arrivés au Cameroun',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont arrivés au port de ' || v_port || ' (conteneur ' || NEW.container_number || '). Nous vous prévenons dès qu''ils sont prêts au retrait à Douala.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'shipment_id', NEW.id, 'container_number', NEW.container_number, 'reference', NEW.container_number, 'port', v_port));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Le SQL libre de Mola ne peut plus changer les réglages de session.
--    Copie de la production (garde canViewClients, posée le 31/08) ; seuls
--    changent : set_config et U&"…" refusés, exécution dans une
--    sous-transaction toujours annulée.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.assistant_readonly_query(p_sql text, p_allowed_tables text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_clean text;
  v_lower text;
  v_result jsonb;
  v_plan jsonb;
  v_rels text[];
  v_rel text;
begin
  v_admin_id := auth.uid();
  if not public.admin_has_permission(v_admin_id, 'canViewClients') then
    return jsonb_build_object('success', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_sql is null or length(trim(p_sql)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Requête vide.');
  end if;

  v_clean := trim(p_sql);
  v_clean := regexp_replace(v_clean, ';\s*$', '');
  v_lower := lower(v_clean);

  if v_lower !~ '^\s*(select|with)\s' then
    return jsonb_build_object('success', false, 'error', 'Seules les requêtes de lecture (SELECT) sont autorisées.');
  end if;

  if position(';' in v_clean) > 0 then
    return jsonb_build_object('success', false, 'error', 'Une seule requête à la fois (pas de point-virgule au milieu).');
  end if;

  if v_lower ~ '\y(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_get|lo_put|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|set_config)\y' then
    return jsonb_build_object('success', false, 'error', 'Fonction système non autorisée.');
  end if;
  -- Les identifiants U&"…" permettent d'écrire un nom de fonction sans ses lettres.
  if v_lower ~ 'u&\s*["'']' then
    return jsonb_build_object('success', false, 'error', 'Identifiants Unicode échappés non autorisés.');
  end if;

  -- ── Garde de CONFIDENTIALITÉ par rôle (fail-closed) ──────────────────────
  if p_allowed_tables is not null then
    begin
      execute 'explain (format json) ' || v_clean into v_plan;
    exception when others then
      return jsonb_build_object('success', false, 'error', 'Requête non planifiable (vérifie tes noms de colonnes/tables) : ' || sqlerrm);
    end;
    -- Toutes les relations réellement accédées (récursif sur le plan, jointures/sous-requêtes comprises).
    select array_agg(distinct (rel #>> '{}'))
      into v_rels
      from jsonb_path_query(v_plan, '$.**."Relation Name"') as rel;
    if v_rels is not null then
      foreach v_rel in array v_rels loop
        if not (v_rel = any(p_allowed_tables)) then
          return jsonb_build_object('success', false, 'error',
            'Ton rôle n''a pas accès à la table « ' || v_rel || ' » en requête libre.');
        end if;
      end loop;
    end if;
  end if;

  perform set_config('statement_timeout', '8000', true);
  perform set_config('transaction_read_only', 'on', true);

  -- La requête tourne dans une sous-transaction TOUJOURS annulée : le résultat
  -- (une variable) est gardé, mais tout set_config qu'elle aurait fait — même
  -- « pour la session » — est défait. Un réglage de session survit sinon à la
  -- requête, sur une connexion PostgREST qui sert ensuite d'autres comptes
  -- (auth.uid() lit request.jwt.claim.sub en premier).
  begin
    execute format(
      'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) _q limit 1000) t',
      v_clean
    ) into v_result;
    raise exception using errcode = 'P0001', message = 'bonzini:aro-rollback';
  exception when others then
    if sqlerrm <> 'bonzini:aro-rollback' then
      return jsonb_build_object('success', false, 'error', sqlerrm);
    end if;
  end;

  return jsonb_build_object('success', true, 'rows', v_result, 'row_count', coalesce(jsonb_array_length(v_result), 0));
end;
$$;

revoke all on function public.assistant_readonly_query(text, text[]) from public, anon;
grant execute on function public.assistant_readonly_query(text, text[]) to authenticated;

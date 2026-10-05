-- ============================================================================
-- Cargo · débloquer la remise à Douala, les vols, et l'arrivée d'un conteneur
-- 05/10/2026
--
-- Vérifié en production le 05/10 (lecture seule) : les deux fonctions
-- ci-dessous contenaient encore min(uuid), que Postgres refuse (« function
-- min(uuid) does not exist ») — le même défaut que F-085, corrigé le 26/09
-- pour les conteneurs seulement. Aucune remise ni aucun vol n'avait encore été
-- fait : personne n'a été bloqué, mais la PREMIÈRE remise et le PREMIER vol
-- l'auraient été.
--
--   1. warehouse_release_parcels : la remise (bon de retrait BR-) échouait
--      toujours. Corps identique à la production, à une ligne près.
--   2. air_shipments_notify : le passage d'un vol à « parti » ou « arrivé »
--      échouait (le déclencheur faisait échouer la mise à jour), donc rien ne
--      pouvait être pointé à Douala. Corps identique, à une ligne près.
--   3. parcels_follow_shipment : un conteneur passé « livré » par l'armateur
--      faisait passer ses colis encore à l'entrepôt en « livré » (sans bon de
--      retrait) — ils sortaient des compteurs et la remise les refusait. Ils
--      restent désormais « arrivés ».
--   4. Le statut d'un conteneur n'avance que dans un sens (réservé → à
--      l'origine → en mer → arrivé → livré). La synchro armateur ne peut plus
--      le faire reculer (un navire « au mouillage » encore annoncé « en mer »
--      aurait remis des colis pointés en « en mer »). Seule l'annulation
--      explicite ci-dessous peut revenir en arrière.
--   5. cargo_mark_shipment_arrived / cargo_unmark_shipment_arrived : marquer
--      à la main un conteneur arrivé (MSC, COSCO, saisie manuelle, armateur
--      muet) — sans quoi Douala ne pouvait jamais le pointer — et annuler une
--      arrivée posée par erreur tant que rien n'est pointé. Gardées par
--      canManageCargo, journalisées, étiquetées @mola.
--   6. cargo_shipments_notify_parcels : le message « arrivés » nomme le port
--      réel (Kribi ou Douala) au lieu de toujours dire « Douala » ; aucune
--      notification quand une arrivée est annulée.
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
  v_uid UUID := auth.uid(); v_client UUID; v_clients INTEGER; v_bad TEXT; v_r public.parcel_releases; v_n INTEGER; v_air UUID;
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
  -- (array_agg, pas min : Postgres n'a pas de min(uuid) — la remise échouait toujours.)
  SELECT count(DISTINCT d.client_user_id), (array_agg(d.client_user_id) FILTER (WHERE d.client_user_id IS NOT NULL))[1] INTO v_clients, v_client
  FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.id = ANY(p_parcel_ids);
  IF v_clients <> 1 OR v_client IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Les colis doivent appartenir à un seul client, connu'); END IF;
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

CREATE OR REPLACE FUNCTION public.cargo_shipments_status_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND public.cargo_status_rank(NEW.status) < public.cargo_status_rank(OLD.status)
     AND COALESCE(current_setting('bonzini.cargo_status_override', true), '') <> 'on' THEN
    -- On garde le statut atteint ; le reste de la mise à jour (dates, jalons) passe.
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_shipments_status_guard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_shipments_status_guard() FROM anon, authenticated;

DROP TRIGGER IF EXISTS cargo_shipments_status_guard ON public.cargo_shipments;
CREATE TRIGGER cargo_shipments_status_guard
  BEFORE UPDATE OF status ON public.cargo_shipments
  FOR EACH ROW EXECUTE FUNCTION public.cargo_shipments_status_guard();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Marquer un conteneur arrivé, ou annuler une arrivée posée par erreur.
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
  v_parcels INTEGER;
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
  IF v_s.etd_actual IS NOT NULL AND v_at < v_s.etd_actual THEN
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

  SELECT count(*) INTO v_parcels FROM public.parcels WHERE shipment_id = p_shipment_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_mark_arrived', 'cargo_shipment', p_shipment_id,
          jsonb_build_object('description', 'Conteneur ' || COALESCE(v_s.container_number, v_s.bl_number, '?') || ' marqué arrivé', 'container_number', v_s.container_number,
                             'previous_status', v_s.status, 'arrived_at', v_at, 'note', v_note, 'parcels', v_parcels));
  RETURN jsonb_build_object('success', true, 'shipment_id', p_shipment_id, 'status', 'ARRIVED', 'parcels', v_parcels);
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_mark_shipment_arrived(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cargo_mark_shipment_arrived(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
COMMENT ON FUNCTION public.cargo_mark_shipment_arrived(UUID, TIMESTAMPTZ, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Marquer un conteneur arrivé au port (quand l''armateur ne le dit pas) : ses colis deviennent pointables à Douala et les clients sont prévenus"}';

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
  -- Ce qui a déjà été pointé ou remis à Douala ne se défait pas.
  PERFORM 1 FROM public.parcels WHERE shipment_id = p_shipment_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.parcels WHERE shipment_id = p_shipment_id AND (checked_in_at IS NOT NULL OR delivered_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce conteneur sont déjà pointés à Douala : l''arrivée ne s''annule plus');
  END IF;

  -- Le seul retour en arrière permis : le garde-fou le laisse passer, et aucun
  -- message ne part (les clients ne reçoivent pas « en mer » une seconde fois).
  PERFORM set_config('bonzini.cargo_status_override', 'on', true);
  UPDATE public.cargo_shipments SET
    status = 'AT_SEA',
    last_event_at = now(),
    last_event_label = 'Arrivée annulée par l''équipe',
    updated_at = now()
  WHERE id = p_shipment_id;
  PERFORM set_config('bonzini.cargo_status_override', '', true);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_unmark_arrived', 'cargo_shipment', p_shipment_id,
          jsonb_build_object('description', 'Arrivée annulée pour ' || COALESCE(v_s.container_number, v_s.bl_number, '?') || ' : ' || v_reason, 'container_number', v_s.container_number, 'reason', v_reason));
  RETURN jsonb_build_object('success', true, 'shipment_id', p_shipment_id, 'status', 'AT_SEA');
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_unmark_shipment_arrived(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cargo_unmark_shipment_arrived(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.cargo_unmark_shipment_arrived(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":true,"label":"Annuler l''arrivée d''un conteneur marquée par erreur (impossible si des colis sont déjà pointés à Douala)"}';

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
  -- Une arrivée annulée (retour à « en mer ») ne renvoie pas « vos colis sont en mer ».
  IF COALESCE(current_setting('bonzini.cargo_status_override', true), '') = 'on' THEN RETURN NEW; END IF;
  v_port := CASE
    WHEN NEW.pod_unlocode = 'CMKBI' OR NEW.pod_name ILIKE '%kribi%' THEN 'Kribi'
    WHEN NEW.pod_unlocode = 'CMDLA' OR NEW.pod_name ILIKE '%douala%' THEN 'Douala'
    ELSE COALESCE(initcap(NULLIF(btrim(NEW.pod_name), '')), 'Douala')
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

-- ============================================================================
-- MIGRATION CONSOLIDÉE · 05/10/2026 · LES TROIS LOTS DE LA PR, EN UN SEUL FICHIER
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- Ce fichier réunit, dans l'ordre d'exécution obligatoire, trois migrations
-- (chacune copie conforme de son fichier consolidé, prérequis compris) :
--
--   PARTIE A — Cargo : remise à Douala et vols débloqués (min(uuid)),
--              conteneur « marqué arrivé » à la main, SQL de Mola sans effet
--              de session.                 ← supabase/migrations/20261005150000_*
--   PARTIE B — Mes équipes + rôle commercial isolé : prospects, attribution
--              automatique, objectifs, tableaux de bord.
--                                          ← supabase/migrations/20261005160000_*
--   PARTIE C — Cargo aérien : paquets de 32 kg (Guangzhou → aéroport →
--              Douala), LTA provisoire.    ← supabase/migrations/20261005170000_*
--
-- Prérequis : `20261005120000_client_sources.sql` (sources des clients,
-- PR #224) — déjà appliquée en production le 05/10. Chaque partie commence
-- par un bloc qui vérifie ses prérequis et s'arrête net, sans rien modifier,
-- s'il en manque un (la partie C vérifie aussi que la partie A est passée).
--
-- Idempotent : chaque partie se rejoue sans dégât (CREATE OR REPLACE,
-- IF NOT EXISTS, DROP … IF EXISTS). Le rôle « commercial » est ajouté à
-- l'énumération sans y être utilisé comme valeur dans la même transaction :
-- le fichier passe d'un bloc, même dans une seule transaction.
--
-- Vérifié sur Postgres 16, sur un schéma qui réunit les bases des trois lots
-- (migrations du dépôt) :
--   · ce fichier passé deux fois d'affilée dans UNE transaction ;
--   · puis les 79 contrôles des paquets sur ce même schéma.
-- Chaque lot a aussi ses propres contrôles : 61 pour la remise et les vols,
-- 105 pour les équipes et les commerciaux, 79 pour les paquets.
--
-- Après passage :
--   npx supabase migration repair --status applied 20261005150000 20261005160000 20261005170000
--   /gen-types
--   npx supabase functions deploy admin-assistant   ← AVANT de créer le premier commercial
--   app BONZINI HQ : cd hq-app && npm run update:production
-- ============================================================================



-- ████████████████████████████████████████████████████████████████████████████
-- PARTIE A
-- ████████████████████████████████████████████████████████████████████████████

-- ============================================================================
-- MIGRATION CONSOLIDÉE · 05/10/2026 · Cargo › débloquer la remise à Douala,
-- les vols, et marquer un conteneur arrivé à la main · Sécurité : le SQL libre
-- de Mola ne peut plus changer les réglages de session
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un ; rien n'est
--      modifié) : les tables et colonnes que lisent les fonctions, et les
--      fonctions qu'elles appellent.
--   1. La migration de la PR, copie conforme de
--        ← supabase/migrations/20261005150000_cargo_unblock_release_air_arrival.sql
--      · warehouse_release_parcels et air_shipments_notify sans min(uuid)
--        (la remise et le départ / l'arrivée d'un vol échouaient — vérifié
--        en production le 05/10) ; un colis sans propriétaire n'est jamais remis ;
--      · un conteneur « livré » par l'armateur ne fait plus passer ses colis
--        non remis en « livré » ;
--      · le statut d'un conteneur n'avance plus que dans un sens (la synchro
--        ne corrige que ce qu'elle n'a jamais confirmé) ; pointer en lot
--        verrouille la boîte avant les colis ;
--      · cargo_mark_shipment_arrived / cargo_unmark_shipment_arrived
--        (canManageCargo, journalisées, @mola, « resolve » par numéro de
--        conteneur) — l'annulation remet statut, arrivée relevée et dernier
--        mouvement d'avant, et n'est permise que pour une arrivée posée par
--        l'équipe, non confirmée par l'armateur, sans colis traité à Douala ;
--      · le message « arrivés » nomme le vrai port (Kribi / Douala) ;
--      · assistant_readonly_query (SQL libre de Mola) : la requête tourne dans
--        une sous-transaction toujours annulée — un set_config « de session »
--        ne survit plus (il pouvait changer l'identité vue par auth.uid() sur
--        la connexion PostgREST) ; set_config et U&"…" refusés d'emblée.
--      Aucune table ni colonne créée, aucune donnée modifiée.
--
-- Idempotent (CREATE OR REPLACE, DROP TRIGGER IF EXISTS, COMMENT) : rejouable
-- sans dégât. Vérifié sur Postgres 16 avec le schéma cargo réel (migrations du
-- dépôt) : les deux pannes reproduites AVANT (« function min(uuid) does not
-- exist »), puis ce fichier passé deux fois dans UNE transaction, puis 61
-- contrôles en deux séries (vols et messages, droits, dates refusées,
-- marquage et annulation avec restauration, arrivée de l'armateur, colis
-- manquant, synchro, rôles API anon / authenticated / service_role, jeton
-- forgé ou deviné, pointage en lot, remise et colis sans propriétaire,
-- conteneur livré, SQL de Mola : set_config refusé, U&"…" refusé, set_config
-- caché dans une fonction défait, résultat rendu).
--
-- Après passage :
--   npx supabase migration repair --status applied 20261005150000
--   puis /gen-types (les deux nouvelles RPC apparaissent dans types.ts ; l'app
--   les appelle déjà sans attendre).
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  r         RECORD;
BEGIN
  IF to_regclass('public.parcel_deposits') IS NULL THEN v_missing := array_append(v_missing, 'table public.parcel_deposits (réception, 20/09)'); END IF;
  IF to_regclass('public.parcels') IS NULL THEN v_missing := array_append(v_missing, 'table public.parcels (réception, 20/09)'); END IF;
  IF to_regclass('public.parcel_quotes') IS NULL THEN v_missing := array_append(v_missing, 'table public.parcel_quotes (devis cargo, 21/09)'); END IF;
  IF to_regclass('public.parcel_releases') IS NULL THEN v_missing := array_append(v_missing, 'table public.parcel_releases (entrepôt de Douala, 21/09)'); END IF;
  IF to_regclass('public.cargo_shipments') IS NULL THEN v_missing := array_append(v_missing, 'table public.cargo_shipments (module cargo, 11/09)'); END IF;
  IF to_regclass('public.air_shipments') IS NULL THEN v_missing := array_append(v_missing, 'table public.air_shipments (cargo aérien, 21/09)'); END IF;
  IF to_regclass('public.admin_audit_logs') IS NULL THEN v_missing := array_append(v_missing, 'table public.admin_audit_logs'); END IF;
  IF to_regclass('public.cargo_events') IS NULL THEN v_missing := array_append(v_missing, 'table public.cargo_events (module cargo, 11/09)'); END IF;

  FOR r IN
    SELECT c.tbl, c.col, c.origin
    FROM (VALUES
      ('parcels',         'air_shipment_id',  'cargo aérien, 21/09'),
      ('parcels',         'checked_in_at',    'entrepôt de Douala, 21/09'),
      ('parcels',         'delivered_at',     'entrepôt de Douala, 21/09'),
      ('parcels',         'release_id',       'entrepôt de Douala, 21/09'),
      ('parcels',         'condition',        'entrepôt de Douala, 21/09'),
      ('parcels',         'checked_in_by',    'entrepôt de Douala, 21/09'),
      ('parcels',         'warehouse_location','entrepôt de Douala, 21/09'),
      ('cargo_events',    'event_code',       'module cargo, 11/09'),
      ('cargo_events',    'classifier',       'module cargo, 11/09'),
      ('cargo_events',    'unlocode',         'module cargo, 11/09'),
      ('parcel_quotes',   'amount_paid_xaf',  'encaissements cargo, 21/09'),
      ('cargo_shipments', 'pod_name',         'module cargo, 11/09'),
      ('cargo_shipments', 'pod_unlocode',     'module cargo, 11/09'),
      ('cargo_shipments', 'etd_actual',       'module cargo, 11/09'),
      ('cargo_shipments', 'last_event_at',    'module cargo, 11/09'),
      ('cargo_shipments', 'last_event_label', 'module cargo, 11/09'),
      ('cargo_shipments', 'last_synced_at',   'module cargo, 11/09'),
      ('cargo_shipments', 'eta_manual',       'suivi manuel du voyage, 03/10'),
      ('cargo_shipments', 'eta_manual_note',  'suivi manuel du voyage, 03/10'),
      ('cargo_shipments', 'eta_manual_at',    'suivi manuel du voyage, 03/10'),
      ('air_shipments',   'delivered_at',     'entrepôt de Douala, 21/09')
    ) AS c(tbl, col, origin)
    WHERE to_regclass('public.' || c.tbl) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = to_regclass('public.' || c.tbl) AND a.attname = c.col
                        AND a.attnum > 0 AND NOT a.attisdropped)
  LOOP
    v_missing := array_append(v_missing, 'colonne ' || r.tbl || '.' || r.col || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT f.fn, f.origin FROM (VALUES
      ('admin_has_permission',       'droits par rôle, 31/08'),
      ('parcel_status_for_shipment', 'réception, 20/09'),
      ('cargo_notify_client',        'notifications cargo, 21/09'),
      ('warehouse_release_json',     'entrepôt de Douala, 21/09')
    ) AS f(fn, origin)
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f.fn AND pronamespace = 'public'::regnamespace)
  LOOP
    v_missing := array_append(v_missing, 'fonction ' || r.fn || ' (' || r.origin || ')');
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration remise / vols / arrivée : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Copie conforme de 20261005150000_cargo_unblock_release_air_arrival.sql
-- ############################################################################
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


-- ████████████████████████████████████████████████████████████████████████████
-- PARTIE B
-- ████████████████████████████████████████████████████████████████████████████

-- ============================================================================
-- MIGRATION CONSOLIDÉE · 05/10/2026 · Mes équipes + commerciaux (rôle isolé,
-- prospects, objectifs du mois, tableaux de bord)
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- À passer APRÈS la PARTIE A de ce fichier (remise / vols / arrivée)
-- (le SQL libre de Mola y est fermé aux réglages de session : sans lui, le
-- verrou bonzini.client_source_write qui protège l'attribution des clients
-- reste contournable).
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un ; rien n'est
--      modifié) : sources des clients (PR #224), création d'un accès,
--      téléphone normalisé des clients, tables lues par les tableaux de bord.
--   1. La migration, copie conforme de
--        ← supabase/migrations/20261005160000_teams_commercials.sql
--      · rôle « commercial » ; permissions canProspect (le commercial) et
--        canManageSales (le super admin) ;
--      · ISOLATION : is_admin() exclut le commercial (une soixantaine de
--        politiques et une quinzaine de RPC lui sont donc fermées d'un coup) ;
--        portefeuilles et journal d'audit ne testent plus « a une ligne
--        user_roles » à la main ;
--      · user_roles.phone ; client_sources.staff_user_id (un compte
--        commercial = une fiche) ;
--      · Mes équipes : team_members, team_create_member (compte + fiche en
--        une transaction), team_update_member (journalisée ; jamais son
--        propre rôle ; toujours un super admin actif), team_link_commercial ;
--      · prospects (le commercial lit les siens) et leurs RPC ; un compte
--        client créé avec le numéro d'un prospect est attribué à son
--        commercial, le prospect passe « devenu client » ;
--      · set_client_source : plus de « re-tamponnage », chaque changement
--        journalisé ;
--      · objectifs du mois ; commercial_dashboard, commercial_clients,
--        sales_overview (mois de Douala).
--      Aucune donnée existante modifiée ; deux tables créées (prospects,
--      commercial_objectives), deux colonnes ajoutées.
--
-- Idempotent : rejouable sans dégât. Vérifié sur Postgres 16 : ce fichier
-- passé deux fois dans UNE transaction, puis 105 contrôles (droits de chaque
-- rôle, isolation du commercial sur les portefeuilles / le journal / les
-- sources, comptes créés ou refusés AVANT création, homonymes, fiche reprise,
-- prospects et doublons entre commerciaux, attribution automatique, origine
-- non ré-écrite, rattachement manuel, objectifs, chiffres du mois (paiements
-- terminés, avion en kg, bateau en m³, dépôts annulés exclus), changement de
-- rôle, dernier super admin, accès désactivé, droits d'exécution, étiquettes
-- @mola valides).
--
-- Après passage :
--   npx supabase migration repair --status applied 20261005160000
--   /gen-types
--   npx supabase functions deploy admin-assistant   ← AVANT de créer le premier
--     commercial : la passerelle Mola déployée aujourd'hui donnerait à un rôle
--     inconnu les droits d'un chargé de clientèle.
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  r         RECORD;
BEGIN
  FOR r IN
    SELECT t.tbl, t.origin FROM (VALUES
      ('user_roles',       'comptes du personnel'),
      ('clients',          'clients'),
      ('client_sources',   'sources des clients, PR #224 (05/10)'),
      ('client_phones',    'numéros des clients, 01/09'),
      ('wallets',          'portefeuilles'),
      ('admin_audit_logs', 'journal d''audit'),
      ('deposits',         'dépôts'),
      ('payments',         'paiements'),
      ('parcels',          'réception, 20/09'),
      ('parcel_deposits',  'réception, 20/09')
    ) AS t(tbl, origin)
    WHERE to_regclass('public.' || t.tbl) IS NULL
  LOOP
    v_missing := array_append(v_missing, 'table public.' || r.tbl || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT c.tbl, c.col, c.origin
    FROM (VALUES
      ('clients',         'source_id',      'sources des clients, PR #224'),
      ('clients',         'source_set_at',  'sources des clients, PR #224'),
      ('clients',         'source_set_by',  'sources des clients, PR #224'),
      ('clients',         'phone_e164',     'SMS, 10/08'),
      ('client_phones',   'phone_e164',     'numéros des clients, 01/09'),
      ('parcel_deposits', 'location',       'réception, 20/09'),
      ('parcel_deposits', 'client_user_id', 'réception, 20/09'),
      ('parcels',         'weight_kg',      'réception, 20/09'),
      ('parcels',         'cbm',            'réception, 20/09'),
      ('deposits',        'confirmed_amount_xaf', 'dépôts'),
      ('payments',        'cash_paid_at',   'paiements cash')
    ) AS c(tbl, col, origin)
    WHERE to_regclass('public.' || c.tbl) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = to_regclass('public.' || c.tbl) AND a.attname = c.col
                        AND a.attnum > 0 AND NOT a.attisdropped)
  LOOP
    v_missing := array_append(v_missing, 'colonne ' || r.tbl || '.' || r.col || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT f.fn, f.origin FROM (VALUES
      ('admin_has_permission', 'droits par rôle, 31/08'),
      ('admin_create_admin',   'création d''un accès, 21/09'),
      ('guard_client_source',  'sources des clients, PR #224'),
      ('set_client_source',    'sources des clients, PR #224')
    ) AS f(fn, origin)
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f.fn AND pronamespace = 'public'::regnamespace)
  LOOP
    v_missing := array_append(v_missing, 'fonction ' || r.fn || ' (' || r.origin || ')');
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    v_missing := array_append(v_missing, 'type public.app_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_client_phone_sync_e164' AND tgrelid = to_regclass('public.clients')) THEN
    v_missing := array_append(v_missing, 'déclencheur on_client_phone_sync_e164 (SMS, 10/08)');
  END IF;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration Mes équipes / commerciaux : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Copie conforme de 20261005160000_teams_commercials.sql
-- ############################################################################
-- ============================================================
-- MES ÉQUIPES + COMMERCIAUX
--
-- Le fondateur crée lui-même tous les accès (réceptionnaires, agents,
-- commerciaux…) depuis « Mes équipes ». Le commercial a son espace : ses
-- prospects, ses clients, ses chiffres (paiements, colis avion et bateau) et
-- ses objectifs du mois. Rien d'autre.
--
--  1. Rôle « commercial » et deux permissions : canProspect (le commercial),
--     canManageSales (le super admin : tous les commerciaux, les objectifs).
--  2. ISOLATION. is_admin() voulait dire « a une ligne user_roles » : il
--     ouvre une soixantaine de politiques (portefeuilles, dépôts, paiements,
--     bénéficiaires, colis, preuves…) et une quinzaine de RPC. Un commercial
--     y aurait tout lu. is_admin() exclut désormais le commercial ; trois
--     politiques qui testaient la ligne user_roles à la main (portefeuilles,
--     journal d'audit) passent par is_admin(). Le commercial n'a donc QUE
--     ses RPC, chacune limitée à SA source.
--  3. user_roles.phone ; client_sources.staff_user_id : un compte commercial
--     = une source (celle que la réception choisit à la création d'un client).
--  4. Équipe : team_members, team_create_member (compte + source en une
--     transaction), team_update_member (audité : plus d'UPDATE direct, plus
--     de super admin orphelin), team_link_commercial.
--  5. Prospects : table (lecture : le commercial voit les siens), RPC de
--     création, modification, statut, réattribution, rattachement à un
--     client ; recherche par numéro pour pré-remplir l'origine d'un nouveau
--     client. Un compte client créé avec le numéro d'un prospect est
--     attribué à son commercial et le prospect passe « devenu client ».
--  6. set_client_source : même source = rien à faire (plus de « re-tamponnage »
--     de la date et de l'auteur) ; chaque changement est journalisé.
--  7. Objectifs mensuels et tableaux de bord : commercial_dashboard,
--     commercial_clients, sales_overview (mois de Douala, bornes semi-ouvertes).
--
-- La valeur 'commercial' n'est utilisée qu'en texte (role::text) : pas
-- d'« unsafe use of new enum value » dans la transaction. Idempotente.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Rôle + permissions
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'commercial';

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
        WHEN 'canGrantOverdraft'    THEN ur.role::text IN ('super_admin')
        WHEN 'canReceiveParcels'    THEN ur.role::text IN ('super_admin','ops','receptionist')
        WHEN 'canRegisterClients'   THEN ur.role::text IN ('super_admin','ops','support','customer_success','receptionist')
        WHEN 'canPriceParcels'      THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canCollectParcelPayments' THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canReceiveAtDestination'  THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canReleaseParcels'        THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canViewCustoms'       THEN ur.role::text IN ('super_admin','ops','support','customer_success','customs_broker')
        WHEN 'canSignCustoms'       THEN ur.role::text IN ('customs_broker')
        WHEN 'canManageCustoms'     THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canProspect'          THEN ur.role::text IN ('commercial')
        WHEN 'canManageSales'       THEN ur.role::text IN ('super_admin')
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Isolation du commercial
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (is_disabled = false OR is_disabled IS NULL)
      AND role::text <> 'commercial'
  )
$$;

COMMENT ON FUNCTION public.is_admin(UUID) IS
  'Vrai pour un membre ACTIF du personnel qui travaille dans l''administration (tous les rôles sauf commercial). Ne teste aucune permission : les RPC sensibles passent par admin_has_permission. Le commercial n''a que ses propres RPC.';

-- Quelques fonctions anciennes appellent is_admin() sans argument ; aucune
-- migration du dépôt ne la crée. Si elle existe en base, elle suit la règle.
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_admin' AND p.pronargs = 0
       AND p.prorettype = 'boolean'::regtype
  ) THEN
    EXECUTE 'CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean '
         || 'LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public '
         || 'AS ''SELECT public.is_admin(auth.uid())''';
  END IF;
END $do$;

-- Politiques qui testaient « a une ligne user_roles » à la main (sans
-- is_admin ni filtre is_disabled) : un commercial aurait lu tous les soldes
-- et tout le journal d'audit.
DROP POLICY IF EXISTS "Admins can view all wallets" ON public.wallets;
CREATE POLICY "Admins can view all wallets" ON public.wallets
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Colonnes
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS phone TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_phone_length') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_phone_length CHECK (phone IS NULL OR length(phone) <= 32);
  END IF;
END $$;

-- Un compte commercial = une source « commercial ». La source garde
-- l'historique des clients attribués même si le compte change ou disparaît.
ALTER TABLE public.client_sources ADD COLUMN IF NOT EXISTS staff_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_sources_staff_user_key
  ON public.client_sources (staff_user_id) WHERE staff_user_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_sources_staff_kind_check') THEN
    ALTER TABLE public.client_sources ADD CONSTRAINT client_sources_staff_kind_check
      CHECK (staff_user_id IS NULL OR kind = 'commercial');
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Aides internes
-- ─────────────────────────────────────────────────────────────────────────
-- La source du commercial connecté (actif, rôle commercial), ou NULL.
CREATE OR REPLACE FUNCTION public.current_commercial_source_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
    FROM public.client_sources s
    JOIN public.user_roles ur ON ur.user_id = s.staff_user_id
   WHERE s.staff_user_id = auth.uid()
     AND ur.role::text = 'commercial'
     AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
   LIMIT 1
$$;

-- La source sur laquelle l'appelant peut travailler : la sienne (p_source_id
-- NULL ou égal), ou n'importe laquelle avec canManageSales. NULL = refus.
CREATE OR REPLACE FUNCTION public._sales_scope(p_source_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_own UUID := public.current_commercial_source_id();
BEGIN
  IF p_source_id IS NULL THEN
    RETURN v_own;
  END IF;
  IF p_source_id = v_own OR public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN p_source_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Le message d'un refus de périmètre : un commercial pas encore relié à sa
-- source doit le savoir, les autres sont simplement refusés.
CREATE OR REPLACE FUNCTION public._sales_scope_error()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('success', false, 'error',
    CASE WHEN public.admin_has_permission(auth.uid(), 'canProspect') AND public.current_commercial_source_id() IS NULL
           THEN 'Votre compte n''est pas encore relié à votre fiche commercial. Demandez-le au responsable.'
         WHEN public.admin_has_permission(auth.uid(), 'canManageSales')
           THEN 'Choisissez le commercial'
         ELSE 'Accès non autorisé' END)
$$;

-- Un numéro au format international (+237…), espaces et tirets retirés ;
-- « 00 » vaut « + ». NULL si ce n'est pas un numéro valable.
CREATE OR REPLACE FUNCTION public._phone_e164(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN v ~ '^\+[1-9][0-9]{7,14}$' THEN v END
    FROM (SELECT regexp_replace(regexp_replace(btrim(coalesce(p_phone, '')), '[\s.()\-]', '', 'g'), '^00', '+') AS v) x
$$;

-- Mois de Douala → bornes [début, fin[.
CREATE OR REPLACE FUNCTION public._sales_month(p_month DATE)
RETURNS TABLE (month DATE, from_at TIMESTAMPTZ, to_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT m, m::timestamp AT TIME ZONE 'Africa/Douala', (m + interval '1 month')::timestamp AT TIME ZONE 'Africa/Douala'
    FROM (SELECT date_trunc('month', coalesce(p_month, (now() AT TIME ZONE 'Africa/Douala')::date))::date AS m) x
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. L'équipe
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.team_members()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', ur.user_id,
           'role', ur.role::text,
           'email', coalesce(ur.email, u.email),
           'first_name', ur.first_name,
           'last_name', ur.last_name,
           'phone', ur.phone,
           'avatar_url', ur.avatar_url,
           'is_disabled', coalesce(ur.is_disabled, false),
           'created_at', ur.created_at,
           'last_sign_in_at', u.last_sign_in_at,
           'source', CASE WHEN s.id IS NULL THEN NULL
                          ELSE jsonb_build_object('id', s.id, 'label', s.label, 'phone', s.phone, 'is_active', s.is_active) END
         ) ORDER BY coalesce(ur.is_disabled, false), lower(coalesce(ur.first_name, '')), lower(coalesce(ur.last_name, ''))), '[]'::jsonb)
    INTO v_rows
    FROM public.user_roles ur
    LEFT JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN public.client_sources s ON s.staff_user_id = ur.user_id;

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

-- Crée le compte (admin_create_admin : super admin seul, mot de passe
-- provisoire) et, pour un commercial, le relie à sa source — existante
-- (choisie dans la liste : elle garde ses clients) ou nouvelle (à son nom).
-- Tout est vérifié AVANT de créer le compte ; une panne après annule tout.
CREATE OR REPLACE FUNCTION public.team_create_member(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role TEXT,
  p_phone TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := btrim(coalesce(p_role, ''));
  v_phone TEXT := nullif(btrim(coalesce(p_phone, '')), '');
  v_label TEXT := left(btrim(btrim(coalesce(p_first_name, '')) || ' ' || btrim(coalesce(p_last_name, ''))), 80);
  v_src public.client_sources;
  v_src_id UUID;
  v_res JSONB;
  v_new UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_phone IS NOT NULL AND length(v_phone) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro trop long');
  END IF;

  IF v_role = 'commercial' THEN
    IF p_source_id IS NOT NULL THEN
      SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id FOR UPDATE;
      IF NOT FOUND OR v_src.kind <> 'commercial' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Choisissez une fiche de type « commercial »');
      END IF;
      IF NOT v_src.is_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée');
      END IF;
      IF v_src.staff_user_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cette fiche est déjà reliée à un autre compte');
      END IF;
    ELSIF length(v_label) >= 2 AND EXISTS (
      SELECT 1 FROM public.client_sources WHERE kind = 'commercial' AND lower(btrim(label)) = lower(v_label)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Une fiche commercial « ' || v_label || ' » existe déjà : choisissez-la dans la liste pour qu''il garde ses clients.');
    END IF;
  ELSIF p_source_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un commercial se relie à une fiche');
  END IF;

  v_res := public.admin_create_admin(p_email, p_first_name, p_last_name, v_role);
  IF NOT coalesce((v_res ->> 'success')::boolean, false) THEN
    RETURN v_res;
  END IF;
  v_new := (v_res ->> 'userId')::uuid;

  IF v_phone IS NOT NULL THEN
    UPDATE public.user_roles SET phone = v_phone WHERE user_id = v_new;
  END IF;

  IF v_role = 'commercial' THEN
    IF v_src.id IS NOT NULL THEN
      UPDATE public.client_sources
         SET staff_user_id = v_new, phone = coalesce(phone, v_phone), updated_at = now()
       WHERE id = v_src.id;
      v_src_id := v_src.id;
    ELSE
      INSERT INTO public.client_sources (kind, label, phone, created_by, staff_user_id)
      VALUES ('commercial', v_label, v_phone, v_uid, v_new)
      RETURNING id INTO v_src_id;
    END IF;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'link_commercial_source', 'admin_user', v_new,
            jsonb_build_object('source_id', v_src_id, 'existing', v_src.id IS NOT NULL));
  END IF;

  RETURN v_res || jsonb_build_object('sourceId', v_src_id);
END;
$$;

-- Nom, téléphone, rôle — audité. NULL = inchangé ; '' efface le téléphone.
-- Personne ne change son propre rôle ; il reste toujours un super admin actif.
-- Un commercial qui change de rôle est détaché de sa fiche (qui garde ses clients).
CREATE OR REPLACE FUNCTION public.team_update_member(
  p_user_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.user_roles;
  v_role TEXT := nullif(btrim(coalesce(p_role, '')), '');
  v_valid TEXT[] := (SELECT array_agg(e::text) FROM unnest(enum_range(NULL::public.app_role)) AS e);
  v_phone TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.user_roles WHERE user_id = p_user_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Membre introuvable');
  END IF;
  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NOT NULL AND btrim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF length(btrim(coalesce(p_first_name, ''))) > 80 OR length(btrim(coalesce(p_last_name, ''))) > 80 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nom trop long');
  END IF;
  v_phone := CASE WHEN p_phone IS NULL THEN v_row.phone ELSE nullif(btrim(p_phone), '') END;
  IF v_phone IS NOT NULL AND length(v_phone) > 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro trop long');
  END IF;

  IF v_role IS NOT NULL AND v_role <> v_row.role::text THEN
    IF p_user_id = v_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas changer votre propre rôle');
    END IF;
    IF NOT v_role = ANY(v_valid) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Rôle inconnu');
    END IF;
    IF v_row.role::text = 'super_admin' AND NOT EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE role::text = 'super_admin' AND user_id <> p_user_id
         AND (is_disabled = false OR is_disabled IS NULL)
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Il doit rester au moins un super admin actif');
    END IF;
  ELSE
    v_role := NULL;
  END IF;

  UPDATE public.user_roles
     SET first_name = coalesce(btrim(p_first_name), first_name),
         last_name  = coalesce(btrim(p_last_name), last_name),
         phone      = v_phone,
         role       = coalesce(v_role::public.app_role, role)
   WHERE user_id = p_user_id;

  IF v_role IS NOT NULL AND v_row.role::text = 'commercial' THEN
    UPDATE public.client_sources SET staff_user_id = NULL, updated_at = now() WHERE staff_user_id = p_user_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'update_admin', 'admin_user', p_user_id, jsonb_build_object(
    'before', jsonb_build_object('first_name', v_row.first_name, 'last_name', v_row.last_name, 'phone', v_row.phone, 'role', v_row.role::text),
    'after',  jsonb_build_object('first_name', coalesce(btrim(p_first_name), v_row.first_name),
                                 'last_name', coalesce(btrim(p_last_name), v_row.last_name),
                                 'phone', v_phone, 'role', coalesce(v_role, v_row.role::text))));

  RETURN jsonb_build_object('success', true, 'role', coalesce(v_role, v_row.role::text));
END;
$$;

-- Relier un compte commercial à sa fiche : une fiche existante (libre) ou
-- une nouvelle à son nom. L'ancienne fiche éventuelle est détachée (elle
-- garde ses clients et ses prospects).
CREATE OR REPLACE FUNCTION public.team_link_commercial(p_user_id UUID, p_source_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.user_roles;
  v_src public.client_sources;
  v_label TEXT;
  v_src_id UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.user_roles WHERE user_id = p_user_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_row.role::text <> 'commercial' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce membre n''est pas commercial');
  END IF;

  IF p_source_id IS NOT NULL THEN
    SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id FOR UPDATE;
    IF NOT FOUND OR v_src.kind <> 'commercial' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Choisissez une fiche de type « commercial »');
    END IF;
    IF NOT v_src.is_active THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée');
    END IF;
    IF v_src.staff_user_id IS NOT NULL AND v_src.staff_user_id <> p_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette fiche est déjà reliée à un autre compte');
    END IF;
    v_src_id := v_src.id;
  ELSE
    SELECT * INTO v_src FROM public.client_sources WHERE staff_user_id = p_user_id;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'source_id', v_src.id, 'label', v_src.label);
    END IF;
    v_label := left(btrim(btrim(coalesce(v_row.first_name, '')) || ' ' || btrim(coalesce(v_row.last_name, ''))), 80);
    IF length(v_label) < 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Renseignez d''abord le nom du commercial');
    END IF;
    IF EXISTS (SELECT 1 FROM public.client_sources WHERE kind = 'commercial' AND lower(btrim(label)) = lower(v_label)) THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Une fiche commercial « ' || v_label || ' » existe déjà : choisissez-la dans la liste.');
    END IF;
  END IF;

  UPDATE public.client_sources SET staff_user_id = NULL, updated_at = now()
   WHERE staff_user_id = p_user_id AND id IS DISTINCT FROM v_src_id;

  IF v_src_id IS NOT NULL THEN
    UPDATE public.client_sources
       SET staff_user_id = p_user_id, phone = coalesce(phone, v_row.phone), updated_at = now()
     WHERE id = v_src_id
     RETURNING label INTO v_label;
  ELSE
    INSERT INTO public.client_sources (kind, label, phone, created_by, staff_user_id)
    VALUES ('commercial', v_label, v_row.phone, v_uid, p_user_id)
    RETURNING id INTO v_src_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'link_commercial_source', 'admin_user', p_user_id, jsonb_build_object('source_id', v_src_id));

  RETURN jsonb_build_object('success', true, 'source_id', v_src_id, 'label', v_label);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Prospects
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.client_sources(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name TEXT CHECK (last_name IS NULL OR length(last_name) <= 80),
  company TEXT CHECK (company IS NULL OR length(company) <= 120),
  phone TEXT NOT NULL CHECK (length(phone) <= 32),
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  city TEXT CHECK (city IS NULL OR length(city) <= 80),
  -- Ce qui l'intéresse : payer ses fournisseurs, le fret avion, le fret bateau.
  interests TEXT[] NOT NULL DEFAULT '{}' CHECK (interests <@ ARRAY['payments','air','sea']::text[]),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','interested','won','lost')),
  lost_reason TEXT CHECK (lost_reason IS NULL OR length(lost_reason) <= 300),
  next_action_at TIMESTAMPTZ,
  converted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un numéro n'est suivi que par un commercial à la fois (tant que le
-- prospect est ouvert) ; un client n'est le « devenu client » que d'un prospect.
CREATE UNIQUE INDEX IF NOT EXISTS prospects_open_phone_key
  ON public.prospects (phone_e164) WHERE status IN ('new','contacted','interested');
CREATE UNIQUE INDEX IF NOT EXISTS prospects_converted_user_key
  ON public.prospects (converted_user_id) WHERE converted_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospects_source_status_idx ON public.prospects (source_id, status);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commercial reads own prospects" ON public.prospects;
CREATE POLICY "Commercial reads own prospects" ON public.prospects
  FOR SELECT TO authenticated
  USING (source_id = public.current_commercial_source_id()
         OR public.admin_has_permission(auth.uid(), 'canManageSales'));
-- Aucune politique d'écriture : tout passe par les RPC ci-dessous.

-- Le numéro est-il déjà celui d'un client ?
CREATE OR REPLACE FUNCTION public._phone_is_client(p_e164 TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE phone_e164 = p_e164)
      OR EXISTS (SELECT 1 FROM public.client_phones WHERE phone_e164 = p_e164)
$$;

CREATE OR REPLACE FUNCTION public.prospect_create(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_src UUID := public._sales_scope(p_source_id);
  v_e164 TEXT := public._phone_e164(p_phone);
  v_open public.prospects;
  v_id UUID;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_src AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée ou introuvable');
  END IF;
  IF length(btrim(coalesce(p_first_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
  END IF;
  IF public._phone_is_client(v_e164) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un client Bonzini');
  END IF;
  SELECT * INTO v_open FROM public.prospects
   WHERE phone_e164 = v_e164 AND status IN ('new','contacted','interested');
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE WHEN v_open.source_id = v_src THEN 'Ce prospect est déjà dans votre liste'
           ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
  END IF;

  INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes, next_action_at, created_by)
  VALUES (v_src, btrim(p_first_name), nullif(btrim(coalesce(p_last_name, '')), ''), nullif(btrim(coalesce(p_company, '')), ''),
          btrim(p_phone), v_e164, nullif(btrim(coalesce(p_city, '')), ''),
          coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}'),
          nullif(btrim(coalesce(p_notes, '')), ''), p_next_action_at, v_uid)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- NULL = inchangé ; '' efface un champ facultatif. p_clear_next_action
-- efface la date de relance (NULL ne peut pas le dire).
CREATE OR REPLACE FUNCTION public.prospect_update(
  p_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_clear_next_action BOOLEAN DEFAULT false,
  p_interests TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_e164 TEXT;
BEGIN
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  v_e164 := v_p.phone_e164;
  IF p_phone IS NOT NULL AND public._phone_e164(p_phone) IS DISTINCT FROM v_p.phone_e164 THEN
    IF v_p.status = 'won' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : son numéro ne change plus ici');
    END IF;
    v_e164 := public._phone_e164(p_phone);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
    END IF;
    IF public._phone_is_client(v_e164) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un client Bonzini');
    END IF;
  END IF;

  UPDATE public.prospects
     SET first_name = coalesce(btrim(p_first_name), first_name),
         last_name  = CASE WHEN p_last_name IS NULL THEN last_name ELSE nullif(btrim(p_last_name), '') END,
         company    = CASE WHEN p_company IS NULL THEN company ELSE nullif(btrim(p_company), '') END,
         city       = CASE WHEN p_city IS NULL THEN city ELSE nullif(btrim(p_city), '') END,
         notes      = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(btrim(p_notes), '') END,
         phone      = CASE WHEN p_phone IS NULL THEN phone ELSE btrim(p_phone) END,
         phone_e164 = v_e164,
         interests  = CASE WHEN p_interests IS NULL THEN interests
                           ELSE coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}') END,
         next_action_at = CASE WHEN p_clear_next_action THEN NULL ELSE coalesce(p_next_action_at, next_action_at) END,
         updated_at = now()
   WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- « Devenu client » ne se pose pas à la main : il vient de la création du
-- compte (même numéro) ou du rattachement par le responsable.
CREATE OR REPLACE FUNCTION public.prospect_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('new','contacted','interested','lost') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut inconnu');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà devenu client');
  END IF;
  IF p_status = 'lost' AND (v_reason IS NULL OR length(v_reason) < 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dites en quelques mots pourquoi il est perdu');
  END IF;
  IF v_p.status = 'lost' AND p_status <> 'lost' AND public._phone_is_client(v_p.phone_e164) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un client Bonzini');
  END IF;

  UPDATE public.prospects
     SET status = p_status,
         lost_reason = CASE WHEN p_status = 'lost' THEN v_reason ELSE NULL END,
         status_changed_at = CASE WHEN status = p_status THEN status_changed_at ELSE now() END,
         updated_at = now()
   WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
END;
$$;

CREATE OR REPLACE FUNCTION public.prospect_reassign(p_id UUID, p_source_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = p_source_id AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choisissez un commercial actif');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà devenu client : changez l''origine du client');
  END IF;
  UPDATE public.prospects SET source_id = p_source_id, updated_at = now() WHERE id = p_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'prospect_reassign', 'prospect', p_id, jsonb_build_object('from', v_p.source_id, 'to', p_source_id));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Le responsable rattache un prospect au compte client qu'il est devenu
-- (numéro différent, compte créé avant…). Le client sans origine (ou « Je ne
-- sais pas ») est attribué au commercial du prospect ; une autre origine
-- déjà posée n'est pas écrasée.
CREATE OR REPLACE FUNCTION public.prospect_link_client(p_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.prospects;
  v_client public.clients;
  v_attributed BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà rattaché à un client');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF EXISTS (SELECT 1 FROM public.prospects WHERE converted_user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
  END IF;
  IF v_client.source_id IS NOT NULL AND v_client.source_id <> v_p.source_id
     AND NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_client.source_id AND is_system) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client est déjà attribué à une autre source : changez d''abord son origine');
  END IF;

  IF v_client.source_id IS DISTINCT FROM v_p.source_id THEN
    PERFORM set_config('bonzini.client_source_write', 'on', true);
    UPDATE public.clients SET source_id = v_p.source_id, source_set_at = now(), source_set_by = v_uid WHERE user_id = p_user_id;
    PERFORM set_config('bonzini.client_source_write', '', true);
    v_attributed := true;
  END IF;

  UPDATE public.prospects
     SET status = 'won', converted_user_id = p_user_id, converted_at = now(),
         status_changed_at = now(), lost_reason = NULL, updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'prospect_link_client', 'prospect', p_id,
          jsonb_build_object('client_user_id', p_user_id, 'source_id', v_p.source_id, 'attributed', v_attributed));
  RETURN jsonb_build_object('success', true, 'attributed', v_attributed);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
END;
$$;

-- Pour le formulaire « Nouveau client » : ce numéro est-il le prospect d'un
-- commercial ? L'origine se pré-remplit avec sa fiche.
CREATE OR REPLACE FUNCTION public.prospect_lookup_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_e164 TEXT := public._phone_e164(p_phone);
  v_row RECORD;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canRegisterClients')
          OR public.admin_has_permission(v_uid, 'canEditClients')
          OR public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  SELECT p.id, p.first_name, p.last_name, p.source_id, s.label, s.is_active
    INTO v_row
    FROM public.prospects p JOIN public.client_sources s ON s.id = p.source_id
   WHERE p.phone_e164 = v_e164 AND p.status IN ('new','contacted','interested')
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  RETURN jsonb_build_object('success', true, 'found', true,
    'prospect_id', v_row.id,
    'prospect_name', btrim(v_row.first_name || ' ' || coalesce(v_row.last_name, '')),
    'source_id', v_row.source_id, 'source_label', v_row.label, 'source_active', v_row.is_active);
END;
$$;

-- Attribution automatique : un compte client créé (ou qui reçoit son premier
-- numéro) avec le numéro d'un prospect ouvert est attribué à son commercial,
-- si aucune origine n'est encore posée ; et le prospect dont le commercial
-- est l'origine du client passe « devenu client ». Le nom du déclencheur le
-- fait passer APRÈS clients_guard_source et on_client_phone_sync_e164 (ordre
-- alphabétique) : phone_e164 est à jour, le verrou de l'origine a déjà joué.
-- Jamais d'erreur : une inscription ne doit pas échouer pour un prospect.
CREATE OR REPLACE FUNCTION public.clients_match_prospect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
BEGIN
  IF NEW.phone_e164 IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.phone_e164 IS NOT DISTINCT FROM OLD.phone_e164
     AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT * INTO v_p FROM public.prospects
     WHERE phone_e164 = NEW.phone_e164 AND status IN ('new','contacted','interested')
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Première origine seulement : à la création, ou quand le compte reçoit
    -- son tout premier numéro. Un client qui change de numéro plus tard ne
    -- se ré-attribue pas.
    IF NEW.source_id IS NULL AND (TG_OP = 'INSERT' OR OLD.phone_e164 IS NULL) THEN
      NEW.source_id := v_p.source_id;
      NEW.source_set_at := now();
      NEW.source_set_by := NULL;
    END IF;

    IF NEW.source_id = v_p.source_id THEN
      UPDATE public.prospects
         SET status = 'won', converted_user_id = NEW.user_id, converted_at = now(),
             status_changed_at = now(), updated_at = now()
       WHERE id = v_p.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clients_match_prospect: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prospect_match_client ON public.clients;
CREATE TRIGGER prospect_match_client
  BEFORE INSERT OR UPDATE OF phone, source_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_match_prospect();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. set_client_source : pas de re-tamponnage, chaque changement journalisé
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_client_source(p_user_id uuid, p_source_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client public.clients;
  v_src public.client_sources;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canRegisterClients') OR public.admin_has_permission(v_uid, 'canEditClients')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  -- Même origine : rien à faire. L'auteur et la date de l'attribution
  -- d'origine restent ceux d'origine (ils décident des commissions).
  IF v_client.source_id IS NOT DISTINCT FROM p_source_id THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true);
  END IF;
  IF v_client.source_id IS NOT NULL
     AND NOT public.admin_has_permission(v_uid, 'canEditClients') THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''origine de ce client est déjà renseignée');
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id;
  IF NOT FOUND OR NOT v_src.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Source introuvable ou archivée');
  END IF;

  PERFORM set_config('bonzini.client_source_write', 'on', true);
  UPDATE public.clients
     SET source_id = p_source_id, source_set_at = now(), source_set_by = v_uid
   WHERE user_id = p_user_id;
  PERFORM set_config('bonzini.client_source_write', '', true);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_client_source', 'client', p_user_id,
          jsonb_build_object('from', v_client.source_id, 'to', p_source_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.set_client_source(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Renseigner ou changer l''origine d''un client (quel commercial ou canal l''a apporté)","resolve":{"p_user_id":"client"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Objectifs et tableaux de bord
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.client_sources(id) ON DELETE CASCADE,
  month DATE NOT NULL CHECK (month = date_trunc('month', month)::date),
  metric TEXT NOT NULL CHECK (metric IN ('new_clients','payments_xaf','air_kg','sea_cbm','prospects_new','prospects_won')),
  target NUMERIC NOT NULL CHECK (target > 0 AND target < 1e13),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, month, metric)
);

ALTER TABLE public.commercial_objectives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commercial reads own objectives" ON public.commercial_objectives;
CREATE POLICY "Commercial reads own objectives" ON public.commercial_objectives
  FOR SELECT TO authenticated
  USING (source_id = public.current_commercial_source_id()
         OR public.admin_has_permission(auth.uid(), 'canManageSales'));

-- p_target NULL ou ≤ 0 : l'objectif est retiré.
CREATE OR REPLACE FUNCTION public.set_commercial_objective(p_source_id UUID, p_month DATE, p_metric TEXT, p_target NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_month DATE := date_trunc('month', p_month)::date;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_month IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mois requis');
  END IF;
  IF p_metric IS NULL OR p_metric NOT IN ('new_clients','payments_xaf','air_kg','sea_cbm','prospects_new','prospects_won') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Objectif inconnu');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = p_source_id AND kind = 'commercial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commercial introuvable');
  END IF;
  IF p_target IS NOT NULL AND p_target >= 1e13 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Objectif trop grand');
  END IF;

  IF p_target IS NULL OR p_target <= 0 THEN
    DELETE FROM public.commercial_objectives WHERE source_id = p_source_id AND month = v_month AND metric = p_metric;
  ELSE
    INSERT INTO public.commercial_objectives (source_id, month, metric, target, created_by)
    VALUES (p_source_id, v_month, p_metric, p_target, v_uid)
    ON CONFLICT (source_id, month, metric) DO UPDATE SET target = EXCLUDED.target, updated_at = now();
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_commercial_objective', 'client_source', p_source_id,
          jsonb_build_object('month', v_month, 'metric', p_metric, 'target', p_target));
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Les chiffres de plusieurs sources sur [p_from, p_to[ : clients apportés,
-- paiements TERMINÉS, dépôts VALIDÉS, colis déposés (avion = bureau, kg ;
-- bateau = entrepôt, m³), prospects ajoutés et devenus clients.
CREATE OR REPLACE FUNCTION public._commercial_metrics(p_source_ids UUID[], p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
  source_id UUID, clients INT, new_clients INT, active_clients INT,
  payments_xaf BIGINT, payments_count INT, deposits_xaf BIGINT, deposits_count INT,
  air_parcels INT, air_kg NUMERIC, sea_parcels INT, sea_cbm NUMERIC,
  prospects_open INT, prospects_new INT, prospects_won INT, prospects_due INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cl AS (
    SELECT c.user_id, c.source_id, c.created_at FROM public.clients c WHERE c.source_id = ANY(p_source_ids)
  ), pay AS (
    SELECT p.user_id, sum(p.amount_xaf)::bigint amt, count(*)::int n
      FROM public.payments p JOIN cl ON cl.user_id = p.user_id
     WHERE p.status = 'completed'
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) >= p_from
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) <  p_to
     GROUP BY 1
  ), dep AS (
    SELECT d.user_id, sum(coalesce(d.confirmed_amount_xaf, d.amount_xaf))::bigint amt, count(*)::int n
      FROM public.deposits d JOIN cl ON cl.user_id = d.user_id
     WHERE d.status = 'validated' AND d.validated_at >= p_from AND d.validated_at < p_to
     GROUP BY 1
  ), par AS (
    SELECT pd.client_user_id user_id,
           count(*) FILTER (WHERE pd.location = 'office')::int air_n,
           coalesce(sum(pa.weight_kg) FILTER (WHERE pd.location = 'office'), 0) air_kg,
           count(*) FILTER (WHERE pd.location = 'warehouse')::int sea_n,
           coalesce(sum(pa.cbm) FILTER (WHERE pd.location = 'warehouse'), 0) sea_cbm
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
     WHERE pd.status <> 'cancelled' AND pa.created_at >= p_from AND pa.created_at < p_to
     GROUP BY 1
  ), agg AS (
    SELECT cl.source_id,
           count(*)::int clients,
           count(*) FILTER (WHERE cl.created_at >= p_from AND cl.created_at < p_to)::int new_clients,
           count(*) FILTER (WHERE pay.user_id IS NOT NULL OR dep.user_id IS NOT NULL OR par.user_id IS NOT NULL)::int active_clients,
           coalesce(sum(pay.amt), 0)::bigint payments_xaf, coalesce(sum(pay.n), 0)::int payments_count,
           coalesce(sum(dep.amt), 0)::bigint deposits_xaf, coalesce(sum(dep.n), 0)::int deposits_count,
           coalesce(sum(par.air_n), 0)::int air_parcels, coalesce(sum(par.air_kg), 0) air_kg,
           coalesce(sum(par.sea_n), 0)::int sea_parcels, coalesce(sum(par.sea_cbm), 0) sea_cbm
      FROM cl
      LEFT JOIN pay ON pay.user_id = cl.user_id
      LEFT JOIN dep ON dep.user_id = cl.user_id
      LEFT JOIN par ON par.user_id = cl.user_id
     GROUP BY cl.source_id
  ), pr AS (
    SELECT p.source_id,
           count(*) FILTER (WHERE p.status IN ('new','contacted','interested'))::int open_n,
           count(*) FILTER (WHERE p.created_at >= p_from AND p.created_at < p_to)::int new_n,
           count(*) FILTER (WHERE p.status = 'won' AND p.converted_at >= p_from AND p.converted_at < p_to)::int won_n,
           count(*) FILTER (WHERE p.status IN ('new','contacted','interested') AND p.next_action_at <= now())::int due_n
      FROM public.prospects p
     WHERE p.source_id = ANY(p_source_ids)
     GROUP BY 1
  )
  SELECT s.id,
         coalesce(agg.clients, 0), coalesce(agg.new_clients, 0), coalesce(agg.active_clients, 0),
         coalesce(agg.payments_xaf, 0), coalesce(agg.payments_count, 0),
         coalesce(agg.deposits_xaf, 0), coalesce(agg.deposits_count, 0),
         coalesce(agg.air_parcels, 0), coalesce(agg.air_kg, 0),
         coalesce(agg.sea_parcels, 0), coalesce(agg.sea_cbm, 0),
         coalesce(pr.open_n, 0), coalesce(pr.new_n, 0), coalesce(pr.won_n, 0), coalesce(pr.due_n, 0)
    FROM unnest(p_source_ids) AS s(id)
    LEFT JOIN agg ON agg.source_id = s.id
    LEFT JOIN pr ON pr.source_id = s.id
$$;

-- Une ligne de tableau de bord (chiffres + objectifs du mois) au format JSON.
CREATE OR REPLACE FUNCTION public._commercial_card(p_source_id UUID, p_month DATE, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'source', jsonb_build_object('id', s.id, 'label', s.label, 'phone', s.phone, 'is_active', s.is_active),
    'staff', CASE WHEN ur.user_id IS NULL THEN NULL ELSE jsonb_build_object(
               'user_id', ur.user_id,
               'name', btrim(coalesce(ur.first_name, '') || ' ' || coalesce(ur.last_name, '')),
               'is_disabled', coalesce(ur.is_disabled, false)) END,
    'metrics', jsonb_build_object(
      'clients', m.clients, 'new_clients', m.new_clients, 'active_clients', m.active_clients,
      'payments_xaf', m.payments_xaf, 'payments_count', m.payments_count,
      'deposits_xaf', m.deposits_xaf, 'deposits_count', m.deposits_count,
      'air_parcels', m.air_parcels, 'air_kg', m.air_kg,
      'sea_parcels', m.sea_parcels, 'sea_cbm', m.sea_cbm,
      'prospects_open', m.prospects_open, 'prospects_new', m.prospects_new,
      'prospects_won', m.prospects_won, 'prospects_due', m.prospects_due),
    'objectives', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'metric', o.metric, 'target', o.target,
               'actual', CASE o.metric
                 WHEN 'new_clients'   THEN m.new_clients::numeric
                 WHEN 'payments_xaf'  THEN m.payments_xaf::numeric
                 WHEN 'air_kg'        THEN m.air_kg
                 WHEN 'sea_cbm'       THEN m.sea_cbm
                 WHEN 'prospects_new' THEN m.prospects_new::numeric
                 WHEN 'prospects_won' THEN m.prospects_won::numeric END)
             ORDER BY o.metric)
        FROM public.commercial_objectives o
       WHERE o.source_id = s.id AND o.month = p_month), '[]'::jsonb))
    FROM public.client_sources s
    LEFT JOIN public.user_roles ur ON ur.user_id = s.staff_user_id
    CROSS JOIN LATERAL public._commercial_metrics(ARRAY[s.id], p_from, p_to) m
   WHERE s.id = p_source_id
$$;

-- Le tableau de bord d'UN commercial pour un mois : le sien (p_source_id
-- NULL), ou celui de n'importe quel commercial avec canManageSales.
CREATE OR REPLACE FUNCTION public.commercial_dashboard(p_month DATE DEFAULT NULL, p_source_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src UUID := public._sales_scope(p_source_id);
  v_m RECORD;
  v_card JSONB;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  SELECT * INTO v_m FROM public._sales_month(p_month);
  v_card := public._commercial_card(v_src, v_m.month, v_m.from_at, v_m.to_at);
  IF v_card IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commercial introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'month', v_m.month) || v_card;
END;
$$;

-- Les clients d'un commercial, un par un, avec leurs chiffres du mois.
CREATE OR REPLACE FUNCTION public.commercial_clients(p_month DATE DEFAULT NULL, p_source_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src UUID := public._sales_scope(p_source_id);
  v_m RECORD;
  v_rows JSONB;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  SELECT * INTO v_m FROM public._sales_month(p_month);

  WITH cl AS (
    SELECT c.user_id, c.first_name, c.last_name, c.company_name, c.customer_code, c.phone, c.created_at, c.source_set_at
      FROM public.clients c WHERE c.source_id = v_src
  ), pay AS (
    SELECT p.user_id, sum(p.amount_xaf)::bigint amt, count(*)::int n
      FROM public.payments p JOIN cl ON cl.user_id = p.user_id
     WHERE p.status = 'completed'
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) >= v_m.from_at
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) <  v_m.to_at
     GROUP BY 1
  ), par AS (
    SELECT pd.client_user_id user_id,
           count(*) FILTER (WHERE pd.location = 'office')::int air_n,
           coalesce(sum(pa.weight_kg) FILTER (WHERE pd.location = 'office'), 0) air_kg,
           count(*) FILTER (WHERE pd.location = 'warehouse')::int sea_n,
           coalesce(sum(pa.cbm) FILTER (WHERE pd.location = 'warehouse'), 0) sea_cbm
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
     WHERE pd.status <> 'cancelled' AND pa.created_at >= v_m.from_at AND pa.created_at < v_m.to_at
     GROUP BY 1
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'user_id', cl.user_id,
           'name', btrim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')),
           'company', cl.company_name, 'customer_code', cl.customer_code, 'phone', cl.phone,
           'created_at', cl.created_at, 'source_set_at', cl.source_set_at,
           'payments_xaf', coalesce(pay.amt, 0), 'payments_count', coalesce(pay.n, 0),
           'air_parcels', coalesce(par.air_n, 0), 'air_kg', coalesce(par.air_kg, 0),
           'sea_parcels', coalesce(par.sea_n, 0), 'sea_cbm', coalesce(par.sea_cbm, 0)
         ) ORDER BY coalesce(pay.amt, 0) DESC, coalesce(par.air_kg, 0) + coalesce(par.sea_cbm, 0) * 167 DESC, cl.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM cl
    LEFT JOIN pay ON pay.user_id = cl.user_id
    LEFT JOIN par ON par.user_id = cl.user_id;

  RETURN jsonb_build_object('success', true, 'month', v_m.month, 'rows', v_rows);
END;
$$;

-- Tous les commerciaux pour un mois (le responsable) : fiches « commercial »
-- actives ou reliées à un compte, plus celles qui ont des clients ou des prospects.
CREATE OR REPLACE FUNCTION public.sales_overview(p_month DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m RECORD;
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_m FROM public._sales_month(p_month);

  SELECT coalesce(jsonb_agg(public._commercial_card(s.id, v_m.month, v_m.from_at, v_m.to_at)
                            ORDER BY (s.staff_user_id IS NULL), s.is_active DESC, lower(s.label)), '[]'::jsonb)
    INTO v_rows
    FROM public.client_sources s
   WHERE s.kind = 'commercial'
     AND (s.is_active OR s.staff_user_id IS NOT NULL
          OR EXISTS (SELECT 1 FROM public.clients c WHERE c.source_id = s.id)
          OR EXISTS (SELECT 1 FROM public.prospects p WHERE p.source_id = s.id));

  RETURN jsonb_build_object('success', true, 'month', v_m.month, 'rows', v_rows);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Droits
-- ─────────────────────────────────────────────────────────────────────────
-- Internes : jamais appelables depuis l'API.
REVOKE ALL ON FUNCTION public._sales_scope(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sales_scope_error() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._phone_is_client(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._commercial_metrics(UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._commercial_card(UUID, DATE, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clients_match_prospect() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._sales_scope(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public._commercial_metrics(UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- Lues par les politiques RLS (current_commercial_source_id) ou inoffensives.
REVOKE ALL ON FUNCTION public.current_commercial_source_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_commercial_source_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._phone_e164(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._phone_e164(TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._sales_month(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._sales_month(DATE) TO authenticated, service_role;

-- Les actions : membres du personnel connectés ; chaque RPC vérifie la permission.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.team_members()',
    'public.team_create_member(text, text, text, text, text, uuid)',
    'public.team_update_member(uuid, text, text, text, text)',
    'public.team_link_commercial(uuid, uuid)',
    'public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid)',
    'public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[])',
    'public.prospect_set_status(uuid, text, text)',
    'public.prospect_reassign(uuid, uuid)',
    'public.prospect_link_client(uuid, uuid)',
    'public.prospect_lookup_phone(text)',
    'public.set_commercial_objective(uuid, date, text, numeric)',
    'public.commercial_dashboard(date, uuid)',
    'public.commercial_clients(date, uuid)',
    'public.sales_overview(date)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Les comptes du personnel ne se gèrent pas par Mola (comme admin_create_admin).
-- Le commercial n'a pas Mola (la passerelle le refuse) : les actions de vente
-- sont ouvertes à Mola pour le responsable (canManageSales).
COMMENT ON FUNCTION public.team_members() IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Liste des membres de l''équipe (rôle, statut, dernière connexion, fiche commercial)"}';
COMMENT ON FUNCTION public.team_create_member(text, text, text, text, text, uuid) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Créer un accès pour un membre de l''équipe (et la fiche d''un commercial)"}';
COMMENT ON FUNCTION public.team_update_member(uuid, text, text, text, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Modifier un membre de l''équipe (nom, téléphone, rôle)"}';
COMMENT ON FUNCTION public.team_link_commercial(uuid, uuid) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Relier un compte commercial à sa fiche"}';
COMMENT ON FUNCTION public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Ajouter un prospect pour un commercial (prénom, numéro +237…, entreprise, ville, intérêts : payments / air / sea)"}';
COMMENT ON FUNCTION public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Modifier un prospect (coordonnées, notes, date de relance)"}';
COMMENT ON FUNCTION public.prospect_set_status(uuid, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Changer le statut d''un prospect (new, contacted, interested, lost avec motif)"}';
COMMENT ON FUNCTION public.prospect_reassign(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Confier un prospect à un autre commercial"}';
COMMENT ON FUNCTION public.prospect_link_client(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Rattacher un prospect au compte client qu''il est devenu (attribue le client à son commercial s''il n''a pas d''origine)","resolve":{"p_user_id":"client"}}';
COMMENT ON FUNCTION public.prospect_lookup_phone(text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canRegisterClients","label":"Ce numéro est-il le prospect d''un commercial ? (pour l''origine d''un nouveau client)"}';
COMMENT ON FUNCTION public.set_commercial_objective(uuid, date, text, numeric) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Fixer l''objectif du mois d''un commercial (new_clients, payments_xaf, air_kg, sea_cbm, prospects_new, prospects_won ; 0 le retire)"}';
COMMENT ON FUNCTION public.commercial_dashboard(date, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Tableau de bord d''un commercial pour un mois : clients, paiements, colis avion (kg) et bateau (m³), prospects, objectifs"}';
COMMENT ON FUNCTION public.commercial_clients(date, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Les clients d''un commercial avec leurs paiements et colis du mois"}';
COMMENT ON FUNCTION public.sales_overview(date) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Tous les commerciaux pour un mois : chiffres et objectifs côte à côte"}';
COMMENT ON FUNCTION public.current_commercial_source_id() IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : la fiche du commercial connecté"}';
COMMENT ON FUNCTION public._sales_scope(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : périmètre d''un commercial"}';
COMMENT ON FUNCTION public._sales_scope_error() IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : message de refus de périmètre"}';
COMMENT ON FUNCTION public._phone_e164(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : numéro au format international"}';
COMMENT ON FUNCTION public._sales_month(date) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : bornes d''un mois à Douala"}';
COMMENT ON FUNCTION public._phone_is_client(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : ce numéro est-il celui d''un client"}';
COMMENT ON FUNCTION public._commercial_metrics(uuid[], timestamptz, timestamptz) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : chiffres des commerciaux sur une période"}';
COMMENT ON FUNCTION public._commercial_card(uuid, date, timestamptz, timestamptz) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : carte d''un commercial"}';
COMMENT ON FUNCTION public.clients_match_prospect() IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","label":"Interne : attribution d''un nouveau client au commercial qui l''a prospecté"}';

NOTIFY pgrst, 'reload schema';


-- ████████████████████████████████████████████████████████████████████████████
-- PARTIE C
-- ████████████████████████████████████████████████████████████████████████████

-- ============================================================================
-- MIGRATION CONSOLIDÉE · 05/10/2026 · Cargo aérien › les paquets de 32 kg,
-- de Guangzhou à Douala · LTA provisoire
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- À passer APRÈS la PARTIE A de ce fichier (remise / vols / arrivée)
-- (sans elle, le premier départ d'un vol échoue encore : min(uuid)).
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un ; rien n'est
--      modifié), y compris la migration remise / vols / arrivée.
--   1. La migration, copie conforme de
--        ← supabase/migrations/20261005170000_air_packages.sql
--      · air_packages (PQ-000001…) et parcels.air_package_id ; lecture RLS
--        (réception, cargo, Douala), aucune écriture directe ;
--      · un colis emballé suit son paquet : jamais en conteneur, jamais
--        chargé ni retiré seul d'une expédition (déclencheur) ;
--      · RPC : créer, lister, trouver (scan PQ-…), ajouter / retirer un colis
--        (colis avion, pesé, avec client, 32 kg au plus), fermer (pesée brute,
--        dimensions), rouvrir, supprimer un paquet vide, affecter à une
--        expédition / l'en retirer, scanner au départ, refus de l'aéroport
--        (avant ou après le départ), réception et ouverture à Douala ;
--        pointer un colis à Douala ouvre son paquet ;
--      · l'expédition ne part qu'avec tous ses paquets scannés ; une arrivée
--        déjà travaillée à Douala ne s'annule plus ;
--      · LTA provisoire : une expédition s'ouvre avec une date de départ et
--        sans LTA (PROV-…), la vraie LTA se pose ensuite, même après le départ ;
--      · fiches expédition / colis / arrivée à Douala : leurs paquets ;
--      · une LTA provisoire ne s'affiche jamais « LTA PROV-… » : journée de
--        Douala, messages aux clients (départ, arrivée), notification de
--        l'équipe ; le dépôt dit le paquet de chaque colis ; les anciens
--        chargements à l'unité sautent les colis emballés au lieu d'échouer.
--      Une table et une colonne créées ; aucune donnée existante modifiée.
--
-- Idempotent : rejouable sans dégât. Vérifié sur Postgres 16 avec le schéma
-- cargo réel (migrations du dépôt) : ce fichier passé deux fois dans UNE
-- transaction, 79 contrôles (lecture des codes, droits de chaque rôle, 32 kg,
-- colis bateau / sans client / non pesé / d'un dépôt supprimé refusés, un
-- colis dans un seul paquet, conteneur et chargement à l'unité bloqués,
-- pesée, réouverture, affectation, scan au départ, départ refusé tant qu'il
-- manque un scan, refus de l'aéroport après le départ, ré-affectation,
-- Douala : réception, ouverture au pointage, arrivée non annulable, LTA
-- provisoire et jamais affichée PROV-… (Douala, messages clients), le dépôt
-- dit le paquet de chaque colis, chargements à l'unité qui sautent les colis
-- emballés, étiquettes @mola) ; et les 61 contrôles du lot remise / vols
-- repassés avec ce lot en place.
--
-- Après passage :
--   npx supabase migration repair --status applied 20261005170000
--   /gen-types
--   app BONZINI HQ : cd hq-app && npm run update:production (scan d'un PQ-…)
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  r         RECORD;
BEGIN
  FOR r IN
    SELECT t.tbl, t.origin FROM (VALUES
      ('air_shipments',    'cargo aérien, 21/09'),
      ('parcels',          'réception, 20/09'),
      ('parcel_deposits',  'réception, 20/09'),
      ('parcel_quotes',    'devis cargo, 21/09'),
      ('parcel_releases',  'entrepôt de Douala, 21/09'),
      ('cargo_shipments',  'module cargo, 11/09'),
      ('parcel_photos',    'photos multiples, 02/10'),
      ('notifications',    'notifications'),
      ('admin_audit_logs', 'journal d''audit')
    ) AS t(tbl, origin)
    WHERE to_regclass('public.' || t.tbl) IS NULL
  LOOP
    v_missing := array_append(v_missing, 'table public.' || r.tbl || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT c.tbl, c.col, c.origin
    FROM (VALUES
      ('parcels',         'air_shipment_id',   'cargo aérien, 21/09'),
      ('parcels',         'checked_in_at',     'entrepôt de Douala, 21/09'),
      ('parcels',         'checked_in_by',     'entrepôt de Douala, 21/09'),
      ('parcels',         'warehouse_location','entrepôt de Douala, 21/09'),
      ('parcels',         'condition',         'entrepôt de Douala, 21/09'),
      ('parcels',         'condition_note',    'entrepôt de Douala, 21/09'),
      ('parcels',         'delivered_at',      'entrepôt de Douala, 21/09'),
      ('parcels',         'release_id',        'entrepôt de Douala, 21/09'),
      ('parcel_deposits', 'location',          'réception, 20/09'),
      ('parcel_deposits', 'client_user_id',    'réception, 20/09'),
      ('parcel_quotes',   'amount_paid_xaf',   'encaissements cargo, 21/09'),
      ('air_shipments',   'delivered_at',      'entrepôt de Douala, 21/09')
    ) AS c(tbl, col, origin)
    WHERE to_regclass('public.' || c.tbl) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM pg_attribute a
                      WHERE a.attrelid = to_regclass('public.' || c.tbl) AND a.attname = c.col
                        AND a.attnum > 0 AND NOT a.attisdropped)
  LOOP
    v_missing := array_append(v_missing, 'colonne ' || r.tbl || '.' || r.col || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT f.fn, f.origin FROM (VALUES
      ('admin_has_permission',        'droits par rôle, 31/08'),
      ('reception_client_card',       'comptes cargo, 22/09'),
      ('parcel_status_for_air',       'cargo aérien, 21/09'),
      ('warehouse_checkin_parcel',    'entrepôt de Douala, 21/09'),
      ('warehouse_day',               'entrepôt de Douala, 21/09'),
      ('cargo_notify_client',         'notifications cargo, 21/09'),
      ('send_staff_push',             'notifications de l''équipe (BONZINI HQ), 26/09'),
      ('cargo_mark_shipment_arrived', 'remise / vols / arrivée, 05/10 — à coller AVANT ce fichier')
    ) AS f(fn, origin)
    WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = f.fn AND pronamespace = 'public'::regnamespace)
  LOOP
    v_missing := array_append(v_missing, 'fonction ' || r.fn || ' (' || r.origin || ')');
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Migration paquets avion : prérequis absents — %', array_to_string(v_missing, ', ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Copie conforme de 20261005170000_air_packages.sql
-- ############################################################################
-- ============================================================================
-- Cargo aérien · les PAQUETS de 32 kg, de Guangzhou à Douala
--
-- Au bureau de Guangzhou, les colis avion (dépôts « office ») sont regroupés
-- dans des paquets d'au plus 32 kg : un paquet réunit des colis de plusieurs
-- clients, et les colis d'un client peuvent partir dans plusieurs paquets.
-- Chaque paquet a son numéro (PQ-000001) et son étiquette. Les paquets — pas
-- les colis un par un — vont à l'aéroport : on les affecte à une expédition,
-- on les scanne au départ, l'aéroport peut en refuser un. À Douala, on
-- reçoit chaque paquet (tous sont-ils là ?), on l'ouvre et on pointe chacun
-- de ses colis (le pointage existant).
--
--   1. air_packages (+ séquence) ; parcels.air_package_id ; lecture RLS
--   2. invariant : un colis emballé suit son paquet (ni conteneur, ni
--      chargement ou retrait à l'unité) — déclencheur parcels_package_guard
--   3. pointer à Douala un colis d'un paquet ouvre le paquet
--   4. RPC des paquets : créer, trouver, lister, ajouter / retirer un colis,
--      fermer (pesée), rouvrir, supprimer un paquet vide, affecter / retirer
--      d'une expédition, scanner au départ, refus de l'aéroport, réception
--      et ouverture à Douala
--   5. le reste sait les paquets : verrou d'un colis, colis chargeables
--      (avion, conteneur), jalons de l'expédition (le départ exige les
--      paquets scannés ; une arrivée pointée ne s'annule plus), fiches
--      expédition / colis / arrivée à Douala ; la journée de Douala, les
--      messages aux clients et la notification de l'équipe n'affichent jamais
--      une LTA provisoire ; le dépôt dit le paquet de chaque colis ; les
--      anciens chargements à l'unité sautent les colis emballés
--   6. LTA provisoire : une expédition s'ouvre avant que la LTA soit connue
--      (PROV-…), la vraie LTA se pose ensuite, même après le départ
--
-- Ordre de verrouillage partout : expédition, puis paquet, puis colis — sauf
-- le jalon « arrivé → parti », qui verrouille les colis puis les paquets
-- (l'ordre du pointage de Douala, qui verrouille le colis puis son paquet).
-- Idempotent. Suppose 20261005150000 (remise / vols) passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le paquet
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.air_package_seq;

CREATE TABLE IF NOT EXISTS public.air_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq               BIGINT NOT NULL UNIQUE DEFAULT nextval('public.air_package_seq'),
  -- PQ-000123 : six chiffres commençant par 0 (jamais lu comme un code client
  -- BZ-xxxxxx), et pas la forme RC-dddddd-dd d'un colis.
  package_no        TEXT GENERATED ALWAYS AS ('PQ-' || CASE WHEN seq < 1000000 THEN lpad(seq::text, 6, '0') ELSE seq::text END) STORED UNIQUE,
  -- open : on le remplit · sealed : fermé, pesé (affecté ou non) · handed_over : scanné au départ ·
  -- refused : refusé à l'aéroport · received : arrivé à l'entrepôt de Douala · opened : ouvert, colis pointés
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','sealed','handed_over','refused','received','opened')),
  air_shipment_id   UUID REFERENCES public.air_shipments(id) ON DELETE RESTRICT,
  max_weight_kg     NUMERIC(6,2) NOT NULL DEFAULT 32 CHECK (max_weight_kg > 0 AND max_weight_kg <= 100),
  gross_weight_kg   NUMERIC(8,2) CHECK (gross_weight_kg IS NULL OR gross_weight_kg > 0),
  length_cm         NUMERIC(8,1) CHECK (length_cm IS NULL OR length_cm > 0),
  width_cm          NUMERIC(8,1) CHECK (width_cm IS NULL OR width_cm > 0),
  height_cm         NUMERIC(8,1) CHECK (height_cm IS NULL OR height_cm > 0),
  notes             TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  sealed_at         TIMESTAMPTZ,
  sealed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handed_over_at    TIMESTAMPTZ,
  handed_over_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refused_at        TIMESTAMPTZ,
  refused_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refusal_reason    TEXT CHECK (refusal_reason IS NULL OR length(refusal_reason) <= 300),
  refused_air_shipment_id UUID REFERENCES public.air_shipments(id) ON DELETE SET NULL,
  received_at       TIMESTAMPTZ,
  received_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at         TIMESTAMPTZ,
  opened_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_packages_air_idx ON public.air_packages (air_shipment_id) WHERE air_shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS air_packages_status_idx ON public.air_packages (status, created_at DESC);

ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS air_package_id UUID REFERENCES public.air_packages(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS parcels_air_package_idx ON public.parcels (air_package_id) WHERE air_package_id IS NOT NULL;

ALTER TABLE public.air_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS air_packages_staff_read ON public.air_packages;
CREATE POLICY air_packages_staff_read ON public.air_packages FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canReceiveParcels')
      OR public.admin_has_permission(auth.uid(), 'canViewCargo')
      OR public.admin_has_permission(auth.uid(), 'canReceiveAtDestination'));
-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Un colis emballé suit son paquet
-- ─────────────────────────────────────────────────────────────────────────
-- Son expédition est TOUJOURS celle du paquet : on charge, retire ou refuse le
-- paquet entier, jamais un de ses colis. Et un colis emballé ne part pas en
-- conteneur. Les RPC des paquets écrivent le paquet d'abord, ses colis ensuite.
CREATE OR REPLACE FUNCTION public.parcels_package_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_pkg public.air_packages;
BEGIN
  IF NEW.air_package_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_pkg FROM public.air_packages WHERE id = NEW.air_package_id;
  IF NEW.shipment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Le colis % est dans le paquet % : il part en avion, pas en conteneur', NEW.parcel_no, v_pkg.package_no USING ERRCODE = 'P0001';
  END IF;
  IF NEW.air_shipment_id IS DISTINCT FROM v_pkg.air_shipment_id THEN
    RAISE EXCEPTION 'Le colis % est dans le paquet % : c''est le paquet entier qui se charge ou se retire', NEW.parcel_no, v_pkg.package_no USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcels_package_guard ON public.parcels;
CREATE TRIGGER parcels_package_guard
  BEFORE INSERT OR UPDATE OF air_package_id, shipment_id, air_shipment_id ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.parcels_package_guard();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Pointer à Douala un colis d'un paquet : le paquet est reçu et ouvert
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.air_packages_follow_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.air_package_id IS NULL OR NEW.checked_in_at IS NULL OR OLD.checked_in_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.air_packages
     SET status = 'opened',
         received_at = COALESCE(received_at, now()), received_by = COALESCE(received_by, NEW.checked_in_by),
         opened_at = COALESCE(opened_at, now()), opened_by = COALESCE(opened_by, NEW.checked_in_by),
         updated_at = now()
   WHERE id = NEW.air_package_id AND status IN ('sealed','handed_over','received');
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS air_packages_follow_checkin ON public.parcels;
CREATE TRIGGER air_packages_follow_checkin
  AFTER UPDATE OF checked_in_at ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.air_packages_follow_checkin();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC des paquets
-- ─────────────────────────────────────────────────────────────────────────

-- 4.0 Lire un code scanné ou tapé.
--     « PQ-000123 », « pq123 », l'étiquette entière → PQ-000123.
CREATE OR REPLACE FUNCTION public.air_package_code(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE WHEN m IS NULL THEN NULL
              ELSE 'PQ-' || CASE WHEN m[1]::bigint < 1000000 THEN lpad((m[1]::bigint)::text, 6, '0') ELSE (m[1]::bigint)::text END END
    FROM (SELECT regexp_match(upper(COALESCE(p_text, '')), 'PQ[\s-]?(\d{1,9})') AS m) x
$fn$;

--     « RC-000123-01 », l'URL de l'étiquette (…?p=RC-000123-01) → RC-000123-01.
CREATE OR REPLACE FUNCTION public.parcel_code(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE WHEN m IS NULL THEN NULL ELSE 'RC-' || m[1] || '-' || m[2] END
    FROM (SELECT regexp_match(upper(COALESCE(p_text, '')), 'RC-?(\d{6})-?(\d{2,3})') AS m) x
$fn$;

-- 4.1 Un paquet au format JSON (helper) : la fiche, ses poids, son expédition
--     et ses colis (avec leur client et leur pointage à Douala).
CREATE OR REPLACE FUNCTION public.air_package_json(p_package_id UUID, p_with_parcels BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', k.id, 'package_no', k.package_no, 'status', k.status,
    'air_shipment_id', k.air_shipment_id, 'awb_number', a.awb_number, 'air_status', a.status, 'etd', a.etd, 'flight_no', a.flight_no,
    'max_weight_kg', k.max_weight_kg, 'gross_weight_kg', k.gross_weight_kg,
    'length_cm', k.length_cm, 'width_cm', k.width_cm, 'height_cm', k.height_cm, 'notes', k.notes,
    'net_weight_kg', (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.air_package_id = k.id),
    'parcel_count',  (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id),
    'client_count',  (SELECT count(DISTINCT d.client_user_id) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.air_package_id = k.id),
    'checked_count', (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id AND p.checked_in_at IS NOT NULL),
    'missing_count', (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id AND p.condition = 'missing'),
    'sealed_at', k.sealed_at, 'handed_over_at', k.handed_over_at,
    'refused_at', k.refused_at, 'refusal_reason', k.refusal_reason, 'refused_air_shipment_id', k.refused_air_shipment_id,
    'received_at', k.received_at, 'opened_at', k.opened_at, 'created_at', k.created_at, 'updated_at', k.updated_at,
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg, 'cbm', p.cbm,
        'description', p.description, 'status', p.status, 'photo_path', p.photo_path,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'delivered_at', p.delivered_at,
        'deposit_no', d.deposit_no, 'deposit_id', d.id,
        'client', public.reception_client_card(d.client_user_id)
      ) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE p.air_package_id = k.id), '[]'::jsonb) ELSE NULL END
  )
  FROM public.air_packages k LEFT JOIN public.air_shipments a ON a.id = k.air_shipment_id
  WHERE k.id = p_package_id;
$fn$;

CREATE OR REPLACE FUNCTION public._air_package_can_read()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.admin_has_permission(auth.uid(), 'canReceiveParcels')
      OR public.admin_has_permission(auth.uid(), 'canViewCargo')
      OR public.admin_has_permission(auth.uid(), 'canReceiveAtDestination')
$fn$;

-- L'équipe de Guangzhou (réception) et le cargo (ops) envoient les paquets à l'aéroport.
CREATE OR REPLACE FUNCTION public._air_package_can_ship()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.admin_has_permission(auth.uid(), 'canReceiveParcels')
      OR public.admin_has_permission(auth.uid(), 'canManageCargo')
$fn$;

-- 4.2 Lister les paquets. p_air_id : ceux d'une expédition. Sinon p_scope :
--     'bureau' (pas encore partis : en cours, fermés, refusés, affectés à une
--     expédition qui n'est pas partie), 'all' (les 300 derniers).
CREATE OR REPLACE FUNCTION public.air_package_list(p_scope TEXT DEFAULT 'bureau', p_air_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public._air_package_can_read() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'packages', COALESCE((
    SELECT jsonb_agg(public.air_package_json(x.id, false) ORDER BY x.ord, x.created_at DESC)
    FROM (
      SELECT k.id, k.created_at,
             CASE k.status WHEN 'open' THEN 0 WHEN 'refused' THEN 1 WHEN 'sealed' THEN 2 WHEN 'handed_over' THEN 3 ELSE 4 END AS ord
        FROM public.air_packages k LEFT JOIN public.air_shipments a ON a.id = k.air_shipment_id
       WHERE CASE
               WHEN p_air_id IS NOT NULL THEN k.air_shipment_id = p_air_id
               WHEN p_scope = 'all' THEN true
               ELSE k.status IN ('open','sealed','refused','handed_over') AND (a.id IS NULL OR a.status = 'PLANNED')
             END
       ORDER BY k.created_at DESC
       LIMIT 300
    ) x
  ), '[]'::jsonb));
END;
$fn$;

-- 4.3 Un paquet, par son identifiant ou par un code scanné (PQ-…).
CREATE OR REPLACE FUNCTION public.air_package_get(p_package_id UUID DEFAULT NULL, p_code TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_id UUID;
BEGIN
  IF NOT public._air_package_can_read() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_package_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.air_packages WHERE id = p_package_id;
  ELSE
    SELECT id INTO v_id FROM public.air_packages WHERE package_no = public.air_package_code(p_code);
  END IF;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_id, true));
END;
$fn$;

-- 4.4 Ouvrir un nouveau paquet (vide).
CREATE OR REPLACE FUNCTION public.air_package_create(p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_id UUID; v_no TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  INSERT INTO public.air_packages (notes, created_by) VALUES (NULLIF(btrim(COALESCE(p_notes, '')), ''), v_uid)
  RETURNING id, package_no INTO v_id, v_no;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_create', 'air_package', v_id, jsonb_build_object('description', 'Paquet ' || v_no || ' ouvert', 'package_no', v_no));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_id, true));
END;
$fn$;

-- 4.5 Mettre un colis dans un paquet (scan de son étiquette). Un colis avion
--     (dépôt du bureau), pesé, avec son client, qui n'est ni parti ni déjà
--     emballé ; le paquet reste sous son poids maximal (32 kg).
CREATE OR REPLACE FUNCTION public.air_package_add_parcel(p_package_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_k public.air_packages;
  v_p public.parcels;
  v_d public.parcel_deposits;
  v_no TEXT := public.parcel_code(p_code);
  v_net NUMERIC;
  v_other TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est fermé : rouvrez-le pour y ajouter un colis');
  END IF;
  IF v_no IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de colis (RC-000000-00)');
  END IF;
  SELECT * INTO v_p FROM public.parcels WHERE parcel_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Colis ' || v_no || ' introuvable'); END IF;
  IF v_p.air_package_id = v_k.id THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'parcel_no', v_no, 'package', public.air_package_json(v_k.id, true));
  END IF;
  IF v_p.air_package_id IS NOT NULL THEN
    SELECT package_no INTO v_other FROM public.air_packages WHERE id = v_p.air_package_id;
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' est déjà dans le paquet ' || v_other);
  END IF;
  SELECT * INTO v_d FROM public.parcel_deposits WHERE id = v_p.deposit_id;
  IF v_d.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le dépôt ' || v_d.deposit_no || ' est supprimé : ce colis ne part pas');
  END IF;
  IF v_d.location <> 'office' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' part en bateau (reçu à l''entrepôt) : il ne va pas dans un paquet avion');
  END IF;
  IF v_d.client_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' n''a pas encore de client : attribuez son dépôt d''abord');
  END IF;
  IF v_p.weight_kg IS NULL OR v_p.weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' n''est pas pesé : pesez-le d''abord');
  END IF;
  IF v_p.shipment_id IS NOT NULL OR v_p.air_shipment_id IS NOT NULL OR v_p.status NOT IN ('received','stored')
     OR v_p.checked_in_at IS NOT NULL OR v_p.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' est déjà chargé ou parti');
  END IF;
  SELECT COALESCE(sum(weight_kg), 0) INTO v_net FROM public.parcels WHERE air_package_id = v_k.id;
  IF v_net + v_p.weight_kg > v_k.max_weight_kg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paquet passerait à ' || trim(to_char(v_net + v_p.weight_kg, 'FM999990.0')) || ' kg : ' || trim(to_char(v_k.max_weight_kg, 'FM990')) || ' kg au plus. Commencez un autre paquet.',
      'over', true);
  END IF;

  UPDATE public.parcels SET air_package_id = v_k.id, updated_at = now() WHERE id = v_p.id;
  UPDATE public.air_packages SET updated_at = now() WHERE id = v_k.id;
  RETURN jsonb_build_object('success', true, 'already', false, 'parcel_no', v_no, 'weight_kg', v_p.weight_kg,
                            'client', public.reception_client_card(v_d.client_user_id),
                            'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.6 Retirer un colis d'un paquet encore ouvert.
CREATE OR REPLACE FUNCTION public.air_package_remove_parcel(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_pkg UUID; v_k public.air_packages; v_p public.parcels;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT air_package_id INTO v_pkg FROM public.parcels WHERE id = p_parcel_id;
  IF v_pkg IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis n''est dans aucun paquet'); END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = v_pkg FOR UPDATE;
  SELECT * INTO v_p FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF v_p.air_package_id IS DISTINCT FROM v_k.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis vient de changer de paquet : rechargez la page');
  END IF;
  IF v_k.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est fermé : rouvrez-le d''abord');
  END IF;
  UPDATE public.parcels SET air_package_id = NULL, updated_at = now() WHERE id = v_p.id;
  UPDATE public.air_packages SET updated_at = now() WHERE id = v_k.id;
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.7 Fermer le paquet : pesé (brut), mesuré. Le poids brut tient sous le maximum.
CREATE OR REPLACE FUNCTION public.air_package_seal(
  p_package_id UUID,
  p_gross_weight_kg NUMERIC,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages; v_net NUMERIC; v_n INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet est déjà fermé'); END IF;
  SELECT count(*), COALESCE(sum(weight_kg), 0) INTO v_n, v_net FROM public.parcels WHERE air_package_id = v_k.id;
  IF v_n = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le paquet est vide'); END IF;
  IF p_gross_weight_kg IS NULL OR p_gross_weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le poids pesé du paquet');
  END IF;
  IF p_gross_weight_kg > v_k.max_weight_kg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paquet pèse ' || trim(to_char(p_gross_weight_kg, 'FM999990.0')) || ' kg : ' || trim(to_char(v_k.max_weight_kg, 'FM990')) || ' kg au plus. Retirez un colis.');
  END IF;
  IF p_gross_weight_kg < v_net - 0.5 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le poids pesé (' || trim(to_char(p_gross_weight_kg, 'FM999990.0')) || ' kg) est inférieur à celui des colis (' || trim(to_char(v_net, 'FM999990.0')) || ' kg) : vérifiez la pesée');
  END IF;
  IF (p_length_cm IS NOT NULL AND (p_length_cm <= 0 OR p_length_cm > 400))
     OR (p_width_cm IS NOT NULL AND (p_width_cm <= 0 OR p_width_cm > 400))
     OR (p_height_cm IS NOT NULL AND (p_height_cm <= 0 OR p_height_cm > 400)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dimensions invalides');
  END IF;
  UPDATE public.air_packages
     SET status = 'sealed', gross_weight_kg = p_gross_weight_kg,
         length_cm = p_length_cm, width_cm = p_width_cm, height_cm = p_height_cm,
         sealed_at = now(), sealed_by = v_uid, updated_at = now()
   WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_seal', 'air_package', v_k.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' fermé : ' || v_n || ' colis, ' || p_gross_weight_kg || ' kg', 'package_no', v_k.package_no, 'parcels', v_n, 'gross_weight_kg', p_gross_weight_kg, 'net_weight_kg', v_net));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.8 Rouvrir un paquet fermé (ou refusé) qui n'est dans aucune expédition.
CREATE OR REPLACE FUNCTION public.air_package_reopen(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status = 'open' THEN RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true)); END IF;
  IF v_k.status NOT IN ('sealed','refused') OR v_k.air_shipment_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est affecté à une expédition : retirez-le d''abord');
  END IF;
  UPDATE public.air_packages
     SET status = 'open', gross_weight_kg = NULL, sealed_at = NULL, sealed_by = NULL, updated_at = now()
   WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_reopen', 'air_package', v_k.id, jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' rouvert', 'package_no', v_k.package_no, 'from', v_k.status));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.9 Supprimer un paquet ouvert et vide (ouvert par erreur).
CREATE OR REPLACE FUNCTION public.air_package_delete(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' OR EXISTS (SELECT 1 FROM public.parcels WHERE air_package_id = v_k.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un paquet ouvert et vide se supprime');
  END IF;
  DELETE FROM public.air_packages WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_delete', 'air_package', v_k.id, jsonb_build_object('description', 'Paquet vide ' || v_k.package_no || ' supprimé', 'package_no', v_k.package_no));
  RETURN jsonb_build_object('success', true);
END;
$fn$;

-- 4.10 Affecter des paquets fermés (ou refusés) à une expédition pas encore partie.
--      Leurs colis passent dans l'expédition (« chargés »).
CREATE OR REPLACE FUNCTION public.air_package_assign(p_air_id UUID, p_package_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_a public.air_shipments;
  v_k public.air_packages;
  v_ok UUID[] := ARRAY[]::UUID[];
  v_skipped TEXT[] := ARRAY[]::TEXT[];
  v_parcels INTEGER;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_package_ids IS NULL OR array_length(p_package_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun paquet choisi');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status <> 'PLANNED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette expédition est partie : on n''y ajoute plus de paquet');
  END IF;
  FOR v_k IN SELECT * FROM public.air_packages WHERE id = ANY(p_package_ids) ORDER BY id FOR UPDATE LOOP
    IF v_k.status IN ('sealed','refused') AND v_k.air_shipment_id IS NULL THEN
      v_ok := array_append(v_ok, v_k.id);
    ELSE
      v_skipped := array_append(v_skipped, v_k.package_no || CASE
        WHEN v_k.status = 'open' THEN ' (pas encore fermé)'
        WHEN v_k.air_shipment_id IS NOT NULL THEN ' (déjà affecté)'
        ELSE ' (' || v_k.status || ')' END);
    END IF;
  END LOOP;
  IF array_length(v_ok, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun paquet à affecter : ' || COALESCE(array_to_string(v_skipped, ', '), 'introuvables'));
  END IF;

  UPDATE public.air_packages
     SET air_shipment_id = p_air_id, status = 'sealed', handed_over_at = NULL, handed_over_by = NULL, updated_at = now()
   WHERE id = ANY(v_ok);
  WITH moved AS (
    UPDATE public.parcels
       SET air_shipment_id = p_air_id, status = public.parcel_status_for_air(v_a.status), updated_at = now()
     WHERE air_package_id = ANY(v_ok)
     RETURNING id
  ) SELECT count(*) INTO v_parcels FROM moved;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_assign', 'air_shipment', p_air_id,
          jsonb_build_object('description', array_length(v_ok, 1) || ' paquet(s) affecté(s) à la LTA ' || v_a.awb_number || ' (' || v_parcels || ' colis)',
                             'package_ids', to_jsonb(v_ok), 'parcels', v_parcels, 'skipped', to_jsonb(v_skipped)));
  RETURN jsonb_build_object('success', true, 'assigned', array_length(v_ok, 1), 'parcels', v_parcels, 'skipped', to_jsonb(v_skipped));
END;
$fn$;

-- 4.11 Retirer un paquet d'une expédition pas encore partie : il redevient
--      « fermé », ses colis reviennent au bureau.
CREATE OR REPLACE FUNCTION public.air_package_unassign(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_air UUID; v_a public.air_shipments; v_k public.air_packages;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT air_shipment_id INTO v_air FROM public.air_packages WHERE id = p_package_id;
  IF v_air IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet n''est affecté à aucune expédition'); END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_air FOR UPDATE;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF v_k.air_shipment_id IS DISTINCT FROM v_a.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paquet vient de changer d''expédition : rechargez la page');
  END IF;
  IF v_a.status <> 'PLANNED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''expédition est partie : si l''aéroport a refusé ce paquet, déclarez le refus');
  END IF;
  UPDATE public.air_packages
     SET air_shipment_id = NULL, status = 'sealed', handed_over_at = NULL, handed_over_by = NULL, updated_at = now()
   WHERE id = v_k.id;
  UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now() WHERE air_package_id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_unassign', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' retiré de la LTA ' || v_a.awb_number, 'package_id', v_k.id, 'package_no', v_k.package_no));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.12 Scanner un paquet au départ (remise au transitaire / à l'aéroport).
CREATE OR REPLACE FUNCTION public.air_package_scan_departure(p_air_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_a public.air_shipments;
  v_k public.air_packages;
  v_no TEXT := public.air_package_code(p_code);
  v_already BOOLEAN := false;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status <> 'PLANNED' THEN RETURN jsonb_build_object('success', false, 'error', 'Cette expédition est déjà partie'); END IF;
  IF v_no IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de paquet (PQ-000000)'); END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE package_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet ' || v_no || ' introuvable'); END IF;
  IF v_k.air_shipment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_no || ' n''est affecté à aucune expédition : affectez-le d''abord', 'package_no', v_no);
  END IF;
  IF v_k.air_shipment_id <> p_air_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_no || ' est affecté à une autre expédition', 'package_no', v_no);
  END IF;
  IF v_k.status = 'handed_over' THEN
    v_already := true;
  ELSE
    UPDATE public.air_packages SET status = 'handed_over', handed_over_at = now(), handed_over_by = v_uid, updated_at = now() WHERE id = v_k.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'already', v_already, 'package_no', v_no,
    'scanned', (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = p_air_id AND status = 'handed_over'),
    'total',   (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = p_air_id));
END;
$fn$;

-- 4.13 L'aéroport refuse un paquet (avant ou après le départ de l'avion) :
--      il sort de l'expédition avec ses colis, qui reviennent au bureau ; il
--      garde ses colis et pourra partir par une autre expédition.
CREATE OR REPLACE FUNCTION public.air_package_refuse(p_package_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_air UUID; v_a public.air_shipments; v_k public.air_packages; v_n INTEGER;
BEGIN
  IF NOT public._air_package_can_ship() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif du refus');
  END IF;
  SELECT air_shipment_id INTO v_air FROM public.air_packages WHERE id = p_package_id;
  IF v_air IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet n''est affecté à aucune expédition'); END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_air FOR UPDATE;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF v_k.air_shipment_id IS DISTINCT FROM v_a.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paquet vient de changer d''expédition : rechargez la page');
  END IF;
  IF v_a.status NOT IN ('PLANNED','DEPARTED') OR v_k.status IN ('received','opened') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paquet est déjà arrivé à Douala');
  END IF;
  IF EXISTS (SELECT 1 FROM public.parcels WHERE air_package_id = v_k.id AND (checked_in_at IS NOT NULL OR delivered_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce paquet sont déjà pointés à Douala');
  END IF;

  UPDATE public.air_packages
     SET status = 'refused', refused_at = now(), refused_by = v_uid, refusal_reason = left(v_reason, 300),
         refused_air_shipment_id = v_a.id, air_shipment_id = NULL, handed_over_at = NULL, handed_over_by = NULL, updated_at = now()
   WHERE id = v_k.id;
  WITH back AS (
    UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now()
     WHERE air_package_id = v_k.id RETURNING id
  ) SELECT count(*) INTO v_n FROM back;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_refused', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' refusé à l''aéroport (LTA ' || v_a.awb_number || ') : ' || v_reason,
                             'package_id', v_k.id, 'package_no', v_k.package_no, 'reason', v_reason, 'parcels', v_n, 'air_status', v_a.status));
  -- Après le départ, les clients ont déjà reçu « vos colis sont partis » : l'écran le rappelle.
  RETURN jsonb_build_object('success', true, 'parcels', v_n, 'clients_told_departed', v_a.status = 'DEPARTED',
                            'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.14 Douala : un paquet arrive à l'entrepôt (scan de son étiquette).
CREATE OR REPLACE FUNCTION public.air_package_receive(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_no TEXT := public.air_package_code(p_code);
  v_k public.air_packages;
  v_air_status TEXT;
  v_already BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_no IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de paquet (PQ-000000)'); END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE package_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet ' || v_no || ' introuvable'); END IF;
  SELECT status INTO v_air_status FROM public.air_shipments WHERE id = v_k.air_shipment_id;
  IF v_air_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_no || ' n''est dans aucune expédition', 'package_no', v_no);
  END IF;
  IF v_air_status NOT IN ('ARRIVED','DELIVERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Son expédition n''est pas encore marquée arrivée : demandez à l''admin de poser le jalon', 'package_no', v_no);
  END IF;
  IF v_k.status IN ('received','opened') THEN
    v_already := true;
  ELSE
    UPDATE public.air_packages SET status = 'received', received_at = now(), received_by = v_uid, updated_at = now() WHERE id = v_k.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'already', v_already, 'package_no', v_no,
    'received', (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = v_k.air_shipment_id AND status IN ('received','opened')),
    'total',    (SELECT count(*) FROM public.air_packages WHERE air_shipment_id = v_k.air_shipment_id),
    'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- 4.15 Douala : ouvrir un paquet reçu (ses colis se pointent ensuite un par un).
CREATE OR REPLACE FUNCTION public.air_package_open(p_package_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages; v_air_status TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  SELECT status INTO v_air_status FROM public.air_shipments WHERE id = v_k.air_shipment_id;
  IF v_air_status IS NULL OR v_air_status NOT IN ('ARRIVED','DELIVERED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Son expédition n''est pas encore marquée arrivée');
  END IF;
  IF v_k.status <> 'opened' THEN
    UPDATE public.air_packages
       SET status = 'opened', received_at = COALESCE(received_at, now()), received_by = COALESCE(received_by, v_uid),
           opened_at = now(), opened_by = v_uid, updated_at = now()
     WHERE id = v_k.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Le reste de la plateforme sait les paquets
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Un colis emballé ne se modifie plus d'ici (ni son dépôt) : on le retire du paquet d'abord.
CREATE OR REPLACE FUNCTION public.reception_parcel_locked(p public.parcels)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p.delivered_at IS NOT NULL OR p.release_id IS NOT NULL THEN 'Ce colis a été remis au client'
    WHEN p.checked_in_at IS NOT NULL THEN 'Ce colis est déjà arrivé à Douala'
    WHEN p.shipment_id IS NOT NULL THEN 'Ce colis est chargé dans un conteneur : retirez-le d''abord de la boîte'
    WHEN p.air_shipment_id IS NOT NULL THEN 'Ce colis est chargé dans une expédition aérienne : retirez-le d''abord de la LTA'
    WHEN p.air_package_id IS NOT NULL THEN 'Ce colis est dans le paquet '
      || COALESCE((SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id), '')
      || ' : retirez-le d''abord du paquet'
    ELSE NULL
  END;
$fn$;

-- 5.2 Les colis chargeables à l'unité ne comptent plus les colis emballés.
CREATE OR REPLACE FUNCTION public.cargo_air_loadable_parcels(p_air_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'client_user_id', NULL, 'parcels', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
      'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
      'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
      'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'created_at', p.created_at,
      'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
      'client', public.reception_client_card(d.client_user_id),
      'quote_status', q.status, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf
    ) ORDER BY (d.location = 'office') DESC, d.opened_at, p.seq)
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
    WHERE p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.air_package_id IS NULL
      AND p.status IN ('received','stored') AND d.status <> 'cancelled'
  ), '[]'::jsonb));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reception_loadable_parcels(p_shipment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_client_user UUID;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT c.user_id INTO v_client_user
  FROM public.cargo_shipments cs LEFT JOIN public.clients c ON c.id = cs.client_id
  WHERE cs.id = p_shipment_id;
  RETURN jsonb_build_object('success', true, 'client_user_id', v_client_user, 'parcels', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
      'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
      'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
      'status', p.status, 'shipment_id', p.shipment_id, 'created_at', p.created_at,
      'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
      'client', public.reception_client_card(d.client_user_id)
    ) ORDER BY d.opened_at, p.seq)
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE p.shipment_id IS NULL AND p.air_package_id IS NULL AND p.status IN ('received','stored') AND d.status <> 'cancelled'
      AND (v_client_user IS NULL OR d.client_user_id = v_client_user)
  ), '[]'::jsonb));
END;
$fn$;

-- 5.3 Les jalons d'une expédition : le départ exige ses paquets scannés ; une
--     arrivée dont des colis sont pointés à Douala ne s'annule plus.
CREATE OR REPLACE FUNCTION public.cargo_air_set_status(p_air_id UUID, p_status TEXT, p_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_at TIMESTAMPTZ := COALESCE(p_at, now()); v_left INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_status NOT IN ('PLANNED','DEPARTED','ARRIVED') THEN RETURN jsonb_build_object('success', false, 'error', 'Jalon inconnu'); END IF;
  IF v_at > now() + interval '1 day' THEN RETURN jsonb_build_object('success', false, 'error', 'La date est dans le futur'); END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status = 'DELIVERED' THEN RETURN jsonb_build_object('success', false, 'error', 'Cette expédition est livrée : elle ne bouge plus'); END IF;
  IF v_a.status = p_status THEN RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true)); END IF;
  IF p_status = 'DEPARTED' AND NOT EXISTS (SELECT 1 FROM public.parcels WHERE air_shipment_id = v_a.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun colis chargé : rien ne part');
  END IF;
  IF p_status = 'DEPARTED' AND v_a.status = 'PLANNED' THEN
    SELECT count(*) INTO v_left FROM public.air_packages WHERE air_shipment_id = v_a.id AND status <> 'handed_over';
    IF v_left > 0 THEN
      RETURN jsonb_build_object('success', false, 'error',
        v_left || ' paquet(s) pas encore scanné(s) au départ : scannez-les, ou retirez-les de l''expédition');
    END IF;
  END IF;
  -- Un cran à la fois, dans les deux sens.
  IF (v_a.status = 'PLANNED' AND p_status = 'ARRIVED') OR (v_a.status = 'ARRIVED' AND p_status = 'PLANNED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un jalon à la fois : ' || CASE WHEN p_status = 'ARRIVED' THEN 'marquez d''abord le départ' ELSE 'revenez d''abord à « parti »' END);
  END IF;
  -- Une arrivée déjà travaillée à Douala ne se défait pas : les colis pointés redeviendraient « en vol ».
  -- Verrouiller d'abord ce qu'on vérifie (colis, puis paquets : l'ordre du pointage, qui verrouille le
  -- colis puis son paquet) : un pointage ou une réception concurrents attendent ce jalon, ou le font refuser.
  IF v_a.status = 'ARRIVED' THEN
    PERFORM 1 FROM public.parcels WHERE air_shipment_id = v_a.id ORDER BY id FOR UPDATE;
    PERFORM 1 FROM public.air_packages WHERE air_shipment_id = v_a.id ORDER BY id FOR UPDATE;
  END IF;
  IF v_a.status = 'ARRIVED' AND (
       EXISTS (SELECT 1 FROM public.parcels WHERE air_shipment_id = v_a.id AND (checked_in_at IS NOT NULL OR delivered_at IS NOT NULL OR condition = 'missing'))
    OR EXISTS (SELECT 1 FROM public.air_packages WHERE air_shipment_id = v_a.id AND status IN ('received','opened'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis ou des paquets sont déjà reçus à Douala : l''arrivée ne s''annule plus');
  END IF;
  UPDATE public.air_shipments SET
    status      = p_status,
    departed_at = CASE p_status WHEN 'DEPARTED' THEN COALESCE(CASE WHEN v_a.status = 'ARRIVED' THEN departed_at END, v_at) WHEN 'PLANNED' THEN NULL ELSE departed_at END,
    arrived_at  = CASE p_status WHEN 'ARRIVED' THEN v_at ELSE NULL END,
    updated_at  = now()
  WHERE id = v_a.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_shipment_status', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'LTA ' || v_a.awb_number || ' : ' || v_a.status || ' → ' || p_status, 'awb_number', v_a.awb_number, 'from', v_a.status, 'to', p_status, 'at', v_at));
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true));
END;
$fn$;

-- 5.4 L'expédition : ses paquets, et pour chaque colis son paquet.
CREATE OR REPLACE FUNCTION public.cargo_air_json(p_air_id UUID, p_with_parcels BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', a.id, 'awb_number', a.awb_number, 'awb_provisional', a.awb_number LIKE 'PROV-%',
    'airline', a.airline, 'flight_no', a.flight_no,
    'origin', a.origin, 'destination', a.destination, 'status', a.status,
    'etd', a.etd, 'eta', a.eta, 'departed_at', a.departed_at, 'arrived_at', a.arrived_at, 'delivered_at', a.delivered_at,
    'freight_usd', a.freight_usd, 'notes', a.notes, 'created_at', a.created_at, 'updated_at', a.updated_at,
    'parcel_count',    (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id),
    'total_weight_kg', (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.air_shipment_id = a.id),
    'total_cbm',       (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.air_shipment_id = a.id),
    'client_count',    (SELECT count(DISTINCT d.client_user_id) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.air_shipment_id = a.id),
    'unpaid_count',    (SELECT count(*) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
                        WHERE p.air_shipment_id = a.id AND (q.id IS NULL OR q.amount_paid_xaf < q.total_xaf OR q.total_xaf <= 0)),
    'checked_count',   (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.checked_in_at IS NOT NULL),
    'missing_count',   (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.condition = 'missing'),
    'delivered_count', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.delivered_at IS NOT NULL),
    'package_count',   (SELECT count(*) FROM public.air_packages k WHERE k.air_shipment_id = a.id),
    'packages_handed_over', (SELECT count(*) FROM public.air_packages k WHERE k.air_shipment_id = a.id AND k.status = 'handed_over'),
    'packages_received',    (SELECT count(*) FROM public.air_packages k WHERE k.air_shipment_id = a.id AND k.status IN ('received','opened')),
    'packages', COALESCE((SELECT jsonb_agg(public.air_package_json(k.id, false) ORDER BY k.seq)
                            FROM public.air_packages k WHERE k.air_shipment_id = a.id), '[]'::jsonb),
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
        'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
        'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
        'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'awb_number', a.awb_number, 'created_at', p.created_at,
        'air_package_id', p.air_package_id, 'package_no', k.package_no,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
        'client', public.reception_client_card(d.client_user_id),
        'quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no
      ) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
      LEFT JOIN public.air_packages k ON k.id = p.air_package_id
      WHERE p.air_shipment_id = a.id), '[]'::jsonb) ELSE NULL END
  )
  FROM public.air_shipments a WHERE a.id = p_air_id;
$fn$;

-- 5.5 Un colis vu de Douala dit son paquet.
CREATE OR REPLACE FUNCTION public.warehouse_parcel_json(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
    'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
    'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
    'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'created_at', p.created_at,
    'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
    'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
    'air_package_id', p.air_package_id,
    'package_no', (SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id),
    'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
    'delivered_at', p.delivered_at, 'release_id', p.release_id,
    'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
    'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
    'client', public.reception_client_card(d.client_user_id),
    'quote_id', q.id, 'quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no
  )
  FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
  WHERE p.id = p_parcel_id;
$fn$;

-- 5.6 L'arrivée d'un avion à Douala : ses paquets (reçus ou pas) avec ses colis.
CREATE OR REPLACE FUNCTION public.warehouse_arrival_parcels(p_kind TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_label TEXT; v_sub TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_kind = 'air' THEN
    SELECT CASE WHEN a.awb_number LIKE 'PROV-%' THEN 'Expédition' || COALESCE(' du ' || to_char(a.etd, 'DD/MM'), '') ELSE 'LTA ' || a.awb_number END,
           COALESCE(a.flight_no || ' · ', '') || COALESCE(a.airline, '')
      INTO v_label, v_sub FROM public.air_shipments a WHERE a.id = p_id;
  ELSIF p_kind = 'sea' THEN
    SELECT cs.container_number, cs.client_label INTO v_label, v_sub FROM public.cargo_shipments cs WHERE cs.id = p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type inconnu');
  END IF;
  IF v_label IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Arrivée introuvable'); END IF;
  RETURN jsonb_build_object('success', true, 'kind', p_kind, 'id', p_id, 'label', v_label, 'sub', v_sub,
    'packages', CASE WHEN p_kind = 'air' THEN COALESCE((
      SELECT jsonb_agg(public.air_package_json(k.id, false) ORDER BY k.seq)
      FROM public.air_packages k WHERE k.air_shipment_id = p_id), '[]'::jsonb) ELSE '[]'::jsonb END,
    'parcels', COALESCE((
      SELECT jsonb_agg(public.warehouse_parcel_json(p.id) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE (p_kind = 'air' AND p.air_shipment_id = p_id) OR (p_kind = 'sea' AND p.shipment_id = p_id)
    ), '[]'::jsonb));
END;
$fn$;

-- 5.7 La journée de Douala : une expédition à LTA provisoire se lit « Expédition du JJ/MM », jamais « LTA PROV-… ».
CREATE OR REPLACE FUNCTION public.warehouse_day()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_today DATE := (now() AT TIME ZONE 'Africa/Douala')::date;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canReceiveAtDestination') OR public.admin_has_permission(v_uid, 'canReleaseParcels')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'day', v_today,
    'stats', jsonb_build_object(
      'to_checkin', (SELECT count(*) FROM public.parcels p WHERE p.status IN ('shipped','arrived') AND p.checked_in_at IS NULL AND p.delivered_at IS NULL AND COALESCE(p.condition, '') <> 'missing'
                       AND (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = p.air_shipment_id AND a.status = 'ARRIVED')
                         OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id AND cs.status IN ('ARRIVED','DELIVERED')))),
      'waiting', (SELECT count(*) FROM public.parcels p WHERE p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL),
      'missing', (SELECT count(*) FROM public.parcels p WHERE p.condition = 'missing' AND p.delivered_at IS NULL),
      'delivered_today', (SELECT count(*) FROM public.parcels p WHERE p.delivered_at IS NOT NULL AND (p.delivered_at AT TIME ZONE 'Africa/Douala')::date = v_today)
    ),
    -- Les arrivées : un avion arrivé ou une boîte arrivée dont il reste des colis à pointer.
    'arrivals', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'arrived_at') DESC) FROM (
        SELECT jsonb_build_object('kind', 'air', 'id', a.id, 'ref', a.awb_number, 'label', CASE WHEN a.awb_number LIKE 'PROV-%' THEN 'Expédition' || COALESCE(' du ' || to_char(a.etd, 'DD/MM'), '') ELSE 'LTA ' || a.awb_number END, 'sub', COALESCE(a.flight_no || ' · ', '') || COALESCE(a.airline, ''),
          'arrived_at', a.arrived_at,
          'expected', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.delivered_at IS NULL),
          'checked', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL),
          'missing', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.condition = 'missing'),
          'delivered', (SELECT count(*) FROM public.parcels p WHERE p.air_shipment_id = a.id AND p.delivered_at IS NOT NULL)) AS row
        FROM public.air_shipments a WHERE a.status = 'ARRIVED'
        UNION ALL
        SELECT jsonb_build_object('kind', 'sea', 'id', cs.id, 'ref', cs.container_number, 'label', cs.container_number, 'sub', cs.client_label || COALESCE(' · ' || cs.vessel_name, ''),
          'arrived_at', COALESCE(cs.eta_carrier, cs.last_event_at, cs.updated_at),
          'expected', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.delivered_at IS NULL),
          'checked', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL),
          'missing', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.condition = 'missing'),
          'delivered', (SELECT count(*) FROM public.parcels p WHERE p.shipment_id = cs.id AND p.delivered_at IS NOT NULL)) AS row
        FROM public.cargo_shipments cs WHERE cs.status IN ('ARRIVED','DELIVERED') AND EXISTS (SELECT 1 FROM public.parcels p WHERE p.shipment_id = cs.id AND p.delivered_at IS NULL)
      ) r), '[]'::jsonb),
    -- Ce qui attend son client, par client : pointé, pas remis.
    'waiting_by_client', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'since')) FROM (
        SELECT jsonb_build_object(
          'client', public.reception_client_card(d.client_user_id),
          'parcels', count(*), 'weight_kg', COALESCE(sum(p.weight_kg), 0), 'since', min(p.checked_in_at),
          'unpaid', bool_or(q.id IS NULL OR q.total_xaf <= 0 OR q.amount_paid_xaf < q.total_xaf),
          'balance_xaf', COALESCE(sum(GREATEST(q.total_xaf - q.amount_paid_xaf, 0)) FILTER (WHERE q.id IS NOT NULL), 0)
        ) AS row
        FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
        WHERE p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL
        GROUP BY d.client_user_id
      ) g), '[]'::jsonb),
    'releases_today', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'release_no', r.release_no, 'released_at', r.released_at, 'picked_by_name', r.picked_by_name, 'parcel_count', r.parcel_count,
                                          'client', public.reception_client_card(r.client_user_id)) ORDER BY r.released_at DESC)
      FROM public.parcel_releases r WHERE (r.released_at AT TIME ZONE 'Africa/Douala')::date = v_today), '[]'::jsonb)
  );
END;
$fn$;

-- 5.8 Les messages aux clients au départ et à l'arrivée : la référence est la LTA, ou à défaut
--     le vol, ou les dépôts — jamais une LTA provisoire.
CREATE OR REPLACE FUNCTION public.air_shipments_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r RECORD; v_flight TEXT; v_awb TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('DEPARTED','ARRIVED') THEN RETURN NEW; END IF;
  v_flight := COALESCE(NEW.flight_no, 'Air cargo');
  -- Une LTA provisoire (PROV-…) n'est pas un numéro que le client peut suivre : on ne l'envoie pas.
  v_awb := CASE WHEN NEW.awb_number LIKE 'PROV-%' THEN NULL ELSE NEW.awb_number END;
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
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'air_shipment_id', NEW.id, 'awb_number', v_awb, 'flight_no', NEW.flight_no, 'eta', NEW.eta, 'reference', COALESCE(v_awb, NULLIF(NEW.flight_no, ''), r.deposits)));
    ELSE
      PERFORM public.cargo_notify_client(r.user_id, 'parcel_arrived',
        'Vos colis sont arrivés à Douala',
        'Vos ' || r.n || ' colis (' || r.deposits || ') sont arrivés à Douala. Nous vous prévenons dès qu''ils sont prêts au retrait.',
        jsonb_build_object('deposit_id', r.deposit_id, 'deposit_no', r.deposits, 'parcel_count', r.n, 'air_shipment_id', NEW.id, 'awb_number', v_awb, 'reference', COALESCE(v_awb, NULLIF(NEW.flight_no, ''), r.deposits)));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

-- 5.9 La notification « arrivée à Douala » de l'équipe : le vol, ou la LTA si elle est connue.
create or replace function public.staff_push_on_air_arrival()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if new.status = 'ARRIVED' and old.status is distinct from new.status then
    select count(*) into v_count from public.parcels where air_shipment_id = new.id;
    if v_count > 0 then
      perform public.send_staff_push('canReceiveAtDestination', 'Arrivée à Douala · avion',
        coalesce(nullif(new.flight_no, ''), case when new.awb_number like 'PROV-%' then null else new.awb_number end, 'Vol') || ' · ' || v_count || ' colis à pointer',
        '/w/arrivees', null, auth.uid());
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_air_arrival: %', sqlerrm;
  return new;
end;
$$;

-- 5.10 Le dépôt, tel que les écrans le lisent : chaque colis dit aussi son paquet.
CREATE OR REPLACE FUNCTION public.reception_deposit_json(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id',                   d.id,
    'deposit_no',           d.deposit_no,
    'client',               public.reception_client_card(d.client_user_id),
    'location',             d.location,
    'brought_by',           d.brought_by,
    'representative_name',  d.representative_name,
    'representative_phone', d.representative_phone,
    'supplier_kind',        d.supplier_kind,
    'supplier_name',        d.supplier_name,
    'supplier_contact',     d.supplier_contact,
    'supplier_phone',       d.supplier_phone,
    'supplier_email',       d.supplier_email,
    'supplier_wechat',      d.supplier_wechat,
    'supplier_address',     d.supplier_address,
    'status',               d.status,
    'received_by',          d.received_by,
    'received_by_name',     (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    'opened_at',            d.opened_at,
    'closed_at',            d.closed_at,
    'updated_at',           d.updated_at,
    'cancelled_at',         d.cancelled_at,
    'cancel_reason',        d.cancel_reason,
    'cancelled_by_name',    (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.cancelled_by),
    'parcel_count',         (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_weight_kg',      (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_cbm',            (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'notes',                d.notes,
    'parcels',              COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind,
        'weight_kg', p.weight_kg, 'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'cbm', p.cbm, 'description', p.description, 'courier_waybill', p.courier_waybill,
        'photo_path', p.photo_path,
        'photos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'position', ph.position, 'created_at', ph.created_at)
                           ORDER BY ph.position, ph.created_at)
          FROM public.parcel_photos ph WHERE ph.parcel_id = p.id), '[]'::jsonb),
        'status', p.status, 'shipment_id', p.shipment_id,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'air_shipment_id', p.air_shipment_id,
        'air_package_id', p.air_package_id,
        'package_no', (SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id),
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
        'created_at', p.created_at, 'updated_at', p.updated_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;

-- 5.11 Charger une boîte : un colis emballé dans un paquet avion est sauté, pas une erreur pour tout le lot.
CREATE OR REPLACE FUNCTION public.cargo_load_parcels(p_shipment_id UUID, p_parcel_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_ship public.cargo_shipments;
  v_status TEXT;
  v_n INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_ship FROM public.cargo_shipments WHERE id = p_shipment_id FOR UPDATE;
  IF v_ship.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Boîte introuvable');
  END IF;
  IF v_ship.status = 'DELIVERED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette boîte est déjà livrée : on ne charge plus rien dedans');
  END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi');
  END IF;
  v_status := public.parcel_status_for_shipment(v_ship.status);
  -- Seuls les colis qui attendent : un colis déjà dans une boîte ne bouge pas d'ici.
  WITH moved AS (
    UPDATE public.parcels p
       SET shipment_id = p_shipment_id, status = v_status, updated_at = now()
     WHERE p.id = ANY(p_parcel_ids) AND p.shipment_id IS NULL AND p.air_package_id IS NULL AND p.status IN ('received','stored')
     RETURNING p.weight_kg, p.cbm
  )
  SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_n, v_kg, v_cbm FROM moved;
  IF v_n = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ces colis sont déjà chargés ou introuvables');
  END IF;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'load_parcels', 'cargo_shipment', p_shipment_id,
          jsonb_build_object('description', v_n || ' colis chargés dans ' || v_ship.container_number || ' (' || v_kg || ' kg, ' || v_cbm || ' m³)', 'parcel_ids', to_jsonb(p_parcel_ids), 'count', v_n, 'weight_kg', v_kg, 'cbm', v_cbm));
  RETURN jsonb_build_object('success', true, 'loaded', v_n, 'weight_kg', v_kg, 'cbm', v_cbm, 'status', v_status);
END;
$fn$;

-- 5.12 Charger un avion colis par colis : même règle (le colis emballé part avec son paquet).
CREATE OR REPLACE FUNCTION public.cargo_air_load_parcels(p_air_id UUID, p_parcel_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_status TEXT; v_n INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  IF v_a.status IN ('ARRIVED','DELIVERED') THEN RETURN jsonb_build_object('success', false, 'error', 'Cet avion est déjà arrivé : on ne charge plus rien dedans'); END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi'); END IF;
  v_status := public.parcel_status_for_air(v_a.status);
  WITH moved AS (
    UPDATE public.parcels p
       SET air_shipment_id = p_air_id, status = v_status, updated_at = now()
     WHERE p.id = ANY(p_parcel_ids) AND p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.air_package_id IS NULL AND p.status IN ('received','stored')
     RETURNING p.weight_kg, p.cbm
  )
  SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_n, v_kg, v_cbm FROM moved;
  IF v_n = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Ces colis sont déjà chargés ou introuvables'); END IF;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_load_parcels', 'air_shipment', p_air_id,
          jsonb_build_object('description', v_n || ' colis chargés dans la LTA ' || v_a.awb_number || ' (' || v_kg || ' kg)', 'parcel_ids', to_jsonb(p_parcel_ids), 'count', v_n, 'weight_kg', v_kg, 'cbm', v_cbm));
  RETURN jsonb_build_object('success', true, 'loaded', v_n, 'weight_kg', v_kg, 'cbm', v_cbm, 'status', v_status);
END;
$fn$;

-- 5.13 Retirer un colis d'un avion : un colis emballé ne sort qu'avec son paquet.
CREATE OR REPLACE FUNCTION public.cargo_air_unload_parcel(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_p public.parcels; v_a public.air_shipments;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_p FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.air_shipment_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis n''est pas dans un avion'); END IF;
  IF v_p.air_package_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis voyage dans le paquet '
      || COALESCE((SELECT k.package_no FROM public.air_packages k WHERE k.id = v_p.air_package_id), '')
      || ' : retirez le paquet de l''expédition');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_p.air_shipment_id;
  IF v_a.status <> 'PLANNED' THEN RETURN jsonb_build_object('success', false, 'error', 'L''avion est parti : le colis ne se retire plus'); END IF;
  UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now() WHERE id = v_p.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_unload_parcel', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Colis ' || v_p.parcel_no || ' retiré de la LTA ' || v_a.awb_number, 'parcel_id', v_p.id, 'parcel_no', v_p.parcel_no));
  RETURN jsonb_build_object('success', true);
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. LTA provisoire : l'expédition s'ouvre avant que la LTA soit connue
-- ─────────────────────────────────────────────────────────────────────────
-- p_awb_number vide → « PROV-XXXXXX » ; la vraie LTA se pose ensuite, même
-- l'avion parti (une LTA réelle, elle, ne change plus après le départ).
CREATE OR REPLACE FUNCTION public.cargo_air_create(
  p_awb_number TEXT,
  p_airline TEXT DEFAULT NULL,
  p_flight_no TEXT DEFAULT NULL,
  p_etd DATE DEFAULT NULL,
  p_eta DATE DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_destination TEXT DEFAULT NULL,
  p_freight_usd NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_awb TEXT; v_id UUID; v_prov BOOLEAN;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  v_awb := upper(regexp_replace(COALESCE(p_awb_number, ''), '\s+', '', 'g'));
  v_prov := v_awb = '';
  IF v_prov THEN
    IF p_etd IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sans LTA, indiquez au moins la date de départ prévue'); END IF;
    LOOP
      v_awb := 'PROV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb);
    END LOOP;
  ELSE
    IF length(v_awb) < 4 THEN RETURN jsonb_build_object('success', false, 'error', 'Numéro de LTA trop court'); END IF;
    IF v_awb LIKE 'PROV-%' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est réservé aux LTA provisoires'); END IF;
    IF EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette LTA existe déjà');
    END IF;
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le fret ne peut pas être négatif'); END IF;
  INSERT INTO public.air_shipments (awb_number, airline, flight_no, etd, eta, origin, destination, freight_usd, notes, created_by)
  VALUES (v_awb, NULLIF(TRIM(p_airline), ''), NULLIF(upper(TRIM(p_flight_no)), ''), p_etd, p_eta,
          COALESCE(NULLIF(TRIM(p_origin), ''), 'Guangzhou (CAN)'), COALESCE(NULLIF(TRIM(p_destination), ''), 'Douala (DLA)'),
          p_freight_usd, NULLIF(TRIM(p_notes), ''), v_uid)
  RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'create_air_shipment', 'air_shipment', v_id,
          jsonb_build_object('description', 'Expédition aérienne ouverte : ' || CASE WHEN v_prov THEN 'LTA à venir (' || v_awb || ')' ELSE 'LTA ' || v_awb END
                                            || COALESCE(' · vol ' || upper(TRIM(p_flight_no)), ''), 'awb_number', v_awb, 'etd', p_etd, 'provisional', v_prov));
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_id, true));
END;
$fn$;

CREATE OR REPLACE FUNCTION public.cargo_air_update(
  p_air_id UUID,
  p_awb_number TEXT DEFAULT NULL,
  p_airline TEXT DEFAULT NULL,
  p_flight_no TEXT DEFAULT NULL,
  p_etd DATE DEFAULT NULL,
  p_eta DATE DEFAULT NULL,
  p_origin TEXT DEFAULT NULL,
  p_destination TEXT DEFAULT NULL,
  p_freight_usd NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_awb TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_a FROM public.air_shipments WHERE id = p_air_id FOR UPDATE;
  IF v_a.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable'); END IF;
  v_awb := v_a.awb_number;
  IF p_awb_number IS NOT NULL AND btrim(p_awb_number) <> '' AND upper(regexp_replace(p_awb_number, '\s+', '', 'g')) <> v_a.awb_number THEN
    -- Une LTA réelle ne change plus une fois l'avion parti ; une LTA provisoire se remplace toujours.
    IF v_a.status <> 'PLANNED' AND v_a.awb_number NOT LIKE 'PROV-%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'La LTA ne change plus une fois l''avion parti');
    END IF;
    v_awb := upper(regexp_replace(p_awb_number, '\s+', '', 'g'));
    IF length(v_awb) < 4 THEN RETURN jsonb_build_object('success', false, 'error', 'Numéro de LTA trop court'); END IF;
    IF v_awb LIKE 'PROV-%' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est réservé aux LTA provisoires'); END IF;
    IF EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb AND id <> v_a.id) THEN RETURN jsonb_build_object('success', false, 'error', 'Cette LTA existe déjà'); END IF;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'air_shipment_awb', 'air_shipment', v_a.id,
            jsonb_build_object('description', 'LTA ' || v_a.awb_number || ' → ' || v_awb, 'from', v_a.awb_number, 'to', v_awb));
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le fret ne peut pas être négatif'); END IF;
  UPDATE public.air_shipments SET
    awb_number  = v_awb,
    airline     = CASE WHEN p_airline IS NULL THEN airline ELSE NULLIF(TRIM(p_airline), '') END,
    flight_no   = CASE WHEN p_flight_no IS NULL THEN flight_no ELSE NULLIF(upper(TRIM(p_flight_no)), '') END,
    etd         = COALESCE(p_etd, etd),
    eta         = COALESCE(p_eta, eta),
    origin      = COALESCE(NULLIF(TRIM(p_origin), ''), origin),
    destination = COALESCE(NULLIF(TRIM(p_destination), ''), destination),
    freight_usd = COALESCE(p_freight_usd, freight_usd),
    notes       = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(TRIM(p_notes), '') END,
    updated_at  = now()
  WHERE id = v_a.id;
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true));
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Droits et étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Aides internes : jamais appelables depuis l'API.
REVOKE ALL ON FUNCTION public.air_package_json(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._air_package_can_read() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._air_package_can_ship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.parcels_package_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.air_packages_follow_checkin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reception_parcel_locked(public.parcels) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.warehouse_parcel_json(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC, anon, authenticated;
-- Lecteurs de code : purs, sans données.
REVOKE ALL ON FUNCTION public.air_package_code(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parcel_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.air_package_code(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parcel_code(TEXT) TO authenticated, service_role;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.air_package_list(text, uuid)',
    'public.air_package_get(uuid, text)',
    'public.air_package_create(text)',
    'public.air_package_add_parcel(uuid, text)',
    'public.air_package_remove_parcel(uuid)',
    'public.air_package_seal(uuid, numeric, numeric, numeric, numeric)',
    'public.air_package_reopen(uuid)',
    'public.air_package_delete(uuid)',
    'public.air_package_assign(uuid, uuid[])',
    'public.air_package_unassign(uuid)',
    'public.air_package_scan_departure(uuid, text)',
    'public.air_package_refuse(uuid, text)',
    'public.air_package_receive(text)',
    'public.air_package_open(uuid)',
    'public.cargo_air_loadable_parcels(uuid)',
    'public.reception_loadable_parcels(uuid)',
    'public.cargo_air_set_status(uuid, text, timestamptz)',
    'public.warehouse_arrival_parcels(text, uuid)',
    'public.cargo_air_create(text, text, text, date, date, text, text, numeric, text)',
    'public.cargo_air_update(uuid, text, text, text, date, date, text, text, numeric, text)',
    'public.warehouse_day()',
    'public.cargo_load_parcels(uuid, uuid[])',
    'public.cargo_air_load_parcels(uuid, uuid[])',
    'public.cargo_air_unload_parcel(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.air_package_list(text, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","label":"Les paquets avion de 32 kg : au bureau (en cours, fermés, refusés, pas encore partis), ou ceux d''une expédition"}';
COMMENT ON FUNCTION public.air_package_get(uuid, text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","label":"Un paquet avion (par son numéro PQ-…) : poids, expédition, colis et clients"}';
COMMENT ON FUNCTION public.air_package_create(text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Ouvrir un nouveau paquet avion (32 kg au plus)"}';
COMMENT ON FUNCTION public.air_package_add_parcel(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Mettre un colis avion (RC-…) dans un paquet ouvert"}';
COMMENT ON FUNCTION public.air_package_remove_parcel(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Retirer un colis d''un paquet encore ouvert"}';
COMMENT ON FUNCTION public.air_package_seal(uuid, numeric, numeric, numeric, numeric) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Fermer un paquet avion : poids pesé (32 kg au plus) et dimensions"}';
COMMENT ON FUNCTION public.air_package_reopen(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Rouvrir un paquet fermé qui n''est dans aucune expédition"}';
COMMENT ON FUNCTION public.air_package_delete(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Supprimer un paquet ouvert et vide"}';
COMMENT ON FUNCTION public.air_package_assign(uuid, uuid[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Affecter des paquets fermés à une expédition aérienne pas encore partie"}';
COMMENT ON FUNCTION public.air_package_unassign(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Retirer un paquet d''une expédition pas encore partie"}';
COMMENT ON FUNCTION public.air_package_scan_departure(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Scanner un paquet au départ (remise à l''aéroport)"}';
COMMENT ON FUNCTION public.air_package_refuse(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":true,"label":"Déclarer un paquet refusé à l''aéroport (motif) : il sort de l''expédition avec ses colis"}';
COMMENT ON FUNCTION public.air_package_receive(text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Douala : recevoir un paquet à l''entrepôt (scan PQ-…)"}';
COMMENT ON FUNCTION public.air_package_open(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Douala : ouvrir un paquet reçu pour pointer ses colis"}';
COMMENT ON FUNCTION public.air_package_json(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Sérialiser un paquet avion (helper interne)"}';
COMMENT ON FUNCTION public._air_package_can_read() IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Interne : peut lire les paquets"}';
COMMENT ON FUNCTION public._air_package_can_ship() IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","label":"Interne : peut envoyer les paquets à l''aéroport"}';
COMMENT ON FUNCTION public.air_package_code(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Interne : lire un numéro de paquet scanné"}';
COMMENT ON FUNCTION public.parcel_code(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Interne : lire un numéro de colis scanné"}';
COMMENT ON FUNCTION public.parcels_package_guard() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","label":"Interne : un colis emballé suit son paquet"}';
COMMENT ON FUNCTION public.air_packages_follow_checkin() IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveAtDestination","label":"Interne : pointer un colis ouvre son paquet"}';
COMMENT ON FUNCTION public.reception_parcel_locked(public.parcels) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Dire pourquoi un colis ne se modifie plus (helper interne)"}';
COMMENT ON FUNCTION public.cargo_air_loadable_parcels(uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les colis reçus (hors paquets) qu''on peut mettre dans une expédition aérienne"}';
COMMENT ON FUNCTION public.reception_loadable_parcels(uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les colis reçus qu''on peut charger dans une boîte"}';
COMMENT ON FUNCTION public.cargo_air_set_status(uuid, text, timestamptz) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Poser un jalon sur une expédition aérienne : parti (paquets scannés), arrivé (les colis suivent)"}';
COMMENT ON FUNCTION public.cargo_air_json(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser une expédition aérienne (helper interne)"}';
COMMENT ON FUNCTION public.warehouse_parcel_json(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Sérialiser un colis vu de l''entrepôt de destination (helper interne)"}';
COMMENT ON FUNCTION public.warehouse_arrival_parcels(text, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Les colis et les paquets d''une arrivée à Douala (avion ou boîte), avec leur pointage"}';
COMMENT ON FUNCTION public.cargo_air_create(text, text, text, date, date, text, text, numeric, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Ouvrir une expédition aérienne (LTA, ou vide = LTA à venir avec une date de départ ; compagnie, vol, dates)"}';
COMMENT ON FUNCTION public.cargo_air_update(uuid, text, text, text, date, date, text, text, numeric, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Corriger une expédition aérienne (LTA provisoire à remplacer, vol, dates, fret, notes)"}';

COMMENT ON FUNCTION public.warehouse_day() IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"La journée de l''entrepôt de Douala : arrivées à pointer, colis qui attendent leur client, remises du jour"}';
COMMENT ON FUNCTION public.air_shipments_notify() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","confirm":false,"danger":false,"label":"Interne : prévenir les clients au départ et à l''arrivée d''un vol"}';
COMMENT ON FUNCTION public.staff_push_on_air_arrival() IS
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Interne : prévenir l''équipe de Douala qu''un vol est arrivé"}';
COMMENT ON FUNCTION public.reception_deposit_json(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis, avec ses photos et le paquet de chaque colis (helper interne)"}';
COMMENT ON FUNCTION public.cargo_load_parcels(uuid, uuid[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Charger des colis reçus dans une boîte (dossier Cargo) — hors colis emballés dans un paquet avion"}';
COMMENT ON FUNCTION public.cargo_air_load_parcels(uuid, uuid[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Charger des colis reçus dans une expédition aérienne (colis hors paquet)"}';
COMMENT ON FUNCTION public.cargo_air_unload_parcel(uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Retirer un colis (hors paquet) d''une expédition aérienne pas encore partie"}';

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- À passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) : copie exacte de
-- supabase/migrations/20260921170000_cargo_client_notifications.sql. Idempotent.
-- Suppose migrations/20260921_warehouse_destination.sql (phase 4) déjà passé.
-- Tout démarre DÉSACTIVÉ côté SMS/email ; la notification in-app, elle, part
-- dès maintenant. Pour activer un SMS :
--   UPDATE public.sms_template_map SET enabled = true WHERE notification_type = 'parcel_ready';
-- ============================================================================

-- ============================================================================
-- Cargo · Phase 5 — le client est prévenu à chaque jalon
--
-- Nos clients ne passent pas forcément par l'app : ils lisent un SMS. À
-- chaque jalon de la chaîne, une ligne dans public.notifications pour le
-- client — et les déclencheurs déjà en place (enqueue_email_from_notification,
-- enqueue_sms_from_notification) en font un email et/ou un SMS, si le type
-- est activé dans email_template_map / sms_template_map. Tout démarre
-- DÉSACTIVÉ côté SMS et email (règle du projet : un gabarit à la fois) ; la
-- notification in-app, elle, existe dès maintenant.
--
-- Les jalons, et ce que le client lit :
--   parcel_quote_sent        « Votre devis DV-… : 219 840 XAF pour 10 colis »
--   parcel_payment_received  « Reçu RE-… : 120 000 XAF encaissés, reste 99 840 »
--   parcel_invoice_issued    « Facture acquittée FA-… : tout est réglé »
--   parcel_departed          « Vos 4 colis ont quitté Guangzhou (vol ET 607) »
--   parcel_arrived           « Vos colis sont arrivés à Douala »
--   parcel_ready             « Vos n colis (RC-…) sont prêts au retrait à Douala »
--   parcel_released          « n colis remis à … Bon de retrait BR-… »
--
-- Tout en déclencheurs (AFTER …) : aucune RPC n'est réécrite, la règle
-- métier reste au même endroit, et un jalon posé par Mola ou par l'admin
-- prévient pareil. Best-effort : une notification qui échoue ne fait jamais
-- échouer le jalon.
--
-- Idempotent. Suppose 20260921160000_warehouse_destination.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le helper : une notification pour un client, sans jamais casser le jalon
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_notify_client(p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_first TEXT;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  BEGIN
    SELECT c.first_name INTO v_first FROM public.clients c WHERE c.user_id = p_user_id;
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (p_user_id, p_type, p_title, p_message, COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('first_name', v_first, 'kind', 'cargo'));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'cargo_notify_client: échec (% pour %) : %', p_type, p_user_id, SQLERRM;
  END;
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_notify_client(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_notify_client(UUID, TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;
COMMENT ON FUNCTION public.cargo_notify_client(UUID, TEXT, TEXT, TEXT, JSONB) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","confirm":false,"danger":false,"label":"Prévenir un client d''un jalon cargo (helper interne, appelé par les déclencheurs)"}';

CREATE OR REPLACE FUNCTION public.cargo_fmt_xaf(p NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT replace(to_char(round(COALESCE(p, 0)), 'FM999G999G999G999'), ',', ' ');
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Le devis : envoyé, payé, facturé
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parcel_quotes_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_user UUID; v_dep TEXT; v_n INTEGER; v_meta JSONB;
BEGIN
  SELECT d.client_user_id, d.deposit_no, (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id) INTO v_user, v_dep, v_n
  FROM public.parcel_deposits d WHERE d.id = NEW.deposit_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  v_meta := jsonb_build_object('deposit_id', NEW.deposit_id, 'deposit_no', v_dep, 'quote_id', NEW.id, 'quote_no', NEW.quote_no,
                               'amount_xaf', NEW.total_xaf, 'paid_xaf', NEW.amount_paid_xaf, 'balance_xaf', GREATEST(NEW.total_xaf - NEW.amount_paid_xaf, 0),
                               'parcel_count', v_n, 'reference', NEW.quote_no);
  -- Envoyé (la première fois, ou renvoyé après modification).
  IF NEW.sent_at IS DISTINCT FROM OLD.sent_at AND NEW.sent_at IS NOT NULL THEN
    PERFORM public.cargo_notify_client(v_user, 'parcel_quote_sent',
      'Votre devis ' || NEW.quote_no,
      'Votre devis pour ' || v_n || ' colis (' || v_dep || ') est prêt : ' || public.cargo_fmt_xaf(NEW.total_xaf) || ' XAF. Réglez avant le départ de Chine ou au retrait à Douala.',
      v_meta);
  END IF;
  -- Facture acquittée.
  IF NEW.invoice_no IS NOT NULL AND OLD.invoice_no IS NULL THEN
    PERFORM public.cargo_notify_client(v_user, 'parcel_invoice_issued',
      'Facture acquittée ' || NEW.invoice_no,
      'Tout est réglé pour vos ' || v_n || ' colis (' || v_dep || ') : ' || public.cargo_fmt_xaf(NEW.total_xaf) || ' XAF. Votre facture acquittée ' || NEW.invoice_no || ' est disponible.',
      v_meta || jsonb_build_object('invoice_no', NEW.invoice_no, 'reference', NEW.invoice_no));
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcel_quotes_notify ON public.parcel_quotes;
CREATE TRIGGER parcel_quotes_notify
  AFTER UPDATE OF sent_at, invoice_no ON public.parcel_quotes
  FOR EACH ROW EXECUTE FUNCTION public.parcel_quotes_notify();

-- Un encaissement : le reçu, et le reste à payer.
CREATE OR REPLACE FUNCTION public.parcel_quote_payments_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_q public.parcel_quotes; v_user UUID; v_dep TEXT; v_paid NUMERIC; v_balance NUMERIC;
BEGIN
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = NEW.quote_id;
  SELECT d.client_user_id, d.deposit_no INTO v_user, v_dep FROM public.parcel_deposits d WHERE d.id = v_q.deposit_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  -- L'encaissé après CE paiement (le recalcul du devis suit dans la même transaction, on somme ici).
  SELECT COALESCE(sum(p.amount_xaf), 0) INTO v_paid FROM public.parcel_quote_payments p WHERE p.quote_id = v_q.id AND p.cancelled_at IS NULL;
  v_balance := GREATEST(v_q.total_xaf - v_paid, 0);
  PERFORM public.cargo_notify_client(v_user, 'parcel_payment_received',
    'Paiement reçu · ' || NEW.receipt_no,
    'Nous avons bien reçu ' || public.cargo_fmt_xaf(NEW.amount_xaf) || ' XAF sur votre devis ' || v_q.quote_no || ' (' || v_dep || '). ' ||
      CASE WHEN v_balance > 0 THEN 'Reste à payer : ' || public.cargo_fmt_xaf(v_balance) || ' XAF.' ELSE 'Votre devis est entièrement réglé.' END,
    jsonb_build_object('deposit_id', v_q.deposit_id, 'deposit_no', v_dep, 'quote_id', v_q.id, 'quote_no', v_q.quote_no, 'payment_id', NEW.id, 'receipt_no', NEW.receipt_no,
                       'amount_xaf', NEW.amount_xaf, 'paid_xaf', v_paid, 'balance_xaf', v_balance, 'method', NEW.method, 'place', NEW.place, 'reference', NEW.receipt_no));
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcel_quote_payments_notify ON public.parcel_quote_payments;
CREATE TRIGGER parcel_quote_payments_notify
  AFTER INSERT ON public.parcel_quote_payments
  FOR EACH ROW EXECUTE FUNCTION public.parcel_quote_payments_notify();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. L'avion : parti, arrivé — une notification par client concerné
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
    SELECT d.client_user_id AS user_id, count(*) AS n, string_agg(DISTINCT d.deposit_no, ', ') AS deposits, min(d.id) AS deposit_id
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
DROP TRIGGER IF EXISTS air_shipments_notify ON public.air_shipments;
CREATE TRIGGER air_shipments_notify
  AFTER UPDATE OF status ON public.air_shipments
  FOR EACH ROW EXECUTE FUNCTION public.air_shipments_notify();

-- La boîte aussi : arrivée (le suivi armateur ou l'admin la marque ARRIVED).
CREATE OR REPLACE FUNCTION public.cargo_shipments_notify_parcels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE r RECORD;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('AT_SEA','ARRIVED') THEN RETURN NEW; END IF;
  FOR r IN
    SELECT d.client_user_id AS user_id, count(*) AS n, string_agg(DISTINCT d.deposit_no, ', ') AS deposits, min(d.id) AS deposit_id
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
$fn$;
DROP TRIGGER IF EXISTS cargo_shipments_notify_parcels ON public.cargo_shipments;
CREATE TRIGGER cargo_shipments_notify_parcels
  AFTER UPDATE OF status ON public.cargo_shipments
  FOR EACH ROW EXECUTE FUNCTION public.cargo_shipments_notify_parcels();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Douala : prêt au retrait (le dernier colis du dépôt est pointé), remis
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parcels_notify_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_user UUID; v_dep TEXT; v_left INTEGER; v_n INTEGER; v_q public.parcel_quotes; v_balance NUMERIC;
BEGIN
  IF NEW.checked_in_at IS NULL OR OLD.checked_in_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT d.client_user_id, d.deposit_no INTO v_user, v_dep FROM public.parcel_deposits d WHERE d.id = NEW.deposit_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  -- Reste-t-il des colis du même dépôt, partis mais pas encore pointés (ni manquants) ?
  SELECT count(*) FILTER (WHERE p.checked_in_at IS NULL AND p.delivered_at IS NULL AND COALESCE(p.condition,'') <> 'missing' AND (p.shipment_id IS NOT NULL OR p.air_shipment_id IS NOT NULL)),
         count(*) FILTER (WHERE p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL)
    INTO v_left, v_n
  FROM public.parcels p WHERE p.deposit_id = NEW.deposit_id;
  IF v_left > 0 THEN RETURN NEW; END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE deposit_id = NEW.deposit_id;
  v_balance := CASE WHEN v_q.id IS NULL THEN NULL ELSE GREATEST(v_q.total_xaf - v_q.amount_paid_xaf, 0) END;
  PERFORM public.cargo_notify_client(v_user, 'parcel_ready',
    'Vos colis sont prêts au retrait',
    'Vos ' || v_n || ' colis (' || v_dep || ') vous attendent à notre entrepôt de Douala. Présentez votre code client.' ||
      CASE WHEN v_balance IS NULL OR v_q.total_xaf <= 0 THEN '' WHEN v_balance > 0 THEN ' Reste à régler sur place : ' || public.cargo_fmt_xaf(v_balance) || ' XAF.' ELSE ' Votre devis est réglé.' END,
    jsonb_build_object('deposit_id', NEW.deposit_id, 'deposit_no', v_dep, 'parcel_count', v_n, 'balance_xaf', v_balance, 'quote_no', v_q.quote_no, 'reference', v_dep));
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcels_notify_ready ON public.parcels;
CREATE TRIGGER parcels_notify_ready
  AFTER UPDATE OF checked_in_at ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.parcels_notify_ready();

CREATE OR REPLACE FUNCTION public.parcel_releases_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Les colis reçoivent release_id dans la même transaction, juste après l'INSERT :
  -- on lit ce que la RPC nous a donné (parcel_count) plutôt que la jointure.
  PERFORM public.cargo_notify_client(NEW.client_user_id, 'parcel_released',
    'Colis remis · ' || NEW.release_no,
    NEW.parcel_count || ' colis remis à ' || NEW.picked_by_name || ' à Douala le ' || to_char(NEW.released_at AT TIME ZONE 'Africa/Douala', 'DD/MM à HH24:MI') || '. Bon de retrait ' || NEW.release_no || '. Merci de votre confiance.',
    jsonb_build_object('release_id', NEW.id, 'release_no', NEW.release_no, 'parcel_count', NEW.parcel_count, 'picked_by_name', NEW.picked_by_name, 'reference', NEW.release_no));
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcel_releases_notify ON public.parcel_releases;
CREATE TRIGGER parcel_releases_notify
  AFTER INSERT ON public.parcel_releases
  FOR EACH ROW EXECUTE FUNCTION public.parcel_releases_notify();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Les gabarits SMS et email : mappés, DÉSACTIVÉS. À activer un par un,
--    depuis le SQL Editor : UPDATE public.sms_template_map SET enabled = true WHERE notification_type = 'parcel_ready';
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.sms_template_map (notification_type, template, category, enabled) VALUES
  ('parcel_quote_sent',       'parcel_quote_sent',       'transactional', false),
  ('parcel_payment_received', 'parcel_payment_received', 'transactional', false),
  ('parcel_invoice_issued',   'parcel_invoice_issued',   'transactional', false),
  ('parcel_departed',         'parcel_departed',         'transactional', false),
  ('parcel_arrived',          'parcel_arrived',          'transactional', false),
  ('parcel_ready',            'parcel_ready',            'transactional', false),
  ('parcel_released',         'parcel_released',         'transactional', false)
ON CONFLICT (notification_type) DO NOTHING;

-- L'email : le gabarit générique (titre + message, déjà en français) suffit.
INSERT INTO public.email_template_map (notification_type, template, enabled) VALUES
  ('parcel_quote_sent',       'cargo_event', false),
  ('parcel_payment_received', 'cargo_event', false),
  ('parcel_invoice_issued',   'cargo_event', false),
  ('parcel_departed',         'cargo_event', false),
  ('parcel_arrived',          'cargo_event', false),
  ('parcel_ready',            'cargo_event', false),
  ('parcel_released',         'cargo_event', false)
ON CONFLICT (notification_type) DO NOTHING;

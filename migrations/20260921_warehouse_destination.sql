-- ============================================================================
-- À passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) : copie exacte de
-- supabase/migrations/20260921160000_warehouse_destination.sql. Idempotent.
-- Suppose migrations/20260921_cargo_air_shipments.sql (phase 3) déjà passé.
-- ATTENTION : ALTER TYPE ... ADD VALUE ne peut pas être suivi, dans la même
-- transaction, d'une utilisation de la nouvelle valeur en tant qu'enum. Ici la
-- valeur n'est comparée qu'en texte (ur.role::text) : le fichier passe d'un bloc.
-- ============================================================================

-- ============================================================================
-- Cargo · Phase 4 — l'entrepôt du Cameroun : pointer, ranger, remettre
--
-- Le dernier maillon. À Douala, un AGENT D'ENTREPÔT (rôle warehouse_agent)
-- reçoit ce qui arrive (avion ou boîte), pointe chaque colis contre le
-- manifeste — présent, abîmé, manquant — lui donne une place (« étagère B3 »),
-- puis REMET les colis au client qui se présente avec son code : la remise
-- est BLOQUÉE tant que le devis n'est pas soldé (l'agent peut encaisser sur
-- place : il a canCollectParcelPayments), et se conclut par un BON DE RETRAIT
-- signé (BR-000123), la preuve que la marchandise a changé de mains.
--
--   1. rôle warehouse_agent + permissions canReceiveAtDestination,
--      canReleaseParcels ; canCollectParcelPayments élargie
--   2. parcels : pointage, état, place, remise · table parcel_releases
--   3. seau parcel-signatures ; lecture des preuves élargie
--   4. RPC warehouse_* (journée, arrivées, pointage, client, remise, bon)
--   5. les JSON du dépôt et de l'avion disent le pointage et la remise ;
--      cargo_quote_get lisible par qui encaisse
--
-- Idempotent. Suppose 20260921150000_cargo_air_shipments.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Rôle + permissions — miroir de ROLE_PERMISSIONS (AdminAuthContext.tsx)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_agent';

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
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Le colis à destination, et le bon de retrait
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS checked_in_at      TIMESTAMPTZ;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS checked_in_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS warehouse_location TEXT;         -- « B3 », « zone fragile »
-- ok : pointé conforme · damaged : pointé, abîmé (note) · missing : attendu, jamais vu
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS condition          TEXT CHECK (condition IS NULL OR condition IN ('ok','damaged','missing'));
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS condition_note     TEXT;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS delivered_at       TIMESTAMPTZ;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS release_id         UUID;
CREATE INDEX IF NOT EXISTS parcels_destination_idx ON public.parcels (status, checked_in_at) WHERE status = 'arrived';

CREATE SEQUENCE IF NOT EXISTS public.parcel_release_no_seq START 1;
CREATE TABLE IF NOT EXISTS public.parcel_releases (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_no       TEXT NOT NULL UNIQUE DEFAULT ('BR-' || lpad(nextval('public.parcel_release_no_seq')::text, 6, '0')),
  client_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  picked_by_name   TEXT NOT NULL,                  -- qui a emporté (le client, ou son envoyé)
  picked_by_phone  TEXT,
  signature_path   TEXT,                           -- parcel-signatures/<bon>.png
  note             TEXT,
  parcel_count     INTEGER NOT NULL DEFAULT 0,
  released_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcel_releases_client_idx ON public.parcel_releases (client_user_id, released_at DESC);

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parcels_release_fk') THEN
    ALTER TABLE public.parcels ADD CONSTRAINT parcels_release_fk FOREIGN KEY (release_id) REFERENCES public.parcel_releases(id) ON DELETE SET NULL;
  END IF;
END
$do$;

ALTER TABLE public.parcel_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parcel_releases_staff_read ON public.parcel_releases;
CREATE POLICY parcel_releases_staff_read ON public.parcel_releases FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo') OR public.admin_has_permission(auth.uid(), 'canReleaseParcels'));
-- Aucune écriture directe : tout passe par warehouse_release_parcels.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Les signatures (seau privé) ; les preuves lisibles par qui encaisse
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('parcel-signatures', 'parcel-signatures', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Warehouse can upload signatures" ON storage.objects;
CREATE POLICY "Warehouse can upload signatures" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parcel-signatures' AND public.admin_has_permission(auth.uid(), 'canReleaseParcels'));
DROP POLICY IF EXISTS "Staff can view signatures" ON storage.objects;
CREATE POLICY "Staff can view signatures" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parcel-signatures' AND (public.admin_has_permission(auth.uid(), 'canViewCargo') OR public.admin_has_permission(auth.uid(), 'canReleaseParcels')));

DROP POLICY IF EXISTS "Staff can view parcel payment proofs" ON storage.objects;
CREATE POLICY "Staff can view parcel payment proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parcel-payment-proofs' AND (public.admin_has_permission(auth.uid(), 'canViewCargo') OR public.admin_has_permission(auth.uid(), 'canCollectParcelPayments')));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC
-- ─────────────────────────────────────────────────────────────────────────

-- 4.1 Un colis vu de Douala (helper) : le colis, son dépôt, son client, son
--     transport (LTA ou boîte), son pointage, et où en est le devis.
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
COMMENT ON FUNCTION public.warehouse_parcel_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Sérialiser un colis vu de l''entrepôt de destination (helper interne)"}';

-- 4.2 La journée de l'entrepôt : ce qui est arrivé et reste à pointer, ce qui
--     attend son client (par client, avec « payé / à encaisser »), ce qui a été
--     remis aujourd'hui.
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
        SELECT jsonb_build_object('kind', 'air', 'id', a.id, 'ref', a.awb_number, 'label', 'LTA ' || a.awb_number, 'sub', COALESCE(a.flight_no || ' · ', '') || COALESCE(a.airline, ''),
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
COMMENT ON FUNCTION public.warehouse_day() IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"La journée de l''entrepôt de Douala : arrivées à pointer, colis qui attendent leur client, remises du jour"}';

-- 4.3 Les colis d'une arrivée (avion ou boîte), à pointer contre le manifeste.
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
    SELECT 'LTA ' || a.awb_number, COALESCE(a.flight_no || ' · ', '') || COALESCE(a.airline, '') INTO v_label, v_sub FROM public.air_shipments a WHERE a.id = p_id;
  ELSIF p_kind = 'sea' THEN
    SELECT cs.container_number, cs.client_label INTO v_label, v_sub FROM public.cargo_shipments cs WHERE cs.id = p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type inconnu');
  END IF;
  IF v_label IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Arrivée introuvable'); END IF;
  RETURN jsonb_build_object('success', true, 'kind', p_kind, 'id', p_id, 'label', v_label, 'sub', v_sub, 'parcels', COALESCE((
    SELECT jsonb_agg(public.warehouse_parcel_json(p.id) ORDER BY d.client_user_id, d.opened_at, p.seq)
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
    WHERE (p_kind = 'air' AND p.air_shipment_id = p_id) OR (p_kind = 'sea' AND p.shipment_id = p_id)
  ), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_arrival_parcels(TEXT, UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Les colis d''une arrivée à Douala (avion ou boîte), avec leur pointage"}';

-- 4.4 Pointer un colis : il est là. Une place, un état (ok / abîmé + note).
--     Le colis passe « arrivé » s'il ne l'était pas encore (l'avion ou la boîte
--     a pu être pointé avant que l'admin marque l'arrivée).
CREATE OR REPLACE FUNCTION public.warehouse_checkin_parcel(p_parcel_id UUID, p_location TEXT DEFAULT NULL, p_condition TEXT DEFAULT 'ok', p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_p public.parcels;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_condition NOT IN ('ok','damaged') THEN RETURN jsonb_build_object('success', false, 'error', 'État inconnu (ok ou abîmé)'); END IF;
  SELECT * INTO v_p FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF v_p.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  IF v_p.shipment_id IS NULL AND v_p.air_shipment_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis n''a pas quitté la Chine : il n''est dans aucun avion ni aucune boîte'); END IF;
  IF v_p.delivered_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis a déjà été remis (' || COALESCE((SELECT r.release_no FROM public.parcel_releases r WHERE r.id = v_p.release_id), '') || ')'); END IF;
  IF v_p.status = 'loaded' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis n''est pas encore parti de Chine'); END IF;
  UPDATE public.parcels SET
    status = 'arrived',
    checked_in_at = COALESCE(checked_in_at, now()), checked_in_by = COALESCE(checked_in_by, v_uid),
    warehouse_location = COALESCE(NULLIF(TRIM(p_location), ''), warehouse_location),
    condition = p_condition, condition_note = CASE WHEN p_condition = 'damaged' THEN NULLIF(TRIM(p_note), '') ELSE NULL END,
    updated_at = now()
  WHERE id = v_p.id;
  IF p_condition = 'damaged' THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'warehouse_parcel_damaged', 'parcel', v_p.id,
            jsonb_build_object('description', 'Colis ' || v_p.parcel_no || ' pointé abîmé à Douala' || COALESCE(' : ' || TRIM(p_note), ''), 'parcel_no', v_p.parcel_no, 'note', p_note));
  END IF;
  RETURN jsonb_build_object('success', true, 'parcel', public.warehouse_parcel_json(v_p.id));
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_checkin_parcel(UUID, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Pointer un colis arrivé à Douala (place, état ok ou abîmé)"}';

-- 4.5 Tout pointer d'un coup (les colis conformes d'une arrivée).
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
  WITH done AS (
    UPDATE public.parcels SET
      status = 'arrived', checked_in_at = COALESCE(checked_in_at, now()), checked_in_by = COALESCE(checked_in_by, v_uid),
      warehouse_location = COALESCE(NULLIF(TRIM(p_location), ''), warehouse_location),
      condition = COALESCE(NULLIF(condition, 'missing'), 'ok'), updated_at = now()
    WHERE id = ANY(p_parcel_ids) AND (shipment_id IS NOT NULL OR air_shipment_id IS NOT NULL) AND status IN ('shipped','arrived') AND delivered_at IS NULL
    RETURNING id
  ) SELECT count(*) INTO v_n FROM done;
  RETURN jsonb_build_object('success', true, 'checked', v_n);
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_checkin_many(UUID[], TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":true,"danger":false,"label":"Pointer plusieurs colis arrivés d''un coup (conformes)"}';

-- 4.6 Signaler un colis manquant (jamais vu à l'arrivée), ou annuler le signalement.
CREATE OR REPLACE FUNCTION public.warehouse_flag_missing(p_parcel_id UUID, p_missing BOOLEAN DEFAULT true, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_p public.parcels;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_p FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF v_p.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  IF v_p.delivered_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis a déjà été remis'); END IF;
  IF p_missing THEN
    UPDATE public.parcels SET condition = 'missing', condition_note = NULLIF(TRIM(p_note), ''), checked_in_at = NULL, checked_in_by = NULL, updated_at = now() WHERE id = v_p.id;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'warehouse_parcel_missing', 'parcel', v_p.id,
            jsonb_build_object('description', 'Colis ' || v_p.parcel_no || ' manquant à l''arrivée à Douala' || COALESCE(' : ' || TRIM(p_note), ''), 'parcel_no', v_p.parcel_no, 'note', p_note));
  ELSE
    UPDATE public.parcels SET condition = NULL, condition_note = NULL, updated_at = now() WHERE id = v_p.id;
  END IF;
  RETURN jsonb_build_object('success', true, 'parcel', public.warehouse_parcel_json(v_p.id));
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_flag_missing(UUID, BOOLEAN, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":true,"danger":false,"label":"Signaler un colis manquant à l''arrivée (ou retirer le signalement)"}';

-- 4.7 Trouver un colis par son numéro (tapé ou scanné sur l'étiquette).
CREATE OR REPLACE FUNCTION public.warehouse_find_parcel(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_no TEXT; v_id UUID;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canReceiveAtDestination') OR public.admin_has_permission(v_uid, 'canReleaseParcels')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  -- « RC-000123-01 », « rc 000123 01 », « 000123-01 »
  v_no := (SELECT 'RC-' || m[1] || '-' || m[2] FROM regexp_matches(upper(COALESCE(p_query, '')), '(\d{6})[^0-9]{0,3}(\d{2})') m LIMIT 1);
  IF v_no IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Numéro de colis illisible'); END IF;
  SELECT id INTO v_id FROM public.parcels WHERE parcel_no = v_no;
  IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis ' || v_no); END IF;
  RETURN jsonb_build_object('success', true, 'parcel', public.warehouse_parcel_json(v_id));
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_find_parcel(TEXT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveAtDestination","confirm":false,"danger":false,"label":"Trouver un colis par son numéro (RC-000123-01) vu de l''entrepôt de Douala"}';

-- 4.8 Le client qui se présente (code BZ scanné ou tapé) : ses colis à Douala,
--     par dépôt, avec le devis (payé, ou reste à payer) — et ce qui n'est pas
--     encore là (en vol, en mer, pas pointé).
CREATE OR REPLACE FUNCTION public.warehouse_client_parcels(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q TEXT := TRIM(COALESCE(p_code, '')); v_code TEXT; v_user UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReleaseParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  v_code := (SELECT 'BZ-' || m[1] FROM regexp_matches(upper(v_q), 'BZ[^0-9]{0,3}([1-9][0-9]{5})') m LIMIT 1);
  IF v_code IS NULL AND regexp_replace(v_q, '[^0-9]', '', 'g') ~ '^[1-9][0-9]{5}$' THEN
    v_code := 'BZ-' || regexp_replace(v_q, '[^0-9]', '', 'g');
  END IF;
  IF v_code IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unknown_code', 'code', v_q); END IF;
  SELECT c.user_id INTO v_user FROM public.clients c WHERE c.customer_code = v_code LIMIT 1;
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unknown_code', 'code', v_code); END IF;
  RETURN jsonb_build_object(
    'success', true,
    'client', public.reception_client_card(v_user),
    -- Prêts à être remis : arrivés, pointés, pas remis.
    'ready', COALESCE((
      SELECT jsonb_agg(public.warehouse_parcel_json(p.id) ORDER BY d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE d.client_user_id = v_user AND p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL), '[]'::jsonb),
    -- Pas encore là : en Chine, en vol, en mer, arrivé mais pas pointé, manquant.
    'not_ready', COALESCE((
      SELECT jsonb_agg(public.warehouse_parcel_json(p.id) ORDER BY d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE d.client_user_id = v_user AND p.delivered_at IS NULL AND NOT (p.status = 'arrived' AND p.checked_in_at IS NOT NULL)), '[]'::jsonb),
    -- Les devis concernés, pour encaisser sur place.
    'quotes', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', q.id, 'quote_no', q.quote_no, 'deposit_id', q.deposit_id, 'deposit_no', d.deposit_no, 'status', q.status,
                                                    'total_xaf', q.total_xaf, 'amount_paid_xaf', q.amount_paid_xaf, 'balance_xaf', GREATEST(q.total_xaf - q.amount_paid_xaf, 0), 'invoice_no', q.invoice_no))
      FROM public.parcel_quotes q JOIN public.parcel_deposits d ON d.id = q.deposit_id
      WHERE d.client_user_id = v_user AND EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = d.id AND p.status = 'arrived' AND p.checked_in_at IS NOT NULL AND p.delivered_at IS NULL)), '[]'::jsonb),
    'releases', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'release_no', r.release_no, 'released_at', r.released_at, 'picked_by_name', r.picked_by_name, 'parcel_count', r.parcel_count) ORDER BY r.released_at DESC)
      FROM public.parcel_releases r WHERE r.client_user_id = v_user), '[]'::jsonb)
  );
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_client_parcels(TEXT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReleaseParcels","confirm":false,"danger":false,"label":"Les colis d''un client à l''entrepôt de Douala (prêts, pas encore là, devis à solder)","resolve":{"p_code":"client"}}';

-- 4.9 Le bon de retrait (helper).
CREATE OR REPLACE FUNCTION public.warehouse_release_json(p_release_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', r.id, 'release_no', r.release_no, 'released_at', r.released_at, 'picked_by_name', r.picked_by_name, 'picked_by_phone', r.picked_by_phone,
    'signature_path', r.signature_path, 'note', r.note, 'parcel_count', r.parcel_count,
    'released_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = r.released_by),
    'client', public.reception_client_card(r.client_user_id),
    'parcels', COALESCE((SELECT jsonb_agg(public.warehouse_parcel_json(p.id) ORDER BY p.parcel_no) FROM public.parcels p WHERE p.release_id = r.id), '[]'::jsonb)
  )
  FROM public.parcel_releases r WHERE r.id = p_release_id;
$fn$;
COMMENT ON FUNCTION public.warehouse_release_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReleaseParcels","confirm":false,"danger":false,"label":"Sérialiser un bon de retrait (helper interne)"}';

-- 4.10 Remettre des colis : la remise. BLOQUÉE tant qu'un devis n'est pas
--     soldé. Un bon de retrait BR-000123 avec la signature ; les colis passent
--     « remis » ; un avion dont tout est remis passe DELIVERED.
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

  -- Verrouiller les colis, tous du même client, tous prêts.
  PERFORM 1 FROM public.parcels WHERE id = ANY(p_parcel_ids) FOR UPDATE;
  SELECT count(DISTINCT d.client_user_id), min(d.client_user_id) INTO v_clients, v_client
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
  VALUES (v_client, TRIM(p_picked_by_name), NULLIF(TRIM(p_picked_by_phone), ''), NULLIF(TRIM(p_signature_path), ''), NULLIF(TRIM(p_note), ''), array_length(p_parcel_ids, 1), v_uid)
  RETURNING * INTO v_r;

  UPDATE public.parcels SET status = 'delivered', delivered_at = now(), release_id = v_r.id, updated_at = now() WHERE id = ANY(p_parcel_ids);
  GET DIAGNOSTICS v_n = ROW_COUNT;

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

CREATE OR REPLACE FUNCTION public.warehouse_release_get(p_release_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (public.admin_has_permission(auth.uid(), 'canReleaseParcels') OR public.admin_has_permission(auth.uid(), 'canViewCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parcel_releases WHERE id = p_release_id) THEN RETURN jsonb_build_object('success', false, 'error', 'Bon introuvable'); END IF;
  RETURN jsonb_build_object('success', true, 'release', public.warehouse_release_json(p_release_id));
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_release_get(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReleaseParcels","confirm":false,"danger":false,"label":"Un bon de retrait (colis remis, à qui, signature)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Le reste de la plateforme sait le pointage et la remise
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Le devis se lit aussi par qui encaisse (l'agent de Douala).
CREATE OR REPLACE FUNCTION public.cargo_quote_get(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_id UUID;
BEGIN
  IF NOT (public.admin_has_permission(auth.uid(), 'canViewCargo') OR public.admin_has_permission(auth.uid(), 'canCollectParcelPayments')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT id INTO v_id FROM public.parcel_quotes WHERE deposit_id = p_deposit_id;
  RETURN jsonb_build_object('success', true, 'quote', CASE WHEN v_id IS NULL THEN NULL ELSE public.cargo_quote_json(v_id) END);
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_get(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Le devis d''un dépôt de colis (prix par colis, total, encaissé, état)","resolve":{"p_deposit_id":"deposit"}}';

-- 5.2 Le dépôt : chaque colis dit son pointage et sa remise.
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
    'status',               d.status,
    'received_by',          d.received_by,
    'received_by_name',     (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    'opened_at',            d.opened_at,
    'closed_at',            d.closed_at,
    'parcel_count',         (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_weight_kg',      (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_cbm',            (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'notes',                d.notes,
    'parcels',              COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind,
        'weight_kg', p.weight_kg, 'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'cbm', p.cbm, 'description', p.description, 'courier_waybill', p.courier_waybill,
        'photo_path', p.photo_path, 'status', p.status, 'shipment_id', p.shipment_id,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'air_shipment_id', p.air_shipment_id,
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
        'created_at', p.created_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;
COMMENT ON FUNCTION public.reception_deposit_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis (helper interne)"}';

-- 5.3 L'avion : ses colis disent leur pointage et leur remise.
CREATE OR REPLACE FUNCTION public.cargo_air_json(p_air_id UUID, p_with_parcels BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', a.id, 'awb_number', a.awb_number, 'airline', a.airline, 'flight_no', a.flight_no,
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
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
        'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
        'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
        'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'awb_number', a.awb_number, 'created_at', p.created_at,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'deposit_no', d.deposit_no, 'deposit_id', d.id, 'location', d.location, 'opened_at', d.opened_at,
        'client', public.reception_client_card(d.client_user_id),
        'quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf, 'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no
      ) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
      WHERE p.air_shipment_id = a.id), '[]'::jsonb) ELSE NULL END
  )
  FROM public.air_shipments a WHERE a.id = p_air_id;
$fn$;
COMMENT ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser une expédition aérienne (helper interne)"}';

-- ============================================================================
-- Cargo · Phase 3 — l'expédition aérienne et le départ de Chine
--
-- Le Sea cargo a sa boîte (cargo_shipments : conteneur, B/L, armateur, suivi
-- automatique). L'Air cargo n'avait rien : les colis reçus au bureau restaient
-- « à l'entrepôt » jusqu'à Douala. Ici : l'EXPÉDITION AÉRIENNE — une LTA
-- (lettre de transport aérien / AWB), une compagnie, un vol, une date de
-- départ et une d'arrivée. On y charge des colis (comme dans une boîte), on
-- imprime le MANIFESTE, et on pose les jalons à la main : parti, arrivé.
-- Les colis suivent : chargé → en vol → arrivé → (remis, phase 4).
--
--   1. table air_shipments
--   2. parcels.air_shipment_id + contrainte de cohérence (boîte OU avion)
--   3. trigger : l'avion change de statut → ses colis suivent
--   4. RPC : cargo_air_list / get / create / update / set_status /
--            loadable_parcels / load_parcels / unload_parcel
--   5. reception_deposit_json et cargo_parts_summary savent l'avion
--
-- Idempotent. Suppose 20260921140000_cargo_quote_payments.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. L'expédition aérienne
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.air_shipments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  awb_number      TEXT NOT NULL UNIQUE,              -- la LTA : 000-12345675 (3 chiffres compagnie + 8)
  airline         TEXT,                              -- Ethiopian, Turkish, Kenya Airways…
  flight_no       TEXT,                              -- ET 607
  origin          TEXT NOT NULL DEFAULT 'Guangzhou (CAN)',
  destination     TEXT NOT NULL DEFAULT 'Douala (DLA)',
  -- PLANNED : en préparation, on charge · DEPARTED : parti, en vol · ARRIVED : à Douala · DELIVERED : tout remis
  status          TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','DEPARTED','ARRIVED','DELIVERED')),
  etd             DATE,                              -- départ prévu
  eta             DATE,                              -- arrivée prévue
  departed_at     TIMESTAMPTZ,                       -- jalon réel
  arrived_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  freight_usd     NUMERIC(12,2) CHECK (freight_usd IS NULL OR freight_usd >= 0),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS air_shipments_status_idx ON public.air_shipments (status, etd);

ALTER TABLE public.air_shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS air_shipments_staff_read ON public.air_shipments;
CREATE POLICY air_shipments_staff_read ON public.air_shipments FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Le colis connaît son avion ; boîte OU avion, jamais les deux
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS air_shipment_id UUID REFERENCES public.air_shipments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS parcels_air_shipment_idx ON public.parcels (air_shipment_id) WHERE air_shipment_id IS NOT NULL;

ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_status_shipment_check;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_status_shipment_check CHECK (
  NOT (shipment_id IS NOT NULL AND air_shipment_id IS NOT NULL) AND (
    (shipment_id IS NULL AND air_shipment_id IS NULL AND status IN ('received','stored')) OR
    ((shipment_id IS NOT NULL OR air_shipment_id IS NOT NULL) AND status IN ('loaded','shipped','arrived','delivered'))
  )
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Les colis suivent l'avion
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.parcel_status_for_air(p_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE p_status
    WHEN 'DEPARTED'  THEN 'shipped'
    WHEN 'ARRIVED'   THEN 'arrived'
    WHEN 'DELIVERED' THEN 'delivered'
    ELSE 'loaded'          -- PLANNED : les colis sont réunis, l'avion n'est pas parti
  END
$fn$;

CREATE OR REPLACE FUNCTION public.parcels_follow_air_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_status TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_status := public.parcel_status_for_air(NEW.status);
  UPDATE public.parcels SET status = v_status, updated_at = now()
   WHERE air_shipment_id = NEW.id AND status <> v_status;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS parcels_follow_air_shipment ON public.air_shipments;
CREATE TRIGGER parcels_follow_air_shipment
  AFTER UPDATE OF status ON public.air_shipments
  FOR EACH ROW EXECUTE FUNCTION public.parcels_follow_air_shipment();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC
-- ─────────────────────────────────────────────────────────────────────────

-- 4.1 Sérialiser une expédition (helper) : la fiche, les compteurs, et ses colis
--     avec leur dépôt, leur client et l'état du devis (payé ou non — c'est ce
--     que l'entrepôt de Douala regardera avant de remettre).
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
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg,
        'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm, 'cbm', p.cbm,
        'description', p.description, 'courier_waybill', p.courier_waybill, 'photo_path', p.photo_path,
        'status', p.status, 'shipment_id', p.shipment_id, 'air_shipment_id', p.air_shipment_id, 'awb_number', a.awb_number, 'created_at', p.created_at,
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

-- 4.2 La liste : ce qui se prépare, ce qui vole, ce qui est arrivé — les livrées en dernier.
CREATE OR REPLACE FUNCTION public.cargo_air_list()
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
  RETURN jsonb_build_object('success', true, 'shipments', COALESCE((
    SELECT jsonb_agg(public.cargo_air_json(a.id, false)
      ORDER BY CASE a.status WHEN 'DEPARTED' THEN 0 WHEN 'PLANNED' THEN 1 WHEN 'ARRIVED' THEN 2 ELSE 3 END, COALESCE(a.etd, a.created_at::date) DESC, a.created_at DESC)
    FROM public.air_shipments a), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_air_list() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les expéditions aériennes (LTA, vol, état, colis, poids)"}';

-- 4.3 Une expédition, avec ses colis (le manifeste).
CREATE OR REPLACE FUNCTION public.cargo_air_get(p_air_id UUID)
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
  IF NOT EXISTS (SELECT 1 FROM public.air_shipments WHERE id = p_air_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(p_air_id, true));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_air_get(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Une expédition aérienne et son manifeste (les colis, par client, avec l''état du devis)"}';

-- 4.4 Ouvrir une expédition : la LTA suffit, le reste se complète après.
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
DECLARE v_uid UUID := auth.uid(); v_awb TEXT; v_id UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  v_awb := upper(regexp_replace(COALESCE(p_awb_number, ''), '\s+', '', 'g'));
  IF length(v_awb) < 4 THEN RETURN jsonb_build_object('success', false, 'error', 'Indiquez le numéro de LTA'); END IF;
  IF EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette LTA existe déjà');
  END IF;
  IF p_freight_usd IS NOT NULL AND p_freight_usd < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le fret ne peut pas être négatif'); END IF;
  INSERT INTO public.air_shipments (awb_number, airline, flight_no, etd, eta, origin, destination, freight_usd, notes, created_by)
  VALUES (v_awb, NULLIF(TRIM(p_airline), ''), NULLIF(upper(TRIM(p_flight_no)), ''), p_etd, p_eta,
          COALESCE(NULLIF(TRIM(p_origin), ''), 'Guangzhou (CAN)'), COALESCE(NULLIF(TRIM(p_destination), ''), 'Douala (DLA)'),
          p_freight_usd, NULLIF(TRIM(p_notes), ''), v_uid)
  RETURNING id INTO v_id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'create_air_shipment', 'air_shipment', v_id,
          jsonb_build_object('description', 'Expédition aérienne ouverte : LTA ' || v_awb || COALESCE(' · vol ' || upper(TRIM(p_flight_no)), ''), 'awb_number', v_awb, 'etd', p_etd));
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_id, true));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_air_create(TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Ouvrir une expédition aérienne (LTA, compagnie, vol, dates)"}';

-- 4.5 Corriger la fiche (vol, dates, fret, notes). La LTA aussi, tant que l'avion n'est pas parti.
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
  IF p_awb_number IS NOT NULL THEN
    IF v_a.status <> 'PLANNED' THEN RETURN jsonb_build_object('success', false, 'error', 'La LTA ne change plus une fois l''avion parti'); END IF;
    v_awb := upper(regexp_replace(p_awb_number, '\s+', '', 'g'));
    IF length(v_awb) < 4 THEN RETURN jsonb_build_object('success', false, 'error', 'Numéro de LTA trop court'); END IF;
    IF EXISTS (SELECT 1 FROM public.air_shipments WHERE awb_number = v_awb AND id <> v_a.id) THEN RETURN jsonb_build_object('success', false, 'error', 'Cette LTA existe déjà'); END IF;
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
COMMENT ON FUNCTION public.cargo_air_update(UUID, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Corriger une expédition aérienne (vol, dates, fret, notes)"}';

-- 4.6 Les jalons, à la main : parti (DEPARTED), arrivé (ARRIVED). Un retour en
--     arrière (l'avion n'est finalement pas parti) est permis d'un cran, et
--     journalisé. DELIVERED se pose depuis l'entrepôt (phase 4), pas d'ici.
CREATE OR REPLACE FUNCTION public.cargo_air_set_status(p_air_id UUID, p_status TEXT, p_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_a public.air_shipments; v_at TIMESTAMPTZ := COALESCE(p_at, now());
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
  -- Un cran à la fois, dans les deux sens.
  IF (v_a.status = 'PLANNED' AND p_status = 'ARRIVED') OR (v_a.status = 'ARRIVED' AND p_status = 'PLANNED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un jalon à la fois : ' || CASE WHEN p_status = 'ARRIVED' THEN 'marquez d''abord le départ' ELSE 'revenez d''abord à « parti »' END);
  END IF;
  UPDATE public.air_shipments SET
    status      = p_status,
    departed_at = CASE p_status WHEN 'DEPARTED' THEN v_at WHEN 'PLANNED' THEN NULL ELSE departed_at END,
    arrived_at  = CASE p_status WHEN 'ARRIVED' THEN v_at ELSE NULL END,
    updated_at  = now()
  WHERE id = v_a.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_shipment_status', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'LTA ' || v_a.awb_number || ' : ' || v_a.status || ' → ' || p_status, 'awb_number', v_a.awb_number, 'from', v_a.status, 'to', p_status, 'at', v_at));
  RETURN jsonb_build_object('success', true, 'shipment', public.cargo_air_json(v_a.id, true));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_air_set_status(UUID, TEXT, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Poser un jalon sur une expédition aérienne : parti, arrivé (les colis suivent)"}';

-- 4.7 Ce qu'on peut mettre dans l'avion : tout colis reçu qui n'est ni dans une
--     boîte ni dans un avion — le bureau (Air cargo) en premier, l'entrepôt ensuite.
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
    WHERE p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.status IN ('received','stored') AND d.status <> 'cancelled'
  ), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_air_loadable_parcels(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les colis reçus qu''on peut mettre dans une expédition aérienne"}';

-- 4.8 Charger des colis dans l'avion.
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
     WHERE p.id = ANY(p_parcel_ids) AND p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.status IN ('received','stored')
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
COMMENT ON FUNCTION public.cargo_air_load_parcels(UUID, UUID[]) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Charger des colis reçus dans une expédition aérienne"}';

-- 4.9 Retirer un colis de l'avion, tant qu'il n'est pas parti.
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
  SELECT * INTO v_a FROM public.air_shipments WHERE id = v_p.air_shipment_id;
  IF v_a.status <> 'PLANNED' THEN RETURN jsonb_build_object('success', false, 'error', 'L''avion est parti : le colis ne se retire plus'); END IF;
  UPDATE public.parcels SET air_shipment_id = NULL, status = 'received', updated_at = now() WHERE id = v_p.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_unload_parcel', 'air_shipment', v_a.id,
          jsonb_build_object('description', 'Colis ' || v_p.parcel_no || ' retiré de la LTA ' || v_a.awb_number, 'parcel_id', v_p.id, 'parcel_no', v_p.parcel_no));
  RETURN jsonb_build_object('success', true);
END;
$fn$;
COMMENT ON FUNCTION public.cargo_air_unload_parcel(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Retirer un colis d''une expédition aérienne pas encore partie"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Le reste de la plateforme sait l'avion
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Le dépôt : chaque colis dit sa boîte OU sa LTA.
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
        'created_at', p.created_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;
COMMENT ON FUNCTION public.reception_deposit_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis (helper interne)"}';

-- 5.2 L'entrée du module : Container · Avion · Réception.
CREATE OR REPLACE FUNCTION public.cargo_parts_summary()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN NOT public.admin_has_permission(auth.uid(), 'canViewCargo')
    THEN jsonb_build_object('success', false, 'error', 'Accès non autorisé')
    ELSE jsonb_build_object(
      'success', true,
      'containers', (SELECT count(*) FROM public.cargo_shipments WHERE status <> 'DELIVERED'),
      'containers_at_sea', (SELECT count(*) FROM public.cargo_shipments WHERE status = 'AT_SEA'),
      'air_open', (SELECT count(*) FROM public.air_shipments WHERE status <> 'DELIVERED'),
      'air_in_flight', (SELECT count(*) FROM public.air_shipments WHERE status = 'DEPARTED'),
      'parcels_waiting', (SELECT count(*) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND d.status <> 'cancelled'),
      'deposits_pending', (SELECT count(*) FROM public.parcel_deposits WHERE client_user_id IS NULL AND status <> 'cancelled'),
      'deposits_today', (SELECT count(*) FROM public.parcel_deposits WHERE status <> 'cancelled' AND (opened_at AT TIME ZONE 'Asia/Shanghai')::date = (now() AT TIME ZONE 'Asia/Shanghai')::date)
    ) END
$fn$;
COMMENT ON FUNCTION public.cargo_parts_summary() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Le résumé Cargo : conteneurs suivis, expéditions aériennes, colis à l''entrepôt, dépôts à attribuer"}';

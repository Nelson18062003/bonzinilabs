-- ============================================================
-- RÉCEPTION DES COLIS — le poste « réceptionnaire » (Guangzhou)
--
-- Un colis arrive à l'entrepôt (Sea cargo) ou au bureau (Air cargo) : livré
-- par un transporteur chinois, apporté par le client lui-même après ses
-- achats au marché, par quelqu'un pour lui, ou ramené par Bonzini. Le
-- réceptionnaire ouvre un DÉPÔT (un client, un lieu, une date, lui), y
-- enregistre les COLIS un par un (photo, poids, dimensions, description),
-- puis ferme le dépôt : reçu au client, étiquettes à imprimer.
--
-- Ce fichier :
--   1. le rôle `receptionist` + deux permissions (canReceiveParcels,
--      canRegisterClients) dans admin_has_permission — miroir EXACT de
--      ROLE_PERMERMISSIONS (src/contexts/AdminAuthContext.tsx) ;
--   2. les tables parcel_deposits (RC-000123) et parcels (RC-000123-01) ;
--   3. le seau de photos ;
--   4. les RPC du réceptionnaire, toutes SECURITY DEFINER et gardées par
--      admin_has_permission(uid, 'canReceiveParcels') ; celles qui touchent
--      un dépôt vérifient qu'il est à l'appelant (ou canManageCargo) ;
--   5. admin_create_client / admin_set_client_phones ouverts à
--      canRegisterClients (et fermés à is_admin seul, règle du projet).
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Rôle + permissions
-- ─────────────────────────────────────────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';

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
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tables
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.parcel_deposit_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.parcel_deposits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Le numéro lisible du reçu : RC-000123. Jamais réutilisé.
  deposit_no           TEXT NOT NULL UNIQUE DEFAULT ('RC-' || lpad(nextval('public.parcel_deposit_no_seq')::text, 6, '0')),
  -- NULL tant qu'on ne sait pas à qui est le colis (« en attente d'attribution »).
  client_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Où le colis est entré : entrepôt (Sea cargo) ou bureau (Air cargo).
  location             TEXT NOT NULL CHECK (location IN ('warehouse','office')),
  -- Qui l'a apporté : transporteur chinois, le client lui-même, quelqu'un pour lui, Bonzini.
  brought_by           TEXT NOT NULL DEFAULT 'courier' CHECK (brought_by IN ('courier','client','representative','pickup')),
  representative_name  TEXT,
  representative_phone TEXT,
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  received_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  opened_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at            TIMESTAMPTZ,
  -- Totaux figés à la fermeture (recalculés depuis parcels).
  parcel_count         INTEGER NOT NULL DEFAULT 0,
  total_weight_kg      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_cbm            NUMERIC(10,4) NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcel_deposits_client_idx   ON public.parcel_deposits (client_user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS parcel_deposits_received_idx ON public.parcel_deposits (received_by, opened_at DESC);
CREATE INDEX IF NOT EXISTS parcel_deposits_pending_idx  ON public.parcel_deposits (opened_at DESC) WHERE client_user_id IS NULL AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.parcels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id      UUID NOT NULL REFERENCES public.parcel_deposits(id) ON DELETE CASCADE,
  -- 1, 2, 3… dans le dépôt ; le numéro lisible est RC-000123-01.
  seq             INTEGER NOT NULL,
  parcel_no       TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL DEFAULT 'carton' CHECK (kind IN ('carton','bag','bale','roll','pallet','other')),
  weight_kg       NUMERIC(10,2) CHECK (weight_kg IS NULL OR weight_kg >= 0),
  length_cm       NUMERIC(8,1)  CHECK (length_cm IS NULL OR length_cm >= 0),
  width_cm        NUMERIC(8,1)  CHECK (width_cm  IS NULL OR width_cm  >= 0),
  height_cm       NUMERIC(8,1)  CHECK (height_cm IS NULL OR height_cm >= 0),
  -- Le volume, calculé une fois pour toutes : le Sea cargo se facture au m³.
  cbm             NUMERIC(10,4) GENERATED ALWAYS AS (
                    CASE WHEN length_cm IS NULL OR width_cm IS NULL OR height_cm IS NULL THEN NULL
                         ELSE round((length_cm * width_cm * height_cm) / 1000000.0, 4) END
                  ) STORED,
  description     TEXT,
  -- Le bordereau du transporteur chinois (SF, YTO, ZTO…) : identifie le carton même sans étiquette Bonzini.
  courier_waybill TEXT,
  -- Chemin dans le seau parcel-photos.
  photo_path      TEXT,
  status          TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','stored','loaded','shipped','arrived','delivered')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deposit_id, seq)
);
CREATE INDEX IF NOT EXISTS parcels_deposit_idx ON public.parcels (deposit_id, seq);
CREATE INDEX IF NOT EXISTS parcels_waybill_idx ON public.parcels (courier_waybill) WHERE courier_waybill IS NOT NULL;

-- RLS : lecture par le staff habilité (réception ou cargo) et par le client
-- pour ses propres dépôts ; AUCUNE écriture directe — tout passe par les RPC.
ALTER TABLE public.parcel_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parcel_deposits_staff_read ON public.parcel_deposits;
CREATE POLICY parcel_deposits_staff_read ON public.parcel_deposits FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canReceiveParcels') OR public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS parcel_deposits_client_read ON public.parcel_deposits;
CREATE POLICY parcel_deposits_client_read ON public.parcel_deposits FOR SELECT TO authenticated
  USING (client_user_id = auth.uid() AND status = 'closed');

DROP POLICY IF EXISTS parcels_staff_read ON public.parcels;
CREATE POLICY parcels_staff_read ON public.parcels FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canReceiveParcels') OR public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS parcels_client_read ON public.parcels;
CREATE POLICY parcels_client_read ON public.parcels FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parcel_deposits d WHERE d.id = parcels.deposit_id AND d.client_user_id = auth.uid() AND d.status = 'closed'));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Les photos des colis
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('parcel-photos', 'parcel-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Reception can upload parcel photos" ON storage.objects;
CREATE POLICY "Reception can upload parcel photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parcel-photos' AND public.admin_has_permission(auth.uid(), 'canReceiveParcels'));
DROP POLICY IF EXISTS "Staff can view parcel photos" ON storage.objects;
CREATE POLICY "Staff can view parcel photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parcel-photos' AND (public.admin_has_permission(auth.uid(), 'canReceiveParcels') OR public.admin_has_permission(auth.uid(), 'canViewCargo')));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Helpers internes
-- ─────────────────────────────────────────────────────────────────────────

-- La fiche d'un client telle que le réceptionnaire a le droit de la voir :
-- l'identité et les contacts, jamais un solde.
CREATE OR REPLACE FUNCTION public.reception_client_card(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN c.user_id IS NULL THEN NULL ELSE jsonb_build_object(
    'user_id',       c.user_id,
    'customer_code', c.customer_code,
    'first_name',    c.first_name,
    'last_name',     c.last_name,
    'phone',         COALESCE(c.phone_e164, c.phone),
    'email',         c.email,
    'company_name',  c.company_name,
    'city',          c.city,
    'country',       c.country
  ) END
  FROM public.clients c
  WHERE c.user_id = p_user_id;
$fn$;
COMMENT ON FUNCTION public.reception_client_card(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Fiche identité d''un client pour la réception (helper interne)"}';

-- Un dépôt et ses colis, tel que les écrans le lisent.
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
        'photo_path', p.photo_path, 'status', p.status, 'created_at', p.created_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;
COMMENT ON FUNCTION public.reception_deposit_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis (helper interne)"}';

-- Le dépôt est-il modifiable par l'appelant ? À lui et ouvert, ou cargo.
CREATE OR REPLACE FUNCTION public.reception_can_edit(p_deposit public.parcel_deposits, p_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
  SELECT p_deposit.status = 'open'
     AND (p_deposit.received_by = p_uid OR public.admin_has_permission(p_uid, 'canManageCargo'));
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPC du réceptionnaire
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Chercher un client — par code BZ, par téléphone, par nom. Identité seule.
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
  -- « BZ-482913 », « bz 482913 », « https://bonzinilabs.com/c/BZ-482913 », « 482913 »
  v_code := (SELECT 'BZ-' || m[1] FROM regexp_matches(upper(v_q), 'BZ[^0-9]{0,3}([1-9][0-9]{5})') m LIMIT 1);
  IF v_code IS NULL AND v_digits ~ '^[1-9][0-9]{5}$' THEN v_code := 'BZ-' || v_digits; END IF;

  SELECT COALESCE(jsonb_agg(public.reception_client_card(c.user_id)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT c.user_id
    FROM public.clients c
    WHERE (v_code IS NOT NULL AND c.customer_code = v_code)
       OR (length(v_digits) >= 6 AND regexp_replace(COALESCE(c.phone_e164, c.phone, ''), '[^0-9]', '', 'g') LIKE '%' || v_digits || '%')
       OR (length(v_digits) < 6 AND (
             (c.first_name || ' ' || c.last_name) ILIKE '%' || v_q || '%'
          OR (c.last_name || ' ' || c.first_name) ILIKE '%' || v_q || '%'
          OR COALESCE(c.company_name, '') ILIKE '%' || v_q || '%'))
    ORDER BY (c.customer_code = v_code) DESC, c.last_name, c.first_name
    LIMIT 8
  ) c;
  RETURN jsonb_build_object('success', true, 'clients', v_rows);
END;
$fn$;
COMMENT ON FUNCTION public.reception_search_clients(TEXT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Chercher un client pour la réception d''un colis (identité seulement)"}';

-- 5.2 Ouvrir un dépôt. Le client peut manquer (colis orphelin).
CREATE OR REPLACE FUNCTION public.reception_open_deposit(
  p_location TEXT,
  p_client_user_id UUID DEFAULT NULL,
  p_brought_by TEXT DEFAULT 'courier',
  p_representative_name TEXT DEFAULT NULL,
  p_representative_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_location NOT IN ('warehouse','office') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lieu inconnu');
  END IF;
  IF p_brought_by NOT IN ('courier','client','representative','pickup') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode d''arrivée inconnu');
  END IF;
  IF p_client_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_client_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;

  INSERT INTO public.parcel_deposits (client_user_id, location, brought_by, representative_name, representative_phone, received_by)
  VALUES (p_client_user_id, p_location, p_brought_by, NULLIF(TRIM(p_representative_name), ''), NULLIF(TRIM(p_representative_phone), ''), v_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'open_parcel_deposit', 'parcel_deposit', v_id,
          jsonb_build_object('description', 'Ouverture d''un dépôt de colis', 'client_user_id', p_client_user_id, 'location', p_location, 'brought_by', p_brought_by));

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_open_deposit(TEXT, UUID, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Ouvrir un dépôt de colis à la réception","resolve":{"p_client_user_id":"client"}}';

-- 5.3 Ajouter un colis (ou N identiques). Le poids et les dimensions peuvent
--     manquer — le dépôt sera marqué « incomplet », mais jamais bloqué.
CREATE OR REPLACE FUNCTION public.reception_add_parcel(
  p_deposit_id UUID,
  p_kind TEXT DEFAULT 'carton',
  p_weight_kg NUMERIC DEFAULT NULL,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_courier_waybill TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL,
  p_copies INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_seq INTEGER;
  v_i   INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF NOT public.reception_can_edit(v_dep, v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est fermé ou ne vous appartient pas');
  END IF;
  IF p_kind NOT IN ('carton','bag','bale','roll','pallet','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de colis inconnu');
  END IF;
  IF p_copies IS NULL OR p_copies < 1 OR p_copies > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nombre de colis invalide (1 à 200)');
  END IF;
  IF COALESCE(p_weight_kg, 0) < 0 OR COALESCE(p_length_cm, 0) < 0 OR COALESCE(p_width_cm, 0) < 0 OR COALESCE(p_height_cm, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poids et dimensions doivent être positifs');
  END IF;

  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.parcels WHERE deposit_id = v_dep.id;
  FOR v_i IN 1..p_copies LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.parcels (deposit_id, seq, parcel_no, kind, weight_kg, length_cm, width_cm, height_cm, description, courier_waybill, photo_path)
    VALUES (v_dep.id, v_seq, v_dep.deposit_no || '-' || lpad(v_seq::text, 2, '0'), p_kind,
            p_weight_kg, p_length_cm, p_width_cm, p_height_cm,
            NULLIF(TRIM(p_description), ''), NULLIF(TRIM(p_courier_waybill), ''), NULLIF(TRIM(p_photo_path), ''));
  END LOOP;
  UPDATE public.parcel_deposits SET updated_at = now() WHERE id = v_dep.id;

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_add_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, INTEGER) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Ajouter un colis (poids, dimensions, description) à un dépôt"}';

-- 5.4 Retirer un colis d'un dépôt encore ouvert (erreur de saisie).
CREATE OR REPLACE FUNCTION public.reception_remove_parcel(p_parcel_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_par public.parcels;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  IF NOT public.reception_can_edit(v_dep, v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est fermé ou ne vous appartient pas');
  END IF;
  DELETE FROM public.parcels WHERE id = v_par.id;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_remove_parcel(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Retirer un colis d''un dépôt ouvert"}';

-- 5.5 Fermer le dépôt : totaux figés, reçu, journal.
CREATE OR REPLACE FUNCTION public.reception_close_deposit(p_deposit_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_count INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF NOT public.reception_can_edit(v_dep, v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est déjà fermé ou ne vous appartient pas');
  END IF;
  SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_count, v_kg, v_cbm
  FROM public.parcels WHERE deposit_id = v_dep.id;
  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun colis dans ce dépôt');
  END IF;

  UPDATE public.parcel_deposits
     SET status = 'closed', closed_at = now(), parcel_count = v_count, total_weight_kg = v_kg, total_cbm = v_cbm,
         notes = COALESCE(NULLIF(TRIM(p_notes), ''), notes), updated_at = now()
   WHERE id = v_dep.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'close_parcel_deposit', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'Dépôt ' || v_dep.deposit_no || ' fermé : ' || v_count || ' colis, ' || v_kg || ' kg, ' || v_cbm || ' m³',
                             'deposit_no', v_dep.deposit_no, 'client_user_id', v_dep.client_user_id,
                             'parcel_count', v_count, 'total_weight_kg', v_kg, 'total_cbm', v_cbm));

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_close_deposit(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Terminer un dépôt de colis (reçu au client)"}';

-- 5.6 Attribuer (ou réattribuer) un dépôt à un client — pour les colis orphelins.
CREATE OR REPLACE FUNCTION public.reception_assign_client(p_deposit_id UUID, p_client_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt annulé'); END IF;
  -- Un dépôt déjà attribué ne change de client que par un rôle cargo.
  IF v_dep.client_user_id IS NOT NULL AND NOT public.admin_has_permission(v_uid, 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est déjà attribué');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_client_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  UPDATE public.parcel_deposits SET client_user_id = p_client_user_id, updated_at = now() WHERE id = v_dep.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'assign_parcel_deposit', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'Dépôt ' || v_dep.deposit_no || ' attribué', 'previous_client_user_id', v_dep.client_user_id, 'client_user_id', p_client_user_id));
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_assign_client(UUID, UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Attribuer un dépôt de colis en attente à un client","resolve":{"p_client_user_id":"client"}}';

-- 5.7 Lire un dépôt.
CREATE OR REPLACE FUNCTION public.reception_get_deposit(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (public.admin_has_permission(auth.uid(), 'canReceiveParcels') OR public.admin_has_permission(auth.uid(), 'canViewCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parcel_deposits WHERE id = p_deposit_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(p_deposit_id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_get_deposit(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Lire un dépôt de colis et ses colis"}';

-- 5.8 Ma journée : mes dépôts du jour, mes totaux, les colis en attente.
CREATE OR REPLACE FUNCTION public.reception_my_day(p_day DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_day DATE := COALESCE(p_day, (now() AT TIME ZONE 'Asia/Shanghai')::date);
  v_from TIMESTAMPTZ := (v_day::timestamp AT TIME ZONE 'Asia/Shanghai');
  v_to   TIMESTAMPTZ := ((v_day + 1)::timestamp AT TIME ZONE 'Asia/Shanghai');
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'day', v_day,
    'stats', (
      SELECT jsonb_build_object(
        'deposits',  count(*),
        'parcels',   COALESCE(sum((SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id)), 0),
        'weight_kg', COALESCE(sum((SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.deposit_id = d.id)), 0),
        'cbm',       COALESCE(sum((SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.deposit_id = d.id)), 0),
        'open',      count(*) FILTER (WHERE d.status = 'open')
      )
      FROM public.parcel_deposits d
      WHERE d.received_by = v_uid AND d.opened_at >= v_from AND d.opened_at < v_to AND d.status <> 'cancelled'
    ),
    'pending', (SELECT count(*) FROM public.parcel_deposits d WHERE d.client_user_id IS NULL AND d.status <> 'cancelled'),
    'deposits', COALESCE((
      SELECT jsonb_agg(public.reception_deposit_json(d.id) ORDER BY d.opened_at DESC)
      FROM public.parcel_deposits d
      WHERE d.received_by = v_uid AND d.opened_at >= v_from AND d.opened_at < v_to AND d.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$fn$;
COMMENT ON FUNCTION public.reception_my_day(DATE) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Ma journée de réception : dépôts, colis, kilos, m³"}';

-- 5.9 Les dépôts en attente d'attribution (tous lieux, tous réceptionnaires).
CREATE OR REPLACE FUNCTION public.reception_pending_deposits()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'deposits', COALESCE((
    SELECT jsonb_agg(public.reception_deposit_json(d.id) ORDER BY d.opened_at DESC)
    FROM public.parcel_deposits d
    WHERE d.client_user_id IS NULL AND d.status <> 'cancelled'
  ), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.reception_pending_deposits() IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Les colis reçus en attente d''attribution à un client"}';

-- 5.10 Côté admin : vue d'ensemble par réceptionnaire, sur une période.
CREATE OR REPLACE FUNCTION public.reception_overview(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
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
  RETURN jsonb_build_object(
    'success', true,
    'by_receptionist', COALESCE((
      SELECT jsonb_agg(row_to_json(r)) FROM (
        SELECT d.received_by,
               (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by) AS name,
               count(*) AS deposits,
               COALESCE(sum((SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id)), 0) AS parcels,
               COALESCE(sum((SELECT COALESCE(sum(p.weight_kg),0) FROM public.parcels p WHERE p.deposit_id = d.id)), 0) AS weight_kg,
               COALESCE(sum((SELECT COALESCE(sum(p.cbm),0) FROM public.parcels p WHERE p.deposit_id = d.id)), 0) AS cbm,
               count(*) FILTER (WHERE d.client_user_id IS NULL) AS pending,
               COALESCE(sum((SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id AND (p.weight_kg IS NULL OR p.cbm IS NULL OR p.photo_path IS NULL))), 0) AS incomplete
        FROM public.parcel_deposits d
        WHERE d.opened_at >= p_from AND d.opened_at < p_to AND d.status <> 'cancelled'
        GROUP BY d.received_by
        ORDER BY deposits DESC
      ) r), '[]'::jsonb),
    'deposits', COALESCE((
      SELECT jsonb_agg(public.reception_deposit_json(d.id) ORDER BY d.opened_at DESC)
      FROM public.parcel_deposits d
      WHERE d.opened_at >= p_from AND d.opened_at < p_to AND d.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$fn$;
COMMENT ON FUNCTION public.reception_overview(TIMESTAMPTZ, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Vue d''ensemble de la réception des colis (par réceptionnaire, dépôts)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Créer un client depuis la réception : les deux RPC existantes passent
--    de « is_admin seul » à canRegisterClients (super_admin, ops, support,
--    customer_success, receptionist). Les corps sont inchangés — on ne
--    remplace que le garde-fou, par une fonction enveloppe pour ne pas
--    recopier 150 lignes de logique de création.
-- ─────────────────────────────────────────────────────────────────────────
DO $do$
DECLARE v_src TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_create_client';
  IF v_src IS NOT NULL AND v_src LIKE '%public.is_admin(auth.uid())%' THEN
    v_src := replace(v_src, 'public.is_admin(auth.uid())', 'public.admin_has_permission(auth.uid(), ''canRegisterClients'')');
    EXECUTE v_src;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_set_client_phones';
  IF v_src IS NOT NULL AND v_src LIKE '%admin_has_permission(v_admin_id, ''canManageUsers'')%' THEN
    v_src := replace(v_src,
      'public.admin_has_permission(v_admin_id, ''canManageUsers'')',
      '(public.admin_has_permission(v_admin_id, ''canManageUsers'') OR public.admin_has_permission(v_admin_id, ''canRegisterClients''))');
    EXECUTE v_src;
  END IF;
END
$do$;

-- ============================================================================
-- À passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) : copie exacte de
-- supabase/migrations/20260922090000_cargo_suppliers_accounts.sql. Idempotent.
-- Suppose migrations/20260921_warehouse_simplify.sql (phase 6) déjà passé.
-- ============================================================================
-- Cargo · Phase 7 — le fournisseur du dépôt, les comptes, la carte client
--
-- Ce que Tina relève sur son bon d'entrée papier et que l'app ne savait pas
-- garder : LE FOURNISSEUR (société, contact, téléphone, email, WeChat,
-- adresse). Un fournisseur par dépôt, comme sur son bon. Et les COMPTES :
-- PRC, Simon, Fabrice, Nkenkome, 2L — des gros clients qui regroupent leurs
-- propres clients dans notre entrepôt et chargent leurs propres conteneurs.
-- Un client peut appartenir à un compte ; la carte client le dit partout
-- (réception, étiquette interne, Douala).
--
--   1. parcel_deposits : le fournisseur
--   2. cargo_accounts + clients.cargo_account_id
--   3. reception_client_card (helper) dit le compte
--   4. reception_open_deposit prend le fournisseur ; reception_set_supplier ;
--      reception_client_suppliers (la mémoire des fournisseurs d'un client)
--   5. reception_deposit_json dit le fournisseur
--   6. RPC des comptes : liste, création/édition, rattachement d'un client
--   7. cargo_account_clients : les clients d'un compte
--
-- Idempotent. Suppose 20260921180000_warehouse_simplify.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le fournisseur du dépôt
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.parcel_deposits
  ADD COLUMN IF NOT EXISTS supplier_kind    TEXT CHECK (supplier_kind IN ('supplier','buying_agent')),
  ADD COLUMN IF NOT EXISTS supplier_name    TEXT,
  ADD COLUMN IF NOT EXISTS supplier_contact TEXT,
  ADD COLUMN IF NOT EXISTS supplier_phone   TEXT,
  ADD COLUMN IF NOT EXISTS supplier_email   TEXT,
  ADD COLUMN IF NOT EXISTS supplier_wechat  TEXT,
  ADD COLUMN IF NOT EXISTS supplier_address TEXT;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les comptes
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargo_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  -- Le code court que Tina écrit sur ses fichiers : A1, B1, D1…
  code          TEXT,
  contact_name  TEXT,
  contact_phone TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cargo_accounts_name_key ON public.cargo_accounts (lower(name));
ALTER TABLE public.cargo_accounts ENABLE ROW LEVEL SECURITY;
-- Aucune politique : la table ne se lit et ne s'écrit que par les RPC ci-dessous.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cargo_account_id UUID REFERENCES public.cargo_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clients_cargo_account_idx ON public.clients (cargo_account_id) WHERE cargo_account_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. La carte client dit son compte (partout où elle est lue)
-- ─────────────────────────────────────────────────────────────────────────
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
    'country',       c.country,
    'account_id',    a.id,
    'account_name',  a.name,
    'account_code',  a.code
  ) END
  FROM public.clients c LEFT JOIN public.cargo_accounts a ON a.id = c.cargo_account_id
  WHERE c.user_id = p_user_id;
$fn$;
COMMENT ON FUNCTION public.reception_client_card(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Fiche identité d''un client pour la réception, avec son compte (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_client_card(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_client_card(UUID) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Ouvrir un dépôt avec son fournisseur ; le poser ou le corriger après ;
--    la mémoire des fournisseurs d'un client
-- ─────────────────────────────────────────────────────────────────────────
-- Une seule signature : l'ancienne est retirée (deux surcharges rendraient
-- l'appel PostgREST ambigu).
DROP FUNCTION IF EXISTS public.reception_open_deposit(TEXT, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.reception_open_deposit(
  p_location TEXT,
  p_client_user_id UUID DEFAULT NULL,
  p_brought_by TEXT DEFAULT 'courier',
  p_representative_name TEXT DEFAULT NULL,
  p_representative_phone TEXT DEFAULT NULL,
  p_supplier_kind TEXT DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_supplier_contact TEXT DEFAULT NULL,
  p_supplier_phone TEXT DEFAULT NULL,
  p_supplier_email TEXT DEFAULT NULL,
  p_supplier_wechat TEXT DEFAULT NULL,
  p_supplier_address TEXT DEFAULT NULL
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
  IF p_supplier_kind IS NOT NULL AND p_supplier_kind NOT IN ('supplier','buying_agent') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de fournisseur inconnu');
  END IF;
  IF p_client_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_client_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;

  INSERT INTO public.parcel_deposits (client_user_id, location, brought_by, representative_name, representative_phone, received_by,
                                      supplier_kind, supplier_name, supplier_contact, supplier_phone, supplier_email, supplier_wechat, supplier_address)
  VALUES (p_client_user_id, p_location, p_brought_by, NULLIF(TRIM(p_representative_name), ''), NULLIF(TRIM(p_representative_phone), ''), v_uid,
          CASE WHEN NULLIF(TRIM(p_supplier_name), '') IS NULL THEN NULL ELSE COALESCE(p_supplier_kind, 'supplier') END,
          NULLIF(TRIM(p_supplier_name), ''), NULLIF(TRIM(p_supplier_contact), ''), NULLIF(TRIM(p_supplier_phone), ''),
          NULLIF(TRIM(p_supplier_email), ''), NULLIF(TRIM(p_supplier_wechat), ''), NULLIF(TRIM(p_supplier_address), ''))
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'open_parcel_deposit', 'parcel_deposit', v_id,
          jsonb_build_object('description', 'Ouverture d''un dépôt de colis', 'client_user_id', p_client_user_id, 'location', p_location, 'brought_by', p_brought_by, 'supplier', NULLIF(TRIM(p_supplier_name), '')));

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_open_deposit(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Ouvrir un dépôt de colis à la réception (avec le fournisseur)","resolve":{"p_client_user_id":"client"}}';

-- Poser ou corriger le fournisseur d'un dépôt ouvert (le réceptionnaire qui l'a ouvert, ou canManageCargo).
CREATE OR REPLACE FUNCTION public.reception_set_supplier(
  p_deposit_id UUID,
  p_supplier_kind TEXT DEFAULT 'supplier',
  p_supplier_name TEXT DEFAULT NULL,
  p_supplier_contact TEXT DEFAULT NULL,
  p_supplier_phone TEXT DEFAULT NULL,
  p_supplier_email TEXT DEFAULT NULL,
  p_supplier_wechat TEXT DEFAULT NULL,
  p_supplier_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_d public.parcel_deposits;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_d FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_d.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  -- Fermé : seule l'équipe cargo corrige encore (le réceptionnaire ne réécrit pas un dépôt clos).
  IF NOT (public.reception_can_edit(v_d, v_uid) OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne peut plus être modifié');
  END IF;
  IF p_supplier_kind IS NOT NULL AND p_supplier_kind NOT IN ('supplier','buying_agent') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de fournisseur inconnu');
  END IF;
  UPDATE public.parcel_deposits SET
    supplier_kind    = CASE WHEN NULLIF(TRIM(p_supplier_name), '') IS NULL THEN NULL ELSE COALESCE(p_supplier_kind, 'supplier') END,
    supplier_name    = NULLIF(TRIM(p_supplier_name), ''),
    supplier_contact = NULLIF(TRIM(p_supplier_contact), ''),
    supplier_phone   = NULLIF(TRIM(p_supplier_phone), ''),
    supplier_email   = NULLIF(TRIM(p_supplier_email), ''),
    supplier_wechat  = NULLIF(TRIM(p_supplier_wechat), ''),
    supplier_address = NULLIF(TRIM(p_supplier_address), ''),
    updated_at = now()
  WHERE id = v_d.id;
  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_d.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_set_supplier(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Poser ou corriger le fournisseur d''un dépôt de colis"}';

-- La mémoire : les fournisseurs déjà vus pour ce client, du plus récent au plus ancien.
CREATE OR REPLACE FUNCTION public.reception_client_suppliers(p_user_id UUID, p_limit INTEGER DEFAULT 8)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canReceiveParcels') OR public.admin_has_permission(v_uid, 'canViewCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'suppliers', COALESCE((
    SELECT jsonb_agg(row ORDER BY (row->>'last_at') DESC) FROM (
      SELECT DISTINCT ON (lower(d.supplier_name), COALESCE(d.supplier_phone, ''))
        jsonb_build_object('kind', d.supplier_kind, 'name', d.supplier_name, 'contact', d.supplier_contact, 'phone', d.supplier_phone,
                           'email', d.supplier_email, 'wechat', d.supplier_wechat, 'address', d.supplier_address, 'last_at', d.opened_at) AS row
      FROM public.parcel_deposits d
      WHERE d.client_user_id = p_user_id AND d.supplier_name IS NOT NULL
      ORDER BY lower(d.supplier_name), COALESCE(d.supplier_phone, ''), d.opened_at DESC
    ) s LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 30))
  ), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.reception_client_suppliers(UUID, INTEGER) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Les fournisseurs déjà vus pour un client (mémoire de la réception)","resolve":{"p_user_id":"client"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Le dépôt dit son fournisseur
-- ─────────────────────────────────────────────────────────────────────────
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
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis, avec son fournisseur (helper interne)"}';
REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_deposit_json(UUID) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Les comptes : lire, créer ou corriger, rattacher un client
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_account_list(p_include_inactive BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canViewClients') OR public.admin_has_permission(v_uid, 'canReceiveParcels') OR public.admin_has_permission(v_uid, 'canViewCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'accounts', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'code', a.code, 'contact_name', a.contact_name, 'contact_phone', a.contact_phone, 'notes', a.notes, 'is_active', a.is_active,
      'client_count', (SELECT count(*) FROM public.clients c WHERE c.cargo_account_id = a.id),
      'parcels_waiting', (SELECT count(*) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id JOIN public.clients c ON c.user_id = d.client_user_id
                          WHERE c.cargo_account_id = a.id AND p.status IN ('received','stored')),
      'created_at', a.created_at
    ) ORDER BY a.name)
    FROM public.cargo_accounts a WHERE p_include_inactive OR a.is_active), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_account_list(BOOLEAN) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Les comptes cargo (gros clients qui regroupent leurs propres clients)"}';

CREATE OR REPLACE FUNCTION public.cargo_account_upsert(
  p_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_code TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_id UUID; v_name TEXT := NULLIF(TRIM(p_name), '');
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canEditClients') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_name IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Le nom du compte est obligatoire'); END IF;
  IF p_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.cargo_accounts WHERE lower(name) = lower(v_name)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Un compte porte déjà ce nom');
    END IF;
    INSERT INTO public.cargo_accounts (name, code, contact_name, contact_phone, notes, is_active, created_by)
    VALUES (v_name, NULLIF(TRIM(p_code), ''), NULLIF(TRIM(p_contact_name), ''), NULLIF(TRIM(p_contact_phone), ''), NULLIF(TRIM(p_notes), ''), COALESCE(p_is_active, true), v_uid)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.cargo_accounts SET name = v_name, code = NULLIF(TRIM(p_code), ''), contact_name = NULLIF(TRIM(p_contact_name), ''),
      contact_phone = NULLIF(TRIM(p_contact_phone), ''), notes = NULLIF(TRIM(p_notes), ''), is_active = COALESCE(p_is_active, true), updated_at = now()
    WHERE id = p_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Compte introuvable'); END IF;
  END IF;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_account_upsert', 'cargo_account', v_id, jsonb_build_object('description', 'Compte cargo « ' || v_name || ' » ' || CASE WHEN p_id IS NULL THEN 'créé' ELSE 'modifié' END, 'name', v_name, 'code', p_code));
  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$fn$;
COMMENT ON FUNCTION public.cargo_account_upsert(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Créer ou corriger un compte cargo"}';

CREATE OR REPLACE FUNCTION public.cargo_account_assign(p_client_user_id UUID, p_account_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canEditClients') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cargo_accounts WHERE id = p_account_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte introuvable');
  END IF;
  UPDATE public.clients SET cargo_account_id = p_account_id WHERE user_id = p_client_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Client introuvable'); END IF;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_account_assign', 'client', p_client_user_id,
          jsonb_build_object('description', CASE WHEN p_account_id IS NULL THEN 'Client détaché de son compte cargo' ELSE 'Client rattaché au compte cargo' END, 'account_id', p_account_id));
  RETURN jsonb_build_object('success', true, 'client', public.reception_client_card(p_client_user_id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_account_assign(UUID, UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Rattacher un client à un compte cargo (ou l''en détacher)","resolve":{"p_client_user_id":"client"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Les clients d'un compte, avec ce qui attend pour chacun
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_account_clients(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canViewClients') OR public.admin_has_permission(v_uid, 'canReceiveParcels') OR public.admin_has_permission(v_uid, 'canViewCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'clients', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'client', public.reception_client_card(c.user_id),
      'parcels_waiting', (SELECT count(*) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
                          WHERE d.client_user_id = c.user_id AND p.status IN ('received','stored'))
    ) ORDER BY c.last_name, c.first_name)
    FROM public.clients c WHERE c.cargo_account_id = p_account_id), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_account_clients(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Les clients rattachés à un compte cargo, avec leurs colis en attente"}';

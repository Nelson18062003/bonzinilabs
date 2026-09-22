-- ============================================================================
-- MIGRATION CONSOLIDÉE · Cargo phases 1 à 7 · PR #206
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à passer dans le SQL Editor, d'un bloc.
-- ============================================================================
--
-- Ce fichier est la concaténation, dans l'ordre d'exécution, des sept fichiers
-- de la PR #206 (copies exactes des migrations supabase/migrations/2026092*) :
--   1. migrations/20260921_cargo_pricing_quotes.sql
--   2. migrations/20260921_cargo_quote_payments.sql
--   3. migrations/20260921_cargo_air_shipments.sql
--   4. migrations/20260921_warehouse_destination.sql
--   5. migrations/20260921_cargo_client_notifications.sql
--   6. migrations/20260921_warehouse_simplify.sql
--   7. migrations/20260922_cargo_suppliers_accounts.sql
--
-- Prérequis : les lots réception (#203, #204, #205) déjà passés — c'est le cas
-- en production. État vérifié le 22/09/2026 : AUCUNE des sept n'est encore
-- passée (ni cargo_quotes, ni air_shipments, ni le rôle warehouse_agent, ni
-- cargo_accounts).
--
-- Idempotent : chaque section utilise IF NOT EXISTS / CREATE OR REPLACE /
-- ON CONFLICT ; le fichier peut être rejoué sans dégât.
--
-- Une seule transaction : la section 4 ajoute la valeur d'enum
-- 'warehouse_agent' (ALTER TYPE … ADD VALUE). Postgres interdit d'UTILISER une
-- valeur d'enum ajoutée dans la même transaction ; ici toutes les sections
-- suivantes ne la comparent qu'en texte (ur.role::text), jamais en cast
-- ::app_role — vérifié — donc le fichier passe d'un bloc. Si malgré tout le
-- SQL Editor refusait (« unsafe use of new value »), passer la section 4
-- seule, puis le reste.
--
-- Après passage : lancer /gen-types (types TypeScript), déployer les edge
-- functions send-sms et admin-assistant. Les SMS restent désactivés par
-- défaut (voir la section 5 pour les activer).
-- ============================================================================


-- ############################################################################
-- SECTION 1 — Phase 1 · Prix par colis et devis
-- Source : migrations/20260921_cargo_pricing_quotes.sql
-- ############################################################################

-- ============================================================================
-- Cargo · Phase 1 — le prix par colis et le devis
--
-- Le réceptionnaire enregistre, il ne parle pas de prix. Le prix se pose côté
-- admin (canPriceParcels : super_admin, ops), colis par colis, à partir d'un
-- tarif par défaut modifiable à tout moment (XAF au kilo pour l'Air cargo,
-- XAF au mètre cube pour le Sea cargo) — ou d'un montant fixe tapé à la main.
-- L'ensemble forme un DEVIS (DV-000123) rattaché au dépôt, qu'on envoie au
-- client. La facture viendra plus tard, quand tout sera payé (phase 2).
--
--   1. permission canPriceParcels (admin_has_permission)
--   2. tarifs : platform_settings.cargo_pricing, lus/écrits par RPC
--   3. tables parcel_quotes + parcel_quote_lines (RLS lecture staff)
--   4. RPC : cargo_quote_get / ensure / set_line / add_line / remove_line / send
--   5. reception_overview : l'état du devis sur chaque dépôt (côté admin)
-- Idempotent.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Permission
-- ─────────────────────────────────────────────────────────────────────────
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
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Tarifs par défaut — un réglage, deux nombres, modifiables quand on veut
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.platform_settings (key, value)
VALUES ('cargo_pricing', '{"air_per_kg_xaf": 0, "sea_per_cbm_xaf": 0, "currency": "XAF"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cargo_pricing_get()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN NOT public.admin_has_permission(auth.uid(), 'canViewCargo')
    THEN jsonb_build_object('success', false, 'error', 'Accès non autorisé')
    ELSE jsonb_build_object('success', true,
      'air_per_kg_xaf',  COALESCE((value->>'air_per_kg_xaf')::numeric, 0),
      'sea_per_cbm_xaf', COALESCE((value->>'sea_per_cbm_xaf')::numeric, 0),
      'currency', COALESCE(value->>'currency', 'XAF'),
      'updated_at', updated_at)
  END
  FROM public.platform_settings WHERE key = 'cargo_pricing';
$fn$;
COMMENT ON FUNCTION public.cargo_pricing_get() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les tarifs cargo par défaut (XAF au kilo, XAF au m³)"}';

CREATE OR REPLACE FUNCTION public.cargo_pricing_set(p_air_per_kg_xaf NUMERIC, p_sea_per_cbm_xaf NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageRates') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF COALESCE(p_air_per_kg_xaf, -1) < 0 OR COALESCE(p_sea_per_cbm_xaf, -1) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un tarif ne peut pas être négatif');
  END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES ('cargo_pricing', jsonb_build_object('air_per_kg_xaf', p_air_per_kg_xaf, 'sea_per_cbm_xaf', p_sea_per_cbm_xaf, 'currency', 'XAF'), now(), v_uid)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = v_uid;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cargo_pricing_set', 'platform_setting', NULL,
          jsonb_build_object('description', 'Tarifs cargo : ' || p_air_per_kg_xaf || ' XAF/kg (air), ' || p_sea_per_cbm_xaf || ' XAF/m³ (mer)',
                             'air_per_kg_xaf', p_air_per_kg_xaf, 'sea_per_cbm_xaf', p_sea_per_cbm_xaf));
  RETURN public.cargo_pricing_get();
END;
$fn$;
COMMENT ON FUNCTION public.cargo_pricing_set(NUMERIC, NUMERIC) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageRates","confirm":true,"danger":false,"label":"Fixer les tarifs cargo par défaut (XAF au kilo, XAF au m³)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Le devis et ses lignes
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.parcel_quote_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.parcel_quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id      UUID NOT NULL UNIQUE REFERENCES public.parcel_deposits(id) ON DELETE CASCADE,
  quote_no        TEXT NOT NULL UNIQUE DEFAULT ('DV-' || lpad(nextval('public.parcel_quote_no_seq')::text, 6, '0')),
  -- draft : en cours · sent : envoyé au client · paid / invoiced : phase 2
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','invoiced')),
  currency        TEXT NOT NULL DEFAULT 'XAF',
  total_xaf       NUMERIC(14,0) NOT NULL DEFAULT 0,
  amount_paid_xaf NUMERIC(14,0) NOT NULL DEFAULT 0,
  notes           TEXT,
  sent_at         TIMESTAMPTZ,
  sent_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parcel_quote_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id       UUID NOT NULL REFERENCES public.parcel_quotes(id) ON DELETE CASCADE,
  parcel_id      UUID REFERENCES public.parcels(id) ON DELETE SET NULL,
  seq            INTEGER NOT NULL,
  -- parcel : une ligne par colis · fee : frais (emballage, local…) · discount : remise (montant négatif)
  kind           TEXT NOT NULL DEFAULT 'parcel' CHECK (kind IN ('parcel','fee','discount')),
  label          TEXT NOT NULL DEFAULT '',
  -- per_kg : quantité = kg · per_cbm : quantité = m³ · fixed : montant tapé
  basis          TEXT NOT NULL DEFAULT 'fixed' CHECK (basis IN ('per_kg','per_cbm','fixed')),
  quantity       NUMERIC(12,3),
  unit_price_xaf NUMERIC(14,2),
  amount_xaf     NUMERIC(14,0) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quote_id, seq)
);
CREATE INDEX IF NOT EXISTS parcel_quote_lines_quote_idx ON public.parcel_quote_lines (quote_id, seq);
CREATE UNIQUE INDEX IF NOT EXISTS parcel_quote_lines_parcel_uidx ON public.parcel_quote_lines (parcel_id) WHERE parcel_id IS NOT NULL;

ALTER TABLE public.parcel_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcel_quote_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parcel_quotes_staff_read ON public.parcel_quotes;
CREATE POLICY parcel_quotes_staff_read ON public.parcel_quotes FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
DROP POLICY IF EXISTS parcel_quote_lines_staff_read ON public.parcel_quote_lines;
CREATE POLICY parcel_quote_lines_staff_read ON public.parcel_quote_lines FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ─────────────────────────────────────────────────────────────────────────
-- 4. RPC
-- ─────────────────────────────────────────────────────────────────────────

-- 4.1 Sérialiser un devis (helper interne).
CREATE OR REPLACE FUNCTION public.cargo_quote_json(p_quote_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', q.id, 'quote_no', q.quote_no, 'deposit_id', q.deposit_id, 'status', q.status, 'currency', q.currency,
    'total_xaf', q.total_xaf, 'amount_paid_xaf', q.amount_paid_xaf, 'notes', q.notes,
    'sent_at', q.sent_at, 'created_at', q.created_at, 'updated_at', q.updated_at,
    'deposit_no', d.deposit_no, 'location', d.location, 'opened_at', d.opened_at, 'closed_at', d.closed_at,
    'client', public.reception_client_card(d.client_user_id),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'seq', l.seq, 'kind', l.kind, 'label', l.label, 'basis', l.basis,
        'quantity', l.quantity, 'unit_price_xaf', l.unit_price_xaf, 'amount_xaf', l.amount_xaf,
        'parcel_id', l.parcel_id, 'parcel_no', p.parcel_no, 'parcel_seq', p.seq, 'kind_of_parcel', p.kind,
        'description', p.description, 'weight_kg', p.weight_kg, 'cbm', p.cbm
      ) ORDER BY l.seq)
      FROM public.parcel_quote_lines l LEFT JOIN public.parcels p ON p.id = l.parcel_id
      WHERE l.quote_id = q.id), '[]'::jsonb)
  )
  FROM public.parcel_quotes q JOIN public.parcel_deposits d ON d.id = q.deposit_id
  WHERE q.id = p_quote_id;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser un devis (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_json(UUID) FROM anon, authenticated;

-- 4.2 Recalculer le total (helper interne).
CREATE OR REPLACE FUNCTION public.cargo_quote_recompute(p_quote_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE public.parcel_quotes q
     SET total_xaf = COALESCE((SELECT sum(l.amount_xaf) FROM public.parcel_quote_lines l WHERE l.quote_id = q.id), 0),
         updated_at = now()
   WHERE q.id = p_quote_id;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_recompute(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canPriceParcels","confirm":false,"danger":false,"label":"Recalculer le total d''un devis (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_recompute(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_recompute(UUID) FROM anon, authenticated;

-- 4.3 Lire le devis d'un dépôt (null s'il n'existe pas encore).
CREATE OR REPLACE FUNCTION public.cargo_quote_get(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_id UUID;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT id INTO v_id FROM public.parcel_quotes WHERE deposit_id = p_deposit_id;
  RETURN jsonb_build_object('success', true, 'quote', CASE WHEN v_id IS NULL THEN NULL ELSE public.cargo_quote_json(v_id) END);
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_get(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Le devis d''un dépôt de colis (prix par colis, total, état)","resolve":{"p_deposit_id":"deposit"}}';

-- 4.4 Ouvrir (ou compléter) le devis d'un dépôt : une ligne par colis, pré-remplie
--     au tarif du jour selon le mode — kilo au bureau (Air), m³ à l'entrepôt (Sea).
--     Les colis ajoutés après coup reçoivent leur ligne ; les quantités des lignes
--     au kilo / au m³ suivent le poids et le volume du colis (repesé = recalculé).
CREATE OR REPLACE FUNCTION public.cargo_quote_ensure(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_q   public.parcel_quotes;
  v_air NUMERIC; v_sea NUMERIC;
  v_basis TEXT; v_unit NUMERIC;
  v_p RECORD; v_seq INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canPriceParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = p_deposit_id FOR UPDATE;
  IF v_dep.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable'); END IF;
  IF v_dep.status = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est annulé'); END IF;

  SELECT COALESCE((value->>'air_per_kg_xaf')::numeric, 0), COALESCE((value->>'sea_per_cbm_xaf')::numeric, 0)
    INTO v_air, v_sea FROM public.platform_settings WHERE key = 'cargo_pricing';
  v_basis := CASE WHEN v_dep.location = 'office' THEN 'per_kg' ELSE 'per_cbm' END;
  v_unit  := CASE WHEN v_dep.location = 'office' THEN COALESCE(v_air, 0) ELSE COALESCE(v_sea, 0) END;

  SELECT * INTO v_q FROM public.parcel_quotes WHERE deposit_id = v_dep.id FOR UPDATE;
  IF v_q.id IS NULL THEN
    INSERT INTO public.parcel_quotes (deposit_id, created_by) VALUES (v_dep.id, v_uid) RETURNING * INTO v_q;
  END IF;
  IF v_q.status IN ('paid','invoiced') THEN
    RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
  END IF;

  -- Une ligne pour chaque colis qui n'en a pas encore.
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.parcel_quote_lines WHERE quote_id = v_q.id;
  FOR v_p IN
    SELECT p.* FROM public.parcels p
    WHERE p.deposit_id = v_dep.id AND NOT EXISTS (SELECT 1 FROM public.parcel_quote_lines l WHERE l.parcel_id = p.id)
    ORDER BY p.seq
  LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.parcel_quote_lines (quote_id, parcel_id, seq, kind, label, basis, quantity, unit_price_xaf, amount_xaf)
    VALUES (v_q.id, v_p.id, v_seq, 'parcel', COALESCE(v_p.description, ''), v_basis,
            CASE WHEN v_basis = 'per_kg' THEN v_p.weight_kg ELSE v_p.cbm END, v_unit,
            round(COALESCE(CASE WHEN v_basis = 'per_kg' THEN v_p.weight_kg ELSE v_p.cbm END, 0) * v_unit));
  END LOOP;

  -- Les quantités suivent le colis (un colis repesé se recalcule) ; le prix unitaire, lui, reste celui posé par l'admin.
  UPDATE public.parcel_quote_lines l
     SET quantity = CASE WHEN l.basis = 'per_kg' THEN p.weight_kg ELSE p.cbm END,
         amount_xaf = round(COALESCE(CASE WHEN l.basis = 'per_kg' THEN p.weight_kg ELSE p.cbm END, 0) * COALESCE(l.unit_price_xaf, 0)),
         updated_at = now()
    FROM public.parcels p
   WHERE l.quote_id = v_q.id AND l.parcel_id = p.id AND l.basis IN ('per_kg','per_cbm')
     AND (l.quantity IS DISTINCT FROM CASE WHEN l.basis = 'per_kg' THEN p.weight_kg ELSE p.cbm END);

  PERFORM public.cargo_quote_recompute(v_q.id);
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_ensure(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canPriceParcels","confirm":false,"danger":false,"label":"Ouvrir ou compléter le devis d''un dépôt (une ligne par colis au tarif du jour)","resolve":{"p_deposit_id":"deposit"}}';

-- 4.5 Modifier une ligne : la base (kilo, m³, fixe), le prix unitaire, ou un montant fixe.
CREATE OR REPLACE FUNCTION public.cargo_quote_set_line(
  p_line_id UUID,
  p_basis TEXT DEFAULT NULL,
  p_unit_price_xaf NUMERIC DEFAULT NULL,
  p_amount_xaf NUMERIC DEFAULT NULL,
  p_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_l public.parcel_quote_lines; v_q public.parcel_quotes; v_p public.parcels;
  v_basis TEXT; v_qty NUMERIC; v_unit NUMERIC; v_amount NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canPriceParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_l FROM public.parcel_quote_lines WHERE id = p_line_id;
  IF v_l.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ligne introuvable'); END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = v_l.quote_id FOR UPDATE;
  IF v_q.status IN ('paid','invoiced') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce devis est réglé : il ne se modifie plus');
  END IF;
  v_basis := COALESCE(p_basis, v_l.basis);
  IF v_basis NOT IN ('per_kg','per_cbm','fixed') THEN RETURN jsonb_build_object('success', false, 'error', 'Base de calcul inconnue'); END IF;
  IF v_l.kind <> 'parcel' AND v_basis <> 'fixed' THEN v_basis := 'fixed'; END IF;

  IF v_basis = 'fixed' THEN
    v_amount := round(COALESCE(p_amount_xaf, v_l.amount_xaf, 0));
    v_qty := NULL; v_unit := NULL;
  ELSE
    SELECT * INTO v_p FROM public.parcels WHERE id = v_l.parcel_id;
    v_qty  := CASE WHEN v_basis = 'per_kg' THEN v_p.weight_kg ELSE v_p.cbm END;
    v_unit := COALESCE(p_unit_price_xaf, v_l.unit_price_xaf, 0);
    IF v_unit < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Un prix unitaire ne peut pas être négatif'); END IF;
    v_amount := round(COALESCE(v_qty, 0) * v_unit);
  END IF;
  IF abs(v_amount) >= 1e12 THEN RETURN jsonb_build_object('success', false, 'error', 'Montant hors limites'); END IF;
  IF v_l.kind = 'discount' THEN v_amount := -abs(v_amount);
  ELSIF v_amount < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Un montant ne peut pas être négatif'); END IF;

  UPDATE public.parcel_quote_lines
     SET basis = v_basis, quantity = v_qty, unit_price_xaf = v_unit, amount_xaf = v_amount,
         label = COALESCE(NULLIF(TRIM(p_label), ''), label), updated_at = now()
   WHERE id = v_l.id;
  PERFORM public.cargo_quote_recompute(v_q.id);
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_set_line(UUID, TEXT, NUMERIC, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canPriceParcels","confirm":true,"danger":false,"label":"Fixer le prix d''une ligne de devis (au kilo, au m³, ou montant fixe)"}';

-- 4.6 Ajouter une ligne libre : frais (emballage, local) ou remise.
CREATE OR REPLACE FUNCTION public.cargo_quote_add_line(p_quote_id UUID, p_kind TEXT, p_label TEXT, p_amount_xaf NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes; v_seq INTEGER; v_amount NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canPriceParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.status IN ('paid','invoiced') THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est réglé : il ne se modifie plus'); END IF;
  IF p_kind NOT IN ('fee','discount') THEN RETURN jsonb_build_object('success', false, 'error', 'Type de ligne inconnu'); END IF;
  IF NULLIF(TRIM(p_label), '') IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Un libellé est requis'); END IF;
  v_amount := round(COALESCE(p_amount_xaf, 0));
  IF abs(v_amount) >= 1e12 THEN RETURN jsonb_build_object('success', false, 'error', 'Montant hors limites'); END IF;
  IF p_kind = 'fee' AND v_amount < 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Un frais ne peut pas être négatif'); END IF;
  IF p_kind = 'discount' THEN
    v_amount := -abs(v_amount);
    -- Une remise ne dépasse pas ce qu'elle remise.
    IF -v_amount > (SELECT COALESCE(sum(amount_xaf), 0) FROM public.parcel_quote_lines WHERE quote_id = v_q.id AND amount_xaf > 0) THEN
      RETURN jsonb_build_object('success', false, 'error', 'La remise dépasse le montant du devis');
    END IF;
  END IF;
  SELECT COALESCE(max(seq), 0) + 1 INTO v_seq FROM public.parcel_quote_lines WHERE quote_id = v_q.id;
  INSERT INTO public.parcel_quote_lines (quote_id, seq, kind, label, basis, amount_xaf)
  VALUES (v_q.id, v_seq, p_kind, TRIM(p_label), 'fixed', round(v_amount));
  PERFORM public.cargo_quote_recompute(v_q.id);
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_add_line(UUID, TEXT, TEXT, NUMERIC) IS
  '@mola:{"expose":true,"kind":"write","permission":"canPriceParcels","confirm":true,"danger":false,"label":"Ajouter un frais ou une remise à un devis"}';

-- 4.7 Retirer une ligne libre (une ligne de colis ne se retire pas : le colis existe).
CREATE OR REPLACE FUNCTION public.cargo_quote_remove_line(p_line_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_l public.parcel_quote_lines; v_q public.parcel_quotes;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canPriceParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_l FROM public.parcel_quote_lines WHERE id = p_line_id;
  IF v_l.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ligne introuvable'); END IF;
  IF v_l.kind = 'parcel' THEN RETURN jsonb_build_object('success', false, 'error', 'La ligne d''un colis ne se retire pas : mettez son montant à zéro'); END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = v_l.quote_id FOR UPDATE;
  IF v_q.status IN ('paid','invoiced') THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est réglé : il ne se modifie plus'); END IF;
  DELETE FROM public.parcel_quote_lines WHERE id = v_l.id;
  PERFORM public.cargo_quote_recompute(v_q.id);
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_remove_line(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canPriceParcels","confirm":true,"danger":false,"label":"Retirer un frais ou une remise d''un devis"}';

-- 4.8 Envoyer le devis : il passe à « envoyé », daté et signé. Réenvoyer est permis.
CREATE OR REPLACE FUNCTION public.cargo_quote_send(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canPriceParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.status IN ('paid','invoiced') THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est déjà réglé'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parcel_quote_lines WHERE quote_id = v_q.id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le devis est vide');
  END IF;
  UPDATE public.parcel_quotes SET status = 'sent', sent_at = now(), sent_by = v_uid, updated_at = now() WHERE id = v_q.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'send_parcel_quote', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Devis ' || v_q.quote_no || ' envoyé : ' || v_q.total_xaf || ' XAF', 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id, 'total_xaf', v_q.total_xaf));
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_send(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canPriceParcels","confirm":true,"danger":false,"label":"Marquer un devis comme envoyé au client"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 5. La vue d'ensemble côté admin porte l'état du devis de chaque dépôt.
--    (reception_deposit_json, lui, reste sans prix : c'est ce que voit le
--    réceptionnaire.)
-- ─────────────────────────────────────────────────────────────────────────
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
      SELECT jsonb_agg(
        public.reception_deposit_json(d.id)
        || jsonb_build_object('quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf)
        ORDER BY d.opened_at DESC)
      FROM public.parcel_deposits d LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
      WHERE d.opened_at >= p_from AND d.opened_at < p_to AND d.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$fn$;
COMMENT ON FUNCTION public.reception_overview(TIMESTAMPTZ, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Vue d''ensemble de la réception des colis (par réceptionnaire, dépôts, état des devis)"}';


-- ############################################################################
-- SECTION 2 — Phase 2 · Encaissements, reste à payer, facture acquittée
-- Source : migrations/20260921_cargo_quote_payments.sql
-- ############################################################################

-- ============================================================================
-- Cargo · Phase 2 — les encaissements, le reste à payer, la facture acquittée
--
-- Le devis (phase 1) dit combien. Ici on encaisse : un ou plusieurs
-- paiements, chacun avec sa preuve (photo du reçu Mobile Money, du bordereau
-- de virement, du billet), son reçu numéroté (RE-000123) et son lieu — avant
-- le départ de Chine (Guangzhou) ou au retrait (Douala). Le devis suit :
-- « reste à payer », puis « payé » quand la somme y est, puis « facturé » quand
-- on établit la FACTURE ACQUITTÉE (FA-000123), le document final du client.
--
-- Qui : canCollectParcelPayments (super_admin, ops). L'agent d'entrepôt du
-- Cameroun (phase 4) la recevra aussi : à Douala, la même personne remet les
-- colis et encaisse. Le réceptionnaire ne voit rien de tout ça.
--
--   1. permission canCollectParcelPayments (admin_has_permission)
--   2. table parcel_quote_payments + colonnes facture sur parcel_quotes
--   3. seau parcel-payment-proofs (privé)
--   4. helpers : recompute (total, encaissé, statut) et json (avec paiements)
--   5. RPC : cargo_quote_add_payment / cancel_payment / invoice
--   6. reception_overview porte l'encaissé par dépôt
--
-- Idempotent. Suppose 20260921130000_cargo_pricing_quotes.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Permission — miroir de ROLE_PERMISSIONS (AdminAuthContext.tsx)
-- ─────────────────────────────────────────────────────────────────────────
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
        WHEN 'canCollectParcelPayments' THEN ur.role::text IN ('super_admin','ops')
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les encaissements et la facture
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.parcel_receipt_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.parcel_invoice_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.parcel_quote_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES public.parcel_quotes(id) ON DELETE CASCADE,
  receipt_no    TEXT NOT NULL UNIQUE DEFAULT ('RE-' || lpad(nextval('public.parcel_receipt_no_seq')::text, 6, '0')),
  amount_xaf    NUMERIC(14,0) NOT NULL CHECK (amount_xaf > 0),
  -- cash : espèces · mobile_money : Orange Money, MTN MoMo, WeChat Pay, Alipay… · bank_transfer : virement · other
  method        TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','mobile_money','bank_transfer','other')),
  -- guangzhou : avant le départ · douala : au retrait · other : ailleurs (agence, en ligne)
  place         TEXT NOT NULL DEFAULT 'guangzhou' CHECK (place IN ('guangzhou','douala','other')),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference     TEXT,                       -- n° de transaction Mobile Money, référence de virement
  proof_path    TEXT,                       -- parcel-payment-proofs/<devis>/<horodatage>.jpg
  note          TEXT,
  received_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un encaissement ne s'efface pas : il s'annule, avec un motif, et reste visible.
  cancelled_at  TIMESTAMPTZ,
  cancelled_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS parcel_quote_payments_quote_idx ON public.parcel_quote_payments (quote_id, paid_at);

ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;
ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS invoice_no  TEXT UNIQUE;
ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS invoiced_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.parcel_quote_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parcel_quote_payments_staff_read ON public.parcel_quote_payments;
CREATE POLICY parcel_quote_payments_staff_read ON public.parcel_quote_payments FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Les preuves de paiement (photos), seau privé
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parcel-payment-proofs', 'parcel-payment-proofs', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Collectors can upload parcel payment proofs" ON storage.objects;
CREATE POLICY "Collectors can upload parcel payment proofs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parcel-payment-proofs' AND public.admin_has_permission(auth.uid(), 'canCollectParcelPayments')
              AND name ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
DROP POLICY IF EXISTS "Staff can view parcel payment proofs" ON storage.objects;
CREATE POLICY "Staff can view parcel payment proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parcel-payment-proofs' AND public.admin_has_permission(auth.uid(), 'canViewCargo'));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Helpers internes
-- ─────────────────────────────────────────────────────────────────────────

-- 4.1 Recalculer un devis : le total (lignes), l'encaissé (paiements non
--     annulés) et le statut qui en découle.
--       invoiced : facture établie — définitif
--       paid     : encaissé ≥ total (> 0)
--       sent     : envoyé, pas encore soldé
--       draft    : jamais envoyé
CREATE OR REPLACE FUNCTION public.cargo_quote_recompute(p_quote_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_total NUMERIC; v_paid NUMERIC; v_q public.parcel_quotes; v_status TEXT;
BEGIN
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id;
  IF v_q.id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(sum(l.amount_xaf), 0) INTO v_total FROM public.parcel_quote_lines l WHERE l.quote_id = p_quote_id;
  SELECT COALESCE(sum(p.amount_xaf), 0) INTO v_paid FROM public.parcel_quote_payments p WHERE p.quote_id = p_quote_id AND p.cancelled_at IS NULL;
  v_status := CASE
    WHEN v_q.invoice_no IS NOT NULL THEN 'invoiced'
    WHEN v_total > 0 AND v_paid >= v_total THEN 'paid'
    WHEN v_q.sent_at IS NOT NULL THEN 'sent'
    ELSE 'draft'
  END;
  UPDATE public.parcel_quotes
     SET total_xaf = v_total,
         amount_paid_xaf = v_paid,
         status = v_status,
         paid_at = CASE WHEN v_status IN ('paid','invoiced') THEN COALESCE(paid_at, now()) ELSE NULL END,
         updated_at = now()
   WHERE id = p_quote_id;
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_recompute(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canPriceParcels","confirm":false,"danger":false,"label":"Recalculer le total, l''encaissé et le statut d''un devis (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_recompute(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_recompute(UUID) FROM anon, authenticated;

-- 4.2 Sérialiser un devis, désormais avec ses paiements, le reste à payer et la facture.
CREATE OR REPLACE FUNCTION public.cargo_quote_json(p_quote_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', q.id, 'quote_no', q.quote_no, 'deposit_id', q.deposit_id, 'status', q.status, 'currency', q.currency,
    'total_xaf', q.total_xaf, 'amount_paid_xaf', q.amount_paid_xaf,
    'balance_xaf', GREATEST(q.total_xaf - q.amount_paid_xaf, 0),
    'notes', q.notes,
    'sent_at', q.sent_at, 'paid_at', q.paid_at,
    'invoice_no', q.invoice_no, 'invoiced_at', q.invoiced_at,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'deposit_no', d.deposit_no, 'location', d.location, 'opened_at', d.opened_at, 'closed_at', d.closed_at,
    'client', public.reception_client_card(d.client_user_id),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'seq', l.seq, 'kind', l.kind, 'label', l.label, 'basis', l.basis,
        'quantity', l.quantity, 'unit_price_xaf', l.unit_price_xaf, 'amount_xaf', l.amount_xaf,
        'parcel_id', l.parcel_id, 'parcel_no', p.parcel_no, 'parcel_seq', p.seq, 'kind_of_parcel', p.kind,
        'description', p.description, 'weight_kg', p.weight_kg, 'cbm', p.cbm
      ) ORDER BY l.seq)
      FROM public.parcel_quote_lines l LEFT JOIN public.parcels p ON p.id = l.parcel_id
      WHERE l.quote_id = q.id), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'receipt_no', pm.receipt_no, 'amount_xaf', pm.amount_xaf, 'method', pm.method, 'place', pm.place,
        'paid_at', pm.paid_at, 'reference', pm.reference, 'proof_path', pm.proof_path, 'note', pm.note,
        'received_by', pm.received_by,
        'received_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = pm.received_by),
        'created_at', pm.created_at, 'cancelled_at', pm.cancelled_at, 'cancel_reason', pm.cancel_reason
      ) ORDER BY pm.paid_at, pm.created_at)
      FROM public.parcel_quote_payments pm WHERE pm.quote_id = q.id), '[]'::jsonb)
  )
  FROM public.parcel_quotes q JOIN public.parcel_deposits d ON d.id = q.deposit_id
  WHERE q.id = p_quote_id;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser un devis avec ses paiements (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_json(UUID) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPC
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Encaisser : un paiement sur le devis, avec sa preuve. Montant entier
--     strictement positif, borné par le reste à payer (on ne prend pas plus
--     que le devis ; s'il faut plus, on corrige le devis). Refusé une fois la
--     facture établie. Verrou sur le devis : deux encaissements simultanés ne
--     dépassent pas le total.
CREATE OR REPLACE FUNCTION public.cargo_quote_add_payment(
  p_quote_id UUID,
  p_amount_xaf NUMERIC,
  p_method TEXT DEFAULT 'cash',
  p_place TEXT DEFAULT 'guangzhou',
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_proof_path TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes; v_balance NUMERIC; v_pm public.parcel_quote_payments;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 OR p_amount_xaf <> round(p_amount_xaf) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être un nombre entier de XAF, supérieur à zéro');
  END IF;
  IF p_method NOT IN ('cash','mobile_money','bank_transfer','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode de paiement inconnu');
  END IF;
  IF p_place NOT IN ('guangzhou','douala','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lieu d''encaissement inconnu');
  END IF;
  IF p_paid_at IS NOT NULL AND p_paid_at > now() + interval '1 day' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La date du paiement est dans le futur');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est établie : ce devis est clos'); END IF;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant : posez les prix d''abord'); END IF;
  v_balance := v_q.total_xaf - v_q.amount_paid_xaf;
  IF v_balance <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est déjà soldé'); END IF;
  IF p_amount_xaf > v_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant dépasse le reste à payer (' || v_balance || ' XAF)');
  END IF;

  -- La preuve : un objet que CET agent vient de déposer, sous ce devis, jamais réutilisé.
  IF NULLIF(TRIM(p_proof_path), '') IS NOT NULL THEN
    IF p_proof_path !~ ('^' || v_q.id::text || '/[A-Za-z0-9._-]+$') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chemin de preuve invalide');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'parcel-payment-proofs' AND o.name = p_proof_path AND (o.owner = v_uid OR o.owner_id = v_uid::text)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Preuve introuvable : reprenez la photo');
    END IF;
    IF EXISTS (SELECT 1 FROM public.parcel_quote_payments x WHERE x.proof_path = p_proof_path) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette preuve est déjà rattachée à un encaissement');
    END IF;
  END IF;

  INSERT INTO public.parcel_quote_payments (quote_id, amount_xaf, method, place, paid_at, reference, proof_path, note, received_by)
  VALUES (v_q.id, p_amount_xaf, p_method, p_place, COALESCE(p_paid_at, now()),
          NULLIF(TRIM(p_reference), ''), NULLIF(TRIM(p_proof_path), ''), NULLIF(TRIM(p_note), ''), v_uid)
  RETURNING * INTO v_pm;
  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'collect_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' : ' || p_amount_xaf || ' XAF sur ' || v_q.quote_no || ' (' || p_method || ', ' || p_place || ')',
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', p_amount_xaf, 'method', p_method, 'place', p_place, 'proof', v_pm.proof_path IS NOT NULL));
  RETURN jsonb_build_object('success', true, 'payment_id', v_pm.id, 'receipt_no', v_pm.receipt_no, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_add_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Encaisser un paiement sur un devis de colis (montant, mode, lieu, preuve)"}';

-- 5.2 Annuler un encaissement (erreur de saisie, double saisie). Motif
--     obligatoire ; le paiement reste visible, barré. Refusé une fois facturé.
CREATE OR REPLACE FUNCTION public.cargo_quote_cancel_payment(p_payment_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_pm public.parcel_quote_payments; v_q public.parcel_quotes;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez pourquoi vous annulez cet encaissement');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id;
  IF v_pm.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Encaissement introuvable'); END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = v_pm.quote_id FOR UPDATE;
  IF v_q.invoice_no IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est établie : les encaissements ne se modifient plus'); END IF;
  -- Statut terminal aussi : des colis déjà remis contre ce devis. L'annuler rouvrirait
  -- un « reste à payer » sur une marchandise partie.
  IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_q.deposit_id AND p.delivered_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce dépôt ont déjà été remis : l''encaissement ne s''annule plus');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_pm.cancelled_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Cet encaissement est déjà annulé'); END IF;

  UPDATE public.parcel_quote_payments
     SET cancelled_at = now(), cancelled_by = v_uid, cancel_reason = TRIM(p_reason)
   WHERE id = v_pm.id;
  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cancel_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' annulé (' || v_pm.amount_xaf || ' XAF) : ' || TRIM(p_reason),
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', v_pm.amount_xaf, 'reason', TRIM(p_reason)));
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_cancel_payment(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Annuler un encaissement (motif obligatoire ; le devis redevient à payer)"}';

-- 5.3 Établir la facture acquittée : seulement quand tout est encaissé.
--     Numéro FA-000123, définitif : plus aucune modification de prix ni
--     d'encaissement ensuite.
CREATE OR REPLACE FUNCTION public.cargo_quote_invoice(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes; v_no TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
  END IF;
  PERFORM public.cargo_quote_recompute(v_q.id);
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant'); END IF;
  IF v_q.amount_paid_xaf < v_q.total_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Il reste ' || (v_q.total_xaf - v_q.amount_paid_xaf) || ' XAF à encaisser avant la facture');
  END IF;
  v_no := 'FA-' || lpad(nextval('public.parcel_invoice_no_seq')::text, 6, '0');
  UPDATE public.parcel_quotes SET invoice_no = v_no, invoiced_at = now(), invoiced_by = v_uid, status = 'invoiced', updated_at = now() WHERE id = v_q.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'issue_parcel_invoice', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Facture acquittée ' || v_no || ' établie : ' || v_q.total_xaf || ' XAF (' || v_q.quote_no || ')',
                             'invoice_no', v_no, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id, 'total_xaf', v_q.total_xaf));
  RETURN jsonb_build_object('success', true, 'invoice_no', v_no, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_invoice(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":false,"label":"Établir la facture acquittée d''un devis entièrement encaissé"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. La vue d'ensemble porte l'encaissé et le reste à payer par dépôt.
-- ─────────────────────────────────────────────────────────────────────────
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
      SELECT jsonb_agg(
        public.reception_deposit_json(d.id)
        || jsonb_build_object('quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf,
                              'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no)
        ORDER BY d.opened_at DESC)
      FROM public.parcel_deposits d LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
      WHERE d.opened_at >= p_from AND d.opened_at < p_to AND d.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$fn$;
COMMENT ON FUNCTION public.reception_overview(TIMESTAMPTZ, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Vue d''ensemble de la réception des colis (par réceptionnaire, dépôts, devis et encaissements)"}';


-- ############################################################################
-- SECTION 3 — Phase 3 · Expédition aérienne (LTA), départ de Chine
-- Source : migrations/20260921_cargo_air_shipments.sql
-- ############################################################################

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
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS air_shipment_id UUID REFERENCES public.air_shipments(id) ON DELETE RESTRICT;
-- (RESTRICT : une expédition qui porte encore des colis ne se supprime pas — la contrainte de statut
--  ci-dessous ne le permettrait pas de toute façon. On retire les colis d'abord.)
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
  -- (La phase 4 redéfinit ce déclencheur : un colis remis ou manquant à Douala ne suit plus l'avion.)
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
REVOKE ALL ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) FROM anon, authenticated;

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
REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_deposit_json(UUID) FROM anon, authenticated;

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


-- ############################################################################
-- SECTION 4 — Phase 4 · Entrepôt de Douala : rôle warehouse_agent, pointage, remise
-- Source : migrations/20260921_warehouse_destination.sql
-- ############################################################################

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
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parcel-signatures', 'parcel-signatures', false, 1048576, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Warehouse can upload signatures" ON storage.objects;
CREATE POLICY "Warehouse can upload signatures" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parcel-signatures' AND public.admin_has_permission(auth.uid(), 'canReleaseParcels')
              AND name ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[A-Za-z0-9._-]+\.png$');
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
REVOKE ALL ON FUNCTION public.warehouse_parcel_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.warehouse_parcel_json(UUID) FROM anon, authenticated;

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
  -- Le transport doit être ARRIVÉ (l'admin, ou le suivi armateur, l'a marqué) : on ne pointe pas ce qui vole encore.
  IF NOT (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = v_p.air_shipment_id AND a.status IN ('ARRIVED','DELIVERED'))
       OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = v_p.shipment_id AND cs.status IN ('ARRIVED','DELIVERED'))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce transport n''est pas encore marqué arrivé : demandez à l''admin de poser le jalon');
  END IF;
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
      AND (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = parcels.air_shipment_id AND a.status IN ('ARRIVED','DELIVERED'))
        OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = parcels.shipment_id AND cs.status IN ('ARRIVED','DELIVERED')))
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
REVOKE ALL ON FUNCTION public.warehouse_release_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.warehouse_release_json(UUID) FROM anon, authenticated;

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

-- 5.0 Un colis remis, ou signalé manquant à Douala, ne suit plus son transport
--     (l'avion ni la boîte) : son histoire est écrite.
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
   WHERE air_shipment_id = NEW.id AND status <> v_status AND delivered_at IS NULL AND COALESCE(condition, '') <> 'missing';
  RETURN NEW;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.parcels_follow_shipment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_status TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_status := public.parcel_status_for_shipment(NEW.status);
  UPDATE public.parcels SET status = v_status, updated_at = now()
   WHERE shipment_id = NEW.id AND status <> v_status AND delivered_at IS NULL AND COALESCE(condition, '') <> 'missing';
  RETURN NEW;
END;
$fn$;
-- La fiche identité d'un client (helper) n'a rien à faire dans l'API publique.
REVOKE ALL ON FUNCTION public.reception_client_card(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_client_card(UUID) FROM anon, authenticated;

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
REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_deposit_json(UUID) FROM anon, authenticated;

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
REVOKE ALL ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_air_json(UUID, BOOLEAN) FROM anon, authenticated;


-- ############################################################################
-- SECTION 5 — Phase 5 · Le client prévenu à chaque jalon (notifications, SMS, email)
-- Source : migrations/20260921_cargo_client_notifications.sql
-- ############################################################################

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


-- ############################################################################
-- SECTION 6 — Phase 6 · Douala, une question par écran (fin de pointage)
-- Source : migrations/20260921_warehouse_simplify.sql
-- ############################################################################

-- Cargo · Entrepôt de Douala — la refonte « une question par écran »
--
-- L'app « /w » a été simplifiée sur le modèle de la réception de Guangzhou :
-- pointer (liste → un colis → le bilan), remettre (scanner → les colis → qui
-- emporte → la signature → le bon). Le bilan du pointage a besoin d'UN geste
-- de plus : déclarer manquants, d'un coup, les colis jamais vus à l'arrivée.
--
-- Idempotent. Suppose 20260921170000_cargo_client_notifications.sql passée.
-- ============================================================================

-- Déclarer plusieurs colis manquants d'un coup (fin de pointage). Un colis
-- déjà remis ou déjà pointé présent n'est pas touché : on ne perd jamais un
-- pointage par un geste de masse.
CREATE OR REPLACE FUNCTION public.warehouse_flag_missing_many(p_parcel_ids UUID[], p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER; v_nos TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi'); END IF;
  SELECT array_agg(DISTINCT x) INTO p_parcel_ids FROM unnest(p_parcel_ids) x WHERE x IS NOT NULL;
  PERFORM 1 FROM public.parcels WHERE id = ANY(p_parcel_ids) FOR UPDATE;
  WITH done AS (
    UPDATE public.parcels SET condition = 'missing', condition_note = NULLIF(TRIM(p_note), ''), checked_in_at = NULL, checked_in_by = NULL, updated_at = now()
    WHERE id = ANY(p_parcel_ids)
      AND (shipment_id IS NOT NULL OR air_shipment_id IS NOT NULL)
      AND status IN ('shipped','arrived') AND checked_in_at IS NULL AND delivered_at IS NULL
      AND (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = parcels.air_shipment_id AND a.status IN ('ARRIVED','DELIVERED'))
        OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = parcels.shipment_id AND cs.status IN ('ARRIVED','DELIVERED')))
    RETURNING id, parcel_no
  ) SELECT count(*), string_agg(parcel_no, ', ' ORDER BY parcel_no) INTO v_n, v_nos FROM done;
  IF v_n > 0 THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'warehouse_parcels_missing', 'parcel', p_parcel_ids[1],
            jsonb_build_object('description', v_n || ' colis manquant(s) à l''arrivée à Douala : ' || v_nos || COALESCE(' — ' || TRIM(p_note), ''), 'parcel_nos', v_nos, 'count', v_n, 'note', p_note));
  END IF;
  RETURN jsonb_build_object('success', true, 'flagged', v_n);
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_flag_missing_many(UUID[], TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":true,"danger":true,"label":"Déclarer manquants, d''un coup, les colis jamais vus à l''arrivée à Douala"}';


-- ############################################################################
-- SECTION 7 — Phase 7 · Fournisseur du dépôt, comptes cargo, carte client
-- Source : migrations/20260922_cargo_suppliers_accounts.sql
-- ############################################################################

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


-- ============================================================================
-- FIN · Cargo phases 1 à 7. Vérification rapide après passage :
--   SELECT to_regclass('public.cargo_accounts'),
--          (SELECT count(*) FROM pg_proc WHERE proname LIKE 'warehouse_%'),
--          (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
--            WHERE t.typname = 'app_role' AND e.enumlabel = 'warehouse_agent');
-- ============================================================================

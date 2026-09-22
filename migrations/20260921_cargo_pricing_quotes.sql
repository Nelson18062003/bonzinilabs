-- ============================================================================
-- À passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) : copie exacte de
-- supabase/migrations/20260921130000_cargo_pricing_quotes.sql. Idempotent.
-- Suppose les lots réception (#203, #204, #205) déjà passés.
-- ============================================================================

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

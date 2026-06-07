-- ============================================================
-- Centrale d'achat — Lot 1 : RPC d'écriture (couche de mutation)
--
-- Toute mutation procurement passe par une de ces fonctions. Les
-- tables proc_* bloquent INSERT/UPDATE/DELETE direct via RLS
-- (Lot 0) — seules ces RPC SECURITY DEFINER écrivent, et chacune
-- vérifie can_access_procurement(auth.uid()).
--
-- Voiding (annulation) réservé au super_admin (séparation des
-- pouvoirs, comme la trésorerie). Append-only + contre-marquage
-- voided_* sur l'argent (supplier_payment, qc, expense).
--
-- Convention @mola (CLAUDE.md) : chaque RPC exposée porte une
-- étiquette `comment on function ... is '@mola:{...}'` DANS CETTE
-- MÊME migration → Mola la découvre. permission = canManageProcurement.
--
-- Erreurs en ASCII (comme treasury_rpcs). Params typés enum (rejet
-- au bord). Montants validés (> 0 et < plafond anti-faute de frappe).
-- ============================================================

-- Plafond anti-faute de frappe (sanité), pas un cap métier.
-- 10 milliards : au-delà c'est forcément une erreur de saisie.

-- ── RPC: proc_create_mission ──
CREATE OR REPLACE FUNCTION public.proc_create_mission(
  p_client_user_id UUID,
  p_label          TEXT,
  p_location       TEXT DEFAULT NULL,
  p_started_on     DATE DEFAULT NULL,
  p_ended_on       DATE DEFAULT NULL,
  p_summary_note   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_ref     TEXT;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF p_label IS NULL OR length(trim(p_label)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Libelle de mission obligatoire');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_client_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;

  v_ref := public.generate_proc_mission_reference();

  INSERT INTO public.proc_missions (
    reference, client_user_id, label, location, started_on, ended_on, summary_note, created_by
  ) VALUES (
    v_ref, p_client_user_id, trim(p_label), NULLIF(trim(p_location), ''),
    p_started_on, p_ended_on, NULLIF(trim(p_summary_note), ''), v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_create_mission', 'proc_mission', v_id,
    jsonb_build_object('reference', v_ref, 'client_user_id', p_client_user_id, 'label', trim(p_label)));

  RETURN jsonb_build_object('success', true, 'mission_id', v_id, 'reference', v_ref);
END;
$$;
COMMENT ON FUNCTION public.proc_create_mission(UUID, TEXT, TEXT, DATE, DATE, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Creer une mission d''achat"}';

-- ── RPC: proc_update_mission ──
CREATE OR REPLACE FUNCTION public.proc_update_mission(
  p_mission_id   UUID,
  p_label        TEXT DEFAULT NULL,
  p_location     TEXT DEFAULT NULL,
  p_started_on   DATE DEFAULT NULL,
  p_ended_on     DATE DEFAULT NULL,
  p_status       public.proc_mission_status DEFAULT NULL,
  p_summary_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_mission public.proc_missions%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  SELECT * INTO v_mission FROM public.proc_missions WHERE id = p_mission_id;
  IF v_mission.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission introuvable');
  END IF;

  UPDATE public.proc_missions SET
    label        = COALESCE(NULLIF(trim(p_label), ''), label),
    location     = COALESCE(NULLIF(trim(p_location), ''), location),
    started_on   = COALESCE(p_started_on, started_on),
    ended_on     = COALESCE(p_ended_on, ended_on),
    status       = COALESCE(p_status, status),
    summary_note = COALESCE(NULLIF(trim(p_summary_note), ''), summary_note),
    updated_at   = now()
  WHERE id = p_mission_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_update_mission', 'proc_mission', p_mission_id,
    jsonb_build_object('status', p_status));

  RETURN jsonb_build_object('success', true, 'mission_id', p_mission_id);
END;
$$;
COMMENT ON FUNCTION public.proc_update_mission(UUID, TEXT, TEXT, DATE, DATE, public.proc_mission_status, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Modifier une mission"}';

-- ── RPC: proc_upsert_supplier ──
CREATE OR REPLACE FUNCTION public.proc_upsert_supplier(
  p_display_name        TEXT,
  p_id                  UUID DEFAULT NULL,
  p_legal_name          TEXT DEFAULT NULL,
  p_supplier_kind       public.proc_supplier_kind DEFAULT 'unknown',
  p_category            TEXT[] DEFAULT NULL,
  p_city                TEXT DEFAULT NULL,
  p_province            TEXT DEFAULT NULL,
  p_address             TEXT DEFAULT NULL,
  p_wechat_id           TEXT DEFAULT NULL,
  p_phone               TEXT DEFAULT NULL,
  p_email               TEXT DEFAULT NULL,
  p_verification_status public.proc_verification_status DEFAULT NULL,
  p_verification_notes  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
  v_created BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nom du fournisseur obligatoire');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.proc_suppliers (
      display_name, legal_name, supplier_kind, category, city, province, address,
      wechat_id, phone, email, verification_status, verification_notes, created_by
    ) VALUES (
      trim(p_display_name), NULLIF(trim(p_legal_name), ''), p_supplier_kind, COALESCE(p_category, '{}'),
      NULLIF(trim(p_city), ''), NULLIF(trim(p_province), ''), NULLIF(trim(p_address), ''),
      NULLIF(trim(p_wechat_id), ''), NULLIF(trim(p_phone), ''), NULLIF(trim(p_email), ''),
      COALESCE(p_verification_status, 'unverified'), NULLIF(trim(p_verification_notes), ''), v_user_id
    )
    RETURNING id INTO v_id;
    v_created := true;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.proc_suppliers WHERE id = p_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Fournisseur introuvable');
    END IF;
    UPDATE public.proc_suppliers SET
      display_name        = trim(p_display_name),
      legal_name          = COALESCE(NULLIF(trim(p_legal_name), ''), legal_name),
      supplier_kind       = COALESCE(p_supplier_kind, supplier_kind),
      category            = COALESCE(p_category, category),
      city                = COALESCE(NULLIF(trim(p_city), ''), city),
      province            = COALESCE(NULLIF(trim(p_province), ''), province),
      address             = COALESCE(NULLIF(trim(p_address), ''), address),
      wechat_id           = COALESCE(NULLIF(trim(p_wechat_id), ''), wechat_id),
      phone               = COALESCE(NULLIF(trim(p_phone), ''), phone),
      email               = COALESCE(NULLIF(trim(p_email), ''), email),
      verification_status = COALESCE(p_verification_status, verification_status),
      verification_notes  = COALESCE(NULLIF(trim(p_verification_notes), ''), verification_notes),
      updated_at          = now()
    WHERE id = p_id;
    v_id := p_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, CASE WHEN v_created THEN 'proc_create_supplier' ELSE 'proc_update_supplier' END,
    'proc_supplier', v_id, jsonb_build_object('display_name', trim(p_display_name)));

  RETURN jsonb_build_object('success', true, 'supplier_id', v_id, 'created', v_created);
END;
$$;
COMMENT ON FUNCTION public.proc_upsert_supplier(TEXT, UUID, TEXT, public.proc_supplier_kind, TEXT[], TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, public.proc_verification_status, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Creer ou modifier un fournisseur"}';

-- ── RPC: proc_create_purchase_order ──
CREATE OR REPLACE FUNCTION public.proc_create_purchase_order(
  p_mission_id          UUID,
  p_supplier_id         UUID,
  p_currency            public.proc_currency DEFAULT 'CNY',
  p_total_amount        NUMERIC DEFAULT 0,
  p_deposit_pct         NUMERIC DEFAULT 30,
  p_incoterm            public.proc_incoterm DEFAULT NULL,
  p_expected_ready_date DATE DEFAULT NULL,
  p_total_cbm           NUMERIC DEFAULT NULL,
  p_notes               TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_ref     TEXT;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proc_missions WHERE id = p_mission_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission introuvable');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proc_suppliers WHERE id = p_supplier_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fournisseur introuvable');
  END IF;
  IF p_total_amount IS NULL OR p_total_amount < 0 OR p_total_amount >= 10000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant total invalide');
  END IF;
  IF p_deposit_pct IS NULL OR p_deposit_pct < 0 OR p_deposit_pct > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pourcentage d''acompte invalide (0-100)');
  END IF;

  v_ref := public.generate_proc_po_reference();

  INSERT INTO public.proc_purchase_orders (
    reference, mission_id, supplier_id, currency, total_amount, deposit_pct,
    incoterm, expected_ready_date, total_cbm, notes, created_by
  ) VALUES (
    v_ref, p_mission_id, p_supplier_id, p_currency, p_total_amount, p_deposit_pct,
    p_incoterm, p_expected_ready_date, p_total_cbm, NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_create_purchase_order', 'proc_purchase_order', v_id,
    jsonb_build_object('reference', v_ref, 'mission_id', p_mission_id, 'supplier_id', p_supplier_id,
      'total_amount', p_total_amount, 'currency', p_currency));

  RETURN jsonb_build_object('success', true, 'purchase_order_id', v_id, 'reference', v_ref);
END;
$$;
COMMENT ON FUNCTION public.proc_create_purchase_order(UUID, UUID, public.proc_currency, NUMERIC, NUMERIC, public.proc_incoterm, DATE, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Creer une commande fournisseur"}';

-- ── RPC: proc_update_purchase_order ──
CREATE OR REPLACE FUNCTION public.proc_update_purchase_order(
  p_purchase_order_id   UUID,
  p_total_amount        NUMERIC DEFAULT NULL,
  p_deposit_pct         NUMERIC DEFAULT NULL,
  p_incoterm            public.proc_incoterm DEFAULT NULL,
  p_status              public.proc_po_status DEFAULT NULL,
  p_expected_ready_date DATE DEFAULT NULL,
  p_total_cbm           NUMERIC DEFAULT NULL,
  p_notes               TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_po      public.proc_purchase_orders%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  SELECT * INTO v_po FROM public.proc_purchase_orders WHERE id = p_purchase_order_id;
  IF v_po.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable');
  END IF;
  IF p_total_amount IS NOT NULL AND (p_total_amount < 0 OR p_total_amount >= 10000000000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant total invalide');
  END IF;
  IF p_deposit_pct IS NOT NULL AND (p_deposit_pct < 0 OR p_deposit_pct > 100) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pourcentage d''acompte invalide (0-100)');
  END IF;

  UPDATE public.proc_purchase_orders SET
    total_amount        = COALESCE(p_total_amount, total_amount),
    deposit_pct         = COALESCE(p_deposit_pct, deposit_pct),
    incoterm            = COALESCE(p_incoterm, incoterm),
    status              = COALESCE(p_status, status),
    expected_ready_date = COALESCE(p_expected_ready_date, expected_ready_date),
    total_cbm           = COALESCE(p_total_cbm, total_cbm),
    notes               = COALESCE(NULLIF(trim(p_notes), ''), notes),
    updated_at          = now()
  WHERE id = p_purchase_order_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_update_purchase_order', 'proc_purchase_order', p_purchase_order_id,
    jsonb_build_object('status', p_status, 'total_amount', p_total_amount));

  RETURN jsonb_build_object('success', true, 'purchase_order_id', p_purchase_order_id);
END;
$$;
COMMENT ON FUNCTION public.proc_update_purchase_order(UUID, NUMERIC, NUMERIC, public.proc_incoterm, public.proc_po_status, DATE, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Modifier une commande fournisseur"}';

-- ── RPC: proc_add_order_line ──
CREATE OR REPLACE FUNCTION public.proc_add_order_line(
  p_purchase_order_id UUID,
  p_description       TEXT,
  p_quantity          NUMERIC DEFAULT 0,
  p_unit              TEXT DEFAULT NULL,
  p_unit_price        NUMERIC DEFAULT 0,
  p_specs             JSONB DEFAULT '{}'::jsonb,
  p_moq               NUMERIC DEFAULT NULL,
  p_lead_time_days    INTEGER DEFAULT NULL,
  p_hs_code           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proc_purchase_orders WHERE id = p_purchase_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable');
  END IF;
  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Description de la ligne obligatoire');
  END IF;
  IF p_quantity < 0 OR p_unit_price < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantite et prix doivent etre positifs');
  END IF;

  INSERT INTO public.proc_order_lines (
    purchase_order_id, description, specs, quantity, unit, unit_price, moq, lead_time_days, hs_code, created_by
  ) VALUES (
    p_purchase_order_id, trim(p_description), COALESCE(p_specs, '{}'::jsonb), p_quantity,
    NULLIF(trim(p_unit), ''), p_unit_price, p_moq, p_lead_time_days, NULLIF(trim(p_hs_code), ''), v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_add_order_line', 'proc_order_line', v_id,
    jsonb_build_object('purchase_order_id', p_purchase_order_id, 'description', trim(p_description),
      'quantity', p_quantity, 'unit_price', p_unit_price));

  RETURN jsonb_build_object('success', true, 'order_line_id', v_id);
END;
$$;
COMMENT ON FUNCTION public.proc_add_order_line(UUID, TEXT, NUMERIC, TEXT, NUMERIC, JSONB, NUMERIC, INTEGER, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Ajouter une ligne (produit) a une commande"}';

-- ── RPC: proc_record_supplier_payment ── (ARGENT, append-only)
CREATE OR REPLACE FUNCTION public.proc_record_supplier_payment(
  p_purchase_order_id UUID,
  p_leg               public.proc_payment_leg,
  p_amount            NUMERIC,
  p_method            public.proc_payment_method,
  p_occurred_at       TIMESTAMPTZ DEFAULT now(),
  p_currency          public.proc_currency DEFAULT 'CNY',
  p_settlement_mode   public.proc_settlement_mode DEFAULT 'attestation',
  p_rail_payment_id   UUID DEFAULT NULL,
  p_paid_by           public.proc_paid_by DEFAULT NULL,
  p_external_ref      TEXT DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_ref            TEXT;
  v_id             UUID;
  v_outstanding    NUMERIC;
  v_has_qc_pass    BOOLEAN;
  v_warn_no_qc     BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount >= 10000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide (strictement positif et raisonnable)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proc_purchase_orders WHERE id = p_purchase_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable');
  END IF;
  IF p_settlement_mode = 'rail' THEN
    IF p_rail_payment_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le mode rail exige un paiement lie (rail_payment_id)');
    END IF;
    -- Le paiement du rail doit appartenir au CLIENT de la mission de cette commande
    -- (sinon on pourrait gonfler le "payé" d'une commande avec un paiement sans rapport).
    IF NOT EXISTS (
      SELECT 1 FROM public.payments pay
      JOIN public.proc_purchase_orders po ON po.id = p_purchase_order_id
      JOIN public.proc_missions mi ON mi.id = po.mission_id
      WHERE pay.id = p_rail_payment_id AND pay.user_id = mi.client_user_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Paiement rail introuvable ou rattache a un autre client');
    END IF;
  END IF;

  -- Gate souple : un solde sans QC "pass" -> avertissement, JAMAIS de blocage.
  IF p_leg IN ('balance', 'final') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.proc_qc_inspections
      WHERE purchase_order_id = p_purchase_order_id AND result = 'pass' AND voided_at IS NULL
    ) INTO v_has_qc_pass;
    v_warn_no_qc := NOT v_has_qc_pass;
  END IF;

  v_ref := public.generate_proc_payment_reference();

  INSERT INTO public.proc_supplier_payments (
    reference, purchase_order_id, leg, amount, currency, method, occurred_at,
    settlement_mode, rail_payment_id, paid_by, external_ref, notes, created_by
  ) VALUES (
    v_ref, p_purchase_order_id, p_leg, p_amount, p_currency, p_method, p_occurred_at,
    p_settlement_mode, p_rail_payment_id, p_paid_by, NULLIF(trim(p_external_ref), ''),
    NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_id;

  SELECT outstanding_amount INTO v_outstanding
  FROM public.proc_po_balances WHERE purchase_order_id = p_purchase_order_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_record_supplier_payment', 'proc_supplier_payment', v_id,
    jsonb_build_object('reference', v_ref, 'purchase_order_id', p_purchase_order_id,
      'leg', p_leg, 'amount', p_amount, 'currency', p_currency, 'method', p_method,
      'settlement_mode', p_settlement_mode, 'rail_payment_id', p_rail_payment_id,
      'outstanding_after', v_outstanding, 'warn_no_qc', v_warn_no_qc));

  RETURN jsonb_build_object('success', true, 'payment_id', v_id, 'reference', v_ref,
    'outstanding_after', v_outstanding, 'warning_no_qc_pass', v_warn_no_qc);
END;
$$;
COMMENT ON FUNCTION public.proc_record_supplier_payment(UUID, public.proc_payment_leg, NUMERIC, public.proc_payment_method, TIMESTAMPTZ, public.proc_currency, public.proc_settlement_mode, UUID, public.proc_paid_by, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,"danger":true,"label":"Enregistrer un paiement fournisseur (acompte/solde)"}';

-- ── RPC: proc_set_commission ──
CREATE OR REPLACE FUNCTION public.proc_set_commission(
  p_mission_id          UUID,
  p_input_mode          public.proc_commission_mode,
  p_input_value         NUMERIC,
  p_purchase_order_id   UUID DEFAULT NULL,
  p_base_amount         NUMERIC DEFAULT 0,
  p_factory_cost        NUMERIC DEFAULT NULL,
  p_client_price        NUMERIC DEFAULT NULL,
  p_negotiated_discount NUMERIC DEFAULT NULL,
  p_client_visible      BOOLEAN DEFAULT false,
  p_currency            public.proc_currency DEFAULT 'CNY',
  p_notes               TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_id             UUID;
  v_computed_pct   NUMERIC;
  v_computed_amount NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proc_missions WHERE id = p_mission_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission introuvable');
  END IF;
  IF p_input_value IS NULL OR p_input_value < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valeur de commission invalide');
  END IF;

  IF p_input_mode = 'percentage' THEN
    v_computed_pct    := p_input_value;
    v_computed_amount := COALESCE(p_base_amount, 0) * p_input_value / 100;
  ELSE -- fixed_amount
    v_computed_amount := p_input_value;
    v_computed_pct    := CASE WHEN COALESCE(p_base_amount, 0) > 0
                              THEN p_input_value / p_base_amount * 100 ELSE NULL END;
  END IF;

  INSERT INTO public.proc_commissions (
    mission_id, purchase_order_id, input_mode, input_value, base_amount,
    computed_pct, computed_amount, factory_cost, client_price, negotiated_discount,
    client_visible, currency, notes, created_by
  ) VALUES (
    p_mission_id, p_purchase_order_id, p_input_mode, p_input_value, COALESCE(p_base_amount, 0),
    v_computed_pct, v_computed_amount, p_factory_cost, p_client_price, p_negotiated_discount,
    COALESCE(p_client_visible, false), p_currency, NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_set_commission', 'proc_commission', v_id,
    jsonb_build_object('mission_id', p_mission_id, 'purchase_order_id', p_purchase_order_id,
      'input_mode', p_input_mode, 'input_value', p_input_value,
      'computed_amount', v_computed_amount, 'computed_pct', v_computed_pct));

  RETURN jsonb_build_object('success', true, 'commission_id', v_id,
    'computed_amount', v_computed_amount, 'computed_pct', v_computed_pct);
END;
$$;
COMMENT ON FUNCTION public.proc_set_commission(UUID, public.proc_commission_mode, NUMERIC, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, public.proc_currency, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,"danger":false,"label":"Definir la commission Bonzini d''une mission"}';

-- ── RPC: proc_attach_document ── (preuve jointe, AUCUNE analyse)
CREATE OR REPLACE FUNCTION public.proc_attach_document(
  p_entity_type      public.proc_document_entity,
  p_entity_id        UUID,
  p_file_url         TEXT,
  p_doc_type         public.proc_document_type DEFAULT 'other',
  p_file_name        TEXT DEFAULT NULL,
  p_file_type        TEXT DEFAULT NULL,
  p_caption          TEXT DEFAULT NULL,
  p_uploaded_by_kind public.proc_uploaded_by_kind DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF p_file_url IS NULL OR length(trim(p_file_url)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'URL du fichier obligatoire');
  END IF;
  -- La preuve DOIT vivre dans notre bucket privé (pas d'URL externe arbitraire).
  IF trim(p_file_url) NOT LIKE 'procurement-docs/%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chemin de fichier invalide (hors bucket procurement-docs)');
  END IF;
  -- L'entité cible doit exister (pas de preuve orpheline / mal rattachée).
  IF NOT (
    CASE p_entity_type
      WHEN 'mission'          THEN EXISTS (SELECT 1 FROM public.proc_missions          WHERE id = p_entity_id)
      WHEN 'supplier'         THEN EXISTS (SELECT 1 FROM public.proc_suppliers         WHERE id = p_entity_id)
      WHEN 'purchase_order'   THEN EXISTS (SELECT 1 FROM public.proc_purchase_orders   WHERE id = p_entity_id)
      WHEN 'supplier_payment' THEN EXISTS (SELECT 1 FROM public.proc_supplier_payments WHERE id = p_entity_id)
      WHEN 'qc'               THEN EXISTS (SELECT 1 FROM public.proc_qc_inspections    WHERE id = p_entity_id)
      WHEN 'order_line'       THEN EXISTS (SELECT 1 FROM public.proc_order_lines       WHERE id = p_entity_id)
      ELSE FALSE
    END
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entite cible introuvable');
  END IF;

  INSERT INTO public.proc_documents (
    entity_type, entity_id, doc_type, file_url, file_name, file_type, caption, uploaded_by_kind, created_by
  ) VALUES (
    p_entity_type, p_entity_id, COALESCE(p_doc_type, 'other'), trim(p_file_url),
    NULLIF(trim(p_file_name), ''), NULLIF(trim(p_file_type), ''), NULLIF(trim(p_caption), ''),
    p_uploaded_by_kind, v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_attach_document', 'proc_document', v_id,
    jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id, 'doc_type', p_doc_type));

  RETURN jsonb_build_object('success', true, 'document_id', v_id);
END;
$$;
COMMENT ON FUNCTION public.proc_attach_document(public.proc_document_entity, UUID, TEXT, public.proc_document_type, TEXT, TEXT, TEXT, public.proc_uploaded_by_kind) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Joindre une preuve (photo/PDF)"}';

-- ── RPC: proc_record_qc ── (append-only)
CREATE OR REPLACE FUNCTION public.proc_record_qc(
  p_purchase_order_id UUID,
  p_inspection_type   public.proc_qc_type,
  p_inspector_kind    public.proc_qc_inspector_kind,
  p_result            public.proc_qc_result,
  p_occurred_at       TIMESTAMPTZ DEFAULT now(),
  p_inspector_name    TEXT DEFAULT NULL,
  p_aql_level         TEXT DEFAULT NULL,
  p_defects           JSONB DEFAULT '{}'::jsonb,
  p_report_document_id UUID DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proc_purchase_orders WHERE id = p_purchase_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable');
  END IF;

  INSERT INTO public.proc_qc_inspections (
    purchase_order_id, inspection_type, inspector_kind, inspector_name, aql_level,
    result, defects, occurred_at, report_document_id, notes, created_by
  ) VALUES (
    p_purchase_order_id, p_inspection_type, p_inspector_kind, NULLIF(trim(p_inspector_name), ''),
    NULLIF(trim(p_aql_level), ''), p_result, COALESCE(p_defects, '{}'::jsonb), p_occurred_at,
    p_report_document_id, NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_record_qc', 'proc_qc_inspection', v_id,
    jsonb_build_object('purchase_order_id', p_purchase_order_id, 'inspection_type', p_inspection_type,
      'inspector_kind', p_inspector_kind, 'result', p_result));

  RETURN jsonb_build_object('success', true, 'qc_id', v_id, 'result', p_result);
END;
$$;
COMMENT ON FUNCTION public.proc_record_qc(UUID, public.proc_qc_type, public.proc_qc_inspector_kind, public.proc_qc_result, TIMESTAMPTZ, TEXT, TEXT, JSONB, UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Enregistrer une inspection qualite (QC)"}';

-- ── RPC: proc_log_production_event ── (append-only)
CREATE OR REPLACE FUNCTION public.proc_log_production_event(
  p_purchase_order_id  UUID,
  p_status             public.proc_production_status,
  p_occurred_at        TIMESTAMPTZ DEFAULT now(),
  p_note               TEXT DEFAULT NULL,
  p_evidence_document_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proc_purchase_orders WHERE id = p_purchase_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable');
  END IF;

  INSERT INTO public.proc_production_events (
    purchase_order_id, status, occurred_at, note, evidence_document_id, created_by
  ) VALUES (
    p_purchase_order_id, p_status, p_occurred_at, NULLIF(trim(p_note), ''), p_evidence_document_id, v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_log_production_event', 'proc_production_event', v_id,
    jsonb_build_object('purchase_order_id', p_purchase_order_id, 'status', p_status));

  RETURN jsonb_build_object('success', true, 'event_id', v_id, 'status', p_status);
END;
$$;
COMMENT ON FUNCTION public.proc_log_production_event(UUID, public.proc_production_status, TIMESTAMPTZ, TEXT, UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":false,"danger":false,"label":"Journaliser un evenement de production"}';

-- ── RPC: proc_record_expense ── (ARGENT, append-only)
CREATE OR REPLACE FUNCTION public.proc_record_expense(
  p_mission_id         UUID,
  p_category           public.proc_expense_category,
  p_amount             NUMERIC,
  p_occurred_at        TIMESTAMPTZ DEFAULT now(),
  p_currency           public.proc_currency DEFAULT 'CNY',
  p_billable_to_client BOOLEAN DEFAULT false,
  p_receipt_document_id UUID DEFAULT NULL,
  p_notes              TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount >= 10000000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proc_missions WHERE id = p_mission_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission introuvable');
  END IF;

  INSERT INTO public.proc_expenses (
    mission_id, category, amount, currency, occurred_at, billable_to_client,
    receipt_document_id, notes, created_by
  ) VALUES (
    p_mission_id, p_category, p_amount, p_currency, p_occurred_at, COALESCE(p_billable_to_client, false),
    p_receipt_document_id, NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_record_expense', 'proc_expense', v_id,
    jsonb_build_object('mission_id', p_mission_id, 'category', p_category, 'amount', p_amount, 'currency', p_currency));

  RETURN jsonb_build_object('success', true, 'expense_id', v_id);
END;
$$;
COMMENT ON FUNCTION public.proc_record_expense(UUID, public.proc_expense_category, NUMERIC, TIMESTAMPTZ, public.proc_currency, BOOLEAN, UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,"danger":true,"label":"Enregistrer un frais de mission"}';

-- ── RPC: proc_void_record ── (super_admin uniquement)
-- Annule (contre-marque voided_*) un enregistrement append-only :
-- supplier_payment | qc | expense. Motif obligatoire (>= 10 car.).
CREATE OR REPLACE FUNCTION public.proc_void_record(
  p_record_kind TEXT,
  p_id          UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_is_super_admin BOOLEAN;
  v_now            TIMESTAMPTZ := now();
  v_already        BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND (is_disabled = false OR is_disabled IS NULL)
      AND role::text = 'super_admin'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Annulation reservee au super admin');
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif obligatoire (10 caracteres min)');
  END IF;
  IF p_record_kind NOT IN ('supplier_payment', 'qc', 'expense') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''enregistrement non supporte');
  END IF;

  -- Lit l'état "deja annule" ; FOUND distingue proprement le cas introuvable.
  IF p_record_kind = 'supplier_payment' THEN
    SELECT (voided_at IS NOT NULL) INTO v_already FROM public.proc_supplier_payments WHERE id = p_id;
  ELSIF p_record_kind = 'qc' THEN
    SELECT (voided_at IS NOT NULL) INTO v_already FROM public.proc_qc_inspections WHERE id = p_id;
  ELSE
    SELECT (voided_at IS NOT NULL) INTO v_already FROM public.proc_expenses WHERE id = p_id;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enregistrement introuvable');
  END IF;
  IF v_already THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enregistrement deja annule');
  END IF;

  IF p_record_kind = 'supplier_payment' THEN
    UPDATE public.proc_supplier_payments
    SET voided_at = v_now, voided_by = v_user_id, void_reason = trim(p_reason) WHERE id = p_id;
  ELSIF p_record_kind = 'qc' THEN
    UPDATE public.proc_qc_inspections
    SET voided_at = v_now, voided_by = v_user_id, void_reason = trim(p_reason) WHERE id = p_id;
  ELSE
    UPDATE public.proc_expenses
    SET voided_at = v_now, voided_by = v_user_id, void_reason = trim(p_reason) WHERE id = p_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'proc_void_record', 'proc_' || p_record_kind, p_id,
    jsonb_build_object('record_kind', p_record_kind, 'reason', trim(p_reason)));

  RETURN jsonb_build_object('success', true, 'record_kind', p_record_kind, 'id', p_id);
END;
$$;
COMMENT ON FUNCTION public.proc_void_record(TEXT, UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageProcurement","confirm":true,"danger":true,"label":"Annuler un enregistrement (paiement/QC/frais)"}';

-- ============================================================
-- Centrale d'achat — Lot 2/3 : RPC de LECTURE & RAPPORT
--
-- Lecture seule (STABLE), SECURITY DEFINER, gate can_access_procurement.
-- Étiquetées @mola kind:"read" (Mola peut répondre : reste-à-payer,
-- fournisseur 360, rapport mission, control tower).
--
-- proc_mission_report = l'agrégat imbriqué qui alimente le PDF
-- (via generate-report-pdf) : mission + client -> fournisseurs ->
-- commandes -> (lignes, paiements actifs, QC, production, commission,
-- totaux) + commissions mission + frais + totaux par devise.
-- ============================================================

-- ── RPC: proc_outstanding_balances ── (reste à payer)
CREATE OR REPLACE FUNCTION public.proc_outstanding_balances(
  p_mission_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rows    JSONB;
  v_totals  JSONB;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'purchase_order_id', b.purchase_order_id,
    'reference', b.reference,
    'mission_id', b.mission_id,
    'mission_reference', m.reference,
    'mission_label', m.label,
    'supplier_id', b.supplier_id,
    'supplier_name', s.display_name,
    'currency', b.currency,
    'total_amount', b.total_amount,
    'paid_amount', b.paid_amount,
    'outstanding_amount', b.outstanding_amount,
    'status', po.status
  ) ORDER BY b.outstanding_amount DESC), '[]'::jsonb)
  INTO v_rows
  FROM public.proc_po_balances b
  JOIN public.proc_purchase_orders po ON po.id = b.purchase_order_id
  JOIN public.proc_missions m ON m.id = b.mission_id
  JOIN public.proc_suppliers s ON s.id = b.supplier_id
  WHERE (p_mission_id IS NULL OR b.mission_id = p_mission_id)
    AND po.status <> 'cancelled'
    AND b.outstanding_amount <> 0;

  SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) INTO v_totals
  FROM (
    SELECT b.currency::text AS currency, SUM(b.outstanding_amount)::numeric(20,8) AS total
    FROM public.proc_po_balances b
    JOIN public.proc_purchase_orders po ON po.id = b.purchase_order_id
    WHERE (p_mission_id IS NULL OR b.mission_id = p_mission_id)
      AND po.status <> 'cancelled'
    GROUP BY b.currency
  ) t;

  RETURN jsonb_build_object('success', true, 'rows', v_rows, 'outstanding_by_currency', v_totals);
END;
$$;
COMMENT ON FUNCTION public.proc_outstanding_balances(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewProcurement","confirm":false,"danger":false,"label":"Lister le reste a payer (par commande)"}';

-- ── RPC: proc_supplier_360 ── (fiche fournisseur + ses commandes)
CREATE OR REPLACE FUNCTION public.proc_supplier_360(
  p_supplier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_supplier JSONB;
  v_orders   JSONB;
  v_totals   JSONB;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  SELECT jsonb_build_object(
    'id', s.id, 'display_name', s.display_name, 'legal_name', s.legal_name,
    'supplier_kind', s.supplier_kind, 'category', s.category,
    'city', s.city, 'province', s.province, 'address', s.address,
    'wechat_id', s.wechat_id, 'phone', s.phone, 'email', s.email,
    'verification_status', s.verification_status, 'verification_notes', s.verification_notes,
    'is_active', s.is_active, 'created_at', s.created_at
  ) INTO v_supplier
  FROM public.proc_suppliers s WHERE s.id = p_supplier_id;

  IF v_supplier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fournisseur introuvable');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'purchase_order_id', po.id, 'reference', po.reference,
    'mission_id', po.mission_id, 'mission_reference', m.reference, 'mission_label', m.label,
    'currency', po.currency, 'total_amount', po.total_amount, 'status', po.status,
    'paid_amount', b.paid_amount, 'outstanding_amount', b.outstanding_amount,
    'expected_ready_date', po.expected_ready_date, 'created_at', po.created_at
  ) ORDER BY po.created_at DESC), '[]'::jsonb)
  INTO v_orders
  FROM public.proc_purchase_orders po
  JOIN public.proc_missions m ON m.id = po.mission_id
  LEFT JOIN public.proc_po_balances b ON b.purchase_order_id = po.id
  WHERE po.supplier_id = p_supplier_id;

  SELECT jsonb_build_object(
    'purchase_order_count', COUNT(DISTINCT po.id),
    'mission_count', COUNT(DISTINCT po.mission_id),
    'ordered_by_currency', COALESCE(
      (SELECT jsonb_object_agg(currency, total) FROM (
        SELECT currency::text AS currency, SUM(total_amount)::numeric(20,8) AS total
        FROM public.proc_purchase_orders WHERE supplier_id = p_supplier_id GROUP BY currency
      ) a), '{}'::jsonb),
    'outstanding_by_currency', COALESCE(
      (SELECT jsonb_object_agg(currency, total) FROM (
        SELECT b.currency::text AS currency, SUM(b.outstanding_amount)::numeric(20,8) AS total
        FROM public.proc_po_balances b
        JOIN public.proc_purchase_orders po2 ON po2.id = b.purchase_order_id
        WHERE po2.supplier_id = p_supplier_id GROUP BY b.currency
      ) o), '{}'::jsonb)
  ) INTO v_totals
  FROM public.proc_purchase_orders po WHERE po.supplier_id = p_supplier_id;

  RETURN jsonb_build_object('success', true, 'supplier', v_supplier, 'purchase_orders', v_orders, 'totals', v_totals);
END;
$$;
COMMENT ON FUNCTION public.proc_supplier_360(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewProcurement","confirm":false,"danger":false,"label":"Fiche 360 d''un fournisseur"}';

-- ── RPC: proc_mission_report ── (l'agrégat du rapport / PDF)
CREATE OR REPLACE FUNCTION public.proc_mission_report(
  p_mission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_mission    JSONB;
  v_suppliers  JSONB;
  v_commissions JSONB;
  v_expenses   JSONB;
  v_totals     JSONB;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.proc_missions WHERE id = p_mission_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mission introuvable');
  END IF;

  -- Entête mission + client
  SELECT jsonb_build_object(
    'id', m.id, 'reference', m.reference, 'label', m.label, 'location', m.location,
    'started_on', m.started_on, 'ended_on', m.ended_on, 'status', m.status,
    'summary_note', m.summary_note, 'created_at', m.created_at,
    'client', jsonb_build_object(
      'user_id', m.client_user_id,
      'first_name', c.first_name, 'last_name', c.last_name, 'company_name', c.company_name,
      'phone', c.phone, 'email', c.email, 'city', c.city, 'country', c.country,
      'kyc_verified', c.kyc_verified
    )
  ) INTO v_mission
  FROM public.proc_missions m
  LEFT JOIN public.clients c ON c.user_id = m.client_user_id
  WHERE m.id = p_mission_id;

  -- Fournisseurs -> commandes -> (lignes, paiements, qc, production, commission, totaux)
  SELECT COALESCE(jsonb_agg(z.sup_obj ORDER BY z.display_name), '[]'::jsonb)
  INTO v_suppliers
  FROM (
    SELECT s.display_name AS display_name, jsonb_build_object(
      'supplier_id', s.id,
      'display_name', s.display_name,
      'supplier_kind', s.supplier_kind,
      'verification_status', s.verification_status,
      'city', s.city, 'province', s.province, 'wechat_id', s.wechat_id, 'phone', s.phone,
      'purchase_orders', (
        SELECT COALESCE(jsonb_agg(pos.po_obj ORDER BY pos.po_ref), '[]'::jsonb)
        FROM (
          SELECT po.reference AS po_ref, jsonb_build_object(
            'purchase_order_id', po.id,
            'reference', po.reference,
            'currency', po.currency,
            'total_amount', po.total_amount,
            'deposit_pct', po.deposit_pct,
            'incoterm', po.incoterm,
            'status', po.status,
            'expected_ready_date', po.expected_ready_date,
            'total_cbm', po.total_cbm,
            'notes', po.notes,
            'order_lines', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', ol.id, 'description', ol.description, 'specs', ol.specs,
                'quantity', ol.quantity, 'unit', ol.unit, 'unit_price', ol.unit_price,
                'line_total', ol.line_total, 'moq', ol.moq, 'lead_time_days', ol.lead_time_days,
                'hs_code', ol.hs_code) ORDER BY ol.created_at), '[]'::jsonb)
              FROM public.proc_order_lines ol WHERE ol.purchase_order_id = po.id
            ),
            'payments', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', pp.id, 'reference', pp.reference, 'leg', pp.leg, 'amount', pp.amount,
                'currency', pp.currency, 'method', pp.method, 'occurred_at', pp.occurred_at,
                'settlement_mode', pp.settlement_mode, 'rail_payment_id', pp.rail_payment_id,
                'paid_by', pp.paid_by, 'external_ref', pp.external_ref) ORDER BY pp.occurred_at), '[]'::jsonb)
              FROM public.proc_supplier_payments pp
              WHERE pp.purchase_order_id = po.id AND pp.voided_at IS NULL
            ),
            'qc', (
              SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', q.id, 'inspection_type', q.inspection_type, 'inspector_kind', q.inspector_kind,
                'inspector_name', q.inspector_name, 'aql_level', q.aql_level, 'result', q.result,
                'occurred_at', q.occurred_at) ORDER BY q.occurred_at), '[]'::jsonb)
              FROM public.proc_qc_inspections q
              WHERE q.purchase_order_id = po.id AND q.voided_at IS NULL
            ),
            'production_status', (
              SELECT pe.status FROM public.proc_production_events pe
              WHERE pe.purchase_order_id = po.id ORDER BY pe.occurred_at DESC LIMIT 1
            ),
            'commission', (
              SELECT jsonb_build_object('id', cm.id, 'input_mode', cm.input_mode,
                'input_value', cm.input_value, 'computed_amount', cm.computed_amount,
                'computed_pct', cm.computed_pct, 'currency', cm.currency, 'client_visible', cm.client_visible)
              FROM public.proc_commissions cm
              WHERE cm.purchase_order_id = po.id ORDER BY cm.created_at DESC LIMIT 1
            ),
            'paid_amount', COALESCE((SELECT SUM(amount) FROM public.proc_supplier_payments
              WHERE purchase_order_id = po.id AND voided_at IS NULL), 0)::numeric(20,8),
            'outstanding_amount', (po.total_amount - COALESCE((SELECT SUM(amount)
              FROM public.proc_supplier_payments WHERE purchase_order_id = po.id AND voided_at IS NULL), 0))::numeric(20,8)
          ) AS po_obj
          FROM public.proc_purchase_orders po
          WHERE po.mission_id = p_mission_id AND po.supplier_id = s.id
        ) pos
      )
    ) AS sup_obj
    FROM public.proc_suppliers s
    WHERE EXISTS (
      SELECT 1 FROM public.proc_purchase_orders po3
      WHERE po3.mission_id = p_mission_id AND po3.supplier_id = s.id
    )
  ) z;

  -- Commissions niveau mission (sans PO)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cm.id, 'input_mode', cm.input_mode, 'input_value', cm.input_value,
    'base_amount', cm.base_amount, 'computed_amount', cm.computed_amount, 'computed_pct', cm.computed_pct,
    'currency', cm.currency, 'client_visible', cm.client_visible, 'notes', cm.notes) ORDER BY cm.created_at), '[]'::jsonb)
  INTO v_commissions
  FROM public.proc_commissions cm
  WHERE cm.mission_id = p_mission_id AND cm.purchase_order_id IS NULL;

  -- Frais de mission (actifs)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'category', e.category, 'amount', e.amount, 'currency', e.currency,
    'occurred_at', e.occurred_at, 'billable_to_client', e.billable_to_client, 'notes', e.notes) ORDER BY e.occurred_at), '[]'::jsonb)
  INTO v_expenses
  FROM public.proc_expenses e
  WHERE e.mission_id = p_mission_id AND e.voided_at IS NULL;

  -- Totaux par devise
  v_totals := jsonb_build_object(
    'ordered_by_currency', COALESCE((SELECT jsonb_object_agg(currency, total) FROM (
        SELECT currency::text AS currency, SUM(total_amount)::numeric(20,8) AS total
        FROM public.proc_purchase_orders WHERE mission_id = p_mission_id AND status <> 'cancelled' GROUP BY currency) a), '{}'::jsonb),
    'paid_by_currency', COALESCE((SELECT jsonb_object_agg(currency, total) FROM (
        SELECT pp.currency::text AS currency, SUM(pp.amount)::numeric(20,8) AS total
        FROM public.proc_supplier_payments pp
        JOIN public.proc_purchase_orders po ON po.id = pp.purchase_order_id
        WHERE po.mission_id = p_mission_id AND pp.voided_at IS NULL GROUP BY pp.currency) b), '{}'::jsonb),
    'outstanding_by_currency', COALESCE((SELECT jsonb_object_agg(currency, total) FROM (
        SELECT b.currency::text AS currency, SUM(b.outstanding_amount)::numeric(20,8) AS total
        FROM public.proc_po_balances b
        JOIN public.proc_purchase_orders po ON po.id = b.purchase_order_id
        WHERE po.mission_id = p_mission_id AND po.status <> 'cancelled' GROUP BY b.currency) o), '{}'::jsonb),
    'expenses_by_currency', COALESCE((SELECT jsonb_object_agg(currency, total) FROM (
        SELECT currency::text AS currency, SUM(amount)::numeric(20,8) AS total
        FROM public.proc_expenses WHERE mission_id = p_mission_id AND voided_at IS NULL GROUP BY currency) e), '{}'::jsonb),
    'commission_by_currency', COALESCE((SELECT jsonb_object_agg(currency, total) FROM (
        SELECT currency::text AS currency, SUM(computed_amount)::numeric(20,8) AS total
        FROM public.proc_commissions WHERE mission_id = p_mission_id GROUP BY currency) cc), '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'mission', v_mission,
    'suppliers', COALESCE(v_suppliers, '[]'::jsonb),
    'mission_commissions', v_commissions,
    'expenses', v_expenses,
    'totals', v_totals,
    'generated_at', now()
  );
END;
$$;
COMMENT ON FUNCTION public.proc_mission_report(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewProcurement","confirm":false,"danger":false,"label":"Generer le rapport d''une mission d''achat"}';

-- ── RPC: proc_procurement_dashboard ── (control tower)
CREATE OR REPLACE FUNCTION public.proc_procurement_dashboard(
  p_client_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_active_missions JSONB;
  v_outstanding    JSONB;
  v_alert_no_qc    JSONB;
  v_alert_overdue  JSONB;
  v_recent_payments JSONB;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'reference', m.reference, 'label', m.label, 'location', m.location,
    'started_on', m.started_on, 'client_user_id', m.client_user_id) ORDER BY m.created_at DESC), '[]'::jsonb)
  INTO v_active_missions
  FROM public.proc_missions m
  WHERE m.status = 'active' AND (p_client_user_id IS NULL OR m.client_user_id = p_client_user_id);

  SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) INTO v_outstanding
  FROM (
    SELECT b.currency::text AS currency, SUM(b.outstanding_amount)::numeric(20,8) AS total
    FROM public.proc_po_balances b
    JOIN public.proc_purchase_orders po ON po.id = b.purchase_order_id
    JOIN public.proc_missions m ON m.id = b.mission_id
    WHERE po.status <> 'cancelled'
      AND (p_client_user_id IS NULL OR m.client_user_id = p_client_user_id)
    GROUP BY b.currency
  ) t;

  -- Alerte : un solde/final payé sans QC "pass" (gate souple)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'purchase_order_id', po.id, 'reference', po.reference, 'supplier_name', s.display_name,
    'mission_reference', m.reference)), '[]'::jsonb)
  INTO v_alert_no_qc
  FROM public.proc_purchase_orders po
  JOIN public.proc_suppliers s ON s.id = po.supplier_id
  JOIN public.proc_missions m ON m.id = po.mission_id
  WHERE po.status <> 'cancelled'
    AND (p_client_user_id IS NULL OR m.client_user_id = p_client_user_id)
    AND EXISTS (SELECT 1 FROM public.proc_supplier_payments pp
                WHERE pp.purchase_order_id = po.id AND pp.voided_at IS NULL AND pp.leg IN ('balance', 'final'))
    AND NOT EXISTS (SELECT 1 FROM public.proc_qc_inspections q
                WHERE q.purchase_order_id = po.id AND q.voided_at IS NULL AND q.result = 'pass');

  -- Alerte : production en retard (date prévue dépassée, commande ouverte, pas expédiée)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'purchase_order_id', po.id, 'reference', po.reference, 'supplier_name', s.display_name,
    'expected_ready_date', po.expected_ready_date, 'mission_reference', m.reference)), '[]'::jsonb)
  INTO v_alert_overdue
  FROM public.proc_purchase_orders po
  JOIN public.proc_suppliers s ON s.id = po.supplier_id
  JOIN public.proc_missions m ON m.id = po.mission_id
  WHERE po.status = 'open'
    AND po.expected_ready_date IS NOT NULL AND po.expected_ready_date < CURRENT_DATE
    AND (p_client_user_id IS NULL OR m.client_user_id = p_client_user_id)
    AND COALESCE((SELECT pe.status::text FROM public.proc_production_events pe
                  WHERE pe.purchase_order_id = po.id ORDER BY pe.occurred_at DESC LIMIT 1), '') <> 'shipped';

  SELECT COALESCE(jsonb_agg(row_to_json(rp) ORDER BY rp.occurred_at DESC), '[]'::jsonb) INTO v_recent_payments
  FROM (
    SELECT pp.id, pp.reference, pp.amount, pp.currency, pp.leg, pp.method, pp.occurred_at,
           po.reference AS po_reference, s.display_name AS supplier_name
    FROM public.proc_supplier_payments pp
    JOIN public.proc_purchase_orders po ON po.id = pp.purchase_order_id
    JOIN public.proc_suppliers s ON s.id = po.supplier_id
    JOIN public.proc_missions m ON m.id = po.mission_id
    WHERE pp.voided_at IS NULL
      AND (p_client_user_id IS NULL OR m.client_user_id = p_client_user_id)
    ORDER BY pp.occurred_at DESC
    LIMIT 10
  ) rp;

  RETURN jsonb_build_object(
    'success', true,
    'active_missions', v_active_missions,
    'active_mission_count', jsonb_array_length(v_active_missions),
    'outstanding_by_currency', v_outstanding,
    'alerts', jsonb_build_object(
      'balance_without_qc_pass', v_alert_no_qc,
      'production_overdue', v_alert_overdue
    ),
    'recent_payments', v_recent_payments
  );
END;
$$;
COMMENT ON FUNCTION public.proc_procurement_dashboard(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewProcurement","confirm":false,"danger":false,"label":"Tableau de bord centrale d''achat (control tower)"}';

-- ── RPC: proc_list_missions ── (liste + filtre statut/client)
CREATE OR REPLACE FUNCTION public.proc_list_missions(
  p_status         public.proc_mission_status DEFAULT NULL,
  p_client_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_rows    JSONB;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.can_access_procurement(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces centrale d''achat refuse');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'reference', m.reference, 'label', m.label, 'location', m.location,
    'status', m.status, 'started_on', m.started_on, 'ended_on', m.ended_on,
    'client_user_id', m.client_user_id,
    'client_name', NULLIF(trim(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''),
    'company_name', c.company_name,
    'purchase_order_count', (SELECT count(*) FROM public.proc_purchase_orders po WHERE po.mission_id = m.id),
    'outstanding_by_currency', COALESCE((SELECT jsonb_object_agg(currency, total) FROM (
        SELECT b.currency::text AS currency, SUM(b.outstanding_amount)::numeric(20,8) AS total
        FROM public.proc_po_balances b
        JOIN public.proc_purchase_orders po ON po.id = b.purchase_order_id
        WHERE po.mission_id = m.id AND po.status <> 'cancelled' GROUP BY b.currency) o), '{}'::jsonb)
  ) ORDER BY m.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM public.proc_missions m
  LEFT JOIN public.clients c ON c.user_id = m.client_user_id
  WHERE (p_status IS NULL OR m.status = p_status)
    AND (p_client_user_id IS NULL OR m.client_user_id = p_client_user_id);

  RETURN jsonb_build_object('success', true, 'missions', v_rows);
END;
$$;
COMMENT ON FUNCTION public.proc_list_missions(public.proc_mission_status, UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewProcurement","confirm":false,"danger":false,"label":"Lister les missions d''achat"}';

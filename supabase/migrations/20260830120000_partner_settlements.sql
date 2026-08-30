-- ============================================================
-- Règlements partenaire Chine — chaque paiement client réglé
-- directement par le partenaire (acheteur CNY) devient une vente
-- USDT traçable, sans double saisie.
--
-- Contexte métier : depuis le nouveau fonctionnement, chaque QR
-- Alipay client est payé immédiatement par le partenaire en Chine
-- au taux USDT/CNY du moment. Chaque paiement complété est donc
-- une micro-vente USDT (USDT dû = CNY / taux). Ce lot ajoute :
--   1. usdt_sales.payment_id — lien vente ↔ paiement client
--      (unique tant que la vente n'est pas annulée).
--   2. treasury_counterparties.settlement_rate — taux de
--      règlement courant de l'acheteur (CNY par USDT), mis à
--      jour uniquement quand le partenaire annonce un nouveau
--      taux.
--   3. RPC set_counterparty_settlement_rate.
--   4. RPC settle_payments_usdt — règle un lot de paiements en
--      une seule opération : une ligne usdt_sales par paiement
--      (CNY = amount_rmb, USDT calculé au taux, WAC figé,
--      débit du pool USDT). Pas de crédit CNY : le CNY va
--      directement au fournisseur du client, jamais sur un
--      compte Bonzini.
--   5. RPC get_unsettled_payments — paiements complétés sans
--      vente liée active.
--   6. RPC get_usdt_sales_monthly — totaux mensuels (USDT
--      vendu, CNY, taux moyen pondéré) pour la clôture de fin
--      de mois.
-- ============================================================

-- ── 1. Lien vente ↔ paiement client ──
ALTER TABLE public.usdt_sales
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id);

-- Un paiement ne peut être réglé que par une seule vente active.
-- L'annulation (voided_at) libère le paiement pour re-règlement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usdt_sales_payment_unique
  ON public.usdt_sales(payment_id)
  WHERE payment_id IS NOT NULL AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_usdt_sales_payment
  ON public.usdt_sales(payment_id)
  WHERE payment_id IS NOT NULL;

-- ── 2. Taux de règlement courant par acheteur CNY ──
ALTER TABLE public.treasury_counterparties
  ADD COLUMN IF NOT EXISTS settlement_rate NUMERIC(20, 8)
    CHECK (settlement_rate IS NULL OR settlement_rate > 0),
  ADD COLUMN IF NOT EXISTS settlement_rate_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.treasury_counterparties.settlement_rate IS
  'Taux de reglement courant de l''acheteur CNY (CNY par USDT). Applique par defaut aux reglements de paiements.';

-- ── 3. RPC: mettre à jour le taux de règlement d'un acheteur ──
CREATE OR REPLACE FUNCTION public.set_counterparty_settlement_rate(
  p_counterparty_id UUID,
  p_rate NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_cp      public.treasury_counterparties%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_rate IS NULL OR p_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le taux doit etre strictement positif');
  END IF;

  SELECT * INTO v_cp FROM public.treasury_counterparties WHERE id = p_counterparty_id;
  IF v_cp.id IS NULL OR v_cp.type <> 'cny_buyer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acheteur CNY invalide');
  END IF;

  UPDATE public.treasury_counterparties
  SET settlement_rate = p_rate,
      settlement_rate_updated_at = now(),
      updated_at = now()
  WHERE id = p_counterparty_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'set_counterparty_settlement_rate', 'treasury_counterparty', p_counterparty_id,
    jsonb_build_object(
      'short_id', v_cp.short_id,
      'display_name', v_cp.display_name,
      'old_rate', v_cp.settlement_rate,
      'new_rate', p_rate
    ));

  RETURN jsonb_build_object(
    'success', true,
    'counterparty_id', p_counterparty_id,
    'settlement_rate', p_rate,
    'previous_rate', v_cp.settlement_rate
  );
END;
$$;

-- ── 4. RPC: régler un lot de paiements clients en USDT ──
CREATE OR REPLACE FUNCTION public.settle_payments_usdt(
  p_payment_ids UUID[],
  p_buyer_id    UUID,
  p_rate        NUMERIC DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_buyer       public.treasury_counterparties%ROWTYPE;
  v_usdt_pool   public.treasury_accounts%ROWTYPE;
  v_rate        NUMERIC;
  v_wac         NUMERIC;
  v_payment     RECORD;
  v_pid         UUID;
  v_usdt        NUMERIC;
  v_sale_id     UUID;
  v_settled     JSONB := '[]'::jsonb;
  v_skipped     JSONB := '[]'::jsonb;
  v_total_usdt  NUMERIC := 0;
  v_total_cny   NUMERIC := 0;
  v_stock_after NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_payment_ids IS NULL OR array_length(p_payment_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun paiement fourni');
  END IF;

  SELECT * INTO v_buyer FROM public.treasury_counterparties WHERE id = p_buyer_id;
  IF v_buyer.id IS NULL OR v_buyer.type <> 'cny_buyer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acheteur CNY invalide');
  END IF;

  v_rate := COALESCE(p_rate, v_buyer.settlement_rate);
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Aucun taux de reglement : fournissez un taux ou definissez le taux courant de l''acheteur');
  END IF;

  SELECT * INTO v_usdt_pool FROM public.treasury_accounts WHERE code = 'usdt_pool';
  IF v_usdt_pool.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pool USDT introuvable');
  END IF;

  v_wac := public.get_wac_usdt(p_occurred_at);

  FOREACH v_pid IN ARRAY p_payment_ids LOOP
    SELECT id, reference, amount_rmb, amount_xaf, status
    INTO v_payment
    FROM public.payments
    WHERE id = v_pid;

    IF v_payment.id IS NULL THEN
      v_skipped := v_skipped || jsonb_build_object('payment_id', v_pid, 'reason', 'Paiement introuvable');
      CONTINUE;
    END IF;

    IF v_payment.status <> 'completed' THEN
      v_skipped := v_skipped || jsonb_build_object(
        'payment_id', v_pid, 'reference', v_payment.reference,
        'reason', 'Paiement non complete (' || v_payment.status::text || ')');
      CONTINUE;
    END IF;

    IF v_payment.amount_rmb IS NULL OR v_payment.amount_rmb <= 0 THEN
      v_skipped := v_skipped || jsonb_build_object(
        'payment_id', v_pid, 'reference', v_payment.reference,
        'reason', 'Montant CNY invalide');
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.usdt_sales s
      WHERE s.payment_id = v_pid AND s.voided_at IS NULL
    ) THEN
      v_skipped := v_skipped || jsonb_build_object(
        'payment_id', v_pid, 'reference', v_payment.reference,
        'reason', 'Deja regle');
      CONTINUE;
    END IF;

    v_usdt := ROUND(v_payment.amount_rmb / v_rate, 8);

    INSERT INTO public.usdt_sales (
      occurred_at, buyer_id, cny_account_id, usdt_amount, cny_amount,
      wac_at_sale, external_ref, notes, payment_id, created_by
    ) VALUES (
      p_occurred_at, p_buyer_id, NULL, v_usdt, v_payment.amount_rmb,
      v_wac, v_payment.reference, 'Reglement paiement client', v_pid, v_user_id
    )
    RETURNING id INTO v_sale_id;

    INSERT INTO public.treasury_ledger_entries (
      account_id, currency, amount, occurred_at, entry_kind,
      source_table, source_id, metadata, created_by
    ) VALUES (
      v_usdt_pool.id, 'USDT', -v_usdt, p_occurred_at, 'usdt_sale_debit_usdt',
      'usdt_sale', v_sale_id,
      jsonb_build_object(
        'buyer_id', p_buyer_id,
        'payment_id', v_pid,
        'wac_at_sale', v_wac,
        'cost_basis_xaf', v_usdt * v_wac,
        'settlement_rate', v_rate
      ),
      v_user_id
    );

    v_total_usdt := v_total_usdt + v_usdt;
    v_total_cny  := v_total_cny + v_payment.amount_rmb;
    v_settled := v_settled || jsonb_build_object(
      'payment_id', v_pid,
      'reference', v_payment.reference,
      'sale_id', v_sale_id,
      'cny_amount', v_payment.amount_rmb,
      'usdt_amount', v_usdt
    );
  END LOOP;

  v_stock_after := public.get_usdt_stock(p_occurred_at);

  IF jsonb_array_length(v_settled) > 0 THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_user_id, 'settle_payments_usdt', 'treasury_counterparty', p_buyer_id,
      jsonb_build_object(
        'rate', v_rate,
        'settled_count', jsonb_array_length(v_settled),
        'skipped_count', jsonb_array_length(v_skipped),
        'total_usdt', v_total_usdt,
        'total_cny', v_total_cny,
        'stock_usdt_after', v_stock_after,
        'settled', v_settled
      ));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'rate', v_rate,
    'settled_count', jsonb_array_length(v_settled),
    'skipped_count', jsonb_array_length(v_skipped),
    'total_usdt', ROUND(v_total_usdt, 8),
    'total_cny', ROUND(v_total_cny, 2),
    'settled', v_settled,
    'skipped', v_skipped,
    'stock_usdt_after', v_stock_after,
    'warning_negative_stock', v_stock_after < 0
  );
END;
$$;

-- ── 5. RPC: paiements complétés non encore réglés ──
CREATE OR REPLACE FUNCTION public.get_unsettled_payments(
  p_from_date TIMESTAMPTZ DEFAULT NULL,
  p_to_date   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_rows     JSONB;
  v_count    INTEGER;
  v_cny      NUMERIC;
  v_xaf      NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  WITH unsettled AS (
    SELECT
      p.id, p.reference, p.method, p.amount_rmb, p.amount_xaf,
      p.exchange_rate, p.created_at, p.processed_at,
      TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) AS client_name,
      c.company_name
    FROM public.payments p
    LEFT JOIN public.clients c ON c.user_id = p.user_id
    WHERE p.status = 'completed'
      AND p.amount_rmb > 0
      AND (p_from_date IS NULL OR p.created_at >= p_from_date)
      AND (p_to_date IS NULL OR p.created_at <= p_to_date)
      AND NOT EXISTS (
        SELECT 1 FROM public.usdt_sales s
        WHERE s.payment_id = p.id AND s.voided_at IS NULL
      )
    ORDER BY p.created_at DESC
    LIMIT 500
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb),
    COUNT(*),
    COALESCE(SUM(u.amount_rmb), 0),
    COALESCE(SUM(u.amount_xaf), 0)
  INTO v_rows, v_count, v_cny, v_xaf
  FROM unsettled u;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'total_cny', v_cny,
    'total_xaf', v_xaf,
    'payments', v_rows
  );
END;
$$;

-- ── 6. RPC: totaux mensuels des ventes USDT ──
CREATE OR REPLACE FUNCTION public.get_usdt_sales_monthly(
  p_months INTEGER DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_months  JSONB;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_months IS NULL OR p_months < 1 OR p_months > 60 THEN
    p_months := 12;
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'month') DESC), '[]'::jsonb)
  INTO v_months
  FROM (
    SELECT jsonb_build_object(
      'month', to_char(date_trunc('month', s.occurred_at), 'YYYY-MM'),
      'sale_count', COUNT(*),
      'settlement_count', COUNT(*) FILTER (WHERE s.payment_id IS NOT NULL),
      'manual_count', COUNT(*) FILTER (WHERE s.payment_id IS NULL),
      'total_usdt', ROUND(SUM(s.usdt_amount), 4),
      'total_cny', ROUND(SUM(s.cny_amount), 2),
      'weighted_avg_rate_cny_per_usdt',
        CASE WHEN SUM(s.usdt_amount) > 0
          THEN ROUND(SUM(s.cny_amount) / SUM(s.usdt_amount), 4)
          ELSE 0 END,
      'cost_basis_xaf', ROUND(SUM(s.usdt_amount * s.wac_at_sale), 0)
    ) AS row
    FROM public.usdt_sales s
    WHERE s.voided_at IS NULL
      AND s.occurred_at >= date_trunc('month', now()) - make_interval(months => p_months - 1)
    GROUP BY date_trunc('month', s.occurred_at)
  ) t;

  RETURN jsonb_build_object(
    'success', true,
    'months', v_months
  );
END;
$$;

-- ── 7. Étiquettes Mola (convention AI-native) ──
COMMENT ON FUNCTION public.set_counterparty_settlement_rate(UUID, NUMERIC) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","confirm":true,"danger":false,"label":"Mettre a jour le taux de reglement d''un acheteur CNY"}';

COMMENT ON FUNCTION public.settle_payments_usdt(UUID[], UUID, NUMERIC, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","confirm":true,"danger":true,"label":"Regler des paiements clients en USDT (vente au partenaire Chine)"}';

COMMENT ON FUNCTION public.get_unsettled_payments(TIMESTAMPTZ, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewTreasury","confirm":false,"danger":false,"label":"Lister les paiements completes non regles en USDT"}';

COMMENT ON FUNCTION public.get_usdt_sales_monthly(INTEGER) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewTreasury","confirm":false,"danger":false,"label":"Totaux mensuels des ventes USDT (quantite vendue, CNY, taux moyen)"}';

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Treasury Lot 3 — SECURITY DEFINER RPCs
--
-- Every treasury mutation flows through one of these functions.
-- The treasury_* tables block direct INSERT/UPDATE/DELETE via
-- RLS (Lot 1) — only SECURITY DEFINER RPCs can write, and each
-- RPC checks can_access_treasury(auth.uid()) before doing so.
-- Voiding is restricted further to super_admin (treasurer cannot
-- undo their own entries — separation of powers requested by
-- the business).
--
-- All entries to treasury_ledger_entries are emitted by these
-- RPCs, never by application code. Sales freeze wac_at_sale at
-- the moment of writing so the marge per sale stays auditable
-- even if later purchases shift the running WAC.
-- ============================================================

-- ── Internal helper: XAF cost of 1 CNY at a given time and kind ──
-- Pulls the most recent daily_rates row effective at or before
-- p_at and maps the account kind to the matching column.
-- Returns NULL if no rate row exists or the rate is non-positive.
CREATE OR REPLACE FUNCTION public.get_xaf_per_cny_at(
  p_kind public.treasury_account_kind,
  p_at TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN col_rate IS NULL OR col_rate <= 0 THEN NULL
    ELSE 1000000.0 / col_rate
  END
  FROM (
    SELECT CASE p_kind
      WHEN 'cash'   THEN dr.rate_cash
      WHEN 'alipay' THEN dr.rate_alipay
      WHEN 'wechat' THEN dr.rate_wechat
      ELSE dr.rate_virement
    END AS col_rate
    FROM public.daily_rates dr
    WHERE dr.effective_at <= p_at
    ORDER BY dr.effective_at DESC
    LIMIT 1
  ) sub
$$;

COMMENT ON FUNCTION public.get_xaf_per_cny_at IS
  'Returns XAF cost of 1 CNY at p_at, derived from daily_rates and mapped to the account kind. NULL if no rate exists yet.';

-- ── RPC: get_wac_usdt ──
-- Weighted Average Cost of the USDT pool as of p_at (inclusive).
-- Algorithm: replay the ledger of the USDT pool — every purchase
-- credits (+xaf_amount, +usdt_amount); every sale debits at the
-- frozen wac_at_sale (-usdt*wac, -usdt). Voided rows excluded.
-- WAC = cumulative cost basis / cumulative USDT in stock.
CREATE OR REPLACE FUNCTION public.get_wac_usdt(
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ledger AS (
    SELECT p.xaf_amount AS xaf_delta, p.usdt_amount AS usdt_delta
    FROM public.usdt_purchases p
    WHERE p.voided_at IS NULL
      AND p.occurred_at <= p_at
    UNION ALL
    SELECT -(s.usdt_amount * s.wac_at_sale) AS xaf_delta,
           -s.usdt_amount                   AS usdt_delta
    FROM public.usdt_sales s
    WHERE s.voided_at IS NULL
      AND s.occurred_at <= p_at
  )
  SELECT CASE
    WHEN COALESCE(SUM(usdt_delta), 0) > 0
      THEN ROUND(SUM(xaf_delta) / SUM(usdt_delta), 8)
    ELSE 0
  END
  FROM ledger
$$;

-- ── RPC: get_usdt_stock ──
-- Net USDT in the pool as of p_at. May be negative if a sale was
-- recorded before its matching purchase (allowed by design;
-- surfaced as a warning in the dashboard).
CREATE OR REPLACE FUNCTION public.get_usdt_stock(
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT SUM(usdt_amount) FROM public.usdt_purchases
     WHERE voided_at IS NULL AND occurred_at <= p_at), 0)
  -
  COALESCE(
    (SELECT SUM(usdt_amount) FROM public.usdt_sales
     WHERE voided_at IS NULL AND occurred_at <= p_at), 0)
$$;

-- ── RPC: record_usdt_purchase ──
CREATE OR REPLACE FUNCTION public.record_usdt_purchase(
  p_supplier_id   UUID,
  p_xaf_account_id UUID,
  p_xaf_amount    NUMERIC,
  p_usdt_amount   NUMERIC,
  p_channel       public.treasury_channel_xaf,
  p_occurred_at   TIMESTAMPTZ DEFAULT now(),
  p_external_ref  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_supplier       public.treasury_counterparties%ROWTYPE;
  v_xaf_account    public.treasury_accounts%ROWTYPE;
  v_usdt_pool      public.treasury_accounts%ROWTYPE;
  v_purchase_id    UUID;
  v_new_wac        NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_xaf_amount IS NULL OR p_xaf_amount <= 0 OR p_usdt_amount IS NULL OR p_usdt_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les montants doivent etre strictement positifs');
  END IF;

  SELECT * INTO v_supplier FROM public.treasury_counterparties WHERE id = p_supplier_id;
  IF v_supplier.id IS NULL OR v_supplier.type <> 'usdt_supplier' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fournisseur USDT invalide');
  END IF;

  SELECT * INTO v_xaf_account FROM public.treasury_accounts WHERE id = p_xaf_account_id;
  IF v_xaf_account.id IS NULL OR v_xaf_account.currency <> 'XAF' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte XAF invalide');
  END IF;

  SELECT * INTO v_usdt_pool FROM public.treasury_accounts WHERE code = 'usdt_pool';
  IF v_usdt_pool.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pool USDT introuvable');
  END IF;

  INSERT INTO public.usdt_purchases (
    occurred_at, supplier_id, xaf_account_id, xaf_amount, usdt_amount,
    channel, external_ref, notes, created_by
  ) VALUES (
    p_occurred_at, p_supplier_id, p_xaf_account_id, p_xaf_amount, p_usdt_amount,
    p_channel, NULLIF(trim(p_external_ref), ''), NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_purchase_id;

  INSERT INTO public.treasury_ledger_entries (
    account_id, currency, amount, occurred_at, entry_kind,
    source_table, source_id, metadata, created_by
  )
  VALUES
    (v_xaf_account.id, 'XAF', -p_xaf_amount, p_occurred_at, 'usdt_purchase_debit_xaf',
     'usdt_purchase', v_purchase_id,
     jsonb_build_object('supplier_id', p_supplier_id, 'channel', p_channel),
     v_user_id),
    (v_usdt_pool.id, 'USDT', p_usdt_amount, p_occurred_at, 'usdt_purchase_credit_usdt',
     'usdt_purchase', v_purchase_id,
     jsonb_build_object('supplier_id', p_supplier_id, 'xaf_amount', p_xaf_amount,
                        'implicit_rate', p_xaf_amount / p_usdt_amount),
     v_user_id);

  v_new_wac := public.get_wac_usdt(p_occurred_at);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'record_usdt_purchase', 'usdt_purchase', v_purchase_id,
    jsonb_build_object(
      'xaf_amount', p_xaf_amount,
      'usdt_amount', p_usdt_amount,
      'implicit_rate', p_xaf_amount / p_usdt_amount,
      'supplier_id', p_supplier_id,
      'new_wac', v_new_wac
    ));

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'implicit_rate', ROUND(p_xaf_amount / p_usdt_amount, 8),
    'new_wac', v_new_wac
  );
END;
$$;

-- ── RPC: record_usdt_sale ──
-- USDT stock may go negative (Phase 0 decision: warning only,
-- no block). The sale is still recorded and the dashboard
-- flags the negative pool until a back-dated purchase fills it.
CREATE OR REPLACE FUNCTION public.record_usdt_sale(
  p_buyer_id      UUID,
  p_cny_account_id UUID,
  p_usdt_amount   NUMERIC,
  p_cny_amount    NUMERIC,
  p_occurred_at   TIMESTAMPTZ DEFAULT now(),
  p_external_ref  TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_buyer          public.treasury_counterparties%ROWTYPE;
  v_cny_account    public.treasury_accounts%ROWTYPE;
  v_usdt_pool      public.treasury_accounts%ROWTYPE;
  v_sale_id        UUID;
  v_wac            NUMERIC;
  v_stock_after    NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_usdt_amount IS NULL OR p_usdt_amount <= 0 OR p_cny_amount IS NULL OR p_cny_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les montants doivent etre strictement positifs');
  END IF;

  SELECT * INTO v_buyer FROM public.treasury_counterparties WHERE id = p_buyer_id;
  IF v_buyer.id IS NULL OR v_buyer.type <> 'cny_buyer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acheteur CNY invalide');
  END IF;

  SELECT * INTO v_cny_account FROM public.treasury_accounts WHERE id = p_cny_account_id;
  IF v_cny_account.id IS NULL OR v_cny_account.currency <> 'CNY' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte CNY invalide');
  END IF;

  SELECT * INTO v_usdt_pool FROM public.treasury_accounts WHERE code = 'usdt_pool';
  IF v_usdt_pool.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pool USDT introuvable');
  END IF;

  v_wac := public.get_wac_usdt(p_occurred_at);

  INSERT INTO public.usdt_sales (
    occurred_at, buyer_id, cny_account_id, usdt_amount, cny_amount,
    wac_at_sale, external_ref, notes, created_by
  ) VALUES (
    p_occurred_at, p_buyer_id, p_cny_account_id, p_usdt_amount, p_cny_amount,
    v_wac, NULLIF(trim(p_external_ref), ''), NULLIF(trim(p_notes), ''), v_user_id
  )
  RETURNING id INTO v_sale_id;

  INSERT INTO public.treasury_ledger_entries (
    account_id, currency, amount, occurred_at, entry_kind,
    source_table, source_id, metadata, created_by
  )
  VALUES
    (v_usdt_pool.id, 'USDT', -p_usdt_amount, p_occurred_at, 'usdt_sale_debit_usdt',
     'usdt_sale', v_sale_id,
     jsonb_build_object('buyer_id', p_buyer_id, 'wac_at_sale', v_wac,
                        'cost_basis_xaf', p_usdt_amount * v_wac),
     v_user_id),
    (v_cny_account.id, 'CNY', p_cny_amount, p_occurred_at, 'usdt_sale_credit_cny',
     'usdt_sale', v_sale_id,
     jsonb_build_object('buyer_id', p_buyer_id, 'usdt_amount', p_usdt_amount,
                        'implicit_rate', p_cny_amount / p_usdt_amount),
     v_user_id);

  v_stock_after := public.get_usdt_stock(p_occurred_at);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'record_usdt_sale', 'usdt_sale', v_sale_id,
    jsonb_build_object(
      'usdt_amount', p_usdt_amount,
      'cny_amount', p_cny_amount,
      'implicit_rate', p_cny_amount / p_usdt_amount,
      'wac_at_sale', v_wac,
      'buyer_id', p_buyer_id,
      'cny_account_id', p_cny_account_id,
      'stock_usdt_after', v_stock_after
    ));

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'implicit_rate', ROUND(p_cny_amount / p_usdt_amount, 8),
    'wac_at_sale', v_wac,
    'stock_usdt_after', v_stock_after,
    'warning_negative_stock', v_stock_after < 0
  );
END;
$$;

-- ── RPC: record_inventory_snapshot ──
-- Compares the theoretical balance (from the ledger) with the
-- actual balance saisi by the operator. Any non-zero variance
-- requires a written reason and creates an inventory_adjustment
-- ledger entry so the theoretical balance realigns with reality.
CREATE OR REPLACE FUNCTION public.record_inventory_snapshot(
  p_account_id      UUID,
  p_actual_balance  NUMERIC,
  p_variance_reason TEXT DEFAULT NULL,
  p_snapshot_at     TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id              UUID;
  v_account              public.treasury_accounts%ROWTYPE;
  v_theoretical          NUMERIC;
  v_variance             NUMERIC;
  v_snapshot_id          UUID;
  v_adjustment_entry_id  UUID;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_actual_balance IS NULL OR p_actual_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde constate invalide');
  END IF;

  SELECT * INTO v_account FROM public.treasury_accounts WHERE id = p_account_id;
  IF v_account.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Compte introuvable');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_theoretical
  FROM public.treasury_ledger_entries
  WHERE account_id = p_account_id AND occurred_at <= p_snapshot_at;

  v_variance := p_actual_balance - v_theoretical;

  IF v_variance <> 0 AND (p_variance_reason IS NULL OR length(trim(p_variance_reason)) < 10) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Motif obligatoire (10 caracteres min) car ecart de ' || v_variance::text);
  END IF;

  INSERT INTO public.treasury_inventory_snapshots (
    account_id, snapshot_at, theoretical_balance, actual_balance,
    variance_reason, created_by
  ) VALUES (
    p_account_id, p_snapshot_at, v_theoretical, p_actual_balance,
    NULLIF(trim(p_variance_reason), ''), v_user_id
  )
  RETURNING id INTO v_snapshot_id;

  IF v_variance <> 0 THEN
    INSERT INTO public.treasury_ledger_entries (
      account_id, currency, amount, occurred_at, entry_kind,
      source_table, source_id, metadata, created_by
    ) VALUES (
      p_account_id, v_account.currency, v_variance, p_snapshot_at, 'inventory_adjustment',
      'inventory_snapshot', v_snapshot_id,
      jsonb_build_object('reason', p_variance_reason, 'theoretical', v_theoretical, 'actual', p_actual_balance),
      v_user_id
    )
    RETURNING id INTO v_adjustment_entry_id;

    UPDATE public.treasury_inventory_snapshots
    SET adjustment_entry_id = v_adjustment_entry_id
    WHERE id = v_snapshot_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'record_inventory_snapshot', 'inventory_snapshot', v_snapshot_id,
    jsonb_build_object(
      'account_id', p_account_id,
      'theoretical', v_theoretical,
      'actual', p_actual_balance,
      'variance', v_variance,
      'reason', p_variance_reason
    ));

  RETURN jsonb_build_object(
    'success', true,
    'snapshot_id', v_snapshot_id,
    'theoretical_balance', v_theoretical,
    'actual_balance', p_actual_balance,
    'variance', v_variance,
    'adjustment_entry_id', v_adjustment_entry_id
  );
END;
$$;

-- ── RPC: void_treasury_operation ──
-- super_admin only. Inserts contra-entries that cancel out the
-- original ledger postings and flags the source row as voided.
-- The source row is preserved; the audit trail is the full
-- ledger including void entries.
CREATE OR REPLACE FUNCTION public.void_treasury_operation(
  p_source_table public.treasury_ledger_source_table,
  p_source_id    UUID,
  p_void_reason  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_is_super_admin BOOLEAN;
  v_purchase       public.usdt_purchases%ROWTYPE;
  v_sale           public.usdt_sales%ROWTYPE;
  v_orig_entries   RECORD;
  v_contra_ids     UUID[];
  v_now            TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  v_now := now();

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND (is_disabled = false OR is_disabled IS NULL)
      AND role::text = 'super_admin'
  ) INTO v_is_super_admin;

  IF NOT v_is_super_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Annulation reservee au super admin');
  END IF;

  IF p_void_reason IS NULL OR length(trim(p_void_reason)) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif obligatoire (10 caracteres min)');
  END IF;

  IF p_source_table = 'usdt_purchase' THEN
    SELECT * INTO v_purchase FROM public.usdt_purchases WHERE id = p_source_id;
    IF v_purchase.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Achat introuvable');
    END IF;
    IF v_purchase.voided_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Achat deja annule');
    END IF;
  ELSIF p_source_table = 'usdt_sale' THEN
    SELECT * INTO v_sale FROM public.usdt_sales WHERE id = p_source_id;
    IF v_sale.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
    END IF;
    IF v_sale.voided_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Vente deja annulee');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type d''operation non supporte');
  END IF;

  -- Insert one contra-entry per original ledger row (sign flipped).
  WITH originals AS (
    SELECT id, account_id, currency, amount, metadata
    FROM public.treasury_ledger_entries
    WHERE source_table = p_source_table AND source_id = p_source_id
  ), inserted AS (
    INSERT INTO public.treasury_ledger_entries (
      account_id, currency, amount, occurred_at, entry_kind,
      source_table, source_id, contra_entry_id, metadata, created_by
    )
    SELECT
      o.account_id,
      o.currency,
      -o.amount,
      v_now,
      'void'::public.treasury_ledger_entry_kind,
      'void'::public.treasury_ledger_source_table,
      p_source_id,
      o.id,
      jsonb_build_object('void_reason', p_void_reason,
                         'voided_source_table', p_source_table::text,
                         'original_metadata', o.metadata),
      v_user_id
    FROM originals o
    RETURNING id
  )
  SELECT array_agg(id) INTO v_contra_ids FROM inserted;

  IF p_source_table = 'usdt_purchase' THEN
    UPDATE public.usdt_purchases
    SET voided_at = v_now,
        voided_by = v_user_id,
        void_reason = p_void_reason,
        void_contra_entry_id = v_contra_ids[1]
    WHERE id = p_source_id;
  ELSE
    UPDATE public.usdt_sales
    SET voided_at = v_now,
        voided_by = v_user_id,
        void_reason = p_void_reason,
        void_contra_entry_id = v_contra_ids[1]
    WHERE id = p_source_id;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'void_treasury_operation', p_source_table::text, p_source_id,
    jsonb_build_object('reason', p_void_reason, 'contra_entry_ids', v_contra_ids));

  RETURN jsonb_build_object(
    'success', true,
    'source_table', p_source_table::text,
    'source_id', p_source_id,
    'contra_entry_ids', v_contra_ids,
    'contra_count', array_length(v_contra_ids, 1)
  );
END;
$$;

-- ── RPC: get_treasury_dashboard ──
-- Returns the 13 indicators in a single JSONB payload. The
-- frontend will pick what it needs by key. Heavy lifting is in
-- SQL so the client doesn't re-aggregate.
CREATE OR REPLACE FUNCTION public.get_treasury_dashboard(
  p_from_date TIMESTAMPTZ,
  p_to_date   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_balances         JSONB;
  v_totals           JSONB;
  v_purchases        JSONB;
  v_sales            JSONB;
  v_client           JSONB;
  v_wac              NUMERIC;
  v_stock_usdt       NUMERIC;
  v_spread_chain     NUMERIC;
  v_spread_client    NUMERIC;
  v_benefit_total    NUMERIC;
  v_capital_immob    NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  -- Per-account balances.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'code', code,
      'label', label,
      'currency', currency,
      'kind', kind,
      'balance', balance,
      'is_active', is_active
    ) ORDER BY sort_order
  ) INTO v_balances
  FROM public.treasury_account_balances;

  -- Totals per currency.
  SELECT jsonb_object_agg(currency, jsonb_build_object('total', total, 'account_count', cnt))
  INTO v_totals
  FROM (
    SELECT currency, SUM(balance)::numeric(20,8) AS total, COUNT(*) AS cnt
    FROM public.treasury_account_balances
    GROUP BY currency
  ) t;

  -- Purchase volume on period.
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'total_xaf', COALESCE(SUM(xaf_amount), 0),
    'total_usdt', COALESCE(SUM(usdt_amount), 0),
    'weighted_avg_rate_xaf_per_usdt',
      CASE WHEN COALESCE(SUM(usdt_amount), 0) > 0
        THEN ROUND(SUM(xaf_amount) / SUM(usdt_amount), 8)
        ELSE 0 END
  ) INTO v_purchases
  FROM public.usdt_purchases
  WHERE voided_at IS NULL
    AND occurred_at >= p_from_date AND occurred_at <= p_to_date;

  -- Sale volume on period, with chain spread reconstruction.
  WITH sales_period AS (
    SELECT s.*, a.kind AS cny_kind
    FROM public.usdt_sales s
    JOIN public.treasury_accounts a ON a.id = s.cny_account_id
    WHERE s.voided_at IS NULL
      AND s.occurred_at >= p_from_date AND s.occurred_at <= p_to_date
  )
  SELECT
    jsonb_build_object(
      'count', COUNT(*),
      'total_usdt', COALESCE(SUM(usdt_amount), 0),
      'total_cny', COALESCE(SUM(cny_amount), 0),
      'weighted_avg_rate_cny_per_usdt',
        CASE WHEN COALESCE(SUM(usdt_amount), 0) > 0
          THEN ROUND(SUM(cny_amount) / SUM(usdt_amount), 8)
          ELSE 0 END
    ),
    COALESCE(SUM(
      cny_amount * public.get_xaf_per_cny_at(cny_kind, occurred_at)
      - usdt_amount * wac_at_sale
    ), 0)
  INTO v_sales, v_spread_chain
  FROM sales_period;

  -- Client side rate (uses existing payments table).
  WITH client_payments AS (
    SELECT p.*, CASE p.method
      WHEN 'cash' THEN 'cash'::public.treasury_account_kind
      WHEN 'alipay' THEN 'alipay'::public.treasury_account_kind
      WHEN 'wechat' THEN 'wechat'::public.treasury_account_kind
      ELSE 'other'::public.treasury_account_kind
    END AS proxy_kind
    FROM public.payments p
    WHERE p.status = 'completed'
      AND p.created_at >= p_from_date AND p.created_at <= p_to_date
  )
  SELECT
    jsonb_build_object(
      'count', COUNT(*),
      'total_xaf', COALESCE(SUM(amount_xaf), 0),
      'total_cny', COALESCE(SUM(amount_rmb), 0),
      'weighted_avg_rate_xaf_per_cny',
        CASE WHEN COALESCE(SUM(amount_rmb), 0) > 0
          THEN ROUND(SUM(amount_xaf) / SUM(amount_rmb), 8)
          ELSE 0 END
    ),
    COALESCE(SUM(
      amount_xaf - amount_rmb * public.get_xaf_per_cny_at(proxy_kind, created_at)
    ), 0)
  INTO v_client, v_spread_client
  FROM client_payments;

  v_wac := public.get_wac_usdt(p_to_date);
  v_stock_usdt := public.get_usdt_stock(p_to_date);
  v_benefit_total := COALESCE(v_spread_chain, 0) + COALESCE(v_spread_client, 0);

  -- Instantaneous capital tied up: USDT stock at WAC + CNY balances valued at xaf_per_cny.
  SELECT
    GREATEST(0, v_stock_usdt) * v_wac
    + COALESCE(SUM(
        CASE WHEN tab.currency = 'CNY'
          THEN tab.balance * public.get_xaf_per_cny_at(tab.kind, p_to_date)
          ELSE 0 END
      ), 0)
  INTO v_capital_immob
  FROM public.treasury_account_balances tab;

  RETURN jsonb_build_object(
    'success', true,
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'balances', COALESCE(v_balances, '[]'::jsonb),
    'totals_by_currency', COALESCE(v_totals, '{}'::jsonb),
    'purchases', v_purchases,
    'sales', v_sales,
    'client_rate', v_client,
    'wac_usdt_current', v_wac,
    'stock_usdt', v_stock_usdt,
    'is_stock_usdt_negative', v_stock_usdt < 0,
    'spread_chain_xaf', ROUND(v_spread_chain::numeric, 2),
    'spread_client_xaf', ROUND(v_spread_client::numeric, 2),
    'benefit_total_xaf', ROUND(v_benefit_total::numeric, 2),
    'capital_immobilized_current_xaf', ROUND(v_capital_immob::numeric, 2)
  );
END;
$$;

-- ── RPC: get_top_counterparties ──
-- Top N counterparties by USDT volume on the period, with their
-- weighted average rate and deviation vs the period mean (a
-- "drift" indicator surfacing suppliers/buyers worth a closer look).
CREATE OR REPLACE FUNCTION public.get_top_counterparties(
  p_type      public.treasury_counterparty_type,
  p_from_date TIMESTAMPTZ,
  p_to_date   TIMESTAMPTZ,
  p_limit     INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_result   JSONB;
  v_overall  NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_type = 'usdt_supplier' THEN
    SELECT
      CASE WHEN SUM(usdt_amount) > 0 THEN SUM(xaf_amount) / SUM(usdt_amount) ELSE 0 END
    INTO v_overall
    FROM public.usdt_purchases
    WHERE voided_at IS NULL
      AND occurred_at >= p_from_date AND occurred_at <= p_to_date;

    SELECT jsonb_agg(row_to_json(t) ORDER BY total_usdt DESC) INTO v_result
    FROM (
      SELECT
        c.id, c.display_name, c.phone, c.wechat_id,
        COUNT(p.id)::int AS operation_count,
        SUM(p.usdt_amount)::numeric(20,8) AS total_usdt,
        SUM(p.xaf_amount)::numeric(20,8) AS total_xaf,
        CASE WHEN SUM(p.usdt_amount) > 0
          THEN ROUND(SUM(p.xaf_amount) / SUM(p.usdt_amount), 8)
          ELSE 0
        END AS weighted_avg_rate,
        CASE WHEN v_overall > 0 AND SUM(p.usdt_amount) > 0
          THEN ROUND(((SUM(p.xaf_amount) / SUM(p.usdt_amount)) - v_overall) / v_overall * 100, 4)
          ELSE 0
        END AS deviation_pct,
        MAX(p.occurred_at) AS last_op_at
      FROM public.treasury_counterparties c
      JOIN public.usdt_purchases p ON p.supplier_id = c.id
      WHERE c.type = 'usdt_supplier'
        AND p.voided_at IS NULL
        AND p.occurred_at >= p_from_date AND p.occurred_at <= p_to_date
      GROUP BY c.id, c.display_name, c.phone, c.wechat_id
      ORDER BY SUM(p.usdt_amount) DESC
      LIMIT p_limit
    ) t;
  ELSE
    SELECT
      CASE WHEN SUM(usdt_amount) > 0 THEN SUM(cny_amount) / SUM(usdt_amount) ELSE 0 END
    INTO v_overall
    FROM public.usdt_sales
    WHERE voided_at IS NULL
      AND occurred_at >= p_from_date AND occurred_at <= p_to_date;

    SELECT jsonb_agg(row_to_json(t) ORDER BY total_usdt DESC) INTO v_result
    FROM (
      SELECT
        c.id, c.display_name, c.phone, c.wechat_id,
        COUNT(s.id)::int AS operation_count,
        SUM(s.usdt_amount)::numeric(20,8) AS total_usdt,
        SUM(s.cny_amount)::numeric(20,8) AS total_cny,
        CASE WHEN SUM(s.usdt_amount) > 0
          THEN ROUND(SUM(s.cny_amount) / SUM(s.usdt_amount), 8)
          ELSE 0
        END AS weighted_avg_rate,
        CASE WHEN v_overall > 0 AND SUM(s.usdt_amount) > 0
          THEN ROUND(((SUM(s.cny_amount) / SUM(s.usdt_amount)) - v_overall) / v_overall * 100, 4)
          ELSE 0
        END AS deviation_pct,
        MAX(s.occurred_at) AS last_op_at
      FROM public.treasury_counterparties c
      JOIN public.usdt_sales s ON s.buyer_id = c.id
      WHERE c.type = 'cny_buyer'
        AND s.voided_at IS NULL
        AND s.occurred_at >= p_from_date AND s.occurred_at <= p_to_date
      GROUP BY c.id, c.display_name, c.phone, c.wechat_id
      ORDER BY SUM(s.usdt_amount) DESC
      LIMIT p_limit
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'type', p_type::text,
    'overall_weighted_avg_rate', ROUND(v_overall::numeric, 8),
    'top', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

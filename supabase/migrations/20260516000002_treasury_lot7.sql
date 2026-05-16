-- ============================================================
-- Treasury Lot 7 — Sale flexibility, short_ids, counterparty
-- editing/deletion, taux de revient in dashboard.
--
-- Changes:
--   1. usdt_sales.cny_account_id becomes nullable. Sales record
--      "I sold X USDT for Y CNY" without forcing a destination.
--      Bonzini cash positions are tracked via adjust_treasury_account.
--   2. treasury_counterparties.short_id (TEXT, NOT NULL) auto-
--      assigned by trigger, prefix F- for suppliers / A- for
--      buyers, separate sequences per type. Existing rows
--      backfilled by created_at order.
--   3. update_treasury_counterparty already exists (Lot 4) —
--      no change needed.
--   4. delete_treasury_counterparty(id): hard delete if zero
--      operations reference the row, otherwise refuse with a
--      clear error inviting the caller to archive instead.
--   5. record_usdt_sale: cny_account_id parameter now optional.
--      When NULL, no CNY ledger entry is posted (USDT side only).
--   6. get_treasury_dashboard: handles null cny_account
--      gracefully (defaults to rate_virement for spread_chain
--      calculation) and emits taux_de_revient_xaf_per_cny in
--      the JSONB payload.
-- ============================================================

-- ── 1. Sale CNY account becomes optional ──
ALTER TABLE public.usdt_sales ALTER COLUMN cny_account_id DROP NOT NULL;

-- ── 2. Counterparty short_id ──
ALTER TABLE public.treasury_counterparties ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.treasury_supplier_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.treasury_buyer_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_counterparty_short_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.short_id IS NULL THEN
    NEW.short_id := CASE NEW.type
      WHEN 'usdt_supplier' THEN 'F-' || lpad(nextval('public.treasury_supplier_seq')::text, 3, '0')
      WHEN 'cny_buyer'     THEN 'A-' || lpad(nextval('public.treasury_buyer_seq')::text, 3, '0')
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_counterparty_short_id ON public.treasury_counterparties;
CREATE TRIGGER trg_assign_counterparty_short_id
BEFORE INSERT ON public.treasury_counterparties
FOR EACH ROW
EXECUTE FUNCTION public.assign_counterparty_short_id();

-- Backfill existing rows (preserve creation order within each type).
DO $$
DECLARE
  v_supplier_count INTEGER;
  v_buyer_count INTEGER;
BEGIN
  WITH ordered AS (
    SELECT id, type, ROW_NUMBER() OVER (PARTITION BY type ORDER BY created_at, id) AS rn
    FROM public.treasury_counterparties
    WHERE short_id IS NULL
  )
  UPDATE public.treasury_counterparties t
  SET short_id = CASE o.type
    WHEN 'usdt_supplier' THEN 'F-' || lpad(o.rn::text, 3, '0')
    WHEN 'cny_buyer'     THEN 'A-' || lpad(o.rn::text, 3, '0')
  END
  FROM ordered o
  WHERE t.id = o.id;

  -- Advance sequences past the highest backfilled value so future inserts don't collide.
  SELECT COUNT(*) INTO v_supplier_count FROM public.treasury_counterparties WHERE type = 'usdt_supplier';
  SELECT COUNT(*) INTO v_buyer_count FROM public.treasury_counterparties WHERE type = 'cny_buyer';
  IF v_supplier_count > 0 THEN
    PERFORM setval('public.treasury_supplier_seq', v_supplier_count);
  END IF;
  IF v_buyer_count > 0 THEN
    PERFORM setval('public.treasury_buyer_seq', v_buyer_count);
  END IF;
END $$;

ALTER TABLE public.treasury_counterparties ALTER COLUMN short_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_counterparties_short_id ON public.treasury_counterparties(short_id);

-- ── 3. Hard delete RPC (refuses when operations exist) ──
CREATE OR REPLACE FUNCTION public.delete_treasury_counterparty(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_purchase_count INTEGER;
  v_sale_count     INTEGER;
  v_short_id       TEXT;
  v_display_name   TEXT;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  SELECT short_id, display_name INTO v_short_id, v_display_name
  FROM public.treasury_counterparties
  WHERE id = p_id;

  IF v_short_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrepartie introuvable');
  END IF;

  SELECT COUNT(*) INTO v_purchase_count FROM public.usdt_purchases WHERE supplier_id = p_id;
  SELECT COUNT(*) INTO v_sale_count     FROM public.usdt_sales     WHERE buyer_id    = p_id;

  IF v_purchase_count + v_sale_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Contrepartie liee a ' || (v_purchase_count + v_sale_count)::text
               || ' operation(s). Archivez-la au lieu de la supprimer.',
      'operation_count', v_purchase_count + v_sale_count
    );
  END IF;

  DELETE FROM public.treasury_counterparties WHERE id = p_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'delete_treasury_counterparty', 'treasury_counterparty', p_id,
    jsonb_build_object('short_id', v_short_id, 'display_name', v_display_name));

  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

-- ── 4. record_usdt_sale: cny_account_id optional ──
DROP FUNCTION IF EXISTS public.record_usdt_sale(uuid, uuid, numeric, numeric, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.record_usdt_sale(
  p_buyer_id       UUID,
  p_usdt_amount    NUMERIC,
  p_cny_amount     NUMERIC,
  p_cny_account_id UUID DEFAULT NULL,
  p_occurred_at    TIMESTAMPTZ DEFAULT now(),
  p_external_ref   TEXT DEFAULT NULL,
  p_notes          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_buyer       public.treasury_counterparties%ROWTYPE;
  v_cny_account public.treasury_accounts%ROWTYPE;
  v_usdt_pool   public.treasury_accounts%ROWTYPE;
  v_sale_id     UUID;
  v_wac         NUMERIC;
  v_stock_after NUMERIC;
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

  -- Validate optional CNY account if provided.
  IF p_cny_account_id IS NOT NULL THEN
    SELECT * INTO v_cny_account FROM public.treasury_accounts WHERE id = p_cny_account_id;
    IF v_cny_account.id IS NULL OR v_cny_account.currency <> 'CNY' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Compte CNY invalide');
    END IF;
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

  -- Always post the USDT debit.
  INSERT INTO public.treasury_ledger_entries (
    account_id, currency, amount, occurred_at, entry_kind,
    source_table, source_id, metadata, created_by
  )
  VALUES
    (v_usdt_pool.id, 'USDT', -p_usdt_amount, p_occurred_at, 'usdt_sale_debit_usdt',
     'usdt_sale', v_sale_id,
     jsonb_build_object('buyer_id', p_buyer_id, 'wac_at_sale', v_wac,
                        'cost_basis_xaf', p_usdt_amount * v_wac),
     v_user_id);

  -- Only post the CNY credit if a Bonzini account was specified.
  IF v_cny_account.id IS NOT NULL THEN
    INSERT INTO public.treasury_ledger_entries (
      account_id, currency, amount, occurred_at, entry_kind,
      source_table, source_id, metadata, created_by
    )
    VALUES
      (v_cny_account.id, 'CNY', p_cny_amount, p_occurred_at, 'usdt_sale_credit_cny',
       'usdt_sale', v_sale_id,
       jsonb_build_object('buyer_id', p_buyer_id, 'usdt_amount', p_usdt_amount,
                          'implicit_rate', p_cny_amount / p_usdt_amount),
       v_user_id);
  END IF;

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

-- ── 5. Dashboard with taux_de_revient + null cny_account handling ──
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
  v_avg_purchase_xaf NUMERIC;
  v_avg_sale_cny     NUMERIC;
  v_revient          NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id, 'code', code, 'label', label, 'currency', currency,
      'kind', kind, 'balance', balance, 'is_active', is_active
    ) ORDER BY sort_order
  ) INTO v_balances
  FROM public.treasury_account_balances;

  SELECT jsonb_object_agg(currency, jsonb_build_object('total', total, 'account_count', cnt))
  INTO v_totals
  FROM (
    SELECT currency, SUM(balance)::numeric(20,8) AS total, COUNT(*) AS cnt
    FROM public.treasury_account_balances
    GROUP BY currency
  ) t;

  SELECT jsonb_build_object(
    'count', COUNT(*),
    'total_xaf', COALESCE(SUM(xaf_amount), 0),
    'total_usdt', COALESCE(SUM(usdt_amount), 0),
    'weighted_avg_rate_xaf_per_usdt',
      CASE WHEN COALESCE(SUM(usdt_amount), 0) > 0
        THEN ROUND(SUM(xaf_amount) / SUM(usdt_amount), 8)
        ELSE 0 END
  ),
  CASE WHEN COALESCE(SUM(usdt_amount), 0) > 0 THEN SUM(xaf_amount) / SUM(usdt_amount) ELSE 0 END
  INTO v_purchases, v_avg_purchase_xaf
  FROM public.usdt_purchases
  WHERE voided_at IS NULL
    AND occurred_at >= p_from_date AND occurred_at <= p_to_date;

  WITH sales_period AS (
    SELECT s.*, COALESCE(a.kind, 'other'::public.treasury_account_kind) AS cny_kind
    FROM public.usdt_sales s
    LEFT JOIN public.treasury_accounts a ON a.id = s.cny_account_id
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
    ), 0),
    CASE WHEN COALESCE(SUM(usdt_amount), 0) > 0 THEN SUM(cny_amount) / SUM(usdt_amount) ELSE 0 END
  INTO v_sales, v_spread_chain, v_avg_sale_cny
  FROM sales_period;

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

  -- Cost rate: how much XAF it costs Bonzini to deliver 1 CNY through the chain.
  v_revient := CASE WHEN v_avg_sale_cny > 0 THEN v_avg_purchase_xaf / v_avg_sale_cny ELSE NULL END;

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
    'capital_immobilized_current_xaf', ROUND(v_capital_immob::numeric, 2),
    'taux_de_revient_xaf_per_cny', CASE WHEN v_revient IS NULL THEN NULL ELSE ROUND(v_revient::numeric, 4) END
  );
END;
$$;

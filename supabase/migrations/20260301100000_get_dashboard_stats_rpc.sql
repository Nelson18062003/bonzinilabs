-- ============================================================
-- RPC: get_dashboard_stats
-- Replaces 6 separate frontend queries with a single DB round-trip.
-- Called by useDashboardStats() in useAdminData.ts
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start       timestamptz := date_trunc('day', now());
  v_week_start        timestamptz := date_trunc('day', now() - interval '7 days');

  v_total_clients     int;
  v_active_clients    int;
  v_total_balance     numeric;
  v_pending_deposits  int;
  v_pending_payments  int;
  v_current_rate      numeric;
  v_today_payments    numeric;
  v_week_volume       numeric;
BEGIN
  -- Must be an active admin
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Wallets: total clients + active clients + total balance (single scan)
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE balance_xaf > 0)::int,
    COALESCE(SUM(balance_xaf), 0)
  INTO v_total_clients, v_active_clients, v_total_balance
  FROM public.wallets;

  -- Deposits: pending count (single scan)
  SELECT COUNT(*)::int
  INTO v_pending_deposits
  FROM public.deposits
  WHERE status IN ('created', 'awaiting_proof', 'proof_submitted', 'admin_review');

  -- Payments: pending count
  SELECT COUNT(*)::int
  INTO v_pending_payments
  FROM public.payments
  WHERE status IN ('created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'cash_pending', 'cash_scanned');

  -- Latest exchange rate
  SELECT COALESCE(rate_xaf_to_rmb, 0.01149)
  INTO v_current_rate
  FROM public.exchange_rates
  ORDER BY effective_date DESC
  LIMIT 1;

  -- Today's completed payments amount
  SELECT COALESCE(SUM(amount_xaf), 0)
  INTO v_today_payments
  FROM public.payments
  WHERE status = 'completed'
    AND processed_at >= v_today_start;

  -- This week's validated deposits volume
  SELECT COALESCE(SUM(amount_xaf), 0)
  INTO v_week_volume
  FROM public.deposits
  WHERE status = 'validated'
    AND validated_at >= v_week_start;

  RETURN jsonb_build_object(
    'totalClients',       v_total_clients,
    'activeClients',      v_active_clients,
    'totalWalletBalance', v_total_balance,
    'pendingDeposits',    v_pending_deposits,
    'pendingPayments',    v_pending_payments,
    'currentRate',        CASE WHEN v_current_rate > 0 THEN round(1 / v_current_rate) ELSE 87 END,
    'todayPaymentsAmount', v_today_payments,
    'weekVolume',          v_week_volume
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

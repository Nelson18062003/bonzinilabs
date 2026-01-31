-- Add rate limiting to prevent abuse
-- This migration adds triggers to enforce rate limits on deposits, payments, and admin operations

-- ============================================================================
-- DEPOSIT RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_deposit_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 10; -- Max deposits per hour (from constants.ts)
BEGIN
  -- Count deposits in the last hour for this user
  SELECT COUNT(*) INTO v_count
  FROM public.deposits
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % deposits per hour allowed', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_deposit_rate_limit
  BEFORE INSERT ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.check_deposit_rate_limit();

COMMENT ON FUNCTION public.check_deposit_rate_limit() IS 'Enforces rate limit of 10 deposits per hour per user';

-- ============================================================================
-- PAYMENT RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_payment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 20; -- Max payments per hour (from constants.ts)
BEGIN
  -- Count payments in the last hour for this user
  SELECT COUNT(*) INTO v_count
  FROM public.payments
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % payments per hour allowed', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_payment_rate_limit
  BEFORE INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_payment_rate_limit();

COMMENT ON FUNCTION public.check_payment_rate_limit() IS 'Enforces rate limit of 20 payments per hour per user';

-- ============================================================================
-- ADMIN WALLET ADJUSTMENT RATE LIMITING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_admin_adjustment_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER := 50; -- Max adjustments per day per admin (from constants.ts)
BEGIN
  -- Only apply to adjustment operations
  IF NEW.operation_type != 'adjustment' THEN
    RETURN NEW;
  END IF;

  -- Count adjustments in the last 24 hours by this admin
  SELECT COUNT(*) INTO v_count
  FROM public.wallet_operations
  WHERE operation_type = 'adjustment'
    AND performed_by = NEW.performed_by
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum % wallet adjustments per day allowed', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_admin_adjustment_rate_limit
  BEFORE INSERT ON public.wallet_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_adjustment_rate_limit();

COMMENT ON FUNCTION public.check_admin_adjustment_rate_limit() IS 'Enforces rate limit of 50 wallet adjustments per day per admin';

-- ============================================================================
-- RATE LIMIT MONITORING VIEW
-- ============================================================================

-- View to monitor current rate limit usage
CREATE OR REPLACE VIEW public.rate_limit_usage AS
SELECT
  'deposits' as operation_type,
  user_id,
  COUNT(*) as count_last_hour,
  10 as limit_per_hour,
  CASE WHEN COUNT(*) >= 10 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.deposits
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id

UNION ALL

SELECT
  'payments' as operation_type,
  user_id,
  COUNT(*) as count_last_hour,
  20 as limit_per_hour,
  CASE WHEN COUNT(*) >= 20 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.payments
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id

UNION ALL

SELECT
  'admin_adjustments' as operation_type,
  performed_by as user_id,
  COUNT(*) as count_last_hour,
  50 as limit_per_hour,
  CASE WHEN COUNT(*) >= 50 THEN 'LIMIT_REACHED' ELSE 'OK' END as status
FROM public.wallet_operations
WHERE operation_type = 'adjustment'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY performed_by;

-- Grant access to admins
GRANT SELECT ON public.rate_limit_usage TO authenticated;

COMMENT ON VIEW public.rate_limit_usage IS 'Shows current rate limit usage for monitoring';

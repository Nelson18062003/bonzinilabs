-- Add timestamp to exchange_rates for intraday rates
ALTER TABLE public.exchange_rates 
ADD COLUMN IF NOT EXISTS effective_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing rows to set effective_at from effective_date
UPDATE public.exchange_rates 
SET effective_at = (effective_date::text || ' ' || created_at::time)::timestamp with time zone
WHERE effective_at IS NULL OR effective_at = now();

-- Function to check if a rate is used in any payment
CREATE OR REPLACE FUNCTION public.is_rate_used(p_rate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payments p
    JOIN exchange_rates er ON er.id = p_rate_id
    WHERE p.exchange_rate = (1 / er.rate_xaf_to_rmb)
    AND p.created_at >= er.effective_at
    AND (
      NOT EXISTS (
        SELECT 1 FROM exchange_rates er2 
        WHERE er2.effective_at > er.effective_at
      )
      OR p.created_at < (
        SELECT MIN(er2.effective_at) FROM exchange_rates er2 
        WHERE er2.effective_at > er.effective_at
      )
    )
  );
$$;

-- Function to get rate usage count
CREATE OR REPLACE FUNCTION public.get_rate_usage_count(p_rate_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM payments p
  JOIN exchange_rates er ON er.id = p_rate_id
  WHERE p.exchange_rate = (1 / er.rate_xaf_to_rmb)
  AND p.created_at >= er.effective_at
  AND (
    NOT EXISTS (
      SELECT 1 FROM exchange_rates er2 
      WHERE er2.effective_at > er.effective_at
    )
    OR p.created_at < (
      SELECT MIN(er2.effective_at) FROM exchange_rates er2 
      WHERE er2.effective_at > er.effective_at
    )
  );
$$;

-- Function to update an exchange rate
CREATE OR REPLACE FUNCTION public.update_exchange_rate(
  p_rate_id uuid,
  p_rate_xaf_to_rmb numeric,
  p_effective_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate RECORD;
  v_is_used BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  SELECT * INTO v_rate FROM exchange_rates WHERE id = p_rate_id;
  
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux non trouvé');
  END IF;
  
  v_is_used := public.is_rate_used(p_rate_id);
  
  IF v_is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce taux a déjà été utilisé dans des paiements et ne peut pas être modifié');
  END IF;
  
  UPDATE exchange_rates
  SET rate_xaf_to_rmb = p_rate_xaf_to_rmb,
      effective_at = COALESCE(p_effective_at, effective_at),
      effective_date = COALESCE(p_effective_at, effective_at)::date
  WHERE id = p_rate_id;
  
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'update_exchange_rate', 'exchange_rate', p_rate_id,
    jsonb_build_object(
      'old_rate', v_rate.rate_xaf_to_rmb,
      'new_rate', p_rate_xaf_to_rmb
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to delete an exchange rate
CREATE OR REPLACE FUNCTION public.delete_exchange_rate(p_rate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate RECORD;
  v_is_used BOOLEAN;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  SELECT * INTO v_rate FROM exchange_rates WHERE id = p_rate_id;
  
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux non trouvé');
  END IF;
  
  v_is_used := public.is_rate_used(p_rate_id);
  
  IF v_is_used THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce taux a déjà été utilisé dans des paiements et ne peut pas être supprimé');
  END IF;
  
  DELETE FROM exchange_rates WHERE id = p_rate_id;
  
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_exchange_rate', 'exchange_rate', p_rate_id,
    jsonb_build_object(
      'rate', v_rate.rate_xaf_to_rmb,
      'effective_date', v_rate.effective_date
    )
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to add a new exchange rate with datetime
CREATE OR REPLACE FUNCTION public.add_exchange_rate(
  p_rate_xaf_to_rmb numeric,
  p_effective_at timestamp with time zone DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate_id UUID;
BEGIN
  v_admin_id := auth.uid();
  
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  INSERT INTO exchange_rates (rate_xaf_to_rmb, effective_date, effective_at, created_by)
  VALUES (p_rate_xaf_to_rmb, p_effective_at::date, p_effective_at, v_admin_id)
  RETURNING id INTO v_rate_id;
  
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'add_exchange_rate', 'exchange_rate', v_rate_id,
    jsonb_build_object('rate', p_rate_xaf_to_rmb, 'effective_at', p_effective_at)
  );
  
  RETURN jsonb_build_object('success', true, 'rate_id', v_rate_id);
END;
$$;
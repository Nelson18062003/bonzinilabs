
-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix function search path for generate_deposit_reference
CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.deposits
  WHERE created_at >= date_trunc('year', now());
  
  v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_count::text, 4, '0');
  
  RETURN v_reference;
END;
$$;

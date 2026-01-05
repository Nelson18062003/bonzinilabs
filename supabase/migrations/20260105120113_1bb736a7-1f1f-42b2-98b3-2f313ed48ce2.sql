-- Drop and recreate the function with proper locking to prevent race conditions
CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  -- Lock the deposits table to prevent concurrent reference generation
  LOCK TABLE public.deposits IN SHARE UPDATE EXCLUSIVE MODE;
  
  -- Get the maximum reference number for this year
  SELECT COALESCE(
    MAX(
      NULLIF(
        regexp_replace(reference, '^BZ-DP-' || v_year || '-', ''),
        reference
      )::int
    ),
    0
  ) + 1 INTO v_max_num
  FROM public.deposits
  WHERE reference LIKE 'BZ-DP-' || v_year || '-%';
  
  v_reference := 'BZ-DP-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
  
  RETURN v_reference;
END;
$$;
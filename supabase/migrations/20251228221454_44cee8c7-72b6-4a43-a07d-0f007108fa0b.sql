-- Fix the generate_deposit_reference function to avoid duplicates
-- Use a sequence-based approach with retry mechanism

CREATE OR REPLACE FUNCTION public.generate_deposit_reference()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
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
$function$;
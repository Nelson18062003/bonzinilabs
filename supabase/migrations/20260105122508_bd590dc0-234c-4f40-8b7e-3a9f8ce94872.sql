-- Create atomic function to create deposit with guaranteed unique reference
CREATE OR REPLACE FUNCTION public.create_client_deposit(
  p_user_id UUID,
  p_amount_xaf NUMERIC,
  p_method deposit_method,
  p_bank_name TEXT DEFAULT NULL,
  p_agency_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
  v_deposit_id UUID;
  v_attempts INT := 0;
  v_max_attempts INT := 5;
BEGIN
  v_year := to_char(now(), 'YYYY');
  
  -- Retry loop in case of concurrent inserts
  WHILE v_attempts < v_max_attempts LOOP
    v_attempts := v_attempts + 1;
    
    -- Lock and get max reference number
    LOCK TABLE public.deposits IN SHARE UPDATE EXCLUSIVE MODE;
    
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
    
    -- Try to insert the deposit
    BEGIN
      INSERT INTO public.deposits (
        user_id,
        reference,
        amount_xaf,
        method,
        bank_name,
        agency_name,
        client_phone,
        status
      ) VALUES (
        p_user_id,
        v_reference,
        p_amount_xaf,
        p_method,
        p_bank_name,
        p_agency_name,
        p_client_phone,
        'created'
      )
      RETURNING id INTO v_deposit_id;
      
      -- Success - add timeline event and return
      INSERT INTO public.deposit_timeline_events (
        deposit_id,
        event_type,
        description,
        performed_by
      ) VALUES (
        v_deposit_id,
        'created',
        'Demande de dépôt créée',
        p_user_id
      );
      
      RETURN json_build_object(
        'success', true,
        'deposit_id', v_deposit_id,
        'reference', v_reference
      );
      
    EXCEPTION
      WHEN unique_violation THEN
        -- Reference collision, retry
        IF v_attempts >= v_max_attempts THEN
          RETURN json_build_object(
            'success', false,
            'error', 'Impossible de générer une référence unique après plusieurs tentatives'
          );
        END IF;
        -- Continue to next iteration
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', false,
    'error', 'Erreur inattendue lors de la création du dépôt'
  );
END;
$$;
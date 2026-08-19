-- ============================================================
-- Dépôts antidatables : create_client_deposit(p_desired_date)
--
-- Un admin peut enregistrer un dépôt reçu il y a quelques jours
-- avec sa vraie date d'opération. Défaut : now(). Réservé aux
-- admins (un client ne peut pas antidater son propre dépôt) et
-- jamais dans le futur. L'année de la référence BZ-DP-YYYY-NNNN
-- suit la date effective de l'opération.
--
-- Le pendant paiements existe déjà : create_admin_payment
-- accepte p_desired_date depuis sa création.
--
-- Signature étendue → DROP obligatoire (sinon surcharge ambiguë
-- pour PostgREST), puis ré-application de l'étiquette @mola.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_client_deposit(UUID, NUMERIC, deposit_method, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_client_deposit(
  p_user_id UUID,
  p_amount_xaf NUMERIC,
  p_method deposit_method,
  p_bank_name TEXT DEFAULT NULL,
  p_agency_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_desired_date TIMESTAMPTZ DEFAULT NULL
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
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Antidatage : admin uniquement, jamais dans le futur
  IF p_desired_date IS NOT NULL THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RETURN json_build_object('success', false, 'error', 'Seul un administrateur peut choisir la date de l''opération');
    END IF;
    IF p_desired_date > now() + interval '2 minutes' THEN
      RETURN json_build_object('success', false, 'error', 'La date de l''opération ne peut pas être dans le futur');
    END IF;
  END IF;

  v_created_at := COALESCE(p_desired_date, now());
  v_year := to_char(v_created_at, 'YYYY');

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
        status,
        created_at
      ) VALUES (
        p_user_id,
        v_reference,
        p_amount_xaf,
        p_method,
        p_bank_name,
        p_agency_name,
        p_client_phone,
        'created',
        v_created_at
      )
      RETURNING id INTO v_deposit_id;

      -- Success - add timeline event and return
      INSERT INTO public.deposit_timeline_events (
        deposit_id,
        event_type,
        description,
        performed_by,
        created_at
      ) VALUES (
        v_deposit_id,
        'created',
        'Demande de dépôt créée',
        p_user_id,
        v_created_at
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

comment on function public.create_client_deposit(UUID, NUMERIC, deposit_method, TEXT, TEXT, TEXT, TIMESTAMPTZ) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","label":"Créer un dépôt","tool":"create_deposit"}';

NOTIFY pgrst, 'reload schema';

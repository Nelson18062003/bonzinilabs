-- ============================================================
-- FIX: Payment beneficiary RPCs — three coordinated fixes
--
-- 1. Drop ALL known overloads of admin_update_payment_beneficiary.
--    Migration 20260421000002 changed the signature 8→11 args via
--    CREATE OR REPLACE, which per Postgres docs CANNOT change the
--    argument count: it created a new overload and the old 8-arg
--    function from 20260301000002 is still in DB. PostgREST may
--    route either one. We drop both and recreate a single canonical
--    11-arg version.
--
-- 2. Fix the enum/text regression. Migration 20260421000002
--    redeclared `v_new_status TEXT` and dropped the explicit
--    `::payment_status` casts that were added by 20260301000002.
--    Postgres has no implicit cast TEXT→enum, so the UPDATE on
--    `payments.status` raises 42804 datatype_mismatch. We restore
--    the enum-typed variable and explicit casts.
--
-- 3. Align the client RPC update_payment_beneficiary with the RLS
--    policy fixed by 20260331000001 (and the frontend permission
--    in PaymentDetailPage). Currently the RPC rejects any status
--    other than 'waiting_beneficiary_info', which silently breaks
--    the "add QR after partial save" flow when the status has
--    advanced to 'ready_for_payment'.
-- ============================================================

-- 1 + 2. admin_update_payment_beneficiary
DROP FUNCTION IF EXISTS public.admin_update_payment_beneficiary(uuid, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_update_payment_beneficiary(uuid, text, text, text, text, text, text, text, text, text, text);

CREATE FUNCTION public.admin_update_payment_beneficiary(
  p_payment_id                  UUID,
  p_beneficiary_name            TEXT DEFAULT NULL,
  p_beneficiary_phone           TEXT DEFAULT NULL,
  p_beneficiary_email           TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url     TEXT DEFAULT NULL,
  p_beneficiary_bank_name       TEXT DEFAULT NULL,
  p_beneficiary_bank_account    TEXT DEFAULT NULL,
  p_beneficiary_notes           TEXT DEFAULT NULL,
  p_beneficiary_identifier      TEXT DEFAULT NULL,
  p_beneficiary_identifier_type TEXT DEFAULT NULL,
  p_beneficiary_bank_extra      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_payment    RECORD;
  v_new_status payment_status;
BEGIN
  IF NOT public.is_admin(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée');
  END IF;

  SELECT id, status, method INTO v_payment
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  IF v_payment.status IN (
    'completed'::payment_status,
    'rejected'::payment_status,
    'cancelled_by_admin'::payment_status
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier un paiement finalisé');
  END IF;

  v_new_status := v_payment.status;

  IF v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    IF v_payment.method IN ('alipay', 'wechat')
       AND (p_beneficiary_qr_code_url IS NOT NULL
            OR p_beneficiary_phone IS NOT NULL
            OR p_beneficiary_email IS NOT NULL
            OR p_beneficiary_identifier IS NOT NULL) THEN
      v_new_status := 'ready_for_payment'::payment_status;
    ELSIF v_payment.method = 'bank_transfer'
          AND p_beneficiary_name IS NOT NULL
          AND p_beneficiary_bank_name IS NOT NULL
          AND p_beneficiary_bank_account IS NOT NULL THEN
      v_new_status := 'ready_for_payment'::payment_status;
    END IF;
  END IF;

  UPDATE payments SET
    beneficiary_name            = COALESCE(p_beneficiary_name,            beneficiary_name),
    beneficiary_phone           = COALESCE(p_beneficiary_phone,           beneficiary_phone),
    beneficiary_email           = COALESCE(p_beneficiary_email,           beneficiary_email),
    beneficiary_qr_code_url     = COALESCE(p_beneficiary_qr_code_url,     beneficiary_qr_code_url),
    beneficiary_bank_name       = COALESCE(p_beneficiary_bank_name,       beneficiary_bank_name),
    beneficiary_bank_account    = COALESCE(p_beneficiary_bank_account,    beneficiary_bank_account),
    beneficiary_notes           = COALESCE(p_beneficiary_notes,           beneficiary_notes),
    beneficiary_identifier      = COALESCE(p_beneficiary_identifier,      beneficiary_identifier),
    beneficiary_identifier_type = COALESCE(p_beneficiary_identifier_type, beneficiary_identifier_type),
    beneficiary_bank_extra      = COALESCE(p_beneficiary_bank_extra,      beneficiary_bank_extra),
    status                      = v_new_status,
    updated_at                  = NOW()
  WHERE id = p_payment_id;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id,
    'admin_beneficiary_update',
    'Infos bénéficiaire mises à jour par un administrateur',
    v_caller_id
  );

  IF v_new_status = 'ready_for_payment'::payment_status
     AND v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (
      p_payment_id,
      'info_provided',
      'Informations bénéficiaire complétées — paiement prêt',
      v_caller_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'new_status', v_new_status::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_payment_beneficiary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_beneficiary TO authenticated;


-- 3. update_payment_beneficiary (client) — align status guard with RLS + UI
CREATE OR REPLACE FUNCTION public.update_payment_beneficiary(
  p_payment_id UUID,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_payment   RECORD;
  v_has_valid_info BOOLEAN;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  IF v_payment.user_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Aligned with RLS (mig 20260331000001) and frontend permission
  -- (PaymentDetailPage.tsx:383). Allow editing while the payment
  -- has not yet entered a processing/terminal state.
  IF v_payment.status NOT IN (
    'created'::payment_status,
    'waiting_beneficiary_info'::payment_status,
    'ready_for_payment'::payment_status
  ) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce paiement ne peut plus être modifié');
  END IF;

  UPDATE public.payments SET
    beneficiary_name        = COALESCE(p_beneficiary_name, beneficiary_name),
    beneficiary_phone       = COALESCE(p_beneficiary_phone, beneficiary_phone),
    beneficiary_email       = COALESCE(p_beneficiary_email, beneficiary_email),
    beneficiary_qr_code_url = COALESCE(p_beneficiary_qr_code_url, beneficiary_qr_code_url),
    beneficiary_bank_name   = COALESCE(p_beneficiary_bank_name, beneficiary_bank_name),
    beneficiary_bank_account = COALESCE(p_beneficiary_bank_account, beneficiary_bank_account),
    beneficiary_notes       = COALESCE(p_beneficiary_notes, beneficiary_notes),
    updated_at = now()
  WHERE id = p_payment_id;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  v_has_valid_info := CASE v_payment.method
    WHEN 'alipay' THEN
      (v_payment.beneficiary_name IS NOT NULL AND v_payment.beneficiary_name != '')
      AND (
        (v_payment.beneficiary_qr_code_url IS NOT NULL AND v_payment.beneficiary_qr_code_url != '')
        OR (v_payment.beneficiary_phone IS NOT NULL AND v_payment.beneficiary_phone != '')
      )
    WHEN 'wechat' THEN
      (v_payment.beneficiary_name IS NOT NULL AND v_payment.beneficiary_name != '')
      AND (
        (v_payment.beneficiary_qr_code_url IS NOT NULL AND v_payment.beneficiary_qr_code_url != '')
        OR (v_payment.beneficiary_phone IS NOT NULL AND v_payment.beneficiary_phone != '')
      )
    WHEN 'bank_transfer' THEN
      (v_payment.beneficiary_name IS NOT NULL AND v_payment.beneficiary_name != '')
      AND (v_payment.beneficiary_bank_name IS NOT NULL AND v_payment.beneficiary_bank_name != '')
      AND (v_payment.beneficiary_bank_account IS NOT NULL AND v_payment.beneficiary_bank_account != '')
    WHEN 'cash' THEN true
    ELSE false
  END;

  -- Only transition forward (waiting -> ready). Never downgrade
  -- ready_for_payment when the client edits info on an already-ready payment.
  IF v_has_valid_info AND v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    UPDATE public.payments
    SET status = 'ready_for_payment'::payment_status, updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description)
    VALUES (p_payment_id, 'beneficiary_updated', 'Informations bénéficiaire complétées — paiement prêt');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE
      WHEN v_has_valid_info OR v_payment.status = 'ready_for_payment'::payment_status
        THEN 'ready_for_payment'
      ELSE 'waiting_beneficiary_info'
    END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

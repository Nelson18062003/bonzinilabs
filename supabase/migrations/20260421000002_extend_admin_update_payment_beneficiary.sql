-- ============================================================
-- Extend admin_update_payment_beneficiary with the three new
-- columns introduced in 20260421000001:
--   * beneficiary_identifier
--   * beneficiary_identifier_type
--   * beneficiary_bank_extra
--
-- Also: the Alipay/WeChat auto-upgrade of status
-- (waiting_beneficiary_info -> ready_for_payment) now treats a
-- freshly-provided identifier as valid beneficiary info, to match
-- the frontend expectation (admin types just the Alipay ID and
-- expects the payment to move forward).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_payment_beneficiary(
  p_payment_id                UUID,
  p_beneficiary_name          TEXT DEFAULT NULL,
  p_beneficiary_phone         TEXT DEFAULT NULL,
  p_beneficiary_email         TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url   TEXT DEFAULT NULL,
  p_beneficiary_bank_name     TEXT DEFAULT NULL,
  p_beneficiary_bank_account  TEXT DEFAULT NULL,
  p_beneficiary_notes         TEXT DEFAULT NULL,
  p_beneficiary_identifier    TEXT DEFAULT NULL,
  p_beneficiary_identifier_type TEXT DEFAULT NULL,
  p_beneficiary_bank_extra    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_payment     RECORD;
  v_new_status  TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF NOT public.is_admin(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée');
  END IF;

  SELECT id, status, method
  INTO v_payment
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  IF v_payment.status IN ('completed', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier un paiement finalisé');
  END IF;

  -- Determine new status only when currently waiting for beneficiary info.
  -- Don't downgrade other statuses.
  v_new_status := v_payment.status;
  IF v_payment.status = 'waiting_beneficiary_info' THEN
    IF v_payment.method IN ('alipay', 'wechat') THEN
      IF p_beneficiary_qr_code_url IS NOT NULL
         OR p_beneficiary_phone IS NOT NULL
         OR p_beneficiary_email IS NOT NULL
         OR p_beneficiary_identifier IS NOT NULL THEN
        v_new_status := 'ready_for_payment';
      END IF;
    ELSIF v_payment.method = 'bank_transfer' THEN
      IF p_beneficiary_name IS NOT NULL
         AND p_beneficiary_bank_name IS NOT NULL
         AND p_beneficiary_bank_account IS NOT NULL THEN
        v_new_status := 'ready_for_payment';
      END IF;
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

  IF v_new_status = 'ready_for_payment' AND v_payment.status = 'waiting_beneficiary_info' THEN
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
    'new_status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_payment_beneficiary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_beneficiary TO authenticated;

NOTIFY pgrst, 'reload schema';

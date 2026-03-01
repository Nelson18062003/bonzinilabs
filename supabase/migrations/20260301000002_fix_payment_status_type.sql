-- ============================================================
-- Fix: admin_update_payment_beneficiary — v_new_status doit être
-- déclaré en payment_status (enum) et non TEXT, sinon PostgreSQL
-- refuse l'assignation : "column status is of type payment_status
-- but expression is of type text"
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_payment_beneficiary(
  p_payment_id           UUID,
  p_beneficiary_name     TEXT DEFAULT NULL,
  p_beneficiary_phone    TEXT DEFAULT NULL,
  p_beneficiary_email    TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name   TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_payment     RECORD;
  v_new_status  payment_status;   -- ← enum, pas TEXT
BEGIN
  -- 1. Vérifier que l'appelant est un admin non désactivé
  v_caller_id := auth.uid();
  IF NOT public.is_admin(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée');
  END IF;

  -- 2. Récupérer le paiement
  SELECT id, status, method
  INTO v_payment
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  -- 3. Bloquer les paiements finalisés
  IF v_payment.status IN ('completed'::payment_status, 'rejected'::payment_status) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier un paiement finalisé');
  END IF;

  -- 4. Déterminer le nouveau statut
  v_new_status := v_payment.status;

  IF v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    IF v_payment.method IN ('alipay', 'wechat') THEN
      IF p_beneficiary_qr_code_url IS NOT NULL
         OR p_beneficiary_phone IS NOT NULL
         OR p_beneficiary_email IS NOT NULL THEN
        v_new_status := 'ready_for_payment'::payment_status;
      END IF;
    ELSIF v_payment.method = 'bank_transfer' THEN
      IF p_beneficiary_name IS NOT NULL
         AND p_beneficiary_bank_name IS NOT NULL
         AND p_beneficiary_bank_account IS NOT NULL THEN
        v_new_status := 'ready_for_payment'::payment_status;
      END IF;
    END IF;
  END IF;

  -- 5. Mettre à jour les champs bénéficiaire
  UPDATE payments SET
    beneficiary_name         = COALESCE(p_beneficiary_name,         beneficiary_name),
    beneficiary_phone        = COALESCE(p_beneficiary_phone,        beneficiary_phone),
    beneficiary_email        = COALESCE(p_beneficiary_email,        beneficiary_email),
    beneficiary_qr_code_url  = COALESCE(p_beneficiary_qr_code_url,  beneficiary_qr_code_url),
    beneficiary_bank_name    = COALESCE(p_beneficiary_bank_name,    beneficiary_bank_name),
    beneficiary_bank_account = COALESCE(p_beneficiary_bank_account, beneficiary_bank_account),
    beneficiary_notes        = COALESCE(p_beneficiary_notes,        beneficiary_notes),
    status                   = v_new_status,
    updated_at               = NOW()
  WHERE id = p_payment_id;

  -- 6. Événement timeline
  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id,
    'admin_beneficiary_update',
    'Infos bénéficiaire mises à jour par un administrateur',
    v_caller_id
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'new_status', v_new_status::text);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_payment_beneficiary FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_beneficiary TO authenticated;

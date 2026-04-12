-- ============================================================
-- Centraliser les transitions de statut côté serveur
--
-- Problème : le frontend fait des .update({ status: ... }) directs
-- sur les tables deposits et payments, contournant toute validation.
--
-- Fix : 3 RPCs qui centralisent ces transitions avec des gardes.
-- ============================================================

-- ============================================================
-- 1. submit_deposit_proof — marque un dépôt comme ayant une preuve
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_deposit_proof(p_deposit_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_deposit   RECORD;
  v_is_admin  BOOLEAN;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Le caller doit être le propriétaire du dépôt ou un admin
  v_is_admin := public.is_admin(v_caller_id);
  IF v_deposit.user_id != v_caller_id AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- On ne peut avancer que depuis ces statuts
  IF v_deposit.status NOT IN ('created', 'awaiting_proof') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Impossible de soumettre une preuve en statut "' || v_deposit.status || '"');
  END IF;

  -- Vérifier qu'il y a au moins une preuve active
  IF NOT EXISTS (
    SELECT 1 FROM public.deposit_proofs
    WHERE deposit_id = p_deposit_id AND (is_deleted IS NULL OR is_deleted = false)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune preuve active trouvée');
  END IF;

  UPDATE public.deposits
  SET status = 'proof_submitted', updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'proof_submitted', 'Preuve soumise');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 2. revert_deposit_to_created — remet un dépôt en 'created'
--    (après suppression de toutes les preuves)
-- ============================================================
CREATE OR REPLACE FUNCTION public.revert_deposit_to_created(p_deposit_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_deposit   RECORD;
  v_is_admin  BOOLEAN;
  v_active_proofs INT;
BEGIN
  v_caller_id := auth.uid();

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Le caller doit être le propriétaire du dépôt ou un admin
  v_is_admin := public.is_admin(v_caller_id);
  IF v_deposit.user_id != v_caller_id AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Pas de retour en arrière depuis un statut terminal
  IF v_deposit.status IN ('validated', 'rejected', 'cancelled', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Impossible de revenir en arrière depuis le statut "' || v_deposit.status || '"');
  END IF;

  -- Vérifier qu'il n'y a plus de preuves actives
  SELECT COUNT(*) INTO v_active_proofs
  FROM public.deposit_proofs
  WHERE deposit_id = p_deposit_id AND (is_deleted IS NULL OR is_deleted = false);

  IF v_active_proofs > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Il reste ' || v_active_proofs || ' preuve(s) active(s)');
  END IF;

  UPDATE public.deposits
  SET status = 'created', updated_at = now()
  WHERE id = p_deposit_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. update_payment_beneficiary — met à jour les infos bénéficiaire
--    et avance le statut si les infos sont complètes
-- ============================================================
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

  -- Le caller doit être le propriétaire du paiement
  IF v_payment.user_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- On ne peut modifier les infos que si le paiement attend ces infos
  IF v_payment.status != 'waiting_beneficiary_info' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paiement n''est pas en attente d''informations bénéficiaire');
  END IF;

  -- Mettre à jour les champs bénéficiaire fournis
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

  -- Recharger le paiement mis à jour pour vérifier la complétude
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  -- Déterminer si les infos sont suffisantes selon la méthode
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

  IF v_has_valid_info THEN
    UPDATE public.payments
    SET status = 'ready_for_payment', updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description)
    VALUES (p_payment_id, 'beneficiary_updated', 'Informations bénéficiaire complétées — paiement prêt');
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN v_has_valid_info THEN 'ready_for_payment' ELSE 'waiting_beneficiary_info' END);
END;
$$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
  v_payment RECORD;
BEGIN
  v_admin_id := auth.uid();
  
  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  
  -- Get proof
  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id;
  
  IF v_proof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preuve non trouvée');
  END IF;
  
  -- Get payment
  SELECT * INTO v_payment FROM public.payments WHERE id = v_proof.payment_id;
  
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;
  
  -- Cannot delete proofs if payment is completed or rejected
  IF v_payment.status IN ('completed', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de supprimer les preuves d''un paiement effectué ou rejeté');
  END IF;
  
  -- Delete the proof
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;
  
  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);
  
  RETURN jsonb_build_object('success', true);
END;
$$;
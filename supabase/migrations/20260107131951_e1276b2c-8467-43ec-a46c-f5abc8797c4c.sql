CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
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

  -- Allow deletion even if payment is completed or rejected (admin only)
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;

  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);

  RETURN jsonb_build_object('success', true);
END;
$function$;
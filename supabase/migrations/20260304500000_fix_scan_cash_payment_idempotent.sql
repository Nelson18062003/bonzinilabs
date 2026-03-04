-- Make scan_cash_payment idempotent: if already scanned (but not completed),
-- return success without creating duplicate timeline events.
-- This allows agents to re-scan QR codes and continue the payment flow.

CREATE OR REPLACE FUNCTION public.scan_cash_payment(
  p_payment_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
BEGIN
  -- Get payment
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  -- Verify it's a cash payment
  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;

  -- Check if already paid
  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;

  -- If already scanned, return success without creating duplicate timeline events
  -- This allows re-scanning and continuing the flow
  IF v_payment.status IN ('cash_scanned', 'cash_pending') THEN
    RETURN json_build_object(
      'success', true,
      'payment', row_to_json(v_payment)
    );
  END IF;

  -- Update to scanned status
  UPDATE payments
  SET
    status = 'cash_scanned',
    cash_scanned_at = now(),
    cash_scanned_by = auth.uid(),
    updated_at = now()
  WHERE id = p_payment_id;

  -- Add timeline event
  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_scanned', 'QR Code scanné au bureau', auth.uid());

  RETURN json_build_object(
    'success', true,
    'payment', row_to_json(v_payment)
  );
END;
$$;

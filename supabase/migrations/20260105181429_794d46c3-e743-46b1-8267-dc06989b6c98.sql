-- Add cash payment specific fields to payments table
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS cash_beneficiary_type text CHECK (cash_beneficiary_type IN ('self', 'other')),
ADD COLUMN IF NOT EXISTS cash_beneficiary_first_name text,
ADD COLUMN IF NOT EXISTS cash_beneficiary_last_name text,
ADD COLUMN IF NOT EXISTS cash_beneficiary_phone text,
ADD COLUMN IF NOT EXISTS cash_signature_url text,
ADD COLUMN IF NOT EXISTS cash_signature_timestamp timestamptz,
ADD COLUMN IF NOT EXISTS cash_signed_by_name text,
ADD COLUMN IF NOT EXISTS cash_scanned_at timestamptz,
ADD COLUMN IF NOT EXISTS cash_scanned_by uuid,
ADD COLUMN IF NOT EXISTS cash_paid_at timestamptz,
ADD COLUMN IF NOT EXISTS cash_paid_by uuid;

-- Add index for cash payments lookup
CREATE INDEX IF NOT EXISTS idx_payments_cash_method ON public.payments(method) WHERE method = 'cash';

-- Update payment_status enum to include cash-specific statuses
-- First check existing values and add new ones
DO $$
BEGIN
  -- Add 'cash_pending' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cash_pending' AND enumtypid = 'payment_status'::regtype) THEN
    ALTER TYPE payment_status ADD VALUE 'cash_pending';
  END IF;
  -- Add 'cash_scanned' if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cash_scanned' AND enumtypid = 'payment_status'::regtype) THEN
    ALTER TYPE payment_status ADD VALUE 'cash_scanned';
  END IF;
END$$;

-- Create storage bucket for cash signatures if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('cash-signatures', 'cash-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cash signatures
CREATE POLICY "Admins can upload cash signatures"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cash-signatures' AND is_admin(auth.uid()));

CREATE POLICY "Admins can view cash signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'cash-signatures' AND is_admin(auth.uid()));

CREATE POLICY "Users can view own payment signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cash-signatures' AND 
  EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.cash_signature_url LIKE '%' || name || '%' 
    AND p.user_id = auth.uid()
  )
);

-- Function to process cash payment scan
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
  v_result json;
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

-- Function to confirm cash payment with signature
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_id uuid,
  p_signature_url text,
  p_signed_by_name text
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
  
  -- Update payment to completed
  UPDATE payments 
  SET 
    status = 'completed',
    cash_signature_url = p_signature_url,
    cash_signature_timestamp = now(),
    cash_signed_by_name = p_signed_by_name,
    cash_paid_at = now(),
    cash_paid_by = auth.uid(),
    processed_at = now(),
    processed_by = auth.uid(),
    updated_at = now()
  WHERE id = p_payment_id;
  
  -- Add timeline event
  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_paid', 'Paiement cash effectué - Signature enregistrée', auth.uid());
  
  RETURN json_build_object('success', true);
END;
$$;
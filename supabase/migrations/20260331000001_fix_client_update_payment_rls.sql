-- Fix: Allow clients to update their own payments when status is 'ready_for_payment'
--
-- Bug: When a client creates a payment with partial beneficiary info (e.g. name only),
-- the status is set to 'ready_for_payment'. The client then cannot add the QR code
-- because the RLS USING clause only allowed 'created' and 'waiting_beneficiary_info'.
-- The update silently fails (0 rows affected, no error).

DROP POLICY IF EXISTS "Users can update own payments beneficiary info" ON public.payments;

CREATE POLICY "Users can update own payments beneficiary info"
ON public.payments
FOR UPDATE
USING (
  (auth.uid() = user_id) AND
  (status = ANY (ARRAY['created'::payment_status, 'waiting_beneficiary_info'::payment_status, 'ready_for_payment'::payment_status]))
)
WITH CHECK (
  (auth.uid() = user_id) AND
  (status = ANY (ARRAY['created'::payment_status, 'waiting_beneficiary_info'::payment_status, 'ready_for_payment'::payment_status]))
);

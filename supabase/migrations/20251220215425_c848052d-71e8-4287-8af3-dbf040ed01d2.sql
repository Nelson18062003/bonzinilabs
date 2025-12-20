-- Drop the existing policy
DROP POLICY IF EXISTS "Users can update own payments beneficiary info" ON public.payments;

-- Create a new policy that allows users to update their payments
-- when status is 'created' or 'waiting_beneficiary_info'
-- and allows them to set status to 'ready_for_payment' when adding beneficiary info
CREATE POLICY "Users can update own payments beneficiary info" 
ON public.payments 
FOR UPDATE 
USING (
  (auth.uid() = user_id) AND 
  (status = ANY (ARRAY['created'::payment_status, 'waiting_beneficiary_info'::payment_status]))
)
WITH CHECK (
  (auth.uid() = user_id) AND 
  (status = ANY (ARRAY['created'::payment_status, 'waiting_beneficiary_info'::payment_status, 'ready_for_payment'::payment_status]))
);
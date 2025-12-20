-- Restrict payment proofs so only admins can add them (clients can only view)
DROP POLICY IF EXISTS "Users can upload proofs for own payments" ON public.payment_proofs;

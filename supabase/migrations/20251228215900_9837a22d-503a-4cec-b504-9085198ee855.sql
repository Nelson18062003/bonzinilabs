-- Add INSERT policy for admins on deposit_proofs
CREATE POLICY "Admins can insert deposit proofs"
ON public.deposit_proofs
FOR INSERT
WITH CHECK (is_admin(auth.uid()));
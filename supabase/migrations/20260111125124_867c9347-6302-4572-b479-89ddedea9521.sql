-- Add DELETE policy for deposits table (admins only)
CREATE POLICY "Admins can delete deposits"
ON public.deposits
FOR DELETE
USING (is_admin(auth.uid()));

-- Add DELETE policy for deposit_proofs table (admins only)
CREATE POLICY "Admins can delete deposit proofs"
ON public.deposit_proofs
FOR DELETE
USING (is_admin(auth.uid()));

-- Add DELETE policy for deposit_timeline_events table (admins only)
CREATE POLICY "Admins can delete deposit timeline events"
ON public.deposit_timeline_events
FOR DELETE
USING (is_admin(auth.uid()));
-- Fix permissive RLS policies flagged by linter (WITH CHECK true)

-- deposit_timeline_events: replace always-true INSERT policy
DROP POLICY IF EXISTS "System can insert timeline events" ON public.deposit_timeline_events;
CREATE POLICY "Users can insert deposit timeline events"
ON public.deposit_timeline_events
FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.deposits d
    WHERE d.id = deposit_timeline_events.deposit_id
      AND (
        d.user_id = auth.uid()
        OR public.is_admin(auth.uid())
      )
  )
);

-- payment_timeline_events: replace always-true INSERT policy
DROP POLICY IF EXISTS "System can insert payment timeline events" ON public.payment_timeline_events;
CREATE POLICY "Users can insert payment timeline events"
ON public.payment_timeline_events
FOR INSERT
WITH CHECK (
  performed_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = payment_timeline_events.payment_id
      AND (
        p.user_id = auth.uid()
        OR public.is_admin(auth.uid())
        OR (public.is_cash_agent(auth.uid()) AND p.method = 'cash'::public.payment_method)
      )
  )
);

-- Clean up duplicate super_admin policies on user_roles that can cause recursion
DROP POLICY IF EXISTS "Super admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can delete user roles" ON public.user_roles;
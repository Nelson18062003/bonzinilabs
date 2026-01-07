-- Create is_cash_agent function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_cash_agent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'cash_agent'::app_role
  )
$$;

-- RLS policy for cash agents to view ONLY cash payments
CREATE POLICY "Cash agents can view cash payments only"
ON public.payments
FOR SELECT
USING (
  is_cash_agent(auth.uid()) 
  AND method = 'cash'::payment_method
);

-- Cash agents can update cash payments (for confirming payment)
CREATE POLICY "Cash agents can update cash payments"
ON public.payments
FOR UPDATE
USING (
  is_cash_agent(auth.uid()) 
  AND method = 'cash'::payment_method
  AND status IN ('cash_pending'::payment_status, 'cash_scanned'::payment_status)
);

-- Cash agents can view payment timeline for cash payments
CREATE POLICY "Cash agents can view cash payment timelines"
ON public.payment_timeline_events
FOR SELECT
USING (
  is_cash_agent(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_timeline_events.payment_id 
    AND p.method = 'cash'::payment_method
  )
);

-- Cash agents can insert timeline events for cash payments
CREATE POLICY "Cash agents can insert cash payment timeline events"
ON public.payment_timeline_events
FOR INSERT
WITH CHECK (
  is_cash_agent(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.payments p 
    WHERE p.id = payment_timeline_events.payment_id 
    AND p.method = 'cash'::payment_method
  )
);

-- Cash agents can view profiles (to see beneficiary names)
CREATE POLICY "Cash agents can view profiles"
ON public.profiles
FOR SELECT
USING (is_cash_agent(auth.uid()));
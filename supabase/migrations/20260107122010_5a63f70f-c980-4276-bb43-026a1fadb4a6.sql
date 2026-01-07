-- Allow super_admin to insert user roles
CREATE POLICY "Super admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'::app_role
  )
);

-- Allow super_admin to view all user roles
CREATE POLICY "Super admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'::app_role
  )
);

-- Allow super_admin to delete user roles
CREATE POLICY "Super admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'::app_role
  )
);
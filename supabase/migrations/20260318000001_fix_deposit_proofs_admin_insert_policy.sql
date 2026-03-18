-- =====================================================
-- Fix: Add missing INSERT policy for admins on deposit_proofs
-- =====================================================
-- Root cause:
--   supabaseAdmin uses the anon key (not service role), so RLS applies.
--   Migration 20260214 restored client policies but never added an admin
--   INSERT policy. As a result, when an admin uploads proofs (either during
--   deposit creation or from the detail page), the INSERT is blocked by RLS:
--     the only INSERT policy requires d.user_id = auth.uid()
--     which is false when the deposit belongs to a client, not the admin.
--   The insert fails silently in useAdminCreateDeposit (error not checked),
--   causing the "0 preuves" bug in the deposit detail view.
-- =====================================================

DROP POLICY IF EXISTS "Admins can upload deposit proofs" ON public.deposit_proofs;

CREATE POLICY "Admins can upload deposit proofs"
  ON public.deposit_proofs FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

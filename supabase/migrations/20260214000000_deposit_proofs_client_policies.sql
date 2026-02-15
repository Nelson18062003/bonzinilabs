-- =====================================================
-- Restore missing RLS policies on deposit_proofs
-- and add UPDATE policy for soft-delete support
-- =====================================================
-- Context: Migration 20251231174812 dropped the permissive "Allow all"
-- policy but never recreated proper per-operation policies.
-- Only the admin INSERT policy from 20251228215900 survived.
-- This migration restores SELECT + INSERT for clients/admins
-- and adds UPDATE for soft-delete (deleted_at, deleted_by, delete_reason).
-- =====================================================

-- Drop any conflicting policies first (idempotent)
DROP POLICY IF EXISTS "Users can view own deposit proofs" ON public.deposit_proofs;
DROP POLICY IF EXISTS "Admins can view all deposit proofs" ON public.deposit_proofs;
DROP POLICY IF EXISTS "Users can upload proofs for own deposits" ON public.deposit_proofs;
DROP POLICY IF EXISTS "Users can update own deposit proofs" ON public.deposit_proofs;
DROP POLICY IF EXISTS "Admins can update deposit proofs" ON public.deposit_proofs;

-- SELECT: Users see proofs for their own deposits
CREATE POLICY "Users can view own deposit proofs"
  ON public.deposit_proofs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_proofs.deposit_id AND d.user_id = auth.uid()
  ));

-- SELECT: Admins see all proofs
CREATE POLICY "Admins can view all deposit proofs"
  ON public.deposit_proofs FOR SELECT
  USING (public.is_admin(auth.uid()));

-- INSERT: Users can upload proofs for their own deposits
CREATE POLICY "Users can upload proofs for own deposits"
  ON public.deposit_proofs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_proofs.deposit_id AND d.user_id = auth.uid()
  ));

-- UPDATE: Users can soft-delete proofs on their own deposits
CREATE POLICY "Users can update own deposit proofs"
  ON public.deposit_proofs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_proofs.deposit_id AND d.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deposits d
    WHERE d.id = deposit_proofs.deposit_id AND d.user_id = auth.uid()
  ));

-- UPDATE: Admins can update any proof
CREATE POLICY "Admins can update deposit proofs"
  ON public.deposit_proofs FOR UPDATE
  USING (public.is_admin(auth.uid()));

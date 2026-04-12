-- ============================================================
-- Suppression des anciennes RPCs de suppression destructrice
--
-- Ces RPCs effaçaient les ledger_entries et modifiaient
-- directement le wallet. Elles sont remplacées par
-- cancel_deposit et cancel_payment (migration 20260413000001).
-- ============================================================

DROP FUNCTION IF EXISTS public.delete_deposit(UUID);
DROP FUNCTION IF EXISTS public.delete_payment(UUID);

NOTIFY pgrst, 'reload schema';

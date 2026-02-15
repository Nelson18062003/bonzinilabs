-- =====================================================
-- Fix: Drop old 2-param function overloads
-- The enhanced_deposit_validation migration created
-- new 4-param versions but didn't drop the old ones.
-- PostgREST can't resolve overloaded functions reliably.
-- =====================================================

-- Drop old validate_deposit(UUID, TEXT) if it exists
DROP FUNCTION IF EXISTS public.validate_deposit(UUID, TEXT);

-- Drop old reject_deposit(UUID, TEXT) if it exists
DROP FUNCTION IF EXISTS public.reject_deposit(UUID, TEXT);

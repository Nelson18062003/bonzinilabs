-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Fix : ambiguïté de surcharge sur admin_adjust_wallet                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Symptôme (créditer/débiter un wallet via Mola) :
--   « Could not choose the best candidate function between:
--     public.admin_adjust_wallet(p_amount => bigint, ...),
--     public.admin_adjust_wallet(p_amount => numeric, ...) »
--
-- Cause : une ancienne version admin_adjust_wallet(uuid, BIGINT, text, text)
-- (migration 2025-12-28) n'a jamais été supprimée. La version actuelle
-- (uuid, NUMERIC, text, text, migration 2026-02-21) a été créée À CÔTÉ
-- (type de paramètre différent → CREATE OR REPLACE ne remplace pas, il ajoute
-- une surcharge). Les deux coexistent → tout appel avec un montant entier
-- devient ambigu et échoue (donc aucune carte de confirmation ne s'affiche).
--
-- Correctif : supprimer la surcharge BIGINT obsolète. On garde la NUMERIC
-- (l'actuelle) ; les montants entiers (XAF) y sont acceptés sans souci.
-- Idempotent.

drop function if exists public.admin_adjust_wallet(uuid, bigint, text, text);

notify pgrst, 'reload schema';

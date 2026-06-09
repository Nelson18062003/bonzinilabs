-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Fix : ambiguïtés de surcharge de fonctions (RPC appelées par Mola)          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Symptôme : « Could not choose the best candidate function between: ... »
-- quand Mola appelle une RPC qui existe en DEUX versions (deux signatures
-- coexistantes). Cause : une version a été redéfinie avec un type/nombre
-- d'arguments différent SANS supprimer l'ancienne → deux surcharges vivantes →
-- l'appel devient ambigu et échoue (et aucune carte de confirmation ne s'affiche).
--
-- Audit chronologique des migrations → 2 fonctions concernées. On supprime la
-- surcharge OBSOLÈTE de chacune, on garde la version actuelle. Idempotent.

-- 1) admin_adjust_wallet : garder (uuid, numeric, text, text) [actuelle, 2026-02-21],
--    supprimer l'ancienne (uuid, BIGINT, text, text) [2025-12-28]. Les montants XAF
--    entiers passent sans souci dans la version numeric.
drop function if exists public.admin_adjust_wallet(uuid, bigint, text, text);

-- 2) reject_deposit : garder (uuid, text) [actuelle, 2026-02-21, avec is_admin],
--    supprimer l'ancienne (uuid, text, text, text) [2026-02-13] dont les 2 derniers
--    args avaient des DEFAULT → rendait l'appel à 2 arguments ambigu.
drop function if exists public.reject_deposit(uuid, text, text, text);

notify pgrst, 'reload schema';

-- (re-déploiement : la tentative précédente a été bloquée par la limite Vercel free-tier, désormais réinitialisée)

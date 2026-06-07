-- ============================================================
-- Centrale d'achat — Lot 0 : rôle sourcing_agent
--
-- Étend l'enum app_role pour un compte dédié « agent de sourcing »
-- (profil du père de Bonzini, EN PLUS de son rôle treasurer — un
-- user peut cumuler plusieurs lignes user_roles).
--   * can_access_procurement() => TRUE (déjà géré par le helper du
--     Lot schéma, qui compare role::text — l'ajout de la valeur
--     l'active automatiquement)
--   * is_admin() => TRUE (toute ligne user_roles non désactivée
--     compte comme admin, quel que soit le rôle)
--   * N'hérite PAS de canManageUsers / paiements / taux ; appliqué
--     côté front via ROLE_PERMISSIONS.
--
-- ALTER TYPE ... ADD VALUE est non destructif (PG 15). La nouvelle
-- valeur n'est PAS utilisée en littéral dans cette migration (le
-- helper compare en texte) → pas de souci de transaction.
-- ============================================================

-- ── 1. Étendre l'enum ──
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sourcing_agent';

-- ── 2. Helper de vérification explicite (pour de futures RPC) ──
CREATE OR REPLACE FUNCTION public.is_sourcing_agent(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (is_disabled = false OR is_disabled IS NULL)
      AND role::text = 'sourcing_agent'
  )
$$;

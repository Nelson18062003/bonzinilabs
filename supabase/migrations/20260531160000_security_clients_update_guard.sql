-- ============================================================
-- SÉCURITÉ (revue de sécurité — finding C1)
-- Empêcher l'auto-mutation des colonnes privilégiées de `clients`.
--
-- PROBLÈME : la policy "Users can update own client profile" est
-- FOR UPDATE USING (auth.uid() = user_id) SANS WITH CHECK. Avec la clé
-- publishable, un client authentifié peut contourner le formulaire
-- d'onboarding et faire :
--   supabase.from('clients').update({ kyc_verified:true, status:'ACTIVE' })
-- → auto-validation KYC / changement de statut. Intégrité KYC non garantie.
--
-- CORRECTION (2 couches) :
--   1. WITH CHECK sur la policy user → épingle user_id (pas de réassignation).
--   2. Trigger BEFORE UPDATE → si l'appelant N'EST PAS admin, on restaure
--      les valeurs OLD des colonnes sensibles (kyc_verified, status, notes,
--      user_id, kyc-related). Les admins (is_admin) gardent le plein contrôle
--      (ils éditent via SECURITY DEFINER RPC ou la policy admin).
--
-- Pourquoi un trigger plutôt qu'un REVOKE de colonnes : le REVOKE bloquerait
-- aussi les admins (même rôle `authenticated`). Le trigger distingue par
-- is_admin() et préserve donc la gestion KYC côté admin.
-- ============================================================

-- 1. Ajouter le WITH CHECK manquant (épingle user_id).
DROP POLICY IF EXISTS "Users can update own client profile" ON public.clients;
CREATE POLICY "Users can update own client profile"
ON public.clients FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Garde au niveau ligne : un non-admin ne peut pas modifier les colonnes
--    sensibles, même en écrivant directement via l'API REST.
CREATE OR REPLACE FUNCTION public.guard_clients_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Les admins ont le plein contrôle (gestion KYC légitime).
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Sinon : restaurer les valeurs existantes des colonnes protégées.
  NEW.kyc_verified := OLD.kyc_verified;
  NEW.status       := OLD.status;
  NEW.notes        := OLD.notes;
  NEW.user_id      := OLD.user_id;   -- jamais de réassignation de propriétaire

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_clients_privileged_columns IS
  'Empêche un non-admin de modifier kyc_verified/status/notes/user_id sur clients (anti auto-validation KYC). Les admins conservent le contrôle.';

-- Trigger AVANT le trigger updated_at (ordre alphabétique des noms :
-- "guard_..." < "update_..." → s'exécute en premier, c'est ce qu'on veut).
DROP TRIGGER IF EXISTS guard_clients_privileged_columns ON public.clients;
CREATE TRIGGER guard_clients_privileged_columns
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.guard_clients_privileged_columns();

NOTIFY pgrst, 'reload schema';

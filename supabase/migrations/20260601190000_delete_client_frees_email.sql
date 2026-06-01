-- ============================================================
-- Correctif : supprimer un client LIBÈRE son email (réutilisable ensuite).
--
-- PROBLÈME : admin_delete_client supprimait toutes les données métier
-- (client, wallet, dépôts, paiements, ledger…) mais PAS l'utilisateur dans
-- auth.users → l'email restait « réservé » et ne pouvait plus servir à
-- recréer un compte, même après suppression du client.
--
-- CORRECTIF : on supprime aussi auth.identities + auth.users à la fin.
-- ROBUSTESSE : si une donnée référence encore cet utilisateur (FK sans
-- cascade), on N'ÉCHOUE PAS la suppression du client — on renvoie juste
-- email_freed=false pour le signaler. Sinon email_freed=true.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_delete_client(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_has_role BOOLEAN;
  v_auth_freed BOOLEAN := false;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  ) INTO v_has_role;

  IF v_has_role THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer un utilisateur admin/agent. Supprimez d''abord son rôle.');
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;

  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_adjustments WHERE wallet_id = v_wallet_id;
  END IF;

  DELETE FROM ledger_entries WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;

  DELETE FROM deposit_timeline_events WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  DELETE FROM deposit_proofs WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  DELETE FROM deposits WHERE user_id = p_user_id;

  DELETE FROM payment_timeline_events WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  DELETE FROM payment_proofs WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  DELETE FROM payments WHERE user_id = p_user_id;

  DELETE FROM wallets WHERE user_id = p_user_id;

  -- Supprime le client (cascade sur ses bénéficiaires, conversations chat, etc.
  -- liés par client_id ON DELETE CASCADE).
  DELETE FROM clients WHERE user_id = p_user_id;

  -- LIBÈRE L'EMAIL : supprimer aussi l'utilisateur auth. Best-effort — si une
  -- FK sans cascade le retient encore, on ne casse pas la suppression du client.
  BEGIN
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
    v_auth_freed := true;
  EXCEPTION WHEN OTHERS THEN
    v_auth_freed := false;
    RAISE WARNING 'admin_delete_client: auth.users % non supprimé (référencé ailleurs): %', p_user_id, SQLERRM;
  END;

  RETURN json_build_object(
    'success', true,
    'email_freed', v_auth_freed,
    'message', CASE WHEN v_auth_freed
                    THEN 'Client supprimé ; email libéré (réutilisable).'
                    ELSE 'Client supprimé (email encore réservé : données liées restantes).'
               END
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

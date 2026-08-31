-- ============================================================
-- P1 — Fonctions internes (cron / triggers) exposées à l'API PostgREST.
--
-- Supabase accorde par défaut l'EXECUTE à `anon` et `authenticated` sur
-- toute fonction du schéma `public` : elles deviennent donc appelables en
-- HTTP via /rest/v1/rpc/<nom>. Pour une fonction de maintenance, cette
-- valeur par défaut EST la faille — il n'y a aucun autre garde-fou dans le
-- corps, puisque « seul le cron l'appelle ».
--
-- Constaté :
--   · claim_email_batch / claim_sms_batch renvoient SETOF email_outbox /
--     sms_outbox et étaient exécutables par `anon` : un appel NON
--     AUTHENTIFIÉ récupérait un lot de messages en attente avec
--     recipient_email / recipient_phone et le payload (prénom, montants,
--     référence, nouveau solde). Fuite de PII et de données financières.
--     (Aucun code de vérification ne transite par ces files — vérifié sur
--     les clés des payloads — donc pas de contournement d'authentification.)
--   · run_email_drainer / run_sms_drainer / run_*_reminders : exécutables
--     par `anon`, déclenchent des envois de masse.
--   · mola_purge_old_conversations(p_days) : exécutable par tout compte
--     connecté. Un simple appel avec p_days = 1 SUPPRIME l'historique des
--     conversations de l'assistant et la mémoire expirée.
--   · _create_client_and_wallet / _enqueue_welcome : helpers internes du
--     trigger handle_new_user, exposés à `anon` ; le premier insère une
--     ligne `clients` + `wallets` pour un user_id arbitraire.
--
-- Correctif : retirer l'EXECUTE à `anon` et `authenticated`. Les appelants
-- légitimes ne sont pas concernés — vérifié un par un :
--   · pg_cron exécute ces fonctions en tant que `postgres` (jobs
--     email-drainer, sms-drainer, deposit-reminders, profile-reminders,
--     sms-deposit-reminders, mola-purge-conversations) ;
--   · les edge functions send-email et send-sms utilisent la clé
--     SERVICE_ROLE (donc le rôle `service_role`, conservé) ;
--   · handle_new_user est SECURITY DEFINER et appartient à `postgres` :
--     les helpers restent appelables depuis le trigger.
-- Aucun appel à ces fonctions n'existe dans src/ ni dans les autres edge
-- functions (vérifié par recherche).
--
-- Modèle déjà appliqué ailleurs dans ce projet : purge_webauthn_challenges
-- n'accorde l'EXECUTE qu'à postgres et service_role.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.claim_email_batch(integer)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_sms_batch(integer)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_email_drainer()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_sms_drainer()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_deposit_reminders()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_profile_reminders()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_sms_deposit_reminders()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mola_purge_old_conversations(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._create_client_and_wallet(uuid, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._enqueue_welcome(uuid, text)      FROM anon, authenticated;

-- Le GRANT implicite à PUBLIC (colonne « =X/postgres ») rendrait la
-- révocation ci-dessus inopérante : anon et authenticated héritent de
-- PUBLIC. On le retire aussi là où il subsiste.
REVOKE EXECUTE ON FUNCTION public._create_client_and_wallet(uuid, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._enqueue_welcome(uuid, text)                 FROM PUBLIC;

-- Garde-fou : la révocation seule protège l'API, mais un futur GRANT
-- (ou un `GRANT ... ON ALL FUNCTIONS`) la réouvrirait silencieusement.
-- La purge, qui DÉTRUIT des données, porte donc aussi un contrôle dans son
-- corps : réservée au super_admin quand elle est appelée par un humain,
-- toujours autorisée pour le cron (postgres) et service_role.
CREATE OR REPLACE FUNCTION public.mola_purge_old_conversations(p_days integer DEFAULT 180)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv int;
  v_mem  int;
BEGIN
  -- auth.uid() est NULL pour le cron et service_role : on ne bloque que
  -- les appels porteurs d'une session utilisateur.
  IF auth.uid() IS NOT NULL
     AND NOT public.admin_has_permission(auth.uid(), 'canManageUsers') THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  DELETE FROM public.assistant_conversations
  WHERE updated_at < now() - make_interval(days => greatest(1, p_days));
  GET DIAGNOSTICS v_conv = ROW_COUNT;

  DELETE FROM public.mola_memory
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_mem = ROW_COUNT;

  RETURN jsonb_build_object('conversations_deleted', v_conv, 'expired_memory_deleted', v_mem);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mola_purge_old_conversations(integer) FROM anon, authenticated;

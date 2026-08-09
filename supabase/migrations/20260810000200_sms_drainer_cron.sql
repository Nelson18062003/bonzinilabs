-- ============================================================
-- SMS — Lot 3 : planification du drainage.
--
-- pg_cron appelle l'Edge Function send-sms toutes les minutes via pg_net.
-- La fonction réserve un lot (claim_sms_batch) et envoie via Telnyx.
--
-- CADENCE : toutes les minutes, comme le drainer email. Les deux jobs
-- tournent sur la même minute et c'est volontaire : ils touchent des tables
-- disjointes (email_outbox / sms_outbox), chacun prend son lot avec
-- FOR UPDATE SKIP LOCKED, et aucun verrou n'est partagé — il n'y a donc
-- rien à décaler. Sur une alerte d'argent, la latence compte davantage
-- qu'une répartition cosmétique de la charge.
--
-- SECRETS VIA SUPABASE VAULT (jamais en clair dans une migration) :
--   - 'project_url'        : https://<ref>.supabase.co
--   - 'sms_drainer_secret' : doit == le secret Edge Function SMS_DRAINER_SECRET
--   - 'service_role_key'   : passe verify_jwt côté plateforme
--
-- Le job est créé ici mais reste sans effet tant que (a) les secrets Vault
-- ne sont pas posés (la fonction sort proprement) et (b) aucun gabarit n'est
-- activé dans sms_template_map (aucune ligne à drainer).
-- → Sûr à migrer avant même la configuration Telnyx.
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_sms_drainer()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url            TEXT;
  v_drainer_secret TEXT;
  v_service_key    TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_drainer_secret
    FROM vault.decrypted_secrets WHERE name = 'sms_drainer_secret';
  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_url IS NULL OR v_drainer_secret IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'run_sms_drainer: secrets Vault manquants (project_url / sms_drainer_secret / service_role_key) — appel ignoré';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-sms',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'apikey',        v_service_key,
      'Authorization', 'Bearer ' || v_drainer_secret
    ),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'run_sms_drainer failed: %', SQLERRM;
END;
$$;

-- Un seul COMMENT par fonction : l'étiquette @mola EST le commentaire.
COMMENT ON FUNCTION public.run_sms_drainer() IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewLogs","confirm":false,"danger":false,"label":"Déclencher le drainage des SMS en attente — lit les secrets Vault et appelle send-sms (interne, cron)"}';

REVOKE ALL ON FUNCTION public.run_sms_drainer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_sms_drainer() FROM authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('sms-drainer')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sms-drainer');

  PERFORM cron.schedule(
    'sms-drainer',
    '* * * * *',
    $cron$ SELECT public.run_sms_drainer(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron pas encore activé au moment du push : on ne fait pas échouer la
  -- migration, il suffira de rejouer ce bloc après activation.
  RAISE WARNING 'Planification cron sms-drainer impossible (pg_cron activé ?): %', SQLERRM;
END;
$$;

-- ============================================================
-- NOTE CONFIG (à poser dans Vault — Project Settings → Vault) :
--   project_url        = https://fmhsohrgbznqmcvqktjw.supabase.co
--   sms_drainer_secret = <même valeur que le secret Edge Function SMS_DRAINER_SECRET>
--   service_role_key   = <Service role key du projet>
--
-- SECRETS EDGE FUNCTIONS à configurer en parallèle :
--   TELNYX_API_KEY                 (clé API v2)
--   TELNYX_PHONE_NUMBER            (numéro acheté, en E.164 — expéditeur de repli)
--   TELNYX_MESSAGING_PROFILE_ID    (requis pour l'expéditeur alphanumérique)
--   TELNYX_PUBLIC_KEY              (clé publique Ed25519, pour le webhook)
--   SMS_DRAINER_SECRET             (== vault 'sms_drainer_secret')
-- ============================================================

NOTIFY pgrst, 'reload schema';

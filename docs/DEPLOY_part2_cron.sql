-- ============================================================
-- BONZINI — DÉPLOIEMENT PARTIE 2/2 : CRON D'ENVOI DES EMAILS
-- À coller dans Supabase → SQL Editor → Run,
-- UNIQUEMENT APRÈS avoir activé l'extension pg_cron
-- (Database → Extensions → pg_cron → Enable).
-- ============================================================

-- ============================================================
-- Chantier B — Lot B4 (planification) — Cron de drainage des emails
--
-- pg_cron appelle l'Edge Function send-email toutes les minutes via pg_net.
-- La fonction réserve un lot (claim_email_batch) et envoie via Resend.
--
-- SECRETS via SUPABASE VAULT (jamais en clair dans une migration) :
--   - 'project_url'           : https://<ref>.supabase.co
--   - 'email_drainer_secret'  : doit == EDGE FUNCTION secret EMAIL_DRAINER_SECRET
--   - 'service_role_key'      : pour passer verify_jwt côté plateforme + autoriser
--                               l'appel de la fonction.
--
-- ⚠️ PRÉREQUIS (config, fait par toi dans le dashboard) :
--   1. Extensions pg_cron ET pg_net activées.
--   2. Les 3 secrets ci-dessus présents dans Vault (Project Settings →
--      Vault → New secret). Voir le COMMENT plus bas pour les noms exacts.
--   3. EMAIL_DRAINER_SECRET (Edge Functions) == vault 'email_drainer_secret'.
--
-- Le job est CRÉÉ ICI mais ne fait rien d'utile tant que (a) les secrets
-- Vault ne sont pas posés (la fonction wrapper sort proprement si absent) et
-- (b) email_template_map.enabled n'est pas activé (aucune ligne à drainer).
-- → Sûr à migrer même avant la config.
-- ============================================================

-- Wrapper SQL : lit les secrets dans Vault et POST vers l'Edge Function.
CREATE OR REPLACE FUNCTION public.run_email_drainer()
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
  -- Lire les secrets depuis Vault (NULL si absents → on sort proprement).
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_drainer_secret
    FROM vault.decrypted_secrets WHERE name = 'email_drainer_secret';
  SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  IF v_url IS NULL OR v_drainer_secret IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'run_email_drainer: secrets Vault manquants (project_url / email_drainer_secret / service_role_key) — appel ignoré';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-email',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- verify_jwt=false sur send-email, mais on envoie le service key en
      -- apikey (bonne pratique plateforme) + le secret du drainer en Bearer
      -- (c'est ce que la fonction vérifie réellement, en temps constant).
      'apikey',        v_service_key,
      'Authorization', 'Bearer ' || v_drainer_secret
    ),
    timeout_milliseconds := 10000
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'run_email_drainer failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.run_email_drainer IS
  'Appelé par pg_cron : lit les secrets Vault (project_url, email_drainer_secret, service_role_key) et POST vers l''Edge Function send-email. No-op si secrets absents.';

REVOKE ALL ON FUNCTION public.run_email_drainer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_email_drainer() FROM authenticated;

-- Planifier toutes les minutes (idempotent : on dé-planifie d'abord si présent).
DO $$
BEGIN
  -- Supprimer un éventuel job homonyme (re-run de migration).
  PERFORM cron.unschedule('email-drainer')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-drainer');

  PERFORM cron.schedule(
    'email-drainer',
    '* * * * *',                       -- toutes les minutes
    $cron$ SELECT public.run_email_drainer(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  -- Si pg_cron n'est pas encore activé au moment du push, on n'échoue pas la
  -- migration : il suffira de re-jouer ce bloc après activation (ou de
  -- planifier manuellement). On journalise.
  RAISE WARNING 'Planification cron email-drainer impossible (pg_cron activé ?): %', SQLERRM;
END;
$$;

-- ============================================================
-- NOTE CONFIG (à poser dans Vault — Project Settings → Vault) :
--   project_url          = https://fmhsohrgbznqmcvqktjw.supabase.co
--   email_drainer_secret = <même valeur que le secret Edge Function EMAIL_DRAINER_SECRET>
--   service_role_key     = <Service role key du projet (Settings → API)>
-- ============================================================

NOTIFY pgrst, 'reload schema';

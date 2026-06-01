-- ============================================================
-- Relances (incrément 2) — emails de ré-engagement, via pg_cron
--   #1 deposit_reminder     : dépôt commencé mais non finalisé (status 'created')
--   #2 onboarding_reminder  : profil incomplet (téléphone/pays manquant)
--
-- GARDE-FOUS ANTI-SPAM (importants) :
--   - FENÊTRE BORNÉE : on ne relance que les entités âgées de 1 à 3 jours.
--     → évite tout « blast » sur l'historique au moment de l'activation, et
--       cible le bon moment pour le ré-engagement.
--   - 1 SEUL RAPPEL PAR ENTITÉ : idempotency_key unique (deposit_reminder:<id>
--     / profile_reminder:<user_id>) → jamais 2 relances pour la même chose.
--   - inerte tant que email_template_map.enabled = false.
--   - @bonzini-client.local → 'skipped'.
--
-- Les fonctions ENFILENT seulement ; l'envoi reste fait par le drainer
-- existant (run_email_drainer, déjà planifié chaque minute).
-- ============================================================

INSERT INTO public.email_template_map (notification_type, template, enabled) VALUES
  ('deposit_reminder',    'deposit_reminder',    true),
  ('onboarding_reminder', 'onboarding_reminder', true)
ON CONFLICT (notification_type) DO UPDATE SET enabled = EXCLUDED.enabled;

-- ── #1 Relance dépôt non finalisé ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_deposit_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'deposit_reminder';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  INSERT INTO public.email_outbox (
    event_type, entity_id, recipient_user_id, recipient_email,
    template, payload, status, idempotency_key
  )
  SELECT
    'deposit_reminder', d.id, d.user_id, u.email, 'deposit_reminder',
    jsonb_build_object('metadata', jsonb_build_object(
      'reference', d.reference, 'amount_xaf', d.amount_xaf)),
    CASE WHEN u.email IS NULL OR u.email = '' OR lower(u.email) LIKE '%@bonzini-client.local'
         THEN 'skipped' ELSE 'pending' END,
    'deposit_reminder:' || d.id::text
  FROM public.deposits d
  JOIN auth.users u ON u.id = d.user_id
  WHERE d.status = 'created'
    AND d.created_at < now() - interval '24 hours'
    AND d.created_at > now() - interval '3 days'
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ── #2 Relance profil incomplet ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_profile_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'onboarding_reminder';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  INSERT INTO public.email_outbox (
    event_type, entity_id, recipient_user_id, recipient_email,
    template, payload, status, idempotency_key
  )
  SELECT
    'onboarding_reminder', c.user_id, c.user_id, u.email, 'onboarding_reminder',
    jsonb_build_object('first_name', COALESCE(c.first_name, '')),
    CASE WHEN u.email IS NULL OR u.email = '' OR lower(u.email) LIKE '%@bonzini-client.local'
         THEN 'skipped' ELSE 'pending' END,
    'profile_reminder:' || c.user_id::text
  FROM public.clients c
  JOIN auth.users u ON u.id = c.user_id
  WHERE (c.phone IS NULL OR c.phone = '' OR c.country IS NULL OR c.country = '')
    AND c.created_at < now() - interval '24 hours'
    AND c.created_at > now() - interval '3 days'
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.run_deposit_reminders()  FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.run_profile_reminders()  FROM PUBLIC, authenticated;

-- ── Planification horaire (offsets pour ne pas tout lancer en même temps) ─
DO $$
BEGIN
  PERFORM cron.unschedule('deposit-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deposit-reminders');
  PERFORM cron.schedule('deposit-reminders', '17 * * * *',
    $cron$ SELECT public.run_deposit_reminders(); $cron$);

  PERFORM cron.unschedule('profile-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'profile-reminders');
  PERFORM cron.schedule('profile-reminders', '37 * * * *',
    $cron$ SELECT public.run_profile_reminders(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Planification des relances impossible (pg_cron activé ?): %', SQLERRM;
END;
$$;

NOTIFY pgrst, 'reload schema';

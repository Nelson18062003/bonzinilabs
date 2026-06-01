-- ============================================================
-- Migrations restantes (non appliquées auto faute de SUPABASE_DB_PASSWORD)
-- À coller dans Supabase → SQL Editor → Run. Idempotent / sûr.
--   1) emails doux (paiement en cours, mot de passe changé, accusé dépôt désactivé)
--   2) relances (dépôt non finalisé, profil incomplet)
--   3) bienvenue (à la création si vérifié + à la vérification du code)
-- ============================================================

-- ════════ 20260601141000_email_soft_transactional.sql ════════
-- ============================================================
-- Emails « doux » transactionnels (incrément 1)
--   #1 accusé de dépôt    (deposit_created)    — déclencheur sur deposits
--   #2 paiement en cours  (payment_processing) — notif déjà existante, on active
--   #3 mot de passe changé(password_changed)   — RPC appelée par le front
--
-- Réutilise l'outbox + drainer + cron déjà en place. Best-effort partout
-- (un échec d'enqueue n'impacte jamais l'opération métier). Comptes
-- téléphone-seul (@bonzini-client.local) → 'skipped'.
-- ============================================================

-- ── Mapping : activer ces 3 types (le cron est déjà live) ───────────────
INSERT INTO public.email_template_map (notification_type, template, enabled) VALUES
  ('deposit_created',     'deposit_created',     false),  -- accusé de dépôt : DIFFÉRÉ (réactiver plus tard)
  ('password_changed',    'password_changed',    true)
ON CONFLICT (notification_type) DO UPDATE SET enabled = EXCLUDED.enabled;

UPDATE public.email_template_map
   SET enabled = true
 WHERE notification_type = 'payment_processing';

-- ── #1 Accusé de dépôt : email quand le client soumet sa preuve ─────────
-- Déclenché à l'entrée en statut 'proof_submitted' (la « demande déposée »).
CREATE OR REPLACE FUNCTION public.enqueue_deposit_ack_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_email   TEXT;
  v_status  TEXT;
BEGIN
  BEGIN
    SELECT enabled INTO v_enabled
      FROM public.email_template_map WHERE notification_type = 'deposit_created';
    IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

    IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
      v_status := 'skipped';
    ELSE
      v_status := 'pending';
    END IF;

    INSERT INTO public.email_outbox (
      event_type, entity_id, recipient_user_id, recipient_email,
      template, payload, status, idempotency_key
    ) VALUES (
      'deposit_created', NEW.id, NEW.user_id, v_email, 'deposit_created',
      jsonb_build_object('metadata', jsonb_build_object(
        'reference', NEW.reference, 'amount_xaf', NEW.amount_xaf)),
      v_status, 'deposit_ack:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_deposit_ack_email: dépôt % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deposit_submitted_enqueue_email ON public.deposits;
CREATE TRIGGER on_deposit_submitted_enqueue_email
  AFTER INSERT OR UPDATE OF status ON public.deposits
  FOR EACH ROW
  WHEN (NEW.status = 'proof_submitted')
  EXECUTE FUNCTION public.enqueue_deposit_ack_email();

-- ── #3 Mot de passe changé : RPC appelée par le front après updateUser ──
CREATE OR REPLACE FUNCTION public.enqueue_password_changed_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT;
  v_enabled BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'password_changed';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
    RETURN;
  END IF;

  INSERT INTO public.email_outbox (
    event_type, recipient_user_id, recipient_email, template, payload,
    status, idempotency_key
  ) VALUES (
    'password_changed', v_uid, v_email, 'password_changed',
    jsonb_build_object('changed_at',
      to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC'),
    'pending',
    -- un email par changement (dédup. si double-appel dans la même seconde)
    'pwdchanged:' || v_uid::text || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.enqueue_password_changed_email IS
  'Enfile l''email de sécurité « mot de passe modifié » pour l''utilisateur courant. Appelée par le front après un changement de mot de passe réussi.';

REVOKE ALL ON FUNCTION public.enqueue_password_changed_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_password_changed_email() TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ════════ 20260601160000_email_reminders_cron.sql ════════
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


-- ════════ 20260601170000_welcome_email_on_client_create.sql ════════
-- ============================================================
-- Mail de bienvenue — déclenché UNIQUEMENT quand l'email est VÉRIFIÉ.
--
-- Règle métier (demandée) :
--   - Inscription manuelle (email+mot de passe) : code OTP d'abord, puis
--     bienvenue APRÈS vérification. → géré par le trigger B (à la confirmation).
--   - Compte créé par un admin (email réel) : déjà confirmé → bienvenue seule,
--     pas d'OTP. → géré par le trigger A (à la création, email déjà confirmé).
--   - Google : email déjà vérifié → bienvenue seule, pas d'OTP. → trigger A.
--
-- 2 déclencheurs complémentaires, MÊME idempotency_key ('welcome:<user_id>')
-- → un seul mail de bienvenue par utilisateur, quoi qu'il arrive.
--
-- SÛRETÉ : best-effort partout (un échec n'impacte JAMAIS l'auth ni la
-- création du compte). Inerte si template 'welcome' désactivé.
-- Téléphone-seul (@bonzini-client.local) → 'skipped'.
-- ============================================================

-- Fonction d'enqueue partagée (par user_id + prénom).
CREATE OR REPLACE FUNCTION public._enqueue_welcome(p_user_id UUID, p_first TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_email   TEXT;
  v_status  TEXT;
BEGIN
  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'welcome';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
    v_status := 'skipped';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO public.email_outbox (
    event_type, recipient_user_id, recipient_email, template, payload,
    status, idempotency_key
  ) VALUES (
    'welcome', p_user_id, v_email, 'welcome',
    jsonb_build_object('first_name', COALESCE(p_first, '')),
    v_status, 'welcome:' || p_user_id::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ── Trigger A : à la création du client, SI l'email est DÉJÀ vérifié ──────
-- Couvre : admin (email_confirm) + Google (email_verified). Les inscriptions
-- manuelles (non encore vérifiées) sont ignorées ici → voir trigger B.
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_confirmed TIMESTAMPTZ;
BEGIN
  BEGIN
    SELECT email_confirmed_at INTO v_confirmed FROM auth.users WHERE id = NEW.user_id;
    -- Bienvenue seulement si l'email est déjà confirmé à la création
    -- (admin/Google). Sinon (inscription manuelle non vérifiée) : on attend B.
    IF v_confirmed IS NOT NULL THEN
      PERFORM public._enqueue_welcome(NEW.user_id, NEW.first_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome_on_client % : %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_client_created_welcome_email ON public.clients;
CREATE TRIGGER on_client_created_welcome_email
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_welcome_email_on_client();

-- ── Trigger B : au moment où l'email devient VÉRIFIÉ (null → non-null) ─────
-- Couvre l'inscription manuelle : bienvenue envoyée APRÈS la saisie du code OTP.
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_first TEXT;
BEGIN
  BEGIN
    -- N'enfile que pour les clients (pas les admins) ayant une fiche.
    SELECT first_name INTO v_first FROM public.clients WHERE user_id = NEW.id;
    IF FOUND THEN
      PERFORM public._enqueue_welcome(NEW.id, v_first);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'welcome_on_confirm % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_email_confirmed_welcome ON auth.users;
CREATE TRIGGER on_user_email_confirmed_welcome
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.enqueue_welcome_email_on_confirm();

NOTIFY pgrst, 'reload schema';


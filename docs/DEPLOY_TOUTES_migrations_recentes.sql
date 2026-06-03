-- ============================================================
-- TOUTES les migrations récentes — coller dans SQL Editor → Run.
-- 100% idempotent. Inclut : message support, emails doux, relances,
-- bienvenue, création différée (vérif), libération email, onboarding robuste.
-- ============================================================

-- ════════ 20260601121000_email_support_message_trigger.sql ════════
-- ============================================================
-- Chantier B — #3 : notification email quand le SUPPORT écrit au client
--
-- Quand un message de chat est inséré avec sender_type='admin', on met en
-- file (email_outbox) un email 'support_message' vers le client de la
-- conversation. Le client est notifié qu'un message l'attend → il vient le
-- lire et répondre dans l'application.
--
-- RÉUTILISE l'architecture outbox existante (drainer send-email + Resend).
--
-- ANTI-SPAM (debounce) : on n'envoie qu'UN email tant que le client n'a pas
-- lu. Concrètement : s'il existe déjà un autre message admin NON LU dans la
-- conversation, le client a déjà été notifié → on n'enfile pas un 2ᵉ email.
-- (Indépendant de l'ordre des triggers : on interroge directement les messages.)
--
-- GARANTIES :
--   - best-effort : un échec d'enqueue n'annule jamais l'insertion du message
--     (bloc EXCEPTION WHEN OTHERS).
--   - inerte tant que email_template_map.enabled('support_message') = false.
--   - comptes téléphone-seul (@bonzini-client.local) → status 'skipped'.
--   - idempotent : idempotency_key = 'chatmsg:<message_id>'.
-- ============================================================

-- 1. Mapping (désactivé au départ, comme le reste du set email).
INSERT INTO public.email_template_map (notification_type, template, enabled)
VALUES ('support_message', 'support_message', false)
ON CONFLICT (notification_type) DO NOTHING;

-- 2. Fonction trigger.
CREATE OR REPLACE FUNCTION public.enqueue_email_on_admin_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled   BOOLEAN;
  v_client_id UUID;
  v_user_id   UUID;
  v_email     TEXT;
  v_status    TEXT;
  v_preview   TEXT;
BEGIN
  -- Seuls les messages ADMIN notifient le client.
  IF NEW.sender_type <> 'admin' THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- a. Le type est-il activé ?
    SELECT enabled INTO v_enabled
      FROM public.email_template_map
     WHERE notification_type = 'support_message';
    IF v_enabled IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    -- b. Anti-spam : déjà un autre message admin non lu ? → déjà notifié.
    IF EXISTS (
      SELECT 1 FROM public.chat_messages
       WHERE conversation_id = NEW.conversation_id
         AND sender_type = 'admin'
         AND read_at IS NULL
         AND id <> NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    -- c. Résoudre le client de la conversation → user_id + email.
    SELECT c.client_id INTO v_client_id
      FROM public.chat_conversations c
     WHERE c.id = NEW.conversation_id;
    IF v_client_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT cl.user_id INTO v_user_id
      FROM public.clients cl
     WHERE cl.id = v_client_id;

    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

    -- d. Adresse réelle ? Sinon 'skipped' (téléphone-seul).
    IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
      v_status := 'skipped';
    ELSE
      v_status := 'pending';
    END IF;

    -- e. Aperçu du message (tronqué ; média-seul → libellé générique).
    v_preview := left(COALESCE(NULLIF(TRIM(NEW.content), ''), '📎 Pièce jointe'), 160);

    -- f. Enqueue (idempotent par message).
    INSERT INTO public.email_outbox (
      event_type, entity_id, recipient_user_id, recipient_email,
      template, payload, status, idempotency_key
    ) VALUES (
      'support_message', NEW.conversation_id, v_user_id, v_email,
      'support_message',
      jsonb_build_object(
        'message_preview', v_preview,
        'conversation_id', NEW.conversation_id
      ),
      v_status,
      'chatmsg:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_email_on_admin_chat_message: échec pour message % : %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_email_on_admin_chat_message IS
  'Trigger AFTER INSERT ON chat_messages : met en file un email ''support_message'' vers le client quand l''admin répond (avec debounce anti-spam). Best-effort, inerte tant que email_template_map.enabled=false.';

-- 3. Trigger.
DROP TRIGGER IF EXISTS on_admin_chat_message_enqueue_email ON public.chat_messages;
CREATE TRIGGER on_admin_chat_message_enqueue_email
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_email_on_admin_chat_message();

NOTIFY pgrst, 'reload schema';


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


-- ════════ 20260601180000_defer_client_until_verified.sql ════════
-- ============================================================
-- Inscription email : le compte n'est créé qu'APRÈS vérification du code.
--
-- DEMANDE : un client qui s'inscrit par email/mot de passe ne doit être
-- considéré « créé » (client + wallet + notif admin) qu'une fois son email
-- VÉRIFIÉ via le code. Avant la vérification → rien n'est matérialisé.
--   - Admin (email_confirm) / Google (email_verified) : déjà vérifiés à la
--     création → compte créé tout de suite (inchangé), pas de code.
--
-- MÉCANIQUE :
--   - handle_new_user DIFFÈRE la création si l'email n'est pas confirmé.
--   - À la confirmation (email_confirmed_at NULL → non NULL), on crée le
--     compte. Le mail de bienvenue suit (trigger on_client_created_welcome_email).
--   - La notif admin (sur création de client) se déclenche donc, elle aussi,
--     APRÈS vérification — automatiquement.
--
-- SÛRETÉ : idempotent (ON CONFLICT) ; best-effort sur la confirmation (ne
-- bloque jamais l'auth).
-- ============================================================

-- Helper partagé : crée client + wallet (idempotent).
CREATE OR REPLACE FUNCTION public._create_client_and_wallet(p_id UUID, p_meta JSONB, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.clients (user_id, first_name, last_name, phone, email, avatar_url)
  VALUES (
    p_id,
    COALESCE(
      NULLIF(p_meta ->> 'first_name', ''),
      NULLIF(p_meta ->> 'full_name', ''),
      NULLIF(p_meta ->> 'name', ''),
      'Utilisateur'
    ),
    COALESCE(p_meta ->> 'last_name', ''),
    p_meta ->> 'phone',
    p_email,
    COALESCE(NULLIF(p_meta ->> 'avatar_url', ''), NULLIF(p_meta ->> 'picture', ''))
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance_xaf)
  VALUES (p_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- handle_new_user : différer pour les inscriptions email NON vérifiées.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_oauth   BOOLEAN := (NEW.raw_app_meta_data ->> 'provider' = 'google');
  v_is_client  BOOLEAN := (NEW.raw_user_meta_data ->> 'is_client' = 'true');
  v_oauth_email_verified BOOLEAN := (NEW.raw_user_meta_data ->> 'email_verified' = 'true');
BEGIN
  -- OAuth Google non vérifié → rien (defense-in-depth).
  IF v_is_oauth AND NOT v_is_client AND NOT v_oauth_email_verified THEN
    RETURN NEW;
  END IF;

  -- Inscription email/mot de passe PAS encore vérifiée (code en cours) :
  -- on DIFFÈRE → le compte (et la notif admin) seront créés à la confirmation.
  IF v_is_client AND NOT v_is_oauth AND NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sinon : admin / Google / autoconfirm → compte créé immédiatement.
  IF v_is_client OR v_is_oauth THEN
    PERFORM public._create_client_and_wallet(NEW.id, NEW.raw_user_meta_data, NEW.email);
  END IF;

  RETURN NEW;
END;
$$;

-- Confirmation de l'email (NULL → non NULL) : crée le compte différé, puis
-- s'assure du mail de bienvenue. Best-effort (ne bloque jamais la vérification).
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_first TEXT;
BEGIN
  BEGIN
    -- Inscription email/mot de passe qui vient d'être vérifiée → créer le compte.
    IF (NEW.raw_user_meta_data ->> 'is_client' = 'true')
       AND (NEW.raw_app_meta_data ->> 'provider' IS DISTINCT FROM 'google') THEN
      PERFORM public._create_client_and_wallet(NEW.id, NEW.raw_user_meta_data, NEW.email);
    END IF;

    -- Filet de sécurité bienvenue (idempotent ; cas où le client préexistait).
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

NOTIFY pgrst, 'reload schema';


-- ════════ 20260601190000_delete_client_frees_email.sql ════════
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


-- ════════ 20260601200000_robust_onboarding_rpc.sql ════════
-- ============================================================
-- Onboarding ROBUSTE : corrige la « boucle d'onboarding sans fin ».
--
-- BUG : si un compte auth existe SANS fiche client (ex. client supprimé par
-- l'admin puis reconnexion Google), l'onboarding faisait un UPDATE sur une
-- fiche inexistante → 0 ligne, « profil validé » mais rien ne se passe →
-- /wallet renvoie vers /onboarding → BOUCLE infinie.
--
-- CORRECTIF : une RPC qui CRÉE la fiche si absente (depuis les métadonnées
-- auth) puis met à jour les champs métier (liste blanche). SECURITY DEFINER
-- (contourne la RLS, qui n'autorise pas l'INSERT client côté app).
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_client_onboarding(
  p_phone   TEXT,
  p_country TEXT,
  p_company TEXT DEFAULT NULL,
  p_sector  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_meta  JSONB;
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'non authentifié');
  END IF;

  -- Filet : fiche client absente (compte orphelin) → on la crée depuis l'auth.
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = v_uid) THEN
    SELECT raw_user_meta_data, email INTO v_meta, v_email
      FROM auth.users WHERE id = v_uid;
    PERFORM public._create_client_and_wallet(v_uid, COALESCE(v_meta, '{}'::jsonb), v_email);
  END IF;

  -- Champs métier (liste blanche stricte : jamais kyc_verified/status ici).
  UPDATE public.clients
     SET phone           = p_phone,
         country         = p_country,
         company_name    = NULLIF(p_company, ''),
         activity_sector = NULLIF(p_sector, '')
   WHERE user_id = v_uid;

  RETURN json_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.complete_client_onboarding IS
  'Finalise l''onboarding client : crée la fiche si absente (compte orphelin) puis met à jour phone/country/company/sector. Corrige la boucle d''onboarding.';

REVOKE ALL ON FUNCTION public.complete_client_onboarding(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_client_onboarding(TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- BONZINI — DÉPLOIEMENT GLOBAL + ACTIVATION DE TOUS LES EMAILS
-- Coller dans Supabase → SQL Editor → Run. 100% idempotent (sûr à relancer).
-- → applique TOUTES les migrations + ACTIVE tous les emails construits.
-- ============================================================================

-- ═══════════════ [1/15] 20260531110000_oauth_handle_new_user.sql ═══════════════
-- ============================================================
-- Chantier A — Lot A2
-- Étendre handle_new_user() pour le social login Google (OAuth)
--
-- CONTEXTE (audit Phase 1) : le trigger ne crée clients+wallets que si
-- raw_user_meta_data->>'is_client' = 'true'. Un utilisateur créé via
-- signInWithOAuth(Google) ne porte PAS cette métadonnée → ni client ni
-- wallet n'étaient créés. On ajoute donc une branche OAuth.
--
-- SÉCURITÉ :
--   - L'OAuth est réservé à l'app CLIENT (Phase 0). Les admins sont créés
--     par RPC avec provider='email' et sans is_client → ils ne matchent pas.
--   - Donc provider='google' ⇒ c'est un client. Aucun risque d'escalade
--     (un user OAuth n'obtient jamais de ligne user_roles).
--   - email_verified=false (cas D) : on REFUSE de créer clients+wallets côté
--     serveur (defense-in-depth, en plus du blocage dans le callback). Ainsi,
--     même si un attaquant ignore la redirection client, aucune coquille de
--     compte n'est matérialisée pour un email Google non vérifié.
--
-- IDEMPOTENCE : ON CONFLICT (user_id) DO NOTHING sur clients ET wallets
-- (la version précédente ne l'avait que sur wallets).
--
-- GOOGLE NE FOURNIT PAS prénom/nom séparés via Supabase (full_name / name
-- uniquement) → on remplit first_name avec full_name ; l'onboarding laisse
-- l'utilisateur corriger prénom/nom + saisir phone/country (bloquants).
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_oauth   BOOLEAN := (NEW.raw_app_meta_data ->> 'provider' = 'google');
  v_is_client  BOOLEAN := (NEW.raw_user_meta_data ->> 'is_client' = 'true');
  -- Pour un signup OAuth Google, n'accepter que les emails vérifiés
  -- (defense-in-depth, miroir du cas D du callback). GoTrue place le claim
  -- dans raw_user_meta_data.email_verified.
  v_oauth_email_verified BOOLEAN := (NEW.raw_user_meta_data ->> 'email_verified' = 'true');
BEGIN
  -- Bloc OAuth : on exige un email vérifié.
  IF v_is_oauth AND NOT v_is_client AND NOT v_oauth_email_verified THEN
    RETURN NEW;  -- email Google non vérifié → aucune création (cas D, côté serveur)
  END IF;

  IF v_is_client OR v_is_oauth THEN

    -- clients : source de vérité côté métier
    INSERT INTO public.clients (user_id, first_name, last_name, phone, email, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
        'Utilisateur'
      ),
      COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
      NEW.raw_user_meta_data ->> 'phone',            -- NULL en OAuth → complété à l'onboarding
      NEW.email,
      COALESCE(
        NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
      )
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- wallet à 0
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user IS
  'Crée clients+wallets pour un nouveau client (signup email OU OAuth Google). Idempotent. Les admins (provider=email, sans is_client) sont ignorés.';

NOTIFY pgrst, 'reload schema';


-- ═══════════════ [2/15] 20260531121000_email_outbox_schema.sql ═══════════════
-- ============================================================
-- Chantier B — Lot B1
-- Schéma d'infrastructure email : outbox transactionnel + suppressions
-- + table de mapping (notification.type → template).
--
-- ARCHITECTURE (design Phase 3) : transactional outbox. Les RPC métier
-- insèrent une ligne email_outbox DANS LA MÊME TRANSACTION que la notif
-- in-app (via trigger — lot B2). Un drainer (Edge Function + pg_cron,
-- lot B4) enverra ensuite via Resend en asynchrone. Garantie : Resend
-- down ≠ transaction métier échouée.
--
-- SÉCURITÉ : tables internes. RLS activé, AUCUNE policy client (lecture
-- admin seule pour observabilité). Écritures via trigger SECURITY DEFINER
-- (B2) + service role (drainer B4) qui contournent la RLS.
-- ============================================================

-- ------------------------------------------------------------
-- 1. email_outbox — file d'attente + journal d'envoi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         TEXT NOT NULL,                       -- ex. 'payment_completed'
  entity_id          UUID,                                -- payment_id / deposit_id si applicable
  recipient_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email    TEXT,                                -- résolu à l'enqueue ; NULL/.local => skipped
  template           TEXT NOT NULL,
  payload            JSONB NOT NULL DEFAULT '{}',         -- données dynamiques pour le template
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','sent','failed','skipped')),
  attempts           INT NOT NULL DEFAULT 0,
  max_attempts       INT NOT NULL DEFAULT 5,
  next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error         TEXT,
  resend_message_id  TEXT,
  delivery_status    TEXT,                                -- MAJ par webhook : delivered/bounced/complained
  idempotency_key    TEXT NOT NULL UNIQUE,                -- ex. 'notif:<notification_id>'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at            TIMESTAMPTZ
);

-- Index pour la requête du drainer (pending/failed prêts à partir)
CREATE INDEX IF NOT EXISTS idx_email_outbox_ready
  ON public.email_outbox (status, next_attempt_at)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient
  ON public.email_outbox (recipient_user_id);

COMMENT ON TABLE public.email_outbox IS
  'File d''attente + journal des emails transactionnels (pattern outbox). Drainée en asynchrone par une Edge Function/pg_cron.';

-- ------------------------------------------------------------
-- 2. email_suppressions — adresses à ne plus jamais contacter
--    (alimentée par les webhooks Resend bounced/complained — lot B5)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  email       TEXT PRIMARY KEY,
  reason      TEXT NOT NULL,                              -- 'bounced' | 'complained' | 'manual'
  source      TEXT,                                       -- event Resend d'origine
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_suppressions IS
  'Liste de suppression : emails ayant bouncé ou s''étant plaints. Le drainer ne renvoie jamais à ces adresses.';

-- ------------------------------------------------------------
-- 3. email_template_map — quels types de notification déclenchent
--    quel template, et si l'envoi est activé.
--
-- ⚠️ DÉMARRAGE : enabled = FALSE pour TOUT. Le trigger d'enqueue (B2)
-- est donc inerte (aucune ligne mise en file) tant que :
--   (a) le drainer + pg_cron (B4) ne sont pas déployés, ET
--   (b) la config Resend/DNS (B0) n'est pas faite.
-- → Évite tout backlog d'emails périmés envoyés d'un coup à l'activation.
-- On bascule enabled=TRUE (set v1) lors de l'étape d'activation B4.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_template_map (
  notification_type  TEXT PRIMARY KEY,
  template           TEXT NOT NULL,
  enabled            BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_template_map IS
  'Mapping notification.type -> template email + drapeau d''activation. Tout démarre désactivé (activation à l''étape B4).';

-- Seed du set v1 (tous désactivés au départ)
INSERT INTO public.email_template_map (notification_type, template, enabled) VALUES
  ('deposit_validated',  'deposit_validated',  false),
  ('deposit_rejected',   'deposit_rejected',   false),
  ('payment_created',    'payment_created',    false),
  ('payment_completed',  'payment_completed',  false),
  ('payment_rejected',   'payment_rejected',   false),
  -- différés (couture posée, hors set v1)
  ('payment_processing', 'payment_processing', false),
  ('deposit_correction_requested', 'deposit_correction_requested', false)
ON CONFLICT (notification_type) DO NOTHING;

-- ------------------------------------------------------------
-- 4. RLS — tables internes : lecture admin seule, aucune écriture directe
-- ------------------------------------------------------------
ALTER TABLE public.email_outbox        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_map  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read email_outbox" ON public.email_outbox;
CREATE POLICY "Admins read email_outbox"
  ON public.email_outbox FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read email_suppressions" ON public.email_suppressions;
CREATE POLICY "Admins read email_suppressions"
  ON public.email_suppressions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read email_template_map" ON public.email_template_map;
CREATE POLICY "Admins read email_template_map"
  ON public.email_template_map FOR SELECT
  USING (public.is_admin(auth.uid()));
-- Pas de policy INSERT/UPDATE/DELETE : réservé aux fonctions SECURITY DEFINER
-- (trigger B2) et au service role (drainer B4), qui contournent la RLS.

NOTIFY pgrst, 'reload schema';


-- ═══════════════ [3/15] 20260531131000_email_enqueue_trigger.sql ═══════════════
-- ============================================================
-- Chantier B — Lot B2
-- Enqueue des emails via trigger AFTER INSERT ON notifications.
--
-- POURQUOI CE DESIGN (décision Phase 4 §2) : chaque événement email
-- (dépôt validé, paiement créé/complété/rejeté…) fait DÉJÀ un
-- INSERT INTO notifications dans les RPC métier SECURITY DEFINER, avec
-- une garde de statut (early-return) garantissant 1 notif par événement
-- terminal. On se branche dessus plutôt que d'éditer ~6 RPC critiques
-- → zéro régression sur la logique financière + idempotence native
-- (1 notification = 1 ligne outbox via idempotency_key = 'notif:'||id).
--
-- ⚠️ GARANTIE CRITIQUE : un échec d'enqueue NE DOIT JAMAIS faire échouer
-- la transaction métier (paiement/dépôt). Le corps est donc enveloppé
-- dans un bloc EXCEPTION WHEN OTHERS qui avale toute erreur (best-effort).
-- L'email est secondaire ; la transaction métier est sacrée.
--
-- ⚠️ INERTE AU DÉPART : email_template_map.enabled = FALSE partout (B1)
-- → la fonction ne met rien en file tant qu'on n'a pas activé le set v1
-- à l'étape B4. La création du trigger ici est donc sans effet de bord
-- immédiat sur les flux existants.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enqueue_email_from_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template TEXT;
  v_enabled  BOOLEAN;
  v_email    TEXT;
  v_status   TEXT;
  v_entity   UUID;
BEGIN
  -- Best-effort : toute erreur est avalée pour ne jamais rollback la
  -- transaction métier parente.
  BEGIN
    -- 1. Le type est-il mappé ET activé ?
    SELECT template, enabled
      INTO v_template, v_enabled
      FROM public.email_template_map
     WHERE notification_type = NEW.type;

    IF v_template IS NULL OR v_enabled IS NOT TRUE THEN
      RETURN NEW;  -- type non mappé ou désactivé → on ne fait rien
    END IF;

    -- 2. Résoudre l'email destinataire (identité de A = auth.users.email)
    SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;

    -- 3. Les comptes téléphone-seul (@bonzini-client.local) ne sont pas
    --    joignables par email → status='skipped' (trace, mais pas d'envoi).
    IF v_email IS NULL
       OR v_email = ''
       OR lower(v_email) LIKE '%@bonzini-client.local' THEN
      v_status := 'skipped';
    ELSE
      v_status := 'pending';
    END IF;

    -- 4. entity_id : deposit_id OU payment_id selon l'événement
    v_entity := COALESCE(
      NULLIF(NEW.metadata ->> 'deposit_id', ''),
      NULLIF(NEW.metadata ->> 'payment_id', '')
    )::uuid;

    -- 5. Enqueue (idempotent : 1 notification = 1 ligne max)
    INSERT INTO public.email_outbox (
      event_type, entity_id, recipient_user_id, recipient_email,
      template, payload, status, idempotency_key
    ) VALUES (
      NEW.type,
      v_entity,
      NEW.user_id,
      v_email,
      v_template,
      jsonb_build_object(
        'notification_id', NEW.id,
        'title',           NEW.title,     -- déjà localisé FR par la RPC (fallback robuste)
        'message',         NEW.message,
        'metadata',        COALESCE(NEW.metadata, '{}'::jsonb)
      ),
      v_status,
      'notif:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    -- Ne jamais bloquer la transaction métier : on journalise et on continue.
    RAISE WARNING 'enqueue_email_from_notification: échec pour notification % (type=%): %',
      NEW.id, NEW.type, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_email_from_notification IS
  'Trigger AFTER INSERT ON notifications : met un email en file (email_outbox) si le type est mappé et activé. Best-effort (n''abort jamais la transaction métier). Inerte tant que email_template_map.enabled=false.';

DROP TRIGGER IF EXISTS on_notification_enqueue_email ON public.notifications;
CREATE TRIGGER on_notification_enqueue_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_email_from_notification();

NOTIFY pgrst, 'reload schema';


-- ═══════════════ [4/15] 20260531141000_email_outbox_rpcs.sql ═══════════════
-- ============================================================
-- Chantier B — Lot B4 (partie DB)
-- RPC de prise de lot concurrente pour le drainer d'emails.
--
-- Le drainer (Edge Function send-email, déclenché par pg_cron) appelle
-- claim_email_batch() pour récupérer un lot d'emails prêts à partir, en
-- évitant qu'un run cron concurrent traite deux fois la même ligne.
--
-- PATTERN DE BAIL (lease) : on pose next_attempt_at dans le futur (+2 min)
-- au moment de la prise. Ainsi :
--   - un cron concurrent ne re-sélectionne pas la ligne (next_attempt_at > now),
--   - si le drainer crash en plein vol, la ligne redevient éligible après
--     l'expiration du bail (auto-réparation, pas de ligne bloquée).
-- Le marquage final (sent/failed) se fait ensuite par le drainer via le
-- service role (qui contourne la RLS) — pas besoin de RPC dédiée.
--
-- FOR UPDATE SKIP LOCKED : verrou non bloquant, cœur de la concurrence sûre.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_email_batch(p_limit INT DEFAULT 20)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ready AS (
    SELECT o.id
      FROM public.email_outbox o
     WHERE o.status IN ('pending', 'failed')
       AND o.attempts < o.max_attempts
       AND o.next_attempt_at <= now()
     ORDER BY o.created_at
     LIMIT GREATEST(p_limit, 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_outbox o
     SET next_attempt_at = now() + interval '2 minutes'   -- bail
    FROM ready
   WHERE o.id = ready.id
  RETURNING o.*;
END;
$$;

COMMENT ON FUNCTION public.claim_email_batch IS
  'Réserve un lot d''emails prêts (FOR UPDATE SKIP LOCKED + bail de 2 min). Appelé par le drainer send-email. Le marquage final est fait par le service role.';

-- Réservé au service role (le drainer). Jamais exposé aux clients/admins.
REVOKE ALL ON FUNCTION public.claim_email_batch(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_email_batch(INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_batch(INT) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ═══════════════ [5/15] 20260531150000_welcome_email_rpc.sql ═══════════════
-- ============================================================
-- Chantier B — email de Bienvenue (#3, hors trigger notifications)
--
-- La Bienvenue ne correspond à aucune notification métier : on l'enfile
-- explicitement à la fin de l'onboarding, via une RPC SECURITY DEFINER
-- (l'outbox est en RLS interne, pas d'écriture client directe).
--
-- Idempotence : idempotency_key = 'welcome:<user_id>' UNIQUE → un seul
-- email de bienvenue par utilisateur, même si l'onboarding est rejoué.
-- Respecte la même règle d'activation que le trigger : on n'enfile que si
-- le template 'welcome' est activé dans email_template_map (sinon no-op),
-- pour garder le système globalement inerte jusqu'à l'étape d'activation B4.
-- ============================================================

-- Le set v1 inclut 'welcome' (désactivé au départ comme les autres).
INSERT INTO public.email_template_map (notification_type, template, enabled)
VALUES ('welcome', 'welcome', false)
ON CONFLICT (notification_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enqueue_welcome_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT;
  v_first   TEXT;
  v_enabled BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;  -- non authentifié : no-op silencieux
  END IF;

  -- Respecter le drapeau d'activation global.
  SELECT enabled INTO v_enabled
    FROM public.email_template_map WHERE notification_type = 'welcome';
  IF v_enabled IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT u.email, c.first_name
    INTO v_email, v_first
    FROM auth.users u
    LEFT JOIN public.clients c ON c.user_id = u.id
   WHERE u.id = v_uid;

  -- Pas d'email réel (téléphone-seul) → skipped, pas d'envoi.
  IF v_email IS NULL OR v_email = '' OR lower(v_email) LIKE '%@bonzini-client.local' THEN
    INSERT INTO public.email_outbox (
      event_type, recipient_user_id, recipient_email, template, payload,
      status, idempotency_key
    ) VALUES (
      'welcome', v_uid, v_email, 'welcome',
      jsonb_build_object('first_name', COALESCE(v_first, 'Utilisateur')),
      'skipped', 'welcome:' || v_uid::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    RETURN;
  END IF;

  INSERT INTO public.email_outbox (
    event_type, recipient_user_id, recipient_email, template, payload,
    status, idempotency_key
  ) VALUES (
    'welcome', v_uid, v_email, 'welcome',
    jsonb_build_object('first_name', COALESCE(v_first, 'Utilisateur')),
    'pending', 'welcome:' || v_uid::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.enqueue_welcome_email IS
  'Enfile l''email de bienvenue pour l''utilisateur courant (idempotent par user_id). Appelée en fin d''onboarding. No-op si le template welcome est désactivé.';

REVOKE ALL ON FUNCTION public.enqueue_welcome_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_welcome_email() TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ═══════════════ [6/15] 20260531160000_security_clients_update_guard.sql ═══════════════
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


-- ═══════════════ [7/15] 20260531170000_email_drainer_cron.sql ═══════════════
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


-- ═══════════════ [8/15] 20260601121000_email_support_message_trigger.sql ═══════════════
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


-- ═══════════════ [9/15] 20260601141000_email_soft_transactional.sql ═══════════════
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


-- ═══════════════ [10/15] 20260601160000_email_reminders_cron.sql ═══════════════
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


-- ═══════════════ [11/15] 20260601170000_welcome_email_on_client_create.sql ═══════════════
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


-- ═══════════════ [12/15] 20260601180000_defer_client_until_verified.sql ═══════════════
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


-- ═══════════════ [13/15] 20260601190000_delete_client_frees_email.sql ═══════════════
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


-- ═══════════════ [14/15] 20260601200000_robust_onboarding_rpc.sql ═══════════════
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


-- ═══════════════ [15/15] 20260601210000_admin_self_profile.sql ═══════════════
-- ============================================================
-- Profil admin éditable par soi-même : nom, prénom, photo de profil.
--
-- - Ajoute user_roles.avatar_url.
-- - RPC update_my_admin_profile : l'admin met à jour SA propre fiche
--   (nom/prénom/photo). SECURITY DEFINER + garde is_admin.
-- - Bucket Storage 'avatars' (public en lecture) : chaque admin écrit dans
--   son propre dossier (name commençant par son user_id).
-- ============================================================

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE FUNCTION public.update_my_admin_profile(
  p_first_name TEXT,
  p_last_name  TEXT,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  UPDATE public.user_roles
     SET first_name = NULLIF(TRIM(p_first_name), ''),
         last_name  = NULLIF(TRIM(p_last_name), ''),
         avatar_url = COALESCE(NULLIF(p_avatar_url, ''), avatar_url)  -- garde l'ancienne si vide
   WHERE user_id = v_uid;

  RETURN json_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.update_my_admin_profile IS
  'Permet à un admin de mettre à jour SA propre fiche (nom, prénom, photo).';

REVOKE ALL ON FUNCTION public.update_my_admin_profile(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_admin_profile(TEXT, TEXT, TEXT) TO authenticated;

-- ── Bucket avatars (public) ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique des avatars.
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Écriture réservée au propriétaire (dossier = son user_id).
DROP POLICY IF EXISTS "Avatars owner insert" ON storage.objects;
CREATE POLICY "Avatars owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars owner update" ON storage.objects;
CREATE POLICY "Avatars owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';


-- ═══════════════ [16] ACTIVATION : on allume TOUS les emails ═══════════════
-- Plus rien de dormant : bienvenue, dépôts, paiements, support, relances, sécurité.
UPDATE public.email_template_map SET enabled = true
WHERE notification_type IN (
  'welcome',
  'deposit_validated','deposit_rejected','deposit_created',
  'payment_created','payment_processing','payment_completed','payment_rejected',
  'password_changed',
  'support_message',
  'deposit_reminder','onboarding_reminder'
);

-- Contrôle : voir l'état de chaque type d'email après activation.
SELECT notification_type, enabled FROM public.email_template_map ORDER BY notification_type;

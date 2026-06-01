-- ============================================================
-- BONZINI — DÉPLOIEMENT PARTIE 1/2 : CŒUR (social login + emails)
-- À coller dans Supabase → SQL Editor → Run.
--
-- 6 migrations. Aucune dépendance à pg_cron/Vault → 100% sûr à
-- exécuter MAINTENANT. Le système email reste DORMANT (enabled=false).
-- Idempotent (CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ════════ 20260531110000_oauth_handle_new_user.sql ════════
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


-- ════════ 20260531120000_email_outbox_schema.sql ════════
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

CREATE POLICY "Admins read email_outbox"
  ON public.email_outbox FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins read email_suppressions"
  ON public.email_suppressions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins read email_template_map"
  ON public.email_template_map FOR SELECT
  USING (public.is_admin(auth.uid()));
-- Pas de policy INSERT/UPDATE/DELETE : réservé aux fonctions SECURITY DEFINER
-- (trigger B2) et au service role (drainer B4), qui contournent la RLS.

NOTIFY pgrst, 'reload schema';


-- ════════ 20260531130000_email_enqueue_trigger.sql ════════
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


-- ════════ 20260531140000_email_outbox_rpcs.sql ════════
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


-- ════════ 20260531150000_welcome_email_rpc.sql ════════
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


-- ════════ 20260531160000_security_clients_update_guard.sql ════════
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


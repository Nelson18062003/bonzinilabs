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

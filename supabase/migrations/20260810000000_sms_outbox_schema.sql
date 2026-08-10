-- ============================================================
-- SMS — Lot 1 : schéma d'infrastructure (outbox, suppressions,
-- mapping de gabarits, routage expéditeur, identité téléphonique).
--
-- ARCHITECTURE : strictement calquée sur l'infrastructure email déjà en
-- production (email_outbox / email_suppressions / email_template_map).
-- Les événements métier écrivent DÉJÀ une ligne `notifications` dans la
-- transaction ; le SMS est un second drain sur cette même source de vérité,
-- pas un système parallèle. Aucune RPC financière n'est modifiée.
--
-- ⚠️ INERTE AU DÉPART : sms_template_map.enabled = FALSE partout. Le
-- trigger d'enfilement (lot 2) ne met donc rien en file tant qu'on n'a pas
-- activé un gabarit à la main. Sûr à migrer avant même que le compte
-- Telnyx ne soit configuré.
--
-- SÉCURITÉ : tables internes. RLS activée, lecture admin seule, aucune
-- écriture directe — tout passe par des fonctions SECURITY DEFINER (lot 2)
-- ou le service role (drainer, lot 3).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Identité téléphonique sur clients
--
-- `phone` reste la colonne de saisie (texte libre, historique). On ajoute
-- une colonne canonique E.164 qui, elle, est contrainte : Telnyx n'accepte
-- rien d'autre. La contrainte est posée en NOT VALID puis validée, pour ne
-- pas faire échouer la migration sur des lignes historiques douteuses —
-- celles-ci seront reprises par le rapport de backfill.
-- ------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_e164          TEXT,
  ADD COLUMN IF NOT EXISTS phone_country       TEXT,        -- ISO 3166-1 alpha-2
  ADD COLUMN IF NOT EXISTS phone_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferred_locale    TEXT,
  ADD COLUMN IF NOT EXISTS sms_marketing_opt_in BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_preferred_locale_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_preferred_locale_check
      CHECK (preferred_locale IS NULL OR preferred_locale IN ('fr', 'en'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.clients.preferred_locale IS
  'Langue choisie par le client pour ses SMS. NULL ⇒ déduite du pays du numéro (francophone → fr, sinon en).';

COMMENT ON COLUMN public.clients.phone_e164 IS
  'Numéro canonique E.164 (+237677889900). Seule forme acceptée par Telnyx. Alimentée par le front (libphonenumber) et le backfill ; NULL = non joignable par SMS.';
COMMENT ON COLUMN public.clients.phone_country IS
  'Pays ISO 3166-1 alpha-2 déduit du numéro. Sert au routage de l''expéditeur (alphanumérique vs numéro long).';
COMMENT ON COLUMN public.clients.phone_verified_at IS
  'Horodatage de la vérification par code SMS. NULL = numéro non vérifié.';
COMMENT ON COLUMN public.clients.sms_marketing_opt_in IS
  'Consentement EXPLICITE aux SMS marketing (taux du jour). Séparé du transactionnel : couper la pub ne doit jamais couper « votre paiement a échoué ».';

-- Forme E.164 stricte. Deux niveaux de contrôle : la forme ici, la validité
-- réelle du plan de numérotation côté applicatif (libphonenumber).
-- La colonne vient d'être créée et vaut NULL partout : la contrainte se
-- valide instantanément, inutile de passer par NOT VALID.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_phone_e164_format'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_phone_e164_format
      CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_clients_phone_e164
  ON public.clients (phone_e164)
  WHERE phone_e164 IS NOT NULL;

-- ------------------------------------------------------------
-- 2. sms_sender_routes — quel expéditeur pour quel pays
--
-- POURQUOI CETTE TABLE : l'expéditeur n'est PAS une constante globale.
--   · Afrique / Europe / une partie de l'Asie : « Bonzini » fonctionne,
--     mais la plupart des opérateurs exigent un enregistrement préalable.
--     Sur MTN Cameroun, un ID non enregistré est réécrit ou non délivré.
--   · Chine, Afrique du Sud, Brésil, Mexique, Argentine : l'ID
--     alphanumérique est SYSTÉMATIQUEMENT réécrit par l'opérateur.
--   · États-Unis, Canada : les opérateurs l'interdisent purement et
--     simplement — il faut un vrai numéro.
--
-- ⚠️ GARDE-FOU : `registered = false` ⇒ on retombe sur le numéro long,
-- même si sender_type vaut 'alphanumeric'. Tant que l'enregistrement chez
-- Telnyx n'est pas revenu, les messages partent donc du numéro acheté et
-- arrivent — plutôt que d'être silencieusement jetés par l'opérateur.
-- Passer `registered = true` est un acte manuel, pays par pays, APRÈS
-- confirmation de Telnyx.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_sender_routes (
  country_iso  TEXT PRIMARY KEY,                    -- ISO alpha-2, ou '*' = défaut
  sender_type  TEXT NOT NULL DEFAULT 'long_code'
               CHECK (sender_type IN ('alphanumeric', 'long_code')),
  sender_id    TEXT,                                -- ex. 'Bonzini' ; NULL ⇒ numéro Telnyx par défaut
  registered   BOOLEAN NOT NULL DEFAULT false,      -- enregistrement opérateur confirmé ?
  note         TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_sender_routes IS
  'Expéditeur SMS par pays de destination. registered=false ⇒ repli sur le numéro long (sécurité : un ID alphanumérique non enregistré est réécrit ou jeté par l''opérateur).';

-- Repli global : un vrai numéro délivre partout. C'est le défaut sûr.
INSERT INTO public.sms_sender_routes (country_iso, sender_type, sender_id, registered, note) VALUES
  ('*',  'long_code',    NULL,      false, 'Repli par défaut : numéro Telnyx. Toujours délivré.')
ON CONFLICT (country_iso) DO NOTHING;

-- Pays où « Bonzini » est possible une fois l'enregistrement obtenu.
-- registered=false partout au départ : à basculer pays par pays.
INSERT INTO public.sms_sender_routes (country_iso, sender_type, sender_id, registered, note) VALUES
  -- CEMAC / Afrique centrale
  ('CM', 'alphanumeric', 'Bonzini', false, 'MTN (62401) EXIGE l''enregistrement, sinon réécrit ou non délivré.'),
  ('GA', 'alphanumeric', 'Bonzini', false, NULL),
  ('TD', 'alphanumeric', 'Bonzini', false, NULL),
  ('CF', 'alphanumeric', 'Bonzini', false, NULL),
  ('CG', 'alphanumeric', 'Bonzini', false, NULL),
  ('GQ', 'alphanumeric', 'Bonzini', false, NULL),
  ('CD', 'alphanumeric', 'Bonzini', false, NULL),
  -- Afrique de l'Ouest
  ('CI', 'alphanumeric', 'Bonzini', false, NULL),
  ('SN', 'alphanumeric', 'Bonzini', false, NULL),
  ('ML', 'alphanumeric', 'Bonzini', false, NULL),
  ('BF', 'alphanumeric', 'Bonzini', false, NULL),
  ('NE', 'alphanumeric', 'Bonzini', false, NULL),
  ('TG', 'alphanumeric', 'Bonzini', false, NULL),
  ('BJ', 'alphanumeric', 'Bonzini', false, NULL),
  ('GN', 'alphanumeric', 'Bonzini', false, NULL),
  ('NG', 'alphanumeric', 'Bonzini', false, NULL),
  ('GH', 'alphanumeric', 'Bonzini', false, NULL),
  -- Afrique de l'Est
  ('KE', 'alphanumeric', 'Bonzini', false, NULL),
  ('TZ', 'alphanumeric', 'Bonzini', false, NULL),
  ('UG', 'alphanumeric', 'Bonzini', false, NULL),
  ('RW', 'alphanumeric', 'Bonzini', false, NULL),
  ('BI', 'alphanumeric', 'Bonzini', false, NULL),
  ('AO', 'alphanumeric', 'Bonzini', false, NULL),
  ('ET', 'alphanumeric', 'Bonzini', false, NULL),
  -- Afrique du Nord
  ('MA', 'alphanumeric', 'Bonzini', false, NULL),
  ('TN', 'alphanumeric', 'Bonzini', false, NULL),
  ('DZ', 'alphanumeric', 'Bonzini', false, NULL),
  -- Europe
  ('FR', 'alphanumeric', 'Bonzini', false, 'Enregistrement OACP obligatoire.'),
  ('BE', 'alphanumeric', 'Bonzini', false, NULL),
  ('CH', 'alphanumeric', 'Bonzini', false, NULL),
  ('DE', 'alphanumeric', 'Bonzini', false, NULL),
  ('GB', 'alphanumeric', 'Bonzini', false, NULL),
  ('IT', 'alphanumeric', 'Bonzini', false, NULL),
  ('ES', 'alphanumeric', 'Bonzini', false, NULL),
  ('PT', 'alphanumeric', 'Bonzini', false, NULL),
  ('PL', 'alphanumeric', 'Bonzini', false, NULL),
  ('RO', 'alphanumeric', 'Bonzini', false, NULL),
  ('LU', 'alphanumeric', 'Bonzini', false, NULL),
  -- Réécriture systématique par l'opérateur : inutile d'essayer.
  ('CN', 'long_code', NULL, false, 'Chine : ID alphanumérique NON supporté, réécrit en code aléatoire.'),
  ('ZA', 'long_code', NULL, false, 'Afrique du Sud : ID alphanumérique réécrit.'),
  ('BR', 'long_code', NULL, false, 'Brésil : ID alphanumérique réécrit.'),
  ('MX', 'long_code', NULL, false, 'Mexique : ID alphanumérique réécrit.'),
  ('AR', 'long_code', NULL, false, 'Argentine : ID alphanumérique réécrit.'),
  -- Interdiction pure et simple.
  ('US', 'long_code', NULL, false, 'États-Unis : ID alphanumérique interdit par les opérateurs (10DLC requis).'),
  ('CA', 'long_code', NULL, false, 'Canada : ID alphanumérique interdit par les opérateurs.'),
  -- Régime lourd : enregistrement DLT de l'entité, de l'en-tête ET de chaque
  -- gabarit. Hors périmètre tant qu'il n'y a pas de clients en Inde.
  ('IN', 'long_code', NULL, false, 'Inde : DLT (entité + en-tête + chaque gabarit) requis. Hors périmètre.')
ON CONFLICT (country_iso) DO NOTHING;

-- ------------------------------------------------------------
-- 3. sms_template_map — quel type de notification → quel gabarit
--
-- Interrupteur principal ET cadran de déploiement : on active un gabarit
-- à la fois, et le retour arrière est un simple UPDATE.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_template_map (
  notification_type  TEXT PRIMARY KEY,
  template           TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'transactional'
                     CHECK (category IN ('transactional', 'security', 'marketing')),
  enabled            BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_template_map IS
  'Mapping notification.type -> gabarit SMS + catégorie + drapeau d''activation. Tout démarre désactivé : le déploiement se fait un gabarit à la fois.';
COMMENT ON COLUMN public.sms_template_map.category IS
  'transactional/security : envoyés d''office (alertes d''argent et de sécurité). marketing : exige clients.sms_marketing_opt_in = true.';

INSERT INTO public.sms_template_map (notification_type, template, category, enabled) VALUES
  -- Palier 1 — mouvements d'argent (ces types écrivent DÉJÀ dans notifications)
  ('deposit_created',              'deposit_created',              'transactional', false),
  ('deposit_validated',            'deposit_validated',            'transactional', false),
  ('deposit_rejected',             'deposit_rejected',             'transactional', false),
  ('deposit_correction_needed',    'deposit_correction_needed',    'transactional', false),
  ('deposit_correction_requested', 'deposit_correction_needed',    'transactional', false),
  ('payment_created',              'payment_created',              'transactional', false),
  ('payment_processing',           'payment_processing',           'transactional', false),
  ('payment_completed',            'payment_completed',            'transactional', false),
  ('payment_rejected',             'payment_rejected',             'transactional', false),
  -- Palier 2 — sécurité
  ('phone_verification',           'phone_verification',           'security',      false),
  ('password_changed',             'password_changed',             'security',      false),
  ('new_device_login',             'new_device_login',             'security',      false),
  ('kyc_required',                 'kyc_required',                 'security',      false),
  ('kyc_approved',                 'kyc_approved',                 'transactional', false),
  -- Palier 3 — relance et engagement
  ('deposit_awaiting_proof',       'deposit_awaiting_proof',       'transactional', false),
  ('payment_awaiting_beneficiary', 'payment_awaiting_beneficiary', 'transactional', false),
  ('cash_payment_ready',           'cash_payment_ready',           'transactional', false),
  ('daily_rate_alert',             'daily_rate_alert',             'marketing',     false)
ON CONFLICT (notification_type) DO NOTHING;

-- ------------------------------------------------------------
-- 4. sms_suppressions — numéros à ne plus jamais contacter
--
-- Alimentée par le webhook Telnyx entrant (STOP / ARRET) et par les échecs
-- de délivrance définitifs. Le blocage est GLOBAL et par numéro : un STOP
-- coupe tout, y compris le transactionnel — c'est une obligation opérateur,
-- pas une préférence produit.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_suppressions (
  phone_e164  TEXT PRIMARY KEY,
  reason      TEXT NOT NULL CHECK (reason IN ('stop', 'invalid', 'undeliverable', 'manual')),
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sms_suppressions IS
  'Liste de suppression SMS. Un STOP entrant bloque le numéro pour TOUT envoi, transactionnel compris (obligation opérateur). Le drainer vérifie cette table AVANT chaque envoi.';

-- ------------------------------------------------------------
-- 5. sms_outbox — file d'attente + journal d'envoi
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_outbox (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         TEXT NOT NULL,
  entity_id          UUID,
  recipient_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_phone    TEXT,                              -- E.164 résolu à l'enfilement
  recipient_country  TEXT,                              -- ISO alpha-2, pour le routage expéditeur
  locale             TEXT NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'en')),
  template           TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'transactional'
                     CHECK (category IN ('transactional', 'security', 'marketing')),
  payload            JSONB NOT NULL DEFAULT '{}',
  -- 'sms' aujourd'hui. La colonne existe pour que RCS (logo, couleurs,
  -- pastille vérifiée) puisse se greffer sur la même file sans migration
  -- lourde le jour où la couverture opérateur le permettra.
  channel            TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'rcs')),
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts           INT NOT NULL DEFAULT 0,
  max_attempts       INT NOT NULL DEFAULT 5,
  next_attempt_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error         TEXT,
  sender_used        TEXT,                              -- ce qui a réellement été présenté à Telnyx
  telnyx_message_id  TEXT,
  delivery_status    TEXT,                              -- MAJ par webhook : delivered / delivery_failed
  segments           INT,                               -- segments facturés (contrôle de coût)
  idempotency_key    TEXT NOT NULL UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sms_outbox_ready
  ON public.sms_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_sms_outbox_recipient
  ON public.sms_outbox (recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_sms_outbox_telnyx_id
  ON public.sms_outbox (telnyx_message_id)
  WHERE telnyx_message_id IS NOT NULL;

COMMENT ON TABLE public.sms_outbox IS
  'File d''attente + journal des SMS transactionnels (pattern outbox, jumeau de email_outbox). Drainée en asynchrone par l''Edge Function send-sms.';
COMMENT ON COLUMN public.sms_outbox.segments IS
  'Nombre de segments facturés. Doit valoir 1 : au-delà, un gabarit a basculé en UCS-2 (accent hors GSM-7) et le coût a doublé.';

-- ------------------------------------------------------------
-- 6. RLS — tables internes, lecture admin seule
-- ------------------------------------------------------------
ALTER TABLE public.sms_outbox        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_suppressions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_template_map  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_sender_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read sms_outbox" ON public.sms_outbox;
CREATE POLICY "Admins read sms_outbox"
  ON public.sms_outbox FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read sms_suppressions" ON public.sms_suppressions;
CREATE POLICY "Admins read sms_suppressions"
  ON public.sms_suppressions FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read sms_template_map" ON public.sms_template_map;
CREATE POLICY "Admins read sms_template_map"
  ON public.sms_template_map FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read sms_sender_routes" ON public.sms_sender_routes;
CREATE POLICY "Admins read sms_sender_routes"
  ON public.sms_sender_routes FOR SELECT
  USING (public.is_admin(auth.uid()));
-- Aucune policy INSERT/UPDATE/DELETE : réservé aux fonctions SECURITY DEFINER
-- et au service role (drainer, webhook), qui contournent la RLS.

NOTIFY pgrst, 'reload schema';

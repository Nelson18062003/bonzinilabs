-- ============================================================
-- BONZINI — SMS : TOUTES les migrations réunies en un seul fichier.
--
-- À COLLER DANS L'ÉDITEUR SQL DE SUPABASE, EN UNE FOIS.
-- Équivalent exact de `npx supabase db push` pour l'ensemble du chantier SMS.
--
-- SANS DANGER, MÊME SI VOUS AVEZ DÉJÀ APPLIQUÉ UNE PARTIE :
-- tout est idempotent (CREATE ... IF NOT EXISTS, CREATE OR REPLACE,
-- ON CONFLICT DO NOTHING, DROP TRIGGER IF EXISTS, ADD COLUMN IF NOT EXISTS).
-- Le rejouer en entier ne casse rien et ne crée pas de doublon.
--
-- SANS EFFET DE BORD : tous les gabarits arrivent avec enabled = false.
-- Aucun SMS ne peut partir tant qu'un gabarit n'est pas activé à la main.
--
-- CE QUE CE FICHIER MET EN PLACE :
--   1. La file d'attente SMS et ses tables annexes
--   2. L'enfilement depuis notifications + la prise de lot concurrente
--   3. Le drainage automatique toutes les minutes
--   4. La vérification de numéro par code à usage unique
--   5. Les notifications manquantes (bénéficiaire, espèces, identité)
--   6. Le prénom du client dans les messages
--   7. Le retrait de l'alerte de taux
--   8. La langue des SMS, choisie et non devinée
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 20260810000000_sms_outbox_schema.sql
-- ════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════
-- 20260810000100_sms_enqueue_and_claim.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- SMS — Lot 2 : enfilement depuis notifications, routage expéditeur,
-- prise de lot concurrente, et actions d'administration.
--
-- POURQUOI SE BRANCHER SUR notifications : chaque événement d'argent fait
-- DÉJÀ un INSERT INTO notifications dans les RPC métier SECURITY DEFINER,
-- avec une garde de statut garantissant une notification par événement
-- terminal. On se greffe dessus plutôt que d'éditer ~6 RPC financières
-- critiques → zéro régression sur la logique d'argent, et idempotence
-- native (1 notification = 1 ligne d'outbox).
--
-- ⚠️ GARANTIE CRITIQUE : un échec d'enfilement NE DOIT JAMAIS faire échouer
-- la transaction métier. Tout le corps est enveloppé dans EXCEPTION WHEN
-- OTHERS. Telnyx en panne ⇒ pas de SMS ; jamais un paiement perdu.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Langue par défaut selon le pays du numéro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sms_locale_for_country(p_country TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_country IS NULL THEN 'fr'
    -- Marchés francophones : Afrique de l'Ouest et centrale + Europe.
    WHEN upper(p_country) IN (
      'CM','GA','TD','CF','CG','GQ','CD','CI','SN','ML','BF','NE','TG','BJ',
      'GN','MA','TN','DZ','FR','BE','CH','LU','RW','BI','KM','DJ','MG'
    ) THEN 'fr'
    ELSE 'en'
  END;
$$;

COMMENT ON FUNCTION public.sms_locale_for_country IS
  'Langue SMS par défaut déduite du pays du numéro. Utilisée quand clients.preferred_locale est NULL.';

-- ------------------------------------------------------------
-- 2. Résolution de l'expéditeur selon le pays de destination
--
-- RÈGLE DE SÛRETÉ : un ID alphanumérique NON enregistré est réécrit ou jeté
-- par l'opérateur. Tant que `registered` est faux, on renvoie donc
-- 'long_code' — le message part du numéro Telnyx acheté et ARRIVE. Basculer
-- un pays en `registered = true` est un acte manuel, après confirmation.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_sms_sender(p_country TEXT)
RETURNS TABLE (sender_type TEXT, sender_id TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sms_sender_routes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
    FROM public.sms_sender_routes
   WHERE country_iso = upper(coalesce(p_country, ''));

  IF NOT FOUND THEN
    SELECT * INTO v_row FROM public.sms_sender_routes WHERE country_iso = '*';
  END IF;

  -- Alphanumérique réellement utilisable seulement si enregistré ET nommé.
  IF v_row.sender_type = 'alphanumeric'
     AND v_row.registered IS TRUE
     AND coalesce(v_row.sender_id, '') <> '' THEN
    RETURN QUERY SELECT 'alphanumeric'::TEXT, v_row.sender_id;
  ELSE
    RETURN QUERY SELECT 'long_code'::TEXT, NULL::TEXT;
  END IF;
END;
$$;

-- Un seul COMMENT par fonction : l'étiquette @mola EST le commentaire (un
-- second COMMENT écraserait le premier). La description humaine vit dans
-- « label » et dans le bloc d'explication ci-dessus.
COMMENT ON FUNCTION public.resolve_sms_sender(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewLogs","confirm":false,"danger":false,"label":"Résoudre l''expéditeur SMS à présenter pour un pays donné (interne)"}';

REVOKE ALL ON FUNCTION public.resolve_sms_sender(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_sms_sender(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.sms_locale_for_country(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sms_locale_for_country(TEXT) TO service_role, authenticated;

-- ------------------------------------------------------------
-- 3. Enfilement : trigger AFTER INSERT ON notifications
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_sms_from_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template   TEXT;
  v_category   TEXT;
  v_enabled    BOOLEAN;
  v_phone      TEXT;
  v_country    TEXT;
  v_locale     TEXT;
  v_opt_in     BOOLEAN;
  v_status     TEXT;
  v_entity     UUID;
BEGIN
  -- Best-effort intégral : aucune erreur ne doit remonter dans la
  -- transaction métier parente (paiement, dépôt, validation…).
  BEGIN
    -- a. Le type est-il mappé ET activé ?
    SELECT template, category, enabled
      INTO v_template, v_category, v_enabled
      FROM public.sms_template_map
     WHERE notification_type = NEW.type;

    IF v_template IS NULL OR v_enabled IS NOT TRUE THEN
      RETURN NEW;  -- type non mappé ou gabarit désactivé → rien à faire
    END IF;

    -- b. Destinataire : numéro canonique + pays + langue.
    SELECT c.phone_e164,
           c.phone_country,
           coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country)),
           c.sms_marketing_opt_in
      INTO v_phone, v_country, v_locale, v_opt_in
      FROM public.clients c
     WHERE c.user_id = NEW.user_id;

    -- c. Statut initial. On enfile TOUJOURS une ligne (traçabilité), mais
    --    elle part en 'skipped' si l'envoi est impossible ou non consenti.
    IF v_phone IS NULL OR v_phone = '' THEN
      v_status := 'skipped';           -- pas de numéro exploitable
    ELSIF v_category = 'marketing' AND v_opt_in IS NOT TRUE THEN
      v_status := 'skipped';           -- marketing sans consentement explicite
    ELSE
      v_status := 'pending';
    END IF;

    -- d. entity_id : deposit_id OU payment_id selon l'événement.
    v_entity := COALESCE(
      NULLIF(NEW.metadata ->> 'deposit_id', ''),
      NULLIF(NEW.metadata ->> 'payment_id', '')
    )::uuid;

    -- e. Enfilement idempotent : 1 notification = 1 ligne d'outbox au plus.
    INSERT INTO public.sms_outbox (
      event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
      locale, template, category, payload, status, idempotency_key
    ) VALUES (
      NEW.type,
      v_entity,
      NEW.user_id,
      v_phone,
      v_country,
      coalesce(v_locale, 'fr'),
      v_template,
      v_category,
      COALESCE(NEW.metadata, '{}'::jsonb),
      v_status,
      'smsnotif:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_sms_from_notification: échec pour notification % (type=%): %',
      NEW.id, NEW.type, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_sms_from_notification IS
  'Trigger AFTER INSERT ON notifications : met un SMS en file (sms_outbox) si le type est mappé et activé. Best-effort — n''abort jamais la transaction métier. Inerte tant que sms_template_map.enabled = false.';

DROP TRIGGER IF EXISTS on_notification_enqueue_sms ON public.notifications;
CREATE TRIGGER on_notification_enqueue_sms
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_sms_from_notification();

-- ------------------------------------------------------------
-- 4. Prise de lot concurrente pour le drainer
--
-- Même patron de bail que claim_email_batch : on repousse next_attempt_at
-- de 2 minutes à la prise, si bien qu'un run cron concurrent ne resélectionne
-- pas la ligne, et qu'un drainer qui meurt en vol libère la ligne tout seul.
-- FOR UPDATE SKIP LOCKED : verrou non bloquant.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_sms_batch(p_limit INT DEFAULT 20)
RETURNS SETOF public.sms_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ready AS (
    SELECT o.id
      FROM public.sms_outbox o
     WHERE o.status IN ('pending', 'failed')
       AND o.attempts < o.max_attempts
       AND o.next_attempt_at <= now()
     ORDER BY o.created_at
     LIMIT GREATEST(p_limit, 1)
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sms_outbox o
     SET next_attempt_at = now() + interval '2 minutes'
    FROM ready
   WHERE o.id = ready.id
  RETURNING o.*;
END;
$$;

COMMENT ON FUNCTION public.claim_sms_batch(INT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewLogs","confirm":false,"danger":false,"label":"Réserver un lot de SMS prêts à partir — bail de 2 min, FOR UPDATE SKIP LOCKED (interne, drainer)"}';

REVOKE ALL ON FUNCTION public.claim_sms_batch(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_sms_batch(INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_sms_batch(INT) TO service_role;

-- ------------------------------------------------------------
-- 5. Observabilité et actions d'administration
-- ------------------------------------------------------------

-- Taux de délivrance par pays : LE chiffre qui dit si l'enregistrement de
-- l'expéditeur a réellement pris dans un marché donné.
CREATE OR REPLACE FUNCTION public.admin_sms_delivery_stats(p_days INT DEFAULT 7)
RETURNS TABLE (
  country        TEXT,
  total          BIGINT,
  sent           BIGINT,
  delivered      BIGINT,
  failed         BIGINT,
  skipped        BIGINT,
  multi_segment  BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT coalesce(o.recipient_country, '?')                                   AS country,
         count(*)                                                             AS total,
         count(*) FILTER (WHERE o.status = 'sent')                            AS sent,
         count(*) FILTER (WHERE o.delivery_status = 'delivered')              AS delivered,
         count(*) FILTER (WHERE o.status = 'failed')                          AS failed,
         count(*) FILTER (WHERE o.status = 'skipped')                         AS skipped,
         -- > 1 segment ⇒ un gabarit a basculé en UCS-2 : coût doublé.
         count(*) FILTER (WHERE coalesce(o.segments, 1) > 1)                  AS multi_segment
    FROM public.sms_outbox o
   WHERE o.created_at > now() - make_interval(days => GREATEST(p_days, 1))
   GROUP BY 1
   ORDER BY 2 DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_sms_delivery_stats(INT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewLogs","confirm":false,"danger":false,"label":"Statistiques de délivrance SMS par pays"}';

-- Réenvoi manuel : remet une ligne échouée en file. Ne recrée jamais de
-- ligne — donc pas de doublon possible.
CREATE OR REPLACE FUNCTION public.admin_resend_sms(p_outbox_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sms_outbox%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT * INTO v_row FROM public.sms_outbox WHERE id = p_outbox_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SMS introuvable');
  END IF;

  IF v_row.status = 'sent' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce SMS est déjà parti');
  END IF;

  -- Un numéro supprimé le reste : le réenvoi ne contourne pas un STOP.
  IF EXISTS (SELECT 1 FROM public.sms_suppressions s WHERE s.phone_e164 = v_row.recipient_phone) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro en liste de suppression (STOP)');
  END IF;

  UPDATE public.sms_outbox
     SET status = 'pending', attempts = 0, next_attempt_at = now(), last_error = NULL
   WHERE id = p_outbox_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_resend_sms(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Renvoyer un SMS échoué"}';

-- Suppression manuelle d'un numéro (demande client hors canal STOP).
CREATE OR REPLACE FUNCTION public.admin_suppress_phone(p_phone TEXT, p_reason TEXT DEFAULT 'manual')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro non conforme au format E.164');
  END IF;

  IF p_reason NOT IN ('stop', 'invalid', 'undeliverable', 'manual') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif invalide');
  END IF;

  INSERT INTO public.sms_suppressions (phone_e164, reason, source)
  VALUES (p_phone, p_reason, 'admin:' || coalesce(auth.uid()::text, '?'))
  ON CONFLICT (phone_e164) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.admin_suppress_phone(TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Bloquer définitivement un numéro pour les SMS"}';

REVOKE ALL ON FUNCTION public.admin_sms_delivery_stats(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_resend_sms(UUID)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suppress_phone(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sms_delivery_stats(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resend_sms(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suppress_phone(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- 20260810000200_sms_drainer_cron.sql
-- ════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════
-- 20260810000300_phone_verification.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- SMS — Lot 4 : vérification du numéro par code à usage unique.
--
-- POURQUOI C'EST LA PREMIÈRE BRIQUE À ACTIVER : c'est le seul mécanisme qui
-- produit un numéro dont on SAIT qu'il est réel, au format E.164, avec le
-- consentement du client attaché. Tout le reste en dépend — envoyer un solde
-- à un numéro jamais vérifié, c'est l'envoyer à l'inconnu qui l'a récupéré.
--
-- ⚠️ CE N'EST PAS UN FACTEUR D'AUTHENTIFICATION. L'application dispose déjà
-- de passkeys WebAuthn, plus robustes. Le SIM-swap est une attaque réelle sur
-- ces marchés : ces codes servent à CONFIRMER UN NUMÉRO, jamais à ouvrir une
-- session ni à valider un paiement. confirm_phone_verification() exige déjà
-- une session authentifiée — le code seul n'ouvre rien.
--
-- ⚠️ search_path = public, extensions : pgcrypto est installé dans le schéma
-- `extensions`. Une fonction qui épingle `SET search_path = public` seul ne
-- voit PAS crypt()/gen_salt()/gen_random_bytes() et échoue à l'exécution.
-- Le dépôt porte déjà une migration correctrice pour exactement ce piège
-- (20260220000000_fix_admin_reset_password_searchpath).
--
-- DÉFENSES : code haché (bcrypt, jamais en clair au repos), expiration à
-- 10 minutes, usage unique, 5 essais maximum par code, 3 demandes par heure
-- et par utilisateur, et refus si le numéro est en liste de suppression.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164    TEXT NOT NULL,
  phone_country TEXT,
  code_hash     TEXT NOT NULL,           -- bcrypt : le code en clair n'est jamais stocké
  attempts      INT  NOT NULL DEFAULT 0,
  max_attempts  INT  NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user
  ON public.phone_verifications (user_id, created_at DESC);

COMMENT ON TABLE public.phone_verifications IS
  'Codes de vérification de numéro à usage unique. Code haché en bcrypt, expiration 10 min, 5 essais max. Sert à confirmer un numéro — jamais à authentifier.';

-- Table interne : RLS active et AUCUNE policy. Tout passe par les RPC
-- SECURITY DEFINER ci-dessous. Un client ne doit jamais pouvoir lire la
-- table des codes, fût-ce la sienne.
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Demande d'un code
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_phone_verification(
  p_phone_e164 TEXT,
  p_country    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_country  TEXT := upper(nullif(trim(coalesce(p_country, '')), ''));
  v_enabled  BOOLEAN;
  v_recent   INT;
  v_bytes    BYTEA;
  v_num      BIGINT;
  v_code     TEXT;
  v_locale   TEXT;
  v_verif_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session requise');
  END IF;

  -- Forme E.164 stricte. La validité réelle du plan de numérotation est
  -- contrôlée côté client par libphonenumber avant l'appel.
  IF p_phone_e164 IS NULL OR p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro non conforme au format international');
  END IF;

  -- Le gabarit doit être actif AVANT toute écriture : sinon on consommerait
  -- un jeton de limitation de débit et on stockerait un code pour un SMS
  -- qui ne partirait jamais.
  SELECT enabled INTO v_enabled
    FROM public.sms_template_map WHERE notification_type = 'phone_verification';

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vérification par SMS indisponible pour le moment');
  END IF;

  -- Un numéro ayant répondu STOP ne reçoit plus rien, code compris.
  IF EXISTS (SELECT 1 FROM public.sms_suppressions s WHERE s.phone_e164 = p_phone_e164) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro a demandé à ne plus être contacté');
  END IF;

  -- Limitation de débit : 3 demandes par heure et par utilisateur.
  SELECT count(*) INTO v_recent
    FROM public.phone_verifications
   WHERE user_id = v_uid AND created_at > now() - interval '1 hour';

  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trop de demandes. Réessayez dans une heure.');
  END IF;

  -- Code à 6 chiffres tiré d'une source cryptographique (jamais random()).
  -- Composition octet par octet : le résultat est positif par construction,
  -- contrairement à l'idiome ('x'||hex)::bit(32)::int qui peut être négatif
  -- et produire un lpad aberrant.
  v_bytes := gen_random_bytes(4);
  v_num := get_byte(v_bytes, 0)::bigint * 16777216
         + get_byte(v_bytes, 1)::bigint * 65536
         + get_byte(v_bytes, 2)::bigint * 256
         + get_byte(v_bytes, 3)::bigint;
  v_code := lpad((v_num % 1000000)::text, 6, '0');

  -- Un seul code actif à la fois : les précédents sont invalidés.
  UPDATE public.phone_verifications
     SET consumed_at = now()
   WHERE user_id = v_uid AND consumed_at IS NULL;

  INSERT INTO public.phone_verifications (user_id, phone_e164, phone_country, code_hash, expires_at)
  VALUES (v_uid, p_phone_e164, v_country,
          crypt(v_code, gen_salt('bf')), now() + interval '10 minutes')
  RETURNING id INTO v_verif_id;

  SELECT coalesce(c.preferred_locale,
                  public.sms_locale_for_country(coalesce(v_country, c.phone_country)))
    INTO v_locale
    FROM public.clients c WHERE c.user_id = v_uid;

  -- Enfilement DIRECT dans sms_outbox, sans passer par notifications : un
  -- code de vérification n'a rien à faire dans le fil in-app, où il resterait
  -- lisible bien après son expiration.
  --
  -- La clé d'idempotence porte l'id de la ligne de vérification — unique par
  -- construction. Un horodatage à la seconde ferait silencieusement tomber
  -- une seconde demande émise dans la même seconde.
  INSERT INTO public.sms_outbox (
    event_type, recipient_user_id, recipient_phone, recipient_country,
    locale, template, category, payload, status, idempotency_key
  ) VALUES (
    'phone_verification', v_uid, p_phone_e164, v_country,
    coalesce(v_locale, 'fr'), 'phone_verification', 'security',
    jsonb_build_object('code', v_code), 'pending',
    'phoneverif:' || v_verif_id::text
  );

  RETURN jsonb_build_object('success', true, 'expires_in_seconds', 600);
END;
$$;

COMMENT ON FUNCTION public.request_phone_verification(TEXT, TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Envoyer un code de vérification de numéro par SMS (self-service client)"}';

-- ------------------------------------------------------------
-- Confirmation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_phone_verification(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.phone_verifications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session requise');
  END IF;

  SELECT * INTO v_row
    FROM public.phone_verifications
   WHERE user_id = v_uid AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun code en attente');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code expiré. Demandez-en un nouveau.');
  END IF;

  IF v_row.attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trop d''essais. Demandez un nouveau code.');
  END IF;

  -- L'essai est compté AVANT la comparaison : un abandon en cours de
  -- transaction ne doit pas offrir un essai gratuit.
  UPDATE public.phone_verifications SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.code_hash <> crypt(coalesce(p_code, ''), v_row.code_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code incorrect');
  END IF;

  UPDATE public.phone_verifications SET consumed_at = now() WHERE id = v_row.id;

  UPDATE public.clients
     SET phone_e164        = v_row.phone_e164,
         phone_country     = coalesce(v_row.phone_country, phone_country),
         phone_verified_at = now(),
         updated_at        = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'phone_e164', v_row.phone_e164);
END;
$$;

COMMENT ON FUNCTION public.confirm_phone_verification(TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Confirmer un code de vérification de numéro (self-service client)"}';

REVOKE ALL ON FUNCTION public.request_phone_verification(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_phone_verification(TEXT)       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_phone_verification(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_phone_verification(TEXT)       TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- 20260810000400_sms_missing_event_notifications.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- SMS — Lot 5 : notifications pour les événements qui n'en émettaient aucune.
--
-- DEUX TROUS RÉELS TROUVÉS DANS LE FLUX EXISTANT :
--   1. `waiting_beneficiary_info` bloque un paiement AVEC L'ARGENT DÉJÀ
--      RÉSERVÉ sur le solde du client, et n'émet aucune notification. Le
--      paiement reste simplement en plan, sans que personne ne soit prévenu.
--   2. `cash_pending` : le retrait espèces devient disponible sans que le
--      client l'apprenne.
-- Et une opportunité : `clients.kyc_verified` bascule sans que le client
-- sache que son compte vient d'être débloqué.
--
-- ⚠️ CHOIX D'IMPLÉMENTATION : des TRIGGERS DE TABLE, pas des modifications
-- des RPC financières. Éditer create_payment() ou process_payment() pour y
-- ajouter un INSERT de notification ferait porter le risque de régression
-- sur du code qui déplace de l'argent. Un trigger AFTER UPDATE sur la
-- colonne status obtient le même résultat sans toucher une seule ligne de
-- la logique de paiement.
--
-- Chaque trigger est best-effort (EXCEPTION WHEN OTHERS) : une notification
-- ratée ne doit jamais annuler la transaction métier qui l'a déclenchée.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Paiement en attente des informations du bénéficiaire
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_payment_awaiting_beneficiary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'payment_awaiting_beneficiary',
      'Informations bénéficiaire requises',
      format('Votre paiement %s est en attente des informations du bénéficiaire.', NEW.reference),
      jsonb_build_object(
        'payment_id', NEW.id,
        'reference',  NEW.reference,
        'amount_rmb', NEW.amount_rmb
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_payment_awaiting_beneficiary: paiement % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_awaiting_beneficiary ON public.payments;
CREATE TRIGGER on_payment_awaiting_beneficiary
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  -- OLD.status IS DISTINCT FROM NEW.status : un UPDATE qui réécrit le même
  -- statut ne doit pas produire une seconde notification.
  WHEN (NEW.status = 'waiting_beneficiary_info' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_payment_awaiting_beneficiary();

-- ------------------------------------------------------------
-- 2. Retrait espèces disponible
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_cash_payment_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'cash_payment_ready',
      'Retrait espèces disponible',
      format('Votre retrait espèces %s est disponible en agence.', NEW.reference),
      jsonb_build_object(
        'payment_id', NEW.id,
        'reference',  NEW.reference
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_cash_payment_ready: paiement % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cash_payment_ready ON public.payments;
CREATE TRIGGER on_cash_payment_ready
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  WHEN (NEW.status = 'cash_pending' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_cash_payment_ready();

-- ------------------------------------------------------------
-- 3. Identité vérifiée
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_kyc_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.user_id,
      'kyc_approved',
      'Identité vérifiée',
      'Votre identité est vérifiée. Votre compte est actif.',
      jsonb_build_object('client_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_kyc_approved: client % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_kyc_approved ON public.clients;
CREATE TRIGGER on_kyc_approved
  AFTER UPDATE OF kyc_verified ON public.clients
  FOR EACH ROW
  WHEN (NEW.kyc_verified IS TRUE AND OLD.kyc_verified IS DISTINCT FROM TRUE)
  EXECUTE FUNCTION public.notify_kyc_approved();

-- ------------------------------------------------------------
-- 4. Relance SMS des dépôts sans preuve
--
-- Jumeau de run_deposit_reminders() (email), branché sur la même logique
-- métier. Récupère des dépôts qui expireraient en silence.
--
-- PLAFOND STRICT : une seule relance par dépôt, JAMAIS deux. La clé
-- d'idempotence porte l'identifiant du dépôt et rien d'autre — pas de date —
-- si bien qu'un second passage du cron ne peut pas produire un doublon.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_sms_deposit_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
    FROM public.sms_template_map WHERE notification_type = 'deposit_awaiting_proof';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  INSERT INTO public.sms_outbox (
    event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
    locale, template, category, payload, status, idempotency_key
  )
  SELECT
    'deposit_awaiting_proof',
    d.id,
    d.user_id,
    c.phone_e164,
    c.phone_country,
    coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country)),
    'deposit_awaiting_proof',
    'transactional',
    jsonb_build_object('reference', d.reference, 'amount_xaf', d.amount_xaf),
    CASE WHEN c.phone_e164 IS NULL OR c.phone_e164 = '' THEN 'skipped' ELSE 'pending' END,
    'smsdepositreminder:' || d.id::text
  FROM public.deposits d
  JOIN public.clients c ON c.user_id = d.user_id
  WHERE d.status IN ('created', 'awaiting_proof')
    AND d.created_at < now() - interval '24 hours'
    AND d.created_at > now() - interval '3 days'
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.run_sms_deposit_reminders() IS
  '@mola:{"expose":false,"kind":"write","permission":"canProcessDeposits","confirm":false,"danger":false,"label":"Relancer par SMS les dépôts sans preuve (interne, cron)"}';

REVOKE ALL ON FUNCTION public.run_sms_deposit_reminders() FROM PUBLIC, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('sms-deposit-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sms-deposit-reminders');

  -- Décalé de la relance email (minute 17) pour ne pas empiler deux
  -- rappels sur le même dépôt à la même seconde.
  PERFORM cron.schedule('sms-deposit-reminders', '47 * * * *',
    $cron$ SELECT public.run_sms_deposit_reminders(); $cron$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Planification cron sms-deposit-reminders impossible (pg_cron activé ?): %', SQLERRM;
END;
$$;

-- ------------------------------------------------------------
-- 5. Accusé de dépôt (deposit_created)
--
-- ⚠️ CAS PARTICULIER : contrairement aux autres événements de dépôt,
-- `deposit_created` n'écrit AUCUNE ligne dans `notifications`. Le système
-- email le traite via un trigger dédié sur `deposits` qui alimente
-- directement email_outbox (voir enqueue_deposit_ack_email, migration
-- 20260601141000). Le trigger SMS branché sur `notifications` ne le verrait
-- donc jamais : il lui faut son propre trigger, calqué sur l'email.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_deposit_ack_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_phone   TEXT;
  v_country TEXT;
  v_locale  TEXT;
BEGIN
  BEGIN
    SELECT enabled INTO v_enabled
      FROM public.sms_template_map WHERE notification_type = 'deposit_created';
    IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

    SELECT c.phone_e164,
           c.phone_country,
           coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country))
      INTO v_phone, v_country, v_locale
      FROM public.clients c
     WHERE c.user_id = NEW.user_id;

    INSERT INTO public.sms_outbox (
      event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
      locale, template, category, payload, status, idempotency_key
    ) VALUES (
      'deposit_created', NEW.id, NEW.user_id, v_phone, v_country,
      coalesce(v_locale, 'fr'), 'deposit_created', 'transactional',
      jsonb_build_object('reference', NEW.reference, 'amount_xaf', NEW.amount_xaf),
      CASE WHEN v_phone IS NULL OR v_phone = '' THEN 'skipped' ELSE 'pending' END,
      'smsdepositack:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_deposit_ack_sms: dépôt % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_deposit_submitted_enqueue_sms ON public.deposits;
CREATE TRIGGER on_deposit_submitted_enqueue_sms
  AFTER INSERT OR UPDATE OF status ON public.deposits
  FOR EACH ROW
  WHEN (NEW.status = 'proof_submitted')
  EXECUTE FUNCTION public.enqueue_deposit_ack_sms();

-- ------------------------------------------------------------
-- 6. Mapping email pour les nouveaux types
--
-- Ces types sont désormais émis dans `notifications`. Le trigger email les
-- ignorerait silencieusement (type non mappé) : on les déclare, désactivés,
-- pour que l'activation email soit un choix explicite et non un oubli.
-- ------------------------------------------------------------
INSERT INTO public.email_template_map (notification_type, template, enabled) VALUES
  ('payment_awaiting_beneficiary', 'payment_awaiting_beneficiary', false),
  ('cash_payment_ready',           'cash_payment_ready',           false),
  ('kyc_approved',                 'kyc_approved',                 false)
ON CONFLICT (notification_type) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- 20260810000500_sms_payload_first_name.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- SMS — Lot 6 : transmettre le prénom du client aux gabarits.
--
-- POURQUOI : les messages ouvrent désormais par le prénom (« Nelson, votre
-- versement de 1 500 000 XAF est validé… »). C'est le seul élément qui
-- distingue un message écrit pour quelqu'un d'une notification produite par
-- une machine — et sur un SMS qui annonce un mouvement d'argent, cette
-- différence est ce qui fait qu'on le lit au lieu de l'ignorer.
--
-- La table `notifications` ne porte pas le prénom : ses métadonnées ne
-- contiennent que la référence et les montants. On l'ajoute donc au payload
-- au moment de l'enfilement, où l'on a déjà la ligne `clients` sous la main.
--
-- Sans prénom, les gabarits ouvrent par « Bonjour, » — jamais en minuscule.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enfilement depuis notifications
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_sms_from_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template   TEXT;
  v_category   TEXT;
  v_enabled    BOOLEAN;
  v_phone      TEXT;
  v_country    TEXT;
  v_locale     TEXT;
  v_opt_in     BOOLEAN;
  v_first_name TEXT;
  v_status     TEXT;
  v_entity     UUID;
BEGIN
  BEGIN
    SELECT template, category, enabled
      INTO v_template, v_category, v_enabled
      FROM public.sms_template_map
     WHERE notification_type = NEW.type;

    IF v_template IS NULL OR v_enabled IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    SELECT c.phone_e164,
           c.phone_country,
           coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country)),
           c.sms_marketing_opt_in,
           c.first_name
      INTO v_phone, v_country, v_locale, v_opt_in, v_first_name
      FROM public.clients c
     WHERE c.user_id = NEW.user_id;

    IF v_phone IS NULL OR v_phone = '' THEN
      v_status := 'skipped';
    ELSIF v_category = 'marketing' AND v_opt_in IS NOT TRUE THEN
      v_status := 'skipped';
    ELSE
      v_status := 'pending';
    END IF;

    v_entity := COALESCE(
      NULLIF(NEW.metadata ->> 'deposit_id', ''),
      NULLIF(NEW.metadata ->> 'payment_id', '')
    )::uuid;

    INSERT INTO public.sms_outbox (
      event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
      locale, template, category, payload, status, idempotency_key
    ) VALUES (
      NEW.type,
      v_entity,
      NEW.user_id,
      v_phone,
      v_country,
      coalesce(v_locale, 'fr'),
      v_template,
      v_category,
      -- Le prénom s'ajoute aux métadonnées existantes sans les écraser.
      COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object('first_name', nullif(trim(coalesce(v_first_name, '')), '')),
      v_status,
      'smsnotif:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_sms_from_notification: échec pour notification % (type=%): %',
      NEW.id, NEW.type, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_sms_from_notification IS
  'Trigger AFTER INSERT ON notifications : met un SMS en file (sms_outbox) si le type est mappé et activé, en joignant le prénom du client au payload. Best-effort — n''abort jamais la transaction métier.';

-- ------------------------------------------------------------
-- 2. Accusé de dépôt
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_deposit_ack_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled    BOOLEAN;
  v_phone      TEXT;
  v_country    TEXT;
  v_locale     TEXT;
  v_first_name TEXT;
BEGIN
  BEGIN
    SELECT enabled INTO v_enabled
      FROM public.sms_template_map WHERE notification_type = 'deposit_created';
    IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

    SELECT c.phone_e164,
           c.phone_country,
           coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country)),
           c.first_name
      INTO v_phone, v_country, v_locale, v_first_name
      FROM public.clients c
     WHERE c.user_id = NEW.user_id;

    INSERT INTO public.sms_outbox (
      event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
      locale, template, category, payload, status, idempotency_key
    ) VALUES (
      'deposit_created', NEW.id, NEW.user_id, v_phone, v_country,
      coalesce(v_locale, 'fr'), 'deposit_created', 'transactional',
      jsonb_build_object(
        'reference',  NEW.reference,
        'amount_xaf', NEW.amount_xaf,
        'first_name', nullif(trim(coalesce(v_first_name, '')), '')
      ),
      CASE WHEN v_phone IS NULL OR v_phone = '' THEN 'skipped' ELSE 'pending' END,
      'smsdepositack:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_deposit_ack_sms: dépôt % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3. Relance des dépôts sans preuve
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_sms_deposit_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT enabled INTO v_enabled
    FROM public.sms_template_map WHERE notification_type = 'deposit_awaiting_proof';
  IF v_enabled IS NOT TRUE THEN RETURN; END IF;

  INSERT INTO public.sms_outbox (
    event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
    locale, template, category, payload, status, idempotency_key
  )
  SELECT
    'deposit_awaiting_proof',
    d.id,
    d.user_id,
    c.phone_e164,
    c.phone_country,
    coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country)),
    'deposit_awaiting_proof',
    'transactional',
    jsonb_build_object(
      'reference',  d.reference,
      'amount_xaf', d.amount_xaf,
      'first_name', nullif(trim(coalesce(c.first_name, '')), '')
    ),
    CASE WHEN c.phone_e164 IS NULL OR c.phone_e164 = '' THEN 'skipped' ELSE 'pending' END,
    'smsdepositreminder:' || d.id::text
  FROM public.deposits d
  JOIN public.clients c ON c.user_id = d.user_id
  WHERE d.status IN ('created', 'awaiting_proof')
    AND d.created_at < now() - interval '24 hours'
    AND d.created_at > now() - interval '3 days'
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.run_sms_deposit_reminders() IS
  '@mola:{"expose":false,"kind":"write","permission":"canProcessDeposits","confirm":false,"danger":false,"label":"Relancer par SMS les dépôts sans preuve (interne, cron)"}';

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- 20260810000600_sms_drop_rate_alert.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- SMS — Lot 7 : retrait de l'alerte de taux quotidienne.
--
-- Décision produit : ce message n'a pas d'utilité aujourd'hui. C'était le
-- seul du lot de nature marketing, et le seul qui exigeait un écran de
-- préférences dans l'application avant de pouvoir être activé — puisque le
-- client ne peut pas répondre STOP à un expéditeur alphanumérique.
--
-- Le gabarit est retiré du code ; on retire ici sa ligne de mapping pour
-- que la base et le code disent la même chose.
--
-- CE QUI RESTE VOLONTAIREMENT EN PLACE :
--   · la catégorie 'marketing' dans sms_template_map et sms_outbox
--   · la colonne clients.sms_marketing_opt_in
--   · la vérification du consentement dans enqueue_sms_from_notification
-- Ces trois éléments ne coûtent rien tant qu'aucun gabarit marketing
-- n'existe, et éviteront de tout reconstruire le jour où l'on en ajoute un.
-- Supprimer une colonne de consentement est par ailleurs destructif : les
-- choix déjà exprimés par des clients seraient perdus.
-- ============================================================

DELETE FROM public.sms_template_map
 WHERE notification_type = 'daily_rate_alert';

-- Aucune ligne d'outbox ne devrait exister pour ce type — le gabarit n'a
-- jamais été activé. On nettoie malgré tout, au cas où un essai manuel en
-- aurait laissé une : une ligne en attente pointant vers un gabarit
-- désormais inconnu partirait en 'skipped' à chaque passage du drainer.
DELETE FROM public.sms_outbox
 WHERE template = 'daily_rate_alert'
   AND status IN ('pending', 'failed');

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- 20260810000700_preferred_locale.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- SMS — Lot 8 : langue des messages, choisie et non devinée.
--
-- LE PROBLÈME QUE ÇA CORRIGE : jusqu'ici la langue se déduisait du pays du
-- numéro. Ça marche pour un client en Chine ou aux États-Unis, mais pas au
-- Cameroun — pays officiellement bilingue, où un client du Nord-Ouest a un
-- numéro +237 exactement comme un client de Douala. La déduction se
-- trompait donc précisément sur la population anglophone qu'il s'agit de
-- servir : ce n'est pas un cas marginal, c'est une partie du marché.
--
-- LA SOURCE DE VÉRITÉ devient la langue que le client a choisie lui-même
-- dans l'application. Ce n'est plus une supposition, c'est une décision.
-- Le pays ne sert plus que de repli, et le français de défaut.
--
-- DÉFAUT FRANÇAIS pour tout le monde : c'est la langue de la majorité du
-- portefeuille, et un défaut explicite vaut mieux qu'un NULL qui laisserait
-- chaque appelant improviser.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Français par défaut, partout
-- ------------------------------------------------------------
UPDATE public.clients
   SET preferred_locale = 'fr'
 WHERE preferred_locale IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN preferred_locale SET DEFAULT 'fr';

COMMENT ON COLUMN public.clients.preferred_locale IS
  'Langue des SMS, choisie par le client dans l''app ou réglée par un admin. Défaut « fr ». Le pays du numéro ne sert plus que de repli.';

-- ------------------------------------------------------------
-- 2. Le client règle sa propre langue
--
-- Appelée par l'application au moment où le client change de langue. Le
-- chinois existe dans l'interface mais pas en SMS : un message en
-- idéogrammes bascule en UCS-2 (70 caractères par segment au lieu de 160)
-- et doublerait le coût de chaque envoi. Un client qui navigue en chinois
-- reçoit donc ses SMS en anglais — plus utile que du français pour
-- quelqu'un qui a explicitement écarté le français.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_preferred_locale(p_locale TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_locale TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session requise');
  END IF;

  v_locale := CASE lower(left(coalesce(p_locale, ''), 2))
                WHEN 'fr' THEN 'fr'
                WHEN 'en' THEN 'en'
                WHEN 'zh' THEN 'en'   -- pas de SMS en chinois : voir en-tête
                ELSE NULL
              END;

  IF v_locale IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Langue non prise en charge');
  END IF;

  UPDATE public.clients
     SET preferred_locale = v_locale,
         updated_at       = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'locale', v_locale);
END;
$$;

COMMENT ON FUNCTION public.set_my_preferred_locale(TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Enregistrer la langue de SMS choisie par le client (self-service)"}';

-- ------------------------------------------------------------
-- 3. Un admin règle la langue d'un client
--
-- Indispensable pour les clients inscrits par un agent, qui n'ouvriront
-- peut-être jamais l'application et ne pourront donc jamais exprimer ce
-- choix eux-mêmes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_client_locale(
  p_user_id UUID,
  p_locale  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locale TEXT := lower(left(coalesce(p_locale, ''), 2));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_locale NOT IN ('fr', 'en') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Langue invalide (fr ou en)');
  END IF;

  UPDATE public.clients
     SET preferred_locale = v_locale,
         updated_at       = now()
   WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;

  RETURN jsonb_build_object('success', true, 'locale', v_locale);
END;
$$;

COMMENT ON FUNCTION public.admin_set_client_locale(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Changer la langue des SMS d''un client","resolve":{"p_user_id":"client"}}';

REVOKE ALL ON FUNCTION public.set_my_preferred_locale(TEXT)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_client_locale(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_preferred_locale(TEXT)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_client_locale(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- Historique des migrations
--
-- Marque ces fichiers comme « déjà appliqués », pour qu'un futur
-- `supabase db push` ne tente pas de les rejouer. Enveloppé dans un bloc
-- d'exception : selon la version du CLI la table peut être absente ou
-- structurée autrement, sans que cela remette en cause le schéma posé.
-- ════════════════════════════════════════════════════════════
DO $migr$
BEGIN
  INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
    ('20260810000000', 'sms_outbox_schema'),
    ('20260810000100', 'sms_enqueue_and_claim'),
    ('20260810000200', 'sms_drainer_cron'),
    ('20260810000300', 'phone_verification'),
    ('20260810000400', 'sms_missing_event_notifications'),
    ('20260810000500', 'sms_payload_first_name'),
    ('20260810000600', 'sms_drop_rate_alert'),
    ('20260810000700', 'preferred_locale')
  ON CONFLICT (version) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Historique non mis à jour (%). Sans conséquence : le schéma est en place.', SQLERRM;
END;
$migr$;

-- ════════════════════════════════════════════════════════════
-- Contrôle final — à lire après exécution
-- ════════════════════════════════════════════════════════════
SELECT
  to_regclass('public.sms_outbox')          IS NOT NULL AS table_file,
  to_regclass('public.sms_template_map')    IS NOT NULL AS table_gabarits,
  to_regclass('public.sms_sender_routes')   IS NOT NULL AS table_expediteurs,
  to_regclass('public.phone_verifications') IS NOT NULL AS table_verifications,
  (SELECT count(*) FROM public.sms_template_map)                       AS gabarits,
  (SELECT count(*) FROM public.sms_template_map WHERE enabled)         AS gabarits_actifs,
  (SELECT count(*) FROM cron.job WHERE jobname = 'sms-drainer')        AS cron_drainage,
  (SELECT count(*) FROM public.clients WHERE preferred_locale = 'fr')  AS clients_en_francais;

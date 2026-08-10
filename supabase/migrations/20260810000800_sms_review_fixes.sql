-- ============================================================
-- SMS — Lot 9 : corrections issues de la revue.
--
--   1. Course sur le compteur d'essais du code de vérification
--   2. Numéros jamais confirmés : possibilité d'exiger la vérification
--   4. Étiquette @mola manquante sur sms_locale_for_country
--
-- (Les points 3 et 5 de la revue portent sur le webhook et les gabarits,
--  corrigés hors migration.)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le compteur d'essais doit être à l'abri des appels concurrents
--
-- LE DÉFAUT : la ligne était lue SANS verrou, le plafond vérifié sur la
-- valeur lue, et l'incrément appliqué ensuite. Deux confirmations lancées
-- en parallèle lisaient donc le même `attempts`, passaient toutes deux le
-- contrôle, et consommaient chacune un essai — en rafale, on dépasse
-- largement les 5 tentatives annoncées.
--
-- Le dépôt applique déjà ce patron sur les paiements (SELECT FOR UPDATE
-- avant toute déduction de solde) ; il manquait ici.
--
-- LA CORRECTION : FOR UPDATE sur la ligne. Une seconde transaction attend
-- la première, puis relit un `attempts` à jour. Le plafond redevient un
-- vrai plafond.
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

  -- FOR UPDATE : sérialise les confirmations concurrentes du même client.
  SELECT * INTO v_row
    FROM public.phone_verifications
   WHERE user_id = v_uid AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

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

-- ------------------------------------------------------------
-- 2. Pouvoir exiger un numéro confirmé, gabarit par gabarit
--
-- LE RISQUE : la reprise des numéros historiques recopie `clients.phone`
-- vers `phone_e164` sans que personne n'ait jamais confirmé que ce numéro
-- appartient encore au client. Un numéro périmé, réattribué par l'opérateur
-- ou simplement mal saisi reçoit alors des montants, des soldes et des
-- références — c'est-à-dire une divulgation à un tiers.
--
-- POURQUOI CE N'EST PAS ACTIVÉ D'OFFICE : aujourd'hui AUCUN numéro n'est
-- confirmé (l'écran de vérification n'existe pas encore). Exiger la
-- confirmation maintenant reviendrait à ne plus rien envoyer à personne.
-- On installe donc le mécanisme, désactivé, plutôt que de laisser le sujet
-- sans réponse possible.
--
-- À BASCULER dès que l'écran de vérification sera livré :
--   UPDATE public.sms_template_map SET requires_verified_phone = true
--    WHERE category = 'transactional';
-- ------------------------------------------------------------
ALTER TABLE public.sms_template_map
  ADD COLUMN IF NOT EXISTS requires_verified_phone BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sms_template_map.requires_verified_phone IS
  'true ⇒ n''envoyer qu''aux numéros confirmés (clients.phone_verified_at non nul). Faux par défaut : sans écran de vérification, l''exiger bloquerait tous les envois.';

-- Trace d'audit : on sait, message par message, si le numéro avait été
-- confirmé au moment de l'envoi.
ALTER TABLE public.sms_outbox
  ADD COLUMN IF NOT EXISTS recipient_verified BOOLEAN;

COMMENT ON COLUMN public.sms_outbox.recipient_verified IS
  'Le numéro destinataire était-il confirmé à l''enfilement ? Permet de mesurer l''exposition avant de basculer requires_verified_phone.';

-- ------------------------------------------------------------
-- Résolution du destinataire, en un seul endroit
--
-- Les trois points d'enfilement (trigger sur notifications, accusé de
-- dépôt, relance) dupliquaient la même logique. Une règle de sécurité
-- ajoutée à un seul des trois serait un trou silencieux : on centralise.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sms_recipient(
  p_user_id           UUID,
  p_notification_type TEXT
)
RETURNS TABLE (
  phone      TEXT,
  country    TEXT,
  locale     TEXT,
  first_name TEXT,
  verified   BOOLEAN,
  status     TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category  TEXT;
  v_requires  BOOLEAN;
  c           public.clients%ROWTYPE;
BEGIN
  SELECT m.category, m.requires_verified_phone
    INTO v_category, v_requires
    FROM public.sms_template_map m
   WHERE m.notification_type = p_notification_type;

  SELECT * INTO c FROM public.clients WHERE user_id = p_user_id;

  phone      := c.phone_e164;
  country    := c.phone_country;
  locale     := coalesce(c.preferred_locale, public.sms_locale_for_country(c.phone_country), 'fr');
  first_name := nullif(trim(coalesce(c.first_name, '')), '');
  verified   := c.phone_verified_at IS NOT NULL;

  status := CASE
    WHEN phone IS NULL OR phone = ''                                THEN 'skipped'
    WHEN v_category = 'marketing' AND c.sms_marketing_opt_in IS NOT TRUE THEN 'skipped'
    WHEN v_requires IS TRUE AND NOT verified                        THEN 'skipped'
    ELSE 'pending'
  END;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.sms_recipient(UUID, TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Résoudre le destinataire SMS d''un client (interne)"}';

REVOKE ALL ON FUNCTION public.sms_recipient(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sms_recipient(UUID, TEXT) TO service_role;

-- ── Les trois points d'enfilement passent par le résolveur commun ────────

CREATE OR REPLACE FUNCTION public.enqueue_sms_from_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template TEXT;
  v_category TEXT;
  v_enabled  BOOLEAN;
  r          RECORD;
  v_entity   UUID;
BEGIN
  BEGIN
    SELECT template, category, enabled
      INTO v_template, v_category, v_enabled
      FROM public.sms_template_map
     WHERE notification_type = NEW.type;

    IF v_template IS NULL OR v_enabled IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    SELECT * INTO r FROM public.sms_recipient(NEW.user_id, NEW.type);

    v_entity := COALESCE(
      NULLIF(NEW.metadata ->> 'deposit_id', ''),
      NULLIF(NEW.metadata ->> 'payment_id', '')
    )::uuid;

    INSERT INTO public.sms_outbox (
      event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
      recipient_verified, locale, template, category, payload, status, idempotency_key
    ) VALUES (
      NEW.type, v_entity, NEW.user_id, r.phone, r.country, r.verified,
      r.locale, v_template, v_category,
      COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('first_name', r.first_name),
      r.status,
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

CREATE OR REPLACE FUNCTION public.enqueue_deposit_ack_sms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  r         RECORD;
BEGIN
  BEGIN
    SELECT enabled INTO v_enabled
      FROM public.sms_template_map WHERE notification_type = 'deposit_created';
    IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

    SELECT * INTO r FROM public.sms_recipient(NEW.user_id, 'deposit_created');

    INSERT INTO public.sms_outbox (
      event_type, entity_id, recipient_user_id, recipient_phone, recipient_country,
      recipient_verified, locale, template, category, payload, status, idempotency_key
    ) VALUES (
      'deposit_created', NEW.id, NEW.user_id, r.phone, r.country, r.verified,
      r.locale, 'deposit_created', 'transactional',
      jsonb_build_object(
        'reference',  NEW.reference,
        'amount_xaf', NEW.amount_xaf,
        'first_name', r.first_name
      ),
      r.status,
      'smsdepositack:' || NEW.id::text
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'enqueue_deposit_ack_sms: dépôt % : %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

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
    recipient_verified, locale, template, category, payload, status, idempotency_key
  )
  SELECT
    'deposit_awaiting_proof', d.id, d.user_id,
    r.phone, r.country, r.verified, r.locale,
    'deposit_awaiting_proof', 'transactional',
    jsonb_build_object(
      'reference',  d.reference,
      'amount_xaf', d.amount_xaf,
      'first_name', r.first_name
    ),
    r.status,
    'smsdepositreminder:' || d.id::text
  FROM public.deposits d
  CROSS JOIN LATERAL public.sms_recipient(d.user_id, 'deposit_awaiting_proof') r
  WHERE d.status IN ('created', 'awaiting_proof')
    AND d.created_at < now() - interval '24 hours'
    AND d.created_at > now() - interval '3 days'
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.run_sms_deposit_reminders() IS
  '@mola:{"expose":false,"kind":"write","permission":"canProcessDeposits","confirm":false,"danger":false,"label":"Relancer par SMS les dépôts sans preuve (interne, cron)"}';

-- ------------------------------------------------------------
-- 4. Étiquette @mola sur sms_locale_for_country
--
-- La fonction est exécutable via PostgREST : c'est donc une RPC au sens de
-- la plateforme, et le CLAUDE.md impose une étiquette à toute RPC — y
-- compris interne, où `expose:false` documente le choix. Un seul COMMENT
-- par fonction : l'étiquette remplace le commentaire en prose, qu'elle
-- écraserait de toute façon.
-- ------------------------------------------------------------
COMMENT ON FUNCTION public.sms_locale_for_country(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Langue SMS par défaut déduite du pays du numéro (repli interne)"}';

NOTIFY pgrst, 'reload schema';

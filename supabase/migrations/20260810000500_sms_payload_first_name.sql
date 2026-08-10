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

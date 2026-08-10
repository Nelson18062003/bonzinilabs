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

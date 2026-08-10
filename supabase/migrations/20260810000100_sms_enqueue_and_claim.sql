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

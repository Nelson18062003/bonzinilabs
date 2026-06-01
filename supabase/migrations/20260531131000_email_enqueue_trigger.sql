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

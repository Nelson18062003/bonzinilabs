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

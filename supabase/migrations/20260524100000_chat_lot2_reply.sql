-- ============================================================
-- Chat Support Lot 2 — Reply to message (citation/quoted reply)
--
-- Permet de répondre à un message précis dans la conversation
-- (style WhatsApp : appui long → Reply → la réponse cite l'original).
--
-- Comportement attendu :
--   - reply_to_message_id pointe vers un autre chat_messages.id
--   - ON DELETE SET NULL : si l'original est supprimé (peu probable
--     puisqu'on n'a pas de DELETE policy au Lot 1, mais safety net),
--     la réponse reste visible sans casser
--   - Contrainte : reply_to ne peut pas pointer vers lui-même
--   - Le message cité doit appartenir à la MÊME conversation
--     (vérifié par trigger applicatif pour rester simple)
-- ============================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID
  REFERENCES public.chat_messages(id) ON DELETE SET NULL;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_no_self_reply
  CHECK (reply_to_message_id IS NULL OR reply_to_message_id <> id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
  ON public.chat_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- Trigger : empêche de répondre à un message d'une autre conversation.
CREATE OR REPLACE FUNCTION public.validate_chat_reply_same_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_target_conv UUID;
BEGIN
  IF NEW.reply_to_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT conversation_id INTO v_target_conv
  FROM public.chat_messages
  WHERE id = NEW.reply_to_message_id;

  IF v_target_conv IS NULL THEN
    -- Le message cité a été supprimé entre temps ; on accepte (ON DELETE SET NULL).
    NEW.reply_to_message_id := NULL;
    RETURN NEW;
  END IF;

  IF v_target_conv <> NEW.conversation_id THEN
    RAISE EXCEPTION 'Cannot reply to a message from another conversation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_msg_validate_reply
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_chat_reply_same_conversation();

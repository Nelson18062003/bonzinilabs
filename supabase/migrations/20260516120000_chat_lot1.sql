-- ============================================================
-- Chat Support Lot 1 — Texte + photos
--
-- Tables:
--   chat_conversations (1 par client via UNIQUE)
--   chat_messages       (immuables, pas d'UPDATE/DELETE)
--
-- RLS:
--   Client voit/écrit dans SA conversation uniquement
--   Admin support (super_admin/ops/support/customer_success)
--     voit/écrit dans toutes les conversations
--
-- RPCs:
--   mark_conversation_read_client(uuid)
--   mark_conversation_read_admin(uuid)
--   chat_avg_response_seconds_today()
--
-- Storage:
--   Bucket privé chat-media (5 MB max, JPG/PNG/WebP)
--   Path convention: {conversation_id}/{filename}
--
-- Realtime:
--   chat_messages + chat_conversations ajoutés à supabase_realtime
--
-- Notification Telegram aux admins:
--   À configurer manuellement via Supabase Dashboard
--   → Database Webhooks → New Webhook
--   Table: chat_messages, Event: INSERT
--   Filter: sender_type = client
--   HTTP POST → Edge Function notify-admin-telegram
--   (pg_net non activé sur ce projet, donc pas de trigger SQL direct)
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  last_message_at TIMESTAMPTZ,
  last_client_message_at TIMESTAMPTZ,
  last_admin_message_at TIMESTAMPTZ,
  unread_count_client INTEGER NOT NULL DEFAULT 0,
  unread_count_admin INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversations_client_unique UNIQUE (client_id)
);

CREATE INDEX idx_chat_conv_status_lastmsg
  ON public.chat_conversations (status, last_message_at DESC NULLS LAST)
  WHERE status = 'open';

CREATE INDEX idx_chat_conv_unread_admin
  ON public.chat_conversations (unread_count_admin DESC, last_client_message_at DESC)
  WHERE unread_count_admin > 0;

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin')),
  sender_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_content_or_media CHECK (
    content IS NOT NULL OR media_url IS NOT NULL
  ),
  CONSTRAINT chat_messages_content_length CHECK (
    content IS NULL OR char_length(content) <= 2000
  )
);

CREATE INDEX idx_chat_messages_conv_created
  ON public.chat_messages (conversation_id, created_at DESC);

CREATE INDEX idx_chat_messages_unread
  ON public.chat_messages (conversation_id, sender_type, read_at)
  WHERE read_at IS NULL;

-- ── Trigger: mise à jour compteurs et timestamps ───────────

CREATE OR REPLACE FUNCTION public.update_chat_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_type = 'client' THEN
    UPDATE public.chat_conversations
    SET last_message_at = NEW.created_at,
        last_client_message_at = NEW.created_at,
        unread_count_admin = unread_count_admin + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.chat_conversations
    SET last_message_at = NEW.created_at,
        last_admin_message_at = NEW.created_at,
        unread_count_client = unread_count_client + 1,
        updated_at = now()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_msg_update_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_conversation_on_message();

-- ── Helper: rôle support ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_support_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'ops', 'support', 'customer_success')
      AND (is_disabled = false OR is_disabled IS NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_support_admin(UUID) TO authenticated;

-- ── RLS: chat_conversations ─────────────────────────────────

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_conv_select_client
  ON public.chat_conversations FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY chat_conv_select_admin
  ON public.chat_conversations FOR SELECT
  USING (public.is_support_admin(auth.uid()));

CREATE POLICY chat_conv_insert_client
  ON public.chat_conversations FOR INSERT
  WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- Pas de UPDATE direct — uniquement via trigger ou RPCs ci-dessous.

-- ── RLS: chat_messages ──────────────────────────────────────

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_msg_select_client
  ON public.chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.chat_conversations
      WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

CREATE POLICY chat_msg_select_admin
  ON public.chat_messages FOR SELECT
  USING (public.is_support_admin(auth.uid()));

CREATE POLICY chat_msg_insert_client
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_type = 'client'
    AND sender_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    AND conversation_id IN (
      SELECT id FROM public.chat_conversations
      WHERE client_id = sender_id AND status = 'open'
    )
  );

CREATE POLICY chat_msg_insert_admin
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_type = 'admin'
    AND sender_id = auth.uid()
    AND public.is_support_admin(auth.uid())
  );

-- Pas de UPDATE/DELETE → messages immuables.

-- ── RPCs: marquage lu ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_conversation_read_client(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
BEGIN
  SELECT id INTO v_client_id FROM public.clients WHERE user_id = auth.uid();
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Not a client';
  END IF;

  UPDATE public.chat_conversations
  SET unread_count_client = 0,
      updated_at = now()
  WHERE id = p_conversation_id AND client_id = v_client_id;

  UPDATE public.chat_messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_type = 'admin'
    AND read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read_admin(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a support admin';
  END IF;

  UPDATE public.chat_conversations
  SET unread_count_admin = 0,
      updated_at = now()
  WHERE id = p_conversation_id;

  UPDATE public.chat_messages
  SET read_at = now()
  WHERE conversation_id = p_conversation_id
    AND sender_type = 'client'
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read_client(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read_admin(UUID) TO authenticated;

-- ── RPC: temps de réponse moyen aujourd'hui ────────────────

CREATE OR REPLACE FUNCTION public.chat_avg_response_seconds_today()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    AVG(EXTRACT(EPOCH FROM (admin_reply.created_at - client_msg.created_at)))::INTEGER,
    300
  )
  FROM public.chat_messages client_msg
  JOIN LATERAL (
    SELECT created_at FROM public.chat_messages
    WHERE conversation_id = client_msg.conversation_id
      AND sender_type = 'admin'
      AND created_at > client_msg.created_at
    ORDER BY created_at ASC
    LIMIT 1
  ) AS admin_reply ON true
  WHERE client_msg.sender_type = 'client'
    AND client_msg.created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Douala');
$$;

GRANT EXECUTE ON FUNCTION public.chat_avg_response_seconds_today() TO authenticated, anon;

-- ── Storage: bucket chat-media ──────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY chat_media_select
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-media'
    AND (
      (storage.foldername(name))[1]::UUID IN (
        SELECT id FROM public.chat_conversations
        WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      )
      OR public.is_support_admin(auth.uid())
    )
  );

CREATE POLICY chat_media_insert_client
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1]::UUID IN (
      SELECT id FROM public.chat_conversations
      WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    )
  );

CREATE POLICY chat_media_insert_admin
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media'
    AND public.is_support_admin(auth.uid())
  );

-- ── Realtime ────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

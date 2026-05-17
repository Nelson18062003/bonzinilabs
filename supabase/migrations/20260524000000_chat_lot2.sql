-- ============================================================
-- Chat Support Lot 2 — Voice, vidéo, fichiers, typing, read receipts
--
-- Changements:
--   1. Étend l'enum media_type : voice, video, file
--   2. Nouvelles colonnes meta : duration, size, filename, waveform peaks
--   3. Bucket élargi à 25 MB + nouveaux MIME (audio/video/pdf/docx/xlsx)
--   4. RPC mark_message_read pour read receipt granulaire
-- ============================================================

-- ── 1. Étendre la contrainte media_type ─────────────────────

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_media_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_media_type_check
  CHECK (media_type IN ('image', 'voice', 'video', 'file'));

-- ── 2. Nouvelles colonnes meta ──────────────────────────────

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS media_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS media_size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_waveform_peaks REAL[];

-- Contraintes : duration / size positives quand renseignées
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_duration_positive
  CHECK (media_duration_seconds IS NULL OR media_duration_seconds > 0);

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_size_positive
  CHECK (media_size_bytes IS NULL OR media_size_bytes > 0);

-- ── 3. Bucket storage : élargir limites et MIME types ───────

UPDATE storage.buckets
SET file_size_limit = 26214400,  -- 25 MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp',
      'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/aac',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.ms-excel'
    ]
WHERE id = 'chat-media';

-- ── 4. RPC mark_message_read (read receipt granulaire) ──────

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg_sender_type TEXT;
  v_msg_conversation_id UUID;
  v_conv_client_id UUID;
  v_is_recipient BOOLEAN := false;
BEGIN
  SELECT m.sender_type, m.conversation_id, c.client_id
  INTO v_msg_sender_type, v_msg_conversation_id, v_conv_client_id
  FROM public.chat_messages m
  JOIN public.chat_conversations c ON c.id = m.conversation_id
  WHERE m.id = p_message_id;

  IF v_msg_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Le client peut marquer comme lu un message admin de SA conversation
  IF v_msg_sender_type = 'admin' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = v_conv_client_id AND user_id = auth.uid()
    ) INTO v_is_recipient;
  -- L'admin support peut marquer comme lu un message client
  ELSIF v_msg_sender_type = 'client' THEN
    v_is_recipient := public.is_support_admin(auth.uid());
  END IF;

  IF NOT v_is_recipient THEN
    RAISE EXCEPTION 'Not authorized to mark this message as read';
  END IF;

  UPDATE public.chat_messages
  SET read_at = now()
  WHERE id = p_message_id AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_message_read(UUID) TO authenticated;

-- ── 5. Note: pas besoin de toucher à supabase_realtime ──────
-- La publication créée au Lot 1 supporte déjà tous les events
-- (INSERT, UPDATE, DELETE) sur chat_messages. Le frontend
-- s'abonne à 'UPDATE' en plus du 'INSERT' du Lot 1.

-- ============================================================
-- Chat Support Lots 3 + 4 — Outillage admin + confort client
--
-- Features couvertes :
--   A. Templates (chat_canned_responses)
--   B. Assignation conversation → admin
--   C. Recherche full-text (index GIN)
--   D. Statistiques admin (vues + RPC)
--   E. Fermeture / archivage (status + auto-réouverture)
--   F. Multi-thread (drop UNIQUE + subject column)
--   G. Quick replies clients (chat_client_quick_replies)
--   H. Réactions emoji (chat_message_reactions)
-- ============================================================

-- ── F. Multi-thread : drop UNIQUE + add subject ─────────────

ALTER TABLE public.chat_conversations
  DROP CONSTRAINT IF EXISTS chat_conversations_client_unique;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS subject TEXT;

-- Index sur (client_id, last_message_at) pour la liste côté client
CREATE INDEX IF NOT EXISTS idx_chat_conv_client_lastmsg
  ON public.chat_conversations (client_id, last_message_at DESC NULLS LAST);

-- ── B. Assignation conversation ────────────────────────────

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID
  REFERENCES public.user_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conv_assigned
  ON public.chat_conversations (assigned_admin_id, last_message_at DESC NULLS LAST)
  WHERE assigned_admin_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_chat_conversation(
  p_conversation_id UUID,
  p_admin_user_role_id UUID
)
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
  SET assigned_admin_id = p_admin_user_role_id,
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_chat_conversation(UUID, UUID) TO authenticated;

-- Pour qu'un admin se prenne à lui-même une conv (utilise son own user_roles.id)
CREATE OR REPLACE FUNCTION public.claim_chat_conversation(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  IF NOT public.is_support_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a support admin';
  END IF;

  SELECT id INTO v_admin_id
  FROM public.user_roles
  WHERE user_id = auth.uid();

  UPDATE public.chat_conversations
  SET assigned_admin_id = v_admin_id,
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_chat_conversation(UUID) TO authenticated;

-- ── E. Fermeture / archivage avec auto-réouverture ─────────

CREATE OR REPLACE FUNCTION public.close_chat_conversation(p_conversation_id UUID)
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
  SET status = 'closed', updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_chat_conversation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_chat_conversation(p_conversation_id UUID)
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
  SET status = 'open', updated_at = now()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_chat_conversation(UUID) TO authenticated;

-- Trigger : si un message est inséré dans une conv 'closed', la rouvrir
CREATE OR REPLACE FUNCTION public.auto_reopen_chat_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET status = 'open', updated_at = now()
  WHERE id = NEW.conversation_id AND status = 'closed';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_msg_auto_reopen ON public.chat_messages;
CREATE TRIGGER trg_chat_msg_auto_reopen
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_reopen_chat_on_message();

-- On doit aussi mettre à jour les RLS pour permettre l'INSERT du client
-- même si status='closed' (sinon impossible de rouvrir).
-- L'auto_reopen trigger se charge de remettre status='open'.
DROP POLICY IF EXISTS chat_msg_insert_client ON public.chat_messages;
CREATE POLICY chat_msg_insert_client
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_type = 'client'
    AND sender_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    AND conversation_id IN (
      SELECT id FROM public.chat_conversations
      WHERE client_id = sender_id
      -- pas de filtre status='open' : on autorise même closed pour permettre l'auto-réouverture
    )
  );

-- ── A. Templates (Canned Responses) ────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_canned_label_length CHECK (char_length(label) BETWEEN 1 AND 60),
  CONSTRAINT chat_canned_content_length CHECK (char_length(content) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_chat_canned_sort
  ON public.chat_canned_responses (sort_order ASC, created_at DESC);

ALTER TABLE public.chat_canned_responses ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les admins support
CREATE POLICY chat_canned_select_admin
  ON public.chat_canned_responses FOR SELECT
  USING (public.is_support_admin(auth.uid()));

-- Création / update / delete : restreint super_admin (les autres voient et utilisent)
CREATE POLICY chat_canned_write_super_admin
  ON public.chat_canned_responses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND (is_disabled = false OR is_disabled IS NULL)
    )
  );

-- ── C. Recherche full-text ─────────────────────────────────

-- Index GIN sur le contenu des messages (utilise 'simple' pour cover toutes les langues)
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_fts
  ON public.chat_messages
  USING gin (to_tsvector('simple', coalesce(content, '')));

-- RPC : recherche par mot-clé, retourne les conversations matchantes avec snippet
CREATE OR REPLACE FUNCTION public.search_chat_conversations(p_query TEXT)
RETURNS TABLE (
  conversation_id UUID,
  client_id UUID,
  client_first_name TEXT,
  client_last_name TEXT,
  match_count BIGINT,
  last_match_at TIMESTAMPTZ,
  snippet TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a support admin';
  END IF;

  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matches AS (
    SELECT
      m.conversation_id,
      m.content,
      m.created_at,
      ROW_NUMBER() OVER (PARTITION BY m.conversation_id ORDER BY m.created_at DESC) AS rn,
      COUNT(*) OVER (PARTITION BY m.conversation_id) AS match_count
    FROM public.chat_messages m
    WHERE to_tsvector('simple', coalesce(m.content, '')) @@ plainto_tsquery('simple', p_query)
       OR m.content ILIKE '%' || p_query || '%'
  )
  SELECT
    matches.conversation_id,
    c.client_id,
    cl.first_name,
    cl.last_name,
    matches.match_count,
    matches.created_at,
    matches.content
  FROM matches
  JOIN public.chat_conversations c ON c.id = matches.conversation_id
  JOIN public.clients cl ON cl.id = c.client_id
  WHERE matches.rn = 1
  ORDER BY matches.created_at DESC
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_chat_conversations(TEXT) TO authenticated;

-- ── D. Statistiques admin ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_chat_admin_stats(p_period_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  IF NOT public.is_support_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a support admin';
  END IF;

  v_period_start := now() - (p_period_days || ' days')::interval;

  WITH msgs AS (
    SELECT * FROM public.chat_messages
    WHERE created_at >= v_period_start
  ),
  per_admin AS (
    -- Temps de réponse moyen par admin sur les paires client→admin
    SELECT
      m_admin.sender_id AS admin_user_id,
      COUNT(*) AS replies_count,
      AVG(EXTRACT(EPOCH FROM (m_admin.created_at - m_client.created_at)))::INTEGER AS avg_response_seconds
    FROM msgs m_admin
    JOIN LATERAL (
      SELECT created_at FROM public.chat_messages prev
      WHERE prev.conversation_id = m_admin.conversation_id
        AND prev.sender_type = 'client'
        AND prev.created_at < m_admin.created_at
      ORDER BY prev.created_at DESC
      LIMIT 1
    ) m_client ON true
    WHERE m_admin.sender_type = 'admin'
    GROUP BY m_admin.sender_id
  ),
  per_admin_with_name AS (
    SELECT
      pa.admin_user_id,
      ur.first_name,
      ur.last_name,
      pa.replies_count,
      pa.avg_response_seconds
    FROM per_admin pa
    LEFT JOIN public.user_roles ur ON ur.user_id = pa.admin_user_id
  )
  SELECT jsonb_build_object(
    'period_days', p_period_days,
    'open_conversations', (SELECT COUNT(*) FROM public.chat_conversations WHERE status = 'open'),
    'closed_conversations', (SELECT COUNT(*) FROM public.chat_conversations WHERE status = 'closed'),
    'unassigned_open', (SELECT COUNT(*) FROM public.chat_conversations WHERE status = 'open' AND assigned_admin_id IS NULL),
    'total_messages', (SELECT COUNT(*) FROM msgs),
    'client_messages', (SELECT COUNT(*) FROM msgs WHERE sender_type = 'client'),
    'admin_messages', (SELECT COUNT(*) FROM msgs WHERE sender_type = 'admin'),
    'avg_response_seconds_global', (
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (m_admin.created_at - m_client.created_at)))::INTEGER, 0)
      FROM msgs m_admin
      JOIN LATERAL (
        SELECT created_at FROM public.chat_messages prev
        WHERE prev.conversation_id = m_admin.conversation_id
          AND prev.sender_type = 'client'
          AND prev.created_at < m_admin.created_at
        ORDER BY prev.created_at DESC LIMIT 1
      ) m_client ON true
      WHERE m_admin.sender_type = 'admin'
    ),
    'per_admin', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'admin_user_id', admin_user_id,
          'first_name', first_name,
          'last_name', last_name,
          'replies_count', replies_count,
          'avg_response_seconds', avg_response_seconds
        ) ORDER BY replies_count DESC
      ), '[]'::jsonb)
      FROM per_admin_with_name
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_admin_stats(INTEGER) TO authenticated;

-- ── G. Quick replies clients ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_client_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_quick_label_length CHECK (char_length(label) BETWEEN 1 AND 40),
  CONSTRAINT chat_quick_content_length CHECK (char_length(content) BETWEEN 1 AND 500)
);

ALTER TABLE public.chat_client_quick_replies ENABLE ROW LEVEL SECURITY;

-- Lecture : tout authenticated (clients + admins) voit les actifs
CREATE POLICY chat_quick_select_all
  ON public.chat_client_quick_replies FOR SELECT
  USING (active = true OR public.is_support_admin(auth.uid()));

-- Création / update / delete : super_admin uniquement
CREATE POLICY chat_quick_write_super_admin
  ON public.chat_client_quick_replies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND (is_disabled = false OR is_disabled IS NULL)
    )
  );

-- Seed initial (4 quick replies par défaut, FR)
INSERT INTO public.chat_client_quick_replies (label, content, sort_order)
VALUES
  ('Comment ça marche ?', 'Bonjour, pouvez-vous m''expliquer comment fonctionne Bonzini ?', 1),
  ('Mon paiement est en retard', 'Bonjour, mon paiement semble en retard, pouvez-vous vérifier ?', 2),
  ('Question sur les taux', 'Bonjour, j''ai une question sur les taux de change appliqués.', 3),
  ('Autre question', 'Bonjour, j''ai une question :', 4)
ON CONFLICT DO NOTHING;

-- ── H. Réactions emoji ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'admin')),
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_react_unique UNIQUE (message_id, user_id, emoji),
  CONSTRAINT chat_react_emoji_whitelist CHECK (emoji IN ('👍', '❤️', '✅', '😂', '😮', '🙏'))
);

CREATE INDEX IF NOT EXISTS idx_chat_react_message
  ON public.chat_message_reactions (message_id);

ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- Lecture : si on peut voir le message, on peut voir ses réactions
CREATE POLICY chat_react_select_client
  ON public.chat_message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT id FROM public.chat_messages
      WHERE conversation_id IN (
        SELECT id FROM public.chat_conversations
        WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY chat_react_select_admin
  ON public.chat_message_reactions FOR SELECT
  USING (public.is_support_admin(auth.uid()));

-- Insertion : on peut réagir à un message qu'on peut voir
CREATE POLICY chat_react_insert_client
  ON public.chat_message_reactions FOR INSERT
  WITH CHECK (
    sender_type = 'client'
    AND user_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    AND message_id IN (
      SELECT id FROM public.chat_messages
      WHERE conversation_id IN (
        SELECT id FROM public.chat_conversations
        WHERE client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
      )
    )
  );

CREATE POLICY chat_react_insert_admin
  ON public.chat_message_reactions FOR INSERT
  WITH CHECK (
    sender_type = 'admin'
    AND user_id = auth.uid()
    AND public.is_support_admin(auth.uid())
  );

-- Suppression : on peut retirer SA propre réaction
CREATE POLICY chat_react_delete_self_client
  ON public.chat_message_reactions FOR DELETE
  USING (
    sender_type = 'client'
    AND user_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY chat_react_delete_self_admin
  ON public.chat_message_reactions FOR DELETE
  USING (
    sender_type = 'admin'
    AND user_id = auth.uid()
  );

-- Realtime sur les réactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;

-- ============================================================
-- Chat Support Lots 3+4 — Extensions "version complète"
--
-- Ajouts :
--   1. Table chat_assignment_events (historique audit)
--   2. RPC get_chat_admin_stats étendue : daily volume series +
--      response time distribution buckets
--   3. RPC reorder_canned_responses(ids uuid[])
--   4. RPC reorder_quick_replies(ids uuid[])
-- ============================================================

-- ── 1. Historique des assignations ──────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  previous_admin_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  new_admin_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  changed_by_admin_id UUID REFERENCES public.user_roles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('claim', 'assign', 'unassign')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_assignment_events_conv
  ON public.chat_assignment_events (conversation_id, created_at DESC);

ALTER TABLE public.chat_assignment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_assignment_events_select_admin
  ON public.chat_assignment_events FOR SELECT
  USING (public.is_support_admin(auth.uid()));

-- Insertion uniquement via les RPCs (pas de policy INSERT)

-- ── Mise à jour RPCs claim + assign pour logger l'historique ─

CREATE OR REPLACE FUNCTION public.claim_chat_conversation(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_previous_admin UUID;
BEGIN
  IF NOT public.is_support_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a support admin';
  END IF;

  SELECT id INTO v_admin_id
  FROM public.user_roles
  WHERE user_id = auth.uid();

  SELECT assigned_admin_id INTO v_previous_admin
  FROM public.chat_conversations
  WHERE id = p_conversation_id;

  UPDATE public.chat_conversations
  SET assigned_admin_id = v_admin_id,
      updated_at = now()
  WHERE id = p_conversation_id;

  -- Pas de log si on prend une conv déjà à soi
  IF v_previous_admin IS DISTINCT FROM v_admin_id THEN
    INSERT INTO public.chat_assignment_events
      (conversation_id, previous_admin_id, new_admin_id, changed_by_admin_id, event_type)
    VALUES (p_conversation_id, v_previous_admin, v_admin_id, v_admin_id, 'claim');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_chat_conversation(
  p_conversation_id UUID,
  p_admin_user_role_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changer_admin_id UUID;
  v_previous_admin UUID;
BEGIN
  IF NOT public.is_support_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not a support admin';
  END IF;

  SELECT id INTO v_changer_admin_id
  FROM public.user_roles
  WHERE user_id = auth.uid();

  SELECT assigned_admin_id INTO v_previous_admin
  FROM public.chat_conversations
  WHERE id = p_conversation_id;

  UPDATE public.chat_conversations
  SET assigned_admin_id = p_admin_user_role_id,
      updated_at = now()
  WHERE id = p_conversation_id;

  IF v_previous_admin IS DISTINCT FROM p_admin_user_role_id THEN
    INSERT INTO public.chat_assignment_events
      (conversation_id, previous_admin_id, new_admin_id, changed_by_admin_id, event_type)
    VALUES (
      p_conversation_id,
      v_previous_admin,
      p_admin_user_role_id,
      v_changer_admin_id,
      CASE WHEN p_admin_user_role_id IS NULL THEN 'unassign' ELSE 'assign' END
    );
  END IF;
END;
$$;

-- ── 2. RPC stats étendue avec séries quotidiennes + distribution ──

DROP FUNCTION IF EXISTS public.get_chat_admin_stats(INTEGER);

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

  v_period_start := date_trunc('day', now() AT TIME ZONE 'Africa/Douala')
                  - ((p_period_days - 1) || ' days')::interval;

  WITH msgs AS (
    SELECT * FROM public.chat_messages
    WHERE created_at >= v_period_start
  ),
  per_admin AS (
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
      ORDER BY prev.created_at DESC LIMIT 1
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
  ),
  -- Daily volume series : génère les N derniers jours et compte par sender_type
  day_series AS (
    SELECT (v_period_start + (i || ' days')::interval)::date AS d
    FROM generate_series(0, p_period_days - 1) AS i
  ),
  daily_volume AS (
    SELECT
      ds.d AS day,
      COALESCE(SUM(CASE WHEN m.sender_type = 'client' THEN 1 ELSE 0 END), 0)::INTEGER AS client_count,
      COALESCE(SUM(CASE WHEN m.sender_type = 'admin'  THEN 1 ELSE 0 END), 0)::INTEGER AS admin_count
    FROM day_series ds
    LEFT JOIN msgs m
      ON (m.created_at AT TIME ZONE 'Africa/Douala')::date = ds.d
    GROUP BY ds.d
    ORDER BY ds.d
  ),
  -- Distribution temps de réponse en 4 buckets
  response_times AS (
    SELECT EXTRACT(EPOCH FROM (m_admin.created_at - m_client.created_at))::INTEGER AS sec
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
  response_buckets AS (
    SELECT
      COUNT(*) FILTER (WHERE sec < 60)              AS under_1min,
      COUNT(*) FILTER (WHERE sec >= 60   AND sec < 300)   AS one_to_five,
      COUNT(*) FILTER (WHERE sec >= 300  AND sec < 900)   AS five_to_fifteen,
      COUNT(*) FILTER (WHERE sec >= 900)            AS over_fifteen
    FROM response_times
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
      SELECT COALESCE(AVG(sec)::INTEGER, 0) FROM response_times
    ),
    'median_response_seconds_global', (
      SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY sec)::INTEGER, 0) FROM response_times
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
    ),
    'daily_volume', (
      SELECT jsonb_agg(jsonb_build_object(
        'day', day,
        'client_count', client_count,
        'admin_count', admin_count
      ) ORDER BY day)
      FROM daily_volume
    ),
    'response_buckets', (
      SELECT jsonb_build_object(
        'under_1min', under_1min,
        'one_to_five', one_to_five,
        'five_to_fifteen', five_to_fifteen,
        'over_fifteen', over_fifteen
      ) FROM response_buckets
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_admin_stats(INTEGER) TO authenticated;

-- ── 3. RPC reorder_canned_responses ──────────────────────────

CREATE OR REPLACE FUNCTION public.reorder_canned_responses(p_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_order INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
      AND (is_disabled = false OR is_disabled IS NULL)
  ) THEN
    RAISE EXCEPTION 'Only super_admin can reorder';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    UPDATE public.chat_canned_responses
    SET sort_order = v_order, updated_at = now()
    WHERE id = v_id;
    v_order := v_order + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_canned_responses(UUID[]) TO authenticated;

-- ── 4. RPC reorder_quick_replies ─────────────────────────────

CREATE OR REPLACE FUNCTION public.reorder_quick_replies(p_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_order INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
      AND (is_disabled = false OR is_disabled IS NULL)
  ) THEN
    RAISE EXCEPTION 'Only super_admin can reorder';
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    UPDATE public.chat_client_quick_replies
    SET sort_order = v_order, updated_at = now()
    WHERE id = v_id;
    v_order := v_order + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_quick_replies(UUID[]) TO authenticated;

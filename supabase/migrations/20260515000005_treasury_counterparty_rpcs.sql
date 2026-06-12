-- ============================================================
-- Treasury Lot 4 — Counterparty CRUD RPCs
--
-- treasury_counterparties writes go through SECURITY DEFINER
-- RPCs to keep the policy surface uniform (Lot 1 set the table
-- to SELECT-only via RLS). Three operations:
--   * create
--   * update (no destructive deletes ever — soft archive instead)
--   * toggle is_active / soft archive
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_treasury_counterparty(
  p_type         public.treasury_counterparty_type,
  p_display_name TEXT,
  p_legal_name   TEXT DEFAULT NULL,
  p_phone        TEXT DEFAULT NULL,
  p_wechat_id    TEXT DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_id      UUID;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  IF p_display_name IS NULL OR length(trim(p_display_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nom requis (2 caracteres min)');
  END IF;

  INSERT INTO public.treasury_counterparties (
    type, display_name, legal_name, phone, wechat_id, notes, created_by
  ) VALUES (
    p_type,
    trim(p_display_name),
    NULLIF(trim(p_legal_name), ''),
    NULLIF(trim(p_phone), ''),
    NULLIF(trim(p_wechat_id), ''),
    NULLIF(trim(p_notes), ''),
    v_user_id
  )
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'create_treasury_counterparty', 'treasury_counterparty', v_id,
    jsonb_build_object('type', p_type, 'display_name', p_display_name));

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_treasury_counterparty(
  p_id           UUID,
  p_display_name TEXT DEFAULT NULL,
  p_legal_name   TEXT DEFAULT NULL,
  p_phone        TEXT DEFAULT NULL,
  p_wechat_id    TEXT DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL,
  p_is_active    BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_row     public.treasury_counterparties%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF NOT public.can_access_treasury(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acces tresorerie refuse');
  END IF;

  SELECT * INTO v_row FROM public.treasury_counterparties WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contrepartie introuvable');
  END IF;

  UPDATE public.treasury_counterparties SET
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name),
    legal_name   = CASE WHEN p_legal_name IS NULL THEN legal_name ELSE NULLIF(trim(p_legal_name), '') END,
    phone        = CASE WHEN p_phone IS NULL THEN phone ELSE NULLIF(trim(p_phone), '') END,
    wechat_id    = CASE WHEN p_wechat_id IS NULL THEN wechat_id ELSE NULLIF(trim(p_wechat_id), '') END,
    notes        = CASE WHEN p_notes IS NULL THEN notes ELSE NULLIF(trim(p_notes), '') END,
    is_active    = COALESCE(p_is_active, is_active),
    archived_at  = CASE
                     WHEN p_is_active = false AND is_active = true THEN now()
                     WHEN p_is_active = true THEN NULL
                     ELSE archived_at
                   END,
    updated_at   = now()
  WHERE id = p_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_user_id, 'update_treasury_counterparty', 'treasury_counterparty', p_id,
    jsonb_build_object(
      'changed_active', p_is_active IS NOT NULL AND p_is_active IS DISTINCT FROM v_row.is_active
    ));

  RETURN jsonb_build_object('success', true, 'id', p_id);
END;
$$;

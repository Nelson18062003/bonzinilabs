-- ============================================================
-- Gestion des publications de taux : MODIFIER et SUPPRIMER.
--
-- Jusqu'ici seule la création existait (create_daily_rates, avec prise
-- d'effet antidatable). Une faute de frappe publiée restait gravée : ces
-- deux RPC permettent de corriger une publication (valeurs et/ou date
-- d'effet) et d'en supprimer une. Mêmes garde-fous que la création :
-- is_admin(), SECURITY DEFINER, journal d'audit avec l'avant/après.
-- ============================================================

-- ── Modifier une publication ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_daily_rate(
  p_rate_id UUID,
  p_rate_cash INTEGER,
  p_rate_alipay INTEGER,
  p_rate_wechat INTEGER,
  p_rate_virement INTEGER,
  p_effective_at TIMESTAMPTZ DEFAULT NULL  -- NULL = conserver la date actuelle
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_old public.daily_rates%ROWTYPE;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  IF p_rate_cash <= 0 OR p_rate_alipay <= 0 OR p_rate_wechat <= 0 OR p_rate_virement <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux invalides');
  END IF;

  SELECT * INTO v_old FROM public.daily_rates WHERE id = p_rate_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Publication introuvable');
  END IF;

  UPDATE public.daily_rates
  SET rate_cash = p_rate_cash,
      rate_alipay = p_rate_alipay,
      rate_wechat = p_rate_wechat,
      rate_virement = p_rate_virement,
      effective_at = COALESCE(p_effective_at, effective_at)
  WHERE id = p_rate_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'update_daily_rate', 'daily_rates', p_rate_id,
    jsonb_build_object(
      'before', jsonb_build_object('cash', v_old.rate_cash, 'alipay', v_old.rate_alipay,
                                   'wechat', v_old.rate_wechat, 'virement', v_old.rate_virement,
                                   'effective_at', v_old.effective_at),
      'after', jsonb_build_object('cash', p_rate_cash, 'alipay', p_rate_alipay,
                                  'wechat', p_rate_wechat, 'virement', p_rate_virement,
                                  'effective_at', COALESCE(p_effective_at, v_old.effective_at))
    )
  );

  RETURN jsonb_build_object('success', true, 'rate_id', p_rate_id);
END;
$$;

COMMENT ON FUNCTION public.update_daily_rate(UUID, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageRates","confirm":true,"danger":true,"label":"Modifier une publication de taux"}';

-- ── Supprimer une publication ───────────────────────────────────────────
-- Si la publication supprimée était ACTIVE, la plus récente restante
-- (par date d'effet) est réactivée — le module ne reste jamais sans taux
-- tant qu'il existe au moins une publication.
CREATE OR REPLACE FUNCTION public.delete_daily_rate(p_rate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_old public.daily_rates%ROWTYPE;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  SELECT * INTO v_old FROM public.daily_rates WHERE id = p_rate_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Publication introuvable');
  END IF;

  DELETE FROM public.daily_rates WHERE id = p_rate_id;

  IF v_old.is_active THEN
    UPDATE public.daily_rates
    SET is_active = TRUE
    WHERE id = (SELECT id FROM public.daily_rates ORDER BY effective_at DESC LIMIT 1);
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'delete_daily_rate', 'daily_rates', p_rate_id,
    jsonb_build_object(
      'deleted', jsonb_build_object('cash', v_old.rate_cash, 'alipay', v_old.rate_alipay,
                                    'wechat', v_old.rate_wechat, 'virement', v_old.rate_virement,
                                    'effective_at', v_old.effective_at, 'was_active', v_old.is_active)
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.delete_daily_rate(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageRates","confirm":true,"danger":true,"label":"Supprimer une publication de taux"}';

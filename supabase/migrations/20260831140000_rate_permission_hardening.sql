-- ============================================================
-- Durcissement sécurité — gestion des taux (revue de sécurité).
--
-- Constat : les RPC de gestion des taux ne vérifiaient que is_admin()
-- (vrai pour TOUT rôle non désactivé). Or « gérer les taux » n'est ouvert
-- qu'à super_admin et ops (ROLE_PERMISSIONS.canManageRates côté app). Un
-- rôle bas privilège (support, cash_agent, treasurer…) pouvait donc, en
-- appelant PostgREST directement avec son JWT, republier / corriger /
-- supprimer les taux — c'est-à-dire changer le prix facturé à tous les
-- clients. Le contrôle n'existait que dans l'UI.
--
-- Correctif : un helper can_manage_rates() (miroir SQL de canManageRates),
-- appliqué à TOUTE la surface taux — les 2 nouvelles RPC ET les 2
-- existantes (create_daily_rates, update_rate_adjustment) qui avaient le
-- même trou. Plus deux corrections de robustesse relevées par la revue
-- (précision décimale, réactivation d'un taux futur) et la fermeture du
-- log de debug exposé en public.
-- ============================================================

-- ── Helper : autorisé à gérer les taux ? (super_admin | ops, non désactivé)
CREATE OR REPLACE FUNCTION public.can_manage_rates(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('super_admin', 'ops')
      AND (is_disabled = false OR is_disabled IS NULL)
  );
$$;

-- ── create_daily_rates : gate is_admin → can_manage_rates ────────────────
-- (signature NUMERIC conservée — cf. 20260515000001_treasury_fix_daily_rates_precision)
CREATE OR REPLACE FUNCTION public.create_daily_rates(
  p_rate_cash NUMERIC,
  p_rate_alipay NUMERIC,
  p_rate_wechat NUMERIC,
  p_rate_virement NUMERIC,
  p_effective_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_rate_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF NOT public.can_manage_rates(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  IF p_rate_cash <= 0 OR p_rate_alipay <= 0 OR p_rate_wechat <= 0 OR p_rate_virement <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux invalides');
  END IF;

  UPDATE public.daily_rates SET is_active = FALSE WHERE is_active = TRUE;

  INSERT INTO public.daily_rates (rate_cash, rate_alipay, rate_wechat, rate_virement, effective_at, created_by)
  VALUES (p_rate_cash, p_rate_alipay, p_rate_wechat, p_rate_virement, p_effective_at, v_admin_id)
  RETURNING id INTO v_rate_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'create_daily_rates', 'daily_rates', v_rate_id,
    jsonb_build_object('cash', p_rate_cash, 'alipay', p_rate_alipay,
                       'wechat', p_rate_wechat, 'virement', p_rate_virement));

  RETURN jsonb_build_object('success', true, 'rate_id', v_rate_id);
END;
$$;

-- ── update_rate_adjustment : gate is_admin → can_manage_rates ────────────
-- Corps d'origine préservé à l'identique (target_type/audit) ; SEUL le
-- garde-fou is_admin → can_manage_rates change.
CREATE OR REPLACE FUNCTION public.update_rate_adjustment(
  p_adjustment_id UUID,
  p_percentage NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_adj RECORD;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.can_manage_rates(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  SELECT * INTO v_adj FROM public.rate_adjustments WHERE id = p_adjustment_id;

  IF v_adj IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ajustement non trouve');
  END IF;

  IF v_adj.is_reference THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier la reference');
  END IF;

  UPDATE public.rate_adjustments
  SET percentage = p_percentage, updated_at = now(), updated_by = v_admin_id
  WHERE id = p_adjustment_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'update_rate_adjustment', 'rate_adjustment', p_adjustment_id,
    jsonb_build_object('key', v_adj.key, 'old_percentage', v_adj.percentage, 'new_percentage', p_percentage)
  );

  RETURN jsonb_build_object('success', true, 'key', v_adj.key, 'percentage', p_percentage);
END;
$$;

-- ── update_daily_rate : recréée en NUMERIC + gate can_manage_rates ───────
-- La version INTEGER (migration 20260831120000) tronquait la précision
-- décimale que create_daily_rates accepte. Signature changée → DROP requis.
DROP FUNCTION IF EXISTS public.update_daily_rate(UUID, INTEGER, INTEGER, INTEGER, INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.update_daily_rate(
  p_rate_id UUID,
  p_rate_cash NUMERIC,
  p_rate_alipay NUMERIC,
  p_rate_wechat NUMERIC,
  p_rate_virement NUMERIC,
  p_effective_at TIMESTAMPTZ DEFAULT NULL
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
  IF NOT public.can_manage_rates(v_admin_id) THEN
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
                                  'effective_at', COALESCE(p_effective_at, v_old.effective_at))));

  RETURN jsonb_build_object('success', true, 'rate_id', p_rate_id);
END;
$$;

COMMENT ON FUNCTION public.update_daily_rate(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageRates","confirm":true,"danger":true,"label":"Modifier une publication de taux"}';

-- ── delete_daily_rate : gate can_manage_rates + réactivation sûre ────────
-- Réactive la plus récente publication DÉJÀ EN VIGUEUR (effective_at <= now)
-- — jamais un taux futur, qui deviendrait actif par surprise.
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
  IF NOT public.can_manage_rates(v_admin_id) THEN
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
    WHERE id = (
      SELECT id FROM public.daily_rates
      WHERE effective_at <= now()
      ORDER BY effective_at DESC
      LIMIT 1
    );
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'delete_daily_rate', 'daily_rates', p_rate_id,
    jsonb_build_object('deleted', jsonb_build_object(
      'cash', v_old.rate_cash, 'alipay', v_old.rate_alipay,
      'wechat', v_old.rate_wechat, 'virement', v_old.rate_virement,
      'effective_at', v_old.effective_at, 'was_active', v_old.is_active)));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Fermeture du log de debug exposé (advisor ERROR rls_disabled_in_public)
-- public._trigger_debug_log était lisible par anon/authenticated via
-- PostgREST (RLS désactivé). Activer RLS SANS policy coupe tout accès API ;
-- les triggers SECURITY DEFINER qui l'alimentent ne sont pas affectés.
ALTER TABLE IF EXISTS public._trigger_debug_log ENABLE ROW LEVEL SECURITY;

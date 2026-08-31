-- ############################################################################
-- ##                                                                        ##
-- ##   NE PAS EXÉCUTER CE FICHIER. Il n'y a RIEN à lancer.                  ##
-- ##                                                                        ##
-- ##   Les 8 migrations ci-dessous sont DÉJÀ APPLIQUÉES au projet de        ##
-- ##   production BonziniLabs : fmhsohrgbznqmcvqktjw                        ##
-- ##   (vérifiable dans supabase_migrations.schema_migrations).             ##
-- ##                                                                        ##
-- ##   Ce fichier est un DOCUMENT DE RELECTURE, pas une migration.          ##
-- ##                                                                        ##
-- ##   · Le lancer sur BonziniLabs : inutile (rejeu sans effet).            ##
-- ##   · Le lancer sur un AUTRE projet : échoue immédiatement — il          ##
-- ##     DURCIT un schéma Bonzini existant, il ne le CRÉE pas. Sur une      ##
-- ##     base sans les tables Bonzini, l'erreur attendue est                ##
-- ##     « relation "public.daily_rates" does not exist ». L'éditeur SQL    ##
-- ##     Supabase exécutant le script dans une transaction, tout est        ##
-- ##     annulé et rien n'est laissé derrière.                              ##
-- ##                                                                        ##
-- ##   Pour appliquer de VRAIES migrations, utiliser la CLI sur les 8       ##
-- ##   fichiers de supabase/migrations/ : npx supabase db push --linked     ##
-- ##                                                                        ##
-- ############################################################################
--
-- ============================================================================
-- BONZINI LABS — MIGRATION CONSOLIDÉE
-- Généré le 2026-08-31 · branche claude/payment-beneficiary-default-name-f7bee1
--
-- Regroupe, DANS L'ORDRE D'EXÉCUTION, les 8 migrations que cette branche
-- ajoute par rapport à `main`. Chaque section reprend le fichier d'origine
-- tel quel (`supabase/migrations/<nom>`), en-tête et commentaires compris.
--
-- POURQUOI CE FICHIER N'EST PAS DANS supabase/migrations/
-- Il y serait détecté comme une NOUVELLE migration et `supabase db push`
-- rejouerait l'ensemble en double. Il vit donc hors de ce répertoire ;
-- les 8 fichiers individuels restent la source de vérité pour la CLI.
--
-- ORDRE — non négociable : la section 3 crée `admin_has_permission()`, que
-- les sections 4 à 7 appellent. Exécuter dans l'ordre donné.
--
-- IDEMPOTENCE
--   · CREATE OR REPLACE FUNCTION, REVOKE, ALTER FUNCTION ... SET, et les
--     CREATE ... IF NOT EXISTS sont rejouables tels quels.
--   · Les blocs DO $mig$ qui réécrivent un corps existant testent d'abord
--     si le correctif est déjà présent (`CONTINUE`) : les rejouer ne fait
--     rien. En revanche ils échouent VOLONTAIREMENT et bruyamment
--     (RAISE EXCEPTION) si la fonction visée est absente ou si son corps a
--     changé au point que le motif recherché a disparu — un échec visible
--     valant mieux qu'un correctif silencieusement non appliqué.
--
-- PRÉREQUIS : une base portant déjà le schéma Bonzini (tables, enums et
-- fonctions de base). Ce fichier DURCIT l'existant, il ne le crée pas.
-- ============================================================================




-- ==========================================================================
-- SECTION 1/8 — 1. Gestion des publications de taux : RPC update_daily_rate / delete_daily_rate (audit, réactivation du plus récent).
-- Source : supabase/migrations/20260831120000_daily_rate_update_delete.sql
-- ==========================================================================

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



-- ==========================================================================
-- SECTION 2/8 — 2. Taux : les RPC passent de is_admin à canManageRates ; fermeture d'une table de debug lisible publiquement.
-- Source : supabase/migrations/20260831140000_rate_permission_hardening.sql
-- ==========================================================================

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



-- ==========================================================================
-- SECTION 3/8 — 3. SOCLE : admin_has_permission(uid, permission), miroir SQL exact de ROLE_PERMISSIONS (filtre is_disabled EN PREMIER), puis 16 RPC regardées. DOIT s'exécuter avant les sections 4 à 7, qui l'appellent.
-- Source : supabase/migrations/20260831160000_role_permission_enforcement.sql
-- ==========================================================================

-- ============================================================
-- P1 — Contrôle d'accès serveur : permissions par RÔLE, et blocage
-- effectif des admins désactivés.
--
-- Deux failles systémiques constatées (revue adversariale) :
--
-- 1) is_admin() ne teste AUCUN rôle : il renvoie vrai pour toute ligne
--    non désactivée de user_roles. Toutes les RPC gardées par is_admin()
--    étaient donc exécutables par N'IMPORTE QUEL rôle (support,
--    cash_agent, treasurer…), alors que ROLE_PERMISSIONS restreint ces
--    actions côté app. Un treasurer pouvait créditer un portefeuille
--    client ; un cash_agent pouvait rediriger le bénéficiaire d'un
--    paiement (donc les fonds) ou valider un dépôt. Le contrôle
--    n'existait que dans l'UI.
--
-- 2) Cinq fonctions gardées « super_admin » lisaient le rôle de
--    l'appelant SANS filtrer is_disabled — alors que la règle du projet
--    (.claude/rules/security.md) exige qu'un admin révoqué soit bloqué
--    immédiatement. Désactiver une ligne ne révoque pas le JWT Supabase :
--    un super_admin révoqué gardait, avec sa session, le pouvoir de
--    réinitialiser des mots de passe (clients ET admins) et de promouvoir
--    un compte complice en super_admin — soit un retour permanent.
--
-- Correctif : admin_has_permission(uid, permission) — miroir SQL exact de
-- ROLE_PERMISSIONS (src/contexts/AdminAuthContext.tsx) — appliqué comme
-- garde-fou, et filtre is_disabled ajouté aux cinq fonctions concernées.
-- Les CORPS des fonctions sont préservés à l'identique : seule la ligne de
-- garde change (diff vérifié : 1 ligne par fonction).
-- ============================================================

-- Miroir SQL de ROLE_PERMISSIONS. Un admin désactivé n'a AUCUNE permission.
-- 'canAdjustWallets' est une clé serveur : elle encode l'intention déjà
-- documentée dans create_wallet_adjustment (« super_admin or ops »), que
-- le code ne faisait pas respecter.
CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
      AND CASE _permission
        WHEN 'canViewClients'       THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canEditClients'       THEN ur.role::text IN ('super_admin','support','customer_success')
        WHEN 'canViewDeposits'      THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canProcessDeposits'   THEN ur.role::text IN ('super_admin','ops','customer_success')
        WHEN 'canViewPayments'      THEN ur.role::text IN ('super_admin','ops','support','customer_success','cash_agent')
        WHEN 'canProcessPayments'   THEN ur.role::text IN ('super_admin','ops','cash_agent')
        WHEN 'canManageRates'       THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canViewLogs'          THEN ur.role::text IN ('super_admin','ops','support')
        WHEN 'canManageUsers'       THEN ur.role::text IN ('super_admin')
        WHEN 'canViewTreasury'      THEN ur.role::text IN ('super_admin','treasurer')
        WHEN 'canManageTreasury'    THEN ur.role::text IN ('super_admin','treasurer')
        WHEN 'canAccessSupportChat' THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canAdjustWallets'     THEN ur.role::text IN ('super_admin','ops')
        ELSE false
      END
  );
$fn$;

COMMENT ON FUNCTION public.admin_has_permission(UUID, TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewLogs","label":"Verifier une permission admin (miroir SQL de ROLE_PERMISSIONS)"}';

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_adjustment_type text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_amount_xaf BIGINT;
  v_entry_type public.ledger_entry_type;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canAdjustWallets') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  v_amount_xaf := p_amount::BIGINT;

  IF p_adjustment_type = 'credit' THEN
    v_new_balance := v_wallet.balance_xaf + v_amount_xaf;
    v_entry_type := 'ADMIN_CREDIT';
  ELSIF p_adjustment_type = 'debit' THEN
    IF v_wallet.balance_xaf < v_amount_xaf THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
    END IF;
    v_new_balance := v_wallet.balance_xaf - v_amount_xaf;
    v_entry_type := 'ADMIN_DEBIT';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type d''ajustement invalide');
  END IF;

  -- Update wallet
  UPDATE wallets SET balance_xaf = v_new_balance, updated_at = now() WHERE id = v_wallet.id;

  -- Create ledger entry (replaces wallet_operations)
  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, description, created_by_admin_id,
    metadata
  ) VALUES (
    v_wallet.id, p_user_id, v_entry_type, v_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'adjustment',
    p_reason,
    v_admin_id,
    jsonb_build_object('adjustment_type', p_adjustment_type)
  );

  -- Audit log
  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'admin_adjust_wallet', 'wallet', v_wallet.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'adjustment_type', p_adjustment_type,
      'amount', v_amount_xaf,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'message', 'Ajustement effectué'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_wallet_adjustment(p_user_id uuid, p_adjustment_type character varying, p_amount_xaf bigint, p_reason text, p_proof_urls text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_balance_before BIGINT;
  v_balance_after BIGINT;
  v_entry_type ledger_entry_type;
  v_ledger_entry_id UUID;
  v_adjustment_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Check if caller is admin (super_admin or ops)
  IF NOT public.admin_has_permission(v_admin_id, 'canAdjustWallets') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Validate adjustment type
  IF p_adjustment_type NOT IN ('CREDIT', 'DEBIT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''ajustement invalide');
  END IF;

  -- Validate amount
  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  -- Validate reason
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif est obligatoire');
  END IF;

  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  v_balance_before := v_wallet.balance_xaf;

  -- Calculate new balance based on adjustment type
  IF p_adjustment_type = 'CREDIT' THEN
    v_balance_after := v_balance_before + p_amount_xaf;
    v_entry_type := 'ADMIN_CREDIT';
  ELSE
    -- Check sufficient balance for debit
    IF v_balance_before < p_amount_xaf THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Solde insuffisant',
        'current_balance', v_balance_before,
        'requested_amount', p_amount_xaf
      );
    END IF;
    v_balance_after := v_balance_before - p_amount_xaf;
    v_entry_type := 'ADMIN_DEBIT';
  END IF;

  -- Start transaction operations

  -- 1. Create ledger entry
  INSERT INTO public.ledger_entries (
    wallet_id,
    user_id,
    entry_type,
    amount_xaf,
    balance_before,
    balance_after,
    reference_type,
    description,
    metadata,
    created_by_admin_id
  ) VALUES (
    v_wallet.id,
    p_user_id,
    v_entry_type,
    p_amount_xaf,
    v_balance_before,
    v_balance_after,
    'adjustment',
    p_reason,
    jsonb_build_object('proof_urls', p_proof_urls),
    v_admin_id
  )
  RETURNING id INTO v_ledger_entry_id;

  -- 2. Create wallet adjustment record
  INSERT INTO public.wallet_adjustments (
    wallet_id,
    user_id,
    adjustment_type,
    amount_xaf,
    reason,
    proof_urls,
    ledger_entry_id,
    created_by_admin_id
  ) VALUES (
    v_wallet.id,
    p_user_id,
    p_adjustment_type,
    p_amount_xaf,
    p_reason,
    p_proof_urls,
    v_ledger_entry_id,
    v_admin_id
  )
  RETURNING id INTO v_adjustment_id;

  -- 3. Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_balance_after,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  -- 4. Create audit log
  INSERT INTO public.admin_audit_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    CASE WHEN p_adjustment_type = 'CREDIT' THEN 'WALLET_CREDITED' ELSE 'WALLET_DEBITED' END,
    'WALLET',
    v_wallet.id,
    jsonb_build_object(
      'adjustment_id', v_adjustment_id,
      'user_id', p_user_id,
      'adjustment_type', p_adjustment_type,
      'amount_xaf', p_amount_xaf,
      'balance_before', v_balance_before,
      'balance_after', v_balance_after,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'ledger_entry_id', v_ledger_entry_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_deposit(p_deposit_id uuid, p_admin_comment text DEFAULT NULL::text, p_confirmed_amount bigint DEFAULT NULL::bigint, p_send_notification boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_credit_amount BIGINT;
  v_new_balance BIGINT;
  v_admin_id UUID;
  v_client_name TEXT;
  v_proof_count INT;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessDeposits') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT d.*
  INTO v_deposit
  FROM deposits d
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a été rejeté et ne peut plus être validé');
  END IF;

  -- Snapshot proof count for audit trail (NOT used as a guard).
  SELECT COUNT(*) INTO v_proof_count
  FROM deposit_proofs
  WHERE deposit_id = p_deposit_id AND deleted_at IS NULL;

  SELECT COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')
  INTO v_client_name
  FROM clients c
  WHERE c.user_id = v_deposit.user_id;

  v_client_name := COALESCE(v_client_name, 'Client');

  v_credit_amount := COALESCE(p_confirmed_amount, v_deposit.amount_xaf);

  INSERT INTO wallets (user_id, balance_xaf)
  VALUES (v_deposit.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_deposit.user_id
  FOR UPDATE;

  v_new_balance := v_wallet.balance_xaf + v_credit_amount;

  UPDATE wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE deposits
  SET status = 'validated',
      admin_comment = COALESCE(p_admin_comment, admin_comment),
      confirmed_amount_xaf = CASE
        WHEN p_confirmed_amount IS NOT NULL AND p_confirmed_amount != amount_xaf
        THEN p_confirmed_amount
        ELSE NULL
      END,
      validated_by = v_admin_id,
      validated_at = now(),
      updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, created_by_admin_id,
    metadata
  ) VALUES (
    v_wallet.id, v_deposit.user_id, 'DEPOSIT_VALIDATED', v_credit_amount,
    v_wallet.balance_xaf, v_new_balance, 'deposit', p_deposit_id,
    format('Dépôt validé - Réf: %s', v_deposit.reference),
    v_admin_id,
    jsonb_build_object(
      'declared_amount', v_deposit.amount_xaf,
      'confirmed_amount', v_credit_amount,
      'method', v_deposit.method,
      'had_proofs_at_validation', v_proof_count > 0,
      'proof_count_at_validation', v_proof_count
    )
  );

  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'validated',
    CASE
      WHEN v_proof_count = 0
      THEN 'Dépôt validé par l''équipe Bonzini (sans preuve)'
      ELSE 'Dépôt validé par l''équipe Bonzini'
    END,
    v_admin_id
  );

  INSERT INTO deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id, 'wallet_credited',
    format('Solde mis à jour: +%s XAF → Nouveau solde: %s XAF',
           to_char(v_credit_amount, 'FM999,999,999'),
           to_char(v_new_balance, 'FM999,999,999')),
    v_admin_id
  );

  IF p_send_notification THEN
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_deposit.user_id,
      'deposit_validated',
      'Dépôt validé',
      format('Votre dépôt de %s XAF a été validé. Nouveau solde: %s XAF',
             to_char(v_credit_amount, 'FM999,999,999'),
             to_char(v_new_balance, 'FM999,999,999')),
      jsonb_build_object(
        'deposit_id', p_deposit_id,
        'reference', v_deposit.reference,
        'amount_xaf', v_credit_amount,
        'new_balance', v_new_balance,
        'method', v_deposit.method
      )
    );
  END IF;

  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'deposit_reference', v_deposit.reference,
      'client_user_id', v_deposit.user_id,
      'client_name', v_client_name,
      'declared_amount', v_deposit.amount_xaf,
      'confirmed_amount', v_credit_amount,
      'method', v_deposit.method,
      'old_balance', v_wallet.balance_xaf,
      'new_balance', v_new_balance,
      'admin_comment', p_admin_comment,
      'notification_sent', p_send_notification,
      'had_proofs_at_validation', v_proof_count > 0,
      'proof_count_at_validation', v_proof_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount_credited', v_credit_amount,
    'old_balance', v_wallet.balance_xaf,
    'new_balance', v_new_balance,
    'reference', v_deposit.reference,
    'had_proofs', v_proof_count > 0
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_deposit(p_deposit_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
  v_client_name TEXT;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessDeposits') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif de rejet est obligatoire');
  END IF;

  SELECT d.*
  INTO v_deposit
  FROM deposits d
  WHERE d.id = p_deposit_id
  FOR UPDATE OF d;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  -- Get client name from clients table
  SELECT COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')
  INTO v_client_name
  FROM clients c
  WHERE c.user_id = v_deposit.user_id;

  v_client_name := COALESCE(v_client_name, 'Client');

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été validé et ne peut plus être rejeté');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a déjà été rejeté');
  END IF;

  UPDATE deposits
  SET
    status = 'rejected',
    rejection_reason = p_reason,
    validated_by = v_admin_id,
    validated_at = now(),
    updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by,
    created_at
  ) VALUES (
    p_deposit_id,
    'rejected',
    format('Dépôt rejeté - Motif: %s', p_reason),
    v_admin_id,
    now()
  );

  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_deposit.user_id,
    'deposit_rejected',
    'Dépôt refusé',
    format('Votre dépôt de %s XAF a été refusé. Motif: %s',
           to_char(v_deposit.amount_xaf, 'FM999,999,999'),
           p_reason),
    jsonb_build_object(
      'deposit_id', p_deposit_id,
      'reference', v_deposit.reference,
      'amount_xaf', v_deposit.amount_xaf,
      'reason', p_reason
    )
  );

  INSERT INTO admin_audit_logs (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    details
  ) VALUES (
    v_admin_id,
    'reject_deposit',
    'deposit',
    p_deposit_id,
    jsonb_build_object(
      'deposit_reference', v_deposit.reference,
      'client_user_id', v_deposit.user_id,
      'client_name', v_client_name,
      'amount_xaf', v_deposit.amount_xaf,
      'method', v_deposit.method,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reference', v_deposit.reference
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_deposit_review(p_deposit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deposit RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessDeposits') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT * INTO v_deposit
  FROM deposits
  WHERE id = p_deposit_id
  FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt introuvable');
  END IF;

  IF v_deposit.status NOT IN ('proof_submitted', 'pending_correction') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne peut pas être mis en revue');
  END IF;

  UPDATE deposits
  SET
    status = 'admin_review',
    updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO deposit_timeline_events (
    deposit_id,
    event_type,
    description,
    performed_by
  ) VALUES (
    p_deposit_id,
    'admin_review',
    'Vérification en cours par l''équipe Bonzini',
    v_admin_id
  );

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_payment(p_payment_id uuid, p_action text, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_admin_id UUID;
  v_new_balance BIGINT;
  v_wallet RECORD;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  IF p_action = 'start_processing' THEN
    IF v_payment.status NOT IN ('ready_for_payment') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement ne peut pas être traité');
    END IF;

    UPDATE public.payments
    SET status = 'processing', processed_by = v_admin_id, updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'processing', 'Paiement en cours de traitement', v_admin_id);

    -- Notification for processing started
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_payment.user_id,
      'payment_processing',
      'Paiement en cours',
      format('Votre paiement %s de %s RMB est en cours de traitement.',
        v_payment.reference,
        to_char(v_payment.amount_rmb, 'FM999G999G990D00')),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reference', v_payment.reference,
        'amount_rmb', v_payment.amount_rmb
      )
    );

  ELSIF p_action = 'complete' THEN
    IF v_payment.status NOT IN ('processing') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement doit être en cours de traitement');
    END IF;

    UPDATE public.payments
    SET status = 'completed', processed_at = now(), client_visible_comment = p_comment, updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'completed', 'Paiement effectué avec succès', v_admin_id);

    -- Ledger entry for executed payment
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id;
    IF v_wallet IS NOT NULL THEN
      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description, created_by_admin_id,
        metadata
      ) VALUES (
        v_wallet.id, v_payment.user_id, 'PAYMENT_EXECUTED', v_payment.amount_xaf,
        v_wallet.balance_xaf, v_wallet.balance_xaf, 'payment', p_payment_id,
        format('Paiement exécuté - Réf: %s', v_payment.reference),
        v_admin_id,
        jsonb_build_object(
          'method', v_payment.method::text,
          'amount_rmb', v_payment.amount_rmb
        )
      );
    END IF;

    -- Add audit log
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (
      v_admin_id, 'complete_payment', 'payment', p_payment_id,
      jsonb_build_object(
        'amount_xaf', v_payment.amount_xaf,
        'amount_rmb', v_payment.amount_rmb,
        'user_id', v_payment.user_id
      )
    );

    -- Notification for payment completed
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_payment.user_id,
      'payment_completed',
      'Paiement effectué',
      format('Votre paiement %s de %s RMB a été effectué avec succès. Consultez la preuve dans l''application.',
        v_payment.reference,
        to_char(v_payment.amount_rmb, 'FM999G999G990D00')),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reference', v_payment.reference,
        'amount_rmb', v_payment.amount_rmb
      )
    );

  ELSIF p_action = 'reject' THEN
    IF v_payment.status = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Impossible de refuser un paiement déjà effectué');
    END IF;

    IF p_comment IS NULL OR p_comment = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une raison est requise pour le refus');
    END IF;

    -- Get wallet for ledger entry
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id;

    -- Refund the balance
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id
    RETURNING balance_xaf INTO v_new_balance;

    -- Create ledger entry for refund (replaces wallet_operations)
    IF v_wallet IS NOT NULL THEN
      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description, created_by_admin_id,
        metadata
      ) VALUES (
        v_wallet.id, v_payment.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_payment.amount_xaf,
        v_wallet.balance_xaf, v_new_balance, 'payment', p_payment_id,
        format('Remboursement paiement refusé - Réf: %s', v_payment.reference),
        v_admin_id,
        jsonb_build_object(
          'reason', p_comment,
          'method', v_payment.method::text,
          'amount_rmb', v_payment.amount_rmb
        )
      );
    END IF;

    UPDATE public.payments
    SET status = 'rejected', rejection_reason = p_comment, processed_by = v_admin_id, processed_at = now(), updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'rejected', 'Paiement refusé: ' || p_comment, v_admin_id);

    -- Add audit log
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (
      v_admin_id, 'reject_payment', 'payment', p_payment_id,
      jsonb_build_object(
        'amount_xaf', v_payment.amount_xaf,
        'user_id', v_payment.user_id,
        'reason', p_comment,
        'refunded_balance', v_new_balance
      )
    );

    -- Notification for payment rejected
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_payment.user_id,
      'payment_rejected',
      'Paiement refusé',
      format('Votre paiement %s de %s XAF a été refusé. Motif: %s. Le montant a été recrédité sur votre solde.',
        v_payment.reference,
        to_char(v_payment.amount_xaf, 'FM999G999G999'),
        p_comment),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reference', v_payment.reference,
        'amount_xaf', v_payment.amount_xaf,
        'reason', p_comment,
        'new_balance', v_new_balance
      )
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Action non reconnue');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_admin_payment(p_user_id uuid, p_amount_xaf bigint, p_amount_rmb numeric, p_exchange_rate numeric, p_method payment_method, p_beneficiary_name text DEFAULT NULL::text, p_beneficiary_phone text DEFAULT NULL::text, p_beneficiary_email text DEFAULT NULL::text, p_beneficiary_qr_code_url text DEFAULT NULL::text, p_beneficiary_bank_name text DEFAULT NULL::text, p_beneficiary_bank_account text DEFAULT NULL::text, p_beneficiary_notes text DEFAULT NULL::text, p_client_visible_comment text DEFAULT NULL::text, p_desired_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_beneficiary_id uuid DEFAULT NULL::uuid, p_beneficiary_details jsonb DEFAULT NULL::jsonb, p_rate_is_custom boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;

  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde client insuffisant');
  END IF;

  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  v_reference := generate_payment_reference();

  v_has_beneficiary_info := (
    p_beneficiary_id IS NOT NULL OR
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );

  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;

  v_created_at := COALESCE(p_desired_date, now());

  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after, client_visible_comment, created_at,
    beneficiary_id, beneficiary_details, rate_is_custom
  ) VALUES (
    p_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance, p_client_visible_comment, v_created_at,
    p_beneficiary_id, p_beneficiary_details, p_rate_is_custom
  ) RETURNING id INTO v_payment_id;

  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, created_by_admin_id,
    metadata, created_at
  ) VALUES (
    v_wallet.id, p_user_id, 'PAYMENT_RESERVED', p_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'payment', v_payment_id,
    'Paiement ' || v_reference,
    v_admin_id,
    jsonb_build_object(
      'method', p_method::text,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'admin_created', true,
      'rate_is_custom', p_rate_is_custom
    ),
    v_created_at
  );

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
  VALUES (v_payment_id, 'created', 'Paiement créé par l''équipe Bonzini - Montant réservé', v_admin_id, v_created_at);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id, v_created_at);
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_for_client', 'payment', v_payment_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'method', p_method,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance,
      'rate_is_custom', p_rate_is_custom,
      'beneficiary_id', p_beneficiary_id
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    'payment_created',
    'Nouveau paiement',
    format('Un paiement de %s XAF (%s RMB) a été créé pour vous. Référence: %s',
      to_char(p_amount_xaf, 'FM999G999G999'),
      to_char(p_amount_rmb, 'FM999G999G990D00'),
      v_reference),
    jsonb_build_object(
      'payment_id', v_payment_id,
      'reference', v_reference,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_payment_batch(p_user_id uuid, p_lines jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_line JSONB;
  v_line_count INT;
  v_total_xaf BIGINT := 0;
  v_total_rmb NUMERIC(15,2) := 0;
  v_amount_xaf BIGINT;
  v_amount_rmb NUMERIC;
  v_balance BIGINT;
  v_balance_before BIGINT;
  v_batch_id UUID;
  v_batch_reference TEXT;
  v_payment_id UUID;
  v_payment_reference TEXT;
  v_method payment_method;
  v_status payment_status;
  v_has_benef BOOLEAN;
  v_payment_ids UUID[] := '{}';
BEGIN
  v_admin_id := auth.uid();

  -- Autorisation : admin uniquement
  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Payload de lignes valide ?
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liste de paiements invalide');
  END IF;

  v_line_count := jsonb_array_length(p_lines);
  IF v_line_count < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Au moins un bénéficiaire est requis');
  END IF;

  -- Verrou pessimiste UNIQUE sur le wallet du client (anti double-dépense)
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;

  -- ── PASSE 1 : valider chaque ligne + calculer le total (aucune écriture) ──
  FOR v_line IN SELECT line FROM jsonb_array_elements(p_lines) AS t(line)
  LOOP
    v_amount_xaf := NULLIF(v_line->>'amount_xaf', '')::bigint;
    v_amount_rmb := COALESCE(NULLIF(v_line->>'amount_rmb', '')::numeric, 0);

    IF v_amount_xaf IS NULL OR v_amount_xaf <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chaque ligne doit avoir un montant XAF positif');
    END IF;
    IF v_amount_rmb <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chaque ligne doit avoir un montant RMB positif');
    END IF;
    IF NOT (COALESCE(v_line->>'method','') IN ('alipay','wechat','bank_transfer','cash')) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Méthode de paiement invalide');
    END IF;

    v_total_xaf := v_total_xaf + v_amount_xaf;
    v_total_rmb := v_total_rmb + v_amount_rmb;
  END LOOP;

  -- Vérification UNIQUE du solde pour le total du lot (atomique, sous le verrou)
  IF v_wallet.balance_xaf < v_total_xaf THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde client insuffisant',
      'required_xaf', v_total_xaf,
      'available_xaf', v_wallet.balance_xaf
    );
  END IF;

  -- En-tête de lot
  v_batch_reference := public.generate_payment_batch_reference();
  INSERT INTO public.payment_batches (
    reference, user_id, created_by, note, total_amount_xaf, total_amount_rmb, line_count
  ) VALUES (
    v_batch_reference, p_user_id, v_admin_id, NULLIF(btrim(COALESCE(p_note,'')), ''),
    v_total_xaf, v_total_rmb, v_line_count
  ) RETURNING id INTO v_batch_id;

  -- ── PASSE 2 : créer chaque paiement, en débitant le solde courant ──
  v_balance := v_wallet.balance_xaf;

  FOR v_line IN SELECT line FROM jsonb_array_elements(p_lines) AS t(line)
  LOOP
    v_amount_xaf := (v_line->>'amount_xaf')::bigint;
    v_amount_rmb := (v_line->>'amount_rmb')::numeric;
    v_method := (v_line->>'method')::payment_method;

    v_balance_before := v_balance;
    v_balance := v_balance - v_amount_xaf;

    v_payment_reference := public.generate_payment_reference();

    v_has_benef := (
      NULLIF(v_line->>'beneficiary_qr_code_url','') IS NOT NULL OR
      NULLIF(v_line->>'beneficiary_name','') IS NOT NULL OR
      NULLIF(v_line->>'beneficiary_bank_account','') IS NOT NULL OR
      NULLIF(v_line->>'beneficiary_identifier','') IS NOT NULL OR
      v_method = 'cash'
    );
    v_status := CASE WHEN v_has_benef THEN 'ready_for_payment'::payment_status
                     ELSE 'waiting_beneficiary_info'::payment_status END;

    INSERT INTO public.payments (
      user_id, batch_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
      beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
      beneficiary_bank_name, beneficiary_bank_account, beneficiary_bank_extra, beneficiary_notes,
      beneficiary_identifier, beneficiary_identifier_type, beneficiary_id, beneficiary_details,
      cash_beneficiary_type, cash_beneficiary_first_name, cash_beneficiary_last_name, cash_beneficiary_phone,
      rate_is_custom, balance_before, balance_after, client_visible_comment
    ) VALUES (
      p_user_id, v_batch_id, v_payment_reference, v_amount_xaf, v_amount_rmb,
      COALESCE(NULLIF(v_line->>'exchange_rate','')::numeric, 0), v_method, v_status,
      NULLIF(v_line->>'beneficiary_name',''), NULLIF(v_line->>'beneficiary_phone',''),
      NULLIF(v_line->>'beneficiary_email',''), NULLIF(v_line->>'beneficiary_qr_code_url',''),
      NULLIF(v_line->>'beneficiary_bank_name',''), NULLIF(v_line->>'beneficiary_bank_account',''),
      NULLIF(v_line->>'beneficiary_bank_extra',''), NULLIF(v_line->>'beneficiary_notes',''),
      NULLIF(v_line->>'beneficiary_identifier',''), NULLIF(v_line->>'beneficiary_identifier_type',''),
      NULLIF(v_line->>'beneficiary_id','')::uuid,
      CASE WHEN v_line ? 'beneficiary_details' AND jsonb_typeof(v_line->'beneficiary_details') = 'object'
           THEN v_line->'beneficiary_details' ELSE NULL END,
      NULLIF(v_line->>'cash_beneficiary_type',''), NULLIF(v_line->>'cash_beneficiary_first_name',''),
      NULLIF(v_line->>'cash_beneficiary_last_name',''), NULLIF(v_line->>'cash_beneficiary_phone',''),
      COALESCE((v_line->>'rate_is_custom')::boolean, false),
      v_balance_before, v_balance, NULLIF(v_line->>'client_visible_comment','')
    ) RETURNING id INTO v_payment_id;

    v_payment_ids := array_append(v_payment_ids, v_payment_id);

    -- Réservation des fonds de la ligne (ledger)
    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id, metadata
    ) VALUES (
      v_wallet.id, p_user_id, 'PAYMENT_RESERVED', v_amount_xaf,
      v_balance_before, v_balance, 'payment', v_payment_id,
      'Paiement ' || v_payment_reference || ' (lot ' || v_batch_reference || ')',
      v_admin_id,
      jsonb_build_object(
        'method', v_method::text,
        'amount_rmb', v_amount_rmb,
        'exchange_rate', COALESCE(NULLIF(v_line->>'exchange_rate','')::numeric, 0),
        'admin_created', true,
        'batch_id', v_batch_id,
        'batch_reference', v_batch_reference
      )
    );

    -- Timeline
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'created', 'Paiement créé (lot ' || v_batch_reference || ') - Montant réservé', v_admin_id);

    IF NOT v_has_benef AND v_method <> 'cash' THEN
      INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
      VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id);
    END IF;
  END LOOP;

  -- Débit UNIQUE du wallet vers le solde final (verrou tenu pendant tout le lot)
  UPDATE public.wallets
  SET balance_xaf = v_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Journal d'audit (un seul pour le lot)
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_batch', 'payment_batch', v_batch_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'batch_reference', v_batch_reference,
      'line_count', v_line_count,
      'total_amount_xaf', v_total_xaf,
      'total_amount_rmb', v_total_rmb,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_balance
    )
  );

  -- Notification client (une seule pour le lot)
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    'payment_created',
    'Nouveau paiement groupé',
    format('Un paiement groupé %s de %s bénéficiaire(s) pour un total de %s XAF a été créé.',
      v_batch_reference,
      v_line_count::text,
      to_char(v_total_xaf, 'FM999G999G999')),
    jsonb_build_object(
      'batch_id', v_batch_id,
      'batch_reference', v_batch_reference,
      'line_count', v_line_count,
      'total_amount_xaf', v_total_xaf,
      'new_balance', v_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'batch_reference', v_batch_reference,
    'line_count', v_line_count,
    'total_amount_xaf', v_total_xaf,
    'total_amount_rmb', v_total_rmb,
    'new_balance', v_balance,
    'payment_ids', to_jsonb(v_payment_ids)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_payment_proof(p_proof_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_proof RECORD;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Get proof
  SELECT * INTO v_proof FROM public.payment_proofs WHERE id = p_proof_id;

  IF v_proof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Preuve non trouvée');
  END IF;

  -- Allow deletion even if payment is completed or rejected (admin only)
  DELETE FROM public.payment_proofs WHERE id = p_proof_id;

  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_proof.payment_id, 'proof_deleted', 'Preuve supprimée: ' || v_proof.file_name, v_admin_id);

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_payment_beneficiary(p_payment_id uuid, p_beneficiary_name text DEFAULT NULL::text, p_beneficiary_phone text DEFAULT NULL::text, p_beneficiary_email text DEFAULT NULL::text, p_beneficiary_qr_code_url text DEFAULT NULL::text, p_beneficiary_bank_name text DEFAULT NULL::text, p_beneficiary_bank_account text DEFAULT NULL::text, p_beneficiary_notes text DEFAULT NULL::text, p_beneficiary_identifier text DEFAULT NULL::text, p_beneficiary_identifier_type text DEFAULT NULL::text, p_beneficiary_bank_extra text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_payment    RECORD;
  v_new_status payment_status;
BEGIN
  IF NOT public.admin_has_permission(v_caller_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée');
  END IF;

  SELECT id, status, method INTO v_payment
  FROM payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  IF v_payment.status IN (
    'completed'::payment_status,
    'rejected'::payment_status,
    'cancelled_by_admin'::payment_status
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier un paiement finalisé');
  END IF;

  v_new_status := v_payment.status;

  IF v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    IF v_payment.method IN ('alipay', 'wechat')
       AND (p_beneficiary_qr_code_url IS NOT NULL
            OR p_beneficiary_phone IS NOT NULL
            OR p_beneficiary_email IS NOT NULL
            OR p_beneficiary_identifier IS NOT NULL) THEN
      v_new_status := 'ready_for_payment'::payment_status;
    ELSIF v_payment.method = 'bank_transfer'
          AND p_beneficiary_name IS NOT NULL
          AND p_beneficiary_bank_name IS NOT NULL
          AND p_beneficiary_bank_account IS NOT NULL THEN
      v_new_status := 'ready_for_payment'::payment_status;
    END IF;
  END IF;

  UPDATE payments SET
    beneficiary_name            = COALESCE(p_beneficiary_name,            beneficiary_name),
    beneficiary_phone           = COALESCE(p_beneficiary_phone,           beneficiary_phone),
    beneficiary_email           = COALESCE(p_beneficiary_email,           beneficiary_email),
    beneficiary_qr_code_url     = COALESCE(p_beneficiary_qr_code_url,     beneficiary_qr_code_url),
    beneficiary_bank_name       = COALESCE(p_beneficiary_bank_name,       beneficiary_bank_name),
    beneficiary_bank_account    = COALESCE(p_beneficiary_bank_account,    beneficiary_bank_account),
    beneficiary_notes           = COALESCE(p_beneficiary_notes,           beneficiary_notes),
    beneficiary_identifier      = COALESCE(p_beneficiary_identifier,      beneficiary_identifier),
    beneficiary_identifier_type = COALESCE(p_beneficiary_identifier_type, beneficiary_identifier_type),
    beneficiary_bank_extra      = COALESCE(p_beneficiary_bank_extra,      beneficiary_bank_extra),
    status                      = v_new_status,
    updated_at                  = NOW()
  WHERE id = p_payment_id;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id,
    'admin_beneficiary_update',
    'Infos bénéficiaire mises à jour par un administrateur',
    v_caller_id
  );

  IF v_new_status = 'ready_for_payment'::payment_status
     AND v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (
      p_payment_id,
      'info_provided',
      'Informations bénéficiaire complétées — paiement prêt',
      v_caller_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'new_status', v_new_status::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_client(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_id UUID;
  v_has_role BOOLEAN;
  v_auth_freed BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageUsers') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = p_user_id
  ) INTO v_has_role;

  IF v_has_role THEN
    RETURN json_build_object('success', false, 'error', 'Impossible de supprimer un utilisateur admin/agent. Supprimez d''abord son rôle.');
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;

  IF v_wallet_id IS NOT NULL THEN
    DELETE FROM wallet_adjustments WHERE wallet_id = v_wallet_id;
  END IF;

  DELETE FROM ledger_entries WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;

  DELETE FROM deposit_timeline_events WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  DELETE FROM deposit_proofs WHERE deposit_id IN (
    SELECT id FROM deposits WHERE user_id = p_user_id
  );
  DELETE FROM deposits WHERE user_id = p_user_id;

  DELETE FROM payment_timeline_events WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  DELETE FROM payment_proofs WHERE payment_id IN (
    SELECT id FROM payments WHERE user_id = p_user_id
  );
  DELETE FROM payments WHERE user_id = p_user_id;

  DELETE FROM wallets WHERE user_id = p_user_id;

  -- Supprime le client (cascade sur ses bénéficiaires, conversations chat, etc.
  -- liés par client_id ON DELETE CASCADE).
  DELETE FROM clients WHERE user_id = p_user_id;

  -- LIBÈRE L'EMAIL : supprimer aussi l'utilisateur auth. Best-effort — si une
  -- FK sans cascade le retient encore, on ne casse pas la suppression du client.
  BEGIN
    DELETE FROM auth.identities WHERE user_id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
    v_auth_freed := true;
  EXCEPTION WHEN OTHERS THEN
    v_auth_freed := false;
    RAISE WARNING 'admin_delete_client: auth.users % non supprimé (référencé ailleurs): %', p_user_id, SQLERRM;
  END;

  RETURN json_build_object(
    'success', true,
    'email_freed', v_auth_freed,
    'message', CASE WHEN v_auth_freed
                    THEN 'Client supprimé ; email libéré (réutilisable).'
                    ELSE 'Client supprimé (email encore réservé : données liées restantes).'
               END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_client_password(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public', 'extensions'
AS $function$
declare
  temp_password text;
  encrypted_pw text;
  caller_role text;
  target_profile record;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null);

  if caller_role is null then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut réinitialiser les mots de passe');
  end if;

  if p_target_user_id is null then
    return jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur est requis');
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  -- Nom depuis clients (source de vérité client).
  select first_name, last_name into target_profile
  from public.clients
  where user_id = p_target_user_id;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  update auth.users set encrypted_password = encrypted_pw, updated_at = now()
  where id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    auth.uid(), 'reset_client_password', 'client', p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || coalesce(target_profile.first_name, '') || ' ' || coalesce(target_profile.last_name, '')
    )
  );

  return jsonb_build_object(
    'success', true, 'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || coalesce(target_profile.first_name, '') || ' ' || coalesce(target_profile.last_name, '')
  );

exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_password(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public', 'extensions'
AS $function$
declare
  temp_password text;
  encrypted_pw text;
  caller_role text;
  v_first text;
  v_last text;
  v_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null);

  if caller_role is null then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut réinitialiser les mots de passe');
  end if;

  if p_target_user_id is null then
    return jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur cible est requis');
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  -- Cible + nom depuis user_roles (source de vérité admin).
  select first_name, last_name, role
    into v_first, v_last, v_role
  from public.user_roles
  where user_id = p_target_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Utilisateur admin non trouvé');
  end if;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  update auth.users set encrypted_password = encrypted_pw, updated_at = now()
  where id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    auth.uid(), 'reset_admin_password', 'admin_user', p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || coalesce(v_first, '') || ' ' || coalesce(v_last, ''),
      'target_role', v_role
    )
  );

  return jsonb_build_object(
    'success', true, 'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || coalesce(v_first, '') || ' ' || coalesce(v_last, '')
  );

exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_admin_status(p_target_user_id uuid, p_disabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_target_role text;
  v_target_name text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;
  if v_caller_id = p_target_user_id then
    return jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre statut');
  end if;

  select role into v_caller_role from public.user_roles where user_id = v_caller_id and (is_disabled = false or is_disabled is null);
  if v_caller_role is distinct from 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  end if;

  select role, coalesce(first_name || ' ' || last_name, 'Admin')
    into v_target_role, v_target_name
  from public.user_roles where user_id = p_target_user_id;

  if v_target_role is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  update public.user_roles set is_disabled = p_disabled where user_id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller_id,
    case when p_disabled then 'disable_admin' else 'enable_admin' end,
    'admin_user', p_target_user_id,
    jsonb_build_object(
      'description', case when p_disabled then 'Désactivation de l''admin ' || v_target_name else 'Réactivation de l''admin ' || v_target_name end,
      'target_role', v_target_role,
      'new_status', case when p_disabled then 'DISABLED' else 'ACTIVE' end
    )
  );

  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_admin_role(p_target_user_id uuid, p_new_role app_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_old_role text;
  v_target_name text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;
  if v_caller_id = p_target_user_id then
    return jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre rôle');
  end if;

  select role into v_caller_role from public.user_roles where user_id = v_caller_id and (is_disabled = false or is_disabled is null);
  if v_caller_role is distinct from 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  end if;

  select role, coalesce(first_name || ' ' || last_name, 'Admin')
    into v_old_role, v_target_name
  from public.user_roles where user_id = p_target_user_id;

  if v_old_role is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  update public.user_roles set role = p_new_role where user_id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller_id, 'update_admin_role', 'admin_user', p_target_user_id,
    jsonb_build_object(
      'description', 'Modification du rôle de ' || v_target_name || ' de ' || v_old_role || ' à ' || p_new_role::text,
      'old_role', v_old_role, 'new_role', p_new_role::text
    )
  );

  return jsonb_build_object('success', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_admin_profile(p_target_user_id uuid, p_first_name text, p_last_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_target_role text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into v_caller_role from public.user_roles where user_id = v_caller_id and (is_disabled = false or is_disabled is null);
  if v_caller_role is distinct from 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  end if;

  select role into v_target_role from public.user_roles where user_id = p_target_user_id;
  if v_target_role is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  update public.user_roles
  set first_name = p_first_name, last_name = p_last_name
  where user_id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller_id, 'update_admin_profile', 'admin_user', p_target_user_id,
    jsonb_build_object('description', 'Modification du profil admin', 'first_name', p_first_name, 'last_name', p_last_name)
  );

  return jsonb_build_object('success', true);
end;
$function$;



-- ==========================================================================
-- SECTION 4/8 — 4. Permissions de LECTURE (SQL libre de Mola, grand livre client, stats dépôts).
-- Source : supabase/migrations/20260831180000_enforce_read_permissions.sql
-- ==========================================================================

-- ============================================================
-- P1 (suite) — Confidentialité : permissions de LECTURE côté serveur.
--
-- Rappel du problème (cf. 20260831160000) : is_admin() ne teste aucun rôle.
-- Restaient gardées par is_admin() des fonctions qui exposent des données
-- client ou pilotent des flux métier :
--
--   · assistant_readonly_query — le SQL libre de Mola. L'edge function
--     passe volontairement p_allowed_tables = NULL (« accès LECTURE complet
--     pour tout admin »), et le garde-fou de confidentialité est ignoré
--     quand ce paramètre est NULL. Résultat : un cash_agent ou un treasurer
--     (canViewClients = false) pouvait exécuter un SELECT arbitraire et
--     lire tout le PII client, les grands livres, les bénéficiaires…
--     Le paramètre restant à la main de l'appelant, la seule barrière
--     fiable est le rôle : la fonction exige désormais canViewClients.
--   · get_client_ledger — grand livre d'un client (PII + financier).
--   · get_deposit_stats, create_client_deposit, mark_suggestion_applied.
--
-- Méthode identique au batch 1 : le CORPS de chaque fonction est repris tel
-- quel via pg_get_functiondef ; seule la ligne de garde est remplacée, avec
-- assertion si le motif n'est pas trouvé (échec bruyant plutôt que silencieux).
-- ============================================================
DO $mig$
DECLARE
  r RECORD;
  v_def TEXT;
  v_new TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('assistant_readonly_query','canViewClients'),
      ('get_client_ledger','canViewClients'),
      ('get_deposit_stats','canViewDeposits'),
      ('create_client_deposit','canProcessDeposits'),
      ('mark_suggestion_applied','canManageRates')
    ) AS t(fname, perm)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.fname
    LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Fonction introuvable: %', r.fname;
    END IF;

    IF v_def LIKE '%admin_has_permission(%' THEN
      CONTINUE;  -- déjà durcie (migration rejouée)
    END IF;

    v_new := regexp_replace(
      v_def,
      '(?:public\.)?is_admin\((auth\.uid\(\)|v_admin_id|v_caller_id)\)',
      'public.admin_has_permission(\1, ''' || r.perm || ''')',
      'g'
    );

    IF v_new = v_def THEN
      RAISE EXCEPTION 'Garde is_admin introuvable dans %', r.fname;
    END IF;

    EXECUTE v_new;
    RAISE NOTICE 'durcie: % -> %', r.fname, r.perm;
  END LOOP;
END
$mig$;



-- ==========================================================================
-- SECTION 5/8 — 5. Trois courses TOCTOU sur l'argent : verrou FOR UPDATE avant lecture.
-- Source : supabase/migrations/20260831200000_fix_money_race_conditions.sql
-- ==========================================================================

-- ============================================================
-- P1 — Intégrité financière : trois courses (TOCTOU) sur l'argent.
--
-- La règle du projet (.claude/rules/security.md) impose un
-- « SELECT FOR UPDATE sur le wallet avant toute déduction ». Trois
-- fonctions ne la respectaient pas :
--
-- 1) create_wallet_adjustment (le crédit/débit manuel utilisé par la fiche
--    client) lisait le solde SANS verrou, calculait le nouveau solde dans
--    une variable, puis écrivait une valeur ABSOLUE :
--        SELECT * INTO v_wallet ...            -- pas de verrou
--        v_balance_after := v_balance_before - p_amount_xaf;
--        UPDATE wallets SET balance_xaf = v_balance_after;
--    => lost update. Deux débits concurrents de 100 000 sur un solde de
--    100 000 passent tous deux le contrôle « solde suffisant » et écrivent
--    tous deux 0 : 200 000 débités, 100 000 réellement retirés.
--
-- 2) process_payment lisait le paiement sans verrou, testait son statut,
--    puis faisait UPDATE ... WHERE id = p_payment_id SANS re-tester le
--    statut. Deux rejets concurrents passaient tous deux le contrôle et
--    remboursaient chacun le portefeuille (balance = balance + montant,
--    atomique mais exécuté DEUX fois) => double remboursement.
--
-- 3) confirm_cash_payment : même schéma (double confirmation possible).
--
-- Correctif : verrouiller la ligne mutée AVANT de la lire. Le second appel
-- concurrent bloque sur le SELECT, puis relit l'état déjà commité — son
-- contrôle de statut / de solde échoue alors correctement.
-- Seule la ligne de lecture change ; les corps sont préservés.
-- ============================================================
DO $mig$
DECLARE
  r RECORD;
  v_def TEXT;
  v_new TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('create_wallet_adjustment',
       'SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;',
       'SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;'),
      ('process_payment',
       'SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;',
       'SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;'),
      ('confirm_cash_payment',
       'SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;',
       'SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;')
    ) AS t(fname, needle, repl)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.fname
    LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Fonction introuvable: %', r.fname;
    END IF;

    IF position(r.repl in v_def) > 0 THEN
      CONTINUE;  -- déjà verrouillée (migration rejouée)
    END IF;

    IF position(r.needle in v_def) = 0 THEN
      RAISE EXCEPTION 'Motif de lecture introuvable dans % (corps modifié ?)', r.fname;
    END IF;

    v_new := replace(v_def, r.needle, r.repl);
    EXECUTE v_new;
    RAISE NOTICE 'verrou FOR UPDATE ajouté: %', r.fname;
  END LOOP;
END
$mig$;



-- ==========================================================================
-- SECTION 6/8 — 6. P0 chaîne cash sans autorisation + montants strictement positifs + propriété du dépôt + verrous de statut.
-- Source : supabase/migrations/20260831220000_secure_cash_chain_and_amounts.sql
-- ==========================================================================

-- ============================================================
-- P0/P1 — Chaîne « paiement cash » sans AUCUNE autorisation,
--         + garde-fous de montant manquants côté serveur.
--
-- CONSTAT (vérifié en base, voir §A) : scan_cash_payment et
-- confirm_cash_payment sont SECURITY DEFINER, exécutables par `anon` et
-- `authenticated`, et ne contiennent aucun contrôle : ni propriétaire, ni
-- is_admin, ni rôle. N'importe quel utilisateur connecté (un client de
-- l'app, pas seulement le staff) pouvait appeler confirm_cash_payment sur
-- un paiement quelconque et le passer à `completed` avec une URL de
-- signature et un nom de signataire arbitraires — c'est-à-dire déclarer
-- qu'une remise d'espèces a eu lieu au bureau alors qu'elle n'a jamais eu
-- lieu, en écrivant au passage une écriture PAYMENT_EXECUTED au grand
-- livre et `cash_paid_by = <lui-même>`.
--
-- Second défaut de la même chaîne : le seul statut refusé était
-- `completed`. Un paiement `rejected` ou `cancelled_by_admin` — dont le
-- portefeuille a DÉJÀ été recrédité par cancel_payment / process_payment —
-- pouvait donc être re-scanné puis re-confirmé : le client garde le
-- remboursement ET le paiement ressort « exécuté ». (8 paiements cash sont
-- actuellement `cancelled_by_admin`, dont 2 déjà scannés.)
--
-- Correctif : les deux fonctions exigent `canProcessPayments` (matrice
-- ROLE_PERMISSIONS : super_admin, ops, cash_agent) et refusent les trois
-- statuts terminaux. Choix vérifié sur l'historique : tous les scans et
-- encaissements passés ont été faits par cash_agent / ops / super_admin —
-- aucun flux existant n'est cassé.
--
-- §B — Montants : plusieurs RPC acceptaient un montant NÉGATIF, ce qui
-- inverse le sens de l'opération sans que le libellé ni le grand livre ne
-- le montrent (admin_adjust_wallet 'debit' avec -1 000 000 CRÉDITE le
-- portefeuille tout en journalisant ADMIN_DEBIT). On impose la positivité.
-- On n'impose PAS de plafond côté serveur : un dépôt réel de 133 500 000
-- XAF existe en base, au-dessus du plafond de 50 M des formulaires — le
-- poser ici casserait un cas métier légitime.
--
-- §C — create_client_deposit acceptait p_user_id sans le lier à l'appelant :
-- un client pouvait créer un dépôt au nom d'un autre. Le paramètre reste
-- libre pour le staff (l'admin saisit un dépôt POUR un client), forcé à
-- auth.uid() sinon.
--
-- §D — submit_deposit_proof / revert_deposit_to_created lisaient le statut
-- sans verrou puis l'écrasaient sans le re-tester : concurrents avec
-- validate_deposit (qui, lui, verrouille), ils pouvaient ramener à
-- `created` / `proof_submitted` un dépôt VENANT d'être validé et déjà
-- crédité — le dépôt redevenait alors validable une seconde fois
-- (double crédit). On verrouille la ligne avant de la lire.
-- ============================================================

-- ── §A. Chaîne cash : autorisation + statuts terminaux ──────────────────

CREATE OR REPLACE FUNCTION public.scan_cash_payment(p_payment_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment payments%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canProcessPayments') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;

  -- Statuts terminaux : un paiement encaissé, rejeté ou annulé (donc déjà
  -- remboursé) ne doit pas pouvoir rentrer dans le circuit d'encaissement.
  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;

  IF v_payment.status IN ('rejected', 'cancelled_by_admin') THEN
    RETURN json_build_object('success', false, 'error',
      'Ce paiement a été annulé ou rejeté : il ne peut plus être encaissé');
  END IF;

  UPDATE payments
  SET
    status          = 'cash_scanned',
    cash_scanned_at = now(),
    cash_scanned_by = auth.uid(),
    updated_at      = now()
  WHERE id = p_payment_id;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_scanned', 'QR Code scanné au bureau', auth.uid());

  RETURN json_build_object(
    'success', true,
    'payment', row_to_json(v_payment)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_payment_id uuid, p_signature_url text, p_signed_by_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment payments%ROWTYPE;
  v_wallet  wallets%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canProcessPayments') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- Verrou AVANT lecture : sans lui, deux confirmations concurrentes
  -- passaient toutes deux le contrôle de statut (double écriture au
  -- grand livre).
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;

  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;

  IF v_payment.status IN ('rejected', 'cancelled_by_admin') THEN
    RETURN json_build_object('success', false, 'error',
      'Ce paiement a été annulé ou rejeté : il ne peut plus être encaissé');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_payment.user_id;

  UPDATE payments
  SET
    status                   = 'completed',
    cash_signature_url       = p_signature_url,
    cash_signature_timestamp = now(),
    cash_signed_by_name      = p_signed_by_name,
    cash_paid_at             = now(),
    cash_paid_by             = auth.uid(),
    processed_at             = now(),
    processed_by             = auth.uid(),
    updated_at               = now()
  WHERE id = p_payment_id;

  -- Écriture PAYMENT_EXECUTED (identique à process_payment('complete')) :
  -- balance_before = balance_after, le débit ayant eu lieu à la création
  -- du paiement (PAYMENT_RESERVED).
  IF v_wallet IS NOT NULL THEN
    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id, metadata
    ) VALUES (
      v_wallet.id,
      v_payment.user_id,
      'PAYMENT_EXECUTED',
      v_payment.amount_xaf,
      v_wallet.balance_xaf,
      v_wallet.balance_xaf,
      'payment',
      p_payment_id,
      format('Paiement exécuté - Réf: %s', v_payment.reference),
      auth.uid(),
      jsonb_build_object(
        'method',         'cash',
        'amount_rmb',     v_payment.amount_rmb,
        'cash_signed_by', p_signed_by_name
      )
    );
  END IF;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_paid', 'Paiement cash effectué - Signature enregistrée', auth.uid());

  RETURN json_build_object('success', true);
END;
$function$;

-- ── §B/§C/§D. Insertions chirurgicales dans les corps existants ─────────
-- Le corps est repris tel quel via pg_get_functiondef ; seul le motif visé
-- est remplacé, avec échec bruyant si le motif a disparu (corps modifié).
DO $mig$
DECLARE
  r RECORD;
  v_def TEXT;
  v_new TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- §B — positivité des montants.
      ('validate_deposit',
       '  v_credit_amount := COALESCE(p_confirmed_amount, v_deposit.amount_xaf);',
       '  v_credit_amount := COALESCE(p_confirmed_amount, v_deposit.amount_xaf);' || E'\r\n' ||
       E'\r\n' ||
       '  IF v_credit_amount IS NULL OR v_credit_amount <= 0 THEN' || E'\r\n' ||
       '    RETURN jsonb_build_object(''success'', false, ''error'',' || E'\r\n' ||
       '      ''Le montant à créditer doit être strictement positif'');' || E'\r\n' ||
       '  END IF;'),

      ('admin_adjust_wallet',
       '  v_amount_xaf := p_amount::BIGINT;',
       '  IF p_amount IS NULL OR p_amount <= 0 THEN' || E'\r\n' ||
       '    RETURN jsonb_build_object(''success'', false, ''error'',' || E'\r\n' ||
       '      ''Le montant doit être strictement positif'');' || E'\r\n' ||
       '  END IF;' || E'\r\n' ||
       E'\r\n' ||
       '  v_amount_xaf := p_amount::BIGINT;'),

      -- §C — le dépôt appartient à l'appelant, sauf si c'est le staff qui
      -- le saisit POUR un client.
      ('create_client_deposit',
       '  v_created_at := COALESCE(p_desired_date, now());',
       '  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 THEN' || E'\n' ||
       '    RETURN json_build_object(''success'', false, ''error'',' || E'\n' ||
       '      ''Le montant du dépôt doit être strictement positif'');' || E'\n' ||
       '  END IF;' || E'\n' ||
       E'\n' ||
       '  IF p_user_id IS DISTINCT FROM auth.uid()' || E'\n' ||
       '     AND NOT public.admin_has_permission(auth.uid(), ''canProcessDeposits'') THEN' || E'\n' ||
       '    RETURN json_build_object(''success'', false, ''error'',' || E'\n' ||
       '      ''Vous ne pouvez créer un dépôt que pour vous-même'');' || E'\n' ||
       '  END IF;' || E'\n' ||
       E'\n' ||
       '  v_created_at := COALESCE(p_desired_date, now());'),

      -- §D — verrouiller avant de lire le statut que l'on va écraser.
      ('submit_deposit_proof',
       '  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;',
       '  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;'),

      ('revert_deposit_to_created',
       '  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;',
       '  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;')
    ) AS t(fname, needle, repl)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.fname AND p.prokind = 'f'
    LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Fonction introuvable: %', r.fname;
    END IF;

    IF position(r.repl in v_def) > 0 THEN
      CONTINUE;  -- déjà appliqué (migration rejouée)
    END IF;

    IF position(r.needle in v_def) = 0 THEN
      RAISE EXCEPTION 'Motif introuvable dans % (corps modifié ?)', r.fname;
    END IF;

    v_new := replace(v_def, r.needle, r.repl);
    EXECUTE v_new;
    RAISE NOTICE 'durci: %', r.fname;
  END LOOP;
END
$mig$;



-- ==========================================================================
-- SECTION 7/8 — 7. Retrait de l'EXECUTE anon/authenticated sur les fonctions cron et helpers de trigger.
-- Source : supabase/migrations/20260831230000_revoke_internal_function_exposure.sql
-- ==========================================================================

-- ============================================================
-- P1 — Fonctions internes (cron / triggers) exposées à l'API PostgREST.
--
-- Supabase accorde par défaut l'EXECUTE à `anon` et `authenticated` sur
-- toute fonction du schéma `public` : elles deviennent donc appelables en
-- HTTP via /rest/v1/rpc/<nom>. Pour une fonction de maintenance, cette
-- valeur par défaut EST la faille — il n'y a aucun autre garde-fou dans le
-- corps, puisque « seul le cron l'appelle ».
--
-- Constaté :
--   · claim_email_batch / claim_sms_batch renvoient SETOF email_outbox /
--     sms_outbox et étaient exécutables par `anon` : un appel NON
--     AUTHENTIFIÉ récupérait un lot de messages en attente avec
--     recipient_email / recipient_phone et le payload (prénom, montants,
--     référence, nouveau solde). Fuite de PII et de données financières.
--     (Aucun code de vérification ne transite par ces files — vérifié sur
--     les clés des payloads — donc pas de contournement d'authentification.)
--   · run_email_drainer / run_sms_drainer / run_*_reminders : exécutables
--     par `anon`, déclenchent des envois de masse.
--   · mola_purge_old_conversations(p_days) : exécutable par tout compte
--     connecté. Un simple appel avec p_days = 1 SUPPRIME l'historique des
--     conversations de l'assistant et la mémoire expirée.
--   · _create_client_and_wallet / _enqueue_welcome : helpers internes du
--     trigger handle_new_user, exposés à `anon` ; le premier insère une
--     ligne `clients` + `wallets` pour un user_id arbitraire.
--
-- Correctif : retirer l'EXECUTE à `anon` et `authenticated`. Les appelants
-- légitimes ne sont pas concernés — vérifié un par un :
--   · pg_cron exécute ces fonctions en tant que `postgres` (jobs
--     email-drainer, sms-drainer, deposit-reminders, profile-reminders,
--     sms-deposit-reminders, mola-purge-conversations) ;
--   · les edge functions send-email et send-sms utilisent la clé
--     SERVICE_ROLE (donc le rôle `service_role`, conservé) ;
--   · handle_new_user est SECURITY DEFINER et appartient à `postgres` :
--     les helpers restent appelables depuis le trigger.
-- Aucun appel à ces fonctions n'existe dans src/ ni dans les autres edge
-- functions (vérifié par recherche).
--
-- Modèle déjà appliqué ailleurs dans ce projet : purge_webauthn_challenges
-- n'accorde l'EXECUTE qu'à postgres et service_role.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.claim_email_batch(integer)        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_sms_batch(integer)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_email_drainer()               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_sms_drainer()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_deposit_reminders()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_profile_reminders()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_sms_deposit_reminders()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mola_purge_old_conversations(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._create_client_and_wallet(uuid, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._enqueue_welcome(uuid, text)      FROM anon, authenticated;

-- Le GRANT implicite à PUBLIC (colonne « =X/postgres ») rendrait la
-- révocation ci-dessus inopérante : anon et authenticated héritent de
-- PUBLIC. On le retire aussi là où il subsiste.
REVOKE EXECUTE ON FUNCTION public._create_client_and_wallet(uuid, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._enqueue_welcome(uuid, text)                 FROM PUBLIC;

-- Garde-fou : la révocation seule protège l'API, mais un futur GRANT
-- (ou un `GRANT ... ON ALL FUNCTIONS`) la réouvrirait silencieusement.
-- La purge, qui DÉTRUIT des données, porte donc aussi un contrôle dans son
-- corps : réservée au super_admin quand elle est appelée par un humain,
-- toujours autorisée pour le cron (postgres) et service_role.
CREATE OR REPLACE FUNCTION public.mola_purge_old_conversations(p_days integer DEFAULT 180)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv int;
  v_mem  int;
BEGIN
  -- auth.uid() est NULL pour le cron et service_role : on ne bloque que
  -- les appels porteurs d'une session utilisateur.
  IF auth.uid() IS NOT NULL
     AND NOT public.admin_has_permission(auth.uid(), 'canManageUsers') THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  DELETE FROM public.assistant_conversations
  WHERE updated_at < now() - make_interval(days => greatest(1, p_days));
  GET DIAGNOSTICS v_conv = ROW_COUNT;

  DELETE FROM public.mola_memory
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_mem = ROW_COUNT;

  RETURN jsonb_build_object('conversations_deleted', v_conv, 'expired_memory_deleted', v_mem);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mola_purge_old_conversations(integer) FROM anon, authenticated;



-- ==========================================================================
-- SECTION 8/8 — 8. Hygiène : search_path figé sur les deux derniers triggers.
-- Source : supabase/migrations/20260831234500_pin_trigger_search_path.sql
-- ==========================================================================

-- ============================================================
-- Hygiène — figer le search_path des deux derniers triggers qui ne
-- l'avaient pas (`function_search_path_mutable`).
--
-- Ces deux fonctions ne sont PAS exploitables : SECURITY INVOKER, et leur
-- corps se limite à `NEW.updated_at = now()` — aucune référence à une
-- table ou à une fonction applicative qu'un search_path détourné pourrait
-- remplacer. On les corrige quand même pour vider la liste des advisors :
-- tant qu'elle contient du bruit connu, un futur avertissement
-- search_path sur une fonction SECURITY DEFINER (lui, exploitable)
-- passerait inaperçu.
-- ============================================================
ALTER FUNCTION public.update_clients_updated_at()       SET search_path TO 'public';
ALTER FUNCTION public.update_beneficiaries_updated_at() SET search_path TO 'public';

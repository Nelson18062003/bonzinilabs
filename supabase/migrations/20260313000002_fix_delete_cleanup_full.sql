-- ============================================================
-- Harmonisation des suppressions : impact complet sur l'historique
--
-- Problème : quand un dépôt ou paiement est supprimé, les entrées
-- dans ledger_entries (= relevé de compte client) restaient orphelines.
-- Le client voyait des lignes dans son historique pour des opérations
-- qui n'existaient plus. Idem pour les notifications.
--
-- Fix :
--   1. delete_deposit RPC  — supprime ledger_entries + notifications liées,
--                            retire la création d'une entrée ADMIN_DEBIT
--   2. delete_payment RPC  — supprime ledger_entries + notifications liées,
--                            retire la création d'une entrée PAYMENT_CANCELLED_REFUNDED
--   3. Cleanup one-time    — purge les orphelins déjà existants en base
-- ============================================================

-- ============================================================
-- 1. delete_deposit RPC — version complète
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_deposit(p_deposit_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_deposit  RECORD;
  v_is_super BOOLEAN;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut supprimer des dépôts');
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Si le dépôt était validé, inverser le crédit sur le wallet
  -- (ajustement direct sans créer de nouvelle entrée ledger — on efface tout)
  IF v_deposit.status = 'validated' THEN
    UPDATE public.wallets
    SET balance_xaf = GREATEST(0, balance_xaf - v_deposit.amount_xaf), updated_at = now()
    WHERE user_id = v_deposit.user_id;
  END IF;

  -- Supprimer les entrées ledger liées (= lignes du relevé de compte)
  DELETE FROM public.ledger_entries
  WHERE reference_type = 'deposit' AND reference_id = p_deposit_id;

  -- Supprimer les notifications liées à ce dépôt
  DELETE FROM public.notifications
  WHERE user_id = v_deposit.user_id
    AND metadata->>'deposit_id' = p_deposit_id::text;

  -- Supprimer les preuves, la timeline, puis le dépôt lui-même
  -- (storage files nettoyés côté frontend avant cet appel)
  DELETE FROM public.deposit_proofs          WHERE deposit_id = p_deposit_id;
  DELETE FROM public.deposit_timeline_events WHERE deposit_id = p_deposit_id;
  DELETE FROM public.deposits                WHERE id = p_deposit_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'reference',             v_deposit.reference,
      'amount_xaf',            v_deposit.amount_xaf,
      'user_id',               v_deposit.user_id,
      'status_at_deletion',    v_deposit.status,
      'forced_by_super_admin', true
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 2. delete_payment RPC — version complète
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_payment  RECORD;
  v_is_super BOOLEAN;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin_id AND role = 'super_admin' AND (is_disabled = false OR is_disabled IS NULL)
  ) INTO v_is_super;

  IF NOT v_is_super THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut supprimer des paiements');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Rembourser le wallet pour les paiements non-rejected et non-completed
  -- (rejected = déjà remboursé ; completed = argent déjà envoyé)
  -- Ajustement direct sans créer de nouvelle entrée ledger — on efface tout
  IF v_payment.status NOT IN ('rejected', 'completed') THEN
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id;
  END IF;

  -- Supprimer toutes les entrées ledger liées à ce paiement (= lignes du relevé)
  DELETE FROM public.ledger_entries
  WHERE reference_type = 'payment' AND reference_id = p_payment_id;

  -- Supprimer les notifications liées à ce paiement
  DELETE FROM public.notifications
  WHERE user_id = v_payment.user_id
    AND metadata->>'payment_id' = p_payment_id::text;

  -- Supprimer les preuves, la timeline, puis le paiement lui-même
  -- (storage files nettoyés côté frontend avant cet appel)
  DELETE FROM public.payment_timeline_events WHERE payment_id = p_payment_id;
  DELETE FROM public.payment_proofs          WHERE payment_id = p_payment_id;
  DELETE FROM public.payments                WHERE id = p_payment_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'delete_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference',             v_payment.reference,
      'amount_xaf',            v_payment.amount_xaf,
      'user_id',               v_payment.user_id,
      'status_at_deletion',    v_payment.status,
      'forced_by_super_admin', true
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 3. Cleanup one-time — purge des orphelins existants
--    (entrées créées par des suppressions passées avant ce fix)
-- ============================================================

-- Ledger entries orphelines dont le dépôt a déjà été supprimé
DELETE FROM public.ledger_entries
WHERE reference_type = 'deposit'
  AND reference_id IS NOT NULL
  AND reference_id NOT IN (SELECT id FROM public.deposits);

-- Ledger entries orphelines dont le paiement a déjà été supprimé
DELETE FROM public.ledger_entries
WHERE reference_type = 'payment'
  AND reference_id IS NOT NULL
  AND reference_id NOT IN (SELECT id FROM public.payments);

-- Notifications orphelines dont le dépôt a déjà été supprimé
DELETE FROM public.notifications
WHERE metadata->>'deposit_id' IS NOT NULL
  AND (metadata->>'deposit_id')::uuid NOT IN (SELECT id FROM public.deposits);

-- Notifications orphelines dont le paiement a déjà été supprimé
DELETE FROM public.notifications
WHERE metadata->>'payment_id' IS NOT NULL
  AND (metadata->>'payment_id')::uuid NOT IN (SELECT id FROM public.payments);

NOTIFY pgrst, 'reload schema';

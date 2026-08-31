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

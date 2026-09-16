-- ============================================================
-- BONZINI LABS — MIGRATION CONSOLIDÉE DU 15/09/2026
-- Tout ce qui a été ajouté côté base depuis la fusion de la PR #198
-- (migrations/20260913_consolidated.sql, déjà appliquée). À exécuter UNE
-- fois dans l'éditeur SQL Supabase, dans cet ordre. Chaque section est
-- idempotente : CREATE INDEX IF NOT EXISTS, DROP POLICY IF EXISTS +
-- CREATE POLICY, CREATE OR REPLACE FUNCTION à signature identique,
-- COMMENT ON qui remplace toujours.
--
-- Contenu :
--   1. Cargo : index + publication temps réel        (= 20260914090000)
--   2. platform_settings : lecture limitée aux clés   (= 20260914090500)
--      publiques pour les clients
--   3. Gardes des statuts terminaux + verrou du       (= 20260914091000
--      portefeuille dans process_payment                 + 20260914093000)
--   4. admin_correct_payment sans plafond de 50 M     (= 20260914120000)
--
-- Hors périmètre (toujours en attente de validation, NON inclus) :
-- docs/proposals/2026-09-14-*.sql (politiques payments, dépôts, clients)
-- et la garde d'appelant des edge functions (docs/proposals/…edge-functions-auth.md).
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 1 · 14/09 — index cargo + publication temps réel
-- (= supabase/migrations/20260914090000_cargo_indexes_realtime.sql)
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Cargo : index sur les colonnes filtrées, et tables dans la publication
-- temps réel (le cron cargo-sync et un second admin écrivent sans passer
-- par l'app : sans publication, aucune liste ne se rafraîchit d'elle-même).
-- Idempotent.
-- ============================================================
CREATE INDEX IF NOT EXISTS cargo_shipments_client_id_idx ON public.cargo_shipments (client_id);
CREATE INDEX IF NOT EXISTS cargo_shipments_bl_number_idx ON public.cargo_shipments (bl_number);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cargo_shipments', 'cargo_events', 'cargo_costs', 'cargo_packages', 'cargo_documents', 'cargo_lookups'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- SECTION 2 · 14/09 — platform_settings : lecture limitée aux clés publiques
-- (= supabase/migrations/20260914090500_platform_settings_read_scope.sql)
-- ─────────────────────────────────────────────────────────────────
-- ============================================================
-- platform_settings : la lecture par tout utilisateur connecté (app client
-- comprise) se limite aux clés PUBLIQUES. La politique initiale ouvrait toute
-- la table (USING (true)) : une future clé (seuils, fournisseurs…) aurait été
-- lisible par n'importe quel client. Idempotent.
-- ============================================================
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT TO authenticated USING (key IN ('shipping'));

-- ─────────────────────────────────────────────────────────────────────────
-- SECTION 3 · 14/09 — gardes des statuts terminaux (dépôts annulés, paiements clos)
-- (= supabase/migrations/20260914091000_terminal_status_guards.sql)
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Statuts terminaux : on ferme les portes que l'audit du 14/09 a trouvées
-- ouvertes (cf. .claude/rules/security.md, « Statuts terminaux »).
--   • validate_deposit / reject_deposit : un dépôt 'cancelled' ou
--     'cancelled_by_admin' ne peut plus être validé (crédit) ni refusé.
--   • process_payment(reject) : un paiement 'rejected' ou 'cancelled_by_admin'
--     a déjà été remboursé — le refuser à nouveau remboursait une seconde fois.
-- Corps des fonctions repris de 20260831160000 PLUS les correctifs appliqués
-- « en place » ensuite (20260831200000 : FOR UPDATE sur le paiement ;
-- 20260831220000 : montant crédité > 0) — une redéfinition complète doit les
-- reconduire, sinon elle les efface. Idempotent (CREATE OR REPLACE, même signature).
-- ============================================================

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

  IF v_deposit.status IN ('cancelled', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a été annulé : il ne peut plus être traité');
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

  IF v_credit_amount IS NULL OR v_credit_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le montant à créditer doit être strictement positif');
  END IF;

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

  IF v_deposit.status IN ('cancelled', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt a été annulé : il ne peut plus être traité');
  END IF;

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

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

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
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;
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
    -- Statuts TERMINAUX : 'rejected' et 'cancelled_by_admin' ont DÉJÀ recrédité le
    -- portefeuille — refuser à nouveau rembourserait une seconde fois.
    IF v_payment.status IN ('completed', 'rejected', 'cancelled_by_admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce paiement est clos (' || v_payment.status || ') : impossible de le refuser');
    END IF;

    IF p_comment IS NULL OR p_comment = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une raison est requise pour le refus');
    END IF;

    -- Get wallet for ledger entry
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;

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

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────
-- SECTION 4 · 14/09 — admin_correct_payment : plus de plafond de 50 M XAF
-- (redéfinition complète, cf. supabase/migrations/20260914120000_admin_correct_payment_no_cap.sql)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_correct_payment(
  p_payment_id     UUID,
  p_reason         TEXT,
  p_amount_xaf     BIGINT  DEFAULT NULL,
  p_amount_rmb     NUMERIC DEFAULT NULL,
  p_exchange_rate  NUMERIC DEFAULT NULL,
  p_rate_is_custom BOOLEAN DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id    UUID;
  v_is_super    BOOLEAN;
  v_payment     RECORD;
  v_wallet      RECORD;
  v_delta       BIGINT := 0;
  v_debit_held  BOOLEAN;
  v_new_balance BIGINT;
  v_changes     jsonb := '{}'::jsonb;
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
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut corriger un paiement');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un motif de correction est obligatoire');
  END IF;

  IF p_amount_xaf IS NULL AND p_amount_rmb IS NULL AND p_exchange_rate IS NULL AND p_rate_is_custom IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune modification demandée');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Garde-fous montant : entier positif, sans plafond (décision du 14/09/2026,
  -- alignée sur les formulaires : des paiements et dépôts réels dépassent 50 M).
  IF p_amount_xaf IS NOT NULL AND p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant XAF invalide');
  END IF;
  IF p_amount_rmb IS NOT NULL AND p_amount_rmb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant RMB invalide');
  END IF;
  IF p_exchange_rate IS NOT NULL AND p_exchange_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux invalide');
  END IF;

  -- Le débit est-il encore « détenu » par ce paiement ?
  -- (rejected / cancelled_by_admin ont déjà été remboursés)
  v_debit_held := v_payment.status NOT IN ('rejected', 'cancelled_by_admin');

  -- ── Correction du montant XAF (mouvement d'argent) ─────────
  IF p_amount_xaf IS NOT NULL AND p_amount_xaf <> v_payment.amount_xaf THEN
    v_delta := p_amount_xaf - v_payment.amount_xaf;

    IF v_debit_held THEN
      SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;
      IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
      END IF;

      IF v_delta > 0 AND v_wallet.balance_xaf < v_delta THEN
        RETURN jsonb_build_object('success', false, 'error',
          'Solde insuffisant pour le débit complémentaire de ' || v_delta || ' XAF (solde: ' || v_wallet.balance_xaf || ' XAF)');
      END IF;

      v_new_balance := v_wallet.balance_xaf - v_delta;

      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf,
        balance_before, balance_after,
        reference_type, reference_id,
        description, metadata, created_by_admin_id
      ) VALUES (
        v_wallet.id, v_payment.user_id,
        CASE WHEN v_delta > 0 THEN 'ADMIN_DEBIT' ELSE 'ADMIN_CREDIT' END,
        abs(v_delta),
        v_wallet.balance_xaf, v_new_balance,
        'payment', p_payment_id,
        'Correction paiement - Réf: ' || COALESCE(v_payment.reference, p_payment_id::text),
        jsonb_build_object(
          'reason', p_reason,
          'correction', true,
          'old_amount_xaf', v_payment.amount_xaf,
          'new_amount_xaf', p_amount_xaf,
          'payment_status', v_payment.status
        ),
        v_admin_id
      );

      UPDATE public.wallets
      SET balance_xaf = v_new_balance, updated_at = now()
      WHERE id = v_wallet.id;

      -- Recale l'instantané « solde après débit » de la fiche
      UPDATE public.payments
      SET balance_after = balance_after - v_delta
      WHERE id = p_payment_id AND balance_after IS NOT NULL;
    END IF;

    UPDATE public.payments SET amount_xaf = p_amount_xaf, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('amount_xaf', jsonb_build_object('old', v_payment.amount_xaf, 'new', p_amount_xaf));

    -- Totaux du lot, s'il y en a un
    IF v_payment.batch_id IS NOT NULL THEN
      UPDATE public.payment_batches
      SET total_amount_xaf = total_amount_xaf + v_delta
      WHERE id = v_payment.batch_id;
    END IF;
  END IF;

  -- ── Corrections d'affichage (aucun mouvement d'argent) ─────
  IF p_amount_rmb IS NOT NULL AND p_amount_rmb <> v_payment.amount_rmb THEN
    UPDATE public.payments SET amount_rmb = p_amount_rmb, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('amount_rmb', jsonb_build_object('old', v_payment.amount_rmb, 'new', p_amount_rmb));
    IF v_payment.batch_id IS NOT NULL THEN
      UPDATE public.payment_batches
      SET total_amount_rmb = total_amount_rmb + (p_amount_rmb - v_payment.amount_rmb)
      WHERE id = v_payment.batch_id;
    END IF;
  END IF;

  IF p_exchange_rate IS NOT NULL AND p_exchange_rate <> v_payment.exchange_rate THEN
    UPDATE public.payments SET exchange_rate = p_exchange_rate, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('exchange_rate', jsonb_build_object('old', v_payment.exchange_rate, 'new', p_exchange_rate));
  END IF;

  IF p_rate_is_custom IS NOT NULL AND p_rate_is_custom <> COALESCE(v_payment.rate_is_custom, false) THEN
    UPDATE public.payments SET rate_is_custom = p_rate_is_custom, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('rate_is_custom', jsonb_build_object('old', v_payment.rate_is_custom, 'new', p_rate_is_custom));
  END IF;

  IF v_changes = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune valeur ne change');
  END IF;

  -- Trace visible dans la timeline du paiement
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id, 'admin_corrected',
    'Paiement corrigé par le super admin — ' || p_reason,
    v_admin_id
  );

  -- Audit complet (ancien/nouveau + contexte)
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'correct_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference', v_payment.reference,
      'reason', p_reason,
      'status_at_correction', v_payment.status,
      'wallet_delta_xaf', CASE WHEN v_debit_held THEN v_delta ELSE 0 END,
      'changes', v_changes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'changes', v_changes,
    'wallet_delta_xaf', CASE WHEN v_debit_held THEN v_delta ELSE 0 END
  );
END;
$$;

-- Étiquette Mola (convention AI-native) : action sensible → confirm + danger.
-- La RPC re-vérifie elle-même le rôle super_admin quoi qu'il arrive.
COMMENT ON FUNCTION public.admin_correct_payment(UUID, TEXT, BIGINT, NUMERIC, NUMERIC, BOOLEAN) IS
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Corriger un paiement (montants / taux)","resolve":{"p_payment_id":"payment"}}';

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Migration: Payment RPCs write to ledger_entries instead of wallet_operations
-- Aligns payments with the same pattern used by validate_deposit/reject_deposit
-- ============================================================

-- ============================================
-- 1. create_payment() — use ledger_entries instead of wallet_operations
-- ============================================

DROP FUNCTION IF EXISTS public.create_payment(BIGINT, NUMERIC, NUMERIC, payment_method, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_payment(
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL,
  p_cash_beneficiary_type TEXT DEFAULT NULL,
  p_cash_beneficiary_first_name TEXT DEFAULT NULL,
  p_cash_beneficiary_last_name TEXT DEFAULT NULL,
  p_cash_beneficiary_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  -- Check balance
  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;

  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;

  -- Generate reference
  v_reference := generate_payment_reference();

  -- Determine initial status based on beneficiary info
  v_has_beneficiary_info := (
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

  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    cash_beneficiary_type, cash_beneficiary_first_name, cash_beneficiary_last_name, cash_beneficiary_phone,
    balance_before, balance_after
  ) VALUES (
    v_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    p_cash_beneficiary_type, p_cash_beneficiary_first_name, p_cash_beneficiary_last_name, p_cash_beneficiary_phone,
    v_wallet.balance_xaf, v_new_balance
  ) RETURNING id INTO v_payment_id;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Create ledger entry (replaces wallet_operations)
  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_wallet.id, v_user_id, 'PAYMENT_RESERVED', p_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'payment', v_payment_id,
    'Paiement ' || v_reference,
    jsonb_build_object(
      'method', p_method::text,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate
    )
  );

  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_payment_id, 'created', 'Paiement créé - Montant réservé', v_user_id);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_user_id);
  END IF;

  -- Create notification for the client
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_user_id,
    'payment_created',
    'Paiement créé',
    format('Votre paiement %s de %s XAF (%s RMB) a été créé. Nouveau solde: %s XAF',
      v_reference,
      to_char(p_amount_xaf, 'FM999G999G999'),
      to_char(p_amount_rmb, 'FM999G999G990D00'),
      to_char(v_new_balance, 'FM999G999G999')),
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
$$;

COMMENT ON FUNCTION public.create_payment IS 'Creates a payment, debits wallet, logs to ledger_entries, and sends notification.';

-- ============================================
-- 2. process_payment() — use ledger_entries for refund instead of wallet_operations
-- ============================================

DROP FUNCTION IF EXISTS public.process_payment(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.process_payment(p_payment_id UUID, p_action TEXT, p_comment TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_admin_id UUID;
  v_new_balance BIGINT;
  v_wallet RECORD;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
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
$$;

COMMENT ON FUNCTION public.process_payment IS 'Processes a payment (start, complete, reject) with ledger entries and notifications.';

-- ============================================
-- 3. create_admin_payment() — use ledger_entries instead of wallet_operations
-- ============================================

DROP FUNCTION IF EXISTS public.create_admin_payment(UUID, BIGINT, NUMERIC, NUMERIC, payment_method, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE);

CREATE OR REPLACE FUNCTION public.create_admin_payment(
  p_user_id UUID,
  p_amount_xaf BIGINT,
  p_amount_rmb NUMERIC,
  p_exchange_rate NUMERIC,
  p_method payment_method,
  p_beneficiary_name TEXT DEFAULT NULL,
  p_beneficiary_phone TEXT DEFAULT NULL,
  p_beneficiary_email TEXT DEFAULT NULL,
  p_beneficiary_qr_code_url TEXT DEFAULT NULL,
  p_beneficiary_bank_name TEXT DEFAULT NULL,
  p_beneficiary_bank_account TEXT DEFAULT NULL,
  p_beneficiary_notes TEXT DEFAULT NULL,
  p_client_visible_comment TEXT DEFAULT NULL,
  p_desired_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Validate inputs
  IF p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;

  -- Check balance
  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde client insuffisant');
  END IF;

  -- Calculate new balance
  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;

  -- Generate reference
  v_reference := generate_payment_reference();

  -- Determine initial status
  v_has_beneficiary_info := (
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

  -- Use desired date or now
  v_created_at := COALESCE(p_desired_date, now());

  -- Create payment
  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after, client_visible_comment, created_at
  ) VALUES (
    p_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance, p_client_visible_comment, v_created_at
  ) RETURNING id INTO v_payment_id;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Create ledger entry (replaces wallet_operations)
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
      'admin_created', true
    ),
    v_created_at
  );

  -- Add timeline event
  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
  VALUES (v_payment_id, 'created', 'Paiement créé par l''équipe Bonzini - Montant réservé', v_admin_id, v_created_at);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id, v_created_at);
  END IF;

  -- Add audit log
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
      'balance_after', v_new_balance
    )
  );

  -- Create notification for the client
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
$$;

COMMENT ON FUNCTION public.create_admin_payment IS 'Creates a payment for a client (admin only) with ledger entry and notification.';

-- ============================================
-- 4. admin_adjust_wallet() — redirect to ledger_entries
-- Drop first because return type changed from JSON to JSONB
-- ============================================

DROP FUNCTION IF EXISTS public.admin_adjust_wallet(UUID, NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_adjustment_type TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_amount_xaf BIGINT;
  v_entry_type public.ledger_entry_type;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
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
$$;

-- Also update validate_deposit to stop writing to wallet_operations
-- (keeping only ledger_entries)
-- Note: we read the current validate_deposit and remove the wallet_operations INSERT

NOTIFY pgrst, 'reload schema';

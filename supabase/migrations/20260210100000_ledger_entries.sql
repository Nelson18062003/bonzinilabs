-- Migration: Ledger Entries and Wallet Adjustments
-- Date: 2026-02-10
-- Feature B: Module CLIENTS - Ledger complet des mouvements

-- =============================================
-- 1. Create ledger entry type enum
-- =============================================
CREATE TYPE public.ledger_entry_type AS ENUM (
  'DEPOSIT_VALIDATED',
  'DEPOSIT_REFUSED',
  'PAYMENT_RESERVED',
  'PAYMENT_EXECUTED',
  'PAYMENT_CANCELLED_REFUNDED',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT'
);

-- =============================================
-- 2. Create ledger_entries table
-- =============================================
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type ledger_entry_type NOT NULL,
  amount_xaf BIGINT NOT NULL,
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  reference_type VARCHAR(50), -- 'deposit', 'payment', 'adjustment'
  reference_id UUID,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_by_admin_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ledger_entries
CREATE INDEX idx_ledger_entries_wallet ON public.ledger_entries(wallet_id);
CREATE INDEX idx_ledger_entries_user ON public.ledger_entries(user_id);
CREATE INDEX idx_ledger_entries_type ON public.ledger_entries(entry_type);
CREATE INDEX idx_ledger_entries_created ON public.ledger_entries(created_at DESC);
CREATE INDEX idx_ledger_entries_reference ON public.ledger_entries(reference_type, reference_id);

-- =============================================
-- 3. Create wallet_adjustments table
-- =============================================
CREATE TABLE public.wallet_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(10) NOT NULL CHECK (adjustment_type IN ('CREDIT', 'DEBIT')),
  amount_xaf BIGINT NOT NULL CHECK (amount_xaf > 0),
  reason TEXT NOT NULL,
  proof_urls TEXT[] DEFAULT '{}',
  ledger_entry_id UUID REFERENCES public.ledger_entries(id),
  created_by_admin_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for wallet_adjustments
CREATE INDEX idx_wallet_adjustments_wallet ON public.wallet_adjustments(wallet_id);
CREATE INDEX idx_wallet_adjustments_user ON public.wallet_adjustments(user_id);
CREATE INDEX idx_wallet_adjustments_created ON public.wallet_adjustments(created_at DESC);

-- =============================================
-- 4. Enable RLS
-- =============================================
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_adjustments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. RLS Policies for ledger_entries
-- =============================================

-- Users can view their own ledger entries
CREATE POLICY "Users can view own ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all ledger entries
CREATE POLICY "Admins can view all ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Only admins can insert ledger entries
CREATE POLICY "Admins can insert ledger entries"
  ON public.ledger_entries FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- 6. RLS Policies for wallet_adjustments
-- =============================================

-- Users can view their own adjustments
CREATE POLICY "Users can view own adjustments"
  ON public.wallet_adjustments FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all adjustments
CREATE POLICY "Admins can view all adjustments"
  ON public.wallet_adjustments FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Only admins can insert adjustments
CREATE POLICY "Admins can insert adjustments"
  ON public.wallet_adjustments FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- =============================================
-- 7. RPC Function: create_wallet_adjustment
-- =============================================
CREATE OR REPLACE FUNCTION public.create_wallet_adjustment(
  p_user_id UUID,
  p_adjustment_type VARCHAR(10),
  p_amount_xaf BIGINT,
  p_reason TEXT,
  p_proof_urls TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NOT public.is_admin(v_admin_id) THEN
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
$$;

-- =============================================
-- 8. RPC Function: get_client_ledger
-- =============================================
CREATE OR REPLACE FUNCTION public.get_client_ledger(
  p_user_id UUID,
  p_entry_type ledger_entry_type DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  wallet_id UUID,
  user_id UUID,
  entry_type ledger_entry_type,
  amount_xaf BIGINT,
  balance_before BIGINT,
  balance_after BIGINT,
  reference_type VARCHAR(50),
  reference_id UUID,
  description TEXT,
  metadata JSONB,
  created_by_admin_id UUID,
  created_by_admin_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin or the user themselves
  IF NOT (auth.uid() = p_user_id OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    le.id,
    le.wallet_id,
    le.user_id,
    le.entry_type,
    le.amount_xaf,
    le.balance_before,
    le.balance_after,
    le.reference_type,
    le.reference_id,
    le.description,
    le.metadata,
    le.created_by_admin_id,
    CASE
      WHEN le.created_by_admin_id IS NOT NULL THEN
        (SELECT CONCAT(p.first_name, ' ', p.last_name) FROM profiles p WHERE p.user_id = le.created_by_admin_id)
      ELSE NULL
    END as created_by_admin_name,
    le.created_at
  FROM ledger_entries le
  WHERE le.user_id = p_user_id
    AND (p_entry_type IS NULL OR le.entry_type = p_entry_type)
  ORDER BY le.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =============================================
-- 9. Update validate_deposit to create ledger entry
-- =============================================
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  -- Check if admin
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get deposit
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already validated');
  END IF;

  -- Get wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;

  IF v_wallet IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (v_deposit.user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_deposit.amount_xaf;

  -- Update wallet balance
  UPDATE public.wallets
  SET balance_xaf = v_new_balance,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Update deposit status
  UPDATE public.deposits
  SET status = 'validated',
      validated_by = v_admin_id,
      validated_at = now(),
      admin_comment = p_admin_comment,
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Create wallet operation (legacy)
  INSERT INTO public.wallet_operations (
    wallet_id, operation_type, amount_xaf, balance_before, balance_after,
    reference_id, reference_type, description, performed_by
  ) VALUES (
    v_wallet.id, 'deposit', v_deposit.amount_xaf, v_wallet.balance_xaf, v_new_balance,
    p_deposit_id, 'deposit', 'Dépôt validé - ' || v_deposit.reference, v_admin_id
  );

  -- Create ledger entry (new system)
  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, created_by_admin_id
  ) VALUES (
    v_wallet.id, v_deposit.user_id, 'DEPOSIT_VALIDATED', v_deposit.amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'deposit', p_deposit_id,
    'Dépôt validé - ' || v_deposit.reference, v_admin_id
  );

  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'validated', 'Dépôt validé par l''équipe Bonzini', v_admin_id);

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'wallet_credited', 'Solde mis à jour: +' || v_deposit.amount_xaf || ' XAF', v_admin_id);

  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_credited', v_deposit.amount_xaf
  );
END;
$$;

-- =============================================
-- 10. Update reject_deposit to create ledger entry
-- =============================================
CREATE OR REPLACE FUNCTION public.reject_deposit(
  p_deposit_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status = 'validated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot reject validated deposit');
  END IF;

  -- Get wallet for ledger entry
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id;

  -- Update deposit status
  UPDATE public.deposits
  SET status = 'rejected',
      rejection_reason = p_reason,
      validated_by = v_admin_id,
      validated_at = now(),
      updated_at = now()
  WHERE id = p_deposit_id;

  -- Create ledger entry for refused deposit (informational, no balance change)
  IF v_wallet IS NOT NULL THEN
    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id
    ) VALUES (
      v_wallet.id, v_deposit.user_id, 'DEPOSIT_REFUSED', v_deposit.amount_xaf,
      v_wallet.balance_xaf, v_wallet.balance_xaf, 'deposit', p_deposit_id,
      'Dépôt refusé: ' || p_reason, v_admin_id
    );
  END IF;

  -- Add timeline event
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (p_deposit_id, 'rejected', 'Dépôt refusé: ' || p_reason, v_admin_id);

  -- Add audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'reject_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'amount_xaf', v_deposit.amount_xaf,
      'user_id', v_deposit.user_id,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

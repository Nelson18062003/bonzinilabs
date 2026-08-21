-- ============================================================
-- Deux correctifs issus du test réel de la correction de paiement :
--
-- 1. admin_correct_payment plantait à l'écriture comptable :
--    « column "entry_type" is of type ledger_entry_type but
--    expression is of type text ». Un littéral seul est coercé vers
--    l'enum, mais un CASE de deux littéraux est typé text → il faut
--    caster explicitement le résultat du CASE vers
--    public.ledger_entry_type. Fonction recréée à l'identique, avec
--    le cast.
--
-- 2. cancel_payment refusait les paiements « completed ». Décision
--    produit : le super admin peut désormais annuler un paiement
--    effectué — le wallet est remboursé (écriture
--    PAYMENT_CANCELLED_REFUNDED, comptée comme crédit par la
--    réconciliation), le statut passe à cancelled_by_admin, rien
--    n'est effacé. Restent interdits : rejected et
--    cancelled_by_admin (déjà remboursés — un second remboursement
--    créerait de l'argent).
--
-- Idempotent (CREATE OR REPLACE). Les COMMENT @mola existants sur
-- ces fonctions survivent au REPLACE.
-- ============================================================

-- ── 1. admin_correct_payment : cast de l'entry_type ─────────────
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

  IF p_amount_xaf IS NOT NULL AND (p_amount_xaf <= 0 OR p_amount_xaf > 50000000) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant XAF invalide (1 à 50 000 000)');
  END IF;
  IF p_amount_rmb IS NOT NULL AND p_amount_rmb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant RMB invalide');
  END IF;
  IF p_exchange_rate IS NOT NULL AND p_exchange_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux invalide');
  END IF;

  v_debit_held := v_payment.status NOT IN ('rejected', 'cancelled_by_admin');

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
        -- Le CASE doit être casté : text → ledger_entry_type
        (CASE WHEN v_delta > 0 THEN 'ADMIN_DEBIT' ELSE 'ADMIN_CREDIT' END)::public.ledger_entry_type,
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

      UPDATE public.payments
      SET balance_after = balance_after - v_delta
      WHERE id = p_payment_id AND balance_after IS NOT NULL;
    END IF;

    UPDATE public.payments SET amount_xaf = p_amount_xaf, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('amount_xaf', jsonb_build_object('old', v_payment.amount_xaf, 'new', p_amount_xaf));

    IF v_payment.batch_id IS NOT NULL THEN
      UPDATE public.payment_batches
      SET total_amount_xaf = total_amount_xaf + v_delta
      WHERE id = v_payment.batch_id;
    END IF;
  END IF;

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

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id, 'admin_corrected',
    'Paiement corrigé par le super admin — ' || p_reason,
    v_admin_id
  );

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

-- ── 2. cancel_payment : autoriser l'annulation d'un « completed » ─
CREATE OR REPLACE FUNCTION public.cancel_payment(p_payment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id    UUID;
  v_payment     RECORD;
  v_wallet      RECORD;
  v_is_super    BOOLEAN;
  v_new_balance BIGINT;
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
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des paiements');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Seuls les états DÉJÀ remboursés sont interdits (double remboursement).
  -- 'completed' est désormais annulable : le débit est encore détenu,
  -- le client est remboursé intégralement.
  IF v_payment.status IN ('rejected', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''annuler un paiement en statut "' || v_payment.status || '" (déjà remboursé)'
    );
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_payment.amount_xaf;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, created_by_admin_id
  ) VALUES (
    v_wallet.id, v_payment.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_payment.amount_xaf,
    v_wallet.balance_xaf, v_new_balance,
    'payment', p_payment_id,
    'Annulation paiement - Réf: ' || COALESCE(v_payment.reference, p_payment_id::text),
    jsonb_build_object(
      'reason', 'cancelled_by_admin',
      'original_status', v_payment.status,
      'method', v_payment.method,
      'amount_rmb', v_payment.amount_rmb,
      'was_completed', (v_payment.status = 'completed')
    ),
    v_admin_id
  );

  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE public.payments
  SET status = 'cancelled_by_admin', updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description)
  VALUES (p_payment_id, 'cancelled_by_admin', 'Paiement annulé par le super admin');

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'cancel_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference',          v_payment.reference,
      'amount_xaf',         v_payment.amount_xaf,
      'amount_rmb',         v_payment.amount_rmb,
      'user_id',            v_payment.user_id,
      'status_at_cancel',   v_payment.status,
      'wallet_refunded',    true
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

NOTIFY pgrst, 'reload schema';

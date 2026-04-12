-- ============================================================
-- Suppression du flux de correction de dépôt
--
-- Décision business : on ne corrige plus les dépôts.
-- Soit on valide (au montant déclaré), soit on refuse.
-- Le paramètre p_confirmed_amount est supprimé de validate_deposit.
--
-- On ne touche PAS au statut 'pending_correction' dans l'enum
-- PostgreSQL (impossible de retirer une valeur d'enum), mais les
-- RPCs qui le produisaient sont supprimées.
-- ============================================================

-- 1. Supprimer les RPCs de correction
DROP FUNCTION IF EXISTS public.request_deposit_correction(UUID, TEXT);
DROP FUNCTION IF EXISTS public.resubmit_deposit(UUID);

-- 2. Réécrire validate_deposit SANS p_confirmed_amount
-- Le montant crédité est TOUJOURS amount_xaf (le montant déclaré par le client)
CREATE OR REPLACE FUNCTION public.validate_deposit(
  p_deposit_id UUID,
  p_admin_comment TEXT DEFAULT NULL,
  p_send_notification BOOLEAN DEFAULT TRUE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id     UUID;
  v_deposit      RECORD;
  v_wallet       RECORD;
  v_credit_amount BIGINT;
  v_new_balance  BIGINT;
  v_proof_count  INT;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Verrouiller le dépôt
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Seuls les dépôts en attente de validation peuvent être validés (allowlist)
  IF v_deposit.status NOT IN ('created', 'awaiting_proof', 'proof_submitted', 'admin_review', 'pending_correction') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Impossible de valider un dépôt en statut "' || v_deposit.status || '"');
  END IF;

  -- Vérifier qu'il y a au moins une preuve active
  SELECT COUNT(*) INTO v_proof_count
  FROM public.deposit_proofs
  WHERE deposit_id = p_deposit_id AND (is_deleted IS NULL OR is_deleted = false);

  IF v_proof_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de valider sans preuve');
  END IF;

  -- Le montant crédité est TOUJOURS le montant déclaré
  v_credit_amount := v_deposit.amount_xaf;

  -- Verrouiller le wallet
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    -- Créer le wallet s'il n'existe pas
    INSERT INTO public.wallets (user_id, balance_xaf)
    VALUES (v_deposit.user_id, 0)
    RETURNING * INTO v_wallet;
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_credit_amount;

  -- Créditer le wallet
  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Mettre à jour le dépôt
  UPDATE public.deposits SET
    status = 'validated',
    validated_by = v_admin_id,
    validated_at = now(),
    admin_comment = COALESCE(p_admin_comment, admin_comment),
    updated_at = now()
  WHERE id = p_deposit_id;

  -- Écriture comptable
  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, created_by_admin_id
  ) VALUES (
    v_wallet.id, v_deposit.user_id, 'DEPOSIT_VALIDATED', v_credit_amount,
    v_wallet.balance_xaf, v_new_balance,
    'deposit', p_deposit_id,
    'Dépôt validé - Réf: ' || COALESCE(v_deposit.reference, p_deposit_id::text),
    jsonb_build_object(
      'amount_xaf', v_credit_amount,
      'method', v_deposit.method
    ),
    v_admin_id
  );

  -- Timeline
  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'validated', 'Dépôt validé par l''équipe Bonzini');

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'wallet_credited',
    'Solde mis à jour: +' || v_credit_amount || ' XAF → Nouveau solde: ' || v_new_balance || ' XAF');

  -- Notification client
  IF p_send_notification THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_deposit.user_id, 'deposit_validated',
      'Dépôt validé',
      'Votre dépôt de ' || v_credit_amount || ' XAF a été validé. Nouveau solde: ' || v_new_balance || ' XAF',
      jsonb_build_object(
        'deposit_id', p_deposit_id,
        'amount_xaf', v_credit_amount,
        'new_balance', v_new_balance
      )
    );
  END IF;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'validate_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'reference', v_deposit.reference,
      'amount_xaf', v_credit_amount,
      'user_id', v_deposit.user_id,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'credit_amount', v_credit_amount
  );
END;
$$;

NOTIFY pgrst, 'reload schema';

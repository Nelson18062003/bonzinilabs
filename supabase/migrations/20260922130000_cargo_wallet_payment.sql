-- ============================================================================
-- Cargo · Phase 9 — régler les frais de transport avec le solde du client
--
-- Comme le module Paiements : on recharge d'abord le compte du client (dépôt
-- validé → portefeuille), puis on règle le devis cargo DEPUIS ce solde. Le
-- portefeuille est débité sous verrou, jamais sous son plancher de découvert,
-- et l'écriture apparaît dans le grand livre du client (CARGO_FEES). Annuler
-- un tel encaissement recrédite le portefeuille (PAYMENT_CANCELLED_REFUNDED).
-- Idempotent. Suppose 20260921140000_cargo_quote_payments.sql (phase 2) et
-- 20260918100000_wallet_overdraft.sql (plancher de découvert) passées.
--
-- Une valeur d'enum est ajoutée (CARGO_FEES) : Postgres interdit de l'utiliser
-- comme littéral dans la même transaction. Ici elle n'apparaît que dans des
-- corps de fonctions, évalués à l'exécution — le fichier passe d'un bloc.
-- ============================================================================

-- 1. Le grand livre sait dire « frais de transport ».
ALTER TYPE public.ledger_entry_type ADD VALUE IF NOT EXISTS 'CARGO_FEES';

-- 2. Un encaissement peut venir du solde du client.
ALTER TABLE public.parcel_quote_payments DROP CONSTRAINT IF EXISTS parcel_quote_payments_method_check;
ALTER TABLE public.parcel_quote_payments ADD CONSTRAINT parcel_quote_payments_method_check
  CHECK (method IN ('cash','mobile_money','bank_transfer','wallet','other'));

-- 3. Régler un devis depuis le portefeuille du client du dépôt.
CREATE OR REPLACE FUNCTION public.cargo_quote_pay_from_wallet(
  p_quote_id UUID,
  p_amount_xaf NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_q public.parcel_quotes;
  v_dep public.parcel_deposits;
  v_wallet public.wallets;
  v_balance NUMERIC;
  v_floor NUMERIC;
  v_new NUMERIC;
  v_pm public.parcel_quote_payments;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 OR p_amount_xaf <> round(p_amount_xaf) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être un nombre entier de XAF, supérieur à zéro');
  END IF;

  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est établie : ce devis est clos'); END IF;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant : posez les prix d''abord'); END IF;
  v_balance := v_q.total_xaf - v_q.amount_paid_xaf;
  IF v_balance <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est déjà soldé'); END IF;
  IF p_amount_xaf > v_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant dépasse le reste à payer (' || v_balance || ' XAF)');
  END IF;

  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_q.deposit_id;
  IF v_dep.client_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt n''est attribué à aucun client : attribuez-le avant de régler depuis un solde');
  END IF;

  -- Le portefeuille, verrouillé AVANT d'être lu ; jamais sous son plancher.
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_dep.client_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce client n''a pas de portefeuille'); END IF;
  v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
  IF v_wallet.balance_xaf - p_amount_xaf < v_floor THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant',
      'available_xaf', v_wallet.balance_xaf - v_floor, 'balance_xaf', v_wallet.balance_xaf,
      'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0));
  END IF;
  v_new := v_wallet.balance_xaf - p_amount_xaf;
  UPDATE public.wallets SET balance_xaf = balance_xaf - p_amount_xaf, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO public.parcel_quote_payments (quote_id, amount_xaf, method, place, paid_at, reference, note, received_by)
  VALUES (v_q.id, p_amount_xaf, 'wallet', 'other', now(), 'Solde Bonzini', NULLIF(TRIM(p_note), ''), v_uid)
  RETURNING * INTO v_pm;

  INSERT INTO public.ledger_entries (wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
                                     reference_type, reference_id, description, created_by_admin_id, metadata)
  VALUES (v_wallet.id, v_dep.client_user_id, 'CARGO_FEES', p_amount_xaf, v_wallet.balance_xaf, v_new,
          'parcel_quote_payment', v_pm.id,
          'Frais de transport · devis ' || v_q.quote_no || ' · reçu ' || v_pm.receipt_no || ' · dépôt ' || v_dep.deposit_no,
          v_uid,
          jsonb_build_object('quote_id', v_q.id, 'quote_no', v_q.quote_no, 'receipt_no', v_pm.receipt_no, 'deposit_no', v_dep.deposit_no,
                             'overdraft_used_xaf', GREATEST(0, -v_new)));

  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'collect_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' : ' || p_amount_xaf || ' XAF sur ' || v_q.quote_no || ' depuis le solde du client',
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', p_amount_xaf, 'method', 'wallet', 'wallet_balance_before', v_wallet.balance_xaf, 'wallet_balance_after', v_new));
  RETURN jsonb_build_object('success', true, 'payment_id', v_pm.id, 'receipt_no', v_pm.receipt_no,
                            'wallet_balance_xaf', v_new, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_pay_from_wallet(UUID, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Régler un devis de colis depuis le solde (portefeuille) du client"}';

-- 4. L'encaissement au solde ne s'encaisse pas par l'autre porte.
--    (cargo_quote_add_payment garde sa liste : cash, mobile_money, bank_transfer, other.)

-- 5. Annuler : un encaissement venu du solde y retourne.
CREATE OR REPLACE FUNCTION public.cargo_quote_cancel_payment(p_payment_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_pm public.parcel_quote_payments; v_q public.parcel_quotes; v_wallet public.wallets;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez pourquoi vous annulez cet encaissement');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id;
  IF v_pm.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Encaissement introuvable'); END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = v_pm.quote_id FOR UPDATE;
  IF v_q.invoice_no IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est établie : les encaissements ne se modifient plus'); END IF;
  IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_q.deposit_id AND p.delivered_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce dépôt ont déjà été remis : l''encaissement ne s''annule plus');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_pm.cancelled_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Cet encaissement est déjà annulé'); END IF;

  -- Venu du solde : on rembourse le portefeuille qui a été DÉBITÉ (lu dans son
  -- écriture CARGO_FEES), pas celui du client actuel du dépôt — un dépôt peut
  -- changer de client (reception_assign_client). Verrouillé et vérifié AVANT
  -- d'annuler : sinon l'encaissement serait annulé sans remboursement.
  IF v_pm.method = 'wallet' THEN
    SELECT w.* INTO v_wallet
      FROM public.wallets w
     WHERE w.id = (SELECT le.wallet_id FROM public.ledger_entries le
                    WHERE le.reference_type = 'parcel_quote_payment' AND le.reference_id = v_pm.id
                      AND le.entry_type = 'CARGO_FEES'
                    ORDER BY le.created_at LIMIT 1)
       FOR UPDATE;
    IF v_wallet.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille débité introuvable : impossible de rembourser'); END IF;
  END IF;

  UPDATE public.parcel_quote_payments
     SET cancelled_at = now(), cancelled_by = v_uid, cancel_reason = TRIM(p_reason)
   WHERE id = v_pm.id;

  -- Venu du solde : on le rend au client, avec son écriture.
  IF v_pm.method = 'wallet' THEN
    UPDATE public.wallets SET balance_xaf = balance_xaf + v_pm.amount_xaf, updated_at = now() WHERE id = v_wallet.id;
    INSERT INTO public.ledger_entries (wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
                                       reference_type, reference_id, description, created_by_admin_id, metadata)
    VALUES (v_wallet.id, v_wallet.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_pm.amount_xaf, v_wallet.balance_xaf, v_wallet.balance_xaf + v_pm.amount_xaf,
            'parcel_quote_payment', v_pm.id,
            'Remboursement frais de transport · reçu ' || v_pm.receipt_no || ' annulé : ' || TRIM(p_reason),
            v_uid, jsonb_build_object('quote_no', v_q.quote_no, 'receipt_no', v_pm.receipt_no, 'reason', TRIM(p_reason)));
  END IF;

  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cancel_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' annulé (' || v_pm.amount_xaf || ' XAF) : ' || TRIM(p_reason),
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', v_pm.amount_xaf, 'reason', TRIM(p_reason), 'refunded_to_wallet', v_pm.method = 'wallet'));
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_cancel_payment(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Annuler un encaissement sur un devis de colis (motif obligatoire ; un encaissement au solde est remboursé au portefeuille)"}';

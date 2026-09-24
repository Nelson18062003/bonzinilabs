-- ============================================================================
-- MIGRATION CONSOLIDÉE · 24/09/2026 · PR #208 (phases 9 à 12)
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à passer dans le SQL Editor, d'un bloc.
-- ============================================================================
--
-- Une seule migration dans toute la PR : la phase 9 (« régler les frais de
-- transport avec le solde du client »). Les phases 10, 11 et 12 (fiches Mobile
-- Money et bancaires, coordonnées de paiement) ne touchent que le front : aucun
-- SQL.
--
-- Contenu, dans l'ordre d'exécution (copie de
-- supabase/migrations/20260922130000_cargo_wallet_payment.sql, qui reste la
-- source pour `npx supabase db push --linked`) :
--   0. Contrôle des prérequis (s'arrête net s'il en manque un)
--   1. Valeur d'enum ledger_entry_type 'CARGO_FEES'
--   2. parcel_quote_payments.method accepte 'wallet'
--   3. RPC cargo_quote_pay_from_wallet(uuid, numeric, text) — nouvelle
--   4. (rien) cargo_quote_add_payment inchangée
--   5. RPC cargo_quote_cancel_payment(uuid, text) — remplacée
--
-- Ce fichier remplace migrations/20260922_cargo_wallet_payment.sql (supprimé) :
-- depuis, l'annulation a été corrigée (section 5) — le remboursement allait au
-- client ACTUEL du dépôt, qui peut avoir changé (reception_assign_client), et
-- un portefeuille introuvable laissait l'encaissement annulé sans rembourser.
--
-- État de la production vérifié le 24/09/2026 (lecture seule) :
--   · NON passée : ni CARGO_FEES, ni cargo_quote_pay_from_wallet, ni 'wallet'
--     dans la contrainte method ;
--   · prérequis présents : phases cargo 1 à 7 (parcel_quotes,
--     parcel_quote_payments, cargo_quote_recompute, cargo_quote_json,
--     canCollectParcelPayments), découvert (wallets.overdraft_limit_xaf),
--     PAYMENT_CANCELLED_REFUNDED ;
--   · cargo_quote_cancel_payment en production = version de la phase 2 ; la
--     section 5 en est un sur-ensemble (mêmes gardes, mêmes messages).
--
-- Idempotent : ADD VALUE IF NOT EXISTS, DROP CONSTRAINT IF EXISTS,
-- CREATE OR REPLACE FUNCTION. Rejouable sans dégât.
--
-- Une seule transaction : Postgres interdit d'UTILISER une valeur d'enum
-- ajoutée dans la même transaction. Ici 'CARGO_FEES' n'apparaît que dans des
-- corps de fonctions plpgsql, évalués à l'exécution — le fichier passe d'un
-- bloc (vérifié sur Postgres 16 : deux passages de suite, puis paiement,
-- annulation et remboursement testés).
--
-- Après passage : rien à déployer, rien à régénérer (types.ts connaît déjà
-- CARGO_FEES ; le front appelle la RPC par son nom). Mola voit la nouvelle
-- action grâce à son étiquette @mola. Coller ce fichier n'inscrit rien dans
-- supabase_migrations.schema_migrations ; pour qu'un `db push` ultérieur ne la
-- rejoue pas (sans dommage de toute façon) :
--   npx supabase migration repair --status applied 20260922130000
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- S'arrête avec un message clair si la base n'a pas les phases cargo 1 à 7 et
-- le découvert : rien n'est modifié dans ce cas.
-- ############################################################################
DO $pre$
BEGIN
  IF to_regclass('public.parcel_quote_payments') IS NULL OR to_regclass('public.parcel_quotes') IS NULL THEN
    RAISE EXCEPTION 'Prérequis manquant : passer d''abord migrations/20260922_consolidated_cargo-phases-1-7.sql';
  END IF;
  IF to_regprocedure('public.cargo_quote_recompute(uuid)') IS NULL OR to_regprocedure('public.cargo_quote_json(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Prérequis manquant : cargo_quote_recompute / cargo_quote_json (phase cargo 1-2)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'overdraft_limit_xaf') THEN
    RAISE EXCEPTION 'Prérequis manquant : wallets.overdraft_limit_xaf (migration du découvert, 18/09)';
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — Le type d'écriture CARGO_FEES
-- Ajoute la valeur « frais de transport » au grand livre du client (idempotent : IF NOT EXISTS).
-- ############################################################################
-- 1. Le grand livre sait dire « frais de transport ».
ALTER TYPE public.ledger_entry_type ADD VALUE IF NOT EXISTS 'CARGO_FEES';


-- ############################################################################
-- SECTION 2 — Le mode d'encaissement « wallet »
-- Élargit la contrainte de parcel_quote_payments.method à 'wallet' (DROP IF EXISTS puis ADD : rejouable).
-- ############################################################################
-- 2. Un encaissement peut venir du solde du client.
ALTER TABLE public.parcel_quote_payments DROP CONSTRAINT IF EXISTS parcel_quote_payments_method_check;
ALTER TABLE public.parcel_quote_payments ADD CONSTRAINT parcel_quote_payments_method_check
  CHECK (method IN ('cash','mobile_money','bank_transfer','wallet','other'));


-- ############################################################################
-- SECTION 3 — RPC cargo_quote_pay_from_wallet (nouvelle, @mola)
-- Règle un devis depuis le solde du client : permission canCollectParcelPayments, montant entier > 0,
-- devis verrouillé (FOR UPDATE), portefeuille verrouillé AVANT lecture, plancher = -overdraft_limit_xaf,
-- écriture relative, écriture CARGO_FEES au grand livre, journal d'audit.
-- ############################################################################
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


-- ############################################################################
-- SECTION 4 — cargo_quote_add_payment inchangée
-- Rien à exécuter : l'encaissement manuel garde sa liste (cash, mobile_money, bank_transfer, other).
-- ############################################################################
-- 4. L'encaissement au solde ne s'encaisse pas par l'autre porte.
--    (cargo_quote_add_payment garde sa liste : cash, mobile_money, bank_transfer, other.)


-- ############################################################################
-- SECTION 5 — RPC cargo_quote_cancel_payment (remplacée, @mola)
-- Même garde qu'en production (permission, motif, facture, colis remis, double annulation), plus :
-- un encaissement 'wallet' est remboursé au portefeuille qui a été DÉBITÉ (retrouvé par son écriture
-- CARGO_FEES), verrouillé et vérifié AVANT d'annuler, avec une écriture PAYMENT_CANCELLED_REFUNDED.
-- ############################################################################
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


-- ============================================================================
-- FIN. Vérification rapide après passage (attendu : true, 1, 'wallet' présent) :
--   SELECT to_regprocedure('public.cargo_quote_pay_from_wallet(uuid,numeric,text)') IS NOT NULL AS pay_from_wallet,
--          (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
--            WHERE t.typname = 'ledger_entry_type' AND e.enumlabel = 'CARGO_FEES') AS cargo_fees,
--          (SELECT pg_get_constraintdef(oid) FROM pg_constraint
--            WHERE conname = 'parcel_quote_payments_method_check') AS method_check;
-- ============================================================================

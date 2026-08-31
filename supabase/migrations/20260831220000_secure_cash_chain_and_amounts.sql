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

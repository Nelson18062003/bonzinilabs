-- ============================================================
-- P1 — Intégrité financière : trois courses (TOCTOU) sur l'argent.
--
-- La règle du projet (.claude/rules/security.md) impose un
-- « SELECT FOR UPDATE sur le wallet avant toute déduction ». Trois
-- fonctions ne la respectaient pas :
--
-- 1) create_wallet_adjustment (le crédit/débit manuel utilisé par la fiche
--    client) lisait le solde SANS verrou, calculait le nouveau solde dans
--    une variable, puis écrivait une valeur ABSOLUE :
--        SELECT * INTO v_wallet ...            -- pas de verrou
--        v_balance_after := v_balance_before - p_amount_xaf;
--        UPDATE wallets SET balance_xaf = v_balance_after;
--    => lost update. Deux débits concurrents de 100 000 sur un solde de
--    100 000 passent tous deux le contrôle « solde suffisant » et écrivent
--    tous deux 0 : 200 000 débités, 100 000 réellement retirés.
--
-- 2) process_payment lisait le paiement sans verrou, testait son statut,
--    puis faisait UPDATE ... WHERE id = p_payment_id SANS re-tester le
--    statut. Deux rejets concurrents passaient tous deux le contrôle et
--    remboursaient chacun le portefeuille (balance = balance + montant,
--    atomique mais exécuté DEUX fois) => double remboursement.
--
-- 3) confirm_cash_payment : même schéma (double confirmation possible).
--
-- Correctif : verrouiller la ligne mutée AVANT de la lire. Le second appel
-- concurrent bloque sur le SELECT, puis relit l'état déjà commité — son
-- contrôle de statut / de solde échoue alors correctement.
-- Seule la ligne de lecture change ; les corps sont préservés.
-- ============================================================
DO $mig$
DECLARE
  r RECORD;
  v_def TEXT;
  v_new TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('create_wallet_adjustment',
       'SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id;',
       'SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;'),
      ('process_payment',
       'SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;',
       'SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;'),
      ('confirm_cash_payment',
       'SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;',
       'SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;')
    ) AS t(fname, needle, repl)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.fname
    LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'Fonction introuvable: %', r.fname;
    END IF;

    IF position(r.repl in v_def) > 0 THEN
      CONTINUE;  -- déjà verrouillée (migration rejouée)
    END IF;

    IF position(r.needle in v_def) = 0 THEN
      RAISE EXCEPTION 'Motif de lecture introuvable dans % (corps modifié ?)', r.fname;
    END IF;

    v_new := replace(v_def, r.needle, r.repl);
    EXECUTE v_new;
    RAISE NOTICE 'verrou FOR UPDATE ajouté: %', r.fname;
  END LOOP;
END
$mig$;

-- ============================================================
-- Nettoyage pré-production : supprimer les wallets orphelins
-- Un wallet orphelin = wallet dont le user_id n'existe plus
-- dans la table clients (client supprimé).
--
-- Règle métier : 1 client ↔ 1 wallet.
-- Les faux comptes clients ont été supprimés, leurs wallets
-- doivent être nettoyés.
--
-- CASCADE : la suppression d'un wallet entraîne la suppression
-- automatique des ledger_entries associées (ON DELETE CASCADE).
-- ============================================================

DO $$
DECLARE
  v_count   INTEGER;
  v_balance NUMERIC;
BEGIN
  -- 1. Rapport avant suppression
  SELECT COUNT(*), COALESCE(SUM(balance_xaf), 0)
  INTO v_count, v_balance
  FROM public.wallets w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.user_id = w.user_id
  );

  RAISE NOTICE 'Wallets orphelins trouvés : % (solde total : % XAF)', v_count, v_balance;

  IF v_balance > 0 THEN
    RAISE NOTICE 'ATTENTION : certains wallets orphelins ont un solde non nul. Ils seront supprimés.';
  END IF;

  -- 2. Supprimer les wallets orphelins
  --    (CASCADE supprime automatiquement les ledger_entries liées)
  DELETE FROM public.wallets
  WHERE NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.user_id = wallets.user_id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Wallets supprimés : %', v_count;
END;
$$;

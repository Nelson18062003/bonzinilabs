-- ============================================================
-- Intégrité : contraintes CHECK manquantes sur payments
--
-- La validation des montants est actuellement faite au niveau
-- RPC uniquement. On ajoute une défense en profondeur au niveau
-- DB pour qu'il soit impossible d'insérer un paiement à 0 XAF
-- ou un taux de change négatif, même via une RPC corrompue.
-- ============================================================

-- payments : montants strictement positifs
ALTER TABLE public.payments
  ADD CONSTRAINT check_payments_amount_xaf_positive
    CHECK (amount_xaf > 0);

ALTER TABLE public.payments
  ADD CONSTRAINT check_payments_amount_rmb_positive
    CHECK (amount_rmb > 0);

ALTER TABLE public.payments
  ADD CONSTRAINT check_payments_exchange_rate_positive
    CHECK (exchange_rate > 0);

-- balance_before / balance_after : jamais négatifs (cohérent avec wallets)
ALTER TABLE public.payments
  ADD CONSTRAINT check_payments_balance_before_nonneg
    CHECK (balance_before IS NULL OR balance_before >= 0);

ALTER TABLE public.payments
  ADD CONSTRAINT check_payments_balance_after_nonneg
    CHECK (balance_after IS NULL OR balance_after >= 0);

-- wallet_adjustments : le montant doit être > 0
-- (contrainte déjà présente selon migration initiale, IF NOT EXISTS via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'wallet_adjustments_amount_xaf_check'
      AND constraint_schema = 'public'
  ) THEN
    ALTER TABLE public.wallet_adjustments
      ADD CONSTRAINT check_wallet_adj_amount_positive
        CHECK (amount_xaf > 0);
  END IF;
END;
$$;

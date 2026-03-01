-- ============================================================
-- Performance : index manquants sur deposits et payments
--
-- Colonnes fréquemment filtrées sans index :
--   deposits(user_id), deposits(status)
--   payments(user_id), payments(status)
--   exchange_rates(effective_date)
--
-- Impact : get_dashboard_stats(), listes par client/admin,
--          toutes les queries WHERE status IN (...) actuellement
--          en full-table-scan.
-- ============================================================

-- deposits
CREATE INDEX IF NOT EXISTS idx_deposits_user_id
  ON public.deposits(user_id);

CREATE INDEX IF NOT EXISTS idx_deposits_status
  ON public.deposits(status);

-- Index composite pour les queries admin filtrées par statut ET date
CREATE INDEX IF NOT EXISTS idx_deposits_status_validated_at
  ON public.deposits(status, validated_at)
  WHERE validated_at IS NOT NULL;

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON public.payments(user_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments(status);

-- Index composite pour get_dashboard_stats() : SUM filtré sur 30 jours
CREATE INDEX IF NOT EXISTS idx_payments_status_processed_at
  ON public.payments(status, processed_at)
  WHERE processed_at IS NOT NULL;

-- exchange_rates : ORDER BY effective_date DESC (pagination, current rate)
CREATE INDEX IF NOT EXISTS idx_exchange_rates_effective_date
  ON public.exchange_rates(effective_date DESC);

-- admin_audit_logs : croît sans limite — index pour requêtes temporelles
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);

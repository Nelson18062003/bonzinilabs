-- ============================================================================
-- Les tables cargo, réduites aux colonnes que lisent les suites de test
-- (schéma réel : 20260911120000_cargo_module.sql, 20260921150000_cargo_air_shipments.sql).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cargo_shipments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_label     TEXT NOT NULL DEFAULT 'TEST',
  container_number TEXT NOT NULL UNIQUE,
  pol_unlocode     TEXT,
  pod_name         TEXT NOT NULL DEFAULT 'Kribi',
  pod_unlocode     TEXT,
  etd_promised     DATE,
  eta_promised     DATE,
  etd_actual       TIMESTAMPTZ,
  eta_carrier      TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'UNKNOWN'
);
CREATE TABLE IF NOT EXISTS public.cargo_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.cargo_shipments(id) ON DELETE CASCADE,
  event_code  TEXT NOT NULL,
  classifier  TEXT NOT NULL DEFAULT 'ACT',
  event_time  TIMESTAMPTZ NOT NULL,
  unlocode    TEXT
);
CREATE TABLE IF NOT EXISTS public.air_shipments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  awb_number  TEXT NOT NULL UNIQUE,
  origin      TEXT NOT NULL DEFAULT 'Guangzhou (CAN)',
  destination TEXT NOT NULL DEFAULT 'Douala (DLA)',
  status      TEXT NOT NULL DEFAULT 'PLANNED',
  etd DATE, eta DATE,
  departed_at TIMESTAMPTZ,
  arrived_at  TIMESTAMPTZ
);
ALTER TABLE public.cargo_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.air_shipments ENABLE ROW LEVEL SECURITY;

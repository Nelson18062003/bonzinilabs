-- Rate snapshots table for market monitoring history
CREATE TABLE IF NOT EXISTS rate_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  xaf_ask numeric NOT NULL,
  cny_bid_binance numeric NOT NULL,
  cny_bid_adjusted numeric NOT NULL,
  otc_spread numeric NOT NULL DEFAULT 0.04,
  usdt_per_1m_xaf numeric NOT NULL,
  market_rate numeric NOT NULL,
  margin_pct numeric NOT NULL,
  bonzini_rate integer NOT NULL,
  gain_per_million numeric NOT NULL,
  xaf_merchants_count integer NOT NULL,
  cny_merchants_count integer NOT NULL
);

CREATE INDEX idx_rate_snapshots_created_at ON rate_snapshots(created_at DESC);

ALTER TABLE rate_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON rate_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read snapshots" ON rate_snapshots
  FOR SELECT TO authenticated USING (true);

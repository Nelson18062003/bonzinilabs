-- Add UTM tracking columns to clients table
-- These are populated at signup from localStorage UTM params captured on landing.
-- Nullable: existing clients will have NULL, which is expected.
-- First-touch attribution: written once at self-signup, never overwritten.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT;

-- Index on utm_source for analytics grouping queries
CREATE INDEX IF NOT EXISTS idx_clients_utm_source
  ON public.clients(utm_source)
  WHERE utm_source IS NOT NULL;

COMMENT ON COLUMN public.clients.utm_source   IS 'UTM source captured at self-signup (e.g. facebook, whatsapp)';
COMMENT ON COLUMN public.clients.utm_medium   IS 'UTM medium captured at self-signup (e.g. social, cpc)';
COMMENT ON COLUMN public.clients.utm_campaign IS 'UTM campaign captured at self-signup';
COMMENT ON COLUMN public.clients.utm_content  IS 'UTM content captured at self-signup';
COMMENT ON COLUMN public.clients.utm_term     IS 'UTM term captured at self-signup';

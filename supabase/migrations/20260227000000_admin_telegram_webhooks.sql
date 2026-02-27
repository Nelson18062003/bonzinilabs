-- ─── Admin Telegram Webhooks ────────────────────────────────────────────────
-- Uses pg_net to call the notify-admin Edge Function asynchronously
-- when key business events occur in the database.

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── Shared trigger function ──────────────────────────────────────────────────
-- One function handles all tables and event types.
CREATE OR REPLACE FUNCTION public.notify_admin_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END
  );

  PERFORM extensions.http_post(
    url     := 'https://fmhsohrgbznqmcvqktjw.supabase.co/functions/v1/notify-admin',
    body    := payload,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original operation if the HTTP call fails
  RAISE WARNING 'notify_admin_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── Triggers ─────────────────────────────────────────────────────────────────

-- 1. Nouveau client inscrit
DROP TRIGGER IF EXISTS on_client_created ON public.clients;
CREATE TRIGGER on_client_created
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_webhook();

-- 2. Nouveau taux de change
DROP TRIGGER IF EXISTS on_rate_created ON public.exchange_rates;
CREATE TRIGGER on_rate_created
  AFTER INSERT ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_webhook();

-- 3. Nouvelle demande de dépôt
DROP TRIGGER IF EXISTS on_deposit_created ON public.deposits;
CREATE TRIGGER on_deposit_created
  AFTER INSERT ON public.deposits
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_webhook();

-- 4. Changement de statut dépôt (WHEN clause filtre côté DB → pas de requête HTTP si statut inchangé)
DROP TRIGGER IF EXISTS on_deposit_updated ON public.deposits;
CREATE TRIGGER on_deposit_updated
  AFTER UPDATE ON public.deposits
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_admin_webhook();

-- 5. Nouvelle demande de paiement
DROP TRIGGER IF EXISTS on_payment_created ON public.payments;
CREATE TRIGGER on_payment_created
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_webhook();

-- 6. Changement de statut paiement
DROP TRIGGER IF EXISTS on_payment_updated ON public.payments;
CREATE TRIGGER on_payment_updated
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_admin_webhook();

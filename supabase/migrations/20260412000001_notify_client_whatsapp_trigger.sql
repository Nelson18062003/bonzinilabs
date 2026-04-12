-- ─── Client WhatsApp/SMS Notification Trigger ────────────────────────────────
-- Uses pg_net to call the notify-client-whatsapp Edge Function asynchronously
-- when a new notification is inserted for a client.
-- Same pattern as notify_admin_webhook (Telegram).

-- ─── Trigger function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_client_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  req_id bigint;
BEGIN
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     row_to_json(NEW)
  );

  SELECT net.http_post(
    url     := 'https://fmhsohrgbznqmcvqktjw.supabase.co/functions/v1/notify-client-whatsapp',
    body    := payload,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) INTO req_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original operation if the HTTP call fails
  RAISE WARNING 'notify_client_whatsapp failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─── Trigger: fire on every new notification ─────────────────────────────────
DROP TRIGGER IF EXISTS on_notification_created_whatsapp ON public.notifications;
CREATE TRIGGER on_notification_created_whatsapp
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_client_whatsapp();

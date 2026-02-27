-- Fix: use net.http_post() instead of extensions.http_post()
-- pg_net is installed under the "net" schema in this Supabase project.

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

  PERFORM net.http_post(
    url     := 'https://fmhsohrgbznqmcvqktjw.supabase.co/functions/v1/notify-admin',
    body    := payload,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_admin_webhook failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

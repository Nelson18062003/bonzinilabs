-- Create a debug log table and update the trigger function to write errors
CREATE TABLE IF NOT EXISTS public._trigger_debug_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  op text,
  tbl text,
  msg text
);

-- Updated trigger function: logs both success and errors to the debug table
CREATE OR REPLACE FUNCTION public.notify_admin_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  req_id  bigint;
BEGIN
  payload := jsonb_build_object(
    'type',       TG_OP,
    'table',      TG_TABLE_NAME,
    'schema',     TG_TABLE_SCHEMA,
    'record',     CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    'old_record', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END
  );

  SELECT net.http_post(
    url     := 'https://fmhsohrgbznqmcvqktjw.supabase.co/functions/v1/notify-admin',
    body    := payload,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) INTO req_id;

  -- Log success
  INSERT INTO public._trigger_debug_log (op, tbl, msg)
  VALUES (TG_OP, TG_TABLE_NAME, 'OK — req_id=' || req_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the actual error so we can diagnose it
  INSERT INTO public._trigger_debug_log (op, tbl, msg)
  VALUES (TG_OP, TG_TABLE_NAME, 'ERROR: ' || SQLERRM || ' (SQLSTATE=' || SQLSTATE || ')');
  RETURN NEW;
END;
$$;

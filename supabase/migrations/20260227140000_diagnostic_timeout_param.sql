-- Test: does this version of pg_net accept timeout_milliseconds?
DO $$
DECLARE
  req_id bigint;
BEGIN
  SELECT net.http_post(
    url     := 'https://fmhsohrgbznqmcvqktjw.supabase.co/functions/v1/notify-admin',
    body    := '{"type":"INSERT","table":"deposits","schema":"public","record":{"reference":"TIMEOUT-TEST","amount_xaf":1,"method":"bank_transfer","status":"created","user_id":"00000000-0000-0000-0000-000000000001"},"old_record":null}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) INTO req_id;

  RAISE NOTICE 'timeout_milliseconds OK — req id: %', req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'timeout_milliseconds FAILED: %', SQLERRM;
END;
$$;

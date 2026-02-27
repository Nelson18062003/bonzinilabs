-- Test: can we actually call net.http_post() from SQL?
-- If the Edge Function receives this, net is working.
-- If not, there's a permission or connectivity issue.
DO $$
DECLARE
  req_id bigint;
BEGIN
  SELECT net.http_post(
    url     := 'https://fmhsohrgbznqmcvqktjw.supabase.co/functions/v1/notify-admin',
    body    := '{"type":"INSERT","table":"test_diagnostic","schema":"public","record":{"msg":"pgnet_test"},"old_record":null}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  ) INTO req_id;

  RAISE NOTICE 'net.http_post queued OK — request id: %', req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'net.http_post FAILED: %', SQLERRM;
END;
$$;

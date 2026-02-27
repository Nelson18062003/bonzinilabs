-- Check the HTTP response for our test request (id=4)
-- and also for any recent requests to the notify-admin function
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      id,
      status_code,
      content::text,
      error_msg,
      created
    FROM net._http_response
    WHERE created > now() - interval '5 minutes'
    ORDER BY created DESC
    LIMIT 5
  LOOP
    RAISE NOTICE 'Request id=% | status=% | error=% | response=% | at=%',
      rec.id,
      rec.status_code,
      rec.error_msg,
      left(rec.content, 100),
      rec.created;
  END LOOP;
END;
$$;

-- Check ALL http requests ever made to notify-admin
DO $$
DECLARE
  rec record;
  total int;
BEGIN
  SELECT count(*) INTO total FROM net._http_response;
  RAISE NOTICE 'Total HTTP requests in net._http_response: %', total;

  FOR rec IN
    SELECT
      id,
      status_code,
      error_msg,
      created
    FROM net._http_response
    ORDER BY created DESC
    LIMIT 10
  LOOP
    RAISE NOTICE 'id=% | status=% | error=% | at=%',
      rec.id,
      rec.status_code,
      COALESCE(rec.error_msg, 'none'),
      rec.created;
  END LOOP;
END;
$$;

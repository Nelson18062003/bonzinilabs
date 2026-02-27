-- Diagnostic: find the exact schema where http_post is installed
DO $$
DECLARE
  schemas text;
BEGIN
  SELECT string_agg(routine_schema || '.' || routine_name, ', ' ORDER BY routine_schema)
  INTO schemas
  FROM information_schema.routines
  WHERE routine_name = 'http_post';

  RAISE NOTICE 'http_post found at: %', COALESCE(schemas, 'NOT FOUND');
END;
$$;

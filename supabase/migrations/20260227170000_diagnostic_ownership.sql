-- Check who owns notify_admin_webhook and what net.http_post permissions exist
DO $$
DECLARE
  func_owner text;
  net_grants text;
BEGIN
  -- Function owner
  SELECT rolname INTO func_owner
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = 'notify_admin_webhook';

  RAISE NOTICE 'notify_admin_webhook owner: %', COALESCE(func_owner, 'NOT FOUND');

  -- Check net.http_post grantees
  SELECT string_agg(grantee, ', ' ORDER BY grantee) INTO net_grants
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'net' AND routine_name = 'http_post' AND privilege_type = 'EXECUTE';

  RAISE NOTICE 'net.http_post EXECUTE granted to: %', COALESCE(net_grants, 'NONE (only owner)');

  -- Current user during trigger execution (as seen during migration)
  RAISE NOTICE 'Current migration user: %', current_user;
  RAISE NOTICE 'Session user: %', session_user;
END;
$$;

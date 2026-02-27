-- Check what triggers exist on deposits and payments tables
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT
      trigger_name,
      event_object_table,
      event_manipulation,
      action_timing,
      action_condition
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table IN ('deposits', 'payments', 'clients', 'exchange_rates')
    ORDER BY event_object_table, trigger_name
  LOOP
    RAISE NOTICE 'TRIGGER: % | table: % | event: % | timing: % | when: %',
      rec.trigger_name,
      rec.event_object_table,
      rec.event_manipulation,
      rec.action_timing,
      COALESCE(rec.action_condition, 'none');
  END LOOP;
END;
$$;

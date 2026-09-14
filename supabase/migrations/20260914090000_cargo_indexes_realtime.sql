-- ============================================================
-- Cargo : index sur les colonnes filtrées, et tables dans la publication
-- temps réel (le cron cargo-sync et un second admin écrivent sans passer
-- par l'app : sans publication, aucune liste ne se rafraîchit d'elle-même).
-- Idempotent.
-- ============================================================
CREATE INDEX IF NOT EXISTS cargo_shipments_client_id_idx ON public.cargo_shipments (client_id);
CREATE INDEX IF NOT EXISTS cargo_shipments_bl_number_idx ON public.cargo_shipments (bl_number);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cargo_shipments', 'cargo_events', 'cargo_costs', 'cargo_packages', 'cargo_documents', 'cargo_lookups'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

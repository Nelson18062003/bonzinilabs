-- ============================================================
-- platform_settings : la lecture par tout utilisateur connecté (app client
-- comprise) se limite aux clés PUBLIQUES. La politique initiale ouvrait toute
-- la table (USING (true)) : une future clé (seuils, fournisseurs…) aurait été
-- lisible par n'importe quel client. Idempotent.
-- ============================================================
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
CREATE POLICY platform_settings_read ON public.platform_settings
  FOR SELECT TO authenticated USING (key IN ('shipping'));

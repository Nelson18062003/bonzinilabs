-- ============================================================
-- Hygiène — figer le search_path des deux derniers triggers qui ne
-- l'avaient pas (`function_search_path_mutable`).
--
-- Ces deux fonctions ne sont PAS exploitables : SECURITY INVOKER, et leur
-- corps se limite à `NEW.updated_at = now()` — aucune référence à une
-- table ou à une fonction applicative qu'un search_path détourné pourrait
-- remplacer. On les corrige quand même pour vider la liste des advisors :
-- tant qu'elle contient du bruit connu, un futur avertissement
-- search_path sur une fonction SECURITY DEFINER (lui, exploitable)
-- passerait inaperçu.
-- ============================================================
ALTER FUNCTION public.update_clients_updated_at()       SET search_path TO 'public';
ALTER FUNCTION public.update_beneficiaries_updated_at() SET search_path TO 'public';

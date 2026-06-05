-- Cleanup — Suppression du système de taux LEGACY `exchange_rates` (étape 3, cf. doc 18).
-- `daily_rates` + `rate_adjustments` est le système qui fait foi (paiements, écrans de taux, Mola).
-- `exchange_rates` ne servait plus qu'à un affichage RMB (retiré) + des écrans orphelins (supprimés).
--
-- Sûreté vérifiée AVANT ce DROP :
--   - AUCUNE clé étrangère entrante vers exchange_rates (payments.exchange_rate est une VALEUR numérique,
--     pas un FK ; is_rate_used faisait une comparaison de valeur, pas une jointure de contrainte).
--   - Frontend nettoyé : 0 référence à exchange_rates / aux RPC associées (tsc exit 0).
--   - Les RPC ci-dessous n'ont plus aucun appelant.

-- 1) RPC associées (sans appelant) — drop par signature RÉELLE (robuste aux surcharges).
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('add_exchange_rate', 'update_exchange_rate', 'delete_exchange_rate', 'is_rate_used', 'get_rate_usage_count')
  loop
    execute 'drop function ' || r.sig::text;
  end loop;
end $$;

-- 2) La table legacy (aucune FK entrante → drop simple, pas de CASCADE).
drop table if exists public.exchange_rates;

-- Après application : régénérer les types — `npx supabase gen types ... > src/integrations/supabase/types.ts`
-- (retire exchange_rates + les RPC associées de types.ts ; sinon le test de parité Mola pourrait les chercher).

-- Mola — PREUVE DE CONCEPT « capacités auto-découvertes » (AI-native).
-- Idée : l'étiquette de sécurité vit SUR l'opération (un COMMENT @mola:{...}), écrite au moment
-- où on construit le module. Mola SCANNE ces étiquettes (mola_discover_capabilities) et peut
-- exécuter l'opération SANS qu'on lui ait écrit un outil dédié. Une nouvelle RPC étiquetée =
-- Mola la découvre et l'utilise, zéro réécriture côté IA.
--
-- Convention de l'étiquette (JSON sur une ligne, après "@mola:") :
--   expose      : true/false (défaut false → une RPC non étiquetée n'est JAMAIS exposée = sûr)
--   kind        : "read" | "write"
--   permission  : clé de permission de rôle requise (canProcessDeposits, ...)
--   confirm     : true → carte de confirmation (argent/sensible)
--   danger      : true → carte « action sensible »
--   label       : libellé humain
--   resolve     : { param: "deposit|payment|client" } → Mola accepte une référence (BZ-...) et l'UUID est résolu

-- ── 3 RPC pilotes étiquetées (elles existaient déjà ; Mola n'avait PAS d'outil pour elles) ──
comment on function public.cancel_deposit(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","confirm":true,"danger":true,"label":"Annuler un dépôt","resolve":{"p_deposit_id":"deposit"}}';

comment on function public.confirm_cash_payment(uuid, text, text) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":false,"label":"Confirmer un paiement cash","resolve":{"p_payment_id":"payment"}}';

comment on function public.get_deposit_stats() is
  '@mola:{"expose":true,"kind":"read","permission":"canViewDeposits","label":"Statistiques des dépôts"}';

-- ── La DÉCOUVERTE : Mola lit les étiquettes + les paramètres réels (live, depuis le catalogue) ──
create or replace function public.mola_discover_capabilities(p_search text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_arguments(p.oid),                              -- paramètres RÉELS, live
      'meta', substring(d.description from '@mola:\s*(\{.*\})')::jsonb        -- l'étiquette
    ) order by p.proname
  ), '[]'::jsonb)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_description d on d.objoid = p.oid and d.classoid = 'pg_proc'::regclass
  where n.nspname = 'public'
    and d.description like '%@mola:%'
    and coalesce((substring(d.description from '@mola:\s*(\{.*\})')::jsonb ->> 'expose') = 'true', false)
    and (p_search is null or p.proname ilike '%'||p_search||'%' or d.description ilike '%'||p_search||'%');
$$;

revoke all on function public.mola_discover_capabilities(text) from public, anon;
grant execute on function public.mola_discover_capabilities(text) to authenticated, service_role;

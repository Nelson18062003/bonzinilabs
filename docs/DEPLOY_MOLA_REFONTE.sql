-- ==================================================================================
-- DÉPLOIEMENT COMPLET — Refonte « Mola » + nettoyage du système de taux
-- Regroupe les 6 migrations en UN fichier, dans l'ordre. À exécuter une fois
-- (ex. éditeur SQL Supabase). Équivalent à : npx supabase db push --linked
-- → n'utilise QU'UNE des deux méthodes (sinon le suivi des migrations Supabase diverge).
-- Idempotent-friendly : create [or replace] / if [not] exists / drop if exists.
-- APRÈS exécution : régénérer les types
--   npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
-- ==================================================================================

-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [1/6] 20260603120000_mola_memory.sql
-- └──────────────────────────────────────────────────────────────────────────────
-- Mola — Mémoire en couches (Lot 3).
-- Conception : docs/assistant-ops/refonte/04-MEMOIRE.md
--   - mola_memory       : sémantique (savoir/global) + épisodique (résumés de conv, par admin), vectorisé.
--   - mola_user_memory  : profil/préférences (structuré, NON vectorisé).
--   - assistant_conversations.rolling_summary : compaction des conversations longues.
--   - mola_search_memory(...) : recherche top-k par similarité cosinus, scopée (global + propre à l'admin).
-- Embeddings : gte-small (384 dim), générés DANS l'edge function (Supabase.ai) → rien ne sort de l'infra.
-- Best-effort : si l'embedding est indisponible, la table reste vide et l'assistant fonctionne normalement.

create extension if not exists vector;

-- ── Mémoire vectorisée ──────────────────────────────────────────────────────
create table if not exists public.mola_memory (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('semantic', 'episodic')),
  admin_user_id uuid references auth.users(id) on delete cascade,  -- NULL = savoir GLOBAL partagé
  scope         text,
  content       text not null,
  embedding     vector(384),
  source        text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);
create index if not exists idx_mola_memory_vec on public.mola_memory using hnsw (embedding vector_cosine_ops);
create index if not exists idx_mola_memory_scope on public.mola_memory (admin_user_id, kind, scope);

-- ── Profil / préférences / macros (structuré) ───────────────────────────────
create table if not exists public.mola_user_memory (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  key           text not null,
  value         jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (admin_user_id, key)
);

-- ── Compaction des conversations longues ────────────────────────────────────
alter table public.assistant_conversations add column if not exists rolling_summary text;
alter table public.assistant_conversations add column if not exists summary_through timestamptz;

-- ── RLS (protège les lectures directes depuis le frontend ; l'edge function écrit en service role) ──
alter table public.mola_memory enable row level security;
alter table public.mola_user_memory enable row level security;

drop policy if exists "mola_memory_read" on public.mola_memory;
create policy "mola_memory_read" on public.mola_memory for select
  using (
    (admin_user_id = auth.uid())
    or (admin_user_id is null and kind = 'semantic')
  );

drop policy if exists "mola_user_memory_owner" on public.mola_user_memory;
create policy "mola_user_memory_owner" on public.mola_user_memory for select
  using (admin_user_id = auth.uid());

-- ── Recherche vectorielle scopée (top-k cosinus) ────────────────────────────
create or replace function public.mola_search_memory(
  p_embedding vector(384),
  p_admin uuid,
  p_kinds text[] default array['semantic', 'episodic'],
  p_limit int default 6
) returns table (kind text, scope text, content text, distance double precision)
language sql
stable
security definer
set search_path = public
as $$
  select m.kind, m.scope, m.content, (m.embedding <=> p_embedding) as distance
  from public.mola_memory m
  where m.embedding is not null
    and m.kind = any(p_kinds)
    and (m.expires_at is null or m.expires_at > now())
    and (m.admin_user_id = p_admin or m.admin_user_id is null)
  order by m.embedding <=> p_embedding
  limit greatest(1, least(coalesce(p_limit, 6), 20));
$$;

revoke all on function public.mola_search_memory(vector, uuid, text[], int) from public, anon;
grant execute on function public.mola_search_memory(vector, uuid, text[], int) to authenticated, service_role;


-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [2/6] 20260603130000_assistant_query_scoped.sql
-- └──────────────────────────────────────────────────────────────────────────────
-- Mola — SQL libre SCOPÉ par rôle (Lot 4b). Remplace la mitigation QW-4 (super_admin only)
-- par un vrai contrôle : les tables réellement accédées (via EXPLAIN) doivent appartenir à
-- l'allowlist du rôle (passée par l'edge function). Conception : 05-SECURITE-EXPOSITION.md §2.
--
-- Philosophie inchangée : LIRE ne casse rien (transaction_read_only). On AJOUTE une garde de
-- CONFIDENTIALITÉ : un rôle ne lit, en SQL libre, que les tables de son périmètre.
-- p_allowed_tables NULL = pas de restriction (super_admin) — fail-OPEN volontaire pour ce seul cas.
-- p_allowed_tables fourni = fail-CLOSED (toute table hors liste, ou tout EXPLAIN qui échoue, → refus).

drop function if exists public.assistant_readonly_query(text);
drop function if exists public.assistant_readonly_query(text, text[]);

create or replace function public.assistant_readonly_query(p_sql text, p_allowed_tables text[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_clean text;
  v_lower text;
  v_result jsonb;
  v_plan jsonb;
  v_rels text[];
  v_rel text;
begin
  v_admin_id := auth.uid();
  if not public.is_admin(v_admin_id) then
    return jsonb_build_object('success', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_sql is null or length(trim(p_sql)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Requête vide.');
  end if;

  v_clean := trim(p_sql);
  v_clean := regexp_replace(v_clean, ';\s*$', '');
  v_lower := lower(v_clean);

  if v_lower !~ '^\s*(select|with)\s' then
    return jsonb_build_object('success', false, 'error', 'Seules les requêtes de lecture (SELECT) sont autorisées.');
  end if;

  if position(';' in v_clean) > 0 then
    return jsonb_build_object('success', false, 'error', 'Une seule requête à la fois (pas de point-virgule au milieu).');
  end if;

  if v_lower ~ '\y(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_get|lo_put|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|pg_reload_conf)\y' then
    return jsonb_build_object('success', false, 'error', 'Fonction système non autorisée.');
  end if;

  -- ── Garde de CONFIDENTIALITÉ par rôle (fail-closed) ──────────────────────
  if p_allowed_tables is not null then
    begin
      execute 'explain (format json) ' || v_clean into v_plan;
    exception when others then
      return jsonb_build_object('success', false, 'error', 'Requête non planifiable (vérifie tes noms de colonnes/tables) : ' || sqlerrm);
    end;
    -- Toutes les relations réellement accédées (récursif sur le plan, jointures/sous-requêtes comprises).
    select array_agg(distinct (rel #>> '{}'))
      into v_rels
      from jsonb_path_query(v_plan, '$.**."Relation Name"') as rel;
    if v_rels is not null then
      foreach v_rel in array v_rels loop
        if not (v_rel = any(p_allowed_tables)) then
          return jsonb_build_object('success', false, 'error',
            'Ton rôle n''a pas accès à la table « ' || v_rel || ' » en requête libre.');
        end if;
      end loop;
    end if;
  end if;

  perform set_config('statement_timeout', '8000', true);
  perform set_config('transaction_read_only', 'on', true);

  begin
    execute format(
      'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) _q limit 1000) t',
      v_clean
    ) into v_result;
  exception when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('success', true, 'rows', v_result, 'row_count', coalesce(jsonb_array_length(v_result), 0));
end;
$$;

revoke all on function public.assistant_readonly_query(text, text[]) from public, anon;
grant execute on function public.assistant_readonly_query(text, text[]) to authenticated;


-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [3/6] 20260603140000_mola_retention.sql
-- └──────────────────────────────────────────────────────────────────────────────
-- Mola — Rétention (Lot 4 / §5). Purge des conversations de l'assistant > N jours (défaut 180)
-- et des souvenirs épisodiques expirés. L'audit (admin_audit_logs) est conservé séparément, plus longtemps.
-- assistant_messages est supprimé en CASCADE avec sa conversation parente.

create or replace function public.mola_purge_old_conversations(p_days int default 180)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv int;
  v_mem int;
begin
  delete from public.assistant_conversations
  where updated_at < now() - make_interval(days => greatest(1, p_days));
  get diagnostics v_conv = row_count;

  delete from public.mola_memory
  where expires_at is not null and expires_at < now();
  get diagnostics v_mem = row_count;

  return jsonb_build_object('conversations_deleted', v_conv, 'expired_memory_deleted', v_mem);
end;
$$;

revoke all on function public.mola_purge_old_conversations(int) from public, anon;
grant execute on function public.mola_purge_old_conversations(int) to service_role;

-- Planification quotidienne si pg_cron est disponible (sinon, planifier manuellement côté Supabase).
-- On n'échoue JAMAIS la migration si pg_cron est absent.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mola-purge-conversations', '17 3 * * *',
      $cron$ select public.mola_purge_old_conversations(180); $cron$);
  end if;
exception when others then
  null;
end $$;


-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [4/6] 20260603150000_mola_capability_discovery.sql
-- └──────────────────────────────────────────────────────────────────────────────
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


-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [5/6] 20260603160000_mola_capability_tags_ops.sql
-- └──────────────────────────────────────────────────────────────────────────────
-- Mola — Industrialisation des capacités auto-découvertes (étiquetage des opérations).
-- Signatures vérifiées dans les migrations (ordre EXACT des types — requis par COMMENT ON FUNCTION).
--
-- expose:true  = Mola peut le découvrir + l'exécuter (avec permission + carte de confirmation).
-- expose:false = documenté mais ÉTEINT, en attente d'une décision explicite du fondateur
--                (actions très sensibles : gestion d'admins, reset de mot de passe, suppression de preuve).

-- ════════════ OPÉRATIONNEL — exposé (le métier du directeur des opérations) ════════════

-- Dépôts (cycle de vie)
comment on function public.revert_deposit_to_created(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","confirm":true,"danger":true,"label":"Remettre un dépôt à l''état créé","resolve":{"p_deposit_id":"deposit"}}';
comment on function public.start_deposit_review(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","confirm":true,"danger":false,"label":"Démarrer la revue d''un dépôt","resolve":{"p_deposit_id":"deposit"}}';

-- Paiements / cash
comment on function public.scan_cash_payment(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":false,"label":"Scanner un paiement cash","resolve":{"p_payment_id":"payment"}}';
comment on function public.process_payment(uuid, text, text) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Traiter un paiement (p_action: action; p_comment: commentaire)","resolve":{"p_payment_id":"payment"}}';

-- ════════════ SENSIBLE — ÉTEINT (expose:false) jusqu'à décision explicite ════════════
-- (Les reset de mot de passe vérifient DÉJÀ super_admin en interne ; on les laisse OFF par prudence.)

-- Activée (décision fondateur) : Mola peut supprimer/remplacer une preuve (toujours avec confirmation).
comment on function public.delete_payment_proof(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Supprimer une preuve de paiement"}';
comment on function public.admin_reset_client_password(uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un client (super_admin)","resolve":{"p_target_user_id":"client"}}';
comment on function public.admin_reset_password(uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un admin (super_admin)"}';
comment on function public.admin_create_admin(text, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Créer un administrateur"}';
comment on function public.toggle_admin_status(uuid, boolean) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Activer/désactiver un administrateur"}';
comment on function public.update_admin_role(uuid, app_role) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Changer le rôle d''un administrateur"}';
comment on function public.update_admin_profile(uuid, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Modifier le profil d''un administrateur"}';


-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [6/6] 20260603170000_drop_exchange_rates.sql
-- └──────────────────────────────────────────────────────────────────────────────
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


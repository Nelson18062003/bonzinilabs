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

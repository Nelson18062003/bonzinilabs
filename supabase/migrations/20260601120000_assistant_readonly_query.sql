-- Assistant DO IA — requête flexible en LECTURE SEULE.
-- Permet à l'agent d'écrire sa propre requête SELECT pour répondre à n'importe
-- quelle question, SANS pouvoir modifier quoi que ce soit. Défense en profondeur :
--   1. Réservé aux admins actifs (is_admin).
--   2. Refuse tout ce qui n'est pas un unique SELECT (mots-clés d'écriture bloqués).
--   3. Exécution en transaction READ ONLY (au niveau Postgres) → toute écriture échoue.
--   4. LIMIT forcée + timeout court.

create or replace function public.assistant_readonly_query(p_sql text)
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
  v_forbidden text[] := array[
    'insert','update','delete','drop','alter','truncate','create','grant',
    'revoke','comment','merge','call','do','copy','vacuum','reindex',
    'cluster','refresh','listen','notify','pg_sleep','set ','reset ',
    'security definer','into ',';--',';'
  ];
  v_kw text;
begin
  v_admin_id := auth.uid();
  if not public.is_admin(v_admin_id) then
    return jsonb_build_object('success', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_sql is null or length(trim(p_sql)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Requête vide.');
  end if;

  v_clean := trim(p_sql);
  -- retire un éventuel point-virgule final unique (toléré), puis on interdit tout autre ';'
  v_clean := regexp_replace(v_clean, ';\s*$', '');
  v_lower := lower(v_clean);

  -- Doit commencer par SELECT ou WITH (CTE en lecture)
  if not (v_lower like 'select%' or v_lower like 'with%') then
    return jsonb_build_object('success', false, 'error', 'Seules les requêtes SELECT sont autorisées.');
  end if;

  -- Mots-clés d'écriture / dangereux interdits (defense in depth, en plus de READ ONLY)
  foreach v_kw in array v_forbidden loop
    if position(v_kw in v_lower) > 0 then
      return jsonb_build_object('success', false, 'error', format('Mot-clé interdit détecté : %s. Seule la lecture (SELECT) est permise.', trim(v_kw)));
    end if;
  end loop;

  -- Garde-fous d'exécution
  set local statement_timeout = '8s';
  set local transaction read only;  -- toute tentative d'écriture échoue ici, même via fonction

  -- Exécute la requête en limitant le volume (sous-requête + LIMIT global)
  begin
    execute format(
      'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) _q limit 200) t',
      v_clean
    ) into v_result;
  exception when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('success', true, 'rows', v_result, 'row_count', jsonb_array_length(v_result));
end;
$$;

revoke all on function public.assistant_readonly_query(text) from public, anon;
grant execute on function public.assistant_readonly_query(text) to authenticated;

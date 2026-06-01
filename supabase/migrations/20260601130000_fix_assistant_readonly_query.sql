-- Assistant DO IA — CORRECTIF de assistant_readonly_query.
-- Le filtre précédent bloquait les mots ('create','update','comment','set'...)
-- en SOUS-CHAÎNE → il rejetait à tort created_at, updated_at, admin_comment,
-- OFFSET, etc. (présents dans presque toute requête). Résultat : tout était
-- "restreint". Ici on corrige :
--   1. Blocage des mots d'écriture en MOTS ENTIERS uniquement (\y...\y) →
--      created_at / updated_at / admin_comment / offset passent sans souci.
--   2. Vrai garde-fou : mode LECTURE SEULE au niveau Postgres
--      (set_config('transaction_read_only','on',true)) → toute écriture échoue,
--      même via un appel de fonction caché dans un SELECT.
--   3. is_admin requis, une seule requête (pas de ';' interne), doit commencer
--      par SELECT/WITH, statement_timeout 8s, LIMIT 500.

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
begin
  v_admin_id := auth.uid();
  if not public.is_admin(v_admin_id) then
    return jsonb_build_object('success', false, 'error', 'Accès réservé aux administrateurs.');
  end if;

  if p_sql is null or length(trim(p_sql)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Requête vide.');
  end if;

  v_clean := trim(p_sql);
  v_clean := regexp_replace(v_clean, ';\s*$', ''); -- retire un point-virgule final unique
  v_lower := lower(v_clean);

  -- Doit être une requête de lecture
  if v_lower !~ '^\s*(select|with)\s' then
    return jsonb_build_object('success', false, 'error', 'Seules les requêtes SELECT sont autorisées.');
  end if;

  -- Une seule requête (pas d'enchaînement)
  if position(';' in v_clean) > 0 then
    return jsonb_build_object('success', false, 'error', 'Une seule requête à la fois (point-virgule interdit au milieu).');
  end if;

  -- Mots d'écriture interdits — en MOTS ENTIERS seulement (n'affecte pas
  -- created_at, updated_at, admin_comment, offset, etc.)
  if v_lower ~ '\y(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|call|copy|vacuum|reindex|cluster|refresh|listen|notify|lock|nextval|setval|dblink|pg_read_file|pg_sleep|lo_import|lo_export|pg_terminate_backend)\y' then
    return jsonb_build_object('success', false, 'error', 'Seule la lecture est permise (mot-clé d''écriture détecté).');
  end if;

  -- Garde-fous d'exécution
  perform set_config('statement_timeout', '8000', true);
  -- Vrai verrou : passer la transaction en LECTURE SEULE. Toute tentative
  -- d'écriture (y compris via une fonction appelée dans le SELECT) échouera.
  perform set_config('transaction_read_only', 'on', true);

  begin
    execute format(
      'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) _q limit 500) t',
      v_clean
    ) into v_result;
  exception when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
  end;

  return jsonb_build_object('success', true, 'rows', v_result, 'row_count', coalesce(jsonb_array_length(v_result), 0));
end;
$$;

revoke all on function public.assistant_readonly_query(text) from public, anon;
grant execute on function public.assistant_readonly_query(text) to authenticated;

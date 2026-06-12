-- Assistant DO IA — requête SQL LIBRE en lecture (version ouverte, définitive).
-- Remplace les versions précédentes (120000/130000). C'est la SEULE migration à
-- exécuter pour query_database.
--
-- Philosophie : LIRE ne peut rien casser. Le vrai garde-fou n'est PAS un filtre de
-- mots (qui rejetait à tort created_at, updated_at, etc.), mais le mode
-- TRANSACTION READ ONLY de Postgres : dans ce mode, TOUTE écriture
-- (INSERT/UPDATE/DELETE/DDL) échoue automatiquement, même cachée dans une fonction.
-- L'agent peut donc écrire la requête SELECT qu'il veut pour répondre aux questions.
--
-- Restrictions minimales restantes (pas du flicage, juste anti-abus serveur) :
--   - réservé aux admins (is_admin),
--   - doit être une lecture (commence par SELECT ou WITH),
--   - une seule requête,
--   - quelques fonctions système d'accès fichier/réseau/DoS bloquées,
--   - timeout 8s, max 1000 lignes.

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
  v_clean := regexp_replace(v_clean, ';\s*$', ''); -- point-virgule final unique toléré
  v_lower := lower(v_clean);

  -- Lecture uniquement
  if v_lower !~ '^\s*(select|with)\s' then
    return jsonb_build_object('success', false, 'error', 'Seules les requêtes de lecture (SELECT) sont autorisées.');
  end if;

  -- Une seule requête (le wrapping ci-dessous l'exige de toute façon)
  if position(';' in v_clean) > 0 then
    return jsonb_build_object('success', false, 'error', 'Une seule requête à la fois (pas de point-virgule au milieu).');
  end if;

  -- Anti-abus serveur uniquement (accès fichiers, réseau, DoS) — en MOTS ENTIERS.
  -- N'affecte AUCUN nom de colonne courant. Les mots create/update/delete ne sont
  -- volontairement PAS ici : le mode read-only suffit à empêcher toute écriture,
  -- et les bloquer cassait created_at/updated_at.
  if v_lower ~ '\y(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_get|lo_put|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|pg_reload_conf)\y' then
    return jsonb_build_object('success', false, 'error', 'Fonction système non autorisée.');
  end if;

  -- Garde-fous d'exécution
  perform set_config('statement_timeout', '8000', true);
  perform set_config('transaction_read_only', 'on', true); -- VRAI verrou : aucune écriture possible

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

revoke all on function public.assistant_readonly_query(text) from public, anon;
grant execute on function public.assistant_readonly_query(text) to authenticated;

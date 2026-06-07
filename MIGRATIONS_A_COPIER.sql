-- ════════════════════════════════════════════════════════════════════════════
-- 📋 À COPIER-COLLER DANS L'ÉDITEUR SQL SUPABASE (puis « Run »).
--
-- Ce fichier est une COPIE pratique de l'unique migration de ce lot :
--   supabase/migrations/20260607000000_mola_capability_tags_extend.sql
-- (les deux ont exactement le même contenu — ce fichier-ci sert juste à copier vite).
--
-- Il est IDEMPOTENT (CREATE OR REPLACE / commentaires) : tu peux le relancer sans risque.
-- Après l'avoir exécuté : régénère les types (npx supabase gen types …) et redéploie
-- les edge functions admin-assistant et generate-receipt.
-- ════════════════════════════════════════════════════════════════════════════

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Mola — Couverture étendue des capacités (« tout piloter depuis Mola »)     ║
-- ║ FICHIER UNIQUE : à exécuter tel quel (idempotent, CREATE OR REPLACE).      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Contenu :
--   SECTION 1 — Corrige les RPC de gestion d'admin qui référençaient la table
--               `profiles` (SUPPRIMÉE) → remplacée par `user_roles` (admins) et
--               `clients` (clients). Sans ça, ces actions échouent à l'exécution.
--   SECTION 2 — Crée les RPC manquantes pour le chat (réponses pré-enregistrées /
--               réponses rapides), aujourd'hui faites en écriture directe dans
--               l'écran, donc invisibles à Mola.
--   SECTION 3 — Étiquette @mola TOUTES les actions ci-dessus (+ quelques actions
--               déjà en base) pour que Mola les découvre et les exécute.
--
-- Principe : chaque action porte la PERMISSION NATURELLE de son domaine → tout
-- admin pilote depuis Mola ce que son rôle autorise déjà. do_capability garde la
-- permission + impose une carte de confirmation. RPC SECURITY DEFINER : les droits
-- sont revérifiés côté base (défense en profondeur).


-- ════════════════════════ SECTION 1 — FIX RPC ADMIN (profiles → user_roles/clients) ════════════════════════

-- 1.1 — admin_create_admin : ne plus INSÉRER dans profiles ; stocker prénom/nom
--       directement dans user_roles (qui possède first_name/last_name).
create or replace function public.admin_create_admin(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_role text
) returns jsonb
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  new_user_id uuid;
  encrypted_pw text;
  temp_password text;
  valid_roles text[] := array['super_admin', 'ops', 'support', 'customer_success', 'cash_agent'];
  caller_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin';

  if caller_role is null then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut créer des administrateurs');
  end if;

  if p_email is null or trim(p_email) = '' then
    return jsonb_build_object('success', false, 'error', 'L''email est requis');
  end if;
  if p_first_name is null or trim(p_first_name) = '' then
    return jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  end if;
  if p_last_name is null or trim(p_last_name) = '' then
    return jsonb_build_object('success', false, 'error', 'Le nom est requis');
  end if;
  if p_role is null or trim(p_role) = '' then
    return jsonb_build_object('success', false, 'error', 'Le rôle est requis');
  end if;
  if not p_role = any(valid_roles) then
    return jsonb_build_object('success', false, 'error', 'Rôle invalide. Valeurs acceptées: ' || array_to_string(valid_roles, ', '));
  end if;

  if exists (select 1 from auth.users where email = lower(trim(p_email))) then
    return jsonb_build_object('success', false, 'error', 'Un compte avec cet email existe déjà');
  end if;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));
  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
    created_at, updated_at,
    is_sso_user, confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id, 'authenticated', 'authenticated',
    lower(trim(p_email)), encrypted_pw, now(),
    jsonb_build_object('first_name', trim(p_first_name), 'last_name', trim(p_last_name)),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    now(), now(), false, '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_user_id, new_user_id::text, 'email',
    jsonb_build_object('sub', new_user_id::text, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );

  -- (Avant : INSERT INTO public.profiles — table supprimée.) Le prénom/nom vit
  -- désormais dans user_roles, source de vérité pour les admins.
  insert into public.user_roles (user_id, role, email, is_disabled, first_name, last_name)
  values (new_user_id, p_role::public.app_role, lower(trim(p_email)), false, trim(p_first_name), trim(p_last_name));

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    auth.uid(), 'create_admin', 'admin_user', new_user_id,
    jsonb_build_object(
      'description', 'Création de l''admin ' || trim(p_first_name) || ' ' || trim(p_last_name) || ' (' || trim(p_email) || ')',
      'role', p_role, 'email', lower(trim(p_email))
    )
  );

  return jsonb_build_object(
    'success', true, 'userId', new_user_id, 'email', lower(trim(p_email)),
    'tempPassword', temp_password,
    'message', 'Admin ' || trim(p_first_name) || ' ' || trim(p_last_name) || ' créé avec succès'
  );

exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'Un compte avec ces informations existe déjà');
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- 1.2 — admin_reset_password : lire le nom dans user_roles (au lieu de profiles).
create or replace function public.admin_reset_password(
  p_target_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  temp_password text;
  encrypted_pw text;
  caller_role text;
  v_first text;
  v_last text;
  v_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin';

  if caller_role is null then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut réinitialiser les mots de passe');
  end if;

  if p_target_user_id is null then
    return jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur cible est requis');
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  -- Cible + nom depuis user_roles (source de vérité admin).
  select first_name, last_name, role
    into v_first, v_last, v_role
  from public.user_roles
  where user_id = p_target_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Utilisateur admin non trouvé');
  end if;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  update auth.users set encrypted_password = encrypted_pw, updated_at = now()
  where id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    auth.uid(), 'reset_admin_password', 'admin_user', p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || coalesce(v_first, '') || ' ' || coalesce(v_last, ''),
      'target_role', v_role
    )
  );

  return jsonb_build_object(
    'success', true, 'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || coalesce(v_first, '') || ' ' || coalesce(v_last, '')
  );

exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- 1.3 — admin_reset_client_password : lire le nom dans clients (au lieu de profiles).
create or replace function public.admin_reset_client_password(
  p_target_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = auth, public, extensions
as $$
declare
  temp_password text;
  encrypted_pw text;
  caller_role text;
  target_profile record;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin';

  if caller_role is null then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut réinitialiser les mots de passe');
  end if;

  if p_target_user_id is null then
    return jsonb_build_object('success', false, 'error', 'L''ID de l''utilisateur est requis');
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  -- Nom depuis clients (source de vérité client).
  select first_name, last_name into target_profile
  from public.clients
  where user_id = p_target_user_id;

  temp_password := substr(md5(random()::text), 1, 8) || substr(md5(random()::text), 1, 4);
  encrypted_pw := crypt(temp_password, gen_salt('bf'));

  update auth.users set encrypted_password = encrypted_pw, updated_at = now()
  where id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    auth.uid(), 'reset_client_password', 'client', p_target_user_id,
    jsonb_build_object(
      'description', 'Réinitialisation du mot de passe de ' || coalesce(target_profile.first_name, '') || ' ' || coalesce(target_profile.last_name, '')
    )
  );

  return jsonb_build_object(
    'success', true, 'tempPassword', temp_password,
    'message', 'Mot de passe réinitialisé pour ' || coalesce(target_profile.first_name, '') || ' ' || coalesce(target_profile.last_name, '')
  );

exception
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- 1.4 — toggle_admin_status : lire le nom dans user_roles (au lieu de profiles).
create or replace function public.toggle_admin_status(
  p_target_user_id uuid,
  p_disabled boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_target_role text;
  v_target_name text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;
  if v_caller_id = p_target_user_id then
    return jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre statut');
  end if;

  select role into v_caller_role from public.user_roles where user_id = v_caller_id;
  if v_caller_role is distinct from 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  end if;

  select role, coalesce(first_name || ' ' || last_name, 'Admin')
    into v_target_role, v_target_name
  from public.user_roles where user_id = p_target_user_id;

  if v_target_role is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  update public.user_roles set is_disabled = p_disabled where user_id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller_id,
    case when p_disabled then 'disable_admin' else 'enable_admin' end,
    'admin_user', p_target_user_id,
    jsonb_build_object(
      'description', case when p_disabled then 'Désactivation de l''admin ' || v_target_name else 'Réactivation de l''admin ' || v_target_name end,
      'target_role', v_target_role,
      'new_status', case when p_disabled then 'DISABLED' else 'ACTIVE' end
    )
  );

  return jsonb_build_object('success', true);
end;
$$;

-- 1.5 — update_admin_role : lire le nom dans user_roles (au lieu de profiles).
create or replace function public.update_admin_role(
  p_target_user_id uuid,
  p_new_role app_role
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_old_role text;
  v_target_name text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;
  if v_caller_id = p_target_user_id then
    return jsonb_build_object('success', false, 'error', 'Impossible de modifier votre propre rôle');
  end if;

  select role into v_caller_role from public.user_roles where user_id = v_caller_id;
  if v_caller_role is distinct from 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  end if;

  select role, coalesce(first_name || ' ' || last_name, 'Admin')
    into v_old_role, v_target_name
  from public.user_roles where user_id = p_target_user_id;

  if v_old_role is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  update public.user_roles set role = p_new_role where user_id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller_id, 'update_admin_role', 'admin_user', p_target_user_id,
    jsonb_build_object(
      'description', 'Modification du rôle de ' || v_target_name || ' de ' || v_old_role || ' à ' || p_new_role::text,
      'old_role', v_old_role, 'new_role', p_new_role::text
    )
  );

  return jsonb_build_object('success', true);
end;
$$;

-- 1.6 — update_admin_profile : écrire dans user_roles (au lieu de profiles).
create or replace function public.update_admin_profile(
  p_target_user_id uuid,
  p_first_name text,
  p_last_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid;
  v_caller_role text;
  v_target_role text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into v_caller_role from public.user_roles where user_id = v_caller_id;
  if v_caller_role is distinct from 'super_admin' then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut effectuer cette action');
  end if;

  select role into v_target_role from public.user_roles where user_id = p_target_user_id;
  if v_target_role is null then
    return jsonb_build_object('success', false, 'error', 'Utilisateur non trouvé');
  end if;

  update public.user_roles
  set first_name = p_first_name, last_name = p_last_name
  where user_id = p_target_user_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller_id, 'update_admin_profile', 'admin_user', p_target_user_id,
    jsonb_build_object('description', 'Modification du profil admin', 'first_name', p_first_name, 'last_name', p_last_name)
  );

  return jsonb_build_object('success', true);
end;
$$;


-- ════════════════════════ SECTION 2 — NOUVELLES RPC CHAT ════════════════════════
-- Miroir du pattern reorder_canned_responses / reorder_quick_replies :
-- SECURITY DEFINER, search_path = public, garde super_admin (cohérent avec les RLS
-- d'écriture existantes sur ces tables), retour jsonb {success, ...}.

-- 2.1 — Réponses pré-enregistrées (chat_canned_responses)
create or replace function public.admin_create_canned_response(
  p_label text,
  p_content text,
  p_sort_order integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Réservé au super_admin.');
  end if;
  if p_label is null or trim(p_label) = '' or p_content is null or trim(p_content) = '' then
    return jsonb_build_object('success', false, 'error', 'Libellé et contenu obligatoires.');
  end if;
  insert into public.chat_canned_responses (label, content, sort_order, created_by)
  values (
    trim(p_label), trim(p_content), coalesce(p_sort_order, 0),
    (select id from public.user_roles where user_id = auth.uid())
  )
  returning id into v_id;
  return jsonb_build_object('success', true, 'id', v_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.admin_update_canned_response(
  p_id uuid,
  p_label text default null,
  p_content text default null,
  p_sort_order integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Réservé au super_admin.');
  end if;
  update public.chat_canned_responses set
    label = coalesce(nullif(trim(p_label), ''), label),
    content = coalesce(nullif(trim(p_content), ''), content),
    sort_order = coalesce(p_sort_order, sort_order),
    updated_at = now()
  where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Réponse pré-enregistrée introuvable.');
  end if;
  return jsonb_build_object('success', true, 'id', p_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.admin_delete_canned_response(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Réservé au super_admin.');
  end if;
  delete from public.chat_canned_responses where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Réponse pré-enregistrée introuvable.');
  end if;
  return jsonb_build_object('success', true, 'id', p_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- 2.2 — Réponses rapides client (chat_client_quick_replies)
create or replace function public.admin_create_quick_reply(
  p_label text,
  p_content text,
  p_sort_order integer default 0,
  p_active boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Réservé au super_admin.');
  end if;
  if p_label is null or trim(p_label) = '' or p_content is null or trim(p_content) = '' then
    return jsonb_build_object('success', false, 'error', 'Libellé et contenu obligatoires.');
  end if;
  insert into public.chat_client_quick_replies (label, content, sort_order, active)
  values (trim(p_label), trim(p_content), coalesce(p_sort_order, 0), coalesce(p_active, true))
  returning id into v_id;
  return jsonb_build_object('success', true, 'id', v_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.admin_update_quick_reply(
  p_id uuid,
  p_label text default null,
  p_content text default null,
  p_sort_order integer default null,
  p_active boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Réservé au super_admin.');
  end if;
  update public.chat_client_quick_replies set
    label = coalesce(nullif(trim(p_label), ''), label),
    content = coalesce(nullif(trim(p_content), ''), content),
    sort_order = coalesce(p_sort_order, sort_order),
    active = coalesce(p_active, active),
    updated_at = now()
  where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Réponse rapide introuvable.');
  end if;
  return jsonb_build_object('success', true, 'id', p_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

create or replace function public.admin_delete_quick_reply(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin' and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Réservé au super_admin.');
  end if;
  delete from public.chat_client_quick_replies where id = p_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Réponse rapide introuvable.');
  end if;
  return jsonb_build_object('success', true, 'id', p_id);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;


-- ════════════════════════ SECTION 3 — DROITS D'EXÉCUTION ════════════════════════
-- (Les RPC revérifient super_admin en interne ; grant à authenticated = OK.)
grant execute on function public.admin_create_admin(text, text, text, text) to authenticated;
grant execute on function public.admin_reset_password(uuid) to authenticated;
grant execute on function public.admin_reset_client_password(uuid) to authenticated;
grant execute on function public.toggle_admin_status(uuid, boolean) to authenticated;
grant execute on function public.update_admin_role(uuid, app_role) to authenticated;
grant execute on function public.update_admin_profile(uuid, text, text) to authenticated;

revoke all on function
  public.admin_create_canned_response(text, text, integer),
  public.admin_update_canned_response(uuid, text, text, integer),
  public.admin_delete_canned_response(uuid),
  public.admin_create_quick_reply(text, text, integer, boolean),
  public.admin_update_quick_reply(uuid, text, text, integer, boolean),
  public.admin_delete_quick_reply(uuid)
  from public, anon;
grant execute on function
  public.admin_create_canned_response(text, text, integer),
  public.admin_update_canned_response(uuid, text, text, integer),
  public.admin_delete_canned_response(uuid),
  public.admin_create_quick_reply(text, text, integer, boolean),
  public.admin_update_quick_reply(uuid, text, text, integer, boolean),
  public.admin_delete_quick_reply(uuid)
  to authenticated;


-- ════════════════════════ SECTION 4 — ÉTIQUETAGE @mola ════════════════════════
-- Méthode robuste (comme 20260603180000) : on commente par la SIGNATURE RÉELLE
-- (oid::regprocedure), ce qui gère les surcharges et évite de réécrire les types.
do $$
declare
  rec record;
  r record;
begin
  for rec in
    select * from (values
      -- ── Actions existantes — dépôts / paiements ──
      ('delete_deposit',                 '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer un dépôt (définitif)","resolve":{"p_deposit_id":"deposit"}}'),
      ('delete_payment',                 '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer un paiement (définitif)","resolve":{"p_payment_id":"payment"}}'),
      ('request_deposit_correction',     '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","danger":true,"label":"Demander une correction de dépôt","resolve":{"p_deposit_id":"deposit"}}'),
      ('submit_deposit_proof',           '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","label":"Marquer la preuve d''un dépôt comme soumise","resolve":{"p_deposit_id":"deposit"}}'),

      -- ── Gestion des admins (super_admin via canManageUsers) ──
      ('admin_create_admin',             '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Créer un compte administrateur"}'),
      ('admin_reset_password',           '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un admin"}'),
      ('admin_reset_client_password',    '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un client"}'),
      ('toggle_admin_status',            '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Activer / désactiver un admin"}'),
      ('update_admin_role',              '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Changer le rôle d''un admin"}'),
      ('update_admin_profile',           '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","label":"Modifier le profil d''un admin"}'),

      -- ── Chat — réponses pré-enregistrées / rapides (nouvelles RPC) ──
      ('admin_create_canned_response',   '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","label":"Créer une réponse pré-enregistrée (chat)"}'),
      ('admin_update_canned_response',   '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","label":"Modifier une réponse pré-enregistrée (chat)"}'),
      ('admin_delete_canned_response',   '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer une réponse pré-enregistrée (chat)"}'),
      ('admin_create_quick_reply',       '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","label":"Créer une réponse rapide client (chat)"}'),
      ('admin_update_quick_reply',       '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","label":"Modifier une réponse rapide client (chat)"}'),
      ('admin_delete_quick_reply',       '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer une réponse rapide client (chat)"}')
    ) as t(fn, meta)
  loop
    for r in
      select oid::regprocedure as sig
      from pg_proc
      where proname = rec.fn and pronamespace = 'public'::regnamespace
    loop
      execute format('comment on function %s is %L', r.sig::text, rec.meta);
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';

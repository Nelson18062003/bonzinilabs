-- ============================================================================
-- Correctif à passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) :
-- copie exacte de supabase/migrations/20260921090000_admin_create_admin_any_role.sql.
-- Suppose que migrations/20260920_consolidated_reception-colis.sql est déjà passé
-- (le rôle receptionist doit exister dans app_role). Idempotent.
-- ============================================================================

-- ============================================================================
-- admin_create_admin : accepter tout rôle de l'énumération app_role
--
-- Symptôme : « Rôle invalide. Valeurs acceptées: super_admin, ops, support,
-- customer_success, cash_agent » à la création d'un réceptionnaire (et d'un
-- trésorier). La RPC portait une liste de rôles codée en dur, figée avant
-- l'ajout de `treasurer` puis de `receptionist` à l'énumération.
--
-- Correctif : la liste des rôles valides se lit dans l'énumération elle-même
-- (enum_range) — ajouter un rôle à `app_role` suffit désormais. Au passage, un
-- super admin désactivé ne peut plus créer d'administrateur (règle projet :
-- toute lecture de rôle filtre is_disabled). Le corps est celui de
-- 20260607000000 (user_roles, sans profiles). Idempotent.
-- ============================================================================

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
  -- Tous les rôles de l'énumération, dans l'ordre de déclaration.
  valid_roles text[] := (select array_agg(e::text) from unnest(enum_range(null::public.app_role)) as e);
  caller_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select role into caller_role
  from public.user_roles
  where user_id = auth.uid() and role = 'super_admin'
    and (is_disabled = false or is_disabled is null);

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

comment on function public.admin_create_admin(text, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","danger":true,"label":"Créer un administrateur"}';

-- Mola — Couverture étendue des capacités (objectif : « tout piloter depuis Mola »).
-- Étape de fermeture du gap identifié par l'audit de couverture :
--   A) Étiqueter @mola des actions déjà en base mais invisibles à Mola.
--   B) Étiqueter la GESTION DES ADMINS (réservée super_admin via canManageUsers).
--   C) Créer les RPC manquantes pour le chat (réponses pré-enregistrées / réponses
--      rapides), aujourd'hui faites en écriture directe dans l'écran → donc invisibles
--      à Mola, puis les étiqueter.
--
-- Principe : chaque action porte la PERMISSION NATURELLE de son domaine → tout admin
-- pilote depuis Mola ce que son rôle autorise déjà (un agent de dépôt → les dépôts,
-- etc.). do_capability garde la permission + impose une carte de confirmation.
-- Les RPC sont SECURITY DEFINER et revérifient les droits côté base (défense en profondeur).

-- ════════════════════════ C) NOUVELLES RPC — CHAT ════════════════════════
-- Mirroir du pattern reorder_canned_responses / reorder_quick_replies :
-- SECURITY DEFINER, search_path = public, garde super_admin (cohérent avec les RLS
-- d'écriture existantes sur ces tables), retour jsonb {success, ...}.

-- ── Réponses pré-enregistrées (chat_canned_responses) ──
create or replace function public.admin_create_canned_response(
  p_label text,
  p_content text,
  p_sort_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
      and (is_disabled = false or is_disabled is null)
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
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
      and (is_disabled = false or is_disabled is null)
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
    where user_id = auth.uid() and role = 'super_admin'
      and (is_disabled = false or is_disabled is null)
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

-- ── Réponses rapides client (chat_client_quick_replies) ──
create or replace function public.admin_create_quick_reply(
  p_label text,
  p_content text,
  p_sort_order integer default 0,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
      and (is_disabled = false or is_disabled is null)
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
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
      and (is_disabled = false or is_disabled is null)
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
    where user_id = auth.uid() and role = 'super_admin'
      and (is_disabled = false or is_disabled is null)
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

-- Droits d'exécution (les RPC revérifient super_admin en interne).
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

-- ════════════════════════ A + B) ÉTIQUETAGE @mola ════════════════════════
-- Méthode robuste (comme 20260603180000) : on commente par la SIGNATURE RÉELLE
-- (oid::regprocedure), ce qui gère les surcharges et évite de réécrire les types.
do $$
declare
  rec record;
  r record;
begin
  for rec in
    select * from (values
      -- ── A) Actions existantes — dépôts / paiements ──
      ('delete_deposit',                 '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer un dépôt (définitif)","resolve":{"p_deposit_id":"deposit"}}'),
      ('delete_payment',                 '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer un paiement (définitif)","resolve":{"p_payment_id":"payment"}}'),
      ('request_deposit_correction',     '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","danger":true,"label":"Demander une correction de dépôt","resolve":{"p_deposit_id":"deposit"}}'),
      ('submit_deposit_proof',           '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","label":"Marquer la preuve d''un dépôt comme soumise","resolve":{"p_deposit_id":"deposit"}}'),

      -- ── B) Gestion des admins (super_admin via canManageUsers) ──
      ('admin_create_admin',             '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Créer un compte administrateur"}'),
      ('admin_reset_password',           '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un admin"}'),
      ('admin_reset_client_password',    '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Réinitialiser le mot de passe d''un client"}'),
      ('toggle_admin_status',            '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Activer / désactiver un admin"}'),
      ('update_admin_role',              '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Changer le rôle d''un admin"}'),
      ('update_admin_profile',           '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","label":"Modifier le profil d''un admin"}'),

      -- ── C) Chat — réponses pré-enregistrées / rapides (nouvelles RPC ci-dessus) ──
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

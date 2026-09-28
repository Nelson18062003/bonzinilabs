-- ============================================================================
-- BONZINI HQ — notifications push du personnel (app mobile Expo).
--
-- 1. staff_push_devices : un téléphone = un jeton Expo, rattaché à la personne
--    connectée. Aucune politique RLS : accès uniquement par les RPC.
-- 2. register_staff_push_device / unregister_staff_push_device : appelées par
--    l'app (membre du staff actif uniquement).
-- 3. send_staff_push : envoi via l'API Expo (pg_net, asynchrone) aux
--    personnes qui ont la PERMISSION voulue (admin_has_permission, qui filtre
--    les comptes désactivés), éventuellement limité à certains rôles. Interne :
--    aucun client ne peut l'appeler. Ne fait JAMAIS échouer l'opération métier.
-- 4. Déclencheurs sur les tables (quel que soit le chemin qui écrit) :
--      · dépôt avec preuve envoyée        → canProcessDeposits
--      · paiement prêt à traiter          → canProcessPayments
--      · paiement cash à remettre         → agents cash
--      · paiement cash scanné à confirmer → super admin, opérations
--      · message d'un client au support   → canAccessSupportChat
--      · vol ou conteneur arrivé, colis à pointer → canReceiveAtDestination
--    L'auteur de l'action n'est pas prévenu de sa propre action.
-- Idempotent.
-- ============================================================================

-- 1. Les téléphones ---------------------------------------------------------
create table if not exists public.staff_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  app_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists staff_push_devices_user_idx on public.staff_push_devices (user_id);
alter table public.staff_push_devices enable row level security;
revoke all on public.staff_push_devices from anon, authenticated;

-- 2. Enregistrer / retirer un téléphone -------------------------------------
create or replace function public.register_staff_push_device(
  p_token text,
  p_platform text,
  p_device_name text default null,
  p_app_version text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;
  -- Qui : un membre du staff ACTIF (un admin désactivé garde son JWT un temps).
  if not exists (
    select 1 from public.user_roles
    where user_id = v_uid and (is_disabled = false or is_disabled is null)
  ) then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then
    return jsonb_build_object('success', false, 'error', 'Jeton de notification invalide');
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    return jsonb_build_object('success', false, 'error', 'Plateforme invalide');
  end if;

  -- Un téléphone passé d'une personne à une autre suit la dernière connectée.
  insert into public.staff_push_devices (user_id, expo_token, platform, device_name, app_version)
  values (v_uid, p_token, p_platform, left(p_device_name, 80), left(p_app_version, 20))
  on conflict (expo_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        device_name = excluded.device_name,
        app_version = excluded.app_version,
        last_seen_at = now();

  return jsonb_build_object('success', true);
end;
$$;
comment on function public.register_staff_push_device(text, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canViewLogs","confirm":false,"danger":false,"label":"Enregistrer ce téléphone pour les notifications de l''app BONZINI HQ"}';
revoke execute on function public.register_staff_push_device(text, text, text, text) from public, anon;
grant execute on function public.register_staff_push_device(text, text, text, text) to authenticated;

create or replace function public.unregister_staff_push_device(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;
  -- Sur SA ligne seulement : on ne retire pas le téléphone d'un collègue.
  delete from public.staff_push_devices where expo_token = p_token and user_id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;
comment on function public.unregister_staff_push_device(text) is
  '@mola:{"expose":false,"kind":"write","permission":"canViewLogs","confirm":false,"danger":false,"label":"Retirer ce téléphone des notifications de l''app BONZINI HQ"}';
revoke execute on function public.unregister_staff_push_device(text) from public, anon;
grant execute on function public.unregister_staff_push_device(text) to authenticated;

-- 3. Envoyer ----------------------------------------------------------------
create or replace function public.send_staff_push(
  p_permission text,
  p_title text,
  p_body text,
  p_path text,
  p_roles text[] default null,
  p_exclude uuid default null
) returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_msgs jsonb;
  v_total integer;
  v_chunk jsonb;
  i integer;
begin
  select jsonb_agg(jsonb_build_object(
           'to', d.expo_token,
           'title', p_title,
           'body', p_body,
           'data', jsonb_build_object('path', p_path),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default'))
    into v_msgs
    from public.staff_push_devices d
    join public.user_roles r
      on r.user_id = d.user_id and (r.is_disabled = false or r.is_disabled is null)
   where (p_permission is null or public.admin_has_permission(d.user_id, p_permission))
     and (p_roles is null or r.role::text = any (p_roles))
     and (p_exclude is null or d.user_id <> p_exclude);

  if v_msgs is null then
    return 0;
  end if;

  v_total := jsonb_array_length(v_msgs);
  -- L'API Expo accepte 100 messages par requête.
  for i in 0 .. (v_total - 1) / 100 loop
    select jsonb_agg(e) into v_chunk
      from jsonb_array_elements(v_msgs) with ordinality as t(e, n)
     where n > i * 100 and n <= (i + 1) * 100;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_chunk,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end loop;
  return v_total;
exception when others then
  -- Une notification ratée ne doit jamais bloquer un dépôt ou un paiement.
  raise warning 'send_staff_push: %', sqlerrm;
  return 0;
end;
$$;
comment on function public.send_staff_push(text, text, text, text, text[], uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push au personnel (interne)"}';
revoke execute on function public.send_staff_push(text, text, text, text, text[], uuid) from public, anon, authenticated;

-- Aides d'affichage ----------------------------------------------------------
create or replace function public.staff_push_amount(p numeric)
returns text language sql immutable as $$
  select replace(to_char(round(coalesce(p, 0)), 'FM999,999,999,999'), ',', ' ')
$$;
revoke execute on function public.staff_push_amount(numeric) from public, anon, authenticated;

create or replace function public.staff_push_client_name(p_user_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.company_name, 'Client')
    from public.clients c where c.user_id = p_user_id
$$;
revoke execute on function public.staff_push_client_name(uuid) from public, anon, authenticated;

-- 4. Déclencheurs -----------------------------------------------------------

-- Dépôt : le client a envoyé sa preuve → à valider.
create or replace function public.staff_push_on_deposit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'proof_submitted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.send_staff_push(
      'canProcessDeposits',
      'Dépôt à valider',
      coalesce(public.staff_push_client_name(new.user_id), 'Client') || ' · ' || public.staff_push_amount(new.amount_xaf) || ' XAF · ' || coalesce(new.reference, ''),
      '/m/deposits/' || new.id,
      null,
      auth.uid()
    );
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_deposit: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists staff_push_on_deposit on public.deposits;
create trigger staff_push_on_deposit
  after insert or update of status on public.deposits
  for each row execute function public.staff_push_on_deposit();

-- Paiement : prêt à traiter, cash à remettre, cash scanné à confirmer.
create or replace function public.staff_push_on_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_method text := case new.method::text when 'alipay' then 'Alipay' when 'wechat' then 'WeChat Pay' when 'bank_transfer' then 'Virement' when 'cash' then 'Cash' else new.method::text end;
  v_amount text := public.staff_push_amount(new.amount_rmb) || ' ¥';
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status = 'ready_for_payment' and new.method::text <> 'cash' then
    perform public.send_staff_push('canProcessPayments', 'Paiement à traiter',
      coalesce(public.staff_push_client_name(new.user_id), 'Client') || ' · ' || v_amount || ' · ' || v_method || ' · ' || coalesce(new.reference, ''),
      '/m/payments/' || new.id, null, auth.uid());
  elsif new.status = 'cash_pending' then
    perform public.send_staff_push('canProcessPayments', 'Paiement cash à remettre',
      coalesce(nullif(trim(coalesce(new.cash_beneficiary_first_name, '') || ' ' || coalesce(new.cash_beneficiary_last_name, '')), ''), new.beneficiary_name, 'Bénéficiaire') || ' · ' || v_amount || ' · ' || coalesce(new.reference, ''),
      '/a/payment/' || new.id, array['cash_agent'], auth.uid());
  elsif new.status = 'cash_scanned' then
    perform public.send_staff_push('canProcessPayments', 'Paiement cash scanné',
      'À confirmer · ' || v_amount || ' · ' || coalesce(new.reference, ''),
      '/m/payments/' || new.id, array['super_admin', 'ops'], auth.uid());
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_payment: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists staff_push_on_payment on public.payments;
create trigger staff_push_on_payment
  after insert or update of status on public.payments
  for each row execute function public.staff_push_on_payment();

-- Support : un client écrit.
create or replace function public.staff_push_on_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if new.sender_type <> 'client' then
    return new;
  end if;
  select public.staff_push_client_name(c.user_id) into v_name
    from public.chat_conversations cv join public.clients c on c.id = cv.client_id
   where cv.id = new.conversation_id;
  perform public.send_staff_push('canAccessSupportChat', 'Message de ' || coalesce(v_name, 'un client'),
    case
      when nullif(trim(coalesce(new.content, '')), '') is not null then left(new.content, 140)
      when new.media_type like 'audio%' then 'Message vocal'
      when new.media_type like 'image%' then 'Photo'
      else 'Pièce jointe'
    end,
    '/m/support/' || new.conversation_id, null, null);
  return new;
exception when others then
  raise warning 'staff_push_on_chat_message: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists staff_push_on_chat_message on public.chat_messages;
create trigger staff_push_on_chat_message
  after insert on public.chat_messages
  for each row execute function public.staff_push_on_chat_message();

-- Douala : un vol est arrivé.
create or replace function public.staff_push_on_air_arrival()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if new.status = 'ARRIVED' and old.status is distinct from new.status then
    select count(*) into v_count from public.parcels where air_shipment_id = new.id;
    if v_count > 0 then
      perform public.send_staff_push('canReceiveAtDestination', 'Arrivée à Douala · avion',
        coalesce(nullif(new.flight_no, ''), new.awb_number, 'Vol') || ' · ' || v_count || ' colis à pointer',
        '/w/arrivees', null, auth.uid());
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_air_arrival: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists staff_push_on_air_arrival on public.air_shipments;
create trigger staff_push_on_air_arrival
  after update of status on public.air_shipments
  for each row execute function public.staff_push_on_air_arrival();

-- Douala : un conteneur de groupage est arrivé.
create or replace function public.staff_push_on_container_arrival()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if new.status = 'ARRIVED' and old.status is distinct from new.status then
    select count(*) into v_count from public.parcels where shipment_id = new.id;
    if v_count > 0 then
      perform public.send_staff_push('canReceiveAtDestination', 'Arrivée à Douala · conteneur',
        coalesce(new.container_number, new.bl_number, 'Conteneur') || ' · ' || v_count || ' colis à pointer',
        '/w/arrivees', null, auth.uid());
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_container_arrival: %', sqlerrm;
  return new;
end;
$$;
drop trigger if exists staff_push_on_container_arrival on public.cargo_shipments;
create trigger staff_push_on_container_arrival
  after update of status on public.cargo_shipments
  for each row execute function public.staff_push_on_container_arrival();

-- ============================================================================
-- BONZINI HQ — notifications par rôle, avec le choix de chacun (20/10/2026)
--
-- Jusqu'ici : six déclencheurs (dépôts, paiements, support, arrivées à
-- Douala, douane, vérifications des commerciaux) et quelques messages aux
-- commerciaux. La réception et les commerciaux ne recevaient presque rien, la
-- direction ne voyait pas sur son téléphone ce que la cloche du site montre
-- (conteneurs en retard ou qui arrivent), et personne ne pouvait couper un
-- type de notification.
--
--  1. staff_push_prefs : un interrupteur par personne et par TYPE (deposits,
--     payments, support, arrivals, customs, cargo, reception, sales,
--     sales_admin). Absent = activé. Lu par les RPC de l'écran « Moi ».
--  2. staff_push_log : « déjà envoyé » pour les rappels calculés (conteneur
--     en retard, objectif atteint, premier dépôt…), pour ne jamais répéter.
--  3. send_staff_push_k / send_staff_push_user_k : l'envoi, filtré par le
--     choix de chacun. send_staff_push et send_staff_push_user (appelés par
--     les déclencheurs existants) gardent leur signature et passent par eux :
--     le type se déduit de la permission visée, ou vaut « sales » pour un
--     message à un commercial.
--  4. Nouveaux événements :
--       · direction (canManageCargo) : conteneur en retard, conteneur qui
--         arrive sous 7 jours — mêmes règles que la cloche (alertLevel) ;
--       · réception (receptionist) : chaque matin, les colis prêts à
--         emballer ; chaque fin de journée, les dépôts restés sans client ;
--       · commercial : son prospect devient client, premier dépôt validé et
--         premier paiement effectué d'un de ses clients, objectif du mois
--         atteint.
--  5. pg_cron : conteneurs (heures ouvrées à Douala), objectifs (toutes les
--     heures), réception (10 h et 17 h 30 à Guangzhou).
--
-- Une notification ratée ne fait JAMAIS échouer l'opération métier. Toutes
-- les fonctions d'envoi sont internes (aucun EXECUTE pour les clients).
-- Idempotente, sans DROP (create or replace trigger).
-- ============================================================================

-- 1. Les choix de chacun ------------------------------------------------------
create table if not exists public.staff_push_prefs (
  user_id uuid not null,
  kind text not null check (kind ~ '^[a-z_]{2,30}$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.staff_push_prefs enable row level security;
-- Aucune politique : lecture et écriture par les RPC ci-dessous seulement.

-- 2. Déjà envoyé -------------------------------------------------------------
create table if not exists public.staff_push_log (
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref)
);
alter table public.staff_push_log enable row level security;

-- Vrai la première fois seulement pour (kind, ref).
create or replace function public._staff_push_once(p_kind text, p_ref text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  insert into public.staff_push_log (kind, ref) values (p_kind, p_ref) on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Le type d'une notification d'après la permission visée (déclencheurs existants).
create or replace function public._staff_push_kind(p_permission text)
returns text
language sql
immutable
as $$
  select case p_permission
    when 'canProcessDeposits' then 'deposits'
    when 'canProcessPayments' then 'payments'
    when 'canAccessSupportChat' then 'support'
    when 'canReceiveAtDestination' then 'arrivals'
    when 'canSignCustoms' then 'customs'
    when 'canManageSales' then 'sales_admin'
    when 'canManageCargo' then 'cargo'
    when 'canReceiveParcels' then 'reception'
    else 'other'
  end
$$;

-- La personne veut-elle ce type ? (rien d'enregistré = oui)
create or replace function public.staff_push_wants(p_user_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.enabled from public.staff_push_prefs p where p.user_id = p_user_id and p.kind = p_kind), true)
$$;

-- 3. Envoyer -----------------------------------------------------------------
create or replace function public.send_staff_push_k(
  p_kind text,
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
           'data', jsonb_build_object('path', p_path, 'kind', p_kind),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default'))
    into v_msgs
    from public.staff_push_devices d
    join public.user_roles r
      on r.user_id = d.user_id and (r.is_disabled = false or r.is_disabled is null)
   where (p_permission is null or public.admin_has_permission(d.user_id, p_permission))
     and (p_roles is null or r.role::text = any (p_roles))
     and (p_exclude is null or d.user_id <> p_exclude)
     and public.staff_push_wants(d.user_id, p_kind);
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
  raise warning 'send_staff_push_k: %', sqlerrm;
  return 0;
end;
$$;

create or replace function public.send_staff_push_user_k(
  p_kind text,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_path text
) returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_msgs jsonb;
begin
  if p_user_id is null or not public.staff_push_wants(p_user_id, p_kind) then
    return 0;
  end if;
  select jsonb_agg(jsonb_build_object(
           'to', d.expo_token,
           'title', p_title,
           'body', p_body,
           'data', jsonb_build_object('path', p_path, 'kind', p_kind),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default'))
    into v_msgs
    from public.staff_push_devices d
   where d.user_id = p_user_id
     and exists (select 1 from public.user_roles r
                  where r.user_id = d.user_id and (r.is_disabled = false or r.is_disabled is null));
  if v_msgs is null then
    return 0;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_msgs,
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  return jsonb_array_length(v_msgs);
exception when others then
  raise warning 'send_staff_push_user_k: %', sqlerrm;
  return 0;
end;
$$;

-- Les déclencheurs existants passent désormais par le filtre.
create or replace function public.send_staff_push(
  p_permission text,
  p_title text,
  p_body text,
  p_path text,
  p_roles text[] default null,
  p_exclude uuid default null
) returns integer
language sql
security definer
set search_path = public
as $$
  select public.send_staff_push_k(public._staff_push_kind(p_permission), p_permission, p_title, p_body, p_path, p_roles, p_exclude)
$$;

-- Tous les appels existants visent un commercial (prospects, clients attribués).
create or replace function public.send_staff_push_user(p_user_id uuid, p_title text, p_body text, p_path text)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.send_staff_push_user_k('sales', p_user_id, p_title, p_body, p_path)
$$;

-- 4. L'écran « Moi » ------------------------------------------------------------
-- Les types qui concernent la personne connectée, avec son choix.
create or replace function public.staff_push_prefs_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  select r.role::text into v_role from public.user_roles r
   where r.user_id = v_uid and (r.is_disabled = false or r.is_disabled is null);
  if v_role is null then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  return jsonb_build_object('success', true, 'kinds', coalesce((
    select jsonb_agg(jsonb_build_object('kind', k.kind, 'label', k.label, 'hint', k.hint,
                                        'enabled', public.staff_push_wants(v_uid, k.kind)) order by k.ord)
      from (values
        (1, 'deposits', 'Dépôts à valider', 'Un client a envoyé la preuve de son dépôt', public.admin_has_permission(v_uid, 'canProcessDeposits')),
        (2, 'payments', 'Paiements à traiter', 'Paiements prêts, cash à remettre ou à confirmer', public.admin_has_permission(v_uid, 'canProcessPayments')),
        (3, 'support', 'Messages des clients', 'Un client écrit au support', public.admin_has_permission(v_uid, 'canAccessSupportChat')),
        (4, 'cargo', 'Conteneurs', 'En retard, ou qui arrivent sous 7 jours', public.admin_has_permission(v_uid, 'canManageCargo')),
        (5, 'arrivals', 'Arrivées à Douala', 'Un vol ou un conteneur est arrivé : colis à pointer', public.admin_has_permission(v_uid, 'canReceiveAtDestination')),
        (6, 'reception', 'Rappels de la réception', 'Colis à emballer le matin, dépôts sans client le soir', v_role = 'receptionist'),
        (7, 'customs', 'Douane', 'Dossiers à signer', public.admin_has_permission(v_uid, 'canSignCustoms')),
        (8, 'sales', 'Mes prospects et mes clients', 'Prospect devenu client, premier dépôt ou paiement, objectif atteint', v_role = 'commercial'),
        (9, 'sales_admin', 'Vérifications des commerciaux', 'Un commercial a saisi le numéro d’un client Bonzini', public.admin_has_permission(v_uid, 'canManageSales'))
      ) as k(ord, kind, label, hint, relevant)
     where k.relevant), '[]'::jsonb));
end;
$$;

create or replace function public.staff_push_set_pref(p_kind text, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not exists (select 1 from public.user_roles r
                  where r.user_id = v_uid and (r.is_disabled = false or r.is_disabled is null)) then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  if p_kind is null or p_kind not in ('deposits','payments','support','cargo','arrivals','reception','customs','sales','sales_admin') then
    return jsonb_build_object('success', false, 'error', 'Type de notification inconnu');
  end if;
  if p_enabled is null then
    return jsonb_build_object('success', false, 'error', 'Choix manquant');
  end if;
  insert into public.staff_push_prefs (user_id, kind, enabled, updated_at)
  values (v_uid, p_kind, p_enabled, now())
  on conflict (user_id, kind) do update set enabled = excluded.enabled, updated_at = now();
  return jsonb_build_object('success', true, 'kind', p_kind, 'enabled', p_enabled);
end;
$$;

-- 5. Commerciaux : événements de leurs clients ----------------------------------
-- Le compte du commercial qui a apporté ce client (NULL sinon).
create or replace function public._client_commercial_user(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.staff_user_id
    from public.clients c
    join public.client_sources s on s.id = c.source_id
   where c.user_id = p_user_id and s.kind = 'commercial' and s.staff_user_id is not null
$$;

-- Son prospect devient client (création du compte avec son numéro, ou statut
-- passé à la main par quelqu'un d'autre). Une vérification de la direction
-- (« to_verify ») envoie déjà « Client attribué » : non répétée ici.
create or replace function public.staff_push_on_prospect_won()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
begin
  if new.status = 'won' and old.status in ('new', 'contacted', 'interested') then
    select staff_user_id into v_staff from public.client_sources where id = new.source_id;
    if v_staff is not null and v_staff is distinct from auth.uid()
       and public._staff_push_once('sales', 'won:' || new.id) then
      perform public.send_staff_push_user_k('sales', v_staff, 'Prospect devenu client',
        btrim(new.first_name || ' ' || coalesce(new.last_name, '')) || ' a maintenant son compte Bonzini',
        '/v/prospects/' || new.id);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_prospect_won: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger staff_push_on_prospect_won
  after update of status on public.prospects
  for each row execute function public.staff_push_on_prospect_won();

-- Premier dépôt validé d'un de ses clients.
create or replace function public.staff_push_commercial_on_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
begin
  if new.status = 'validated' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    v_staff := public._client_commercial_user(new.user_id);
    if v_staff is not null
       and not exists (select 1 from public.deposits d
                        where d.user_id = new.user_id and d.status = 'validated' and d.id <> new.id)
       and public._staff_push_once('sales', 'first_deposit:' || new.user_id) then
      perform public.send_staff_push_user_k('sales', v_staff, 'Premier dépôt de votre client',
        coalesce(public.staff_push_client_name(new.user_id), 'Votre client') || ' · '
          || public.staff_push_amount(coalesce(new.confirmed_amount_xaf, new.amount_xaf)) || ' XAF',
        '/v/clients');
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_commercial_on_deposit: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger staff_push_commercial_on_deposit
  after insert or update of status on public.deposits
  for each row execute function public.staff_push_commercial_on_deposit();

-- Premier paiement effectué d'un de ses clients.
create or replace function public.staff_push_commercial_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid;
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    v_staff := public._client_commercial_user(new.user_id);
    if v_staff is not null
       and not exists (select 1 from public.payments p
                        where p.user_id = new.user_id and p.status = 'completed' and p.id <> new.id)
       and public._staff_push_once('sales', 'first_payment:' || new.user_id) then
      perform public.send_staff_push_user_k('sales', v_staff, 'Premier paiement de votre client',
        coalesce(public.staff_push_client_name(new.user_id), 'Votre client') || ' · '
          || public.staff_push_amount(new.amount_xaf) || ' XAF payés à son fournisseur',
        '/v/clients');
    end if;
  end if;
  return new;
exception when others then
  raise warning 'staff_push_commercial_on_payment: %', sqlerrm;
  return new;
end;
$$;

create or replace trigger staff_push_commercial_on_payment
  after insert or update of status on public.payments
  for each row execute function public.staff_push_commercial_on_payment();

-- Objectifs du mois atteints (cron horaire). Un objectif relevé par la
-- direction (nouvelle cible) peut être de nouveau célébré.
create or replace function public.run_staff_push_objectives()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m record;
  r record;
  v_sent integer := 0;
begin
  select * into v_m from public._sales_month(null);
  for r in
    select o.id, o.metric, o.target, s.staff_user_id,
           case o.metric
             when 'new_clients'   then m.new_clients::numeric
             when 'payments_xaf'  then m.payments_xaf::numeric
             when 'air_kg'        then m.air_kg
             when 'sea_cbm'       then m.sea_cbm
             when 'prospects_new' then m.prospects_new::numeric
             when 'prospects_won' then m.prospects_won::numeric
           end as actual
      from public.commercial_objectives o
      join public.client_sources s on s.id = o.source_id and s.staff_user_id is not null
      cross join lateral public._commercial_metrics(array[o.source_id], v_m.from_at, v_m.to_at) m
     where o.month = v_m.month
  loop
    if r.actual >= r.target and public._staff_push_once('sales', 'goal:' || r.id || ':' || r.target) then
      v_sent := v_sent + public.send_staff_push_user_k('sales', r.staff_user_id, 'Objectif du mois atteint 🎉',
        case r.metric
          when 'new_clients'   then 'Nouveaux clients : ' || r.actual::int || ' / ' || r.target::int
          when 'payments_xaf'  then 'Paiements de vos clients : ' || public.staff_push_amount(r.target) || ' XAF atteints'
          when 'air_kg'        then 'Fret avion : ' || round(r.target) || ' kg atteints'
          when 'sea_cbm'       then 'Fret bateau : ' || round(r.target, 1) || ' m³ atteints'
          when 'prospects_new' then 'Prospects ajoutés : ' || r.actual::int || ' / ' || r.target::int
          when 'prospects_won' then 'Prospects devenus clients : ' || r.actual::int || ' / ' || r.target::int
          else 'Bravo !'
        end,
        '/v');
    end if;
  end loop;
  return v_sent;
exception when others then
  raise warning 'run_staff_push_objectives: %', sqlerrm;
  return v_sent;
end;
$$;

-- 6. Direction : conteneurs (mêmes règles que la cloche du site) -----------------
--   en retard : franchise dépassée au port, glissement ≥ 7 jours, ou arrivée
--   sous 3 jours sans télex ; arrive bientôt : arrivée sous 7 jours.
-- Une seule fois par conteneur et par état. Plusieurs d'un coup : un résumé.
create or replace function public.run_staff_push_cargo()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Africa/Douala')::date;
  v_late jsonb := '[]'::jsonb;
  v_soon jsonb := '[]'::jsonb;
  r record;
  v_sent integer := 0;
begin
  for r in
    select s.id, coalesce(nullif(s.client_label, ''), 'Client') as client,
           coalesce(nullif(s.container_number, ''), nullif(s.bl_number, ''), 'Conteneur') as box,
           x.eta_d - v_today as days,
           (   (s.free_time_ends_on is not null and s.gate_out_at is null and s.free_time_ends_on < v_today)
            or (x.real_d is not null and s.eta_promised is not null and x.real_d - s.eta_promised >= 7)
            or (x.eta_d is not null and x.eta_d - v_today <= 3 and not coalesce(s.telex_released, false) and s.status <> 'UNKNOWN')
           ) as late
      from public.cargo_shipments s
      cross join lateral (select (coalesce(s.eta_manual, s.eta_carrier) at time zone 'Africa/Douala')::date as real_d) r0
      cross join lateral (select coalesce(r0.real_d, s.eta_promised) as eta_d, r0.real_d) x
     where s.status <> 'DELIVERED'
  loop
    if r.late then
      if public._staff_push_once('cargo', 'late:' || r.id) then
        v_late := v_late || jsonb_build_object('id', r.id, 'client', r.client, 'box', r.box);
      end if;
    elsif r.days between 0 and 7 then
      if public._staff_push_once('cargo', 'soon:' || r.id) then
        v_soon := v_soon || jsonb_build_object('id', r.id, 'client', r.client, 'box', r.box, 'days', r.days);
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_late) = 1 then
    v_sent := v_sent + public.send_staff_push_k('cargo', 'canManageCargo', 'Conteneur en retard',
      (v_late -> 0 ->> 'client') || ' · ' || (v_late -> 0 ->> 'box'), '/m/cargo/' || (v_late -> 0 ->> 'id'));
  elsif jsonb_array_length(v_late) > 1 then
    v_sent := v_sent + public.send_staff_push_k('cargo', 'canManageCargo',
      jsonb_array_length(v_late) || ' conteneurs en retard',
      (select string_agg(e ->> 'client', ' · ') from jsonb_array_elements(v_late) e), '/m/cargo');
  end if;

  if jsonb_array_length(v_soon) = 1 then
    v_sent := v_sent + public.send_staff_push_k('cargo', 'canManageCargo', 'Conteneur bientôt à Douala',
      (v_soon -> 0 ->> 'client') || ' · ' || (v_soon -> 0 ->> 'box') || ' · '
        || case (v_soon -> 0 ->> 'days')::int when 0 then 'arrive aujourd’hui' when 1 then 'arrive demain'
           else 'dans ' || (v_soon -> 0 ->> 'days') || ' jours' end
        || ' : fret, télex et BESC à régler',
      '/m/cargo/' || (v_soon -> 0 ->> 'id'));
  elsif jsonb_array_length(v_soon) > 1 then
    v_sent := v_sent + public.send_staff_push_k('cargo', 'canManageCargo',
      jsonb_array_length(v_soon) || ' conteneurs arrivent sous 7 jours',
      (select string_agg(e ->> 'client', ' · ') from jsonb_array_elements(v_soon) e), '/m/cargo');
  end if;
  return v_sent;
exception when others then
  raise warning 'run_staff_push_cargo: %', sqlerrm;
  return v_sent;
end;
$$;

-- 7. Réception : rappels du jour -------------------------------------------------
--   'pack'       (matin) : colis avion prêts à emballer au bureau ;
--   'unassigned' (soir)  : dépôts encore sans client.
create or replace function public.run_staff_push_reception(p_what text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day text := to_char((now() at time zone 'Asia/Shanghai')::date, 'YYYY-MM-DD');
  v_n integer;
begin
  if p_what = 'pack' then
    select count(*) into v_n
      from public.parcels p join public.parcel_deposits d on d.id = p.deposit_id
     where d.location = 'office' and d.status not in ('open', 'cancelled') and d.client_user_id is not null
       and p.air_package_id is null and p.shipment_id is null and p.air_shipment_id is null
       and p.status in ('received', 'stored') and p.checked_in_at is null and p.delivered_at is null
       and p.weight_kg > 0 and p.weight_kg <= 32;
    if v_n > 0 and public._staff_push_once('reception', 'pack:' || v_day) then
      return public.send_staff_push_k('reception', 'canReceiveParcels',
        case when v_n = 1 then '1 colis à emballer' else v_n || ' colis à emballer' end,
        'Colis avion prêts : à mettre en paquets aujourd’hui', '/r/paquets/emballer', array['receptionist']);
    end if;
  elsif p_what = 'unassigned' then
    select count(*) into v_n from public.parcel_deposits d
     where d.client_user_id is null and d.status <> 'cancelled';
    if v_n > 0 and public._staff_push_once('reception', 'unassigned:' || v_day) then
      return public.send_staff_push_k('reception', 'canReceiveParcels',
        case when v_n = 1 then '1 dépôt sans client' else v_n || ' dépôts sans client' end,
        'À rattacher à leur client avant demain', '/r/pending', array['receptionist']);
    end if;
  end if;
  return 0;
exception when others then
  raise warning 'run_staff_push_reception: %', sqlerrm;
  return 0;
end;
$$;

-- 8. Droits : tout l'envoi est interne ; seul l'écran « Moi » est appelable --------
revoke execute on function public._staff_push_once(text, text) from public, anon, authenticated;
revoke execute on function public._staff_push_kind(text) from public, anon, authenticated;
revoke execute on function public.staff_push_wants(uuid, text) from public, anon, authenticated;
revoke execute on function public.send_staff_push_k(text, text, text, text, text, text[], uuid) from public, anon, authenticated;
revoke execute on function public.send_staff_push_user_k(text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.send_staff_push(text, text, text, text, text[], uuid) from public, anon, authenticated;
revoke execute on function public.send_staff_push_user(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public._client_commercial_user(uuid) from public, anon, authenticated;
revoke execute on function public.staff_push_on_prospect_won() from public, anon, authenticated;
revoke execute on function public.staff_push_commercial_on_deposit() from public, anon, authenticated;
revoke execute on function public.staff_push_commercial_on_payment() from public, anon, authenticated;
revoke execute on function public.run_staff_push_objectives() from public, anon, authenticated;
revoke execute on function public.run_staff_push_cargo() from public, anon, authenticated;
revoke execute on function public.run_staff_push_reception(text) from public, anon, authenticated;
revoke execute on function public.staff_push_prefs_get() from public, anon;
revoke execute on function public.staff_push_set_pref(text, boolean) from public, anon;
grant execute on function public.staff_push_prefs_get() to authenticated;
grant execute on function public.staff_push_set_pref(text, boolean) to authenticated;

-- 9. Étiquettes Mola --------------------------------------------------------------
comment on function public._staff_push_once(text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":false,"danger":false,"label":"Noter qu''une notification calculée a été envoyée (interne)"}';
comment on function public._staff_push_kind(text) is
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","confirm":false,"danger":false,"label":"Type d''une notification d''après sa permission (interne)"}';
comment on function public.staff_push_wants(uuid, text) is
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","confirm":false,"danger":false,"label":"Une personne veut-elle ce type de notification (interne)"}';
comment on function public.send_staff_push_k(text, text, text, text, text, text[], uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push au personnel, selon le choix de chacun (interne)"}';
comment on function public.send_staff_push_user_k(text, uuid, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push à une personne du personnel (interne)"}';
comment on function public.send_staff_push(text, text, text, text, text[], uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push au personnel (interne)"}';
comment on function public.send_staff_push_user(uuid, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push à un commercial (interne)"}';
comment on function public._client_commercial_user(uuid) is
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","confirm":false,"danger":false,"label":"Le commercial qui a apporté un client (interne)"}';
comment on function public.staff_push_on_prospect_won() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageSales","confirm":false,"danger":false,"label":"Prévenir le commercial quand son prospect devient client (déclencheur)"}';
comment on function public.staff_push_commercial_on_deposit() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageSales","confirm":false,"danger":false,"label":"Prévenir le commercial du premier dépôt de son client (déclencheur)"}';
comment on function public.staff_push_commercial_on_payment() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageSales","confirm":false,"danger":false,"label":"Prévenir le commercial du premier paiement de son client (déclencheur)"}';
comment on function public.run_staff_push_objectives() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageSales","confirm":false,"danger":false,"label":"Prévenir les commerciaux de leurs objectifs atteints (tâche planifiée)"}';
comment on function public.run_staff_push_cargo() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageCargo","confirm":false,"danger":false,"label":"Prévenir la direction des conteneurs en retard ou qui arrivent (tâche planifiée)"}';
comment on function public.run_staff_push_reception(text) is
  '@mola:{"expose":false,"kind":"write","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Rappels du jour à la réception : colis à emballer, dépôts sans client (tâche planifiée)"}';
comment on function public.staff_push_prefs_get() is
  '@mola:{"expose":false,"kind":"read","permission":"canViewLogs","confirm":false,"danger":false,"label":"Mes types de notifications sur l''app BONZINI HQ (réglage personnel du téléphone)"}';
comment on function public.staff_push_set_pref(text, boolean) is
  '@mola:{"expose":false,"kind":"write","permission":"canViewLogs","confirm":false,"danger":false,"label":"Activer ou couper un type de notification pour moi sur l''app BONZINI HQ (réglage personnel)"}';

-- 10. Planification ----------------------------------------------------------------
-- Conteneurs : toutes les heures de 8 h à 20 h à Douala (UTC+1).
select cron.schedule('staff-push-cargo', '25 7-19 * * *', $c$ select public.run_staff_push_cargo(); $c$);
-- Objectifs : toutes les heures.
select cron.schedule('staff-push-objectives', '41 * * * *', $c$ select public.run_staff_push_objectives(); $c$);
-- Réception (Guangzhou, UTC+8) : 10 h les colis à emballer, 17 h 30 les dépôts sans client.
select cron.schedule('staff-push-reception-pack', '0 2 * * *', $c$ select public.run_staff_push_reception('pack'); $c$);
select cron.schedule('staff-push-reception-unassigned', '30 9 * * *', $c$ select public.run_staff_push_reception('unassigned'); $c$);

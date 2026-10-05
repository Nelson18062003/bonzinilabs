-- ============================================================
-- SOURCES DES CLIENTS — d'où vient chaque client (commercial, recommandation,
-- réseaux sociaux, en ligne, événement, autre), pour suivre l'activité des
-- commerciaux et préparer leurs commissions.
--
--   · client_sources : les sources RÉUTILISABLES (un commercial s'enregistre
--     une fois, puis se choisit pour chaque client qu'il apporte) ;
--   · clients.source_id : l'origine d'un client ;
--   · VERROU : l'origine ne change QUE par les RPC ci-dessous. Sans lui, un
--     client (« Users can update own client profile ») ou n'importe quel
--     membre du staff (« Admins can update all clients ») pouvait réécrire
--     l'attribution — donc les commissions — par un simple UPDATE PostgREST.
--   · rapport : clients apportés, dépôts validés, paiements terminés, colis
--     déposés (nombre, kg, m³), par source et sur une période.
--
-- Idempotente, sans aucun DROP. Rien n'est supprimé. Appliquée en production
-- le 05/10/2026 (via l'exécution SQL du connecteur, en quatre morceaux).
-- ============================================================

-- ── 1. Table des sources ────────────────────────────────────────────────
create table if not exists public.client_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('commercial', 'referral', 'social', 'online', 'event', 'other', 'unknown')),
  label text not null check (length(btrim(label)) between 2 and 80),
  phone text check (phone is null or length(phone) <= 32),
  notes text check (notes is null or length(notes) <= 500),
  is_active boolean not null default true,
  -- « Je ne sais pas » : ni modifiable ni archivable.
  is_system boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_sources_kind_label_key
  on public.client_sources (kind, lower(btrim(label)));

alter table public.client_sources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'client_sources' and policyname = 'Staff can read client sources') then
    create policy "Staff can read client sources" on public.client_sources
      for select to authenticated using (public.is_admin(auth.uid()));
  end if;
end $$;
-- Aucune politique d'écriture : tout passe par les RPC SECURITY DEFINER.

-- ── 2. L'origine d'un client ────────────────────────────────────────────
alter table public.clients add column if not exists source_id uuid references public.client_sources(id) on delete restrict;
alter table public.clients add column if not exists source_set_at timestamptz;
alter table public.clients add column if not exists source_set_by uuid;
create index if not exists clients_source_id_idx on public.clients (source_id);

-- ── 3. Le verrou ────────────────────────────────────────────────────────
-- Hors des RPC (qui posent `bonzini.client_source_write` pour LEUR
-- transaction), toute écriture de l'origine est ignorée : à l'insertion elle
-- est vidée, à la mise à jour l'ancienne valeur est gardée. On ignore plutôt
-- que de lever une erreur : une mise à jour de profil qui renvoie la ligne
-- entière ne doit pas échouer pour autant.
create or replace function public.guard_client_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('bonzini.client_source_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.source_id := null;
    new.source_set_at := null;
    new.source_set_by := null;
  else
    new.source_id := old.source_id;
    new.source_set_at := old.source_set_at;
    new.source_set_by := old.source_set_by;
  end if;
  return new;
end;
$$;

create or replace trigger clients_guard_source
  before insert or update on public.clients
  for each row execute function public.guard_client_source();

-- ── 4. Sources de départ ────────────────────────────────────────────────
insert into public.client_sources (kind, label, is_system)
values ('unknown', 'Je ne sais pas', true)
on conflict (kind, lower(btrim(label))) do nothing;

insert into public.client_sources (kind, label)
values
  ('social', 'Facebook'),
  ('social', 'TikTok'),
  ('social', 'WhatsApp'),
  ('social', 'Instagram'),
  ('online', 'Site Bonzini'),
  ('online', 'Google'),
  ('online', 'ChatGPT')
on conflict (kind, lower(btrim(label))) do nothing;

-- Les inscriptions venues avec un lien suivi (utm_source) : reprises telles
-- quelles, seulement là où l'origine est vide.
do $$
begin
  perform set_config('bonzini.client_source_write', 'on', true);
  update public.clients c
     set source_id = s.id, source_set_at = coalesce(c.created_at, now())
    from public.client_sources s
   where c.source_id is null
     and ((lower(c.utm_source) like '%chatgpt%' and s.kind = 'online' and s.label = 'ChatGPT')
       or (lower(c.utm_source) in ('fb', 'facebook') and s.kind = 'social' and s.label = 'Facebook'));
  perform set_config('bonzini.client_source_write', '', true);
end $$;

-- ── 5. Créer une source ─────────────────────────────────────────────────
-- Tous ceux qui enregistrent des clients (admins, réception) : on ajoute le
-- nouveau commercial au moment où il apporte son premier client. Un doublon
-- (même catégorie, même nom) renvoie la source existante.
create or replace function public.create_client_source(
  p_kind text,
  p_label text,
  p_phone text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text := btrim(coalesce(p_label, ''));
  v_existing public.client_sources;
  v_id uuid;
begin
  if not (public.admin_has_permission(v_uid, 'canRegisterClients') or public.admin_has_permission(v_uid, 'canEditClients')) then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  if p_kind is null or p_kind not in ('commercial', 'referral', 'social', 'online', 'event', 'other') then
    return jsonb_build_object('success', false, 'error', 'Catégorie inconnue');
  end if;
  if length(v_label) < 2 or length(v_label) > 80 then
    return jsonb_build_object('success', false, 'error', 'Le nom doit faire entre 2 et 80 caractères');
  end if;

  select * into v_existing from public.client_sources
   where kind = p_kind and lower(btrim(label)) = lower(v_label);
  if found then
    if not v_existing.is_active then
      return jsonb_build_object('success', false, 'error', 'Cette source existe mais est archivée. Réactivez-la depuis l''écran Sources.');
    end if;
    return jsonb_build_object('success', true, 'id', v_existing.id, 'existing', true);
  end if;

  insert into public.client_sources (kind, label, phone, notes, created_by)
  values (p_kind, v_label, nullif(btrim(coalesce(p_phone, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''), v_uid)
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'existing', false);
end;
$$;

comment on function public.create_client_source(text, text, text, text) is
  '@mola:{"expose":true,"kind":"write","permission":"canRegisterClients","confirm":true,"danger":false,"label":"Ajouter une source de clients (commercial, recommandation, réseau social, en ligne, événement, autre)"}';

-- ── 6. Modifier / archiver une source ───────────────────────────────────
create or replace function public.update_client_source(
  p_id uuid,
  p_label text default null,
  p_phone text default null,
  p_notes text default null,
  p_is_active boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src public.client_sources;
  v_label text;
begin
  if not public.admin_has_permission(auth.uid(), 'canEditClients') then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  select * into v_src from public.client_sources where id = p_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Source introuvable');
  end if;
  if v_src.is_system then
    return jsonb_build_object('success', false, 'error', 'Cette source ne se modifie pas');
  end if;
  v_label := coalesce(nullif(btrim(coalesce(p_label, '')), ''), v_src.label);
  if length(v_label) < 2 or length(v_label) > 80 then
    return jsonb_build_object('success', false, 'error', 'Le nom doit faire entre 2 et 80 caractères');
  end if;
  if exists (select 1 from public.client_sources where kind = v_src.kind and lower(btrim(label)) = lower(v_label) and id <> p_id) then
    return jsonb_build_object('success', false, 'error', 'Une autre source porte déjà ce nom');
  end if;

  update public.client_sources
     set label = v_label,
         phone = case when p_phone is null then phone else nullif(btrim(p_phone), '') end,
         notes = case when p_notes is null then notes else nullif(btrim(p_notes), '') end,
         is_active = coalesce(p_is_active, is_active),
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('success', true);
end;
$$;

comment on function public.update_client_source(uuid, text, text, text, boolean) is
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Modifier ou archiver une source de clients"}';

-- ── 7. Poser l'origine d'un client ──────────────────────────────────────
-- Première attribution : quiconque enregistre des clients (juste après la
-- création). Changer une origine déjà posée : canEditClients seulement —
-- c'est ce qui décide à quel commercial revient un client.
create or replace function public.set_client_source(p_user_id uuid, p_source_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_client public.clients;
  v_src public.client_sources;
begin
  if not (public.admin_has_permission(v_uid, 'canRegisterClients') or public.admin_has_permission(v_uid, 'canEditClients')) then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  select * into v_client from public.clients where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Client introuvable');
  end if;
  if v_client.source_id is not null
     and v_client.source_id is distinct from p_source_id
     and not public.admin_has_permission(v_uid, 'canEditClients') then
    return jsonb_build_object('success', false, 'error', 'L''origine de ce client est déjà renseignée');
  end if;
  select * into v_src from public.client_sources where id = p_source_id;
  if not found or not v_src.is_active then
    return jsonb_build_object('success', false, 'error', 'Source introuvable ou archivée');
  end if;

  perform set_config('bonzini.client_source_write', 'on', true);
  update public.clients
     set source_id = p_source_id, source_set_at = now(), source_set_by = v_uid
   where user_id = p_user_id;
  perform set_config('bonzini.client_source_write', '', true);

  return jsonb_build_object('success', true);
end;
$$;

comment on function public.set_client_source(uuid, uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Renseigner ou changer l''origine d''un client (quel commercial ou canal l''a apporté)","resolve":{"p_user_id":"client"}}';

-- ── 8. Rapport par source ───────────────────────────────────────────────
-- Sur la période : dépôts VALIDÉS (date de validation), paiements TERMINÉS
-- (date de traitement), colis déposés (date d'enregistrement, dépôts non
-- annulés). « clients » compte tous les clients de la source ; « new_clients »
-- ceux créés dans la période ; « active_clients » ceux qui ont bougé.
create or replace function public.get_client_source_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.admin_has_permission(auth.uid(), 'canViewClients') then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;

  with dep as (
    select d.user_id, sum(coalesce(d.confirmed_amount_xaf, d.amount_xaf))::bigint amt, count(*)::int n
      from public.deposits d
     where d.status = 'validated' and d.validated_at >= p_from and d.validated_at <= p_to
     group by 1
  ), pay as (
    select p.user_id, sum(p.amount_xaf)::bigint amt, count(*)::int n
      from public.payments p
     where p.status = 'completed' and coalesce(p.processed_at, p.cash_paid_at, p.updated_at) between p_from and p_to
     group by 1
  ), par as (
    select pd.client_user_id user_id, count(pa.id)::int n, coalesce(sum(pa.weight_kg), 0) kg, coalesce(sum(pa.cbm), 0) cbm
      from public.parcels pa
      join public.parcel_deposits pd on pd.id = pa.deposit_id
     where pd.status <> 'cancelled' and pa.created_at between p_from and p_to
     group by 1
  ), agg as (
    select c.source_id,
           count(*)::int clients,
           count(*) filter (where c.created_at between p_from and p_to)::int new_clients,
           count(*) filter (where dep.user_id is not null or pay.user_id is not null or par.user_id is not null)::int active_clients,
           coalesce(sum(dep.amt), 0)::bigint deposits_xaf,
           coalesce(sum(dep.n), 0)::int deposits_count,
           coalesce(sum(pay.amt), 0)::bigint payments_xaf,
           coalesce(sum(pay.n), 0)::int payments_count,
           coalesce(sum(par.n), 0)::int parcels,
           coalesce(sum(par.kg), 0) parcels_kg,
           coalesce(sum(par.cbm), 0) parcels_cbm
      from public.clients c
      left join dep on dep.user_id = c.user_id
      left join pay on pay.user_id = c.user_id
      left join par on par.user_id = c.user_id
     group by c.source_id
  ), merged as (
    select s.id as sid, s.kind, s.label, s.phone, s.is_active, s.is_system,
           a.clients, a.new_clients, a.active_clients, a.deposits_xaf, a.deposits_count,
           a.payments_xaf, a.payments_count, a.parcels, a.parcels_kg, a.parcels_cbm
      from public.client_sources s
      left join agg a on a.source_id = s.id
    union all
    select null::uuid, 'none', 'Non renseigné', null, true, true,
           a.clients, a.new_clients, a.active_clients, a.deposits_xaf, a.deposits_count,
           a.payments_xaf, a.payments_count, a.parcels, a.parcels_kg, a.parcels_cbm
      from agg a where a.source_id is null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'source_id', m.sid, 'kind', m.kind, 'label', m.label, 'phone', m.phone,
           'is_active', m.is_active, 'is_system', m.is_system,
           'clients', coalesce(m.clients, 0), 'new_clients', coalesce(m.new_clients, 0),
           'active_clients', coalesce(m.active_clients, 0),
           'deposits_xaf', coalesce(m.deposits_xaf, 0), 'deposits_count', coalesce(m.deposits_count, 0),
           'payments_xaf', coalesce(m.payments_xaf, 0), 'payments_count', coalesce(m.payments_count, 0),
           'parcels', coalesce(m.parcels, 0), 'parcels_kg', coalesce(m.parcels_kg, 0), 'parcels_cbm', coalesce(m.parcels_cbm, 0)
         ) order by coalesce(m.clients, 0) desc, m.label), '[]'::jsonb)
    into v_rows
    from merged m;

  return jsonb_build_object('success', true, 'from', p_from, 'to', p_to, 'rows', v_rows);
end;
$$;

comment on function public.get_client_source_report(timestamptz, timestamptz) is
  '@mola:{"expose":true,"kind":"read","permission":"canViewClients","label":"Rapport des sources de clients et des commerciaux : clients apportés, dépôts validés, paiements terminés, colis déposés sur une période"}';

-- ── 9. Détail d'une source : ses clients, un par un ─────────────────────
-- p_source_id NULL = les clients sans origine renseignée.
create or replace function public.get_client_source_clients(p_source_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.admin_has_permission(auth.uid(), 'canViewClients') then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;

  with cl as (
    select c.user_id, c.first_name, c.last_name, c.company_name, c.customer_code, c.phone, c.created_at, c.source_set_at
      from public.clients c
     where (p_source_id is null and c.source_id is null) or c.source_id = p_source_id
  ), dep as (
    select d.user_id, sum(coalesce(d.confirmed_amount_xaf, d.amount_xaf))::bigint amt, count(*)::int n
      from public.deposits d join cl on cl.user_id = d.user_id
     where d.status = 'validated' and d.validated_at between p_from and p_to
     group by 1
  ), pay as (
    select p.user_id, sum(p.amount_xaf)::bigint amt, count(*)::int n
      from public.payments p join cl on cl.user_id = p.user_id
     where p.status = 'completed' and coalesce(p.processed_at, p.cash_paid_at, p.updated_at) between p_from and p_to
     group by 1
  ), par as (
    select pd.client_user_id user_id, count(pa.id)::int n, coalesce(sum(pa.weight_kg), 0) kg, coalesce(sum(pa.cbm), 0) cbm
      from public.parcels pa
      join public.parcel_deposits pd on pd.id = pa.deposit_id
      join cl on cl.user_id = pd.client_user_id
     where pd.status <> 'cancelled' and pa.created_at between p_from and p_to
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', cl.user_id,
           'name', btrim(coalesce(cl.first_name, '') || ' ' || coalesce(cl.last_name, '')),
           'company', cl.company_name, 'customer_code', cl.customer_code, 'phone', cl.phone,
           'created_at', cl.created_at, 'source_set_at', cl.source_set_at,
           'deposits_xaf', coalesce(dep.amt, 0), 'deposits_count', coalesce(dep.n, 0),
           'payments_xaf', coalesce(pay.amt, 0), 'payments_count', coalesce(pay.n, 0),
           'parcels', coalesce(par.n, 0), 'parcels_kg', coalesce(par.kg, 0), 'parcels_cbm', coalesce(par.cbm, 0)
         ) order by coalesce(dep.amt, 0) + coalesce(pay.amt, 0) desc, cl.created_at desc), '[]'::jsonb)
    into v_rows
    from cl
    left join dep on dep.user_id = cl.user_id
    left join pay on pay.user_id = cl.user_id
    left join par on par.user_id = cl.user_id;

  return jsonb_build_object('success', true, 'rows', v_rows);
end;
$$;

comment on function public.get_client_source_clients(uuid, timestamptz, timestamptz) is
  '@mola:{"expose":true,"kind":"read","permission":"canViewClients","label":"Clients apportés par une source (un commercial par exemple), avec leurs dépôts, paiements et colis sur une période"}';

-- Le garde-fou interne n'est pas une action.
comment on function public.guard_client_source() is
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","label":"Verrou interne : l''origine d''un client ne change que par set_client_source"}';


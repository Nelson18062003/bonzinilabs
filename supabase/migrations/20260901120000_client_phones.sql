-- ============================================================
-- Plusieurs numéros WhatsApp par client.
--
-- CONSTAT
-- `clients` ne porte qu'UN numéro (`phone`, `phone_e164`, `phone_country`).
-- Or un importateur a couramment plusieurs lignes — MTN et Orange, un
-- numéro personnel et un numéro d'entreprise, une ligne chinoise pendant
-- ses déplacements. Aujourd'hui l'opérateur doit en choisir un et perdre
-- les autres, ou les entasser dans le champ « notes » où rien ne peut les
-- retrouver.
--
-- CHOIX DE MODÉLISATION
-- Une table fille plutôt qu'une colonne `text[]` ou un `jsonb` : chaque
-- numéro porte son pays, son libellé et son rang, on veut une contrainte
-- d'unicité par client, et on veut pouvoir chercher un client PAR son
-- numéro — trois choses qu'un tableau dans une colonne rend pénibles.
--
-- `clients.phone*` N'EST PAS SUPPRIMÉ. Ces colonnes restent la référence du
-- numéro PRINCIPAL, celui qui reçoit le mot de passe temporaire, et sont
-- lues par le reste de l'application (connexion, envois SMS/WhatsApp,
-- recherche). La RPC ci-dessous les tient synchronisées avec le numéro
-- marqué principal : une seule vérité, deux endroits où la lire.
--
-- ÉCRITURES : aucune politique INSERT/UPDATE/DELETE n'est posée. Les
-- écritures passent exclusivement par `admin_set_client_phones`, gardée par
-- `admin_has_permission(..., 'canManageUsers')` — la règle du projet : une
-- RPC SECURITY DEFINER sans garde n'est pas protégée par l'UI.
--
-- Migration idempotente : rejouable sans effet de bord.
-- ============================================================

create table if not exists public.client_phones (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  -- Toujours stocké en E.164 : c'est le seul format sans ambiguïté, et le
  -- seul que les passerelles WhatsApp/SMS acceptent sans réinterpréter.
  phone_e164   text not null,
  -- Code ISO 3166-1 alpha-2 du pays du numéro (CM, CN, FR…), pour pouvoir
  -- réafficher le numéro au format national sans le redeviner.
  country_iso  text,
  -- Libellé libre et court : « MTN », « Bureau Douala », « Chine ».
  label        text,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Forme E.164 : un « + », un premier chiffre non nul, puis 6 à 14
  -- chiffres. Empêche d'enregistrer « 6 99 00 00 00 » ou « 00237… », qui
  -- partiraient en échec silencieux à l'envoi.
  constraint client_phones_e164_format check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  constraint client_phones_label_len check (label is null or char_length(label) <= 40),
  constraint client_phones_country_iso check (country_iso is null or country_iso ~ '^[A-Z]{2}$'),
  -- Le même numéro deux fois chez le même client n'a pas de sens.
  constraint client_phones_unique_per_client unique (client_id, phone_e164)
);

-- Un seul numéro principal par client — garanti par la base, pas par l'UI.
create unique index if not exists client_phones_one_primary
  on public.client_phones (client_id)
  where is_primary;

-- Retrouver un client à partir d'un numéro (recherche, rapprochement d'un
-- message WhatsApp entrant).
create index if not exists client_phones_by_number
  on public.client_phones (phone_e164);

create index if not exists client_phones_by_client
  on public.client_phones (client_id);

comment on table public.client_phones is
  'Numéros WhatsApp/téléphone d''un client. Le numéro is_primary est celui recopié dans clients.phone_e164 et qui reçoit le mot de passe.';

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.client_phones enable row level security;

drop policy if exists client_phones_select_own on public.client_phones;
create policy client_phones_select_own
  on public.client_phones for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_phones.client_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists client_phones_select_staff on public.client_phones;
create policy client_phones_select_staff
  on public.client_phones for select
  using (public.admin_has_permission(auth.uid(), 'canViewClients'));

-- Aucune politique d'écriture : tout passe par la RPC ci-dessous.

-- ── Reprise de l'existant ────────────────────────────────────────────
-- Chaque client qui a déjà un numéro obtient sa ligne principale, sinon la
-- fiche paraîtrait vide juste après la migration alors que le numéro est
-- bien là. `on conflict do nothing` rend l'opération rejouable.

insert into public.client_phones (client_id, phone_e164, country_iso, is_primary, label)
select c.id,
       coalesce(c.phone_e164, c.phone),
       nullif(upper(c.phone_country), ''),
       true,
       null
from public.clients c
where coalesce(c.phone_e164, c.phone) ~ '^\+[1-9][0-9]{6,14}$'
on conflict (client_id, phone_e164) do nothing;

-- ── Écriture : une seule porte d'entrée ──────────────────────────────

-- Le paramètre est le USER_ID, pas `clients.id` : dans toute l'application,
-- « l'identifiant d'un client » est son user_id — `admin_create_client`
-- renvoie `clientId = new_user_id` et l'objet client du front porte
-- `id: client.user_id`. Une RPC qui attendrait `clients.id` serait la seule
-- à parler une autre langue, et l'erreur ne se verrait qu'à l'exécution.
create or replace function public.admin_set_client_phones(
  p_user_id uuid,
  p_phones  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id    uuid := auth.uid();
  v_client_id   uuid;
  v_count       int;
  v_primary     text;
  v_primary_iso text;
  v_before      jsonb;
  v_item        jsonb;
  v_index       int := 0;
begin
  -- Qui : un membre du staff habilité à gérer les comptes. `is_admin()`
  -- seul ne suffirait pas — il ne teste aucun rôle.
  if not public.admin_has_permission(v_admin_id, 'canManageUsers') then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;

  if p_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Client manquant');
  end if;

  -- Verrouiller la ligne AVANT de la lire : on écrit ensuite en fonction de
  -- ce qu'on a lu, donc deux appels concurrents laisseraient le numéro
  -- principal de `clients` désaccordé de `client_phones`.
  select id into v_client_id from public.clients where user_id = p_user_id for update;
  if v_client_id is null then
    return jsonb_build_object('success', false, 'error', 'Client introuvable');
  end if;

  if jsonb_typeof(p_phones) <> 'array' then
    return jsonb_build_object('success', false, 'error', 'Format de numéros invalide');
  end if;

  v_count := jsonb_array_length(p_phones);
  if v_count = 0 then
    return jsonb_build_object('success', false, 'error', 'Au moins un numéro est requis');
  end if;
  -- Borne haute : au-delà, c'est une erreur de saisie, pas un client.
  if v_count > 10 then
    return jsonb_build_object('success', false, 'error', 'Dix numéros au maximum');
  end if;

  -- Valider TOUS les numéros avant d'écrire quoi que ce soit : un lot
  -- à moitié appliqué serait pire que refusé.
  for v_item in select * from jsonb_array_elements(p_phones) loop
    if coalesce(v_item->>'phone_e164', '') !~ '^\+[1-9][0-9]{6,14}$' then
      return jsonb_build_object(
        'success', false,
        'error', format('Numéro invalide : %s', coalesce(v_item->>'phone_e164', '(vide)'))
      );
    end if;
  end loop;

  select jsonb_agg(jsonb_build_object('phone_e164', phone_e164, 'label', label, 'is_primary', is_primary))
    into v_before
  from public.client_phones where client_id = v_client_id;

  delete from public.client_phones where client_id = v_client_id;

  for v_item in select * from jsonb_array_elements(p_phones) loop
    -- Le PREMIER de la liste est le principal. L'ordre porte le sens : pas
    -- de drapeau à cocher côté client, donc pas de lot sans principal ni de
    -- lot à deux principaux.
    insert into public.client_phones (client_id, phone_e164, country_iso, label, is_primary)
    values (
      v_client_id,
      v_item->>'phone_e164',
      nullif(upper(coalesce(v_item->>'country_iso', '')), ''),
      nullif(btrim(coalesce(v_item->>'label', '')), ''),
      v_index = 0
    )
    on conflict (client_id, phone_e164) do nothing;

    if v_index = 0 then
      v_primary := v_item->>'phone_e164';
      v_primary_iso := nullif(upper(coalesce(v_item->>'country_iso', '')), '');
    end if;
    v_index := v_index + 1;
  end loop;

  -- Tenir `clients` d'accord avec le numéro principal : c'est lui que lisent
  -- la connexion, les envois et la recherche.
  update public.clients
     set phone = v_primary,
         phone_e164 = v_primary,
         phone_country = coalesce(v_primary_iso, phone_country),
         updated_at = now()
   where id = v_client_id;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_admin_id,
    'CLIENT_PHONES_UPDATED',
    'client',
    v_client_id,
    jsonb_build_object('before', v_before, 'after', p_phones)
  );

  return jsonb_build_object('success', true, 'count', v_index, 'primary', v_primary);
end;
$$;

comment on function public.admin_set_client_phones(uuid, jsonb) is
  '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Mettre à jour les numéros WhatsApp d''un client","resolve":{"p_user_id":"client"}}';

-- `anon` n'a rien à faire ici ; la garde interne protège déjà, mais on ne
-- laisse pas la surface ouverte pour autant.
revoke execute on function public.admin_set_client_phones(uuid, jsonb) from anon;
grant  execute on function public.admin_set_client_phones(uuid, jsonb) to authenticated;

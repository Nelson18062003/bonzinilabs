-- ==================================================================================
-- DÉPLOIEMENT — Clés d'accès (passkeys) pour la connexion admin
--
-- Regroupe les 3 migrations de la branche claude/bonzin-admin-login-x38wvx en UN
-- fichier, dans l'ordre. À exécuter une fois (éditeur SQL Supabase).
-- Équivalent à : npx supabase db push --linked
-- → n'utiliser QU'UNE des deux méthodes (sinon le suivi des migrations diverge).
--
-- Idempotent-friendly : create [or replace] / if [not] exists / drop if exists.
-- Réexécuter ce fichier ne casse rien.
--
-- CE QUE ÇA CRÉE
--   · webauthn_credentials  — un appareil enrôlé par ligne (clé PUBLIQUE seule)
--   · webauthn_challenges   — défis à usage unique, TTL 5 min
--   · admin_revoke_passkey  — révoquer un appareil (le sien, ou celui d'un
--                             autre admin si super_admin)
--   · purge_webauthn_challenges — ménage des défis périmés
--   · trg_webauthn_counter_monotonic — le compteur anti-clonage ne recule jamais
--
-- CE QUE ÇA NE FAIT PAS
--   Les deux autres chemins de connexion (code par email, Google) n'ont besoin
--   d'AUCUNE migration : ils reposent sur Supabase Auth. Ils demandent en
--   revanche deux réglages dans le tableau de bord — voir
--   docs/deploiement-passkeys.md.
--
-- APRÈS exécution :
--   1. régénérer les types
--      npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
--   2. secrets de l'Edge Function
--      npx supabase secrets set WEBAUTHN_RP_ID=bonzinilabs.com
--      npx supabase secrets set WEBAUTHN_ORIGINS=https://www.bonzinilabs.com,http://localhost:8080
--   3. déployer la fonction
--      npx supabase functions deploy passkey
-- ==================================================================================

-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [1/3] 20260809120000_webauthn_passkeys.sql
-- │ Tables, RLS, révocation, purge
-- └──────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Clés d'accès (passkeys / WebAuthn) pour l'app ADMIN
--
-- POURQUOI : l'écran admin n'avait qu'un seul chemin (mot de passe) et aucune
-- récupération. Le code par email a réglé l'urgence ; le passkey supprime le
-- dernier geste — l'admin regarde son téléphone et il est dedans.
--
-- CE QUI EST STOCKÉ ICI : uniquement la clé PUBLIQUE. La clé privée ne quitte
-- jamais la puce sécurisée du téléphone, et la biométrie (Face ID, empreinte,
-- déverrouillage facial Android) ne nous est jamais transmise. Une fuite de
-- cette table ne permet à personne de se connecter.
--
-- SÉCURITÉ : ces deux tables sont écrites EXCLUSIVEMENT par l'Edge Function
-- `passkey` (service role). Aucune policy d'écriture n'est ouverte au client ;
-- laisser un client insérer sa propre clé publique reviendrait à lui laisser
-- fabriquer un identifiant de connexion.
-- ============================================================

-- ------------------------------------------------------------
-- 1. webauthn_credentials — une ligne par appareil enrôlé
-- ------------------------------------------------------------
create table if not exists public.webauthn_credentials (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- Identifiant de la clé, en base64url (tel que renvoyé par l'authenticator).
  credential_id  text not null unique,
  -- Clé PUBLIQUE (COSE) en base64url. Inutilisable pour se connecter.
  public_key     text not null,
  -- Compteur anti-clonage : doit croître strictement à chaque usage
  -- (0 = l'authenticator ne compte pas, cas courant sur iOS/Android).
  counter        bigint not null default 0,
  transports     text[],
  -- « iPhone de Papa » — dérivé du User-Agent à l'enrôlement, éditable.
  device_label   text,
  -- true = clé synchronisée (trousseau iCloud / Google Password Manager),
  -- donc elle survivra au remplacement du téléphone.
  backed_up      boolean not null default false,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

create index if not exists idx_webauthn_credentials_user
  on public.webauthn_credentials (user_id);

comment on table public.webauthn_credentials is
  'Clés d''accès (passkeys) des comptes admin. Contient la clé PUBLIQUE uniquement — la clé privée reste dans la puce du téléphone. Écrite uniquement par l''Edge Function passkey (service role).';

-- ------------------------------------------------------------
-- 2. webauthn_challenges — défis à usage unique, courte durée
--
-- Le défi est ce que le téléphone signe. Il doit être aléatoire, à usage
-- unique et périmable : sans ça, une signature capturée pourrait être rejouée.
-- ------------------------------------------------------------
create table if not exists public.webauthn_challenges (
  id           uuid primary key default gen_random_uuid(),
  challenge    text not null unique,
  -- Renseigné à l'enrôlement (on sait qui) ; NULL à la connexion (clé
  -- « découvrable » : c'est le téléphone qui annonce le compte).
  user_id      uuid references auth.users(id) on delete cascade,
  purpose      text not null check (purpose in ('registration', 'authentication')),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_webauthn_challenges_gc
  on public.webauthn_challenges (expires_at)
  where consumed_at is null;

comment on table public.webauthn_challenges is
  'Défis WebAuthn à usage unique (TTL court). Purgés par purge_webauthn_challenges().';

-- ------------------------------------------------------------
-- 3. RLS
--
-- credentials : l'admin LIT ses propres appareils (écran « Mes appareils »).
--               Aucune écriture côté client — tout passe par l'Edge Function.
-- challenges  : aucune policy. Personne ne lit ni n'écrit hors service role.
-- ------------------------------------------------------------
alter table public.webauthn_credentials enable row level security;
alter table public.webauthn_challenges  enable row level security;

drop policy if exists "webauthn_credentials_select_own" on public.webauthn_credentials;
create policy "webauthn_credentials_select_own"
  on public.webauthn_credentials for select
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 4. Révocation d'un appareil
--
-- Soi-même toujours ; celui d'un autre admin uniquement si super_admin
-- (téléphone perdu, départ d'un collaborateur).
-- ------------------------------------------------------------
create or replace function public.admin_revoke_passkey(p_credential uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner  uuid;
  v_label  text;
  v_caller uuid := auth.uid();
begin
  if v_caller is null then
    return jsonb_build_object('success', false, 'error', 'Non authentifié');
  end if;

  select user_id, device_label into v_owner, v_label
  from public.webauthn_credentials
  where id = p_credential;

  if v_owner is null then
    return jsonb_build_object('success', false, 'error', 'Appareil introuvable');
  end if;

  if v_owner <> v_caller
     and not exists (
       select 1 from public.user_roles
       where user_id = v_caller and role = 'super_admin'
         and coalesce(is_disabled, false) = false
     )
  then
    return jsonb_build_object('success', false, 'error', 'Seul un Super Admin peut révoquer l''appareil d''un autre administrateur');
  end if;

  delete from public.webauthn_credentials where id = p_credential;

  insert into public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  values (
    v_caller, 'revoke_passkey', 'admin_user', v_owner,
    jsonb_build_object(
      'description', 'Révocation de la clé d''accès ' || coalesce(v_label, '(sans nom)'),
      'self', v_owner = v_caller
    )
  );

  return jsonb_build_object('success', true);
end;
$$;

comment on function public.admin_revoke_passkey(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Révoquer une clé d''accès (passkey)"}';

revoke all on function public.admin_revoke_passkey(uuid) from public;
grant execute on function public.admin_revoke_passkey(uuid) to authenticated;

-- ------------------------------------------------------------
-- 5. Purge des défis expirés (appelée par l'Edge Function)
-- ------------------------------------------------------------
create or replace function public.purge_webauthn_challenges()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.webauthn_challenges
  where expires_at < now() - interval '1 hour';
$$;

comment on function public.purge_webauthn_challenges() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Purger les défis WebAuthn expirés"}';

-- Appelée par l'Edge Function `passkey` (service role) après chaque défi.
-- Jamais exposée aux clients : elle n'a aucune raison d'être appelable depuis
-- le navigateur.
revoke all on function public.purge_webauthn_challenges() from public;
revoke all on function public.purge_webauthn_challenges() from authenticated, anon;
grant execute on function public.purge_webauthn_challenges() to service_role;

notify pgrst, 'reload schema';

-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [2/3] 20260809140000_webauthn_rate_limit.sql
-- │ Limitation de débit de login/start
-- └──────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Limitation de débit sur la demande de défi WebAuthn.
--
-- POURQUOI : `login/start` est publique par nécessité (personne n'est connecté
-- quand on demande un défi). Sans garde-fou, n'importe qui peut la marteler et
-- faire grossir webauthn_challenges indéfiniment.
--
-- L'IP N'EST PAS STOCKÉE EN CLAIR : on garde un SHA-256 salé. Suffisant pour
-- compter des demandes sur une minute, inutilisable pour retrouver quelqu'un.
-- ============================================================

alter table public.webauthn_challenges
  add column if not exists client_ip_hash text;

-- Sert la fenêtre glissante « combien de demandes depuis cette empreinte ».
create index if not exists idx_webauthn_challenges_rate
  on public.webauthn_challenges (client_ip_hash, created_at desc)
  where client_ip_hash is not null;

comment on column public.webauthn_challenges.client_ip_hash is
  'SHA-256 salé de l''IP appelante. Sert uniquement à la limitation de débit ; jamais l''IP en clair.';

-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ [3/3] 20260809160000_webauthn_counter_monotonic.sql
-- │ Compteur anti-clonage : jamais en recul
-- └──────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Garde-fou : le compteur anti-clonage d'une clé d'accès ne recule jamais.
--
-- L'Edge Function `passkey` avance déjà le compteur sous verrou optimiste
-- (UPDATE … WHERE counter = <valeur lue>), ce qui règle la course entre deux
-- assertions simultanées. Ce déclencheur est la ceinture en plus des bretelles :
-- même en cas d'écriture directe (service role, script de maintenance, futur
-- code distrait), une valeur qui recule est refusée par la base.
--
-- ÉGALITÉ AUTORISÉE, ET C'EST NÉCESSAIRE : les authenticators iOS et Android
-- renvoient 0 en permanence. Interdire l'égalité rendrait toute connexion par
-- clé d'accès impossible sur téléphone.
-- ============================================================

create or replace function public.webauthn_counter_never_decreases()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.counter < old.counter then
    raise exception
      'Compteur de clé d''accès en recul (% → %) : clé possiblement clonée',
      old.counter, new.counter
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webauthn_counter_monotonic on public.webauthn_credentials;

create trigger trg_webauthn_counter_monotonic
  before update of counter on public.webauthn_credentials
  for each row
  execute function public.webauthn_counter_never_decreases();

comment on function public.webauthn_counter_never_decreases() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Garde-fou interne : compteur WebAuthn monotone"}';

notify pgrst, 'reload schema';

-- ==================================================================================
-- FIN. Vérification rapide :
--
--   select table_name from information_schema.tables
--    where table_schema = 'public' and table_name like 'webauthn%';        -- 2 tables
--
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and proname in ('admin_revoke_passkey', 'purge_webauthn_challenges',
--                      'webauthn_counter_never_decreases');                -- 3 fonctions
--
--   select tgname from pg_trigger
--    where tgname = 'trg_webauthn_counter_monotonic';                      -- 1 déclencheur
-- ==================================================================================

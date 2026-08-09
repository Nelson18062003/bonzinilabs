-- ==================================================================================
-- BONZINI — CONNEXION ADMIN : LE FICHIER UNIQUE
--
-- Tout le SQL de ce chantier (code par email · Google · clé d'accès · mot de
-- passe choisi) en UN seul fichier, à coller dans l'éditeur SQL Supabase.
-- Remplace les deux fichiers précédents (DEPLOY_passkeys_… et
-- DEPLOY_verification_…), supprimés pour qu'il n'y ait plus de doute sur
-- lequel lancer.
--
-- ┌─ COMMENT L'UTILISER ────────────────────────────────────────────────────┐
-- │ Tout coller, tout lancer, une fois. La PARTIE A applique, la PARTIE B   │
-- │ vérifie dans la foulée et affiche le résultat.                          │
-- │ Relançable sans risque : tout est en create/alter … if [not] exists.    │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- ⚠️ N'utiliser QU'UNE des deux méthodes : ce fichier **OU**
--    `npx supabase db push --linked`. Les deux, et le suivi des migrations
--    Supabase diverge.
--
-- ⚠️ CE FICHIER NE COUVRE QUE CE CHANTIER — les 3 migrations webauthn_*.
--    Ce n'est pas un rejeu de tout l'historique du projet : les migrations
--    antérieures (paiements groupés, trésorerie, Mola…) ne sont pas ici et
--    n'ont pas à être rejouées.
--
-- ⚠️ CE FICHIER NE SUFFIT PAS À TOUT ACTIVER. Le code par email et Google ne
--    demandent AUCUN SQL : ils dépendent de réglages du tableau de bord,
--    listés à la toute fin.
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


-- ##################################################################################
-- #                                                                                #
-- #   PARTIE A — CE QUI S'APPLIQUE   (3 migrations, dans l'ordre)                   #
-- #                                                                                #
-- ##################################################################################

-- ┌──────────────────────────────────────────────────────────────────────────────
-- │ A1/3 — 20260809120000_webauthn_passkeys.sql
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
-- │ A2/3 — 20260809140000_webauthn_rate_limit.sql
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
-- │ A3/3 — 20260809160000_webauthn_counter_monotonic.sql
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



-- ##################################################################################
-- #                                                                                #
-- #   PARTIE B — CE QUI VÉRIFIE   (que des SELECT, rien n'est modifié)              #
-- #                                                                                #
-- #   Lancée juste après la partie A, les tables existent : toutes les              #
-- #   requêtes ci-dessous fonctionnent. Elles sont aussi relançables seules,        #
-- #   n'importe quand, pour refaire le point.                                       #
-- #                                                                                #
-- ##################################################################################


-- ── B1. Les tables sont-elles bien en place ? ────────────────────────────────
--     Attendu : les deux lignes à `true`.
--     `to_regclass` renvoie NULL plutôt qu'une erreur si la table manque, donc
--     ce contrôle reste sûr même lancé seul sur une base vierge.
select 'webauthn_credentials' as objet_attendu,
       (to_regclass('public.webauthn_credentials') is not null) as present
union all
select 'webauthn_challenges',
       (to_regclass('public.webauthn_challenges') is not null)
order by objet_attendu;


-- ── B2. Fonctions et déclencheur ─────────────────────────────────────────────
--     Attendu : 3 fonctions + 1 déclencheur.
select 'fonction' as type_objet, p.proname as nom
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_revoke_passkey',
    'purge_webauthn_challenges',
    'webauthn_counter_never_decreases'
  )
union all
select 'declencheur', tgname
from pg_trigger
where tgname = 'trg_webauthn_counter_monotonic'
order by type_objet, nom;


-- ── B3. Les comptes admin peuvent-ils recevoir un CODE de connexion ? ────────
--
--     LE CONTRÔLE LE PLUS UTILE AUJOURD'HUI. Si `email_confirme` est false,
--     Supabase envoie le gabarit « Confirm signup » (texte d'INSCRIPTION) au
--     lieu de « Magic Link » (texte de CONNEXION) — c'est exactement le mail
--     d'inscription reçu au premier test.
--
--     email_reel = false → adresse de service, non délivrable : cet admin ne
--     pourra jamais recevoir de code.
select
  ur.email,
  ur.role,
  coalesce(ur.is_disabled, false)                       as desactive,
  (u.email_confirmed_at is not null)                    as email_confirme,
  (u.email not like '%@bonzini-client.local')           as email_reel,
  u.last_sign_in_at                                     as derniere_connexion
from public.user_roles ur
join auth.users u on u.id = ur.user_id
order by ur.email;


-- ── B4. Journal des actions d'authentification (30 derniers jours) ───────────
--     Confirme qu'un chemin a réellement été emprunté :
--       register_passkey     → une clé a été enrôlée
--       revoke_passkey       → un appareil a été révoqué
--       change_own_password  → quelqu'un a choisi son propre mot de passe
select
  l.created_at,
  l.action_type               as action,
  ur.email                    as par,
  l.details ->> 'description' as detail
from public.admin_audit_logs l
left join public.user_roles ur on ur.user_id = l.admin_user_id
where l.action_type in ('register_passkey', 'revoke_passkey', 'change_own_password', 'reset_admin_password')
  and l.created_at > now() - interval '30 days'
order by l.created_at desc
limit 50;


-- ── B5. Appareils enrôlés ────────────────────────────────────────────────────
--     Vide au départ, c'est normal : une clé s'enrôle depuis l'app
--     (Paramètres → Sécurité → Connexion rapide), une fois connecté par un
--     autre chemin.
--     synchronise = true → la clé suivra sur un nouveau téléphone du même
--     écosystème (trousseau iCloud / Google Password Manager).
select
  ur.email,
  c.device_label as appareil,
  c.backed_up    as synchronise,
  c.counter      as compteur,
  c.created_at   as ajoute_le,
  c.last_used_at as derniere_utilisation
from public.webauthn_credentials c
join public.user_roles ur on ur.user_id = c.user_id
order by c.created_at desc;


-- ── B6. Défis en attente (hygiène) ───────────────────────────────────────────
--     Beaucoup de lignes périmées et non utilisées = quelqu'un martèle
--     login/start. La limitation de débit (10/min par empreinte d'IP) devrait
--     déjà l'avoir freiné.
select
  purpose                                         as usage,
  count(*)                                        as total,
  count(*) filter (where consumed_at is not null) as consommes,
  count(*) filter (where consumed_at is null
                     and expires_at < now())      as perimes_non_utilises
from public.webauthn_challenges
group by purpose;


-- ==================================================================================
-- IL RESTE CECI, QUI NE SE FAIT PAS EN SQL
-- (le tableau de bord Supabase — sans ces réglages, la connexion par code et
--  Google ne fonctionneront pas, quoi qu'on applique ici)
--
--  □ Authentication → Providers → Email → Email OTP Length = 6
--      L'écran admin affiche 6 cases. À 8, la connexion par code est
--      impossible : les deux derniers chiffres n'ont nulle part où aller.
--
--  □ Authentication → Emails → Templates → Magic Link
--      Doit contenir la variable Token (et non ConfirmationURL), avec un texte
--      de CONNEXION. C'est ce gabarit que reçoit un admin déjà existant —
--      celui d'inscription n'a pas lieu d'être ici.
--
--  □ Authentication → URL Configuration → Redirect URLs
--      Doit inclure les chemins /m/ du site : retour Google ET lien de
--      réinitialisation du mot de passe.
--
--  □ Authentication → Providers → Google : activé.
--
--  □ Edge Function `passkey` déployée, avec WEBAUTHN_RP_ID et WEBAUTHN_ORIGINS.
-- ==================================================================================

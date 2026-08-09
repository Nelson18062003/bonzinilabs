-- ==================================================================================
-- VÉRIFICATION — connexion admin (code email · Google · clé d'accès)
--
-- ⚠️ CE FICHIER NE MODIFIE RIEN. Que des SELECT. On peut le relancer autant de
-- fois qu'on veut, à n'importe quel moment.
--
-- À QUOI IL SERT : dire en un coup d'œil ce qui est réellement posé en base et
-- ce qui manque encore, au lieu de le deviner en testant depuis un téléphone.
--
-- ORGANISATION — elle n'est pas cosmétique :
--   §1 à §4  se lancent TOUJOURS, y compris avant toute migration. Ils ne
--            touchent que des catalogues système et des tables déjà en place.
--   §5       ne fonctionne QU'APRÈS les migrations des clés d'accès : il
--            interroge les tables webauthn_*. Lancé trop tôt, PostgreSQL
--            répond « relation does not exist » et, dans l'éditeur SQL,
--            l'erreur interrompt tout ce qui suit. C'est pourquoi il est
--            isolé en fin de fichier, derrière le contrôle du §1.
--
-- CE QU'IL NE PEUT PAS VOIR : les réglages du tableau de bord (longueur du
-- code, gabarits d'email, SMTP, fournisseur Google, URLs de redirection). Ils
-- ne sont pas en base — voir la liste en fin de fichier.
--
-- Le SQL à APPLIQUER pour les clés d'accès est ailleurs :
--   docs/DEPLOY_passkeys_connexion_admin.sql  (3 migrations)
-- ==================================================================================


-- ──────────────────────────────────────────────────────────────────────────────
-- §1. Les migrations des clés d'accès sont-elles appliquées ?
--
--     `to_regclass` renvoie NULL au lieu de lever une erreur quand la table
--     n'existe pas : ce contrôle est donc sûr même sur une base vierge.
--
--     Les deux lignes à `true`  → tout est posé, le §5 est utilisable.
--     Une seule ligne à `false` → migrations non appliquées : le bouton
--                                 « Se connecter avec cet appareil » s'affichera
--                                 mais échouera. NE PAS lancer le §5.
-- ──────────────────────────────────────────────────────────────────────────────
select 'webauthn_credentials' as objet_attendu,
       (to_regclass('public.webauthn_credentials') is not null) as present
union all
select 'webauthn_challenges',
       (to_regclass('public.webauthn_challenges') is not null)
order by objet_attendu;


-- ──────────────────────────────────────────────────────────────────────────────
-- §2. Fonctions et déclencheur.
--     Attendu une fois les migrations passées : 3 fonctions + 1 déclencheur.
--     Aucun risque d'erreur : on lit les catalogues, pas les tables.
-- ──────────────────────────────────────────────────────────────────────────────
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


-- ──────────────────────────────────────────────────────────────────────────────
-- §3. Les comptes admin peuvent-ils recevoir un CODE de connexion ?
--
--     C'est le contrôle le plus utile aujourd'hui. Si `email_confirme` est
--     false, Supabase envoie le gabarit « Confirm signup » (texte
--     d'inscription) au lieu de « Magic Link » (texte de connexion) — c'est
--     exactement le mail d'inscription reçu au premier test.
--
--     email_reel = false → adresse de service, non délivrable : cet admin ne
--     pourra jamais recevoir de code.
-- ──────────────────────────────────────────────────────────────────────────────
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


-- ──────────────────────────────────────────────────────────────────────────────
-- §4. Journal des actions d'authentification (30 derniers jours).
--     Confirme qu'un chemin a réellement été emprunté :
--       register_passkey     → une clé a été enrôlée
--       revoke_passkey       → un appareil a été révoqué
--       change_own_password  → quelqu'un a choisi son propre mot de passe
--     `admin_audit_logs` existe de longue date : sans risque.
-- ──────────────────────────────────────────────────────────────────────────────
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


-- ==================================================================================
-- §5. ⛔ À NE LANCER QU'APRÈS LES MIGRATIONS
--
--     Ne sélectionner ce bloc que si le §1 a renvoyé `present = true` sur les
--     DEUX lignes. Sinon PostgreSQL répond « relation does not exist » et
--     interrompt l'exécution.
--
--     (Dans l'éditeur SQL Supabase : surligner le bloc et lancer la sélection.)
-- ==================================================================================

-- 5a. Quels appareils sont enrôlés, et pour qui ?
--     Vide au départ : une clé s'enrôle depuis Paramètres → Sécurité →
--     Connexion rapide, une fois connecté par un autre chemin.
--     synchronise = true → la clé suivra sur un nouveau téléphone du même
--     écosystème (trousseau iCloud / Google Password Manager).
--
-- select
--   ur.email,
--   c.device_label as appareil,
--   c.backed_up    as synchronise,
--   c.counter      as compteur,
--   c.created_at   as ajoute_le,
--   c.last_used_at as derniere_utilisation
-- from public.webauthn_credentials c
-- join public.user_roles ur on ur.user_id = c.user_id
-- order by c.created_at desc;

-- 5b. Défis en attente (hygiène).
--     Beaucoup de lignes périmées et non utilisées = quelqu'un martèle
--     login/start. La limitation de débit (10/min par empreinte d'IP) devrait
--     déjà l'avoir freiné.
--
-- select
--   purpose                                         as usage,
--   count(*)                                        as total,
--   count(*) filter (where consumed_at is not null) as consommes,
--   count(*) filter (where consumed_at is null
--                      and expires_at < now())      as perimes_non_utilises
-- from public.webauthn_challenges
-- group by purpose;


-- ==================================================================================
-- CE QUI NE SE VÉRIFIE PAS EN SQL — à contrôler dans le tableau de bord Supabase
--
--  □ Authentication → Providers → Email → Email OTP Length = 6
--      Doit valoir 6 : l'écran admin affiche 6 cases. À 8, la connexion par
--      code est impossible.
--
--  □ Authentication → Emails → Templates → Magic Link
--      Doit contenir la variable Token (pas ConfirmationURL) et un texte de
--      CONNEXION, pas d'inscription. C'est ce gabarit que reçoit un admin
--      existant.
--
--  □ Authentication → URL Configuration → Redirect URLs
--      Doit inclure les chemins /m/ du site (retour Google + lien de
--      réinitialisation du mot de passe).
--
--  □ Authentication → Providers → Google : activé.
--
--  □ Edge Function `passkey` déployée, avec les secrets WEBAUTHN_RP_ID et
--      WEBAUTHN_ORIGINS.
-- ==================================================================================

-- ==================================================================================
-- VÉRIFICATION — connexion admin (code email · Google · clé d'accès)
--
-- ⚠️ CE FICHIER NE MODIFIE RIEN. Que des SELECT. On peut le relancer autant de
-- fois qu'on veut, à n'importe quel moment.
--
-- À QUOI IL SERT : dire en un coup d'œil ce qui est réellement posé en base et
-- ce qui manque encore, au lieu de le deviner en testant depuis un téléphone.
--
-- CE QU'IL NE PEUT PAS VOIR : les réglages du tableau de bord (longueur du code,
-- gabarits d'email, SMTP, fournisseur Google, URLs de redirection). Ceux-là ne
-- sont pas en base — ils se vérifient à l'écran. Voir §6 pour la liste.
--
-- Le SQL à APPLIQUER pour les clés d'accès est ailleurs :
--   docs/DEPLOY_passkeys_connexion_admin.sql  (3 migrations)
-- ==================================================================================


-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Les tables des clés d'accès sont-elles là ?
--    Attendu : 2 lignes (webauthn_credentials, webauthn_challenges).
--    0 ligne  → les migrations n'ont pas été appliquées : le bouton « Se
--               connecter avec cet appareil » s'affichera mais échouera.
-- ──────────────────────────────────────────────────────────────────────────────
select 'tables' as controle, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'webauthn%'
order by table_name;


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Les fonctions et le déclencheur.
--    Attendu : 3 fonctions + 1 déclencheur.
-- ──────────────────────────────────────────────────────────────────────────────
select 'fonctions' as controle, p.proname as nom
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_revoke_passkey',
    'purge_webauthn_challenges',
    'webauthn_counter_never_decreases'
  )
order by p.proname;

select 'declencheur' as controle, tgname as nom
from pg_trigger
where tgname = 'trg_webauthn_counter_monotonic';


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Les comptes admin peuvent-ils recevoir un CODE de connexion ?
--
--    C'est le contrôle le plus important. Si `email_confirmed_at` est vide,
--    Supabase envoie le gabarit « Confirm signup » (texte d'inscription) au
--    lieu de « Magic Link » (texte de connexion) — c'est exactement le mail
--    d'inscription reçu au premier test.
--
--    email_reel = false → adresse de service, non délivrable : cet admin ne
--    pourra jamais recevoir de code.
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
-- 4. Quels appareils sont enrôlés, et pour qui ?
--    Vide au départ : une clé s'enrôle depuis Paramètres → Sécurité →
--    Connexion rapide, une fois connecté par un autre chemin.
--    synchronise = true → la clé suivra sur un nouveau téléphone du même
--    écosystème (trousseau iCloud / Google Password Manager).
-- ──────────────────────────────────────────────────────────────────────────────
select
  ur.email,
  c.device_label      as appareil,
  c.backed_up         as synchronise,
  c.counter           as compteur,
  c.created_at        as ajoute_le,
  c.last_used_at      as derniere_utilisation
from public.webauthn_credentials c
join public.user_roles ur on ur.user_id = c.user_id
order by c.created_at desc;


-- ──────────────────────────────────────────────────────────────────────────────
-- 5. Les défis en attente (hygiène).
--    Beaucoup de lignes non consommées et périmées = quelqu'un martèle
--    login/start. La limitation de débit (10/min par empreinte d'IP) devrait
--    déjà l'avoir freiné.
-- ──────────────────────────────────────────────────────────────────────────────
select
  purpose                                                    as usage,
  count(*)                                                   as total,
  count(*) filter (where consumed_at is not null)            as consommes,
  count(*) filter (where consumed_at is null
                     and expires_at < now())                 as perimes_non_utilises
from public.webauthn_challenges
group by purpose;


-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Journal des actions d'authentification (30 derniers jours).
--    Confirme qu'un chemin a réellement été emprunté :
--      register_passkey     → une clé a été enrôlée
--      revoke_passkey       → un appareil a été révoqué
--      change_own_password  → quelqu'un a choisi son propre mot de passe
-- ──────────────────────────────────────────────────────────────────────────────
select
  l.created_at,
  l.action_type    as action,
  ur.email         as par,
  l.details ->> 'description' as detail
from public.admin_audit_logs l
left join public.user_roles ur on ur.user_id = l.admin_user_id
where l.action_type in ('register_passkey', 'revoke_passkey', 'change_own_password', 'reset_admin_password')
  and l.created_at > now() - interval '30 days'
order by l.created_at desc
limit 50;


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

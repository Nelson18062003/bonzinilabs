# Sources des clients et suivi des commerciaux

D'où vient chaque client — un commercial, une recommandation, un réseau
social, en ligne, un événement… — et ce que chaque source rapporte. Base des
futures commissions des commerciaux.

## Ce qui existe

- **Création de client (obligatoire)** — admin desktop, admin mobile,
  réception : section « Origine du client ». Sources rangées par catégorie,
  recherche, « Je ne sais pas » toujours proposé. « + Ajouter une source »
  crée un nouveau commercial (nom + téléphone) sans quitter le formulaire ; il
  est réutilisable pour les clients suivants.
- **Fiche client** — « Origine » visible ; « Renseigner » si elle est vide,
  « Modifier » pour qui a `canEditClients`.
- **Clients › Sources & commerciaux** (`/m/clients/sources`, ordinateur et
  téléphone) — par source et sur une période : clients (et nouveaux),
  dépôts validés, paiements terminés, colis déposés (nombre, kg, m³). Une
  source s'ouvre sur ses clients, un par un. Ajouter, renommer, archiver.

## Règles (base de données)

- `client_sources` : catégories `commercial`, `referral`, `social`,
  `online`, `event`, `other`, `unknown` (« Je ne sais pas », système).
- `clients.source_id` est **verrouillé** : un trigger ignore toute écriture
  qui ne passe pas par `set_client_source`. Sans cela, un client (politique
  « update own profile ») ou n'importe quel membre du staff pouvait changer
  l'attribution — donc les commissions.
- Droits : créer une source et poser une PREMIÈRE origine =
  `canRegisterClients` ; changer une origine, modifier/archiver une source =
  `canEditClients` ; voir le rapport = `canViewClients`.
- RPC (toutes étiquetées `@mola`) : `create_client_source`,
  `update_client_source`, `set_client_source`, `get_client_source_report`,
  `get_client_source_clients`.
- Comptage : dépôts `validated` (date de validation), paiements `completed`
  (date de traitement), colis des dépôts non annulés (date d'enregistrement).

Migration : `supabase/migrations/20261005120000_client_sources.sql`
(appliquée en production le 05/10/2026). Les 7 clients venus par un lien
suivi (ChatGPT, Facebook) ont reçu leur origine ; les autres sont « Non
renseigné » et se complètent depuis leur fiche.

## Les commerciaux ont un compte (05/10/2026)

Un commercial créé dans **Mes équipes** (`/m/equipe`) est relié à SA fiche
« commercial » (`client_sources.staff_user_id`) — une nouvelle à son nom, ou
celle sous laquelle il apportait déjà des clients. Il a son espace `/v` : ses
prospects, ses clients, ses chiffres du mois (paiements, fret avion en kg,
bateau en m³) et ses objectifs. Un compte client créé avec le numéro d'un de
ses prospects lui est attribué automatiquement, et le formulaire « Nouveau
client » pré-remplit l'origine. Migration :
`supabase/migrations/20261005160000_teams_commercials.sql`.

## Pour plus tard

- Commissions : un taux par commercial et le montant dû par période, à
  partir de ce même rapport.
- Inscriptions venues du site avec un lien suivi : poser l'origine
  automatiquement.

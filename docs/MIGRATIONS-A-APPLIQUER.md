# Migrations à appliquer — registre

> Fichier de consignation : ce qu'il faut **pousser dans Supabase à la main** et les
> étapes post-migration. À tenir à jour à chaque PR qui embarque du SQL.

> **Le déploiement automatique ne marche pas.** Le workflow `deploy-edge-functions.yml` échoue à chaque merge depuis
> au moins le 10/08/2026 (`supabase link` → « Unauthorized » : le secret `SUPABASE_ACCESS_TOKEN` est refusé, et
> `SUPABASE_DB_PASSWORD` est vide). **Aucune migration n'est appliquée au merge, aucune fonction serveur n'est
> redéployée.** Chaque migration se colle à la main (fichier consolidé de `migrations/`), puis
> `npx supabase migration repair --status applied <version>`. Pour réparer le workflow : un nouveau jeton d'accès
> Supabase dans `SUPABASE_ACCESS_TOKEN` et le mot de passe de la base dans `SUPABASE_DB_PASSWORD` (Settings › Secrets
> du dépôt GitHub).
>
> **État vérifié en production le 05/10/2026** (lecture seule) : tout ce qui est listé sous « Appliquées » est en place.

## En attente

> **Les deux migrations du 06/10 se collent en UN fichier : `migrations/20261006_consolidated.sql`** (à coller APRÈS
> `migrations/20261005_consolidated.sql`). Il contient, dans l'ordre, un contrôle des prérequis (s'arrête net, sans
> rien modifier, s'il en manque un), `20261006100000` (sites, numéros du personnel, « Enregistré par ») puis
> `20261006120000` (fiche prospect complète, sexe et date de naissance des clients). Rejouable, y compris si
> l'ancienne version de ce fichier (`20261006100000` seule) a déjà été collée. Ensuite :
> 1. `npx supabase migration repair --status applied 20261006100000 20261006120000`
> 2. `/gen-types`
>
> **Ordre de déploiement — coller le SQL, PUIS fusionner et déployer le site IMMÉDIATEMENT.** Il n'existe pas d'ordre
> sans coupure de la création d'un prospect : `20261006120000` supprime les anciennes signatures de `prospect_create` /
> `prospect_update` et exige désormais nom, sexe et ville — l'ancien formulaire (encore en ligne entre le SQL et le
> déploiement) est refusé (« Indiquez le sexe : homme ou femme ») ; à l'inverse, le nouveau site avant le SQL appelle
> des fonctions qui n'existent pas encore. Faire les deux à la suite, hors des heures de terrain des commerciaux.
> Dans l'intervalle, la LISTE des prospects reste lisible dans les deux sens (si `prospect_phones` n'existe pas encore,
> le nouveau site la relit sans les autres numéros) ; seules la création et la modification attendent.

### `20261006120000_prospect_details_client_identity.sql` (à passer APRÈS `20261006100000` — même fichier consolidé)
**PR :** Espace commercial : la fiche prospect complète, en étapes · Clients : sexe et date de naissance
**Contenu :**
- `prospects` : `gender` (MALE / FEMALE), `birth_date`, `email` (minuscules, forme x@y.z), `pain_points` (« ses plus
  gros problèmes aujourd'hui », champ libre, 2 000 caractères) et `help_needed` (« ce que nous pouvons faire pour
  l'aider »). **Nom, sexe et ville deviennent obligatoires** à la création (`prospect_create`) ; un prospect saisi
  avant reste modifiable tant qu'on ne vide pas ces champs. Date de naissance : de 16 à 110 ans.
- `prospect_phones` : les **autres numéros** d'un prospect (neuf au plus ; le principal reste `prospects.phone_e164`).
  Lecture comme la fiche (le commercial les siens, le responsable tous), aucune politique d'écriture. Un numéro —
  principal ou non — n'est suivi que par UN prospect ouvert, et jamais s'il est celui d'un client ; tout est vérifié
  avant d'écrire, les numéros saisis sont verrouillés (deux saisies simultanées passent l'une après l'autre).
- `prospect_create` / `prospect_update` : **anciennes signatures supprimées**, recréées avec `p_gender`, `p_birth_date`,
  (`p_clear_birth_date`), `p_email`, `p_phones` (jsonb, la liste complète), `p_pain_points`, `p_help_needed`. Un
  prospect « devenu client » garde ses numéros. `prospect_set_status` : un prospect perdu qu'on rouvre ne reprend pas
  un autre numéro suivi ailleurs entre-temps.
- `prospect_lookup_phone` (même signature) : trouve aussi par un **autre** numéro et renvoie la fiche (nom, entreprise,
  ville, email, sexe, date de naissance, numéros) pour la reprendre dans « Nouveau client ». L'email n'y est que
  **proposé** (un geste de l'opérateur, après confirmation par le client) : `admin_create_client` en fait l'adresse de
  connexion déjà confirmée du client, et c'est un commercial qui l'a saisie, sans vérification.
- `clients_match_prospect` : un compte client créé avec **l'un quelconque** des numéros d'un prospect est attribué à son
  commercial (le déclencheur lui-même ne change pas).
- `admin_set_client_identity(p_user_id, p_gender, p_date_of_birth, p_clear_birth_date)` : sexe et date de naissance d'un
  client — `canEditClients`, ou `canRegisterClients` pour un client qu'on a soi-même enregistré (sans limite de
  temps, comme l'origine posée par la réception) ; journalisée
  (`set_client_identity`) ; `@mola` exposée (canEditClients, confirmation).
- Aucune donnée existante modifiée. Testée sur Postgres 16 : migration passée deux fois dans une transaction, 80
  contrôles (et une saisie simultanée réelle sur deux connexions), les 40 contrôles du 06/10 et les 105 de Mes équipes /
  commerciaux repassés ; le fichier consolidé de même (deux fois d'affilée, après l'ancienne version, et refus net
  sans Mes équipes).

**Comment pousser :** voir l'encadré ci-dessus (un seul fichier pour les deux migrations du 06/10).

### `20261006100000_staff_sites_phones_registration.sql` (à passer APRÈS `migrations/20261005_consolidated.sql`)
**PR :** Équipe : sites et numéros à drapeau · Clients : « Enregistré par », origine facultative, origine posée par la réception
**Contenu :**
- `staff_sites` : les sites du personnel. Quatre au départ (Guangzhou · bureau, Guangzhou · entrepôt, Douala, Yaoundé), le
  super admin en ajoute (`team_create_site`). `user_roles.site_id`.
- `staff_phones` : plusieurs numéros par collaborateur, au format international (E.164), le premier recopié dans
  `user_roles.phone` (`team_set_member_profile`, canManageUsers, journalisée). Les numéros déjà saisis au format
  international sont repris ; les autres (sans indicatif) restent à ressaisir depuis la fiche du membre.
- `clients.registered_by / _name / _role / _site / _at` : **« Enregistré par »**. Posé par le déclencheur
  `clients_stamp_registration` à la création d'un client, depuis la session (`auth.uid()` d'un membre actif du
  personnel) : obligatoire de fait, jamais choisi, jamais réécrit (même par le super admin). Vide pour un client inscrit
  lui-même. Rattrapage des clients créés par l'équipe depuis le journal (`create_client`, depuis le 10/02/2026), sans site.
- Origine `parcel` (« Colis reçu · Entrepôt de Guangzhou (bateau) » / « … · Bureau de Guangzhou (avion) »), réservée
  au système, posée par `reception_set_client_origin` sur un client que la réception vient d'enregistrer (jamais par-dessus
  une origine : le prospect d'un commercial reste prioritaire). Ailleurs, l'origine devient **facultative** (vide =
  « Non renseignée »).
- `team_members` renvoie aussi `phones` et `site`.
- Testée sur Postgres 16 : fichier passé deux fois dans une transaction, 40 contrôles, et les 105 contrôles de Mes
  équipes / commerciaux repassés ; contrôle des prérequis éprouvé (refuse de passer sans Mes équipes, rien n'est créé).

**Comment pousser :** coller `migrations/20261006_consolidated.sql` dans l'éditeur SQL (il contient aussi
`20261006120000`), puis `npx supabase migration repair --status applied 20261006100000 20261006120000`, puis
`/gen-types` (les types sont déjà ajoutés à la main ; l'app appelle les RPC sans attendre).


> **Les trois migrations du 05/10 se collent en UN fichier : `migrations/20261005_consolidated.sql`.** Il contient,
> dans l'ordre obligatoire, la partie A (`20261005150000`, remise / vols / arrivée), la partie B (`20261005160000`,
> Mes équipes + commerciaux) et la partie C (`20261005170000`, paquets avion). Chaque partie vérifie d'abord ses
> prérequis et s'arrête net, sans rien modifier, s'il en manque un. Le fichier est rejouable, et il est vérifié passé
> deux fois d'affilée dans une seule transaction. Ensuite, dans cet ordre :
> 1. `npx supabase migration repair --status applied 20261005150000 20261005160000 20261005170000`
> 2. `/gen-types`
> 3. `npx supabase functions deploy admin-assistant`, **avant de créer le premier commercial** (lire la partie B).
> 4. App BONZINI HQ : `cd hq-app && npm run update:production`.


### `20261005150000_cargo_unblock_release_air_arrival.sql`
**PR :** Cargo › débloquer la remise à Douala, les vols, et marquer un conteneur arrivé (+ correctif sécurité Mola)
**Contenu :**
- **Sécurité (défaut existant, constaté en production).** `assistant_readonly_query` (SQL libre de Mola) laissait passer
  `select set_config(..., false)` : la variable de session survivait sur la connexion partagée de PostgREST, donc
  `auth.uid()` pouvait être usurpé pour les requêtes suivantes, et les verrous `bonzini.*` (dont
  `bonzini.client_source_write` de la PR #224) pouvaient être forgés. La requête s'exécute désormais dans une
  sous-transaction toujours annulée (le résultat est gardé), et `set_config` et les identifiants `U&"…"` sont refusés.
  Même garde `canViewClients`, mêmes droits.
- `warehouse_release_parcels` et `air_shipments_notify` sans `min(uuid)` : en production (vérifié le 05/10), la remise
  (bon de retrait BR-) et le passage d'un vol à « parti » / « arrivé » échouaient toujours (« function min(uuid) does
  not exist », même défaut que F-085). La remise refuse aussi un lot qui mêle un colis sans client.
- `warehouse_checkin_many` : verrouille les colis (et leur conteneur) avant de les pointer — deux pointages simultanés
  ne se marchent plus dessus.
- `parcels_follow_shipment` : un conteneur « livré » côté armateur ne fait plus passer ses colis non remis en « livré ».
- Garde-fou `cargo_shipments_status_guard` : le statut d'un conteneur n'avance que dans un sens ; la synchro ne peut plus
  le faire reculer. Seule l'annulation d'arrivée (jeton interne à la transaction, impossible à forger par l'API) peut le
  faire revenir en arrière.
- `cargo_mark_shipment_arrived` (`canManageCargo`, journalisée, `@mola`) : refuse un conteneur pas encore parti, une date
  future ou antérieure au départ ; prévient les clients des colis (« arrivés au port de Kribi / Douala ») et renvoie le
  nombre de colis et de clients.
- `cargo_unmark_shipment_arrived` (motif obligatoire) : seulement si l'arrivée vient d'un marquage à la main, que
  l'armateur n'a pas signalé l'arrivée, et qu'aucun colis n'est pointé, remis ou manquant ; restaure le statut, l'ETA et
  le dernier événement d'avant. Aucun message n'est envoyé sur une annulation (les clients déjà prévenus ne sont pas
  corrigés).
- Boutons « Marquer le conteneur arrivé » / « Annuler l'arrivée » dans le dossier conteneur (ordinateur et téléphone).
- Aucune table ni colonne ; aucune donnée modifiée (0 colis « livré » sans bon de retrait en production).
- Testée sur Postgres 16 avec le schéma cargo réel : pannes reproduites avant, fichier passé deux fois dans une
  transaction, 61 contrôles (droits, refus, restauration, usurpation de session bloquée) ; contrôle des prérequis
  éprouvé.

**Comment pousser :** partie A de `migrations/20261005_consolidated.sql`, à coller dans l'éditeur SQL (contrôle des
prérequis en tête, rejouable), puis `npx supabase migration repair --status applied 20261005150000`, puis `/gen-types`
(les deux nouvelles RPC ; l'app les appelle déjà). Rien à redéployer côté fonctions serveur.

### `20261005160000_teams_commercials.sql` (à passer APRÈS la précédente)
**PR :** Mes équipes + commerciaux (rôle isolé, prospects, objectifs, tableaux de bord)
**Contenu :**
- Rôle `commercial` (`app_role`) ; permissions `canProspect` (le commercial) et `canManageSales` (super admin) dans
  `admin_has_permission`, l'app et la passerelle Mola.
- **Isolation** : `is_admin()` exclut désormais le commercial — une soixantaine de politiques (portefeuilles, dépôts,
  paiements, bénéficiaires, colis, preuves…) et une quinzaine de RPC lui sont fermées d'un coup. Trois politiques qui
  testaient « a une ligne `user_roles` » à la main (portefeuilles, journal d'audit) passent par `is_admin()` (elles
  laissaient aussi passer un admin désactivé). Le commercial n'a que SES RPC, limitées à sa fiche.
- `user_roles.phone` ; `client_sources.staff_user_id` (un compte commercial = une fiche « commercial »).
- Mes équipes : `team_members`, `team_create_member` (compte + fiche en une transaction, tout est vérifié avant de
  créer le compte), `team_update_member` (journalisée ; personne ne change son propre rôle ; il reste toujours un super
  admin actif ; un commercial qui change de rôle est détaché de sa fiche, qui garde ses clients), `team_link_commercial`.
- Prospects (`prospects`, lecture : ses prospects pour le commercial, tous pour le responsable ; aucune écriture
  directe) : créer, modifier, statut, confier à un autre, rattacher à un client, recherche par numéro (pour pré-remplir
  l'origine d'un nouveau client). Un compte client créé avec le numéro d'un prospect est attribué à son commercial et le
  prospect passe « devenu client » (déclencheur `prospect_match_client`, jamais bloquant).
- `set_client_source` : la même origine ne réécrit plus l'auteur ni la date ; chaque changement est journalisé.
- Objectifs du mois (`commercial_objectives`) ; `commercial_dashboard`, `commercial_clients`, `sales_overview`
  (clients, paiements terminés, fret avion en kg, bateau en m³, prospects — mois de Douala).
- Aucune donnée existante modifiée. Testée sur Postgres 16 : fichier passé deux fois dans une transaction, 105 contrôles ;
  contrôle des prérequis éprouvé.

**Comment pousser :**
1. partie B de `migrations/20261005_consolidated.sql`, à coller dans l'éditeur SQL (contrôle des prérequis en
   tête, rejouable) ;
2. `npx supabase migration repair --status applied 20261005160000` ;
3. `/gen-types` (les types des deux tables et de l'énumération sont déjà ajoutés à la main ; l'app appelle les RPC sans
   attendre) ;
4. **`npx supabase functions deploy admin-assistant` AVANT de créer le premier commercial** : la passerelle déployée
   aujourd'hui donnerait à un rôle inconnu les droits d'un chargé de clientèle (avec lecture de toute la plateforme par
   les outils de Mola). La nouvelle version refuse le commercial et tout rôle inconnu ;
5. app BONZINI HQ : `cd hq-app && npm run update:production` (le rôle commercial, l'espace `/v`, ses onglets).

### `20261005170000_air_packages.sql` (à passer APRÈS `20261005150000`)
**PR :** Cargo aérien › les paquets de 32 kg, de Guangzhou à Douala · LTA provisoire
**Contenu :**
- `air_packages` (numéros `PQ-000001`…, lecture RLS réception / cargo / Douala, aucune écriture directe) et
  `parcels.air_package_id`.
- Un colis emballé suit son paquet : jamais en conteneur, jamais chargé ni retiré seul d'une expédition (déclencheur
  `parcels_package_guard`) ; la réception ne le modifie plus tant qu'il est dans un paquet.
- RPC `air_package_*` (toutes `@mola`) : créer, lister, trouver (scan), ajouter / retirer un colis (colis avion, pesé,
  avec client, 32 kg au plus), fermer (pesée brute ≤ 32 kg, dimensions), rouvrir, supprimer un paquet vide, affecter à
  une expédition / l'en retirer, scanner au départ, refus de l'aéroport (avant ou après le départ : le paquet sort avec
  ses colis, ré-affectable), réception et ouverture à Douala (pointer un colis ouvre son paquet).
- `cargo_air_set_status` : pas de départ tant qu'un paquet n'est pas scanné ; une arrivée déjà travaillée à Douala ne
  s'annule plus. Fiches expédition / colis / arrivée : leurs paquets.
- LTA provisoire : `cargo_air_create` avec une LTA vide (et une date de départ) ouvre l'expédition en `PROV-…` ; la
  vraie LTA se pose ensuite, même après le départ. Une LTA provisoire ne s'affiche jamais « PROV-… » : journée de
  Douala (`warehouse_day`), messages aux clients au départ / à l'arrivée (`air_shipments_notify` : référence = la LTA,
  sinon le vol, sinon les dépôts), notification de l'équipe (`staff_push_on_air_arrival`).
- Relecture du 05/10 : annuler une arrivée (`ARRIVED → DEPARTED`) verrouille d'abord ses colis puis ses paquets (un
  pointage concurrent ne passe plus entre le contrôle et l'écriture) ; `reception_deposit_json` dit le paquet de
  chaque colis ; les anciens chargements à l'unité (`cargo_load_parcels`, `cargo_air_load_parcels`) sautent un colis
  emballé au lieu d'annuler tout le lot, `cargo_air_unload_parcel` le refuse proprement ; étiquettes `@mola` des
  envois alignées sur le droit réel (`canReceiveParcels` : réception de Guangzhou ou cargo).
- Testée sur Postgres 16 (schéma cargo réel) : fichier passé deux fois dans une transaction, 79 contrôles, et les 61
  contrôles du lot remise / vols repassés avec ce lot ; contrôle des prérequis éprouvé (refuse de passer sans la
  migration remise / vols).

**Comment pousser :** partie C de `migrations/20261005_consolidated.sql`, puis
`npx supabase migration repair --status applied 20261005170000`, puis `/gen-types`, puis l'app BONZINI HQ
(`cd hq-app && npm run update:production` : le scan d'un `PQ-…` ouvre le paquet à Guangzhou, le reçoit à Douala),
et `npx supabase functions deploy admin-assistant` (Mola connaît les paquets — même redéploiement que le lot précédent).

## Appliquées

_Vérifié en production le 05/10/2026 (objets présents dans la base). Les détails ci-dessous restent pour l'historique._

- `20261005120000_client_sources.sql` — sources des clients et suivi des commerciaux (PR #224), appliquée le 05/10.
- Les 9 migrations du dossier conteneur (`migrations/20261004_consolidated.sql`, PR #223).
- Les migrations douane (29-30/09, PR #214) et `20260926100000_staff_push_notifications.sql` (BONZINI HQ).

### ✅ `20261003120000_cargo_quote_document_fields.sql`
**PR :** Devis refait sur le modèle de la packing list client
**Contenu :**
- `cargo_quote_json` (helper interne du devis) redéfinie en **ajoutant** des clés, pour que le devis PDF dise ce que le
  client connaît déjà de sa packing list — dimensions, fournisseur, conteneur ou vol :
  - en tête : `supplier_kind`, `supplier_name` (le fournisseur du dépôt), `received_by_name` (le réceptionnaire à
    Guangzhou) ; `containers[]` (les conteneurs où sont chargés des colis du dépôt, chacun une fois, triés par numéro :
    B/L, armateur, navire, voyage, POL / POD, départ et arrivée — le réel s'il est connu, sinon l'annoncé) et
    `flights[]` (les vols, de la même façon, triés par LTA) ; `[]` quand rien n'est chargé ;
  - par ligne : `length_cm`, `width_cm`, `height_cm`, `courier_waybill`, `container_number`, `awb_number` (comme
    `reception_deposit_json`).
- Aucune clé existante ne change (nom, valeur, ordre des lignes et des paiements) ; aucune table ni colonne créée,
  aucune donnée modifiée. Même signature, même retour `jsonb`, même étiquette `@mola` (`expose:false`) : helper réservé
  au staff, `REVOKE` anon / authenticated conservés. Toutes les RPC `cargo_quote_*` qui la renvoient (devis,
  encaissement, facture, portefeuille) portent les nouvelles clés sans changer elles-mêmes.
- Testée sur un Postgres 16 local : l'ancienne fonction posée et sa sortie capturée sur trois devis (dépôt de trois colis
  — deux dans un conteneur, un dans un vol — avec 3 lignes colis + 1 frais + 1 encaissement ; dépôt sans chargement ;
  dépôt à deux conteneurs et deux vols), puis le fichier consolidé passé deux fois dans une transaction (`psql -1`) :
  chaque devis moins les nouvelles clés est identique à l'ancienne sortie, valeurs attendues, conteneurs / vols
  distincts et triés, `[]` sans chargement, attributs et droits inchangés (40 contrôles). Contrôle des prérequis
  éprouvé (colonne, table ou fonction retirée → arrêt net qui nomme le manque, rien de modifié).

**Comment pousser :** appliquée par le workflow `deploy-edge-functions.yml` au merge (si `SUPABASE_DB_PASSWORD` est
posé), sinon coller `migrations/20261003_consolidated_devis.sql` dans l'éditeur SQL (contrôle des prérequis en
tête, rejouable) — ou `npx supabase db push --linked` —, puis `npx supabase migration repair --status applied
20261003120000` (après un collage seulement), puis `/gen-types` (hygiène : signature et type de retour inchangés ; les
nouvelles clés sont typées dans `src/lib/cargoQuote.ts`). L'app fonctionne avant la migration : le devis PDF masque
simplement les dimensions, le fournisseur et le conteneur / vol tant qu'elle n'est pas passée.

### ✅ `20261002100000_reception_full_control.sql`
**PR :** Cargo › Réception refaite — dépôts et colis d'abord, plusieurs photos par colis, contrôle total
**Contenu :**
- `parcel_photos` (N photos par colis, RLS lecture staff, aucune écriture directe) ; les photos existantes y sont
  recopiées comme couvertures, et `parcels.photo_path` reste la couverture (trigger) — étiquettes, Douala inchangés.
- `parcel_deposits` : `cancelled_at / cancelled_by / cancel_reason` (suppression douce) et `last_seq` (un numéro de
  colis supprimé n'est jamais redonné : il peut déjà être imprimé sur une étiquette).
- `reception_add_parcel` et `reception_update_parcel` prennent `p_photo_paths` (l'ancienne signature est retirée ;
  les apps déjà ouvertes qui envoient `p_photo_path` continuent de marcher). L'équipe cargo ajoute un colis à un dépôt
  fermé ; un colis chargé en avion ne se modifie plus (seul le conteneur était vérifié).
- Nouvelles RPC, toutes étiquetées `@mola` : `reception_add_parcel_photos`, `reception_remove_parcel_photo`,
  `reception_set_parcel_cover`, `reception_update_deposit`, `reception_cancel_deposit`, `reception_restore_deposit`,
  `reception_board` ; `reception_remove_parcel(uuid, text)` (motif) remplace `reception_remove_parcel(uuid)`.
- Testée sur un Postgres local (droits réceptionnaire / support / admin, devis réglé, colis chargé, annulation puis
  rétablissement, journal) et idempotente (deux exécutions successives).

- Garde-fous d'un dépôt supprimé (triggers) : ni chargement, ni envoi, ni facture, ni encaissement — portefeuille compris.

**Comment pousser :** appliquée par le workflow `deploy-edge-functions.yml` au merge (si `SUPABASE_DB_PASSWORD` est
posé), sinon coller `migrations/20261003_consolidated_reception.sql` dans l'éditeur SQL (contrôle des prérequis en
tête, rejouable), puis `npx supabase migration repair --status applied 20261002100000`. Enfin `/gen-types` (les écrans
passent par `rpcJson` en attendant).

### ✅ `migrations/20260918_consolidated.sql` (= `20260918100000_wallet_overdraft.sql` + `20260918110000_payment_cancel_reason_and_edit.sql`)
**PR :** Découvert autorisé · relevé par période · annulation / modification de paiement · formulaire client
**Contenu :**
- `wallets.overdraft_limit_xaf` + contrainte `balance_xaf >= -overdraft_limit_xaf` ; `admin_set_wallet_overdraft`
  (super admin, `canGrantOverdraft`) ; six RPC de débit redéfinies avec ce plancher.
- `cancel_payment(uuid, text)` (motif, même paiement effectué) — l'ancienne `cancel_payment(uuid)` est supprimée ;
  `admin_correct_payment` ouverte aux agents `canProcessPayments` sur un paiement en cours.
- Testée sur un Postgres local (16 scénarios) et idempotente (deux exécutions successives).

**Comment pousser :** coller `migrations/20260918_consolidated.sql` dans l'éditeur SQL, puis `/gen-types`
et redéployer l'edge function `admin-assistant` (nouvelle permission dans sa matrice, outil `cancel_payment` avec motif,
outil `generate_rate_flyer` avec `country_key` pour le flyer Gabon…) ainsi que `generate-flyer` (pilule « Taux du jour · Gabon »).
Aucune migration SQL pour les taux par pays : ils réutilisent `rate_adjustments` / `update_rate_adjustment`.


### ✅ `20260607120000_mola_operations_radar_and_daily_digest.sql`
**PR :** Mola — profondeur + radar partagé + digest auto
**Contenu :**
- `mola_operations_radar(...)` — RPC **lecture seule**, étiquetée `@mola` : dépôts en
  attente trop vieux, paiements en souffrance, soldes dormants, taux perso récents
  (noms + montants + ancienneté). Source de vérité partagée Mola + cron.
- `run_mola_daily_digest()` + cron `mola-daily-digest` (06:00 UTC = 07:00 Douala) —
  résumé Telegram quotidien. **Inerte** tant que les secrets Vault ne sont pas posés.

**Comment pousser :**
```bash
npx supabase db push --linked
# puis régénérer les types (hygiène — la RPC read n'est pas dans la parité des écritures) :
npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts
```

**Pré-requis (déjà en place sur ce projet) :** extensions `pg_cron` et `pg_net` activées
(utilisées par `run_email_drainer`).

**Pour ACTIVER le digest** (sinon il reste inerte, sans erreur) — Project Settings → Vault :
| Secret Vault | Valeur |
|---|---|
| `telegram_bot_token` | même valeur que le secret Edge `TELEGRAM_BOT_TOKEN` |
| `telegram_chat_id` | même valeur que `TELEGRAM_CHAT_ID` |

**Ordre conseillé :** pousser cette migration **avant** de merger la PR (le merge
redéploie `admin-assistant`, qui appelle la RPC ; un repli évite toute casse si l'ordre
est inversé).

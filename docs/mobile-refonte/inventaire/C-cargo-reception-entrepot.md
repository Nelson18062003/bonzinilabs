# Module C — Cargo, Réception (Guangzhou), Entrepôt (Douala)

> Carte lecture seule du code au 21/10/2026 (branche de travail, sans les modifications non commitées d'un autre agent). Référence : le **desktop** (≥ 1024 px). Modèle métier : `docs/cargo/MODELE-OPERATIONNEL.md` — Bonzini reçoit, mesure, emballe (paquets avion 32 kg) et charge lui-même ; le transitaire fait booking, camion et douane export ; Douala pointe puis remet contre paiement.

## 1) Résumé

1. Le module **Cargo** (`/m/cargo*`, `canViewCargo`) a trois parties, avec un sélecteur commun (`CargoParts`) : **Container** (maritime : flotte, dossier en 9 onglets), **Avion** (expéditions LTA + paquets PQ) et **Réception** (dépôts RC et colis vus par l'équipe). Les écritures demandent `canManageCargo`, les prix `canPriceParcels`, l'encaissement `canCollectParcelPayments`.
2. Deux **apps de rôle** n'existent que sur mobile : **/r** pour le réceptionnaire de Guangzhou (`canReceiveParcels` : saisie des dépôts, colis, photos, étiquettes, paquets avion) et **/w** pour l'entrepôt de Douala (`canReceiveAtDestination` / `canReleaseParcels` : pointage, encaissement, remise signée, bon de retrait).
3. Sur le **dossier conteneur**, la parité est bonne parce que les mêmes onglets sont réutilisés : Documents, Douane, Chargement 3D, Clients, Intervenants et Coûts. Il manque au mobile la vue **Suivi** (escales, jalons, arrivées confrontées) et trois corrections : position manuelle, arrivée relevée, escales.
4. **Le plus gros écart est la Réception.** Le desktop est un poste de travail complet : 5 vues, 7 périodes, 7 files, recherche, CSV, sélection en lot (étiquettes, mise en paquet), devis téléchargeable depuis la liste, et une fiche de dépôt avec contrôle total. Le mobile `/m/cargo/reception` n'est qu'un tableau de bord : sa fiche dépôt est en **lecture seule** (attribuer, étiquettes, devis/paiement). Les paquets avion et le passage d'un paquet sur un vol n'existent pas dans le `/m` mobile.
5. **Écarts inverses** (le mobile a, le desktop non) : les **Comptes cargo** (`/m/cargo/comptes`, sans écran sur desktop), le **paiement depuis le solde** (`cargo_quote_pay_from_wallet`), la liste « À faire cette semaine », les liens directs d'une tâche vers sa section, et le scan à la douchette dans « Charger dans l'avion ».

## 2) Écrans (desktop vs mobile)

Les gardes de rôle : `canViewCargo` = super_admin, ops, support, customer_success. `canManageCargo` / `canPriceParcels` / `canCollectParcelPayments` / `canReceiveParcels` / `canReleaseParcels` / `canReceiveAtDestination` = super_admin + ops, **plus** receptionist (`canReceiveParcels`) et warehouse_agent (`canReceiveAtDestination`, `canReleaseParcels`, `canCollectParcelPayments`). Les Comptes cargo demandent `canEditClients` pour écrire.

### 2.1 `/m/cargo` — Container (la flotte)
- **Desktop** : `DesktopCargoScreen.tsx`. On y trouve les onglets Container · Avion · Réception (avec leurs compteurs, `cargo_parts_summary`) et le bandeau de veille (`DisruptionStrip`). L'en-tête donne « N conteneurs suivis · X arrivent cette semaine » avec les boutons **CSV**, **Carte** et **Suivre un conteneur**.
  - Files : Tous / En mer / Arrivent sous 7 j / À régler (fret non réglé ou télex non reçu) / Sans suivi.
  - Recherche (client, conteneur, B/L, navire, port) et listes déroulantes Armateur et Destination.
  - Table : Client (armateur · B/L), Conteneur, Navire (voyage), Arrivée (port · date, source, retard « +N j · promis… »), Statut, À faire (« N étapes · urgent » / « Prêt »). Tri par client ou par arrivée ; clavier ↑↓/j/k, Entrée.
  - Un clic sur une ligne ouvre `CargoQuickView` : en-tête du dossier et ses actions, « Où est-il ? » (position AIS, vitesse), « Quand arrive-t-il ? » (barre de progression), le parcours et les 3 premières tâches. Bouton « Ouvrir le dossier complet ».
- **Mobile** : `MobileCargoScreen.tsx`. En-tête « Cargo · N conteneurs · X en retard » avec deux icônes, Carte et Chercher une référence. Mêmes onglets et même bandeau. Les filtres reposent sur l'**alerte** : Tous / En retard / À surveiller / À l'heure / Livré. La recherche n'apparaît qu'à partir de 8 conteneurs. Le bloc replié « À faire cette semaine » regroupe les tâches urgentes de toute la flotte, chacune liée à sa section du dossier. Chaque carte tient en 4 lignes : client + alerte, « Arrive à … le … », retard, prochaine action. Un toucher ouvre directement le dossier ; il n'y a pas d'aperçu rapide.

### 2.2 `/m/cargo/:shipmentId(/:tab)` — Dossier conteneur
- **Desktop** : `DesktopCargoDossier` → `CargoDossier.tsx`.
  - En-tête `DossierHeader` : « Conteneur de {client} », statut (Réservé / Au départ / En mer / Arrivé / Livré / Sans suivi), copie du n° de conteneur et du B/L, navire, POL→POD, arrivée (relevée / armateur / promise), indicateurs Télex, Fret, BESC.
  - Actions (`DossierActions`) : **Rafraîchir** (`request_cargo_sync`). Le menu ⋯ (`canManageCargo`) propose Marquer le fret réglé ou non réglé, Télex reçu ou non reçu, Renseigner ou modifier le navire (`CargoVesselDialog`), et Retirer de la flotte (confirmation, `remove_cargo_shipment`).
  - Les 9 onglets ont chacun une URL : Aperçu · Suivi · Chargement · Documents · Douane & arrivée · Coûts · Clients · Intervenants · Notes. Le contenu est détaillé en 2.3.
- **Mobile** : `MobileCargoDossier.tsx`. L'en-tête porte le n° copiable, le statut, le B/L copiable, et une phrase « Arrive à … » avec le retard. À droite : Rafraîchir et ⋯, qui ne propose **que** « Retirer de la flotte ».
  - Le contenu est un **accordéon de 12 sections**, une seule ouverte à la fois, chacune avec son URL : À faire · Où est le conteneur · Le trajet · L'argent · Les documents · La douane · Ce qu'il y a dedans · Le chargement en 3D · Les clients du groupage · Les intervenants · Les coûts · Les notes. Les adresses desktop `apercu`, `suivi` et `documents` sont traduites vers les sections mobiles.

### 2.3 Les onglets du dossier, et leur pendant mobile
| Onglet desktop | Contenu desktop | Mobile |
|---|---|---|
| **Aperçu** (`TabApercu`) | Où est-il (source et âge de la position, tag « ancienne ») ; arrivée avec sa source et la note de l'équipe ; boutons **Mettre à jour la position**, **Corriger l'arrivée**, **Voir en direct** (MarineTraffic) ; carte `VoyageMap` de la dernière étape ; À faire ; Parcours (`CargoJourney`) avec les faits Départ réel / Arrivée promise / armateur / retenue et **Modifier les escales** ; résumés Argent, Intervenants clés (appel, WhatsApp), Classeur (pièces complètes), Marchandise (boîte, poids, colis, véhicules, m³), chacun avec un lien vers son onglet | « À faire » : liste dont chaque ligne mène à sa section. « Où est le conteneur » : phrases, Renseigner/Modifier le navire (`MobileNavireSheet` : nom, IMO, MMSI, voyage, ETA armateur ; passe en `AT_SEA` si le dossier était « sans suivi »), Voir sur la carte (`?vessel=IMO`), MarineTraffic. **Absents** : position manuelle, correction de l'arrivée, carte intégrée, résumés intervenants et classeur |
| **Suivi** (`TabSuivi`) | Escales (fait / en cours / prochaine / à venir) + **Modifier** (`CallsDialog` : ajouter, monter/descendre, retirer, notes) ; jalons de l'armateur sans doublons ; les arrivées Promise / Armateur / Relevée / Retenue + **Corriger** ; **Marquer arrivé** (date, note) et **Annuler l'arrivée** (motif obligatoire) ; estimations successives ; dernier mouvement | « Le trajet » : phrases départ/arrivée/retard, `CargoJourney`, **Marquer le conteneur arrivé** / **Annuler l'arrivée**, les 4 derniers jalons réels en phrases, les jalons prévus. **Absents** : liste et édition des escales, correction de l'arrivée, historique des estimations, dernier mouvement |
| **Chargement** (`TabChargement`) | 3D (`Container3D`), lots (Ajouter / Modifier / Retirer un lot : type, quantité, L×l×H, m³, kg, propriétaire, code SH, gerbable, note), jauges de remplissage, « Ce qui ne colle pas », « À qui sont les lots » ; `LoadedParcelsSection` : colis venus de la Réception, **Charger des colis reçus** (dialogue, `?charger=1`), **Sortir de la boîte**, **Avis d'expédition (PDF)** | Même composant dans « Le chargement en 3D ». En plus, la section « Ce qu'il y a dedans » (`Inside`) donne un résumé, **Charger des colis reçus** → `/charger-colis`, **Avis d'expédition (PDF)** et **Voir le chargement en 3D** : **le geste existe deux fois** |
| **Documents** (`TabDocuments`) | Classeur : recherche ; **Déposer sans classer** ; **Nouvelle pièce** (titre, catégorie, note) ; **Préparer les pièces habituelles** (`StarterDialog`) ; dépôt de fichiers par pièce (PDF ou image, 10 Mo, plusieurs, glisser-déposer) ; aperçu `DocPreview` ; Télécharger ; Renommer/déplacer ; Supprimer le fichier ; Modifier/Supprimer la pièce (garder ou supprimer les fichiers) | Composant identique (« Les documents ») |
| **Douane & arrivée** (`TabDouane`) | **Préparer les étapes** ; étapes par phase (état à faire / en cours / fait / sans objet, échéance, date faite, référence, note, pièce liée) ; **Ajouter une étape** ; **Modifier / Supprimer** ; bascule fait en un clic ; **Joindre les pièces** ; franchise au port (dépassée ou proche) ; Références ; « L'ordre des choses » | Composant identique (« La douane, étape par étape ») |
| **Coûts** (`TabCouts`) | Totaux par devise ; **Estimer le coût à quai** → `/m/cargo/cout?shipment=` ; **Ajouter un coût** (catégorie, montant, devise USD/CNY/EUR/XAF, date, bénéficiaire, réf. facture, payé le, note, justificatifs) ; bascule payé ; Modifier / Supprimer ; Joindre un justificatif ; « Fret annoncé » **Modifier** (`FreightDialog`) et **Saisir la facture** | Composant identique (« Les coûts ») |
| **Clients** (`TabClient`) | Clients du groupage (lots, colis, m³, part du fret) ; « Lots sans propriétaire » → **Attribuer** (nom, fiche client, Retirer) ; « Colis reçus à l'entrepôt » ; « Dossier au nom de » **Rattacher / Détacher** ; Ouvrir la fiche client ; « Ses autres conteneurs » | Composant identique |
| **Intervenants** (`TabIntervenants`) | Groupés Chine / transport / Cameroun / destinataire ; **Ajouter un intervenant** (depuis l'annuaire `cargo_parties` ou fiche nouvelle) ; rôle ; Modifier ; Retirer (confirmation) ; appeler, WhatsApp, mail | Composant identique |
| **Notes** (`TabNotes`) | Note interne enregistrée en quittant le champ ; état du dossier (création, modification, source du suivi, dernière synchro, erreur de synchro) | `MobileNotes` : même note, l'état du dossier en phrases |

### 2.4 `/m/cargo/track` — Suivre un conteneur
- **Desktop et mobile** (`DesktopCargoTrack`, `MobileCargoTrack`) : saisie d'une référence (B/L, booking, conteneur), détection de l'armateur, puis **Interroger** (`request_cargo_lookup`) et lecture du résultat (`cargo_lookups`). Chaque conteneur trouvé affiche ses jalons et le bouton **Ajouter à ma flotte** (client, fret USD, ETD/ETA promis, `add_cargo_shipment`, `canManageCargo`), ou « Déjà dans la flotte · ouvrir ». Sans résultat : **Ajouter quand même** (`CargoManualAddDialog`, `create_cargo_shipment_manual`) ou Réessayer. Suivent la liste des armateurs couverts (Maersk et CMA CGM en direct, MSC et COSCO plus tard) et les dernières recherches. Parité ; le mobile ajoute « Interroger quand même » quand la référence est déjà connue.

### 2.5 `/m/cargo/map` — Carte
- **Desktop** (`DesktopCargoMap`) : panneau synchronisé (recherche ; filtres Tous / En mer / Sous 7 j / À régler / Sans position ; conteneurs groupés par navire, le survol les met en évidence) et carte (`CargoMap`) avec couches Trajets / Ports / Étiquettes, vue globe, Tout voir, plein écran.
- **Mobile** (`MobileCargoMap`) : carte plein écran aux couches figées. Toucher un navire ouvre une feuille avec ses conteneurs ; `?vessel=` l'ouvre directement. Ni recherche, ni filtres, ni réglage des couches.

### 2.6 `/m/cargo/cout` — Coût à quai
- Même composant `MobileCargoCout` (`desktop`), un calculateur en 6 questions : valeur et devise, poids, incoterm, taux de droit, TVA, frais. Il donne une fourchette, sans aucune écriture. Il est prérempli quand on arrive avec `?shipment=` ; sur mobile, on n'y accède que depuis « Les coûts ».

### 2.7 `/m/cargo/avion` (+ nouveau, :id, modifier, charger) — Avion
- **Desktop** (`DesktopCargoAir`) : en-tête (N en cours · colis · kg · en vol) et **Nouvelle expédition** (`ShipDialog` en mode création : fiche du vol + paquets fermés à cocher, `cargo_air_create` puis `air_package_assign`). Un bandeau signale les paquets fermés en attente d'un vol, avec **Voir les paquets** (→ Réception, vue paquets) et **Mettre sur un vol**.
  - Files : En cours / Préparation / En vol / Arrivés / Tous. Table : LTA (« LTA à venir » tant qu'elle est provisoire), Vol, État, Départ, Arrivée, Colis, Poids, m³, Clients, Paiement (« N non soldés » / « Tout payé »).
  - La ligne ouvre `AirQuickView` : **Avis d'expédition (PDF)**, **Fiche** (→ modifier), **Pas parti** (retour en préparation), le bouton de jalon suivant avec confirmation (« L'avion est parti » / « L'avion est arrivé à Douala », `cargo_air_set_status`), le compteur « paquets scannés ». On y trouve aussi les faits (départ, arrivée, fret, clients) et `AirPackagesPanel` : Ajouter des paquets, Scan au départ, Retirer, Refusé à l'aéroport (motif).
  - Les colis sont groupés par client avec leur devis. **Charger des colis** se fait en ligne (`cargo_air_load_parcels`) ; Retirer un colis (`cargo_air_unload_parcel`) n'est possible qu'en préparation et hors paquet.
  - `/nouveau` et `/:id/modifier` affichent `MobileCargoAirForm desktop` ; `/:id/charger` affiche la page Avion avec le dialogue, **sans mode chargement automatique**.
- **Mobile** : `MobileCargoAir` liste les expéditions (filtres, cartes LTA · vol · dates · colis/paquets/kg/clients/non soldés, + Nouvelle). `MobileCargoAirForm` : LTA, ou « LTA pas encore connue » qui oblige à donner l'ETD ; compagnie, vol, ETD, ETA, fret USD, notes. `MobileCargoAirDetail` : jalon suivant, avis PDF, Fiche, Pas parti, `AirPackagesPanel` (variante mobile), colis par client, Retirer. `MobileCargoAirLoad` : liste groupée **+ douchette**. Il n'y a **pas** le bandeau « paquets en attente → Mettre sur un vol » ; la création ne propose pas les paquets (on les ajoute ensuite depuis la fiche).

### 2.8 `/m/cargo/comptes(/:accountId)` — Comptes cargo (gros clients regroupeurs)
- **Desktop** : **aucun écran.** La route affiche `DesktopCargoReception`.
- **Mobile** (`MobileCargoAccounts`) : liste (compteurs colis en attente et clients rattachés, comptes fermés masqués ou affichés), **Nouveau compte** et **Corriger** (nom, code, contact, téléphone, note, actif), fiche du compte avec ses clients (→ `/m/clients/:id/parcels`), **Rattacher un client** (recherche) et **Détacher**. RPC `cargo_account_list|clients|upsert|assign`. Accès : `canViewCargo` ou `canViewClients`, écriture `canEditClients`. Seul point d'entrée : un lien dans `/m/cargo/reception`.

### 2.9 `/m/cargo/reception` (+ `:depositId`, `:depositId/devis`) — Réception vue par l'équipe
- **Desktop** (`DesktopCargoReception`, 844 lignes) :
  - En-tête : « N colis à l'entrepôt et au bureau · m³ · kg · clients · X à attribuer » (raccourci), recherche (RC, BZ, client, bordereau, contenu ; PQ, LTA en vue paquets), **Période** (En stock / Aujourd'hui / 7 j / 30 j / 90 j / Tout / Supprimés) ou Portée des paquets (Au bureau / 300 derniers), **langue des devis FR | EN**, **CSV** (dépôts, colis ou paquets selon la vue).
  - Indicateurs : Colis, Poids (sans poids → file), Volume (sans dimensions), Photos (sans photo).
  - **Vues** : Dépôts · Colis · Photos · Par client · Paquets avion. Lieu : Partout / Entrepôt · Sea / Bureau · Air. **Files** : Tous / En attente / Partis / À attribuer / Incomplets / Sans photo / En cours. Filtre « Reçu par ». Pagination (40 / 80 / 16).
  - *Dépôts* : case à cocher, dépliage sur les colis, n° et date, réceptionnaire, client, colis, miniatures (visionneuse), poids et m³, état, colonne **Devis** (télécharger le PDF du devis depuis la liste), Étiquettes du dépôt. Les colis dépliés montrent leur pastille de paquet et ouvrent le paquet.
  - *Colis* : cases à cocher, photo, n°, contenu, poids, volume, client, état.
  - *Photos* : un mur par dépôt.
  - *Par client* : stock par client et par lieu (→ `ClientParcelsQuickView`, avec **Relevé des colis (PDF)** et Ouvrir la fiche client).
  - *Paquets avion* : `DesktopPackagesView`, détaillé en 2.10.
  - **Barre de sélection** (Dépôts ou Colis) : **Mettre en paquet** (`PackDialog`), **Étiquettes (PDF)** et **Imprimer**, 200 au plus.
  - Sous la liste : la carte **À Douala** (à pointer, attendent, remis aujourd'hui, manquants, 5 clients en attente, lien vers l'app `/w`) et **Par réceptionnaire** (colis, kg, m³, incomplets, à attribuer ; cliquer filtre la liste).
  - **Fiche dépôt** (`DepositQuickView`, route `/:depositId?colis=&paquet=`). Gestes : **Bon de réception** (PDF), **Étiquettes** (`DepositLabelsDialog` : cocher les colis, aperçu, PDF, imprimer, PNG), **Étiquette client**, **Ajouter un colis** (`ParcelEditorDialog`), **Modifier le dépôt** (`DepositEditDialog` : lieu, apporté par, représentant, fournisseur complet, notes, avec journal avant/après), **Photos (N)**, **Supprimer** (motif, `ReasonDialog`) ou **Rétablir**.
  - Contenu de la fiche : Client (**Attribuer** ou **Réattribuer**, recherche ; avertit que les étiquettes sont à réimprimer), « La réception » (apporté par, reçu par, reçu le, total, fournisseur, notes), table des colis (photos, contenu, dimensions, état lié au conteneur), puis par colis : voir les photos, étiquette PDF, **Modifier** (photos ajoutées, couverture, retirées, mesures, bordereau, état à la réception, copies), **Supprimer** (motif).
  - Ensuite `QuoteSection` (`canPriceParcels`) : ouvrir le devis, prix par ligne (kg, m³ ou forfait), Frais / Remise, Retirer une ligne, PDF dans la langue choisie, Partager, **Envoyer / Renvoyer le devis**. Puis `QuotePaymentsSection` (`canCollectParcelPayments`) : encaisser (montant, mode, lieu, date, référence, preuve), Reçu PDF / Partager, Annuler un encaissement (motif), Établir la facture et la télécharger. Enfin les **bons de retrait** et l'**historique**.
- **Mobile** :
  - `MobileCargoReception` : « Cargo · N colis … » ; Lieu Partout / Entrepôt / Bureau ; 4 cartes (attendent, clients, poids, volume) ; liste par client (→ `/m/clients/:id/parcels`) ; lien **Comptes cargo** ; **À Douala** (4 chiffres, clients en attente, Ouvrir l'app) ; **À attribuer** (dépôts) ; **Réceptions** sur Aujourd'hui / 7 j / 30 j avec la répartition par réceptionnaire et la liste des dépôts.
  - `MobileCargoDepositDetail` : client (→ fiche), statut, apporté par, mode, reçu le, par, total, fournisseur ; **Attribuer à un client** (seulement si le dépôt est orphelin) ; **Étiquettes des cartons** (`InternalLabelSheet` : aperçu, PDF, PNG, partage) ; carte **Prix et devis** (→ `/devis`) ; colis (photo en grand, état → section « dedans » du conteneur) ; `QuotePayments` ; bons de retrait ; historique.
  - `MobileCargoQuote` : Bon de réception et devis (PDF, partage, langue), lignes par colis (base et prix), Frais et remises (feuille), Envoyer, Facture (PDF, partage).
  - `QuotePayments` : Encaisser (feuille : montant, mode **dont le solde du client**, lieu, preuve photo, référence, date, note), reçus, Annuler (motif), Facture.

### 2.10 Paquets avion (desktop dans Réception, mobile seulement dans /r)
- **Desktop** : `DesktopPackagesView` + `PackageWorkbench` (`?paquet=`) + `PackDialog` + `ShipDialog`.
  - **Nouveau paquet** et **Ouvrir un paquet : PQ-…** (champ de scan). Paquets groupés par état : En cours / Fermé / Remis au départ / Refusé à l'aéroport / Reçu à Douala / Ouvert à Douala, avec cases à cocher, puis **Mettre sur un vol**. Colonne « Colis avion à emballer » par client, **Mettre en paquet** ; colis bloqués expliqués, un clic ouvre leur dépôt.
  - Fiche paquet (`PackageWorkbench`) : jauge 32 kg, scan douchette avec bips, colis prêts filtrables → Ajouter, Retirer.
  - Gestes de la fiche : **Fermer le paquet (pesée)** (poids pesé, dimensions facultatives), puis l'étiquette PQ en **PDF / Imprimer / PNG** ; **Rouvrir** ; **Supprimer ce paquet vide** ; **Mettre sur un vol** ; **Commencer un nouveau paquet** ; lecture seule si le paquet est déjà sur une expédition ou refusé.
- **Mobile /m** : aucun. `AirPackagesPanel` renvoie vers `/r/paquets`, et seulement si l'on a `canReceiveParcels`.

### 2.11 `/m/more/shipping` et `/m/more/cargo-pricing` — Réglages
- `MobileShippingSettings` (desktop : « Expédition · Chine » ; mobile : « Étiquette colis ») : société (nom latin et chinois, mail, téléphone, WeChat, WhatsApp), entrepôt et bureau (adresse en chinois et en anglais, destinataire, téléphone, WeChat, WhatsApp, mail). Écriture `canManageUsers` via `update_platform_setting` (clé `shipping`).
- `MobileCargoPricing` (« Tarifs cargo ») : XAF/kg pour l'Air et XAF/m³ pour le Sea, avec exemples calculés (`cargo_pricing_set`, `canManageRates`).
- Mêmes écrans sur les deux supports. Seule entrée : `/m/more/settings` (section « Expédition »).

### 2.12 App Réception `/r/*` (mobile seule, `canReceiveParcels`, FR/EN/ZH)
- Coquille `ReceptionRouteWrapper` : si le lieu n'est pas choisi, `LocationGate` le demande (entrepôt = bateau, bureau = avion, mémorisé sur l'appareil). Onglets web : Aujourd'hui · Nouveau · Paquets (pastille au bureau) · Clients · En attente (pastille). Onglets de l'app HQ : Aujourd'hui · Paquets · **Scanner** · Clients · En attente.

| Route | Écran | Contenu et actions |
|---|---|---|
| `/r/login` | ReceptionLogin | connexion |
| `/r` | ReceptionHome | bonjour, langue, déconnexion ; lieu + **Changer** (feuille) ; **Nouveau dépôt** ; « Comment ça marche » ; bandeau « N en attente » ; journée navigable jour par jour (dépôts, colis, kg, m³), puis les dépôts → fiche |
| `/r/new` | ReceptionIdentify | étape 1/4 : caméra QR client (`reception_client_by_code`), bordereau scanné gardé ; **Chercher par nom**, **Sans client** ; en mode `?assign` : Voir le dépôt, Rescanner, Retour |
| `/r/new/search` | ReceptionSearch | recherche (`reception_search_clients`) ; **Nouveau client** ; en mode assign : attribue (`reception_assign_client`) |
| `/r/new/client` | ReceptionNewClient | formulaire client complet (`useCreateClientForm`), mot de passe provisoire + WhatsApp, puis Continuer le dépôt / Commencer un dépôt / Attribuer / Voir la fiche |
| `/r/new/how` | ReceptionBroughtBy | étape 2/4 : transporteur / le client / quelqu'un pour lui (nom, téléphone) / Bonzini ; lieu si inconnu ; **Continuer** → `reception_open_deposit` |
| `/r/deposit/:id/supplier` | ReceptionSupplier | étape 3/4 : fournisseurs récents du client, fournisseur ou agent d'achat, nom, contact, téléphone, + email, WeChat, adresse ; **Passer** (`reception_set_supplier`) ; `?edit` pour corriger |
| `/r/deposit/:id` | ReceptionDeposit | fiche du dépôt en cours ou terminé ; « chez un collègue » = lecture seule ; « devis engagé » = verrouillé ; fournisseur → corriger ; **Attribuer** ; **Ajouter un colis** ; **Terminer (N)** (confirmation, `reception_close_deposit`) ; retirer un colis (confirmation) ; **Abandonner** un dépôt vide ; **Imprimer les étiquettes** (`InternalLabelSheet`) |
| `/r/deposit/:id/parcel(/:pid)` | ReceptionParcel | assistant en 5 écrans : photos (plusieurs, état à la réception bon / abîmé / ouvert / mouillé + note) → poids → dimensions (m³ calculé) → contenu + bordereau → nombre de copies ; en correction : étapes réduites, retirer une photo enregistrée (`reception_add_parcel`, `reception_update_parcel`, `…_photos`, `reception_set_parcel_condition`) |
| `/r/deposit/:id/done` | ReceptionDone | reçu (colis, kg, m³, mode, apporté par, date, par) ; **Imprimer les étiquettes** ; sans client : **Attribuer maintenant** ; **Dépôt suivant** / Terminer |
| `/r/pending` | ReceptionPending | dépôts orphelins → **Attribuer** |
| `/r/clients` | ReceptionClients | recherche + clients récents ; **Nouveau client** |
| `/r/clients/:userId` | ReceptionClientCard | code + QR ; **Étiquette client** (`ReceptionLabelSheet` : PNG, PDF, envoi) ; **Nouveau dépôt pour lui** ; ses dépôts |
| `/r/paquets` | ReceptionPackages | à l'entrepôt : une note seulement ; **Continuer PQ-… · reste X kg** ou **Nouveau paquet** ; ligne « N colis attendent un paquet » ; scan ou saisie PQ pour rouvrir ; paquets par état (en cours, refusés, prêts, affectés), avec « ouvert par » |
| `/r/paquets/emballer` | ReceptionPackTodo | colis prêts par client (cases à cocher, Tout / Aucun), bloqués avec leur correction, « plus de 32 kg : à part » ; **Mettre en paquet** (`PackSheet`, découpe automatique) |
| `/r/paquets/:id` | ReceptionPackage | jauge ; scan (bips) ; « trop lourd → fermer et suivant » ; colis par client → Retirer ; **Fermer (pesée)** ; **Supprimer** si vide ; **Imprimer l'étiquette** ; **Rouvrir** ; **Paquet suivant**. **Pas de « Mettre sur un vol »** |

### 2.13 App Entrepôt `/w/*` (mobile seule, Douala, FR seul)
- Garde : `canReceiveAtDestination` ou `canReleaseParcels`. Onglets web : Journée · Pointer (pastille) · Remettre (pastille). Onglets HQ : Journée · Pointer · Scanner · Remettre (qui pointe sur `/w/remise/liste`, pas sur le scan).

| Route | Écran | Contenu et actions |
|---|---|---|
| `/w` | WarehouseHome | **Pointer une arrivée**, **Remettre à un client** (selon les droits) ; journée : à pointer, attendent leur client, remis aujourd'hui, manquants ; remis aujourd'hui → bon |
| `/w/arrivees` | WarehouseArrivals | « Quelle arrivée ? » avion ou boîte (N à pointer / tout pointé) ; `?paquet=PQ` reçoit le paquet (`air_package_receive`) puis mène au pointage |
| `/w/arrivees/:kind/:id` | WarehouseCheckin | progression ; saisie ou scan d'un n° ; toucher une ligne = pointé OK (`warehouse_checkin_parcel`) ; place de rangement (« B3 ») ; **Tout pointer** (`warehouse_checkin_many`) ; paquets reçus X/Y, **Ouvrir le paquet** (`air_package_open`), « pas arrivé : déclarer ses N manquants » (`warehouse_flag_missing_many`) ; **Terminer le pointage** |
| `/w/arrivees/:kind/:id/colis/:pid` | WarehouseCheckinParcel | « Ce colis est-il là ? » : Oui, en bon état / Oui, mais abîmé (remarque) / Non, il manque (`warehouse_flag_missing`) ; photo prise à Guangzhou |
| `/w/arrivees/:kind/:id/bilan` | WarehouseCheckinDone | bon état, abîmés, manquants, jamais vus ; **Déclarer les N manquants** (confirmation) ; Autre arrivée / Accueil |
| `/w/remise` | WarehousePickup | étape 1/3 : caméra (BZ ou RC), saisie, **Voir qui attend** |
| `/w/remise/liste` | WarehouseWaiting | clients en attente (Payé / Reste X / Sans prix) |
| `/w/remise/:code` | WarehousePickupClient | étape 2/3 : colis prêts cochés, pas encore là (replié), paiements et reçus, bons déjà faits ; **Encaisser d'abord** (`canCollectParcelPayments`) ou **Remettre N colis** |
| `/w/remise/:code/encaisser` | WarehousePay | devis à solder un par un : montant, mode (dont le solde), référence, photo de preuve ; reçu PDF téléchargé + action Partager |
| `/w/remise/:code/qui` | WarehouseHandover | étape 3/3 : le client lui-même, ou nom et téléphone de la personne envoyée |
| `/w/remise/:code/signature` | WarehouseSign | signature au doigt, Effacer, remarque ; **Confirmer la remise** (`warehouse_release_parcels`, refusée si un devis n'est pas soldé) |
| `/w/bon/:releaseId` | WarehouseReleaseDone | bon BR-… ; **Bon de retrait (PDF)** (à envoyer sur WhatsApp) ; détail replié ; Client suivant / Accueil |

## 3) Toutes les actions

« = » : même composant sur les deux supports. « — » : absent. La permission est celle de l'interface ; quand le tag `@mola` de la RPC diffère, il est indiqué entre parenthèses.

| Action | Écran desktop | Écran mobile | RPC / table | Permission |
|---|---|---|---|---|
| Exporter la flotte en CSV | /m/cargo | — | client (`exportToCSV`) | canViewCargo |
| Filtrer armateur / destination, trier | /m/cargo | — | — | canViewCargo |
| Aperçu rapide d'un conteneur | /m/cargo (dialogue) | — (ouverture directe) | `cargo_shipments`, positions, documents | canViewCargo |
| Rafraîchir auprès de l'armateur | en-tête du dossier | en-tête (icône) | `request_cargo_sync` | canViewCargo |
| Fret réglé / non réglé | menu ⋯ | « L'argent » | UPDATE `cargo_shipments.freight_paid` (RPC `cargo_set_freight_paid` existe, non utilisée) | canManageCargo |
| Télex reçu / non reçu | menu ⋯ | « L'argent » | UPDATE `telex_released` (RPC `cargo_set_telex` non utilisée) | canManageCargo |
| Renseigner / modifier le navire | menu ⋯ (`CargoVesselDialog`) | « Où est… » (`MobileNavireSheet`) | UPDATE `cargo_shipments` | canManageCargo |
| Retirer de la flotte | menu ⋯ + confirmation | menu ⋯ + feuille | `remove_cargo_shipment` | canManageCargo |
| Mettre à jour la position (manuelle) | Aperçu (`PositionDialog`) | — | `cargo_set_vessel_position` | canManageCargo |
| Corriger l'arrivée / revenir à l'armateur | Aperçu, Suivi (`EtaDialog`) | — | UPDATE `eta_manual*` | canManageCargo |
| Modifier les escales | Aperçu, Suivi (`CallsDialog`) | — | UPDATE `route_calls` | canManageCargo |
| Marquer arrivé / annuler l'arrivée | Suivi | « Le trajet » | `cargo_mark_shipment_arrived` / `cargo_unmark_shipment_arrived` | canManageCargo |
| Voir en direct (MarineTraffic) | Aperçu | « Où est… » | lien externe | canViewCargo |
| Voir sur la carte (navire) | — | « Où est… » | — | canViewCargo |
| Lot : ajouter / modifier / retirer | Chargement | = | `cargo_packages` | canManageCargo |
| Charger des colis reçus (boîte) | Chargement (dialogue) | « Dedans » → `/charger-colis` + dialogue dans 3D | `reception_loadable_parcels`, `cargo_load_parcels` | canManageCargo |
| Sortir un colis de la boîte | Chargement | = | `cargo_unload_parcel` | canManageCargo |
| Avis d'expédition maritime (PDF) | Chargement | « Dedans » + 3D | client (`deliverSeaNoticePdf`) | canViewCargo |
| Classeur : pièce créer / modifier / supprimer, préparer les pièces habituelles | Documents | = | `cargo_doc_folders` | canManageCargo |
| Fichiers : déposer, renommer/déplacer, supprimer, télécharger, aperçu | Documents, Douane, Coûts | = | storage `cargo-documents` + `cargo_documents` | canManageCargo (lecture canViewCargo) |
| Étapes douane : préparer, ajouter, modifier, supprimer, basculer fait | Douane | = | `cargo_steps` (+ UPDATE shipment) | canManageCargo |
| Coût : ajouter / modifier / supprimer / payé / justificatif | Coûts | = | `cargo_costs` + documents | canManageCargo |
| Fret annoncé : modifier, saisir la facture | Coûts | = | UPDATE shipment, `cargo_costs` | canManageCargo |
| Estimer le coût à quai | Coûts → /m/cargo/cout | = | aucune (calcul) | canViewCargo |
| Attribuer des lots à un propriétaire | Clients | = | UPDATE `cargo_packages` | canManageCargo |
| Rattacher / détacher le dossier à une fiche client | Clients | = | UPDATE `cargo_shipments.client_id` | canManageCargo |
| Intervenant : ajouter (annuaire ou nouveau), modifier, retirer | Intervenants | = | `cargo_parties`, `cargo_shipment_parties` | canManageCargo |
| Note interne | Notes | = | UPDATE `notes` | canManageCargo |
| Suivre une référence | Track | = | `request_cargo_lookup` | canViewCargo |
| Ajouter à la flotte (trouvé / manuel) | Track | = | `add_cargo_shipment` / `create_cargo_shipment_manual` | canManageCargo |
| Carte : couches, globe, tout voir, plein écran, filtres | Map | — | — | canViewCargo |
| Nouvelle expédition avion (+ paquets) | Avion (`ShipDialog`) | formulaire seul | `cargo_air_create` (+ `air_package_assign`) | canManageCargo |
| Corriger la fiche avion | `/modifier` | = | `cargo_air_update` | canManageCargo |
| Jalon avion : parti / arrivé / pas parti | AirQuickView | AirDetail | `cargo_air_set_status` | canManageCargo |
| Charger / retirer des colis (avion) | AirQuickView (en ligne) | `/charger` (+ douchette) / AirDetail | `cargo_air_loadable_parcels`, `cargo_air_load_parcels`, `cargo_air_unload_parcel` | canManageCargo |
| Avis d'expédition avion (PDF) | AirQuickView | AirDetail | client | canViewCargo |
| Ajouter des paquets à un vol | AirPackagesPanel | = | `air_package_assign` | canManageCargo (tag : canReceiveParcels) |
| Mettre des paquets sur un vol (côté paquets) | Avion (bandeau), Réception › Paquets, fiche paquet | — | `cargo_air_create` + `air_package_assign` | canReceiveParcels ou canManageCargo |
| Scan des paquets au départ | AirPackagesPanel | = | `air_package_scan_departure` | canManageCargo (tag : canReceiveParcels ; absent de /r) |
| Retirer un paquet du vol / refusé à l'aéroport | AirPackagesPanel | = | `air_package_unassign` / `air_package_refuse` | canManageCargo |
| Réception : vues, périodes, files, recherche, pagination | Réception | partiel (lieu, 3 périodes, sans recherche) | `reception_board`, `reception_stock`, `reception_overview` | canViewCargo |
| CSV dépôts / colis / paquets | Réception | — | client | canViewCargo |
| Étiquettes en lot (PDF / impression) | Réception (sélection) | — | client (`useParcelLabels`) | canViewCargo |
| Mettre en paquet (sélection) | Réception, Paquets | /r/paquets/emballer | `air_package_create` / `air_package_add_parcel` / `air_package_delete` | canReceiveParcels |
| Télécharger le devis depuis la liste + langue | Réception › Dépôts | — | `cargo_quote_get` + PDF | canViewCargo |
| Relevé des colis d'un client (PDF) | Par client (`ClientParcelsQuickView`) | via /m/clients/:id/parcels (hors module) | client | canViewCargo |
| Bon de réception (PDF) | fiche dépôt | `/devis` | client | canViewCargo |
| Étiquettes du dépôt (sélection, aperçu, PDF, imprimer, PNG) | fiche dépôt (`DepositLabelsDialog`) | fiche dépôt (`InternalLabelSheet` : tout ou PNG d'un carton) ; /r | client | canViewCargo / canReceiveParcels |
| Étiquette client (marque d'expédition) | fiche dépôt | /r/clients/:id seulement | client | — |
| Attribuer un dépôt | fiche dépôt | fiche (si orphelin) ; /r | `reception_assign_client` | canReceiveParcels |
| Réattribuer un dépôt | fiche dépôt | — | `reception_assign_client` | canManageCargo |
| Ajouter un colis | fiche dépôt (`ParcelEditorDialog`) | /r seulement | `reception_add_parcel` (+ photos, état) | cargo, ou propriétaire + dépôt ouvert |
| Modifier un colis (mesures, photos, couverture, état, bordereau) | fiche dépôt | /r seulement (le sien) | `reception_update_parcel`, `reception_add_parcel_photos`, `reception_remove_parcel_photo`, `reception_set_parcel_cover`, `reception_set_parcel_condition` | canReceiveParcels / canManageCargo |
| Supprimer un colis (motif) | fiche dépôt | /r (confirmation, sans motif) | `reception_remove_parcel` | idem |
| Modifier le dépôt (lieu, apporté par, fournisseur, notes) | fiche dépôt | /r : fournisseur seulement | `reception_update_deposit`, `reception_set_supplier` | canManageCargo (tag) / canReceiveParcels |
| Supprimer / rétablir un dépôt | fiche dépôt | /r : abandonner un dépôt vide | `reception_cancel_deposit` / `reception_restore_deposit` | canManageCargo |
| Ouvrir / terminer un dépôt | — | /r | `reception_open_deposit` / `reception_close_deposit` | canReceiveParcels |
| Créer un client (réception) | — | /r/new/client | formulaire client (`reception_set_client_origin`) | canRegisterClients |
| Devis : ouvrir, prix de ligne, frais/remise, retirer, envoyer | fiche dépôt | `/devis` | `cargo_quote_ensure`, `_set_line`, `_add_line`, `_remove_line`, `_send` | canPriceParcels |
| Encaisser (cash, MoMo, virement, autre, preuve) | fiche dépôt | fiche dépôt ; /w | `cargo_quote_add_payment` + storage `parcel-payment-proofs` | canCollectParcelPayments |
| Payer depuis le solde du client | — (« Solde » est dans la liste mais passe par `add_payment` ; **à vérifier**) | fiche dépôt ; /w | `cargo_quote_pay_from_wallet` | canCollectParcelPayments |
| Annuler un encaissement (motif) | fiche dépôt | fiche dépôt | `cargo_quote_cancel_payment` | canCollectParcelPayments |
| Facture acquittée + PDF / partage | fiche dépôt | fiche dépôt, `/devis` | `cargo_quote_invoice` | canCollectParcelPayments |
| Reçu PDF / partage | fiche dépôt | fiche dépôt ; /w (automatique) | client | — |
| Paquet : créer, ouvrir par PQ, ajouter par scan ou liste, retirer | Réception › Paquets | /r/paquets | `air_package_create`, `air_package_get`, `air_package_add_parcel`, `air_package_remove_parcel` | canReceiveParcels |
| Paquet : fermer (pesée) + étiquette PDF / imprimer / PNG, rouvrir, supprimer vide | fiche paquet | /r/paquets/:id | `air_package_seal`, `air_package_reopen`, `air_package_delete` | canReceiveParcels |
| Comptes cargo : créer, corriger, rattacher, détacher | — | /m/cargo/comptes | `cargo_account_*` | canEditClients |
| Tarifs cargo | /m/more/cargo-pricing | = | `cargo_pricing_set` | canManageRates |
| Réglages d'expédition (étiquette) | /m/more/shipping | = | `update_platform_setting` | canManageUsers |
| Recevoir un paquet à Douala (scan) | — | /w/arrivees?paquet | `air_package_receive` | canReceiveAtDestination |
| Ouvrir un paquet à Douala | — | /w | `air_package_open` | canReceiveAtDestination |
| Pointer un colis (OK / abîmé, place) / tout pointer | — | /w | `warehouse_checkin_parcel` / `warehouse_checkin_many` | canReceiveAtDestination |
| Déclarer manquant (un, tous, paquet perdu) | — | /w | `warehouse_flag_missing(_many)` | canReceiveAtDestination |
| Remise : scan client, sélection, qui, signature | — | /w | `warehouse_client_parcels`, `warehouse_release_parcels` + storage `parcel-signatures` | canReleaseParcels |
| Bon de retrait (PDF) | — | /w/bon | `warehouse_release_get` + client | canReleaseParcels |

## 4) Écarts desktop → mobile (à combler)

**Container**
1. Liste : pas de CSV, pas de filtre armateur ni destination, pas de choix du tri (l'ordre est imposé par l'alerte), pas d'aperçu rapide. La recherche est cachée sous 8 conteneurs.
2. Les deux supports ne parlent pas le même vocabulaire de files. Desktop : En mer / Sous 7 j / **À régler** / **Sans suivi**. Mobile : En retard / À surveiller / À l'heure / Livré. Sur mobile, impossible de filtrer « fret ou télex à régler » ou « sans suivi ».
3. Dossier : **Suivi absent** (liste des escales, historique des estimations, dernier mouvement). Sans **position manuelle**, sans **correction de l'arrivée** et sans **édition des escales**, on ne peut pas corriger un dossier sur le terrain alors que c'est la raison d'être de la refonte de l'Aperçu du 03/10.
4. Il manque à l'en-tête mobile les indicateurs Télex, Fret et BESC. Le menu ⋯ ne garde que « Retirer ».
5. La carte de la dernière étape (`VoyageMap`) et les résumés Intervenants clés / Classeur / Marchandise de l'Aperçu sont absents.
6. Carte : pas de recherche, pas de filtres, couches figées, pas de globe ni de plein écran (acceptable, mais il faut au moins un filtre).

**Avion**
7. Pas de bandeau « paquets fermés en attente d'un vol » ni de « Mettre sur un vol » côté paquets. La création d'une expédition ne propose pas de cocher les paquets ; on ne peut les ajouter qu'après coup, depuis la fiche, avec `canManageCargo`.
8. Le tableau desktop (paiement, m³) devient une carte mobile qui reste correcte. Rien d'autre de bloquant.

**Réception (`/m/cargo/reception`)**
9. Absents : les vues **Colis**, **Photos** et **Paquets avion** ; la **recherche** (RC-, BZ-, bordereau, contenu) ; les **files** (incomplets, sans photo, en cours, partis) ; les périodes 90 j / Tout / **Supprimés** ; la pagination ; le **CSV** ; la **sélection en lot** (étiquettes, mise en paquet) ; le téléchargement du devis depuis la liste ; le choix FR/EN mémorisé (il n'existe que dans `/devis`) ; le filtre « reçu par » (qui n'est sur mobile qu'une lecture).
10. La fiche dépôt mobile est **en lecture** : pas d'Ajouter / Modifier / Supprimer un colis, pas de gestion des photos (ajout, couverture, retrait), pas de Modifier le dépôt (lieu, apporté par, fournisseur, notes), pas de **Réattribuer**, pas de **Supprimer ni Rétablir** le dépôt, pas d'étiquette client, pas d'étiquette d'un colis seul en PDF, pas de sélection des étiquettes à imprimer. Un ops sur téléphone doit passer par `/r`, qui est une autre app et n'est accessible par aucun lien.
11. Les **paquets avion** n'ont **aucun écran dans `/m`**. Pour un ops, ils n'existent que dans `/r/paquets`, et `AirPackagesPanel` n'y renvoie que si l'on a `canReceiveParcels`.
12. Le stock « Par client » mène à `/m/clients/:id/parcels` (module Clients) au lieu d'un aperçu dans Cargo.
13. Le **scan au départ** et l'**affectation de paquets** depuis `/r` sont absents, alors que le modèle opérationnel (§6, étape 5) dit « réception ou cargo » et que les tags `@mola` donnent `canReceiveParcels`. Un réceptionnaire au comptoir de l'aéroport ne peut pas scanner.

**Écarts inverses (à porter sur desktop, ou à unifier)**
14. Les **Comptes cargo** sont mobiles uniquement : sur desktop, la route affiche Réception.
15. Le **paiement depuis le solde** (`cargo_quote_pay_from_wallet`) n'existe que sur mobile (`QuotePayments`, `WarehousePay`). Sur desktop, le mode « Solde » de la liste passe par `cargo_quote_add_payment` : à vérifier côté base, risque d'un encaissement « solde » sans débit du portefeuille.
16. « À faire cette semaine », pour toute la flotte, et les tâches qui mènent à leur section n'existent que sur mobile.
17. La douchette dans « Charger dans l'avion » n'existe que sur mobile (`MobileCargoAirLoad`).
18. L'entrepôt `/w` n'a aucun équivalent sur desktop ; seule la carte « À Douala » y renvoie vers `/w`. Personne ne supervise les manquants ou les abîmés depuis la console (« l'équipe le verra dans la console » : où ?).

## 5) Problèmes UX mobile

1. **Deux fiches de dépôt pour un même RC.** `/m/cargo/reception/:id` (admin : devis, paiement, lecture seule) et `/r/deposit/:id` (saisie) ont des gestes disjoints et ne se lient pas l'une à l'autre. Pour un ops, il faut changer d'app (coquille, onglets et langue changent) pour ajouter un colis.
2. **Chevauchement `/m/cargo/reception` et `/r`.** « À attribuer » existe à trois endroits (`/m/cargo/reception`, `/r/pending`, `/r` en bandeau) ; les étiquettes de dépôt dans deux feuilles différentes (`InternalLabelSheet` et `DepositLabelsDialog`) ; les paquets seulement dans `/r`. Il faudrait une seule fiche dépôt, avec ses gestes affichés selon la permission.
3. **Dossier conteneur trop profond.** Douze sections en accordéon, une seule ouverte, avec de longs sous-titres en phrases. Les sections « Ce qu'il y a dedans » et « Le chargement en 3D » font **doublon** (« Charger des colis reçus » et « Avis d'expédition » à deux endroits, l'un vers une page et l'autre vers un dialogue).
4. **Les liens « À faire » ne mènent pas au même endroit.** La liste (`MobileCargoScreen`) envoie Télex → « argent » et BESC → « papiers » ; le dossier envoie Télex → « douane » et BESC → « douane ». Une même tâche ouvre deux sections différentes.
5. **Nommage incohérent.**
   - Titres : l'en-tête dit « Cargo » sur les trois parties ; l'écran de recherche s'appelle « Suivre une référence » sur mobile et « Suivre un conteneur » sur desktop ; le réglage, « Étiquette colis » sur mobile, « Expédition · Chine » sur desktop et « Adresses en Chine et coordonnées » dans les Réglages.
   - Libellés : « Réceptions » contre « Dépôts » ; « Le trajet » contre « Suivi » ; « Les papiers » (`papiers`) contre « Documents » ; « Mode » (Sea/Air) contre « Lieu » (Entrepôt/Bureau).
   - Onglets et chemins : « Remettre » ne mène pas au même endroit dans l'app HQ (`/w/remise/liste`) et sur le web (`/w/remise`, la caméra).
6. **Route sans issue sur desktop.** `/m/cargo/comptes` s'ouvre sur desktop sur la Réception, sans les comptes. Sur mobile, on n'y entre que par un lien en bas de Réception, et le retour y ramène.
7. **`/m/cargo/avion/:id/charger` sur desktop** affiche la page Avion sans ouvrir le mode chargement : le lien profond est perdu.
8. **Scanner de l'app HQ (admin).** Une étiquette colis `RC-…` mène à `/m/cargo/track?ref=RC-…` (recherche de conteneur), qui ne trouve rien. Un paquet `PQ-…` mène ops vers `/r/paquets` (autre app), et support ou chargé de clientèle vers « inconnu ».
9. **Cargo enfoui dans l'app HQ.** Pour les admins, Cargo est dans « Plus » (la tuile est sur l'accueil), alors que le site mobile a un onglet Cargo avec une pastille « en retard ».
10. **Trop de texte.** Phrases explicatives sous chaque bouton : notes, carte, dossier (« Si l'armateur ne signale pas l'arrivée, marquez-la ici… »), `/w` (questions plus aides). C'est utile sur le terrain, mais le dossier en est saturé. Les sous-titres des sections fermées répètent ce que la section contient.
11. **Composants desktop (`CenterDialog`) ouverts sur mobile** dans un wrapper `admin-theme` : `CargoManualAddDialog`, `MarkArrivedDialog`, et les dialogues de lot, de pièce, de coût, d'étape et d'intervenant des onglets partagés (`max-lg:` agrandit les tailles, mais ce restent des fenêtres centrées et non des feuilles).
12. **Fiche dépôt mobile.** « Attribuer » disparaît dès qu'un client existe, sans moyen de corriger une erreur d'attribution. Toucher un colis ouvre la visionneuse photo et non la fiche du colis.
13. **Commentaire périmé.** Celui de `PackSheet` dit « ouverte depuis Dépôt terminé », alors que `ReceptionDone` exclut explicitement la mise en paquet. À aligner pour la refonte.
14. **Sous-écran sans entrée.** `/m/cargo/cout` est un vrai outil, mais le mobile n'y accède que depuis « Les coûts » d'un dossier ; aucune entrée dans Cargo.

## 6) Fichiers lus

- Modèle et règles : `docs/cargo/MODELE-OPERATIONNEL.md`, `src/App.tsx`, `src/contexts/AdminAuthContext.tsx`, `src/lib/staffHome.ts`, `hq-app/src/tabs.ts`, `hq-app/src/scan.ts`, `src/mobile/components/layout/MobileTabBar.tsx`, migrations `supabase/migrations/*.sql` (tags `@mola` des RPC cargo, reception, warehouse et air_package).
- Desktop : `src/desktop/screens/cargo/{DesktopCargoScreen,DesktopCargoDossier,DesktopCargoTrack,DesktopCargoMap,DesktopCargoAir,DesktopCargoReception}.tsx`.
- Partagés : `src/components/cargo/{CargoDossier,CargoQuickView,CargoParts,CargoVesselDialog,CargoManualAddDialog}.tsx`, `dossier/{DossierHeader,DossierTabsBar,TabApercu,TabSuivi,TabChargement,TabDocuments,TabDouane,TabCouts,TabClient,TabIntervenants,TabNotes,VoyageDialogs}.tsx`, `reception/{DepositQuickView,QuoteSection,QuotePaymentsSection,DepositEditDialog,ParcelEditorDialog,DepositLabelsDialog,ReasonDialog,LoadParcelsDialog,LoadedParcelsSection,ClientParcelsQuickView}.tsx`, `packages/{DesktopPackagesView,PackageWorkbench,PackDialog,ShipDialog}.tsx`, `air/{AirQuickView,AirPackagesPanel}.tsx`, `src/lib/cargo/{dossierNav,model,palette}.ts`, `src/lib/{reception,airShipment,airPackage,cargoQuote,warehouse}.ts`.
- Hooks : `src/hooks/{useCargo,useCargoAccounts,useCargoQuote,useReception,useWarehouse,useAirPackages,useAirShipments,useShippingSettings}.ts`.
- Mobile cargo : `src/mobile/screens/cargo/{MobileCargoScreen,MobileCargoDossier,MobileNavire,MobileNotes,MobileCargoTrack,MobileCargoMap,MobileCargoCout,MobileCargoAir,MobileCargoAirForm,MobileCargoAirDetail,MobileCargoAirLoad,MobileCargoAccounts,MobileCargoReception,MobileCargoDepositDetail,MobileCargoQuote,QuotePayments,MobileCargoLoadParcels}.tsx`, `src/mobile/screens/more/{MobileShippingSettings,MobileCargoPricing,MobileSettingsScreen}.tsx`.
- Réception : `src/mobile/screens/reception/*.tsx` (16 écrans + `useReceptionLocation.ts`), `src/mobile/components/reception/{ReceptionRouteWrapper,ReceptionTabBar,LocationGate,InternalLabelSheet,ReceptionLabelSheet,PackSheet}.tsx`.
- Entrepôt : `src/mobile/screens/warehouse/*.tsx` (13 écrans), `src/mobile/components/warehouse/{WarehouseRouteWrapper,WarehouseTabBar,packages}.tsx`.

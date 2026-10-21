# Lot 03 — Cargo, Réception (Guangzhou), Entrepôt (Douala)

29 écrans, `index.html` → `png/01.png … 29.png`. Rôles : admin (onglet Cargo), reception (`/r`), warehouse (`/w`).

## Écrans

| n° | Titre | Ce qu'il montre | Capacités desktop couvertes |
|---|---|---|---|
| 01 | Cargo | Onglet Cargo : segment Expéditions / Réception, files Tous · En retard · À régler · Sous 7 j · Sans suivi, « À faire cette semaine », conteneurs (retard « +3 j »), avion | Liste flotte + files desktop (À régler, Sans suivi) et mobiles (En retard), alertes, à faire de la flotte, recherche (loupe), liste avion |
| 02 | Cargo · menu | Feuille « … » : Suivre un conteneur, Expédition avion, Carte, Trier et filtrer (armateur, destination, arrivée), CSV, Coût à quai, Comptes cargo, Tarifs cargo, Adresses en Chine | Track + ajout flotte, nouvelle expédition avion, carte, CSV, filtres armateur/destination + tri, coût à quai (entrée propre), comptes cargo, tarifs, réglages d'expédition |
| 03 | Dossier · Suivi | En-tête dossier (client, armateur, BL copiable, statut, trajet + retard, indicateurs Télex / Fret / BESC), onglets internes défilants (9 onglets desktop), carte de la dernière étape, dernier mouvement, source et âge de la position, escales | Onglet Suivi (escales, dernier mouvement), VoyageMap, MarineTraffic, en-tête desktop avec indicateurs, Rafraîchir (icône), position manuelle (bouton du dock) |
| 04 | Corriger l'arrivée | Feuille : promise / armateur / relevée, « Suivre l'armateur » ou date manuelle + note, estimations successives | EtaDialog (corriger / revenir à l'armateur), historique des estimations |
| 05 | Dossier · menu | Feuille « … » : Fret réglé, Télex reçu (bascules), Rafraîchir, Navire et voyage, Position manuelle, Modifier les escales, Marquer arrivé, Avis d'expédition (PDF), Voir en direct, Retirer de la flotte | Tout le menu ⋯ desktop + corrections manquantes du mobile (position, escales, arrivée) |
| 06 | Dossier · Documents | Classeur : BL, télex, BESC, facture fret, packing list, VGM avec statuts ; Nouvelle pièce ; dépôt sans classer (icône) | Onglet Documents (pièces, fichiers, recherche) ; « Préparer les pièces habituelles », renommer, supprimer dans « … » et sur la pièce |
| 07 | Dossier · Chargement | Remplissage m³ / kg (boîte 3D), « ce qui ne colle pas », lots par client, + Lot, Charger des colis reçus, Avis d'expédition (PDF) | Onglet Chargement (3D, lots, jauges, colis reçus, sortir de la boîte sur le lot) — un seul geste « Charger », plus de doublon |
| 08 | Dossier · Coûts | Totaux par devise, fret annoncé + facture, coûts payés / à payer, lien Coût à quai, Ajouter un coût | Onglet Coûts (ajouter, payé, justificatif, fret annoncé, saisir la facture, estimer le coût à quai) |
| 09 | Dossier · Clients | Dossier au nom de, clients du groupage (colis, m³, part du fret), lots sans propriétaire → Attribuer | Onglet Clients (attribuer, rattacher / détacher, ouvrir la fiche client) |
| 10 | Expédition avion | LTA, vol, poids / paquets / clients, jalons (préparation, départ, arrivée), paquets scannés / à scanner / refusés, + Ajouter, Scan au départ, avis PDF | AirQuickView / AirDetail : jalons, paquets, ajouter, refus, avis d'expédition ; « … » : Fiche, Pas parti, L'avion est parti, charger / retirer des colis |
| 11 | Scan au départ | Caméra (étiquette PQ), compteur 5 / 6, paquet manquant, Saisir, Terminer | `air_package_scan_departure`, chargement par douchette ou caméra |
| 12 | Réception | Segment Réception, recherche RC/BZ/client/bordereau/contenu, 5 vues (Dépôts, Colis, Photos, Par client, Paquets avion), période / lieu / file, raccourci « 3 à attribuer », indicateurs, dépôts par jour, export (icône) | Réception desktop : vues, recherche, indicateurs, liste des dépôts, CSV |
| 13 | Réception · filtres | Feuille : 7 périodes dont **Supprimés**, lieu, 7 files, reçu par, langue des devis FR/EN, CSV | Périodes, files, filtre « reçu par », langue mémorisée, export CSV (dépôts / colis / paquets selon la vue) |
| 14 | Réception · sélection | Vue Colis en mode sélection, groupée par dépôt, Étiquettes (PDF / impression) et Mettre en paquet | Barre de sélection desktop (étiquettes en lot, mise en paquet) |
| 15 | Fiche dépôt | **Fiche unique admin + réception** : colis, poids, volume, lieu, statut, client, devis (montant et état), colis avec photos, Ajouter un colis, étiquettes | DepositQuickView + MobileCargoDepositDetail + ReceptionDeposit fusionnés ; les gestes s'affichent selon la permission |
| 16 | Fiche dépôt · menu | Modifier le dépôt, Réattribuer, Étiquettes des colis, Étiquette client, Bon de réception (PDF), Photos, Historique, Supprimer le dépôt (motif) | DepositEditDialog, réattribution, DepositLabelsDialog, étiquette client, bon de réception, photos, historique, supprimer / **Rétablir** (même ligne sur un dépôt supprimé) |
| 17 | Modifier un colis | Photos (couverture, retirer, ajouter), poids et L×l×H (m³), contenu, bordereau, copies, paquet, état à la réception, Supprimer ce colis | ParcelEditorDialog complet + suppression avec motif |
| 18 | Devis | Montant, tarif, statut, lignes par colis (au kg / forfait), FR/EN, frais et remise, partage, Encaisser | QuoteSection : prix de ligne, frais/remise, langue, PDF, partager ; « … » : Envoyer / Renvoyer, retirer une ligne, facture |
| 19 | Encaisser | Feuille : Espèces / MoMo / OM / **Solde**, solde avant / après, facture acquittée, Débiter le solde | `cargo_quote_add_payment`, `cargo_quote_pay_from_wallet` (confirmation avant / après), facture |
| 20 | Comptes cargo | Comptes (code, clients, colis en attente), comptes fermés, clients d'un compte (Rattacher / Détacher), Nouveau compte | `cargo_account_*` (créer, corriger via « … », rattacher, détacher) |
| 21 | Réception · Aujourd'hui | Rôle réception : lieu Bureau · Air (Changer), « 2 sans client » (remplace l'onglet En attente), Nouveau dépôt, journée navigable, dépôts du jour | ReceptionHome + ReceptionPending (attribuer), langue (globe) |
| 22 | Nouveau dépôt · client | Étape 1/4 : scan du QR client, bordereau gardé, client trouvé, Par nom, Sans client, Continuer | ReceptionIdentify, ReceptionSearch (nouveau client depuis « Par nom ») |
| 23 | Colis · mesures et photo | Un seul écran : photos, poids, dimensions, volume, état, contenu, bordereau, copies, Enregistrer · colis suivant | Assistant ReceptionParcel en 5 écrans réduit à un |
| 24 | Paquets | Paquet en cours (jauge 32 kg, Continuer), « 11 colis attendent un paquet » → Choisir, paquets fermés cochés, **Mettre sur un vol** | ReceptionPackages + ReceptionPackTodo, et l'affectation à un vol, absente de `/r` aujourd'hui |
| 25 | Paquet en cours | Jauge, scan / saisie RC, bandeau « ajouté », colis dedans par client (Retirer), colis prêts (Ajouter), étiquette, Fermer et peser | PackageWorkbench / ReceptionPackage ; « … » : Rouvrir, Supprimer si vide, Paquet suivant |
| 26 | Entrepôt · Journée | Rôle entrepôt Douala : Pointer une arrivée, Remettre à un client, 4 compteurs, arrivées (conteneur, avion), remis aujourd'hui | WarehouseHome, WarehouseArrivals |
| 27 | Pointer une arrivée | Progression (bon état, abîmés, manquants), scan, files Restants / Pointés / Abîmés / Manquants, colis par client avec place (B3), Tout pointer, Terminer | WarehouseCheckin (+ colis, bilan, déclarer manquants, ouvrir un paquet avion) |
| 28 | Remettre · client | Étape 2/3 : client (QR vérifié), colis prêts cochés, pas encore là, devis / payé / reste à payer, Encaisser | WarehousePickupClient + WarehousePay |
| 29 | Remise signée | Bandeau payé + reçu, feuille : le client ou une autre personne, signature, pièce vérifiée, Confirmer la remise | WarehouseHandover + WarehouseSign (le bon BR-… PDF suit, comme après « Payé » au lot 00) |

## Capacités du module placées où

| Capacité (rapport C, §3) | Écran |
|---|---|
| Exporter la flotte (CSV), filtrer armateur / destination, trier | 02 |
| Aperçu rapide d'un conteneur | remplacé par l'ouverture directe du dossier (01 → 03), comme sur le mobile actuel |
| Rafraîchir auprès de l'armateur | 03 (icône), 05 |
| Fret réglé / non réglé · Télex reçu / non reçu | 05 (bascules), indicateurs en 03 |
| Renseigner / modifier le navire | 05 |
| Retirer de la flotte | 05 |
| Position manuelle | 03 (dock), 05 |
| Corriger l'arrivée / revenir à l'armateur | 04 |
| Modifier les escales | 03 (Modifier), 05 |
| Marquer arrivé / annuler l'arrivée | 05 (la même ligne devient « Annuler l'arrivée ») |
| Voir en direct (MarineTraffic), voir sur la carte | 03, 05, 02 (carte) |
| Lots : ajouter / modifier / retirer · charger des colis reçus · sortir de la boîte | 07 |
| Avis d'expédition maritime (PDF) | 07 (dock), 05 |
| Classeur, fichiers, préparer les pièces habituelles | 06 |
| Étapes douane | onglet « Douane » de la barre 03/06 (même modèle que Documents) |
| Coûts, fret annoncé, facture, coût à quai | 08 (+ 02 pour le coût à quai hors dossier) |
| Attribuer des lots, rattacher / détacher le dossier | 09, 07 |
| Intervenants · Notes | onglets « Intervenants » et « Notes » de la barre 03 (même modèle) |
| Suivre une référence, ajouter à la flotte (trouvé / manuel) | 02 |
| Nouvelle expédition avion (+ paquets) · corriger la fiche | 02, 24 (Mettre sur un vol), « … » de 10 |
| Jalon avion : parti / arrivé / pas parti | 10 (frise + « … ») |
| Charger / retirer des colis (avion) · avis PDF | 10, 11 |
| Ajouter des paquets à un vol · scan au départ · retirer · refusé à l'aéroport | 10, 11, 24 |
| Réception : vues, périodes (dont Supprimés), files, recherche, reçu par | 12, 13 |
| CSV dépôts / colis / paquets | 12 (icône), 13 |
| Étiquettes en lot · mettre en paquet (sélection) | 14 |
| Télécharger le devis depuis la liste + langue | 13 (langue), 18 |
| Relevé des colis d'un client (PDF) | vue « Par client » de 12 (même modèle de ligne) |
| Bon de réception, étiquettes du dépôt, étiquette client | 16 |
| Attribuer / réattribuer un dépôt | 15 (client), 16, 21 |
| Ajouter / modifier / supprimer un colis, photos, couverture, état | 15, 17, 23 |
| Modifier le dépôt · supprimer / rétablir | 16 (+ période Supprimés en 13) |
| Ouvrir / terminer un dépôt · créer un client | 21, 22, 23 (« Terminer » au dock de 15 pour un dépôt en cours) |
| Devis : prix, frais / remise, envoyer | 18 |
| Encaisser (cash, MoMo, OM) · payer depuis le solde · reçu · facture | 19, 28 |
| Annuler un encaissement (motif) | ligne d'encaissement de la fiche dépôt / du devis (« … ») |
| Paquet : créer, ouvrir par PQ, ajouter par scan ou liste, retirer, fermer (pesée), étiquette, rouvrir, supprimer vide | 24, 25 |
| Comptes cargo | 20 (entrée en 02) |
| Tarifs cargo · réglages d'expédition | 02 |
| Recevoir / ouvrir un paquet à Douala · pointer · tout pointer · manquants | 26, 27 |
| Remise : scan client, sélection, qui, signature · bon de retrait | 28, 29 |

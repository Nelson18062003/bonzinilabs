# Lot 10 · Compléments (72 écrans)

Ce lot dessine les écrans de l'ordinateur qui n'avaient pas encore de capture dans les lots 01 à 06. Avant lui, ils étaient seulement « rangés dans… », ou absents.
Rendu (depuis `mobile-refonte/`) : `node shot.cjs v2/10-complements/index.html v2/10-complements/png` donne 72 écrans, sans erreur.
Fichiers : `index.html` (styles du lot, avec les jetons de kit2), `helpers.js`, puis un fichier par module, de `m1-operations.js` à `m8-reglages.js`. `kit2.css` et `kit2.js` n'ont pas été modifiés.
Trésorerie, Taux et Analyses sont traités ailleurs (lots 07, 08 et 09). Ils ne sont pas dans ce lot.

## Les écrans

| # | Module | Écran |
|---|---|---|
| 01 | Opérations | Paiement groupé : client à débiter, 4 fournisseurs (¥ et XAF), « Ajouter un fournisseur », total et restant, bouton « Vérifier le lot » |
| 02 | Opérations | Lot · ajouter un fournisseur (feuille) : moyen en tuiles, montant ¥ avec puces ¥1K, ¥2,5K, ¥5K et Restant, bénéficiaire, « Enregistrer dans son carnet », lien « Son carnet » |
| 03 | Opérations | Lot · vérifier (feuille) : total, débité, solde avant et après, note, « Créer le lot » (tout ou rien) |
| 04 | Opérations | Modifier le fournisseur (`/edit-beneficiary`) : Alipay ou WeChat, QR avec « Changer le QR », nom, identifiant, « + Téléphone, identifiant, notes » |
| 05 | Opérations | Paiement · corriger le montant (feuille) : XAF et ¥, taux, débité et solde avant puis après, motif obligatoire |
| 06 | Opérations | Instruction de paiement 付款指令 : aperçu de l'image (QR, 收款人, 账号, réf.), « Partager l'image » · PDF · Copier le texte |
| 07 | Opérations | Nouveau paiement · nouveau fournisseur (3/3) : moyen, photo du QR, nom, identifiant, « Garder dans ses fournisseurs » |
| 08 | Clients | Découvert autorisé (feuille) : 4 plafonds proposés, montant libre, solde plancher, motif, « Retirer le découvert » |
| 09 | Clients | Étiquette colis : Bateau ou Avion, BZ-4821 et QR, destinataire et adresse en chinois, bloc fournisseur, envoi en image, PDF, copier |
| 10 | Clients | Identité : nom, sexe, naissance, ville, email, entreprise, origine |
| 11 | Clients | Téléphones : numéros avec libellé, numéro principal, ajout (jusqu'à 10) |
| 12 | Clients | Bénéficiaire · gestes (feuille sur la liste) : nombre de paiements, dernier paiement, Payer, Modifier, Archiver |
| 13 | Clients | Repasser en prospect (feuille) : commercial proposé, motif, case de confirmation |
| 14 | Clients | Supprimer le client (feuille) : contrôles du solde, du découvert et des paiements en cours, bouton rouge |
| 15 | Équipe & ventes | Nouvel accès 1/2 : le rôle, avec son équipe et son périmètre |
| 16 | Équipe & ventes | Nouvel accès 2/2 : nom, email de connexion, téléphone, site (« + Nouveau site ») |
| 17 | Équipe & ventes | Accès créé : mot de passe provisoire, « Copier le message », « Partager le message », « Voir sa fiche » |
| 18 | Équipe & ventes | Membre · menu « … » : Modifier, Changer de rôle, Changer de fiche commercial, Ses chiffres et objectifs, Agrément CAD |
| 19 | Équipe & ventes | Changer de rôle : rôles, et ce que deviennent sa fiche commercial et ses prospects |
| 20 | Équipe & ventes | Agrément du commissionnaire (feuille) : société, n° d'agrément, représentant, Actif ou Suspendu |
| 21 | Équipe & ventes | Ventes · un commercial : paiements du mois et objectif, Objectifs · Appeler · Son accès, ses prospects avec leurs puces |
| 22 | Équipe & ventes | Objectifs du mois : 6 cibles, avec le réalisé de chacune, et changement de mois |
| 23 | Équipe & ventes | Sources des clients : total, nouveaux, sans origine, période, types, une ligne par source |
| 24 | Équipe & ventes | Une source : 4 chiffres et ses clients ; Modifier et Archiver sont dans « … » |
| 25 | Équipe & ventes | Nouvelle source (feuille) : type en tuiles, nom, téléphone facultatif |
| 26 | Commercial | Mes clients : paiements du mois, actifs, avion, bateau, une ligne par client avec Appeler et WhatsApp |
| 27 | Commercial | Prospect · marquer perdu (feuille) : motifs rapides, précision, « Il pourra être rouvert » |
| 28 | Commercial | Nouveau prospect 7/7 · récapitulatif : contrôle du numéro, « Enregistrer le prospect » |
| 29 | Commercial | Plus du commercial : Moi, mot de passe, langue, notifications, se déconnecter |
| 30 | Cargo | Tous les conteneurs : puces Tous, En mer, Sous 7 j, À régler, Sans suivi, avec la loupe et « … » |
| 31 | Cargo | Carte : golfe de Guinée, navires, trajets, filtres, feuille d'un navire et de ses conteneurs |
| 32 | Cargo | Suivre un conteneur : référence avec l'armateur reconnu, armateurs couverts, dernières recherches, « Interroger l'armateur » |
| 33 | Cargo | Ajouter à ma flotte (feuille sur le résultat) : client, départ et arrivée promis, fret USD |
| 34 | Cargo | Conteneur · onglet Colis : clients du groupage (m³ et part du fret), lots sans propriétaire à attribuer, « Charger des colis reçus » |
| 35 | Cargo | Conteneur · onglet Coûts : prix de revient, coûts payés ou à payer, « Estimer le coût à quai », « Ajouter un coût » |
| 36 | Cargo | Coût à quai : fourchette, puis chaque poste marqué Sûr, Estimé ou Risque (franchise), « Revoir les 6 réponses » |
| 37 | Cargo | Avion · expéditions : puces par état, « 4 paquets sans vol · Mettre sur un vol », LTA |
| 38 | Cargo | Avion · nouvelle expédition : LTA (ou « pas encore connue »), compagnie, vol, dates, paquets fermés à cocher |
| 39 | Cargo | Avion · charger des colis : douchette ou saisie, colis groupés par client, avec cases à cocher |
| 40 | Cargo | Comptes cargo (regroupeurs) : colis en attente, comptes, lien vers les comptes fermés |
| 41 | Cargo | Compte cargo : colis à Guangzhou, ses clients, « Rattacher un client » ; Corriger et Fermer sont dans « … » |
| 42 | Cargo | Devis : prix par colis (m³), manutention, total, FR ou EN, « Renvoyer le devis », frais et remise, facture, PDF et partage |
| 43 | Cargo · Réception | Nouveau dépôt 2/4 · « Qui apporte le colis ? » (4 choix) |
| 44 | Cargo · Réception | Nouveau dépôt 3/4 · fournisseur : déjà vus pour ce client, ou nouveau (fournisseur ou agent d'achat), « Passer » |
| 45 | Cargo · Réception | Dépôt terminé : reçu, « Dépôt suivant », « Imprimer les étiquettes » |
| 46 | Cargo · Réception | En attente d'attribution : colis reçus sans client, « Attribuer » |
| 47 | Cargo · Réception | Carte client : QR, BZ-4821, « Nouveau dépôt » et Étiquette, ses dépôts |
| 48 | Cargo · Réception | Paquet en cours PQ-000234 : jauge de 32 kg, scan, Retirer, « Fermer le paquet (pesée) » |
| 49 | Cargo · Entrepôt | Pointer · « Quelle arrivée ? » : boîte ou vols, avec ce qui reste à pointer |
| 50 | Cargo · Entrepôt | « Ce colis est-il là ? » : photo de Guangzhou, rangée, remarque, bon état, abîmé, manquant |
| 51 | Cargo · Entrepôt | Bilan du pointage : bon état, abîmés, manquants, jamais vus, « Déclarer 2 manquants » |
| 52 | Cargo · Entrepôt | Remettre · « Qui attend ses colis ? » : Payé, Reste ou Sans prix, rangée |
| 53 | Cargo · Entrepôt | Remettre 3/3 · « Qui emporte les colis ? » : la cliente elle-même ou une autre personne (nom, téléphone), « Faire signer » |
| 54 | Douane | Relecture d'une DAU : enjeu, proposition du moteur, pièces, montant récupérable (avec valeurs proposées), avis, « Rendre l'avis » |
| 55 | Douane | Veille douane : Réglementation ou Perturbations, gravité, brouillon, avis terminés |
| 56 | Douane | Publier un avis : type, titre, gravité, retard, date, lieux et codes SH, Publier ou Brouillon |
| 57 | Douane | Avis · menu « … » : Corriger, Partager le lien, Retirer (sur la fiche de l'avis et ses conteneurs touchés) |
| 58 | Douane | Routes et délais : Mer ou Avion, départ et arrivée, jours porte à porte, km, CO₂e, délai mesuré, étapes J+ |
| 59 | Messages & outils | Statistiques des messages : 7, 14 ou 30 j, temps de réponse, compteurs, volume par jour (encre et gris), qui répond le plus |
| 60 | Messages & outils | Réponses types : liste rangée à la main (poignée) et « + » |
| 61 | Messages & outils | Modifier une réponse type : libellé, texte, variables, aperçu, suppression |
| 62 | Messages & outils | Suggestions aux nouveaux clients : interrupteurs et ce que voit le client |
| 63 | Messages & outils | Mola · conversations : historique par jour, actions faites ou annulées, « Nouvelle conversation » |
| 64 | Messages & outils | Veille macro : prédiction USD/CNY pour le lendemain avec sa confiance et son conseil, Brent, WTI, DXY, EUR/USD, USD/CNY, BTC |
| 65 | Réglages & profil | Connexion (une seule pour tous les rôles) : email, mot de passe, Face ID |
| 66 | Réglages & profil | Verrou Face ID (app native) |
| 67 | Réglages & profil | Moi · Mon profil : photo, prénom, nom, email verrouillé |
| 68 | Réglages & profil | Moi · Mot de passe : 10 caractères ou plus, confirmation |
| 69 | Réglages & profil | Moi · Clés d'accès : appareils, Révoquer, « Ajouter cet appareil » (web) |
| 70 | Réglages & profil | Moi · Mise à jour : version prête, installée, nouveautés, « Redémarrer pour installer » |
| 71 | Réglages & profil | Réglages · Adresses en Chine : Bateau (entrepôt) ou Avion (bureau), destinataire, adresse en chinois et en anglais, téléphone, WeChat |
| 72 | Réglages & profil | Réglages · Tarifs cargo : XAF par m³ (bateau) et XAF par kg (avion), avec un exemple calculé |

Les références « v2-n » renvoient aux 8 écrans validés (`v2/png/0n.png`) ; « 0X/nn » renvoie à l'écran nn du lot 0X ; « 10/nn » renvoie à ce lot.

## Chaque écran de l'ordinateur et sa place sur mobile

### A · Opérations
| Écran desktop (route) | Mobile |
|---|---|
| `/m/ops`, `/m/deposits` : liste des dépôts, files, recherche, filtres, tri | 02/01, 02/02 (« … »), 02/10 (filtres), recherche 01/07 |
| `/m/deposits/:id` : fiche dépôt (vérifier, valider, refuser, preuves, annuler, reçu) | 02/03 · 02/04 · 02/05 · 02/06 |
| `/m/deposits/new` : nouveau dépôt | v2-8 |
| `/m/payments` : liste des paiements (À traiter, Info manquante, En cours, Tous) | v2-7, filtres 02/10 |
| `/m/payments/:id` : fiche paiement | v2-5 · 02/07 (marquer payé) · v2-6 (payé) · 02/08 (« … ») · 02/09 (historique) · **10/05** (corriger le montant) · **10/06** (instruction 付款指令) |
| `/m/payments/new` : nouveau paiement | v2-2 · v2-3 · v2-4 · **10/07** (nouveau fournisseur) |
| `/m/payments/batch/new` : création d'un paiement groupé | **10/01 · 10/02 · 10/03** |
| `/m/payments/batch/:id` : détail du lot, et liste des lots (absente du desktop) | 02/16 · 02/15 |
| `/m/payments/:id/edit-beneficiary` : modifier le bénéficiaire | **10/04** (ouvert depuis 02/08 › « Modifier le fournisseur ») |
| `/m/more/proofs` : justificatifs | 06/14 |
| `/m/more/history` : journal | 06/13 |
| `/a/login` : connexion de l'agent cash | connexion unique **10/65** (01/10) |
| `/a` : paiements à remettre ou remis | 06/17 |
| `/a/scan` : scanner ou saisir l'ID | 02/12 |
| `/a/payment/:id` · `/confirm` · `/success` | 02/11 · 02/13 et 06/18 · 02/14 |

### B · Clients, équipe, ventes, app commercial
| Écran desktop (route) | Mobile |
|---|---|
| `/m/clients` : liste des clients | 03/01 |
| `/m/clients/new` : nouveau client et succès | 03/09 · 03/10 |
| `/m/clients/:id` : fiche client | 03/02 · 03/03 (« … ») · 03/04 et 03/05 (crédit et débit) · **10/08** (découvert) · **10/09** (étiquette colis) · **10/10** (identité) · **10/11** (téléphones) · **10/13** (repasser en prospect) · **10/14** (supprimer) |
| `/m/clients/:id/ledger` : historique | 03/06 |
| `/m/clients/:id/beneficiaries` : bénéficiaires | 03/07 · **10/12** (gestes) ; formulaire d'ajout ou de modification = gabarit de **10/04** et **10/07** |
| `/m/clients/:id/parcels` : colis reçus | 03/08 |
| `/m/clients/scan` : scanner un client | 01/05 · 01/06 |
| `/m/clients/sources(/:id)` : sources et commerciaux | **10/23 · 10/24 · 10/25** |
| `/m/equipe` : mes équipes | 03/11 |
| `/m/equipe/nouveau` : nouvel accès | **10/15 · 10/16 · 10/17** |
| `/m/equipe/:userId` : fiche membre | 03/12 · **10/18** (« … ») · **10/19** (changer de rôle) · **10/20** (agrément CAD) |
| `/m/equipe/ventes` : vue d'ensemble des ventes | 03/13 |
| `/m/equipe/ventes/:sourceId` : un commercial et ses objectifs | **10/21 · 10/22** |
| `/m/equipe/ventes/a-verifier` : fiches à vérifier | 03/14 |
| `/v/login` | connexion unique **10/65** |
| `/v` : mon mois | 03/15 |
| `/v/prospects` : prospects | 03/16 |
| `/v/prospects/new` : assistant en 7 étapes | 03/17 (2/7) · **10/28** (7/7) |
| `/v/prospects/:id` : fiche prospect | 03/18 · **10/27** (marquer perdu) |
| `/v/clients` : mes clients | **10/26** |
| `/v/password`, compte du commercial | **10/68** · **10/29** |

### C · Cargo, réception, entrepôt
| Écran desktop (route) | Mobile |
|---|---|
| `/m/cargo` : la flotte | 04/01 · **10/30** (liste complète) |
| `/m/cargo/:id` : dossier, onglets Aperçu et Suivi | 04/02 · 04/04 (« … ») |
| Dossier · Documents | 04/03 |
| Dossier · Chargement, Clients (groupage, lots sans propriétaire, charger) | **10/34** |
| Dossier · Coûts | **10/35** |
| Dossier · Douane & arrivée, Intervenants, Notes | rangés dans 04/02 et 04/03 (voir 04 · LISTE) ; pas d'écran à part |
| `/m/cargo/track` : suivre un conteneur | **10/32 · 10/33** |
| `/m/cargo/map` : carte | **10/31** |
| `/m/cargo/cout` : coût à quai | **10/36** |
| `/m/cargo/avion` : expéditions avion | **10/37** |
| `/m/cargo/avion/nouveau`, `/:id/modifier` | **10/38** |
| `/m/cargo/avion/:id` : fiche avion | 04/05 |
| `/m/cargo/avion/:id/charger` | **10/39** |
| `/m/cargo/comptes(/:id)` : comptes cargo | **10/40 · 10/41** |
| `/m/cargo/reception` : la réception vue par l'équipe | 04/06 |
| `/m/cargo/reception/:depositId` : fiche dépôt et encaissement | 04/07 · 04/08 · 04/09 |
| `/m/cargo/reception/:depositId/devis` | **10/42** |
| Paquets avion (desktop, dans Réception) | 04/13 · **10/48** |
| `/m/more/shipping` : expédition, Chine | **10/71** (entrée : 06/16 › Entreprise) |
| `/m/more/cargo-pricing` : tarifs cargo | **10/72** |
| `/r/login` | connexion unique **10/65** |
| `/r` : accueil de la réception | 04/10 |
| `/r/new` · `/r/new/search` : identifier le client | 04/11 |
| `/r/new/client` : nouveau client à la réception | 03/09 · 03/10 (même formulaire) |
| `/r/new/how` : qui apporte | **10/43** |
| `/r/deposit/:id/supplier` : fournisseur | **10/44** |
| `/r/deposit/:id` : dépôt en cours | gabarit 04/07, sans encaissement |
| `/r/deposit/:id/parcel` : colis | 04/12 |
| `/r/deposit/:id/done` : dépôt terminé | **10/45** |
| `/r/pending` : en attente d'attribution | **10/46** |
| `/r/clients` : clients de la réception | gabarit v2-2 (recherche et récents) |
| `/r/clients/:userId` : carte client | **10/47** |
| `/r/paquets` : paquets | 04/13 |
| `/r/paquets/emballer` : mettre en paquet | gabarit **10/39** (colis par client à cocher) |
| `/r/paquets/:id` : paquet | **10/48** |
| `/w/login` | connexion unique **10/65** |
| `/w` : la journée de l'entrepôt | 04/14 |
| `/w/arrivees` : quelle arrivée | **10/49** |
| `/w/arrivees/:kind/:id` : pointer | 04/15 |
| `…/colis/:pid` : ce colis est-il là | **10/50** |
| `…/bilan` : bilan du pointage | **10/51** |
| `/w/remise` : scanner pour remettre | 01/05 (scanner) |
| `/w/remise/liste` : qui attend | **10/52** |
| `/w/remise/:code` : colis du client | 04/16 |
| `/w/remise/:code/encaisser` | feuille 04/09 |
| `/w/remise/:code/qui` : qui emporte | **10/53** |
| `/w/remise/:code/signature` | 04/16 |
| `/w/bon/:releaseId` : bon de retrait | 04/17 |

### E · Messages, douane, Mola, Plus, réglages, navigation, app native
| Écran desktop (route) | Mobile |
|---|---|
| Barre latérale desktop et « Tous les outils » | onglets du rôle (01/10) · Plus 01/01 |
| Recherche globale (barre du haut) | 01/07 |
| Cloche des notifications et `/m/more/notifications` | 01/08 · 01/09 |
| `/m/support` : liste des conversations | 06/01 |
| `/m/support/:id` : conversation | 06/02 · 06/03 · 06/04 · 06/05 |
| `/m/support/stats` : statistiques | **10/59** |
| `/m/more/canned-responses` : réponses types | **10/60 · 10/61** |
| `/m/more/quick-replies` : suggestions aux nouveaux clients | **10/62** |
| `/m/douane` : à signer | 06/06 |
| `/m/douane/revue/:id` : revue d'un classement | 06/07 · 06/08 · 06/09 |
| `/m/douane/audit/:id` : relecture d'une DAU | **10/54** |
| `/m/douane/veille` : veille douane | **10/55 · 10/56 · 10/57** |
| `/m/douane/routes` : routes et délais | **10/58** |
| `/m/douane/simulateur` : simulateur | 06/10 · 06/11 |
| `/m/assistant` : Mola | 06/12 · **10/63** (historique, nouvelle conversation) |
| `/m/more` : Plus | 01/01 |
| `/m/more/settings` : réglages | 06/16 |
| `/m/more/payment-details` : coordonnées de paiement | 06/15 |
| `/m/more/passkeys` : clés d'accès | **10/69** |
| `/m/more/password` : mot de passe | **10/68** |
| `/m/more/profile` : profil | **10/67** |
| `/m/more/briefs` : veille macro | **10/64** |
| App native · connexion `/m/login` | **10/65** (01/10) |
| App native · verrou | **10/66** |
| App native · Moi, notifications par type, déconnexion | 01/02 · 01/03 · 01/04 |
| App native · mises à jour | **10/70** |
| App native · scanner | 01/05 · 01/06 |
| App native · accueil | v2-1 |

## Ce qui reste sans dessin à part

Ces écrans réutilisent un gabarit déjà dessiné :
- Dossier conteneur : Chargement en 3D, Douane & arrivée étape par étape, Intervenants, Notes (rangés dans 04).
- Réception : le dépôt en cours `/r/deposit/:id`, la liste des clients `/r/clients` et « Mettre en paquet » `/r/paquets/emballer`.
- Petites feuilles de confirmation : refuser un paiement, annuler un paiement ou un dépôt, mot de passe client réinitialisé, archiver une source ou un compte, retirer un avis. Elles suivent les gabarits 02/06, 03/10 et 10/14.

Ces écrans ne sont pas dessinés du tout :
- La douane « Signés récemment », derrière le lien « Signés » de 06/06.
- L'écran natif « Hors connexion » et la feuille « Code lu » (code inconnu) du scanner. L'ordinateur n'a ni l'un ni l'autre.
- Trésorerie, Taux et Analyses : ils sont dans les lots 07 à 09, faits par d'autres agents.

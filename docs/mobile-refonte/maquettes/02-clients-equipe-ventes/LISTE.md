# Lot 02 — Clients · Équipe · Ventes (27 écrans)

Source : `index.html` (charge `../kit.css` + `../kit.js`), rendu `png/01.png … 27.png`.
Référence desktop : `modules/B-clients-equipe-ventes.md`.

## Écrans

| N° | Titre | Ce qu'il montre | Capacités desktop couvertes |
|---|---|---|---|
| 01 | Clients | Onglet Clients : boutons Scanner et +, recherche, puces de statut **avec compteurs** (Tous/Actifs/Inactifs/Suspendus/KYC), barre « 278 clients · Solde : tous · Récents », lignes : avatar, nom, BZ + tél., solde (rouge si découvert), point de statut | Liste, recherche (nom/tél./BZ), filtres statut + compteurs, scanner un code client, créer un client |
| 02 | Trier et filtrer | Feuille : Solde (Tous / Avec solde / Solde nul / **En découvert**, compteurs) + Trier par (activité, nom, solde, **total dépôts**, **total paiements**, ancienneté, sens) ; « Voir 12 clients » | Filtre Solde/découvert, tri dépôts/paiements/ancienneté (manquants sur l'ancien mobile) |
| 03 | Fiche client | Retour + « … » ; identité (avatar, nom, BZ, entreprise, ville, statut) ; solde + **disponible avec découvert** + découvert autorisé ; 3 gestes Dépôt / Paiement / Message ; onglets Opérations · Relevé · Bénéficiaires · Colis ; totaux dépôts/paiements ; dernières opérations | En-tête du panneau, solde/découvert chiffré, tuiles Total dépôts/paiements, « 6 derniers mouvements », Déclarer un dépôt, Nouveau paiement |
| 04 | Fiche client · menu … (super admin) | Feuille des actions secondaires groupées : Argent (Crédit/Débit, Découvert), Fiche (Identité, Téléphones, Origine, Nouveau mot de passe), Compte (Repasser en prospect, **Supprimer le client** en rouge, séparé) | Menu ⋯ desktop complet + boutons Crédit/Débit et Découvert |
| 05 | Fiche client · menu … (support) | Même feuille vue par un rôle sans `canAdjustWallets` / `canGrantOverdraft` / `canManageUsers` : plus d'Argent ni de Compte, il reste Fiche + Documents (Relevé PDF, Étiquette) | Règle : un bouton n'apparaît que si le rôle a le droit (fin des erreurs serveur après saisie) |
| 06 | Crédit / Débit | Feuille : segment Crédit/Débit, montant, motif (visible par le client), avant/après (passe en découvert en rouge), découvert restant ; « Débiter 3 000 000 » | `create_wallet_adjustment`, alerte découvert, confirmation avant/après |
| 07 | Découvert autorisé | Feuille : préréglages, plafond, motif, utilisé / disponible après, **Retirer le découvert** | `admin_set_wallet_overdraft` (autoriser, modifier, retirer) |
| 08 | Relevé | Onglet Relevé (en-tête compact) : puces Tout/Dépôts/Paiements/Crédits/Débits/Transport, sélecteur de mois, bouton Relevé PDF, écritures groupées par jour : montant signé, solde après, auteur | Historique complet, filtre par type, « Solde après », « Par … » |
| 09 | Relevé PDF | Feuille : période (préréglages + Du/Au), langue FR/EN/中文, nombre d'écritures, partager / télécharger | `StatementPeriodSheet` (période + langue → PDF) + partage |
| 10 | Bénéficiaires | Onglet Bénéficiaires : recherche, puces par mode avec compteurs, « + Ajouter », ligne glissée → Modifier / Archiver | Lister, chercher, filtrer par mode, ajouter, modifier, archiver |
| 11 | Colis | Onglet Colis : colis / kg / m³, Relevé des colis, Étiquette, conteneur du client (statut, arrivée), réceptions de Guangzhou avec statut entrepôt (À Guangzhou / Avion / En mer / Remis à Douala) | Section colis du panneau + page Colis, relevé des colis PDF, conteneurs du client (avant : mobile seulement) ; statut qui tient compte du départ en avion |
| 12 | Étiquette colis | Feuille : Bateau/Avion, aperçu de l'étiquette (BZ, nom, tél., QR, adresse entrepôt GZ, destinataire), **bloc fournisseur** activable, copier l'image, PDF, envoyer l'image | Composer d'étiquette desktop (bloc fournisseur, copier image) + partage mobile |
| 13 | Nouveau client | Formulaire : Prénom*, Nom*, Sexe*, Naissance, Entreprise ; WhatsApp principal* (drapeau, vérifié), numéros secondaires avec libellé, + Autre numéro, E-mail ; Pays*, Ville ; Origine | `admin_create_client` + téléphones + identité + origine |
| 14 | Client créé | Succès : code BZ, mot de passe provisoire (copier), récapitulatif, **Envoyer sur WhatsApp**, Voir la fiche | Écran de succès desktop (mdp, WhatsApp, voir la fiche) |
| 15 | Équipe | Plus › Équipe & ventes, segment Équipe/Ventes (pastille « 3 à vérifier »), recherche, + Nouvel accès, puces par équipe avec compteurs, filtre site, « 16 actifs · 1 désactivé », lignes avec rôle, site, **dernière connexion**, alerte « fiche non reliée » | Mes équipes : filtres équipe/site, recherche, désactivés, dernière connexion (masquée sur l'ancien mobile) |
| 16 | Nouvel accès | Étape 1/2 : choix du rôle (Super admin, Opérations, Support, Succès client, Trésorier, Réception GZ, Entrepôt Douala, Commercial, Commissionnaire) avec ce qu'il voit et son espace d'arrivée | `team_create_member`, étape 1 |
| 17 | Fiche membre | Identité, rôle + Actif, téléphone (WhatsApp / Appeler), site, dernière connexion, accès créé, **Droits** (cochés / non, « super admin »), **Désactiver l'accès** ; « … » : Modifier, Changer de rôle, Nouveau mot de passe | Fiche membre complète, `toggle_admin_status` |
| 18 | Ventes | Segment Ventes : bandeau « 3 fiches à vérifier », période 3 mois/6 mois/12 mois/12 sem., 4 tuiles-indicateurs (la tuile choisie pilote le graphique), évolution empilée par commercial / équipe | `SalesBoard` : plage, tuiles, indicateur, empilé/équipe |
| 19 | Ventes · qui apporte quoi | Objectifs du mois par commercial (jauge + rythme) puis **Origine des clients** (ex « Sources & commerciaux ») : clients / +ce mois / sans origine, puces par type, lignes source : clients, dépôts, paiements, colis ; « … » : Nouvelle source, période libre | Classement + objectifs ; tout `ClientSourcesScreen` fusionné ici (une seule porte vers les commerciaux) |
| 20 | Page commercial | Identité, rôle, accès, Appeler / WhatsApp / **Son accès** ; onglets Chiffres · Prospects · Clients ; mois (‹ ›) + **Modifier** les objectifs ; 5 jauges | `SalesCommercial` : tableau de bord, objectifs (fixer/modifier), lien vers sa fiche membre |
| 21 | Ses prospects | Onglet Prospects du commercial : puces En cours / À vérifier / Clients / Perdus (compteurs), lignes avec statut et relance, actions en ligne **Créer son compte client**, **Décider**, **Confier à…** | Liste prospects d'un commercial + 3 actions |
| 22 | À vérifier | Fiche 1 sur 3 : saisi par le commercial (nom, numéros, problèmes, aide) ↔ client reconnu par le numéro (origine, dépôts/paiements, ancienneté, ouvrir la fiche) ; note interne ; Confier à un autre commercial ; **Refuser** / **Attribuer à Mireille** | `ProspectClaims` : attribuer, refuser (note), confier |
| 23 | Commercial · Mon mois | Salutation, avatar = menu compte ; tuiles Nouveau prospect / 3 à relancer ; 1 fiche à vérifier ; objectifs (jauges + rythme) ; mes prospects | `/v` Mon mois |
| 24 | Commercial · Prospects | Brouillon à reprendre, recherche, puces Ouverts / À relancer / À vérifier / Intéressés…, lignes avec date de relance (échue en rouge), tag « À compléter », + | `/v/prospects` |
| 25 | Commercial · Nouveau prospect | Assistant étape 2/7 « Pour la joindre » : barre d'étapes, WhatsApp (numéro libre ✓), Boutique (déjà client → À vérifier), + Autre numéro, E-mail, Ville ; Retour / Suivant | `/v/prospects/new`, vérification en direct des numéros |
| 26 | Commercial · Fiche prospect | Identité + relance ; statut segmenté À contacter / Contacté / Intéressé ; numéros avec WhatsApp / Appeler ; sections Activité, Ses problèmes avec **Modifier** ; dock WhatsApp + **Appeler** ; « … » : Marquer perdu, Rouvrir, Compléter | `/v/prospects/:id` |
| 27 | Commercial · Mes clients | Mois ‹ ›, 4 chiffres (clients/actifs, paiements, avion, bateau), recherche, lignes avec code, montant payé, WhatsApp / Appeler | `/v/clients` |

## Capacités du module placées où

| Capacité desktop (module B §3) | Où sur mobile |
|---|---|
| Filtrer statut avec compteurs | 01 puces |
| Filtrer solde / découvert | 02 feuille Trier et filtrer (raccourci « Solde » en 01) |
| Trier nom / solde / dépôts / paiements / ancienneté | 02 |
| Pagination 25 | remplacée par défilement paginé (chargement par lots) de la liste 01 |
| Rechercher un client | 01 (+ recherche globale de l'Accueil, lot 00) |
| Scanner un code client | 01 bouton scanner (caméra + saisie manuelle) |
| Créer un client | 01 « + » → 13 → 14 |
| Envoyer le mdp provisoire sur WhatsApp | 14 |
| Déclarer un dépôt pour le client | 03 geste Dépôt (masqué sans `canProcessDeposits`) |
| Nouveau paiement pour le client | 03 geste Paiement |
| Message au client | 03 geste Message (→ Messages clients) |
| Crédit / Débit manuel | 04 « … » › Crédit / Débit → 06 (masqué sans `canAdjustWallets`, cf. 05) |
| Autoriser / modifier / retirer découvert | 04 › Découvert → 07 ; chiffres en 03 |
| Copier l'identifiant BZ | 12 (copier) ; appui long sur le code en 03 |
| Étiquette colis (image/PDF, bloc fournisseur, copier image) | 11 bouton Étiquette → 12 ; aussi 05 › Documents |
| 6 derniers mouvements | 03 onglet Opérations |
| Historique complet + filtre par type | 08 |
| Relevé de compte PDF (période, langue) | 08 bouton Relevé PDF → 09 |
| Relevé des colis PDF + partage | 11 |
| Dépôts de colis (derniers / tous) | 11 |
| Conteneurs du client | 11 |
| Bénéficiaires : lister / chercher / filtrer / ajouter / modifier / archiver | 10 (ajout et modification en plein écran, même formulaire que le lot paiements ; archivage confirmé par feuille) |
| Modifier le profil (nom, sexe, naissance, email, entreprise, pays, ville) | 04 › Identité |
| Numéros secondaires (voir / modifier) | 04 › Téléphones (« 3 numéros ») |
| Modifier / renseigner l'origine | 04 › Origine |
| Réinitialiser le mdp client | 04 › Nouveau mot de passe (puis feuille « mot de passe généré », copier) |
| Repasser en prospect (éligibilité, commercial, motif) | 04 › Repasser en prospect (feuille : bloquants, commercial suggéré, motif, case) |
| Supprimer le client | 04, en rouge, séparé ; confirmation (solde ≠ 0 ou paiement en cours = refus) |
| Sources : période, filtre type, chiffres | 19 « Origine des clients » |
| Créer une source | 19 « … » › Nouvelle source |
| Modifier / archiver une source | 19 › ligne source → fiche source (archiver confirmé) |
| Détail d'une source : ses clients | 19 › ligne → liste de ses clients → fiche client (retour vers la source) |
| Équipe : filtrer équipe / site, rechercher, voir désactivés | 15 |
| Créer un accès (rôle, site, numéros, fiche commercial) | 15 « + » → 16 (étape 2 : identité, numéros, site, fiche commercial ; succès = PasswordReveal copier / partager) |
| Modifier un membre, changer de rôle, nouveau mdp | 17 « … » |
| Désactiver / réactiver | 17 (confirmé par feuille) |
| Appeler / WhatsApp un membre | 17 |
| Relier / changer la fiche commercial | fiche membre d'un commercial : carte « Fiche commercial » (même place que « Droits » en 17) |
| Agrément commissionnaire | fiche membre d'un commissionnaire : carte Agrément (même place) |
| Ventes : plage, indicateur, empilé / équipe | 18 |
| Ouvrir un commercial | 19 objectifs → 20 |
| Fixer / modifier les objectifs | 20 « Modifier » (feuille 6 cibles) |
| Filtrer les prospects d'un commercial | 21 |
| Confier un prospect | 21 et 22 |
| Créer le compte client d'un prospect | 21 → 13 prérempli |
| Clients apportés par un commercial (+ Appeler) | 20 onglet Clients |
| À vérifier : attribuer / refuser / confier | 18 bandeau, 15 pastille → 22 |
| Commercial : nouveau prospect (assistant, brouillon) | 23 tuile, 24 « + » et brouillon → 25 |
| Commercial : statut / perdu / rouvrir / compléter / modifier section | 26 |
| Commercial : appeler / WhatsApp prospect ou client | 26, 27 |
| Commercial : changer de mois | 23 (en-tête), 27 |
| Commercial : mot de passe / déconnexion | 23 avatar → Moi (haut de Plus) |

# Lot 01 · Navigation — écrans

| # | PNG | Écran | Contenu |
|---|---|---|---|
| 1 | png/01.png | Plus · super admin | Titre + loupe (recherche globale) ; carte profil « Nelson · Super admin · Moi » → Moi ; 12 modules en grille de ronds (3 col.) : Trésorerie, Taux du jour, Analyses, Messages clients (pastille 3), Douane, Mola (mascotte), Coordonnées de paiement, Équipe & ventes, Journal, Justificatifs, Veille, Réglages ; barre admin, onglet Plus. |
| 2 | png/02.png | Moi | Identité (initiale, nom, rôle, email, « Modifier mon profil ») ; Sur ce téléphone : Face ID (interrupteur), Notifications « 5 sur 7 » ; Mon compte : Mot de passe, Clés d'accès « 2 appareils », Langue « Français », Mise à jour « À jour » ; « Se déconnecter » (secondaire). |
| 3 | png/03.png | Moi · Notifications par type | État push du téléphone « Activées » ; un interrupteur par type : dépôts à valider, paiements à faire, messages clients, cargo en retard, nouveau taux, douane à signer, prospects à vérifier. |
| 4 | png/04.png | Moi · Se déconnecter | Feuille de confirmation (absente sur le web aujourd'hui) : bouton noir « Se déconnecter » + « Annuler ». |
| 5 | png/05.png | Scanner | Caméra plein écran, cadre de visée sur une carte client (QR + BZ-4821), « Carte client, colis ou QR cash », Lampe, Saisir le code, fermer. |
| 6 | png/06.png | Scanner · carte client lue | Feuille : Fatou Ndiaye, BZ-4821, téléphone ; solde et colis au bureau ; 4 ronds Dépôt (noir) · Paiement · Colis · Ouvrir ; « Scanner autre chose ». |
| 7 | png/07.png | Recherche | Champ actif « fat » + Annuler ; filtres Tout/Clients/Dépôts/Paiements ; Clients (2, solde) ; Opérations (BZ-PY-…, BZ-DP-…, logo de la méthode, montant + statut). |
| 8 | png/08.png | Notifications | Groupées par jour : dépôt à valider, paiement à faire, message client, conteneur en retard, classement à signer, prospect à vérifier ; chaque ligne mène à sa fiche ; « … » en haut à droite. |
| 9 | png/09.png | Notifications · menu « … » | Feuille du bas : Tout marquer comme lu · Seulement les miennes · Choisir ce que je reçois (→ écran 3). |
| 10 | png/10.png | Une connexion, l'espace de chacun | Tableau blanc : la connexion unique (email, mot de passe, Face ID) → les 7 barres d'onglets par rôle (Équipe, Trésorier, Réceptionnaire, Agent d'entrepôt, Commercial, Agent cash, Commissionnaire agréé) avec leurs pastilles. Chaque rôle a « Plus », donc chaque rôle atteint Moi. |

Non dessinés ici (autres lots) : accueils Réception et Entrepôt.

## Où est rangée chaque capacité de la version ordinateur

| Capacité desktop (ou web / natif actuel) | Nouvelle place |
|---|---|
| Sidebar groupée (Accueil, Mola, Dépôts, Paiements, Clients, Trésorerie, Tableau de bord, Taux, Cargo, Coordonnées, Support, Équipes, Journaux, Paramètres, Tous les outils) | Onglets Accueil · Opérations (dépôts + paiements) · Clients · Cargo ; tout le reste = grille « Plus » (écran 1). Mola : rond sur l'accueil **et** dans Plus (il n'était plus atteignable dans l'app native). |
| Pastilles de la sidebar (dépôts, paiements) | Pastille de l'onglet Opérations ; détail dans les puces de l'écran Opérations (v2). |
| Pastille non-lus du support | Pastille rouge sur « Messages clients » dans Plus (écran 1) + notification (écran 8). |
| Pastille « à signer » douane (n'existait pas) | Onglet « À signer » du commissionnaire (écran 10) ; notification « Classement à signer ». |
| « Tous les outils » / « Plus » mobile (15 lignes avec descriptions) | Grille de 12 ronds sans description ; filtrée par permission (Trésorerie si canViewTreasury, Taux si canManageRates, Équipe & ventes si canManageUsers / canManageSales, Journal si canViewLogs, Messages clients si canAccessSupportChat, Douane si canViewCustoms). |
| Tableau de bord | « Analyses » (Plus). |
| Historique / Journaux | « Journal » (Plus). |
| Support chat · Templates · Quick replies · Statistiques support | « Messages clients » (Plus) ; réponses types, suggestions et statistiques dans son menu « … ». |
| Veille macro | « Veille » (Plus). |
| Douane (absente de la sidebar) | « Douane » (Plus) pour ops/support/clientèle ; espace complet du commissionnaire (onglets À signer · Simulateur · Plus). |
| Carte profil de la sidebar / Profil | Carte profil en haut de Plus → Moi (écran 2) → « Modifier mon profil ». |
| Natif « Moi » (Face ID, push, types de push, mises à jour) — inatteignable pour les rôles `/m` | Moi, atteint depuis Plus par **tous** les rôles (écrans 2, 3). |
| Mot de passe, clés d'accès | Moi › Mon compte (écran 2). Clés d'accès : seulement sur le web (cachées dans l'app, comme aujourd'hui). |
| Langue FR/EN/ZH (mobile seulement) | Moi › Langue (écran 2). |
| Thème (réglé à 2 endroits) | Un seul endroit : Réglages. |
| Réglages › Expédition (adresses en Chine, tarifs cargo) | Réglages (Plus), réservé à canManageUsers ; plus mêlé aux réglages personnels. |
| Coordonnées de paiement (5 entrées) | Une seule : Plus (écran 1). |
| Déconnexion sans confirmation | Moi › Se déconnecter + feuille de confirmation (écran 4). |
| Recherche globale (clients, BZ-DP-…, BZ-PY-…) — absente du mobile | Loupe en haut de Plus (et des listes Opérations/Clients) → écran 7. |
| Cloche + liste déroulante + « Voir tout » | Cloche de l'accueil → Notifications (écran 8) ; « … » : tout marquer comme lu, seulement les miennes, choisir ce que je reçois (écran 9). |
| Taux du jour toujours affiché (barre du haut) | Rond « Taux du jour » dans Plus ; le taux est rappelé dans chaque saisie de paiement (v2, écran 3). |
| Scanner natif (QR cash, PQ-…, BZ-…, autre code), lampe, code inconnu | Rond « Scanner » de l'accueil / onglet Scanner des rôles terrain (écran 5) ; carte client lue → Dépôt · Paiement · Colis · Ouvrir (écran 6) ; « Saisir le code » quand la caméra ne lit pas. |
| Accueil par rôle (`staffHomeFor`) et barres natives par rôle | Une seule connexion, puis la barre du rôle (écran 10). |

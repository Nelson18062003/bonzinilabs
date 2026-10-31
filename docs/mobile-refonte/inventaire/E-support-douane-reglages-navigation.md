# Module E — Support · Douane (équipe) · Mola · « Plus » et réglages · Navigation · Coque native

> Cartographie en lecture seule (21/10/2026), pour la refonte de l'app mobile du personnel (BONZINI HQ).
> Référence : le **desktop** (≥ 1024 px). Toute capacité desktop doit exister dans la nouvelle app mobile.

---

## 1) Résumé

- **Une seule base de code pour la plupart des écrans** : `AdminRouteWrapper` choisit desktop (sidebar `DesktopAppShell` + écran `desktop`) ou mobile (`MobileRouteWrapper` → `MobileAppShell` + `MobileTabBar`). Dans ce module, seuls **Support (liste + conversation)** et **« Tous les outils »** ont un écran desktop dédié ; tous les autres (stats support, réponses types, suggestions, douane, Mola, notifications, réglages, coordonnées, clés d'accès, mot de passe, veille macro, profil) sont **le composant mobile avec `desktop`** : même logique, mise en page plus large. Pour ces écrans, l'écart desktop → mobile tient surtout à la **navigation**, pas aux actions.
- **Le desktop a des capacités en plus** : une **console support en deux colonnes** (liste + conversation côte à côte), une **recherche globale** (clients, références de dépôt et de paiement) et une **cloche de notifications** dans la barre du haut, le **taux du jour** toujours affiché, une **sidebar groupée** avec des pastilles (dépôts, paiements) et un **menu réductible** (Ctrl/⌘ + B).
- **Trois systèmes de navigation se recouvrent sur mobile** : la barre d'onglets du site (Mola · Cargo · Opérations · Clients · Plus), la barre **native** de HQ, qui est **différente** (Accueil natif · Opérations · Scanner · Clients · Plus), et le menu « Plus » du site. Dans l'app native, **Mola et Cargo n'ont plus d'onglet** et **ne sont pas non plus dans « Plus »**. On ne les atteint que par les raccourcis de l'accueil natif.
- **Les permissions de navigation sont incohérentes** entre le desktop, le « Plus » mobile, la barre web et la coque native. Exemples : Taux de change filtré par `canManageRates` sur desktop mais pas sur le « Plus » mobile ; Historique filtré par `canViewLogs` dans la sidebar mais nulle part ailleurs ; les onglets Opérations et Clients du web montrés à tous les rôles.
- **Les noms ne concordent pas** : un même écran porte jusqu'à 5 noms. Le support s'appelle « Support », « Support chat », « Messages des clients », « Messagerie » ou « Conversations » ; les modèles s'appellent « Templates support », « Réponses toutes faites » ou « Réponses types ».
- **Douane** : c'est l'espace du commissionnaire (`customs_broker`, accueil `/m/douane`). File « à signer », revue d'un classement (prendre la fiche, puis Valider, Changer ou Demander), relecture d'un audit DAU (prendre l'audit, rendre l'avis avec le montant récupérable, relancer la lecture IA), veille (publier, corriger ou retirer un avis : `canManageCustoms`), routes et simulateur (outils publics). **Absente de la sidebar desktop** : on la trouve seulement dans « Tous les outils ».

---

## 2) Navigation actuelle

### 2.1 Sidebar desktop — `src/desktop/components/layout/desktopNav.ts` (rendue par `DesktopSidebar.tsx`)

| Groupe | Entrée | Route | Permission | Pastille |
|---|---|---|---|---|
| Principal | Accueil | `/m` (exact) | — | — |
| Principal | Mola (mascotte) | `/m/assistant` | — | — |
| Principal | Dépôts | `/m/deposits` | `canViewDeposits` | dépôts à traiter |
| Principal | Paiements | `/m/payments` | `canViewPayments` | paiements à traiter |
| Principal | Clients | `/m/clients` | `canViewClients` | — |
| Opérations | Trésorerie | `/m/more/treasury` | `canViewTreasury` | — |
| Opérations | Tableau de bord | `/m/dashboard` | — (route non gardée non plus) | — |
| Opérations | Taux de change | `/m/more/rates` | `canManageRates` | — |
| Opérations | Cargo | `/m/cargo` | `canViewCargo` | — |
| Opérations | Coordonnées de paiement | `/m/more/payment-details` | — | — |
| Opérations | Support | `/m/support` | `canAccessSupportChat` | — (pas de non-lus) |
| Système | Mes équipes | `/m/equipe` | `canManageUsers` | — |
| Système | Journaux | `/m/more/history` | `canViewLogs` | — |
| Système | Paramètres | `/m/more/settings` | — | — |
| Système | Tous les outils | `/m/more` (exact) | — | — |
| Pied | Carte profil (avatar, nom, rôle) → `/m/more/profile` ; bouton Se déconnecter (sans confirmation) | | | |

**Barre du haut desktop** (`DesktopTopbar.tsx`) : le titre de section (`activeNavTitle`) et la date ; la **recherche globale** (`DesktopGlobalSearch` : clients par nom ou téléphone, références de dépôt et de paiement, puis lien vers la fiche) ; une pastille « 1 000 000 XAF = ¥… » (`useActiveDailyRate`, à partir de xl) ; la **cloche** (`DesktopNotificationsMenu` : compteur, liste déroulante, « Voir tout » vers `/m/more/notifications`).

**« Tous les outils »** (`DesktopMoreScreen.tsx`, `/m/more` sur desktop) : la carte profil, puis 4 groupes.

| Groupe | Entrées (perm) |
|---|---|
| Outils | Mola · Coordonnées de paiement · Dashboard · Taux de change (`canManageRates`) · **Douane** · Trésorerie (`canViewTreasury`) |
| Activité | Justificatifs · Historique (sans filtre) · Notifications (pastille) · Veille macro |
| Support (groupe : `canAccessSupportChat`) | Support chat (pastille non-lus) · Templates support · Quick replies clients |
| Administration | Mes équipes (`canManageUsers`) · Paramètres |

> Pas de langue, de thème ni de déconnexion ici. Le commentaire dit « dans la sidebar et Paramètres », mais **aucun sélecteur de langue n'existe sur desktop**.

### 2.2 Barre d'onglets web mobile — `src/mobile/components/layout/MobileTabBar.tsx`

Elle est cachée dans l'app native (`MobileAppShell` : `showTabBar && !inApp`).

| Onglet | Route | Actif sur | Permission | Pastille |
|---|---|---|---|---|
| Mola (mascotte) | `/m/assistant` | `/m/assistant` | — | — |
| Cargo | `/m/cargo` | `/m/cargo/*` | `canViewCargo` | conteneurs en retard (`alertTally.late`) |
| Opérations | `/m/ops` | `/m/ops`, `/m/deposits/*`, `/m/payments/*` | **aucune** | dépôts + paiements à traiter |
| Clients | `/m/clients` | `/m/clients/*` | **aucune** | — |
| Plus | `/m/more` | `/m/more/*` | — | — |

> Décision du 13/09/2026 : l'onglet Accueil a été retiré. La route `/m` (MobileHome) existe toujours mais **aucun onglet web n'y mène**. Support, Douane et Dashboard **n'allument aucun onglet**.

### 2.3 « Plus » mobile — `src/mobile/screens/more/MobileMoreScreen.tsx`

| Bloc | Entrée (libellé · description) | Route | Filtre |
|---|---|---|---|
| Carte profil | Prénom Nom · « Modifier mes informations » | `/m/more/profile` | — |
| Outils | Coordonnées de paiement · Banques et Mobile Money · PDF et image à envoyer | `/m/more/payment-details` | — |
| Outils | Tableau de bord · Rapports et indicateurs clés | `/m/dashboard` | — |
| Outils | Taux de change · Gérer les taux XAF/RMB | `/m/more/rates` | **aucun** (desktop : `canManageRates`) |
| Outils | Douane · Simulateur de droits et taxes, codes SH du Cameroun | `/m/douane` | — |
| Outils | Trésorerie · Achats et ventes de dollars numériques, soldes | `/m/more/treasury` | `canViewTreasury` |
| Activité | Justificatifs · Voir les preuves de dépôts | `/m/more/proofs` | — |
| Activité | Historique · Journal d'activité | `/m/more/history` | **aucun** (sidebar : `canViewLogs`) |
| Activité | Notifications · Centre de notifications (pastille) | `/m/more/notifications` | — |
| Activité | Veille macro · Actualité économique et prévisions | `/m/more/briefs` | — |
| Support (`canAccessSupportChat`) | Messages des clients (pastille non-lus) | `/m/support` | — |
| Support | Réponses toutes faites | `/m/more/canned-responses` | — |
| Support | Suggestions aux nouveaux clients | `/m/more/quick-replies` | — |
| Administration | Mes équipes | `/m/equipe` | `canManageUsers` |
| Administration | Paramètres · Thème, préférences | `/m/more/settings` | — |
| Carte | **Langue** (puces FR/EN/ZH, `persistPreferredLocale`) + **Thème** (Clair/Sombre/Auto) | — | — |
| Carte | Déconnexion (rouge, **sans confirmation**) → `/m/login` | — | — |

> **Absents du « Plus »** : Mola et Cargo (supposés être dans la barre web, qui est cachée dans l'app native), Dépôts/Paiements/Clients (idem). Les statistiques support ne sont accessibles que depuis la liste du support.

### 2.4 Coque native HQ — `hq-app/src/tabs.ts` (rendue par `TabBar.tsx`)

Un onglet est soit un **écran natif** (`home`, `scan`, `me`), soit une **page du site** chargée dans la WebView persistante.

| Rôle | Onglets (gauche → droite) |
|---|---|
| super_admin, ops, support, customer_success (défaut) | **Accueil** (natif) · **Opérations** `/m/ops` (retiré si pas `viewPayments`) · **Scanner** (natif, bouton rond central) · **Clients** `/m/clients` · **Plus** `/m/more` (s'allume aussi sur `/m/assistant`, `/m/cargo`, `/m/support`, `/m/dashboard`) |
| treasurer | Accueil (natif) · Trésorerie `/m/more/treasury` · Plus `/m/more` — *pas de Moi en onglet, pas de Scanner* |
| customs_broker | **À signer** `/m/douane` (exact + `/m/douane/revue`) · **Simulateur** `/m/douane/simulateur` · **Moi** |
| cash_agent | Paiements `/a` · Scanner · Moi |
| receptionist | Aujourd'hui `/r` · Paquets `/r/paquets` · Scanner · Clients `/r/clients` · En attente `/r/pending` · Moi |
| warehouse_agent | Journée `/w` · Pointer `/w/arrivees` · Scanner · Remettre `/w/remise/liste` · Moi |
| commercial | Mon mois `/v` · Prospects `/v/prospects` · Mes clients `/v/clients` · Moi |

- **Les rôles de `/m` n'ont pas d'onglet Moi.** On l'ouvre comment, alors ? `me.tsx` n'est poussé que par `onTab` (`t.native === 'me'`), donc **jamais pour super_admin, ops, support, customer_success ni treasurer**. Pour eux, le profil, le mot de passe et la déconnexion passent par le « Plus » web. La section « Mon compte » de `me.tsx` (affichée si `isAdminSpace`) est donc presque inatteignable.
- **Pastilles** (`badges.ts`, rafraîchies toutes les 60 s, au retour dans l'app, à chaque notification et 2,5 s après chaque changement de page). Admin : `ops` = dépôts + paiements à traiter. Réception : `pending` (`reception_my_day`), `packages` (`air_package_packable`, au bureau seulement). Douala : `checkin` et `handover` (`warehouse_day`). Agent cash : `payments` (paiements cash en attente). Le total s'affiche aussi sur l'icône de l'app. **Aucune pastille pour le support, la douane ou le cargo.**
- **Accueil natif** (`HomeScreen.tsx`, rôles de `/m` + treasurer) : la date, « Bonjour {prénom} », le rôle. Deux compteurs si `viewDeposits` ou `viewPayments` : **Dépôts à valider** → `/m/deposits`, **Paiements à traiter** → `/m/payments`. Ils sont lus directement dans `deposits` et `payments`, rafraîchis toutes les 60 s, et on peut tirer pour rafraîchir. Puis des **raccourcis** filtrés par rôle :

| Raccourci | Route | Visible si |
|---|---|---|
| Opérations | `/m/ops` | viewPayments |
| Nouveau paiement | `/m/payments/new` | super_admin, ops |
| Nouveau dépôt | `/m/deposits/new` | super_admin, ops, customer_success |
| Clients | `/m/clients` | viewClients |
| Mola | `/m/assistant` | ≠ treasurer, commercial |
| Cargo | `/m/cargo` | viewCargo |
| Taux du jour | `/m/more/rates` | manageRates |
| Trésorerie | `/m/more/treasury` | viewTreasury |
| Messagerie | `/m/support` | supportChat |
| Coordonnées de paiement | `/m/more/payment-details` | ≠ treasurer, commercial |

- **Moi** (`app/me.tsx`, modal) : l'identité (initiales, nom, email, rôle). « Sur ce téléphone » : **Verrouiller l'app** (Face ID, empreinte ou code ; interrupteur `lockPref`) et **Notifications** (état push ; toucher pour s'inscrire ou ouvrir les réglages). « Ce que je reçois » : un interrupteur par type de push (`staff_push_prefs_get` / `staff_push_set_pref`). « Mon compte » (espace `/m`) : Mon profil, Mon mot de passe, Réglages, chacun ouvrant la page du site. « Application » : Mises à jour (chercher, puis redémarrer). **Se déconnecter** (confirmation `Alert`, puis `unregisterPush`). Version.
- **Scanner** (`app/scanner.tsx` + `scan.ts`) : caméra QR et codes-barres, lampe, vibration, mode continu quand le site l'ouvre (chargement). Depuis l'onglet, l'action dépend du code et du rôle :
  - QR cash : `/a/payment/:id` (agent cash) ou `/m/payments/:id` (admin) ;
  - PQ-xxxxxx : `/w/arrivees?paquet=` ou `/r/paquets?code=` ;
  - BZ-xxxxxx : `/r/new` (réception, code transmis), `/w/remise` (Douala) ou `/m/clients/scan?code=` (admin) ;
  - autre code : `/m/cargo/track?ref=` (admin).
  
  Un code inconnu ouvre une feuille « Code lu » (Copier · Scanner autre chose).
- **Ce qui est natif** : la connexion (`LoginScreen`), le verrou (`LockScreen`), le masque dans le sélecteur d'apps, l'écran hors connexion, l'accueil, le scanner, Moi, les push et les deep links (`bonzinihq://`), les mises à jour OTA, les téléchargements, le partage et le presse-papiers (`bridge.ts`). **Tout le reste est une page web** dans la WebView.

### 2.5 Routage, garde et accueil par rôle

- `AdminRouteWrapper` (`src/desktop/components/AdminRouteWrapper.tsx`) : `useIsDesktop()` et `requireAuth`. Desktop : `ErrorBoundary`, puis `ProtectedAdminRoute`, puis `DesktopAppShell` (écran `desktop`, sinon l'écran mobile centré `max-w-2xl`). Sinon : `MobileRouteWrapper` (`showTabBar`, `false` pour les écrans de détail).
- `ProtectedAdminRoute` : sans session, renvoie vers `/m/login`. **Il redirige seulement receptionist, warehouse_agent et commercial** vers leur espace. `cash_agent`, `customs_broker` et `treasurer` peuvent ouvrir **n'importe quelle URL `/m/*`**. Les écrans se protègent eux-mêmes, au cas par cas.
- `staffHomeFor(role)` (`src/lib/staffHome.ts`) : cash_agent → `/a` · receptionist → `/r` · warehouse_agent → `/w` · customs_broker → `/m/douane` · commercial → `/v` · les autres → `/m`. `staffLoginFor` : `/a/login`, `/r/login`, `/w/login` ou `/v/login` (avec mot de passe), sinon `/m/login`. Sur le site, `/m/login` propose le code email, la clé d'accès et Google ; le mot de passe n'y apparaît que dans l'app HQ. `hq-app/src/roles.ts#staffHome` reprend les mêmes règles.

---

## 3) Rôles et permissions

Source : `ROLE_PERMISSIONS` dans `src/contexts/AdminAuthContext.tsx`. La sécurité réelle est appliquée côté serveur par `admin_has_permission`. ✔ = autorisé.

| Permission | super_admin | ops | support | customer_success | cash_agent | treasurer | receptionist | warehouse_agent | customs_broker | commercial |
|---|---|---|---|---|---|---|---|---|---|---|
| canViewClients | ✔ | ✔ | ✔ | ✔ | | | | | | |
| canEditClients | ✔ | | ✔ | ✔ | | | | | | |
| canViewDeposits | ✔ | ✔ | ✔ | ✔ | | | | | | |
| canProcessDeposits | ✔ | ✔ | | ✔ | | | | | | |
| canViewPayments | ✔ | ✔ | ✔ | ✔ | ✔ | | | | | |
| canProcessPayments | ✔ | ✔ | | | ✔ | | | | | |
| canManageRates | ✔ | ✔ | | | | | | | | |
| canViewLogs | ✔ | ✔ | ✔ | | | | | | | |
| canManageUsers | ✔ | | | | | | | | | |
| canViewTreasury | ✔ | | | | | ✔ | | | | |
| canManageTreasury | ✔ | | | | | ✔ | | | | |
| canAccessSupportChat | ✔ | ✔ | ✔ | ✔ | | | | | | |
| canViewCargo | ✔ | ✔ | ✔ | ✔ | | | | | | |
| canManageCargo | ✔ | ✔ | | | | | | | | |
| canGrantOverdraft | ✔ | | | | | | | | | |
| canReceiveParcels | ✔ | ✔ | | | | | ✔ | | | |
| canRegisterClients | ✔ | ✔ | ✔ | ✔ | | | ✔ | | | |
| canPriceParcels | ✔ | ✔ | | | | | | | | |
| canCollectParcelPayments | ✔ | ✔ | | | | | | ✔ | | |
| canReceiveAtDestination | ✔ | ✔ | | | | | | ✔ | | |
| canReleaseParcels | ✔ | ✔ | | | | | | ✔ | | |
| canViewCustoms | ✔ | ✔ | ✔ | ✔ | | | | | ✔ | |
| canSignCustoms | | | | | | | | | ✔ | |
| canManageCustoms | ✔ | ✔ | | | | | | | | |
| canProspect | | | | | | | | | | ✔ |
| canManageSales | ✔ | | | | | | | | | |

- Libellés (`ADMIN_ROLE_LABELS`) : Super admin, Opérations, Support, Chargé de clientèle, Agent cash, Trésorier, Réceptionnaire, Agent d'entrepôt, Commissionnaire agréé (CAD), Commercial. Côté natif, le CAD s'appelle « Commissionnaire agréé ».
- **Règles codées en dur, hors matrice** :
  - réponses types et suggestions : modifiables par `role === 'super_admin'` seulement (le serveur refuse aussi `reorder_*`) ;
  - réglages d'expédition : `canManageUsers` ;
  - raccourcis de l'accueil natif : « Nouveau paiement » pour super_admin et ops, « Nouveau dépôt » pour super_admin, ops et customer_success.
- **Matrice native réduite** (`hq-app/src/roles.ts`, `PERMS`) : viewClients, viewDeposits, viewPayments, manageRates, viewTreasury, supportChat, viewCargo, receiveParcels, destination. Elle n'a ni customs ni logs, ce qui empêche la coque de proposer la douane aux rôles qui la voient (ops, support…).

---

## 4) Écrans (desktop vs mobile)

« = mobile » veut dire que le desktop rend le composant mobile avec `desktop=true` : même logique, pas d'en-tête mobile.

| Route | Desktop | Mobile | Qui | Données | Filtres, recherche, onglets |
|---|---|---|---|---|---|
| `/m/support` | `DesktopSupportScreen` : **console en 2 colonnes** (liste 372 px + conversation intégrée, ou message « Sélectionnez une conversation ») | `MobileSupportListScreen` (liste seule) + tab bar | `canAccessSupportChat` (sinon un message, sans autre issue) | `chat_conversations` + `clients` + aperçu `chat_messages` : nom, sujet, aperçu ou extrait surligné, temps relatif, assigné, non-lus | Recherche plein texte (≥ 2 caractères, `search_chat_conversations`, intersectée avec la liste) ; Statut Ouvertes/Toutes/Fermées (côté serveur) ; Assignation Toutes/Mes conversations/Non assignées (côté client). Desktop : bouton « Statistiques ». Mobile : icône graphe dans l'en-tête. Mobile seulement : erreur avec « Réessayer » |
| `/m/support/:id` | même console, conversation sélectionnée (`embedded`) | `MobileSupportConversationScreen` plein écran (`ViewportShell`, sans tab bar) | idem | Fil (texte, image, vocal, vidéo, fichier, réponses citées, réactions), indicateur de frappe, bandeau « fermée » | — |
| `/m/support/stats` | = mobile (titre seul, **pas de retour vers la console**) | `MobileSupportStatsScreen` | idem | `get_chat_admin_stats(period)` : conversations ouvertes, messages, non assignées, réponse moyenne et médiane ; volume quotidien Client/Bonzini ; distribution des temps de réponse ; top 5 des admins ; détail par admin ; légende | Période 7/14/30 j |
| `/m/more/canned-responses` | = mobile (bouton « Créer » dans l'en-tête) | `MobileCannedResponsesScreen` (+ en haut à droite) | `canAccessSupportChat` ; écriture : **super_admin** | `chat_canned_responses` : libellé, contenu, variables | — (ordre manuel) |
| `/m/more/quick-replies` | = mobile | `MobileQuickRepliesScreen` | idem | `chat_client_quick_replies` : libellé, contenu, actif/inactif | — |
| `/m/douane` | = mobile, `CustomsShell` desktop (titre) | `StaffCustomsHome`, retour → **`/m/more`** | Tous les staff `/m`. File si `canViewCustoms`, sinon une carte d'accroche **rédigée pour le client** | `customs_review_queue` : **Classements à signer** (produit, client, code proposé, attente ; pastille À vous/Pris/À prendre), **Déclarations à relire** (DAU ou réf, client, enjeu XAF, attente), **Signés récemment** (8) ; Outils : Veille, Routes, Simulateur, « Trouver le code SH » (**même lien** que le simulateur) | — |
| `/m/douane/revue/:id` | = mobile, **2 colonnes** (lecture + décision collante) | une colonne | `canViewCustoms` en lecture ; signature : `canSignCustoms` + agrément enregistré (`is_broker`) | `customs_classification_get` : client, code client, statut, date d'envoi, produit, description, faits, photos (URL signées, `customs-documents`), proposition IA (candidats, faits manquants), fil (repliable), fiche signée | — |
| `/m/douane/audit/:id` | = mobile, 2 colonnes | une colonne | idem | `customs_audit_get` : client, date de paiement, enjeu estimé, avis rendu, lecture en cours ou échouée, synthèse et articles (`useAuditResult`), pièces déposées (liens) | — |
| `/m/douane/veille` | = mobile | `StaffNoticesPage` | Tous ; écriture : `canManageCustoms` ; conteneurs touchés : `canViewCargo` | `customs_notices` (brouillons compris) ; par perturbation, la liste des conteneurs concernés (`cargo_shipments`), cliquable vers `/m/cargo/:id` | Onglets Réglementation / Perturbations (compteurs) ; « Voir les avis terminés (n) » ; ancre `#slug` |
| `/m/douane/routes` | = mobile | `RoutesView admin` | Tous | Atlas Chine → Cameroun : jours porte à porte, km, CO₂e, étapes, carte MapLibre, délais réellement constatés (`useObservedTransit('admin')`), avis sur la route | Mode Mer/Air, départ, destination, port, acheminement intérieur route/rail, poids ; l'état tient dans l'URL ; **Partager** (lien) |
| `/m/douane/simulateur` | = mobile | `SimulatorView admin` | Tous | Nomenclature, calcul droit, TVA…, avis liés au code (vers `/m/douane/veille`) | Produit (recherche), montant, devise, taux XAF, incoterm, fret, assurance, régime ; comparer avec un 2ᵉ code ; Partager ; Recommencer. Le bouton « payer » client est masqué en admin |
| `/m/assistant` | = mobile dans un cadre de 3xl | `ViewportShell` + tab bar web | Tout staff `/m` (aucun filtre à l'écran ; le serveur, `admin-assistant`, filtre par permission `@mola`) | Historique (`assistant_conversations` / `assistant_messages`), actions en attente (`assistant_pending_actions`), images générées | 4 suggestions au démarrage |
| `/m/more` | `DesktopMoreScreen` | `MobileMoreScreen` | Tous | Voir §2 | — |
| `/m/more/notifications` | = mobile (+ cloche de la barre du haut) | liste groupée par jour, tirer pour rafraîchir | Tous | **Dérivée en direct, rien n'est stocké** : dépôts à vérifier ou à corriger, paiements prêts ou en cours, cargo en retard ou à l'arrivée, prospects à vérifier ; montant XAF, date | — (pas de lu/non-lu) |
| `/m/more/settings` | = mobile | `MobileSettingsScreen` | Tous | Thème (ThemeToggle) ; Compte (nom, rôle) ; Sécurité : Connexion rapide (**cachée dans l'app**), Mon mot de passe ; Expédition : Adresses en Chine (`/m/more/shipping`), Tarifs cargo (`/m/more/cargo-pricing`), Coordonnées de paiement ; À propos (version « 1.0.0 » codée en dur) | — |
| `/m/more/payment-details` | = mobile | `PaymentDetailsHub audience="admin"` | Tous | Banques (Ecobank, CCA, UBA, Afriland) et Mobile Money (Orange…) ; lignes copiables | Onglets banque / Mobile Money ; portrait/paysage ; langue FR/EN/les deux (retenue) |
| `/m/more/passkeys` | = mobile | liste des appareils | Tous (masqué dans l'app native) | `webauthn_credentials` : appareil, sauvegardé, créé le, dernier usage | — |
| `/m/more/password` | = mobile | formulaire | Tous | — | — |
| `/m/more/briefs` | = mobile (grille 2 colonnes) | une colonne | Tous | `rate_predictions` (prédiction 24 h, confiance, raisonnement, action conseillée), `macro_snapshots` (Brent, WTI, DXY, EUR/USD, USD/CNY, BTC), `trump_posts`, `briefs_log` | Lecture seule |
| `/m/more/profile` | = mobile (+ carte de la sidebar) | formulaire | Tous | Avatar, prénom, nom, email (verrouillé) | — |

---

## 5) Toutes les actions

| Écran | Action (libellé) | Effet | RPC / table / fonction | Permission (UI → serveur) | Confirmation |
|---|---|---|---|---|---|
| Support liste | Ouvrir une conversation | → `/m/support/:id` | — | canAccessSupportChat | — |
| Support liste | Statistiques | → `/m/support/stats` | — | idem | — |
| Conversation | (auto) Marquer comme lu | non-lus remis à 0 | `mark_conversation_read_admin` | idem | — |
| Conversation | **Je prends** (si non assignée) | s'assigner la conversation + ping Telegram | `claim_chat_conversation` + edge `notify-admin-assignment` via `functions.invoke` (⚠ va contre la règle « pas d'edge function depuis le front » ; best effort) | `is_support_admin` | — |
| Conversation | ⋮ → Voir la fiche client | → `/m/clients/:clientId` | — | — | — |
| Conversation | ⋮ → Assigner à un admin → [admin] / Personne (désassigner) | changer l'assigné + ping | `assign_chat_conversation` + edge | `is_support_admin` | Feuille de choix |
| Conversation | ⋮ → Clore / Rouvrir la conversation | statut fermé/ouvert (rouvre seule au prochain message client) | `close_chat_conversation` / `reopen_chat_conversation` | `is_support_admin` | **aucune** |
| Conversation | Envoyer texte · image (jpeg/png/webp) · vocal · vidéo · fichier ; Répondre à (citation) ; Réagir | insertion dans `chat_messages`, fichier dans le bucket chat | `chat_messages` (insert), Storage | RLS | — |
| Conversation | Insérer une réponse type (sélecteur, variables `{prénom}`…) | pré-remplit la saisie | `chat_canned_responses` (lecture) | — | — |
| Conversation | Indicateur de frappe | diffusion en temps réel | Realtime | — | — |
| Stats | 7 j / 14 j / 30 j | recalcul | `get_chat_admin_stats` | canAccessSupportChat | — |
| Réponses types | Créer / Modifier (libellé, contenu, variables, aperçu) | upsert | `chat_canned_responses` | **super_admin** (UI) | — |
| Réponses types | Monter / Descendre | réordonner | `reorder_canned_responses` | super_admin (serveur) | — |
| Réponses types | Supprimer | delete | `chat_canned_responses` | super_admin | Feuille « Garder / Supprimer » |
| Suggestions | Créer / Modifier (libellé, contenu, actif) · Activer/Désactiver · Monter/Descendre · Supprimer | CRUD + ordre | `chat_client_quick_replies`, `reorder_quick_replies` | super_admin | Suppression : feuille |
| Douane accueil | Ouvrir une fiche, un audit ou un élément signé | → revue ou audit | `customs_review_queue` | canViewCustoms | — |
| Douane accueil | Veille · Routes · Simulateur · Trouver le code SH | navigation | — | — | — |
| Revue classement | **Je prends cette fiche** | la fiche quitte la file des autres | `customs_classification_claim` | canSignCustoms + agrément | — |
| Revue classement | Décision **Valider** (+ ligne nationale de 8 ou 12 chiffres, facultative ; observation facultative) → **Signer le classement** | code final signé ; le client est notifié | `customs_classification_decide(approved)` (`@mola` confirm + danger) | canSignCustoms | **pas de carte** : avertissement en texte « vous engagez votre agrément » |
| Revue classement | Décision **Changer** (choisir un code dans `ProductPicker`, motif **obligatoire**) → Signer | code changé | `…_decide(changed)` | idem | idem |
| Revue classement | Décision **Demander** (question **obligatoire**) → Envoyer la question | statut `needs_info`, le client est notifié | `…_decide(needs_info)` | idem | — |
| Revue classement | Ouvrir une photo ; simuler un candidat ; Retour à la file | navigation | — | — | — |
| Audit DAU | **Relancer la lecture** (échec, non démarré ou bloqué > 7 min) | relance la lecture IA de la DAU | edge `customs-ai` `{action:'read_dau'}` (fetch + JWT) | canViewCustoms | — |
| Audit DAU | **Je prends cet audit** | claim | `customs_audit_claim` | canSignCustoms + agrément | — |
| Audit DAU | Pré-remplir « Réclamable · X » / « Avec reclassement · Y » ; saisir le montant récupérable (XAF, `isSafeInteger`) + l'avis (**obligatoire**) → **Rendre l'avis** | avis signé ; le client est prévenu | `customs_audit_review(p_note, p_recoverable_xaf)` | canSignCustoms | texte d'avertissement seulement |
| Audit DAU | Ouvrir une pièce | URL signée | Storage `customs-documents` | — | — |
| Veille | **Publier un avis** / **Corriger** (type, titre, résumé, à faire, début/fin, lieux, retard en jours, statut, codes SH visés, gravité, source et lien, confiance, identifiant) → Publier ou Enregistrer en brouillon | upsert ; à la publication, notifie les clients concernés (« n client(s) prévenu(s) ») | `customs_notice_upsert` (`@mola` confirm) | **canManageCustoms** | — |
| Veille | **Retirer** | archive l'avis | `customs_notice_archive` | canManageCustoms | Feuille « Retirer cet avis ? » |
| Veille | Ouvrir un conteneur touché | → `/m/cargo/:id` | `cargo_shipments` | canViewCargo | — |
| Routes | Mode, départ, destination, port, intérieur, poids ; **Partager** | URL ; `navigator.share`, sinon copie | `useObservedTransit`, `customs_notices` | — | — |
| Simulateur | Choisir un produit, saisir prix/devise/taux/incoterm/fret/assurance/régime ; **Comparer** ; **Partager** ; **Recommencer** ; ouvrir un avis lié | calcul local | nomenclature | — | — |
| Mola | Envoyer un message (+ jusqu'à **5** pièces jointes image ou PDF, `validateUploadFile`) | appel de l'agent | edge `admin-assistant` (fetch + JWT) | serveur : étiquette `@mola` par RPC | — |
| Mola | Suggestion (4 puces) | envoie le texte | idem | — | — |
| Mola | **Confirmer** / **Annuler** une carte d'action (titre, sous-titre, montant, lignes, bandeau rouge « Action sensible » si `danger`) | exécute ou annule l'action en attente | `confirmAction` / `cancelAction` → `assistant_pending_actions` | permission de la RPC visée | **Carte de confirmation** (le seul vrai « confirm » du module) |
| Mola | **Nouvelle conversation** | `reset()` | — | — | — |
| Mola | Prévisualiser une image ; **Télécharger / ouvrir** | — | — | — | — |
| Notifications | Toucher un élément | → `targetPath` | dérivée (`deposits`, `payments`, `cargo_shipments`, `clients`…) | — | — |
| Notifications | Tirer pour rafraîchir | refetch | — | — | — |
| Plus (mobile) | Langue FR/EN/ZH | `i18n.changeLanguage` + `persistPreferredLocale` | — | — | — |
| Plus / Réglages | Thème Clair/Sombre/Auto | next-themes | — | — | — |
| Plus / sidebar | **Déconnexion** | `logout()` → `/m/login` | — | — | **aucune** (le natif « Moi » en a une) |
| Réglages | Connexion rapide · Mon mot de passe · Adresses en Chine · Tarifs cargo · Coordonnées de paiement | navigation | — | (Expédition : écriture `canManageUsers`) | — |
| Coordonnées | Copier une ligne (RIB, numéro…) | presse-papiers | — | — | — |
| Coordonnées | **PDF** / **Image** par document ; orientation ; langue | génère le fichier ; PDF livré ou téléchargé ; image en aperçu → Partager, Copier l'image ou Télécharger | `paymentDocPdf` / `paymentDocImage`, `bridge` natif | — | — |
| Clés d'accès | **Ajouter cet appareil** | WebAuthn `registerPasskey` | edge + `webauthn_credentials` | — | feuille système |
| Clés d'accès | **Révoquer cet appareil** | supprime la clé | `admin_revoke_passkey` (soi, ou super_admin) | — | **aucune** |
| Mot de passe | Nouveau + confirmation (≥ 10 caractères, ancien mot de passe non demandé) → enregistrer | `changeOwnPassword` (auth) → `/m/more/settings` | Supabase Auth | — | — |
| Profil | Changer la photo (`validateUploadFile`, bucket `avatars`) ; Prénom* ; Nom → Enregistrer | met à jour la fiche → **`/m/more`** | `update_my_admin_profile` (garde `is_admin`), Storage `avatars` | — | — |
| Natif Moi | Verrouiller l'app · Notifications · interrupteurs par type · Mon profil · Mon mot de passe · Réglages · Mises à jour · Se déconnecter | voir §2.4 | `staff_push_prefs_get`, `staff_push_set_pref`, `unregisterPush` | — | Déconnexion : `Alert` |
| Natif Scanner | Lire un code · Lampe · Terminé (mode continu) · Copier · Scanner autre chose | routage `routeScan` | — | selon le rôle | — |
| Natif Accueil | Compteurs (→ dépôts, paiements) · raccourcis · tirer pour rafraîchir | ouvre une page du site | `deposits`, `payments` (count) | selon le rôle | — |

---

## 6) Écarts desktop → mobile (à reprendre dans la refonte)

1. **Console support en 2 colonnes** : sur mobile, c'est un aller-retour liste ↔ conversation. Acceptable, mais il manque : **les non-lus du support dans une pastille d'onglet** (le desktop les montre dans « Tous les outils », pas dans la sidebar), **le statut et l'assigné visibles dans la liste** (c'est déjà le cas) et **un accès direct aux réponses types** depuis la conversation (le desktop non plus ; il n'y a que le sélecteur de saisie).
2. **Recherche globale** (clients, références `BZ-DP-…` et paiements) : **elle n'existe pas sur mobile**. Le desktop l'a dans chaque écran.
3. **Cloche de notifications et compteur** : sur mobile, c'est enfoui dans « Plus » → Notifications. Pas d'accès en un geste, pas de pastille sur un onglet.
4. **Taux du jour toujours visible** (barre du haut) : absent sur mobile hors de l'écran Taux.
5. **Titre de section, date et pastilles de la sidebar** (dépôts et paiements séparés) : sur mobile, une seule pastille « Opérations » (la somme).
6. **Accueil (`/m`)** : sur desktop, entrée n° 1 (DesktopDashboard). Sur mobile web, **aucun onglet n'y mène**. L'app native le remplace par un accueil natif plus pauvre (2 compteurs + raccourcis).
7. **Douane** : desktop dans « Tous les outils » seulement (absente de la sidebar), mobile dans « Plus » seulement. Pour ops, support et customer_success (`canViewCustoms`), la file de revue est enfouie à 2 niveaux. Pas de pastille « à signer ».
8. **Mola et Cargo dans l'app native** : sur desktop, ce sont des entrées de premier niveau ; dans l'app HQ, **aucun onglet ni ligne « Plus »**, seulement les raccourcis de l'accueil natif.
9. **Statistiques support** : sur desktop, on y revient par la sidebar. Sur mobile, on n'y accède que par l'icône de la liste. Rien à perdre, mais l'icône sans libellé (`BarChart3` 16 px) est peu visible.
10. **Langue** : le mobile a un sélecteur dans « Plus », **le desktop n'en a aucun**. La refonte doit le garder.
11. **Révision douane et audit** : le desktop affiche les 2 colonnes (lecture + décision collante). Sur mobile, le bloc « Votre décision » arrive **après tout le dossier**, fil de conversation compris : un long défilement avant le bouton.
12. **Mes équipes** (agrément du CAD, `customs_broker_register`) : on y accède par la sidebar et par « Plus ». La revue renvoie à « votre fiche d'équipe » **sans lien**.

---

## 7) Problèmes UX mobile

**Navigation dupliquée ou contradictoire**
- **Deux barres d'onglets différentes** pour le même rôle admin : web (Mola · Cargo · Opérations · Clients · Plus) et native (Accueil · Opérations · Scanner · Clients · Plus). Le comportement change selon qu'on est dans le navigateur ou dans l'app.
- **Moi (natif) recouvre la carte profil du « Plus » web** pour le profil, le mot de passe, les réglages et la déconnexion. Pour les rôles de `/m`, « Moi » **n'est même pas accessible** (pas d'onglet). Les réglages propres au téléphone (verrou, push, mises à jour) leur sont donc **cachés**.
- **Le thème est réglé à deux endroits** (« Plus », segmenté, et Réglages, `ThemeToggle`). **Les coordonnées de paiement apparaissent 5 fois** (sidebar, Tous les outils, « Plus », Réglages › Expédition, raccourci natif).
- L'onglet natif « Plus » s'allume sur `/m/assistant`, `/m/cargo`, `/m/support` et `/m/dashboard`, alors que ces pages **ne figurent pas** dans « Plus » (Mola, Cargo) : on se croit dans « Plus » sans y trouver le chemin du retour.

**Impasses**
- **La web tab bar montre Opérations et Clients à tous les rôles** : un CAD, un trésorier ou un agent cash qui ouvre `/m/*` dans un navigateur atterrit sur des écrans vides ou interdits. `ProtectedAdminRoute` ne redirige pas cash_agent, customs_broker ni treasurer.
- **Le retour de l'accueil Douane mène à `/m/more`**. Pour le CAD, dont c'est l'écran d'accueil, ce retour ouvre un « Plus » rempli d'outils qu'il ne peut pas utiliser (Tableau de bord, Taux, Justificatifs…, tous sans filtre).
- **Les écrans sans permission** (« Vous n'avez pas accès au support chat. », Douane sans `canViewCustoms`) n'offrent ni retour ni explication.
- **Après l'enregistrement du profil, on est renvoyé vers `/m/more`**, même quand on venait du natif « Moi » ou de la sidebar. **Après le changement de mot de passe, vers `/m/more/settings`**.
- **« Simulateur » et « Trouver le code SH »** (accueil Douane) mènent **à la même page**.
- **Réponses types et suggestions** : les non-super-admins voient un écran en lecture seule avec « Seul un super_admin… », un jargon technique.
- **Taux et Historique** apparaissent dans « Plus » sans filtre de permission : risque d'écran refusé pour support ou customer_success (taux), customer_success ou treasurer (historique).

**Trop de texte et densité**
- Le « Plus » affiche **15 lignes, chacune avec une description en 16 px**, plus une carte langue/thème et la déconnexion : un long défilement pour un menu.
- Les **Réglages** contiennent de longues descriptions (« Sea cargo (entrepôt), air cargo (bureau), téléphone, WeChat, WhatsApp, e-mail — imprimés sur l'étiquette colis… ») et une section « Expédition » de configuration métier qui n'est pas un réglage personnel. « À propos » affiche une version fausse (« 1.0.0 », codée en dur).
- L'accueil Douane, sans `canViewCustoms`, affiche **un argumentaire destiné au client** (« Payez le juste droit… », anecdote DAU) dans l'espace équipe.
- La revue de classement et l'audit empilent des paragraphes d'aide (`hint`, `signNotice`, `claimDesc`) avant chaque action.
- La Veille macro a un style hors système (dégradé violet, emojis 🛢💵🎯, `text-3xl`) : incohérente avec le kit.

**Noms incohérents (un écran = plusieurs noms)**

| Écran | Noms rencontrés |
|---|---|
| `/m/support` | Support (sidebar) · Support chat (Tous les outils) · Messages des clients (Plus) · Messagerie (accueil natif) · Conversations (titre de l'écran) |
| `/m/more/canned-responses` | Templates support · Réponses toutes faites · Réponses types (titre) |
| `/m/more/quick-replies` | Quick replies clients · Suggestions aux nouveaux clients · Réponses rapides clients (titre) |
| `/m/dashboard` | Tableau de bord (sidebar, Plus) · Dashboard (Tous les outils) |
| `/m/more/history` | Journaux (sidebar) · Historique (Plus, Tous les outils) |
| `/m/more/rates` | Taux de change · Taux du jour (accueil natif) |
| `/m/more/settings` | Paramètres · Réglages (natif Moi) |
| `/m/more` | Plus · Tous les outils (desktop) |
| Mola | « Directeur des Opérations » (en-tête) · « Pose une question sur la plateforme » (desc) · icône « sparkles » (accueil natif) vs mascotte |
| Rôle CAD | Commissionnaire agréé (CAD) (site) · Commissionnaire agréé (natif) |

**Profondeur et découvrabilité**
- Support → Statistiques : icône sans libellé. Réponses types et suggestions : 2 niveaux sous « Plus », sans lien depuis la conversation.
- Douane → revue : 3 niveaux pour ops et support (Plus › Douane › fiche). Pas de pastille.
- Réglages › Expédition › Adresses en Chine / Tarifs cargo : de la configuration métier cachée sous les réglages personnels.
- Clés d'accès : cachées dans l'app (normal), mais la route reste ouverte.

**Sûreté et interactions**
- **Aucune confirmation** pour : clore une conversation, révoquer une clé d'accès, se déconnecter (web). Ce sont pourtant des actions lourdes.
- **Signature d'un classement ou d'un avis d'audit** (engage l'agrément du CAD) : **un seul bouton, sans carte de confirmation**. Côté serveur, l'étiquette `@mola` est pourtant `confirm:true, danger:true`.
- Le compositeur de Mola ajoute `MOBILE_TAB_BAR_HEIGHT` (64 px) à sa marge basse **même dans l'app native**, où la barre web est cachée : probable vide de 64 px sous le champ.
- Menu ⋮ de la conversation : une liste flottante sans fond qui la ferme (elle se ferme seulement au choix d'une option).
- Les notifications sont dérivées en direct : pas d'état lu/non-lu, pas de réglage dans la page (les réglages push sont dans le natif Moi, inaccessible aux rôles de `/m`).

---

## 8) Fichiers lus

- Routage et garde : `src/App.tsx` (routes `/m/*`), `src/desktop/components/AdminRouteWrapper.tsx`, `src/components/admin/ProtectedAdminRoute.tsx`, `src/mobile/components/MobileRouteWrapper.tsx`, `src/mobile/components/layout/MobileAppShell.tsx`, `src/mobile/components/layout/MobileTabBar.tsx`, `src/mobile/components/layout/MobileHeader.tsx`, `src/lib/staffHome.ts`, `src/lib/nativeApp.ts`, `src/contexts/AdminAuthContext.tsx`
- Desktop : `src/desktop/components/layout/{DesktopAppShell,DesktopSidebar,DesktopTopbar,DesktopNotificationsMenu,DesktopGlobalSearch}.tsx`, `desktopNav.ts`, `sidebarState.ts`, `src/desktop/screens/more/DesktopMoreScreen.tsx`, `src/desktop/screens/support/DesktopSupportScreen.tsx`
- Support : `src/mobile/screens/support/{MobileSupportListScreen,MobileSupportConversationScreen,MobileSupportStatsScreen,MobileCannedResponsesScreen,MobileQuickRepliesScreen}.tsx`, `src/hooks/{useAdminChat,useAdminChatTools,useCannedResponses,useAdminQuickReplies}.ts`, `src/lib/notify-assignment.ts`, `src/components/support/{MessageInput,ChatThread}.tsx` (survolés), `src/i18n/locales/fr/support.json`
- Douane : `src/pages/customs/{CustomsHomePage,TariffSimulatorPage,ReviewPage,AuditReviewPage,NoticesPage,RoutesPage,shared}.tsx`, `components/{ReviewQueue,NoticeEditor}.tsx`, `site/simulator/{SimulatorView,Result}.tsx` (survolés), `src/hooks/useCustomsReview.ts`, `src/i18n/locales/fr/customs.json`
- Mola : `src/mobile/screens/assistant/MobileAssistantScreen.tsx`, `src/hooks/useAdminAssistant.ts` (survolé)
- Plus et réglages : `src/mobile/screens/more/{MobileMoreScreen,MobileNotificationsScreen,MobileSettingsScreen,MobilePaymentDetailsScreen,MobilePasskeysScreen,MobileChangePasswordScreen,MobileBriefsScreen,MobileAdminProfile,MobileShippingSettings}.tsx`, `src/components/payment-details/PaymentDetailsHub.tsx` (survolé), `src/hooks/{useAdminNotifications,useMacroBriefs}.ts`
- Coque native : `hq-app/src/{tabs.ts,TabBar.tsx,HomeScreen.tsx,roles.ts,badges.ts,scan.ts,PushPrefs.tsx}`, `hq-app/src/app/{index,me,scanner}.tsx`
- Gardes serveur vérifiées : migrations `20260531000000_chat_lot3_lot4.sql`, `20260531100000_chat_lot3_lot4_full.sql`, `20260929120000_customs_foundation.sql`, `20260930090000_customs_notices.sql`, `20260601210000_admin_self_profile.sql`, `20260809120000_webauthn_passkeys.sql`

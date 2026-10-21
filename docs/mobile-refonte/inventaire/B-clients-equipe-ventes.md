# Module B — Clients · Équipe · Ventes/commerciaux (cartographie pour la refonte mobile BONZINI HQ)

> Lecture seule du code au 21/10/2026 (branche courante, sans les modifications non commitées d'un autre agent). Référence = desktop (≥1024 px).

## 1) Résumé

- **Clients** : le desktop est un vrai poste de travail (table triable + filtres solde/statut avec compteurs + pagination 25 + panneau latéral `DesktopClientPanel`) ; le mobile a sa propre liste et sa propre fiche (`MobileClientDetail`), avec **les mêmes mutations** mais moins de données (ni compteurs, ni filtre solde/découvert, ni tri dépôts/paiements, pas de pagination, pas de mouvements récents, pas les numéros secondaires).
- Les sous-écrans **historique, bénéficiaires, scan, colis** sont des écrans *mobiles* que le desktop réutilise (`desktop` prop, ou centré sans prop) : ici, pas d'écart de capacité, seulement de mise en page.
- **Équipe** (`/m/equipe/*`) et **Ventes** (`/m/equipe/ventes/*`), ainsi que **Sources & commerciaux** (`/m/clients/sources`), sont des composants **uniques et responsives** (même JSX sur les deux tailles) : pas d'écart fonctionnel, mais ce sont des pages « web » posées dans le mobile (pas de `MobileHeader`, lien texte « ← Retour », tables et tableaux de bord denses, fenêtres `Modal`).
- Le **commercial** (`/v/*`) a sa propre app mobile-only, soignée (langage `.sales-ui`) : Mon mois · Prospects · Mes clients, plus l'assistant prospect en 7 étapes.
- Principaux problèmes UX mobile : boutons visibles qu'on n'a pas le droit d'utiliser (Crédit/Débit, Dépôt, onglet Clients pour tous les rôles), fiche client très bavarde et longue, vocabulaire incohérent (Crédit/Ajouter de l'argent/Ajouts ; Ventes/Chiffres des commerciaux/Sources & commerciaux), deux portes vers les commerciaux, imbrication profonde (Plus › Mes équipes › Ventes › commercial › À vérifier).

---

## 2) Écrans (desktop vs mobile)

### Garde d'accès générale
- `AdminRouteWrapper` → `ProtectedAdminRoute` : session admin obligatoire ; `receptionist`, `warehouse_agent`, `commercial` sont **renvoyés** vers leur app (`/r`, `/w`, `/v`). **Aucune garde de permission par route** pour `/m/clients*` : seul l'écran Sources (`canViewClients`) et l'écran Colis (`canViewCargo || canViewClients`) se gardent eux-mêmes.
- Desktop : l'entrée « Clients » de la barre latérale exige `canViewClients` ; « Mes équipes » exige `canManageUsers` (`desktopNav.ts`).
- Mobile : l'onglet **Clients** de la barre du bas est montré **à tous les rôles** (`MobileTabBar.tsx`) ; « Mes équipes » est dans Plus › Administration (`canManageUsers`).
- Matrice (front `ROLE_PERMISSIONS`) : `canViewClients` = super_admin, ops, support, customer_success · `canEditClients` = super_admin, support, customer_success · `canManageUsers`, `canGrantOverdraft`, `canManageSales` = super_admin · `canRegisterClients` = + receptionist · `canAdjustWallets` (serveur seulement) = super_admin, ops · `canProspect` = commercial.

### 2.1 `/m/clients` — Liste des clients
| | Desktop `DesktopClientsScreen.tsx` | Mobile `MobileClientsScreen.tsx` |
|---|---|---|
| En-tête | « Clients », « N clients · X actifs » ; boutons **Sources & commerciaux**, **Nouveau client** | Header « Clients » + 3 icônes : Sources & commerciaux (Megaphone), **Scanner** (ScanLine), **+** créer |
| Statut | Chips Tous/Actifs/Inactifs/Suspendus/KYC **avec compteurs** | Mêmes chips **sans compteurs** |
| Solde | DropChip **Solde** : Tous / Avec solde / Solde nul / **En découvert** | — absent |
| Recherche | nom, tél., e-mail, entreprise, BZ- (`matchesClientSearch`) | même fonction (placeholder « Nom, téléphone ou BZ-… ») |
| Tri | En-têtes cliquables + menu Trier : nom, solde, **dépôts**, **paiements**, ancienneté (asc/desc) | Feuille « Trier par » : 6 options (nom, solde, ancienneté) — pas dépôts/paiements |
| Colonnes / carte | Client (avatar, nom, pastille statut, entreprise) · Contact (tél., code BZ, e-mail) · Solde XAF (rouge si < 0) · Dépôts · Paiements · Depuis (âge) | Carte : avatar, nom, pastille, « Solde/Découvert : X XAF », « BZ-… · tél. » |
| Volume | Pagination numérotée 25/page, « 1–25 sur N » | **Tout le roster** rendu d'un coup ; pull-to-refresh ; erreur `QueryError` + réessayer |
| Sélection | Ligne → `/m/clients/:id` = liste compacte + **panneau** (clavier Entrée/Espace) | Carte → page fiche |
| Vide | « Aucun client trouvé » / bouton **Créer un client** | idem |
Données : `useClients()` → `clients`, `wallets`, `deposits` validés, `payments` terminés (supabaseAdmin).

### 2.2 `/m/clients/new` — Nouveau client
- Desktop `DesktopCreateClientDialog` : la liste reste derrière, formulaire `DesktopCreateClient` en fenêtre (URL inchangée, fermer → `/m/clients`). Sections à 2 colonnes Identité · Contact · Localisation · Origine.
- Mobile `MobileCreateClient` + `ClientFormSections` : page unique défilante, bouton **Créer le client** collé en bas, **récapitulatif** (client, WhatsApp, pays) en fin de formulaire.
- Champs (identiques, logique `useCreateClientForm`) : Prénom*, Nom*, Sexe* (obligatoire au bureau), Date de naissance (JJ/MM/AAAA, facultative), Entreprise ; WhatsApp principal* (libphonenumber, tous pays/drapeaux) + jusqu'à 10 numéros avec libellé ; Email (facultatif, suggestion depuis un prospect) ; Pays* (suit l'indicatif), Ville ; **Origine** (`ClientSourcePicker`, facultative). `?phone=+237…` préremplit depuis un prospect (note « repris de la fiche prospect »).
- Succès : mot de passe provisoire (copier), **Envoyer sur WhatsApp au +…**, alertes si numéros secondaires / identité / origine non enregistrés ; **Voir la fiche** / **Retour à la liste**.
- RPC : `admin_create_client` → `admin_set_client_phones` → `admin_set_client_identity` → `set_client_source`. Aucune garde UI (pas de `canRegisterClients` côté écran ; serveur).

### 2.3 `/m/clients/:id` — Fiche client
| Bloc | Desktop `DesktopClientPanel` (panneau 560 px à droite de la liste) | Mobile `MobileClientDetail` (page) |
|---|---|---|
| En-tête | Avatar, nom, pastille statut, `BZ-… · tél. · entreprise` ; bouton primaire **Dépôt** ; menu **⋯** (canManageUsers) ; **×** fermer | Header « Client » + retour ; avatar initiales, pastille, nom, entreprise |
| Identité | Grille « Coordonnées » + lien **Modifier** : Téléphone (**principal + numéros secondaires avec libellé**), E-mail, Entreprise, Ville/Pays, Sexe, Naissance, Client depuis, **Origine** (modifiable), **Enregistré par** | Phrases : « Téléphone : [lien tel:] » (principal seulement ; avertissement si absent : pas de SMS), Email, « À ville, pays », Sexe, Naissance, Client depuis, Origine (modifiable), Enregistré par |
| Solde | « Solde disponible / en découvert » XL, **Historique complet →**, boutons **Crédit** / **Débit**, dernier mouvement ; bandeau découvert « autorisé X · utilisé Y · disponible Z » + **Autoriser un découvert → / Modifier →** (canGrantOverdraft) | Section « L'argent » : solde 28 px, phrases découvert, « Au total, a déposé X et payé Y » ; boutons **Ajouter de l'argent**, **Retirer de l'argent**, **Autoriser un découvert / Modifier le découvert autorisé** ; lien **Historique** |
| Totaux | 2 tuiles Total dépôts / Total paiements | dans la phrase ci-dessus |
| Identifiant | QR + code BZ, **Copier**, **Étiquette colis** (fenêtre 960 px, `ShippingLabelComposer` mode admin, split : mode Sea/Air, **bloc fournisseur**, aperçu, copier/télécharger image + PDF) | Carte « Étiquette colis » (texte + bouton) → `MobileShippingLabelSheet` (Sea/Air, **Envoyer l'image**, **Envoyer le PDF**, Télécharger ; **sans bloc fournisseur**) + `CustomerCodeCard` (**Copier l'identifiant**) |
| Mouvements | **6 derniers mouvements** inline + **Voir tout (N)** | absent (seulement lien Historique) |
| Colis (canViewCargo) | « Colis reçus » : total colis/kg/m³, « n à Guangzhou… » (prend en compte air_shipment_id), **Relevé des colis (PDF)**, **Voir tout (N)**, **3 derniers dépôts** cliquables (→ `/m/cargo/reception/:id`, statut d'étape) | « Ses colis reçus » : 1 ligne résumé (« n à l'entrepôt » — **ignore air_shipment_id**) → Tout voir |
| Conteneurs | — absent | « Son conteneur / Ses N conteneurs » : n° conteneur/BL, phrase d'arrivée, pastille d'alerte → `/m/cargo/:id` ; lien Cargo |
| Raccourcis / gestes | **Bénéficiaires**, **Relevé PDF** ; menu ⋯ : **Modifier le profil**, **Réinitialiser mot de passe**, **Repasser en prospect** (canManageUsers+canManageSales), **Supprimer le client** | Section « Les gestes » (lignes avec description) : **Déclarer un dépôt**, **Suivre un conteneur** (→ `/m/cargo/track`, générique), **Ses bénéficiaires**, **Télécharger le relevé** (N opérations), **Modifier ses informations**, **Nouveau mot de passe**, **Repasser en prospect**, **Supprimer ce client** |
| Dialogues | `CenterDialog` | `BottomSheet` / `AdjustmentDrawer` |

Dialogues (mêmes contenus sur les deux) :
- **Crédit/Débit manuel** : solde actuel, disponible avec découvert, Montant XAF*, nouveau solde (alerte « passe en découvert »), Motif* (« visible par le client »), avertissement « enregistrée avec votre nom, irréversible ». Mobile valide `isValidXafAmount` ; desktop `> 0`. RPC `create_wallet_adjustment` (serveur `canAdjustWallets`).
- **Découvert** (`OverdraftDialog`, canGrantOverdraft) : préréglages, plafond libre, motif*, **Retirer le découvert** (0). RPC `admin_set_wallet_overdraft`.
- **Modifier le profil** : Prénom, Nom, Sexe, Naissance, numéros (éditeur multi-numéros), Email, Entreprise, Pays (combobox), Ville. RPC `admin_set_client_phones` (si changés) + **UPDATE direct `clients`** (`useUpdateClient`) + `admin_set_client_identity` (si sexe/date changent).
- **Réinitialiser le mot de passe** : confirmation → `admin_reset_client_password` → fenêtre « Mot de passe généré » (copier, « ne sera plus affiché »).
- **Supprimer** : pré-contrôle front (solde > 0 refusé ; paiements en cours refusés, lecture `payments`) → confirmation « irréversible » → `admin_delete_client`.
- **Repasser en prospect** (`ClientToProspectDialog`, feuille ou fenêtre) : `admin_client_prospect_eligibility` (bloquants listés sans bouton ; avertissements), choix du commercial (suggéré), motif, case à cocher → `admin_client_to_prospect` → retour liste + toast avec lien vers la page du commercial.
- **Relevé PDF** (`StatementPeriodSheet`) : période + langue → lecture de toutes les écritures (`fetchLedgerEntriesInRange`) → PDF.
- **Origine** (`ClientOrigin`) : Modifier (canEditClients) / Renseigner si vide (canRegisterClients) → `set_client_source`.

### 2.4 `/m/clients/:id/ledger` — Historique
- Même composant `MobileClientLedger` (desktop = `desktop` prop : titre simple, pas de header).
- Phrase solde du jour ; chips Tout / Dépôts / Paiements / Ajouts / Retraits / Transport ; chaque écriture : montant signé coloré, libellé + « il y a… », description, « Solde après », « Par Nom » ; défilement infini ; pull-to-refresh. **Pas** de recherche, de filtre de dates ni d'export (ni desktop ni mobile). Onglets du bas visibles sur mobile (route sans `showTabBar={false}`).

### 2.5 `/m/clients/:id/beneficiaries` — Bénéficiaires
- `MobileClientBeneficiaries` (desktop = même composant, bouton « Ajouter » dans l'en-tête).
- Recherche (alias, nom, identifiant, compte, tél.), chips par mode (Tous + modes Alipay/WeChat/banque/…), liste : pastille couleur du mode, alias/nom, « Par … » ; actions **Modifier** (crayon) et **Archiver** (corbeille → feuille de confirmation « ne sera plus proposé »). Sous-vue plein écran Ajouter/Modifier (`BeneficiaryForm`, QR code, mode verrouillé en édition). Table `beneficiaries` + storage QR (supabaseAdmin). Aucune garde UI.

### 2.6 `/m/clients/:id/parcels` — Colis reçus
- `MobileClientParcels` seulement (pas de version desktop : centré dans la coque desktop). Garde : `canViewCargo || canViewClients`.
- 3 StatCards Colis/Poids/Volume ; **Relevé des colis** : Télécharger (PDF) + **Partager** (feuille native) ; liste des dépôts (lieu, n°, statut d'étape, colis/kg/m³, date, reçu par, descriptions) → `/m/cargo/reception/:id`.

### 2.7 `/m/clients/scan` — Scanner un client
- Mobile : caméra (`html5-qrcode`) + saisie manuelle BZ-… ; desktop (`desktop` prop) : **saisie manuelle seulement**. `/c/:code` redirige ici avec `?code=` (résolution immédiate). RPC `find_client_by_customer_code` (canViewClients). Pas de bouton d'accès sur desktop (URL seulement).

### 2.8 `/m/clients/sources(/:id)` — Sources & commerciaux
- `ClientSourcesScreen` unique (table ≥ md, cartes en dessous). Garde `canViewClients`.
- Liste : lien ← Clients, `DateRangePicker` (ce mois par défaut), **Nouvelle source** (canRegisterClients || canEditClients ; carte en ligne : type Commercial/Recommandation/Réseaux sociaux/En ligne/Événement/Autre, nom, tél. selon type) ; 3 chiffres (clients au total, nouveaux sur la période, origine non renseignée) ; chips Toutes/types/Inconnues ; colonnes Source · Clients (+n) · Dépôts validés · Paiements · Colis (n · kg · m³). Mobile : cartes, **m³ masqués**, indices des chiffres masqués.
- Détail : **Modifier** (nom, tél.) et **Archiver/Réactiver** (canEditClients, sources non système, **sans confirmation**) ; 4 chiffres ; « Ses clients » (code, entreprise, depuis, dépôts, paiements, colis) → fiche client.
- RPC : `get_client_source_report`, `get_client_source_clients`, `create_client_source`, `update_client_source`.

### 2.9 `/m/equipe` — Mes équipes
- `TeamScreen` unique. Garde `canManageUsers` (sinon → `/m`). Lecture `team_members`.
- En-tête « N accès actifs · n désactivés · vous seul créez et retirez les accès » ; **Chiffres des commerciaux** (canManageSales) ; **Nouvel accès**.
- Chips par équipe (Toute l'équipe, Direction, Bureau, Commerciaux, Guangzhou, Douala, Douane — avec compteurs) ; chips par **site** (+ Sans site) ; recherche (nom, email, tél., site) ; **Voir/Masquer les désactivés**.
- Sections par équipe ; « + Ajouter un commercial » dans Commerciaux. Ligne : initiales, nom (barré si désactivé), pastille rôle, site, « désactivé », email · tél. (« et n autres ») · « fiche « X » », alerte « Pas encore relié à sa fiche commercial », **dernière connexion (masquée sur mobile)**.

### 2.10 `/m/equipe/nouveau` — Nouvel accès
- `TeamNewMember` (canManageUsers). Étape 1 : choix du **rôle** (cartes par équipe : libellé, description, espace d'arrivée) ; `?role=commercial` saute l'étape. Étape 2 : Prénom, Nom, Email (connexion), numéros (principal facultatif), **Site** (`TeamSitePicker`, proposé selon le rôle, **+ créer un site** → `team_create_site`) ; commercial : **Nouvelle fiche à son nom / Reprendre une fiche existante** (liste des fiches libres, alerte homonyme).
- Succès : rôle + espace + site, alerte profil incomplet, fiche reliée, `PasswordReveal` (mot de passe, email, page de connexion, **Copier le message**, **Partager**) ; **Voir sa fiche**, **Créer un autre accès**.
- RPC `team_create_member` (+ `team_set_member_profile`).

### 2.11 `/m/equipe/:userId` — Fiche membre
- `TeamMemberScreen` (canManageUsers). Infos : Email, téléphones (drapeau, Principal/libellé, **Appeler**, **WhatsApp**), Site, Arrive sur, Dernière connexion, Accès créé le, description du rôle ; pastilles rôle/équipe/Actif-Désactivé/« c'est vous ».
- Actions : **Modifier** (nom, numéros, site), **Changer de rôle** (pas soi-même ; avertissements commercial), **Nouveau mot de passe** (ou **Changer mon mot de passe** → `/m/more/password` si soi-même), **Désactiver / Réactiver l'accès** (pas soi-même).
- Commercial : « Sa fiche commercial » — non reliée : **Créer sa fiche à son nom** / **Reprendre une fiche existante** ; reliée : **Changer de fiche**, **Ses chiffres et objectifs** (canManageSales) + 4 mini-chiffres du mois (clients, paiements, fret avion, bateau).
- Commissionnaire : `BrokerLicenseCard` (société, n° d'agrément, représentant, actif/suspendu ; feuille d'édition).
- RPC : `team_update_member`, `team_set_member_profile`, `toggle_admin_status`, `admin_reset_password`, `team_link_commercial`, `commercial_dashboard`.

### 2.12 `/m/equipe/ventes` — Ventes (vue d'ensemble)
- `SalesBoard` (canManageSales). En-tête : ← Mes équipes, « N commerciaux actifs », **À vérifier (badge)**, **+ Commercial**.
- `SalesDashboardBody` : plage 3/6/12 mois/12 semaines (dans l'URL `?periode=`) ; **8 tuiles** (clients total, prospects ajoutés + % convertis, paiements, dépôts, clients actifs, fret avion kg, vols, bateau m³) avec tendance/mini-courbe, une tuile = choix de l'indicateur ; **Évolution** (switch d'indicateur, empilé par commercial / équipe) ; **Prospects** (entonnoir) ; **Fret** ; **Qui fait quoi** : classement (→ page commercial) + **Objectifs du mois** (jauges, rythme, relances, à vérifier). Note de définitions. RPC `sales_series`, `sales_overview`, `prospect_claims_pending`.

### 2.13 `/m/equipe/ventes/:sourceId` — Un commercial
- `SalesCommercial` (canManageSales). En-tête : nom, fiche, tél., « sans compte / accès désactivé / archivée », **Son accès** (→ fiche membre).
- Même tableau de bord (lui seul) ; **Objectifs** (MonthSwitcher, **Fixer / Modifier** → fenêtre 6 cibles : nouveaux clients, paiements, fret avion, bateau, prospects ajoutés, prospects convertis → `set_commercial_objective`) ; **Ses prospects** (chips En cours/À vérifier/Devenus clients/Perdus avec compteurs ; ligne : nom, entreprise/ville, tél. +n, motif perdu, **problèmes**, relance ; actions **Décider** (to_verify), **Créer son compte client** (→ `/m/clients/new?phone=`), **Confier à…** (`prospect_reassign`)) ; **Les clients qu'il a apportés** (paiements, avion, bateau du mois, **Appeler**, → fiche client). RPC `commercial_dashboard`, `prospects` (table), `commercial_clients`.

### 2.14 `/m/equipe/ventes/a-verifier` — À vérifier
- `ProspectClaims` (canManageSales). Filtres URL `?commercial=` / `?fiche=` (mise en évidence). Par fiche : ce que le commercial a saisi (nom, entreprise, ville, numéros, problèmes, aide attendue) vs **client(s) reconnu(s) par le numéro** (origine, dépôts/paiements, déjà refusé le…, **Ouvrir la fiche**), choix si plusieurs. Actions : **Refuser** (note interne facultative ; motif fixe « Déjà client de Bonzini »), **Confier à un commercial actif** (fiche archivée), **Attribuer à X** (confirmation). RPC `prospect_claims_pending`, `prospect_resolve_claim`, `prospect_reassign`.

### 2.15 App commercial `/v/*` (mobile-only, `canProspect`)
- Coque `CommercialRouteWrapper` : sans session → `/v/login` (email puis mot de passe) ; autre rôle → son espace. Barre 3 onglets (masquée dans l'app native) : **Mon mois** · **Prospects** (badge relances échues) · **Mes clients**.
- **`/v` Mon mois** : salutation, fiche (archivée ?), menu compte (**Mon mot de passe**, **Se déconnecter**) ; **Nouveau prospect** ; notes d'action **n prospects à relancer** / **n fiches à vérifier** ; MonthSwitcher ; cartes Paiements & dépôts (bascule + courbe 6 mois), Objectifs (jauge + rythme : atteint/dans le rythme/sous le rythme/non atteint), Mes clients (nouveaux/total/actifs + courbe), Mes prospects (ajoutés/convertis/perdus + entonnoir cliquable → filtres), Fret (avion/vols/bateau) ; carte « vos chiffres arrivent… » si vide ; avis « fiche non reliée ». RPC `commercial_dashboard`, `sales_series`, `prospects`.
- **`/v/prospects`** : **+ Nouveau**, reprise de **brouillon**, recherche (nom, entreprise, ville, email, numéros), chips Ouverts / À relancer / À vérifier / À contacter / Contacté / Intéressé / Devenus clients / Perdus / Tous (dans l'URL `?filtre=`), ligne → fiche ; tag « À compléter ».
- **`/v/prospects/new`** : assistant 7 étapes (Identité · Pour le joindre · Activité · Ses problèmes · Comment l'aider · La suite · Récapitulatif), brouillon local par compte, vérif. des numéros en direct (`prospect_phone_check`), enregistrement « À vérifier » si numéro client. RPC `prospect_create`.
- **`/v/prospects/:id`** : nom/entreprise/ville/statut ; numéros (**Appeler**, **WhatsApp** chacun), email ; statut segmenté À contacter/Contacté/Intéressé ; **Marquer perdu** (feuille : motifs rapides + texte ≥ 3) ; **Rouvrir** (si numéros libres) ; bandeaux « Fiche incomplète → Compléter », « À vérifier » ; sections avec **Modifier** (`?modifier=<étape>`). RPC `prospect_set_status`, `prospect_update`, `prospect_phone_check`.
- **`/v/clients`** : MonthSwitcher (≤ mois en cours), recherche, 4 chiffres (clients/actifs, paiements, fret avion, bateau), lignes (code, depuis, paiements, avion, bateau) + **Appeler** / **WhatsApp**. Pas d'accès aux fiches `/m`. RPC `commercial_clients`.
- **`/v/password`** : nouveau mot de passe (≥ 10) + confirmation.

---

## 3) Toutes les actions

| Action | Écran desktop | Écran mobile | RPC / table | Permission (UI → serveur) |
|---|---|---|---|---|
| Filtrer statut (avec compteurs) | Liste clients | Liste (sans compteurs) | — (client) | — |
| Filtrer solde / découvert | Liste clients | **absent** | — | — |
| Trier dépôts / paiements | Liste clients | **absent** | — | — |
| Paginer (25) | Liste clients | **absent** (tout rendu) | — | — |
| Rechercher un client | Liste + recherche globale topbar (`useGlobalAdminSearch`) | Liste seulement | `clients` | canViewClients (nav desktop) |
| Scanner un code client | URL seulement (saisie manuelle) | Liste → icône Scan (caméra + manuel) | `find_client_by_customer_code` | canViewClients (serveur) |
| Créer un client | Liste → fenêtre | Liste → page | `admin_create_client`, `admin_set_client_phones`, `admin_set_client_identity`, `set_client_source` | aucune UI → serveur (canRegisterClients/…) |
| Envoyer mdp provisoire sur WhatsApp | Succès création | Succès création | lien wa.me | — |
| Déclarer un dépôt pour le client | Panneau « Dépôt » | Gestes « Déclarer un dépôt » | → `/m/deposits/new?clientId=` | **aucune UI** (canProcessDeposits à l'écran suivant) |
| Crédit manuel | Panneau « Crédit » | « Ajouter de l'argent » | `create_wallet_adjustment` | **aucune UI** → canAdjustWallets (super_admin, ops) |
| Débit manuel | Panneau « Débit » | « Retirer de l'argent » | `create_wallet_adjustment` | idem |
| Autoriser / modifier / retirer découvert | Bandeau découvert | Bouton sous le solde | `admin_set_wallet_overdraft` | canGrantOverdraft |
| Copier l'identifiant BZ | Carte QR « Copier » | `CustomerCodeCard` | presse-papiers | — |
| Étiquette colis (image/PDF) | Fenêtre composer (avec bloc fournisseur, copier image) | Feuille (Envoyer image/PDF, télécharger ; sans fournisseur) | canvas local, `platform_settings` | — |
| Voir l'historique | « Historique complet » / « Voir tout » | « Historique » | `ledger_entries` | — |
| Filtrer l'historique par type | Historique (écran mobile réutilisé) | Historique | `ledger_entries` | — |
| Relevé de compte PDF (période, langue) | Raccourci « Relevé PDF » | Geste « Télécharger le relevé » | `ledger_entries` (+ PDF) | — |
| Voir 6 derniers mouvements | Panneau | **absent** | `ledger_entries` | — |
| Relevé des colis PDF | Panneau (« Relevé des colis (PDF) ») + page Colis | Page Colis seulement (+ Partager) | `useClientDeposits` | canViewCargo |
| Voir dépôts de colis (3 derniers / tous) | Panneau + page Colis | Résumé + page Colis | réception | canViewCargo |
| Voir les conteneurs du client | **absent** | Section conteneurs | `useCargoShipments` | canViewCargo |
| Suivre un conteneur (générique) | — | Geste → `/m/cargo/track` | — | canViewCargo |
| Bénéficiaires : lister/chercher/filtrer | Raccourci → même écran | Geste → écran | `beneficiaries` | aucune UI |
| Bénéficiaire : ajouter / modifier (+QR) | idem | idem | `beneficiaries` + storage | aucune UI |
| Bénéficiaire : archiver (confirmation) | idem | idem | `beneficiaries` | aucune UI |
| Modifier le profil (nom, sexe, naissance, numéros, email, entreprise, pays, ville) | Menu ⋯ / « Modifier » | Geste « Modifier ses informations » | `admin_set_client_phones`, **UPDATE `clients`**, `admin_set_client_identity` | canManageUsers (UI) |
| Modifier / renseigner l'origine | Grille « Origine » | Ligne « Origine » | `set_client_source` | canEditClients / canRegisterClients si vide |
| Réinitialiser le mdp client | Menu ⋯ | Geste « Nouveau mot de passe » | `admin_reset_client_password` | canManageUsers |
| Repasser en prospect | Menu ⋯ | Geste | `admin_client_prospect_eligibility`, `admin_client_to_prospect` | canManageUsers + canManageSales |
| Supprimer le client | Menu ⋯ | Geste | lecture `payments` + `admin_delete_client` | canManageUsers |
| Sources : changer période / filtrer type | Sources | Sources (cartes) | `get_client_source_report` | canViewClients |
| Créer une source | Sources | Sources | `create_client_source` | canRegisterClients ∨ canEditClients |
| Modifier / archiver une source | Détail source | Détail source | `update_client_source` | canEditClients (pas de confirmation) |
| Équipe : filtrer équipe/site, rechercher, voir désactivés | Mes équipes | Mes équipes | `team_members` | canManageUsers |
| Créer un accès (rôle, site, numéros, fiche commercial) | Nouvel accès | Nouvel accès | `team_create_member`, `team_set_member_profile`, `team_create_site` | canManageUsers (super_admin) |
| Copier / partager le message d'accès | Succès / mdp | idem (+ partage natif) | — | — |
| Modifier un membre (nom, numéros, site) | Fiche membre | Fiche membre | `team_update_member`, `team_set_member_profile` | canManageUsers |
| Changer le rôle | Fiche membre | Fiche membre | `team_update_member` | canManageUsers (pas soi) |
| Désactiver / réactiver | Fiche membre | Fiche membre | `toggle_admin_status` | canManageUsers (pas soi) |
| Nouveau mdp membre | Fiche membre | Fiche membre | `admin_reset_password` | canManageUsers (soi → `/m/more/password`) |
| Appeler / WhatsApp un membre | Fiche membre | Fiche membre | tel:/wa.me | — |
| Relier / changer la fiche commercial | Fiche membre | Fiche membre | `team_link_commercial` | canManageUsers |
| Agrément commissionnaire | Fiche membre | Fiche membre | (BrokerLicenseCard) | canManageUsers |
| Ventes : plage, indicateur, empilé/équipe | Ventes | Ventes | `sales_series`, `sales_overview` | canManageSales |
| Ouvrir un commercial (classement / objectifs) | Ventes | Ventes | — | canManageSales |
| Fixer / modifier les objectifs du mois | Page commercial | Page commercial | `set_commercial_objective` | canManageSales |
| Filtrer les prospects d'un commercial | Page commercial | idem | `prospects` | canManageSales |
| Confier un prospect à… | Page commercial / À vérifier | idem | `prospect_reassign` | canManageSales |
| Créer le compte client d'un prospect | Page commercial | idem | → `/m/clients/new?phone=` | canRegisterClients ∨ canEditClients |
| Appeler un client du commercial | Page commercial | idem | tel: | — |
| À vérifier : attribuer / refuser (note interne) | À vérifier | idem | `prospect_resolve_claim` | canManageSales |
| Commercial : nouveau prospect (assistant, brouillon) | — | `/v/prospects/new` | `prospect_create`, `prospect_phone_check`, `prospect_lookup_phone` | canProspect |
| Commercial : changer statut / perdu / rouvrir | — | `/v/prospects/:id` | `prospect_set_status` | canProspect |
| Commercial : modifier une section / compléter | — | `/v/prospects/:id?modifier=` | `prospect_update` | canProspect |
| Commercial : appeler / WhatsApp prospect ou client | — | fiche prospect / Mes clients | tel:/wa.me | canProspect |
| Commercial : changer de mois | — | Mon mois / Mes clients | `commercial_dashboard`, `commercial_clients` | canProspect |
| Commercial : mot de passe / déconnexion | — | menu compte | auth | canProspect |

---

## 4) Écarts desktop → mobile

**Manquant ou dégradé sur mobile (à rétablir dans la refonte)**
1. Liste clients : **compteurs par statut**, **filtre Solde** (avec solde / nul / **en découvert**), **tri dépôts/paiements**, colonnes **Dépôts/Paiements/Email/entreprise** par ligne, **pagination** (le mobile rend tout le roster : coût en mémoire et en défilement).
2. **Recherche globale** clients/dépôts/paiements (topbar desktop `DesktopGlobalSearch`) : pas d'équivalent mobile.
3. Fiche : **6 derniers mouvements** inline (le mobile oblige à ouvrir l'historique).
4. Fiche : **numéros secondaires** (avec libellé) non affichés sur mobile (seul le principal) — alors qu'ils sont éditables dans la feuille Modifier.
5. Fiche : **Relevé des colis (PDF)** et **3 derniers dépôts** directement sur la fiche (mobile : un niveau plus bas, page Colis).
6. Fiche : **tuiles Total dépôts / Total paiements** et bandeau découvert « autorisé · utilisé · disponible » chiffré (mobile : en phrases, sans « utilisé » quand solde ≥ 0).
7. Étiquette colis : **bloc fournisseur** et **copier l'image** absents (choix fondateur 14/09 — à confirmer pour la refonte).
8. Compte « en attente » sur mobile : « n à l'entrepôt » **ne tient pas compte de `air_shipment_id`** (le desktop si) → un colis parti en avion apparaît encore « à l'entrepôt ». Bug d'incohérence.
9. Équipe : **dernière connexion** masquée dans la liste sur mobile (`hidden sm:block`).
10. Sources : **m³** et indices des chiffres masqués sur mobile.

**Présent sur mobile, absent sur desktop (à garder, et à envisager côté desktop)**
- **Scanner** un QR client (caméra) + bouton d'accès dans la liste (desktop : URL seulement, saisie manuelle).
- **Conteneurs du client** sur la fiche (+ lien Cargo).
- Partage natif du **relevé des colis** et de l'**étiquette** (feuille de partage).
- Pull-to-refresh, lien `tel:` sur le téléphone.

**Pas d'écart (même composant)** : historique, bénéficiaires, colis, Sources & commerciaux, Mes équipes, Nouvel accès, fiche membre, Ventes, page commercial, À vérifier. Les écarts y sont **de forme** (pages web non adaptées), voir §5.

**Écarts de droits (les deux tailles)**
- Crédit/Débit visibles pour tous (support, customer_success…) alors que le serveur exige `canAdjustWallets` (super_admin, ops) → erreur après saisie.
- Bouton Dépôt / Déclarer un dépôt sans `canProcessDeposits`.
- Pas de garde de route sur `/m/clients*` : treasurer, customs_broker, cash_agent (s'il passe par `/m`) voient l'onglet Clients et une liste vide (RLS, échec silencieux).
- Colis : page accessible avec `canViewClients` seul, mais la section n'apparaît sur la fiche qu'avec `canViewCargo`.

---

## 5) Problèmes UX mobile

**Impasses / erreurs silencieuses**
- Onglet **Clients** pour tous les rôles ; liste vide sans explication pour les rôles sans `canViewClients`.
- **Ajouter / Retirer de l'argent** proposé à des rôles que le serveur refuse (commentaire du code : « l'UI ne cache rien »).
- **Suivre un conteneur** sur la fiche client ouvre le suivi *générique* (`/m/cargo/track`), pas ses conteneurs : geste trompeur.
- Prospects côté direction : aucune **fiche prospect** consultable (pas de notes, historique, statut modifiable) — seulement liste, « Décider », « Confier à… », « Créer son compte client ».
- Archiver une source : **sans confirmation**.
- Suppression : pré-contrôle front sur solde **> 0** seulement — un client **en découvert** passe le contrôle (à vérifier côté `admin_delete_client`).

**Trop de texte / densité**
- Fiche client mobile en **phrases** (« Téléphone : … . », « À Douala, Cameroun. », « Au total, ce client a déposé… ») : lente à scanner, longue. Carte « Étiquette colis » avec paragraphe explicatif + carte identifiant séparée (deux cartes pour le même code).
- « Les gestes » : 8 lignes de 64 px avec description chacune ; **destructif (Supprimer) mélangé** aux gestes courants, juste sous « Repasser en prospect ».
- Historique : 4–5 lignes par écriture (montant 20 px, phrase, description, solde après, « Par … »).
- Mes équipes : sous-titre « vous seul créez et retirez les accès », notes de bas de page longues (Sources, Ventes : `DefinitionsNote`).

**Nommage incohérent**
- Argent : « Crédit / Débit » (desktop) vs « Ajouter de l'argent / Retirer de l'argent » (mobile) vs « Crédit manuel / Débit manuel » (dialogue) vs « Ajouts / Retraits » (filtres historique).
- Mot de passe : « Réinitialiser mot de passe » (desktop) vs « Nouveau mot de passe » (mobile) vs « Générer nouveau mot de passe ».
- « Bénéficiaires » vs « Ses bénéficiaires » ; « Supprimer le client » vs « Supprimer ce client » ; « Modifier le profil » vs « Modifier ses informations » ; header « Client » vs chargement « Détail client ».
- Commerciaux : bouton « **Chiffres des commerciaux** » → page « **Ventes** » ; « **Sources & commerciaux** » (sous Clients) ; « Nouvel accès » vs « + Commercial » vs « + Ajouter un commercial ». Section « Mes équipes » pour une route `/m/equipe`.

**Doublons**
- **Deux portes vers les commerciaux** avec des chiffres différents : Clients › Sources & commerciaux (dépôts/paiements/colis par source, période libre) et Équipe › Ventes (séries, objectifs, prospects). Le détail d'une source commerciale et la page commercial se recouvrent (clients apportés + chiffres).
- Deux affichages du code client sur la fiche mobile (carte étiquette + `CustomerCodeCard`).
- Deux résumés du solde sur fiche + historique (phrase du jour en tête de l'historique).

**Imbrication / navigation**
- Équipe : Plus › Mes équipes › Ventes › un commercial › À vérifier (5 niveaux), avec retour par **lien texte** « ← … » en haut de page (pas de `MobileHeader`, pas de geste retour cohérent avec le reste de l'app ; onglets du bas visibles sur `/m/equipe` mais pas sur les sous-pages).
- Clients : Clients › Sources › une source › un client (le retour revient à la liste clients, pas à la source : `backTo="/m/clients"` codé en dur sur la fiche).
- Fiche client → Historique garde la barre d'onglets ; fiche → Colis/Bénéficiaires non : incohérent.
- Fenêtres de l'équipe (`Modal`) en feuille basse ad hoc, différentes des `BottomSheet` du design kit mobile.

**Composants « web » dans le mobile**
- Sources, Équipe, Ventes, À vérifier : `max-w-6xl`, tables `md:`, graphiques 280 px, classement, `DateRangePicker` desktop — lisibles mais non pensés pouce/une main ; grosses tuiles KPI ×8 avant l'action utile.

---

## 6) Fichiers lus
- `src/App.tsx` (routes), `src/desktop/components/AdminRouteWrapper.tsx`, `src/components/admin/ProtectedAdminRoute.tsx`, `src/contexts/AdminAuthContext.tsx` (matrice), `src/desktop/components/layout/desktopNav.ts`, `DesktopGlobalSearch.tsx` (aperçu), `src/mobile/components/layout/MobileTabBar.tsx`, `src/mobile/screens/more/MobileMoreScreen.tsx` (entrée Équipe), `src/desktop/screens/more/DesktopMoreScreen.tsx` (grep)
- Desktop clients : `src/desktop/screens/clients/{index.ts, DesktopClientsScreen.tsx, DesktopClientPanel.tsx, DesktopCreateClient.tsx, DesktopCreateClientDialog.tsx}`
- Mobile clients : `src/mobile/screens/clients/{index.ts, MobileClientsScreen.tsx, MobileClientDetail.tsx, MobileCreateClient.tsx, MobileClientLedger.tsx, MobileClientBeneficiaries.tsx, MobileClientParcels.tsx, MobileClientScan.tsx}`, `src/mobile/components/clients/{AdjustmentDrawer.tsx, CustomerCodeCard.tsx, MobileShippingLabelSheet.tsx}` (grep)
- Partagés clients : `src/components/clients/{ClientFormSections.tsx, useCreateClientForm.ts, ClientOrigin.tsx, ClientRegistration.tsx, ClientToProspectDialog.tsx}`, `src/components/clients/sources/ClientSourcesScreen.tsx`, `src/components/wallet/OverdraftDialog.tsx` (grep), `src/components/customer-code/ShippingLabelComposer.tsx` (en-tête)
- Hooks : `src/hooks/{useClientManagement.ts, useClientPhones.ts, useAdminDeleteClient.ts, useClientSources.ts, useSales.ts, useTeam.ts, useAdminManagement.ts, useBeneficiaries.ts}` (RPC/tables)
- Équipe/Ventes : `src/components/team/{TeamScreen.tsx, TeamNewMember.tsx, TeamMemberScreen.tsx, TeamBits.tsx, TeamSitePicker.tsx (grep), SalesBoard.tsx, SalesDashboard.tsx, SalesCommercial.tsx, SalesObjectives.tsx, ProspectClaims.tsx, ReassignProspectDialog.tsx}`, `src/mobile/screens/admins/BrokerLicenseCard.tsx` (grep), `src/lib/team.ts`, `src/lib/sales.ts` (statuts, objectifs)
- Commercial `/v` : `src/components/sales/{CommercialRouteWrapper.tsx, CommercialTabBar.tsx, CommercialHome.tsx, HomeSections.tsx (grep), CommercialProspects.tsx, CommercialProspectForm.tsx, ProspectDetail.tsx, ProspectWizard.tsx (en-tête), ProspectSteps.tsx (champs), prospectDraft.ts (étapes), CommercialClients.tsx, CommercialPassword.tsx, CommercialLogin.tsx (grep)}`
- SQL (grep) : `supabase/migrations/*` pour `canAdjustWallets` (`admin_has_permission`) et `admin_delete_client`.

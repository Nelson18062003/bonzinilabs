# Module D — Trésorerie · Taux · Analyses · Accueil

Cartographie en lecture seule, faite le 21/10/2026 sur l'arbre de travail. Référence : le **desktop**.

## 1) Résumé

1. **Trésorerie** : le desktop est une seule coquille (`DesktopTreasuryScreen`) pilotée par l'URL. Elle a 6 rubriques (Vue d'ensemble · Opérations · Comptes · Contreparties · Analyse · Contrôle {Grand livre, Inventaires, Visuel des soldes}). Toutes les saisies s'y ouvrent en modale (achat, vente, ajuster, inventaire, contrepartie, annulation). Le mobile, lui, a **14 pages séparées** construites sur l'ancien modèle.
2. **Principaux trous mobile en trésorerie** : pas de **reçu d'opération** (copier l'image / télécharger), pas de **fiche compte** (mouvements + solde après + inventaires), pas de **grand livre**, pas d'**historique des inventaires**, pas de **fiche contrepartie avec stats et opérations**, pas de recherche. Les liens profonds (`/operations/:kind/:id`, `/ledger`, `/accounts/:id`) aboutissent à une liste au lieu de l'objet demandé.
3. **Taux** : desktop = 5 vues (Simulateur par défaut · Publier · Historique · Réglages · Marché) plus le flyer. Le mobile tient sur un long scroll. Il **n'a pas** la correction ni la suppression d'une publication, ni la cotation de marque (image PNG, texte WhatsApp, taux personnalisé), ni la confirmation avant publication. En sens inverse, seul le mobile a la **suggestion automatique Binance** et le sens CNY→XAF.
4. **Analyses (`/m/dashboard`)** : le desktop a été épuré à la demande de l'utilisateur (3 graphiques retirés) et a gagné une section « Croissance » (matrices semaine/mois). Le mobile garde 1 813 lignes en accordéons, avec ces mêmes graphiques retirés, des exports CSV et des alertes cliquables que le desktop n'a pas.
5. **Accueil (`/m`)** : le desktop a une vraie page d'accueil (KPI, à traiter, activité récente, taux du jour, Mola, actions rapides). Sur mobile, `/m` **redirige vers `/m/ops`**. `MobileDashboard.tsx` existe mais **n'est routé nulle part** (seul le harnais `__screenshot__` l'utilise).

---

## 2) Écrans (desktop vs mobile)

Permissions (`ROLE_PERMISSIONS`) :
- `canViewTreasury` = `canManageTreasury` = super_admin + treasurer. Côté serveur, `can_access_treasury()` accepte les mêmes rôles.
- `canManageRates` = super_admin + ops. Côté serveur, `can_manage_rates()` garde `create_daily_rates`, `update_daily_rate`, `delete_daily_rate` et `update_rate_adjustment`.
- Annuler une opération : super_admin seul, côté front comme côté serveur (`void_treasury_operation`).
- `/m/dashboard` et `/m` n'ont **aucune** permission sur la route.

### 2.1 Trésorerie — routage

Toutes les routes `/m/more/treasury/*` rendent `DesktopTreasuryScreen` sur desktop. `parseTreasuryLocation` (`treasuryNav.ts`) choisit la rubrique d'après l'URL.

| Route | Desktop (rubrique / vue) | Mobile (composant) |
|---|---|---|
| `/m/more/treasury` | Vue d'ensemble | `MobileTreasuryHome` |
| `/operations[?type=purchase\|sale\|voided]` | Opérations (filtre) | `MobileOperationsHistory` |
| `/operations/:kind/:id` | Opérations + fiche `OperationSheet` (modale) | `MobileOperationsHistory` (**la liste, pas l'opération**) |
| `/purchases`, `/sales` | Opérations filtrée Achats / Ventes | `MobilePurchasesList` / `MobileSalesList` |
| `/purchases/:id`, `/sales/:id` | Opérations + fiche | `MobilePurchaseDetail` / `MobileSaleDetail` |
| `/accounts`, `/accounts/:id` | Comptes / fiche compte | `MobileAccountsScreen` (**ignore `:id`**) |
| `/counterparties[?type=cny_buyer]`, `/:id` | Contreparties / fiche | `MobileCounterpartiesScreen` / `MobileCounterpartyEdit` (formulaire d'édition) |
| `/analysis`, `/dashboard` | Analyse | `MobileTreasuryDashboard` (les 2 routes) |
| `/ledger` | Contrôle › Grand livre | `MobileOperationsHistory` (**pas de grand livre**) |
| `/inventory` | Contrôle › Inventaires (historique) | `MobileInventoryScreen` (saisie seule) |
| `/balance-dashboard` | Contrôle › Visuel des soldes | `MobileBalanceDashboard` |
| `/purchase`, `/sale` | Modale par-dessus la dernière rubrique | `MobileNewPurchase` / `MobileNewSale` (page pleine, sans tab bar) |

### 2.2 Trésorerie — écran par écran

**Coquille desktop** (`DesktopTreasuryScreen.tsx`) :
- Fil d'Ariane, titre et 6 onglets.
- Si `canManage`, à droite : menu « ⋯ » (Ajuster le solde d'un compte · Faire un inventaire · Nouveau fournisseur USDT · Nouvel acheteur CNY), « Nouvel achat » et « Nouvelle vente ».
- Une **période partagée** (`DateRangeProvider`, mois en cours par défaut) sert à Opérations, Contreparties et Analyse.

**Vue d'ensemble**
- Desktop (`OverviewView`) :
  - 3 chiffres : Comptes XAF (total des comptes actifs, lien « n comptes »), Stock USDT (`get_usdt_stock`) avec le coût moyen (`get_wac_usdt`), Comptes CNY.
  - « Dernières opérations » : 7 opérations sur 90 jours (icône, contrepartie, Achat/Vente/Annulée, date, ±USDT, contre-valeur), puis « Tout voir ».
  - Gestion d'erreur avec « réessayer ».
- Mobile (`MobileTreasuryHome`) :
  - 3 cartes XAF/USDT/CNY, en « M » abrégé, qui comptent **aussi les comptes inactifs**. L'USDT vient des soldes du pool, pas de `get_usdt_stock`. Alerte si le stock USDT est négatif.
  - Carte WAC (4 décimales).
  - Section « Analyse » à 3 tuiles : Analyse, Historique des opérations, Visuel des soldes.
  - Section « Actions » à 7 tuiles : Nouvel achat, Mes achats, Nouvelle vente, Mes ventes, Contreparties, Comptes & soldes, Inventaire.
  - **Pas de dernières opérations.**
  - Les tuiles Nouvel achat/vente s'affichent sans test de `canManageTreasury`.

**Opérations**
- Desktop (`OperationsView`) :
  - Filtre segmenté avec compteurs : Toutes / Achats / Ventes / Annulées.
  - Recherche (nom, compte, référence, note, montant) et période (`DateRangePicker`).
  - Bandeau de totaux selon le filtre : achetés/vendus, payés/reçus, taux moyen avec unité ; les annulées ne comptent dans aucun total.
  - Table : Opération (contrepartie + type + comptes), Date, USDT, Taux, Montant + devise. Pagination.
  - Un clic ouvre la fiche.
- Mobile, liste unifiée (`MobileOperationsHistory`) : période 7/30/90 j, pastilles Tout/Achats/Ventes/Annulées, liste `OperationListItem`. Pas de totaux, pas de recherche.
- Mobile, listes séparées (`MobilePurchasesList` / `MobileSalesList`) :
  - Période 7j/30j/90j/Tout/Perso (dates libres).
  - Panneau « Filtres » : fournisseur et **canal** (Virement/Mobile Money/Cash/Autre) pour les achats ; acheteur et **compte CNY** (dont « aucun ») pour les ventes.
  - **Tri** : date ↑↓, montant ↑↓.
  - Bascule « Annulées ».
  - Totaux USDT + XAF (ou CNY).
  - Poubelle sur la ligne (super admin) qui ouvre `VoidOperationDialog`.

**Fiche opération**
- Desktop (`OperationSheet`, modale) :
  - Le **reçu** (`OperationReceipt` : bande aux 3 couleurs, montant, taux avec unité, payé depuis / encaissé sur, détails) avec **« Copier l'image »** et **« Télécharger »** (PNG).
  - Repli « Détails internes » : note, écritures au grand livre (chacune mène à la fiche du compte), « Voir la fiche du fournisseur / de l'acheteur », « Annuler l'opération » (super admin) qui ouvre `VoidForm`.
  - Une opération hors de la période est relue seule par son identifiant.
- Mobile (`MobileOperationDetail`) :
  - Bandeau « Opération supprimée » avec motif.
  - Montant XAF→USDT ou USDT→CNY, taux implicite (4 décimales).
  - Lignes : date, fournisseur/acheteur, compte(s) débités (répartition), compte CNY, WAC à la vente, coût XAF de sortie, référence, notes.
  - « Supprimer cette opération (super admin) » : formulaire en ligne, motif ≥ 10 caractères.
  - **Pas de reçu, pas d'écritures, pas de lien vers la contrepartie ni vers les comptes.**

**Saisies achat / vente**
- Desktop (`PurchaseForm` / `SaleForm`, `FormModal`) :
  - Garde « modifications non enregistrées ».
  - Fournisseur ou acheteur, avec « + Nouveau » (`QuickCounterparty` : nom + téléphone, « Créer et choisir »).
  - Achat :
    - comptes payeurs, un ou plusieurs, « Ajouter un compte » ;
    - 3 montants liés (total XAF, taux, USDT) : on en tape deux, le troisième se calcule, et la formule s'affiche en clair ;
    - « Dernier taux chez X · Reprendre ce taux », avec alerte si le taux s'écarte de plus de 8 % du dernier achat ou du WAC.
  - Vente :
    - USDT, taux CNY/USDT, CNY liés ;
    - « Encaissé sur » (facultatif) ;
    - alerte si la vente dépasse le stock.
  - Date (maintenant par défaut), référence, note.
  - Après enregistrement : `SavedView` montre le **reçu** (copier / télécharger), puis « Nouvel achat » / « Fermer ».
- Mobile (`MobileNewPurchase` / `MobileNewSale`, pages pleines) :
  - Liste déroulante + « Nouveau fournisseur » en ligne (vente : nom, entreprise, téléphone, WeChat).
  - Achat : mode un compte / plusieurs comptes. En un compte, choix du couple saisi : XAF+USDT, XAF+taux ou USDT+taux (caché derrière un bouton). En plusieurs comptes, USDT ou taux.
  - Vente : mode USDT+CNY / USDT+taux / CNY+taux. Bloc « WAC à utiliser / coût / stock après » et alerte de stock négatif.
  - Rubrique « Plus » : date (`OccurredAtField`), référence externe, notes.
  - USDT à **4 décimales** (le desktop en a 2).
  - Après enregistrement : retour à `/m/more/treasury`, **sans reçu**.
  - Pas de rappel du dernier taux ni de garde-fou à 8 %.

**Comptes**
- Desktop (`AccountsView`) :
  - Liste : 3 cartes (Comptes XAF, Pool USDT, Comptes CNY), chacune avec son total, sa phrase d'aide et ses comptes (libellé, type, solde, négatif en rouge).
  - **Fiche** `/accounts/:id` : solde, nombre de mouvements et date du dernier. « Ajuster le solde » et « Faire l'inventaire » (pour cash, Alipay, WeChat), si `canManage`.
  - Table « Mouvements » : 300 derniers ; Date, Nature, Origine (lien vers l'opération), Montant, **Solde après**.
  - Carte « Inventaires » du compte : date, Juste ou écart, compté / attendu, motif.
- Mobile (`MobileAccountsScreen`) : groupes par devise avec leur total. Chaque ligne affiche libellé, type, date de dernière écriture et solde. Un tap déplie `AdjustForm` en ligne (crédit/débit, montant, motif ≥ 10). **Pas de fiche, pas de mouvements.**

**Contreparties**
- Desktop (`CounterpartiesView`) :
  - Liste :
    - segment Fournisseurs USDT / Acheteurs CNY, période, recherche (nom, F-003, téléphone, WeChat) ;
    - « + Nouveau fournisseur / acheteur » ;
    - case « Afficher les archivés (n) » ;
    - table Nom (+ identifiant, téléphone), Opérations, USDT, Taux moyen sur la période, triée par volume.
  - Fiche :
    - identifiant, nom, raison sociale, téléphone, WeChat, note ;
    - actions **Modifier** (`CounterpartyForm`), **Archiver / Réactiver** (avec confirmation), **Supprimer** (avec confirmation ; seulement sans opération) ;
    - 4 stats sur la période (opérations, USDT, XAF payés / CNY reçus, taux moyen) ;
    - table des opérations (Date, Type, Compte, USDT, Taux, contre-valeur), qui mène à la fiche de l'opération.
- Mobile :
  - Liste (`MobileCounterpartiesScreen`) : segment, pastille « archivés », création en ligne (nom, entreprise, téléphone, WeChat pour les acheteurs, notes), lignes avec identifiant, nom et téléphone.
  - Le tap mène à `MobileCounterpartyEdit` : champs, Enregistrer, « Archiver (masquer des listes) » / Réactiver, « Supprimer définitivement » avec confirmation en ligne.
  - **Pas de stats ni d'opérations, pas de recherche.** WeChat est masqué pour les fournisseurs.

**Analyse**
- Desktop (`TreasuryAnalysisView`) :
  - Période (partagée avec Opérations et Contreparties).
  - 4 titres : Bénéfice de la période, Marge par CNY livré, Taux de revient, Taux client (XAF/CNY), chacun avec sa phrase d'aide.
  - 2 cartes de volume :
    - Achats : nombre d'opérations, USDT, XAF, taux moyen ;
    - Ventes : nombre d'opérations, USDT, CNY, taux moyen.
  - « Évolution des taux » (lightweight-charts) : segment WAC / Taux d'achat / Taux de vente.
  - Meilleurs fournisseurs et meilleurs acheteurs : 5 chacun ; colonnes USDT, taux moyen, écart en % coloré selon le sens ; un clic ouvre la fiche.
  - Capital immobilisé aujourd'hui.
  - Sources : `get_treasury_dashboard`, `get_top_counterparties`, séries WAC et flux.
- Mobile (`MobileTreasuryDashboard`, titre « Dashboard trésorerie ») :
  - Pastilles Jour/Semaine/Mois/Trimestre/Année/Tout/Custom.
  - Bénéfice ; volumes ; taux moyens pondérés ; revient, client et marge ; stock et capital (WAC, stock, capital).
  - Graphiques Recharts : évolution WAC, évolution du coût d'achat, **distribution du coût d'achat (histogramme)**, évolution et **distribution** du prix de vente.
  - Top fournisseurs et top acheteurs (**non cliquables**).
  - Liens rapides Achat / Vente / Historique.

**Contrôle**
- Desktop (`ControlView`) :
  - Grand livre : segment XAF/USDT/CNY, filtre par compte, totaux (écritures, entrées, sorties), table Date, Compte, Nature, Origine (lien), Montant ; 300 lignes.
  - Inventaires : historique de tous les comptes (Date, Compte, Attendu, Compté, Écart, Motif ou « Non expliqué »), totaux, bouton « Faire un inventaire ».
  - Visuel des soldes : saisie manuelle des soldes XAF par compte (liste fixe `DASHBOARD_ACCOUNTS`), aperçu à l'échelle, « Télécharger l'image (PNG) » et « Télécharger en PDF ».
- Mobile :
  - `MobileInventoryScreen` : comptes inventoriables (solde théorique). Un tap déplie : solde réel constaté, écart, motif obligatoire si écart ≥ 10, Enregistrer. **Pas d'historique.**
  - `MobileBalanceDashboard` (titre « Dashboard soldes ») : mêmes composants (`BalanceDashboardPreview`, export PNG/PDF) en un seul scroll.

### 2.3 Taux (`/m/more/rates`, `/m/more/rates/market`)

**Desktop** (`DesktopRatesScreen`) :
- En-tête : « Taux actifs depuis … » et bouton « Flyer du jour » (dialogue `RateFlyerSheet`).
- Sélecteur à 5 vues, une seule affichée à la fois :
  - **Simulateur** (`RateQuoteSimulator`, vue par défaut) :
    - champs XAF⇅CNY liés ; méthode (cash/alipay/wechat/virement) ; pays ;
    - détail du calcul (tranche, **taux appliqué modifiable** « Personnalisé », retour au taux automatique) ;
    - copie de chaque chiffre ;
    - cotation de marque (`RateQuoteCard`) en FR/EN et sombre/clair, avec **« Télécharger l'image »** (PNG) et **« Copier le texte »** (WhatsApp).
  - **Publier** :
    - `RatePublishCard` : 4 taux en CNY / 1 M XAF, prise d'effet (maintenant, aujourd'hui, hier, autre date et heure), « Publier », puis **dialogue de confirmation** (`create_daily_rates`) ;
    - `CountryRatesCard` : pays (Gabon…) dérivés du Cameroun ; écart modifiable si `canManageRates` (`update_rate_adjustment`) ; « flyer du pays ».
  - **Historique** :
    - `RateTrendCard` : chips 7J/30J/3M/1A, courbes avec bascule par méthode ;
    - `DesktopRateHistory` : table Date, 4 méthodes, Δ cash, badge Actif. Au survol, si `canManageRates` : **Corriger** (dialogue : 4 taux + date d'effet, `update_daily_rate`) et **Supprimer** (confirmation, `delete_daily_rate`).
  - **Réglages** : `RateAdjustmentsCard`, pourcentages par pays et par tranche, Enregistrer (`update_rate_adjustment`).
  - **Marché Binance** (si `canManageRates`) : `P2PMarketView`. Côté CNY/XAF, rafraîchir, direct marche/arrêt, unité « % des annonces / % des USDT », largeur de classe, table des paliers, annonces du palier, filtres. Données servies par une edge function gardée par `canManageRates`.

**Mobile** (`MobileRatesScreen`, un seul scroll, rafraîchissement par tirage) :
1. « Définir les taux du jour » (`RateSetTab`) :
   - **suggestion automatique** : bouton « Recalculer » qui appelle l'edge function `suggest-daily-rates` (Binance) ; affichage du détail CMR/CHN ; « Utiliser » remplit les champs ;
   - **sens XAF→CNY / CNY→XAF** ;
   - 4 taux et prise d'effet ;
   - « Publier les taux du jour », **sans confirmation**, puis `mark_suggestion_applied`.
2. « Taux par pays » (`CountryRatesCard`).
3. « Simulateur » (`RateSimulatorTab` + `SimulatorResult`) : montant, devise XAF/CNY, méthode, pays, détail repliable. **Rien à partager.**
4. « Historique » (`RateHistoryTab` : cartes dépliables, lecture seule) et repli « Graphique d'évolution » (`RateChartTab`/`MultiCurveChart` : période, bascule par méthode).
5. « Marché Binance » : lien vers `/m/more/rates/market` (si `canManageRates` ; `P2PMarketView compact`, filtres repliés).
6. « Réglages » : repli « Ajustements pays & tranches » (`RateConfigTab`).
7. Pilule « Voir le flyer du jour » (BottomSheet `RateFlyerSheet` : copier l'image, télécharger, **partager** sur natif, copier la légende, pays, langue).

### 2.4 Analyses (`/m/dashboard`)

**Desktop** (`DesktopAnalyticsDashboard`, `DateRangePicker` complet : préréglages, granularité, comparaison ; 30 jours par défaut) :
- Alertes (`useDashboardAlerts`) en grille, **non cliquables**.
- 8 StatCards, avec delta si comparaison : Paiements exécutés, Dépôts validés, Flux net, Exposition portefeuilles, Nouveaux clients, Clients actifs, Conversion dépôt→paiement, Délai de validation (médiane).
- Graphiques et tableaux :
  - « Flux financier » : barres dépôts / paiements ;
  - `VolumeGrowthBlock` ×2 (dépôts, paiements : barres par période + courbe de cumul ; total, nombre, ticket moyen, pic) ;
  - Dépôts par méthode et Paiements par méthode (table : Méthode, Nombre, Montant, Part) ;
  - `ClientGrowthBlock` (parc de clients) ;
  - Sources d'inscription + UTM ; Répartition par pays (camembert) ;
  - **`GrowthMatrixSection`** : croissance clients, dépôts et paiements sur 12 semaines ou 12 mois, avec un pas propre à chaque bloc ;
  - Top clients (Client, Opérations, Volume) ; Productivité des administrateurs (Administrateur, Actions ; 10 premiers).
- **Aucun export.**

**Mobile** (`MobileAnalyticsDashboard`) :
- En-tête « Tableau de bord » : `DateRangePicker`, bouton rafraîchir, tirage pour rafraîchir.
- Alertes **cliquables** (`actionHref` → `/m/deposits`, `/m/payments`).
- 4 KPI de tête : TPV, Dépôts validés, Flux net, Ticket moyen.
- Accordéons :
  - « Capital & conversion » (fermé) : exposition, solde moyen par client, concentration top 10, ratio dépôts/paiements, clients actifs, conversion, taux de validation ;
  - « Flux & volumes » (ouvert) : flux financier **(+CSV)**, rapports de volume dépôts et paiements **(+CSV)**, **statut des dépôts dans le temps**, répartition par méthode ;
  - « Clients » : croissance, sources d'inscription, pays **(+CSV)** ;
  - « Opérations » : temps de validation, **dépôts rejetés, dépôts en attente** ;
  - « Taux » : **évolution des taux** (absolu / variation ; Alipay moyen, écart maximal entre méthodes, volatilité) ;
  - « Équipe & top clients » : productivité, top 10 **(+CSV)**.
- Granularité **par graphique** (`useReportGranularity`).
- **Pas de matrices de croissance.**

### 2.5 Accueil (`/m`)

**Desktop** (`DesktopDashboard`) :
- Salutation et rôle ; boutons « Nouveau dépôt » et « Nouveau paiement ». **Aucun garde de permission** sur ces boutons ni sur les actions rapides.
- 4 KPI (`get_dashboard_stats`, `useDepositStats`, `usePaymentStats`) : Solde plateforme, Volume 7 jours, Dépôts aujourd'hui, Paiements aujourd'hui.
- « À traiter » : dépôts à valider et paiements en cours (compteurs cliquables).
- « Activité récente » : les 6 derniers dépôts (Client, Montant, Quand, Statut), ligne → `/m/deposits/:id`, « Tout voir ».
- Colonne de droite :
  - `RateCard` : 4 taux actifs, lien vers les taux ;
  - carte Mola → `/m/assistant` ;
  - actions rapides : Nouveau client, Analytics, Dépôts, Support.

**Mobile** : `MobileHome` = `<Navigate to="/m/ops">` (Dépôts/Paiements). La tab bar n'a **pas d'entrée Accueil** (Mola · Cargo · Opérations · Clients · Plus). `MobileDashboard.tsx` est orphelin. Il contenait une carte solde, les compteurs à traiter, 3 KPI, les actions Dépôt/Paiement/Clients/Analytics, les dépôts récents, Nouveau client et les taux.

---

## 3) Toutes les actions

| Action | Écran desktop | Écran mobile | RPC / table | Permission (front / serveur) · confirmation |
|---|---|---|---|---|
| Nouvel achat USDT | En-tête de la coquille → `PurchaseForm` | Tuile Accueil + lien rapide de l'Analyse → `MobileNewPurchase` | `record_usdt_purchase` (+ `account_splits`) | canManageTreasury / `can_access_treasury` · garde sale (desktop) · @mola ✓ |
| Nouvelle vente USDT | En-tête → `SaleForm` | Tuile → `MobileNewSale` | `record_usdt_sale` | idem · alerte de dépassement du stock |
| Créer une contrepartie rapide (dans la saisie) | `QuickCounterparty` | En ligne dans la saisie | `create_treasury_counterparty` | canManageTreasury |
| Reprendre le dernier taux | `PurchaseForm` | — | `usdt_purchases` (lecture) | — |
| Copier / télécharger le reçu | `OperationSheet`, `SavedView` | — | client (`copyNodePng`, PNG) | canViewTreasury |
| Ouvrir une opération | Vue d'ensemble, Opérations, fiche contrepartie, Origine dans grand livre / mouvements | Listes → détail | `usdt_purchases` / `usdt_sales` / `treasury_ledger_entries` | canViewTreasury |
| Annuler (void) une opération | Fiche › Détails internes → `VoidForm` (motif ≥ 10) | Détail « Supprimer… » + poubelle des listes (`VoidOperationDialog`) | `void_treasury_operation` | super_admin (front et serveur) · confirmation + motif |
| Filtrer, rechercher, paginer les opérations | `OperationsView` | Pastilles ; filtres, tri, période perso (listes séparées) | `useTreasuryOperations` | — |
| Ajuster le solde d'un compte | Menu ⋯ ou fiche compte → `AdjustForm` (compte, sens, montant, avant→après, motif) | Ligne de compte dépliée | `adjust_treasury_account` | canManageTreasury · motif ≥ 10 · @mola ✓ |
| Faire un inventaire | Menu ⋯, fiche compte, Contrôle › Inventaires → `InventoryForm` | `MobileInventoryScreen` | `record_inventory_snapshot` | canManageTreasury · motif si écart |
| Voir les mouvements d'un compte (solde après) | Fiche compte | — | `treasury_ledger_entries` | canViewTreasury |
| Voir l'historique des inventaires | Fiche compte + Contrôle › Inventaires | — | `treasury_inventory_snapshots` | canViewTreasury |
| Grand livre par devise et par compte | Contrôle › Grand livre | — | `treasury_ledger_entries` | canViewTreasury |
| Créer un fournisseur ou un acheteur | Menu ⋯ ou liste → `CounterpartyForm` | Liste, formulaire en ligne | `create_treasury_counterparty` | canManageTreasury |
| Modifier une contrepartie | Fiche → `CounterpartyForm` | `MobileCounterpartyEdit` | `update_treasury_counterparty` | canManageTreasury |
| Archiver / réactiver | Fiche (confirmation) | Edit (sans confirmation) | `update_treasury_counterparty(is_active)` | canManageTreasury |
| Supprimer une contrepartie | Fiche (confirmation, danger) | Edit (confirmation en ligne) | `delete_treasury_counterparty` | canManageTreasury · seulement sans opération |
| Stats d'une contrepartie sur la période | Liste + fiche | — | `useTreasuryOperations` (calcul côté client) | — |
| Analyse trésorerie | Rubrique Analyse | `MobileTreasuryDashboard` | `get_treasury_dashboard`, `get_top_counterparties`, `get_wac_usdt`, séries | canViewTreasury |
| Visuel des soldes PNG / PDF | Contrôle › Visuel | `MobileBalanceDashboard` | client (`downloadDashboardPng/Pdf`) | canViewTreasury |
| Publier les taux du jour | Taux › Publier (+ confirmation) | `RateSetTab` (**sans confirmation**) | `create_daily_rates` | canManageRates / `can_manage_rates` · @mola ✓ (`set_daily_rate`) |
| Suggestion automatique (Recalculer / Utiliser) | — | `RateSetTab` | edge function `suggest-daily-rates`, `rate_suggestions`, `mark_suggestion_applied` | front aucun ; `mark_…` = `is_admin` seul ⚠ |
| Corriger une publication | Historique (survol) → dialogue | — | `update_daily_rate` | canManageRates · confirmation (@mola ✓) |
| Supprimer une publication | Historique → confirmation | — | `delete_daily_rate` | canManageRates · danger |
| Écart d'un pays | `CountryRatesCard` desktop | `CountryRatesCard` | `update_rate_adjustment` | canManageRates |
| Ajustements pays & tranches | Taux › Réglages | Repli Réglages | `update_rate_adjustment` | canManageRates |
| Simuler une cotation | Simulateur (champs liés, taux personnalisé) | Simulateur (bascule de devise) | calcul client | — |
| Cotation image PNG / copier le texte / copier un chiffre | Simulateur | — | client (`downloadNodePNG`, presse-papiers) | — |
| Flyer du jour ou d'un pays (copier, télécharger, partager, légende) | En-tête + `CountryRatesCard` | Pilule bas + `CountryRatesCard` | client | — |
| Marché Binance (rafraîchir, direct, filtres, paliers) | Taux › Marché | `/m/more/rates/market` | edge function (P2P) | canManageRates |
| Période, comparaison, granularité des analyses | `DateRangePicker` | `DateRangePicker` + granularité par graphique | tables `deposits`, `payments`, `clients`, `wallets`, `ledger_entries`, `admin_audit_logs`, `daily_rates`, `rate_snapshots`, `user_roles` | aucune (route ouverte) |
| Export CSV d'un graphique ou d'une table | — | Flux, volumes, pays, top clients | client (`exportCsv`) | — |
| Alerte → page concernée | — (alertes inertes) | Clic → `/m/deposits`, `/m/payments` | — | — |
| Rafraîchir les analyses | — | Bouton + tirage | `invalidateQueries` | — |
| Matrice de croissance semaine/mois | `GrowthMatrixSection` | — | `useAnalytics` | — |
| Accueil : Nouveau dépôt, Nouveau paiement | En-tête `DesktopDashboard` | Bouton + de `/m/ops` | navigation | aucun garde côté front |
| Accueil : à traiter, activité récente, taux, Mola, actions rapides | `DesktopDashboard` | Badge de la tab bar seulement ; le reste absent | `get_dashboard_stats` (`is_admin`), `deposits` | — |

---

## 4) Écarts desktop → mobile

**Absents sur mobile (à porter dans la refonte)**
1. Le **reçu d'opération** : copier l'image et télécharger, depuis la fiche **et** juste après la saisie. C'est le geste n° 1 selon les commentaires du code (preuve WhatsApp/WeChat).
2. La **fiche compte** : mouvements avec Origine cliquable et **Solde après**, inventaires du compte, gestes Ajuster et Inventorier depuis la fiche.
3. Le **grand livre** (devise, filtre par compte, entrées et sorties). `/ledger` mène aujourd'hui à la liste des opérations.
4. L'**historique des inventaires** (tous comptes, écarts, « Non expliqué »).
5. La **fiche contrepartie** : 4 stats sur la période, ses opérations, raison sociale. Il manque aussi dans la liste la recherche et les colonnes Opérations / USDT / Taux moyen.
6. Dans la fiche opération : écritures au grand livre, lien vers la contrepartie et vers les comptes.
7. Dans la liste des opérations : **recherche plein texte**, **totaux** (« Tout » sur mobile), pagination, **période partagée** entre rubriques.
8. Dans la saisie d'un achat : **dernier taux du fournisseur + Reprendre**, **garde-fou > 8 %**, formule affichée, garde des modifications non enregistrées, « Nouvel achat » à la suite.
9. Les **liens profonds** `/operations/:kind/:id` et `/accounts/:id` ne sont pas résolus sur mobile.
10. La vue d'ensemble : **dernières opérations**, stock USDT réel (`get_usdt_stock`), filtre sur les comptes actifs.
11. Analyse : top contreparties **cliquables**, écart en % coloré selon le sens, courbe unique avec unité explicite.
12. Taux :
    - **Corriger** et **Supprimer** une publication ;
    - **confirmation avant de publier** ;
    - simulateur avec **taux personnalisé**, **cotation de marque PNG**, **texte WhatsApp**, copie d'un chiffre, FR/EN et sombre/clair ;
    - « Taux actifs depuis … » visible en tête.
13. Analyses : **matrices de croissance** (12 semaines ou 12 mois) ; montants entiers (le mobile abrège en « M »).
14. Accueil : il n'existe pas sur mobile. Manquent KPI du jour, À traiter, activité récente, taux du jour et carte Mola.

**Présents sur mobile seulement (à garder ou à reporter au desktop)**
- Taux : **suggestion automatique Binance** (Recalculer / Utiliser, `mark_suggestion_applied`) et **sens CNY→XAF** à la saisie ; **partage natif** du flyer.
- Listes achats et ventes : filtre **canal** et filtre **compte CNY / aucun compte**, **tri** par date ou montant, **période perso**, poubelle sur la ligne.
- Analyse trésorerie : **histogrammes de distribution** des taux d'achat et de vente ; préréglages Jour/Semaine/Trimestre/Année/Tout.
- Analyses : **exports CSV**, **alertes cliquables**, bouton rafraîchir, granularité par graphique, plus de KPI (ticket moyen, concentration top 10, ratio, taux de validation, rejetés, en attente), statut des dépôts dans le temps, évolution des taux. **Le desktop a retiré ces 2 graphiques à la demande de l'utilisateur** (« ne me sert à rien ») : la refonte mobile devrait les retirer aussi.
- Vente : bloc WAC, coût de sortie et stock après (le desktop n'affiche que l'alerte de dépassement).

---

## 5) Problèmes UX mobile

- **Doublons d'écrans et noms qui changent** :
  - Une même analyse porte trois noms : « Analyse » (tuile), « Dashboard trésorerie » (titre) et deux routes `/analysis` et `/dashboard`. « Tableau de bord » (`/m/dashboard`) est un autre écran, ce qui fait **3 « dashboards »** en tout.
  - « Visuel des soldes » (tuile) s'appelle « Dashboard soldes » (titre) et vit à `/balance-dashboard`.
  - Les opérations sont listées **3 fois** : Historique des opérations, Mes achats USDT, Mes ventes USDT, chacune avec des filtres différents.
  - Le desktop dit « Annuler l'opération », le mobile dit « Supprimer… », « Opération supprimée » et « Liste, total, suppression », alors que l'opération reste visible et contre-passée.
  - « Analytics » (actions rapides) contre « Tableau de bord » (menu).
- **Imbrication** : Plus → Trésorerie → tuile → liste → détail, soit 4 niveaux. L'accueil Trésorerie aligne **10 tuiles**, chacune avec sa phrase de description, rangées en « Analyse » et « Actions » (des listes sont classées comme actions).
- **Impasses** :
  - Retour codé en dur : le détail revient toujours à `/operations`, même si on vient de Mes achats. Après une annulation, on est renvoyé à la liste.
  - Après une saisie, retour à l'accueil sans reçu ni confirmation de l'opération créée.
  - Top contreparties non cliquables.
  - Lignes de contrepartie inertes sans `canManage`.
  - Liens profonds desktop → mobile (`/operations/purchase/:id`, `/accounts/:id`, `/ledger`) qui aboutissent à une liste.
  - `/m/dashboard` hors de la tab bar : aucun onglet actif, alors que l'entrée est sous « Plus ».
- **Permissions incohérentes** :
  - L'entrée « Taux de change » du menu Plus est montrée à **tous** (le desktop la réserve à `canManageRates`), et le mobile affiche à tous le formulaire de publication et la suggestion. Le serveur refuse ensuite.
  - Les tuiles Nouvel achat/vente sont affichées sans `canManageTreasury`.
  - Les boutons de l'accueil desktop n'ont pas de garde.
  - `mark_suggestion_applied` n'est gardé que par `is_admin` (règle sécurité).
- **Trop de texte ou de saisie cachée** :
  - Paragraphes d'explication (inventaire, suppression), phrases sous chaque tuile.
  - Accordéons fermés par défaut dans Analyses (5 sur 6).
  - Modes de saisie de l'achat cachés derrière un bouton ; 2 segmentés de mode (un compte / plusieurs comptes, puis le couple saisi).
- **Précision et format** :
  - Taux et USDT à 4 décimales sur mobile, 2 sur desktop (les unités XAF/USDT et CNY/USDT sont parfois omises).
  - Montants abrégés en « M » (abréviation proscrite sur desktop).
  - Totaux de l'accueil qui incluent les comptes inactifs.
- **Accueil absent** : `/m` redirige vers Opérations, `MobileDashboard` est mort, le taux du jour n'apparaît nulle part sur mobile hors du module Taux.
- **Ordre du module Taux** : sur mobile, la publication est en premier et le simulateur en troisième, alors que sur desktop le simulateur est la vue par défaut (c'est le « geste quotidien »). Un seul scroll de 7 sections.

---

## 6) Fichiers lus

**Routage et navigation**
- `src/App.tsx`
- `src/desktop/components/layout/desktopNav.ts`
- `src/mobile/components/layout/MobileTabBar.tsx`
- `src/mobile/screens/more/MobileMoreScreen.tsx`
- `src/contexts/AdminAuthContext.tsx` (matrice)

**Trésorerie desktop** : `src/desktop/screens/treasury/`
- `DesktopTreasuryScreen.tsx`, `treasuryNav.ts`, `treasuryActions.ts`, `treasuryPeriod.ts`, `operationView.ts`
- `OverviewView.tsx`, `OperationsView.tsx`, `OperationSheet.tsx`, `OperationReceipt.tsx`, `VoidForm.tsx`
- `AccountsView.tsx`, `AccountForms.tsx`, `CounterpartiesView.tsx`, `CounterpartyForm.tsx`
- `TreasuryAnalysisView.tsx`, `ControlView.tsx`, `TreasuryRateChart.tsx`
- `PurchaseForm.tsx`, `SaleForm.tsx`
- `EntryParts.tsx` et `tkit.tsx` (en partie)

**Trésorerie mobile** : `src/mobile/screens/treasury/`
- `MobileTreasuryHome.tsx`, `MobileOperationsHistory.tsx`, `MobileOperationDetail.tsx`
- `MobilePurchasesList.tsx`, `MobileSalesList.tsx`
- `MobileAccountsScreen.tsx`, `MobileInventoryScreen.tsx`
- `MobileCounterpartiesScreen.tsx`, `MobileCounterpartyEdit.tsx`
- `MobileNewPurchase.tsx`, `MobileNewSale.tsx`
- `MobileTreasuryDashboard.tsx`, `treasuryDashboardUtils.ts`
- `balance-dashboard/MobileBalanceDashboard.tsx`
- `src/components/treasury/OperationListItem.tsx`, `src/components/treasury/VoidOperationDialog.tsx`

**Taux**
- `src/desktop/screens/rates/` : `DesktopRatesScreen.tsx`, `RatePublishCard.tsx`, `RateQuoteSimulator.tsx`, `DesktopRateHistory.tsx`, `RateTrendCard.tsx`, `RateAdjustmentsCard.tsx`, `DesktopRateChart.tsx`
- `src/mobile/screens/rates/` : `MobileRatesScreen.tsx`, `MobileRatesMarketScreen.tsx`
- `src/mobile/screens/rates/tabs/` : `RateSetTab.tsx`, `RateSimulatorTab.tsx`, `RateHistoryTab.tsx`, `RateChartTab.tsx`, `RateConfigTab.tsx`
- `src/mobile/screens/rates/components/` : `SimulatorResult.tsx`, `RateHistoryCard.tsx`, `MultiCurveChart.tsx`
- Composants partagés : `src/components/rates/CountryRatesCard.tsx`, `src/components/rates/market/P2PMarketView.tsx`, `src/mobile/components/rates/RateFlyerSheet.tsx`

**Analyses et accueil**
- `src/desktop/screens/analytics/` : `DesktopAnalyticsDashboard.tsx`, `VolumeGrowthBlock.tsx`, `ClientGrowthBlock.tsx`, `GrowthMatrixSection.tsx`, `GrowthMatrixBlock.tsx`, `dashboardBlocks.tsx`
- `src/mobile/screens/analytics/MobileAnalyticsDashboard.tsx`
- `src/desktop/screens/dashboard/DesktopDashboard.tsx`
- `src/mobile/screens/dashboard/MobileDashboard.tsx` (orphelin)
- `src/mobile/screens/operations/MobileOperationsScreen.tsx` (`MobileHome`)

**Hooks et serveur**
- Hooks : `src/hooks/useTreasury.ts`, `src/hooks/useDailyRates.ts`, `src/hooks/analytics/useAnalytics.ts`, `src/hooks/useAdminData.ts`
- Migrations : `20260515000002_treasury_schema.sql` (`can_access_treasury`), `20260831140000_rate_permission_hardening.sql`, `20260603180000_mola_capability_tags_full.sql`, `20260515000004/5_*`, `20260516000001/2/3_*`, `20260513000000_rate_suggestions.sql`

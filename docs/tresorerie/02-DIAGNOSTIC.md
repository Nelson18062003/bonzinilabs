# Trésorerie (app admin) — Diagnostic sans complaisance

> État au **05/10/2026**, branche `main` + base de production (lecture seule).
> La carte du module (écrans, routes, données, formules) est dans [`01-CARTOGRAPHIE.md`](./01-CARTOGRAPHIE.md).
> Chaque problème porte un identifiant (B = bloquant, M = majeur, m = mineur), le fichier:ligne et la preuve.

---

## 0. Verdict en cinq phrases

1. **Les chiffres sont faux à la source**, pas seulement mal affichés : soldes XAF à −1,68 milliard, stock USDT fictif de 1,06 million, coût moyen gonflé de 71 %, bénéfice faux d'un facteur 136 sur l'historique. Aucune refonte visuelle ne réparera les tableaux de bord sans refaire le modèle.
2. **Le modèle ne couvre pas la réalité** : il ne connaît que « acheter des USDT » et « vendre des USDT ». Il ignore les dépôts clients (entrées XAF), les paiements clients (sorties CNY) et l'ordre réel de saisie. D'où une double saisie manuelle que le fondateur a abandonnée : plus aucune vente depuis le 25/08.
3. **Il n'y a pas d'architecture d'information** : 6 onglets à plat sur desktop, 10 tuiles empilées sur mobile, aucune vue d'ensemble, aucun lien entre objets, liens profonds morts, deux modules desktop et mobile qui ne se ressemblent pas.
4. **Il n'y a pas de design system appliqué** : 4 kits visuels, 23 tailles de texte, 9 rayons, 7 rouges, 3 violets, contrastes jusqu'à 1,07:1 — d'où le « flou » et le « on ne voit pas ».
5. Ce qui tient : le grand livre en ajout seul (mécaniquement intègre en prod), les RPC serveur avec audit, la répartition multi-comptes, les identifiants F-/A-, et quelques bonnes idées d'écran (barre d'état, aperçu de l'effet d'une saisie, table unique des opérations).

---

## 1. BLOQUANT — chiffres faux, bugs, sécurité

### 1.A Chiffres faux

| ID | Problème | Où | Preuve |
|---|---|---|---|
| **B1** | **Le coût d'une vente est figé à 0 quand la vente est saisie avant son achat.** `get_wac_usdt` renvoie 0 si le stock ≤ 0, et `record_usdt_sale` fige cette valeur dans `wac_at_sale` pour toujours. Ces ventes sortent des USDT sans sortir de coût : le coût moyen suivant est gonflé, la marge de ces ventes est de 100 %. | `20260515000004_treasury_rpcs.sql:80-84` (`ELSE 0`) ; `20260516000002_treasury_lot7.sql:194` | Prod : **62 ventes actives sur 87** à `wac_at_sale = 0`. WAC actuel **1 025,98** XAF/USDT contre ≈ 598,5 réel (+71 %) ; fin juillet 4 853,69 (×8). Les `wac_at_sale` non nuls vont de 419 à 4 005. |
| **B2** | **Le message d'alerte ment** : « saisissez l'achat manquant, le WAC et le bénéfice seront corrigés ». Faux : `wac_at_sale` n'est jamais recalculé, ni après un achat antidaté, ni après l'annulation d'un achat. | `TreasuryStatusBar.tsx:71-72` ; `rpcs.sql:405-523` | Lecture du code : aucune mise à jour de `usdt_sales.wac_at_sale` hors de l'insertion. |
| **B3** | **Les comptes XAF ne peuvent que baisser.** Le grand livre n'a aucun type d'écriture d'entrée ; rien ne relie les dépôts clients aux comptes de trésorerie. L'écran affiche ces soldes comme réels, en noir, sans alerte (desktop). | `schema.sql:53-68` (enums) ; `TreasuryAccountsView.tsx:150-152` | Prod : 6 comptes XAF négatifs, total **−1 682 772 926 XAF**. 1 391,7 M XAF de dépôts validés depuis le 15/05 absents. Même en les ajoutant, MTN resterait à −240,9 M (soldes d'ouverture et retraits manquants). |
| **B4** | **Le stock USDT est fictif** : les ventes ne sont plus saisies depuis le 25/08, les achats continuent. Le capital immobilisé en découle. | `get_usdt_stock`, `rpcs.sql:92-108` ; `lot7.sql:380-388` | Prod : stock **1 059 965 USDT**, capital **1 087 M XAF**. Septembre : 5,26 M CNY payés aux clients, 0 vente saisie. |
| **B5** | **Le « Bénéfice période » n'est pas un bénéfice.** Il vaut `spread_chain + spread_client`. `spread_client` compare le prix client au taux client du jour (le prix comparé à lui-même) : il ne mesure que les variations de taux dans la journée. `spread_chain` valorise les CNY au **taux client** et non au coût. Les deux sommes portent sur des volumes sans rapport (CNY vendus / CNY payés). La légende affichée décrit une autre formule. | `lot7.sql:338-341, 354-369, 375` ; légende `TreasuryAnalysisView.tsx:236-238`, `MobileTreasuryDashboard.tsx:175` | Vue par défaut (octobre) : « Bénéfice **−261 295** » en rouge, qui n'est que `spread_client`. Historique : +450,5 M affichés contre ≈ +3,3 M réalistes (×136). 90 jours : −26,9 M affichés contre ≈ +1,6 M (signe inversé). |
| **B6** | **Taux de revient et marge absurdes aux bords.** Sans achat sur la période, le taux d'achat moyen vaut 0 (et non NULL) → revient 0 → « marge » = taux client entier, en vert. Sans paiement client, le taux client vaut 0 → marge = −revient, en rouge. | `lot7.sql:315, 362-365, 378` ; `TreasuryAnalysisView.tsx:223-225` ; `MobileTreasuryDashboard.tsx:127-130` | Période « Aujourd'hui » avec une vente et sans achat : « Taux de revient 0,00 ». |
| **B7** | **Marge et bénéfice se contredisent** : le revient utilise le prix d'achat moyen de la période, le bénéfice utilise le coût figé de chaque vente. Marge × CNY livrés ≠ bénéfice. | `lot7.sql:378` vs `338-341` | Lecture des formules. |
| **B8** | **Aucun garde-fou sur les taux saisis** : le taux tapé dans le champ USDT passe. | `DesktopNewPurchase.tsx:124-128`, `MobileNewPurchase.tsx:133-137` (seulement « > 0 ») ; `record_usdt_purchase` | Prod : 10 cas (676 à 116 667 XAF/USDT), **1 toujours actif** : 10/09/2026, 6 251 519 XAF pour 603 USDT = **10 367 XAF/USDT** (pool sous-évalué d'≈ 9 764 USDT). |
| **B9** | **Montants dérivés non arrondis** : XAF = USDT × taux et USDT = XAF / taux partent avec toutes leurs décimales. L'écran arrondit et cache l'écart. | `DesktopNewPurchase.tsx:96, 104, 107` ; `MobileNewPurchase.tsx:113, 121, 124` ; `DesktopNewSale.tsx:78, 81` ; `MobileNewSale.tsx:86` | Prod : 13 achats en XAF fractionnaires (MTN à …335,278, Orange à …552,5), 72 achats à plus de 2 décimales d'USDT, pool à 1 059 965,29470775. |
| **B10** | **Deux (voire quatre) vérités du stock USDT** : la barre d'état et l'alerte mobile lisent `get_usdt_stock` (achats − ventes), la carte USDT mobile et l'onglet Comptes lisent le solde du pool au grand livre (ajustements et écritures futures compris). Mola recalcule une troisième fois avec `.limit(5000)`. | `MobileTreasuryHome.tsx:79, 91, 98` ; `TreasuryStatusBar.tsx:41-46` ; `admin-assistant/index.ts:1001-1007` | La carte USDT et le bandeau rouge juste dessous peuvent afficher deux chiffres différents. |
| **B11** | **Les aperçus des formulaires sont faux pour une saisie antidatée** : « WAC après », « Stock après », « Coût de revient » sont calculés à aujourd'hui, le serveur calcule à `occurred_at`. | `DesktopNewPurchase.tsx:116-121` ; `DesktopNewSale.tsx:89-91` ; `MobileNewSale.tsx:94-95, 212-226` | 18 ventes et 11 achats saisis avec plus d'un jour de retard en prod. |
| **B12** | **Rétroactivité silencieuse** : la valorisation lit `daily_rates` en direct ; modifier ou supprimer un taux passé change le bénéfice d'un mois clos sans trace. Un taux manquant donne NULL et la ligne disparaît des sommes sans avertissement. | `rpcs.sql:22-48` ; `lot7.sql:338-341, 367-369` ; `update_daily_rate`/`delete_daily_rate` (`20260831120000`, `20260831140000`) | Lecture du code. |
| **B13** | **Comptes inactifs comptés** dans les soldes et totaux, alors que les formulaires ne les proposent pas. | vue `schema.sql:249-264` ; `useTreasury.ts:33-46` ; `DesktopTreasuryScreen.tsx:72-82` ; `lot7.sql:290-304` | « N comptes » inclut les archivés. |
| **B14** | **Inventaire : faux écarts.** Le théorique affiché est arrondi à 2 décimales et lu dans la vue (écritures futures comprises), le serveur prend 8 décimales et `occurred_at ≤ now()`. L'opérateur recopie le chiffre affiché, obtient un écart « +0,00 » en rouge et doit écrire un motif. Mobile : comparaison de flottants `variance !== 0`. | `TreasuryAccountsView.tsx:81-86, 267, 282` ; `rpcs.sql:368-370` ; `MobileInventoryScreen.tsx:35-36, 86, 109` | Lecture du code. |
| **B15** | **Couleurs inversées pour les acheteurs** dans les tops : un écart positif (l'acheteur paie plus de CNY par USDT, bonne nouvelle) s'affiche en alerte. | `TreasuryAnalysisView.tsx:160-163, 178` ; `MobileTreasuryDashboard.tsx:393-401` | Lecture du code (le commentaire dit l'inverse du code). |
| **B16** | **Totaux du grand livre mélangeant les devises** : sous « Toutes devises », Entrées et Sorties additionnent XAF, USDT et CNY. « Écart cumulé » des inventaires idem. | `TreasuryLedgerView.tsx:78-87, 131-140` ; `TreasuryInventoryView.tsx:56, 90` | Lecture du code. |

### 1.B Bugs fonctionnels

| ID | Problème | Où | Preuve |
|---|---|---|---|
| **B17** | **Grand livre cassé** : (1) les libellés de nature ne correspondent à aucune valeur réelle → l'écran affiche « usdt purchase debit xaf », « void » ; (2) le lien « Voir l'opération » compare `'usdt_purchases'` (pluriel) à l'enum `'usdt_purchase'` → la colonne Origine est toujours « — ». | `TreasuryLedgerView.tsx:43-50, 58-62` ; enums `types.ts:4127-4139` | Vérifié dans le code le 05/10. Le harnais de capture utilise ces fausses valeurs (`mockTreasury.ts:271-288`), ce qui a masqué le bug. |
| **B18** | **Liens profonds morts** : `/operations/:kind/:id`, `/purchases/:id`, `/sales/:id`, `/counterparties/:id` ouvrent la liste sans l'objet sur desktop ; sur mobile, `/ledger` et `/operations/:kind/:id` ouvrent l'historique. | `treasuryNav.ts:169-187` (jamais appelés) ; `App.tsx:384, 386` | `grep` : 0 appelant de `operationFromPath` / `counterpartyFromPath`. |
| **B19** | **Impossible de vider un champ d'une contrepartie** : l'écran envoie `null`, le hook le change en `undefined`, la RPC lit NULL comme « ne rien changer ». Le toast dit « Contrepartie mise à jour ». | `TreasuryCounterpartiesView.tsx:130-133` ; `MobileCounterpartyEdit.tsx:81-84` ; `useTreasury.ts:118-122` ; `20260515000005:89-94` | Lecture du code. |
| **B20** | **Bouton « Annuler » montré au trésorier, refusé par le serveur** (desktop) après qu'il a tapé son motif. Le mobile, lui, filtre sur `super_admin`. | `TreasuryOperationPanel.tsx:87` vs `rpcs.sql:432-441` ; `MobileOperationDetail.tsx:34, 186` | Vérifié dans le code le 05/10. |
| **B21** | **Tableau de bord mobile qui « ne marche pas »** : en cas d'erreur, la roue tourne à l'infini ; si la RPC renvoie `{success:false}`, écran blanc (TypeError). Même plantage possible sur desktop. | `MobileTreasuryDashboard.tsx:160, 114, 171, 183` ; `useTreasury.ts:431-444, 469-484` ; `TreasuryAnalysisView.tsx:223` | Les hooks ne vérifient pas `success`. |
| **B22** | **Chargement et erreurs affichés comme des valeurs** : « 0 XAF · 0 compte » pendant le chargement (barre d'état, accueil mobile) ; « Aucun compte », « Aucune contrepartie », « Aucun comptage », « Aucune écriture » en cas d'erreur réseau ou de droits. | `TreasuryStatusBar.tsx:47-48` ; `MobileTreasuryHome.tsx:64-78` ; `TreasuryAccountsView.tsx:113-115` ; `TreasuryCounterpartiesView.tsx:167-170` ; `TreasuryInventoryView.tsx:41, 111-118` ; `TreasuryLedgerView.tsx:70, 155-158` | Aucune de ces vues ne lit `isError`. |
| **B23** | **Période mobile figée à l'ouverture** : une opération enregistrée après l'ouverture de l'écran reste invisible. Décalage d'un jour en UTC+1 sur la plage personnalisée. | `treasuryDashboardUtils.ts:21` ; `MobileTreasuryDashboard.tsx:105-106, 110` ; `MobileOperationsHistory.tsx:15` ; `MobilePurchasesList.tsx:33` ; `MobileSalesList.tsx:28` | 4 versions de `getRange`. |
| **B24** | **Retour arrière qui rouvre un formulaire vide** (desktop) : la fermeture d'une saisie fait un `navigate` en push. | `DesktopTreasuryScreen.tsx:61` ; `DesktopNewPurchase.tsx:143` ; `DesktopNewSale.tsx:106` | Historique [vue, /purchase, vue]. |
| **B25** | **Panneau de détail hors écran entre 1024 et 1279 px** : aucune grille définie sous `xl`, le panneau tombe sous 25 lignes ; cliquer une ligne semble ne rien faire. | `TreasuryOperationsWorkbench.tsx:138` | Lecture du code. |
| **B26** | **Filtre « Canal » mort** : `channel` est toujours NULL depuis la version multi-comptes. | `MobilePurchasesList.tsx:87, 156-165` ; `20260516000003:19, 104` | Prod : `channel` NULL dans 113 achats sur 138. |
| **B27** | **Saisie « 1.000.000 » = 1 XAF** ; le signe « − » est accepté. | `AmountField.tsx:182-190` ; `MoneyField.tsx:66` ; `TreasuryMoneyInput.tsx:77-79` | Lecture du code. |
| **B28** | **Requêtes sans limite** : au-delà de 1 000 lignes, PostgREST tronque sans prévenir ; la courbe WAC (historique trié du plus ancien) perdra les opérations récentes. | `useTreasury.ts:502-532, 580-632, 650-681` ; `useTreasuryLedger` limité à 200 sans pagination (`:742-764`) | 138 + 94 lignes aujourd'hui : risque latent. |
| **B29** | **Annulation incomplète** : contre-écritures datées `now()` et non à la date de l'opération (historique des soldes faux entre les deux) ; `void_contra_entry_id` ne garde que la 1re contre-écriture ; ajustements et inventaires impossibles à annuler, alors que Mola annonce le contraire. | `rpcs.sql:447-465, 481, 500, 507` ; `admin-assistant/index.ts:2280` | Lecture du code. |
| **B30** | **Feuille d'annulation masquée par la barre d'onglets** (à confirmer sur appareil) : même `z-50`, barre rendue après. | `VoidOperationDialog.tsx:31-32` ; `MobileTabBar.tsx:59` ; `App.tsx:399, 401` | Déduit de l'ordre DOM. |
| **B31** | **Fiche contrepartie mobile qui efface la saisie** à chaque rechargement des données (ex. après « Archiver »). | `MobileCounterpartyEdit.tsx:36-44, 89-91` | Lecture du code. |

### 1.C Sécurité et intégrité

| ID | Problème | Où | Preuve |
|---|---|---|---|
| **B32** | **Coût moyen et stock lisibles par n'importe qui** : `get_wac_usdt`, `get_usdt_stock`, `get_xaf_per_cny_at` sont `SECURITY DEFINER` sans garde, EXECUTE pour `anon`. | `rpcs.sql:22-108` (aucun `REVOKE`) | Contraire à `.claude/rules/security.md`. |
| **B33** | **Mola lit la trésorerie pour tous les rôles** (support, cash_agent…) en service-role : `READ_TOOLS` ignore la permission. | `admin-assistant/index.ts:3030` ; `eval/assistant/cases.ts:53-60` | L'UI refuse ces rôles. |
| **B34** | **Aucun verrou** : double clic sur « Annuler » = deux jeux de contre-écritures ; deux inventaires simultanés = écart posté deux fois. | `rpcs.sql:448, 456` ; `rpcs.sql:347-349` ; aucun `FOR UPDATE` dans les 8 migrations | 0 cas en prod à ce jour. |
| **B35** | **Matrice de droits parallèle et sans lecture seule** : `can_access_treasury` au lieu d'`admin_has_permission` ; `canManageTreasury` vérifié nulle part côté serveur ; `canView` = `canManage`. Étiquettes Mola des écritures en `canViewTreasury`, sans `confirm` — et **absentes en prod** (vérifié via `obj_description` le 05/10). | `schema.sql:75-89` ; `AdminAuthContext.tsx:69-70` ; `20260603180000_mola_capability_tags_full.sql:34-41` | Le test `rolePermissionParity.test.ts` ne couvre pas cette matrice. |
| **B36** | **Base de prod ≠ dépôt** : la migration `partner_settlements` (version prod `20260830202749`) n'existe que sur une branche non fusionnée. `get_unsettled_payments` renvoie les noms des clients au trésorier (qui n'a pas `canViewClients`). | `types.ts:2694-2695, 2992, 3796-3800, 3944-3961` ; `origin/claude/usdt-cny-tracking-z7m9pc` | `supabase_migrations.schema_migrations`. |
| **B37** | **Saisies non bornées** : date future acceptée (entre dans les soldes mais pas dans le stock) ; compte inactif et contrepartie archivée acceptés ; XAF à décimales acceptés ; même compte deux fois dans une répartition ; `account_id` non-UUID → exception SQL brute. | `20260516000003:29, 67-90` ; `lot7.sql:148, 176-187` ; `20260516000001:25, 43, 51-54` | Lecture du code. |

---

## 2. MAJEUR — navigation, structure, formulaires

### 2.A Architecture d'information et navigation

| ID | Problème | Où | Preuve |
|---|---|---|---|
| **M1** | **Pas de hiérarchie** : 6 onglets au même niveau mélangent le quotidien (Opérations), le pilotage (Analyse), les référentiels (Comptes, Contreparties) et le contrôle (Inventaires, Grand livre). Inventaires est un onglet de premier niveau toujours vide. Pas de vue d'ensemble (prévue par le doc 08, jamais faite). | `treasuryNav.ts:36-79` ; `docs/admin-redesign/08-treasury-rebuild.md:113` | 0 inventaire en prod. |
| **M2** | **Lanceur mobile de 10 tuiles** à poids égal : « Analyse » contient une liste et un outil d'export ; les deux actions principales (achat, vente) sont sous la ligne de flottaison ; même icône pour « Nouvel achat » et « Mes achats ». | `MobileTreasuryHome.tsx:115-137, 129-132` | — |
| **M3** | **Aucun lien entre objets** : opération → contrepartie / compte / écritures ; contrepartie → opérations ; compte → mouvements ; top → fournisseur ; comptage → écriture. Les chemins existent dans `treasuryPaths` mais ne sont branchés à rien. | `TreasuryOperationPanel.tsx:153` ; `treasuryNav.ts:95-101` ; `MobileOperationDetail.tsx:149, 171` ; `MobileTreasuryDashboard.tsx:378-379` | `grep <Link` : 0 dans ces vues. |
| **M4** | **Desktop et mobile sont deux modules différents** : URL différentes, écrans différents (grand livre et historique d'inventaires desktop seulement ; listes Achats/Ventes mobile seulement), formulaires réécrits deux fois, période partagée d'un côté et par écran de l'autre. | `App.tsx:381-403` ; voir carte §3.5 | — |
| **M5** | **Trois listes mobiles pour les mêmes données** (Historique, Mes achats, Mes ventes) ; retour du détail figé vers l'historique ; après annulation, idem ; `navigate(-1)` sur lien profond. | `MobileOperationDetail.tsx:53, 64, 84, 96` | — |
| **M6** | **L'état ne survit pas** : filtre, recherche, tri, page et sélection d'Opérations sont perdus au changement d'onglet ; période hors URL, remise à « ce mois » au rafraîchissement ; sur mobile, chaque écran a sa période (calendaire ou glissante). | `TreasuryOperationsWorkbench.tsx:70-75, 125` ; `DateRangeContext.tsx:70-75` | — |
| **M7** | **Le « Visuel des soldes » est un module à part** : hors coquille, sans retour, soldes retapés à la main sur 6 comptes codés en dur (noms différents des vrais comptes), document en anglais signé « Bonzini », tutoiement. | `DesktopBalanceDashboard.tsx:26, 48, 122-124` ; `constants.ts:48-55` ; `BalanceDashboardPreview.tsx:258` | Défaut déjà relevé dans le doc 08 §3, non corrigé. |
| **M8** | **Le trésorier n'arrive jamais sur la trésorerie** : `staffHomeFor` le renvoie sur `/m` (dépôts/paiements qu'il ne peut pas voir) ; pas d'onglet Trésorerie sur le web mobile. | `src/lib/staffHome.ts:20` ; `MobileTabBar.tsx:43-50` ; `DesktopDashboard.tsx:97-128` | — |
| **M9** | **Le cœur du métier n'a pas d'écran** : rattacher les paiements clients aux ventes USDT (règlement partenaire) existe en base, pas dans l'interface. | `treasuryNav.ts:101` (`/settle`) ; branche `d86f8120` | 0 `payment_id` en prod. |
| **M10** | **Empilement d'en-têtes** : topbar « Trésorerie », h2 « Trésorerie », barre d'état, onglets, titre de carte qui répète l'onglet, filtres → 400 à 450 px avant la première ligne. | `DesktopTreasuryScreen.tsx:92` ; `TreasuryOperationsWorkbench.tsx:141` ; `TreasuryLedgerView.tsx:100-101` | — |

### 2.B Formulaires

| ID | Problème | Où |
|---|---|---|
| **M11** | **Les deux formulaires jumeaux ne se lisent pas pareil** : achat = Fournisseur → Compte → Montant → Date ; vente = Acheteur → Montant → Compte → Date. En multi-comptes, le « montant » est éclaté sur deux étapes. Mobile : modes de saisie cachés derrière un lien pour l'achat, toujours visibles pour la vente. | `DesktopNewPurchase.tsx:211-324` ; `DesktopNewSale.tsx:179-249` ; `MobileNewPurchase.tsx:267, 283-285` ; `MobileNewSale.tsx:194` |
| **M12** | **Aucune confirmation avant une écriture irréversible** (mobile) ; sur desktop, Échap ou un clic à côté ferme un formulaire rempli sans prévenir. | `MobileNewPurchase.tsx:335-337` ; `MobileNewSale.tsx:259-261` ; `TreasuryEntryDialog.tsx:47-52` |
| **M13** | **Pas de modification** : chaque erreur coûte une annulation (super admin, motif ≥ 10) + une ressaisie. | Prod : 12,3 % des achats annulés, 14 sur 17 en moins d'une heure |
| **M14** | **Informations de décision absentes** : solde du compte débité, alerte de découvert, marge implicite de la vente comparée au taux client, conséquence d'une vente à stock négatif (coût 0). | `DesktopNewPurchase.tsx` ; `DesktopNewSale.tsx:167-175` ; `MobileNewSale.tsx:229-237` |
| **M15** | **Date cachée** dans « Détails » replié (mobile) alors qu'elle décide du coût ; Ajuster et Inventorier ne sont pas datables. | `MobileNewPurchase.tsx:316-333` ; `TreasuryAccountsView.tsx` ; `MobileAccountsScreen.tsx:135-236` |
| **M16** | **Ventes sans compte CNY par défaut** : l'option « Aucun compte Bonzini » est présélectionnée → les comptes CNY et l'inventaire n'ont jamais servi. | `DesktopNewSale.tsx:231-247` ; `MobileNewSale.tsx:179` | 
| **M17** | **Trois formulaires de création de contrepartie** différents (achat : nom + téléphone ; vente : 4 champs ; annuaire : 5 champs). Nom 1 caractère côté écran / 2 côté serveur ; « Nouvelle » sans complément ; note sur une ligne ; aucun contrôle de doublon ; archivage sans confirmation ; corbeille proposée même quand la suppression est impossible. | `DesktopNewPurchase.tsx:345-365` ; `TreasuryCounterpartiesView.tsx:108, 140, 161-163, 208, 255-256` ; `MobileCounterpartyEdit.tsx:189-195` |
| **M18** | **Listes déroulantes sans recherche ni « Tous »** : impossible de revenir à « Tous les fournisseurs » sans tout réinitialiser. | `TreasurySelect.tsx:30, 44-50` ; `SelectField.tsx:32` ; `MobilePurchasesList.tsx:148-154` |
| **M19** | **Comptes mobile : taper un compte ouvre un mouvement d'argent**, crédit par défaut, avec un exemple qui invite à saisir des encaissements clients ici (risque de double comptage avec Dépôts). | `MobileAccountsScreen.tsx:106-110, 144, 209` |
| **M20** | **Retour forcé à l'accueil après chaque saisie** (mobile) : la saisie répétée est pénalisée. | `MobileNewPurchase.tsx:154` ; `MobileNewSale.tsx:114` |
| **M21** | **Messages bruts** : erreurs serveur sans accents (« Acces tresorerie refuse », « Annulation reservee au super admin ») ; toasts au format anglais (« Nouveau WAC: 1025.9760 », « ATTENTION: stock USDT négatif (12.00) », « Écart: -1500.00 » sans devise). | `useTreasury.ts:98, 134, 152, 228, 230, 300-302, 305, 335, 337, 369, 399` |
| **M22** | **Vocabulaire incohérent sur l'argent** : « Annuler » = fermer un formulaire ET contre-passer une opération ; Supprimer / Supprimée / Annulée / void pour la même action ; « Mes achats » liste les achats de tous ; « Opérations » a trois sens dans l'admin ; Analyse / Dashboard trésorerie / Tableau de bord. | `DesktopNewPurchase.tsx:203` vs `TreasuryOperationPanel.tsx:89` ; `MobileOperationDetail.tsx:104, 191` ; `MobilePurchasesList.tsx:141` ; `desktopNav.ts:67` |

### 2.C Lecture des chiffres

| ID | Problème | Où |
|---|---|---|
| **M23** | **Unités absentes ou mélangées** : colonne « Taux » mêlant XAF/USDT (~600) et CNY/USDT (~7) sans unité, triable ensemble ; « Contre-valeur » mêlant XAF et CNY ; taux d'achat/vente sans unité dans Analyse. | `TreasuryOperationsWorkbench.tsx:117, 178-186, 223-225` ; `TreasuryAnalysisView.tsx:110-112` |
| **M24** | **Unité de taux différente du reste de la plateforme** : partout ailleurs CNY pour 1 M XAF (≈ 11 000), ici XAF/CNY (≈ 90) ; le mobile affiche les deux. | `TreasuryAnalysisView.tsx:244-249` ; `MobileTreasuryDashboard.tsx:89-96` |
| **M25** | **« 0,00 » au lieu de « — »** : `implicit_rate` NULL, taux moyens sans opération, WAC à stock nul (« 0,0000 XAF/USDT »). | `TreasuryOperationsWorkbench.tsx:224` ; `TreasuryOperationPanel.tsx:125` ; `TreasuryAnalysisView.tsx:261, 270` ; `MobileTreasuryHome.tsx:105-113` ; `MobileTreasuryDashboard.tsx:192-193` |
| **M26** | **Graphiques trompeurs** : WAC (fonction en escalier) tracé en segments obliques ; 80 % du graphique vide à droite en début de mois ; axe catégoriel mobile (points équidistants quel que soit le temps) ; courbe WAC qui plonge à 0 ; « Pas assez d'opérations » alors que le WAC existe. | `TreasuryRateChart.tsx:87-93, 121-125` ; `MobileTreasuryDashboard.tsx:246, 492` ; `useTreasury.ts:622-626` |
| **M27** | **Trop d'informations sur l'Analyse mobile** : ≈ 13 blocs dans un seul défilement, chiffres répétés (WAC 4 fois). | `MobileTreasuryDashboard.tsx:136-330` |

---

## 3. MINEUR — design

| ID | Problème | Preuve |
|---|---|---|
| **m1** | **Quatre kits visuels** : `components/treasury/ui.tsx` (mobile « doux », rounded-3xl, couleurs de marque), `mobile/designKit` (Figma gris, rayon 8), `marketKit.tsx` (desktop shadcn + Phosphor + indigo/ambre), `desktop/designKit` (PRIMARY_PILL). 12 des 14 exports de `ui.tsx` doublonnent le kit ; 7 collisions de noms aux rendus différents (`SectionTitle`, `PrimaryPill`, `Segmented`, `SelectField`, `TONE_BG`…). | `ui.tsx` ; `marketKit.tsx` ; `DesktopBalanceDashboard.tsx:13-15` |
| **m2** | **Couleurs sans sens stable** : violet = XAF, achat ET « Analyse » ; ambre = USDT sur mobile, vente sur desktop, ET alerte ; orange = CNY, Contreparties, Visuel. 3 violets, 4 ambres, 7 rouges. 148 occurrences de hex en dur (41 valeurs). Primaire noir en admin-theme : un filtre actif ressemble au bouton « Vente USDT », un lien ressemble à du texte. Aucune des 3 couleurs du logo n'est utilisée de façon cohérente. | `MobileTreasuryHome.tsx:90-93, 119-135` ; `marketKit.tsx:74-94, 213` ; `index.css:1322` ; `TreasuryAnalysisView.tsx:55-57` |
| **m3** | **Contrastes insuffisants (le « flou »)** : texte pâle `T.faint` ≈ 2,9:1 (30 usages, en 9,5 à 11 px) ; libellé USDT ambre ≈ 2:1 ; champs MoneyField/SelectField ≈ 1,07:1 sur carte blanche ; encarts INSET blanc sur blanc ; segment actif ≈ 1,1:1 ; lignes annulées à 45 % d'opacité ≈ 1,5:1 ; chevrons ≈ 2:1. | `marketKit.tsx:64, 71` ; `ui.tsx:35, 45-47, 130` ; `MoneyField.tsx:51` ; `Segmented.tsx:28, 39` ; `TreasuryOperationsWorkbench.tsx:198` |
| **m4** | **Pas d'échelle typographique** : 23 tailles dans le module ; 92 occurrences sous 13 px sur desktop ; en-têtes de colonnes à 10 px majuscules ; l'avertissement « irréversible » est le plus petit texte de sa feuille (12 px). | `marketKit.tsx:71` ; `VoidOperationDialog.tsx:45` ; `OperationListItem.tsx:58-78` |
| **m5** | **Géométrie incohérente** : 9 rayons (4 px à 24 px) ; hauteurs de contrôles 32 / 44 / 48 / 52 / 54 px, mélangées dans un même formulaire. | `TreasuryAccountsView.tsx:191, 205, 221, 265` ; `MoneyField.tsx:51` ; `SelectField.tsx:33` |
| **m6** | **Trois styles de fenêtre** (voile flouté 20 %, voile noir 80 %, page), **trois boutons de fermeture**, deux interfaces d'annulation (feuille et formulaire en ligne). | `TreasuryEntryDialog.tsx:59, 89-94` ; `TreasuryOperationPanel.tsx:92-99, 179-206` ; `MobileOperationDetail.tsx:186-214` |
| **m7** | **Deux jeux d'icônes** (Phosphor desktop, lucide mobile et sélecteur de période) ; sélecteur de période de 44 px au milieu de contrôles de 32 px. | `DateRangePicker.tsx:3, 79-83` ; `marketKit.tsx:565-571` |
| **m8** | **Formats de nombres et de dates hétérogènes** : USDT en 0, 2 ou 4 décimales selon l'écran ; WAC en 2 (desktop) ou 4 (mobile) ; XAF à 2 décimales dans le grand livre et les inventaires ; abréviation « M » sur mobile ; `fmt` recopié 8 fois ; dates au fuseau du navigateur alors que les périodes sont en jours de Douala. | `TreasuryLedgerView.tsx:135-188` ; `TreasuryInventoryView.tsx:140-159` ; `MobileTreasuryHome.tsx:41-43` ; `OperationListItem.tsx:40-42, 79` |
| **m9** | **Accessibilité** : lignes cliquables sans clavier ; onglets Radix sans panneaux ; feuille d'annulation sans `role="dialog"` ni piège de focus ; libellés non associés aux champs. | `TreasuryOperationsWorkbench.tsx:191-199` ; `marketKit.tsx:176-195` ; `VoidOperationDialog.tsx:31-73` ; `SelectField.tsx:31` |
| **m10** | **Registre et langue** : tutoiement et vouvoiement mélangés, « papa » dans une aide, « Custom », « Dashboard », document de soldes en anglais, « Bonzini » au lieu de « Bonzini Labs ». | `MobileNewSale.tsx:186-187` ; `MobileNewPurchase.tsx:290` ; `treasuryDashboardUtils.ts:17` ; `BalanceDashboardPreview.tsx:258` |
| **m11** | **Code mort et commentaires faux** : branches `desktop` des écrans mobiles, `SoftCard`, `MCrumbs`, `MDropdown`, `crumbsFor`, champ `writes`, exports de `index.ts`, `is_treasurer()`, colonne `channel` ; commentaires « Inter », « 4 vues », « 36 px », « l'URL ne change pas », « redirigent », « liens profonds réparés », « NO hard border ». | `DesktopTreasuryScreen.tsx:11-14, 85` ; `treasuryNav.ts:32-33, 164-167` ; `index.ts:7-14` ; `ui.tsx:13-14, 81-87` |

---

## 4. Causes racines

1. **Le modèle comptable ne représente pas le métier réel.** Le grand livre ne connaît que l'achat et la vente d'USDT. Il n'y a ni entrée XAF (dépôts, apports, soldes d'ouverture), ni virement interne, ni lien avec les paiements clients, ni crédit CNY obligatoire. Résultat : soldes XAF uniquement débiteurs, stock qui dérive dès qu'une saisie manque, comptes CNY morts. → B1, B3, B4, B16, M9, M16.

2. **Le coût moyen dépend de l'ordre de saisie.** Figer `wac_at_sale` sans jamais revaloriser, et renvoyer 0 quand le stock est vide, transforme chaque retard de saisie en erreur permanente. Le terrain saisit en retard (18 ventes à plus d'un jour). → B1, B2, B5, B11.

3. **Aucune définition écrite des indicateurs.** « Bénéfice », « marge », « revient », « capital » ne sont définis nulle part ; les formules mélangent prix client et coût, des volumes non appariés, des moyennes de période et des coûts figés. Les légendes à l'écran décrivent d'autres formules. → B5, B6, B7, B12.

4. **Une saisie 100 % manuelle, double et sans filet.** Chaque deal demande deux saisies (achat, puis vente), ≈ 45-60 s et une quinzaine de gestes, sans pré-remplissage, sans modification, sans contrôle de vraisemblance, sans détection d'oubli. Un seul utilisateur, débordé, a lâché la partie « vente ». Le module ne reflète plus l'activité, donc ses tableaux de bord sont faux, donc il n'est plus utilisé : cercle vicieux. → B4, B8, M13, M20.

5. **Absence d'architecture d'information.** Le module s'est construit par couches (15 commits, 4 directions visuelles en 3 semaines) sans carte des tâches : tout est au même niveau, rien n'est relié, la vue d'ensemble et le règlement — prévus par le doc 08 — n'ont jamais été livrés, les aides de navigation ont été écrites puis jamais branchées. → M1 à M10.

6. **Deux implémentations parallèles desktop / mobile.** Formulaires réécrits deux fois, listes recopiées (Achats ≈ Ventes), `getRange` ×4, `fmt` ×8, WAC recalculé en JS en plus du SQL, routes divergentes. Chaque correction doit être faite deux fois et ne l'est pas. → B10, B23, M4, M11.

7. **Pas de design system commun appliqué.** Quatre kits cohabitent, les jetons sont contournés par du hex en dur, les noms de composants se télescopent, le kit mobile lui-même se contredit (« rayon 8 » qui rend 12 px, « aucune bordure » qui est une bordure). → m1 à m7.

8. **Vérification sur données factices.** Le harnais de captures et les deux seuls tests du module utilisent un mock aux fausses énumérations, aux comptes inexistants, au WAC jamais nul ; aucun test ne couvre les formules SQL, les liens, les droits. Les écrans « validés » en capture n'existent pas avec les vraies données. → B17, B18, B20.

9. **Contrat client / serveur non typé et sans convention.** `entry_kind` typé `string`, `success` jamais vérifié, erreurs serveur affichées brutes, pas de règle commune chargement / erreur / vide. → B17, B21, B22, M21.

10. **Gouvernance technique relâchée.** Matrice de droits parallèle, lecture = écriture, Mola qui ignore les permissions, fonctions ouvertes à `anon`, aucun verrou, migrations appliquées en prod depuis une branche non fusionnée. → B32 à B37.

---

## 5. Ce qui est bon et à garder

**Fondations serveur**
- Grand livre **en ajout seul**, montants signés, annulation par contre-écriture, RLS en lecture seule, toutes les écritures via RPC `SECURITY DEFINER` avec `admin_audit_logs`. En prod : 0 écriture orpheline, 0 double annulation, 0 écart de devise, 0 écart entre `implicit_rate` et le calcul. Le registre est **mécaniquement juste** ; ce sont les données saisies et les formules qui sont fausses.
- **Répartition d'un achat sur plusieurs comptes** (utilisée dans 34 achats sur 138).
- Identifiants lisibles **F-001 / A-001** des contreparties ; archivage distinct de la suppression ; refus de supprimer une contrepartie qui a servi.
- Motif obligatoire pour annuler, ajuster ou justifier un écart.
- L'idée de **figer le coût d'une vente** (traçabilité) — à condition de prévoir une revalorisation.

**Interface desktop**
- Une coquille unique où **l'URL décide de la vue**, et des saisies en fenêtre au-dessus de la vue courante.
- **Période partagée** entre les vues, bornée en **jours de Douala** (`treasuryPeriodScope.tsx`).
- **Table unique des opérations** avec annulées visibles, recherche, tri — meilleure que les trois listes mobiles.
- `treasuryFormat.ts` : XAF sans décimales, pas d'abréviation « M » (une trésorerie se lit au franc près).
- Les aides de navigation déjà écrites (`treasuryPaths`, `operationFromPath`, `counterpartyFromPath`, `crumbsFor`, `MCrumbs`) : il suffit de les brancher.
- La **barre d'état** permanente (stock, coût moyen, totaux) comme principe.

**Interface mobile**
- `OperationListItem` : une seule ligne pour achat / vente / annulée.
- Formulaires qui **montrent la valeur déduite** (encadré) et **l'effet de la saisie** (WAC après, stock après) — bonne idée, à calculer à la bonne date.

**Contexte**
- Mola dispose déjà d'outils de trésorerie dédiés (lecture et écriture avec confirmation).
- Les docs `docs/admin-redesign/07-treasury-module.md` et `08-treasury-rebuild.md`, `docs/audit-tresorerie-mobile.md` et le plan d'automatisation de la branche `claude/usdt-cameroon-china-automation-5kevnc` contiennent des constats et des pistes encore valables.

---

## 6. Questions à poser au fondateur

**Usage et surface**
1. Sur quelle surface travaillez-vous vraiment : desktop web, mobile web, ou l'app BONZINI HQ ? Laquelle refaire en premier ?
2. Qui doit tenir la trésorerie demain : vous seul, un trésorier, votre père ? (Aucun compte `treasurer` n'existe.) Faut-il un rôle en **lecture seule** ?
3. Depuis le 25/08, où sont suivies les ventes USDT → CNY (Excel, WeChat, règlement partenaire) ? Combien de deals par jour ?

**Définitions (à trancher avant de dessiner l'Analyse)**
4. Quel « bénéfice » voulez-vous voir ? Proposition : **XAF encaissés auprès des clients − coût réel en USDT des CNY livrés pour eux**, par paiement, avec un rattachement paiement ↔ vente.
5. À quel taux valoriser le CNY : coût réel, taux réel de l'acheteur, ou taux client publié ? Les taux passés doivent-ils être figés pour que les mois clos ne bougent plus ?
6. Quelle unité de taux afficher : **CNY pour 1 M XAF** (comme les taux du jour) ou **XAF pour 1 CNY** ?
7. Une vente à stock négatif doit-elle être interdite, ou acceptée « à régulariser » avec recalcul du coût quand l'achat arrive ?

**Données de départ**
8. Quels sont, aujourd'hui, les **soldes réels** des 6 comptes XAF et le **stock USDT réel** (et où sont les USDT : Binance, TRC20…) ? Peut-on repartir d'une **date d'ouverture propre** plutôt que corriger 232 opérations ?
9. L'achat actif du 10/09/2026 (6 251 519 XAF pour 603 USDT, soit 10 367 XAF/USDT) est-il une faute de frappe ?
10. Les **dépôts clients validés** doivent-ils alimenter automatiquement les comptes XAF ? Et les retraits Mobile Money, les frais, les virements entre comptes ?

**Périmètre**
11. Faut-il garder les 3 comptes CNY (« Papa ») et l'inventaire, jamais utilisés, ou suivre seulement XAF et USDT ? Quels comptes réels existent aujourd'hui (caisse XAF, second portefeuille USDT) ? Faut-il pouvoir les gérer depuis l'écran ?
12. Le **règlement des paiements clients en USDT** (branche non fusionnée, déjà en base) est-il le parcours principal à construire — une boîte « paiements à rattacher » plutôt que des formulaires vides ?
13. Le « Visuel des soldes » sert-il encore ? Doit-il lire les vrais soldes, inclure USDT et CNY, en français, avec l'en-tête NORTON GAUSS BONZINI SARL ?

**Règles**
14. Qui peut **annuler** une opération : vous seul ou aussi le trésorier ? Veut-on une vraie **modification** (avec historique) plutôt qu'annuler + ressaisir ?
15. Les montants XAF de trésorerie doivent-ils être **entiers** comme partout ailleurs ?
16. Mola doit-il pouvoir lire la trésorerie pour tous les rôles (aujourd'hui oui, contrairement aux règles du projet) ?

**Design**
17. Un seul langage visuel pour tout le module (kit gris, couleur = statut), ou une **couleur par devise** (XAF / USDT / CNY) assumée et documentée ?

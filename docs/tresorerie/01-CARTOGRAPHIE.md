# Trésorerie (app admin) — Cartographie complète

> État au **05/10/2026**. Branche `main`. Sources : lecture intégrale du code du module
> (≈ 9 000 lignes : `src/desktop/screens/treasury/*`, `src/mobile/screens/treasury/*`,
> `src/components/treasury/*`, `src/hooks/useTreasury.ts`, 8 migrations), plus des requêtes
> `SELECT` en lecture seule sur la base de production (`fmhsohrgbznqmcvqktjw`).
> Le diagnostic (problèmes, causes, questions) est dans [`02-DIAGNOSTIC.md`](./02-DIAGNOSTIC.md).

---

## 1. Le métier en 10 lignes

1. Les clients importateurs déposent des **XAF** sur 6 comptes Bonzini au Cameroun : 4 banques (Afriland, UBA, Ecobank, CCA) et 2 Mobile Money (MTN, Orange).
2. Pour régler leurs fournisseurs chinois en **CNY**, Bonzini **achète des USDT** avec ces XAF auprès de fournisseurs USDT camerounais (contreparties `F-001`, `F-002`…).
3. Les USDT achetés vont dans **un pool unique** (`usdt_pool`).
4. Bonzini **vend ces USDT contre des CNY** à des acheteurs / partenaires en Chine (contreparties `A-001`…), qui règlent les fournisseurs des clients.
5. Les CNY peuvent transiter par 3 comptes Bonzini (cash Guangzhou, Alipay, WeChat) — en pratique, jamais.
6. La trésorerie doit répondre à 4 questions : **combien j'ai** (soldes, stock USDT), **combien me coûte 1 USDT** (coût moyen pondéré, « WAC »), **combien me coûte 1 CNY livré** (taux de revient XAF/CNY), **combien je gagne** (marge, bénéfice).
7. La marge réelle = ce que le client paie en XAF pour 1 CNY − ce que coûte réellement 1 CNY livré par la chaîne XAF → USDT → CNY.
8. Chaque mouvement d'argent est une écriture dans un **grand livre en ajout seul** ; on ne modifie jamais, on **annule par contre-écriture**.
9. Le contrôle passe par des **inventaires** (solde compté contre solde théorique) et des **ajustements manuels** motivés.
10. Le module est réservé aux rôles `super_admin` et `treasurer`. En production, **un seul super_admin** l'utilise ; aucun compte n'a le rôle `treasurer`.

```
Clients ──XAF──▶ [6 comptes XAF] ──achat──▶ [Pool USDT] ──vente──▶ [CNY] ──▶ fournisseurs chinois des clients
                  banques / MoMo   F-xxx        stock, WAC     A-xxx    (comptes CNY Bonzini optionnels)
```

---

## 2. Modèle de données

### 2.1 Tables et vue

| Objet | Fichier | Rôle | Colonnes clés |
|---|---|---|---|
| `treasury_accounts` | `20260515000002_treasury_schema.sql:115-125` | Les comptes | `code` unique, `label`, `currency` (XAF/USDT/CNY), `kind` (bank, mobile_money, crypto_pool, cash, alipay, wechat, other), `is_active`, `sort_order`. **10 comptes créés en dur** (`:306-316`), aucune RPC pour en créer, renommer ou désactiver. |
| `treasury_counterparties` | `schema.sql:94-107` + `20260516000002_treasury_lot7.sql:30-88` | Fournisseurs USDT / acheteurs CNY | `type` (usdt_supplier / cny_buyer), `display_name`, `legal_name`, `phone`, `wechat_id`, `notes`, `is_active`, `archived_at`, `short_id` (trigger : `F-001`, `A-001`). Prod uniquement : `settlement_rate`, `settlement_rate_updated_at`. |
| `usdt_purchases` | `schema.sql:131-148` | Achat d'USDT en XAF | `occurred_at`, `supplier_id`, `xaf_account_id` (NULL si réparti sur plusieurs comptes), `xaf_amount`, `usdt_amount`, `implicit_rate` = xaf/usdt (générée), `external_ref`, `notes`, `voided_at/by/reason`, `void_contra_entry_id`, `channel` (toujours NULL depuis `20260516000003:19`). |
| `usdt_sales` | `schema.sql:158-175` | Vente d'USDT contre CNY | `buyer_id`, `cny_account_id` (optionnel, `lot7.sql:27`), `usdt_amount`, `cny_amount`, `implicit_rate` = cny/usdt, `wac_at_sale` (coût moyen figé à la saisie), champs d'annulation. Prod uniquement : `payment_id` (lien vers un paiement client). |
| `treasury_ledger_entries` | `schema.sql:207-220` | **Grand livre** (source des soldes) | `account_id`, `currency`, `amount` signé (+ crédit / − débit), `occurred_at`, `entry_kind`, `source_table` + `source_id`, `contra_entry_id`, `metadata`. RLS : SELECT seul. |
| `treasury_inventory_snapshots` | `schema.sql:187-198` | Comptages | `snapshot_at`, `theoretical_balance`, `actual_balance`, `variance` = réel − théorique (générée), `variance_reason`, `adjustment_entry_id`. |
| Vue `treasury_account_balances` | `schema.sql:249-264` | Soldes affichés | `balance` = SUM(amount) de toutes les écritures du compte, **sans filtre de date ni d'`is_active`**, + `last_entry_at`, `entry_count`. |

Tous les montants et taux sont en `NUMERIC(20,8)`. Énumérations :

- `entry_kind` : `usdt_purchase_debit_xaf`, `usdt_purchase_credit_usdt`, `usdt_sale_debit_usdt`, `usdt_sale_credit_cny`, `inventory_adjustment`, `void`.
- `source_table` : `usdt_purchase`, `usdt_sale`, `inventory_snapshot`, `manual_adjustment`, `void` (singulier).

**Aucun type d'écriture n'existe pour une ENTRÉE d'argent** (dépôt client, apport, virement entre comptes) : un compte XAF ne peut que baisser, sauf ajustement manuel.

### 2.2 Écritures produites par chaque opération

| Opération (RPC) | Écritures au grand livre | Fichier |
|---|---|---|
| Achat (`record_usdt_purchase`) | 1 débit XAF **par compte** de la répartition + 1 crédit USDT sur le pool | `20260516000003_treasury_purchase_multi_account.sql:108-137` |
| Vente (`record_usdt_sale`) | 1 débit USDT sur le pool + 1 crédit CNY **seulement si un compte CNY est choisi** | `lot7.sql:205-229` |
| Ajustement (`adjust_treasury_account`) | 1 écriture `inventory_adjustment` / `manual_adjustment` (même `entry_kind` qu'un écart d'inventaire) | `20260516000001_treasury_adjust_account.sql:59-74` |
| Inventaire (`record_inventory_snapshot`) | 1 comptage + 1 écriture d'écart si l'écart ≠ 0 | `20260515000004_treasury_rpcs.sql:358-382` |
| Annulation (`void_treasury_operation`) | 1 contre-écriture de signe opposé par écriture d'origine, **datée `now()`** ; achats et ventes uniquement | `rpcs.sql:467-493` |

### 2.3 Formules (telles qu'implémentées)

| Grandeur | Formule | Fichier |
|---|---|---|
| **Stock USDT** (`get_usdt_stock(p_at)`) | Σ usdt achetés non annulés − Σ usdt vendus non annulés, `occurred_at ≤ p_at`. Calculé sur les tables d'opérations, **pas sur le grand livre** (ignore ajustements et inventaires du pool). Négatif permis. | `rpcs.sql:92-108` |
| **WAC** (`get_wac_usdt(p_at)`) | On rejoue achats (+xaf, +usdt) et ventes (−usdt × `wac_at_sale`, −usdt). WAC = Σxaf / Σusdt si Σusdt > 0, **sinon 0**. | `rpcs.sql:59-86` |
| `wac_at_sale` | `get_wac_usdt(p_occurred_at)` figé à la saisie de la vente, **jamais recalculé** | `lot7.sql:194` |
| Valorisation XAF/CNY (`get_xaf_per_cny_at`) | 1 000 000 / `daily_rates.rate_<canal>` (taux **client** publié, CNY pour 1 M XAF) à la dernière publication ≤ date. cash → rate_cash, alipay → rate_alipay, wechat → rate_wechat, tout le reste → rate_virement. NULL si aucun taux. | `rpcs.sql:22-48` |
| `spread_chain_xaf` | Σ ventes (cny × XAF/CNY du canal à la date − usdt × `wac_at_sale`) | `lot7.sql:338-341` |
| `spread_client_xaf` | Σ paiements `completed` créés dans la période (`amount_xaf − amount_rmb × XAF/CNY de la méthode à created_at`) | `lot7.sql:354-369` |
| **Bénéfice période** | `spread_chain + spread_client` | `lot7.sql:375` |
| **Taux de revient** XAF/CNY | taux d'achat moyen de la période (XAF/USDT) ÷ taux de vente moyen de la période (CNY/USDT). 0 s'il n'y a aucun achat, NULL s'il n'y a aucune vente. | `lot7.sql:315, 378` |
| **Taux client** | Σ amount_xaf / Σ amount_rmb des paiements completed (0 s'il n'y en a aucun) | `lot7.sql:355-365` |
| Marge par CNY (écran) | taux client − taux de revient | `TreasuryAnalysisView.tsx:224-225`, `MobileTreasuryDashboard.tsx:127-130` |
| **Capital immobilisé** | max(0, stock à `p_to`) × WAC à `p_to` + soldes CNY **actuels** × XAF/CNY à `p_to` | `lot7.sql:380-388` |
| Écart d'une contrepartie (tops) | (taux de la contrepartie − taux moyen de la période) / taux moyen × 100. Positif = mauvais pour un fournisseur, bon pour un acheteur. | `rpcs.sql:687-785` |

### 2.4 RPC

| RPC | Type | Garde serveur | Notes |
|---|---|---|---|
| `record_usdt_purchase` | écriture | `can_access_treasury` | Répartition `p_account_splits` ; USDT > 0, lignes > 0 sur des comptes XAF, fournisseur de type usdt_supplier. Renvoie `new_wac`. |
| `record_usdt_sale` | écriture | `can_access_treasury` | Montants > 0, acheteur cny_buyer, compte CNY optionnel. Stock négatif = simple `warning_negative_stock`. |
| `adjust_treasury_account` | écriture | `can_access_treasury` | Delta ≠ 0, motif ≥ 10 caractères, n'importe quel compte. |
| `record_inventory_snapshot` | écriture | `can_access_treasury` | Réel ≥ 0, motif ≥ 10 si écart. |
| `void_treasury_operation` | écriture | rôle `super_admin` en dur (`rpcs.sql:432-441`) | Motif ≥ 10, achat ou vente uniquement. |
| `create/update/delete_treasury_counterparty` | écriture | `can_access_treasury` | Nom ≥ 2 ; `update` : paramètre NULL = « ne rien changer » ; `delete` refusé si une opération (même annulée) existe. |
| `get_treasury_dashboard` | lecture | `can_access_treasury` | Version active : `lot7.sql:257-408`. |
| `get_top_counterparties` | lecture | `can_access_treasury` | Ne renvoie pas `short_id`. |
| `get_wac_usdt`, `get_usdt_stock`, `get_xaf_per_cny_at` | lecture | **aucune** (SECURITY DEFINER, EXECUTE pour `anon`) | — |
| `settle_payments_usdt`, `set_counterparty_settlement_rate`, `get_unsettled_payments`, `get_usdt_sales_monthly` | — | — | **En production seulement** (migration `partner_settlements`, version `20260830202749`), absentes de `supabase/migrations` sur `main` ; présentes sur la branche non fusionnée `origin/claude/usdt-cny-tracking-z7m9pc` (commit `d86f8120`). Aucun écran. |

Toutes les écritures passent par des RPC `SECURITY DEFINER` et écrivent dans `admin_audit_logs`. Aucune n'utilise `SELECT … FOR UPDATE`.

### 2.5 Permissions

- Serveur : `can_access_treasury(uid)` = `super_admin` ou `treasurer` non désactivé (`schema.sql:75-89`) — matrice parallèle à `admin_has_permission`.
- Front : `canViewTreasury` et `canManageTreasury` sont données **aux mêmes rôles** (`AdminAuthContext.tsx:69-70, 199-200`) et la matrice SQL fait pareil (`20260831160000:57-58`). Il n'existe donc pas de lecture seule.
- Annulation : `super_admin` uniquement côté serveur ; le desktop montre le bouton à `canManageTreasury`, le mobile au rôle `super_admin`.
- `is_treasurer()` (`20260515000003:27-41`) n'est appelé nulle part.

### 2.6 Hooks (`src/hooks/useTreasury.ts`, 764 lignes, tous sur `supabaseAdmin`)

| Hook | Source | Cache | Utilisé par |
|---|---|---|---|
| `useTreasuryAccounts(currency?)` | `treasury_accounts` actifs | 60 s | formulaires, filtres |
| `useTreasuryAccountBalances` | vue des soldes (inactifs compris) | 15 s | barre d'état, Comptes, accueil mobile, inventaire mobile |
| `useCounterparties(type, includeArchived)` | `treasury_counterparties` | 30 s | formulaires, annuaire |
| `useUsdtWac`, `useUsdtStock` | RPC à l'instant présent | 10 s | barre d'état, accueil, formulaires |
| `useTreasuryDashboard(from,to)` | `get_treasury_dashboard` (ne vérifie pas `success`) | 30 s | Analyse |
| `useTopCounterparties` | `get_top_counterparties` (ne vérifie pas `success`) | 30 s | Analyse |
| `useTreasuryOperations(from,to)` | achats + ventes fusionnés et triés côté client, **sans limite** | 15 s | listes, Opérations |
| `usePurchase`, `useSale`, `usePurchaseSplits` | détail + débits XAF d'un achat | — | détails |
| `useWacEvolution` | **tout l'historique** relu et WAC recalculé en JS (copie de l'algorithme SQL) | — | graphes WAC |
| `useUsdtFlowEvolution` | `implicit_rate` des opérations de la période | — | graphes de taux |
| `useInventorySnapshots` | 100 derniers comptages | — | Inventaires desktop |
| `useTreasuryLedger` | **200 dernières écritures**, `entry_kind` typé `string` | — | Grand livre desktop |
| Mutations | `useRecordUsdtPurchase`, `useRecordUsdtSale`, `useRecordInventorySnapshot`, `useAdjustAccount`, `useVoidTreasuryOperation` (invalident `['treasury']`) ; `useCreate/Update/DeleteCounterparty` (invalident seulement `['treasury','counterparties']`). Chacune affiche son propre toast. | | |

### 2.7 Mola (assistant)

- Outils dédiés dans `supabase/functions/admin-assistant/index.ts` : lecture (`get_treasury_summary`, `list_treasury_operations`, `treasury_report`, `treasury_top_counterparties`, `treasury_accounts_balances`, `treasury_usdt_position`, `treasury_ledger`, …) et écriture avec carte de confirmation (achat, vente, contreparties, ajustement, annulation, inventaire).
- Étiquettes `@mola` déclarées dans `20260603180000_mola_capability_tags_full.sql:34-41`, toutes en `"permission":"canViewTreasury"`, sans `"confirm"`. **Vérifié en production le 05/10** : aucune des RPC d'écriture de trésorerie ne porte de commentaire `@mola` ; seules les 4 RPC hors dépôt en ont un.
- Usage réel : exécutions trésorerie uniquement du 01 au 17/06/2026.

---

## 3. Navigation actuelle

### 3.1 Points d'entrée

| Surface | Entrée | Fichier |
|---|---|---|
| Desktop web | Barre latérale, groupe « Opérations » › « Trésorerie » (icône Landmark) | `desktopNav.ts:67` |
| Desktop web | « Tous les outils » › tuile Trésorerie (icône Coins) | `DesktopMoreScreen.tsx:93` |
| Mobile web | Onglet « Plus » › ligne « Trésorerie » (2 gestes, pas d'onglet dédié) | `MobileMoreScreen.tsx:147-154` |
| App BONZINI HQ | Onglet natif « Trésorerie » pour le rôle treasurer ; raccourci sur l'accueil natif sinon | `hq-app/src/tabs.ts:61-66`, `HomeScreen.tsx:31` |
| Après connexion | Le trésorier atterrit sur `/m` (dépôts/paiements), jamais sur la trésorerie | `src/lib/staffHome.ts:20` |
| Mola | `/m/assistant` — aucun lien vers les écrans, ni l'inverse | — |

### 3.2 Table des routes (`src/App.tsx`) — 17 routes

Sur desktop (≥ 1024 px), 16 routes montent **le même** `DesktopTreasuryScreen` (la vue est déduite de l'URL), 1 monte `DesktopBalanceDashboard`. Sur mobile, chaque route a son écran (13 écrans distincts).

| # | Route `/m/more/treasury…` | Ligne | Desktop | Mobile |
|---|---|---|---|---|
| 1 | *(racine)* | 381 | Coquille → vue Opérations | `MobileTreasuryHome` |
| 2 | `/operations/:kind/:operationId` | 384 | Opérations (**id ignoré**) | `MobileOperationsHistory` (**id ignoré**) |
| 3 | `/analysis` | 385 | Analyse | `MobileTreasuryDashboard` |
| 4 | `/ledger` | 386 | Grand livre | `MobileOperationsHistory` (**pas de grand livre mobile**) |
| 5 | `/dashboard` | 387 | Analyse | `MobileTreasuryDashboard` |
| 6 | `/purchase` | 392 | Fenêtre « Nouvel achat » sur la dernière vue | `MobileNewPurchase` (sans barre d'onglets) |
| 7 | `/sale` | 393 | Fenêtre « Nouvelle vente » | `MobileNewSale` (sans barre) |
| 8 | `/counterparties` | 394 | Contreparties | `MobileCounterpartiesScreen` |
| 9 | `/counterparties/:counterpartyId` | 395 | Contreparties (**id ignoré**) | `MobileCounterpartyEdit` (sans barre) |
| 10 | `/accounts` | 396 | Comptes | `MobileAccountsScreen` |
| 11 | `/inventory` | 397 | Inventaires | `MobileInventoryScreen` |
| 12 | `/operations` | 398 | Opérations | `MobileOperationsHistory` |
| 13 | `/purchases` | 399 | Opérations (**filtre Achats non appliqué**) | `MobilePurchasesList` |
| 14 | `/purchases/:operationId` | 400 | Opérations (**id ignoré**) | `MobilePurchaseDetail` (sans barre) |
| 15 | `/sales` | 401 | Opérations (**filtre Ventes non appliqué**) | `MobileSalesList` |
| 16 | `/balance-dashboard` | 402 | `DesktopBalanceDashboard` (**hors coquille**) | `MobileBalanceDashboard` |
| 17 | `/sales/:operationId` | 403 | Opérations (**id ignoré**) | `MobileSaleDetail` (sans barre) |

Routes visées par le code mais inexistantes : `/accounts/:id` et `/settle` (`treasuryNav.ts:95, 101`) → page introuvable.
Les gardes de permission sont dans chaque écran (`<Navigate to="/m">`), pas dans les routes.

### 3.3 Arbre desktop

```
Barre latérale « Opérations › Trésorerie »  |  « Tous les outils › Trésorerie »
└── /m/more/treasury ─ DesktopTreasuryScreen.tsx (une seule coquille, la vue vient de l'URL)
    ├── En-tête : h2 « Trésorerie » + phrase de la vue + [Achat] (contour) [Vente USDT] (plein)
    ├── TreasuryStatusBar.tsx : Stock USDT · WAC · total XAF · total CNY (+ bandeau si stock < 0)
    ├── 6 onglets à plat (MTabs, marketKit.tsx)
    │   ├── Opérations ··· /operations (défaut) ··· TreasuryOperationsWorkbench.tsx
    │   │   └── clic ligne → TreasuryOperationPanel.tsx (état local, pas d'URL)
    │   │       └── [Annuler] → MDialog « Annuler l'opération » (motif ≥ 10)
    │   ├── Analyse ······ /analysis = /dashboard ··· TreasuryAnalysisView.tsx + TreasuryRateChart.tsx
    │   ├── Comptes ······ /accounts ··· TreasuryAccountsView.tsx
    │   │   ├── icône portefeuille → MDialog « Ajuster — compte »
    │   │   ├── icône presse-papier (cash/alipay/wechat) → MDialog « Inventaire — compte »
    │   │   └── [Visuel des soldes (PNG / PDF)] → /balance-dashboard  ⟶ SORT de la coquille
    │   ├── Inventaires ·· /inventory ··· TreasuryInventoryView.tsx (lecture seule)
    │   ├── Contreparties  /counterparties ··· TreasuryCounterpartiesView.tsx
    │   │   ├── [Nouvelle] / crayon → MDialog Créer/Modifier
    │   │   ├── archiver/réactiver (immédiat)
    │   │   └── corbeille → MDialog Supprimer
    │   └── Grand livre ·· /ledger ··· TreasuryLedgerView.tsx
    └── Fenêtres de saisie au-dessus de la dernière vue (TreasuryEntryDialog.tsx)
        ├── /purchase → DesktopNewPurchase.tsx ─ MDialog « Nouveau fournisseur USDT »
        └── /sale ····→ DesktopNewSale.tsx ───── MDialog « Nouvel acheteur CNY »

/m/more/treasury/balance-dashboard ─ DesktopBalanceDashboard.tsx (sans onglets, sans barre d'état, sans retour)
```

Aides écrites mais branchées à rien : `operationFromPath`, `counterpartyFromPath`, `crumbsFor` (`treasuryNav.ts:169-208`), `MCrumbs`, `MDropdown` (`marketKit.tsx:590, 226`), `treasuryPaths.account/settle/counterparty/overview`.

### 3.4 Arbre mobile

```
Onglet « Plus » › Trésorerie   |   App HQ : onglet Trésorerie (treasurer) / raccourci accueil
└── /m/more/treasury ─ MobileTreasuryHome.tsx (lanceur à 10 tuiles ; retour → /m/more)
    ├── Cartes XAF / USDT / CNY + carte WAC (non cliquables)
    ├── Section « ANALYSE »
    │   ├── Analyse ·················· /dashboard ········ MobileTreasuryDashboard.tsx
    │   │                                                  └── raccourcis bas : Achat · Vente · Historique
    │   ├── Historique des opérations  /operations ······· MobileOperationsHistory.tsx
    │   │                                                  └── ligne → /purchases/:id | /sales/:id
    │   └── Visuel des soldes ········ /balance-dashboard  MobileBalanceDashboard.tsx
    └── Section « ACTIONS »
        ├── Nouvel achat USDT ······· /purchase ········· MobileNewPurchase.tsx (succès → accueil)
        ├── Mes achats USDT ········· /purchases ········ MobilePurchasesList.tsx
        │   ├── ligne → /purchases/:id ─ MobileOperationDetail.tsx (retour figé → /operations)
        │   └── corbeille (super admin) → VoidOperationDialog.tsx
        ├── Nouvelle vente USDT ····· /sale ············· MobileNewSale.tsx (succès → accueil)
        ├── Mes ventes USDT ········· /sales ············ MobileSalesList.tsx
        │   ├── ligne → /sales/:id ─ MobileOperationDetail.tsx (retour figé → /operations)
        │   └── corbeille (super admin) → VoidOperationDialog.tsx
        ├── Contreparties ··········· /counterparties ··· MobileCounterpartiesScreen.tsx
        │   └── carte → /counterparties/:id ─ MobileCounterpartyEdit.tsx
        ├── Comptes & soldes ········ /accounts ········· MobileAccountsScreen.tsx (tap = formulaire d'ajustement)
        └── Inventaire des comptes ·· /inventory ········ MobileInventoryScreen.tsx
```

Navigation en étoile : chaque écran revient à l'accueil, aucun lien transversal (opération → contrepartie, compte → mouvements, top → fournisseur…).

### 3.5 Couverture fonctionnelle comparée

| Fonction | Desktop | Mobile |
|---|---|---|
| Vue d'ensemble / lanceur | non (racine = Opérations) | oui (10 tuiles) |
| Liste unique des opérations + recherche | oui | non (3 listes, pas de recherche) |
| Listes Achats / Ventes séparées avec totaux | non | oui |
| Détail d'une opération | panneau latéral (sans URL) | page (`/purchases/:id`) |
| Grand livre | oui (cassé) | non |
| Historique des inventaires | oui (toujours vide) | non |
| Saisie d'un inventaire | dialogue dans Comptes | écran dédié |
| Barre d'état permanente | oui | non |
| Période partagée entre vues | oui (en mémoire) | non (chaque écran la sienne) |
| Annulation | panneau (bouton visible au trésorier) | liste + détail (super admin) |
| Règlement des paiements en USDT | non | non (branche non fusionnée) |

---

## 4. Fiches écrans

### 4.A Desktop

#### D1 — Coquille Trésorerie (`DesktopTreasuryScreen.tsx`)
- **But** : un seul écran pour tout le module, 6 onglets pilotés par l'URL, saisies en fenêtre.
- **Blocs** : topbar admin (h1 « Trésorerie ») ; en-tête de l'écran (h2 « Trésorerie » + phrase de la vue + boutons « Achat » / « Vente USDT » si `canManageTreasury`) ; barre d'état ; onglets ; vue courante dans un `DateRangeProvider` ; fenêtres `/purchase` et `/sale`.
- **Actions** : changer d'onglet (`navigate`, une entrée d'historique par clic et par flèche clavier) ; ouvrir une saisie ; fermer une saisie (`navigate` en push vers la vue).
- **Données** : `useTreasuryAccountBalances`, `useUsdtWac`, `useUsdtStock`, permissions.
- **Navigation** : entrée par la barre latérale ou « Tous les outils » ; seule sortie : `/balance-dashboard` depuis Comptes. Aucun fil d'Ariane.

#### D2 — Barre d'état (`TreasuryStatusBar.tsx`)
- **But** : les chiffres « à l'instant » toujours visibles.
- **Blocs** : grille de 4 colonnes — Stock USDT (`get_usdt_stock`), WAC (`get_wac_usdt`, 2 décimales), total XAF et total CNY (somme de la vue, inactifs compris) ; bandeau rouge si stock < 0.
- **Actions** : aucune (rien n'est cliquable).

#### D3 — Opérations (`TreasuryOperationsWorkbench.tsx`)
- **But** : liste unique des achats et ventes de la période.
- **Blocs** : carte « Opérations » (méta « N · tri date ↓ ») ; puces Tout / Achats / Ventes / Annulées avec compteurs ; recherche (nom, WeChat, téléphone, référence, notes) ; sélecteur de période ; tableau Date · Type · Contrepartie · USDT · Contre-valeur · Taux · Compte ; pagination par 25.
- **Actions** : filtrer, chercher, trier (date, USDT, taux), cliquer une ligne → panneau de détail.
- **Données** : `useTreasuryOperations(from,to)`, bornes de période en jours de Douala.
- **Navigation** : panneau sur place ; aucun lien vers contrepartie, compte, grand livre. État (filtre, recherche, tri, page, sélection) en `useState`, perdu au changement d'onglet.

#### D4 — Panneau de détail (`TreasuryOperationPanel.tsx`)
- **But** : détail d'un achat ou d'une vente et annulation.
- **Blocs** : en-tête (type coloré indigo/ambre, date, tag Annulée, bouton « Annuler », fermer) ; Payé/Reçu ou Reçu/Vendu + taux effectif ; « Comptes débités » (répartition) ; « Détail » (contrepartie, compte, WAC à la vente, WeChat, téléphone, référence, notes) ; bloc annulation (date, motif).
- **Actions** : « Annuler » → dialogue avec motif → `void_treasury_operation` ; Ctrl/⌘+Entrée.
- **Données** : la ligne sélectionnée + `usePurchaseSplits`.
- **Navigation** : aucune sortie. Ni auteur, ni date de saisie, ni marge de la vente.

#### D5 — Analyse (`TreasuryAnalysisView.tsx`, `TreasuryRateChart.tsx`)
- **But** : résultat de la période.
- **Blocs** : barre de période (défaut « Ce mois ») ; 4 chiffres clés (Bénéfice période, Marge par CNY livré, Taux de revient, Taux client — en XAF/CNY) ; cartes Achats USDT (volume, payé XAF, taux) et Ventes USDT (volume, reçu CNY, taux) ; graphique « Évolution des taux » (WAC / coût d'achat / prix de vente, une courbe à la fois) ; Top 5 fournisseurs et Top 5 acheteurs (volume, taux moyen, écart %) ; bandeau Capital immobilisé.
- **Actions** : changer de période, changer de courbe. Rien n'est cliquable.
- **Données** : `useTreasuryDashboard`, `useTopCounterparties` ×2, `useWacEvolution`, `useUsdtFlowEvolution`.

#### D6 — Comptes (`TreasuryAccountsView.tsx`)
- **But** : soldes par compte et corrections.
- **Blocs** : bouton « Visuel des soldes (PNG / PDF) » ; 3 cartes Comptes XAF (6) / Pool USDT (1) / Comptes CNY (3), total en méta grise ; tableau Nom + nature · Solde · icônes.
- **Actions** : « Ajuster » (icône portefeuille) → solde actuel, Approvisionner/Débiter, montant, solde après, motif ≥ 10 → `adjust_treasury_account` ; « Inventorier » (comptes cash/alipay/wechat seulement) → solde constaté, théorique/écart, motif si écart → `record_inventory_snapshot`.
- **Données** : `useTreasuryAccountBalances` (`last_entry_at` et `entry_count` non affichés).
- **Navigation** : aucune fiche compte ; sortie vers le Visuel des soldes.

#### D7 — Inventaires (`TreasuryInventoryView.tsx`)
- **But** : relire l'historique des comptages.
- **Blocs** : 3 cartes (Comptages, Sans écart, Écart cumulé toutes devises confondues) ; puces par compte actif ; tableau Date · Compte · Théorique · Réel · Écart · Motif (100 lignes max).
- **Actions** : filtrer par compte. Aucun bouton pour inventorier.
- **Données** : `useInventorySnapshots` — **0 ligne en production**.

#### D8 — Contreparties (`TreasuryCounterpartiesView.tsx`)
- **But** : annuaire fournisseurs USDT / acheteurs CNY.
- **Blocs** : puces Fournisseurs / Acheteurs / Avec archivées (même composant) ; recherche ; bouton « Nouvelle » ; tableau Nom (+ entreprise, badge) · Réf. · Téléphone/WeChat · Note · actions.
- **Actions** : créer, modifier, archiver/réactiver (immédiat), supprimer (refusé par le serveur si des opérations existent).
- **Données** : `useCounterparties` + 3 mutations. Aucune donnée d'activité (volume, dernière opération).

#### D9 — Grand livre (`TreasuryLedgerView.tsx`)
- **But** : la liste des écritures, source des soldes.
- **Blocs** : puces de devise (Toutes, XAF, USDT, CNY) puis une puce par compte actif ; bandeau Entrées / Sorties / Net ; tableau Date · Nature · Compte · Montant · Origine.
- **Actions** : filtrer ; lien « Voir l'opération » (jamais affiché, voir diagnostic).
- **Données** : `useTreasuryLedger` — 200 dernières écritures, sans période ni pagination.

#### D10 — Nouvel achat USDT (`DesktopNewPurchase.tsx` dans `TreasuryEntryDialog.tsx`)
- **But** : enregistrer un achat payé depuis un ou plusieurs comptes XAF.
- **Blocs** : (1) Fournisseur « F-001 · Nom » + « Nouveau fournisseur » ; (2) Compte XAF débité ou « Répartir sur plusieurs comptes » ; (3) Montant : modes XAF+USDT / XAF+taux / USDT+taux, valeur déduite ; (4) Date (antidatable) et référence, note ; pied : « WAC actuel → après », « Stock après », Annuler / Enregistrer l'achat.
- **Données** : contreparties, comptes XAF, WAC et stock **d'aujourd'hui**.
- **Contrôles** : montants > 0 seulement.

#### D11 — Nouvelle vente USDT (`DesktopNewSale.tsx`)
- **But** : enregistrer une vente d'USDT contre CNY.
- **Blocs** : (1) Acheteur « Nom · WeChat/tél » + « Nouvel acheteur » ; (2) Montant (USDT+CNY / USDT+taux / CNY+taux) ; (3) Compte CNY crédité, **« Aucun compte Bonzini concerné » par défaut** ; (4) Date et référence ; pied : coût de revient au WAC, stock actuel → après, alerte stock négatif.
- **Contrôles** : montants > 0 ; stock négatif permis.

#### D12 — Visuel des soldes (`DesktopBalanceDashboard.tsx`)
- **But** : produire une image PNG ou un PDF A4 des soldes à partager.
- **Blocs** : titre « Dashboard soldes » ; 6 cartes de comptes XAF **codés en dur** (`balance-dashboard/constants.ts`) avec un champ montant **saisi à la main** ; aperçu A4 sombre en anglais ; boutons PNG / PDF.
- **Données** : aucune lecture en base.
- **Navigation** : hors coquille, pas de retour.

### 4.B Mobile

#### M1 — Accueil (`MobileTreasuryHome.tsx`)
- **But** : lanceur du module.
- **Blocs** : 3 cartes XAF (violet) / USDT (ambre, solde du grand livre) / CNY (orange) ; bandeau « Stock USDT négatif » (basé sur `get_usdt_stock`) ; carte WAC (4 décimales) ; section ANALYSE (Analyse, Historique des opérations, Visuel des soldes) ; section ACTIONS (Nouvel achat, Mes achats, Nouvelle vente, Mes ventes, Contreparties, Comptes & soldes, Inventaire des comptes).
- **Actions** : 10 tuiles de navigation. Les cartes ne sont pas cliquables.

#### M2 — Analyse / « Dashboard trésorerie » (`MobileTreasuryDashboard.tsx`)
- **But** : tableau de bord de la période.
- **Blocs** (≈ 13 empilés) : puces de période (Jour, Semaine, Mois par défaut, Trimestre, Année, Tout, Custom) ; plage ; Bénéfice ; Volumes ; Taux moyens pondérés ; Taux XAF/CNY (revient, client, marge) ; Stock & capital ; graphe WAC ; coût d'achat (aire + histogramme) ; prix de vente (aire + histogramme) ; Top 5 fournisseurs ; Top 5 acheteurs ; raccourcis Achat / Vente / Historique.
- **Données** : mêmes hooks que le desktop. Fin de période figée au montage.

#### M3 — Nouvel achat (`MobileNewPurchase.tsx`)
- **Blocs** : Fournisseur « short_id · nom » + « + » (nom, téléphone +237) ; Compte XAF ou répartition ; Montant (XAF+USDT par défaut, autres modes derrière un lien) ; rappel du WAC ; « Détails » repliés (date, référence, notes) ; « Enregistrer l'achat ».
- **Après succès** : toast « Nouveau WAC » puis retour à l'accueil.

#### M4 — Nouvelle vente (`MobileNewSale.tsx`)
- **Blocs** : Acheteur + « + » (nom, entreprise, téléphone +86, WeChat) ; Compte CNY optionnel (« Aucun » par défaut, aide « Alipay/WeChat de papa ») ; Montant (3 modes toujours visibles) ; carte WAC / coût de sortie / stock après ; alerte stock négatif ; Détails repliés ; « Enregistrer la vente ».

#### M5 — Mes achats USDT (`MobilePurchasesList.tsx`) et M6 — Mes ventes USDT (`MobileSalesList.tsx`)
- **Blocs** : période 7 j / 30 j (défaut) / 90 j / Tout / Perso ; puces Filtres et « Supprimées » ; filtres (Fournisseur, Canal, Tri — ou Acheteur, Compte CNY, Tri) ; carte Total (nombre, USDT, XAF ou CNY) ; liste `OperationListItem` avec corbeille par ligne pour le super admin.
- **Actions** : ouvrir le détail, annuler via `VoidOperationDialog`, filtrer.
- Les deux fichiers sont des quasi-copies (220 / 215 lignes).

#### M7 — Historique des opérations (`MobileOperationsHistory.tsx`)
- **Blocs** : 7 / 30 / 90 jours ; puces Tout / Achats / Ventes / Annulées ; liste sans total, recherche ni tri.
- Sert aussi, à tort, pour `/ledger` et `/operations/:kind/:id`.

#### M8 — Détail d'une opération (`MobileOperationDetail.tsx`)
- **Blocs** : bandeau « Opération supprimée » si annulée ; carte titre (montants, taux) ; détails (date, contrepartie, comptes, WAC à la vente, coût de sortie, référence, notes) ; zone d'annulation en ligne (super admin).
- **Navigation** : retour **figé vers l'historique** (`:96`), quelle que soit l'origine.

#### M9 — Comptes & soldes (`MobileAccountsScreen.tsx`)
- **Blocs** : groupes XAF / Pool USDT / CNY avec total ; ligne par compte (libellé, type, dernière écriture, solde rouge si négatif).
- **Actions** : taper une ligne ouvre **directement** le formulaire d'ajustement (Approvisionner par défaut / Débiter, montant, motif). Pas de fiche compte.

#### M10 — Inventaire des comptes (`MobileInventoryScreen.tsx`)
- **Blocs** : une carte par compte cash/alipay/wechat (théorique arrondi à 2 décimales) ; carte dépliée : solde constaté, théorique/écart, motif si écart, Enregistrer. Pas d'historique, pas de date.

#### M11 — Contreparties (`MobileCounterpartiesScreen.tsx`) et M12 — Fiche contrepartie (`MobileCounterpartyEdit.tsx`)
- **Liste** : Segmented Fournisseurs USDT / Acheteurs CNY, pill « Archivées » (ajoute les archivées), bouton « Nouvelle contrepartie » (formulaire en ligne), cartes (short_id, nom, entreprise, téléphone, WeChat). Pas de recherche.
- **Fiche** : formulaire (nom, entreprise, téléphone, WeChat, notes), Enregistrer, Archiver/Réactiver, Supprimer définitivement (toujours proposé). Aucune opération listée.

#### M13 — Visuel des soldes (`balance-dashboard/MobileBalanceDashboard.tsx`)
- Identique au desktop D12 : 6 comptes en dur, saisie manuelle, aperçu A4 en anglais, PNG/PDF.

### 4.C Composants partagés

| Composant | Rôle | Utilisé par |
|---|---|---|
| `src/components/treasury/ui.tsx` | Primitives mobiles (SOFT_CARD rounded-3xl, INSET, tons violet/ambre/orange, IconChip, SectionTitle, ActionTile, Pill, PrimaryPill 52 px…) | 12 écrans mobiles + Visuel des soldes desktop |
| `OperationListItem.tsx` | Ligne d'opération (achat/vente/annulée) | 3 listes mobiles |
| `VoidOperationDialog.tsx` | Feuille d'annulation (motif ≥ 10) | listes Achats/Ventes |
| `MoneyField.tsx` / `TreasuryMoneyInput.tsx` | Champ montant mobile 54 px / desktop 32 px (copies) | formulaires |
| `SelectField.tsx` / `TreasurySelect.tsx` | Liste déroulante mobile / desktop (copies) | formulaires, filtres |
| `Segmented.tsx` | Sélecteur segmenté | périodes, modes de saisie |
| `marketKit.tsx` | Kit desktop du module (MCard, MTabs, MChip, MButton, MDialog, MTable, TONE, LABEL…) | toutes les vues desktop |
| `treasuryFormat.ts`, `treasuryPeriod.ts`, `treasuryPeriodScope.tsx` | Formats (XAF 0 déc., USDT/CNY 2), période par défaut « ce mois », bornes Douala | desktop |

### 4.D Écrans fantômes (branche non fusionnée `origin/claude/usdt-cny-tracking-z7m9pc`)

- **Règlements Chine** (`MobileSettlements.tsx`) : rattacher par lot les paiements clients exécutés à une vente USDT au partenaire (`settle_payments_usdt`, `get_unsettled_payments`, `set_counterparty_settlement_rate`).
- **Bilan mensuel USDT** (`MobileMonthlyReport.tsx`, `get_usdt_sales_monthly`).
- Les objets SQL sont **en production** ; les écrans n'existent pas sur `main`. Un plan d'automatisation (`docs/tresorerie/automatiser-suivi-usdt.md`) existe aussi sur la branche non fusionnée `claude/usdt-cameroon-china-automation-5kevnc`.

---

## 5. Usage réel en production (05/10/2026)

### 5.1 Volumes

| Objet | Total | Actifs | Annulés | Remarques |
|---|---|---|---|---|
| Achats USDT | 138 | 121 | 17 (12,3 %) | 1 687,9 M XAF pour 2 810 334 USDT, taux moyen 598,5 XAF/USDT (hors erreur) ; 34 répartis sur plusieurs comptes ; dernier saisi le **04/10/2026** |
| Ventes USDT | 94 | 87 | 7 | 1 750 369 USDT pour 11,82 M CNY (6,655 à 6,83 CNY/USDT) ; **dernière le 25/08/2026** ; **62 ventes actives sur 87 ont `wac_at_sale = 0`** |
| Écritures du grand livre | 464 | — | 46 contre-écritures | 0 orpheline, 0 double annulation, 0 écart de devise |
| Contreparties | 23 | 19 fournisseurs, 4 acheteurs | 0 archivée | aucune créée depuis le 23/06 |
| Inventaires | **0** | | | jamais utilisé |
| Ajustements manuels | 3 | | | tous le 16/05 (tentative de soldes d'ouverture) |
| Comptes | 10 | 10 actifs | | 3 comptes CNY : 0 écriture |
| Utilisateurs | 1 super_admin | | | 0 `treasurer` |

### 5.2 Activité par mois

| Mois | Achats actifs | Ventes | CNY vendus ÷ CNY payés aux clients |
|---|---|---|---|
| Mai | 26 | 34 | 99,4 % |
| Juin | 34 | 54 | 156 % |
| Juillet | 13 | 4 | 85,5 % |
| Août | 26 | 2 | 19,5 % |
| Septembre | 16 | **0** | **0 %** (5,26 M CNY payés aux clients) |
| Octobre (au 05) | 6 | **0** | **0 %** |

Les achats ne couvrent plus que 36 % (septembre) à 57 % (octobre) du volume XAF des paiements clients.

### 5.3 Ce que le module affiche aujourd'hui

| Indicateur affiché | Valeur | Réalité probable |
|---|---|---|
| Soldes XAF (6 comptes) | **−1 682 772 926 XAF** (MTN −826 M, Afriland −440 M, Orange −224 M, UBA −131 M, CCA −42 M, Ecobank −19 M) | les dépôts clients (1 391,7 M XAF depuis le 15/05) ne sont jamais reportés |
| Stock USDT | **1 059 965 USDT** | fictif : les ventes ne sont plus saisies depuis le 25/08 |
| WAC | **1 025,98 XAF/USDT** | ≈ 598,5 (taux d'achat réel) → +71 % |
| Capital immobilisé | **1 087 M XAF** | stock fictif × WAC gonflé |
| Bénéfice « Ce mois » (octobre) | **−261 295 XAF** en rouge | n'est que l'effet des variations de taux client dans la journée |
| Marge chaîne, tout l'historique | +450,5 M XAF | ≈ +3,3 M avec un WAC réaliste (×136) |
| Marge chaîne, 90 jours | −26,9 M XAF | ≈ +1,6 M (signe inversé) |
| Comptes CNY | 0 | 87 ventes sur 87 sans compte CNY |

### 5.4 Fonctions vivantes et mortes

- **Vivante** : saisie d'achat USDT (3 à 8 par semaine) et annulation, utilisée comme « modification » (14 achats sur 17 annulés moins d'une heure après leur saisie, puis ressaisis).
- **Abandonnées** : saisie de vente (25/08), création de contrepartie (23/06), modification de contrepartie (27/07), ajustement (16/05), outils trésorerie de Mola (17/06).
- **Jamais utilisées** : inventaire, suppression de contrepartie, comptes CNY, `usdt_sales.payment_id`, `settlement_rate`, les 4 RPC de règlement.
- **Champs jamais remplis** : `external_ref` (0/232), `notes` (1/232), `cny_account_id` (0/94), `channel` (NULL depuis le 25/05), WeChat des fournisseurs (0/19).
- **Erreurs de saisie** : 10 achats avec le taux tapé dans le champ USDT (676 à 116 667 XAF/USDT) ; 9 annulés, **1 toujours actif** (10/09/2026 : 6 251 519 XAF pour 603 USDT = 10 367 XAF/USDT).
- **Saisies rétroactives** : 18 ventes et 11 achats saisis plus d'un jour après la date de l'opération (jusqu'à 11 jours).
- **Contournement** : le « Visuel des soldes » sert à retaper à la main les vrais soldes, puisque ceux du module sont inutilisables.

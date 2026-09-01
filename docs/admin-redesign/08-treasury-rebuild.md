# Trésorerie — analyse avant reconstruction

> Inventaire fait depuis le CODE et depuis le SCHÉMA DE PRODUCTION
> (`fmhsohrgbznqmcvqktjw`), pas depuis la documentation. Chaque affirmation
> ci-dessous est vérifiable par la requête ou le fichier cité.

## 1. Ce que le module peut faire

### 1.1 Données — 7 tables

| Table | Rôle | Écran ? |
|---|---|---|
| `treasury_accounts` | les comptes (XAF, USDT, CNY) | ✅ Comptes |
| `treasury_account_balances` | soldes courants | ✅ Comptes |
| `treasury_counterparties` | fournisseurs USDT / acheteurs CNY | ✅ Contreparties |
| `usdt_purchases` | achats USDT | ✅ Opérations |
| `usdt_sales` | ventes USDT | ✅ Opérations |
| `treasury_ledger_entries` | **le grand livre** | ❌ lu par un hook, aucun écran |
| `treasury_inventory_snapshots` | historique des inventaires | ❌ **aucun écran** |

### 1.2 Actions — 16 RPC

**Exposées par l'interface (12)** : `record_usdt_purchase`, `record_usdt_sale`,
`adjust_treasury_account`, `record_inventory_snapshot`,
`void_treasury_operation`, `create/update/delete_treasury_counterparty`,
`get_treasury_dashboard`, `get_top_counterparties`, `get_usdt_stock`,
`get_wac_usdt`.

**Existantes en base mais ATTEINTES PAR AUCUN ÉCRAN (4)** :

| RPC | Ce qu'elle fait | Conséquence |
|---|---|---|
| `settle_payments_usdt(p_payment_ids[], p_buyer_id, p_rate, p_occurred_at)` | solde un lot de paiements clients contre des USDT | **le pont Paiements ↔ Trésorerie n'existe pas dans l'UI** ; elle est `@mola`-taguée, donc l'assistant sait faire ce que l'opérateur ne peut pas faire à la main |
| `set_counterparty_settlement_rate(p_counterparty_id, p_rate)` | taux de règlement par contrepartie | aucune fiche contrepartie pour le poser |
| `get_usdt_sales_monthly(p_months)` | série mensuelle des ventes | l'Analyse ne l'affiche pas |
| `can_access_treasury(_user_id)` | droit d'accès au module | jamais appelée côté client |

Vérification : `grep -rl "<nom>" src/ | grep -v types.ts` → 0 fichier pour les
quatre.

## 2. La navigation — le vrai défaut

**14 routes déclarées, 11 rendent le MÊME composant** avec un `initialView`
différent (`src/App.tsx` 244-256) :

```
/treasury                      → DesktopTreasuryScreen
/treasury/dashboard            → DesktopTreasuryScreen initialView="analysis"
/treasury/accounts             → DesktopTreasuryScreen initialView="accounts"
/treasury/inventory            → DesktopTreasuryScreen initialView="accounts"   ⟵ même vue
/treasury/operations           → DesktopTreasuryScreen initialView="operations"
/treasury/purchases            → DesktopTreasuryScreen initialView="operations" ⟵ même vue
/treasury/purchases/:id        → DesktopTreasuryScreen initialView="operations" ⟵ l'ID EST IGNORÉ
/treasury/sales                → DesktopTreasuryScreen initialView="operations" ⟵ même vue
/treasury/sales/:id            → DesktopTreasuryScreen initialView="operations" ⟵ l'ID EST IGNORÉ
/treasury/counterparties       → DesktopTreasuryScreen initialView="counterparties"
/treasury/counterparties/:id   → DesktopTreasuryScreen initialView="counterparties" ⟵ l'ID EST IGNORÉ
```

Conséquences, toutes constatables :

1. **L'URL ne suit pas la vue.** Changer d'onglet écrit un `useState`, pas la
   route. Donc : le bouton Retour du navigateur sort du module au lieu de
   revenir à l'onglet précédent ; on ne peut ni marquer-page ni partager une
   vue ; un rafraîchissement ramène toujours sur Opérations.
2. **Les liens profonds sont morts.** `/purchases/:operationId` affiche la
   liste, pas l'opération. Idem `/sales/:id` et `/counterparties/:id`.
3. **L'inventaire n'existe pas sur desktop** : sa route retombe sur Comptes.
4. **Aucun fil d'Ariane.** Les deux saisies sont des pages pleines avec une
   flèche retour ; rien ne dit où l'on est ni d'où l'on vient.
5. **Aucun moyen d'aller d'une opération à sa contrepartie**, ni d'une
   contrepartie à ses opérations. Les objets du module ne sont pas liés.

## 3. Le « visuel des soldes » — déconnecté des données

`src/mobile/screens/treasury/balance-dashboard/constants.ts` :

- `DASHBOARD_ACCOUNTS` est une liste **écrite en dur de 6 comptes** (MTN,
  Orange, UBA, Afriland, Ecobank, CCA) avec leurs logos, « extraite verbatim »
  d'un prototype PDF externe.
- Les soldes sont **saisis à la main** (`onValueChange={(v) => setBalance(...)}`,
  `DesktopBalanceDashboard.tsx:84`). L'écran **ne lit jamais**
  `treasury_account_balances`.
- Le rendu est une page **A4 (595×842 pt)** affichée à l'écran : d'où la
  taille.
- Il porte sa propre palette (`#0F1117`, dégradé violet→bleu) sans rapport
  avec le design system.

Donc : un compte réel absent de la liste est invisible ; un compte de la liste
qui n'existe pas s'affiche à zéro ; et le chiffre montré n'est pas celui du
grand livre mais celui que l'opérateur a retapé. Ce n'est pas un défaut de
style, c'est une fonctionnalité qui ne parle pas à la base.

## 4. Ce qui manque, par ordre d'importance métier

1. **Règlement des paiements en USDT** — la RPC existe, l'écran non. C'est
   l'opération qui relie l'argent des clients au stock USDT.
2. **Grand livre** — `treasury_ledger_entries` est la source de vérité des
   mouvements ; aucun écran ne la montre.
3. **Fiche contrepartie** — ses opérations, son volume, son taux moyen, son
   taux de règlement.
4. **Historique des inventaires** — on enregistre des comptages, on ne peut
   jamais les relire.
5. **Fiche compte** — l'historique d'un compte, ses ajustements, ses écarts.

## 5. Architecture retenue pour la reconstruction

### 5.1 Navigation pilotée par l'URL

Une seule règle : **l'URL est l'état**. Plus de `useState` pour la vue.

```
/m/more/treasury                        Vue d'ensemble
/m/more/treasury/operations             Opérations (liste + détail latéral)
/m/more/treasury/operations/:kind/:id   une opération, liable et rafraîchissable
/m/more/treasury/accounts               Comptes
/m/more/treasury/accounts/:id           fiche compte + historique
/m/more/treasury/inventory              Inventaires (comptage + historique)
/m/more/treasury/counterparties         Contreparties
/m/more/treasury/counterparties/:id     fiche contrepartie + ses opérations
/m/more/treasury/analysis               Analyse
/m/more/treasury/ledger                 Grand livre
/m/more/treasury/settle                 Règlement de paiements en USDT
/m/more/treasury/purchase               Nouvel achat
/m/more/treasury/sale                   Nouvelle vente
```

### 5.2 Trois niveaux de navigation

1. **Barre d'état** (stock, WAC, soldes) — permanente, c'est le contexte.
2. **Onglets** — changent la route, pas un état local.
3. **Fil d'Ariane** — sur toute vue de détail, avec le retour vers son parent.

### 5.3 Liaison des objets

Chaque référence est un lien : une opération pointe vers sa contrepartie et
vers son compte ; une contrepartie liste ses opérations ; un compte liste ses
mouvements. C'est ce qui manque le plus aujourd'hui.

# Design — Module traçabilité chaîne de valeur (Tier 2)

> **Statut** : Phase 3 — design détaillé, en attente de validation utilisateur.
> **Précision** : `NUMERIC(20,8)` partout sur les nouveaux montants/taux. Append-only stricte. Voiding par contre-écriture (cohérent avec convention `cancel_*` du projet).
> **Lecture seule sur la codebase tant que cette phase n'est pas validée — aucun code modifié.**

---

## A. Modèle de données

### A.1 Vue d'ensemble

```
                 ┌────────────────────────┐
                 │ treasury_counterparties │  (fournisseurs USDT + acheteurs CNY)
                 └────────────────────────┘
                       ▲              ▲
                       │ supplier_id  │ buyer_id
                       │              │
┌──────────────────┐ ┌─┴───────────┐ ┌┴──────────────┐
│ treasury_accounts│ │usdt_purchases│ │  usdt_sales  │
│ (multi-devise)   │ └─────┬───────┘ └──────┬───────┘
└────────┬─────────┘       │                │
         │                 ▼                ▼
         │         ┌──────────────────────────┐
         └────────►│ treasury_ledger_entries  │ (ledger interne multi-devise, append-only)
                   └──────────────────────────┘
                              ▲
                              │
                   ┌──────────┴────────────────┐
                   │ treasury_inventory_snapshots │ (réconciliation hebdo)
                   └──────────────────────────────┘
```

Le **ledger interne** est la **source de vérité** des soldes par compte et par devise. Toute opération métier (achat USDT, vente USDT, inventaire, voiding) **n'écrit jamais directement** dans les comptes ; elle insère 2 lignes ou plus dans `treasury_ledger_entries` (double-entrée light). Les soldes sont **calculés** (vue agrégée ou function `get_account_balance`).

---

### A.2 Table `treasury_counterparties`

Annuaire unifié fournisseurs USDT + acheteurs CNY.

| Colonne | Type | Contraintes / Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `type` | enum (`usdt_supplier`, `cny_buyer`) | NOT NULL |
| `display_name` | `text` | NOT NULL, requis |
| `legal_name` | `text` | nullable (nom entreprise pour acheteurs Chine) |
| `phone` | `text` | nullable (numéro principal — souvent WhatsApp) |
| `wechat_id` | `text` | nullable (acheteurs Chine surtout) |
| `notes` | `text` | nullable (commentaires libres) |
| `is_active` | `boolean` | DEFAULT true |
| `created_at` | `timestamptz` | DEFAULT now() |
| `created_by` | `uuid` FK `auth.users` | NOT NULL |
| `updated_at` | `timestamptz` | DEFAULT now() |
| `archived_at` | `timestamptz` | nullable (soft archive — pas de hard delete) |

**Index** : `(type, is_active)`, `display_name` (recherche).
**RLS** : SELECT pour `canViewTreasury`, INSERT/UPDATE pour `canManageTreasury`. Pas de DELETE.

---

### A.3 Table `treasury_accounts`

Comptes Bonzini multi-devises. Chaque compte = une "poche" identifiée.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` UNIQUE | clé technique (ex: `xaf_uba_cam`, `usdt_pool`, `cny_cash_guangzhou`, `cny_alipay_papa`, `cny_wechat_papa`) |
| `label` | `text` | libellé affiché |
| `currency` | enum (`XAF`, `USDT`, `CNY`) | NOT NULL |
| `kind` | enum (`bank`, `mobile_money`, `crypto_pool`, `cash`, `alipay`, `wechat`, `other`) | NOT NULL |
| `is_active` | `boolean` | DEFAULT true |
| `created_at`, `created_by` | | |

**Seed initial** (proposé, à confirmer en Phase 4) :
- XAF : `xaf_bank_main`, `xaf_mobile_money_main` (à compléter selon comptes réels).
- USDT : `usdt_pool` (un seul pool fongible).
- CNY : `cny_cash_guangzhou`, `cny_alipay_papa`, `cny_wechat_papa`.

**RLS** : SELECT pour `canViewTreasury`, INSERT/UPDATE pour `canManageTreasury`. Pas de DELETE.

---

### A.4 Table `usdt_purchases`

**Append-only**. Chaque ligne = un achat USDT auprès d'un fournisseur local.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `occurred_at` | `timestamptz` | NOT NULL — date/heure de l'opération |
| `supplier_id` | `uuid` FK `treasury_counterparties` | type doit être `usdt_supplier` (check côté RPC) |
| `xaf_account_id` | `uuid` FK `treasury_accounts` | compte XAF débité, currency=XAF |
| `xaf_amount` | `numeric(20, 8)` | NOT NULL, > 0 — XAF payé |
| `usdt_amount` | `numeric(20, 8)` | NOT NULL, > 0 — USDT reçu |
| `implicit_rate` | `numeric(20, 8)` GENERATED ALWAYS AS (`xaf_amount / usdt_amount`) STORED | taux implicite XAF/USDT |
| `channel` | enum (`bank_transfer`, `mobile_money`, `cash`, `other`) | NOT NULL — canal de paiement XAF |
| `external_ref` | `text` | nullable — référence Binance / hash blockchain / etc. |
| `notes` | `text` | nullable |
| `created_at`, `created_by` | | |
| `voided_at` | `timestamptz` | nullable — flag d'annulation |
| `voided_by` | `uuid` | |
| `void_reason` | `text` | obligatoire si voided |
| `void_contra_entry_id` | `uuid` | référence à la contre-écriture dans `treasury_ledger_entries` |

**Index** : `(occurred_at)`, `(supplier_id, occurred_at)`, `(voided_at)`.
**Contraintes** : `xaf_amount > 0`, `usdt_amount > 0`.

---

### A.5 Table `usdt_sales`

**Append-only**. Chaque ligne = une vente USDT contre CNY.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `occurred_at` | `timestamptz` | NOT NULL |
| `buyer_id` | `uuid` FK `treasury_counterparties` | type doit être `cny_buyer` |
| `cny_account_id` | `uuid` FK `treasury_accounts` | compte CNY crédité (cash GZ / alipay / wechat / …) |
| `usdt_amount` | `numeric(20, 8)` | NOT NULL, > 0 — USDT vendu |
| `cny_amount` | `numeric(20, 8)` | NOT NULL, > 0 — CNY reçu |
| `implicit_rate` | `numeric(20, 8)` GENERATED ALWAYS AS (`cny_amount / usdt_amount`) STORED | taux implicite CNY/USDT |
| `wac_at_sale` | `numeric(20, 8)` | **figé à l'instant** — WAC USDT au moment exact de la vente (snapshot pour traçabilité historique) |
| `external_ref` | `text` | nullable |
| `notes` | `text` | nullable |
| `created_at`, `created_by` | | |
| `voided_at`, `voided_by`, `void_reason`, `void_contra_entry_id` | | |

**Index** : `(occurred_at)`, `(buyer_id, occurred_at)`, `(cny_account_id, occurred_at)`.
**Contraintes** : `usdt_amount > 0`, `cny_amount > 0`.

**Pourquoi `wac_at_sale` stocké** : indispensable pour reconstituer le bénéfice historique même si le WAC évolue après. Sinon, un audit a posteriori est impossible.

---

### A.6 Table `treasury_inventory_snapshots`

Réconciliation hebdo cash/alipay/wechat.

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK `treasury_accounts` | un snapshot par compte |
| `snapshot_at` | `timestamptz` | NOT NULL |
| `theoretical_balance` | `numeric(20, 8)` | calculé depuis ledger (snapshot) |
| `actual_balance` | `numeric(20, 8)` | saisi par l'opérateur |
| `variance` | `numeric(20, 8)` GENERATED (`actual_balance - theoretical_balance`) STORED | |
| `variance_reason` | `text` | obligatoire si `variance != 0` |
| `adjustment_entry_id` | `uuid` FK `treasury_ledger_entries` | écriture d'ajustement (si variance) |
| `created_at`, `created_by` | | |

**Index** : `(account_id, snapshot_at DESC)`.

---

### A.7 Table `treasury_ledger_entries` — **cœur du module**

Source de vérité multi-devise. Append-only stricte (RLS INSERT-only, jamais UPDATE ni DELETE — même par `super_admin`).

| Colonne | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` FK `treasury_accounts` | NOT NULL |
| `currency` | enum (`XAF`, `USDT`, `CNY`) | NOT NULL — redondant mais permet check cohérence avec `account.currency` |
| `amount` | `numeric(20, 8)` | NOT NULL — **signé** : positif = crédit, négatif = débit |
| `occurred_at` | `timestamptz` | NOT NULL — instant économique |
| `entry_kind` | enum (voir ci-dessous) | NOT NULL |
| `source_table` | enum (`usdt_purchase`, `usdt_sale`, `inventory_snapshot`, `manual_adjustment`, `void`) | NOT NULL |
| `source_id` | `uuid` | NOT NULL — id dans la table source |
| `contra_entry_id` | `uuid` FK self | nullable — si cette ligne annule une autre |
| `metadata` | `jsonb` | détails contextuels (taux, contrepartie, etc.) |
| `created_at` | `timestamptz` | DEFAULT now() |
| `created_by` | `uuid` | NOT NULL |

**`entry_kind` enum** :
- `usdt_purchase_debit_xaf` — débit du compte XAF source de l'achat
- `usdt_purchase_credit_usdt` — crédit du pool USDT
- `usdt_sale_debit_usdt` — débit du pool USDT (à `wac_at_sale`)
- `usdt_sale_credit_cny` — crédit du compte CNY cible
- `inventory_adjustment` — écart constaté lors d'un snapshot
- `void` — contre-écriture d'annulation

**Index** : `(account_id, occurred_at)`, `(source_table, source_id)`, `(entry_kind)`.

**RLS** :
- SELECT pour `canViewTreasury`.
- INSERT **uniquement via RPC `SECURITY DEFINER`** (jamais direct).
- UPDATE/DELETE : **bloqué pour tous les rôles** (append-only strict).

---

### A.8 Vue dérivée — soldes par compte

```sql
CREATE VIEW treasury_account_balances AS
SELECT
  a.id, a.code, a.label, a.currency, a.kind, a.is_active,
  COALESCE(SUM(l.amount), 0) AS balance,
  MAX(l.occurred_at) AS last_entry_at
FROM treasury_accounts a
LEFT JOIN treasury_ledger_entries l ON l.account_id = a.id
GROUP BY a.id;
```

Pour éviter le scan complet à chaque requête dashboard (à confirmer en Phase 4 selon volumétrie) : matérialiser en table snapshot rafraîchie via trigger, ou maintenir un cache applicatif.

---

## B. Migrations

### B.1 Ordre proposé (4 migrations)

1. **`treasury_fix_daily_rates_precision.sql`** (Lot 0 — dette)
   - `ALTER TABLE daily_rates ALTER COLUMN rate_cash TYPE numeric(10,4) USING rate_cash::numeric;`
   - Idem pour `rate_alipay`, `rate_wechat`, `rate_virement`.
   - Adapter le RPC `create_daily_rates(...)` pour accepter `numeric`.
   - Vérifier l'UI `MobileRatesScreen.tsx` (saisie en décimal).

2. **`treasury_schema.sql`**
   - Création des 6 tables ci-dessus + enums + indexes + RLS policies + vue.
   - Seed des comptes initiaux (XAF / USDT pool / CNY × 3).

3. **`treasury_role_treasurer.sql`**
   - Ajout valeur `'treasurer'` à l'enum `user_role`.
   - RPC helper `is_treasurer(uuid)`.
   - Mise à jour `is_admin(uuid)` si nécessaire pour inclure `treasurer` (à confirmer).

4. **`treasury_rpcs.sql`**
   - `record_usdt_purchase(...)`, `record_usdt_sale(...)`, `record_inventory_snapshot(...)`, `void_treasury_operation(...)`, `get_wac_usdt(at_time timestamptz default now())`, `get_treasury_dashboard(from, to)`, `get_top_counterparties(type, from, to, limit)`.

### B.2 Compatibilité

- **Aucun ALTER** sur tables existantes critiques (`wallets`, `ledger_entries`, `payments`, `deposits`, `clients`, `user_roles`).
- L'enum `user_role` est étendu : opération non destructive en Postgres (`ALTER TYPE ... ADD VALUE`).
- `daily_rates` est étendu en précision : ALTER non destructif (les INTEGER deviennent NUMERIC sans perte). RPC + UI à adapter dans le même lot.

---

## C. Logique métier — formules et exemples chiffrés

### C.1 WAC USDT (Weighted Average Cost)

**Formule** : à chaque achat, le WAC du pool USDT est recalculé.
```
WAC_nouveau = (Stock_USDT_avant × WAC_avant + USDT_acheté × prix_achat_XAF/USDT)
              / (Stock_USDT_avant + USDT_acheté)
```
Les ventes sortent **au WAC courant** (ne modifient pas le WAC).

**Exemple chiffré vérifiable** :

| Op | Type | Stock avant | WAC avant | Mouvement | Stock après | WAC après |
|---|---|---|---|---|---|---|
| 1 | Achat 1 000 USDT pour 625 000 XAF | 0 | — | +1 000 USDT @ 625 | 1 000 | **625,00** |
| 2 | Achat 500 USDT pour 320 000 XAF | 1 000 | 625 | +500 USDT @ 640 | 1 500 | **(1000×625 + 500×640)/1500 = 945000/1500 = 630,00** |
| 3 | Vente 800 USDT contre 5 600 CNY | 1 500 | 630 | −800 USDT (coût sortie = 800×630 = 504 000 XAF) | 700 | **630,00** (inchangé) |
| 4 | Achat 300 USDT pour 198 000 XAF | 700 | 630 | +300 USDT @ 660 | 1 000 | **(700×630 + 300×660)/1000 = 441000+198000)/1000 = 639,00** |

✓ Vérifiable à la calculette.

### C.2 Spread réalisé par opération (vente)

À chaque vente USDT, on peut calculer un **spread analytique** comparant le taux de vente à un taux de référence externe.

**Variables** :
- `WAC` = coût XAF/USDT du stock au moment de la vente.
- `t_vente` = taux CNY/USDT de cette vente (= `cny_amount / usdt_amount`).
- `t_ref_CNY_XAF` = taux de référence CNY/XAF du jour (saisi quotidiennement, idéalement basé sur marché Binance externe).
- `t_client_moyen` = taux XAF/CNY moyen pondéré pratiqué aux clients sur la période.

**Formule spread "chaîne" (par vente)** :
```
spread_chaîne_XAF = cny_amount × t_ref_CNY_XAF - usdt_amount × WAC
```
Positif = la chaîne USDT a généré un gain par rapport au marché. Négatif = la chaîne a coûté plus que le marché paye en CNY (signal d'alerte).

**Formule spread "client" (sur transaction client)** :
```
spread_client_XAF = (XAF_payé_par_client) - (CNY_livré × t_ref_CNY_XAF)
```
Positif = bon pricing client.

**Bénéfice total = spread_chaîne + spread_client** (le `t_ref` s'annule dans la somme).

### C.3 Bénéfice agrégé sur période — exemple

**Hypothèses période 1 semaine** :
- `t_ref_CNY_XAF` moyen période = 88 XAF/CNY
- WAC moyen période = 630 XAF/USDT
- Achats USDT : 1 500 USDT pour 945 000 XAF (WAC fin = 630)
- Ventes USDT : 1 200 USDT contre 8 480 CNY (taux moyen vente = 7,067 CNY/USDT)
- Clients : ont payé 800 000 XAF pour 8 480 CNY livrés (taux client moyen = 94,34 XAF/CNY)

**Calcul** :
- `spread_chaîne` = 8 480 × 88 − 1 200 × 630 = 746 240 − 756 000 = **−9 760 XAF** (la chaîne coûte plus que le marché ; le fournisseur USDT vend cher)
- `spread_client` = 800 000 − 8 480 × 88 = 800 000 − 746 240 = **+53 760 XAF**
- **Bénéfice total** = −9 760 + 53 760 = **+44 000 XAF**

**Vérification cross-check** (formule directe sans taux ref) :
- Bénéfice = XAF_clients − USDT_vendu × WAC = 800 000 − 1 200 × 630 = 800 000 − 756 000 = **+44 000 XAF** ✓

Les deux méthodes convergent. La décomposition analytique permet de voir **où** la marge se fait/se perd.

### C.4 Capital immobilisé moyen

À tout instant `t` : `capital_immobilisé(t) = Stock_USDT(t) × WAC(t) + Stock_CNY(t) × t_ref(t)`

Moyenne sur la période = intégration discrète (un point par jour) de la fonction ci-dessus.

**Exemple** :
- J1 : stock 700 USDT × WAC 630 + stock CNY 2 000 × 88 = 441 000 + 176 000 = 617 000 XAF
- J2 : stock 800 USDT × 632 + stock CNY 3 500 × 88 = 505 600 + 308 000 = 813 600 XAF
- …
- Moyenne période = somme / N jours.

### C.5 Réconciliation hebdo — formule d'écart

Pour chaque compte CNY (cash, alipay, wechat) :
```
variance = actual_balance_saisi - theoretical_balance_calculé_depuis_ledger
```
- Si `|variance| < seuil` (ex : 50 CNY) → ajustement automatique avec entry `inventory_adjustment` documentée.
- Sinon → blocage UI, demande de justification écrite obligatoire avant validation.

**Le snapshot insère 1 ligne ledger** (`entry_kind = inventory_adjustment`, `amount = variance`) pour aligner théorique et constaté.

---

## D. RPCs (SECURITY DEFINER)

### D.1 `record_usdt_purchase(...)`
**Inputs** : `supplier_id`, `xaf_account_id`, `xaf_amount`, `usdt_amount`, `occurred_at`, `channel`, `external_ref`, `notes`.
**Garde** : `is_treasurer(auth.uid()) OR is_super_admin(auth.uid())`.
**Validations** :
- Counterparty existe et `type = 'usdt_supplier'`.
- Compte XAF existe et `currency = 'XAF'`.
- Montants > 0.
- `xaf_amount ≤ 100 000 000` (cap sécurité, à confirmer).
**Effets** :
1. Insère `usdt_purchases`.
2. Insère 2 lignes `treasury_ledger_entries` :
   - `(xaf_account, -xaf_amount, usdt_purchase_debit_xaf)`
   - `(usdt_pool, +usdt_amount, usdt_purchase_credit_usdt)`
3. Insère 1 ligne `admin_audit_logs`.
**Retour** : `purchase_id`, `new_wac`.

### D.2 `record_usdt_sale(...)`
**Inputs** : `buyer_id`, `cny_account_id`, `usdt_amount`, `cny_amount`, `occurred_at`, `external_ref`, `notes`.
**Garde** : idem.
**Validations** : counterparty `type = 'cny_buyer'`, compte CNY currency=CNY, stock USDT suffisant (à confirmer : on bloque la vente si solde insuffisant ou on autorise un solde négatif transitoire ?).
**Effets** :
1. Snapshot `wac_at_sale = get_wac_usdt(occurred_at)`.
2. Insère `usdt_sales` avec `wac_at_sale`.
3. Insère 2 lignes ledger :
   - `(usdt_pool, -usdt_amount, usdt_sale_debit_usdt)` avec `metadata.wac = wac_at_sale`
   - `(cny_account, +cny_amount, usdt_sale_credit_cny)`
4. Insère `admin_audit_logs`.

### D.3 `record_inventory_snapshot(account_id, actual_balance, variance_reason)`
**Effets** :
1. Calcule `theoretical = balance courant`.
2. `variance = actual - theoretical`.
3. Insère `treasury_inventory_snapshots`.
4. Si `variance != 0` : insère 1 ligne `treasury_ledger_entries` (`inventory_adjustment`).

### D.4 `void_treasury_operation(source_table, source_id, reason)`
**Garde** : `is_super_admin(auth.uid())` uniquement (le `treasurer` ne peut pas annuler).
**Effets** :
1. Vérifie que l'opération existe et n'est pas déjà voided.
2. Insère N lignes ledger de **contre-écriture** (montants inversés, `entry_kind = void`, `contra_entry_id` pointant les originales).
3. Met à jour la table source : `voided_at`, `voided_by`, `void_reason`, `void_contra_entry_id`.
4. Insère `admin_audit_logs`.

**Note** : un void crée des écritures, ne supprime jamais. Le ledger reflète l'historique complet.

### D.5 `get_wac_usdt(at_time timestamptz default now())`
Recalcule le WAC à un instant donné en rejouant le ledger USDT depuis le début jusqu'à `at_time`. Pour Tier 2, OK en mode "scan" si volumétrie < ~10k opérations. Cache applicatif si besoin.

### D.6 `get_treasury_dashboard(from_date, to_date)`
Retourne JSONB avec les 13 indicateurs validés. Calculs côté SQL pour cohérence.

### D.7 `get_top_counterparties(type, from_date, to_date, limit)`
Top N par volume + taux moyen pondéré + dérive (écart vs moyenne globale).

---

## E. UI — wireframes textuels

### E.1 Entrée tab bar
Ajout d'une icône **"Trésorerie"** dans `MobileRouteWrapper` (entre "Paiements" et "Plus", visible uniquement si `canViewTreasury`). Route `/m/treasury`.

### E.2 Dashboard `/m/treasury`
```
┌──────────────────────────────────────┐
│ Trésorerie         [Période ▼: 7j]   │
├──────────────────────────────────────┤
│ ━━ SOLDES ━━                          │
│ ┌────────┐ ┌────────┐ ┌────────────┐ │
│ │ XAF    │ │ USDT   │ │ CNY total  │ │
│ │ 1.2M   │ │ 1500   │ │ 84 200     │ │
│ │ 2 cpt  │ │ pool   │ │ 3 cpt      │ │
│ └────────┘ └────────┘ └────────────┘ │
│                                      │
│ ━━ ACTIVITÉ PÉRIODE ━━                │
│ Volume achat USDT : 1 500 (945k XAF) │
│   Taux moy. pondéré : 630,00 XAF/USDT │
│ Volume vente USDT : 1 200 (8 480 CNY)│
│   Taux moy. pondéré : 7,067 CNY/USDT  │
│ Taux client moyen : 94,34 XAF/CNY     │
│                                      │
│ ━━ MARGE ━━                           │
│ Bénéfice période : +44 000 XAF        │
│  ├─ Spread chaîne : -9 760            │
│  └─ Spread client : +53 760           │
│ Capital immobilisé moyen : 715k XAF   │
│                                      │
│ [📈 Évolution WAC]  [🏆 Top contrep.] │
│ [📋 Réconciliation hebdo] [📜 Histor.]│
│                                      │
│ ━━ ACTIONS RAPIDES ━━                 │
│ [+ Achat USDT]  [+ Vente USDT]        │
└──────────────────────────────────────┘
```

### E.3 Nouvel achat USDT `/m/treasury/purchases/new`
```
┌──────────────────────────────────────┐
│ ← Nouvel achat USDT                   │
├──────────────────────────────────────┤
│ Fournisseur USDT *                    │
│ [🔍 Rechercher ou +nouveau]           │
│                                      │
│ Date / heure *                        │
│ [📅 14/05/2026 16:30]                 │
│                                      │
│ Canal XAF *                           │
│ ○ Virement  ○ Mobile Money  ○ Cash    │
│                                      │
│ Compte XAF débité *                   │
│ [Sélectionner ▼]                      │
│                                      │
│ Montant XAF payé *                    │
│ [625 000]                             │
│                                      │
│ USDT reçu *                           │
│ [1 000.00000000]                      │
│                                      │
│ ────────────────────────              │
│ Taux implicite : 625,00 XAF/USDT      │
│ WAC courant : 625,00 → 625,00 (Δ 0)   │
│ ────────────────────────              │
│                                      │
│ Réf. externe (Binance, hash…)         │
│ [_____________________]               │
│                                      │
│ Notes                                 │
│ [_____________________]               │
│                                      │
│ [Annuler]            [✓ Enregistrer]  │
└──────────────────────────────────────┘
```

### E.4 Nouvelle vente USDT `/m/treasury/sales/new`
Structure miroir : acheteur (cny_buyer), compte CNY cible, USDT vendu, CNY reçu, taux implicite, **WAC au moment vente affiché en direct + marge prévisionnelle**.

### E.5 Annuaire contreparties `/m/treasury/counterparties`
- Tabs : [Fournisseurs USDT] [Acheteurs CNY]
- Liste : nom, dernière op, volume total période, taux moyen période, badge "active/archivée".
- Détail : stats + historique des opérations de cette contrepartie.
- Création/édition simples (form RHF+Zod).

### E.6 Comptes `/m/treasury/accounts`
- Liste des comptes par devise, solde courant, dernière écriture.
- Détail compte = ledger filtré sur ce compte (lignes ledger lisibles, métadonnées affichées).

### E.7 Réconciliation hebdo `/m/treasury/inventory`
- Liste des comptes "physiques" (cash, alipay, wechat) avec dernier snapshot.
- Bouton **"Faire l'inventaire"** par compte : saisie solde réel → calcul variance → si != 0 demande motif → validation.
- Historique des snapshots avec variance, motif, auteur.

### E.8 Historique opérations `/m/treasury/operations`
Feed unifié achats + ventes + ajustements, filtres période/type/contrepartie/compte. Click → détail. Bouton "Annuler" visible uniquement pour `super_admin`.

---

## F. Audit trail

- `treasury_ledger_entries` : append-only strict (RLS bloque UPDATE/DELETE).
- Tables métier (`usdt_purchases`, `usdt_sales`, `inventory_snapshots`) : flag `voided_at` mais aucune modification de contenu hors voiding.
- `admin_audit_logs` : 1 entrée par opération RPC sensible (create, void).
- Voiding **uniquement** par `super_admin`, motif obligatoire ≥ 10 caractères.

---

## G. Permissions

### G.1 Matrice mise à jour de `AdminAuthContext.tsx`

Ajout de 2 permissions :
- `canViewTreasury` : lecture dashboard, soldes, historique, contreparties.
- `canManageTreasury` : créer achats/ventes/inventaires/contreparties.

### G.2 Affectation par rôle

| Rôle | canViewTreasury | canManageTreasury | Voiding |
|---|---|---|---|
| `super_admin` | ✅ | ✅ | ✅ |
| **`treasurer`** (nouveau) | ✅ | ✅ | ❌ |
| `ops` | ✅ (lecture seule) | ❌ | ❌ |
| `support` | ❌ | ❌ | ❌ |
| `customer_success` | ❌ | ❌ | ❌ |
| `cash_agent` | ❌ | ❌ | ❌ |

**Décision à valider** : le rôle `ops` voit-il le dashboard trésorerie (lecture seule) ou pas du tout ?

### G.3 Saisie père

Affecter le rôle `treasurer` au compte du père. Il aura :
- Accès complet à la saisie (achats, ventes, inventaires, annuaire).
- Pas le droit d'annuler une opération erronée (devra te demander, qui es `super_admin`).
- Pas le droit de gérer d'autres admins.

---

## H. Plan de migration sans casse

1. **Lot 0 (dette)** : déployer `treasury_fix_daily_rates_precision.sql` + adapter RPC `create_daily_rates` + tester sur l'écran `MobileRatesScreen` en preview.
2. **Lot 1 (schema)** : déployer `treasury_schema.sql` (tables vides + RLS + vue). Aucun impact utilisateur, aucun écran encore.
3. **Lot 2 (rôle)** : déployer `treasury_role_treasurer.sql`. Création du compte père avec ce rôle.
4. **Lot 3 (RPCs)** : déployer `treasury_rpcs.sql`. Tests unitaires par RPC en SQL avant intégration UI.
5. **Lot 4 (UI saisie)** : écrans achats + ventes + contreparties + comptes. Permet de commencer à saisir.
6. **Lot 5 (UI dashboard)** : dashboard analytique + réconciliation + historique.

Critère "ready to ship" par lot : type-check + build OK + scénario de test passé sur dev.

---

## I. Risques résiduels identifiés

1. **Discipline opérationnelle** : si toi/ton père ne saisissez pas en temps réel, le module perd sa valeur. → Atténuation : UI ultra-rapide, raccourcis depuis dashboard, saisie possible en lot le soir.
2. **Volumétrie WAC** : `get_wac_usdt` rejoue le ledger. À 10k+ opérations USDT/an, peut devenir lent. → Atténuation : cache applicatif, ou table de WAC snapshots quotidiens.
3. **Taux de référence CNY/XAF** : actuellement absent. Décision Phase 4 : saisie matinale par toi (5 sec) ou import auto depuis source externe ? Sans `t_ref`, la décomposition spread_chaîne / spread_client n'est pas possible (mais le bénéfice total reste calculable).
4. **Stock USDT négatif** : autoriser ou bloquer ? Recommandation : bloquer en saisie (la vente d'USDT qu'on n'a pas n'a pas de sens métier).
5. **Cohérence avec flow client** : aucun lien explicite entre les opérations trésorerie et les `payments`/`deposits` client. C'est volontaire (granularité agrégée, Tier 2). Si tu veux plus tard rapprocher, Tier 3.

---

## J. Décisions validées pour Phase 4

1. **Comptes seedés** (10 comptes) :
   - **XAF (6)** : `xaf_afriland`, `xaf_uba`, `xaf_ecobank`, `xaf_cca` (kind=`bank`) ; `xaf_mtn_momo`, `xaf_orange_money` (kind=`mobile_money`).
   - **USDT (1)** : `usdt_pool` (kind=`crypto_pool`).
   - **CNY (3)** : `cny_cash_guangzhou` (kind=`cash`), `cny_alipay_papa` (kind=`alipay`), `cny_wechat_papa` (kind=`wechat`).
2. **Cap montant achat/vente USDT** : **aucun** (décision utilisateur). Risque accepté : pas de plafond de garde-fou en cas de compromission de compte. Revue possible plus tard.
3. **Taux de référence CNY/XAF** : tiré de `daily_rates` existant, mappé par canal CNY :
   - `cny_cash_guangzhou` → `daily_rates.rate_cash`
   - `cny_alipay_papa` → `daily_rates.rate_alipay`
   - `cny_wechat_papa` → `daily_rates.rate_wechat`
   - Compte CNY bancaire (futur) → `daily_rates.rate_virement`
   - **Limitation actée** : comme `daily_rates` représente les taux clients de Bonzini (pas un taux marché externe), la décomposition `spread_client` sera biaisée vers 0. Le `spread_chaîne` reste pertinent et le bénéfice total est intrinsèque. Évolution future possible vers `rate_snapshots.cny_bid_binance`.
4. **Stock USDT négatif** : autorisé, surligné en rouge sur dashboard tant que solde négatif. Pas de blocage RPC.
5. **Rôle `ops`** : **aucun accès** trésorerie (séparation stricte). Seuls `super_admin` et `treasurer` voient et saisissent.
6. **Variance d'inventaire** : aucune tolérance — toute variance ≠ 0 exige un motif (≥ 10 caractères). Pas de seuil "auto".

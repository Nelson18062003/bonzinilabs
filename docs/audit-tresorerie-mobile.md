# Chantier Trésorerie — Audit Phase 1 (diagnostic)

> **Méthodologie** : identique au chantier chat (audit profond → références → architecture →
> implémentation → test device). **Lecture seule.** Module **argent réel** (rail XAF → USDT → CNY) →
> priorité à la sécurité financière et à la cohérence.
>
> **Périmètre** : `src/mobile/screens/treasury/` (17 fichiers) + `src/hooks/useTreasury.ts`.
> **Légende** : 🟢 haute confiance · 🟡 à confirmer · 🔴 à valider sur device/au runtime.

---

## 0. TL;DR

La Trésorerie est **mieux structurée que le chat** sur la forme (header partagé, gardes de
permission, parcours pensés), mais porte **3 dettes de fond** dont une à **risque financier réel** :

1. **Dark mode cassé partout** — **297 couleurs codées en dur** (`bg-white`, `violet-50`…) au lieu des
   tokens. 14 écrans sur 14 touchés. 🟢
2. **Garde-fous d'argent désactivés** — le composant `AmountField` fournit un **cap 50M XAF + garde
   `isSafeInteger`**, que **chaque** formulaire **coupe** via `max={null}`. Aucune **confirmation**
   avant d'enregistrer un achat/vente. Maths en **virgule flottante**. 🟢
3. **Incohérences design-system** — `<select>` bruts, helpers `fmt`/`ComputedRow` **copiés-collés**
   d'un écran à l'autre. 🟢

---

## 1. Ce qui est BON (à préserver)

- **Layout cohérent** : les 17 écrans utilisent le **`MobileHeader` partagé** + le shell document-scroll
  (pas de bricolage de hauteur). Pas de problème « cadre fixe » ici.
- **Sécurité d'accès** : garde de permission sur **chaque** écran (`canViewTreasury` /
  `canManageTreasury`) avec `<Navigate>` (`MobileNewPurchase.tsx:102`, `MobileNewSale.tsx:71`,
  `MobileTreasuryHome.tsx:113`).
- **UX métier réfléchie** : modes de saisie flexibles (3 combinaisons XAF/USDT/taux), **aperçu calculé
  en direct** (`ComputedRow`), **rappel du WAC**, **alerte “stock USDT négatif”** avant une vente
  (`MobileNewSale.tsx:280`), multi-comptes pour un achat.
- **Confirmations sur les actions destructrices** (suppression/void) : `MobileCounterpartyEdit.tsx:34`,
  `MobileOperationDetail.tsx:229`, `MobileSalesList.tsx:324`.
- **`AmountField` est solide** : formatage à la volée, séparateur virgule/point, caps par devise,
  garde `isSafeInteger`. Le problème n'est pas le composant — c'est qu'on le **débride**.

---

## 2. Thème 1 — Dark mode cassé / tokens de marque contournés 🟢

Le projet a un **système de couleurs sémantique** (`bg-card`, `bg-background`, `text-foreground`,
`border-border`) **et** des tokens de marque (`bonzini-violet/amber/orange`, cf. `tailwind.config.ts`).
La Trésorerie **les ignore** et code la palette Tailwind brute en dur.

**Ampleur mesurée — 297 occurrences, 14/14 écrans :**

| Occurrences | Écran |
|---|---|
| 47 | MobileTreasuryDashboard |
| 43 | MobileNewPurchase |
| 29 | MobilePurchasesList |
| 26 | MobileSalesList |
| 25 | MobileTreasuryHome · MobileNewSale |
| 21 | MobileOperationDetail |
| 20 | MobileAccountsScreen |
| 17 | MobileCounterpartyEdit |
| 15 | MobileInventoryScreen |
| 13 | MobileOperationsHistory |
| 10 | MobileCounterpartiesScreen |
| 6 | balance-dashboard/MobileBalanceDashboard |

Exemples : `bg-white` sur tous les `<select>`/cartes, `bg-violet-50 text-violet-700 border-violet-200`,
`bg-emerald-50`, `bg-amber-50`, `bg-red-50`, `from-amber-50 to-violet-50`, `bg-slate-600`.
**Conséquence** : en thème sombre, ces surfaces restent **blanches/illisibles**. C'est l'écart de
qualité le plus visible et le plus systématique du module.

> Exception légitime : `balance-dashboard/BalanceDashboardPreview.tsx` (0) — c'est un visuel exporté
> en PNG/PDF avec sa propre charte ; à laisser tel quel.

---

## 3. Thème 2 — Sécurité financière 🟢 (priorité, argent réel)

### 3.1 Les plafonds sont coupés volontairement
`AmountField` applique par défaut un **cap par devise** et un **garde `isSafeInteger`** :
```
AmountField.tsx:30  DEFAULT_MAX = { XAF: 50_000_000, RMB: 500_000 }
AmountField.tsx:78  effectiveMax = max === undefined ? DEFAULT_MAX[currency] : max ?? undefined
AmountField.tsx:104 if (n != null && !isDecimal && !Number.isSafeInteger(n)) return  // entier seulement
```
Or **chaque champ montant** de la Trésorerie passe `max={null}` → cap **désactivé** :
`MobileNewPurchase.tsx:264,311,314,317,351,353` · `MobileNewSale.tsx:225,237,247`.
→ Un **achat XAF à 9 999 999 999** (faute de frappe) passe sans broncher et **corrompt le WAC, le
stock et les soldes**. Les champs USDT/CNY (décimaux) n'ont **ni cap ni `isSafeInteger`**.

> Raison probable du débridage : un deal de trésorerie peut légitimement dépasser 50M XAF. **Le bon
> correctif n'est pas “aucun cap” mais un cap plus haut et raisonné** (ex. 1 Md XAF) +/ou une
> confirmation au-delà d'un seuil. À cadrer en Phase 3.

### 3.2 Aucune confirmation avant d'enregistrer une opération
Créer un achat/vente (mutation d'argent réel) part **directement au clic** :
`MobileNewPurchase.tsx:113-129`, `MobileNewSale.tsx:84-96` (`mutateAsync` puis navigation).
**Asymétrie** : *supprimer* une opération demande confirmation, *en créer une* non. Pour de l'argent
réel, un **récap “tu vas enregistrer X USDT pour Y XAF @ Z, débit comptes A/B”** avant écriture est
prudent.

### 3.3 Arithmétique en virgule flottante
Taux/montants dérivés en float : `xaf / usdt`, `usdt * rate`, `cny / usdt`
(`MobileNewPurchase.tsx:91,95,98` · `MobileNewSale.tsx:60,64,67`). Risque d'imprécision sur des
montants financiers — à vérifier vs l'arrondi côté RPC (`useTreasury` + fonctions SQL). 🟡

---

## 4. Thème 3 — Incohérences design-system 🟢

- **`<select>` bruts** (non design-system), stylés `bg-white` : `MobileNewPurchase.tsx:158,218,247`,
  `MobileNewSale.tsx:126,171`. À remplacer par un `SelectField` cohérent (clavier, dark mode, focus).
- **Duplication** : `fmt()` redéfini dans NewPurchase/NewSale/Dashboard, `formatNumber()` dans Home ;
  `ComputedRow` **identique** dans NewPurchase:383 et NewSale:309 ; les *tone-maps* (violet/amber/
  orange → classes) répétés. → à mutualiser (`formatMoney`, `<ComputedRow>`, `<ToneCard>`).

---

## 5. Reste à auditer en détail (avant Phase 3)

Lus à fond : `MobileNewPurchase`, `MobileNewSale`, `MobileTreasuryHome`, `AmountField`. Encore à
détailler (themes confirmés par balayage, détails par écran à venir) :
- Listes : `MobilePurchasesList`, `MobileSalesList`, `MobileOperationsHistory` (densité, tableaux mobile).
- Détail : `MobileOperationDetail` (clarté du récap d'opération + void).
- Gestion : `MobileCounterpartiesScreen`, `MobileCounterpartyEdit`, `MobileAccountsScreen`,
  `MobileInventoryScreen` (réconciliation cash).
- Dashboards : `MobileTreasuryDashboard` (47 couleurs en dur), `balance-dashboard/*`.
- Données : `src/hooks/useTreasury.ts` (22 Ko) — arrondis, types, cohérence des mutations.

---

## 6. Proposition de priorisation (à valider)

1. **Sécurité financière d'abord** (Thème 2) : caps raisonnés + confirmation avant écriture sur
   achat/vente. *Petit périmètre, gros impact, argent réel.*
2. **Dark mode / tokens** (Thème 1) : passe systématique sur les 14 écrans (couleurs → tokens +
   `bonzini-*`). *Gros volume, fort effet qualité visible.*
3. **Cohérence design-system** (Thème 3) : `SelectField` + mutualisation des helpers.

---

## 7. Audit complété — écrans restants & révisions

Lus à fond ensuite : `MobilePurchasesList`, `MobileOperationsHistory`, `MobileOperationDetail`,
`MobileAccountsScreen`, `MobileInventoryScreen`, `MobileTreasuryDashboard`, **et tout `useTreasury.ts`**.

### 7.1 Révision importante — le float n'est PAS un risque (serveur fait foi) 🟢
Toutes les écritures d'argent passent par des **RPC `SECURITY DEFINER`** (`record_usdt_purchase/sale`,
`adjust_treasury_account`, `record_inventory_snapshot`, `void_treasury_operation`). Le **WAC, le stock,
le taux implicite, la contre-écriture de void** sont calculés **côté Postgres** — le float client n'est
qu'un **aperçu**. → Le point 3.3 est **rétrogradé en mineur**.

### 7.2 Nouveau — totaux de listes faux à l'échelle (plafond 1000) 🟡
`useTreasuryOperations` / `useWacEvolution` chargent les opérations **sans `.limit()`**
(`useTreasury.ts:506-519,585-596`) → plafond **PostgREST par défaut = 1000 lignes**. Les **totaux des
listes** (`MobilePurchasesList:227`, `MobileSalesList`) et la **courbe WAC** sont **sommés côté
client** → faux au-delà de 1000 ops. Le **dashboard**, lui, agrège **côté serveur** (`get_treasury_
dashboard`) → correct. Incohérence latente (OK aujourd'hui, faux à terme). Bon correctif : s'appuyer
sur les agrégats serveur, pas resommer côté client.

### 7.3 Confirmé — `max={null}` partout, y compris ajustements & inventaire 🟢
Pas seulement les 2 grands formulaires : l'**ajustement manuel de compte** (`MobileAccountsScreen:209`)
et l'**inventaire** (`MobileInventoryScreen:106`) débrident aussi le cap. Fat-finger possible sur
**toutes** les saisies d'argent du module.

### 7.4 Confirmé — duplication & non-réutilisation 🟢
- `fmt`/`formatNumber`/`formatBalance` : **6+ copies** aux décimales divergentes.
- `getRange` : **3 copies** aux presets divergents (PurchasesList / OperationsHistory / Dashboard).
- `ComputedRow`, `Row`, **les 3 cartes** (`PurchaseCard`/`SaleCard`/`OperationCard`), les **tone-maps**
  (violet/amber/orange → classes) : dupliqués.
- Le `MobileTreasuryDashboard` a son **propre `KpiCard`** alors qu'un **`components/analytics/KpiCard`
  partagé existe déjà** → non-réutilisation.

### 7.5 Confirmé — dark mode jusque dans les graphes 🟠
`MobileTreasuryDashboard` : couleurs de courbe **en hex brut** (`stroke="#a855f7"`, grille `#eee`) sur
une carte `bg-white` → illisible/figé en thème sombre. Les `<select>` bruts + `bg-white` sont partout.

### 7.6 Confirmé bon (à préserver)
Math d'argent serveur (RPC), **contre-écriture ledger au void** (piste d'audit fintech), confirmations
sur destructif (motif ≥10 car.), gardes de permission partout, UX métier riche (WAC/stock/écarts,
format dual XAF/CNY, déviation top-contreparties, réconciliation), `AmountField` solide.

---

## 8. Plan d'implémentation (validé : audit d'abord, puis sécurité → dark mode → cohérence)

**Lot 1 — Sécurité financière** (petit périmètre, fort enjeu) :
- Remplacer `max={null}` par des **caps raisonnés** (à chiffrer avec le fondateur) sur tous les champs.
- **Étape de confirmation** (récap avant écriture) sur achat & vente.
- (option) S'appuyer sur les agrégats serveur pour les totaux de listes (corrige le plafond 1000).

**Lot 2 — Dark mode / tokens** : passe couleurs → tokens (`bg-card`, `text-foreground`, `border-border`,
`bonzini-*`) sur les 14 écrans + couleurs de graphe via variables CSS.

**Lot 3 — Cohérence/dette** : `SelectField` partagé, mutualiser `formatMoney`/`getRange`/`ComputedRow`/
cartes/KPI (réutiliser `components/analytics/KpiCard`).

*Audit Phase 1 terminé. Décision produit en attente pour démarrer le Lot 1 (niveau des caps + étape de
confirmation) — cf. message.*

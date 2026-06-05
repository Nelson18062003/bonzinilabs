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

*→ En attente de ton GO : on garde cette priorité (sécurité → dark mode → cohérence) ? Et tu veux que
je termine d'abord l'audit détaillé des 14 écrans restants, ou que j'attaque la sécurité tout de suite ?*

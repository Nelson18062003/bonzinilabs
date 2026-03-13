# Analyse de l'écran principal — Module Paiements (App Admin)

**Date :** 12 mars 2026
**Fichier analysé :** `src/mobile/screens/payments/MobilePaymentsScreen.tsx`
**Taille :** 597 lignes
**Route :** `/m/payments`

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Chargement des données](#2-chargement-des-données)
3. [Filtres](#3-filtres)
4. [La carte de paiement](#4-la-carte-de-paiement)
5. [Header et actions globales](#5-header-et-actions-globales)
6. [Bottom nav](#6-bottom-nav)
7. [États spéciaux](#7-états-spéciaux)
8. [Responsive et affichage](#8-responsive-et-affichage)
9. [Connexions](#9-connexions)
10. [Problèmes identifiés](#10-problèmes-identifiés)
11. [Annexes — Code complet](#11-annexes)

---

## 1. Vue d'ensemble

### 1.1 Le composant principal

| Attribut | Valeur |
|---|---|
| **Nom** | `MobilePaymentsScreen` |
| **Fichier** | `src/mobile/screens/payments/MobilePaymentsScreen.tsx` |
| **Lignes** | 597 |
| **Export** | Named export — importé en lazy dans `App.tsx` |
| **Route** | `/m/payments` (wrapper : `MobileRouteWrapper`) |

### 1.2 Arbre des composants enfants

```
MobilePaymentsScreen
├── MobileHeader                        (layout/MobileHeader)
│   └── rightElement:
│       ├── [Exporter] button
│       └── [+] button → /m/payments/new
│
├── PullToRefresh                       (ui/PullToRefresh)
│   │
│   ├── KPI Stats Row (horizontal scroll)
│   │   ├── KpiCard "À traiter"        (inline button, filtrable)
│   │   ├── KpiCard "En cours"         (inline button, filtrable)
│   │   ├── KpiCard "Terminés"         (inline button, filtrable)
│   │   └── KpiCard "Aujourd'hui"      (affichée conditionnellement)
│   │
│   ├── [Exporter paiements en cours] button ← DOUBLON du header
│   │
│   ├── SearchBar + FilterToggle
│   │   ├── <input type="text"> (recherche)
│   │   └── [SlidersHorizontal] button → showFilters
│   │
│   ├── Advanced Filters Panel (conditionnel : showFilters === true)
│   │   ├── Méthode (pill chips: Toutes / Alipay / WeChat / Virement / Cash)
│   │   ├── Tri (pill chips: Plus récent / Plus ancien / Montant ↓ / Montant ↑)
│   │   └── Période (2× input type="date" + bouton reset)
│   │
│   ├── Status Filter Chips (horizontal scroll, toujours visibles)
│   │   ├── "Tous" (avec count total)
│   │   ├── "À traiter" (avec count)
│   │   ├── "En cours" (avec count)
│   │   ├── "Terminés" (avec count)
│   │   └── "Rejetés" (sans count affiché)
│   │
│   └── Liste de paiements
│       ├── SkeletonListScreen (si isLoading)
│       ├── PaymentRow × N (si filteredPayments.length > 0)
│       │   ├── PaymentMethodLogo (40px)
│       │   ├── Client name + référence + proof count
│       │   ├── Montant RMB + badge statut + SLA dot + date relative
│       │   └── onClick → /m/payments/:id
│       ├── InfiniteScrollTrigger (si !debouncedSearch)
│       └── MobileEmptyState (si filteredPayments.length === 0)
```

### 1.3 Tous les hooks utilisés

| Hook | Fichier source | Ce qu'il fournit |
|---|---|---|
| `usePaginatedAdminPayments(filters)` | `hooks/usePaginatedPayments.ts` | Liste paginée (infinite) de tous les paiements admin |
| `usePaymentStats()` | `hooks/usePaginatedPayments.ts` | Compteurs KPI : toProcess, inProgress, completed, total, today |
| `useDebouncedValue(searchQuery)` | `hooks/useDebouncedValue.ts` | Valeur de recherche debounced (300ms) |
| `useState` (×7) | react | États locaux des filtres et UI |
| `useMemo` (×4) | react | filterParams, counts, filteredPayments, activeFilterCount |
| `useCallback` (×3) | react | handleLoadMore, clearAdvancedFilters, handleExportBatch |
| `useNavigate` | react-router-dom | Navigation vers paiement / création |

### 1.4 Layout actuel (ASCII)

```
┌─────────────────────────────────────────┐
│  HEADER                                 │
│  ← Paiements        [Exporter] [+]      │
├─────────────────────────────────────────┤
│  ╔═══════╗ ╔═══════╗ ╔═══════╗ ╔══════╗ │
│  ║ À trt ║ ║ Cours ║ ║ Termi ║ ║ Auj. ║ │← scroll horizontal
│  ║   5   ║ ║   2   ║ ║  234  ║ ║   8  ║ │
│  ╚═══════╝ ╚═══════╝ ╚═══════╝ ╚══════╝ │
│                                         │
│  [Exporter paiements en cours (PDF)] ←  ─── DOUBLON
│                                         │
│  [🔍 Nom, téléphone ou référence...] [≡]│
│                                         │
│  [Tous 241] [À traiter 5] [En cours 2]  │← scroll horizontal
│  [Terminés 234] [Rejetés]               │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 支 Liliane Kenfack        ¥5 765    ││
│  │    BZ-PY-2026-0026   [Prêt] ● 2h   ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ 微 Martin Dupont          ¥12 300   ││
│  │    BZ-PY-2026-0025 [En cours] ● 6h ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ 🏦 Paul Mbarga             ¥3 100   ││
│  │    BZ-PY-2026-0024  [Terminé]       ││
│  └─────────────────────────────────────┘│
│  ... (infinite scroll)                  │
├─────────────────────────────────────────┤
│  🏠    ↓    ↑    👥    ···              │← bottom nav fixe
└─────────────────────────────────────────┘
```

---

## 2. Chargement des données

### 2.1 Requête Supabase principale

**Hook :** `usePaginatedAdminPayments(filters?)`
**Type :** `useInfiniteQuery` (TanStack Query)

```sql
-- Requête de base (simplifiée)
SELECT *
FROM payments
[WHERE status IN (...) | status = '...']
[AND method = '...']
[AND created_at >= dateFrom]
[AND created_at <= dateTo]
ORDER BY {sortField} {ASC|DESC}
RANGE pageParam TO pageParam + 19
```

Suivie de **2 requêtes parallèles** pour enrichir chaque page :

```sql
-- Profils clients
SELECT user_id, first_name, last_name, phone, company_name
FROM clients
WHERE user_id IN (...userIds de la page...)

-- Comptage des preuves
SELECT payment_id
FROM payment_proofs
WHERE payment_id IN (...paymentIds de la page...)
```

### 2.2 Champs SELECT récupérés

La requête principale fait `SELECT *` sur `payments`. Les champs effectivement utilisés dans la liste sont :

| Champ | Utilisation |
|---|---|
| `id` | Clé de liste + navigation |
| `reference` | Affiché dans la carte |
| `amount_rmb` | Montant affiché (en ¥) |
| `status` | Badge + filtre KPI + SLA |
| `method` | Logo méthode |
| `created_at` | Date relative + SLA |
| `user_id` | Jointure client |
| `profiles.first_name/last_name` | Nom client |
| `profiles.phone` | Recherche |
| `proof_count` | Icône trombone si > 0 |

> **Note :** `SELECT *` charge tous les champs (dont `beneficiary_*`, `cash_*`, `balance_before/after`, etc.) qui ne sont pas utilisés dans la liste. Sur-lecture inutile.

### 2.3 Pagination

| Paramètre | Valeur |
|---|---|
| **Type** | Infinite scroll (cursor-based) |
| **Taille de page** | `QUERY_LIMITS.ITEMS_PER_PAGE = 20` |
| **Mécanisme** | `range(pageParam, pageParam + 19)` |
| **Curseur** | Index numérique (offset) |
| **Déclencheur** | `IntersectionObserver` (10% visibility) |
| **Désactivé si** | `debouncedSearch` est non vide (recherche client-side) |

Quand une recherche est active, l'infinite scroll est désactivé et seuls les éléments déjà chargés sont filtrés.

### 2.4 Tri par défaut et tris disponibles

| Clé | Label | Champ | Ordre |
|---|---|---|---|
| `newest` *(défaut)* | Plus récent | `created_at` | DESC |
| `oldest` | Plus ancien | `created_at` | ASC |
| `amount_desc` | Montant ↓ | `amount_rmb` | DESC |
| `amount_asc` | Montant ↑ | `amount_rmb` | ASC |

Tri accessible via le panneau "Filtres avancés" uniquement.

### 2.5 Statistiques KPI (requête séparée)

**Hook :** `usePaymentStats()`
**Type :** `useQuery` — 6 requêtes parallèles :

| Compteur | Requête | Affiché dans |
|---|---|---|
| `toProcess` | `COUNT WHERE status = 'ready_for_payment'` + `COUNT WHERE status = 'cash_scanned'` | KPI "À traiter" + chip "À traiter" |
| `inProgress` | `COUNT WHERE status = 'processing'` | KPI "En cours" + chip "En cours" |
| `completed` | `COUNT WHERE status = 'completed'` | KPI "Terminés" + chip "Terminés" |
| `total` | `COUNT *` | Chip "Tous" |
| `today_completed` | `COUNT WHERE status = 'completed' AND updated_at >= today` | KPI "Aujourd'hui" (conditionnel) |
| `today_amount_rmb` | `SUM(amount_rmb) WHERE status = 'completed' AND updated_at >= today` | KPI "Aujourd'hui" sous-ligne |

---

## 3. Filtres

### 3.1 Liste complète des filtres disponibles

| Filtre | Emplacement | Type | Côté |
|---|---|---|---|
| Statut | Chips horizontales (toujours visibles) + KPI cards | Sélection unique | Serveur |
| Méthode | Panneau avancé | Sélection unique | Serveur |
| Tri | Panneau avancé | Sélection unique | Serveur |
| Période (dateFrom/dateTo) | Panneau avancé | Date range | Serveur |
| Recherche texte | Barre fixe | Texte libre | **Client** |

### 3.2 Filtre par statut

**Chips disponibles :**

| Clé | Label | Comportement |
|---|---|---|
| `all` | Tous | Aucun filtre statut |
| `to_process` | À traiter | `status IN ('ready_for_payment', 'cash_scanned')` |
| `processing` | En cours | `status = 'processing'` |
| `completed` | Terminés | `status = 'completed'` |
| `rejected` | Rejetés | `status = 'rejected'` |

**Statuts absents des chips** : `created`, `waiting_beneficiary_info`, `cash_pending` — non accessibles directement depuis la liste.

Les KPI cards "À traiter", "En cours", "Terminés" sont également cliquables et agissent comme des filtres de statut (toggle : cliquer à nouveau réinitialise vers `all`).

### 3.3 Filtre par méthode

Accessible via le panneau "Filtres avancés" :

| Clé | Label |
|---|---|
| `all` | Toutes méthodes |
| `alipay` | Alipay |
| `wechat` | WeChat Pay |
| `bank_transfer` | Virement |
| `cash` | Cash |

### 3.4 Recherche textuelle

- **Déclenchement :** 300ms de debounce après la frappe
- **Portée :** **Client-side uniquement** sur les éléments déjà chargés
- **Champs cherchés :**
  - `profiles.first_name + profiles.last_name` (nom complet)
  - `payment.reference`
  - `profiles.phone`
- **Limitation :** Si seulement 20 éléments sont chargés (page 1), la recherche ne trouve que parmi ces 20. Elle ne requête pas le serveur.

### 3.5 Filtre par date (période)

- `dateFrom` → `WHERE created_at >= dateFrom` (ISO date, début de journée)
- `dateTo` → `WHERE created_at <= dateTo T23:59:59.999Z` (fin de journée)
- Les deux champs sont indépendants (on peut saisir seulement l'un ou l'autre)
- Bouton reset ×  visible quand au moins un champ est rempli

### 3.6 Filtre par client

**Absent.** Il n'existe pas de filtre client dans l'écran liste. Pour voir tous les paiements d'un client, il faut aller dans la fiche client.

### 3.7 Combinaison des filtres (AND)

Tous les filtres actifs se combinent avec un ET logique :
```
status AND method AND dateRange → serveur
result AND searchQuery → client-side
```

### 3.8 État par défaut des filtres

| Filtre | Valeur par défaut |
|---|---|
| statusFilter | `'all'` |
| methodFilter | `'all'` |
| sortKey | `'newest'` (created_at DESC) |
| dateFrom | `''` |
| dateTo | `''` |
| searchQuery | `''` |
| showFilters | `false` |

Quand tous les filtres sont par défaut ET que le tri est `newest`, la requête est envoyée **sans paramètre** (`filterParams = undefined`) — optimisation pour éviter une clé de cache inutile.

### 3.9 Badge compteur de filtres actifs

Le bouton `[≡]` affiche un badge numérique (`activeFilterCount`) qui compte :
- 1 si `methodFilter !== 'all'`
- 1 si `dateFrom || dateTo`
- 1 si `sortKey !== 'newest'`

**Le filtre statut n'est PAS comptabilisé dans ce badge** (il a ses propres chips visuelles).

---

## 4. La carte de paiement

### 4.1 Informations affichées

Chaque paiement est rendu dans un `<button>` avec la classe `.deposit-row`. La carte est divisée en deux colonnes :

**Colonne gauche :**
- Logo méthode de paiement (40×40px, arrondi)
- Nom du client (`first_name + last_name`, tronqué)
- Référence du paiement (`BZ-PY-2026-XXXX`, tronquée)
- Icône trombone + nombre de preuves (si `proof_count > 0`)

**Colonne droite :**
- Montant en RMB (`formatCurrencyRMB`, en gras)
- Badge statut (couleur + label)
- SLA dot + date relative

### 4.2 Affichage du statut

Le statut est affiché sous forme de **badge pill** (`rounded-full`). Couleurs définies dans `PAYMENT_STATUS_COLORS` :

| Statut | Label dans la liste | Couleur |
|---|---|---|
| `created` | Créé | Gris |
| `waiting_beneficiary_info` | Info att. | Jaune |
| `ready_for_payment` | Prêt | Bleu |
| `processing` | En cours | Violet |
| `completed` | Terminé | Vert |
| `rejected` | Rejeté | Rouge |
| `cash_pending` | Cash att. | Orange |
| `cash_scanned` | Cash scanné | Cyan |

### 4.3 Affichage de la méthode

Composant `PaymentMethodLogo` (40px) :

| Méthode | Visuel | Couleur fond |
|---|---|---|
| `alipay` | Caractère 支 blanc | Bleu dégradé `#1677FF → #0958d9` |
| `wechat` | Caractère 微 blanc | Vert dégradé `#07C160 → #06ae56` |
| `bank_transfer` | Icône `Building2` blanc | Gris ardoise dégradé |
| `cash` | Icône `Banknote` blanc | Rouge dégradé `#dc2626 → #b91c1c` |

### 4.4 Affichage du montant

- **Montant affiché :** `amount_rmb` en yuan — `formatCurrencyRMB(amount_rmb)` → ex: `¥5 765`
- **Montant XAF :** NON affiché dans la liste (uniquement dans la fiche)
- **Style :** `font-bold text-sm tabular-nums`

### 4.5 Affichage du client

- Nom : `profiles.first_name + ' ' + profiles.last_name` ou `'Client inconnu'`
- Tronqué avec `truncate` (Tailwind) si trop long
- Aucun avatar / photo de profil

### 4.6 Affichage de la date

- Fonction `formatRelativeDate(payment.created_at)` → ex : "il y a 2h", "hier"
- Style : `text-[10px] text-muted-foreground`
- La date **de création** est toujours utilisée (pas la date de traitement)

### 4.7 SLA indicator (dot coloré)

Calculé par `getPaymentSlaLevel(created_at, status)` :

| Niveau | Condition | Couleur | Animation |
|---|---|---|---|
| `fresh` | < 4h | Vert | Aucune |
| `aging` | 4–12h | Jaune | Aucune |
| `overdue` | > 12h | Rouge | Pulsation (`slaPulse`) |
| `null` | `completed` ou `rejected` | — | Aucune |

### 4.8 Indicateur de preuves

- Icône `Paperclip` (2.5×2.5) + nombre
- Affiché uniquement si `proof_count > 0`
- Couleur : `text-muted-foreground`

### 4.9 Action au clic

```
onClick → navigate(`/m/payments/${payment.id}`)
```

---

## 5. Header et actions globales

### 5.1 Titre

- Titre fixe : **"Paiements"**
- Rendu via `MobileHeader` avec `title="Paiements"`
- Pas de sous-titre ni de compteur dans le titre

### 5.2 Boutons header (rightElement)

**[Exporter]** (texte + icône `FileDown`) :
- Position : header droit
- Style : `h-10 px-3 bg-muted text-muted-foreground text-xs`
- Action : exporte en PDF tous les paiements en statut `processing` (non-cash)
- Désactivé avec spinner pendant la génération

**[+]** (icône `Plus`) :
- Position : header droit (après [Exporter])
- Style : `w-10 h-10 rounded-full bg-primary`
- Action : `navigate('/m/payments/new')`

### 5.3 KPI cards en haut

4 cartes max (scroll horizontal), style `.deposit-stat-card` (glassmorphism, blur 12px) :

| Carte | Valeur | Cliquable | Couleur |
|---|---|---|---|
| **À traiter** | `ready_for_payment + cash_scanned` | ✓ → filtre `to_process` | Bleu |
| **En cours** | `processing` | ✓ → filtre `processing` | Violet |
| **Terminés** | Tous les `completed` (pas que aujourd'hui) | ✓ → filtre `completed` | Vert |
| **Aujourd'hui** | `completed` de la journée + montant | ✗ (non cliquable) | Primary |

La carte "Aujourd'hui" n'apparaît que si `stats.today_completed > 0`.

Quand une KPI card est active (sélectionnée comme filtre) → classe `.deposit-stat-card.active` : `ring-2 + scale(1.02)`.

### 5.4 Pull to refresh

- Composant `PullToRefresh` (custom, touch events)
- Seuil : 60px de tirage
- Action : `refetch()` (invalide le cache et recharge)
- Retour visuel : indicateur `Loader2` pendant le tirage

### 5.5 Bouton export batch (doublon)

**⚠️ Problème documenté en section 10.**

Un second bouton "Exporter paiements en cours (PDF)" est affiché **sous les KPI cards** dans le contenu scrollable. Il déclenche la même action que le bouton "Exporter" dans le header.

---

## 6. Bottom nav

### 6.1 Composant

`MobileTabBar` → `LiquidTabBar` (composant custom)

### 6.2 Onglets

| Position | Icône | Label | Route | Badge |
|---|---|---|---|---|
| 1 | `LayoutDashboard` | Accueil | `/m` | — |
| 2 | `ArrowDownToLine` | Dépôts | `/m/deposits` | `counts.deposits` |
| 3 | `ArrowUpFromLine` | **Paiements** | `/m/payments` | `counts.payments` |
| 4 | `Users` | Clients | `/m/clients` | — |
| 5 | `MoreHorizontal` | Plus | `/m/more` | — |

### 6.3 Onglet actif

L'onglet "Paiements" est actif sur cet écran (route `/m/payments` correspond).

### 6.4 Badge sur l'onglet Paiements

- Hook : `useAdminActionableCounts()`
- Requête : `COUNT WHERE status IN ('ready_for_payment', 'cash_scanned', 'processing')`
- **Différence avec le KPI "À traiter"** : le badge inclut aussi `processing` (en plus de `ready_for_payment` + `cash_scanned`)

---

## 7. États spéciaux

### 7.1 État vide

Composant `MobileEmptyState` avec :
- Icône : `CreditCard`
- Titre : `"Aucun paiement trouvé"`
- Description :
  - Si filtres actifs : `"Essayez de modifier vos filtres"`
  - Sinon : `"Les paiements apparaîtront ici"`

### 7.2 État de chargement

- Composant `SkeletonListScreen` (compte = 4 skeletons)
- Affiché quand `isLoading === true` (première page seulement)
- Le chargement des pages suivantes affiche un `Loader2` dans `InfiniteScrollTrigger`

### 7.3 État d'erreur

**Absent.** Il n'y a pas de gestion d'erreur visible. Si la requête échoue, la liste reste vide sans message d'erreur pour l'utilisateur.

### 7.4 État filtres sans résultat

Même composant `MobileEmptyState` que l'état vide, avec la description `"Essayez de modifier vos filtres"` (condition : `statusFilter !== 'all' || activeFilterCount > 0`).

---

## 8. Responsive et affichage

### 8.1 Largeurs et espacements

| Breakpoint | Padding horizontal | Espacements |
|---|---|---|
| Mobile (défaut) | `px-3` (12px) | `space-y-3` |
| SM (640px+) | `px-4` (16px) | `space-y-4` |
| LG (1024px+) | `px-6` (24px) | `space-y-4` |

### 8.2 Scrolls horizontaux

- KPI cards : scroll horizontal avec `overflow-x-auto scrollbar-hide`
- Status chips : scroll horizontal
- Method chips : scroll horizontal (dans le panneau avancé)
- Sort chips : scroll horizontal (dans le panneau avancé)

Tous masquent la scrollbar (`scrollbar-hide`).

### 8.3 Contrainte max-width

Le composant n'a pas de `max-width` explicite — il utilise `min-h-full` et s'étend sur toute la largeur disponible.

### 8.4 PaymentRow (.deposit-row)

```css
.deposit-row {
  @apply w-full bg-card rounded-2xl p-4 border border-border text-left;
  @apply active:scale-[0.98] transition-all duration-150;
}
```

Pas de hauteur fixe — la hauteur est déterminée par le contenu.

---

## 9. Connexions

### 9.1 Navigation vers "Nouveau paiement"

- **Depuis le header [+]** : `navigate('/m/payments/new')` → `MobileNewPayment`
- **Depuis le dashboard** : lien rapide `{ label: 'Paiement', to: '/m/payments/new' }`

### 9.2 Navigation vers la fiche d'un paiement

```typescript
onClick={() => navigate(`/m/payments/${payment.id}`)
```
→ Route `/m/payments/:paymentId` → `MobilePaymentDetailV2`

### 9.3 Depuis le dashboard

`MobileDashboard` référence `/m/payments` à deux endroits :
1. Widget KPI paiements → cliquable → `/m/payments`
2. Shortcuts rapides → "Paiement" → `/m/payments/new`

Le dashboard utilise également `usePaymentStats()` pour afficher le compteur de paiements en attente.

### 9.4 Depuis les notifications

`useAdminNotifications` génère des notifications de type `payment_*` avec `targetPath: /m/payments/:id` → naviguent directement vers la fiche.

### 9.5 La liste dans la fiche client

Le `MobileClientDetail` effectue une requête directe sur Supabase :

```sql
SELECT * FROM payments WHERE user_id = clientId
```

Il ne réutilise PAS `usePaginatedAdminPayments` — c'est une requête indépendante sans pagination ni filtres.

### 9.6 Badge onglet bottom nav

`useAdminActionableCounts` → `COUNT WHERE status IN ('ready_for_payment', 'cash_scanned', 'processing')`.

Ce hook est distinct de `usePaymentStats` mais interroge les mêmes données avec des critères légèrement différents (inclut `processing`, exclut les terminés).

---

## 10. Problèmes identifiés

### 10.1 CRITIQUE — Bouton "Exporter" en double

Le bouton d'export PDF est affiché **deux fois** :
1. Dans le `rightElement` du header (petit, texte + icône)
2. Dans le contenu scrollable, en pleine largeur, sous les KPI cards

Les deux déclenchent exactement la même action (`handleExportBatch`). L'un des deux doit être supprimé — probablement le doublon en inline.

### 10.2 Recherche client-side seulement

La recherche textuelle (`searchQuery`) filtre uniquement sur les éléments **déjà chargés** en mémoire. Si seulement 20 paiements sont chargés (page 1), la recherche sur un nom qui n'est pas dans ces 20 résultats échouera silencieusement.

**Cas problématique :** 500 paiements en base, admin cherche "Kenfack" → si le paiement est à la position 150, il ne sera pas trouvé.

**Fix attendu :** Ajouter une option de recherche server-side dans `PaymentFilters`, ou ajouter `search` au hook `usePaginatedAdminPayments`.

### 10.3 Infinite scroll désactivé pendant la recherche

Quand `debouncedSearch` est non vide, `InfiniteScrollTrigger` n'est pas rendu → impossible de charger plus de pages pendant une recherche. C'est intentionnel mais incohérent si la recherche est client-side (on ne peut pas obtenir de meilleurs résultats).

### 10.4 Statuts absents des chips de filtre

3 statuts ne sont pas accessibles depuis les chips de filtre :
- `created`
- `waiting_beneficiary_info`
- `cash_pending`

Un admin ne peut pas filtrer uniquement les paiements "en attente d'infos bénéficiaire" depuis la liste principale.

### 10.5 Badge onglet incohérent avec le KPI "À traiter"

- **Badge onglet** `counts.payments` = `ready_for_payment + cash_scanned + processing` (3 statuts)
- **KPI "À traiter"** = `ready_for_payment + cash_scanned` (2 statuts)
- **KPI "En cours"** = `processing` (1 statut)

Le badge inclut `processing` alors que le KPI "À traiter" ne le fait pas. Un admin peut voir "7" dans le badge mais "5 à traiter + 2 en cours" dans les KPI. Les deux hooks (`usePaymentStats` et `useAdminActionableCounts`) font des requêtes similaires mais différentes, sans partager de cache.

### 10.6 SELECT * surchargé

La requête principale fait `SELECT *` sur `payments`. Pour la liste, seuls ~8 champs sont nécessaires sur la trentaine disponibles (`beneficiary_*`, `cash_*`, `balance_*`, `rate_is_custom`, etc. ne sont pas utilisés). Sur une liste de 20 items avec les champs volumineux (JSONB `beneficiary_details`), cela génère une surcharge réseau inutile.

### 10.7 KPI "Terminés" — compteur trompeur

La KPI card "Terminés" affiche le nombre total de paiements `completed` depuis le début (ex: 234). Ce n'est pas un compteur du jour ou du mois. Un admin pourrait penser que 234 paiements ont été terminés aujourd'hui.

La carte "Aujourd'hui" (conditionnelle) affiche le vrai chiffre du jour, mais uniquement si > 0.

### 10.8 Absence de gestion d'erreur

Si `usePaginatedAdminPayments` ou `usePaymentStats` échoue, aucun message d'erreur n'est affiché. La liste reste vide (même état que "aucun paiement") et l'utilisateur ne sait pas si c'est un problème réseau ou s'il n'y a vraiment aucun paiement.

### 10.9 Pas de filtre par client

Il n'est pas possible de filtrer la liste par un client spécifique depuis cet écran. Pour voir les paiements d'un client, il faut naviguer vers la fiche client.

### 10.10 `PAYMENT_METHOD_ICONS` importé mais non utilisé

```typescript
import { ..., PAYMENT_METHOD_ICONS, ... } from '@/types/payment';
```

`PAYMENT_METHOD_ICONS` est importé dans le composant mais jamais utilisé (les icônes viennent de `PaymentMethodLogo`). Import mort.

---

## 11. Annexes

### 11.1 Taille des fichiers

| Fichier | Lignes | Rôle |
|---|---|---|
| `MobilePaymentsScreen.tsx` | 597 | Composant principal |
| `hooks/usePaginatedPayments.ts` | 234 | Hooks de données (infinite query + stats) |
| `hooks/useDebouncedValue.ts` | 18 | Debounce générique |
| `mobile/components/payments/PaymentMethodLogo.tsx` | 66 | Logo méthode |
| `mobile/components/ui/InfiniteScrollTrigger.tsx` | ~50 | Trigger infinite scroll |
| `mobile/components/ui/PullToRefresh.tsx` | ~80 | Pull-to-refresh custom |
| `mobile/components/ui/MobileEmptyState.tsx` | — | État vide |
| `mobile/components/ui/SkeletonCard.tsx` | — | Skeleton chargement |
| `mobile/components/layout/MobileTabBar.tsx` | 28 | Bottom navigation |
| `lib/paymentSla.ts` | 17 | Calcul SLA |
| `types/payment.ts` | ~120 | Types, labels, couleurs |

### 11.2 Constantes importantes

```typescript
// Pagination
QUERY_LIMITS.ITEMS_PER_PAGE = 20

// Cache (TanStack Query)
CACHE_CONFIG.STALE_TIME.LISTS = X ms   // données périmées après X ms
CACHE_CONFIG.GC_TIME = 5 * 60 * 1000  // garbage collection après 5 min

// SLA
< 4h  → fresh  (vert)
4-12h → aging  (jaune)
> 12h → overdue (rouge, pulsation)

// "À traiter" = composite
TO_PROCESS_STATUSES = ['ready_for_payment', 'cash_scanned']

// Badge onglet = "À traiter" + "En cours"
ACTIONABLE_PAYMENT_STATUSES = ['ready_for_payment', 'cash_scanned', 'processing']
```

### 11.3 Schéma des requêtes réseau au chargement initial

```
MobilePaymentsScreen mount
  │
  ├── usePaymentStats()
  │     ├── COUNT WHERE status = 'ready_for_payment'
  │     ├── COUNT WHERE status = 'processing'
  │     ├── COUNT WHERE status = 'cash_scanned'
  │     ├── COUNT WHERE status = 'completed'
  │     ├── COUNT *
  │     └── SELECT amount_rmb WHERE completed AND today
  │
  ├── usePaginatedAdminPayments(undefined)
  │     ├── SELECT * FROM payments ORDER BY created_at DESC RANGE 0-19
  │     ├── SELECT user_id,... FROM clients WHERE user_id IN (...)
  │     └── SELECT payment_id FROM payment_proofs WHERE payment_id IN (...)
  │
  └── useAdminActionableCounts()       ← depuis MobileTabBar
        ├── COUNT deposits WHERE status IN (...)
        └── COUNT payments WHERE status IN ('ready_for_payment','cash_scanned','processing')
```

**Total : 9 requêtes Supabase au chargement initial** (dont 3 pour les stats paiements seuls).

### 11.4 Captures textuelles du layout

#### État initial (aucun filtre, données chargées)

```
[Header] Paiements                    [Exporter] [+]
─────────────────────────────────────────────────────
[À traiter: 5] [En cours: 2] [Terminés: 234] [Auj.: 8 / ¥89 230]

[Exporter paiements en cours (PDF)] ←── DOUBLON

[🔍 Nom, téléphone ou référence...    ] [≡]

[Tous 241] [À traiter 5] [En cours 2] [Terminés 234] [Rejetés]

[支] Liliane Kenfack              ¥5 765
     BZ-PY-2026-0026        [Prêt] ●vert 2h

[微] Martin Dupont              ¥12 300
     BZ-PY-2026-0025    [En cours] ●jaune 7h

[🏦] Paul Mbarga                ¥3 100
     BZ-PY-2026-0024    [Terminé]

[💰] Rachel Ngo                 ¥8 500
     BZ-PY-2026-0023   [Refusé]
     🗂×2

... (20 items max par page, puis infinite scroll)
─────────────────────────────────────────────────────
🏠 Accueil | ↓ Dépôts | ↑ Paiements [7] | 👥 Clients | ···
```

#### Panneau filtres avancés ouvert

```
[🔍 ...]                                          [≡ actif]

╔═══════════════════════════════════════════════╗
║ Filtres avancés                  [Réinitialiser]║
║                                               ║
║ Méthode :                                     ║
║ [Toutes] [Alipay] [WeChat] [Virement] [Cash]  ║
║                                               ║
║ Tri :                                         ║
║ [Plus récent●] [Plus ancien] [Montant↓] [M↑]  ║
║                                               ║
║ 📅 Période :                                  ║
║ [2026-01-01]  →  [2026-03-12]  [×]           ║
╚═══════════════════════════════════════════════╝
```

---

*Document généré le 12 mars 2026 — Base de code Bonzini Admin v2026-03*

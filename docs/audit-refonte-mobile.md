# Audit & plan de refonte — App admin mobile BonziniLabs

> Audit réalisé avant toute modification, pour repartir sur des bases saines et
> avancer **module par module**. Objectif : un langage visuel unique (celui de
> **Mola / flyer**, inspiré de la réf Ofspace Banking), zéro incohérence, chaque
> détail soigné.

## 1. Vue d'ensemble

L'app mobile = **deux sous-applications** partageant l'ossature :
- **Admin** (`/m/*`) → `MobileRouteWrapper` → `MobileAppShell` + `MobileTabBar` (6 onglets : Accueil · Mola · Dépôts · Paiements · Clients · Plus).
- **Agent Cash** (`/a/*`) → `AgentCashRouteWrapper` → `AgentCashShell` + `AgentCashTabBar` (2 onglets : Cash · Scanner).

~30 routes, ~40 écrans, 13 groupes de modules.

## 2. Le problème central — fragmentation du design system

Quatre langages visuels coexistent :

| Langage | Où | Signature |
|---|---|---|
| **Treasury « flat »** (`components/treasury/ui.tsx`) | Trésorerie | cartes à **bordure fine** (sans ombre), pastilles **colorées**, tons bonzini. Bien construit. |
| **Analytics** (`components/analytics/`) | Analytique + Accueil | KpiCard / ChartCard |
| **Mola / Ofspace** ⭐ (cible) | Mola + flyer | canvas doux, cartes blanches **à ombre douce**, pastilles **neutres**, pilules sombres, gros chiffres, zéro dégradé. **Pas encore extrait en composants.** |
| **Ad-hoc** | clients, deposits, payments, rates, admins, more, support, agent-cash | mélange Tailwind+`cn()` **et** `React.CSSProperties` inline (hex + DM Sans en dur), classes CSS maison (`card-glass`, `deposit-stat-card`, `btn-primary-gradient`, `sla-*`) |

→ Conséquence : refaire un écran isolément **aggrave** la fragmentation. Il faut d'abord poser les **fondations** communes.

## 3. Problèmes transverses (critiques)

1. **Duplication V1/V2** — Dépôts : le routeur utilise déjà **V2** (`MobileDepositsScreenV2`, `MobileDepositDetailV2`). Les **V1** (`MobileDepositsScreen.tsx` 519 l. + `MobileDepositDetail.tsx` 1186 l.) sont **du code mort** (maintenus par le barrel `index.ts`). ~1700 lignes à supprimer. *(Paiements : `MobilePaymentDetail` vs `MobilePaymentDetailV2` — à confirmer lequel est vivant.)*
2. **2–3 systèmes de style incompatibles** — Tailwind+`cn()` vs `React.CSSProperties` inline (MobileCreateClient, les écrans V2, MobileNewPayment, RateFlyer) vs classes CSS maison. Impossible à factoriser tel quel.
3. **Couleurs décentralisées** :
   - Statuts client/dépôt/paiement colorés **différemment** (même « en attente » = orange ici, bleu là → confusion).
   - `ROLE_BADGE_COLORS` redéfini **3×** avec des valeurs différentes (MobileAdminsScreen, MobileCreateAdmin, MobileAdminDetail).
   - Couleurs de méthode (Alipay/WeChat…) en dur dans plusieurs fichiers + `types/rates.ts`.
   - Dégradés en `style` inline partout. **Aucune palette centrale.**
4. **Pas de librairie de composants** — chaque écran réinvente : cartes (4 patterns), KPI/stat cards, **bottom-sheets (10+ copies)**, onglets (3 patterns), inputs (`h-10` vs `h-12`…), états loading/error.
5. **Écrans géants** — détails à 1186–1334 lignes, 20+ `useState`, drawers imbriqués → maintenance difficile.
6. **Incohérences d'ossature** — padding/safe-area variables (`pb-24` vs `pb-28`, breakpoints absents ailleurs), délais d'animation hétérogènes, valeurs magiques (`scale(0.172)`, `92dvh`).
7. **Navigation** — `backTo` en dur, pas de fil d'Ariane sur les drill-in profonds.

## 4. Inventaire par module

| Module | Écrans | Langage actuel | État / priorité |
|---|---|---|---|
| **assistant (Mola)** | 1 | **Ofspace** ✅ | Fait (référence) |
| **flyer** | (fonction) | **Ofspace** ✅ | Maquette validée, à porter dans Satori |
| **treasury** | 12 | Treasury flat | Bon, à **aligner** sur tokens finaux |
| **dashboard (accueil)** | 1 | Analytics/KPI | À refaire (hero + actions) |
| **analytics** | 1 | Analytics (sections pliables) | Restructuré, à aligner |
| **more (hub)** | 6 | Ad-hoc | **Pilote idéal** (petit, visible) |
| **clients** | 5 | Mixte (Tailwind + inline) | Cœur métier, gros |
| **deposits** | 4 (+2 morts) | Inline V2 | Cœur métier ; nettoyer V1 d'abord |
| **payments** | 4 | Inline + tokens locaux | Cœur métier |
| **rates** | 9 | Ad-hoc + dégradés inline | Onglets à unifier |
| **admins** | 3 | Ad-hoc (badges ×3) | Moyen |
| **support** | 5 | bonzini-* + ad-hoc | Moyen |
| **agent-cash** | 6 | `card-glass` + gradient | Sous-app à part |
| **auth** | 1 (+agent) | Composants partagés | OK, retouches |

## 5. Atouts existants (sur quoi bâtir)

- `components/treasury/ui.tsx` — la **meilleure base** (intention « premium banking » déjà là : SoftCard, IconChip, Pill, PrimaryPill, SectionTitle, ActionTile, FieldLabel, tons). À **faire évoluer** vers le langage Ofspace (ombre douce + pastilles neutres + canvas doux).
- Le langage **Mola/Ofspace** (déjà écrit, validé) = la cible à extraire en composants.
- Ossature partagée solide : `MobileHeader`, `MobileAppShell`/`AgentCashShell`, `LiquidTabBar`, `PullToRefresh`, `MobileEmptyState`, `SkeletonCard`, `MobileFilterChips`, `MobileStatCard`, `ViewportShell` (chat).

## 6. Plan de refonte — étape par étape

### Phase 0 — Fondations (À FAIRE EN PREMIER, tout en dépend)
- **Tokens centraux** (`src/mobile/theme.ts` ou étendre l'existant) : surfaces (canvas, carte, ombre douce), pastille neutre, pilules, **palette de statut unique** (client/dépôt/paiement), **couleurs de rôle uniques**, couleurs de méthode (Alipay/WeChat/Virement/Cash).
- **UI kit mobile** (évolution de `treasury/ui.tsx`) : `Card`, `Holder/Avatar`, `Row`, `Amount`, `PrimaryPill`/`SoftPill`, `StatusPill`, `SectionTitle`, `StatCard`, `BottomSheet`, `FormInput`, `Segmented/Tabs`, `ScreenLoader`/`ScreenError`.
- Aucun écran modifié encore → on **valide le kit** sur 2-3 captures.

### Phase 1 — Nettoyage structurel
- Supprimer les **V1 morts** (deposits, et payment detail si confirmé) + corriger le barrel.
- Centraliser les dicos de couleurs dupliqués → import unique.

### Phase 2 — Migration module par module (ordre proposé)
1. **More (hub)** — pilote : valide le kit sur un module simple et très visible.
2. **Clients** (liste · détail · création · ledger · bénéficiaires).
3. **Deposits** (liste · détail · nouveau) — après nettoyage V1.
4. **Payments** (liste · détail · nouveau).
5. **Rates** (unifier les onglets + simulateur + flyer porté dans Satori).
6. **Admins**.
7. **Support**.
8. **Agent-cash**.
9. **Alignement final** : Treasury + Accueil + Analytics sur les tokens définitifs.

### Process pour CHAQUE étape
refonte écran(s) → `type-check` + `build` → capture(s) clair/sombre → **validation avec toi** → commit + push. On n'enchaîne au module suivant qu'une fois validé.

## 7. Décisions à valider

1. **Base du design system** : faire **évoluer `treasury/ui.tsx`** en kit unique aligné Ofspace (recommandé), plutôt qu'un nouveau kit séparé (qui re-fragmenterait).
2. **V1/V2** : confirmer qu'on peut **supprimer les V1 morts** (à coordonner — c'est peut-être une migration en cours côté ton frère).
3. **Ordre** : on commence par **Phase 0 (fondations)** puis le **pilote « More »** ?

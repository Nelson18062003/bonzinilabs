# Module Trésorerie — refonte desktop

> Phase 1 : inventaire + architecture. Phases 2-5 : implémentation
> (`src/desktop/screens/treasury/`). Le mobile ne change pas.
> Contrat de design : `02-foundation.md` (archétype, tokens, règles §1.5).

## 0. Ce que fait ce module (le métier, d'abord)

La trésorerie n'est pas « des comptes » : c'est **le pont USDT** qui rend
l'activité possible. Le client paie en XAF au Cameroun, le fournisseur doit
être payé en CNY en Chine. Entre les deux :

```
XAF (comptes Bonzini) ──achat──> USDT (stock) ──vente──> CNY ──> fournisseur chinois
       fournisseur USDT local            acheteur CNY
```

Tout le module sert à répondre à **quatre questions** :

| Question | Chiffre |
|---|---|
| Combien me coûte 1 USDT en moyenne ? | **WAC** (coût moyen pondéré) |
| Combien d'USDT me reste-t-il ? | **Stock USDT** |
| Combien me coûte 1 CNY livré ? | **Taux de revient** (XAF/CNY) |
| Est-ce que je gagne de l'argent ? | **Marge** = taux client − taux de revient · **Bénéfice** période |

Le reste (comptes, contreparties, inventaire) existe pour que ces quatre
chiffres soient justes.

## 1. Inventaire des capacités (source : `useTreasury.ts` + RPC + routes)

| Capacité | Données / RPC | Notes |
|---|---|---|
| Soldes par compte | vue `treasury_account_balances` | 3 devises : XAF, USDT, CNY ; `kind` (cash, alipay, wechat, bank…) |
| Comptes | `treasury_accounts` | `is_active`, `sort_order`, `code`, `label` |
| Ajustement manuel d'un compte | RPC `adjust_treasury_account` | delta signé + motif obligatoire → crédit ou débit |
| Inventaire / réconciliation | RPC `record_inventory_snapshot` | solde réel vs théorique ; **motif obligatoire dès qu'il y a un écart** (≥10 car.) ; seulement `cash`/`alipay`/`wechat` (les banques se réconcilient seules) |
| Contreparties | `treasury_counterparties`, RPC `create_/update_/delete_treasury_counterparty` | 2 types : `usdt_supplier` (CMR, +237) et `cny_buyer` (Chine, +86, WeChat) ; archivage (`is_active`) ; suppression refusée si opérations liées (`operation_count`) |
| Achat USDT | RPC `record_usdt_purchase` | XAF → USDT ; **répartition multi-comptes** (`account_splits[]`) ; renvoie `implicit_rate` + **`new_wac`** |
| Vente USDT | RPC `record_usdt_sale` | USDT → CNY ; compte CNY crédité **optionnel** ; renvoie `wac_at_sale`, `stock_usdt_after`, **`warning_negative_stock`** |
| Annulation d'opération | RPC `void_treasury_operation` | motif obligatoire ; l'opération reste visible, marquée annulée (jamais d'effacement) |
| WAC / stock courants | RPC `get_wac_usdt`, `get_usdt_stock` | |
| Dashboard analytique | RPC `get_treasury_dashboard(from,to)` | soldes, totaux par devise, achats/ventes (volumes + taux moyens pondérés), taux client, WAC, stock, `spread_chain_xaf`, `spread_client_xaf`, `benefit_total_xaf`, `capital_immobilized_current_xaf`, `taux_de_revient_xaf_per_cny` |
| Top contreparties | RPC `get_top_counterparties(type,from,to,limit)` | volume, taux moyen pondéré et **`deviation_pct`** vs la moyenne générale |
| Évolution du WAC | `useWacEvolution` (client-side) | rejoue achats + ventes non annulées, un point par événement |
| Flux USDT effectif | `useUsdtFlowEvolution` | `implicit_rate` par opération réelle (≠ snapshot de marché) : évolution + distribution |
| Fil des opérations | `useTreasuryOperations(from,to)` | achats + ventes fusionnés, triés par date |
| Détail d'une opération | `usePurchase` / `useSale` / `usePurchaseSplits` | le détail d'achat doit montrer la **ventilation par compte** |
| Dashboard soldes exportable | `MobileBalanceDashboard` + `exportFlyer` | visuel PNG/PDF des soldes à envoyer |

**Permissions** : `canViewTreasury` (lecture) · `canManageTreasury` (écriture).
Matrice actuelle : seuls `super_admin` et `treasurer` les ont — pas `ops`.

## 2. Défauts constatés (avant refonte)

1. **L'accueil desktop est un lanceur de 10 tuiles.** `DesktopTreasuryHome`
   affiche 4 cartes de solde puis 10 `ActionTile` géantes vers 10 pages. C'est
   le menu du téléphone porté sur un écran large : densité nulle, tout est à
   deux clics, aucune opération visible.
2. **14 routes pour un seul module**, et **5 routes desktop montent
   littéralement des écrans mobiles** (`MobileNewPurchase desktop`,
   `MobileNewSale`, les deux détails d'opération, l'édition de contrepartie) —
   exactement ce que `02-foundation.md` §5 dit d'arrêter.
3. **Aucun workbench.** L'historique est une grille de cartes en 2 colonnes :
   pas de tri, pas de recherche, pas de pagination, pas de colonnes
   comparables. Impossible de répondre à « quel achat était le plus cher ? ».
4. **Aucun détail latéral.** Cliquer une opération quitte la page pour un
   écran téléphone ; on perd la liste et le contexte.
5. **Le dashboard dit tout en même temps** : héros bénéfice + 8 KPI + 2 encarts
   + jusqu'à 5 graphes + 2 tops + 3 raccourcis, d'un seul scroll. C'est le
   défaut déjà rejeté sur le module Taux (« trop d'informations d'un coup »).
6. **Les mêmes chiffres sont répétés sur trois écrans** (accueil, dashboard,
   comptes affichent tous les soldes et le WAC) sans qu'aucun ne soit
   l'endroit de référence.
7. **Géométrie d'avant la refonte** : titres 26px, `rounded-3xl`, `active:scale`,
   `SOFT_CARD`/`Pill`/`Segmented` mobiles, ombres portées — le kit desktop
   (`src/desktop/designKit`) n'est utilisé nulle part dans ce module.
8. **Graphe WAC en Recharts à axe catégoriel** : les opérations ne sont pas
   équidistantes dans le temps, l'axe ment sur le rythme. Même défaut que
   celui corrigé sur Taux (remplacé par lightweight-charts).
9. `INSET` est importé sans être utilisé dans `DesktopTreasuryDashboard`
   (bruit mort).

## 3. Architecture cible

### 3.1 Une seule route, quatre vues

Le module devient **un écran** avec un sélecteur de vue — le schéma validé sur
Taux : *une vue = un métier*, rien d'autre à l'écran.

```
/m/more/treasury   →  DesktopTreasuryScreen
   [ Opérations ]  [ Analyse ]  [ Comptes ]  [ Contreparties ]
```

- **Opérations** (défaut) — le poste de travail quotidien.
- **Analyse** — les quatre chiffres + l'historique des taux.
- **Comptes** — soldes, ajustements **et inventaire** (même objet : un compte).
- **Contreparties** — fournisseurs USDT / acheteurs CNY.

Les deux saisies (achat, vente) s'ouvrent en **fenêtre par-dessus la vue
courante** (voile flouté, `TreasuryEntryDialog`), à leur propre URL —
`/treasury/purchase`, `/treasury/sale` — donc toujours liables. C'est l'écran
qui les rend d'après l'URL, pas une route à part : la vue derrière (période,
filtre, ligne sélectionnée) n'est jamais remontée, et fermer y revient. Le
formulaire est réduit à quatre décisions numérotées (qui · quel compte ·
combien · quand) avec un pied fixe montrant l'effet sur le stock (WAC
avant → après, stock après) ; note et référence sont repliées. La version
« page pleine » (quatre cartes + récapitulatif latéral) a été retirée sur
retour utilisateur : trop d'informations à la fois, mal hiérarchisées.
Le dashboard soldes exportable reste accessible depuis **Comptes**.

Les anciennes routes de liste (`/purchases`, `/sales`, `/operations`,
`/accounts`, `/inventory`, `/counterparties`) redirigent vers la vue
correspondante — les liens existants continuent de marcher.

### 3.2 Vue « Opérations » — archétype A + B

```
┌ Barre d'état (toujours visible) ───────────────────────────────┐
│ Stock USDT · WAC · XAF · CNY        [Achat]  [Vente ▪ primaire]│
├ Filtres (une ligne, 36px) ─────────────────────────────────────┤
│ [Tout n][Achats n][Ventes n][Annulées n]  [🔍] [Période ▾]      │
├ Table triable ─────────────────┬ Panneau détail (≥560px) ──────┤
│ Date · Type · Contrepartie ·   │ En-tête épinglé + [Annuler]   │
│ USDT · Contre-valeur · Taux ·  │ Ventilation par compte         │
│ Compte · (annulée)             │ Grille de faits · note · réf   │
│ pagination                     │                                │
└────────────────────────────────┴────────────────────────────────┘
```

- **Barre d'état** : les 4 chiffres qui pilotent la journée, jamais plus. Stock
  USDT négatif ⇒ bandeau rouge d'alerte (c'est un achat non saisi).
- **Table** : colonnes comparables et triables, montants à droite en
  `tabular-nums`. Le taux effectif de chaque opération est une **colonne**, pas
  un détail caché — c'est le chiffre qu'on compare.
- **Ligne annulée** : barrée + pastille, jamais masquée par défaut.
- **Panneau** : la ventilation multi-comptes d'un achat s'affiche enfin
  (`usePurchaseSplits`), et « Annuler l'opération » vit dans l'en-tête épinglé
  avec sa confirmation centrée (motif obligatoire).

### 3.3 Vue « Analyse »

Hiérarchie explicite au lieu d'un mur : **une décision par bloc.**

1. **Les quatre chiffres** en tête : Bénéfice période (focal), Marge par CNY
   livré, Taux de revient, Taux client. Ce sont les seuls chiffres « business ».
2. **Volumes** : achats / ventes (nombre, volume, taux moyen pondéré) — deux
   cartes symétriques, pas huit KPI.
3. **Graphe** : évolution du WAC en **lightweight-charts** (vraie échelle de
   temps, crosshair) — le même moteur que le module Taux.
4. **Top contreparties** : deux tables courtes, avec l'écart vs la moyenne
   (`deviation_pct`) mis en couleur — c'est l'information actionnable
   (« ce fournisseur me vend 3 % plus cher que la moyenne »).

Les distributions et le second graphe de flux passent derrière un sélecteur
de courbe plutôt que de s'empiler.

### 3.4 Vue « Comptes »

Une table par devise (XAF / USDT / CNY) avec total par groupe, et sur chaque
ligne les deux actions du métier : **Ajuster** (delta signé + motif) et
**Inventorier** (solde réel constaté, écart calculé, motif obligatoire si
écart). Les deux en dialogue centré. Bouton « Visuel des soldes » vers l'export
PNG/PDF existant.

Fusionner comptes et inventaire est le vrai correctif : ce sont deux actions
sur **le même objet**, séparées aujourd'hui en deux pages.

### 3.5 Vue « Contreparties »

Table (Nom · Type · Contact · Opérations · Dernière op) + création et édition
en dialogue centré, archivage, suppression bloquée si des opérations existent
(message explicite au lieu d'une erreur brute).

### 3.6 Pages de création (achat / vente)

Archétype C — `max-w 1080`, deux zones :

- **Gauche (décisions)** : contrepartie (avec création en ligne), compte(s),
  montants.
- **Rail droit collant (récapitulatif vivant)** : taux effectif, WAC avant →
  après pour un achat ; base de coût, stock après et **alerte stock négatif**
  pour une vente. Le rail est ce qui manque aujourd'hui : l'opérateur saisit un
  montant sans voir son effet sur le stock.

**À préserver exactement** (logique financière déjà validée) :
- achat, compte unique : 3 modes de saisie (`XAF+USDT` → taux, `XAF+taux` →
  USDT, `USDT+taux` → XAF) ;
- achat, multi-comptes : le total XAF vient des lignes, on saisit USDT **ou**
  le taux ;
- vente : 3 modes symétriques (`USDT+CNY`, `USDT+taux`, `CNY+taux`), compte CNY
  optionnel (« aucun compte Bonzini concerné » est le cas courant) ;
- antidatage (`occurred_at`), référence externe, notes.

## 4. Ce qui ne change pas

Hooks, RPC et calculs : **aucune modification**. C'est un remplacement de
présentation. Aucune migration n'est requise par cette refonte.

Le mobile garde ses écrans ; seules les routes **desktop** cessent de les
monter.

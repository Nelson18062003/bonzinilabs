# Admin mobile — 03 · Plan de refonte

Décisions fondateur (13/09/2026) : le design system est **le Figma**
(`01-figma-kit.md`), la police est **DM Sans seule**, la barre du bas devient
**Mola · Cargo · Opérations · Clients · Plus** (Accueil supprimé, Dépôts et
Paiements fusionnés), et Cargo + la carte sont repensés pour le mobile.

## Principe

Le mobile **décide ce qu'il montre**, il ne rétrécit pas le desktop. Un admin
sur son téléphone est au port, chez le transitaire, dans un taxi : il vient
savoir ce qui brûle et débloquer une boîte. Chaque écran mobile est donc le
sous-ensemble qui sert ce geste ; le reste (export CSV, tri par colonne,
globe, analytics fin) reste au desktop.

## Phase A — Fondations (une seule fois, tout bascule)

`src/mobile/designKit/tokens.ts` et `components.tsx` gardent **les mêmes
noms exportés** (SURFACE, TEXT, PRIMARY_PILL, Card, PrimaryPill, StatusPill…)
mais prennent les valeurs Figma. Les 73 écrans changent de langue sans être
touchés ; on ne réécrit à la main que ce qui est codé en dur dans les écrans.

| Jeton | Avant | Après (Figma) |
|---|---|---|
| canvas | lilas `#ECEAF7` | blanc `#FFFFFF` (Background/Base/Default) |
| carte | `rounded-[22px]`, ring 6 % | `rounded-lg` (8), bord `#D9D9D9` |
| encart / chip off / holder | lilas `#EDEAFA` | `#F5F5F5` |
| primaire | `#1C1B22` rond h 50 | `#2C2C2C` r 8 **h 40** (small h 32) |
| secondaire | lilas rond | Neutral `#E3E3E3` + bord `#767676` ; Subtle transparent |
| danger | `#C0504D` | `#EC221F` / bord `#C00F0C` |
| tags de statut | 11 px, tons lilas | Tag Secondary **h 32, 14/600** : `#CFF7D3/#02542D`, `#FFF1C2/#682D03`, `#FDD3D0/#900B09` |
| texte | `#1B1A24 / #4A475C / #8E8BA0` | `#1E1E1E / #303030 / #757575` |
| échelle | 9 → 38 px libre | 14 · 16 · 20 · 24 · 32 |
| champ | h 48 r 16 | h 40 r 8 bord `#D9D9D9`, focus `#2C2C2C` |
| feuille basse | r 28 | r 16, bord haut |
| barre du bas | liquid glass | plate, bord haut 1 px, 5 entrées, pilule active `#F5F5F5` |

Nouveaux composants : `Button` (variant primary/neutral/subtle/danger × size),
`IconButton` (rond 44 / 36), `Chip` (Tag Toggle : filtres), `ListRow`
(ligne de liste ou de menu, min 56 px, chevron), `TYPE` (échelle nommée).

Shell : `MobileAppShell` blanc, `pb` = hauteur de barre + safe-area ;
`MobileHeader` 56 px, titre 16/600, bord bas `#D9D9D9`, bouton Retour 44 px.

Routes : `/m` (mobile) → `/m/ops` ; `/m/ops` = Opérations ; `/m/deposits` et
`/m/payments` restent valides et ouvrent Opérations sur le bon onglet ;
`/m/assistant` reprend la barre du bas.

## Phase B — Opérations

Un écran, un en-tête « Opérations », un bouton `+` (feuille : Dépôt ·
Paiement · Paiement groupé · Exporter en cours PDF), un Tag Toggle
**Dépôts n | Paiements n**, puis la liste existante (recherche, filtres,
chips, défilement infini) en mode `embedded` : sans en-tête, sans tuiles
KPI (les compteurs vivent dans les chips), sans FAB de couleur.
Lignes : logo méthode 40 · nom 16/600 · référence 14 muted · montant 20/600
à droite · tag 14 dessous. Rien ne tronque le nom : le montant passe sur sa
propre ligne si besoin.

## Phase C — Cargo (de vrais écrans mobiles)

- **Flotte** (`/m/cargo`, onglet) — en-tête « Cargo » + boutons Carte et
  Suivre (44 px) ; bande de chips par niveau d'alerte (`alertTally`) qui
  filtre ; lignes triées par gravité puis arrivée : client + n° de boîte, tag
  d'alerte, « Kribi · 11 oct. · dans 28 j », **prochaine action**
  (`nextSteps()[0]`). Pas de bouton flottant.
- **Suivre** — écran mobile propre : champ + bouton primaire h 40, résultat
  en carte (réutilise `CargoTimeline` et la logique de `DesktopCargoTrack`),
  armateurs et dernières recherches en `ListRow`. Un seul Retour.
- **Dossier** — en-tête mobile de ~120 px : n° de boîte (mono) + tag
  statut ; client · armateur · B/L ; arrivée en une ligne ; Rafraîchir + ⋯.
  Sections = les onglets existants, rendus via une rangée de **chips qui
  défile** (les 8 atteignables, l'actif ramené en vue). Corrections dans les
  composants partagés : jalons du parcours sans chevauchement (libellés
  tournés / tronqués proprement), 3D mise à l'échelle sur la **largeur
  réelle** de la scène (plus de 660 px en dur), jauges **au-dessus** de la 3D
  sur mobile, tableau des lots → lignes empilées sous `lg`.
- **Carte** (`/m/cargo/map`) — plein écran sous l'en-tête, légende en
  superposition basse, tap sur un navire → feuille basse avec ses conteneurs.
  Plus de carte-dans-une-carte.

## Phase D — Vérification

Captures des 21 écrans à 390 × 844 par `tools/audit-mobile.mjs` (mêmes
mesures qu'avant/après), `npm run type-check`, `npm run test`, `npm run
build`, puis commit + push + PR.

## Hors périmètre de cette passe (à faire ensuite, sur le même kit)

Détails dépôt / paiement / client, Taux, Analytics, Trésorerie, Support :
ils basculent visuellement avec la Phase A mais gardent leurs tailles et
couleurs codées en dur ; à reprendre écran par écran.

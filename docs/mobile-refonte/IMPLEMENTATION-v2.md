# Refonte mobile v2 — guide d'implémentation

Le propriétaire a **validé** les maquettes v2 (21/10/2026) et demandé de les
coder. Ce guide dit comment passer d'une maquette à l'écran réel, module par
module, sans rien casser.

## Les références

- **Les maquettes.** Elles sont dans `docs/mobile-refonte/maquettes-v2/`, un dossier par lot :
  - `index.html` est la source des écrans ;
  - `LISTE.md` décrit chaque écran et range chaque capacité de l'ordinateur.

  Pour obtenir les PNG : `node docs/mobile-refonte/maquettes-v2/shot.cjs docs/mobile-refonte/maquettes-v2/NN-nom/index.html /tmp/png-NN`.
- **Les règles de style** : `docs/mobile-refonte/maquettes-v2/DESIGN-v2.md`.
- **Les inventaires de la version ordinateur** (la référence fonctionnelle) : `docs/mobile-refonte/inventaire/A…F`.

## Les briques (déjà codées, `@/mobile/designKit`)

| Maquette | Composant |
|---|---|
| En-tête d'onglet (grand titre + ronds) | `TabTop`, `RoundButton` |
| En-tête de fiche / parcours (retour, titre, « 2/3 », « … ») | `ScreenTop`, `MoreButton` |
| Le chiffre du jour en carte | `HeroFigure` |
| Le chiffre sans carte (analyses, fiche) | `BigFigure` |
| Les gros boutons ronds | `ActionCircles` |
| Titre de liste + « Tout voir » | `SectionHead` |
| Ligne de liste (rond 44, nom, sous-titre, montant + tag) | `ItemRow` dans `ItemList` |
| Ronds de tête | `MethodCircle` (Alipay/WeChat/Virement/Cash), `Initials`, `IconCircle` ; dépôts : `DepositFamilyLogo` / `DepositBankLogo` (`@/mobile/components/deposits/DepositLogos`) |
| Tag de statut | `Tag` (tons du kit) |
| Groupement par jour | `DayLabel` |
| Recherche | `SearchBox` |
| Segment à filet | `BoxSegmented` ; puces de filtre : `Chip` |
| Bouton noir de 56 en bas | `Dock` + `BigButton` |
| Saisie de montant | `AmountDisplay` + `Keypad` + `applyKey` / `formatPad` / `padValue` |
| « Pour qui » en tête d'une saisie | `WhoCard` |
| Étiquette / valeur, avant → après | `KVBox` |
| Confirmation (feuille du bas) | `ConfirmSheet` |
| Menu « … » ouvert | `ActionSheet` + `useSheet()` |
| Écran de succès | `SuccessView` |
| Grille de modules | `ModuleGrid` |
| Graphiques | `BarChart`, `LineChart`, `ChartLegend`, `ShareRow`, `ChartCard` |

Il faut les réutiliser plutôt que de recréer du style. Si une brique manque,
on l'ajoute dans `wave.tsx` ou `charts.tsx`, sur les mêmes jetons. Ce qui ne
sert qu'à un module reste dans ce module.

## Les règles

1. **Refaire l'écran, pas les données.**
   - On garde les hooks, les RPC, les gardes de permission et les mutations existants.
   - On ne change pas la base, sauf si c'est indispensable. Dans ce cas, migration revue, étiquette `@mola` et `/gen-types`.
2. **Ne rien perdre.** Chaque capacité de l'écran actuel ou de la version ordinateur garde une place :
   - à l'écran ;
   - ou dans le menu « … » ;
   - ou dans une feuille.

   La colonne « où est rangée chaque capacité » des `LISTE.md` fait foi.
3. **Le client Supabase.** L'app du personnel n'utilise que `supabaseAdmin`.
4. **Le vocabulaire et les textes.**
   - Mots du métier : Dépôt, Paiement, Client, Fournisseur, Créditer, Payé, À payer, À valider, Annuler, Messages clients, Journal, Réglages.
   - Aucune phrase d'explication à l'écran.
   - Taille minimale du texte : 14 px.
5. **Une seule action principale noire par écran** (`Dock` + `BigButton`). Ce qui est rare va dans « … ».
6. **L'argent et les actions sensibles** passent par un `ConfirmSheet` avant / après, jamais par un seul tap. Après l'action, un `SuccessView` avec « Suivant » quand une file existe.
7. **Le desktop n'est pas touché.** Les routes ont une variante `desktop` qui reste telle quelle (`AdminRouteWrapper desktop={…}`).
8. **L'app native.** Les fichiers, le partage et le presse-papiers passent par les API standard du navigateur (`hq-app/src/bridge.ts` les intercepte).

## La vérification, avant de rendre un module

- `npm run type-check`, `npx eslint <fichiers touchés>`, `npm run test`, `npm run build`.
- **Capturer les écrans réels avec les données factices et les comparer aux maquettes.**
  1. Lancer le site :
     `SCREENSHOT_MOCK=1 VITE_SUPABASE_URL=https://fixture.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=fixture-key VITE_SUPABASE_PROJECT_ID=fixture npx vite --port <port> --host 127.0.0.1`
  2. Capturer :
     `ONLY=m/…,m/… OUT=/tmp/shots PORT=<port> node tools/audit-mobile.mjs`
     - `ROLE=cash_agent|receptionist|…` pour un autre rôle ;
     - les données factices sont dans `tools/adminFixtures.mjs`.
  3. Arrêter le serveur après usage.
- Le bouton à palmier en bas à gauche, sur les captures, est l'outil de développement de React Query. Il n'existe pas en production.

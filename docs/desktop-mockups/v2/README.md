# Console admin desktop — captures v2

Captures de la **vraie application** (composants, hooks et routing réels) rendue
à 1600×1000, alimentée par des fixtures synthétiques déterministes
(`tests/e2e/fixtures/consoleFixtures.ts`). Aucun backend réel n'est contacté,
aucune donnée client réelle n'apparaît.

Contexte et justification des choix : [`docs/refonte-desktop/README.md`](../../refonte-desktop/README.md).

## Clair — `light/`

| Fichier | Écran | Ce qu'il montre |
|---|---|---|
| `01-dashboard` | Poste de pilotage | La file d'attente d'abord, les KPI ensuite, flux dépôts/paiements + rail taux · Mola · raccourcis |
| `02-deposits` | Dépôts | Workbench : une seule barre de filtres, compteurs portés par les chips, tableau dense |
| `03-payments` | Paiements | Même grammaire que Dépôts, colonne RMB, export PDF et paiement groupé |
| `04-clients` | Clients | Encours, concentration top 5, colonnes monétaires triables |
| `05-treasury` | Trésorerie | Position par devise, WAC, capital immobilisé, tous les comptes |
| `06-rates` | Taux de change | Publier · simuler · historique côte à côte |
| `07-admins` | Administrateurs | Les 6 rôles filtrables, effectif par rôle |
| `08-audit-log` | Journal d'audit | Toutes les actions privilégiées, horodatées |
| `09-support` | Conversations | Console 2 panneaux (habillage à reprendre) |
| `10-assistant` | Mola | Assistant IA dans le shell |
| `11-analytics` | Analytics | ~20 rapports (habillage à reprendre) |
| `12-treasury-analysis` | Trésorerie · Analyse | Bénéfice, taux de revient, marges |
| `13-command-palette` | ⌘K | Actions + destinations + recherche live + repli sur Mola |
| `14-deposit-inspector` | Dépôts + inspecteur | **Le gain principal** : la file garde ses filtres et sa position pendant qu'on traite un dépôt |
| `15-rail-collapsed` | ⌘B | Rail réduit à 60 px |
| `16-role-ops` | Rôle `ops` | Le rail est réellement filtré : ni Trésorerie ni Administrateurs |
| `17-deposits-empty` | File vide | Un état vide dessiné, colonnes conservées |
| `18-treasury-alert` | Stock USDT négatif | Le seul état de trésorerie qui coûte de l'argent |
| `19-notifications` | Cloche | Compte exact, montants unitaires, focus restitué |

## Sombre — `dark/`

Les huit écrans reconstruits (`01` → `08`) en thème sombre.

## Régénérer

```bash
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
  npx playwright test --config=playwright.showcase.config.ts
```

# BonziniLabs

Fintech app for African importers paying Chinese suppliers, built with React + Vite + TypeScript + Supabase.

## Stack
- React + Vite + TypeScript + Tailwind CSS
- Two Supabase clients: `supabase` (client app) and `supabaseAdmin` (admin app)
- Supabase project ID: `fmhsohrgbznqmcvqktjw`

## Dev Commands
- Dev server: `npx vite --host` (runs on port 8080)
- Migrations: `npx supabase db push --linked`
- Type gen: `npx supabase gen types typescript --project-id fmhsohrgbznqmcvqktjw --schema public > src/integrations/supabase/types.ts`
- Type check: `npm run type-check`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: `npm run test`

## Verification — IMPORTANT
After making code changes: **always run `npm run type-check` to verify no TypeScript errors.**
After DB changes or before shipping: run `npm run build` to verify no build failures.
Use the `/verify` skill to run both at once.

`type-check` vise **`tsconfig.app.json`**, pas le `tsconfig.json` racine. Le
config racine est `{"files": [], "references": [...]}` : `tsc --noEmit` sans
`--build` y compile **zéro fichier** et sort 0 — la commande a longtemps
renvoyé « OK » sans rien vérifier. Ne retirez pas le `-p`.

## Cargo — modèle opérationnel (LIRE AVANT TOUT TRAVAIL CARGO)
Bonzini a **son propre bureau et son propre entrepôt à Guangzhou**. C'est Bonzini qui reçoit, enregistre et mesure les colis des clients, puis **remplit lui-même les conteneurs** (groupage). Le **transitaire** en Chine (pour MIEU3611115 : Eric, société KASSUMAYE PARTNER SARL) fait seulement le booking, le camion et la douane d'export ; il est le chargeur sur le BL. NORTON GAUSS BONZINI SARL est le destinataire au Cameroun ; les clients paient le fret à Bonzini. Le nombre de colis et leurs propriétaires se demandent à **notre entrepôt**, les factures des marchandises à **nos clients**. Détails : `docs/cargo/MODELE-OPERATIONNEL.md`.

## Critical Rules
@.claude/rules/database.md — schema, dropped tables, RLS patterns
@.claude/rules/supabase-clients.md — two-client isolation (the most common source of bugs)
@.claude/rules/security.md — permission guards, amount caps, OWASP checklist
@.claude/rules/frontend.md — landing page colors, messaging rules, hero structure

## Mola — Convention AI-native (OBLIGATOIRE pour toute nouvelle action)
« Mola » (l'assistant directeur des opérations) **découvre et exécute** les actions de la plateforme grâce à une **étiquette** posée sur chaque fonction RPC. La plateforme est **AI-native** : un agent piloté par un humain doit pouvoir atteindre **toutes** les actions, dans les limites des droits de la personne.

**Règle non négociable : toute nouvelle action (RPC) ajoutée DOIT porter une étiquette `@mola`** — sinon Mola ne la verra pas. Dans la **même migration** que la RPC :
```sql
comment on function public.<nom>(<types>) is
  '@mola:{"expose":true,"kind":"write","permission":"<canX>","confirm":true,"danger":false,"label":"<libellé humain>","resolve":{"<param>":"deposit|payment|client"}}';
```
- `expose` : `true` = découvrable/utilisable par Mola ; `false` = action interne/sensible, **jamais** exposée (mets-le quand même, pour documenter le choix).
- `permission` : clé de rôle requise — `canProcessDeposits` · `canProcessPayments` · `canViewTreasury` · `canManageRates` · `canEditClients` · `canManageUsers` · `canViewClients` · `canViewDeposits` · `canViewPayments` · `canViewLogs`.
- `confirm` / `danger` : carte de confirmation (toujours pour l'argent / le sensible).
- `resolve` : pour donner une **référence** (`BZ-DP-…`) au lieu d'un UUID — types: `deposit`, `payment`, `client`.
- `tool` (optionnel) : si un **outil dédié riche** existe déjà dans l'edge function, mets son nom → Mola l'utilise au lieu du générique `do_capability`.

Après toute migration RPC : lancer `/gen-types`. Le test de parité (`eval/assistant/parity.test.ts`) signale les dérives.
Réf. : `docs/assistant-ops/refonte/` (16, 17, 19) + migrations `*_mola_capability_*`.

## App mobile du personnel — BONZINI HQ (`hq-app/`)
App Expo (Android + iOS, interne) qui affiche les écrans du site dans une WebView : **une connexion** (`/m/login`), puis `staffHomeFor(role)` (`src/lib/staffHome.ts`) envoie chacun vers `/m`, `/a`, `/r` ou `/w`. Dans l'app, `isNativeApp()` (`src/lib/nativeApp.ts`) masque Google et les clés d'accès et montre le mot de passe. Téléchargements, partage et presse-papiers passent par les API standard du navigateur : l'app les intercepte (`hq-app/src/bridge.ts`) — ne pas les contourner. Guide : `docs/APP_MOBILE_BONZINI_HQ.md`. `hq-app/` est exclu d'ESLint et de Vitest ; il a son propre `npm run typecheck`.

## Design Rule — ALWAYS APPLY
Whenever building or modifying any UI (components, pages, screens, modals, forms, layouts), **always invoke the `/frontend-design` skill first** to apply the design thinking framework before writing any code. This ensures every screen is distinctive, production-grade, and avoids generic AI aesthetics.

## Available Skills (Slash Commands)
- `/frontend-design` — design thinking + production-grade UI (invoke before any UI work)
- `/verify` — run type-check + build (use after every session)
- `/migrate` — push Supabase migrations to production
- `/gen-types` — regenerate TypeScript types from Supabase schema
- `/fix-issue <number>` — fix a GitHub issue end-to-end (read → implement → PR)
- `/simplify` — parallel code quality review (reuse, dead code, efficiency)

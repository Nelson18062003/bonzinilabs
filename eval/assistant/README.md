# Eval de l'assistant « Mola » (Lot 1)

Harnais de **non-régression** + **mesure de coût**. Conception : `docs/assistant-ops/refonte/06-EVAL-ET-COUT.md`.

## Fichiers
| Fichier | Rôle | Où ça tourne |
|---|---|---|
| `grade.ts` | grader **pur** (notation : outils, params, texte, refus) + types | partout |
| `grade.test.ts` | tests du grader | **ici** (`npm run test` / vitest) ✅ |
| `cases.ts` | jeu d'eval (graine + placeholders pour tes vraies questions) | runner |
| `run.ts` | rejeu **live** contre la fonction déployée + notation + coût | **déploiement/CI** (Deno) |

## Vérifier le grader (ici, sans rien déployer)
```bash
npm run test -- eval/assistant/grade.test.ts
# ou : npx vitest run eval/assistant/grade.test.ts
```

## Lancer l'eval live (après déploiement)
Prérequis : fonction `admin-assistant` déployée + des **admins de test** (un par rôle).
```bash
export SUPABASE_URL=https://fmhsohrgbznqmcvqktjw.supabase.co
export SUPABASE_ANON_KEY=...            # clé anon
export SUPABASE_SERVICE_ROLE_KEY=...    # pour lire audit + pending_actions
export EVAL_JWTS='{"super_admin":"<jwt>","ops":"<jwt>","support":"<jwt>"}'
deno run --allow-net --allow-env eval/assistant/run.ts
```
Sortie : ✅/❌ par cas, résumé par famille, et **coût estimé du run** (lu depuis `admin_audit_logs.details.est_cost_usd`, alimenté par l'instrumentation Lot 1).

## Ajouter TES questions (le plus important)
Édite `cases.ts` → section PLACEHOLDERS. Pour chaque vraie question des derniers jours :
- `turns`: la question (ou la suite de messages) ;
- `expect`: l'outil attendu et/ou les sous-chaînes que la bonne réponse doit contenir (recoupées avec l'app = vérité terrain).

> Cible : 30-50 cas. Certains cas de la graine (bénéficiaires, masquage IBAN) **échouent volontairement** tant que les lots 2/4 ne sont pas livrés — c'est l'eval qui **pilote** le travail.

## Comment le coût est mesuré
La fonction `admin-assistant` journalise désormais, par requête, dans `admin_audit_logs.details` :
`model`, `usage` (tokens entrée/sortie/cache exacts, issus de l'API) et `est_cost_usd`
(estimation à partir d'un tarif **ordre de grandeur** ajustable dans `index.ts`). Les **comptes de tokens sont exacts** ; le **montant en $ est une estimation**.

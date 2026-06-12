# Refonte Assistant — Journal d'implémentation Lot 1 (Eval + coût)

> **Statut :** code livré sur la branche `claude/exciting-hopper-9oVZP`. Edge function **à déployer** (`supabase functions deploy admin-assistant`).
> **Date :** 2026-06-03 · **Réf. conception :** `06-EVAL-ET-COUT.md`, `07-ROADMAP.md` (Lot 1).

---

## Ce qui a été livré

### A. Instrumentation coût (dans l'edge function)
| Quoi | Où |
|---|---|
| Type `TokenUsage` + tarifs `PRICING_USD_PER_MTOK` + `estimateCostUsd()` | `index.ts` (après `MIN_PAYMENT_XAF`) |
| Capture de l'`usage` dans le stream (`message_start` → input/cache ; `message_delta` → output) | `streamAnthropic` |
| Accumulation `totalUsage` sur toute la boucle d'outils | boucle `start()` |
| Journalisation `model` + `usage` (tokens **exacts**) + `est_cost_usd` (**estimation**) | `admin_audit_logs.details` (sink existant, **pas de migration**) |

**Choix :** réutiliser `admin_audit_logs` (déjà inséré par requête) plutôt qu'une nouvelle table → plus petit, plus sûr, suffisant pour démarrer (graduable vers une table `mola_usage` si besoin). Les **comptes de tokens sont exacts** (API) ; le **$ est un ordre de grandeur** (tarifs ajustables dans `index.ts`).

### B. Harnais d'eval (`eval/assistant/`)
| Fichier | Rôle | Tourne |
|---|---|---|
| `grade.ts` | grader **pur** (outils, params, texte, refus, résumé) | partout |
| `grade.test.ts` | tests vitest du grader | CI / env dev |
| `cases.ts` | jeu d'eval graine (régressions documentées + placeholders) | runner |
| `run.ts` | rejeu **live** (SSE + lecture audit/pending_actions) + coût | **déploiement** (Deno) |
| `README.md` | comment lancer + ajouter tes questions | — |

Cas graine inclus : **régression taux personnalisé** (P0-B), honnêteté bénéficiaire (état ⚠️, échoue jusqu'au Lot 2), sécurité SQL `support` (QW-4/Lot 4), Q&A (taux, solde, top clients, pending), mémoire multi-tours (P0-A, Lot 3).

---

## Vérifications faites (ici)
- ✅ **Grader exécuté** : `grade.ts` compilé (tsc) + smoke test → **11/11 assertions OK**, dont la régression taux (PASS si proposé au taux 78 ; FAIL sur la confabulation « le taux est fixé »).
- ✅ **Edge function** : équilibre accolades/crochets **identique à HEAD** ; instrumentation revue (capture usage conforme au protocole SSE Anthropic : `message_start.usage`, `message_delta.usage`).
- ✅ **Périmètre** : aucun `src/` modifié ; uniquement l'edge function + `eval/`.
- ⚠️ **Limites sandbox** : `vitest` non installé ici (dev-deps absentes) → `grade.test.ts` tournera en **CI/local**, pas dans ce sandbox (validé autrement par le smoke test sur le code compilé). Deno absent → l'edge function et `run.ts` se vérifient au **déploiement**.

---

## À faire par toi
1. **Déployer** : `supabase functions deploy admin-assistant` (instrumentation active → chaque conversation logue tokens + coût dans `admin_audit_logs.details`).
2. **Tester le grader** (optionnel, env dev) : `npm run test -- eval/assistant/grade.test.ts`.
3. **Donner tes 15-20 vraies questions** → je les ajoute à `cases.ts` (section placeholders) pour atteindre 30-50 cas.
4. **Lancer l'eval live** (après déploiement + JWT de test par rôle) : voir `eval/assistant/README.md`.

---

## Effet
- On **mesure** désormais : tokens (exacts), coût (estimé), outils, par conversation. Fin du vol à l'aveugle.
- On a un **filet de non-régression** : la régression du taux est encodée et **verte** ; les trous à venir (bénéficiaires, masquage PII) sont encodés et **rouges** → ils pilotent les Lots 2 et 4.

*Lot 1 livré. Prochain : Lot 2 (parité — bénéficiaires CRUD + ajustements de taux + registre/test de parité) ou Lot 3 (mémoire), sur ton choix.*

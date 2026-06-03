# Refonte Assistant — Phase 7 : Roadmap d'implémentation

> **Statut :** Phase 7 / conception — clôture la conception. Ordonnance les lots vers la livraison.
> **Date :** 2026-06-03 · **Cohérence :** prolonge `PLAN-DEV.md` (build v1) ; chaque lot suit la même discipline (verify + revue sécurité sur l'écriture).
> **Légende confiance :** 🟢 vérifié · 🟡 étayé · 🔴 à confirmer.

---

## 1. Principe d'ordonnancement

1. **Mesurer avant de changer** : l'eval + l'instrumentation coût d'abord, pour que tout le reste soit prouvé.
2. **Valeur tôt, risque tard** : les trous de parité (irritant n°1) avant les chantiers lourds.
3. **Dépendances respectées** : le savoir/capacités récupérables dépendent de la mémoire.
4. **Chaque lot est livrable seul**, vérifié (`type-check` + `build` + déploiement Deno qui type-checke l'edge function), et — pour l'écriture/sécurité — passé en **revue de sécurité**.

> **Note branding :** on **ne renomme pas** l'edge function (`admin-assistant`) — la renommer casserait `FUNCTION_URL` (front) et le déploiement. **Mola** est le nom de **persona** (UI, prompt système, voix), pas l'identifiant technique. Découplage assumé.

---

## 2. Les lots

### Lot 0 — Quick-wins ✅ (fait, à déployer)
- QW-1..6 livrés (`02-QUICKWINS-LOG.md`). **Action restante : toi** → `supabase functions deploy admin-assistant` + tester les 6 scénarios.
- **DoD :** déployé, taux personnalisé OK, contexte récent retenu, SQL libre réservé super_admin.

### Lot 1 — Eval + instrumentation coût (à faire **en premier**)
- Harnais `eval:assistant` + 30-50 cas (graine = tes 15-20 vraies questions) ; table/colonnes `mola_usage` ; capture `usage` dans `streamAnthropic`.
- **Dépend de :** rien. **Risque :** nul (lecture/observation).
- **DoD :** un run produit un rapport pass/fail ; chaque conversation logue ses tokens/coût ; baseline mesurée **avant** les autres lots.

### Lot 2 — Parité du catalogue (irritant n°1)
- **Rattrapage** : outils `create_beneficiary`/`update_beneficiary`/`archive_beneficiary` + `set_rate_adjustment` (avec confirmation forte).
- **Mécanique** : `parity.manifest.ts` + test de dérive piloté par `types.ts` ; méta-outil `what_can_i_do` ; **carte des capacités** (Markdown versionné au départ, injectée/récupérée).
- **Dépend de :** Lot 1 (pour mesurer le gain). **Risque :** moyen (écriture → revue sécurité).
- **DoD :** les 3 états honnêtes testés (eval §2.3) ; test de parité casse sur un param RPC non couvert ; 2 trous comblés ; revue sécurité passée.

### Lot 3 — Mémoire en couches
- Migrations `mola_memory` (pgvector + HNSW) + `mola_user_memory` + `rolling_summary` ; embeddings **gte-small natif** ; pipeline d'assemblage + compaction ; RLS.
- **Dépend de :** Lot 1. **Risque :** moyen (nouveau stockage ; RLS à revoir).
- **DoD :** conversation > 20 msgs cohérente (eval §2.4) ; profil retenu ; compaction active ; coût mémoire mesuré ~0 (§9 Phase 4).

### Lot 4 — Sécurité & exposition par rôle
- SQL scopé (EXPLAIN + allowlist, remplace la mitigation QW-4) ; passe `maskForRole` (matrice PII §3 Phase 5) ; rétention/purge.
- **Dépend de :** rien de bloquant (peut suivre Lot 2/3). **Risque :** élevé (confidentialité) → **revue sécurité approfondie**.
- **DoD :** `support` ne lit pas la trésorerie via SQL (eval §2.5) ; IBAN masqué au LLM ; matrice validée ; purge active.

### Lot 5 — Savoir métier + self-correction
- Ontologie (statuts, taux, trésorerie, KYC) indexée en mémoire sémantique ; carte des capacités migrée vers la récupération ; étape de **vérification ciblée** (argent + chiffres) ; QW-2b (continuer si `max_tokens`).
- **Dépend de :** Lot 3 (récupération) + Lot 2 (capacités). **Risque :** moyen.
- **DoD :** « comment marche X » répondu juste (eval Lecture) ; moins d'hallucination chiffrée mesurée vs baseline (Lot 1).

---

## 3. Graphe de dépendances
```
Lot 0 (fait) ─ déployer
Lot 1 (eval+coût) ──┬── Lot 2 (parité) ──┐
                    ├── Lot 3 (mémoire) ─┼── Lot 5 (savoir + self-correction)
                    └── Lot 4 (sécurité) ┘   (dépend de 2 et 3)
```
Lot 1 débloque tout (mesure). Lots 2/3/4 parallélisables. Lot 5 en dernier (dépend de 2+3).

---

## 4. Risques & mitigations (refonte)
| Risque | Mitigation |
|---|---|
| Edge function non type-checkée ici (pas de Deno) | type-check Deno **au déploiement** (`functions deploy`) + revue + tests eval |
| Régression mémoire (RLS, fuite inter-admin) | RLS testée ; cas eval sécurité ; revue |
| Coût qui dérape (Opus, gros SQL) | instrumentation Lot 1 + alertes + routing mesuré |
| Trou de parité rouvert par une migration | test de dérive (Lot 2) en CI |
| Masquage PII incomplet | passe centrale `maskForRole` + matrice validée + cas eval |
| Sur-ingénierie progressive | calibrage §10 de chaque phase (pas de vector DB, pas de multi-agent, pas de MCP infra) |

---

## 5. Discipline de vérification (chaque lot)
1. `npm run type-check` (app) + `npm run build` (app).
2. `supabase functions deploy admin-assistant` (type-check Deno réel).
3. `npm run eval:assistant` (non-régression) + comparaison coût vs baseline.
4. **Revue de sécurité** pour Lots 2, 4 (écriture/confidentialité).
5. `/gen-types` après toute migration RPC (sinon le test de parité ment).

---

## 6. Ce qui reste décidé par toi (récap des décisions ouvertes, toutes phases)
- **Eval :** 15-20 vraies questions des derniers jours (graine du set).
- **Sécurité :** valider la matrice PII §3 (Phase 5) ; durée de rétention ; IBAN masqué même super_admin.
- **Parité :** permissions de `create_beneficiary` et `set_rate_adjustment`.
- **Mémoire :** seuils N/k/compaction/expiry ; gte-small seul ou Voyage sur le non-sensible.
- **Modèle :** quels cas « durs » déclenchent l'escalade Opus (à mesurer, Lot 1).

Aucune n'est bloquante pour démarrer **Lot 1** (eval + coût), qui ne dépend d'aucune.

---

## 7. Synthèse de la refonte (les 7 phases)
| Phase | Livrable | Tue |
|---|---|---|
| 0 Diagnostic | l'agent est réel, pas un chatbot ; causes racines ; faille SQL | — |
| 1 Cible + QW | Mola, architecture, quick-wins, stack datée | P0-A/P1 (QW), oriente tout |
| 2 (QW code) | QW-1..6 livrés | P0-A, P0-B (taux), P1, faille SQL (mitig.) |
| 3 Catalogue parité | registre testé + introspection + extension sûre | P0-B, P2-C |
| 4 Mémoire | pgvector, compaction, gte-small natif | P0-A, P1-B, P2-A |
| 5 Sécurité | SQL par rôle, masquage PII, rétention | faille §6, exposition |
| 6 Eval + coût | régression mesurable + instrumentation | « mieux indécidable » |
| 7 Roadmap | lots ordonnancés vers la livraison | — |

**De « chatbot bridé » ressenti à « collaborateur mesurable » : la refonte n'invente pas un agent (il existait) — elle répare ses fractures (mémoire, parité, savoir), ferme sa fuite (confidentialité), et le rend pilotable (eval + coût). Sans magie : ce qui est faisable est livré, l'auto-codegen non supervisé et l'usine multi-agent sont écartés, et chaque décision porte un coût.**

*Fin de la conception. Place à l'implémentation (Lot 1 d'abord), sur ton feu vert.*

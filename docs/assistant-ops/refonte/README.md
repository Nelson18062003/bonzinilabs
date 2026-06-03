# Refonte de l'Assistant → « Mola », directeur des opérations IA

Refonte de fond du module Assistant de Bonzini. **Diagnostic + conception**, une phase à la fois, tout ancré dans le code réel (`fichier:ligne`), tout daté, chaque affirmation marquée 🟢 vérifié / 🟡 étayé / 🔴 à confirmer.

> **Le contre-pied du brief :** l'Assistant actuel **n'est pas** un chatbot RAG — c'est un **agent réel** (boucle ReAct, 62 outils, Sonnet 4.6) avec **trois fractures** : mémoire câblée à l'envers, outils en sous-parité avec la plateforme, et zéro couche de savoir/mémoire long-terme. La refonte **répare et étend**, elle ne réécrit pas.

## Les documents (dans l'ordre)
| # | Doc | Contenu |
|---|---|---|
| 00 | [`00-DIAGNOSTIC.md`](./00-DIAGNOSTIC.md) | Autopsie : l'agent est réel ; 6 hypothèses jugées sur pièces ; causes P0/P1/P2 ; faille SQL ; cas du taux personnalisé tracé de bout en bout |
| 01 | [`01-CIBLE-ET-QUICKWINS.md`](./01-CIBLE-ET-QUICKWINS.md) | **Mola** : identité, architecture cible, reco stack datée, coût, et les quick-wins isolés |
| 02 | [`02-QUICKWINS-LOG.md`](./02-QUICKWINS-LOG.md) | Journal d'implémentation des quick-wins QW-1..6 (livrés sur la branche) |
| 03 | [`03-CATALOGUE-PARITE.md`](./03-CATALOGUE-PARITE.md) | Catalogue à parité garantie (registre testé via `types.ts`), introspection (3 états honnêtes), extension sûre |
| 04 | [`04-MEMOIRE.md`](./04-MEMOIRE.md) | Mémoire en couches (pgvector, compaction, **gte-small natif** → confidentialité) |
| 05 | [`05-SECURITE-EXPOSITION.md`](./05-SECURITE-EXPOSITION.md) | SQL scopé par rôle (EXPLAIN+allowlist), matrice PII, masquage avant LLM, rétention |
| 06 | [`06-EVAL-ET-COUT.md`](./06-EVAL-ET-COUT.md) | Jeu d'eval (régression) + instrumentation coût/tokens |
| 07 | [`07-ROADMAP.md`](./07-ROADMAP.md) | Lots ordonnancés (Lot 1 = eval/coût d'abord), dépendances, DoD |

## Documents v1 (hérités, à côté)
- [`../CONCEPTION.md`](../CONCEPTION.md) · [`../PLAN-DEV.md`](../PLAN-DEV.md) — le design/build initial de l'agent (livré). La refonte les prolonge.
- [`../../audit-fondation-mobile-assistant.md`](../../audit-fondation-mobile-assistant.md) — **axe différent** : la plomberie mobile (viewport/clavier) de l'écran, pas le cerveau.

## État
- ✅ Conception complète (phases 0→7).
- ✅ Quick-wins QW-1..6 codés et vérifiés sur la branche — **à déployer** (`supabase functions deploy admin-assistant`).
- ⏭️ Implémentation : **Lot 1 (eval + coût) d'abord**, sur feu vert.

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
| 08 | [`08-LOT1-LOG.md`](./08-LOT1-LOG.md) | Journal Lot 1 : instrumentation coût (edge) + harnais d'eval (`eval/assistant/`) |
| 09 | [`09-LOT2-LOG.md`](./09-LOT2-LOG.md) | Journal Lot 2 : 4 outils de parité + introspection `what_can_i_do` + registre/test de dérive |
| 10 | [`10-LOT3-LOG.md`](./10-LOT3-LOG.md) | Journal Lot 3 : mémoire en couches (migration pgvector + profil + compaction + `remember`) |
| 11 | [`11-LOT4a-MASQUAGE-LOG.md`](./11-LOT4a-MASQUAGE-LOG.md) | Journal Lot 4a : masquage PII (comptes/IBAN/tél/email) avant LLM, vérifié 9/9 |
| 12 | [`12-LOT4b-LOT5-LOG.md`](./12-LOT4b-LOT5-LOG.md) | Journal Lots 4b+5 : SQL scopé par rôle (EXPLAIN) + savoir métier + self-correction + QW-2b |
| 13 | [`13-FINALISATION-LOG.md`](./13-FINALISATION-LOG.md) | Finalisation : parité **catalogue complet** (19/19) + rétention + eval élargi |
| 14 | [`14-AI-NATIVE-DIAGNOSTIC-DESIGN.md`](./14-AI-NATIVE-DIAGNOSTIC-DESIGN.md) | **Le vrai plafond** : Mola atteint ~44% des actions de la plateforme → conception de l'auto-génération du catalogue (AI-native) |
| 15 | [`15-MCP-DEEP-DIVE.md`](./15-MCP-DEEP-DIVE.md) | **MCP en profondeur** + verdict honnête : destination oui (faisable sur edge via mcp-lite), mais la couche de capacités d'abord ; sécurité fintech |
| 16 | [`16-POC-DECOUVERTE-CAPACITES.md`](./16-POC-DECOUVERTE-CAPACITES.md) | **PoC réel** : étiquette `@mola` sur les RPC + `find_capability`/`do_capability` → Mola découvre et exécute une action SANS outil écrit à la main |

## Documents v1 (hérités, à côté)
- [`../CONCEPTION.md`](../CONCEPTION.md) · [`../PLAN-DEV.md`](../PLAN-DEV.md) — le design/build initial de l'agent (livré). La refonte les prolonge.
- [`../../audit-fondation-mobile-assistant.md`](../../audit-fondation-mobile-assistant.md) — **axe différent** : la plomberie mobile (viewport/clavier) de l'écran, pas le cerveau.

## État
- ✅ Conception complète (phases 0→7).
- ✅ Quick-wins QW-1..6 codés et vérifiés sur la branche — **à déployer** (`supabase functions deploy admin-assistant`).
- ✅ **Lot 1 livré** : instrumentation coût (edge) + harnais d'eval (`eval/assistant/`, grader vérifié 11/11).
- ✅ **Lot 2 livré** : 4 outils de parité (bénéficiaires CRUD + ajustement de taux) + introspection `what_can_i_do` + registre/test de dérive (0 dérive, a attrapé 2 vrais écarts). 67 outils.
- ✅ **Lot 3 livré** : mémoire en couches (migration `mola_memory`/`mola_user_memory` pgvector + profil + compaction + outil `remember`), best-effort. 68 outils. **Migration à appliquer** (`npx supabase db push --linked`).
- ✅ **Lot 4a livré** : masquage PII (comptes/IBAN/tél/email) avant le LLM (`_shared/mask.ts`, vérifié 9/9).
- ✅ **Lot 4b livré** : SQL libre **scopé par rôle** (EXPLAIN + allowlist, fail-closed) — remplace la mitigation QW-4.
- ✅ **Lot 5 livré** : savoir métier (socle prompt + ontologie indexable `reindex_knowledge`) + self-correction + QW-2b. **69 outils.**
- ✅ **Finalisation** : parité étendue à **tout le catalogue d'écriture (19/19 outils RPC, 0 dérive)** — a comblé un vrai trou (`update_payment_beneficiary`) + rétention (purge 180 j) + eval élargi (~16 cas).
- 🎯 **REFONTE TERMINÉE côté code** (4 migrations, harnais d'eval vérifié 11/11 + 9/9 + 19/19). Reste **uniquement** : **déployer + tester + brancher tes vraies questions + valider matrice PII/rétention.**

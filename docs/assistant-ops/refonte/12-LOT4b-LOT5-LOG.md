# Refonte Assistant — Journal Lots 4b + 5 (SQL scopé + Savoir & self-correction)

> **Statut :** code + migration livrés sur la branche. À appliquer/déployer par toi.
> **Date :** 2026-06-03 · **Réf. :** `05-SECURITE-EXPOSITION.md` §2, `03-CATALOGUE-PARITE.md` §4.4, `07-ROADMAP.md` (Lots 4-5).

---

## Lot 4b — SQL libre SCOPÉ par rôle (remplace la mitigation QW-4)
- **Migration `20260603130000_assistant_query_scoped.sql`** : `assistant_readonly_query(p_sql, p_allowed_tables)`. Quand `p_allowed_tables` est fourni, la fonction fait `EXPLAIN (FORMAT JSON)` de la requête, extrait **toutes** les relations accédées (jsonpath `$.**."Relation Name"`, jointures/sous-requêtes comprises) et **refuse** si une table sort de l'allowlist. **Fail-closed** (EXPLAIN qui échoue → refus). `p_allowed_tables = NULL` (super_admin) → accès complet.
- **Edge function** : `allowedTablesForRole(perms)` (mappe permission→tables, miroir §2.2) ; `query_database` **n'est plus** super_admin-only → `ops`/`support` retrouvent le SQL libre **sur leur périmètre** ; l'allowlist du rôle est injectée à l'appel pour tout rôle ≠ super_admin.
- **Effet** : la segmentation par rôle est rétablie **sans** tout interdire. `support` ne peut toujours pas lire la trésorerie en SQL ; `ops` peut interroger ses paiements/dépôts.

## Lot 5 — Savoir métier + self-correction
- **Socle de connaissance** (prompt système, ~6 lignes, **caché**, marche SANS embeddings) : cycles dépôt/paiement, modèle de taux, chaîne trésorerie XAF→USDT→CNY/WAC, wallet. → tue P0-C (« je ne sais pas ») immédiatement.
- **Ontologie détaillée** (`BUSINESS_ONTOLOGY`) + outil **`reindex_knowledge`** (super_admin) : embeded (gte-small) → `mola_memory` sémantique global → **récupéré just-in-time** (profondeur, en plus du socle).
- **Self-correction** : règle de prompt « vérifie-toi sur l'argent et les chiffres avant de proposer / d'affirmer un total ».
- **QW-2b** (différé du Lot 0) : si une réponse est tronquée (`stop_reason=max_tokens`), la boucle **poursuit** la génération au lieu de couper (accumulation du texte). → complète P1-A.

---

## Vérifié (ici)
- ✅ Edge function : équilibre **identique à HEAD** ; **69 outils** (44 lecture + 25 écriture) ; marqueurs 4b/5 présents.
- ✅ Migration : DDL revue (DROP+CREATE, EXPLAIN+jsonpath, fail-closed, read-only TX conservée).
- ⚠️ **Non testable ici** : EXPLAIN/jsonpath (plpgsql), embeddings, runtime edge. Code **revu + fail-closed/best-effort**. **Validation = déploiement.**

## À faire par toi (à la fin, comme prévu)
1. `npx supabase db push --linked` (migrations Lot 3 + Lot 4b) + `/gen-types`.
2. `supabase functions deploy admin-assistant`.
3. **Une fois** : demander à Mola (en super_admin) « réindexe le savoir » → outil `reindex_knowledge`.
4. Tester : 
   - `support` : « soldes trésorerie en SQL » → refus scopé ; `ops` : « mes paiements de mai en SQL » → OK.
   - « que se passe-t-il quand je valide un dépôt ? » → réponse juste (socle), pas de « je ne sais pas ».
   - réponse longue (liste) → non tronquée (QW-2b).

---

## État de la refonte (récap)
Tous les lots de la roadmap sont **codés** : QW-1→6, Lot 1 (eval+coût), Lot 2 (parité+introspection), Lot 3 (mémoire), Lot 4a (masquage PII), Lot 4b (SQL scopé), Lot 5 (savoir+self-correction). **Reste : déployer + valider + brancher tes vraies questions dans l'eval.**

*Lots 4b + 5 livrés. La roadmap d'implémentation est complète côté code.*

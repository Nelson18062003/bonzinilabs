# Refonte Assistant — Journal d'implémentation Lot 3 (Mémoire en couches)

> **Statut :** code + **migration** livrés sur la branche. À appliquer/déployer par toi (migration NON appliquée).
> **Date :** 2026-06-03 · **Réf. conception :** `04-MEMOIRE.md`, `07-ROADMAP.md` (Lot 3).
> **Principe :** TOUTE la mémoire est **best-effort** — si l'embedding est indisponible, l'assistant fonctionne normalement (mémoire dégradée, jamais cassée).

---

## Ce qui a été livré

### A. Migration `20260603120000_mola_memory.sql`
- `mola_memory` (vectorisé) : `kind` ∈ semantic/episodic, `admin_user_id` (NULL = global), `content`, `embedding vector(384)`, `expires_at` + index **HNSW** cosinus + RLS (lecture : propre à l'admin OU global sémantique).
- `mola_user_memory` (profil/préférences, **non** vectorisé) : (admin, key) → value jsonb + RLS owner.
- `assistant_conversations` : colonnes `rolling_summary` + `summary_through` (compaction).
- RPC `mola_search_memory(p_embedding, p_admin, p_kinds, p_limit)` : top-k cosinus **scopé** (global + propre à l'admin), SECURITY DEFINER.

### B. Edge function (best-effort)
| Pièce | Rôle |
|---|---|
| `embedText()` | embeddings **gte-small** dans l'edge runtime (`Supabase.ai`) → **rien ne sort de l'infra**. Renvoie `null` si indisponible. |
| `buildMemoryContext()` | assemble le bloc MÉMOIRE : **profil** (toujours) + **résumé roulant** + **souvenirs récupérés** (vectoriel, best-effort) → injecté comme 2ᵉ bloc `system` (non caché). |
| `maybeCompact()` | conversation longue (>30 msgs, throttle 1/8) → résume les anciens messages (appel bon marché) → `rolling_summary` + **épisodique embeddé** (rappelable dans les futures conversations). |
| outil `remember` | écrit une préférence/fait durable dans `mola_user_memory` (carte « Mémoriser »). Déclenché par « retiens que… ». |
| prompt | bloc MÉMOIRE expliqué + consigne « ne mémorise pas de données sensibles (soldes, comptes) : elles se lisent en direct ». |

---

## Comment ça tue les symptômes
- **P0-A (perd le contexte)** : QW-1 (récents en ordre) **+ résumé roulant** (compaction §A/B) → conversations longues tenues.
- **P2-A (n'apprend pas)** : profil (`remember` + auto) + épisodique = **substrat d'apprentissage** qui n'existait pas.
- **Confidentialité** : embeddings **natifs** (gte-small) → aucun texte exfiltré ; RLS ; expiry épisodique 90 j ; pas de PII en mémoire longue (consigne prompt).

---

## Vérifications faites (ici)
- ✅ **Edge function** : équilibre accolades/crochets **identique à HEAD** ; **25 outils d'écriture** (avec remember) ; helpers mémoire présents.
- ✅ **Migration** : DDL revue (pgvector, HNSW, RLS, RPC scopé).
- ⚠️ **Limites sandbox (importantes)** : **impossible de tester ici** — pas de Deno, pas de `Supabase.ai` (gte-small n'existe qu'au runtime Supabase déployé), pas de pgvector. Le code mémoire est **revu** et **défensif** (chaque opération en try-catch → ne peut pas casser le flux). **Validation réelle = au déploiement.**

---

## À faire par toi (ordre)
1. **Migration** : `npx supabase db push --linked` (crée tables + RPC + pgvector).
2. **Types** : `npx supabase gen types ... > src/integrations/supabase/types.ts` (`/gen-types`) — pour que le test de parité reste juste.
3. **Déployer** : `supabase functions deploy admin-assistant`.
4. **Tester** :
   - « retiens que je préfère les réponses courtes » → carte Mémoriser → confirme. Nouvelle conversation : Mola en tient compte.
   - Conversation longue (>30 messages) : le fil reste cohérent (résumé roulant).
   - Si l'embedding échoue (logs) : l'assistant répond quand même (profil + résumé marchent sans vecteurs).

---

## Portée / suite
- **Semantique GLOBAL (savoir métier)** : la table existe ; son **indexation** (ontologie statuts/taux/trésorerie, carte des capacités) = **Lot 5** (savoir + self-correction).
- **Restent** : Lot 4 (sécurité/exposition par rôle : SQL scopé, masquage PII, rétention), Lot 5 (savoir + vérification).

*Lot 3 livré (code + migration). Foundation mémoire posée, best-effort, à valider au déploiement.*

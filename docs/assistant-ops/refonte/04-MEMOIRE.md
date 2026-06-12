# Refonte Assistant — Phase 4 : Mémoire en couches

> **Statut :** Phase 4 / conception (deep-dive du sous-système §4.2 de `01-CIBLE-ET-QUICKWINS.md`).
> **Date :** 2026-06-03 · **Prérequis :** `00-DIAGNOSTIC.md` (P0-A, P1-B, P2-A), `03-CATALOGUE-PARITE.md` (la carte des capacités est servie par la mémoire sémantique).
> **Légende confiance :** 🟢 vérifié · 🟡 étayé · 🔴 à confirmer.

---

## 1. La distinction cardinale (que la v1 confond)

> **Une fenêtre de contexte de 200 000 tokens n'est PAS une mémoire.**

| | Fenêtre de contexte | Mémoire |
|---|---|---|
| Nature | volatile, reconstruite à chaque requête | persistante, indexée |
| Coût | tokens d'entrée à chaque appel | écriture une fois, lecture ciblée |
| Borne | dure (limite modèle) | pratiquement illimitée |
| Accès | tout-ou-rien | récupération *just-in-time* (top-k) |

La v1 traite la fenêtre comme si c'était la mémoire — et la remplit **mal** (les 20 messages les plus anciens, P0-A). Mola sépare proprement **quatre couches**, chacune avec son rôle, son stockage, son écriture et sa lecture.

---

## 2. Les quatre couches

| Couche | Contenu | Stockage | Écrit quand | Lu comment | Tue |
|---|---|---|---|---|---|
| **Working** (fenêtre) | tour courant + N derniers messages **en ordre** + résumé roulant + chunks récupérés | reconstruit/requête | — | assemblage (§4) | P0-A, P1-B |
| **Épisodique** | résumés des conversations passées de cet admin | `mola_memory(kind='episodic')` | fin de conv / seuil | top-k vectoriel (filtré admin) | P2-A |
| **Sémantique** | savoir métier + carte des capacités + faits stables | `mola_memory(kind='semantic')` | indexation des docs / déclaration | top-k vectoriel (global) | P0-C, sert §3 catalogue |
| **Profil** | préférences, contreparties habituelles, macros apprises | `mola_user_memory` | déclaration / inférence | chargé par session (petit) | P2-A |

---

## 3. Schéma (DDL — esquisse)

```sql
create extension if not exists vector;  -- pgvector (natif Supabase) 🟢

-- Mémoire vectorisée : sémantique (savoir/capacités) + épisodique (résumés de conv)
create table public.mola_memory (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('semantic','episodic')),
  admin_user_id uuid references auth.users(id) on delete cascade, -- NULL = savoir GLOBAL partagé
  scope         text,            -- 'capability:paiements' | 'glossaire' | 'conversation:<id>' ...
  content       text not null,   -- le texte indexé (fait / capacité / résumé)
  embedding     vector(384),     -- gte-small (natif Supabase, 384 dim)
  source        text,            -- doc repo / conversation / déclaration admin
  created_at    timestamptz not null default now(),
  expires_at    timestamptz      -- épisodique borné ; sémantique permanent (NULL)
);
create index on public.mola_memory using hnsw (embedding vector_cosine_ops);
create index on public.mola_memory (admin_user_id, kind, scope);

-- Profil / préférences / macros (structuré, NON vectorisé)
create table public.mola_user_memory (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  key           text not null,   -- 'pref:langue' | 'contrepartie_habituelle:usdt' | 'macro:onboarding'
  value         jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (admin_user_id, key)
);

-- Compaction : résumé roulant par conversation
alter table public.assistant_conversations add column if not exists rolling_summary text;
alter table public.assistant_conversations add column if not exists summary_through timestamptz;
```

**RLS (obligatoire — données financières) :** sur `mola_memory`, un admin lit ses lignes (`admin_user_id = auth.uid()`) **+** les lignes globales (`admin_user_id is null` ET `kind='semantic'`). Sur `mola_user_memory`, strictement ses lignes. Les écritures passent par l'edge function (service role). Politique miroir de `assistant_conversations` (migration `…120000`, correcte). 🟢

---

## 4. Le pipeline d'assemblage du contexte (le « context engineering »)

À chaque requête, Mola **construit** sa fenêtre, dans cet ordre de priorité (et l'évince par le bas si le budget est dépassé) :

```
1. [CACHÉ] système + définitions d'outils                         (préfixe stable, prompt caching)
2. Profil utilisateur (mola_user_memory)                          (petit, toujours inclus)
3. Chunks SÉMANTIQUES récupérés (top-k≈5) : savoir + capacités    (just-in-time, pertinents à la question)
4. Chunks ÉPISODIQUES récupérés (top-k≈3) : conv passées de l'admin
5. Résumé roulant de la conversation courante (compaction)        (remplace le verbatim ancien)
6. N derniers messages EN ORDRE (≈12-20)                          (QW-1 : récents + chronologiques)
7. Message courant + note pièces jointes
```

**Récupération (étapes 3-4) :** on embeue le message courant avec **gte-small** (dans l'edge function, §5), puis une fonction Postgres fait le `ORDER BY embedding <=> query_embedding LIMIT k` sur `mola_memory` (filtré par `kind` et visibilité). C'est le RAG *just-in-time* : on n'injecte que le pertinent, puis on l'évince — **budget d'attention maîtrisé**, l'inverse d'un gros bloc figé.

**Budget :** chaque section a un plafond de tokens. Priorité décroissante 1→7 ; si dépassement, on compacte d'abord le verbatim ancien (→ §4.bis), puis on réduit k. Le système + outils restant cachés, le surcoût des tours suivants reste faible.

### 4.bis Compaction (le vrai remède à P0-A, au-delà du quick-win)
Quand les messages en fenêtre dépassent un seuil (≈20), on **résume la moitié la plus ancienne** en 1 appel modèle **bon marché** (Haiku/Sonnet), on écrit ce résumé dans `rolling_summary`, et on **retire le verbatim de la fenêtre** (il reste en base pour l'audit). Résultat : conversations **longues** sans explosion de coût ni perte du fil. QW-1 corrige l'ordre ; la compaction corrige l'**échelle**.

---

## 5. Décision embeddings (vérifiée, datée, orientée confidentialité)

Claude **ne fait pas d'embeddings** (texte + images uniquement — déjà noté CONCEPTION §6). Il faut donc un encodeur. Deux options, tranchées :

| Option | Fait (3 juin 2026) | Confidentialité | Coût | Verdict |
|---|---|---|---|---|
| **Supabase `gte-small` natif** | Tourne **dans l'Edge Runtime** (depuis v1.36.0) via `Supabase.ai.Session`, **sans API externe** ; 384 dim ; MTEB ~61.4 (vs OpenAI 3-small 62.3) | **Le texte ne quitte JAMAIS l'infra** | **0 $** vendeur | ✅ **DÉFAUT** |
| **Voyage `voyage-3-large`** | Recommandé par Anthropic, optimisé Claude, MTEB 65.4 ; 200M tokens gratuits puis 0,18 $/M | Le texte **part chez Voyage** (tiers) | quasi nul à ce volume | 🔁 **upgrade** si qualité insuffisante, **et seulement sur du non-sensible** |

**Recommandation (🟢) :** **gte-small natif par défaut.** Pour une fintech, l'argument décisif n'est pas la qualité (1 point de MTEB) mais la **confidentialité** : avec gte-small, **rien ne sort de Supabase** ; avec Voyage/OpenAI, chaque texte embeué est **exfiltré**. Donc : gte-small pour tout ce qui touche PII/finance ; Voyage réservé, *si besoin*, aux **documents de savoir non sensibles** (glossaire, carte des capacités).

Sources : [Supabase — AI inference in Edge Functions](https://supabase.com/blog/ai-inference-now-available-in-supabase-edge-functions) · [Supabase — Generate embeddings](https://supabase.com/docs/guides/ai/quickstarts/generate-text-embeddings) · [Voyage pricing](https://docs.voyageai.com/docs/pricing) · [Anthropic cookbook — Voyage embeddings](https://github.com/anthropics/claude-cookbooks/blob/main/third_party/VoyageAI/how_to_create_embeddings.md)

---

## 6. Discipline d'écriture mémoire + confidentialité (concret)

**Ce qu'on mémorise (et où) :**
- **Sémantique global** (partagé, sans PII) : glossaire métier, cycles de statuts, **carte des capacités** (§3 catalogue). Indexé depuis les docs `docs/` à chaque évolution.
- **Profil** (`mola_user_memory`, par admin) : « répond en français », « le fournisseur USDT habituel est Lizette », macros. Écrit sur **déclaration explicite** (« retiens que… ») ou **inférence prudente** (jamais un montant ; des préférences/habitudes stables).
- **Épisodique** (par admin, RLS, **avec expiry**) : résumé d'une conversation (« le 2 juin, validé le dépôt de Jonas, créé un paiement Alipay »). 

**Ce qu'on NE met PAS en mémoire longue :** soldes bruts, numéros de compte, PII détaillée. La mémoire stocke des **faits stables et des résumés**, pas un miroir de la base (qui, lui, se lit *en direct* via les outils — toujours à jour). *(Règle d'exposition détaillée par rôle : Phase sécurité.)*

**Anti-fuite :** embeddings **natifs** (gte-small) → aucun texte sensible exfiltré pour l'indexation. Expiry sur l'épisodique. RLS stricte. C'est la réponse concrète à « confidentialité financière », côté mémoire.

---

## 7. « Il apprend » — la version honnête (anti-hype)

Mola **ne se ré-entraîne pas** (pas de fine-tuning). Son « apprentissage » = **accumulation + récupération de mémoire** :
- il **retient** tes préférences, tes contreparties, tes décisions (profil + épisodique) ;
- il **accumule** le savoir métier et la carte des capacités (sémantique) ;
- il **journalise ses trous** (gap-log, §5 catalogue) et **compose** des macros.

Effet ressenti : il **te connaît** et s'améliore avec l'usage — **sans** entraînement. Ce qu'il **ne** fera **pas** : devenir plus intelligent en raisonnement (ça dépend du modèle, pas de la mémoire). La mémoire améliore son **contexte**, pas son **QI**. Le dire clairement évite la déception.

---

## 8. Comment ces couches tuent les symptômes
| Symptôme | Mécanisme |
|---|---|
| Perd le contexte dans une conv (P0-A) | Working : N récents **en ordre** (QW-1) **+ résumé roulant** (compaction §4.bis) |
| Perd les données d'un tour à l'autre (P1-B) | Les résultats d'outils clés sont **résumés** dans le working/épisodique, pas jetés |
| N'apprend pas (P2-A) | Profil + épisodique + sémantique = **substrat d'apprentissage** qui n'existait pas |
| Ne sait pas / invente (P0-C) | Sémantique = savoir métier **récupéré just-in-time** (sert aussi l'introspection §3) |

---

## 9. Coût (ordre de grandeur, 🟡 à instrumenter)
- **Embeddings gte-small natif** : compute dans l'edge, **0 $ vendeur**, négligeable.
- **pgvector / stockage** : dans le Postgres déjà payé, **~0 $ marginal** à ce volume.
- **Compaction** : ~1 appel résumé bon marché / ~10 messages → fondu dans le ~1-4 ¢/conv.
- **Si Voyage** (optionnel, non sensible) : 200M tokens gratuits → **~0 $** avant longtemps.
- **Total mémoire : ~0-5 $/mois.** 🟡 Le bon design (natif + dans Supabase) rend la mémoire quasi gratuite — c'est tout l'intérêt du calibrage Phase 2.

---

## 10. Ce qu'on NE fait pas (calibrage)
- ❌ Base vectorielle tierce (Pinecone/Weaviate) — pgvector suffit.
- ❌ EmbeUer **chaque** message — on n'indexe que faits durables, résumés, savoir.
- ❌ Embeddings externes pour la PII — natif uniquement.
- ❌ Rétention infinie de l'épisodique — expiry.
- ❌ Mémoriser un miroir de la base — les données vivantes se lisent en direct via les outils.

---

## 11. Décisions ouvertes
- 🔴 Seuils : N (fenêtre, ≈12-20 ?), seuil de compaction (≈20 ?), k récupération (≈5 sém / 3 épis ?), expiry épisodique (≈90 j ?).
- 🔴 Déclenchement de l'épisodique : à la fin de conv (inactivité) ou à seuil de messages ?
- 🔴 gte-small (384) suffit-il sur le jargon fintech FR, ou faut-il Voyage sur le savoir non sensible ? → à mesurer (Phase eval).
- 🔴 Inférence des faits profil : conservatrice (déclaration explicite seulement) au départ ? *(Recommandé : oui, pour éviter de mémoriser du faux.)*

---

## 12. Prochaine étape
Restent : **Sécurité & exposition par rôle** (refermer QW-4 proprement, masquage PII table/rôle, rétention), **Eval** (le jeu de régression + l'instrumentation coût), puis la **Roadmap d'implémentation** (ordonnancement des migrations + outils + tests). À trancher avec toi.

*Fin de la Phase 4.*

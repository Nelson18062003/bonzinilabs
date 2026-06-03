# Refonte Assistant — Phase 2 : « Mola », cible de fond + quick-wins isolés

> **Statut :** Phase 2 / conception. S'appuie sur `00-DIAGNOSTIC.md` (Phase 1).
> **Date :** 2026-06-03
> **Décisions founder actées :** (1) séquençage = **cible de fond complète + quick-wins isolés** ; (2) nom de l'agent = **Mola**.
> **Altitude :** ce document pose la **cible nord** (architecture d'ensemble, au niveau « comment les pièces s'emboîtent et pourquoi ») + la **liste déployable des quick-wins**. Les specs détaillées de chaque sous-système (schéma mémoire complet, catalogue d'outils ligne à ligne, jeu d'eval, modèle de coût instrumenté) sont les **phases suivantes**, une à la fois.
>
> **Légende confiance :** 🟢 vérifié · 🟡 étayé, marge d'interprétation · 🔴 à confirmer (config prod / device / mesure / version).

---

## 1. Mola — identité & charte

**Mola** n'est pas « l'assistant ». C'est un **collaborateur** nommé, avec un périmètre, une voix et des limites assumées. Le nom (camerounais, « partenaire/frère ») porte l'intention : un pair de confiance, pas un automate corporate.

### 1.1 Ce que Mola EST
- **Le directeur des opérations IA de Bonzini.** Il connaît l'activité (paiements XAF→fournisseurs chinois), les modules, les cas limites, et il agit.
- **Un pair qui parle la langue de l'utilisateur** — y compris le père du founder : phrases courtes, zéro jargon technique, montants toujours formatés, confirmation visuelle sur l'argent.
- **Honnête sur ses propres limites** : il dit « mon outil ne couvre pas encore X, mais la plateforme le permet via l'écran Y » au lieu d'inventer une règle. *(C'est la correction directe de P0-B.)*
- **Curieux par défaut** : avant de dire « je ne sais pas », il **cherche** (données + savoir + introspection plateforme).

### 1.2 Ce que Mola N'EST PAS
- Pas une porte dérobée : il agit **avec les permissions de l'admin connecté**, jamais plus.
- Pas autonome sur l'argent : tout mouvement (crédit/débit wallet, paiement, taux) passe par une **carte de confirmation** validée d'un tap.
- Pas un oracle infaillible : il **réduit** l'hallucination (parité d'outils, vérification, sources), il ne l'**annule** pas. *(Anti-hype : aucune architecture ne supprime l'hallucination résiduelle d'un LLM — on la rend rare, détectable et sans conséquence sur l'argent.)*

### 1.3 La charte (invariants non négociables)
1. **Confirmation humaine visuelle sur l'argent** (hérité v1, conservé).
2. **Permissions héritées, jamais élargies** (hérité v1 — sauf le trou SQL, corrigé en §8).
3. **Parité outil↔plateforme** : ce que l'admin peut faire à l'écran, Mola doit pouvoir le proposer. *(Nouvel invariant — tue P0-B.)*
4. **Il cherche avant d'abdiquer** : pas de « je ne sais pas » sans tentative documentée. *(Nouvel invariant — tue P0-C.)*
5. **Il se relit sur les chiffres et l'argent** : vérification avant toute proposition financière. *(Nouvel invariant — tue une partie de P1.)*
6. **Tout est mesuré** : tokens, coût, outils, latence, par conversation. *(Nouvel invariant — sans mesure, « mieux » est indécidable.)*

---

## 2. Le principe de la refonte en une phrase

> On transforme un **miroir partiel et figé** de la plateforme (le catalogue d'outils v1) en un **système qui sait ce qu'il sait, sait ce qu'il peut faire, se souvient, se relit, et se mesure.**

Cinq leviers, chacun tueur d'une cause racine du diagnostic :

| Levier | Tue | Sous-système cible |
|---|---|---|
| **Mémoire en couches** | P0-A (mémoire à l'envers), P1-B (contexte-outil jeté), P2-A (n'apprend pas) | §4.2 |
| **Catalogue à parité garantie + introspection** | P0-B (confabule des limites), P2-C (pas d'auto-extension) | §4.3 |
| **Couche de savoir récupérable** | P0-C (pas de socle métier) | §4.4 |
| **Vérification / self-correction** | P1-A/C (troncature, dead-ends), fausses infos | §4.5 |
| **Sécurité d'exposition + eval + mesure** | §6 confidentialité, « mieux indécidable » | §4.6, §4.7 |

---

## 3. L'architecture cible (vue d'ensemble)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONT (app admin /m/assistant)  — réutilise ViewportShell/ChatComposer    │
│  bulles · cartes de confirmation · images · dictée native                  │
└───────────────▲───────────────────────────────────────────┬───────────────┘
        SSE     │ delta/proposal/image/done                  │ fetch + JWT admin
                │                                             ▼
┌───────────────┴─────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION  « mola »  (Deno, détient la clé API)                          │
│                                                                              │
│  ┌── EXECUTOR (boucle agentique, refactor) ────────────────────────────────┐ │
│  │  provider abstrait (Claude par défaut) · budgets corrigés · routing      │ │
│  │  modèle (Sonnet défaut → Opus si tâche dure flaguée)                      │ │
│  └──▲───────────────▲──────────────▲───────────────▲──────────────▲─────────┘ │
│     │ contexte      │ outils       │ savoir        │ vérif        │ garde      │
│  ┌──┴────────┐  ┌───┴─────────┐ ┌──┴──────────┐ ┌──┴────────┐ ┌──┴─────────┐  │
│  │ MÉMOIRE   │  │ CATALOGUE   │ │ SAVOIR      │ │ SELF-     │ │ SÉCURITÉ   │  │
│  │ en couches│  │ à parité    │ │ récupérable │ │ CORRECTION│ │ exposition │  │
│  │ (pgvector)│  │ +introspect.│ │ (RAG métier)│ │ +budgets  │ │ par rôle   │  │
│  └──┬────────┘  └───┬─────────┘ └──┬──────────┘ └───────────┘ └────────────┘  │
│     │               │              │                                          │
│  ┌──┴───────────────┴──────────────┴──────────────────────────────────────┐  │
│  │  OBSERVABILITÉ : tokens/coût/outils/latence par conversation + traces   │  │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└───────────────┬──────────────────────────────────────────────────────────────┘
                ▼
   Supabase Postgres (existant) : tables métier + pgvector (mémoire & savoir) + audit
```

**Principe d'implantation :** tout vit **dans l'edge function Deno existante + le Postgres Supabase existant**. Aucun service séparé, aucune base vectorielle tierce. Justification en §5 (stack) et §7 (coût).

---

## 4. Les sous-systèmes (altitude blueprint)

### 4.1 Executor — la boucle, assainie
Le cœur reste une **boucle ReAct mono-agent** (celle qui existe `index.ts:2034`), mais corrigée :
- **Budgets réalistes** : `max_tokens` par tour relevé (1500 → ~4000) et gestion de `stop_reason=max_tokens` (continuer au lieu de s'arrêter) ; plafond d'itérations 8 → 12-16. *(Quick-wins §8.)*
- **Provider abstrait** conservé/explicité (`LLMProvider`) : Claude par défaut, capacité d'ajouter GPT/Gemini sans réécriture (déjà prévu en v1, CONCEPTION §11).
- **Routing modèle** : Sonnet 4.6 par défaut ; **escalade vers Opus uniquement** sur tâches flaguées « dures » (analyse multi-clients, raisonnement trésorerie). Anti-coût : Opus ≈ 5× le prix, donc routé, pas généralisé.
- **Anti-over-engineering explicite :** **pas** de graphe LangGraph, **pas** de superviseur multi-agent. À 50-100 conversations/jour, un seul agent outillé suffit ; un graphe ou 8 sous-agents seraient de la complexité gratuite (cf. §6).

> **Mono-agent vs multi-agent — tranché.** Le besoin (un directeur des opérations qui répond et agit) est **un rôle**, pas une équipe. On garde un agent unique avec un bon catalogue. Des « sous-agents » ne se justifieront que si un jour une tâche longue et parallélisable émerge (ex. réconciliation massive) — et même là, ce sera un *outil* qui fan-out, pas une architecture multi-agent permanente.

### 4.2 Mémoire en couches — la distinction que la v1 n'a pas
**Règle cardinale (anti-confusion) : une fenêtre de contexte de 200k tokens n'est PAS une mémoire.** La fenêtre est volatile, coûteuse à remplir, et bornée. La mémoire est persistante, indexée, et récupérée *just-in-time*. Mola aura **quatre couches distinctes** :

| Couche | Quoi | Durée | Stockage | Tue |
|---|---|---|---|---|
| **Working (fenêtre)** | le tour courant + N derniers messages **dans l'ordre** + résultats d'outils du tour | la requête | en mémoire / messages reconstruits | P0-A, P1-B |
| **Épisodique** | résumés compactés des conversations passées de cet admin (« la semaine dernière tu as validé le dépôt de Jonas ») | longue | `assistant_messages` + résumés | P2-A |
| **Sémantique** | faits & savoir métier vectorisés (glossaire, règles, capacités plateforme) | permanente | **pgvector** (Supabase) | P0-C |
| **Profil utilisateur** | préférences admin, contreparties habituelles, raccourcis appris | permanente | table `mola_user_memory` | P2-A |

- **Compaction** : au-delà d'un seuil, les vieux tours sont **résumés** (1 appel modèle bon marché) et le résumé remplace le verbatim dans la fenêtre. On garde le verbatim en base (audit), on n'en charge que le résumé. C'est ce qui permet des conversations longues **sans** exploser le coût ni perdre le fil — la vraie réponse à P0-A (au-delà du simple « charge les récents »).
- **Récupération just-in-time** : la couche sémantique n'est pas injectée en bloc ; on **récupère** les 3-5 chunks pertinents à la question (RAG), on les met dans la fenêtre, puis on les retire. Budget d'attention maîtrisé.
- 🔴 *À confirmer en phase mémoire : seuils exacts (N messages, seuil de compaction), modèle d'embedding, dimension, coût mesuré.*

### 4.3 Catalogue d'outils à parité garantie — le cœur de la refonte
C'est ici qu'on tue le **patient zéro** (P0-B). Trois mécanismes :

1. **Outils de plus haute granularité, à parité avec l'UI.** Chaque outil d'écriture expose **les mêmes paramètres réels** que l'écran admin équivalent. Exemple immédiat : `create_payment` reçoit un `exchange_rate` optionnel (→ `p_rate_is_custom=true`), exactement comme `MobileNewPayment.tsx:172,333`. *(Quick-win QW-5.)*
2. **Introspection plateforme.** Un savoir structuré « capacités des modules » (quel écran fait quoi, quels paramètres, quelles limites *réelles*) que Mola **interroge** (couche sémantique §4.2) avant d'affirmer une impossibilité. Il ne devine plus : il lit la carte des capacités. *(Tue la confabulation.)*
3. **Registre de parité + tests.** Un registre déclaratif `outil ↔ RPC ↔ écran` et une **suite de tests** qui échoue si un outil diverge de la RPC qu'il prétend mapper (paramètres manquants). Ainsi, quand un module évolue, le test casse → on met l'outil à jour → **plus de dérive silencieuse**. C'est l'invariant « parité » rendu mécanique, pas humain.

> **Auto-extension (« développe ses propres outils ») — honnêteté.** Le founder veut que Mola « développe ses propres outils ». **Anti-hype :** un agent qui écrit, déploie et exécute du **code arbitraire** en prod sur une fintech est un risque inacceptable (injection, mauvaise écriture comptable). Ce qui est **réaliste et sûr** : (a) Mola **compose** ses outils existants en macros/séquences apprises (un « outil » = une recette de tools primitifs), (b) Mola **propose** au founder de nouveaux outils à créer (spec générée, revue humaine, ajout au catalogue). L'auto-génération totale non supervisée est **écartée** ; la composition + proposition est retenue. C'est la lecture honnête de « élargit son périmètre d'action ».

> **MCP (Model Context Protocol) — design-for-later, pas adopt-now.** MCP est désormais mainstream (41% des orgs en production, ~10 000 serveurs publics, spec finale au **28/07/2026** la rendant *stateless*). Il standardise l'interface outil → idéal pour « absorber les futurs modules sans réécriture ». **Mais** ses douleurs de prod (sessions stateful vs load-balancers, scaling) et le fait que les outils de Mola sont des requêtes Supabase in-process rendent une adoption MCP **prématurée maintenant**. Décision : **concevoir le catalogue pour qu'il SOIT exposable en MCP plus tard** (séparation propre nom/description/schéma/permission/handler — déjà le cas en v1), sans monter d'infra MCP aujourd'hui. 🟢 (faits sourcés §5).

### 4.4 Couche de savoir métier récupérable
- **Ontologie métier** comme documents versionnés et vectorisés : cycles de statuts (dépôt, paiement), modèle de taux (CNY/1M XAF, ajustements pays/palier), chaîne trésorerie (XAF→USDT→CNY, WAC, spreads), règles KYC, plafonds (50M XAF). Source de vérité unique, **récupérée just-in-time**, jamais réinjectée en bloc figé dans le prompt (l'anti-pattern que la v1 a *évité par absence* — on le fait correctement).
- **Carte des capacités plateforme** (cf. §4.3-2) : co-localisée dans la même couche sémantique.
- **Fraîcheur** : ces docs vivent dans le repo (`docs/`) + sont (ré)indexés à chaque évolution → pas de péremption silencieuse.

### 4.5 Self-correction / vérification (bornée)
- **Budget de sortie** suffisant (§4.1) → fin des réponses tronquées.
- **Étape de vérification ciblée** : avant **toute proposition financière** et sur **les réponses analytiques chiffrées**, Mola se relit (recoupe le chiffre, vérifie la plausibilité, contrôle le solde). **Pas** une réflexion systématique à chaque tour (coût) — **ciblée** sur l'argent et les chiffres.
- **Récupération d'erreur d'outil** (déjà présente) explicitée : une erreur d'outil revient en `tool_result`, Mola corrige et retente (ex. corriger une requête SQL).
- **Anti-hype :** la réflexion réduit les erreurs, ne les élimine pas. La **carte de confirmation** reste le filet ultime sur l'argent.

### 4.6 Sécurité d'exposition au LLM (concret, pas « on fera attention »)
- **Fermer le trou SQL par rôle** (§6 du diagnostic) : `query_database` doit respecter la segmentation. Mitigation immédiate (QW-4) + version propre (allowlist de tables/colonnes par rôle dans la RPC) en phase sécurité.
- **Masquage PII** : règle explicite de ce que le LLM peut voir par rôle (ex. un `cash_agent` ne reçoit pas l'email/le téléphone complet). À spécifier table par table.
- **Rétention des transcripts** : les conversations contiennent des résultats financiers → politique de rétention + purge, en plus de la RLS existante (correcte, migration `…120000`).
- **Détail complet :** phase « sécurité & confidentialité » dédiée (règles d'exposition table par table, par rôle).

### 4.7 Eval & observabilité — sans quoi la refonte est indémontrable
- **Jeu d'eval** : batterie de Q&A (lecture) + scénarios d'action (écriture) avec, pour chacun, la **réponse/outil attendu** et une **grille de notation**. Régression à chaque changement de prompt/modèle/outil. *(Le brief l'exige ; la v1 n'en a aucun — vérifié, zéro test assistant.)*
- **Traces** : journaliser chaque tour (entrée, outils, résultats tronqués, sortie) pour rejouer/déboguer.
- **Mesure coût/tokens** par conversation (absente aujourd'hui) → décisions de modèle/budget fondées sur des données, pas des intuitions.
- **Détail :** phase eval dédiée (construction du set à partir des questions réelles du founder + recoupement avec l'app).

---

## 5. Décision de stack : build maison vs framework (vérifié & daté)

**Contrainte structurante :** Mola vit dans une **Edge Function Supabase = runtime Deno**, capital limité, ~50-100 conv/jour, utilisable par le père du founder. Tout choix qui pousse hors de l'edge (service Node séparé) ajoute infra + coût + ops.

État des frameworks au **3 juin 2026** (sources datées ci-dessous) :

| Option | Fait vérifié | Verdict pour Mola | Conf. |
|---|---|---|---|
| **Boucle maison (Deno)** | C'est l'existant, il marche. | **RETENU comme runtime.** Zéro migration, contrôle total, le moins cher, reste dans l'edge. | 🟢 |
| **Vercel AI SDK 5/6** | Classe `Agent`, `stopWhen: stepCountIs(n)` (défaut 20), hooks `prepareStep` pour façonner le contexte entre tours. Tourne Node/edge. | **Patterns empruntés** (loop-control, prepareStep) sans forcément la dépendance ; option viable SI on veut alléger la boucle maison. | 🟢 |
| **LangGraph.js** | Tourne sur Deno/Cloudflare/Vercel Edge/navigateur. | **Écarté maintenant** : modèle graphe = sur-ingénierie pour un mono-agent à ce volume. | 🟢 |
| **Mastra** | TS-natif, 1.0 (janv. 2026), mémoire working+sémantique (backends libSQL/**Postgres**), **eval intégré**, **support MCP**, RAG. | **Le plus tentant** (ses briques = nos manques), **mais conçu pour tourner comme service Node**, pas embarqué dans une edge Supabase/Deno. **Écarté comme runtime** (mismatch déploiement) ; **inspiration directe** pour mémoire/eval. | 🟡 / 🔴 (embarquabilité edge à confirmer) |
| **MCP** | Mainstream (41% orgs en prod ; spec finale 28/07/2026, stateless). | **Design-for-later** : catalogue MCP-exposable, pas d'infra MCP maintenant. | 🟢 |

**Recommandation (confiance 🟡, anti-over-engineering) :**
1. **Garder la boucle maison Deno** comme runtime, **refactorée** (provider abstrait, budgets, routing modèle, hook de façonnage de contexte façon `prepareStep`).
2. **pgvector dans le Postgres Supabase existant** pour mémoire sémantique/épisodique + savoir RAG. **Pas** de base vectorielle tierce (Pinecone/Weaviate) — coût/infra injustifiés à ce volume.
3. **Emprunter les patterns** de Mastra (couches mémoire, harnais d'eval) et de l'AI SDK (loop-control), **sans** adopter le framework comme runtime (resterait hors edge).
4. **Réévaluer Mastra/MCP** seulement si Mola sort de l'edge (volume, multi-canal Telegram/WhatsApp, multi-modules lourds).

> Pourquoi pas Mastra tout de suite, alors qu'il « coche tout » ? Parce que l'adopter = très probablement **un service Node séparé à déployer et payer**, pour un gain que pgvector + 300 lignes de glue offrent **dans l'infra déjà payée**. Le jour où Mola devient multi-canal et multi-modules lourds, Mastra redevient le bon candidat. Pas avant. *(🔴 l'embarquabilité de Mastra dans une edge Deno reste à confirmer par test — si elle est possible et propre, l'arbitrage se rouvre.)*

**Sources (datées) :** [MCP adoption 2026 — digitalapplied](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol) · [MCP spec RC 2026-07-28 — modelcontextprotocol.io](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) · [MCP roadmap — The New Stack](https://thenewstack.io/model-context-protocol-roadmap-2026/) · [LangGraph.js runtimes — github/langchain-ai](https://github.com/langchain-ai/langgraph) · [AI SDK agents loop-control — ai-sdk.dev](https://ai-sdk.dev/docs/agents/loop-control) · [AI SDK 5 — Vercel](https://vercel.com/blog/ai-sdk-5) · [Mastra guide 2026 — generative.inc](https://www.generative.inc/mastra-ai-the-complete-guide-to-the-typescript-agent-framework-2026) · [Mastra — github/mastra-ai](https://github.com/mastra-ai/mastra)

---

## 6. Calibrage : ce qu'on construit / ce qu'on ne construit PAS

| On construit (right-sized) | On NE construit PAS (sur-ingénierie à ce stade) |
|---|---|
| 1 agent ReAct outillé, refactoré | ❌ Superviseur multi-agent / 8 sous-agents |
| pgvector dans Supabase | ❌ Base vectorielle tierce (Pinecone/Weaviate) |
| Boucle dans l'edge Deno | ❌ Service Node séparé (Mastra/LangGraph runtime) |
| Catalogue MCP-exposable plus tard | ❌ Infra MCP en prod maintenant |
| Vérification ciblée (argent/chiffres) | ❌ Réflexion systématique à chaque tour (coût) |
| Composition + proposition d'outils | ❌ Auto-génération/déploiement de code non supervisé |
| Routing Sonnet→Opus sur tâches dures | ❌ Opus partout (5× le coût) |

C'est la double garde demandée : **ni un chatbot RAG** (insuffisant pour l'ambition), **ni une usine multi-agent** (injustifiée pour 50-100 conv/jour et un capital limité).

---

## 7. Coût de la cible — ordre de grandeur (🟡 à instrumenter)

Estimations indépendantes, à confirmer par mesure réelle (aucune instrumentation n'existe — c'est un livrable §4.7) :

| Poste | Hypothèse | Ordre de grandeur / mois @ 75 conv/jour |
|---|---|---|
| Inférence Sonnet 4.6 | ~1-4 ¢/conv (cache outils bien posé) | **~25-90 $** |
| Escalade Opus (tâches dures) | ~10-15% des conv, ~5× le prix | **+15-40 $** |
| Embeddings (mémoire + savoir) | quelques milliers/mois | **~1-5 $** |
| pgvector / stockage | dans le Postgres déjà payé | **~0 $ marginal** |
| Infra séparée | aucune (reste dans l'edge) | **0 $** |
| **Total cible** | | **~40-135 $/mois** 🟡 |

Lecture critique : le **bridage actuel n'économise quasi rien** (le plafond 1500 tokens réduit le coût *sortie*, marginal) tout en dégradant l'utilité et en **multipliant les relances** (donc le coût *conversations*). La cible coûte un peu plus en inférence mais **supprime le gaspillage de relances** et rend Mola réellement utile. Le poste qui peut déraper = l'escalade Opus → **routé et plafonné**, pas généralisé. *(Modèle de coût instrumenté = phase dédiée.)*

---

## 8. Quick-wins isolés (unité déployable « stop l'hémorragie »)

Correctifs à **fort levier, faible risque, petits diffs**, indépendants de la refonte de fond. Chacun : fichier:ligne, effet, risque, vérification. **Spécifiés ici, prêts à appliquer — déploiement sur ton feu vert** (c'est l'agent de prod d'une fintech : je ne touche pas au cerveau live sans go explicite).

### QW-1 — Mémoire à l'endroit *(tue P0-A)* 🟢
- **Où :** `supabase/functions/admin-assistant/index.ts:1974`.
- **Quoi :** remplacer `.order("created_at", { ascending: true }).limit(20)` par un chargement des **N derniers** messages : `.order("created_at", { ascending: false }).limit(40)` puis **inverser** le tableau (`.reverse()`) avant le `.map(...)` pour rétablir l'ordre chronologique attendu par le modèle.
- **Effet :** Mola voit enfin le **contexte récent**. Correction directe de « perd le contexte ».
- **Risque :** minimal (un peu plus de tokens d'entrée ; 40 messages reste raisonnable, et le cache amortit).
- **Vérif :** conversation > 20 messages → poser une question qui référence l'échange n°15 → réponse cohérente.

### QW-2 — Budget de sortie *(tue P1-A)* 🟢
- **Où :** `index.ts:2037` (`max_tokens: 1500`).
- **Quoi :** relever à ~**4000**. Optionnel (QW-2b, un peu plus gros) : si `stop_reason === "max_tokens"`, **reboucler** pour continuer la génération au lieu de tomber en texte tronqué (`index.ts:2099`).
- **Effet :** fin des réponses/listes coupées.
- **Risque :** légère hausse coût/latence par tour, bornée.
- **Vérif :** demander « liste les 30 derniers paiements » → réponse complète, non tronquée.

### QW-3 — Plafond d'itérations *(tue P1-C)* 🟢
- **Où :** `index.ts:29` (`MAX_TOOL_ITERATIONS = 8`).
- **Quoi :** passer à **12-16**.
- **Effet :** les tâches composées (multi-clients, recoupements) aboutissent au lieu de tomber sur « Je n'ai pas pu formuler de réponse ».
- **Risque :** coût marginal, borné par QW-2 et le nb d'outils.
- **Vérif :** « compare les volumes d'avril et mai par client » → aboutit.

### QW-4 — Fermer le trou SQL par rôle *(mitigation §6 diagnostic)* 🟢
- **Où :** `index.ts:861` (permission de `query_database`) + à terme la RPC `assistant_readonly_query`.
- **Quoi (mitigation immédiate) :** restreindre `query_database` au **`super_admin`** (master-key) en attendant la version propre (allowlist de tables/colonnes par rôle dans la RPC, phase sécurité).
- **Effet :** un `ops`/`support` ne peut plus aspirer trésorerie + PII via SQL libre.
- **Risque / arbitrage :** `ops`/`support` perdent temporairement l'analytique SQL libre. **Acceptable** pour fermer une fuite PII/trésorerie. *(À valider par toi : préfères-tu cette restriction immédiate, ou attendre la version par rôle ?)*
- **Vérif :** se connecter en `support` → demander les soldes trésorerie via SQL → refusé proprement.

### QW-5 — Taux personnalisé sur `create_payment` *(tue le patient zéro P0-B)* 🟢
- **Où :** outil `create_payment` `index.ts:1341-1396` + prompt `index.ts:1778`.
- **Quoi :** ajouter un paramètre **optionnel** `exchange_rate` au schéma ; s'il est fourni, l'utiliser (→ `p_rate_is_custom=true`, `p_exchange_rate=…`) au lieu de `calculate_final_rate`, **en miroir exact** de `MobileNewPayment.tsx:172,333`. Adapter la phrase du prompt : « le taux est celui du jour **sauf** si l'admin précise un taux personnalisé ». Faire apparaître le **taux personnalisé** sur la carte de confirmation.
- **Effet :** Mola sait enfin faire ce que l'écran fait — fin du « le taux est fixé » mensonger.
- **Risque :** touche le **chemin argent** → impératif : taux affiché clairement sur la carte, contrôle de solde et min conservés, audité. Diff un peu plus gros que QW-1/2/3 mais contenu.
- **Vérif :** « paie 2 000 000 XAF en Alipay pour Jonas au taux 78 » → carte avec taux 78 (custom), pas le taux du jour.

### QW-6 — Commentaires menteurs *(hygiène)* 🟢
- **Où :** `index.ts:2` (« 47 outils » → 62), `:12` (vision « images+PDF » → désactivée), `:2019` (« Haiku par défaut » → Sonnet).
- **Quoi :** corriger pour refléter le code.
- **Effet :** un mainteneur ne se fie plus à des commentaires faux.
- **Risque :** nul.

**Ordre de déploiement conseillé :** QW-1 → QW-2 → QW-3 (trois lignes, gain immédiat sur « oublie / tronque / abandonne ») ; QW-4 (sécurité, après ton arbitrage) ; QW-5 (flagship, revue argent) ; QW-6 (hygiène).

---

## 9. Décisions ouvertes (à trancher pour les phases suivantes)
- 🔴 **Profil PII par rôle** : que voit le LLM, table par table ? (phase sécurité)
- 🔴 **Seuils mémoire** : N messages en fenêtre, seuil de compaction, modèle d'embedding. (phase mémoire)
- 🔴 **Tâches « dures »** déclenchant l'escalade Opus : lesquelles exactement ? (phase executor)
- 🔴 **Source du jeu d'eval** : on part de tes vraies questions des derniers jours — peux-tu en fournir 15-20 ? (phase eval)
- 🔴 **QW-4** : restriction `super_admin` immédiate, ou attendre la version par rôle ?

---

## 10. Prochaine étape
**Phase 3 — deep-dive d'un sous-système.** Proposition d'ordre (le plus fort levier d'abord) : **(A) Mémoire en couches** (schéma pgvector, compaction, récupération) **OU (B) Catalogue à parité + introspection** (le cœur anti-confabulation). À trancher avec toi en fin de phase.

*Fin de la Phase 2.*

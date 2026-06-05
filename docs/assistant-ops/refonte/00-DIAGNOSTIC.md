# Refonte Assistant « Directeur des Opérations » — Phase 1 : Diagnostic

> **Statut :** Phase 1 / diagnostic — lecture seule du code réel. Aucune ligne applicative modifiée.
> **Date :** 2026-06-03
> **Périmètre :** le « cerveau » de l'Assistant (intelligence agentique), pas son habillage mobile.
> **Méthode :** lecture exhaustive de l'Edge Function (2136 lignes), du hook, des migrations, de la
> conception v1. Chaque affirmation porte une **référence `fichier:ligne`** et un **niveau de confiance**.
>
> **Légende confiance :** 🟢 vérifié dans le code · 🟡 fortement étayé, marge d'interprétation · 🔴 supposé / à confirmer (config prod, device, mesure runtime).

---

## 0. Relation aux documents existants (ne rien réécrire d'inutile)

Ce module a **déjà** une histoire documentée. Ce diagnostic s'y ancre :

| Doc | Ce qu'il couvre | Rapport avec ce diagnostic |
|---|---|---|
| `docs/assistant-ops/CONCEPTION.md` | Design v1 du DO (vision, principes, phases, catalogue d'outils) | **Le design v1 a été LIVRÉ.** Ce diagnostic audite l'écart entre l'intention v1 et le comportement réel. |
| `docs/assistant-ops/PLAN-DEV.md` | Plan de build v1 (phases 0→4) | Phases 0→3 manifestement implémentées (62 outils en prod). |
| `docs/audit-fondation-mobile-assistant.md` | **Plomberie mobile** : viewport, clavier, app-shell, scroll | **Axe différent.** Cet audit traite le *cadre* (le chat tremble, le clavier recouvre). Le présent diagnostic traite le *cerveau* (l'agent ment, oublie, refuse). Aucun recoupement. |

**Conséquence :** la prémisse du brief de refonte (« c'est un chatbot RAG, 1 prompt + 1 fetch + 1 réponse ») est **fausse**. Le code prouve l'inverse. Le vrai problème n'est pas l'absence d'agent — c'est un **agent réel mais bridé, à la mémoire cassée et aux outils en sous-régime**. La suite le démontre, pièce par pièce.

---

## 1. TL;DR — la conclusion en sept phrases

1. **L'Assistant actuel EST un agent**, pas un chatbot : boucle ReAct multi-tours (`index.ts:2034`), **62 outils** réels (42 lecture + 20 écriture), tool-calling Anthropic en streaming, écriture-avec-confirmation, audit, prompt caching. Hypothèses 1 et 2 du brief : **réfutées par le code**. 🟢
2. **Le modèle n'est pas sous-dimensionné** : `claude-sonnet-4-6` par défaut pour les deux profils (`index.ts:27-28`). Hypothèse 6 : fausse *sur la config par défaut*. Le bridage vient d'ailleurs. 🟢
3. **La mémoire est littéralement câblée à l'envers** : l'historique rechargé est `ORDER BY created_at ASC LIMIT 20` (`index.ts:1974`) — soit les **20 messages les plus ANCIENS**, jamais les récents. Passé ~10 échanges, l'agent répond avec une fenêtre figée sur le *début* de la conversation et ne voit plus le milieu ni la fin. **C'est la cause directe de « perd le contexte même dans une conversation ».** 🟢
4. **Le refus du taux personnalisé n'est pas une hallucination de connaissance — c'est un trou de parité d'outil** : l'écran admin `MobileNewPayment.tsx:172,333` permet un taux libre (`useCustomRate`), la RPC `create_admin_payment` accepte `p_rate_is_custom`/`p_exchange_rate`, **mais l'outil `create_payment` de l'agent n'a aucun paramètre de taux** (`index.ts:1345-1352`) et le prompt lui **interdit** de le fixer (`index.ts:1778`). L'agent dit vrai sur *lui-même*, faux sur *la plateforme*. 🟢
5. **« Je ne sais pas » a quatre moteurs cumulés** : prompt système quasi vide de connaissance métier (`index.ts:1764-1793`), `max_tokens:1500` qui tronque chaque tour (`index.ts:2037`), plafond de 8 itérations d'outils (`index.ts:29`), et perte du contexte-outil entre les tours (seul le texte final est persisté, `index.ts:2109-2112`). 🟢
6. **Il « n'apprend pas » au sens propre** : aucune mémoire sémantique/utilisateur, aucun glossaire métier, aucune introspection de la plateforme. Il ne peut pas *découvrir* qu'une capacité existe (ex. taux libre) ni se forger une connaissance durable. C'est une **absence architecturale**, pas un réglage. 🟢
7. **Faille de confidentialité réelle** : l'outil SQL libre `query_database` est ouvert au rôle via `canViewLogs` (`index.ts:861`) mais la RPC sous-jacente ne filtre que sur `is_admin()` en `security definer` (migration `…140000:30-33,63`) — donc un admin `ops`/`support` *sans* droit trésorerie peut lire toute la trésorerie et toute la PII via SQL, et l'envoyer au LLM. 🟢

> **Verdict d'ensemble.** On ne refait pas « un chatbot en agent ». On **répare un agent qui a une bonne ossature et trois fractures** : mémoire à l'envers, outils en sous-parité, et zéro couche de connaissance/apprentissage. La refonte est réelle (mémoire, catalogue d'outils, couche de savoir, eval), mais elle **capitalise** sur l'existant au lieu de le jeter.

---

## 2. Ce que l'Assistant EST réellement (architecture vérifiée)

Fichier unique : `supabase/functions/admin-assistant/index.ts` (2136 lignes) — c'est le cerveau. Front : `src/hooks/useAdminAssistant.ts` + `src/mobile/screens/assistant/MobileAssistantScreen.tsx`.

### 2.1 Le flux réel d'un message

```
Front (hook) ──fetch + JWT admin──▶ Edge Function
  │                                   │ 1. vérifie admin actif (user_roles, is_disabled)  [index.ts:1897-1899]
  │                                   │ 2. charge rôle → permissions                       [index.ts:1901-1902]
  │                                   │ 3. recharge historique (20 msgs)                   [index.ts:1974]  ⚠️ BUG
  │                                   │ 4. filtre outils selon permissions                 [index.ts:2001-2007]
  │                                   │ 5. BOUCLE AGENTIQUE (max 8 tours) :                [index.ts:2034]
  │                                   │      modèle → tool_use → exécute → tool_result → reboucle
  │                                   │      écriture → crée une "proposition" (carte)     [index.ts:2080-2086]
  │◀──── SSE: delta / proposal / image / done ───┤
  │                                   │ 6. persiste user+assistant (texte seul)            [index.ts:2109-2112]
  │
  └── tap "Confirmer" ──fetch confirmAction──▶ exécute la RPC avec le JWT admin            [index.ts:1909-1955]
```

C'est un patron **ReAct / tool-use agent** canonique. Pas un RAG one-shot. 🟢

### 2.2 Inventaire vérifié

| Élément | Valeur réelle | Référence | Conf. |
|---|---|---|---|
| Boucle agentique | `for (i=0; i<MAX_TOOL_ITERATIONS; i++)` | `index.ts:2034` | 🟢 |
| Plafond d'itérations | **8** | `index.ts:29` | 🟢 |
| Modèle lecture (`FAST`) | `claude-sonnet-4-6` | `index.ts:27` | 🟢 |
| Modèle écriture (`SMART`) | `claude-sonnet-4-6` (identique) | `index.ts:28` | 🟢 |
| `max_tokens` par tour | **1500** | `index.ts:2037` | 🟢 |
| Nb d'outils LECTURE | **42** | `index.ts:167-987` | 🟢 |
| Nb d'outils ÉCRITURE | **20** | `index.ts:1158-1762` | 🟢 |
| Total outils | **62** (le commentaire d'en-tête dit « 47 » — périmé) | `index.ts:2` | 🟢 |
| Outil SQL libre lecture | `query_database` → RPC `assistant_readonly_query` | `index.ts:860-887` | 🟢 |
| Écriture-avec-confirmation | proposition → carte → tap → exécution | `index.ts:2068-2087`, `1909-1955` | 🟢 |
| Streaming SSE | reconstruction texte + tool_use | `index.ts:1814-1869` | 🟢 |
| Prompt caching | sur le bloc outils + le système | `index.ts:2014,2037` | 🟢 |
| Persistance | `assistant_conversations` / `_messages` / `_pending_actions` | migrations `…120000/140000` | 🟢 |
| Audit | `admin_audit_logs` à chaque requête et exécution | `index.ts:2114-2117,1949` | 🟢 |
| Pièces jointes | **jamais envoyées au modèle** (preuves uniquement) | `index.ts:1782-1784,1983-1996` | 🟢 |

### 2.3 Ce qui est GÉNUINEMENT bien fait (à ne pas jeter)

L'honnêteté impose de le dire — la refonte doit **capitaliser** dessus :

- **Garde anti-hallucination d'identifiants** : `resolveClient()` rejette tout `user_id` non-UUID et force un `search_clients` préalable (`index.ts:1107-1116`). Vrai bon réflexe d'ingénierie agentique. 🟢
- **Écriture-avec-confirmation** : aucune mutation argent sans carte validée d'un tap. Patron correct et sûr. 🟢
- **Prise atomique d'action** (`pending → executing` conditionnel) contre le double-tap concurrent (`index.ts:1934-1941`). 🟢
- **Permissions héritées par outil** : chaque outil porte une `permission` filtrée selon le rôle (`index.ts:2001-2007`). Sauf le trou SQL (§6). 🟢
- **SQL en lecture seule garantie** par `transaction_read_only=on` au niveau transaction (migration `…140000:63`) — un vrai verrou, pas un filtre de mots. 🟢
- **Outil d'exploration de données** : `query_database` permet déjà d'aller chercher *n'importe quelle* donnée. Le problème n'est pas son absence, c'est sa portée (données ≠ connaissance de la plateforme) et sa sécurité.

---

## 3. Les hypothèses du brief, jugées sur pièces

| # | Hypothèse du brief | Verdict | Preuve | Conf. |
|---|---|---|---|---|
| 1 | « Chatbot RAG, pas un agent (1 prompt + 1 fetch + 1 réponse) » | ❌ **FAUX** | Boucle ReAct `index.ts:2034`, 62 outils | 🟢 |
| 2 | « Pas (ou peu) de tools, ne peut pas agir sur les modules » | ❌ **FAUX** | 20 outils d'écriture mappés sur les RPC réelles (`index.ts:1158-1762`) | 🟢 |
| 3 | « Connaissance figée : doc métier injectée brute et périmée » | ⚠️ **FAUX dans le mécanisme, vrai dans le symptôme** | Rien n'est injecté : le prompt système (`index.ts:1764-1793`) est **quasi vide de métier**. Le problème n'est pas une doc périmée, c'est **l'absence de couche de connaissance**. | 🟢 |
| 4 | « Pas de mémoire → perd le contexte » | ⚠️ **VRAI, et pire que supposé** | Persistance existe MAIS rechargée à l'envers (20 plus *anciens*, `index.ts:1974`), contexte-outil perdu entre tours (`index.ts:1976-1981`), zéro mémoire sémantique/utilisateur | 🟢 |
| 5 | « Pas de self-correction » | ⚠️ **PARTIEL** | Récupération d'erreur *au niveau outil* existe (l'erreur revient en `tool_result`, l'agent peut retenter). Mais **aucune vérification de réponse**, aucun reflexion-loop, aucun recoupement de chiffres. | 🟢 |
| 6 | « Modèle sous-dimensionné OU mal prompté » | ⚠️ **Pas sous-dimensionné ; mal câblé** | Sonnet 4.6 par défaut (`index.ts:27-28`). Le bridage = `max_tokens:1500` + 8 itérations + prompt maigre + mémoire cassée. (🔴 *si* un secret prod force Haiku, alors la lecture tournerait en Haiku — non vérifiable depuis le repo.) | 🟢 / 🔴 |

**Lecture critique.** Le founder croit avoir un jouet ; il a une machine sophistiquée dont **trois courroies sont mal montées**. Diagnostiquer « ajoutons des tools » serait une erreur : les tools existent. Le levier est ailleurs.

---

## 4. Causes racines, classées par impact

> Convention : **P0** = explique directement un symptôme rapporté, correctif à fort levier · **P1** = aggravant majeur · **P2** = plafond de capacité / dette.

### P0-A — Mémoire conversationnelle montée à l'envers 🟢
- **Mécanisme.** `index.ts:1974` : `.order("created_at", { ascending: true }).limit(20)`. En PostgREST, c'est `ORDER BY created_at ASC LIMIT 20` → les **20 lignes les plus anciennes**. Pour obtenir les récentes il faudrait `ascending:false` puis ré-inverser.
- **Conséquence.** Tant que la conversation a ≤ 20 messages, tout va bien. Au-delà, la fenêtre envoyée au modèle reste **collée au tout début** de la conversation ; les échanges 21…N-1 deviennent invisibles. Chaque nouveau message est traité comme `[20 premiers messages] + [message courant]`. Aggravé par les inserts supplémentaires (traces d'action `index.ts:1953`, 2 messages persistés/tour `index.ts:2109-2112`) qui font franchir le seuil de 20 en ~7-9 échanges.
- **Symptôme expliqué.** « Perd le contexte même dans une conversation. » **Correspondance directe.**
- **Correctif (trivial, fort levier).** Charger les N *derniers* messages (`ascending:false` + reverse), et augmenter N. C'est une ligne. Mais la *vraie* réponse (Phase mémoire) est une stratégie de fenêtre + compaction, pas juste « plus de messages ».

### P0-B — Trou de parité d'outil : l'agent ne sait pas faire ce que la plateforme sait faire 🟢
- **Mécanisme.** Cas emblème, tracé de bout en bout en §5. L'outil `create_payment` (`index.ts:1341-1396`) **recalcule toujours** le taux via `calculate_final_rate` (`index.ts:1368`) et n'expose **aucun** paramètre de taux ; le prompt **interdit** explicitement de le fixer (`index.ts:1778`). Or l'UI admin `MobileNewPayment.tsx:172,333` et la RPC `create_admin_payment` (`p_rate_is_custom`, `p_exchange_rate`) le permettent.
- **Conséquence.** L'agent **confabule une règle métier** (« le taux du jour est fixé ») pour justifier une **limite de son propre outil**. Il ne peut pas distinguer « la plateforme l'interdit » de « mon outil ne l'expose pas » — il n'a aucun moyen d'introspection.
- **Symptôme expliqué.** « Refuse des actions réellement possibles. » Et, plus grave : **fausse information énoncée avec aplomb**.
- **Généralisation.** Ce n'est pas un cas isolé : c'est la **signature d'un catalogue d'outils qui est un miroir partiel et figé** de la plateforme. Chaque divergence outil↔UI produit un futur « il refuse / il invente ».

### P0-C — Aucune couche de connaissance métier 🟢
- **Mécanisme.** `buildSystemPrompt()` (`index.ts:1764-1793`) ≈ 30 lignes, dont ~25 d'instructions d'usage d'outils. **Quasi rien** sur : le cycle de vie des statuts (dépôt : created→proof_submitted→admin_review→validated/rejected ; paiement : created→waiting_beneficiary_info→ready_for_payment→processing→completed…), le modèle de taux (CNY pour 1M XAF, ajustements par pays/palier), la chaîne trésorerie (XAF→USDT→CNY, WAC, spreads), les règles KYC, ce que chaque module fait *vraiment*.
- **Conséquence.** Pour toute question *sur la plateforme* (« comment marche X », « que signifie le statut Y », « peut-on faire Z »), l'agent n'a **aucun socle** : il infère depuis des résultats d'outils (qui donnent des *données*, pas des *règles*) ou il **devine**. D'où « je ne sais pas » ou pire, une réponse plausible et fausse.
- **Nuance anti-hype.** La solution n'est PAS « réinjecter un gros bloc de doc dans le prompt » (ça redevient figé et coûteux). C'est une **couche de savoir récupérable** (RAG métier + introspection plateforme), traitée en phase d'architecture.

### P1-A — `max_tokens: 1500` tronque chaque tour 🟢
- **Mécanisme.** `index.ts:2037`. Chaque appel modèle est plafonné à 1500 tokens de sortie. Si la réponse (analyse, liste de clients, explication) dépasse, elle est **coupée** ; pire, si le modèle est en plein raisonnement, `stop_reason` devient `max_tokens` — et la boucle ne reboucle QUE sur `tool_use` (`index.ts:2044`), donc elle tombe en extraction de texte tronqué (`index.ts:2099`) et **s'arrête**.
- **Conséquence.** Réponses incomplètes, listes coupées, analyses avortées. Contribue à « donne des fausses informations » (une moitié de réponse est souvent fausse).

### P1-B — Contexte-outil jeté entre les tours 🟢
- **Mécanisme.** L'historique rechargé ne garde que `role` + `text` (`index.ts:1976-1981`) ; seul le **texte final** est persisté (`index.ts:2109-2112`). Les `tool_use`/`tool_result` d'un tour précédent ne sont **pas** reconstitués.
- **Conséquence.** Question de suivi (« et ses paiements ? ») : l'agent a perdu les données chargées au tour d'avant (il n'a que son propre résumé textuel) → il refait des appels, se contredit, ou répond à côté. Dégrade la cohérence multi-tours **en plus** du bug P0-A.

### P1-C — Plafond de 8 itérations d'outils 🟢
- **Mécanisme.** `MAX_TOOL_ITERATIONS = 8` (`index.ts:29`). Une tâche qui enchaîne >8 appels (analyse multi-clients, recoupements, multi-périodes) sort de la boucle sans `finalText` → fallback « Je n'ai pas pu formuler de réponse » (`index.ts:2104`).
- **Conséquence.** Dead-ends sur les tâches composées — exactement le registre d'un « directeur des opérations ».

### P2-A — Zéro mémoire sémantique / utilisateur / d'apprentissage 🟢
- **Mécanisme.** Aucune table/magasin de : préférences admin, contreparties habituelles, faits appris, glossaire, décisions passées. La seule persistance est le transcript brut.
- **Conséquence.** « N'apprend pas. » Littéralement vrai : il n'existe **aucun substrat** où apprendre. Chaque conversation repart à froid (et, vu P0-A, mal).

### P2-B — Cécité documentaire 🟢
- **Mécanisme.** Pièces jointes jamais transmises au modèle (`index.ts:1782-1784,1983-1996`) — choix délibéré coût/vitesse. Le commentaire d'en-tête (`index.ts:12`, « images (vision) + PDF (documents) ») **ment** : la vision est désactivée.
- **Conséquence.** Un « directeur des opérations » ne peut pas lire un reçu bancaire pour en extraire un montant, ni vérifier un QR. Plafond net pour l'ambition. (Décision à ré-arbitrer en connaissance de cause, pas un bug.)

### P2-C — Pas d'introspection ni d'auto-extension 🟢
- **Mécanisme.** L'agent ne peut pas inspecter la plateforme (schémas, capacités des modules, paramètres réels d'un formulaire) au-delà des données ; il ne peut pas créer/étendre ses outils.
- **Conséquence.** « N'explore pas, ne développe pas ses propres outils. » Vrai. Et c'est ce qui rend P0-B *systémique* : sans introspection, toute évolution de la plateforme rouvre un écart outil↔réalité.

### Carte symptôme → cause
| Symptôme rapporté | Cause(s) racine | Conf. |
|---|---|---|
| Perd le contexte dans une conversation | **P0-A** (20 plus anciens) + P1-B (contexte-outil jeté) | 🟢 |
| « Je ne sais pas » sur des sujets qu'il devrait maîtriser | **P0-C** (pas de savoir) + P1-A (troncature) + P1-C (8 tours) | 🟢 |
| Donne de fausses informations | **P0-B** (confabule une limite d'outil) + P0-C + P1-A | 🟢 |
| Refuse des actions possibles (taux perso) | **P0-B** (parité d'outil) — tracé §5 | 🟢 |
| N'apprend pas / n'explore pas / pas d'outils propres | **P2-A** + **P2-C** | 🟢 |
| Semble un chatbot bridé | Somme de tout ce qui précède (l'ossature agent est masquée par le bridage) | 🟢 |

---

## 5. Étude de cas : le taux personnalisé (la preuve de bout en bout)

Le founder affirme : *« il a refusé un paiement à taux personnalisé en disant que le taux du jour est fixé, alors que le module Paiement permet de le modifier librement. »* **Vérifié contradictoirement, des deux côtés :**

**Côté plateforme — la capacité existe :**
- UI admin mobile : `src/mobile/screens/payments/MobileNewPayment.tsx:140` `const [customRateStr, setCustomRateStr] = useState(...)`, `:172` `const rate = useCustomRate ? (parseInt(customRateStr) || FALLBACK_RATE) : baseRate;`, `:333` `rate_is_custom: useCustomRate`, `:800` champ `<input value={customRateStr}>`. 🟢
- RPC : `create_admin_payment(... p_exchange_rate, p_rate_is_custom ...)` (migrations `20260304300000:28,186`, `20260221200000:367`). 🟢
- Colonne DB : `payments.rate_is_custom` (`20260304200000:8`). 🟢

**Côté agent — la capacité est absente ET interdite :**
- Outil `create_payment` : schéma sans aucun champ de taux (`index.ts:1345-1352`) ; calcul forcé via `calculate_final_rate` (`index.ts:1368`). 🟢
- Prompt système : *« Le taux RMB des paiements est calculé automatiquement par l'outil, ne le calcule pas toi-même »* (`index.ts:1778`). 🟢

**Diagnostic.** L'agent n'a pas halluciné une règle au hasard : il a **rationalisé la limite de son outil** en une fausse règle métier. Il était *incapable* de dire la vérité utile — « la plateforme le permet, mais mon outil de création de paiement n'expose pas encore le taux libre ; veux-tu que je le fasse via l'écran ? » — parce qu'il **ne sait pas ce que son outil ne couvre pas**. 

C'est le **patient zéro** du problème de fond : *le catalogue d'outils est un miroir partiel, figé à la main, d'une plateforme qui évolue.* Tant que ce miroir est statique et incomplet, l'agent produira indéfiniment des « refus » et des « fausses règles ». La refonte doit traiter la **parité outil↔plateforme** comme un invariant, pas comme une liste qu'on rallonge à la main.

---

## 6. Confidentialité financière — la faille concrète à corriger

Le brief exige des règles d'exposition au LLM « concrètes, pas “on fera attention” ». En voici une **déjà ouverte** :

- **Le fait.** L'outil `query_database` est exposé au rôle dès que `perms.canViewLogs` est vrai (`index.ts:861,2001`). Or `assistant_readonly_query` est `security definer` et ne contrôle **que** `is_admin(auth.uid())` (migration `20260601140000:21,30-33`). En `security definer`, la fonction s'exécute avec les droits du propriétaire → **RLS contournée**, lecture de **toutes les lignes de toutes les tables**.
- **Qui est concerné.** Rôles avec `canViewLogs=true` : `super_admin`, **`ops`**, **`support`** (`index.ts:55,56`). Or `ops` et `support` ont `canViewTreasury=false` (`index.ts:55,56`). **Donc un admin `ops`/`support` peut lire toute la trésorerie, tous les soldes, toute la PII client via `SELECT`**, alors que ses outils trésorerie dédiés lui sont refusés. Segmentation par rôle **défaite** par l'outil SQL.
- **Surface LLM.** Ces données partent dans le `tool_result` → envoyées à Anthropic. Pour une fintech, c'est l'exposition à cadrer explicitement (quelles tables/colonnes le LLM peut voir, par rôle ; masquage PII ; rétention des transcripts qui contiennent ces résultats).
- **Gravité.** 🟢 confirmé par le code. Ce n'est pas théorique : c'est une élévation de visibilité inter-rôles exploitable en langage naturel (« montre-moi le solde de tous les comptes de trésorerie »).

> Note : la persistance des conversations a une RLS correcte (un admin ne voit que ses conversations, migration `…120000`). Le problème n'est pas le *stockage* du transcript, c'est ce que l'agent est autorisé à *récupérer* et à *transmettre au LLM* indépendamment du rôle.

---

## 7. Coût — ordre de grandeur (cadrage, détail en phase dédiée)

Estimation indépendante, à confirmer par mesure réelle (🔴 aucune instrumentation de coût n'existe dans le code) :

- **Tarif Sonnet 4.6** (ordre de grandeur public) : ~3 $/M tokens entrée, ~15 $/M sortie ; cache en lecture ~10× moins cher que l'entrée fraîche.
- **Une conversation typique** (système ~1k tokens caché + 62 schémas d'outils ~4-6k tokens cachés + 2-4 tours d'outils + résultats) ≈ **15-40k tokens entrée** (dont l'essentiel caché aux tours suivants) + **1-3k sortie**. Soit, très grossièrement, **~1-4 ¢ par conversation** hors anomalies.
- **Aggravants actuels** : recharger les 20 messages bruts à chaque appel et re-streamer ; le plafond 1500 limite paradoxalement la sortie (donc le coût sortie), mais provoque des relances utilisateur (donc plus de conversations). Le cache d'outils (`index.ts:2014`) est correctement posé — bon point coût.
- **À 50-100 conversations/jour** → ordre de grandeur **quelques dizaines de $/mois** d'inférence. La mémoire vectorielle (phase mémoire) ajoutera un coût d'embeddings + stockage **marginal** à ce volume.

Conclusion coût : **le bridage actuel n'est pas un choix d'économie défendable** — il dégrade l'utilité sans diviser le coût de façon significative à ce volume. (Modèle de coût complet : phase dédiée, avec instrumentation réelle.)

---

## 8. Ce que ce diagnostic NE dit pas (honnêteté)

- 🔴 **Config prod non vérifiable depuis le repo** : si des secrets `ASSISTANT_MODEL_FAST/SMART` forcent Haiku en prod, le profil lecture serait plus faible que Sonnet — non observable ici. À confirmer côté Supabase.
- 🔴 **Aucune trace runtime / aucun log de conversation réelle** analysés : le mapping symptôme→cause est établi par lecture de code + specs, pas par rejeu de sessions. Très haute confiance sur les mécanismes ; l'ampleur exacte de chaque symptôme mérite 2-3 traces réelles.
- 🟡 **Fréquence des symptômes** : P0-A (mémoire) ne mord qu'au-delà de ~20 messages stockés ; si le founder « reset » souvent, l'effet est intermittent — cohérent avec « fréquemment », pas « toujours ».
- **Hors périmètre (couvert ailleurs)** : tout le volet viewport/clavier/scroll est traité par `audit-fondation-mobile-assistant.md` et n'est pas ré-audité ici.
- **Pas encore conçu** : l'architecture cible (mémoire en couches, catalogue d'outils auto-parité, couche de savoir, self-correction, nom, eval, modèle de coût détaillé, règles d'exposition par rôle) — **c'est la Phase 2**, délibérément non traitée ici (une phase à la fois).

---

## 9. Implications pour la refonte (passerelle vers la Phase 2, sans la pré-empter)

Le diagnostic impose **cinq chantiers** (détaillés en conception) :

1. **Mémoire en couches** — distinguer fenêtre de contexte (réparer P0-A/P1-B) de *vraie* mémoire long-terme (épisodique + sémantique + utilisateur), avec compaction. *Une fenêtre de 200k tokens n'est pas une mémoire.*
2. **Catalogue d'outils à parité garantie** — traiter l'écart outil↔plateforme (P0-B) comme invariant : outils de plus haute granularité (taux libre exposé), + introspection plateforme, pour que l'agent sache ce qu'il peut/ne peut pas et **cesse de confabuler**.
3. **Couche de connaissance métier récupérable** (P0-C) — RAG métier + ontologie des statuts/modules, *just-in-time*, pas un bloc figé dans le prompt.
4. **Self-correction réelle** (P1-A/C, P5) — budget de sortie adéquat, boucle de vérification/recoupement, pas seulement la récupération d'erreur d'outil.
5. **Sécurité d'exposition + eval** — fermer le trou SQL par rôle (§6), définir les règles d'exposition LLM concrètes, et **construire le jeu d'eval** sans lequel on ne saura jamais si la refonte est meilleure.

Et une décision réservée au founder : **le nom de l'agent** (candidats proposés en Phase 2, à valider).

---

## 10. Prochaine étape

**Phase 2 — Conception de l'architecture cible.** Ne sera lancée qu'après validation de ce diagnostic et arbitrage de deux points : (a) profondeur/ambition de la refonte (réparations chirurgicales vs refonte de fond complète avec mémoire vectorielle et auto-parité), (b) nom de l'agent.

*Fin de la Phase 1.*

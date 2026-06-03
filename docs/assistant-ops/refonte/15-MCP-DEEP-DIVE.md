# MCP & plateforme AI-native — deep dive + verdict honnête

> **Objet :** expliquer MCP en profondeur, vérifier sa pertinence pour Bonzini, et dire **franchement** si c'est la bonne option, et dans quel ordre.
> **Date :** 2026-06-03 · Sources web datées en bas. **Légende :** 🟢 vérifié (web/code) · 🟡 étayé · 🔴 à confirmer.
> **Correction assumée :** en Phase 2 (`01-CIBLE-ET-QUICKWINS.md` §5) j'écrivais « Mastra/MCP = service hors edge, écarté ». **C'était partiellement faux pour MCP** : on PEUT faire tourner un serveur MCP **dans une Edge Function Supabase** (Deno) via `mcp-lite`. Je le corrige ici. 🟢

---

## 1. MCP, c'est quoi (sans jargon, puis précis)

**Métaphore.** MCP (Model Context Protocol) est une **prise universelle** entre une IA et des capacités externes. Comme l'USB-C a standardisé « brancher n'importe quel appareil », MCP standardise « brancher n'importe quelle IA sur n'importe quel outil/donnée ». Tu construis **une prise** (un serveur MCP) ; ensuite **n'importe quelle IA compatible** (Claude Desktop, ChatGPT, Cursor, ton propre agent Mola, un futur bot Telegram) s'y branche sans recâblage.

**Précis (architecture).** 🟢
```
   HÔTE (l'app IA)                         SERVEUR MCP (tes capacités)
   ex. Mola / Claude Desktop / ChatGPT     ex. "Bonzini-capabilities"
        │  crée 1 CLIENT MCP par serveur          │  expose : Tools / Resources / Prompts
        └──────── JSON-RPC 2.0 ───────────────────┘
            (stdio en local, ou Streamable HTTP à distance)
```
- **Hôte** : l'application IA. **Client** : un connecteur (1 par serveur) à l'intérieur de l'hôte. **Serveur** : ce que TOI tu exposes.
- Protocole : **JSON-RPC 2.0**, session établie par connexion.

**Les 3 primitives qu'un serveur expose** 🟢 :
| Primitive | Quoi | Pour Bonzini |
|---|---|---|
| **Tools** | fonctions exécutables que l'IA peut appeler | tes **61 actions RPC** (créer paiement, valider dépôt, annuler, confirmer cash…) |
| **Resources** | données/contexte que l'IA peut lire | clients, dépôts, taux, trésorerie (lecture) |
| **Prompts** | gabarits de workflow réutilisables | « onboarding complet », « clôture journalière »… |

**Transports** 🟢 :
- **stdio** : local (même machine) — pour Claude Desktop qui lance un serveur en local.
- **Streamable HTTP** (spec nov. 2025, remplace l'ancien SSE) : serveur **distant** sur HTTPS, multi-clients. C'est ce qu'il te faut pour exposer Bonzini.

**Auth** 🟢 : **OAuth 2.1** ; la maj 2026 ajoute le **consentement de portée incrémental** (l'IA demande le minimum d'accès par opération, pas tout d'un coup).

**Évolution 2026** 🟢 : la *release candidate* du **2026-07-28** pousse vers un **cœur stateless**, un framework d'**Extensions**, des **Tasks** (opérations longues), des **MCP Apps**, et un **durcissement de l'autorisation**. Streamable HTTP exige désormais des en-têtes `Mcp-Method`/`Mcp-Name` pour que les load-balancers routent sans lire le corps.

---

## 2. LE point crucial pour ta stack : MCP **tourne dans Supabase Edge** 🟢

Découverte qui change l'arbitrage : tu n'as **PAS** besoin d'un serveur Node séparé.
- **`mcp-lite`** : framework TS **zéro-dépendance** pour serveurs MCP, qui tourne **partout où il y a Fetch** — **dont Deno et les Edge Functions Supabase**. ([doc Supabase](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite))
- Donc un serveur MCP « Bonzini-capabilities » peut vivre **dans la même infra** que Mola aujourd'hui. Coût infra ≈ nul. **C'est ce qui rend MCP réaliste pour toi maintenant.**
- ⚠️ À ne pas confondre : le **serveur MCP officiel de Supabase** (`mcp.supabase.com`) sert à **gérer ton backend** (DB/auth) via une IA — c'est un outil de DEV, **pas** l'exposition de ta logique métier. Pour exposer tes actions Bonzini, tu construis **ton propre** serveur MCP.

---

## 3. Le verdict honnête (je mène par le contre-argument)

Tu dis « MCP est sûrement la meilleure option ». **Oui pour la destination, non pour l'ordre.** Trois vérités qui dérangent :

**a) MCP ne lève PAS, à lui seul, ton plafond de 44 %.** MCP est un **emballage/protocole**, pas un générateur. Avec MCP, tu **réécris quand même** chaque outil à la main — juste en format MCP. Ce qui lève le plafond, c'est l'**auto-génération du catalogue depuis `types.ts`** (doc 14), et c'est **indépendant** de MCP. Adopter MCP sans l'auto-génération = même travail manuel, autre emballage. 🟢 (raisonnement)

**b) La valeur de MCP, c'est le MULTI-CLIENT — que tu n'as pas encore.** MCP brille quand **plusieurs** consommateurs utilisent les mêmes capacités (Mola + ton Claude Desktop + ChatGPT + un bot Telegram). Aujourd'hui tu as **un seul** consommateur : Mola, dans ton app admin. Tant qu'il n'y en a qu'un, un serveur MCP ajoute de la cérémonie pour un bénéfice (interopérabilité) encore **hypothétique**. C'est le risque **YAGNI** (« you ain't gonna need it… yet »). 🟡

**c) MCP, pour une fintech, c'est une surface d'attaque sérieuse.** 🟢 La recherche sécurité 2026 est sans ambiguïté :
- **Tool poisoning / injection indirecte** : des instructions malveillantes cachées dans la **description** d'un outil ; l'IA les lit, l'humain non.
- **Confused deputy** : un proxy agit avec les privilèges du serveur, pas de l'utilisateur.
- **Rug pull** : un serveur change la description d'un outil après installation.
- **Token passthrough** : un serveur accepte des jetons non émis pour lui.
- **Point unique de défaillance** : un serveur MCP **agrège les accès** → un seul serveur compromis = accès à tout ce qu'il touche.
- L'OWASP a une *MCP Security Cheat Sheet* dédiée. Pour une fintech, **exposer un serveur MCP à des clients tiers (ChatGPT…) est une décision lourde**, pas un détail.

> **Conclusion :** MCP est la **bonne destination** pour « AI-native multi-canal ». Mais la **première marche**, c'est l'**auto-génération du catalogue** (lève le plafond, profite à Mola tout de suite, **un seul** consommateur = risque minimal). MCP devient une **Phase B** simple **par-dessus** ce catalogue, le jour où tu as un **2ᵉ** consommateur.

---

## 4. L'architecture AI-native cible (qui réconcilie tout)

Le secret : **une seule couche de capacités**, **deux façons de la servir**.

```
        ┌──────────────────────────────────────────────────────┐
        │   COUCHE DE CAPACITÉS (générée depuis types.ts +      │
        │   annotations : permission, confirm, danger, resolve) │   ← la vraie valeur, doc 14
        └───────────────┬───────────────────────┬──────────────┘
                        │ adaptateur in-process  │ adaptateur MCP (mcp-lite)
                        ▼                         ▼
                  Mola (edge, aujourd'hui)   Serveur MCP "Bonzini" (edge, Phase B)
                                                  ▲       ▲        ▲
                                            Claude Desktop  ChatGPT  bot Telegram…
```
- **Tu écris la capacité UNE fois** (annotation). Elle alimente **et** Mola **et** le serveur MCP.
- L'UI humaine (React) consomme **les mêmes RPC** → humains et IA utilisent la **même** plateforme. C'est ça, **AI-native** : une surface unique, plusieurs consommateurs (IA d'abord, humain aussi), tous sous permission + confirmation.

---

## 5. AI-native, concrètement : quoi faire AUJOURD'HUI

| Étape | Quoi | Pourquoi | Effort |
|---|---|---|---|
| **1. Couche de capacités auto-générée** | générateur `types.ts` + annotations + resolvers (doc 14) | **lève le plafond 44 %→~100 %** ; Mola atteint toute la plateforme | moyen, 1 fois |
| **2. Garde-fous dans la couche** | permission / confirm argent / danger super_admin / PII / SQL scopé (déjà livrés) | « AI-native » ≠ « IA libre » : l'humain garde le contrôle | faible (réutilise l'existant) |
| **3. Adaptateur MCP (mcp-lite, edge)** | exposer la MÊME couche en serveur MCP | le jour d'un 2ᵉ consommateur (ton Claude Desktop, un bot) | **petit** (la couche existe déjà) |
| **4. Durcissement MCP fintech** | OAuth 2.1, scopes minimaux, allowlist de clients, descriptions d'outils signées/contrôlées, audit | obligatoire avant toute exposition réelle | à faire AVANT d'ouvrir |

**Règle d'or AI-first sécurisée :** d'abord l'IA **sous contrôle humain** (confirmation argent, permissions par rôle, audit), **serveur MCP interne** (Mola + toi), **jamais** ouvert à un client tiers non maîtrisé sans le durcissement de l'étape 4.

---

## 6. Réponse directe à ta question
- **« MCP est-il la meilleure option ? »** → **Oui comme cible** d'une plateforme AI-native multi-canal, **et c'est faisable sur ton edge** (mcp-lite). **Mais ce n'est pas la première marche** : il ne lève pas le plafond à lui seul, et sa valeur (multi-client) + son risque (sécurité fintech) ne se justifient qu'**après** la couche de capacités.
- **« Qu'est-ce qu'il faut faire aujourd'hui pour être AI-native ? »** → **L'étape 1** : la couche de capacités auto-générée depuis `types.ts`. Elle profite immédiatement à Mola, et elle est **la fondation** du serveur MCP de demain. On la conçoit « MCP-ready » dès le départ (séparation claire capacité ↔ adaptateur), pour que la Phase B (MCP) soit un branchement, pas une réécriture.

---

## Sources (datées)
- [Architecture overview — modelcontextprotocol.io](https://modelcontextprotocol.io/docs/learn/architecture) · [Spec RC 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) · [Roadmap 2026](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [Build MCP server with mcp-lite on Supabase Edge](https://supabase.com/docs/guides/functions/examples/mcp-server-mcp-lite) · [Supabase MCP server](https://supabase.com/blog/mcp-server)
- Sécurité : [OWASP MCP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html) · [Practical DevSecOps — MCP vulnerabilities 2026](https://www.practical-devsecops.com/mcp-security-vulnerabilities/) · [arXiv — tool poisoning threat modeling](https://arxiv.org/pdf/2603.22489)

*Deep dive posé. La couche de capacités d'abord ; MCP en branchement ensuite.*

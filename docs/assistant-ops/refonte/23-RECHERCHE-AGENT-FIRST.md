# 23 — Recherche : de l'app à boutons à l'app-agent (état de l'art vérifié)

> **Commande du founder (2026-06-11) :** « Mon rêve : tout passe par Mola. Mais je ne sais pas comment on
> construit une app comme ça. Il faut un gros travail de réflexion — documente-toi, va voir Reddit, les docs
> de projets et de technologies. » **Méthode :** 5 agents de recherche parallèles (architecture, UX, fiabilité
> fintech, latence, retours praticiens) → ~60 sources consultées (docs officielles Anthropic/OpenAI/Stripe/MCP,
> études académiques, jurisprudence, threads HN/Reddit, presse) → **vérification contradictoire** des 7
> affirmations les plus fragiles (verdicts intégrés ci-dessous). Complète le doc 22 (les 6 contrats) avec des
> preuves externes.

---

## 0. Le verdict, en trois phrases

1. **Ton cap est le bon — et ton intuition d'architecture aussi** : la « parité d'actions » (chaque action
   définie une fois, exposée à l'UI et à l'agent avec mêmes permissions et audit) est exactement la doctrine
   « agent-native » qui émerge en 2025-2026, et tes étiquettes `@mola` (kind/confirm/danger/permission)
   correspondent presque champ pour champ aux annotations standardisées du protocole MCP
   (`readOnlyHint`/`destructiveHint`) publiées en mars 2026.
2. **Mais la cible validée par le terrain n'est pas « le chat remplace les écrans »** : aucune source ne
   documente une équipe ayant réussi le « tout-agent sans UI » ; le cas le plus instructif est une équipe qui a
   remplacé un formulaire d'assurance qui marchait par un chatbot → chute du taux de complétion → retour
   gagnant via le « formulaire génératif » (l'IA pré-remplit, l'humain édite et valide). La cible réelle :
   **l'agent atteint 100 % des actions ; toute action d'argent se matérialise en carte/file d'approbation ;
   les écrans deviennent des surfaces de contrôle.**
3. **Ton marché est l'exception qui te donne raison côté clients** : en Afrique subsaharienne, le
   conversationnel est déjà l'interface dominante de l'argent (GSMA : l'USSD porte >90 % des transactions
   mobile money ; WhatsApp >90 % des internautes au Nigeria/Kenya ; WhatsApp banking en production chez Absa
   depuis 2021). Le futur « les clients parlent à Mola sur WhatsApp » est crédible et documenté — c'est la
   dernière étape de la trajectoire, pas la première.

---

## 1. Les 7 leçons de l'industrie (sources vérifiées)

### L1 — Le chat est un canal ; l'action est une carte
La critique du « chat universel » est unanime chez les gens sérieux : Jakob Nielsen nomme « articulation
barrier » le coût d'exprimer son intention en prose (et les UI à prompt excluent les utilisateurs à littératie
basse) ; Amelia Wattenberger : la boîte de chat n'a aucune affordance (« good tools make it clear how they
should be used ») ; Allen Pike (2025) : « le chat devrait rester un mode de débogage, pas l'UX principale ».
Et les plateformes l'ont codifié : OpenAI Apps in ChatGPT (oct. 2025) impose des cartes inline avec **max
2 boutons d'action** ; Vercel (AI SDK) a industrialisé la « generative UI » où **le modèle ne génère pas
l'interface — il route vers des composants pré-construits branchés sur des données réelles** (zéro
hallucination d'affichage). → Tes cartes de confirmation sont déjà ce pattern. La suite logique n'est pas
moins d'UI, c'est plus de cartes : solde, fiche client, reçu, file d'attente.
Sources : nngroup.com/articles/ai-articulation-barrier · wattenberger.com/thoughts/boo-chatbots ·
allenpike.com/2025/post-chat-llm-ui · developers.openai.com/apps-sdk/concepts/ui-guidelines ·
vercel.com/blog/ai-sdk-3-generative-ui · dev.to/victor_desg (cas du formulaire d'assurance).

### L2 — « L'agent prépare, l'humain confirme » est le standard de l'industrie, pas une étape transitoire
Stripe (doc officielle agents) : « pour toute action qui déplace de l'argent…, demander l'approbation d'un
humain avant que l'agent exécute ». OpenAI (guide agents) : les paiements/remboursements sont les exemples
canoniques du human-in-the-loop obligatoire. Anthropic (« Measuring AI agent autonomy », 18 fév. 2026, ~1 M de
tool calls analysés) : **73 % des appels d'outils semblent avoir un humain dans la boucle ; 0,8 % seulement
des actions sont irréversibles**. Aucune banque documentée ne laisse un agent exécuter seul un mouvement
d'argent : Morgan Stanley (98 % des équipes de conseillers équipées) = recherche + brouillons, jamais
d'exécution ; même Visa/Mastercard ne lancent le paiement agentique qu'à l'intérieur de **mandats pré-approuvés,
plafonnés, tokenisés**. Et la jurisprudence existe : **Air Canada (tribunal de Colombie-Britannique, 14 fév.
2024)** — le chatbot avait inventé une politique de remboursement, l'entreprise a été condamnée : « le chatbot
fait simplement partie du site web d'Air Canada ». Tout ce que Mola affirme ou fait engage Bonzini.
Sources : docs.stripe.com/agents · anthropic.com/research/measuring-agent-autonomy · openai.com/index/morgan-stanley ·
canlii.org (2024 BCCRT 149) · usa.visa.com (Intelligent Commerce).

### L3 — Les garde-fous qui sauvent sont déterministes et vivent dans le code, jamais dans le prompt
Les échecs publics sont tous des sorties non contraintes : Cursor (avr. 2025) — le bot support **invente une
politique** → vague d'annulations d'abonnements, excuses publiques du cofondateur ; chatbot MyCity de NYC —
conseils illégaux, supprimé en 2026. Les architectures qui marchent encadrent par du code : Ramp publie ses
« autonomy sliders » avec **règles déterministes (plafonds en dollars, listes bloquées)** et affirme que
&gt;65 % des approbations de dépenses sont traitées par son agent (chiffre auto-déclaré ; l'auto-approbation
reste un opt-in client) ; OpenAI prescrit la **notation de risque par outil** (low/medium/high selon
lecture/écriture, réversibilité, impact financier) ; le spec MCP précise que les annotations sont des hints
**non garantis** — l'enforcement reste côté serveur. → Chez Bonzini : RPC SECURITY DEFINER, plafonds, permissions
par rôle, garde-fou d'unité de taux = la bonne couche. À compléter : **clés d'idempotence** sur les créations
(anti double-tap/retry) et preview systématique avant confirmation.
Sources : theregister.com (Cursor) · themarkup.org (MyCity) · builders.ramp.com/post/how-to-build-agents-users-can-trust ·
cdn.openai.com (guide agents) · blog.modelcontextprotocol.io (tool annotations, 16 mars 2026).

### L4 — La mathématique du compounding impose des agents étroits et des étapes vérifiées
Le post praticien le plus discuté de 2025 (Utkarsh Kanwat, 12+ systèmes en prod ; 427 points sur HN) : à 95 %
de fiabilité par étape, une tâche de 20 étapes réussit 36 % du temps ; même à 99 %, 82 %. Ce qui marche chez
lui : des agents à **3-5 opérations délimitées, points de vérification explicites, humain sur les décisions
critiques**. Sierra (Bret Taylor) industrialise la parade : des **modèles superviseurs** inspectent le
raisonnement de l'agent (« un système juste 90 % du temps chaîné à un superviseur juste 90 % du temps donne
99 % ») — et ne se fait payer **qu'à la résolution vérifiée**. Cognition (Devin) : « Don't build multi-agents » —
une seule boucle, un historique plat, partager les traces complètes. → Mola doit rester UN agent, et ses flux
du quotidien (dépôt, paiement) doivent rester courts : 2-4 outils par tâche, chaque étape vérifiable.
Sources : utkarshkanwat.com/writing/betting-against-agents · news.ycombinator.com/item?id=44623207 ·
cheekypint.substack.com (interview Bret Taylor) · cognition.ai/blog/dont-build-multi-agents.

### L5 — Les outils : consolider, décrire, charger à la demande
Anthropic (« Writing tools for agents », sept. 2025) déconseille explicitement le « 1 endpoint = 1 outil » :
construire des **outils-workflows** (`schedule_event` plutôt que `list_users`+`list_events`+`create_event` ;
`get_customer_context` plutôt que 3 lectures). **Les descriptions sont le levier n°1 documenté** (un état de
l'art SWE-bench obtenu par simple raffinement de descriptions) ; les « tool use examples » font passer la
précision de paramétrage de 72 % à 90 %. Au-delà d'une quinzaine d'outils qui se chevauchent, la sélection se
dégrade (OpenAI : « certains gèrent 15+ outils distincts, d'autres échouent avec 10 qui se chevauchent ») ;
les parades mesurées : **tool search / chargement différé (−85 % de tokens d'outils, précision Opus 4 de 49 %
à 74 %)**, namespacing, shortlist adaptative (étude Meta 2026 : même couverture avec ~7 outils montrés qu'avec
50). → Implication directe pour les **77 outils** de Mola : consolider les lectures fréquentes en outils-contexte,
soigner chaque description comme un artefact versionné, et envisager le chargement différé.
Sources : anthropic.com/engineering/writing-tools-for-agents · anthropic.com/engineering/advanced-tool-use ·
guide OpenAI (PDF) · arxiv.org/html/2605.24660v2 (Meta).

### L6 — La latence : économiser des allers-retours, et mettre l'attente en scène
Le benchmark OSWorld-Human (2025) : les appels de « planning/réflexion » consomment **75-94 % du temps** d'un
agent ; les agents prennent 1,4-2,7× plus d'étapes que nécessaire. Les leviers chiffrés : **prompt caching**
(−75 % de latence sur conversation multi-tours — chiffres officiels Anthropic), **appels d'outils en
parallèle**, fusion des étapes (un tour = toutes les lectures), et « don't default to LLM » (les listes et
suggestions instantanées viennent du cache applicatif, pas du modèle). Le réglage du raisonnement compte :
le raisonnement étendu à fond peut coûter ~28 s de premier token — pour un assistant interactif, régler
l'effort (notre secret `ASSISTANT_EFFORT`) et mesurer. Et un résultat contre-intuitif (étude CHI 2026, TTFT
2 s vs 9 s vs 20 s) : sur les décisions sérieuses, **une réponse en 9-20 s mise en scène comme une délibération
inspire PLUS confiance qu'une réponse en 2 s** — au-delà de ~20 s sans signal, la confiance s'effondre. Le
pattern gagnant : streamer des étapes nommées (« Je vérifie le solde de KAMDEM SARL… »), puis la carte.
→ L'agent ne battra jamais le formulaire sur la tâche unitaire ; il gagne quand il remplace 3 écrans + saisie
par une phrase, et ça se mesure.
Sources : arxiv.org/abs/2506.16042 · claude.com/blog/prompt-caching · developers.openai.com (latency guide) ·
arxiv.org/abs/2604.06183 (CHI 2026) · langchain.com/blog/how-do-i-speed-up-my-agent.

### L7 — La qualité se pilote par la queue de distribution et les evals — pas par le ressenti
**Klarna, le cas d'école (vérifié)** : fév. 2024 — l'assistant absorbe 2,3 M de conversations le premier mois,
« l'équivalent de 700 agents » (externalisés, jamais licenciés directement) ; mai 2025 — le CEO admet que le
coût a trop primé sur la qualité et réembauche des humains pour les cas complexes… **sans abandonner l'IA**,
qui traite toujours ~2/3 des conversations à l'IPO (sept. 2025). Leçon : leurs métriques de volume masquaient
la dégradation sur les cas difficiles — piloter la queue, pas la moyenne. Intercom Fin est passé de ~65 %
(juil. 2025) à 76 % (juin 2026) de résolution moyenne (chiffres auto-déclarés) **par itérations outillées et
evals continues**, pas par magie de modèle. L'enquête LangChain (déc. 2025, 1 340 répondants) : la **qualité
est le premier blocage (32 %), devant la latence (20 %)** ; 89 % ont de l'observabilité mais **52 % seulement
font des evals** — le maillon négligé. Le « 95 % des pilotes GenAI échouent » du MIT (août 2025) est à manier
avec prudence (étude préliminaire, non peer-reviewed, définition étroite du succès : impact P&L à 6 mois) —
mais sa conclusion robuste nous arrange : **le ROI démontré est dans le back-office étroit et gouverné**
(notre cas), pas dans les chatbots vitrines. Stanford (Enterprise AI Playbook, mars 2026, 51 déploiements
réussis) : 77 % des difficultés sont organisationnelles, et l'observabilité doit précéder la prod ; 61 % des
projets réussis ont connu un échec préalable — l'état actuel de Mola est donc... normal.
Sources : klarna.com (press fév. 2024) · customerexperiencedive.com (mai 2025) · intercom.com/blog
(from-resolutions-to-outcomes) · langchain.com/state-of-agent-engineering · fortune.com + marketingaiinstitute.com
(MIT, avec critique) · digitaleconomy.stanford.edu (playbook).

---

## 2. La trajectoire validée (et ses critères de bascule chiffrés)

Aucune équipe documentée n'a sauté directement au « tout-agent ». La trajectoire observée :

| Étape | Ce qui se passe | Critère de passage à la suivante |
|---|---|---|
| **1. Assistant fiable sur un domaine** | lecture + actions à confirmation, observabilité dès le jour 1 | taux de réussite de tâche stable sur la **distribution réelle** (queue comprise, leçon Klarna) |
| **2. Parité d'actions** | 100 % des capacités atteignables par l'agent (mêmes permissions/audit que l'UI) | la CI force l'étiquetage (déjà fait : parité `@mola`) ; zéro action « l'écran sait, l'agent non » |
| **3. Agent par défaut, flux par flux** | l'agent devient le chemin nominal d'UN flux (ex. dépôt déclaré), l'écran reste en secours | l'agent **bat l'écran en temps-par-tâche** sur ce flux ET taux d'escalade vers l'écran ≤ 10-15 % |
| **4. Multi-canal & proactivité** | WhatsApp/Telegram côté équipe puis clients ; l'agent initie (alertes, files d'approbation) | confiance établie à l'étape 3 + seuils de montants + échantillonnage de contrôle 20-30 % sur le bas-risque |

Les chiffres de pilotage cités par les praticiens : taux de réussite par tâche (sur distribution réelle),
temps-par-tâche agent vs écran, % d'escalade humaine (cible 10-15 %), usage hebdomadaire par opérateur,
taux de rejet des cartes de confirmation (un « circuit breaker » si &gt;~30 % de rejets = l'agent propose mal).

**Où est Bonzini :** étape 1 consolidée aujourd'hui (cerveau unifié + catalogue injecté), étape 2 aux 3/4
(il reste ~la moitié des outils à migrer en étiquettes + les trous de parité ci-dessous). Le rêve « tout passe
par Mola » = étapes 3-4, accessibles **flux par flux, à la mesure**.

---

## 3. Ce que ça donne pour Bonzini (la cible en trois surfaces)

```
   ┌─ DÉLÉGUER ────────────┐   ┌─ APPROUVER ──────────────┐   ┌─ CONTRÔLER ────────────┐
   │ le chat Mola          │   │ cartes de confirmation    │   │ écrans actuels          │
   │ (texte, vocal,        │ → │ + FILE D'APPROBATIONS     │ → │ (listes, détail, audit) │
   │ demain WhatsApp)      │   │ (l'agent prépare, pousse) │   │ = vues de vérification  │
   └───────────────────────┘   └──────────────────────────┘   └────────────────────────┘
```

- Le **chat** est l'entrée des intentions (« dépôt de 5M pour Jonas, preuve jointe »).
- La **carte / file d'approbations** est l'unité de travail : à terme, Mola n'attend pas qu'on lui parle —
  il prépare (dépôts à valider, paiements en souffrance, propositions du radar) et pousse dans une inbox
  d'approbations. C'est le pattern « ambient agent + agent inbox » (LangChain), et c'est la moitié de la
  « proactivité de Claude » : le droit de parler en premier.
- Les **écrans** ne disparaissent pas : ils deviennent le filet de contrôle (vérifier, auditer, reprendre la
  main) — exactement ce que font Ramp, Intercom et les banques. Les formulaires de saisie, eux, ont vocation
  à s'effacer derrière l'agent au rythme des critères de l'étape 3.
- **Côté clients (étape 4)** : WhatsApp est crédible et documenté en Afrique (Absa « Abby » au Kenya depuis
  2021, ~200 000 utilisateurs actifs ; partenariat Paymentology/Chikwama annoncé en mars 2026 pour une
  néo-banque WhatsApp SADC) — mêmes capacités, permissions client, mêmes cartes.

---

## 4. Trous de parité concrets révélés par tes exemples (pour le backlog, pas pour aujourd'hui)

Le principe (validé par L5 — Anthropic « consolider, penser workflow ») : **un outil doit accepter les entrées
dans la forme où l'humain pense, et dériver le reste de façon déterministe dans le code.**

1. **`create_payment` n'accepte que `amount_xaf`** alors que l'écran accepte XAF *ou* CNY et convertit dans
   les deux sens — et le prompt interdit (à raison) au modèle de convertir de tête. → l'outil doit accepter
   `amount_xaf` OU `amount_rmb` (+ taux), dériver l'autre dans `prepare`, afficher les deux sur la carte.
2. **`record_usdt_purchase` exige `usdt_amount` + `xaf_amount`** alors qu'un trader pense « 5 000 USDT au taux
   620 » : accepter 2 valeurs du triangle {usdt, xaf, taux}, dériver la 3e, afficher le triangle complet.
   Idem `record_usdt_sale` (CNY/USDT).
3. **Clés d'idempotence** sur toutes les créations (anti double-tap / retry d'agent) — L3.
4. **Tool-use examples** dans les définitions des 5-6 outils les plus critiques (+72 %→90 % de précision
   de paramétrage documenté) — L5.
5. **Consolidation lecture** : un `get_client_context` (fiche + solde + dernières opérations + alertes radar)
   pour remplacer 3-4 appels — L5/L6.
6. **File d'approbations** (inbox de cartes en attente, hors conversation) comme évolution UI prioritaire — §3.
7. **Mesure** : instrumenter temps-par-tâche (agent vs écran), taux d'escalade vers l'écran, taux de rejet des
   cartes — sans ces trois compteurs, impossible de déclarer un flux « agent par défaut » (étape 3).

---

## 5. Limites honnêtes de cette recherche

- Beaucoup de chiffres positifs viennent des vendeurs eux-mêmes (Intercom, Ramp, Dust) — marqués comme
  auto-déclarés ; les études chocs (« 95 % échouent ») mesurent des définitions étroites du succès.
- Les retours Reddit/HN sont anecdotiques par nature ; je n'ai retenu que les patterns confirmés par plusieurs
  voix indépendantes (retour aux formulaires, compounding d'erreurs, evals négligées).
- La doctrine « agent-native » est récente (2025-2026) : peu de recul long ; c'est une raison de plus pour
  avancer flux par flux, à la mesure, plutôt que par bascule globale.

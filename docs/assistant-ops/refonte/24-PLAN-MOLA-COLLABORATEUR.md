# 24 — LE PLAN : faire de Mola un vrai collaborateur

> **Commande du founder (2026-06-11) :** « Creuse encore beaucoup plus et donne-moi un vrai plan pour réaliser
> mon rêve. Je veux que Mola devienne un vrai collaborateur. »
> **Fondations :** doc 22 (les 6 contrats), doc 23 (état de l'art vérifié, 60+ sources), audit interne du
> 2026-06-11 (chiffres ci-dessous). Ce document est **le plan de référence** — chaque phase a un objectif, des
> chantiers précis, un critère de sortie mesurable, et la part founder / la part dev.

---

## 1. « Un vrai collaborateur », opérationnalisé

Un collaborateur n'est pas un chatbot performant. Six attributs, chacun **testable** :

| # | Attribut | Test de réussite |
|---|---|---|
| C1 | **Il sait tout faire** (parité) | zéro « je ne peux pas » injustifié sur une semaine d'usage réel ; CI de parité verte |
| C2 | **Il fait bien et vite** les gestes du quotidien | temps-par-tâche ≤ écran sur les flux basculés ; zéro erreur d'argent (unité, montant, bénéficiaire) |
| C3 | **Il parle en premier** (proactivité) | digest quotidien + ≥5 propositions utiles/semaine poussées sans qu'on lui demande |
| C4 | **Il apprend** | score du juge qualité qui monte mois après mois ; chaque raté réel devient un test de régression |
| C5 | **Il est là où l'équipe vit** | joignable hors de l'app (Telegram équipe, à terme WhatsApp clients) |
| C6 | **Il rend des comptes** | audit complet de chaque action (qui a confirmé, quand), coût suivi, réponses IA étiquetées |

---

## 2. État des lieux chiffré (audit du 2026-06-11)

| Brique | État | Détail |
|---|---|---|
| Cerveau v2 (Opus 4.8, thinking adaptatif, catalogue injecté, garde-fou taux) | ✅ codé, **à déployer** | commit `8afd128` |
| Parité d'actions | 🟡 **~85-90 %** | 59 RPC ; ~44 étiquetées `@mola` exposées (19 = doublons d'outils dédiés) ; **6 OFF par décision founder** (gestion admin, resets) ; ~9 à vérifier/taguer |
| Outils dédiés | ✅ 81 (53 lecture + 28 écriture) | mais des trous de FORME (montants ¥, triangle USDT — §Phase 1) |
| Proactivité : radar + digest Telegram (cron 06:00 UTC) | 🔴 **construit mais INERTE** | il manque 2 secrets Vault : `telegram_bot_token`, `telegram_chat_id` |
| Canal Telegram | ✅ bot déployé | sert au monitoring des taux (Binance P2P) — réutilisable |
| File d'approbations | 🟡 table `assistant_pending_actions` OK | **pas d'écran inbox** — les cartes ne vivent que dans le chat |
| Mémoire (sémantique, épisodique, profil admin, compaction) | ✅ construite | `mola_memory`, `mola_user_memory`, résumé roulant |
| Boucle qualité (juge, porte CI, workflow GitHub) | 🔴 construite, **jamais lancée en réel** | 17 cas d'éval ; baseline `seeded: false` |
| Instrumentation coût | ✅ par requête | `est_cost_usd` dans `admin_audit_logs` |
| Instrumentation temps-par-tâche / taux de repli | ❌ absente | indispensable pour la bascule (Phase 3) |

**Lecture honnête : ~70 % de l'infrastructure du rêve existe déjà. Le plan consiste à allumer (Phase 0),
parfaire les mains (Phase 1), donner l'initiative (Phase 2), basculer à la mesure (Phase 3), étendre (Phase 4)
— avec un système d'amélioration transverse qui tourne en continu.**

---

## Phase 0 — Allumer ce qui existe (cette semaine, quasi zéro code)

**Objectif :** la v2 en service, la proactivité allumée, la mesure de référence figée.

| Chantier | Qui | Comment |
|---|---|---|
| Déployer le cerveau v2 | founder (ou moi sur go) | `supabase functions deploy admin-assistant` |
| Allumer le digest quotidien | founder | poser `telegram_bot_token` + `telegram_chat_id` dans Vault (mêmes valeurs que les secrets Edge existants) → le cron de 06:00 part tout seul |
| Premier run de la boucle qualité + figer la baseline | founder/moi | `deno run … quality-run.ts --update-baseline` (besoin des secrets) |
| Test réel des 4 flux | founder + 1 admin | dépôt déclaré · paiement avec bénéficiaire · modification bénéficiaire · paiement à taux dicté (« taux 86 » doit être converti et affiché) |
| Choix du modèle | founder | comparer Opus 4.8 (défaut) vs Fable 5 (`ASSISTANT_MODEL=claude-fable-5`) sur ~20 tâches réelles : qualité ressentie + `est_cost_usd` réel + latence. Si la latence gêne : `ASSISTANT_EFFORT=medium` |

**Critère de sortie :** les 4 flux passent en réel sans erreur d'argent ; le digest est arrivé sur Telegram un
matin ; la baseline qualité est figée (`seeded: true`).

---

## Phase 1 — Les mains d'un pro (semaines 1-3)

**Objectif :** plus jamais « il ne sait pas faire » — les outils acceptent les entrées **dans la forme où
l'humain pense** et dérivent le reste dans le code (leçon L5 du doc 23).

Chantiers (par ordre d'impact) :

1. **Paiement bidirectionnel** : `create_payment` accepte `amount_xaf` OU `amount_rmb` (+ taux éventuel) ;
   `prepare` dérive l'autre côté avec le taux retenu, la carte affiche les DEUX montants + le taux + la source
   du taux. (Ton exemple n°1.)
2. **Triangle USDT** : `record_usdt_purchase` / `record_usdt_sale` acceptent 2 valeurs au choix parmi
   {usdt, contre-valeur, taux} et dérivent la 3e ; carte = triangle complet. (Ton exemple n°2.)
3. **Idempotence** : clé d'idempotence sur toutes les créations (dépôt, paiement, achat/vente) — anti
   double-tap et anti-retry d'agent (leçon L3).
4. **Exemples d'usage** (`tool use examples`) sur les 6 outils critiques — gain documenté de précision de
   paramétrage 72 % → 90 % (leçon L5).
5. **`get_client_context`** : un outil de lecture consolidé (fiche + solde + 5 dernières opérations + alertes
   radar du client) → remplace 3-4 appels, accélère chaque conversation (leçons L5/L6).
6. **Boucher la parité** : taguer les ~9 RPC restantes (ou `expose:false` motivé) ; **décision founder** sur
   les 6 OFF (gestion admin / resets de mot de passe : ON avec super_admin+danger, ou OFF définitif).
7. **Étendre l'éval à 40+ cas** : un cas par flux du quotidien + les pièges connus (taux dicté en XAF/¥,
   montant en ¥, homonymes, solde insuffisant, multi-actions dans un message).

**Critère de sortie :** tes deux exemples passent en une passe ; éval 40+ cas verte ; une semaine d'usage réel
sans « je ne peux pas » injustifié (les admins notent chaque occurrence — c'est le carnet de bord de la phase).

---

## Phase 2 — Le collaborateur qui parle en premier (semaines 3-6)

**Objectif :** inverser l'initiative. Un collaborateur ne fait pas qu'exécuter : il arrive le matin avec
« voilà ce qui demande ton attention, voilà ce que je propose ».

1. **File d'approbations (inbox)** — l'évolution UI prioritaire (pattern « ambient agent + agent inbox »,
   leçon §3 du doc 23) : un écran qui liste les `assistant_pending_actions` en attente, hors conversation,
   avec tri par urgence/montant. L'admin ouvre l'app → il voit la file, pas un chat vide.
   *(Construction avec le skill `/frontend-design`, règle CLAUDE.md.)*
2. **Propositions proactives** : chaque matin (et sur événement), Mola transforme le radar en **cartes
   pré-préparées** : « dépôt BZ-DP-… en admin_review depuis 52 h → je propose de le valider (carte) »,
   « paiement en souffrance → relancer / traiter », « solde dormant chez X → suggérer un contact ».
   Techniquement : un cron qui appelle l'edge avec un rôle système, crée des pending_actions taguées
   `initiated_by: mola`.
3. **Digest enrichi + alertes critiques temps réel** (paiement bloqué > seuil, taux perso anormal) sur
   Telegram équipe.
4. **Circuit breaker** : si le taux de rejet des cartes dépasse ~30 % sur une fenêtre glissante, Mola réduit
   ses propositions et le signale (leçon L1/L3 — l'agent qui propose mal doit se calmer tout seul).

**Critère de sortie :** ≥5 propositions/semaine **acceptées** ; taux d'acceptation des cartes ≥70 % ; les
admins citent spontanément une alerte qui a évité un problème (le test qualitatif du « collaborateur »).

---

## Phase 3 — L'agent par défaut, flux par flux (semaines 6-10)

**Objectif :** réaliser « tout passe par Mola » là où c'est MÉRITÉ — à la mesure, jamais à la croyance
(leçon Klarna : piloter la queue, pas la moyenne).

1. **Instrumenter d'abord** : temps-par-tâche (création→confirmation) via Mola vs via écran ; taux de repli
   vers l'écran ; taux de rejet de cartes ; usage hebdo par admin. (Sans ces compteurs, aucune bascule.)
2. **Basculer le 1er flux : le dépôt déclaré** (le plus court, le plus fréquent) — l'entrée par défaut devient
   Mola (raccourci visible, l'écran reste accessible en secours).
3. **Puis le paiement fournisseur**, puis les suivants — un à la fois.
4. **Conduite du changement** (Stanford : 77 % des difficultés sont organisationnelles) : un admin champion
   par flux ; commencer par « la tâche que l'équipe déteste le plus » ; le founder utilise Mola devant
   l'équipe ; chaque frustration notée part dans la boucle qualité, pas dans l'oubli.

**Critère de bascule par flux (tous les trois requis) :** temps médian Mola ≤ temps médian écran · taux de
repli ≤ 15 % · zéro incident d'argent sur le flux depuis 2 semaines. Un flux qui ne tient pas les critères
reste sur écran — sans état d'âme.

---

## Phase 4 — Mola partout, puis Mola clients (mois 3-6)

**Objectif :** ton rêve complet — l'équipe parle à Mola sans ouvrir l'app, puis les clients parlent à Bonzini.

1. **Telegram interactif équipe** : le bot existe déjà — le brancher sur l'edge `admin-assistant`
   (mapping chat_id ↔ admin authentifié, mêmes permissions, cartes rendues en boutons inline Telegram).
   L'admin en déplacement dicte « dépôt de 2M pour Kamdem, preuve jointe » depuis Telegram.
2. **Mola clients sur WhatsApp** (WhatsApp Business API) — périmètre v1 volontairement étroit :
   consulter solde/taux du jour, suivre ses paiements, **déclarer un dépôt avec photo de preuve**, demander
   un paiement (que l'équipe confirme). Permissions client strictes, mêmes RPC, cartes adaptées au canal.
   Le précédent existe (chat banking africain en production depuis 2018-2021, doc 23 §0.3) — et c'est LE
   canal naturel de tes importateurs.
3. **Pilote fermé** : 5-10 clients fidèles, 4 semaines, mesure (temps de réponse, NPS, incidents).

**Critère de sortie :** pilote client sans incident d'argent ; ≥50 % des interactions du pilote résolues sans
intervention humaine (hors confirmations) ; décision d'élargissement fondée sur les chiffres.

---

## Transverse — le système qui s'améliore tout seul (en continu dès Phase 0)

C'est ce qui remplace définitivement « je viens te rapporter les pannes » :

- **Rituel hebdo founder — 30 minutes, non négociable** : lire le rapport du juge (axe faible, thèmes) →
  trancher 1-3 améliorations (playbook/outil/étiquette) → la porte CI vérifie que le score ne baisse pas →
  figer la nouvelle baseline quand ça monte. *(Sans ce rituel, le contrat de mesure est mort — doc 22 §3.4.)*
- **Chaque raté réel → un cas dans `cases.ts`** (promotion systématique ; à terme automatisée par le runner).
- **Paliers d'autonomie par capacité** (à la Ramp) : tout commence en « confirmation obligatoire » ;
  l'élargissement éventuel (ex. exécution directe des lectures enrichies, pré-validation sous seuil de
  montant) se décide **par capacité, par palier, par le founder** — jamais globalement. L'argent reste
  confirmé par un humain à tous les paliers (standard de l'industrie, doc 23 L2).
- **Convention dev qui ne bouge plus** (CLAUDE.md) : toute nouvelle RPC = étiquette `@mola` + cas d'éval dans
  la même PR. La CI casse sinon. C'est le contrat de capacité — la raison pour laquelle Mola ne sera plus
  jamais « en retard » sur le produit.

---

## Budget de fonctionnement (ordre de grandeur honnête)

Prefixe caché (system + 81 outils + catalogue) ≈ 30-40K tokens → en régime de cache : ~0,02 $ de lecture de
cache + sortie par tour. **Estimation : 0,05-0,15 $ par tâche complète sur Opus 4.8** (3-5 itérations) ;
×~2,5 sur Fable 5. À 100 tâches/jour pour toute l'équipe : **~150-450 $/mois** (Opus) — à confronter au temps
admin économisé. Le réel est déjà mesuré par requête (`est_cost_usd` dans l'audit) : une requête SQL le suit,
et le rapport hebdo doit l'afficher. Le juge qualité ajoute quelques dollars par run hebdo.

---

## Les décisions qui t'appartiennent (avec échéance)

| # | Décision | Quand |
|---|---|---|
| D1 | Modèle : Opus 4.8 vs Fable 5 (sur mesure réelle, pas l'intuition) | fin Phase 0 |
| D2 | Les 6 capacités OFF (gestion admin, resets) : ON gardé super_admin+danger, ou OFF définitif | Phase 1 |
| D3 | S'engager sur le rituel hebdo de 30 min (ou le déléguer nominalement) | Phase 0 |
| D4 | Le 1er flux à basculer en « Mola par défaut » | début Phase 3 |
| D5 | Seuils d'autonomie par palier (quoi reste confirmé à vie : tout l'argent — quoi peut se relâcher) | Phase 3 |
| D6 | Périmètre exact du pilote clients WhatsApp (qui, quoi, combien de temps) | Phase 4 |

## Anti-pièges (rappels des docs 22/23 — à relire avant chaque phase)

1. Ne jamais basculer un flux sans les 3 critères chiffrés (leçon Klarna : le volume masque la qualité).
2. Ne jamais relâcher la confirmation humaine sur l'argent — c'est le standard de l'industrie ET ton bouclier
   juridique (Air Canada), pas une roue d'entraînement.
3. Les garde-fous vivent dans le code (unités, plafonds, idempotence) — le prompt oriente, le code verrouille.
4. Un seul agent, des flux courts (compounding d'erreurs) — pas de multi-agents pour les opérations.
5. Les chiffres des vendeurs (y compris les nôtres) sont auto-déclarés tant qu'ils ne sont pas mesurés chez toi.
6. 61 % des projets réussis ont connu un échec préalable (Stanford) : l'état de Mola début juin était normal —
   la différence se fait sur la boucle de mesure, pas sur le talent.

---

## Calendrier récapitulatif

| Phase | Fenêtre | Livrable phare | Critère de sortie |
|---|---|---|---|
| 0 — Allumer | semaine 0 | v2 déployée + digest actif + baseline figée | 4 flux réels OK, modèle choisi |
| 1 — Les mains | sem. 1-3 | montants ¥⇄XAF, triangle USDT, idempotence, parité 100 % | éval 40+ verte, zéro « je ne peux pas » injustifié |
| 2 — L'initiative | sem. 3-6 | inbox d'approbations + propositions proactives | ≥70 % d'acceptation des cartes |
| 3 — Par défaut | sem. 6-10 | 1er puis 2e flux basculés, instrumentation | temps ≤ écran, repli ≤ 15 % |
| 4 — Partout | mois 3-6 | Telegram équipe interactif, pilote WhatsApp clients | pilote sans incident, ≥50 % autonome |
| Transverse | continu | rituel hebdo + ratés→tests + paliers d'autonomie | score juge en hausse mois/mois |

*Le rêve « tout passe par Mola » n'est pas une bascule, c'est une conquête flux par flux — et chaque brique
du chemin est soit déjà construite, soit définie ci-dessus avec son critère de réussite.*

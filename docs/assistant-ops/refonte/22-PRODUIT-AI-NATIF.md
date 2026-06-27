# 22 — Produit AI-natif : pourquoi Claude « sait » et Mola « ne savait pas »

> **Question du founder (2026-06-11) :** « Pourquoi je dois venir te rapporter chaque panne une à une ?
> Comment on rend une app classique vraiment AI-native ? Comment on fait évoluer une app IA ?
> Claude sait construire un site sans qu'on lui explique — pourquoi Mola n'a pas cette proactivité ? »
> **Statut :** analyse + cadre d'évolution. S'appuie sur les docs 14 (AI-native diagnostic) et 21 (quality flywheel) — ne les répète pas, les prolonge.

---

## 1. La réponse courte

La « proactivité de Claude » n'est pas une fonctionnalité qu'on code. C'est une **propriété émergente** de quatre ingrédients multipliés :

```
intelligence (le modèle) × connaissance de soi (le contexte) × surface d'action (les capacités) × boucles (le feedback)
```

C'est une **multiplication**, pas une addition : un seul facteur proche de zéro et tout le produit s'effondre — peu importe la qualité des trois autres.
Claude Code a les quatre : un modèle frontière, la capacité de LIRE son environnement (fichiers, docs, schémas), des outils qui couvrent tout
(bash, édition, recherche), et des boucles de feedback immédiates (type-check, tests, erreurs).

Mola, jusqu'à aujourd'hui, avait les quatre **cassés ou affaiblis** :

| Ingrédient | Claude Code | Mola (avant le 2026-06-11) |
|---|---|---|
| **Intelligence** | Opus 4.8 / Fable 5 | **Haiku 4.5** décidait tout (compréhension, choix d'outil, montants, taux) ; Sonnet n'arrivait qu'APRÈS que l'action d'écriture était déjà construite |
| **Connaissance de soi** | lit ses fichiers, ses docs, son environnement | devait « penser à » appeler `find_capability` pour découvrir ce qu'il sait faire — un méta-réflexe qu'un petit modèle oublie |
| **Surface d'action** | bash = tout | 77 outils + catalogue @mola — la surface était LÀ (docs 14/16/17), mais invisible sans le réflexe ci-dessus |
| **Boucles** | type-check, tests, erreurs immédiates | la boucle qualité (doc 21) est construite mais **ne tourne pas en habitude** ; les ratés de prod ne redeviennent pas des cas d'éval |

Conclusion : les pannes que tu rapportais une à une (« il ne sait pas créer le paiement », « il s'est trompé de taux », « il est lent », « crise de 3 ans »)
n'étaient pas 50 bugs distincts. C'étaient **4 causes racines** qui produisaient 50 symptômes. Corriger un symptôme à la fois ne pouvait pas converger —
ton intuition était juste.

---

## 2. Ce que « AI-native » veut dire, concrètement (grille de maturité)

Pour savoir où on est et où on va, une échelle à 5 niveaux :

| Niveau | Nom | Description | Qui fait quoi |
|---|---|---|---|
| **N0** | App classique | Des écrans, des formulaires. L'IA n'existe pas. | L'humain manipule. |
| **N1** | IA *bolted-on* | Un chatbot à côté de l'app, quelques outils écrits à la main, toujours en retard sur le produit. | L'humain manipule, l'IA répond parfois. |
| **N2** | Surface d'actions unifiée | Chaque capacité métier = UNE définition (RPC + étiquette `@mola`) consommée par l'UI **et** l'IA. L'IA voit TOUT son catalogue dès le 1er token. La CI casse si une action n'est pas étiquetée. | L'humain délègue, l'IA exécute sous confirmation. |
| **N3** | Opérateur | L'IA exécute les flux de bout en bout ; les écrans deviennent des **vues de contrôle** (files d'attente, cartes de confirmation, audit) plus que des formulaires de saisie. Les nouveaux modules naissent *capability-first* : l'écran est optionnel. | L'humain confirme et supervise. |
| **N4** | Organisation IA | Multi-canal (admins, clients, Telegram/WhatsApp), **proactive** (elle parle en premier : radar, alertes, digests), **auto-améliorante** (la boucle qualité tourne seule, les ratés deviennent des tests). | L'humain gère par exception : grilles d'éval, expositions sensibles, argent. |

**Bonzini était entre N1 et N2. Avec le travail d'aujourd'hui, on est en N2 plein.** Le rêve que tu décris (« les admins n'ouvrent plus les écrans,
demain les clients parlent à Mola ») c'est N3 → N4 — et la route est dégagée parce que les fondations N2 (étiquettes @mola, parité CI, confirmation
humaine, masquage PII) existent déjà.

Point d'honnêteté : **N4 ≠ zéro humain.** Sur une fintech, l'humain reste le verrou de l'argent (la carte de confirmation) et l'arbitre des
expositions sensibles. Ce qui disparaît, c'est la *manipulation* (saisir des formulaires), pas la *responsabilité*.

---

## 3. Les 6 contrats du produit AI-natif

C'est LA réponse à « pourquoi je dois toujours venir te voir ». Un produit AI-natif n'est pas un produit sans pannes : c'est un produit où
**chaque classe de panne a un mécanisme qui la détecte et la corrige sans toi**. Six contrats, dont quatre existent déjà chez Bonzini :

1. **Contrat de capacité** *(existe — docs 14/16/17, CLAUDE.md)* : toute nouvelle action = RPC + étiquette `@mola` dans la même migration,
   et le test de parité casse la CI si on oublie. → L'IA ne peut plus être « en retard » sur le produit. *Une feature sans étiquette ne passe pas.*

2. **Contrat de connaissance** *(existe — playbook.ts, ontologie, et depuis aujourd'hui le catalogue injecté)* : tout le savoir métier vit dans
   des **artefacts versionnés** que l'IA reçoit dans son contexte — jamais uniquement dans la tête de quelqu'un ni dans un écran. Corollaire :
   quand Mola se trompe sur une règle métier, le correctif est UNE édition de playbook/ontologie, pas une conversation avec un développeur.

3. **Contrat de sécurité** *(existe — cartes de confirmation, permissions par rôle, masquage PII ; renforcé aujourd'hui par le garde-fou d'unité de taux)* :
   le prompt **oriente**, le code **verrouille**. Tout garde-fou d'argent (unités, soldes, plafonds, cohérence avec le taux du jour) vit dans
   les outils (`prepare`) — un modèle, même frontière, reste probabiliste ; le déterminisme est dans le code.

4. **Contrat de mesure** *(construit mais PAS en habitude — doc 21)* : la boucle qualité récolte les **vraies** conversations, les note sur la
   grille métier (profondeur, proactivité, ancrage, ton, actionnabilité), classe les thèmes faibles, promeut les pires ratés en cas de régression,
   et la porte CI refuse toute PR qui fait baisser le score. → **C'est ce contrat qui remplace « venir te voir ».** Les pannes de demain doivent être
   détectées par le rapport hebdo, pas par ta frustration. Il manque une seule chose : la lancer et figer la baseline (§5, P0).

5. **Contrat de modèle** *(mis en place aujourd'hui)* : le cerveau est un **réglage**, pas une dette. `ASSISTANT_MODEL` (secret) change le modèle
   en 30 secondes ; le code gère les différences d'API (réflexion adaptative, refus Fable 5, blocs thinking). Quand un meilleur modèle sort
   (Fable aujourd'hui, la suite demain), on le branche, on relance l'éval, on compare, on garde ou on revient. L'app « se met à jour » comme Claude
   se met à jour — parce que son intelligence est externalisée vers le fournisseur de modèles, et que NOTRE travail (capacités, connaissance,
   garde-fous, éval) est précisément ce qui survit aux changements de modèle.

6. **Contrat d'évolution** *(à adopter — c'est un changement de méthode, pas de code)* : chaque nouveau module se conçoit **Mola-first**.
   L'ordre change : ① la capacité (RPC + étiquette + garde-fous), ② le cas d'éval (« voici ce qu'un admin demandera en langage naturel, voici la
   bonne réponse »), ③ la carte de confirmation, ④ l'écran — seulement si le flux le justifie encore. La question de design n'est plus
   « quel formulaire ? » mais « **comment un humain délègue-t-il et vérifie-t-il cette action ?** ».

---

## 4. Comment le développement produit change (avant / après)

| | App classique (avant) | App AI-native (après) |
|---|---|---|
| **Une feature naît comme** | une spec d'écran | une capacité étiquetée + un cas d'éval |
| **L'UI est** | le produit | une vue de contrôle sur les capacités |
| **L'IA est** | un chatbot ajouté après | le premier consommateur de chaque capacité |
| **La qualité se mesure par** | tests manuels + ressenti | éval mécanique (grade) + juge-LLM (qualité) + porte CI |
| **Une régression se détecte** | quand le founder tombe dessus | au rapport hebdo / à la PR (porte) |
| **Un nouveau modèle IA** | refonte douloureuse | un secret à changer + un run d'éval |
| **Le rôle du founder** | rapporter les pannes, dicter les corrections | définir l'intention et les règles métier, approuver la grille d'éval, trancher les expositions sensibles, lire le rapport hebdo |

Le travail humain ne disparaît pas : il **monte d'un niveau**. Tu passes de « opérateur du correctif » à « concepteur des boucles » —
exactement la phrase d'ouverture du doc 21.

---

## 5. Feuille de route N2 → N4 (priorités, sans coder aujourd'hui)

- **P0 — Mettre la v2 en service et fermer la boucle (cette semaine).**
  Déployer `admin-assistant` (cerveau unifié Opus 4.8 + catalogue injecté + garde-fou taux), tester en réel les 4 flux du quotidien
  (dépôt déclaré, paiement avec bénéficiaire, modification de bénéficiaire, paiement à taux dicté), lancer le premier run de la boucle qualité et
  **figer la baseline** (`--update-baseline`). Décision founder : Opus 4.8 vs Fable 5 (`ASSISTANT_MODEL=claude-fable-5`) — à trancher sur l'éval
  et le coût ($5/$25 vs $10/$50 par MTok, ~+30 % de tokens sur Fable), pas sur l'intuition.
- **P1 — Finir la Phase A du doc 14.** Migrer les ~19 outils écrits à la main vers des étiquettes (mêmes garanties, moins de code), étendre les
  résolveurs (comptes trésorerie, bénéficiaires par alias), trancher les capacités sensibles encore OFF (gestion admin, resets de mot de passe).
- **P2 — Proactivité sortante.** Le radar (`mola_operations_radar`) et le digest Telegram existent déjà (doc 21, slice 4 — inerte sans les secrets).
  La moitié de la « proactivité de Claude », c'est simplement le **droit de parler en premier** : alertes dépôt bloqué >48 h, paiement en souffrance,
  solde dormant, taux perso anormal — poussées vers l'équipe, sans question posée.
- **P3 — Mola côté clients.** Mêmes capacités, permissions client (son wallet, ses paiements, ses bénéficiaires), confirmations adaptées, canal
  WhatsApp/Telegram/web. C'est ton rêve « le client demande, Mola fait » — il se construit sur N2/N3, pas à côté.
- **P4 — Multi-agents / MCP (doc 15).** Exposer le registre de capacités en serveur MCP quand le multi-canal le justifiera.

---

## 6. Ce qui a été corrigé le 2026-06-11 (et pourquoi c'était structurel)

Voir le commit du même jour. En une ligne chacun, avec la **classe de pannes** que ça ferme :

1. **Cerveau unifié** : un seul modèle frontière (défaut `claude-opus-4-8`, surchargeable par secret `ASSISTANT_MODEL`, Fable 5 géré) pilote toute
   la boucle, avec réflexion adaptative. Avant, Haiku choisissait les arguments des actions d'argent. → ferme « il se trompe de taux/montant »,
   « il ne comprend pas », « crise de 3 ans », et une partie de la lenteur (moins d'itérations ratées, cache de prompt stable).
2. **Catalogue de capacités injecté dans le prompt** (scan live des étiquettes `@mola` à chaque requête). → ferme « il ne sait pas qu'il peut le faire ».
3. **Garde-fou d'unité sur les taux personnalisés** dans `create_payment` : l'unité plateforme est ¥/1M XAF (~11 500) mais un admin dicte « taux 86 »
   (XAF/¥) ; conversion automatique quand elle colle au taux du jour (affichée sur la carte), refus motivé sinon, alerte d'écart >20 %.
   → ferme la classe « taux aberrant » **dans le code**, pas dans le prompt.
4. **Bug 400 de continuation** : une réponse coupée par la limite de tokens relançait l'API avec un message assistant en fin de conversation
   (= préremplissage, interdit sur les modèles 4.6+) → « Erreur de l'assistant ». Corrigé (continuation par tour user) + plafond 2 000 → 16 000 tokens.
5. **Prompt réécrit pour un modèle frontière** : flux métier en une passe, multi-cartes dans un tour, doctrine d'unité des taux, autonomie sur les
   petits choix / question uniquement quand l'argent est ambigu — au lieu des béquilles « NE DIS JAMAIS » écrites pour retenir Haiku.
6. Divers : tarifs Opus/Fable dans l'estimation de coût, refus Fable géré proprement, Haiku conservé uniquement pour les résumés de compaction.

**Pourquoi ce n'était pas « encore un correctif au cas par cas » :** chaque point ci-dessus ferme une *classe* de symptômes (cf. §1), et les
contrats du §3 — surtout le contrat de mesure — sont là pour que la prochaine classe soit détectée par une boucle, pas par toi.

---

## 7. Limites honnêtes

- Un agent LLM reste **probabiliste**. La fiabilité d'une fintech vient des garde-fous déterministes (code, confirmations, CI), jamais du prompt seul.
- La boucle qualité a un coût (quelques dollars de juge-LLM par run) et exige UNE habitude humaine : lire le rapport, trancher. Sans cette habitude,
  le contrat de mesure est mort et on revient au « founder qui rapporte les pannes ».
- Fable 5 coûte 2× Opus 4.8 et réfléchit plus longtemps par tour : pour un assistant interactif, Opus 4.8 est probablement le bon défaut, Fable
  l'option pour les cas les plus durs — mais c'est l'éval qui doit le dire.
- Le niveau N3/N4 demande des décisions de confiance qui n'appartiennent qu'au founder (expositions sensibles, canal client, droit d'initiative).

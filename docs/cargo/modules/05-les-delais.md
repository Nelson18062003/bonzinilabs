# MODULE 5 — Les délais
### ETD, ETA, et d'où sortent réellement les 40 jours

> **Ce module répond aux questions restées en suspens :**
> *ETD ? ETA ? Sur quoi tu te bases ? Pourquoi 38 jours ?*
>
> Il ne s'appuie presque plus sur de la théorie : on a désormais **des dates
> réelles de CMA CGM** et **un dossier réel complet**. On va les décortiquer.

---

# 1. Les quatre sigles

> 🕐 **ETD** — *Estimated Time of Departure*, **date de départ prévue**
> 🕐 **ETA** — *Estimated Time of Arrival*, **date d'arrivée prévue**
> ✅ **ATD** — *Actual Time of Departure*, **date de départ réelle**
> ✅ **ATA** — *Actual Time of Arrival*, **date d'arrivée réelle**

**Le mot qui compte est le premier : *Estimated*, « estimé ».**

> 🔑 **Une ETA n'est pas une promesse. C'est une prévision.**
>
> Quand CMA CGM t'affiche « arrivée le 31 octobre », il te dit : *« d'après le
> plan de rotation actuel du navire, on prévoit d'arriver le 31 »*. Le navire n'a
> pas encore quitté le quai. Il lui reste 39 jours de mer, deux ports d'escale et
> un transbordement à faire.

**Dans ton système Bonzini, ETA et ATA doivent être deux champs distincts.**
L'écart entre les deux, mesuré sur cent conteneurs, c'est la fiabilité réelle de
chaque ligne maritime — une donnée que tu auras et que tes concurrents n'auront pas.

---

# 2. Le piège n°1 — « 40 jours » ne veut pas dire ce que tu crois

C'est **l'erreur la plus coûteuse du métier**, et je dois être très clair.

> 🚢 **Transit time** (**temps de transit**) — le délai **de port à port**.
> Du moment où le navire quitte le port de chargement au moment où il arrive au
> port de déchargement.
>
> 🏭 **Délai porte-à-porte** (*lead time*, ou **cycle**) — le délai **de ton
> entrepôt de Guangzhou à l'entrepôt de ton client à Douala**.

**Les « 40 jours » de CMA CGM sont un transit time.** Ils ne contiennent :

| Pas de | |
|---|---|
| ❌ La production chez le fournisseur | |
| ❌ La collecte et la réception à ton entrepôt | |
| ❌ L'empotage | |
| ❌ Les 4 jours entre le booking et le départ | |
| ❌ **Le dédouanement à Douala** | ⬅️ **le plus gros morceau** |
| ❌ La sortie du terminal | |
| ❌ La livraison chez le client | |

> ⚠️ **Si tu promets 40 jours à un client, tu mens sans le savoir.** On va voir
> que le vrai chiffre, sur ton dossier réel, est **plus du double**.

---

# 3. Comment CMA CGM compte ses jours — vérifié

J'ai recoupé les deux cotations réelles :

| Offre | Départ | Arrivée à Douala | Jours écoulés | Jours affichés |
|---|---|---|---|---|
| Nansha | 22-Sep | 31-Oct | **39** | **40** |
| Shekou | 23-Sep | 31-Oct | **38** | **39** |

> ✅ **Conclusion : CMA CGM compte le jour de départ ET le jour d'arrivée.**
> Son « 40 jours » vaut **39 jours écoulés**, soit 39 nuits.
>
> Ce n'est pas de la tromperie, c'est une convention de comptage. Mais si tu
> construis un planning, **utilise 39, pas 40** — et applique la même convention
> partout, sinon tu accumules des jours fantômes.

---

# 4. La décomposition du vrai délai — cinq phases

Voici le cycle complet. 🟢 = date réelle vérifiée · 🟠 = estimation · 🟡 = inconnu

## Phase A — L'amont, avant qu'il y ait un conteneur

| Étape | Durée | Source |
|---|---|---|
| Commande → fin de production chez le fournisseur | 🟡 **inconnu** | dépend du produit |
| Collecte chez les fournisseurs → ton entrepôt | 🟡 **inconnu** | dépend de la ville |
| Réception, comptage, pesée, mesure | 🟠 1 à 2 jours | estimation |
| Consolidation et empotage | 🟠 1 jour | estimation |

**Je ne peux pas chiffrer cette phase** : elle dépend de tes fournisseurs et de ton
organisation, pas du transport. **C'est à toi de la mesurer.**

## Phase B — Le pré-embarquement 🟢 données réelles

Relevé sur l'offre Nansha du 22 septembre :

| Jalon | Date | Écart au départ |
|---|---|---|
| **Booking cut-off** | 18-Sep 05h00 | **J-4** |
| Empotage terminé (conclusion du module 3) | 19-Sep | J-3 |
| **Port cut-off** + **VGM cut-off** | 20-Sep 05h00 | **J-2** |
| **Départ du navire (ETD)** | 22-Sep | **J0** |

> **Phase B = 4 jours.**

## Phase C — La mer 🟢 données réelles

| Segment | Dates | Durée |
|---|---|---|
| Nansha → **Kribi** (CMA CGM BRAZIL, voyage 0W118W1MA) | 22-Sep → 26-Oct | **34 jours** |
| **Attente au transbordement de Kribi** | 26-Oct → 30-Oct | **4 jours** |
| Kribi → Douala (feeder CMA CGM SHAKESPEARE) | 30-Oct → 31-Oct | **1 jour** |
| | | **= 39 jours** |

> 🔑 **Regarde la répartition.** Sur 39 jours de « mer », **4 jours sont de
> l'attente à quai à Kribi** — 10 % du transit passé immobile au Cameroun.
> C'est l'opportunité Kribi du module 3, revue en durée.

## Phase D — Douala 🟢 données réelles du dossier `ECMU5839181`

C'est ici que tout se joue, et les chiffres viennent de tes propres factures.

| Jalon | Date | Preuve |
|---|---|---|
| Frais de dossier et frais conteneur facturés | **24/04** | factures CMIM1091423 et 1091424 — **avant l'arrivée du navire** |
| Arrivée du navire MARINA | **26/04 à 02h17** | mention « Call Date » sur les factures |
| **Conteneur déchargé** | **27/04** | « Start Event : 27-APR-26 – Discharged Full » |
| Frais de release (telex release) facturés | **27/04** | facture CMIM1092258 |
| « Retrait tardif » facturé — **20 000 F HT forfaitaires** | **13/05** | facture CMIM1100273 |
| **Début de facturation des surestaries** | **17/05** | facture CMIM1102324 |
| Enlèvement du terminal (draft RTC) | **06/06** | draft RTC n° 905857 |
| **Dernier jour de surestaries facturé** | **12/06** | facture CMIM1108123 |

> ### Du déchargement à l'enlèvement : 27/04 → 06/06 = **40 jours**.

**Le conteneur a passé autant de temps immobilisé à Douala qu'il en a passé en
mer.**

## Phase E — La livraison finale

| Étape | Durée |
|---|---|
| Port de Douala → entrepôt du client | 🟡 **inconnu** — à mesurer |

---

# 5. Le total : 84 jours, dont 39 en mer

| Phase | Durée | Part |
|---|---|---|
| B — Booking → départ | 4 j | 5 % |
| C — La mer (dont 4 j d'attente à Kribi) | 39 j | 46 % |
| D₁ — Arrivée → déchargement | 1 j | 1 % |
| D₂ — **Déchargement → enlèvement** | **40 j** | **48 %** |
| **TOTAL du booking à l'enlèvement** | **84 jours** | |

*(hors phase A en amont et phase E en aval, non mesurées)*

> ### 84 jours, c'est 12 semaines. Près de trois mois.
> **Et moins de la moitié se passe sur un bateau.**

## Le délai atteignable, et ce que coûte l'écart

Si le conteneur était sorti dans la franchise accordée (13 jours) :

| | Réalisé | Atteignable | Écart |
|---|---|---|---|
| Booking → départ | 4 j | 4 j | — |
| Mer | 39 j | 39 j | — |
| Déchargement | 1 j | 1 j | — |
| Séjour à Douala | **40 j** | **13 j** | **−27 j** |
| **TOTAL** | **84 j** | **57 j** | **−27 j** |

> ✅ **Vérification qui boucle.** Les 27 jours d'écart sont **exactement** les
> **27 jours de surestaries facturés** sur les cinq factures CMA CGM
> (7 + 14 + 4 + 1 + 1 = 27).
>
> Et la reconstitution au franc près :
> `17 465 + (26 × 32 444) = 861 009 F HT`, soit **1 026 753 F TTC** —
> les factures totalisent **1 026 752 F**. Un franc d'écart d'arrondi.
>
> **Le délai et la facture sont la même chose, vue de deux côtés.**

---

# 6. Ce que coûte une journée de retard — chiffres vérifiés

> ⏱️ **Surestaries** (*demurrage*) — le loyer du conteneur au-delà de la
> franchise, facturé par l'**armateur**.
> 🅿️ **Stationnement** — le loyer du **terrain** sur lequel la boîte est posée,
> facturé par le **terminal et l'autorité portuaire**. Ce sont trois factureurs
> distincts qui comptent en parallèle.

| Poste | Tarif/jour HT | Tarif/jour TTC |
|---|---|---|
| Surestaries CMA CGM — 1er jour facturé | 17 465 | 20 827 |
| Surestaries CMA CGM — jours suivants | **32 444** | **38 689** |
| Stationnement PAD (J21 → J40) | 2 400 | 2 862 |
| Stationnement RTC (J21 → J40) | 2 400 | 2 862 |
| **TOTAL par jour au-delà du 21e jour** | **37 244** | **44 413** |

Plus, **une seule fois**, le forfait RTC d'**encombrement** au-delà de 15 jours :
200 000 F HT = **238 500 F TTC**.

> 🔴 **Chaque journée de retard après le 21e jour coûte environ 44 400 FCFA TTC.**
>
> 🔧 **Correction.** Au module 3 j'avais écrit « ~37 000 FCFA par jour ». C'était
> le montant **hors taxes** (37 244), présenté sans le préciser. **Le montant
> réellement décaissé est 44 413 F.** L'ordre de grandeur ne change pas, le
> chiffre à retenir si.

---

# 7. 🔬 Quand démarre et quand s'arrête le compteur ? — enquête

C'était une de tes questions ouvertes : *pourquoi la facturation démarre-t-elle le
17/05 alors que le conteneur est déchargé le 27/04 et que la franchise est de
13 jours ?* (27/04 + 13 = 10/05)

J'ai relu les factures ligne par ligne. Voici où j'en suis.

## Ce qui est certain, écrit noir sur blanc sur les factures

| Donnée | Valeur |
|---|---|
| **Start Event** | `27-APR-26 – Discharged Full – DOUALA – RTC` |
| **Free Calendar Days** | **13** |
| Type de jours | **Calendar** (calendaires, pas ouvrables) |
| Jours facturés au total | 7 + 14 + 4 + 1 + 1 = **27** |
| Fenêtre facturée | **17/05 → 12/06** |

## Le paradoxe

| | |
|---|---|
| 27 jours facturés + 13 jours francs | = **40 jours** |
| Déchargement (27/04) → enlèvement (06/06) | = **40 jours** ✅ **ça colle** |
| **Mais** 13 jours francs à partir du 27/04 finissent le 09 ou 10/05 | la facturation devrait démarrer vers le **10/05** |
| Or elle démarre le | **17/05** |

**La durée est juste. C'est la fenêtre qui est décalée de 7 jours.**

## Ce que j'ai pu éliminer

| Hypothèse | Verdict |
|---|---|
| La franchise court depuis le **release du connaissement** | ❌ **Éliminée.** La facture de release (CMIM1092258) est datée du **27/04**, le même jour que le déchargement. |
| La franchise est comptée en **jours ouvrables** | ❌ **Éliminée.** 13 jours ouvrables depuis le 27/04 (un lundi) tombent le 15 ou le 16/05 selon la convention — pas le 17. Et la facture dit explicitement « **Calendar** ». |
| Le « retrait tardif » couvre les 7 jours manquants | ❌ **Éliminée.** C'est un **forfait** : 23 850 F TTC = **20 000 F HT exactement**, un nombre rond. Pas un calcul journalier. |

## L'hypothèse qui reste — et elle est importante

> ### Le compteur ne s'arrête peut-être pas quand tu sors ta marchandise, mais quand tu **rends la boîte vide**.

Le conteneur quitte le terminal le **06/06** (draft RTC). Les surestaries courent
jusqu'au **12/06** — **6 jours de plus**. Ces 6 jours sont exactement le temps
qu'il faut pour vider le conteneur chez le client et ramener la boîte vide au
dépôt de CMA CGM.

> 🔑 **Si c'est bien ça, c'est la leçon la plus rentable de ce module :**
>
> **« Sortir le conteneur du port » n'est pas la ligne d'arrivée.
> « Rendre le conteneur vide » l'est.**
>
> Six jours de boîte vide dans la cour d'un client = **6 × 38 689 = 232 134 FCFA**
> pour du métal qui ne contient rien.

⚠️ **Je n'en suis pas sûr, et je ne veux pas te le vendre comme un fait.**
Deux indices convergent (le décalage de 7 jours, les 6 jours entre 06/06 et
12/06) mais aucune facture ne nomme l'événement d'arrêt — la ligne
« Stop Event Data » est **vide** sur les cinq factures.

> 📧 **La question à poser à CMA CGM Cameroun, par écrit** (cmr.service@cma-cgm.com,
> l'adresse figure sur les factures) :
>
> *« Sur le conteneur ECMU5839181, BL GGZ2867008 : quel est l'événement exact qui
> démarre le compteur de surestaries, et quel est l'événement exact qui l'arrête ?
> La franchise de 13 jours calendaires court-elle depuis le déchargement du 27/04 ?
> Si oui, pourquoi la première journée facturée est-elle le 17/05 et non le 10/05 ? »*
>
> **La réponse vaut 44 400 F par jour sur tous tes conteneurs à venir.** Et note
> bien : **ce décalage ne t'a rien coûté ici** — 27 jours ont été facturés dans
> les deux lectures. Tu ne réclames pas de l'argent, tu achètes une règle.

## Une pratique à connaître

Regarde les dates d'émission des deux dernières factures :

| Facture | Émise le | Facture la journée du |
|---|---|---|
| CMIM1108123 | **09/06** | **11/06** |
| CMIM1108123 *(même numéro !)* | **11/06** | **12/06** |

> ⚠️ **CMA CGM facture les journées de surestaries à l'avance, jour par jour, à
> la fin.** Et **les deux factures portent le même numéro** — anomalie déjà
> signalée, toujours à faire confirmer avant de payer les deux.

---

# 8. Pourquoi les ETA glissent — et de combien

## Le chiffre mondial

**Sea-Intelligence** publie chaque mois la *Global Schedule Reliability* — le
pourcentage de navires arrivant **à la date annoncée**.

| Mois 2026 | Fiabilité mondiale |
|---|---|
| Janvier | **62,4 %** — le plus haut depuis 2021 |
| Février | 59,0 % |
| Mars | 62,2 % |
| Mai | **64,7 %** — le plus haut de 2026 |
| Juin | 62,6 % |

🔗 [Sea-Intelligence — janvier 2026](https://www.sea-intelligence.com/press-room/373-2026-starts-with-global-schedule-reliability-of-62-4) · [février 2026](https://www.sea-intelligence.com/press-room/379-february-2026-global-schedule-reliability-falls-to-59-0) · [mai 2026](https://container-news.com/sea-intelligence-global-schedule-reliability-for-may-2026-the-highest-of-the-year/) · [juin 2026](https://container-news.com/sea%E2%80%91intelligence-global-schedule-reliability-drops-to-62-6-in-june-2026/)

> ### Environ **quatre navires sur dix arrivent en retard** — et c'est la meilleure année depuis 2021.

**Ce n'est pas une anomalie africaine. C'est la norme mondiale du métier.**

## Les six causes, par ordre de fréquence sur ta ligne

| # | Cause | Pourquoi ça te touche |
|---|---|---|
| 1 | **Le *roll-over*** — navire plein, ta boîte part la semaine suivante | +7 jours d'un coup |
| 2 | **L'attente du feeder à Kribi** | Déjà 4 jours au plan ; si le feeder est plein, le double |
| 3 | **La congestion portuaire** | Le navire attend son tour au mouillage |
| 4 | **Le tirant d'eau de Douala** (module 3) | Chenal ensablé = créneau de marée manqué |
| 5 | **La météo** | Typhons en mer de Chine, saison des pluies au Cameroun |
| 6 | **Les escales en amont** | Un retard pris à Nansha se traîne jusqu'à Douala |

---

# 9. Le cadre réglementaire camerounais

| Règle | Valeur | Source |
|---|---|---|
| Délai de séjour au parc à conteneurs du port de Douala | **11 jours ouvrables** | 🟠 source secondaire |
| Délai de dédouanement observé | **7 à 30 jours**, ~15 en moyenne | 🟠 source secondaire |
| **Délai maximum légal avant vente aux enchères** | **3 mois (90 jours)** | 🟠 code des douanes, cité en source secondaire |

> 🟡 **Honnêteté sur ces trois lignes :** elles viennent de blogs professionnels
> camerounais, **pas de textes officiels que j'aurais lus**. Je les donne comme
> ordre de grandeur, pas comme référence juridique. **Le chiffre de 90 jours est
> à vérifier dans le code des douanes CEMAC avant de s'en servir.**

**L'ordre de grandeur est néanmoins cohérent avec ton dossier** : 40 jours de
séjour, quand la moyenne de dédouanement est de 15 jours et la franchise de 13.
**Tu étais dans le dernier tiers de la distribution, pas dans un cas normal.**

> ⚠️ Et le risque du bout : la presse camerounaise rapporte régulièrement des
> mises en vente aux enchères de conteneurs restés plus de 90 jours au terminal,
> et parle de milliers de conteneurs abandonnés à Douala. **Le compteur ne
> s'arrête jamais tout seul.**

---

# 10. 💰 L'enseignement qui vaut le plus cher : la rotation

Ce n'est plus du transport, c'est de la finance. Et c'est **le vrai argument
pour investir dans la vitesse**.

> 🔁 **Rotation du capital** — le nombre de fois par an où l'argent que tu as
> immobilisé dans de la marchandise **te revient**, prêt à être réinvesti.
>
> Formule : `365 ÷ durée du cycle en jours`

| | Cycle | Rotations par an |
|---|---|---|
| **Ton dossier réel** | 84 jours | **4,35** |
| **En restant dans la franchise** | 57 jours | **6,40** |

> ### Même capital. Même conteneur. Même fournisseur. **+47 % de volume par an.**

**Regarde ce que ça veut dire.** Avec 50 millions de FCFA de fonds de roulement :

| | Cycle de 84 j | Cycle de 57 j |
|---|---|---|
| Rotations annuelles | 4,35 | 6,40 |
| Volume annuel traité | **217 M FCFA** | **320 M FCFA** |
| | | **+103 M de chiffre d'affaires, sans un franc de capital en plus** |

*(🟡 Les 50 M sont une illustration, pas ton chiffre réel.)*

> 🔑 **Les surestaries évitées, ce n'est que la partie visible.** Sur ce
> conteneur, sortir dans la franchise aurait économisé **1,4 M FCFA** de
> pénalités. Mais réduire le cycle de 84 à 57 jours, c'est **+47 % de capacité
> commerciale** — et ça, ça se compte en dizaines de millions par an.
>
> **C'est ça, ta thèse d'investissement produit.** Pas « on suit les conteneurs ».
> **« On fait tourner ton argent une fois et demie plus vite. »**

---

# 11. Ce que tu promets à un client — la règle

> ⛔ **Ne promets jamais le transit time de l'armateur.**

| Ce qu'il ne faut pas dire | Pourquoi |
|---|---|
| « 40 jours » | C'est du port à port, et ça ne se réalise que 6 fois sur 10 |

**Construis ta promesse par couches, et garde la marge pour toi :**

| Couche | Durée | Base |
|---|---|---|
| Empotage et pré-embarquement | 4 j | 🟢 cut-offs réels |
| Mer | 39 j | 🟢 cotation réelle |
| Déchargement | 1 j | 🟢 dossier réel |
| Dédouanement et sortie — **objectif** | 13 j | 🟢 franchise |
| Livraison client | 🟡 à mesurer | |
| **Sous-total maîtrisé** | **57 j** | |
| **+ Tampon de fiabilité** (4 navires sur 10 en retard) | **+ 10 à 14 j** 🟠 | Sea-Intelligence |
| **= Ce que tu annonces au client** | **~70 jours** | |

> 💡 **Et c'est un argument commercial, pas une faiblesse.** Un concurrent qui
> promet 45 jours et livre en 84 perd le client. Toi tu promets 70, tu livres en
> 60, et tu deviens le seul transitaire de Douala **dont la parole vaut quelque chose**.
>
> **Dans ce métier, la fiabilité se vend plus cher que la vitesse.**

---

# 12. 📊 Les jalons que ton système doit suivre

Une expédition n'a pas « une date ». Elle a une **suite d'événements**, chacun
avec une date **prévue** et une date **réelle**. Voici la liste, tirée de tout ce
qu'on a vu depuis le module 1 :

| # | Jalon | Prévu | Réel | Qui le fournit |
|---|---|---|---|---|
| 1 | Marchandise reçue à l'entrepôt | ✓ | ✓ | Toi |
| 2 | Booking confirmé | ✓ | ✓ | Armateur |
| 3 | Empotage terminé | ✓ | ✓ | Toi |
| 4 | **VGM déclaré** | ✓ | ✓ | Toi |
| 5 | Conteneur remis au terminal (port cut-off) | ✓ | ✓ | Terminal |
| 6 | **Départ du navire** (ETD / ATD) | ✓ | ✓ | Armateur |
| 7 | Arrivée au hub de transbordement | ✓ | ✓ | Armateur |
| 8 | Départ du hub | ✓ | ✓ | Armateur |
| 9 | **Arrivée à Douala** (ETA / ATA) | ✓ | ✓ | Armateur |
| 10 | **Déchargement** ⬅️ *démarre le compteur* | ✓ | ✓ | Terminal |
| 11 | **Fin de franchise** ⬅️ *l'alerte la plus importante* | ✓ | — | Calculé |
| 12 | Déclaration en douane déposée | ✓ | ✓ | Transitaire |
| 13 | Droits payés (quittance) | ✓ | ✓ | Banque / GUCE |
| 14 | BAE obtenu | ✓ | ✓ | Douane |
| 15 | **Sortie du terminal** | ✓ | ✓ | Terminal |
| 16 | Livraison au client | ✓ | ✓ | Toi |
| 17 | **Conteneur vide restitué** ⬅️ *arrête le compteur* | ✓ | ✓ | Armateur |

> 🔴 **Le jalon n°11 est celui qui rapporte le plus.** Une alerte automatique
> « **fin de franchise dans 5 jours** » sur chaque conteneur, envoyée à la bonne
> personne, aurait évité 1,4 million de FCFA sur un seul dossier.
>
> C'est une date calculée, une notification, et une liste. **Techniquement
> trivial. Économiquement énorme.** C'est la première fonctionnalité à construire.

---

# 13. 🟡 Ce que je ne sais pas

| # | Inconnue | Comment la lever |
|---|---|---|
| 1 | **L'événement exact qui démarre et arrête le compteur de surestaries** | Le courriel du §7 à CMA CGM |
| 2 | **La date réelle de restitution du conteneur vide** sur le dossier | Demander le *Empty Return Receipt* à CMA CGM |
| 3 | **La durée de la phase A** (production, collecte, réception) | À mesurer sur tes propres opérations |
| 4 | **La durée de la phase E** (port → entrepôt client) | À mesurer |
| 5 | **La fiabilité de la ligne WAX1 en particulier** | Se construit conteneur après conteneur, en comparant ETA et ATA |
| 6 | **Le délai légal exact avant vente aux enchères au Cameroun** | À vérifier dans le code des douanes CEMAC |
| 7 | **La franchise que CMA CGM accorderait sur un contrat négocié** | Onglet **D&D** de la cotation, toujours pas ouvert |

---

## ✅ Ce qu'il faut retenir du module 5

1. **ETD / ETA sont des prévisions ; ATD / ATA sont des faits.** Ton système doit
   stocker les deux.
2. **« 40 jours » est un transit time de port à port.** Ça ne contient ni ton
   entrepôt, ni la douane, ni la livraison.
3. **CMA CGM compte le jour de départ et le jour d'arrivée** : son « 40 jours »
   vaut 39 jours écoulés.
4. **Le cycle réel de ton dossier : 84 jours du booking à l'enlèvement** — dont
   **39 en mer (46 %)** et **40 immobilisé à Douala (48 %)**.
5. **Le délai atteignable était 57 jours.** L'écart de 27 jours est **exactement**
   les 27 jours de surestaries facturés.
6. **Une journée de retard au-delà du 21e jour coûte ~44 400 FCFA TTC** — trois
   factureurs en parallèle : CMA CGM, le PAD et le RTC.
7. **Le compteur ne s'arrête probablement pas à la sortie du port, mais à la
   restitution du conteneur vide.** À confirmer par écrit — ça vaut 6 jours par dossier.
8. **4 navires sur 10 arrivent en retard dans le monde**, et 2026 est la meilleure
   année depuis 2021.
9. **Ne promets jamais le transit time.** Annonce ~70 jours, livre en 60, et
   vends ta fiabilité.
10. **Réduire le cycle de 84 à 57 jours, c'est +47 % de volume annuel à capital
    constant.** C'est ça, ta vraie thèse produit.
11. **Une expédition a 17 jalons**, chacun avec une date prévue et une date réelle.
12. **L'alerte « fin de franchise dans 5 jours » est la première fonctionnalité à
    construire.** Triviale techniquement, énorme économiquement.

---

## 🧠 Vérifie que c'est acquis

1. Un client te demande : « ça prend combien de temps ? » CMA CGM affiche
   40 jours. Que réponds-tu, et pourquoi ?
2. Ton conteneur est déchargé le 3 mars. La franchise est de 13 jours calendaires.
   À quelle date dois-tu déclencher ton alerte, et pourquoi pas le dernier jour ?
3. Tu sors le conteneur du terminal le 20 mars et tu le vides chez le client le
   24 mars, mais la boîte vide ne retourne au dépôt que le 28. Combien de jours de
   surestaries risques-tu d'avoir payés pour rien, et combien ça fait en francs ?
4. Deux offres : 39 jours via Kribi, ou 53 jours via Singapour puis Kribi, au même
   prix. Laquelle prends-tu ? Et si la seconde était 400 USD moins chère ?
5. Ton cycle passe de 84 à 60 jours. De combien augmente ton volume annuel à
   capital constant ?

---

## 📚 Sources du module

**Données réelles propriétaires** (les plus solides de ce module)
- Cotations CMA CGM SpotOn de septembre 2026 : Nansha, Shekou et Yantian → Douala
- Dossier `docs/cargo/dossiers/2026-04_CTR-ECMU5839181_BL-GGZ2867008` — 12 pièces,
  factures CMIM1091423, 1091424, 1092258, 1100273, 1102324, 1106123, 1107394, 1108123

**Fiabilité des horaires**
- [Sea-Intelligence — Global Schedule Reliability, janvier 2026 (62,4 %)](https://www.sea-intelligence.com/press-room/373-2026-starts-with-global-schedule-reliability-of-62-4)
- [février 2026 (59,0 %)](https://www.sea-intelligence.com/press-room/379-february-2026-global-schedule-reliability-falls-to-59-0)
- [mars 2026 (62,2 %)](https://container-news.com/sea-intelligence-march-2026-global-schedule-reliability-joint-highest-for-the-year/)
- [mai 2026 (64,7 %)](https://container-news.com/sea-intelligence-global-schedule-reliability-for-may-2026-the-highest-of-the-year/)
- [juin 2026 (62,6 %)](https://container-news.com/sea%E2%80%91intelligence-global-schedule-reliability-drops-to-62-6-in-june-2026/)

**Contexte camerounais** — 🟠 sources secondaires, à recouper avec les textes
- [LeFisk — procédure d'importation au Cameroun 2026](https://www.lefisk.cm/blog/procedure-importation-marchandises-cameroun-dedouanement-sgs-anor)
- [LeFisk — enlèvement des marchandises au port de Douala](https://lefisk.cm/blog/enlevement-marchandises-port-douala-bad-rtc-postes-controle)
- [Investir au Cameroun — 2 500 conteneurs menacés de vente aux enchères après 90 jours](https://www.investiraucameroun.com/gestion-publique/0506-22082-port-de-douala-environ-2500-conteneurs-debarques-sur-le-terminal-depuis-plus-de-90-jours-menaces-de-vente-aux-encheres)

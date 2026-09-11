# MODULE 3 — Les ports et les terminaux
### Version consolidée · close le 11/09/2026

> Ce module a été livré une première fois, puis laissé ouvert pendant qu'on
> faisait les simulations CMA CGM SpotOn et qu'on dépouillait les factures
> réelles du conteneur `ECMU5839181`. Ces deux détours ont **répondu à trois
> questions** que le module laissait en suspens et **corrigé deux affirmations**.
> Ceci est la version finale, à jour.

---

## Les quatre questions auxquelles ce module devait répondre

| # | La question | Statut |
|---|---|---|
| 1 | Ça veut dire quoi, « le terminal à conteneurs de la ville » ? | ✅ répondue |
| 2 | Est-ce que Nansha coûte plus cher ? | ✅ **répondue par des chiffres réels** |
| 3 | Peut-on faire partir nos conteneurs d'un autre port ? | ✅ **répondue par l'expérience** |
| 4 | Est-ce que c'est plus risqué ? | ✅ répondue — **mais pas comme prévu** |

---

# 1. Port et terminal : deux mots, deux choses

> ⚓ **Port** — une **zone entière** : les quais, l'eau, les routes, les
> entrepôts, les bureaux de douane. Un **territoire**, dirigé par une
> **autorité portuaire**.

> 🏗️ **Terminal** — une **installation précise à l'intérieur du port**,
> exploitée par **une entreprise**. Un port contient plusieurs terminaux.

**L'image : l'aéroport et les halls.** Roissy est l'aéroport ; le Terminal 2E
est un hall dedans. Tu ne dis pas à ton chauffeur « emmène-moi à Roissy », tu
dis « Terminal 2E » — sinon tu te retrouves à 3 km de ton avion.

Dans un port c'est pareil : ton camion ne va pas « au port de Douala ». Il va à
**un terminal précis**, à **une porte précise**, dans **un créneau horaire précis**.

## Les quatre lieux d'un port à conteneurs

| Le lieu | Le nom du métier | Ce qui s'y passe |
|---|---|---|
| Le quai | *Berth* | Le mur où le navire s'amarre. Les grues y prennent et déposent les conteneurs. |
| Le parc à conteneurs | **CY** — *Container Yard* | L'esplanade où les conteneurs **fermés** sont empilés en attendant. |
| Le centre de groupage | **CFS** — *Container Freight Station* | Un **entrepôt couvert** où on **ouvre** les conteneurs pour séparer la marchandise de plusieurs propriétaires. |
| Les portes | *Gate* | L'entrée et la sortie, avec contrôle des documents. |

> 🔗 **Le lien avec le connaissement.** `CY / CY` sur ton BL veut dire : *ton
> conteneur reste fermé, il ne va que sur les parcs*. `CY / CFS` veut dire :
> *à Douala, il ira dans le bâtiment CFS pour être ouvert et séparé*.
> **Ce ne sont pas des codes abstraits — ce sont des adresses physiques.**

Deux mots de plus :

> 🏗️ **Portique** (*gantry crane*) — la grue sur rails qui prend les conteneurs
> du navire. Une grue moderne en traite un toutes les ~90 secondes.

> 🌊 **Tirant d'eau** (*draft*) — la **profondeur d'eau dont un navire a besoin
> pour flotter sans toucher le fond**. Un gros porte-conteneurs : 15 à 16 m.
> **C'est ça qui décide quels navires peuvent entrer dans un port.**

---

# 2. Appliqué à Douala

| | Le nom | Ce qu'il fait |
|---|---|---|
| **Le port** | **PAD** — Port Autonome de Douala | L'**autorité**. Propriétaire du domaine, régulateur, perçoit des redevances. **Ne touche jamais physiquement ton conteneur.** |
| **Le terminal** | **RTC** — Régie du Terminal à Conteneurs | L'**exploitant**. Décharge, empile, stocke, charge sur camion. **C'est lui qui manipule ton conteneur.** |

🔗 [Port Autonome de Douala — mission](https://www.pad.cm/decouvrez-le-port-autonome-de-douala-sa-mission/)

> 🔑 **Pourquoi ça sert tous les jours.** Conteneur introuvable sur le parc →
> **le terminal (RTC)**. Facture de manutention contestée → **le terminal**.
> Redevance portuaire → **l'autorité (PAD)**. Appeler le mauvais interlocuteur
> coûte une journée — et tu sais maintenant ce que coûte une journée.

✅ **Vérifié sur pièce.** La facture RTC du dossier `ECMU5839181` porte bien
l'en-tête « Régie du Terminal à Conteneurs » et facture exactement ces
prestations : acconage, relevage de livraison, stationnement.

---

# 3. Le port de Guangzhou, c'est Nansha

Guangzhou est une ville immense, mais **il n'y a pas de terminal à conteneurs
en son centre** : il faut de l'eau profonde et des dizaines d'hectares plats.
Le terminal se trouve à **Nansha**, district au sud, sur l'estuaire de la
rivière des Perles — à ~60-70 km du centre. 🟠 *À vérifier depuis l'adresse
exacte de l'entrepôt.*

| Fait | Chiffre |
|---|---|
| Rang mondial du port de Guangzhou | **5ᵉ** |
| Conteneurs traités à Nansha en 2024 | **20,49 millions d'EVP** |
| Part de Nansha dans le groupe portuaire de Guangzhou | ~75 % |
| Nouveau terminal | **Entièrement automatisé** — 1 400 m de quai, véhicules autonomes |

🔗 [Classement mondial des ports 2025](https://trans.info/fr/classement-ports-mondiaux-2025-447147) · [Port of Nansha](https://en.wikipedia.org/wiki/Port_of_Nansha) · [Nansha, terminal automatisé](https://www.actu-transport-logistique.fr/journal-de-la-marine-marchande/filinfo/nansha-nouveau-terminal-entierement-automatise-743507.php)

*Rappel : 1 EVP = un conteneur de 20 pieds. Un 40' HC compte pour 2 EVP.*

## ✅ Confirmé par l'expérience — et plus fort que prévu

En lançant une cotation CMA CGM depuis **GUANGZHOU (code `CNCAN`)**, le
résultat a été **« No Result »**. Depuis **NANSHA (code `CNNSA`)**, cinq offres.

> **Il n'existe aucun service CMA CGM Guangzhou (CNCAN) → Douala.
> Nansha (CNNSA) en a.**

Ce n'est plus une approximation géographique : c'est une contrainte
opérationnelle dure. Sur cette ligne, « le port de Guangzhou » **est** Nansha.

## Les autres ports de départ possibles

| Port | Distance depuis l'entrepôt 🟠 | À noter |
|---|---|---|
| **Nansha** (Guangzhou) | ~60-70 km | Le plus proche. 5ᵉ port mondial. |
| **Huangpu** (Guangzhou) | ~30-40 km | ⚠️ Port **fluvial** — barge probable avant le navire de haute mer |
| **Gaoming** (Foshan) | ~80-100 km | ⚠️ Port **fluvial** également |
| **Shekou** (Shenzhen) | ~110-120 km | Terminal *Chiwan Container Terminal* |
| **Yantian** (Shenzhen) | ~130-150 km | Eau très profonde |
| **Hong Kong** | ~140-150 km | ⚠️ **Territoire douanier séparé** |

> ⚠️ **Le piège de Hong Kong.** Hong Kong est chinoise politiquement, mais
> **c'est un territoire douanier distinct**. Y passer = **franchir une frontière
> douanière supplémentaire** : formalités, délais et coûts en plus.

---

# 4. Un port n'a pas de prix — mais le port d'embarquement, si

C'était l'affirmation du module. **Elle demande une nuance, et ce sont tes
propres cotations qui l'ont révélée.**

> 🚢 **Service** (ou **ligne maritime**) — un **itinéraire régulier** qu'un
> armateur exploite, avec une liste de ports fixe et une fréquence.
> Ex. : *« départ tous les mardis, Nansha → Kribi → Douala »*.

Le **fret maritime** dépend du service, pas du lieu. Mais les **frais de
terminal (THC)** dépendent du terminal — et ils sont dans le prix.

## La preuve, chiffrée

Même navire, même voyage, même arrivée. Deux ports d'embarquement.

| | **Depuis NANSHA** | **Depuis SHEKOU** |
|---|---|---|
| Navire | CMA CGM BRAZIL | CMA CGM BRAZIL |
| Service | WAX1 | WAX1 |
| **Réf. de voyage** | **0W118W1MA** | **0W118W1MA** |
| Arrivée à Kribi | 26-Oct-2026 | 26-Oct-2026 |
| Départ de Kribi | 30-Oct-2026 | 30-Oct-2026 |
| Feeder | CMA CGM SHAKESPEARE (`DLF1V0R19`) | CMA CGM SHAKESPEARE (`DLF1V0R19`) |
| **Arrivée à Douala** | **31-Oct-2026** | **31-Oct-2026** |
| Départ | 22-Sep | 23-Sep |
| Délai affiché | 40 jours | 39 jours |
| **PRIX** | **6 051 USD** | **5 968 USD** |

> **C'est le même bateau, le même voyage, la même arrivée — et 83 USD d'écart.**

Le navire fait escale à Nansha le 22, puis à Shekou le 23, puis part. Le
« 39 jours contre 40 » n'est **pas** un gain de vitesse : le compteur démarre
un jour plus tard. **La marchandise est à Douala le même samedi 31 octobre.**

> 🔧 **Formulation corrigée.** Au lieu de *« un port n'a pas de prix, c'est le
> service qui en a un »*, retiens :
> **le service fixe le fret ; le port d'embarquement fixe les frais de terminal.**

---

# 5. Le transbordement — et la découverte qui change le dossier

> 🔄 **Transbordement** (*transshipment*) — ton conteneur **change de navire en
> cours de route** : déchargé dans un port intermédiaire, il attend, puis il est
> rechargé sur un autre navire.

> 🌐 **Hub** — un grand port qui sert de **plaque tournante**.
> 🚤 **Feeder** — le petit navire qui relie le hub au port final.

Un porte-conteneurs géant ne peut pas faire escale partout : il faut la
profondeur, les grues et le volume. D'où l'organisation en deux temps :

```
Nansha  ──[ gros navire ]──►  Hub  ──[ feeder ]──►  Douala
                          (attente)
```

## 🔴 La correction : sur cette ligne, le hub est KRIBI

Le module citait Tanger Med, Algeciras et Lomé. Ces hubs existent — mais
**aucun des trois n'est sur ta route**. Sur toutes les offres CMA CGM
Chine → Douala, le transbordement se fait à **Kribi, au Cameroun**.

**Trois sources indépendantes le confirment :**

| Source | Preuve |
|---|---|
| Les cotations SpotOn | Toutes les offres passent par « KRIBI, CM — Kribi Container Terminal » |
| La facture RTC réelle (`ECMU5839181`) | Mention **« Port de Chargement : CMKBI »** |
| La géographie | Kribi 16 m de tirant d'eau ; Douala ~7 à 9 m |

D'autres hubs sont apparus sur des routes plus lentes : **Singapour** et
**Tanjung Pelepas** (Malaisie, en face de Singapour).

## Ce que le transbordement change

| | Service **direct** | Avec **transbordement** |
|---|---|---|
| Durée | Plus court | **+ 5 à 10 jours** |
| Manipulations | 2 | 4 ou plus |
| Risque de casse | Faible | Plus élevé |
| Risque de retard | Faible | **Élevé** — si le feeder est plein, le conteneur attend le suivant |
| Prix | Souvent plus cher | Souvent moins cher |

> ⚠️ **Deux offres au même prix ne valent pas la même chose.** Exemple réel,
> deux offres au départ de Shekou, **même navire, même jour, même prix de
> 5 968 USD** : l'une via Kribi seul = **39 jours**, l'autre via Singapour +
> Kribi = **53 jours**. **14 jours d'écart pour le même montant.**
>
> ⚠️ **Et ne lis jamais les étiquettes.** Une offre Nansha étiquetée
> *« BEST PRICE »* affichait **6 351 USD en 48 jours** quand l'offre voisine
> étiquetée *« best transit time »* faisait **6 051 USD en 40 jours** —
> battue sur les deux critères. **Lis les chiffres, jamais les étiquettes.**

---

# 6. Pourquoi Douala oblige au transbordement : la profondeur

> 🌊 **Port fluvio-maritime** — un port situé **sur un fleuve**, pas sur la mer.
> Les navires doivent **remonter un chenal** pour l'atteindre.

Douala est sur le **Wouri**. Pour y arriver, un navire parcourt un **chenal de
25 km de long et 150 m de large**.

| Élément | Valeur |
|---|---|
| Longueur du chenal d'accès | **25 km** |
| Largeur | **150 m** |
| Profondeur maintenue | **-7,00 m** (officiel depuis le 21 juillet 2014 ; auparavant -6,50 m) |
| Tirant d'eau réellement offert | **~-9,00 m** grâce au marnage de la marée |

🔗 [Port Autonome de Douala — travaux de dragage](https://www.studi.com.tn/site/fr/projets/amenagement-et-defenses-des-cotes-protection-rehabilitation-des-plages-travaux-de-dragage/port-autonome-de-douala.197.html)

> 🏖️ **Dragage** — retirer la vase du fond pour maintenir la profondeur. Un
> fleuve dépose de la boue en permanence : **sans dragage continu, le chenal se
> rebouche.**

Le Cameroun a créé une **Régie déléguée du Dragage (RDD)** en 2018 et acheté une
drague de 3 000 m³, le *Mont Mandara*, avec pour objectif de passer **de 4,8 m
à 7 m**.

🔗 [Nationalisation du dragage](https://www.agenceecofin.com/transports/0902-85006-le-cameroun-nationalise-le-dragage-du-chenal-d-acces-au-port-autonome-de-douala) · [La drague de 3 000 m³](https://www.investiraucameroun.com/gestion-publique/0802-15942-avec-sa-nouvelle-drague-de-3000-m3-le-port-de-douala-engage-les-travaux-pour-un-acces-aise-des-navires-sur-les-quais)

> 🟡 **Incohérence non résolue.** Une source dit -7,00 m depuis 2014 ; une autre
> dit qu'en 2018 on visait de passer de 4,8 m à 7 m. Les deux peuvent être vraies
> si le chenal s'est ensablé entre-temps. **Retiens l'essentiel : la profondeur
> de Douala n'est pas un chiffre fixe — elle dépend de la date du dernier
> dragage.** Problème chronique, pas résolu.

| | **Douala** | **Kribi** |
|---|---|---|
| Type | Fluvio-maritime, sur le Wouri | **En eau profonde**, sur la côte |
| Tirant d'eau | **~7 à 9 m** | **16 m** |
| Chenal d'accès | 25 km à draguer en permanence | Aucun |
| Navires accueillis | Moyens | **Les gros porte-conteneurs** |
| Position | **Dans la ville**, au cœur du marché | ~250 km de Douala |

> 🔑 **Le transbordement à Douala n'est pas de la mauvaise organisation.
> C'est de la géographie.**

---

# 7. 💡 L'opportunité Kribi

Le détail de route de la meilleure offre :

```
POL  NANSHA, CN — Guangzhou South China Ocean Gate
     22-Oct → CMA CGM BRAZIL, service WAX1

     26-Oct  ARRIVÉE À KRIBI, CM — Kribi Container Terminal
     ⏳ 4 jours d'attente
     30-Oct  DÉPART DE KRIBI → CMA CGM SHAKESPEARE, service DLAFD3

POD  31-Oct  DOUALA, CM — RTC
```

> ### La marchandise est physiquement au Cameroun le 26 octobre. Elle n'est disponible à Douala que le 31.

| | Livraison à **Douala** | Livraison à **Kribi** |
|---|---|---|
| Marchandise disponible | 31 octobre | **26 octobre** |
| Gain de temps | — | **5 jours** |
| Transbordement supplémentaire | Oui | **Non** |
| Route jusqu'à Douala | 0 km | ~250 km |
| Congestion portuaire | Élevée | Plus faible |

**Et ce n'est pas théorique.** Le dossier `2026-07_paiement-douane-Kribi` du
corpus est un avis de paiement de douanes de **11 140 180 XAF**, bénéficiaire
**« KRIBI PORT »**, numéro de bordereau `CMKP52026GEN000549IPARENT` — le
préfixe `CMKP5` désigne le bureau de douane de Kribi.

> ❓ **Question ouverte.** Ce bordereau porte « Client Name : **NPVI** » et le
> NIU `M091712668533F` — **ni Norton Gauss Bonzini, ni BNG Trans**. Qui est NPVI ?
> Si c'est une entité du groupe, alors le dédouanement à Kribi est **déjà
> pratiqué** et il faut comparer les deux circuits chiffres en main.

👉 **Test à faire : refaire la cotation avec `POD = KRIBI (CM)`.** Comparer prix
et délai, puis ajouter ~250 km de camion Kribi → Douala.

---

# 8. Les cut-offs — le vrai calendrier

> ⏰ **Cut-off** — la **date limite** au-delà de laquelle il est trop tard. Il
> y en a **trois**, et rater n'importe laquelle fait perdre le navire.

Relevé réel, offre Nansha au départ du 22 septembre :

| Cut-off | Date limite | Ce que ça veut dire |
|---|---|---|
| **Booking cut-off** | 18-Sep, 05h00 | Dernière minute pour **réserver** |
| **Port cut-off** | 20-Sep, 05h00 | Dernière minute pour que le **conteneur soit physiquement au terminal** |
| **VGM cut-off** | 20-Sep, 05h00 | Dernière minute pour **déclarer le poids vérifié** |

> ⚠️ **Le conteneur doit être au terminal 48 h avant le départ**, et le camion
> depuis l'entrepôt prend une demi-journée.
> **En pratique : l'empotage doit être terminé 3 jours avant le départ du navire.**
> C'est une contrainte dure pour l'organisation de l'entrepôt.

---

# 9. « Est-ce plus risqué ? » — la réponse n'est pas celle qu'on attendait

Les risques liés au **choix du port**, du plus au moins important :

| # | Risque | Comment le maîtriser |
|---|---|---|
| 1 | **Le transbordement** — manipulations, attente au hub | Demander le nombre et le lieu, à chaque cotation |
| 2 | **La fréquence** — 1 départ par mois = 3 semaines perdues si tu le rates | Vérifier la fréquence **avant** de choisir |
| 3 | **La distance terrestre** | ✅ Avantage à Nansha |
| 4 | **La frontière douanière** (Hong Kong) | Éviter |
| 5 | **Le *roll-over*** — navire plein, départ reporté | Réserver tôt, ou garantie de chargement |

## 🔴 Mais la comparaison des ordres de grandeur change la conclusion

| Levier | Ce qu'il fait gagner ou perdre |
|---|---|
| Choisir le meilleur port de départ (Shekou vs Nansha) | **83 USD** (~50 000 FCFA) |
| Sortir le conteneur de Douala à temps (dossier `ECMU5839181`) | **1 400 670 FCFA** de pénalités évitées |

> ### Le rapport est d'environ 1 à 28.
>
> **Le vrai risque n'est pas le port de départ. C'est le nombre de jours que le
> conteneur passe immobilisé à l'arrivée.** Sur le dossier réel, 67 % du coût
> d'arrivée était de la pénalité de retard, pas du transport.
>
> Optimiser le port de départ est utile. **Optimiser la sortie de Douala est
> 28 fois plus rentable.**

---

# 10. La décision, pour Bonzini

**Par défaut : partir de Nansha.**
- Le plus proche de l'entrepôt → 50 à 90 km de camion économisés par conteneur
- 5ᵉ port mondial, terminal automatisé
- Seul port de la zone de Guangzhou avec un service CMA CGM vers Douala

**Mais coter Shekou systématiquement en parallèle** : 83 USD moins cher pour la
même arrivée. L'arbitrage se joue sur le camionnage chinois — voir §11.

**Yantian est écarté** : plus cher (6 260 USD) **et** arrivée le 14 novembre au
lieu du 31 octobre.

## Les cinq questions à poser à chaque cotation

1. Quel est le **prix total** rendu à Douala ?
2. Le service est-il **direct** ? Sinon, **combien de transbordements et où** ?
3. Quelle est la **fréquence** des départs sur cette ligne ?
4. Quels sont les **trois cut-offs** ?
5. Y a-t-il une **garantie de chargement** ?

> 📊 **La fonctionnalité produit qui apparaît toute seule.** Ces réponses,
> conteneur après conteneur, forment une base de données que personne d'autre
> n'a : quel service, depuis quel port, tient réellement ses promesses sur
> Douala. Au bout de trente conteneurs, on saura des choses que les transitaires
> de Douala ignorent.

---

# 11. 🟡 Ce qu'on ne sait toujours pas

Liste honnête de ce qui reste ouvert après ce module.

| # | Inconnue | Comment la lever |
|---|---|---|
| 1 | **Le coût du camionnage Nansha vs Shekou** (~100 km A/R d'écart) | Demander à un camionneur de Guangzhou les deux prix. À comparer aux 83 USD. 📌 Intuition non vérifiée : 100 km coûtent probablement plus de 83 USD, donc Nansha resterait gagnant. |
| 2 | **La surcharge marchandise dangereuse** | Refaire Nansha → Douala **sans cocher Hazardous**. L'écart = le coût réel des 800 téléphones. |
| 3 | **Le prix Nansha → Kribi** | Refaire la cotation avec POD = Kribi |
| 4 | **Les jours de franchise (D&D)** | Onglets **Rate / D&D / Fees** de la meilleure offre |
| 5 | **La profondeur réelle actuelle de Douala** | Sources contradictoires (2014 : -7,00 m ; 2018 : « de 4,8 à 7 m ») |
| 6 | **Huangpu et Gaoming sont-ils fluviaux avec barge ?** | La durée de transit affichée le dira |
| 7 | **Qui est NPVI** sur le bordereau de douane de Kribi ? | À demander à M. Bonzini |

> ⚠️ **Sur le prix global.** J'avais annoncé une fourchette de 2 200 à 5 500 USD
> pour un 40'. Le réel est de **5 968 à 6 260 USD** avec « Hazardous » coché.
> **Ma fourchette était fausse**, et tant que le test n°2 n'est pas fait, on ne
> sait pas si c'est le marché ou la marchandise dangereuse.

---

## ✅ Ce qu'il faut retenir du module 3

1. **Port ≠ terminal.** Le port est la zone, le terminal est l'installation.
   À Douala : **PAD** = le port, **RTC** = le terminal.
2. **Quatre lieux dans un port** : le quai, le parc (**CY**), le centre de
   groupage (**CFS**), les portes. Le CY et le CFS du connaissement sont des
   **adresses physiques réelles**.
3. **Le port de Guangzhou, c'est Nansha** — et c'est le **seul** de la zone avec
   un service CMA CGM vers Douala. `CNCAN` ne donne aucun résultat.
4. **Le service fixe le fret ; le port d'embarquement fixe les frais de terminal.**
   Preuve : 83 USD d'écart sur le même navire, même voyage, même arrivée.
5. **Le hub de ta ligne est KRIBI**, pas Tanger Med. Confirmé par les cotations
   **et** par la facture RTC réelle (`CMKBI`).
6. **Douala est sur un fleuve**, chenal de 25 km, ~7 à 9 m de tirant d'eau contre
   **16 m à Kribi**. Les gros navires ne peuvent pas y aller :
   **le transbordement est structurel, pas accidentel.**
7. **La marchandise est au Cameroun 5 jours avant d'être disponible à Douala.**
   C'est l'opportunité Kribi, à chiffrer.
8. **Trois cut-offs**, pas un. L'empotage doit être fini **3 jours** avant le départ.
9. **Deux offres au même prix peuvent différer de 14 jours.** Lis les chiffres,
   jamais les étiquettes.
10. **Le port de départ vaut 83 USD. La sortie de Douala vaut 1,4 M FCFA.**
    Rapport 1 à 28 — c'est là qu'est l'argent.

---

## 🧠 Vérifie que c'est acquis

1. Ton conteneur est introuvable sur le parc à Douala. Tu appelles le PAD ou le RTC ?
2. Sur ton connaissement il est écrit **CY / CFS**. Que va-t-il physiquement se passer à Douala ?
3. Deux offres à 5 968 USD, même navire, même jour. Que demandes-tu avant de choisir ?
4. Pourquoi les navires géants ne vont-ils pas directement à Douala ?
5. Tu as une heure à consacrer à l'optimisation d'un dossier. Tu la passes à
   comparer les ports de départ, ou à préparer la sortie du conteneur de Douala ?
   Pourquoi ?

---

## 📚 Sources du module

- [Port Autonome de Douala — mission](https://www.pad.cm/decouvrez-le-port-autonome-de-douala-sa-mission/)
- [Port Autonome de Douala — travaux de dragage](https://www.studi.com.tn/site/fr/projets/amenagement-et-defenses-des-cotes-protection-rehabilitation-des-plages-travaux-de-dragage/port-autonome-de-douala.197.html)
- [Nationalisation du dragage du chenal d'accès](https://www.agenceecofin.com/transports/0902-85006-le-cameroun-nationalise-le-dragage-du-chenal-d-acces-au-port-autonome-de-douala)
- [La drague de 3 000 m³ du port de Douala](https://www.investiraucameroun.com/gestion-publique/0802-15942-avec-sa-nouvelle-drague-de-3000-m3-le-port-de-douala-engage-les-travaux-pour-un-acces-aise-des-navires-sur-les-quais)
- [Classement mondial des ports 2025](https://trans.info/fr/classement-ports-mondiaux-2025-447147)
- [Port of Nansha](https://en.wikipedia.org/wiki/Port_of_Nansha)
- [Nansha — nouveau terminal entièrement automatisé](https://www.actu-transport-logistique.fr/journal-de-la-marine-marchande/filinfo/nansha-nouveau-terminal-entierement-automatise-743507.php)
- [Port d'Algeciras](https://en.wikipedia.org/wiki/Port_of_Algeciras)
- **Données propriétaires** : cotations CMA CGM SpotOn du 09/2026 (Nansha,
  Shekou, Yantian → Douala) et dossier `docs/cargo/dossiers/2026-04_CTR-ECMU5839181_BL-GGZ2867008`

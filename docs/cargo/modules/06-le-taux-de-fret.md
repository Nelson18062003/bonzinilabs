# MODULE 6 — Le taux de fret
### Ce que tu paies exactement, et comment tu le revends

> **Ce module répond à ta question :** *Taux de fret ? Ça veut dire quoi ?*
>
> C'est le module le plus riche en données réelles de tout le parcours, parce que
> **tes propres factures CMA CGM contiennent la décomposition complète, ligne par
> ligne**. Je les ai extraites. Elles m'ont appris deux choses que je ne
> soupçonnais pas.

---

# 1. Le mot

> 💰 **Taux de fret** (*freight rate*) — le **prix du transport** de ta
> marchandise. On dit « taux » et non « prix » parce que c'est un **prix
> unitaire** : par conteneur, par mètre cube ou par tonne.

> ⚠️ **Le piège immédiat.** Quand un transitaire te dit « le fret Chine-Douala
> est à 5 900 dollars », il te donne **une ligne**, pas un coût.
>
> **Le fret n'est pas un prix. C'est une addition** — de dix à vingt lignes, chez
> trois à cinq factureurs différents. C'est tout l'objet de ce module.

---

# 2. Les trois familles de frais

| Famille | Où | Qui facture | Quand tu la découvres |
|---|---|---|---|
| **A. Les frais au départ** | Chine | Armateur, transporteur local, terminal | À la réservation |
| **B. Le fret maritime** | En mer | Armateur | À la réservation |
| **C. Les frais à l'arrivée** | Douala | **Armateur + terminal + autorité portuaire** | **Souvent après** ⚠️ |

> 🔴 **La famille C est celle qui fait mal**, parce qu'elle n'apparaît pas dans la
> cotation en ligne. **On la découvre quand le conteneur est déjà arrivé** — donc
> quand on ne peut plus rien négocier.
>
> C'est exactement ce qui s'est passé sur `ECMU5839181` : tu as reçu **onze
> factures** après l'arrivée.

---

# 3. Les surcharges — définies une par une

Voici les sigles que tu vas croiser. **Ce ne sont pas des arnaques** : ce sont des
postes de coût que les armateurs ont sortis du fret de base pour pouvoir les
faire varier sans renégocier le contrat.

| Sigle | Nom complet | Ce que c'est |
|---|---|---|
| **BAF** / **BUC** | *Bunker Adjustment Factor* / *Bunker Charge* | **La surcharge carburant.** Le fioul du navire (*bunker*). Varie avec le prix du pétrole. |
| **CAF** | *Currency Adjustment Factor* | **La surcharge de change.** Protège l'armateur quand la monnaie de facturation bouge. |
| **THC** | *Terminal Handling Charge* | **Les frais de manutention au terminal** : sortir la boîte du navire, la poser, la déplacer. Un au départ (OTHC), un à l'arrivée (DTHC). |
| **ISPS** / **ISS** | *International Ship and Port Facility Security* | **La surcharge sûreté**, imposée par le code ISPS de l'OMI après 2001. |
| **PSS** | *Peak Season Surcharge* | **La surcharge de haute saison.** Avant le Nouvel An chinois, avant Noël. |
| **GRI** | *General Rate Increase* | **La hausse générale des taux.** L'armateur annonce « +500 USD au 1er du mois ». |
| **DG surcharge** | *Dangerous Goods* | **La surcharge marchandises dangereuses.** ⬅️ **Tes téléphones.** |
| **War Risk** | — | Surcharge de risque de guerre sur certaines routes (mer Rouge, golfe d'Aden). |
| **ERS** / **ERC** | *Equipment Repositioning* | **Le repositionnement des conteneurs vides.** L'Afrique importe plus qu'elle n'exporte : il faut ramener les boîtes vides. |
| **Doc fee** / **B/L fee** | — | **Les frais d'émission du connaissement.** |

> 🔑 **La question à poser à toute cotation, en une phrase :**
> ### « Ce prix est-il *all-in*, et si non, quelles surcharges ne sont pas dedans ? »
>
> > 🏷️ **All-in** — « tout compris ». Une cotation *all-in* inclut le fret de
> > base **et** toutes les surcharges connues. Une cotation « fret de base »
> > seule peut doubler.

---

# 4. 🔬 La preuve par tes factures — ce que tu as réellement payé à l'arrivée

J'ai extrait le détail des quatre factures CMA CGM « normales ». **Voilà à quoi
ressemble la famille C dans la vraie vie.**

## Facture `CMIM1091423` du 24/04 — « frais de dossier », 99 559 F

| Libellé sur la facture | Base | Taux | Montant XAF |
|---|---|---|---|
| Port and/or Terminal dues at destination | 1 unité | 77 000 | **77 000** |
| Security Fee at destination | 77 000 | **4 %** | 3 080 |
| Computer Fee at destination | 77 000 | **1 %** | 770 |
| Community Contribution Clearing agents Fee | forfait | 1 000 | 1 000 |
| *Sous-total* | | | *81 850* |
| Additional administration Fee | **81 850** | **2 %** | 1 637 |
| **Total HT** | | | **83 487** |
| TVA 19,25 % | | | 16 072 |
| **TOTAL TTC** | | | **99 559** ✅ |

> ### 🔴 Découverte n°1 : c'est une cascade.
>
> **Toute cette facture est construite sur UN SEUL chiffre : les 77 000 F de
> droits de port.** Tout le reste en est un pourcentage :
>
> ```
> 77 000  (droits de port)
>   + 4 %  de 77 000   → sûreté
>   + 1 %  de 77 000   → informatique
>   + 1 000            → contribution communautaire (forfait)
>   = 81 850
>   + 2 %  de 81 850   → frais administratifs  ⬅️ un % SUR les autres frais
>   = 83 487
>   × 1,1925           → TVA
>   = 99 559
> ```
>
> **Chaque 100 F de droits de port se transforme en 129 F sur ta facture.**
> Multiplicateur exact : **× 1,2930**.
>
> 💡 **L'utilité pratique :** si tu connais les droits de port d'un terminal, tu
> peux **prévoir cette facture avant de recevoir le conteneur**. Ce n'est plus
> une surprise, c'est une formule.

## Facture `CMIM1091424` du 24/04 — « frais conteneur et timbre », 105 770 F

| Libellé | Base | Montant XAF | TVA ? |
|---|---|---|---|
| Container maintenance Fee at destination | **10,00 USD** | 5 732 | ✅ oui |
| Container return Fee at destination | **2 TEU** × 11 000 | 22 000 | ✅ oui |
| ADMINISTRATIVE FEES PER BILL OF LADING | forfait | 40 000 | ✅ oui |
| **Stamp duty at destination** (droit de timbre) | forfait | **25 000** | ❌ **NON** |
| **Total HT** | | **92 732** | |
| TVA 19,25 % sur **67 732** seulement | | 13 038 | |
| **TOTAL TTC** | | **105 770** ✅ | |

> ### 🔴 Découverte n°2 : deux choses à retenir de cette facture.
>
> **a) Le droit de timbre n'est pas soumis à la TVA.** La base taxable est
> 67 732 F, pas 92 732 F. C'est **normal et correct** — un droit de timbre est
> lui-même un impôt, on ne taxe pas un impôt. Mais si ton comptable applique
> 19,25 % sur le total, **il se trompe de 4 812 F par conteneur.**
>
> **b) Certains frais sont facturés au TEU, pas au conteneur.** Le *container
> return fee* est de 11 000 F **par TEU**, et ton 40' HC compte pour **2 TEU** →
> 22 000 F. Un 20' aurait payé 11 000 F.
>
> > 📦 **TEU** — *Twenty-foot Equivalent Unit*, **équivalent vingt pieds**.
> > L'unité de compte universelle du conteneur. Un 20' = 1 TEU. Un 40' = 2 TEU.
> > **Quand un tarif est « par TEU », ton 40' paie double.**

## Les deux autres

| Facture | Ligne unique | HT | TTC |
|---|---|---|---|
| `CMIM1092258` du 27/04 | **Frais de release** | 30 000 | **35 775** |
| `CMIM1100496` du 13/05 | **On Carriage Haulage** (post-acheminement) | 110 000 | **131 175** |

> 🟡 **Une question ouverte sur la dernière.** *On Carriage Haulage* désigne un
> **acheminement terrestre après le port**. Or le connaissement ne mentionne
> aucun lieu de livraison (« Lieu de Livraison : - »), et le RTC a facturé
> séparément le « relevage de livraison » (chargement sur camion). **Je ne sais
> pas quel trajet couvre ce poste ni qui l'a demandé.** À faire préciser.
>
> ⚠️ **Et un piège de lecture à signaler.** Le montant **131 175 F apparaît deux
> fois** dans ton corpus : ici (post-acheminement) et sur le document SGS. C'est
> une **coïncidence** — les deux valent 110 000 F HT × 1,1925. **Ce ne sont pas
> les mêmes frais.** Ne les confonds pas en comptabilité.

---

# 5. 💱 Le taux de change — et pourquoi ça te concerne directement

Regarde cette ligne, en bas de la facture `CMIM1091424` :

```
Taux : 1 USD = 573,204132 XAF
```

> 🟢 **C'est une donnée réelle, datée du 24/04/2026, imprimée par CMA CGM.**
> Garde-la : c'est le taux qu'un armateur applique réellement, pas un taux de
> bureau de change.

## Convertissons enfin les cotations

| Port | Cotation | Au taux CMA CGM |
|---|---|---|
| **Shekou** | 5 968 USD | **3 420 882 XAF** |
| **Nansha** | 6 051 USD | **3 468 458 XAF** |
| Yantian | 6 260 USD | 3 588 258 XAF |
| **Écart Nansha–Shekou** | 83 USD | **47 576 XAF** |

*(🔧 Au module 3 j'avais dit « environ 50 000 FCFA » pour cet écart. Le chiffre
exact, au taux de l'armateur, est **47 576 F**.)*

## Le risque de change — et la chose que personne ne te dira

> 🔗 **Le franc CFA d'Afrique centrale (XAF) est arrimé à l'EURO**, à une parité
> **fixe** : **1 EUR = 655,957 XAF**, garantie par le Trésor français depuis 1999.
>
> 🔗 [Direction générale du Trésor — fonctionnement de la zone franc](https://www.tresor.economie.gouv.fr/tresor-international/la-zone-franc/les-principes-et-modalites-de-fonctionnement-de-la-cooperation-monetaire) · [Franc CFA (BEAC)](https://en.wikipedia.org/wiki/Central_African_CFA_franc)

**Donc le XAF ne bouge jamais contre l'euro. Il ne bouge que contre le dollar —
et uniquement parce que l'euro bouge contre le dollar.**

Vérifions avec le taux de CMA CGM :

```
655,957 ÷ 573,204132 = 1,1444   →  EUR/USD valait 1,1444 le 24/04/2026
```

> ### 🔑 Ta vraie exposition n'est pas « dollar contre franc CFA ». C'est **EUR/USD**.
>
> Et ça change tout, pour trois raisons :
>
> **1. C'est mesurable.** EUR/USD est la paire de devises la plus échangée au
> monde. Le taux est public, en continu, gratuit.
>
> **2. C'est couvrable.** Une paire aussi liquide se couvre avec des instruments
> standards. Un « risque franc CFA exotique » ne se couvre pas ; un risque
> EUR/USD, si.
>
> **3. C'est ton métier.** Bonzini fait déjà des paiements en devises. **Tu es
> probablement la seule entreprise de fret de Douala qui sache ce qu'est une
> couverture de change.**

**L'ordre de grandeur du risque :** sur un fret de 3,42 M FCFA, **un mouvement de
5 % de l'EUR/USD, c'est 171 000 FCFA** — plus de trois fois l'écart entre deux
ports de départ. Tu peux passer une journée à comparer Nansha et Shekou et perdre
trois fois plus en deux semaines de change.

> 📌 **La règle d'exploitation qui en découle :** si tu cotes un client en FCFA
> mais que tu paies l'armateur en USD, **ton prix a une date de péremption.**
> Écris-la sur ta cotation : *« prix valable jusqu'au …, sous réserve d'un taux
> EUR/USD supérieur à X »*.

---

# 6. Où va l'argent — la part réelle du fret

Additionnons tout ce qui est **vérifié** sur ce dossier (hors droits de douane,
qui sont le module 9) :

| Poste | Montant XAF | Part |
|---|---|---|
| **Fret maritime** (Shekou → Douala, 5 968 USD) | **3 420 882** | **83,3 %** |
| Frais CMA CGM à l'arrivée (4 factures) | 372 279 | 9,1 % |
| Prestations RTC normales | 311 123 | 7,6 % |
| **TOTAL transport, sans pénalités** | **4 104 285** | **100 %** |

> ✅ **Recoupement :** 372 279 + 311 123 = **683 402** — exactement le chiffre
> « frais normaux » du module 3. Tout se tient.

**Et avec les pénalités du dossier réel :**

| | Montant | Part du fret |
|---|---|---|
| Transport sans pénalités | 4 104 285 | **83 %** |
| **+ pénalités de retard** | + 1 400 670 | |
| **= Coût réel du transport** | **5 504 955** | **62 %** |

> 🔑 **Deux enseignements opposés, et il faut tenir les deux :**
>
> **1. Le fret maritime est le poste dominant — 83 %.** Donc négocier le fret
> compte vraiment. Un rabais de 10 % sur le fret vaut 342 000 F, soit plus que
> tous les frais RTC normaux réunis.
>
> **2. Mais le fret est le poste sur lequel tu as le MOINS de pouvoir**, et les
> 17 % restants sont ceux sur lesquels tu en as le plus. Le retard, lui, a
> ajouté 34 % au coût total et il était **entièrement** dans tes mains.

---

# 7. Comment tu revends : l'unité payante

Maintenant l'autre côté du métier. **Tu achètes un conteneur, tu revends des
tranches.** En quelle unité ?

> 📐 **UP — Unité Payante** (*revenue ton*, *freight ton*) — l'unité de
> facturation du groupage. Elle résulte d'une comparaison :
>
> ### UP = le plus grand des deux, entre le **volume en m³** et le **poids en tonnes**
>
> C'est la **règle universelle du maritime : 1 m³ = 1 tonne.**
>
> 🔗 [DocShipper — définition de l'UP](https://docshipper.fr/definition/up-unite-payante-definition-logistique/) · [OVRSEA — le groupage LCL](https://www.ovrsea.com/blog-transport/lcl-groupage)

## Trois exemples

| Marchandise | Volume | Poids | UP facturées | Facturé au |
|---|---|---|---|---|
| Mouchoirs en papier | 10 m³ | 1,2 t | **10** | volume |
| Carrelage | 3 m³ | 6,5 t | **6,5** | poids |
| Caisse de 800 kg sur 2,5 m³ | 2,5 m³ | 0,8 t | **2,5** | volume |

> 🔑 **Pourquoi cette règle existe.** Un navire est limité **à la fois** en place
> et en poids. Facturer seulement au volume ferait perdre de l'argent sur le
> carrelage ; facturer seulement au poids en ferait perdre sur les mouchoirs.
> **L'UP protège le transporteur des deux côtés — et elle te protégera des deux
> côtés quand tu seras le groupeur.**

---

# 8. 🎯 La densité d'équilibre — le calcul le plus rentable de ce module

C'est ici que se gagne ou se perd l'argent du groupage, et je n'avais jamais
posé le calcul.

Ton 40' HC a **deux plafonds simultanés** (module 1) :

| Plafond | Valeur |
|---|---|
| Volume chargeable | **68 m³** 🟠 *(estimation : 85-90 % de 76,4 m³)* |
| Charge utile | **28 690 kg** 🟢 |

> 📊 **Densité** — le poids par unité de volume : `kg ÷ m³`.

### La densité qui remplit les deux plafonds exactement au même moment :

```
28 690 kg ÷ 68 m³ = 421,9 kg/m³
```

> ### 🔑 **422 kg/m³, c'est ta densité d'équilibre.**
>
> - Marchandise **plus légère** que 422 → tu bloques sur le **volume**, il te
>   reste du poids disponible
> - Marchandise **plus lourde** que 422 → tu bloques sur le **poids**, il te
>   reste de la place vide

## Et voici la conséquence commerciale, chiffrée

Combien d'UP peux-tu facturer dans un conteneur plein, selon la densité de la
marchandise ?

| Densité | Volume chargé | Poids chargé | **UP facturables** |
|---|---|---|---|
| 200 kg/m³ *(mouchoirs)* | 68 m³ | 13,6 t | **68,0** |
| 277 kg/m³ *(ton conteneur)* | 68 m³ | 18,8 t | **68,0** |
| **422 kg/m³** *(l'équilibre)* | **68 m³** | **28,7 t** | **68,0** ⬅️ optimum |
| 500 kg/m³ | 57,4 m³ | 28,7 t | **57,4** |
| 600 kg/m³ | 47,8 m³ | 28,7 t | **47,8** |
| 700 kg/m³ | 41,0 m³ | 28,7 t | **41,0** |
| 850 kg/m³ | 33,8 m³ | 28,7 t | **33,8** |
| 1 000 kg/m³ *(l'eau)* | 28,7 m³ | 28,7 t | **28,7** |
| 1 500 kg/m³ *(carrelage)* | 19,1 m³ | 28,7 t | **28,7** |
| 2 500 kg/m³ *(métal)* | 11,5 m³ | 28,7 t | **28,7** |

> ### 🔴 Regarde la chute : de **68 UP** à **28,7 UP**. Tu perds **58 % de ta recette** sur le même conteneur, au même prix d'achat.

> ⚠️ **La zone dangereuse : entre 422 et 1 000 kg/m³.**
>
> Dans cette bande, **tu factures au volume** (parce que m³ > tonnes) **mais tu
> es bloqué par le poids**. Le client paie 41 UP, tu as payé un conteneur entier,
> et tu ne peux plus rien y ajouter — il te reste 27 m³ de vide inutilisable.
>
> **C'est le pire scénario du groupage, et rien sur la facture ne te le signale.**

## Ce qu'il faut en faire — trois règles

**1. Calcule la densité de chaque lot avant de l'accepter.** `poids ÷ volume`.
Une division. Si le résultat dépasse 422, **ce lot va te coûter du volume vendable**.

**2. Ne refuse pas le lourd — utilise-le en dernier.** Regarde ton propre conteneur :

| | Valeur |
|---|---|
| Chargé | 64 m³ 🟡 · 17 710 kg 🟡 |
| Densité moyenne | **277 kg/m³** → largement sous l'équilibre |
| **Volume restant** | **4 m³** |
| **Poids restant** | **10 980 kg** |
| Densité vendable sur ces 4 m³ | **2 745 kg/m³** |
| **UP facturables sur ces 4 m³** | **max(10,98 t ; 4 m³) = 10,98 UP** |

> ### 💡 **Ces 4 derniers mètres cubes te rapportent 11 UP au lieu de 4.**
>
> **Les derniers m³ d'un conteneur léger sont les plus rentables de tout le
> chargement** — à condition de les vendre à un client qui a de la marchandise
> dense. C'est la même place physique, payée presque trois fois.
>
> **C'est un arbitrage que ton système peut calculer automatiquement** : « il
> reste 4 m³ et 10,9 t sur le conteneur du 15 — cherche du lourd. »

**3. Vise un mélange dont la densité moyenne est proche de 422 kg/m³.** Ni
seulement du léger (tu laisses 15 tonnes de capacité inutilisée), ni du lourd
(tu laisses du vide).

---

# 9. Le coût au m³ selon le remplissage

Le conteneur coûte **4 104 285 F** quoi qu'il arrive. Divisons par ce que tu
charges réellement :

| Remplissage | Volume | **Coût par m³** |
|---|---|---|
| 100 % | 68,0 m³ | **60 357 F** |
| 94 % *(ton dossier)* | 63,9 m³ | **64 210 F** |
| 85 % | 57,8 m³ | 71 008 F |
| 75 % | 51,0 m³ | 80 476 F |
| **60 %** | 40,8 m³ | **100 595 F** |
| 50 % | 34,0 m³ | 120 714 F |

> ### Entre 100 % et 50 % de remplissage, ton coût au m³ **double**.

## Ton seuil de rentabilité, en une formule

```
Remplissage minimum =   coût total du conteneur
                      ─────────────────────────────────
                       prix de vente au m³  ×  68 m³
```

Exemple avec des prix de vente **🟡 inventés** (je ne connais pas ton marché) :

| Si tu vends à | Il te faut charger | Soit un remplissage de |
|---|---|---|
| 70 000 F/m³ | 58,6 m³ | **86 %** |
| 80 000 F/m³ | 51,3 m³ | **75 %** |
| 100 000 F/m³ | 41,0 m³ | **60 %** |
| 120 000 F/m³ | 34,2 m³ | **50 %** |

> 🔑 **C'est le tableau le plus important pour ta trésorerie.** Il te dit, avant
> même d'ouvrir un conteneur, **à partir de quel volume tu gagnes de l'argent**.
> Et il te dit quand **fermer le conteneur et partir** vaut mieux que d'attendre
> un client de plus — parce que le module 5 t'a appris ce que coûtent les jours.

---

# 10. Spot, contrat, et validité

> ⚡ **Taux spot** — le prix du marché aujourd'hui, pour un départ précis. C'est
> ce que tu as obtenu sur CMA CGM SpotOn. **Valable quelques jours.**
>
> 📜 **Taux contractuel** — un prix négocié pour un volume annuel engagé. Plus
> stable, souvent moins cher, mais il faut un historique et un volume.

| | **Spot** | **Contrat** |
|---|---|---|
| Accessible tout de suite | ✅ | ❌ demande un volume |
| Prix | Suit le marché | Fixé à l'avance |
| En marché haut | Tu payes cher | ✅ tu es protégé |
| En marché bas | ✅ tu profites | Tu payes trop cher |
| Garantie de chargement | Parfois en option | Souvent incluse |

> 📌 **Ta position aujourd'hui : spot, et c'est normal.** Tu n'as pas encore le
> volume pour un contrat. **Mais chaque conteneur que tu cotes construit
> l'historique qui te donnera le contrat.** Note tout dans le comparateur Excel.

⚠️ **Et relis toujours la date de validité.** Un GRI annoncé peut faire monter le
taux de plusieurs centaines de dollars du jour au lendemain. **Une cotation sans
date de validité n'est pas une cotation.**

---

# 11. 🟡 Ce que je ne sais pas

| # | Inconnue | Comment la lever |
|---|---|---|
| 1 | **Le détail des surcharges au départ** — BAF, THC origine, DG surcharge | Onglet **Rate** de la cotation, toujours pas ouvert |
| 2 | **Le montant de la surcharge marchandises dangereuses** | Cotation sans « Hazardous » — le test n°1 depuis le module 3 |
| 3 | **Les frais au départ en Chine** (camion, terminal, douane export) | Devis d'un transitaire de Guangzhou |
| 4 | **Tes prix de vente au m³** — tout le §9 dépend d'eux | C'est ta donnée, pas la mienne |
| 5 | **Le trajet couvert par le *On Carriage Haulage*** de 110 000 F | À demander à CMA CGM |
| 6 | **Le vrai volume chargeable** — j'utilise 68 m³, une règle de pouce | Se mesure au troisième conteneur empoté |
| 7 | **Le tarif de groupage pratiqué à Douala** | Appeler trois groupeurs en se faisant passer pour un client |

---

## ✅ Ce qu'il faut retenir du module 6

1. **Le fret n'est pas un prix, c'est une addition** de dix à vingt lignes chez
   trois à cinq factureurs.
2. **Trois familles** : départ, mer, arrivée. **C'est l'arrivée qui surprend**,
   parce qu'elle arrive après.
3. **Demande toujours : « ce prix est-il *all-in* ? »**
4. **Tes frais de dossier sont une cascade** : tout est un pourcentage des
   77 000 F de droits de port. Multiplicateur **× 1,2930**. Donc **prévisible**.
5. **Le droit de timbre n'est pas soumis à la TVA.** 4 812 F d'erreur comptable
   par conteneur si on l'oublie.
6. **Certains frais sont au TEU** : ton 40' paie double.
7. **1 USD = 573,204 XAF** au taux CMA CGM du 24/04/2026 — une donnée réelle à garder.
8. **Le XAF est arrimé à l'EURO à parité fixe.** Ton risque de change est
   **EUR/USD** — mesurable, couvrable, et c'est ton métier.
9. **Le fret maritime fait 83 % du coût de transport** — mais c'est là que tu as
   le moins de pouvoir.
10. **UP = le plus grand des deux, m³ ou tonnes.** Règle universelle : 1 m³ = 1 t.
11. **Ta densité d'équilibre est de 422 kg/m³.** Au-delà, tu perds jusqu'à **58 %
    de recette** sur le même conteneur.
12. **La zone dangereuse est 422 à 1 000 kg/m³** : tu factures au volume mais tu
    bloques sur le poids.
13. **Les derniers m³ d'un conteneur léger sont les plus rentables** : 4 m³ vendus
    11 UP.
14. **Entre 100 % et 50 % de remplissage, ton coût au m³ double.**
15. **Une cotation sans date de validité n'est pas une cotation.**

---

## 🧠 Vérifie que c'est acquis

1. Un transitaire te dit « 5 900 USD Chine-Douala ». Quelle est ta première
   question, et quelle est la deuxième ?
2. Un client apporte 12 m³ pesant 9,5 tonnes. Combien d'UP factures-tu ? Quelle
   est sa densité ? Est-ce un bon client pour ton conteneur ?
3. Il te reste 6 m³ et 12 tonnes sur un conteneur qui part dans trois jours. Quel
   type de client cherches-tu, et combien d'UP peux-tu espérer facturer sur ces 6 m³ ?
4. Ton comptable applique 19,25 % de TVA sur les 92 732 F HT de la facture
   `CMIM1091424`. De combien se trompe-t-il, et pourquoi ?
5. Tu cotes un client en FCFA aujourd'hui pour un départ dans six semaines. Quel
   risque prends-tu, et comment l'écris-tu sur ta cotation ?
6. Les droits de port d'un terminal sont de 90 000 F. Sans voir la facture,
   combien vas-tu payer TTC sur la facture « frais de dossier » ?

---

## 📚 Sources du module

**Données réelles propriétaires** (la matière première de ce module)
- Factures CMA CGM `CMIM1091423`, `CMIM1091424`, `CMIM1092258`, `CMIM1100496`
  du dossier `docs/cargo/dossiers/2026-04_CTR-ECMU5839181_BL-GGZ2867008` —
  décomposition ligne par ligne extraite et recalculée au franc près
- Taux de change **1 USD = 573,204132 XAF** imprimé sur `CMIM1091424` du 24/04/2026
- Cotations CMA CGM SpotOn de septembre 2026

**Parité du franc CFA**
- [Direction générale du Trésor — les principes de la coopération monétaire de la zone franc](https://www.tresor.economie.gouv.fr/tresor-international/la-zone-franc/les-principes-et-modalites-de-fonctionnement-de-la-cooperation-monetaire)
- [Franc CFA d'Afrique centrale (BEAC)](https://en.wikipedia.org/wiki/Central_African_CFA_franc)

**Unité payante et groupage** — 🟠 sources professionnelles
- [DocShipper — UP (Unité Payante) : définition et calcul](https://docshipper.fr/definition/up-unite-payante-definition-logistique/)
- [OVRSEA — LCL / groupage](https://www.ovrsea.com/blog-transport/lcl-groupage)
- [DocShipper — LCL, guide du groupage maritime](https://docshipper.fr/definition/lcl-groupage-definition-logistique/)

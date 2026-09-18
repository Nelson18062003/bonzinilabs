# Articles 4 à 10 de la DAU — analyse ligne par ligne

> DAU `SDSD2-2026-IMP-020399-I` du 17/09/2026, bureau SDSD2/CMKP5, déclarant BNG TRANS
> SARL (n° H0451). Suite de l'analyse des articles 1 à 3.
> **Quatre erreurs de classement identifiées. Enjeu chiffré : 307 078 XAF.**

---

## 0. Méthode et vérification du modèle de calcul

Avant de proposer une correction, il faut savoir reproduire **exactement** ce que la
douane a calculé. Le modèle utilisé ici applique, dans l'ordre :

```
DDI   = valeur × taux TEC
DAC   = (valeur + DDI) × taux d'accises          [CGI art. 138(2)]
DEA   = valeur × 1 %                              [redevance informatique, LF2023 art. 9e]
TVA   = (valeur + DDI + DAC + DEA) × 17,5 %       [CGI art. 138(1)]
CAC   = 10 % de la TVA, réparti CAM 28 % / CAD 10 % / CAF 62 %
petites taxes = CIA 0,136 + CIB 0,064 + CCB 0,128 + CCI 0,272 + PRO 0,05 + TCI 0,408 + TIB 0,192 (%)
```

**Contrôle sur les 7 articles non exonérés de la DAU :**

| Art. | Marchandise | Modèle | DAU | Écart |
|---|---|---|---|---|
| 4 | Téléviseurs | 459 739 | 459 740 | 1 F |
| 5 | Mouchoirs | 144 333 | 144 334 | 1 F |
| 6 | Fenêtres alu | 409 880 | 409 882 | 2 F |
| 7 | Portes alu | 91 083 | 91 086 | 3 F |
| 8 | Chaises | 481 116 | 481 120 | 4 F |
| 9 | Régulateur | 86 198 | 86 202 | 4 F |
| 10 | Vêtements | 76 844 | 76 845 | 1 F |

Les écarts (1 à 4 F) proviennent des arrondis sur la répartition CAM/CAD/CAF.
**Le modèle est fiable : les chiffres ci-dessous sont exploitables.**

**Note sur les « petites taxes » :** l'article 10 porte CIA 0,2 % · CCI 0,4 % · TCI 0,6 %
sans CIB, CCB ni TIB. Les autres articles portent CIA 0,136 + CIB 0,064 = **0,2 %**,
CCI 0,272 + CCB 0,128 = **0,4 %**, TCI 0,408 + TIB 0,192 = **0,6 %**. **Ce sont les mêmes
prélèvements, simplement éclatés différemment. Aucune anomalie.**

---

## 1. Article 9 — le « RÉGULATEUR » déclaré comme réfrigérateur

### Ce que dit la DAU

| | |
|---|---|
| Code SH | **`841821.00.0000`** |
| Libellé du code | *« Réfrigérateurs de type ménager, à équipement électrique ou autre, à compression »* |
| Désignation commerciale saisie | **« REGULATEUR »** |
| Valeur | 150 000 XAF · 1 unité · 30 kg |
| DDI | **30 %** = 45 000 |
| Total droits et taxes | **86 202 XAF** |

### Pourquoi c'est faux

Un régulateur n'est pas un réfrigérateur. Ce ne sont pas deux sous-positions voisines :
ce sont **deux chapitres différents du Système Harmonisé**, avec deux fonctions sans
rapport.

- Le **n° 84.18** couvre les appareils **pour la production du froid** — c'est une machine
  thermique.
- Un **régulateur** est un appareil **électrique** ou **de contrôle** — il ne produit
  aucun froid.

Le code a manifestement été choisi par proximité de vocabulaire (« réfrigérateur » /
« régulateur »), pas par analyse de la marchandise.

### Le point décisif : quel que soit le type de régulateur, ce n'est jamais 30 %

Quatre lectures possibles du mot « régulateur », et leur position tarifaire réelle
(taux vérifiés sur le **Tarif Extérieur Commun CEMAC**) :

| Si c'est… | Position | Libellé du tarif | Taux DDI |
|---|---|---|---|
| un **régulateur / stabilisateur de tension** (le cas le plus courant au Cameroun) | **85.04** | *« Transformateurs électriques, convertisseurs électriques statiques (redresseurs, par exemple), bobines de réactance et selfs »* | **10 %** |
| un **régulateur de charge solaire** | **8504.40** | *« Convertisseurs statiques »* | **10 %** |
| un **régulateur automatique / thermostat** | **90.32** | *« Instruments et appareils pour la régulation ou le contrôle automatiques »* | **10 %** |
| un **régulateur / détendeur de pression** (gaz) | **8481.10** | *« Détendeurs »* | **20 %** |
| *déclaré aujourd'hui* | *84.18* | *« Réfrigérateurs… »* | ***30 %*** |

> **Dans les quatre hypothèses, le taux correct est 10 % ou 20 %. Jamais 30 %.**
> Le classement actuel est le plus cher de tous les scénarios possibles.

Le poids de **30 kg pour une unité** oriente fortement vers un **stabilisateur de tension
à servomoteur** (type 5-10 kVA), donc **85.04 à 10 %**. 🔵 **À confirmer par Nelson : de
quel appareil s'agit-il exactement ?**

### Ce que la correction rapporte

| | Actuel (8418, 30 %) | Corrigé (8504 ou 9032, 10 %) | Corrigé (8481, 20 %) |
|---|---|---|---|
| DDI | 45 000 | 15 000 | 30 000 |
| DEA | 1 500 | 1 500 | 1 500 |
| TVA | 34 388 | 29 137 | 31 762 |
| CAC (CAM+CAD+CAF) | 3 439 | 2 911 | 3 175 |
| Petites taxes | 1 875 | 1 875 | 1 875 |
| **TOTAL** | **86 202** | **50 423** | **68 311** |
| **Économie** | — | **35 779 XAF** | **17 891 XAF** |

**35 779 XAF sur une marchandise de 150 000 XAF — soit 24 % de sa valeur.**

Et l'effet est en cascade : baisser le DDI baisse la base de la TVA (art. 138(1) du CGI),
donc la TVA, donc les centimes additionnels. **Une erreur de code ne coûte jamais
seulement le droit de douane.**

---

## 2. Trois autres erreurs trouvées en vérifiant

### 2.1 Article 8 — les chaises : un siège n'est pas un « autre meuble »

| | |
|---|---|
| Code SH | **`940370.00.0000`** — *« Meubles en matières plastiques »* |
| Désignation | **« CHAISE DE SALLE A MANGER »** ×15 |
| Valeur | 500 000 XAF |
| DDI 30 % + **DAC 25 %** | 150 000 + **162 500** |
| Total | **481 120 XAF** |

**Le SH sépare explicitement les sièges du reste du mobilier :**

> **n° 94.01** — *« **Sièges** (à l'exclusion de ceux du n° 94.02), même transformables en
> lits, et leurs parties. »*
> **n° 94.03** — *« **Autres** meubles et leurs parties. »*

Une chaise de salle à manger est un **siège**. Elle relève du **94.01**, jamais du 94.03 —
et cela indépendamment de la matière (bois, plastique, métal : le 94.01 couvre les trois,
sous-positions 9401.61/69 pour le bâti bois, 9401.71/79 pour les sièges rembourrés,
9401.80 pour les autres).

**Taux DDI du 94.01 : 30 %** (vérifié sur le TEC). **Donc le droit de douane ne change
pas.** Ce qui change, c'est le droit d'accises — voir §3.

### 2.2 Article 10 — des vêtements déclarés comme friperie

| | |
|---|---|
| Code SH | **`630900.00.0000`** — *« **Articles de friperie** »* |
| Désignation | **« VETEMENTS »** |
| DDI 30 % + **DAC 12,5 %** | 30 000 + **16 250** |
| Total | **76 845 XAF** |

**« Friperie » signifie vêtements usagés.** Si les vêtements du conteneur sont **neufs**,
ils relèvent du **chapitre 61** (bonneterie) ou **62** (autres que bonneterie) selon le
vêtement, et non du 6309.

C'est la seule ligne de la DAU où le droit d'accises est **incontestablement fondé** —
`6309.00.00.000 Articles de friperie` figure noir sur blanc à l'annexe II du CGI. **Mais
il n'est fondé que si la marchandise est bien de la friperie.**

🔵 **À confirmer par Nelson : ces vêtements sont-ils neufs ou d'occasion ?**

Si neufs : **économie 19 379 XAF**.

### 2.3 Article 5 — les mouchoirs et une sous-position voisine

| | |
|---|---|
| Code SH | **`481820.00.0000`** — *« Mouchoirs, serviettes à démaquiller et essuie-mains… »* |
| DDI 30 % + **DAC 25 %** | 45 000 + **48 750** |
| Total | **144 334 XAF** |

Le code lui-même paraît correct pour des mouchoirs en papier. **C'est le droit d'accises
qui pose question** — voir §3.

---

## 3. Le droit d'accises : ce que dit exactement l'annexe II du CGI

**Source : Code Général des Impôts, édition 2024, ANNEXE II — « LISTE DES PRODUITS SOUMIS
AUX DROITS D'ACCISES », pages 104-106.**

Trois lignes de cette annexe concernent directement les articles 5, 8 et 10 :

> `6309.00.00.000` — **Articles de friperie** ✅ *couvre l'article 10*

> `4418. 10 00 000 ; 4418.20 00 000 ; 4418.73 00 000 au 4418.74 00 000 ;`
> **`9403. 30 00 000 ; 9403.50 00 000 ; 9403.60 00 000`** — *« les **ouvrages et mobiliers
> en bois** importés »*

> **`4818. 10 00 000`** — *« les **papiers hygiéniques** importés »*

### Ce que cela implique — et ce que cela n'implique pas

| Article | Code déclaré | Ce que l'annexe II vise | Lecture |
|---|---|---|---|
| **10** vêtements | `6309.00.00.000` | **`6309.00.00.000`** | ✅ **couvert — l'accise est fondée** |
| **8** chaises | `9403.70` (plastique) | `9403.30`, `9403.50`, `9403.60` — **mobiliers en BOIS** | ❌ la sous-position déclarée n'est pas visée |
| **5** mouchoirs | `4818.20` | **`4818.10`** — papiers **hygiéniques** | ❌ la sous-position déclarée n'est pas visée |

**Et pour l'article 9 (le régulateur) :** ni le 84.18 ni le 85.04 ni le 90.32 ni le 84.81
ne figurent à l'annexe II. **Aucun droit d'accises n'est dû, et la DAU n'en porte
effectivement aucun.** Cohérent.

### ⚠️ Réserve majeure — à lever avant toute action

**CAMCIS a bel et bien liquidé un DAC de 25 % sur les articles 5 et 8.** Or CAMCIS est le
système officiel de la douane camerounaise. Deux explications possibles :

1. **Le tarif intégré de CAMCIS rattache l'accise au niveau de la position (4818, 9403)
   et non de la sous-position** — auquel cas le calcul est conforme à la pratique et ma
   lecture de l'annexe est trop littérale ;
2. **La liste a été élargie** par la loi de finances 2025 ou 2026 — l'exemplaire du CGI
   utilisé ici est **l'édition 2024**, et la DAU date de septembre 2026.

🔵 **Je n'ai pas pu trancher.** Aucune version 2025 ou 2026 du CGI n'est publiée sur
`impots.cm` sous les URL habituelles, et les résumés de la LF2026 consultés ne mentionnent
que le relèvement des accises sur les vins et spiritueux.

**Ce doute n'affecte PAS le raisonnement sur le régulateur (§1) ni sur la nature des
chaises (§2.1) : ce sont des erreurs de classement, indépendantes de toute table de
taxes.**

---

## 4. Le chiffrage complet

| Art. | Marchandise | Valeur | Taxe actuelle | Taxe corrigée | Économie | Confiance |
|---|---|---|---|---|---|---|
| **9** | Régulateur → 85.04 ou 90.32 | 150 000 | 86 202 | 50 423 | **35 779** | 🟢 **haute** — erreur de classement pure |
| **8** | Chaises → 94.01 (siège) | 500 000 | 481 120 | 287 336 | **193 784** | 🟠 classement sûr, effet accise à confirmer |
| **5** | Mouchoirs, accise à vérifier | 150 000 | 144 334 | 86 198 | **58 136** | 🟠 dépend du tarif intégré |
| **10** | Vêtements, **si neufs** | 100 000 | 76 845 | 57 466 | **19 379** | 🔵 dépend de la marchandise réelle |
| | **TOTAL** | **900 000** | **788 501** | **481 423** | **307 078** | |

**307 078 XAF sur 900 000 XAF de marchandises — soit 34 % de leur valeur déclarée.**

Pour mémoire, sur le même conteneur : la Toyota Fortuner représente **2 311 829 XAF** de
trop-perçu au titre de la valeur (article 2).

---

## 5. ⚠️ Ce qui est récupérable, et ce qui ne l'est pas

> **Code des douanes CEMAC, Art. 162.2** — *« Les rectifications ne peuvent porter que sur
> **le poids, le nombre, la mesure ou la valeur** des marchandises de la déclaration
> initiale. »*

**L'espèce — c'est-à-dire le code SH — n'est PAS rectifiable.** Les quatre corrections
ci-dessus portent toutes sur l'espèce.

| Conteneur | Récupérable ? |
|---|---|
| **MRSU9909331 (celui-ci)**, si la mainlevée n'est **pas** accordée | possible via l'**art. 162.3** — retrait de la déclaration avant mainlevée |
| **MRSU9909331**, si la mainlevée **est** accordée | non par l'art. 162 — voie de l'art. 163 (annulation, législations nationales) ou régularisation |
| **Tous les conteneurs suivants** | ✅ **oui, intégralement** |

**C'est donc d'abord un gain pour la suite, pas un remboursement.** Et c'est aussi la
démonstration de ce qui se joue à chaque conteneur : **307 078 XAF sur quatre petits
articles de 900 000 XAF, uniquement parce que les codes ont été choisis par ressemblance
de mots.**

---

## 6. Ce qu'il faut faire

### Demander à Citra — 10 minutes, et ça tranche tout

**Sortir de CAMCIS le « tarif intégré » de chaque code**, c'est-à-dire la liste des taxes
que le système rattache à la position. Pour ces six codes :

`841821` · `850431` / `850440` · `903289` · `940370` · `940180` · `481820` · `481810`

Cela donne, sans interprétation, le DDI et le DAC réellement appliqués par le système en
2026. **Ça règle d'un coup toute la réserve du §3.**

### Ce que Nelson doit confirmer

1. **Le « régulateur » : quel appareil exactement ?** Régulateur de tension ? de charge
   solaire ? thermostat ? détendeur de gaz ? → décide entre 10 % et 20 %.
2. **Les chaises : en quelle matière ?** (n'affecte pas le 94.01, mais documente le choix)
3. **Les vêtements : neufs ou d'occasion ?**
4. **La mainlevée de la DAU a-t-elle été accordée ?** → décide si l'art. 162.3 est encore
   ouvert.

### Pour les conteneurs suivants

Ces quatre erreurs ont toutes la même cause : **le code a été choisi à partir du mot de la
désignation commerciale, pas à partir de la marchandise.** « Régulateur » → réfrigérateur.
« Chaise » → meuble. « Vêtements » → friperie.

La parade est une **fiche produit par lot**, remplie à l'entrepôt en Chine : désignation
technique, fonction, matière, état (neuf/usagé), puissance, poids. C'est exactement la
pièce déjà exigée par la Voie A pour la valeur — **elle sert deux fois**.

---

## Sources

- **DAU `SDSD2-2026-IMP-020399-I`** du 17/09/2026, articles 4 à 10.
- **Tarif Extérieur Commun CEMAC** (Secrétariat Exécutif de la CEMAC, Tarif des douanes) —
  positions 84.18 (30 %), 84.81 (20 %), 85.04 (10 %), 90.32 (10 %), 94.01 (30 %).
  🔵 *Exemplaire consulté : édition 2007. Un TEC CEEAC-CEMAC est entré en vigueur au
  Cameroun le 1er janvier 2026 — les taux sont à re-confirmer sur le tarif intégré CAMCIS.*
- **Code Général des Impôts (Cameroun), édition 2024** — art. 138(1) et 138(2), art. 142 ;
  **ANNEXE II : Liste des produits soumis aux droits d'accises**, p. 104-106.
- **Code des douanes CEMAC, révision 2019** — art. 162.2, 162.3, 163.
- **Loi de finances 2023**, ARTICLE NEUVIÈME (redevance informatique = code DEA, 1 %).

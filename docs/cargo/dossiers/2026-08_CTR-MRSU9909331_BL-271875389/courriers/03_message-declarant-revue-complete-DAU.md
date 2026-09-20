# Message au déclarant — revue complète de la DAU SDSD2-2026-IMP-020399-I

> Destinataire : **M. Aoudou**, BNG TRANS SARL (agrément H0451)
> Émetteur : Nelson Soh, COO — NORTON GAUSS BONZINI SARL
> Objet : revue interne des deux versions de la déclaration du conteneur MRSU9909331
> **À envoyer tel quel.** Ton de collaboration, pas d'accusation : on demande un avis technique.

---

## MESSAGE

**Objet : Conteneur MRSU9909331 / BL 271875389 — quelques points techniques à valider avec vous**

Bonjour M. Aoudou,

J'espère que vous allez bien.

Nous avons entrepris de mieux maîtriser en interne la partie classement tarifaire et
valeur en douane de nos opérations, afin d'être plus précis dans les informations que nous
vous transmettons en amont. En relisant les deux versions de la déclaration du conteneur
**MRSU9909331** (la version initiale et la version définitive
`SDSD2-2026-IMP-020399-I` du 17/09/2026), plusieurs points nous ont interpellés.

Je vous les soumets **pour avoir votre avis technique**, article par article. Certains
viennent probablement d'informations incomplètes que nous vous avons nous-mêmes
fournies — et dans ce cas, dites-le-nous franchement, c'est exactement ce que nous voulons
corriger pour la suite.

---

### 1. Article 3 — le tracteur agricole : la tranche de puissance

C'est le point qui nous préoccupe le plus.

Le code a changé entre les deux versions :

| Version | Code | Libellé du code |
|---|---|---|
| Initiale | `870193.00.1000` | « Autres tracteurs d'une puissance de moteur **excédant 37 kW mais n'excédant pas 75 kW**, neufs » |
| Définitive | `870194.00.9100` | « Autres tracteurs d'une puissance de moteur **excédant 75 kW mais n'excédant pas 130 kW**, neufs » |

**Or le tracteur GJ 704-E développe 51 kW.**

- 51 kW se situe bien dans la tranche **37-75 kW** (code initial)
- 51 kW se situe **en dehors** de la tranche **75-130 kW** (code définitif)

**Questions :**
1. Qu'est-ce qui a motivé le passage de `870193` à `870194` ?
2. Disposiez-vous d'une information de puissance différente de 51 kW ? Si oui, laquelle
   et d'où venait-elle ?
3. Les deux libellés se terminent par **« neufs »**, alors que la désignation commerciale
   saisie indique **« USED, ANNEE 2014 »**. Comment cette contradiction est-elle traitée
   en pratique ?

**Et une question de fond :** nous avons relevé l'existence du code
**`870190.11.0000` — « Tracteurs agricoles à roues »**, qui ne comporte **ni condition de
puissance, ni condition de nouveauté**, et qui est par ailleurs le code tracteur repris à
l'annexe 1 du Code Général des Impôts. **Vous semble-t-il défendable pour cette machine ?**

**Enfin, un point sur lequel nous souhaitons votre franchise :** l'exonération `E00` a été
accordée sur `870194.00.9100`. Si ce code ne correspond pas à la puissance réelle,
sommes-nous exposés en cas de contrôle a posteriori ? **Préférez-vous que nous
régularisions maintenant plutôt que d'attendre ?** Nous préférons traiter le sujet
ouvertement.

---

### 2. Article 3 — l'identification de la machine

Sur la version **initiale**, le champ « VIN NUMBER » porte :
`SDLMT20260418AG01`

C'est **le numéro de la facture commerciale** reprise en case 44 de la déclaration, pas un
numéro de châssis.

Sur la version **définitive**, il porte : `24050226XXXXXXXXX` — un numéro **partiellement
masqué par des X**.

**Question :** disposons-nous du numéro de série réel et complet de la machine ? Si non,
comment se le procurer auprès du fournisseur ? Nous voudrions que ce champ soit exact sur
les prochaines opérations.

---

### 3. Article 9 — « RÉGULATEUR » déclaré sous un code de réfrigérateur

Sur les deux versions, la marchandise est déclarée sous **`841821.00.0000`**, dont le
libellé est :

> « Réfrigérateurs de type ménager, à équipement électrique ou autre, à compression »

Et la désignation commerciale saisie, sur la même page, est : **« REGULATEUR »**.

Un régulateur ne produit pas de froid. Selon sa nature réelle, il nous semble relever :

| Si c'est… | Position | Taux DDI |
|---|---|---|
| un régulateur / stabilisateur de tension | **85.04** | 10 % |
| un régulateur automatique, thermostat | **90.32** | 10 % |
| un détendeur de pression (gaz) | **84.81** | 20 % |
| *(déclaré actuellement)* | *84.18* | *30 %* |

**Questions :**
1. Ce classement vient-il d'une désignation imprécise de notre part ?
2. Pour les prochaines expéditions, quelles caractéristiques devons-nous vous fournir pour
   que vous puissiez trancher (fonction, puissance en kVA, tension, photo de la plaque
   signalétique) ?

---

### 4. Article 8 — les chaises : position 94.01 ou 94.03 ?

Déclarées sous **`940370.00.0000`** — « Meubles en matières plastiques », avec un droit
d'accises de 25 %.

La désignation est **« CHAISE DE SALLE A MANGER »**.

Or le Tarif sépare explicitement :
- **94.01** — « **Sièges** (à l'exclusion de ceux du n° 94.02), même transformables en lits »
- **94.03** — « **Autres** meubles »

**Question :** une chaise étant un siège, la position 94.01 ne serait-elle pas la bonne au
regard de la Règle Générale Interprétative 3 a) — la position la plus spécifique primant
sur la position résiduelle ?

Et si oui, **le droit d'accises de 25 % reste-t-il dû sur la position 94.01 ?**

---

### 5. Articles 5 et 8 — le droit d'accises

Les deux articles supportent un droit d'accises au taux général de **25 %** :

| Art. | Code | Libellé | DAC |
|---|---|---|---|
| 5 | `481820.00.0000` | Mouchoirs, serviettes à démaquiller et essuie-mains | 25 % |
| 8 | `940370.00.0000` | Meubles en matières plastiques | 25 % |

En consultant l'annexe II du Code Général des Impôts (liste des produits soumis aux droits
d'accises), nous y lisons :
- **`4818.10`** — « les papiers hygiéniques importés »
- **`9403.30`, `9403.50`, `9403.60`** — « les ouvrages et mobiliers **en bois** importés »

**Question :** ces sous-positions ne sont pas exactement celles déclarées. Le tarif intégré
CAMCIS rattache-t-il l'accise **au niveau de la position** (4818, 9403) plutôt que de la
sous-position ? Ou bien la liste a-t-elle été élargie par une loi de finances postérieure ?

**Si vous pouviez nous sortir le tarif intégré CAMCIS de ces deux codes, cela clarifierait
définitivement le point.**

---

### 6. Article 10 — « VÊTEMENTS » sous un code de friperie

Déclarés sous **`630900.00.0000`** — « **Articles de friperie** », avec un droit d'accises
de 12,5 %.

La friperie désigne des vêtements **usagés**. La désignation saisie dit simplement
« VETEMENTS ».

**Question :** s'agit-il de vêtements neufs ou d'occasion ? S'ils sont neufs, ils
relèveraient des chapitres 61 ou 62, qui ne figurent pas à l'annexe II — donc sans droit
d'accises.

---

### 7. Articles 1 et 2 — les deux véhicules

**a) La cylindrée de la Yaris a changé de tranche entre les deux versions :**

| Version | Code | Libellé |
|---|---|---|
| Initiale | `870322.10.9900` | « …cylindrée **excédant 1 000 cm³ mais n'excédant pas 1 500 cm³**… » |
| Définitive | `870323.10.9900` | « …cylindrée **excédant 1 500 cm³ mais n'excédant pas 3 000 cm³**… » |

Une seule des deux peut être exacte. **Quelle est la cylindrée retenue, et sur quelle pièce
s'appuie-t-elle ?**

**b) L'origine déclarée est « JP | Japon » pour les deux véhicules**, alors que les numéros
de châssis semblent indiquer autre chose :

| Véhicule | VIN | Première lettre |
|---|---|---|
| Yaris | `LVGCU9034AG042497` | **L** → Chine |
| Fortuner | `MHFDX8FS1K0095342` | **M** → Thaïlande |

**Question :** sur quelle pièce l'origine Japon est-elle fondée ? S'agit-il de l'origine
(pays de fabrication) ou de la provenance (pays d'expédition) ?

**c) Les poids déclarés ont changé entre les deux versions :**

| Article | Version initiale | Version définitive |
|---|---|---|
| 1 — Yaris | 3 750 kg | 2 600 kg |
| 2 — Fortuner | 4 750 kg | 2 750 kg |

**Quelle est la source du poids retenu ?** (Une Yaris pèse environ 1 000 kg à vide.)

**d) Le champ « Code Add. »** est passé de `000` à `A32` (article 1) et `A30` (article 2)
entre les deux versions. Nous avons constaté que `A30` réduit plusieurs lignes à 70 % de
leur montant. **Pourriez-vous nous expliquer ce que recouvre ce champ et selon quelle
règle il est attribué ?** Nous aimerions pouvoir l'anticiper.

---

### 8. Article 4 — les téléviseurs

20 téléviseurs déclarés pour **800 000 XAF**, soit 40 000 XAF l'unité, pour un **poids
total de 60 kg** (3 kg par téléviseur).

**Ces deux chiffres vous paraissent-ils tenables en cas de contrôle de la valeur ?**

---

### 9. Unités et quantités — plusieurs incohérences

| Art. | Marchandise | Quantité déclarée | Unité | Poids net |
|---|---|---|---|---|
| 5 | Mouchoirs | 50 | **KGM (kilogramme)** | 20 kg |
| 6 | Fenêtres coulissantes | 4 | **KGM (kilogramme)** | 70 kg |
| 7 | Portes en aluminium | 2 | **KGM (kilogramme)** | 60 kg |
| 10 | Vêtements | 8 | **KGM (kilogramme)** | 30 kg |

Sur les articles 6 et 7, la quantité semble être un **nombre de pièces** (4 fenêtres, 2
portes) alors que l'unité enregistrée est le **kilogramme**. Sur les articles 5 et 10, la
quantité en kilogrammes ne correspond pas au poids net.

**Question :** ces écarts ont-ils une incidence, ou s'agit-il d'un champ purement
statistique ?

---

### 10. Points sur l'ensemble de la déclaration

**a) Case 22 — assurance : 0,000**

Les conditions de livraison sont **CFR**, ce qui inclut le fret mais **pas l'assurance**.
Or l'assurance des facultés à l'importation est obligatoire au Cameroun (loi n° 75-14 du
8 décembre 1975).

**Une attestation d'assurance a-t-elle été établie pour ce conteneur ?** Si oui, pourquoi
la prime n'apparaît-elle pas en case 22 ? Si non, quelle est la marche à suivre ?

**b) Case 23 — numéro de domiciliation : vide**

La valeur en douane totale est de **28 695 705 XAF**.

**Quelle est votre pratique sur ce point, et devons-nous ouvrir une domiciliation pour les
prochains conteneurs ?**

**c) Déclaration d'importation**

Une seule DI (`SGS-31405-30_DICM02.pdf`) couvre les 10 articles. **Est-ce la pratique
normale pour un groupage, ou faut-il une DI par nature de marchandise ?**

---

### Ce que nous vous demandons

1. **Votre avis technique** sur chacun des points ci-dessus, même bref
2. **Le tarif intégré CAMCIS** des codes suivants, si vous pouvez l'éditer :
   `870190.11.0000` · `870193.00.1000` · `870194.00.9100` · `841821.00.0000` ·
   `850440.00.0000` · `940370.00.0000` · `940180.00.0000` · `481820.00.0000`
3. **La liste exacte des informations** que vous attendez de nous, par type de marchandise,
   pour établir un classement juste du premier coup
4. **Votre avis sur le dossier tracteur** : faut-il régulariser, et si oui comment ?
5. **La mainlevée de cette déclaration a-t-elle été accordée ?**

---

Je tiens à préciser que cette démarche n'est pas une remise en cause de votre travail. Nous
cherchons à monter en compétence de notre côté pour vous transmettre de meilleures
informations en amont — c'est dans notre intérêt commun, et cela devrait aussi vous faire
gagner du temps.

Je reste disponible pour en discuter de vive voix si c'est plus simple.

Bien cordialement,

**Nelson Soh**
Directeur des Opérations
NORTON GAUSS BONZINI SARL
NIU M091712668533F

---

## Notes internes (à ne PAS envoyer)

### Points volontairement omis du message

| Point | Pourquoi je ne l'ai pas mis |
|---|---|
| Les chiffrages d'économie (307 078 XAF, etc.) | annoncer un manque à gagner met le déclarant sur la défensive. On veut son avis, pas sa justification |
| L'amende de 50 % sur la non-domiciliation | pas son sujet — la constatation relève du MINFI, pas de la douane |
| Le soupçon de sous-évaluation de la Fortuner | à traiter séparément, c'est un sujet de valeur et pas de classement |
| La piste Citra | à ne pas mélanger avec une demande d'avis technique |

### Niveaux de confiance de ma part

| Point | Confiance |
|---|---|
| Tracteur : 51 kW hors de la tranche 75-130 kW | 🟢 **certain** — arithmétique simple sur le libellé officiel |
| Tracteur : les deux codes disent « neufs », machine « USED » | 🟢 **certain** — lu sur les deux déclarations |
| Régulateur ≠ réfrigérateur | 🟢 **certain** — deux chapitres différents |
| Chaise = siège = 94.01 | 🟢 **certain** — RGI 3 a) |
| VIN de l'ancienne DAU = n° de facture | 🟢 **certain** — chaîne identique à la case 44 |
| Accises sur 4818.20 et 9403.70 | 🟠 **à vérifier** — CAMCIS les a appliquées, ma lecture de l'annexe II peut être trop littérale |
| Yaris : cylindrée réelle | 🟠 **inconnue** — c'est une vraie question, pas une affirmation |
| Origine JP vs VIN | 🟠 **indice fort, pas une preuve** — le WMI donne le pays de construction, pas forcément l'origine douanière |
| Poids déclarés | 🔵 **anomalie de données**, sans incidence fiscale directe (tous les prélèvements sont ad valorem) |

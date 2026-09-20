# Message au déclarant — dossier tracteur et revue de la DAU

> Destinataire : **M. Aoudou**, BNG TRANS SARL (agrément H0451)
> Émetteur : Nelson Soh, COO — NORTON GAUSS BONZINI SARL
> **Version 2** — réécrite après clarification de la séquence réelle des événements.

## Séquence réelle (contexte interne)

1. Déclaration **initiale** : code `870193.00.1000` → **4 041 512 XAF** de droits et taxes.
2. Nelson trouve le montant élevé, **appelle le déclarant** et soulève lui-même la piste
   de l'exonération des tracteurs agricoles.
3. Au téléphone, le déclarant confirme « c'est exonéré » **sans préciser de quoi**.
4. Pendant l'échange, on constate que le tracteur fait ~51 kW et ne rentre pas dans la
   tranche du code initial.
5. Le déclarant pose alors `870194.00.9100` avec le code `E00` sur la déclaration
   **définitive** → **92 658 XAF**. Sans vérifier la tranche de puissance.
6. **Or 8701.94 vise 75-130 kW. Le tracteur n'y rentre pas davantage.**

**Le message ci-dessous assume que Nelson a lui-même orienté la discussion.** Il ne
reproche rien : il apporte le résultat des recherches faites depuis, et demande à
corriger ensemble.

---

## MESSAGE

**Objet : Tracteur du conteneur MRSU9909331 — suite de notre échange, et ce que j'ai trouvé depuis**

Bonjour M. Aoudou,

J'espère que vous allez bien.

Je reviens vers vous au sujet du tracteur du conteneur **MRSU9909331**, après notre
échange téléphonique.

Je veux d'abord être clair sur un point : **c'est moi qui ai orienté la discussion vers
l'exonération des tracteurs agricoles**, sur la base d'informations encore incomplètes de
mon côté. Vous avez suivi cette piste de bonne foi. Depuis, j'ai continué à creuser, et
j'ai trouvé des éléments que je préfère partager avec vous tout de suite plutôt que de les
découvrir dans deux ans.

---

### 1. Ce que j'ai trouvé sur l'exonération

Ma question de départ était simple : **exonéré de quoi exactement ?** Droits de douane,
TVA, ou les deux ?

J'ai trouvé la base dans le Code Général des Impôts :

> **Article 122** — « **Les entreprises des secteurs de la production agricole, de
> l'élevage et de la pêche**, bénéficient des avantages fiscaux ci-après : a. **En phase
> d'investissement** : […] **exonération de la TVA** sur l'achat des pesticides, des engrais
> et des intrants, ainsi que des **équipements et matériels de l'agriculture, de l'élevage
> et de la pêche figurant à l'annexe du présent titre** […] »

Et l'annexe correspondante s'intitule :

> « **Liste des équipements et matériels de l'agriculture, de l'élevage et de la pêche
> exonérés de la TVA** »

**Ma lecture — et je vous demande de me corriger si je me trompe :**

- l'exonération porte sur la **TVA**, pas sur le droit de douane
- le droit de douane relève du TEC CEMAC, un texte distinct
- l'avantage est ouvert aux **entreprises du secteur agricole en phase d'investissement**

**Or NORTON GAUSS BONZINI SARL est une société de logistique et de paiement**, pas un
producteur agricole.

**Ma question :** est-ce que je lis mal ? Existe-t-il une autre base, ou une pratique
administrative qui étend cette exonération à l'importateur quel qu'il soit dès lors que la
marchandise figure à l'annexe ?

---

### 2. Ma question principale : sur quoi repose le code `E00` ?

Sur la déclaration définitive, l'article 3 porte le code additionnel **`E00`**, et **toutes
les lignes de taxation sont à zéro** — DDI, TVA, centimes additionnels, petites taxes.
Seule la redevance informatique (`DEA`, 92 658 XAF) subsiste.

Si l'exonération de l'article 122 ne porte que sur la TVA, **le droit de douane de 10 %
(926 581 XAF) resterait dû.**

**Questions :**
1. Que recouvre exactement le code **`E00`** dans CAMCIS ?
2. **Sur quel texte repose-t-il** — l'article 122 du CGI, ou autre chose ?
3. Couvre-t-il réellement le droit de douane, ou seulement la TVA ?
4. Faut-il une pièce justificative au dossier, ou s'applique-t-il d'office ?

C'est le point que je souhaite comprendre en priorité, avant tout le reste.

---

### 3. La tranche de puissance — le point que nous avons manqué tous les deux

Nous avons vu ensemble que le code initial ne convenait pas. Mais en vérifiant les
libellés officiels après notre échange, je constate que **le nouveau code ne convient pas
davantage** :

| Version | Code | Libellé officiel du code |
|---|---|---|
| Initiale | `870193.00.1000` | « Autres tracteurs d'une puissance de moteur **excédant 37 kW mais n'excédant pas 75 kW**, neufs » |
| Définitive | `870194.00.9100` | « Autres tracteurs d'une puissance de moteur **excédant 75 kW mais n'excédant pas 130 kW**, neufs » |

**Le tracteur GJ 704-E développe environ 51 kW.**

- 51 kW est **dans** la tranche 37-75 kW → le code initial couvrait la bonne tranche
- 51 kW est **hors** de la tranche 75-130 kW → le code définitif la dépasse

Je reconnais que c'est en partie ma faute : je vous ai orienté vers l'exonération sans
avoir vérifié la puissance réelle. **Mais le résultat est que nous sommes passés d'un code
trop bas à un code trop haut, sans jamais toucher la bonne tranche.**

**Et un point présent sur les deux versions :** les deux libellés se terminent par
**« neufs »**, alors que la désignation saisie indique **« USED, ANNEE 2014 »**. Comment
cette contradiction se traite-t-elle en pratique ?

---

### 4. La piste que je propose : `870190.11.0000`

J'ai relevé l'existence du code :

> **`870190.11.0000` — « Tracteurs agricoles à roues »**

Ce code présente trois avantages à mes yeux :
- **aucune condition de puissance** — donc pas de problème de tranche
- **aucune condition de nouveauté** — donc compatible avec une machine usagée
- c'est **le code tracteur repris à l'annexe du CGI** relative aux équipements agricoles

**Ma question : ce classement vous paraît-il défendable pour cette machine ?** Et si oui,
avec quel taux de droit de douane et quel traitement TVA ?

---

### 5. Ce que je veux savoir sur l'exposition

Je préfère poser la question franchement.

Si le code posé ne correspond pas à la puissance réelle de la machine, et si l'exonération
appliquée est plus large que ce que le texte prévoit :

1. **Quelle est notre exposition** en cas de contrôle a posteriori ?
2. **Quel est le délai** pendant lequel la douane peut revenir sur ce dossier ?
3. **Vaut-il mieux régulariser maintenant**, spontanément, plutôt qu'attendre ?
4. **La mainlevée de cette déclaration a-t-elle été accordée ?**

Je note que la désignation commerciale décrit honnêtement la machine
(« AGRICULTURAL TRACTOR, GJ 704-E, 3500X1500X1500 MM, USED, ANNEE 2014 ») et que la
puissance n'a jamais été déclarée. **Est-ce que cela change quelque chose à la
qualification ?**

---

### 6. Deux détails sur l'identification de la machine

**a)** Sur la déclaration **initiale**, le champ « VIN NUMBER » porte
`SDLMT20260418AG01` — **qui est le numéro de la facture commerciale**, pas un numéro de
châssis.

**b)** Sur la déclaration **définitive**, il porte `24050226XXXXXXXXX` — **partiellement
masqué par des X**.

Je vais demander le numéro de série complet au fournisseur. **De quoi avez-vous besoin
exactement pour ce champ ?**

---

### 7. Pour les prochaines opérations

Au-delà de ce dossier, je voudrais mettre en place quelque chose de durable.

**a) Une fiche technique systématique.** Dites-moi **quelles informations vous devez
recevoir de nous**, par type de marchandise, pour établir un classement juste du premier
coup. Pour un engin, j'imagine : puissance en kW, état neuf/usagé, usage, numéro de série,
poids, dimensions. **Complétez la liste** et nous la remplirons avant chaque expédition.

**b) Une demande de décision anticipée.** Pour les tracteurs et engins agricoles que nous
importerons régulièrement, **peut-on demander une décision anticipée de classement à la
DGD** ? Cela nous donnerait un classement écrit et opposable, plutôt que de refaire ce
débat à chaque conteneur. **Pouvez-vous nous accompagner sur cette démarche ?**

**c) Le tarif intégré.** Si vous pouvez l'éditer depuis CAMCIS, j'aimerais recevoir le
tarif intégré des codes suivants, pour comprendre exactement quelles taxes chacun
déclenche :

`870190.11.0000` · `870193.00.1000` · `870194.00.9100`

---

### 8. Quelques autres points, moins urgents

Je les liste pour ne pas y revenir plus tard. Nous pourrons les traiter à votre rythme.

- **Article 9** — « REGULATEUR » déclaré sous `841821.00.0000`, dont le libellé est
  « Réfrigérateurs de type ménager ». S'agit-il d'une désignation imprécise de notre part ?
- **Article 8** — chaises déclarées sous `940370` (« Meubles en matières plastiques »)
  alors que la position 94.01 couvre les « Sièges ». Laquelle s'applique ?
- **Article 10** — vêtements déclarés sous `630900` (« Articles de friperie »). S'agit-il
  de vêtements neufs ou d'occasion ?
- **Case 22** — l'assurance est à 0,000 alors que les conditions sont CFR, qui ne
  comprennent pas l'assurance. **Une attestation d'assurance existe-t-elle pour ce
  conteneur ?**
- **Case 23** — le numéro de domiciliation est vide. Quelle est votre pratique, et
  devons-nous en ouvrir une pour les prochains conteneurs ?

---

### En résumé, ce que je vous demande

1. **Sur quoi repose le code `E00`**, et couvre-t-il le droit de douane ou seulement la TVA ?
2. **Votre avis sur `870190.11.0000`** pour cette machine
3. **Notre exposition** et s'il faut régulariser
4. **La mainlevée** a-t-elle été accordée ?
5. **La liste des informations** que vous attendez de nous à l'avenir
6. **Votre accompagnement** pour une décision anticipée

Je tiens à redire que je ne vous reproche rien. **C'est moi qui ai lancé la piste de
l'exonération**, et je préfère de loin qu'on remette ce dossier d'aplomb ensemble
maintenant. Nous montons en compétence de notre côté précisément pour vous transmettre de
meilleures informations en amont — cela devrait nous faire gagner du temps à tous les deux.

Je suis disponible quand vous voulez pour en parler de vive voix.

Bien cordialement,

**Nelson Soh**
Directeur des Opérations
NORTON GAUSS BONZINI SARL
NIU M091712668533F

---

## Notes internes (à ne PAS envoyer)

### Le chiffrage à garder en tête

| Scénario | Détail | Total |
|---|---|---|
| **A** — déclaration initiale, `870193`, aucune exonération | DDI 926 581 + TVA 1 799 883 + PCT 926 581 + CAC 179 988 + DEA 92 658 + petites 115 821 | **4 041 512** |
| **B** — exonération **TVA seule** (art. 122), DDI maintenu | DDI 926 581 + DEA 92 658 + petites 115 821 | **≈ 1 135 060** |
| **C** — ce qui a été liquidé, `870194` + `E00` | DEA seul | **92 658** |

**Écart B − C ≈ 1 042 402 XAF.** C'est le montant à provisionner.

### Base légale établie

| Point | Source |
|---|---|
| L'exonération porte sur la **TVA seule** | **CGI art. 122** + titre de l'annexe du Titre I |
| Elle vise les **entreprises du secteur agricole en phase d'investissement** | **CGI art. 122**, chapeau |
| Elle s'applique **d'office**, sans attestation | **CGI art. 128 ter** |
| Le **droit de douane** relève du TEC CEMAC, pas du CGI | Introduction du Tarif des douanes |
| Les tracteurs sont en **Catégorie II** (biens d'équipement) → **10 %** | Tarif CEMAC ; confirmé par la déclaration initiale |
| La douane a **3 ans** pour réclamer les droits | **Code des douanes CEMAC art. 398** |
| Fausse déclaration d'espèce → **amende = valeur des marchandises** | **art. 467.2** |
| Fausses déclarations **ou manœuvres** pour obtenir une exonération → bien plus lourd | **art. 478.4** |

### Ce qui protège Bonzini

- La désignation commerciale **décrit honnêtement la machine** (tracteur agricole, usagé,
  2014). Aucune fausse énonciation sur la marchandise.
- **La puissance n'a jamais été déclarée** — il n'y a donc pas de fausse affirmation sur
  ce point, mais une absence.
- **C'est Bonzini qui soulève l'anomalie**, de sa propre initiative.

→ Cela oriente vers l'**art. 467.2** (erreur de classement) plutôt que vers l'art. 478.4
(manœuvre). **L'écart entre les deux est considérable.**

### Ce que je n'ai volontairement pas mis dans le message

| Omis | Pourquoi |
|---|---|
| Le chiffre de 1 042 402 XAF | on demande un avis, pas une justification chiffrée. Le sortir met le déclarant en position de défense |
| Les articles 467.2 et 478.4 nommément | citer les articles de sanction à son prestataire est une menace implicite. La question « quelle est notre exposition ? » obtient la même information sans fermer la porte |
| La condition de bénéficiaire (entreprise agricole) posée comme une conclusion | formulée comme une **question** : « est-ce que je lis mal ? ». S'il connaît une pratique contraire, il la donnera. S'il ne la connaît pas, il ira vérifier |
| Citra | ne jamais mélanger une demande d'avis technique avec un signal de mise en concurrence |

### Mon niveau de confiance

| Point | |
|---|---|
| L'art. 122 n'exonère **que la TVA** | 🟢 **certain** — texte + titre de l'annexe, les deux concordent |
| L'art. 122 vise les **entreprises agricoles** | 🟢 **certain** — c'est le chapeau de l'article |
| 51 kW hors de la tranche 75-130 kW | 🟢 **certain** — arithmétique |
| Les deux codes disent « neufs », machine « USED » | 🟢 **certain** — lu sur les deux déclarations |
| Le VIN initial = n° de facture | 🟢 **certain** — chaîne identique à la case 44 |
| Tracteurs = Catégorie II à 10 % | 🟢 **confirmé** par la déclaration initiale elle-même |
| **Ce que recouvre `E00`** | 🔴 **inconnu** — c'est la vraie question du dossier |
| Une pratique administrative étendrait-elle l'art. 122 ? | 🔵 **non vérifié** — posé comme question ouverte |
| Puissance réelle exacte du GJ 704-E | 🔵 **non vérifiée** — « environ 51 kW » vient de Nelson, à confirmer par le fournisseur |

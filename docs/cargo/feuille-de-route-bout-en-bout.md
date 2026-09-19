# Feuille de route bout en bout — un conteneur Chine → Cameroun, étape par étape

> **Document opérationnel.** À ouvrir à chaque conteneur. Écrit le 16/09/2026.
>
> Marqueurs de fiabilité :
> 🟢 **texte officiel cité** · 🟡 **pratique établie, sourcée dans nos dossiers** ·
> 🔵 **[À CONFIRMER AVEC CITRA]** — je ne l'ai pas vérifié sur un texte, et c'est
> exactement le genre de point que le test à 1-3 conteneurs doit trancher.
>
> Colonne « plateforme » : où la pièce se range dans Bonzini Cargo aujourd'hui,
> et ⚠️ quand le type n'existe pas encore.

---

# Vue d'ensemble — les 7 phases

```
  PHASE 0          PHASE 1        PHASE 2        PHASE 3
  AVANT DE   →     LA        →    L'EMPOTAGE →   LE BOOKING
  COMMANDER        COMMANDE       (entrepôt)     ET L'EMBARQUEMENT
  ══════════       ════════       ══════════     ═════════════════
  Cameroun         Chine          Chine          Chine
  4-6 sem. avant   J-60           J-10 à J-3     J-3 à J0

                          PHASE 4        PHASE 5        PHASE 6
                     →    LA        →    L'ARRIVÉE  →   LA SORTIE
                          TRAVERSÉE      ET LA DOUANE   ET LA CLÔTURE
                          ═════════      ════════════   ═════════════
                          Cameroun       Cameroun       Cameroun
                          J0 à J+40      J+40 à J+50    J+50 à J+55
```

> ⏱️ **Le chiffre qui commande tout** (module 5) : le cycle réel observé est de
> **84 jours**, dont **40 jours au Cameroun après l'arrivée**, alors que
> **57 jours sont atteignables**. Les 27 jours d'écart sont exactement les
> 27 jours de surestaries facturés sur `ECMU5839181`.
> **Tout ce qui est fait en phases 0 à 4 sert à ne pas payer la phase 5.**

---

# PHASE 0 — Avant même de commander (Cameroun)

C'est la phase qu'on saute toujours, et qui coûte le plus cher quand on la saute.

| # | Ce qu'il faut | Qui le délivre | Quand | Sans ça |
|---|---|---|---|---|
| 0.1 | **NIU** (numéro d'identifiant unique) + **RCCM** | DGI / greffe | une fois | aucune déclaration possible |
| 0.2 | **Domiciliation bancaire** de l'opération | votre banque | **avant l'expédition** 🔵 | le transfert de fonds et la DI sont bloqués |
| 0.3 | **DI — Déclaration d'Importation** | via la banque / plateforme FIMEX 🔵 | **avant l'expédition** 🔵 | l'inspection ne peut pas se faire au départ |
| 0.4 | **Demande d'inspection PECAE** (SGS) | l'exportateur **ou** l'importateur | **avant embarquement** | ⚠️ voir l'encadré ci-dessous |
| 0.5 | **Assurance locale** | assureur agréé au Cameroun 🔵 | avant l'expédition | l'assurance étrangère peut être refusée |

> 🔴 **La leçon de `MRSU9909331`, et elle vaut de l'argent.**
> **[FAIT]** Le rapport de visite n° 385 porte la mention **« inspection à
> destination »**. **[HYPO forte]** Une inspection *à destination* au lieu d'*avant
> embarquement* est la conséquence d'une phase 0 faite en retard : la DI de ce
> dossier est datée du **04/08**, alors que le navire était parti le **20/06**.
>
> **Conséquence :** la SGS a évalué la marchandise **après** son arrivée, sans
> facture soumise, et a appliqué la **méthode 6.4** — valeur **triplée**.
> **Faire la phase 0 dans l'ordre, c'est retirer à la SGS le motif qui lui permet
> de vous surévaluer.**

**➡️ Décision Bonzini :** sur les 1 à 3 conteneurs du test Citra, **la phase 0 se
fait avant le départ, sans exception.** C'est la variable à isoler.

---

# PHASE 1 — La commande (Chine)

| # | Document | Qui l'émet | Pourquoi il compte | Plateforme |
|---|---|---|---|---|
| 1.1 | **Facture proforma** (PI, 形式发票) | le fournisseur | **le document fondateur** : code SH, poids, incoterm, banque. Base de la valeur en douane (art. 30) | ⚠️ **type absent** |
| 1.2 | **Preuve de paiement** (水单) | votre banque / Bonzini | **la pièce qui empêche la méthode 6.4** | ⚠️ **absent** |
| 1.3 | **Contrat de vente** s'il existe | les deux parties | prouve les conditions en cas de contestation de valeur | `OTHER` |

> 🟢 **Pourquoi la proforma est le pivot** (module 7) : la valeur en douane part du
> **prix effectivement payé ou à payer** (art. 30 du code CEMAC), auquel on
> **ajoute obligatoirement** le fret, la manutention et l'assurance
> (art. 31.1 e, f, g). Sans facture, la douane n'a pas de point de départ — et
> passe en méthode de dernier recours.

---

# PHASE 2 — L'empotage : ce qu'il faut exiger de la Chine 🔴

**C'est ta question de cette semaine.** Le conteneur est à l'entrepôt, ils chargent.
Voici ce qu'il faut réclamer **pendant** et **juste après** le chargement — après,
c'est trop tard, le conteneur est plombé et parti.

## Les 8 pièces à exiger, dans l'ordre

| # | Pièce | Qui | Pourquoi c'est non négociable | Plateforme |
|---|---|---|---|---|
| 2.1 | **Packing list définitive** (装箱单) | l'entrepôt | poids **et** dimensions **par lot de colis**. C'est la source du plan de chargement et de la répartition du fret dans la valeur en douane | `PACKING_LIST` ✅ |
| 2.2 | **Photos de l'empotage** — conteneur vide, mi-chargé, plein, portes fermées | l'entrepôt | seule preuve de l'état au départ. Règle la question « qui a abîmé quoi » | ⚠️ **absent** |
| 2.3 | **Numéro de conteneur + numéro de plomb**, photographiés | l'entrepôt | 🟢 CTU Code **§11.3.3** : n° de conteneur, VGM et n° de plomb doivent être communiqués. Le plomb doit être **ISO 17712** (§11.1.2) | partiel — champ `container_number` |
| 2.4 | **VGM — masse brute vérifiée** (SOLAS) | **l'expéditeur** | 🟢 SOLAS ch. VI règle 2 / résolution **MSC.380(94)**, en vigueur depuis le **1ᵉʳ juillet 2016**. **Sans VGM, l'armateur n'a pas le droit d'embarquer.** | ⚠️ **absent** |
| 2.5 | **Certificat d'empotage du conteneur** | l'empoteur | 🟢 CTU Code **§11.3.6**. 🟢 **§11.3.2** : *l'empoteur est responsable de la masse brute annoncée* | ⚠️ **absent** |
| 2.6 | **Certificat NIMP 15** si emballage bois | le fabricant de palettes | 🟢 Traitement **56 °C pendant ≥ 30 min**, marque IPPC sur **deux faces opposées**. Au Cameroun : **arrêté n° 003/06/A/MINADER du 3 avril 2006** | ⚠️ **absent** |
| 2.7 | **Déclaration de marchandises dangereuses + 危包证** si applicable | le fournisseur | 🟢 CTU Code **§10.2.6** : personnel formé obligatoire. Une DG non déclarée = refus d'embarquement et responsabilité pénale | ⚠️ **absent** |
| 2.8 | **Fiche technique / plaque constructeur** pour toute machine | le fournisseur | 🔴 c'est **exactement** ce qui manque aujourd'hui sur le tracteur : sans la puissance en kW, on ne peut pas trancher la sous-position tarifaire | ⚠️ **absent** |

## Les 3 vérifications à faire toi-même sur la packing list

🟢 Tirées du module 4 (CTU Code, annexe 7) :

1. **L'excentrement du centre de gravité ≤ 5 %** — §3.1.4. En pratique :
   > **Chaque moitié du conteneur doit peser entre 7 et 10,6 tonnes.**
2. **Les marchandises taxables ou dangereuses arrimées côté portes** — §3.2.2.
3. **Le lourd jamais sur le léger** — §3.2.3.

## Le contrôle qui aurait tout changé

> 🔴 **Compare la packing list avec ce que tu as commandé, colis par colis.**
>
> **[FAIT]** Sur `MRSU9909331`, la proforma listait un tracteur. Le B/L déclare
> `2 UNIT OF USED CARS` + `A LOT OF PERSONAL EFFECTS`. Le VGM le confirme :
> 17 960 − 14 210 = 3 750 kg de tare, cohérente → **le tracteur n'est pas dans le
> VGM**. Le conteneur est bloqué depuis le 26 août pour cette raison.
>
> **Ce contrôle prend deux minutes à l'empotage. Il a coûté trois semaines
> d'immobilisation.**

---

# PHASE 3 — Le booking et l'embarquement (Chine)

Tu commences à faire les bookings toi-même sur Maersk et CMA CGM — donc cette
phase te revient en partie.

| # | Document | Qui | Quand | Plateforme |
|---|---|---|---|---|
| 3.1 | **Booking confirmation** | l'armateur | à la réservation | ⚠️ **absent** |
| 3.2 | **Shipping Instructions (SI)** | **toi ou le transitaire** | avant la deadline SI | ⚠️ **absent** |
| 3.3 | **Déclaration d'exportation chinoise** (报关单) | l'exportateur | avant embarquement | ⚠️ **absent** |
| 3.4 | **BESC / ECTN** | 🟢 **« le chargeur ou son mandataire »** (art. 4) — **donc côté Chine** | **au port de chargement**, validé **au plus tard 48 h avant l'arrivée** | `BESC` ✅ |
| 3.5 | **Draft B/L**, puis **B/L final** | l'armateur | draft à vérifier avant émission | `BL` ✅ |
| 3.6 | **Certificat d'origine** | chambre de commerce chinoise | avant embarquement | `OTHER` |
| 3.7 | **Police d'assurance** | assureur | avant embarquement | ⚠️ `INSURANCE` existe en coût, pas en document |

> 🟢 **Le BESC** — arrêté n° **00557/MINT du 11 juillet 2006**, modifié par
> n° 000289/MINT de mars 2007. Il **s'obtient au port de chargement**, pas à
> l'arrivée. C'est pour ça qu'il figure dans le message au partenaire chinois :
> **c'est lui qui doit le faire**, ou nous en tant que mandataire.

## 🔴 Le contrôle du draft B/L — la seule fenêtre qui se referme

> **Le draft B/L est ton dernier moment de correction gratuite.**
>
> Vérifie, ligne par ligne : la description de la marchandise (**tout ce qui est
> dans la boîte doit y être**), le poids brut, le nombre de colis, le n° de
> conteneur, le n° de plomb, le shipper, le consignee, le notify.
>
> 🟢 Après l'arrivée, la rectification du manifeste n'est possible que
> **dans les 48 h de l'arrivée du navire** — code CEMAC **art. 140.1 a)**.
> Et 🟢 **art. 113.1** : les marchandises **doivent** être manifestées.

---

# PHASE 4 — La traversée : préparer le Cameroun pendant les 40 jours

C'est la phase gratuite. Tout ce qui est prêt ici ne sera pas payé en surestaries.

| # | À faire | Qui | Échéance | Plateforme |
|---|---|---|---|---|
| 4.1 | **Payer le fret** | Bonzini / le client | avant l'arrivée | ✅ `freight_paid` |
| 4.2 | **Obtenir le télex release** ou le B/L endossé | l'armateur, après paiement | avant l'arrivée | ✅ `telex_released` |
| 4.3 | **Valider le BESC** | le chargeur ou mandataire | 🟢 **48 h avant l'arrivée** | `BESC` ✅ |
| 4.4 | **Obtenir le RVC / attestation de vérification** | SGS → ANOR | avant l'arrivée | ⚠️ rangé dans `CUSTOMS` |
| 4.5 | **Constituer et transmettre le dossier complet au déclarant** | **toi** | **J-15** | ⚠️ pas d'étape |
| 4.6 | **Faire déposer le manifeste** | le consignataire du navire | 🟢 **48 h avant l'arrivée** — art. 117 | ⚠️ pas d'étape |
| 4.7 | **Faire préparer la déclaration en détail** | le déclarant | avant l'arrivée | ⚠️ pas d'étape |
| 4.8 | **Vérifier le code SH et l'exonération** | **toi** | avant le dépôt | ⚠️ pas d'étape |

> 🟢 **Rappel exonération** (fiche `reference/exonerations-cameroun.md`) :
> l'article **128-6a** du CGI exonère de **TVA** les biens de l'**annexe 1**, et
> l'article **128 ter** dit qu'elle s'applique **« d'office, sans donner lieu à
> délivrance préalable d'une attestation »**. Donc : **rien à demander — mais tout
> se joue sur le code inscrit à la déclaration.**
> ⚠️ Cela ne couvre **pas** le droit de douane.

## Le dossier à remettre au déclarant — la liste unique

Ce qu'on envoie à Citra en **un seul envoi**, nommé `BL_CONTENEUR` :

```
BL271875389_MRSU9909331/
├── 01_facture-proforma.pdf
├── 02_facture-commerciale-definitive.pdf
├── 03_preuve-de-paiement.pdf
├── 04_packing-list.pdf
├── 05_bill-of-lading.pdf
├── 06_telex-release.pdf
├── 07_BESC.pdf
├── 08_certificat-origine.pdf
├── 09_DI-et-domiciliation.pdf
├── 10_RVC-SGS.pdf
├── 11_police-assurance.pdf
├── 12_VGM-et-certificat-empotage.pdf
├── 13_NIMP15.pdf                    (si bois)
├── 14_fiche-technique-machine.pdf   (si machine)
└── 15_photos-empotage/
```

> 🔑 **C'est le standard.** Le même dossier, toujours, pour tous les conteneurs.
> C'est ce qui permet de comparer deux déclarants, de mesurer un délai, et
> d'empêcher qu'une pièce manquante devienne un pouvoir discrétionnaire.

---

# PHASE 5 — L'arrivée et la douane

| # | Étape | Qui | Plateforme |
|---|---|---|---|
| 5.1 | **Avis d'arrivée** | le consignataire | ✅ `arrival_notice_at` |
| 5.2 | **Déchargement** | le terminal | ✅ via les événements armateur |
| 5.3 | ⏰ **Début de la franchise** | — | ✅ `free_time_ends_on` |
| 5.4 | **Dépôt de la déclaration en détail** | le déclarant | ⚠️ **pas d'étape** |
| 5.5 | **Circuit / cotation** (vert, orange, rouge) 🔵 | la douane | ⚠️ **pas d'étape** |
| 5.6 | **Visite ou scanner** si circuit rouge | douane + SGS | ⚠️ **pas d'étape** |
| 5.7 | **Liquidation** — le calcul des droits | la douane | ✅ `customs_cleared_at` |
| 5.8 | **Paiement des droits** | Bonzini / le client | ⚠️ pas distingué de 5.7 |
| 5.9 | **Bon à enlever** | le port | ✅ `delivery_order_at` |

> ⏰ **Le compteur.** 🟡 Module 5, mesuré sur `ECMU5839181` : au-delà du
> **21ᵉ jour**, chaque jour coûte **44 413 F TTC**. Sur ce dossier, **27 jours**
> ont été facturés, soit **1 026 752 XAF** — la moitié de la facture totale.
>
> **Chaque étape de la phase 4 faite d'avance est un jour de moins ici.**

---

# PHASE 6 — La sortie et la clôture

| # | Étape | Plateforme |
|---|---|---|
| 6.1 | **Sortie du port** | ✅ `gate_out_at` |
| 6.2 | **Livraison au client** | ⚠️ pas d'étape |
| 6.3 | **Restitution du vide** — fin de la détention | ✅ `empty_returned_at` |
| 6.4 | **Réconciliation des coûts** : devis vs facturé, ligne à ligne | ✅ `cargo_costs` |
| 6.5 | **Archivage du dossier complet** | ✅ `cargo_documents` |

> 🟡 **Pourquoi 6.4 vaut plus qu'il n'en a l'air.** Sur `ECMU5839181`, la
> réconciliation au franc près a donné **2 084 072 XAF**, dont **1 400 670 de
> frais évitables** (67 %). Sans cette étape, on ne sait pas ce qu'un conteneur
> coûte vraiment — donc on ne peut ni le prévoir, ni le négocier.

---

# Ce que la plateforme couvre déjà — mon avis

## Ce qui est bon, et que je ne toucherais pas

1. **Le dossier par conteneur avec ses onglets** (Aperçu, Suivi, Chargement,
   Documents, Douane, Coûts, Client, Notes) est la bonne structure. Elle épouse
   le métier.
2. **`todo.ts` déduit les tâches au lieu de les faire saisir.** C'est juste :
   une liste à cocher se désynchronise, une liste déduite non.
3. **`cargo_costs` a déjà la bonne taxonomie** et un `paid`. C'est le grand livre
   du coût à quai.
4. **`landedCost.ts` et `loadplan.ts` existent**, avec des tests. Le savoir des
   modules 4, 6 et 7 est déjà passé dans le code.
5. **Le `free_time_ends_on` mis en avant** — c'est la seule date qui coûte de
   l'argent à l'heure près. Bonne décision.

## Les trois manques, par ordre d'importance

### 1. 🔴 La plateforme commence trop tard

`ARRIVAL_STEPS` démarre à l'**avis d'arrivée**. Or la moitié du travail — et la
totalité de ce qui évite les surestaries — se passe **avant**. Il manque toute la
phase 0 (DI, domiciliation, PECAE) et la phase 4 (dossier au déclarant, manifeste,
déclaration préparée).

**Le symptôme dans le code :** `cargo_shipments.container_number` est
`NOT NULL UNIQUE` — donc **un dossier ne peut pas exister avant qu'il y ait un
conteneur**, alors que la proforma arrive 2 à 4 mois plus tôt.

### 2. 🔴 Sept types de documents pour une réalité qui en compte vingt

`DOCUMENT_KINDS` connaît `BL`, `TELEX`, `INVOICE`, `PACKING_LIST`, `BESC`,
`CUSTOMS`, `OTHER`. Manquent, et chacun a une conséquence opérationnelle :

| À ajouter | Pourquoi |
|---|---|
| `PROFORMA` | le document fondateur |
| `PAYMENT_PROOF` | **la pièce qui empêche la méthode 6.4** |
| `VGM` | 🟢 obligation SOLAS — sans lui, pas d'embarquement |
| `PACKING_CERT` | 🟢 CTU Code §11.3.6 |
| `ISPM15` | 🟢 arrêté MINADER de 2006 |
| `DG_DECLARATION` | 🟢 CTU Code ch. 10 |
| `EXPORT_DECLARATION` | 报关单 — prouve qui a exporté et sous quel nom |
| `BOOKING` | le premier document qui existe |
| `ORIGIN_CERT` | tarif préférentiel |
| `INSURANCE` | existe en coût, pas en document |
| `DI` | Déclaration d'Importation + domiciliation |
| `RVC` | le rapport SGS — aujourd'hui noyé dans `CUSTOMS` |
| `LOADING_PHOTOS` | la seule preuve de l'état au départ |
| `TECH_SHEET` | 🔴 la plaque constructeur : sans elle, pas de sous-position |

**Sortir le `RVC` de `CUSTOMS` est la plus rentable des quatorze** : c'est la pièce
sur laquelle se joue la valeur en douane, donc l'essentiel de la facture.

### 3. 🟡 `todo.ts` ne connaît pas l'amont

Les tâches déduites sont : fret, télex, B/L, facture, BESC, navire, client. Il
manque : la DI, la proforma, la preuve de paiement, le RVC, le dossier transmis au
déclarant, la déclaration déposée. **Et surtout la règle la plus rentable :**

```ts
// Le tracteur de MRSU9909331 aurait été détecté le 22 juin.
if (HAS(docs,'PROFORMA') && HAS(docs,'BL') && !blCoversProforma(...))
  items.push({ id:'bl-mismatch', level:'now',
    label:'La marchandise de la proforma n’apparaît pas au connaissement',
    detail:'rectification du manifeste possible 48 h après l’arrivée — art. 140.1 a)' });
```

---

# Le plan pour le test Citra (1 à 3 conteneurs)

**L'objectif n'est pas de dédouaner. C'est de mesurer.** Un test sans mesure est
juste un dossier de plus.

## Les règles du test

1. **Phase 0 complète avant le départ**, sans exception. C'est la variable isolée.
2. **Un dossier `BL_CONTENEUR` normalisé**, envoyé en une fois à J-15.
3. **Tout passe par la plateforme** — aucune pièce qui ne vive que dans WhatsApp.
4. **Chaque date est horodatée**, même celles qui ne sont pas encore des champs :
   en note si nécessaire.

## Les 6 chiffres à relever sur chaque conteneur

| Mesure | Pourquoi |
|---|---|
| **Jours entre l'arrivée et le dépôt de la déclaration** | le vrai indicateur de performance d'un déclarant |
| **Jours entre le dépôt et la liquidation** | mesure la douane, pas le déclarant |
| **Jours de surestaries payés** | le coût direct de la lenteur |
| **Écart valeur SGS / valeur facture** | 🔑 mesure si la phase 0 faite à temps supprime la méthode 6.4 |
| **Écart coût à quai prévu / payé, ligne à ligne** | calibre le calculateur pour le conteneur suivant |
| **Nombre de relances nécessaires** | mesure ce qu'on ne facture jamais : ton temps |

> **[HYPO] à valider par le test, et c'est la plus importante :**
> *une phase 0 faite avant le départ fait disparaître la surévaluation SGS.*
> Si elle se vérifie sur trois conteneurs, c'est la procédure de Bonzini pour
> toujours, et c'est chiffrable en millions.

---

# Ce que je ne sais pas — à faire trancher par Citra 🔵

À poser, dans cet ordre, au prochain échange :

1. **La DI doit-elle être enregistrée avant l'expédition ?** Seuil de valeur ?
   Quel délai de traitement ? Quelle plateforme exactement ?
2. **La domiciliation bancaire** : obligatoire à partir de quel montant, et
   combien de temps avant ?
3. **L'assurance locale** est-elle strictement obligatoire, et sur quel texte ?
4. **PECAE** : qui déclenche l'inspection, dans quel délai, et **que faut-il
   exactement pour obtenir une inspection avant embarquement plutôt qu'à
   destination ?** ← la question la plus chère du lot.
5. **Le circuit de cotation** (vert / orange / rouge) : sur quoi la douane décide,
   et peut-on l'influencer par la qualité du dossier ?
6. **Que peut-on déposer avant l'arrivée du navire**, et qu'est-ce que ça change
   sur la franchise ?
7. **Kribi vs Douala** : les délais et les coûts diffèrent-ils, et comment ?

Chaque réponse devient un module (14 à 18 du parcours) et un champ de la
plateforme. **Le test Citra n'est pas qu'un test de prestataire : c'est la façon
dont on écrit les cinq modules qui manquent.**

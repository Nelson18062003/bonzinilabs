# Contrôle de cohérence des 3 véhicules : châssis, cylindrée, dates, codes SH, accises

> Fait le 15/10/2026, sur les pièces en notre possession. La déclaration en détail (DAU) et
> la déclaration d'importation (DI, GUCE IM375589EX01) **ne nous ont pas été transmises** :
> elles restent à contrôler.
>
> ⚠️ Données d'entreprise. Dépôt privé, ne pas diffuser.

## Les pièces comparées

| Pièce | Émetteur, date |
|---|---|
| BL Maersk 274428633 et liste de colisage (`00_URGENCE_plan-arrivee-kribi.md` §3) | Maersk, 18/09 |
| Certificats d'identification A/4025, A/4026, A/4027 | CICQ, Douala, 01/10 |
| BESC MI2661716 | CNCC, validé le 30/09 |
| Fiches CIVIC provisoires 825193, 825194, 825195 | SGS, 09 et 12/10 |
| Notre classement (`classement-sh.md`) | Bonzini, 02/10 |

## 1. Champ par champ

### Toyota Yaris

| Champ | BL et nos notes | CICQ | BESC | SGS | Verdict |
|---|---|---|---|---|---|
| Châssis | LVGCU92399G028166 | idem | idem | idem | ✅ identique partout, clé de contrôle juste |
| Modèle | Yaris | Toyota Yaris, type ZSP91 | **« toyota vitz »** | Yaris | 🟠 le BESC dit Vitz (nom japonais) |
| Cylindrée | 1 598 cm³ | 1 600 cm³ | non indiquée | 1 600 | ✅ |
| Énergie | essence | essence | — | essence | ✅ |
| Boîte | automatique (nos notes du 29/09, source non retrouvée) | — | — | **manuelle** | ❓ à constater à l'inspection : la boîte joue sur la valeur |
| Date | 2009 (VIN) | fabriquée 10/2009 | vide | 1ère mise en circulation 01/10/2009 | ✅ |
| Code SH | 8703.23.10.9900 | — | 8703.23.19 | 8703.23.10.990 | ✅ SGS = notre classement |

### Toyota RAV4

| Champ | BL et nos notes | CICQ | BESC | SGS | Verdict |
|---|---|---|---|---|---|
| Châssis | LFMJ34AF0E3035663 | idem | idem | idem | ✅ |
| Modèle | RAV4 | Toyota RAV4, type **ASA44** | **« TOYOTA AURIS »** | RAV4 | 🔴 le BESC se trompe de modèle |
| Cylindrée | 2 494 cm³ | **2 500 cm³** | — | **2 400** | 🔴 la SGS a écrit 2 400 |
| Transmission | 4x4 | type ASA44 = 4 roues motrices | — | 4x4, automatique | ✅ |
| Date | 2014 (VIN) | fabriquée 01/2014 | vide | 01/01/2014 | ✅ (le devis de Cynthia disait 2015) |
| Code SH | 8703.23.90.9100 | — | 8703.23.19 | 8703.23.90.910 | ✅ |

### Haval H6

| Champ | BL et nos notes | CICQ | BESC | SGS | Verdict |
|---|---|---|---|---|---|
| Châssis | LGWEF4A52GF073391 | idem | idem | idem | ✅ |
| Modèle | H6 Sport | Haval, type EF4A52 | Haval H6 | H6 | ✅ |
| Cylindrée | 1 497 cm³ turbo | 1 500 cm³ | — | 1 500 | ✅ reste ≤ 1 500, donc 8703.22 |
| Boîte, essieux, carrosserie, places | 4x2 | — | — | **non renseignés** | 🟠 fiche incomplète, à compléter à l'inspection |
| Date | 2016 (VIN) | fabriquée 2016 | vide | 01/01/2016 (date par défaut) | ❓ le vrai jour compte (partie 3) |
| Code SH | 8703.22.10.9100 | — | **8703.23.19** | 8703.22.10.910 | ✅ SGS juste, le BESC faux |

**Les codes SH de la SGS sont justes et identiques à notre classement** : sous-position par
cylindrée (8703.22 jusqu'à 1 500 cm³, 8703.23 de 1 500 à 3 000), puis niveau national
(.10 deux roues motrices, .90 quatre roues motrices ; 91… de 1 à 15 ans, 99… plus de 15 ans,
d'après notre DAU d'août).

## 2. Les champs communs aux trois fiches

| Champ | SGS | Réalité | Verdict |
|---|---|---|---|
| Origine | **vide** | Chine pour les trois (constructeurs LVG = GAC Toyota, LFM = FAW Toyota, LGW = Great Wall) | 🔴 à remplir « Chine ». En août, la DAU avait mis « Japon » |
| Date d'arrivée | 16/08, 07/10, 16/08 | déchargement le 05/10 (Maersk) | 🔴 fausse sur les trois |
| Manifeste n° | vide | — | 🟠 |
| Carte grise | « défaut de carte grise » | non fournie | 🔴 voir partie 3 |
| Importateur, NIU, BL, navire, voyage, port | justes | — | ✅ |
| Fret | 366 666 par véhicule | BESC : 3 000 USD pour le conteneur | ❓ méthode SGS inconnue |
| Assurance | 10 000 ou 0,2 % du FOB | BESC : incoterm CFR, sans assurance | ✅ cohérent |

## 3. 🔴 Le point qui coûte le plus : le taux d'accises a changé dans la loi

**Ce que dit le Code général des impôts, édition du 1er janvier 2026** (impots.cm, texte
officiel de la DGI) :

- *« Ne sont pas soumis au droit d'accises […] les véhicules de tourisme d'une cylindrée
  inférieure ou égale à 2 500 cm3, de 0 ans à 12 ans d'âge »* (art. 131 bis).
- *« Le taux moyen du Droit d'accises [12,5 %] s'applique aux : véhicules de tourisme d'une
  cylindrée inférieure ou égale à 2 500 cm3, de plus de 12 ans à 20 ans d'âge ; véhicules de
  tourisme d'une cylindrée supérieure à 2 500 cm3, de 0 à 15 ans d'âge »* (art. 142-7 a).
- Le commentaire officiel ajoute que, à l'importation, *« les modalités pratiques de mise en
  œuvre de ces exonérations relèvent de la compétence de l'Administration des Douanes »*.
- **Contradiction interne** : l'annexe II du même Code liste encore les anciennes tranches
  (« de plus de 10 ans à 15 ans », « de plus de 15 ans »).

**Ce que CAMCIS a appliqué en septembre 2026** (notre DAU d'août) : l'ancien barème, avec
25 % pour une Yaris 2009.

| Véhicule | Âge | Ancien barème (CAMCIS en septembre) | **Code 2026** |
|---|---|---|---|
| Yaris 2009, 1 600 cm³ | 17 ans | 25 % | **12,5 %** |
| RAV4 2014, 2 494 cm³ | 12 ans | 12,5 % | **0 %** si « 12 ans » compte dans « 0 à 12 ans », sinon 12,5 % |
| Haval 2016, 1 497 cm³ | 10 ans | 0 %, ou 12,5 % si l'âge est compté au jour près (01/01/2016) | **0 %** |

**Droits et taxes des 3 véhicules (moteur douane Bonzini, valeurs SGS) :**

| Hypothèse | Yaris | RAV4 | Haval | **Total** |
|---|---|---|---|---|
| Ancien barème, Haval à 0 % | 2 726 049 | 5 956 660 | 3 128 429 | **11 811 138** |
| Ancien barème, Haval à 12,5 % | 2 726 049 | 5 956 660 | 4 102 208 | **12 784 917** |
| Code 2026, RAV4 à 12,5 % | 2 203 972 | 5 956 660 | 3 128 429 | **11 289 061** |
| **Code 2026, RAV4 à 0 %** | 2 203 972 | 4 541 596 | 3 128 429 | **9 873 997** |

**Écart possible : jusqu'à 1 937 141 F** entre l'ancien barème et le Code 2026.

**Pourquoi la carte grise compte** : la SGS a mis des dates par défaut. Le vrai jour de
première immatriculation décide de la tranche :
- **RAV4** (Code 2026) : immatriculé après mi-octobre 2014, il a moins de 12 ans au jour de
  la déclaration, donc 0 % sans discussion.
- **Haval** (ancien barème) : immatriculé après mi-octobre 2016, il a moins de 10 ans,
  donc 0 %.

## 4. La valeur : ce qui peut la faire bouger

- **RAV4 « 2 400 cm³ »** : le type ASA44 est le moteur 2,5 L (2 494 cm³), et le certificat dit
  2 500. Une cote « 2,4 L » correspond à une autre génération de RAV4. Sans effet sur le
  code SH ni sur les tranches d'accises (tout reste ≤ 2 500), mais **la valeur a peut-être été
  prise sur la mauvaise version**. À faire corriger, et la valeur à revoir avec.
- **Yaris « manuelle »** : si la voiture est bien manuelle, la valeur est plus basse qu'en
  automatique. À constater à l'inspection.
- **Haval** : version (1,5 T), boîte et carrosserie non renseignées. À compléter.

## 5. Le BESC n'est pas cohérent avec le reste

| BESC MI2661716 | Réalité | Effet |
|---|---|---|
| « TOYOTA AURIS » | RAV4 | 🔴 risque de question à la douane |
| « toyota vitz » | Yaris | 🟠 |
| 8703.23.19 pour les 3 voitures | Haval en 8703.22 | 🟠 le BESC ne fixe pas le code de la DAU, mais l'écart se voit |
| Groupage : « non » | c'est un groupage (3 voitures et effets de plusieurs personnes) | 🟠 |
| Dates de mise en circulation | vides | 🟠 |
| Valeur facture 9 500 USD, FOB 6 500 USD | la SGS retient 13,2 M F de FOB pour les seules voitures (≈ 23 000 USD) | ❓ la valeur SGS l'emporte pour les voitures ; la facture déclarée paraît basse |

## 6. Ce qu'il faut demander à Cynthia, par ordre d'argent

1. **Appliquer le barème d'accises du Code 2026** (art. 131 bis et 142-7 a) : Yaris à 12,5 %
   au lieu de 25 %, RAV4 à 0 % s'il entre dans « 0 à 12 ans ». Si CAMCIS impose encore
   l'ancien barème, le faire écrire et demander sur quel texte.
2. **Fournir les cartes grises chinoises** (certificat d'immatriculation, avec la date de
   première immatriculation) des trois voitures, avant l'inspection. Les demander au
   transitaire ou aux propriétaires.
3. **Faire corriger la cylindrée du RAV4** (2 494 cm³, certificat 2 500) et revoir la valeur.
4. **Faire remplir l'origine « Chine »** et corriger les **dates d'arrivée** (05/10).
5. **Constater à l'inspection** la boîte du Yaris, et compléter la fiche du Haval.
6. **Nous transmettre la DI et le projet de DAU** avant validation, pour contrôle.
7. Voir s'il faut **faire rectifier le BESC** (Auris, Vitz, groupage) avec le CNCC.

## Sources

- Code général des impôts du Cameroun, édition au 1er janvier 2026 (impots.cm) : art. 131 bis,
  142-7 a, annexe II et commentaire de la loi de finances 2026 (§ 370 à 373).
- Fiches CIVIC SGS 825193 à 825195 ; certificats CICQ A/4025 à A/4027 ; BESC MI2661716.
- Calculs : moteur douane Bonzini (`src/lib/customs/engine.ts`), validé sur la DAU de septembre.

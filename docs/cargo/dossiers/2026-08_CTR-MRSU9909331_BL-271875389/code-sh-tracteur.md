# Code SH du tracteur — source officielle CAMCIS

**Conteneur** MRSU9909331 · **BL** Maersk 271875389
**Date de l'interrogation** 12 septembre 2026
**Source** CAMCIS, portail externe de la douane camerounaise — `https://ept.camcis.cm/ept`
**Méthode** appel direct de l'API de la nomenclature utilisée par le portail :
`POST /ept/com/popup/selectBusiComHsCdLangList_ex.do`
(paramètres `hsCd`, `hsDesc`, `hsClsfCd="12"`, `locale="fr"` — `hsClsfCd=12` = nomenclature
camerounaise à **12 chiffres**). Vérification unitaire de chaque code par
`POST /ept/com/popup/selectBusiComHsDesc_ex.do`.
C'est la **même base** que celle qu'interroge l'écran « Recherche du code SH » du site.

---

## 1. Le résultat en une ligne

Le code que la SGS a retenu — **`8701.93.00.1000`** — n'est **pas** un code agricole.
Le tarif camerounais contient toujours, **en vigueur**, la ligne agricole que vise
l'exonération du CGI :

| Code (12 chiffres) | Libellé officiel CAMCIS | Validité |
|---|---|---|
| **`870190.11.0000`** | **Tracteurs agric a roues (sauf chariots-tracteurs du 87.09), a mot a explos°/combust int.** | 26/12/2019 → **31/12/9999** |
| `870193.00.1000` | Autres tracteurs d'une puissance de moteur excédant 37 kW mais n'excédant pas 75 kW, **neufs** | 01/03/2023 → 31/12/9999 |

`31/12/9999` = pas de date de fin, la ligne est **active**.

C'est exactement le code cité par l'**annexe 1, section IV du Code Général des Impôts**
(« LES MATERIELS, ENGINS ET EQUIPEMENTS DE PREPARATION DU SOL ET DE CULTURE ») :
`870190 11 000` — « Tracteurs agricole à roues (sauf chariots-tracteurs du 87.09), à moteur
à explosion ou à combustion interne », qui ouvre l'exonération de TVA de l'**article 128-6a**.

> **Correction d'une affirmation antérieure de ma part.** J'avais écrit que le mot
> « agricole » n'existait plus dans la nomenclature en vigueur et que la SGS n'avait pas
> commis d'erreur de code. **Les deux étaient faux.** Vérification faite à la source :
> la ligne agricole `870190.11.0000` est toujours ouverte dans CAMCIS, et le tarif
> comporte même des lignes « à usage agricole » explicites (§3 ci-dessous).

---

## 2. Ce que dit le tarif camerounais, position 8701 entière (86 lignes)

Extraits utiles — nomenclature 12 chiffres, telle que renvoyée par CAMCIS :

### a) L'ancienne structure 8701.90 — toujours ouverte

| Code | Libellé | Depuis |
|---|---|---|
| `870190.11.0000` | **Tracteurs agric a roues** (sauf 87.09), à mot. à explos°/combust. int. | 26/12/2019 |
| `870190.11.0010` | idem, **usagés** | 09/06/2020 |
| `870190.12.0000` | Autres tracteurs à roues, cyl. < 4500 cm³ | 23/09/2020 |
| `870190.13.0000` | Autres tracteurs à roues, cyl. ≥ 4500 cm³ | 23/07/2020 |

### b) La structure SH 2022 par puissance moteur

| Code | Libellé | Agricole ? |
|---|---|---|
| `870191.00.1000` | ≤ 18 kW, neufs | non |
| `870192.00.1000` | 18–37 kW, neufs | non |
| `870193.00.1000` | **37–75 kW, neufs** ← *code SGS* | **non** |
| `870193.00.9100/.9200/.9900` | 37–75 kW, de 0–15 / 15–25 / +25 ans | non |
| **`870194.00.1100`** | **75–130 kW, à usage agricole, neufs** | **OUI** |
| `870194.00.1200` | 75–130 kW, à usage agricole, usagés | oui |
| `870194.00.9100` | 75–130 kW, neufs (non agricole) | non |
| **`870195.00.1100`** | **> 130 kW, à usage agricole, neufs** | **OUI** |
| `870195.00.1200` | > 130 kW, à usage agricole, usagés | oui |

**Le fait à retenir :** dans la structure par puissance, la mention « à usage agricole »
n'apparaît qu'**à partir de 75 kW** (8701.94 et 8701.95). Aux niveaux 8701.91, 8701.92 et
**8701.93**, il n'y a aucune sous-ligne agricole — seulement neufs / bandes d'âge.

### c) Doublon à 8701.93

Deux lignes « neufs » coexistent : `870193.00.0000` (depuis 02/01/2019, unité NMB,
`lastYn=N`) et `870193.00.1000` (depuis 01/03/2023, unité UNT). La seconde est celle
que la SGS a employée.

---

## 3. Conséquence directe sur notre dossier

Trois voies possibles, par ordre de force :

**Voie 1 — `870190.11.0000`.** C'est le code que nomme l'annexe 1 du CGI ; il est actif ;
son libellé décrit exactement la marchandise (tracteur agricole à roues, moteur à
combustion interne). C'est la seule voie qui rend l'exonération de TVA de l'article 128-6a
**mécanique** : le code figure textuellement dans la liste annexée.

**Voie 2 — `870194.00.1100`**, si et seulement si la puissance du tracteur **dépasse
75 kW** (≈ 102 ch). Cette ligne dit « à usage agricole, neufs » dans la structure SH 2022.

**Voie 3 — contester par la nature, pas par le code.** Si l'administration impose de
rester en `8701.93`, il faut plaider que l'exonération de l'article 128-6a porte sur le
**bien** listé à l'annexe 1 et non sur le seul numéro de code, la nomenclature ayant
changé entre-temps. C'est la voie la plus faible : elle ouvre une discussion, pas un droit.

### La donnée qui manque, et qui décide

**La puissance moteur du tracteur, en kW ou en ch.** Elle n'est dans aucun document en ma
possession. C'est elle qui départage :

- **≤ 75 kW (≈ 102 ch)** → pas de ligne agricole en SH 2022 → on demande `870190.11.0000`.
- **> 75 kW** → `870194.00.1100` « à usage agricole, neufs » est disponible directement.

À prendre sur la plaque constructeur de la machine, ou sur la facture / fiche technique
du fournisseur chinois.

---

## 4. Les deux erreurs SGS, désormais établies sur pièce

1. **« USED ».** Le tarif camerounais sépare formellement le neuf de l'usagé, avec des
   lignes distinctes à chaque niveau (`.1000` neufs vs `.9100/.9200/.9900` par bande
   d'âge ; `870190.11.0000` neuf vs `870190.11.0010` usagé). Écrire « USED » sur une
   machine neuve n'est donc pas une approximation de rédaction : **c'est le choix d'une
   autre ligne tarifaire**. Le rapport SGS est d'ailleurs contradictoire avec lui-même,
   puisque le code qu'il retient (`…00.1000`) est la ligne **« neufs »**.
2. **Absence de qualification agricole.** Le code retenu n'a pas de mention agricole
   alors que le rapport SGS écrit lui-même « agriculture tractor » en clair.

---

## 5. Limite de cette vérification — à dire tel quel

Le portail externe CAMCIS expose la **nomenclature** (codes, libellés, dates de validité)
sans authentification, mais **pas les taux**. Tous les endpoints de calcul de la taxe
(`clre/dps/rgsr/callCalculateTax.do`, `selectTaxDtlList.do`, `selectTaxAmtPrTaxKndList.do`…)
sont derrière login déclarant.

**Je n'ai donc pas pu lire dans CAMCIS le taux de droit de douane attaché à
`870190.11.0000` ni à `870193.00.1000`.** Ce qui est établi ci-dessus, c'est
l'**existence, le libellé et la validité** des codes — pas la fiscalité qui s'y rattache.
L'exonération de TVA vient du CGI (art. 128-6a + annexe 1), pas de CAMCIS.

Pour obtenir les taux : demander au déclarant (SITRASER) une simulation CAMCIS sur les
deux codes, ou consulter le tarif CEMAC.

---

## 6. Reproduire l'interrogation

```bash
# 1) prendre une session
curl -sS -c cj.txt -o /dev/null https://ept.camcis.cm/ept/main

# 2) interroger la nomenclature (extrait des champs utiles ; le VO complet
#    est celui du portail — tout champ manquant renvoie ValidationException)
curl -sS -b cj.txt -X POST \
  -H 'Content-Type: application/json' \
  -H 'X-Cupia-Api-Token: angular-http-transfer' \
  -H 'Referer: https://ept.camcis.cm/ept/main' \
  --data '{"hsCd":"8701","hsDesc":"","hsClsfCd":"12","locale":"fr", ...}' \
  https://ept.camcis.cm/ept/com/popup/selectBusiComHsCdLangList_ex.do
```

Réponse : `{"paginationInfo":{...},"resultList":[{"hsCd":"870190110000","hsDesc":"...",
"hsAplyStrtDt":"26/12/2019","hsAplyEndDt":"31/12/9999","qtyUt1Cd":"UNT"}, ...]}`

Équivalent manuel : écran « Recherche du code SH » du portail, champs *Code SH* /
*Description du SH*, structure tarifaire **12**.

---

# 7. Addendum du 12/09/2026 — `870194.00.1100` vs `870190.11.0000`

## 7.1 Ce que liste réellement l'annexe 1 du CGI

Dépouillement intégral du CGI édition 2024. **Section IV « LES MATERIELS, ENGINS ET
EQUIPEMENTS DE PREPARATION DU SOL ET DE CULTURE »** ne contient que deux codes du
chapitre 87 :

```
870110 00 000   Motoculteurs
870190 11 000   Tracteurs agricole à roues (sauf chariots-tracteurs du 87.09),
                à moteur à explosion ou à combustion interne
871620 00 000   Remorques et semi-remorques ... pour usages agricoles
```

**Ni `870193`, ni `870194`, ni `870195` n'apparaissent nulle part dans le CGI.**
Le seul autre endroit du CGI où figure `870190` est la liste du droit d'accises sur les
véhicules de plus de 15 ans — et il y est écrit « **à l'exclusion des tracteurs
agricoles** ».

**Conséquence directe :** l'exonération de TVA de l'article 128-6a est déclenchée
*par le code inscrit à l'annexe 1*. Avec `870190.11.0000`, elle est **mécanique**.
Avec `870194.00.1100`, elle suppose que l'administration admette la **correspondance**
entre l'ancienne ligne et la nouvelle. C'est un argument, pas un automatisme.

## 7.2 Statut technique des deux lignes dans CAMCIS

| Code | Unité | `lastYn` | `delYn` | Génération |
|---|---|---|---|---|
| `870190.11.0000` | **NMB** | N | *(vide)* | ancienne (2019-2020) |
| `870190.11.0010` | NMB | N | *(vide)* | ancienne |
| `870194.00.0000` | NMB | N | *(vide)* | ancienne (2020) |
| `870193.00.1000` | **UNT** | *(vide)* | *(vide)* | actuelle (2023) |
| `870194.00.1100` | **UNT** | *(vide)* | *(vide)* | actuelle (2023) |
| `870195.00.1100` | UNT | Y | *(vide)* | actuelle (2022) |

Lecture : les lignes de l'ancienne génération portent l'unité `NMB`, les nouvelles `UNT`
(code d'unité UN/CEE Rec. 20). **Aucune n'est supprimée** (`delYn` vide partout) et toutes
courent jusqu'au `31/12/9999`. `870190.11.0000` est donc une ligne **héritée mais
toujours ouverte** — déclarable, mais d'une génération antérieure à `870194.00.1100`.

## 7.3 ⚠️ Vérification bloquante avant de retenir `870194.00.1100`

`870194` = **puissance moteur supérieure à 75 kW** (≈ 102 ch) et inférieure ou égale à
130 kW. Ce n'est pas un choix de rédaction : c'est le critère de la sous-position.

**La SGS a classé en `8701.93`, c'est-à-dire la tranche 37–75 kW.** Il y a donc
contradiction entre le code `870194.00.1100` et la classification SGS. L'un des deux
se trompe de tranche de puissance.

Retenir `870194.00.1100` sur un tracteur qui ferait en réalité moins de 75 kW ne serait
pas une correction : ce serait une **fausse déclaration de sous-position**, plus grave
que la situation actuelle. Il faut donc la plaque constructeur, pas une déduction.

| Puissance relevée sur la plaque | Code à demander | Exonération TVA |
|---|---|---|
| **> 75 kW et ≤ 130 kW** | `870194.00.1100` « à usage agricole, neufs » | par correspondance avec l'annexe 1 — à plaider |
| **37 à 75 kW** | `870190.11.0000` (aucune ligne agricole n'existe à `8701.93`) | mécanique — code inscrit à l'annexe 1 |
| **> 130 kW** | `870195.00.1100` « à usage agricole, neufs » | par correspondance — à plaider |

## 7.4 Le test qui tranche en cinq minutes

Le portail externe ne donne pas les taux (§5). Mais SITRASER, connecté à CAMCIS, peut
lancer une **simulation de liquidation sur les deux codes** et lire directement lequel
porte l'exonération. Question à lui poser, mot pour mot :

> Pouvez-vous faire tourner une simulation de liquidation CAMCIS sur le tracteur, une
> fois avec `870190.11.0000` et une fois avec `870194.00.1100`, et me renvoyer les deux
> écrans de taxation ? Je veux voir lequel des deux codes déclenche l'exonération de TVA
> de l'article 128-6a du CGI (annexe 1, section IV), qui vise nommément
> `870190 11 000`. Précisez également la puissance moteur retenue à la déclaration.

Cette simulation coûte zéro et remplace toute discussion : elle montre le montant.

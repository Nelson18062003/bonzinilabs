# Abattement ministériel n° 0010623/MINFI/DGD — vérification sur le DAU

> Conteneur MRSU9909331 · BL 271875389 · arrivé à Kribi le 26/08/2026.
> Vérifié le 24/09/2026 : un recalcul personnel, deux recalculs indépendants (dont un
> contre-vérificateur chargé de réfuter), une décomposition complète, trois contrôles
> externes et une relecture critique. **Les trois recalculs concordent au franc près.**
>
> ⚠️ Données d'entreprise. Dépôt privé, ne pas diffuser.

---

# LA LETTRE

**N° 0010623/MINFI/DGD**, Yaoundé, 27 août 2026. Réf. : V/L du 17 août 2026.
Du **Ministre des Finances** (Louis Paul MOTAZE) à **M. NGANGOM Jonas Constant**, DG de
Norton Gauss Bonzini SARL.

> *« […] je marque mon accord pour un abattement de 30 % applicables exclusivement sur
> les valeurs CIVIC desdits véhicules. Le Directeur Général des Douanes est instruit
> dans ce sens. »*

Véhicules visés : châssis **MHFDX8FS1K0095342** (Fortuner) et **LVGCU9034AG042497**
(Yaris). Motif invoqué : *« charge fiscale élevée au regard de vos contraintes de
trésorerie »*.

---

# 1. L'ABATTEMENT A-T-IL ÉTÉ APPLIQUÉ ? OUI.

| Preuve | DAU provisoire (10/09) | **DAU définitif (17/09)** |
|---|---|---|
| Case 43 « Code Add. », Yaris | `000` | **`A32`** |
| Case 43 « Code Add. », Fortuner | `000` | **`A30`** |
| Case 51, articles 1 et 2 | vide | **« 00010623 du 27-08-2026 »** |
| Pièce jointe n° 42 | aucune pièce | **« SPE, Spécification ABATTEMENT NORTON.pdf », 27/08/2026** |
| Effets (articles 4 à 10) | `000` | `000`, **aucun abattement** |

**Le périmètre est respecté** : seuls les deux véhicules nommés en bénéficient.

Louis Paul Motaze est bien Ministre des Finances en août 2026 (en poste depuis
mars 2018, actes du 19/08 et du 28/08/2026 rapportés par la presse).

---

# 2. CE QU'IL A FAIT ÉCONOMISER : 4 589 827 XAF

**Méthode** : pour chaque ligne du DAU définitif, montant plein = arrondi(base × taux),
comparé au montant payé imprimé.

| | Plein tarif | Payé | **Économie** | |
|---|---|---|---|---|
| Fortuner (`A30`) | 11 849 929 | 8 319 937 | **3 529 992** | −29,8 % |
| Yaris (`A32`) | 2 941 865 | 1 882 030 | **1 059 835** | −36,0 % |
| **Total** | | | **4 589 827** | |

**Sans la lettre, le DAU définitif aurait été de 17 338 889 XAF au lieu de 12 749 062.**

---

# 3. COMMENT IL A ÉTÉ APPLIQUÉ — pas exactement comme la lettre le dit

**La lettre** : 30 % sur **la valeur**. **Le DAU** : valeurs inchangées (2 774 834 et
13 855 066), et **chaque montant de taxe** multiplié par 0,70. Toutes les bases (DAC,
TVA, centimes, DEV) restent calculées sur les montants pleins.

## Fortuner, `A30` : quasi conforme

- **Réduites de 30 %** : DDI, DAC, DEA, TVA, CAM, CAD, CAF, CCI, PRO, TCI, DEV
- **Non réduites** : CIA, CIB, CCB, TIB (72 046 au total), forfaits DEW/DEX/DEY
- Écart avec une lecture littérale : **21 614 XAF en défaveur** de l'importateur

## Yaris, `A32` : traitement différent, inexpliqué

| Ligne | Plein | Payé | Traitement |
|---|---|---|---|
| DDI | 832 450 | 832 450 | **non réduit** |
| DEA | 27 748 | 27 748 | non réduit |
| CIA | 5 550 | 5 550 | non réduit |
| DEV | 265 153 | 265 153 | **non réduit** |
| **DAC** | **901 821** | **112 728** | **÷ 8, soit −87,5 %** |
| TVA, CAM, CAD, CAF, CCI, PRO, TCI | | | −30 % |

Écart avec une lecture littérale : **179 278 XAF en faveur** de l'importateur.

**Bilan net contre la lettre : environ 157 664 XAF de plus que ce qu'elle accordait.**

🔴 **`A30` et `A32` ne sont pas des pourcentages.** Ce sont des codes CAMCIS dont le sens
n'est documenté publiquement nulle part. Deux codes différents pour deux véhicules
relevant de la même lettre : **question à poser à BNG TRANS SARL.**

---

# 4. D'OÙ VIENT LA BAISSE DE 12 053 192 ENTRE LES DEUX DAU

Décomposition recalculée, **résidu nul**. L'abattement est imputé en dernier, à codes
et taux définitifs.

| Cause | Montant |
|---|---|
| **Abattement ministériel** (Fortuner 3 529 992 + Yaris 1 059 835) | **4 589 827** |
| Exonération du tracteur, code `E00` | 3 022 273 |
| Suppression du précompte PCT (10 % → 0 %), 10 articles | 2 869 571 |
| Reclassement du Fortuner : DAC 25 % → 12,5 % (+2 684 853), moins DEV ajouté (−1 191 666) et forfaits (−11 250) | 1 481 937 |
| Autres frais (case 62) | 85 000 |
| Forfait du Yaris (11 250 → 6 666) | 4 584 |
| **Total** | **12 053 192** |

**La lettre explique environ 38 % de la baisse.** Ce pourcentage dépend de l'ordre
d'imputation : mesuré aux codes du provisoire, l'abattement pèserait 5 037 782 (41,8 %).

---

# 5. POINTS ANNEXES RELEVÉS

## Le tracteur, `E00` — non couvert par la lettre

Toutes les lignes à zéro sauf le DEA (92 658). Plein tarif 3 114 932, **3 022 274 non
perçus**. **Aucune pièce identifiable par son intitulé ne fonde cette exonération.** Le
seul texte connu, l'art. 122 du CGI, n'exonère que **la TVA**, et seulement pour les
entreprises agricoles en phase d'investissement (voir `code-sh-tracteur.md` et
`courriers/03_message-declarant-revue-complete-DAU.md`).

## L'origine déclarée « JP » est inexacte

| Véhicule | WMI | Constructeur | Statut |
|---|---|---|---|
| Yaris | **LVG** | GAC Toyota, **Chine** | vérifié |
| Fortuner | **MHF** | Toyota **Indonésie** (TMMIN) | WMI vérifié, assemblage indonésien probable |

**Aucun taux n'en dépend** : tarif extérieur commun identique pour ces pays, aucun
accord préférentiel. Pour une simple erreur, la qualification la plus probable est
l'**art. 463** du Code CEMAC (50 000 à 200 000 FCFA), atténuable par l'art. 461 en cas
de bonne foi. **À faire corriger sur les prochains DAU.**

Les années diffèrent aussi : Yaris 2010 selon le VIN (déclarée 2009), Fortuner
probablement 2019 (déclaré 2016). Aucun effet sur les lignes tarifaires.

## La base légale

Dans les textes consultés (Code CEMAC 2019, loi n° 2018/012 sur le régime financier de
l'État, LF 2025, projet de LF 2026, CGI 2024), **aucune disposition ne fonde un
abattement individuel pour contraintes de trésorerie**, et la lettre n'en cite aucun.
La pratique d'abattements par décision ministérielle existe pourtant (exemple de 2021 :
abattement général de 80 % sur le fret maritime) ; le FMI (rapport n° 23/418,
décembre 2023) relève le pouvoir discrétionnaire du Ministre pour intervenir au cas par
cas. **On ne peut pas en conclure à une irrégularité sans avis juridique.**

**Conséquence pratique :** conserver au dossier la lettre de demande du 17/08 et la
lettre du 27/08. Ce sont les pièces qui justifient l'abattement en cas de contrôle
a posteriori, dans le délai de prescription de trois ans (art. 398).

## À vérifier

- **Le DAU définitif ne montre encore aucun avis de paiement** (« Données
  comptables : 0 ») : confirmer que 12 749 062 est bien le montant payé.
- Les pièces 40, 41 (fiches CIVIC) et 42 (abattement) ne sont pas dans nos fichiers.
- Les taxes globales imprimées totalisent 403 511 pour 705 228 annoncés : obtenir le
  détail.

---

# 6. LA LETTRE NE COUVRE PAS LE NOUVEAU CONTENEUR

Elle vise nommément MRSU9909331, le BL 271875389 et les deux châssis. **Pour le
conteneur MIEU3611115, il faudrait une nouvelle demande.** Et l'abattement étant
*« exceptionnel »*, **aucune cotation client ne doit le supposer acquis.**

# Liquidation estimée des 3 véhicules sur les valeurs SGS (16/10/2026)

> Calcul du moteur douane Bonzini (`src/lib/customs/engine.ts`), qui reproduit CAMCIS à
> 2 F près sur notre DAU de septembre 2026. Ce n'est pas une sortie de CAMCIS : nous n'y
> avons pas accès. Valeurs : fiches CIVIC provisoires 825193 à 825195 (avant inspection).
>
> ⚠️ Données d'entreprise. Dépôt privé, ne pas diffuser.

> 🔒 **RÉFÉRENCE FIGÉE le 16/10/2026**, à comparer à la liquidation de la déclarante.
> Ne pas modifier ces chiffres. Moteur utilisé : version du commit `6ab528c` (29/09/2026).
> Les totaux sont verrouillés par un test (`src/tests/lib/customs/mieu3611115.test.ts`) :
> si le moteur change un jour, le test le signale. Copie PDF :
> `pdf/Liquidation_Bonzini_vehicules_2026-10-16.pdf`.

## Bases

| | Yaris 2009 | RAV4 2014 | Haval H6 2016 |
|---|---|---|---|
| Code SH | 8703.23.10.990 | 8703.23.90.910 | 8703.22.10.910 |
| Valeur imposable (V) | 2 567 652 | 6 959 505 | 4 789 202 |
| FOB | 2 190 986 | 6 579 680 | 4 412 536 |
| Accises, pratique CAMCIS de septembre (A) | 25 % | 12,5 % | 0 % |
| Accises, Code des impôts 2026 (B) | 12,5 % | 0 % | 0 % |

Formules : DDI = V × 30 % · DAC = (V + DDI) × accises · DEA = V × 1 % ·
TVA = (V + DDI + DAC + DEA) × 17,5 % · CAC = TVA × 10 % · TCI 0,6 % · CCI 0,4 % ·
CIA 0,2 % · PRO 0,05 % (de V) · DEV = (V + DDI + DAC + TVA) × 5 % · forfaits ≈ 10 000.

## Scénario A : ce que CAMCIS appliquait en septembre (le plus probable)

| Ligne | Yaris | RAV4 | Haval | Total |
|---|---|---|---|---|
| DDI droit de douane 30 % | 770 296 | 2 087 852 | 1 436 761 | 4 294 909 |
| DAC accises | 834 487 | 1 130 920 | 0 | 1 965 407 |
| DEA redevance informatique 1 % | 25 677 | 69 595 | 47 892 | 143 164 |
| TVA 17,5 % | 734 670 | 1 793 378 | 1 097 925 | 3 625 973 |
| CAC centimes additionnels | 73 468 | 179 338 | 109 792 | 362 598 |
| TCI intégration CEMAC | 15 406 | 41 757 | 28 735 | 85 898 |
| CCI intégration CEEAC | 10 271 | 27 838 | 19 157 | 57 266 |
| CIA Union africaine | 5 135 | 13 919 | 9 578 | 28 632 |
| PRO OHADA | 1 284 | 3 480 | 2 395 | 7 159 |
| DEV enregistrement véhicule 5 % | 245 355 | 598 583 | 366 194 | 1 210 132 |
| Forfaits véhicule | 10 000 | 10 000 | 10 000 | 30 000 |
| **Total DAU** | **2 726 049** | **5 956 660** | **3 128 429** | **11 811 138** |
| CIVIC (SGS) | 29 813 | 29 813 | 29 813 | 89 439 |
| Déclaration d'importation, 0,95 % du FOB | 20 814 | 62 507 | 41 919 | 125 240 |
| **Total à prévoir** | **2 776 676** | **6 048 980** | **3 200 161** | **12 025 817** |

## Scénario B : le Code des impôts 2026 appliqué (à faire valoir)

| | Yaris | RAV4 | Haval | Total |
|---|---|---|---|---|
| DAC accises | 417 244 | 0 | 0 | 417 244 |
| TVA | 661 652 | 1 595 467 | 1 097 925 | 3 355 044 |
| CAC | 66 165 | 159 547 | 109 792 | 335 504 |
| DEV | 220 842 | 532 141 | 366 194 | 1 119 177 |
| Autres lignes | identiques au scénario A | | | |
| **Total DAU** | **2 203 972** | **4 541 596** | **3 128 429** | **9 873 997** |
| **Total à prévoir** (avec CIVIC et DI) | **2 254 599** | **4 633 916** | **3 200 161** | **10 088 676** |

**Écart A − B : 1 937 141 F** (Yaris 522 077, RAV4 1 415 064).

## Ce qui peut s'ajouter ou changer

- **Précompte** : 2 % de V pour une entreprise au réel (CGI art. 21), soit 286 327 F, que
  Bonzini peut imputer sur son impôt. Sur la DAU définitive d'août, il était à 0 %.
- **Droit d'accises spécial « ordures » de 1 %** sur les marchandises importées (CGI 2026,
  art. C 81) : non vu sur la DAU de septembre. S'il est perçu : 143 164 F.
- **Valeurs définitives** après l'inspection physique (RAV4 notamment, cylindrée à corriger).
- **Abattement de 30 %**, s'il est demandé et accordé : environ 3,5 M de moins (scénario A).
- **Hors calcul** : honoraires de la déclarante, frais du port et du terminal KCT, frais
  locaux Maersk, surestaries (à partir du 16/10), transport vers Douala, effets personnels,
  immatriculation au Cameroun.

## Comparaison avec la liquidation de Cynthia (à remplir à réception)

| Ligne | Yaris : Bonzini (A) | Yaris : Cynthia | RAV4 : Bonzini (A) | RAV4 : Cynthia | Haval : Bonzini (A) | Haval : Cynthia |
|---|---|---|---|---|---|---|
| Valeur imposable | 2 567 652 | | 6 959 505 | | 4 789 202 | |
| Taux d'accises retenu | 25 % | | 12,5 % | | 0 % | |
| DDI | 770 296 | | 2 087 852 | | 1 436 761 | |
| DAC | 834 487 | | 1 130 920 | | 0 | |
| DEA | 25 677 | | 69 595 | | 47 892 | |
| TVA | 734 670 | | 1 793 378 | | 1 097 925 | |
| CAC | 73 468 | | 179 338 | | 109 792 | |
| TCI + CCI + CIA + PRO | 32 096 | | 86 994 | | 59 865 | |
| DEV | 245 355 | | 598 583 | | 366 194 | |
| Forfaits | 10 000 | | 10 000 | | 10 000 | |
| Précompte | 0 | | 0 | | 0 | |
| **Total DAU** | **2 726 049** | | **5 956 660** | | **3 128 429** | |

**Ce qu'il faudra regarder en premier en cas d'écart** : la valeur imposable retenue, le taux
d'accises (ancien barème ou Code 2026), le précompte (0 %, 2 % ou 10 %), la présence d'un
droit de 1 % « ordures » (CGI art. C 81), et les forfaits.

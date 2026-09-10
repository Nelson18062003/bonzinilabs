# Dossier — Conteneur ECMU5839181 · BL GGZ2867008

**Le dossier le plus instructif du corpus.** Un conteneur immobilisé 46 jours,
dont le coût d'arrivée est à **66 % composé de pénalités de retard**.

## Identité de l'opération

| | |
|---|---|
| Connaissement (BL) | `GGZ2867008` |
| Conteneur | `ECMU5839181` — 40' High Cube (45G1), 25 t |
| Navire · Voyage | **MARINA** · `0KB7RR1MA` · escale `MANA0KB7R` |
| Armateur | CMA CGM |
| Port de chargement d'origine | **NANSHA** (Guangzhou, Chine) |
| Transbordement | **KRIBI** — le RTC indique « Port de Chargement : CMKBI » |
| Port de déchargement | **DOUALA** — terminal RTC |
| Arrivée du navire | **26/04/2026 02:17** |
| Déchargement du conteneur | **27/04/2026** |
| Franchise accordée | **13 jours calendaires** |
| Première journée facturée | **17/05/2026** |
| Dernière journée facturée | **12/06/2026** |
| Enlèvement (draft RTC) | 06/06/2026 |
| Client facturé par le RTC | ⚠️ **BNG TRANS SARL** (et non Norton Gauss Bonzini) |

## Reconstitution du coût — tout se recoupe au franc près

### A · CMA CGM — frais normaux

| # | Facture | Objet | Montant TTC |
|---|---|---|---|
| 01 | CMIM1091423 | Frais de dossier (admin, port, informatique, sûreté, contribution) | 99 559 |
| 02 | CMIM1091424 | Maintenance + restitution conteneur, frais par BL, droit de timbre | 105 770 |
| 03 | CMIM1092258 | Frais de release (telex release) | 35 775 |
| 05 | CMIM1100496 | Transport post-acheminement (*On Carriage Haulage*) | 131 175 |
| | | **Sous-total** | **372 279** |

### B · CMA CGM — pénalités

| # | Facture | Période | Jours | Tarif/jour | Montant TTC |
|---|---|---|---|---|---|
| 04 | CMIM1100273 | Retrait tardif du BAD | — | — | 23 850 |
| 06 | CMIM1102324 | 17/05 · 18–23/05 | 1 + 6 | 17 465 puis 32 444 | 252 963 |
| 07 | CMIM1106123 | 24/05 → 06/06 | 14 | 32 444 | 541 653 |
| 08 | CMIM1107394 | 07/06 → 10/06 | 4 | 32 444 | 154 758 |
| 09 | CMIM1108123 | 11/06 | 1 | 32 444 | 38 689 |
| 10 | CMIM1108123 | 12/06 | 1 | 32 444 | 38 689 |
| | | **Surestaries** | **27 j** | | **1 026 752** |

⚠️ Les pièces 09 et 10 **portent le même numéro `CMIM1108123`** pour deux périodes
différentes (11/06 et 12/06) et deux dates d'émission différentes (09/06 et 11/06).
À faire confirmer par CMA CGM avant de payer les deux.

### C · RTC — facture terminal (draft n° 905857 du 03/06/2026)

| Ligne | Qté | P.U. | Montant TTC |
|---|---|---|---|
| Redevance sécurité 40' plein | 1 | 3 000 | 3 577,50 |
| Acconage 40' plein import — surpoids | 1 | 178 700 | 213 099,75 |
| Relevage de livraison (chargement camion) | 1 | 79 200 | 94 446,00 |
| **Encombrement 40' (plus de 15 jours)** | 1 | 200 000 | **238 500,00** |
| Stationnement PAD [J12–J20] | 9 | 600 | 6 439,50 |
| Stationnement PAD [J21–J40] | 12 | 2 400 | 34 344,00 |
| Stationnement RTC [J12–J13] | 2 | 600 | 1 431,00 |
| Stationnement RTC [J14–J20] | 7 | 600 | 5 008,50 |
| Stationnement RTC [J21–J40] | 12 | 2 400 | 34 344,00 |
| | | **TOTAL draft** | **631 190,25** |

Actualisé au 12/06 dans le devis : **661 191**.

### D · Total

| | Montant |
|---|---|
| CMA CGM (frais + surestaries) | 1 422 881 |
| RTC (acconage, encombrement, stationnement) | 661 191 |
| **TOTAL GÉNÉRAL** | **2 084 072 FCFA** |

## L'enseignement

| | Montant | Part |
|---|---|---|
| Surestaries CMA CGM | 1 026 752 | |
| Retrait tardif | 23 850 | |
| Encombrement + stationnement RTC | 320 067 | |
| **TOTAL PÉNALITÉS DE RETARD** | **1 370 669** | **66 %** |
| Coût qu'aurait eu le dossier sans retard | **713 403** | 34 % |

**Deux tarifs progressifs se cumulent :**
- CMA CGM : 17 465 F/jour le 1er jour, puis **32 444 F/jour**
- RTC : 600 F/jour de J12 à J20, puis **2 400 F/jour** de J21 à J40, plus un
  forfait d'**encombrement de 200 000 F HT** au-delà de 15 jours

**Chaque jour de retard après le 20e jour coûte ~37 000 FCFA** (CMA CGM + RTC cumulés).

## Points à éclaircir

1. **BNG TRANS SARL** est le client facturé par le RTC. Quel lien avec Norton Gauss
   Bonzini SARL ? Filiale, transitaire, ou erreur de facturation ?
2. **Doublon de numéro de facture** `CMIM1108123` (pièces 09 et 10).
3. **Pourquoi la facturation démarre-t-elle le 17/05** alors que le déchargement date
   du 27/04 et que la franchise est de 13 jours ? (27/04 + 13 j = 10/05)
4. **Acconage « surpoids »** à 178 700 F — quel seuil de poids déclenche ce tarif ?

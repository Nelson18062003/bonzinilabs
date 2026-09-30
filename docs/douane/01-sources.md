# Bonzini Douane — les sources du moteur

> 29/09/2026. Ce que `src/lib/customs/` calcule, d'où vient chaque chiffre, et ce qui
> reste à confirmer. Confiance : **Officiel** (texte primaire lu) · **Observé**
> (reproduit sur une vraie DAU CAMCIS) · **Marché** · **À vérifier**.

## 1. Le modèle de liquidation, vérifié

Rejoué sur la DAU `SDSD2-2026-IMP-020399-I` du 17/09/2026 (bureau Kribi Port V) et
sur la simulation RAV4 — `src/tests/lib/customs/engine.test.ts` :

| Cas | Moteur | Document | Écart |
|---|---|---|---|
| Art. 4 — téléviseurs, 800 000, 30 % | 459 740 | 459 740 | 0 |
| Art. 5 — mouchoirs, 150 000, 30 % + accises 25 % | 144 336 | 144 334 | 2 |
| Art. 6 — fenêtres alu, 900 000, 20 % | 409 883 | 409 882 | 1 |
| Art. 7 — portes alu, 200 000, 20 % | 91 086 | 91 086 | 0 |
| Art. 8 — chaises, 500 000, 30 % + 25 % | 481 120 | 481 120 | 0 |
| Art. 9 — « régulateur », 150 000, 30 % | 86 202 | 86 202 | 0 |
| Art. 10 — vêtements, 100 000, 30 % + 12,5 % | 76 847 | 76 845 | 2 |
| RAV4 2.0 L, occasion | 4 852 510 | 4 852 510 | 0 |
| RAV4 2.5 L, occasion, accises 25 % | 7 876 814 | 7 876 812 | 2 |
| RAV4 2.0 L, code additionnel A30 | 3 411 359 | 3 411 358 | 1 |
| RAV4 2.5 L, A30 | 5 528 369 | 5 528 370 | −1 |

Écart maximal : **2 F**. Le reste vient de l'arrondi des sous-composantes par CAMCIS.

## 2. Les prélèvements

| Code DAU | Prélèvement | Taux | Base | Source | Confiance |
|---|---|---|---|---|---|
| DDI | Droit de douane | TEC par ligne (0 à 30 %, 40 % possible au TEC CEEAC 2026) | V | TEC CEEAC-CEMAC | Observé |
| DAC | Accises | 2 · 5 · 12,5 · 25 · 30 · 50 % | V + DDI | CGI art. 138(2), 142, annexe II ; LF2026 art. 10 | Officiel |
| DEA | Redevance informatique | 1 % | V | LF2023 art. 9 ; LF2026 art. 12 | Observé |
| TVA | TVA | 17,5 % | V + DDI + DAC + DEA | CGI art. 138(1), 142 | Officiel (DEA dans la base : observé) |
| CAC | Centimes additionnels | 10 % de la TVA (CAM 28 / CAD 10 / CAF 62) | TVA | CGI art. 142(2) | Officiel |
| TCI (+TIB) | Intégration CEMAC | 0,6 % | V | acte CEMAC | Observé |
| CCI (+CCB) | Intégration CEEAC | 0,4 % | V | acte CEEAC | Observé |
| CIA (+CIB) | Union africaine | 0,2 % | V | décision de Kigali, LF2017 | Observé |
| PRO | OHADA (probable) | 0,05 % | V | — | Observé |
| DEV | Enregistrement véhicule d'occasion | 5 % | V + DDI + DAC + TVA | CGI (enregistrement) | Observé |
| DEW/DEX/DEY | Forfaits véhicule | ~10 000 F | — | — | À vérifier |
| — | Précompte sur achats | 2 % réel · 5 % simplifié · 10 % sans NIU | V | CGI art. 21(3) | Officiel |
| — | PVI (SGS) | 0,95 % | FOB, dès 2 000 000 F | Instruction 000625/MINFI/CAB | Officiel |
| — | CIVIC | 29 813 F par véhicule d'occasion | — | MINFI, 01/07/2025 | Marché |
| — | Taxe environnementale | ciment 2 500 F/t · fers 5 000 F/t · carreaux 15 000 F/t · plastiques 5 % (≤ 1 000 F/u) | poids, valeur | LF2026 (projet), CGI 228 septies | À vérifier (texte promulgué) |

## 3. Les listes du CGI encodées

- **Accises** (`excise.ts`) : art. 142(5) à 142(6)e et annexe II, édition 2024,
  p. 88-90 et 104-107. Les taux particuliers l'emportent sur le général (142(5)).
  Véhicules : règle CGI 2024 par défaut (c'est celle que CAMCIS appliquait en
  septembre 2026 — Yaris 2009 à 25 %), règle LF2026 chiffrée à côté.
- **TVA** (`vatExempt.ts`) : annexe I du titre II (p. 99-103) et annexe du titre I,
  matériel agricole (p. 70-75).
- Le CGI cite certains codes en SH 2017 (4418.10, 4015.11, 8424.81…) : ils sont
  réécrits par leurs successeurs SH 2022, et un test (`nomenclature.test.ts`)
  vérifie que **chaque** code des listes existe dans le SH 2022.

## 4. La nomenclature

`public/data/customs/nomenclature-cm.v1.json`, généré par
`scripts/customs/build-nomenclature.mjs` :

| Donnée | Source | Couverture |
|---|---|---|
| Libellés FR (2/4/6 chiffres) | Eurostat Comext, Nomenclature combinée, valide au 01/01/2026 | 5 612 / 5 612 |
| Libellés EN, sections | OMD SH 2022 (datasets/harmonized-system) | 5 612 |
| Taux TEC | OMC/CNUCED TRAINS via WITS — Cameroun, NPF appliqué 2019 (SH 2017) | 5 242 exacts, 306 déduits des lignes voisines, 64 inconnus |

Les taux TRAINS sont **identiques** à la DAU de septembre 2026 sur les 8 lignes
qu'elle porte (8418.21, 8504.40, 9032.89, 9403.70, 9401.80, 4818.20, 8528.72,
7610.10). Ils restent la dernière publication officielle : le TEC CEEAC du
01/01/2026 peut avoir changé des lignes (bandes 0 % et 40 %), ce que le simulateur
signale sur les familles concernées.

## 5. Ce qui manque, par ordre d'impact

1. **Le tarif intégré CAMCIS à 12 chiffres** (taux par ligne nationale, TEC CEEAC
   2026). Le portail public expose la nomenclature mais pas les taux ; la collecte
   automatique du portail n'a pas été faite. À obtenir auprès de la DGD ou d'un CAD
   (Citra) — c'est la seule source qui tranche les « À vérifier ».
2. Le texte **promulgué** de la LF2026 (loi n° 2025/012 du 17/12/2025) : table des
   accises véhicules, taxe environnementale.
3. Base légale du TCI à 0,6 %, du code additionnel A30, des forfaits DEW/DEX/DEY,
   minimum de la PVI, absence du précompte sur la DAU observée.
4. Procédure nationale de la **décision anticipée** (art. 75.4) et de l'annulation
   (art. 163).
5. Numérotation des articles dans le **nouveau code des douanes CEEAC-CEMAC** en
   vigueur depuis le 01/01/2026 (les articles cités viennent du code CEMAC 2019).

## 6. Sources

- Code des douanes CEMAC, révision 2019 — <https://www.sgg.cg/txts-droit-reg/CEMAC-Reglement-2019-05-revision-code-douanes.pdf>
- CGI Cameroun 2024 — <https://www.impots.cm/sites/default/files/documents/CGI%202024%20version%20francaise.pdf>
- Projet de LF2026 — <https://www.dgb.cm/wp-content/uploads/2025/11/PROJET-DE-LOI-FINANCES-2026_FR_26112025.pdf>
- TEC CEEAC en vigueur — <https://www.cncc.cm/fr/article/le-tarif-exterieur-commun-tec-de-la-ceeac-s-applique-au-cameroun-1031>
- Guide de l'importateur SGS Cameroun — <https://www.sgs.com/fr-cm/-/media/SGSCorp/Documents/Corporate/Technical-Documents/Technical-Guidelines-and-Policies/Guide-des-Importateurs-Cameroun-FR.cdn.fr-cm.pdf>
- WITS / TRAINS — <https://wits.worldbank.org>
- Eurostat Comext, classifications — <https://ec.europa.eu/eurostat/api/dissemination/files/?sort=1&dir=comext%2FCOMEXT_METADATA%2FCLASSIFICATIONS_AND_RELATIONS%2FCLASSIFICATIONS>
- Dépôt : `docs/cargo/reference/`, `docs/cargo/dossiers/`, `docs/cargo/simulations/`
- DESNZ, *Greenhouse gas reporting: conversion factors 2023* — <https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2023>
- GLEC Framework / ISO 14083 — <https://www.smartfreightcentre.org/en/our-programs/emissions-accounting/global-logistics-emissions-council/>

## 7. Routes, délais et émissions (étape 8, `src/lib/logistics/atlas.ts`)

Tout ce qui suit est un **ordre de grandeur**, marqué comme tel à l'écran.

| Donnée | Valeur retenue | Statut |
|---|---|---|
| Distance mer | points de passage Chine → Singapour → cap de Bonne-Espérance → golfe de Guinée (tracé de la carte Cargo, sans escales) : Nansha – Kribi ≈ 17 800 km | calculée |
| Distance air | grand cercle + 95 km (convention GLEC / EN 16258) | calculée |
| Arrière-pays | Douala – N'Djamena ≈ 1 800 km, Douala – Bangui ≈ 1 450 km, Douala – Yaoundé ≈ 245 km ; rail Camrail Douala – Ngaoundéré ≈ 885 km | à vérifier |
| Délais | mer 35–50 j, air 3–8 j, port et dédouanement 7–18 j (air 2–5 j), transit 5–12 j, dédouanement à destination 3–10 j | fourchettes de marché, remplacées par nos mesures dès 3 expéditions sur la ligne (RPC `logistics_observed_transit`) |
| Facteurs d'émission (kg CO₂e / t·km) | mer 0,016 · air 1,1 (avec forçage radiatif) · route 0,107 · rail 0,028 | DESNZ 2023 « freighting goods », arrondis — **à confirmer** avant tout usage déclaratif |

Méthode : ISO 14083 / GLEC Framework (tonnes × km × facteur par tronçon). Le
pré-acheminement usine → port en Chine n'est pas compté (distance inconnue).

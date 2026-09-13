# Admin mobile — 04 · Résultat de la passe du 13/09/2026

Mêmes 21 écrans, même harnais (`tools/audit-mobile.mjs`, 390 × 844, fixtures),
avant → après. « Textes < 14 px » compte les nœuds de texte visibles sous la
plus petite taille du kit ; « ronds » les boutons à rayon ≥ 20 px ; « cibles »
les contrôles dont un côté fait moins de 40 px.

| Écran | textes < 14 px | boutons ronds | cibles < 40 | ombres | flou |
|---|---|---|---|---|---|
| `/m` | 48 → **6** | 1 → **2** | 1 → **7** | 11 → **1** | 1 → **0** |
| `/m/deposits` | 51 → **6** | 14 → **2** | 5 → **7** | 14 → **1** | 1 → **0** |
| `/m/deposits/d5` | 37 → **15** | 11 → **2** | 13 → **11** | 7 → **3** | 0 → **0** |
| `/m/deposits/new` | 15 → **15** | 9 → **9** | 1 → **1** | 11 → **2** | 0 → **0** |
| `/m/payments` | 47 → **6** | 17 → **2** | 5 → **7** | 15 → **1** | 1 → **0** |
| `/m/payments/p3` | 35 → **26** | 7 → **6** | 8 → **8** | 13 → **8** | 1 → **0** |
| `/m/payments/new` | 22 → **22** | 10 → **9** | 1 → **1** | 11 → **1** | 0 → **0** |
| `/m/clients` | 49 → **6** | 15 → **2** | 6 → **6** | 11 → **1** | 2 → **0** |
| `/m/clients/u5` | 19 → **0** | 4 → **2** | 2 → **2** | 6 → **1** | 1 → **0** |
| `/m/assistant` | 1 → **6** | 4 → **3** | 0 → **0** | 7 → **1** | 0 → **0** |
| `/m/more` | 30 → **22** | 2 → **2** | 2 → **2** | 9 → **1** | 2 → **0** |
| `/m/more/rates` | 77 → **73** | 20 → **18** | 18 → **14** | 16 → **1** | 2 → **0** |
| `/m/dashboard` | 172 → **170** | 1 → **1** | 25 → **25** | 16 → **1** | 1 → **0** |
| `/m/cargo` | 33 → **6** | 4 → **3** | 1 → **5** | 7 → **1** | 2 → **0** |
| `/m/cargo/map` | 23 → **7** | 2 → **2** | 18 → **11** | 13 → **7** | 2 → **1** |
| `/m/cargo/track` | 20 → **0** | 2 → **2** | 4 → **0** | 4 → **1** | 1 → **0** |
| `/m/cargo/2` | 76 → **68** | 2 → **2** | 20 → **18** | 17 → **9** | 1 → **0** |
| `/m/cargo/2/suivi` | 47 → **39** | 2 → **2** | 12 → **10** | 12 → **4** | 1 → **0** |
| `/m/cargo/2/chargement` | 45 → **32** | 2 → **2** | 21 → **19** | 14 → **6** | 1 → **0** |
| `/m/cargo/2/documents` | 46 → **38** | 2 → **2** | 19 → **17** | 12 → **4** | 1 → **0** |
| `/m/cargo/2/couts` | 21 → **13** | 2 → **2** | 13 → **11** | 12 → **4** | 1 → **0** |

## Ce qui a changé

- **Fondations** — `src/mobile/designKit` réécrit aux valeurs Figma (canvas
  blanc, cartes r 8 à filet `#D9D9D9`, primaire `#2C2C2C` h 40, Neutral /
  Subtle / Danger, tags 14/600, champs h 40, feuille basse r 16). Les 73
  écrans ont basculé d'un coup ; les colonnes « ronds » et « flou » tombent
  à zéro là où le kit est seul à décider.
- **Navigation** — barre plate à cinq entrées : Mola · Cargo · Opérations ·
  Clients · Plus. `/m` redirige vers Opérations ; Mola garde la barre.
- **Opérations** — Dépôts et Paiements dans un écran, Tag Toggle + feuille
  `+` (dépôt, paiement, groupé, export PDF). Plus de tuiles KPI à 9 px, plus
  de boutons flottants de couleur de module, les noms ne tronquent plus.
- **Cargo** — quatre vrais écrans mobiles : flotte triée par gravité avec la
  prochaine action, Suivre en une colonne, dossier à en-tête de 120 px et
  huit chips atteignables, carte plein écran avec feuille par navire. La
  scène 3D se mesure (plus de 660 px en dur), les jauges passent au-dessus,
  les lots s'empilent sous `lg`, les jalons du parcours ne se chevauchent plus.

## Ce qui reste (même kit, écran par écran)

Les écrans dont le compte « textes < 14 px » reste élevé sont ceux qui
portent encore leurs tailles en dur : **Analytics** (170), **Taux** (73), les
**sections du dossier Cargo** (composants partagés avec le desktop, en
`.admin-theme`), **Plus** (22) et les **détails** dépôt / paiement. Ils ont
pris la palette, les rayons et les boutons du kit ; leur typographie est la
prochaine passe.

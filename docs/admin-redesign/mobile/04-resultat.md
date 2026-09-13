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

## Passe 2 (même jour) — le reste de l'app

Deux codemods (`scratchpad/codemod*.py`, reproductibles) ont remplacé dans
**71 fichiers** les utilitaires codés en dur par leurs équivalents du kit :
couleurs lilas et couleurs de module (`#8B5CF6`, `#10B981`, `#6B5BD2`…) →
encre `#2C2C2C` ; tons (`#DEEFE5/#2E7D52`…) → Tag Secondary ; couleurs
Tailwind nommées (`red-600`, `emerald-700`, `violet-500/10`…) → tons du kit ;
rayons 14–26 px et `rounded-full` sur les pilules → 8 ; toute taille
< 14 px → 14 ; libellés `uppercase tracking-wider` → 14/600 encre ; paires
`PRIMARY_PILL : SOFT_PILL` sur les filtres → Tag Toggle. 2 441 remplacements,
type-check et tests verts.

Après cette passe, sur les 15 écrans re-capturés, « textes < 14 px » tombe à
0–9 partout sauf Analytics (131 — les libellés de graphiques Recharts) ; les
formulaires Nouveau dépôt / Nouveau paiement / Paiement groupé sont à 0.

Volontairement conservés : les logos et couleurs **de marque** des méthodes
(Alipay, WeChat, Orange, MTN, Wave, banque), les couleurs d'identité des
devises en Trésorerie (XAF / USDT / CNY), et l'écran de connexion (composants
partagés avec l'app client, dont la charte est verrouillée).

## Passe 3 — les composants partagés avec le desktop

Les sections du dossier Cargo (`src/components/cargo/**`) et les briques
Analytics (`src/components/analytics/**`) servent aux deux apps. Plutôt que
de les dupliquer, chaque taille sous 14 px reçoit un `max-lg:` qui la monte
à l'échelle du kit sur mobile seulement (14 minimum, 16 pour les valeurs) ;
les libellés en majuscules espacées redeviennent 14/600 sans majuscules
sous `lg`. Les axes Recharts d'Analytics passent à 14. Le desktop est
re-capturé à 1440 px : inchangé. Exception assumée : les cinq escales du
parcours (`CargoJourney`) restent à 12 px, une rangée de cinq colonnes sur
390 px ne tient pas 14.

Après cette passe, les onglets Suivi, Documents, Douane et Coûts du dossier
sont à **0 texte sous 14 px** ; Aperçu à 7 (les escales).

## Passe 4 — Cargo, l'ordre des sections pensé pour le pouce

Sur mobile, les deux colonnes du dossier s'effacent (`max-lg:contents`) et
chaque section prend son rang :
- **Aperçu** : À faire avant l'arrivée → Où est-il → Parcours → Argent →
  Marchandise → Sur la carte (la carte, décorative, ferme la page).
- **Chargement** : Le remplissage → Dans la boîte (3D) → Les lots → Ce qui
  ne colle pas → À quoi ça sert.

L'onglet Cargo de la barre du bas porte un badge = nombre de conteneurs
« en retard » (`alertTally`). Dans le dossier, Rafraîchir devient une icône
de 36 px (`DossierActions compact`). La barre de la 3D passe à 14 px / 32 px
sous 640 px. Desktop re-capturé : inchangé.

## Passe 5 — Cargo pour la vraie cible (voir `05-simplicite.md`)

Retour fondateur : trop complexe, trop pâle, trop petit, du texte coupé.
Réponse : `src/lib/cargo/plain.ts` (16 tests) écrit l'état d'un conteneur
en phrases — « Arrive à Kribi le 11 octobre, dans 28 jours », « Retard de
14 jours sur la date promise », « Fret 6 550 $, pas encore payé. Télex pas
encore reçu. », « 5 pièces manquantes sur 5 ». Le sourd passe à `#5A5A5A`,
rien sous 16 px sur les écrans Cargo, plus aucun `truncate` dans les listes.

- **Flotte** : quatre lignes par conteneur (client + état, arrivée, retard,
  la prochaine chose à faire). Le numéro de boîte attend dans le dossier.
- **Dossier** : une phrase en en-tête, puis onze sections repliées en
  français (À faire · Où est le conteneur · Le trajet · L'argent · Les
  papiers · La douane et l'arrivée · Ce qu'il y a dedans · Le chargement en
  3D · Le client · Les coûts · Les notes), chacune avec un sous-titre qui
  dit l'essentiel sans l'ouvrir. Une ouverte à la fois, l'adresse suit.
- **Suivre** : le résultat en trois lignes et le bouton « Ajouter à ma
  flotte » ; le détail (ports, jalons) replié dessous.
- **Carte** : la feuille du navire dit « Arrive à Kribi le 11 octobre ».

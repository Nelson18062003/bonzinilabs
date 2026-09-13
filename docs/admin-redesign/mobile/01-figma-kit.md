# Admin mobile — 01 · Le kit Figma, relevé composant par composant

Fichier : `Simple Design System (Community)` — `https://www.figma.com/design/pRtXYDpaW1ChfctcV2opTk/…`
Relevé le 13/09/2026 par l'API REST, sur les nœuds réels du fichier (pas sur la
documentation du kit). Les valeurs ci-dessous sont **celles du Figma**, et elles
deviennent la loi de l'app mobile admin. Ce document remplace, pour le mobile,
la conclusion du `03-figma-kit.md` desktop (« le kit est un placeholder, on
garde le lilas ») : le fondateur a tranché dans l'autre sens — *« tu prends
les boutons dans le Figma, le design system de Figma, c'est ça que je veux »*.

## Ce qui a pu être lu, et ce qui ne l'a pas pu

| Page Figma | Lu ? | Source |
|---|---|---|
| Foundations (Color, Typography, Size, Effects) | **oui**, profondeur 8 | `figma_foundations.json` |
| Buttons (Button, Icon Button, Button Group, Button Danger) | **oui** | `figma_nodes.json` |
| Tags (Tag, Tag Toggle) | **oui** | `figma_nodes.json` |
| Cards (Card, Stats/Review/Testimonial/Pricing/Product) | **oui** | `figma_nodes.json` |
| Inputs, Menu, Navigation, Tabs, Dialog, Notification, Icons, Avatars, Accordion, Text | **non** — HTTP 429 | plan Figma *Starter*, `retry-after: 116534 s` (≈ 32 h) |

Le jeton est sur un plan Starter à quota « low » : après trois pages, Figma
ferme l'API pour 32 heures. Les quatre pages lues contiennent les **primitives**
(couleurs, type, rayons, espacements, ombres) et les trois composants dont tout
le reste dérive. Pour les pages non lues, les composants sont reconstruits à
partir des primitives et de l'anatomie publiée du kit ; ils sont marqués
« dérivé » plus bas et à vérifier au prochain créneau.

## 1. Couleur — la grille sémantique complète

Quatre familles (Background, Border, Text, Icon) × sept schémas. Le « Brand »
du kit est **volontairement gris** : c'est l'encre. Le violet de marque
n'existe pas dans les contrôles ; il reste réservé au logo et à la landing.

### Background
| Schéma | Default | Secondary | Tertiary | Hover |
|---|---|---|---|---|
| Base | `#FFFFFF` | `#F5F5F5` | `#D9D9D9` | `#B3B3B3` |
| Disabled | `#D9D9D9` | — | — | — |
| Brand | `#2C2C2C` | `#E6E6E6` | `#E6E6E6` | `#1E1E1E` (relevé sur Button:Hover) |
| Neutral | `#5A5A5A` | `#CDCDCD` | `#E3E3E3` | `#CDCDCD` |
| Success | `#14AE5C` | `#CFF7D3` | `#EBFFEE` | `#009951` |
| Warning | `#E8B931` | `#FFF1C2` | `#FFFBEB` | `#E5A000` |
| Danger | `#EC221F` | `#FDD3D0` | `#FEE9E7` | `#C00F0C` |
| Utilities | scrim `#FFFFFF@80 %` · overlay `#000000@50 %` | | | |

### Border
| Schéma | Default | Secondary | Tertiary |
|---|---|---|---|
| Base | `#D9D9D9` | `#757575` | `#383838` |
| Disabled | `#B3B3B3` | | |
| Brand | `#2C2C2C` | `#444444` | `#757575` |
| Neutral | `#303030` | `#767676` | `#B2B2B2` |
| Success | `#02542D` | `#009951` | `#14AE5C` |
| Warning | `#522504` | `#975102` | `#BF6A02` |
| Danger | `#900B09` | `#C00F0C` | `#EC221F` |

### Text (Icon suit la même grille)
| Schéma | Default | Secondary | Tertiary | On (sur fond du schéma) | On Secondary |
|---|---|---|---|---|---|
| Base | `#1E1E1E` | `#757575` | `#B3B3B3` | `#FFFFFF` | |
| Disabled | `#B3B3B3` | | | | |
| Brand | `#2C2C2C` | `#444444` | `#757575` | `#F5F5F5` | `#1E1E1E` |
| Neutral | `#303030` | `#5A5A5A` | `#767676` | `#F3F3F3` | `#303030` |
| Success | `#02542D` | `#009951` | `#14AE5C` | `#EBFFEE` | `#02542D` |
| Warning | `#522504` | `#975102` | `#BF6A02` | `#401B01` | `#682D03` |
| Danger | `#900B09` | `#C00F0C` | `#EC221F` | `#FEE9E7` | `#900B09` |

Lecture d'une pastille de statut « Secondary » : fond `Background/<schéma>/Secondary`
+ texte `Text/<schéma>/On Secondary`. Ex. succès = `#CFF7D3` + `#02542D`.

## 2. Typographie

Le kit est dessiné en **Inter** ; Bonzini remplace par **DM Sans, et rien
d'autre** (décision fondateur, déjà en place dans `tailwind.config.ts` : les
cinq clés `sans/display/body/ui/mono` pointent toutes sur DM Sans). Les
tailles, graisses et interlignes sont ceux du kit :

| Rôle Figma | Taille / interligne | Graisse | Usage mobile |
|---|---|---|---|
| Title Page | 48 / 57.6 · −0.96 | 700 | jamais sur mobile |
| Subtitle | 32 / 38.4 | 400 | jamais sur mobile |
| Heading | 24 / 28.8 · −0.48 | 600 | titre d'écran (un seul par écran) |
| Subheading | 20 / 24 | 400 | titre de section de premier niveau |
| Body Base | 16 / 22.4 | 400 | texte courant, **étiquette de bouton** |
| Body Strong | 16 / 22.4 | 600 | valeur mise en avant, nom de client |
| Input | 16 / 16 | 400 | champ de saisie (16 px : pas de zoom iOS) |
| Body Small | 14 / 19.6 | 400 | métadonnées, lignes secondaires |
| Body Small Strong | 14 / 19.6 | 600 | étiquette de tag, libellé d'onglet |
| Body Code | 16 / 20.8 mono | 400 | références (B/L, conteneur) — en DM Sans `tabular-nums` |

Il n'y a **pas** de 11 px, **pas** de 12 px, **pas** de 13 px dans le kit. Les
micro-textes de l'app actuelle (`text-[9px]` sous les KPI, `text-[11px]` sur
les pastilles) sont une dérive et disparaissent.

## 3. Taille, rayon, espace, effets

- **Rayon** : `100 = 4` · `200 = 8` · `400 = 16` · `full = 9999`. Les boutons,
  tags, cartes, champs sont tous à **8**. Seuls l'Icon Button et l'avatar sont
  ronds. Les `rounded-[22px]`, `rounded-2xl`, `rounded-full` sur les boutons de
  l'app actuelle sont hors kit.
- **Espace** : 4 · 8 · 12 · 16 · 24 · 32 · 64 (grille 4). Padding des
  composants : 8 (small) / 12 (medium) / 16 (carte compacte) / 24 (carte).
- **Bordure** : 1 px, `Border/Base/Default #D9D9D9`. Chaque contrôle porte sa
  bordure — même le bouton primaire (`stroke #2C2C2C`).
- **Effets** : le kit déclare des ombres (`0 1px 4px #0C0C0D@5 % + @10 %`,
  jusqu'à `0 16px 32px @40 %`). **Non adoptées** — les ombres sont bannies
  app-wide (décision du 19/08). La séparation vient de la bordure 1 px.

## 4. Composants relevés

### Button (`Variant` × `State` × `Size`)
| | Medium | Small |
|---|---|---|
| hauteur | **40** | **32** |
| padding | 12 | 8 |
| écart icône/texte | 8 | 8 |
| rayon | 8 | 8 |

| Variant | Default | Hover | Disabled |
|---|---|---|---|
| Primary | fond `#2C2C2C`, bord `#2C2C2C`, texte `#F5F5F5` | fond `#1E1E1E` | fond `#D9D9D9`, bord `#B3B3B3`, texte `#B3B3B3` |
| Neutral | fond `#E3E3E3`, bord `#767676`, texte `#303030` | fond `#CDCDCD` | idem |
| Subtle | transparent, sans bord | bord `#D9D9D9` | idem |
| Danger Primary | fond `#EC221F`, bord `#C00F0C`, texte blanc | fond `#C00F0C`, bord `#900B09` | idem |
| Danger Subtle | transparent | fond `#FDD3D0`, bord `#900B09` | idem |

Étiquette : Body Base 16/400 (Small : idem — le kit ne réduit pas la police).
Icônes 20 px (medium) / 16 px (small).

### Icon Button
Rond (`r=32`). Medium **44×44**, padding 12 ; Small **36×36**, padding 8.
Primary `#2C2C2C` ; Neutral fond `#F5F5F5` bord `#D9D9D9` (hover `#E6E6E6`) ;
Subtle transparent (hover `#F5F5F5`).

### Button Group
Écart **16** entre boutons ; alignements Start / End / Center / Justify /
Stack (vertical, 16 aussi).

### Tag (`Scheme` × `Variant`)
Hauteur **32**, padding 8, rayon 8, écart 8, étiquette Body Small Strong 14/600.
| Scheme | Primary (fond / texte) | Secondary (fond / texte) |
|---|---|---|
| Brand | `#2C2C2C` / `#F5F5F5` | `#F5F5F5` / `#1E1E1E` |
| Neutral | `#D9D9D9` / `#303030` | `#F5F5F5` / `#303030` |
| Positive | `#14AE5C` / `#EBFFEE` | `#CFF7D3` / `#02542D` |
| Warning | `#E8B931` / `#401B01` | `#FFF1C2` / `#682D03` |
| Danger | `#EC221F` / `#FEE9E7` | `#FDD3D0` / `#900B09` |

**Tag Toggle** (filtre) : h 32, r 8 ; Off fond `#F5F5F5`, On fond `#2C2C2C`.
Groupe : écart 8. → C'est le composant des filtres de liste sur mobile, à la
place des pilules rondes.

### Card
Rayon **8**, fond `#FFFFFF`, bord 1 px `#D9D9D9`, padding **24**, écart interne
24 (variante *Stroke*) ; la variante *Default* n'a ni fond ni bord (contenu
posé sur le canvas). Sur un écran de 390 px, le padding 24 est celui des cartes
« objet » (dossier, récapitulatif) ; les cartes de liste prennent **16**
(padding du Product Info Card, lui aussi relevé à 16).
Stats Card : icône 40 px, corps en colonne écart 4, padding 24.

## 5. Composants dérivés (pages non lues — à confirmer quand l'API rouvre)

- **Input Field** : h 40 (comme Button Medium), r 8, bord `#D9D9D9`, padding
  12, texte Input 16/400, placeholder `#B3B3B3`, focus bord `#2C2C2C` 2 px ;
  label Body Small Strong au-dessus, écart 8 ; erreur : bord `#EC221F`, message
  Body Small `#900B09`.
- **Tabs** : rangée de Body Small Strong, indicateur 2 px `#2C2C2C` sous
  l'onglet actif, texte inactif `#757575`.
- **Navigation Pill** (barre du bas) : h 32-40, r 8, fond On `#F5F5F5` /
  texte `#1E1E1E`, Off transparent / `#757575`.
- **Dialog / Sheet** : fond blanc, r 16 (`Radius/400`), padding 24, bord
  `#D9D9D9`, overlay `#000000@50 %`.
- **Notification** : carte r 8, bord du schéma (`Border/<schéma>/Default`),
  fond `Background/<schéma>/Tertiary`.
- **Avatar** : rond, 40 / 32 / 24 ; fond `#F5F5F5`, initiales Body Small Strong.

## 6. Ce que ça condamne dans l'app mobile actuelle

| Aujourd'hui (`src/mobile/designKit`) | Kit Figma |
|---|---|
| canvas lilas `#ECEAF7` | canvas `#F5F5F5` (Background/Base/Secondary), cartes blanches |
| holders lilas `#EDEAFA`, accent `#6B5BD2` | holders `#F5F5F5` + bord, aucun accent violet |
| `rounded-full` sur tous les boutons, `py-[13px]` (h ≈ 50) | r 8, h 40 / 32 |
| `rounded-[22px]` sur les cartes | r 8, bord 1 px |
| pastilles `text-[11px]`, KPI `text-[9px]` | Tag 14/600, rien sous 14 |
| verts/violets de module (`#10B981`, `#8B5CF6`) sur les FAB | un seul primaire : `#2C2C2C` |
| barre « liquid glass » (blur, bruit, dégradé, ombre) | barre plate, bord haut 1 px, pilule `#F5F5F5` |
| tons `#DEEFE5/#2E7D52` etc. | Tag Secondary : `#CFF7D3/#02542D`, `#FFF1C2/#682D03`, `#FDD3D0/#900B09` |

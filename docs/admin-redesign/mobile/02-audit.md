# Admin mobile — 02 · Audit UX (13/09/2026)

Méthode : les 21 écrans `/m/…` rendus **tels quels** (vrai routeur, vrais
composants) à 390 × 844 (iPhone 14, ×2) avec Supabase répondu par les fixtures
partagées ; captures + mesures DOM par `tools/audit-mobile.mjs`. Les mesures
sont dans `report.json` ; les captures dans le scratchpad de la session.

## 1. Le constat qui explique tout : deux langages visuels dans la même app

| Écrans | Langage | Canvas | Cartes | Boutons |
|---|---|---|---|---|
| Accueil, Dépôts, Paiements, Clients, Mola, Plus, Taux, Analytics, détails | **Ofspace/Mola** (lilas) | `#ECEAF7` | `rounded-[22px]`, holders lilas `#EDEAFA` | pilules rondes h≈50, FAB vert `#10B981` / violet `#8B5CF6` |
| Cargo (flotte, carte, dossier, suivre) | **`.admin-theme` desktop** (neutre) | `#FAFAFA` | `rounded-[14px]`, filet | pilules h 32, violet `#8B5CF6` sur « Rechercher » |

On passe de l'un à l'autre en un tap (Plus → Bonzini Cargo). C'est le
« aucune uniformité » : la moitié de l'app mobile parle une langue que ni le
desktop ni le Figma ne parlent. Le kit Figma (`01-figma-kit.md`) tranche :
canvas blanc, cartes blanches à filet `#D9D9D9`, rayon 8 partout, un seul
primaire `#2C2C2C`, aucune couleur de module sur les contrôles.

## 2. Dérive kit, mesurée écran par écran

| Écran | textes < 14 px | < 12 px | boutons ronds | cibles < 40 px | ombres | 1er contenu (px) |
|---|---|---|---|---|---|---|
| `/m` Accueil | 48 / 76 | 29 | 1 | 1 | 11 | 130 |
| `/m/deposits` | 51 / 76 | 32 | 14 / 18 | 5 | 14 | 84 |
| `/m/payments` | 47 / 67 | 31 | 17 / 21 | 5 | 15 | 84 |
| `/m/clients` | 49 / 71 | 22 | 15 / 15 | 6 | 11 | 157 |
| `/m/more` | 30 / 48 | 9 | 2 | 2 | 9 | 93 |
| `/m/more/rates` | 77 / 108 | 41 | 20 / 37 | 18 | 16 | 73 |
| `/m/dashboard` | 172 / 198 | 132 | 1 | 25 | 16 | 164 |
| `/m/cargo` | 33 / 40 | 17 | 4 / 4 | 1 | 7 | 85 |
| `/m/cargo/map` | 23 / 27 | 7 | 2 | 18 | 13 | 433 |
| `/m/cargo/2` | 76 / 88 | 34 | 2 | 20 | 17 | 69 |
| `/m/cargo/2/chargement` | 45 / 71 | 13 | 2 | 21 | 14 | 69 |
| `/m/cargo/track` | 20 / 23 | 12 | 2 | 4 | 4 | 70 |

Lecture : **entre 65 % et 87 % des textes sont sous 14 px** alors que le kit
n'a rien sous 14. Les `text-[9px]` sous les KPI et les `text-[10px]` des dates
sont illisibles debout. Les « ombres » sont surtout les rings de séparation
(acceptables) mais la barre du bas en porte trois vraies. Aucun écran ne
déborde horizontalement (bon point) ; en revanche 9 écrans ont des **cibles
tactiles sous 40 px** (le kit fixe 44 / 36).

## 3. Navigation

- **Six entrées + « Plus »** dans la barre du bas, dont un « Accueil » qui
  redit les compteurs déjà portés par les badges Dépôts / Paiements. Cargo — le
  module le plus utilisé — est **cinquième dans « Outils »** de l'écran Plus.
- La barre est en « liquid glass » : blur 24 px, bruit, dégradé, trois
  ombres. Hors kit (le kit est plat, bordure 1 px).
- Dépôts et Paiements sont deux écrans jumeaux (même en-tête, mêmes KPI, même
  recherche, mêmes chips, même carte de ligne) qui occupent deux onglets.
- Mola est un écran **sans barre du bas** (`showTabBar={false}`) : impossible
  d'en sortir autrement que par Retour.
- Le libellé Cargo « Bonzini Cargo » diffère du nom des autres modules (un mot).

## 4. Ce qui se chevauche ou se coupe (par écran)

- **Accueil** — le titre « Bonjour 👋 Bienvenue chez Bonzini » est tronqué
  (« Bienve… ») ; « 18,2 M XAF » casse sur deux lignes dans une tuile de
  105 px ; la rangée d'actions rapides passe sous la barre du bas.
- **Dépôts / Paiements** — trois tuiles KPI à étiquette 9 px ; noms tronqués
  (« Clariss… », « BZ-DP-2026-0… ») parce que le montant 24 px prend la place ;
  chips qui débordent hors écran à droite sans indice de défilement. Paiements
  a **deux boutons « Exporter »** (en-tête + pleine largeur) et trois actions
  d'en-tête : la liste ne commence qu'à 780 px, sous le pli.
- **Clients** — FAB noir posé **sur le montant** de la dernière carte visible
  (« 820 0… »). Chips de tri et de statut mélangées sur une même rangée qui
  défile.
- **Détail dépôt** — quatre actions par preuve (« Agrandir · Télécharger ·
  Remplacer · Supprime[r] ») : la dernière est coupée. Bouton « Relevé » vert
  de module.
- **Détail paiement** — trois actions d'en-tête + « Reçu » violet ; zone de
  dépôt « Ctrl+V pour coller » — instruction clavier sur un téléphone.
- **Taux** — 108 textes dont 77 sous 14 px ; cinq couleurs de marque + orange
  + violet sur le même écran ; segmenté violet plein.
- **Analytics** — 198 textes, 132 sous 12 px : c'est un tableau de bord
  desktop rétréci. Sous-titre sur six lignes à côté du sélecteur de période.
- **Cargo · flotte** — bouton « Suivre un conteneur » flottant **par-dessus
  la liste** ; aucune colonne « À faire » (elle existe sur desktop) ; l'en-tête
  a un Retour vers « Plus » alors que ce devrait être un onglet.
- **Cargo · carte** — carte de 420 px **dans une carte**, sous un en-tête ;
  le premier contenu utile (liste des navires) est à 433 px ; 18 cibles sous
  40 px (points radio de 18 px). La légende est bien là.
- **Cargo · dossier** — `MobileCargoDossier` = 31 lignes qui enveloppent le
  composant desktop : titre 20 px + références + arrivée + actions =
  **220 px d'en-tête** avant les onglets ; 4 onglets visibles sur 8
  (« Aperçu · Suivi · Chargement · Documents · D… ») ; jalons du parcours qui
  se **chevauchent** (« Singapou|Abidjan ») ; « Sur la carte » vide 220 px ;
  page de 4 300 px de haut.
- **Cargo · chargement** — la scène 3D est mise à l'échelle sur **660 px
  codés en dur** (`Container3D.tsx:140`) dans 390 px : le conteneur sort du
  cadre des deux côtés ; le tableau des lots à 6 colonnes est **coupé**
  (« Carto », « Caisse ») ; jauges et alerte d'écart sous la 3D, trois
  écrans plus bas.
- **Cargo · suivre** — `MobileCargoTrack` rend `<DesktopCargoTrack />` tel
  quel : fil d'Ariane « ← Ma flotte » **et** flèche Retour ; champ tronqué
  (« 274428633 · MIEU ») ; bouton « Rechercher » violet ; la grille à deux
  colonnes du desktop s'empile.
- **Mola** — placeholder du composeur sur deux lignes, coupé
  (« Écris, dicte ou joins un fichier ») ; le lion 96 px + le texte
  d'accueil poussent les suggestions à 800 px.

## 5. Ce qui n'est PAS un défaut

- Le rond « île » en bas à gauche sur toutes les captures est le bouton des
  **React Query Devtools** (`.tsqd-open-btn`) — dev uniquement, absent en
  production.
- Les libellés en anglais vus sur de précédentes captures venaient du
  détecteur de langue du navigateur headless (`en-US`) : les trois locales
  sont complètes.
- **DM Sans est bien la police rendue** partout (`fam: DM Sans` sur les 21
  écrans). Le kit est dessiné en Inter ; on garde DM Sans.

## 6. Ce que l'audit impose au plan

1. **Une seule langue** — réécrire les fondations (`src/mobile/designKit`)
   aux valeurs Figma et laisser les 73 écrans basculer d'un coup ; puis
   nettoyer à la main les couleurs de module et les tailles codées en dur.
2. **Une barre plate à cinq entrées** — Mola · Cargo · Opérations
   (Dépôts + Paiements) · Clients · Plus. Accueil disparaît.
3. **Le mobile décide quoi montrer** — Cargo obtient de vrais écrans mobiles
   (plus d'enveloppes du desktop) ; la carte est plein écran ; le dossier a
   un en-tête de 120 px et huit sections atteignables.
4. **Rien sous 14 px, rien sous 40 px de cible, rayon 8 partout, aucune
   ombre.**

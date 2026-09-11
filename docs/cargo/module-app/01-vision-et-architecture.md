# Bonzini Cargo — vision, périmètre et architecture du module

> Statut : contrat de conception du module admin « Cargo ». Toute évolution du
> module se lit d'abord ici. Les règles visuelles viennent, sans exception, de
> `docs/admin-redesign/02-foundation.md` (archétype workbench / panneau /
> création, jetons `.admin-theme`, kit `src/desktop/designKit`).

## 1. Pourquoi Bonzini Cargo existe

Bonzini Labs fait déjà **l'argent** du commerce Chine → Cameroun : l'importateur
paie son fournisseur chinois en XAF depuis la plateforme. Une fois payée, la
marchandise entre dans un tunnel de 40 à 60 jours où l'importateur ne voit
rien : il dépend de captures d'écran du transitaire, de dates promises qui
glissent, et découvre à l'arrivée qu'un télex manque ou qu'un fret n'est pas
réglé.

**Bonzini Cargo, c'est la même promesse appliquée à la marchandise : savoir, à
tout moment, où est chaque conteneur, quand il arrive, et ce qu'il reste à
faire pour le récupérer.** L'argent et la marchandise finissent dans le même
outil : un client Bonzini paie son fournisseur, puis suit sa boîte jusqu'à
Kribi ou Douala.

Ce que le module n'est pas : un logiciel de transitaire (pas de cotation, pas
de booking, pas de douane automatisée). Il **observe et organise** ; il ne
remplace pas le transitaire, il permet de le contrôler.

## 2. Pour qui, pour quoi

| Personne | Ce qu'elle veut, en une phrase |
|---|---|
| **Le fondateur / l'ops** (aujourd'hui) | « Où sont mes cinq boîtes, laquelle arrive en premier, qu'est-ce qui n'est pas payé ? » |
| **Le chargé de clientèle** | Répondre en 10 secondes à un client qui appelle : « votre conteneur est en mer, arrivée le 18 octobre ». |
| **Le client importateur** (phase 2, app client) | Voir son conteneur sur une carte sans appeler personne. |
| **Mola** (assistant) | Répondre à « où en est le conteneur de GAUSS ? » avec les mêmes données. |

Les trois questions auxquelles chaque écran doit répondre, dans cet ordre :
**Où ? Quand ? Que faire ?**

## 3. Sous-modules (brainstorm arbitré)

Retenus pour la v1 (ce dépôt) :

1. **Ma flotte** — la liste des conteneurs que Bonzini suit. C'est l'écran
   d'entrée : une table, une ligne par conteneur, l'arrivée comme colonne
   pivot. Sélectionner une ligne ouvre le dossier en panneau.
2. **Dossier conteneur** — tout ce qu'on sait sur une boîte : où elle est
   (carte + dernière position), le calendrier (promis vs armateur), les faits
   (armateur, B/L, navire, voyage, ports, type), le suivi jalon par jalon en
   français, les documents (B/L, facture, télex, BESC…), le fret et le télex
   à cocher, une note interne. Même contenu en panneau (42 %) sur desktop et en page
   entière sur mobile (`/m/cargo/:id`, lien profond).
3. **Suivre une référence** — saisir un numéro de bill of lading, de booking
   ou de conteneur ; la plateforme détecte l'armateur, interroge son API et
   affiche le résultat **sans rien enregistrer**. De là, deux issues :
   consulter seulement, ou **« Ajouter à ma flotte »** (on donne alors le
   client, le fret, la date promise). C'est l'unique porte d'entrée d'un
   conteneur dans la flotte.
4. **Carte** — tous les navires porteurs de conteneurs suivis, la tournée en
   pointillé, une pastille par navire. Vue de synthèse, pas de détail.

Reportés, dans l'ordre où ils deviendront utiles :

5. **Alertes** — arrivée sous 7 jours sans télex, ETA qui recule de plus de
   3 jours, conteneur sans jalon depuis 10 jours, fret impayé à J-10.
   (Le radar Mola et le digest Telegram existent déjà : brancher, pas
   réinventer.)
6. **Coûts du dossier** — fret, surestaries, stockage, douane, transport
   final : la vraie facture d'un conteneur, comparée au devis.
7. **Douane & documents de conformité** — checklist Cameroun (BESC, DI,
   SGS/RVC, ANOR) avec état par pièce ; s'appuie sur le manuel cargo.
8. **Vue client** — le dossier en lecture seule dans l'app client, sans les
   notes internes ni les coûts Bonzini.
9. **Multi-armateurs via agrégateur** — Shipsgo/Vizion pour CMA CGM, MSC,
   COSCO ; même modèle de données, autre source.

Écartés : booking en ligne, cotations de fret (le comparateur reste un
outil interne), tout ce qui ferait de Bonzini un transitaire.

## 4. Architecture de l'information

```
Cargo                                   (sidebar → /m/cargo)
├── Ma flotte  ····· workbench           table + panneau dossier
│   └── Dossier  ··· /m/cargo/:id        panneau ouvert (desktop) · page (mobile)
├── Suivre  ········ /m/cargo/track      recherche → résultat → ajouter
└── Carte  ········· /m/cargo/map        navires + tournée
```

Une seule action principale par page (règle 1.5.5) :

| Page | Action principale (sombre) | Secondaires |
|---|---|---|
| Ma flotte | **Suivre un conteneur** | Carte |
| Dossier / panneau | — (pas de décision à prendre) | Rafraîchir · menu ⋯ (fret réglé, télex reçu, retirer) |
| Suivre | **Rechercher**, puis **Ajouter à ma flotte** | Consulter seulement |
| Carte | — | Retour à la flotte |

## 5. Anatomie des écrans (archétype 02-foundation)

### 5.1 Ma flotte — workbench

- **En-tête** : « Cargo » · « 5 conteneurs en cours · 1 arrive cette semaine ».
  CTA sombre « Suivre un conteneur ». Pastille douce « Carte ».
- **Bandeau de files** (une ligne, chips avec compteurs) : En route · Arrivent
  sous 7 j · À régler · Sans suivi · Tous. Ce sont des filtres, pas des tuiles.
- **Barre de filtres** (32 px) : recherche (client, conteneur, B/L, navire),
  Armateur ▾, Destination ▾.
- **Table** (lignes 40 px, tri par arrivée croissante par défaut) :
  Client · Conteneur · Navire · Arrivée · Statut · Fret. La colonne Arrivée
  porte la date armateur en gras et, dessous, « promis d MMM » teinté ambre
  quand elle a glissé. Fret : montant à droite, dessous « à régler · télex
  non » en meta.
- **Sélection** → panneau 42 % (min 560 px), la table reste vivante.

### 5.2 Dossier conteneur — panneau et page

1. **En-tête épinglé** : `MIEU3611115` (RefChip) · pastille statut ·
   « Conteneur de GAUSS » · actions à droite.
2. **Zone de verdict** (ce qu'on regarde en premier) : carte 240 px du navire
   avec sa position ; à côté, la phrase d'état (« En mer — Atlantique Sud,
   position du 10 sept. ») et **l'arrivée** en figure focale (« Kribi ·
   11 oct. », + « 14 j après la date promise » en ambre).
3. **Faits** : grille 3 colonnes label/valeur — Armateur, B/L, Navire,
   Voyage, Départ réel, Départ promis, Arrivée promise, Type de boîte, Fret,
   Télex.
4. **Suivi** : jalons dans l'ordre, libellés français, réel = coché, prévu =
   creux, le dernier réel = point courant.
5. **Documents** : liste (type, nom, date) + ajout. B/L, facture, packing
   list, télex, BESC, autre.
6. **Note interne**.

### 5.3 Suivre une référence — page de création

- Colonne principale (~640 px) : section « Référence » — un champ mono, aide
  « B/L Maersk : 9 chiffres · conteneur : 4 lettres + 7 chiffres », chip de
  l'armateur détecté, bouton Rechercher. Puis le **résultat** dans une carte
  à bandeau (« Résultat Maersk · il y a 3 s ») : par conteneur trouvé, statut,
  navire, arrivée, jalons ; pied : « Ajouter à ma flotte » (sombre) ou
  « Consulter seulement ». Ajouter ouvre un dialogue centré : client, fret
  (USD), date promise.
- Rail droit (360 px, collant) : armateurs pris en charge et leur état
  (Maersk ✓, CMA CGM en attente d'accès API, MSC/COSCO via agrégateur),
  et les dernières recherches.

### 5.4 Carte

Carte pleine largeur dans une carte à bandeau (« 3 navires · 5 conteneurs »),
légende en pied, chips navire sous la carte pour filtrer la flotte.

## 6. Modèle de données

- `cargo_shipments` — le dossier (client, armateur, B/L, boîte, ports, dates
  promises / armateur, navire, fret, paiement, télex, statut dérivé).
- `cargo_events` — les jalons de l'armateur (DCSA), stockés bruts + codés.
- `cargo_vessel_positions` — dernière position par navire (AIS).
- `cargo_lookups` — une recherche de référence (statut, résultat normalisé) ;
  c'est d'elle que naît un dossier via `add_cargo_shipment`.
- `cargo_documents` + bucket privé `cargo-documents`.

Flux : `request_cargo_lookup(ref)` → pg_net → edge `cargo-lookup` → résultat
dans `cargo_lookups` (le front sonde la ligne) → `add_cargo_shipment` →
`cargo-sync` (cron horaire) entretient jalons, ETA, positions.

## 7. Vocabulaire à l'écran (jamais de codes)

| Interne | À l'écran |
|---|---|
| BOOKED / AT_ORIGIN / AT_SEA / ARRIVED / DELIVERED / UNKNOWN | Réservé · Au départ · En mer · Arrivé · Livré · Sans suivi |
| ETA armateur / ETA transitaire | Arrivée · Date promise |
| DEPA ACT / ARRI EST | Navire parti · Arrivée prévue |
| GTIN LADEN | Boîte pleine rendue au terminal |
| Telex release | Télex reçu / non reçu |

## 8. Ce qui n'est pas négociable

- Un seul ton : neutre (`.admin-theme`). Les couleurs ne portent que le sens
  (succès, attente, danger, info). Aucune couleur de logo sur les surfaces.
- Pas de tuiles de chiffres en tête de page : les compteurs vivent dans les
  chips de file.
- Pas de carte plein écran sur l'écran d'entrée : la carte est une vue, le
  dossier est l'objet.
- Tout texte visible est une phrase française qu'un importateur comprend.

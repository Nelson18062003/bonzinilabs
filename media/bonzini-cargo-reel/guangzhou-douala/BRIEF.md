# De Guangzhou à Douala — brief de création (12 octobre 2026)

> Mis à jour : en plus des 3 rushs de Guangzhou (v1–v3), le patron a envoyé **41 clips de l'ARRIVÉE à Douala** (v4–v44, section « Les rushs de Douala » plus bas). La matière raconte maintenant le voyage entier : **chargé à Guangzhou → reçu à Douala.**

## La demande du patron (mot pour mot)
« Pour la vidéo, pour la création de contenu, je t'ai décidé de créer le contenu. Analyse bien les vidéos et comprends
bien le fond du message. Maintenant, crée les contenus, mais modifie les montages. Il peut y avoir des effets
extraordinaires, donc vas-y. »
→ On crée DES contenus (plusieurs vidéos) en remontant entièrement ces rushs, avec des effets forts. Le fond du message
doit rester celui des rushs.

## Les rushs (dossier `rush2/`)
Tous en vertical 464 × 832, ~30 i/s, vidéos WhatsApp du 11/10/2026 (basse définition, tenues à la main, déjà « montées »
une première fois par l'équipe : **des autocollants sont incrustés dans l'image**, voir plus bas).
Planches 1 image/s : `rush2/work/sheet_v1_0.jpg`, `sheet_v1_1.jpg`, `sheet_v2_0.jpg`, `sheet_v3_0.jpg`, `sheet_v3_1.jpg` ;
panneau zoomé : `rush2/work/v3_banner.jpg` ; autocollants zoomés : `rush2/work/v1_overlays.jpg` ; zones fixes
détectées : `rush2/work/static_masks.jpg`, `static_boxes.json`.

### v1 — `src/v1.mp4`, 92,1 s : l'entrepôt et le chargement du conteneur (6 plans, coupes à 9,07 · 15,54 · 40,60 · 64,54 · 78,21)
- 0–9,1 : dans un grand entrepôt, un chariot élévateur rouge (conducteur torse nu), un homme en t-shirt blanc qui guide.
- 9,1–15,5 : gros plans de colis : ballots verts sanglés de scotch orange avec un nom écrit au feutre, gros sacs jaunes
  avec des noms (« ...Pascal T. » sur un carton), un sac de voyage.
- 15,5–40,6 : on marche dans l'entrepôt : des dizaines de rouleaux emballés en kraft, des caisses en bois (« Printer
  YH-1900F / I3200 »), des palettes de cartons.
- 40,6–64,5 : DANS le conteneur : deux ouvriers chargent des cartons et des caisses blanches, chaleur, effort.
- 64,5–78,2 : le chariot élévateur sur la rampe de chargement, des barres métalliques.
- 78,2–92,1 : la cour : un conteneur rouge sur un camion porte-conteneur, des palettes, un gros ballot vert scotché
  orange avec un nom au feutre.

### v2 — `src/v2.mp4`, 23,9 s, un seul plan continu : la voiture qui part en conteneur
- 0–8 : une voiture SUV neuve grise (marque chinoise, logo sur la calandre : NE PAS mettre la marque en avant) dans la
  cour, on tourne autour.
- 8–12 : la rampe de chargement d'un conteneur, des ouvriers.
- 12–17 : l'arrière de la voiture (plaque provisoire), 17–24 : une bâche verte, un camion porte-conteneur rouge, la cour.

### v3 — `src/v3.mp4`, 63,5 s, un seul plan continu : la visite de Bonzini à Guangzhou
- 0–8 : **le grand panneau « Bonzini Trading Cargo »** avec les drapeaux de la Chine et du Cameroun ; services écrits :
  Used Car Sales · Car Rental Service · Central Purchasing Agency · Sea & Air Cargo · Packing & Loading Container ·
  Foreign Exchange & Transaction Service ; numéros +86 ; adresse « … Guangzhou City, Guangdong ».
- 8–18 : l'entrée, la rue (tours, chantiers, feux), le trottoir.
- 18–38 : le parc : des voitures d'occasion (SUV, berlines) « prêtes à être chargées ».
- 38–48 : l'entrée vitrée (enseigne lumineuse « …Trading »), l'intérieur : salon, une employée au bureau.
- 48–55 : le couloir, un écran de vidéosurveillance (16 caméras).
- 55–63,5 : la porte vitrée, retour dehors, une voiture devant les tours.

## Ce qui est dit (vraie voix, français, homme enthousiaste — le patron ou un responsable en Chine)
Transcription `rush2/work/transcripts.json` (mots horodatés). Voix isolée par demucs : `rush2/work/v{1,2,3}_vocals.wav`
(la voix domine : −20 dB ; le reste = bruit du lieu, pas de musique) ; fond seul : `v{n}_accomp.wav`.
- **v1** : « Aimable clientèle de Bonzini Trading Cargo, nous vous annonçons comme ça le chargement du **premier
  conteneur** cet après-midi (0–8 s). Nous disons comme ça **merci déjà aux clients qui nous ont fait confiance** pour ce
  chargement (8,5–15). Et nous vous promettons votre satisfaction en temps réel (15–19,7). Ne doutez pas, Bonzini
  Trading, le number one à Guangzhou (20,6–27,5). Nous sommes situés en plein cœur de Guangzhou… (28–35) nous sommes en
  train de charger le premier conteneur… en temps réel cet après-midi (35–47) … nos bureaux sont situés… (47–56, peu
  sûr) … faites confiance à Bonzini Cargo Trading… la publicité se fait elle-même… Bonzini Trading the best (56–74) …
  nous présentons notre warehouse, en plein cœur de Guangzhou (74–83) … le conteneur est en train de charger (84,5–86,4)
  … **c'est fort, c'est fort** (86,4–91). »
- **v2** : « Aimable clientèle de Bonzini Trading Cargo, voilà, **ce véhicule doit être chargé dans le conteneur**
  (0–7). Nous disons comme ça **merci au PDG depuis Bonamoussadi pour la confiance** (7,5–13,5). Voilà, **directement
  déposé, directement reçu** (14,4–18,3). Voilà, **c'est fort**, Bonzini Trading, **faites-nous confiance** (19–22,2). »
- **v3** : « Aimable clientèle, Bonzini Trading Cargo, nous vous présentons comme ça **l'entrée de notre warehouse**
  (0–7,2), située en plein cœur de Guangzhou (8,2–12,3). Voilà la position de notre warehouse (13,5–17,2). Voilà **les
  voitures que nous allons charger dans le conteneur** (18,5–23,4), les voitures prêtes à être chargées (23,8–26,6).
  Voilà, **si vous avez besoin d'acheter des véhicules en Chine** ou [pour le] Cameroun, n'hésitez pas, nous sommes là
  (26,6–37,4). Nous vous présentons le bureau, **notre bureau en plein cœur de Guangzhou**, nos locaux (37,4–48,8).
  Bonzini Trading, **la sécurité, la qualité des services, faites-nous confiance, c'est fort** (48,8–61). »
- Mots repères horodatés : v1 « annonçons » 3,70 · « premier » 5,82 / 38,82 · « merci » 9,74 · « fort » 88,18 / 90,78 ;
  v2 « véhicule » 4,94 · « conteneur » 6,54 · « merci » 8,60 · « PDG » 9,86 · « Bonamoussadi » 11,46 · « directement »
  14,90 / 16,72 · « fort » 19,62 ; v3 « entrée » 5,58 · « warehouse » 6,26 · « voitures » 19,12 / 24,56 · « acheter »
  32,02 · « bureau » 41,70 · « sécurité » 52,28 · « qualité » 54,66 · « confiance » 56,94 · « fort » 58,52.

## Les rushs de Douala (v4–v44, 29/09/2026, ~6 min 20 au total)
Vidéos WhatsApp 720 × 1280 (ou 576 × 1024) verticales — sauf **v8, v9, v10 en paysage 1280 × 720** —, plus nettes que celles
de Guangzhou, **sans autocollants**. **Aucune voix** (seulement le bruit du lieu : foule, rue, moteur de grue). Journal plan par
plan complet (plans, meilleurs instants avec cadrage, personnes, textes/marques lisibles, rôle dans l'histoire) :
**`rush2/work/douala_log.json`** ; planches 2 images/s : `rush2/work/sheet_v{4..44}.jpg` (temps en jaune sur chaque vignette).
Lieu : rue de quartier camerounaise (maillots des Lions, tissu ndop, parasols, motos-taxis), cohérent avec Douala, destination
de tous les envois Bonzini (à faire confirmer par le patron ; aucune enseigne ne nomme la ville).

Les temps forts (le journal en a beaucoup d'autres) :
- **Le conteneur arrive et s'ouvre dans la rue** : v41 (plan large, foule, écoliers), v14 (un homme lève les deux bras devant
  le conteneur plein), v21/v22/v24 (conteneur ouvert, manutentionnaires debout dedans, foule qui attend), v10/v11 (dépanneuse
  à plateau puis panoramique vers le conteneur), v42/v43 (spectateur en ndop qui sourit, ouvriers qui entrent).
- **Une voiture SORT du conteneur** : **v7 (28 s)** — un SUV blanc sort lentement du conteneur sur le plateau, un homme en
  beige le guide, la foule filme au téléphone (0,3 · 9,8 · 17 « téléphone qui filme le SUV » · 26,5) ; v8 (paysage) le SUV
  posé sur le plateau devant le conteneur ouvert ; v44 une voiture blanche au fond du conteneur (4,7).
- **Voitures sur dépanneuse dans la rue** : v4 (Yaris blanche sur le plateau, jeune homme qui sourit), v5 (Yaris sur la
  rampe + porteur au ballot noir sur la tête à 5,0), v6 (Yaris pleine de sacs contre le conteneur ouvert).
- **Déchargement à la main, colis sur la tête** : v12 (cartons passés de main en main, 3,0 ; sourire et geste à 9,0 ; colis
  sur la tête 7,6), v15, v16, v17 (chaîne humaine, 10,5 « on pose les paquets sur la tête du porteur »), v18 (carton lancé
  à 2,1), v44.
- **La grue** : v23 (le grutier aux leviers), v25 (gros ballots blancs sanglés et accrochés, 13 · 16,5), v26 (le colis
  monte), v29 (machine accrochée, 11), **v31 (la machine en inox décolle, 6,5 ; plan large qui raconte tout, 12)**, v36 (une
  machine agricole verte tirée hors du conteneur), v37/v38 (elle vole au-dessus de la rue, la foule regarde, 1 · 9,5).
- **Livré devant la porte** : v27 (le colis posé sur le trottoir), **v39 (la machine verte arrive devant la boutique, 2,5 ·
  5)**, **v40 (deux hommes la font entrer dans l'entrepôt, 0,5 · 3 · 10)**, v28 (une machine en inox entre par la porte
  roulante d'un local, 3 · 21), v33 (on enlève la bâche devant la cliente qui filme, 0,5 · 1,5).
- **Un entrepôt, colis rangés** : v34, v35 (ballots verts étiquetés à la main au nom des clients avec « DOUALA-CMR », sacs
  jaunes, murs de paquets sous film, mezzanine ; aucune personne). Le LIEU n'est pas sûr (« DOUALA-CMR » est aussi ce qu'on
  écrit au départ en Chine) : ne pas l'appeler « l'entrepôt de Douala » ; légende neutre possible (« À votre nom. »).
- **La foule qui filme** : v5, v7 (17), v12 (6), v13 (par-dessus l'épaule d'une femme qui filme), v31 (15), v38 (1).
- À écarter : v20 (téléphone vers le sol), v45 (0,3 s).

### Ce que Douala change — et les pièges
- **Chronologie** : les clips de Douala datent du **29/09**, le chargement de Guangzhou du **11/10**. Ce ne sont **PAS** le même
  conteneur ni les mêmes voitures (un conteneur met plusieurs semaines). **Jamais** de raccord qui fait croire que c'est le
  même envoi (pas de « le voici arrivé », pas de morphing du SUV gris de v2 en SUV blanc de v7, pas de date ni de délai).
  On montre **le cycle** : « Là-bas, on charge. Ici, on reçoit. » — les raccords d'ACTION (chargé ↔ déchargé, voiture qui
  entre ↔ voiture qui sort, ballots étiquetés là-bas ↔ ballots étiquetés ici) sont permis s'ils ne nomment pas d'identité.
- **« Premier conteneur »** : puisqu'un conteneur est déjà arrivé à Douala le 29/09, « premier » ne veut pas dire « premier
  de l'histoire ». **Ne jamais en faire un titre ni un slogan** ; au plus, la vraie voix citée, sous-titrée telle quelle.
- **Marques tierces lisibles** : « MAERSK » et son étoile sur le flanc du conteneur (v10 5–7 s, v12, v18 0,35–1,2 s, v41
  tout le clip) → recadrer ou flouter, jamais mis en valeur ; parasols « Orange » ; maillots (Barça, Raptors, adidas…) :
  pas de gros plan dessus ; logos Toyota/Peugeot : jamais mis en avant.
- **À flouter** : les **noms et numéros de téléphone des clients** sur les ballots (v34 0–3,8 s, v35 12–13,6 s) ; les
  plaques (Peugeot grise v4 2–5 s, v27, v32 ; remorque v44 4–5 s) ; le t-shirt au mot vulgaire (v5, femme au premier plan
  à gauche) ; le nom « Stadelmayer » sur un maillot (v19, v21, v41) de préférence hors cadre.
- **Personnes** : foule dans la rue, ouvriers, clients. Pas de gros plan figé sur un visage de passant, pas d'enfant mis en
  avant (écoliers v4, v41), pas de jeune torse nu (v19 début, v22). Les sourires (v4 3,6 · v12 9,0 · v43 0,4) peuvent passer
  en mouvement, pas en arrêt sur image géant. Le consentement des personnes filmées est à faire confirmer par le patron.
- **Ne pas affirmer** que Bonzini livre à domicile ou loue la grue : on MONTRE ce qu'on voit (« la machine arrive devant la
  boutique »), on n'en fait pas une offre.

## LE FOND DU MESSAGE (à garder)
**Bonzini Trading Cargo est vraiment là, à Guangzhou** : un panneau, un entrepôt, un bureau, une équipe, des voitures, et
**ça charge en vrai** (le premier conteneur, une voiture du client de Bonamoussadi). L'équipe **remercie les clients
qui ont fait confiance** et demande : **« Faites-nous confiance. C'est fort ! »** — preuve + gratitude + fierté, en direct.
**Avec Douala, le fond devient complet : ce que l'équipe charge à Guangzhou, les clients le reçoivent à Douala —
« directement déposé, directement reçu » (la vraie voix de v2), la foule, les colis sur la tête, la voiture qui sort du
conteneur, la machine qui vole jusqu'à la boutique.** Preuve de bout en bout + gratitude + fierté.
Les tics de langage du patron (« Aimable clientèle », « comme ça », « voilà », « c'est fort ! ») sont une signature
authentique et sympathique : on peut les mettre en valeur, jamais s'en moquer.

## Ce qu'on peut affirmer / ce qu'on évite
- **Oui (vu ou dit par le patron dans ses propres rushs)** : l'adresse est à Guangzhou (panneau) ; il y a un entrepôt,
  un bureau, une équipe ; un conteneur est chargé « cet après-midi » (le premier, selon la voix) ; des voitures sont
  chargées en conteneur ; « directement déposé, directement reçu » (citation) ; merci aux clients, au « PDG de
  Bonamoussadi ». Services vérifiés de la plateforme : groupage maritime et aérien Chine → Douala ; colis pesés et
  mesurés à la réception en Chine ; entrepôt au Foyer Balengou (Douala).
- **Non, jamais dans NOTRE texte** : « le numéro un », « le meilleur », « le premier » au sens de supériorité, « zéro
  risque », « garanti », « gratuit », « moins cher », un prix, un délai. Les passages de la vraie voix « le number
  one à Guangzhou » et « the best » ne sont PAS utilisés (superlatifs invérifiables). « Foreign Exchange & Transaction
  Service » du panneau n'est jamais mis en avant ; jamais « transfert d'argent / envoyer de l'argent » ; vocabulaire
  « payer / régler ». Pas de marque automobile mise en avant. Pas de zoom sur les numéros de téléphone du panneau (on
  peut les laisser lisibles à l'échelle normale, ce sont ceux de l'entreprise). « Premier conteneur » : le dire en
  citant la vraie voix (son sens exact — premier de l'histoire de Bonzini ou premier de la saison — est à faire
  confirmer par le patron ; ne pas en faire un record).
- Personnes : ouvriers, employée, conducteurs = l'équipe et ses partenaires ; pas de moquerie, pas de gros plan figé sur
  un visage, pas de ralenti sur un corps torse nu.

## Le problème technique n°1 : les autocollants incrustés
L'ancien montage a collé des autocollants (une carte de visite Bonzini penchée avec logo/bateau/camion, un personnage,
un avion, un camion, un bateau, une pastille violette) DANS l'image. Ils sont fixes à l'écran (ou bougent peu) et ne
peuvent pas être enlevés proprement :
- **v1** : énormes — tout le haut (≈ x 24–440, y 60–265 en pixels source) et une colonne à gauche (≈ x 40–175,
  y 425–610) ;
- **v2** : en haut (≈ x 90–390, y 10–170) ;
- **v3** : au milieu (≈ x 45–195, y 510–615 et x 340–430, y 415–550).
(`static_boxes.json` = détection automatique, partielle : à préciser image par image.) → Chaque concept doit dire
comment il les cache : recadrage, cadres/bandeaux de notre habillage posés exactement dessus, plein écran graphique,
inpainting temporel seulement s'il est propre. Jamais d'autocollant de l'ancien montage visible dans le nouveau.

## Ce qu'on a pour fabriquer
- Le moteur Canvas de la série (rendu Chromium déterministe, partition unique image + son, images du rush posées
  image par image, zoom, gel, rampes de vitesse, filés, flou de mouvement, grain, lumière, typographie cinétique calée
  sur les mots de la vraie voix) — modèle tout frais : `rush1/prod/` (« TROUVE LE MOT. ») et `serie/ep2/`.
- ffmpeg (stabilisation vidstab possible pour les plans marchés), OpenCV (suivi, masques), demucs (voix isolée).
- Voix claire de la narratrice si besoin (Kyutai, réglages « diction claire »), test d'écoute automatique.
- Musique et bruitages synthétisés (makossa, balafon Bonzini), mix −14 LUFS.
- Agrandissement : Lanczos (Real-ESRGAN interdit sur les textes : il invente des lettres).

## Règles (non négociables)
1. **Compris au premier visionnage**, avec et sans le son (le patron a déjà rejeté une vidéo qu'il ne comprenait pas, et
   des voix trop rapides) ; ce qui est dit est écrit (sous-titres de la vraie voix, en français corrigé mais fidèle).
2. Rien d'inventé (voir plus haut). 3. Vocabulaire (voir plus haut). 4. Violet = Bonzini seulement.
5. Format 9:16 1080 × 1920, zones sûres (rien au-dessus de y 150, pas de texte à droite de x 960 entre y 900 et 1560,
   rien d'important sous y 1540). 6. Des **effets extraordinaires** sont demandés : ils doivent servir le message, pas le
   brouiller.

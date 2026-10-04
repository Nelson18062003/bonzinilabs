# « Le Bonneteau du Feyman » — boucle parfaite de 16 s (motion design)

Vidéo virale 100 % motion design, à la demande du patron : « un truc hyper créatif qui casse les codes, qui bouge les gens,
qui fait que les gens se bouclent ». Vertical 1080×1920, 30 i/s, **480 images = 8 mesures de bikutsi en 12/8**, sans voix
off. L'image 480 est l'image 0 : la vidéo se regarde en boucle sans couture.

## L'idée (dossier complet : `analysis/CONCEPT_FINAL.md`)
Un marché de nuit, une ampoule, une nappe wax. Deux gants blancs de dessin animé (le « feyman », sans visage) plaquent
« MA MARCHANDISE » contre la vitre du téléphone, la cachent sous un des trois mini-conteneurs et défient le spectateur :
« TU VAS PERDRE. » Mélange de plus en plus rapide, puis « Elle est sous lequel ? » — Vide. Vide. …Vide. Le colis est
parti **dans la manche** à 7,0 s, pendant que la bague brille de l'autre côté (8 images, visibles sur une capture).
Moment marque : la lumière devient violette, les bras du feyman fuient dans le noir, les conteneurs deviennent du verre :
« LE FEYMAN CACHE. / BONZINI TE MONTRE LA PREUVE. » avec « Paiement créé ✓ · Fournisseur réglé ✓ · Preuve de paiement ✓ ».
Puis « On rejoue ? Cette fois, ne regarde pas la bague. » — la main rentre dans sa manche… et en ressort avec le colis
à l'image 0. Mot-clé en commentaire : **MANCHE**.

Choisi par un concours de 10 concepts (5 angles : boucle, jeu, son, émotion, rupture) notés par 3 juges (rétention 40 %,
créativité/marque 35 %, faisabilité 25 %) : 1er avec 8,15/10. Brief : `analysis/BRIEF.md`.

### Écarts volontaires par rapport au dossier
- La pastille « Suivi jusqu'au Foyer Balengou » est **retirée** : dans l'app, le suivi cargo est un écran de l'équipe
  (`/m/cargo/track`, `AdminRouteWrapper`), pas un écran client. Les trois pastilles ne montrent que ce que l'app fait
  vraiment pour le client (`src/i18n/locales/fr/payments.json` : « Paiement créé », « Bénéficiaire payé », preuves de
  paiement ; « Bonzini règle ensuite votre fournisseur et vous envoie la preuve »).
- Signature : « BONZINI TE MONTRE LA PREUVE. » (au lieu de « … CHAQUE ÉTAPE »), vérifiable.
- Au moment marque, les bras du feyman fuient dans le noir quand la lumière violette s'allume.

## Fabrication
- `overlay/scenes/01_score.js` — **la partition** : une seule source pour l'image et le son (géométrie, 12 échanges,
  le vol, les soulèvements, les mains image par image, la lumière, la caméra, les textes, les repères sonores). Tout est
  périodique sur 480 images. `node tools/check_score.js` (sauts par image, couture), `node tools/dump_cues.js`
  (→ `data/score_cues.json`).
- `overlay/scenes/02_light.js` — une seule ampoule pour tous : `lightAt`, `lit` (couleur vue sous l'ampoule / dans la nuit /
  sous la lumière violette), ombres portées.
- Modules : `10_table.js` (nuit, nappe wax procédurale, flaque de lumière, poussière, grain, vitre), `20_props.js`
  (conteneurs 10 pieds vus côté portes, rouille, verre violet, colis, éclat de bague, poussière, chiffres 1·2·3),
  `30_hands.js` (gants années 30 paramétriques, 12 poses, manches wax vert/moutarde, retrait dans la manchette, bosse
  du colis), `40_gecko.js` (le margouillat témoin, pompes à 10 s), `50_compose.js` (ordre d'affichage, vol, moment
  marque), `60_type.js` (typo cinétique, tampon, liste des preuves, signature).
- Rendu : `cd overlay && node render.mjs 0 479 --out ../out/final --pages 3 --mb 8 --jpg` (≈ 90 s, flou de mouvement
  sur 8 sous-images).
- Son : `python3 lib/audio.py` → `audio/loop.wav` (48 kHz, exactement 16,000 s, replié par `lib/loopwrap.py`,
  −14 LUFS, crête vraie ≤ −1 dBTP) + `audio/loop_x3.wav`. Bikutsi 12/8 synthétisé (`lib/instruments.py`, `bikutsi.py`,
  `makossa.py`), coupure totale à 8,0 s, mi majeur au moment marque, 34 bruitages calés sur la partition (< 2 ms).
- Encodage : H.264 CRF 15 (master), CRF 19 (≤ 27,5 Mo), et une version 3 tours (48 s, 720p) pour WhatsApp / Facebook.
- Polices (`assets/fonts`, non versionnées, OFL) : Satoshi, Bricolage Grotesque, Big Shoulders Stencil, Martian Mono,
  Caveat Brush, DM Sans, Shantell Sans.

## Garde-fous
Vocabulaire « payer / régler / paiement » ; aucun prix, délai, taux ; aucune marque tierce, aucun logo de transporteur
ou de plateforme ; pas de douanier ; personne réelle ni visage (gants et margouillat) ; aucune donnée client.
Le feyman incarne « payer sans rien voir », jamais un fournisseur nommé. Pas d'argent sur la table (pas un jeu d'argent).
À faire valider par le patron : le ton (la marque « arnaque gentiment » le spectateur), le camfranglais (« mbom »,
« feyman »), le mot-clé MANCHE et la réponse automatique WhatsApp (`analysis/CONCEPT_FINAL.md` §7).

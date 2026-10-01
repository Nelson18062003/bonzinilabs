# DOUANE · Partie 2 — « La tontine de Christelle » — guide des animateurs (BD animée)

Le propriétaire a rejeté le papier découpé (« le graphisme est horrible ») et demandé un **dessin animé inspiré d'*Aya de Yopougon***
sur de jeunes commerçants africains. La partie 2 est donc une **BD animée** : de vraies illustrations, des personnages articulés
(marionnettes à squelette) qui respirent, parlent, gesticulent et marchent, des bulles de BD et le récitatif jaune de la narratrice.

Lire dans l'ordre : ce guide → `data/script.json` (voix, 32 segments) → `data/shots_final.md` (découpage P1…P28 + corrections
qui PRIMENT) → `../douane/p2/research_p2.md` §5-6 (chiffres permis, interdits) → `../douane/p2/art_bible.md`.

## Moteur (déjà écrit — ne pas modifier 08_puppet.js, 09_bd.js, 10_plan.js, 05_tag.js, 90_recit.js)
- **Plans** : chaque fichier `overlay/scenes/2x_*.js` enregistre ses plans dans `shots(() => { defineShot({...}); })`
  (le constructeur s'exécute quand la timeline de la voix est chargée). Un plan :
  ```js
  defineShot({ id: 'P4', t0: shotStart('S5'), img: 'bg/etal_meches', seed: 4,
    inT: .7, inKind: 'page',                                   // transition d'entrée : cut | fade | slide | up | page | iris
    cam: [{ t: shotStart('S5'), x: 500, y: 900, z: 1.1 }, { t: se('S5'), x: 460, y: 820, z: 1.3, e: 'io' }],
    stage(t, n, c, s) { /* dans le décor : coordonnées « scène » */ },
    screen(t, n, s) { /* par-dessus, en pixels écran 1080×1920 : bulles, documents */ } });
  ```
  Le plan dure jusqu'au `t0` du plan suivant. **Unités « scène »** : l'illustration fait 1000 de large (hauteur = 1000 × h/l,
  ≈ 1780 pour un décor 9:16). `cam` : le point de la scène au centre de l'écran, `z` = 1 → l'illustration couvre l'écran ;
  la caméra est bornée pour ne jamais sortir de l'image. Une légère respiration de caméra est automatique.
- **Temps** (toujours depuis la voix, jamais de secondes en dur) : `tw(seg, mot, off)` début d'un mot, `te(...)` fin,
  `ss(seg, off)` / `se(seg, off)` début/fin de segment, `shotStart(seg)` = 0,35 s avant la voix. Les segments sont S1…S32.
- **Personnages animés** : `drawPuppet('cast/christelle_2', x, y, h, opts)` — pieds en (x, y) scène, hauteur h (scène).
  `opts` : `t` (obligatoire), `phase` (décalage de la respiration, différent par perso), `talk: 0|1` (bouche + tête + gestes : mettre 1
  pendant SA bulle), `hop: t0` (petit saut), `lean` (rad), `flip` (miroir), `walk: { speed: 1.5 }` + `walkT0` (cycle de marche : utiliser
  les poses de marche _5 de profil), `grade: GRADE.night|late|office|shade` (lumière du lieu), `a` (opacité), `rot: { head: .1 }` (pose forcée).
  Déplacement : calculer x avec `lerp(x0, x1, eInOutCubic(prog(t, a, b)))`. Changer de pose = dessiner une autre image (fondu court :
  dessiner l'ancienne avec `a` décroissante 0,15 s).
  Poses disponibles (dossier `assets/img/cast/`, auto-articulées dans `11_rigs.js`) :
  - Junior : 1 debout sourire mains poches · 2 explique main ouverte · 3 rit · 4 inquiet lit son téléphone · 5 marche (profil).
  - Christelle : 1 fière mains sur les hanches · 2 parle index levé · 3 rit main sur la bouche · 4 choquée lit un long reçu · 5 marche.
  - Nadège 1-4, Boris 1-4, Mireille 1-4, Ekambi 1-4, Roi 1-4, lézard 1-2 : en cours de génération (voir `data/shots_final.md` pour le
    sens de chaque pose) ; si une image manque encore, `drawPuppet` dessine un rectangle magenta — laisser l'appel, il s'animera à l'arrivée.
- **Bulles** : `balloon(t, { t0, t1, text, x, y, w, tail: [x, y], kind: 'talk'|'think'|'shout'|'whisper' })` en pixels ÉCRAN.
  Placer la bulle **au-dessus de la tête**, jamais sur un visage ; la queue pointe vers la bouche (`stageToScreen(c, x, y)` convertit un
  point scène en écran — garder `c` depuis `stage()` dans une variable du plan). ≤ 8 mots. Pendant une bulle, mettre `talk: 1` au perso.
- **Papier et documents** (dessinés, jamais générés) : `paperSheet(x, y, w, h, { rot, lines, lift, fill }, (w, h) => { ... })`,
  `inkLine / inkRect / inkCircle / hatch` (trait d'encre vivant), `bdStamp(x, y, r, 'ESTIMATION', { color, rot })`,
  `letter(txt, x, y, { size, fam: FF.let|FF.bd|FF.brush, color, align })`. Polices : `FF.bd` (Bangers, titres/onomatopées),
  `FF.let` (Kalam, bulles/lettrage), `FF.letN` (Patrick Hand), `FF.brush` (Caveat Brush, annotations). Couleurs : `BD.*`.
- **Secousses / impacts** : `addShake(t0, amp, dur)` (tampons, cartons posés) — servent aussi de repères sonores.
- Couches fixes : plans z 10 · finition (vignette, grain) z 88 · puce de série z 70 · récitatif z 90.

## Accessoires communs — `12_props.js` (à utiliser, ne pas redessiner autrement : continuité d'un plan à l'autre)
- `writeOn(txt, x, y, t, t0, dur, { size, fam, color, align, underline })` : écriture manuscrite qui se révèle de gauche à droite.
- `kraftSheet(x, y, w, h, { rot, pin, lift }, (w, h) => …)` : papier kraft déchiré (la « vraie note », la frise, les étiquettes).
- `propEnvelope(x, y, w, { rot, label: 'TONTINE', sub, size })` : enveloppe kraft FERMÉE (jamais ouverte, jamais d'argent). Seconde enveloppe :
  `{ label: 'DOUANE', sub: 'MIS DE CÔTÉ' }`.
- `propCahier(x, y, w, { rot, turn: 0..1, fnNext }, fnGauche, fnDroite)` : cahier de tontine ouvert (réglure Seyès), page qui tourne.
- `propTicket(x, y, w, { rot, slip: true, stamp: 'CALCULÉE PAR LA DOUANE' })` : le ticket de la partie 1 « NOTE PRÉVUE · estimation »
  (+ bordereau orange agrafé « + AUTRES LIGNES … → PARTIE 2 »).
- `propPhone(x, y, w, { rot, glow }, (sw, sh) => …)` : téléphone générique sans marque ; la fonction dessine l'écran (déjà découpé).
- `propCarton(x, y, w, { t, open: 0..1, inside: (w, h, k) => …, tag })` + `propTag(x, y, s, 'PAS AVANT SAMEDI', { t })` : le carton de Boris
  (sur la marionnette de Boris, poser seulement `propTag` sur son carton, décalé selon x, y, h du perso).
- `propPassport(x, y, w, { rot, stamp: 'AVANT LE DÉPART ✓', stampK: 0..1 })` : le passeport vert de la marchandise (partie 1).
- `propFrame(x, y, w, h, {}, (w, h) => …)` : cadre au mur (vide = passe-partout crème).
- `propHand(x, y, s, { rot, pose: 'flat'|'pen', sleeve, dots, arm, pen })` : main dessinée + manche (poignet en x, y ; doigts vers `rot`,
  0 = vers le haut). Mireille : manche orange à pois bleus (défaut) · Christelle : `sleeve: '#2E8B57', dots: 'rgba(250,200,60,.9)'`.
- `propLizard(x, y, s, t, { flip, puff: 0..1, sleep, look: 0..1, pushAt, phase })` : le margouillat animé (pompes, tête qui bat,
  gorge gonflée = X2b). Remplace `cast/lezard_*`. Taille : s ≈ 1,2–2 en unités scène selon le cadrage.
- `dayCard(t, t0, 'LUNDI')` (cartouche jaune en haut à droite, y 250) · `tabOnglet(t, t0, '① LES TAXES')` (onglet kraft, y 352) — dans `screen()`.
- Décors procéduraux déjà enregistrés : `bg/table_maquis_dessus` (BG9, table rouge en plongée, nuit) et `bg/comptoir_dessus` (BG5, planches).

## Règles de mise en scène (le propriétaire a rejeté le rapide et l'incohérent)
1. **C'est un dessin animé** : quelqu'un bouge toujours un peu (respiration automatique) ; celui qui parle gesticule (`talk: 1`) ;
   les entrées se font en marchant quand c'est possible ; réactions visibles (saut, rire, pose choquée) aux moments forts.
2. **Rythme posé** : une action principale par plan ; les bulles restent ≥ 1,8 s ; un document s'écrit ligne à ligne au fil de la voix.
3. **Cohérence** : mêmes lieux, mêmes personnages, mêmes accessoires d'un plan à l'autre (la note de Christelle, l'enveloppe
   « TONTINE » fermée, le carton de Boris « PAS AVANT SAMEDI », le margouillat). Lumière juste : `GRADE` selon le lieu.
4. **Zones** : récitatif jaune y 1250–1450 (rien d'important dessous) ; puce de série en haut à gauche (x 40–460, y 160–232) ;
   texte à l'écran ≥ 44 px, pas au-delà de x 60…1020.
5. **Faits** : uniquement les textes de `shots_final.md` (avec les CORRECTIONS) ; aucun autre chiffre ; aucun logo, emblème,
   marque (y compris sur les baskets), aucun vrai document ; aucune scène d'argent qui change de mains ; aucun douanier.
6. **Bonzini** (P27) : écran d'app dessiné générique, logo Bonzini, « Estimer mes droits · en quelques questions », mention
   « Estimation · à faire confirmer par un commissionnaire agréé en douane » ; jamais lié au paiement du fournisseur de Christelle.

## Vérifier
```bash
cd douane2/overlay
node render.mjs --scenes 2x_vos_fichiers --times a,b,c --out ../out/chk_<clé> --pages 2 --jpg
python3 ../lib/sheet.py ../out/chk_<clé> ../out/chk_<clé>_sheet.jpg 5
```
Regarder les images (outil Read). Un aperçu animé : `node render.mjs <frame0> <frame1> --out ../out/anim_<clé> --pages 3 --jpg`
puis `ffmpeg -framerate 30 -i ../out/anim_<clé>/%05d.jpg -pix_fmt yuv420p ../out/anim_<clé>.mp4`.

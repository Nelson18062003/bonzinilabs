# DOUANE · Partie 1 — V2 « Le premier conteneur de Junior » — guide des animateurs

V1 a été rejetée (« trop rapide, pas de cohérence, aucun storytelling »). V2 = UNE histoire, UN monde continu, UNE caméra.
Lire dans l'ordre : ce guide → `data/script.json` (voix, 30 segments, avec station/camera/visual/onscreen par segment) →
`data/world_bible_v2.txt` (bible du monde) → `data/v2_deltas.md` (corrections qui PRIMENT sur la bible) → `SCENE_GUIDE.md` (API du kit, règles V1 toujours valables).

## Le monde (déjà construit — ne pas modifier ces fichiers)
- `09_world.js` : caméra (`camAt(t)`, `worldBegin(t, {px})`, `worldToScreen(x,y,t)`, `inView`), acteurs (`actorAt`, `drawActor`), route (`drawRoute`).
- `10_layout.js` : **le plan**. `GROUND = 1150` (ligne des pieds, y monde). Stations en x monde :
  `X.sea -700 · X.quai 520 · X.porte 1300 · X.transit 2300 · X.guichet 3300 · X.scanner 4300 · X.caisse 5200 · X.barriere 6100 · X.route 7150 · X.mboppi 8200`.
  Aides temps : `tw(seg, mot, off)` (début du mot), `te(...)` (fin), `ss(seg, off)`, `se(seg, off)`, `chs(ch)`, `che(ch)`, `CUT()` (la coupe S16).
  La **caméra est déjà réglée** (travelling droite→gauche en S1, puis gauche→droite au pas des personnages, plan-grue final en S30).
  **Junior et Mireille** marchent déjà d'une station à l'autre (`actor('junior'…)`, `actor('mireille'…)`), dessinés par `13_stage.js` à z 32.
  Pour changer leur visage/bras pendant VOTRE fenêtre : `poseHook('junior', (t, st) => t >= a && t < b ? { face: 'shock', arms: [...] } : null)`.
  `containerAt(t)` donne la position du conteneur (sur le quai jusqu'à S16, puis sur un camion au scanner, puis vers la sortie).
- `11_ground.js` (table), `13_stage.js` (plateau en kraft le long de la route + fil violet + acteurs), `14_backdrop.js` (panneau de ciel,
  grues lointaines, ville, lumière du jour : matin mer./jeu., doré ven., soir sur la route, samedi matin), `12_cast.js`
  (`juniorFig`, `mireilleFig`, `officerFig`, `brokerFig`, `figure(o)` : personnages en pied, origine = poitrine, pieds à +640 à l'échelle 1 ;
  dans le monde on les dessine à l'échelle `FIG_S = .5`, poitrine à `feetY = GROUND - 320`).
- `15_motifs.js` (partagé, identique partout) : `juniorPhone(w, h, {screen: 'notif'|'message', notif, seal, flap})` (message du grand frère + réponse
  cachée sous un rabat kraft scellé d'une pastille « ? » ; `flap` 1 = révélée), `qSticker(r, k)` (la pastille « ? »), `mireilleDiary(w, page, {note, tab, check})`.
- Pas de volets (`WIPE_CUTS = {}`) : on passe d'une station à l'autre par la caméra. Seule coupe franche : la page d'agenda en S16 (animateur D).

## Couches (z) — respecter pour que tout s'empile bien
- 12 ciel (fait) · 18 plateau + fil (fait) · **20–28 arrière des stations** (bâtiments, comptoirs vus derrière, grue, photos réelles scotchées au décor)
- 32 acteurs Junior/Mireille (fait) · **34–38 avant des stations** (comptoir de face, conteneur, camion, props posés devant, personnages secondaires devant)
- **40–58 éléments d'écran** (bulles, téléphone, carte QUOI/COMBIEN/D'OÙ en gros plan, tampons plein cadre) — en coordonnées écran,
  ancrés si besoin avec `worldToScreen`. 60+ réservé (teinte du jour 65, puce de série 70, sous-titres 90).
- Tout ce qui appartient au monde se dessine dans `ctx.save(); worldBegin(t); … ctx.restore();` en coordonnées monde.
  Parallaxe d'arrière-plan (optionnel) : `worldBegin(t, { px: .7 })` et placer l'objet à `x * .7`.

## Règles de mise en scène V2 (le cœur du retour du propriétaire)
1. **Rythme calme** : une action principale (+ une secondaire au plus) par segment ; laisser respirer ≥ 2,5 s ; pas de clignotement de textes.
2. **Cohérence** : on reste dans le monde. Les objets d'une station restent en place quand la caméra part et quand elle revient ; ce qui a été
   posé (tampon, document, carte) reste visible. Personnages identiques d'un plan à l'autre.
3. **Storytelling** : chaque visuel sert l'histoire de Junior (ses gestes, son visage, ses objets : téléphone à rabat « ? », chemise kraft,
   passeport vert) — on apprend en le regardant vivre, pas par des pancartes.
4. Textes à l'écran rares et courts (≤ 5 mots), ≥ 44 px sur papier opaque, jamais dans la bande des sous-titres (y 1250–1430) ;
   puce de série en haut à gauche (x 40–460, y 160–232) : rien dessous. Zones sûres : haut 150, bas 380, texte pas au-delà de x 960.
5. Faits : aucun taux par produit, aucun montant réel, aucun numéro d'article ; seuls chiffres : TVA 19,25 % (taux général), code « 64 04 ».
   Aucun emblème officiel, aucune marque d'armateur, aucune étiquette BZ sur le conteneur (étiquette manuscrite « JUNIOR · MBOPPI »).
6. Déterminisme (rnd, jit, stepT), tout calé sur la voix (`tw`, `ss`…), jamais de secondes en dur. La timeline peut être provisoire :
   elle sera remplacée par la vraie (même texte) — vos ancrages de mots s'adapteront.

## Vérifier
```bash
cd $S/douane/overlay
node render.mjs --scenes <vos fichiers> --times a,b,c --out ../out/chk_<clé> --pages 2 --jpg
python3 ../lib/sheet.py ../out/chk_<clé> ../out/chk_<clé>_sheet.jpg 5
```
(`--scenes` charge toujours les fichiers partagés 0x_/1x_, les volets et les sous-titres.) Regarder les images avec l'outil Read.

# DOUANE · Partie 1 — découpage plan par plan (brief des animateurs)

Voix = `data/script.json` (texte exact), timings = `data/timeline.json` (PROVISOIRE pour l'instant : les mots
sont espacés régulièrement ; le vrai minutage arrivera plus tard et **les scènes doivent s'y adapter toutes seules** :
tout est calé avec `TL.wt(seg, 'mot')` / `TL.we(...)` / `TL.ch(id).start|end`, jamais avec des secondes en dur).
Les durées réelles seront ~15 % plus courtes que le provisoire : prévoir des animations courtes (0,2–0,5 s) et des
états « tenus » qui respirent (drift, jitter), pas des animations longues qui débordent sur le mot suivant.

Ton : ludique, rassurant, pédagogique. Une idée = une image. Tout texte à l'écran est court (≤ 5 mots par bande).
Chaque scène : `ctx.translate(shake(t,n).x, shake(t,n).y)` au début ; ses chocs `addShake(TL.wt(...), amp)` enregistrés
une seule fois (drapeau local `let reg = false; if (!reg) { reg = true; addShake(...) }` dans `draw`).

---------------------------------------------------------------------------------------------------------------
## 20_hook.js — chapitre `hook` (S1) « Votre carton aussi a un passeport. S'il manque une page… il reste bloqué au port. »
- 0,0 s : l'image 0 est déjà pleine (pas d'écran vide) : table kraft, le carton de Junior `juniorCarton(520,380)` au centre (y≈820),
  légèrement de biais, rabat entrouvert. Une bande `strip('VOTRE CARTON A UN PASSEPORT', {size:64})` en haut (y≈420), posée de travers.
- « passeport » : le livret `goodsPassport(420,560,k)` jaillit du carton (ressort `pop`) et s'ouvre (k 0→1 en 0,35 s) ; page intérieure :
  mini portrait du carton + lignes manuscrites (Produit / Valeur / Origine) — `inside(w,h)`.
- « manque » : une page (rectangle crème lignes vertes) s'arrache (bord déchiré `tornLine`) et s'envole en tournoyant hors champ (stepT, en deux).
- « bloqué » (le mot) : flash blanc 2 images puis COUPE sur un tirage photo `photoPrint('containers_cranes', 900, 1150, {fx_kind:'duo', cols: DUO.violet, zoom 1.02→1.06})`
  qui remplit presque le cadre (légère rotation −0,02), `lightLeak` sur 0,5 s. Le carton en papier tombe (`drop`) sur la pile de la photo.
  `barrier(1100, ouvert→fermé)` claque en travers (bras qui retombe en 0,12 s), puis `roundStamp('BLOQUÉ AU PORT','!',200, DC.red)` + `slam` + `addShake(.., 16)`.
  Crédit : `creditTag(CREDIT.containers_cranes, …)` en bas à droite du tirage (au-dessus de y 1540).
- Fin (dernière 0,4 s) : léger zoom avant, tout reste lisible. **Jamais** la photo de Kribi ici.

## 22_bete.js — chapitre `bete` (S2, S3)
S2 « La douane ? La bête noire de tout le monde. Pourtant… vous la connaissez déjà. »
- « douane » : Junior `junior({face:'worry', sweat:true})` en bas à gauche (buste coupé par le bas, y≈1500, échelle .8). Derrière lui, la bête noire
  `monster(560, k, {n, look})` MONTE du bas (k 0→1 en 0,5 s) au centre (y≈1250), yeux qui suivent Junior. Bande `strip('LA BÊTE NOIRE', {fill: C.ink, color: C.cream})` y≈380.
- « tout le monde » : 3–4 petites silhouettes papier (têtes rondes) qui tremblent en bas, ou des « ?! » qui poppent — comique, jamais effrayant.
- « Pourtant » : une flèche manuscrite `handArrow` tourne autour du monstre ; il se REPLIE (`fold` 0→1) et laisse place à un panneau papier d'aéroport
  (rectangle bleu nuit, pictogramme avion `iconPlane`, texte « ARRIVÉES / DÉPARTS »), Junior passe à `face:'think'` puis `'smile'` sur « connaissez ».
S3 « À l'aéroport : passeport, questions, rayons X. Vos cartons ? Pareil. »
- Trois « cartes » papier claquent une par mot (rotation aléatoire ±0,05, `slam`) en colonne ou en éventail, y 500–1150 :
  « passeport » = un passeport humain (livret bordeaux « PASSEPORT », sans emblème) + petit tampon « VU » ;
  « questions » = grande bulle « ? » ; « rayons » = une valise dessinée sur un tapis + `scannerArch` + faisceau cyan qui révèle l'intérieur en négatif.
- « cartons » : chaque carte reçoit un carton : le livret humain devient le `goodsPassport` vert, la bulle a un carton, et la valise est remplacée
  par un tirage `photoPrint('containers_cranes', 620, 420)` sur lequel passe `xrayPass(...)` qui révèle des rangées de cartons dessinés (inside).
- « Pareil » : bande `strip('PAREIL !', {fill: C.amber})` + « = » déchiré qui relie les deux colonnes.

## 30_porte.js — chapitre `porte` (S4) « La douane, c'est la porte du pays pour les marchandises. Ce qui entre… et ce qui sort. »
- Début : tirage `photoPrint('douala_satellite', 860, 560, {fx_kind:'duo', cols: DUO.green})` + lightLeak ; Ken Burns vers l'estuaire.
- « porte » : fondu-enchaîné papier vers `cmrMap(scale, {pins:{Douala:k, Kribi:k}})` centrée (scale ≈ 95 → carte ≈ 800 px de large, y≈900) ;
  sur la côte (Douala/Kribi) un portail/`barrier(260, …, {label:'DOUANE'})` miniature planté comme une porte.
- « pays » : la carte pulse (contour vert épais), étiquette `strip('LA PORTE DU PAYS', {size:72})` y≈380.
- « entre » : flèche violette épaisse (thread / handArrow) de la mer (gauche) vers Douala avec un petit carton qui voyage dessus ; chip « IMPORT ».
- « sort » : flèche orange de Kribi vers la mer avec un petit sac `sack` ; chip « EXPORT ». En bas : bande `strip('IMPORT ⇄ EXPORT : VOUS DEUX', {size:54})`.
- Deux petits tirages réels en polaroïd aux coins (≤ 380 px) : `kribi_crane` (fy≈.35, on voit « KRIBI DEEP SEA PORT », légende manuscrite « Kribi »)
  et `douala_port` (légende « Douala »), qui arrivent avec les flèches. Crédits `creditTag`.

## 32_papiers.js — chapitre `papiers` (S5) « Son passeport ? Les papiers : facture, connaissement, déclaration. »
- « passeport » : le `goodsPassport` vert ouvert au centre (y≈1050), vide.
- « facture » / « connaissement » / « déclaration » : `docSheet('facture'|'connaissement'|'declaration', 300, 400)` tombent un par mot (drop + squash)
  en éventail au-dessus (y≈620) ; sous « CONNAISSEMENT » une note manuscrite « (le BL) ». Valeurs manuscrites génériques (Baskets / 100 paires…, sans prix réel Bonzini).
- Fin du segment : les 3 feuilles se plient et glissent DANS le passeport (échelle → 0 vers son centre), le livret se ferme avec un tampon « COMPLET » vert,
  petite note : « souvent faite par votre transitaire » (FF.hand 40) près de la déclaration.

## 34_questions.js — chapitre `questions` (S6) « Et au guichet, trois questions. Quoi ? Combien ? D'où ? »
- « guichet » : `officer({arms:['idle','idle']})` derrière `counter(900,'GUICHET')` en bas (counter top y≈1180, douanier poitrine y≈1030, échelle .9) ; il sourit, lève un sourcil.
- « trois » : trois cartes face cachée (dos kraft avec « ? ») apparaissent au-dessus (y≈560), compteur « 0/3 ».
- « Quoi » / « Combien » / « D'où » : chaque carte se RETOURNE (scaleX 1→0→1) sur son mot et montre `qCard(n, QWORD[n-1], sub, {band: QCOL[n-1], w:300, h:250, size:64})`
  sub = « le produit » / « la valeur » / « l'origine ». Le douanier pointe la carte (arms 'point'). Tampon léger à chaque retournement.

## 40_quoi.js — chapitre `quoi` (S7) « Quoi ? Pas juste « des baskets » : en cuir, en tissu ? Chaque produit a son code… et chaque code, son taux. »
- `qHeader(0)` en haut (y≈330) toute la durée.
- « baskets » : deux `sneaker(360, …)` apparaissent (gauche marron `color:'#8A5A3A'` = cuir, droite bleu tissu avec motif maille), bande « PAS JUSTE "DES BASKETS" ».
- « cuir » : `loupe` sur la basket gauche (texture cuir grossie), étiquette papier `CODE 64 03` (FF.mono, grande) qui s'accroche par un fil.
- « tissu » : idem à droite `CODE 64 04`.
- « code » : les chiffres roulent comme un cadenas puis se fixent ; note manuscrite « code SH ».
- « taux » : sous chaque étiquette, une jauge verticale en papier « % » de HAUTEUR DIFFÉRENTE (aucun nombre !) qui monte ; bande `strip('1 CODE = 1 TAUX', {fill: C.violetD, color:'#fff'})`.
  Petit rappel conformité (optionnel) : un x-ray de carton qui montre du cuir alors que l'étiquette dit « tissu » → pas nécessaire si le temps manque.

## 42_combien.js — chapitre `combien` (S8) « Combien ? Marchandise, plus transport, plus assurance. Oui… même le bateau est taxé ! »
- `qHeader(1)` en haut.
- Tour de blocs `stackBlock` (origine bas-centre, base y≈1180, largeur 620) qui tombent un par mot :
  « Marchandise » = `stackBlock(620,150,'MARCHANDISE',{fill: BLK.marchandise, icon: sneaker mini})` ;
  « transport » = `stackBlock(620,170,'TRANSPORT',{photo:'ships_cranes', fx_kind:'duo', cols: DUO.amber, sub:'le fret'})` ;
  « assurance » = `stackBlock(620,150,'ASSURANCE',{fill: BLK.assurance, icon: ()=>iconUmbrella(90)})`.
  Signes « + » manuscrits entre les blocs.
- Accolade manuscrite qui se dessine à droite → plaque `VALEUR EN DOUANE` (FF.stencil, fond `C.violetD`, texte blanc).
- « bateau » / « taxé » : tampon rouge `roundStamp('TAXÉ AUSSI','!',150, DC.red)` claque sur le bloc TRANSPORT + addShake ;
  Junior en médaillon (petit, coin bas gauche, au-dessus de 1540) `face:'shock'`.

## 44_dou.js — chapitre `dou` (S9) « D'où ? Du pays de fabrication… pas du port de départ. »
- `qHeader(2)` en haut.
- Une petite route papier horizontale (y≈900) : à gauche une USINE `iconFactory` (pastille « FABRIQUÉ ICI »), au milieu un PORT `iconAnchor` (« PARTI D'ICI »),
  un carton voyage de l'usine au port puis vers la droite (mer / flèche).
- « fabrication » : grosse coche verte `iconCheck` sur l'usine ; étiquette `madeIn('VIETNAM')` cousue sur le carton.
- « port de départ » : croix rouge `iconCross` sur le port ; bande `strip("ORIGINE = LÀ OÙ C'EST FABRIQUÉ", {size:54})` ; petite note « ex. : fabriqué au Vietnam, chargé en Chine → origine Vietnam ».

## 50_note.js — chapitre `note` (S10) « La note : le droit de douane, selon le code. Puis la TVA, 19,25 %, sur le tout… droit compris. »
- « note » : la tour de valeur réapparaît (même style) mais condensée en UN bloc `stackBlock(620,200,'VALEUR EN DOUANE',{fill: C.violetD, color:'#fff'})` (base y≈1180) ; titre `strip('LA NOTE')`.
- « droit » : un bloc violet `DROIT DE DOUANE` tombe dessus ; sa hauteur « respire » (petit ↔ grand) pour dire « selon le code » + mini étiquettes 64 03 / 64 04 à côté.
- « TVA » : une grande plaque translucide ambre `TVA 19,25 %` (texte ≥ 96 px, sur fond opaque au centre) descend et recouvre TOUTE la pile (valeur + droit) comme un film plastique ;
  accolade « SUR LE TOUT » ; « compris » : flèche manuscrite vers le bloc droit « droit compris ! ».
- Fin : image « fiche » propre tenue 1 s (capturable). Post-it `postIt(300)` : « + selon le produit : accises… → PARTIE 2 ».

## 52_conformite.js — chapitre `conformite` (S11) « Mauvais code, valeur trop basse ? Amende et retards. Le secret : des papiers vrais, complets, prêts à l'avance. »
- « Mauvais code » : `docSheet('declaration', 480, 620)` au centre ; la ligne « Code du produit » s'entoure en rouge (`handCircle`) ; « valeur trop basse » : la ligne Valeur barrée.
- « Amende » : tampon `roundStamp('AMENDE','!',170, DC.red)` + shake ; « retards » : `iconClock` qui tourne vite + `barrier` qui se ferme, `trafficLight('red')`.
- « secret » : bande `strip('LE SECRET', {fill: C.amber})` ; trois puces qui poppent : `VRAIS ✓` / `COMPLETS ✓` / `PRÊTS À L'AVANCE ✓` (iconCheck) une par mot.
- Sur « avance » : `trafficLight('green')`, la barrière se lève ; la petite bête noire (monster 200 px) en coin se replie en `paperPlane` et s'envole hors champ (la peur est vaincue).

## 60_export.js — chapitre `export` (S12) « Vous exportez ? Ça se déclare aussi, même sans rien à payer. »
- « exportez » : Mireille `mireille({arms:['hold','idle']})` à droite tient un `sack(300,360,'POIVRE DE PENJA')` ; derrière, tirage `photoPrint('kribi_crane', 760, 460, {fx_kind:'duo', cols: DUO.green})` (positif, lumineux).
- « déclare » : un passeport ORANGE (`goodsPassport(..., {cover: C.orange})`) reçoit le tampon « SORTIE » ; `docSheet('declaration', 320, 420, {values:['Poivre','—','Cameroun','Export']})`.
- « rien à payer » : chip « 0 F de TVA à l'export » NON — rester général : bande `strip('MÊME SANS RIEN À PAYER', {size:56})` ; petites puces « certificat d'origine » · « phytosanitaire (selon le produit) » (FF.body 40).

## 65_bonzini.js — chapitre `bonzini` (S13, S14)
S13 « Chez Bonzini, on veut que vous réussissiez. Bientôt dans l'application : vos frais de douane estimés en quelques questions. »
- « Bonzini » / « réussissiez » : Junior (gauche) et Mireille (droite) côte à côte, `face:'grin'`, `drawLogo` au-dessus, cœurs papier `iconHeart` qui montent ;
  bande manuscrite « On veut que vous réussissiez ». Chaleur : lightLeak doux.
- « application » : `phoneFrame(560, 1212, drawScreen)` glisse du bas au centre (y≈900, tilt −0,03). Écrans (vraies captures floutées) :
  `app_home` (titre « Payez le juste droit. Ni plus, ni moins. ») → « douane » : `app_m_sugg` (recherche « mèches ») avec `fingerTap` → « estimés » : `app_m_product` →
  « questions » : `app_sim_05_filled` puis défilement de `app_m_result` (scroll animé : on voit « La valeur taxée » puis « Sur la déclaration (DAU) » ligne par ligne).
  Tampon orange « BIENTÔT » (roundStamp) sur le coin du téléphone ; bandeau papier opaque (≥ 36 px) sous le téléphone : « Estimation indicative : le montant final est fixé par la douane ».
  **Jamais** d'autres captures que celles-là.
S14 « D'abord au Cameroun, puis ailleurs en Afrique. »
- `cmrMap` (petite, centrée) : le Cameroun s'allume (vert) + pin « 1 » ; puis des anneaux concentriques papier s'élargissent sur les pays voisins (sans nommer de pays),
  chip « puis ailleurs en Afrique… ». Le téléphone reste en petit à côté (optionnel).

## 70_partie2.js — chapitre `partie2` (S15) « Partie 2 : les taxes une par une, la conformité, la simulation… et choisir votre transitaire. »
- `folder(880, 900, ['Les taxes, une par une','La conformité','La simulation','Choisir son transitaire'], k, {title:'PARTIE 2'})` au centre ;
  un onglet apparaît par mot-clé (taxes / conformité / simulation / transitaire). Tampon « BIENTÔT » orange + pastille « ABONNEZ-VOUS ».

## 72_cta.js — chapitre `cta` (S16) « Quoi, combien, d'où : laquelle vous bloque ? Dites-le en commentaire. »
- Les trois `qCard` reviennent en éventail (1 QUOI / 2 COMBIEN / 3 D'OÙ), chacune pulse sur son mot.
- « commentaire » : `commentBubble(760, 'La 2 ! Le bateau taxé 😅', k, n)` qui se tape (Junior en mini avatar) — pas d'emoji si la police ne le rend pas : « La 2 ! »

## 74_sign.js — chapitre `sign` (S17) « Bonzini Trading Cargo. Payez le juste droit. Ni plus, ni moins. »
- Boucle : on revient au cadrage de l'image 0 (carton de Junior + passeport vert, fermé cette fois, tamponné « PRÊT »).
- « Bonzini » : `drawLogo(540, 760, 260)` (se dessine), « Bonzini Trading Cargo » (FF.body 64). « juste droit » : `strip('PAYEZ LE JUSTE DROIT.', {size:70})` ; « moins » : `strip('NI PLUS, NI MOINS.', {fill: C.amber})`.
- Crédits photo discrets (FF.body 22, bas y≈1500) : « Photos : BACHELOR45 (Le Sorcier) CC BY 4.0 · gd6d CC BY 2.0 · migmasat PD · roy.luck, foxypar4 CC BY 2.0 ».

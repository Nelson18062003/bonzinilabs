# « Votre vrai prix de revient » — guide des scènes

Projet : `$S/prix` (S = scratchpad). Vidéo verticale 1080×1920, 30 i/s, tout est dessiné en Canvas 2D,
rendu déterministe par Chromium headless (`overlay/render.mjs`). Série « Kraft & Fil » (table de colis vue de dessus,
papier découpé, stop-motion) + épisode « argent » (billets stylisés, ticket de caisse, étiquette de prix, calculatrice,
cahier Seyès, personnages en papier).

## Fichiers
- `overlay/kit.js` — noyau : `W,H,FPS,C,FF`, maths (`clamp, lerp, prog, eOutCubic, eInOutCubic, eOutExpo, eOutBack, spring(t,w,z), drop(t,t0,h0,dur), stepT(n), jit(id,n,amt), env(t,a,b,fin,fout), rnd(i)`),
  timeline `TL.ch(id) / TL.seg(id) / TL.wt(seg, mot, fb, nth) / TL.we(...) / TL.in(t,id)`, dessin (`withShadow(h,fn), rrect, at(x,y,r,sx,sy,fn), tornLine, text(s,x,y,{font,size,wght,color,align,alpha,ls,shadow}), font(fam,size,wght), measure, stampText(s,x,y,f,color,{box,starve,alpha}), carton(w,h,o), qr, shipLabel(w,h,'sea'|'air',code), iconShip, iconPlane, thread(pts,p,n,o), curve(ctrl,seg), ticket(w,h,title,sub,o), paperNote(x,y,w,h,rot,fn,o), drawLogo(x,y,size,o), scanner, laser, chip(x,y,label,o), scaleDevice(w,k), tapeMeasure(len,k,vertical)`).
  Polices : `FF.stencil` (Big Shoulders Stencil), `FF.body` (Bricolage Grotesque), `FF.mono` (Martian Mono), `FF.hand` (Shantell Sans, feutre), `FF.brand` (DM Sans, chiffres), `FF.cjk`.
- `overlay/scenes/00_money.js` — `M` (couleurs argent : `M.red`, `M.gain`, `M.gold`…), `fmtN(n)` → « 1 250 000 », `fcfa(n)` → « 1 250 000 F », `countTo(a,b,k)`,
  `banknote(w,h,{value:10000|5000|2000|1000|500, clip:[x0,x1], serial, alpha})`, `noteFan(w,h,count,k,o)`, `noteStack(w,h,n,o)`, `coin(r,label,{metal:'silver',tilt})`, `coinStack(r,n,o)`,
  `receipt(w, rows[{label,amount,k,color,bold,note}], {title,sub,total:{label,amount,k,color},fs,lineH})` → hauteur, `receiptPrinter(w,{led})`,
  `priceTag(w,h,fn,{string,fill})`, `handText(s,x,y,size,{write:0..1, strike:0..1, double, color, align})`, `marker(x,y,rot,col)`, `handArrow(ctrl,p,col,w)`, `handCircle(rx,ry,p,col,w,seed)`,
  `calculator(w, affichage, {press:'=', tag, dispColor})`, `scissors(open,col)`, `notebook(w,h,{grid,holes,lift})`, `sneaker(w,{color,accent,lift})`, `shoeBox(w,h,{label,band})`,
  `plate(x,y,str,{size,fill,color,rot,s,fam})` (plaque sombre à chiffres clairs), `postIt(w,fn,o)`.
- `overlay/scenes/01_people.js` — `person({skin: SKIN[i], outfit, wax, waxCols, hair:'short'|'wrap'|'cap', capColor, face:'smile'|'grin'|'shock'|'worry'|'think'|'wink', arms:[gauche,droite] parmi 'idle'|'up'|'point'|'hold'|'chin'|'thumb'|'count'|'raise'|'hip' ou [x,y] cible main, blink, look:-1..1, tilt, sweat, handProp: fn, handSide: -1|1})`.
  Buste ~ 400×560 px à l'échelle 1, origine = poitrine ; mettre les personnages derrière un comptoir (étal) ou couper le bas hors champ.
  `waxFill(x,y,w,h,seed,cols)` = motif pagne wax.
- `overlay/scenes/90_captions.js` — sous-titres (bande de papier, centre y = 1340 par défaut, hauteur ~130–200).
  Depuis une scène : `captionHide((t, page) => bool)` pour les masquer pendant un gros chiffre, `captionY((t, page) => y | null)` pour les déplacer
  (définis dans `02_director.js`, qui compose les demandes de toutes les scènes — ne jamais écrire `window.CAPTION_*` directement).

## Règles
1. **Une scène = un fichier** `overlay/scenes/NN_nom.js`, dans une IIFE, `registerScene({ id, z, when: t => TL.in(t,'chapitre', .4, .4), draw(t, n) })`.
   `z` : 10–60 décor et objets, 80 transitions, 90 sous-titres.
2. **Déterminisme** : jamais `Math.random`/`Date`. Aléa = `rnd(seed)`. Pose « à la main » = `jit(id, n)` ; mouvements stop-motion = `stepT(n)` (en deux).
   Les mouvements fluides (glissés, ressorts) utilisent `t`.
3. **Tout est calé sur la voix** : `TL.wt('S7','fret')` = début du mot. Les apparitions tombent sur le mot prononcé (±0,1 s).
4. **Zones sûres** (TikTok/Reels) : haut 150 px, bas 380 px (y > 1540 = interface), colonne droite x > 960 à éviter pour le texte.
   Bande des sous-titres y 1250–1430 : ne rien y mettre d'important, ou les déplacer/masquer (`captionY` / `captionHide`).
5. **Lisibilité** : texte ≥ 44 px sur fond opaque (papier, plaque) ; titres ≥ 96 px ; chiffres clés ≥ 110 px. Contraste fort, jamais de texte fin sur la table.
6. **Montants** : toujours `fmtN`/`fcfa` (espaces), jamais `toLocaleString`. Les montants de l'exemple sont marqués « exemple ».
7. **Jamais statique** : chaque plan bouge (respiration, dérive de caméra, jitter, particules). Un plan fixe > 1,5 s est un défaut.
8. **Faits** : aucun tarif Bonzini, délai, adresse, numéro. Pas « transfert d'argent ». Pas « MAERSK ».
9. **Transitions** : gérées par `80_wipes.js` (ne pas en dessiner dans les scènes).

## Vérifier son travail
```bash
cd $S/prix/overlay
node render.mjs --times 12.4,13.0,14.2 --out ../out/chk --pages 2      # images précises
python3 ../lib/sheet.py ../out/chk ../out/chk_sheet.jpg 6                 # planche contact
```
Regarder chaque image (outil Read), corriger chevauchements, textes coupés, zones sûres, lisibilité.

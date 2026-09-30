# « DOUANE · Apprends à faire — Partie 1 » — guide des scènes

Projet : `$S/douane` (S = scratchpad). Vidéo verticale 1080×1920, 30 i/s, ≈ 90 s, tout est dessiné en Canvas 2D,
rendu déterministe par Chromium headless (`overlay/render.mjs`). Série « Kraft & Fil » (table de colis vue de dessus,
papier découpé, stop-motion) — **édition DOUANE** : de VRAIES photos (tirages papier, duotone, rayons X) + motion design papier.

## Direction artistique (à respecter partout)
- **Métaphore unique** : « Votre carton a un passeport ». La douane = l'aéroport des marchandises. Le douanier pose
  toujours **3 questions : QUOI ? (violet) · COMBIEN ? (ambre foncé #C77A12) · D'OÙ ? (orange)** → `qHeader(i)` / `qCard`.
- **Vraies photos = tirages papier** posés sur la table (`photoPrint`), jamais plein écran nu. Traitements : duotone
  (`fx_kind:'duo', cols: DUO.green|DUO.violet|DUO.amber|DUO.night`), Ken Burns lent (zoom 1→1.06), `lightLeak` au moment de
  la coupe, rayons X (`xrayPass`) = **signature VFX** (négatif cyan + faisceau). Crédit sur chaque tirage : `creditTag(CREDIT[name], x, y)`.
- **Tampons** = ponctuation : `roundStamp` / `stampText` + `slam(t, t0)` (grossit → claque) + `addShake(t0, 14)` (tremblement 4 images).
- **Jamais statique** : `drift(t, seed)` sur chaque plan, pose « à la main » avec `jit`, mouvements de papier en `stepT(n)` (en deux).
- Palette : logo violet/ambre/orange + vert douane `DC.green` (passeport), rouge `DC.red` (tampons, barrière), cyan `XRAY` (scanner).
- Typo : titres `FF.stencil` ≥ 96 px, notes manuscrites `FF.hand`, texte `FF.body` ≥ 44 px sur papier opaque.

## Fichiers / API
- `overlay/kit.js` — noyau (voir aussi `SCENE_GUIDE` de la série) : `W,H,FPS,C,FF`, `clamp, lerp, prog, eOutCubic, eInOutCubic, eOutExpo, eOutBack,
  spring, drop(t,t0,h0,dur), stepT(n), jit(id,n,amt), env(t,a,b,fin,fout), rnd(i)` ; timeline `TL.ch(id) / TL.seg(id) / TL.wt(seg, mot) / TL.we(...) / TL.in(t,id,a,b)` ;
  dessin `withShadow(h,fn), rrect, at(x,y,r,sx,sy,fn), tornLine, text(s,x,y,{font,align,color,alpha,ls}), font(fam,size,wght), measure, stampText,
  carton(w,h,{label: fn}), thread(pts,p,n), curve(ctrl), ticket, paperNote(x,y,w,h,rot,fn,o), drawLogo(x,y,size,o), chip(x,y,label,o)`.
- `00_money.js` — `handText(s,x,y,size,{write,strike,color,align})`, `handArrow(ctrl,p,col,w)`, `handCircle(rx,ry,p,col,w)`, `sneaker(w,{color,accent})`,
  `shoeBox(w,h,{label,band})`, `plate(x,y,str,o)`, `postIt(w,fn)`, `receipt(...)`, `fmtN/fcfa`.
- `01_people.js` — `person({skin: SKIN[i], outfit, wax, waxCols, hair:'short'|'wrap'|'cap', capColor, face:'smile'|'grin'|'shock'|'worry'|'think'|'wink', arms, blink, look, tilt, sweat})`.
  Buste ~400×560 à l'échelle 1, origine = poitrine. **Junior** = `{skin: SKIN[1], outfit: C.violet, hair:'short'}` ; **Mireille** (exportatrice) = `{skin: SKIN[3], hair:'wrap', wax:true}`.
- `03_show.js` — `commentBubble(w,str,k,n)`, `confetti(s,count,seed)`, `dial(r,k,label)`.
- `04_places.js` — `paperBoat(cargo)`, `paperWaves(n,y0,amp)`, `stall(w)`, `truck(t)`.
- `06_photo.js` — `ph(name)`, `photoCover(src,x,y,w,h,{zoom,fx,fy})`, `photoFx(name,'duo'|'xray',cols)`, `photoPrint(name,w,h,{border,caption,tape,credit,fx_kind,cols,develop,scan,zoom,fx,fy,lift})`,
  `xrayPass(name,x,y,w,h,reveal,{inside})`, `loupe(cx,cy,r,k,drawFn)`, `lightLeak(p,seed)`, `roundStamp(txt,center,r,color,{rot,alpha})`.
- `07_customs.js` — `DC`, `cmrMap(scale,{pins:{Douala:k,Kribi:k},fill,neighbours,sea})` (unités = degrés : Douala [-2.785,1.95], Kribi [-2.576,3.06] ; carte ≈ 8.5×11 degrés),
  `docSheet(kind,w,h,{values,write,highlight,rows})` (facture/connaissement/declaration/origine/colisage), `goodsPassport(w,h,k,{inside,cover})`,
  `barrier(len,open,{label})`, `scannerArch(w,h,beam)`, `qCard(n,word,sub,{band,w,h,size})`, `phoneFrame(w,h,drawScreen)`, `screenShot(name,x,y,w,h,scroll)`, `fingerTap(x,y,k)`.
- `08_props.js` — `DUO`, `XRAY`, `addShake(t0,amp,dur)` + `shake(t,n)`, `drift(t,seed,amp)`, `slam(t,t0)`, `pop(t,t0)`, `monster(w,k,{fold,look,n,label,mouth})` (la bête noire),
  `officer(o)` (douanier générique, casquette verte, SANS insigne), `counter(w,label)`, `sack(w,h,label,{sub})`, `trafficLight(state)`, `folder(w,h,tabs,k,{title})`,
  `iconFactory/iconAnchor/iconUmbrella/iconClock/iconHeart/iconCheck/iconCross(s)`, `paperPlane(s)`, `madeIn(txt,w)`, `qHeader(i,k)`, `strip(txt,{size,fill,color})`,
  `masked(w,h)`, `creditTag(s,x,y)`, `CREDIT[photo]`.
- `05_tag.js` — étiquette de série (grande pendant S1, puce en haut à gauche ensuite). `80_wipes.js` — transitions (page de passeport / ruban Bonzini / barrière).
  `90_captions.js` — sous-titres (centre y = 1340). Depuis une scène : `captionHide((t,page)=>bool)` / `captionY((t,page)=>y|null)`.

## Photos disponibles (`window.PH[nom]`)
| nom | contenu | usage |
|---|---|---|
| `kribi_crane` | port de Kribi vu de drone, grue « KRIBI DEEP SEA PORT », navire chargé | **positif seulement** (porte du pays, export). Jamais sous « BLOQUÉ » |
| `douala_port` | port de Douala, grues + navire (recadré) | porte du pays |
| `douala_city` | Douala vue d'en haut | décor Junior |
| `douala_satellite` | estuaire du Wouri vu du ciel | carte |
| `containers_cranes` | piles de conteneurs + grues (illustration) | accroche « BLOQUÉ », rayons X |
| `ships_cranes` | porte-conteneurs sous grues (illustration) | bloc TRANSPORT |
| `ship_cranes_night`, `port_hazy`, `crane_silhouette` | ambiances port | fonds |
| `inspection_dog` | chien détecteur (USDA, illustration) | rayons X / contrôle, étiqueté « photo d'illustration » |
| `app_home`, `app_m_sugg`, `app_m_product`, `app_sim_05_filled`, `app_m_result` | **vraies captures du futur simulateur Bonzini** (taux produits et montants floutés) | S13 uniquement, dans `phoneFrame`, avec le tampon « BIENTÔT · APERÇU » |

Captures 1170 px de large (hauteur 2532 ; `app_m_result` 1170×4000). Ne jamais afficher `app_sim_01_empty`, `app_sim_02_*`, `app_sim_03_*`, `app_sim_04_*`, `app_sim_06_*` (non masquées).

## Règles
1. **Une scène = un fichier** `overlay/scenes/NN_nom.js`, IIFE, `registerScene({ id, z, when: t => TL.in(t,'chapitre', .4, .4), draw(t, n) })`. z 10–60.
2. **Déterminisme** : jamais `Math.random`/`Date`. Aléa = `rnd(seed)`.
3. **Tout est calé sur la voix** : `TL.wt('S7','cuir')` = début du mot. Les apparitions tombent sur le mot (±0,1 s). Les chocs (`addShake`) s'enregistrent paresseusement au premier `draw` (le timeline est prêt).
4. **Zones sûres** : haut 150 px, bas 380 px (y > 1540 = interface), colonne droite x > 960 à éviter pour le texte. Bande des sous-titres y 1250–1430 :
   rien d'important dedans, ou `captionY`/`captionHide`. La puce de série occupe x 40–460, y 160–232 : ne rien mettre dessous.
5. **Lisibilité** : texte ≥ 44 px sur fond opaque ; titres ≥ 96 px. Contraste fort.
6. **Faits** : aucun taux par produit (pas de « 30 % », « 40 % »…), aucun montant de douane, aucun numéro d'article de loi, aucun tarif/délai/adresse Bonzini.
   Seuls chiffres permis : **TVA 19,25 %**, codes SH **64 03** (baskets dessus cuir) / **64 04** (dessus textile).
   Pas « MAERSK » ni logo d'armateur. Pas « transfert d'argent ». **Aucun emblème officiel** (armoiries, drapeaux, écussons). Pas d'étiquette BZ
   sur un carton bloqué/scanné/inspecté : le carton de Junior porte une étiquette manuscrite « JUNIOR · MBOPPI ».
7. **Transitions** : gérées par `80_wipes.js` (ne pas en dessiner dans les scènes). Chaque scène couvre son chapitre ± 0,4 s (sous le volet).

## Vérifier son travail
```bash
cd $S/douane/overlay
node render.mjs --scenes 20_hook,05_tag,90_captions --times 1.2,2.5,4.0 --out ../out/chk_hook --pages 2
python3 ../lib/sheet.py ../out/chk_hook ../out/chk_hook_sheet.jpg 6
```
Regarder chaque image (outil Read), corriger chevauchements, textes coupés, zones sûres, lisibilité.

# « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5): module guide

Read this whole file before you draw anything.

`E = <scratchpad>/serie/ep2`. The storyboard is `<scratchpad>/serie/SERIE.md`: read « Épisode 2 », « Ce qui revient dans
chaque épisode » and « Règles de fabrication communes ». The contract and the quality bar are in `<scratchpad>/serie/PIPELINE.md`;
the rules are in `serie/BRIEF.md`. The film runs **32.5 s, 975 frames, 1080×1920 at 30 fps** with the default times. The lead
re-times it on the real voices through `data/timing.json`, so **never hard-code a time**: always read `SCORE.A.x` or `SCORE.T.x`.

**The #1 rule: a Mboppi trader who sees it ONCE, scrolling, without sound, understands it.** Every key sentence is said AND
written, big (≥ 44 px body, ≥ 96 px titles), crisp, high contrast, held ≥ 1.4 s, and never more than 3 text blocks at once.

## What already works (stage 1, lead's skeleton)
The film already renders end to end with **plain fallback blocks**. As soon as you define a function listed below,
`50_compose.js` calls it instead of its fallback, and `60_type.js` stops drawing the texts you take over (see « takeover »).
To check: `cd E/overlay && nice -n 5 node render.mjs --times 0,0.5,5.5,8.9 --out ../out/chk_ca --pages 2 --jpg`, then
`python3 ../tools/sheet.py ../out/chk_ca ../out/chk_ca_sheet.jpg 4`. Look at the stills: full size, crops, and a 360 px wide
downscale. Iterate until the result is premium. The animatic as it stands is `E/out/animatic_sheet.jpg` (20 stills).

| File (owner) | Contents |
|---|---|
| `overlay/engine.html`, `kit.js`, `render.mjs` (lead) | Kraft & Fil engine (explainer-v2 kit), every font declared. `render.mjs` is the « PAS REÇU. » renderer (TIMING injection, `--mb`, `--times`, `--scenes`). |
| `scenes/00_money.js` (shared, read-only) | prix-de-revient props: `priceTag(w,h,fn)`, `handText(s,x,y,size,{write,strike,color})`, `marker(x,y,rot,col)`, `handArrow`, `handCircle`, `shoeBox`, `M.red`… |
| `scenes/01_score.js` (lead, read-only) | **THE SCORE**: `SCORE.T` (voice starts), `SCORE.DUR`, `SCORE.W(id, prefix, nth, fb)`, `SCORE.A` (every action time), `SCORE.G` (layout), and every object state as a pure function of t. |
| `scenes/02_light.js` (lead) | DAY light API, same names as in pas-recu: `lit(hex,x,y,L,bias)` → `'rgb()'`, `lightAt`, `shadowOff(x,y,z,L)` (shadows fall down-right; straight down under the violet light), `softPath(pathFn, blur, color)`, `castShadow(pathFn,x,y,z,L,strength)`. **Never `ctx.filter`** (25 ms a call). |
| `scenes/39_gecko_shim.js`, `40_gecko.js`, `41_gecko_unshim.js` (lead, done) | The validated « PAS REÇU. » margouillat, unchanged, driven by `SCORE.gecko(t)` through an adapter. Bottom-left at `G.gecko` (112, 1470). `K_mouth(t)` → his mouth (world px). |
| `scenes/50_compose.js` (lead) | Camera, draw order, calls to your functions, fallbacks. Read it to see when you are called and in which order. |
| `scenes/60_type.js` (lead) | Series chip, pills, captions, formula, band, end card: everything you do not take over. |
| **M1**: `scenes/30_carton.js`, `32_air.js`, `34_plates.js`, `36_measure.js` | « carton & air », prefix `CA_` |
| **M2**: `scenes/70_bonzini.js`, `76_end.js` | « Bonzini & end », prefix `BZ_` |

Rules for every module: functions only, never `registerScene` (except in a temporary `98_test_<key>.js`, deleted at the end).
Prefix every global with your key. Everything is deterministic (`rnd(i)` with fixed seeds, never `Math.random` or `Date`),
and **t is in seconds** as a float, because motion blur samples sub-frames. Use the frame `n = Math.round(t * 30)` or
`stepT(n)` (on twos) only for stop-motion poses. Cache static sprites lazily in `makeCanvas` canvases. A full frame must
stay under ~60 ms: the final render averages 6 sub-frames. Do not edit files you do not own; ask the lead.

## Look: Kraft & Fil packing table, day
The scene is a cream paper table (`TEX.table`) seen from above, lit by a soft window from the top-left. Everything is cut
paper and cardboard with real thickness, contact shadows (`castShadow` / `withShadow`) and stop-motion on twos for
« touched » objects. Paper fibres can come from `explainer-v2/overlay/scenes/16_paper.js` (`f2_fibres`, `f2_edge`): copy
the code into your file under your prefix. The look is premium, tactile and cinematic, never flat PowerPoint.

**Colours** (logo):
- orange `#FE560D`: the title plate and the stamps;
- amber `#F3A745`: TOI, the merchant (his plates and pill);
- violet `#A947FE` / `#7B4BFF`: **ONLY with Bonzini**, from `A.violet` on. Never violet before that: the supplier's tape
  stays **kraft**, and the kit's `C.tape` amber is not for M1's cartons;
- light blue hatching `rgba(156,195,230)` / `#2F78BD`: the void;
- sea blue `#0B5FA5`: the real colour of the sea-cargo label, and the « AIR » letters;
- ink `#231629`, cream `#FFF6E8`.

**Safe zones**: nothing at y < 150. Nothing important at y > 1540. **No text at x > 960 for y 900–1560.** The series chip
stays top-left, at y 156–212.

**Content rules**: the sandals carry no brand. No hands of the supplier: objects move by themselves. **No figure anywhere**:
the gauges have no value, and the volume is masked as « • m³ ». The code is « BZ-482913 » with « exemple ». The label
address and phone are blurred. The only address shown is « Foyer Balengou ». No third-party logo.

## Shared geometry: the carton (oblique 3/4 view)
A carton state `st` has a **foot** `(st.x, st.y)`: the middle of its front face's bottom edge, where it touches the table.
It also has `w, h, d` (front width, front height, depth) and a scale `s` (plus `sx`, `sy` squash about the foot).
`SCORE.cartonGeo(st)` returns the screen corners every module must agree on:
- `FTL FTR FBR FBL`: the front face, an axis-aligned rectangle;
- `BTL BTR`: the back-top corners. The top face recedes up-right by `(d·.30, −d·.50)`;
- `BBR`: the visible right side face's back-bottom corner;
- `cx, cy`: the centre of the front face; `top`: the centre of the top face; plus `w, h, d, s` already scaled.

`SCORE.cartonJit(st, t)` → `{x, y, r}` is the shared stop-motion jitter (on twos, scaled by `st.shake`). **Whoever draws on
a carton** (its stamp, label or tag line) applies `translate(j.x, j.y)`, then `rotate(j.r)` about the foot, so that
everything stays glued to the carton.

Layout (`SCORE.G`, world px = screen px at camera 1):
- big carton: foot (520, 1430), 600×340, d 300;
- small carton: 350×220, d 180;
- text-plate zone: centre y 420, plates ≤ 880×410, so y 215–625;
- captions: centre y 430 (Bonzini line: y 602);
- AIR cloud peak: (565, 815);
- margouillat: (112, 1470), mouth near `G.gulpAt` (178, 1422).

---

## M1 « carton & air » (prefix `CA_`)

### `30_carton.js`: `CA_carton(st, pass, t, L)` (+ optional `CA_table(t, L, n)`)
Compose calls it for every entry of `SCORE.cartons(t)`, back to front, **twice**:
1. `pass = 'back'`: the shadow on the table, the back walls and back flaps, and in cut-away mode the interior (floor, walls,
   sandals, hatching, « VIDE »);
2. compose draws the AIR cloud here when it sits inside the carton (`air.inside`);
3. `pass = 'front'`: the right side face, the top face (or the open flaps), the front flank or lid, the tape, the ink.

The state has these fields:
- `id`: `'hero'` (the film's carton, big → small → labelled at Bonzini), `'before'` (AVANT, the big one again in the split
  screen) or `'loop'` (the end card's big closed carton: the image the loop starts from);
- `x, y, w, h, d, s, sx, sy, rot, a`;
- `flaps` 0..1: 0 shut, 1 wide open. **At frame 0 the flaps are already ≈ .8 open, flipping out** (the burst); kraft tape torn;
- `lid` 0..1: **the front flank lifts like a cut-paper lid** (hinged at the top) to show the inside (N3, and the split);
- `sandalsOn`, `sandals` 0..1: 3 unbranded pairs heaped in the left corner (0), then « tête-bêche », tight (1). Pose 1 is
  `A.pose1`: step it on twos;
- `hatch` 0..1: the light-blue hatching sweeps the void, left → right (`A.hatch0`→`A.hatch1`). `vide` 0..1: the « VIDE »
  label on it (Stencil, sea blue, big);
- `squeeze` 0..1 (`A.pose2`): **the walls close in** and `w, h, d` shrink to the small carton around the sandals; after
  that the lid and flaps shut;
- `tape` 0..1 (`A.pose3`): **kraft tape** runs from edge to edge across the top. This is the ASMR moment: show it big and
  crisp;
- `m3`, `m3k` 0..1: the « AU m³ » stamp hits the front face at `A.stampM3` (`m3k` = impact progress). **Orange starved ink
  on the flank. You take over the `'m3'` text: draw it.** It goes away with the flank when the lid lifts;
- `marks[3]` 0..1: the felt-pen line along each measured edge (L, l, H), drawn by `CA_measure` or by you;
- `label` 0..1: Bonzini's label. **M2 draws it** (`BZ_onCarton`); leave the front face clean;
- `shake` 0..1 (burst, crush, loop tremble), `tremble` (loop carton, 0 → 1 over the last .55 s), `writeTag` (M2).

`CA_table(t, L, n)` is optional. It is the packing-table dressing: a roll of kraft tape, a cutter, a pencil, paper scraps,
**outside** the action zones (keep x < 200 or x > 900 for y 700–1400 free, and stay clear of the margouillat). If you
define it, you also draw the paper itself: `ctx.drawImage(TEX.table, -60, -60, W + 120, H + 120)`, larger than the frame
because the camera pushes and shakes.

### `32_air.js`: `CA_air(st, t, L)`
`st = SCORE.air(t)` = `{x, y, s, sx, sy, rot, a, burst, mood, frozen, deflate, inside, tag: {sw, a}}`.
- **This is the hero.** It is a big paper cloud « AIR » (Stencil 900, sea blue). **It is already bursting out at frame 0**
  (it peaks at `A.burstPeak`, puffing up) and floats proud above the open carton.
- It hangs its tag **« À PAYER »** (`priceTag` + `handText`, no amount) on an **orange string**, swinging by `tag.sw`.
  Keep the tag inside x ≥ 40: flip it to the right when the cloud is on the left (`G.cloudAside` during the measure).
- `mood`:
  - `'proud'`: the hook;
  - `'content'` (« content de lui »): it settles into the void, `inside = true`, drawn between the carton passes;
  - `'nervous'`: the repack; it is squeezed out of the carton at `A.pose2`;
  - `'fleeing'`: from `A.chase` it is chased, deflates (`deflate` 0→1) and flies to the margouillat, who gulps it at
    `A.gulp`. Finish the last approach on `K_mouth(t)` if `typeof K_mouth === 'function'`.
- `frozen` is true during TOI's realisation (`A.cut` → `T.N4`): everything stops, so no bob, and only a tiny sweat bead.
- **Key image to validate first: the cloud and its « À PAYER » at 0.3 s** (the A/B cover frame).

### `34_plates.js`: `CA_plate(kind, st, t, L)` + `CA_fx(t, L)`
`SCORE.plates(t)` returns, for each plate, `{kind, x, y, s, sx, sy, rot, a, lines[], emph, crush, sweat, shake}`. The centre
is (x, y); apply translate, rotate `rot`, scale `s·sx, s·sy`. Nominal sizes are in `G.plateH` (title 410, toi 250,
bateau 360, toiSmall 300); the width is ≤ 880.

The material is **« carton épais »**: a variant of pas-recu's `30_plates.js`
(`R/media/bonzini-cargo-reel/pas-recu/overlay/scenes/30_plates.js`). It is thick corrugated cardboard: the visible
fluted edge, a printed or painted face, real thickness, a contact shadow. The text is always crisp vector.

| kind | plate | text | timing |
|---|---|---|---|
| `title` | orange printed cardboard | `DANS CE CARTON,` / `TU PAIES` / `DE L'AIR.`: the last line is 170 px, the others ~84 px; Satoshi 900, cream | at rest from frame 0, leaves at `A.titleOut` |
| `toi` | amber cardboard | `MAIS MON CARTON` / `EST LÉGER !` (~96 px, dark brown) | pops up with a rebound at `A.toiUp`; trembles under the incoming shadow (`shake`); **crushed at `A.bateauFall`** (`crush` 0..1) |
| `bateau` | grey-kraft heavy board | `AU BATEAU, ON PAIE` / `LA PLACE :` / `LE MÈTRE CUBE.` (`emph` = 1 → orange) | falls on « place » and stays until `A.bateauOut`. The grey pill « LE BATEAU » is drawn by type at its top-right |
| `toiSmall` | small amber plate, **sweating** (`sweat`) | `…J'AI PAYÉ LE BATEAU` / `POUR TRANSPORTER` / `DE L'AIR ?!` (≥ 58 px on screen) | `A.toiSmall` → `A.toiSmallOut`, the camera pushes slowly onto it |

The « TOI » pills are drawn by the type layer under the toi plates: leave room for them.

`CA_fx(t, L)` draws the effects:
- at `A.bateauFall` the letters of TOI's plate **gush out** from under LE BATEAU, like the splash in pas-recu
  `32_letters.js`, with dust;
- the sweat drops of `toiSmall`;
- a dust puff at `A.stampM3` and at each tape « clac ».

### `36_measure.js`: `CA_measure(tp, fm, t, L)`, `CA_split(sp, t, L)`, `CA_glass(gl, t, L)`
**`CA_measure`**, the silent 2 s: `tp = SCORE.tape(t)` = `{edges[3]: {name, p0, p1, k, mark, on, t0}, cur, head}` and
`fm = SCORE.formula(t)` = `{words[3], box, sub, a}`.
- The tape measure (`kit tapeMeasure` as a base) **claps 3 times**: it extends along LONGUEUR (front bottom edge), LARGEUR
  (top receding edge), then HAUTEUR (front right edge). `k` is the extension; the clack is at `t0`, then it snaps back.
- A felt-pen line (`mark`) marks each side.
- **You take over the texts `'formula'` and `'formulaSub'`**: « LONGUEUR / × LARGEUR / × HAUTEUR » appears word by word
  on each clack (`words[i]`), is stamped and boxed at `A.formula` (`box`), and « le carton entier » is handwritten (`sub`).
  Place it in the top zone (y 225–670), Stencil ≥ 96 px, orange. Optionally each word flies from its edge to the formula.

**`CA_split`**, AVANT / APRÈS (N5): `sp = SCORE.split(t)` = `{k, x, gaugeL, gaugeR, labels}`.
- Draw a torn-paper divider at x 540.
- **You take over `'avantApres'`**: the labels « AVANT » and « APRÈS » at `G.split.L` / `G.split.R`, y `G.split.labelY`.
- Draw two **horizontal m³ gauges with no figure** at y `G.split.gaugeY`: a long one under AVANT (`G.split.gaugeL`) and a
  short one under APRÈS (`G.split.gaugeR`), filling with `gaugeL` / `gaugeR`. Only « m³ » is written on them.
- The two cartons come from `SCORE.cartons(t)`: AVANT is `id 'before'`, a cut-away with its void hatched; APRÈS is the hero,
  small, cut-away, full.

**`CA_glass`** (N6): `gl = SCORE.glass(t)` = `{x, y, s, wrap, pop}`. It is a pictogram of a glass (a cut-paper silhouette)
that **bubble wrap wraps around** (`wrap` 0..1), with a few bubbles popping (`pop`). It sits beside the small carton.

---

## M2 « Bonzini & end » (prefix `BZ_`)

### `70_bonzini.js`
**`BZ_band(st, t)`** (screen): `st = SCORE.band(t)` = `{in, out}`. **You take over `'ensuite'`.** A kraft band
« ENSUITE : » cuts across the frame (Satoshi 900, ≥ 120 px) and slides in and out; it is silent. The fixed pill
« CHEZ TON FOURNISSEUR » drops off at the same moment (the type layer draws it).

**`BZ_atmos(t, L)`** (screen, after the world, before the type): **the violet light switches on** (`L.violet` 0..1 from
`A.violet`, lower at the end card, 0 in the last frames for the loop). Make it a lamp or pool from above, not a flat wash:
the text must stay readable.

**`BZ_onCarton(st, t, L)`** (world, right after the hero carton's front pass whenever `st.label > 0`): **the blue sea
label** goes on the front face (`SCORE.cartonGeo(st)`, plus `SCORE.cartonJit`). It is the real Bonzini label of
`src/lib/shippingLabelCanvas.ts` (kit `shipLabel(w, h, 'sea', 'BZ-482913')` as a base): a plain blue band with a ship,
QR, « BZ-482913 » and **« exemple »** readable, and the **address and phones blurred** (`softPath` bars). The label slaps
on at `A.label`.

**`BZ_scene(b, t, L)`** (world): `b = SCORE.bz(t)` = `{carton, geo, scanner: {x, y, k}, beam, beep, tape, readout, air,
measured, out}`. This is the reception in China, in stop-motion. Draw:
- the scanner (kit `scanner()`) sliding in from the right, with a **violet laser** `beam` on the label at `A.scan`;
- the tape measure along the carton (`tape`) at `A.tape`;
- the readout ticket **« VOLUME : • m³ »** (masked, no figure) at `G.bz.readout` (`readout` 0..1). **You take over
  `'volume'`**;
- the mini « AIR » cloud at `G.bz.air` (`b.air` = `{x, y, s, strike}`), **struck through** at `A.airStrike`;
- the stamp **« MESURÉ ✓ »** (violet, at `A.measured`; `measured` = impact 0..1). **You take over `'measured'`.**

Keep it to 3 text blocks at once: the enamel plate, the caption « TES CARTONS, MESURÉS DÈS LA RÉCEPTION EN CHINE » (type,
y 510–690) and the readout with its stamp. The label code counts as the legal mention.

**`BZ_plate(st, t, L)`** (world): `st = SCORE.bzPlate(t)` = `{x, y, s, sx, sy, rot, a, sweep}`. This is the **violet
enamel plate « BONZINI TRADING CARGO »** (glossy enamel, logo via `drawLogo`, cream letters, a reflection `sweep`). It lands
on the word « Bonzini » (`A.plateBZ`), with the balafon signature, at `G.bz.plateY` (y 330, ≤ 880×210), and leaves at the end
card.

### `76_end.js`: `BZ_end(st, t, L, space)`
`st = SCORE.endcard(t)` = `{k, service, cta, stamp, tag, out}`. Compose calls it twice: `space = 'world'` inside the
camera, and `space = 'screen'` after the world. **You take over `'brand'`, `'service'`, `'stampEnd'`, `'cta'` and `'tag'`.**
Read each text from `SCORE.TEXTS()` (id, text, t0, t1); the layout is `G.end`:
- **screen**:
  - the logo and « Bonzini Trading Cargo » (y 300);
  - « Groupage mer et air · Chine → Douala » / « Entrepôt : Foyer Balengou » (y 404 / 462, ≥ 44 px; draw « → » as a
    shape);
  - the orange stamp **« MAINTENANT, / TU SAIS. »** (y 676, at `A.stampEnd`, held until `A.out`);
  - the amber CTA pill **« Écris CBM en commentaire »** (y 908, ≥ 56 px) with **a drawn arrow ↓**. It bounces once at
    `A.cta`;
- **world**: « Tague celui qui / remplit ses cartons / de papier », **written in marker on the loop carton's front face**
  (`SCORE.loopCarton(t).writeTag`, apply `cartonJit`).

**The loop**: from `A.loop` the big closed carton trembles harder and grows back to its frame-0 size and place. At `A.out`
(T.end − .12) every end text is gone, so the last frames are the carton alone (and the chip). Frame 0 reopens it.

---

## Key times (defaults; read `SCORE.A`; `node -e "console.log(require('./overlay/scenes/01_score.js').A)"` from E)

**Voices**: N1 .1 · T1 2.4 · N2 4.2 · N3 9.1 · T2 12.0 · N4 15.3 · N5 18.8 · N6 21.3 · N7 24.4 · N8 29.3 · end 32.5.

**Actions**:
- hook: burstPeak .50 · titleOut 2.15 · toiUp 2.30;
- the crush: bateauShadow 4.35 · **bateauFall 5.20** (« place ») · **stampM3 6.35** (« cube ») · bateauOut 6.85;
- the measure: **clacks 7.20 / 7.70 / 8.20** · formula 8.60 · formulaOut 9.75;
- the void: flank 9.00 · hatch 9.40 → 10.68 · capVide 9.85 · vide 10.78 · cloudSettle 10.98;
- TOI's realisation: **cut 11.80** · toiSmall 11.95 → 15.15;
- the repack: **pose1 15.85 · pose2 16.90 · pose3 17.75** · chase 17.95 · **gulp 18.50**;
- AVANT / APRÈS: **split 18.70** · gauges 18.90 → 19.60 · hic 20.15 · splitOut 21.15;
- the glass: glass 21.35 · wrap 22.35 → 23.20;
- ENSUITE: **ensuite 23.70** → 24.35;
- Bonzini: **violet 24.25** · label 24.55 · sig 24.60 · **plateBZ 24.65** · capBZ 26.00 · scan 26.30 · tape 26.65 ·
  volume 27.05 · airStrike 27.35 · **measured 27.65**;
- end: **endcard 29.15** · cta 29.30 · **stampEnd 31.10** · loop 31.95 · out 32.38.

**Suggested test times**: 0, .3, .5, 2.9, 5.25, 5.5, 6.4, 7.25, 8.3, 8.9, 10.9, 13.0, 15.9, 16.95, 17.8, 18.3, 19.8, 22.8,
24.0, 24.7, 26.4, 27.1, 27.9, 30.0, 31.6, 32.45.

## Report to the lead
Report your files, the exact API you implemented, any SCORE field you need that does not exist (ask, do not patch the
score), your cost per frame, and the known limits. Keep one check sheet in `E/out/` and delete your test frames.

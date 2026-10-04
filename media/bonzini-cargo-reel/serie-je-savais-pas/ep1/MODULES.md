# « JE SAVAIS PAS. » · 1/5 — « TCHAC ! » — module guide (read fully before drawing)

> **v1 brief (31.5 s, v1 voice and texts).** Since the v2 « voix claires » the on-screen texts, the keyword (**CALCUL**),
> the defaults (44.54 s) and the anchors are those of `SCRIPT_V2.md` §2/§6 and `README.md` (« v2 — what changed », « T / W
> anchors »). Times and texts quoted below (« IL GAGNE COMBIEN ? », « INVENDABLES », « DÈS GUANGZHOU », « Écris TCHAC… »)
> are v1 history; the layout, module API and colour rules still hold.

Root `E = <scratchpad>/serie/ep1`. Storyboard: `<scratchpad>/serie/SERIE.md` (« Épisode 1 », « Ce qui revient dans chaque
épisode », « Règles de fabrication communes »). Brief rules: `<scratchpad>/serie/BRIEF.md`. Contract: `<scratchpad>/serie/PIPELINE.md`.

The film (31.5 s by default, re-timed later on the real voices): a stylised 10 000 F SPÉCIMEN note — one pair of sneakers
sold 10 000 F at Mboppi, bought 5 000 F in China — is cut live by orange tailor's scissors, TCHAC after TCHAC, into four kraft
envelopes FOURNISSEUR −5 000 · TRANSPORT −1 000 · DOUANE −3 000 · PETITS FRAIS −500, then a shoe box with two LEFT feet takes
the last −500. The calculator « RESTE SUR LE BILLET » falls 10 000 → 5 000 → 4 000 → 1 000 → 500 → 0. Giant stamp « PRIX CHINOIS
× 2 = 0 ». The rule: « COMPTE TOUT. AVANT DE FIXER TON PRIX. », the pile « TOUT CE QUE TU PAIES → TON VRAI PRIX ». Then violet
light: Bonzini Trading Cargo weighs and measures the carton from Guangzhou; end card, « MAINTENANT, TU SAIS. », CTA, loop.

**THE #1 RULE: one view, no sound.** A Mboppi trader scrolling past, sound off, must read every key sentence. Text big
(≥ 44 px body, ≥ 96 px titles, ≥ 100–120 px figures), crisp, opaque background (paper, plate, LCD), held ≥ 1.4 s (the score
already holds them — do not shorten), ≤ 3 text blocks at once (+ « EXEMPLE FICTIF »).

## Engine (read-only, lead)
- `overlay/engine.html`, `overlay/kit.js` (Kraft & Fil kit, identical to prix-de-revient): `clamp, lerp, prog, eOutCubic,
  eInOutCubic, eOutBack, spring, drop, stepT(n), jit(id,n), rnd(i), withShadow(h,fn), rrect, at(x,y,r,sx,sy,fn), tornLine, text(s,x,y,o),
  font(fam,size,wght), measure, stampText(s,x,y,f,color,{box,boxW,h,starve,ls,alpha}), carton, shipLabel, qr, iconShip, iconPlane,
  paperNote, ticket, chip, drawLogo(x,y,size,{alpha,offsets}), scanner, laser, scaleDevice(w,k), tapeMeasure(len,k,vertical), makeCanvas`,
  textures `TEX.table`, `TEX.kraft` (pattern), `TEX.starve`. Colours `C.*` (careful: `C.violet` = brand only), fonts `FF.stencil`
  (Big Shoulders Stencil), `FF.body` (Bricolage), `FF.mono` (Martian Mono), `FF.hand` (Shantell, felt pen), `FF.brand` (DM Sans),
  plus `Satoshi` (400/500/700/900) and `CaveatBrush` by name.
- `overlay/scenes/00_money.js` (prix-de-revient money props, read-only): `M` colours, `fmtN(n)` → « −1 000 » (use it for every
  amount), `banknote(w,h,{value,clip:[x0,x1],serial,alpha})`, `scissors(open,col)`, `calculator`, `shoeBox(w,h,{label,band,lift})`,
  `sneaker(w,{color,accent,lift})`, `priceTag(w,h,fn,{string})`, `handText(s,x,y,size,{write,strike,color,align,pen})`,
  `handArrow(ctrl,p,col,w)`, `handCircle`, `marker`, `postIt(w,fn)`, `coin`, `plate`, `notebook`. Copy any of them into your
  file under your prefix if you need to change them (never edit 00_money.js). **Defaults that are violet** (`sneaker` color,
  calculator `C` key, `chip` check): override them — **no violet before `A.brandIn`**.
- `overlay/scenes/01_score.js` — **THE SCORE** (lead, read-only). `SCORE.T` = voice starts, `SCORE.A` = every action time
  (derived from the voices), `SCORE.G` = layout, and one pure state function per object (below). **t is in seconds** (float: motion
  blur samples sub-frames, and t can be slightly negative at frame 0). **Never hard-code a time or a position: read `SCORE.A.*` /
  `SCORE.G.*` / the state.** The lead re-times everything on the real voices (`data/timing.json`), so any literal time will drift.
- `overlay/scenes/02_light.js` — daylight API (same signatures as « PAS REÇU. »): `lit(hex,x,y,L,bias)`, `lightAt`, `castShadow`,
  `softPath(path, blur, color)` (fast blurred fill). **Never `ctx.filter`** (25 ms per call here).
- `overlay/scenes/40_gecko.js` — the margouillat (validated rig, adapted). `overlay/scenes/60_type.js` — chip, « EXEMPLE FICTIF »,
  price tag + « ACHETÉE 5 000 F EN CHINE » stamp, TOI cards/pills, « IL GAGNE COMBIEN ? », « Tu dis combien ? ↓ », rule band,
  Bonzini band, end-card fallbacks.
- `overlay/scenes/50_compose.js` — camera + draw order; **calls your functions if they exist, else draws its fallback**. Read it:
  it shows exactly when, in which order and with which state you are called. Your function replaces the fallback entirely.
- `L = SCORE.light(t)` = `{x, y, on: .6, violet: 0..1}` (violet ramps up at `A.brandIn`, back to 0 during the loop).
  `n` = integer frame (use it for « on twos » poses: `stepT(n)`, `jit(id, n)`).

## Layout (`SCORE.G`, world px = table coordinates; the camera pushes/shakes around them)
| zone | where | what |
|---|---|---|
| chip + EXEMPLE FICTIF | top-left, y 150–280 (screen space, type) | always |
| headline zone `G.head` (540, 400) | y ≈ 270–540 | sneaker + price tag (hook) · « IL GAGNE COMBIEN ? » · stamp INVENDABLES · Bonzini plate · end card |
| the note `G.note` (540, 760) 860×380 | y 570–950 | the note, the scissors (they hover OVER the note, never above it) · giant stamp `G.zero` · rule band `G.rule` |
| slot `G.slot` (285, 1118) | middle-left | the active envelope / the box / « …zéro ?! » / the pile `G.pile` |
| calculator `G.calc` (765, 1112) 380×250 | middle-right | « RESTE SUR LE BILLET » · then the tag « TON VRAI PRIX » `G.priceTag` |
| TOI card `G.toi1` (765, 1372) | under the calculator | « Facile : 5 000 de bénéfice ! » (type) |
| row `G.row` y 1436, xs 330…905, s .4 | bottom | done envelopes + box |
| margouillat `G.gecko` (112, 1420) | bottom-left | + his two crumbs `G.crumbs` |
Safe zones: nothing at y < 150; nothing important at y > 1540; **no text at x > 960 for y 900–1560**.

## Key times (default timing — they WILL move; print the current ones with
`cd E/overlay && node -e "const S=require('./scenes/01_score.js'); console.log(S.A)"`)
cut1 0.93 · slide1 1.2–1.8 (stop-motion on twos) · stampBuy 1.4 · challenge 2.85 · envT 4.9 · amtT 5.5 · cutT 6.4 · envD 7.0 ·
amtD 7.6 · sticker 8.1 · cutD1 8.6 · cutD2 8.9 · envF 9.7 · amtF 10.3 · doodles 10.65–11.13 · cutF 11.4 · boxIn 12.0 · lid 12.2 ·
feet 12.42 · stampInv 13.0 · cutI 14.9 · musicCut 15.4 · zeroFall 15.7 → zeroStamp 17.8 · rule1 19.65 · stack 19.8…21.8 ·
pileLabel 20.05 · rule2 21.65 · arrow 22.1 · priceTag 22.65 · brandIn 23.18 · plate 23.6 · cartonIn 24.75 · scan 25.2 · weigh 25.9 ·
stampPese 26.2 · measure 26.35 · stampMes 26.8 · endcard 27.8 · cta 27.95 · gulps 28.5/29.0 · ritual 29.6 · loop 31.0 → end 31.5.

## Modules (one owner each, one file each; prefix every global with your key; functions only — never `registerScene`
except in your own `98_test_<key>.js`; never declare a top-level `const`/`let`/`function` without your prefix: kit.js already
owns `W, H, FPS, C, FF, TL, M, ctx…`)

### M1 — « money & cuts » · `overlay/scenes/20_money.js` · prefix `MC_`
All world space (inside the camera). Signature of every call: `MC_xxx(state, t, L, n)`.
- **`MC_note(st, t, L, n)`**, `st = SCORE.note(t)` = `{x, y, s, sx, sy, rot, w: 860, h: 380, off, from, visible, pieces[], outline,
  cutLines, reform, crumbs}`. Draw, in note-local coords (`at(st.x, st.y, st.rot, st.s*st.sx, st.s*st.sy, …)`):
  1. `outline` 0..1: the pencil dashed outline of the whole note (where the money was);
  2. if `visible`: translate by `st.off`, then the part still attached = local x ∈ [`st.from·w − w/2`, `w/2`] (clip);
  3. `cutLines` 0..1: pencil cut marks at `SCORE.EDGES[1..5]` (fractions .5 · .6 · .75 · .9 · .95) on the part still attached;
  4. `st.pieces[]` = flying (or, during the loop, re-forming) slices `{i, a, b (fractions of the width), x, y, s, rot, alpha, k,
     reform}` — draw slice [a, b] centred on (x, y). Pieces 2 and 3 are the two DOUANE strokes.
  **NEW**: the stylised note must carry a clear, readable **SPÉCIMEN watermark** (big, diagonal, part of the paper, not a sticker)
  and must never look like a real BEAC note. « 10 000 » readable at a glance from frame 0. Paper slices: torn/cut fibres on the
  cut edge, a little curl while flying, a contact shadow on the table. Satisfying ASMR cut = the hero of the hook.
- **`MC_scissors(st, t, L, n)`**, `st = SCORE.scissors(t)` = `{x, y, rot, s, open (0 shut … ~.65), a, snap (s since the last snap,
  −1 before)}`: pivot at (x, y), blades along +x then rotated by `rot` (≈ pointing down the cut line), handles orange
  `hsl(16 100% 55%)`. Snap feel: blades shut on `snap = 0`, a tiny paper burst at the blade tips for `snap < .12`. Drawn above everything
  physical (a high, soft shadow on the note).
- **`MC_sneaker(st, t, L, n)`** (optional), `st = SCORE.hook(t).sneaker` = `{x, y, rot, s}` — the paper sneaker of the hook (blue +
  amber, never violet, no brand). The kraft price tag next to it is drawn by type (TY).
- **`MC_envelope(it, t, L, n)`** for the 4 envelopes, `it = SCORE.item(k, t)` (k 0..3) = `{k, id, label, amount, sub, sticker,
  doodles, x, y, s, sx, sy, rot, a, fill, amountK, art, active, stack, out}`. Size `G.env` 380×250 at s = 1 (the slot);
  s = .4 on the row, .62 on the pile. Kraft envelope, flap, the note peeking out when `fill > 0`, landing squash in sx/sy.
  - label (`FOURNISSEUR`, `TRANSPORT`, `DOUANE`, `PETITS FRAIS`) ≥ 52 px at s = 1;
  - `amountK` 0..1 = the amount written in orange felt pen, `fmtN(it.amount)` → « −1 000 », ≥ 90 px at s = 1;
  - `art` 0..1: TRANSPORT = felt-pen **lorry + boat** drawn stroke by stroke; DOUANE = the **yellow sticker « exemple · dépend du
    code du produit »** slapped on (`it.sticker`, ≥ 30 px, readable: it is the legal mention of the douane figure); PETITS FRAIS =
    four felt-pen **doodles « taux · pousseur · taxi · crédit »** (`it.doodles`), one per quarter of `art` (a tiny drawing + the word).
  - Envelopes are kraft: no violet, no logo, no customs officer, no third-party brand.
- **`MC_box(it, t, L, n)`**, `it = SCORE.item(4, t)` + `{lid 0..1, feet 0..1, boing {sx, sy} | null}`, size `G.box` 400×250: the
  shoe box, lid off (`lid`), **two LEFT sneakers** inside (`feet`) — make the gag unmistakable in one glance (same shoe twice, same
  side; « G » « G » felt marks or a small doodle). The last slice of the note lands in it at `A.cutI + .5` (`fill`). Then it flies
  to the row and onto the pile like the envelopes.
- **`MC_calc(st, t, L, n)`**, `st = SCORE.calc(t)` = `{x, y, s, rot, a, value, label, ask, zero, flash}`, 380×250 around (x, y): a
  sturdy dark calculator/LCD, label « RESTE SUR LE BILLET » (≥ 25 px), the figure `fmtN(value)` + « F » ≥ 100 px (it already rolls
  — just print `value`), `ask` = TOI's « 5 000 ? » (two slow blinks, < 3 Hz), `zero` 0..1 → « 0 F » in red, `flash` 0..1 on every
  change. Keep the digits' right edge at x ≤ 950.
- **`MC_stamp(st, t, L, n)`** for `SCORE.stamps(t)` items `{id, text ('|' = line break), sub, x, y, rot, s, k (0..1 landing), a, eqK,
  landed {sx,sy}}`:
  - `id: 'invendables'` (headline zone): orange rubber stamp « 5 PAIRES SUR 100 : » / « INVENDABLES » (≥ 96 px) + its sub-line
    `st.sub` « leur coût retombe sur les autres paires : −500 » (≥ 44 px, ink, on paper). Lands on `A.stampInv`.
  - `id: 'zero'` (centre, over the empty outline): the giant **« PRIX CHINOIS × 2 » / « = 0 »**; it falls in slow motion from
    `A.zeroFall` (s 1.1 → 1, its shadow tightening) and prints « = 0 » on « zéro » (`eqK`), then `landed` squash. Max 900 px wide.
- **`MC_pile(st, t, L, n)`**, `st = SCORE.pile(t)` = `{x, y, label, labelK, arrowK, tag, tagK, tagX, tagY, a}`: the envelopes are
  already stacked by the score (drawn by your `MC_envelope`/`MC_box` with `stack` → 1). You draw the label « TOUT CE QUE TU PAIES »
  (`labelK`, above the pile at ≈ (x, y − 250), ≥ 52 px), the felt-pen arrow pile → tag (`arrowK`), and the kraft price tag
  « TON VRAI PRIX » at (tagX, tagY) (`tagK` = spring, may overshoot 1).
- **`MC_crumb(c, t, L, n)`** (optional) for `SCORE.crumbs(t)` `{x, y, rot, s, a, i}`: the two bits of the note that fly off at the
  douane cut, wait by the margouillat and are swallowed at `A.gulps[i]` (they shrink into his mouth: `K_mouth(t)` is available).

### M2 — « Bonzini & end » · `overlay/scenes/70_bonzini.js` · prefix `BZ_`
Violet appears **only** here (`L.violet > 0` from `A.brandIn`). No figure anywhere near the brand: no weight, no size, no price, no
date, no number on the dial or the tape (ticks only); the only code is the fictional `BZ-000000`. Bonzini is cargo: never a
customs agent, never a payment here. Services named: groupage mer et air, Chine → Douala, pesé et mesuré dès Guangzhou.
- **`BZ_light(t, L)`** (world, right after the table): the brand light — a violet wash from above + soft pool + violet rim on the
  paper, `L.violet` 0..1. **Return immediately when `L.violet <= 0`** (it is called every frame).
- **`BZ_reception(st, t, L, n)`**, `st = SCORE.reception(t)` = `{carton {x, y, s, rot, lift}, a, scan 0..1, beam 0|1, scanner {x, y,
  rot, a}, scale {x, y, a, needle 0..1.3}, tape 0..1, pese 0..1, mesure 0..1}` (already quantized on twos: stop-motion):
  a kraft carton (≥ 420 px wide, the series' blue sea label `shipLabel(…,'sea','BZ-000000')`) slides in, passes under the **violet
  scan laser** (`scan` = sweep position, `beam` = the handheld scanner fires, top-right), sits **on the scale** (`scale.needle`
  settles, `carton.lift`), the **tape measure** runs along its edges (`tape`), then the violet stamps **« PESÉ ✓ »** (`pese`, at
  `G.stamps.pese`) and **« MESURÉ ✓ »** (`mesure`, at `G.stamps.mesure`), ≥ 72 px. Everything leaves with `a`.
- **`BZ_plate(st, t, L, n)`**, `st = SCORE.plate(t)` = `{x, y, s, sx, sy, rot, a, k, sweep}` at `G.head`: the glossy violet enamel
  plate **« BONZINI TRADING CARGO »** with the logo (`drawLogo`), lands on « Bonzini » (`k`, squash), `sweep` = a reflection
  crossing the enamel. ≤ 900 px wide, « BONZINI » ≥ 96 px.
- **Screen space, called by `TY_draw` when you define them** (else the type fallbacks draw them), `E = SCORE.endcard(t)` = `{k,
  logoK, nameK, lineK, ritualK, ctaK, shareK, a}` (`a` fades everything for the loop), positions `G.end.*`:
  - **`BZ_endcard(E, t, L, n)`**: the logo (spring `logoK`), « Bonzini Trading Cargo » (`nameK`), « Groupage mer et air · Chine →
    Douala » (`lineK`, ≥ 44 px).
  - **`BZ_ritual(E, t, L, n)`**: the series ritual stamp **« MAINTENANT, TU SAIS. »** (`ritualK`, orange stamp, ≥ 96 px) — identical
    look in the 5 episodes: make it a reusable function.
  - **`BZ_cta(E, t, L, n)`**: the amber pill **« Écris TCHAC en commentaire »** (`ctaK`, bounces once) with a **hand-drawn arrow ↓**,
    and the share line « Partage à l'ami qui fait encore × 2 » (`shareK`, ≥ 44 px) under it (keep it clear of the arrow).
- **`BZ_loop(k, t, L, n)`** (screen space, last call of the frame), `k = SCORE.loop(t)` 0..1 over [`A.loop`, `T.end`]: the loop
  seam. The note re-forms from six slices flying back in (positions from `SCORE.note(t).pieces` with `reform: true`, drawn by
  `MC_note`); the sneaker, price tag and scissors return (score). Add the polish (paper whoosh, a « click » when the slices meet) and
  **check that the last frame (N − 1) matches frame 0** (render both, diff them). If the re-form choreography itself must change,
  ask the lead (the score is lead-owned).

## Look
Kraft & Fil, day: cream paper table seen from above, cut-paper props with real thickness, soft warm contact shadows
(`withShadow`, `castShadow`), stop-motion « on twos » for touched objects (`stepT`, `jit`), smooth for flights and springs.
Colour roles: **orange** `hsl(16 100% 55%)` = the cuts, scissors, stamps, alerts · **amber** `hsl(36 100% 55%)` = TOI (merchant)
· **violet** `hsl(258 100% 60%)` = Bonzini only · ink `#231629` on cream. Premium, tactile, cinematic — not PowerPoint.
Facts: only the episode's fictional example (5 000 · 1 000 · 3 000 · 500 · 500 → 0); « EXEMPLE FICTIF » stays on screen.

## Rules
- Determinism: never `Math.random`/`Date`: `rnd(seed)`. Pure functions of (t, n, state).
- Performance: cache static sprites in offscreen canvases (`makeCanvas`, built lazily, keyed); a frame (all modules) must stay
  < 60 ms at MB 1 (the final render averages 6 sub-frames). Today the whole frame with fallbacks ≈ 0.7 s at MB 6.
- Do not edit files you do not own (`kit.js`, `00_money.js`, `01_score.js`, `02_light.js`, `40_gecko.js`, `50_compose.js`,
  `60_type.js`, `render.mjs`). Need a new state field or a time? Ask the lead.

## Check your work (mandatory)
```bash
cd E/overlay
# M1 (only your module + the shared layers; the other module may be mid-edit):
nice -n 5 node render.mjs --scenes 20_money,40_gecko,50_compose,60_type --times 0,1.5,3.6,6.7,8.0,9.2,10.9,12.8,13.6,15.2,16.4,18.0,20.4,22.9 --out ../out/chk_mc --pages 2 --jpg
# M2:
nice -n 5 node render.mjs --scenes 70_bonzini,40_gecko,50_compose,60_type --times 23.4,24.2,25.3,25.95,26.5,27.4,28.4,29.9,31.1,31.47 --out ../out/chk_bz --pages 2 --jpg
python3 ../lib/sheet.py ../out/chk_mc ../out/chk_mc_sheet.jpg 7
```
(Pick your times from `S.A` — the defaults above move when the lead re-times.) LOOK at every still: full size, crops, and a
360 px-wide downscale (phone at 50 % brightness). Iterate until premium and readable. Check one frame with `--mb 6`. Delete
your `98_test_*` file and the `chk_*` frames at the end (keep one sheet). CPU is shared (4 cores): `--pages 2` max, `nice -n 5`.
Report: file, exact API you implemented, what it looks like, known limits.

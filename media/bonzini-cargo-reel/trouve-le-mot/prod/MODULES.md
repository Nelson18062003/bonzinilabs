# « TROUVE LE MOT. » — module contract (M1 chrono + ring, M2 Bonzini card)

`P = rush1/prod`. The skeleton is done and renders the whole film with plain stand-ins; your module replaces a
stand-in as soon as its function exists. **Do not edit** `01_score.js`, `05_rush.js`, `50_compose.js`, `60_type.js`,
`engine.html`, `render.mjs`, `kit.js` — if you need a new state or anchor, ask the lead (it goes in the score).

## Rules for every module file
- One file per module in `P/overlay/scenes/`, **functions only** (no `registerScene`): `50_compose.js` calls you.
- Own IIFE scope (kit.js already declares `W H FPS C ctx rnd lerp clamp text …` as globals; top-level `const` collides).
  Export only the function names below (`function CH_chrono(…) {…}` at top level, the rest inside your IIFE).
- Every state is a **pure function of t** (seconds, float: motion blur draws sub-samples of a frame; `n` = the integer
  frame, use it for on-twos boil / jitter). Deterministic: `rnd(i)` from kit.js, never `Math.random` / `Date`.
  **Never `ctx.filter`** (25 ms a call): use `softPath()` (02_light.js) or `shadowBlur`.
- Read times from `SCORE.A / SCORE.T / SCORE.TICK` and the state object you are given — **no literal action time**: the
  lead re-times everything on the real TTS takes (`data/timing.json` → the score's chain recomputes all of A).
- Cache static looks in offscreen sprites (`makeCanvasCached(key, w, h)` from kit.js).
- Colours: `SCORE.COL` = violet `#A947FE` (+ `violetD #7B22D6`), amber `#F3A745`, orange `#FE560D`, ink `#231629`.
  **Violet only with Bonzini** (the ellipse, the arrow, the plate). Fonts declared and preloaded: Satoshi 400/500/700/900,
  Shantell 700/800, Kalam, CaveatBrush, PatrickHand, GochiHand, Brico, Stencil, Martian, DMSans, Bangers.
- Safe zones: nothing above y 150; **no text right of x 960 for y 900–1560**; nothing important below y 1540.
- Brief rules: never redraw / retouch the real label's letters (the ellipse goes AROUND the white card, never on the
  letters); nothing drawn on the employee; no third-party brand; every string exactly as `SCORE.TEXTS()` writes it.

Check your work alone or with everything:
```
cd P/overlay && nice -n 5 node render.mjs --times 9.6,11,13.5,14.6,21 --pages 2 --mb 4 --out ../out/m1 --jpg
cd P/overlay && nice -n 5 node render.mjs --times 16,17,19.1,19.8,20.5 --pages 2 --mb 4 --out ../out/m2 --scenes 72_card,40_gecko,60_type --jpg
node tools/check_score.js            # anchors, contract warnings, cues
```
Look at full size AND at 360 px wide; delete your test frames afterwards (disk is tight). `window.COMPOSE_FB` holds the
stand-ins (`COMPOSE_FB.chrono / .ring / .card`) if you want a side-by-side.

---

## M1 — `20_chrono.js` : `CH_chrono(t, n, st)`
Called last (on top of everything), **screen space**, with `st = SCORE.chrono(tq)` where `tq = n / FPS` (the chrono is UI:
its state is taken at the frame's own time, so a digit never ghosts across a tic; `t` passed = `tq`). `null` → not called.

| field | meaning |
|---|---|
| `x0 x1 y0 y1` | the ring's box: x 840–1010, y 160–350 (§2) · `cx 925, cy 255, r 85` |
| `digitSize` | 110 (px) · `label` = `{y0 355, y1 400, size 44}` for « secondes » (exact string: `TEXTS` id `chronoLabel`) |
| `digit` | number to show. 7 → 0 by whole seconds during the hunt (`7 − floor(t)`); **float during the roll** 0 → 6 (`roll = 1`, `A.rew → A.rew + .5`, eased): draw a rolling counter (digits slide vertically, clipped), never a blink |
| `ring` | fraction of the ring still full, 1 → 0 continuously over 0 … 7 s; 0 at the STOP; refills to 6/7 during the roll |
| `warm` | 0 amber → 1 orange (from TICK(5) = 5.00 « 2 », through « 1 », « 0 » and the STOP; back to amber in the roll) |
| `tick`, `tickAge` | last tic index 0…6 (at `SCORE.TICK(k)` = k s = beats 1 and 3 of the 120 bpm makossa) and seconds since it (a small knock on each tic; `loud = 1` for tics 5 and 6: knock harder) |
| `stopAge` | seconds since the STOP (−1 before): the « 0 » can jolt with the stamp |
| `pulse` | 0 → 1 → 0 bump of .35 s on « début » (`A.pulse = W('N4','debut')`): the « 6 » pulses once |
| `a`, `dy` | exit: fades and lifts 40 px over `A.out → A.out + .2` |

Anchors: `A.chrono0` (0), `SCORE.TICK(k)`, `A.musicIn` (2.00, the music hit), `A.stop` (7.00), `A.rew` (roll start),
`A.zoom`, `A.pulse`, `A.out`. Visible 0 → `A.out + .2` (frame 0 = the cover: full ring, « 7 »). Sound already cued:
`tic_wood` on every tic. Look: amber ring (orange 2-1-0), digit 110 px, « secondes » 44 px, readable at 360 px over the
footage (a dark disc behind is fine).

## M1 — `30_ring.js` : `RG_ring(t, n, st)`
Called right after the rush (under the type), **screen space**, with `st = SCORE.ring(t)` (`null` → not called):

| field | meaning |
|---|---|
| `mode` | `'answer'` (`A.ring → A.whip`, the ×4 freeze), `'follow'` (`A.live → A.card`, the video runs again), `'recall'` (`A.cta → T.end`, R1b + the call) |
| `box` | `SCORE.label(t)` = the **white card** on screen for the picture at t (camera included): `{x, y, w, h, cx, cy, ok, vis, gap, f}`. At ×4: ≈ 456 × 219 centred (540, 1020); live ×1.10 → ×1.16: ≈ 125–132 × 60–63; recall ×1–1.04: ≈ 114 × 55. It moves frame by frame with the hand-held footage (interpolated where the tracker lost it, `ok = false`) |
| `draw` | 0 → 1 trace progress of the felt ellipse (answer: `A.ring → A.ring + .4`; follow: `A.live + .08 → + .38`; recall: `A.cta + .1 → + .4`) |
| `a` | opacity (answer: out with the dezoom `A.out → A.out + .1`; follow: out at `A.card ± .05`) |
| `lw` | suggested felt width: 14 (answer) / 8 (follow) / 7 (recall) |
| `halo` | 0 → 1 violet glow strength (answer: grows `A.ring + .2 → + .6`) — `shadowBlur`, the **first violet on the real image** |
| `arrow` | answer only: `{p, a, t0}`, p = 0 → 1 over `A.arrow → A.arrow + .35` (`A.arrow = W('N4','bonz')`). The arrow goes **from the answer's word BONZINI to the ellipse**: start box = `TY_wordBox('BONZINI')` → `{x, y, w, h, base}` (static, cap height; line 1 of « LE MOT BONZINI / ÉTAIT LÀ / DÈS LE DÉBUT ! », y ≈ 420–510). Lines 2–3 sit below it (y 540–730, centred, ≤ 760 px wide): route the arrow around them (the stand-in leaves from the word's right end, swings out to x ≈ 1010 and lands on the ellipse's top-right) |

Rules: the ellipse surrounds the white card with a margin (the stand-in uses `rx = w/2 + max(26, .13 w)`,
`ry = h/2 + max(18, .2 h)`); it never crosses the letters; « écrit à la main » (60_type) sits under it at y 1200–1260, so
keep the answer ellipse's bottom ≤ ≈ 1185. Felt look (hand-drawn, slight overshoot where it closes, on-twos boil from `n`),
halo by `shadowBlur`. During `follow` / `recall` the box can jump a little frame to frame (real hand-held footage):
follow it exactly (the proof), or with ≤ 2 frames of easing — never lag behind the card. When `box.vis` is false the
score returns `null` (label off screen). Sound already cued: `felt` at `A.ring` (.4 s) and at `A.arrow` (.35 s),
`bonzini_sig` + `focus_click` at `A.ring`.

---

## M2 — `72_card.js` : `BZ_card(t, n, st)`
Called after the ring and before the type, **screen space**, with `st = SCORE.card(t)` for `A.card ≤ t < A.cta`
(15.80 → 20.60 on the defaults; hard cut back to the rush at `A.cta`). **No rush image on the card** (05_rush stops
drawing the footage from `A.card + .26`: your kraft must cover the WHOLE frame by then).

| field | meaning |
|---|---|
| `cover` | 0 → 1 (eased) over `A.card → A.card + .25`: a kraft sheet rises from the bottom and covers the picture (the frozen r 9.62 is under it); top edge = `H·(1 − cover)` in the stand-in (a torn / fibred edge + its shadow is welcome) |
| `plate`, `plateLand` | 0 → 1 over `A.plate − .18 → A.plate` (`A.plate = A.card + .15` = 15.95, the « tonk » and the MAJOR makossa): the glossy violet **enamel plate** lands (logo + « BONZINI TRADING CARGO », `TEXTS` id `plate`), box `G.card.plate` = x 120–960, y 260–520 (reuse ep1 `70_bonzini.js` BZ_plate / prix `65_bonzini.js`) |
| `service` | 0 → 1 from `T.N5 − .05` (+.35 s): « TES COLIS VONT / DE CHINE À DOUALA. » (`TEXTS` id `service`), 96 px, 2 lines, y 580–860 (fit ≤ 900 px wide) |
| `route` | 0 → 1 over `A.route → A.doua` (`A.route = T.N5 + .35`): the felt route in `G.card.route` (x 100–900, y 860–1180): a drawn kraft carton (`G.card.route.carton` ≈ (180, 1030)) → dotted line → … |
| `chine`, `boat` | « CHINE » (52 px, `TEXTS` id `routeChine`) fades in at `A.chine` (= `W('N5','chin')`); the little **amber boat** pops (`boat` = backOut 0 → 1 over .28 s). Point `G.card.route.chine` ≈ (330, 1120) |
| `douala`, `plane` | « DOUALA » (`routeDouala`) at `A.doua` (= `W('N5','doua')`); the little **orange plane** pops. Point `G.card.route.douala` ≈ (790, 1120) |
| `by` | 0 → 1 from `A.by` (= `T.N5 + 1.40`, 17.50): « Par bateau ou par avion. » (`TEXTS` id `by`), 52 px, y 1210–1270 |
| `nod` | seconds since `A.doua` (−1 before) |
| `t0`, `t1` | `A.card`, `A.cta` |

**The margouillat** (only here, never on the real footage): call `K_gecko(t, SCORE.light(t), SCORE.gecko(t))` inside
`BZ_card` (40_gecko.js is loaded through the `39_/41_gecko_*shim.js` pair and binds to `SCORE.geckoShim()`). He sits at
`G.gecko` = (150, 1440) → occupies ≈ x 40–300, y 1360–1530; acts from `SCORE.gecko(t)`: startled `hop` at `A.plate`,
eyes on the plate → the sentence → the carton → CHINE → DOUALA, **head bobs (`pushups`) on « Douala »** for 1 s, then
`smug`. If you need him elsewhere, ask the lead to move `G.gecko` (one place).

Rules: violet only on the plate (Bonzini); boat amber, plane orange; « CHINE » / « DOUALA » are words, not flags; no
city in China; no figure, no price, no date; Kraft & Fil look (`TEX.kraft`, `carton()`, `iconShip()`, `iconPlane()`,
`thread()` / `curve()` from kit.js; props of `serie/ep1/overlay/scenes/70_bonzini.js`, `prix/overlay/scenes/65_bonzini.js`,
`70_outro.js`). Grain is laid over the card by the engine. Sound already cued: `paper_lift` at `A.card`, `tonk` at
`A.plate`, `felt` at `A.route` (.5 s), `pop` + `felt` at `A.chine` and `A.doua`.

---

## M2 — delivered: `72_card.js` (`BZ_card`, 12/10)
- **Sheet**: kraft sprite (fibres, soft mottling, window light top-left, warm vignette, torn top edge with lighter
  fibres + hairs, contact shadow on the photo), tilted −1.6° → flat. Its own **ease-out** on the score's window
  `A.card → A.card + .25` (`st.cover` is in-out and left the plate landing over the photo): full cover from
  `A.card + .19`. Everything on the card (sentence, route, by-line, margouillat) **rides in with the sheet**.
- **Plate** (`G.card.plate`, 840 × 248): ep1 enamel plate re-coloured with `COL.violet / violetD`, logo on a cream
  roundel, « BONZINI » / « TRADING CARGO » = `TEXTS.plate` split after the first word, pinstripe, rivets, glaze.
  Gravity fall on `st.plate` (from above the lens: −700 px, ×1.22, far soft shadow), squash + kraft dust on `A.plate`,
  then a reflection crosses the enamel (`A.plate + .12 → + .8`). The only violet of the card.
- **Sentence**: `TEXTS.service`, Satoshi 900 fitted to 900 px (≈ 84 px), letterpress ink (light lip + 20 % starved ink),
  2 lines pressed in from `T.N5 − .05` (+ .1 s stagger); caps ≈ y 600–790.
- **Route** (box x 100–900, y 860–1180): felt-drawn iso carton at (196, 1000) + « CHINE » under it; a felt target at
  (800, 1000) + « DOUALA » under it (Shantell 800, 52 px, baseline 1128, right edge ≈ 925 after the push: < 960);
  two felt-dash lanes between them — **air** arches to y ≈ 880, **sea** sags to y ≈ 1060 and swells — so « bateau ou
  avion » is drawn. Lanes on `A.route → A.doua` with an ease-out (they start at once and close exactly on « Douala »;
  `st.route` in-out left the carton alone for 1 s). Amber boat sticker pops on the sea lane at `A.chine`, orange plane
  sticker on the air lane at `A.doua` (die-cut cream border, `st.boat / st.plane` backOut), both move on slowly to
  the cut; target pulses on `A.doua`. « Par bateau ou par avion. » (Shantell 700, 52 px, baseline 1254) written on
  left → right over `A.by → A.by + .6`.
- **Margouillat**: `K_gecko(t, SCORE.light(t), SCORE.gecko(t))`, unchanged placement `G.gecko`.
- Slow 2 % push on the whole table `A.plate → A.cta` (about (540, 820)). Exit = the score's hard cut at `A.cta`.
- Cost: 60 card frames at `--mb 6` in 9.7 s on 2 pages (screenshots included). Check sheet: `out/check_m2_360.jpg`.

**For the lead (not in my file):**
1. `sub2` (« Merci de faire confiance… », y 400–640) is drawn by 60_type **over** the card until `A.sub2out =
   A.card + .20` (16.00): its fading box crosses the plate as it lands (y 260–520, visible from ≈ 15.88). Suggest
   `A.sub2out = A.card + .08` (R2's speech ends 15.75).
2. Sound: the felt lanes draw for the whole `A.route → A.doua` (3.2 s on the defaults); the `felt` cue at `A.route`
   (.5 s) could become a longer, quieter drag. The carton is set down at `A.route − .2` (a soft paper tap is optional).
3. At `--mb 6` the sheet's edge, the falling plate and the margouillat riding in show separate motion-blur taps for
   ≈ 3 frames (15.83–15.93): the move is ≈ 180 px a frame; it reads as a fast swipe at 30 fps.

---

## M1 — delivered: `20_chrono.js` (`CH_chrono`) + `30_ring.js` (`RG_ring`), 12/10
Both files keep their code in an IIFE (`window.CH_M1`, `window.RG_M1`) and declare only `CH_chrono` / `RG_ring` at the top
level. They read only `SCORE.A / TICK / chrono() / ring() / label() / TEXTS() / COL / G`, `TY_wordBox('BONZINI')` and
`TY.answerLayout()`. There are no literal action times, no `Math.random`, no `ctx.filter`. Measured cost: about 25 ms a
frame at `--mb 4`.

**Chrono**
- **Watch:** a small dark stopwatch. The disc keeps r 85 at (925, 255), the crown sits at y ≥ 151 and a lap nub is at
  the upper right; all of it stays inside x 840–1010.
- **Ring:**
  - It is cut into 7 one-second segments and empties clockwise like a clock hand, with a bright bead on the moving edge.
  - It turns orange from `TICK(5)`, is empty at the STOP, and refills anticlockwise to 6/7 in the roll, where the hand
    runs back.
- **Digit:**
  - Satoshi 900 at 110 px, changed on the tic frame itself.
  - Each tic gets a knock (−12 px drop-in plus a pop). The loud tics « 2 » and « 1 » get a harder knock and a ±3° jiggle
    of the watch only; « secondes » stays still.
  - The digit is orange from its own tic, so it is never half-tinted on the tic frame.
  - There is no knock on tic 0, so the cover frame is clean.
- **STOP:** the crown is pressed, the « 0 » jolts on a spring, the watch shakes sideways (vertical shake points down only,
  to keep clear of y 150), and one orange shock ring reaches at most 1.22 r.
- **Roll:**
  - A drum: the digits slide upward through the face, faded top and bottom, clipped to the face.
  - A vertical motion streak is computed from the speed of `SCORE.chrono(t ± 1/120)`, because the chrono gets no engine
    motion blur.
  - It never blinks.
- **Pulse:** the « 6 » swells by 22 %, the ring thickens and glows amber, and one amber ripple reaches at most 1.2 r.
- **« secondes »:** the exact `TEXTS` string `chronoLabel`, 44 px, on a soft dark radial scrim. There is no box.

**Ring**
- **Felt pen:** each stroke is one filled ribbon with round caps. Its width varies with:
  - pressure: a touch-down blob, a speed wobble and the lift-off taper;
  - a nib held at an angle, which makes the sides a little wider.

  It also has a radius wobble (4 slow harmonics plus a small spiral, so the end passes just outside the start) and an
  on-twos boil from `n`. Ink pools at the edges and is darker where the pen passes twice, faint nib streaks run along the
  stroke, and a light dark contact shade sits under it. The halo is two `shadowBlur` passes scaled by `st.halo`.
- **Fading:** when `st.a < 1` the stroke is drawn into an offscreen layer and composited at `st.a`, so the stacked passes
  fade as one.
- **Answer:**
  - The shape is measured on the ×4 layer: margin .15 w / .2 h, tilt −.05, the 2nd harmonic leaning along the card's
    diagonal, and the centre moved .02 w to the left.
  - With that shape the white paper's corners stay at least 11 px inside the stroke (the B at least 53 px), and the
    mosaic's far bottom-left corner is just at the stroke's inner edge.
  - Bottom: the outer edge is at most 1180 at ×4 and at ×4.12, with a guard at 1183 that lifts the whole ellipse if
    needed.
- **Arrow** (11 px, the same pen):
  - It leaves from under « …NI » of the answer's BONZINI, swings around the right of « ÉTAIT LÀ / DÈS LE DÉBUT ! » (the
    route is computed from the measured line widths, x ≤ 1030), and lands square on the ellipse's upper right with a
    15 px gap.
  - The shaft is drawn in the first 74 % of `p`, then the head as one V stroke that is heavier at the tip.
- **Follow / recall:** these use `st.box` exactly, which is the box of the picture each motion-blur sample shows. There
  is no easing, so the ellipse never lags the hand-held label.

**Checked** (`--mb 4`, at full size and at 360 px):

| what | times (s) |
|---|---|
| hunt and tics | 0, 0.5, 1.0, 4.97, 5.0, 5.03, 5.07, 6.0, 6.03 |
| STOP | 7.0, 7.07, 7.1 |
| roll | 8.35, 8.37, 8.4, 8.43, 8.45, 8.5, 8.55, 8.57, 8.6, 8.65, 8.7, 8.75, 8.77, 8.8, 8.85, 8.9 |
| ellipse and arrow | 9.5, 9.55, 9.6, 9.65, 9.75, 9.87, 10.3, 10.4, 10.45, 10.5, 10.65, 11, 11.5, 12.0 |
| pulse | 12.75, 12.77, 12.8, 12.85, 12.87 |
| exit | 13.56, 13.57, 13.6, 13.62, 13.7 |
| follow | 13.85, 13.95, 14.0, 14.1, 14.2, 14.3, 14.6, 15.3, 15.5, 15.79, 15.84 |
| recall | 20.62, 20.75, 20.77, 21.0, 21.2, 21.5, 23.0, 23.5, 24, 25.0 |

The ellipse's clearance to the card's corners was also measured numerically (probe) for t 9.9 / 11.5 / 13.54 and all 3
boil states. One check sheet is kept at `out/check_m1_360.jpg`; the test frames were deleted. Nothing was checked on real
TTS timings, because there is no `data/timing.json` yet; both modules only follow the score's anchors.

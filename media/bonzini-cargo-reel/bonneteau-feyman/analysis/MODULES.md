# « Le Bonneteau du Feyman » — module guide (read fully before drawing)

Root `X = <scratchpad>/loop`. The concept and its full storyboard: `X/CONCEPT_FINAL.md` (read §1–§6). **Two decisions
override the dossier**: (1) the brand line is « LE FEYMAN CACHE. / BONZINI TE MONTRE LA PREUVE. » with pills
« Paiement créé ✓ · Fournisseur réglé ✓ · Preuve de paiement ✓ » (cargo tracking is NOT a client feature — never write
« Suivi »); (2) at 12.0 s the violet light comes on and the feyman's arms flinch back up into the dark (they return when the
bulb relights at 14.0 s).

16.0 s perfect loop, 480 frames, 1080×1920, 30 fps. Night market, one tungsten bulb above a table covered with a wax
cloth, seen from the player's side at a high angle. Three mini 10-ft shipping containers (doors facing us) are the shells.
Two white cartoon gloves in wax sleeves (the « feyman », no face, no skin) come down from the top of the frame.

## Engine
- `overlay/engine.html` + `overlay/kit.js` (Canvas 2D helpers: `clamp, lerp, prog, eOutCubic, eInOutCubic, eOutBack, spring,
  rnd(i), rrect, at(x,y,r,sx,sy,fn), text(...)`, `makeCanvas(w,h)`), `overlay/render.mjs` (Chromium, deterministic).
  Global `ctx` is the canvas context of the current frame. Fonts: `Satoshi` (400–900), `Brico` (Bricolage Grotesque),
  `Stencil` (Big Shoulders Stencil), `Martian` (Martian Mono), `CaveatBrush`, `DMSans`, `Shantell`.
- `overlay/scenes/01_score.js` — **THE SCORE** (owned by the lead, read-only for you): `SCORE.G` (geometry), `SCORE.containers(f)`,
  `SCORE.parcel(f)`, `SCORE.hand(side, f)`, `SCORE.cuffOf(side, f)`, `SCORE.light(f)`, `SCORE.camera(f)`, `SCORE.TEXTS`, `SCORE.STEAL`.
  `f` = frame (float allowed: motion blur samples sub-frames). Everything is periodic over 480 frames.
- `overlay/scenes/02_light.js` — **shared light API** (lead, read-only): `lightAt(x,y,L) → {k, v}`, `lit(hex, x, y, L, bias)` →
  the colour as seen under the bulb / in the night / under the violet brand light, `shadowOff(x,y,z,L)`, `castShadow(pathFn, x, y, z, L, strength)`.
  **Every colour you paint on a table object goes through `lit()`** (sample it at the object's centre, or per face with a bias:
  +1 for faces turned to the bulb, −1 for faces turned away). The lead composes everything in `50_compose.js`.
- Determinism: never `Math.random`/`Date`. Use `rnd(i)` with fixed seeds. Grain/noise seeds use `f mod 480`.
- Performance: the final render averages 6–8 motion-blur sub-frames per frame. Cache anything static in offscreen canvases
  (`makeCanvas`) built once (lazily, on first use). A full frame of the whole film must stay under ~60 ms.

## Geometry (from `SCORE.G`, screen px)
- Container c = `{x, y, z, tilt, id}`: `x` centre, `y` = FRONT bottom edge on the table, `z` = lift (screen px up), `tilt` 0..1
  (back edge lifted during the steal). Width `G.cw`=200, roof depth `G.cd`=176 (foreshortened), door face height `G.ch`=118.
  So at rest: door face spans y ∈ [y−118, y]; roof spans y ∈ [y−118−176, y−118]; everything shifted up by z.
  Footprint on the table (for the shadow): x ± 100, y ∈ [y−176, y].
- Parcel: `G.pw`=122, `G.pd`=100, `G.ph`=72 at scale 1 (same oblique convention). `SCORE.parcel(f)` → `{mode, x, y, s, squash, vis}`:
  modes `rise`/`glass` (frames 0–14: near the lens, scale up to 3.4, squashed against the phone glass at f4), `hand` (15–27,
  going back down), `under` (hidden), `slide` (210–217, from under the back edge of c1 into the right cuff), `sleeve` (hidden).
- Hands: `SCORE.hand(side, f)` → `{x, y}` = WRIST point, `pose`, `k` (0..1 progress between two keys; pose switches at k=.5),
  `s` (scale, >1 only in frames 0–27 when the right hand holds the parcel near the lens), `cuffIn` (0 = hand out, 1 = hand fully
  withdrawn into its cuff: frames 466–479 and 0–3). Shoulders off-frame top: `G.shoulder.L/R`. Wrist rest: `G.rest`.
  Side `L` = screen-left glove (wears the gold ring), `R` = screen-right glove (does the steal; the parcel ends up its sleeve).
- Light: `SCORE.light(f)` → bulb x sways ±22–52 px around 520; `on` 1 (bulb), 0 (off, 12.1–14.0 s), flickers 14.0–14.4 s;
  `violet` 0→1→0 over 12.0–14.1 s (brand light from above, even, cool).
- Safe zones: nothing important at y < 150, at y > 1540, or at x > 960 for y 900–1560 (TikTok/Reels UI). Text band y 1300–1500.

## Look (CONCEPT_FINAL §6)
Night indigo `#140C26`; tungsten amber pool; wax cloth in the 3 logo colours (violet hsl(258 100% 60%), amber hsl(36 100% 55%),
orange hsl(16 100% 55%)) on indigo, dying into the dark outside the pool; feyman sleeves in wax **bottle green + mustard + black**
(never the brand colours); containers blue-grey steel with orange-brown rust; gloves warm white `#F4EFE6` with a living ink line
`#1A1426` and soft gouache shading; parcel kraft with a violet ribbon and a hand-written label « MA MARCHANDISE ». Fine grain,
dust in the light cone, deep vignette. Premium, cinematic, tactile — NOT clip-art, NOT flat vector, NOT Kraft & Fil paper cut-outs.

## Modules (one owner each, one file each; prefix every global you create with your key)
- **T — table & atmosphere** `10_table.js`: `T_table(f, L, cam)` (night + far edge of the table + wax cloth + light pool + violet
  wash), `T_atmos(f, L)` (dust motes in the cone, vignette, fine grain — drawn on top of everything, before texts),
  `T_glass(f)` (the phone glass: dust halo where the parcel hit at f4, fading out by f90, one soft reflection streak while it shows).
- **P — props** `20_props.js`: `P_container(c, f, L, o)` (door-end view: corrugated roof, door face with 4 locking rods, handles,
  corner castings, procedural rust seeded by `c.id`, lit faces, its own `castShadow`; `o.glass` 0..1 = violet translucent glass
  with amber edges for the brand moment, `o.inside(cx, cy, w, h)` callback to draw contents seen through the glass; `o.number`
  optional), `P_parcel(p, f, L, o)` (oblique kraft box with violet ribbon and label; also the close-up `glass` mode: front face
  big and readable, squashed by `p.squash`; `o.noShadow`), `P_glint(x, y, k)` (ring glint: 4-branch star + additive halo, ≤ 6
  frames), `P_dust(x, y, k)` (small dust puff), `P_tableNumbers(f, L, on)` (1 · 2 · 3 painted on the cloth in front of the slots;
  `on` 0..1 lights them up at 8.0 s).
- **H — gloves & sleeves** `30_hands.js`: `H_arm(side, h, f, L, o)` draws the sleeve (rubber-hose tube from the shoulder to the
  wrist, wax fabric, rolled cuff) and the glove in `h.pose`, retracting into the cuff with `h.cuffIn`; `o.bump` 0..1 (parcel bulge
  in the R sleeve), `o.ribbon` 0..1 (violet ribbon peeking out of the R cuff), `o.flinch` (brand moment: arms pulled up). Also
  `H_armShadow(side, h, f, L)` (soft shadow on the cloth, drawn before the props) and `H_holdFront(h, f, L)` (the fingertips that
  wrap OVER the parcel in the `hold` pose, drawn after the parcel). Poses: `rest, grip, tap, count3, count2, count1, flourish,
  slide, open, wave, beckon, hold`. Gloves seen from the dealer's side of the table: back of the hand up, fingers towards us.
  1930s cartoon glove (4 fingers, rolled cuff), generic — no copied character, no three lines on the back. L wears a gold ring.
- **K — the lizard** `40_gecko.js`: `K_gecko(f, L, target)` — a margouillat (agama: orange head, blue-violet body, long tail) at
  `G.gecko`, seen from above, ~170 px long; head turns towards `target {x,y}`; push-ups between 300 and 330 facing the R sleeve;
  idles (tail flick, blink) otherwise. Must read instantly as the Cameroonian margouillat.
- **A — audio** `lib/audio.py` → `audio/loop.wav` (see CONCEPT_FINAL §5 and `data/score_cues.json`).

## Check your work (mandatory)
Create a test scene `overlay/scenes/98_test_<key>.js` that draws your module on its own (background + your stuff, at the real
positions/frames from SCORE), render stills and look at them at full size:
```bash
cd X/overlay
node render.mjs --scenes 98_test_<key> --frames 0,90,210,300,380 --out ../out/chk_<key> --pages 2 --jpg
python3 ../lib/sheet.py ../out/chk_<key> ../out/chk_<key>_sheet.jpg 5
```
(`--scenes` loads `0x_`/`1x_` shared files plus the listed ones.) Iterate until it looks premium. Delete your `98_test_` file and
your `out/chk_<key>` frames at the end (keep one sheet). Do not edit files you do not own. Report: API, what you drew, known limits.

**Module files define functions only — they must NOT call `registerScene`** (only your `98_test_` file does). Files `10_table.js`
and `0x_` are loaded by every render, so a syntax error there breaks everyone: test before saving. CPU is shared by 5 people
(4 cores): use `--pages 2` at most, `nice -n 5`, and render only the stills you need.

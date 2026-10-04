# « PAS REÇU. » — module guide (read fully before drawing)

Root `X = <scratchpad>/v3`. Concept + storyboard: `X/CONCEPT.md` (read §1, §2, §3.3, §5). 22.0 s, 660 frames, 1080×1920,
30 fps. A dispute played by the words themselves on the counter of a Mboppi shop at closing time (wax cloth under a
bulb, seen from above): « J'ai payé mon fournisseur. » gets crushed by a steel plate « PAS REÇU. »; the plates fight
from LUNDI to JEUDI; « LA PREUVE ? »; « …LE GARS M'A DIT QUE C'EST FAIT. »; the amber plate is flattened; rewind; the
Bonzini violet plate lands, unfolds into the receipt « PREUVE DE PAIEMENT », stamps the steel from below; P, A, S
fall off; « REÇU ✓ » remains and rests on « J'AI PAYÉ. »; the margouillat swallows P, A, S.

**THE #1 RULE OF THIS FILM: readable in one view, without sound.** Every plate text must be crisp and legible on a
phone at all times (no blur on text at rest, strong contrast, no texture over the letters' readability).

## Engine
- `overlay/engine.html`, `overlay/kit.js` (helpers: `clamp, lerp, eOutCubic, eOutBack, spring, rnd(i), rrect, at(), text(),
  makeCanvas, drawLogo(x,y,size,{alpha})`), `overlay/render.mjs` (Chromium, deterministic, motion blur `--mb N`).
  Global `ctx`. Fonts: `Satoshi` (400/500/700/900), `Stencil` (Big Shoulders Stencil, 100–900), `Martian` (Martian Mono),
  `CaveatBrush`, `DMSans`, `Brico`, `Shantell`.
- `overlay/scenes/01_score.js` — **THE SCORE** (lead, read-only): `SCORE.T` (key times, seconds — they will be re-timed on the
  real voices, so NEVER hard-code a time: always read `SCORE.T.xxx`), `SCORE.G` (layout), plate states
  `SCORE.steel(t)`, `SCORE.amber(t)`, `SCORE.proofPlate(t)`, `SCORE.violetPlate(t)` (each null or `{x, y, s, sx, sy, rot, a, …}`),
  `SCORE.gecko(t)`, `SCORE.LETTER_REST`, `SCORE.light(t)`, `SCORE.camera(t)`, `SCORE.pills(t)`, `SCORE.day(t)`.
  **t is in seconds** (float; motion blur samples sub-frames).
- `overlay/scenes/02_light.js` — light API (lead): `lit(hex, x, y, L, bias)`, `lightAt`, `castShadow(pathFn, x, y, z, L, strength)`
  and `softPath(pathFn, blur, color)` (fast blurred fill: NEVER use `ctx.filter` — 25 ms per call here).
- `overlay/scenes/10_table.js` — the wax cloth + bulb + atmosphere (validated, read-only).
- `overlay/scenes/50_compose.js` — the lead's composition: calls your functions if they exist, else draws grey blocks.
  Read it to see exactly when and in which order you are called.
- Determinism: never `Math.random`/`Date`; use `rnd(i)` with fixed seeds. Performance: cache static sprites in offscreen
  canvases (`makeCanvas`), built lazily; a full frame must stay under ~60 ms (the final render averages 4–6 sub-frames).

## Look
Night indigo `#140C26`, tungsten pool, wax cloth in the 3 logo colours; from the rewind (T.rewind) the violet brand
light from above (`L.violet`). Colour roles: **amber** `hsl(36 100% 55%)` = TOI (the merchant); **steel grey** = the
supplier; **violet** `hsl(258 100% 60%)` = Bonzini; **orange** `hsl(16 100% 55%)` = alert (days, the « ? », crack glow).
Plates are heavy physical objects: real thickness (layers offset away from the bulb), bevels, contact shadows on the cloth,
inertia, squash. Premium, tactile, cinematic — not PowerPoint, not flat vector.

## Modules (one owner each, one file each; prefix every global with your key; functions only — never `registerScene`
except in your own `98_test_<key>.js`)
- **PL — plates** `overlay/scenes/30_plates.js`
  - `PL_plate(kind, st, t, L)` for kind `'steel'` (« PAS REÇU. »), `'amber'` (« J'AI PAYÉ ! » / « !! » / « !!! » / « J'AI PAYÉ. »),
    `'proof'` (« LA PREUVE ? », steel with an orange « ? »). Centre (st.x, st.y), nominal heights `G.plateH` at s=1
    (steel 236, amber 186, proof 196), width ≤ 760 px (fit the text; all amber variants must fit). Transform: translate,
    rotate st.rot, scale st.s·st.sx, st.s·st.sy. Steel: brushed metal, 4 rivets, bevel, Stencil 900 ~190 px letters painted
    cream. Amber: thick satin paint, Satoshi 900 ~130 px dark brown letters (#2A1606), `st.shake` (effort tremble, every 2
    frames), `st.sweat` 0..1 (drops of sweat on its face). Shadows on the cloth via castShadow/softPath.
  - Steel extras after the stamp (`SCORE.steel(t)`): `crack` 0..1 (3 cracks growing from the impact point at the middle of the
    bottom edge, glowing orange), `lost` 0..3 (the letters P, A, S are gone, in that order — do not draw them; the letters
    module draws them falling), `recentre` 0..1 (what is left, « REÇU. », slides to the centre), `paint` 0..1 (violet enamel
    paint spreads over the plate from the impact point; letters stay cream and readable), `tick` 0..1 (a ✓ stamped at the
    right of « REÇU »; the final « . » fades as the tick lands). Final look = a violet plate « REÇU ✓ ».
  - `PL_glyphs(kind, txt)` → `[{ch, x, y, w, h}]` glyph boxes relative to the plate centre at s=1 (no transform) — the letters
    module uses it to spawn P, A, S exactly where they were. `PL_glyph(kind, ch, g)` draws one glyph of that plate's
    material centred at (0, 0) (a small chunk of plate behind it is fine), for the falling letters.
- **LX — letters & effects** `overlay/scenes/32_letters.js`
  - `LX_under(t, L)` (on the cloth, before the plates) and `LX_over(t, L)` (above the plates):
    1. **the opening subtitle** « J'ai payé mon fournisseur. » (Satoshi 900 ~76 px, white with an 8 px black outline, at
       `G.sub`, readable at rest from t=0 to T.slam) with the incoming plate's shadow on it from t=0 (soft dark rounded
       rectangle ~760×236 shrinking from 140 % to 100 % and sharpening as the steel falls);
    2. **the splash**: at T.slam its letters burst out from under the steel (deterministic arcs, bounces on the cloth,
       spin), then from T.amberForm they fly back to the centre and vanish into the forming amber plate by T.amberForm+.35;
    3. **P, A, S** detaching at `T.letters[i]` from their place on the steel (`PL_glyphs('steel','PAS REÇU.')` transformed by
       `SCORE.steel(t)`; fallback: measure Stencil 900 190px yourself): they drop with gravity onto the cloth, bounce, roll
       to `SCORE.LETTER_REST[i]` and wait; at `T.gulps[i]` each one is pulled into the lizard's mouth (`K_mouth(t)` if
       defined, else `G.gecko` + (40, −70)) and shrinks to nothing;
    4. dust puffs at impacts (T.slam, T.falls, T.proof, T.crush+.4, T.stamp, letter landings), sweat drops flicked off the
       amber plate during the awkward moment, an amber spark at T.clink where « REÇU ✓ » touches « J'AI PAYÉ. »;
  - `LX_rewind(t)` — screen-space overlay during T.rewind…T.rewindEnd: light video grain, 2 discreet tracking lines, a
    small « ◀◀ » glyph drawn as shapes (not a font emoji), fading in and out.
- **RC — Bonzini plate & receipt** `overlay/scenes/36_receipt.js`
  - `RC_draw(st, t, L)` with `st = SCORE.violetPlate(t)` = `{x, y, s, sx, sy, rot, a, unfold, pinned, sweep}`.
    unfold 0 = a glossy violet enamel plate (~720×300): Bonzini logo (`drawLogo`) top-left, « BONZINI PAIE » /
    « TON FOURNISSEUR ✓ » in Satoshi 900 ~92 px cream, sub-line « en Chine · Bénéficiaire payé » in Martian Mono 30 px;
    `sweep` 0..1 = a reflection passing over the enamel. unfold → 1 = the plate unfolds (fake 3D: scale Y, shading, edge)
    into a receipt (~620×420): violet header with the logo and « PREUVE DE PAIEMENT » (Satoshi 900 ~56 px), « Bénéficiaire
    payé ✓ » (Martian Mono ~32 px), a few blurred/grey lines (NO amount, NO name, NO date, NO reference), a soft violet
    stamp mark. `pinned` = a push pin at its top-left corner (it is then small, pinned on the amber plate). Shadow.
- **K — the margouillat** `overlay/scenes/40_gecko.js` (start from `overlay/modules/40_gecko.js`, the validated lizard
  of the previous film, which was keyed to frames and a 480-frame loop: rewrite its driving)
  - `K_gecko(t, L, g)` with `g = SCORE.gecko(t)` = `{target, act, k, n}` at `G.gecko` (112, 1420), body pointing up-right;
    acts: `idle`, `hop` (startled at the slam), `tennis` (snappy head turns following `g.target` — the match), `squint`
    (suspicious at the amber plate), `pushups` (joy), `gulp` (NEW pose: head forward ~18 px, jaw opens, throat bulges
    as the letter goes in; n = which letter), `hic` (small hop + tiny puff), `smug` (half-closed lids, satisfied).
    `K_mouth(t)` → `{x, y}` of the mouth (world px).

## Check your work (mandatory)
Write `overlay/scenes/98_test_<key>.js` that registers a scene drawing your module (the compose scene can be loaded with it:
`--scenes 98_test_<key>,50_compose` — it falls back to blocks for the others), render the stills you need and LOOK at them:
```bash
cd X/overlay && nice -n 5 node render.mjs --scenes 98_test_<key>,50_compose --times 0.5,1.3,3.2,6.5,13.6,15.2,18.2 --out ../out/chk_<key> --pages 2 --jpg
python3 ../lib/sheet.py ../out/chk_<key> ../out/chk_<key>_sheet.jpg 5
```
Iterate until premium and readable. Delete your `98_test_` file and `out/chk_<key>` frames at the end (keep one sheet).
Do not edit files you do not own. CPU is shared by 4 people (4 cores): `--pages 2` max, `nice -n 5`, only the stills you need.
Report: file, exact API, what it looks like, known limits.

## TIMING UPDATE (re-timed on the real voices)
`data/timing.json` now overrides `SCORE.T` (render.mjs injects it as `window.TIMING`): the film is **29.1 s (873 frames)**.
Key times: slam 1.40 · amberForm 1.75 · falls 3.62/5.02/6.74 · rebounds 4.12/5.52/7.24 · proof 7.80 · gars 8.32 · crush 10.57 ·
rewind 12.57–13.07 · violetIn 14.60 · unfold 17.52 · stamp 18.60 · letters 19.00/19.35/19.70 · check 19.80 · settle 20.05 ·
clink 20.65 · endcard 21.90 · gulps 22.80/23.30/23.80 · hic 24.30 · cta 25.98. Pick your test times from these
(`node -e "console.log(require('./overlay/scenes/01_score.js').T)"` from X prints them). Never hard-code times.

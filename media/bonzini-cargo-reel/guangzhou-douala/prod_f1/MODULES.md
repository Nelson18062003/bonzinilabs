# « LÀ-BAS, ON CHARGE. ICI, ON REÇOIT. » (film 1) + « DÉPOSÉ. REÇU. » (film 2) — the module contract

`P = rush2/prod_f1`. Spec: `rush2/SERIE.md` §3 (the DUPLEX system), §4 (real voice), §5.1 (film 1), §5.2 (film 2).

The skeleton is finished, and both films already render from start to end with plain **stand-ins**. Your module
replaces a stand-in as soon as its function exists.

**Do not edit** these files: `01_score.js`, `00_edl.js`, `05_footage.js`, `50_compose.js`, `60_type.js`,
`engine.html`, `render.mjs`, `kit.js`, `data/*`. If you need a new state, anchor or geometry, ask the lead: it goes in
the score.

| module | file | functions it must define (top level) |
|---|---|---|
| **M-DUPLEX** | `overlay/scenes/20_duplex.js` | `DX_under(t, n)`, `DX_draw(t, n)`, `DX_wordBox(subId, word)` |
| **M-MAP** | `overlay/scenes/40_map.js` | `MP_under(t, n)`, `MP_draw(t, n)` |

## 1. Draw order (`50_compose.js`)

1. `MP_under` draws the map ground. `DX_under` draws the night background of the signature.
2. `FT_draw` (`05_footage.js`) draws all the footage:
   - the two duplex windows;
   - the two block-B cards, with their white border, radius and shadow;
   - the panel window of the signature.
3. The EDL already does these things:
   - **darkens the secondary window** (35 %, fades of 0.2 s);
   - applies the vignette 0.15;
   - runs the whip (filé, 30.60–30.80) with its smear;
   - adds the stamps' push and shake on the footage.

   Grade and blurs are already baked into the prepared frames.
4. `DX_draw`, then `MP_draw`. Both are drawn **inside the stamps' whole-screen push ×1.03 and 10 px shake**
   (`SCORE.screenFx(t)`, applied by 50_compose), so draw in plain screen space.
5. `TY_draw` (`60_type.js`) draws nothing in this film: every row of `SCORE.TEXTS()` is taken over by your modules.
6. The grain is applied by the engine, once per frame.

If a module is missing, 50_compose calls its stand-in. `window.COMPOSE_FB.{duplexUnder, duplex, mapUnder, map}` keeps
the stand-ins available, for a side-by-side.

## 2. Rules for every module

- **Functions only.** Do not call `registerScene`. Use your own IIFE scope: kit.js already declares the globals
  `W H FPS C ctx rnd lerp clamp …`. Export only the function names listed above.
- **Pure functions of `t`** (float, in seconds), because motion blur draws sub-samples of a frame. `n` is the integer
  frame: use it only for boil or jitter.
- **Deterministic:**
  - use `rnd(i)` from kit.js, never `Math.random` or `Date`;
  - **never use `ctx.filter`** (qa.js fails on it); use `shadowBlur` or a downscaled canvas instead;
  - cache static looks in `makeCanvasCached(key, w, h)`.
- **No literal action times.** Read `SCORE.A.*` and `SCORE.T.*`, and the state objects below. Everything is re-timed:
  - real-voice words come from `rush2/voice/real_words.json` (present now);
  - narrator takes come from `rush2/voice/takes.json` (not yet);
  - film 2 is the same score with `VARIANT = 'cut'`.
- **Fonts** (declared in engine.html):
  - Satoshi 900 for the band, titles, stamps, pills and plate;
  - Satoshi 700 for the subtitles;
  - `Martian` (Martian Mono) for the « vraie voix » header and « VRAIES IMAGES ».
- **Colours:** use `SCORE.COL`:
  - `violet #A947FE` and `violetD #7B22D6` = **Bonzini only**: the logo, the plate, « Bonzini Trading » in the
    subtitles;
  - `amber #F3A745` = LÀ-BAS, DÉPOSÉ, the call pill;
  - `orange #FE560D` = ICI, REÇU, C'EST FORT !;
  - `night #10142B`, `ink #231629`, `grey #B9B3C2`, `kraft #C79E6C`, `kraftLine #E9D7B5`.
- **Safe zones:**
  - nothing above y 150;
  - **no text right of x 960 for y 900–1560**;
  - nothing important below y 1540.

  Each text has its box in `SCORE.TEXTS()`, and the boxes are audited.
- **Strings:** every string is exactly as the score gives it (French typography, no-break spaces before `?` and `!`).
  `*…*` marks the emphasis word, and `|` is a line break.

## 3. What the score exports (`window.SCORE`)

`node -e "const S=require('./overlay/scenes/01_score.js'); console.log(S.band(2.7))"` (add `BZ_VARIANT=cut` for film 2).

| export | returns | notes |
|---|---|---|
| `band(t)` | `{pos: 'H'\|'M'\|'B'\|null, y0, y1, a, glide: {from, to, t0, t1, p}\|null}` | `y0` is the band's top edge **including the ease-out-back overshoot** (16 px), and `y1 = y0 + 190`. The positions are HAUT 1110, MILIEU 865 and BAS 590. Each glide lasts 0.35 s. `a` is the band's opacity: block B fades it out 6.10–6.30 while it goes down 40 px, then it re-enters at HAUT 10.55–10.90, rising 40 px and fading in. The exit (A.F) slides it down off screen. Draw the motion blur of the band yourself (the shutter samples help). `BAND_KEYS` lists the glides. |
| `windows(t)` | `{G, D, P}`, each `{rect {x,y,w,h,tilt,r}, Q, s, F, fscreen [x,y], dark, shot, clip, src, mode: 'window'\|'card'\|'full'\|'panel', card, u}` | These are the footage regions as drawn. `fscreen` is the focal point F projected on screen. `dark` is the darkening already applied. `P` is the panel window of the signature. |
| `pills(t)` | `{G, D}`, each `{x, y0, y1, a, dy, text, color, flag: 'CN'\|'CM', textColor}` or null | The amber pill G sits at y 170–230, and at x 48, y 214–274 on the panel. The orange pill D sits 18 px under the band (`band.y1 + 18`); in PLEIN Douala it moves to y 170–230. `dy` is the entry slide (20 px → 0, over 0.2 s). The flag is 54 × 36 and drawn by you. |
| `logo(t)` | `{x0 856, x1 1020, y0 164, y1 228, text 'VRAIES IMAGES', textX1 1020, textY0 236, textY1 270, textSize 30, a}` | Shown always: the Bonzini mark (`drawLogo` from kit.js, on white) plus the Martian Mono mention. |
| `progress(t)` | `{p, x, y, a, w 28, h 22}` | The drawn parcel on the dashed line: `x = 64 + 952·t/T.end`, `y = band.y0`. It follows the band's opacity. |
| `texts(t)` | `[{id, lines: [[{w, segs: [{s, color}]}]], size 60, lead 72, x 64, maxX 960, y0, alpha: [per line], a, dy, underline}]` | These are the band phrases: `bandA` (0 → 6.10) and `bandC` (15.10 → 18.65). `alpha[i]` is the per-line dimming of §5.1 A: 100 % / 40 %. `underline` = `{word, line, p, color}` is the felt underline, drawn over 0.30 s. Entry: rise 24 px and fade over 0.15 s. Exit: fade over 0.12 s. |
| `subtitles(t)` | `{id, voice, mode: 'band'\|'box', box, head, a, lines: [[{w, s, e, state: 'said'\|'current'\|'coming', color}]], layout {headY, line1Y, line2Y, size 54, lead 62}, env {voice, u}}` | The real-voice karaoke. Word times are absolute film seconds, taken from the alignment. The keywords keep their colour once said: `merci` and `déposé` amber, `reçu` orange; « Bonzini Trading » is always violet. `env.u` = seconds into the segment; the live waveform reads `window.VOICE_ENV.voices[voice]` at `u`. `mode 'box'` is the signature's subtitle: box x 64–960, y 1240–1430, `#10142B` at 88 %, radius 20. |
| `stamps(t)` | `[{id, text, lines, size, rot, color, cx, cy, scale, age, a, ride, smear?}]` | DÉPOSÉ, REÇU and C'EST FORT ! (always 2 lines). `age` is the seconds since the hit; draw the slam from it (§3.6). DÉPOSÉ follows the G window: its centre is Q, with scale 1 → 0.75 at BAS, and it folds with G at A.F. REÇU sits on the machine (D's projected focal point). C'EST FORT ! leaves with the image in the filé (`cx` includes the whip offset, and `a` drops with the smear). |
| `merci(t)` | `{a, x, y, scale, size 190, color, halo 40, phase: 'hit'\|'hold'\|'fly', fly: {p, t0, t1, from, to, toSize 54, toWord {sub, word}}}` or null | Film 1 only. The fallback flight lands on the estimated position of « merci » in the band subtitle. M-MAP: aim at `DX_wordBox('sub1a', 'merci')` when it exists. |
| `map(t)` | `{a, bg, push, pushC, k, x0, y0, lat0, geo(lon, lat) → [x, y], pins {GZ, DLA}, labels, route, flows [{k, t0, t1, p, arrived, ring}], rings {G, D}, links {G, D}, cards {G, D, look, flight}, block}` or null | Film 1, 6.10–10.90. `bg` is the night ground: it stays under the cards' flight back to 10.90. `a` covers the land, pins, route and texts (fades 10.45–10.75). The cards are the footage's: `map.cards.G/D` = `windows(t)` entries. |
| `signature(t)` | `{T0, bandOut, full, sub, whip {t0, t1, p, switchAt, rgb 6, trail 120}, panel {…rect, on, push, fix, src}, background {on, color}, plate {…rect, t0, p, drop, a, line1, line2, logoX0, logoX1, size1 50, size2 40}, cta {…rect, t0, p, a, line1, line2, size1 48, size2 88, arrowX0 860, arrowX1 920}, freeze, freezeAt, ambOnly}` or null before A.F | Everything of §3.10. `drop` is ease-out-back over 0.25 s. The footage of the panel (v3, push ×1.00 → 1.04 about the title) is the EDL's. |
| `screenFx(t)` | `{dx, dy, s}` | The stamps' push and shake. It is already applied around your layers. |
| `TEXTS()` | `[t0, t1, id, text, style, takeover, {box, …}]` | The audit's list: safe zones, holds ≥ 1.4 s, ≤ 3 blocks. |
| `A`, `T`, `N`, `VARIANT`, `G`, `COL`, `CARD`, `PANEL`, `BAND_KEYS`, `DARK_KEYS` | | the anchors and the geometry (`G.band`, `G.sub`, `G.map`, `G.plate`, `G.cta`, `G.stamp`, …) |
| `voices()`, `narration()`, `soundCues()`, `music()`, `ambience()` | | for the mix (not your job) |

## 4. Anchors (defaults, as computed now)

**Film 1** (`A`):

| anchor | t |
|---|---|
| cover | 0 |
| glA | 2.55 |
| B | 6.10 |
| pinG | 6.45 |
| pinD | 6.60 |
| route0 → route1 | 6.70 → 7.50 |
| txt1 / ringG | 6.75 |
| flow0 | 7.00 (one parcel every 0.80 s, each 2.40 s) |
| cardG | 8.70 (freeze) |
| txt2 / ringD | 8.75 |
| ul2 | 8.95 |
| Bout | 10.40 |
| C | 10.90 |
| G4 | 13.15 |
| G6 | 14.13 |
| glC | 14.75 |
| txtC | 15.10 |
| ulC | 15.84 |
| D | 18.65 |
| merci | 19.905 |
| merciFly → merciEnd | 20.952 → 21.352 |
| G8 | 20.80 |
| sub1b | 21.402 |
| glD2 | 21.448 |
| G9 | 22.35 |
| E | 23.55 |
| depose | 25.80 |
| glE2 | 26.895 |
| recu | 27.48 |
| F | 27.95 |
| T0 | 28.30 |
| recuEnd | 28.88 |
| fort | 29.16 |
| sigSub → sigSubOut | 29.55 → 32.25 |
| whip | 30.70 |
| panel | 30.80 |
| major | 31.40 |
| pill | 32.30 |
| freeze | 36.50 |
| T.end | 36.80 |

**Film 2** (`BZ_VARIANT=cut`):

| anchor | t |
|---|---|
| E | 6.10 |
| depose | 8.35 |
| glE2 | 9.445 |
| recu | 10.03 |
| F | 10.50 |
| T0 | 10.85 |
| recuEnd | 11.43 |
| fort | 11.71 |
| whip | 13.25 |
| panel | 13.35 |
| pill | 14.85 |
| freeze | 19.05 |
| T.end | 19.35 |

The stamps hit the **stressed syllable** of the aligned word (« dépo-SÉ », « re-ÇU », « FORT »). SERIE's marks were
syllables too.

## 5. M-DUPLEX — `20_duplex.js`

**`DX_under(t, n)`** draws the night background `#10142B` when `signature(t).background.on` (from the whip on).

**`DX_draw(t, n)`** draws, in this order:

1. **The band-route** (§3.2):
   - full width, 190 px, `#10142B` at 92 %, at `band(t)`;
   - on its top edge, a 4 px dashed line (14 / 10) graded amber (x 0) → orange (x 1080);
   - motion blur of the band during glides (vertical smear, from `glide.p`), and a whoosh-like feel.
2. **The parcel** at `progress(t)`: drawn kraft 28 × 22 with amber tape, sitting on the dashed line.
3. **The band texts** `texts(t)`:
   - Satoshi 900 at 60 px, interline 72, x 64, never past x 960;
   - entry: rise 24 px and fade over 0.15 s; exit: fade over 0.12 s;
   - per-line alpha;
   - the underline as an orange felt stroke drawn over `underline.p` under the given word.
4. **The subtitles** `subtitles(t)`:
   - in `mode 'band'`, the header « vraie voix · l'équipe Bonzini à Guangzhou » (Martian 30 px, `#B9B3C2`) at
     `layout.headY`;
   - the live waveform of 16 bars at x 850–946 (`window.VOICE_ENV`, read `env.u`);
   - 2 lines of 54 px with interline 62;
   - the **current word in Satoshi 900 white**, the others in Satoshi 700 at 75 %, `coming` words fainter;
   - keyword colours as given;
   - `mode 'box'` uses the box x 64–960, y 1240–1430.
5. **The pills** `pills(t)`: the drawn flags (China: red with 1 large and 4 small yellow stars; Cameroon: green, red,
   yellow with a yellow star), rounded rect radius 30, height 60, label in Satoshi 900 at 40 px.
6. **The logo pill** and « VRAIES IMAGES » `logo(t)`.
7. **The stamps** `stamps(t)` (§3.6):
   - Satoshi 900 capitals in a double frame (strokes 8 px and 3 px, gap 6);
   - procedural ink texture, deterministic, about 15 % holes;
   - slam 1.6 → 1.0 in 4 frames (ease-out);
   - 1 frame of red/blue separation at ±6 px;
   - 14 ink dust grains.

   The screen push and shake are already applied around you. The 2-line C'EST FORT ! is 170 px, with interline 0.9 and
   rotation −3°.
8. **The signature**:
   - the **violet plate** `signature.plate`:
     - drops in 0.25 s with ease-out-back and a « tonk »;
     - box x 90–930, y 770–950;
     - a white logo of 80 px at x 120–200;
     - « BONZINI TRADING CARGO » in Satoshi 900 at 50 px, white, x 220–884;
     - « Chine → Douala · bateau ou avion » in Satoshi 700 at 40 px, white at 90 %;
   - the **amber CTA pill** `signature.cta`: x 90–930, y 1240–1470, ink text on 2 lines, the `*WORD*` at 88 px, and a
     **drawn arrow** at x 860–920 that bobs at 2 Hz. The text is `Écris *COLIS*`, or `Réponds *COLIS*` in film 2;
   - optional RGB separation ±6 px over the filé (`signature.whip`).

**`DX_wordBox(subId, word)`** returns `{x, y, w, h, size}`: the screen box where your subtitle draws that word, for the
current frame. M-MAP lands MERCI on it.

## 6. M-MAP — `40_map.js` (film 1, block B 6.10–10.90, and the MERCI)

**`MP_under(t, n)`**, using `map(t)`:

- the night ground at `bg`;
- **Natural Earth 1:110 m land**: `assets/map/ne_110m_land.geojson` (public domain, copied from
  `explainer/tools/map/`). Fetch it once from `../assets/map/…`, or bake it into a cached canvas;
- the land in kraft `#C79E6C` at 90 %, outlined `#E9D7B5` at 2 px;
- projection: `x = 60 + 7.833·lon`, `y = 600 + 7.833·(40 − lat)` (`map.geo`);
- a slow push ×1.00 → 1.03 centred on (540, 800) (`map.push`, `map.pushC`).

**`MP_draw(t, n)`**:

- **Pins** GZ (947, 732) in amber and DLA (136, 882) in orange: they drop 120 px with a bounce (`pins.*.p`).
- **Labels**: « GUANGZHOU » in Satoshi 900 at 44 px, amber, with a 6 px `#10142B` outline, right-aligned on x 940,
  y 770–816. « DOUALA » in orange at x 165–335, y 905–951.
- **Route**: a quadratic Bézier `p0 → c → p1`, dashed 8 px (20 / 14), graded amber → orange, drawn on `route.p`.
- **Parcels** `flows` (26 × 20): `p` runs along the route (already eased). When a parcel arrives (`ring`), it goes out
  on a small orange ring.
- **Rings**: an amber ring pulses around card G (`rings.G.p`, 6.75–7.35), and an orange ring around card D (8.75–9.35).
- **Links**: a white 3 px line at 70 % from each card to its pin (`links`; the card rects are in `map.cards`).
- **Optional 2.5D garnish on the cards**: a lift shadow, a gloss, and the RGB edge of the flight. The cards'
  footage, white border, radius and shadow are already drawn by the EDL.
- **The text block** `map.block`: x 64–960, y 1360–1500, 64 px.
  - Line 1 « Un conteneur **part**. » (« part » in amber).
  - Line 2 « **Un autre** arrive. » (« Un autre » in orange), with the orange felt underline drawn on
    `block.underline.p`.
  - Fade out on `block.out`.
- **MERCI** `merci(t)`:
  - Satoshi 900 at 190 px, amber, with an amber halo (shadowBlur 40);
  - hit: scale 1.5 → 1.0 in 5 frames;
  - hold, centred at (540, 560) on the ballot;
  - then the flight on an arc, shrinking into the subtitle's « merci » (`DX_wordBox('sub1a', 'merci')`, else
    `fly.to`).

  The word stays amber in the subtitle after landing; the subtitle already colours it.

## 7. Checking your work

```
cd P/overlay && nice -n 5 node render.mjs --times 0,2.7,12,16,19.9,21.2,25.9,27.6,29.2,31,34 --pages 3 --mb 4 --out ../out/m_dx --jpg
cd P/overlay && nice -n 5 node render.mjs --times 6.2,6.5,6.7,7.3,8.0,9.0,9.5,10.5,10.8 --pages 3 --mb 4 --out ../out/m_map --jpg
cd P/overlay && nice -n 5 node render.mjs --variant cut --times 0,6.3,8.4,10.2,11.8,13.3,15.5 --pages 3 --mb 4 --out ../out/m_f2 --jpg
python3 P/tools/grid.py P/out/m_dx --cols 6           # the 360-px sheet (--dim: + a 50 % one)
node P/tools/qa.js --no-outputs  (and BZ_VARIANT=cut)  # must PASS: safe zones, stickers, blurs, holds, hygiene
```

- Look at every result at full size and at 360 px wide.
- Delete your test frames afterwards: the disk is tight (≈ 3.4 GB free).
- Stills from the current skeleton: `out/stills_f1`, `out/stills_f2`, `out/grid_f1_360.jpg`, `out/grid_f2_360.jpg`.

## 8. Facts you must not undo

- **Stickers.** The burned-in stickers of v1–v3 never show. qa.js counts 0 pixels of the 8-px-dilated masks in every
  crop window, at every sub-sample. Do not draw anything that reveals the footage outside its window, such as a
  mirrored or zoomed-out copy.
- **Blurs** (gaussian σ 18, feather 8, margin 10 in source px) are baked into `assets/clips/*`:
  - the hub-cap logo of v2;
  - the Toyota logo of v7;
  - the felt names on the v1 ballots and bags;
  - the trailer plate of the card G;
  - « LIU JO » of v17.

  Never put a sharp copy of the footage on screen.
- **Violet only for Bonzini.** No date, no delay, no « premier ».
- **Image 0 is the cover:** the band at MILIEU with both lines at 100 %, both pills, the logo, nothing darkened.

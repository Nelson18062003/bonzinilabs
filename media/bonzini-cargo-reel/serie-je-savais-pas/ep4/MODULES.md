# « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5): module guide

> **v2 voices (clear diction, `SCRIPT_V2.md`): 12 lines, T3 split into T3 « Allô ? » + T3b « Il dit qu'il n'a rien changé ! »;
> the score runs on its v2 DEFAULTS (44.84 s, 1345 frames) until the lead re-times it.** The times and v1 texts quoted below
> are the stage-1 values (35.67 s, v1 voices); the live ones are `SCORE.A` / `SCORE.T` and the v2 anchors table of `README.md`.

Read this whole file before you draw anything.

`E = <scratchpad>/serie/ep4`. The storyboard is `<scratchpad>/serie/SERIE.md`: read « Épisode 4 », « Ce qui revient dans
chaque épisode » and « Règles de fabrication communes ». The contract and the quality bar are in `<scratchpad>/serie/PIPELINE.md`;
the rules are in `serie/BRIEF.md`. The film is **already re-timed on the real voices**: **35.67 s, 1070 frames,
1080×1920 at 30 fps** (`data/timing.json`). **Never hard-code a time**: always read `SCORE.A.x`, `SCORE.T.x` or `SCORE.W(…)`.

**The #1 rule: a Mboppi trader who sees it ONCE, scrolling, without sound, understands it.** Every key sentence is said AND
written, big (≥ 44 px body, ≥ 96 px titles), crisp, high contrast, held ≥ 1.4 s, never more than 3 text blocks at once
(`node tools/check_text.js` from E checks the score's texts). The test: 4 people out of 5 say « appeler l'ancien numéro avant
de payer », nobody says « Bonzini protège des arnaques », everybody sees that the fake is NOT the real supplier.

## What already works (stage 1, lead's skeleton)
The whole film renders end to end. As soon as you define a function listed below, `50_compose.js` calls it instead of its
fallback, and `60_type.js` stops drawing the texts you take over (`SCORE.TEXTS()` = `[t0, t1, id, text, style, owner]`: when
`window[owner]` is a function, the type layer skips that text). The animatic as it stands: `E/out/animatic_sheet.jpg`.

To check: `cd E/overlay && nice -n 5 node render.mjs --times 0,9.62,19.6 --out ../out/chk_cm --pages 2 --jpg`, then
`python3 ../tools/sheet.py ../out/chk_cm ../out/chk_cm_sheet.jpg 4`. Look at the stills: full size, crops, and a 360 px
wide downscale. Motion blur: add `--mb 6` (that is how the lead renders the film). Iterate until it is premium.

| File (owner) | Contents |
|---|---|
| `overlay/engine.html`, `kit.js`, `render.mjs` (lead) | « PAS REÇU. » night engine, every font of the series declared and pre-loaded (Satoshi, Stencil, Brico, Martian, Shantell, CaveatBrush, Kalam, PatrickHand, GochiHand, Bangers, DMSans). `render.mjs`: TIMING injection, `--mb`, `--times`, `--scenes`; length = `round(TIMING.end × 30)`. |
| `scenes/01_score.js` (lead, read-only) | **THE SCORE**: `T` (voice starts), `DUR`, `END(id)`, `W(id, prefix, nth, fb)` / `WE(…)` (word anchors; « cœurs » = « coeurs »), `A` (every action time), `G` (layout), `speaking(t, who)`, `talk(t)`, `slow(t, t0)`, every object state as a pure function of t, `TEXTS()`, `pills(t)`, `light`, `camera`, `gecko`, `soundCues()`, `music()`. |
| `scenes/02_light.js` (lead) | `lit(hex,x,y,L,bias)`, `lightAt`, `shadowOff(x,y,z,L)`, `softPath(pathFn, blur, color)`, `castShadow(pathFn,x,y,z,L,strength)`. **Never `ctx.filter`** (25 ms a call). |
| `scenes/10_table.js` (lead, validated) | The wax cloth under the bulb, the night, `T_atmos` (dust, falloff, vignette, grain), the phone-glass dust print (`T_glassLayer`, remapped and scaled by compose for the hook). |
| `scenes/20_props.js` (lead, validated + 1 extension) | The Bonneteau's props. `P_parcel(p, f, L, o)`: the kraft parcel, **extended**: `o.label = 'TA\|COMMANDE'`, `o.ribbon` 0..1 (0 = neutral kraft ribbon, 1 = violet, cross-faded), `p.z` (lift for the shadow), modes `'table'`/`'air'` cast a shadow; textures at 6 px/unit (crisp at ×5). `P_container(c, f, L, o)`: the 10-ft container, `o.glass` 0..1 (violet glass, glowing amber edges), `o.inside()`. `P_dust(x, y, k, L)`, `P_glint(x, y, k)`. |
| `scenes/30_plates.js` (lead, validated + 1 extension) | « PAS REÇU. » plates. `PL_plate(kind, st, t, L)`, **new kinds**: `'toi'` (amber satin, 640 × 236, dark brown letterpress) and `'honest'` (brushed steel, 760 × 300, cream stencil, rivets); **multi-line text** with `'\|'`; `st.z` = height for the cast shadow. `PL_glyphs(kind, txt)` gives glyph boxes (multi-line too). |
| `scenes/39_gecko_shim.js`, `40_gecko.js`, `41_gecko_unshim.js` (lead, done) | The validated margouillat, unchanged, driven by `SCORE.gecko(t)` through `SCORE.geckoShim()`. At `G.gecko` (112, 1420). `K_mouth(t)` → his mouth (world px). Acts: hop at frame 0 (THOK) and at the interruption, squint at « trois cœurs », tennis during the call, flinches at the shatter / FAUX MESSAGE / end stamp, **gulp of heart 0 at `A.gulp`**, hic, push-ups when the Bonzini label sticks, smug. |
| `scenes/50_compose.js` (lead) | Camera, draw order, calls to your functions, fallbacks. Read it to see when you are called and in which order. Adds `SCORE.parcelFace(P)` and `SCORE.parcelXf(P)`. |
| `scenes/60_type.js` (lead) | Chip « JE SAVAIS PAS. · 4/5 », speaker pills, TA COMMANDE's speech cards, the dark band, THE RULE, the fallbacks of every text you take over. `TY.pill`, `TY.stamp`, `TY.speechCard`… are reusable. |
| `tools/check_text.js`, `tools/sheet.py` (lead) | Readability check of the texts; contact sheet. |
| **M1**: `scenes/22_commande.js`, `scenes/34_fake.js` | « TA COMMANDE & the fake message », prefix `CM_` |
| **M2**: `scenes/36_call.js`, `scenes/70_bonzini.js`, `scenes/76_end.js` | « the real supplier, the call, Bonzini & end », prefix `BZ_` |

Rules for every module: functions only, never `registerScene` (except in a temporary `98_test_<key>.js`, deleted at the end).
Prefix every global with your key. Deterministic (`rnd(i)` with fixed seeds, never `Math.random` or `Date`). **t is in
seconds** (float: motion blur samples 6 sub-frames per frame), `f = t·30` for the engine's frame-keyed functions. Cache static
sprites lazily (`makeCanvas`). A full frame must stay under ~60 ms. Do not edit files you do not own: ask the lead (a SCORE
field you need that does not exist → ask; do not patch the score).

## Look: the Mboppi shop counter, at night
The « PAS REÇU. » world: night indigo `#140C26`, one tungsten bulb swaying above a wax cloth (the 3 logo colours on indigo),
seen from above; dust in the cone, deep falloff, fine grain. Objects are heavy and tactile: real thickness, bevels, contact and
cast shadows on the cloth (`castShadow`, sampled through `lit()`), inertia, squash. Premium, cinematic — never flat vector.

**Colour roles** (logo colours: violet `hsl(258 100% 60%)` `#7B4BFF`, amber `#F3A745`, orange `#FE560D`):
- **kraft** `#D7B07A` / ink `#2A1A0C`: TA COMMANDE (the parcel, its speech cards, its pill);
- **amber**: TOI (his plate and pill);
- **brushed steel**: the real supplier, honest and calm;
- **bottle green `#1E5A3C` + mustard `#D9A21E`**: the fake message (the feyman's wax colours — never the brand's, never China's);
- **orange**: alerts — the « ? », « FAUX MESSAGE », the cracks' glow, « PAS TON FOURNISSEUR »;
- **violet: ONLY with Bonzini**, from `A.cont` on (the glass container, the ribbon, the label, the enamel plate, the light).
  Before that the parcel's ribbon is **kraft**.

**Safe zones**: nothing at y < 150. Nothing important at y > 1540. **No text at x > 960 for y 900–1560.** The chip sits
top-left at y 153–215 (drawn last).

**Content rules**: no real app UI, no real messaging sound or logo (« WhatsApp » never appears). The account lines are
**blurred « •••• •••• »** (no figure, no name). The fraudster has no face, no voice, no nationality, no accent. The real
Chinese supplier is the honest one (calm plate, never ridiculed). TOI is never humiliated (the hearts gag is tender). The
only address is « Foyer Balengou ». Bonzini never « protects » anyone: the protection is the reflex (call the known number).

## Layout (`SCORE.G`, world px = screen px at camera 1)
- **TA COMMANDE** — P_parcel convention: `(x, y)` = middle of its footprint, front bottom edge (the **foot**) at `y + 40·s`;
  front face `122·s × 72·s`, top face `100·s` deep. On the glass: `G.lens` (540, 850), **s 5.0** (≈ 610 px wide, nearly full
  frame). On the cloth: s `G.pS` 1.8 — rest `G.rest` (178, 1298), interruption `G.mid` (548, 1252). Inside the container: s
  `G.pInS` 1.25.
- **The fake message**: `G.bubble` centre (540, 930), 780 × 370. Its sender pill `G.pillQ` (372, 738), on the top-left edge.
  Hearts on its bottom row, right; « FAUX MESSAGE » at (540, `G.fauxY` 935).
- **TOI's plate**: `G.toi` (630, 1345); creeps to `G.toiNear` (600, 1318); recoils to `G.toiBack` (630, 1440). Its TOI pill
  sits on its top-left corner.
- **The honest steel plate**: hovers at `G.sup` (540, 560), its pill above it.
- **Texts**: speech cards y `G.speechY` 400 (hook card 430), the second hook line y `G.speech2Y` 1335, dark band y
  `G.bandY` 400, THE RULE y `G.ruleY` 760; label « Boutique · Mboppi » `G.label` (790, 1172).
- **Hearts at rest** by the margouillat: `G.heartRest` [(262, 1372), (330, 1392), (398, 1410)] — heart 0 is gulped.
- **The container**: front bottom edge centre `G.cont` (620, 1450), scale k 1.85 (×200 px wide at k 1); at the end card
  `G.contEnd` (580, 1500), k 1.5. Bonzini: enamel plate y `G.bz.plateY` 470, caption y `G.bz.serviceY` 712, warehouse tag
  `G.bz.tag` (222, 1170). End card: `G.end` logo 290 · service 378 · stamp 560 · CTA 790 · tag line 900.

## Key times (re-timed; `node -e "console.log(require('./overlay/scenes/01_score.js').A)"` from E)
**Voices** (speech starts → ends): C1 0.15→3.49 · T1 3.61→6.38 · T2 6.81→9.35 · C2 9.47→12.56 · C3 12.68→15.35 ·
T3 15.78→18.50 · C4 20.48→20.68 · N1 21.28→24.28 · C5 24.88→27.31 · N2 27.43→29.55 · N3 30.43→34.47 · end 35.67.
C = TA COMMANDE, T = TOI, N = the narrator. Word anchors: `SCORE.W('C1','compte')`, etc. (`data/timing.json` `words`).

**Actions** (`SCORE.A`):
- hook: **thok 0** (already flattened at frame 0) · presses 0 / 1.08 (« attends ») / 2.53 (« paie ») / 2.98 (« compte ») ·
  hook2 2.13 (« ne ») · dezoom 3.13 · **bubble 3.58** (lands on « compte ») · land 3.55 · hookOut 3.60 · glassOff 4.48;
- T1: pillQ 3.83 · label 3.70 · toiIn 3.41 · **hearts 4.06 / 4.41 / 4.76**;
- T2: toiTxt1 6.71 · **heartsPulse 6.88** (« cœurs ») · toiTxt2 8.73 (« je paie ») · advance0 8.78;
- C2: jump 9.16 · **jumpLand 9.48** (= music cut) · bonk 9.54 · c2cap 9.52;
- C3: band 12.58 · **allo 13.96** · rings 14.01 / 14.81 · aside 15.53;
- T3: bandOut 15.88 · **supIn0 15.93 → supIn1 16.78** · toiRien 16.74 · tremble 16.78;
- the fall (slow motion ×0.5 from slow0 18.62 to slow1 21.02): toiOut 18.37 · **stamp 18.62** · **shatter 19.07** ·
  peel 19.19 · **fauxStamp 19.37** · roll 19.62 / 19.92 / 20.22 · joy 20.03 / 20.50 / 20.90 · major 20.73 · supOut 20.78;
- N1: **rule 21.13 → ruleOut 24.93** · ruleW 21.28 / 21.60 / 22.67 / 22.96 · ruleSub 23.53 · **gulp 24.13** · hic 24.88;
- brand: **cont 24.73** (= violet) · leap 25.13 · enter 25.68 · **ribbon 25.83** · bzLabel 26.18 · tagBZ 26.43 · doors 26.53 ·
  sig 27.40 · **plateBZ 27.43** · service 28.42;
- end: **endcard 30.23** · cta 30.43 · tagLine 30.93 · **stampEnd 33.35** · loop0 35.12 · out 35.55 · end 35.67.

**Suggested test times**: 0, .3, 1.1, 2.5, 3.3, 3.7, 4.8, 6.9, 8.9, 9.5, 9.7, 12.0, 14.1, 14.9, 16.3, 17.3, 18.6, 18.7, 19.1,
19.5, 20.1, 20.6, 22.0, 23.7, 24.2, 25.4, 25.9, 26.3, 27.5, 28.9, 31.0, 33.5, 35.2, 35.6.

---

## M1 « TA COMMANDE & the fake message » (prefix `CM_`)

### `22_commande.js` — the talking parcel « TA COMMANDE » (the only object that speaks in the whole series)
`P = SCORE.parcel(t)` = `{mode, x, y, s, squash, z, sx, sy, rot, talk, ribbon, bzLabel, inside, vis}`:
- `mode`: `'glass'` (hook: pressed flat against the phone glass, `squash` 0.07–0.30), `'air'` (falling back / jumping),
  `'table'` (on the cloth), `'inside'` (in the violet container — drawn through its glass), `'lens'` (the loop: flying at the
  lens, `squash` → 0.3 on the last frame = frame 0);
- `sx, sy, rot, z`: the character's squash-and-stretch about its **foot**, rotation, lift (px). **Compose already applies
  them** (`SCORE.parcelXf(P)`: translate to the foot − z, rotate, scale, back) **before** calling you;
- `talk` 0..1 = the syllable envelope while a C line is spoken (`SCORE.speaking(t, 'cm')` → `{id, k, i, w}`: the word being
  said). The score already gives it basic hops (z 22·talk, sy +8 %);
- `ribbon` 0..1: its kraft ribbon turns violet inside the container (`A.ribbon`), and back to kraft as it flies out for the
  loop; `bzLabel` 0..1: Bonzini's label (M2 draws it).

**Functions**:
- **`CM_pose(P, t)` → P'** (optional): your own acting. Return a modified copy (richer hops, anticipation, overshoot,
  settle, the 3 joy jumps `A.joy`, the re-presses on the glass at `A.presses`), using `SCORE.W` word times (« Pa-tron ! »,
  « At-tends ! »). Compose calls it first, then draws the shadow and the body with P'.
- **`CM_parcel(P, t, L)`**: the body only, at `(P.x, P.y)` in the P_parcel convention, the character transform already set.
  Base: `P_parcel({...P, z: 0}, t * 30, L, {noShadow: true, label: 'TA|COMMANDE', ribbon: P.ribbon})`.
  **No face, no arms**: it speaks with its whole body. The hand-written label « TA COMMANDE » must be readable at frame 0.
  The kraft ribbon is neutral (never violet before `A.ribbon`).
- **`CM_parcelShadow(P, t, L)`** (optional): its shadow on the cloth (world, no character transform; the shadow stays on the
  cloth while it hops: use `P.z`). Not called in modes `'glass'` / `'lens'` / `'inside'`.

**Key images**: frame 0 (and 0.3 s, the A/B cover): squashed flat on the glass, THOK, the dust print around it (compose
draws the print, scaled to `G.lens.s`). The interruption at `A.jumpLand`: it leaps from `G.rest` between the bubble and
TOI's plate (TOI's plate bonks into it at `A.bonk` and recoils). « C'était un faux message ! » + 3 joy jumps (silent, v2).
The leap into the container.

### `34_fake.js` — the fake message, its fall, the margouillat's snack
- **`CM_bubble(b, t, L)`** — `b = SCORE.bubble(t)` = `{x, y, w, h, s, sx, sy, rot, a, lines[3], acct, hearts[3], pulse, shake,
  crack, shatter, slow, broken}`. A **bottle-green lacquered plate with a mustard rim**, shaped like a message bubble (a tail),
  thick, glossy lacquer catching the bulb; **NO real app UI**. It lands at `A.bubble` (squash). The 3 lines
  `ON A CHANGÉ DE / COMPTE BANCAIRE. / PAIE ICI, VITE.` (≥ 56 px, cream, crisp), the **blurred** account line `•••• ••••`,
  and **three little hearts** popping at `A.hearts[i]` (`hearts[i]` 0..1), pulsing at « cœurs » (`pulse`). It trembles from
  `A.tremble` (`shake`). At `A.stamp` the steel stamps it from above: **3 cracks glowing orange** grow from the top centre
  (`crack` 0..1). From `A.shatter` (`broken`) do not draw the intact plate: it is shards (CM_fx).
- **`CM_fake(pq, t, L)`** — `pq = SCORE.pillQ(t)` = `{x, y, a, drop, peel, label, under}`. **You take over `pillQ` and `pas`.**
  The sender's pill **« « TON FOURNISSEUR » ? »** (the « ? » orange) drops on the bubble's top-left edge at `A.pillQ`; after the
  shatter it stays in the air where it was; at `A.peel` it **peels off like a sticker** (`peel` 0..1) and reveals, under it,
  the orange pill **« PAS TON FOURNISSEUR »** (≥ 48 px), held until `A.rule`.
- **`CM_fx(t, L, layer)`** — `layer = 'under'` (on the cloth, before the plates: pieces that came to rest) or `'over'` (above
  everything in the world). **You take over `faux`.** Draw:
  - the **shatter** at `A.shatter`, in **slow motion**: drive the physics with `SCORE.slow(t, A.shatter)` (story seconds, ×0.5
    until `A.slow1`): green lacquer shards, the **letters** of the message and the **3 hearts** fall, bounce on the cloth and
    **roll to the margouillat** (`G.heartRest`, landing around `A.roll[i]`, « clink »);
  - heart 0 is **gulped at `A.gulp`**: pull it into `K_mouth(t)` over the last 0.15 s and make it vanish (the lizard opens his
    jaw at that moment); the other hearts / letters fade out before `A.cont`;
  - the orange stamp **« FAUX MESSAGE »** hitting the void where the bubble was (`SCORE.fauxStamp(t)` = `{x, y, k, a, rot}`,
    impact at `A.fauxStamp`, held to `A.rule`, ≥ 96 px, starved orange ink, readable on the night: a dark halo is fine);
  - dust puffs (`P_dust`) at the stamp and on landings, orange sparks from the cracks.
  Keep ≤ 3 text blocks: the steel plate, « FAUX MESSAGE », « PAS TON FOURNISSEUR ».

---

## M2 « the real supplier, the call, Bonzini & end » (prefix `BZ_`)

### `36_call.js` — TOI's plate, the call, the honest supplier
- **`BZ_toi(st, t, L)`** — `st = SCORE.toiPlate(t)` = `{x, y, s, sx, sy, rot, a, txt, flip, shake, sweat, z}`. Base:
  `PL_plate('toi', st, t, L)` (multi-line, `'|'`). Texts in order (v2): `IL A CHANGÉ|DE COMPTE.` (what he believes, T1) →
  `TROIS CŒURS,|C'EST LUI !` (`A.toiTxt1`) → `JE PAIE.` (`A.toiTxt2`, creeps to the bubble) → bonks into the parcel at `A.bonk` → **turns to
  `ALLÔ ?`** at `A.allo` (`flip` 0..1: the score squeezes `sy` by |cos| and swaps the text at mid-turn — draw a real turn of the
  plate about its horizontal axis if you can: thickness, the other face) → `IL N'A RIEN|CHANGÉ !` (`A.toiRien`, trembling) →
  slides away at `A.toiOut`. The TOI pill is drawn by the type layer (top-left corner of the plate).
- **`BZ_call(t, L)`** — the phone rings at `A.ring[0]` (v2: one ring, after C3): **drawn ring waves** (amber arcs, hand-drawn feel)
  leaving the frame edge towards TOI's plate; optionally a tiny « line » graphic at `A.supIn0`. Generic, no real phone UI.
- **`BZ_sup(st, t, L)`** — `st = SCORE.supPlate(t)` = `{x, y, s, sx, sy, rot, a, txt, z, pill}`. The **honest brushed-steel
  plate « JE N'AI RIEN CHANGÉ. »** (base `PL_plate('honest', st, t, L)`): it **descends gently, no squash** from `A.supIn0` to
  `A.supIn1` with its pill **« TON FOURNISSEUR · CHINE »** (type layer, follows it); it hovers (calm), then **stamps the bubble
  from above at `A.stamp`** (a short wind-up, `st.z` drops to ~8) and floats back up (slow-motion spring); it leaves at
  `A.supOut`. Compose calls you in the **world** pass while `st.z < 60` (the stamp) and in the **hero pass** (after the air,
  so it stays bright in the dark top of the frame) while it hovers.

### `70_bonzini.js` — the brand
- **`BZ_container(C, t, L, inside)`** — `C = SCORE.container(t)` = `{x, y, k, z, glass, a, doors, id}`: the **violet-glass
  mini 10-ft container** on the cloth (from `A.cont`; violet light `L.violet` from then on). Base:
  `ctx.translate(C.x, C.y); ctx.scale(C.k, C.k); ctx.translate(-540, -1000); P_container({x: 540, y: 1000, z: 0, tilt: 0, id: C.id}, t * 30, L, {glass: C.glass, inside: () => inside && inside()})`.
  `inside` (or null) draws TA COMMANDE (shadow, body, label) at its world position (it resets the transform itself): call it
  inside your glass, so the parcel is **seen through the violet glass**. The doors **close gently** (`C.doors` 0..1, « portes
  qui se ferment en douceur »). For the loop the container sinks and fades from `A.loop0`. The door-end view of the loop's
  container reads as a tall glass box at this size: a 3/4 view showing a long side would read more « container ».
- **`BZ_onParcel(P, face, t, L)`** — the label **« BONZINI TRADING CARGO »** sticking on the parcel's front face at
  `A.bzLabel` (`P.bzLabel` 0..1; `face = {x0, y0, w, h, foot}`, world, the character transform already applied). The ribbon
  turning violet (`P.ribbon`, `A.ribbon`) is drawn by whoever draws the parcel (P_parcel `o.ribbon`).
- **`BZ_plate(st, t, L)`** — `st = SCORE.bzPlate(t)` = `{x, y, s, sx, sy, rot, a, sweep}`: the **violet enamel plate « BONZINI
  TRADING CARGO »** (logo `drawLogo`, cream letters, glossy enamel, a reflection `sweep`; base: pas-recu `36_receipt.js`
  `RC_plate`), landing on « Bonzini » (`A.plateBZ`) with the balafon signature; ≤ 880 × 210 at y 470. Called in the hero pass.
- **`BZ_scene(t, L)`** (world) — **you take over `tagBZ` and `service`**: the kraft tag **« Entrepôt · Foyer Balengou »** pinned
  next to the container (`A.tagBZ`, `G.bz.tag`, violet push pin), and the caption **« DE LA CHINE À DOUALA · MER OU AIR »**
  (`A.service`, y `G.bz.serviceY`, ≥ 64 px). ≤ 3 blocks: plate, caption, tag.

### `76_end.js` — end card, ritual, CTA, loop
- **`BZ_end(ec, t, L, space)`** — `ec = SCORE.endcard(t)` = `{k, service, cta, stamp, tag, out}`; called twice: `'world'`
  (inside the camera) and `'screen'`. **You take over `brand`, `serviceEnd`, `stampEnd`, `cta`, `tag`** (read each from
  `SCORE.TEXTS()`): the logo + « Bonzini Trading Cargo » (y 290) and « Cargo Chine → Douala · mer ou air » (y 378, draw « → »
  as a shape); the orange ritual stamp **« MAINTENANT, / TU SAIS. »** (y 560, hits at `A.stampEnd`, held to `A.out`); the
  amber CTA pill **« Écris ALLÔ en commentaire »** (y 790, ≥ 54 px) with a **drawn arrow ↓**, one bounce at `A.cta`; « Tague
  celui qui paie trop vite » (y 900, written by hand from `A.tagLine`).
- **The loop**: from `A.loop0` TA COMMANDE pops out of the container and flies at the lens (score); at `A.out` every end text
  is gone; at `T.end` it is exactly the frame-0 parcel, squashed on the glass (« toc »). Make that last half-second sing.

---

## Report to the lead
Your files, the exact API you implemented, any SCORE field you need (ask, do not patch the score), your cost per frame
(with `--mb 6`), the known limits. Keep one check sheet in `E/out/` and delete your test frames. CPU is shared: `nice -n 5`,
`--pages 2` max, render only the stills you need.

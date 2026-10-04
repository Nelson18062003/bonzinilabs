# « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5): module guide

Read this whole file before you draw anything.

`E = <scratchpad>/serie/ep3`, `SP = <scratchpad>`, `R = /home/user/bonzinilabs`. The storyboard is `SP/serie/SERIE.md`: read
« Épisode 3 », « Ce qui revient dans chaque épisode » and « Règles de fabrication communes ». The contract and the quality bar
are in `SP/serie/PIPELINE.md`; the rules are in `SP/serie/BRIEF.md`.

The film is **already re-timed on the real voices**: **34.34 s, 1030 frames, 1080×1920 at 30 fps** (`data/timing.json`).
The lead may re-time it again, so **never hard-code a time**: always read `SCORE.A.x` or `SCORE.T.x`, and never a
position you can read from `SCORE.G` or from a state function.

**The #1 rule: a Mboppi trader who sees it ONCE, scrolling, without sound, understands it.** Every key sentence is said AND
written, big (≥ 44 px body, ≥ 96 px titles), crisp, high contrast, held ≥ 1.4 s, and never more than 3 text blocks at once.
PHRASE-test (v2, `SCRIPT_V2.md` §8): « Il a écrit juste « bonne qualité, comme la photo » et il a reçu autre chose : la photo
ne dit pas tout, et le fournisseur choisit tout ce que tu n'écris pas. Il faut faire une fiche, tout écrire, et demander
l'échantillon d'abord, un seul sac, à garder pour comparer. La commande, c'est toi ; le transport, c'est Bonzini Trading
Cargo, avec ton étiquette sur chaque carton. »

## What already works (stage 1, the lead's skeleton)
The film renders end to end with **animatic fallbacks**. As soon as you define a function listed below, `50_compose.js` calls
it instead of its fallback, and `60_type.js` stops drawing the texts you take over (see « takeover » in `SCORE.TEXTS()`).
The animatic as it stands is `E/out/animatic_sheet.jpg` (18 stills): it is the layout you start from.

To check: `cd E/overlay && nice -n 5 node render.mjs --times 0,1.6,3.6 --out ../out/chk_om --pages 2 --jpg`, then
`python3 ../tools/sheet.py ../out/chk_om ../out/chk_om_sheet.jpg 6`. Look at the stills: full size, crops, and a 360 px wide
downscale. Check with motion blur too (`--mb 6`). Iterate until it is premium.

| File (owner) | Contents |
|---|---|
| `overlay/engine.html`, `kit.js`, `render.mjs` (lead) | The « PAS REÇU. » engine, every font declared and pre-loaded (Satoshi, Stencil, Brico, Martian, Shantell, CaveatBrush, DMSans, Kalam, PatrickHand, GochiHand, Bangers). `render.mjs` injects `data/timing.json` as `window.TIMING` (`--mb`, `--times`, `--scenes`). `kit.js` = `rrect`, `at`, `text`, `withShadow`, `shipLabel`, `qr`, `iconShip`, `drawLogo`, `TEX.kraft`, `rnd`… |
| `scenes/01_score.js` (lead, read-only) | **THE SCORE**: `SCORE.T` (voice starts), `DUR`, `W(id, prefix, nth, fb)`, `A` (every action time), `G` (layout), `FICHE` (sheet layout), `cartonGeo`, `place`, and every object state as a pure function of t. |
| `scenes/02_light.js` (lead) | MORNING light API, same names as pas-recu: `lit(hex,x,y,L,bias)` → `'rgb()'`, `lightAt(x,y,L)` → `{k, v, s}`, `sunAt(x,y)` (the door's sunbeam on the cloth, 0..1), `shadowOff(x,y,z,L)` (long shadows down-RIGHT; straight down under the violet light), `softPath(pathFn, blur, color)`, `castShadow(pathFn,x,y,z,L,strength)`. **Never `ctx.filter` per frame** (25 ms a call). |
| `scenes/10_table.js` (lead) | The pas-recu wax counter + a morning branch: navy-indigo wax (no violet: violet is Bonzini's), a warm sunbeam from the door (upper left) across the cloth, the shop's back wall with shelves of folded wax beyond the far edge (y < 584), god rays and dust in `T_atmos`. |
| `scenes/39_gecko_shim.js`, `40_gecko.js`, `41_gecko_unshim.js` (lead, done) | The validated margouillat, unchanged, driven by `SCORE.gecko(t)` through an adapter. Bottom-left at `G.gecko` (112, 1420). `K_mouth(t)` → his mouth (world px). **Never name a file `39_*`/`40_*`.** |
| `scenes/50_compose.js` (lead) | Camera, draw order, calls to your functions, fallbacks (`window.__FB`, `window.__amberLayout` for comparison). Read it to see when and in which order you are called. |
| `scenes/60_type.js` (lead) | Chip, pills, meme header, bands, captions, stamps, end card: every text you do not take over. |
| **M1**: `scenes/30_meme.js`, `scenes/32_plates.js` | « the order & the meme », prefix `OM_` |
| **M2**: `scenes/34_fiche.js`, `scenes/36_sample.js`, `scenes/70_bonzini.js`, `scenes/76_end.js` | « the fiche, the sample, Bonzini & end », prefixes `FS_` (fiche, sample, gloves, letters) and `BZ_` (Bonzini, end) |

Rules for every module: functions only, never `registerScene` (except in a temporary `98_test_<key>.js`, deleted at the
end). Prefix every global with your key. Your file reads `window.SCORE` at load (files 30–38 and 41+ see the real score).
Everything is deterministic (`rnd(i)` with fixed seeds, never `Math.random` or `Date`), and **t is in seconds** as a float,
because motion blur samples sub-frames. Use the frame `n = Math.round(t * 30)` or `stepT(n)` (on twos) only for stop-motion
poses. Cache static sprites lazily (`makeCanvas`). A full frame must stay under ~60 ms: the final render averages 6
sub-frames. Do not edit files you do not own; if you need a SCORE field that does not exist, **ask the lead** (report it).

## Look: the wax counter of a Mboppi shop, IN THE MORNING
The camera looks down at the shop's counter covered with a wax cloth (navy indigo ground, amber / orange / green motifs).
The bulb is OFF. A **warm, raking morning sun comes in through the door** (off-frame, upper left) and lies across the cloth
as a broad soft-edged beam (`sunAt`); everything outside it is in the cooler daylight of the shop. Objects are lit with
`lit()` / `lightAt()` sampled where they sit, cast **long shadows down-right** (`shadowOff`, `castShadow`), and catch a warm
rim on the side facing the door (upper left). Beyond the far edge (y < 584) is the shop's back wall: the bands and the end
card live there. Premium, tactile, cinematic: real thickness, contact shadows, materials (brushed steel, satin amber paint,
thin card, kraft, glossy black bags). Never flat PowerPoint. Readable on a phone at 50 % brightness.

**Colours** (logo): amber `#F3A745` = TOI (his plates, his pill, the ✓ of the plate); orange `#FE560D` = the alerts (« ? »
tags, « QUI A TORT ? », stamps); violet `#A947FE` / `#7B4BFF` = **ONLY with Bonzini** (the note « + MON ÉTIQUETTE
BONZINI », the roles band, the brand light from `A.violet`). The supplier is steel grey. Sea-label blue `#0B5FA5` is the real
colour of the label. Ink `#1A1426`, cream `#FFF6E8`.

**Safe zones**: nothing at y < 150. Nothing important at y > 1540. **No text at x > 960 for y 900–1560.** The series chip
stays top-left (y 153–215).

**Content rules**: the bags carry **no brand, no monogram, no gold clasp, no luxury code**: the ordered bag is a black
RIGID tote with two handles; the received bag is smaller, SOFT and saggy, with ONE thin strap. The supplier has no face, no
voice, no accent, and is never ridiculed (his plate is calm: he did what was written). **No figure anywhere** except the code
« BZ-482913 », always with « EXEMPLE ». The label's address, phones and name are blurred. Bonzini does not choose, check or
buy the goods: never suggest it (the roles band says it). No third-party brand, platform or messaging app.

## Shared geometry
- World px = screen px at camera 1 (`SCORE.camera(t)` pushes a little; compose applies it).
- **Cartons** (the received carton, the sample parcel, the big carton of the order) use ep2's oblique 3/4 convention: a
  state `st` has a **foot** `(st.x, st.y)` (middle of the front face's bottom edge), `w, h, d`, a scale `s` (+ `sx`, `sy`
  about the foot), `rot`, `flaps` 0..1 (0 shut, 1 wide open). `SCORE.cartonGeo(st)` returns the corners every module must
  agree on: front `FTL FTR FBR FBL`, back-top `BTL BTR` (the top recedes up-right by `(d·.30, −d·.50)`), `BBR`, `cx, cy`
  (front-face centre), `top`. Reuse ep2's material: `SP/serie/ep2/overlay/scenes/30_carton.js` (`CA_carton`), re-prefixed.
- `SCORE.place(o, dx, dy)` → world point of a local offset on a rotated, scaled object (`o.x, o.y, o.rot, o.s`).
- Layout (`SCORE.G`): polaroid (285, 800) 360×440 (hook) → (772, 1090) ×.86 (sample act); received carton foot (800, 1000)
  330×190×170, its bag rests at (806, 770); subtitle / amber plate y 1250; steel plate y 1015; order card y 1185; sheet
  (540, 1000) 760×820 → thumbnail (215, 760) ×.4; sample parcel (420, 1235); sample shown at (340, 1085) ×1.2, tapping at
  (560, 1470); big carton foot (600, 1010) 520×280×240; margouillat (112, 1420); TOI's shoulders off-frame at (90, 2350) and
  (990, 2350); end card: logo y 300, service 392, stamp 615, CTA 852, tag line 958.

---

## M1 « the order & the meme » (prefix `OM_`)

### `30_meme.js`
**`OM_memeBand(mb, t)`** (screen, after the world). `mb = SCORE.memeBand(t)` = `{k, out}` (`out` 0→1: it folds away at
`A.memeOut`). **You take over `'meme'`**: the meme header « CE QUE J'AI COMMANDÉ | CE QUE J'AI REÇU » — two columns at
`G.meme` (y 322, columns x 282 / 798, ≈ 196 tall), « COMMANDÉ » / « REÇU » ≥ 80 px. It is the frame-0 hook: it must read
as the famous meme instantly (white band, bold, divider), with our materials (paper, a strip of tape…).

**`OM_photo(P, t, L)`** (world). `P = SCORE.polaroid(t)` = `{x, y, s, sx, sy, rot, a, pin, pareil, w, h}`. The polaroid
**« LA PHOTO »**: a studio product photo of the black RIGID tote (two handles, seamless light background), white polaroid
frame, « LA PHOTO » handwritten on the bottom margin (object text: you draw it, ≥ 46 px), a push-pin while `pin`. It stays
until `A.next`, slides out left, comes back next to the sample at `A.polaIn` (M2 stamps « PAREIL ✓ » on it), leaves at
`A.polaOut`. Base: `R/media/bonzini-cargo-reel/explainer-v2/overlay/scenes/13_prints.js` (polaroid frames).

**`OM_recv(C, B, t, L)`** (world). `C = SCORE.recvCarton(t)` (carton state: `flaps 1`, `torn 1` = kraft tape torn,
`shake`), `B = SCORE.recvBag(t)` = `{x, y (centre), s, sx, sy, rot, a, jump 0..1, sag}`. Draw the carton's back, the
received bag, then the carton's front (the bag sits half out of the open carton). **At frame 0 the bag is mid-jump out of
the carton (the « pouf »)** and lands at `A.bagLand`. The received bag is visibly **not the photo's**: smaller, soft,
creased, slouching (`sag`), one thin strap. Same black, so « sacs noirs » was respected — the rest was not written.

**`OM_subtitle(sb, t, L)`** (world). `sb = SCORE.subtitle(t)` = `{x, y, a, shadow 0..1, splash 0..1, t0}`. **You take over
`'sub'`**: TOI's subtitle « Mes sacs / sont arrivés ! » (white, black outline, ≈ 88 px, 2 lines centred on `G.sub`), the
TOI pill is drawn by type under it. The amber plate's **shadow tightens on it** (`shadow`, from `A.shadow0`), then the plate
crushes it at `A.slam`.

**`OM_fxUnder(t, L)`** (world, after the cloth and the margouillat, BEFORE every object): the subtitle's letters **gush out
from under the amber plate like marbles** at `A.slam` (`sb.splash` 0→1 over 1.2 s; the storyboard: « les lettres giclent
comme des billes »), rolling on the cloth, gone before `A.steel`. Base: `SP/v3/overlay/scenes/32_letters.js` (`LX_under`).

### `32_plates.js`
**`OM_plate(kind, P, t, L)`** (world), for each entry of `SCORE.plates(t)` (back to front: order, steel, amber). Centre
`(P.x, P.y)`; apply translate, rotate `P.rot`, scale `P.s·P.sx, P.s·P.sy`; `P.z` = height above the cloth (shadow);
nominal sizes `G.plateW` / `G.plateH` (amber 860×190, steel 780×260, order 820×370). Base: `SP/v3/overlay/scenes/30_plates.js`
(`PL_`: brushed steel, satin amber, thickness, contact + cast shadows, cracks, the fallen-letter glyphs), re-prefixed.

| kind | material | text | behaviour |
|---|---|---|---|
| `amber` | TOI's satin amber 3D plate (thick paint, pillowed edge) | `P.txt` = « C'EST PAS ÇA ! » (Satoshi 900, dark brown letterpress, ≈ 108 px, text within x 160–920) | **crushes the subtitle at `A.slam`** (falls from above, squash, 10 px shake), shrinks a little and sweats while the steel speaks (`sweat`, `shake`), slides out down at `A.clear`. **Comes back at `A.amberBack`** (rises from below) for the key moment: each tap of the sample from below jolts it (`tap`), `cracks` 0..3 / `crack` 0..1 = three glowing cracks from the bottom edge through P, A, S (one per tap, `A.taps`); `lost` 0..3 = P, A, S gone (M2 flies them); `recentre` 0..1 = « C'EST » and « ÇA » close up like a spring, **no hole**; `bang` 1→0 = the « ! » fades as `tick` 0..1 stamps an **amber/brown ✓** in its place → **« C'EST ÇA ✓ »**. It stays to the end card, slides down out of the way at `A.endcard`, rises back at `A.loop` to the subtitle's exact place: the last frames = frame 0's place. |
| `steel` | the supplier's brushed steel plate, rivets, cream stencil letters | `P.lines` = « IL A FAIT CE QUE » / « TU AS ÉCRIT. » (v2, the words of N1; Stencil 900 ≈ 118 px) | **lands CALMLY** at `A.steel` (a slow descent, no crush, a soft metal « clac »), lifted away up at `A.clear`. The grey pill « TON FOURNISSEUR · CHINE » is drawn by type at its top-right. |
| `order` | TOI's **thin amber card** (flimsy, it bends) | `P.lines` = « SACS NOIRS. » / « BONNE QUALITÉ. » / « COMME LA PHOTO. » (≈ 84 px) | falls at `A.order` fluttering, **sags under its own weight** (`sag` 0..1, overshoot then settles); during the lesson **line `P.soggyLine` (« BONNE QUALITÉ. ») goes soggy like wet cardboard and ends as a crêpe** (`soggy` 0..1, `A.soggy0`→`A.soggy1`) — still readable at mid-way; slides out at `A.next`. The TOI pill is drawn by type under it. |

**`OM_glyphs(txt)`** → `[{ch, i, x, y, w, h, size, font, baseline}]`: one box per character of the amber plate's text,
relative to the plate centre at s = 1 (like `PL_glyphs`). **`OM_glyph(ch, box, L)`** draws one glyph of the amber material
centred on its box centre at (0, 0) (like `PL_glyph`). M2 uses both for P, A, S (indexes 6, 7, 8 of « C'EST PAS ÇA ! »).

**`OM_fx(t, L)`** (world, after everything): dust puffs at the slam (spilling from under the plate), at the steel's landing
(a breath) and at the order card's flop; the amber plate's sweat drops; the soggy line's drips; the cracks' sparks if you
want them (keep them small).

---

## M2 « the fiche, the sample, Bonzini & end » (prefixes `FS_`, `BZ_`)

### `34_fiche.js`
**`FS_fiche(F, t, L)`** (world). `F = SCORE.fiche(t)` = `{x, y, s, rot, a, w, h, lines[4], stamp, note, thumb}` with
`lines[i] = {label, k, check, scrib, fromTag}`. Inner layout: `SCORE.FICHE` (offsets from the sheet centre), world points:
`SCORE.ficheGeo(F)` = `{lines: [{label, check, scrib: [a, b]}], stamp, note, s, rot}`. **You take over `'stampAll'` and
`'note'`.** Draw:
- the blank order sheet (good paper, slight curl, ruled), sliding in at `A.sheet` (« LA PROCHAINE FOIS, FAIS UNE FICHE. » is a band
  drawn by type in the top zone);
- **4 small amber plates** MATIÈRE · TAILLE · POIGNÉES · EMBALLAGE (≥ 72 px) that **fall on the words** and pile up
  (`lines[i].k` 0..1 at `A.lines[i]`, a « clac » each);
- the felt-pen scribbles of TOI's details next to each line (`scrib`, illegible on purpose: no fake data);
- the **✓** on each line (`check`): lines 0–2 receive it from the flying « ? » tags (`fromTag`), EMBALLAGE gets a fresh one;
- the orange starved-ink stamp **« ÉCRIS TOUT »** at the head of the sheet (`stamp` 0..1, at `A.stampAll`, after the voice: `END(N3) + .05`);
- **the violet note « + MON ÉTIQUETTE BONZINI / SUR CHAQUE CARTON »** pinned at the foot of the sheet (`note`, at `A.note`,
  ≥ 50 px, readable ≥ 1.4 s at full size before the sheet shrinks): the first violet of the film;
- from `A.ficheAside` the whole sheet shrinks to a thumbnail top-left (`thumb` 0..1, done by `F.x/y/s/rot`), leaves at
  `A.key`.

**`FS_tags(list, t, L)`** (world). `SCORE.tags(t)` = `[{i, txt, line, phase, x, y, px, py, rot, s, a, k, check}]`: the 3
orange paper tags « TAILLE ? » « MATIÈRE ? » « POIGNÉES ? » (≥ 46 px; v2: pinned right after N1b « …ne dit pas tout. »). `phase 'pin'`: stamped/pinned on the received bag at
`A.tags[i]` (string from the pin `(px, py)` to the tag); `'hang'`: unpinned, floating while the old carton slides out
(`A.next`); `'fly'`: flies to its line's ✓ slot on the word (`k` 0..1), then fades into the sheet's ✓ (`check`).

### `36_sample.js`
**`FS_parcel(p, t, L)`** (world). `p = SCORE.parcel(t)` = `{x, y, s, sx, sy, rot, a, open, label}`: the small kraft sample
parcel (kraft tape — **never violet**: it comes from the supplier), label **« ÉCHANTILLON »** on its front (object text, ≥ 46
px, readable before the gloves open it), lands at `A.parcel`, opened (`open`) at `A.unbox`, leaves at `A.parcelOut`. Base:
`R/media/bonzini-cargo-reel/bonneteau-feyman/overlay/scenes/20_props.js` (`P_parcel`), with a parametric kraft ribbon.

**`FS_sampleBag(b, t, L)`** (world, after the plates). `b = SCORE.sampleBag(t)` = `{x, y, s, rot, a, held, keep, tapping}`:
**the bag of the photo** (same black rigid tote) lifted out of the parcel at `A.unbox` and shown big (×1.2) next to the
polaroid, **with the kraft tag « À GARDER »** tied on its handle at `A.keep` (`keep` 0..1; object text ≥ 44 px, it hangs
down the bag's front). At the key moment the left glove holds it **under the amber plate and taps it from below**
(`tapping`, three jolts at `A.taps`); after the ✓ the glove carries it away (kept). Draw it so it reads « pareil que la photo ».

**`FS_onPhoto(P, t, L)`** (world, right after the polaroid). The amber stamp **« PAREIL ✓ »** on the polaroid (`P.pareil`
0..1 at `A.pareil`; ≥ 60 px; its text right edge < 960). **You take over `'pareil'`.**

**`FS_gloves(g, t, L)`** (world, last of the objects: closest to us). `g = SCORE.gloves(t)` = `{L, R}`, each `null` or
`{x, y (wrist), rot, pose, s, a}`, poses `'rest' | 'open' | 'grip' | 'hold' | 'press' | 'pen'`. **TOI's** white cartoon
gloves coming in **from the bottom edge** (POV; shoulders `G.shoulder`): **plain sleeves (no wax), NO signet ring, no
jewel** (the bonneteau's feyman had one: remove it). R holds a felt pen and scribbles the details of each line (`'pen'`,
`A.lines[i] + .2 → + .7`), both open the parcel, L lifts and shows the sample, R presses the « À GARDER » tag, L taps the
plate from below. Base: `R/media/bonzini-cargo-reel/bonneteau-feyman/overlay/scenes/30_hands.js` (`H_arm`), new sleeves.

**`FS_letters(t, L)`** (world, after the plates and gloves). **P, A, S** of the amber plate: `SCORE.lettersPlan()` =
`{detach: [3 times], gulps: [3 times], rest: [3 points], chars: ['P','A','S']}`. Each detaches at `detach[i]` from its place
on the plate (`OM_glyphs("C'EST PAS ÇA !")[6 + i]`, plate at `SCORE.amber(t)`; fallback `window.__amberLayout`), falls,
bounces, **rolls towards the margouillat** and waits at `rest[i]`; at `gulps[i]` it is sucked into `K_mouth(t)` (one
« gloup » each, during the brand sequence). Draw them with `OM_glyph` when it exists (amber material). Base:
`SP/v3/overlay/scenes/32_letters.js` (`LX_over`, the P A S fall/roll/gulp). This is **the gag of the episode**: slow,
satisfying, readable (cover candidate at ≈ `A.letters[1]`: « C'EST » + the A in the air + « S ÇA ! »).

### `70_bonzini.js`
**`BZ_carton(st, t, L)`** (world). `st = SCORE.bigCarton(t)`: the big carton of the order (oblique, flaps open, `shake`),
arriving at `A.key`, **full of black rigid totes that look exactly like the sample** (handles up), leaving at `A.endcard`.
**`BZ_onCarton(st, t, L)`** (world, right after it). The **blue sea label** on its front face (real Bonzini label of
`R/src/lib/shippingLabelCanvas.ts`, kit `shipLabel(w, h, 'sea', 'BZ-482913')` as a base): blue band + ship, QR,
**« BZ-482913 »** and **« EXEMPLE »** readable (≥ 30 px at rest, ≥ 44 px once `st.pop` = 1 during N5: it grows and is
emphasised), address / phones / name **blurred** (`softPath` bars). **You take over `'bzCode'`.**

**`BZ_atmos(t, L)`** (screen, after `T_atmos`): **the violet light switches on** at `A.violet` (`L.violet` 0..1, lower on
the end card, 0 in the last frames for the loop). A lamp / pool from above, not a flat wash: the texts must stay readable.

**`BZ_roles(br, t, L)`** (screen). `br = SCORE.brand(t)` = `{violet, role1, role2, labelNote, out}`. **You take over
`'role1'` and `'role2'`**: the roles band in the top zone (y 225–575), line by line on the words — « LA COMMANDE, C'EST
TOI. » at `A.role1` (TOI in amber, like his pill) then « LE TRANSPORT, C'EST BONZINI TRADING CARGO. » at `A.role2`
(Bonzini in violet). ≥ 56 px. This is the sentence that prevents « Bonzini garantit la qualité »: make it unmissable.

**`BZ_scene(br, t, L)`** (world). **You take over `'bzNote'`**: « collée par ton fournisseur / sur chaque carton » (≥ 44 px,
from `A.labelNote`), pointing at the label (drawn arrow), in the gap between the carton (foot y 1010) and the amber plate
(top y ≈ 1155): `G.annot` (560, 1088).

### `76_end.js`
**`BZ_end(ec, t, L, space)`**. `ec = SCORE.endcard(t)` = `{k, service, cta, stamp, tag, out}`; compose calls it twice:
`space = 'world'` inside the camera, `'screen'` after the world. **You take over `'brand'`, `'service'`, `'stampEnd'`,
`'cta'`, `'tag'`** (texts in `SCORE.TEXTS()`, layout `G.end`): logo + « Bonzini Trading Cargo » (y 300), « Chine → Douala ·
bateau ou avion » (y 392, ≥ 44 px, « → » drawn as a shape), the ritual stamp **« MAINTENANT, / TU SAIS. »** (y 615, at
`A.stampEnd`, in the pause BEFORE N6b « Maintenant, tu sais. », which then reads it (v2), on paper so the orange reads on the dark wall), the amber CTA pill **« Écris FICHE en
commentaire »** (y 852, ≥ 56 px) with **a drawn arrow ↓**, bouncing once at `A.cta`, and « Tague celui qui commande /
toujours « comme la photo » » (y 958). Keep the series' end-card look: `SP/serie/ep2/overlay/scenes/76_end.js`
(`BZ_ritualStamp`, `BZ_ctaPill`). **The loop**: at `A.loop` every end text fades (gone at `A.out`) while « C'EST ÇA ✓ »
rises back to the subtitle's place; the last frames are the plate alone, frame 0 is the meme again.

---

## Key times (v2 voices, SCORE DEFAULTS of SCRIPT_V2.md §7.1 — the lead re-times them on the new takes; always read `SCORE.A`: `node -e "console.log(require('./overlay/scenes/01_score.js').A)"`)

**Voices** (16): T1 .05 · T2 1.97 · N1 3.45 · T3 7.05 · N1b 10.37 · N2 12.96 · N3a 17.02 · N3 19.27 · N4 24.32 · N4b 26.83 ·
N4c 28.53 · T4 32.80 · N5 34.39 · N5b 36.09 · N6 39.51 · N6b 42.34 · end 44.59 (1338 frames).

**Actions**:
- hook: bagLand .40 · shadow0 1.25 · **slam 1.85** · music 2.35;
- who's wrong: memeOut 2.75 · qui 3.05 · **steel 3.25** · clear 6.65;
- the order: **order 6.90**;
- la photo ne dit pas tout (N1b): bandPhoto 10.32 · photoShiver 10.64 · **tags 12.29 / 12.51 / 12.73** (after « tout »);
- the lesson: **cut 12.76** · band 12.81 · soggy 13.21 → 16.17 · mock 16.59;
- la prochaine fois (N3a): **next 16.92** · sheet 17.12;
- the fiche: **lines 20.29 / 21.10 / 21.64 / 22.45** · **stampAll 23.37** (after N3) · **note 23.62** · ficheAside 25.07;
- the sample: capN4 24.27 · **parcel 25.42** (in « L'échantillon, ») · **unbox 26.22** (« un seul sac ») · capL3 26.78 (N4b) ·
  polaIn 28.28 · garde 28.48 · **keep 28.63** · parcelOut 28.67 · **pareil 28.97** (before « pour comparer »);
- key moment: **key 30.25** · amberBack 30.40 · polaOut 30.70 · **taps 30.80 / 31.02 / 31.24** · **letters P 31.50 · A
  31.85 · S 32.20** · recentre 32.28 · **check 32.60**;
- brand: **violet = sig 34.04** · label 34.44 · role1 34.54 · gulps 35.77 / 36.93 / 39.09 · role2 36.24 · labelNote 36.84 ·
  bzName 37.17;
- end: **endcard 39.26** · cta 39.51 · tagLine 40.06 · **stampEnd 42.04** · loop 43.99 · out 44.19.

**Check stills (defaults)**: `out/v2chk/` (0, 5.0, 8.5, 10.8, 12.4, 13.03, 15.0, 17.6, 21.95, 23.55, 25.6, 27.3, 28.8, 29.4,
31.6, 33.2, 35.2, 37.9, 41.0, 43.0, 44.5), sheet `out/v2chk_sheet.jpg`, 360 px wide `out/v2chk_360.jpg`.

## Report to the lead
Report your files, the exact API you implemented, any SCORE field you need that does not exist (ask, do not patch the
score), your cost per frame, and the known limits. Keep one check sheet in `E/out/` and delete your test frames.

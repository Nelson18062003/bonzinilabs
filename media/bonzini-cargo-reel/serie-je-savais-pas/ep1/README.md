# « JE SAVAIS PAS. » · 1/5 — « TCHAC ! » Prix chinois × 2 = ? — episode folder

**Status: v2 « voix claires » integrated on the DEFAULTS, waiting for the lead's re-timing.** The voice was rewritten for
clear pedagogy (`SCRIPT_V2.md`, `data/script_v2.json`: same 12 ids N1 N2 T1 N3 N4 N5 N6 N7 T2 N8 N9 N10, « Tchac » no longer
said, keyword **CALCUL**). The picture follows it: new storyboard defaults (`SCRIPT_V2.md` §6.1, **44.54 s = 1336 frames**),
every anchor of §6.2, every on-screen text of §2, the SFX of §6.4 and the audio mirror of §6.5. `data/timing.json` is absent
on purpose (the v1 timing is `data/timing_v1.json`), so the score runs on its defaults until `serie/retime.py` writes the v2
one. The v1 stage-3 notes below are kept for history (their times are v1). Check sheet: **`out/v2chk_sheet.jpg`** (18
stills on the defaults, `out/v2chk/`).

Render (lead): `cd overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg`
(N follows `data/timing.json` `end`: `N = round(end × 30)`; 1336 on the defaults, `data/timeline_main.json` set to it).
Stills: `--times a,b,c --pages 2`. Times: `cd overlay && node -e "const S=require('./scenes/01_score.js'); console.log(S.T, S.A)"`.
**QA after the re-timing: `node tools/qa_score.js`** (from E): §6.3 constraints, key holds ≥ 1.4 s, order of the actions,
impacts kept out of the speech; `node tools/qa_score.js 200` also replays `retime.py` on 200 simulated takes;
`--timing other.json` checks a candidate timing.

**After any score change, re-run the audio** (`lib/audio_ep1.py` reads `SCORE.soundCues()` / `SCORE.music()` live; its
`derive_A` / `derive_cues` / `DUR0` mirror the v2 score exactly on the defaults and on word lists).

## v2 (voix claires) — what changed in the picture
| where | v1 → v2 |
|---|---|
| hook stamp (`60_type.js` `hookTag`) | ACHETÉE 5 000 F EN CHINE → **PAYÉE 5 000 F EN CHINE** (on « payée ») |
| title (`60_type.js` `title`, `TEXTS.title`) | IL GAGNE COMBIEN ? → **TU GAGNES COMBIEN ?** (112 px: 972 px wide, settles at 96 px) |
| TOI card 1 (`TEXTS.toi1`) | Facile : / 5 000 de / bénéfice ! → **Facile ! / Je gagne / 5 000 F !** |
| douane sticker (`20_money.js` `stickerSpr`) | exemple · dépend du code du produit (31 px) → **EXEMPLE / dépend du / produit** (48 px ≈ 44.6 px on screen, paper 300 px; DOUANE label 52 px, moved left) |
| petits frais (`20_money.js` `artFrais`) | 4 doodles + words 28 px → **taux · pousseur · taxi · crédit at 42 px**, 2 × 2 grid, pictos dropped |
| stamp (`20_money.js` `invSpr`, `stamps()`) | 5 PAIRES SUR 100 : / INVENDABLES → **… / NE SE VENDENT PAS** (96 px, ls 2), right AFTER « pas » |
| strip (`invSubSpr`, `stamps().sub`) | leur coût retombe sur les autres paires : −500 → **payées quand même : −500 par paire vendue**, lands at `A.invSub` (2nd sentence) |
| « = 0 » (`stamps().eqK`) | printed on « zéro » (`A.zeroEq`); the card lands AFTER « franc » (`A.zeroStamp`) |
| TOI card 2 (`TEXTS.toi2`, `toiCard`) | …zéro ?! (80 px, 380 px card) → **Quoi ? / Zéro franc ?** (64 px, 500 px card) |
| Bonzini band (`bzBand`, `TEXTS.bzBand`) | … / DÈS GUANGZHOU → **… / EN CHINE** |
| CTA (`70_bonzini.js` `cta`, `ctaFB`, `TEXTS.cta`) | Écris TCHAC … → **Écris CALCUL en commentaire ↓** (pill x 110…951, centred on x 530) |
| fallbacks (`50_compose.js`) | sticker / petits frais / strip texts follow (no violet before the brand) |

## Files
| file | owner | what |
|---|---|---|
| `overlay/engine.html` | lead | Kraft & Fil engine (paper table, grain, motion blur 180°) + every font face, « PAS REÇU. » `setup()` |
| `overlay/render.mjs` | lead | deterministic Chromium renderer: `--mb`, `--scenes`, `--times`, `--frames`, TIMING injection, all fonts pre-loaded |
| `overlay/kit.js`, `overlay/scenes/00_money.js` | read-only | prix-de-revient kit and money props (unchanged copies) |
| `overlay/scenes/01_score.js` | lead (+ QA edits) | THE SCORE: `T, DUR, W, WE, A, G`, one pure state function per object, light, camera, gecko, `soundCues()` (54), `music()` |
| `overlay/scenes/02_light.js` | lead | daylight `lit / lightAt / castShadow / softPath` |
| `overlay/scenes/20_money.js` | M1 (+ 1 QA edit) | `MC_note, MC_scissors, MC_sneaker, MC_envelope, MC_box, MC_calc, MC_stamp, MC_pile, MC_crumb` (sprites baked once) |
| `overlay/scenes/40_gecko.js` | lead (+ 1 QA edit) | the « PAS REÇU. » margouillat, adapter `SCORE.geckoView()` |
| `overlay/scenes/50_compose.js` | lead | camera + draw order; calls `MC_* / BZ_* / K_* / TY_*`, fallbacks when a module is absent |
| `overlay/scenes/60_type.js` | lead (+ QA edits) | chip, EXEMPLE FICTIF, hook price tag + stamp, TOI cards/pill, title, dare pill, rule band, Bonzini band |
| `overlay/scenes/70_bonzini.js` | M2 (+ 2 QA edits) | `BZ_light, BZ_plate, BZ_reception, BZ_endcard, BZ_ritual, BZ_cta, BZ_loop`; reusable in the 5 episodes: `BZ_ritualStamp(x, y, k, o)`, `BZ_ctaPill(x, y, word, o)` |
| `data/script.json` | lead | the 12 voice lines (ids N1 N2 T1 N3 N4 N5 N6 N7 T2 N8 N9 N10) |
| `data/timing.json` | lead | real voice starts, `dur`, `words` (relative), `end` — injected as `window.TIMING`, read from disk by node |
| `data/timeline_main.json` | lead | `{frames: N}` (render.mjs overrides it from `timing.json`) |
| `lib/audio_ep1.py`, `audio/` | lead | music + SFX from the score's cues, mix |
| `out/qa_sheet.jpg` | QA | stage-3 check sheet (the other `out/*.jpg` are the stage 1–2 sheets) |
| `tools/qa_score.js` | v2 integration | score QA (§6.3 constraints, holds, order, impacts out of the speech, simulated re-timings) |
| `out/v2chk_sheet.jpg`, `out/v2chk/` | v2 integration | 18 check stills on the v2 defaults |

## The score contract (PIPELINE.md)
- `T[id]` = speech start of each line of `data/script.json`, `T.end` = film duration. The storyboard's N1 is split into
  N1 + N2 in the script, so storyboard N2…N9 = script N3…N10. Defaults = SCRIPT_V2.md §6.1 (44.54 s).
- `DUR[id]` defaults = storyboard estimates; TIMING merge: numeric keys → `T`, `TIMING.dur` → `DUR`, `TIMING.words` → `W`.
- `W(id, prefix | [prefixes], nth, fallback)` / `WE(…)` (word end): accent/case-insensitive, elisions stripped, fallback
  offset scaled by `DUR/DUR0`. v2: no « Tchac » / « Guangzhou » prefix any more (the cuts are `END(line) + .1`; « en Chine » = `'chin'`).
- Every action time is in `A`, derived after the merge (no literal time anywhere in the modules: they read `SCORE.A`).

## T / W anchors (v2 defaults; « real » = after the lead's re-timing on the v2 takes)
Defaults (`SCRIPT_V2.md` §6.1): `T = {N1 .40, N2 3.91, T1 6.81, N3 9.55, N4 12.09, N5 14.46, N6 17.38, N7 23.0, T2 27.97, N8 29.68,
N9 33.24, N10 39.47, end 44.54}`, `DUR0 = {N1 3.06, N2 2.5, T1 2.14, N3 1.94, N4 1.67, N5 2.22, N6 5.02, N7 4.47, T2 1.31, N8 3.06,
N9 5.83, N10 4.47}`. Every W fallback is measured on these (3.6 syllables/s) and scaled by DUR/DUR0.

| action | anchor | default |
|---|---|---|
| two dry snips (before the voice) | `0` and `max(.12, T.N1 − .2)` | 0 / 0.20 |
| TCHAC 1 (sound alone) / slide into FOURNISSEUR | `min(end(N1) + .03, T.N2 − .12)` / cut1 + .27 → + .87 | 3.49 / 3.76–4.36 |
| stamp « PAYÉE 5 000 F EN CHINE » | `W(N2, 'pay', 1.1) + .2` | 5.21 |
| register « ding » | `max(slide1[1] + .05, end(N2) + .05)` | 6.46 |
| « TU GAGNES COMBIEN ? » (held until the stamp) | `max(end(N2) + .06, stampBuy + 1.4)` → `stampInv − .1` | 6.61–20.10 |
| TOI card « Facile ! / Je gagne / 5 000 F ! » | `T.T1 − .12` → `max(dare − .05, in + 1.45)` | 6.69–8.71 |
| « 5 000 ? » blinks | `W(T1, 'cinq', 1.3)`, + .62 | 8.11 / 8.73 |
| « Tu dis combien ? ↓ » | `WE(T1, 'franc', 1.9) + .05`, held 1.45 | 8.76 |
| 3 tic-tacs, makossa in | `end(T1) + .05 / .3 / .55` | 9.0 / 9.25 / 9.5 |
| TRANSPORT / −1 000 / TCHAC 2 (+ horn at + .12) | `W(N3,'transp',.55) − .25` / `min(W(N3,'mil',1.4), +.6)` / `end(N3) + .1` | 9.85 / 10.45 / 11.59 |
| DOUANE / −3 000 / sticker | `max(W(N4,'douane',.28) − .25, landT + .1)` / `min(W(N4,'trois',.85), +.6)` / +.5 | 12.19 / 12.79 / 13.29 |
| double TCHAC, startle, crumbs | `end(N4) + .1`, + .3 | 13.86 / 14.16 |
| PETITS FRAIS / −500 / words / TCHAC 4 | `max(W(N5,'frais',.85) − .25, landD + .1)` / `min(W(N5,'cinq',1.4), +.6)` / +.35 + .16 i / `end(N5) + .1` | 15.06 / 15.66 / 16.01… / 16.78 |
| box / lid / two left feet | `landF + .1` / + .15 / + .15 | 17.38 / 17.53 / 17.68 |
| stamp NE SE VENDENT PAS | `WE(N6, 'pas', 2.8) + .02` | 20.20 |
| strip « payées quand même : −500 par paire vendue » | `min(max(stampInv + .25, W(N6,'pay',3.9) − .45), musicCut + .3 − 1.75)` | 20.83 |
| last cut = music cut / box to the row | `end(N6) + .1` / `max(musicCut, cutI + .65)` | 22.50 / 23.15 |
| giant card falls / « = 0 » / impact / coin lies down | `min(T.N7 + .1, zeroStamp − .75)` / `W(N7, ['zer','zero','0'], 3.6)` / `end(N7) + .02` / + .25 | 23.10 / 26.60 / 27.49 / 27.74 |
| « Quoi ? Zéro franc ? » | `T.T2 − .05` → `max(end(T2) + .15, T.T2 + 1.45)` | 27.92–29.43 |
| major / rule lines | `T.N8 − .1` / `W(N8,'compt',.55)`, `W(N8,'avant',1.1)` | 29.58 / 30.23 / 30.78 |
| pile (eighth notes) / label | `max(major + .4, toiZeroEnd + .3) + .25 i` / `max(W(N8,'tout',.85), stack0 + .1)` | 29.98… / 30.53 |
| arrow / « TON VRAI PRIX » | `max(stack4 + .3, min(W(N8,'fix',1.95) − .15, brandIn − 1.8))` / + .35 | 31.32 / 31.67 |
| figures leave / violet light | `brandIn − .3 → + .2` / `T.N9 − .12 → + .5` | 32.82 / 33.12 |
| signature / enamel plate | `W(N9,'bonz',.55) − .05` / `W(N9,'bonz',.55)` | 33.74 / 33.79 |
| carton in / scan / scale / tape | `min(W(N9,'colis',2.75) − .45, plate + .45)` / `W(N9,'colis')` / `W(N9,'pes',3.6)` / `W(N9,'mesur',4.45)` | 34.24 / 35.99 / 36.84 / 37.69 |
| band line 1 / line 2 « EN CHINE » | `W(N9,'colis') − .25` / `max(band + .3, min(W(N9,'chin',5.4) − .12, endcard − 1.55))` | 35.74 / 37.62 |
| PESÉ ✓ / MESURÉ ✓ | weigh + .3 / measure + .45 | 37.14 / 38.14 |
| end card / CTA « Écris CALCUL » / share + gulps | `end(N9) + .1` / `max(W(N10,'ecri'), endcard + .15)` / cta + .55, + 1.05 | 39.17 / 39.47 / 40.02 |
| ritual « MAINTENANT, TU SAIS. » | `W(N10, 'maint', 3.08)` | 42.55 |
| loop | `T.end − .5` → `T.end` | 44.04–44.54 |

Music plan (defaults): `{silentUntil: 9.5, tenseFrom: 9.5, skip: [14.16], cut: 22.5, majorFrom: 29.58, sigAt: 33.74, end: 44.54, bpm: 120}`.
Re-timing constraints (§6.3, checked by `tools/qa_score.js`): silences N1→N2 .45 · N2→T1 .40 · T1→N3 .60 · N3→N4 .60 ·
N4→N5 .70 · N5→N6 .70 · N6→N7 .60 · N7→T2 .50 · T2→N8 .40 · N8→N9 .50 · N9→N10 .40; `T.T1 ≥ challenge + .05`,
`T.N3 ≥ tics[2] + .05`, `feet ≤ W(N6,'cinq') − .5`, `T.T2 ≥ coinSettle + .2`, `brandIn − priceTag ≥ 1.4`,
`T.end ≥ max(end(N10) + .5, ritual + 1.9)`.

## v1 stage 3 (history, v1 times)
## Stage 3 QA — what was checked
- 29 stills across the film at `--mb 4` (sheet + full-size crops of every key sentence + 360 px-wide downscale at 50 %
  brightness); transitions re-checked frame by frame (scissors exit, brand entry, end card, CTA/share line, loop).
- Page errors: none (real timing, defaults, stretched 38.3 s without word lists — a frame every 0.4 s each).
- Node check of every derived time under the 3 timings: all finite, every text of `TEXTS()` held ≥ 1.4 s, the pile / tag /
  band / carton / box ordering holds.
- Loop: frame 1016 vs frame 0 at `--mb 1`: mean |Δ| 1.5 / 255, 1 144 px > 40 (margouillat breathing + sub-pixel scissors).
  At `--mb 4`, frame 0 also carries the blur of the hook's first snip (it starts at t = 0), so the seam is a continuous motion.
- Facts on screen: only the fictional example (10 000 · 5 000 · −5 000 · −1 000 · −3 000 · −500 · −500 · RESTE → 0 · 5 paires
  sur 100), « EXEMPLE FICTIF » from frame 0 to the end, the sticker « exemple · dépend du code du produit », the fictional
  label BZ-000000, no figure near the brand (dial and tapes: ticks only). Violet only from `A.brandIn` (light, plate, laser,
  stamps, end card) and fading out during the loop. Series identity present: chip « JE SAVAIS PAS. · 1/5 », amber TOI pill,
  margouillat, ritual stamp, CTA pill « Écris TCHAC en commentaire ↓ ».

## Stage 3 QA — fixes
1. **Scissors popped out** at the music cut (16.51 s): on the real takes `kk(cutI + .5, musicCut)` was inverted. Now an
   explicit exit window `A.scExit = [cutI + .4, cutI + .85]` (they fly off right).
2. **The last slice chased the box** (the box left for the row at the music cut, before the slice landed): `A.boxOut` now waits
   for the slice.
3. **« DÈS GUANGZHOU » held 0.66 s** (revealed on the word, cut by the end card): line 2 now appears at `A.bzLine2`
   (≥ 1.4 s before the end card; 1.55 s on the real takes), the band no longer shows a half-empty second line for long.
4. **« TON VRAI PRIX » readable ~0.7 s**: the pile now stacks on eighth notes, starts once « …zéro ?! » has left the slot (they
   overlapped), and the arrow/tag are placed so the tag is held ≥ 1.4 s (1.48 s real, 1.45 s default).
5. **Figures next to the brand**: the pile (every amount) now leaves 0.3 s before the violet and is gone before the plate lands
   (`A.figOut`); the felt-pen arrow retracts instead of stretching across the frame; the tag (no figure) leaves with the light.
6. **1.4 s of empty violet table** between the plate and the carton: the carton now slides in 0.45 s after the plate lands.
7. **Headline zone empty for 8 s** during the cuts and **5 text blocks at 5.2 s**: « IL GAGNE COMBIEN ? » now stays up through
   the cuts (the question the calculator answers), settling at 96 px once the dare pill has gone, and fades for the INVENDABLES
   stamp; TOI's first card gives way to the dare pill (held 1.67 s instead of overlapping it).
8. **Calculator « ? » badge covered « BILLET »**: perched above the corner, right edge ≤ x 960.
9. **CTA caret read « TCHACI »**: thin ink caret with a gap (still 1 Hz).
10. **Share line**: was missing its « × 2 » during my first edit (fixed), now in full ink (too faint on violet at 50 %), raised
    to y 1370 so it clears the margouillat's head.
11. **Safe zones**: chip moved to y 182 (its top was at y 149); the row of done envelopes shifted left (last item's « ?! » was
    at x ≈ 985 in the right-hand UI band); the Bonzini band text 12 px left (right edge 946 instead of 958).
12. **Loop seam**: the scissors' opening and the margouillat (target = the scissors flying back, smug face ends with its window)
    now land on frame 0.

## Known limits after the v1 stage 3 (history, v1 times and texts; the v2 risks are in the next section)
- **Audio is stale** for 6 cues (see top): re-run `lib/audio_ep1.py` before the final mux.
- 3.33–5.0 s: four groups on screen (title, FOURNISSEUR −5 000, calculator, TOI's card) — they read as one equation; the
  5-trader test decides. The doodles « taux · pousseur · taxi · crédit » (≈ 28 px) and the row of done envelopes are
  decoration, not readable at phone size; the douane sticker (legal mention, ≈ 30 px) is small on a phone.
- 0–2.8 s and during the cuts the bottom third (y 1000–1540) holds only the margouillat and the row: a composition choice of
  the layout, not a safe-zone issue.
- The enamel plate falls in from above the frame (it crosses y < 150 for ~0.15 s on its way down).
- The margouillat's crumb flies across « Partage » for one or two frames at the first gulp (30.0 s).
- Stamp « ACHETÉE 5 000 F EN CHINE » is held 1.43 s on the real takes (just above the bar): any re-timing that shortens
  `T.T1 − W(N2,'achet')` drops it under 1.4 s.

## v2 — open risks for the re-timing (lead)
- `serie/retime.py` keeps the default spacing but a take LONGER than its `DUR0` eats the silence down to `--gap` (0.12 s): it
  does not know the §6.3 minimum silences nor the action constraints. `node tools/qa_score.js` flags them on the real
  `timing.json`; with takes × 0.9…1.15 the simulation breaks `T.N3 ≥ tics[2] + .05` and `T.T2 ≥ coinSettle + .2` in ~60 %
  of runs (takes × 0.85…1.0: none). Tightest: `T.T1 ≥ W(N2,'pay') + 1.65` (PAYÉE held 1.4 s), only 0.15 s of slack on the defaults.
- `retime.py` floors the tail after N10 at 1.2 s (default tail 0.6 s): takes equal to `DUR0` give **45.14 s**, over the 45 s
  budget; the constraint itself only needs `T.end ≥ max(end(N10) + .5, ritual + 1.9)`.
- The boing (0.7 s) can still ring when « cinq paires » starts if the N6 take is fast (warning in `qa_score.js`; it is on the
  ducked SFX bus at g .6).
- `calc_zero` (`cutI + .5`) lands on the first syllable of N7 (« Ton ») on the defaults: a short, ducked beep, left as is.
- The title lands at 1.35× (2 frames at alpha ≤ .5 wider than the frame, as in v1); settled it is 972 px wide (54 px margins),
  96 px after the dare pill.
- The CTA pill bounces to ≈ 1.09× for ~0.15 s when it appears (its right edge passes x 960 for those frames, as in v1).

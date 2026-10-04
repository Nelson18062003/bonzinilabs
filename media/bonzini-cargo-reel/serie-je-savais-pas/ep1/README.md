# « JE SAVAIS PAS. » · 1/5 — « TCHAC ! » Prix chinois × 2 = ? — episode folder

**Status: stage 3 (integration & QA) done.** The whole film renders with every module (M1 money & cuts, M2 Bonzini & end,
the margouillat, the type layer), no page error, on the real voice timing (`data/timing.json`, 33.9 s = 1017 frames), on
the storyboard defaults (31.5 s) and on a stretched timing without word lists (38.3 s). The full render has NOT been run
(lead's job, after the final re-timing). QA sheet: **`out/qa_sheet.jpg`** (29 stills, `--mb 4`, real timing).

Render (lead): `cd overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg`
(N follows `data/timing.json` `end`: `N = round(end × 30)`; 1017 today). Stills: `--times a,b,c --pages 2`.
Times: `cd overlay && node -e "const S=require('./scenes/01_score.js'); console.log(S.T, S.A)"`.

**After any score change, re-run the audio** (`lib/audio_ep1.py` reads `SCORE.soundCues()` / `SCORE.music()` live):
stage 3 moved 6 cues (the 4 last `stack`, the arrow `marker`, the tag `pop`), so `audio/mix.wav` of 14:01 is stale.

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

## The score contract (PIPELINE.md)
- `T[id]` = speech start of each line of `data/script.json`, `T.end` = film duration. The storyboard's N1 is split into
  N1 + N2 in the script, so storyboard N2…N9 = script N3…N10. Defaults = storyboard (31.5 s).
- `DUR[id]` defaults = storyboard estimates; TIMING merge: numeric keys → `T`, `TIMING.dur` → `DUR`, `TIMING.words` → `W`.
- `W(id, prefix | [prefixes], nth, fallback)` / `WE(…)` (word end): accent/case-insensitive, elisions stripped, fallback
  offset scaled by `DUR/DUR0`. « Tchac » = `['tch', 'chak']`, « Guangzhou » (tts « Gouangzou ») = `['gu', 'go']`.
- Every action time is in `A`, derived after the merge (no literal time anywhere in the modules: they read `SCORE.A`).

## T / W anchors (default → real takes of 14:00)
| action | anchor | default | real |
|---|---|---|---|
| dry snips (hook) | 0 and `T.N1 + DUR.N1·.5` | 0 / 0.47 | 0 / 0.82 |
| TCHAC 1 | `min(end(N1) + .03, T.N2 − .12)` | 0.93 | 1.59 |
| slide into FOURNISSEUR (on twos) | cut1 + .27 → + .87 | 1.20–1.80 | 1.86–2.46 |
| stamp « ACHETÉE 5 000 F EN CHINE » | `W(N2, 'achet') + .2` | 1.40 | 1.91 |
| « IL GAGNE COMBIEN ? » (held until INVENDABLES) | `min(end(N2) + .06, T.T1 − .05)` → `stampInv − .1` | 2.85–12.9 | 3.39–14.31 |
| TOI card « Facile : 5 000 de bénéfice ! » | `T.T1 − .12` → `max(dare − .05, in + 1.45)` | 2.78–4.65 | 3.33–5.00 |
| « 5 000 ? » blinks | `W(T1, 'cinq')`, + .62 | 3.45 / 4.07 | 3.76 / 4.38 |
| « Tu dis combien ? ↓ » | `WE(T1, 'benef') + .05`, held 1.45 | 4.70 | 5.05 |
| 3 tic-tacs, makossa in | `end(T1) − 1, −.5, 0` | 3.9 / 4.4 / 4.9 | 4.12 / 4.62 / 5.12 |
| TRANSPORT / −1 000 / TCHAC 2 | `W(N3,'transp') − .25` / `min(W(N3,'mil'), +.6)` / `W(N3, tch)` | 4.9 / 5.5 / 6.4 | 5.38 / 5.95 / 6.91 |
| DOUANE / −3 000 / sticker | `max(W(N4,'douane') − .25, landT + .1)` / `min(W(N4,'trois'), +.6)` / +.5 | 7.0 / 7.6 / 8.1 | 8.07 / 8.67 / 9.17 |
| TCHAC TCHAC, startle, crumbs | `W(N4, tch, 0)`, `W(N4, tch, 1)` | 8.6 / 8.9 | 9.99 / 10.57 |
| PETITS FRAIS / −500 / doodles / TCHAC 4 | `max(W(N5,'frais') − .25, landD + .1)` / `min(W(N5,'cinq'), +.6)` / +.35 + .16 i / `W(N5, tch)` | 9.7 / 10.3 / 10.65… / 11.4 | 11.17 / 11.68 / 12.03… / 12.96 |
| box / lid / two left feet | `max(T.N6 − .15, landF + .1)` / +.2 / +.22 | 12.0 / 12.2 / 12.42 | 13.56 / 13.76 / 13.98 |
| stamp INVENDABLES | `W(N6, 'cent') + .1` | 13.0 | 14.41 |
| last cut → box / scissors leave | `W(N6, tch)` / `cutI + .4 → + .85` | 14.9 / 15.3 | 16.10 / 16.50 |
| music cut / box to the row | `end(N6) + .1` / `max(musicCut, cutI + .65)` | 15.4 / 15.55 | 16.51 / 16.75 |
| giant stamp falls / « = 0 » | `min(T.N7 + .1, zero − .75)` / `W(N7, 'zer')` | 15.7 / 17.8 | 17.29 / 19.10 |
| « …zéro ?! » | `T.T2 − .05` → `max(end(T2) + .15, T.T2 + 1.45)` | 18.25–19.75 | 19.84–21.34 |
| major / rule lines | `T.N8 − .1` / `W(N8,'compt')`, `W(N8,'avant')` | 19.0 / 19.65 / 21.65 | 20.59 / 21.06 / 22.64 |
| pile (eighth notes) / label | `max(major + .4, toiZeroEnd + .3) + .25 i` / `max(W(N8,'tout'), stack0 + .1)` | 20.05… / 20.15 | 21.64… / 21.74 |
| arrow / « TON VRAI PRIX » | `max(stack4 + .3, min(W(N8,'fix') − .15, brandIn − 1.8))` / + .35 | 21.38 / 21.73 | 22.94 / 23.29 |
| figures leave / violet light, tag leaves | `brandIn − .3 → + .2` / `T.N9 − .12 → + .5` | 22.88 / 23.18 | 24.47 / 24.77 |
| signature / enamel plate | `W(N9,'bonz') − .05` / `W(N9,'bonz')` | 23.55 / 23.6 | 24.96 / 25.01 |
| carton in / scan / scale / tape | `min(W(N9,'colis') − .45, plate + .45)` / `W(N9,'colis')` / `W(N9,'pes')` / `W(N9,'mesur')` | 24.05 / 25.2 / 25.9 / 26.35 | 25.46 / 26.63 / 27.05 / 27.55 |
| band line 1 / line 2 « DÈS GUANGZHOU » | `W(N9,'colis') − .25` / `max(band + .3, min(W(N9,['gu','go']) − .12, endcard − 1.55))` | 24.95 / 26.25 | 26.38 / 27.22 |
| PESÉ ✓ / MESURÉ ✓ | weigh + .3 / measure + .45 | 26.2 / 26.8 | 27.35 / 28.00 |
| end card / CTA / share + gulps | `end(N9) + .1` / `max(W(N10,'ecri'), endcard + .15)` / cta + .55, + 1.05 | 27.8 / 27.95 / 28.5 | 28.77 / 29.49 / 30.04 |
| ritual « MAINTENANT, TU SAIS. » | `W(N10, 'maint')` | 29.6 | 31.71 |
| loop (note re-forms, scissors + gecko back to frame 0) | `T.end − .5` → `T.end` | 31.0–31.5 | 33.4–33.9 |

Music plan (real): `{silentUntil: 5.12, tenseFrom: 5.12, skip: [10.57], cut: 16.51, majorFrom: 20.59, sigAt: 24.96, end: 33.9, bpm: 120}`.

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

## Known limits (left for the lead)
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

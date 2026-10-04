# « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5)

**Status: stage 3 (integration & QA) is done.** The whole film renders with every module (M1 « carton & air », M2
« Bonzini & end », the margouillat, the type layer), with no page error, on the real voice timing (`data/timing.json`,
34.28 s, 1028 frames). The full render has **not** been run: the lead runs it after re-timing.

The contract is `../PIPELINE.md`, the module APIs are in `MODULES.md` (its « Key times » list holds the pre-QA defaults;
read `SCORE.A` for the real ones), and the storyboard is `../SERIE.md` « Épisode 2 ».

## Render
- Check stills: `cd overlay && nice -n 5 node render.mjs --times 0.3,5.6,15.9,28.0 --out ../out/chk --pages 2 --mb 4 --jpg`
- The full film, for the lead only, after re-timing:
  `cd overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg` (N = 1028 today)
- A contact sheet: `python3 tools/sheet.py out/<dir> out/<sheet>.jpg 5`
- **Score QA**, after every re-timing: `node tools/qa_score.js 40`. It checks the real timing and 40 jittered re-timings
  (voices ±0.4 s, durations ±15 %). It reports any non-finite time, any action out of order, any key text held under
  1.4 s, more than 3 text blocks at once, and a measure that would fall under N2's voice. It prints `OK — no issue` today.
- Regenerate the timeline after re-timing (from E):
  `node -e "const S=require('./overlay/scenes/01_score.js');require('fs').writeFileSync('data/timeline_main.json',JSON.stringify({frames:S.N,chapters:[{id:'all',start:0,end:S.T.end}],segments:[]}))"`

## Files
| File | Owner | Contents |
|---|---|---|
| `overlay/engine.html`, `kit.js`, `render.mjs` | lead | The Kraft & Fil engine (every font declared), the explainer-v2 kit unchanged, and the « PAS REÇU. » renderer (TIMING injection, `--mb`, `--times`, `--scenes`). |
| `overlay/scenes/00_money.js` | shared | prix-de-revient props (`priceTag`, `handText`, `marker`…). |
| `overlay/scenes/01_score.js` | lead (+ QA) | **The score**: `T`, `DUR`, `W`/`WE`, `A`, `G`, every state as a pure function of t, `TEXTS()`, `soundCues()`, `music()`. |
| `overlay/scenes/02_light.js` | lead | The day light API (`lit`, `shadowOff`, `softPath`, `castShadow`). |
| `overlay/scenes/30_carton.js`, `32_air.js`, `34_plates.js`, `36_measure.js` | M1 | `CA_carton`, `CA_table`, `CA_air`, `CA_plate`, `CA_fx`, `CA_measure`, `CA_split`, `CA_glass`. |
| `overlay/scenes/39_gecko_shim.js`, `40_gecko.js`, `41_gecko_unshim.js` | lead | The validated margouillat, unchanged, plus its adapter (`SCORE.geckoShim()`). |
| `overlay/scenes/50_compose.js` | lead | Camera, draw order, module calls (fallbacks unused now). |
| `overlay/scenes/60_type.js` | lead (+ QA) | Series chip, pills, captions (with big `^` lines), the end-card parts no module takes over. |
| `overlay/scenes/70_bonzini.js`, `76_end.js` | M2 | `BZ_band`, `BZ_atmos`, `BZ_onCarton`, `BZ_scene`, `BZ_plate`, `BZ_end`. |
| `lib/audio_ep2.py` | lead (+ QA) | Audio; it reads `SCORE.soundCues()`/`music()` live through node. Its Python replica `derive_score()` (fallback only) now mirrors the QA timing changes; the two give the same 54 cues. |
| `tools/sheet.py`, `tools/qa_score.js` | lead / QA | Contact sheet; score QA (above). |
| `out/qa_sheet.jpg` | QA | **The QA sheet**: 25 stills from 0 to 34.25 s, `--mb 4`. |
| `out/animatic_sheet.jpg`, `chk_M1_sheet.jpg`, `chk_M2_sheet.jpg`, `chk_audio_sheet.jpg` | earlier stages | Earlier check sheets. |

## Score API (`window.SCORE` / `require('./overlay/scenes/01_score.js')`)
- `T` holds the voice starts (N1 T1 N2 N3 T2 N4 N5 N6 N7 N8) and `end`; `DUR` holds the speech durations. `data/timing.json`
  overrides both: `{N1: s, …, end, dur: {id: s}, words: {id: [{w, s, e}]}, A: {optional hand overrides}}`, with word
  times relative to each line's start.
- `W(id, prefix, nth, fb)` / `WE(…)` return the start or end of a word. Matching ignores accents, case and elision.
- `A` holds every action time, derived after the merge. `N = round(T.end · 30)`.
- States: `cartons`, `heroCarton`, `beforeCarton`, `loopCarton`, `cartonGeo`, `cartonJit`, `air`, `airMini`, `plates`, `tape`,
  `formula`, `split`, `glass`, `band`, `bzPlate`, `bz`, `endcard`, `pills`, `TEXTS()`, `light`, `camera`, `gecko`.
- `TEXTS()` rows are `[t0, t1, id, text, style, takeover]`. In a text, `|` is a line break and `*…*` is orange emphasis.
  **QA addition:** a caption line starting with `^` is a big line (title size, 96–116 px).
- `soundCues()` returns 54 cues `{t, name, g, pan}`. `music()` returns `{silentUntil, tenseFrom, cut, majorFrom, sigAt, end}`.

## T/W anchors used (every time is derived; values are on the real timing)
- **Hook:** the margouillat hops at `N1+.05`, and the burst peaks at `N1+.4` (0.50 s). The title leaves at `T1−.25`, and
  TOI's plate rises at `T1−.1`.
- **N2:**
  - LE BATEAU crushes TOI's plate on `W(N2,'place')` (5.11 s);
  - « AU m³ » stamps on `W(N2,'cube')` (5.79 s);
  - **the plate leaves at `max(END(N2)−.05, place+1.45)`** (6.56 s).
- **The silent measure:** it starts `.35` after the plate leaves (6.91 s), with the clacks every `GAP ≤ .5 s`
  (6.91, 7.41, 7.91), the formula box at 8.31 s, and the formula leaving at `max(W(N3,'carton')+.5, clac3+1.45)` (9.63 s).
- **N3:**
  - the flank lifts at `N3−.1`;
  - the hatching runs from `W(N3,'carton')+.15`;
  - « LE VIDE, TU LE PAIES AUSSI. » comes in `.18` after the formula leaves (9.81 s);
  - the cloud settles at `W(N3,'vide')+.2`.
- **T2:** the music cuts at `T2−.2`, and TOI's small plate comes in at `T2−.05`.
- **N4:**
  - the repack poses fall on `W(N4,'ton')`, `W(N4,'cartons')` and `W(N4,'remplis')`, each held at least .75 s;
  - the cloud is chased at `pose3+.2` and gulped `.55` later (17.97 s).
- **N5 / N6:**
  - AVANT / APRÈS starts at `N5−.1`, with the major music;
  - the bubble wrap runs from `W(N6,'pas')−.15` to `W(N6,'protection')+.35`;
  - ENSUITE comes at `END(N6)+.1` (23.92 s).
- **N7:**
  - **the violet comes on at `max(N7−.15, ensuite+.25)`** (24.25 s);
  - the plate lands and the balafon plays on `W(N7,'bonzini')`;
  - the scan fires on `W(N7,'cartons')`, and the tape runs on `W(N7,'sont')`;
  - the readout appears on `W(N7,'mesures')`, and « MESURÉ ✓ » lands on `WE(N7,'mesures')+.1`.
- **N8:**
  - **the end card comes in at `max(N8−.15, measured+1.45)`** (29.15 s);
  - the CTA comes in at `max(N8, endcard+.15)`;
  - the stamp hits on `W(N8,'maintenant')−.1` (32.05 s);
  - the loop carton trembles from `end−.55`, and the texts are gone at `end−.12`.

## QA (stage 3): what was checked
- **Stills:** about 80 stills at `--mb 4` (hook, every key sentence, every transition, the loop seam), plus a sweep of every
  6th frame (173 frames) through the whole film: **no page error**. I looked at full-size crops of every key sentence, a
  360 px downscale of 12 key frames, and a 2× crop of the label.
- **Violet:** measured on the sweep, outside the margouillat's zone. It is exactly 0 % of the pixels before 24.2 s and in
  the last frames (the loop seam is clean), and about 7 % during the Bonzini part.
- **Holds (real timing):**
  - title 2.15 s; TOI 2.5 s; LE BATEAU 1.45 s; AU m³ 3.2 s;
  - formula 1.7 s; LE VIDE 2.0 s; TOI's small plate 2.9 s;
  - BIEN REMPLIS 3.1 s; MOINS DE m³ 2.2 s; PAS LA PROTECTION 2.4 s;
  - BONZINI plate 4.6 s; MESURÉS DÈS LA RÉCEPTION 3.1 s; « MESURÉ ✓ » 1.7 s; MAINTENANT, TU SAIS. 2.1 s.
- **Safe zones:**
  - nothing at y < 150; the chip is at 153–215;
  - below y 1540 there is only table dressing (cutter, tape roll, scraps);
  - no text at x > 960 for y 900–1560: the scanner and the dimension marks there are not text.
- **Series identity:** the chip « JE SAVAIS PAS. · 2/5 » all film long, the TOI amber pill (T1, T2), the margouillat (hop,
  tennis, squint, gulp, hic, pushups), violet only with Bonzini, the stamp « MAINTENANT, TU SAIS. », and the amber CTA
  « Écris CBM en commentaire » with its drawn arrow ↓.
- **Facts:** only what is in « Faits utilisés ». There is no figure: the gauges have no value, the volume is « • m³ », and
  « BZ-482913 » carries « exemple ». « Groupage mer et air · Chine → Douala · Entrepôt : Foyer Balengou » is shown.
  « CHEZ TON FOURNISSEUR » stays up through the whole repack and drops at ENSUITE, so Bonzini never repacks.

## QA (stage 3): what was fixed
1. **LE BATEAU was held only ≈ 1.0 s.** The plate left at `END(N2)+.3−.35` = 6.13 s, so on the real take the key line « AU
   BATEAU, ON PAIE LA PLACE : LE MÈTRE CUBE. » was readable for about 1 s. Its exit is now `max(END(N2)−.05, place+1.45)`,
   and the silent measure follows it, still in the N2–N3 silence. **This moves 7 sound cues** (3 `clac`, 3 `felt`, and the
   formula `stamp`, +0.43 s). `mix.wav` (14:02) predates the change: **re-run the audio** (it reads the cues live).
2. **The PHRASE-test key words were body text.** « DES CARTONS BIEN REMPLIS. » was a ≈ 52 px caption line. It is now two
   big lines (≈ 110 px, « BIEN REMPLIS. » in orange) under a smaller « DEMANDE À TON FOURNISSEUR : ». Captions now move
   down so they never overlap the fixed pill « CHEZ TON FOURNISSEUR » (`60_type.js caption()`).
3. **A third-party brand was on the label.** The real label's « 微信 WECHAT » field was replaced by its « 邮箱 EMAIL »
   field (blurred value). It is tiny, but the BRIEF forbids third-party names (`70_bonzini.js`).
4. **Two texts overlapped.** The formula and « LE VIDE, TU LE PAIES AUSSI. » cross-faded in the same zone (9.73–9.83 s).
   The caption now waits for the formula: `capVide = max(hatch0+.45, formulaOut+.18)`.
5. **Guards against the lead's re-timing,** found by the jitter runs; they do not change the real-timing values:
   - violet can never come on before the ENSUITE band (it could land beside « CHEZ TON FOURNISSEUR »);
   - « MESURÉ ✓ » is held at least 1.45 s before the end card;
   - the full formula is held at least 1.45 s.
6. `data/timeline_main.json` is regenerated (its chapter end was still 32.5 s; it now ends at 34.28 s, 1028 frames).

## Known limits / what remains
- **The end card has 4 elements**: the logo lockup with the service lines, the stamp, the CTA pill, and the tag line written
  on the carton. This is the series ritual, as the storyboard asks; counted as CTA + tag = one call, it is 3.
- **The ENSUITE band is readable for about 0.5–0.8 s** (silent, one word; the storyboard asks for 0.6 s). It sits between
  END(N6) and N7, and the gap is 0.58 s on today's takes.
- **Keep at least .5 s between END(N6) and N7 when re-timing.** Otherwise the violet can land up to about .15 s after the
  enamel plate (both are Bonzini, so it is harmless), and the band runs over the start of N7.
- The series chip slightly covers the cardboard edge of the hook's title plate (top-left corner, about 10 px). The chip
  reads cleanly and the orange face is untouched; moving the plate down would collide with the burst cloud.
- **The ritual stamp is held 2.1 s only because `T.end` = 34.28.** If the lead shortens the tail, keep
  `T.end ≥ W(N8,'maintenant') + 1.55`.
- **For the patron to validate (storyboard):** the wording « mesurés dès la réception en Chine » and the readout
  « VOLUME : • m³ ».

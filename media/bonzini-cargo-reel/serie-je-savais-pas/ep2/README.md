# « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5)

**Status: v2 voices (clear diction) integrated on the score DEFAULTS — waiting for the lead's re-timing.** The voice-over was
rewritten (`SCRIPT_V2.md`, `data/script_v2.json`: 14 lines N1 T1 N2 N2b N3 N3b T2 N4 N4b N5 N6 N7 N8 N8b, keyword
**CARTON**). The pictures, the on-screen texts, the sound cues and the audio replica follow it. `data/timing.json` is removed
on purpose: the score runs on its defaults (`SCRIPT_V2.md` §7.1, 3.6 syllables/s) — **44.76 s, 1343 frames**
(`data/timeline_main.json` regenerated). The v1 data is archived as `data/*_v1.json`, `audio/vo_v1/`.

**For the lead, in this order** (`SCRIPT_V2.md` §7.5): copy `data/script_v2.json` over `data/script.json`; takes.json +
vocheck.json for the 14 ids; `python3 ../retime.py . --tail 0.5` (retime's `--tail` = the minimum tail, 1.2 s by default
≈ 45.5 s; 0.5 keeps the storyboard's tail: `end = END(N8b) + .5 ≥ stampEnd + 1.45`, QA checks it); `node tools/qa_score.js 40`
(read its WARN lines too); regenerate the timeline (below); the mix; `listen_test.py`.

## Render
- Check stills: `cd overlay && nice -n 5 node render.mjs --times 0.3,6.5,11.8,13.5,16.3,19.5,25.3,28.8,32.2,36.5,38.9,43.6 --out ../out/chk --pages 2 --jpg`
  (v2 key moments on the defaults; take them from `SCORE.A` after re-timing).
- The full film, for the lead only, after re-timing:
  `cd overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg` (N = 1343 on the defaults)
- A contact sheet: `python3 tools/sheet.py out/<dir> out/<sheet>.jpg 5`
- **Score QA**, after every re-timing: `node tools/qa_score.js 40`. It checks `data/timing.json` (or, while it is absent, the
  defaults twice: with the `SYL` fallbacks, and with synthetic words spread by syllable over DUR) and 40 jittered re-timings
  that follow retime.py's rule (takes ±15 %, ±.1 s onset noise, default spacing kept, so a slow take shortens the pause after
  it); `--harsh` = the stage-3 stress test (starts ±.4 s). It reports any non-finite time, any action out of order, any key
  text held under 1.4 s, more than 3 text blocks at once, a measure under N2b's voice, a BOUM after N2 starts, a ritual stamp
  after N8b starts, `end` too short, and (v2) **any loud cue (`pouf_air boum_carton letters_splash stamp clac
  scotch_scriiitch gloup hic bubble_plop bonzini_sig tonk label_slap stamp_big kaching_soft sweat_drop`) starting inside a
  word** (a line's last word counted up to `END(id)`). WARN lines: END(N6) → N7 under .5 s, and the CTA pill landing after
  « carton ». Today: `OK — no issue` on the defaults; the 40 jitter runs only flag the risks listed below.
- Regenerate the timeline after re-timing (from E):
  `node -e "const S=require('./overlay/scenes/01_score.js');require('fs').writeFileSync('data/timeline_main.json',JSON.stringify({frames:S.N,chapters:[{id:'all',start:0,end:S.T.end}],segments:[]}))"`
- Audio replica check (no mix): `python3 -c "import sys;sys.path.insert(0,'lib');import audio_ep2 as X;s=X.score();d=X.derive_score(s['T'],s['DUR'],s['words']);print(s['src'],len(s['cues']),len(d['cues']))"`
  (the live cues and the python replica are identical: 53 cues; it rewrites `audio/score_cues.json`).

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
| `lib/audio_ep2.py` | lead (+ QA) | Audio; it reads `SCORE.soundCues()`/`music()` live through node. Its Python replica `derive_score()` (fallback only) mirrors the v2 score; the two give the same 53 cues. |
| `tools/sheet.py`, `tools/qa_score.js` | lead / QA | Contact sheet; score QA (above). |
| `out/qa_sheet.jpg` | QA | **The QA sheet**: 25 stills from 0 to 34.25 s, `--mb 4`. |
| `out/animatic_sheet.jpg`, `chk_M1_sheet.jpg`, `chk_M2_sheet.jpg`, `chk_audio_sheet.jpg` | earlier stages | Earlier check sheets. |

## Score API (`window.SCORE` / `require('./overlay/scenes/01_score.js')`)
- `T` holds the voice starts (N1 T1 N2 N2b N3 N3b T2 N4 N4b N5 N6 N7 N8 N8b) and `end`; `DUR` holds the speech durations.
  `data/timing.json` overrides both: `{N1: s, …, end, dur: {id: s}, words: {id: [{w, s, e}]}, A: {optional hand overrides}}`,
  with word times relative to each line's start.
- `W(id, prefix, nth, fb)` / `WE(…)` return the start or end of a word. Matching ignores accents, case and elision; v2:
  `'a|b'` matches either prefix (`'pai|pay'`: the ASR writes « payes »). Fallbacks are `SYL(id, k, n)` = k of the line's n
  syllables, a fraction of its real `DUR`, so a word the ASR misses still lands in proportion.
- `A` holds every action time, derived after the merge. `N = round(T.end · 30)`.
- States: `cartons`, `heroCarton`, `beforeCarton`, `loopCarton`, `cartonGeo`, `cartonJit`, `air`, `airMini`, `plates`, `tape`,
  `formula`, `split`, `glass`, `band`, `bzPlate`, `bz`, `endcard`, `pills`, `TEXTS()`, `light`, `camera`, `gecko`.
- `TEXTS()` rows are `[t0, t1, id, text, style, takeover]`. In a text, `|` is a line break and `*…*` is orange emphasis;
  a caption line starting with `^` is a big line (title size, 96–116 px).
- `soundCues()` returns 53 cues `{t, name, g, pan[, d]}` (`d` = the sound's length when it follows a picture: the « fffff »
  of the hatching). `music()` returns `{silentUntil, tenseFrom, cut, majorFrom, sigAt, end}`.

## T/W anchors (v2, `SCRIPT_V2.md` §7.2; values on the defaults)
Rule P1: a loud cue (hit, asmr, brand) never starts inside a word — on a word end (`WE + .03`) or in a pause. For a line's
LAST word the score uses `WEL(id, prefix, n) = max(WE, END(id))`: the ASR stamps the last word ≈ .07–.29 s before the take's
measured speech end (v1 takes, `timing_v1.json`), so `WE` alone would start ka-ching, the m³ stamp, the tape and the plop in
the word's tail. Same in `derive_score()`, `key_windows` (« Chine ») and the QA's word windows. No change on the defaults.

| Beat | Anchor | Default |
|---|---|---|
| hook | hop `max(.05, N1−.25)` · burstPeak `N1+.2` · ka-ching `min(WEL(N1,'air')+.05, T1−.05)` · titleOut `T1−.25` · toiUp `T1−.1` | .05 · .50 · 2.57 · 2.62 · 2.77 |
| LE BATEAU (read by N2) | fall `N2−.3` (guard: after `END(T1)+.05`) · shadow `fall−.25` · m³ stamp `WEL(N2b,'cube')+.03` · out `max(stamp+.15, fall+1.45)` | 5.02 · 4.77 · 11.25 · 11.40 |
| silent measure | mes0 `out+.2`, GAP `cl((N3−.45−mes0)/2.8, .3, .5)`, formula `mes0+2.8·GAP` | 11.60 / 11.91 / 12.22 · 12.47 |
| N3 / N3b | flank `N3b−.1` · formulaOut `max(N3b−.05, mes2+1.45)` · capVide `max(flank+.2, formulaOut+.18)` · hatch `W(N3b,'paies')+.15` · vide `W(N3b,'vide')` · tic `WEL(N3b,'dedans')+.05` | 15.39 · 15.44 · 15.62 · 15.92 · 16.88 · 17.76 |
| T2 | cut `T2−.2` · toiSmall `T2−.05` · sweat drop `END(T2)+.05` | 17.97 · 18.12 · 21.83 |
| N4 / N4b | repack `N4−.15` · pose1 `WEL(N4,'fournisseur')+.03` · pose2 `max(W(N4b,'cartons'), pose1+.75)` · pose3 (tape ASMR) `max(WEL(N4b,'remplis')+.05, pose2+.75)` · chase `min(pose3+.15, split−.5)` · gulp `chase+.45` (guards for a short pause) | 21.98 · 23.83 · 25.07 · 26.51 · 26.62 · 27.07 |
| N5 / N6 | split `N5−.1` · hic `max(END(N5)+.05, gauge1+.55)` · glass `max(N6−.1, hic+.08)` · wrap `W(N6,'protège')−.15` → `max(+.5, WEL(N6,'casser')+.05)` · ENSUITE `END(N6)+.1` | 27.12 · 30.60 · 30.90 · 31.13 → 33.27 · 33.32 |
| N7 Bonzini | violet = sig `max(N7−.25, ensuite+.25)` (guard: before « Chez ») · **plate + tonk `sig+.05`** (before « Chez »; the voice reads it — deviation, see below) · label slap `WE(N7,'cargo')+.03` · capBZ `max(W(N7,'tes')−.1, plate+.1)` · scan `W('cartons')` · tape `W('sont')−.1` · volume `W('mesurés')+.1` · MESURÉ ✓ `WEL(N7,'chine')+.2` (guard: before N8) | 33.57 · 33.62 · 36.07 · 35.94 · 36.32 · 36.77 · 37.25 · 38.74 |
| N8 / N8b | endcard `max(N8−.15, measured+1.45)` · CTA `max(N8, endcard+.15)` (just before « carton », 40.65) · ritual stamp `N8b−.3` (guard: after `END(N8)+.05`) · loop `end−.55` · out `end−.12` | 40.19 · 40.34 · 42.57 · 44.21 · 44.64 |

**Holds on the defaults** (QA trims .14 s at each end of a caption): title 2.62 · TOI 1.95 · LE BATEAU 6.38 · EN MÈTRES
CUBES 4.14 · formula 3.22 · TOI small 3.51 · capVide 2.32 · capN4 4.71 · capN5 3.45 · capN6 2.09 · BONZINI plate 6.57 ·
capBZ 3.97 · MESURÉ ✓ 1.45 · CTA 4.02 · MAINTENANT 2.07. ENSUITE is readable ≈ .45 s (silent band, as before).

**Sound (`soundCues()`, §7.3)**: ka-ching on `A.kaching`; `fill_fffff` .3 for the hatching sweep only (`d`); tic on
`A.videTic`; one sweat drop after T2; pose 2 lowered (cutter .4, fold .5, pffuit .35); bubble wrap .3; tape measure .5;
CTA pop .4. `lib/audio_ep2.py`: `derive_score()` mirrors all this (checked identical), `T0`/`DUR0` = the defaults, the fill
uses the cue's `d`, and the violet grid's bright balafon skips « Bonzini » and « Chine » (`key_windows`).

**Deviations from `SCRIPT_V2.md`** (each one line to revert in `01_score.js` + `derive_score()`):
- **The BONZINI enamel plate lands with the signature, before « Chez »** (`plateBZ = sig + .05`, the tonk in the same
  pause) instead of after « Cargo ». With §7.2's anchor the screen stayed empty violet for 2.5 s while « Chez Bonzini Trading
  Cargo » was said; now the name is on screen while it is heard (as N2 reads LE BATEAU). The label slap keeps §7.2's pause
  after « Cargo, ». The fixed pill « CHEZ TON FOURNISSEUR » now drops in .25 s (was .4) so it is gone before the plate.
- `capBZ ≥ plate + .1` (the caption never arrives before its plate).
- `fill_fffff` lasts the hatching sweep only (cue field `d`), not until the tic after « dedans ».
- The violet grid's bright balafon skips « Bonzini » and « Chine » (`lib/audio_ep2.py key_windows`, rule P1 for the brand bus).
- Guards that leave the defaults unchanged: BOUM after `END(T1)`, ka-ching before T1, chase ≥ pose3, gulp ≥ chase + .25,
  glass after the hic, signature before « Chez », MESURÉ ✓ before N8, ritual stamp after `END(N8)`.

## On-screen texts (v2, `SCRIPT_V2.md` §3)
LE BATEAU « MÊME LÉGER, / TU PAIES / LA PLACE. » (orange band on « LA PLACE. ») · stamp « EN MÈTRES / CUBES (m³) » (2 lines
≈ 80 px, `30_carton.js stampM3()` reads TEXTS 'm3') · « TU PAIES AUSSI / LE VIDE DEDANS. » · TOI « J'AI PAYÉ LE BATEAU / POUR
TRANSPORTER / DE L'AIR ?! » · « UN CARTON PLUS PETIT, / C'EST MOINS DE / MÈTRES CUBES. » (big last line) · « MAIS PROTÈGE /
CE QUI PEUT CASSER. » · « TES CARTONS SONT / MESURÉS EN CHINE. » · « Cargo bateau et avion · Chine → Douala » · CTA
**« Écris CARTON en commentaire »** (the pill is scaled to fit x 140–940: `BZ_ctaPill(…, {maxW: 800})`) · tag « Montre ça /
à celui qui / paie de l'air ». Check stills (defaults, `--mb 4`): `out/v2chk/` (23 key moments), sheet `out/v2chk_sheet.jpg`;
looked at full size and at 360 px wide: every changed text present, readable, inside its zone.

## Known limits / re-timing risks (v2)
- **Pauses the pictures need** (retime keeps the default spacing; a take slower than 3.6 syl/s shortens the pause after it):
  END(N2b) → N3 ≥ ≈ 1.3 s (the silent measure: clacs + formula stamp; default 1.70) · END(N4b) → N5 ≥ .55 s (tape, chase,
  gulp before AVANT / APRÈS; default .76) · END(N6) → N7 ≥ .5 s (ENSUITE + violet + balafon + the BONZINI plate's tonk before « Chez »; default .60) ·
  END(N7) → N8 ≥ .3 s (MESURÉ ✓ .2 s after « Chine ») **and ≳ .8 s for the CTA pill to land before « carton »**: the pill
  waits for MESURÉ ✓ + 1.45 s + .15 (default pause 1.0 s; 13/40 jitter runs put it .05–.45 s after « carton »; the QA warns —
  fix by moving N8, N8b and `end` later in `timing.json`). Guards keep the loud cues out of words when a pause shrinks (BOUM,
  ka-ching, gulp, signature, MESURÉ, ritual stamp); the QA flags the rest.
- **« Cargo, » pause**: the label slap is `WE(N7,'cargo') + .03`; without a pause after « Cargo, » it starts on « tes » (on
  the defaults, whose `SYL` model has no comma pause, it is .03 s into « tes »). The QA flags it on real words.
- **`end`**: retime.py keeps ≥ 1.2 s after N8b by default (≈ 45.5 s on 3.6-syl/s takes); run it with `--tail 0.5`.
  `end = max(END(N8b) + .5, stampEnd + 1.45)` is enough now that the ritual stamp falls before N8b.
- **Words the ASR may not return** (fallbacks then use the syllable model): `'cube'` (N2b), `'pai|pay'`, `'dedan'` (N3b),
  `'fourniss'` (N4), `'rempli'` (N4b), `'proteg'`, `'casse'` (N6), `'cargo'`, `'tes'`, `'chine'` (N7).
- The end card has 4 elements (lockup + services, stamp, CTA, tag on the carton), as the series ritual asks.
- The series chip slightly covers the cardboard edge of the hook's title plate (top-left corner, about 10 px).
- **For the patron to validate** (`SCRIPT_V2.md` §9): « tes cartons sont mesurés en Chine », « Cargo bateau et avion », the share
  line « Montre ça à celui qui paie de l'air », the WhatsApp answer to CARTON.

## History: stage 3 QA (v1 voices, 34.28 s) — superseded by the v2 anchors above
The texts and times quoted here are v1 (« AU m³ », « Groupage mer et air », CTA « Écris CBM en commentaire », « Tague celui
qui… »); v2 replaces them all (see above).

### QA (stage 3): what was checked
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

### QA (stage 3): what was fixed
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

# « PATRON, ATTENDS ! » (JE SAVAIS PAS. · 4/5)

**Status: v2 voices (clear diction) integrated on the score DEFAULTS. Waiting for the lead's re-timing.**

The voice-over was rewritten (`SCRIPT_V2.md`, `data/script_v2.json`).
- **12 lines:** C1 T1 T2 C2 C3 T3 T3b C4 N1 C5 N2 N3. T3 is now two takes: T3 « Allô ? » and T3b « Il dit qu'il n'a rien
  changé ! ». The honest steel plate answers in the silence between them.
- **Keyword:** **ALLÔ**. The voice says « Écris le mot ALLÔ en commentaire ». The pill still reads « Écris ALLÔ en
  commentaire ↓ » (§5).
- **What follows the new voice-over:** the pictures, the on-screen texts, the sound cues and the music plan.
- **`data/timing.json` is removed on purpose.** The score runs on its defaults (`SCRIPT_V2.md` §7.1, 3.6 syllables/s plus
  the §6 pauses): **44.84 s, 1345 frames**. `data/timeline_main.json` was regenerated.
- **Archived v1 data:** `data/*_v1.json` and `audio/vo_v1/`.

**For the lead, in this order** (`SCRIPT_V2.md` §7):
1. Copy `data/script_v2.json` over `data/script.json` (`retime.py` reads the line order there). *Done: the two files are
   identical (19:21).*
2. Choose the takes (§2: 3.6–3.9 syl/s, the slowest clean take, the words that must be recognised).
3. Run `lib/vocheck.py`.
4. Paste the real `T` / `DUR` into `01_score.js` (the §7.1 python snippet prints them; its pauses `P` are the score's).
5. Run `python3 ../retime.py . --pauses --tail .7` from E. Never use a `--stretch` factor below 1.
   - `--pauses` keeps the storyboard silences, and `data/gaps.json` gives their minimums.
   - retime's `--tail` is already the *minimum* tail (§7.1 calls it `--tail-min`). The default 1.2 s would add 0.5 s.
6. Run `node tools/qa_score.js 40`. Read its WARN lines too.
7. Regenerate the timeline (command below), then mix and run `listen_test.py`.

## Render
- **Check stills** (v2 key moments on the defaults; after re-timing, take the times from `SCORE.A`):
  `cd overlay && nice -n 5 node render.mjs --times 0,1.95,3.3,5.3,9.35,10.9,11.55,12.7,16.0,18.65,20.2,21.3,23.45,24.95,29.1,31.6,33.25,37.9,42.7,44.5 --pages 2 --mb 4 --out ../out/v2chk --jpg`
- **Full film** (lead only, after re-timing):
  `cd overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg` (N = 1345 on the defaults)
- **Contact sheet:** `python3 tools/sheet.py out/<dir> out/<sheet>.jpg 5`
- **Text check:** `node tools/check_text.js` (holds, at most 3 blocks, voice overlaps)
- **Score QA**, after every re-timing: `node tools/qa_score.js 40 [--timing candidate.json] [--spacing | --harsh] [-v]`. The
  exit code is 1 on any error.

  **What it reads.** The source is `--timing x.json` (a candidate), else `data/timing.json`, else the defaults. On the defaults
  it runs twice: as they are (`SYL` fallbacks, no words), and with synthetic words (the v2 lines spread by syllable, .15 s per
  comma and .35 s per sentence end).

  **Simulations.**
  - **Rate scenarios:** every take at 3.5 and at 3.8 syl/s.
  - **40 jitter runs:** each take ±15 % long, its inner word boundaries ±.06 s, its last word stamped up to .2 s early (as the
    ASR does). Takes are placed like `retime.py --pauses`, with `gaps.json` as minimums.
  - `--spacing`: retime's default rule instead. `--harsh`: every start ±.4 s, a stress test whose failures are expected.

  **Errors:**
  - a time that is not finite, or an action out of order;
  - a key text held under 1.4 s, the rule's sub-line under 2 s, or THE RULE not alone (or under 3.8 s);
  - more than 3 text blocks at once;
  - a silence below `gaps.json`, or two voices overlapping;
  - a broken §7 constraint (listed below);
  - a §7.3 loud cue starting inside a word. The window is `[s − .03, e]`, a line's last word runs to `END(id)`, and cues under
    gain .2 are not counted.

  **Warnings:**
  - the film is over 45 s;
  - the 3rd clink does not fall before N1.

  **Today:** `OK — no issue` on the defaults, on default+words, at 3.5 and at 3.8 syl/s. In the 40 jitter runs, the only
  warning is *film > 45 s* (17/40, when the takes are slower than 3.6 syl/s). The spec's simulated timings
  (`ep4v2/sim/data/timing*.json`, through `--timing`) also pass.
- **Regenerate the timeline** after re-timing (from E):
  `node -e "const S=require('./overlay/scenes/01_score.js');require('fs').writeFileSync('data/timeline_main.json',JSON.stringify({frames:S.N,chapters:[{id:'all',start:0,end:S.T.end}],segments:[]}))"`

## Files
- `overlay/engine.html`, `kit.js`, `render.mjs`: the « PAS REÇU. » night engine (TIMING injection, `--mb`, `--times`, `--scenes`;
  the film length comes from `TIMING.end`, else `timeline_main.json`).
- `overlay/scenes/`
  - `01_score.js`: the score (v2: `T`/`DUR`/`LINES` with T3b, `U`/`SYL`/`WEL`, the §7.2 anchors, the §7.3 cues, `outOfWords`)
  - `02_light.js`, `10_table.js`: the wax counter under the bulb, and the phone-glass print
  - `20_props.js`: the parcel and the containers
  - `30_plates.js`: the plates (TOI amber, honest steel)
  - `39/40/41_gecko*`: the margouillat, through an adapter
  - `50_compose.js`: draw order and camera
  - `60_type.js`: chip, pills, speech cards, the band (v2: with TA COMMANDE's tab), THE RULE (3-line sub-line)
  - M1: `22_commande.js` (TA COMMANDE), `34_fake.js` (the fake message and its fall)
  - M2: `36_call.js` (TOI, the call, the real supplier), `70_bonzini.js` (container, label, enamel plate, tag, caption),
    `76_end.js` (end card, ritual stamp, CTA, the loop)
- `data/`
  - `script_v2.json` (the v2 lines), already copied over `script.json`.
  - `gaps.json` (**new**): the minimum silence before each line.
  - `timeline_main.json`: 1345 frames.
  - the v1 archive (`*_v1.json`); `takes.json`, `vocheck.json` and `voice_plan.json` belong to the lead.
- `tools/`: `qa_score.js` (**new**, above), `check_text.js`, `sheet.py`.
- `out/`
  - `v2chk/` (20 v2 check stills, `--mb 4`) and its sheet `v2chk_sheet.jpg`;
  - `qa_sheet.jpg` (stage 3, v1 voices); `animatic_sheet.jpg`, `chk_M1_sheet.jpg`, `chk_M2_sheet.jpg` (earlier stages).

## Score API (`window.SCORE` / `require('./overlay/scenes/01_score.js')`, reads `data/timing.json` in node too)
- **Timing**
  - `T` holds the voice starts (C1 T1 T2 C2 C3 T3 T3b C4 N1 C5 N2 N3) and `end`. `DUR` and `END(id)` give each line's
    duration and end.
  - `data/timing.json` overrides them: `{id: s, end, dur: {id: s}, words: {id: [{w, s, e}]}, A: {optional hand overrides}}`.
- **Word anchors**
  - `W(id, prefix, nth, fb)` and `WE(…)` return the start or end of a word. Matching ignores accents, case, elision and
    ligatures. `'a|b'` matches either prefix (`'pai|pay'`, `'compt|comt|cont'`, `'coeur|queur'`,
    `'doua|doula|douw|ouala'`: the ASR spellings `data/must.json` accepts and the « Douwala » tts of `data/alt.json`).
  - `SYL(id, u)` is the fallback: `u` syllable-units into the line, as a fraction of its real `DUR`. The units come from `U`
    (§1 counts, plus .54 per comma and 1.26 per sentence end inside a line), so on the defaults `SYL` is exactly the
    3.6 syl/s simulation of the spec.
  - `WEL(id, prefix)` = `max(WE, END(id))`, the end of a line's LAST word. The ASR stamps that word early.
- **Actions:** `A` holds every action time, derived after the merge. `G` is the layout. `N = round(T.end · 30)`.
- **States:** `parcel`, `bubble`, `pillQ`, `fauxStamp`, `toiPlate`, `supPlate`, `container`, `bzPlate`, `endcard`, `pills`,
  `TEXTS()`, `light`, `camera`, `gecko`, `geckoShim`. Helpers: `speaking`, `talk`, `slow`.
- **Sound**
  - `soundCues()` returns 52 cues on the defaults.
  - `outOfWords(t)` is exported. It slides a short cue to the end of the word it falls in (+.03). A line's last word ends at
    `END(id)`. If the words touch for more than .6 s, the cue keeps its time at half gain.
  - `music()` returns `{silentUntil 3.53, tenseFrom 3.53, cut 11.42, majorFrom 24.83, fullFrom 30.50 (new: the full makossa
    from the container), sigAt 32.64, end 44.84}`.

**Voices on the defaults** (speech start → end): C1 0.20→3.48 · T1 3.88→7.77 · T2 8.12→11.12 · C2 11.67→14.17 ·
C3 14.52→18.41 · T3 19.01→19.57 · T3b 20.16→22.10 · C4 23.11→24.78 · N1 25.32→30.19 · C5 30.65→32.59 · N2 33.14→39.12 ·
N3 39.47→44.14 · end 44.84.

## T/W anchors (v2, `SCRIPT_V2.md` §7.2; values on the defaults)
**Rule P1:** a loud cue never starts inside a word. It goes on a word end, or in a pause. The picture may stay on the word.

| Beat | Anchor (v1 → v2) | Default |
|---|---|---|
| Hook | presses on « attends », « paie », « compte » (`W(C1, …)`) · « NE PAIE PAS / SUR CE COMPTE ! » `W(C1,'ne') − .05` · **bubble + ding `max(W(C1,'compte')…)` → `max(WEL(C1,'compte') + .05, hook2 + 1.45)`** (after « compte »; the dezoom `bubble − .45` stays on the word) | .91/2.09/3.20 · 1.76 · 3.53 (dezoom 3.08) |
| T1 | TOI's plate `T1 − .2` « IL A CHANGÉ DE COMPTE. » · hearts `max(T1 + .45 + .35i, bubble + .35 + .35i)` | 3.68 · 4.33/4.68/5.03 |
| T2 | « TROIS CŒURS, C'EST LUI ! » `T2 − .1` · heartsPulse `W(T2,'coeur')` · **aww (new) `WE(T2,'coeur') + .03`** · « JE PAIE. » `max(W(T2,'je') − .05, toiTxt1 + 1.45)` | 8.02 · 9.23 · 9.54 · 10.51 |
| C2 | **jump `C2 − .3` → `C2 − .55`** (the end of T2) · **jumpLand = cut `C2 + .02` → `C2 − .25`** · bonk `+.05` | 11.12 · 11.42 · 11.47 |
| C3 | band `C3 − .1` → `T3 + .1` (+ tab TA COMMANDE) · **ALLÔ ? `max(W(C3,'que')…)` → `END(C3) + .02`** · **rings `[allo + .05, + .85]` → `[allo + .08]`** · **pickup (new) `T3 − .1`** · aside `T3 − .25` | 14.42 · 18.43 · 18.51 · 18.91 · 18.76 |
| T3 / T3b | **supIn0 `T3 + .15` → `END(T3) + .02`**, supIn1 `+.85` · **toiRien `max(W(T3,'dit') − .25, …)` → `max(W(T3b,'dit') − .25, supIn1 + .05)`** | 19.59 · 20.44 · 20.49 |
| The fall | **stamp `END(T3) + .12` → `END(T3b) + .12`** · **toiOut `stamp − .25` → `END(T3b) − .02`** · shatter `+.45` · peel `+.57` · FAUX MESSAGE `+.75` · **roll (clinks) `shatter + .55 + .3i` → `END(C4) + .1 + .1i`** · joy around C4 (silent) · major `END(C4) + .05` | 22.22 · 22.08 · 22.67 · 22.79 · 22.97 · 24.88/24.98/25.08 · 24.83 |
| N1 (THE RULE) | rule `N1 − .15` · ruleW on « nouveau », « compte », « ancien », « numéro » (`W(N1, …)`, fallbacks now `SYL`) · ruleSub `W(N1,'appel')` · **ruleOut `max(rule + 3.8, END(N1) + .4, ruleSub + 2)`** · **gulp `END(N1) − .15` → `WEL(N1,'numero') + .03`** (deviation) | 25.17 · 27.26/27.82/28.80/29.36 · 28.25 · 30.59 · 30.22 |
| C5 | cont = violet `max(C5 − .15, ruleOut − .2)` · leap `C5 + .25` · enter `+.55` · ribbon `max(enter + .15, W(C5,'douala'))` · **shimmer (new) `WEL(C5,'douala') + .03`** · bzLabel `ribbon + .35` · card « ON SE VOIT / À DOUALA ! » `[max(C5, ruleOut), min(plateBZ − .25, N2 + .15)]` | 30.50 · 30.90 · 31.45 · 31.76 · 32.62 · 32.11 · 30.65–32.69 |
| N2 | **sig `N2 − .03` → `max(N2 − .5, WEL(C5,'douala') + .03)`** · **plateBZ `W(N2,'bonzini')` → `N2 − .2`** · caption `max(W(N2,'chine') − .3, plateBZ + .35)` | 32.64 · 32.94 · 37.43 |
| N3 | endcard `N3 − .2` · **CTA `N3` → `N3 − .12`** · **ritual stamp `W(N3,'maintenant') − .1` → `max(W(N3,'maintenant') − .32, WE(N3,'commentaire') + .03)`** · loop `end − .55` · out `end − .12` · `end ≥ max(END(N3) + .7, stampEnd + 1.5)` | 39.27 · 39.35 · 42.28 · 44.29 · 44.72 · 44.84 |

**Holds on the defaults** (`tools/check_text.js`):

| Text | Hold |
|---|---|
| « NE PAIE PAS SUR CE COMPTE ! » (shortest) | 1.79 s |
| « ALLÔ ? » | 2.06 s |
| « IL N'A RIEN CHANGÉ ! » | 1.84 s |
| Bonzini caption | 1.84 s |
| C5 card | 2.04 s |
| C2 card | 2.65 s |
| sub-line | 2.34 s |
| FAUX MESSAGE | 2.34 s |
| « TROIS CŒURS, C'EST LUI ! » | 2.49 s |
| « IL A CHANGÉ DE COMPTE. » | 4.34 s |
| THE RULE (alone) | 5.42 s |

At most 3 blocks at once. At 3.8 syl/s the shortest hold is still 1.70 s.

**Sound (`soundCues()`, §7.3 block as written).** Short cues go through `outOfWords`.
- **Removed:** the 2nd ring, `line_tone`, the 3 `boing_small` of the joy jumps, the `boing` of the leap, `hic`,
  `doors_close` and `pin`.
- **New:** `phone_pickup` (a short click to synthesise; failing that, `tic` at .5).
- **Gains lowered:** as in §7.3.
- **The final chord:** `max(END(N3) + .02, end − .9)`.
- **The 3 heart pops** fall inside T1, which has no pause. `outOfWords` cannot push them out, so they stay at half gain
  (.125). The QA does not count them as loud.

## Sound engine (`lib/audio_ep4.py`, done)
- **Run (from E, after re-timing):** `nice -n 5 python3 lib/audio_ep4.py --sheet` (≈ 75 s) → `audio/mix.wav`, `audio/stems/`,
  `audio/audio_report.json`, `out/chk_audio_sheet.jpg`. Options: `--no-voices`, `--force-voices`, `--words`,
  `--music-hp duck|static|off`, `--me-norm`, `--gallery`, `--check-replica`, `EP_DIR=<copy>`.
- **Reads the score live** (`SCORE.T/DUR/A/U/LINES/SPEAKER`, `soundCues()`, `music()`); its python replica
  (`derive_score`) must stay line for line with `01_score.js`: run `--check-replica` after any score edit (IDENTICAL today,
  on the defaults and on a worded timing).
- **Voices** go in only when `data/voice_plan.json` covers all 12 lines, its files = `takes.json`, and each planned speech
  start is within .15 s of `SCORE.T` — i.e. after `retime.py`. Until then it mixes music + SFX on the score's planned spans
  and says why (today: the plan is still v1).
- **Mix:** ep2's settings — music ducks `DUCK_DB` 12 + `R.CARVE_DB` 6 (passed explicitly), soft SFX 9, hit bus 6,
  `VOX_TRIM {}`, −14 LUFS, TP ≤ −1 dBTP. The final chord is ducked only if it starts inside speech (ep2 always ducks it).
  §7.3's 150 Hz low cut is applied to the music **only under the voice** (`--music-hp duck`); `--music-hp static` is the
  literal reading (everywhere). **To decide.**
- **On the defaults (no voices):** M&E −23.2 LUFS at the final balance, projected −14.00 LUFS / −1.28 dBTP with a −18 LUFS
  speech stand-in on each line; 40 cue names, none unknown; all cues within 15 ms of the score.
- **Short lines:** `R.lufs_mono` returns NaN under one 400-ms block; `audio_ep4.py` pads it (`lufs_safe`). The ep1–ep3
  engines share the bug for any line < .4 s.

## On-screen texts (v2, `SCRIPT_V2.md` §3)
- **Hook card:** « **NE PAIE PAS** / SUR CE COMPTE ! ». QA: at the 880 px fit it reached x 980 inside y 900–1560. It is now
  fitted to 820 px: 91 px, x 132–948 (`speechCard(…, maxW)`).
- **TOI's plate**, in order, at sizes ≥ 74 px:
  1. « IL A CHANGÉ / DE COMPTE. » (style `object`, now a key text), 85 px;
  2. « TROIS CŒURS, / C'EST LUI ! », 74 px;
  3. « JE PAIE. », 112 px;
  4. « ALLÔ ? »;
  5. « IL N'A RIEN / CHANGÉ ! », 101 px.
- **C2 card:** « CE N'EST / PEUT-ÊTRE **PAS** / **TON FOURNISSEUR !** », 3 lines, 85 px, y 235–565.
- **Reflex band:** same text, plus a dark-kraft tab « TA COMMANDE » (`TY.speakerTab`, shared with the speech cards).
- **Rule sub-line:** « avant de payer, / appelle le numéro / que tu connais déjà. », 3 lines at 48 px. The card spans
  x 148–940, y 347–1123.
- **C5 card:** « ON SE VOIT / À **DOUALA** ! », 104 px.

All of these come from `TEXTS()`. `60_type.js` adds only the orange emphasis, and `30_plates.js` holds the TOI default text.

**Check stills:** `out/v2chk/` (20 key moments plus the rule at 29.6), sheet `out/v2chk_sheet.jpg`, `--mb 4`. I looked at
them at full size, in crops, and at 360 px wide:
- every changed text is present, readable, and inside its zone;
- nothing is drawn at y < 150;
- no text sits at x > 960 in y 900–1560;
- no page error.

**Unchanged:**
- « PATRON, ATTENDS ! »;
- the bubble « ON A CHANGÉ DE COMPTE BANCAIRE. PAIE ICI, VITE. »;
- the band text, « JE N'AI RIEN CHANGÉ. », FAUX MESSAGE and PAS TON FOURNISSEUR;
- the 4 rule words;
- the brand texts;
- the end card and the CTA pill « Écris ALLÔ en commentaire ».

## Deviations from `SCRIPT_V2.md` (each is one line in `01_score.js` unless stated)
- **Fallbacks are proportional** (`SYL(id, u)`, as in ep. 1–2), not §7.2's literal seconds. With words they change nothing.
  Without words they land as the spec's 3.6 syl/s simulation and scale with the real `DUR`. Example: `ruleSub` is 28.25,
  the spec's expected value.
- **A line's last word is `WEL`** (`max(ASR end, END(id))`) for the bubble/ding, the shimmer and the gulp. `outOfWords`
  also counts a line's last word up to `END(id)`. §7.2 used `WE`, which the ASR stamps .07–.29 s early, so a loud cue could
  start in the word's tail. No change on the defaults.
- **`A.gulp = WEL(N1,'numero') + .03`** (was `END(N1) − .15`, with the sound pushed by `qx`). The margouillat's gulp and its
  « gloup » are now together, right after « numéro ». Before, the picture came .18 s ahead of the sound. This moves the
  gecko's gulp/hic by +.18 s.
- **`A.sig` guard** `max(N2 − .5, WEL(C5,'douala') + .03)`. With §6's cut plan (N2 pause .55 → .45), `N2 − .5` fell .05 s
  inside « Douala ». No change on the defaults.
- **`A.stampEnd` guard** `≥ WE(N3,'commentaire') + .03`. If the sentence pause of the real N3 take is under .35 s, the ritual
  stamp stays out of « commentaire ». It equals §7.2's value on the defaults.
- **`70_bonzini.js`: the enamel plate's two balafon glints** wait for the touchdown (`max(sig, plateBZ + .04)`). The
  signature now plays .3 s before the plate exists, so the glints would have drawn nothing, or drawn on the falling plate.
- **Hook card width capped** at 820 px (safe zone, above).
- **The QA order list** skips `presses[3] ≤ dezoom`. The parcel peels off the glass as « compte » starts, so the 3rd re-press
  is not visible. This was already the case in v1 (`bubble − .45 < W('compte')`).
- `data/gaps.json` is my reading of §6. The image and sound pauses are kept whole: C2 .55, T3 .6, T3b .6, C4 1.0. The cut
  plan's three pauses are at their cut value: T1 .35, N1 .45, N2 .45. The others stay at the storyboard value: T2, C3, N3 .35
  and C5 .45.

## Known limits / re-timing risks (v2)
- **Film length.** At 3.6 syl/s it is 44.84 s. At 3.5 syl/s it is 45.94 s. In the jitter runs, 17/40 films go over 45 s.
  Apply §6's cut plan in this order:
  1. the pauses N1 / N2 / T1: set them in the score's DEFAULT pauses (the §7.1 snippet's `P`: N1 .45, N2 .45, T1 .35)
     and re-paste `T`. `retime.py --pauses` places each line at `prev_end + max(default pause, gaps.json)`, so lowering
     `gaps.json` alone shortens nothing (`gaps.json` already holds these cut values as the floor);
  2. N3 without « le mot ».

  Never speed a take up.
- **Pauses that carry pictures** are protected by `gaps.json` and checked by the QA:
  - C2 .55: the leap starts at the end of T2 and lands .25 s before « Ce n'est »;
  - T3 .6: flip, ring and pick-up between C3 and « Allô ? »;
  - T3b .6: the steel starts at `END(T3) + .02` and must start ≥ .3 s before T3b;
  - C4 1.0: stamp → shatter → peel → FAUX MESSAGE, then C4 .13 s later;
  - N2 ≥ .45: the balafon and the plate before « Ensuite ».
- **The ritual stamp** needs the N3 take's pause after « commentaire. ». The stamp is at `W(maintenant) − .32`, guarded after
  « commentaire ». If that pause is under ≈ .1 s, the stamp starts on « Maintenant » and the QA flags it.
- **The 3rd clink** (`END(C4) + .3`) touches THE RULE's entry if the C4 → N1 pause is at its .45 minimum. The QA warns
  before N1.
- **Words the ASR may miss** (the `SYL` fallbacks then apply):
  - C1: « Ne » (French ASR often drops it), and « compte » (prefixes `compt|comt|cont`);
  - T2: « cœurs » (risk « quarts ») and « Je »;
  - T3b: « dit »;
  - N1: « l'ancien »;
  - C5: « Douala » (`doua|doula|douw|ouala`);
  - N2: « Chine »;
  - N3: « commentaire » and « Maintenant ».
- **The hearts land with their clinks after « message »** (`A.roll`). In `34_fake.js` they now skitter for ≈ 2.2 s in the
  slow motion (it was ≈ .6 s). §7.2 accepts this. If it reads too slow in the full render, keep the v1 `A.roll` and only
  move the clinks (`END(C4) + .1/.2/.3`).
- **The bonk:** the landing parcel covers « JE PAIE. » (it was « OK, ») for about 0.2 s before TOI's plate recoils.
- **The leftover hiccup:** the margouillat's hiccup (`A.hic`, now silent) still plays as a picture early in C5.
- **Review (19:50) — the takes in `data/takes.json` today**, placed like `retime.py --pauses` (a copy, `E/data` untouched):
  42.61 s, `qa_score.js` passes, every word anchor is found. But several takes are outside §2's window and must be
  stretched (1.10–1.25) or regenerated before the real re-time: **T3** `T3_s2` .32 s (§2 rejects < .45 s), **C3** `C3_s3`
  2.88 s (window 3.59–3.89), **C5** `C5_s5` 1.40 s (1.79–1.94), **N2** `N2_s3` 4.49 s (5.38–5.83); **C1** 3.12 s and **T2**
  4.05 s are slower than 3.6 syl/s. Kept as they are, the jitter runs fail on the C5 card (hold = C5 take + N2 pause − .45:
  1.50 s today, 1.40 s with the cut plan's N2 .45) and on the Bonzini caption (N2 too short).
- **N3's sentence pause.** `N3_s1` leaves only .12 s between « commentaire. » and « Maintenant »: the ritual `stamp_big`
  (−14.5 LUFS-M, hit bus ducked 6 dB only) then lands .09 s before « Maintenant » and can mask its onset. Prefer a take with
  ≥ .3 s there, or split N3 at the full stop like T3/T3b.
- **Not done here (lead / docs):** `serie/SERIE.md` › Épisode 4 (§7.5 list). Since done by others: `lib/audio_ep4.py`
  (below) and the copy of `script_v2.json` over `script.json`.

---

# History: stage 3 QA (v1 voices, 34.91 s), superseded by the v2 sections above
The texts and times below are v1. Examples: « NE PAIE PAS CE COMPTE ! », « OK, JE PAIE. », « IL A RIEN CHANGÉ ?! »,
« Ouf ! », « ON SE VOIT À DOUALA, PATRON ! » and the `--stretch C1=0.88,C2=0.92` re-time.

### What stage 3 fixed (all re-checked on the renders)
1. **Frame 0 (and the cover):** the hook card was half-transparent and the « TA COMMANDE » pill was doubled. The `--mb`
   sub-frames of frame 0 sample t < 0, where nothing exists yet. `50_compose.js` now clamps t to [0, end).
2. **Over 35 s (35.67 s):** I tightened four storyboard gaps in the score's defaults and re-ran `retime.py`. The film is now
   **34.91 s**.
   - T1→T2: −.18 s.
   - C3→T3: −.18 s.
   - C4→N1: −.2 s.
   - N2→N3: −.38 s.

   The hold times still pass (the shortest is the Bonzini caption, 1.42 s), and so do the voice gaps (at least .12 s).
3. **THE RULE was under the bar.** On 2 lines, « NOUVEAU COMPTE ? » only fitted at the 90 px floor (948 px wide, 66 px from
   the frame edges). It is now a 4-line poster, **128 px**, one word per line, each word stamped on its spoken word:
   NOUVEAU / COMPTE ? in ink with an orange « ? », a thin orange rule, then ANCIEN / NUMÉRO. in orange. The sub-line
   « appelle d'abord / le numéro que tu connais » is on 2 lines at 48 px, and the card grows downward (x 145–935, y 376–1094).
4. **The stamp moment (18.3–18.9 s) was a pile-up.** The fake's sticker was drawn over the steel plate (it hid « JE N'AI »),
   and the two « TON FOURNISSEUR » pills sat on top of each other.
   - The sticker is now drawn under the stamping steel.
   - The steel's pill fades out while the plate is down (`kk(z, 40, 100)`).
5. **The fake's « ? » was hidden while the call is on.** The steel plate covered the top half of the sticker, including the
   orange « ? ».
   - `G.sup.y` moved from 560 to 505.
   - The steel's pill fades in only as the plate settles, so it is never above y 150.
   - The pill is now 42 px (was 36), so the honest supplier is clearly named.
6. **Text too low.** « IL A RIEN CHANGÉ ?! » sat at y 1540+. `G.toiBack.y` moved from 1440 to 1418 (and `G.mid.y` from 1252
   to 1244, so the parcel still clears TOI's plate).
7. **Text in the right-hand UI band.** « Boutique · Mboppi » reached x 980 in y 900–1560. `G.label.x` moved from 790 to 756
   (it now ends at x 948).
8. **The sweat crossed the text.** TOI's sweat (`PL_sweat` .2) drew 2 beads and 2 running drops across « IL A RIEN », one of
   them on the L. It is now one bead in the plate's right margin, forming and then sliding a little (`36_call.js`).
9. **The CTA keyword was hard to read.** « ALLÔ » in Big Shoulders Stencil read « AI.I.Ô ». Words containing an L are now set
   in Satoshi Black 60 px in the CTA pill (`BZ_ctaPill`); TCHAC and CBM keep the stencil.
10. **FAUX MESSAGE was too small.** The stamp was 91 px; it is now **96 px**. It also moved up 30 px (`G.fauxY` 905) and 12 px
    left, so the box stays left of x 960 and TA COMMANDE's joy jumps (« Ouf ! ») are no longer hidden behind it.
11. **24.9–26.4 s had no text at all**, while the parcel leaps into a violet box and C5 is the only TA COMMANDE line not
    written. It now has its kraft speech card: « ON SE VOIT À **DOUALA**, PATRON ! » (75 px, 2.25 s). It stays a single
    block, after THE RULE and before the enamel plate.

### Checked and OK
- **Sync:** every « on the word » action matches the word times above.
- **PHRASE-test:** it is written three times:
  - « APPELLE LE NUMÉRO QUE TU CONNAIS DÉJÀ. » (3.1 s)
  - « JE N'AI RIEN CHANGÉ. » (4.7 s)
  - « NOUVEAU COMPTE ? ANCIEN NUMÉRO. » (3.8 s, alone)

  « PAS TON FOURNISSEUR » and « FAUX MESSAGE » make it clear that the fake is not the real supplier, and Bonzini is only the
  cargo (« DE LA CHINE À DOUALA · MER OU AIR »).
- **Facts:** only the « Faits utilisés »: no figures (the account line is blurred « •••• •••• »), no brand, and the only
  address is « Foyer Balengou ».
- **Violet:** violet light and violet objects appear only from `A.cont` (24.35 s).
- **Series identity:**
  - the chip « JE SAVAIS PAS. · 4/5 » at y 153–215;
  - the amber TOI pill;
  - the margouillat (hop, squint, tennis, gulp, push-ups);
  - the ritual stamp « MAINTENANT, TU SAIS. »;
  - the amber CTA « Écris ALLÔ en commentaire » with a drawn arrow;
  - the loop: frames 1040–1046 fly into frame 0.

### Known limits (left as they are)
- **The bonk (9.3–9.5 s):** the landing parcel covers « OK, » on TOI's plate for about 0.2 s before the plate recoils. This
  is the gag.
- **Short transitions:**
  - The steel plate passes behind the chip as it comes down (15.6–16.2 s).
  - TOI's plate slides out through y > 1540 (18.0–18.5 s).
  - The sticker's flap flies off as a motion-blurred streak (18.9 s).
  - The end blocks blow past the chip in the loop's last 0.4 s.
- **The wax cloth has violet in its motif from frame 0.** This is the validated « PAS REÇU. » night cloth (the three logo
  colours on indigo). It is decor, not a violet light or object.
- **Short holds:** the Bonzini caption is held 1.42 s and the rule's sub-line 1.40 s, both just at the bar. The end card
  repeats the caption's information right after.
- **Small type:** the CTA pill's words are 50 px (the series' shared piece from episodes 1–2; MODULES asked for 54 px). The
  « Boutique · Mboppi » tag is 38 px (a place label, not a key sentence).
- **Empty top during T1–T2 (3.6–9.3 s):** the top 40 % of the frame is the dark night zone with nothing in it. The action
  sits on the cloth.
- **Old timing in the module notes:** `MODULES.md` and the M1/M2 check sheets still show the 35.67 s times. The live times
  are `SCORE.A`.

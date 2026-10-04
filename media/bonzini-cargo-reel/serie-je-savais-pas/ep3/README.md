# « C'EST PAS ÇA. » (JE SAVAIS PAS. · 3/5)

**Status: v2 voices (clear diction) integrated on the score DEFAULTS — waiting for the lead's re-timing.** The voice-over was
rewritten (`SCRIPT_V2.md`, `data/script_v2.json`: 16 lines T1 T2 N1 T3 N1b N2 N3a N3 N4 N4b N4c T4 N5 N5b N6 N6b, keyword
**FICHE**). The pictures, the on-screen texts and the sound cues follow it. `data/timing.json` is removed on purpose: the
score runs on its defaults (`SCRIPT_V2.md` §7.1: 3.7 syllables/s + the pauses of §6) — **44.59 s, 1338 frames**
(`data/timeline_main.json` and `data/defaults.json` regenerated from the score). The v1 data is archived as
`data/*_v1.json`, `audio/vo_v1/`.

**For the lead, in this order** (`SCRIPT_V2.md` §7.7):
1. copy `data/script_v2.json` over `data/script.json` (retime.py and the QA's synthetic words read the line order there);
2. `takes.json` + `vocheck.json` for the 16 ids — **re-run `lib/vocheck.py` on the v2 takes BEFORE `retime.py`**
   (`CHOSEN=1 python3 lib/vocheck.py data/script_v2.json`): today's `vocheck.json` is v1's and its keys `T1_s2 T2_s1 N1_s1
   T3_s1 N3_s1 N4_s1 T4_s1 N5_s1 N6_s1 .wav` are also v2 take names; `retime.py` attaches words by file name, so it would
   silently put the v1 words under the v2 lines (the QA now fails with « words of N… do not match its v2 text / do not fit
   its take »);
3. optional, recommended by §7.1: rewrite `T` / `DUR` in `01_score.js` (lines 29–30) with the real take durations and the §6
   pauses (the snippet is in §7.1) — or simply run retime with `--pauses`, which keeps the same silences;
4. `python3 ../retime.py . --pauses --tail 0.9` — `--pauses` keeps the storyboard's silences (the 2.65 s key moment, the 1.0 s
   before N4, the stamp pauses) whatever the takes' lengths, and `data/gaps.json` adds the minimum silences the pictures need
   (below). `--tail 0.9` keeps the storyboard's tail (retime's default minimum is 1.2 s, +0.3 s);
5. `node tools/qa_score.js 40` (read its WARN lines too); a candidate can be checked before it is written:
   `node tools/qa_score.js 40 --timing /path/candidate_timing.json`;
6. regenerate the timeline (below), look at a few stills (`SCORE.A` gives the times), then the mix
   (`nice -n 5 python3 lib/audio_ep3.py --sheet`, below) and `listen_test.py`.

## Render
- Check stills: `cd overlay && nice -n 5 node render.mjs --times 5.0,10.8,13.03,17.6,21.95,23.55,28.8,29.4,35.2,37.9,43.0 --out ../out/chk --pages 2 --mb 4 --jpg`
  (v2 key moments on the defaults; take them from `SCORE.A` after re-timing).
- The full film, for the lead only, after re-timing:
  `cd overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg` (N = 1338 on the defaults).
  Cost: about 0.35 s of wall time per frame with `--mb 6` on 2 pages (the key moment is the heaviest stretch).
- A contact sheet: `python3 tools/sheet.py out/<dir> out/<sheet>.jpg 6`
- Regenerate the timeline after re-timing (from E):
  `node -e "const S=require('./overlay/scenes/01_score.js');require('fs').writeFileSync('data/timeline_main.json',JSON.stringify({frames:S.N,chapters:[{id:'all',start:0,end:S.T.end}],segments:[]}))"`
- **Score QA** — `node tools/qa_score.js [runs] [--timing x.json] [--spacing | --harsh] [--gap .12] [--tail .9]` (from E).
  Source: `--timing x.json` › `data/timing.json` › the score's defaults (then checked twice: with the `SYL` fallbacks and no
  words, and with synthetic words = the v2 tts lines spread by syllable over DUR, a short pause at each comma). It reports:
  - non-finite times, actions out of order, voices overlapping;
  - key texts held under 1.4 s (the list below + every `TEXTS()` row), more than 3 text blocks at once before the end card;
  - the re-timing constraints of the spec: BOUM between « arrivés » and « Mais », steel / order card after the line before,
    tags after « tout » (END(N1b)), the 3rd tag + the music cut before N2, « ÉCRIS TOUT » after N3 and before N4, the key
    moment not under N4c, the ✓ before T4, the balafon signature after T4 and before « La commande », no gloup on « Bonzini »,
    the 3rd gloup after « Cargo », the ritual stamp between END(N6) and N6b, `end ≥ max(END(N6b)+.9, stampEnd+1.8)`;
  - **no loud cue starts inside a word** (`boum marbles metal_set card_flop tag_stamp stamp tonk stamp_big carton_thud
    bonzini_sig gloup clink`, §7.3; a line's last word counted up to END(id); a cue lowered to g ≤ .5 only warns);
  - WARN: a silence under `data/gaps.json`, the key-moment pause under 2.65 s, the violet note read alone < .6 s before N4,
    the band « FAIS UNE FICHE. » not before N3a, the sample coming out after N4b starts, the film over 45 s.

  Runs (N): every take ±15 % (its words scaled), placed like retime.py `--pauses` + gaps.json (default), its default spacing
  rule (`--spacing`), or every start ±.4 s (`--harsh`, a stress test whose failures are expected); tallied by issue.
  **Today** (defaults, defaults + synthetic words, and the spec's synthetic timings at 3.6 / 3.7 / 4.0 syl/s via `--timing`):
  `OK — no issue`. 60 `--pauses` runs and 60 `--spacing` runs: no error; the only WARN is « film > 45 s » when the takes
  come out slow (§6: the cut plan).

## `data/gaps.json` — minimum silence BEFORE a line (s), for retime.py
| line | min | why (the default pause in brackets) |
|---|---|---|
| T2 | .20 | the BOUM at `T2−.12` after « arrivés » (.30) |
| N1 | .35 | « QUI A TORT ? » ≈ end of T2, `metal_set` at `N1−.2` after « ça » (.40; cut plan .35) |
| T3 | .30 | plates clear `T3−.4`, `card_flop` at `T3−.15` after « écrit » (.35) |
| N1b | .30 | the band at `N1b−.05`; a sentence pause (.35) |
| N2 | .60 | 3 tag stamps at END(N1b)+.03 / .25 / .47, music cut ≥ tags[2]+.03, before « Le fournisseur » (.70) |
| N3a | .55 | mocking notes END(N2)+.12; the band « FAIS UNE FICHE. » END(N2)+.45 = 0.1 s before the voice (.55) |
| N3 | .30 | a sentence pause (.35) |
| N4 | .90 | « ÉCRIS TOUT » END(N3)+.05, the note +.25, read alone ≥ .6 s (1.00; cut plan .90) |
| N4b, N4c | .30 | the bag held up / the polaroid glides in at `N4c−.25` (.35) |
| T4 | 2.65 | the silent key moment: key = END(N4c)+.10 ≤ T4−2.55 (2.65 = the minimum, §6) |
| N5 | .45 | violet + balafon signature at `N5−.35`, after « ça » (.50; cut plan .45) |
| N5b | .30 | 1st gloup after « toi » (.35) |
| N6 | .40 | 3rd gloup after « Cargo » and ≤ `N6−.3`, end card `N6−.25` (.45; cut plan .40) |
| N6b | .35 | the ritual stamp falls in the pause (`N6b−.3` ≥ END(N6)+.05), then the voice reads it (.40) |

## Files
| File | Owner | Contents |
|---|---|---|
| `overlay/engine.html`, `kit.js`, `render.mjs` | lead | The « PAS REÇU. » engine (every font declared and pre-loaded), the kit, and the renderer (TIMING injection, `--mb`, `--times`, `--frames`, `--scenes`). |
| `overlay/scenes/01_score.js` | lead (+ QA, v2) | **The score**: `T`, `DUR`, `W`/`WA`/`WE`/`WEL`/`WB`/`SYL`/`END`, `A`, `G`, `FICHE`, every state as a pure function of t, `TEXTS()`, `pills()`, `soundCues()`, `music()`. |
| `overlay/scenes/02_light.js`, `10_table.js` | lead | The morning light and the morning wax counter: door sunbeam, the shop's back wall, and wax with no violet. |
| `overlay/scenes/30_meme.js`, `32_plates.js` | M1 | `OM_memeBand`, `OM_photo`, `OM_recv`, `OM_subtitle`, `OM_fxUnder`, `OM_plate`, `OM_glyphs`, `OM_glyph`, `OM_fx`. |
| `overlay/scenes/34_fiche.js`, `36_sample.js` | M2 (+ QA) | `FS_fiche`, `FS_tags`, `FS_parcel`, `FS_sampleBag`, `FS_onPhoto`, `FS_gloves`, `FS_letters`, `FS_lib`, `FS_CART`. |
| `overlay/scenes/70_bonzini.js`, `76_end.js` | M2 (+ QA) | `BZ_carton`, `BZ_onCarton`, `BZ_atmos`, `BZ_roles`, `BZ_scene`, `BZ_end` (with the series pieces `BZ_ritualStamp` and `BZ_ctaPill`). |
| `overlay/scenes/39_gecko_shim.js`, `40_gecko.js`, `41_gecko_unshim.js` | lead | The validated margouillat, unchanged, and its adapter (`SCORE.geckoShim()`). |
| `overlay/scenes/50_compose.js` | lead | Camera, draw order and module calls. Its fallbacks (`window.__FB`) are no longer used. |
| `overlay/scenes/60_type.js` | lead (+ QA, v2) | Series chip, pills, « Boutique · Mboppi », « QUI A TORT ? », the bands (photo / lesson / next), the 4-line sample caption. |
| `tools/sheet.py`, `tools/qa_score.js` | lead / QA | Contact sheet; score QA (above). |
| `lib/audio_ep3.py` | sound (v2) | The sound engine (ep2's pattern): reads `SCORE.soundCues()` / `music()` live through node, mixes `audio/mix.wav` + `audio/stems/`, `audio/audio_report.json`, `out/chk_audio_sheet.jpg` (below). |
| `data/gaps.json` | QA (v2) | Minimum silences before a line, read by `retime.py` (above). |
| `data/timing.json` (absent until re-timing), `timeline_main.json` (`frames` 1338), `defaults.json`, `voice_plan.json`, `takes.json`, `vocheck.json` | lead | Timing and the chosen takes. |
| `out/v2chk/`, `out/v2chk_sheet.jpg`, `out/v2chk_360.jpg` | QA (v2) | **The v2 check stills** on the defaults (21 key moments, `--mb 4`) and a 360 px wide downscale of 12 of them. |
| `out/qa_sheet.jpg`, `animatic_sheet.jpg`, `chk_M1_sheet.jpg`, `chk_M2_sheet.jpg` | earlier stages | v1 sheets. |

## API notes (v2)
- `W(id, prefix, nth, fb)` / `WE(…)`: `prefix` may be `'a|b'` (either spelling: `'poign|pogn|poing|poin'`, `'bonz|bond|bons'`);
  `WA(id, [prefixes], …)` is kept as an alias. Fallbacks are `SYL(id, k, n)` = k of the line's n syllables × DUR[id].
- `WEL(id, prefix, n)` = `max(WE, END(id))`: the end of a line's LAST word (the ASR stamps it early) — used for the 1st gloup.
- `WB(id, prefix, nth, fb, lead)` = a time in the pause just BEFORE a word, never inside the previous word — used for
  « PAREIL ✓ » (before « pour comparer »).
- `TEXTS()` rows are `[t0, t1, id, text, style, takeover]` (`|` line break, `*…*` emphasis). New row `'photoTout'`.
- `soundCues()` returns 76 cues `{t, name, g, pan}`; `music()` = `{silentUntil, tenseFrom, cut, riseFrom, balafonFrom,
  majorFrom, sigAt, finalChord, end}`, read live by `lib/audio_ep3.py` (its python replica `derive_score()` is a fallback
  only: `python3 lib/audio_ep3.py --replica` must say « differing cues: none » after any change of the score's timing code).

## T/W anchors (v2, `SCRIPT_V2.md` §7.2; values on the defaults)
Rule P1: a loud cue never starts inside a word — after the line (`END + …`), on a word end (`WE + .03`), or in a pause.

| Beat | Anchor | Default |
|---|---|---|
| hook (T1, T2) | bagLand `T1+.35` · **slam `max(T2−.12, min(END(T1)+.03, T2−.03), T1+1.4)`** (guard: the BOUM never in « arrivés ») · shadow0 `slam−.6` · music `slam+.5` | .40 · 1.85 · 1.25 · 2.35 |
| QUI A TORT ? (N1) | memeOut `N1−.7` · qui `N1−.4` · steel `N1−.2` (plate « IL A FAIT CE QUE / TU AS ÉCRIT. ») | 2.75 · 3.05 · 3.25 |
| J'AI ÉCRIT (T3) | clear `T3−.4` · order card `T3−.15` | 6.65 · 6.90 |
| LA PHOTO NE DIT PAS TOUT (N1b) | band `bandPhoto = N1b−.05` · polaroid shivers on `W(N1b,'photo')` · **tags `END(N1b)+.03 / +.25 / +.47`** (mono .22) | 10.32 · 10.64 · 12.29 / 12.51 / 12.73 |
| lesson (N2) | **cut `max(N2−.2, tags[2]+.03)`** · band `cut+.05` · soggy `N2+.25` → `max(+1.2, END(N2)−.3)` · mock `END(N2)+.12` | 12.76 · 12.81 · 13.21 → 16.17 · 16.59 |
| LA PROCHAINE FOIS (N3a) | **next `max(END(N2)+.45, N3a−.25)`** · sheet `next+.2` | 16.92 · 17.12 |
| fiche (N3) | **lines `W(N3,'mati')`, `W('tail')`, `W('poign\|pogn\|poing\|poin')`, `W('emball')`, −.06, mono .35** (fallbacks SYL 4 / 7 / 9 / 12 of 15) · **stampAll « ÉCRIS TOUT » `max(lines[3]+.5, END(N3)+.05)`** · note `stampAll+.25` | 20.29 / 21.10 / 21.64 / 22.45 · 23.37 · 23.62 |
| sample (N4) | capN4 `N4−.05` · ficheAside `max(note+1.45, N4+.25)` · **parcel (tonk) `max(ficheAside+.1, WE(N4,'echant\|chant')+.02)`** · **unbox `max(parcel+.8, W(N4,'seul')−.1)`** | 24.27 · 25.07 · 25.42 · 26.22 |
| N4b / N4c | capL3 (caption line 3) `N4b−.05` · garde (line 4) `W(N4c,'garde')−.05` · polaIn `max(garde−.2, unbox+.1)` · keep `min(max(W(N4c,'garde')+.1, unbox+.45), taps[0]−.9)` · **pareil `max(WB(N4c,'pour',.1), polaIn+.5)`** · parcelOut `max(unbox+.6, pareil−.3)` | 26.78 · 28.48 · 28.28 · 28.63 · 28.97 · 28.67 |
| key moment (silent) | check `T4−.2` · letters `check−1.1 / −.75 / −.4` · taps `P−.7 / −.48 / −.26` · **key `min(END(N4c)+.45, taps[0]−.55)`** (= END(N4c)+.10) · capN4Out `max(key+.05, garde+1.65)` · polaOut `max(key+.45, pareil+1.4)` | 32.60 · 31.50… · 30.80… · 30.25 · 30.30 · 30.70 |
| brand (N5, N5b) | **violet = sig `max(N5−.35, min(END(T4)+.05, N5−.1))`** · label `violet+.4` · role1 `W(N5,'command')−.12` · role2 `W(N5b,'transp')−.12` · bzName `W(N5b,'bonz\|bond\|bons')` · labelNote `max(role2+.6, label+.8)` · **gulps `WEL(N5,'toi')+.03`, `WE(N5b,'transp')+.03`, `min(END(N5b)+.03, N6−.3)`** (mono .5) | 34.04 · 34.44 · 34.54 · 36.24 · 37.17 · 36.84 · 35.77 / 36.93 / 39.09 |
| end (N6, N6b) | endcard `N6−.25` · cta `N6` (on « Écris ») · tagLine `cta+.55` · **stampEnd `max(END(N6)+.05, N6b−.3)`** · final chord `END(N6b)+.05` · loop `min(end−.35, max(end−.6, stampEnd+1.45))` · out `loop+.2` | 39.26 · 39.51 · 40.06 · 42.04 · 43.74 · 43.99 · 44.19 |

**Holds on the defaults** (QA trims .14 s at each fading end): subtitle 1.85 · « QUI A TORT ? » 3.45 · steel 3.40 · order card
10.02 · « LA PHOTO NE DIT PAS TOUT. » 2.35 · tags 7.56 · lesson 3.83 · « FAIS UNE FICHE. » 6.31 · « ÉCRIS TOUT » 1.70 · note
1.45 · caption lines 1–2 5.89 · line 3 3.32 · line 4 1.62 · « PAREIL ✓ » 1.88 · « À GARDER » 3.92 · « C'EST ÇA ✓ » 6.66 ·
role 1 4.47 · role 2 2.77 · CTA 4.23 · « MAINTENANT, TU SAIS. » 1.95. The violet note is read alone 0.70 s before N4; the
key-moment pause is 2.65 s.

## On-screen texts (v2, `SCRIPT_V2.md` §3)
- steel plate « IL A FAIT CE QUE / TU AS ÉCRIT. » (`PLATE_TXT.steel`);
- **new** cream band « LA PHOTO / NE DIT PAS *TOUT*. » (`TEXTS` 'photoTout', 96 px, with N1b);
- tag n° 3 « POIGNÉES ? » (`G.tagDef[2]`), fiche plate « POIGNÉES » (`FICHE.labels`);
- lesson band « LE FOURNISSEUR / CHOISIT *TOUT* / CE QUE TU N'ÉCRIS PAS. » (72 px);
- cream band « LA PROCHAINE FOIS, / FAIS UNE *FICHE*. » (fitted ≈ 85 px);
- stamp « ÉCRIS TOUT » (TEXTS 'stampAll' + the fallback in `34_fiche.js`);
- sample caption « L'*ÉCHANTILLON*, / C'EST UN SEUL SAC. / DEMANDE-LE D'ABORD. / GARDE-LE POUR COMPARER. » (4 lines ≈ 61 px,
  y ≈ 238–557; lines 1–2 with N4, 3 with N4b, 4 on « Garde »: `60_type.js` caption2 `lineIn`);
- roles card 1 « LA COMMANDE, / C'EST *TOI*. » (TEXTS 'role1' + the fallback in `70_bonzini.js`);
- CTA pill **unchanged: « Écris FICHE en commentaire »** (the voice says « le mot »; `76_end.js` extracts the keyword with
  `/Écris (.+?) en commentaire/`, never write « le mot » there). Keyword: **FICHE**.

Looked at on `out/v2chk/` (full size, crops of the top zone, 360 px wide): every changed text is present, readable and inside
its zone (nothing at y < 150, no text at x > 960 for y 900–1560; « POIGNÉES ? » spans x ≈ 612–1015 at y ≈ 551–637, above that
band and ≈ 10 px under the bands' bottom edge).

## Sound (`soundCues()`, §7.3)
`pffuit` .35 (under « n'écris pas ») · the 4 `clac` .5 (60 ms before each word) · `kraft` .4 · `label_slap` .3 · CTA `pop` .4 ·
`final_chord` at `END(N6b)+.05` (also `music().finalChord`). The `tonk` is .8 in the comma after « L'échantillon, », and drops
to .5 by itself when a short N3 → N4 pause pushes the parcel onto « c'est » (§6 cut plan, point 2). Every other cue follows
its new anchor (tag stamps, ÉCRIS TOUT, PAREIL ✓, signature, gloups, ritual stamp: all in pauses).

## Mix (`lib/audio_ep3.py`, ep2's sound engine and constants)
- `nice -n 5 python3 lib/audio_ep3.py --sheet` (≈ 75 s, from E): `audio/mix.wav`, `audio/stems/{vox,music,sfx,hits,amb}.wav`,
  `audio/audio_report.json`, `out/chk_audio_sheet.jpg`. Options: `--no-voices`, `--force-voices`, `--words`, `--gallery`
  (every cue once → `audio/sfx_gallery.wav`), `--replica`; `EP_DIR=<copy>` runs on a test copy.
- Voices are used only when `data/voice_plan.json` + `takes.json` match the score (every id planned, no take newer than
  `takes.json`, planned starts within .15 s of `SCORE.T`); otherwise it mixes music + SFX and says why (today: the plan is
  v1's). ASR words come from `vocheck.json` only when it is newer than the takes.
- Ducking: music 12 dB (+ `R.CARVE_DB` 6 dB carve), soft SFX 9 dB, impacts 6 dB, `R.VOX_TRIM = {}`; the final chord (after the
  last word) is not ducked. Master −14 LUFS, TP ≤ −1 dBTP. Without voices `mix.wav` is the M&E at the projected final gain
  (≈ −25 LUFS) and the report gives the projected final (−14.01 LUFS, TP −1.30 on the defaults).
- Every one of the 44 cue names the score emits has its own sound; an unknown name plays its family's sound and is flagged.

## Deviations from `SCRIPT_V2.md` (each a one-line revert in `01_score.js`)
- **« TAILLE ? » moved 40 px down** (`G.tagDef[0].off` −110 → −70, centre (585, 690)) and « POIGNÉES ? » 4 px down (816, 594):
  at the spec's (816, 590) the 409 px « POIGNÉES ? » covered the « ? » of « TAILLE ? » (seen at `tags[2]+.3`). Stacked now,
  both read whole; « POIGNÉES ? » keeps 52 px (the 46 px fallback did not separate them on its own).
- **Fallbacks are syllable-proportional** (`SYL`, ep2 pattern) instead of the spec's fixed seconds; same values ±.2 s on the
  defaults, and they scale with a long or short take when the ASR misses a word.
- **`slam` guard** `min(END(T1)+.03, T2−.03)`, **`violet` guard** `min(END(T4)+.05, N5−.1)`: no change on the defaults; they
  keep the BOUM out of « arrivés » and the balafon signature out of T4's « ça » when a pause shrinks.
- **« PAREIL ✓ » uses `WB(N4c,'pour')`** (the pause before « pour », never inside « -le ») instead of `W(pour)−.1`.
- **Gloup 1 uses `WEL(N5,'toi')`** instead of `WE(…, DUR.N5)` (the ASR stamps the last word early).
- `A.bandPhoto = N1b−.05` and `A.capL3 = N4b−.05` are named anchors (the spec wrote them inline in TEXTS / `60_type.js`).
- Additions the spec lists as optional: the polaroid shivers on « photo » (`A.photoShiver`, no sound); the margouillat looks
  at the polaroid during N1b.
- The tonk's automatic .5 (the cut plan's rule applied by the score).
- Not applied (needs the patron, §9 point 6): the share line stays « Tague celui qui commande / toujours « comme la photo » ».

## Re-timing risks
- **The new takes are not at 3.7 syl/s everywhere** (raw speech spans of `audio/vo/*`, read only): T2 ≈ 1.75 s (default
  1.08), N3 ≈ 4.7–4.8 s (4.05), N1 3.15–3.9 s (3.24), N2 2.9–3.0 s (3.51), N4c ≈ 1.4 s (1.62). With retime's default spacing a
  long take eats the pause after it — use `--pauses` (or rewrite `T`/`DUR` per §7.1). Depending on the picks the film lands
  between ≈ 43.9 s (fastest takes) and ≈ 48.4 s (slowest), with the §6 pauses; past 45 s apply the §6 cut plan (the QA warns).
- **N3 is long**: « ÉCRIS TOUT » waits for END(N3) (+.05), so the fiche plates' lines hold longer — no risk, but if N3 runs
  4.8 s the band « FAIS UNE FICHE. » stays ≈ 7 s (fine, it is the keyword).
- **N4**: with a 0.9 s pause the parcel can land on « c'est » (tonk drops to .5 by itself); `unbox` is `parcel+.8` on most
  takes (the bag rises on « sac »); the QA warns if it comes after N4b starts.
- **N4c « Garde-le, pour »**: « PAREIL ✓ » needs the comma pause; without one it lands on the word boundary (QA checks).
  N4c_s8 has a long one (≈ .45 s after « -le »), so `WB(N4c,'pour')` lands in it — but only if the ASR returns « pour »: the
  syllable fallback (`SYL 2/6`) would put the stamp ≈ .38 s into the take, inside « Garde-le » (QA error).
- **N5b « Le transport, c'est »**: N5b_s1 says the comma WITHOUT a break (energy: « port » ends ≈ .77 s, « c'est » follows at
  once; the only pause is ≈ .26 s before « Bonzini »). The 2nd gloup (`WE(transp)+.03`) then starts inside « c'est »:
  `soundCues()` lowers any gloup that falls inside a word to .5 (`inWord`, QA WARN only). Keep it, or pick a take with a
  real pause after « transport ».
- **Stale ASR words**: `data/vocheck.json` is v1's; re-run `lib/vocheck.py` on the v2 takes before `retime.py` (step 2 above).
  The QA fails on words that do not match a v2 line or do not fit its take.
- **The takes chosen at 19:13** (`takes.json`, read only) re-time to **≈ 46.3 s** with `--pauses --tail 0.9` (QA: no error, WARN
  > 45 s); the cut plan's pauses (points 1–3) give 46.0 s. Point 4 is needed: three picks are under the §2 window of 3.6–4.0 syl/s — T1_s2
  (1.90 s, 3.15 syl/s; T1_s1 1.46 s, 4.1), N1_s1 (3.91 s, 3.07; N1_s3 3.15 s, 3.81) and T4_s1 (1.63 s, 3.07; T4_s3 1.27 s,
  3.93). Those three swaps save ≈ 1.55 s: ≈ 44.7 s with the §6 pauses, ≈ 44.45 s with the cut plan's pauses.
- **Words the ASR may not return** (fallbacks then use the syllable model): `'poign…'` (N3, also « poignets »), `'echant|chant'` (the small ASR hears « les chantillon »),
  `'seul'` (N4), `'pour'`, `'garde'` (N4c), `'command'`, `'toi'` (N5), `'transp'`, `'bonz…'` (N5b).
- `retime.py`'s minimum tail is 1.2 s: pass `--tail 0.9` (end = END(N6b)+.9 ≥ stampEnd+1.8, QA checks it).
- The key moment needs ≥ 2.65 s between END(N4c) and T4 (gaps.json); under it the big carton arrives during « comparer » (QA).

## v1 history (stage 3, on the v1 voices)
Kept for the record (times and texts are v1's). The v1 QA sheet is `out/qa_sheet.jpg`; the v1 timing `data/timing_v1.json`.

1. **« À GARDER » came 1.45 s after its word.** The tag was tied at 21.10 s, after N4 had ended, while « garde-le » is
   said at 19.65 s. It is now tied on « garde-le pour » (20.19 s), as soon as the sample is out of the parcel. TOI's right
   glove goes straight from the parcel to the tag, slaps it on and clears it within 0.55 s (`01_score.js`: `A.keep`,
   `gloves()`). Before, the glove covered « À GA_R » at the moment the tag appeared. The tag is now readable from 20.6 s
   to 24.2 s.
2. **« PAREIL ✓ » was held 1.25 s and read faint.** It now lands between « pour » and « comparer » (`compar−.25`).
   The polaroid leaves at `max(key+.45, pareil+1.4)`, so the stamp is held 1.6 s. Its ink is a deeper amber (`#C86400`,
   full opacity): `#E58A00` almost vanished on the light photo (`36_sample.js`).
3. **Frame 0 drew « Boutique · Mboppi » at half opacity.** The motion-blur sub-frames of frame 0 sample t < 0, and the
   type layer skipped texts that start at 0. These texts now count as on for t < 0 (`60_type.js textsAt`).
4. **« TON FOURNISSEUR · CHINE » was 34 px.** That pill says who answers « C'EST CE QUE TU AS ÉCRIT. ». It is now 42 px
   and shifted to x + 100, so it spans about x 330–930 at y ≈ 860, above the safe-zone band (`60_type.js`,
   `01_score.js pills()`).
5. **The lesson band is bigger.** It now uses 72 px body lines, with « C'EST LUI » at about 110 px (it was 66 / 102). It is
   THE sentence of the film.
6. **The sample caption had an empty reserved row** for 1.45 s before « GARDE-LE POUR COMPARER. ». The panel now grows
   downwards when the line arrives, and its top stays fixed (`60_type.js block()`).
7. **The steel plate's exit crossed the series chip.** It is lifted away and was still half-visible over the chip at
   y ≈ 210. It now fades out before it gets there (`01_score.js steel()`).
8. **On the end card, the service line came in before the name.** The name now comes with the logo (`endcard+.3`), and
   « Chine → Douala · bateau ou avion » follows at `endcard+.5` (`76_end.js`, `01_score.js endcard()`, `TEXTS()`).
9. **Guards for the lead's re-timing.** They do not change today's values, and they were found by the jitter runs of
   `tools/qa_score.js`:
   - the subtitle is held at least 1.4 s (`slam ≥ T1+1.4`);
   - « GARDE-LE POUR COMPARER. » is held at least 1.4 s (`capN4Out ≥ garde+1.65`);
   - the ritual stamp gets 1.45 s when the tail allows it (`loop`).

**Sound cues moved** (they are read live from `SCORE.soundCues()`, 76 cues): the `tic` of « À GARDER » (21.10 → 20.19)
and the `stamp` + `sparkle` of « PAREIL ✓ » (20.66 → 20.46). (v1: there was no mix yet.)


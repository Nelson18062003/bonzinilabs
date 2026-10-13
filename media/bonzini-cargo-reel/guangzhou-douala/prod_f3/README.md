# prod_f3 — film 3 « LA VOITURE SORT… ET LES TÉLÉPHONES AUSSI ! » (20,20 s, 606 images; variants main · wa · colis)
Film 3 on the shared engine of prod_f1 (below: film 1's notes, kept for the shared modules). Film-specific files:
`overlay/scenes/01_score.js` (the score), `overlay/scenes/30_film3.js` (plunge into the phone, REC tags, red/blue split),
`lib/mix.py` (= film 1's + beep, riser, suck, engine, creak, the phone-speaker filter and the low pulse), `data/hides.json`
(from `work/h_*.json`), `voice_f3/` (NDb / NDw re-stretched).
```
python3 tools/build_hides.py && python3 tools/prep_clips.py --score            # v7 + v3 frames, blurs baked
for v in main wa colis; do python3 tools/narr_rate.py --variant $v; BZ_VARIANT=$v node tools/qa.js --no-outputs; done
cd overlay && nice -n 5 node render.mjs --pages 3 --mb 6 --out ../out/frames_main --jpg              # 606 frames
for v in wa colis; do nice -n 5 node render.mjs 440 606 --variant $v --pages 3 --mb 6 --out ../out/frames_$v --jpg; done
#   (frames 0–445 are byte-identical in the 3 variants: hard-link 0–439 from frames_main)
for v in main wa colis; do BZ_VARIANT=$v python3 lib/mix.py --stems; python3 tools/listen_test.py audio[_$v]; done
tools/mux.sh VOITURE_TELEPHONES out/frames_main ; BZ_VARIANT=wa tools/mux.sh VOITURE_TELEPHONES_wa out/frames_wa ; BZ_VARIANT=colis tools/mux.sh VOITURE_TELEPHONES_colis out/frames_colis
for v in main wa colis; do python3 tools/mp4_sheet.py out/VOITURE_TELEPHONES[_$v]_share.mp4 out/VOITURE_TELEPHONES[_$v]_sheet_360.jpg; done   # + _cover.jpg = frame 0
for v in main wa colis; do BZ_VARIANT=$v node tools/qa.js; done
```
Integration (13/10/2026): shared modules re-synced from prod_f1 (engine, 05_footage, 20_duplex, 50_compose, 60_type were
already identical; qa.js, listen_test.py, mux.sh, frames_sheet.py taken from film 1's review 2 — qa.js made generic:
`SCORE.STAMP_T` = the stamp hits, `SCORE.OUT_NAME` = the deliverables' name, films 1-2 fall back on their own). The Toyota
blur of r 3,60–4,00 tightened (margin 2, feather 3, σ 7: at σ 18 / margin 5 it pulled the jumping man's dark head into
the ellipse and read as a blurred head). The freeze r 28,05 punches in (0,30 s, s 1,875 → 2,35, crop x 116–576) so the
green-jersey man's profile leaves the frame instead of staying frozen 1,95 s. The REC of P1 leaves in 2 frames at the
plunge (its copies ghosted on the zoom). Listen test (small, phone band): narrator 95–100 %, real voice 5/7 = 71,4 % on
every delivered AAC — RV4 « Bonzini Trading » is heard « Banzini Freddy » (the same samples as films 1-2: source cap,
SERIE §7.5, the owner's call).

Integration 2 (13/10/2026, after the machine restart): shared modules re-diffed against prod_f1 — engine.html, render.mjs,
kit.js, 00_edl / 05_footage / 20_duplex / 50_compose / 60_type and every shared tool are byte-identical to film 1 [CORRECTED by
review 3: NOT `tools/listen_test.py`, which carried film-3 homophones in LOCAL_HOMO, silently — see Review 3]; lib/mix.py
= film 1's + film 3's SFX / phone filter / pulse; qa.js = film 1's + `STAMP_T` / `OUT_NAME` + the waiver below.
- **Director's waiver (binding) in `tools/qa.js`**: RV4 « Bonzini Trading » is said « Bonzini Traini » (source limit,
  SERIE §7.5). The listen gate passes when the ONLY missed real-voice words are RV4's « bonzini » / « trading », the RV4
  subtitle reads « Bonzini Trading » on screen and every other real-voice word is heard; the narrator gate is unchanged
  (≥ 90 %). Scores are printed as measured and every use is listed under `WAIVER` in the qa output (mix, share AAC, WhatsApp
  AAC, and the informative large-v3 reports). RV4 keeps film 1's treatment exactly (presence +4,5 dB at 3,2 kHz, air −24,
  murmur −15 dB at source 18,80–19,19, gain only).
- **colis: N5a at 15,30** (pill + ,45; was 15,15): on the colis mix the weak listener fused the end of RV4's « faites » with
  « Tes colis… » and dropped RV5 and RV4 entirely (real voice 0/7, reproducible). Tested 15,25 / 15,30 / 15,35: all three hear
  every non-brand word. The plate's parcel starts with the call (route0), so colis frames ≥ 15,15 changed.
- **Ambience duck 13 dB under every voice** (score `music().ambDuck`, read by lib/mix.py; films 1-2 keep 10): the first
  re-mux failed the gate on the main share AAC — whisper small entered its no-punctuation mode (« Il filme au coin une
  voiture… ») and skipped RV5 and RV4 entirely. `tools/listen_robust.py` (mix + AAC round trips at 96–256 k) measured the
  old mixes at 9/11 (main), 11/11 (wa), 9/11 (colis) decodes hearing the real voice; ambience −13: 18/18, 18/18, 17/18.
  (SFX duck 6 dB: 9/11, no gain; bed carve 6 dB: 11/11 — not needed.) Real-voice margin RV4 5,1 → 5,4 dB, narrator NA
  12,0 → 14,1 dB; the crowd stays full between the lines.
- **Limiter ceiling −2,0 dBTP** (score `music().ceil`, read by lib/mix.py; films 1-2 keep −1,3): the 128-k WhatsApp AAC of
  the −1,3 dBTP main mix peaked at −0,55 dBTP (the engine's low saw, 2,51 s). Now every delivered AAC measures −1,8 to −2,0
  dBTP, −14,0 LUFS. Robustness after it: 12/12 decodes in each variant. The new mixes went into the existing mp4s with
  `tools/remux_audio.sh` (H.264 stream copied bit for bit, AAC re-encoded as mux.sh does, then the same AAC listen tests):
  the picture had not changed since the mux and the frame folders were already deleted.
- **Band exit 10,85**: the band also fades out over the first quarter of its drop (≈ 3 frames, 180 px): at 10 000 px/s the
  full-strength smear of the body and of the dashed route (4 + L px tall dashes) printed a grid of blocks over the crowd on
  frames 326–328. The glides (2,00 · 7,85) keep the shared module's smear (thin dashed texture on 1–2 frames, as film 1).

Results (13/10/2026, integration 2): 20,200 s / 606 frames, video and audio end together, in all 6 files —
`out/VOITURE_TELEPHONES{,_wa,_colis}_share.mp4` 25,61–25,62 MiB (1080×1920 High@4.1) and `…_whatsapp.mp4` 5,64–5,65 MiB
(720×1280 High@3.1), BT.709 tv; −14,0 LUFS, mixes −2,0 dBTP, AACs −1,8 to −2,0 dBTP. Weak listener (gate): narrator
95–100 % (main mix: « Écris » heard « écrite »), real voice 5/7 everywhere = only RV4's brand words missed (waiver);
large-v3 the same. `node tools/qa.js` PASSED, 0 warning, in the 3 variants (out/qa_VOITURE_TELEPHONES_<v>.txt).
Sheets `out/VOITURE_TELEPHONES[_v]_sheet_360(_dim50).jpg` (decoded from the share mp4), covers `…_cover.jpg` (frame 0),
full-size beats `out/look3/`. Frame folders deleted.

Review 3 (13/10/2026, the film 3 review: 0 blocking, 5 major, 10 minor) — what changed, finding by finding:
- **Toyota blur on the jumping man's head (major)**: the score dropped every per-hide σ — `v7_toyota_a` (« σ 7 ») was in fact
  baked at the default σ 18: a flat grey disc on his crown. The score now passes `margin / feather / sigma / sigma_keys /
  keep_dark` to `tools/prep_clips.py` (and `tools/build_hides.py` copies them). New in prep_clips: `keep_dark` = an
  OCCLUSION-AWARE hide — a dark occluder in front of the logo keeps its pixels (luma < 0,44 → 0,54 smoothstep, morphological
  opening 3 SOURCE px so the logo's own hollows and the grille slats are not « kept », dilated 1 px) and the blur is a
  normalised convolution over the light pixels only (nothing of the hair bleeds into the patch); `sigma_keys` = σ keyed on
  source time. v7_toyota_a: σ 4 / margin 1 / feather 3 while the head is under the emblem (keep_dark r 3,55–3,80), σ 4 → 18
  over r 3,77–3,97 (no jump into `v7_toyota`, σ 18). Checked: `tools/hide_sheet.py --only v7_toyota_a` and f 62–76 full size
  (hair intact, emblem a soft light spot, nothing readable) and at 360 px.
- **RV4 « faites-nous confiance » vs the makossa re-entry (major)**: `hits` = [7,85 (phones), 14,85 (the pill, after RV4 ends
  14,695)]; section 2 keeps its groove from 13,95 but `duckOver: [[13,90, 14,795, −40]]` (lib/mix.py: a deeper duck over a
  span, raised-cosine 60-ms edges) — −32 still left the decaying tail of « confiance » only 4,6 dB over the groove. Measured
  (voice stem vs music stem incl. the balafon signature, 50-ms windows 13,70–14,70): worst +11,5 dB (13,70, the balafon tail,
  before the groove), +12,6 dB or more from 13,95 on, in the 3 variants.
- **Button in « Écris : voiture » (major)**: `compose_section` honours a section's `button` (number, or false); film 3's is
  19,65 (13,95 + 9,5 beats: the off-beat after NDb's last word 19,55, before the 19,90 ambience tail). The groove's own
  18,75 downbeat stays (ducked: −23,4 dB on the music stem vs −18,8 with the old button). The weak listener now hears
  « écrit(s) voiture(s) » (= écris voiture) on the mix, the share and WhatsApp AAC and their pcm_s16 decodes, in main; wa
  « répond voiture »; colis « écrit / Écris, colis ».
- **Dead air after « C'est fort ! » (major)**: P5 gets the crowd (`amb` hold from v7 r 9,80, −16): −60 dB until 6,88 (« fort »
  ends 6,94), −6 at 7,08, 0 at 7,85; the 6,20–6,29 silence before RV5 is kept. 100-ms RMS of the mix 7,1–7,8: −28,6 · −28,2 ·
  −24,3 · −26,6 · −21,1 · −22,2 · −17,4 dBFS (≥ −30 everywhere).
- **listen_test.py relaxed the gate silently (major)**: correct — it was NOT byte-identical to film 1's (claim corrected
  above). The film-3 homophones stay (« ils filment » = « il filme », « écrit » = « écris »: exact homophones), but EVERY use
  is now printed per line (« NA: ils≡il · filment≡filme », « NDb: ecri≡ecrit ») in the report's `normalisations`, in the
  console and in `node tools/qa.js` under `NORM`. Kept as a FILM-3 normalisation (films 1 and 4 have none of these words);
  not back-ported to prod_f1 / prod_f4 from here (their folders belong to other jobs): the director decides.
- REC over the RV4 box (minor): `A.rec2End = A.sigSub − ,15` (the fade ends 12,07, the box starts 12,10).
- Comb on the band glides 2,00 / 7,85 (minor): `20_duplex.js` = film 4's (the `G.band.lock` option: body and route at the
  FRAME's time, edge ramp ≤ 40 px) + `lock.parcel` (the parcel too, unsmeared); film 3 sets `lock {cap 40, frames .3, parcel}`.
- Band exit pop + veil (minor): an ease-in (x²) drop over 0,30 s, alpha 1 until 70 %, exactly 0 once out; `30_film3.js`
  masks the REC tag under the band while it passes over the phone (the tag is drawn in the crisp pass, over everything).
- Punch-in smear + 3 still frames of the profile (minor): ease-OUT over 0,45 s from the first frozen frame (peak 6,7 instead
  of 10 × the range per second) and HALF shutter over it (`shutter()`); the profile leaves the frame by f 343.
- NDa 15,05 (main, wa): 0,355 s after RV4. NA 0,23 / NC 8,02: off the REC beeps (0,15 / 7,95). NA at 0,22 (the review's
  value) made the native AAC encoder overshoot to −0,90 dBTP at 0,49 s on the main share file (the mix: −4,65 there); at 0,23
  all six AACs measure −1,79 to −1,98 dBTP.
- « VRAIES IMAGES » on the panel's border (minor): during the panel the chip sits LEFT of the logo on the top row
  (x ≈ 571–840, y 176–216); it slides in the filé, left first then up, never over the logo pill (score `logo(t)`; the shared
  module is untouched — films 1 / 4 have the same geometry: back-port is the director's call).
- ×2 ramp hard to feel (minor, optional): NOT done — a readable ×3 would eat r 4,40 → 10,40 and run past P4 / P5's action
  (the guide's raised hand, r 8,40–9,80, and the C'EST FORT ! freeze on r 9,80); it needs a new cut of P3–P5, not a fix.
- out/: `mux.log` rewritten from this review's mux + remux + qa (with the WAIVER verdict); scratch images moved to
  `work/scratch_out/`, render logs to `work/logs/`.

Results (13/10/2026, review 3): 20,200 s / 606 frames, audio and video 20,200 s, in all 6 files (render deterministic: re-rendered
frames 390 / 403 byte-identical) — `out/VOITURE_TELEPHONES{,_wa,_colis}_share.mp4` 25,61–25,63 MiB (1080×1920 High@4.1) and
`…_whatsapp.mp4` 5,67–5,68 MiB (720×1280 High@3.1), BT.709 tv; −14,0 LUFS (decoded AAC −14,04 to −14,06), mixes −1,99 dBTP,
AACs −1,79 to −1,98 dBTP. Weak listener (gate, small): narrator 100 % and real voice 5/7 = only RV4's brand words missed
(waiver) on the 3 mixes, the 6 delivered AACs (f32 decode, qa) and their pcm_s16 decodes; normalisations printed (NA ils≡il ·
filment≡filme; NDb ecri≡ecrit when used). Strong listener (large-v3, informative): the same, 9/9 reports. Robustness
(`tools/listen_robust.py`, mix + AAC 96–256 k): 6/6 decodes hear RV5 + RV4 in each variant. `node tools/qa.js` PASSED, 0 warning,
in the 3 variants (`out/qa_VOITURE_TELEPHONES_<v>.txt`, WAIVER and NORM entries listed). Sheets `out/…_sheet_360(_dim50).jpg`
(decoded from the share mp4), covers = frame 0 (identical in the 3 variants), full-size beats `out/look3/`. Frame folders deleted.

# prod_f1 — film 1 « LÀ-BAS, ON CHARGE. ICI, ON REÇOIT. » (36,80 s) + film 2 « DÉPOSÉ. REÇU. » (variant `cut`, 19,35 s)
The engine below, with this production's score (`overlay/scenes/01_score.js`, SERIE.md §3–§5.2) and module contract
(`MODULES.md`: 20_duplex.js, 40_map.js; stand-ins in 50_compose.js). Production-specific tools:
```
python3 tools/peek.py CLIP T… [--rect --box --keys --grid --crop --zoom]   # look at source frames (as prep reads them)
python3 tools/mkhide.py NAME CLIP T0 T1 X Y W H --rel DX DY W H [--at T]   # tracked blur box + check sheet → work/h_NAME.json
python3 tools/build_hides.py                                               # work/h_*.json → data/hides.json
python3 tools/masks.py                                                     # sticker masks (dilated 8 px) → data/masks.json
BZ_VARIANTS=main,cut python3 tools/prep_clips.py --score                   # frames of both films, grade + blurs BAKED
python3 tools/hide_sheet.py [--only a,b] [--wrap N]                        # the baked blurs, every 3rd frame (check)
python3 tools/sticker_sheet.py                                             # stickers vs masks over the used ranges
node tools/qa.js --no-outputs ; BZ_VARIANT=cut node tools/qa.js --no-outputs
python3 tools/voice_words.py --score                                       # data/timing.json (audit only: the score times
                                                                           # the karaoke from ../voice/real_words.json)
python3 tools/grid.py out/DIR --cols 9 --dim                               # 360-px contact sheet (+ 50 % brightness)
```
Narrator takes: `../voice/takes.json` (+ `../voice/words.json`, injected as window.TAKES / NARR_WORDS by render.mjs and
qa.js) give each line its played duration, its speech onset in the wav (`on`) and its spoken syllables; they move T.N3b,
T.N5a/b and T.end along the chain written at the top of 01_score.js (film 1 = 36,70 s, film 2 = 19,20 s) and time the felt
underlines on « autre ». Real voice: `../voice/real_words.json` (stamps on the stressed syllable, MERCI 2 frames before
« merci », the Douala glide on « clients »); RV4 out 22,665 (a bystander's voice starts there).

## Deliverables (12/10/2026) — the whole chain, per film (film 2: prefix BZ_VARIANT=cut, `--variant cut`, audio_cut/)
```
cd overlay && nice -n 5 node render.mjs --pages 3 --mb 6 --out ../out/frames_f1 --jpg      # 1101 frames, ≈ 150 ms/f
nice -n 5 python3 lib/mix.py --stems                       # audio/mix.wav (+ stems) — real voice, narrator, air, ambience, makossa, SFX
python3 tools/listen_test.py [audio_cut] [--band 300,3400] [--model small|large-v3]   # phone band, weak listener, ≥ 90 % each
node tools/qa.js                                           # PASS: picture, stickers, blurs, type, narrator, mix, listen test
tools/mux.sh LA-BAS_ICI out/frames_f1                      # out/LA-BAS_ICI_share.mp4 + _whatsapp.mp4 (BZ_VARIANT=cut → DEPOSE_RECU)
python3 tools/mp4_sheet.py out/LA-BAS_ICI_share.mp4 out/LA-BAS_ICI_sheet_360.jpg   # 1 frame / 0,5 s of the FINAL file (+ _dim50)
python3 tools/audio_sheet.py audio out/LA-BAS_ICI_audio_sheet.png                  # loudness per stem + spectrogram
python3 tools/stem_levels.py [audio_cut]                   # each stem over each voice span (who masks whom)
python3 tools/beats.py out/frames_f1 OUT.jpg t1,t2,…       # full-size beats sheet (before deleting the frames)
```
`out/`: `LA-BAS_ICI_{share,whatsapp}.mp4`, `DEPOSE_RECU_{share,whatsapp}.mp4`, `*_cover.jpg` (frame 0), `*_sheet_360(_dim50).jpg`,
`*_audio_sheet.png`, `qa_*.txt`; mixes in `audio/`, `audio_cut/` (mix.wav, stems/, mix_report.json, listen_report*.json).

# rush2 — the MULTI-CLIP edit engine (template)

The rush1 engine (`rush1/prod/`, one real clip) generalised to an **EDL of many clips**: shots with speed ramps, freezes,
reverse and slow motion, keyed crops / zooms / rotation in source pixels, split screens, windows and tilted cards,
hide boxes glued to the source pixels, a compositing-only grade, and six transitions (cut, whip, flash, container doors,
slide, iris, + fade). Same rules as the series: **one score for picture and sound**, everything a pure function of `t`,
deterministic Chromium rendering, no `Math.random`, no `ctx.filter`.

This folder is a **template**: copy it per video, rewrite `overlay/scenes/01_score.js`, keep the rest.
1080 × 1920, 30 fps. The demo score (8.5 s) exercises every feature on real footage of `rush2/src/`.

## Files
| file | role |
|---|---|
| `overlay/engine.html` | the page: fonts, kit, motion-blur accumulation (`SCORE.shutter`), grain once per frame (`window.COMPOSE_GRAIN`), **LRU of ImageBitmaps keyed `clip/f`** (40 frames / 160 MP; what the current frame needs is never evicted): `window.PRELOAD(times)` decodes what `SCORE.need(t)` names, `window.clipImg(clip, f)` returns it synchronously |
| `overlay/render.mjs` | deterministic renderer (Playwright, private origin `http://bz.local/`). Injects `window.TIMING` (data/timing.json), `CLIPS` (data/clips.json), `VOICE_ENV` (data/voice_env.json), `VARIANT` before the scenes. Pre-flight: every needed frame on disk (exit 2 otherwise). Prints decodes / cache misses / decode failures (must be 0) / cache peak. Writes `data/timeline.json` |
| `overlay/kit.js` | the series kit (rush1 copy: `rnd`, `rrect`, `makeCanvas(Cached)`, `drawLogo`, `stampText`, …) |
| `overlay/scenes/00_edl.js` | **the EDL core** (node + browser, no canvas): shot normalisation, time maps, crops, layouts, transition linking, `active(t)`, `need(t)`, `needs()`, `frameSet()`, `overlays(t)`, `shutter`, `ambience()`, `audit()` |
| `overlay/scenes/01_score.js` | **THE SCORE** (the demo; rewrite per video) |
| `overlay/scenes/05_footage.js` | draws the EDL: content layer (frames, slow-motion blend, hide boxes, grade) → composite with the transition motion (mirrored tiles, directional blur, iris, card / window) → overlays (seams, flash, doors) · `FT_grain(n)` |
| `overlay/scenes/50_compose.js` | draw order: footage → layers z < 60 → type → layers z ≥ 60 (grain: engine, once per frame) |
| `overlay/scenes/60_type.js` | type kit: mention, kinetic title, label chip, real-voice subtitle (karaoke + « vraie voix » badge + live waveform), stamp, CTA pill |
| `tools/prep_clips.py` | extracts exactly the frames the score needs, at the size it needs (Lanczos, JPEG q 3, 30 fps grid), skips what exists, prints disk; writes `data/clips.json` |
| `tools/voice_words.py` | word times of a real-voice segment {clip, in, out} cut from `work/transcripts.json` → `data/timing.json` |
| `tools/voice_env.py` | envelope (rms + 3 bands, 60/s) of each voice segment → `data/voice_env.json` (the live waveform) |
| `tools/track_box.py` | keyframes for a hide box that follows an object (template matching, forward or `--back`) |
| `tools/check_score.js` | prints the score shot by shot + the audit |
| `tools/qa.js` | the strict gate (exit 1 on error): audit + browser/node contract + outputs built on this very score |
| `tools/audit.js` | the checks shared by the two above |
| `lib/mix.py` | the sound from the score: real voice, ambience (speed-matched), procedural SFX, makossa on the BPM grid, ducking, −14 LUFS / TP ≤ −1 dBTP |
| `tools/mux.sh` | frames + mix → `out/NAME_share.mp4` (2-pass ≤ 27 MiB) + `out/NAME_whatsapp.mp4` (720p CRF 21) |
| `assets/fonts/`, `assets/logo.svg` | the series fonts, the Bonzini mark |
| `data/clips.json` · `data/timing.json` · `data/voice_env.json` | clip index · demo voice words · demo envelope (regenerate per video) |

## New video
```
cp -r rush2/engine rush2/prod_NAME && cd rush2/prod_NAME && rm -rf assets/clips out audio
# write overlay/scenes/01_score.js (shots, voices, texts, cues, music) — keep the export list (§ The score)
python3 tools/voice_words.py --score          # data/timing.json: word times of every SCORE.VOICES segment
python3 tools/voice_env.py                    # data/voice_env.json: the waveform of each segment
node tools/check_score.js                     # the EDL shot by shot + audit (crops, must-hide, safe zones…)
```
## Commands
```
# (a) prepare the frames (from the score; or --needs FILE.json / --need v7:2.0:4.0[:SCALE])
python3 tools/prep_clips.py --score                       # + --clean to delete frames no longer needed
# (b) stills (look at them full size AND small)
cd overlay && nice -n 5 node render.mjs --times 0,1.9,2.2,3.2,4.4,6.1,6.47,7.3 --pages 2 --mb 4 --out ../out/check --jpg
# (c) the film (frames 0 … N − 1)
cd overlay && nice -n 5 node render.mjs --pages 3 --mb 6 --out ../out/frames --jpg
# (d) the sound
nice -n 5 python3 lib/mix.py                              # + --stems → audio/stems/{voice,amb,music,sfx}.wav
node tools/qa.js                                          # must PASS (exit 0)
# (e) the deliverables
tools/mux.sh NAME                                         # → out/NAME_share.mp4 + out/NAME_whatsapp.mp4
```
Variants: `--variant X` (render.mjs) / `BZ_VARIANT=X` (prep_clips, mix, check, qa) — the score reads `window.VARIANT` /
`process.env.BZ_VARIANT`. The demo has `fx` (iris, fade, flash, a tilted card with blur + cover, a cinema window).
Other render.mjs options: `[start end]`, `--frames a,b`, `--scenes 05_footage,60_type` (0x_ and 50_ always load),
`--allow-missing`. Measured on the demo: stills ≈ 0.4–1 s/frame at `--mb 4` (setup included), film **0.32 s/frame at
`--mb 6` on 3 pages**, 0 cache miss; prep 6 s for 313 frames (49 MiB); mix 5 s; mux 45 s.

## The score (`01_score.js`) — what the other files read
IIFE; `window.SCORE` in the page, `module.exports` in node (it reads `data/timing.json`, `data/clips.json` itself).
`const E = EDL.build({clips: CLIPS, shots, hide, mustHide, grade, cuts})` then export at least:

| export | used by | contract |
|---|---|---|
| `FPS N T A` | all | `T.end` = film length, `N = round(T.end·30)`; `T[voiceId]` = film start of each real-voice segment; `A` = every action time, derived from the grid / the words (no free literal) |
| `shots active need needs frameSet overlays shutter CUTS cropAt ambience audit` | 05_footage, engine, render, prep, mix, tools | straight from `E` |
| `project(a, x, y)` | layers | source px of an active shot → screen px (crop, rotation, region, transition motion) |
| `TEXTS()` | 60_type, audit | `[t0, t1, id, text, style, takeover, opt]` |
| `G COL` | 60_type, audit | text boxes (`G.safe` = the safe zones) · colours (`violet` only for Bonzini) |
| `VOICES WORDS wordsOf speech voices()` | 60_type, mix, voice_words, voice_env, audit | real-voice segments `{id, clip, in, out, src, denoise, fadeIn, fadeOut, gain, text}` |
| `W WE END` | the score itself | `W('V1', 'recu')` = film time of a word (accent / case / elision insensitive, `'a\|b'`) |
| `soundCues() music()` | mix | § Sound |
| `LAYERS` | 50_compose | the score's own graphic layers |
| `BPM BEAT BAR B(k) CLIPS HIDE MUST_HIDE VARIANT check() QA` | tools | `B(k)` = beat k of the music grid (cut on it); `check()` = film-specific warnings; `QA.minHold` (default 1.0 s) |

### Shots (the EDL) — `00_edl.js` header has the full grammar
```js
{ id: 'S2', clip: 'v31', t0: 2.0, t1: 4.5,               // film seconds; the shot owns [t0, t1)
  src: {in: 5.0, speed: 1} | {keys: [[t, s]…], interp: 'smooth'|'linear', rel} | t => s,   // ramps, freezes, reverse
  blend: true,                                             // slow motion (|speed| < .95): crossfade of the 2 neighbour frames
  crop: {cx, cy, w|h|zoom} | [[t, {…}]…] | {keys, interp: 'ease'|'smooth'|'linear'} | t => {…},   // SOURCE display px
  rot: deg | [[t, deg]…],  aspect, clamp: true,
  layout: 'full'|'top'|'bottom'|'left'|'right' | {kind: 'window', x, y, w, h, r, border, borderColor, shadow}
        | {kind: 'card', x, y, w, h, tilt, border, shadow} | t => layout,
  hide: [{t0, t1, box: [x, y, w, h] | keys: [[s, [x, y, w, h]]…], kind: 'mosaic'|'blur'|'cover', cells, strength, color, r, on: 'src'|'film'}],
  grade: {exposure, contrast, sat, warmth, vignette, tint: [css, a]} | t => {…},      // over cfg.grade (the series look)
  in: 'cut' | {type: 'whip', dir, dur} | {type: 'flash', dur} | {type: 'doors', dur, color, logo, label}
    | {type: 'slide', dir, dur} | {type: 'iris', dur, cx, cy} | {type: 'fade', dur},  out: (same, used alone),
  shake: [[t, amp, hz]], cam: t => ({dx, dy, s, r}), amb: {mode: 'hold'|'match', g, in} | false, z }
```
- **Time maps.** `keys` are film times → source seconds; `'smooth'` = monotone cubic (eased speed changes, never runs
  backwards between increasing keys), linear extrapolation outside. Frame = `round(src·30)` clamped to the clip.
- **Crops** are windows of the region's aspect (9:16 full, 9:8 panes, any for windows / cards) in SOURCE DISPLAY px
  (after autorotation: v8–v10 are 1280×720). `w` (or `h`, or `zoom` relative to the largest window) is interpolated in
  log space; `clamp` (default) keeps the rotated window inside the source and the audit reports any clamping.
- **Hide boxes** are drawn under the shot's own transform, in source px: glued to the pixels under any crop / zoom /
  rotation. Times and keys are SOURCE seconds (a re-timed shot keeps its tracking). `cfg.hide[clip]` applies to every shot
  of that clip. `mosaic`: cells fixed in source px (default ≈ box/6, 4–12 cells), area-averaged. `blur`: box + 35 % pad →
  96 px → 32 → 6–16 px (`strength` 0–1) → back up in two smooth steps, feathered by a gaussian mask that stays opaque on the
  box — the same look at any scale. `cover`: a solid rounded box. `tools/track_box.py` makes the keys.
- **mustHide** (`cfg.mustHide[clip]`, same grammar + `why`): never drawn, AUDITED — at every 1/60 s each region must be out
  of the visible window or covered by the union of the active hide boxes (stickers of v1–v3, logos, plates, names).
- **Transitions.** `in` links to every shot ending at this `t0` in an overlapping region (or `in.from: [ids]`).
  whip / doors / flash switch AT `t0` (doors and flash are hard cuts for the shutter; the whip is not: its motion blur
  crosses the switch); slide / iris / fade are centred on `t0` (both shots drawn `dur/2` either side; the partner is
  extended). Unlinked: `in` animates `[t0, t0+dur]`, `out` `[t1−dur, t1]`.
  - `whip`: travel .62 × region, accelerating out / decelerating in, mirrored tiles (no edge ever shows), directional blur
    up to .42 × region (2^n taps by doubling, half resolution beyond 120 px), exposure lift, slight zoom.
  - `doors`: two container doors swing shut in perspective (slam = `EDL doorsState().slam`, 30 ms before the cut; bounce,
    shake, the inside going dark), hold, open on the new shot. Procedural steel texture (horizontal corrugations, lock
    rods, guides, cams, handles, hinges, seal, rust); `logo: true` paints the Bonzini mark + `label` stencil split on the
    seam. In-frame motion blur: 6 door states per sub-sample, averaged additively.
  - `slide`: cover slide (outQuart), motion blur with a padded edge, soft drop shadow ahead of the edge; a same-region
    partner drifts 30 % and darkens.  `iris`: circle (+ white ring), framed layouts clipped whole.  `flash`: screen + add.
- **Layers** (`SCORE.LAYERS`, or `(window.LAYERS = window.LAYERS || []).push({id, z, t0, t1, draw(ctx, t, n)})` from a
  per-video scene file): z < 60 under the type, ≥ 60 above. Follow the footage with `SCORE.active(t)` + `SCORE.project`.

### Type (`60_type.js`)
`TEXTS()` rows `[t0, t1, id, text, style, takeover, opt]`; `|` = line break, `*…*` = emphasis (`opt.ecol`, default amber;
**violet only on Bonzini words** — audited). Every style draws INSIDE `opt.box` `{x0, y0, x1, y1}` (shrinks to fit), so the
safe zones are audited on the boxes: nothing above y 150, no text right of x 960 for y 900–1560, nothing below y 1540.
`opt.ride: shotId` = the text moves with that shot's transition and is clipped to it (labels on panes, a stamp).
- `mention` (provenance chip; `opt.cut`: no fade-in) · `title` (kinetic: words rise out of their line mask, stagger .07 s,
  expo; soft shade; leave upward; start it before 0 to have it on the cover) · `label` (chip with accent bar, wipe-in) ·
  `sub` (real voice: white box, « vraie voix » badge + 5 bars driven by `data/voice_env.json`, karaoke on the word times —
  spoken = ink, current = amber highlighter, coming = 28 % — the score's corrected text is matched to the ASR words in
  order; `opt.voice`) · `stamp` (starved ink, slam + bounce + specks; `box.size`, `box.rot`, `opt.color`) · `cta` (amber
  pill, line 1 + the `*WORD*` + a drawn arrow).

### Sound (`lib/mix.py`)
- `voices()` → `{id, clip, in, out, t, end, speech: [a, b], src: 'vocals'|'orig'|'auto', denoise 0–1, fadeIn, fadeOut, gain}`:
  exactly the samples `[in, out)` of `work/vN_vocals.wav` (demucs, v1–v3) or `work/vN_48.wav`, resampled 44.1 → 48 kHz when
  needed (duration kept), **never stretched**; optional STFT gate (≤ 8 dB × denoise), zero-phase HP 90 Hz + presence; speech
  at −17 LUFS pre-master. Checked: sample count and x-corr lag 0. Speech spans must not overlap (audited).
- `ambience()` (from the shots' `amb`): `work/vN_accomp.wav` when it exists (voice-free) else `vN_48.wav`; `hold` = real time,
  `match` = varispeed on the picture's time map (anti-aliased, silent on freezes); −27 LUFS (+g, boost ≤ +6 dB); fades =
  the transitions.
- `soundCues()` → `[{t, name, g, pan, d?, note?}]`, names: `whoosh hit door_clang crane shutter stamp riser pop
  bonzini_sig tick` (an unknown name falls back on its family and is reported).
- `music()` → `{bpm, beat, grid0, prog: 'major'|'minor', sections: [{t0, t1, level: 'lite'|'bass'|'tense'|'full', shaker,
  congas, balafon}], hits: [t], stops: [[a, b]], end, duck: {voice: 12, amb: 9}}` — bar by bar with the series' makossa.
- Ducking from the dry real voice: music −12 dB, ambience −9 dB, SFX −3 dB. Master −14 LUFS, TP ≤ −1 dBTP, 48 kHz stereo
  PCM 24, exactly `T.end`. `audio/score_cues.json` = the plan it was built on (qa.js: a stale mix is an ERROR);
  `audio/mix_report.json` = levels, voice checks, margins.

### Data files
`data/clips.json` `{clip: {w, h (display px), dur, frames, rot}}` (prep_clips) · `data/timing.json` `{dur, words, seg}`
(voice_words) · `data/voice_env.json` `{fps, voices: {id: {clip, in, out, rms, bands}}}` (voice_env) · `data/timeline.json`
`{frames, dur, fps, variant}` (render) · `assets/clips/<clip>/f_NNNN.jpg` + `meta.json {dw, dh, sw, sh, k}` (prep:
frame NNNN = source NNNN/30; stored at k = the largest scale the score asks for that clip, capped at 2880 px long side).

## The demo (8.5 s, 120 bpm grid)
0.00 **S1** v7 2.0→4.0 full, speed ramp ×1 → ×1.75 → ×0.44, push 576 → 520, grille logo **mosaiced** (tracked keys),
kinetic title « ICI, / ON REÇOIT. » on the cover · 2.00 **container doors** (slam on the downbeat, Bonzini mark + stencil)
→ **S2** v31 5.0→6.3 crane lift in **slow motion** ×0.39 with frame blending + push-in + viewfinder layer · 2.60 real voice
**V1** v2 14.38–18.32 « Voilà, directement déposé, directement reçu. » (karaoke, waveform) · 4.50 **split**: top v2 8→10
(stickers excluded by the crop: y ≥ 185), bottom v7 20.75→22.75 (logo excluded: x ≥ 56), both **slide** in; labels ride
their panes; « REÇU » stamp on the word « reçu » (+ pane shake) · 6.50 **whip** to S4 v7 24.6 → · 6.89 **CTA pill**.
Checked: stills at `--mb 4` (doors closing / closed / opening, slow motion, slide, split, stamp, whip out / in, CTA; the
`fx` variant: iris, fade, flash, card with blur + cover, window), the whole film at `--mb 6`, mix (−14.01 LUFS, TP −1.26,
voice +9.4 dB over the rest), mux (share 16.2 MiB at the 16 Mb/s cap, WhatsApp 4.0 MiB), `tools/qa.js` PASSED.

## Known limits
- Blurs / mosaics / covers on moving objects need keys: `tools/track_box.py` fails through occlusions and fast pans
  (correlation < .6 is printed) — split the span, run `--back`, or hand-key. The audit only knows the regions listed in
  `mustHide`: list every sticker / plate / name / third-party logo there.
- Upscaling is Lanczos + a light unsharp (no AI): 464-px Guangzhou clips at ×2.3 and zooms beyond ×1.4 of a 576-px clip
  look soft; keep strong zooms for 720-px clips or short moments.
- Motion blur is sampled (`--mb`); very fast elements still show discrete copies at `--mb 4` (use 6–8 for the film). The
  whip / slide smear and the doors carry their own in-frame blur; type does not (riding texts fade out with the smear).
- The kinetic title uses `measureText` (the browser): its box is audited, not its exact glyph extent.
- `ambience 'match'` is varispeed (the pitch follows the speed: a ramp sounds like a tape); use `'hold'` for natural sound.
- The music library lives outside the template (`scratchpad/v3/lib` + `explainer/lib/audio`): `lib/mix.py` finds it two
  levels above the production folder.
- `render.mjs` requires Playwright at `/opt/node22/lib/node_modules/playwright` (as rush1).

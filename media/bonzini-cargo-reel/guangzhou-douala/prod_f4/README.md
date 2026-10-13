# prod_f4 — film 4 « ELLE VA OÙ, CETTE MACHINE ? » (24,65 s, 740 frames) + variant `wa` (« Réponds MACHINE ↓ »)
Spec: `rush2/SERIE.md` §3 (DUPLEX), §3.10 (signature), §4 (RV4), §5.4 (film 4). Copied from `prod_f1` (engine + shared modules:
`overlay/scenes/20_duplex.js`, `50_compose.js`, `engine.html` — kept identical to prod_f1's, never forked; the contract is
`MODULES.md`). Film-specific files:
- `overlay/scenes/01_score.js` — the score: 7 Douala shots in PLEIN mode (M1 v38 · M2 v36 · M3a/b v37 · M4 v38 · M5 v39 ·
  M6 v40) + the shared signature (panel v3), the band BAS/HAUT glides, the 5 steps, narrator H / S1–S5 / NEa + NEb (main) or
  NEw (`wa`) at their SERIE windows with the takes' real durations, RV4 at T0 = 15,30, sound cues, music plan; `SCORE.F4` =
  the states of the film-4 graphics. Deviations from SERIE are commented at each shot.
- `overlay/scenes/30_film4.js` — the film-4 layers: M2 light (+0,4 EV radial on the machine), M4 route-in-the-air trail +
  wind strokes + amber light sweep, the night card under C'EST FORT !, and the band of film 4 (5 stops that fill orange,
  the hopping kraft parcel, numbered discs, question + step phrases, the felt check) — frame-locked, crisp on the glides.
- `lib/sfx_film4.py` — pulse, hydraulics, chain, scrape, clank / clonk, wind, whoom, creak, shimmer, thunk, the « nappe »
  (merged into `lib/mix.py`'s cue table and music sections: `groove: false` = a suspended section).
- `tools/green_centre.py` — the machine's centre (green extent) on source frames, for the hand-checked light / trail keys.
- Blurs: `work/h_v39_sign.json` (shop sign « AL-BARKA », tracked), `work/h_v40_sh{L,M,R}.json` (the name over the shoulders, the head kept sharp above the jersey edge: `keep`, verify 13/10) and `work/h_v40_jersey.json` (« …SET » under the
  jersey number, hand-keyed) → `data/hides.json` (baked by prep_clips). « BOLOGNA » (v38) is proved out of frame
  (must-hide, audited).
```
python3 tools/build_hides.py && BZ_VARIANTS=main,wa python3 tools/prep_clips.py --score
python3 tools/voice_words.py --score --replace && python3 tools/voice_env.py
node tools/qa.js --no-outputs ; BZ_VARIANT=wa node tools/qa.js --no-outputs
cd overlay && nice -n 5 node render.mjs --pages 3 --mb 6 --out ../out/frames_f4 --jpg        # (--variant wa → out/frames_f4wa)
nice -n 5 python3 lib/mix.py --stems ; BZ_VARIANT=wa nice -n 5 python3 lib/mix.py --stems   # audio/ · audio_wa/
python3 tools/listen_test.py [audio_wa] ; node tools/qa.js
tools/mux.sh MACHINE out/frames_f4 ; BZ_VARIANT=wa tools/mux.sh MACHINE_WA out/frames_f4wa
```

**Verify (13/10, 02:40–03:20) — the jaw of the man in the green #23 jersey (M6, 13,83–14,57 s)** (evidence of the finding:
`scratchpad/f4verify_evidence/`)
- Finding (major, confirmed): the review-4 shoulder blurs `v40_shL / shM / shR` covered the lower jaw and the neck of the man
  seen from behind (a grey-green smear under a sharp ear). Measured on the source with the bake mask drawn: the tops of the
  three rectangles (+ margin 3 + feather) sit on the skin from r ≈ 1,9 to r ≈ 3,1 (jaw at r 2,0–2,9, the neck at r 2,4–2,5).
- Not done as suggested (raising the box tops to y ≥ 456 / 452 / 470): at r 2,0–2,15 the row of dark letters lies only 3–8 px
  below the jaw contact (x 30–40) and slopes down to the right; a rectangle top that clears the jaw uncovers letters on the
  left part of the same box. Done instead (the finding's alternative, « shape the patch around the jaw »): **`keep`**, a keyed
  edge = the top of the jersey (collar + shoulder), measured on every source frame 42–123 at x 0–100 (`tools/jersey_edge.py`
  → `work/v40_jersey_edge.json`; the strap rejected; r 3,10–3,50: x 0–20 set 3 px higher by hand, a dark letter had been read
  as the edge). The patch acts only BELOW edge + 2,5 px (logistic step, width 1,5 px) and is a normalised blur of the jersey
  pixels only (no skin smeared into the green). Box keys, bottoms, margin, feather, σ, grain unchanged.
- `tools/prep_clips.py`: `keep` is opt-in (a hide without it is baked exactly as before; only v40 was re-baked).
  `tools/build_hides.py` and the score pass `keep` through. Backups: `work/bak_jaw/`.
- Looked at: the mask over the raw source every 2nd frame r 1,40–4,10 (`out/v40_keep_mask_*.jpg`), the baked frames, the
  rendered frames 405–486 one by one at 1:1 and 405–446 at 3× (`out/v40_head_rendered_1to1.jpg`), the decoded share and
  WhatsApp mp4s at 414–438 (`out/v40_head_mp4.jpg`): ear, jaw and neck sharp at every frame; the « …ell… » letters stay an
  unreadable green; no new letter shows.
- Rebuilt (the frame folders had been deleted): main 0–739 at `--mb 6` + the 93 frames of `work/mb24_frames.txt` at `--mb 24`;
  `wa` = 0–578 hard-linked from main + 579–739 `--variant wa` + 579–584 at `--mb 24`. Frame 0 byte-identical to the previous
  cover (deterministic). `lib/mix.py --stems` re-run for main and wa: byte-identical mixes (md5 86390122… / 2be289a1…).
  Re-muxed, listen tests re-run (small + large-v3, mix + both AAC), `node tools/qa.js` PASSED for main and wa (6 warnings
  each: 3 waiver uses + 3 strong-listener notes). Sheets, mp4 sheets, beats grid, `MACHINE_WA_end.jpg`, covers, hides sheet,
  audio sheet regenerated. Frame folders deleted.
- Deliverables (03:05): `out/MACHINE_share.mp4` 25,76 MiB · `out/MACHINE_whatsapp.mp4` 8,84 MiB · `out/MACHINE_WA_share.mp4`
  25,78 MiB · `out/MACHINE_WA_whatsapp.mp4` 8,85 MiB — each 24,667 s, 740 frames, −14,0 LUFS, TP −1,5 / −1,1 / −1,5 / −1,4 dBTP.
  Weak listener (the gate): narrator 35/35 = 100 % on the mix and the 4 AAC; real voice 3/5 (only « Bonzini » / « Trading »
  → the director's waiver). Strong listener (large-v3): narrator 100 %; real voice 60 % (main mix) / 80 % (wa mix, all AAC).
```
python3 tools/jersey_edge.py --write && python3 tools/build_hides.py && BZ_VARIANTS=main,wa python3 tools/prep_clips.py --score
```

**Review 4 (13/10, 01:00–02:00) — what changed, and why** (findings: `rush2/work/f34_state.json` « f4_review »)
Picture
- **M1 cut 1,25 → 1,00** (frames 0–29 only): the young man with the school backpack (v38, age unknown) turns his head from
  r ≈ 0,75 and his cheek's edge shows from r ≈ 0,87 (profile from r 1,07): only the back of his head is ever on screen
  (checked frame by frame 20–31). M2 starts at v36 r 13,87 (ends on the clip's last frame). The groove and its first hit
  keep 1,25 (`GROOVE0`): the hit on the new cut fell on « où, cette » and the weak listener lost « où ».
- **The route of the band, readable at 360 px**: rings 18 → 36 px (night inside, white 4-px rim), filled orange with the white
  step digit (Satoshi 900 24 px) when the parcel lands; the parcel 28 × 22 → 52 × 40 (the series' sprite drawn at 4×), standing
  ON the reached ring, 1,2× pop on landing, hop 44 px; the dashed route 4 → 8 px (dashes 18 / 12). Checked on the 360-px sheet
  and at 50 % brightness: reached stops 1–5 read orange with their digit, the others as empty rings.
- **Band smear on the first frame of a glide** (6,63 · 10,03 · 13,23 · 15,37): `G.band.lock {frames: ,3, cap: 40}` (new, opt-in
  in the shared `20_duplex.js`; absent = films 1-3 unchanged, byte for byte the same code path): the band body and its route
  are drawn at the FRAME's time like the stops / phrases that ride them; the edges keep a ramp of ≤ 0,3 frame of travel
  (≤ 40 px). The band no longer turns into a see-through smear; the line stays crisp under the stops.
- **The amber trail of M4 is gone** (drawn ON the machine; the machine fills the frame, so a trail keyed behind it would not
  show). The wind strokes and the 8,00–8,60 light sweep stay.
- **Push-ins**: M2 s 2,20→2,32 → 2,45→2,60, F (375 → 345, 520) (the machine's bottom, source y 573, stays above the band
  HAUT); M3a s 1,5 → 1,80, F (400 → 450, 575). (The review's « s 1,875 → 2,15 » quoted SERIE's value: M2 was already at 2,20.)
- **Blurs**: `v39_sign` feather 8 → 20, margin 10 → 6, σ 18 → 14, rounded corners (radius 14), grain put back inside the patch
  (deterministic, `prep_clips.py` `grain` / `radius`): a soft patch, no grey block; letters still unreadable at 1080. New
  `v39_plate` (the white car's front plate, r 2,90–3,70, 46 × 26, checked every 0,1 s), new `v40_shL / shM / shR` (the name
  arcing over the shoulders, r 1,43–4,05, tight: margin 3, feather 6, σ 10 — the face and the cap stay sharp).
- **End card** (film-4 values in the score's G; the shared module reads them): the whole block 80 px lower — panel 320–847,
  plate 880–1090, subtitle box / call pill 1120–1310 / 1120–1350, LÀ-BAS pill 344–404 — « VRAIES IMAGES » (236–270) clear of the
  panel. The panel's grade (BAKE.panel, film 4 only): black ,14, gamma 1,3 (new in `prep_clips.py`), contrast ,40, sat ×1,30,
  highlights −0,3 (new `hi`), sky ramp −0,5 EV over source y 25–130: the sign blue, « Bonzini Trading » dark on it, no milky top.
- **Collisions**: the plate's drop overshoots 8 px (backOut s 2,2 = 40 px hit the subtitle box at 17,93); the subtitle box
  leaves at 19,15 (+ ,12 fade = 19,27), before the pill pops at 19,30. Fixed the `a:` of the plate state (a stray comment).
Sound
- **S1** 2,40 → 2,32 (H ends 1,97 + ,35), the take S1_s65 re-stretched ×1,123 → ×1,163 (Rubber Band crisp, voice/tools/
  make_final.py, window 2,32–4,33): 1,98 s, 3,03 syl/s (energy 3,08). words.json: the by-eye alignment scaled ×1,046 (large-v3
  + align_tts misplaced « conteneur »). Backups: `../../f4fix/bak/` (takes, words, choice, lines.py, S1 before).
- **Bed ducks** (`music().bedDucks`, applied by `lib/mix.py` to ambience, SFX, music, pad and hits, 80-ms ramps): −12 dB over
  3,05–4,35 (« conteneur »: −6 and −9 were still lost) and −9 dB over 8,80–9,70 (« rue »: −6 passed on the mix, lost it on the WhatsApp AAC 128k; −9 and −12 over 9,10–9,70 pass the mix, AAC 192k and 128k round trips of main and wa). Tested one at a time in a sandbox
  (each bed muted alone did not save « conteneur »; the clean narrator scores 100 %).
- **The groove's return at 10,00**: its hit −8 dB (`hitDb`) and the section eased in over ,12 s (`fadeIn`): the music stem's
  loudest 100 ms there −9,6 → −19,5 dBFS.
- **Limiter ceiling −1,3 → −1,6 dBTP** (`music().ceiling`, read by `lib/mix.py`): the WhatsApp file's AAC 128k overshot to
  −0,9 dBTP; now −1,5 / −1,1 / −1,5 / −1,4 dBTP (share / WhatsApp, main / wa), −14,0 LUFS everywhere. That last change only
  touched the sound: the four mp4s got the new mix by `work/remux_audio.sh` (video stream copied bit for bit, AAC encoded
  exactly as `tools/mux.sh`: 192k / 128k, 48 kHz, -t T.end, +faststart; then mux.sh's listen test on each decoded AAC).
- **RV4 = film 1's treatment exactly** (presence +4,5 dB at 3,2 kHz, air −24, murmur −15 dB at source 18,80–19,19, gain only);
  film 4's own +2,5 dB lift removed.
QA
- `tools/qa.js`: **the director's waiver** (`SCORE.QA.rvWaiver`): a listen report that fails ONLY because RV4's brand words
  « Bonzini » / « Trading » are missed passes when the narrator is ≥ 90 %, every other real-voice word is heard and the RV4
  subtitle writes « Bonzini Trading »; each use is printed (an ok line with the evidence + a WARN « waiver USED »). Anything
  else missed is still an ERROR. Applied to the mix and to both mp4s' AAC.
Deliverables (13/10, 02:25): `out/MACHINE_share.mp4` 25,77 MiB · `out/MACHINE_whatsapp.mp4` 8,85 MiB · `out/MACHINE_WA_share.mp4`
25,78 MiB · `out/MACHINE_WA_whatsapp.mp4` 8,86 MiB — each 24,667 s, 740 frames, −14,0 LUFS. Weak listener (the gate) on the mix
and on the 4 AAC: narrator 35/35 = 100 % everywhere; real voice 3/5 (only « Bonzini » / « Trading » missed → the waiver).
Strong listener: narrator 100 %, real voice 60–80 % (« Trading », sometimes « Bonzini »). `node tools/qa.js` PASSED for main and
wa (`out/qa_MACHINE*.txt`, 6 warnings each: 3 waiver uses + 3 strong-listener notes). Sheets: `out/MACHINE*_sheet_360*.jpg`,
`out/MACHINE*_whatsapp_mp4sheet_360*.jpg`, `out/beats_grid_360*.jpg`, `out/hides_baked.jpg`, `out/MACHINE_audio_sheet.png`,
covers `out/MACHINE*_cover.jpg`. Frame folders deleted after muxing.
Not changed: the owner confirmations (SERIE §7) are the director's; the backpack youth (v38, frame 0 from behind) belongs on the
§7.3 / §7.4 list.

**Sync with prod_f1 review 2 (13/10, 00:25)** — shared files = prod_f1's latest (20_duplex, 05_footage, 50_compose, 60_type,
00_edl, engine, render, kit, prep_clips, build_hides, listen_test, mux.sh, narr_rate, frames_sheet, crop_sheet); `lib/mix.py` =
prod_f1's + the film-4 hooks (sfx_film4, groove: false, nappe, AMB_DUCK 13 / SFX_DUCK 5 / CARVE 6); `tools/qa.js` = prod_f1's +
`SCORE.QA.names` (out/MACHINE*, not LA-BAS_ICI) and the stamp list filtered. Score changes: S3 / S4 re-stretched ×1,14 / ×1,12
(rush2/voice, audible rate on the energy 3,16 syl/s; S4 window 10,15–12,90), RV4 = film 1's treatment (presence +4,5 dB at
3,2 kHz, bystander murmur −15 dB) + film 4's +2,5 dB, the panel graded like film 1 (BAKE.panel, baked), T.end snapped up on the
frame grid (24,667 s), the plate's parcel phased to land in Douala at the freeze. Frames 37–48, 131–136, 198–209, 300–311,
396–407, 459–470, 483–489, 526–539, 579–584 re-rendered at --mb 24 (no ghost copies on glides, stamp, filé, plate drop, pill pop).
`wa` = frames 0–578 hard-linked from main (byte-identical, checked) + 579–739 rendered with --variant wa.

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

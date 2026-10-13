# prod_f1 — film 1 « LÀ-BAS, ON CHARGE. ICI, ON REÇOIT. » (36,70 s) + film 2 « DÉPOSÉ. REÇU. » (variant `cut`, 19,233 s)
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
T.N5a/b and T.end along the chain written at the top of 01_score.js (film 1 = 36,70 s, film 2 = 19,233 s = 577 frames) and time the felt
underlines on « autre ». Real voice: `../voice/real_words.json` (stamps on the stressed syllable, MERCI 2 frames before
« merci », the Douala glide on « clients »); RV4 out 22,665 (a bystander's voice starts there).

## Review 2 (12–13/10/2026) — what changed, and why
Picture
- **G1 (hook / cover)** = v1 r 84,00 → 86,75: the red container on its truck, tracked along (was the static bars of r 75,40).
  The alternative r 72,4 (bars on the forks) was rejected: the driver's bare arm reaches x 200 > 188 on most frames. The
  chassis label (brand + phone) is blurred (`card_plate`, tight 52 × 42 box, r 85,40–87,05). +0,15 local contrast baked on
  v1 r 83,85–87,30 (`BAKE.gz1.zones`). **Card G** = r 86,55 → 87,15 slowed (×0,23, blend) then frozen on r 87,15 (the container
  leaving; no blur left on the freeze, so no smudge when the card flies back to the window).
- **G2** = the rows of wooden crates, v1 r 29,65 → 31,95 at ×0,69 (was a roll end that read as an eye; film 2 no longer cuts
  roll → roll at 6,10). r 28,8–29,5 (stencilled crate) and r 33–36 (cartons with labels and a blue logo) are not used.
- **Block D** (18,65–23,55): the band stays at BAS (no glide at 18,65 / 21,45); Douala leads (D4 v25 then D5 v17). G7 / G8 / G9
  (ballot and bags under blurred client names) are gone; the secondary G window shows the wall of rolls framed low (F.y 740,
  bottom rows + floor) — the SAME shot (`G10`, v1 r 22,00 → 27,85 at ×0,818) continues through the glide of 23,55 (F rises
  to 470 with the band) and freezes on DÉPOSÉ at r 27,85 (film 2: from 6,10 at r 26,01). MERCI sits on the ballot hooked to the
  crane in Douala (480, 1290), then rises INTO line 2 of the subtitle from below (x leads, y follows), lands 3 frames before
  the end and melts into « merci » in place.
- **LIU JO** (v17): re-tracked on the letters only (52–80 × 28–56 source px, margin 2, feather 4, σ 9): the porter's head and
  face stay sharp (checked on every 4th prepared frame, r 0,10–2,10). Hubs of v2: round masks (Ø 68) on the caps. Toyota (v7):
  the 40 × 28 ellipse, margin 2, feather 6. Per-hide `margin / feather / sigma` overrides (build_hides → prep_clips).
- **D3** F.y 760 → 690 (the plateau, the wheel and the legs fill the useful zone; the seated man in a bob is pushed to the
  bottom-right corner, under y 1600; F.y ≤ 640 would show the SUV's wheels and the « BOGARD 22 » print). **G6** F.y 520 (the
  headlight and the whole wheel at BAS), dimmed 20 % instead of 35 %. **D7** (v40) F.y 450 while the band is at HAUT (hook,
  machine top, hands, doorway), gliding to 600 with the band (REÇU still on the machine). **P1** (v38) from r 5,86: the
  bystander in red and white has left the left edge.
- **The real panel** (v3, PN only, `BAKE.panel`): black point +0,08, contrast +0,25, saturation ×1,1, −0,4 EV over the top
  40 % of the panel rectangle. Panel window y 240–767 (the logo pill no longer straddles its edge), plate y 800–1010 with a
  route row (dashed Chine → Douala, the kraft parcel travelling during the call, in a loop, landing on an orange ring),
  subtitle box / call pill y 1040–1270 (one block). « VRAIES IMAGES » on a night chip (60 %). Film 2's call line at 80 px.
Type and motion
- **Crisp pass** (engine.html `COMPOSE_CRISP`, 50_compose, 20_duplex `DX_draw(t, n, 'crisp')`): band phrases, karaoke, the
  subtitle box, the badges and the logo are drawn ONCE per frame at n / 30 over the motion-blur accumulation — no streaks in
  the glides — and never shaken by the stamps (they stay ≥ y 150; qa.js checks the shaken boxes through the push + shake).
  The band, its parcel, the windows and the stamps keep their blur. 16 sub-samples (instead of 6) on the card flights,
  MERCI's flight, the filé and the plate's drop (`SCORE.shutter`).
- Header « vraie voix · l'équipe Bonzini à Guangzhou »: Satoshi 700 36 px, white 85 %. DÉPOSÉ: a night pool (45 %, r 380 ×
  scale) under the stamp, clipped to the G window. DÉPOSÉ and the LÀ-BAS badge leave 2 frames BEFORE the fold; RV3's subtitle
  ends at A.F − ,12 (it no longer slides over the footage with the leaving band); the ICI badge leaves when the filé starts,
  the LÀ-BAS badge of the panel enters at 30,85. Band phrases fade out before the cut (bandA 6,00, bandC 18,53).
- Map: parcels 44 × 34 (night outline 3 px, white tape highlight, shadow), route 10 px, a 64-px orange ring on each arrival;
  departures 6,62 · 7,05 · 7,80 · 8,60 · 9,50 · 10,20 → 2 or 3 parcels on the way at every instant 7,40–10,40.
Sound
- Narrator re-stretched (Rubber Band crisp, voice/tools/make_final.py): N3a ×1,21 (window 6,75–8,50), N2 ×1,17, N4 ×1,16 —
  every line ≤ 3,2 syl/s also on the ENERGY (span within −30 dB of the line's peak, `tools/narr_rate.py`, checked by qa.js:
  ERROR > 3,30, WARN > 3,20). N3b at 8,85. The parcels' ticks / pings never land on a narrator word.
- Real voice, gain only (sample count and lag 0 still checked): RV4 presence +4,5 dB at 3,2 kHz; the bystander's murmur
  before « Voilà » (source 18,80–19,19) at −15 dB; RV1A's click at source 9,058: 0 gain over the silence, 3-ms raised-cosine
  fade-in. (RV4's air at −34 was tried with the presence lift: it LOST « Bonzini » on the weak listener; kept at −24.)
- T.end snapped UP on the frame grid (film 2: 19,233 s = 577 frames; AAC and video end together, last 0,30 s ambience only).
Listen test (`tools/listen_test.py`) and QA
- Words are matched to the whole script IN ORDER, a matched word counting for its line within 1,5 s before / 1,0 s after it
  (whisper stamps words up to 1 s off across pauses: « Un » of « Un conteneur » was stamped 5,46–6,18). Two printed sound
  normalisations: « part » = « par » [paʁ], an elided letter split off a reference word joined back (« D'Ouala » = Douala).
  « Freddy » for « Trading » stays a MISS: the speaker says « Trèding » and no version (dry stem, mix, AAC) is heard as the
  brand by the weak listener — film 2's real voice therefore sits at 9/10 = 90,0 % (the gate), « Bonzini » heard.
- `tools/mux.sh` decodes the AAC of each mp4 and runs the listen test on it (`listen_report_share.json`,
  `listen_report_whatsapp.json`); qa.js requires them (newer than the mp4, the mp4 newer than the mix) and passes on the worst.
  `node tools/qa.js --pre-mux` = the gate before muxing.
- Encodes: BT.709 limited range, tagged; share file High@L4.1 with VBV (maxrate 16 Mb/s), WhatsApp file High@L3.1.
- Strong listener (large-v3) reports (`listen_report_large-v3[_share|_whatsapp].json`) are listed by qa.js, and WARN under
  90 %: film 2 is at 8/10 = 80 % on the mix and on both AACs (« bon zuni Freddy »): the brand words of RV4 are capped by the
  source (SERIE §7.5) — no waiver is assumed, it is the owner's call (keep RV4 as is, or a different take of the brand line).
Results (13/10/2026): film 1 36,700 s / 1101 frames, share 26,1 MiB, WhatsApp 13,3 MiB; film 2 19,233 s / 577 frames, share
25,7 MiB, WhatsApp 7,1 MiB; −14,02 / −14,01 LUFS, TP −1,30 dBTP (mp4: −14,0 LUFS, ≈ −1,2 dBTP after AAC). Weak listener
(gate) on mix / share / WhatsApp: film 1 narrator 100 / 96,6 / 100 %, real voice 90,6 % each; film 2 narrator 100 %, real
voice 90,0 % each. Large-v3: film 1 real voice 93,8 / 93,8 / 90,6 %, film 2 80 %. qa.js PASSED (film 1: 0 warning; film 2:
the 3 large-v3 warnings above).

## Deliverables (12/10/2026) — the whole chain, per film (film 2: prefix BZ_VARIANT=cut, `--variant cut`, audio_cut/)
```
cd overlay && nice -n 5 node render.mjs --pages 3 --mb 6 --out ../out/frames_f1 --jpg      # 1101 frames, ≈ 150 ms/f
nice -n 5 python3 lib/mix.py --stems                       # audio/mix.wav (+ stems) — real voice, narrator, air, ambience, makossa, SFX
python3 tools/listen_test.py [audio_cut] [--band 300,3400] [--model small|large-v3]   # phone band, weak listener, ≥ 90 % each
python3 tools/narr_rate.py [--variant cut]                # data/narr_rate(_cut).json: the narrator's rate on the energy
node tools/qa.js --pre-mux                                 # PASS: picture, stickers, blurs, type, shake, narrator, mix, listen test
tools/mux.sh LA-BAS_ICI out/frames_f1                      # out/LA-BAS_ICI_share.mp4 + _whatsapp.mp4 (BZ_VARIANT=cut → DEPOSE_RECU) + listen tests on their AAC
node tools/qa.js                                           # the full gate (the delivered files included)
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

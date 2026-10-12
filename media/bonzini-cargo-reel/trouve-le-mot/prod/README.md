# « TROUVE LE MOT. » — Bonsoir, bonsoir · production folder (engine skeleton, score, rush, type)

Spec: `rush1/STORYBOARD.md` (§2 table, §5.4 time map, §5.5 anchors, §5.6 sound, §5.7 checks) and `rush1/BRIEF.md`.
1080 × 1920, 30 fps, **752 frames = 25.05 s on the defaults** (recomputed from the real takes, see « Timing »).
Module contract for M1 (chrono, ring) and M2 (Bonzini card): **`MODULES.md`**.

## Render
```
cd P/overlay
nice -n 5 node render.mjs --times 0,0.9,4,7.3,8.6,9.2,11,14.6,18.5,21,23.5 --pages 2 --mb 4 --out ../out/check --jpg   # stills
nice -n 5 node render.mjs --out ../out/final --pages 3 --mb 6 --jpg            # the film (lead): frames 0 … SCORE.N − 1 (743 now; never a literal end frame)
node ../tools/check_score.js     # anchors, contract warnings, safe-zone audit, real-voice placements, music plan, cues
```
- Frames default to `0 … SCORE.N − 1`; `render.mjs` rewrites `data/timeline_main.json` (`{frames: N}`) at each run.
- `--times` / `--frames` / `[start end]`, `--mb N` motion blur (sub-samples never straddle a hard cut: `SCORE.shutter`),
  `--pages`, `--jpg`, `--scenes 05_rush,60_type` (loads 0x/1x, the gecko shims, 50_compose + the listed files),
  `--src DIR` (source PNG fallback folder, default `rush1/src_frames`).
- Measured: ≈ 0.3 s/frame at `--mb 4` on 2 pages (stills); the zoom and whip frames cost the most.

## Files
| file | role |
|---|---|
| `overlay/engine.html` | the series engine (ep2) adapted: black clear, motion blur via `window.subTimes(n)` = `SCORE.shutter(n, MB)`, film grain `RU_grain(n)` once per frame over everything, **rush frame cache**: `window.PRELOAD(times)` decodes the frames `SCORE.rushNeed(t)` names into an LRU (24 frames) and `window.rushImg(f)` returns them synchronously; `window.loadZoom()` decodes the HD zoom layer once |
| `overlay/render.mjs` | deterministic Chromium renderer. Serves the folder on a private origin `http://bz.local/` (Playwright routes → no tainted canvas). `/assets/rush/f_NNNN.jpg` falls back to `rush1/src_frames/NNNN.png` (scaled ×2.3276, y − 8 by 05_rush) while the prepared frame is missing, empty or younger than 3 s (being written). Injects `window.TIMING` (data/timing.json), `window.LABEL_TRACK` (data/label_track.json), `window.ZOOM = {url, geo}` (assets/zoom/r100_x4.png + .json) **before** the scene scripts. Before every frame: `await PRELOAD(SCORE.shutter(n, MB))`, then `renderFrame(n)`. Prints decodes / cache misses (must be 0) |
| `overlay/kit.js` | series kit (unchanged ep2 copy, with the `rrect` clamp) |
| `overlay/scenes/01_score.js` | **THE SCORE** (picture + sound). See below |
| `overlay/scenes/02_light.js` | `softPath`, `lit`… (ep2 copy; the margouillat needs it) |
| `overlay/scenes/05_rush.js` | `RU_rush(t, n)`: the footage (camera, smear, freeze + shake, zoom layer crossfade ×1.4 → ×1.6, STOP darkening 25 %, vignette, top shade, the brown bag kept in the shadow during the zoom, privacy mosaic fallback) · `RU_grain(n)` |
| `overlay/scenes/39_gecko_shim.js`, `40_gecko.js`, `41_gecko_unshim.js` | the validated margouillat (ep2 copy, unchanged) bound to `SCORE.geckoShim()` — for the card only |
| `overlay/scenes/50_compose.js` | draw order + stand-ins: rush → `RG_ring` → `BZ_card` → `TY_draw` → `CH_chrono` |
| `overlay/scenes/60_type.js` | every on-screen text not owned by a module: mention, title plate, « vraie voix » subtitles (+ live waveform while the real voice speaks), STOP stamp, « TU L'AS VU ? », answer block, « écrit à la main », CTA pill with drawn arrow · `TY_wordBox('BONZINI' | 'TITLE_BONZINI')` |
| `tools/check_score.js` | prints / audits the score (node) |
| `data/label_track.json` | copy of `rush1/work/label_track.json` (source px, ok = cc ≥ .8) |
| `assets/fonts/`, `assets/logo.svg` | every series font (v3), the logo |
| `assets/rush/f_0000…0298.jpg`, `assets/zoom/r100_x4.{png,json}` | made by the frames agent (`tools/prep_frames.py`) |

## The score (`01_score.js`) — `window.SCORE` / `module.exports`
IIFE scope; everything a pure function of t; deterministic; no `ctx.filter`, no `Math.random`.
`node -e "const S=require('./overlay/scenes/01_score.js'); console.log(S.T, S.A, S.music(), S.soundCues())"`

**Timing contract of this film.** `data/timing.json` = `{dur: {N1…N6: s}, words: {N1: [{w, s, e}], …}}` (word times
relative to the line's speech start; `tools/make_timing.py`). The score computes **every start** itself:

| key | formula (§5.5) | default |
|---|---|---|
| `T.R1` | real voice clip from r 0.00 | 0.00 |
| `A.musicIn` | `TICK(2)` — the makossa drops on a downbeat | 2.00 |
| `T.N1` | `A.musicIn + .15` (fixed) | 2.15 |
| `A.pan1 / pan1e / pan2 / pan2e` | rush pans played ×2 (from the footage: 2.90–3.40, 4.90–5.60) | 2.90 / 3.15 / 4.65 / 5.00 |
| `T.N2` = `A.hint` | 4.55, moved earlier if the take would end after 6.85 (never onto N1; else WARN) | 4.55 |
| `A.stop` | `TICK(7)` (a real 7-s hunt) | 7.00 |
| `T.N3` | `A.stop + .10` | 7.10 |
| `A.rew` · `A.splice` · `A.zoom` | `END(N3)` · `+ .25` · `+ .50` | 8.35 · 8.60 · 8.85 |
| `A.ring` (balafon, ellipse) | `A.zoom + .60` | 9.45 |
| `T.N4` · `A.answer` · `A.hand` | `A.ring + .20` · `+ .15` · `+ .45` | 9.65 · 9.60 · 9.90 |
| `A.arrow` · `A.pulse` | `W('N4','bonz')` · `W('N4','debut')` (fallbacks 2/12, 10/12 syllables) | 10.27 · 12.73 |
| `A.out` · `A.whip` · `A.live` | `END(N4) + .20` · `+ .15` · `+ .25` | 13.55 · 13.70 · 13.80 |
| `T.R2` | `A.live + .08` (source r 7.70 on its own pictures) | 13.88 |
| `A.card` · `A.plate` · `T.N5` | `A.live + 2.00` · `+ .15` · `+ .30` | 15.80 · 15.95 · 16.10 |
| `A.route` · `A.by` | `T.N5 + .35` · `T.N5 + 1.40` | 16.45 · 17.50 |
| `A.chine` · `A.doua` | `W('N5','chin')` · `W('N5','doua')` (10/14, 12/14) | 19.03 · 19.61 |
| `A.cta` = `T.R1b` | `END(N5) + .40` (source r 0.55 on its own pictures) | 20.60 |
| `A.pill` · `T.N6` · `A.ctaFreeze` | `A.cta + 1.25` · `A.pill + .15` · `A.cta + 1.45` | 21.85 · 22.00 · 22.05 |
| `T.end` | `END(N6) + .30` | 25.05 |

`DUR` defaults = the §5.5 default column (N1 1.67, N2 2.22, N3 1.25, N4 3.70, N5 4.10, N6 2.75 — they reproduce its
times exactly; the §3.1 budgets are looser). `SCORE.check()` warns on: N2 ending after 6.85, N1 too close to N2, R2 / R1b
lip sync, any reversed r in 2.9–5.6, r going backwards outside the rewind, overlapping voices.

**Exports.** `FPS N T DUR DUR0 A W WE END SYL RUSH REAL G COL BPM BEAT SEC TICK` ·
`r(t)` film → rush seconds (§5.4) · `frameOf(t)` · `rushNeed(t)` · `rushHidden(t)` · `shutter(n, mb)` · `CUTS()` ·
`cam(t)` = `{s, fx, fy, qx, qy, sx, sy}` (screen = s·(P − F) + Q + shake, P in frame px) · `toScreen(c, x, y)` ·
`label(t)` (white card on screen, camera included) · `labelFrame(f)` · `smear(t)` · `zoomLayer(t)` ·
`chrono(t)` · `ring(t)` · `card(t)` · `gecko(t)` · `light(t)` · `geckoShim()` · `TEXTS()` · `soundCues()` · `music()` ·
`check()` · easing helpers.

**Time map r(t)** (frame = round(r·30), 0…298): [0, 2.90) r = t · ×2 to 3.40 · walk 3.40→4.90 · ×2 to 5.60 · 5.60→7.60 ·
freeze 7.60 (STOP) · rewind 7.60→5.70 (accelerating, .25 s) | splice | 2.80→1.00 (landing, .25 s) · freeze 1.00 (push
×1→×4, hold ×4→×4.12, dezoom, first half of the whip) · 7.62 (whip lands) · 7.62→9.62 (live) · 9.62 under the kraft ·
0.55→2.00 (R1b) · freeze 2.00. The rewind never selects r in (2.80, 5.70) (checked at 240 Hz).

**Camera.** STOP: ×1.03 punch-in, 10 px damped shake (6 frames). Zoom: one continuous push, scale `4^ease(k)`, the white
card's screen point follows the log of the scale from its ×1 place (422, 1189) to (540, 1020) → ≈ 456 × 219 px at ×4;
then ×4.00 → ×4.12; dezoom in .15 s. Live: ×1.10 pushing gently to ×1.16 (the extra crop keeps the card in range),
framing from the Gaussian-smoothed track (σ 7 frames) aiming the card at x 730, clamped so no frame edge ever shows → the
card's centre stays in x 702–857 (box right edge ≤ 923). End: freeze r 2.00, ×1.00 → ×1.04 centred on the card.

**Label.** `label_track.json` boxes are the matching template (53 × 25 source px); the score converts them to the
**white card** (+6, +.5, 49 × 23.5 — read from `assets/zoom/r100_x4.json` « label », same defaults built in), frame =
source × 2.3276, y − 8; `ok = false` frames are interpolated; `vis` = within 6 frames of a tracked one.

**Sound.** `soundCues()` → `[{t, name, g, pan, d?, note?}]`: `tic_wood` 0…6 s (5, 6 louder) · `shaker_rise` 1.75 ·
`whoosh` 2.90, 4.65 · `stamp_big` + `buzzer_soft` A.stop · `rewind` (synthetic, never the rush) A.rew .5 s ·
`swell_rise` A.zoom → A.ring · `focus_click` A.ring − .02 · `bonzini_sig` A.ring · `felt` A.ring (.4), A.arrow (.35),
A.route (.5) · `whoosh_back` A.out · `paper_lift` A.card · `tonk` A.plate · `pop` + `felt` A.chine, A.doua · `pill_drop`
A.pill. `music()` → `{bpm 120, beat .5, grid0 2.00 (a downbeat), ticks [0…6] (= beats 1 and 3: the chrono seconds ARE
the grid), silentUntil 2.00, tenseFrom 2.00, cut A.stop, sigAt A.ring, majorFrom A.plate, motifAt A.cta − .45, end A.cta,
voiceEndN5, noMusic [[R2], [A.cta, end]], duck {narrator 12}, streetOnlyFrom end − .30}`. `REAL` → R1 / R2 / R1b:
`{t (film start), src [in, out] rush s, fadeIn, fadeOut, speech [film], end, text}` (§5.6 spans and fades).

## Checks done (out/check_skel_360.jpg = 20 stills at 360 px, --mb 4, on the defaults, prepared frames + zoom layer)
Cover frame 0 (title plate + chrono « 7 » + mention, no motion-blur fade on frame 0); R1 subtitle; the pan smear; the
hint line; STOP (stamp, punch-in, shake, darkening, title blown away upward); rewind + peel + rolling digit; the
2-frame splice; the push (crossfade to the zoom layer, BONZINI readable on the real pixels at 360 px, mosaic under it);
the answer block + ellipse + arrow + « écrit à la main »; the whip; R2 subtitle with the following ellipse; the card
stand-in with the margouillat; R1b + recall ellipse; the CTA pill. `check_score.js`: contract OK, safe zones OK.

## Known limits
- The chrono, ring and card on screen are **stand-ins** until M1 (`20_chrono.js`, `30_ring.js`) and M2 (`72_card.js`)
  land; the arrow stand-in's route is a suggestion.
- Fast zoom frames (9.05–9.2) at `--mb 4` show discrete ghost copies; use `--mb 6` for the film.
- Live framing: the storyboard's « ×1.10 » becomes ×1.10 → ×1.16 (at a fixed ×1.10 the card's centre would reach x 870
  near r 9.3); now centre ≤ 857, box ≤ 923 (the safe-zone rule is about text: fine).
- Hard cuts are clean on frame boundaries only for `SCORE.CUTS()` (STOP, splice, whip switch, card → rush); add any new
  hard cut there.
- `soundCues()` names follow the storyboard (`tic_wood`, `buzzer_soft`, `rewind`, `swell_rise`, `focus_click`,
  `whoosh_back`, `tonk`, `pop` are new to the series' SFX library: the sound engine maps them).
- Without `assets/zoom/r100_x4.png` the zoom falls back to the full frame upscaled + an engine mosaic from ×1.8.
- The brown bag at r 2.00 / r 7.60 is darkened in the prepared frames (frames agent); during the zoom 05_rush adds a
  left-side shade that stops 30 px before the card.

## Integration on the real voices (12/10, integration pass)
**Film: T.end 24.433 s = 733 frames** (`data/timeline_main.json` is rewritten by `render.mjs`).
Takes (`data/takes.json`, after `serie/tighten.py` + `serie/select_takes.py`): N1 `N1_s3` · N2 `N2_s2` · N3 `N3_s1` ·
N4 `N4_s3` · **N5 `N5_s4`** (a slow-config take, `--run 2 --voices voice_cfg_slow.json`; chosen by hand over the
script's `N5_s5` because it is the only take whose « Bonzini » the weak ASR hears right in both conditions) · N6 `N6_s1` ·
N6w `N6w_s2`. `data/timing.json` = `tools/make_timing.py` on those takes.
```
node tools/qa.js                 # every storyboard constraint on the real timing (exit 1 on error) — see its header
node tools/listen_prep.js        # check/listen/data/{timing,script}.json (listen_test needs the starts; --real adds R1/R2/R1b)
cd ../../serie && python3 listen_test.py ../rush1/prod/check/listen ../rush1/prod/audio/mix.wav   # narrator ≥ 90 %
```
Changes made in this pass:
- `01_score.js`: `check()` no longer flags the first sample of the rewind as « r goes backwards outside the rewind »
  (false positive when A.rew falls between two 1/240 samples); `A.sub2out = max(A.card + .08, R2 speech end + .10)`
  (the R2 subtitle was still crossing the falling plate, M2's note).
- `05_rush.js` + `engine.html` + `render.mjs`: the frames agent's bag shades are now drawn — `shade_bag_f0228.png` on the
  STOP freeze (r 7.60, ramp .2 s), `shade_bag_f0060.png` on the end freeze (r 2.00, ramp .2 s). They were unused.
- `tools/prep_frames.py`: two new baked blurs, `BN` (the red banner with white Chinese characters, frames 185–298,
  colour-tracked; it names a Guangdong programme, maybe the city) and `WS` (the small white sign with Latin letters in
  the window, frames 267–298, template-tracked). Frames 185–298 re-run (`--only frames --frames 185-298`).
- New: `tools/qa.js`, `tools/listen_prep.js`; check sheet `out/check_integ_360.jpg` (26 stills, `--mb 4`).

## Validations du patron (12/10/2026)
- La vraie voix dit bien « Merci de faire confiance à Bonzini Trading » : sous-titre confirmé.
- Celui qui filme et l'employé en polo rouge sont d'accord pour apparaître dans la vidéo publiée.

## Review pass (12/10, adversarial review) — **film now 24.769 s = 743 frames**
- **N5 slowed ×1.10** (`data/takes.json` « stretch »: 1.1 → Rubber Band in `R.voice_line`, pitch + formants kept; the
  narrator only, never the real voice): 14 syl / 3.69 s = **3.79 syl/s** (was 4.17, above DICTION 6's 3.5–3.8). The card
  now lasts 4.39 s (was 4.06). `tools/make_timing.py` scales `dur` / `words` by the stretch, `lib/audio_rush.py` places the
  take with it (`at = T − on × stretch`, word margins too). Remove the field to go back (then make_timing + audio_rush).
- **WhatsApp variant made coherent** (STORYBOARD §6): `BZ_VARIANT=wa` (node) / `window.VARIANT = 'wa'` (page) → the score
  times N6 on N6w and the pill says « Réponds-lui en message : ». `render.mjs --n6w` (→ `out/frames_wa`,
  `data/timeline_wa.json`), `lib/audio_rush.py --n6w` (→ `audio_wa/`, `out/chk_audio_sheet_wa.jpg`),
  `BZ_VARIANT=wa node tools/qa.js`, `BZ_VARIANT=wa node tools/listen_prep.js` (→ `check/listen_wa`). Variant: 24.488 s,
  735 frames, listen test 37/37. Before: `--n6w` swapped the voice only (pill still « en commentaire », T.end on N6).
- `render.mjs`: a number right after `--jpg` / `--n6w` is a frame again (it was swallowed as the flag's value); frames
  ≥ N are dropped with a WARNING — the README's old `render.mjs 0 751` would have rendered 9 frames past T.end (19 at 733).
- `tools/qa.js`: a mix built on another timing is now an **ERROR** (compares `audio/score_cues.json` to the live score;
  the length check is an error too); narrator rate warns above 3.85 syl/s as played (was 4.3); variant-aware.
- Check sheets on the new timing: `out/check_review_360.jpg`, `out/check_review_360_dim50.jpg` (25 stills, `--mb 4`).

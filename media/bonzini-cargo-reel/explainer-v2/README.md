# « Le parcours de vos colis » — V2 (2 min 10) · Bonzini Trading Cargo

Remake of the explainer `../explainer/` at the owner's request: « refais la vidéo avec la voix femme habituelle, améliore
toute la partie motion design et video FX, style contenu éducatif comme on fait souvent ». Same story and facts, new
everything else: the series voice, the house educational style « Kraft & Fil » (cream packing table seen from above,
cut-paper stop-motion, torn-paper captions, violet thread), and the real phone footage turned into playing photo prints.

## Story — « le colis héros »
One kraft carton with the label « VOTRE COLIS · DE : CHINE · À : VOUS » and the only violet tape of the film is followed
through the 6 steps: hook → brand → 01 L'achat (China stall, goods packed, EMBALLÉ) → 02 Le groupage (Client A / Client B /
Vous in one shared container) → 03 Le transport (paper boat on the sea, paper map China → Africa, paper truck) →
04 L'arrivée (the paper truck parks on a blank instant print that develops into the REAL container; the team speaks on
site) → 05 Le déchargement (paper warehouse flips into the real one, real cartons get the violet tape, polaroid row,
EN SÉCURITÉ) → 06 Le retrait (paper client at the Bonzini counter, the real door, « FOYER BALENGOU » tag) → recap
(the six tags fall into a laced list, EN TOUTE SÉCURITÉ) → outro (the team's real « merci » over its own footage, end card).
Full spec: `SPEC_V2.md`; storyboard (3 proposals judged and merged): `final_storyboard.md`; engine API: `SCENE_GUIDE.md`.

## Footage VFX
- `lib/cleanplate.py` removes the carrier lettering and logo painted on the blue container, frame by frame (light pixels
  enclosed by container blue → vertical normalized-convolution fill that keeps the corrugation). No carrier name is ever
  visible. Third-party logos / people are avoided by source range (`FORBID` + `AVOID` in `overlay/scenes/05_video.js`,
  render logs an error if a scene uses one).
- `lib/prep_footage.py` → clean plate + Real-ESRGAN general-x4v3 (×4) → 1080×1920 JPG, even source frames only: prints
  play « on twos », like the stop-motion (and it halves the upscale time). `lib/prep_lowres.py` = 360p fallback.
- `overlay/scenes/05_video.js` + `13_prints.js`: video prints, develop, flash, freeze, speed ramps (`hp_map`), smooth slow
  motion (`vidBlend`), container sticker cut-out with paper rim, polygon cut-outs, push-in / dive, corner peel.
- The real team member's voice (Q1–Q6, denoised v1 stems) drives the badge waveform (`lib/q_rms.py` → `15_qrms.js`).

## Pipeline
1. Voice: `lib/tts_kyutai.py` (Kyutai TTS 1.6B, CC-BY 4.0, voice `unmute-prod-website/developpeuse-3`, CC0) with
   `SCRIPT=data/tts_vo.json`; `lib/check_vo.py` (faster-whisper check); `lib/build_timeline.py` → `data/timeline.json`
   (120 BPM grid, words) + `audio/voice_vo.wav`, `voice_sp.wav`.
2. Footage: `lib/prep_lowres.py`, `lib/prep_footage.py` (needs the stabilised clips `work/{A,B,B2}_stab.mkv` and the
   ESRGAN model, see `../prep/`).
3. Picture: `cd overlay && node render.mjs 0 3899 --out ../out/final --pages 2 --mb 5 --jpg --dump-cues ../out/cues.json`
   (`--no-shot` runs the scenes without screenshots: console checks + cues in ~5 min).
4. Sound: `lib/music.py` (makossa-flavoured 120 BPM bed in A major, thin under the team quotes) → `lib/sfx.py
   out/cues.json` (216 paper foley cues logged by the scenes with `hp_sfx`) → `lib/mix.py` → `out/final_mix.wav`
   (−14 LUFS, voice ≥ 12.5 LU over the bed, team quotes ≥ 14.5 LU).
5. Encode: H.264 1080×1920 + AAC; share version ≤ 27.5 MiB.
Fonts (`assets/fonts`, not committed): Big Shoulders Stencil, Bricolage Grotesque, Martian Mono, Shantell Sans,
DM Sans (OFL) — same as the other Kraft & Fil episodes.

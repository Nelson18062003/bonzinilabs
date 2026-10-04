# Série « JE SAVAIS PAS. » — how an episode is built (contract for the episode producers)

Scratch root `SP = /tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad`. Repo `R = /home/user/bonzinilabs`.
Episode folder `E = SP/serie/epN` (already contains `data/script.json` = the exact voice lines and their ids, `lib/`,
`audio/vo/` where the lead generates the takes). The full storyboard is `SP/serie/SERIE.md` (your episode's section,
plus « Ce qui revient dans chaque épisode » and « Règles de fabrication communes »). Brief: `SP/serie/BRIEF.md`.

## The reference pipeline: « PAS REÇU. » (read it, copy its patterns)
`SP/v3/` (scratch, complete) = `R/media/bonzini-cargo-reel/pas-recu/` (repo). Key files:
- `overlay/render.mjs` — Chromium deterministic renderer with `--mb N` motion blur and **TIMING injection**
  (`data/timing.json` → `window.TIMING` before the scene scripts load). Copy it as is.
- `overlay/scenes/01_score.js` — the score, wrapped in its own IIFE scope (kit.js already declares `FPS`, `W`, `H`, `C`,
  `G`?… — never declare top-level names that could collide), exported as `window.SCORE` and `module.exports` (node).
- `overlay/scenes/60_type.js` (pills « TOI », stamps, bands, end card, CTA pill with drawn arrow), `40_gecko.js`
  (margouillat, `K_gecko(t, L, g)`, `K_mouth(t)`), `32_letters.js`, `30_plates.js`, `36_receipt.js`, `10_table.js`, `02_light.js`.
- Kraft & Fil episodes (paper table seen from above): `R/media/bonzini-cargo-reel/prix-de-revient/` (money props:
  `overlay/scenes/00_money.js` banknote, scissors, calculator, shoeBox, sneaker, priceTag, handArrow, notebook…; scenes
  `20_billet.js`, `30_costs.js` (the AIR cloud), `40_twist.js` (two left feet), `65_bonzini.js` (scanner, scale, tape
  measure), `70_outro.js`, `90_captions.js`), `R/media/bonzini-cargo-reel/explainer-v2/` (Kraft & Fil kit, paper props),
  `R/media/bonzini-cargo-reel/fret/` (scan + shipping label). The scratch copies with rendered assets/fonts are under
  `SP/prix`, `SP/expl2`, `SP/fret` if you need them. Fonts for every engine: copy `SP/v3/assets/fonts/` (all families) and
  merge the episode engine's `@font-face` list so every family you use is declared and pre-loaded in render.mjs.

## THE CONTRACT (so the lead can re-time everything on the real voices)
1. **Voice keys.** `T[id]` = the START time (seconds) of the SPEECH of voice line `id` (ids exactly as in `data/script.json`).
   Defaults = the storyboard's times. `T.end` = film duration. The lead will overwrite them from `data/timing.json`.
2. **Word anchors.** `TIMING.words[id]` = `[{w, s, e}]`, word times RELATIVE to that line's speech start. Provide in the score
   `W(id, prefix, nth = 0, fallback)` → absolute time of the nth word starting with `prefix` (accent/case-insensitive),
   else `T[id] + fallback`. Use it for every « on the word » action (a cut on « Tchac », a stamp on « place »…).
3. **Every other time is DERIVED** from `T` and `W` in code (`const A = { cut1: T.N1 + .85, … }` computed after the TIMING
   merge) — no free-floating literal action time. Silent passages (no voice) are expressed as offsets from the previous
   line's end: `T.N3 + DUR.N3 + .2` where `DUR[id]` = speech duration (`TIMING.dur[id]`, default = your storyboard estimate).
4. **N and DUR** come from `T.end` (`const N = Math.round(T.end * 30)`); `data/timeline_main.json` gets `frames: N`.
5. **Sound cues**: `SCORE.soundCues()` → `[{t, name, g, pan}]` for every SFX (names as in the storyboard's sound column),
   plus `SCORE.music()` → the music plan `{silentUntil, tenseFrom, cut, majorFrom, sigAt, end}` from the same anchors.
6. **Never two people talking at once** (the lead guarantees it for the voice keys; your derived actions must not need it).
7. All state = pure functions of t (seconds; motion blur samples sub-frames). Deterministic (`rnd(i)`, never `Math.random`/
   `Date`). Never `ctx.filter` (25 ms per call here) — use `softPath` (02_light.js) or `shadowBlur`.

## Quality bar (non-negotiable)
- **One view, no sound**: every key sentence is written big (≥ 44 px body, ≥ 96 px titles, ≥ 120 px figures), held ≥ 1.4 s,
  ≤ 3 text blocks at once (+ the legal/example mention). The storyboard's « PHRASE-test » must be obviously true on screen.
- Safe zones: nothing at y < 150; nothing important at y > 1540; no text at x > 960 for y 900–1560.
- Series identity: chip « JE SAVAIS PAS. · n/5 » (top-left, y ≥ 150), TOI amber pill, the margouillat, violet ONLY with
  Bonzini, end ritual stamp « MAINTENANT, TU SAIS. » + CTA pill « Écris [MOT] en commentaire ↓ ».
- Facts: only the episode's « Faits utilisés » table; every figure on screen also carries « EXEMPLE FICTIF » / « exemple »
  where the storyboard says so. Rules of `SP/serie/BRIEF.md` (vocabulary, no customs officer, no third-party brand…).
- Premium, tactile, cinematic; readable on a phone at 50 % brightness. Look at your renders (full size + crops + a 360 px
  wide downscale) and iterate.

## Deliverable
`E/overlay/` renders the whole film with `cd E/overlay && nice -n 5 node render.mjs 0 <N-1> --out ../out/final --pages 3 --mb 6 --jpg`
(do NOT run the full render yourself — the lead does it after re-timing; render only check stills: `--times a,b,c --pages 2`).
`E/README.md`: files, API, T/W anchors you used, known limits. Keep one check sheet in `E/out/`. CPU is shared (4 cores,
other jobs running): `nice -n 5`, `--pages 2` max.

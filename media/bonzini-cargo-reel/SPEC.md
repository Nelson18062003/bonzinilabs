# BONZINI TRADING CARGO — "ARRIVAL PROTOCOL" futuristic reel

Root of this project: `R = <scratchpad>/reel` (this file lives at `R/SPEC.md`).
Scratchpad root `S = R/..`. Everything is built offline with ffmpeg 6.1 (full build: freetype, libass,
rubberband, vidstab), Python 3.11 (numpy, scipy, soundfile, opencv-python-headless, pillow, torch-cpu,
DeepFilterNet), Node 22 + Playwright (`/opt/node22/lib/node_modules/playwright/index.mjs`, Chromium
preinstalled — do NOT run `playwright install`). 4 CPU cores shared with a long-running Real-ESRGAN
upscale job — keep your own jobs lean (use `nice -n 5`, ≤2 threads where you can).

## 1. What the footage is

Two vertical phone clips (360x640, French voice-over by the camera operator, who is never on screen —
so picture/voice sync is NOT lip-critical).

* **Clip B – "Arrival"** (street, heavy truck/street noise): a red truck tractor, a man in a
  "BOGARD 22" jersey, then a long teal MAERSK container on a 3-axle trailer rolling past, a whip
  pan (src 12–13 s) to a MAERSK close-up, the warehouse doorway.
* **Clip A – "Warehouse"** (indoor, quiet, slight reverb): white SUVs/cars parked inside, yellow
  sacks, cartons with Chinese labels, walls of blue/white packed goods, a wooden crate.

Voice (corrected transcript, used for captions — see `data/captions.json`):
* B: "Voilà, chers clients de Bonzini Trading Cargo. Voici votre conteneur qui arrive dans notre
  entrepôt en toute sécurité. Il sera déchargé ici, dans notre entrepôt en toute sécurité."
* A: "Voilà, très chers clients, nous sommes ici à l'entrepôt de Bonzini Trading Cargo. Vos colis ont
  été déchargés en toute sécurité. Et nous vous attendons dans notre entrepôt ici [district], au
  niveau du foyer Balengou, pour le retrait de vos colis. Et nous vous disons merci pour votre
  confiance."
* The district name is NOT verifiable from audio → `data/config.json.district` ("" = omit it).
  Never print a guessed neighbourhood name anywhere. "Foyer Balengou" is fine.
* Brand as spoken: **BONZINI TRADING CARGO**. Never write "MAERSK" in our graphics (third-party
  brand; it is visible in the footage, that's fine). Never write "transfert d'argent" / "envoyer de
  l'argent". Do not invent facts (no fake GPS coordinates, container numbers, dates, prices,
  tracking numbers presented as real). Decorative UI text must be obviously generic
  ("CAM-01", "LIVE", "SCAN", "SYNC OK", "STATUT : ARRIVÉ").
* Language on screen: French. Correct accents (É, À, Ç…).

## 2. Final timeline (single source of truth)

1080x1920, **30 fps**, **45.0 s = 1350 frames** (frame n shows time t = n/30).
Music tempo **120 BPM** → beat = 0.5 s, bar = 2.0 s. Bar k starts at t = 2(k-1).

| out time | picture | voice | notes |
|---|---|---|---|
| 0.00–0.60 | B from src 0 | B | **BOOT**: scan-line reveal, HUD draws in. Impact at 0.00 |
| 0.20–3.40 | B | "Voilà, chers clients de Bonzini Trading Cargo." | **HOOK TITLE** (the spoken line as kinetic type; no normal caption here) |
| 3.60–9.90 | B | "Voici votre conteneur qui arrive…" | **TARGET LOCK** on container + **ROUTE TRACKER** (CHINE → ENTREPÔT) completes at 7.70 ("entrepôt") |
| 9.96–15.50 | B (whip pan src 12.0–13.1) | "Il sera déchargé ici…" | **UNLOAD STATUS** module; shield "SÉCURITÉ" pulse at 14.92 |
| 15.70–16.35 | B → A cut **exactly at 16.00** | — | **TRANSITION**: glitch + flash + whoosh/impact. Captions hidden 15.70–16.12 |
| 16.00–21.40 | A from src 0 | "Voilà, très chers clients… Bonzini Trading Cargo." | **SECTION CHIP** "ENTREPÔT // BONZINI TRADING CARGO" |
| 21.66–25.70 | A | "Vos colis ont été déchargés en toute sécurité." | **CHECK BADGE** "COLIS DÉCHARGÉS ✓" + scan sweep over goods |
| 25.72–34.60 | A | "Et nous vous attendons … foyer Balengou, pour le retrait de vos colis." | **LOCATION CARD** (pin + radar) "RETRAIT DES COLIS · FOYER BALENGOU" |
| 34.58–38.70 | A | "Et nous vous disons merci pour votre confiance." | captions get hero treatment; shimmer on "confiance" (≈38.2) |
| 39.00–40.00 | A (src 23→24) push-in + blur + darken | — | outro build (riser) |
| 40.00–45.00 | blurred/dark A (held after src 25.92 = out 41.92) under end card | — | **END CARD**: logo assembles, impact at 40.00; brand + tagline; fade to black 44.30–45.00 |

Beat-synced hits: **0.00, 16.00, 40.00** (big impacts), and bar lines every 2.0 s.

Clip mapping is implemented in `lib/base.py` (read it). B src = out; A src = out − 16.0; A is 25 fps.

## 3. Screen layout (9:16, social safe zones)

Canvas 1080x1920. TikTok/Reels cover the top ~140 px, the bottom ~380 px and a right-hand column
(x > 930, y 900–1560). Therefore:

* **Top HUD strip**: y 150–250 (REC dot, feed label, timecode).
* **Module zone** (tracker, status panels, location card): x 60–760, y 270–620.
* **Subject zone**: centre — keep mostly clear; target brackets live here.
* **Caption zone**: text block centred at **y ≈ 1270**, lines within y 1150–1410, x 90–990.
* **Lower HUD line**: y 1450–1500, x 60–760 (tiny telemetry), nothing important below y 1520.
* Nothing essential at x > 930 between y 900 and 1560.

## 4. Visual language

"Premium logistics OS / HUD" — clean, confident, cinematic; NOT cheesy sci-fi clip-art.
Thin 1.5–2 px lines, generous letter-spacing, tasteful glow, motion with easing (expo/back out),
everything animates in AND out (no popping), staggered reveals, decrypt/scramble text reveals,
occasional micro-glitch. Restraint: at most 2 modules + captions on screen at once.

Palette (from the actual logo `assets/logo.svg`):
* Violet `#A947FE` (logo wings) — frames, glows, primary accent
* Amber `#F3A745` (logo top "U") — highlights, active caption word, "OK/ARRIVÉ" states
* Orange `#FE560D` (logo bottom "n") — REC dot, alerts, impacts, energy
* Ice white `#EAF6FF` — HUD text/lines (85–95 % opacity)
* Cyan `#5CF0FF` — scan lasers / data only, sparingly
* Panel fill: `rgba(8, 6, 20, 0.45)` + 1 px violet border at 60 %, optional backdrop darkening
Glow: `drop-shadow(0 0 10px rgba(169,71,254,.55))`; text shadow for legibility on bright footage:
`0 2px 12px rgba(0,0,0,.65)`.

Fonts (`assets/fonts/*.ttf`, load with @font-face from file URLs):
* Orbitron 700/900 — display titles (hook, end card, big words)
* Chakra Petch 500/600/700 — HUD labels (UPPERCASE, letter-spacing .12–.2em) and captions
* JetBrains Mono 400/500/700 — data / timecode / telemetry
* Space Grotesk 500/700 — secondary copy if needed

Logo: `assets/logo.svg` (viewBox 0 0 100 100, transparent): 4 paths — path 1 amber `#F3A745` (top),
paths violet `#A947FE` (two wings), path orange `#FE560D` (bottom). Animate the pieces separately
for the end card (amber drops from above, orange rises from below, wings slide in from the sides,
lock together at 40.00 with a shockwave ring).

## 5. Layer contracts (file interfaces)

All layers are on the final timeline, 1350 frames, frame n ↔ t = n/30.

| layer | owner | path | format |
|---|---|---|---|
| base footage (ungraded) | shared | `lib/base.py` → `base_at(t)` | BGR uint8 1080x1920 |
| grade | grade builder | `lib/grade.py` → `grade(bgr, t) -> bgr` (+ `assets/grade.cube` if used) | pure function, deterministic, ≤ 60 ms/frame |
| HUD / motion graphics | HUD builder | `layers/hud/NNNNN.png` (n = 00000…01349) | RGBA 1080x1920, straight (non-premultiplied) alpha |
| captions | caption builder | `layers/captions/NNNNN.png` | RGBA 1080x1920 |
| FX + compositing | compositor builder | `lib/composite.py` | renders `out/reel_video.mp4` (no audio) or muxes audio if `out/final_mix.wav` exists |
| voice | voice builder | `out/voice.wav` | 48 kHz, stereo (dual-mono) float/24-bit, exactly 45.000 s, placed on the timeline |
| music | music builder | `out/music.wav` | 48 kHz stereo, 45.000 s |
| sfx | music builder | `out/sfx.wav` | 48 kHz stereo, 45.000 s |
| final mix | music builder (`lib/mix.py`) | `out/final_mix.wav` | voice + ducked music + sfx, −14 LUFS integrated, ≤ −1.0 dBTP |

Empty frames: layers may skip writing a frame that is fully transparent **only** if they also write
`layers/<name>/manifest.json` listing written frame numbers; simplest is to write all 1350.

Machine-readable data: `data/captions.json` (pages with word timings, `emph` words, `in`/`out`),
`data/config.json` (district, brand, location line). Re-generate captions with
`python3 lib/make_captions.py ../src/transcript_large-v3.json` if config changes.

## 6. Quality bar

* Every graphic element legible at phone size (min HUD text 24 px; captions ≥ 64 px).
* Animations ease in/out, 60–400 ms, nothing static for more than ~3 s without subtle life
  (flicker, ticking numbers, moving scan line) — but never busy behind captions.
* Test yourself: render stills composited over real frames (`lib/base.py`) at the key times and
  LOOK at them (Read the PNG). Fix what looks off before reporting.
* Deterministic output (seeded randomness only; derive noise from frame number).

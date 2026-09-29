# BONZINI TRADING CARGO — « Le parcours de vos colis » (explainer, ~2 min)

Project root `E = <scratchpad>/explainer`. Scratchpad `S = E/..`. v1 reel project `S/reel` (read-only).

## Why this version exists (client feedback on v1 — read twice)
The client liked v1 but said: **too short**, **"les textes, on ne voyait pas"** (the texts could not be
read), and asked for **a voice-over**, **explanations / pedagogy**, and **motion graphic design**.
So this version is a ~2-minute pedagogical explainer: a female French narrator (synthetic) explains
the 6 steps of a parcel's journey; the real team member's lines from the footage come back as
on-site testimony; rich motion-design scenes illustrate the steps that have no footage.

## Story (data/script.json, laid out in data/timeline.json)
hook → brand → 6 steps → recap → outro:
| chapter | kind | content |
|---|---|---|
| hook | footage montage | V01 "Vous achetez vos marchandises en Chine ? Découvrez comment elles arrivent jusqu'à vous, étape par étape." |
| brand | motion design | V02 "Suivez avec nous le parcours de vos colis, avec Bonzini Trading Cargo." |
| s1 « 01 · L'ACHAT » | motion design | V03 purchase in China, suppliers, goods packed & prepared |
| s2 « 02 · LE GROUPAGE » | motion design | V04 parcels of several clients consolidated into one shared container |
| s3 « 03 · LE TRANSPORT » | motion design (map) | V05 ocean by ship China → Africa, then by truck to the warehouse |
| s4 « 04 · L'ARRIVÉE » | footage (street) | V06 + team quotes Q1 "Voici votre conteneur…", Q2 "Il sera déchargé ici…" |
| s5 « 05 · LE DÉCHARGEMENT » | footage (warehouse) | V07 + Q3 "…l'entrepôt de Bonzini Trading Cargo", Q4 "Vos colis ont été déchargés…", V08 cartons/sacs |
| s6 « 06 · LE RETRAIT » | footage + location card | V09 + Q5 "…au niveau du foyer Balengou, pour le retrait de vos colis" |
| recap « EN RÉSUMÉ » | motion design infographic | V10 lists the 6 steps |
| outro | footage → end card | Q6 "Et nous vous disons merci pour votre confiance." + V11 "Bonzini Trading Cargo. Vos colis, en toute sécurité." |

**Timing is data, never hard-code seconds.** Chapter/segment/word times live in `data/timeline.json`
and WILL shift when the narration takes are swapped (Kokoro ↔ Chatterbox). Use the TL API:
`TL.ch('s3')` → {start,end,num,title,kind}; `TL.seg('V05')` → {start,end,words:[{w,s,e,emph}]};
`TL.wt('V05','camion')` → start time of that word; `TL.word(seg, prefix, nth)`. Current values
(Kokoro): total 126.8 s — hook 0–7.2, brand 7.2–13.2, s1 13.2–22.8, s2 22.8–33.0, s3 33.0–45.0,
s4 45.0–64.8, s5 64.8–88.2, s6 88.2–103.8, recap 103.8–114.6, outro 114.6–126.8.
Chapter starts sit on the 100 BPM beat grid (0.6 s). **Canonical events** (music/SFX hit them):
chapter start = transition hit; chapter title slam = `ch.start + 0.15`; each VO word as spoken.

## ★ READABILITY RULES (the #1 complaint — non-negotiable)
* Anything meant to be read: **≥ 44 px**. Labels 44–56 px, titles **≥ 96 px**, chapter numbers ≥ 180 px,
  captions 64–72 px. Decorative micro-text (≤ 26 px) only if it is pure texture and ≤ 2 items per frame.
* Text sits on the opaque motion-design background, or on a **solid plate** (`plate()` ≥ 0.82 opacity),
  never thin text straight on busy footage. White / ice / amber text only; violet is for shapes & glows,
  never for text people must read.
* Every readable text stays **fully visible ≥ 2.0 s** (kinetic slams must settle and hold).
* At most **two** text blocks + captions on screen. Short words, big type, lots of air.
* French with correct accents. Mixed case is fine (easier to read) except titles.

## Layout (1080x1920, social safe zones)
* y < 150: nothing (platform UI). Bottom 380 px (y > 1540): nothing important.
* Right column x > 930 for y 900–1560: nothing important.
* **Stepper bar** (persistent during s1…s6): y 170–290.
* **Scene content zone**: y 320–1110 (MG illustrations, HUD, cards).
* **Caption zone**: y 1150–1430 (owned by captions.js; keep it clear otherwise).

## Visual language
Same brand world as v1 (futuristic, premium, clean) but **bigger, bolder, clearer**. Palette:
violet `#A947FE` (shapes, glows), amber `#F3A745` (highlights, ✓), orange `#FE560D` (pins, energy),
ice `#EAF6FF` / white (text), cyan `#5CF0FF` (data lines, sparingly), ink `#0B0718` (plates).
Fonts: Orbitron 700/900 (display numbers/titles), Chakra Petch 500–700 (UI labels), DM Sans 500/700/800
(body/captions, brand font), JetBrains Mono (data), Space Grotesk. Logo via `drawLogo()` (pieces
'amber','orange','wingTop','wingBot' can be offset for assembly animations).
Motion: everything eases in AND out (expo/back/cubic), staggered reveals, no popping, subtle
continuous life (particles, slow drifts). Deterministic: only `rnd(i)`, never Math.random/Date.

## Engine (overlay/)
`engine.html` + `lib.js` (read lib.js fully: TL API, easing, `txt`, `wrap`, `wipeText`, `plate`,
`rrect`, `ring`, `brackets`, `polyline`, `checkMark`, `shield`, `pin`, `isoBox`, `parcel`, `drawLogo`,
`mgBackground`, `glitched`, `decrypt`). Each scene file in `overlay/scenes/*.js` calls
`registerScene({id, z, when:(t)=>bool, draw:(t,n)=>{…}})` using the global `ctx`. z order:
MG backgrounds/illustrations 5–15, footage HUD 20, chapter cards/stepper/transitions 30–40,
captions 50. Motion-design chapters must paint their own background with `mgBackground(t, α)`
(α ≈ 0.88 so the blurred footage the compositor puts underneath shows faintly), fading in/out
over ~0.35 s at the chapter edges.

Render stills: `cd overlay && node render.mjs --times 14.2,17.5 --out ../layers/_<you> [--only id1,id2]`
Composite preview over the real graded picture:
`cd lib && python3 composite.py --layer _<you> --stills 14.2,17.5 --sheet <you>_sheet` → `out/preview/`
(the compositor reads PNGs from `layers/<layer>/NNNNN.png`, NNNNN = round(t*30)). LOOK at every
preview (Read the jpg) at phone size and at full size. Iterate until it is genuinely excellent and
readable. CPU is shared (4 cores, other jobs running): `nice -n 5`, render only the stills you need.

## Facts policy
Only say/show what the footage + narration support. Brand: BONZINI TRADING CARGO. Never print
"MAERSK". No invented numbers, addresses, phone numbers, prices, delays, GPS, container IDs.
The warehouse district is unknown: location = "Foyer Balengou" only. Destination on maps = the
warehouse (Africa / Gulf of Guinea coast is fine as geography; do not label a city).
Never "transfert d'argent" / "envoyer de l'argent".

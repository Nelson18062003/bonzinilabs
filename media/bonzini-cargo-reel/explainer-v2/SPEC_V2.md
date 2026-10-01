# « Le parcours de vos colis » — V2 (remake, ~2 min 10) · Bonzini Trading Cargo

Root `X = <scratchpad>/expl2`. Old version (to replace): `<scratchpad>/explainer` (SPEC.md, out/explainer_share.mp4,
contact sheet `X/ref_sheet.jpg`). Repo copy of the old project: `/home/user/bonzinilabs/media/bonzini-cargo-reel/explainer/`.

## The owner's request (verbatim)
« Refais la vidéo ci aussi avec la voix femme habituelle et aussi améliore toute la partie motion design, et video FX,
style contenu éducatif comme on fait souvent. »

So: same story and same facts, but
1. **the usual female voice** — Kyutai TTS 1.6B, voice `unmute-prod-website/developpeuse-3` (the series voice; takes in `X/audio/vo/V01_s1.wav`…);
2. **the motion design entirely redone** in the house educational style « **Kraft & Fil** » (see `X/ref_edu.jpg`, and the repo projects
   `media/bonzini-cargo-reel/fret`, `prix-de-revient`, `douane-partie-1`): a cream packing table seen from above, kraft cartons, tape, stamps,
   torn-paper captions with a violet highlighter, hand-drawn marker, cut-paper stop-motion (poses on twos), a violet thread = the journey;
3. **real video FX** on the footage (the old version was a dark sci-fi HUD over full-screen blurry 360p footage — that look is gone).

## Story (unchanged text — `data/tts_vo.json` + team quotes)
| ch | content |
|---|---|
| hook | V01 « Vous achetez vos marchandises en Chine ? Découvrez comment elles arrivent jusqu'à vous, étape par étape. » |
| brand | V02 « Suivez avec nous le parcours de vos colis, avec Bonzini Trading Cargo. » |
| s1 01 L'ACHAT | V03 « Étape un : l'achat. Tout commence en Chine, chez vos fournisseurs. Vos marchandises sont emballées et préparées pour le voyage. » |
| s2 02 LE GROUPAGE | V04 « Étape deux : le groupage. Les colis de plusieurs clients sont réunis dans un même conteneur. Chacun profite ainsi de l'espace partagé. » |
| s3 03 LE TRANSPORT | V05 « Étape trois : le transport. Le conteneur traverse l'océan par bateau, de la Chine jusqu'en Afrique. Puis il continue sa route par camion, jusqu'à notre entrepôt. » |
| s4 04 L'ARRIVÉE | V06 « Étape quatre : l'arrivée. Le voici, devant notre entrepôt ! Écoutez notre équipe sur place. » + Q1 « Voici votre conteneur qui arrive dans notre entrepôt en toute sécurité. » + Q2 « Il sera déchargé ici, dans notre entrepôt en toute sécurité. » |
| s5 05 LE DÉCHARGEMENT | V07 « Étape cinq : le déchargement. Le conteneur est vidé, et vos colis sont rangés à l'abri, dans l'entrepôt. » + Q3 « Voilà, très chers clients, nous sommes ici à l'entrepôt de Bonzini Trading Cargo. » + Q4 « Vos colis ont été déchargés en toute sécurité. » + V08 « Cartons, sacs, marchandises emballées : tout est rangé en sécurité, en attendant votre passage. » |
| s6 06 LE RETRAIT | V09 « Étape six : le retrait. Il ne vous reste plus qu'à venir récupérer vos colis. » + Q5 « Et nous vous attendons dans notre entrepôt ici, au niveau du foyer Balengou, pour le retrait de vos colis. » |
| recap EN RÉSUMÉ | V10 « En résumé : l'achat, le groupage, le transport, l'arrivée, le déchargement… et le retrait. Six étapes, et vos colis arrivent en toute sécurité. » |
| outro | Q6 « Et nous vous disons merci pour votre confiance. » + V11 « Bonzini Trading Cargo. Vos colis, en toute sécurité. » |

Q1–Q6 are the REAL voice of the team member filming (original audio, denoised; the speaker is off-camera — he films).
Approximate durations (old timeline, will shift ±15 % with the new voice): hook 7 s, brand 6, s1 10, s2 10, s3 12, s4 20, s5 23, s6 16,
recap 11, outro 12 → ~127 s. Q1 6.0 s, Q2 5.8, Q3 5.0, Q4 4.1, Q5 9.0, Q6 4.6.

## Footage (all real, phone, 360×640 — low resolution, shaky, stabilised)
Prepared frames: `X/foot/up/<clip>/NNNNN.jpg` (1080×1920, AI-upscaled ×4 then downsized; carrier lettering REMOVED from the blue
container by a clean-plate pass — see `X/foot/cp_B.jpg`, `cp_B2.jpg`). Contact sheets (1 frame/s, label = source second):
`X/foot/sheet_A.jpg`, `sheet_B.jpg`, `sheet_B2.jpg`.
- **A** (25 fps, 0–25.9 s): warehouse interior. 0–10 white cars parked inside + plastic chair; 11–14 yellow sacks; 15–25 rows of
  cartons (Chinese markings), wooden crate, blue-white stacked goods. Audio = Q3 (0–5.05), Q4 (5.55–9.66), Q5 (9.7–18.68), Q6 (18.64–23.2).
- **B** (30 fps, 0–16.6 s): street. 0–2.6 red truck cab + man in a football jersey (**FORBIDDEN: third-party logo + printed name**);
  3–9 blue container on the trailer (lettering removed); 9–12 container + street, alley to the warehouse door; 13–16 container close.
  Audio = Q1 (3.62–9.62), Q2 (9.94–15.72).
- **B2** (= B source 16–30.6 s, 30 fps): 0–2 container close; 2–5 alley/door; 5–9 warehouse inside (people sitting, goods on the right);
  10–14 street, container on truck, people walking.
- **Forbidden ranges**: B < 2.7 s (jersey). A 6.0–10.5 s shows a car maker's emblem on a car's rear — do not use it unless the emblem
  is covered (a kraft label or tape piece over it is fine). No other brand may be readable. Never print or show "MAERSK" (already
  cleaned in the prepared frames — never use the raw clips).
- Footage is soft: never show it full-screen for long. Best = **video prints** (a playing photo print with a white border, ≤ 900 px wide)
  taped on the table, or a brief push-in to full frame (≤ 1.5 s) as a transition.

## Visual language (Kraft & Fil — the house style)
Palette (kit `C`): table #F2EADB, cream #FBF6EC, kraft #C79E6C / dark #9C7447 / light #E6C79C, ink #231629, inkSoft #4A3A52,
violet #A947FE / dark #7B22D6 (thread, highlighter, shapes), amber #F3A745 (tape), orange #FE560D (pins, energy), sea blue #0B5FA5.
Fonts: Big Shoulders Stencil (titles, stamps, chapter numbers), Bricolage Grotesque (body, labels), Martian Mono (labels/codes),
Shantell Sans (hand-written marker notes), DM Sans (brand). Logo: `drawLogo()` (pieces amber/orange/wingTop/wingBot can be animated).
Motion: cut-paper stop-motion on twos (`stepT`, `jit`) for hand-placed things; smooth springs/eases for camera and slides; motion blur
(render `--mb 3`). Contact shadows on everything lifted. Grain. Nothing is ever static for more than 1.5 s.

## Video FX menu (the owner asked for them — use them, tastefully)
- **video print**: footage playing inside a photo print (white border, tape, gloss, slight curl shadow), dealt onto the table,
  slides, rotates; prints can stack, be swapped like cards, be pinned with a push-pin.
- **develop**: a print develops from cream to the image (instant film); **light leak** / flash on reveal.
- **marker annotations** synced to the words: hand circle around the container, arrow « votre conteneur », underline, check marks
  (`handCircle`, `handArrow`, `handText` in Shantell).
- **freeze-frame + paper cut-out**: the frame freezes, a white cut line runs around a subject, it lifts off as a sticker with a shadow
  (the blue container can be keyed from its colour; boxes can be approximated by a hand-drawn polygon).
- **push-in / pull-out through the print** (camera dives into a print to ~full frame, then back out to the table) as a chapter link.
- **split / stack**: two or three prints side by side (before/after, three steps), polaroid strip, contact strip of frames (film sprocket).
- **stamps** on prints (« ARRIVÉ », « DÉCHARGÉ », « EN SÉCURITÉ ») with ink starvation; **speed ramps** (slow-mo at the key moment) are fine.
- **team voice badge**: while Q1–Q6 play, a kraft badge « L'équipe Bonzini · sur place » with a small animated waveform / microphone,
  pinned to the print (the speaker is the cameraman, he is not visible).

## Rules
- Facts: only what the narration and footage support. Brand = « Bonzini Trading Cargo ». Location = « Foyer Balengou » only (no district,
  no city on maps; Africa / Gulf of Guinea coast is fine as geography). No prices, delays, transit times, phone numbers, addresses, GPS,
  container numbers. No carrier names or logos, no other brands. Never « transfert d'argent » / « envoyer de l'argent ».
- A sample label code like the fret video's « BZ-482913 » is allowed only with a visible « exemple ».
- Readability (the client's #1 complaint on v1): anything to be read ≥ 44 px, titles ≥ 96 px, chapter numbers ≥ 160 px, on opaque paper,
  ≤ 2 text blocks + caption per frame, each readable text holds ≥ 2 s. French accents correct.
- Safe zones 1080×1920: nothing in y < 150; nothing important in y > 1540; no text at x > 960 for y 900–1560.
  Captions: torn-paper strip centred y ≈ 1340 (band 1250–1430), spoken word highlighted violet; scenes keep that band clear
  (or move/hide captions through the director hooks).
- Persistent stepper during s1…s6: six kraft tags hung on the violet thread across the top (y 160–300), current one swings and gets a check.
- Timing is data: anchor on words (`TL.wt(seg, word)`), never hard-coded seconds. Chapter starts sit on the music grid.
- Deterministic: `rnd(i)` only (no Math.random / Date).

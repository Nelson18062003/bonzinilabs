# « DOUANE · Apprends à faire — Partie 1 » : « Le premier conteneur de Junior » (3 min 35)

V2 of the customs episode. V1 (1 min 32, « Votre carton a un passeport », still in git history: commits `2db038e8`,
`83f90068`) was rejected by the owner: « trop rapide, pas de cohérence, aucun storytelling ». V2 is a full rewrite
around **one story, one continuous world, one camera**, at a calm pace, with no length cap.

**The story.** Junior, a young trader from Mboppi (Douala), has almost all his money in one tin box: his first container,
just arrived at Kribi. Inside: his sneakers for the holidays. In front of it: his « bête noire », customs. Three months
earlier a « grand frère » texted him « Petit prix sur facture, mets juste "chaussures"… moins de douane ! »; Junior's
answer stays hidden under a kraft flap sealed with a violet « ? » sticker (open loop, revealed after the scanner, 2:12). Tantine Mireille,
a pepper exporter already at Kribi for her Friday shipment, walks him through the port, station by station:
the gate of the country (both directions) → his transitaire, a licensed customs broker who declares for him
(papers sent in advance, declaration filed before arrival) → the counter's three questions **QUOI ? · COMBIEN ? · D'OÙ ?**
(precise description → code → rate; goods + transport + insurance, « la douane compare »; country of manufacture, not
port of departure) → Mireille's export declaration → the expected bill (duty by code, then VAT 19.25 % general rate on
the whole, duty included, + other lines → part 2) → doubt → the scanner the next day (« C'est un contrôle normal.
Respire. ») → everything matches, the flap opens: « Non merci. Vrai prix, vraie description. » → the balance (fraud: a fine
up to the value of the goods; a good-faith error reported in time is not heavily punished) → payment through an official
channel, receipt, « bon à enlever » → Friday the barrier lifts, the beast shrinks into a paper « margouillat » → Mireille's
pepper goes in the other way → Saturday in Mboppi, full shelves, the first receipt framed « comme un diplôme ». Then
Bonzini (« où vous réglez vos fournisseurs en francs CFA ») and the customs-fee estimate coming **bientôt** in the app,
Cameroon first, Africa as an ambition; part 2 teaser; comment prompt; signature « Payez le juste droit. Ni plus, ni moins. »

**The world.** A single paper diorama laid along the table (`GROUND = 1150`), stations placed in world x:
sea −700 · quai 520 · porte 1300 · transit 2300 · guichet 3300 · scanner 4300 · caisse 5200 · barrière 6100 · route 7150 ·
Mboppi 8200. The camera travels right→left once (the hook: Mboppi stall → the quay), then only left→right at the
characters' walking pace, and ends on a crane shot where the whole journey becomes one line. Things put down stay put;
the only hard cut is Mireille's diary page « MER. → JEU. ». Time of day tints the sky (Wednesday morning → golden
Friday → evening road → Saturday morning). Real photos appear as prints pinned into the set (Kribi quay, Douala seen
from space on the road, captioned illustrations at the counter, masked app captures for the Bonzini beat).

Voice: Kyutai TTS 1.6B (CC-BY 4.0), voice `unmute-prod-website/developpeuse-3` (CC0), same voice as the series, natural
tempo (1.0). Music: the bikutsi groove of `lib/bikutsi.py`, with a story-driven level map (silence under the doubt,
heartbeat under the scanner, bass under the balance, full band at the barrier); customs foley in `lib/customs_sfx.py`;
impacts placed on the camera shakes the scenes register. Mix −14 LUFS, voice ≈ 12 LU over the bed.

## Voice-over (data/script.json, 30 segments)
See `data/script.json` (fields `text`, `tts`, `station`, `camera`, `visual`, `onscreen` per segment) and the real
timeline `data/timeline.json` (215.25 s, word timings). Chapters: hook 0:00 · secret 0:12 · appel 0:25 · porte 0:35 ·
transitaire 0:46 · questions 1:04 · export 1:28 · note 1:36 · doute 1:49 · scanner 1:54 · révélation 2:09 ·
conformité 2:16 · sortie 2:33 · miroir 2:48 · Mboppi 2:54 · Bonzini 3:01 · partie 2 3:18 · CTA 3:23 · signature 3:28.

## Facts and brand rules (research + adversarial checks; `data/v2_deltas.md` overrides the bible)
- Only figures on screen: VAT **19.25 %** (general rate) and the heading **« 64 04 »** (textile uppers). No duty rate per
  product, no real customs amount, no article number.
- In Cameroon the declaration is made by a **commissionnaire agréé en douane** (said in the voice-over; never written
  « commissionnaire = transitaire »). Exports are declared too, « avec ou sans droit de sortie ».
- Fraud: « la loi prévoit une amende qui peut aller jusqu'à la valeur de la marchandise »; good faith reported in time
  « n'est pas lourdement sanctionnée ». Delays: « ici, tout était prêt · les délais varient ».
- Payment « par un canal officiel » at a generic kiosk (bank / card / mobile icons), generic receipt (never the real one).
- Bonzini: no payment link to this container; the customs estimate is **bientôt** (never « disponible », never « le
  premier »: the official SIMPA simulator exists), « en quelques questions », masked captures stamped « BIENTÔT · APERÇU »
  + « Estimation · à faire confirmer par un commissionnaire agréé en douane »; Africa = « notre ambition ».
- No official emblems, no carrier marks, no « BZ » label on the container (handwritten « JUNIOR · MBOPPI »); nothing
  said about whose name groupage is declared in.

## Photos (not committed — sources and licences in `PHOTO_CREDITS.md`)

## Part 2
Plan + draft voice-over: `PARTIE_2.md` (taxes one by one, compliance, simulation, choosing the transitaire).

## Pipeline
`lib/tts_kyutai.py` (takes) → `lib/check_takes.py` (ASR check, faster-whisper) → `lib/build_timeline.py` (TEMPO 1.0,
0.25 s grid) → `overlay/render.mjs --dump-shakes ../data/shakes.json` (sound cues) → `lib/audio.py` (+ `cues.py`,
`bikutsi.py`, `customs_sfx.py`, word cues in `data/cues_scenes.json`) → `overlay/render.mjs --out ../out/frames --pages 3
--mb 3 --jpg` → `lib/encode.sh`.
Scenes: shared kit `00–08`, the world engine `09_world` (camera, actors, route) · `10_layout` (the plan, word-time helpers,
camera and walking keys) · `11_ground` · `12_cast` (full-body figures, walk cycle) · `13_stage` · `14_backdrop` (sky, time of
day) · `15_motifs` (Junior's phone with the « ? » flap, Mireille's diary); stations `20_quai` · `22_porte` · `24_transit` ·
`26_guichet` · `28_scanner` · `30_caisse` · `32_barriere` · `33_route` · `34_mboppi`; threads `44_bete` (the beast, its
size per segment) · `46_passeport` (the goods' passport and its stamps); ending `50_bonzini` · `52_partie2` · `54_cta` ·
`56_sign`. Animator guide: `SCENE_GUIDE_V2.md` (+ `SCENE_GUIDE.md` for the kit API). Story sources: `data/story_brief.md`,
`data/world_bible_v2.txt`, `data/story_v2_final.json`.

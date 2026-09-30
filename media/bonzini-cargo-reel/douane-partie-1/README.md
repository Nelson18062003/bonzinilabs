# « DOUANE · Apprends à faire — Partie 1 » : « Votre carton a un passeport » (1 min 32)

Kraft & Fil world, customs edition: real photos (printed, duotone, x-rayed) + cut-paper motion design.
One metaphor holds the whole film: **your goods have a passport**. Customs = the airport for goods (passport, questions,
x-rays), at the entrance *and* the exit. The customs officer always asks **3 questions — QUOI ? · COMBIEN ? · D'OÙ ?**
(the three elements of taxation: species/HS code, value, origin). Then the bill (duty per code, then VAT 19.25 % on the
whole, duty included), compliance (« des papiers vrais, complets, prêts à l'avance »), exporters, the Bonzini promise
and the teaser for part 2. The « bête noire » monster rises at 5 s and flies away as a paper plane at 60 s.
Same voice as the series (Kyutai TTS 1.6B, CC-BY 4.0 · voice `unmute-prod-website/developpeuse-3`, CC0), sped up 4 %
(pitch-preserving). Music: bikutsi-flavoured groove synthesised in `lib/bikutsi.py` (12/8 feel, muted-guitar ostinato,
FM balafon), customs foley in `lib/customs_sfx.py`; impact sounds are placed on the camera shakes the scenes register
(`render.mjs --dump-shakes data/shakes.json`).

## Voice-over (data/script.json)
Votre carton aussi a un passeport. S'il manque une page… il reste bloqué au port. · La douane ? La bête noire de tout le
monde. Pourtant… vous la connaissez déjà. · À l'aéroport : passeport, questions, rayons X. Vos cartons ? Pareil. · La
douane, c'est la porte du pays pour les marchandises. Ce qui entre… et ce qui sort. · Son passeport ? Les papiers : la
facture, le connaissement, la déclaration. · Et au guichet, trois questions. Quoi ? Combien ? D'où ? · Quoi ? Des baskets
en cuir ou en tissu : deux codes. Et chaque code a son taux. · Combien ? Marchandise, plus transport, plus assurance.
Oui… même le bateau est taxé ! · D'où ? Du pays de fabrication… pas du port de départ. · La note : le droit de douane,
selon le code. Puis la TVA, 19,25 %, sur le tout… droit compris. · Mauvais code, valeur trop basse ? Vous risquez une
amende… et des retards. Le secret : des papiers vrais, complets, prêts à l'avance. · Vous exportez ? Ça se déclare aussi,
même sans rien à payer. · Chez Bonzini, on veut que vous réussissiez. Bientôt dans l'application : vos frais de douane
estimés en quelques questions. · D'abord au Cameroun, puis ailleurs en Afrique. · Partie 2 : les taxes une par une, la
conformité, la simulation… et choisir votre transitaire. · Quoi, combien, d'où : laquelle vous bloque ? Dites-le en
commentaire. · Bonzini Trading Cargo. Payez le juste droit. Ni plus, ni moins.

## Facts used (verified by a research + adversarial-verification pass)
- Taxation elements = species (HS code), value, origin (CEMAC customs code, ch. IV; false declaration « dans l'espèce,
  la valeur ou l'origine »). Customs value = goods + transport + insurance (CAF). Origin = country of manufacture, not of shipment.
- VAT 19.25 % (17.5 % + 10 % communal additional cents), general rate, charged on value + duty + excise.
- HS headings 6403 (footwear, leather uppers) / 6404 (textile uppers) — the only codes shown for the example; **no duty rate per product**
  is ever shown (TEC CEEAC-CEMAC 2026 applies 0–40 %, line-level rates still unclear) and **no article number** (the
  harmonised CEEAC-CEMAC customs code in force since 1/1/2026 may have renumbered the 2019 code).
- Exports are declared too; most finished goods leave without duty; certificates depend on the product.
- In Cameroon the declaration goes through a licensed customs broker (« commissionnaire agréé en douane ») — the
  on-screen note says « faite par un commissionnaire agréé ».
- Bonzini customs module: built on branch `claude/bonzini-cameroon-tariff-3b9uli` (not merged, not in production) →
  « bientôt », « d'abord au Cameroun » (other countries = ambition, no written roadmap), « en quelques questions » (4 questions),
  promise « Payez le juste droit. Ni plus, ni moins. » (customs.json). On screen: real screenshots of that branch, **masked**
  (`lib/mask_app.py`: no product rate, no computed amount, no CNY rate field, no unverified claim), stamped « BIENTÔT · APERÇU »,
  with « Estimation indicative : le montant final est fixé par la douane ». An official simulator (SIMPA, Guichet unique) exists:
  Bonzini is never called « the first ».
- Groupage: nothing is said about whose name groupage declarations carry; no BZ label on a blocked/scanned carton
  (Junior's carton has a handwritten « JUNIOR · MBOPPI » label).

## Photos (not committed — sources and licences in `PHOTO_CREDITS.md`)
Real Cameroonian ports only where the picture is positive (Kribi deep-sea port, port of Douala, Wouri estuary); foreign
ports are captioned « photo d'illustration ». Carrier marks and port-authority signs are painted out in the scenes' processed copies.

## Part 2
Plan + draft voice-over: `PARTIE_2.md` (taxes one by one, compliance before shipment, simulation, choosing a licensed customs broker).

## Pipeline
`lib/tts_kyutai.py` (takes) → `lib/check_takes.py` (ASR check) → `lib/build_timeline.py` (TEMPO=1.04, 0.25 s grid) →
`overlay/render.mjs --mb 3 --jpg [--dump-shakes ../data/shakes.json]` → `lib/audio.py` (+ `cues.py`, `bikutsi.py`, `customs_sfx.py`)
→ `lib/encode.sh`. Scenes: `20_hook` · `22_bete` · `30_porte` · `32_papiers` · `34_questions` · `40_quoi` · `42_combien` · `44_dou` ·
`50_note` · `52_conformite` · `60_export` · `65_bonzini` · `70_partie2` · `72_cta` · `74_sign`; shared props in `06_photo`, `07_customs`,
`08_props`; rules and shot list in `SCENE_GUIDE.md` and `data/shots.md`.

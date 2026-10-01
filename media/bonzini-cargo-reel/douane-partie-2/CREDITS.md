# Partie 2 — credits and licences

## Pictures
- **Canva AI**, generated in the owner's Canva account (designs `DAHWs1EvEYg`, `DAHWs3hOOhk`, `DAHWs5P9RQE`,
  `DAHWs-nVujA`, `DAHWs5wHUnU`, `DAHWs3f7nwY`):
  - the character sheets of Junior and Christelle;
  - the maquis at night (BG1);
  - the office (Madame Ekambi's office, BG8);
  - the sneaker stall (BG4);
  - the Douala street (BG2, and BG7 = the same street mirrored).

  The people in the office, stall and street were removed by local inpainting so the animated characters can take their place.
- **Generated locally** with stable-diffusion.cpp (MIT), DreamShaper XL Lightning (CreativeML Open RAIL++-M) and TAESD XL (MIT):
  - the secondary cast (img2img from the Canva sheets, prompts in `data/gen/batch3.json`);
  - the hair-extensions stall (BG3/BG3F) and the warehouse in China;
  - the inpainting fixes.
- **Drawn in code** (`overlay/scenes/12_props.js` and the shot files):
  - the props, documents, phones and stamps;
  - the margouillat;
  - the top-down table and counter (BG5, BG9);
  - the Roi du forfait's parasol and sign;
  - the supplier in the phone;
  - the Bonzini app screens (Bonzini logo from `assets/logo.svg`).
- **Tools:**
  - rembg (MIT) with the isnet-anime segmentation model (Apache-2.0);
  - Real-ESRGAN `realesr-general-x4v3` (BSD-3-Clause);
  - MediaPipe Pose Landmarker heavy (Apache-2.0) for the automatic rigs.

No real person, no real official document, no third-party logo (sneaker logos painted out).

## Voice
Kyutai TTS 1.6B (`kyutai/tts-1.6b-en_fr`, CC-BY 4.0) with the voice `unmute-prod-website/developpeuse-3` from
`kyutai/tts-voices` (CC0). Takes checked with faster-whisper large-v3 (MIT).

## Fonts (SIL Open Font License 1.1)
Bangers, Kalam, Patrick Hand, Caveat Brush (titles, lettering, balloons, annotations); DM Sans, Bricolage Grotesque,
Big Shoulders Stencil, Martian Mono, Shantell Sans (shared series kit).

## Music and sound
Makossa groove, ambiences and foley synthesised in code (`lib/makossa.py`, `lib/amb.py`, `lib/customs_sfx.py`,
`lib/money_sfx.py`): no samples.

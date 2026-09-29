# « Fret maritime & aérien · le code unique » — 58 s motion design

Fully animated (no footage), art direction « Kraft & Fil »: a packing table seen from above, kraft cartons, stamps,
tape and the real Bonzini shipping label, animated like cut-paper stop-motion (poses on twos + motion blur on moves).
A violet thread = end-to-end tracking.

- Voice: Kyutai TTS 1.6B (CC-BY 4.0) with the voice `unmute-prod-website/developpeuse-3` (CC0), `lib/tts_kyutai.py`.
  Credit: "Voix : Kyutai TTS".
- Facts come from the repo: code BZ-NNNNNN (src/lib/customerCode.ts), bilingual label stuck on every carton
  (src/lib/shippingLabelCanvas.ts), scan at reception in Guangzhou, cargo accounts whose clients each have their own
  BZ code, Sea cargo priced per m³ / Air cargo per kg, blue label = sea, red hatched label = air. No prices or
  transit times (not in the code).
- Pipeline: `lib/build_timeline.py` (120 BPM grid, word timings) → `overlay/render.mjs --mb 3 --jpg`
  (Canvas 2D scenes in `overlay/scenes/`) → `lib/audio.py` (music + foley + mix, −14 LUFS) → ffmpeg.

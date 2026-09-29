# Bonzini Trading Cargo — futuristic reel (pipeline)

A 45 s vertical reel (1080×1920, 30 fps) edited from two phone clips: the container arriving and the warehouse tour.
Everything is generated offline: no stock assets.

| Step | Tool | Files |
|---|---|---|
| Transcription + checking the uncertain words | faster-whisper large-v3, forced-alignment scoring | `prep/transcribe.py`, `prep/score.py` |
| Stabilisation | ffmpeg vidstab (smoothing 9) | see SPEC.md |
| AI upscale 360p → 1080×1920 | Real-ESRGAN general-x4v3 (CPU) | `prep/upscale.py`, `prep/srvgg.py` |
| Voice cleanup | DeepFilterNet3 + EQ/de-ess/compression, clips matched | `prep/dfn.py`, `lib/voice.py` |
| Original music + 36 synced sound effects + mix (−14 LUFS) | numpy/scipy synthesis | `lib/music.py`, `lib/sfx.py`, `lib/mix.py`, `lib/dsp.py` |
| Colour grade | OpenCV | `lib/grade.py` |
| HUD, animated captions, logo end card | Canvas 2D in headless Chromium (Playwright) | `overlay/overlay.html`, `overlay/render.mjs` |
| Effects + final encode | OpenCV + ffmpeg | `lib/composite.py` |

Timeline, layout safe zones and palette: `SPEC.md`. Caption text/timings: `data/captions.json`
(rebuild with `lib/make_captions.py`). The warehouse district is left blank in `data/config.json`
because it couldn't be identified reliably from the audio; set `district` and re-render
the captions and overlay to show it.

Rebuild (paths relative to a working dir laid out as in SPEC.md):
```
node overlay/render.mjs 0 1349 --out ../layers/overlay
python3 lib/mix.py
python3 lib/composite.py --workers 3 --out out/reel.mp4
```

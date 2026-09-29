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

## Versions

| Version | Folder | Duration | Summary |
|---|---|---|---|
| v1 — neon HUD | `lib/`, `overlay/` | 45 s | Container → warehouse, futuristic HUD, glitch transitions |
| Premium | `variants/premium/` | 45 s | Warm cinematic brand film, light leaks, elegant typography, piano score |
| Hologramme | `variants/hologramme/` | 45 s | Cyan hologram world, 3D wireframe container, terminal-style captions |
| Teaser | `variants/teaser/` | 18.5 s | Short beat-cut ad for Stories / WhatsApp status |
| **Explainer « Le parcours de vos colis »** | `explainer/` | 2 min 07 | Female French voice-over (Kokoro TTS), 6 steps explained, motion-design scenes, large readable text |

### Explainer pipeline (`explainer/`)
- `data/script.json`: voice-over text (VO) and the team's quotes (SP, cut from the cleaned original audio).
- `lib/tts_kokoro.py`: narrator voice (Kokoro `ff_siwis`, native French female).
- `lib/build_timeline.py` → `data/timeline.json`: segments, word timings, chapters snapped to the 100 BPM grid, edit list.
- `overlay/engine.html` + `overlay/lib.js` + `overlay/scenes/*.js`: one scene per file, all timing read from the timeline.
- `lib/audio/`: music, sound effects and mix, all derived from the timeline.
- `lib/composite.py`: picture (grade, slow motion, blur under motion-design scenes) + overlay + encode.
- `rebuild.sh`: full rebuild (timeline → audio → overlay → video).
- `SPEC.md`: readability rules (text ≥ 44 px on opaque plates), layout, facts policy.

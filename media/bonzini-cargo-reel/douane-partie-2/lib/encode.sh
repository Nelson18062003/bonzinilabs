#!/usr/bin/env bash
# Encode out/frames/*.jpg + out/final_mix.wav → out/douane_master.mp4 (CRF 17) and out/douane_share.mp4 (two-pass, ≤ 27.5 MiB (target 26.6))
set -euo pipefail
F="$(cd "$(dirname "$0")/.." && pwd)"; cd "$F/out"
DUR=$(python3 -c "import json;print(json.load(open('$F/data/timeline.json'))['duration'])")
ffmpeg -y -loglevel error -framerate 30 -i frames/%05d.jpg -i final_mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 256k -shortest -movflags +faststart douane_master.mp4
AUD=160
VB=$(python3 -c "print(int(26.6*8*1024*1024/$DUR/1000 - $AUD))")
echo "duration $DUR s → video ${VB}k"
ffmpeg -y -loglevel error -framerate 30 -i frames/%05d.jpg -c:v libx264 -preset slow -tune animation -b:v ${VB}k -pass 1 -passlogfile pass -pix_fmt yuv420p -an -f mp4 /dev/null
ffmpeg -y -loglevel error -framerate 30 -i frames/%05d.jpg -i final_mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -tune animation -b:v ${VB}k -pass 2 -passlogfile pass \
  -pix_fmt yuv420p -profile:v high -c:a aac -b:a ${AUD}k -shortest -movflags +faststart douane_share.mp4
rm -f pass-0.log pass-0.log.mbtree
ls -la douane_master.mp4 douane_share.mp4

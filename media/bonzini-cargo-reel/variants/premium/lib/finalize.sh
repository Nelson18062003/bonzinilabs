#!/usr/bin/env bash
# Mux master, encode the ≤28 MB share file (2-pass x264), contact sheet, verification.
set -euo pipefail
V="$(cd "$(dirname "$0")/.." && pwd)"
VID="$V/work/video_full.mp4"
MIX="$V/out/final_mix.wav"
OUT="$V/out"
cd "$V/work"

# master: video stream copied (H.264 crf 17), audio AAC 256k
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$VID" -i "$MIX" -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t 45.0 "$OUT/premium_master.mp4"

# share: target 27.0 MB total (safety margin under 28 MB)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/premium_master.mp4")
VB=$(python3 -c "d=float('$DUR'); print(int((27.0e6*8/d - 160e3) * 0.985 / 1000))")
echo "duration $DUR s -> video bitrate ${VB}k"
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$OUT/premium_master.mp4" -c:v libx264 -preset slow -b:v ${VB}k \
  -pass 1 -passlogfile "$V/work/x264share" -threads 2 -profile:v high -pix_fmt yuv420p -an -f mp4 /dev/null
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$OUT/premium_master.mp4" -c:v libx264 -preset slow -b:v ${VB}k \
  -pass 2 -passlogfile "$V/work/x264share" -threads 2 -profile:v high -pix_fmt yuv420p \
  -an -movflags +faststart "$V/work/share_video.mp4"
# AAC adds ~0.4 dB inter-sample overshoot at 160k: pre-limit the share audio (sample peak -1.94 dBFS -> ~-1.7 dBTP after AAC)
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$MIX" -af "alimiter=limit=0.80:attack=1:release=60:level=disabled" -c:a aac -b:a 160k -ar 48000 "$V/work/share_audio.m4a"
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$V/work/share_video.mp4" -i "$V/work/share_audio.m4a" -map 0:v:0 -map 1:a:0 -c copy -movflags +faststart -t 45.0 "$OUT/premium_share.mp4"
rm -f "$V/work"/x264share*

# 1 fps contact sheet (9 x 5)
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$OUT/premium_master.mp4" -vf "fps=1,scale=216:384,tile=9x5" -frames:v 1 \
  -q:v 3 "$OUT/premium_sheet.jpg"

for f in premium_master.mp4 premium_share.mp4; do
  echo "== $f  $(stat -c %s "$OUT/$f") bytes"
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate,sample_rate,channels:format=duration,bit_rate -of compact "$OUT/$f"
  ffmpeg -hide_banner -nostats -i "$OUT/$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)" | tr -s ' '
done

#!/bin/bash
# master -> share (two-pass, <= 28 MB) + 1 fps contact sheet + checks
set -e
V="$(cd "$(dirname "$0")/.." && pwd)"
O="$V/out"
M="$O/hologramme_master.mp4"
SH="$O/hologramme_share.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$M")
# target 27.3 MB total, minus 160k audio, 1.5 % container overhead
VB=$(python3 -c "d=$DUR; tot=27.3e6*8/d; print(int((tot*0.985-160e3)/1000))")
echo "duration $DUR s -> video ${VB}k"
cd "$V/tmp"
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$M" -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile holo_p -threads 2 -an -f null /dev/null
# audio encoded straight from the WAV mix (not transcoded from the master's AAC: keeps TP <= -1 dBTP)
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$M" -i "$O/final_mix.wav" -map 0:v -map 1:a -c:v libx264 -preset slow -b:v ${VB}k -pass 2 -passlogfile holo_p -threads 2 \
  -profile:v high -pix_fmt yuv420p -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$SH"
rm -f holo_p*
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$M" -vf "fps=1,scale=216:384,tile=9x5" -frames:v 1 -q:v 3 "$O/hologramme_sheet.jpg"
for f in "$M" "$SH"; do
  echo "== $(basename "$f")  $(du -h "$f" | cut -f1)  $(stat -c %s "$f") bytes"
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,bit_rate,sample_rate,channels:format=duration,bit_rate -of compact "$f"
  ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|Peak:|LRA:)"
done

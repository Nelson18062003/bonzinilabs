#!/usr/bin/env bash
# teaser deliverables: share encode (two-pass, <= 28 MB), 1 fps contact sheet, verification
set -euo pipefail
V=/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/variants/teaser
M=$V/out/teaser_master.mp4
SH=$V/out/teaser_share.mp4
cd $V/tmp
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$M")
# total budget 27.3 MB (under 28 MB with margin); audio 160k; ~1.5% container overhead
VB=$(python3 -c "d=$DUR; print(int((27.3e6*8/d/1.015 - 160e3)/1000))")
VB=$(( VB > 12000 ? 12000 : VB ))
echo "duration $DUR s -> video ${VB}k"
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$M" -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile $V/tmp/p2 \
  -profile:v high -pix_fmt yuv420p -threads 2 -an -f mp4 /dev/null
# audio straight from the PCM mix (AAC->AAC transcoding overshoots the true peak by ~1.5 dB)
nice -n 5 ffmpeg -hide_banner -loglevel error -y -i "$M" -i $V/out/final_mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -b:v ${VB}k -pass 2 -passlogfile $V/tmp/p2 \
  -profile:v high -pix_fmt yuv420p -threads 2 -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "$SH"
rm -f $V/tmp/p2*
# contact sheet (1 fps; 18.5 s -> 19 tiles in 10x2)
ffmpeg -hide_banner -loglevel error -y -i "$M" -vf "fps=1,scale=216:384,tile=10x2" -frames:v 1 -q:v 3 $V/out/teaser_sheet.jpg
for f in "$M" "$SH"; do
  echo "== $f  $(stat -c %s "$f") bytes"
  ffprobe -v error -show_entries format=duration,bit_rate:stream=codec_name,profile,width,height,r_frame_rate,nb_frames,pix_fmt,sample_rate,channels,bit_rate -of compact "$f"
  ffmpeg -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):" | tr -s ' '
done

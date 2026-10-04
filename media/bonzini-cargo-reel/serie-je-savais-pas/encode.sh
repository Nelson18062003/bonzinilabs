#!/bin/bash
# usage: encode.sh EP NAME   -> EP/out/NAME_share.mp4 (2-pass, ≤ 27.3 MiB for the 30 MiB upload limit) + NAME_whatsapp.mp4 (720p CRF 21)
S=$(cd "$(dirname "$0")" && pwd)
E=$S/$1; NAME=$2; cd $E/out || exit 1
D=$(python3 -c "import json;print(json.load(open('$E/data/timing.json'))['end'])")
VB=$(python3 -c "print(int((27.3*1048576*8/$D - 192000)/1000))")
nice -n 5 ffmpeg -y -v error -framerate 30 -i final/%05d.jpg -c:v libx264 -b:v ${VB}k -preset slow -pix_fmt yuv420p -profile:v high -pass 1 -passlogfile p2_$1 -an -t $D -f mp4 /dev/null &&
nice -n 5 ffmpeg -y -v error -framerate 30 -i final/%05d.jpg -i ../audio/mix.wav -map 0:v -map 1:a -c:v libx264 -b:v ${VB}k -preset slow -pix_fmt yuv420p -profile:v high -pass 2 -passlogfile p2_$1 -c:a aac -b:a 192k -ar 48000 -t $D -movflags +faststart ${NAME}_share.mp4 &&
nice -n 5 ffmpeg -y -v error -framerate 30 -i final/%05d.jpg -i ../audio/mix.wav -map 0:v -map 1:a -vf scale=720:1280:flags=lanczos -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -t $D -movflags +faststart ${NAME}_whatsapp.mp4
rm -f p2_$1*.log p2_$1*.mbtree
for f in ${NAME}_share.mp4 ${NAME}_whatsapp.mp4; do echo "$f $(ffprobe -v error -show_entries format=duration -of csv=p=0 $f)s $(python3 -c "import os;print(round(os.path.getsize('$f')/1048576,1))") MiB"; done

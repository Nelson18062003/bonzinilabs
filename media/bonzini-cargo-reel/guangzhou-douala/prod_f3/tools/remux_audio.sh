#!/bin/bash
# remux_audio.sh — film 3, integration 2: a NEW MIX into the existing deliverables WITHOUT touching the picture: the H.264
# stream of out/NAME_{share,whatsapp}.mp4 is copied bit for bit (-c:v copy, colour tags kept), the audio is re-encoded
# exactly as tools/mux.sh does it (AAC 192 k share / 128 k WhatsApp, 48 kHz, -t T.end, +faststart), then the same listen
# tests on the decoded AAC (listen_report_share / _whatsapp.json). Use it only when the frames are unchanged since the mux.
# usage:  [BZ_VARIANT=wa|colis] tools/remux_audio.sh NAME
set -e
P=$(cd "$(dirname "$0")/.." && pwd); NAME=${1:?usage: tools/remux_audio.sh NAME}
V=${BZ_VARIANT:-main}; if [ "$V" = main ]; then TLF=timeline.json; AUD=audio; else TLF=timeline_$V.json; AUD=audio_$V; fi
MIX="$P/$AUD/mix.wav"; read N D < <(python3 -c "import json;t=json.load(open('$P/data/$TLF'));print(t['frames'],t['dur'])")
cd "$P/out"
for k in share whatsapp; do
  BR=192k; [ $k = whatsapp ] && BR=128k
  [ -f "${NAME}_$k.mp4" ] || { echo "ERROR: out/${NAME}_$k.mp4 missing (tools/mux.sh first)"; exit 1; }
  T=$(mktemp -u "$P/out/remux_XXXX").mp4
  nice -n 5 ffmpeg -y -v error -i "${NAME}_$k.mp4" -i "$MIX" -map 0:v -map 1:a -c:v copy -c:a aac -b:a $BR -ar 48000 -t "$D" -movflags +faststart "$T"
  NF=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$T")
  [ "$NF" -eq "$N" ] || { echo "ERROR: $NF frames in the remux, the timeline has $N"; rm -f "$T"; exit 1; }
  mv "$T" "${NAME}_$k.mp4"
  python3 - "${NAME}_$k.mp4" <<'PY'
import sys, os, json, subprocess
f = sys.argv[1]; j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_type,width,height,nb_frames,duration', '-of', 'json', f], capture_output=True, text=True).stdout)
v = next(s for s in j['streams'] if s['codec_type'] == 'video'); a = next(s for s in j['streams'] if s['codec_type'] == 'audio')
print(f"out/{f}: {float(j['format']['duration']):.3f} s · {v['width']}×{v['height']} · {v.get('nb_frames')} frames · {os.path.getsize(f) / 1048576:.2f} MiB · audio {float(a['duration']):.3f} s")
PY
done
for k in share whatsapp; do
  W=$(mktemp -u "$P/out/aac_XXXX").wav
  ffmpeg -y -v error -i "$P/out/${NAME}_$k.mp4" -vn -c:a pcm_f32le -ar 48000 "$W"
  (cd "$P" && python3 tools/listen_test.py "$AUD" --wav "$W" --tag "$k" | tail -2) || true
  rm -f "$W"
done

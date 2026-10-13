#!/bin/bash
# mux.sh — frames + audio/mix.wav → the two deliverables (mirrors serie/encode.sh, rush1's tool):
#   out/NAME_share.mp4      H.264 high, 2-pass, ≤ 27 MiB (for a 30-MiB upload limit), AAC 192k, +faststart
#   out/NAME_whatsapp.mp4   720×1280 Lanczos, H.264 CRF 21 (preset slow), AAC 128k, +faststart
# usage:  [BZ_VARIANT=cut] tools/mux.sh NAME [FRAMES_DIR = out/frames] [MIX = audio/mix.wav | audio_<variant>/mix.wav]
# The duration is SCORE.T.end from data/timeline.json (written by render.mjs); frames NNNNN.jpg or .png from 00000.
# Checks: frame count = timeline frames, mix length = T.end, prints duration / size / bitrate of each file.
set -e
P=$(cd "$(dirname "$0")/.." && pwd)
NAME=${1:?usage: tools/mux.sh NAME [FRAMES_DIR] [MIX]}
V=${BZ_VARIANT:-main}; if [ "$V" = main ]; then TLF=timeline.json; AUD=audio; else TLF=timeline_$V.json; AUD=audio_$V; fi   # variants: BZ_VARIANT=cut
FR=$(cd "$P" && realpath -m "${2:-out/frames}"); MIX=$(cd "$P" && realpath -m "${3:-$AUD/mix.wav}")
read N D < <(python3 -c "import json;t=json.load(open('$P/data/$TLF'));print(t['frames'],t['dur'])")
EXT=jpg; [ -f "$FR/00000.jpg" ] || EXT=png
HAVE=$(ls "$FR" | grep -c "^[0-9]\{5\}\.$EXT$" || true)
[ "$HAVE" -eq "$N" ] || { echo "ERROR: $HAVE frames in $FR, the timeline has $N (render the whole film first)"; exit 1; }
ML=$(python3 -c "import soundfile as sf;i=sf.info('$MIX');print(round(i.frames/i.samplerate,4))")
python3 -c "import sys;sys.exit(0 if abs($ML-$D)<0.002 else 1)" || { echo "ERROR: $MIX lasts $ML s, T.end = $D s (re-run lib/mix.py)"; exit 1; }
mkdir -p "$P/out"; cd "$P/out"
# video bitrate for ≤ 27 MiB total, capped at 16 Mb/s for short films
VB=$(python3 -c "print(min(16000, int((27.0*1048576*8/$D - 192000)/1000 * .97)))")
LOG=$(mktemp -u "$P/out/p2_XXXX")
# review 2: BT.709 limited range, tagged (a platform re-encoder that assumes BT.709 for HD keeps the violet / amber / orange);
# the share file at H.264 High@L4.1 with a VBV (some low-end Android hardware decoders refuse L5.0)
C709="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
VF="scale=in_range=full:out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p"
nice -n 5 ffmpeg -y -v error -framerate 30 -i "$FR/%05d.$EXT" -vf "$VF" -c:v libx264 -b:v ${VB}k -maxrate 16M -bufsize 32M -preset slow -pix_fmt yuv420p \
  -profile:v high -level:v 4.1 $C709 -pass 1 -passlogfile "$LOG" -an -t "$D" -f mp4 /dev/null
nice -n 5 ffmpeg -y -v error -framerate 30 -i "$FR/%05d.$EXT" -i "$MIX" -map 0:v -map 1:a -vf "$VF" -c:v libx264 -b:v ${VB}k -maxrate 16M -bufsize 32M \
  -preset slow -pix_fmt yuv420p -profile:v high -level:v 4.1 $C709 -pass 2 -passlogfile "$LOG" -c:a aac -b:a 192k -ar 48000 -t "$D" \
  -movflags +faststart "${NAME}_share.mp4"
nice -n 5 ffmpeg -y -v error -framerate 30 -i "$FR/%05d.$EXT" -i "$MIX" -map 0:v -map 1:a \
  -vf "scale=720:1280:in_range=full:out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -crf 21 -preset slow -pix_fmt yuv420p -profile:v high -level:v 3.1 $C709 -c:a aac -b:a 128k -ar 48000 -t "$D" \
  -movflags +faststart "${NAME}_whatsapp.mp4"
rm -f "$LOG"*
for f in "${NAME}_share.mp4" "${NAME}_whatsapp.mp4"; do
  python3 - "$f" <<'EOF'
import sys, os, json, subprocess
f = sys.argv[1]; j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_type,width,height,nb_frames',
                                                '-of', 'json', f], capture_output=True, text=True).stdout)
v = next(s for s in j['streams'] if s['codec_type'] == 'video'); mib = os.path.getsize(f) / 1048576
print(f"out/{f}: {float(j['format']['duration']):.3f} s · {v['width']}×{v['height']} · {v.get('nb_frames')} frames · {mib:.2f} MiB · {int(j['format']['bit_rate']) / 1e6:.2f} Mb/s"
      + ('  ** OVER 27 MiB **' if 'share' in f and mib > 27 else ''))
c = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=profile,level,color_space,color_primaries,color_transfer,color_range',
                               '-of', 'json', f], capture_output=True, text=True).stdout)['streams'][0]
ad = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'json', f], capture_output=True, text=True).stdout)['streams'][0]
print(f"   audio {float(ad['duration']):.3f} s · {c.get('profile')} L{c.get('level', 0) / 10:.1f} · {c.get('color_space')}/{c.get('color_primaries')}/{c.get('color_transfer')} {c.get('color_range')}")
EOF
done
# review 2: the listen test on what people will actually hear — the AAC decoded from each file (phone band, weak listener)
for k in share whatsapp; do
  W=$(mktemp -u "$P/out/aac_XXXX").wav
  ffmpeg -y -v error -i "$P/out/${NAME}_$k.mp4" -vn -c:a pcm_f32le -ar 48000 "$W"
  (cd "$P" && python3 tools/listen_test.py "$AUD" --wav "$W" --tag "$k" | tail -2) || true
  rm -f "$W"
done

#!/bin/bash
# remux_audio.sh — the new mix into the four mp4s (video stream copied bit for bit; AAC encoded exactly as tools/mux.sh:
# share 192k, WhatsApp 128k, 48 kHz, -t T.end, +faststart), then mux.sh's listen test on each file's decoded AAC
cd /tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/rush2/prod_f4 || exit 1
D=$(python3 -c "import json;print(json.load(open('data/timeline.json'))['dur'])")
for v in main wa; do
  if [ $v = main ]; then A=audio; N=MACHINE; else A=audio_wa; N=MACHINE_WA; fi
  for k in share whatsapp; do
    if [ $k = share ]; then B=192k; else B=128k; fi
    ffmpeg -y -v error -i out/${N}_$k.mp4 -i $A/mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a $B -ar 48000 -t "$D" -movflags +faststart out/tmp_${N}_$k.mp4 && mv out/tmp_${N}_$k.mp4 out/${N}_$k.mp4
    W=out/aac_R$k.wav; ffmpeg -y -v error -i out/${N}_$k.mp4 -vn -c:a pcm_f32le -ar 48000 $W
    echo "$N $k: $(BZ_VARIANT=$v python3 tools/listen_test.py $A --wav $W --tag $k | tail -1)"; rm -f $W
  done
done
echo REMUX_DONE

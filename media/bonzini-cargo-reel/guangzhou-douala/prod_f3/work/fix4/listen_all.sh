#!/bin/bash
cd "$(dirname "$0")/../.."
for v in main wa colis; do
  if [ $v = main ]; then N=VOITURE_TELEPHONES; A=audio; else N=VOITURE_TELEPHONES_$v; A=audio_$v; fi
  for k in share whatsapp; do
    W=work/fix4/aac_${v}_$k.wav; S=work/fix4/aac_${v}_${k}_s16.wav
    ffmpeg -y -v error -i out/${N}_$k.mp4 -vn -c:a pcm_f32le -ar 48000 $W
    ffmpeg -y -v error -i out/${N}_$k.mp4 -vn -c:a pcm_s16le -ar 48000 $S
    echo "== $v $k (pcm_s16, small)"; python3 tools/listen_test.py $A --wav $S --tag ${k}_s16 | tail -3
    echo "== $v $k (large-v3)"; nice -n 5 python3 tools/listen_test.py $A --wav $W --tag $k --model large-v3 | tail -3
    rm -f $W $S
  done
done
echo LISTEN_DONE

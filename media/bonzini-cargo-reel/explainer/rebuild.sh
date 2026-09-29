#!/bin/bash
# Full rebuild of the explainer: timeline -> audio -> overlay -> picture.
set -e
E=$(cd "$(dirname "$0")" && pwd)
cd "$E" && nice -n 5 python3 lib/build_timeline.py --vo kokoro 2>&1 | grep -v -i warn
nice -n 5 python3 lib/audio/mix.py --all 2>&1 | tail -3
cd "$E/overlay" && rm -rf ../layers/overlay && node render.mjs --pages 3 --out ../layers/overlay 2>&1 | grep -E "ERROR|DONE"
cd "$E/lib" && python3 composite.py --workers 3 --out "$E/out/explainer_master.mp4" 2>&1 | grep -E "wrote|Error|Trace"

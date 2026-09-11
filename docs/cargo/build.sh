#!/usr/bin/env bash
# Régénère le PDF du manuel cargo depuis la source HTML.
# Requiert Chromium (headless).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CHROME="${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}"
"$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="$DIR/Bonzini-Cargo-Manuel-Chine-Cameroun.pdf" \
  --virtual-time-budget=15000 \
  "file://$DIR/bonzini-cargo-manuel.html"
echo "PDF régénéré : $DIR/Bonzini-Cargo-Manuel-Chine-Cameroun.pdf"

'use strict';
// Adapter for the validated « PAS REÇU. » margouillat (40_gecko.js, copied UNCHANGED from SP/v3): it binds to window.SCORE
// when it loads and reads PAS REÇU's beat names (slam, falls, crush, stamp, letters, gulps, endcard, hic, check…) and
// layout (G.gecko, G.amberY, G.steelHigh). We hand it SCORE.geckoShim() — the same acts (SCORE.gecko(t)) with our beats
// mapped onto its names — then 41_gecko_unshim.js puts the real score back. No other file sees the shim.
window.__SCORE_EP = window.SCORE;
window.SCORE = window.SCORE.geckoShim();

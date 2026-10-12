'use strict';
// Adapter for the validated margouillat (40_gecko.js, copied UNCHANGED from serie/ep2): it binds to window.SCORE when it
// loads and reads the « PAS REÇU. » beat names (slam, falls, stamp, check, letters, gulps, endcard, hic…) and layout
// (G.gecko, G.amberY, G.steelHigh). We hand it SCORE.geckoShim() — SCORE.gecko(t) (idle on the card, startled by the plate,
// head bobs on « Douala », smug after) with our beats mapped onto its names — then 41_gecko_unshim.js puts the real score
// back. He only appears on the kraft card (BZ_card calls K_gecko), never on the real footage.
window.__SCORE_EP = window.SCORE;
window.SCORE = window.SCORE.geckoShim();

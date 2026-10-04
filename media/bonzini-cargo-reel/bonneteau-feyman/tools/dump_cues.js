// writes data/score_cues.json (sound cues + grid facts) from the picture score — the audio engine reads it
const S = require('../overlay/scenes/01_score.js');
const fs = require('fs');
fs.writeFileSync(__dirname + '/../data/score_cues.json', JSON.stringify({ loop_s: S.LOOP / 30, fps: 30, bar_s: 2, beat_s: .5, swaps: S.SWAPS.map(([f, d, a, b]) => ({ t: f / 30, dur: d / 30, a, b })), cues: S.soundCues(), texts: S.TEXTS.map(([a, b, s]) => ({ t0: a / 30, t1: b / 30, text: s })) }, null, 1));
console.log('cues', S.soundCues().length);

// node tools/listen_prep.js [--real]  → check/listen/data/{timing,script}.json for serie/listen_test.py
// listen_test.py reads the START of each line from data/timing.json (T[id]); this film's timing.json carries only
// {dur, words} (the score computes the starts), so this writes a side folder with the score's starts:
//   narrator lines N1…N6 (the ≥ 90 % test); with --real also R1 / R2 / R1b (speech spans, informative only)
// then: cd serie && python3 listen_test.py ../rush1/prod/check/listen ../rush1/prod/audio/mix.wav
const fs = require('fs'), path = require('path');
const P = path.resolve(__dirname, '..'), S = require(path.join(P, 'overlay', 'scenes', '01_score.js'));
const out = path.join(P, 'check', S.VARIANT === 'wa' ? 'listen_wa' : 'listen', 'data'); fs.mkdirSync(out, { recursive: true });
const script = JSON.parse(fs.readFileSync(path.join(P, 'data', 'script.json'), 'utf8'));
const t = { dur: {} }, segs = [];
// BZ_VARIANT=wa (the WhatsApp variant): N6 is said with N6w's words
const textOf = id => (S.VARIANT === 'wa' && id === 'N6' && script.segments.find(q => q.id === 'N6w')) ? script.segments.find(q => q.id === 'N6w').text : script.segments.find(q => q.id === id).text;
for (const s of script.segments) if (/^N[1-6]$/.test(s.id)) { t[s.id] = S.T[s.id]; t.dur[s.id] = S.DUR[s.id]; segs.push({ id: s.id, text: textOf(s.id) }); }
if (process.argv.includes('--real')) for (const R of Object.values(S.REAL)) { t[R.id] = R.speech[0]; t.dur[R.id] = +(R.speech[1] - R.speech[0]).toFixed(3); segs.push({ id: R.id, text: R.text }); }
fs.writeFileSync(path.join(out, 'timing.json'), JSON.stringify(t, null, 1));
fs.writeFileSync(path.join(out, 'script.json'), JSON.stringify({ segments: segs }, null, 1));
console.log(`check/listen: ${segs.map(s => `${s.id} ${t[s.id].toFixed(3)}+${t.dur[s.id].toFixed(3)}`).join(' · ')}`);

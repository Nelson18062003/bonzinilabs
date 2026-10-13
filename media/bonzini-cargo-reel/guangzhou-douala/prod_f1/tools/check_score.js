// node tools/check_score.js [--mb 6]   — prints the score (anchors, the EDL shot by shot, voices, music, cues, texts) and the
// audit of tools/audit.js (crops inside the sources, must-hide regions, black holes, frames on disk, voices, safe zones,
// violet, hygiene). Informative: tools/qa.js is the strict gate (exit code). BZ_VARIANT=fx for the variant.
const path = require('path');
const { audit } = require(path.join(__dirname, 'audit.js'));
const mb = +(process.argv[process.argv.indexOf('--mb') + 1] || 6) || 6;
const R = audit({ mb }), S = R.S;
const f = x => typeof x === 'number' ? x.toFixed(3) : x;
console.log(`N = ${S.N} frames · T.end = ${S.T.end} s · ${S.FPS} fps · variant ${S.VARIANT} · grid ${S.BPM} bpm`);
console.log('T  ', Object.entries(S.T).map(([k, v]) => `${k} ${f(v)}`).join(' · '));
console.log('A  ', Object.entries(S.A).map(([k, v]) => `${k} ${f(v)}`).join(' · '));
console.log('EDL');
const needs = Object.fromEntries(S.needs().map(n => [n.shot, n]));
for (const s of S.shots) {
  let smin = 1e9, smax = -1e9, vmin = 1e9, vmax = -1e9, wmin = 1e9, wmax = 0;
  for (let t = s.win[0]; t < s.win[1]; t += 1 / 60) {
    const src = s.srcAt(t), v = (s.srcAt(t + 1 / 240) - s.srcAt(t - 1 / 240)) * 120, c = S.cropAt(s, t);
    smin = Math.min(smin, src); smax = Math.max(smax, src); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); wmin = Math.min(wmin, c.w); wmax = Math.max(wmax, c.w);
  }
  const L = s.layoutAt(s.t0), tr = x => x ? `${x.type}${x.dir ? ' ' + x.dir : ''} ${x.dur}s${x.linked === false ? ' (alone)' : ''}` : 'cut';
  console.log(`  ${s.id.padEnd(5)} ${s.clip.padEnd(4)} film ${f(s.t0)}–${f(s.t1)} (drawn ${f(s.win[0])}–${f(s.win[1])}) · src ${smin.toFixed(2)}–${smax.toFixed(2)} · ` +
    `speed ×${vmin.toFixed(2)}–×${vmax.toFixed(2)}${s.blend ? ' (blend)' : ''} · crop w ${wmin.toFixed(0)}–${wmax.toFixed(0)} of ${s.dims.w}×${s.dims.h} · ${L.kind} · ` +
    `in ${tr(s.trIn)} · out ${s.outLink ? tr(s.outLink) + ' → ' + s.outLink.to : tr(s.trOut)} · ${s.hides.length} hide(s) · needs ×${needs[s.id].scale} ${needs[s.id].frames} f`);
}
console.log('CUTS', S.CUTS().map(f).join(' '));
const w = S.check(); console.log(w.length ? 'SCORE.check\n  ' + w.join('\n  ') : 'SCORE.check: OK');
console.log('VOICES', S.voices().map(v => `${v.id} ${v.clip} ${v.in}–${v.out} at ${f(v.t)} (speech ${v.speech.map(f).join('–')}) src ${v.src}${v.denoise ? ' denoise ' + v.denoise : ''}`).join('\n       '));
console.log('AMB  ', S.ambience().map(a => `${a.shot} ${a.clip} ${a.mode} ${f(a.t0)}–${f(a.t1)}${a.mode === 'hold' ? ' from ' + a.in : ''} g ${a.g}`).join(' | '));
console.log('music', JSON.stringify(S.music()));
console.log('cues ', S.soundCues().map(c => `${f(c.t)} ${c.name}`).join(' | '));
console.log('texts', S.TEXTS().map(q => `${f(q[0])}–${f(q[1])} ${q[2]} (${q[4]})`).join(' | '));
for (const m of R.ok) console.log('  ok    ' + m);
for (const m of R.warn) console.log('  WARN  ' + m);
for (const m of R.err) console.log('  ERROR ' + m);
console.log(R.err.length ? `${R.err.length} error(s), ${R.warn.length} warning(s) — see tools/qa.js` : `audit clean (${R.warn.length} warning(s))`);

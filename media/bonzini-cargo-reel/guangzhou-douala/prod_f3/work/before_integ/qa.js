// node tools/qa.js [--mb 6] [--no-outputs]   — the strict gate before shipping (exit code 1 on any ERROR).
// Everything tools/audit.js checks (picture, frames on disk, voices, type, hygiene), plus:
//   contract  the score evaluated the way the PAGE does (vm sandbox with window.TIMING / CLIPS injected like render.mjs)
//             gives the same N, T, A and shots as node; render.mjs injects data/timing.json as window.TIMING
//   outputs   data/timeline.json = N; audio/mix.wav lasts T.end AND was built on this very score (audio/score_cues.json
//             = the live T, A, voices, cues: a stale mix is an ERROR); audio/mix_report.json: -14 LUFS (±0.5),
//             TP ≤ −1 dBTP, the real voice untouched (samples, lag 0); data/voice_env.json covers every voice
//   (--no-outputs skips the outputs: checking a score before rendering / mixing)
const fs = require('fs'), path = require('path'), vm = require('vm');
const { audit, P } = require(path.join(__dirname, 'audit.js'));
const args = process.argv.slice(2), mb = +(args[args.indexOf('--mb') + 1] || 6) || 6;
const R = audit({ mb }), S = R.S, { ok, warn, err } = R;
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const eq = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
// ---------- contract: browser path = node path ----------
{
  const ctxB = { window: { TIMING: readJ(path.join(P, 'data', 'timing.json')), CLIPS: readJ(path.join(P, 'data', 'clips.json')), HIDES: readJ(path.join(P, 'data', 'hides.json')),
    TAKES: readJ(path.join(P, '..', 'voice', 'takes.json')), REAL_WORDS: readJ(path.join(P, '..', 'voice', 'real_words.json')),
    NARR_WORDS: readJ(path.join(P, '..', 'voice', 'words.json')), VARIANT: S.VARIANT }, console };
  vm.createContext(ctxB);
  vm.runInContext(fs.readFileSync(path.join(P, 'overlay', 'scenes', '00_edl.js'), 'utf8'), ctxB);
  vm.runInContext(fs.readFileSync(path.join(P, 'overlay', 'scenes', '01_score.js'), 'utf8'), ctxB);
  const SB = ctxB.window.SCORE;
  if (!SB) err.push('contract: 01_score.js does not set window.SCORE in the browser path');
  else {
    const dT = Object.keys(S.T).filter(k => !eq(S.T[k], SB.T[k])), dA = Object.keys(S.A).filter(k => !eq(S.A[k], SB.A[k]));
    const dS = S.shots.filter((s, i) => !SB.shots[i] || SB.shots[i].id !== s.id || !eq(SB.shots[i].win[0], s.win[0]) || !eq(SB.shots[i].win[1], s.win[1])).map(s => s.id);
    if (SB.N !== S.N || dT.length || dA.length || dS.length) err.push(`contract: browser score ≠ node score (N ${SB.N}/${S.N}; T ${dT}; A ${dA}; shots ${dS})`);
    else ok.push(`contract: browser path (window.TIMING / CLIPS) = node path — N ${S.N}, ${Object.keys(S.T).length} T, ${Object.keys(S.A).length} A, ${S.shots.length} shots`);
  }
  const rm = fs.readFileSync(path.join(P, 'overlay', 'render.mjs'), 'utf8');
  if (!/data\/timing\.json/.test(rm) || !/TIMING:/.test(rm)) err.push('contract: render.mjs does not inject data/timing.json as window.TIMING');
}
// ---------- narrator (SERIE §3.12-3): a take per line, ≤ 3,2 syl/s as played, inside its budget, pauses ≥ ,35 s, never
//            over another voice (SCORE.check() lists every breach; its first lines are notes) ----------
{
  const NW = S.check().filter(m => !/^(narrator takes|real voice):/.test(m));
  for (const m of NW) err.push('narrator: ' + m);
  if (!NW.length) ok.push('narrator: ' + S.narration().map(n => `${n.id} ${n.t.toFixed(2)}–${n.end.toFixed(2)} ${n.sps.toFixed(2)} syl/s (${n.file || 'no take'})`).join(' · ') + ' — ≤ 3,2 syl/s, in budget, no overlap');
}
// ---------- outputs ----------
const AUD = S.VARIANT === 'main' ? 'audio' : `audio_${S.VARIANT}`;
if (!args.includes('--no-outputs')) {
  const TLF = S.VARIANT === 'main' ? 'timeline.json' : `timeline_${S.VARIANT}.json`, TL = readJ(path.join(P, 'data', TLF));
  if (!TL || TL.frames !== S.N) warn.push(`outputs: data/${TLF} frames ${TL && TL.frames} ≠ N ${S.N} (render.mjs rewrites it)`);
  const CU = readJ(path.join(P, AUD, 'score_cues.json'));
  if (!CU) err.push(`outputs: ${AUD}/score_cues.json missing: run python3 lib/mix.py`);
  else {
    const dT = Object.keys(S.T).filter(k => !(k in CU.T) || !eq(S.T[k], CU.T[k], 1e-4)), dA = Object.keys(S.A).filter(k => !(k in CU.A) || !eq(S.A[k], CU.A[k], 1e-4));
    const sameV = JSON.stringify(S.voices()) === JSON.stringify(CU.voices), sameC = JSON.stringify(S.soundCues()) === JSON.stringify(CU.cues);
    const sameM = JSON.stringify(S.music()) === JSON.stringify(CU.music), sameAmb = JSON.stringify(S.ambience()) === JSON.stringify(CU.amb);
    const sameN = JSON.stringify(S.narration()) === JSON.stringify(CU.narr);
    if (dT.length || dA.length || !sameV || !sameN || !sameC || !sameM || !sameAmb || CU.variant !== S.VARIANT)
      err.push(`outputs: ${AUD}/mix.wav was built on another score (T ${dT} · A ${dA} · voices ${sameV} · narrator ${sameN} · cues ${sameC} · music ${sameM} · amb ${sameAmb}): re-run lib/mix.py`);
    else ok.push(`outputs: ${AUD}/mix.wav built on this very score (score_cues.json = the live T, A, voices, narrator, ambience, cues, music)`);
  }
  try {
    const b = fs.readFileSync(path.join(P, AUD, 'mix.wav')); let o = 12, sr = 0, ch = 0, bits = 0, len = 0;
    while (o < b.length - 8) { const id = b.toString('ascii', o, o + 4), z = b.readUInt32LE(o + 4); if (id === 'fmt ') { ch = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); } if (id === 'data') { len = z; break; } o += 8 + z + (z & 1); }
    const d = len / (ch * bits / 8) / sr;
    if (Math.abs(d - S.T.end) > 2 / sr || sr !== 48000 || ch !== 2) err.push(`outputs: ${AUD}/mix.wav ${d.toFixed(4)} s @ ${sr} Hz × ${ch} ≠ T.end ${S.T.end} s, 48 kHz stereo`);
    else ok.push(`outputs: ${AUD}/mix.wav = ${d.toFixed(4)} s = T.end, 48 kHz stereo ${bits}-bit`);
  } catch (e) { err.push(`outputs: ${AUD}/mix.wav not readable (python3 lib/mix.py)`); }
  const MR = readJ(path.join(P, AUD, 'mix_report.json'));
  if (MR) {
    if (Math.abs(MR.lufs + 14) > .5) err.push(`outputs: mix ${MR.lufs} LUFS (target −14)`);
    if (MR.tp_dbtp > -1 + 1e-6) err.push(`outputs: mix true peak ${MR.tp_dbtp} dBTP > −1`);
    if (!MR.voice_ok) err.push('outputs: the real voice was altered (sample count or x-corr lag ≠ 0)');
    if (MR.overlaps && MR.overlaps.length) err.push(`outputs: voices overlap in the mix: ${MR.overlaps}`);
    if (MR.tail_only_amb === false) err.push('outputs: the last 0,30 s are not the ambience alone');
    for (const v of MR.voice_over_rest || []) if (v.margin_db < 4) warn.push(`outputs: real voice ${v.id} only ${v.margin_db} dB over the rest of the mix (aim ≥ 6)`);
    if (Math.abs(MR.lufs + 14) <= .5 && MR.tp_dbtp <= -1 + 1e-6) ok.push(`outputs: ${MR.lufs} LUFS, TP ${MR.tp_dbtp} dBTP, real voice untouched ${MR.voice_ok}`);
  } else err.push(`outputs: ${AUD}/mix_report.json missing`);
  const LR = readJ(path.join(P, AUD, 'listen_report.json'));
  if (!LR) warn.push(`outputs: no ${AUD}/listen_report.json (python3 tools/listen_test.py ${AUD})`);
  else if (fs.statSync(path.join(P, AUD, 'listen_report.json')).mtimeMs < fs.statSync(path.join(P, AUD, 'mix.wav')).mtimeMs) err.push(`outputs: ${AUD}/listen_report.json is older than the mix: re-run tools/listen_test.py`);
  else if (!LR.pass_) err.push(`outputs: listen test FAILED (${JSON.stringify(LR.totals)}; ≥ 90 % each)`);
  else ok.push(`outputs: listen test (phone band ${LR.band.join('–')} Hz, faster-whisper ${LR.model}): ${Object.entries(LR.totals).map(([k, v]) => k + ' ' + v + ' %').join(' · ')}`);
  const VE = readJ(path.join(P, 'data', 'voice_env.json'));
  for (const v of S.voices()) { const e = VE && VE.voices && VE.voices[v.id]; if (!e || e.clip !== v.clip || !eq(e.in, v.in) || !eq(e.out, v.out)) warn.push(`outputs: data/voice_env.json has no envelope for ${v.id} as played (python3 tools/voice_env.py): the waveform idles`); }
}
console.log(`QA — ${path.basename(P)} · variant ${S.VARIANT} · T.end ${S.T.end} s · N ${S.N} frames · ${S.shots.length} shots`);
for (const m of ok) console.log('  ok    ' + m);
for (const m of warn) console.log('  WARN  ' + m);
for (const m of err) console.log('  ERROR ' + m);
console.log(err.length ? `FAILED: ${err.length} error(s), ${warn.length} warning(s)` : `PASSED (${warn.length} warning(s))`);
process.exit(err.length ? 1 : 0);

// tools/audit.js — the checks shared by tools/check_score.js (prints everything) and tools/qa.js (strict, exit code).
// audit({mb}) → {ok: [], warn: [], err: [], S (the score), frames (needed frame set)}
//   picture   EDL.audit: every crop window inside its source (rotation included; clamping reported), must-hide regions out
//             of frame or covered by the union of hide boxes at every 1/60 s, no black hole in the 9×16 screen grid, source
//             times inside the clips; transitions without a partner listed
//   frames    every footage frame the render needs (all shutter sub-samples at --mb, transitions and split screens
//             included) exists in assets/clips/<clip>/f_NNNN.jpg
//   voices    real-voice speech spans never overlap; each segment inside its clip; data/timing.json cut for these very
//             segments (seg = {clip, in, out}); each 'sub' text names a voice and covers its speech
//   type      safe zones on every text box (nothing above y 150; no text right of x 960 for y 900–1560; nothing below
//             y 1540), violet only on Bonzini words, holds ≥ SCORE.QA.minHold (1.0 s), ≤ 3 text blocks + the mention
//   hygiene   no Math.random, no ctx.filter in the scenes
const fs = require('fs'), path = require('path');
const P = path.resolve(__dirname, '..'), SC = path.join(P, 'overlay', 'scenes');
const f3 = x => (+x).toFixed(3);
function audit(o = {}) {
  const mb = o.mb || 6, ok = [], warn = [], err = [];
  const S = require(path.join(SC, '01_score.js'));
  const { T, A, G, N, FPS } = S;
  // ---------- picture ----------
  const a = S.audit(N);
  for (const m of a.err) err.push('picture: ' + m); for (const m of a.warn) warn.push('picture: ' + m);
  if (!a.err.length) ok.push(`picture: ${S.shots.length} shots — crops inside the sources, must-hide regions out of frame or covered, transitions linked`);
  for (const m of a.info) if (/without a partner/.test(m)) ok.push('picture: ' + m);
  // ---------- stickers (SERIE §3.12-1): the dilated masks of v1–v3 against every visible crop window, at every
  //            motion-blur sub-sample of every frame (glides and their overshoot included) → 0 pixel ----------
  const MK = (() => { try { return JSON.parse(fs.readFileSync(path.join(P, 'data', 'masks.json'), 'utf8')); } catch (e) { return null; } })();
  if (!MK) err.push('stickers: data/masks.json missing (python3 tools/masks.py)');
  else {
    const clips = (S.QA && S.QA.masks) || Object.keys(MK.clips), rows = {};
    for (const c of clips) { const M = MK.clips[c]; if (!M) continue; rows[c] = []; for (const y in M.rows) rows[c][+y] = M.rows[y]; }
    const count = (c, cx, cy, w, h) => {                 // mask pixels whose square [x, x+1) × [y, y+1) meets the window
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, R = rows[c]; let k = 0;
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(R.length, Math.ceil(y1)); y++) { const r = R[y]; if (!r) continue;
        for (const [a, b] of r) { const lo = Math.max(a, Math.floor(x0)), hi = Math.min(b, Math.ceil(x1)); if (hi > lo) k += hi - lo; } }
      return k;
    };
    let worst = null, nck = 0; const per = {};
    for (let n = 0; n < N; n++) for (const t of S.shutter(n, mb)) for (const q of S.active(t)) {
      const c = q.shot.clip; if (!rows[c]) continue;
      const cw = q.crop.w / (q.fx.sc || 1), ch = q.crop.h / (q.fx.sc || 1);       // a zoom-out (sc < 1) would show more: count it
      const k = count(c, q.crop.cx, q.crop.cy, Math.max(q.crop.w, cw), Math.max(q.crop.h, ch)); nck++;
      const id = q.shot.id; per[id] = per[id] || { n: 0, y0: 1e9, y1: -1e9, x0: 1e9, x1: -1e9 };
      const P_ = per[id]; P_.n++; P_.y0 = Math.min(P_.y0, q.crop.cy - q.crop.h / 2); P_.y1 = Math.max(P_.y1, q.crop.cy + q.crop.h / 2); P_.x0 = Math.min(P_.x0, q.crop.cx - q.crop.w / 2); P_.x1 = Math.max(P_.x1, q.crop.cx + q.crop.w / 2);
      if (k > 0 && (!worst || k > worst.k)) worst = { k, id, c, t, n };
    }
    const ext = Object.entries(per).map(([id, p]) => `${id} x ${p.x0.toFixed(0)}–${p.x1.toFixed(0)} y ${p.y0.toFixed(0)}–${p.y1.toFixed(0)}`).join(' · ');
    if (worst) err.push(`stickers: ${worst.k} mask pixel(s) of ${worst.c} visible in ${worst.id} at t ${f3(worst.t)} (frame ${worst.n}) — ${ext}`);
    else ok.push(`stickers: 0 mask pixel (dilated ${MK.dilate} px) in ${nck} crop windows of v1–v3 (every sub-sample at --mb ${mb}) — source extents: ${ext}`);
  }
  // ---------- baked blurs: the prepared frames carry the current hides and grade ----------
  const HJ = (() => { try { return JSON.parse(fs.readFileSync(path.join(P, 'data', 'hides.json'), 'utf8')); } catch (e) { return null; } })();
  for (const c of new Set(S.shots.map(s => s.clip))) {
    let meta = null; try { meta = JSON.parse(fs.readFileSync(path.join(P, 'assets', 'clips', c, 'meta.json'), 'utf8')); } catch (e) { continue; }
    const want = HJ && HJ.sig && HJ.sig[c] ? HJ.sig[c] : null;
    if ((want || meta.hides_sig) && meta.hides_sig !== want) err.push(`blurs: assets/clips/${c} was baked with other hide boxes (${meta.hides_sig} ≠ ${want}): python3 tools/prep_clips.py --score`);
    const g = S.BAKE && S.BAKE.of ? S.BAKE[S.BAKE.of(c)] : null;
    if (g && JSON.stringify(meta.grade) !== JSON.stringify(g)) err.push(`grade: assets/clips/${c} baked with ${JSON.stringify(meta.grade)} ≠ ${JSON.stringify(g)}`);
  }
  if (HJ) ok.push(`blurs: ${Object.values(HJ.hide).reduce((m, L) => m + L.length, 0)} gaussian hides baked (${Object.entries(HJ.hide).map(([c, L]) => c + ' ' + L.map(h => h.name).join('/')).join(' · ')})`);
  // ---------- frames on disk ----------
  const FSET = S.frameSet(N, mb); let need = 0, miss = [];
  for (const [clip, set] of Object.entries(FSET)) for (const f of set) { need++; if (!fs.existsSync(path.join(P, 'assets', 'clips', clip, `f_${String(f).padStart(4, '0')}.jpg`))) miss.push(`${clip}/${f}`); }
  if (miss.length) err.push(`frames: ${miss.length}/${need} footage frames missing on disk (first ${miss.slice(0, 6).join(' ')}): python3 tools/prep_clips.py --score`);
  else ok.push(`frames: all ${need} footage frames the render needs (--mb ${mb}) are on disk (${Object.entries(FSET).map(([c, s]) => `${c} ${s.size}`).join(' · ')})`);
  // ---------- voices ----------
  const V = S.voices(), TM = (() => { try { return JSON.parse(fs.readFileSync(path.join(P, 'data', 'timing.json'), 'utf8')); } catch (e) { return null; } })();
  const sp = V.map(v => [v.speech[0], v.speech[1], v.id]).sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < sp.length; i++) if (sp[i][0] < sp[i - 1][1] - 1e-6) err.push(`voices: ${sp[i - 1][2]} (→ ${f3(sp[i - 1][1])}) and ${sp[i][2]} (${f3(sp[i][0])} →) overlap`);
  for (const v of V) {
    const c = S.CLIPS[v.clip];
    if (!c || v.in < 0 || v.out > c.dur + 1e-6 || v.out <= v.in) err.push(`voices: ${v.id} ${v.clip} ${v.in}–${v.out} outside the clip (${c ? c.dur : '?'} s)`);
    const sg = TM && TM.seg && TM.seg[v.id];
    if (!sg) err.push(`voices: ${v.id} has no words in data/timing.json (python3 tools/voice_words.py --score)`);
    else if (sg.clip !== v.clip || Math.abs(sg.in - v.in) > 1e-6 || Math.abs(sg.out - v.out) > 1e-6) err.push(`voices: data/timing.json cut ${v.id} on ${sg.clip} ${sg.in}–${sg.out}, the score plays ${v.clip} ${v.in}–${v.out}: re-run tools/voice_words.py --score`);
    if (v.t < 0 || v.end > T.end + 1e-6) err.push(`voices: ${v.id} placed ${f3(v.t)}–${f3(v.end)} outside the film`);
  }
  if (V.length) ok.push('voices: ' + sp.map(x => `${x[2]} speech ${f3(x[0])}–${f3(x[1])}`).join(' · ') + ' — no overlap');
  const TX = S.TEXTS();
  for (const q of TX.filter(q => q[4] === 'sub' || q[4] === 'sub2')) {
    const opt = q[6] || {}, v = V.find(v => v.id === opt.voice);
    if (!v) { err.push(`type: subtitle ${q[2]} names no voice (opt.voice)`); continue; }
    const sp_ = opt.covers || v.speech;
    if (q[0] > sp_[0] + .10 || q[1] < sp_[1]) warn.push(`type: subtitle ${q[2]} ${f3(q[0])}–${f3(q[1])} does not cover ${v.id}'s speech ${f3(sp_[0])}–${f3(sp_[1])}`);
  }
  // ---------- type ----------
  const sz = G.safe || { top: 150, bottom: 1540, rightX: 960, rightY0: 900, rightY1: 1560 };
  const DFLT = { mention: G.mention, title: G.title, sub: G.sub, cta: G.pill, stamp: G.stamp, label: G.labTop };
  const VIOLET = ((S.COL && S.COL.violet) || '#A947FE').toUpperCase(), VIOLETS = [VIOLET, ((S.COL && S.COL.violetD) || '#7B22D6').toUpperCase()];
  let zones = 0;
  for (const q of TX) {
    const [t0, t1, id, s, st, own, opt = {}] = q, b = opt.box || DFLT[st];
    if (!b) { if (!own) warn.push(`type: ${id} (${st}) has no box: its safe zone cannot be audited`); continue; }
    if (b.y0 < sz.top) err.push(`type: ${id} box y0 ${b.y0} < ${sz.top}`);
    if (b.y1 > sz.bottom) err.push(`type: ${id} box y1 ${b.y1} > ${sz.bottom}`);
    if (b.x1 > sz.rightX && b.y1 > sz.rightY0 && b.y0 < sz.rightY1) err.push(`type: ${id} box x1 ${b.x1} > ${sz.rightX} within y ${sz.rightY0}–${sz.rightY1}`);
    zones++;
    for (const k of ['ecol', 'accent', 'color', 'fill']) if (opt[k] && VIOLETS.includes(String(opt[k]).toUpperCase()) && !/bonzini/i.test(s)) err.push(`type: ${id} uses violet (${k}) on « ${s} »: violet is for Bonzini only`);
    if (/\*/.test(s) && st === 'sub' && !/\*[^*]*bonzini[^*]*\*/i.test(s)) warn.push(`type: ${id}: subtitle emphasis is violet (60_type.js) — only on Bonzini words`);
  }
  ok.push(`type: ${zones} text boxes inside the safe zones (y ≥ ${sz.top}, ≤ ${sz.bottom}, x ≤ ${sz.rightX} for y ${sz.rightY0}–${sz.rightY1}); violet only with Bonzini`);
  const minHold = (S.QA && S.QA.minHold) || 1.0;
  for (const q of TX) { const d = Math.min(q[1], T.end) - Math.max(0, q[0]); if (!['mention'].includes(q[4]) && d < minHold - 1e-6) warn.push(`type: ${q[2]} held ${d.toFixed(2)} s < ${minHold}`); }
  const NOTB = (S.QA && S.QA.notBlocks) || ['mention'];
  let maxB = 0, at = 0;
  for (let n = 0; n < N; n++) { const t = n / FPS, k = TX.filter(q => !NOTB.includes(q[4]) && t >= q[0] && t < q[1]).length; if (k > maxB) { maxB = k; at = t; } }
  (maxB > 3 ? warn : ok).push(`type: at most ${maxB} text blocks + the mention at once (at ${f3(at)})`);
  // ---------- hygiene ----------
  for (const f of fs.readdirSync(SC).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(SC, f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/Math\.random\s*\(/.test(src)) err.push(`hygiene: ${f} uses Math.random`);
    if (/\.filter\s*=(?!=)(?!\s*['"`]none['"`])/.test(src)) err.push(`hygiene: ${f} sets ctx.filter`);
  }
  ok.push('hygiene: no Math.random, no ctx.filter in the scenes');
  return { ok, warn, err, S, FSET, TM };
}
module.exports = { audit, P };

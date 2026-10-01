'use strict';
// =============================================================================================
// 14_badge — the team-voice badge « L’équipe Bonzini · sur place » (final_storyboard §1.6). Package f1.
// Automatic from the Q segments: pops 0.3 s before each quote (Q1: on V06·équipe − 0.3, §3 s4 4.8), stays across
// gaps < 1.0 s, leaves 0.3 s after the quote. Waveform = the REAL RMS of the quote (window.Q_RMS, 15_qrms.js).
// Hooks: hp_badgePos(ch, x, y) · hp_badgeEarliest(qId, t) · hp_badgeAt(qId, t) (exact pop) — t may be a function.
// =============================================================================================
const HP_BADGE_Q = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
const _bdPos = {}, _bdEarly = {}, _bdAt = {};
let _bdC = null;
function hp_badgePos(ch, x, y) { _bdPos[ch] = [x, y]; _bdC = null; }
function hp_badgeEarliest(qId, t) { _bdEarly[qId] = t; _bdC = null; }
// added by f1: force the pop time of the run that starts with qId
function hp_badgeAt(qId, t) { _bdAt[qId] = t; _bdC = null; }

/** life-cycle runs [{pop, leave, qs:[{id,start,end}], ch, pos}] */
function f1_badgeRuns() {
  if (_bdC) return _bdC;
  const qs = HP_BADGE_Q.map(id => { const s = TL.seg(id); return { id, start: s.start, end: s.end }; }).filter(q => q.start < 1e4);
  const runs = [];
  for (const q of qs) {
    const last = runs[runs.length - 1];
    if (last && q.start - last.qs[last.qs.length - 1].end < 1.0) { last.qs.push(q); continue; }
    let popT = q.id === 'Q1' && TL.word('V06', 'équipe') ? W_('V06', 'équipe') - .3 : q.start - .3;
    if (_bdAt[q.id] != null) popT = f1_val(_bdAt[q.id]);
    if (_bdEarly[q.id] != null) popT = Math.max(popT, f1_val(_bdEarly[q.id]));
    runs.push({ pop: popT, qs: [q] });
  }
  for (const r of runs) {
    r.leave = r.qs[r.qs.length - 1].end + .3;
    const c = TLD.chapters.find(c => r.pop >= c.start && r.pop < c.end) || TLD.chapters[TLD.chapters.length - 1];
    r.ch = c.id; r.pos = _bdPos[c.id] || (c.id === 'outro' ? [380, 270] : [380, 380]);
  }
  return (_bdC = runs);
}
/** 6 bar heights 0..1 at frame n: live RMS (scrolling history, newest right) or flat .18 */
function f1_badgeBars(t, n, run) {
  const q = run.qs.find(q => t >= q.start && t < q.end), out = [];
  const arr = q && window.Q_RMS && window.Q_RMS[q.id];
  if (!arr) { for (let i = 0; i < 6; i++) out.push(.18); return { bars: out, live: false }; }
  const f = Math.floor((n - Math.round(q.start * FPS)) / 2) * 2;
  for (let i = 0; i < 6; i++) {
    const idx = clamp(f - (5 - i) * 2, 0, arr.length - 1), v = Math.max(arr[idx] || 0, arr[Math.max(0, idx - 1)] || 0);
    out.push(Math.max(.18, v * (.82 + .18 * rnd(i * 7.3 + f * 1.7))));
  }
  return { bars: out, live: true };
}
/** draw the badge centred at (0,0) (call inside at()); o {bars:[6], pinK 0..1, lift} */
function hp_badge(o = {}) {
  const f1 = font(FF.body, 46, 800), f2 = font(FF.hand, 44, 700), l1 = 'L’équipe Bonzini', l2 = 'sur place';
  const tx = 150, tw = Math.max(measure(l1, f1), measure(l2, f2)), w = tx + tw + 30 + 5 * 13 + 8 + 30, h = 124, x0 = -w / 2, y0 = -h / 2;
  withShadow(o.lift ?? 10, () => { ctx.fillStyle = C.kraftD; rrect(x0, y0, w, h, 18); ctx.fill(); });
  ctx.fillStyle = TEX.kraft || C.kraft; rrect(x0, y0, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,.38)'; ctx.lineWidth = 2; rrect(x0 + 6, y0 + 6, w - 12, h - 12, 14); ctx.stroke();
  ctx.save(); rrect(x0, y0, w, h, 18); ctx.clip(); const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(255,240,210,.12)'); g.addColorStop(1, 'rgba(90,60,30,.12)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h); ctx.restore();
  // mic disc (ink) with a cream microphone
  const mx = x0 + 96;
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(mx, 0, 40, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.arc(mx - 8, -10, 24, 0, 7); ctx.fill();
  ctx.fillStyle = C.cream; rrect(mx - 10, -25, 20, 33, 10); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; for (const yy of [-16, -9, -2]) { ctx.beginPath(); ctx.moveTo(mx - 6, yy); ctx.lineTo(mx + 6, yy); ctx.stroke(); }
  ctx.strokeStyle = C.cream; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(mx, -2, 16, .12 * Math.PI, .88 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, 14); ctx.lineTo(mx, 24); ctx.moveTo(mx - 9, 25); ctx.lineTo(mx + 9, 25); ctx.stroke();
  text(l1, x0 + tx, -6, { font: f1, color: C.ink });
  text(l2, x0 + tx, 42, { font: f2, color: C.violetD });
  // waveform
  const bars = o.bars || [.18, .18, .18, .18, .18, .18], bx = x0 + tx + tw + 30;
  ctx.fillStyle = 'rgba(60,32,12,.14)'; rrect(bx - 10, -40, 5 * 13 + 8 + 20, 80, 10); ctx.fill();
  for (let i = 0; i < 6; i++) { const a = clamp(bars[i]); ctx.fillStyle = C.violet; rrect(bx + i * 13, -a * 30, 8, a * 60, 4); ctx.fill(); }
  // orange push-pin at the left end
  const pk = o.pinK ?? 1; if (pk > 0) { const s = lerp(1.5, 1, eOutCubic(clamp(pk))); at(x0 + 30, -26, 0, s, s, () => pushPin(0, 0, C.orange)); }
  return { w, h };
}
/** current badge transform: {x, y, k, lift, alpha, run} | null — e.g. to keep other paper clear of it */
function hp_badgeState(t) {
  if (!TLD) return null;
  for (const r of f1_badgeRuns()) {
    if (t < r.pop || t > r.leave + .25) continue;
    const ts = f1_twos(t), kin = clamp(pop(ts, r.pop, 16, .42), 0, 1.2), ko = prog(t, r.leave, r.leave + .25);
    const d = drift(t, 11, 2);
    return { x: r.pos[0] + d.x, y: r.pos[1] + d.y - 40 * eInCubic(ko), k: kin, lift: 10 + 20 * ko, alpha: 1 - ko, pinK: prog(ts, r.pop + .1, r.pop + .2), run: r };
  }
  return null;
}

(() => {
  registerScene({
    id: 'badge', z: 65,
    draw(t, n) {
      if (!TLD) return;
      for (const r of f1_badgeRuns()) { hp_sfx('pin_click', r.pop + .1); hp_sfx('mic_tap', r.pop + .2); }
      const B = hp_badgeState(t); if (!B || B.k <= 0 || B.alpha <= 0) return;
      const { bars } = f1_badgeBars(t, n, B.run), s = .6 + .4 * B.k;
      ctx.save(); ctx.globalAlpha *= B.alpha * clamp(B.k * 3);
      at(B.x, B.y, -.03, s, s, () => hp_badge({ bars, pinK: B.pinK, lift: B.lift }));
      ctx.restore();
    },
  });
})();

// =============================================================================================================
// P4 – P8 · LUNDI (S5 – S9) — « la vraie note de Christelle » : droit → accises → TVA → selon votre situation
//   P4  wide shot at the hair-extensions stall (Nadège N1 front left, Boris B1 + box behind the counter, Christelle C2
//       behind her counter, Junior walks in J5 → J1); push into the kraft note pinned on the post (written on the voice);
//       the margouillat on the top edge of the note puffs its throat on « droit de douane »
//   P5  split panel: Junior's sneakers | Christelle's mèches (accises), kraft band « 2 · ACCISES » across the bottom
//   P6  close: Christelle (C4) reads her receipt, our kraft note continues it down to the floor in loops; violet TVA film;
//       Boris (box + tag) behind the counter, the margouillat puffed on a wig head
//   P7  two-shot, push into Nadège's phone (screen card in two columns), back to the two-shot for the two balloons
//   P8  close on Christelle and her note: ochre stamp « À L'IGS … », insert: her hand rewrites a wig price tag
// BG3 (bg/etal_meches) is a wall of hanging goods without a floor or a counter: both are drawn here (one floor line FY,
// one scale for the cast: Junior = 820 stage units, i.e. a head about the size of the hats on the shelf).
// Everything is wrapped in an IIFE (all scene files share one global scope). Times come from the voice timeline only.
// =============================================================================================================
(() => {
  'use strict';
  const G = GRADE.shade;                                        // stall shade (covered market, daylight)
  const GB = { mul: '#D9D0C3', tint: '#FFD9A0', tintA: .05 };   // the same light, one step back (slightly dimmer)
  const GDAY = { mul: '#F6EEE2', tint: '#FFD9A0', tintA: .06 };  // open-air sneaker stall (sun, P5 left panel)
  const PHC = 0, PHJ = 2.1, PHN = 4.3, PHB = 5.7;              // breathing phases: Christelle, Junior, Nadège, Boris
  const OCHRE = '#B8740F', VIO = '#6A22C9', RUST = '#8A3A12';
  const HJ = 820, HC = HJ * .98, HN = HJ, HB = HJ * .96;        // relative heights Junior 1 · Christelle .98 · Nadège 1 · Boris .96
  const FY = 1630;                                              // drawn floor line on BG3 (front feet ≈ 1745)
  const pxH = (key, h) => { const a = img('cast/junior_1'), b = img(key); return a && b ? h * b.height / a.height : h; };

  // ---------- small helpers ---------------------------------------------------------------------------------------
  const WR = (txt, x, y, t, t0, dur, o) => (t0 == null ? 0 : writeOn(txt, x, y, t, t0, dur, o));
  function fitSize(txt, fam, size, maxW, min = 10) { let s = size; while (s > min && measure(txt, font(fam, s, 400)) > maxW) s -= .5; return s; }
  function arrowInk(x0, y0, x1, y1, o = {}) {
    inkLine(x0, y0, x1, y1, o); const a = Math.atan2(y1 - y0, x1 - x0), L = o.head || 14;
    inkLine(x1, y1, x1 - Math.cos(a - .5) * L, y1 - Math.sin(a - .5) * L, o); inkLine(x1, y1, x1 - Math.cos(a + .5) * L, y1 - Math.sin(a + .5) * L, o);
  }
  /** text that starts with a drawn arrow « → … » (no glyph fallback): arrow then the words */
  function arrowText(txt, x, y, t, t0, dur, o) {
    if (t0 == null || t < t0) return; const s = o.size || 44, k = clamp((t - t0) / Math.max(.01, dur * .25));
    if (k > 0) arrowInk(x, y - s * .32, x + s * .9 * k, y - s * .32, { w: s * .09, color: o.color || BD.ink, seed: 5, head: s * .28 });
    WR(txt, x + s * 1.15, y, t, t0 + dur * .2, dur * .8, o);
  }
  /** pose change: the new pose is drawn, the old one on top fading out */
  function pupSwitch(a, b, ts, x, y, h, o, fade = .18, ha = h) {
    const t = o.t; if (t < ts) { drawPuppet(a, x, y, ha, o); return; }
    drawPuppet(b, x, y, h, o);
    const k = clamp((t - ts) / fade); if (k < 1) drawPuppet(a, x, y, ha, Object.assign({}, o, { a: (o.a ?? 1) * (1 - k), shadow: false }));
  }
  /** cancel the procedural arm gesture of a rig (an arm that holds something must stay still) */
  function noGesture(key, t, ph, talk) {
    const R = RIGS[key], rot = {}; if (!R || !R.gesture) return rot;
    for (const [bn, amp, fr] of R.gesture) rot[bn] = -(Math.sin(t * fr + ph) * .6 + Math.sin(t * fr * 1.9 + ph) * .4) * amp * (talk ? 2.2 : .6);
    return rot;
  }
  /** mouth of a puppet in stage units (for balloon tails) */
  function mouthOf(key, x, y, h, flip) {
    const R = RIGS[key]; if (!R || !R.face) return [x + (flip ? -1 : 1) * h * .02, y - h * .86];
    const s = h / R.h, m = R.face.mouth; return [x + (flip ? -1 : 1) * (m[0] - R.w / 2) * s, y - h + m[1] * s];
  }
  // --- the procedural pose drawPuppet applies (same formulas), so that a prop can follow a hand -----------------------
  function pupRot(R, o) {
    const t = o.t ?? 0, ph = o.phase ?? 0, talk = o.talk || 0, E = o.energy ?? 1, beat = talk ? Math.sin(t * 5.1 + ph) : 0;
    const rot = Object.assign({}, o.rot || {});
    rot.chest = (rot.chest || 0) + Math.sin(t * 1.9 + ph) * .018 * E + Math.sin(t * .7 + ph) * .02 * E + (o.lean || 0) + beat * .025 * talk * E;
    rot.hips = (rot.hips || 0) + Math.sin(t * .7 + ph + 1) * .008 * E;
    rot.head = (rot.head || 0) + Math.sin(t * 1.1 + ph * 2) * .04 * E + (talk ? (Math.sin(t * 6.3 + ph) * .06 + Math.sin(t * 2.7) * .04) * talk * E : 0);
    if (R.gesture) for (const [bn, amp, fr] of R.gesture) rot[bn] = (rot[bn] || 0) + (Math.sin(t * fr + ph) * .6 + Math.sin(t * fr * 1.9 + ph) * .4) * amp * (talk ? 2.2 : .6) * E;
    return rot;
  }
  /** stage position of an image point p (rig px) carried by bone bn, with the same procedural pose as drawPuppet */
  function pupPt(key, x, y, h, o, p, bn) {
    const R = RIGS[key], dir = o.flip ? -1 : 1; if (!R) return { x, y: y - h * .8 };
    const M = boneMats(R, pupRot(R, o), o.off || {}), q = M[bn] ? aff.ap(M[bn], p) : p, s = h / R.h;
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - h + q[1] * s };
  }
  /** walk rotations locked to the distance travelled (no foot sliding): stride ≈ .45 h per cycle */
  function walkRot(dist, h, A) {
    const wp = dist / (h * .45) * Math.PI * 2;
    return { rot: { legL: Math.sin(wp) * .34 * A, legR: -Math.sin(wp) * .34 * A, shinL: Math.max(0, -Math.sin(wp + .5)) * .5 * A,
      shinR: Math.max(0, Math.sin(wp + .5)) * .5 * A, armL_up: -Math.sin(wp) * .28 * A, armR_up: Math.sin(wp) * .28 * A, chest: .03 * A },
      bob: Math.abs(Math.cos(wp)) * .014 * A };
  }
  // ---------- BD marks (drawn emotion: the pictures are limited) ---------------------------------------------------
  /** surprise lines: short radiating ink strokes around (x, y), radius r; k 0..1 grows them, a fades them */
  function surprise(x, y, r, k, seed = 1, n = 5, a = 1, o = {}) {
    if (k <= 0 || a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const an = -Math.PI * (.1 + .8 * i / (n - 1)), r0 = r * (1 + .08 * hash(seed + i)), L = r * (.3 + .1 * hash(i + seed * 3)) * eOutCubic(clamp(k));
      inkLine(x + Math.cos(an) * r0, y + Math.sin(an) * r0, x + Math.cos(an) * (r0 + L), y + Math.sin(an) * (r0 + L), { w: o.w || 3.2, seed: seed + i, step: 30 }); }
    ctx.restore();
  }
  /** a small start (shock jolt) in stage units: the whole Christelle + her note move together (a full hop would tear
   *  the figure away from the note she holds) */
  const jolt = (t, t0, amp) => { const u = (t - t0) / .42; return u > 0 && u < 1 ? Math.sin(u * Math.PI) * amp * (1 - u * .3) : 0; };
  /** sweat drop (light blue, ink outline) that slides a little */
  function sweatDrop(x, y, s, k) {
    if (k <= 0) return; ctx.save(); ctx.translate(x, y + k * 10 * s); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 4) * clamp((1 - k) * 4);
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.bezierCurveTo(7, -4, 10, 4, 0, 10); ctx.bezierCurveTo(-10, 4, -7, -4, 0, -16); ctx.closePath();
    ctx.fillStyle = '#BFE6FF'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(-2.5, 1, 2, 3.5, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  // ---------- Boris' box tag « PAS AVANT SAMEDI » (two lines, so it stays the size of a tag on his small box) -------
  // box front face on boris_1/3/5 (measured): centre x = +0.091·h (unflipped), y = 0.35·h … 0.46·h below the top
  const BOX = { dx: .091, y0: .35, y1: .46 };
  /** (x, y) = attachment point of the string; s = scale (tag body 104 × 66 tag units) */
  function boxTag(t, x, y, s, o = {}) {
    const sw = (o.rot ?? -.05) + Math.sin(t * 1.7 + 1.3) * .045 + Math.sin(t * 3.1) * .012, L = o.string ?? 16;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw); ctx.scale(s, s);
    inkLine(0, 0, 0, L + 6, { w: 2.2, color: '#6B4A2A', seed: 60, step: 10 });
    const w = 104, h = 66, c = 12, y0 = L;
    const shape = () => { ctx.beginPath(); ctx.moveTo(-w / 2 + c, y0); ctx.lineTo(w / 2 - c, y0); ctx.lineTo(w / 2, y0 + c); ctx.lineTo(w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + h); ctx.lineTo(-w / 2, y0 + c); ctx.closePath(); };
    withShadow(4, () => { ctx.fillStyle = '#FFF3D2'; shape(); ctx.fill(); });
    ctx.lineWidth = 2.6; ctx.strokeStyle = BD.ink; shape(); ctx.stroke();
    inkCircle(0, y0 + 9, 4, { w: 1.8, fill: '#E9D9B8', seed: 62 });
    text('PAS AVANT', 0, y0 + 34, { font: font(FF.brush, 23, 400), align: 'center', color: BD.red });
    text('SAMEDI', 0, y0 + 59, { font: font(FF.brush, 27, 400), align: 'center', color: BD.red });
    ctx.restore();
  }

  // ---------- stall set (drawn the same way in every Monday shot) --------------------------------------------------
  /** packed-earth floor under the hanging goods (BG3 has none): ragged top edge where the hems meet the ground */
  function stallFloor() {
    const top = x => FY + Math.sin(x * .031) * 4 + (hash(Math.floor(x / 23) + 7) - .5) * 8;
    ctx.save();
    const path = () => { ctx.beginPath(); ctx.moveTo(-80, 1830); for (let x = -80; x <= 1080; x += 20) ctx.lineTo(x, top(x)); ctx.lineTo(1080, 1830); ctx.closePath(); };
    const g = ctx.createLinearGradient(0, FY, 0, 1778); g.addColorStop(0, '#2A1D15'); g.addColorStop(.16, '#4C3829'); g.addColorStop(.6, '#6E543F'); g.addColorStop(1, '#8B6C50');
    ctx.fillStyle = g; path(); ctx.fill();
    ctx.save(); path(); ctx.clip();
    const lg = ctx.createLinearGradient(0, 0, 1000, 0); lg.addColorStop(0, 'rgba(255,214,160,0)'); lg.addColorStop(1, 'rgba(255,214,160,.12)');
    ctx.fillStyle = lg; ctx.fillRect(-80, FY, 1160, 200);                                    // daylight from the right
    for (let i = 0; i < 16; i++) { const px = hash(i * 3.7) * 1000, py = FY + 30 + hash(i * 5.1) * 120;
      ctx.fillStyle = `rgba(255,228,190,${.05 + hash(i) * .05})`; ctx.beginPath(); ctx.ellipse(px, py, 40 + hash(i * 2.2) * 70, 6 + hash(i * 1.3) * 6, 0, 0, 7); ctx.fill(); }
    for (let i = 0; i < 9; i++) { const px = hash(i * 9.1 + 2) * 1000, py = FY + 40 + hash(i * 4.4) * 110, L = 30 + hash(i * 6.6) * 50;
      inkPath([[px, py], [px + L * .5, py + (hash(i) - .5) * 8], [px + L, py + (hash(i + 4) - .5) * 10]], { w: 1.6, color: 'rgba(30,20,14,.35)', seed: 90 + i, step: 12 }); }
    for (let i = 0; i < 26; i++) { const px = hash(i * 7.3 + 1) * 1000, py = FY + 25 + hash(i * 3.9) * 130;
      ctx.fillStyle = 'rgba(30,20,14,.35)'; ctx.beginPath(); ctx.ellipse(px, py, 2.5 + hash(i) * 2.5, 1.8 + hash(i) * 1.5, 0, 0, 7); ctx.fill(); }
    const sh = ctx.createLinearGradient(0, FY - 6, 0, FY + 46); sh.addColorStop(0, 'rgba(18,10,6,.6)'); sh.addColorStop(1, 'rgba(18,10,6,0)');
    ctx.fillStyle = sh; ctx.fillRect(-80, FY - 10, 1160, 60);                                  // contact shadow of the hems
    ctx.restore();
    inkPath(Array.from({ length: 59 }, (_, i) => [-80 + i * 20, top(-80 + i * 20)]), { w: 2, color: 'rgba(30,21,18,.5)', seed: 97, step: 40 });
    ctx.restore();
  }
  function woodPost(x, y0, y1, w) {
    ctx.save();
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#5A3418'); g.addColorStop(.38, '#A06A36'); g.addColorStop(1, '#43260F');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, y0, w, y1 - y0);
    ctx.globalAlpha = .4; for (let i = 0; i < 4; i++) { const xx = x - w / 2 + w * (.2 + i * .2); inkLine(xx, y0, xx + (hash(i + 3) - .5) * 8, y1, { w: 1.6, color: '#2E1808', seed: 40 + i, step: 50, wob: 3 }); }
    ctx.globalAlpha = 1; inkLine(x - w / 2, y0, x - w / 2, y1, { w: 4.5, seed: 51, step: 50 }); inkLine(x + w / 2, y0, x + w / 2, y1, { w: 4.5, seed: 52, step: 50 });
    ctx.fillStyle = 'rgba(18,10,6,.45)'; ctx.beginPath(); ctx.ellipse(x + 8, y1 - 2, w * .9, 9, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  function mecheBundle(x, y, len, col, seed, sway = 0) {          // a bunch of braids hanging over the counter edge
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const ox = (i - 4) * 4.4, end = x + ox * 1.5 + (hash(seed + i) - .5) * 14 + sway;
      ctx.strokeStyle = BD.ink; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.bezierCurveTo(x + ox + 8, y + len * .35, x + ox - 8 + sway * .5, y + len * .7, end, y + len); ctx.stroke();
      ctx.strokeStyle = i % 3 === 1 ? 'rgba(255,255,255,.25)' : col; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.stroke(); }
    ctx.fillStyle = BD.amber; ctx.fillRect(x - 22, y - 8, 44, 12); inkRect(x - 22, y - 8, 44, 12, { w: 2.2, seed });
    ctx.restore();
  }
  /** Christelle's counter: wooden top, blue wax cloth, braid bundles hanging over the edge; (y1 = its base on the floor) */
  function stallCounter(x0, x1, y0, y1, t, shade = 0) {
    const w = x1 - x0; ctx.save();
    ctx.fillStyle = 'rgba(18,10,6,.4)'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y1 + 4, w * .55, 16, 0, 0, 7); ctx.fill();
    const cloth = () => { ctx.beginPath(); ctx.moveTo(x0, y0 + 22); ctx.lineTo(x1, y0 + 22); for (let i = 0; i <= 12; i++) ctx.lineTo(x1 - w * i / 12, y1 - (i % 2 ? 12 : 0)); ctx.closePath(); };
    withShadow(10, () => { ctx.fillStyle = '#1D5FA8'; cloth(); ctx.fill(); });
    ctx.save(); cloth(); ctx.clip();
    for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) { const cx = x0 + 18 + c * w / 6 + (r % 2) * w / 12, cy = y0 + 70 + r * 58;
      ctx.fillStyle = '#F26A21'; ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 7); ctx.fill(); ctx.fillStyle = '#F5C542'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#123E70'; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(20,10,4,.22)'; ctx.fillRect(x0, y0 + 22, w, 44);
    const sg = ctx.createLinearGradient(x0, 0, x1, 0); sg.addColorStop(0, 'rgba(10,6,20,.28)'); sg.addColorStop(.5, 'rgba(10,6,20,0)'); sg.addColorStop(1, 'rgba(255,230,190,.08)');
    ctx.fillStyle = sg; ctx.fillRect(x0, y0, w, y1 - y0);
    if (shade) { ctx.fillStyle = `rgba(24,14,30,${shade})`; ctx.fillRect(x0, y0, w, y1 - y0); }
    ctx.restore();
    inkPath([[x0, y0 + 22], [x0, y1], [x1, y1], [x1, y0 + 22]], { w: 3.5, seed: 62 });
    withShadow(6, () => { ctx.fillStyle = '#9A6433'; ctx.fillRect(x0 - 14, y0, w + 28, 24); });
    ctx.fillStyle = 'rgba(255,230,190,.25)'; ctx.fillRect(x0 - 14, y0 + 2, w + 28, 5);
    inkRect(x0 - 14, y0, w + 28, 24, { w: 3.5, seed: 61 });
    const cols = ['#2A1A12', '#7A3B1F', '#D9A441', '#8E2A3A', '#3B2418', '#5A2E1A'], nb = Math.max(3, Math.round(w / 85));
    for (let i = 0; i < nb; i++) mecheBundle(x0 + 34 + i * (w - 68) / (nb - 1), y0 + 14, 120 + hash(i * 3.3) * 60, cols[i % cols.length], 70 + i, Math.sin(t * 1.3 + i) * 3);
    ctx.restore();
  }
  function combienIcon(x, y, s) {                                // the amber « COMBIEN » card of Part 1 (icon only)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-.12);
    withShadow(3, () => { ctx.fillStyle = BD.amber; rrect(-18, -13, 36, 26, 5); ctx.fill(); });
    inkRect(-18, -13, 36, 26, { w: 2.2, seed: 71 }); inkLine(-11, -4, 10, -4, { w: 2, seed: 72 }); inkLine(-11, 4, 4, 4, { w: 2, seed: 73 });
    ctx.restore();
  }
  function wigHead(x, y, s) {                                    // mannequin head, long dark braided wig; (x, y) = neck base
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#5A3A20'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6E4424'; ctx.fillRect(-4, -70, 8, 70); inkRect(-4, -70, 8, 70, { w: 2.2, seed: 91 });
    ctx.fillStyle = '#E9DCC4'; ctx.beginPath(); ctx.moveTo(-13, -68); ctx.lineTo(13, -68); ctx.lineTo(10, -90); ctx.lineTo(-10, -90); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -120, 27, 36, 0, 0, 7); ctx.fillStyle = '#F1E6D0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = 'rgba(160,120,80,.25)'; ctx.beginPath(); ctx.ellipse(8, -112, 12, 22, 0, 0, 7); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const side = i < 6 ? -1 : 1, k = i % 6, x0 = side * (8 + k * 4), len = 70 + k * 12;
      ctx.strokeStyle = BD.ink; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, -150); ctx.quadraticCurveTo(side * (30 + k * 3), -120, side * (24 + k * 3), -150 + len); ctx.stroke();
      ctx.strokeStyle = k % 2 ? '#3A2418' : '#24160E'; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.fillStyle = '#24160E'; ctx.beginPath(); ctx.ellipse(0, -146, 30, 16, 0, Math.PI, 0); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.restore();
    return y - 162 * s;                                          // top of the wig (where the lizard perches)
  }
  /** a wig stand standing on the floor: tripod, pole, mannequin head; returns the top of the wig */
  function wigStand(x, floorY, neckY, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(18,10,6,.4)'; ctx.beginPath(); ctx.ellipse(x + 6, floorY + 2, 62 * s, 9 * s, 0, 0, 7); ctx.fill();
    const legTop = floorY - 70 * s;
    for (const [dx, dy] of [[-52, 0], [50, 2], [10, 8]]) { ctx.strokeStyle = BD.ink; ctx.lineWidth = 9 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, legTop); ctx.lineTo(x + dx * s, floorY + dy * s); ctx.stroke();
      ctx.strokeStyle = '#6E4424'; ctx.lineWidth = 5 * s; ctx.stroke(); }
    ctx.fillStyle = '#6E4424'; ctx.fillRect(x - 5 * s, neckY, 10 * s, legTop - neckY + 4); inkRect(x - 5 * s, neckY, 10 * s, legTop - neckY + 4, { w: 2.4, seed: 93, step: 60 });
    ctx.restore();
    return wigHead(x, neckY, s);
  }
  /** outlined paper ribbon along a polyline (kraft face + ink edges) — the loops of the long note */
  function ribbon(pts, w, fill) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); };
    ctx.strokeStyle = BD.ink; ctx.lineWidth = w + 7; path(); ctx.stroke();
    ctx.strokeStyle = fill || PR.kraft; ctx.lineWidth = w; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,215,.22)'; ctx.lineWidth = w * .25; ctx.translate(-w * .12, -w * .12); path(); ctx.stroke();
    ctx.restore();
  }

  // ---------- LA VRAIE NOTE — P4 layout (pinned on the post), local units, w = 350 ------------------------------------
  // sizes chosen for the end of the push (z ≈ 1.45–1.48): body ≥ 29 units → ≥ 44 px, annotations ≥ 23 units → ≥ 34 px
  const NW = 350, NH = 452;
  function noteP4(t, S) {
    const cx = NW / 2;
    WR('LA VRAIE NOTE', cx, 66, t, S.title, .5, { size: 38, fam: FF.bd, align: 'center' });
    const f1 = font(FF.bd, 30, 400), f2 = font(FF.letN, 26, 400), w1 = measure('DE CHRISTELLE', f1), w2 = measure(' · estimation', f2), x0 = cx - (w1 + w2) / 2;
    WR('DE CHRISTELLE', x0, 101, t, S.title + .4, .45, { size: 30, fam: FF.bd });
    WR(' · estimation', x0 + w1, 101, t, S.title + .8, .4, { size: 26, color: '#4A3526' });
    if (t > S.title + 1.15) inkLine(30, 114, 30 + (NW - 60) * eOutCubic(prog(t, S.title + 1.15, S.title + 1.5)), 113, { w: 3.5, color: BD.orange, seed: 7 });
    if (S.socle != null && t >= S.socle) {
      const k = eOutCubic(prog(t, S.socle, S.socle + .3));
      ctx.save(); ctx.globalAlpha *= k; inkRect(10, 124, NW - 20, 84, { w: 3, seed: 21, fill: 'rgba(245,165,36,.20)' }); combienIcon(32, 152, 1.05); ctx.restore();
    }
    WR('VALEUR = mèches', 60, 158, t, S.socle + .1, .5, { size: 29 });
    WR('+ transport + assurance', 20, 197, t, S.socle + .5, .55, { size: fitSize('+ transport + assurance', FF.letN, 29, NW - 36) });
    if (S.arrow != null && t >= S.arrow) {
      WR("l'ordre de calcul", 316, 238, t, S.arrow, .55, { size: 23, fam: FF.brush, align: 'right', color: RUST });
      const k = eOutCubic(prog(t, S.arrow + .3, S.arrow + .9));
      if (k > 0) arrowInk(332, 218, 332, 218 + 116 * k, { w: 3.2, color: RUST, seed: 9, head: 12 });
    }
    WR('1 · DROIT DE DOUANE', 14, 278, t, S.l1a, S.l1aD, { size: fitSize('1 · DROIT DE DOUANE', FF.bd, 31, 300), fam: FF.bd });
    WR('— selon le code', 28, 315, t, S.l1b, S.l1bD, { size: 29 });
    WR('(de 0 à 40 %)', 28, 351, t, S.l1c, .45, { size: 29 });
    ctx.save(); ctx.translate(112, 390); ctx.rotate(-.04);
    WR('décidé en commun', 0, 0, t, S.marg, .5, { size: 23, fam: FF.brush, color: RUST });
    WR('· Afrique centrale', 0, 27, t, S.marg + .45, .5, { size: 23, fam: FF.brush, color: RUST });
    ctx.restore();
  }

  // ---------- LA VRAIE NOTE — long version (P6, P8): held up by Christelle, hangs down to the floor and loops -----------
  // stage units of the close shots (Christelle C4 at x 400, feet 1745, h 1000); local (0, 0) = top-left of the note.
  // The note hangs in front of her, from her raised hand (top-right corner) — it continues the white receipt she holds.
  const LN = { x: 282, y: 1007, w: 272, h: 636 };
  function noteLong(t, S) {
    const w = LN.w, cx = w / 2;
    WR('LA VRAIE NOTE DE CHRISTELLE', cx, 27, t, -9, 1, { size: fitSize('LA VRAIE NOTE DE CHRISTELLE', FF.bd, 21, w - 22, 18), fam: FF.bd, align: 'center' });
    WR('· estimation', cx, 48, t, -9, 1, { size: 18.5, align: 'center', color: '#4A3526' });
    inkRect(8, 56, w - 16, 54, { w: 2.4, seed: 23, fill: 'rgba(245,165,36,.20)' }); combienIcon(24, 83, .7);
    WR('VALEUR = mèches', 42, 77, t, -9, 1, { size: 19 });
    WR('+ transport + assurance', 42, 101, t, -9, 1, { size: fitSize('+ transport + assurance', FF.letN, 19, w - 54, 18) });
    WR('1 · DROIT DE DOUANE', 10, 137, t, -9, 1, { size: 24, fam: FF.bd });
    // 2 · ACCISES : the « + ACCISES » label of P5 is stapled on (raccord)
    if (S.l2 != null && t >= S.l2) {
      const k = clamp(spring(t - S.l2, 18, .5), 0, 1.15), sc = 1 + (1 - Math.min(k, 1)) * .35;
      ctx.save(); ctx.translate(8 + 112, 160); ctx.scale(sc, sc); ctx.rotate(-.025); ctx.globalAlpha *= clamp((t - S.l2) / .08);
      withShadow(5, () => { ctx.fillStyle = '#E8C590'; ctx.fillRect(-112, -21, 224, 42); }); inkRect(-112, -21, 224, 42, { w: 2.5, seed: 24 });
      text('2 · ACCISES', -98, 11, { font: font(FF.bd, 24, 400), color: BD.ink });
      ctx.fillStyle = '#8A8F99'; ctx.fillRect(66, -25, 7, 17); ctx.fillRect(92, -25, 7, 17);
      ctx.restore();
    }
    WR('3 · petite redevance', 10, 210, t, S.l3, .7, { size: 25 });
    // the violet film (Part 1) wraps VALEUR + lines 1 to 3 = what the TVA is computed on
    if (S.film != null && t >= S.film) {
      const k = eOutCubic(prog(t, S.film, S.film + .65)), y0 = 52, y1 = 222, hh = (y1 - y0) * k;
      ctx.save();
      ctx.fillStyle = 'rgba(139,61,255,.28)'; ctx.fillRect(-9, y0, w + 18, hh);
      const gl = ctx.createLinearGradient(0, y0, w, y0 + hh); gl.addColorStop(.15, 'rgba(255,255,255,0)'); gl.addColorStop(.3, 'rgba(255,255,255,.35)'); gl.addColorStop(.42, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl; ctx.fillRect(-9, y0, w + 18, hh);
      inkRect(-9, y0, w + 18, hh, { w: 3, color: VIO, seed: 25 });
      ctx.fillStyle = 'rgba(106,34,201,.45)'; ctx.fillRect(-9, y0 + 6, 5, hh - 12); ctx.fillRect(w + 4, y0 + 6, 5, hh - 12);
      ctx.restore();
    }
    WR('TVA 19,25 % · taux général', 8, 254, t, S.tva1, S.tva1D, { size: fitSize('TVA 19,25 % · taux général', FF.letN, 24.5, w - 14, 23.5), color: VIO });
    WR('sur le tout, droit compris', 8, 284, t, S.tva2, S.tva2D, { size: fitSize('sur le tout, droit compris', FF.letN, 24.5, w - 14, 23.5), color: VIO });
    WR('+ petites taxes communes', 8, 322, t, S.pt, S.ptD, { size: fitSize('+ petites taxes communes', FF.letN, 25, w - 14, 23.5) });
    ctx.save(); ctx.globalAlpha *= .2; for (let y = 352; y < 540; y += 28) inkLine(10, y, w - 10, y, { w: 1.4, color: '#5A3A1C', seed: y }); ctx.restore();
    // margin note (Caveat), at the foot of the note: read while the camera is down at her sandals, and still clear of the
    // caption when the camera climbs back to her face
    ctx.save(); ctx.translate(12, 572); ctx.rotate(-.03);
    WR('accises, redevance, TVA :', 0, 0, t, S.m2, .4, { size: 20, fam: FF.brush, color: RUST });
    WR('votées au Parlement ·', 0, 26, t, S.m2 == null ? null : S.m2 + .4, .4, { size: 20, fam: FF.brush, color: RUST });
    WR('la douane encaisse le tout', 0, 52, t, S.m2 == null ? null : S.m2 + .8, .45, { size: 20, fam: FF.brush, color: RUST });
    ctx.restore();
    if (S.stamp != null && t >= S.stamp) igsStamp(t, cx + 4, 150, S.stamp);
  }
  /** the long note: hanging sheet, then the paper reaches the floor and coils in loops beside her sandals */
  function noteLongPaper(t, S) {
    const { x, y, w, h } = LN, b = y + h;
    const pts = [[x + w - 46, b - 8], [x + w - 22, b + 30], [x + w + 4, b + 60]];
    for (let th = .35; th <= 4.3 * Math.PI; th += .12) pts.push([x + w + 12 + 16 * th - 52 * Math.sin(th), b + 80 - 30 * (1 - Math.cos(th)) + Math.sin(t * 1.3 + th) * 1.5]);
    ctx.save(); ctx.fillStyle = 'rgba(18,10,6,.35)'; ctx.beginPath(); ctx.ellipse(x + w + 120, b + 118, 150, 12, 0, 0, 7); ctx.fill(); ctx.restore();
    ribbon(pts, 34, '#C99A66');
    kraftSheet(x + w / 2 + Math.sin(t * 1.1) * .8, y + h / 2, w, h, { seed: 31, lift: 12 }, () => noteLong(t, S));
  }
  /** cream-haloed Bangers line (stamps, labels): legible over anything */
  function haloText(s, x, y, size, color, o = {}) {
    ctx.save(); ctx.font = font(FF.bd, size, 400); ctx.letterSpacing = (o.ls ?? 1) + 'px'; ctx.textAlign = o.align || 'center'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.halo || 'rgba(255,244,222,.92)'; ctx.lineWidth = size * .22; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
  }
  function igsStamp(t, x, y, t0) {                               // ochre rectangular stamp, slammed at t0
    const k = clamp((t - t0) / .12), s = 1 + (1 - eOutCubic(k)) * .5, w = 300, h = 150;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.09); ctx.scale(s, s); ctx.globalAlpha *= k;
    ctx.fillStyle = 'rgba(255,240,205,.55)'; ctx.fillRect(-w / 2, -h / 2, w, h);
    inkRect(-w / 2, -h / 2, w, h, { w: 6, color: OCHRE, seed: 41 }); inkRect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, { w: 2.2, color: OCHRE, seed: 42 });
    haloText("À L'IGS · TVA + PRÉCOMPTE", 0, -h / 2 + 46, fitSize("À L'IGS · TVA + PRÉCOMPTE", FF.bd, 27, w - 34, 22), OCHRE);
    const f2 = font(FF.bd, 31, 400), w2 = measure('À COMPTER', f2, 1);
    arrowInk(-w2 / 2 - 50, -h / 2 + 77, -w2 / 2 - 14, -h / 2 + 77, { w: 4.5, color: OCHRE, seed: 43, head: 11 });
    haloText('À COMPTER', 14, -h / 2 + 88, 31, OCHRE);
    haloText('DANS VOTRE PRIX', 0, -h / 2 + 128, 31, OCHRE);
    ctx.globalAlpha = .45; ctx.fillStyle = '#F3DDB4';              // starved ink
    for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc((hash(i * 3.1) - .5) * w, (hash(i * 5.7) - .5) * h, .8 + hash(i) * 2.2, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ---------- P7 phone screen card (1000 × 1780 card units; 1 unit = 1.08 px when it fills the frame) -------------------
  function cardP7(t, S) {
    const cw = 1000;
    ctx.fillStyle = '#FFF8EA'; ctx.fillRect(0, 0, cw, 1780);
    text('SELON VOTRE SITUATION', cw / 2, 318, { font: font(FF.bd, 70, 400), align: 'center', color: BD.ink, ls: 2 });
    inkLine(150, 342, 850, 338, { w: 6, color: BD.orange, seed: 4 });
    const col = (x0, fill, h1, h2, a) => { if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a;
      withShadow(6, () => { ctx.fillStyle = fill; rrect(x0, 372, 445, 150, 18); ctx.fill(); });
      text(h1, x0 + 222, 440, { font: font(FF.bd, 58, 400), align: 'center', color: '#FFFFFF', ls: 2 });
      text(h2, x0 + 222, 497, { font: font(FF.letN, fitSize(h2, FF.letN, 44, 420), 400), align: 'center', color: '#FFFFFF' });
      ctx.lineWidth = 4; ctx.strokeStyle = BD.ink; rrect(x0, 372, 445, 150, 18); ctx.stroke(); ctx.restore(); };
    col(40, '#7B2FE0', 'PEUT REVENIR', 'au réel seulement', eOutCubic(prog(t, S.heads, S.heads + .35)));
    col(515, '#C07A12', 'UN COÛT', 'à mettre dans votre prix', eOutCubic(prog(t, S.heads + .25, S.heads + .6)));
    inkLine(500, 380, 500, 1120, { w: 3, color: 'rgba(30,21,18,.35)', seed: 6 });
    // violet column: items arrive with the voice
    const sz = 46;
    WR('TVA de la douane', 58, 600, t, S.tva, .6, { size: sz, color: '#4B1A9A' });
    arrowText('se récupère', 58, 656, t, S.tva2, .55, { size: sz, color: '#4B1A9A' });
    WR('(sur une déclaration', 70, 712, t, S.tva3, .45, { size: 38, color: '#5A3E78' });
    WR('à votre nom)', 70, 756, t, S.tva3 == null ? null : S.tva3 + .3, .35, { size: 38, color: '#5A3E78' });
    if (S.pre != null && t >= S.pre) inkLine(58, 800, 470, 798, { w: 2.5, color: 'rgba(75,26,154,.4)', seed: 8 });
    WR('PRÉCOMPTE', 58, 870, t, S.pre, .45, { size: 50, fam: FF.bd, color: '#4B1A9A' });
    arrowText("s'impute sur", 58, 928, t, S.pre2, .45, { size: sz, color: '#4B1A9A' });
    WR('vos impôts', 112, 982, t, S.pre2 == null ? null : S.pre2 + .35, .35, { size: sz, color: '#4B1A9A' });
    // ochre column: printed with its header (it is a phone screen, not handwriting)
    const oa = eOutCubic(prog(t, S.heads + .45, S.heads + .8));
    if (oa > 0) { ctx.save(); ctx.globalAlpha *= oa;
      for (const [s, y] of [['droit ·', 600], ['accises ·', 656], ['redevance ·', 712], ['petites taxes', 768]]) text(s, 540, y, { font: font(FF.letN, sz, 400), color: '#7A4A06' });
      ctx.restore(); }
    // bandeau (below the caption zone) + tiny footer
    if (S.band != null && t >= S.band) { const k = eOutCubic(prog(t, S.band, S.band + .45));
      ctx.save(); ctx.translate(0, (1 - k) * 60); ctx.globalAlpha *= k;
      kraftSheet(cw / 2, 1470, 940, 200, { seed: 12, lift: 8 }, (w, h) => {
        text("PRÉCOMPTE = une avance d'impôt,", w / 2, 62, { font: font(FF.letN, 46, 400), align: 'center', color: BD.ink });
        text('prise à la douane', w / 2, 112, { font: font(FF.letN, 46, 400), align: 'center', color: BD.ink });
        text("au réel 2 % · à l'IGS 5 %", w / 2, 172, { font: font(FF.bd, 52, 400), align: 'center', color: '#5B1FB0', ls: 1 });
      });
      ctx.restore(); }
    if (S.foot != null && t >= S.foot) { ctx.save(); ctx.globalAlpha *= eOutCubic(prog(t, S.foot, S.foot + .4));
      text("réel ou IGS : selon le chiffre d'affaires, pas au choix", cw / 2, 1650, { font: font(FF.letN, 34, 400), align: 'center', color: '#5A4636' }); ctx.restore(); }
  }

  // ---------- split-panel helper (P5): one illustration drawn in a clipped screen rect with its own camera ---------------
  function panel(t, R, key, cam, seed, fn) {
    const I = img(key), iw = 1000, ih = I ? 1000 * I.height / I.width : 1778;
    const cover = Math.max(R.w / iw, R.h / ih), sc = cover * cam.z, hw = R.w / 2 / sc, hh = R.h / 2 / sc;
    const cx = clamp(cam.x, Math.min(hw, iw / 2), Math.max(iw - hw, iw / 2)), cy = clamp(cam.y, Math.min(hh, ih / 2), Math.max(ih - hh, ih / 2));
    const sh = shake(t, Math.round(t * FPS));
    const c = { x: cx, y: cy, s: sc, ox: R.x + R.w / 2 + Math.sin(t * .45 + seed) * 3 + sh.x, oy: R.y + R.h / 2 + Math.sin(t * .31 + 1.3 + seed) * 2.5 + sh.y };
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.fillStyle = '#1B1410'; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.translate(c.ox, c.oy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    if (I) ctx.drawImage(I, 0, 0, iw, ih);
    if (fn) fn(c);
    ctx.restore();
    return c;
  }
  const pScr = (c, p) => ({ x: c.ox + (p[0] - c.x) * c.s, y: c.oy + (p[1] - c.y) * c.s });
  /** hanging kraft label in screen px (P5) */
  function kraftLabel(t, t0, x, y, w, h, lines, seed) {
    if (t < t0) return; const k = clamp(spring(t - t0, 14, .45), 0, 1.15), a = clamp((t - t0) / .1);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y - h / 2); ctx.rotate(Math.sin((t - t0) * 2.2) * .02 * Math.exp(-(t - t0) * .8) - .02); ctx.scale(1, k); ctx.translate(-x, -(y - h / 2));
    kraftSheet(x, y, w, h, { seed, pin: true, lift: 12 }, (ww, hh) => {
      lines.forEach(([s, fam, size, col, yy]) => text(s, ww / 2, yy, { font: font(fam, size, 400), align: 'center', color: col, ls: fam === FF.bd ? 2 : 0 }));
    });
    ctx.restore();
  }

  /** balloon tail: aims at the mouth, stops just above the head (never on the face) */
  const tailAbove = (m, topY, dx = 0) => [m.x + dx, Math.min(m.y - 14, topY - 12)];

  shots(() => {
    // ---------------------------------------------- times (voice) -----------------------------------------------
    const T4 = shotStart('S5'), T5 = ss('S6', .15), T6 = tw('S7', 'TVA', -.3), T7 = shotStart('S8'), T8 = shotStart('S9');
    const TEND = shotStart('S10');

    // =========================================== P4 · LUNDI, la note ============================================
    const S4 = {
      title: T4 + .6, socle: tw('S5', 'note', .05), arrow: tw('S5', "l'ordre", -.05),
      l1a: tw('S5', 'droit', -.05), l1aD: Math.max(.6, te('S5', 'douane') - tw('S5', 'droit')),
      l1b: tw('S5', 'selon', -.05), l1bD: Math.max(.4, te('S5', 'selon') - tw('S5', 'selon')),
      l1c: tw('S5', 'code', -.3), marg: tw('S5', 'code', -.1),
    };
    // the set: the post + its note in the left foreground, the counter centre-right, one floor line
    const POST = { x: 185 }, NOTE = { cx: 185, top: 470 }, CNT4 = { x0: 480, x1: 900, y0: 1440, y1: 1715 };
    // the cast (stage units): front row on the floor, the stall people behind the counter (a step back: smaller, higher)
    const N4 = { x: 385, y: 1748, h: HN }, J4 = { x: 905, y: 1752, h: HJ };
    const C4p = { x: 770, y: 1700, h: HC * .93 }, B4 = { x: 530, y: 1633, h: HB * .88 };
    const jA = T4 + .1, jB = T4 + 1.55, JX0 = 1245;                       // Junior walks in from the right, then stands
    const pushA = tw('S5', 'suit'), pushB = tw('S5', 'droit');
    defineShot({ id: 'P4', t0: T4, img: 'bg/etal_meches', seed: 4, inT: .7, inKind: 'page',
      cam: [{ t: T4, x: 500, y: 889, z: 1 }, { t: pushA, x: 500, y: 889, z: 1.0 }, { t: pushB, x: 345, y: 897, z: 1.45 }, { t: T5 + .7, x: 345, y: 893, z: 1.48, e: 'lin' }],
      stage(t) {
        stallFloor();
        // Boris, one step back behind the counter, his box under the arm; its tag hangs below the box (clear of the caption)
        drawPuppet('cast/boris_1', B4.x, B4.y, B4.h, { t, phase: PHB, grade: GB, hop: tw('S5', 'Lundi', .25) });
        boxTag(t, B4.x + BOX.dx * B4.h, B4.y - B4.h + BOX.y1 * B4.h - 2, .85, { string: 14 });
        // Christelle behind her counter, index raised (C2), looking at Junior: a proud little hop on « Lundi »
        drawPuppet('cast/christelle_2', C4p.x, C4p.y, C4p.h, { t, phase: PHC, grade: G, hop: tw('S5', 'Lundi', .05) });
        stallCounter(CNT4.x0, CNT4.x1, CNT4.y0, CNT4.y1, t);
        // Nadège (N1), sure of herself, phone in hand, in front of the counter
        drawPuppet('cast/nadege_1', N4.x, N4.y, N4.h, { t, phase: PHN, grade: G, lean: .015 });
        // Junior walks in from the right (J5, profile, mirrored), feet locked to the floor, then stands (J1, facing the group)
        const ju = prog(t, jA, jB), jk = 1 - Math.pow(1 - ju, 2), jx = lerp(JX0, J4.x, jk), hw = pxH('cast/junior_5', J4.h);
        const A = .78 * clamp(2 * (1 - ju) * 1.15), wk = walkRot(Math.abs(jx - JX0), hw, A);
        if (t < jB) drawPuppet('cast/junior_5', jx, J4.y - wk.bob * hw, hw, { t, phase: PHJ, grade: G, flip: true, rot: wk.rot });
        else pupSwitch('cast/junior_5', 'cast/junior_1', jB, J4.x, J4.y, J4.h, { t, phase: PHJ, grade: G, flip: true, hop: jB + .02 }, .2, hw);
        // foreground: the stall post and the kraft note pinned on it; the margouillat on the note's top edge
        woodPost(POST.x, -20, 1772, 46);
        kraftSheet(NOTE.cx, NOTE.top + NH / 2, NW, NH, { seed: 7, pin: true, lift: 16, rot: -.012 }, () => noteP4(t, S4));
        propLizard(318, NOTE.top - 13, 1, t, { phase: 1.2, puff: env(t, tw('S5', 'droit'), te('S5', 'douane', 1.1), .15, .35), pushAt: tw('S5', 'droit', -.1) });
      },
      screen(t) {
        dayCard(t, T4 + .35, 'LUNDI');
        tabOnglet(t, T4 + .75, '① LES TAXES');
      } });

    // =========================================== P5 · accises : baskets | mèches ===================================
    const bJ0 = tw('S6', 'baskets', -.5), bJ1 = bJ0 + 2.0;            // Junior's balloon
    const bC0 = tw('S6', 'neuves', .05), bC1 = T6 - .05;              // Christelle's balloon (until the cut)
    const lab5R = tw('S6', 'mèches', -.1), lab5L = tw('S6', 'baskets', -.2), band5 = te('S6', 'non', .05);
    const camL = [{ t: T5, x: 440, y: 889, z: 1 }, { t: ss('S6', .5), x: 440, y: 889, z: 1 }, { t: tw('S6', 'mèches', -.2), x: 430, y: 930, z: 1.1 },
      { t: lab5L, x: 430, y: 930, z: 1.1 }, { t: bJ0 + .9, x: 430, y: 960, z: 1.16 }];
    const camR = [{ t: T5, x: 520, y: 889, z: 1 }, { t: tw('S6', 'mèches', -.35), x: 520, y: 889, z: 1 }, { t: te('S6', 'ont', .1), x: 520, y: 940, z: 1.12 },
      { t: bC0 + .9, x: 520, y: 960, z: 1.15 }];
    const LP = { x: 0, y: 0, w: 533, h: H }, RP = { x: 547, y: 0, w: 533, h: H };
    const H5 = 930, F5 = 1700;                                         // a closer medium-long shot: feet in, head high
    defineShot({ id: 'P5', t0: T5, img: 'bg/etal_meches', seed: 5, inT: .6, inKind: 'slide',
      draw(t) {
        ctx.fillStyle = '#FFFDF6'; ctx.fillRect(0, 0, W, H);
        let jm = null, cm = null;
        const cl = panel(t, LP, 'bg/etal_baskets', camAtKeys(camL, t), 5, () => {
          const talk = t > bJ0 && t < bJ1 ? 1 : 0;
          drawPuppet('cast/junior_3', 430, F5, H5, { t, phase: PHJ, talk, grade: GDAY, hop: bJ0 + .1 });
          jm = mouthOf('cast/junior_3', 430, F5, H5, false);
        });
        const cr = panel(t, RP, 'bg/etal_meches', camAtKeys(camR, t), 6, () => {
          stallFloor();
          const talk = t > bC0 && t < bC1 ? 1 : 0;
          drawPuppet('cast/christelle_2', 520, F5, H5 * .98, { t, phase: PHC, talk, grade: G, flip: true, hop: lab5R + .15, lean: talk ? .03 : 0 });
          cm = mouthOf('cast/christelle_2', 520, F5, H5 * .98, true);
        });
        inkLine(LP.w, 0, LP.w, H, { w: 5, seed: 81, step: 60 }); inkLine(RP.x, 0, RP.x, H, { w: 5, seed: 82, step: 60 });
        // lettered labels (top of each panel, under the series tag)
        kraftLabel(t, lab5L, 267, 345, 440, 176, [['BASKETS NEUVES', FF.bd, 52, BD.ink, 84], ["PAS D'ACCISES", FF.bd, 58, BD.green, 150]], 51);
        kraftLabel(t, lab5R, 813, 345, 420, 176, [['MÈCHES', FF.bd, 58, BD.ink, 84], ['+ ACCISES', FF.bd, 62, BD.red, 152]], 52);
        // balloons (left panel first, then the right one), just above the heads
        const jp = pScr(cl, jm), cp = pScr(cr, cm), jTop = pScr(cl, [430, F5 - H5]).y, cTop = pScr(cr, [520, F5 - H5 * .98]).y;
        balloon(t, { t0: bJ0, t1: bJ1, text: "Mes baskets neuves ? Pas d'accises !", x: 268, y: jTop - 148, w: 470, size: 50, tail: tailAbove(jp, jTop, 10), seed: 3 });
        balloon(t, { t0: bC0, t1: bC1, text: 'Et pourquoi moi, eh ?', x: 812, y: cTop - 122, w: 440, size: 52, tail: tailAbove(cp, cTop, -10), seed: 4 });
        // the kraft band crosses the bottom of both panels: line 2 of the note
        if (t >= band5) { const k = eOutCubic(prog(t, band5, band5 + .5));
          kraftSheet(lerp(-560, 540, k), 1572, 1000, 150, { seed: 14, rot: -.018, lift: 14 }, (w, h) => {
            const f1 = font(FF.bd, 64, 400), f2 = font(FF.letN, 52, 400), s1 = '2 · ACCISES', s2 = ' — selon le produit', w1 = measure(s1, f1, 2), w2 = measure(s2, f2), x0 = (w - w1 - w2) / 2;
            text(s1, x0, 92, { font: f1, color: BD.ink, ls: 2 }); text(s2, x0 + w1, 92, { font: f2, color: BD.ink });
          }); }
      } });

    // =========================================== P6 · TVA : la note s'allonge =======================================
    const dn0 = tw('S7', 'sur', .1), dn1 = dn0 + 1.2, up0 = tw('S7', 'Et', -.2), up1 = up0 + .85;
    const S6 = {
      l2: T6 + .08, l3: T6 + .45, film: tw('S7', '19,25', -.05),
      tva1: tw('S7', '19,25', .2), tva1D: Math.max(1, te('S7', 'général') - tw('S7', '19,25', .2)),
      tva2: tw('S7', 'sur', -.05), tva2D: Math.max(.9, te('S7', 'compris') - tw('S7', 'sur')),
      pt: tw('S7', 'Et', -.05), ptD: Math.max(.8, te('S7', 'taxes') - tw('S7', 'Et')),
      m2: dn1 - .25,
    };
    const b6a = tw('S7', 'Et', .2), b6b = T7 - .05;                    // Christelle's balloon
    const CX = 400, CY = 1760, CH = 1000;                             // Christelle in the close shots P6, P8 (nearer the camera)
    const HAND = [484, 911, 88, 96];                                 // her raised hand (+ receipt top), redrawn over the note
    const CNT6 = { x0: 520, x1: 1060, y0: 1330, y1: 1712 };           // her counter, behind her on the right
    const B6 = { x: 615, y: 1580, h: 700 };                          // Boris behind the counter (box + tag in frame)
    const WIG = { x: 215, neck: 1090, s: .95 };
    const boo6 = tw('S7', '19,25', .1);                               // Boris' astonished hop
    let c6 = null;
    defineShot({ id: 'P6', t0: T6, img: 'bg/etal_meches', seed: 6,
      cam: [{ t: T6, x: 445, y: 1080, z: 1.75 }, { t: S6.tva1 - .45, x: 445, y: 1128, z: 1.75 }, { t: dn0, x: 445, y: 1150, z: 1.75, e: 'lin' },
        { t: dn1, x: 447, y: 1270, z: 1.75 }, { t: up0, x: 447, y: 1270, z: 1.75 }, { t: up1, x: 445, y: 1190, z: 1.55 }, { t: T7, x: 445, y: 1188, z: 1.57, e: 'lin' }],
      stage(t, n, c) {
        c6 = c;
        stallFloor();
        // a wig stand by the wall, the margouillat perched on the wig, throat puffed (X2b)
        const top = wigStand(WIG.x, 1702, WIG.neck, WIG.s);
        propLizard(WIG.x - 4, top + 4, .9, t, { phase: 2.4, puff: .85 + Math.sin(t * 2.2) * .1, period: 4.6 });
        // Boris, behind the counter: his box under the arm with its tag; he jumps on « 19,25 % » (surprise lines)
        drawPuppet('cast/boris_1', B6.x, B6.y, B6.h, { t, phase: PHB, grade: GB, hop: boo6 });
        const bTop = B6.y - B6.h - (t > boo6 && t < boo6 + .45 ? Math.sin((t - boo6) / .45 * Math.PI) * .07 * B6.h : 0);
        boxTag(t, B6.x + BOX.dx * B6.h, bTop + BOX.y0 * B6.h + 2, .9, { string: 8, rot: -.03 });
        surprise(B6.x - .03 * B6.h, bTop + .08 * B6.h, .1 * B6.h, prog(t, boo6, boo6 + .25), 11, 5, 1 - prog(t, boo6 + 1.4, boo6 + 1.8));
        stallCounter(CNT6.x0, CNT6.x1, CNT6.y0, CNT6.y1, t, .2);
        // Christelle (C4, shocked, reads her receipt): the note continues it to the floor
        const talk = t > b6a && t < b6b ? 1 : 0, rot = noGesture('cast/christelle_4', t, PHC, talk);
        const opt = { t, phase: PHC, talk, grade: G, rot }, jy = jolt(t, S6.film + .05, .028 * CH);
        ctx.save(); ctx.translate(0, -jy);
        drawPuppet('cast/christelle_4', CX, CY, CH, opt);
        noteLongPaper(t, S6);
        ctx.save(); ctx.beginPath(); ctx.rect(...HAND); ctx.clip(); drawPuppet('cast/christelle_4', CX, CY, CH, Object.assign({}, opt, { shadow: false })); ctx.restore();
        ctx.restore();
        // a sweat drop when the TVA film wraps the note, surprise lines on « petites taxes »
        sweatDrop(CX - .1 * CH, CY - CH + .16 * CH, 1.5, prog(t, S6.film + .2, S6.film + 1.6));
        sweatDrop(CX + .13 * CH, CY - CH + .12 * CH, 1.3, prog(t, b6a - .1, b6a + 1.5));
      },
      screen(t) {
        if (!c6) return;
        const m = stageToScreen(c6, ...mouthOf('cast/christelle_4', CX, CY, CH, false));
        balloon(t, { t0: b6a, t1: b6b, text: "Ma note s'allonge comme mes mèches !", x: 858, y: 262, w: 330, size: 46, tail: [m.x + 74, m.y - 26], seed: 6 });
      } });
    addShake(S6.l2 + .05, 5, .1);

    // =========================================== P7 · selon votre situation (le téléphone) ===========================
    const NX = 330, NY = 1745, KX = 702, KY = 1745;
    const PHP = [357, 176], PHW = 37;                                 // her own phone on cast/nadege_2 (rig px, measured)
    const CAM2 = { x: 516, y: 1120, z: 1.35 };                       // the two-shot (feet on the floor, heads under the balloons)
    const phoneAt = (t) => pupPt('cast/nadege_2', NX, NY, HN, { t, phase: PHN, rot: noGesture('cast/nadege_2', t, PHN, 0) }, PHP, 'armL_lo');
    const pIn0 = tw('S8', 'situation', -.05), pIn1 = tw('S8', 'réel', .15);
    const pOut0 = tw('S8', "s'impute", -.35), pOut1 = tw('S8', "s'impute", .45);
    const PH7 = phoneAt(pIn1);
    const S7 = { heads: tw('S8', 'au', -.1), tva: tw('S8', 'TVA', -.05), tva2: tw('S8', 'se', -.05, 1), tva3: te('S8', 'récupère', -.15),
      pre: tw('S8', 'précompte', -.05), pre2: te('S8', 'précompte', .05), band: tw('S8', 'avance', -.15), foot: te('S8', 'douane', .05, 1) };
    const b7c0 = pOut1 + .05, b7c1 = b7c0 + 1.95, b7n0 = Math.min(b7c0 + .7, T8 - 1.85), b7n1 = T8 - .02;
    const n7sw = b7n0 - .25;                                           // Nadège turns to Christelle (N2 → N1) for her line
    const CNT7 = { x0: 430, x1: 830, y0: 1440, y1: 1700 };
    let c7 = null;
    defineShot({ id: 'P7', t0: T7, img: 'bg/etal_meches', seed: 7,
      cam: [{ t: T7, x: CAM2.x, y: CAM2.y, z: CAM2.z }, { t: pIn0, x: CAM2.x - 8, y: CAM2.y - 4, z: CAM2.z * 1.04, e: 'lin' }, { t: pIn1, x: PH7.x, y: PH7.y, z: 3.2 },
        { t: pOut0, x: PH7.x, y: PH7.y, z: 3.25, e: 'lin' }, { t: pOut1, ...CAM2 }, { t: TEND, x: CAM2.x, y: CAM2.y - 6, z: CAM2.z * 1.03, e: 'lin' }],
      stage(t, n, c) {
        c7 = c;
        stallFloor();
        stallCounter(CNT7.x0, CNT7.x1, CNT7.y0, CNT7.y1, t, .12);
        const tn = t > b7n0 && t < b7n1 ? 1 : 0, tc = t > b7c0 && t < b7c1 ? 1 : 0;
        if (t < n7sw) drawPuppet('cast/nadege_2', NX, NY, HN, { t, phase: PHN, grade: G, rot: noGesture('cast/nadege_2', t, PHN, 0) });
        else pupSwitch('cast/nadege_2', 'cast/nadege_1', n7sw, NX, NY, HN, { t, phase: PHN, grade: G, talk: tn, hop: n7sw + .05 });
        drawPuppet('cast/christelle_2', KX, KY, HC, { t, phase: PHC, grade: G, flip: true, talk: tc, hop: b7c0 + .05, lean: t < pIn1 ? .05 * eOutCubic(prog(t, T7 + .3, T7 + 1.1)) : 0 });
      },
      screen(t) {
        if (!c7) return;
        // the phone: starts exactly on Nadège's own phone, then grows until its screen fills the frame
        const kin = eInOutCubic(prog(t, pIn0 + .35, pIn1 + .1)), kout = eInOutCubic(prog(t, pOut0, pOut1 - .1)), k = kin * (1 - kout);
        if (k > 0 && t < n7sw) {
          const ph = phoneAt(t), P = stageToScreen(c7, ph.x, ph.y), w0 = PHW * HN / 1253 * c7.s, w = lerp(w0, 1214, k), x = lerp(P.x, 540, k), y = lerp(P.y, 960, k);
          ctx.save(); ctx.globalAlpha *= clamp(k / .04);
          propPhone(x, y, w, { rot: 0, glow: k < .5 ? 'rgba(255,236,170,.55)' : null, lift: 12 * (1 - k) }, (sw, sh) => {
            const s = sw / 1000; ctx.translate(0, (sh - 1780 * s) / 2); ctx.scale(s, s); cardP7(t, S7);
          });
          ctx.restore();
        }
        const mc = stageToScreen(c7, ...mouthOf('cast/christelle_2', KX, KY, HC, true)), mn = stageToScreen(c7, ...mouthOf('cast/nadege_1', NX, NY, HN, false));
        const cTop = stageToScreen(c7, KX, KY - HC).y, nTop = stageToScreen(c7, NX, NY - HN).y;
        balloon(t, { t0: b7c0, t1: b7c1, text: 'Alors je passe au réel demain !', x: 772, y: cTop - 150, w: 440, size: 50, tail: tailAbove(mc, cTop, -8), seed: 8 });
        balloon(t, { t0: b7n0, t1: b7n1, text: "Ça dépend de ton chiffre d'affaires !", x: 274, y: nTop - 168, w: 420, size: 48, tail: tailAbove(mn, nTop, 8), seed: 9 });
      } });

    // =========================================== P8 · à l'IGS : dans votre prix =====================================
    const b8a = T8 + .05, b8b = Math.max(b8a + 1.9, tw('S9', 'Christelle', -.1));
    const stamp8 = tw('S9', 'Christelle', .05), ins0 = tw('S9', 'comptez', -.1), wr0 = tw('S9', 'dans', -.05), wr1 = te('S9', 'prix', .05);
    const S8 = Object.assign({}, S6, { l2: -9, l3: -9, film: -9, tva1: -9, tva2: -9, pt: -9, m2: null, tva1D: 1, tva2D: 1, ptD: 1, stamp: stamp8 });
    let c8 = null;
    defineShot({ id: 'P8', t0: T8, img: 'bg/etal_meches', seed: 8,
      cam: [{ t: T8, x: 445, y: 1163, z: 1.65 }, { t: TEND + .8, x: 452, y: 1163, z: 1.66, e: 'lin' }],   // the note lines stay clear of the caption
      stage(t, n, c) {
        c8 = c;
        stallFloor();
        const top = wigStand(WIG.x, 1702, WIG.neck, WIG.s);
        propLizard(WIG.x - 4, top + 4, .9, t, { phase: 2.4, puff: 0, period: 4.2, pushAt: stamp8 + .1 });
        stallCounter(CNT6.x0, CNT6.x1, CNT6.y0, CNT6.y1, t, .2);
        const talk = t > b8a && t < b8b ? 1 : 0, rot = noGesture('cast/christelle_4', t, PHC, talk);
        const opt = { t, phase: PHC, talk, grade: G, rot }, jy = jolt(t, stamp8 + .04, .03 * CH);
        ctx.save(); ctx.translate(0, -jy);
        drawPuppet('cast/christelle_4', CX, CY, CH, opt);
        noteLongPaper(t, S8);
        ctx.save(); ctx.beginPath(); ctx.rect(...HAND); ctx.clip(); drawPuppet('cast/christelle_4', CX, CY, CH, Object.assign({}, opt, { shadow: false })); ctx.restore();
        ctx.restore();
        sweatDrop(CX - .1 * CH, CY - CH + .16 * CH, 1.5, prog(t, b8a + .2, b8a + 1.7));
        sweatDrop(CX + .13 * CH, CY - CH + .12 * CH, 1.3, prog(t, stamp8 + .05, stamp8 + 1.5));
      },
      screen(t) {
        if (!c8) return;
        const m = stageToScreen(c8, ...mouthOf('cast/christelle_4', CX, CY, CH, false));
        balloon(t, { t0: b8a, t1: b8b, text: 'Et il me reste quoi pour la douane ?', x: 856, y: 270, w: 330, size: 46, tail: [m.x + 74, m.y - 26], seed: 10 });
        // insert (bottom vignette): her hand rewrites the price tag of a wig
        if (t >= ins0) insertTag(t, ins0, wr0, wr1);
      } });
    addShake(stamp8, 13, .17);

    /** P8 insert: a wig on its stand, its price tag rewritten « PRIX DE VENTE · douane comprise » (no figure) by her hand */
    function insertTag(t, t0, w0, w1) {
      const k = clamp(spring(t - t0, 15, .55), 0, 1.12), x = 560, y = 1716, w = 790, h = 392;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(-.02);
      withShadow(14, () => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20); });
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
      const bg = ctx.createLinearGradient(0, -h / 2, 0, h / 2); bg.addColorStop(0, '#E9D2A8'); bg.addColorStop(1, '#D8B98A');
      ctx.fillStyle = bg; ctx.fillRect(-w / 2, -h / 2, w, h);
      // hanging braids far behind (right), out of focus
      ctx.save(); ctx.globalAlpha = .35; ctx.lineCap = 'round';
      for (let i = 0; i < 12; i++) { const xx = w / 2 - 20 - i * 15; ctx.strokeStyle = i % 3 ? '#7A3B1F' : '#2A1A12'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(xx, -h / 2); ctx.quadraticCurveTo(xx + 10, -40, xx - 6, -h / 2 + 150 + hash(i) * 60); ctx.stroke(); }
      ctx.restore();
      // the wig on its stand (left), seen close
      const wy = h / 2 + 40; wigHead(-262, wy, 2.05);
      // the tag hangs from the stand's neck on a string
      const tx = 70, ty = 10;
      inkPath([[-262 + 40, wy - 110 * 2.05], [-170, -30], [tx - 190 + 32, ty]], { w: 2.5, color: '#6B4A2A', seed: 3 });
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(-.04);
      const tw2 = 380, th = 206;
      withShadow(8, () => { ctx.fillStyle = '#FFF6DE'; ctx.beginPath(); ctx.moveTo(-tw2 / 2 + 34, -th / 2); ctx.lineTo(tw2 / 2, -th / 2); ctx.lineTo(tw2 / 2, th / 2); ctx.lineTo(-tw2 / 2 + 34, th / 2); ctx.lineTo(-tw2 / 2, 0); ctx.closePath(); ctx.fill(); });
      inkPath([[-tw2 / 2 + 34, -th / 2], [tw2 / 2, -th / 2], [tw2 / 2, th / 2], [-tw2 / 2 + 34, th / 2], [-tw2 / 2, 0]], { w: 3, close: true, seed: 5 });
      inkCircle(-tw2 / 2 + 32, 0, 9, { w: 2.5, fill: '#E9D9B8', seed: 6 });
      // the old (crossed-out) scribble — no figure
      inkPath(Array.from({ length: 16 }, (_, i) => [-tw2 / 2 + 74 + i * 14, -th / 2 + 42 + Math.sin(i * 1.7) * 9]), { w: 3, color: '#7A6A5A', seed: 7 });
      if (t > t0 + .25) inkLine(-tw2 / 2 + 64, -th / 2 + 44, -tw2 / 2 + 74 + 15 * 14 * eOutCubic(prog(t, t0 + .25, t0 + .5)) + 10, -th / 2 + 38, { w: 5, color: BD.red, seed: 8 });
      const d1 = Math.max(.5, (w1 - w0) * .5), d2 = Math.max(.5, (w1 - w0) * .55);
      const k1 = WR('PRIX DE VENTE', -tw2 / 2 + 56, -th / 2 + 118, t, w0, d1, { size: 52, fam: FF.bd, color: BD.ink });
      const k2 = WR('douane comprise', -tw2 / 2 + 58, -th / 2 + 176, t, w0 + d1, d2, { size: 50, fam: FF.brush, color: BD.green });
      // the hand with a marker follows the writing (Christelle's green sleeve)
      const f1 = font(FF.bd, 52, 400), f2 = font(FF.brush, 50, 400);
      const px = k2 > 0 ? -tw2 / 2 + 58 + measure('douane comprise', f2) * k2 : -tw2 / 2 + 56 + measure('PRIX DE VENTE', f1) * k1, py = k2 > 0 ? -th / 2 + 176 : -th / 2 + 118;
      const rot = .55, s = .9, lx = -40.2 * s, ly = -168.6 * s, cr = Math.cos(rot), sr = Math.sin(rot);
      const wx = px - (cr * lx - sr * ly), wy2 = py - (sr * lx + cr * ly) + Math.sin(t * 22) * 2 * (t < w1 ? 1 : 0);
      propHand(wx, wy2, s, { rot, pose: 'pen', sleeve: '#2E8B57', dots: 'rgba(250,200,60,.9)', arm: 420, lift: 10 });
      ctx.restore();
      ctx.restore();
      inkRect(-w / 2, -h / 2, w, h, { w: 5, seed: 9 });
      ctx.restore();
    }
  });
})();

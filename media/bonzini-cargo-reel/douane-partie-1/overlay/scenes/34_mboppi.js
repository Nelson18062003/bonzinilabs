'use strict';
// =============================================================================================
// 34_mboppi — ⑧ JUNIOR'S STALL at Mboppi (world x ≈ 7640…8980), for the whole film.
//  S1 (opening, camera fixed on the stall): the stakes — violet awning, painted sign « JUNIOR · BASKETS », EMPTY shelves with
//     chalk outlines of boxes, a hand sign « BIENTÔT », a sticky note « Stock : 0 », an empty nail on the wall, a small pinned map
//     of Cameroon, neighbouring stalls in silhouette, the violet thread knotted to the stall's shelf.
//  S25 « étagères »: stop-motion — the boxes fill the shelves (the « Stock : 0 » note disappears behind them), the thread's knot
//     is re-tied; « diplôme »: the framed QUITTANCE drops onto the nail; « quittance »: the margouillat scurries in and settles
//     next to the frame. S29 « commentaire »: the margouillat turns its head towards us.
//  anchors for other stations: window.M34 = { counterTop, frame, map, lizard } (world coordinates).
// =============================================================================================
(() => {
  const Y = h => GROUND - h;
  const WALL = { x0: 7830, x1: 8660, h: 740 };
  const SHELF = { x0: 8060, x1: 8380, lv: [230, 400, 570], top: 700 };
  const NAIL = { x: 8505, h: 575 }, FRAME = { w: 200, h: 250 }, MAP = { x: 7955, h: 600 }, LIZ = { x: 8318, h: 716 };
  const TABLE = { x0: 7900, x1: 8560, h: 212, shelf: 50 }, KNOT = { x: 8140 };
  const BOXC = [C.orange, C.violet, C.amber, '#1FA86A', C.violetD, '#E9DCC6'];
  window.M34 = { counterTop: { x0: TABLE.x0, x1: TABLE.x1, y: Y(TABLE.h) }, frame: { x: NAIL.x, y: Y(NAIL.h - 155) }, map: { x: MAP.x, y: Y(MAP.h) }, lizard: { x: LIZ.x, y: Y(LIZ.h) } };
  let T = null, SLOTS = null;
  function tm() {
    if (T) return T;
    T = { sign0: tw('S25', 'étagères', -.3), fill0: tw('S25', 'étagères', -.05), fill1: te('S25', 'pleines', -.05), knot: te('S25', 'pleines', .05),
      frame: tw('S25', 'diplôme', -.2), liz0: tw('S25', 'quittance', -.55), liz1: tw('S25', 'quittance', .15), turn: tw('S29', 'commentaire', 0) };
    addShake(T.frame + .3, 5, .12); addShake(T.liz1, 2, .08);                                                 // the frame hits the wall
    addShake(T.fill0 + .35, 3, .1); addShake(T.fill0 + .9, 3, .1);                 // boxes land (stop-motion clicks)
    return T;
  }
  const visX = (x0, x1, t, m = 120) => { const c = camAt(t); if (Math.abs(c.r) > .01) return true; const hw = W / 2 / c.z + m; return x1 > c.x - hw && x0 < c.x + hw; };
  function slots() {
    if (SLOTS) return SLOTS; SLOTS = [];
    const iw = SHELF.x1 - SHELF.x0 - 40, bw = 88, gap = (iw - 3 * bw) / 4;
    SHELF.lv.forEach((h, r) => { for (let c = 0; c < 3; c++) SLOTS.push({ x: SHELF.x0 + 20 + gap + c * (bw + gap) + bw / 2, h: h + 16, w: bw, hh: 112 - r * 4, col: BOXC[(r * 3 + c) % BOXC.length] }); });
    SLOTS.push({ x: SHELF.x0 + 90, h: SHELF.top + 14, w: 96, hh: 80, col: C.amber }, { x: SHELF.x0 + 200, h: SHELF.top + 14, w: 96, hh: 80, col: C.violet });
    for (let c = 0; c < 5; c++) SLOTS.push({ x: TABLE.x0 + 150 + c * 100, h: TABLE.shelf + 14, w: 84, hh: 70, col: BOXC[(c + 2) % BOXC.length], low: true });
    return SLOTS;
  }
  function boxFront(w, h, col) {                                                   // sneaker box, front view (plain, no brand)
    withShadow(4, () => { ctx.fillStyle = '#EFE6D6'; ctx.fillRect(-w / 2, -h, w, h); });
    ctx.fillStyle = col; ctx.fillRect(-w / 2 - 4, -h - 4, w + 8, h * .24);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-w / 2, -h + h * .2, w, 3);
    ctx.fillStyle = col; ctx.globalAlpha *= .8; ctx.fillRect(-w / 2 + w * .14, -h * .44, w * .34, h * .13); ctx.globalAlpha /= .8;
    ctx.strokeStyle = 'rgba(35,22,41,.18)'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h, w, h);
  }
  function chalkBox(w, h) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 4; ctx.setLineDash([12, 9]); ctx.lineCap = 'round'; ctx.strokeRect(-w / 2, -h, w, h);
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * .76); ctx.lineTo(w / 2, -h * .76); ctx.stroke(); ctx.restore(); }

  // ---------- neighbours (silhouettes) ------------------------------------------------------------
  function neighbour(x0, x1, seed) {
    const col = 'rgba(90,70,110,.30)', w = x1 - x0;
    ctx.fillStyle = col; ctx.fillRect(x0 + 10, Y(700), 16, 700); ctx.fillRect(x1 - 26, Y(700), 16, 700);
    ctx.beginPath(); ctx.moveTo(x0 - 20, Y(700)); ctx.lineTo(x1 + 20, Y(700)); ctx.lineTo(x1 + 20, Y(640));
    for (let x = x1 + 20; x > x0 - 20; x -= w / 5) ctx.quadraticCurveTo(x - w / 10, Y(600), x - w / 5, Y(640)); ctx.closePath(); ctx.fill();
    ctx.fillRect(x0, Y(210), w, 210);
    for (let i = 0; i < 5; i++) { const x = x0 + 30 + i * (w - 60) / 4, hh = 60 + rnd(seed + i) * 90; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, Y(600)); ctx.lineTo(x, Y(600 - hh * .4)); ctx.stroke();
      ctx.fillRect(x - 22, Y(600 - hh * .4), 44, hh); }
  }

  // ---------- the stall ----------------------------------------------------------------------------
  function stall(t, n) {
    const Tm = tm(), S = slots(), N = S.length;
    const fk = prog(t, Tm.fill0, Tm.fill1), shown = Math.floor(stepT(n) >= Tm.fill0 ? fk * N + .001 : 0);
    // back wall (kraft board) + posts
    withShadow(14, () => { ctx.fillStyle = '#D9BF94'; ctx.fillRect(WALL.x0, Y(WALL.h), WALL.x1 - WALL.x0, WALL.h); });
    ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .55; ctx.fillRect(WALL.x0, Y(WALL.h), WALL.x1 - WALL.x0, WALL.h); ctx.globalAlpha /= .55;
    ctx.strokeStyle = 'rgba(120,80,40,.18)'; ctx.lineWidth = 3; for (let x = WALL.x0 + 104; x < WALL.x1; x += 104) { ctx.beginPath(); ctx.moveTo(x, Y(WALL.h)); ctx.lineTo(x, GROUND); ctx.stroke(); }
    for (const x of [WALL.x0 - 14, WALL.x1 - 16]) { ctx.fillStyle = C.kraftD; ctx.fillRect(x, Y(880), 30, 880); ctx.fillStyle = 'rgba(255,240,210,.25)'; ctx.fillRect(x + 4, Y(880), 5, 880); }
    // the pinned map of Cameroon (small, paper)
    at(MAP.x, Y(MAP.h), -.04, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-82, -88, 164, 176); });
      if (typeof cmrMap === 'function' && geo()) at(0, 0, 0, 1, 1, () => cmrMap(9.6, { neighbours: false, seaColor: '#DCEAF1' }));
      ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(-2.785 * 9.6, 1.95 * 9.6, 7, 0, 7); ctx.fill();
      ctx.fillStyle = DC.red; ctx.beginPath(); ctx.arc(0, -80, 9, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-3, -83, 3, 0, 7); ctx.fill(); });
    // shelf unit
    ctx.fillStyle = C.kraftD; ctx.fillRect(SHELF.x0, Y(SHELF.top + 14), 20, SHELF.top + 14); ctx.fillRect(SHELF.x1 - 20, Y(SHELF.top + 14), 20, SHELF.top + 14);
    for (const h of [...SHELF.lv, SHELF.top]) { withShadow(4, () => { ctx.fillStyle = '#A97C4E'; ctx.fillRect(SHELF.x0 - 10, Y(h + 16), SHELF.x1 - SHELF.x0 + 20, 16); }); }
    // « Stock : 0 » sticky note on the wall of the middle level (the boxes will cover it)
    at(8222, Y(SHELF.lv[1] + 88), .03, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = '#FFE36E'; ctx.beginPath(); ctx.moveTo(-118, -52); ctx.lineTo(118, -52); ctx.lineTo(118, 30); ctx.lineTo(96, 52); ctx.lineTo(-118, 52); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.moveTo(118, 30); ctx.lineTo(96, 52); ctx.lineTo(100, 34); ctx.closePath(); ctx.fill();
      text('Stock : 0', 0, 17, { font: font(FF.hand, 50, 800), align: 'center', color: C.ink }); });
    // boxes: chalk outlines while empty, then the stop-motion fill (on twos)
    S.forEach((s, i) => { if (s.low) return; at(s.x, Y(s.h), 0, 1, 1, () => {
      if (i < shown) { const ti = Tm.fill0 + (i + 1) / N * (Tm.fill1 - Tm.fill0), d = drop(stepT(n), ti - .1, 40, .1); ctx.translate(0, d.y); boxFront(s.w, s.hh, s.col); }
      else chalkBox(s.w, s.hh); }); });
    // « BIENTÔT » hand sign hanging from the top plank (falls away when the boxes arrive)
    const sg = prog(t, Tm.sign0, Tm.sign0 + .35);
    if (sg < 1) at(8220, Y(SHELF.top - 4) + eInCubic(sg) * 700, Math.sin(t * 1.1) * .03 + sg * .6, 1, 1, () => {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-60, 30); ctx.moveTo(80, 0); ctx.lineTo(60, 30); ctx.stroke();
      withShadow(6, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(-128, 28, 256, 84); });
      text('BIENTÔT', 0, 88, { font: font(FF.hand, 52, 800), align: 'center', color: C.ink }); });
    // the nail, then the framed quittance « comme un diplôme »
    ctx.fillStyle = '#3A3040'; ctx.beginPath(); ctx.arc(NAIL.x, Y(NAIL.h), 7, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(NAIL.x - 2, Y(NAIL.h) - 2, 2.5, 0, 7); ctx.fill();
    if (t >= Tm.frame) { const d = drop(t, Tm.frame, 320, .28), s = Math.max(0, t - Tm.frame - .28), sw = d.landed ? .16 * Math.exp(-s * 2.6) * Math.sin(s * 7.5) : 0;
      at(NAIL.x, Y(NAIL.h) + d.y, sw, 1, 1, () => frame()); }
    // awning (violet / cream stripes, scalloped) + painted sign
    const ax0 = WALL.x0 - 40, ax1 = WALL.x1 + 40, aw = ax1 - ax0, ay = Y(880);
    withShadow(10, () => { ctx.save(); ctx.beginPath(); ctx.moveTo(ax0, ay); ctx.lineTo(ax1, ay); ctx.lineTo(ax1, ay + 96);
      for (let x = ax1; x > ax0 + 1; x -= aw / 9) ctx.quadraticCurveTo(x - aw / 18, ay + 140, x - aw / 9, ay + 96); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? C.cream : C.violet; ctx.fillRect(ax0 + i * aw / 18, ay, aw / 18 + 1, 150); } ctx.restore(); });
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(ax0, ay, aw, 10);
    at(8230, Y(822), -.012, 1, 1, () => { withShadow(6, () => { ctx.fillStyle = C.violetD; rrect(-250, -42, 500, 84, 10); ctx.fill(); });   // painted name board on the awning
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; rrect(-240, -32, 480, 64, 7); ctx.stroke();
      const f0 = font(FF.stencil, 64, 900), fs = Math.min(64, 64 * 440 / measure('JUNIOR · BASKETS', f0, 4));
      text('JUNIOR · BASKETS', 0, fs * .34, { font: font(FF.stencil, fs, 900), align: 'center', color: C.cream, ls: 4 }); });
  }
  function frame() {
    const w = FRAME.w, h = FRAME.h;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * .32, 34); ctx.lineTo(0, 0); ctx.lineTo(w * .32, 34); ctx.stroke();
    at(0, 30 + h / 2, 0, 1, 1, () => {
      withShadow(10, () => { ctx.fillStyle = '#6B4A2A'; ctx.fillRect(-w / 2, -h / 2, w, h); });
      ctx.fillStyle = '#8A6238'; ctx.fillRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
      ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40);
      text('QUITTANCE', 0, -h / 2 + 62, { font: font(FF.mono, 25, 800), align: 'center', color: C.ink });
      ctx.fillStyle = 'rgba(35,22,41,.28)'; for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2 + 34, -h / 2 + 88 + i * 20, (w - 68) * (i % 2 ? .7 : 1), 5);
      at(8, h / 2 - 58, -.18, 1, 1, () => stampText('PAYÉ', 0, 0, font(FF.stencil, 44, 900), DC.red, { box: true, h: 62, boxW: 5, starve: .35, ls: 3 }));
      const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.1)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40);
    });
  }
  // the counter (front): table with a lower shelf; the violet thread is knotted to it
  function counter(t, n) {
    const Tm = tm(), S = slots(), N = S.length, fk = prog(t, Tm.fill0, Tm.fill1), shown = Math.floor(stepT(n) >= Tm.fill0 ? fk * N + .001 : 0);
    ctx.fillStyle = '#8A6238'; for (const x of [TABLE.x0 + 8, TABLE.x1 - 32]) ctx.fillRect(x, Y(TABLE.h), 24, TABLE.h);
    withShadow(6, () => { ctx.fillStyle = '#A97C4E'; ctx.fillRect(TABLE.x0 + 8, Y(TABLE.shelf + 14), TABLE.x1 - TABLE.x0 - 16, 14); });
    S.forEach((s, i) => { if (!s.low) return; at(s.x, Y(s.h), 0, 1, 1, () => { if (i < shown) boxFront(s.w, s.hh, s.col); else chalkBox(s.w, s.hh); }); });
    withShadow(12, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(TABLE.x0 - 12, Y(TABLE.h + 22), TABLE.x1 - TABLE.x0 + 24, 22); });
    ctx.fillStyle = C.kraftD; ctx.fillRect(TABLE.x0 - 12, Y(TABLE.h), TABLE.x1 - TABLE.x0 + 24, 44);
    ctx.fillStyle = C.violet; ctx.fillRect(TABLE.x0 - 12, Y(TABLE.h) + 16, TABLE.x1 - TABLE.x0 + 24, 10);
    // the violet thread: from the stage edge up to the lower shelf, knotted (re-tied on « pleines »)
    const p0 = [KNOT.x, GROUND + 70], p1 = [KNOT.x, Y(TABLE.shelf + 6)];
    thread([p0, [KNOT.x + 8, lerp(p0[1], p1[1], .5)], p1], 1, n, { w: 9, color: C.violet });
    const rk = t > Tm.knot ? 1 + Math.exp(-(t - Tm.knot) * 6) * Math.sin((t - Tm.knot) * 26) * .35 : 1;
    at(p1[0], p1[1], 0, rk, rk, () => { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
      ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(-16, -8, 14, 8, -.5, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(16, -8, 14, 8, .5, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-10, 20, -16, 34); ctx.moveTo(0, 4); ctx.quadraticCurveTo(12, 22, 20, 30); ctx.stroke(); });
  }
  // the margouillat hops down from the awning onto the top plank, next to the frame (S25), and turns its head towards us (S29)
  function lizardOnShelf(t, n) {
    const Tm = tm(); if (t < Tm.liz0 || typeof window.B44_lizard !== 'function') return;
    const p = prog(t, Tm.liz0, Tm.liz1), e = eOutCubic(p), x0 = LIZ.x + 90, y0 = Y(800), x1 = LIZ.x, y1 = Y(SHELF.top + 16);
    const x = lerp(x0, x1, e), y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * 70;
    const nod = t > Tm.liz1 + .1 && t < Tm.liz1 + .7 ? Math.abs(Math.sin(prog(t, Tm.liz1 + .1, Tm.liz1 + .7) * Math.PI * 2)) : 0;
    const turn = eInOutCubic(prog(t, Tm.turn, Tm.turn + .45));
    at(x, y, p < 1 ? -.3 * (1 - p) : 0, 1, 1, () => window.B44_lizard(92, { n, nod, turn }));
  }

  registerScene({ id: 'M34_back', z: 20, draw(t, n) {
    if (!visX(7600, 9000, t, 200)) return; ctx.save(); worldBegin(t); neighbour(7640, 7800, 3); neighbour(8730, 8980, 11); ctx.restore();
  } });
  registerScene({ id: 'M34_stall', z: 22, draw(t, n) {
    if (!visX(WALL.x0 - 80, WALL.x1 + 80, t, 200)) return; ctx.save(); worldBegin(t); stall(t, n); lizardOnShelf(t, n); ctx.restore();
  } });
  registerScene({ id: 'M34_front', z: 35, draw(t, n) {
    if (!visX(TABLE.x0 - 40, TABLE.x1 + 40, t, 200)) return; ctx.save(); worldBegin(t); counter(t, n); ctx.restore();
  } });
})();

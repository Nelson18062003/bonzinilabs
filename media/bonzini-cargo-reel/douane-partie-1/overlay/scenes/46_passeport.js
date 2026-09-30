'use strict';
// =============================================================================================
// 46 · LE PASSEPORT VERT DE LA MARCHANDISE — the film's progress motif (screen space, z 52).
// Same choreography every time: the green booklet flies out of its owner's hand (or, in S9, out of Junior's open folder on
// the transit counter), settles in the upper middle of the frame, opens, a wooden rubber stamp slams (camera-shake cue), the
// page of stamps is shown ~1.5 s, then the booklet closes and flies back into the owner's hand.
//   Junior's (violet ribbon): « AVANT LE DÉPART ✓ » (already there, discreet) · S9 « DÉCLARÉ · avant l'arrivée » (+ the
//     transitaire's declaration slip) · S18 « CONTRÔLÉ » (round — the shape the S18 match cut continues into the « ? » sticker)
//     · S20 cover « VRAIS · COMPLETS · À L'AVANCE » (closed booklet) · S21 « PAYÉ » (+ the quittance slip) · S22 « BON À ENLEVER ».
//   Mireille's (orange ribbon): S13 « DÉCLARÉ · EXPORT ».
// API for other stations: P46.stampScreen(key, t) → {x, y, r, a} (screen position/radius of a stamp, e.g. 'CONTROLE' for the
// S18 match cut) · P46.window(id) → {tIn, tEnd} · P46.shown(t) → true while a booklet is on screen.
// =============================================================================================
(() => {
  const PW = 400, PH = 500, AY = 498;                               // page size (spread = 2 × PW), display centre y
  const OWN = { junior: { ribbon: C.violet, name: 'JUNIOR', col: C.violetD, side: 1 }, mireille: { ribbon: C.orange, name: 'MIREILLE', col: '#D84406', side: -1 } };
  // stamps: spread coordinates (origin = spine centre; the cover covers [0, PW]); lines = [text, family, size, baseline]
  const ST = {
    AVANT: { x: -200, y: -150, r: -.05, col: '#3E6B55', w: 262, h: 52, alpha: .5, lines: [['AVANT LE DÉPART ✓', FF.stencil, 28, 10]] },
    DECLARE: { x: -200, y: -34, r: -.045, col: C.violetD, w: 374, h: 170, lines: [['DÉCLARÉ', FF.stencil, 64, -12], ["avant l'arrivée", FF.hand, 44, 56]] },
    EXPORT: { x: -200, y: -34, r: -.045, col: '#D84406', w: 300, h: 170, lines: [['DÉCLARÉ', FF.stencil, 64, -12], ['EXPORT', FF.stencil, 58, 58]] },
    CONTROLE: { x: 200, y: -118, r: .08, col: DC.blue, round: 124, label: 'CONTRÔLÉ' },
    PAYE: { x: 206, y: 78, r: .07, col: DC.green, w: 236, h: 108, lines: [['PAYÉ', FF.stencil, 78, 28]] },
    BAE: { x: 0, y: 194, r: -.045, col: DC.red, w: 566, h: 100, lines: [['BON À ENLEVER', FF.stencil, 72, 26]] },
    VRAIS: { x: 200, y: 36, r: -.03, col: '#FFF3D6', cover: true, w: 214, h: 74, lines: [['VRAIS', FF.stencil, 56, 20]] },
    COMPLETS: { x: 200, y: 112, r: .025, col: '#FFF3D6', cover: true, w: 300, h: 74, lines: [['COMPLETS', FF.stencil, 56, 20]] },
    AVANCE: { x: 200, y: 188, r: -.02, col: '#FFF3D6', cover: true, w: 316, h: 74, lines: [["À L'AVANCE", FF.stencil, 56, 20]] },
  };
  // ---------- the events (lazy: the timeline is only known at draw time) ----------
  let EV = null;
  function events() {
    if (EV) return EV;
    const has24 = typeof window.T24 !== 'undefined';
    EV = [
      { id: 'S9', owner: 'junior', tIn: has24 ? T24.takeoff() : tw('S9', 'Declaration', -.05), ax: 540, fromWorld: has24 ? T24.passportWorld : null, s0: .26,
        stamps: [{ key: 'DECLARE', t: tw('S9', 'avant', 0) }], slip: 'decl', hold: 1.5 },
      { id: 'S13', owner: 'mireille', stamps: [{ key: 'EXPORT', t: tw('S13', 'declare', 0) }], slip: 'decl', hold: 1.6 },
      { id: 'S18', owner: 'junior', stamps: [{ key: 'CONTROLE', t: tw('S18', 'correspond', 0) }], tEnd: tw('S18', 'Car', .45), exit: 'fade' },
      { id: 'S20', owner: 'junior', cover: true, ax: 540, lead: 1.15, stamps: (() => { const a = tw('S20', 'vrais', 0), b = Math.max(tw('S20', 'complets', 0), a + .7), c = Math.max(tw('S20', 'avance', 0), b + .7);   // ≥ .7 s apart: one stamp tool at a time
        return [{ key: 'VRAIS', t: a }, { key: 'COMPLETS', t: b }, { key: 'AVANCE', t: c }]; })(), hold: 1.4 },
      { id: 'S21', owner: 'junior', stamps: [{ key: 'PAYE', t: te('S21', 'quittance', .05) }, { key: 'BAE', t: tw('S22', 'enlever', 0) }], slip: 'quit', tEnd: tw('S22', 'sort', .5) },
    ].filter(e => e.stamps.every(s => isFinite(s.t) && s.t < 9e4));
    for (const e of EV) {
      const first = e.stamps[0].t, last = e.stamps[e.stamps.length - 1].t;
      e.tIn = e.tIn ?? first - (e.lead ?? 1.0); e.tEnd = e.tEnd ?? last + (e.hold ?? 1.5);
      e.tOpen = e.tIn + .4; e.tSlip = e.tIn + .55;
    }
    for (const e of EV) for (const s of e.stamps) addShake(s.t, e.cover ? 8 : s.key === 'BAE' ? 16 : 12, s.key === 'BAE' ? .16 : .14);   // once (EV is cached)
    return EV;
  }
  // every stamp an owner has at time t (the booklet only ever grows)
  function owned(owner, t) {
    const out = owner === 'junior' ? [{ key: 'AVANT', t: -1 }] : [];
    for (const e of events()) if (e.owner === owner) for (const s of e.stamps) if (t >= s.t) out.push(s);
    return out;
  }
  const slipsOf = (owner, t) => events().filter(e => e.owner === owner && e.slip && t >= (e.slip === 'quit' ? e.stamps[0].t - .5 : e.tSlip)).map(e => ({ kind: e.slip, t0: e.slip === 'quit' ? e.stamps[0].t - .5 : e.tSlip }));

  // ---------- ink stamps (built once on offscreen canvases: box/round + starved ink) ----------
  const CACHE = {};
  function stampCanvas(key) {
    if (CACHE[key]) return CACHE[key]; const s = ST[key];
    const W_ = (s.round ? s.round * 2 : s.w) + 40, H_ = (s.round ? s.round * 2 : s.h) + 40, c = makeCanvas(W_, H_), g = c.getContext('2d');
    g.translate(W_ / 2, H_ / 2); g.strokeStyle = s.col; g.fillStyle = s.col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (s.round) {
      const R = s.round; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, R - 6, 0, 7); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R - 22, 0, 7); g.stroke();
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (Math.abs(Math.sin(a)) < .45) continue; g.beginPath(); g.arc(Math.cos(a) * (R - 14), Math.sin(a) * (R - 14), 3.2, 0, 7); g.fill(); }
      g.font = font(FF.stencil, 44, 900); g.letterSpacing = '2px'; g.fillText(s.label, 0, 16);
      g.lineWidth = 3; g.beginPath(); g.moveTo(-86, -30); g.lineTo(86, -30); g.moveTo(-86, 32); g.lineTo(86, 32); g.stroke();
      g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-22, -66); g.lineTo(-6, -50); g.lineTo(24, -82); g.stroke();
      g.beginPath(); g.moveTo(-18, 58); g.lineTo(18, 58); g.stroke();
    } else {
      g.lineWidth = 8; rrectOn(g, -s.w / 2 + 4, -s.h / 2 + 4, s.w - 8, s.h - 8, 14); g.stroke();
      if (s.h > 90) { g.lineWidth = 3; rrectOn(g, -s.w / 2 + 14, -s.h / 2 + 14, s.w - 28, s.h - 28, 8); g.stroke(); }
      for (const [txt, fam, size, by] of s.lines) { g.font = font(fam, size, 900); g.letterSpacing = (fam === FF.stencil ? 3 : 0) + 'px';
        const mw = g.measureText(txt).width, lim = s.w - 34; if (mw > lim) g.font = font(fam, size * lim / mw, 900); g.fillText(txt, 0, by); }
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = s.cover ? .35 : .42;
    g.drawImage(TEX.starve, 0, 0, W_, H_); g.drawImage(TEX.starve, W_ * .2, H_ * .1, W_ * .7, H_ * .8);
    return (CACHE[key] = c);
  }
  function inkStamp(key, t0, t) {                                   // the ink on the page (appears at t0 with a tiny settle)
    const s = ST[key], c = stampCanvas(key), k = t - t0; if (k < 0) return;
    const sc = 1 + .08 * Math.exp(-k * 16) * Math.cos(k * 30);
    at(s.x, s.y, s.r, sc, sc, () => { ctx.save(); ctx.globalAlpha *= (s.alpha ?? .92); ctx.globalCompositeOperation = s.cover ? 'source-over' : 'multiply'; ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore(); });
  }
  function tool(key, t0, t) {                                        // the wooden rubber stamp coming down, then lifting away
    const s = ST[key], d = t - t0; if (d < -.24 || d > .42) return;
    const lift = d < 0 ? 200 * eInCubic(-d / .24) : 170 * eOutCubic(d / .42), a = d < .08 ? 1 : 1 - (d - .08) / .22;
    const bw = Math.min(s.round ? s.round * 1.7 : s.w * .92, 300), bh = 46;
    at(s.x + (d > 0 ? lift * .4 : 0), s.y - lift, s.r, 1, 1, () => { ctx.save(); ctx.globalAlpha *= clamp(a);
      ctx.shadowColor = 'rgba(40,20,10,.35)'; ctx.shadowBlur = 20 + lift * .1; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 18 + lift * .25;
      ctx.fillStyle = TEX.kraft; rrect(-bw / 2, -bh, bw, bh, 8); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = s.col === '#FFF3D6' ? '#B98A3A' : s.col; ctx.fillRect(-bw / 2 + 6, -8, bw - 12, 8);
      ctx.fillStyle = '#6B4A2A'; rrect(-18, -bh - 56, 36, 60, 10); ctx.fill();
      ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(0, -bh - 70, 30, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(-9, -bh - 80, 9, 0, 7); ctx.fill(); ctx.restore(); });
  }

  // ---------- the booklet ----------
  function pageBase(x0) {                                            // cream page [x0, x0 + PW] with guilloche lines
    withShadow(14, () => { ctx.fillStyle = '#F7F2E4'; rrect(x0, -PH / 2, PW, PH, 14); ctx.fill(); });
    ctx.fillStyle = '#E9E0CB'; ctx.fillRect(x0 + 4, PH / 2 - 3, PW - 8, 5);
    ctx.save(); rrect(x0, -PH / 2, PW, PH, 14); ctx.clip(); ctx.strokeStyle = 'rgba(14,107,78,.10)'; ctx.lineWidth = 2;
    for (let r = 0; r < 14; r++) { ctx.beginPath(); for (let x = x0; x <= x0 + PW; x += 16) { const y = -PH / 2 + 30 + r * 36 + Math.sin(x * .03 + r) * 6; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    const g = ctx.createLinearGradient(x0 < 0 ? -30 : 30, 0, 0, 0); g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, 'rgba(60,40,20,.16)');
    ctx.fillStyle = g; ctx.fillRect(x0 < 0 ? -30 : 0, -PH / 2, 30, PH); ctx.restore();
  }
  function slip(kind, t0, t) {                                       // documents tucked into the booklet
    const k = eOutCubic(clamp((t - t0) / .3)); if (k <= 0) return;
    if (kind === 'decl') at(-204, 104 - (1 - k) * 260, -.03, 1, 1, () => { ctx.save(); ctx.globalAlpha *= k;
      withShadow(6, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-120, -44, 240, 92); }); ctx.fillStyle = DC.green; ctx.fillRect(-120, -44, 240, 32);
      text('DÉCLARATION', 0, -19, { font: font(FF.stencil, 24, 900), align: 'center', color: '#fff', ls: 1 });
      ctx.strokeStyle = DC.line; ctx.lineWidth = 3; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(-100, 8 + i * 22); ctx.lineTo(96 - i * 50, 8 + i * 22); ctx.stroke(); } ctx.restore(); });
    else at(214, 66 - (1 - k) * 260, .06, 1, 1, () => { ctx.save(); ctx.globalAlpha *= k;
      withShadow(6, () => { ctx.fillStyle = '#FFFEF8'; ctx.beginPath(); ctx.moveTo(-110, -86); ctx.lineTo(110, -86); ctx.lineTo(110, 66);
        for (let x = 110; x > -110; x -= 20) { ctx.lineTo(x - 10, 54); ctx.lineTo(x - 20, 66); } ctx.closePath(); ctx.fill(); });
      text('QUITTANCE', 0, -54, { font: font(FF.mono, 26, 700), align: 'center', color: C.ink });
      ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-90, -40); ctx.lineTo(90, -40); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = DC.line; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-90, -14 + i * 24); ctx.lineTo(80 - (i % 2) * 50, -14 + i * 24); ctx.stroke(); } ctx.restore(); });
  }
  function leftPage(owner, t) {
    const O = OWN[owner]; pageBase(-PW);
    text(O.name, -PW + 34, -PH / 2 + 56, { font: font(FF.hand, 36, 800), color: O.col });
    ctx.strokeStyle = O.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-PW + 34, -PH / 2 + 70); ctx.lineTo(-PW + 34 + measure(O.name, font(FF.hand, 36, 800)), -PH / 2 + 70); ctx.stroke();
    for (const s of slipsOf(owner, t)) if (s.kind === 'decl') slip('decl', s.t0, t);
    for (const s of owned(owner, t)) if (ST[s.key].x < 0 && !ST[s.key].cover) inkStamp(s.key, s.t, t);
    halfSpread(owner, t, -1);
  }
  function rightPage(owner, t) {
    pageBase(0);
    for (const s of slipsOf(owner, t)) if (s.kind === 'quit') slip('quit', s.t0, t);
    for (const s of owned(owner, t)) if (ST[s.key].x > 0 && !ST[s.key].cover) inkStamp(s.key, s.t, t);
    halfSpread(owner, t, 1);
  }
  function halfSpread(owner, t, side) {                              // stamps across the spine: each page carries its half (so it folds with it)
    ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? -PW : 0, -PH / 2 - 40, PW, PH + 80); ctx.clip();
    for (const s of owned(owner, t)) if (ST[s.key].x === 0 && !ST[s.key].cover) inkStamp(s.key, s.t, t);
    ctx.restore();
  }
  function coverFace(owner, t) {                                     // closed cover over [0, PW]
    withShadow(16, () => { ctx.fillStyle = DC.green; rrect(0, -PH / 2, PW, PH, 16); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0, -PH / 2 + 10, 14, PH - 20);
    ctx.strokeStyle = 'rgba(246,197,74,.9)'; ctx.lineWidth = 4; rrect(16, -PH / 2 + 16, PW - 32, PH - 32, 10); ctx.stroke();
    text('PASSEPORT', PW / 2, -PH / 2 + 86, { font: font(FF.stencil, 58, 900), align: 'center', color: DC.yellow, ls: 4 });
    text('DE LA MARCHANDISE', PW / 2, -PH / 2 + 124, { font: font(FF.body, 28, 800), align: 'center', color: DC.yellow });
    at(PW / 2, -60, 0, 1, 1, () => carton(96, 68, { seed: 5 }));
    for (const s of owned(owner, t)) if (ST[s.key].cover) inkStamp(s.key, s.t, t);
  }
  function ribbon(owner) {
    ctx.fillStyle = OWN[owner].ribbon; ctx.beginPath(); ctx.moveTo(10, PH / 2 - 14); ctx.lineTo(38, PH / 2 - 14); ctx.lineTo(38, PH / 2 + 74); ctx.lineTo(24, PH / 2 + 60); ctx.lineTo(10, PH / 2 + 74); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(14, PH / 2 - 10, 5, 76);
  }
  /** the booklet centred on its visual centre: open 0 = closed cover, 1 = spread */
  function booklet(owner, open, t, stampsNow) {
    const o = eInOutCubic(clamp(open)), cx = -PW / 2 * (1 - o), sx = Math.cos(o * Math.PI);
    ctx.save(); ctx.translate(cx, 0);
    ribbon(owner);
    if (o > 0) rightPage(owner, t);
    if (sx > 0) at(0, 0, 0, sx, 1, () => coverFace(owner, t));
    else at(0, 0, 0, -sx, 1, () => leftPage(owner, t));
    for (const s of stampsNow) tool(s.key, s.t, t);
    ctx.restore();
  }

  // ---------- choreography ----------
  function ownerHand(owner, t) {
    const st = actorAt(owner, t); if (!st) return { x: -200, y: 900 };
    return worldToScreen(st.x + OWN[owner].side * 35, st.y + 75, t);
  }
  function anchorX(e) {
    if (e.ax != null) return e.ax; if (e._ax != null) return e._ax;
    const h = ownerHand(e.owner, e.tIn); return (e._ax = clamp(.25 * h.x + .75 * 540, 480, 600));
  }
  /** full state of an event at time t: {x, y, s, r, a, open} or null */
  function evState(e, t) {
    if (t < e.tIn || t > e.tEnd + .45) return null;
    const ax = anchorX(e), ay = AY;
    const from = e.fromWorld ? worldToScreen(e.fromWorld[0], e.fromWorld[1], t) : ownerHand(e.owner, t);
    let x = ax, y = ay, s = 1, r = -.02, a = 1;
    const u = clamp((t - e.tIn) / .45);
    if (u < 1) { const k = eOutCubic(u); x = lerp(from.x, ax, k); y = lerp(from.y, ay, k) + Math.sin(u * Math.PI) * 50; s = lerp(e.s0 ?? .16, 1, k); r = lerp(-.4, -.02, k); }
    let open = e.cover ? 0 : eInOutCubic(clamp((t - e.tOpen) / .38));
    if (t > e.tEnd) {
      if (e.exit === 'fade') a = 1 - clamp((t - e.tEnd) / .3);
      else { const v = clamp((t - e.tEnd) / .42), k = eInCubic(v), to = ownerHand(e.owner, t);
        x = lerp(ax, to.x, k); y = lerp(ay, to.y, k) + Math.sin(v * Math.PI) * 40; s = lerp(1, .14, k); r = lerp(-.02, .3, k); a = 1 - clamp((v - .65) / .35); }
    }
    if (!e.cover && e.exit !== 'fade') open *= 1 - eInOutCubic(clamp((t - (e.tEnd - .32)) / .3));
    return { x, y, s, r, a, open };
  }
  function active(t) { for (const e of events()) { const st = evState(e, t); if (st && st.a > .005) return { e, st }; } return null; }

  // ---------- public API ----------
  window.P46 = {
    shown: t => !!active(t),
    window: id => { const e = events().find(q => q.id === id); return e ? { tIn: e.tIn, tEnd: e.tEnd } : null; },
    stampScreen(key, t) {
      const e = events().find(q => q.stamps.some(s => s.key === key)); if (!e) return null; const st = evState(e, t); if (!st) return null;
      const S = ST[key], o = eInOutCubic(clamp(st.open)), lx = S.x - PW / 2 * (1 - o), cs = Math.cos(st.r), sn = Math.sin(st.r);
      return { x: st.x + (lx * cs - S.y * sn) * st.s, y: st.y + (lx * sn + S.y * cs) * st.s, r: (S.round || Math.max(S.w, S.h) / 2) * st.s, a: st.a };
    },
  };

  registerScene({ id: 'passeport', z: 52, draw(t, n) {
    const A = active(t); if (!A) return;
    const { e, st } = A, sh = shake(t, n);
    ctx.save(); ctx.translate(sh.x, sh.y); ctx.globalAlpha *= st.a;
    at(st.x, st.y, st.r, st.s, st.s, () => booklet(e.owner, st.open, t, e.stamps));
    ctx.restore();
  } });
})();

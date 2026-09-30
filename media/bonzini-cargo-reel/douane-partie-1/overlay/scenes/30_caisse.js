'use strict';
// =============================================================================================
// 30_caisse — ⑤ LE KIOSQUE DE PAIEMENT (world x ≈ 4940…5720, X.caisse = 5200), Friday late afternoon (S21–S22).
//  Always there (world): a paper payment machine (« borne ») under a cream sign « CANAL OFFICIEL », a screen with three
//          GENERIC channel icons (bank counter · card · mobile — no brand, no logo), an envelope slot, a status lamp, a
//          printer mouth; a small clock (late afternoon) hanging from the sign; a bench and a potted plant on the right
//          (kept LOW: the bête stands above the rooftops in the right third of the frame).
//  S21 « Junior »      : he pulls out the envelope « DOUANE · MIS DE CÔTÉ » (same look as in his folder, S9) and holds it up.
//      « canal »       : the envelope slides into the slot; the lamp turns green, the three channel tiles glow one by one.
//      « officiel »    : the printer prints a GENERIC « QUITTANCE » (never the real receipt): the paper grows on twos.
//      « quittance »   : the quittance tears off and flies into the passport (46 shows it tucked in + stamps « PAYÉ »).
//  S22                 : calm — 46 stamps « BON À ENLEVER » on the passport; the machine stays paid (green lamp).
// z 28 (world: machine, behind the actors) · 20 (world: bench, plant) · 33 (world: the envelope in Junior's hand, the printed
// quittance, in front of the actors) · 51 (screen: the quittance flying under the passport booklet).
// =============================================================================================
(() => {
  const Y = h => GROUND - h;
  // the machine stands just right of where Junior stops in S21 (resolved once from the actor keys), and never beyond x 5400:
  // above the rooftops, the right third of the frame belongs to the bête (44).
  let KX0 = 4995, KX1 = 5295, KC = 5145, SLOT = null, MOUTH = null, LAMP = null, HOLD = null, SIGNW = 400, GEO = false;
  const KH = 700, SIGN = { h0: 728, h1: 830 }, SCR = { h0: 420, h1: 612 };
  const QW = 240, QH = 226, ENV = { w: 200, h: 124 };
  function geo() {
    if (GEO) return; GEO = true;
    const j = actorAt('junior', tw('S21', 'règle', .3)), jx = j ? j.x : X.caisse - 300;
    KX1 = Math.min(5400, jx + 92 + 300); KX0 = KX1 - 300; KC = (KX0 + KX1) / 2; SIGNW = Math.min(400, 2 * (5408 - KC));
    SLOT = { x0: KX0 + 16, x1: KX0 + 160, h: 300 };
    MOUTH = { x: KC + 14, h: 236, w: 262 };
    LAMP = { x: KX1 - 40, h: 364 };
    HOLD = { x: (SLOT.x0 + SLOT.x1) / 2, y: Y(SLOT.h) - ENV.h / 2 - 12 };
  }
  const visX = (x0, x1, t, m = 140) => { const c = camAt(t); if (Math.abs(c.r) > .01) return true; const hw = W / 2 / c.z + m; return x1 > c.x - hw && x0 < c.x + hw; };

  // ---------- time table (lazy) ------------------------------------------------------------------
  let K = null;
  function keys() {
    if (K) return K;
    geo();
    const k = {
      env0: tw('S21', 'Junior', -.3), ins0: tw('S21', 'canal', -.2), fly0: tw('S21', 'quittance', -.25),
      s21e: se('S21', 0), s22e: se('S22', 0),
    };
    k.env1 = k.env0 + .62;
    k.ins1 = k.ins0 + .42; k.paid = k.ins1 + .04;
    k.prn0 = Math.max(k.paid + .3, te('S21', 'officiel', -.15)); k.prn1 = k.prn0 + .62;
    k.fly0 = Math.max(k.fly0, k.prn1 + .25); k.fly1 = k.fly0 + .42;
    addShake(k.ins1 - .06, 3, .09);                                       // the envelope drops into the machine (paper « clac »)
    return (K = k);
  }

  // ---------- shared drawings --------------------------------------------------------------------
  /** the envelope « DOUANE · MIS DE CÔTÉ » — same drawing as in Junior's folder (24_transit, S9), centred, 200×124 */
  function envelope() {
    withShadow(6, () => { ctx.fillStyle = '#F3E6C8'; ctx.fillRect(-100, -62, 200, 124); });
    ctx.fillStyle = '#9FC7A6'; at(40, -64, .12, 1, 1, () => { ctx.fillRect(-40, -14, 80, 30); ctx.strokeStyle = DC.green; ctx.lineWidth = 2; ctx.strokeRect(-36, -10, 72, 22); });
    ctx.fillStyle = '#E6D3AC'; ctx.beginPath(); ctx.moveTo(-100, -62); ctx.lineTo(100, -62); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 2; ctx.stroke();
    text('DOUANE', 0, 18, { font: font(FF.stencil, 40, 900), align: 'center', color: DC.green, ls: 2 });
    text('MIS DE CÔTÉ', 0, 54, { font: font(FF.stencil, 35, 900), align: 'center', color: C.ink, ls: 1 });
  }
  /** the generic quittance, pre-rendered once (2× for the flight), drawn with its top-left at (0,0), QW × QH */
  let QC = null;
  function quittanceCanvas() {
    if (QC) return QC;
    const S = 2, c = makeCanvas(QW * S, (QH + 14) * S), g = c.getContext('2d'); g.scale(S, S);
    g.fillStyle = '#FFFEF8'; g.beginPath(); g.moveTo(0, 0); g.lineTo(QW, 0); g.lineTo(QW, QH - 8);
    for (let x = QW; x > 0; x -= 20) { g.lineTo(x - 10, QH + 4); g.lineTo(x - 20, QH - 8); } g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.035)'; for (let i = 0; i < 18; i++) g.fillRect(0, 8 + i * 12, QW, 1);          // thermal paper
    g.fillStyle = C.ink; g.font = font(FF.mono, 40, 800); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const mw = g.measureText('QUITTANCE').width; if (mw > QW - 16) g.font = font(FF.mono, 40 * (QW - 16) / mw, 800);
    g.fillText('QUITTANCE', QW / 2, 52);
    g.strokeStyle = 'rgba(35,22,41,.45)'; g.setLineDash([8, 7]); g.lineWidth = 2; g.beginPath(); g.moveTo(16, 70); g.lineTo(QW - 16, 70); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(35,22,41,.22)'; g.lineWidth = 7; g.lineCap = 'round';
    [[20, 100, 190], [20, 128, 128], [20, 156, 170], [20, 184, 96]].forEach(([x, y, w]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); });
    g.strokeStyle = 'rgba(14,107,78,.45)'; g.lineWidth = 2.5; g.setLineDash([5, 5]); g.beginPath(); g.arc(QW - 42, 186, 24, 0, 7); g.stroke(); g.setLineDash([]);   // empty generic seal ring
    return (QC = c);
  }
  function quittance(len) {                                            // hanging from the mouth: revealed top-first, length len
    const c = quittanceCanvas(), L = clamp(len, 0, QH + 8); if (L <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.rect(-QW / 2 - 4, 0, QW + 8, L + 6); ctx.clip();
    withShadow(5, () => ctx.drawImage(c, -QW / 2, 0, QW, QH + 14));
    ctx.restore();
    if (L < QH - 4) { ctx.fillStyle = '#FFFEF8'; ctx.beginPath(); ctx.moveTo(-QW / 2, L - 6);                    // torn/zigzag leading edge
      for (let x = -QW / 2; x < QW / 2; x += 20) { ctx.lineTo(x + 10, L + 4); ctx.lineTo(x + 20, L - 6); } ctx.lineTo(QW / 2, L - 12); ctx.lineTo(-QW / 2, L - 12); ctx.closePath(); ctx.fill(); }
  }
  // ---------- generic channel icons (never a brand) ----------------------------------------------
  function iconBank(s, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-s * .5, -s * .18); ctx.lineTo(0, -s * .46); ctx.lineTo(s * .5, -s * .18); ctx.closePath(); ctx.fill();
    ctx.fillRect(-s * .46, -s * .16, s * .92, s * .08);
    for (let i = 0; i < 4; i++) ctx.fillRect(-s * .38 + i * s * .24, -s * .05, s * .1, s * .36);
    ctx.fillRect(-s * .5, s * .33, s, s * .1);
  }
  function iconCard(s, col) {
    ctx.fillStyle = col; rrect(-s * .5, -s * .32, s, s * .64, s * .08); ctx.fill();
    ctx.fillStyle = '#231629'; ctx.fillRect(-s * .5, -s * .18, s, s * .12);
    ctx.fillStyle = '#E2B33F'; rrect(-s * .38, s * .02, s * .2, s * .15, s * .03); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-s * .1, s * .14, s * .44, s * .05);
  }
  function iconMobile(s, col) {
    ctx.fillStyle = col; rrect(-s * .24, -s * .42, s * .4, s * .84, s * .08); ctx.fill();
    ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-s * .19, -s * .32, s * .3, s * .56);
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-s * .04, s * .33, s * .04, 0, 7); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = s * .06; ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(s * .12, -s * .36, s * (.18 + i * .14), -1.2, -.25); ctx.stroke(); }
  }

  // ---------- the machine ------------------------------------------------------------------------
  function machine(t, n) {
    const k = keys(), paid = t >= k.paid, w = KX1 - KX0;
    // plinth + body (rounded top) + a darker side strip for depth
    ctx.fillStyle = '#3A3040'; ctx.fillRect(KX0 + 12, Y(44), w - 24, 44);
    withShadow(16, () => { ctx.fillStyle = '#E3EEE7'; rrect(KX0, Y(KH), w, KH - 40, 30); ctx.fill(); });
    ctx.fillStyle = '#C3D8CC'; ctx.fillRect(KX1 - 20, Y(KH - 24), 20, KH - 84);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(KX0 + 14, Y(KH - 18), 8, KH - 90);
    // green hood band
    ctx.save(); rrect(KX0, Y(KH), w, KH - 40, 30); ctx.clip(); ctx.fillStyle = DC.green; ctx.fillRect(KX0, Y(KH), w, 70);
    ctx.fillStyle = 'rgba(246,197,74,.9)'; ctx.fillRect(KX0, Y(KH - 70), w, 6); ctx.restore();
    // the screen with the three channel tiles
    const sx0 = KX0 + 24, sx1 = KX1 - 30, sy0 = Y(SCR.h1), sy1 = Y(SCR.h0);
    ctx.fillStyle = '#2B2230'; rrect(sx0 - 8, sy0 - 8, sx1 - sx0 + 16, sy1 - sy0 + 16, 16); ctx.fill();
    ctx.fillStyle = '#FBF8EF'; rrect(sx0, sy0, sx1 - sx0, sy1 - sy0, 10); ctx.fill();
    const tiles = [iconBank, iconCard, iconMobile], tw_ = (sx1 - sx0 - 24) / 3, th_ = sy1 - sy0 - 28;
    tiles.forEach((ic, i) => {
      const cx = sx0 + 12 + tw_ * (i + .5), cy = sy0 + 14 + th_ / 2, lit = paid ? env(t, k.paid + .12 + i * .16, k.paid + .12 + i * .16 + .7, .12, .45) : 0;
      ctx.fillStyle = lit > 0 ? `rgba(243,167,69,${.25 + .35 * lit})` : '#EEF3EE'; rrect(cx - tw_ / 2 + 5, sy0 + 14, tw_ - 10, th_, 10); ctx.fill();
      at(cx, cy, 0, 1, 1, () => ic(Math.min(70, (tw_ - 10) * .74), DC.green));
    });
    // status lamp
    ctx.fillStyle = '#2B2230'; rrect(LAMP.x - 22, Y(LAMP.h) - 22, 44, 44, 10); ctx.fill();
    ctx.fillStyle = paid ? '#2BD47E' : '#35503F'; ctx.beginPath(); ctx.arc(LAMP.x, Y(LAMP.h), 13, 0, 7); ctx.fill();
    if (paid) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const a = clamp((t - k.paid) / .25), g = ctx.createRadialGradient(LAMP.x, Y(LAMP.h), 3, LAMP.x, Y(LAMP.h), 70);
      g.addColorStop(0, `rgba(43,212,126,${.55 * a})`); g.addColorStop(1, 'rgba(43,212,126,0)'); ctx.fillStyle = g; ctx.fillRect(LAMP.x - 70, Y(LAMP.h) - 70, 140, 140); ctx.restore(); }
    // envelope slot (kraft lip + dark slit) with a small « insert » chevron
    ctx.fillStyle = C.kraftD; rrect(SLOT.x0 - 10, Y(SLOT.h) - 12, SLOT.x1 - SLOT.x0 + 20, 30, 8); ctx.fill();
    ctx.fillStyle = '#16111A'; rrect(SLOT.x0, Y(SLOT.h) - 3, SLOT.x1 - SLOT.x0, 11, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.45)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(SLOT.x1 + 34, Y(SLOT.h) - 24); ctx.lineTo(SLOT.x1 + 48, Y(SLOT.h) - 8); ctx.lineTo(SLOT.x1 + 62, Y(SLOT.h) - 24); ctx.stroke();
    // printer mouth
    ctx.fillStyle = '#3A3040'; rrect(MOUTH.x - MOUTH.w / 2 - 12, Y(MOUTH.h) - 14, MOUTH.w + 24, 30, 10); ctx.fill();
    ctx.fillStyle = '#120D16'; rrect(MOUTH.x - MOUTH.w / 2, Y(MOUTH.h) - 4, MOUTH.w, 10, 4); ctx.fill();
    // lower cabinet hatch
    ctx.strokeStyle = 'rgba(35,22,41,.16)'; ctx.lineWidth = 3; rrect(KX0 + 30, Y(196), w - 70, 140, 10); ctx.stroke();
    ctx.fillStyle = '#9AA1A8'; rrect(KX1 - 70, Y(130), 14, 30, 5); ctx.fill();
    // sign on two short posts: « CANAL OFFICIEL »
    ctx.fillStyle = '#6B4A2A'; ctx.fillRect(KC - 120, Y(SIGN.h0 + 4), 12, 36); ctx.fillRect(KC + 108, Y(SIGN.h0 + 4), 12, 36);
    at(KC, Y((SIGN.h0 + SIGN.h1) / 2), -.012, 1, 1, () => {
      withShadow(8, () => { ctx.fillStyle = '#FFF8E8'; rrect(-SIGNW / 2, -(SIGN.h1 - SIGN.h0) / 2, SIGNW, SIGN.h1 - SIGN.h0, 12); ctx.fill(); });
      ctx.strokeStyle = DC.green; ctx.lineWidth = 5; rrect(-SIGNW / 2 + 9, -(SIGN.h1 - SIGN.h0) / 2 + 9, SIGNW - 18, SIGN.h1 - SIGN.h0 - 18, 8); ctx.stroke();
      const f0 = font(FF.stencil, 64, 900), fs = Math.min(64, 64 * (SIGNW - 46) / measure('CANAL OFFICIEL', f0, 3));
      text('CANAL OFFICIEL', 0, fs * .36, { font: font(FF.stencil, fs, 900), align: 'center', color: DC.green, ls: 3 });
    });
    // small clock set in the green hood: Friday, late afternoon
    const cx = KC, cy = Y(KH - 36), r = 30;
    withShadow(4, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); });
    ctx.strokeStyle = C.orange; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.stroke();
    ctx.fillStyle = C.ink; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + Math.sin(a) * (r - 9), cy - Math.cos(a) * (r - 9), i % 3 ? 1.4 : 2.6, 0, 7); ctx.fill(); }
    const mn = .75 + t * .0012, hr = (4 + mn) / 12;
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(hr * Math.PI * 2) * r * .45, cy - Math.cos(hr * Math.PI * 2) * r * .45); ctx.stroke();
    ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(mn * Math.PI * 2) * r * .7, cy - Math.cos(mn * Math.PI * 2) * r * .7); ctx.stroke();
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  }
  function sideProps() {                                              // bench + potted plant (LOW: the bête lives up there)
    const bx0 = 5440, bx1 = 5640;
    ctx.fillStyle = '#6B4A2A'; ctx.fillRect(bx0 + 14, Y(118), 14, 118); ctx.fillRect(bx1 - 28, Y(118), 14, 118);
    withShadow(8, () => { ctx.fillStyle = TEX.kraft; rrect(bx0, Y(132), bx1 - bx0, 24, 6); ctx.fill(); });
    ctx.fillStyle = C.kraftD; rrect(bx0 + 6, Y(228), bx1 - bx0 - 12, 20, 6); ctx.fill(); ctx.fillRect(bx0 + 20, Y(212), 10, 84); ctx.fillRect(bx1 - 30, Y(212), 10, 84);
    const px = 5700;                                                    // potted plant
    const leaf = (a, l, col) => at(px, Y(150), a, 1, 1, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(l * .35, -l * .22, l, 0); ctx.quadraticCurveTo(l * .35, l * .18, 0, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(0,40,20,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l * .9, 0); ctx.stroke(); });
    [[-2.2, 150, '#2F7A4E'], [-1.75, 190, '#3E9A62'], [-1.35, 200, '#2F7A4E'], [-1.0, 170, '#3E9A62'], [-.6, 140, '#2F7A4E'], [-2.6, 120, '#3E9A62']].forEach(([a, l, c]) => leaf(a, l, c));
    withShadow(8, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(px - 62, Y(160)); ctx.lineTo(px + 62, Y(160)); ctx.lineTo(px + 46, Y(0)); ctx.lineTo(px - 46, Y(0)); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = '#C44109'; ctx.fillRect(px - 66, Y(172), 132, 22);
  }

  // ---------- the envelope in Junior's hand, then into the slot ----------------------------------
  function envState(t) {
    const k = keys(); if (t < k.env0 || t >= k.ins1) return null;
    const st = actorAt('junior', t); if (!st) return null;
    const hip = { x: st.x + 79, y: st.y + 131 };
    if (t < k.env1) { const u = eOutCubic(prog(t, k.env0, k.env1)); return { x: lerp(hip.x, HOLD.x, u), y: lerp(hip.y, HOLD.y, u) - Math.sin(u * Math.PI) * 40, s: lerp(.45, 1, u), r: lerp(-.35, -.03, u), dy: 0 }; }
    if (t < k.ins0) return { x: HOLD.x, y: HOLD.y, s: 1, r: -.03, dy: 0 };
    const u = eInOutCubic(prog(t, k.ins0, k.ins1));
    return { x: HOLD.x, y: HOLD.y, s: 1, r: lerp(-.03, 0, u), dy: u * (ENV.h + 18) };
  }
  function drawEnvelope(t, n) {
    const e = envState(t); if (!e) return;
    const j = e.dy === 0 ? jit(301, n, .6) : { x: 0, y: 0, r: 0 };
    ctx.save();
    if (e.dy > 0) { ctx.beginPath(); ctx.rect(e.x - 160, e.y - 200, 320, Y(SLOT.h) - (e.y - 200) + 1); ctx.clip(); }   // swallowed by the slot
    at(e.x + j.x, e.y + e.dy + j.y, e.r + j.r, e.s, e.s, envelope);
    ctx.restore();
  }
  poseHook('junior', (t, st) => {
    const k = keys(); if (t < k.env0 - .05 || t > se('S22', 0)) return null;
    const IDLE = [158, 262], toLocal = (x, y) => [(x - st.x) / FIG_S, (y - st.y) / FIG_S];
    let arm = IDLE;
    const e = envState(t);
    if (e) { const hy = Math.min(e.y + e.dy + 22, Y(SLOT.h) - 8); arm = toLocal(e.x - ENV.w / 2 * e.s + 8, hy); }
    else if (t >= k.ins1 && t < k.ins1 + .45) { const u = eInOutCubic(prog(t, k.ins1, k.ins1 + .45)), a = toLocal(HOLD.x - ENV.w / 2 + 8, Y(SLOT.h) - 8); arm = [lerp(a[0], IDLE[0], u), lerp(a[1], IDLE[1], u)]; }
    return { arms: ['idle', arm], face: t >= k.paid ? 'grin' : 'smile' };
  });

  // ---------- the quittance: printed (world), then flying into the passport (screen) --------------
  function printedLen(t, n) {
    const k = keys(); if (t < k.prn0) return 0;
    const u = prog(Math.max(stepT(n), k.prn0 + .001), k.prn0, k.prn1);                   // on twos: the paper advances in little steps
    return (QH + 8) * u;
  }
  function drawPrinted(t, n) {
    const k = keys(); if (t < k.prn0 || t >= k.fly0) return;
    at(MOUTH.x, Y(MOUTH.h) + 6, 0, 1, 1, () => quittance(printedLen(t, n)));
  }
  function drawFlight(t, n) {
    const k = keys(); if (t < k.fly0 || t > k.fly1) return;
    const u = prog(t, k.fly0, k.fly1), e = eInOutCubic(u), c = camAt(t);
    const p0 = worldToScreen(MOUTH.x, Y(MOUTH.h) + 6 + QH / 2, t);
    const tg = (window.P46 && P46.stampScreen('PAYE', t)) || { x: 700, y: 560 };
    const x = lerp(p0.x, tg.x - 6, e), y = lerp(p0.y, tg.y - 12, e) - Math.sin(u * Math.PI) * 160;
    const s = lerp(c.z, .9, e), r = lerp(0, .06, e) + Math.sin(u * Math.PI) * -.12;
    ctx.save(); ctx.globalAlpha *= 1 - clamp((u - .72) / .28);
    at(x, y, r, s, s, () => { ctx.save(); ctx.shadowColor = 'rgba(40,20,10,.3)'; ctx.shadowBlur = 16 + 30 * Math.sin(u * Math.PI); ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12 + 30 * Math.sin(u * Math.PI);
      ctx.drawImage(quittanceCanvas(), -QW / 2, -QH / 2, QW, QH + 14); ctx.restore(); });
    ctx.restore();
  }

  // ---------- scenes -------------------------------------------------------------------------------
  registerScene({ id: 'E30_side', z: 20, draw(t, n) {
    keys(); if (!visX(5420, 5790, t)) return;
    ctx.save(); worldBegin(t); sideProps(); ctx.restore();
  } });
  registerScene({ id: 'E30_machine', z: 28, draw(t, n) {
    keys(); if (!visX(KX0 - 120, KX1 + 80, t)) return;
    ctx.save(); worldBegin(t); machine(t, n); ctx.restore();
  } });
  registerScene({ id: 'E30_hand', z: 33, draw(t, n) {
    const k = keys(); if (t < k.env0 - .1 || t > k.fly0 + .05 || !visX(KX0 - 200, KX1, t)) return;
    ctx.save(); worldBegin(t); drawPrinted(t, n); drawEnvelope(t, n); ctx.restore();
  } });
  registerScene({ id: 'E30_fly', z: 51, draw(t, n) { drawFlight(t, n); } });
})();

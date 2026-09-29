'use strict';
// S13 « ticket » + S14 « haggle » — full frame (the note spine is gone).
// S13: an unbranded receipt printer prints the LOT ticket line by line on the spoken numbers, hold, tear;
//      two price tags on violet thread « PRIX DE VENTE 10 000 F » = « PRIX DE REVIENT 10 000 F ».
// S14: Junior's market stall: a client in wax haggles « Mon fils, laisse à 9 000 ! », Junior nods, the tag is struck
//      and rewritten 9 000 F, the old biscuit tin « CAISSE » (hole « −1 000 ») gets notes but its level drops,
//      loss counter −1 000 → −95 000 F, strips « PLUS IL VEND… » / « PLUS IL PERD ». Ends under the tape wipe of S15.
(() => {
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth);
  const PX = 540, PY = 300, TW = 820, FS = 40;               // printer slot, ticket width, row font size
  const ROWS = [['Fournisseur', 500000], ['Taux + frais', 15000], ['Camion Chine', 20000], ['Bateau', 80000], ['Douane', 300000], ['Petits frais', 35000]];
  const TAG = { w: 370, h: 360, ax: 280, bx: 790, y: 560 }; // tag hole y (S13)
  const STALL = { top: 1010, jx: 812, jy: 905, js: .64, cx: 258, cy: 962, cs: .7, tinX: 540, tinY: 1022, tw: 286, th: 240 };
  function times() {
    const ch = TL.ch('ticket'), ch2 = TL.ch('haggle'), s13 = TL.seg('S13'), s14 = TL.seg('S14');
    const o = { ch, ch2, s13, s14, end: TL.ch('formule').start,
      lot: w('S13', 'lot'), n950: w('S13', '950'), n95: w('S13', '95', 1), paires: w('S13', 'paires'), n10: w('S13', '10'), la: w('S13', 'la'), paireE: TL.we('S13', 'paire', null, 1),
      son: w('S13', 'son'), revient: w('S13', 'revient'), cest: w('S13', 'cest'), vente: w('S13', 'vente'),
      cliente: w('S14', 'cliente'), mon: w('S14', 'mon'), laisse: w('S14', 'laisse'), n9: w('S14', '9'), n9e: TL.we('S14', '000'),
      junior: w('S14', 'junior'), accepte: w('S14', 'accepte'), plus1: w('S14', 'plus'), vend: w('S14', 'vend'), plus2: w('S14', 'plus', null, 1), perd: w('S14', 'perd') };
    o.pTitle = ch.start + .42;
    const r0 = o.pTitle + .3, r1 = o.n950 - .16;
    o.pRows = ROWS.map((_, i) => lerp(r0, r1, i / (ROWS.length - 1)));
    o.done = o.n10 + .35;                                                  // ticket complete
    o.tear = Math.max(o.done + 1.0, o.son - .18);
    o.tagA = o.tear + .12; o.tagB = o.revient - .14;
    o.eq = o.cest;                                                          // marker « = »
    o.x = ch2.start - .12;                                                  // S13 → S14 re-layout
    o.walkIn = o.cliente - .15;
    o.bubble = o.mon - .12;
    o.nod = o.junior; o.strike = o.accepte; o.rewrite = o.accepte + .22;
    o.sale1 = o.accepte + .55;                                              // first 9 000 note into the tin
    o.salesA = o.plus1; o.salesB = Math.min(o.perd - .25, o.plus1 + 1.5);   // 95 sales, accelerating
    return o;
  }
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);

  // ------------------------------------------------------------------ small props
  function pen(x, y, col = C.ink, rot = -.45, s = .55) { at(x, y, 0, s, s, () => marker(0, 0, rot, col)); }
  /** receipt printer without any brand (top view, light grey plastic so the spine's EXEMPLE FICTIF stamp stays legible over it), slot at y=0 */
  function printer(w, t, n, busy) {
    ctx.save();
    withShadow(18, () => { ctx.fillStyle = '#CFC7B8'; rrect(-w / 2, -w * .42, w, w * .46, 26); ctx.fill(); });
    ctx.fillStyle = '#E4DED2'; rrect(-w / 2 + 16, -w * .42 + 14, w - 32, w * .3, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w / 2 + 30, -w * .42 + 24, w - 60, 8);
    ctx.strokeStyle = 'rgba(35,22,41,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 40, -w * .12); ctx.lineTo(w / 2 - 40, -w * .12); ctx.stroke();   // lid seam
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#A99F8E'; rrect(-w / 2 + 60 + i * 26, -84, 12, 46, 6); ctx.fill(); }      // vents
    ctx.fillStyle = C.amber; rrect(w / 2 - 170, -78, 70, 34, 10); ctx.fill();                                              // feed button
    const on = busy ? Math.floor(n / 3) % 2 : Math.floor(n / 20) % 2, led = on ? '#2BD968' : '#1E5B35';
    ctx.fillStyle = led; ctx.beginPath(); ctx.arc(w / 2 - 60, -61, 11, 0, 7); ctx.fill();
    if (on) { ctx.fillStyle = 'rgba(43,217,104,.3)'; ctx.beginPath(); ctx.arc(w / 2 - 60, -61, 22, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2B2230'; rrect(-w / 2 + 26, -14, w - 52, 22, 8); ctx.fill();                                         // slot lip
    ctx.fillStyle = '#16111A'; rrect(-w / 2 + 30, -10, w - 60, 16, 6); ctx.fill();                                         // slot
    ctx.fillStyle = '#8C939B'; ctx.beginPath(); ctx.moveTo(-w / 2 + 30, 8);                                                  // serrated tear bar
    for (let x = -w / 2 + 30; x < w / 2 - 30; x += 14) { ctx.lineTo(x + 7, 16); ctx.lineTo(x + 14, 8); } ctx.lineTo(w / 2 - 30, 4); ctx.lineTo(-w / 2 + 30, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function zig(x0, x1, y, amp = 12, z = 18, dir = 1) { for (let x = x1; x > x0; x -= z) { ctx.lineTo(x - z / 2, y - amp * dir); ctx.lineTo(x - z, y); } }
  function card(cw, ch, fill = C.cream, seed = 1) {
    withShadow(8, () => { ctx.fillStyle = fill; ctx.beginPath(); const tp = tornLine(-cw / 2, -ch / 2, cw / 2, -ch / 2, seed, 2, 12), bt = tornLine(cw / 2, ch / 2, -cw / 2, ch / 2, seed + 5, 2, 12);
      ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  function fitFont(fam, s, size, wght, maxW) { const f = font(fam, size, wght), m = measure(s, f); return m > maxW ? font(fam, size * maxW / m, wght) : f; }
  function swipe(x, y, wd, h, k, col) { if (k <= 0) return; ctx.save(); ctx.fillStyle = col; ctx.beginPath(); const ww = wd * eOutCubic(k); ctx.moveTo(x, y + 3); ctx.lineTo(x + ww, y); ctx.lineTo(x + ww - 3, y + h); ctx.lineTo(x + 2, y + h + 3); ctx.closePath(); ctx.fill(); ctx.restore(); }

  // ------------------------------------------------------------------ S13: the LOT ticket
  // content layout (paper y from the slot): [y bottom of element, print time, draw fn]
  function ticketItems() {
    const mono = font(FF.mono, FS, 600), x0 = -TW / 2 + 30, x1 = TW / 2 - 30;
    const it = [];
    it.push([130, T.pTitle, () => text('LOT : 100 PAIRES', 0, 108, { font: fitFont(FF.mono, 'LOT : 100 PAIRES', 48, 800, TW - 80), align: 'center', color: C.ink, ls: 2 })]);
    it.push([200, T.pTitle + .14, () => at(0, 168, -.03, 1, 1, () => stampText('EXEMPLE FICTIF', 0, 0, font(FF.stencil, 46, 900), C.violetD, { box: true, boxW: 5, h: 70, ls: 3, starve: .35 }))]);
    it.push([222, T.pTitle + .2, () => { ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.setLineDash([9, 8]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, 215); ctx.lineTo(x1, 215); ctx.stroke(); ctx.restore(); }]);
    ROWS.forEach(([lab, v], i) => { const y = 215 + 60 * (i + 1) - 16;
      it.push([y + 18, T.pRows[i], () => { text(lab, x0, y, { font: mono, color: C.ink }); text(fmtN(v), x1, y, { font: mono, color: C.ink, align: 'right' }); }]); });
    it.push([612, T.n950 - .08, () => { ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; for (const y of [596, 604]) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); } ctx.restore(); }]);
    it.push([678, T.n950, () => { const f = font(FF.mono, 46, 800), am = fcfa(950000);
      swipe(x1 - measure(am, f) - 12, 626, measure(am, f) + 24, 50, prog(t_, T.n950 + .12, T.n950 + .4), 'rgba(243,167,69,.55)');
      text('TOTAL', x0, 664, { font: f, color: C.ink }); text(am, x1, 664, { font: f, color: C.ink, align: 'right' }); }]);
    it.push([706, T.n95 - .06, () => { ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.setLineDash([9, 8]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, 700); ctx.lineTo(x1, 700); ctx.stroke(); ctx.restore(); }]);
    it.push([770, T.n95, () => { const s = '÷ 95 paires vendables', f = fitFont(FF.mono, s, 42, 800, TW - 60);
      swipe(-measure(s, f) / 2 - 12, 722, measure(s, f) + 24, 46, prog(t_, T.paires - .05, T.paires + .3), 'rgba(169,71,254,.30)');
      text(s, 0, 756, { font: f, color: C.ink, align: 'center' }); }]);
    it.push([866, T.n10, () => { const s = '= 10 000 F / paire', f = fitFont(FF.mono, s, 58, 800, TW - 70);
      ctx.fillStyle = 'rgba(243,167,69,.30)'; rrect(-TW / 2 + 18, 790, TW - 36, 70, 10); ctx.fill();
      text(s, 0, 845, { font: f, color: C.ink, align: 'center' });
      const c = prog(t_, T.la - .05, T.la + .45); if (c > 0) at(0, 823, -.025, 1, 1, () => handCircle(TW / 2 - 44, 46, c, M.red, 7, 23)); }]);
    return it;
  }
  let t_ = 0, ITEMS = null;
  const TLEN = 900;
  function paperLen(ts) {
    let L = 40; for (const [yb, tp] of ITEMS) { const k = eOutCubic(prog(ts, tp - .02, tp + .12)); if (k > 0) L = Math.max(L, lerp(L, yb + 26, k)); }
    return Math.min(TLEN, Math.max(L, ts >= T.done ? TLEN : L));
  }
  function ticket(t, n) {
    const ts = stepT(n); t_ = t;
    const L = Math.max(paperLen(ts), prog(ts, T.done - .2, T.done) * TLEN);
    const tearS = t - T.tear, torn = tearS >= 0;
    const fly = eInCubic(prog(t, T.tear + .08, T.tear + .5));
    if (fly >= 1) return;
    const sway = Math.sin(t * 2.3) * .009 + Math.sin(t * 5.1) * .003 + (torn && tearS < .12 ? -.04 * Math.sin(tearS / .12 * Math.PI) : 0);
    const j = jit(701, n, .5);
    at(PX + j.x - fly * 1250, PY + 2 + printerIn(t) + j.y + (torn ? 18 * clamp(tearS / .06) : 0) + fly * 260, sway - fly * .55, 1, 1, () => {
      withShadow(14, () => { ctx.fillStyle = M.paper; ctx.beginPath();
        if (torn) { ctx.moveTo(-TW / 2, 0); for (let x = -TW / 2; x < TW / 2; x += 18) { ctx.lineTo(x + 9, -10); ctx.lineTo(x + 18, 0); } } else { ctx.moveTo(-TW / 2, -20); ctx.lineTo(TW / 2, -20); }
        ctx.lineTo(TW / 2, L); zig(-TW / 2, TW / 2, L, 12, 18); ctx.lineTo(-TW / 2, L); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = 'rgba(0,0,0,.025)'; for (let i = 0; i < 44; i++) ctx.fillRect(-TW / 2, rnd(i * 7.3) * L, TW, 1);
      ctx.save(); ctx.beginPath(); ctx.rect(-TW / 2, -20, TW, L - 8); ctx.clip();
      for (const [yb, tp, fn] of ITEMS) { const k = prog(t, tp, tp + .1); if (k <= 0) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(-TW / 2, -20, TW * clamp(k * 1.3), 900); ctx.clip(); fn(); ctx.restore(); }
      ctx.restore();
    });
  }
  const printerIn = t => -(1 - clamp(pop(t, T.ch.start + .12, 11, .55), 0, 1.2)) * 420;
  function printerLayer(t, n) {
    const up = eInCubic(prog(t, T.tear + .12, T.tear + .5));
    if (up >= 1) return;
    const busy = ITEMS.some(([, tp]) => t >= tp - .03 && t < tp + .18);
    const sh = busy ? (rnd(n * 3.1) - .5) * 3 : 0;
    at(PX + sh, PY + printerIn(t) - up * 470, 0, 1, 1, () => printer(900, t, n, busy));
  }
  function motes(t, n, a) {                                                // drifting paper dust
    if (a <= 0) return; ctx.save();
    for (let i = 0; i < 22; i++) { const x = (rnd(i * 3.7) * W + t * (8 + rnd(i) * 14)) % W, y = 300 + (rnd(i * 5.1) * 900 + t * (10 + rnd(i * 2.2) * 18)) % 950;
      ctx.globalAlpha = a * (.25 + .35 * rnd(i * 9.3)); ctx.fillStyle = i % 3 ? C.cream : C.kraftL; ctx.beginPath(); ctx.arc(x, y, 2 + rnd(i * 4.4) * 3, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ price tags (S13 → S14)
  function tagFace(kind, t) {
    const title = kind ? 'PRIX DE REVIENT' : 'PRIX DE VENTE', col = kind ? C.orange : C.violetD;
    text(title, 0, -74, { font: fitFont(FF.stencil, title, 48, 900, TAG.w - 44), align: 'center', color: col, ls: 2 });
    const struck = kind ? 0 : prog(t, T.strike, T.strike + .22), rw = kind ? 0 : prog(t, T.rewrite, T.rewrite + .45);
    const f = fitFont(FF.hand, '10 000 F', 84, 800, TAG.w - 50), sz = parseFloat(f.split(' ')[1]);
    handText('10 000 F', 0, 38, sz, { color: C.ink, pen: false, strike: struck, double: true });
    ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-TAG.w / 2 + 40, 142); ctx.lineTo(TAG.w / 2 - 40, 142); ctx.stroke(); ctx.restore();
    if (rw > 0) at(6, 126, -.06, 1, 1, () => handText('9 000 F', 0, 0, 76, { color: M.red, write: rw, pen: rw < 1 }));
  }
  function tagAt(kind, ax, ay, len, sc, rot, t, n) {                     // anchor (ax, ay), thread length to the hole
    at(ax, ay, rot, 1, 1, () => {
      if (len > 2) thread([[0, 0], [2, len * .5], [0, len]], 1, n, { w: 6 });
      at(0, len + (TAG.h / 2 - 30) * sc, 0, sc, sc, () => priceTag(TAG.w, TAG.h, () => tagFace(kind, t), { fill: kind ? '#FFE9C2' : C.cream }));
    });
  }
  function swing(t, t0, amp = .16) { const s = t - t0; return s < 0 ? 0 : amp * Math.exp(-s * 2.2) * Math.sin(s * 7) + .025 * Math.sin(t * 1.9 + t0); }
  function tags(t, n) {
    if (t < T.tagA - .05) return;
    const mv = eInOutCubic(prog(t, T.x + .05, T.x + .65));
    // tag A: PRIX DE VENTE — drops in, then moves onto Junior's awning for S14
    const dA = pop(t, T.tagA, 9, .5), holeA = lerp(-420, TAG.y, clamp(dA, 0, 1.2));
    const ax = lerp(TAG.ax, 820, mv), ay = lerp(-20, 292, mv), sc = lerp(1, .8, mv);
    const lenA = lerp(holeA + 20, 34, mv);
    const pulse = 1 + .07 * Math.exp(-Math.max(0, t - T.vente) * 5) * Math.sin(Math.max(0, t - T.vente) * 22) * (t > T.vente ? 1 : 0);
    const nod = t > T.strike - .05 && t < T.rewrite + .5 ? .02 * Math.sin(stepT(n) * 30) : 0;
    tagAt(0, ax, ay, lenA, sc * (t < T.x ? pulse : 1), swing(t, T.tagA) * (1 - mv) + swing(t, T.x + .65, .08) * mv + nod, t, n);
    // tag B: PRIX DE REVIENT — drops on « revient », leaves at the S14 re-layout
    if (t >= T.tagB - .05) { const dB = pop(t, T.tagB, 9, .5), gone = eInCubic(prog(t, T.x - .1, T.x + .3));
      if (gone < 1) tagAt(1, TAG.bx, -20, lerp(-420, TAG.y, clamp(dB, 0, 1.2)) + 20 - gone * 900, pulse, swing(t, T.tagB), t, n); }
    // the marker « = »
    const e1 = prog(t, T.eq, T.eq + .18), e2 = prog(t, T.eq + .22, T.eq + .4), eo = prog(t, T.x - .2, T.x + .1);
    if (e1 > 0 && eo < 1) { const cx = (TAG.ax + TAG.bx) / 2, cy = TAG.y + 170;
      ctx.save(); ctx.globalAlpha *= 1 - eo; ctx.strokeStyle = M.red; ctx.lineWidth = 16; ctx.lineCap = 'round';
      const j = jit(710, n, .6); ctx.translate(j.x, j.y);
      ctx.beginPath(); ctx.moveTo(cx - 44, cy - 18); ctx.lineTo(cx - 44 + 88 * e1, cy - 20); ctx.stroke();
      if (e2 > 0) { ctx.beginPath(); ctx.moveTo(cx - 44, cy + 20); ctx.lineTo(cx - 44 + 88 * e2, cy + 18); ctx.stroke(); }
      ctx.restore();
      if (e2 < 1) pen(e1 < 1 ? cx - 44 + 88 * e1 : cx - 44 + 88 * e2, e1 < 1 ? cy - 20 : cy + 18, M.red);
      if (t > T.vente && t < T.vente + .5) { const s = (t - T.vente) / .5; ctx.save(); ctx.globalAlpha = 1 - s; ctx.strokeStyle = C.amber; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (70 + 40 * s), cy + Math.sin(a) * (70 + 40 * s)); ctx.lineTo(cx + Math.cos(a) * (96 + 60 * s), cy + Math.sin(a) * (96 + 60 * s)); ctx.stroke(); } ctx.restore(); }
    }
  }

  function margeStamp(t, n) {
    const t0 = T.vente, s = t - t0; if (s < -.14) return;
    const out = prog(t, T.x - .15, T.x + .15); if (out >= 1) return;
    const k = eInCubic(prog(t, t0 - .14, t0)), sc = s < 0 ? lerp(1.8, 1, k) : 1 + .05 * Math.exp(-s * 12) * Math.cos(s * 40);
    at(540, 1010, -.05, sc, sc, () => stampText('MARGE : 0 F', 0, 0, font(FF.stencil, 92, 900), M.red, { box: true, boxW: 9, h: 126, ls: 4, alpha: (s < 0 ? .25 + .6 * k : 1) * (1 - out), starve: .35 }));
  }

  // ------------------------------------------------------------------ S14: the stall
  function awning(t, n) {
    const k = eOutCubic(prog(t, T.x + .05, T.x + .45)); if (k <= 0) return;
    const y0 = -300 * (1 - k), aw = W + 80, ah = 250;
    ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = C.kraftD; ctx.fillRect(40, y0 + ah - 20, 22, STALL.top - ah + 20); ctx.fillRect(W - 62, y0 + ah - 20, 22, STALL.top - ah + 20); ctx.restore();
    withShadow(10, () => { ctx.save(); ctx.beginPath(); ctx.moveTo(-40, y0 - 10); ctx.lineTo(W + 40, y0 - 10); ctx.lineTo(W + 40, y0 + ah);
      for (let x = W + 40; x > -40; x -= aw / 9) ctx.quadraticCurveTo(x - aw / 18, y0 + ah + 46, x - aw / 9, y0 + ah); ctx.closePath(); ctx.clip();
      for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? C.cream : C.orange; ctx.fillRect(-40 + i * aw / 18, y0 - 10, aw / 18 + 1, ah + 60); } ctx.restore(); });
    ctx.fillStyle = C.kraftD; rrect(-20, y0 + ah - 12, W + 40, 14, 6); ctx.fill();
  }
  function counter(t, n) {
    const k = pop(t, T.x + .12, 11, .6); if (k <= 0) return;
    const y = lerp(H, STALL.top, clamp(k, 0, 1.05));
    withShadow(12, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(-10, y, W + 20, H - y + 10); });
    ctx.fillStyle = C.kraftD; ctx.fillRect(-10, y, W + 20, 20);
    ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 3; for (let x = 90; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, H); ctx.stroke(); }
  }
  function juniorPose(t, n) {
    let face = 'smile', arms = ['idle', 'idle'], look = -.5, tilt = 0, sweat = false;
    if (t >= T.bubble && t < T.n9e + .3) { face = 'think'; arms = ['idle', 'chin']; look = -.7; tilt = -.05; }
    else if (t >= T.n9e + .3 && t < T.nod - .05) { face = 'worry'; arms = ['idle', 'chin']; look = -.5; }
    else if (t >= T.nod - .05 && t < T.accepte) { face = 'smile'; look = -.4; tilt = .11 * Math.sin((stepT(n) - T.nod) * 17); }
    else if (t >= T.accepte && t < T.plus1 + .3) { face = 'grin'; arms = ['idle', 'thumb']; look = -.4; tilt = .05 * Math.sin((stepT(n) - T.accepte) * 17) * Math.exp(-(t - T.accepte) * 2); }
    else if (t >= T.plus1 + .3 && t < T.plus2) { face = 'think'; look = -.8; tilt = .06; }
    else if (t >= T.plus2 && t < T.perd - .05) { face = 'worry'; arms = ['chin', 'idle']; look = -.8; sweat = true; tilt = .04; }
    else if (t >= T.perd - .05) { face = 'shock'; arms = ['up', 'up']; look = 0; sweat = true; }
    return { face, arms, look, tilt, sweat, blink: (n % 91) < 3 };
  }
  function junior(t, n) {
    const k = pop(t, T.x + .45, 12, .45); if (k <= 0) return;
    const P = juniorPose(t, n), j = jit(720, n, .8), jump = t > T.perd - .05 ? 20 * Math.exp(-(t - T.perd) * 6) * Math.abs(Math.sin((t - T.perd) * 18)) : 0;
    at(STALL.jx + j.x, STALL.jy + (1 - clamp(k, 0, 1.2)) * 330 + j.y - jump, j.r + P.tilt * .3, STALL.js, STALL.js * (1 + .012 * Math.sin(t * 3)), () =>
      person({ skin: SKIN[0], outfit: C.violet, hair: 'cap', capColor: C.amber, face: P.face, arms: P.arms, look: P.look, tilt: P.tilt, blink: P.blink, sweat: P.sweat }));
  }
  function handbag() {
    ctx.save(); ctx.strokeStyle = C.violetD; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 18, 30, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = C.violetD; rrect(-56, 16, 112, 86, 16); ctx.fill(); ctx.fillStyle = C.amber; rrect(-12, 30, 24, 16, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(-48, 24, 96, 6); ctx.restore();
  }
  function client(t, n) {
    const tin = T.walkIn, tout = T.plus1 + .1;
    const kin = prog(t, tin, tin + .7), kout = prog(t, tout, tout + .7);
    if (kin <= 0 || kout >= 1) return;
    const walking = (kin > 0 && kin < 1) || (kout > 0 && kout < 1), ts = stepT(n);
    const x = lerp(-280, STALL.cx, eOutCubic(kin)) - eInCubic(kout) * 620;
    const bob = walking ? Math.abs(Math.sin(ts * 11)) * 16 : Math.sin(t * 2.4) * 3, rock = walking ? (Math.floor(n / 4) % 2 ? .035 : -.035) : 0;
    let face = 'smile', arms = ['idle', 'idle'], look = .5;
    if (t >= T.bubble && t < T.n9e + .5) { face = t >= T.n9 ? 'wink' : 'grin'; arms = ['idle', t >= T.laisse ? [200, -330] : 'idle']; look = .7; }
    else if (t >= T.accepte - .05 && t < tout) { face = 'grin'; arms = ['idle', t < T.sale1 + .05 ? [215, 80] : 'thumb']; look = .6; }
    if (kout > 0) { face = 'grin'; look = -.6; }
    const j = jit(730, n, .8);
    at(x + j.x, STALL.cy - bob + j.y, rock + j.r, STALL.cs, STALL.cs, () => person({ skin: SKIN[1], outfit: C.orange, wax: true, hair: 'wrap', face, arms, look, blink: (n % 79) < 3,
      handSide: -1, handProp: handbag }));
    // the 9 000 note in her hand before the first sale
    if (t >= T.accepte + .05 && t < T.sale1) { const hx = x + 215 * STALL.cs, hy = STALL.cy + 80 * STALL.cs;
      at(hx, hy - 20, -.25, 1, 1, () => miniNote(130, 62, '9 000')); }
  }
  function bubble(t, n) {
    const k = pop(t, T.bubble, 12, .5), out = eInCubic(prog(t, T.nod - .1, T.nod + .2)); if (k <= 0 || out >= 1) return;
    const f = font(FF.hand, 60, 800), l1 = 'Mon fils,', l2a = 'laisse à ', l2b = '9 000 !';
    const w2 = measure(l2a + l2b, f), bw = Math.max(measure(l1, f), w2) + 90, bh = 210, cx = 318, cy = 552;
    const j = jit(740, n, .6), s = clamp(k, 0, 1.15) * (1 - out);
    at(cx + j.x, cy + j.y, -.02 + j.r, s, s, () => {
      withShadow(12, () => { ctx.fillStyle = '#FFFFFF'; rrect(-bw / 2, -bh / 2, bw, bh, 48); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-40, bh / 2 - 6); ctx.quadraticCurveTo(-40, bh / 2 + 60, -70, bh / 2 + 88); ctx.quadraticCurveTo(-10, bh / 2 + 50, 20, bh / 2 - 6); ctx.closePath(); ctx.fill(); });
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4; rrect(-bw / 2 + 10, -bh / 2 + 10, bw - 20, bh - 20, 40); ctx.globalAlpha *= .12; ctx.stroke(); ctx.globalAlpha /= .12;
      const x0 = -w2 / 2, a = prog(t, T.mon - .02, T.laisse - .05), b = prog(t, T.laisse, T.n9 - .03), c = prog(t, T.n9, T.n9e + .12);
      handText(l1, -measure(l1, f) / 2, -22, 60, { align: 'left', write: a, color: C.ink, pen: false });
      if (b > 0) handText(l2a, x0, 64, 60, { align: 'left', write: b, color: C.ink, pen: false });
      if (c > 0) handText(l2b, x0 + measure(l2a, f), 64, 60, { align: 'left', write: c, color: C.orange, pen: false });
    });
  }
  function miniNote(nw, nh, label, o = {}) {
    ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
    const g = ctx.createLinearGradient(-nw / 2, -nh / 2, nw / 2, nh / 2); g.addColorStop(0, '#CFE3C9'); g.addColorStop(.55, '#E7E4C4'); g.addColorStop(1, '#CFE3C9');
    withShadow(o.lift ?? 6, () => { ctx.fillStyle = g; rrect(-nw / 2, -nh / 2, nw, nh, 5); ctx.fill(); });
    ctx.strokeStyle = M.green; ctx.lineWidth = 2; rrect(-nw / 2 + 5, -nh / 2 + 5, nw - 10, nh - 10, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-nw * .26, 0, nh * .28, nh * .32, 0, 0, 7); ctx.fill();
    if (label) text(label, nw / 2 - 10, nh * .2, { font: font(FF.brand, nh * .42, 900), align: 'right', color: M.green });
    ctx.restore();
  }
  // sales: note i (1..95) lands in the tin at saleT(i)
  function saleT(i) { return i <= 1 ? T.sale1 + .35 : T.salesA + (T.salesB - T.salesA) * Math.cbrt((i - 1) / 94); }
  function salesDone(t) { if (t < saleT(1)) return 0; if (t >= T.salesB) return 95; return Math.min(95, 1 + Math.floor(94 * Math.pow(prog(t, T.salesA, T.salesB), 3))); }
  function tinLevel(t) {
    let lv = .74 - .7 * eInOutCubic(prog(t, T.salesA, T.salesB + .1)) - .05 * eOutCubic(prog(t, saleT(1) + .1, saleT(1) + .5));
    for (let i = 1; i <= 95; i++) { const s = t - saleT(i); if (s < 0) break; if (s < .3) lv += .035 * Math.exp(-s * 12); }
    return clamp(lv, .03, .8);
  }
  function tin(tw, th, level, n) {                                        // old biscuit tin, origin bottom centre, front cut open
    const col = '#2E6E8E', colD = '#1F4E66';
    withShadow(10, () => { ctx.fillStyle = col; rrect(-tw / 2, -th, tw, th, 16); ctx.fill(); });
    ctx.fillStyle = colD; ctx.fillRect(-tw / 2, -th + 22, 10, th - 40); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(tw / 2 - 26, -th + 26, 8, th - 50);
    // window onto the notes inside
    const wx = -tw / 2 + 20, wy = -th + 84, ww = tw - 40, wh = th - 110;
    ctx.fillStyle = '#16222B'; rrect(wx, wy, ww, wh, 12); ctx.fill();
    ctx.save(); rrect(wx, wy, ww, wh, 12); ctx.clip();
    const top = wy + wh * (1 - level);
    for (let y = wy + wh - 6, i = 0; y > top - 6; y -= 7, i++) { ctx.fillStyle = i % 3 === 2 ? '#E7E4C4' : i % 2 ? '#CFE3C9' : '#B9D6B0'; ctx.fillRect(wx + 6 + (rnd(i * 3.3) - .5) * 8, y, ww - 12, 6); }
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(wx + 12, wy); ctx.lineTo(wx + 44, wy); ctx.lineTo(wx + 14, wy + wh); ctx.lineTo(wx - 18, wy + wh); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = M.goldD; ctx.lineWidth = 5; rrect(wx, wy, ww, wh, 12); ctx.stroke();
    // label band
    ctx.fillStyle = C.cream; ctx.save(); ctx.translate(0, -th + 50); ctx.rotate(-.03); rrect(-86, -28, 172, 56, 6); ctx.fill();
    text('CAISSE', 0, 17, { font: font(FF.stencil, 46, 900), align: 'center', color: C.ink, ls: 3 }); ctx.restore();
    // rims (gold), dents & scratches
    ctx.fillStyle = M.gold; rrect(-tw / 2 - 7, -th - 8, tw + 14, 22, 10); ctx.fill(); ctx.fillStyle = M.goldD; rrect(-tw / 2 - 4, -16, tw + 8, 14, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = -tw / 2 + 24 + rnd(i * 5.5) * (tw - 48), y = -th + 20 + rnd(i * 2.2) * 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y + 5); ctx.stroke(); }
    ctx.fillStyle = 'rgba(160,80,30,.55)'; ctx.beginPath(); ctx.ellipse(tw / 2 - 40, -34, 16, 9, .3, 0, 7); ctx.fill();   // rust
    // the hole punched through the bottom: torn silver lips around a black gap
    const hx = 30, hy = -12, jag = (r0, r1, sc) => { ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = (i % 2 ? r0 : r1) * (1 + (rnd(i * 7.7) - .5) * .35); ctx.lineTo(hx + Math.cos(a) * r * 1.5 * sc, hy + Math.sin(a) * r * .62 * sc); } ctx.closePath(); };
    ctx.fillStyle = '#C9CDD2'; jag(15, 25, 1.15); ctx.fill(); ctx.fillStyle = '#0E0A10'; jag(12, 19, 1); ctx.fill();
  }
  function tinLayer(t, n) {
    const d = drop(t, T.x + .75, 320, .22); if (!d.a) return;
    const lv = tinLevel(t), j = jit(750, n, .6), last = saleT(Math.max(1, salesDone(t)));
    const thump = t >= saleT(1) && t - last < .15 ? .04 * Math.sin((t - last) / .15 * Math.PI) : 0;
    const x = STALL.tinX, y = STALL.tinY;
    // notes leaking out of the hole (one per sale) — drawn first, behind the tin
    for (let i = 1; i <= salesDone(t); i++) { const s = t - saleT(i) - .08; if (s < 0 || s > .75 || (i > 16 && i % 3)) continue;
      const fy = 160 * s + 420 * s * s, a = clamp(1 - s / .75);
      at(x + 26 + Math.sin(s * 9 + i) * 26 + (rnd(i * 2.1) - .5) * 30, y + 6 + fy, Math.sin(s * 8 + i) * .9, .7 * Math.abs(Math.cos(s * 7 + i)) + .2, .7, () => miniNote(110, 52, '', { alpha: a, lift: 3 })); }
    at(x + j.x, y + d.y + j.y, j.r, d.sx * (1 + thump), d.sy * (1 - thump), () => tin(STALL.tw, STALL.th, lv, n));
    // « −1 000 » tag tied to the hole
    const tk = pop(t, T.x + 1.0, 12, .45); if (tk <= 0) return;
    const sw = .12 * Math.sin(t * 3.1) + (t - last < .3 && t >= saleT(1) ? .15 * Math.sin((t - last) * 30) * Math.exp(-(t - last) * 8) : 0);
    at(x + 26 + j.x, y - 4 + d.y, sw, 1, 1, () => {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50, 22, 100, 14); ctx.stroke();
      at(166, 16, .06, clamp(tk, 0, 1.2), clamp(tk, 0, 1.2), () => { card(150, 66, C.cream, 91); text('−1 000', 0, 17, { font: font(FF.hand, 46, 800), align: 'center', color: M.red }); });
    });
  }
  function notesIn(t, n) {                                                // 9 000 notes falling into the tin
    const x0 = STALL.tinX, yTop = STALL.tinY - STALL.th;
    for (let i = 1; i <= 95; i++) {
      if (i > 16 && i % 3) continue;                                     // thin the blizzard (every 3rd note once it runs fast)
      const tl = saleT(i), dur = i === 1 ? .35 : .4, s = t - (tl - dur); if (s < 0 || t >= tl) continue;
      const k = s / dur;
      let px, py; if (i === 1) { const hx = STALL.cx + 215 * STALL.cs, hy = STALL.cy + 80 * STALL.cs - 20; px = lerp(hx, x0, eInOutCubic(k)); py = lerp(hy, yTop, k) - Math.sin(k * Math.PI) * 170; }
      else { px = x0 + (rnd(i * 4.3) - .5) * 90; py = lerp(-60, yTop + 10, k * k); }
      at(px, py, Math.sin(k * 6 + i) * .5, Math.abs(Math.cos(k * 5 + i)) * .8 + .2, 1, () => miniNote(130, 62, '9 000'));
    }
  }
  function lossPlate(t, n) {
    const k = pop(t, saleT(1), 13, .45); if (k <= 0) return;
    const v = -1000 * Math.max(1, salesDone(t)), last = saleT(Math.max(1, salesDone(t))), flash = t - last < .08 && salesDone(t) < 12;
    const j = jit(760, n, .6), sc = clamp(k, 0, 1.2) * (1 + (t > T.perd && t < T.perd + .4 ? .05 * Math.sin((t - T.perd) * 30) * Math.exp(-(t - T.perd) * 6) : 0));
    at(300 + j.x, 540 + j.y, -.025 + j.r, sc, sc, () => {
      withShadow(12, () => { ctx.fillStyle = '#2B2230'; rrect(-260, -100, 520, 200, 24); ctx.fill(); });
      text('PERTE', 0, -46, { font: font(FF.stencil, 48, 900), align: 'center', color: C.amber, ls: 6 });
      ctx.fillStyle = flash ? '#F7D6CF' : M.lcd; rrect(-236, -26, 472, 108, 14); ctx.fill();
      text(fcfa(v), 214, 50, { font: fitFont(FF.mono, fcfa(-95000), 70, 800, 430), align: 'right', color: M.red });
    });
  }
  function strips(t, n) {
    const put = (str, parts, y, t0, seed, rot, fill) => {
      const k = pop(t, t0 - .08, 13, .5); if (k <= 0) return;
      const f = font(FF.stencil, 96, 900), wd = measure(str, f, 4) + 90, j = jit(770 + seed, n, .6);
      ctx.save(); ctx.globalAlpha *= clamp(k * 3);
      const s = lerp(1.6, 1, clamp(k, 0, 1.05));
      at(W / 2 - 30 + j.x, y + j.y, 0, s, s, () => paperNote(0, 0, wd, 124, rot, () => {
        let x = -wd / 2 + 45; for (const [p, c] of parts) { text(p, x, 35, { font: f, color: c, ls: 4 }); x += measure(p, f, 4); } }, { seed, h: 12, fill }));
      ctx.restore();
    };
    put('PLUS IL VEND…', [['PLUS IL VEND…', C.ink]], 1142, T.vend, 31, -.025);
    put('PLUS IL PERD', [['PLUS IL ', C.ink], ['PERD', M.red]], 1292, T.perd, 37, .02, '#FFE9A8');
  }

  registerScene({
    id: 'ticket', z: 40,
    when: t => t >= TL.ch('ticket').start && t < TL.ch('formule').start,
    draw(t, n) {
      if (!T) { T = times(); ITEMS = ticketItems(); }
      if (t < T.ch.start || t >= T.end) return;
      if (t < T.s13.start + .3) paperTable(n);                          // hide the spine's leftovers under the receipt wipe
      // S13
      if (t < T.x + 1) {
        const push = 1 + .02 * eInOutCubic(prog(t, T.pTitle, T.done)) + .025 * eInOutCubic(prog(t, T.done, T.tear)), dy = -18 * eInOutCubic(prog(t, T.pTitle, T.done));
        ctx.save(); ctx.translate(540, 700 + dy); ctx.scale(push, push); ctx.translate(-540, -700);
        motes(t, n, env(t, T.pTitle, T.tear + .4, .5, .3));
        ticket(t, n);
        printerLayer(t, n);
        ctx.restore();
      }
      // S14 set (slides in over the tags' re-layout)
      awning(t, n);
      junior(t, n);
      counter(t, n);
      notesIn(t, n);
      tinLayer(t, n);
      client(t, n);
      tags(t, n);
      if (t < T.x + .3) margeStamp(t, n);
      bubble(t, n);
      lossPlate(t, n);
      strips(t, n);
    },
  });
  captionHide(t => T && t >= T.vend - .1 && t < T.end);                 // the two strips carry « plus il vend… plus il perd »
})();

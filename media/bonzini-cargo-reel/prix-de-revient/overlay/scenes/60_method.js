'use strict';
// S15–S17 « La méthode » (chapters formule · prix · happy) — full frame, the note spine is gone.
// S15  7 envelopes threaded USINE → BOUTIQUE; on « divisé » the thread snaps taut into a fraction bar over 100 boxes
//      (the 5 left-left pairs fly off → 95). Torn-letter formula, example plate, « À GARDER » stamp. On « plancher »
//      the formula pins itself top-right, a tape measure unrolls, the PLANCHER plank slams at 10 000, red hatch below.
// S16  « PRIX DE VENTE ? » tag above the plank; the ruler shrinks to a gauge (left); two calculators × 1,20 ✗ / × 1,25 ✓,
//      band « 20 % DU PRIX DE VENTE = × 1,25 », a flag planted at 12 500 on the gauge.
// S17  sneaker tag rewritten 12 500 F, 237 500 F counter + coins, Junior hands the pagne to maman, confetti, « PAYÉ ».
// Captions band (y 1250–1430) stays clear. Nothing important at x > 980.
(() => {
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth), we = (s, k, nth = 0) => TL.we(s, k, null, nth);
  function times() {
    const o = {
      f0: TL.ch('formule').start, p0: TL.ch('prix').start, h0: TL.ch('happy').start, h1: TL.ch('marche').start,
      regle: w('S15', 'regle'), tout: w('S15', 'tout'), payez: w('S15', 'payez'), jusqu: w('S15', 'jusqu'), boutique: w('S15', 'boutique'),
      divise: w('S15', 'divise'), pieces: w('S15', 'pieces'), vraiment: w('S15', 'vraiment'), vendables: w('S15', 'vendables'), vendE: we('S15', 'vendables'),
      cest: w('S15', 'cest'), plancher: w('S15', 'plancher'), dessous: w('S15', 'dessous'), vous2: w('S15', 'vous', 1), payez2: w('S15', 'payez', 1),
      travailler: w('S15', 'travailler'), travE: we('S15', 'travailler'),
      prix16: w('S16', 'prix'), apres: w('S16', 'apres'), pour16: w('S16', 'pour'), vingt: w('S16', '20'), du16: w('S16', 'du'),
      fois1: w('S16', 'fois'), x120e: we('S16', '1,20'), fois2: w('S16', 'fois', 1), x125: w('S16', '1,25'), x125e: we('S16', '1,25'), d12: w('S16', '12', 2),
      two: w('S17', '2'), junior: w('S17', 'junior'), cette: w('S17', 'cette'), pagne: w('S17', 'pagne'), paye: w('S17', 'paye'),
    };
    o.stamp = o.vendables + .3;                    // « À GARDER » slams
    o.pin = o.cest + .2;                            // formula card shrinks to the wall
    o.unroll = o.cest + .36;                        // tape measure unrolls
    o.gauge = o.pour16 - .06;                       // big ruler → left gauge
    o.shakes = [[o.plancher, 10], [o.stamp, 6], [o.d12, 7], [o.paye, 5]];
    return o;
  }
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);
  const TILE_FILL = ['#FFFDF7', '#FFF1D6', '#E6C79C', '#FFE36E', '#EFE3FF', '#FFFFFF'];

  // ------------------------------------------------------------------ local props
  function tornRect(tw, th, seed, amp = 2.2, fill) {
    ctx.beginPath(); const tp = tornLine(-tw / 2, -th / 2, tw / 2, -th / 2, seed, amp, 9), bt = tornLine(tw / 2, th / 2, -tw / 2, th / 2, seed + 5, amp, 9);
    ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function card(cw, ch, fill = C.cream, seed = 1, lift = 9) { withShadow(lift, () => tornRect(cw, ch, seed, 2.5, fill)); }
  function tape(x, y, r = 0, len = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -15, len, 30); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -11, len, 4); }); }
  /** torn-paper letter tiles (ransom-note style), one tile lands every dt from t0 */
  function tiles(str, cx, y, size, t0, dt, t, n, seed) {
    const f = font(FF.stencil, size, 900), chars = [...str], gap = 5;
    const ws = chars.map(ch => ch === ' ' ? size * .26 : measure(ch, f) + size * .28);
    const tot = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    let x = cx - tot / 2, k = 0;
    chars.forEach((ch, i) => {
      const cw = ws[i], xc = x + cw / 2; x += cw + gap; if (ch === ' ') return;
      const tl = t0 + (k++) * dt; if (t < tl - .1) return;
      const a = clamp((t - (tl - .1)) / .1), s = 1 + (1 - a) * .7;
      const j = jit(seed + i, n, .7), r = (rnd(seed + i * 3.3) - .5) * .16 + j.r;
      const fill = TILE_FILL[Math.floor(rnd(seed + i * 5.1) * TILE_FILL.length)];
      const col = ch === '=' ? C.orange : rnd(seed + i * 7.7) > .7 ? C.violetD : C.ink;
      const bump = t >= tl ? 1 + .1 * Math.exp(-(t - tl) * 16) * Math.cos((t - tl) * 38) : 1;
      at(xc + j.x, y + j.y + (rnd(seed + i) - .5) * 10, r, s * bump, s * bump, () => {
        ctx.globalAlpha *= a;
        withShadow(t >= tl ? 5 : 30, () => tornRect(cw, size * 1.2, seed + i * 11, 2.4, fill));
        text(ch, 0, size * .37, { font: f, align: 'center', color: col });
      });
    });
  }
  /** kraft envelope, same look as the spine's (centred) */
  function envelope(ew, eh, label, o = {}) {
    withShadow(o.lift ?? 4, () => { ctx.fillStyle = C.kraftL; rrect(-ew / 2, -eh / 2, ew, eh, 6); ctx.fill(); });
    ctx.save(); ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .55; rrect(-ew / 2, -eh / 2, ew, eh, 6); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(90,60,30,.35)'; ctx.beginPath(); ctx.moveTo(-ew / 2, -eh / 2); ctx.lineTo(0, -eh / 2 + eh * .55); ctx.lineTo(ew / 2, -eh / 2); ctx.closePath(); ctx.fill();
    const fs = o.fs || eh * .25, f = font(FF.stencil, fs, 800), parts = label.split(' ');
    const l1 = parts.length > 1 ? parts.slice(0, -1).join(' ') : label, l2 = parts.length > 1 ? parts[parts.length - 1] : '', yb = eh / 2 - fs * .42;
    if (l2) { text(l1, 0, yb - fs * 1.02, { font: f, align: 'center', color: C.ink, ls: 1 }); text(l2, 0, yb, { font: f, align: 'center', color: C.ink, ls: 1 }); }
    else text(l1, 0, yb - fs * .5, { font: f, align: 'center', color: C.ink, ls: 1 });
  }
  function pushPin(col) {
    withShadow(16, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(3, 4, 10, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(-7, -7, 7, 0, 7); ctx.fill();
  }
  function pinTag(label, dx, col) {                 // paper tag hanging under a pin (origin = pin)
    const f = font(FF.stencil, 48, 900), tw = measure(label, f, 3) + 46;
    ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(dx * .4, 30, dx, 44); ctx.stroke(); ctx.restore();
    at(dx, 84, 0, 1, 1, () => { card(tw, 74, C.cream, 77 + tw, 7); text(label, 0, 18, { font: f, align: 'center', color: col, ls: 3 }); });
  }
  function miniBox(bw, bh, band) {
    ctx.fillStyle = '#EDE5D6'; rrect(-bw / 2, -bh / 2, bw, bh, 3); ctx.fill();
    ctx.fillStyle = 'rgba(35,22,41,.10)'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh * .24);
    ctx.fillStyle = band; ctx.fillRect(-bw / 2, bh * .02, bw, bh * .22);
    ctx.strokeStyle = 'rgba(35,22,41,.22)'; ctx.lineWidth = 1.5; rrect(-bw / 2, -bh / 2, bw, bh, 3); ctx.stroke();
  }
  function sticky(sw, sh, fill = '#FFE36E', lift = 10) {
    withShadow(lift, () => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-sw / 2, -sh / 2); ctx.lineTo(sw / 2, -sh / 2); ctx.lineTo(sw / 2, sh / 2 - 28); ctx.lineTo(sw / 2 - 28, sh / 2); ctx.lineTo(-sw / 2, sh / 2); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.moveTo(sw / 2, sh / 2 - 28); ctx.lineTo(sw / 2 - 28, sh / 2); ctx.lineTo(sw / 2 - 24, sh / 2 - 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(160,110,0,.10)'; ctx.fillRect(-sw / 2, -sh / 2, sw, sh * .13);
  }
  function crossMark(p, col, s = 1) {
    if (p <= 0) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 14 * s; ctx.lineCap = 'round';
    const a = clamp(p * 2), b = clamp(p * 2 - 1);
    ctx.beginPath(); ctx.moveTo(-30 * s, -30 * s); ctx.lineTo(-30 * s + 60 * s * a, -30 * s + 60 * s * a); ctx.stroke();
    if (b > 0) { ctx.beginPath(); ctx.moveTo(30 * s, -30 * s); ctx.lineTo(30 * s - 60 * s * b, -30 * s + 60 * s * b); ctx.stroke(); }
    ctx.restore();
  }
  function checkMark(p, col, s = 1) {
    if (p <= 0) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 14 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const a = clamp(p * 2.5), b = clamp(p * 1.67 - .67);
    ctx.beginPath(); ctx.moveTo(-32 * s, 0); ctx.lineTo(-32 * s + 22 * s * a, 24 * s * a); if (b > 0) ctx.lineTo(-10 * s + 48 * s * b, 24 * s - 62 * s * b); ctx.stroke();
    ctx.restore();
  }
  function wood(pw, ph, seed = 3) {                   // kraft plank with wood grain + knots, centred
    withShadow(9, () => { ctx.fillStyle = '#BE8A55'; rrect(-pw / 2, -ph / 2, pw, ph, 8); ctx.fill(); });
    ctx.save(); rrect(-pw / 2, -ph / 2, pw, ph, 8); ctx.clip();
    ctx.globalAlpha = .45; ctx.fillStyle = TEX.kraft; ctx.fillRect(-pw / 2, -ph / 2, pw, ph); ctx.globalAlpha = 1;
    const knots = [[-pw * .31, -ph * .12], [pw * .27, ph * .18]];
    ctx.strokeStyle = 'rgba(110,66,30,.5)'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 7; i++) { const y0 = -ph / 2 + (i + .5) * ph / 7; ctx.beginPath();
      for (let x = -pw / 2; x <= pw / 2; x += 16) { let y = y0 + Math.sin(x * .011 + i * 1.9 + seed) * 3;
        for (const [kx, ky] of knots) y += (y0 < ky ? -1 : 1) * 11 * Math.exp(-Math.pow((x - kx) / 46, 2)) * Math.exp(-Math.abs(y0 - ky) / 30);
        x === -pw / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    for (const [kx, ky] of knots) { ctx.fillStyle = 'rgba(110,66,30,.55)'; ctx.beginPath(); ctx.ellipse(kx, ky, 15, 7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(110,66,30,.4)'; ctx.beginPath(); ctx.ellipse(kx, ky, 24, 11, 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,238,205,.35)'; ctx.fillRect(-pw / 2, -ph / 2, pw, 6);
    ctx.restore();
    for (const sx of [-1, 1]) { ctx.fillStyle = '#5B616A'; ctx.beginPath(); ctx.arc(sx * (pw / 2 - 22), 0, 7, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(sx * (pw / 2 - 22) - 2, -2, 2.5, 0, 7); ctx.fill(); }
  }
  function band(str, x, y, a, o = {}) {              // headline strip (torn paper)
    if (a <= 0) return 0; const size = o.size || 72, f = font(FF.stencil, size, 900), ls = o.ls ?? 3, wd = measure(str, f, ls) + 80;
    ctx.save(); ctx.globalAlpha *= clamp(a);
    paperNote(x, y + (1 - clamp(a)) * 30, wd, size * 1.32, o.rot ?? -.015, () => {
      if (o.parts) { let xx = -wd / 2 + 40; for (const [s, c] of o.parts) { text(s, xx, size * .36, { font: f, color: c, ls }); xx += measure(s, f, ls); } }
      else text(str, 0, size * .36, { font: f, align: 'center', color: o.color || C.ink, ls });
    }, { seed: o.seed || 5, h: 10, fill: o.fill });
    ctx.restore(); return wd;
  }
  function flecks(t, n, a = 1) {                    // drifting paper crumbs (life in the background)
    const ts = stepT(n), cols = [C.kraftL, C.amber, C.violet, '#FFFFFF', C.orange];
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const x = ((rnd(i * 3.1) * (W + 200) + ts * (8 + rnd(i) * 16)) % (W + 200)) - 100, y = 170 + ((rnd(i * 7.3) * 1080 + ts * (5 + rnd(i * 2.2) * 9)) % 1080);
      ctx.globalAlpha = a * (.25 + .25 * rnd(i * 5.5));
      at(x, y, ts * (rnd(i * 1.9) - .5) * 2 + i, 1, 1, () => { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-5, -3, 10 + rnd(i) * 6, 6); });
    }
    ctx.restore();
  }
  function shake(t) { let x = 0, y = 0; for (const [t0, a] of T.shakes) { const s = t - t0; if (s < 0 || s > .4) continue; const e = Math.exp(-s * 12) * a; x += Math.sin(s * 88) * e; y += Math.cos(s * 71) * e; } return { x, y }; }

  // ================================================================== S15 — the formula
  const BY = 612, PINL = 60, PINR = 1010, EW = 120, EH = 92, ENVX = i => 140 + i * 131.7;
  const LABELS = ['FOURNISSEUR', 'TAUX + FRAIS', 'CAMION CHINE', 'BATEAU', 'DOUANE', 'PETITS FRAIS', 'PERTES'];
  const GX = 290, GY = 664, GP = 46, GQ = 28;           // 10×10 box grid (left, top, pitch x, pitch y)
  const BAD = [[1, 2], [7, 1], [4, 5], [8, 7], [2, 8]];
  function threadRange() { return [T.f0 + .3, T.boutique]; }
  function tension(t) { return t < T.divise - .04 ? 0 : spring(t - (T.divise - .04), 17, .26); }
  function slackY(x, t, n) { const k = 1 - tension(t); return BY + k * (48 * Math.sin(Math.PI * (x - PINL) / (PINR - PINL)) + 12 * Math.sin(x * .021 + stepT(n) * 2.6)); }
  function envT(i) { const [a, b] = threadRange(); return a + (b - a) * (ENVX(i) - PINL) / (PINR - PINL); }

  function formula(t, n) {
    const [ta, tb] = threadRange();
    // ---- title in torn letters, on « règle »
    tiles('VRAI PRIX', 540, 214, 76, T.regle - .12, .05, t, n, 40);
    tiles('DE REVIENT =', 540, 314, 76, T.regle - .12 + 8 * .05, .05, t, n, 60);
    // ---- numerator card
    const nk = pop(t, T.tout - .3, 13, .5);
    if (nk > 0) { const j = jit(610, n, .5);
      at(540 + j.x, 430 + j.y, -.012 + j.r, nk, nk, () => {
        card(800, 128, '#FFFDF7', 61); tape(-360, -56, -.5, 76); tape(360, -56, .5, 76);
        handText('tout ce que vous payez', 0, -8, 50, { write: prog(t, T.tout - .05, T.payez + .4), color: C.ink, pen: false });
        const l2 = prog(t, T.jusqu - .05, T.boutique + .42);
        if (l2 > 0) { const a = handText('jusqu’à la ', -140, 48, 50, { write: clamp(l2 * 1.8), color: C.ink, pen: false, align: 'left' });
          handText('boutique', -140 + a.wd, 48, 50, { write: clamp(l2 * 1.8 - .8), color: C.violetD, pen: false, align: 'left' }); }
      }); }
    // ---- envelopes resting on the violet thread
    LABELS.forEach((lab, i) => {
      const tl = envT(i); const d = drop(t, tl - .2, 130, .2); if (!d.a) return;
      const x = ENVX(i), y = slackY(x, t, n), sl = (slackY(x + 12, t, n) - slackY(x - 12, t, n)) / 24, j = jit(620 + i, n, .6);
      at(x + j.x, y - EH / 2 - 2 + d.y + j.y, Math.atan(sl) * .8 + (i % 2 ? .025 : -.025) * (1 - tension(t)) + j.r, d.sx, d.sy, () => envelope(EW, EH, lab, { fs: 23 }));
    });
    const p = prog(t, ta, tb);
    if (p > 0) { const pts = []; for (let x = PINL; x <= PINR + .1; x += 14) pts.push([x, slackY(x, t, n)]);
      thread(pts, p, n, { w: 8 });
      // clothes-peg clips where the thread holds each envelope
      LABELS.forEach((_, i) => { if (t < envT(i)) return; const x = ENVX(i), y = slackY(x, t, n); ctx.fillStyle = C.violetD; rrect(x - 7, y - 16, 14, 22, 4); ctx.fill(); });
      // a spark runs along on « divisé » (the thread twangs)
      const tw = t - T.divise; if (tw > 0 && tw < .5) { ctx.save(); ctx.globalAlpha = 1 - tw / .5; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3;
        for (const s of [-1, 1]) { const x = 535 + s * tw * 900; ctx.beginPath(); ctx.moveTo(x - 30, BY - 14); ctx.lineTo(x + 30, BY - 14); ctx.moveTo(x - 30, BY + 14); ctx.lineTo(x + 30, BY + 14); ctx.stroke(); } ctx.restore(); }
    }
    // pins + tags
    const pl = pop(t, T.f0 + .12, 15, .4), pr = pop(t, T.boutique - .06, 15, .4);
    if (pl > 0) at(PINL, BY, 0, pl, pl, () => { pinTag('USINE', 78, C.ink); pushPin(C.orange); });
    if (pr > 0) at(PINR, BY, 0, pr, pr, () => { pinTag('BOUTIQUE', -140, C.violetD); pushPin(C.violet); });
    // ---- denominator: 100 boxes appear, the 5 bad ones fly away
    for (let r = 9; r >= 0; r--) for (let c = 0; c < 10; c++) {
      const tb0 = T.pieces - .2 + (9 - r) * .03 + c * .004, k = pop(t, tb0, 18, .5); if (k <= 0) continue;
      const bad = BAD.some(([bc, br]) => bc === c && br === r);
      let a = 1, dy = 0, rot = 0;
      if (bad) { const f = prog(t, T.vendables - .02, T.vendables + .38); a = 1 - f; dy = -70 * eInCubic(f); rot = f * (c % 2 ? 1 : -1) * .9; }
      if (a <= 0) continue;
      const j = jit(700 + r * 10 + c, n, .35);
      at(GX + c * GP + GP / 2 + j.x, GY + r * GQ + GQ / 2 + dy + j.y, rot, k, k, () => {
        ctx.globalAlpha *= a; miniBox(GP - 5, GQ - 5, [C.orange, C.violet, C.amber][(r + c) % 3]);
        if (bad && t >= T.vraiment - .02) { ctx.fillStyle = 'rgba(215,38,30,.28)'; rrect(-(GP - 5) / 2, -(GQ - 5) / 2, GP - 5, GQ - 5, 3); ctx.fill(); crossMark(1, M.red, .32); }
      });
    }
    // count badge 100 → 95
    const bk = pop(t, T.pieces + .15, 14, .45);
    if (bk > 0) { const flip = t >= T.vendables + .3, fk = flip ? pop(t, T.vendables + .3, 16, .4) : 1;
      at(858, 800, .05, bk * (flip ? fk : 1), bk * (flip ? fk : 1), () => {
        withShadow(10, () => { ctx.fillStyle = flip ? C.violet : C.ink; ctx.beginPath(); ctx.arc(0, 0, 66, 0, 7); ctx.fill(); });
        text(flip ? '95' : '100', 0, 22, { font: font(FF.brand, 62, 900), align: 'center', color: '#FFFFFF' });
        text('paires', 0, 100, { font: font(FF.hand, 44, 800), align: 'center', color: C.ink });
      }); }
    // denominator label
    const dk = pop(t, T.divise - .05, 13, .5);
    if (dk > 0) { const j = jit(640, n, .5);
      at(540 + j.x, 994 + j.y, .01 + j.r, dk, dk, () => { card(820, 92, '#FFFDF7', 67); tape(-380, -34, -.5, 70); tape(380, -34, .5, 70);
        const a = handText('÷ ', -338, 20, 56, { write: clamp(prog(t, T.divise - .05, T.divise + .3)), color: C.orange, pen: false, align: 'left' });
        handText('pièces vraiment vendables', -338 + a.wd, 20, 47, { write: prog(t, T.pieces - .05, T.vendE), color: C.ink, pen: false, align: 'left' }); }); }
    // example plate
    const ek = pop(t, T.vendables + .05, 12, .5);
    if (ek > 0) at(540, 1106, -.015, ek, ek, () => {
      const f = font(FF.brand, 54, 900), s1 = '950 000 ÷ 95 = ', s2 = '10 000 F', w1 = measure(s1, f), w2 = measure(s2, f), pw = w1 + w2 + 80;
      withShadow(12, () => { ctx.fillStyle = C.ink; rrect(-pw / 2, -50, pw, 100, 18); ctx.fill(); });
      text(s1, -pw / 2 + 40, 19, { font: f, color: C.cream }); text(s2, -pw / 2 + 40 + w1, 19, { font: f, color: C.amber });
      at(-pw / 2 + 96, -56, -.06, 1, 1, () => { card(172, 50, C.amber, 91, 4); text('exemple :', 0, 12, { font: font(FF.mono, 26, 800), align: 'center', color: C.ink }); });
    });
    // « À GARDER » stamp
    if (t >= T.stamp - .08) { const s = t - T.stamp, sc = s < 0 ? 1.8 - .8 * (1 + s / .08) : 1 + .1 * Math.exp(-s * 14) * Math.cos(s * 40);
      at(832, 1190, -.12, sc, sc, () => stampText('À GARDER', 0, 0, font(FF.stencil, 66, 900), C.violetD, { box: true, boxW: 8, h: 104, ls: 5, alpha: s < 0 ? .5 : .95 })); }
  }
  function formulaCard(t, n) {                   // full frame, then pinned top-right (« à garder »), then away in S16
    if (t > T.gauge + .6) return;
    const m = eInOutCubic(prog(t, T.pin, T.pin + .42)), out = eInCubic(prog(t, T.gauge, T.gauge + .45));
    const s = lerp(1, .33, m), cx = lerp(540, 812, m) + out * 420, cy = lerp(700, 345, m) - out * 620;
    at(cx, cy, lerp(0, .035, m) + out * .4, s, s, () => {
      ctx.translate(-540, -700);
      if (m > 0) { ctx.save(); ctx.globalAlpha *= clamp(m * 3); withShadow(24, () => { ctx.fillStyle = '#FFFDF7'; rrect(20, 140, 1040, 1120, 30); ctx.fill(); }); ctx.restore(); }
      formula(t, n);
    });
    const pk = pop(t, T.pin + .38, 18, .4) * (1 - out);
    if (m > .6 && pk > 0) at(cx, cy + (162 - 700) * s, 0, pk, pk, () => pushPin(C.orange));
  }

  // ------------------------------------------------------------------ the ruler (tape measure), plank, hatch, flag
  const RX = 112, RTOP = 296, RBOT = 1162, yv = v => 790 - (v - 10000) * .14;
  function ruler(t, n, k) {                        // unrolls up from its case at the bottom
    if (k <= 0) return;
    const top = lerp(RBOT - 10, RTOP, k), off = top - RTOP;
    withShadow(5, () => { ctx.fillStyle = '#F6C54A'; ctx.fillRect(RX - 33, top, 66, RBOT - top); });
    ctx.save(); ctx.beginPath(); ctx.rect(RX - 40, top, 80, RBOT - top); ctx.clip();
    ctx.fillStyle = C.ink;
    for (let v = 6500; v <= 13200; v += 100) { const y = yv(v) + off; if (y < top || y > RBOT) continue;
      const L = v % 1000 === 0 ? 26 : v % 500 === 0 ? 18 : 10; ctx.fillRect(RX - 33, y - 1.2, L, 2.4); ctx.fillRect(RX + 33 - L, y - 1.2, L, 2.4);
      if (v % 1000 === 0) at(RX + 2, y, -Math.PI / 2, 1, 1, () => text(fmtN(v), 0, 8, { font: font(FF.mono, 19, 800), align: 'center', color: v === 10000 ? M.red : C.ink })); }
    ctx.restore();
    ctx.fillStyle = '#8C939B'; rrect(RX - 38, top - 12, 76, 16, 5); ctx.fill();                     // hook
    withShadow(12, () => { ctx.fillStyle = '#2B2230'; rrect(RX - 70, RBOT - 8, 140, 84, 22); ctx.fill(); });
    ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(RX, RBOT + 34, 18, 0, 7); ctx.fill(); ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(RX, RBOT + 34, 7, 0, 7); ctx.fill();
  }
  function hatch(x, y, hw, hh, k, n, pulse = 0) {
    if (k <= 0 || hw <= 4) return; ctx.save(); ctx.beginPath(); ctx.rect(x, y, hw, hh * k); ctx.clip();
    ctx.fillStyle = `rgba(215,38,30,${.12 + .1 * pulse})`; ctx.fillRect(x, y, hw, hh);
    ctx.strokeStyle = `rgba(215,38,30,${.5 + .35 * pulse})`; ctx.lineWidth = 7; const o = (stepT(n) * 30) % 36;
    for (let d = -hh + o; d < hw; d += 36) { ctx.beginPath(); ctx.moveTo(x + d, y + hh); ctx.lineTo(x + d + hh, y); ctx.stroke(); }
    ctx.strokeStyle = M.red; ctx.lineWidth = 5; ctx.setLineDash([16, 10]); ctx.strokeRect(x + 2, y, hw - 4, hh - 2); ctx.restore();
  }
  function rulerRig(t, n) {
    const t0 = T.unroll; if (t < t0) return;
    const G = eInOutCubic(prog(t, T.gauge, T.gauge + .55)), X = eInCubic(prog(t, T.h0 - .2, T.h0 + .22));
    ctx.save(); ctx.translate(-X * 420, 0);
    ruler(t, n, eOutCubic(prog(t, t0, t0 + .34)));
    // hatch below the plank
    const hx0 = RX + 36, hx1 = lerp(958, 262, G), hk = eOutCubic(prog(t, T.dessous - .2, T.dessous + .45)), pulse = env(t, T.travailler - .05, T.travE + .5, .08, .4);
    hatch(hx0, yv(10000) + 44, hx1 - hx0, RBOT - 8 - (yv(10000) + 44), hk, n, pulse);
    // label in the hatch
    const lk = pop(t, T.vous2 - .12, 13, .5) * (1 - clamp(G * 2.2));
    if (lk > 0) { const j = jit(660, n, .5);
      at(560 + j.x, 996 + j.y, -.02 + j.r, lk, lk, () => { card(640, 170, '#FFFDF7', 71); tape(-290, -70, -.5, 70); tape(290, -70, .5, 70);
        handText('vous payez', 0, -12, 62, { write: prog(t, T.vous2 - .05, T.payez2 + .3), color: M.red, pen: false });
        handText('pour travailler', 0, 60, 62, { write: prog(t, T.payez2 + .3, T.travE), color: M.red, pen: false }); }); }
    // plank slams on « plancher »
    const d = drop(t, T.plancher - .2, 520, .2);
    if (d.a) { const px0 = RX - 44, px1 = lerp(962, 268, G), pw = px1 - px0, py = yv(10000) + d.y, j = jit(650, n, .4);
      at(px0 + pw / 2 + j.x, py + j.y, -.008 + j.r, d.sx, d.sy, () => {
        wood(pw, 96, 2);
        if (G < .5) { ctx.save(); ctx.globalAlpha *= 1 - G * 2; text('PLANCHER · 10 000 F', 20, 23, { font: font(FF.stencil, 64, 900), align: 'center', color: C.ink, ls: 3 }); ctx.restore(); }
        else { ctx.save(); ctx.globalAlpha *= G * 2 - 1; text('PLANCHER', 26, -6, { font: font(FF.stencil, 34, 900), align: 'center', color: C.ink, ls: 2 }); text('10 000 F', 26, 34, { font: font(FF.brand, 38, 900), align: 'center', color: C.ink }); ctx.restore(); }
      });
      const s = t - T.plancher; if (s > 0 && s < .45) { ctx.save(); for (let i = 0; i < 12; i++) { const sd = i % 2 ? 1 : -1, x0 = sd > 0 ? px1 : px0, v = 90 + rnd(i * 3.3) * 160;
        ctx.globalAlpha = (1 - s / .45) * .6; ctx.fillStyle = i % 3 ? C.kraftL : '#FFFFFF';
        ctx.beginPath(); ctx.arc(x0 + sd * v * s * 2 + (rnd(i) - .5) * 60 * (1 - G), yv(10000) + 30 - 60 * s + 160 * s * s - rnd(i * 1.7) * 40 * s, 5 + rnd(i * 2.1) * 6, 0, 7); ctx.fill(); } ctx.restore(); }
    }
    // sneaker standing on the floor (beat 2, S16 phase A)
    const sk = drop(t, T.plancher + .12, 300, .18), sout = eInCubic(prog(t, T.gauge, T.gauge + .4));
    if (sk.a && sout < 1) { const j = jit(670, n, .5);
      at(430 + j.x + sout * 900, yv(10000) - 48 - 47 + sk.y + j.y, j.r, sk.sx, sk.sy, () => sneaker(240, { lift: 6 })); }
    // « PRIX DE VENTE ? » tag + arrow « vient après » (S16 phase A)
    const tg = pop(t, T.prix16 - .12, 11, .4), tout = eInCubic(prog(t, T.gauge, T.gauge + .35));
    if (tg > 0 && tout < 1) { const sw = .12 * Math.exp(-(t - T.prix16) * 2) * Math.sin((t - T.prix16) * 7) + .02 * Math.sin(t * 2.3);
      at(430, 330 - (1 - clamp(tg)) * 260 - tout * 500, sw, 1, 1, () => {
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -160); ctx.lineTo(0, -24); ctx.stroke(); tape(0, -160, .1, 60);
        at(0, 88, 0, 1, 1, () => priceTag(310, 190, () => {
          text('PRIX DE VENTE', 0, 22, { font: font(FF.stencil, 46, 900), align: 'center', color: C.ink, ls: 2 });
          text('?', 0, 86, { font: font(FF.brand, 60, 900), align: 'center', color: C.orange }); }));
      }); }
    const ak = prog(t, T.apres - .15, T.apres + .3);
    if (ak > 0 && tout < 1) { ctx.save(); ctx.globalAlpha *= 1 - tout; handArrow([[604, 728], [620, 640], [596, 548]], ak, C.orange, 9);
      handText('vient après', 642, 656, 50, { write: clamp(ak * 1.3), color: C.orange, pen: false, align: 'left' }); ctx.restore(); }
    // flag planted at 12 500 on « 12 500 »
    const fk = t - T.d12;
    if (fk > -.14) { const dd = drop(t, T.d12 - .14, 300, .14), unf = eOutBack(clamp((fk - .05) / .3)), wave = Math.sin(t * 7) * 4;
      at(RX + 18, yv(12500) + dd.y, .06, 1, 1, () => {
        ctx.fillStyle = C.ink; rrect(-4, -94, 8, 106, 3); ctx.fill();
        if (unf > 0) { ctx.save(); ctx.scale(unf, 1); withShadow(6, () => { ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(4, -94); ctx.lineTo(236, -86 + wave); ctx.lineTo(222, -54); ctx.lineTo(236, -22 + wave); ctx.lineTo(4, -20); ctx.closePath(); ctx.fill(); });
          text('12 500 F', 112, -40, { font: font(FF.brand, 46, 900), align: 'center', color: C.ink }); ctx.restore(); }
        ctx.fillStyle = M.red; ctx.beginPath(); ctx.arc(0, -96, 8, 0, 7); ctx.fill();
      });
      if (fk > 0 && fk < .5) { ctx.save(); ctx.globalAlpha = 1 - fk / .5; ctx.strokeStyle = C.amber; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) { const a = Math.PI * (.9 + i * .24); ctx.beginPath(); ctx.moveTo(RX + 18 + Math.cos(a) * (20 + 40 * fk), yv(12500) + Math.sin(a) * (20 + 40 * fk)); ctx.lineTo(RX + 18 + Math.cos(a) * (36 + 60 * fk), yv(12500) + Math.sin(a) * (36 + 60 * fk)); ctx.stroke(); } ctx.restore(); }
      // + 2 500 brace between the plank and the flag
      const bk = prog(t, T.d12 + .25, T.d12 + .6);
      if (bk > 0) { ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round'; const y0 = yv(10000) - 50, y1 = yv(12500) + 16, ym = lerp(y0, y1, .5), x = 236;
        ctx.beginPath(); ctx.moveTo(x - 14, y0); ctx.quadraticCurveTo(x, y0, x, lerp(y0, ym, bk)); if (bk > .5) { ctx.lineTo(x, ym + 10); ctx.lineTo(x + 14, ym); ctx.lineTo(x, ym - 10); ctx.lineTo(x, lerp(ym, y1, (bk - .5) * 2)); } ctx.stroke(); ctx.restore();
        if (bk >= 1) at(196, ym - 2, -Math.PI / 2, 1, 1, () => text('+ 2 500', 0, 14, { font: font(FF.brand, 40, 900), align: 'center', color: C.violetD })); }
    }
    ctx.restore();
  }

  // ================================================================== S16 — two calculators
  const KEYS = ['1', '0', '0', '0', '0', '×', '1', ',', '2', '0', '='];
  function typing(t, t0, t1, mult, result) {
    const keys = KEYS.slice(); keys[9] = mult[3]; keys[8] = mult[2];
    const disps = ['1', '10', '100', '1 000', '10 000', '10 000', '1', '1,', mult.slice(0, 3), mult, result];
    const dt = (t1 - t0) / (keys.length - 1), sq = keys.map((k, i) => ({ t: t0 + i * dt, key: k, disp: disps[i] }));
    const st = calcState(t, sq, '0'), nk = sq.filter(s => t >= s.t).length;
    const tag = nk >= 6 && nk < 11 ? '10 000 ×' : '';
    return { ...st, tag, done: nk >= 11, times: sq };
  }
  function calcs(t, n) {
    const t0 = T.gauge + .42; if (t < t0 || t > T.h0 + .3) return;
    const X = eInCubic(prog(t, T.h0 - .2, T.h0 + .22));
    const L = typing(t, T.fois1 + .02, T.x120e - .06, '1,20', '12 000'), R = typing(t, T.fois2 + .02, T.x125e - .06, '1,25', '12 500');
    [[470, L, 0, '× 1,20'], [810, R, 1, '× 1,25']].forEach(([cx, st, i, chipS]) => {
      const e = pop(t, t0 + i * .12, 11, .62), j = jit(680 + i, n, .5), press = st.press ? 1 : 0;
      const cy = 700 + (1 - e) * 900 + X * (1200 + i * 120);
      const glow = i === 1 && st.done ? env(t, T.x125e - .05, T.h0, .1, .2) : 0;
      at(cx + j.x, cy + j.y + press * 2, (i ? .02 : -.02) + j.r, 1, 1, () => {
        if (glow > 0) { ctx.save(); ctx.globalAlpha = glow * (.55 + .2 * Math.sin(t * 9)); ctx.strokeStyle = C.violet; ctx.lineWidth = 14; rrect(-172, -244, 344, 488, 44); ctx.stroke(); ctx.restore(); }
        calculator(320, st.disp, { press: st.press, tag: st.tag, dispColor: st.done ? (i ? C.violetD : C.orange) : M.lcdInk });
        // chip label above the calculator, appears once « × » is pressed
        const ck = pop(t, st.times[5].t, 16, .45);
        if (ck > 0) at(0, -268, i ? .03 : -.03, ck, ck, () => { card(210, 76, C.cream, 81 + i, 7); tape(0, -34, 0, 80);
          text(chipS, 0, 22, { font: font(FF.stencil, 60, 900), align: 'center', color: i ? C.violetD : C.orange, ls: 2 }); });
      });
    });
    // post-its under each calculator
    const notes = [[470, T.x120e + .02, ['marge 2 000', '= 16,7 %', 'du prix'], 0], [810, T.x125e + .02, ['marge 2 500', '= 20 %', 'du prix'], 1]];
    notes.forEach(([cx, tn, lines, i]) => {
      const d = drop(t, tn, 170, .14); if (!d.a) return;
      const j = jit(690 + i, n, .5), yy = 1086 + d.y + X * (1300 + i * 100);
      at(cx + j.x, yy + j.y, (i ? .03 : -.035) + j.r, d.sx, d.sy, () => {
        sticky(320, 250, i ? '#EFE3FF' : '#FFE36E'); tape(0, -120, 0, 110);
        lines.forEach((s, k) => handText(s, -138, [-50, 16, 80][k], k === 1 ? 60 : 46, { align: 'left', color: k === 1 ? (i ? C.violetD : C.orange) : C.ink, pen: false, write: prog(t, tn + .1 + k * .1, tn + .3 + k * .1) }));
        at(100, 62, 0, 1, 1, () => (i ? checkMark : crossMark)(prog(t, tn + .38, tn + .62), i ? C.violet : C.orange, .95));
      });
    });
    // band on top: « 20 % DU PRIX DE VENTE » then « = × 1,25 »
    const bA = pop(t, T.vingt - .08, 13, .5), bB = pop(t, T.x125 - .05, 14, .45), by = 302 - X * 500;
    if (bA > 0) { const f = font(FF.stencil, 64, 900), s1 = '20 % DU PRIX DE VENTE', s2 = ' = × 1,25', w1 = measure(s1, f, 3), w2 = measure(s2, f, 3);
      const wd = w1 + 80 + w2 * clamp(bB), cx = 560 - (w2 * clamp(bB)) * 0;
      at(cx, by, 0, bA, bA, () => { paperNote(0, 0, wd, 88, -.012, () => {
        text(s1, -wd / 2 + 40, 23, { font: f, color: C.ink, ls: 3 });
        const w20 = measure('20 %', f, 3), wdu = measure('20 % DU ', f, 3), ck = prog(t, T.vingt + .05, T.vingt + .5), uk = prog(t, T.du16 - .05, T.du16 + .45);
        if (ck > 0) at(-wd / 2 + 40 + w20 / 2 - 2, 0, 0, 1, 1, () => handCircle(w20 / 2 + 20, 42, ck, C.orange, 6, 7));
        if (uk > 0) { ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 6; ctx.lineCap = 'round'; const x0 = -wd / 2 + 40 + wdu, x1 = -wd / 2 + 40 + w1 - 6;
          ctx.beginPath(); for (let k = 0; k <= 20; k++) { const x = lerp(x0, lerp(x0, x1, eOutCubic(uk)), k / 20), y = 38 + Math.sin(k * 1.3) * 2; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); }
        if (bB > 0) { ctx.save(); ctx.beginPath(); ctx.rect(-wd / 2 + 40 + w1, -60, w2 * clamp(bB) + 10, 120); ctx.clip(); text(s2, -wd / 2 + 40 + w1, 23, { font: f, color: C.violetD, ls: 3 }); ctx.restore(); }
      }, { seed: 17, h: 10 }); }); }
  }

  // ================================================================== S17 — happy
  function happy(t, n) {
    if (t < T.h0 + .1) return;
    const e0 = T.h0 + .22;
    // sneaker hanging from a thread + its tag rewritten 12 500 F
    const sk = pop(t, e0, 10, .42), sw = .1 * Math.exp(-(t - e0) * 1.6) * Math.sin((t - e0) * 6.2) + .025 * Math.sin(t * 2.2);
    if (sk > 0) { const ax = 336, ay = 150, sy = lerp(ay - 320, 296, sk), hx = ax + Math.sin(sw) * (sy - ay);
      ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ax, ay - 30); ctx.lineTo(hx, sy - 40); ctx.stroke(); ctx.restore();
      at(hx, sy, sw * .7, 1, 1, () => {
        sneaker(270, { lift: 12 });
        at(8, 180, -sw * 1.3 + .04, 1, 1, () => priceTag(310, 176, () => {
          handText('10 000 F', 0, 12, 44, { color: C.inkSoft, pen: false, strike: prog(t, e0 + .25, e0 + .42) });
          const wr = prog(t, e0 + .4, T.two + .25);
          handText('12 500 F', 0, 74, 62, { color: C.violetD, write: wr, pen: wr < 1 });
        }, { string: 56 }));
      }); }
    // counter plate + coin stack
    const ck = pop(t, T.two - .12, 13, .45), nc = 14, cdt = (T.junior - T.two) / nc;
    if (ck > 0) { const v = Math.round(countTo(0, 237500, prog(t, T.two, T.junior + .05)) / 2500) * 2500, done = t >= T.junior + .05;
      at(722, 250, -.02, ck, ck, () => plate(0, 0, '+ ' + fcfa(v), { size: 72, fill: done ? '#14301F' : C.ink, color: done ? '#9CF0B8' : C.cream, lift: 12 }));
      if (done && t - T.junior < .6) { const s = (t - T.junior - .05) / .55; ctx.save(); ctx.globalAlpha = clamp(1 - s); ctx.strokeStyle = M.gain; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + .3; ctx.beginPath(); ctx.moveTo(722 + Math.cos(a) * (270 + 40 * s), 250 + Math.sin(a) * (70 + 30 * s)); ctx.lineTo(722 + Math.cos(a) * (300 + 60 * s), 250 + Math.sin(a) * (86 + 44 * s)); ctx.stroke(); } ctx.restore(); }
      let top = 0;
      for (let i = 0; i < nc; i++) { const tc = T.two + .08 + i * cdt, d = drop(t, tc, 110, .1); if (!d.a) continue; top = i;
        at(890 + (rnd(i * 2.9) - .5) * 8, 548 - i * 11 + d.y, 0, d.sx, d.sy, () => coin(46, '500', { tilt: .42 })); }
      const lc = T.two + .08 + top * cdt + .1;
      if (t > lc && t - lc < .25) { const s = (t - lc) / .25, cy = 548 - top * 11 - 8;
        ctx.save(); ctx.globalAlpha = 1 - s; ctx.strokeStyle = C.amber; ctx.lineWidth = 4; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(890 + Math.cos(a) * (40 + 30 * s), cy + Math.sin(a) * (30 + 24 * s)); ctx.lineTo(890 + Math.cos(a) * (56 + 36 * s), cy + Math.sin(a) * (42 + 30 * s)); ctx.stroke(); } ctx.restore(); }
    }
    // equation card
    const eqk = pop(t, T.two + .25, 12, .5);
    if (eqk > 0) { const j = jit(720, n, .5);
      at(540 + j.x, 640 + j.y, -.012 + j.r, eqk, eqk, () => { card(860, 146, '#FFFDF7', 93); tape(-400, -58, -.5, 70); tape(400, -58, .5, 70);
        const f = font(FF.brand, 56, 900), s1 = '95 × 2 500 = ', s2 = '237 500 F', w1 = measure(s1, f), w2 = measure(s2, f);
        text(s1, -(w1 + w2) / 2, -2, { font: f, color: C.ink }); text(s2, -(w1 + w2) / 2 + w1, -2, { font: f, color: '#0E8A48' });
        text('de vrai bénéfice (exemple)', 0, 50, { font: font(FF.hand, 44, 800), align: 'center', color: C.inkSoft }); }); }
    // Junior + maman behind a counter
    const pk = pop(t, T.junior - .5, 11, .5); if (pk <= 0) return;
    const PY = 1058, S = .66, JX = 250, MX = 830, CT = 1160;
    const give = eInOutCubic(prog(t, T.pagne - .3, T.pagne + .12)), passed = t >= T.pagne + .1, back = eInOutCubic(prog(t, T.pagne + .1, T.paye - .1));
    const won = t >= T.paye - .06, bl = k => (n + k) % 97 < 3;
    const jj = jit(730, n, .7), mj = jit(731, n, .7), rise = (1 - clamp(pk)) * 400;
    const folded = () => { withShadow(6, () => { ctx.fillStyle = C.orange; rrect(-80, -52, 160, 104, 8); ctx.fill(); });
      ctx.save(); rrect(-80, -52, 160, 104, 8); ctx.clip(); waxFill(-80, -52, 160, 104, 5, [C.violetD, C.amber, C.orange, '#1F5B45']);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-80, -8, 160, 12); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-80, 6, 160, 6); ctx.restore(); };
    const jArm = won ? 'thumb' : passed ? [lerp(420, 150, back), lerp(-10, 150, back)] : [lerp(110, 420, give), lerp(50, -10, give)];
    at(JX + jj.x, PY + rise + jj.y, jj.r, S, S * (1 + .012 * Math.sin(t * 3)), () =>
      person({ skin: SKIN[0], outfit: C.violet, hair: 'cap', capColor: C.amber, face: won ? 'grin' : 'smile', arms: ['idle', jArm], look: .7, blink: bl(0),
        handProp: passed ? null : folded, handSide: 1 }));
    const mArms = won ? [[150, -20], [150, -20]] : passed ? [[lerp(420, 110, back), lerp(-10, 50, back)], 'idle'] : [[lerp(70, 420, give), lerp(120, -10, give)], 'idle'];
    at(MX + mj.x, PY + rise + mj.y, mj.r, S, S * (1 + .012 * Math.sin(t * 3 + 1)), () =>
      person({ skin: SKIN[1], outfit: C.orange, wax: true, hair: 'wrap', face: won ? 'grin' : passed ? 'smile' : 'smile', arms: mArms, look: -.7, blink: bl(40),
        handProp: passed && !won ? folded : null, handSide: -1 }));
    // counter in front
    withShadow(12, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(-20, CT + rise * .3, W + 40, 110); });
    ctx.fillStyle = C.kraftD; ctx.fillRect(-20, CT + rise * .3, W + 40, 14);
    // the pagne unfolds between maman's hands, over the counter (accordion on twos)
    if (won) { const u = Math.min(1, (Math.floor(Math.max(0, stepT(n) - T.paye + .06) * 15) + 1) / 5), ku = eOutCubic(clamp(u));
      at(MX + mj.x, PY + mj.y, mj.r, S, S, () => {
        const cw = lerp(160, 440, ku), chh = lerp(104, 330, ku), y0 = -24;
        withShadow(12, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(-cw / 2, y0); ctx.lineTo(cw / 2, y0);
          for (let x = cw / 2; x >= -cw / 2; x -= 20) ctx.lineTo(x, y0 + chh + Math.sin(x * .05 + t * 4) * 7); ctx.closePath(); ctx.fill(); });
        ctx.save(); ctx.beginPath(); ctx.rect(-cw / 2, y0, cw, chh + 10); ctx.clip(); waxFill(-cw / 2, y0, cw, chh + 10, 5, [C.violetD, C.amber, C.orange, '#1F5B45']);
        for (let i = 1; i < 4; i++) { const fx = -cw / 2 + cw * i / 4; ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)'; ctx.fillRect(fx - 10, y0, 20, chh + 10); }
        ctx.restore();
        ctx.fillStyle = SKIN[1]; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 150, -20, 33, 0, 7); ctx.fill(); }
      }); }
    // « Pagne du 8 mars : PAYÉ »
    const lk = pop(t, T.paye - .1, 12, .45);
    if (lk > 0) { const j = jit(740, n, .5);
      at(480 + j.x, 780 + j.y, -.02 + j.r, lk, lk, () => { card(700, 100, '#FFFDF7', 97); tape(-320, -40, -.5, 70); tape(320, -40, .5, 70);
        text('Pagne du 8 mars :', -100, 18, { font: font(FF.hand, 54, 800), align: 'center', color: C.violetD });
        const ss = t - T.paye, sc = ss < 0 ? 1.6 : 1 + .12 * Math.exp(-ss * 14) * Math.cos(ss * 40);
        at(236, 0, -.08, sc, sc, () => stampText('PAYÉ', 0, 0, font(FF.stencil, 64, 900), '#0E8A48', { box: true, boxW: 7, h: 84, ls: 5, starve: .28, alpha: ss < 0 ? 0 : .95 })); }); }
    if (won) { at(MX, 990, 0, 1, 1, () => confetti(t - T.paye, 56, 11)); at(480, 780, 0, 1, 1, () => confetti(t - T.paye - .12, 30, 23)); }
  }

  // ================================================================== scene
  registerScene({
    id: 'method', z: 40,
    when: t => t >= TL.ch('formule').start && t < TL.ch('marche').start,
    draw(t, n) {
      if (!T) T = times();
      const sh = shake(t), cx = Math.sin(t * .45) * 6 + sh.x, cy = Math.cos(t * .33) * 5 + sh.y, cr = Math.sin(t * .21) * .003;
      ctx.translate(W / 2 + cx, H / 2 + cy); ctx.rotate(cr); ctx.translate(-W / 2, -H / 2);
      flecks(t, n, 1);
      rulerRig(t, n);
      formulaCard(t, n);
      calcs(t, n);
      happy(t, n);
    },
  });
})();

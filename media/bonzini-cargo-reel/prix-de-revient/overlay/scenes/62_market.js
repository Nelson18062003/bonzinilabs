'use strict';
// S18–S19 « Le marché · les réflexes » (chapters marche · reflexes) — full frame, the note spine is gone.
// S18  Two Mboppi stalls: the neighbour's tag « 11 000 F », ours « 12 500 F » sweats (3 paper drops) and wobbles.
//      The tailor's scissors hover over our tag, turn away (full spin) and dive onto a row of cost envelopes: snip, snip, snip.
//      Bands « NE COUPEZ PAS LA MARGE : » / « COUPEZ LES MORCEAUX », post-it « Mboppi paie 11 000 ? … = 8 800 F ».
// S19  Four post-its fall on the words (négociez · photos · total · then ④ on screen only), each with a mini envelope
//      that small scissors make thinner. Hard cut under the tape wipe at the bonzini chapter.
// Captions band (y 1250–1430) stays clear. Nothing important at x > 980.
(() => {
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth), we = (s, k, nth = 0) => TL.we(s, k, null, nth);
  function times() {
    const o = {
      m0: TL.ch('marche').start, r0: TL.ch('reflexes').start, r1: TL.ch('bonzini').start,
      mboppi: w('S18', 'mboppi'), suit: w('S18', 'suit'), pas1: w('S18', 'pas'), ne2: w('S18', 'ne', 1), coupez1: w('S18', 'coupez'), pas2: w('S18', 'pas', 1),
      marge: w('S18', 'marge'), coupez2: w('S18', 'coupez', 1), les: w('S18', 'les'), morceaux: w('S18', 'morceaux'), morcE: we('S18', 'morceaux'),
      negociez: w('S19', 'negociez'), photos: w('S19', 'photos'), total: w('S19', 'total'), cfa: w('S19', 'cfa'), pasT: w('S19', 'pas'), taux: w('S19', 'taux'),
    };
    o.snips = [o.coupez2 + .2, o.les + .1, o.morceaux + .12];          // S18 scissors snips on the envelope row
    o.rows = [o.negociez - .04, o.photos - .04, o.total - .04, Math.max(o.total + 1.05, o.pasT - .1)];
    o.out = o.r0 + .05;                                                // stall scene leaves
    o.shakes = [[o.ne2, 6], [o.coupez2, 6], ...o.snips.map(s => [s, 3]), ...o.rows.map(r => [r + .18, 3])];
    return o;
  }
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);

  // ------------------------------------------------------------------ local props
  function tornRect(tw, th, seed, amp = 2.2, fill) {
    ctx.beginPath(); const tp = tornLine(-tw / 2, -th / 2, tw / 2, -th / 2, seed, amp, 9), bt = tornLine(tw / 2, th / 2, -tw / 2, th / 2, seed + 5, amp, 9);
    ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }
  function card(cw, ch, fill = C.cream, seed = 1, lift = 9) { withShadow(lift, () => tornRect(cw, ch, seed, 2.5, fill)); }
  function tape(x, y, r = 0, len = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -15, len, 30); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -11, len, 4); }); }
  function sticky(sw, sh, fill = '#FFE36E', lift = 10) {
    withShadow(lift, () => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-sw / 2, -sh / 2); ctx.lineTo(sw / 2, -sh / 2); ctx.lineTo(sw / 2, sh / 2 - 28); ctx.lineTo(sw / 2 - 28, sh / 2); ctx.lineTo(-sw / 2, sh / 2); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.moveTo(sw / 2, sh / 2 - 28); ctx.lineTo(sw / 2 - 28, sh / 2); ctx.lineTo(sw / 2 - 24, sh / 2 - 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(160,110,0,.10)'; ctx.fillRect(-sw / 2, -sh / 2, sw, sh * .12);
  }
  /** kraft envelope, spine look; cut = 0..1 how much of the right side has been snipped off (it gets thinner) */
  function envelope(ew, eh, label, o = {}) {
    const cw = ew * (1 - .28 * (o.cut || 0)), x0 = -ew / 2;
    withShadow(o.lift ?? 4, () => { ctx.fillStyle = C.kraftL; rrect(x0, -eh / 2, cw, eh, 6); ctx.fill(); });
    ctx.save(); rrect(x0, -eh / 2, cw, eh, 6); ctx.clip();
    ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .55; ctx.fillRect(x0, -eh / 2, cw, eh); ctx.globalAlpha /= .55;
    ctx.fillStyle = 'rgba(90,60,30,.35)'; ctx.beginPath(); ctx.moveTo(x0, -eh / 2); ctx.lineTo(x0 + cw / 2, -eh / 2 + eh * .55); ctx.lineTo(x0 + cw, -eh / 2); ctx.closePath(); ctx.fill();
    if (o.cut) { ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x0 + cw - 2, -eh / 2); ctx.lineTo(x0 + cw - 2, eh / 2); ctx.stroke(); }
    ctx.restore();
    const fs = o.fs || eh * .25, f = font(FF.stencil, fs, 800), parts = label.split(' ');
    const l1 = parts.length > 1 ? parts.slice(0, -1).join(' ') : label, l2 = parts.length > 1 ? parts[parts.length - 1] : '', yb = eh / 2 - fs * .42, cx = x0 + cw / 2;
    if (l2) { text(l1, cx, yb - fs * 1.02, { font: f, align: 'center', color: C.ink, ls: 1 }); text(l2, cx, yb, { font: f, align: 'center', color: C.ink, ls: 1 }); }
    else text(l1, cx, yb - fs * .5, { font: f, align: 'center', color: C.ink, ls: 1 });
    return cw;
  }
  /** strip of envelope that falls after a snip (local time s) */
  function sliver(ew, eh, s, seed) {
    if (s < 0 || s > .9) return; const sw = ew * .28;
    at(s * 40 * (rnd(seed) > .5 ? 1 : -1), s * 60 + 700 * s * s, s * (2 + rnd(seed) * 3), 1, 1, () => { ctx.globalAlpha *= clamp((.9 - s) / .3);
      withShadow(6, () => { ctx.fillStyle = C.kraftL; ctx.fillRect(-sw / 2, -eh / 2, sw, eh); }); ctx.fillStyle = 'rgba(90,60,30,.3)'; ctx.fillRect(-sw / 2, -eh / 2, sw, 8); });
  }
  function band(str, x, y, a, o = {}) {
    if (a <= 0) return 0; const size = o.size || 72, f = font(FF.stencil, size, 900), ls = o.ls ?? 3, wd = measure(str, f, ls) + 80;
    ctx.save(); ctx.globalAlpha *= clamp(a);
    paperNote(x, y, wd, size * 1.32, o.rot ?? -.015, () => {
      if (o.parts) { let xx = -wd / 2 + 40; for (const [s, c] of o.parts) { text(s, xx, size * .36, { font: f, color: c, ls }); xx += measure(s, f, ls); } }
      else text(str, 0, size * .36, { font: f, align: 'center', color: o.color || C.ink, ls });
    }, { seed: o.seed || 5, h: 10, fill: o.fill });
    ctx.restore(); return wd;
  }
  function drop3(x, y, s, a = 1) {                    // a paper sweat drop
    at(x, y, 0, s, s, () => { ctx.globalAlpha *= a;
      withShadow(4, () => { ctx.fillStyle = '#9FD3FF'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(16, 4, 0, 12); ctx.quadraticCurveTo(-16, 4, 0, -22); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-4, 0, 3, 6, .3, 0, 7); ctx.fill(); });
  }
  function flecks(t, n, a = 1) {
    const ts = stepT(n), cols = [C.kraftL, C.amber, C.violet, '#FFFFFF', C.orange];
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const x = ((rnd(i * 3.7) * (W + 200) + ts * (8 + rnd(i) * 16)) % (W + 200)) - 100, y = 170 + ((rnd(i * 8.3) * 1080 + ts * (5 + rnd(i * 2.2) * 9)) % 1080);
      ctx.globalAlpha = a * (.25 + .25 * rnd(i * 5.5));
      at(x, y, ts * (rnd(i * 1.9) - .5) * 2 + i, 1, 1, () => { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-5, -3, 10 + rnd(i) * 6, 6); });
    }
    ctx.restore();
  }
  function shake(t) { let x = 0, y = 0; for (const [t0, a] of T.shakes) { const s = t - t0; if (s < 0 || s > .4) continue; const e = Math.exp(-s * 12) * a; x += Math.sin(s * 88) * e; y += Math.cos(s * 71) * e; } return { x, y }; }

  // ================================================================== S18 — the stalls
  const SY = 1000, LX = 270, RX = 800, TAGY = 700;
  const LABELS = ['FOURNISSEUR', 'TAUX + FRAIS', 'CAMION CHINE', 'BATEAU', 'DOUANE', 'PETITS FRAIS', 'PERTES'];
  const ENVX = i => 146 + i * 131.3, ENVY = 1122, EW = 118, EH = 84;
  function shelf(n, seed) {
    ctx.fillStyle = C.kraftD; ctx.fillRect(-200, -250, 400, 14);
    for (let i = 0; i < 3; i++) { const j = jit(seed + i, n, .3); at(-130 + i * 130 + j.x, -292 + j.y, 0, 1, 1, () => shoeBox(112, 80, { band: [C.orange, C.violet, C.amber][(i + seed) % 3], lift: 3 })); }
  }
  function stalls(t, n, out) {
    const oy = out * 1500;
    ctx.save(); ctx.translate(0, oy);
    // vendors behind the counters (drawn inside the stalls' « behind » hook)
    const bl = k => (n + k) % 89 < 3;
    at(LX, SY, 0, .9, .9, () => stall(500, { stripe: C.violet, h: 236, boxes: false, behind: () => { shelf(n, 11);
      const j = jit(801, n, .6); at(-170 + j.x, -70 + j.y, j.r, .44, .44, () => person({ skin: SKIN[3], outfit: C.violet, hair: 'wrap', waxCols: [C.violet, C.amber, C.cream, C.orange], face: t > T.suit ? 'grin' : 'smile', arms: ['idle', 'thumb'], look: .6, blink: bl(0) })); } }));
    const worry = t >= T.pas1 - .1;
    at(RX, SY, 0, .9, .9, () => stall(500, { stripe: C.orange, h: 236, boxes: false, behind: () => { shelf(n, 12);
      const j = jit(802, n, worry ? 1.3 : .6); at(165 + j.x, -70 + j.y, j.r, .44, .44, () => person({ skin: SKIN[0], outfit: C.violet, hair: 'cap', capColor: C.amber, face: worry ? 'worry' : 'smile', arms: worry ? ['chin', 'idle'] : ['idle', 'idle'], look: -.7, blink: bl(30), sweat: worry && Math.floor(n / 6) % 2 === 0 })); } }));
    // sneakers on the counters
    for (const [x, id] of [[LX + 20, 810], [RX - 20, 811]]) { const j = jit(id, n, .5); at(x + j.x, SY - 50 + j.y, j.r, 1, 1, () => sneaker(230, { lift: 5, color: id === 810 ? C.amber : C.violet, accent: id === 810 ? C.violet : C.amber })); }
    // envelope row on a cream strip pinned to the counter front
    const ek = eOutCubic(prog(t, T.pas2 - .1, T.pas2 + .35));
    if (ek > 0) { ctx.save(); ctx.translate(0, (1 - ek) * 260);
      withShadow(8, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); const tp = tornLine(50, ENVY - 62, 1030, ENVY - 62, 5, 2.5, 12), bt = tornLine(1030, ENVY + 60, 50, ENVY + 60, 9, 2.5, 12);
        ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
      tape(70, ENVY - 50, -.6, 60); tape(1010, ENVY - 50, .6, 60);
      LABELS.forEach((lab, i) => { const j = jit(820 + i, n, .5), k = [0, 3, 6].indexOf(i), snip = k >= 0 ? T.snips[k] : 1e9;
        const cut = t >= snip ? 1 : 0, bump = t >= snip ? 1 + .08 * Math.exp(-(t - snip) * 14) * Math.cos((t - snip) * 40) : 1;
        at(ENVX(i) + j.x, ENVY + j.y, (i % 2 ? .03 : -.03) + j.r, bump, bump, () => envelope(EW, EH, lab, { fs: 21, cut }));
        if (k >= 0) at(ENVX(i) + EW * .38, ENVY, 0, 1, 1, () => sliver(EW, EH, t - snip, i + 3)); });
      ctx.restore(); }
    ctx.restore();
  }
  function tags(t, n, out) {
    const oy = out * 1500;
    // neighbour's tag pops on « suit »
    const nk = pop(t, T.suit - .08, 13, .4);
    if (nk > 0) { const sw = .05 * Math.sin(t * 2.4);
      at(LX + 30, 576 + oy, sw, 1, 1, () => { tape(0, 0, .1, 60); at(0, 150 - (1 - clamp(nk)) * 80, 0, clamp(nk, 0, 1.2), clamp(nk, 0, 1.2), () => priceTag(290, 172, () => {
        text('LE VOISIN', 0, -6, { font: font(FF.stencil, 40, 900), align: 'center', color: C.inkSoft, ls: 3 });
        handText('11 000 F', 0, 60, 60, { color: '#0E8A48', pen: false }); }, { string: 64 })); }); }
    // ours: sweats and wobbles from « pas »
    const worry = prog(t, T.pas1 - .15, T.pas1 + .3), scared = env(t, T.ne2 - .2, T.pas2 + .2, .2, .3);
    const wob = worry * (.07 * Math.sin(t * 13) + .04 * Math.sin(t * 29)) + scared * .05 * Math.sin(t * 41) + .03 * Math.sin(t * 2.1);
    at(RX - 30, 576 + oy, wob, 1, 1, () => { tape(0, 0, -.1, 60); at(0, 150, 0, 1, 1, () => {
      priceTag(290, 172, () => {
        text('CHEZ VOUS', 0, -6, { font: font(FF.stencil, 40, 900), align: 'center', color: C.inkSoft, ls: 3 });
        handText('12 500 F', 0, 60, 60, { color: C.violetD, pen: false }); }, { string: 64 });
      // three paper sweat drops slide down and fall (loop)
      if (worry > 0) for (let i = 0; i < 3; i++) { const ph = ((t - T.pas1) * .9 + i / 3) % 1, x = [-136, 134, -128][i], y0 = -52 + i * 10;
        const y = ph < .55 ? y0 + ph * 90 : y0 + 50 + (ph - .55) * 520, a = worry * (ph < .85 ? 1 : (1 - ph) / .15);
        drop3(x + (ph > .55 ? (i % 2 ? 1 : -1) * (ph - .55) * 60 : 0), y, 1.3 + .4 * Math.min(ph * 2, 1), a); }
    }); });
  }
  function bigScissors(t, n) {
    const t0 = T.ne2 - .25, tEnd = T.morcE + .45; if (t < t0 || t > tEnd) return;
    // keyframes: enter → hover over our tag string → recoil & spin away on « pas » → hover above the row → dive + 3 snips → exit
    const hover = [RX + 150, 470], away = [560, 520];
    const enter = eOutCubic(prog(t, t0, t0 + .45)), spin = eInOutCubic(prog(t, T.pas2 - .06, T.pas2 + .55));
    let x = lerp(W + 300, hover[0], enter), y = lerp(260, hover[1], enter), a = 2.62 + (1 - enter) * .6, open = .35 + .25 * Math.sin(t * 16) * (1 - spin);
    if (spin > 0) { x = lerp(hover[0], away[0], spin); y = lerp(hover[1], away[1], spin) - Math.sin(spin * Math.PI) * 120; a = lerp(2.62, Math.PI / 2 - Math.PI * 2, spin); open = lerp(open, .15, spin); }
    const dive = t >= T.coupez2 - .1;
    if (dive) {                                   // travel along the snips, point down, blade tips at the envelope's right third
      const pts = T.snips.map((s, k) => [s, ENVX([0, 3, 6][k]) + EW * .3]);
      let k = pts.findIndex(([s]) => t < s + .06); if (k < 0) k = pts.length - 1;
      const [sk, xk] = pts[k], prev = k === 0 ? [T.coupez2 - .1, away[0]] : pts[k - 1];
      const mv = eInOutCubic(prog(t, prev[0] + .04, sk - .02));
      x = lerp(prev[1], xk, mv) - 26; const yTop = ENVY - 250, yCut = ENVY - 170;
      y = k === 0 ? lerp(away[1], yCut, eInOutCubic(prog(t, T.coupez2 - .1, sk - .02))) : yCut - Math.sin(mv * Math.PI) * 60;
      a = Math.PI / 2 + .12; const sn = t - sk; open = sn < 0 ? .5 : sn < .06 ? .5 * (1 - sn / .06) : Math.min(.5, (sn - .06) * 3);
      if (t > T.snips[2] + .12) { const ex = eInCubic(prog(t, T.snips[2] + .12, tEnd)); x += ex * 700; y = lerp(yCut, yTop - 200, ex); }
    }
    const j = jit(840, n, .6);
    at(x + j.x, y + j.y, a, 1.02, 1.02, () => withShadow(26, () => scissors(open, C.orange)));
    // snip sparks
    for (const [s, k] of T.snips.map((s, k) => [s, k])) { const d = t - s; if (d < 0 || d > .3) continue; const cx = ENVX([0, 3, 6][k]) + EW * .3, cy = ENVY - 40;
      ctx.save(); ctx.globalAlpha = 1 - d / .3; ctx.strokeStyle = C.amber; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const aa = i * Math.PI / 3 + .4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(aa) * (18 + 50 * d), cy + Math.sin(aa) * (18 + 50 * d)); ctx.lineTo(cx + Math.cos(aa) * (30 + 80 * d), cy + Math.sin(aa) * (30 + 80 * d)); ctx.stroke(); }
      ctx.restore(); }
    // « ✗ » on the tag when the scissors are told off
    const xk = env(t, T.pas2 - .1, T.pas2 + .7, .08, .25);
    if (xk > 0) at(540, 610, -.12, .85, .85, () => { ctx.save(); ctx.globalAlpha = xk; stampText('NON', 0, 0, font(FF.stencil, 70, 900), M.red, { box: true, boxW: 7, h: 96, ls: 6 }); ctx.restore(); });
  }
  function mboppiSign(t, n) {
    const k = pop(t, T.m0 + .1, 10, .4), bounce = t > T.mboppi ? .06 * Math.exp(-(t - T.mboppi) * 5) * Math.sin((t - T.mboppi) * 22) : 0;
    const out = eInCubic(prog(t, T.ne2 - .3, T.ne2 + .05)); if (k <= 0 || out >= 1) return;
    const sw = .035 * Math.sin(t * 1.9) + bounce;
    at(600, 262 - (1 - clamp(k)) * 200 - out * 400, sw + out * .3, 1, 1, () => {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 220, -60); ctx.lineTo(s * 180, -170); ctx.stroke(); }
      withShadow(10, () => { ctx.fillStyle = C.ink; rrect(-290, -62, 580, 124, 16); ctx.fill(); });
      ctx.strokeStyle = C.amber; ctx.lineWidth = 4; rrect(-276, -48, 552, 96, 10); ctx.stroke();
      text('MARCHÉ MBOPPI', 0, 24, { font: font(FF.stencil, 70, 900), align: 'center', color: C.amber, ls: 6 });
    });
  }
  function s18Bands(t, n) {
    const b1 = pop(t, T.ne2 - .06, 13, .45), b2 = pop(t, T.coupez2 - .06, 13, .45);
    const o1 = eInCubic(prog(t, T.out, T.out + .4)), m2 = eInOutCubic(prog(t, T.out + .1, T.out + .55));
    if (b1 > 0 && o1 < 1) at(540 - o1 * 1300, 296, -o1 * .2, b1, b1, () => band('NE COUPEZ PAS LA MARGE :', 0, 0, 1, { size: 72, parts: [['NE COUPEZ PAS LA ', C.ink], ['MARGE', C.orange], [' :', C.ink]], seed: 31 }));
    if (b2 > 0) at(540, lerp(402, 296, m2), 0, b2, b2, () => band('COUPEZ LES MORCEAUX', 0, 0, 1, { size: 76, parts: [['COUPEZ LES ', C.ink], ['MORCEAUX', C.violetD]], seed: 37, fill: '#FFF1D6' }));
  }
  function targetNote(t, n) {
    const d = drop(t, T.morceaux + .1, 420, .18); if (!d.a) return;
    const out = eInCubic(prog(t, T.negociez - .55, T.negociez - .15)), j = jit(850, n, .5);
    at(318 + j.x - out * 900, 780 + d.y + j.y, -.045 + j.r - out * .4, d.sx, d.sy, () => {
      sticky(560, 340); tape(0, -160, 0, 120);
      handText('Mboppi paie 11 000 ?', -250, -86, 44, { align: 'left', color: C.ink, pen: false, write: prog(t, T.morceaux + .2, T.morceaux + .5) });
      handText('Coût visé :', -250, -22, 44, { align: 'left', color: C.ink, pen: false, write: prog(t, T.morceaux + .4, T.morceaux + .6) });
      handText('11 000 × 0,80', -250, 48, 54, { align: 'left', color: C.inkSoft, pen: false, write: prog(t, T.morceaux + .55, T.morceaux + .8) });
      handText('= 8 800 F', -250, 124, 68, { align: 'left', color: C.violetD, pen: false, write: prog(t, T.morceaux + .75, T.morceaux + 1.0) });
      at(170, 110, -.2, 1, 1, () => stampText('exemple', 0, 0, font(FF.stencil, 34, 900), C.orange, { box: true, boxW: 4, h: 52, ls: 3, alpha: t > T.morceaux + 1.0 ? .9 : 0 }));
    });
  }

  // ================================================================== S19 — four reflexes
  const ROWY = [452, 652, 852, 1052];
  const REFLEX = [
    { lines: ['NÉGOCIER'], env: 'FOURNISSEUR', icon: 'tag', fill: '#FFE36E' },
    { lines: ['PHOTOS AVANT', 'EXPÉDITION'], env: 'PERTES', icon: 'camera', fill: '#FFD7C2' },
    { lines: ['LE TOTAL EN F CFA,', 'PAS LE TAUX'], env: 'TAUX + FRAIS', icon: 'receipts', fill: '#EFE3FF' },
    { lines: ['MOINS DE VIDE', 'DANS LES CARTONS'], env: 'BATEAU', icon: 'carton', fill: '#D8F0DD' },
  ];
  function icon(kind, t, t0) {
    const k = clamp((t - t0 - .15) / .3);
    if (kind === 'tag') {                                     // price tag squeezed down by an arrow
      at(0, 0, -.25, 1, 1, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(-34, -22); ctx.lineTo(24, -22); ctx.lineTo(44, 0); ctx.lineTo(24, 22); ctx.lineTo(-34, 22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(26, 0, 6, 0, 7); ctx.fill(); });
      handArrow([[-4, -60], [-6, -20], [-2, 34 * k + 6]], k, C.orange, 6);
    } else if (kind === 'camera') {
      ctx.fillStyle = '#2B2230'; rrect(-44, -28, 88, 60, 10); ctx.fill(); rrect(-20, -38, 34, 14, 4); ctx.fill();
      ctx.fillStyle = '#9CC3E6'; ctx.beginPath(); ctx.arc(0, 2, 19, 0, 7); ctx.fill(); ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(0, 2, 9, 0, 7); ctx.fill();
      const fl = t > t0 + .3 && t < t0 + .42; if (fl) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(30, -18, 26, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#FFE9A8'; ctx.beginPath(); ctx.arc(30, -18, 6, 0, 7); ctx.fill();
    } else if (kind === 'receipts') {
      for (const s of [-1, 1]) at(s * 24, 0, s * .06, 1, 1, () => { ctx.fillStyle = M.paper; ctx.beginPath(); ctx.moveTo(-18, -40); ctx.lineTo(18, -40); ctx.lineTo(18, 36); for (let x = 18; x > -18; x -= 9) { ctx.lineTo(x - 4.5, 31); ctx.lineTo(x - 9, 36); } ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(35,22,41,.3)'; for (let r = 0; r < 4; r++) ctx.fillRect(-12, -30 + r * 11, 24, 3); ctx.fillStyle = C.ink; ctx.fillRect(-12, 18, 24, 5); });
      for (const s of [-1, 1]) at(s * 24, 20, 0, 1, 1, () => handCircle(22, 11, k, M.red, 3.5, 3 + s));
    } else {                                                  // carton squeezed by two arrows
      const sq = 1 - .18 * k;
      at(0, 0, 0, sq, 1, () => carton(70, 58, { seed: 3, bev: 6 }));
      for (const s of [-1, 1]) { ctx.save(); ctx.strokeStyle = C.violetD; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); const x0 = s * 66, x1 = s * (50 - 6 * k);
        ctx.moveTo(x0 + s * 10, 0); ctx.lineTo(x1, 0); ctx.moveTo(x1 + s * 9, -9); ctx.lineTo(x1, 0); ctx.lineTo(x1 + s * 9, 9); ctx.stroke(); ctx.restore(); }
    }
  }
  function reflexRow(t, n, i) {
    const R = REFLEX[i], t0 = T.rows[i], y = ROWY[i];
    // ④ slides in from the right so it never crosses ③ while ③ is being spoken; the others drop from above
    const d = i === 3 ? { y: 0, sx: 1, sy: 1, a: t >= t0 ? 1 : 0 } : drop(t, t0, 360, .2); if (!d.a) return;
    const slide = i === 3 ? (1 - eOutCubic(prog(t, t0, t0 + .35))) * 760 : 0;
    const j = jit(860 + i, n, .5), rot = (i % 2 ? .018 : -.022) + j.r, flut = t < t0 + .2 ? Math.sin((t - t0) * 30) * .06 : 0;
    // post-it
    at(344 + slide + j.x, y + d.y + j.y, rot + flut, d.sx, d.sy, () => {
      sticky(620, 176, R.fill, 9); tape(-246, -80, -.35, 70);
      withShadow(4, () => { ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(-292, -70, 32, 0, 7); ctx.fill(); });
      text(String(i + 1), -292, -56, { font: font(FF.brand, 42, 900), align: 'center', color: '#FFFFFF' });
      const two = R.lines.length > 1, base = two ? 50 : 66, lw = Math.max(...R.lines.map(s => measure(s, font(FF.hand, base, 800)))), fs = Math.min(base, base * 440 / lw);
      const wr = prog(t, t0 + .12, t0 + .12 + .35 * R.lines.length);
      R.lines.forEach((s, k) => handText(s, -214, two ? -6 + k * 58 : 24, fs, { align: 'left', color: C.ink, pen: false, write: clamp(wr * R.lines.length - k) }));
      at(268, 4, 0, .75, .75, () => icon(R.icon, t, t0));
    });
    // mini envelope that gets thinner under small scissors
    const ek = pop(t, t0 + .12, 14, .45); if (ek <= 0) return;
    const snip = t0 + .62, cut = t >= snip ? 1 : 0, ej = jit(870 + i, n, .5), bump = t >= snip ? 1 + .1 * Math.exp(-(t - snip) * 14) * Math.cos((t - snip) * 40) : 1;
    const ex = 800, ew = 196, eh = 124;
    at(ex + ej.x, y + ej.y, (i % 2 ? .03 : -.03) + ej.r, ek * bump, ek * bump, () => envelope(ew, eh, R.env, { fs: 26, cut, lift: 6 }));
    at(ex - ew / 2 + ew * .86, y, 0, 1, 1, () => sliver(ew, eh, t - snip, i + 11));
    // small scissors: come in from the right, snip, leave
    const sIn = eOutCubic(prog(t, t0 + .22, t0 + .52)), sOut = eInCubic(prog(t, snip + .18, snip + .55));
    if (sIn > 0 && sOut < 1) { const sn = t - snip, open = sn < 0 ? .5 : sn < .07 ? .5 * (1 - sn / .07) : .05;
      const cx = ex - ew / 2 + ew * .72 + 116, cy = y - 8;
      at(lerp(W + 180, cx, sIn) + sOut * 360, cy - sOut * 40, Math.PI + .12 + sOut * .5, .56, .56, () => withShadow(18, () => scissors(open, [C.orange, C.violet, C.amber, C.orange][i]))); }
    if (t - snip > 0 && t - snip < .28) { const s = (t - snip) / .28; ctx.save(); ctx.globalAlpha = 1 - s; ctx.strokeStyle = C.amber; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const cx = ex - ew / 2 + ew * .72, cy = y - 8; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + .3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (14 + 30 * s), cy + Math.sin(a) * (14 + 30 * s)); ctx.lineTo(cx + Math.cos(a) * (24 + 50 * s), cy + Math.sin(a) * (24 + 50 * s)); ctx.stroke(); } ctx.restore(); }
  }

  // ================================================================== scene
  registerScene({
    id: 'market', z: 40,
    when: t => t >= TL.ch('marche').start && t < TL.ch('bonzini').start,
    draw(t, n) {
      if (!T) T = times();
      const sh = shake(t), cx = Math.sin(t * .41) * 6 + sh.x, cy = Math.cos(t * .29) * 5 + sh.y, cr = Math.sin(t * .19) * .003;
      ctx.translate(W / 2 + cx, H / 2 + cy); ctx.rotate(cr); ctx.translate(-W / 2, -H / 2);
      flecks(t, n, 1);
      const out = eInCubic(prog(t, T.out, T.out + .5));
      if (out < 1) { stalls(t, n, out); tags(t, n, out); }
      mboppiSign(t, n);
      bigScissors(t, n);
      targetNote(t, n);
      for (let i = 0; i < 4; i++) reflexRow(t, n, i);
      s18Bands(t, n);
    },
  });
})();

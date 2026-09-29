'use strict';
// S2–S4 « Junior » — Junior behind his shoe boxes at Mboppi, the « × 2 » dream bubble, the comment dare.
// Vignette band y 880–1240 only (the note spine owns y < 870 until S12; captions live at y 1250–1430).
// z 25 (under the spine, z 30): the spine's « TCHAC ! LE BILLET MAIGRIT. » strip (y≈1150) lays over this band.
(() => {
  const Y0 = 878, Y1 = 1246;                        // clip of the band
  const JX = 150, JY = 1094, JS = .55;              // Junior: chest centre, scale
  const BUB = { x: 345, y: 915, w: 610, h: 235 };   // thought-bubble core rect (scallops go ±30 around it)
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth);
  function times() {
    const s2 = TL.seg('S2'), s3 = TL.seg('S3'), s4 = TL.seg('S4'), s5 = TL.seg('S5');
    return { ch: TL.ch('junior'), s2, s3, s4, s5,
      baskets: w('S2', 'baskets'), junior: w('S2', 'junior'), mboppi: w('S2', 'mboppi'), chine: w('S2', 'chine'), cinq: w('S2', '5'),
      tchac: w('S2', 'tchac'), maigrit: w('S2', 'maigrit'),
      prix: w('S3', 'prix'), deux: w('S3', 'deux'), cinq3: w('S3', '5'), benef: w('S3', 'benefice'), c500: w('S3', '500'), paires: w('S3', 'paires'),
      pagne: w('S3', 'pagne'), mars: w('S3', 'mars'), maman: w('S3', 'maman'), promis: w('S3', 'promis'),
      vous: w('S4', 'vous'), il: w('S4', 'il'), vraiment: w('S4', 'vraiment'), ecrivez: w('S4', 'ecrivez'), maintenant: w('S4', 'maintenant') };
  }
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);

  // ------------------------------------------------------------------ local props
  /** small felt pen, tip at (x,y) */
  function pen(x, y, col = C.ink, rot = -.45) { at(x, y, 0, .55, .55, () => marker(0, 0, rot, col)); }
  /** shoe box, front view, origin = bottom centre. o.lid 0..1 opens the lid and shows o.inside() */
  function boxFront(bw, bh, o = {}) {
    const lidH = bh * .3, top = -bh + lidH * .55, lid = clamp(o.lid || 0);
    if (lid > 0) {                                   // open: dark inside + what is in there, then the front face
      ctx.fillStyle = '#6E5140'; rrect(-bw / 2 + 5, top - 46 * lid, bw - 10, 60 * lid, 4); ctx.fill();
      if (o.inside) { ctx.save(); ctx.beginPath(); ctx.rect(-bw / 2, top - 200, bw, 200); ctx.clip(); o.inside(lid); ctx.restore(); }
    }
    withShadow(5, () => { ctx.fillStyle = o.fill || '#E8E0D2'; ctx.fillRect(-bw / 2, top, bw, bh - lidH * .55); });
    ctx.fillStyle = o.band || C.orange; ctx.fillRect(-bw / 2, -bh * .42, bw, bh * .17);
    ctx.fillStyle = 'rgba(35,22,41,.10)'; ctx.fillRect(-bw / 2, top, bw, 5);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; rrect(bw * .12, -bh * .2, bw * .3, bh * .12, 3); ctx.fill();          // little white label
    at(0, top - 62 * lid, -.42 * lid, 1, 1, () => {                                                            // lid
      withShadow(4 + lid * 10, () => { ctx.fillStyle = o.lidFill || '#DCD2C0'; rrect(-bw / 2 - 6, -lidH, bw + 12, lidH, 4); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-bw / 2 - 4, -lidH + 3, bw + 8, 4);
    });
  }
  /** scalloped cloud path around a rect (for the thought bubble) */
  function cloudPath(x, y, bw, bh, r = 30, seed = 3) {
    ctx.beginPath(); rrect(x, y, bw, bh, 40);
    const nx = Math.max(2, Math.round(bw / (r * 1.9))), ny = Math.max(1, Math.round(bh / (r * 2)));
    for (let i = 0; i <= nx; i++) { const xx = x + 20 + (bw - 40) * i / nx, j = (rnd(seed + i) - .5) * 8;
      ctx.moveTo(xx + r + j, y); ctx.arc(xx, y + 4, r + j, 0, 7); ctx.moveTo(xx + r - j, y + bh); ctx.arc(xx, y + bh - 4, r - j * .5, 0, 7); }
    for (let i = 0; i <= ny; i++) { const yy = y + 30 + (bh - 60) * i / Math.max(1, ny);
      ctx.moveTo(x + r, yy); ctx.arc(x + 4, yy, r, 0, 7); ctx.moveTo(x + bw + r, yy); ctx.arc(x + bw - 4, yy, r, 0, 7); }
  }
  /** a paper card with a strip of tape on top */
  function card(cw, ch, fill = C.cream, seed = 1) {
    withShadow(9, () => { ctx.fillStyle = fill; ctx.beginPath(); const tp = tornLine(-cw / 2, -ch / 2, cw / 2, -ch / 2, seed, 2, 12), bt = tornLine(cw / 2, ch / 2, -cw / 2, ch / 2, seed + 5, 2, 12);
      ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  function tape(x, y, r = 0, len = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -15, len, 30); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -11, len, 4); }); }

  // ------------------------------------------------------------------ Junior
  function juniorPose(t, n) {
    let face = 'grin', arms = ['idle', 'thumb'], look = 0, tilt = 0, sweat = false;
    if (t < T.junior - .05) { face = 'smile'; arms = ['idle', 'idle']; look = .9; }
    else if (t < T.chine) { face = 'grin'; arms = ['idle', 'thumb']; }
    else if (t < T.tchac) { face = 'think'; arms = ['idle', 'point']; look = .6; }
    else if (t < T.tchac + .55) { face = 'shock'; arms = ['up', 'up']; look = 0; }
    else if (t < T.s3.start - .35) { face = 'worry'; arms = ['idle', 'idle']; look = -.4; }
    else if (t < T.pagne - .1) { face = 'smile'; arms = ['chin', 'idle']; look = .9; tilt = .06; }
    else if (t < T.promis) { face = 'grin'; arms = ['idle', 'idle']; look = .9; }
    else if (t < T.s4.start - .2) { face = 'wink'; arms = ['idle', 'thumb']; look = .4; }
    else if (t < T.il) { face = 'smile'; arms = ['idle', 'idle']; look = 0; }
    else if (t < T.maintenant) { face = 'worry'; arms = ['chin', 'idle']; look = -.2; tilt = -.05; }
    else { face = 'shock'; arms = ['up', 'up']; look = 0; sweat = true; }
    const blink = (n % 97) < 3 || ((n + 41) % 139) < 3;
    return { face, arms, look, tilt, sweat, blink };
  }
  function drawJunior(t, n, ex) {
    const peek = t < T.junior - .08 ? 1 : 1 - pop(t, T.junior - .08, 16, .45);
    const enter = prog(t, T.ch.start + .9, T.ch.start + 1.3);                  // cap rises behind the boxes
    const bob = t < T.junior ? Math.sin(stepT(n) * 5) * 4 : 0;
    const yOff = lerp(150, 50, eOutCubic(enter)) * clamp(peek, -.2, 1.2) + bob;
    if (enter <= 0) return;
    const j = jit(501, n, .8), br = 1 + .012 * Math.sin(t * 3.1);
    const P = juniorPose(t, n);
    at(JX + j.x - ex * 520, JY + yOff + j.y, j.r + P.tilt * .3, JS, JS * br, () => {
      person({ skin: SKIN[0], outfit: C.violet, hair: 'cap', capColor: C.amber, face: P.face, arms: P.arms, look: P.look, tilt: P.tilt, blink: P.blink, sweat: P.sweat });
      // gag: coin eyes on « 500 000 »
      const ce = env(t, T.c500 + .3, T.c500 + .8, .06, .08);
      if (ce > 0) for (const s of [-1, 1]) at(P.look * 8 + s * 40, -154, 0, ce, ce, () => coin(30, 'F', { tilt: 1 }));
    });
  }
  function drawBoxes(t, n, ex) {
    const clue = T.mboppi + .32, f0 = Math.round(clue * FPS);             // planted clue: 8 frames, lid ajar on two LEFT shoes
    const lid = n >= f0 && n < f0 + 8 ? [.45, 1, 1, 1, 1, 1, .6, .3][n - f0] : 0;
    const boxes = [[80, 1252, 164, 86, C.violet, 0], [244, 1252, 154, 86, C.amber, 0], [128, 1168, 228, 88, C.orange, 0], [452, 1254, 214, 84, C.violet, 1]];
    const gone = eInCubic(prog(t, T.s3.start - .95, T.s3.start - .55));             // the clue box leaves with the S2 props
    boxes.forEach(([x, y, bw, bh, band, isClue], i) => {
      const d = drop(t, T.ch.start + .35 + i * .16, 260, .2); if (!d.a) return;
      if (isClue && gone >= 1) return;
      const j = jit(510 + i, n, .5);
      at(x + j.x - ex * (560 + i * 40), y + d.y + (isClue ? gone * 140 : 0), (i - 1) * .02 + j.r, d.sx, d.sy, () => boxFront(bw, bh, { band, lid: isClue ? lid : 0,
        inside: () => { for (const sx of [-50, 50]) at(sx, -bh + 2, 0, 1, 1, () => sneaker(98, { lift: 2 })); } }));   // same orientation twice: two LEFT shoes
      if (d.landed && t - (T.ch.start + .35 + i * .16 + .2) < .35) dust(x, y - bh * .1, t - (T.ch.start + .35 + i * .16 + .2), i);
    });
  }
  function dust(x, y, s, seed) {
    ctx.save(); for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6) * Math.PI, v = 60 + rnd(seed * 9 + k) * 60;
      ctx.globalAlpha = clamp(1 - s / .35) * .5; ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(x + Math.cos(a) * v * s * 2.4, y + Math.sin(a) * 30 * s * 2, 5 + 4 * rnd(k + seed), 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ S2 props: name card, hanging sneaker + tag, « En Chine » slip
  function nameCard(t, n) {
    const k = pop(t, T.junior + .05, 13, .45), out = eInCubic(prog(t, T.s3.start - .75, T.s3.start - .45));
    if (k <= 0 || out >= 1) return;
    const j = jit(520, n, .6);
    at(500 + j.x, 958 + j.y + out * 40, -.035 + (1 - k) * .3 + j.r, k * (1 - out), k, () => {
      card(404, 140, C.cream, 21); tape(-150, -64, -.5, 80); tape(150, -64, .5, 80);
      text('JUNIOR', 0, -8, { font: font(FF.stencil, 76, 900), align: 'center', color: C.violetD, ls: 6 });
      text('Mboppi, Douala', 0, 48, { font: font(FF.hand, 44, 800), align: 'center', color: C.ink });
    });
  }
  function hangingSneaker(t, n) {
    const t0 = T.baskets - .1, up = eInCubic(prog(t, T.s3.start - .95, T.s3.start - .5));
    if (t < t0 || up >= 1) return;
    const fall = pop(t, t0, 11, .38), ax = 850, ay = Y0 + 4;
    const sy = lerp(ay - 160, 985, fall) - up * 360;
    const sw = .16 * Math.exp(-(t - t0) * 1.4) * Math.sin((t - t0) * 6.5) + .035 * Math.sin(t * 2.1);   // pendulum
    const hx = ax + Math.sin(sw) * (sy - ay), hy = sy;
    ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy - 36); ctx.stroke(); ctx.restore();
    tape(ax, ay + 6, .1, 70);
    at(hx, hy, sw * .8, 1, 1, () => {
      sneaker(236, { lift: 14 });
      const tk = pop(t, T.baskets + .35, 12, .4);                                  // price tag hangs under the sole
      if (tk > 0) at(0, 146 - (1 - clamp(tk)) * 60, -sw * 1.5 + .05, 1, 1, () => priceTag(224, 112, () => {
        handText('10 000 F', 0, 36, 46, { color: C.ink, write: prog(t, T.baskets + .4, T.baskets + .9), pen: false }); }, { string: 60 }));
    });
  }
  function chinaSlip(t, n) {
    const k = prog(t, T.chine - .12, T.chine + .15); if (k <= 0) return;
    const cut = t - T.tchac, d = cut > 0 ? cut : 0;
    if (d > 1.2) return;
    const j = jit(530, n, .6), x = lerp(-300, 480, eOutCubic(k)) + j.x + d * 80, y = 1184 + j.y + 900 * d * d, r = -.02 + d * 1.6;
    at(x, y, r, 1, 1, () => {
      card(446, 78, '#FFF1D6', 33);
      const wr = prog(t, T.chine, T.cinq + .45);
      const a = handText('En Chine : ', -202, 16, 44, { align: 'left', write: clamp(wr * 1.9), pen: false, color: C.ink });
      const wr2 = clamp(wr * 1.9 - .9);
      if (wr2 > 0) handText('5 000 F', -202 + a.wd + 6, 16, 50, { align: 'left', write: wr2, color: M.red, pen: false });
      if (wr > 0 && wr < 1) pen(-202 + (a.wd + 190) * wr, 2, wr < .5 ? C.ink : M.red);
    });
  }

  // ------------------------------------------------------------------ S3: dream bubble (notebook, coins, pagne, maman)
  function bubble(t, n, ex) {
    const t0 = T.s3.start - .45; if (t < t0) return;
    const nf = Math.min(n, Math.round((T.s4.start - .25) * FPS)), tf = Math.min(t, T.s4.start - .25);   // freeze in S4
    const g = pop(t, t0 + .25, 12, .45);
    const shrink = eInOutCubic(prog(t, T.vous - .05, T.vous + .45));
    const sc = lerp(1, .62, shrink), frz = prog(t, T.s4.start - .3, T.s4.start + .1);
    const ax = BUB.x + BUB.w, ay = BUB.y;                                        // shrink anchor = top-right corner
    const bob = Math.sin(stepT(nf) * 2.2) * 3 * (1 - frz);
    // trail of little thought circles from Junior's head
    [[228, 978, 8], [258, 958, 12], [296, 944, 17]].forEach(([x, y, r], i) => {
      const k = pop(t, t0 + i * .08, 16, .45) * (1 - shrink); if (k <= 0) return;
      at(x - ex * 520, y + bob, 0, k, k, () => withShadow(5, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }));
    });
    if (g <= 0) return;
    const bt = T.ecrivez + .3, bs = t - bt;                                      // the frozen dream pops on « Écrivez »
    if (bs > 0) { const cx0 = ax + (BUB.x + BUB.w / 2 - ax) * sc, cy0 = ay + (BUB.h / 2) * sc;
      ctx.save(); for (let i = 0; i < 22; i++) { const a = rnd(i * 3.3 + 1) * Math.PI * 2, v = 260 + rnd(i * 1.7) * 420, s = Math.min(bs, .6);
        const x = cx0 + Math.cos(a) * v * s, y = cy0 + Math.sin(a) * v * s * .6 + 900 * s * s;
        ctx.globalAlpha = clamp((.6 - bs) / .25); at(x, y, a + s * 9, 1, 1, () => { ctx.fillStyle = i % 3 ? C.cream : '#C9C2B6'; ctx.fillRect(-11, -7, 22, 14); }); }
      ctx.restore();
      if (bs > .1) return; }
    ctx.save();
    if (bs > 0) { ctx.globalAlpha *= 1 - bs / .1; }
    ctx.translate(ex * 760, bob);
    const bsc = sc * (bs > 0 ? 1 + bs * 1.5 : 1);
    ctx.translate(ax, ay); ctx.scale(bsc, bsc); ctx.translate(-ax, -ay);
    const cx = BUB.x + BUB.w / 2, cy = BUB.y + BUB.h / 2;
    ctx.translate(BUB.x, cy); ctx.scale(g, g); ctx.translate(-BUB.x, -cy);    // inflate from the left (Junior side)
    withShadow(12, () => { ctx.fillStyle = C.cream; cloudPath(BUB.x, BUB.y, BUB.w, BUB.h, 30); ctx.fill(); });
    ctx.save(); ctx.beginPath(); rrect(BUB.x - 14, BUB.y - 12, BUB.w + 28, BUB.h + 24, 40); ctx.clip();
    dreamNotebook(tf, nf); dreamPagne(tf, nf);
    // freeze: drain the colour, milky wash
    if (frz > 0) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = frz * .85; ctx.fillStyle = '#888'; ctx.fillRect(BUB.x - 40, BUB.y - 40, BUB.w + 80, BUB.h + 80);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = frz * .22; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(BUB.x - 40, BUB.y - 40, BUB.w + 80, BUB.h + 80); }
    ctx.restore();
    // « (dans sa tête) »
    const dk = pop(t, T.prix + .45, 13, .5);
    if (dk > 0) at(cx - 90, BUB.y + BUB.h + 60, .02, dk, dk, () => { card(320, 58, '#FFFFFF', 41); text('(dans sa tête)', 0, 15, { font: font(FF.hand, 44, 700), align: 'center', color: C.inkSoft }); });
    ctx.restore();
  }
  function dreamNotebook(t, n) {
    const away = eInCubic(prog(t, T.pagne - .45, T.pagne - .15));
    if (away >= 1) return coinsAway(t, n);
    const nx = BUB.x + BUB.w / 2 - 30, ny = BUB.y + BUB.h / 2, j = jit(540, n, .5);
    at(nx + j.x - away * 200, ny + j.y + away * 60, -.015 + j.r - away * 1.1, 1, 1, () => {
      notebook(540, 222, { grid: 24, lift: 5 });
      const L = [
        ['5 000 × 2 = 10 000', T.prix, T.deux + .35, C.ink],
        ['+5 000 F / paire', T.cinq3 - .06, T.benef + .45, M.gain],
        ['× 100 = 500 000 F', T.c500 - .06, T.paires + .05, C.orange],
      ];
      L.forEach(([s, a, b, col], i) => {
        const k = prog(t, a, b); if (k <= 0) return;
        const y = -58 + i * 70;
        handText(s, -244, y, 46, { align: 'left', write: k, color: col, pen: false });
        if (k < 1) pen(-244 + measure(s, font(FF.hand, 46, 800)) * k, y - 14, col);
      });
      const u = prog(t, T.paires + .1, T.paires + .4);                           // double underline under the big one
      if (u > 0) { ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (const dy of [96, 106]) { ctx.beginPath(); ctx.moveTo(-40, dy); ctx.lineTo(-40 + 250 * eOutCubic(u), dy - 3); ctx.stroke(); } ctx.restore(); }
    });
    coins(t, n, away);
  }
  function coinTimes() {
    const out = []; const add = (t0, k) => { for (let i = 0; i < k; i++) out.push(t0 + i * .07); };
    add(T.deux + .1, 2); add(T.benef + .15, 3); add(T.c500 + .2, 4); add(T.paires - .1, 3);
    return out;
  }
  function coins(t, n, away) {
    const ts = coinTimes(), bx = BUB.x + BUB.w - 42, by = BUB.y + BUB.h - 8;
    at(bx + away * 40, by + away * 220, 0, 1, 1, () => {
      ts.forEach((c, i) => { const d = drop(t, c, 140, .14); if (!d.a) return;
        at((rnd(i * 2.9) - .5) * 6, -i * 8 + d.y, 0, d.sx, d.sy, () => coin(34, '500', { tilt: .42 })); });
      const last = ts.filter(c => t >= c).pop();                                    // tiny sparkle on the newest coin
      if (last != null && t - last < .35) { const s = (t - last) / .35; ctx.save(); ctx.strokeStyle = C.amber; ctx.lineWidth = 4; ctx.globalAlpha = 1 - s;
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (30 + 30 * s), -ts.filter(c => t >= c).length * 8 - 20 + Math.sin(a) * (30 + 30 * s)); ctx.lineTo(Math.cos(a) * (44 + 36 * s), -ts.filter(c => t >= c).length * 8 - 20 + Math.sin(a) * (44 + 36 * s)); ctx.stroke(); } ctx.restore(); }
    });
  }
  function coinsAway() {}
  function dreamPagne(t, n) {
    const k0 = T.pagne - .14; if (t < k0) return;
    const steps = 5, u = Math.min(steps, Math.floor((t - k0) / (2 / FPS) + 1)) / steps;   // accordion unfold on twos
    const px = BUB.x + 30, py = BUB.y + 6, pw = 360 * eOutCubic(u), ph = 178, j = jit(550, n, .5);
    at(j.x, j.y, 0, 1, 1, () => {
      withShadow(8, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py);
        for (let x = px + pw; x >= px; x -= 20) ctx.lineTo(x, py + ph + Math.sin(x * .06 + t * 3) * 5); ctx.closePath(); ctx.fill(); });
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph + 6); ctx.clip();
      waxFill(px, py, 360, ph + 6, 5, [C.violetD, C.amber, C.orange, '#1F5B45']);
      const folds = 4; for (let i = 1; i < folds; i++) { const fx = px + pw * i / folds; ctx.fillStyle = i % 2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.12)'; ctx.fillRect(fx - 10, py, 20, ph + 6); }
      ctx.restore();
      ctx.fillStyle = C.kraftD; rrect(px - 8, py - 6, pw + 16, 12, 5); ctx.fill();                               // hanging rod
      const lk = pop(t, T.mars - .25, 13, .45);
      if (lk > 0) at(px + 200, py + ph + 18, -.03, lk, lk, () => { card(430, 70, C.cream, 57); tape(-196, -22, -.6, 50);
        text('Pagne du 8 mars', 0, 16, { font: font(FF.hand, 44, 800), align: 'center', color: C.violetD }); });
    });
    // maman pops up from the bubble's bottom edge, thumbs up on « promis »
    const m = pop(t, T.maman - .2, 12, .42); if (m <= 0) return;
    const thumb = t >= T.promis - .04, bounce = thumb ? .06 * Math.exp(-(t - T.promis) * 6) * Math.sin((t - T.promis) * 30) : 0;
    const mj = jit(560, n, .6);
    at(BUB.x + BUB.w - 92 + mj.x, BUB.y + BUB.h - 30 + (1 - m) * 190 + mj.y, mj.r, .32, .32 * (1 + bounce), () =>
      person({ skin: SKIN[1], outfit: C.orange, wax: true, hair: 'wrap', face: thumb ? 'grin' : 'smile', arms: thumb ? ['idle', 'thumb'] : ['idle', 'hold'], look: -.4, blink: (n % 83) < 3 }));
    if (thumb) for (let i = 0; i < 6; i++) { const s = ((t - T.promis) * .7 + i / 6) % 1, x0 = BUB.x + BUB.w - 120 + (rnd(i * 3.1) - .5) * 120;   // little paper hearts rise
      if (t - T.promis < i / 6 / .7) continue;
      at(x0 + Math.sin(s * 6 + i) * 12, BUB.y + BUB.h - 40 - s * 170, Math.sin(s * 5 + i) * .3, .8 + .4 * rnd(i), .8 + .4 * rnd(i), () => { ctx.globalAlpha *= clamp((1 - s) * 3) * clamp(s * 6);
        ctx.fillStyle = i % 2 ? C.orange : C.violet; ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-16, -4, -9, -16, 0, -7); ctx.bezierCurveTo(9, -16, 16, -4, 0, 8); ctx.fill(); }); }
    if (thumb && t - T.promis < .5) { const s = (t - T.promis) / .5; ctx.save(); ctx.globalAlpha = 1 - s; ctx.strokeStyle = C.amber; ctx.lineWidth = 5; ctx.lineCap = 'round';
      const hx = BUB.x + BUB.w - 92 + 75, hy = BUB.y + BUB.h - 60;
      for (let k = 0; k < 5; k++) { const a = -Math.PI * (.15 + k * .17); ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * (26 + 26 * s), hy + Math.sin(a) * (26 + 26 * s)); ctx.lineTo(hx + Math.cos(a) * (46 + 34 * s), hy + Math.sin(a) * (46 + 34 * s)); ctx.stroke(); }
      ctx.restore(); }
  }

  // ------------------------------------------------------------------ S4: the dare
  function dare(t, n, ex) {
    const t0 = T.vous - .05; if (t < t0) return;
    const k = pop(t, t0, 13, .45), j = jit(570, n, .5);
    const flip = T.ecrivez - .1, fl = t < flip ? 1 : t < flip + .16 ? Math.abs(Math.cos((t - flip) / .16 * Math.PI)) : 1;
    const second = t >= flip + .08;
    const str = second ? 'Votre chiffre en commentaire' : 'Il gagne combien, vraiment ?';
    const typed = second ? prog(t, T.ecrivez, T.ecrivez + .95) : prog(t, T.il - .04, T.vraiment + .3);
    const bw = measure('Votre chiffre en commentaire', font(FF.body, 46, 800)) + 190;
    at(556 + j.x + ex * 1000, 1152 + j.y + (1 - clamp(k)) * 50, -.012 + j.r, clamp(k, 0, 1.07), clamp(k, 0, 1.07) * fl, () =>
      commentBubble(bw, str, typed, n, { size: 46, h: 128 }));
  }
  function stamp(t, n, ex) {
    const t0 = T.maintenant; if (t < t0 - .14) return;
    const s = t - t0, k = eInCubic(prog(t, t0 - .14, t0));
    const sc = s < 0 ? lerp(1.9, 1, k) : 1 + .05 * Math.exp(-s * 12) * Math.cos(s * 40);
    const x = 540 + ex * 1000, y = 990;
    if (s < 0) { ctx.save(); ctx.globalAlpha = .25 * k; ctx.fillStyle = C.shadow + '.6)'; ctx.beginPath(); ctx.ellipse(x + 30 * (1 - k), y + 40 * (1 - k), 270 * sc, 80 * sc, -.08, 0, 7); ctx.fill(); ctx.restore(); }
    at(x, y, -.08, sc, sc, () => stampText('MAINTENANT', 0, 0, font(FF.stencil, 96, 900), C.orange, { box: true, boxW: 10, h: 132, ls: 5, alpha: s < 0 ? .25 + .6 * k : 1, starve: .45 }));
    if (s >= 0) { ctx.save(); ctx.fillStyle = C.orange;                        // ink splash specks
      for (let i = 0; i < 16; i++) { const a = rnd(i * 4.1 + 7) * Math.PI * 2, d = 300 + rnd(i * 2.3) * 60, e = eOutExpo(clamp(s / .12));
        ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d * .95 * e, y + Math.sin(a) * d * .3 * e, 3 + rnd(i) * 6, 0, 7); ctx.fill(); }
      ctx.restore(); }
  }

  registerScene({
    id: 'junior', z: 25,
    when: t => t >= TL.ch('junior').start && t < TL.seg('S5').start,
    draw(t, n) {
      if (!T) T = times();
      if (t < T.ch.start || t >= T.s5.start) return;
      const ex = eInCubic(prog(t, T.s5.start - .9, T.s5.start - .2));
      const sh = t >= T.maintenant ? Math.exp(-(t - T.maintenant) * 9) : 0;
      ctx.save(); ctx.beginPath(); ctx.rect(0, Y0, W, Y1 - Y0); ctx.clip();
      ctx.translate((rnd(n * 1.7) - .5) * 6 * sh, (rnd(n * 2.9) - .5) * 6 * sh);      // 3 px shake on « Maintenant »
      drawJunior(t, n, ex);
      drawBoxes(t, n, ex);
      bubble(t, n, ex);
      nameCard(t, n);
      hangingSneaker(t, n);
      chinaSlip(t, n);
      dare(t, n, ex);
      stamp(t, n, ex);
      ctx.restore();
    },
  });
})();

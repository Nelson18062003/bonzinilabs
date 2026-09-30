'use strict';
// =============================================================================================
// 40_quoi — chapitre « quoi » (S7)
// « Quoi ? Baskets en cuir… ou en tissu : deux codes. Et chaque code a son taux. »
// (reste calé si la voix dit l'ancienne version « Pas juste des baskets : en cuir, en tissu ? Chaque produit a son code… »)
//  · début         : la carte « 1 QUOI ? » (grande, héritée du guichet) + une boîte à chaussures fermée marquée « ? » qui tremble.
//  · « Quoi »      : la carte s'envole et se RETOURNE en en-tête qHeader(0) ; un faisceau RAYONS X balaie la boîte (négatif cyan) :
//                    on devine deux baskets dedans.
//  · « baskets »   : le couvercle saute, deux baskets bondissent (arc + écrasement à l'atterrissage) : cuir marron à gauche,
//                    tissu bleu maille à droite ; bande « CUIR OU TISSU ? ».
//  · « cuir »      : une loupe plonge sur la basket gauche (grain du cuir, surpiqûres) ; « cuir » s'écrit dessous.
//  · « tissu »     : la loupe glisse en arc vers la droite (maille) ; « tissu » s'écrit.
//  · « deux codes »/« code » : deux étiquettes papier arrivent, reliées par un fil ; les chiffres tournent comme un cadenas
//                    puis se bloquent : 64 03 / 64 04 ; note « code SH ».
//  · « chaque »    : les étiquettes sautillent, « 03 » / « 04 » entourés à l'orange.
//  · « taux »      : deux jauges « % » montent à des HAUTEURS DIFFÉRENTES (aucun nombre) ; « ≠ » ; la bande devient « 1 CODE = 1 TAUX ».
// La scène possède l'image de TL.ch('quoi').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'quoi', SEG = 'S7', QI = 0;
  const SW = 350;                                                          // sneaker width
  const SN = [
    { x: 285, y: 640, col: '#8A5A3A', acc: '#4E2E18', tex: 'leather', word: 'cuir', ink: '#7A4526', band: '#8A5A3A', code: [6, 4, 0, 3], lvl: .92 },
    { x: 770, y: 640, col: '#2F6DB5', acc: DC.blue, tex: 'knit', word: 'tissu', ink: '#245A9C', band: '#2F6DB5', code: [6, 4, 0, 4], lvl: .38 },
  ];
  const BOX = { x: 540, y: 1060, w: 440, h: 270 };
  const TAG = { y: 915, w: 330, h: 136 };
  const GY = 1180;                                                          // gauge bulb centre
  const FOC = [[-104, -30], [34, -14]];                                     // magnified spot on each sneaker (sneaker units)
  const LENS = { y: 968, r: 142, k: 3.2 };
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = k => TL.wt(SEG, k), wd = TL.word(SEG, 'deux');
    const o = { c0: c.start, c1: c.end };
    o.quoi = Math.max(o.c0 + .05, w('quoi'));
    o.bask = Math.max(o.quoi + .2, w('baskets'));
    o.cuir = Math.max(o.bask + .25, w('cuir'));
    o.tissu = Math.max(o.cuir + .25, w('tissu'));
    o.code = Math.max(o.tissu + .3, wd ? wd.s : w('code'));
    const ch = TL.word(SEG, 'chaque', 1) || TL.word(SEG, 'chaque', 0);
    o.chaque = Math.max(o.code + .45, ch ? ch.s : o.code + .6);
    o.taux = Math.max(o.chaque + .25, w('taux'));
    o.gauge = Math.max(o.chaque + .3, Math.min(o.taux - .2, o.c1 - .75));      // gauges must read before the outgoing wipe
    const c2 = TL.word(SEG, 'code', 1);                                          // « chaque CODE (a son taux) »
    o.strip2 = Math.max(o.chaque + .15, Math.min(c2 ? c2.s : o.taux - .3, o.taux - .1, o.c1 - .8));
    o.xr0 = o.quoi + .06; o.xr1 = Math.max(o.xr0 + .24, o.bask - .06);         // x-ray pass over the closed box
    o.open = Math.max(o.bask - .02, o.xr1 + .02);                              // lid pops
    o.land = o.open + .04 + .34;                                               // first sneaker lands
    return o;
  }

  // ---------------------------------------------------------------------------- sneakers with material textures
  function upper() { ctx.beginPath(); ctx.moveTo(-185, 42); ctx.lineTo(-180, -40); ctx.quadraticCurveTo(-176, -70, -140, -74); ctx.lineTo(-70, -78); ctx.quadraticCurveTo(-40, -40, 10, -30); ctx.lineTo(110, -8); ctx.quadraticCurveTo(190, 6, 198, 40); ctx.closePath(); }
  function leather() {
    const g = ctx.createLinearGradient(-180, -80, 120, 40); g.addColorStop(0, 'rgba(255,226,190,.26)'); g.addColorStop(.45, 'rgba(255,226,190,0)'); g.addColorStop(1, 'rgba(40,18,6,.22)');
    ctx.fillStyle = g; ctx.fillRect(-200, -90, 410, 140);
    ctx.fillStyle = 'rgba(48,22,8,.38)';
    for (let i = 0; i < 300; i++) { const x = -190 + rnd(i * 3.7 + 1) * 392, y = -82 + rnd(i * 5.3 + 2) * 126, r = .5 + rnd(i * 1.9) * 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.lineWidth = .9;                                                                             // pebble grain cells
    for (let i = 0; i < 420; i++) { const x = -190 + rnd(i * 7.9 + 4) * 392, y = -82 + rnd(i * 2.3 + 9) * 126, r = 2.2 + rnd(i * 4.4) * 2.6;
      ctx.strokeStyle = i % 3 ? 'rgba(48,22,8,.22)' : 'rgba(255,226,190,.20)'; ctx.beginPath(); ctx.arc(x, y, r, .3 + rnd(i) * 3, 2.8 + rnd(i) * 3); ctx.stroke(); }
    ctx.fillStyle = 'rgba(40,18,6,.25)'; ctx.beginPath(); ctx.moveTo(-132, 42); ctx.quadraticCurveTo(-126, -20, -84, -58); ctx.lineTo(-76, -52); ctx.quadraticCurveTo(-116, -16, -120, 42); ctx.closePath(); ctx.fill();   // quarter overlay edge
    ctx.strokeStyle = 'rgba(48,22,8,.28)'; ctx.lineWidth = 1.4;                                   // creases at the flex point
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-6 + i * 15, -30 + i * 4); ctx.quadraticCurveTo(4 + i * 15, -8, -10 + i * 15, 14); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,230,200,.22)'; ctx.lineWidth = 3;                                  // shine streak
    ctx.beginPath(); ctx.moveTo(-160, -50); ctx.quadraticCurveTo(-120, -64, -80, -62); ctx.stroke();
  }
  function stitches() {
    ctx.save(); ctx.strokeStyle = 'rgba(255,238,212,.9)'; ctx.lineWidth = 2.4; ctx.setLineDash([7, 5]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-170, 34); ctx.lineTo(-167, -36); ctx.quadraticCurveTo(-163, -58, -137, -61); ctx.lineTo(-78, -65); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(118, 36); ctx.quadraticCurveTo(124, 4, 162, 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-60, 38); ctx.quadraticCurveTo(-58, 0, -30, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-140, 40); ctx.quadraticCurveTo(-134, -22, -92, -62); ctx.stroke();      // double stitch on the quarter overlay
    ctx.beginPath(); ctx.moveTo(-112, 40); ctx.quadraticCurveTo(-108, -12, -70, -50); ctx.stroke();
    ctx.restore();
  }
  function knit() {
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
    for (let y = -84; y < 46; y += 7) { ctx.beginPath(); for (let x = -194; x < 204; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x + 8, y); } ctx.stroke(); }
    ctx.fillStyle = 'rgba(8,26,64,.16)'; for (let y = -84; y < 46; y += 14) ctx.fillRect(-200, y + 5, 410, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(-200, -84, 410, 22);
  }
  function details(acc) {                               // swoosh, heel tab, laces, collar redrawn above the texture
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.moveTo(-60, 30); ctx.quadraticCurveTo(20, -6, 120, 8); ctx.lineTo(128, 22); ctx.quadraticCurveTo(30, 12, -52, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(-185, 42); ctx.lineTo(-182, -30); ctx.lineTo(-150, -34); ctx.lineTo(-146, 42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 30, -44 + i * 6); ctx.lineTo(-30 + i * 30, -30 + i * 6); ctx.stroke(); }
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(-110, -72, 38, 10, -.05, 0, 7); ctx.fill();
  }
  function shoe(i, lift = 8) {
    const S = SN[i];
    sneaker(SW, { color: S.col, accent: S.acc, lift });
    ctx.save(); ctx.scale(SW / 400, SW / 400);
    ctx.save(); upper(); ctx.clip(); (S.tex === 'leather' ? leather : knit)(); ctx.restore();
    if (S.tex === 'leather') stitches();
    details(S.acc); ctx.restore();
  }
  function xrayShoe(w) {                                // cyan negative of a sneaker (dense = bright)
    ctx.save(); ctx.scale(w / 400, w / 400);
    ctx.save(); ctx.shadowColor = XRAY; ctx.shadowBlur = 22; ctx.fillStyle = 'rgba(127,231,255,.20)'; upper(); ctx.fill(); ctx.restore();
    ctx.strokeStyle = XRAY; ctx.lineWidth = 6; upper(); ctx.stroke();
    ctx.fillStyle = 'rgba(210,250,255,.88)'; rrect(-196, 40, 404, 38, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,90,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-186, 64); ctx.lineTo(198, 64); ctx.stroke();
    ctx.fillStyle = '#E8FDFF'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-40 + i * 30, -37 + i * 6, 6, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(200,248,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, 30); ctx.quadraticCurveTo(20, -6, 120, 8); ctx.stroke();
    ctx.restore();
  }

  // sneaker pose i at time t (null = still in the box)
  function shoePose(i, t, n, ts) {
    const S = SN[i], s0 = T.open + .04 + i * .07, jk = prog(ts, s0, s0 + .34);
    if (jk <= 0) return null;
    const d = drift(t, 50 + i, 4), j = jit(52 + i, n, .7);
    const fx = BOX.x + (i ? 70 : -70), fy = BOX.y - 10;
    let x = lerp(fx, S.x, jk), y = lerp(fy, S.y, jk) - Math.sin(jk * Math.PI) * 240, r = (1 - jk) * (i ? .9 : -.9), s = lerp(.5, 1, jk), sx = s, sy = s;
    if (jk < 1) { sx *= 1 - .08 * Math.sin(jk * Math.PI); sy *= 1 + .12 * Math.sin(jk * Math.PI); }                 // stretch in flight
    else { const L = t - (s0 + .34), sq = Math.exp(-L * 9) * Math.cos(L * 34) * .16; sx = 1 + sq; sy = 1 - sq;       // squash on landing
      const tw = i ? T.tissu : T.cuir, hp = t >= tw ? Math.exp(-(t - tw) * 7) * Math.abs(Math.sin((t - tw) * 13)) * 20 : 0;
      y -= hp; sy *= 1 + .012 * Math.sin(ts * 3 + i * 2); r = Math.sin(t * .9 + i * 2) * .015; }
    return { x: x + d.x + j.x, y: y + d.y + j.y, r: r + j.r, sx, sy };
  }
  function drawShoes(t, n, ts) {
    for (let i = 0; i < 2; i++) { const P = shoePose(i, t, n, ts); if (!P) continue;
      at(P.x, P.y + 60, P.r, P.sx, P.sy, () => { ctx.translate(0, -60); shoe(i); }); }
  }

  // ---------------------------------------------------------------------------- the shoe box (closed, x-rayed, then opened)
  function lidFace(t, n, lift = 8) {
    const { w, h } = BOX;
    shoeBox(w, h, { band: C.orange, fill: '#EDE5D6', lift });
    at(-8, 30, .06 + Math.sin(stepT(n) * 5) * .04, 1, 1, () => handText('?', 0, 40, 170, { color: C.violetD, pen: false }));
    const bp = prog(t, T.xr0, T.xr1), fade = 1 - prog(t, T.open - .06, T.open + .06);
    if (bp > 0 && fade > 0) {                                                   // x-ray: left of the beam = cyan negative
      const bx = -w / 2 + w * bp;
      ctx.save(); ctx.globalAlpha *= fade; ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w * bp, h); ctx.clip();
      ctx.fillStyle = '#0A1A2A'; ctx.fillRect(-w / 2, -h / 2, w, h);
      const g = ctx.createRadialGradient(0, 0, 20, 0, 0, w * .6); g.addColorStop(0, 'rgba(127,231,255,.16)'); g.addColorStop(1, 'rgba(127,231,255,0)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(127,231,255,.45)'; ctx.lineWidth = 4; ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
      at(-96, -18, -.08, 1, 1, () => xrayShoe(190)); at(96, 34, Math.PI + .08, 1, -1, () => xrayShoe(190));
      ctx.fillStyle = 'rgba(127,231,255,.06)'; for (let y = -h / 2 + (n % 2) * 3; y < h / 2; y += 6) ctx.fillRect(-w / 2, y, w, 2);
      ctx.restore();
      if (bp < 1) { ctx.save(); ctx.globalAlpha *= fade; ctx.globalCompositeOperation = 'lighter';
        const bg = ctx.createLinearGradient(bx - 60, 0, bx + 10, 0); bg.addColorStop(0, 'rgba(90,220,255,0)'); bg.addColorStop(1, 'rgba(160,240,255,.9)');
        ctx.fillStyle = bg; ctx.fillRect(bx - 60, -h / 2 - 30, 70, h + 60); ctx.fillStyle = 'rgba(225,252,255,.95)'; ctx.fillRect(bx - 3, -h / 2 - 40, 6, h + 80); ctx.restore(); }
    }
  }
  function drawBox(t, n, ts) {
    const out = eInCubic(prog(ts, T.open + .34, T.open + .64)); if (out >= 1) return;
    const inK = clamp(spring(t - T.c0 + .2, 12, .5), 0, 1.15), rattle = t < T.xr0 ? 1.8 : .6;
    const d = drift(t, 44, 4), j = jit(45, n, rattle), { w, h } = BOX;
    const lk = prog(ts, T.open, T.open + .3);
    // x-ray glow on the table under the box while scanning
    const gl = env(t, T.xr0 - .05, T.open + .05, .1, .12);
    if (gl > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha *= gl * .5;
      const g = ctx.createRadialGradient(BOX.x, BOX.y, 60, BOX.x, BOX.y, 420); g.addColorStop(0, 'rgba(60,150,190,.55)'); g.addColorStop(1, 'rgba(60,150,190,0)'); ctx.fillStyle = g; ctx.fillRect(BOX.x - 420, BOX.y - 420, 840, 840); ctx.restore(); }
    at(BOX.x + d.x + j.x, BOX.y + d.y + j.y + out * 900, -.02 + j.r + out * .2, inK, inK, () => {
      if (lk > 0) {                                                             // open box: inner well + tissue paper
        withShadow(10, () => { ctx.fillStyle = '#E3D9C7'; rrect(-w / 2, -h / 2, w, h, 8); ctx.fill(); });
        ctx.fillStyle = '#B9AB92'; rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 6); ctx.fill();
        ctx.fillStyle = '#F6F1E6'; ctx.beginPath(); const pts = tornLine(-w / 2 + 26, -h / 2 + 40, w / 2 - 26, -h / 2 + 30, 17, 10, 22);
        ctx.moveTo(-w / 2 + 26, h / 2 - 26); for (const p of pts) ctx.lineTo(...p); ctx.lineTo(w / 2 - 26, h / 2 - 26); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,70,.25)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 40 + i * 64, -h / 2 + 50); ctx.lineTo(-w / 2 + 70 + i * 60, h / 2 - 40); ctx.stroke(); }
      }
      if (lk < 1) { const e = eOutCubic(lk);                                   // lid flies off to the top-left, spinning
        at(lerp(0, -520, e), lerp(0, -560, e) - Math.sin(e * Math.PI) * 60, lerp(0, -1.1, e), 1 + .3 * Math.sin(e * Math.PI), 1 + .3 * Math.sin(e * Math.PI), () => lidFace(t, n, 8 + 60 * Math.sin(e * Math.PI)));
      }
    });
  }

  // ---------------------------------------------------------------------------- handwritten material names on paper tabs
  // born under the magnifier, they slide up under their sneaker when the codes arrive
  function labels(t, n) {
    const m = eInOutCubic(prog(stepT(n), T.code - .12, T.code + .14));
    SN.forEach((S, i) => { const tw = i ? T.tissu : T.cuir, k = prog(t, tw + .04, tw + .34); if (k <= 0) return;
      const j = jit(60 + i, n, .6), d = drift(t, 60 + i, 3), wdt = 200, hgt = 86;
      const x = lerp(S.x + 10, S.x, m) + d.x + j.x, y = lerp(LENS.y + LENS.r + 42, 792, m) - Math.sin(m * Math.PI) * 40 + d.y + j.y;
      const sl = slam(t, tw + .04, 1.3);
      at(x, y, (i ? .035 : -.035) + j.r + Math.sin(m * Math.PI) * (i ? .2 : -.2), sl.s, sl.s, () => {
        ctx.globalAlpha *= sl.a;
        const top = tornLine(-wdt / 2, -hgt / 2, wdt / 2, -hgt / 2, 31 + i * 7, 3, 12), bot = tornLine(wdt / 2, hgt / 2, -wdt / 2, hgt / 2, 37 + i * 7, 3, 12);
        withShadow(6 + 20 * Math.sin(m * Math.PI), () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = S.band; ctx.fillRect(-wdt / 2 + 6, hgt / 2 - 12, wdt - 12, 6);
        handText(S.word, 0, 20, 64, { write: k, color: S.ink, pen: false });
      });
    });
  }

  // ---------------------------------------------------------------------------- the magnifier: focus ring on the shoe → cone → big lens below (real zoom)
  function focusPt(i, P) { const s = SW / 400; return [P.x + FOC[i][0] * s * P.sx, P.y + 60 + (FOC[i][1] * s - 60) * P.sy]; }
  function callouts(t, n, ts) {
    for (let i = 0; i < 2; i++) {
      const tw = i ? T.tissu : T.cuir, a = prog(ts, tw - .06, tw + .22), c = prog(ts, T.code - .16, T.code + .02);
      if (a <= 0 || c >= 1) continue;
      const P = shoePose(i, t, n, ts); if (!P) continue;
      const F = focusPt(i, P), d = drift(t, 64 + i, 4), j = jit(66 + i, n, .5);
      const e = clamp(eOutBack(a, 1.5), 0, 1.12) * (1 - eInCubic(c)), ep = clamp(e);
      const cx = lerp(F[0], SN[i].x + 10 + d.x + j.x, ep), cy = lerp(F[1], LENS.y + d.y + j.y, ep), r = Math.max(2, LENS.r * e), rf = LENS.r / LENS.k;
      const ring = clamp(a * 3) * (1 - clamp(c * 2));
      // light cone from the focus ring to the lens
      if (ep > .05) { ctx.save(); ctx.globalAlpha *= .9 * ep;
        ctx.fillStyle = 'rgba(255,253,247,.55)'; ctx.beginPath(); ctx.moveTo(F[0] - rf, F[1]); ctx.lineTo(F[0] + rf, F[1]); ctx.lineTo(cx + r, cy); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(F[0] - rf, F[1]); ctx.lineTo(cx - r, cy); ctx.moveTo(F[0] + rf, F[1]); ctx.lineTo(cx + r, cy); ctx.stroke(); ctx.restore(); }
      if (ring > 0) { ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -stepT(n) * 40;
        ctx.beginPath(); ctx.arc(F[0], F[1], rf * ring, 0, 7); ctx.stroke(); ctx.restore(); }
      withShadow(26, () => { ctx.fillStyle = 'rgba(43,34,48,1)'; ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, 7); ctx.fill(); });
      loupe(cx, cy, r, LENS.k, () => { ctx.fillStyle = C.table; ctx.fillRect(-4000, -4000, 9000, 9000); ctx.translate(cx - F[0], cy - F[1]);
        at(P.x, P.y + 60, P.r, P.sx, P.sy, () => { ctx.translate(0, -60); shoe(i, 2); }); });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(cx - r * .4, cy - r * .45, 4, cx - r * .4, cy - r * .45, r * .95);
      gg.addColorStop(0, 'rgba(255,255,255,.26)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------- code tags with combination-lock digits
  function tagPath(w, h) { ctx.beginPath(); ctx.moveTo(-w / 2 + 42, -h / 2); ctx.lineTo(w / 2 - 10, -h / 2); ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 10); ctx.lineTo(w / 2, h / 2 - 10);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 10, h / 2); ctx.lineTo(-w / 2 + 42, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath(); }
  const tagT0 = i => T.code + .05 + i * .1;
  const lockT = (i, d) => tagT0(i) + .16 + d * .07 + (d === 3 ? .08 : 0);
  function reelV(t, i, d) {
    const tl = lockT(i, d), target = SN[i].code[d];
    if (t < tl) return 10 * (d + 1) + rnd(i * 5 + d) * 10 + Math.max(0, t - tagT0(i)) * 14;
    return target + 10 - (1 - eOutBack(clamp((t - tl) / .2), 2.4));
  }
  let _fs = 0, _cw = 0;
  function tag(i, t) {
    const S = SN[i], { w, h } = TAG;
    withShadow(9, () => { ctx.fillStyle = '#FFFDF7'; tagPath(w, h); ctx.fill(); });
    ctx.save(); tagPath(w, h); ctx.clip(); ctx.fillStyle = S.band; ctx.fillRect(-w / 2, -h / 2, 76, h); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-w / 2, -h / 2, 76, 10); ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.16)'; ctx.lineWidth = 2; tagPath(w, h); ctx.stroke();
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-w / 2 + 38, 0, 16, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(-w / 2 + 38, 0, 7, 0, 7); ctx.fill();
    if (!_fs) { const avail = w - 96 - 20; _fs = 68; let cw = measure('0', font(FF.mono, _fs, 800)) + 8; while (4 * cw + cw * .5 > avail && _fs > 50) { _fs -= 2; cw = measure('0', font(FF.mono, _fs, 800)) + 8; } _cw = cw; }
    const f = font(FF.mono, _fs, 800), cw = _cw, ch = _fs * 1.25, x0 = -w / 2 + 96;
    const cx = d => x0 + cw / 2 + d * cw + (d >= 2 ? cw * .5 : 0);
    for (let d = 0; d < 4; d++) {
      const x = cx(d), v = reelV(t, i, d), b = Math.floor(v), fr = v - b, tl = lockT(i, d);
      ctx.save(); rrect(x - cw / 2 + 2, -ch / 2, cw - 4, ch, 8); ctx.clip();
      const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2); g.addColorStop(0, '#DCCFB6'); g.addColorStop(.25, '#F4ECDC'); g.addColorStop(.75, '#F4ECDC'); g.addColorStop(1, '#DCCFB6');
      ctx.fillStyle = g; ctx.fillRect(x - cw / 2, -ch / 2, cw, ch);
      for (let k = 0; k <= 1; k++) text(String(((b + k) % 10 + 10) % 10), x, (k - fr) * ch + _fs * .36, { font: f, align: 'center', color: C.ink });
      if (t >= tl && t < tl + .18) { ctx.fillStyle = `rgba(243,167,69,${.55 * (1 - (t - tl) / .18)})`; ctx.fillRect(x - cw / 2, -ch / 2, cw, ch); }
      ctx.restore();
    }
    const ck = prog(t, T.chaque + i * .12, T.chaque + i * .12 + .28);           // the differing half circled in orange
    if (ck > 0) at((cx(2) + cx(3)) / 2, 0, (i ? .05 : -.04), 1, 1, () => handCircle(cw * 1.2, ch * .64, ck, C.orange, 7, 5 + i));
  }
  function tags(t, n) {
    for (let i = 0; i < 2; i++) {
      const t0 = tagT0(i); if (t < t0 - .1) continue;
      const S = SN[i], sl = slam(t, t0, 1.25), d = drift(t, 70 + i, 3), j = jit(72 + i, n, .6);
      const hop = t >= T.chaque + i * .12 ? Math.exp(-(t - T.chaque - i * .12) * 8) * Math.abs(Math.sin((t - T.chaque - i * .12) * 14)) * 22 : 0;
      const x = S.x + 14 + d.x + j.x, y = TAG.y + d.y + j.y - hop, r = (i ? .025 : -.03) + j.r;
      // thread from the sneaker's heel loop to the tag grommet
      const P = shoePose(i, t, n, stepT(n)), gx = x - TAG.w / 2 + 38, gy = y;
      if (P) { const hx = P.x - 182 * SW / 400 + 10, hy = P.y - 22, tk = prog(t, t0 + .05, t0 + .28);
        thread(curve([[hx, hy], [hx - 38, hy + 100], [gx - 58, gy - 70], [gx, gy]], 10), tk, n, { w: 5, color: S.band }); }
      at(x, y, r, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; tag(i, t); });
    }
    const nk = prog(t, T.code + .34, T.code + .64);                                 // « code SH » + two little arrows
    if (nk > 0) { const j = jit(75, n, .6);
      at(540 + j.x, 1058 + j.y, -.03, 1, 1, () => { handText('code SH', 0, 0, 54, { write: nk, color: C.violetD, pen: false });
        const ak = clamp(nk * 1.5 - .5); handArrow([[-92, -46], [-104, -70], [-118, -92]], ak, C.violetD, 5); handArrow([[92, -46], [104, -70], [118, -92]], ak, C.violetD, 5); }); }
  }

  // ---------------------------------------------------------------------------- « % » gauges (different heights, no numbers)
  function gauge(i, k, t, n) {
    const S = SN[i], tw = 74, top = -168, bot = -40, br = 54;
    withShadow(8, () => { ctx.fillStyle = '#FFFDF7'; rrect(-tw / 2 - 10, top - 10, tw + 20, -top + 20, 30); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, br + 10, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#EDE3CF'; rrect(-tw / 2, top, tw, bot - top + 10, 26); ctx.fill();
    const lvl = lerp(bot, top + 12, S.lvl * k), wob = Math.sin(stepT(n) * 9 + i) * 3 * clamp(1 - (t - T.taux - .5));
    ctx.save(); rrect(-tw / 2, top, tw, bot - top + 40, 26); ctx.clip(); ctx.fillStyle = C.violetD;
    ctx.beginPath(); ctx.moveTo(-tw / 2, bot + 40); ctx.lineTo(-tw / 2, lvl + wob); ctx.quadraticCurveTo(0, lvl - wob * 2, tw / 2, lvl - wob); ctx.lineTo(tw / 2, bot + 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-tw / 2 + 10, lvl + 6, 10, bot + 40 - lvl); ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 3; for (let q = 1; q < 5; q++) { const y = lerp(bot, top, q / 5); ctx.beginPath(); ctx.moveTo(tw / 2 - 18, y); ctx.lineTo(tw / 2 - 4, y); ctx.stroke(); }
    ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(0, 0, br, 0, 7); ctx.fill();
    ctx.strokeStyle = S.band; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, br + 4, 0, 7); ctx.stroke();
    text('%', 0, 22, { font: font(FF.stencil, 64, 900), align: 'center', color: '#fff' });
  }
  function gauges(t, n) {
    for (let i = 0; i < 2; i++) {
      const t0 = T.gauge + i * .08; if (t < t0) continue;
      const p = pop(t, t0, 16, .5), k = clamp(eOutBack(prog(t, t0 + .05, t0 + .38), 1.6), 0, 1.08), d = drift(t, 80 + i, 3), j = jit(82 + i, n, .5);
      at(SN[i].x + 14 + d.x + j.x, GY + d.y + j.y, j.r, p, p, () => gauge(i, k, t, n));
    }
    const nk = prog(t, T.taux + .02, T.taux + .22);
    if (nk > 0) { const j = jit(85, n, .8); at(540 + j.x, 1178 + j.y, -.05, 1, 1, () => handText('≠', 0, 0, 120, { write: nk, color: C.orange, pen: false })); }
  }

  // ---------------------------------------------------------------------------- headline strips
  function strips(t, n) {
    const d = drift(t, 91, 3), sw = eInCubic(prog(t, T.strip2 - .1, T.strip2));
    if (t >= T.bask + .02 && sw < 1) { const sl = slam(t, T.bask + .12, 1.6);
      at(540 + d.x, 470 + d.y - sw * 40, -.02, sl.s, sl.s * (1 - sw), () => { ctx.globalAlpha *= sl.a; strip('CUIR OU TISSU ?', { size: 66, fill: '#FFFDF7', color: C.ink, seed: 4 }); }); }
    if (t >= T.strip2 - .1) { const sl = slam(t, T.strip2, 1.8);
      at(540 + d.x, 470 + d.y, .02, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('1 CODE = 1 TAUX', { size: 72, fill: C.violetD, color: '#FFFFFF', seed: 7 }); }); }
  }

  // ---------------------------------------------------------------------------- big question card → flips into the header
  let _qs = 0;
  function introHeader(t, n) {
    const tw = T.quoi, fl = prog(t, tw + .04, tw + .34), e = eInOutCubic(fl), d = drift(t, 40 + QI, 4);
    if (fl < 1) {
      if (!_qs) _qs = Math.min(120, 120 * 380 / measure(QWORD[QI], font(FF.stencil, 120, 900), 3));
      const inK = clamp(spring(t - T.c0 + .18, 13, .5), 0, 1.15), dt = t - tw;
      const punch = dt >= 0 ? Math.exp(-dt * 12) * Math.sin(dt * 34) * .07 : 0;
      const s = lerp(1.3, .62, e) * inK * (1 + punch), flip = fl > .55 ? Math.cos((fl - .55) / .45 * Math.PI / 2) : 1, j = jit(90 + QI, n, .8);
      at(540 + d.x + j.x, lerp(640, 330, e) + d.y + j.y, lerp(-.035, 0, e) + j.r + Math.sin(stepT(n) * 3) * .006, Math.max(.001, s * flip), s,
        () => qCard(QI + 1, QWORD[QI], 'le produit', { band: QCOL[QI], w: 440, h: 300, size: _qs }));
    } else {
      const hk = prog(t, tw + .34, tw + .5), sx = hk < 1 ? eOutBack(hk, 2) : 1;
      at(540 + d.x * .5, 330 + d.y * .5, Math.sin(t * .8 + QI) * .006, Math.max(.001, sx), 1, () => qHeader(QI, 1));
    }
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;
    if (!reg) { reg = true; addShake(T.quoi + .36, 5); addShake(T.land, 7); addShake(T.land + .07, 5); addShake(tagT0(0) + .02, 4); addShake(tagT0(1) + .02, 4); addShake(T.strip2, 10); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n);
    drawBox(t, n, ts);
    drawShoes(t, n, ts);
    callouts(t, n, ts);
    tags(t, n);
    labels(t, n);
    gauges(t, n);
    strips(t, n);
    introHeader(t, n);
  }

  registerScene({ id: 'quoi', z: 40, when: t => TL.in(t, CH, .4, .4), draw });
})();

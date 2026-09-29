'use strict';
// ============================================================================================
// recap « EN RÉSUMÉ » — title slam, then a 6-step vertical timeline whose tiles light up on each
// spoken word (V10), a filling progress line, "6 ÉTAPES" at « Six » and a shield badge
// « EN TOUTE SÉCURITÉ ». Content in y 320–1110. All times from TL.
// ============================================================================================
(() => {
  const STEPS = [
    { n: '01', label: 'Achat', w: 'lachat', icon: 'bag' },
    { n: '02', label: 'Groupage', w: 'groupage', icon: 'parcels' },
    { n: '03', label: 'Transport', w: 'transport', icon: 'ship' },
    { n: '04', label: 'Arrivée', w: 'larrivee', icon: 'pin' },
    { n: '05', label: 'Déchargement', w: 'dechargement', icon: 'unload' },
    { n: '06', label: 'Retrait', w: 'retrait', icon: 'retrait' },
  ];
  // phase-1 geometry (full list)
  const TILE = 100, PITCH = 118, LAB_W = 440, BLOCK_W = TILE + 116 + LAB_W;
  const LX = Math.round((W - BLOCK_W) / 2), TOP = 418, NUM_X = LX + TILE + 28, LAB_X = LX + TILE + 116;
  const LIST_H = PITCH * 5 + TILE;
  // phase-2 geometry (compressed list at the left, header "6 ÉTAPES", badge column)
  const SC2 = .74, LX2 = 60, TOP2 = 1100 - LIST_H * SC2;
  const HEAD_Y = 362;
  const BADGE = { x: 784, y: 752, s: 112 };

  function times() {
    const ch = TL.ch('recap'), sg = TL.seg('V10'); const w = (s, d) => TL.wt('V10', s, sg.start + d);
    const T = { ch0: ch.start, ch1: ch.end, v0: sg.start, v1: sg.end, slam: ch.start + .15,
      resume: w('resume', .3), six: w('six', 5.4), colis: w('colis', 6.6), arrivent: w('arrivent', 6.9), toute: w('toute', 7.5), securite: w('securite', 7.7) };
    T.steps = STEPS.map((s, i) => w(s.w, 1.1 + i * .7));
    T.fly0 = Math.max(T.slam + 1.05, T.resume - .05); T.fly1 = T.fly0 + .55;   // title -> header
    T.build = T.fly0 + .15;                                                     // rows build in
    T.cmp0 = Math.max(T.steps[5] + .2, T.six - .45); T.cmp1 = T.cmp0 + .6;                                 // compress list
    T.s6a = Math.max(T.six + .04, T.cmp1 - .12); T.s6b = Math.max(T.six + .42, T.cmp1 + .26);              // "6 ÉTAPES" in
    T.bad0 = T.arrivent - .12; T.bad1 = T.bad0 + .45;                           // badge in
    return T;
  }

  // ---------------- icons (centre x,y; box size s) ----------------
  function iconBag(x, y, s) {
    ctx.save(); ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * .32, y - s * .16); ctx.lineTo(x + s * .32, y - s * .16); ctx.lineTo(x + s * .38, y + s * .4); ctx.lineTo(x - s * .38, y + s * .4); ctx.closePath();
    const g = ctx.createLinearGradient(0, y - s * .2, 0, y + s * .4); g.addColorStop(0, '#9A66F2'); g.addColorStop(1, '#5B2FB8');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = ICE; ctx.lineWidth = s * .055; ctx.stroke();
    ctx.strokeStyle = AMBER; ctx.lineWidth = s * .075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - s * .16, s * .17, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(x, y + s * .12, s * .075, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function box2d(x, y, w, h, s) {   // front-view cardboard box, top-left corner
    ctx.fillStyle = '#C98A45'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#E2A962'; ctx.fillRect(x, y, w, h * .22);
    ctx.fillStyle = 'rgba(255,240,210,.85)'; ctx.fillRect(x + w * .42, y, w * .16, h * .55);
    ctx.strokeStyle = '#3A2208'; ctx.lineWidth = Math.max(1.5, s * .03); ctx.strokeRect(x, y, w, h);
  }
  function iconParcels(x, y, s) {
    ctx.save(); const b = s * .38;
    box2d(x - b - s * .02, y + s * .42 - b, b, b, s); box2d(x + s * .02, y + s * .42 - b, b, b, s);
    box2d(x - b / 2, y + s * .42 - 2 * b - s * .03, b, b, s);
    ctx.restore();
  }
  function iconShip(x, y, s) {
    if (window.BZICON) window.BZICON.drawShip(x, y + s * .16, s * 1.02, { face: 1 });
    ctx.save(); ctx.strokeStyle = 'rgba(92,240,255,.75)'; ctx.lineWidth = s * .045; ctx.lineCap = 'round'; ctx.beginPath();
    for (let k = 0; k < 3; k++) { const xx = x - s * .36 + k * s * .3; ctx.moveTo(xx, y + s * .38); ctx.quadraticCurveTo(xx + s * .07, y + s * .32, xx + s * .14, y + s * .38); }
    ctx.stroke(); ctx.restore();
  }
  function iconPin(x, y, s) {
    ctx.save(); ctx.strokeStyle = 'rgba(254,86,13,.7)'; ctx.lineWidth = s * .05;
    ctx.beginPath(); ctx.ellipse(x, y + s * .36, s * .3, s * .09, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    pin(x, y - s * .06, s * .62, ORANGE);
  }
  function iconUnload(x, y, s) {
    ctx.save(); const b = s * .36;
    box2d(x - b - s * .03, y + s * .42 - b, b, b, s); box2d(x + s * .03, y + s * .42 - b, b, b, s);
    ctx.strokeStyle = AMBER; ctx.fillStyle = AMBER; ctx.lineWidth = s * .08; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - s * .44); ctx.lineTo(x, y - s * .08); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * .15, y - s * .16); ctx.lineTo(x, y - s * .01); ctx.lineTo(x + s * .15, y - s * .16); ctx.stroke();
    ctx.restore();
  }
  function iconRetrait(x, y, s) {
    ctx.save(); const b = s * .56;
    box2d(x - b / 2 - s * .08, y + s * .4 - b, b, b, s);
    const cx = x + s * .26, cy = y - s * .2, r = s * .2;
    ctx.fillStyle = '#1A0F38'; ctx.strokeStyle = AMBER; ctx.lineWidth = s * .06; ctx.shadowColor = AMBER; ctx.shadowBlur = s * .15;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    checkMark(cx, cy + r * .05, r * 1.15, 1, AMBER, s * .06);
  }
  const ICONS = { bag: iconBag, parcels: iconParcels, ship: iconShip, pin: iconPin, unload: iconUnload, retrait: iconRetrait };

  // ---------------- pieces ----------------
  function tile(x, y, s, lit, appear, flash, icon) {
    if (appear <= 0) return;
    const k = eOutBack(appear), pop = 1 + .09 * Math.sin(Math.PI * clamp(lit * 1.4)) + .08 * flash;
    ctx.save(); ctx.globalAlpha *= clamp(appear * 1.6);
    ctx.translate(x + s / 2, y + s / 2); ctx.scale(k * pop, k * pop); ctx.translate(-s / 2, -s / 2);
    // base
    rrect(0, 0, s, s, s * .26);
    const g = ctx.createLinearGradient(0, 0, s, s); g.addColorStop(0, lit > .01 ? `rgba(58,32,128,${.6 + .4 * lit})` : 'rgba(30,18,64,.9)'); g.addColorStop(1, 'rgba(14,8,34,.96)');
    ctx.fillStyle = g; ctx.shadowColor = lit > .01 ? `rgba(243,167,69,${.75 * lit})` : 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10 + 26 * lit; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = lit > .01 ? `rgba(243,167,69,${.35 + .65 * lit})` : 'rgba(169,71,254,.45)'; ctx.lineWidth = 3 + lit; ctx.stroke();
    // icon
    ctx.save(); ctx.globalAlpha *= .38 + .62 * lit; ctx.filter = lit < .99 ? `saturate(${(.25 + .75 * lit).toFixed(2)})` : 'none';
    ICONS[icon](s / 2, s / 2, s * .7); ctx.restore();
    if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; rrect(0, 0, s, s, s * .26); ctx.fillStyle = `rgba(255,236,200,${.35 * flash})`; ctx.fill(); }
    ctx.restore();
  }

  function drawList(t, T, cmp) {
    const tops = STEPS.map((_, i) => TOP + i * PITCH), cxL = LX + TILE / 2;
    const lit = STEPS.map((_, i) => eOutCubic(prog(t, T.steps[i] - .14, T.steps[i] + .3)));
    const ap = STEPS.map((_, i) => prog(t, T.build + i * .075, T.build + i * .075 + .5));
    const flash = STEPS.map((_, i) => { const p = prog(t, T.six + i * .06, T.six + i * .06 + .35); return p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0; });
    // progress line track + fill
    const y0 = tops[0] + TILE / 2, y1 = tops[5] + TILE / 2;
    const trackA = ap[5];
    if (trackA > 0) {
      ctx.save(); ctx.globalAlpha *= trackA; ctx.strokeStyle = 'rgba(169,71,254,.35)'; ctx.lineWidth = 6; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cxL, y0); ctx.lineTo(cxL, y0 + (y1 - y0) * eOutCubic(trackA)); ctx.stroke(); ctx.restore();
    }
    // fill: reaches node i at its word
    let fy = y0;
    for (let i = 1; i < 6; i++) { const p = eInOutCubic(prog(t, T.steps[i] - .42, T.steps[i] - .02)); if (p > 0) fy = tops[i - 1] + TILE / 2 + p * PITCH; }
    if (lit[0] > 0 && fy > y0) {
      ctx.save(); const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, AMBER); g.addColorStop(1, ORANGE);
      ctx.strokeStyle = g; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.shadowColor = ORANGE; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(cxL, y0); ctx.lineTo(cxL, fy); ctx.stroke(); ctx.restore();
      const moving = STEPS.some((_, i) => i > 0 && t > T.steps[i] - .42 && t < T.steps[i] + .05);
      if (moving) { ctx.save(); const rg = ctx.createRadialGradient(cxL, fy, 0, cxL, fy, 26); rg.addColorStop(0, 'rgba(255,245,225,.95)'); rg.addColorStop(1, 'rgba(254,86,13,0)');
        ctx.fillStyle = rg; ctx.globalCompositeOperation = 'lighter'; ctx.fillRect(cxL - 26, fy - 26, 52, 52); ctx.restore(); }
    }
    // active-row cursor (phase 1 only)
    let act = -1; for (let i = 0; i < 6; i++) if (t >= T.steps[i] - .14) act = i;
    const curA = act >= 0 ? (1 - cmp) * eOutCubic(prog(t, T.steps[0] - .14, T.steps[0] + .2)) : 0;
    if (curA > 0) {
      let cy = tops[0];
      for (let i = 1; i < 6; i++) cy = lerp(cy, tops[i], eInOutCubic(prog(t, T.steps[i] - .2, T.steps[i] + .12)));
      ctx.save(); ctx.globalAlpha *= curA;
      rrect(LX - 22, cy - 11, BLOCK_W + 64, TILE + 22, 32);
      const g = ctx.createLinearGradient(LX, 0, LX + BLOCK_W + 40, 0); g.addColorStop(0, 'rgba(169,71,254,.30)'); g.addColorStop(1, 'rgba(169,71,254,.04)');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(169,71,254,.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    // rows
    for (let i = 0; i < 6; i++) {
      if (ap[i] <= 0) continue;
      const y = tops[i], s = STEPS[i], L = lit[i], ae = eOutCubic(ap[i]);
      tile(LX, y, TILE, L, ap[i], flash[i], s.icon);
      ctx.save(); ctx.globalAlpha *= ae; const dx = (1 - ae) * 36;
      txt(s.n, NUM_X + dx, y + TILE / 2 + 16, { size: 44, weight: 900, fam: FONT.display, color: L > .5 ? AMBER : 'rgba(234,246,255,.42)', glow: L > .5 ? 'rgba(243,167,69,.55)' : null, glowBlur: 14 * L });
      const lc = `rgba(${Math.round(lerp(190, 255, L))},${Math.round(lerp(196, 255, L))},${Math.round(lerp(220, 255, L))},${(.5 + .5 * L).toFixed(3)})`;
      txt(s.label, LAB_X + dx + (1 - L) * 0, y + TILE / 2 + 21, { size: 60, weight: 800, fam: FONT.body, color: lc });
      ctx.restore();
    }
  }

  function drawHeader(t, T) {
    // big title slam -> flies to header
    const inK = prog(t, T.slam - .05, T.slam + .45), fly = eInOutCubic(prog(t, T.fly0, T.fly1));
    const out = eInOutCubic(prog(t, T.s6a - .22, T.s6a + .06));
    if (inK > 0 && out < 1) {
      const s0 = 1.28 - .28 * eOutExpo(inK), s = lerp(s0, .56, fly), y = lerp(760, HEAD_Y, fly) - out * 40;
      ctx.save(); ctx.globalAlpha *= clamp(inK * 2) * (1 - out);
      ctx.translate(540, y); ctx.scale(s, s);
      txt('EN RÉSUMÉ', 0, 0, { size: 104, weight: 900, fam: FONT.display, align: 'center', base: 'middle', color: '#FFFFFF', ls: 4, glow: 'rgba(169,71,254,.9)', glowBlur: 30 });
      const dl = eOutCubic(prog(t, T.slam + .1, T.slam + .6));
      ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 14; rrect(-150 * dl, 78, 300 * dl, 8, 4); ctx.fill();
      ctx.restore();
      // shock rings on the slam
      const sr = prog(t, T.slam, T.slam + .75);
      if (sr > 0 && sr < 1) { ring(540, 760, 120 + 520 * eOutExpo(sr), VIOLET, 7 * (1 - sr) + 1, .85 * (1 - sr)); ring(540, 760, 90 + 360 * eOutExpo(prog(t, T.slam + .06, T.slam + .8)), AMBER, 4 * (1 - sr) + 1, .75 * (1 - sr)); }
    }
    // "6 ÉTAPES"
    const k6 = prog(t, T.s6a, T.s6b);
    if (k6 > 0) {
      const count = Math.min(6, 1 + Math.floor(prog(t, T.s6a, T.s6a + .3) * 6));
      const f6 = `900 220px ${FONT.display}`, fE = `900 98px ${FONT.display}`;
      const w6 = measure('6', f6), wE = measure('ÉTAPES', fE, 2), gap = 34, x0 = 540 - (w6 + gap + wE) / 2, base = 548;
      ctx.save(); const e = eOutBack(k6); ctx.globalAlpha *= clamp(k6 * 2.5);
      ctx.translate(x0 + w6 / 2, base - 70); ctx.scale(lerp(1.3, 1, e), lerp(1.3, 1, e)); ctx.translate(-(x0 + w6 / 2), -(base - 70));
      txt(String(count), x0 + w6 / 2, base, { font: f6, align: 'center', color: AMBER, glow: 'rgba(243,167,69,.8)', glowBlur: 34, glowTwice: true });
      ctx.restore();
      wipeText('ÉTAPES', x0 + w6 + gap, base, prog(t, T.six + .12, T.six + .5), { font: fE, size: 98, color: '#FFFFFF', ls: 2 });
      const sr = prog(t, T.six, T.six + .7);
      if (sr > 0 && sr < 1) ring(x0 + w6 / 2, base - 78, 70 + 300 * eOutExpo(sr), AMBER, 5 * (1 - sr) + 1, .8 * (1 - sr));
    }
  }

  function drawBadge(t, T) {
    const k = prog(t, T.bad0, T.bad1);
    if (k <= 0) return;
    const { x, y, s } = BADGE, e = eOutBack(k);
    // card
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.8);
    const cw = 330, ch = 452, cx0 = x - cw / 2, cy0 = y - s - 44;
    ctx.translate(x, y); ctx.scale(.9 + .1 * e, .9 + .1 * e); ctx.translate(-x, -y);
    plate(cx0, cy0, cw, ch, { r: 30, fill: 'rgba(12,7,28,.88)', border: 'rgba(243,167,69,.75)', lw: 3 });
    // halo + rotating ticks
    const st = prog(t, T.securite - .05, T.securite + .45), glow = .45 + .55 * st;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, s * 1.35); rg.addColorStop(0, `rgba(243,167,69,${.28 * glow})`); rg.addColorStop(1, 'rgba(243,167,69,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - s * 1.4, y - s * 1.4, s * 2.8, s * 2.8);
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * .35); ctx.strokeStyle = `rgba(243,167,69,${.35 * glow})`; ctx.lineWidth = 3; ctx.setLineDash([6, 12]);
    ctx.beginPath(); ctx.arc(0, 0, s * 1.08, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    // shield (outline draws in), check on « sécurité »
    const sp = eOutCubic(prog(t, T.bad0 + .05, T.bad1 + .15));
    shieldPath(x, y, s * .92 * sp + s * .08);
    ctx.fillStyle = 'rgba(38,20,80,.95)'; ctx.fill();
    ctx.strokeStyle = AMBER; ctx.lineWidth = 7; ctx.shadowColor = AMBER; ctx.shadowBlur = 18 + 14 * st; ctx.stroke(); ctx.shadowBlur = 0;
    checkMark(x, y + s * .02, s * .82, eOutCubic(prog(t, T.securite - .1, T.securite + .28)), AMBER, 13);
    if (st > 0 && st < 1) { ctx.save(); rrect(cx0 + 3, cy0 + 3, cw - 6, s * 2.25, 28); ctx.clip(); ring(x, y, s * (1 + st * .45), AMBER, 5 * (1 - st) + 1, (1 - st) * .9); ctx.restore(); }
    // text
    const tk = prog(t, T.bad0 + .12, T.bad1 + .1);
    wipeText('EN TOUTE', x, y + s + 78, tk, { size: 50, weight: 800, fam: FONT.body, align: 'center', color: '#FFFFFF' });
    wipeText('SÉCURITÉ', x, y + s + 138, prog(t, T.bad0 + .2, T.bad1 + .18), { size: 54, weight: 800, fam: FONT.body, align: 'center', color: AMBER, ls: 1 });
    ctx.restore();
  }
  function shieldPath(x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * .8, y - s * .65); ctx.lineTo(x + s * .72, y + s * .15);
    ctx.quadraticCurveTo(x + s * .5, y + s * .75, x, y + s); ctx.quadraticCurveTo(x - s * .5, y + s * .75, x - s * .72, y + s * .15);
    ctx.lineTo(x - s * .8, y - s * .65); ctx.closePath();
  }

  registerScene({
    id: 'recap', z: 10,
    when: t => { const c = TL.ch('recap'); return t >= c.start && t < c.end; },
    draw(t) {
      const T = times(), A = env(t, T.ch0, T.ch1, .35, .35);
      mgBackground(t, .88 * A, { cy: 715 });
      ctx.save(); ctx.globalAlpha *= A;
      drawHeader(t, T);
      // list, compressed on « Six »
      const cmp = eInOutCubic(prog(t, T.cmp0, T.cmp1));
      if (t >= T.build) {
        const s = lerp(1, SC2, cmp), ty = lerp(TOP, TOP2, cmp), tx = lerp(LX, LX2, cmp);
        ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); ctx.translate(-LX, -TOP);
        drawList(t, T, cmp); ctx.restore();
      }
      drawBadge(t, T);
      ctx.restore();
    },
  });
})();

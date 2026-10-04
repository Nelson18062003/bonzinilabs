'use strict';
// =============================================================================================
// M1 « carton & air » · 36_measure.js — the silent measure, AVANT / APRÈS, the bubble-wrapped glass.
//
//   CA_measure(tp, fm, t, L)  tp = SCORE.tape(t) {edges[3]: {name, p0, p1, k, mark, on, t0}, cur, head}, fm = SCORE.formula(t)
//     A steel tape measure (charcoal case, yellow concave blade with ticks and NO figure, a riveted end hook) shoots along
//     LONGUEUR, LARGEUR, HAUTEUR; on each clack (edge.t0) the hook bites (overshoot + impact strokes) and the word flies
//     from the hook up to its line of the formula, where it lands like a stamp. The formula (takes over 'formula' and
//     'formulaSub'): « LONGUEUR / × LARGEUR / × HAUTEUR » in Stencil 900 (orange, starved ink; the × in ink) at y 300–524,
//     boxed by a stamp at A.formula, then « le carton entier » written by a marker (y ≈ 646), underlined in orange.
//   CA_split(sp, t, L)        a torn paper strip down x 540; the labels AVANT / APRÈS (takes over 'avantApres') on torn
//     strips; two horizontal m³ gauges with no figure: the same merchandise segment, then the void hatched like the
//     carton's (long under AVANT, short under APRÈS), an « m³ » cap only.
//   CA_glass(gl, t, L)        a cut-paper stemmed glass (the fragile pictogram) that bubble wrap wraps from the foot up
//     (gl.wrap), a few bubbles popping (gl.pop), a strip of kraft tape closes it.
// Deterministic, no ctx.filter. Cost ≈ 1–2 ms each.
// =============================================================================================
const CA_MS = (function () {
  const H = CA_, S = H.S, A = H.A, G = H.G, T = H.T, { cl, kk, mix, sst, eo, R, tq, litA, measureW } = H;
  const INK = '#231629', CREAM = '#FFF6E8', PAPER = '#FBF6EC', ORANGE = '#FE560D', SEA = '#0B5FA5';
  const FORM = { x: 540, y0: 300, lh: 112, size: 104, box: [210, 228, 660, 362], subY: 648 };

  // ---------- the tape measure ----------
  function blade(len, k, wob) {
    const Lb = Math.max(0, len * k + wob); if (Lb < 2) return;
    ctx.save();
    ctx.fillStyle = 'rgba(60,32,12,.22)'; ctx.fillRect(4, -10, Lb, 30);                                // shadow
    const gr = ctx.createLinearGradient(0, -15, 0, 15); gr.addColorStop(0, '#C9A51E'); gr.addColorStop(.3, '#F6DA55'); gr.addColorStop(.55, '#FFF0A0'); gr.addColorStop(.8, '#EFCB3C'); gr.addColorStop(1, '#B8921A');
    ctx.fillStyle = gr; ctx.fillRect(0, -15, Lb, 30);
    ctx.strokeStyle = 'rgba(35,22,41,.85)'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = 8; x < Lb - 4; x += 10) { const lg = (x - 8) % 50 === 0 ? 14 : (x - 8) % 25 === 0 ? 10 : 6; ctx.moveTo(x, -15); ctx.lineTo(x, -15 + lg); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,40,30,.75)'; for (let x = 58; x < Lb - 4; x += 100) ctx.fillRect(x - 1.5, 4, 3, 9);             // no figure: just marks
    // the end hook (riveted brass-steel tab)
    ctx.translate(Lb, 0);
    ctx.fillStyle = '#8D939C'; ctx.fillRect(-14, -16, 16, 32); ctx.fillStyle = '#B9BEC6'; ctx.fillRect(0, -21, 7, 42); ctx.fillStyle = '#6F757E'; ctx.fillRect(5, -21, 2, 42);
    ctx.fillStyle = '#E3E6EA'; ctx.beginPath(); ctx.arc(-7, -8, 2.4, 0, 7); ctx.arc(-7, 8, 2.4, 0, 7); ctx.fill();
    ctx.restore();
  }
  function caseBody(L, x, y) {
    ctx.save();
    ctx.fillStyle = 'rgba(52,28,8,.3)'; rrect(-92 + 8, -48 + 12, 96, 96, 26); ctx.fill();
    ctx.fillStyle = '#2C2A31'; rrect(-92, -48, 96, 96, 26); ctx.fill();
    ctx.fillStyle = '#45434C'; rrect(-86, -42, 84, 84, 22); ctx.fill();
    ctx.fillStyle = '#34323A'; ctx.beginPath(); ctx.arc(-44, 0, 26, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-44, 0, 26, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    ctx.fillStyle = '#9A9EA6'; rrect(-40, -54, 26, 12, 5); ctx.fill();                                   // lock button
    ctx.fillStyle = '#1A1820'; ctx.fillRect(-4, -17, 8, 34);                                            // the mouth
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-84, -36); ctx.quadraticCurveTo(-86, -46, -70, -46); ctx.stroke();
    ctx.restore();
  }
  function caseState(tp, t) {
    // the case sits at the start of the edge being measured; it pops in before the first clack and away after the last
    const E = tp.edges; let i = 0; for (let k = 0; k < 3; k++) if (t >= E[k].t0 - .2) i = k;
    const pop = sst(kk(t, E[0].t0 - .32, E[0].t0 - .2)) * (1 - sst(kk(t, E[2].t0 + .32, E[2].t0 + .5)));
    return { i, pop };
  }
  function measure(tp, fm, t, L) {
    if (!tp) return;
    const cs = caseState(tp, t);
    for (let i = 0; i < 3; i++) {
      const e = tp.edges[i], dx = e.p1[0] - e.p0[0], dy = e.p1[1] - e.p0[1], len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const showCase = i === cs.i && cs.pop > .01;
      if (e.k <= 0 && !showCase) continue;
      const dt = t - e.t0, wob = dt > 0 && dt < .2 ? Math.sin(dt * 60) * Math.exp(-dt * 18) * 9 : 0;
      ctx.save(); ctx.translate(e.p0[0], e.p0[1]); ctx.rotate(a);
      if (e.k > 0) blade(len, e.k, e.k > .98 ? wob : 0);
      if (showCase) { const pk = cs.pop, rec = dt > .18 && dt < .34 ? Math.sin((dt - .18) / .16 * Math.PI) * 10 : 0; ctx.translate(-rec, 0); ctx.scale(pk, pk); caseBody(L); }
      ctx.restore();
      // the clack: impact strokes at the hook
      if (dt >= 0 && dt < .22) {
        const k = dt / .22, ux = dx / len, uy = dy / len;
        ctx.save(); ctx.globalAlpha *= 1 - k; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let j = -1; j <= 1; j++) { const aa = Math.atan2(uy, ux) + j * .7, r0 = 34 + 26 * k, r1 = r0 + 26; ctx.beginPath(); ctx.moveTo(e.p1[0] + Math.cos(aa) * r0, e.p1[1] + Math.sin(aa) * r0); ctx.lineTo(e.p1[0] + Math.cos(aa) * r1, e.p1[1] + Math.sin(aa) * r1); ctx.stroke(); }
        ctx.restore();
      }
    }
    if (fm) formula(tp, fm, t, L);
  }

  // ---------- the formula ----------
  const WORDS = ['LONGUEUR', 'LARGEUR', 'HAUTEUR'];
  let WSPR = null, BOX = null;
  function wordSprite(i) {
    if (!WSPR) WSPR = [];
    if (WSPR[i]) return WSPR[i];
    const SS = 1.5, f = `900 ${FORM.size}px Stencil`, w = measureW(WORDS[i], f) + 6 * (WORDS[i].length - 1) + 40, h = FORM.size * 1.25;
    const c = makeCanvas(Math.ceil(w * SS), Math.ceil(h * SS)), g = c.getContext('2d'); g.scale(SS, SS);
    g.font = f; g.letterSpacing = '6px'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = ORANGE; g.fillText(WORDS[i], w / 2, h / 2 + FORM.size * .05);
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 900; k++) { g.globalAlpha = .2 + R(k, 30 + i) * .55; g.beginPath(); g.arc(R(k, 31 + i) * w, R(k, 32 + i) * h, .4 + R(k, 33 + i) * 1.7, 0, 7); g.fill(); }
    return (WSPR[i] = { c, w, h, SS });
  }
  function boxSprite() {
    if (BOX) return BOX;
    const SS = 1.5, [x0, y0, bw, bh] = FORM.box, c = makeCanvas(Math.ceil((bw + 40) * SS), Math.ceil((bh + 40) * SS)), g = c.getContext('2d'); g.scale(SS, SS); g.translate(20, 20);
    g.strokeStyle = ORANGE; g.lineWidth = 10; rrectOn(g, 0, 0, bw, bh, 18); g.stroke();
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 700; k++) { g.globalAlpha = .25 + R(k, 51) * .6; g.beginPath(); g.arc(R(k, 52) * bw, R(k, 53) * bh, .5 + R(k, 54) * 2.2, 0, 7); g.fill(); }
    g.globalAlpha = .6; for (let k = 0; k < 6; k++) { g.lineWidth = 2 + R(k, 55) * 4; g.beginPath(); const yy = R(k, 56) * bh; g.moveTo(-10, yy); g.lineTo(bw + 10, yy + (R(k, 57) - .5) * 30); g.stroke(); }
    return (BOX = { c, bw, bh, SS });
  }
  function formula(tp, fm, t, L) {
    const al = fm.a; if (al <= .01) return;
    ctx.save(); ctx.globalAlpha *= al;
    // the box (stamp) at A.formula
    if (fm.box > 0) {
      const B = boxSprite(), k = fm.box, sc = k < 1 ? 1.25 - .25 * eo(k) : 1 + .02 * Math.exp(-(t - A.formula) * 10) * Math.cos((t - A.formula) * 40);
      ctx.save(); ctx.translate(FORM.box[0] + B.bw / 2, FORM.box[1] + B.bh / 2); ctx.rotate(-.025); ctx.scale(sc, sc); ctx.globalAlpha *= Math.min(1, k * 2); ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(B.c, -B.bw / 2 - 20, -B.bh / 2 - 20, B.c.width / B.SS, B.c.height / B.SS); ctx.restore();
    }
    for (let i = 0; i < 3; i++) {
      const e = tp.edges[i], dt = t - e.t0; if (dt < 0) continue;
      const Wd = wordSprite(i), xw = measureW('× ', `900 ${FORM.size}px Stencil`), off = i ? xw / 2 : 0, ty = FORM.y0 + i * FORM.lh, tx = FORM.x + off;
      const fly = sst(kk(dt, 0, .26)), land = dt - .26;
      const sx0 = Math.min(e.p1[0], 860), x = mix(sx0, tx, fly), y = mix(e.p1[1], ty, fly) - Math.sin(Math.PI * fly) * 120, sc0 = mix(.42, 1, fly) * (land > 0 ? 1 + .1 * Math.exp(-land * 14) * Math.cos(land * 44) : 1);
      const rot = mix(-.4 + .3 * i, -.012 * (i - 1), fly);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc0, sc0);
      if (land < 0) { ctx.globalAlpha *= .9; ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.fillRect(-Wd.w / 2 + 10, -FORM.size * .32 + 14, Wd.w - 20, FORM.size * .7); }
      ctx.globalCompositeOperation = land > 0 ? 'multiply' : 'source-over';
      ctx.drawImage(Wd.c, -Wd.w / 2, -Wd.h / 2, Wd.w, Wd.h); ctx.restore();
      if (i && fly >= 1) {                                            // the × in ink, set before the word
        ctx.save(); ctx.font = `900 ${FORM.size}px Stencil`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.globalAlpha *= sst(kk(land, 0, .08));
        ctx.fillText('×', tx - Wd.w / 2 + 14, ty + FORM.size * .05); ctx.restore();
      }
    }
    // « le carton entier », written by a marker, « entier » underlined
    if (fm.sub > 0) {
      const f = '800 64px Shantell', s1 = 'le carton entier', wd = measureW(s1, f), x0 = FORM.x - wd / 2, y = FORM.subY + 22, k = fm.sub;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, y - 70, (wd + 20) * k, 100); ctx.clip();
      ctx.font = f; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK; ctx.fillText(s1, x0, y);
      const we = measureW('le carton ', f); ctx.strokeStyle = ORANGE; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0 + we, y + 14); ctx.quadraticCurveTo(x0 + we + (wd - we) / 2, y + 22, x0 + wd + 6, y + 10); ctx.stroke();
      ctx.restore();
      if (k < 1 && typeof marker === 'function') marker(x0 + wd * k, y - 14, Math.PI - .6, INK);   // the pen's body below the line, off the formula
    }
    ctx.restore();
  }

  // ---------- AVANT / APRÈS ----------
  function strip(w, h, seed, fill = PAPER) {
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 8;
    ctx.fillStyle = fill; ctx.beginPath(); const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 3 + seed, 3, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 9 + seed, 3, 12);
    ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(205,160,104,.92)'; at(-w / 2 + 16, -h / 2 + 6, -.55, 1, 1, () => ctx.fillRect(-44, -15, 88, 30)); at(w / 2 - 16, -h / 2 + 6, .55, 1, 1, () => ctx.fillRect(-44, -15, 88, 30));
  }
  function divider(k) {
    const y0 = 676, y1 = 1440, hh = (y1 - y0) * sst(k), cy = (y0 + y1) / 2;
    if (hh < 4) return;
    ctx.save(); ctx.translate(G.cx, cy); ctx.rotate(.008);
    ctx.shadowColor = 'rgba(60,32,12,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 6;
    const l = tornLine(-11, -hh / 2, -11, hh / 2, 41, 3, 10), r = tornLine(11, hh / 2, 11, -hh / 2, 47, 3, 10);
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.moveTo(...l[0]); for (const p of l) ctx.lineTo(...p); for (const p of r) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(0, -hh / 2 + 10); ctx.lineTo(0, hh / 2 - 10); ctx.stroke();
    ctx.restore();
  }
  const GG = { track: 404, cap: 74, h: 60, merch: 112 };
  function gauge(cx, fillLen, k, L, seed) {
    const x0 = cx - GG.track / 2 + 10, y = G.split.gaugeY, h = GG.h;
    // the groove cut in the paper
    ctx.save();
    ctx.fillStyle = 'rgba(60,32,12,.16)'; rrect(x0 + 4, y - h / 2 + 6, GG.track, h, h / 2); ctx.fill();
    ctx.fillStyle = '#EFE6D6'; rrect(x0, y - h / 2, GG.track, h, h / 2); ctx.fill();
    ctx.save(); rrect(x0, y - h / 2, GG.track, h, h / 2); ctx.clip();
    const ig = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2); ig.addColorStop(0, 'rgba(60,32,12,.28)'); ig.addColorStop(.35, 'rgba(60,32,12,0)'); ctx.fillStyle = ig; ctx.fillRect(x0, y - h / 2, GG.track, h);
    // the fill: merchandise, then the void (hatched like the carton's)
    const f0 = x0 + GG.cap, Lm = Math.min(GG.merch, fillLen), cur = fillLen * k;
    if (cur > 0) {
      const mL = Math.min(cur, Lm);
      const cols = H.S && CA_K.PAIRS ? CA_K.PAIRS.map(p => p.strap) : [[30, 140, 126], [44, 74, 142], [191, 74, 46]];
      ctx.save(); ctx.beginPath(); ctx.rect(f0, y - h / 2, mL, h); ctx.clip();
      cols.forEach((c, i) => { ctx.fillStyle = litA(c, f0, y, L); ctx.fillRect(f0, y - h / 2 + 7 + i * (h - 14) / 3, mL, (h - 14) / 3 + .5); });
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(f0, y - h / 2 + 7, mL, 4); ctx.restore();
      if (cur > Lm) {
        const vx = f0 + Lm, vw = cur - Lm;
        ctx.save(); ctx.beginPath(); ctx.rect(vx, y - h / 2 + 7, vw, h - 14); ctx.clip();
        ctx.fillStyle = 'rgba(168,205,236,.95)'; ctx.fillRect(vx, y - h / 2, vw, h);
        ctx.strokeStyle = 'rgba(47,120,189,.75)'; ctx.lineWidth = 5; ctx.beginPath(); for (let x = vx - h; x < vx + vw + h; x += 18) { ctx.moveTo(x, y + h / 2); ctx.lineTo(x + h, y - h / 2); } ctx.stroke();
        ctx.restore();
      }
      // the moving edge, a bright lip
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(f0 + cur - 3, y - h / 2 + 7, 3, h - 14);
    }
    ctx.restore();
    // the « m³ » cap (ink tab)
    ctx.fillStyle = INK; rrect(x0 + 4, y - h / 2 + 4, GG.cap - 8, h - 8, (h - 8) / 2); ctx.fill();
    ctx.fillStyle = CREAM; ctx.font = '900 40px Satoshi'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('m³', x0 + GG.cap / 2 + 1, y + 2);
    ctx.restore();
  }
  function split(sp, t, L) {
    if (!sp || sp.k <= .01) return;
    divider(sp.k);
    ctx.save(); ctx.globalAlpha *= cl(sp.k * 1.4);
    const maxFill = GG.track - GG.cap - 18, fl = maxFill, fr = maxFill * (G.split.gaugeR / G.split.gaugeL);
    gauge(G.split.L, fl, sp.gaugeL, L, 1); gauge(G.split.R, fr, sp.gaugeR, L, 2);
    ctx.restore();
    // the labels (take over 'avantApres')
    const lb = sp.labels;
    for (const [lab, x, col, sd, r] of [['AVANT', G.split.L, INK, 4, -.03], ['APRÈS', G.split.R, ORANGE, 8, .03]]) {
      at(x, G.split.labelY - (1 - eo(lb)) * 40, r, 1, 1, () => { ctx.globalAlpha *= cl(lb * 1.5); strip(330, 116, sd); text(lab, 0, 34, { font: '900 92px Stencil', align: 'center', color: col, ls: 4 }); });
    }
  }

  // ---------- the bubble-wrapped glass ----------
  let WRAP = null;
  function wrapSprite() {
    if (WRAP) return WRAP;
    const SS = 2, w = 230, h = 320, c = makeCanvas(w * SS, h * SS), g = c.getContext('2d'); g.scale(SS, SS); g.translate(w / 2, h);
    const shape = () => { g.beginPath(); g.moveTo(-96, -6); g.quadraticCurveTo(-112, -150, -100, -300); g.quadraticCurveTo(0, -318, 100, -300); g.quadraticCurveTo(112, -150, 96, -6); g.quadraticCurveTo(0, 4, -96, -6); g.closePath(); };
    shape(); g.fillStyle = 'rgba(214,234,248,.55)'; g.fill(); g.strokeStyle = 'rgba(90,140,190,.6)'; g.lineWidth = 2.5; g.stroke();
    g.save(); shape(); g.clip();
    for (let row = 0, y = -16; y > -310; y -= 27, row++) for (let x = -104 + (row % 2) * 13.5; x < 108; x += 27) {
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill();
      g.strokeStyle = 'rgba(80,130,180,.42)'; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, Math.PI * 1.1, Math.PI * 1.55); g.stroke();
    }
    // the fold seams of the wrapped sheet
    g.strokeStyle = 'rgba(70,120,170,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-100, -120); g.quadraticCurveTo(0, -150, 104, -200); g.moveTo(-104, -230); g.quadraticCurveTo(10, -250, 100, -290); g.stroke();
    g.restore();
    return (WRAP = { c, w, h, SS });
  }
  function glassShape() {
    ctx.beginPath(); ctx.moveTo(-64, -236); ctx.lineTo(64, -236); ctx.bezierCurveTo(68, -170, 58, -118, 9, -98); ctx.lineTo(7, -18);
    ctx.bezierCurveTo(8, -8, 54, -10, 58, 0); ctx.lineTo(-58, 0); ctx.bezierCurveTo(-54, -10, -8, -8, -7, -18); ctx.lineTo(-9, -98); ctx.bezierCurveTo(-58, -118, -68, -170, -64, -236); ctx.closePath();
  }
  const POPS = [[-52, -60], [40, -114], [-20, -196], [58, -244]];
  function glass(gl, t, L) {
    if (!gl || gl.s <= .01) return;
    const fx = gl.x, fy = gl.y + 50;                                  // the foot on the table
    const gs = gl.s * 1.22;
    H.softShadow(fx + 40 * gs, fy + 6, 120 * gs, 26 * gs, .3);
    ctx.save(); ctx.translate(fx, fy); ctx.scale(gs, gs);
    // cut paper glass: a pale back layer (thickness), the glass paper, highlights
    ctx.save(); ctx.translate(6, 6); glassShape(); ctx.fillStyle = '#A9C3D8'; ctx.fill(); ctx.restore();
    glassShape(); const gg = ctx.createLinearGradient(-64, 0, 64, 0); gg.addColorStop(0, '#F3F9FD'); gg.addColorStop(.5, '#DDEBF5'); gg.addColorStop(1, '#C6DBEB'); ctx.fillStyle = gg; ctx.fill();
    ctx.strokeStyle = '#5E8DB4'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.moveTo(-44, -222); ctx.quadraticCurveTo(-50, -170, -26, -128); ctx.lineTo(-34, -130); ctx.quadraticCurveTo(-58, -172, -52, -222); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(94,141,180,.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -236, 64, 9, 0, 0, Math.PI * 2); ctx.stroke();
    // the bubble wrap, wrapping from the foot up
    if (gl.wrap > 0) {
      const Wp = wrapSprite(), top = -Wp.h * eo(gl.wrap);
      ctx.save(); ctx.beginPath(); ctx.rect(-Wp.w / 2 - 10, top - 4, Wp.w + 20, -top + 20); ctx.clip();
      ctx.drawImage(Wp.c, -Wp.w / 2, -Wp.h + 6, Wp.w, Wp.h); ctx.restore();
      if (gl.wrap < 1) {                                              // the rolling edge of the sheet
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-104, top + 2); ctx.quadraticCurveTo(0, top - 12, 104, top + 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(90,140,190,.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      } else {                                                        // kraft tape closes it
        ctx.save(); ctx.translate(30, -150); ctx.rotate(-.5); ctx.fillStyle = 'rgba(169,118,63,.95)'; ctx.fillRect(-46, -15, 92, 30); ctx.fillStyle = 'rgba(255,230,190,.3)'; ctx.fillRect(-46, -12, 92, 5); ctx.restore();
      }
      // bubbles popping (plop)
      POPS.forEach(([x, y], i) => {
        const k = kk(gl.pop, i * .2, i * .2 + .32); if (k <= 0 || y < top) return;
        if (k < 1) { ctx.save(); ctx.globalAlpha *= 1 - k; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + .3, r0 = 10 + 22 * k, r1 = r0 + 10; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); } ctx.restore(); }
        ctx.fillStyle = 'rgba(140,180,214,.55)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 5, .2, 0, 7); ctx.fill();
      });
    }
    ctx.restore();
  }
  /** the formula's fade-out after SCORE.tape(t) has ended (called from CA_fx) */
  function formulaTail(t, L) {
    if (S.tape(t)) return; const fm = S.formula(t); if (!fm || fm.a <= .01) return;
    const tp = S.tape(Math.max(A.mes0, A.formulaOut - .001)); if (tp) formula(tp, fm, t, L);
  }
  return { measure, split, glass, formulaTail, FORM };
})();
function CA_measure(tp, fm, t, L) { CA_MS.measure(tp, fm, t, L); }
function CA_split(sp, t, L) { CA_MS.split(sp, t, L); }
function CA_glass(gl, t, L) { CA_MS.glass(gl, t, L); }

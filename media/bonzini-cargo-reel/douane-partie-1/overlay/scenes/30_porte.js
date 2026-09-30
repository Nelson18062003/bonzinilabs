'use strict';
// =============================================================================================
// 30_porte — chapitre « porte » (S4)
// « La douane, c'est la porte du pays pour les marchandises. Ce qui entre… et ce qui sort. »
//  · début      : vrai tirage « estuaire du Wouri vu du ciel » (duotone vert), Ken Burns + light leak ; « douane » = tampon encre jaune.
//  · « porte »  : le tirage se DÉCHIRE en deux (moitiés qui s'envolent, en deux) → carte papier du Cameroun ; un portique
//                 « DOUANE » (poteaux verts + barrière rouge/blanc) se plante dans la mer, devant Douala et Kribi.
//  · « pays »   : le contour du pays pulse (vert épais + deux échos) ; bande « LA PORTE DU PAYS » qui claque.
//  · « marchandises » : un carton flotte au large et attend.
//  · « entre »  : la barrière se lève, flèche violette ; le carton passe le portique (flash rayons X) et entre à Douala ;
//                 puce IMPORT ; polaroïd réel du port de Douala relié à l'épingle par un fil.
//  · « et »     : polaroïd de Kribi (« KRIBI DEEP SEA PORT ») ; « sort » : flèche orange, un sac quitte Kribi vers le large ;
//                 puce EXPORT ; en bas : bande « IMPORT ⇄ EXPORT : VOUS DEUX ».
// La scène possède l'image de TL.ch('porte').start à .end (coupe franche sous les volets) : elle repeint la table d'abord.
// =============================================================================================
(() => {
  const CH = 'porte', SEG = 'S4';
  const S = 72, OX = 742, OY = 822;                              // carte : px par degré, origine du repère géo
  const CARD = { x: 40, y: 262, w: 1000, h: 1000 };              // la carte papier (écran)
  const GC = [540, 762];                                         // pivot du groupe carte
  const PORTAL = [312, 1150];                                    // pied du portique (dans la mer)
  const IMP = [[58, 1048], [170, 1046], [312, 1044], [420, 1022], [492, 988], [536, 966]];
  const EXP = [[556, 1050], [468, 1086], [312, 1100], [190, 1130], [58, 1168]];
  const DUO_SAT = ['#174F43', '#FFF8E6'];                        // duotone vert plus clair pour la photo radar
  const PR = { x: 540, y: 772, w: 860, h: 560, rot: -.02 };      // le tirage satellite
  const POL = {                                                  // polaroïds réels (≤ 380 px bord compris)
    D: { name: 'douala_port', cap: 'Douala', x: 232, y: 628, w: 316, h: 206, r: -.06, zoom: 1.25, fx: .36, fy: .45, col: C.violetD, seed: 31 },
    K: { name: 'kribi_crane', cap: 'Kribi', x: 846, y: 640, w: 320, h: 206, r: .055, zoom: 1.6, fx: .5, fy: .3, col: C.orange, seed: 32 },
  };
  let T = null, reg = false, PI_ = null, PE_ = null, LI_ = null, LE_ = null, TEAR = null;

  // ---------------------------------------------------------------------------- time & geometry
  function times() {
    const c = TL.ch(CH), w = (k, nth = 0) => TL.wt(SEG, k, null, nth);
    const o = { c0: c.start, c1: c.end, dou: w('douane'), porte: w('porte'), pays: w('pays'), march: w('marchandises'), entre: w('entre'), sort: w('sort') };
    o.ce2 = TL.word(SEG, 'et') ? w('et') + .1 : o.sort - .3;     // « ET ce qui sort » : Kribi arrives before « sort »
    o.ce2 = Math.min(o.ce2, o.sort - .12);
    o.tear = o.porte - .04;
    return o;
  }
  const cityXY = name => { const g = geo(), c = g && g._cities[name]; return c ? [OX + c[0] * S, OY + c[1] * S] : [OX, OY]; };
  function lens(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return L; }
  function along(pts, L, u) {
    const d = clamp(u) * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < d) i++;
    const k = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
    return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])];
  }
  /** top-down « landing » of a paper object dropped towards the table: big → 1, then a squash wobble */
  function land(t, t0, dur = .22, from = 1.4) {
    if (t < t0) return null;
    const k = (t - t0) / dur;
    if (k < 1) { const e = k * k; return { s: lerp(from, 1, e), sq: 0, lift: lerp(60, 12, e), a: clamp(k * 5) }; }
    const s = t - t0 - dur; return { s: 1, sq: Math.exp(-s * 10) * Math.cos(s * 36) * .07, lift: 12, a: 1 };
  }
  function cmrPath() {
    const g = geo(); if (!g) return; ctx.beginPath();
    for (const r of g.CMR.rings) { r.forEach(([a, b], i) => i ? ctx.lineTo(OX + a * S, OY + b * S) : ctx.moveTo(OX + a * S, OY + b * S)); ctx.closePath(); }
  }

  // ---------------------------------------------------------------------------- props
  function mapCard(n) {
    const { x, y, w, h } = CARD;
    withShadow(16, () => { ctx.fillStyle = '#FBF7EE'; rrect(x, y, w, h, 12); ctx.fill(); });
    ctx.save(); rrect(x + 18, y + 18, w - 36, h - 36, 6); ctx.clip();
    ctx.fillStyle = '#CFE0EC'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(11,95,165,.15)'; ctx.lineWidth = 3;                     // paper swell lines, boil on twos
    const ph = stepT(n) * .9;
    for (let i = 0; i < 13; i++) { const yy = y + 50 + i * 76; ctx.beginPath();
      for (let xx = x; xx <= x + w; xx += 16) { const v = yy + Math.sin(xx * .022 + i * 1.7 + ph) * 5; xx === x ? ctx.moveTo(xx, v) : ctx.lineTo(xx, v); } ctx.stroke(); }
    at(OX, OY, 0, 1, 1, () => cmrMap(S, { sea: false, pins: {} }));
    ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.14)'; ctx.lineWidth = 2; rrect(x + 18, y + 18, w - 36, h - 36, 6); ctx.stroke();
    at(x + w - 74, y + h - 72, .08, 1, 1, () => {                                 // paper compass rose, bottom-right corner
      ctx.fillStyle = 'rgba(35,22,41,.5)'; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(10, 0); ctx.lineTo(0, 40); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(10, 0); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill();
      text('N', 0, -48, { font: font(FF.stencil, 30, 900), align: 'center', color: C.ink }); });
  }
  function pulse(t) {
    if (t < T.pays - .06) return;
    const e = Math.max(0, t - T.pays), k = Math.exp(-e * 3.2), br = .5 + .5 * Math.sin(t * 5.5);
    ctx.save(); ctx.globalAlpha *= .25 * k; ctx.fillStyle = '#FFFFFF'; cmrPath(); ctx.fill(); ctx.restore();
    const cx = OX - .14 * S, cy = OY - 1.38 * S;
    for (const d of [0, .2]) {                                                     // two expanding echoes
      const ek = prog(t, T.pays + d, T.pays + d + .55); if (ek <= 0 || ek >= 1) continue;
      const s = 1 + .2 * eOutCubic(ek); ctx.save(); ctx.globalAlpha *= (1 - ek) * .9; ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      ctx.strokeStyle = DC.green; ctx.lineWidth = 6 / s; ctx.lineJoin = 'round'; cmrPath(); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(14,107,78,.55)'; ctx.shadowBlur = 8 + 26 * k;
    ctx.strokeStyle = DC.green; ctx.lineWidth = 7 + 12 * k + 1.5 * br; cmrPath(); ctx.stroke(); ctx.restore();
  }
  function pin(p, col, k, n, seed) {
    if (k <= 0) return; const s = clamp(spring(k, 13, .42), 0, 1.25), j = jit(seed, n, .6);
    at(p[0], p[1] + j.y * .5, 0, s, s, () => {
      ctx.fillStyle = 'rgba(35,22,41,.25)'; ctx.beginPath(); ctx.ellipse(5, 2, 13, 5, 0, 0, 7); ctx.fill();
      withShadow(8, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -36, 22, Math.PI * .15, Math.PI * .85, true); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -38, 9, 0, 7); ctx.fill();
    });
  }
  function cityLabel(name, x, y, k, rot, col) {
    if (k <= 0) return; const s = clamp(spring(k, 12, .5), 0, 1.2), f = font(FF.body, 46, 800), w = measure(name, f) + 36;
    at(x, y, rot, s, s, () => { withShadow(6, () => { ctx.fillStyle = C.cream; rrect(-w / 2, -36, w, 68, 8); ctx.fill(); });
      ctx.fillStyle = col; rrect(-w / 2, -36, 10, 68, 4); ctx.fill();
      text(name, 4, 16, { font: f, align: 'center', color: C.ink }); });
  }
  /** customs portal standing in the sea: 2 green posts, green « DOUANE » lintel, red/white arm (open 0..1), cyan scan curtain */
  function portal(open, beam, n) {
    const w = 180, h = 214, pw = 26;
    ctx.fillStyle = 'rgba(35,22,41,.2)'; ctx.beginPath(); ctx.ellipse(12, 4, w * .64, 15, 0, 0, 7); ctx.fill();
    withShadow(10, () => { ctx.fillStyle = DC.green; rrect(-w / 2, -h, pw, h, 6); ctx.fill(); rrect(w / 2 - pw, -h, pw, h, 6); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2 + 4, -h, 5, h); ctx.fillRect(w / 2 - pw + 4, -h, 5, h);
    for (const x0 of [-w / 2, w / 2 - pw]) { ctx.fillStyle = DC.yellow; ctx.fillRect(x0, -36, pw, 28); ctx.fillStyle = C.ink; ctx.fillRect(x0, -31, pw, 6); ctx.fillRect(x0, -19, pw, 6); }
    if (beam > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-w / 2 + pw, 0, w / 2 - pw, 0); g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(.5, `rgba(127,231,255,${.6 * beam})`); g.addColorStop(1, 'rgba(90,220,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + pw, -h, w - 2 * pw, h); ctx.fillStyle = `rgba(220,250,255,${.9 * beam})`; ctx.fillRect(-2, -h, 4, h); ctx.restore(); }
    const wob = open < .02 ? Math.sin(stepT(n) * 9) * .012 : 0;
    at(-w / 2 + pw / 2, -h * .5, -open * 1.32 + wob, 1, 1, () => {
      const L = w - pw - 2;
      withShadow(6, () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, -12, L, 24); });
      for (let x = 0; x < L; x += 50) { ctx.fillStyle = DC.red; ctx.fillRect(x, -12, Math.min(25, L - x), 24); }
      ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; ctx.strokeRect(0, -12, L, 24);
      ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
    });
    withShadow(12, () => { ctx.fillStyle = DC.green; rrect(-w / 2 - 20, -h - 64, w + 40, 76, 12); ctx.fill(); });
    ctx.strokeStyle = 'rgba(246,197,74,.75)'; ctx.lineWidth = 3; rrect(-w / 2 - 11, -h - 55, w + 22, 58, 8); ctx.stroke();
    text('DOUANE', 0, -h - 64 + 57, { font: font(FF.stencil, 52, 900), align: 'center', color: DC.yellow, ls: 4 });
    const on = Math.floor(n / 8) % 2;                                                           // blinking lamp
    ctx.fillStyle = on ? C.orange : '#8A3A12'; ctx.beginPath(); ctx.arc(w / 2 + 8, -h - 72, 11, 0, 7); ctx.fill();
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(w / 2 + 8, -h - 72, 2, w / 2 + 8, -h - 72, 44);
      g.addColorStop(0, 'rgba(254,86,13,.5)'); g.addColorStop(1, 'rgba(254,86,13,0)'); ctx.fillStyle = g; ctx.fillRect(w / 2 - 36, -h - 116, 88, 88); ctx.restore(); }
  }
  function xrayCarton(w, h) {
    ctx.save(); ctx.fillStyle = '#0A1A2A'; rrect(-w / 2, -h / 2, w, h, 5); ctx.fill();
    ctx.strokeStyle = XRAY; ctx.lineWidth = 2.5; rrect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 4); ctx.stroke();
    ctx.lineJoin = 'round';
    for (const dy of [-h * .2, h * .2]) { const s = w / 520; ctx.save(); ctx.translate(0, dy); ctx.scale(s, s); ctx.lineWidth = 2 / s; ctx.beginPath();
      ctx.moveTo(-185, 42); ctx.lineTo(-180, -40); ctx.quadraticCurveTo(-176, -70, -140, -74); ctx.lineTo(-70, -78); ctx.quadraticCurveTo(-40, -40, 10, -30);
      ctx.lineTo(110, -8); ctx.quadraticCurveTo(190, 6, 198, 40); ctx.closePath(); ctx.stroke(); ctx.restore(); }
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(127,231,255,.18)'; rrect(-w / 2, -h / 2, w, h, 5); ctx.fill(); ctx.restore();
  }
  function arrowHead(x, y, a, col, s) {
    if (s <= 0) return;
    at(x, y, a, s, s, () => { ctx.save(); ctx.translate(3, 5); ctx.fillStyle = 'rgba(60,20,90,.22)'; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-18, -20); ctx.lineTo(-10, 0); ctx.lineTo(-18, 20); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-18, -20); ctx.lineTo(-10, 0); ctx.lineTo(-18, 20); ctx.closePath(); ctx.fill(); });
  }
  /** expanding paper ring (the carton « enters » the country) */
  function ring(x, y, k, col) {
    if (k <= 0 || k >= 1) return; ctx.save(); ctx.globalAlpha *= 1 - k; ctx.strokeStyle = col; ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(x, y, 14 + 60 * eOutCubic(k), 0, 7); ctx.stroke(); ctx.restore();
  }
  /** ink stamp drawn source-over (reads on a dark photo): text + box, starved ink */
  function inkStamp(txt, size, color) {
    const oc = makeCanvasCached('po_ink', 900, 300), g = oc.getContext('2d'), f = font(FF.stencil, size, 900);
    g.clearRect(0, 0, 900, 300); g.font = f; g.letterSpacing = '4px'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(txt, 450, 158);
    const tw = g.measureText(txt).width; g.strokeStyle = color; g.lineWidth = 11; rrectOn(g, 450 - tw / 2 - 30, 150 - size * .62, tw + 60, size * 1.24, 16); g.stroke();
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .45; g.drawImage(TEX.starve, 0, 0, 900, 300); g.drawImage(TEX.starve, 150, 40, 700, 230);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    ctx.drawImage(oc, -450, -150);
  }
  /** a real photo as a polaroid: caption handwritten ≥ 50 px, credit in the photo corner */
  function polaroid(P, lift) {
    photoPrint(P.name, P.w, P.h, { caption: ' ', lift, zoom: P.zoom, fx: P.fx, fy: P.fy, border: 14 });
    ctx.fillStyle = P.col; ctx.fillRect(-P.w / 2 - 14, P.h / 2 + 14 + 58, P.w + 28, 6);
    text(P.cap, 0, P.h / 2 + 14 + 48, { font: font(FF.hand, 52, 800), align: 'center', color: C.ink });
    credit2(CREDIT[P.name], P.w / 2 - 6, P.h / 2 - 8, P.w - 12);
  }
  /** creditTag wrapped on 2 lines when the credit is wider than the photo (same text, same style) */
  function credit2(s, x, y, maxW) {
    const f = font(FF.body, 20, 700), words = s.replace(/CC BY /g, 'CC BY ').replace(/ · /g, ' · ').split(' '), lines = []; let cur = '';
    for (const wd of words) { const nx = cur ? cur + ' ' + wd : wd; if (cur && measure(nx, f) + 20 > maxW) { lines.push(cur); cur = wd; } else cur = nx; }
    if (cur) lines.push(cur);
    lines.reverse().forEach((l, i) => creditTag(l, x, y - i * 34));
  }
  function satPrint(t) {
    const kb = eInOutCubic(prog(t, T.c0, T.porte + .4));
    photoPrint('douala_satellite', PR.w, PR.h, { fx_kind: 'duo', cols: DUO_SAT, zoom: lerp(1.08, 1.22, kb), fx: lerp(.5, .45, kb), fy: lerp(.5, .43, kb), lift: 14 });
    creditTag(CREDIT.douala_satellite, PR.w / 2 - 8, -PR.h / 2 + 40);
    const lab = 'Douala, vue du ciel', lf = font(FF.hand, 48, 800), lw = measure(lab, lf) + 56;
    paperNote(-PR.w / 2 + lw / 2 + 20, PR.h / 2 + 10, lw, 80, -.035, () => text(lab, 0, 16, { font: lf, align: 'center', color: C.ink }), { seed: 3, h: 6, tape: false });
    if (t >= T.dou - .1) { const sl = slam(t, T.dou, 1.8);
      at(-PR.w / 2 + 250, 40, -.1, sl.s, sl.s, () => { ctx.globalAlpha *= .92 * sl.a; inkStamp('DOUANE', 120, DC.yellow); }); }
  }
  function tearPts() { if (!TEAR) TEAR = tornLine(-26, -PR.h / 2 - 30, 34, PR.h / 2 + 100, 57, 12, 16); return TEAR; }
  function drawPrint(t, n, ts) {
    const kT = prog(ts, T.tear, T.tear + .46); if (kT >= 1) return;
    const dr = drift(t, 5, 4);
    at(PR.x + dr.x, PR.y + dr.y, PR.rot + dr.r, 1, 1, () => {
      if (kT <= 0) { satPrint(t); return; }
      const pts = tearPts(), e = kT * kT;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * (14 + 920 * e), (side < 0 ? -90 : 70) * e); ctx.rotate(side * .45 * e);
        ctx.beginPath(); ctx.moveTo(side * PR.w, -PR.h); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(side * PR.w, PR.h); ctx.closePath(); ctx.clip();
        satPrint(t);
        ctx.strokeStyle = 'rgba(255,253,245,.95)'; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
        ctx.restore();
      }
    });
  }
  /** « IMPORT ⇄ EXPORT : VOUS DEUX » on a torn strip, the double arrow is drawn (font-safe) */
  function ioStrip() {
    const size = 56, f = font(FF.stencil, size, 900), ls = 3, gap = 100;
    const parts = [['IMPORT', C.violetD], null, ['EXPORT', C.orange], [' : VOUS DEUX', C.ink]];
    const ws = parts.map(p => p ? measure(p[0], f, ls) : gap), tw = ws.reduce((a, b) => a + b, 0), w = tw + 84, h = size * 1.5;
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 31, 4, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 37, 4, 12);
    withShadow(10, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    let x = -tw / 2;
    parts.forEach((p, i) => {
      if (!p) { const cx = x + gap / 2; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7;
        ctx.strokeStyle = C.violetD; ctx.beginPath(); ctx.moveTo(cx - 32, -10); ctx.lineTo(cx + 30, -10); ctx.moveTo(cx + 14, -24); ctx.lineTo(cx + 31, -10); ctx.lineTo(cx + 14, 4); ctx.stroke();
        ctx.strokeStyle = C.orange; ctx.beginPath(); ctx.moveTo(cx + 32, 14); ctx.lineTo(cx - 30, 14); ctx.moveTo(cx - 14, 0); ctx.lineTo(cx - 31, 14); ctx.lineTo(cx - 14, 28); ctx.stroke(); ctx.restore(); }
      else text(p[0], x, size * .36, { font: f, color: p[1], ls });
      x += ws[i];
    });
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                          // hard cut under the wipes (both at their midpoint)
    if (!reg) { reg = true; addShake(T.dou, 8); addShake(T.pays, 10); addShake(T.porte + .26, 6); addShake(T.entre + .02, 5); addShake(T.sort + .3, 6);
      PI_ = curve(IMP, 10); LI_ = lens(PI_); PE_ = curve(EXP, 10); LE_ = lens(PE_); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n), D = cityXY('Douala'), K = cityXY('Kribi');

    // ------------------------------------------------ the map group (card, pins, portal, arrows, goods)
    const mL = land(ts, T.tear - .14, .2, 1.06);
    if (mL) {
      const dr = drift(t, 3, 5);
      ctx.save();
      ctx.translate(GC[0] + dr.x, GC[1] + dr.y); ctx.rotate(-.012 + dr.r); ctx.scale(mL.s * (1 + mL.sq * .3), mL.s * (1 - mL.sq * .3)); ctx.translate(-GC[0], -GC[1]);
      mapCard(n);
      pulse(t);
      pin(D, C.violetD, t - (T.porte + .12), n, 11); pin(K, C.orange, t - (T.porte + .2), n, 12);
      cityLabel('Douala', D[0] + 118, D[1] - 34, t - (T.porte + .2), -.03, C.violetD);
      cityLabel('Kribi', K[0] + 100, K[1] + 28, t - (T.porte + .28), .025, C.orange);
      const pk = land(ts, T.porte + .22, .2, 1.8);
      const open = t < T.entre - .02 ? 0 : clamp(eOutBack(prog(t, T.entre - .02, T.entre + .24)), 0, 1.08);
      const uC = eInOutCubic(prog(ts, T.entre + .1, T.entre + .72)), cP = along(PI_, LI_, lerp(.06, 1, uC));
      const beam = cP[0] > PORTAL[0] - 95 && cP[0] < PORTAL[0] + 95 && uC > 0 && uC < 1 ? 1 : 0;
      if (pk) at(PORTAL[0], PORTAL[1], Math.sin(t * 1.3) * .006, pk.s * (1 + pk.sq), pk.s * (1 - pk.sq), () => portal(open, beam, n));
      const pI = prog(t, T.entre, T.entre + .34);                                             // import (violet)
      if (pI > 0) { thread(PI_, pI, n, { color: C.violet, w: 13 }); const a = along(PI_, LI_, pI); arrowHead(a[0], a[1], a[2], C.violet, pI > .9 ? 1.1 : .8); }
      const pE = prog(t, T.sort, T.sort + .3);                                                // export (orange)
      if (pE > 0) { thread(PE_, pE, n, { color: C.orange, w: 13 }); const a = along(PE_, LE_, pE); arrowHead(a[0], a[1], a[2], C.orange, pE > .9 ? 1.1 : .8); }
      // the carton: waits at sea, crosses the portal (x-ray), enters Douala (shrinks into the pin + ring)
      const tIn = T.entre + .72;
      if (t >= T.march - .05 && t < tIn + .2) {
        const s = clamp(spring(t - T.march + .05, 14, .45), 0, 1.25) * (1 - eInCubic(prog(ts, tIn, tIn + .16))), bob = uC <= 0 ? Math.sin(ts * 5) * 4 : 0, j = jit(21, n, .9);
        if (s > .02) at(cP[0] + j.x, cP[1] - 18 + bob + j.y, j.r + (uC > 0 && uC < 1 ? Math.sin(ts * 14) * .06 : -.08), s, s, () => beam ? xrayCarton(88, 64) : carton(88, 64, { seed: 9, bev: 7 }));
      }
      ring(D[0], D[1] - 20, prog(t, tIn + .05, tIn + .5), C.violet);
      // the sack: pops out of Kribi on « sort », rides out to sea, bobs there
      if (t >= T.sort - .04) {
        const uS = eInOutCubic(prog(ts, T.sort + .06, T.sort + .6)), sP = along(PE_, LE_, lerp(0, .9, uS)), s2 = clamp(spring(t - T.sort + .04, 15, .45), 0, 1.25), j2 = jit(22, n, .9);
        const hop = uS > 0 && uS < 1 ? -Math.abs(Math.sin(ts * 11)) * 12 : Math.sin(ts * 5) * 3;
        at(sP[0] + j2.x, sP[1] - 26 + hop + j2.y, j2.r + .06, s2, s2, () => sack(66, 80, '', { lift: 6 }));
      }
      if (t >= T.entre + .1) chip(150, 986, 'IMPORT', { fill: C.violetD, size: 44, rot: -.04, s: clamp(pop(t, T.entre + .1), 0, 1.15) });
      if (t >= T.sort + .08) chip(176, 1222, 'EXPORT', { fill: C.orange, size: 44, rot: .03, s: clamp(pop(t, T.sort + .08), 0, 1.15) });
      ctx.restore();
    }

    // ------------------------------------------------ threads + real polaroids (own parallax drift)
    const tD = T.entre + .24, tK = T.ce2;
    if (t >= tD + .12) thread([[D[0] - 4, D[1] - 40], [420, 880], [POL.D.x + 110, POL.D.y + 160]], prog(t, tD + .12, tD + .38), n, { color: POL.D.col, w: 4 });
    if (t >= tK + .12) thread([[K[0] + 6, K[1] - 40], [780, 1000], [POL.K.x - 20, POL.K.y + 170]], prog(t, tK + .12, tK + .38), n, { color: POL.K.col, w: 4 });
    for (const [P, t0] of [[POL.D, tD], [POL.K, tK]]) {
      const L = land(ts, t0, .2, 1.5); if (!L) continue; const j = jit(P.seed, n, .7), dr = drift(t, P.seed, 3);
      at(P.x + j.x + dr.x, P.y + j.y + dr.y, P.r + j.r, L.s * (1 + L.sq), L.s * (1 - L.sq), () => { ctx.globalAlpha *= L.a; polaroid(P, L.lift); });
    }

    // ------------------------------------------------ the satellite print (on top until torn away)
    drawPrint(t, n, ts);

    // ------------------------------------------------ headlines
    const swap = eInCubic(prog(t, T.sort - .05, T.sort + .15));                           // header flips to « IMPORT ⇄ EXPORT : VOUS DEUX » on « sort »
    if (t >= T.pays - .1 && swap < 1) { const sl = slam(t, T.pays, 1.7), dr = drift(t, 9, 3);
      at(392 + dr.x - swap * 700, 368 + dr.y, -.03 - swap * .2, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('LA PORTE DU PAYS', { size: 72, seed: 4 }); }); }
    if (t >= T.sort + .05) { const sl = slam(t, T.sort + .15, 1.5), dr = drift(t, 13, 2.5);
      at(540 + dr.x, 372 + dr.y, -.02, sl.s * .98, sl.s * .98, () => { ctx.globalAlpha *= sl.a; ioStrip(); }); }

    // ------------------------------------------------ light
    ctx.save(); ctx.globalAlpha = .7; lightLeak(prog(t, T.c0 - .05, T.c0 + .95), 11); ctx.restore();
    ctx.save(); ctx.globalAlpha = .45; lightLeak(prog(t, tK, tK + .7), 23); ctx.restore();
  }

  registerScene({ id: 'porte', z: 30, when: t => TL.in(t, CH, .4, .4), draw });
})();

'use strict';
// =============================================================================================
// M1 « carton & air » · 32_air.js — THE AIR CLOUD, hero of « TU PAIES DE L'AIR. »
//
//   CA_air(st, t, L)   st = SCORE.air(t) = {x, y, s, sx, sy, rot, a, burst, mood, frozen, deflate, inside, tag: {sw, a}}.
//     A cut-paper cloud: overlapping white paper discs (each with its own drop shadow, cut edge catching the window
//     light), a pale blue back layer for thickness, paper fibres; « AIR » cut out of sea-blue paper (Stencil 900, each
//     letter hand-pasted). Its face acts the mood: 'proud' (half-lidded side-eye, one brow up), 'content' (eyes shut ^ ^,
//     cheeks), 'nervous' (round eyes darting on twos, worried brows, a sweat drop), 'fleeing' (panicked, it deflates:
//     wrinkles, wobble, an air jet behind it; the last approach locks on K_mouth(t)). frozen → no bob (score), a tiny bead.
//     The burst (st.burst > 0, frame 0 → A.burstPeak): stretched upward, a trail of paper puffs from the carton's mouth,
//     « pouf » paper strips. Its tag « À PAYER » (no amount) hangs on an orange string, swings by st.tag.sw, and moves to
//     the cloud's right side when the cloud is on the left (G.cloudAside), so it stays inside x ≥ 40.
// Sprites cached (body 1.5×, tag 2×), the face and string are live. Deterministic, no ctx.filter. Cost ≈ 2–4 ms (one scaled sprite + live face, tag, string).
// =============================================================================================
const CA_AIR = (function () {
  const H = CA_, S = H.S, A = H.A, G = H.G, { cl, kk, mix, sst, eo, R, tq, litA } = H;
  const SEA = '#0B5FA5', INK = '#231629', ORANGE = '#FE560D';
  const SS = 1.5, CW = 720, CH = 450, OX = 360, OY = 215;           // body sprite: local box and its origin
  // lobes [x, y, r] — the top stays ≥ −152 so the cloud clears the title plate at its peak
  const LOBES = [[-20, -40, 112], [118, -16, 94], [-150, 4, 86], [218, 54, 72], [-236, 66, 64], [-126, 94, 76], [8, 98, 84], [138, 92, 76]];
  let SPR = null, TAG = null, FIB = null;
  function fibreTile() {
    if (FIB) return FIB;
    const c = makeCanvas(256, 256), g = c.getContext('2d'); g.lineCap = 'round';
    for (let i = 0; i < 700; i++) {
      const x = rnd(i * 1.7 + 11) * 256, y = rnd(i * 2.9 + 5) * 256, an = rnd(i * 3.3) * Math.PI, l = 3 + rnd(i * 4.7) * 9;
      g.strokeStyle = rnd(i * 6.1) > .5 ? 'rgba(255,255,255,.5)' : 'rgba(60,80,110,.13)'; g.lineWidth = rnd(i) > .8 ? 1.2 : .7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); g.stroke();
    }
    return (FIB = c);
  }
  function lobesPath(g, grow = 0) { g.beginPath(); for (const [x, y, r] of LOBES) { g.moveTo(x + r + grow, y); g.arc(x, y, r + grow, 0, 7); } }
  function sprite() {
    if (SPR) return SPR;
    const c = makeCanvas(Math.ceil(CW * SS), Math.ceil(CH * SS)), g = c.getContext('2d'); g.scale(SS, SS); g.translate(OX, OY);
    // the back paper layer: thickness, pale blue-grey, offset away from the window
    g.save(); g.translate(7, 10); g.fillStyle = '#AFC3D8'; lobesPath(g, 9); g.fill(); g.restore();
    g.save(); g.translate(3, 5); g.fillStyle = '#C9D7E6'; lobesPath(g, 8); g.fill(); g.restore();
    // the discs, back (top) to front (bottom), each lifts a little off the one behind
    const order = LOBES.map((l, i) => i).sort((a, b) => LOBES[a][1] - LOBES[b][1]);
    for (const i of order) {
      const [x, y, r] = LOBES[i];
      g.save(); g.shadowColor = 'rgba(30,60,100,.26)'; g.shadowBlur = 12; g.shadowOffsetX = 3; g.shadowOffsetY = 6;
      const rg = g.createRadialGradient(x - r * .2, y - r * .25, r * .2, x, y, r * 1.01);
      rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(.8, '#FCFDFE'); rg.addColorStop(1, '#EBF1F6');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, r - 1.6, Math.PI * .95, Math.PI * 1.62); g.stroke();
      g.strokeStyle = 'rgba(70,100,140,.18)'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r - .8, Math.PI * .05, Math.PI * .7); g.stroke();
    }
    // fibres over the white paper
    g.save(); lobesPath(g); g.clip(); g.globalAlpha = .55; g.fillStyle = g.createPattern(fibreTile(), 'repeat'); g.fillRect(-OX, -OY, CW, CH); g.restore();
    // a soft belly shade (volume) low on the cloud
    g.save(); lobesPath(g); g.clip(); const bl = g.createLinearGradient(0, 20, 0, 190); bl.addColorStop(0, 'rgba(120,150,190,0)'); bl.addColorStop(1, 'rgba(120,150,190,.16)'); g.fillStyle = bl; g.fillRect(-OX, -OY, CW, CH); g.restore();
    // « AIR » cut out of sea-blue paper, hand-pasted
    const LC = makeCanvas(Math.ceil(CW * SS), Math.ceil(CH * SS)), lg = LC.getContext('2d'); lg.scale(SS, SS); lg.translate(OX, OY);
    const f = '900 182px Stencil'; lg.font = f; lg.textBaseline = 'alphabetic';
    const chars = ['A', 'I', 'R'], ws = chars.map(ch => lg.measureText(ch).width), gap = 10, tot = ws.reduce((p, q) => p + q, 0) + gap * 2;
    let x = -tot / 2; const rots = [-.05, .035, -.02], dys = [0, -4, 2];
    chars.forEach((ch, i) => { lg.save(); lg.translate(x + ws[i] / 2, 96 + dys[i]); lg.rotate(rots[i]); lg.fillStyle = SEA; lg.textAlign = 'center'; lg.fillText(ch, 0, 0); lg.restore(); x += ws[i] + gap; });
    lg.globalCompositeOperation = 'source-atop'; lg.globalAlpha = .5; lg.fillStyle = lg.createPattern(fibreTile(), 'repeat'); lg.fillRect(-OX, -OY, CW, CH);
    lg.globalAlpha = 1; const lgr = lg.createLinearGradient(0, -40, 0, 100); lgr.addColorStop(0, 'rgba(255,255,255,.10)'); lgr.addColorStop(1, 'rgba(0,20,60,.16)'); lg.fillStyle = lgr; lg.fillRect(-OX, -OY, CW, CH);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.shadowColor = 'rgba(10,40,90,.38)'; g.shadowBlur = 5 * SS; g.shadowOffsetX = 2.5 * SS; g.shadowOffsetY = 4 * SS; g.drawImage(LC, 0, 0); g.restore();
    return (SPR = c);
  }
  function tagSprite() {
    if (TAG) return TAG;
    const S2 = 2, w = 286, h = 134, c = makeCanvas(w * S2 + 8, h * S2 + 8), g = c.getContext('2d'); g.scale(S2, S2); g.translate(w / 2 + 2, h / 2 + 2);
    const ch = 30;
    g.beginPath(); g.moveTo(-w / 2 + ch, -h / 2); g.lineTo(w / 2 - ch, -h / 2); g.lineTo(w / 2, -h / 2 + ch); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.lineTo(-w / 2, -h / 2 + ch); g.closePath();
    g.fillStyle = '#FFF8EC'; g.fill();
    g.save(); g.clip(); g.globalAlpha = .45; g.fillStyle = g.createPattern(fibreTile(), 'repeat'); g.fillRect(-w, -h, 2 * w, 2 * h);
    g.globalAlpha = 1; const gr = g.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(150,110,60,.10)'); g.fillStyle = gr; g.fillRect(-w, -h, 2 * w, 2 * h); g.restore();
    g.strokeStyle = 'rgba(120,90,50,.35)'; g.lineWidth = 1.5; g.stroke();
    // reinforced hole
    g.fillStyle = '#C9A06C'; g.beginPath(); g.arc(0, -h / 2 + 24, 13, 0, 7); g.fill(); g.fillStyle = 'rgba(60,32,12,.75)'; g.beginPath(); g.arc(0, -h / 2 + 24, 6, 0, 7); g.fill();
    // « À PAYER » in marker, an orange stroke under it
    g.font = '800 54px Shantell'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INK; g.fillText('À PAYER', 0, h / 2 - 34);
    g.strokeStyle = ORANGE; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-100, h / 2 - 20); g.bezierCurveTo(-40, h / 2 - 25, 30, h / 2 - 15, 100, h / 2 - 22); g.stroke();
    TAG = { c, w, h, S2, hole: [0, -h / 2 + 24] }; return TAG;
  }

  // ---------- the face ----------
  function eye(x, y, mood, t, k = 1) {
    ctx.save(); ctx.translate(x, y);
    if (mood === 'content') {                                         // shut, happy: ^
      ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 6, 14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else if (mood === 'nervous' || mood === 'fleeing') {            // round, white, small darting pupils
      const r = mood === 'fleeing' ? 19 : 17, n = Math.floor(tq(t) * 15), dx = mood === 'fleeing' ? -6 : ([-5, 5, -4, 6, 0][n % 5]), dy = mood === 'fleeing' ? -2 : 2;
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.ellipse(0, 0, r * .86, r, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(dx, dy, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(dx - 2, dy - 2.5, 2, 0, 7); ctx.fill();
    } else {                                                          // proud: dark oval, lid half down, looking aside
      const blink = ((t + 9.7) % 2.9) < .1 ? .15 : 1;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 12, 17 * blink, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4, -5 * blink, 3.6 * blink, 0, 7); ctx.fill();
      if (blink === 1) { ctx.fillStyle = '#FAFCFD'; ctx.beginPath(); ctx.ellipse(0, -10, 16, 11, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.quadraticCurveTo(0, -9, 14, -4); ctx.stroke(); }
    }
    ctx.restore();
  }
  function face(st, t) {
    const m = st.mood, ex = 54, ey = -92;
    if (m === 'content') {
      ctx.fillStyle = 'rgba(255,140,150,.30)'; ctx.beginPath(); ctx.ellipse(-ex - 26, ey + 30, 22, 12, 0, 0, 7); ctx.ellipse(ex + 26, ey + 30, 22, 12, 0, 0, 7); ctx.fill();
    }
    eye(-ex, ey, m, t); eye(ex, ey, m, t + .37);
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
    if (m === 'proud') { ctx.beginPath(); ctx.moveTo(-ex - 18, ey - 34); ctx.quadraticCurveTo(-ex, ey - 46, -ex + 16, ey - 38); ctx.moveTo(ex - 16, ey - 30); ctx.lineTo(ex + 18, ey - 30); ctx.stroke(); }
    else if (m === 'nervous' || m === 'fleeing') { ctx.beginPath(); ctx.moveTo(-ex - 16, ey - 26); ctx.lineTo(-ex + 12, ey - 36); ctx.moveTo(ex + 16, ey - 26); ctx.lineTo(ex - 12, ey - 36); ctx.stroke(); }
    if (m === 'fleeing') { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(0, ey + 30, 9, 11, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    // sweat: a drop on the brow (nervous / fleeing), a tiny bead when frozen
    if (m === 'nervous' || m === 'fleeing' || st.frozen) {
      const big = !st.frozen, u = big ? (t * 1.3) % 1 : .2, x = 118, y = -104 + (big ? u * 60 : 0), r = big ? 11 : 6;
      ctx.save(); ctx.globalAlpha *= big ? Math.min(1, (1 - u) * 3) : 1;
      ctx.fillStyle = '#8CCBFF'; ctx.strokeStyle = 'rgba(30,90,160,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.8); ctx.quadraticCurveTo(x + r, y - r * .2, x, y + r); ctx.quadraticCurveTo(x - r, y - r * .2, x, y - r * 1.8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .1, r * .25, 0, 7); ctx.fill(); ctx.restore();
    }
  }

  // ---------- the burst: puffs trailing from the carton's mouth, « pouf » strips ----------
  function burstFx(st, t, L) {
    const b = st.burst; if (b <= .01) return;
    const hero = S.heroCarton(Math.max(0, t)); if (!hero) return;
    const g = S.cartonGeo(hero), mx = g.top[0], my = g.top[1] + 10;
    ctx.save();
    for (let i = 0; i < 6; i++) {                                     // the trail: smaller and smaller discs down to the mouth
      const f = (i + 1) / 7, x = mix(st.x, mx, f) + Math.sin(i * 2.1 + t * 5) * 14, y = mix(st.y + 60 * st.s, my, f), r = (70 - i * 8) * st.s * (.5 + .5 * b);
      ctx.globalAlpha = Math.min(1, b * 2.2) * (1 - f * .35);
      ctx.fillStyle = 'rgba(30,60,100,.16)'; ctx.beginPath(); ctx.arc(x + 4, y + 7, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#FBFCFD'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 1.5, Math.PI, Math.PI * 1.6); ctx.stroke();
    }
    // « pouf »: cut-paper burst strips around the cloud (outlined so they read on the cream table)
    const k = Math.min(1, b * 2.4), grow = 1 - b;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i + .5) / 9 * Math.PI + (R(i, 6) - .5) * .12, rx = 300 * st.s, ry = 200 * st.s;
      const d0 = 1.02 + .18 * grow, d1 = d0 + (.16 + .1 * R(i, 5)) * (.5 + .5 * b);
      const x0 = st.x + Math.cos(a) * rx * d0, y0 = st.y + 20 * st.s + Math.sin(a) * ry * d0, x1 = st.x + Math.cos(a) * rx * d1, y1 = st.y + 20 * st.s + Math.sin(a) * ry * d1;
      ctx.globalAlpha = k; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(60,32,12,.22)'; ctx.lineWidth = 13 * st.s; ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 6); ctx.lineTo(x1 + 3, y1 + 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,60,100,.55)'; ctx.lineWidth = 13 * st.s; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 9 * st.s; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
  }
  // ---------- the escape: an air jet behind the fleeing, deflating cloud ----------
  function jet(st, t, prev) {
    const df = st.deflate; if (df <= .01 || !prev) return;
    const vx = st.x - prev.x, vy = st.y - prev.y, l = Math.hypot(vx, vy) || 1, ux = -vx / l, uy = -vy / l;
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const ph = (t * 6 + i / 7) % 1, d = (60 + 200 * ph) * Math.max(.35, st.s), r = (10 + 26 * ph) * Math.max(.4, st.s) * 1.4;
      ctx.globalAlpha = (1 - ph) * .7 * Math.min(1, df * 4) * (1 - sst(kk(df, .85, 1)));
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(st.x + ux * d + (R(i, 7) - .5) * 30 * ph, st.y + uy * d + (R(i, 8) - .5) * 30 * ph, r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- the tag ----------
  function tagAndString(st, t, X, Y, sxx, syy, rot) {
    const ta = st.tag ? st.tag.a : 0; if (ta <= .02) return;
    const T0 = tagSprite(), side = 1 - sst(kk(st.x, 360, 470)), s = st.s;
    const lx = mix(-168, 168, side), ly = 104;                      // attach point on a lower lobe (local)
    const c = Math.cos(rot), sn = Math.sin(rot), ax = X + (lx * c - ly * sn) * sxx, ay = Y + (lx * sn + ly * c) * syy;
    const sw = st.tag.sw || 0, len = 108 * s, hx = ax + Math.sin(sw) * len * .8 + mix(-1, 1, side) * 20 * s, hy = ay + Math.cos(sw) * len;
    ctx.save(); ctx.globalAlpha *= ta;
    // string
    ctx.strokeStyle = 'rgba(60,32,12,.2)'; ctx.lineWidth = 4.5 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax + 3, ay + 6); ctx.quadraticCurveTo((ax + hx) / 2 + 3 - 18 * s, (ay + hy) / 2 + 18 * s, hx + 3, hy + 6); ctx.stroke();
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + hx) / 2 - 18 * s, (ay + hy) / 2 + 12 * s, hx, hy); ctx.stroke();
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(ax, ay, 5 * s, 0, 7); ctx.fill();
    // the card hangs from its hole
    const k = s, a = sw * 1.15;
    H.softShadow(hx + 22 * k, hy + (T0.h * .62 + 22) * k, T0.w * .55 * k, T0.h * .5 * k, .22);
    ctx.translate(hx, hy); ctx.rotate(a); ctx.scale(k, k);
    ctx.drawImage(T0.c, -(T0.w / 2 + 2), -(T0.h / 2 + 2) - T0.hole[1], T0.c.width / T0.S2, T0.c.height / T0.S2);
    // the string threads through the hole
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.restore();
  }

  // ---------- draw ----------
  function draw(st, t, L) {
    if (!st || st.a <= .003) return;
    let X = st.x, Y = st.y;
    // the last approach locks onto the margouillat's open mouth
    if (st.deflate > .6 && typeof K_mouth === 'function') { const m = K_mouth(t), b = sst(kk(st.deflate, .6, 1)); if (m) { X = mix(X, m.x, b); Y = mix(Y, m.y, b); } }
    const b = st.burst || 0, df = st.deflate || 0;
    const wob = df > 0 ? Math.sin(t * 38) * .09 * df : 0;
    const sxx = st.s * st.sx * (1 - .12 * b) * (1 + wob), syy = st.s * st.sy * (1 + .22 * b) * (1 - wob), rot = st.rot || 0;
    ctx.save(); ctx.globalAlpha *= st.a;
    if (!st.inside) H.softShadow(X + 70 * st.s, Y + 300 * st.s, 280 * st.s, 64 * st.s, .12 * (1 - df));
    burstFx({ ...st, x: X, y: Y }, t, L);
    jet({ ...st, x: X, y: Y }, t, df > 0 ? S.air(t - .04) : null);
    ctx.save(); ctx.translate(X, Y); ctx.rotate(rot); ctx.scale(sxx, syy);
    ctx.drawImage(sprite(), -OX, -OY, CW, CH);
    if (df > .02) {                                                   // deflating: the paper creases
      ctx.save(); lobesPath(ctx); ctx.clip(); ctx.globalAlpha *= Math.min(1, df * 1.6);
      ctx.strokeStyle = 'rgba(70,100,140,.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const x0 = -220 + 440 * R(i, 61), y0 = -120 + 240 * R(i, 62), a = (R(i, 63) - .5) * 2.4, l = 40 + 60 * R(i, 64);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * l * .5, y0 + Math.sin(a) * l * .5 + 8); ctx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); ctx.stroke(); }
      ctx.restore();
    }
    face(st, t);
    ctx.restore();
    tagAndString(st, t, X, Y, st.s * st.sx, st.s * st.sy, rot);
    ctx.restore();
  }
  return { draw, sprite, tagSprite, LOBES };
})();
function CA_air(st, t, L) { CA_AIR.draw(st, t, L); }

'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — M2 · THE BONZINI CARD (BZ_card). A.card → A.cta (15.80 → 20.60 on the defaults), screen space,
// called by 50_compose.js after the ring and before the type, with st = SCORE.card(t). No rush image on the card.
//   1  the KRAFT SHEET slides up from the bottom over the frozen r 9.62 (torn, fibred top edge + its contact shadow on
//      the photo), tilted a hair, settling flat; it covers the whole frame from A.card + .19 (contract: by A.card + .26).
//      Its own ease-out on the same window A.card → A.card + .25 (st.cover is in-out): that way the plate lands on kraft.
//   2  the glossy violet ENAMEL PLATE « BONZINI / TRADING CARGO » + the logo on a cream roundel (ep1 70_bonzini.js plate,
//      re-coloured with this film's violets): drops from above the lens (gravity), lands on A.plate (tonk) with a
//      squash, kraft dust, then a reflection crosses the enamel. The ONLY violet of the card (violet only with Bonzini).
//   3  the SENTENCE « TES COLIS VONT / DE CHINE À DOUALA. » printed in ink on the kraft (letterpress: a light lip under
//      the ink + a little starved ink), Satoshi 900 fitted to ≤ 900 px, the two lines pressed in one after the other.
//   4  the FELT ROUTE (G.card.route): a felt-drawn kraft carton (the parcel, in CHINE) → two felt-dash lanes → a felt
//      target + arrowheads (DOUALA): the AIR lane arches high, the SEA lane sags low and swells (« par bateau ou par
//      avion » drawn, not only written). The lanes draw on A.route → A.doua (ease-out: they start at once, close on
//      « Douala »). On « Chine » the hand-lettered « CHINE » and a die-cut AMBER BOAT sticker pop on the sea lane; on
//      « Douala » « DOUALA » + an ORANGE PLANE sticker on the air lane, and the target pulses. Boat and plane move on
//      slowly to the right until the cut. « Par bateau ou par avion. » is hand-written (write-on) from A.by.
//   5  the MARGOUILLAT (40_gecko.js via the score's geckoShim): K_gecko(t, SCORE.light(t), SCORE.gecko(t)) at G.gecko.
//   A slow 2 % push on the whole table from the plate to the cut. Exit = the score's hard cut at A.cta (guitar motif's
//   last note). Every time from SCORE.A / SCORE.T / st; every static look cached in sprites; no ctx.filter, no
//   Math.random; on-twos felt boil from n. Strings from SCORE.TEXTS() (ids plate, service, routeChine, routeDouala, by).
// =============================================================================================
const BZK = (function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, COL = S.COL;
  const kk = S.kk, ease = S.ease, eOut = S.easeOut, eIn = S.easeIn, backOut = S.backOut, cl = S.cl, lerpv = S.lerpv;
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`, HAND = (z, w = 800) => `${w} ${z}px Shantell`;
  const INK = COL.ink, CREAM = '#FBF6EC';
  const V = { top: '#C07DFF', mid: COL.violet, bot: COL.violetD, edge: '#3B0D78', emb: '#2A0866', cream: '#FFF8EC', sub: '#EEE2FF' };

  // ------------------------------------------------------------------ strings (SCORE.TEXTS, read once)
  let STR = null;
  const str = id => { if (!STR) { STR = {}; for (const r of S.TEXTS()) if (r[5] === 'BZ_card') STR[r[2]] = r[3]; } return STR[id] || ''; };

  // ------------------------------------------------------------------ sprite cache (ep1 70_bonzini.js)
  // draw(w, h) runs with the global ctx swapped to an offscreen canvas (every kit helper works), origin at (ox, oy).
  const CACHE = {};
  function sprite(key, w, h, draw, sc = 1, ox = w / 2, oy = h / 2) {
    const hit = CACHE[key]; if (hit) return hit;
    const c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc)), g = c.getContext('2d'), prev = ctx;
    ctx = g; try { g.scale(sc, sc); g.translate(ox, oy); draw(w, h); } finally { ctx = prev; }
    return (CACHE[key] = { c, w, h, ox, oy });
  }
  const blit = (s, x = 0, y = 0) => ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  /** a pre-blurred soft shadow of a rounded rect (shadowBlur once, at build time) */
  function shadowSprite(key, w, h, r, blur, col) {
    return sprite(key, w + blur * 5, h + blur * 5, () => {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetX = 20000; ctx.fillStyle = '#000';
      rrect(-w / 2 - 20000, -h / 2, w, h, r); ctx.fill(); ctx.restore();
    });
  }
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
  const poly = pts => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };

  // =========================================================================================== 1 · THE KRAFT SHEET
  const SW = W + 120, SH = H + 150, SEDGE = 46;                  // sprite: overscan 60 px a side; torn edge at local y = SEDGE
  const sheet = () => sprite('bzk_sheet', SW, SH, (w, h) => {
    const top = tornLine(0, SEDGE, w, SEDGE, 311, 6, 8);
    const body = () => { ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); for (const p of top) ctx.lineTo(p[0], p[1]); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); };
    body(); ctx.save(); ctx.clip();
    ctx.fillStyle = TEX.kraft; ctx.fillRect(0, 0, w, h);
    // the paper is never flat: large soft mottling (lighter / darker clouds)
    for (let i = 0; i < 46; i++) {
      const x = rnd(i * 4.7 + 1) * w, y = rnd(i * 3.3 + 2) * h, r = 120 + rnd(i * 5.9) * 260, lite = rnd(i * 2.1) > .5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, lite ? 'rgba(236,205,160,.12)' : 'rgba(120,80,40,.02)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // window light from the top-left (02_light day) + a warm vignette
    const lg = ctx.createRadialGradient(w * .22, 260, 40, w * .3, 520, 1500);
    lg.addColorStop(0, 'rgba(255,238,210,.26)'); lg.addColorStop(1, 'rgba(255,238,210,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(w / 2, h * .42, h * .30, w / 2, h * .5, h * .75);
    vg.addColorStop(0, 'rgba(70,38,14,0)'); vg.addColorStop(1, 'rgba(70,38,14,.34)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // the torn rim: exposed lighter fibres just under the edge, and hairs sticking out of it
    ctx.save(); body(); ctx.clip();
    ctx.strokeStyle = 'rgba(238,212,170,.85)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); for (const p of top) ctx.lineTo(p[0], p[1]); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(232,206,165,.75)'; ctx.lineWidth = 1.1;
    for (let i = 0; i < 260; i++) {
      const x = rnd(i * 1.37 + 9) * w, a = -Math.PI / 2 + (rnd(i * 2.71) - .5) * 1.6, l = 3 + rnd(i * 3.9) * 9;
      ctx.beginPath(); ctx.moveTo(x, SEDGE + 2); ctx.lineTo(x + Math.cos(a) * l, SEDGE + 2 + Math.sin(a) * l); ctx.stroke();
    }
  }, 1, 0, 0);
  /** c = 0 → 1 cover; top edge from below the frame to above it (fully covering from c ≈ .97) */
  const sheetY = c => lerpv(H + 70, -80, c);
  function drawSheet(c) {
    if (c <= 0) return;
    const yTop = sheetY(c), rot = -.028 * (1 - c);
    ctx.save(); ctx.translate(W / 2, yTop); ctx.rotate(rot);
    if (c < .999) {                                               // contact shadow on the photo above the edge
      const g = ctx.createLinearGradient(0, -90, 0, 8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = g; ctx.fillRect(-SW / 2, -90, SW, 98);
    }
    ctx.drawImage(sheet().c, -SW / 2, -SEDGE);
    ctx.restore();
  }

  // =========================================================================================== 2 · THE ENAMEL PLATE
  const PL = G.card.plate, PW = PL.x1 - PL.x0, PH = PL.y1 - PL.y0 - 12, PR = 34, PCX = (PL.x0 + PL.x1) / 2, PCY = (PL.y0 + PL.y1) / 2 - 5;
  function rivet(x, y) {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.5, '#D6CFE0'); g.addColorStop(1, '#6D6680');
    ctx.fillStyle = 'rgba(30,6,70,.45)'; circle(x + 1.5, y + 2.5, 10); ctx.fill();
    ctx.fillStyle = g; circle(x, y, 9.5); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,60,.7)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 5.5, y + 3); ctx.lineTo(x + 5.5, y - 3); ctx.stroke();
  }
  const plateSprite = () => sprite('bzk_plate', PW + 16, PH + 28, () => {
    ctx.fillStyle = V.edge; rrect(-PW / 2, -PH / 2 + 10, PW, PH, PR); ctx.fill();                         // steel edge (thickness)
    const g = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2);
    g.addColorStop(0, V.top); g.addColorStop(.45, V.mid); g.addColorStop(1, V.bot);
    ctx.fillStyle = g; rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.fill();
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    for (let i = 0; i < 1000; i++) { ctx.fillStyle = rnd(i * 3.3) > .5 ? 'rgba(255,255,255,.05)' : 'rgba(20,0,50,.07)'; ctx.fillRect(-PW / 2 + rnd(i * 1.7) * PW, -PH / 2 + rnd(i * 2.9) * PH, 2, 2); }
    const sh = ctx.createLinearGradient(0, PH / 2 - 64, 0, PH / 2); sh.addColorStop(0, 'rgba(25,0,60,0)'); sh.addColorStop(1, 'rgba(25,0,60,.30)');
    ctx.fillStyle = sh; ctx.fillRect(-PW / 2, PH / 2 - 64, PW, 64);
    ctx.restore();
    ctx.strokeStyle = '#F6EDDC'; ctx.lineWidth = 5; rrect(-PW / 2 + 16, -PH / 2 + 16, PW - 32, PH - 32, PR - 14); ctx.stroke();   // pinstripe
    // the logo on a cream enamel roundel
    const rx = -PW / 2 + 128, rr = Math.min(84, PH / 2 - 34);
    ctx.fillStyle = 'rgba(20,4,60,.40)'; circle(rx + 2, 6, rr + 2); ctx.fill();
    const rg = ctx.createRadialGradient(rx - 22, -26, 10, rx, 0, rr + 3); rg.addColorStop(0, '#FFFDF7'); rg.addColorStop(1, '#EEE3CE');
    ctx.fillStyle = rg; circle(rx, 0, rr); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.lineWidth = 3; circle(rx, 0, rr - 9); ctx.stroke();
    drawLogo(rx, 0, rr * 1.58);
    // lettering « BONZINI » / « TRADING CARGO » (TEXTS id plate, split after the first word), embossed: deep violet under cream
    const s = str('plate') || 'BONZINI TRADING CARGO', i = s.indexOf(' '), w1 = i > 0 ? s.slice(0, i) : s, w2 = i > 0 ? s.slice(i + 1) : '';
    const x0 = rx + rr + 26, x1 = PW / 2 - 40, tx = (x0 + x1) / 2, avail = x1 - x0;
    let z1 = 116; const m1 = measure(w1, SAT(z1), 5); if (m1 > avail) z1 = Math.floor(z1 * avail / m1);
    let z2 = 40, ls2 = 12; const m2 = measure(w2, SAT(z2), ls2); if (m2 > avail) z2 = Math.floor(z2 * avail / m2);
    const yb1 = 22, yb2 = yb1 + 56;
    text(w1, tx, yb1 + 5, { font: SAT(z1), align: 'center', color: V.emb, ls: 5 });
    text(w1, tx, yb1, { font: SAT(z1), align: 'center', color: V.cream, ls: 5 });
    if (w2) { text(w2, tx, yb2 + 3, { font: SAT(z2), align: 'center', color: V.emb, ls: ls2 }); text(w2, tx, yb2, { font: SAT(z2), align: 'center', color: V.sub, ls: ls2 }); }
    // glaze: the upper half catches the window light
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    const hg = ctx.createLinearGradient(0, -PH / 2, 0, -8); hg.addColorStop(0, 'rgba(255,255,255,.30)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-PW / 2, -PH / 2); ctx.lineTo(PW / 2, -PH / 2); ctx.lineTo(PW / 2, -34); ctx.bezierCurveTo(PW / 4, -4, -PW / 4, -16, -PW / 2, -6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; rrect(-PW / 2 + 3, -PH / 2 + 3, PW - 6, PH - 6, PR - 3); ctx.stroke();
    ctx.restore();
    for (const [x, y] of [[-PW / 2 + 34, -PH / 2 + 34], [PW / 2 - 34, -PH / 2 + 34], [-PW / 2 + 34, PH / 2 - 34], [PW / 2 - 34, PH / 2 - 34]]) rivet(x, y);
  }, 2);
  const plateShadow = () => shadowSprite('bzk_plateSh', PW, PH, PR, 22, 'rgba(48,22,6,1)');
  function drawPlate(t, st) {
    const p = st.plate; if (p <= 0) return;
    const air = 1 - p * p;                                         // height above the table: a gravity fall, lands at A.plate
    const d = t - A.plate, sq = d > 0 ? Math.exp(-d * 13) * Math.sin(d * 44) * .05 : 0;
    const sc = 1 + .22 * air, y = PCY - 700 * air, rot = -.01 - .05 * air;
    ctx.save(); ctx.globalAlpha *= .55 * (1 - .8 * air);           // cast shadow: far and soft in the air, tight on landing
    at(PCX + 10 + 90 * air, PCY + 20 + 210 * air, rot, 1 + .3 * air, 1 + .3 * air, () => blit(plateShadow()));
    ctx.restore();
    at(PCX, y, rot, sc * (1 + sq), sc * (1 - sq), () => {
      blit(plateSprite());
      const sw = kk(t, A.plate + .12, A.plate + .8);              // a reflection crosses the enamel once it has landed
      if (sw > 0 && sw < 1) {
        ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip(); ctx.globalCompositeOperation = 'screen';
        const x = -PW / 2 - 260 + (PW + 520) * ease(sw); ctx.transform(1, 0, -.45, 1, 0, 0);
        const g = ctx.createLinearGradient(x - 110, 0, x + 110, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.42, 'rgba(255,255,255,.22)'); g.addColorStop(.5, 'rgba(255,255,255,.55)'); g.addColorStop(.58, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 120, -PH, 240, PH * 2); ctx.restore();
      }
    });
    if (d >= 0 && d < .6) {                                        // landing: kraft dust kicked from under the plate
      const q = d / .6, e = 1 - Math.pow(1 - q, 2);
      for (let i = 0; i < 22; i++) {
        const side = i % 3 === 0 ? -1 : 1, x0 = PCX + (rnd(i * 4.1) - .5) * PW * .96, y0 = PCY + side * PH / 2;
        const vx = (x0 - PCX) / PW * 240 + (rnd(i * 7.7) - .5) * 90, vy = side * (40 + rnd(i * 2.3) * 100);
        ctx.fillStyle = `rgba(240,218,180,${(.8 * (1 - q)).toFixed(3)})`; circle(x0 + vx * e * .6, y0 + vy * e * .6, 2 + 4 * rnd(i * 5.3) * (1 - q * .5)); ctx.fill();
      }
    }
  }

  // =========================================================================================== 3 · THE SENTENCE
  const SV = G.card.service;
  let SVL = null;                                                  // the two lines, fitted once
  function serviceLayout() {
    if (SVL) return SVL;
    const lines = (str('service') || 'TES COLIS VONT|DE CHINE À DOUALA.').split('|');
    let z = SV.size; for (const l of lines) { const w = measure(l, SAT(SV.size), 1); if (w > 900) z = Math.min(z, Math.floor(SV.size * 900 / w)); }
    const lh = Math.round(z * 1.2), capH = z * .7, h = capH + lh * (lines.length - 1), y0 = (SV.y0 + SV.y1) / 2 - h / 2 - 14;
    return (SVL = { lines, z, base: lines.map((_, i) => Math.round(y0 + capH + i * lh)) });
  }
  /** one printed line: a light lip under the ink (letterpress), the ink, a little starved ink */
  function lineSprite(s, z) {
    const f = SAT(z), w = Math.ceil(measure(s, f, 1)) + 40, h = Math.ceil(z * 1.25);
    return sprite('bzk_ln_' + z + '_' + s, w, h, () => {
      text(s, 0, z * .35 + 3, { font: f, align: 'center', color: 'rgba(255,236,200,.42)', ls: 1 });
      text(s, 0, z * .35, { font: f, align: 'center', color: INK, ls: 1 });
      ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .2;
      for (let x = -w / 2; x < w / 2; x += 600) ctx.drawImage(TEX.starve, x, -h / 2, 600, 300);
      ctx.restore();
    }, 1.5);
  }
  function drawService(t) {
    const L = serviceLayout(), t0 = T.N5 - .05;
    L.lines.forEach((s, i) => {
      const k = kk(t, t0 + i * .1, t0 + i * .1 + .3); if (k <= 0) return;
      const e = eOut(k), sc = 1.06 - .06 * e;                      // pressed onto the paper
      ctx.save(); ctx.globalAlpha *= Math.min(1, k * 1.6);
      at(G.cx, L.base[i] - L.z * .35 + 22 * (1 - e), 0, sc, sc, () => blit(lineSprite(s, L.z)));
      ctx.restore();
    });
  }

  // =========================================================================================== 4 · THE FELT ROUTE
  const RB = G.card.route;
  const NL = { x: RB.x0 + 96, y: RB.y0 + 140 }, NR = { x: RB.x1 - 100, y: RB.y0 + 140 };   // carton (CHINE) · target (DOUALA)
  const LAB_Y = RB.y1 - 52;                                        // label baseline (52 px caps ≈ y 1090–1128)
  // two felt lanes from the carton to the target: the AIR lane arches high (the plane), the SEA lane sags low and waves
  // (the boat) — « par bateau ou par avion » drawn, not only written. Both draw together with st.route.
  let LANES = null;
  function mkLane(ctrl, wave) {
    let pts = curve(ctrl, 48);
    if (wave) {                                                    // a gentle swell along the normal (λ 58 px, ±5 px)
      const L0 = [0]; for (let i = 1; i < pts.length; i++) L0.push(L0[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const tot = L0[L0.length - 1];
      pts = pts.map((q, i) => { const j = Math.min(i, pts.length - 2), a = Math.atan2(pts[j + 1][1] - pts[j][1], pts[j + 1][0] - pts[j][0]);
        const o = wave * Math.sin(L0[i] / 58 * Math.PI * 2) * Math.sin(Math.PI * L0[i] / tot); return [q[0] - Math.sin(a) * o, q[1] + Math.cos(a) * o]; });
    }
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, L, tot: L[L.length - 1] };
  }
  function lanes() {
    if (LANES) return LANES;
    const xa = NL.x + 104, xb = NR.x - 60, y = NL.y;
    return (LANES = {
      air: mkLane([[xa, y - 24], [lerpv(xa, xb, .45), y - 118], [xb, y - 18]], 0),
      sea: mkLane([[xa, y + 30], [lerpv(xa, xb, .3), y + 62], [lerpv(xa, xb, .7), y + 62], [xb, y + 24]], 5),
    });
  }
  /** point + heading at arc length s along a lane */
  function atLen(R, s) {
    const lim = cl(s, 0, R.tot); let i = 1; while (i < R.pts.length - 1 && R.L[i] < lim) i++;
    const k = (lim - R.L[i - 1]) / Math.max(1e-6, R.L[i] - R.L[i - 1]), a = R.pts[i - 1], b = R.pts[i];
    return [lerpv(a[0], b[0], k), lerpv(a[1], b[1], k), Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  const atFrac = (R, f) => atLen(R, f * R.tot);
  /** felt dashes along a lane up to progress p (the last one grows in) + the arrowhead; boil on twos */
  function drawDashes(R, p, n, seed) {
    const lim = p * R.tot, b = Math.floor(n / 2) % 3, DL = 12, GAP = 12;
    if (lim <= 0) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    for (let k = 0, s = 2; s < lim; k++, s += DL + GAP) {
      const e = Math.min(s + DL * (.85 + .3 * rnd(k * 3.1 + seed)), lim);
      const q0 = atLen(R, s), qm = atLen(R, (s + e) / 2), q1 = atLen(R, e);
      const j = (rnd(k * 7.7 + b * 13.1 + seed) - .5) * 1.5, jj = (rnd(k * 5.3 + b * 9.7 + seed) - .5) * 1.5;
      ctx.lineWidth = 6.5 + rnd(k * 2.9 + seed) * 1.5;
      ctx.beginPath(); ctx.moveTo(q0[0] + j, q0[1] + jj); ctx.quadraticCurveTo(qm[0], qm[1], q1[0] - jj * .5, q1[1] + j * .5); ctx.stroke();
    }
    ctx.restore();
    const ah = kk(p, .96, 1);
    if (ah > 0) {
      const [x, y, a] = atLen(R, R.tot), L = 22 * eOut(ah), j = (rnd(b * 3.3 + 41 + seed) - .5) * 1.4;
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - L * Math.cos(a - .6) + j, y - L * Math.sin(a - .6)); ctx.lineTo(x, y); ctx.lineTo(x - L * Math.cos(a + .6), y - L * Math.sin(a + .6) + j); ctx.stroke();
      ctx.restore();
    }
  }
  /** the parcel, felt-drawn in iso (kraft faces, amber tape, cream label without text, ink outline); boil index b */
  function cartonSketch(b) {
    const J = (i, s = 1.3) => (rnd(i * 5.17 + b * 17.3) - .5) * 2 * s, P = (x, y, i) => [x + J(i), y + J(i + 50)];
    const a = P(-70, -12, 1), bb = P(-32, -46, 2), c = P(72, -46, 3), d = P(34, -12, 4), e = P(-70, 60, 5), f = P(34, 60, 6), g = P(72, 26, 7);
    ctx.save(); ctx.globalAlpha *= .32; ctx.fillStyle = 'rgba(60,30,8,1)';                        // cast shadow (window top-left)
    ctx.translate(12, 14); poly([a, bb, c, g, f, e]); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#EBCB9B'; poly([a, bb, c, d]); ctx.fill();                                 // top
    ctx.fillStyle = '#D3A66B'; poly([a, d, f, e]); ctx.fill();                                  // front
    ctx.fillStyle = '#AC7C46'; poly([d, c, g, f]); ctx.fill();                                  // side
    const mid = (u, v, k = .5) => [lerpv(u[0], v[0], k), lerpv(u[1], v[1], k)];
    ctx.fillStyle = 'rgba(243,167,69,.92)';                                                      // amber tape on the flap seam, down the side
    const t1 = mid(a, bb, .42), t2 = mid(a, bb, .62), t3 = mid(d, c, .62), t4 = mid(d, c, .42);
    poly([t1, t2, t3, t4]); ctx.fill();
    poly([t4, t3, mid(f, g, .62), mid(f, g, .42)]); ctx.fill();
    ctx.fillStyle = CREAM; poly([P(-56, 8, 8), P(4, 8, 9), P(4, 42, 10), P(-56, 42, 11)]); ctx.fill();   // label (lines only)
    ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-48, 17 + i * 9); ctx.lineTo(-48 + [44, 30, 38][i], 17 + i * 9); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 5.5; ctx.lineJoin = 'round';
    const seg = (u, v) => { ctx.beginPath(); ctx.moveTo(u[0], u[1]); ctx.lineTo(v[0], v[1]); ctx.stroke(); };
    seg(a, bb); seg(bb, c); seg(c, d); seg(d, a); seg(a, e); seg(e, f); seg(f, g); seg(g, c); seg(d, f);
  }
  /** felt target at DOUALA: a loop drawn with overshoot (k = 0 → 1) around a dot; pulse = 0 → 1 → 0 bump */
  function target(k, n, pulse) {
    if (k <= 0) return;
    const b = Math.floor(n / 2) % 3, a0 = -2.2, sweep = Math.PI * 2.18 * eOut(k), sc = 1 + .14 * pulse;
    ctx.save(); ctx.scale(sc, sc);
    ctx.save(); ctx.globalAlpha *= .4 * Math.min(1, k * 2); ctx.fillStyle = CREAM; circle(0, 0, 38); ctx.fill(); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 6.5; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const u = i / 48, ang = a0 + sweep * u, r = 44 + 5 * u + (rnd(i * 1.9 + b * 7.1) - .5) * 1.4;
      const x = Math.cos(ang) * r * 1.08, y = Math.sin(ang) * r * .9; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    if (k > .55) { ctx.fillStyle = INK; circle(0, 0, 11 * eOut(kk(k, .55, 1))); ctx.fill(); }
    ctx.restore();
  }
  // ---- die-cut stickers (cut paper: the shape, a cream border, a soft contact shadow), facing right
  function boatShape(fillPass) {
    // hull (bow right), deck containers, the bridge at the stern
    const hull = [[-60, 2], [62, 2], [47, 30], [-52, 30]];
    const boxes = [[-36, -18, 21, 20], [-13, -18, 21, 20], [10, -18, 21, 20], [33, -18, 19, 20], [-24, -36, 21, 18], [-1, -36, 21, 18]];
    const bridge = [-58, -40, 18, 42];
    if (fillPass === 'base') {
      poly(hull); ctx.fill(); ctx.stroke();
      for (const r of boxes) { ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3] + 2); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.rect(...bridge); ctx.fill(); ctx.stroke();
      return;
    }
    ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
    ctx.fillStyle = COL.amber; poly(hull); ctx.fill();
    ctx.save(); poly(hull); ctx.clip(); ctx.fillStyle = '#C97A1E'; ctx.fillRect(-70, 21, 140, 12); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-70, 3, 140, 4); ctx.restore();
    poly(hull); ctx.stroke();
    boxes.forEach((r, i) => { ctx.fillStyle = ['#F8C77A', '#FBE3B8', '#E99A35', '#F8C77A', '#E99A35', '#FBE3B8'][i]; ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.rect(...bridge); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-55, -33, 12, 6);
    ctx.fillStyle = INK; for (let i = 0; i < 4; i++) { circle(-34 + i * 22, 13, 2.6); ctx.fill(); }   // portholes
  }
  function planePath() {
    // top view, nose right (kit iconPlane, redrawn ×2.1 with a rounder nose)
    ctx.beginPath();
    ctx.moveTo(58, 0); ctx.quadraticCurveTo(56, -7, 44, -8); ctx.lineTo(10, -8); ctx.lineTo(-14, -46); ctx.lineTo(-28, -46); ctx.lineTo(-16, -8);
    ctx.lineTo(-40, -7); ctx.lineTo(-52, -24); ctx.lineTo(-61, -24); ctx.lineTo(-55, 0); ctx.lineTo(-61, 24); ctx.lineTo(-52, 24); ctx.lineTo(-40, 7);
    ctx.lineTo(-16, 8); ctx.lineTo(-28, 46); ctx.lineTo(-14, 46); ctx.lineTo(10, 8); ctx.lineTo(44, 8); ctx.quadraticCurveTo(56, 7, 58, 0); ctx.closePath();
  }
  function stickerSprite(key, w, h, base, face) {
    return sprite(key, w, h, () => {
      ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.38)'; ctx.shadowBlur = 9; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 7;
      ctx.fillStyle = CREAM; ctx.strokeStyle = CREAM; ctx.lineWidth = 18; ctx.lineJoin = 'round'; base(); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.lineWidth = 19.5; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = 'destination-over'; base(); ctx.restore();
      face();
    }, 2);
  }
  const boatSprite = () => stickerSprite('bzk_boat', 170, 120, () => boatShape('base'), () => boatShape('face'));
  const planeSprite = () => stickerSprite('bzk_plane', 160, 140, () => { planePath(); ctx.fill(); ctx.stroke(); }, () => {
    ctx.lineJoin = 'round'; ctx.fillStyle = COL.orange; planePath(); ctx.fill();
    ctx.save(); planePath(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-70, -60, 140, 56); ctx.fillStyle = 'rgba(120,20,0,.22)'; ctx.fillRect(-70, 4, 140, 60); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 3.5; planePath(); ctx.stroke();
    ctx.fillStyle = CREAM; rrect(28, -4, 16, 8, 4); ctx.fill();                                  // cockpit
  });
  function label(s, x, k, pop) {
    if (k <= 0) return;
    const sc = .7 + .3 * pop;
    ctx.save(); ctx.globalAlpha *= k;
    at(x, LAB_Y, -.015, sc, sc, () => {
      text(s, 0, 2.5, { font: HAND(RB.size), align: 'center', color: 'rgba(255,236,200,.35)', ls: 2 });
      text(s, 0, 0, { font: HAND(RB.size), align: 'center', color: INK, ls: 2 });
    });
    ctx.restore();
  }
  function drawRoute(t, n, st0) {
    // the felt starts at once and slows into the target (ease-out sine on the score's window A.route → A.doua; st.route
    // is in-out, which left the carton alone for a second): the lanes are complete exactly on « Douala »
    const st = { ...st0, route: Math.sin(Math.PI / 2 * kk(t, A.route, A.doua)) };
    const b = Math.floor(n / 2), LN = lanes();
    const ck = backOut(kk(t, A.route - .2, A.route + .12));       // the carton is set down as the felt starts
    if (ck > 0) at(NL.x, NL.y, -.03, 1.12 * ck, 1.12 * ck, () => cartonSketch(b % 3));
    drawDashes(LN.air, st.route, n, 0); drawDashes(LN.sea, st.route, n, 50);
    const tk = kk(st.route, .86, 1);                               // the target closes as the dashes arrive
    if (tk > 0) at(NR.x, NR.y, 0, 1, 1, () => target(tk, n, Math.sin(Math.PI * kk(t, A.doua, A.doua + .32))));
    label(str('routeChine') || 'CHINE', NL.x, st.chine, backOut(kk(t, A.chine - .05, A.chine + .25)));
    label(str('routeDouala') || 'DOUALA', NR.x, st.douala, backOut(kk(t, A.doua - .05, A.doua + .25)));
    // the boat sails the sea lane from « Chine », the plane flies the air lane from « Douala »; both move on to the cut
    if (st.boat > 0) {
      const [x, y, a] = atFrac(LN.sea, Math.min(.3 + .14 * kk(t, A.chine, A.cta), st.route)), bob = Math.sin(t * 5.2) * 2.5, s = Math.max(0, st.boat) * 1.05;
      at(x, y - 24 + bob, a * .5 + Math.sin(t * 4.1) * .035, s, s, () => blit(boatSprite()));
    }
    if (st.plane > 0) {
      const [x, y, a] = atFrac(LN.air, Math.min(.5 + .16 * kk(t, A.doua, A.cta), st.route)), bob = Math.sin(t * 3.3) * 2.5, s = Math.max(0, st.plane) * .95;
      at(x, y + bob, a, s, s, () => blit(planeSprite()));
    }
  }
  /** « Par bateau ou par avion. » hand-written (left → right write-on) */
  function drawBy(t, st) {
    if (st.by <= 0) return;
    const s = str('by') || 'Par bateau ou par avion.', f = HAND(G.card.by.size, 700), w = measure(s, f), x0 = G.cx - w / 2, y = G.card.by.y1 - 16;
    const k = ease(kk(t, A.by, A.by + .6));
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 16, y - 70, (w + 32) * k, 100); ctx.clip();
    text(s, G.cx, y + 2.5, { font: f, align: 'center', color: 'rgba(255,236,200,.35)' });
    text(s, G.cx, y, { font: f, align: 'center', color: INK });
    ctx.restore();
  }

  // =========================================================================================== THE CARD
  function card(t, n, st) {
    const cover = 1 - Math.pow(1 - kk(t, A.card, A.card + .25), 3);   // ease-out: full cover from ≈ A.card + .19
    const push = 1 + .02 * ease(kk(t, A.plate, A.cta));              // a slow push on the table
    ctx.save();
    ctx.translate(G.cx, 820); ctx.scale(push, push); ctx.translate(-G.cx, -820);
    const ride = sheetY(cover) - sheetY(1);                          // what sits on the sheet rides in with it
    drawSheet(cover);
    if (ride < H) {
      ctx.save(); ctx.translate(0, ride);
      drawService(t);
      drawRoute(t, n, st);
      drawBy(t, st);
      if (typeof K_gecko === 'function') K_gecko(t, S.light(t), S.gecko(t));
      ctx.restore();
    }
    drawPlate(t, st);
    ctx.restore();
  }
  return { card, lanes, NL, NR, LAB_Y };
})();

/** M2 — the kraft Bonzini card, A.card ≤ t < A.cta (st = SCORE.card(t)); see the header above */
function BZ_card(t, n, st) { return BZK.card(t, n, st); }

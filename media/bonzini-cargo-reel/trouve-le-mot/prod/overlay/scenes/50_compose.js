'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — composition: the draw order, calls the modules when they exist, else readable stand-ins.
//   1  RU_rush(t, n)            05_rush.js   the real footage (camera, smear, freeze, zoom layer, shading)
//   2  RG_ring(t, n, st)        30_ring.js   (module M1) st = SCORE.ring(t): violet felt ellipse around the label +
//                                            the arrow from the answer's BONZINI to it; the thin following ellipses
//   3  BZ_card(t, n, st)        72_card.js   (module M2) st = SCORE.card(t): the kraft Bonzini card 15.80 → 20.60
//   4  TY_draw(t, n)            60_type.js   every on-screen text not taken over by a module
//   5  CH_chrono(t, n, st)      20_chrono.js (module M1) st = SCORE.chrono(t): ring + digit + « secondes »
//   (grain over everything: RU_grain(n), called by the engine once per frame)
// Read MODULES.md for the exact APIs. The stand-ins below are deliberately plain.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, kk = S.kk, ease = S.ease, easeOut = S.easeOut, COL = S.COL;
  const has = n => typeof window[n] === 'function';
  const mix = (c1, c2, k) => { const a = hexRgb(c1), b = hexRgb(c2); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };

  const FB = {
    // ---- chrono: amber ring emptying, digit, « secondes » ----
    chrono(t, n, st) {
      if (st.a <= 0) return;
      const col = mix(COL.amber, COL.orange, st.warm), R = st.r - 7, bumpS = 1 + .08 * Math.exp(-st.tickAge * 12) + .18 * st.pulse;
      ctx.save(); ctx.globalAlpha *= st.a; ctx.translate(0, st.dy);
      ctx.fillStyle = 'rgba(10,6,16,.55)'; ctx.beginPath(); ctx.arc(st.cx, st.cy, st.r + 4, 0, 7); ctx.fill();
      ctx.lineWidth = 14; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(st.cx, st.cy, R, 0, 7); ctx.stroke();
      if (st.ring > .002) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(st.cx, st.cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st.ring); ctx.stroke(); }
      ctx.save(); ctx.beginPath(); ctx.arc(st.cx, st.cy, R - 8, 0, 7); ctx.clip();
      ctx.translate(st.cx, st.cy); ctx.scale(bumpS, bumpS);
      ctx.font = `900 ${st.digitSize}px Satoshi`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = st.warm > .5 ? COL.orange : COL.white;
      const d0 = Math.floor(st.digit + 1e-6), fr = st.digit - d0, H_ = st.digitSize * 1.05;
      if (st.roll && fr > 1e-3) { ctx.fillText(String(d0), 0, 39 - fr * H_); ctx.fillText(String(Math.min(9, d0 + 1)), 0, 39 + (1 - fr) * H_); }
      else ctx.fillText(String(Math.round(st.digit)), 0, 39);
      ctx.restore();
      ctx.font = `700 ${st.label.size}px Satoshi`; ctx.textAlign = 'center'; ctx.fillStyle = COL.white; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12;
      ctx.fillText('secondes', st.cx, st.label.y1 - 8);
      ctx.restore();
    },
    // ---- ring: felt ellipse around the label (+ halo), arrow from the answer's BONZINI ----
    ring(t, n, st) {
      if (st.a <= 0 || !st.box) return;
      const b = st.box, rx = b.w * .5 + Math.max(26, b.w * .13), ry = b.h * .5 + Math.max(18, b.h * .2), a0 = -Math.PI * .62;
      ctx.save(); ctx.globalAlpha *= st.a; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = COL.violet; ctx.lineWidth = st.lw; ctx.shadowColor = `rgba(169,71,254,${(.85 * st.halo).toFixed(3)})`; ctx.shadowBlur = 26;
      if (st.draw > 0) { ctx.beginPath(); ctx.ellipse(b.cx, b.cy, rx, ry, -.05, a0, a0 + Math.PI * 2.08 * st.draw); ctx.stroke(); }
      ctx.restore();
      const ar = st.arrow; if (!ar || ar.p <= 0 || !has('TY_wordBox')) return;
      const wb = TY_wordBox('BONZINI'); if (!wb) return;
      const p0 = [wb.x + wb.w + 14, wb.y + wb.h * .55], p2 = [b.cx + rx * .72, b.cy - ry * .72], p1 = [1010, (p0[1] + p2[1]) / 2 + 40];
      ctx.save(); ctx.globalAlpha *= ar.a; ctx.strokeStyle = COL.violet; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10;
      const N = 40, m = Math.max(1, Math.round(N * ar.p)), q = k => { const u = k / N; return [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]]; };
      ctx.beginPath(); ctx.moveTo(...p0); for (let k = 1; k <= m; k++) ctx.lineTo(...q(k)); ctx.stroke();
      if (ar.p > .9) { const e = q(N), e0 = q(N - 3), ang = Math.atan2(e[1] - e0[1], e[0] - e0[0]), L = 30 * kk(ar.p, .9, 1);
        ctx.beginPath(); ctx.moveTo(e[0] - L * Math.cos(ang - .5), e[1] - L * Math.sin(ang - .5)); ctx.lineTo(...e); ctx.lineTo(e[0] - L * Math.cos(ang + .5), e[1] - L * Math.sin(ang + .5)); ctx.stroke(); }
      ctx.restore();
    },
    // ---- the kraft card (stand-in): kraft sheet, violet plate, service line, route, CHINE / DOUALA, by-line, margouillat ----
    card(t, n, st) {
      const C_ = G.card, y = H * (1 - st.cover);
      ctx.save(); ctx.fillStyle = TEX.kraft; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = -8; ctx.fillRect(0, y, W, H - y + 10); ctx.restore();
      if (st.cover < .98) return;
      const pl = C_.plate, dy = -320 * (1 - ease(st.plate));
      if (st.plate > 0) {
        ctx.save(); ctx.translate(0, dy); ctx.shadowColor = 'rgba(40,20,10,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
        ctx.fillStyle = COL.violetD; rrect(pl.x0, pl.y0, pl.x1 - pl.x0, pl.y1 - pl.y0, 30); ctx.fill(); ctx.shadowColor = 'transparent';
        drawLogo(G.cx, pl.y0 + 82, 110);
        ctx.font = '900 66px Satoshi'; ctx.fillStyle = COL.white; ctx.textAlign = 'center'; ctx.fillText('BONZINI TRADING CARGO', G.cx, pl.y1 - 52);
        ctx.restore();
      }
      if (st.service > 0) {
        ctx.save(); ctx.globalAlpha *= st.service; ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
        const lines = ['TES COLIS VONT', 'DE CHINE À DOUALA.']; let z = C_.service.size; ctx.font = `900 ${z}px Satoshi`;
        const wm = Math.max(...lines.map(l => ctx.measureText(l).width)); if (wm > 900) z = Math.floor(z * 900 / wm); ctx.font = `900 ${z}px Satoshi`;
        ctx.fillText(lines[0], G.cx, C_.service.y0 + z * .95); ctx.fillText(lines[1], G.cx, C_.service.y0 + z * 2.0); ctx.restore();
      }
      const R = C_.route, ry = R.carton.y;
      if (st.route > 0) {
        ctx.save(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 7; ctx.setLineDash([2, 22]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(R.carton.x + 70, ry); ctx.lineTo(R.carton.x + 70 + (R.douala.x - R.carton.x - 70) * st.route, ry); ctx.stroke(); ctx.restore();
        at(R.carton.x, ry, -.05, 1, 1, () => carton(110, 90, { seed: 3 }));
      }
      ctx.save(); ctx.font = `800 ${R.size}px Satoshi`; ctx.fillStyle = COL.ink; ctx.textAlign = 'center';
      if (st.chine > 0) { ctx.globalAlpha = st.chine; ctx.fillText('CHINE', R.chine.x, R.chine.y + 30); }
      if (st.douala > 0) { ctx.globalAlpha = st.douala; ctx.fillText('DOUALA', R.douala.x, R.douala.y + 30); }
      ctx.restore();
      if (st.boat > 0) at(R.chine.x, ry - 70, 0, 1.6 * st.boat, 1.6 * st.boat, () => iconShip(COL.amber));
      if (st.plane > 0) at(R.douala.x, ry - 70, -.15, 1.5 * st.plane, 1.5 * st.plane, () => iconPlane(COL.orange));
      if (st.by > 0) { ctx.save(); ctx.globalAlpha *= st.by; ctx.font = `700 ${C_.by.size}px Satoshi`; ctx.fillStyle = COL.ink; ctx.textAlign = 'center'; ctx.fillText('Par bateau ou par avion.', G.cx, C_.by.y1 - 14); ctx.restore(); }
      if (has('K_gecko')) K_gecko(t, S.light(t), S.gecko(t));
    },
  };

  registerScene({ id: 'compose', z: 10, draw(t, n) {
    window.__t = t;
    if (has('RU_rush')) RU_rush(t, n);
    const rg = S.ring(t); if (rg) (has('RG_ring') ? RG_ring : FB.ring)(t, n, rg);
    const cd = S.card(t); if (cd) (has('BZ_card') ? BZ_card : FB.card)(t, n, cd);
    if (has('TY_draw')) TY_draw(t, n);
    // the chrono is UI: its state is taken at the frame's own time (n / FPS), so a digit never ghosts across a tic
    const tq = n / S.FPS, ch = S.chrono(tq); if (ch) (has('CH_chrono') ? CH_chrono : FB.chrono)(tq, n, ch);
  } });
  window.COMPOSE_FB = FB;            // the stand-ins, for the modules' side-by-side checks
})();

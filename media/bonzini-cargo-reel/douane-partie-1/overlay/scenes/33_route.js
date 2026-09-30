'use strict';
// =============================================================================================
// 33_route — ⑦ LA ROUTE DU SOIR (world x ≈ 6385…7650, X.route = 7150), start of S25.
//  Always there (world): an ochre paper road laid on the stage floor from the barrier to Mboppi; behind it, on two kraft
//          stilts, the real print « Douala vu du ciel » (douala_satellite, duotone amber, credited) with the same ochre road
//          glued across it like a map route, ending on a violet pin at the city; a roadside milestone « DOUALA / MBOPPI → ».
//          The print sits between x 6745 and 7605 so it is out of frame both in the S24 shot (barrier) and at the stall (S25+).
//          The violet thread (13_stage) keeps running along the front edge of the road.
//  S24 → S25 (camera travel to the road, evening light from 14_backdrop): Junior's truck — the same truck and container as at
//          the scanner and the barrier, as a small paper cut-out, the margouillat riding on the roof — drives ALONG THE ROAD
//          GLUED ON THE PRINT, headlights on, and parks on the violet pin (Mboppi, Douala) on « Mboppi »: lights off. It stays
//          there (the S30 crane finds it on the map). No full-size truck on the floor road: nothing to clash with the stall.
// z 19 (world: road) · 21 (world: print on stilts + the truck token on its map route) · 36 (world: milestone, foreground)
// =============================================================================================
(() => {
  const Y = h => GROUND - h;
  const ROAD = { x0: 6385, x1: 7650, y0: GROUND - 30, y1: GROUND + 42 };
  const PRN = { x: 7175, w: 860, h0: 280, h1: 960 };                   // standing print (world), stilts under it
  const BORNE = { x: 7450, w: 300 };                                   // right of the road, in front of the print's lower-right corner
  const TOK = .24;                                                     // truck token scale on the map
  const visX = (x0, x1, t, m = 140) => { const c = camAt(t); if (Math.abs(c.r) > .01) return true; const hw = W / 2 / c.z + m; return x1 > c.x - hw && x0 < c.x + hw; };
  const cont = () => window.A20_CONT || { w: 680, h: 360, depth: 46, top: 18, deck: 110, color: '#2E6B8A' };

  let K = null;
  function keys() {
    if (K) return K;
    const k = { show: se('S24', -.5), go0: ss('S25', -1.9), go1: tw('S25', 'Mboppi', .1) };
    k.lights0 = k.go0 + .7; k.lights1 = k.lights0 + .5; k.off = k.go1 + .1;
    return (K = k);
  }
  let RP = null;                                                       // the map route (print-local), with cumulative lengths
  function route(w, h) {
    if (RP) return RP;
    const P = curve([[-w * .47, h * .33], [-w * .3, h * .27], [-w * .12, h * .29], [0, h * .17], [w * .1, h * .03], [w * .19, -h * .09], [w * .25, -h * .2]], 12), L = [0];
    for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    return (RP = { P, L, tot: L[L.length - 1] });
  }
  function along(R, u) {                                               // point + heading at fraction u of the route
    const d = clamp(u) * R.tot; let i = 1; while (i < R.L.length - 1 && R.L[i] < d) i++;
    const a = R.P[i - 1], b = R.P[i], k = (d - R.L[i - 1]) / Math.max(1e-6, R.L[i] - R.L[i - 1]);
    return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  // ---------- the road on the floor ---------------------------------------------------------------
  function road() {
    const { x0, x1, y0, y1 } = ROAD;
    const top = tornLine(x0, y0, x1, y0, 31, 3, 18), bot = tornLine(x1, y1, x0, y1, 37, 3, 18);
    withShadow(4, () => { ctx.fillStyle = '#D9A04A'; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,236,190,.35)'; ctx.fillRect(x0, y0 + 2, x1 - x0, 6);
    ctx.fillStyle = 'rgba(120,70,20,.18)'; for (let i = 0; i < 60; i++) ctx.fillRect(x0 + rnd(i * 3.3) * (x1 - x0), y0 + 10 + rnd(i * 5.1) * (y1 - y0 - 20), 10 + rnd(i) * 14, 2);
    ctx.fillStyle = 'rgba(255,253,247,.8)'; for (let x = x0 + 50; x < x1 - 60; x += 120) ctx.fillRect(x, (y0 + y1) / 2 - 3, 60, 6);
  }
  // ---------- the print « Douala vu du ciel » with the map route ----------------------------------
  function mapRoute(w, h) {                                            // ochre route glued on the print, local coords (centre)
    const P = route(w, h).P;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(40,20,5,.35)'; ctx.lineWidth = 34; ctx.translate(3, 5); ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.translate(-3, -5);
    ctx.strokeStyle = '#E3A94F'; ctx.lineWidth = 30; ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,253,247,.85)'; ctx.lineWidth = 4; ctx.setLineDash([16, 14]); ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  function mapPin(w, h) {                                              // violet pin at the city (Mboppi is a market of Douala)
    const P = route(w, h).P, e = P[P.length - 1];
    at(e[0], e[1], 0, 1.6, 1.6, () => { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(0, -30, 22, Math.PI * .15, Math.PI * .85, true); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -32, 9, 0, 7); ctx.fill(); });
  }
  function print(t, n) {
    const w = PRN.w, h = PRN.h1 - PRN.h0, cy = Y((PRN.h0 + PRN.h1) / 2);
    for (const sx of [PRN.x - w * .38, PRN.x + w * .38]) { ctx.fillStyle = C.kraftD; ctx.fillRect(sx - 12, Y(PRN.h0 + 30), 24, PRN.h0 + 30 - 36);
      ctx.fillStyle = 'rgba(255,240,210,.3)'; ctx.fillRect(sx - 8, Y(PRN.h0 + 30), 5, PRN.h0 - 10); }
    at(PRN.x, cy, .012, 1, 1, () => {
      photoPrint('douala_satellite', w, h, { fx_kind: 'duo', cols: DUO.amber, zoom: 1.35, fx: .58, fy: .44, border: 16, lift: 10,
        scan: () => mapRoute(w, h) });
      creditTag(CREDIT.douala_satellite, w / 2 - 8, -h / 2 + 44, { size: 24 });
      token(t, n, w, h);
      mapPin(w, h);
    });
  }
  // ---------- the milestone « DOUALA / MBOPPI → » --------------------------------------------------
  function borne() {
    const x = BORNE.x, w = BORNE.w, H0 = 24, HC = 262, HT = 440;
    ctx.fillStyle = '#8F877C'; rrect(x - w / 2 - 18, Y(H0), w + 36, H0 + 4, 5); ctx.fill();
    const shape = () => { ctx.beginPath(); ctx.moveTo(x - w / 2, Y(H0)); ctx.lineTo(x - w / 2, Y(HT - 90)); ctx.quadraticCurveTo(x - w / 2, Y(HT), x, Y(HT)); ctx.quadraticCurveTo(x + w / 2, Y(HT), x + w / 2, Y(HT - 90)); ctx.lineTo(x + w / 2, Y(H0)); ctx.closePath(); };
    withShadow(12, () => { ctx.fillStyle = '#FBF8F1'; shape(); ctx.fill(); });
    ctx.save(); shape(); ctx.clip(); ctx.fillStyle = DC.red; ctx.fillRect(x - w / 2, Y(HT) - 4, w, HT - HC + 4);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x - w / 2, Y(HT) - 4, 16, HT - H0); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(x + w / 2 - 22, Y(HT), 22, HT - H0); ctx.restore();
    const f1 = font(FF.stencil, 86, 900), s1 = Math.min(86, 86 * (w - 40) / measure('DOUALA', f1, 4));
    text('DOUALA', x, Y((HT + HC) / 2 - 8) + s1 * .36, { font: font(FF.stencil, s1, 900), align: 'center', color: '#FFF8E8', ls: 4 });
    const s2 = Math.min(86, 86 * (w - 40) / measure('MBOPPI', f1, 4));
    text('MBOPPI', x, Y(HC - 76) + s2 * .36, { font: font(FF.stencil, s2, 900), align: 'center', color: C.ink, ls: 4 });
    ctx.strokeStyle = C.ink; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';                            // arrow →
    const ay = Y(84); ctx.beginPath(); ctx.moveTo(x - 90, ay); ctx.lineTo(x + 80, ay); ctx.moveTo(x + 44, ay - 34); ctx.lineTo(x + 84, ay); ctx.lineTo(x + 44, ay + 34); ctx.stroke();
  }

  // ---------- Junior's truck as a paper token on the map route (S24 end → S25) ---------------------
  function token(t, n, w, h) {
    const k = keys(); if (t < k.show) return;
    const R = route(w, h), u = eInOutCubic(prog(t, k.go0, k.go1)) * .84, p = along(R, u), p2 = along(R, Math.min(1, u + .04));   // parks just short of the pin
    const moving = t > k.go0 && t < k.go1, ang = clamp(Math.atan2(p2.y - p.y, p2.x - p.x), -.4, .4) * (1 - .75 * eInOutCubic(prog(t, k.go1 - .15, k.go1 + .35)));
    const bob = moving ? -Math.abs(Math.sin(stepT(n) * 14)) * 6 : 0, A = cont();
    at(p.x, p.y + bob - 6, ang, TOK, TOK, () => {
      ctx.fillStyle = 'rgba(40,20,5,.35)'; ctx.beginPath(); ctx.ellipse(110, 10, 500, 26, 0, 0, 7); ctx.fill();          // paper cut-out shadow on the print
      if (typeof window.D28_truck === 'function') window.D28_truck({ n, spin: u * 40, idle: !moving });
      else { truck(u * 4, { box: 'rgba(0,0,0,0)', cab: '#E2B04A' }); ctx.fillStyle = A.color; ctx.fillRect(-A.w / 2, -A.deck - A.h, A.w, A.h); }
      if (typeof window.B44_lizard === 'function') at(70, -A.deck - A.h - A.top * .5, 0, 2.2, 2.2, () => window.B44_lizard(72, { n }));
      lights(t);
    });
  }
  function lights(t) {                                                 // in token-local units (the truck's own coordinates)
    const k = keys(), a = clamp(prog(t, k.lights0, k.lights1)) * (1 - clamp(prog(t, k.off, k.off + .2))); if (a <= 0) return;
    const hx = 594, hy = -121;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(hx, hy, 6, hx, hy, 150); g.addColorStop(0, `rgba(255,236,160,${.95 * a})`); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; ctx.fillRect(hx - 150, hy - 150, 300, 300);
    const cg = ctx.createLinearGradient(hx, 0, hx + 700, 0); cg.addColorStop(0, `rgba(255,226,140,${.5 * a})`); cg.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(hx, hy - 16); ctx.lineTo(hx + 700, hy - 90); ctx.lineTo(hx + 700, 60); ctx.lineTo(hx, hy + 16); ctx.closePath(); ctx.fill();
    const rg = ctx.createRadialGradient(-378, -102, 3, -378, -102, 70); rg.addColorStop(0, `rgba(255,60,40,${.8 * a})`); rg.addColorStop(1, 'rgba(255,60,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(-448, -172, 140, 140);
    ctx.restore();
  }

  // ---------- scenes -------------------------------------------------------------------------------
  registerScene({ id: 'E33_road', z: 19, draw(t, n) { keys(); if (!visX(ROAD.x0, ROAD.x1, t)) return; ctx.save(); worldBegin(t); road(); ctx.restore(); } });
  registerScene({ id: 'E33_print', z: 21, draw(t, n) { if (!visX(PRN.x - PRN.w / 2 - 40, PRN.x + PRN.w / 2 + 40, t)) return; ctx.save(); worldBegin(t); print(t, n); ctx.restore(); } });
  registerScene({ id: 'E33_borne', z: 36, draw(t, n) { if (!visX(BORNE.x - 200, BORNE.x + 200, t)) return; ctx.save(); worldBegin(t); borne(); ctx.restore(); } });
})();

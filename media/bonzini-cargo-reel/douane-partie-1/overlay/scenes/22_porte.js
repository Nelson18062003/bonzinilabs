'use strict';
// =============================================================================================
// 22 · LA PORTE DU PAYS (S6–S7) — the quay's customs building as a two-lane paper arch (world x ≈ 1180–1700, centre 1440,
// just right of X.porte where Mireille stops). It stands there from the first frame (seen in the S1 travelling and in S2 as
// « le bâtiment de douane » with its fronton « DOUANE »); S6–S7 only ADD things, which then stay:
//  S6 « porte du pays »  : a paper banner « LA PORTE / DU PAYS » unrolls on the pediment; Mireille (orange-ribboned folder)
//                          points at it, her bubble = a tiny door drawing with ⇄ arrows.
//     « marchandises »    : the violet lane gets its label « ENTRÉE → » and a first shoe-box carton glides in (from the sea side);
//     « deux sens »       : the orange lane gets « ← SORTIE » and a first pepper sack glides out. Both lanes then flow, calmly.
//  S7 « encaisse »       : a coin purse pops out of a slot in the fronton; « droits » : a string shoots up-left with the tag
//                          « DROITS / ET TAXES »; « pour » : a small paper « ÉTAT » house (generic, no emblem) drops in at its end;
//     « l'État »          : the purse is hoisted along the string into the house.
//     « contrôle »        : a paper magnifier « CONTRÔLE » drops from the fronton, follows a passing carton (magnified) → green ✓.
// z 22 (world, behind the actors) · z 44 (Mireille's bubble, screen space)
// =============================================================================================
(() => {
  // ---------- geometry (world) ----------
  const AX = 1440;                                                   // arch centre
  const PIL = [[1220, 1290], [1590, 1660]];                          // pillars
  const FR = { x0: 1180, x1: 1700, y0: 470, y1: 560 };               // fronton band « DOUANE »
  const LIN = { x0: 1150, x1: 1790, y0: 812, y1: 876 };              // violet lane (ENTRÉE, goods move →)
  const LOUT = { x0: 1150, x1: 1790, y0: 990, y1: 1054 };            // orange lane (SORTIE, goods move ←)
  const V = 110;                                                     // goods speed (world px / s): calm
  const SLOT = [1200, 468], P0 = [1200, 366], HOOK = [1062, 360];    // coin slot on the fronton; purse hang point on it → ÉTAT house wall
  const HOUSE = { x: 968, y: 440 };                                  // ÉTAT house, bottom centre
  const PIV = [1530, 560], LENS_Y = 706, LENS_R = 58;                 // magnifier: pivot on the fronton, lens height (hovers just above the cartons), radius
  const BAN = { x: AX, y: 342, w: 250, h: 128 };                     // banner (top centre)

  let K = null;
  const keys = () => K || (K = {
    banner: tw('S6', 'porte', 0), bub0: tw('S6', 'porte', .25), bub1: te('S6', 'sens', .45),
    lin: tw('S6', 'marchandises', 0), lout: tw('S6', 'deux', 0),
    slot: tw('S7', 'encaisse', 0), tag: tw('S7', 'droits', 0), etat: tw('S7', 'pour', -.1), go: Math.max(tw('S7', 'Etat', 0), tw('S7', 'pour', .25)),   // the purse leaves once the house has landed
    ctrl: tw('S7', 'controle', 0), ok: tw('S7', 'passe', -.15), ctrlEnd: se('S7', .35),
    m0: ss('S6', 0), cut: CUT().t,
  });
  let SH = false;
  function lazyShakes() { if (SH) return; SH = true; const k = keys(); addShake(k.go + .7, 4, .12); addShake(k.etat + .3, 3, .1); }

  // ---------- goods schedule: the carton checked in S7 enters the opening (x XCHK) exactly at « contrôle » ----------
  const XCHK = 1372;
  let G = null;
  function goods() {
    if (G) return G; const k = keys(), xf = 1330;                    // first carton pops in just inside the arch
    const s0 = k.lin - (xf - LIN.x0) / V, D = k.ctrl - s0 - (XCHK - LIN.x0) / V;
    const m = Math.max(1, Math.round(D / 3)), ok = D > 1.6;
    G = { in: { s0, P: ok ? D / m : 3, t0: k.lin, kc: ok ? m : -1 }, out: { s0: k.lout - (LOUT.x1 - 1560) / V, P: 3.5, t0: k.lout } };
    return G;
  }
  const inX = (i, tq) => { const g = goods().in; return LIN.x0 + V * (tq - g.s0 - i * g.P); };
  const outX = (i, tq) => { const g = goods().out; return LOUT.x1 - V * (tq - g.s0 - i * g.P); };

  // ---------- small props ----------
  function cartonFront(w, h) {                                       // shoe-box carton, origin = bottom centre
    withShadow(4, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(-w / 2, -h, w, h); });
    ctx.fillStyle = C.kraftD; ctx.fillRect(-w / 2, -h, w, 7);
    ctx.fillStyle = C.violet; ctx.fillRect(-w / 2, -h * .42, w, h * .14);
    ctx.fillStyle = C.tape; ctx.fillRect(-7, -h, 14, h * .5);
    ctx.strokeStyle = 'rgba(90,60,30,.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h, w, h);
  }
  function arrowShape(len, hgt, dir) {                               // solid arrow centred at 0, pointing dir (+1 → / −1 ←)
    ctx.save(); ctx.scale(dir, 1); ctx.beginPath(); ctx.moveTo(-len / 2, -hgt * .22); ctx.lineTo(len / 2 - hgt * .55, -hgt * .22); ctx.lineTo(len / 2 - hgt * .55, -hgt / 2);
    ctx.lineTo(len / 2, 0); ctx.lineTo(len / 2 - hgt * .55, hgt / 2); ctx.lineTo(len / 2 - hgt * .55, hgt * .22); ctx.lineTo(-len / 2, hgt * .22); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function tape(x, y, r) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-30, -11, 60, 22); }); }

  // ---------- the lanes (bands + chevrons + labels + goods) ----------
  function lane(L, col, dir, label, tLab, tq, t) {
    withShadow(6, () => { ctx.fillStyle = col; ctx.beginPath(); const top = tornLine(L.x0, L.y0, L.x1, L.y0, dir * 7, 1.5, 16), bot = tornLine(L.x1, L.y1, L.x0, L.y1, dir * 11, 1.5, 16);
      ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(L.x0, L.y0 + 4, L.x1 - L.x0, 5);
    const on = t >= tLab, off = on ? (tq * 38 * dir) % 64 : 0;       // chevrons drift in the lane's direction once it is « open »
    ctx.save(); ctx.beginPath(); ctx.rect(L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0); ctx.clip();
    ctx.strokeStyle = on ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.22)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ym = (L.y0 + L.y1) / 2;
    for (let x = L.x0 - 64 + ((off % 64) + 64) % 64; x < L.x1 + 64; x += 64) { if (on && Math.abs(x - AX) < 150) continue;
      ctx.beginPath(); ctx.moveTo(x - 7 * dir, ym - 13); ctx.lineTo(x + 7 * dir, ym); ctx.lineTo(x - 7 * dir, ym + 13); ctx.stroke(); }
    ctx.restore();
    // label flips in (paper flap rotating around its top edge)
    const k = clamp((t - tLab) / .38); if (k <= 0) return;
    at(AX, L.y0 + 2, 0, 1, eOutBack(k), () => {
      const f = font(FF.stencil, 50, 900), tw_ = measure(label, f, 3), gap = 16, aw = 62, W_ = tw_ + gap + aw;
      ctx.fillStyle = dir > 0 ? C.violetD : '#D84406'; rrect(-W_ / 2 - 18, 4, W_ + 36, L.y1 - L.y0 - 8, 10); ctx.fill();
      const xt = dir > 0 ? -W_ / 2 + tw_ / 2 : W_ / 2 - tw_ / 2, xa = dir > 0 ? W_ / 2 - aw / 2 : -W_ / 2 + aw / 2;
      text(label, xt, (L.y1 - L.y0) / 2 + 20, { font: f, align: 'center', color: '#fff', ls: 3 });
      ctx.fillStyle = '#fff'; at(xa, (L.y1 - L.y0) / 2 + 1, 0, 1, 1, () => arrowShape(aw, 34, dir));
    });
  }
  function drawGoodsIn(t, tq, only) {
    const g = goods().in; if (t < g.t0) return;
    const iMax = Math.floor((tq - g.s0) / g.P + 1e-6), iMin = Math.max(0, iMax - Math.ceil((LIN.x1 - LIN.x0 + 80) / (V * g.P)) - 1);
    for (let i = iMin; i <= iMax; i++) { const x = inX(i, tq); if (x > LIN.x1 + 40 || x < LIN.x0 - 40) continue;
      if (only != null && Math.abs(x - only) > LENS_R * 1.5) continue;
      const a = clamp((x - LIN.x0) / 70) * clamp((LIN.x1 - x) / 70), s = i === 0 ? clamp(spring(t - g.t0, 16, .5), 0, 1.2) : 1;
      ctx.save(); ctx.globalAlpha *= a; at(x, LIN.y0, 0, s, s, () => {
        cartonFront(76, 56);
        if (i === g.kc) { const kk = clamp(spring(t - keys().ok, 16, .45), 0, 1.25); if (kk > 0) at(24, -54, 0, kk, kk, () => iconCheck(34)); }
      }); ctx.restore(); }
  }
  function drawGoodsOut(t, tq) {
    const g = goods().out; if (t < g.t0) return;
    const iMax = Math.floor((tq - g.s0) / g.P + 1e-6), iMin = Math.max(0, iMax - Math.ceil((LOUT.x1 - LOUT.x0 + 80) / (V * g.P)) - 1);
    for (let i = iMin; i <= iMax; i++) { const x = outX(i, tq); if (x > LOUT.x1 + 40 || x < LOUT.x0 - 40) continue;
      const a = clamp((x - LOUT.x0) / 70) * clamp((LOUT.x1 - x) / 70), s = i === 0 ? clamp(spring(t - g.t0, 16, .5), 0, 1.2) : 1;
      ctx.save(); ctx.globalAlpha *= a; at(x, LOUT.y0 - 36, 0, s, s, () => sack(60, 72, 'POIVRE', { lift: 4 })); ctx.restore(); }
  }

  // ---------- the arch itself ----------
  function archBody() {
    // soft inner shade of the opening (depth)
    ctx.fillStyle = 'rgba(90,60,30,.07)'; ctx.fillRect(PIL[0][1], 640, PIL[1][0] - PIL[0][1], GROUND - 640);
    // pillars + arch head (cream stone paper)
    const stone = '#EFE6D3';
    withShadow(16, () => { ctx.fillStyle = stone; ctx.beginPath();
      ctx.moveTo(PIL[0][0], GROUND); ctx.lineTo(PIL[0][0], FR.y1); ctx.lineTo(PIL[1][1], FR.y1); ctx.lineTo(PIL[1][1], GROUND); ctx.lineTo(PIL[1][0], GROUND); ctx.lineTo(PIL[1][0], 720);
      ctx.quadraticCurveTo(AX, 560, PIL[0][1], 720); ctx.lineTo(PIL[0][1], GROUND); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = 'rgba(120,90,60,.28)'; ctx.lineWidth = 3;                     // voussoir cuts + pillar courses
    for (let i = 1; i < 8; i++) { const u = i / 8, x = (1 - u) * (1 - u) * PIL[1][0] + 2 * u * (1 - u) * AX + u * u * PIL[0][1], y = (1 - u) * (1 - u) * 720 + 2 * u * (1 - u) * 560 + u * u * 720;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (x - AX) * .12, FR.y1 + 6); ctx.stroke(); }
    for (const [a, b] of PIL) for (let y = 760; y < GROUND; y += 78) { ctx.beginPath(); ctx.moveTo(a + 4, y); ctx.lineTo(b - 4, y); ctx.stroke(); }
    ctx.fillStyle = '#D9CDB4'; for (const [a, b] of PIL) { ctx.fillRect(a - 10, GROUND - 40, b - a + 20, 40); ctx.fillRect(a - 8, 700, b - a + 16, 22); }
    // pediment (kraft) with a round window — plain, no emblem
    withShadow(12, () => { ctx.fillStyle = TEX.kraft; ctx.beginPath(); ctx.moveTo(FR.x0 + 16, FR.y0 + 2); ctx.lineTo(FR.x1 - 16, FR.y0 + 2); ctx.lineTo(AX, 372); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = C.kraftD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(FR.x0 + 16, FR.y0 + 2); ctx.lineTo(AX, 372); ctx.lineTo(FR.x1 - 16, FR.y0 + 2); ctx.stroke();
    ctx.fillStyle = '#6B5B72'; ctx.beginPath(); ctx.arc(AX, 432, 17, 0, 7); ctx.fill();
    // fronton band
    withShadow(10, () => { ctx.fillStyle = '#F7F0E0'; ctx.fillRect(FR.x0, FR.y0, FR.x1 - FR.x0, FR.y1 - FR.y0); });
    ctx.fillStyle = DC.green; ctx.fillRect(FR.x0, FR.y0, FR.x1 - FR.x0, 8); ctx.fillRect(FR.x0, FR.y1 - 8, FR.x1 - FR.x0, 8);
    text('DOUANE', AX, FR.y1 - 22, { font: font(FF.stencil, 64, 900), align: 'center', color: DC.green, ls: 4 });
    // the coin slot (left end of the fronton top)
    ctx.fillStyle = '#231629'; rrect(SLOT[0] - 26, SLOT[1] - 4, 52, 10, 5); ctx.fill();
  }
  function banner(t) {
    const k = keys(), u = eOutCubic(clamp((t - k.banner) / .6)); if (u <= 0) return;
    const { x, y, w, h } = BAN, hh = h * u;
    withShadow(8, () => { ctx.fillStyle = C.cream; ctx.fillRect(x - w / 2, y, w, hh); });
    ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y, w, hh); ctx.clip();
    ctx.strokeStyle = C.orange; ctx.lineWidth = 5; ctx.strokeRect(x - w / 2 + 9, y + 9, w - 18, h - 18);
    text('LA PORTE', x, y + 58, { font: font(FF.stencil, 54, 900), align: 'center', color: C.ink, ls: 2 });
    text('DU PAYS', x, y + 112, { font: font(FF.stencil, 54, 900), align: 'center', color: C.ink, ls: 2 });
    ctx.restore();
    ctx.fillStyle = C.kraftD; rrect(x - w / 2 - 12, y + hh - 9, w + 24, 18, 9); ctx.fill();      // the paper roll at the bottom
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x - w / 2 - 6, y + hh - 6, w + 12, 4);
    tape(x - w / 2 + 16, y + 4, -.5); tape(x + w / 2 - 16, y + 4, .5);
  }

  // ---------- S7 : purse → ÉTAT, magnifier ----------
  function etatHouse() {                                              // generic public building (no emblem), origin bottom centre
    const w = 196, fh = 118;
    withShadow(10, () => { ctx.fillStyle = '#F7F0E0'; ctx.fillRect(-w / 2, -fh, w, fh); });
    ctx.fillStyle = '#D9CDB4'; ctx.fillRect(-w / 2 - 8, -8, w + 16, 8);
    withShadow(8, () => { ctx.fillStyle = TEX.kraft; ctx.beginPath(); ctx.moveTo(-w / 2 - 14, -fh); ctx.lineTo(w / 2 + 14, -fh); ctx.lineTo(0, -fh - 54); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = DC.green; ctx.fillRect(-w / 2, -fh, w, 6);
    text('ÉTAT', 0, -fh + 56, { font: font(FF.stencil, 52, 900), align: 'center', color: C.ink, ls: 3 });
    ctx.fillStyle = '#D9CDB4'; for (const x of [-62, -22, 22, 62]) ctx.fillRect(x - 7, -52, 14, 44);
    ctx.fillStyle = '#6B5B72'; rrect(-15, -46, 30, 38, 6); ctx.fill();
    tape(-w / 2 + 12, -fh - 6, -.6); tape(w / 2 - 12, -fh - 6, .6);              // cut-out taped to the sky panel
  }
  function purse() {                                                  // cloth coin purse, origin = hanging point (top)
    ctx.strokeStyle = '#6B4A2A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 14); ctx.stroke();
    withShadow(6, () => { ctx.fillStyle = '#D99A2B'; ctx.beginPath(); ctx.moveTo(-14, 16); ctx.quadraticCurveTo(-52, 40, -46, 72); ctx.quadraticCurveTo(-40, 96, 0, 96);
      ctx.quadraticCurveTo(40, 96, 46, 72); ctx.quadraticCurveTo(52, 40, 14, 16); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(-18, 58, 10, 22, .3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7A4B12'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-18, 24); ctx.quadraticCurveTo(0, 30, 18, 24); ctx.stroke();
    ctx.fillStyle = M.gold; ctx.beginPath(); ctx.ellipse(-6, 16, 11, 6, -.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(8, 14, 10, 6, .3, 0, 7); ctx.fill();
  }
  function purseTag(ky) {                                             // « DROITS / ET TAXES » tag, origin = top centre; ky = unfold 0..1
    if (ky <= 0) return; ctx.save(); ctx.scale(1, ky);
    withShadow(7, () => { ctx.fillStyle = C.cream; rrect(-104, 0, 208, 114, 12); ctx.fill(); });
    ctx.strokeStyle = C.amber; ctx.lineWidth = 4; rrect(-96, 8, 192, 98, 8); ctx.stroke();
    text('DROITS', 0, 52, { font: font(FF.stencil, 48, 900), align: 'center', color: C.ink, ls: 2 });
    text('ET TAXES', 0, 100, { font: font(FF.stencil, 48, 900), align: 'center', color: C.ink, ls: 2 });
    ctx.restore();
  }
  const SC = [(P0[0] + HOOK[0]) / 2, Math.min(P0[1], HOOK[1]) - 26];  // string control point (slight upward curve)
  function stringPath(p) { ctx.beginPath(); ctx.moveTo(P0[0], P0[1]); const e = onString(p); ctx.quadraticCurveTo(lerp(P0[0], SC[0], p), lerp(P0[1], SC[1], p), e[0], e[1]); }
  function onString(u) { return [(1 - u) * (1 - u) * P0[0] + 2 * u * (1 - u) * SC[0] + u * u * HOOK[0], (1 - u) * (1 - u) * P0[1] + 2 * u * (1 - u) * SC[1] + u * u * HOOK[1]]; }
  function s7Money(t) {
    const k = keys(); if (t < k.slot) return;
    // a little paper post with a pulley on the fronton (the string's anchor)
    ctx.fillStyle = C.kraftD; ctx.fillRect(P0[0] - 5, P0[1] - 4, 10, SLOT[1] - P0[1]); ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(P0[0], P0[1] - 4, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#9AA1A8'; ctx.beginPath(); ctx.arc(P0[0], P0[1] - 4, 4, 0, 7); ctx.fill();
    const sp = eOutCubic(clamp((t - k.tag) / .3));                   // string shoots out with the tag
    if (sp > 0) { ctx.save(); ctx.strokeStyle = '#6B4A2A'; ctx.lineWidth = 3.5; ctx.setLineDash([12, 6]); stringPath(sp); ctx.stroke(); ctx.restore(); }
    // the ÉTAT house drops in at the string's end
    if (t >= k.etat) { const d = drop(t, k.etat, 260, .3); at(HOUSE.x, HOUSE.y + d.y, 0, d.sx, d.sy, etatHouse); }
    // purse: pops out of the slot, then hoisted along the string
    const u = eInOutCubic(clamp((t - k.go) / .7)), p = onString(u), pop = clamp(spring(t - k.slot, 15, .45), 0, 1.25);
    const sw = Math.sin((t - k.slot) * 5) * Math.exp(-(t - k.slot) * 1.6) * .12 + (u > 0 && u < 1 ? Math.sin(u * Math.PI) * -.15 : 0);
    const ky = t >= k.tag ? eOutBack(clamp((t - k.tag) / .35)) : 0;
    const rise = (1 - clamp(pop)) * 70;                              // pops up out of the slot
    at(p[0], p[1] + rise, sw, pop, pop, () => { purse(); at(0, 104, 0, 1, 1, () => { ctx.strokeStyle = '#6B4A2A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 4); ctx.stroke(); purseTag(ky); }); });
    if (u >= 1) { const g = t - (k.go + .7); if (g < .6) { ctx.save(); ctx.globalAlpha *= 1 - g / .6; ctx.strokeStyle = M.gold; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .3, r0 = 30 + g * 70, r1 = 44 + g * 90; ctx.beginPath(); ctx.moveTo(HOOK[0] + Math.cos(a) * r0, HOOK[1] + 40 + Math.sin(a) * r0); ctx.lineTo(HOOK[0] + Math.cos(a) * r1, HOOK[1] + 40 + Math.sin(a) * r1); ctx.stroke(); }
      ctx.restore(); } }
  }
  function lensState(t, tq) {
    const k = keys(); if (t < k.ctrl) return null;
    const g = goods().in, dropK = eOutBack(clamp((t - k.ctrl) / .45)), y = lerp(PIV[1] + 40, LENS_Y, dropK);
    const xc = tt => g.kc < 0 ? PIV[0] : clamp(inX(g.kc, tt), 1360, 1660);
    let x;
    if (t < k.ctrlEnd) x = lerp(PIV[0], xc(tq), eOutCubic(prog(t, k.ctrl, k.ctrl + .55)));
    else { const d0 = xc(k.ctrlEnd) - PIV[0], s = t - k.ctrlEnd; x = PIV[0] + d0 * Math.exp(-s * 2.6) * Math.cos(s * 6.2); }
    return { x, y, ang: Math.atan2(x - PIV[0], y - PIV[1]), L: Math.hypot(x - PIV[0], y - PIV[1]), xc: xc(tq) };
  }
  function magnifier(t, tq, n) {
    const s = lensState(t, tq); if (!s) return;
    ctx.save(); ctx.strokeStyle = '#6B4A2A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(PIV[0], PIV[1]); ctx.lineTo(s.x - Math.sin(s.ang) * (LENS_R + 6), s.y - Math.cos(s.ang) * (LENS_R + 6)); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(PIV[0], PIV[1] + 4, 7, 0, 7); ctx.fill();
    // magnified view of the lane under the lens
    ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, LENS_R, 0, 7); ctx.clip();
    ctx.fillStyle = '#F4EEDF'; ctx.fillRect(s.x - LENS_R, s.y - LENS_R, 2 * LENS_R, 2 * LENS_R);
    ctx.translate(s.x, s.y); ctx.scale(1.5, 1.5); ctx.translate(-s.xc, -(LIN.y0 - 30));    // cartoon lens: shows the carton below it, enlarged
    ctx.fillStyle = C.violet; ctx.fillRect(LIN.x0, LIN.y0, LIN.x1 - LIN.x0, LIN.y1 - LIN.y0);
    drawGoodsIn(t, tq, s.xc);
    ctx.restore();
    ctx.save(); ctx.fillStyle = 'rgba(200,235,255,.18)'; ctx.beginPath(); ctx.arc(s.x, s.y, LENS_R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(s.x, s.y, LENS_R - 12, 3.7, 4.6); ctx.stroke();
    withShadow(8, () => { ctx.strokeStyle = '#2B2230'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(s.x, s.y, LENS_R, 0, 7); ctx.stroke(); });
    at(s.x, s.y, -s.ang, 1, 1, () => { at(LENS_R * .72, LENS_R * .72, -.78, 1, 1, () => { ctx.fillStyle = C.kraftD; rrect(-11, 0, 22, 48, 10); ctx.fill(); ctx.fillStyle = '#2B2230'; ctx.fillRect(-12, 0, 24, 12); }); });
    ctx.restore();
    // tag « CONTRÔLE » threaded on the string
    const tx = PIV[0] + Math.sin(s.ang) * Math.min(52, s.L * .4), ty = PIV[1] + Math.cos(s.ang) * Math.min(52, s.L * .4), kt = clamp(spring(t - keys().ctrl - .1, 14, .5), 0, 1.2);
    at(tx, ty, s.ang * -.25, kt, kt, () => { withShadow(6, () => { ctx.fillStyle = C.cream; rrect(-112, -30, 224, 62, 10); ctx.fill(); });
      ctx.strokeStyle = DC.blue; ctx.lineWidth = 4; rrect(-104, -23, 208, 48, 7); ctx.stroke();
      text('CONTRÔLE', 0, 18, { font: font(FF.stencil, 48, 900), align: 'center', color: DC.blue, ls: 2 }); });
  }

  // ---------- Mireille's bubble (S6): a tiny door drawing ----------
  function doorBubble(t) {
    const k = keys(); if (t < k.bub0 - .05 || t > k.bub1 + .3) return;
    const st = actorAt('mireille', t); if (!st) return;
    const hd = worldToScreen(st.x, st.y - 150 * FIG_S - 70, t), a = clamp(spring(t - k.bub0, 14, .5), 0, 1.15) * (1 - eInCubic(clamp((t - k.bub1) / .25)));
    if (a <= .01) return;
    const bx = clamp(hd.x - 90, 190, 860), by = clamp(hd.y - 150, 330, 1100), w = 260, h = 190;
    at(bx, by, -.03, a, a, () => {
      withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; rrect(-w / 2, -h / 2, w, h, 40); ctx.fill();
        ctx.beginPath(); ctx.moveTo(30, h / 2 - 6); ctx.lineTo(hd.x - bx + 6, hd.y - by - 4); ctx.lineTo(74, h / 2 - 6); ctx.closePath(); ctx.fill(); });
      // the little door: two pillars, an arc, a fronton, and the two arrows
      ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-70, 70); ctx.lineTo(-70, -30); ctx.quadraticCurveTo(0, -84, 70, -30); ctx.lineTo(70, 70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-84, -58); ctx.lineTo(84, -58); ctx.stroke();
      const aa = clamp((t - k.bub0 - .3) / .4);
      ctx.fillStyle = C.violet; at(0, 0, 0, aa, 1, () => arrowShape(150, 34, 1));
      ctx.fillStyle = C.orange; at(0, 44, 0, aa, 1, () => arrowShape(150, 34, -1));
    });
  }

  // ---------- pose hooks: Mireille's orange-ribboned folder, pointing; Junior looking up at the arch ----------
  function mFolder() {                                                // drawn at Mireille's hand (figure units, ×FIG_S in the world)
    at(-4, 96, .08, 1, 1, () => {
      withShadow(8, () => { ctx.fillStyle = '#E3C48F'; rrect(-86, -112, 172, 224, 10); ctx.fill(); });
      ctx.fillStyle = '#D2AE72'; rrect(-86, -130, 70, 30, 8); ctx.fill();
      ctx.fillStyle = C.orange; ctx.fillRect(-86, -14, 172, 26);
      ctx.beginPath(); ctx.ellipse(-20, 0, 26, 16, -.5, 0, 7); ctx.ellipse(20, 0, 26, 16, .5, 0, 7); ctx.fill();
      ctx.fillStyle = '#C94405'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill();
      ctx.strokeStyle = C.orange; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-22, 50); ctx.moveTo(4, 6); ctx.lineTo(24, 44); ctx.stroke();
    });
  }
  window.MIREILLE_FOLDER22 = mFolder;                                 // reusable: Mireille's « dossier à ruban orange »
  const M_IDX = (_poseHooks.mireille || []).length;                  // hooks registered before this one (earlier stations)
  poseHook('mireille', (t, st) => {
    const k = keys(); if (t < k.m0 - 1.3 || t >= k.cut) return null;
    if (t < k.m0) { for (const f of (_poseHooks.mireille || []).slice(0, M_IDX)) { const r = f(t, st); if (r && r.handProp) return null; } }   // S5's diary keeps her hand
    const o = { handProp: mFolder, handSide: -1 };
    if (t >= k.banner - .1 && t < k.bub1 + .2) Object.assign(o, { arms: ['hold', [300, -190]], look: .8 });
    else if (t >= k.bub1 + .2 && t < se('S7', .2)) Object.assign(o, { arms: ['hold', 'idle'], look: .6 });
    return o;
  });
  poseHook('junior', (t) => {
    const k = keys(); if (t < k.banner + .15 || t >= se('S7', .1)) return null;
    return { look: .7, face: t >= k.ctrl && t < k.ok + .4 ? 'think' : 'smile' };
  });

  // ---------- scenes ----------
  registerScene({ id: 'porte', z: 22, draw(t, n) {
    lazyShakes(); if (!inView(AX, 700, 900, t)) return;
    const tq = stepT(n), k = keys();
    ctx.save(); worldBegin(t);
    lane(LIN, C.violet, 1, 'ENTRÉE', k.lin, tq, t); lane(LOUT, C.orange, -1, 'SORTIE', k.lout, tq, t);
    drawGoodsIn(t, tq); drawGoodsOut(t, tq);
    archBody();
    banner(t);
    s7Money(t);
    magnifier(t, tq, n);
    ctx.restore();
  } });
  registerScene({ id: 'porte_hud', z: 44, draw(t, n) { const k = keys(); if (t < k.bub0 - .1 || t > k.bub1 + .4) return; doorBubble(t); } });
})();

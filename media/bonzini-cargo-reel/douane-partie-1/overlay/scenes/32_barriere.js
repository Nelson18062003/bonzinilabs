'use strict';
// =============================================================================================
// 32_barriere — ⑥ LA BARRIÈRE DE SORTIE + LE CARREFOUR (world x ≈ 4760…6760, X.barriere = 6100), S23–S24.
//  Always there (world): the guérite (small booth, window with a friendly silhouette, green roof, violet « → » plate),
//          the red/white barrier arm on a brass paper fastener (attache parisienne), down at rest (S1 dezoom, S30 crane);
//          the back plank = the ENTRY lane (behind the stage edge), Penja pepper vines on stakes at its right end.
//  Junior's truck: from the scanner to the barrier and out, driven by containerAt(t) with 28_scanner's truck (D28_truck)
//          and 20_quai's container (same objects as at the scanner). While it waits at the barrier: idle puffs + the violet
//          thread still knotted to the lashing ring. After containerAt ends, a short extrapolation (no pop at the edge).
//  S23 « Vendredi »    : Mireille's diary slides onto the table margin (screen): page « VEN. », tab « VENDREDI · POIVRE →
//                         KRIBI » circled in orange (same diary as in S5).
//      « la barrière se lève » : the arm lifts on its paper fastener (creak cue), stops at 70° (clear of the bête);
//                         the diary page gets its green check. (44 folds the bête into the margouillat, which hops on the truck.)
//      « margouillat » +: the truck rolls out right; strip « SORTIE ! · PAS UN JOUR DE TROP » + note « ici, tout était prêt ·
//                         les délais varient » (≥ 2.5 s, one block, no flicker).
//  S24 « poivre »      : in the entry lane, Mireille's pepper truck (sacks + vines, side board « POIVRE DE PENJA ») comes in
//                         from the right and drives INTO the port (←); Mireille waves, the driver waves back.
//      « port »         : behind the barrier, a second crop of kribi_crane (ship at the quay, no « ZPMC » corner) is taped up.
//      end              : the arm comes back down, calmly (rest state for the rest of the film).
// z 19 (world: entry-lane plank) · 20 (world: kribi print, vines, guérite — behind both lanes) · 21 (world: pepper truck)
// · 24 (world: Junior's truck) · 36 (world: post, arm, paper fastener — in front) · 45 (screen: diary) · 46 (screen: SORTIE strip)
// =============================================================================================
(() => {
  const Y = h => GROUND - h;
  const BOOTH = { x0: 6172, x1: 6342, h: 360 };
  const PIV = { x: 6362, h: 250 }, ARM_L = 560, OPEN = 1.22;           // 70°: the lifted arm stays clear of the bête (44) at wx ≈ 6360
  const LANE = { x0: 4760, x1: 6760, y0: Y(104), y1: Y(36), road: Y(72) };   // entry lane (back plank); wheels at LANE.road
  const PT_S = .85;                                                     // pepper truck scale (farther lane)
  const PR = { x: 6293, y: 164, w: 520, h: 380 };                      // kribi_crane second crop (world, taped behind the barrier)
  const DIARY = { x: 252, y: 540, w: 400 };
  const visX = (x0, x1, t, m = 140) => { const c = camAt(t); if (Math.abs(c.r) > .01) return true; const hw = W / 2 / c.z + m; return x1 > c.x - hw && x0 < c.x + hw; };
  const cont = () => window.A20_CONT || { w: 680, h: 360, depth: 46, top: 18, deck: 110, color: '#2E6B8A' };

  // ---------- time table (lazy) ------------------------------------------------------------------
  let K = null;
  function keys() {
    if (K) return K;
    const k = {
      out0: tw('S23', 'barrière', 0), go: tw('S23', 'margouillat', .4), out1: tw('S23', 'margouillat', 1.6),
      lift0: tw('S23', 'barrière', .05), lift1: te('S23', 'lève', 0),
      dIn: tw('S23', 'Vendredi', -.35), ck0: tw('S23', 'lève', -.02),
      sIn: te('S23', 'margouillat', .35),
      pt0: tw('S24', 'poivre', -.3), pt1: se('S24', .1),
      wave0: tw('S24', 'Mireille', -.15), wave1: tw('S24', 'embarquer', -.1),
    };
    k.lift1 = Math.max(k.lift1, k.lift0 + .6);
    k.ck1 = k.ck0 + .5; k.dOut = Math.max(k.ck1 + .6, tw('S23', 'bête', .2)); k.dOut1 = k.dOut + .4;
    k.sOut = k.sIn + 2.8; k.sOut1 = k.sOut + .35;
    k.pr0 = Math.max(k.sOut1 + .05, tw('S24', 'port', -.25)); k.pr1 = k.pr0 + .5;          // taped up once the strip has gone, on « port »
    k.down0 = Math.max(k.pt0 + 3.1, se('S24', -1.2)); k.down1 = k.down0 + .85;
    k.vEnd = (X.barriere + 900 - (X.barriere - 120)) * 3 / Math.max(.2, k.out1 - k.go);   // truck speed when containerAt ends
    addShake(k.lift0 + .1, 2, .1);                                     // the paper fastener creaks (sound cue)
    addShake(k.sIn + .12, 6, .12);                                     // « SORTIE ! » slaps down
    addShake(k.down1, 3, .1);                                          // the arm lands back on its rest
    return (K = k);
  }

  // ---------- Junior's truck (containerAt) --------------------------------------------------------
  function jTruck(t) {
    const k = keys(), c = containerAt(t);
    if (c && c.onTruck) {
      if (!c.moving && Math.abs(c.x - X.scanner) < 1) return null;                         // parked at the scanner: 28 draws it
      return { x: c.x, moving: !!c.moving, spin: (c.x - X.scanner) / 44, idle: !c.moving };
    }
    if (!c && t > k.out1 && t < k.out1 + .6) { const x = X.barriere + 900 + k.vEnd * (t - k.out1); return { x, moving: true, spin: (x - X.scanner) / 44 }; }
    return null;
  }
  function truckFallback(n) {                                          // only if 28_scanner / 20_quai are not loaded (isolated renders)
    const A = cont(); at(0, 0, 0, 1, 1, () => truck(0, { box: 'rgba(0,0,0,0)', cab: '#E2B04A' }));
    ctx.fillStyle = A.color; ctx.fillRect(-A.w / 2, -A.deck - A.h, A.w, A.h);
  }
  function drawJTruck(t, n) {
    const T = jTruck(t); if (!T || !visX(T.x - 420, T.x + 640, t)) return;
    const A = cont();
    ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.beginPath(); ctx.ellipse(T.x + 100, GROUND + 4, 520, 16, 0, 0, 7); ctx.fill();
    at(T.x, GROUND, 0, 1, 1, () => { if (typeof window.D28_truck === 'function') window.D28_truck({ n, spin: T.spin, idle: !!T.idle }); else truckFallback(n); });
    if (T.idle) {
      const p1 = [T.x + 120, GROUND - A.deck - 12], p0 = [T.x + 60, GROUND + 80];               // thread still knotted to the lashing ring
      thread([p0, [lerp(p0[0], p1[0], .5) - 16, lerp(p0[1], p1[1], .5) + 10], p1], 1, n, { w: 7, color: C.violet });
      ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(p1[0], p1[1] + 2, 8, 0, 7); ctx.fill();
      const s = (t * 1.3) % 1; ctx.save(); ctx.globalAlpha *= .5 * (1 - s); ctx.fillStyle = '#D9D2C4';           // idle exhaust puffs
      ctx.beginPath(); ctx.arc(T.x + 380 - s * 40, GROUND - 480 - s * 80, 16 + s * 22, 0, 7); ctx.fill(); ctx.restore();
    }
  }

  // ---------- the barrier: guérite, post, arm on a paper fastener ---------------------------------
  function armAngle(t, n) {
    const k = keys(), tt = Math.max(stepT(n), t - .034);                  // stop-motion: the arm moves on twos
    let a = OPEN * eInOutCubic(prog(tt, k.lift0, k.lift1));
    if (tt > k.lift1) a += Math.exp(-(tt - k.lift1) * 7) * Math.sin((tt - k.lift1) * 20) * .05;
    a *= 1 - eInOutCubic(prog(tt, k.down0, k.down1));
    if (tt > k.down1) a += Math.max(0, Math.exp(-(tt - k.down1) * 9) * Math.sin((tt - k.down1) * 24)) * .05;
    return a;
  }
  function fastener(r) {                                               // brass split pin: domed head + the two legs peeking out
    ctx.save(); ctx.fillStyle = '#9A7424'; for (const s of [-1, 1]) { ctx.save(); ctx.rotate(s * .5 + Math.PI / 2); ctx.fillRect(-3, r * .6, 6, r * 1.2); ctx.restore(); }
    const g = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, '#FBE7A6'); g.addColorStop(.6, '#D8A83C'); g.addColorStop(1, '#9A7424');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * .45, 0); ctx.lineTo(r * .45, 0); ctx.stroke();
    ctx.restore();
  }
  function booth(t, n) {
    const k = keys(), { x0, x1, h } = BOOTH, w = x1 - x0;
    withShadow(12, () => { ctx.fillStyle = '#F2E9D6'; ctx.fillRect(x0, Y(h), w, h); });
    ctx.strokeStyle = 'rgba(90,60,30,.16)'; ctx.lineWidth = 3; for (let x = x0 + 34; x < x1; x += 34) { ctx.beginPath(); ctx.moveTo(x, Y(h) + 36); ctx.lineTo(x, Y(52)); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.rect(x0, Y(48), w, 48); ctx.clip(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x0, Y(48), w, 48);   // hazard band
    ctx.fillStyle = DC.red; for (let x = x0 - 60; x < x1 + 40; x += 44) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + 22, GROUND); ctx.lineTo(x + 70, Y(48)); ctx.lineTo(x + 48, Y(48)); ctx.closePath(); ctx.fill(); } ctx.restore();
    // window with a friendly silhouette (green cap, no badge) who nods when the arm goes up
    const wx0 = x0 + 18, wy0 = Y(324), ww = w - 36, wh = 132;
    ctx.fillStyle = '#2B2230'; rrect(wx0 - 6, wy0 - 6, ww + 12, wh + 12, 8); ctx.fill();
    ctx.fillStyle = '#A9CFE8'; rrect(wx0, wy0, ww, wh, 6); ctx.fill();
    ctx.save(); rrect(wx0, wy0, ww, wh, 6); ctx.clip();
    const nod = env(t, k.lift0 - .35, k.lift0 + .45, .12, .2) * Math.abs(Math.sin(prog(t, k.lift0 - .35, k.lift0 + .45) * Math.PI * 2)) * 10;
    const ox = (x0 + x1) / 2 + 10, oy = wy0 + 70 + nod;
    ctx.fillStyle = '#E7DFC9'; rrect(ox - 48, oy + 30, 96, 80, 26); ctx.fill();
    ctx.fillStyle = SKIN[2]; ctx.beginPath(); ctx.arc(ox, oy, 27, 0, 7); ctx.fill();
    ctx.fillStyle = DC.green; ctx.beginPath(); ctx.arc(ox, oy - 8, 29, Math.PI, 0); ctx.fill(); ctx.fillRect(ox - 4, oy - 12, 40, 8);
    ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(ox - 9, oy + 4, 3, 0, 7); ctx.arc(ox + 9, oy + 4, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#231629'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ox, oy + 10, 8, .3, Math.PI - .3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(wx0 + 10, wy0); ctx.lineTo(wx0 + 40, wy0); ctx.lineTo(wx0 + 4, wy0 + wh); ctx.lineTo(wx0 - 26, wy0 + wh); ctx.closePath(); ctx.fill();
    ctx.restore();
    // roof + violet « → » plate (the exit way, no text)
    withShadow(8, () => { ctx.fillStyle = DC.green; ctx.beginPath(); ctx.moveTo(x0 - 24, Y(h)); ctx.lineTo(x1 + 24, Y(h)); ctx.lineTo(x1 + 8, Y(h + 38)); ctx.lineTo(x0 - 8, Y(h + 38)); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(246,197,74,.9)'; ctx.fillRect(x0 - 24, Y(h) - 6, w + 48, 6);
    at((x0 + x1) / 2, Y(h + 74), -.02, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = '#FFF8E8'; rrect(-70, -30, 140, 60, 10); ctx.fill(); });
      ctx.strokeStyle = C.violet; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(40, 0); ctx.moveTo(18, -18); ctx.lineTo(42, 0); ctx.lineTo(18, 18); ctx.stroke(); });
    ctx.fillStyle = '#6B4A2A'; ctx.fillRect((x0 + x1) / 2 - 4, Y(h + 44), 8, 12);
  }
  function barrierArm(t, n) {
    const a = armAngle(t, n);
    // post (striped) up to the pivot
    withShadow(8, () => { ctx.fillStyle = '#EDE6D6'; rrect(PIV.x - 17, Y(PIV.h + 26), 34, PIV.h + 26, 8); ctx.fill(); });
    ctx.fillStyle = DC.red; for (let h = 40; h < PIV.h - 10; h += 70) ctx.fillRect(PIV.x - 17, Y(h + 32), 34, 32);
    ctx.fillStyle = '#3A3040'; ctx.fillRect(PIV.x - 26, Y(14), 52, 14);
    // the arm
    ctx.save(); ctx.translate(PIV.x, Y(PIV.h)); ctx.rotate(-a);
    ctx.fillStyle = '#3A3040'; rrect(-92, -21, 74, 42, 8); ctx.fill();                                   // counterweight
    withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; rrect(-12, -15, ARM_L + 12, 30, 12); ctx.fill(); });
    ctx.save(); rrect(-12, -15, ARM_L + 12, 30, 12); ctx.clip(); ctx.fillStyle = DC.red;
    for (let x = 30; x < ARM_L; x += 120) { ctx.beginPath(); ctx.moveTo(x, 15); ctx.lineTo(x + 26, -15); ctx.lineTo(x + 86, -15); ctx.lineTo(x + 60, 15); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-12, -15, ARM_L + 12, 6); ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; rrect(-12, -15, ARM_L + 12, 30, 12); ctx.stroke();
    ctx.fillStyle = DC.red; ctx.beginPath(); ctx.arc(ARM_L - 14, 0, 9, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(ARM_L - 17, -3, 3, 0, 7); ctx.fill();
    ctx.restore();
    at(PIV.x, Y(PIV.h), 0, 1, 1, () => fastener(19));
  }

  // ---------- entry lane (back plank) + Penja vines -----------------------------------------------
  function lane() {
    withShadow(6, () => { ctx.fillStyle = '#B58C5C'; ctx.fillRect(LANE.x0, LANE.y0, LANE.x1 - LANE.x0, LANE.y1 - LANE.y0); });
    ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .5; ctx.fillRect(LANE.x0, LANE.y0, LANE.x1 - LANE.x0, LANE.y1 - LANE.y0); ctx.globalAlpha /= .5;
    ctx.fillStyle = 'rgba(255,240,210,.35)'; ctx.fillRect(LANE.x0, LANE.y0, LANE.x1 - LANE.x0, 5);
    ctx.fillStyle = 'rgba(255,253,247,.55)'; for (let x = LANE.x0 + 40; x < LANE.x1 - 40; x += 110) ctx.fillRect(x, (LANE.y0 + LANE.y1) / 2 - 3, 56, 6);
    ctx.fillStyle = 'rgba(90,60,30,.35)'; ctx.fillRect(LANE.x0, LANE.y1 - 6, LANE.x1 - LANE.x0, 6);
  }
  function vine(x, hgt, seed, n) {                                     // Penja pepper vine on a wooden stake
    ctx.fillStyle = '#7A5A3A'; ctx.fillRect(x - 7, LANE.y0 - hgt, 14, hgt + 8);
    ctx.strokeStyle = '#2F7A4E'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i <= 20; i++) { const y = LANE.y0 - i / 20 * hgt, xx = x + Math.sin(i * .9 + seed) * 18; i ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); } ctx.stroke();
    for (let i = 1; i < 10; i++) { const y = LANE.y0 - i / 10 * hgt, s = i % 2 ? 1 : -1, xx = x + Math.sin(i * 1.8 + seed) * 18;
      at(xx, y, s * .6 + Math.sin(stepT(n) * 1.3 + i) * .05, 1, 1, () => { ctx.fillStyle = i % 3 ? '#3E9A62' : '#2F7A4E'; ctx.beginPath(); ctx.ellipse(s * 22, 0, 22, 11, 0, 0, 7); ctx.fill(); });
      if (i % 3 === 1) at(xx - s * 8, y + 16, 0, 1, 1, () => { for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? '#C8102E' : '#7FB08F'; ctx.beginPath(); ctx.arc((j % 2) * 7 - 3, j * 7, 5, 0, 7); ctx.fill(); } }); }
  }

  // ---------- Mireille's pepper truck (faces LEFT), origin = ground under the deck centre ----------
  function sackShape(w, h, seed) {
    withShadow(6, () => { ctx.fillStyle = '#B8935A'; ctx.beginPath(); ctx.moveTo(-w * .44, -h * .4); ctx.quadraticCurveTo(-w * .58, h * .1, -w * .46, h * .48); ctx.quadraticCurveTo(0, h * .56, w * .46, h * .48);
      ctx.quadraticCurveTo(w * .58, h * .1, w * .44, -h * .4); ctx.quadraticCurveTo(0, -h * .3, -w * .44, -h * .4); ctx.fill(); });
    ctx.strokeStyle = 'rgba(90,60,25,.3)'; ctx.lineWidth = 2; for (let y = -h * .3; y < h * .45; y += 13) { ctx.beginPath(); ctx.moveTo(-w * .44, y); ctx.lineTo(w * .44, y + 3); ctx.stroke(); }
    ctx.strokeStyle = C.orange; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-w * .16, -h * .38); ctx.lineTo(w * .16, -h * .38); ctx.stroke();
    ctx.fillStyle = C.cream; rrect(-w * .26, -h * .06, w * .52, h * .22, 6); ctx.fill();
    ctx.fillStyle = 'rgba(31,91,69,.8)'; ctx.fillRect(-w * .18, h * .02, w * .36, h * .04); ctx.fillRect(-w * .12, h * .09, w * .24, h * .03);
  }
  function pepperTruck(t, n, o = {}) {
    const spin = o.spin || 0, wave = o.wave || 0;
    const wheel = x => at(x, -44, spin, 1, 1, () => { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill();
      ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill(); ctx.strokeStyle = '#231629'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 2.09) * 20, Math.sin(i * 2.09) * 20); ctx.stroke(); } });
    withShadow(6, () => { ctx.fillStyle = '#2B2230'; ctx.fillRect(-560, -112, 930, 28); });
    ctx.fillStyle = '#231629'; rrect(80, -96, 250, 24, 10); ctx.fill();
    wheel(-440); wheel(165); wheel(280);
    // sacks + vines on the deck (behind the side board)
    [[-300, -330, 150, 128, 1], [-140, -334, 150, 134, 2], [20, -330, 150, 128, 3], [180, -326, 150, 124, 4], [-220, -440, 146, 118, 5], [-60, -446, 150, 122, 6], [100, -438, 146, 116, 7]]
      .forEach(([x, y, w, h, s]) => at(x, y, (rnd(s) - .5) * .12, 1, 1, () => sackShape(w, h, s)));
    ctx.strokeStyle = '#2F7A4E'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (let v = 0; v < 3; v++) { ctx.beginPath(); for (let i = 0; i <= 16; i++) { const x = -360 + i * 44, y = -392 - v * 58 + Math.sin(i * .8 + v * 2) * 26; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      for (let i = 1; i < 16; i += 2) { const x = -360 + i * 44, y = -392 - v * 58 + Math.sin(i * .8 + v * 2) * 26;
        at(x, y, (i % 4 ? .5 : -.5) + Math.sin(stepT(n) * 1.1 + i + v) * .05, 1, 1, () => { ctx.fillStyle = (i + v) % 3 ? '#3E9A62' : '#2F7A4E'; ctx.beginPath(); ctx.ellipse(16, 0, 18, 9, 0, 0, 7); ctx.fill(); });
        if ((i + v) % 4 === 1) for (let j = 0; j < 5; j++) { ctx.fillStyle = j % 2 ? '#C8102E' : '#7FB08F'; ctx.beginPath(); ctx.arc(x + (j % 2) * 6 - 3, y + 12 + j * 6, 4.5, 0, 7); ctx.fill(); } } }
    // deck + side board with the painted name
    ctx.fillStyle = '#6B4A2A'; ctx.fillRect(-380, -132, 750, 22);
    withShadow(6, () => { ctx.fillStyle = TEX.kraft; rrect(-384, -284, 758, 156, 10); ctx.fill(); });
    ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 3; for (let x = -384 + 126; x < 370; x += 126) { ctx.beginPath(); ctx.moveTo(x, -280); ctx.lineTo(x, -132); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,240,210,.4)'; ctx.fillRect(-384, -284, 758, 6);
    { const f0 = font(FF.stencil, 100, 900), fs = Math.min(100, 100 * 700 / measure('POIVRE DE PENJA', f0, 3));
      text('POIVRE DE PENJA', -5, -206 + fs * .36, { font: font(FF.stencil, fs, 900), align: 'center', color: '#1F4E3A', ls: 3 }); }
    // cab (left, Mireille's orange) with the driver waving
    withShadow(10, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(-392, -84); ctx.lineTo(-392, -420); ctx.lineTo(-552, -420); ctx.quadraticCurveTo(-586, -420, -588, -380); ctx.lineTo(-592, -84); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-572, -420, 180, 8);
    ctx.fillStyle = C.cream; ctx.fillRect(-592, -158, 200, 14);
    ctx.fillStyle = '#9CC3E6'; ctx.beginPath(); ctx.moveTo(-470, -392); ctx.lineTo(-560, -392); ctx.quadraticCurveTo(-572, -392, -574, -376); ctx.lineTo(-576, -270); ctx.lineTo(-470, -270); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(-514, -318, 22, 0, 7); ctx.fill(); ctx.fillRect(-536, -298, 44, 28);
    if (wave > 0) { const wy = Math.sin(stepT(n) * 14) * 10; ctx.strokeStyle = SKIN[2]; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-492, -300); ctx.lineTo(-470 + wy * .6, -372 - wave * 20); ctx.stroke(); ctx.fillStyle = SKIN[2]; ctx.beginPath(); ctx.arc(-468 + wy * .6, -382 - wave * 20, 13, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-480, -386); ctx.lineTo(-500, -386); ctx.lineTo(-478, -278); ctx.lineTo(-472, -278); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 3; ctx.strokeRect(-584, -404, 124, 316);
    ctx.fillStyle = '#6E737A'; ctx.fillRect(-504, -176, 24, 7);
    ctx.fillStyle = '#3A3040'; rrect(-606, -104, 26, 34, 6); ctx.fill();
    ctx.fillStyle = C.amber; rrect(-596, -130, 12, 18, 4); ctx.fill();
  }
  function ptState(t) {
    const k = keys(); if (t < k.pt0 - .05 || t > k.pt1 + 2.2) return null;                       // keeps driving into the port, off-screen
    const x = 7300 - 2300 * Math.max(0, (t - k.pt0) / (k.pt1 - k.pt0));
    return { x, spin: (x - 7300) / 44 };                               // rolling left: wheels turn counter-clockwise
  }
  function drawPepper(t, n) {
    const P = ptState(t); if (!P || !visX(P.x - 520, P.x + 320, t)) return;
    const k = keys(), wave = env(t, k.wave0 + .2, k.wave1, .25, .3);
    ctx.fillStyle = 'rgba(60,32,12,.16)'; ctx.beginPath(); ctx.ellipse(P.x - 60, LANE.road + 4, 420, 12, 0, 0, 7); ctx.fill();
    at(P.x, LANE.road, 0, PT_S, PT_S, () => pepperTruck(t, n, { spin: P.spin, wave }));
  }

  // ---------- second crop of the Kribi print (ship at the quay), taped up in S24 -----------------
  function kribiPrint(t) {
    const k = keys(); if (t < k.pr0) return;
    const u = prog(t, k.pr0, k.pr1), e = eOutBack(u, 1.4);
    ctx.save(); ctx.globalAlpha *= clamp(u * 3);
    at(PR.x, PR.y - (1 - clamp(e)) * 150, lerp(-.14, -.018, clamp(e)), 1, 1, () => {
      photoPrint('kribi_crane', PR.w, PR.h, { fx_kind: 'duo', cols: DUO.green, zoom: 2.2, fx: .58, fy: .5, border: 14, lift: 8 });
      creditTag(CREDIT.kribi_crane, PR.w / 2 - 8, -PR.h / 2 + 42, { size: 20 });
    });
    ctx.restore();
  }

  // ---------- screen: Mireille's diary (S23) and the SORTIE strip ---------------------------------
  function diary(t) {
    const k = keys(); if (t < k.dIn || t > k.dOut1) return;
    const u = prog(t, k.dIn, k.dIn + .5), e = eOutBack(u, 1.3), o = eInCubic(prog(t, k.dOut, k.dOut1));
    const ck = eInOutCubic(prog(t, k.ck0, k.ck1));
    at(DIARY.x - (1 - clamp(e)) * 460 - o * 380, DIARY.y + o * 260, -.05 - (1 - clamp(e)) * .35 - o * .3, 1, 1, () =>
      mireilleDiary(DIARY.w, 'VEN.', { tab: 'VENDREDI · POIVRE → KRIBI', check: ck, lift: 16 }));
  }
  function tornPaper(w, h, seed, fill) {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, seed * 3, 4, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, seed * 5, 4, 12);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
  }
  function sortie(t) {
    const k = keys(); if (t < k.sIn - .12 || t > k.sOut1) return;
    const sl = slam(t, k.sIn, 1.35), o = eInCubic(prog(t, k.sOut, k.sOut1));
    ctx.save(); ctx.globalAlpha *= sl.a * (1 - o);
    at(540, 420 - o * 90, -.025, sl.s, sl.s, () => {
      withShadow(14, () => tornPaper(660, 262, 7, C.cream));
      ctx.fillStyle = C.tape; at(-300, -128, -.45, 1, 1, () => ctx.fillRect(-50, -16, 100, 32)); at(300, -128, .45, 1, 1, () => ctx.fillRect(-50, -16, 100, 32));
      const f1 = font(FF.stencil, 132, 900), s1 = Math.min(132, 132 * 580 / measure('SORTIE !', f1, 6));
      text('SORTIE !', 0, -18, { font: font(FF.stencil, s1, 900), align: 'center', color: C.violetD, ls: 6 });
      const f2 = font(FF.body, 54, 800), s2 = Math.min(54, 54 * 600 / measure('PAS UN JOUR DE TROP', f2));
      text('PAS UN JOUR DE TROP', 0, 86, { font: font(FF.body, s2, 800), align: 'center', color: C.ink });
    });
    // the honest small print, on its own tag under the strip
    const nk = eOutBack(prog(t, k.sIn + .22, k.sIn + .6), 1.5);
    if (nk > 0) at(560, 640 - o * 90, .022, clamp(nk, 0, 1.1), clamp(nk, 0, 1.1), () => {
      withShadow(8, () => tornPaper(470, 138, 3, '#FFFDF7'));
      text('ici, tout était prêt', 0, -12, { font: font(FF.body, 44, 700), align: 'center', color: C.inkSoft });
      text('les délais varient', 0, 44, { font: font(FF.body, 44, 700), align: 'center', color: C.inkSoft });
    });
    ctx.restore();
  }

  // ---------- Mireille waves at her pepper truck (S24) ---------------------------------------------
  poseHook('mireille', (t, st) => {
    const k = keys(); if (t < k.wave0 || t > k.wave1 + .4) return null;
    const a = env(t, k.wave0, k.wave1 + .4, .35, .4), sw = Math.sin(stepT(Math.floor(t * 30)) * 9) * 36 * a;
    const R = [215, -270], I = [158, 262];
    return { arms: ['idle', [lerp(I[0], R[0] + sw, a), lerp(I[1], R[1], a)]], face: 'grin' };
  });

  // ---------- scenes -------------------------------------------------------------------------------
  registerScene({ id: 'E32_lane', z: 19, draw(t, n) {
    keys(); if (!visX(LANE.x0, LANE.x1, t)) return;
    ctx.save(); worldBegin(t); lane(); ctx.restore();
  } });
  registerScene({ id: 'E32_back', z: 20, draw(t, n) {
    if (!visX(6200, 6800, t, 400)) return;
    ctx.save(); worldBegin(t); kribiPrint(t); vine(6500, 300, 1, n); vine(6600, 360, 2.4, n); if (visX(BOOTH.x0 - 60, BOOTH.x1 + 60, t)) booth(t, n); ctx.restore();
  } });
  registerScene({ id: 'E32_pepper', z: 21, draw(t, n) { ctx.save(); worldBegin(t); drawPepper(t, n); ctx.restore(); } });
  registerScene({ id: 'E32_truck', z: 24, draw(t, n) { ctx.save(); worldBegin(t); drawJTruck(t, n); ctx.restore(); } });
  registerScene({ id: 'E32_barrier', z: 36, draw(t, n) {
    if (!visX(PIV.x - 120, PIV.x + ARM_L + 40, t)) return;
    ctx.save(); worldBegin(t); barrierArm(t, n); ctx.restore();
  } });
  registerScene({ id: 'E32_diary', z: 45, draw(t, n) { diary(t); } });
  registerScene({ id: 'E32_sortie', z: 46, draw(t, n) { const sh = shake(t, n); ctx.save(); ctx.translate(sh.x * .5, sh.y * .5); sortie(t); ctx.restore(); } });
})();

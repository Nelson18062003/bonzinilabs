'use strict';
// =============================================================================================
// 20_quai — ① LE QUAI DE KRIBI (world x ≈ −1250…1100) and the opening of the story (S1 end → S5).
//  world : paper sea + docked ship (no carrier brand), paper gantry crane « PORT DE KRIBI », plain stacks, forklift, bollards,
//          the real print kribi_crane (duotone, taped, credited) LEFT of x 1100, Junior's plain container « JUNIOR · MBOPPI »
//          (containerAt, on the quay until the S16 cut) with the violet thread knotted to its lashing ring.
//  story : S1 the crane sets the container down + the phone notification pops near Junior · S2 « Dedans » the side panel
//          slides open (Advent-calendar door) on the sneaker boxes · S3 big phone: the big brother's message, word by word ·
//          S4 the finger hesitates over the sealed flap, the phone goes into the back pocket, « ? » sticker visible (act 2) ·
//          S5 the call: a violet cord pulls a polaroid (Mireille already at Kribi's gate), her diary, her bubble.
//  exports: window.A20_container(o) (the container, origin bottom centre) and window.A20_CONT (its size, deck height on a truck).
// =============================================================================================
(() => {
  const Y = h => GROUND - h;                                          // height above the stage floor → world y
  const CW = 680, CH = 360, CD = 46, CDH = 18;                         // container side w×h + depth offset of the end/top faces
  const CCOL = '#2E6B8A', CCOLD = '#224F66', CCOLL = '#4A8CAD';
  const CR = { l: -420, r: -20, b0: 725, b1: 795, tip: -1250, back: 900, ax: -220, ah: 1180 };   // gantry crane
  const PR = { x0: -200, x1: 620, h0: 300, h1: 650 };                  // the real print (kribi_crane), left of x 1100
  const AMB = '#E9A23B', AMBD = '#B8741F', AMBL = '#F6C66E';
  const PH = { w: 820, h: 1000, cx: 540, cy: 745 };                    // S3–S4 big phone (screen)
  const FINGER = { skin: SKIN[1], sleeve: C.violet };
  let T = null, OFFC = null;

  // ---------- time table (lazy: TL is ready at draw time) ----------------------------------------
  function tm() {
    if (T) return T;
    T = {
      lower0: tw('S1', 'Kribi', -.9), land: se('S1', .6),
      notif0: tw('S1', 'Kribi', -.05), notif1: tw('S2', 'baskets', .45),
      peek0: tw('S2', 'Dedans', .05), shoe: tw('S2', 'baskets', 0), garl: tw('S2', 'pour', -.1), peekC: tw('S2', 'Devant', .1),
      bete: tw('S2', 'bête', 0),
      raise0: ss('S3', -1.05), raise1: ss('S3', -.25), grow0: ss('S3', -.3), grow1: ss('S3', .6),
      bub: tw('S3', 'Petit', -.25),
      w: [['Petit', 'prix', 'sur', 'facture'], ['mets', 'juste', 'chaussures'], ['moins', 'de', 'douane']].map(L => L.map(x => tw('S3', x, 0))),
      trem0: ss('S4', 0), trem1: tw('S4', 'Vous', .1),
      fing0: ss('S4', .2), fing1: tw('S4', 'Vous', -.25),
      shrink0: tw('S4', 'Vous', .15), shrink1: tw('S4', 'Vous', .75),
      pock0: tw('S4', 'Vous', .75), pock1: tw('S4', 'Vous', 1.55),
      arrow0: tw('S4', 'barrière', .05), arrow1: ss('S5', -1.2),
      ear0: ss('S5', -.3), ear1: ss('S5', .35),
      cord: tw('S5', 'appelle', .2), pol0: tw('S5', 'Tantine', -.05), pol1: tw('S5', 'Tantine', .8),
      diary: tw('S5', 'vendredi', -.15), bub1: tw('S5', 'arrive', -.12), bub2: te('S5', 'arrive', .1),
      note: [te('S5', 'arrive', .1), tw('S5', 'jour', 0), tw('S5', 'se', 0, 1), te('S5', 'paie', .15)], w2: [tw('S5', 'Au', 0, 1), te('S5', 'jour', 0), te('S5', 'jour', .02), te('S5', 'paie', 0)],
      happy: tw('S5', 'arrive', 0),
      back0: se('S5', -.2), back1: se('S5', .45), out0: se('S5', .55), out1: se('S5', 1.15),
      mir0: ss('S6', -1.7), mir1: ss('S6', 0),
      shiv11: te('S11', 'prix', .35), shiv15: tw('S15', 'repense', 0), peel: tw('S18', 'Car', -.05),
      pocketEnd: ss('S26', 0), cut: CUT().t + CUT().dur * .5,
    };
    addShake(T.land, 8, .14);                                           // the container touches the quay (thud)
    addShake(T.pock1 - .1, 3, .1);                                      // the phone slides into the pocket (paper flick)
    addShake(T.pol1 - .1, 3, .1);                                       // the polaroid lands in the margin
    return T;
  }
  const visX = (x0, x1, t, m = 120) => { const c = camAt(t); if (Math.abs(c.r) > .01) return true; const hw = W / 2 / c.z + m; return x1 > c.x - hw && x0 < c.x + hw; };

  // ---------- Junior's container -----------------------------------------------------------------
  function shoeBoxFront(w, h, col, seed) {
    ctx.fillStyle = '#EFE6D6'; ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = col; ctx.fillRect(-w / 2 - 3, -h - 3, w + 6, h * .26);                  // lid
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-w / 2, -h + h * .23, w, 3);
    ctx.fillStyle = col; ctx.globalAlpha *= .75; ctx.fillRect(-w / 2 + w * .12, -h * .42, w * .3, h * .14); ctx.globalAlpha /= .75;
    ctx.strokeStyle = 'rgba(35,22,41,.18)'; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h, w, h);
  }
  function panelSkin(x0, y0, w, h) {                                    // corrugated steel skin (side of the container)
    ctx.fillStyle = CCOL; ctx.fillRect(x0, y0, w, h);
    for (let x = x0 + 8; x < x0 + w - 6; x += 26) { ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(x, y0, 9, h); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 9, y0, 4, h); }
  }
  /** the container, side view with a little depth; origin = bottom centre. o: { peek, garland, shoe, n } */
  function container(o = {}) {
    const w = CW, h = CH, d = CD, dh = CDH, n = o.n || 0;
    ctx.save();
    // end face (doors, right) and top face — a touch of depth
    ctx.fillStyle = CCOLD; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 + d, -dh); ctx.lineTo(w / 2 + d, -h - dh); ctx.lineTo(w / 2, -h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,30,40,.55)'; ctx.lineWidth = 4;
    for (const k of [.3, .72]) { ctx.beginPath(); ctx.moveTo(w / 2 + d * k, -dh * k - 14); ctx.lineTo(w / 2 + d * k, -h - dh * k + 14); ctx.stroke();
      ctx.fillStyle = '#C9CDD2'; ctx.fillRect(w / 2 + d * k - 7, -h * .45 - dh * k, 14, 22); }
    ctx.fillStyle = CCOLL; ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(w / 2, -h); ctx.lineTo(w / 2 + d, -h - dh); ctx.lineTo(-w / 2 + d, -h - dh); ctx.closePath(); ctx.fill();
    // side
    withShadow(12, () => { ctx.fillStyle = CCOL; ctx.fillRect(-w / 2, -h, w, h); });
    panelSkin(-w / 2 + 20, -h + 16, w - 40, h - 34);
    ctx.fillStyle = CCOLD; ctx.fillRect(-w / 2, -h, w, 16); ctx.fillRect(-w / 2, -18, w, 18);            // top & bottom rails
    ctx.fillRect(-w / 2, -h, 22, h); ctx.fillRect(w / 2 - 22, -h, 22, h);                               // corner posts
    ctx.fillStyle = '#1A3A4B'; for (const [x, y] of [[-w / 2, -h], [w / 2 - 26, -h], [-w / 2, -24], [w / 2 - 26, -24]]) { ctx.fillRect(x, y, 26, 24); ctx.fillStyle = '#0E2530'; ctx.beginPath(); ctx.ellipse(x + 13, y + 12, 6, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#1A3A4B'; }
    // the Advent-calendar door (side panel that slides open on « Dedans »)
    const px0 = -60, pw = 350, py0 = -238, ph = 206, pk = clamp(o.peek || 0);
    ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip();
    if (pk > 0) {
      ctx.fillStyle = '#132029'; ctx.fillRect(px0, py0, pw, ph);
      const cols = [C.orange, C.violet, C.amber, '#1FA86A', C.violetD, C.orange];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) at(px0 + 50 + c * 84, py0 + ph - 6 - r * 62, 0, 1, 1, () => shoeBoxFront(78, 56, cols[(r * 4 + c) % cols.length], r * 4 + c));
      const sk = clamp(o.shoe || 0);                                                            // one sneaker peeks out on « baskets »
      if (sk > 0) at(px0 + pw - 96, py0 + ph - 118 - 20 * eOutBack(sk), -.12, eOutBack(sk, 2), eOutBack(sk, 2), () => sneaker(150, { color: C.violet, accent: C.amber, lift: 10 }));
      const gk = clamp(o.garland || 0);                                                       // bunting « FÊTES »
      if (gk > 0) { const L = ['F', 'Ê', 'T', 'E', 'S'], gc = [C.violet, C.amber, C.orange, C.violet, C.amber], y0 = py0 + 10;
        ctx.strokeStyle = C.cream; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px0 + 8, y0); ctx.quadraticCurveTo(px0 + pw / 2, y0 + 26, px0 + 8 + (pw - 16) * gk, y0 + (gk < 1 ? 14 : 0)); ctx.stroke();
        L.forEach((ch, i) => { const kk = clamp(gk * 5 - i); if (kk <= 0) return; const x = px0 + 42 + i * 66, yy = y0 + 4 + Math.sin((i + .5) / 5 * Math.PI) * 12;
          at(x, yy, Math.sin(stepT(n) * 3 + i) * .06, 1, eOutBack(kk), () => { ctx.fillStyle = gc[i]; ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.lineTo(0, 62); ctx.closePath(); ctx.fill();
            text(ch, 0, 34, { font: font(FF.stencil, 34, 900), align: 'center', color: '#fff' }); }); }); }
    }
    if (pk < 1) { ctx.translate(-pk * pw, 0); panelSkin(px0, py0, pw, ph); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(px0 + pw - 6, py0, 6, ph);
      ctx.fillStyle = '#C9CDD2'; rrect(px0 + pw - 34, py0 + ph / 2 - 20, 14, 40, 5); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(230,240,245,.55)'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.strokeRect(px0 - 2, py0 - 2, pw + 4, ph + 4); ctx.restore();
    // handwritten label « JUNIOR · MBOPPI » on a taped cream sheet (never a carrier brand, never a BZ label)
    at(-20, -296, -.018, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-212, -40, 424, 80); });
      ctx.fillStyle = C.tape; at(-200, -38, -.5, 1, 1, () => ctx.fillRect(-26, -10, 52, 20)); at(200, -38, .5, 1, 1, () => ctx.fillRect(-26, -10, 52, 20));
      text('JUNIOR · MBOPPI', 0, 17, { font: font(FF.hand, 48, 800), align: 'center', color: C.ink }); });
    // lashing ring (the violet thread is knotted here)
    ctx.strokeStyle = '#0E2530'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(120, -9, 9, 0, 7); ctx.stroke();
    ctx.restore();
  }
  window.A20_container = container;
  window.A20_CONT = { w: CW, h: CH, depth: CD, top: CDH, deck: 110, color: CCOL };

  // ---------- the crane --------------------------------------------------------------------------
  function contLift(t) {                                                // bottom height of the container while the crane sets it down
    const k = prog(t, T.lower0, T.land); return { h: lerp(330, 0, eInOutCubic(k)), sway: Math.sin(t * 2.3) * .012 * (1 - k) };
  }
  function spreaderH(t) {
    const c = contLift(t); if (t < T.land + .25) return c.h + CH + CDH + 2;
    return lerp(CH + CDH + 2, 640, eInOutCubic(prog(t, T.land + .25, T.land + 1.2)));
  }
  function crane(t, n) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // stays (A-frame → boom tip and back end)
    ctx.strokeStyle = '#6E4A1C'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(CR.ax, Y(CR.ah)); ctx.lineTo(CR.tip + 60, Y(CR.b1)); ctx.moveTo(CR.ax, Y(CR.ah)); ctx.lineTo(CR.back - 40, Y(CR.b1)); ctx.stroke();
    // A-frame
    ctx.strokeStyle = AMBD; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(CR.l, Y(CR.b1)); ctx.lineTo(CR.ax, Y(CR.ah)); ctx.lineTo(CR.r, Y(CR.b1)); ctx.stroke();
    ctx.strokeStyle = AMB; ctx.lineWidth = 20; ctx.stroke();
    // legs (tapered girders with lattice) + bogies
    for (const x of [CR.l, CR.r]) {
      ctx.fillStyle = AMBD; ctx.beginPath(); ctx.moveTo(x - 30, Y(40)); ctx.lineTo(x + 30, Y(40)); ctx.lineTo(x + 20, Y(CR.b0)); ctx.lineTo(x - 20, Y(CR.b0)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = AMB; ctx.beginPath(); ctx.moveTo(x - 22, Y(40)); ctx.lineTo(x + 22, Y(40)); ctx.lineTo(x + 14, Y(CR.b0)); ctx.lineTo(x - 14, Y(CR.b0)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(110,74,28,.55)'; ctx.lineWidth = 3; for (let h = 60; h < CR.b0 - 30; h += 70) { ctx.beginPath(); ctx.moveTo(x - 16, Y(h)); ctx.lineTo(x + 16, Y(h + 35)); ctx.lineTo(x - 16, Y(h + 70)); ctx.stroke(); }
      ctx.fillStyle = '#3A3040'; rrect(x - 56, Y(44), 112, 34, 8); ctx.fill();
      ctx.fillStyle = '#231629'; for (const dx of [-34, 0, 34]) { ctx.beginPath(); ctx.arc(x + dx, Y(4), 14, 0, 7); ctx.fill(); }
    }
    // portal beam + braces
    ctx.fillStyle = AMBD; ctx.fillRect(CR.l, Y(360), CR.r - CR.l, 34); ctx.fillStyle = AMB; ctx.fillRect(CR.l, Y(356), CR.r - CR.l, 24);
    ctx.strokeStyle = AMBD; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(CR.l + 10, Y(330)); ctx.lineTo(CR.r - 10, Y(80)); ctx.moveTo(CR.r - 10, Y(330)); ctx.lineTo(CR.l + 10, Y(80)); ctx.stroke();
    // machinery house on top of the legs
    withShadow(8, () => { ctx.fillStyle = '#EFE6D6'; ctx.fillRect(CR.l + 10, Y(CR.b1 + 92), CR.r - CR.l - 20, 92); });
    ctx.fillStyle = '#9CC3E6'; for (let i = 0; i < 4; i++) ctx.fillRect(CR.l + 40 + i * 86, Y(CR.b1 + 70), 50, 30);
    // boom (box girder), tapered tip over the sea
    withShadow(10, () => { ctx.fillStyle = AMB; ctx.beginPath(); ctx.moveTo(CR.tip, Y(CR.b1 - 10)); ctx.lineTo(CR.back, Y(CR.b1)); ctx.lineTo(CR.back, Y(CR.b0)); ctx.lineTo(CR.tip + 120, Y(CR.b0)); ctx.lineTo(CR.tip, Y(CR.b0 + 26)); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = AMBL; ctx.fillRect(CR.tip + 40, Y(CR.b1), CR.back - CR.tip - 40, 8);
    ctx.fillStyle = AMBD; ctx.fillRect(CR.tip + 60, Y(CR.b0) - 8, CR.back - CR.tip - 60, 8);
    ctx.strokeStyle = 'rgba(110,74,28,.4)'; ctx.lineWidth = 2; for (let x = CR.tip + 140; x < CR.back - 10; x += 90) { if (x > 60 && x < 560) continue; ctx.beginPath(); ctx.moveTo(x, Y(CR.b1 - 8)); ctx.lineTo(x + 45, Y(CR.b0 + 8)); ctx.lineTo(x + 90, Y(CR.b1 - 8)); ctx.stroke(); }
    text('PORT DE KRIBI', 320, Y(CR.b0) - 13, { font: font(FF.stencil, 58, 900), align: 'center', color: '#3A1E08', ls: 5 });
    // trolley, cables, spreader
    const tx = 670, sh = spreaderH(t);
    ctx.fillStyle = '#3A3040'; rrect(tx - 80, Y(CR.b0) - 4, 160, 30, 6); ctx.fill();
    ctx.strokeStyle = '#231629'; ctx.lineWidth = 3.5; ctx.beginPath();
    for (const dx of [-60, -20, 20, 60]) { ctx.moveTo(tx + dx, Y(CR.b0) + 26); ctx.lineTo(tx + dx * 2.8, Y(sh) - 6); } ctx.stroke();
    ctx.fillStyle = '#2B2230'; rrect(tx - 260, Y(sh) - 22, 520, 22, 5); ctx.fill(); ctx.fillStyle = '#E9A23B'; ctx.fillRect(tx - 260, Y(sh) - 22, 520, 5);
    ctx.fillStyle = '#3A3040'; rrect(tx - 70, Y(sh) - 40, 140, 22, 6); ctx.fill();
    ctx.restore();
  }

  // ---------- the rest of the quay -------------------------------------------------------------
  function plainBox(x, h0, w, hh, col) {
    ctx.fillStyle = col; ctx.fillRect(x, Y(h0 + hh), w, hh);
    for (let xx = x + 12; xx < x + w - 10; xx += 16) { ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(xx, Y(h0 + hh) + 8, 6, hh - 16); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(xx + 6, Y(h0 + hh) + 8, 3, hh - 16); }
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x, Y(h0 + hh), w, 8); ctx.fillRect(x, Y(h0) - 8, w, 8); ctx.fillRect(x, Y(h0 + hh), 10, hh); ctx.fillRect(x + w - 10, Y(h0 + hh), 10, hh);
  }
  function ship(t, n) {
    const bob = Math.sin(stepT(n) * 1.3) * 5;
    at(-830, Y(40) + bob, Math.sin(stepT(n) * .9) * .004, 1, 1, () => {
      const cols = ['#B5462E', '#3E7C6B', '#C77A12', '#5A6E8C', '#8C5A7A', '#6E7F46'];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) { ctx.fillStyle = cols[(r * 5 + c * 2) % cols.length]; ctx.fillRect(-150 + c * 76, -150 - (r + 1) * 58, 72, 56);
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-150 + c * 76, -150 - (r + 1) * 58, 72, 6); }
      ctx.fillStyle = '#F4EFE6'; ctx.fillRect(-250, -350, 80, 200); ctx.fillStyle = '#9CC3E6'; ctx.fillRect(-244, -330, 68, 22);
      ctx.fillStyle = '#231629'; ctx.fillRect(-222, -392, 22, 44);
      withShadow(10, () => { ctx.fillStyle = '#26334D'; ctx.beginPath(); ctx.moveTo(-270, -150); ctx.lineTo(250, -150); ctx.lineTo(210, 60); ctx.lineTo(-240, 60); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#8C3A2B'; ctx.beginPath(); ctx.moveTo(-252, -20); ctx.lineTo(233, -20); ctx.lineTo(210, 60); ctx.lineTo(-240, 60); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-266, -150, 512, 6);
    });
  }
  function forklift(t, n) {
    at(175, Y(0), 0, 1, 1, () => {
      ctx.fillStyle = '#2B2230'; ctx.fillRect(-84, -265, 12, 265); ctx.fillRect(-70, -265, 10, 265);                                   // mast
      ctx.fillRect(-180, -44, 110, 10); ctx.fillRect(-180, -30, 110, 8);                                                                 // forks
      ctx.fillStyle = '#9C7447'; ctx.fillRect(-182, -58, 108, 14);                                                                       // pallet
      for (const [x, y, w, h] of [[-178, -128, 50, 70], [-124, -128, 48, 70], [-160, -186, 60, 58]]) { ctx.fillStyle = TEX.kraft; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(243,167,69,.8)'; ctx.fillRect(x, y + h * .4, w, 8); }
      withShadow(8, () => { ctx.fillStyle = C.orange; rrect(-62, -128, 150, 96, 14); ctx.fill(); });
      ctx.fillStyle = '#C44109'; rrect(58, -140, 38, 108, 10); ctx.fill();                                                               // counterweight
      ctx.strokeStyle = '#2B2230'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-48, -128); ctx.lineTo(-40, -262); ctx.lineTo(62, -262); ctx.lineTo(62, -140); ctx.stroke();
      ctx.fillStyle = '#231629'; rrect(-4, -170, 44, 44, 8); ctx.fill();                                                                // seat
      for (const x of [-34, 58]) { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(x, -26, 27, 0, 7); ctx.fill(); ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(x, -26, 11, 0, 7); ctx.fill(); }
    });
  }
  function print(t) {
    const w = PR.x1 - PR.x0, h = PR.h1 - PR.h0;
    at((PR.x0 + PR.x1) / 2, Y((PR.h0 + PR.h1) / 2), -.012, 1, 1, () => {
      photoPrint('kribi_crane', w, h, { fx_kind: 'duo', cols: DUO.green, zoom: 1.15, fx: .42, fy: .34, border: 14, lift: 8 });
      creditTag(CREDIT.kribi_crane, w / 2 - 8, -h / 2 + 42, { size: 20 });
    });
  }
  function waves(n) {
    const ts = stepT(n), cols = ['#5E9ED6', '#2F78BD', C.sea];
    cols.forEach((c, L) => { const yb = Y(46 - L * 42), ph = ts * (.9 + L * .4) + L * 1.7;
      const yy = x => yb + Math.sin(x * .016 + ph) * 9 + (rnd(Math.floor(x / 30) * 3.1 + L * 7) - .5) * 4;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-1260, Y(-170)); for (let x = -1260; x <= -548; x += 20) ctx.lineTo(x, yy(x)); ctx.lineTo(-548, Y(-170)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -1260; x <= -548; x += 20) x === -1260 ? ctx.moveTo(x, yy(x)) : ctx.lineTo(x, yy(x)); ctx.stroke(); });
  }
  function bollard(x) {
    at(x, GROUND + 26, 0, 1, 1, () => { ctx.fillStyle = 'rgba(60,32,12,.25)'; ctx.beginPath(); ctx.ellipse(8, 2, 30, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2B2230'; ctx.fillRect(-16, -44, 32, 44); ctx.beginPath(); ctx.ellipse(0, -44, 26, 10, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-12, -40, 6, 36); });
  }

  // ---------- Junior's poses (phone in hand, raised, pocketed, at the ear) ---------------------------
  const IDLE = [158, 262], READ = [62, 64], HOLD = [34, 104], POCK = [150, 236], EAR = [118, -118];
  const mixA = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const handPhone = (rot = -.12, dy = -30) => () => at(0, dy, rot, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = '#231629'; rrect(-34, -62, 68, 124, 14); ctx.fill(); });
    ctx.fillStyle = '#3A2F42'; rrect(-26, -54, 52, 108, 10); ctx.fill(); ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(-14, -40, 6, 0, 7); ctx.fill(); });
  function phoneOverlayK(t) { return clamp(eInOutCubic(prog(t, T.grow0, T.grow1)) * (1 - eInOutCubic(prog(t, T.shrink0, T.shrink1)))); }
  poseHook('junior', (t, st) => {
    tm(); if (t > T.mir1 + 2) return null;
    if (t < T.peek0) return { arms: ['idle', READ], handProp: handPhone(-.1, -34), handSide: 1, face: 'smile' };
    if (t < T.raise0) {
      const k = eInOutCubic(prog(t, T.peek0, T.peek0 + .6)), up = t >= T.bete + .05;
      const o = { arms: ['idle', mixA(READ, IDLE, k)], handProp: handPhone(-.1 + k * .1, lerp(-34, -10, k)), handSide: 1, look: lerp(0, .8, k) };
      if (up) Object.assign(o, { look: 1, face: t < T.bete + .9 ? 'shock' : 'worry', sweat: true });
      return o;
    }
    if (t < T.pock0) {
      const k = eInOutCubic(prog(t, T.raise0, T.raise1)), hide = phoneOverlayK(t) > .05;
      return { arms: [mixA(IDLE, HOLD, k), mixA(IDLE, HOLD, k)], handProp: hide ? null : handPhone(0, -20), handSide: 1, face: 'worry', look: lerp(1, 0, k), sweat: t < T.raise1 };
    }
    if (t < T.pock1 + .5) {
      const k = eInOutCubic(prog(t, T.pock0, T.pock1)), back = eInOutCubic(prog(t, T.pock1, T.pock1 + .5)), inPocket = t >= T.pock1 - .05;
      return { arms: [mixA(HOLD, IDLE, k), mixA(mixA(HOLD, POCK, k), IDLE, back)], handProp: inPocket ? null : handPhone(k * .4, -20), handSide: 1, face: 'worry' };
    }
    if (t < T.ear0) return { face: 'worry' };
    if (t < T.back1 + .45) {
      const k = eInOutCubic(prog(t, T.ear0, T.ear1)), kb = eInOutCubic(prog(t, T.back0, T.back1)), fin = eInOutCubic(prog(t, T.back1, T.back1 + .45));
      const inHand = t >= T.ear0 + .12 && t < T.back1 - .05;
      let a = k < .5 ? mixA(IDLE, POCK, k * 2) : mixA(POCK, EAR, k * 2 - 1);
      if (kb > 0) a = kb < .5 ? mixA(EAR, POCK, kb * 2) : mixA(POCK, IDLE, fin);
      return { arms: ['idle', a], handProp: inHand ? handPhone(.25, -18) : null, handSide: 1, face: t >= T.happy ? 'smile' : 'worry' };
    }
    return null;
  });
  poseHook('mireille', (t, st) => { tm(); if (t < T.mir0 || t >= T.mir1) return null;
    return { handProp: () => at(0, -10, -.12, 1, 1, () => mireilleDiary(120, 'MER.', { lift: 4 })), handSide: 1, face: 'smile' }; });

  // ---------- Junior's back-pocket phone (S4 → act 2): violet « ? » sticker visible ------------------
  function pocketState(t) { return t >= T.pock1 - .05 && t < T.pocketEnd && !(t >= T.ear0 + .12 && t < T.back1 - .05); }
  /** world position of the sticker on the pocket phone (for screen pointers) */
  function stickerWorld(t) { const st = actorAt('junior', t); return st ? { x: st.x + 62, y: st.y + 147 } : null; }
  function pocketPhone(t, n) {
    if (!pocketState(t)) return;
    const st = actorAt('junior', t); if (!st || (st.a ?? 1) <= .01 || !visX(st.x - 200, st.x + 200, t)) return;
    const b = walkBob(t, n, st.moving, 'junior'.length);
    ctx.save(); ctx.globalAlpha *= clamp(st.a ?? 1); ctx.translate(st.x, st.y + b.y); ctx.rotate(b.r); ctx.scale(FIG_S, FIG_S);
    if (st.moving) { const ph = stepT(n) * 1.9 * Math.PI * 2; ctx.translate(0, -Math.abs(Math.sin(ph)) * 10); ctx.translate(62, 250); ctx.rotate(Math.sin(ph) * .32 * .6); ctx.translate(-62, -250); }
    const sv = env(t, T.shiv11, T.shiv11 + .9, .1, .2) + env(t, T.shiv15, T.shiv15 + 1.1, .15, .3), jj = sv > 0 ? jit(77, n, 3 * sv) : { x: 0, y: 0, r: 0 };
    at(132 + jj.x, 318 + jj.y, -.3 + jj.r * 6, 1, 1, () => {
      withShadow(4, () => { ctx.fillStyle = '#231629'; rrect(-44, -80, 88, 160, 16); ctx.fill(); });
      ctx.fillStyle = '#3A2F42'; rrect(-36, -72, 72, 144, 11); ctx.fill();
      if (t < T.peel) { const lift = env(t, T.shiv15 + .1, T.shiv15 + 1.0, .25, .35);                   // S15: the flap lifts a millimetre
        at(0, -26, lift * -.5, 1, 1, () => qSticker(34, 1)); }
    });
    ctx.restore();
  }

  // ---------- screen overlays ----------------------------------------------------------------------
  function paperBubble(x, y, w, h, tail, o = {}) {                     // speech bubble on white paper with a tail towards `tail` {x,y}
    withShadow(10, () => { ctx.fillStyle = o.fill || '#FFFDF7'; rrect(x - w / 2, y - h / 2, w, h, 34); ctx.fill();
      if (tail) { const bx = clamp(tail.x, x - w / 2 + 60, x + w / 2 - 60), by = tail.y < y ? y - h / 2 + 4 : y + h / 2 - 4;
        ctx.beginPath(); ctx.moveTo(bx - 30, by); ctx.lineTo(tail.x, tail.y); ctx.lineTo(bx + 30, by); ctx.closePath(); ctx.fill(); } });
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 5; rrect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16, 28); ctx.stroke(); }
  }
  /** S1: the notification, readable, in a zoom callout above Junior (tail to the phone in his hand) */
  function notifCallout(t, n) {
    const k = prog(t, T.notif0, T.notif0 + .45), out = prog(t, T.notif1, T.notif1 + .35);
    if (k <= 0 || out >= 1) return;
    const st = actorAt('junior', t); if (!st) return;
    const hand = worldToScreen(st.x + 31, st.y + 12, t), cx = 540, cy = 470, ww = 780, wh = 300;
    const e = eOutBack(k, 1.4), eo = eInCubic(out), sc = lerp(.1, 1, clamp(e, 0, 1.2)) * (1 - eo * .9);
    const x = lerp(lerp(hand.x, cx, clamp(e)), hand.x, eo), y = lerp(lerp(hand.y, cy, clamp(e)), hand.y, eo);
    ctx.save(); ctx.globalAlpha *= clamp(k * 4) * (1 - eo);
    // tail from the callout to the phone in his hand
    const tl = { x: hand.x, y: hand.y - 30 };
    withShadow(10, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(x - 40 * sc, y + wh / 2 * sc - 6); ctx.lineTo(tl.x, tl.y); ctx.lineTo(x + 30 * sc, y + wh / 2 * sc - 6); ctx.closePath(); ctx.fill(); });
    at(x, y, -.015, sc, sc, () => {
      withShadow(14, () => { ctx.fillStyle = C.cream; rrect(-ww / 2 - 12, -wh / 2 - 12, ww + 24, wh + 24, 36); ctx.fill(); });
      ctx.save(); rrect(-ww / 2, -wh / 2, ww, wh, 28); ctx.clip();
      ctx.translate(0, 289); juniorPhone(820, 1600, { screen: 'notif', notif: eOutCubic(prog(t, T.notif0 + .08, T.notif0 + .5)), lift: 0 });
      ctx.restore();
      ctx.strokeStyle = 'rgba(35,22,41,.12)'; ctx.lineWidth = 2; rrect(-ww / 2, -wh / 2, ww, wh, 28); ctx.stroke();
    });
    ctx.restore();
  }
  /** S3–S4: the big brother's message on Junior's phone, filling the frame (grows out of his hands, shrinks back) */
  function bigPhone(t, n) {
    const e = phoneOverlayK(t); if (e <= 0) return;
    const st = actorAt('junior', t); if (!st) return;
    const hand = worldToScreen(st.x + 17, st.y + 42, t), z = camAt(t).z, s0 = 36 * z / PH.w;
    const s = lerp(s0, 1, e), x = lerp(hand.x, PH.cx, e), y = lerp(hand.y, PH.cy, e);
    const tr = env(t, T.trem0, T.trem1, .25, .25), wob = tr * Math.sin(stepT(n) * 17) * .006;
    const flap = tr * (.06 + .065 * Math.abs(Math.sin(stepT(n) * 23))), seal = 1 - tr * .025 * (1 + Math.sin(stepT(n) * 31));
    at(x, y, lerp(-.06, 0, e) + wob, s, s, () => {
      juniorPhone(PH.w, PH.h, { screen: 'message', seal, flap, lift: 22 });
      // --- the big brother's bubble appears, then writes itself word by word (masks over the unspoken words)
      const b = PH.w * .05, sx = -PH.w / 2 + b, sy = -PH.h / 2 + b * 2.2, u = (PH.w - 2 * b) / 100, by = sy + 36 * u, x0 = sx + 9 * u;
      const L = [['Petit', 'prix', 'sur', 'facture,'], ['mets', 'juste', '« chaussures »…'], ['moins', 'de', 'douane !']], f = font(FF.hand, 5.8 * u, 800);
      L.forEach((ws, i) => { let shown = 0; ws.forEach((w, j) => { if (t >= T.w[i][j] - .06) shown = j + 1; });
        const pre = ws.slice(0, shown).join(' '), rx = x0 + (shown ? measure(pre + ' ', f) : 0), base = by + 10 * u + i * 9.5 * u;
        if (shown < ws.length) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(rx - 2, base - 6.3 * u, sx + 93 * u - rx, 8.9 * u); } });
      const kb = eOutCubic(prog(t, T.bub, T.bub + .3));
      if (kb < 1) { ctx.fillStyle = `rgba(242,238,230,${1 - kb})`; ctx.fillRect(sx + 5 * u - 14, by - 14, 88 * u + 34, 38 * u + 34); }
      // --- S4: the finger hesitates over the sealed flap
      const f1 = eOutCubic(prog(t, T.fing0, T.fing0 + .45)), f2 = eInCubic(prog(t, T.fing1, T.fing1 + .4)), fk = f1 * (1 - f2);
      if (fk > 0) { const hes = Math.sin(stepT(n) * 5.2) * 14 + Math.sin(stepT(n) * 2.1) * 22;
        fingerTap(90 + hes * .4, lerp(760, 200, fk) + hes, 0, FINGER); }
    });
  }
  /** S4: a violet hand-drawn arrow points at the « ? » sticker in his back pocket */
  function pocketArrow(t, n) {
    const k = prog(t, T.arrow0, T.arrow0 + .5), out = prog(t, T.arrow1 - .35, T.arrow1); if (k <= 0 || out >= 1) return;
    const p = stickerWorld(t); if (!p) return; const s = worldToScreen(p.x, p.y, t);
    ctx.save(); ctx.globalAlpha *= 1 - out;
    handArrow([[s.x + 250, s.y - 250], [s.x + 205, s.y - 120], [s.x + 70, s.y - 40]], eOutCubic(k), C.violet, 9);
    ctx.restore();
  }
  /** S5: the polaroid (Mireille already at Kribi's gate, diary in hand) */
  function polaroidPic(w, h, n) {
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#F6F0E2'); g.addColorStop(1, '#DCE9EF'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(70,90,110,.3)'; ctx.fillRect(90, -120, 16, 170); ctx.fillRect(10, -120, 200, 12); ctx.fillRect(160, -110, 10, 60);        // far crane
    ctx.fillStyle = '#C9B48E'; ctx.fillRect(-w / 2, 70, w, h / 2 - 70);                                                                      // ground
    ctx.fillStyle = '#E7DCC6'; ctx.fillRect(10, -40, 40, 116); ctx.fillRect(150, -40, 40, 116);                                             // port gate
    ctx.fillStyle = DC.green; ctx.fillRect(0, -62, 200, 28);
    text('PORT', 100, -40, { font: font(FF.stencil, 24, 900), align: 'center', color: '#fff', ls: 3 });
    for (let x = 60; x < 190; x += 26) { ctx.fillStyle = (x / 26) % 2 < 1 ? DC.red : '#fff'; ctx.fillRect(x, 30, 26, 12); }
    at(-70, -10, 0, .36, .36, () => mireilleFig({ face: 'smile', arms: ['idle', [96, -60]], handSide: 1, handProp: () => at(0, -40, -.1, 1, 1, () => mireilleDiary(150, 'MER.', { lift: 4 })) }));
  }
  function polPose(t) {
    const k = prog(t, T.pol0, T.pol1), out = prog(t, T.out0, T.out1); if (k <= 0 || out >= 1) return null;
    const e = eOutCubic(k), eo = eInCubic(out), w = 420, iw = 384, band = 84;
    return { x: 712 + eo * 140, y: lerp(1500, 505, e) + eo * 1300, r: lerp(-.28, .05, e) + eo * .25, w, iw, band, hh: iw + 18 + band };
  }
  function polaroid(P, n) {
    const { x, y, r, w, iw, hh } = P;
    at(x, y, r, 1, 1, () => {
      withShadow(16, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2, -hh / 2, w, hh); });
      ctx.save(); ctx.beginPath(); ctx.rect(-iw / 2, -hh / 2 + 18, iw, iw); ctx.clip(); ctx.translate(0, -hh / 2 + 18 + iw / 2); polaroidPic(iw, iw, n); ctx.restore();
      text('Tantine Mireille', 0, hh / 2 - 26, { font: font(FF.hand, 44, 800), align: 'center', color: C.ink });
      ctx.fillStyle = C.tape; at(0, -hh / 2 + 2, -.04, 1, 1, () => ctx.fillRect(-60, -18, 120, 36));
    });
  }
  function callCord(t, n, pol) {
    const k = prog(t, T.cord, T.cord + .5), out = prog(t, T.out0, T.out0 + .35); if (k <= 0 || out >= 1 || !pol) return;
    const st = actorAt('junior', t); if (!st) return; const a = worldToScreen(st.x + 62, st.y - 70, t);
    const cs = Math.cos(pol.r), sn = Math.sin(pol.r), bx = pol.x + (-pol.w / 2) * cs - (-40) * sn, by = pol.y + (-pol.w / 2) * sn + (-40) * cs;
    const pts = []; for (let i = 0; i <= 24; i++) { const q = i / 24, wv = Math.sin(q * Math.PI * 3 + stepT(n) * 2) * 26 * Math.sin(q * Math.PI);
      pts.push([lerp(a.x, bx, q) + wv * .5, lerp(a.y, by, q) - Math.sin(q * Math.PI) * 60 + wv]); }
    ctx.save(); ctx.globalAlpha *= 1 - out; thread(pts, eOutCubic(k), n, { w: 5, color: C.violet }); ctx.restore();
    const rk = env(t, T.cord - .3, T.cord + .7, .1, .3);                                                  // it rings
    if (rk > 0) { ctx.save(); ctx.strokeStyle = C.violet; ctx.lineCap = 'round'; ctx.globalAlpha *= rk; for (let i = 0; i < 2; i++) { const rr = 26 + i * 22 + (stepT(n) * 60) % 22;
      ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(a.x + 20, a.y - 10, rr, -1.1, .2); ctx.stroke(); } ctx.restore(); }
  }
  function diary(t, n) {
    const k = prog(t, T.diary, T.diary + .5), out = prog(t, T.out0 + .05, T.out1 + .05); if (k <= 0 || out >= 1) return;
    const e = eOutBack(k, 1.3), eo = eInCubic(out), w = 380, h = w * 1.25;
    const opt = { tab: 'VENDREDI · POIVRE → KRIBI', lift: 14 };
    const note = 'Au port, chaque\njour de trop\nse paie.', NL = note.split('\n');
    at(292 - (1 - clamp(e)) * 420 - eo * 60, 520 + eo * 1300, -.05 + (1 - clamp(e)) * -.3 + eo * -.2, clamp(e, 0, 1.1), clamp(e, 0, 1.1), () => {
      mireilleDiary(w, 'MER.', opt);
      if (t > T.note[0]) {                                                // her line, written in the diary as she says it
        const f = font(FF.hand, w * .062, 800); ctx.save(); ctx.beginPath();
        NL.forEach((l, i) => { const kk = prog(t, T.note[i], T.note[i + 1]); if (kk <= 0) return; const x0 = -w / 2 + w * .08, yb = -h / 2 + h * (.3 + i * .08);
          ctx.rect(x0 - 6, yb - w * .062 * 1.05, (measure(l, f) + 12) * kk, w * .062 * 1.45); });
        ctx.clip(); mireilleDiary(w, 'MER.', Object.assign({}, opt, { note, lift: 0 })); ctx.restore();
      }
    });
  }
  function mireilleBubble(t, n) {
    const k = prog(t, T.bub1, T.bub1 + .35), out = prog(t, T.out0, T.out0 + .35); if (k <= 0 || out >= 1) return;
    const e = eOutBack(k, 1.6), cx = 668, cy = 915, w = 600, h = 236;
    ctx.save(); ctx.globalAlpha *= 1 - out;
    at(cx, cy + eInCubic(out) * 200, -.02, clamp(e, 0, 1.2), clamp(e, 0, 1.2), () => {
      paperBubble(0, 0, w, h, { x: -40, y: -h / 2 - 46 }, { stroke: C.orange });
      text("J'arrive !", -w / 2 + 40, -h / 2 + 82, { font: font(FF.hand, 64, 800), color: C.orange });
      const L2 = ['Au port, chaque jour', 'de trop se paie.'], ks = [prog(t, T.w2[0], T.w2[1]), prog(t, T.w2[2], T.w2[3])];
      L2.forEach((l, i) => handText(l, -w / 2 + 40, -h / 2 + 148 + i * 54, 44, { align: 'left', write: ks[i], pen: false, color: C.ink }));
    });
    ctx.restore();
  }

  // ---------- scenes -------------------------------------------------------------------------------
  registerScene({ id: 'A20_back', z: 20, draw(t, n) {
    tm(); if (!visX(-1300, 1150, t, 200)) return;
    ctx.save(); worldBegin(t);
    ctx.fillStyle = '#2F78BD'; ctx.fillRect(-1260, Y(70), 712, 220);                               // the sea (on the board)
    ctx.fillStyle = '#5E9ED6'; ctx.fillRect(-1260, Y(70), 712, 16);
    ship(t, n);
    print(t);
    plainBox(-405, 0, 182, 150, '#B5462E'); plainBox(-220, 0, 182, 150, '#3E7C6B'); plainBox(-315, 150, 182, 150, '#C77A12');   // plain stacks (no text)
    ctx.restore();
  } });
  registerScene({ id: 'A20_crane', z: 22, draw(t, n) {
    tm(); if (!visX(CR.tip, CR.back, t, 200)) return;
    ctx.save(); worldBegin(t); crane(t, n); ctx.restore();
  } });
  registerScene({ id: 'A20_container', z: 24, draw(t, n) {
    tm(); const c = containerAt(t); if (!c || c.onTruck || !visX(c.x - 420, c.x + 420, t)) return;
    const L = contLift(t), sq = t > T.land ? Math.exp(-(t - T.land) * 9) * Math.sin((t - T.land) * 38) * .025 : 0;
    ctx.save(); worldBegin(t);
    if (L.h < 60) { ctx.fillStyle = `rgba(60,32,12,${.22 * (1 - L.h / 60)})`; ctx.beginPath(); ctx.ellipse(c.x + 20, GROUND + 4, CW * .55, 16, 0, 0, 7); ctx.fill(); }
    at(c.x, c.y - L.h, L.sway, 1 + sq, 1 - sq, () => container({ n,
      peek: eInOutCubic(prog(t, T.peek0, T.peek0 + .7)) * (1 - eInOutCubic(prog(t, T.peekC, T.peekC + .6))),
      garland: prog(t, T.garl, T.garl + .6), shoe: prog(t, T.shoe, T.shoe + .35) * (1 - prog(t, T.peekC - .2, T.peekC + .1)) }));
    if (t > T.land && t < T.land + .5) {                                                               // paper dust puffs
      const s = t - T.land; ctx.fillStyle = `rgba(230,210,180,${.7 * (1 - s / .5)})`;
      for (let i = 0; i < 7; i++) { const dx = (i - 3) * 110 + (rnd(i) - .5) * 40; ctx.beginPath(); ctx.arc(c.x + dx + Math.sign(dx) * s * 120, GROUND - 10 - s * 50 * rnd(i + 3), 14 + s * 30, 0, 7); ctx.fill(); }
    }
    // the violet thread climbs from the stage edge to the lashing ring and is knotted there
    const kk = eOutCubic(prog(t, T.land + .05, T.land + .5));
    if (kk > 0) { const p0 = [X.quai + 260, GROUND + 70], p1 = [c.x + 120, GROUND - 12];
      thread([p0, [lerp(p0[0], p1[0], .4) - 10, lerp(p0[1], p1[1], .5) + 6], p1], kk, n, { w: 9, color: C.violet });
      if (kk >= 1) { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(p1[0], p1[1] + 2, 10, 0, 7); ctx.fill();
        ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p1[0], p1[1] + 4); ctx.quadraticCurveTo(p1[0] + 16, p1[1] + 26, p1[0] + 10, p1[1] + 44); ctx.moveTo(p1[0], p1[1] + 4); ctx.quadraticCurveTo(p1[0] - 18, p1[1] + 22, p1[0] - 24, p1[1] + 36); ctx.stroke(); } }
    ctx.restore();
  } });
  registerScene({ id: 'A20_forklift', z: 26, draw(t, n) {
    tm(); if (!visX(-20, 300, t)) return; ctx.save(); worldBegin(t); forklift(t, n); ctx.restore();
  } });
  registerScene({ id: 'A20_pocket', z: 31, draw(t, n) {
    tm(); ctx.save(); worldBegin(t); pocketPhone(t, n); ctx.restore();
  } });
  registerScene({ id: 'A20_front', z: 35, draw(t, n) {
    tm(); if (!visX(-1300, -150, t)) return;
    ctx.save(); worldBegin(t);
    ctx.fillStyle = '#CFC6B4'; ctx.fillRect(-566, Y(46), 26, 216); ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(-548, Y(46), 8, 216);   // quay wall
    for (const h of [10, -60]) { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(-572, Y(h), 20, 0, 7); ctx.fill(); ctx.fillStyle = '#3A3040'; ctx.beginPath(); ctx.arc(-572, Y(h), 9, 0, 7); ctx.fill(); }
    waves(n);
    ctx.strokeStyle = '#C9B48E'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-480, GROUND - 14); ctx.quadraticCurveTo(-560, GROUND + 40, -640, Y(20)); ctx.stroke();   // mooring line
    bollard(-480); bollard(-270);
    ctx.restore();
  } });
  registerScene({ id: 'A20_hud', z: 44, draw(t, n) {
    tm(); if (t > T.out1 + .2) return;
    notifCallout(t, n);
    bigPhone(t, n);
    pocketArrow(t, n);
    if (t > T.cord - .5) { const pol = polPose(t); callCord(t, n, pol); if (pol) polaroid(pol, n); diary(t, n); mireilleBubble(t, n); }
  } });
})();

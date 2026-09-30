'use strict';
// =============================================================================================
// 24 · LE KIOSQUE « TRANSIT » (S8–S9) — a small paper office at world x ≈ 2210–2830 (X.transit = 2300).
//  Always there: awning « TRANSIT », framed sign « AGRÉÉ EN DOUANE » (text only, no emblem), a shelf of binders, the counter
//  with an empty document tray, and the transitaire (brokerFig + round glasses: calm, serious, never complicit).
//  S8 « transitaire »  : on-screen strip « SON TRANSITAIRE » (+ « AGRÉÉ EN DOUANE » written on « agréé ») pointing at him.
//     « c'est lui qui déclare » : he lifts his pen. Mireille: « Tes papiers ? » → Junior pulls out an impeccable kraft folder
//                         → Mireille raises her eyebrows: « Bien rangé ! ».
//  S9 « transmis »     : the folder flies onto the counter and opens: left flap = the envelope « DOUANE · MIS DE CÔTÉ » (he pays
//                         with it in S21), right flap = the papers + the green goods passport (violet ribbon).
//     « facture · connaissement · liste de colisage » : one sheet per word flies into the tray (cascade: every header stays
//                         readable); « autres pièces » : a kraft tag « + autres pièces / obligatoires ».
//     « Déclaration »     : the transitaire raises his green declaration slip; the passport takes off (→ 46_passeport stamps
//                         « DÉCLARÉ · avant l'arrivée ») ; then the folder closes and flies back into Junior's hands.
//  The documents stay in the tray afterwards. The transitaire leaves the kiosk once the camera is gone (S10) — the guichet
//  station can draw him with the same look via T24.broker().
// z 24 (world: office + transitaire) · z 35 (world: counter, tray, documents, folder, flights) · z 46 (screen: strip, bubbles)
// =============================================================================================
(() => {
  const BX = 2660;                                                   // the transitaire (behind the counter)
  const CT = { x0: 2230, x1: 2800, y: 955 };                         // counter front (top at y)
  const FRM = { x: 2410, y: 572, w: 252, h: 134 };                   // framed sign
  const COL = 2410, SW = 280;                                        // document column (tray) centre, sheet width
  const SLOTS = [{ kind: 'facture', top: 655, r: -.022, dx: -4 }, { kind: 'connaissement', top: 715, r: .016, dx: 5 }, { kind: 'colisage', top: 775, r: -.012, dx: -2 }];
  const TAGS = { top: 836, r: .03, dx: 6 };
  const FX = 2490, FY = 1062, PW = 210, PH = 168;                    // folder on the counter front: spine x, centre y, panel size
  const PASS = [FX + 150, FY + 20];                                  // the passport lying in the folder (world)
  const TITLES = { facture: 'FACTURE', connaissement: 'CONNAISSEMENT', colisage: 'LISTE DE COLISAGE' };

  let K = null;
  const keys = () => K || (K = (() => {
    const k = {
      arrive: tw('S8', 'transitaire', 0), strip0: tw('S8', 'transitaire', .2), strip2: tw('S8', 'agree', 0), strip1: tw('S8', 'declare', -.35),
      pen0: tw('S8', 'lui', -.1), pen1: te('S8', 'declare', .35),
      ask0: tw('S8', 'declare', -.2), fold: tw('S8', 'declare', .45),
      give: tw('S9', 'transmis', 0),
      docs: [tw('S9', 'facture', -.02), tw('S9', 'connaissement', -.02), tw('S9', 'liste', -.02)], tag: tw('S9', 'autres', 0),
      slip0: tw('S9', 'Declaration', -.6), slip1: tw('S9', 'Declaration', .2), pt: tw('S9', 'Declaration', -.05),
      close: se('S9', -.25), leave: tw('S10', 'trois', .5), tuck: tw('S10', 'trois', .1),
    };
    k.ask1 = k.ask0 + 1.5; k.wow = k.fold + .45; k.neat0 = k.ask1 + .05; k.neat1 = Math.max(k.neat0 + 2.1, k.docs[0] - .05);
    k.land = k.give + .5; k.open = k.land + .12; k.back0 = k.close + .32; k.back1 = k.back0 + .45;
    return k; })());
  let SH = false;
  function lazyShakes() { if (SH) return; SH = true; const k = keys(); addShake(k.land, 4, .12); k.docs.forEach(d => addShake(d + .3, 3, .1)); addShake(k.tag + .3, 2, .1); }

  // ---------- the transitaire: brokerFig + round glasses (exported for the guichet station) ----------
  function glasses(o = {}) {                                         // figure units, same head transform as person()
    ctx.save(); ctx.translate(o.look ? o.look * 8 : 0, -150); if (o.tilt) ctx.rotate(o.tilt);
    ctx.strokeStyle = '#231629'; ctx.lineWidth = 7;
    for (const s of [-1, 1]) { ctx.fillStyle = 'rgba(210,235,255,.22)'; ctx.beginPath(); ctx.arc(s * 40, -4, 29, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(0, -16, 12, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-69, -8); ctx.lineTo(-98, -2); ctx.moveTo(69, -8); ctx.lineTo(98, -2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 40, -4, 20, 3.6, 4.3); ctx.stroke(); }
    ctx.restore();
  }
  function brokerFull(o = {}) { brokerFig(o); glasses(o); }
  window.T24 = { broker: brokerFull, glasses, passportWorld: PASS, takeoff: () => keys().pt };

  const pen = () => { at(0, 0, -.9, 1, 1, () => { ctx.fillStyle = C.ink; rrect(-8, -70, 16, 110, 6); ctx.fill(); ctx.fillStyle = C.amber; ctx.fillRect(-8, -70, 16, 20); }); };
  const slipProp = () => at(0, -40, -.08, 1, 1, () => {            // the green declaration slip (figure units)
    withShadow(6, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-90, -120, 180, 150); });
    ctx.fillStyle = DC.green; ctx.fillRect(-90, -120, 180, 36);
    ctx.strokeStyle = DC.line; ctx.lineWidth = 4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-70, -60 + i * 22); ctx.lineTo(60 - (i % 2) * 40, -60 + i * 22); ctx.stroke(); }
  });
  function brokerState(t) {
    const k = keys(), o = { face: 'smile', arms: [[96, 206], [96, 206]], look: 0, blink: (t % 3.7) < .12 };
    if (t >= k.arrive - 1 && t < k.pen0) o.look = -.45;
    if (t >= k.strip0 && t < k.strip0 + 1.2) o.tilt = Math.sin((t - k.strip0) * 7) * .05 * (1 - (t - k.strip0) / 1.2);   // a small nod
    if (t >= k.pen0 && t < k.pen1) Object.assign(o, { arms: [[96, 206], [150, 40]], handProp: pen, handSide: 1, look: -.2 });
    if (t >= k.fold && t < k.docs[0]) o.look = -.7;
    if (t >= k.docs[0] - .2 && t < k.slip0) Object.assign(o, { look: -.75, face: t < k.docs[2] + .5 ? 'think' : 'smile' });
    if (t >= k.slip0 && t < k.slip1 + .3) Object.assign(o, { arms: [[190, -30], [96, 206]], handProp: slipProp, handSide: -1, look: -.5 });
    return o;
  }

  // ---------- the office (back) ----------
  function office(t, n) {
    const k = keys();
    // back wall + side posts
    withShadow(14, () => { ctx.fillStyle = '#DCE4E6'; ctx.fillRect(2250, 470, 550, GROUND - 470); });
    ctx.strokeStyle = 'rgba(60,80,90,.10)'; ctx.lineWidth = 3; for (let x = 2290; x < 2800; x += 56) { ctx.beginPath(); ctx.moveTo(x, 500); ctx.lineTo(x, GROUND); ctx.stroke(); }
    ctx.fillStyle = C.kraftD; ctx.fillRect(2236, 430, 30, GROUND - 430); ctx.fillRect(2784, 430, 30, GROUND - 430);
    // shelf of binders (office feel)
    ctx.fillStyle = C.kraftD; ctx.fillRect(2600, 612, 196, 12);
    ['#1D4577', C.violetD, '#C77A12', DC.green, '#1D4577', C.orange, C.violetD].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(2610 + i * 26, 540 + (i % 3) * 6, 21, 72 - (i % 3) * 6);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(2614 + i * 26, 566, 13, 16); });
    // framed sign « AGRÉÉ EN DOUANE » (text only)
    at(FRM.x, FRM.y, -.012, 1, 1, () => {
      withShadow(10, () => { ctx.fillStyle = '#6B4A2A'; rrect(-FRM.w / 2, -FRM.h / 2, FRM.w, FRM.h, 6); ctx.fill(); });
      ctx.fillStyle = '#FFFDF7'; ctx.fillRect(-FRM.w / 2 + 12, -FRM.h / 2 + 12, FRM.w - 24, FRM.h - 24);
      text('AGRÉÉ', 0, -6, { font: font(FF.stencil, 50, 900), align: 'center', color: DC.green, ls: 3 });
      text('EN DOUANE', 0, 44, { font: font(FF.stencil, 46, 900), align: 'center', color: DC.green, ls: 2 });
      const g = t - k.strip2; if (g > 0 && g < .8) { ctx.save(); ctx.beginPath(); ctx.rect(-FRM.w / 2 + 12, -FRM.h / 2 + 12, FRM.w - 24, FRM.h - 24); ctx.clip();
        const x = lerp(-FRM.w, FRM.w, g / .8); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 60, -FRM.h, 120, FRM.h * 2); ctx.restore(); }
      ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, -FRM.h / 2 - 18, 6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#231629'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-60, -FRM.h / 2); ctx.lineTo(0, -FRM.h / 2 - 18); ctx.lineTo(60, -FRM.h / 2); ctx.stroke();
    });
    // awning with « TRANSIT »
    withShadow(10, () => { ctx.fillStyle = '#2E4E63'; ctx.beginPath(); ctx.moveTo(2206, 430); ctx.lineTo(2834, 430); ctx.lineTo(2834, 488);
      for (let x = 2834; x > 2206; x -= 52.3) ctx.quadraticCurveTo(x - 26, 510, x - 52.3, 488); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(2206, 432, 628, 6);
    text('TRANSIT', 2480, 482, { font: font(FF.stencil, 56, 900), align: 'center', color: C.cream, ls: 6 });
    // the transitaire (behind the counter)
    if (t < k.leave) { const o = brokerState(t); at(BX, feetY, 0, FIG_S, FIG_S, () => brokerFull(o)); }
  }

  // ---------- documents ----------
  function fitFont(s, fam, max, maxW, ls = 0) { const w = measure(s, font(fam, max, 900), ls); return font(fam, w > maxW ? max * maxW / w : max, 900); }
  function sheet(kind, w, h) {                                       // origin = top centre
    const band = (DOCS[kind] || DOCS.facture).band;
    withShadow(6, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-w / 2, 0, w, h); });
    ctx.fillStyle = band; ctx.fillRect(-w / 2, 0, w, 58);
    text(TITLES[kind], 0, 44, { font: fitFont(TITLES[kind], FF.stencil, 36, w - 22), align: 'center', color: kind === 'colisage' ? C.ink : '#fff' });
    ctx.strokeStyle = DC.line; ctx.lineWidth = 3;
    for (let y = 86, i = 0; y < h - 16; y += 30, i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 22, y); ctx.lineTo(w / 2 - 22 - (i % 3) * 50, y); ctx.stroke(); }
    if (kind === 'connaissement') at(w / 2 - 50, 100, 0, .9, .9, () => iconShip(DC.blue));
    if (kind === 'colisage') { ctx.strokeStyle = 'rgba(199,122,18,.6)'; ctx.lineWidth = 2.5; for (let i = 0; i < 4; i++) ctx.strokeRect(-w / 2 + 22 + i * 44, 76, 36, 28); }
  }
  function morePieces() {                                            // kraft tag « + autres pièces / obligatoires », origin = top centre
    withShadow(8, () => { ctx.fillStyle = '#E6C79C'; ctx.beginPath(); ctx.moveTo(-145, 12); ctx.lineTo(-133, 0); ctx.lineTo(133, 0); ctx.lineTo(145, 12); ctx.lineTo(145, 110); ctx.lineTo(-145, 110); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    text('+ autres pièces', 0, 50, { font: font(FF.body, 35, 800), align: 'center', color: C.ink });
    text('obligatoires', 0, 94, { font: font(FF.body, 35, 800), align: 'center', color: C.ink });
  }
  const slotPos = i => { const s = i < 3 ? SLOTS[i] : TAGS; return { x: COL + s.dx, y: s.top, r: s.r }; };
  const sheetH = i => 950 - SLOTS[i].top;
  function drawItem(i) { if (i < 3) sheet(SLOTS[i].kind, SW, sheetH(i)); else morePieces(); }
  /** document i state: null (still in the folder) | {x, y, r, s, sy} (flying or landed), origin = top centre */
  function docState(i, t) {
    const k = keys(), t0 = i < 3 ? k.docs[i] : k.tag; if (t < t0) return null;
    const e = slotPos(i), src = [FX + 105, FY - 30], u = clamp((t - t0) / .3), ke = eOutCubic(u);
    if (u < 1) return { x: lerp(src[0], e.x, ke), y: lerp(src[1] - 80, e.y, ke) - Math.sin(u * Math.PI) * 150, r: e.r + (1 - ke) * (i % 2 ? .35 : -.35), s: lerp(.42, 1, ke), sy: 1 };
    const s = t - t0 - .3, sq = Math.exp(-s * 9) * Math.cos(s * 38) * .05; return { x: e.x, y: e.y, r: e.r, s: 1, sy: 1 - sq };
  }

  // ---------- Junior's kraft folder ----------
  function folderCover(w, h, o = {}) {                               // closed folder front, centred
    withShadow(o.lift ?? 8, () => { ctx.fillStyle = TEX.kraft; rrect(-w / 2, -h / 2, w, h, 8); ctx.fill(); });
    [C.violet, DC.blue, C.amber].forEach((c, i) => { ctx.fillStyle = c; rrect(-w / 2 + 18 + i * w * .2, -h / 2 - h * .07, w * .16, h * .12, 4); ctx.fill(); });
    ctx.fillStyle = TEX.kraft; rrect(-w / 2, -h / 2, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = Math.max(2, w * .012); rrect(-w / 2 + w * .05, -h / 2 + h * .06, w * .9, h * .88, 6); ctx.stroke();
    ctx.fillStyle = C.violet; ctx.fillRect(w * .28, -h / 2, w * .06, h);                        // violet elastic band
    ctx.fillStyle = '#FFFDF7'; rrect(-w * .36, -h * .12, w * .5, h * .26, 5); ctx.fill();      // label
    ctx.strokeStyle = 'rgba(35,22,41,.45)'; ctx.lineWidth = Math.max(2, w * .012); ctx.beginPath(); ctx.moveTo(-w * .3, 0); ctx.quadraticCurveTo(-w * .2, -h * .06, -w * .12, h * .01); ctx.quadraticCurveTo(-w * .04, h * .07, w * .06, -h * .01); ctx.stroke();
  }
  function envelope() {                                              // « DOUANE · MIS DE CÔTÉ », centred, 200×124
    withShadow(6, () => { ctx.fillStyle = '#F3E6C8'; ctx.fillRect(-100, -62, 200, 124); });
    ctx.fillStyle = '#9FC7A6'; ctx.save(); at(40, -64, .12, 1, 1, () => { ctx.fillRect(-40, -14, 80, 30); ctx.strokeStyle = DC.green; ctx.lineWidth = 2; ctx.strokeRect(-36, -10, 72, 22); }); ctx.restore();
    ctx.fillStyle = '#E6D3AC'; ctx.beginPath(); ctx.moveTo(-100, -62); ctx.lineTo(100, -62); ctx.lineTo(0, -18); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 2; ctx.stroke();
    text('DOUANE', 0, 18, { font: font(FF.stencil, 40, 900), align: 'center', color: DC.green, ls: 2 });
    text('MIS DE CÔTÉ', 0, 54, { font: font(FF.stencil, 35, 900), align: 'center', color: C.ink, ls: 1 });
  }
  function miniPassport(w) {                                         // same look as the 46 booklet, closed (w × 1.3w)
    const h = w * 1.3; withShadow(5, () => { ctx.fillStyle = DC.green; rrect(-w / 2, -h / 2, w, h, 6); ctx.fill(); });
    ctx.strokeStyle = 'rgba(246,197,74,.9)'; ctx.lineWidth = 2; rrect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4); ctx.stroke();
    ctx.fillStyle = DC.yellow; ctx.fillRect(-w * .3, -h * .28, w * .6, h * .07); ctx.fillRect(-w * .22, -h * .15, w * .44, h * .04);
    ctx.fillStyle = C.violet; ctx.fillRect(-w / 2 + w * .12, h / 2 - 4, w * .1, h * .22);
  }
  /** the folder on the counter front: origin = spine (FX, FY); open 0..1 */
  function folderOpen(open, t) {
    const k = keys(), sx = Math.cos(clamp(open) * Math.PI);
    // right panel: inside back with the papers still to hand over + the passport
    withShadow(6, () => { ctx.fillStyle = '#D9B47C'; rrect(0, -PH / 2, PW, PH, 8); ctx.fill(); });
    const left = [0, 1, 2, 3].filter(i => !docState(i, t));             // papers still in the folder (first to go = on top)
    for (let j = left.length - 1; j >= 0; j--) { const i = left[j]; at(PW / 2 - 12 + j * 5, -8 + j * 6, (j - 1) * .03, 1, 1, () => { ctx.fillStyle = i === 3 ? '#E6C79C' : '#FFFDF7'; ctx.fillRect(-80, -64, 160, 120);
      ctx.fillStyle = [C.violetD, DC.blue, C.amber, C.kraftD][i]; ctx.fillRect(-80, -64, 160, 18); }); }
    if (t < k.pt) at(PASS[0] - FX, PASS[1] - FY, .06, 1, 1, () => miniPassport(80));
    // cover
    if (sx > 0) at(0, 0, 0, sx, 1, () => at(PW / 2, 0, 0, 1, 1, () => folderCover(PW, PH, { lift: 8 })));
    else at(0, 0, 0, -sx, 1, () => { withShadow(6, () => { ctx.fillStyle = '#E8CD98'; rrect(-PW, -PH / 2, PW, PH, 8); ctx.fill(); });
      ctx.fillStyle = '#D2AE72'; ctx.fillRect(-PW + 8, PH * .12, PW - 16, PH * .36);                 // pocket
      at(-PW / 2, -6, -.02, 1, 1, envelope);
      ctx.fillStyle = '#9AA1A8'; ctx.fillRect(-PW / 2 - 8, -76, 16, 30); });                          // paper clip
  }
  const handW = (st, hx, hy) => [st.x + hx * FIG_S, st.y + hy * FIG_S];
  function counterFront(t, n) {
    const k = keys();
    // counter slab + front
    withShadow(14, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(CT.x0, CT.y, CT.x1 - CT.x0, GROUND - CT.y); });
    ctx.fillStyle = C.kraftD; ctx.fillRect(CT.x0 - 16, CT.y - 17, CT.x1 - CT.x0 + 32, 24);
    ctx.fillStyle = 'rgba(255,240,210,.3)'; ctx.fillRect(CT.x0 - 16, CT.y - 17, CT.x1 - CT.x0 + 32, 5);
    ctx.strokeStyle = 'rgba(90,60,30,.3)'; ctx.lineWidth = 3; for (let x = CT.x0 + 95; x < CT.x1; x += 95) { ctx.beginPath(); ctx.moveTo(x, CT.y + 8); ctx.lineTo(x, GROUND - 6); ctx.stroke(); }
    // tray back rim, documents (back → front), tray front, then the « + autres pièces » tag hanging over it
    ctx.fillStyle = '#5A4A3A'; ctx.fillRect(COL - SW / 2 - 12, 922, SW + 24, 6);
    for (let i = 0; i < 3; i++) { const d = docState(i, t); if (!d || d.s < 1) continue; at(d.x, d.y, d.r, 1, d.sy, () => drawItem(i)); }
    withShadow(6, () => { ctx.fillStyle = '#7A5A3A'; rrect(COL - SW / 2 - 14, 926, SW + 28, 30, 5); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(COL - SW / 2 - 10, 930, SW + 20, 4);
    { const d = docState(3, t); if (d && d.s >= 1) at(d.x, d.y, d.r, 1, d.sy, () => drawItem(3)); }
    // Junior's folder: flight to the counter, open / close, flight back
    const J = actorAt('junior', t);
    if (t >= k.give && t < k.back1 && J) {
      if (t < k.land) { const u = clamp((t - k.give) / (k.land - k.give)), ke = eInOutCubic(u), s0 = handW(J, 330, -70), e = [FX + PW / 2, FY];
        at(lerp(s0[0], e[0], ke), lerp(s0[1], e[1], ke) - Math.sin(u * Math.PI) * 130, (1 - ke) * -.4, lerp(.714, 1, ke), lerp(.714, 1, ke), () => folderCover(PW, PH, { lift: 20 })); }
      else if (t < k.back0) { const s = t - k.land, sq = Math.exp(-s * 9) * Math.cos(s * 38) * .06, op = eInOutCubic(clamp((t - k.open) / .4)) * (1 - eInOutCubic(clamp((t - k.close) / .3)));
        at(FX, FY, 0, 1 + sq, 1 - sq, () => folderOpen(op, t)); }
      else { const u = clamp((t - k.back0) / (k.back1 - k.back0)), ke = eInOutCubic(u), e = handW(J, 0, 150), s0 = [FX + PW / 2, FY];
        at(lerp(s0[0], e[0], ke), lerp(s0[1], e[1], ke) - Math.sin(u * Math.PI) * 110, (ke) * .1, lerp(1, .714, ke), lerp(1, .714, ke), () => folderCover(PW, PH, { lift: 20 })); }
    }
    // flying documents (on top of everything at the counter)
    for (let i = 0; i < 4; i++) { const d = docState(i, t); if (!d || d.s >= 1) continue; at(d.x, d.y, d.r, d.s, d.s, () => drawItem(i)); }
  }

  // ---------- Junior & Mireille poses ----------
  const inHand = (mode) => () => {                                   // folder as a hand prop (figure units: ×FIG_S in the world)
    const k = keys(), t = TNOW, pop = clamp(spring(t - k.fold, 14, .5), 0, 1.15), tuck = 1 - eInCubic(clamp((t - k.tuck) / .35));
    const s = (mode === 'both' ? 1 : .86) * Math.min(pop, 1.15) * tuck; if (s <= .01) return;
    at(mode === 'both' ? -70 : 0, mode === 'both' ? 0 : 40, mode === 'walk' ? .12 : 0, s, s, () => {
      folderCover(300, 240, { lift: 10 });
      const g = t - k.fold - .35; if (mode === 'both' && g > 0 && g < .7) { ctx.save(); ctx.globalAlpha *= Math.sin(g / .7 * Math.PI); ctx.fillStyle = '#FFFFFF';   // « impeccable » glint
        at(110, -90, g * 2, 1, 1, () => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 9 : 34, a = i * Math.PI / 4; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }); ctx.restore(); }
    });
  };
  let TNOW = 0;                                                      // time of the current draw (hand props have no t argument)
  const P_BOTH = inHand('both'), P_POINT = inHand('point'), P_WALK = inHand('walk');
  poseHook('junior', (t) => {
    const k = keys(); TNOW = t;
    if (t < k.arrive || t >= k.tuck + .4) return null;
    if (t < k.fold) return { look: .5 };
    if (t < k.give - .25) return { arms: ['hold', 'hold'], handProp: P_BOTH, handSide: 1, face: t > k.fold + .2 ? 'grin' : 'smile', look: t < k.ask1 ? -.4 : .3 };
    if (t < k.give) return { arms: ['idle', 'point'], handProp: P_POINT, handSide: 1, face: 'grin', look: .8 };
    if (t < k.give + .35) return { arms: ['idle', 'point'], face: 'grin', look: .8 };
    if (t < k.back0) return { arms: ['hip', 'hip'], face: t > k.pt && t < k.pt + 2.4 ? 'grin' : 'smile', look: .6 };
    if (t < k.back1 + .05) return { arms: ['hold', 'hold'], face: 'smile', look: .4 };
    if (t < k.back1 + .3) return { arms: ['hold', 'hold'], handProp: P_BOTH, handSide: 1, face: 'smile' };
    return { handProp: P_WALK, handSide: 1 };
  });
  poseHook('mireille', (t) => {
    const k = keys(); if (t < k.arrive || t >= se('S9', .4)) return null;
    if (t < k.ask0) return { look: .6 };
    if (t < k.wow) return { arms: ['hold', [205, 60]], look: -.8, face: 'think' };
    if (t < k.wow + .5) return { look: -.8, face: 'shock' };
    if (t < k.neat1) return { look: -.6, face: 'grin', arms: ['hold', 'thumb'] };
    return { look: .5 };
  });

  // ---------- screen overlays: strip + bubbles ----------
  function bubble(x, y, txt, a, tip, o = {}) {
    if (a <= .01) return; const f = font(FF.hand, o.size || 52, 800), w = measure(txt, f) + 70, h = (o.size || 52) * 1.9;
    at(x, y, o.rot || -.02, a, a, () => {
      withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-26, h / 2 - 6); ctx.lineTo((tip.x - x) / a, (tip.y - y) / a); ctx.lineTo(26, h / 2 - 6); ctx.closePath(); ctx.fill(); });
      text(txt, 0, (o.size || 52) * .36, { font: f, align: 'center', color: o.color || C.ink });
    });
  }
  function mireilleBubble(t, txt, t0, t1) {
    if (t < t0 - .05 || t > t1 + .3) return; const st = actorAt('mireille', t); if (!st) return;
    const hd = worldToScreen(st.x, st.y - 150 * FIG_S - 72, t), a = clamp(spring(t - t0, 14, .5), 0, 1.12) * (1 - eInCubic(clamp((t - t1) / .25)));
    bubble(clamp(hd.x - 80, 250, 820), clamp(hd.y - 125, 300, 1100), txt, a, { x: hd.x, y: hd.y + 20 });
  }
  function strip(t) {
    const k = keys(); if (t < k.strip0 - .05 || t > k.strip1 + .5) return;
    const inn = eOutBack(clamp((t - k.strip0) / .45)), out = eInCubic(clamp((t - k.strip1) / .4)), x = 520, y = lerp(-160, 352, inn) - out * 40;
    const w = 660, h = 176, br = worldToScreen(BX, feetY - 150 * FIG_S - 80, t);
    ctx.save(); ctx.globalAlpha *= 1 - out;
    const pa = clamp((t - k.strip0 - .35) / .5); if (pa > 0) handArrow([[x + 250, y + 70], [x + 330, y + 170], [br.x - 20, br.y - 70], [br.x, br.y - 10]], pa, C.violetD, 8);
    paperNote(x, y, w, h, -.015, () => {
      text('SON TRANSITAIRE', 0, -8, { font: font(FF.stencil, 76, 900), align: 'center', color: C.ink, ls: 3 });
      const kw = clamp((t - k.strip2) / .55); if (kw > 0) { const f = font(FF.body, 48, 800), ww = measure('AGRÉÉ EN DOUANE', f);
        ctx.save(); ctx.beginPath(); ctx.rect(-ww / 2 - 10, 18, (ww + 20) * eOutCubic(kw), 70); ctx.clip(); text('AGRÉÉ EN DOUANE', 0, 64, { font: f, align: 'center', color: C.violetD }); ctx.restore(); }
    }, { seed: 24, h: 12 });
    ctx.restore();
  }

  // ---------- scenes ----------
  registerScene({ id: 'transit_back', z: 24, draw(t, n) {
    lazyShakes(); if (!inView(2520, 800, 700, t)) return;
    ctx.save(); worldBegin(t); office(t, n); ctx.restore();
  } });
  registerScene({ id: 'transit_front', z: 35, draw(t, n) {
    if (!inView(2520, 900, 900, t)) return;
    ctx.save(); worldBegin(t); counterFront(t, n); ctx.restore();
  } });
  registerScene({ id: 'transit_hud', z: 46, draw(t, n) {
    const k = keys(); if (t < k.strip0 - .1 || t > k.neat1 + .5) return;
    strip(t);
    mireilleBubble(t, 'Tes papiers ?', k.ask0, k.ask1);
    mireilleBubble(t, 'Bien rangé !', k.neat0, k.neat1);
  } });
})();

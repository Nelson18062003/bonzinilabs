'use strict';
// =============================================================================================
// 26_guichet — ③ LE GUICHET DES DOUANES (S10–S15). World x ≈ 3040–3600 (X.guichet = 3300).
//  Always there (world): a light paper booth (two kraft posts + a rail, above the series-chip band) from which THREE CARDS
//          hang on violet threads —
//          QUOI (violet) · COMBIEN (dark amber #C77A12) · D'OÙ (orange). Their backs are orange (verso = export) with a
//          white « ? » until they are asked. A long sage-paper counter with the friendly officer SEATED behind its left part
//          (officerFig, green cap, NO badge — kept left so he is never framed on the bête's « DOUANE ? » label); on its front
//          the book « TARIF » on a chain (ONE flap « TAUX · selon le code », no number) and a plate « DOUANE »; a small
//          receipt printer on the counter. Everything that is laid down stays (S30's crane shot sees the final state).
//  S10  « trois » the cards swing one by one · « Quoi » QUOI comes forward and flips; « baskets » ONE canvas sneaker ·
//          Junior raises his hand: « Dessus en toile ! » · « description… code » the tag « 64 04 · dessus textile » is
//          written on the card · « taux » the tag slides down into the TARIF book, under its single flap.
//          Pause: Junior's transitaire catches up (walks in behind Junior).
//  S11  « Combien » COMBIEN flips · « baskets / transport / assurance » three blocks drop and stack on the counter
//          (BASKETS · TRANSPORT = photo container_ship_deck_aerial_01, « photo d'illustration » · ASSURANCE umbrella) and
//          merge into ONE violet block « VALEUR » · « compare » the officer raises the paper ruler « LA DOUANE COMPARE »
//          and stands it against the block (a violet mark at the block's height).
//          Pause: the transitaire looks over his glasses « C'est le vrai prix ? »; Junior's hand brushes his back pocket
//          (the « ? » phone shivers: 20_quai).
//  S12  « D'où » D'OÙ comes forward and flips · « pays de fabrication » a small factory, ticked · « port de départ » a
//          postcard (photo crane_silhouette, « photo d'illustration ») crossed out in red.
//  S13  Mireille's transitaire walks in; the three cards pivot 180° to their orange backs, now filled for Mireille (sack
//          « POIVRE DE PENJA », her invoice to a foreign client, a pin on Penja); he hands her export declaration over the
//          counter to the officer, who reads it, nods and files it (46 stamps « DÉCLARÉ · EXPORT » in her passport).
//          Pause: the cards pivot back (Junior's story goes on), he leaves; the officer puts the ruler away.
//  S14  « La note prévue » the transitaire prints the ticket « NOTE PRÉVUE · estimation » · « droit de douane » the block
//          DROIT DE DOUANE lands on VALEUR (the « 64 04 » tag in the book and the block pulse together on « code ») ·
//          « TVA » a translucent violet film « TVA 19,25 % · taux général » drops over both · « sur le tout, droit
//          compris » it hugs the whole stack · « d'autres lignes » a slip pinned to the rail: « + AUTRES LIGNES · selon le
//          produit et votre situation → PARTIE 2 ».
//  S15  « tout pâle » Junior's paper face is swapped for a paler piece (stop-motion), sweat drop · « repense au grand
//          frère » his hand goes back to the pocket (20_quai lifts the flap, 44 swells the bête).
//  HERO INSERTS (readability pass, z 46, screen space): when a card is answered it leaves its thread and swings to the
//          camera (≈ 560 px wide, still tied to its thread), holds while the voice explains it, then flies back; the pieces
//          that live elsewhere fly back to their own place (continuity). The world copies are hidden while they are « out ».
//          QUOI (S10, « Une description… taux »): the tag is written big, unclips, the TARIF book rises under it and its flap
//          « TAUX · selon le code » closes on it; book + tag return to the counter. COMBIEN (S11): BASKETS / TRANSPORT
//          (photo) / ASSURANCE drop into the card, merge into VALEUR, the ruler « LA DOUANE COMPARE · les prix » is laid
//          over it; VALEUR and the ruler then return to the counter. D'OÙ (S12): the card itself. S13: the QUOI card's
//          orange back (Mireille's pepper) + a taped strip « l'export aussi se déclare » (before the passport, 46).
//          S14: the whole counter top (printer + ticket, VALEUR, DROIT, TVA film) rises to the camera on a sage ledge; the
//          slip « + autres lignes… → partie 2 » drops in above it; then everything goes back.
// z 20 booth · 21 officer · 27 threads + cards + slip · 28 the two transitaires · 33 Junior's pale face (S15)
// · 34 counter-top props (printer + ticket, ruler, tower, film) · 35 counter front + TARIF book · 36 flying
// declaration · 45 bubbles · 46 hero inserts. Top-level names: none (IIFE); scene ids C26_*.
// Poses: poseHook('junior') / poseHook('mireille') from « trois » (S10) to the S16 cut.
// =============================================================================================
(() => {
  const G = X.guichet;
  const CX = [G - 180, G + 20, G + 220], CW = 190, CH = 240, CY = 460, RAIL = 60;     // cards: hanging x, size, centre y; rail y
  const QC = ['#7B22D6', '#C77A12', C.orange], QW = ['QUOI ?', 'COMBIEN ?', "D'OÙ ?"];
  const FOC = [{ dx: 10, dy: 45, s: 1.4 }, { dx: 0, dy: 12, s: 1.15 }, { dx: 50, dy: 0, s: 1.6 }];   // « asked » card: comes forward
  const CT = { x0: G - 150, x1: G + 245, y: 930 };                                      // counter (front face from y to GROUND)
  const OFX = G - 90, OFY = feetY + 50, TRX = G - 220, MTX = G + 500;                    // officer (seated, left: never in front of the bête's label) · transitaires
  const TWX = G + 165, BW = 170, BH = 86;                                                 // value tower: centre x, block w / h
  const BK = { x: G - 15, y: 952, w: 230, h: 174 };                                       // TARIF book on the counter front (centre x, top y)
  const PRX = G, RUX = G + 55;                                                         // receipt printer · the standing ruler (on the counter)
  const SLIP = { x: G + 180, y: 281, s: .85, w: 400, h: 138 };                          // S14 slip pinned to the rail (centre, scale, art size) — clear of the series chip
  const GX = G + 106;                                                                     // S14 hero: anchor x of the counter-top group (printer … tower)
  const SAGE = '#D3DECF', SAGED = '#98AE95', PALE = '#BCA18C', CANVAS = '#3F6FB5';
  const IDLE = [158, 262];
  const mixA = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
  const ease = (t, a, d) => eInOutCubic(prog(t, a, a + d));

  // ---------- time table (lazy: the timeline is only known at draw time) -------------------------------------------
  let T = null, SH = false;
  function tm() {
    if (T) return T;
    const c = CUT();
    const k = {
      trois: tw('S10', 'trois'), quoi: tw('S10', 'Quoi'), bask10: tw('S10', 'baskets'), dessus: tw('S10', 'dessus'), toile: te('S10', 'toile'),
      desc: tw('S10', 'description'), code1: tw('S10', 'code'), et10: tw('S10', 'et'), code2: tw('S10', 'code', 0, 1), taux10: tw('S10', 'taux'), e10: se('S10'),
      combien: tw('S11', 'Combien'), bask: tw('S11', 'baskets'), transp: tw('S11', 'transport'), assur: tw('S11', 'assurance'),
      et11: tw('S11', 'Et'), compare: tw('S11', 'compare'), prix: te('S11', 'prix'), e11: se('S11'),
      dou: tw('S12', 'où'), pays: tw('S12', 'pays'), fab: te('S12', 'fabrication'), port: tw('S12', 'port'), depart: te('S12', 'départ'), e12: se('S12'),
      poivre: tw('S13', 'poivre'), quest0: tw('S13', 'questions'), questions: te('S13', 'questions'), declare: tw('S13', 'declare'), e13: se('S13'),
      s14: ss('S14'), note: tw('S14', 'note'), droit: tw('S14', 'droit'), code14: tw('S14', 'code'), tva: tw('S14', 'TVA'),
      sur: tw('S14', 'sur'), droit2: tw('S14', 'droit', 0, 1), autres: tw('S14', 'Et'), e14: se('S14'),
      tout: tw('S15', 'tout'), repense: tw('S15', 'repense'), e15: se('S15'), cut: c.t + c.dur * .5,
    };
    Object.assign(k, {
      flip: [k.quoi - .02, k.combien - .02, k.dou - .05],                                 // recto turns towards us (import)
      focIn: [k.quoi - .1, k.combien - .1, k.dou - .15], focOut: [k.e10 + .3, k.prix - .15, k.e12 + .45],
      sneak: k.bask10 + .05, point0: k.dessus - .25, point1: k.toile + 1.1, bub0: k.dessus - .15, bub1: k.toile + 1.0,
      drops: [k.bask + .02, k.transp + .02, k.assur + .02], merge0: Math.max(k.assur + .55, k.et11 + .1), ruler0: k.compare - .05,
      pock0: k.prix + .1, tick: k.fab + .02, card0: k.port - .35, cross0: k.depart - .4,
      mEnter0: k.e12 + .95, mEnter1: k.e12 + 2.05, piv: [k.poivre + .1, k.poivre + .45, k.poivre + .8],
      mExit0: k.e13 + .45, mExit1: k.e13 + 1.6, back: [k.e13 + .9, k.e13 + 1.05, k.e13 + 1.2],
      rulerOut: k.s14 - .75, press: k.note - .15, print0: k.note, print1: k.note + .8, drop14: k.droit + .02,
      film0: k.tva + .03, hug: k.sur, pulse: k.droit2, slip0: k.autres + .05,
      pale0: k.tout + .15, hand15: k.repense - .05,
    });
    // ---- hero inserts (each: in0 → in1 fly to the camera · hold · out0 → out1 fly back) ----
    const win = (i, key, in0, out0, dIn = .6, dOut = .6) => ({ i, key, in0, in1: in0 + dIn, out0, out1: out0 + dOut });
    k.hq = win(0, 'quoi', Math.max(k.bub1 + .3, k.desc - .5), k.e10 + .25);               // QUOI: after Junior's bubble, on « Une description… »
    k.w1 = k.hq.in1 - .05; k.w2 = Math.max(k.code1 - .35, k.w1 + .9);                    // the tag is written big: 64 04 · dessus textile
    k.tagGo = Math.max(k.et10, k.w2 + .75); k.tagHov = k.tagGo + .55;                     // « et c'est… » the tag unclips and slides down
    k.bk0 = Math.max(k.code2 - .1, k.tagHov + .1); k.bk1 = k.bk0 + .55;                   // « code » the TARIF book rises under it
    k.flapShut = k.bk1 + .22;                                                             // the flap « TAUX · selon le code » closes on it
    k.trIn0 = k.hq.out1 + .05; k.trIn1 = k.trIn0 + 1.45;                                  // then Junior's transitaire catches up
    k.hc = win(1, 'combien', k.combien + .05, k.e11 + .15);                               // COMBIEN: the whole of S11
    k.bub2 = Math.max(k.prix + .15, k.hc.out1 - .15);                                     // « C'est le vrai prix ? » once the card is back
    k.hd = win(2, 'dou', Math.max(k.dou + .3, k.bub2 + 1.75), k.e12 + .5);                // D'OÙ: after the bubble
    k.fac0 = Math.max(Math.min(k.pays - .05, k.dou + 1.1), k.hd.in1 - .05);
    k.he = win(0, 'exp', Math.max(k.poivre + .1, k.hd.out1 + .35), k.quest0 - .2);        // S13: the orange back, before the passport (46)
    k.exStrip = Math.max(k.he.out1 + .1, tw('S13', 'export') - .1);                      // « l'export aussi se déclare » (taped strip) — on the words, never before
    k.decl0 = Math.max(k.questions - .45, k.he.out1 - .1);                                // her declaration crosses once the card is back
    k.hn = win(-1, 'note', k.s14 - .2, Math.max(k.e14 + .1, k.slip0 + 2.3));               // S14: the counter top rises to the camera
    T = k; return T;
  }
  function lazyShakes() {                                                                // once: impacts (also the sound cues)
    if (SH) return; SH = true; const k = tm();
    addShake(k.flapShut, 3, .1);                                                          // flap closes on the 64 04 tag (hero)
    addShake(k.hc.out1 - .02, 2, .08);                                                    // VALEUR + ruler land back on the counter
    k.drops.forEach(d => addShake(d + .34, 3, .1));                                      // three blocks land
    addShake(k.merge0 + .25, 3, .12);                                                    // they merge into VALEUR
    addShake(k.ruler0 + .45, 2, .1);                                                     // the ruler is laid
    addShake(k.cross0 + .45, 2, .1);                                                     // the postcard is crossed out
    addShake(k.decl0 + .5, 2, .1);                                                       // export declaration handed over
    addShake(k.drop14 + .34, 4, .12);                                                    // DROIT DE DOUANE lands
    addShake(k.film0 + .38, 2, .1);                                                      // the film settles
    addShake(k.pale0 + .2, 2, .08);                                                      // paper face swap
  }
  const onStage = t => inView(G + 60, 700, 780, t);

  // ---------- small text helpers ----------------------------------------------------------------------------------------
  function fitFont(s, fam, max, maxW, wght = 900, ls = 0) { const w = measure(s, font(fam, max, wght), ls); return font(fam, w > maxW ? max * maxW / w : max, wght); }
  function reveal(k, x0, y, w, h, fn) { if (k <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(x0, y, w * clamp(k), h); ctx.clip(); fn(); ctx.restore(); }

  // ---------- the cards -----------------------------------------------------------------------------------------------------
  function cardState(i, t) {
    const k = tm(), F = FOC[i];
    const f = ease(t, k.focIn[i], .55) * (1 - ease(t, k.focOut[i], .6));
    const ang = ease(t, k.flip[i], .6) + ease(t, k.piv[i], .65) + ease(t, k.back[i], .55);   // half-turns: 0 verso · 1 recto · 2 verso (export) · 3 recto
    let r = Math.sin(t * 1.05 + i * 2.1) * .01;
    const kicks = [[k.trois + i * .18, 1], [k.flip[i] + .6, .6], [k.piv[i] + .65, .6], [k.back[i] + .55, .45]];
    for (const [t0, a] of kicks) { const d = t - t0; if (d > 0 && d < 3) r += Math.exp(-d * 2.2) * Math.sin(d * 7.5) * .07 * a; }
    return { x: CX[i] + F.dx * f, y: CY + F.dy * f, s: lerp(1, F.s, f), ang, r, f };
  }
  function grommet() {
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, -CH / 2 + 12, 9, 0, 7); ctx.fill();
    ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, -CH / 2 + 12, 4, 0, 7); ctx.fill();
  }
  function cardBody(fill, lift = 8) {
    withShadow(lift, () => { ctx.fillStyle = fill; rrect(-CW / 2, -CH / 2, CW, CH, 14); ctx.fill(); });
    ctx.save(); rrect(-CW / 2, -CH / 2, CW, CH, 14); ctx.clip(); ctx.globalAlpha = .12; ctx.strokeStyle = '#6B4A2A'; ctx.lineWidth = 1;
    for (let j = 0; j < 22; j++) { const x = (rnd(j * 3.1) - .5) * CW, y = (rnd(j * 5.7) - .5) * CH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 9, y + 3); ctx.stroke(); }
    ctx.restore();
  }
  function header(i, col) {
    ctx.save(); rrect(-CW / 2, -CH / 2, CW, CH, 14); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(-CW / 2, -CH / 2, CW, 58); ctx.restore();
    text(QW[i], 0, -CH / 2 + 50, { font: fitFont(QW[i], FF.stencil, 36, CW - 24, 900, 2), align: 'center', color: '#fff', ls: 2 });
  }
  /** the 64 04 tag (centred, 176 × 76); k1 / k2 = writing progress of its two lines, pen = draw the marker */
  function codeTag(k1 = 1, k2 = 1, o = {}) {
    withShadow(o.lift ?? 5, () => { ctx.fillStyle = '#F4EDFF'; rrect(-92, -38, 184, 76, 10); ctx.fill(); });
    ctx.strokeStyle = C.violetD; ctx.lineWidth = 3; rrect(-87, -33, 174, 66, 7); ctx.stroke();
    if (o.glow) { ctx.save(); ctx.globalAlpha *= o.glow; ctx.fillStyle = 'rgba(169,71,254,.35)'; rrect(-92, -38, 184, 76, 10); ctx.fill(); ctx.restore(); }
    const f1 = font(FF.mono, 30, 700), f2 = font(FF.body, 24, 800), w1 = measure('64 04', f1), w2 = measure('dessus textile', f2);
    reveal(k1, -w1 / 2 - 4, -34, w1 + 8, 40, () => text('64 04', 0, -6, { font: f1, align: 'center', color: C.violetD }));
    reveal(k2, -w2 / 2 - 4, 6, w2 + 8, 32, () => text('dessus textile', 0, 28, { font: f2, align: 'center', color: C.ink }));
    if (o.pen && k1 > 0 && k1 < 1) at(-w1 / 2 + w1 * k1, -12, 0, .42, .42, () => marker(0, 0, -.5, C.violetD));   // a small felt pen writes it
    if (o.pen && k2 > 0 && k2 < 1) at(-w2 / 2 + w2 * k2, 18, 0, .42, .42, () => marker(0, 0, -.5, C.ink));
  }
  function miniBlock(y, w, h, fill, icon) { withShadow(3, () => { ctx.fillStyle = fill; rrect(-w / 2, y - h / 2, w, h, 6); ctx.fill(); }); if (icon) at(0, y, 0, 1, 1, icon); }
  function postcard(w, h, cross) {                                                       // real photo, duotone, crossed out
    withShadow(4, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10); });
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    photoCover(photoFx('crane_silhouette', 'duo', ['#2A2230', '#F2E2C4']) || 'crane_silhouette', -w / 2, -h / 2, w, h, { zoom: 1.05, fx: .5, fy: .45 });
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(-47, -h / 2, 94, 14);                // credit in the top-centre (the red X leaves it clear)
    text("photo d'illustration", 0, -h / 2 + 11, { font: font(FF.body, 10.5, 700), align: 'center', color: '#fff' });
    ctx.restore();
    if (cross > 0) { ctx.save(); ctx.strokeStyle = '#D2202F'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      const a = clamp(cross * 2), b = clamp(cross * 2 - 1);
      ctx.beginPath(); ctx.moveTo(-w / 2 - 4, -h / 2 - 2); ctx.lineTo(lerp(-w / 2 - 4, w / 2 + 4, a), lerp(-h / 2 - 2, h / 2 + 2, a)); ctx.stroke();
      if (b > 0) { ctx.beginPath(); ctx.moveTo(w / 2 + 4, -h / 2 - 2); ctx.lineTo(lerp(w / 2 + 4, -w / 2 - 4, b), lerp(-h / 2 - 2, h / 2 + 2, b)); ctx.stroke(); }
      ctx.restore(); }
  }
  function rectoFrame(i, lift) { cardBody('#FFFDF7', lift); header(i, QC[i]); grommet(); }
  function recto(i, t, n, lift) { rectoFrame(i, lift); rectoContent(i, t, n); }
  function rectoContent(i, t, n) {
    const k = tm();
    if (i === 0) {                                                                       // QUOI: ONE canvas sneaker + the tag
      const p = clamp(spring(t - k.sneak, 14, .5), 0, 1.15);
      const dn = 26 * ease(t, k.tagGo + .9, .6);                                        // once the tag is filed, the sneaker settles in the middle
      if (p > .01) at(0, -8 + dn, 0, p, p, () => { sneaker(156, { color: CANVAS, accent: '#F3F0E8', lift: 6 });
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.5; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(-58 + j * 16, -4); ctx.lineTo(-50 + j * 18, 10); ctx.stroke(); } });
      if (t < k.tagGo) { const k1 = prog(t, k.w1, k.w1 + .7), k2 = prog(t, k.w2, k.w2 + .7); if (k1 > 0) at(0, 76, -.015, 1, 1, () => codeTag(k1, k2, { pen: true })); }
    } else if (i === 1) {                                                                // COMBIEN: a mini tower (the answer is built on the counter)
      miniBlock(72, 118, 30, '#FFE2C2', () => at(-40, 0, 0, 1, 1, () => iconUmbrella(22, C.orange)));
      miniBlock(38, 118, 30, '#3E6E8E', () => at(-40, 2, 0, .5, .5, () => iconShip('#fff')));
      miniBlock(4, 118, 30, '#EBD9FF', () => at(-40, 0, 0, 1, 1, () => sneaker(34, { color: CANVAS, lift: 0 })));
      ctx.strokeStyle = C.violetD; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(70, -8); ctx.lineTo(78, -8); ctx.lineTo(78, 84); ctx.lineTo(70, 84); ctx.stroke();
      for (const y of [4, 38, 72]) { ctx.fillStyle = 'rgba(35,22,41,.25)'; ctx.fillRect(-2, y - 3, 44, 6); }
    } else {                                                                             // D'OÙ: the factory (ticked) and the port postcard (crossed out)
      const pf = clamp(spring(t - k.fac0, 14, .5), 0, 1.15), pc = clamp(spring(t - k.card0, 14, .5), 0, 1.15);
      if (pf > .01) {
        at(-64, -26, 0, pf, pf, () => iconFactory(46, C.inkSoft));
        ctx.save(); ctx.globalAlpha *= clamp(pf); text('pays de', -32, -34, { font: font(FF.body, 21, 800), color: C.ink }); text('fabrication', -32, -10, { font: font(FF.body, 21, 800), color: C.ink }); ctx.restore();
        const tk = clamp(spring(t - k.tick, 16, .45), 0, 1.2); if (tk > .01) at(-44, -6, 0, tk, tk, () => iconCheck(24));
      }
      if (pc > .01) at(0, 44, -.02, pc, pc, () => postcard(150, 62, prog(t, k.cross0, k.cross0 + .45)));
      if (pc > .01) { ctx.save(); ctx.globalAlpha *= clamp(pc); text('port de départ', 0, 101, { font: font(FF.body, 21, 800), align: 'center', color: C.ink }); ctx.restore(); }
    }
  }
  function verso(i, t, n, exp, lift) {
    cardBody(C.orange, lift);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; rrect(-CW / 2 + 9, -CH / 2 + 9, CW - 18, CH - 18, 10); ctx.stroke();
    grommet();
    if (!exp) { text('?', 0, 50, { font: font(FF.stencil, 140, 900), align: 'center', color: 'rgba(255,255,255,.92)' }); return; }
    text(QW[i], 0, -CH / 2 + 50, { font: fitFont(QW[i], FF.stencil, 36, CW - 24, 900, 2), align: 'center', color: '#fff', ls: 2 });
    withShadow(3, () => { ctx.fillStyle = '#FFF6EC'; rrect(-80, -56, 160, 166, 10); ctx.fill(); });
    if (i === 0) {                                                                       // her pepper
      at(0, 30, 0, 1, 1, () => { sack(132, 126, '', { lift: 4 }); ctx.fillStyle = '#2B1C14'; for (let j = 0; j < 9; j++) { ctx.beginPath(); ctx.arc(-18 + rnd(j * 3.3) * 36, -70 - rnd(j * 1.7) * 10, 3.2, 0, 7); ctx.fill(); }
        at(0, 5, -.03, 1, 1, () => { ctx.fillStyle = C.cream; rrect(-58, -21, 116, 44, 8); ctx.fill();                   // her label, big enough for the close-up
          text('POIVRE', 0, -1, { font: fitFont('POIVRE', FF.stencil, 18, 104, 900, 2), align: 'center', color: C.ink, ls: 2 });
          text('de Penja', 0, 17, { font: font(FF.hand, 13, 800), align: 'center', color: '#D84406' }); }); });
    } else if (i === 1) {                                                                // her invoice to a foreign client
      at(-14, 30, -.04, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-46, -62, 92, 120); }); ctx.fillStyle = C.violetD; ctx.fillRect(-46, -62, 92, 24);
        text('FACTURE', 0, -44, { font: font(FF.stencil, 16, 900), align: 'center', color: '#fff', ls: 1 });
        ctx.strokeStyle = DC.line; ctx.lineWidth = 3; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(-36, -22 + j * 16); ctx.lineTo(30 - (j % 2) * 24, -22 + j * 16); ctx.stroke(); } });
      at(44, 76, 0, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = '#5FA3D6'; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.fill(); });
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 11, 25, 0, 0, 7); ctx.moveTo(-25, 0); ctx.lineTo(25, 0); ctx.moveTo(-21, -12); ctx.lineTo(21, -12); ctx.moveTo(-21, 12); ctx.lineTo(21, 12); ctx.stroke();
        ctx.fillStyle = '#7DBE7A'; ctx.beginPath(); ctx.ellipse(-8, -6, 8, 6, .4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(9, 8, 7, 9, -.3, 0, 7); ctx.fill(); });
    } else {                                                                             // made in Cameroon: a pin on Penja
      at(2, 42, 0, 1, 1, () => { cmrMap(11, { sea: false, neighbours: false });
        const px = -2.805 * 11, py = 1.36 * 11;
        at(px, py, 0, 1, 1, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, -16, 11, Math.PI * .15, Math.PI * .85, true); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -17, 4, 0, 7); ctx.fill(); });
        text('Penja', px + 12, py - 20, { font: font(FF.hand, 19, 800), color: C.ink }); });
    }
    if (i === 0) { const k = tm(), a = clamp(spring(t - k.exStrip, 14, .5), 0, 1.12); if (a > .01 && t < k.back[0] + .3) exportStrip(a); }
  }
  /** S13: a torn strip taped over the bottom of the QUOI card's orange back (card units; 19 u = 56 px in the hero) */
  function exportStrip(a) {
    at(0, 97, -.03, a, a, () => {
      withShadow(5, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); const top = tornLine(-94, -29, 94, -29, 21, 1.6, 8), bot = tornLine(94, 29, -94, 29, 27, 1.6, 8);
        ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = C.tape; at(-86, -26, -.5, 1, 1, () => ctx.fillRect(-15, -6, 30, 12)); at(86, -26, .5, 1, 1, () => ctx.fillRect(-15, -6, 30, 12));
      text("l'export aussi", 0, -5, { font: fitFont("l'export aussi", FF.hand, 19.5, 176, 800), align: 'center', color: C.ink });
      text('se déclare', 0, 19, { font: fitFont('se déclare', FF.hand, 19.5, 176, 800), align: 'center', color: '#D84406' });
    });
  }
  function drawCard(i, t, n) {
    if (cardHero(i, t)) return;                                                          // it is out, in front of the camera (hero)
    const st = cardState(i, t), gy = st.y - (CH / 2 - 12) * st.s;
    thread([[CX[i], RAIL + 8], [st.x, gy]], 1, n, { w: 4 });
    ctx.save(); ctx.translate(st.x, gy); ctx.rotate(st.r); ctx.translate(0, (CH / 2 - 12) * st.s); ctx.scale(st.s, st.s);
    const cs = Math.cos(st.ang * Math.PI), rectoUp = Math.round(st.ang) % 2 === 1;
    ctx.scale(Math.max(.03, Math.abs(cs)), 1);
    if (rectoUp) recto(i, t, n); else verso(i, t, n, st.ang > 1.5);
    if (Math.abs(cs) < .7) { ctx.fillStyle = `rgba(60,32,12,${(.7 - Math.abs(cs)) * .45})`; rrect(-CW / 2, -CH / 2, CW, CH, 14); ctx.fill(); }
    ctx.restore();
  }

  // ---------- the booth ---------------------------------------------------------------------------------------------------
  function booth(t, n) {
    for (const x of [G - 250, G + 290]) { withShadow(10, () => { ctx.fillStyle = C.kraftD; ctx.fillRect(x - 8, RAIL, 16, GROUND - RAIL); });
      ctx.fillStyle = 'rgba(255,240,210,.35)'; ctx.fillRect(x - 6, RAIL, 3, GROUND - RAIL); }
    withShadow(12, () => { ctx.fillStyle = TEX.kraft; rrect(G - 272, RAIL - 12, 584, 24, 6); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,240,210,.3)'; ctx.fillRect(G - 268, RAIL - 10, 576, 4);
    for (const x of CX) { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(x, RAIL + 8, 7, 0, 7); ctx.fill(); }
  }

  // ---------- characters behind / beside the counter ---------------------------------------------------------------------
  function officerPose(t, n) {
    const k = tm(), o = { face: 'smile', arms: [[96, 206], [96, 206]], look: -.2, blink: (t + .7) % 4.1 < .12 };
    if (t > k.quoi - .3 && t < k.e10 + .6) o.look = t > k.tagGo ? -.2 : -.7;
    else if (t > k.combien - .3 && t < k.e11 + .8) o.look = -.35;
    else if (t > k.dou - .3 && t < k.e12 + .4) o.look = .25;
    else if (t > k.poivre - .3 && t < k.e13 + .5) o.look = t > k.decl0 && t < k.decl0 + 1.6 ? .45 : .75;
    else if (t > k.s14 - .5 && t < k.e14 + .8) o.look = -.35;
    else if (t >= k.e14 + .8) o.look = -.85;
    for (const t0 of [k.code1 + .1, k.declare + .25, k.code14 + .05]) { const d = t - t0; if (d > 0 && d < 1) o.tilt = Math.sin(d * 9) * .06 * (1 - d); }
    // S11: he raises the ruler from under the counter and stands it against the block (right hand), then lets go
    const R = rulerState(t), grip = [(RUX - OFX) / FIG_S - 12, (R.y + 170 - OFY) / FIG_S];
    const hin = ease(t, k.hc.out1 - .3, .3), hout = ease(t, k.hc.out1 + .7, .45), rin2 = ease(t, k.rulerOut - .3, .3), rout2 = ease(t, k.rulerOut + .5, .35);
    if (hin > 0 && hout < 1) { o.arms[1] = mixA(mixA([96, 206], grip, hin), [96, 206], hout); o.look = .25; }
    if (rin2 > 0 && rout2 < 1) { o.arms[1] = mixA(mixA([96, 206], grip, rin2), [96, 206], rout2); o.look = .25; }
    // S13: Mireille's transitaire hands him her export declaration; he reads it, nods, files it under the counter
    const d0 = k.decl0 + .5, file = ease(t, k.e13 + .25, .45);
    if (t >= d0 - .25 && t < k.e13 + .8) {
      const up = ease(t, d0 - .25, .25); o.arms[1] = mixA(mixA([96, 206], DECL_HAND, up), [80, 300], file); o.look = .15;
      if (t >= d0 && t < k.e13 + .6) { o.handProp = () => at(0, -20, -.06, 1, 1, declProp); o.handSide = 1; }
    }
    return o;
  }
  const DECL_HAND = [134, -12];                                                            // where he holds the declaration (figure units)
  function officer(t, n) { ctx.save(); ctx.beginPath(); ctx.rect(OFX - 300, 0, 600, CT.y + 10); ctx.clip();           // seated behind the counter: legs hidden
    at(OFX, OFY, 0, FIG_S, FIG_S, () => officerFig(officerPose(t, n))); ctx.restore(); }
  function brokerJ(o, glDrop = 0) {                                                      // Junior's transitaire: same look as the transit kiosk
    const g = window.T24 && T24.glasses; brokerFig(o);
    ctx.save(); ctx.translate(0, glDrop);
    if (g) g(o); else { ctx.translate(o.look ? o.look * 8 : 0, -150); ctx.strokeStyle = '#231629'; ctx.lineWidth = 7; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 40, -4, 29, 0, 7); ctx.stroke(); } }
    ctx.restore();
  }
  function trState(t, n) {
    const k = tm(); if (t < k.trIn0 || t >= k.cut) return null;
    const e = ease(t, k.trIn0, k.trIn1 - k.trIn0), moving = t > k.trIn0 && t < k.trIn1;
    const o = { face: 'smile', look: .45, arms: [[96, 206], [96, 206]], blink: (t + 1.9) % 3.7 < .12 }; let gl = 0;
    if (moving) { o.walk = stepT(n) * 1.9; o.arms = undefined; o.look = .2; }
    if (t > k.combien - .3 && t < k.bub2 - .2) o.look = .5;
    if (t >= k.bub2 - .2 && t < k.bub2 + 1.7) { const g = ease(t, k.bub2 - .2, .3) * (1 - ease(t, k.bub2 + 1.4, .3)); gl = 22 * g; o.look = -.85; o.face = 'think'; o.tilt = .06 * g; }
    if (t > k.dou - .3 && t < k.e13 + .5) o.look = .8;
    if (t >= k.press - .35 && t < k.press + .6) { const a = ease(t, k.press - .35, .3) * (1 - ease(t, k.press + .25, .3)); o.arms = [[96, 206], mixA([96, 206], [440, 116], a)]; o.look = .7; }
    if (t >= k.press + .6 && t < k.e14 + .8) o.look = .55;
    if (t >= k.e14 + .8) { o.look = -.9; o.face = 'think'; }
    return { x: lerp(TRX - 420, TRX, e), o, gl, moving };
  }
  const declProp = () => at(0, -30, -.08, 1, 1, () => {                                   // green export declaration (figure units)
    withShadow(6, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-64, -90, 128, 176); }); ctx.fillStyle = DC.green; ctx.fillRect(-64, -90, 128, 34);
    ctx.fillStyle = C.orange; ctx.fillRect(18, -90, 46, 34);
    ctx.strokeStyle = DC.line; ctx.lineWidth = 5; for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.moveTo(-48, -30 + j * 26); ctx.lineTo(44 - (j % 2) * 34, -30 + j * 26); ctx.stroke(); }
  });
  function mtState(t, n) {                                                               // Mireille's transitaire (S13)
    const k = tm(); if (t < k.mEnter0 || t > k.mExit1) return null;
    const ein = ease(t, k.mEnter0, k.mEnter1 - k.mEnter0), eout = ease(t, k.mExit0, k.mExit1 - k.mExit0);
    const x = lerp(MTX + 320, MTX, ein) + 340 * eout, moving = (t < k.mEnter1) || (t > k.mExit0);
    const o = { face: 'smile', look: -.6, blink: (t + .4) % 3.3 < .12, skin: SKIN[2], outfit: '#B5462E', pants: '#3A2A22', shoes: '#231629', hair: 'short' };
    if (moving) { o.walk = stepT(n) * 1.9; o.look = t < k.mEnter1 ? -.3 : .4; }
    if (t < k.decl0 + .05) {                                                             // he carries the declaration in his left hand
      o.handProp = declProp; o.handSide = -1;
      o.arms = moving ? [[80, 170], [150 - Math.sin(stepT(n) * 1.9 * Math.PI * 2) * 8, 250]] : ['hold', 'idle']; }
    if (t >= k.decl0 - .25 && t < k.decl0 + .45) { const a = ease(t, k.decl0 - .25, .25) * (1 - ease(t, k.decl0 + .1, .35)); o.arms = [mixA([70, 150], [270, -10], a), 'idle']; }
    const d = t - (k.declare + .3); if (d > 0 && d < 1) o.tilt = Math.sin(d * 9) * .05 * (1 - d);
    return { x, o, moving };
  }
  function people(t, n) {
    const s = trState(t, n);
    if (s) { const b = walkBob(t, n, s.moving, 7); at(s.x, feetY + b.y, b.r, FIG_S, FIG_S, () => brokerJ(s.o, s.gl)); }
    const m = mtState(t, n);
    if (m) { const b = walkBob(t, n, m.moving, 9); at(m.x, feetY + b.y, b.r, FIG_S, FIG_S, () => brokerFig(m.o)); }
  }

  // ---------- counter-top props: the value tower, the ruler, the printer + ticket, the TVA film ---------------------------
  function blockB(h) {                                                                  // BASKETS (origin = bottom centre)
    stackBlock(BW, h, '', { fill: '#EBD9FF', lift: 5 });
    if (h > 30) { const s = h / BH; at(-56, -h / 2, 0, 1, s, () => sneaker(48, { color: CANVAS, lift: 0 }));
      at(-28, -h / 2 + 11 * s, 0, 1, s, () => text('BASKETS', 0, 0, { font: fitFont('BASKETS', FF.stencil, 32, 106, 900, 2), color: C.violetD, ls: 2 })); }
  }
  function blockT(h) {                                                                  // TRANSPORT: a real photo (no logo), « photo d'illustration »
    stackBlock(BW, h, '', { photo: 'container_ship_deck_aerial_01', zoom: 1.25, fx: .5, fy: .5, lift: 5 });
    if (h > 30) { const s = h / BH; at(0, -h / 2, 0, 1, s, () => { text('TRANSPORT', 0, 4, { font: fitFont('TRANSPORT', FF.stencil, 33, BW - 16, 900, 2), align: 'center', color: '#fff', ls: 2 });
      text("photo d'illustration", BW / 2 - 12, 34, { font: font(FF.body, 16, 700), align: 'right', color: 'rgba(255,255,255,.92)' }); }); }
  }
  function blockA(h) {                                                                  // ASSURANCE (paper umbrella)
    stackBlock(BW, h, '', { fill: '#FFE2C2', lift: 5 });
    if (h > 30) { const s = h / BH; at(-62, -h / 2 - 2 * s, 0, s, s, () => iconUmbrella(32, C.orange));
      at(-40, -h / 2 + 10 * s, 0, 1, s, () => text('ASSURANCE', 0, 0, { font: fitFont('ASSURANCE', FF.stencil, 30, 118, 900, 2), color: '#8A3A08', ls: 2 })); }
  }
  function blockV(glow = 0) {                                                            // VALEUR (origin = bottom centre), 100 tall
    stackBlock(BW, 100, '', { fill: C.violetD, lift: 6 });
    text('VALEUR', 0, -52, { font: font(FF.stencil, 42, 900), align: 'center', color: '#fff', ls: 3 });
    at(-44, -22, 0, 1, 1, () => sneaker(36, { color: '#EBD9FF', accent: '#fff', lift: 0 }));
    at(0, -22, 0, .6, .6, () => iconShip('#EBD9FF')); at(44, -26, 0, 1, 1, () => iconUmbrella(22, '#FFE2C2'));
    for (const x of [-22, 22]) text('+', x, -14, { font: font(FF.body, 22, 800), align: 'center', color: 'rgba(255,255,255,.75)' });
    if (glow > 0) { ctx.save(); ctx.globalAlpha *= glow; ctx.fillStyle = 'rgba(255,255,255,.3)'; rrect(-BW / 2, -100, BW, 100, 16); ctx.fill(); ctx.restore(); }
  }
  function blockD(glow = 0) {                                                            // DROIT DE DOUANE (origin = bottom centre), 110 tall
    stackBlock(BW, 110, '', { fill: C.violet, lift: 6 });
    text('DROIT', 0, -62, { font: font(FF.stencil, 46, 900), align: 'center', color: '#fff', ls: 3 });
    text('DE DOUANE', 0, -24, { font: font(FF.stencil, 32, 900), align: 'center', color: '#fff', ls: 2 });
    if (glow > 0) { ctx.save(); ctx.globalAlpha *= glow; ctx.strokeStyle = '#FFE9A8'; ctx.lineWidth = 6; rrect(-BW / 2 + 3, -107, BW - 6, 104, 14); ctx.stroke(); ctx.restore(); }
  }
  const BLOCKS = [blockB, blockT, blockA];
  function tower(t, n, hero = 0) {                                                       // hero: shorter drop (it happens close to the camera)
    const k = tm(); const m = prog(t, k.merge0, k.merge0 + .5);
    if (m < .45) {                                                                       // three blocks drop one per word, then squash together
      const sq = lerp(1, 100 / (3 * BH), eInCubic(clamp(m / .45)));
      let yb = CT.y;
      for (let i = 0; i < 3; i++) { if (t < k.drops[i]) break; const d = drop(t, k.drops[i], 380, .34), h = BH * sq;
        at(TWX, yb + d.y, 0, d.sx, d.sy, () => BLOCKS[i](h)); yb -= h; }
      if (m > 0) { ctx.save(); ctx.globalAlpha *= clamp(m / .45) * .6; ctx.fillStyle = C.violetD; rrect(TWX - BW / 2, CT.y - 3 * BH * sq, BW, 3 * BH * sq, 16); ctx.fill(); ctx.restore(); }
    } else {                                                                             // ONE block: VALEUR
      const p = 1 + Math.exp(-(m - .45) * 6) * Math.sin((m - .45) * 30) * .06 * (m < 1 ? 1 : 0) + (t > k.merge0 + .5 ? Math.exp(-(t - k.merge0 - .5) * 9) * Math.sin((t - k.merge0 - .5) * 30) * .03 : 0);
      const dl = t - k.hc.out1, land = dl > 0 && dl < .8 ? 1 + Math.exp(-dl * 9) * Math.sin(dl * 30) * .05 : 1;   // back from the hero
      at(TWX, CT.y, 0, 1 / (p * land), p * land, () => blockV(0));
      if (t >= k.drop14) { const d = drop(t, k.drop14, lerp(360, 190, hero), .34), g = env(t, k.code14 - .05, k.code14 + 1.0, .15, .45) + env(t, k.pulse - .05, k.pulse + .9, .12, .4);
        at(TWX, CT.y - 100 + d.y, 0, d.sx, d.sy, () => blockD(clamp(g))); }
    }
  }
  const RUL = { w: 44, h: 310 };
  /** the paper ruler « LA DOUANE COMPARE » standing against the value block: top y, and how far it is sunk behind the counter */
  function rulerState(t) {                                                              // it arrives standing from the COMBIEN hero (hc.out1)
    const k = tm(), sink = eInCubic(prog(t, k.rulerOut, k.rulerOut + .5));
    const off = (t < k.hc.out1 ? 1 : sink) * (RUL.h + 30);
    return { y: CT.y - RUL.h + off, off, on: t >= k.hc.out1 && sink < 1 };
  }
  function ruler(t, n) {
    const k = tm(), R = rulerState(t); if (!R.on) return;
    ctx.save(); ctx.beginPath(); ctx.rect(RUX - 80, CT.y - RUL.h - 60, 160, RUL.h + 64); ctx.clip();          // it lives above the counter top
    at(RUX, R.y + RUL.h, .02 * (1 - clamp(R.off / 60)), 1, 1, () => {                   // origin = its foot on the counter
      withShadow(7, () => { ctx.fillStyle = '#F3D98B'; rrect(-RUL.w / 2, -RUL.h, RUL.w, RUL.h, 6); ctx.fill(); });
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      for (let j = 0; j * 12 < RUL.h - 12; j++) { const y = -8 - j * 12, L = j % 5 === 0 ? 13 : 7; ctx.beginPath(); ctx.moveTo(RUL.w / 2, y); ctx.lineTo(RUL.w / 2 - L, y); ctx.stroke(); }
      at(-4, -RUL.h / 2, -Math.PI / 2, 1, 1, () => text('LA DOUANE COMPARE', 0, 11, { font: fitFont('LA DOUANE COMPARE', FF.stencil, 31, RUL.h - 30, 900, 2), align: 'center', color: C.ink, ls: 2 }));
      const m = ease(t, k.compare + .35, .35);                                           // « compare » : a violet mark at the block's top
      if (m > 0) { ctx.save(); ctx.globalAlpha *= m; ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.moveTo(RUL.w / 2 + 2, -100 - 11); ctx.lineTo(RUL.w / 2 + 18, -100); ctx.lineTo(RUL.w / 2 + 2, -100 + 11); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.violetD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-RUL.w / 2, -100); ctx.lineTo(RUL.w / 2, -100); ctx.stroke(); ctx.restore(); }
    });
    ctx.restore();
  }
  /** the receipt printer + the ticket « NOTE PRÉVUE · estimation ». m = hero close-up (1): a wider ticket, shifted left of
   *  the tower, with a big diagonal « estimation » stamp (≥ 56 px on screen); the world look is m = 0. */
  function printer(t, n, m = 0) {
    const k = tm(), y0 = CT.y, w = lerp(102, 150, m), px = PRX - 42 * m, L = lerp(172, 200, m);
    const len = t < k.print0 ? 0 : L * clamp(prog(Math.max(stepT(n), k.print0), k.print0, k.print1));
    if (len > 1) {                                                                       // the ticket rises out of the slot: its top comes first
      const curl = prog(t, k.print1, k.print1 + .5) * .04;
      at(px, y0 - 44, curl, 1, 1, () => { ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 - 12, -len - 8, w + 24, len + 8); ctx.clip();
        withShadow(5, () => { ctx.fillStyle = '#FFFEF8'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -len + 6);
          for (let xx = -w / 2; xx < w / 2 - 1; xx += w / 9) { ctx.lineTo(xx + w / 18, -len); ctx.lineTo(xx + w / 9, -len + 6); } ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill(); });
        const ty = -len;
        text('NOTE', 0, ty + lerp(48, 54, m), { font: fitFont('NOTE', FF.stencil, lerp(40, 46, m), w - 14, 900, 2), align: 'center', color: C.ink, ls: 2 });
        text('PRÉVUE', 0, ty + lerp(90, 100, m), { font: fitFont('PRÉVUE', FF.stencil, lerp(40, 40, m), w - 16, 900, 2), align: 'center', color: C.ink, ls: 2 });
        if (m < 1) { ctx.save(); ctx.globalAlpha *= 1 - m;
          at(0, ty + 124, -.05, 1, 1, () => { ctx.strokeStyle = '#C8102E'; ctx.lineWidth = 3; rrect(-47, -19, 94, 34, 6); ctx.stroke();
            text('ESTIMATION', 0, 8, { font: fitFont('ESTIMATION', FF.stencil, 25, 84, 900, 1), align: 'center', color: '#C8102E', ls: 1 }); });
          ctx.strokeStyle = DC.line; ctx.lineWidth = 2; for (let j = 0; j < 2; j++) { ctx.beginPath(); ctx.moveTo(-34, ty + 156 + j * 9); ctx.lineTo(32 - j * 26, ty + 156 + j * 9); ctx.stroke(); }
          ctx.restore(); }
        if (m > 0) { ctx.save(); ctx.globalAlpha *= m;                                    // hero: a big ink stamp across the ticket
          at(2, ty + 150, -.27, 1, 1, () => { ctx.strokeStyle = '#C8102E'; ctx.lineWidth = 4; rrect(-74, -24, 148, 44, 8); ctx.stroke();
            text('estimation', 0, 9, { font: fitFont('estimation', FF.body, 30, 136, 800), align: 'center', color: '#C8102E' }); });
          ctx.restore(); }
        ctx.restore(); });
    }
    at(px, y0, 0, 1, 1, () => {                                                          // the little printer (bottom centre on the counter)
      withShadow(8, () => { ctx.fillStyle = '#E4DFD4'; rrect(-28, -44, 56, 44, 9); ctx.fill(); });
      ctx.fillStyle = '#2B2230'; rrect(-24, -44, 48, 7, 3); ctx.fill();
      ctx.fillStyle = t > k.press - .05 && t < k.print1 ? '#3FD68A' : '#2E7D57'; ctx.beginPath(); ctx.arc(17, -16, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#CFC8BA'; rrect(-20, -23, 24, 10, 4); ctx.fill();
    });
  }
  function film(t, n, hero = 0) {                                                       // TVA: translucent violet film over the whole stack
    const k = tm(); if (t < k.film0) return;
    const d = drop(t, k.film0, lerp(300, 120, hero), .36), hg = eInOutCubic(prog(t, k.hug, k.hug + .6));
    const hw = lerp(98, 90, hg), top = lerp(CT.y - 234, CT.y - 222, hg), bot = CT.y + 4, wob = (1 - hg) * 7, s = Math.floor(n / 2) % 3;
    ctx.save(); ctx.translate(TWX, d.y); ctx.scale(d.sx, d.sy);
    const edge = (side) => { const pts = []; for (let j = 0; j <= 8; j++) { const y = lerp(top + 10, bot, j / 8); pts.push([side * hw + Math.sin(j * 1.7 + s) * wob, y]); } return pts; };
    const L = edge(-1), R = edge(1);
    ctx.beginPath(); ctx.moveTo(-hw + 12, top); ctx.quadraticCurveTo(0, top - 8 * (1 - hg), hw - 12, top); ctx.lineTo(...R[0]); for (const p of R) ctx.lineTo(...p);
    ctx.lineTo(...L[L.length - 1]); for (let j = L.length - 1; j >= 0; j--) ctx.lineTo(...L[j]); ctx.closePath();
    ctx.fillStyle = `rgba(169,71,254,${lerp(.24, .34, hg)})`; ctx.fill();
    ctx.strokeStyle = 'rgba(123,34,214,.55)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.clip(); const g = ctx.createLinearGradient(-hw, top, hw, bot); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.35, 'rgba(255,255,255,0)'); g.addColorStop(.7, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-hw - 10, top - 10, 2 * hw + 20, bot - top + 20);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; for (let j = 0; j < 7; j++) { const x = (rnd(j * 2.3) - .5) * hw * 1.6, y = lerp(top, bot, rnd(j * 4.1)); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 26); ctx.stroke(); }
    ctx.restore();
    // the tag on top (opaque paper): « TVA 19,25 % · taux général »
    at(0, top - 44, -.02, 1, 1, () => {
      withShadow(6, () => { ctx.fillStyle = '#FFFDF7'; rrect(-112, -46, 224, 92, 12); ctx.fill(); });
      ctx.strokeStyle = C.violet; ctx.lineWidth = 4; rrect(-104, -38, 208, 76, 8); ctx.stroke();
      text('TVA 19,25 %', 0, 2, { font: fitFont('TVA 19,25 %', FF.stencil, 42, 190, 900, 2), align: 'center', color: C.violetD, ls: 2 });
      text('taux général', 0, 34, { font: font(FF.hand, 27, 800), align: 'center', color: C.ink });
      ctx.fillStyle = '#9AA1A8'; ctx.fillRect(-56, 42, 14, 12); ctx.fillRect(42, 42, 14, 12);                       // staples onto the film
    });
    ctx.restore();
  }

  // ---------- counter front + the TARIF book (z 35) ---------------------------------------------------------------------
  /** the TARIF book, origin = top centre of its cover (world units). m morphs its inner layout from the world look (0)
   *  to the hero close-up (1: smaller title, the tag higher and bigger so « dessus textile » stays readable, a shorter
   *  flap). o: { tag: draw the filed tag, lift: shadow, flap: hinge lift 0..1, glow: « taux » highlight 0..1 } */
  function bookPiece(t, n, m, o = {}) {
    const k = tm(), w = BK.w, h = lerp(BK.h, 165, m), x0 = -w / 2, L = (a, b) => lerp(a, b, m);
    withShadow(o.lift ?? 10, () => { ctx.fillStyle = '#EFE7D4'; rrect(x0 + 6, 6, w, h, 8); ctx.fill(); });                 // page block
    ctx.strokeStyle = 'rgba(120,100,70,.35)'; ctx.lineWidth = 1.5; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(x0 + w + 2, 16 + j * 3); ctx.lineTo(x0 + w + 2, h - 4); ctx.stroke(); }
    ctx.fillStyle = '#1F5B45'; rrect(x0, 0, w, h, 8); ctx.fill();
    ctx.fillStyle = '#153F30'; rrect(x0, 0, 24, h, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(246,197,74,.75)'; ctx.lineWidth = 3; rrect(x0 + 32, 8, w - 40, h - 16, 6); ctx.stroke();
    text('TARIF', L(12, 12), L(42, 30), { font: font(FF.stencil, L(38, 24), 900), align: 'center', color: DC.yellow, ls: L(4, 3) });
    if (o.tag) {                                                                         // the filed tag (between the cover and the flap)
      const g = env(t, k.code14 - .05, k.code14 + 1.0, .15, .45) + env(t, k.pulse - .05, k.pulse + .9, .12, .4), ts = L(.75, 1);
      at(L(11, 12), L(79, 70), 0, ts, ts, () => codeTag(1, 1, { lift: 3, glow: clamp(g) }));
    }
    // the ONE flap: « TAUX · selon le code » (hinged at its top edge, lifts towards us)
    const fl = o.flap || 0, fy = L(82, 105), fh = L(86, 57), fw = L(198, 204), gl = o.glow || 0;
    at(L(12, 12), fy, 0, 1, 1 - lerp(.78, .5, m) * fl, () => {
      withShadow(5 + 10 * fl, () => { ctx.fillStyle = '#FFF8E8'; rrect(-fw / 2, 0, fw, fh, 8); ctx.fill(); });
      ctx.strokeStyle = 'rgba(123,34,214,.45)'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); rrect(-fw / 2 + 7, 6, fw - 14, fh - 12, 5); ctx.stroke(); ctx.setLineDash([]);
      if (gl > 0) { ctx.save(); ctx.globalAlpha *= gl; ctx.strokeStyle = C.violet; ctx.lineWidth = 4; rrect(-fw / 2 - 3, -3, fw + 6, fh + 6, 10); ctx.stroke();
        ctx.fillStyle = 'rgba(169,71,254,.12)'; rrect(-fw / 2, 0, fw, fh, 8); ctx.fill(); ctx.restore(); }
      text('TAUX', 0, L(38, 27.5), { font: font(FF.stencil, L(36, 27.5), 900), align: 'center', color: C.violetD, ls: 3 });
      text('selon le code', 0, L(72, 51.5), { font: font(FF.body, L(29, 24), 800), align: 'center', color: C.ink });
    });
  }
  function book(t, n) {
    const k = tm(), x0 = BK.x - BK.w / 2;
    ctx.strokeStyle = '#8C939B'; ctx.lineWidth = 3; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(x0 + 18, CT.y + 6 + j * 7, 4, 5, 0, 0, 7); ctx.stroke(); }   // chain from the counter lip
    if (t >= k.bk0 && t < k.hq.out1) return;                                             // the book is up at the camera (hero)
    at(BK.x, BK.y, 0, 1, 1, () => bookPiece(t, n, 0, { tag: t >= k.hq.out1 }));
  }
  function counterFront(t, n) {
    withShadow(12, () => { ctx.fillStyle = SAGE; ctx.fillRect(CT.x0, CT.y, CT.x1 - CT.x0, GROUND - CT.y); });
    ctx.strokeStyle = 'rgba(60,90,60,.16)'; ctx.lineWidth = 3; for (let x = CT.x0 + 80; x < CT.x1; x += 80) { ctx.beginPath(); ctx.moveTo(x, CT.y + 16); ctx.lineTo(x, GROUND - 8); ctx.stroke(); }
    withShadow(8, () => { ctx.fillStyle = SAGED; ctx.fillRect(CT.x0 - 16, CT.y - 14, CT.x1 - CT.x0 + 32, 24); });
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(CT.x0 - 16, CT.y - 14, CT.x1 - CT.x0 + 32, 5);
    // plate « DOUANE » (generic, no emblem)
    at(CT.x1 - 62, CT.y + 64, 0, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = DC.green; rrect(-54, -26, 108, 52, 8); ctx.fill(); });
      text('DOUANE', 0, 12, { font: font(FF.stencil, 30, 900), align: 'center', color: DC.yellow, ls: 2 }); });
    book(t, n);
  }

  // ---------- the slip pinned to the rail (S14) ---------------------------------------------------------------------------
  /** the slip itself (slip units: 370 × 138, origin = centre); the world draws it at SLIP.s, the hero at 1.95 */
  const SP = () => [-SLIP.w / 2 + 34, SLIP.w / 2 - 34];                                // clothes-pin x (slip units)
  function slipArt() {
    const w = SLIP.w, h = SLIP.h;
    withShadow(8, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 5, 2.5, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 13, 2.5, 12);
      ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    for (const x of SP()) { ctx.fillStyle = C.violetD; rrect(x - 7, -h / 2 - 10, 14, 26, 4); ctx.fill(); }            // clothes-pins
    text('+ AUTRES LIGNES', -w / 2 + 22, -h / 2 + 47, { font: fitFont('+ AUTRES LIGNES', FF.body, 37, w - 44, 800), color: C.ink });
    text('selon le produit', -w / 2 + 18, -h / 2 + 83, { font: font(FF.hand, 26, 800), color: C.inkSoft });
    text('et votre situation', -w / 2 + 18, -h / 2 + 116, { font: font(FF.hand, 26, 800), color: C.inkSoft });
    at(w / 2 - 34, 20, -.08, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = C.orange; rrect(-78, -25, 156, 50, 10); ctx.fill(); });   // stuck on, it overhangs the edge
      text('→ PARTIE 2', 0, 11, { font: fitFont('→ PARTIE 2', FF.stencil, 33, 142, 900, 2), align: 'center', color: '#fff', ls: 2 }); });
  }
  function slip(t, n) {                                                                  // world: pinned to the rail once the hero has put it back
    const k = tm(); if (t < k.hn.out1) return;
    const d = t - k.hn.out1, sw = d < 3 ? Math.exp(-d * 2) * Math.sin(d * 7) * .025 : 0;
    for (const x of SP()) thread([[SLIP.x + x * SLIP.s, RAIL + 8], [SLIP.x + x * SLIP.s, SLIP.y - (SLIP.h / 2 + 2) * SLIP.s]], 1, n, { w: 3 });
    at(SLIP.x, SLIP.y, sw, SLIP.s, SLIP.s, slipArt);
  }

  // ---------- flying things (z 36) ----------------------------------------------------------------------------------------
  function flights(t, n) {
    const k = tm();
    if (t >= k.decl0 && t < k.decl0 + .5) {                                             // Mireille's export declaration → the officer's hand
      const u = prog(t, k.decl0, k.decl0 + .5), e = eInOutCubic(u), a = [MTX - 135, 835], b = [OFX + DECL_HAND[0] * FIG_S, OFY + DECL_HAND[1] * FIG_S - 20];
      const x = lerp(a[0], b[0], e), y = lerp(a[1], b[1], e) - Math.sin(u * Math.PI) * 290;
      at(x, y, lerp(-.5, -.06, e) + Math.sin(u * 9) * .08, FIG_S, FIG_S, declProp);
    }
  }

  // ---------- Junior & Mireille (poses) ------------------------------------------------------------------------------------
  const RAISE = [215, -270], AWAY = [200, 214], POCKET = [126, 292];
  function juniorLook(t) {
    const k = tm();
    if (t < k.quoi) return .5; if (t < k.tagGo) return .55; if (t < k.e10 + .6) return .35;
    if (t < k.pock0) return .5; if (t < k.pock0 + 1.6) return .8; if (t < k.e12 + .4) return .75;
    if (t < k.e13 + .6) return .95; if (t < k.e14 + .8) return .55; if (t < k.repense) return 0; return .3;
  }
  poseHook('junior', (t) => {
    const k = tm(); if (t < k.trois || t >= k.cut) return null;
    const o = { face: 'smile', look: juniorLook(t) };
    if (t >= k.point0 && t < k.point1 + .45) {                                          // S10: he raises his hand — « Dessus en toile ! »
      const a = ease(t, k.point0, .35), b = ease(t, k.point1, .45);
      o.arms = ['idle', a >= 1 && b <= 0 ? 'raise' : mixA(mixA(IDLE, RAISE, a), IDLE, b)]; o.face = 'grin';
    }
    if (t >= k.compare && t < k.pock0) o.face = 'think';
    if (t >= k.pock0 && t < k.pock0 + 1.7) {                                            // S11 pause: his hand brushes the back pocket
      const u = t - k.pock0; let a;
      if (u < .3) a = mixA(IDLE, AWAY, eInOutCubic(u / .3)); else if (u < .6) a = mixA(AWAY, POCKET, eInOutCubic((u - .3) / .3));
      else if (u < 1.25) a = POCKET; else a = mixA(POCKET, IDLE, eInOutCubic(clamp((u - 1.25) / .4)));
      o.arms = ['idle', a]; o.face = 'worry';
    }
    if (t >= k.note && t < k.tva + .45) o.face = 'think';
    if (t >= k.tva + .45 && t < k.tva + 1.3) o.face = 'shock';
    if (t >= k.tva + 1.3) o.face = 'worry';
    if (t >= k.pale0 - .1) o.sweat = true;
    if (t >= k.hand15) { const a = ease(t, k.hand15, .5); o.arms = ['idle', mixA(IDLE, POCKET, a)]; }
    return o;
  });
  poseHook('mireille', (t) => {
    const k = tm(); if (t < k.trois || t >= k.cut) return null;
    const o = { face: 'smile', look: -.6 };
    if (t >= k.poivre - .1 && t < k.e13 + .6) { const a = ease(t, k.poivre - .1, .35) * (1 - ease(t, k.e13 + .2, .4)); o.arms = ['idle', mixA(IDLE, [66, 128], a)]; o.face = 'grin'; o.look = t > k.decl0 && t < k.decl0 + 1.2 ? .6 : -.7; }
    if (t >= k.s14 - .3 && t < k.e14 + .8) o.look = -.5;
    if (t >= k.sur && t < k.e14 + .8) o.face = 'think';
    if (t >= k.e14 + .8) { o.look = -1; o.face = 'think'; }
    return o;
  });

  // ---------- S15: the paler paper face (stop-motion swap) ---------------------------------------------------------------
  function paleFace(t, n) {
    const k = tm(); if (t < k.pale0 || t >= k.cut) return;
    const st = actorAt('junior', t); if (!st || !inView(st.x, st.y - 80, 200, t)) return;
    const ts = stepT(n), u = ts < k.pale0 ? 0 : prog(ts, k.pale0, k.pale0 + .3);
    const off = u < .34 ? [34, -26, .22] : u < .67 ? [12, -8, .07] : [2, 1, .02];        // the new piece slides on, on twos
    const lk = juniorLook(t), look = lk;
    ctx.save(); worldBegin(t); ctx.translate(st.x, st.y); ctx.scale(FIG_S, FIG_S); ctx.translate(look * 8, -150);
    ctx.translate(off[0], off[1]); ctx.rotate(off[2]);
    ctx.save(); ctx.beginPath(); ctx.rect(-130, -45, 260, 200); ctx.clip();
    withShadow(4, () => { ctx.fillStyle = PALE; ctx.beginPath(); ctx.ellipse(0, 0, 100, 118, 0, 0, 7); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 97, 115, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(150,170,160,.18)'; ctx.beginPath(); ctx.ellipse(0, 10, 90, 100, 0, 0, 7); ctx.fill();
    const ink = '#140C10';
    for (const x of [-40, 40]) { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.ellipse(x, -4, 21, 24, 0, 0, 7); ctx.fill();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + look * 6, 2, 8, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 30, 16, 10, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3A0F16'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-26, 80); ctx.quadraticCurveTo(-12, 66, 0, 76); ctx.quadraticCurveTo(12, 86, 26, 72); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 8; ctx.lineCap = 'round';                   // worried brows (over the hairline)
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 18, -56); ctx.lineTo(s * 62, -44); ctx.stroke(); }
    ctx.fillStyle = '#9FD3FF'; const dy = ((t - k.pale0) * 40) % 30;                    // sweat drop
    ctx.beginPath(); ctx.moveTo(98, -62 + dy); ctx.quadraticCurveTo(116, -30 + dy, 98, -22 + dy); ctx.quadraticCurveTo(80, -30 + dy, 98, -62 + dy); ctx.fill();
    ctx.restore();
  }

  // ---------- screen overlays: bubbles ------------------------------------------------------------------------------------
  function bubble(cx, cy, lines, a, tip, col, fs = 50) {
    if (a <= .01) return;
    const f = font(FF.hand, fs, 800), lh = fs * 1.16, w = Math.max(...lines.map(l => measure(l, f))) + 76, h = lines.length * lh + 40;
    at(cx, cy, -.02, a, a, () => {
      const tx = (tip.x - cx) / a, ty = (tip.y - cy) / a, bx = clamp(tx, -w / 2 + 50, w / 2 - 50), by = ty > 0 ? h / 2 - 6 : -h / 2 + 6;
      withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; rrect(-w / 2, -h / 2, w, h, 38); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - 26, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + 26, by); ctx.closePath(); ctx.fill(); });
      ctx.strokeStyle = col; ctx.lineWidth = 5; rrect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 30); ctx.stroke();
      lines.forEach((l, i) => text(l, 0, -h / 2 + 20 + lh * (i + 1) - 16, { font: f, align: 'center', color: C.ink }));
    });
  }
  function hud(t, n) {
    const k = tm();
    if (t > k.bub0 - .05 && t < k.bub1 + .3) {                                           // Junior confirms what he had written
      const j = actorAt('junior', t); if (j) { const hd = worldToScreen(j.x, j.y - 150 * FIG_S, t);
        const a = clamp(spring(t - k.bub0, 14, .5), 0, 1.12) * (1 - eInCubic(clamp((t - k.bub1) / .25)));
        bubble(clamp(hd.x - 130, 200, 420), clamp(hd.y - 225, 330, 1000), ['Dessus', 'en toile !'], a, { x: hd.x + 18, y: hd.y - 40 }, C.violet); }
    }
    if (t > k.bub2 - .05 && t < k.bub2 + 1.75) {                                         // the transitaire, over his glasses
      const hd = worldToScreen(TRX, feetY - 150 * FIG_S, t), a = clamp(spring(t - k.bub2, 14, .5), 0, 1.12) * (1 - eInCubic(clamp((t - k.bub2 - 1.45) / .25)));
      bubble(clamp(hd.x + 70, 300, 700), clamp(hd.y - 140, 330, 1000), ["C'est le vrai prix ?"], a, { x: hd.x + 22, y: hd.y - 30 }, DC.blue, 50);
    }
  }

  // ---------- HERO INSERTS (screen space, z 46) ----------------------------------------------------------------------------
  // Poses are { x, y, s, r } on screen; s = px per unit of the piece (card units for the cards, world units for the rest).
  const HP = {
    quoi: { x: 520, y: 578, s: 2.8 }, combien: { x: 540, y: 598, s: 2.95 }, dou: { x: 540, y: 604, s: 2.95 }, exp: { x: 372, y: 578, s: 2.8 },
    book: { x: 508, y: 796, s: 540 / 230 }, note: { x: 540, y: 1168, s: 2.1 }, slip: { x: 505, y: 392, s: 1.85 },
  };
  function cardHero(i, t) { const k = tm(); for (const h of [k.hq, k.hc, k.hd, k.he]) if (h.i === i && t >= h.in0 && t < h.out1) return h; return null; }
  /** flight progress: a (in 0..1), b (out 0..1), e = how close to the camera the piece is (0 world … 1 hero) */
  function flight(h, t) { const a = prog(t, h.in0, h.in1), b = prog(t, h.out0, h.out1); return { a, b, e: eInOutCubic(a) * (1 - eInOutCubic(b)), back: b > 0 }; }
  /** world anchor → hero pose. It swings towards the lens (a small overshoot of scale, a tilt), floats while held, swings back. */
  function pose(from, to, f, t, seed = 0, dir = 1) {
    const e = f.e, s = Math.exp(lerp(Math.log(from.s), Math.log(to.s), e)) * (f.back ? 1 : 1 + .03 * Math.sin(Math.PI * clamp((f.a - .5) / .5)));
    const hold = e * e, r = lerp(from.r || 0, 0, e) + (f.back ? -Math.sin(f.b * Math.PI) * .06 : Math.sin(f.a * Math.PI) * .08) * dir + Math.sin(t * .8 + seed) * .006 * hold;
    return { x: lerp(from.x, to.x, e) + Math.sin(t * .6 + seed) * 3 * hold, y: lerp(from.y, to.y, e) + Math.sin(t * 1.05 + seed * 2) * 4 * hold - Math.sin(Math.PI * e) * 30, s, r, e };
  }
  const worldPose = (x, y, t, s = 1, r = 0) => { const p = worldToScreen(x, y, t); return { x: p.x, y: p.y, s: s * camAt(t).z, r }; };
  const cardAnchor = (i, t) => { const st = cardState(i, t); return worldPose(st.x, st.y, t, st.s, st.r); };
  /** a point given in the local frame of a pose (units of the pose) → screen */
  const local = (P, x, y) => { const r = P.r || 0; return { x: P.x + (x * Math.cos(r) - y * Math.sin(r)) * P.s, y: P.y + (x * Math.sin(r) + y * Math.cos(r)) * P.s }; };
  const heroShake = (t, n) => { const s = shake(t, n); ctx.translate(s.x * .6, s.y * .6); };

  // the card on its thread, in front of the camera
  function heroCard(i, t, n, h, contentPx) {
    const f = flight(h, t), P = pose(cardAnchor(i, t), HP[h.key], f, t, i * 1.7 + (h.key === 'exp' ? 3 : 0), i === 2 ? -1 : 1), st = cardState(i, t);
    const pin = worldToScreen(CX[i], RAIL + 8, t), g = local(P, 0, -CH / 2 + 12);
    thread([[pin.x, pin.y], [g.x, g.y]], 1, n, { w: lerp(4 * camAt(t).z, 6, f.e) });   // still tied to its thread
    const cs = Math.cos(st.ang * Math.PI), rectoUp = Math.round(st.ang) % 2 === 1, lift = lerp(8, 44, f.e);
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.r); ctx.scale(P.s, P.s); ctx.scale(Math.max(.03, Math.abs(cs)), 1);
    if (rectoUp) {
      if (contentPx) { rectoFrame(i, lift);
        if (f.e < 1) { ctx.save(); ctx.globalAlpha *= 1 - f.e; rectoContent(i, t, n); ctx.restore(); }                     // the small world drawing …
        if (f.e > 0) { ctx.save(); ctx.globalAlpha *= f.e; at(0, 0, 0, 1 / HP[h.key].s, 1 / HP[h.key].s, () => contentPx(t, n, f)); ctx.restore(); } }  // … becomes the big one
      else recto(i, t, n, lift);
    } else verso(i, t, n, st.ang > 1.5, lift);
    if (Math.abs(cs) < .7) { ctx.fillStyle = `rgba(60,32,12,${(.7 - Math.abs(cs)) * .45})`; rrect(-CW / 2, -CH / 2, CW, CH, 14); ctx.fill(); }
    ctx.restore();
    return P;
  }

  // ---- QUOI: the tag unclips, the TARIF book rises under it, its flap closes ----
  function heroQuoi(t, n) {
    const k = tm(), h = k.hq; if (t < h.in0 || t >= h.out1) return;
    const P = heroCard(0, t, n, h);
    const hb = { in0: k.bk0, in1: k.bk1, out0: h.out0, out1: h.out1 };
    let B = null;
    if (t >= k.bk0) {                                                                    // the book, from its place on the counter front
      const f = flight(hb, t); B = pose(worldPose(BK.x, BK.y, t), HP.book, f, t, 5.1, -1);
      const fl = ease(t, k.bk1 - .22, .18) * (1 - ease(t, k.flapShut - .06, .16)), gl = env(t, k.taux10 - .05, k.taux10 + 1.25, .15, .4);
      at(B.x, B.y, B.r, B.s, B.s, () => bookPiece(t, n, f.e, { tag: t >= k.bk1 - .05, lift: lerp(10, 40, f.e), flap: fl, glow: gl * f.e }));
    }
    if (t >= k.tagGo && t < k.bk1 - .05) {                                               // the 64 04 tag: off the card, hovering where the pocket will be
      const u = eInOutCubic(prog(t, k.tagGo, k.tagHov)), from = local(P, 0, 76), pk = local(HP.book, 12, 70);
      const x = lerp(from.x, pk.x, u), y = lerp(from.y, pk.y, u) - Math.sin(u * Math.PI) * 50, s = lerp(P.s, HP.book.s, u);
      const hov = t > k.tagHov ? Math.sin((t - k.tagHov) * 5) * 3 : 0;
      at(x, y + hov, Math.sin(u * Math.PI) * .09 + P.r * (1 - u), s, s, () => codeTag(1, 1, { lift: 18 }));
    }
  }

  // ---- COMBIEN: three blocks drop into the card, merge into VALEUR, the ruler is laid over it ----
  const CB = { w: 460, h: 90, y: 318 };                                                   // hero blocks (px, card-centre origin): the stack's foot at y
  const VAL_S = CB.w / BW;                                                               // VALEUR drawn from the world block (170 × 100 → 460 × 271)
  function heroBlock(j) {                                                                // px, origin = bottom centre
    const w = CB.w, h = CB.h;
    if (j === 0) { stackBlock(w, h, '', { fill: '#EBD9FF', lift: 6 });
      at(-w / 2 + 72, -h / 2 + 6, 0, 1, 1, () => sneaker(104, { color: CANVAS, lift: 0 }));
      text('BASKETS', -w / 2 + 142, -h / 2 + 22, { font: fitFont('BASKETS', FF.stencil, 62, w - 170, 900, 3), color: C.violetD, ls: 3 }); }
    else if (j === 1) { stackBlock(w, h, '', { photo: 'container_ship_deck_aerial_01', zoom: 1.2, fx: .5, fy: .5, lift: 6 });
      text('TRANSPORT', -w / 2 + 26, -h / 2 + 16, { font: fitFont('TRANSPORT', FF.stencil, 60, w - 60, 900, 3), color: '#fff', ls: 3, shadow: true });
      text("photo d'illustration", w / 2 - 18, -11, { font: font(FF.body, 20, 700), align: 'right', color: 'rgba(255,255,255,.95)' }); }
    else { stackBlock(w, h, '', { fill: '#FFE2C2', lift: 6 });
      at(-w / 2 + 60, -h / 2 + 12, 0, 1, 1, () => iconUmbrella(62, C.orange));
      text('ASSURANCE', -w / 2 + 112, -h / 2 + 22, { font: fitFont('ASSURANCE', FF.stencil, 60, w - 134, 900, 3), color: '#8A3A08', ls: 3 }); }
  }
  /** the officer's paper ruler as a strip (px, centred). k = 1: hero (two lines, lying over VALEUR) … 0: its world look
   *  (one line; the caller rotates it upright). */
  function rulerStrip(w, h, k, mark = 0) {
    withShadow(lerp(7, 16, k), () => { ctx.fillStyle = '#F3D98B'; rrect(-w / 2, -h / 2, w, h, lerp(6, 10, k)); ctx.fill(); });
    ctx.strokeStyle = C.ink; ctx.lineWidth = lerp(2, 3, k); const N = 26;
    for (let j = 1; j < N; j++) { const x = -w / 2 + j * w / N, L = (j % 5 === 0 ? .3 : .16) * Math.min(h, 70); ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x, h / 2 - L); ctx.stroke(); }
    const f1 = fitFont('LA DOUANE COMPARE', FF.stencil, lerp(h * .72, 58, k), w - lerp(30, 44, k), 900, 2);
    text('LA DOUANE COMPARE', 0, lerp(h * .16, -h / 2 + 64, k), { font: f1, align: 'center', color: C.ink, ls: 2 });
    if (k > 0) text('les prix', 0, -h / 2 + 124, { font: font(FF.hand, 58, 800), align: 'center', color: C.violetD, alpha: clamp(k * 1.6 - .6) });
    if (mark > 0 && k > 0) { ctx.save(); ctx.globalAlpha *= mark * k; ctx.fillStyle = C.violetD;              // « compare »: the mark points at VALEUR's top
      ctx.beginPath(); ctx.moveTo(-22, h / 2 + 2); ctx.lineTo(22, h / 2 + 2); ctx.lineTo(0, h / 2 + 30); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }
  const RH = { w: 520, h: 150, y: -104 };                                                 // hero ruler (px, card-centre origin)
  function combienPx(t, n, f) {                                                          // px, card-centre origin (drawn inside the card)
    const k = tm(), m = prog(t, k.merge0, k.merge0 + .5);
    ctx.save(); ctx.setLineDash([12, 9]); ctx.strokeStyle = 'rgba(199,122,18,.55)'; ctx.lineWidth = 4;              // three empty slots
    for (let j = 0; j < 3; j++) { rrect(-CB.w / 2, CB.y - (j + 1) * CB.h + 4, CB.w, CB.h - 8, 14); ctx.stroke(); }
    ctx.restore();
    if (m < .45) {
      for (let j = 0; j < 3; j++) { if (t < k.drops[j]) break; const d = drop(t, k.drops[j], 170, .34);             // a short drop: never over the header
        ctx.save(); ctx.globalAlpha *= clamp((t - k.drops[j]) / .12);
        at(0, CB.y - j * CB.h + d.y, 0, d.sx, d.sy, () => heroBlock(j)); ctx.restore();
        if (j > 0) { const p = clamp(spring(t - k.drops[j] - .3, 16, .45), 0, 1.2); if (p > .01) at(-CB.w / 2 + 2, CB.y - j * CB.h, 0, p, p, () => {   // « plus »
          withShadow(4, () => { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(0, 0, 25, 0, 7); ctx.fill(); });
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke(); }); }
      }
      if (m > 0) { ctx.save(); ctx.globalAlpha *= clamp(m / .45) * .7; ctx.fillStyle = C.violetD; rrect(-CB.w / 2, CB.y - 3 * CB.h, CB.w, 3 * CB.h, 16); ctx.fill(); ctx.restore(); }
    } else if (t < k.hc.out0) {                                                          // ONE block: VALEUR (it leaves for the counter at out0)
      const p = 1 + Math.exp(-(m - .45) * 6) * Math.sin((m - .45) * 30) * .05 * (m < 1 ? 1 : 0);
      at(0, CB.y, 0, VAL_S / p, VAL_S * p, () => blockV(0));
    }
    if (t >= k.ruler0 && t < k.hc.out0) {                                                 // « compare »: the ruler slides in and lies over VALEUR
      const u = eOutCubic(prog(t, k.ruler0, k.ruler0 + .45)), mk = ease(t, k.compare + .35, .35);
      at(lerp(640, 0, u), RH.y, lerp(.22, -.015, u), 1, 1, () => rulerStrip(RH.w, RH.h, 1, mk));
    }
  }
  function heroCombien(t, n) {
    const k = tm(), h = k.hc; if (t < h.in0 || t >= h.out1) return;
    heroCard(1, t, n, h, combienPx);
    if (t < h.out0) return;
    // VALEUR and the ruler go back to the counter (the card goes back to its thread)
    const P0 = pose(cardAnchor(1, h.out0), HP.combien, flight(h, h.out0), h.out0, 1.7, 1), b = eInOutCubic(prog(t, h.out0, h.out1)), z = camAt(t).z;
    const v0 = local(P0, 0, CB.y / HP.combien.s), v1 = worldToScreen(TWX, CT.y, t), vs = Math.exp(lerp(Math.log(VAL_S * P0.s / HP.combien.s), Math.log(z), b));
    at(lerp(v0.x, v1.x, b), lerp(v0.y, v1.y, b) - Math.sin(b * Math.PI) * 40, Math.sin(b * Math.PI) * .05 + P0.r * (1 - b), vs, vs, () => blockV(0));
    const r0 = local(P0, 0, RH.y / HP.combien.s), r1 = worldToScreen(RUX, CT.y - RUL.h / 2, t), sc = P0.s / HP.combien.s;
    at(lerp(r0.x, r1.x, b), lerp(r0.y, r1.y, b) - Math.sin(b * Math.PI) * 60, lerp(P0.r - .015, -Math.PI / 2, eInOutCubic(b)), 1, 1,
      () => rulerStrip(lerp(RH.w * sc, RUL.h * z, b), lerp(RH.h * sc, RUL.w * z, b), 1 - b, 1));
  }

  // ---- D'OÙ: the card itself (factory ✓ · port postcard ✗) ----
  function heroDou(t, n) { const k = tm(), h = k.hd; if (t >= h.in0 && t < h.out1) heroCard(2, t, n, h); }
  // ---- S13: the QUOI card's orange back — Mireille's pepper, « l'export aussi se déclare » ----
  function heroExport(t, n) { const k = tm(), h = k.he; if (t >= h.in0 && t < h.out1) heroCard(0, t, n, h); }

  // ---- S14: the counter top (printer + ticket, VALEUR, DROIT, TVA film) rises to the camera; the slip joins it ----
  function heroNote(t, n) {
    const k = tm(), h = k.hn; if (t < h.in0 || t >= h.out1) return;
    const f = flight(h, t), P = pose(worldPose(GX, CT.y, t), HP.note, f, t, 3.3, 1);
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.r); ctx.scale(P.s, P.s); ctx.translate(-GX, -CT.y);
    ctx.save(); ctx.globalAlpha *= clamp(f.e * 1.4);                                      // a strip of the sage counter top carries it
    withShadow(lerp(8, 30, f.e), () => { ctx.fillStyle = SAGED; rrect(GX - 204, CT.y - 4, 408, 26, 8); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(GX - 198, CT.y - 2, 396, 5); ctx.restore();
    printer(t, n, f.e); tower(t, n, 1); film(t, n, 1);
    ctx.restore();
    if (t < k.slip0) return;                                                             // « Et d'autres lignes » the slip drops in above it
    const u = prog(t, k.slip0, k.slip0 + .5), fs = flight({ in0: k.slip0, in1: k.slip0, out0: h.out0, out1: h.out1 }, t);
    const drp = (1 - eOutBack(u, 1.15)) * 720, sw = Math.exp(-(t - k.slip0) * 2.2) * Math.sin((t - k.slip0) * 7) * .03;   // swings in from the right (never across the series tag)
    const S = pose(worldPose(SLIP.x, SLIP.y, t, SLIP.s), HP.slip, fs, t, 7.7, 1); S.x += drp * (fs.back ? 0 : 1); S.r += sw + (fs.back ? 0 : (1 - u) * .12);
    for (const x of SP()) { const top = worldToScreen(SLIP.x + x * SLIP.s, RAIL + 8, t), pin = local(S, x, -SLIP.h / 2 - 2); thread([[top.x, top.y], [pin.x, pin.y]], 1, n, { w: lerp(3 * camAt(t).z, 4.5, fs.e) }); }
    at(S.x, S.y, S.r, S.s, S.s, slipArt);
  }
  /** while a piece is at the camera, the world behind it settles back a little (warm shadow, not a blackout) */
  function heroWash(t) {
    const k = tm(); let e = 0;
    for (const h of [k.hq, k.hc, k.hd, k.he]) if (t >= h.in0 && t < h.out1) e = Math.max(e, flight(h, t).e * .16);
    if (t >= k.hn.in0 && t < k.hn.out1) e = Math.max(e, flight(k.hn, t).e * .2);
    if (e > .002) { ctx.save(); ctx.fillStyle = `rgba(46,28,20,${e})`; ctx.fillRect(-40, -40, W + 80, H + 80); ctx.restore(); }
  }
  function heroes(t, n) { heroWash(t); heroQuoi(t, n); heroCombien(t, n); heroDou(t, n); heroExport(t, n); heroNote(t, n); }

  // ---------- scenes -------------------------------------------------------------------------------------------------------
  registerScene({ id: 'C26_booth', z: 20, draw(t, n) { tm(); lazyShakes(); if (!onStage(t)) return; ctx.save(); worldBegin(t); booth(t, n); ctx.restore(); } });
  registerScene({ id: 'C26_officer', z: 21, draw(t, n) { if (!onStage(t)) return; ctx.save(); worldBegin(t); officer(t, n); ctx.restore(); } });
  registerScene({ id: 'C26_cards', z: 27, draw(t, n) {
    if (!onStage(t)) return; ctx.save(); worldBegin(t);
    const order = [0, 1, 2].sort((a, b) => cardState(a, t).f - cardState(b, t).f);          // the asked card on top
    for (const i of order) drawCard(i, t, n);
    slip(t, n); ctx.restore();
  } });
  registerScene({ id: 'C26_people', z: 28, draw(t, n) { if (!onStage(t)) return; ctx.save(); worldBegin(t); people(t, n); ctx.restore(); } });
  registerScene({ id: 'C26_pale', z: 33, draw(t, n) { paleFace(t, n); } });
  registerScene({ id: 'C26_top', z: 34, draw(t, n) {
    if (!onStage(t)) return; ctx.save(); worldBegin(t);
    const k = tm(), heroN = t >= k.hn.in0 && t < k.hn.out1;                             // S14: the counter top is up at the camera
    if (!heroN) printer(t, n); ruler(t, n); if (t >= k.hc.out1 && !heroN) tower(t, n); if (!heroN) film(t, n);
    ctx.restore();
  } });
  registerScene({ id: 'C26_front', z: 35, draw(t, n) { if (!onStage(t)) return; ctx.save(); worldBegin(t); counterFront(t, n); ctx.restore(); } });
  registerScene({ id: 'C26_fly', z: 36, draw(t, n) { if (!onStage(t)) return; ctx.save(); worldBegin(t); flights(t, n); ctx.restore(); } });
  registerScene({ id: 'C26_hud', z: 45, draw(t, n) { const k = tm(); if (t < k.bub0 - .1 || t > k.bub2 + 2) return; hud(t, n); } });
  registerScene({ id: 'C26_hero', z: 46, draw(t, n) { const k = tm(); if (t < k.hq.in0 || t >= k.hn.out1) return; ctx.save(); heroShake(t, n); heroes(t, n); ctx.restore(); } });
})();

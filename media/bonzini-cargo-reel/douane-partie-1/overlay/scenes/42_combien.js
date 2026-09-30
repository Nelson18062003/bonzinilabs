'use strict';
// =============================================================================================
// 42_combien — chapitre « combien » (S8)
// « Combien ? Marchandise, plus transport, plus assurance. Oui… même le bateau est taxé ! »
//  · début          : la carte « 2 COMBIEN ? » au centre ; sur « Combien » elle s'envole et se RETOURNE en en-tête qHeader(1).
//  · « Marchandise » : le 1er bloc (lilas, mini basket) tombe du haut, s'écrase et rebondit (pile entière qui s'écrase en deux).
//  · « plus »       : pastille « + » manuscrite (orange) qui claque sur le joint, à gauche de la tour.
//  · « transport »  : bloc PHOTO (porte-conteneurs, duotone ambre, Ken Burns) + « le fret » ; fuite de lumière à l'impact.
//  · « plus » / « assurance » : 2e « + », bloc ASSURANCE (parapluie).
//  · fin d'« assurance » : accolade manuscrite qui se dessine au-dessus → plaque « VALEUR EN DOUANE » qui claque.
//  · « Oui »        : Junior en médaillon (bas gauche) pop, visage choqué + goutte ; « même » : il tremble.
//  · « bateau »     : le bloc TRANSPORT frétille + liseré ambre ; flèche manuscrite du médaillon vers le bateau.
//  · « taxé »       : pastille papier + tampon rouge « TAXÉ » (anneau « MÊME LE BATEAU ») qui claque + secousse.
// La scène possède l'image de TL.ch('combien').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'combien', SEG = 'S8', QI = 1;
  const TX = 500, BASE = 1185, TW = 620;
  const BL = [
    { h: 150, label: 'MARCHANDISE', side: '#BFA3EA' },
    { h: 170, label: '', side: '#2A1606' },
    { h: 150, label: 'ASSURANCE', side: '#E7B98A' },
  ];
  const Y0 = [0, 150, 320];                                               // block bottoms (px above BASE)
  const STAMP = { x: 828, y: 946, r: 134 };
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = (k, nth = 0) => TL.wt(SEG, k, null, nth);
    const o = { c0: c.start, c1: c.end };
    o.comb = Math.max(o.c0 + .05, w('combien'));
    const b0 = Math.max(o.comb + .3, w('marchandise')), p1 = Math.max(b0 + .2, w('plus')), b1 = Math.max(p1 + .1, w('transport'));
    const p2 = Math.max(b1 + .2, w('plus', 1)), b2 = Math.max(p2 + .1, w('assurance'));
    o.blk = [b0, b1, b2]; o.plus = [p1, p2];
    o.land = o.blk.map(x => x - .1 + .26);
    o.oui = Math.max(b2 + .3, w('oui'));
    o.brace = Math.max(o.land[2] + .05, Math.min(b2 + .3, o.oui - .3)); o.plate = o.brace + .28;
    o.meme = Math.max(o.oui + .15, w('meme'));
    o.bat = Math.max(o.oui + .3, w('bateau'));
    o.taxe = Math.max(o.bat + .2, Math.min(w('taxe'), o.c1 - .45));
    return o;
  }

  // ---------------------------------------------------------------------------- value blocks
  function opt(i, t) {
    if (i === 0) return { fill: BLK.marchandise, icon: () => at(4, 10, -.08, 1, 1, () => sneaker(128, { color: C.violet, accent: C.amber, lift: 3 })) };
    if (i === 1) return { photo: 'ships_cranes', fx_kind: 'duo', cols: DUO.amber, zoom: 1.08 + .06 * prog(t, T.land[1], T.c1), fx: .42, fy: .62 };
    return { fill: BLK.assurance, icon: () => at(0, -4, .06 * Math.sin(stepT(Math.round(t * 30)) * 3), 1, 1, () => iconUmbrella(96)) };
  }
  function block(i, t, n) {
    const B = BL[i];
    ctx.fillStyle = B.side; rrect(-TW / 2 + 7, -B.h + 12, TW, B.h, 16); ctx.fill();          // paper thickness (2.5D)
    stackBlock(TW, B.h, B.label, opt(i, t));
    if (i === 1) {                                                                            // TRANSPORT: own label + « le fret » (≥ 44 px)
      text('TRANSPORT', 0, -B.h / 2 + 8, { font: font(FF.stencil, 66, 900), align: 'center', color: '#FFFFFF', ls: 3 });
      text('le fret', 0, -B.h / 2 + 62, { font: font(FF.hand, 46, 800), align: 'center', color: '#F7E3C0' });
      const bk = env(t, T.bat - .05, T.taxe + .1, .1, .2);                                   // amber outline on « bateau »
      if (bk > 0) { ctx.save(); ctx.globalAlpha *= bk; ctx.strokeStyle = C.amber; ctx.lineWidth = 9; ctx.setLineDash([22, 12]); ctx.lineDashOffset = -stepT(n) * 60;
        rrect(-TW / 2 - 8, -B.h - 8, TW + 16, B.h + 16, 22); ctx.stroke(); ctx.restore(); }
    }
  }
  function plusBadge(k, n, seed) {
    at(0, 0, (rnd(seed) - .5) * .3, k, k, () => {
      withShadow(6, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.fill(); });
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 10; ctx.lineCap = 'round'; const j = jit(seed, n, 1.2);
      ctx.beginPath(); ctx.moveTo(-18 + j.x, 1); ctx.lineTo(19, -2 + j.y); ctx.moveTo(1, -19); ctx.lineTo(-1 + j.x, 18); ctx.stroke();
    });
  }
  function tower(t, n, ts) {
    let sq = 0;
    for (const L of T.land) { const dt = t - L; if (dt > 0) sq += Math.exp(-dt * 10) * Math.sin(dt * 30) * .035; }
    const d = drift(t, 30, 3), j = jit(31, n, .5);
    at(TX + d.x + j.x, BASE + d.y + j.y, j.r * .5, 1 + sq * .5, 1 - sq, () => {
      for (let i = 0; i < 3; i++) {
        const D = drop(ts, T.blk[i] - .1, 1100, .26); if (!D.a) continue;
        const wig = i === 1 && t > T.bat ? Math.sin((t - T.bat) * 28) * .03 * Math.exp(-(t - T.bat) * 3.5) : 0;
        const r = (D.landed ? 0 : (i % 2 ? .06 : -.05)) + wig;
        at(0, -Y0[i] + D.y, r, D.sx, D.sy, () => block(i, t, n));
      }
      for (let q = 0; q < 2; q++) { const tp = T.plus[q]; if (t < tp - .04) continue;
        at(-TW / 2, -Y0[q + 1], 0, 1, 1, () => plusBadge(pop(t, tp - .04, 18, .45), n, 13 + q * 7)); }
    });
  }

  // ---------------------------------------------------------------------------- brace + « VALEUR EN DOUANE » plate
  let _brace = null;
  function bracePts() {
    if (_brace) return _brace;
    const x0 = TX - 292, x1 = TX + 292, y = 700;
    const pts = curve([[x0, y + 16], [x0 + 22, y - 2], [TX - 44, y - 4], [TX - 10, y - 14], [TX, y - 34], [TX + 10, y - 14], [TX + 44, y - 4], [x1 - 22, y - 2], [x1, y + 16]], 10);
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return (_brace = { pts, L });
  }
  function brace(t, n) {
    const p = eOutCubic(prog(t, T.brace, T.brace + .26)); if (p <= 0) return;
    const { pts, L } = bracePts(), tot = L[L.length - 1], mid = tot / 2, j = jit(33, n, .6), d = drift(t, 30, 3);
    ctx.save(); ctx.translate(d.x + j.x, d.y + j.y); ctx.strokeStyle = C.violetD; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); let first = true;                                        // drawn from the tip outwards (both halves at once)
    for (let i = 0; i < pts.length; i++) { if (Math.abs(L[i] - mid) > mid * p) { first = true; continue; } if (first) { ctx.moveTo(...pts[i]); first = false; } else ctx.lineTo(...pts[i]); }
    ctx.stroke(); ctx.restore();
  }
  function valuePlate(t, n) {
    if (t < T.plate - .1) return;
    const sl = slam(t, T.plate, 1.7), d = drift(t, 34, 4), j = jit(35, n, .6);
    at(TX + d.x + j.x, 585 + d.y + j.y, -.018 + j.r, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a;
      plate(0, 0, 'VALEUR EN DOUANE', { fam: FF.stencil, size: 76, wght: 900, fill: C.violetD, color: '#FFFFFF', ls: 3, pad: 34, lift: 12 }); });
  }

  // ---------------------------------------------------------------------------- Junior medallion + arrow to the boat
  function medallion(t, n) {
    if (t < T.oui - .02) return;
    const k = pop(t, T.oui - .02, 15, .45), r = 74, j = jit(77, n, t > T.meme && t < T.meme + .6 ? 3 : .8), d = drift(t, 78, 3);
    at(94 + d.x + j.x, 1166 + d.y + j.y, -.06 + j.r, k, k, () => {
      withShadow(12, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(0, 0, r + 12, 0, 7); ctx.fill(); });
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
      ctx.fillStyle = '#FFE2C2'; ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.strokeStyle = 'rgba(254,86,13,.35)'; ctx.lineWidth = 6; for (let q = 0; q < 10; q++) { const a = q / 10 * Math.PI * 2 + stepT(n) * .8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke(); }
      at(0, 72, 0, .46, .46, () => junior({ face: 'shock', sweat: true }));
      ctx.restore();
      ctx.strokeStyle = C.violet; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, 7); ctx.stroke();
    });
    const ak = prog(t, T.bat - .02, T.bat + .24);
    if (ak > 0) { const pts = [[92, 1080], [98, 992], [168, 954], [262, 946]];
      handArrow(pts, ak, 'rgba(35,22,41,.85)', 14); handArrow(pts, ak, C.amber, 8); }
  }

  // ---------------------------------------------------------------------------- « TAXÉ » stamp on a paper sticker
  let _stk = null;
  function stickerPts() {
    if (_stk) return _stk; const R = STAMP.r + 16, pts = [];
    for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, rr = R + (rnd(i * 3.3 + 7) - .5) * 9; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    return (_stk = pts);
  }
  function taxStamp(t, n) {
    if (t < T.taxe - .1) return;
    const sl = slam(t, T.taxe, 1.9), j = jit(95, n, .5), d = drift(t, 30, 3);
    at(STAMP.x + d.x + j.x, STAMP.y + d.y + j.y, -.16 + j.r, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a;
      withShadow(10, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); stickerPts().forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); });
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = DC.red; ctx.globalAlpha *= .92;
      ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(0, 0, STAMP.r - 8, 0, 7); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, STAMP.r - 26, 0, 7); ctx.stroke();
      ctx.restore();
      stampText('TAXÉ', 0, -12, font(FF.stencil, 90, 900), DC.red, { starve: .3, ls: 2 });
      stampText('AUSSI !', 0, 56, font(FF.stencil, 46, 900), DC.red, { starve: .3, ls: 4 });
    });
    const ik = prog(t, T.taxe, T.taxe + .22);                                                   // ink impact strokes
    if (ik > 0 && ik < 1) at(STAMP.x, STAMP.y, 0, 1, 1, () => { ctx.save(); ctx.strokeStyle = DC.red; ctx.lineCap = 'round'; ctx.lineWidth = 9 * (1 - ik) + 1;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + .2, r0 = STAMP.r + 30 + 40 * ik, r1 = r0 + 46 * (1 - ik) + 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
      ctx.restore(); });
  }

  // ---------------------------------------------------------------------------- big question card → flips into the header
  let _qs = 0;
  function introHeader(t, n) {
    const tw = T.comb, fl = prog(t, tw + .04, tw + .34), e = eInOutCubic(fl), d = drift(t, 40 + QI, 4);
    if (fl < 1) {
      if (!_qs) _qs = Math.min(120, 120 * 380 / measure(QWORD[QI], font(FF.stencil, 120, 900), 3));
      const inK = clamp(spring(t - T.c0 + .18, 13, .5), 0, 1.15), dt = t - tw;
      const punch = dt >= 0 ? Math.exp(-dt * 12) * Math.sin(dt * 34) * .07 : 0;
      const s = lerp(1.3, .62, e) * inK * (1 + punch), flip = fl > .55 ? Math.cos((fl - .55) / .45 * Math.PI / 2) : 1, j = jit(90 + QI, n, .8);
      at(540 + d.x + j.x, lerp(760, 330, e) + d.y + j.y, lerp(.03, 0, e) + j.r + Math.sin(stepT(n) * 3) * .006, Math.max(.001, s * flip), s,
        () => qCard(QI + 1, QWORD[QI], 'la valeur', { band: QCOL[QI], w: 440, h: 300, size: _qs }));
    } else {
      const hk = prog(t, tw + .34, tw + .5), sx = hk < 1 ? eOutBack(hk, 2) : 1;
      at(540 + d.x * .5, 330 + d.y * .5, Math.sin(t * .8 + QI) * .006, Math.max(.001, sx), 1, () => qHeader(QI, 1));
    }
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;
    if (!reg) { reg = true; addShake(T.comb + .36, 5); T.land.forEach((x, i) => addShake(x, 7 + i * 2)); addShake(T.plate, 7); addShake(T.taxe, 16); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n);
    tower(t, n, ts);
    if (t >= T.land[1]) creditTag(CREDIT.ships_cranes, TX + TW / 2, BASE + 42);
    brace(t, n);
    valuePlate(t, n);
    medallion(t, n);
    taxStamp(t, n);
    lightLeak(prog(t, T.land[1] - .05, T.land[1] + .5), 5);
    introHeader(t, n);
  }

  registerScene({ id: 'combien', z: 42, when: t => TL.in(t, CH, .4, .4), draw });
})();

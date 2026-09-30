'use strict';
// =============================================================================================
// 32_papiers — chapitre « papiers » (S5)
// « Son passeport ? Les papiers : facture, connaissement, déclaration. »
//  · début        : le carton de Junior (étiquette manuscrite) respire au centre ; il sautille sur « Son ».
//  · « passeport » : le livret vert JAILLIT du carton (ressort), le carton file vers le bas ; le livret s'ouvre (double page) ;
//                   page gauche = « photo d'identité » du carton ; page droite vide → un grand « ? » manuscrit.
//  · « papiers »  : bande « LES PAPIERS » (vert / jaune passeport) qui claque ; le « ? » s'efface.
//  · « facture » / « connaissement » / « déclaration » : trois feuilles tombent (atterrissage vu du dessus + écrasement),
//                   en cascade d'onglets (chaque titre reste lisible) ; valeurs manuscrites qui s'écrivent.
//                   « (le BL) » à côté du connaissement ; post-it « faite par un commissionnaire agréé » près de la déclaration.
//  · fin          : les 3 feuilles se plient et glissent DANS le passeport, le livret se ferme (onglets qui dépassent),
//                   étiquette + tampon vert « COMPLET » qui claque.
// La scène possède l'image de TL.ch('papiers').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'papiers', SEG = 'S5';
  const PW = 340, PH = 450, PX = 540, PY = 1010;                 // passport (closed centre)
  const SW = 380, SH = 460;                                       // sheets
  const SHEETS = [
    { kind: 'facture', x: 514, y: 592, r: -.05, from: [-220, -80], rows: ['Produit', 'Quantité', 'Vendeur'], values: ['Baskets', '100 paires', 'Usine, Chine'], slot: [-34, -58, -.12] },
    { kind: 'connaissement', x: 558, y: 672, r: .035, from: [220, -60], rows: ['Port de départ', "Port d'arrivée", 'Colis'], values: ['Chine', 'Douala', '12 cartons'], slot: [6, 4, .06] },
    { kind: 'declaration', x: 530, y: 752, r: -.02, from: [0, -160], rows: null, values: ['64 04', null, 'Chine', 'Import'], slot: [-14, 70, -.04] },
  ];
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = k => TL.wt(SEG, k), we = k => TL.we(SEG, k);
    const o = { c0: c.start, c1: c.end, son: w('son'), pass: w('passeport'), q: we('passeport'), papiers: w('papiers'),
      land: [w('facture') - .1, w('connaissement') - .1, w('declaration') - .1] };
    o.tF = Math.max(o.land[2] + .32, Math.min(o.land[2] + .5, o.c1 - .56));     // sheets fold into the passport
    o.tClose = o.tF + .1; o.tStamp = o.tF + .3;
    return o;
  }
  function land(t, t0, dur = .22, from = 1.4) {
    if (t < t0) return null;
    const k = (t - t0) / dur;
    if (k < 1) { const e = k * k; return { s: lerp(from, 1, e), e, sq: 0, lift: lerp(60, 10, e), a: clamp(k * 5) }; }
    const s = t - t0 - dur; return { s: 1, e: 1, sq: Math.exp(-s * 10) * Math.cos(s * 36) * .07, lift: 10, a: 1 };
  }
  const openK = t => eOutCubic(prog(t, T.pass + .28, T.pass + .6)) * (1 - eInOutCubic(prog(t, T.tClose, T.tClose + .16)));
  const passX = k => PX + PW / 2 * eInOutCubic(clamp(k));

  // ---------------------------------------------------------------------------- props
  /** left page of the open booklet (drawn from the hinge to the left, squeezed by sx): inner cover + ID page of the carton */
  function leftPage(sx) {
    at(-PW / 2, 0, 0, sx, 1, () => {
      withShadow(6, () => { ctx.fillStyle = '#0A4F3A'; rrect(-PW - 10, -PH / 2 - 8, PW + 10, PH + 16, 16); ctx.fill(); });
      ctx.fillStyle = '#F7F2E4'; rrect(-PW + 2, -PH / 2 + 2, PW - 6, PH - 4, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(14,107,78,.14)'; ctx.lineWidth = 2;                                   // guilloche
      for (let r = 0; r < 9; r++) { ctx.beginPath(); for (let x = -PW + 10; x <= -8; x += 10) { const y = -PH / 2 + 40 + r * 48 + Math.sin(x * .05 + r) * 8; x === -PW + 10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.fillStyle = '#E3D8BF'; rrect(-PW + 60, -PH / 2 + 42, 180, 150, 8); ctx.fill();          // ID photo of the carton
      ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; rrect(-PW + 60, -PH / 2 + 42, 180, 150, 8); ctx.stroke();
      at(-PW + 150, -PH / 2 + 118, -.06, 1, 1, () => carton(126, 92, { seed: 4, bev: 6 }));
      text('JUNIOR', -PW / 2, -PH / 2 + 262, { font: font(FF.hand, 48, 800), align: 'center', color: C.ink });
      ctx.strokeStyle = 'rgba(35,22,41,.2)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-PW + 40, -PH / 2 + 310 + i * 40); ctx.lineTo(-40, -PH / 2 + 310 + i * 40); ctx.stroke(); }
    });
  }
  function miniSheet(i, fold) {                                   // a sheet folded in half (fold 0..1), local centre
    const S = SHEETS[i];
    at(0, 0, 0, 1, lerp(1, .52, fold), () => {
      docSheet(S.kind, SW, SH, { rows: S.rows || undefined, values: S.values, lift: 6 });
      if (fold > 0) { ctx.fillStyle = `rgba(35,22,41,${.22 * fold})`; ctx.fillRect(-SW / 2, 0, SW, SH / 2); ctx.strokeStyle = `rgba(35,22,41,${.35 * fold})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-SW / 2, 0); ctx.lineTo(SW / 2, 0); ctx.stroke(); }
    });
  }
  /** passport: closed/open booklet at its current place; tucked sheets inside; tabs peeking when closed */
  function passport(t, n, k, done) {
    const open = eInOutCubic(clamp(k)), sx = Math.cos(open * Math.PI);
    if (done.some(Boolean) && sx > -.2) {                          // coloured tabs of the tucked papers (under the cover)
      [C.violetD, DC.blue, DC.green].forEach((col, i) => { if (!done[i]) return;
        at(PW / 2 - 6, -150 + i * 70, (i - 1) * .06, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = col; rrect(-30, -24, 64, 48, 8); ctx.fill(); }); }); });
    }
    goodsPassport(PW, PH, k, { inside: () => {
      const qw = prog(t, T.q - .02, T.q + .22), qs = 1 - eInCubic(prog(t, T.papiers, T.papiers + .22));
      if (qw > 0 && qs > 0) at(10, 30, .06 + Math.sin(stepT(n) * 4) * .03, qs, qs, () => handText('?', 0, 90, 260, { write: qw, color: C.violetD, pen: false }));
      for (let i = 0; i < 3; i++) { if (!done[i]) continue; const sl = SHEETS[i].slot; at(sl[0], sl[1], sl[2], .36, .36, () => miniSheet(i, 1)); }
    } });
    if (sx < 0) leftPage(-sx);
  }
  function postItNote(k) {
    const lines = ['faite par un', 'commissionnaire', 'agréé'], w = 340;
    let fs = 46; const mw = Math.max(...lines.map(l => measure(l, font(FF.hand, fs, 800)))); if (mw > w - 34) fs = fs * (w - 34) / mw;
    postIt(w, () => lines.forEach((l, i) => text(l, 0, -58 + i * (fs * 1.2) + (i === 2 ? 0 : 0), { font: font(FF.hand, fs, 800), align: 'center', color: i === 2 ? DC.green : C.ink })), { lift: 10 });
    handArrow([[w / 2 - 20, 60], [w / 2 + 20, 90], [w / 2 + 52, 96]], k, C.ink, 5);
  }
  function stickerStamp(sl) {
    const w = 360, h = 150, top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 71, 3, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 77, 3, 12);
    withShadow(8, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    stampText('COMPLET', 0, 4, font(FF.stencil, 86, 900), DC.green, { box: true, h: 118, boxW: 9, starve: .38, ls: 4 });
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                            // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.papiers, 8); T.land.forEach(x => addShake(x + .22, 4)); addShake(T.tStamp, 14); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 21, 5);

    // ------------------------------------------------ Junior's carton: breathes, hops on « Son », slides out on « passeport »
    const out = eInCubic(prog(ts, T.pass + .06, T.pass + .42));
    if (out < 1) {
      const hop = Math.exp(-Math.max(0, t - T.son) * 7) * Math.abs(Math.sin(Math.max(0, t - T.son) * 16)) * (t >= T.son ? 26 : 0), j = jit(41, n, .8);
      at(540 + dr.x + j.x, 1010 + dr.y - hop + out * 900 + j.y, -.03 + j.r + out * .3, 1 + .02 * Math.sin(ts * 4), 1 - .02 * Math.sin(ts * 4), () => juniorCarton(500, 370));
    }

    // ------------------------------------------------ the passport
    if (t >= T.pass - .04) {
      const pk = clamp(spring(t - T.pass + .04, 12, .5), 0, 1.2), k = openK(t);
      const done = [0, 1, 2].map(i => prog(ts, T.tF + (2 - i) * .035, T.tF + (2 - i) * .035 + .22) >= 1);
      const tS = T.tStamp, sl = t >= tS - .1 ? slam(t, tS, 1.25) : null, bump = sl ? (sl.s - 1) * .5 : 0;
      const big = 1 - eInOutCubic(prog(ts, T.land[0] - .22, T.land[0] + .12)), sc = lerp(1, 1.22, big);   // hero size until the papers arrive
      at(540 + (passX(k) - 540) * sc + dr.x * .6, lerp(1080, PY - 120 * big, clamp(pk)) + dr.y * .6, -.015 + Math.sin(t * 1.1) * .006, sc * lerp(.3, 1, pk) * (1 + bump), sc * lerp(.3, 1, pk) * (1 - bump * .5), () => passport(t, n, k, done));
    }

    // ------------------------------------------------ the three papers (cascade of tabs), then the fold into the passport
    for (let i = 0; i < 3; i++) {
      const S = SHEETS[i], L = land(ts, T.land[i], .22, 1.45); if (!L) continue;
      const t0 = T.tF + (2 - i) * .035, fk = prog(ts, t0, t0 + .22); if (fk >= 1) continue;
      const e = eInOutCubic(fk), px = passX(openK(t)), tx = px + S.slot[0] + dr.x * .6, ty = PY + S.slot[1] + dr.y * .6;
      const j = jit(50 + i, n, .7), ox = S.from[0] * (1 - L.e), oy = S.from[1] * (1 - L.e);
      const x = lerp(S.x + ox + j.x + dr.x, tx, e), y = lerp(S.y + oy + j.y + dr.y, ty, e), r = lerp(S.r + j.r + (1 - L.e) * (i - 1) * .3, S.slot[2], e);
      const s = L.s * lerp(1, .36, e), wr = prog(t, T.land[i] + .2, T.land[i] + .75);
      at(x, y, r, s * (1 + L.sq), s * (1 - L.sq), () => {
        ctx.globalAlpha *= L.a;
        if (fk > 0) miniSheet(i, e);
        else docSheet(S.kind, SW, SH, { rows: S.rows || undefined, values: S.values, write: wr, lift: L.lift });
      });
    }

    // ------------------------------------------------ notes: « (le BL) », post-it « transitaire »
    const bl = prog(t, T.land[1] + .3, T.land[1] + .7), fade = 1 - prog(t, T.tF, T.tF + .15);
    if (bl > 0 && fade > 0) { ctx.save(); ctx.globalAlpha *= fade; const j = jit(61, n, .6);
      at(846 + j.x, 486 + j.y, -.06, 1, 1, () => { handText('(le BL)', 0, 0, 56, { write: bl, color: DC.blue, pen: false });
        ctx.strokeStyle = DC.blue; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-86, 18); ctx.lineTo(-86 + 172 * clamp(bl * 1.4 - .4), 14); ctx.stroke(); });
      ctx.restore(); }
    const pt = T.land[2] + .24;
    if (t >= pt) { const L = land(ts, pt, .18, 1.15), j = jit(62, n, .6);
      at(186 + j.x + dr.x * .5, 690 + j.y, -.07 + j.r, L.s * (1 + L.sq), L.s * (1 - L.sq), () => { ctx.globalAlpha *= L.a; postItNote(prog(t, pt + .15, pt + .4)); }); }

    // ------------------------------------------------ headline
    if (t >= T.papiers - .1) { const sl = slam(t, T.papiers, 1.7), d2 = drift(t, 27, 3);
      at(540 + d2.x, 300 + d2.y, -.025, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('LES PAPIERS', { size: 80, fill: DC.green, color: DC.yellow, seed: 6 }); }); }

    // ------------------------------------------------ « COMPLET » : sticker + green stamp slammed on the closed booklet
    if (t >= T.tStamp - .1) { const sl = slam(t, T.tStamp, 1.9);
      at(PX + 20 + dr.x * .6, PY + 96 + dr.y * .6, -.12, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; stickerStamp(); });
      const ik = prog(t, T.tStamp, T.tStamp + .22);                                        // ink impact strokes
      if (ik > 0 && ik < 1) at(PX + 20, PY + 96, -.12, 1, 1, () => { ctx.save(); ctx.strokeStyle = DC.green; ctx.lineCap = 'round'; ctx.lineWidth = 8 * (1 - ik) + 1;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .3, r0 = 200 + 40 * ik, r1 = r0 + 50 * (1 - ik) + 10; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * .55); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * .55); ctx.stroke(); }
        ctx.restore(); }); }
  }

  registerScene({ id: 'papiers', z: 32, when: t => TL.in(t, CH, .4, .4), draw });
})();

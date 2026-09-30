'use strict';
// =============================================================================================
// 44_dou — chapitre « dou » (S9) « D'où ? Du pays de fabrication… pas du port de départ. »
//  · début          : la carte « 3 D'OÙ ? » au centre ; sur « D'où » elle s'envole et se RETOURNE en en-tête qHeader(2).
//  · « Du »         : deux pays en papier déchiré claquent sur la table (vert à gauche, sable à droite), frontière pointillée,
//                     une route (fil violet) se dessine ; l'usine est encore couchée à plat (pop-up replié).
//  · « pays »       : étiquettes « VIETNAM » / « CHINE » (exemple) qui claquent.
//  · « fabrication » : l'usine se DÉPLIE (pop-up), fumée en deux ; coche verte qui claque ; puce « FABRIQUÉ ICI » ;
//                     le carton saute de la porte, étiquette tissée « MADE IN VIETNAM » cousue dessus.
//  · fin de « fabrication » : bande « ORIGINE = LÀ OÙ C'EST FABRIQUÉ » (bas).
//  · « pas »        : tirage photo d'un port (grue, duotone nuit) tombe côté CHINE + fuite de lumière ; le carton roule jusqu'au port.
//  · « port »       : puce « PARTI D'ICI » ; « départ » : grosse croix rouge qui claque sur le port, la puce est barrée.
// La scène possède l'image de TL.ch('dou').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'dou', SEG = 'S9', QI = 2;
  const LP = { x0: 40, x1: 528, y0: 470, y1: 1125, fill: DC.greenL, ink: DC.green, seed: 3 };
  const RP = { x0: 552, x1: 1040, y0: 470, y1: 1125, fill: '#F7E3C0', ink: '#C77A12', seed: 9 };
  const FAC = { x: 318, g: 805 };                                          // factory centre x, ground line y
  const PORT = { x: 795, y: 712, w: 270, h: 196 };
  const RY = 1044, CW = 262, CHh = 172;                                     // route y, carton size
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = k => TL.wt(SEG, k), we = k => TL.we(SEG, k);
    const o = { c0: c.start, c1: c.end };
    o.dou = Math.max(o.c0 + .05, w('dou'));
    o.du = Math.max(o.dou + .15, w('du'));
    o.pays = Math.max(o.du + .2, w('pays'));
    o.fab = Math.max(o.pays + .1, w('fabrication')); o.fabE = Math.max(o.fab + .2, we('fabrication'));
    o.pas = Math.max(o.fabE, w('pas'));
    o.port = Math.max(o.pas + .15, w('port'));
    o.dep = Math.max(o.port + .12, Math.min(w('depart'), o.c1 - .4));
    o.strip = Math.min(o.fabE + .02, o.pas);
    o.move0 = o.fab + .45; o.move1 = Math.max(o.move0 + .3, o.port + .05);
    return o;
  }

  // ---------------------------------------------------------------------------- paper countries
  const _pp = {};
  function patchPts(P) {
    if (_pp[P.seed]) return _pp[P.seed];
    return (_pp[P.seed] = [...tornLine(P.x0, P.y0, P.x1, P.y0, P.seed, 5, 14), ...tornLine(P.x1, P.y0, P.x1, P.y1, P.seed + 1, 5, 14),
      ...tornLine(P.x1, P.y1, P.x0, P.y1, P.seed + 2, 5, 14), ...tornLine(P.x0, P.y1, P.x0, P.y0, P.seed + 3, 5, 14)]);
  }
  function patch(P, t0, t, n, left) {
    if (t < t0 - .1) return;
    const sl = slam(t, t0, 1.12), cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2, d = drift(t, P.seed, 2);
    at(cx + d.x, cy + d.y, (left ? -.008 : .01), sl.s, sl.s, () => { ctx.translate(-cx, -cy); ctx.globalAlpha *= sl.a;
      withShadow(6, () => { ctx.fillStyle = P.fill; ctx.beginPath(); patchPts(P).forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill(); });
      ctx.save(); ctx.beginPath(); patchPts(P).forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.clip();
      ctx.strokeStyle = left ? 'rgba(14,107,78,.22)' : 'rgba(199,122,18,.25)'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let x = P.x0; x <= P.x1; x += 12) { const y = P.y0 + 150 + i * 92 + Math.sin(x * .018 + i * 1.7 + P.seed) * 16; x === P.x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      if (left) { ctx.strokeStyle = 'rgba(14,107,78,.45)'; ctx.lineWidth = 3; ctx.lineCap = 'round';                // little grass tufts
        for (let i = 0; i < 16; i++) { const x = P.x0 + 30 + rnd(i * 3.1) * (P.x1 - P.x0 - 60), y = P.y0 + 330 + rnd(i * 5.9) * 260; if (Math.abs(x - FAC.x) < 120 && y < 860) continue;
          ctx.beginPath(); ctx.moveTo(x - 7, y - 10); ctx.lineTo(x, y); ctx.lineTo(x + 7, y - 12); ctx.stroke(); } }
      ctx.restore();
    });
  }
  function countryLabel(txt, x, y, col, t0, t, n, seed) {
    if (t < t0 - .1) return;
    const sl = slam(t, t0, 1.6), f = font(FF.stencil, 58, 900), wd = measure(txt, f, 3) + 56, j = jit(seed, n, .6);
    at(x + j.x, y + j.y, (seed % 2 ? -.04 : .03) + j.r, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a;
      paperNote(0, 0, wd, 84, 0, () => text(txt, 0, 21, { font: f, align: 'center', color: col, ls: 3 }), { seed, h: 8, tape: true }); });
  }

  // ---------------------------------------------------------------------------- the factory (pop-up) and the port (photo print)
  function factory(t, n) {
    if (t < T.pays - .04) return;
    const up = clamp(spring(t - T.pays + .04, 13, .42), 0, 1.15);                                     // pop-up book: unfolds from the ground line
    const sy = Math.max(.02, up), d = drift(t, 3, 2), j = jit(21, n, .6);
    at(FAC.x + d.x + j.x, FAC.g + d.y, j.r * .5, 1 + (1 - clamp(up)) * .04, sy, () => {
      ctx.translate(0, -100);
      withShadow(4 + 14 * clamp(up), () => iconFactory(200, up < .4 ? '#6A5A72' : '#3A2F42'));
      ctx.fillStyle = C.amber; rrect(62, 56, 30, 44, 5); ctx.fill(); ctx.fillStyle = 'rgba(35,22,41,.35)'; ctx.fillRect(62, 56, 30, 6);   // door
      ctx.fillStyle = 'rgba(243,167,69,.85)'; for (let i = 0; i < 3; i++) ctx.fillRect(-80 + i * 56, 44, 24, 24);   // lit windows
    });
    if (up > .5) {                                                                                    // chimney smoke on twos
      const ts = stepT(n);
      for (let i = 0; i < 4; i++) { const ph = (ts * .8 + i * .25) % 1, x = FAC.x + 40 + d.x + ph * 34 + Math.sin(ph * 6 + i) * 6, y = FAC.g - 190 - ph * 120, r = 12 + ph * 26;
        ctx.save(); ctx.globalAlpha *= (1 - ph) * .9 * clamp((up - .5) * 2); ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = 'rgba(58,47,66,.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
    }
  }
  function port(t, n) {
    if (t < T.pas - .08) return;
    const D = drop(stepT(n), T.pas - .08, 260, .2), d = drift(t, 17, 3), j = jit(23, n, .6), zoom = 1.02 + .05 * prog(t, T.pas, T.c1);
    at(PORT.x + d.x + j.x, PORT.y + D.y * .3 + d.y + j.y, .035 + j.r + (D.landed ? 0 : .12), (1 + (D.landed ? 0 : .25 * (1 + D.y / 260))) * D.sx, (1 + (D.landed ? 0 : .25 * (1 + D.y / 260))) * D.sy, () => {
      photoPrint('crane_silhouette', PORT.w, PORT.h, { border: 12, tape: false, fx_kind: 'duo', cols: DUO.night, zoom, fx: .62, fy: .45, lift: D.landed ? 12 : 40 });
    });
    if (D.landed) creditTag(CREDIT.crane_silhouette, PORT.x + PORT.w / 2 + 12 + d.x, PORT.y + PORT.h / 2 + 46 + d.y);
  }

  // ---------------------------------------------------------------------------- chips, check & cross
  function chipAt(t0, x, y, label, o, t, n, seed) {
    if (t < t0) return; const k = pop(t, t0, 16, .45), j = jit(seed, n, .6);
    const f = font(FF.body, 44, 800), w = measure(label, f) + (o.check ? 104 : 64), xx = Math.min(x, 948 - w / 2);
    chip(xx + j.x, y + j.y, label, Object.assign({ size: 44, s: k, rot: (seed % 2 ? -.03 : .025) + j.r }, o));
    return { x: xx, w };
  }
  function marks(t, n) {
    if (t >= T.fab + .12) { const sl = slam(t, T.fab + .2, 2), j = jit(41, n, .6);
      at(FAC.x + 128 + j.x, FAC.g - 120 + j.y, -.12, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; withShadow(8, () => iconCheck(124)); }); }
    const c1 = chipAt(T.fab + .28, FAC.x - 10, 890, 'FABRIQUÉ ICI', { check: true, checkFill: '#1FA86A', fill: DC.green, color: '#FFFDF7' }, t, n, 43);
    const c2 = chipAt(T.port - .02, PORT.x, 904, "PARTI D'ICI", { fill: C.ink, color: C.cream }, t, n, 44);
    if (c2 && t >= T.dep + .06) { const p = eOutCubic(prog(t, T.dep + .06, T.dep + .24));                // struck through
      ctx.save(); ctx.strokeStyle = DC.red; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c2.x - c2.w / 2 + 14, 912); ctx.lineTo(c2.x - c2.w / 2 + 14 + (c2.w - 28) * p, 894 - 6 * p); ctx.stroke(); ctx.restore(); }
    if (t >= T.dep - .1) { const sl = slam(t, T.dep, 2.1), j = jit(47, n, .6);
      at(PORT.x + 108 + j.x, 640 + j.y, .1, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; withShadow(8, () => iconCross(132)); }); }
  }

  // ---------------------------------------------------------------------------- the route and the travelling carton
  let _route = null;
  function routePts() { return _route || (_route = curve([[80, RY + 8], [300, RY], [540, RY + 10], [795, RY - 4], [1010, RY + 6]], 16)); }
  function route(t, n) {
    const p = eOutCubic(prog(t, T.du + .12, T.du + .5)); if (p <= 0) return;
    const head = thread(routePts(), p, n, { w: 8, color: C.violetD });
    if (p >= .98 && head) { ctx.save(); ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.moveTo(head[0] + 22, head[1]); ctx.lineTo(head[0] - 8, head[1] - 18); ctx.lineTo(head[0] - 8, head[1] + 18); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }
  function carton_(t, n) {
    const t0 = T.fab + .12; if (t < t0) return;
    const ts = stepT(n), jk = prog(ts, t0, t0 + .3), mk = eInOutCubic(prog(ts, T.move0, T.move1));
    const d = drift(t, 25, 3), j = jit(26, n, .7);
    let x = lerp(lerp(FAC.x + 77, FAC.x, jk), PORT.x, mk), y = lerp(FAC.g - 20, RY, jk) - Math.sin(jk * Math.PI) * 120, s = lerp(.3, 1, jk), sx = s, sy = s, r = -.04;
    if (jk >= 1) { const L = t - t0 - .3, sq = Math.exp(-L * 10) * Math.cos(L * 34) * .12; sx = 1 + sq; sy = 1 - sq; }
    if (mk > 0 && mk < 1) { const b = Math.abs(Math.sin(mk * Math.PI * 4)); y -= b * 16; r += Math.sin(mk * Math.PI * 4) * .05; sx *= 1 + .04 * (1 - b); sy *= 1 - .04 * (1 - b); }
    if (t > T.move1) { const L = t - T.move1, sq = Math.exp(-L * 10) * Math.cos(L * 34) * .1; sx *= 1 + sq; sy *= 1 - sq; }
    if (t > T.dep) r += Math.sin((t - T.dep) * 30) * .04 * Math.exp(-(t - T.dep) * 5);                  // « non, pas d'ici »
    at(x + d.x + j.x, y + d.y + j.y + CHh / 2, r + j.r, sx, sy, () => { ctx.translate(0, -CHh / 2);
      withShadow(10 + 30 * Math.sin(jk * Math.PI), () => carton(CW, CHh, { seed: 12 }));
      const lk = prog(t, T.fab + .3, T.fab + .42); if (lk <= 0) return;
      const sl = slam(t, T.fab + .42, 1.5);
      at(0, 4, -.03, sl.s * .98, sl.s * .98, () => { ctx.globalAlpha *= sl.a; madeIn('VIETNAM', 214, { col: DC.green });
        const st = prog(t, T.fab + .45, T.fab + .75);                                                  // sewn on: stitches cross the edges, left → right
        if (st > 0) { ctx.strokeStyle = DC.green; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
          for (let x = -96; x <= 96; x += 24) { if ((x + 96) / 192 > st) break; for (const yy of [-54, 54]) { ctx.beginPath(); ctx.moveTo(x - 3, yy - 7); ctx.lineTo(x + 3, yy + 7); ctx.stroke(); } } } });
    });
  }

  // ---------------------------------------------------------------------------- border + headline
  function border(t) {
    const p = prog(t, T.du + .08, T.du + .4); if (p <= 0) return;
    ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.lineWidth = 5; ctx.setLineDash([18, 12]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(540, 470); ctx.lineTo(540 + Math.sin(3) * 4, 470 + 655 * eOutCubic(p)); ctx.stroke(); ctx.restore();
  }
  let _ss = 0;
  function headline(t, n) {
    if (t < T.strip - .1) return;
    if (!_ss) { const s = "ORIGINE = LÀ OÙ C'EST FABRIQUÉ"; _ss = Math.max(54, Math.min(58, 58 * 780 / measure(s, font(FF.stencil, 58, 900), 3))); }
    const sl = slam(t, T.strip, 1.6), d = drift(t, 49, 3);
    at(540 + d.x, 1192 + d.y, -.015, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip("ORIGINE = LÀ OÙ C'EST FABRIQUÉ", { size: _ss, fill: DC.green, color: '#FFFDF7', seed: 5 }); });
  }

  // ---------------------------------------------------------------------------- big question card → flips into the header
  let _qs = 0;
  function introHeader(t, n) {
    const tw = T.dou, fl = prog(t, tw + .04, tw + .34), e = eInOutCubic(fl), d = drift(t, 40 + QI, 4);
    if (fl < 1) {
      if (!_qs) _qs = Math.min(120, 120 * 380 / measure(QWORD[QI], font(FF.stencil, 120, 900), 3));
      const inK = clamp(spring(t - T.c0 + .18, 13, .5), 0, 1.15), dt = t - tw;
      const punch = dt >= 0 ? Math.exp(-dt * 12) * Math.sin(dt * 34) * .07 : 0;
      const s = lerp(1.3, .62, e) * inK * (1 + punch), flip = fl > .55 ? Math.cos((fl - .55) / .45 * Math.PI / 2) : 1, j = jit(90 + QI, n, .8);
      at(540 + d.x + j.x, lerp(780, 330, e) + d.y + j.y, lerp(-.03, 0, e) + j.r + Math.sin(stepT(n) * 3) * .006, Math.max(.001, s * flip), s,
        () => qCard(QI + 1, QWORD[QI], "l'origine", { band: QCOL[QI], w: 440, h: 300, size: _qs }));
    } else {
      const hk = prog(t, tw + .34, tw + .5), sx = hk < 1 ? eOutBack(hk, 2) : 1;
      at(540 + d.x * .5, 330 + d.y * .5, Math.sin(t * .8 + QI) * .006, Math.max(.001, sx), 1, () => qHeader(QI, 1));
    }
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;
    if (!reg) { reg = true; addShake(T.dou + .36, 5); addShake(T.du + .02, 6); addShake(T.fab + .2, 8); addShake(T.pas + .12, 6); addShake(T.dep, 14); addShake(T.strip, 5); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    patch(LP, T.du - .02, t, n, true);
    patch(RP, T.du + .1, t, n, false);
    border(t);
    route(t, n);
    countryLabel('VIETNAM', 186, 534, DC.green, T.pays, t, n, 7);
    countryLabel('CHINE', 668, 534, '#B06A0C', T.pays + .1, t, n, 8);
    if (t >= T.du - .02) factory(t, n);
    port(t, n);
    marks(t, n);
    carton_(t, n);
    headline(t, n);
    lightLeak(prog(t, T.pas - .05, T.pas + .5), 11);
    introHeader(t, n);
  }

  registerScene({ id: 'dou', z: 44, when: t => TL.in(t, CH, .4, .4), draw });
})();

'use strict';
// =============================================================================================
// 70_partie2 — chapitre « partie2 » (S15)
// « Partie 2 : les taxes une par une, la conformité, la simulation… et choisir votre transitaire. »
//  · début        : une chemise cartonnée (manille) fermée sur la table, étiquette « DOUANE · la suite… ».
//  · « Partie »   : la bande « PARTIE » claque en haut ; la couverture de la chemise s'ouvre vers la gauche (en deux)
//                   et découvre une feuille « sommaire » tenue par un trombone.
//  · « 2 »        : pastille orange « 2 » qui claque (choc).
//  · « taxes » / « conformité » / « simulation » / « choisir » : un intercalaire coloré glisse hors de la chemise
//                   par mot (violet / ambre foncé / orange / vert), icône dans une pastille blanche ;
//                   « une · par · une » : trois petits blocs s'empilent un par un dans la pastille des taxes.
//  · pause après « simulation » : tampon rond orange « BIENTÔT » (choc).
//  · « transitaire » : pastille « ABONNEZ-VOUS » + cloche qui sonne, sous la chemise.
// La scène possède l'image de TL.ch('partie2').start à .end (coupe franche sous les volets).
// =============================================================================================
(() => {
  const CH = 'partie2', SEG = 'S15';
  const F = { x: 540, y: 830, w: 860, h: 690 };                  // folder back panel (centre)
  const ROWS = [
    { label: 'Les taxes, une par une', col: C.violetD },
    { label: 'La conformité', col: '#C77A12' },
    { label: 'La simulation', col: C.orange },
    { label: 'Choisir son transitaire', col: DC.green },
  ];
  const RY = [590, 744, 898, 1052], RX = [-6, 8, -4, 6], RR = [-.012, .01, -.008, .012], RW = 800, RH = 124;
  const TITLE = { x: 322, y: 340 }, TWO = { x: 612, y: 334 }, STAMP = { x: 830, y: 352 }, ABO = { x: 540, y: 1176 };
  let T = null, reg = false;

  /** first word equal to `str` (normalised) that starts after `after` */
  function exactAfter(str, after, fb) { const k = nrm(str); for (const w of TL.seg(SEG).words) if (w.s > after && nrm(w.w) === k) return w.s; return fb; }
  function times() {
    const c = TL.ch(CH), w = (k, fb) => TL.wt(SEG, k, fb);
    const o = { c0: c.start, c1: c.end };
    o.partie = w('partie', c.start + .4);
    o.deux = exactAfter('2', o.partie - .01, o.partie + .35);
    o.rows = [w('taxes', o.deux + .25), w('conformite'), w('simulation'), w('choisir')];
    for (let i = 1; i < 4; i++) o.rows[i] = Math.max(o.rows[i], o.rows[i - 1] + .3);
    const u0 = exactAfter('une', o.rows[0] - .01, o.rows[0] + .25), p = exactAfter('par', u0, u0 + .18), u1 = exactAfter('une', p, p + .18);
    o.une = [Math.max(u0, o.rows[0] + .12), Math.max(p, u0 + .1), Math.max(u1, p + .1)];
    o.bientot = Math.min(TL.we(SEG, 'simulation', o.rows[2] + .35) + .04, o.rows[3] - .12);
    o.trans = Math.max(w('transitaire', o.rows[3] + .5), o.rows[3] + .25);
    o.flip = o.partie - .03;
    return o;
  }

  // ---------------------------------------------------------------------------- icons (inside a white badge, r ≈ 48)
  const ICON = [
    (t, n) => {                                                  // three blocks stacking on « une · par · une »
      const cols = [C.violet, C.amber, C.orange];
      for (let b = 0; b < 3; b++) {
        const y0 = 22 - b * 19;
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(123,34,214,.35)'; ctx.lineWidth = 2.5; rrect(-25, y0 - 8, 50, 16, 4); ctx.stroke(); ctx.restore();
        const tb = T.une[b] - .05; if (t < tb) continue;
        const dp = drop(t, tb, 46, .1);
        at((b - 1) * 2, y0 + dp.y, (b - 1) * .05, dp.sx, dp.sy, () => { ctx.fillStyle = cols[b]; rrect(-25, -8, 50, 16, 4); ctx.fill(); });
      }
    },
    (t, n) => {                                                  // document + check (conformité)
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#C77A12'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-20, -27); ctx.lineTo(8, -27); ctx.lineTo(20, -15); ctx.lineTo(20, 27); ctx.lineTo(-20, 27); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-12, -12 + i * 11); ctx.lineTo(10, -12 + i * 11); ctx.stroke(); }
      const k = clamp(spring(t - T.rows[1] - .2, 16, .45), 0, 1.25);
      at(16, 18, 0, k, k, () => iconCheck(30, '#1FA86A'));
    },
    (t, n) => {                                                  // mini calculator, keys blink on twos (simulation)
      ctx.fillStyle = C.orange; rrect(-22, -29, 44, 58, 8); ctx.fill();
      ctx.fillStyle = '#FFF4EC'; rrect(-16, -23, 32, 14, 3); ctx.fill();
      const lit = Math.floor(n / 4) % 6;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const i = r * 3 + c; ctx.fillStyle = i === lit && t > T.rows[2] ? C.ink : '#FFF4EC'; ctx.fillRect(-15 + c * 11, -2 + r * 12, 8, 8); }
      ctx.fillStyle = C.orange; ctx.fillRect(-12, -20, 2 + (Math.floor(n / 3) % 5) * 5, 7);
    },
    (t, n) => {                                                  // the customs broker: bust with a cap + briefcase
      const g = DC.green;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-4, -12, 13, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-4, -22, 15, 8, 0, Math.PI, 0); ctx.fill(); rrect(-6, -26, 26, 6, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-28, 26); ctx.quadraticCurveTo(-28, 4, -4, 4); ctx.quadraticCurveTo(20, 4, 20, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.amber; rrect(10, 8, 24, 18, 3); ctx.fill(); ctx.strokeStyle = C.amber; ctx.lineWidth = 3; ctx.strokeRect(17, 4, 10, 6);
    },
  ];

  // ---------------------------------------------------------------------------- paper props
  function rowCard(i, t, n, lift) {
    const R = ROWS[i];
    withShadow(lift, () => { ctx.fillStyle = R.col; rrect(-RW / 2, -RH / 2, RW, RH, 24); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.13)'; rrect(-RW / 2 + 12, -RH / 2 + 8, RW - 24, 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.10)'; rrect(-RW / 2 + 12, RH / 2 - 14, RW - 24, 6, 3); ctx.fill();
    const bx = -RW / 2 + 74;
    ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(bx, 0, 48, 0, 7); ctx.fill();
    const ip = clamp(spring(t - T.rows[i] - .06, 16, .45), 0, 1.3), wob = Math.sin(t * 3 + i) * .05;
    at(bx, 0, wob, ip, ip, () => ICON[i](t, n));
    const f0 = font(FF.body, 58, 800), mw = RW - 150 - 40, fs = Math.min(58, 58 * mw / measure(R.label, f0));
    text(R.label, -RW / 2 + 150, fs * .36, { font: font(FF.body, fs, 800), color: '#fff' });
    ctx.fillStyle = C.tape; at(RW / 2 - 36, -RH / 2 + 2, .45, 1, 1, () => ctx.fillRect(-42, -14, 84, 28));
  }
  function folderBack() {
    const { w, h } = F;
    withShadow(12, () => { ctx.fillStyle = '#D9B271'; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill(); rrect(-w / 2 + 30, -h / 2 - 50, 300, 80, 16); ctx.fill(); });
    ctx.save(); ctx.globalAlpha = .22; ctx.fillStyle = TEX.kraft; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill(); rrect(-w / 2 + 30, -h / 2 - 50, 300, 80, 16); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,253,247,.55)'; rrect(-w / 2 + 70, -h / 2 - 34, 220, 18, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,30,.28)'; ctx.lineWidth = 3; rrect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 14); ctx.stroke();
    ctx.fillStyle = 'rgba(90,60,25,.18)'; ctx.fillRect(-w / 2, -h / 2 + 12, 14, h - 24);                     // spine crease
  }
  function sheet(t) {                                            // the « sommaire » sheet inside, with a paperclip
    const w = 820, h = 612;
    at(8, 6, -.009, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = '#F4EDDC'; ctx.fillRect(-w / 2 + 10, -h / 2 + 8, w, h); }); });
    withShadow(6, () => { ctx.fillStyle = '#FBF6EC'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.strokeStyle = 'rgba(29,69,119,.10)'; ctx.lineWidth = 2; for (let y = -h / 2 + 48; y < h / 2; y += 37) { ctx.beginPath(); ctx.moveTo(-w / 2 + 20, y); ctx.lineTo(w / 2 - 20, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,16,46,.22)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 64, -h / 2); ctx.lineTo(-w / 2 + 64, h / 2); ctx.stroke();
    at(-w / 2 + 120, -h / 2 + 4, .05, 1, 1, () => {                 // paperclip
      ctx.strokeStyle = '#8C939B'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(-10, 40); ctx.lineTo(-10, -30); ctx.arc(2, -30, 12, Math.PI, 0); ctx.lineTo(14, 52); ctx.arc(0, 52, 14, 0, Math.PI); ctx.lineTo(-14, -18); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 30); ctx.lineTo(-12, -26); ctx.stroke();
    });
  }
  /** the folder cover, hinged on the left spine; k 0 closed → 1 open flat on the table (off to the left) */
  function cover(k, ts) {
    const { x, y, w, h } = F, sx = Math.cos(k * Math.PI), lift = Math.sin(k * Math.PI);
    at(x - w / 2, y, 0, sx, 1 + .05 * lift, () => {
      ctx.translate(w / 2, 0);
      withShadow(10 + 60 * lift, () => { ctx.fillStyle = sx >= 0 ? '#E9C98E' : '#F0D6A4'; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill(); });
      ctx.save(); ctx.globalAlpha = .2; ctx.fillStyle = TEX.kraft; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill(); ctx.restore();
      if (sx >= 0) {
        at(0, -40, -.03, 1, 1, () => {
          withShadow(4, () => { ctx.fillStyle = '#FFFDF7'; rrect(-250, -110, 500, 220, 14); ctx.fill(); });
          ctx.strokeStyle = DC.green; ctx.lineWidth = 5; rrect(-236, -96, 472, 192, 10); ctx.stroke();
          text('DOUANE', 0, 6, { font: font(FF.stencil, 110, 900), align: 'center', color: DC.green, ls: 6 });
          text('la suite…', 0, 78, { font: font(FF.hand, 52, 800), align: 'center', color: C.inkSoft });
        });
        at(180, 200, .2, 1, 1, () => juniorCarton(170, 120, { tape: false }));
      }
      ctx.fillStyle = `rgba(35,22,41,${.28 * (1 - Math.abs(sx))})`; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill();   // turning away from the light
    });
  }
  function bigTwo(t) {
    withShadow(16, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, 0, 86, 0, 7); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,253,247,.75)'; ctx.lineWidth = 5; ctx.setLineDash([12, 9]); ctx.beginPath(); ctx.arc(0, 0, 70, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    text('2', 0, 52, { font: font(FF.brand, 150, 900), align: 'center', color: '#FFFDF7' });
  }
  function aboPill(t, ring) {
    const f = font(FF.body, 52, 800), tw = measure('ABONNEZ-VOUS', f, 1), w = tw + 170, h = 104;
    withShadow(12, () => { ctx.fillStyle = C.ink; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); });
    ctx.strokeStyle = C.violet; ctx.lineWidth = 4; rrect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, h / 2 - 7); ctx.stroke();
    const bx = -w / 2 + 58;
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(bx, 0, 36, 0, 7); ctx.fill();
    at(bx, -2, Math.sin(ring * 30) * .45 * Math.max(0, 1 - ring), 1, 1, () => {       // bell
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-17, 12); ctx.quadraticCurveTo(-15, -18, 0, -19); ctx.quadraticCurveTo(15, -18, 17, 12); ctx.closePath(); ctx.fill();
      rrect(-21, 10, 42, 6, 3); ctx.fill(); ctx.beginPath(); ctx.arc(0, 20, 5, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, -21, 4, 0, 7); ctx.fill();
    });
    if (ring > 0 && ring < 1) { ctx.save(); ctx.strokeStyle = C.amber; ctx.lineCap = 'round'; ctx.lineWidth = 5 * (1 - ring) + 1;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(bx, -2, 50 + ring * 16, s < 0 ? Math.PI * 1.1 : -Math.PI * .35, s < 0 ? Math.PI * 1.35 : -Math.PI * .1); ctx.stroke(); }
      ctx.restore(); }
    text('ABONNEZ-VOUS', -w / 2 + 112, 19, { font: f, color: C.cream, ls: 1 });
  }
  function decor(t) {
    const d = drift(t, 77, 3);
    at(1060 + d.x * .6, 1228 + d.y * .6, 0, 1, 1, () => {        // roll of packing tape, half off-frame
      withShadow(10, () => { ctx.fillStyle = 'rgba(236,160,60,.95)'; ctx.beginPath(); ctx.arc(0, 0, 100, 0, 7); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(0, 0, 88, 0, 7); ctx.fill();
      ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(0, 0, 58, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(0, 0, 45, 0, 7); ctx.fill();
    });
    marker(1004 + d.x, 470 + d.y, 2.2, C.violetD);
    ctx.save(); ctx.fillStyle = 'rgba(251,246,236,.9)';
    for (const [x, y, r, s] of [[980, 1300, .5, 30], [70, 1270, -.3, 24], [1020, 660, 1.1, 20]]) at(x + d.x, y + d.y, r, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-s, -s * .4); ctx.lineTo(s, -s * .7); ctx.lineTo(s * .6, s * .6); ctx.lineTo(-s * .8, s * .5); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                            // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.deux, 10); addShake(T.bientot, 13); T.rows.forEach(x => addShake(x + .2, 4)); addShake(T.trans, 5); }
    paperTable(n);
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    const ts = stepT(n), dr = drift(t, 70, 5);
    const push = 1 + .03 * eInOutCubic(prog(t, T.c0, T.c1));      // slow push-in over the chapter
    ctx.translate(540, 820); ctx.scale(push, push); ctx.rotate(dr.r); ctx.translate(-540, -820);

    decor(t);

    // ------------------------------------------------ the folder: back panel, sheet, dividers, cover
    const kc = eInOutCubic(prog(ts, T.flip, T.flip + .36));
    at(F.x + dr.x, F.y + dr.y, -.006, 1, 1, () => { folderBack(); if (kc > .3) at(0, -8, 0, 1, 1, () => sheet(t)); });
    for (let i = 0; i < 4; i++) {
      const t0 = T.rows[i] - .05; if (t < t0 || kc < .5) continue;
      const k = prog(ts, t0, t0 + .3), e = eOutBack(k, 1.3);
      const j = jit(700 + i, n, .7), d = drift(t, 71 + i, 2.5);
      const land = t - (t0 + .3), sq = land > 0 ? Math.exp(-land * 12) * Math.sin(land * 38) * .05 : 0;
      const breathe = 1 + .006 * Math.sin(t * 2.6 + i * 1.7);
      at(540 + RX[i] + (1 - e) * 600 + j.x + d.x + dr.x * 1.15, RY[i] + j.y + d.y + dr.y * 1.15 - 16 * Math.sin(Math.PI * k), RR[i] + (1 - e) * .18 + j.r,
        (1 + sq) * breathe, (1 - sq) * breathe, () => rowCard(i, t, n, lerp(36, 8, clamp(e))));
    }
    at(dr.x, dr.y, 0, 1, 1, () => cover(kc, ts));
    const gl = env(t, T.flip + .12, T.flip + 1, .15, .55);             // warm glow out of the opened folder
    if (gl > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(560, 800, 40, 560, 800, 640);
      g.addColorStop(0, `rgba(255,214,140,${.13 * gl})`); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.fillRect(-80, 100, W + 160, 1500); ctx.restore(); }

    // ------------------------------------------------ « PARTIE » strip + the « 2 » disc + « BIENTÔT » stamp (top layer, stronger parallax)
    const px = dr.x * 1.4, py = dr.y * 1.4;
    const s1 = slam(t, T.partie, 1.7);
    if (s1.a > 0) { const j = jit(711, n, .8); at(TITLE.x + px + j.x, TITLE.y + py + j.y, -.035 + j.r, s1.s, s1.s, () => { ctx.globalAlpha *= s1.a; strip('PARTIE', { size: 124, seed: 7, lift: 14 }); }); }
    const s2 = slam(t, T.deux, 2.4);
    if (s2.a > 0) { const j = jit(712, n, .8), sp = t > T.deux ? Math.exp(-(t - T.deux) * 6) * Math.sin((t - T.deux) * 22) * .2 : .6;
      at(TWO.x + px + j.x, TWO.y + py + j.y, .08 + sp + j.r, s2.s * (1 + .02 * Math.sin(t * 4)), s2.s * (1 + .02 * Math.sin(t * 4)), () => { ctx.globalAlpha *= s2.a; bigTwo(t); }); }
    const s3 = slam(t, T.bientot, 2.2);
    if (s3.a > 0) { const j = jit(713, n, .5);
      at(STAMP.x + px + j.x, STAMP.y + py + j.y, 0, s3.s, s3.s, () => roundStamp('PARTIE 2 · PARTIE 2 · ', 'BIENTÔT', 132, C.orange, { rot: -.16, alpha: s3.a })); }

    // ------------------------------------------------ « ABONNEZ-VOUS » pill + bell (on « transitaire »)
    if (t >= T.trans - .04) {
      const k = clamp(spring(t - T.trans + .04, 14, .42), 0, 1.25), ring = prog(t, T.trans + .08, T.trans + .9), j = jit(714, n, .6);
      const pulse = 1 + .025 * Math.sin((t - T.trans) * 9) * Math.exp(-(t - T.trans) * 1.5);
      at(ABO.x + dr.x * 1.2 + j.x, ABO.y + dr.y * 1.2 + j.y + (1 - clamp(k)) * 90, -.02 + j.r, k * pulse, k * pulse, () => aboPill(t, ring));
    }
  }

  registerScene({ id: 'partie2', z: 40, when: t => TL.in(t, CH, .4, .4), draw });
})();

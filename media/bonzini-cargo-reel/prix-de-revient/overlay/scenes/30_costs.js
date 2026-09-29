'use strict';
// S5–S9 « les coûts » — one vignette per cost in the band y 880–1240, under the note spine (the spine cuts the note,
// fills the envelopes and runs the calculator; here we only SHOW what the slice is). z 25: the spine's refrain strip
// (y≈1150) lays over this band when it shows. Every amount is the fictional example (EXEMPLE FICTIF stamp is the spine's).
(() => {
  const Y0 = 878, Y1 = 1246;
  let T = null;
  const w = (s, k, nth = 0) => TL.wt(s, k, null, nth);
  const pop = (t, t0, f = 14, z = .42) => t < t0 ? 0 : spring(t - t0, f, z);
  function times() {
    const S = id => TL.seg(id), CH = id => TL.ch(id);
    return {
      taux: { a: w('S5', 'taux') - .3, b: S('S6').start - .5, taux: w('S5', 'taux'), taux2: w('S5', 'taux', 1), google: w('S5', 'google'), mais: w('S5', 'mais'),
        paie: w('S5', 'paie'), taux3: w('S5', 'taux', 2), applique: w('S5', 'applique'), frais: w('S5', 'frais'), compris: w('S5', 'compris'), exemple: w('S5', 'exemple'),
        n150: w('S5', '150'), tchac: w('S5', 'tchac') },
      camion: { a: S('S6').start - .45, b: S('S7').start - .7, camion: w('S6', 'camion'), usine: w('S6', 'usine'), guangzhou: w('S6', 'guangzhou'), n200: w('S6', '200'), tchac: w('S6', 'tchac') },
      bateau: { a: S('S7').start - .6, b: CH('douane').start + .2, bateau: w('S7', 'bateau'), n800: w('S7', '800'), maritime: w('S7', 'maritime'), metre: w('S7', 'metre'),
        cube: w('S7', 'cube'), air: w('S7', 'air'), boites: w('S7', 'boites'), chaussures: w('S7', 'chaussures'), tchac: w('S7', 'tchac') },
      douane: { a: CH('douane').start + .25, b: CH('frais').start + .1, morceau: w('S8', 'morceau'), droits: w('S8', 'droits'), douane: w('S8', 'douane'),
        exemple: w('S8', 'exemple'), n3000: w('S8', '3'), tchac: w('S8', 'tchac'), tchac2: w('S8', 'tchac', 1), inclus: w('S8', 'inclus'), payes: w('S8', 'payes'),
        ils: w('S8', 'ils'), dans: w('S8', 'dans', 1), votre: w('S8', 'votre'), prix: w('S8', 'prix') },
      frais: { a: CH('frais').start + .15, b: CH('repit').start - .05, petits: w('S9', 'petits'), credit: w('S9', 'credit'), brule: w('S9', 'brule'), negocier: w('S9', 'negocier'),
        whatsapp: w('S9', 'whatsapp'), pousseur: w('S9', 'pousseur'), taxi: w('S9', 'taxi'), mboppi: w('S9', 'mboppi'), n350: w('S9', '350'), tchac: w('S9', 'tchac') },
    };
  }

  // ------------------------------------------------------------------ shared little props
  function card(cw, ch, fill = C.cream, seed = 1, lift = 9) {
    withShadow(lift, () => { ctx.fillStyle = fill; ctx.beginPath(); const tp = tornLine(-cw / 2, -ch / 2, cw / 2, -ch / 2, seed, 2, 12), bt = tornLine(cw / 2, ch / 2, -cw / 2, ch / 2, seed + 5, 2, 12);
      ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  function tape(x, y, r = 0, len = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -15, len, 30); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -11, len, 4); }); }
  function pen(x, y, col = C.ink, rot = -.45) { at(x, y, 0, .55, .55, () => marker(0, 0, rot, col)); }
  /** price tag hanging from the top of the band on violet thread; main amount + optional « (exemple) » */
  function hangTag(x, y, t, t0, main, sub, n, seed, up = 0, o = {}) {
    if (t < t0 - .05 || up >= 1) return;
    const k = pop(t, t0 - .05, 11, .4), yy = lerp((o.anchorY ?? Y0) - 160, y, k) - up * 460;
    const sw = .13 * Math.exp(-(t - t0) * 1.5) * Math.sin((t - t0) * 7) + .025 * Math.sin(t * 2.3 + seed);
    const tw = o.w || 240, th = sub ? 152 : 112, hole = -th / 2 + 30;
    const ay = o.anchorY ?? Y0, ax = x + (o.anchorDX || 0), hx = ax + Math.sin(sw) * (yy + hole - ay);
    if (yy + hole > ay) { ctx.save(); ctx.strokeStyle = o.anchorY ? C.ink : C.violet; ctx.lineWidth = o.anchorY ? 3 : 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, yy + hole); ctx.stroke(); ctx.restore(); }
    if (!o.anchorY && up < .5) { ctx.save(); ctx.globalAlpha *= 1 - up * 2; tape(x, Y0 + 8, seed % 2 ? .12 : -.12, 64); ctx.restore(); }
    at(hx, yy, sw, 1, 1, () => priceTag(tw, th, () => {
      handText(main, 0, sub ? 26 : 38, o.size || 54, { color: o.color || M.red, pen: false });
      if (sub) handText(sub, 0, 64, 44, { color: C.inkSoft, pen: false, wght: 700 });
    }));
  }
  /** map pin: head at (0,-34), needle to (0,0) */
  function pin(col = M.red) {
    ctx.save(); ctx.strokeStyle = '#8C939B'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -30); ctx.stroke();
    withShadow(8, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -40, 17, 0, 7); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(-5, -45, 5, 0, 7); ctx.fill(); ctx.restore();
  }
  function label(s, size = 46, fill = C.cream, col = C.ink, fam = FF.stencil) {
    const f = font(fam, size, 900), lw = measure(s, f, 3) + 34;
    withShadow(5, () => { ctx.fillStyle = fill; rrect(-lw / 2, -size * .72, lw, size * 1.3, 8); ctx.fill(); });
    text(s, 0, size * .36, { font: f, align: 'center', color: col, ls: 3 });
  }
  function dust(x, y, s, seed, col = C.kraftL) {
    if (s < 0 || s > .4) return; ctx.save();
    for (let k = 0; k < 8; k++) { const a = Math.PI + (k / 7) * Math.PI, v = 70 + rnd(seed * 9 + k) * 70;
      ctx.globalAlpha = clamp(1 - s / .4) * .55; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + Math.cos(a) * v * s * 2.4, y + Math.sin(a) * 34 * s * 2, 5 + 4 * rnd(k + seed), 0, 7); ctx.fill(); }
    ctx.restore();
  }
  const shakeXY = (t, t0, amp, n, dur = 9) => { const k = t >= t0 ? Math.exp(-(t - t0) * dur) : 0; return [(rnd(n * 1.7 + t0) - .5) * 2 * amp * k, (rnd(n * 2.9 + t0) - .5) * 2 * amp * k]; };

  // ================================================================== S5 — le taux
  function vTaux(t, n, V) {
    const ex = eInCubic(prog(t, V.b - .5, V.b));
    // left: a generic search bar, « taux Google » in grey pencil
    const dl = drop(t, V.taux - .24, 420, .22);
    if (dl.a) { const j = jit(601, n, .6);
      at(250 + j.x - ex * 1150, 1004 + dl.y + j.y, -.03 + j.r, dl.sx, dl.sy, () => {
        card(440, 186, C.cream, 61); tape(0, -92, .04, 110);
        withShadow(3, () => { ctx.fillStyle = '#FFFFFF'; rrect(-200, -44, 400, 88, 44); ctx.fill(); });
        ctx.strokeStyle = 'rgba(35,22,41,.22)'; ctx.lineWidth = 3; rrect(-200, -44, 400, 88, 44); ctx.stroke();
        ctx.strokeStyle = '#9A9AA0'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-160, -6, 15, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-149, 5); ctx.lineTo(-136, 18); ctx.stroke();
        const wk = prog(t, V.taux2 - .06, V.google + .42);
        if (wk <= 0) { if (Math.floor(n / 10) % 2 === 0) { ctx.fillStyle = '#6A6470'; ctx.fillRect(-118, -24, 4, 48); }
          const hv = pop(t, V.taux + .55, 10, .5); if (hv > 0) { const ts = stepT(n); at(-100 + Math.sin(ts * 5) * 18, -6 - (1 - clamp(hv)) * 120 + Math.cos(ts * 7) * 6, 0, .5, .5, () => marker(0, 0, -.5 + Math.sin(ts * 3) * .08, '#8A8A90')); } }
        else { handText('taux Google', -116, 15, 46, { align: 'left', write: wk, color: '#85808C', pen: false, wght: 600 });
          if (wk < 1) at(-116 + measure('taux Google', font(FF.hand, 46, 600)) * wk, 0, 0, .5, .5, () => marker(0, 0, -.5, '#8A8A90')); }
      });
    }
    // right: receipt stub, « taux APPLIQUÉ + frais » in ink
    const dr = drop(t, V.paie - .2, 420, .22);
    if (dr.a) { const j = jit(602, n, .6);
      at(792 + j.x + ex * 1150, 896 + dr.y + j.y, .03 + j.r, dr.sx, dr.sy, () => {
        const rw = 316, rh = 196;
        withShadow(10, () => { ctx.fillStyle = M.paper; ctx.beginPath(); ctx.moveTo(-rw / 2, 0); ctx.lineTo(rw / 2, 0); ctx.lineTo(rw / 2, rh);
          for (let x = rw / 2; x > -rw / 2; x -= 18) { ctx.lineTo(x - 9, rh - 11); ctx.lineTo(x - 18, rh); } ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = 'rgba(0,0,0,.03)'; for (let i = 0; i < 16; i++) ctx.fillRect(-rw / 2, rnd(i * 7.3) * rh, rw, 1);
        const rows = [['taux', V.taux3, 48, 44, 700, C.ink], ['APPLIQUÉ', V.applique, 106, 54, 800, C.ink], ['+ frais', V.frais, 160, 46, 800, C.orange]];
        for (const [s, t0, y, sz, wg, col] of rows) { const k = prog(t, t0 - .08, t0 + .22); if (k <= 0) continue;
          ctx.save(); ctx.beginPath(); ctx.rect(-rw / 2, y - sz, rw * k, sz * 1.4); ctx.clip();
          text(s, 0, y, { font: font(FF.mono, sz, wg), align: 'center', color: col }); ctx.restore(); }
      });
    }
    // the marker's big ≠ between the two cards
    const nk = prog(t, V.compris - .12, V.compris + .38);
    if (nk > 0) { const pulse = 1 + .08 * Math.exp(-(t - V.compris - .38) * 5) * (t > V.compris + .38 ? 1 : 0);
      at(542, 1004, -.05, pulse * (1 - ex), pulse * (1 - ex), () => {
        ctx.save(); ctx.strokeStyle = M.red; ctx.lineWidth = 15; ctx.lineCap = 'round';
        const seg = (x0, y0, x1, y1, a, b) => { const q = clamp((nk - a) / (b - a)); if (q <= 0) return; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lerp(x0, x1, q), lerp(y0, y1, q)); ctx.stroke(); };
        seg(-52, -20, 52, -22, 0, .3); seg(-52, 22, 52, 20, .3, .6); seg(30, -62, -30, 62, .6, 1); ctx.restore();
        if (nk < 1) { const hx = nk < .3 ? lerp(-52, 52, nk / .3) : nk < .6 ? lerp(-52, 52, (nk - .3) / .3) : lerp(30, -30, (nk - .6) / .4), hy = nk < .3 ? -20 : nk < .6 ? 22 : lerp(-62, 62, (nk - .6) / .4); pen(hx, hy, M.red); }
      }); }
    // takeaway line + price tag
    const lk = pop(t, V.compris + .55, 13, .5);
    if (lk > 0) { const j = jit(603, n, .5);
      at(318 + j.x - ex * 1150, 1196 + j.y + (1 - clamp(lk)) * 40, -.015, clamp(lk, 0, 1.1), clamp(lk, 0, 1.1), () => {
        card(610, 72, '#FFFFFF', 67); text('Comparez le total en F CFA', 0, 16, { font: font(FF.body, 44, 800), align: 'center', color: C.violetD }); }); }
    if (ex < 1) { ctx.save(); ctx.translate(ex * 1150, 0); hangTag(806, 1166, t, V.n150, '150 F', '(exemple)', n, 1, 0, { w: 236, anchorY: 1088 }); ctx.restore(); }
  }

  // ================================================================== S6 — le camion (usine → Guangzhou)
  const ROAD = [[110, 1150], [300, 1136], [500, 1160], [700, 1140], [880, 1150]];
  let ROADPTS = null;
  const roadY = x => { const p = ROADPTS; for (let i = 1; i < p.length; i++) if (p[i][0] >= x) { const k = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1); return lerp(p[i - 1][1], p[i][1], clamp(k)); } return p[p.length - 1][1]; };
  function vCamion(t, n, V) {
    if (!ROADPTS) ROADPTS = curve(ROAD, 16);
    const ex = eInCubic(prog(t, V.b - .5, V.b)), en = eOutCubic(prog(t, V.a, V.a + .5));
    // kraft mini-map strip (unrolls from the left, rolls away to the right)
    ctx.save(); ctx.beginPath(); ctx.rect(W * ex, 0, W * en - W * ex, H); ctx.clip();
    withShadow(8, () => { ctx.fillStyle = C.kraftL; ctx.beginPath(); const tp = tornLine(10, 1098, 1070, 1098, 71, 3, 14), bt = tornLine(1070, 1240, 10, 1240, 77, 3, 14);
      ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = TEX.kraft; ctx.globalAlpha = .35; ctx.fillRect(10, 1098, 1060, 142); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(120,84,48,.25)'; ctx.lineWidth = 2;                                   // contour lines
    for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let x = 20; x <= 1060; x += 20) { const y = 1108 + i * 36 + Math.sin(x * .013 + i * 1.7) * 9; x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.strokeStyle = 'rgba(11,95,165,.35)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(560, 1098); ctx.quadraticCurveTo(610, 1170, 590, 1240); ctx.stroke();   // a river
    ctx.strokeStyle = C.cream; ctx.lineWidth = 5; ctx.setLineDash([16, 12]); ctx.beginPath(); ROADPTS.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] + 4) : ctx.moveTo(p[0], p[1] + 4)); ctx.stroke(); ctx.setLineDash([]);
    // truck position (poses on twos)
    const ts = stepT(n), go = eInOutCubic(prog(ts, V.usine + .2, V.guangzhou + .15)), arrive = eOutBack(prog(ts, V.camion - .25, V.camion + .3), 1.2);
    let tx = lerp(-260, 175, arrive) + (770 - 175) * go; tx += eInCubic(prog(ts, V.b - .75, V.b - .1)) * 700;
    const moving = (ts > V.camion - .25 && ts < V.camion + .3) || (go > 0 && go < 1) || ts > V.b - .75;
    const thr = clamp((Math.min(tx, 870) - 150) / (880 - 110));
    thread(ROADPTS, thr > 0 ? clamp(thr + .05) : 0, n, { w: 6 });
    // pins + labels
    [[110, V.usine, 'USINE', M.red], [880, V.guangzhou, 'GUANGZHOU', C.violetD]].forEach(([x, t0, s, col], i) => {
      const k = pop(t, t0 - .12, 13, .45); if (k <= 0) return; const d = drop(t, t0 - .12, 160, .16);
      at(x, roadY(x) + 4 + d.y, 0, 1, 1, pin.bind(null, col));
      at(x + (i ? -34 : 20), 1210, i ? .02 : -.03, clamp(k, 0, 1.15), clamp(k, 0, 1.15), () => label(s, 44));
    });
    ctx.restore();
    // falling coin (drops off the back of the truck on a bump)
    const cf = V.usine + .8, cs = t - cf;
    if (cs > 0 && ex < 1) { const cx0 = 175 + (770 - 175) * eInOutCubic(prog(cf, V.usine + .2, V.guangzhou + .15)) - 150;
      const gy = 1190, y0 = 1010, g = 2600, tl = Math.sqrt(2 * (gy - y0) / g);
      let y, x = cx0 - Math.min(cs, 1.2) * 90;
      if (cs < tl) y = y0 + .5 * g * cs * cs; else { const b = cs - tl, v = g * tl * .35; y = gy - Math.max(0, v * b - .5 * g * b * b); }
      at(x - ex * 900, y, cs * 8, 1, 1, () => coin(22, 'F', { tilt: .7 + .3 * Math.cos(cs * 14) })); }
    // the truck
    if (tx > -420 && tx < 1500) { const ry = roadY(clamp(tx, 110, 880)), bump = moving ? (rnd(Math.floor(n / 2) * 1.3) - .5) * 5 : 0, tilt = moving ? (rnd(Math.floor(n / 2) * 2.1) - .5) * .02 : 0;
      if (moving) { ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round';           // motion streaks
        for (let i = 0; i < 4; i++) { const yy = ry - 30 - i * 42 + (rnd(i + Math.floor(n / 2)) - .5) * 8, x0 = tx - 175 - rnd(i * 3 + Math.floor(n / 2)) * 30; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - 70 - 40 * rnd(i * 7), yy); ctx.stroke(); }
        ctx.restore(); }
      for (let i = 0; i < 5; i++) { const s = (stepT(n) * 1.6 + i / 5) % 1; ctx.save(); ctx.globalAlpha = .45 * (1 - s); ctx.fillStyle = '#B9B0A4';      // exhaust
        ctx.beginPath(); ctx.arc(tx - 172 - s * 70, ry - 18 - s * 40 + Math.sin(i * 2 + s * 6) * 6, 6 + s * 16, 0, 7); ctx.fill(); ctx.restore(); }
      at(tx, ry + 8 + bump, tilt, .62, .62, () => {
        truck(tx / 300, { box: C.kraft });
        ctx.fillStyle = TEX.kraft; rrect(-260, -300, 360, 250, 10); ctx.fill();
        ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-80, -300); ctx.lineTo(-80, -50); ctx.stroke();
        ctx.fillStyle = C.tape; ctx.fillRect(-260, -262, 360, 26);
        handText('JUNIOR', -80, -150, 76, { color: C.ink, pen: false });
        handText('DOUALA', -80, -74, 76, { color: C.ink, pen: false });
      });
      if (!moving && Math.abs(ts - (V.guangzhou + .15)) < .3 && ts > V.guangzhou + .15) dust(tx - 150, ry, ts - V.guangzhou - .15, 3); }
    hangTag(458, 988, t, V.n200, '200 F', null, n, 2, ex, { w: 200 });
  }

  // ================================================================== S7 — le bateau, et l'air des boîtes
  function waveLayer(n, y, col, amp, ph, x0 = -20, x1 = W + 20) {
    const ts = stepT(n), Y = x => y + Math.sin(x * .011 + ph + ts * 1.8) * 12 * amp + (rnd(x * .3 + ph * 7) - .5) * 5;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0, Y1 + 20); for (let x = x0; x <= x1; x += 18) ctx.lineTo(x, Y(x)); ctx.lineTo(x1, Y1 + 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = x0; x <= x1; x += 18) x === x0 ? ctx.moveTo(x, Y(x)) : ctx.lineTo(x, Y(x)); ctx.stroke();
  }
  function vBateau(t, n, V) {
    const ex = eInCubic(prog(t, V.b - .45, V.b));
    const swap = eInCubic(prog(t, V.maritime - .3, V.maritime + .1));             // sea leaves, box arrives
    // ---- phase A: the paper boat crossing
    if (swap < 1) { const sea = eOutCubic(prog(t, V.a, V.a + .45)), dy = (1 - sea) * 200 + swap * 220;
      waveLayer(n, 1112 + dy, '#9CC3E6', 1, 0);
      const ts = stepT(n), bx = lerp(-200, 430, eOutCubic(prog(ts, V.a + .15, V.bateau + .3))) + eInCubic(prog(ts, V.n800 + .5, V.maritime + .1)) * 900;
      const by = 1150 + dy + Math.sin(ts * 5) * 6, br = Math.sin(ts * 4) * .05;
      at(bx, by, br, 1.05, 1.05, () => withShadow(6, () => paperBoat(prog(t, V.bateau - .2, V.bateau + .6))));
      for (let i = 0; i < 6; i++) { const s = ((ts * 1.3 + i / 6) % 1); ctx.save(); ctx.globalAlpha = (1 - s) * .8; ctx.fillStyle = '#FFFFFF';   // spray at the bow
        ctx.beginPath(); ctx.arc(bx + 150 + s * 60 * (i % 2 ? 1 : .6), by + 30 - s * 40 + s * s * 60, 5 + 4 * (1 - s), 0, 7); ctx.fill(); ctx.restore(); }
      waveLayer(n, 1168 + dy, '#5E9ED6', 1, 2.1); waveLayer(n, 1214 + dy, '#2F78BD', .8, 4.2);
    }
    // ---- phase B: open shoe box seen from above: the sneaker fills half, the other half is AIR
    if (swap > 0) { const d = drop(t, V.maritime - .1, 380, .2), j = jit(701, n, .5);
      if (d.a) at(330 + j.x - ex * 1150, 1098 + d.y + j.y, -.02 + j.r, d.sx, d.sy, () => openBox(t, n, V));
      // tape measure snaps along the top edge (no numbers)
      const tk = prog(t, V.metre - .08, V.metre + .22) * (1 - prog(t, V.air - .35, V.air - .15));
      if (tk > 0) at(80 - ex * 1150, 944, 0, 1, 1, () => tapeMeasure(500, eOutCubic(tk)));
      // stamp « AU m³ » falls on « cube »
      const st = V.cube + .05, sk = eInCubic(prog(t, st - .16, st));
      if (t > st - .16) { const sc = t < st ? lerp(1.8, 1, sk) : 1 + .05 * Math.exp(-(t - st) * 12) * Math.cos((t - st) * 40);
        at(792 + ex * 1150, 1146, -.1, sc, sc, () => { const al = t < st ? .3 + .5 * sk : .95;
          stampText('AU m  ', 0, 0, font(FF.stencil, 92, 900), C.sea, { box: true, boxW: 9, h: 122, ls: 4, alpha: al, starve: .4 });
          stampText('3', measure('AU m  ', font(FF.stencil, 92, 900), 4) / 2 - 22, -26, font(FF.brand, 50, 900), C.sea, { alpha: al, starve: .3 }); });
        if (t >= st) dust(792, 1190, t - st, 11, '#9CC3E6'); }
      // line on top
      const lk = pop(t, V.chaussures - .1, 13, .5);
      if (lk > 0) at(334 - ex * 1150, 912 + (1 - clamp(lk)) * -30, -.012, clamp(lk, 0, 1.1), clamp(lk, 0, 1.1), () => {
        card(640, 62, '#FFFFFF', 81);
        const f = font(FF.body, 46, 800), a = 'Au m³ : même l’', b = 'AIR', c = ' se paie', wa = measure(a, f), wb = measure(b, f), wc = measure(c, f), x0 = -(wa + wb + wc) / 2;
        text(a, x0, 16, { font: f, color: C.ink }); text(b, x0 + wa, 16, { font: f, color: C.sea }); text(c, x0 + wa + wb, 16, { font: f, color: C.ink }); });
    }
    hangTag(852, 966, t, V.n800, '800 F', null, n, 3, ex, { w: 210 });
  }
  function openBox(t, n, V) {
    const bw = 520, bh = 272;
    withShadow(10, () => { ctx.fillStyle = '#E8E0D2'; rrect(-bw / 2, -bh / 2, bw, bh, 8); ctx.fill(); });
    ctx.fillStyle = C.orange; ctx.fillRect(-bw / 2, bh * .18, 14, bh * .2); ctx.fillRect(bw / 2 - 14, bh * .18, 14, bh * .2);     // band seen on the rims
    ctx.fillStyle = '#D6C9B1'; rrect(-bw / 2 + 16, -bh / 2 + 16, bw - 32, bh - 32, 4); ctx.fill();
    ctx.fillStyle = 'rgba(90,60,30,.16)'; ctx.fillRect(-bw / 2 + 16, -bh / 2 + 16, bw - 32, 14); ctx.fillRect(-bw / 2 + 16, -bh / 2 + 16, 12, bh - 32);
    // left half: tissue + the sneaker
    ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = .85; ctx.beginPath(); ctx.moveTo(-bw / 2 + 24, -bh / 2 + 26);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-bw / 2 + 24 + i * 28, -bh / 2 + 22 + (i % 2) * 14); ctx.lineTo(-8, bh / 2 - 24); ctx.lineTo(-bw / 2 + 24, bh / 2 - 28); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    at(-128, 6, -.08, 1, 1, () => sneaker(218, { lift: 6 }));
    // divider (pencil)
    ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, -bh / 2 + 18); ctx.lineTo(4, bh / 2 - 18); ctx.stroke(); ctx.restore();
    // right half: the AIR you pay for — light-blue hatching sweeps in
    const hk = prog(t, V.air - .12, V.air + .35);
    if (hk > 0) { ctx.save(); ctx.beginPath(); ctx.rect(12, -bh / 2 + 18, (bw / 2 - 30) * eOutCubic(hk), bh - 36); ctx.clip();
      ctx.fillStyle = 'rgba(156,195,230,.35)'; ctx.fillRect(12, -bh / 2 + 18, bw / 2 - 30, bh - 36);
      ctx.strokeStyle = 'rgba(47,120,189,.55)'; ctx.lineWidth = 5; const off = (stepT(n) * 30) % 26;
      for (let x = -bh; x < bw / 2; x += 26) { ctx.beginPath(); ctx.moveTo(12 + x + off, bh / 2); ctx.lineTo(12 + x + off + bh, -bh / 2); ctx.stroke(); }
      ctx.restore(); }
    // paper cloud « AIR » with its own little price tag
    const ck = pop(t, V.air + .05, 12, .42);
    if (ck > 0) { const bob = Math.sin(stepT(n) * 3) * 4;
      at(128, -46 + bob, .04, clamp(ck, 0, 1.2), clamp(ck, 0, 1.2), () => {
        withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); for (const [x, y, r] of [[-60, 10, 36], [-20, -14, 46], [34, -8, 42], [66, 14, 32], [0, 20, 40]]) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 7); } ctx.fill(); });
        text('AIR', 2, 26, { font: font(FF.stencil, 60, 900), align: 'center', color: C.sea, ls: 4 });
      });
      const tk = pop(t, V.boites - .05, 12, .4);
      if (tk > 0) { const sw = .15 * Math.exp(-(t - V.boites) * 2) * Math.sin((t - V.boites) * 8);
        ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(150, 0 + bob); ctx.lineTo(150 + Math.sin(sw) * 40, 48); ctx.stroke(); ctx.restore();
        at(150 + Math.sin(sw) * 40, 82, sw, clamp(tk, 0, 1.1), clamp(tk, 0, 1.1), () => priceTag(150, 84, () => handText('payé !', 0, 30, 44, { color: M.red, pen: false }))); }
    }
  }

  // ================================================================== S8 — la douane (the big one)
  const POST = ['Calculés sur marchandise + transport', '+ assurance.', 'ici : 5 000 + 200 + 800 = 6 000 F', 'exemple : 3 000 F de droits et taxes', '(selon le produit)'];
  function vDouane(t, n, V) {
    const ex = eInCubic(prog(t, V.b - .45, V.b));
    const slam = V.douane + .04, [sx, sy] = shakeXY(t, slam, 6, n, 7);
    ctx.save(); ctx.translate(sx, sy);
    // the blank customs card lands first
    const push = eInCubic(prog(t, V.exemple - .38, V.exemple + .02)), cd = drop(t, V.a + .1, 300, .2);
    if (cd.a && push < 1) { const s = t - slam, sq = s > 0 ? 1 + .06 * Math.exp(-s * 10) * Math.cos(s * 36) : 1;
      at(540 - push * 900, 1062 + cd.y, -.03 - push * .5, sq * cd.sx, cd.sy / sq, () => {
        card(620, 236, C.kraftL, 91, 12); ctx.fillStyle = TEX.kraft; ctx.globalAlpha = .4; ctx.fillRect(-310, -118, 620, 236); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-270, -70 + i * 48); ctx.lineTo(270, -70 + i * 48); ctx.stroke(); }
        if (s >= 0) stampText('DOUANE', 0, 4, font(FF.stencil, 138, 900), M.red, { box: true, boxW: 11, h: 170, ls: 8, starve: .35 });
      }); }
    // growing shadow of a giant rubber stamp (handle knob in the middle)
    if (t < slam) { const g = eInCubic(prog(t, V.a, slam)), wob = Math.sin(t * 7) * .03 * (1 - g);
      ctx.save(); ctx.globalAlpha = .1 + .45 * g; ctx.filter = `blur(${Math.round(26 - 20 * g)}px)`; ctx.fillStyle = '#2B1A1F';
      at(540 + Math.sin(t * 3) * 14 * (1 - g), 1062, -.04 + wob, .45 + .6 * g, .45 + .6 * g, () => { rrect(-310, -120, 620, 240, 30); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.fill(); });
      ctx.restore();
      for (let i = 0; i < 10; i++) { const s = (t * .8 + i / 10) % 1; ctx.save(); ctx.globalAlpha = .5 * g * (1 - s); ctx.fillStyle = C.kraftL;   // wind-blown paper crumbs
        at(540 + (rnd(i) - .5) * 800 * (1 + s), 1060 + (rnd(i * 3) - .5) * 240, s * 6, 1, 1, () => ctx.fillRect(-6, -4, 12, 8)); ctx.restore(); }
    }
    // the stamped customs card: slams, then is pushed off to the left by the post-it
    if (t >= slam && push < 1) { const s = t - slam;
      if (s < 1.5) { ctx.save(); ctx.fillStyle = M.red;                                                             // ink splash
        for (let i = 0; i < 24; i++) { const a = rnd(i * 4.7 + 3) * Math.PI * 2, d = 330 + rnd(i * 2.3) * 110, e = eOutExpo(clamp(s / .1));
          ctx.globalAlpha = .9 * (1 - push); ctx.beginPath(); ctx.ellipse(540 - push * 900 + Math.cos(a) * d * e, 1062 + Math.sin(a) * d * .38 * e, 4 + rnd(i) * 9, 3 + rnd(i * 2) * 6, a, 0, 7); ctx.fill(); }
        ctx.restore(); }
    }
    // the post-it: base of the duties (readable on pause)
    const pin_ = eOutCubic(prog(t, V.exemple - .38, V.exemple + .02)), pout = eInCubic(prog(t, V.inclus - .5, V.inclus - .18));
    if (pin_ > 0 && pout < 1) { const j = jit(801, n, .5);
      at(lerp(1500, 515, pin_) + pout * 1200 + j.x, 1062 + j.y - pout * 80, -.022 + (1 - pin_) * .2 + pout * .25 + j.r, 1, 1, () => {
        withShadow(12, () => { ctx.fillStyle = '#FFE36E'; ctx.beginPath(); ctx.moveTo(-440, -166); ctx.lineTo(440, -166); ctx.lineTo(440, 136); ctx.lineTo(410, 166); ctx.lineTo(-440, 166); ctx.closePath(); ctx.fill(); });
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.moveTo(440, 136); ctx.lineTo(410, 166); ctx.lineTo(414, 140); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-440, -166, 880, 30);
        const f = font(FF.body, 44, 700), fb = font(FF.body, 44, 800), x0 = -404;
        POST.forEach((s, i) => { const k = prog(t, V.exemple - .12 + i * .12, V.exemple + .14 + i * .12); if (k <= 0) return;
          const y = -106 + i * 58; ctx.save(); ctx.beginPath(); ctx.rect(x0 - 10, y - 50, 840 * k, 66); ctx.clip();
          if (i === 2) { const a = 'ici : 5 000 + 200 + 800 ', wa = measure(a, f); text(a, x0, y, { font: f, color: C.ink }); text('= 6 000 F', x0 + wa, y, { font: fb, color: C.violetD }); }
          else if (i === 3) { const a = 'exemple : ', wa = measure(a, f), b = '3 000 F', wb = measure(b, fb); text(a, x0, y, { font: f, color: C.ink }); text(b, x0 + wa, y, { font: fb, color: M.red });
            text(' de droits et taxes', x0 + wa + wb, y, { font: f, color: C.ink }); }
          else text(s, x0, y, { font: f, color: i === 4 ? C.inkSoft : C.ink });
          ctx.restore(); });
        const ck = prog(t, V.n3000 - .05, V.n3000 + .35) * (1 - pout);                                                    // red circle on 3 000 F
        if (ck > 0) { const wa = measure('exemple : ', f), wb = measure('3 000 F', fb); at(x0 + wa + wb / 2, -106 + 3 * 58 - 15, -.04, 1, 1, () => handCircle(wb / 2 + 14, 34, ck, M.red, 6, 5)); }
      }); }
    // « Inclus dans le groupage ? » / « Payés à part ? » → a hand points at YOU → « DANS VOTRE PRIX »
    if (t > V.inclus - .3) {
      miniBox(t, n, 222, V.inclus, ['Inclus dans', 'le groupage ?'], 811, ex, -1);
      miniBox(t, n, 800, V.payes, ['Payés à part ?'], 812, ex, 1);
      const hk = pop(t, V.ils - .08, 12, .4);
      if (hk > 0) { const poke = t > V.votre ? 1 + .22 * Math.exp(-(t - V.votre) * 6) * Math.abs(Math.sin((t - V.votre) * 14)) : 1, j = jit(813, n, .6);
        at(514 + j.x, 1070 + j.y + ex * 400, j.r, clamp(hk, 0, 1.2) * poke, clamp(hk, 0, 1.2) * poke, () => handAtYou(t)); }
      const bk = pop(t, V.dans - .06, 13, .5);
      if (bk > 0) { const j = jit(814, n, .5);
        at(514 + j.x, 1206 + j.y + ex * 200, -.02 + j.r, clamp(bk, 0, 1.12), clamp(bk, 0, 1.12), () => {
          withShadow(10, () => { ctx.fillStyle = C.orange; rrect(-262, -38, 524, 76, 10); ctx.fill(); });
          text('DANS VOTRE PRIX', 0, 24, { font: font(FF.stencil, 66, 900), align: 'center', color: C.cream, ls: 5 }); }); }
    }
    ctx.restore();
  }
  /** small kraft box (front view), flaps open at t0 and a « 3 000 F (exemple) » tag rises out of it */
  function miniBox(t, n, x, t0, lines, seed, ex, dir) {
    const d = drop(t, t0 - .3, 300, .2); if (!d.a) return;
    const j = jit(seed, n, .6), op = eOutBack(prog(t, t0 - .02, t0 + .3)), bw = 318, bh = 112, top = 1058;
    at(x + j.x + dir * ex * 1100, d.y + j.y, j.r, 1, 1, () => {
      for (const s of [-1, 1]) at(s * bw / 2, top, s * (-.1 - 1.9 * op) * -1, 1, 1, () => { ctx.fillStyle = C.kraftD; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-s * bw / 2, 0); ctx.lineTo(-s * bw / 2 + s * 14, -52); ctx.lineTo(-s * 10, -52); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#6B4A2A'; ctx.fillRect(-bw / 2 + 6, top - 14 * op, bw - 12, 14 * op + 2);
      const tk = pop(t, t0 + .12, 11, .42);                                       // the tag rises out of the box
      if (tk > 0) at(0, top + 40 - 134 * clamp(tk, 0, 1.12), dir * .05, 1, 1, () => priceTag(236, 132, () => {
        handText('3 000 F', 0, 20, 50, { color: M.red, pen: false }); handText('(exemple)', 0, 58, 44, { color: C.inkSoft, pen: false, wght: 700 }); }));
      withShadow(8, () => { ctx.fillStyle = C.kraft; ctx.fillRect(-bw / 2, top, bw, bh); });
      ctx.fillStyle = TEX.kraft; ctx.fillRect(-bw / 2, top, bw, bh);
      ctx.fillStyle = 'rgba(255,240,210,.25)'; ctx.fillRect(-bw / 2, top, bw, 5);
      ctx.fillStyle = C.cream; rrect(-bw / 2 + 12, top + 10, bw - 24, bh - 20, 6); ctx.fill();
      const f = font(FF.body, 44, 800);
      lines.forEach((s, i) => text(s, 0, top + 10 + (bh - 20) / 2 + (i - (lines.length - 1) / 2) * 46 + 15, { font: f, align: 'center', color: C.ink }));
    });
  }
  /** paper hand pointing straight at the viewer (fingertip foreshortened) */
  function handAtYou(t) {
    const skin = '#8A5433', tip = '#A0663F', ol = 'rgba(40,18,8,.6)';
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = ol;
    withShadow(14, () => { ctx.fillStyle = C.violet; rrect(-60, 60, 120, 62, 14); ctx.fill(); });                          // sleeve
    ctx.fillStyle = C.violetD; ctx.fillRect(-60, 60, 120, 12);
    ctx.fillStyle = skin; rrect(-72, -34, 144, 108, 36); ctx.fill(); ctx.stroke();                                            // back of the fist
    for (let i = 0; i < 3; i++) { ctx.fillStyle = skin; rrect(-58 + i * 40, 18, 38, 50, 16); ctx.fill(); ctx.stroke(); }      // curled fingers
    ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(-64, 0, 22, 46, -.3, 0, 7); ctx.fill(); ctx.stroke();                 // thumb
    withShadow(24, () => { ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(8, -34, 54, 0, 7); ctx.fill(); });                  // the index, coming at you
    ctx.beginPath(); ctx.arc(8, -34, 54, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,18,8,.35)'; ctx.beginPath(); ctx.arc(8, -34, 38, .3, 2.8); ctx.stroke();                     // fingertip crease
    ctx.strokeStyle = ol; ctx.fillStyle = '#EFC9B2'; ctx.beginPath(); ctx.ellipse(8, -62, 27, 18, 0, 0, 7); ctx.fill(); ctx.stroke();   // nail
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(0, -67, 10, 5, -.3, 0, 7); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.globalAlpha = .7;
    for (let i = 0; i < 4; i++) { const a = -2.7 + i * .75, r = 84 + 8 * Math.sin(t * 12 + i); ctx.beginPath(); ctx.arc(8, -34, r, a, a + .42); ctx.stroke(); }   // « poke » arcs
    ctx.restore();
  }

  // ================================================================== S9 — les petits frais
  const MSG = ['Last price boss ?', 'Fais un effort !', 'Encore une photo ?'];
  function vFrais(t, n, V) {
    const ex = eInCubic(prog(t, V.b - .5, V.b));
    const cut = eInCubic(prog(t, V.pousseur - .9, V.pousseur - .5));           // phone scene → street scene
    if (cut < 1) { const en = eOutCubic(prog(t, V.a, V.a + .45));
      phoneChat(t, n, V, lerp(-400, 0, en) - cut * 900);
      counterChip(t, n, V, cut);
      scratchCard(t, n, V, cut); }
    if (t > V.pousseur - .66) street(t, n, V, ex);
    if (ex >= 1) return;
    hangTag(150, 972, t, V.n350, '350 F', null, n, 5, ex, { w: 210 });
  }
  function phoneChat(t, n, V, dx) {
    const j = jit(901, n, .5);
    at(318 + dx + j.x, 1062 + j.y, -.025 + j.r, 1, 1, () => {
      withShadow(12, () => { ctx.fillStyle = C.kraftD; rrect(-280, -166, 560, 332, 42); ctx.fill(); });
      ctx.fillStyle = TEX.kraft; ctx.globalAlpha = .6; rrect(-280, -166, 560, 332, 42); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#F3EFE6'; rrect(-246, -140, 492, 280, 18); ctx.fill();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(262, 0, 8, 0, 7); ctx.fill();                                  // camera dot (phone on its side)
      ctx.save(); rrect(-246, -140, 492, 280, 18); ctx.clip();
      // message feed: a new bubble every beat, pushed up on twos; incoming « … » between them
      const t0 = V.a + .3, step = Math.max(.3, (V.whatsapp + .4 - t0) / 10), ts = stepT(n);
      const cnt = Math.max(0, Math.floor((ts - t0) / step) + 1), f = font(FF.body, 44, 800);
      for (let k = Math.max(0, cnt - 4); k < cnt; k++) {
        const age = cnt - 1 - k, y = 104 - age * 82 - (1 - eOutCubic(clamp((ts - (t0 + k * step)) / .14))) * -30;
        if (k % 4 === 0) { at(-150, y, 0, 1, 1, () => { withShadow(2, () => { ctx.fillStyle = '#FFFFFF'; rrect(-70, -30, 140, 60, 26); ctx.fill(); });
          for (let d = 0; d < 3; d++) { ctx.fillStyle = C.inkSoft; ctx.globalAlpha = .4 + .6 * ((Math.floor(n / 4) + d) % 3 === 0); ctx.beginPath(); ctx.arc(-28 + d * 28, 0, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }); continue; }
        const s = MSG[(k - Math.floor(k / 4) - 1) % 3], bw = measure(s, f) + 44;
        at(226 - bw / 2, y, 0, 1, 1, () => { withShadow(2, () => { ctx.fillStyle = '#CDEFC4'; rrect(-bw / 2, -32, bw, 64, 24); ctx.fill(); ctx.beginPath(); ctx.moveTo(bw / 2 - 20, 32); ctx.lineTo(bw / 2 + 10, 34); ctx.lineTo(bw / 2 - 6, 16); ctx.fill(); });
          text(s, 0, 15, { font: f, align: 'center', color: '#17361C' }); });
      }
      ctx.restore();
    });
  }
  function counterChip(t, n, V, cut) {
    const k = pop(t, V.petits + .3, 13, .45); if (k <= 0) return;
    const c = Math.round(countTo(3, 214, prog(t, V.petits + .3, V.whatsapp + .5))), j = jit(902, n, .5);
    at(790 + j.x + cut * 700, 936 + j.y, .02, clamp(k, 0, 1.15), clamp(k, 0, 1.15), () => {
      const s = '+' + c + ' messages', f = font(FF.body, 44, 800), cw = measure('+214 messages', f) + 48;
      withShadow(8, () => { ctx.fillStyle = C.ink; rrect(-cw / 2, -38, cw, 76, 38); ctx.fill(); });
      ctx.fillStyle = '#4DDB6A'; ctx.beginPath(); ctx.arc(cw / 2 - 12, -30, 13, 0, 7); ctx.fill();
      text(s, 0, 15, { font: f, align: 'center', color: C.cream });
    });
  }
  function scratchCard(t, n, V, cut) {
    const d = drop(t, V.credit - .3, 300, .18); if (!d.a) return;
    const j = jit(903, n, .6), cx = 790 + j.x + cut * 700, cy = 1118 + d.y + j.y;
    const sk = prog(t, V.credit - .05, V.brule + .25), burn = prog(t, V.brule, V.brule + 1.2);
    at(cx, cy, -.04 + j.r, d.sx, d.sy, () => {
      withShadow(9, () => { ctx.fillStyle = C.violetD; rrect(-158, -86, 316, 172, 16); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 5; i++) ctx.fillRect(-158 + i * 70, -86, 26, 172);
      ctx.fillStyle = C.cream; rrect(-130, -52, 260, 104, 10); ctx.fill();
      text('CRÉDIT', 0, 20, { font: font(FF.body, 58, 800), align: 'center', color: C.ink });
      // silver scratch layer, removed left → right with a ragged edge
      ctx.save(); ctx.beginPath(); ctx.moveTo(-130 + 260 * sk, -52);
      for (let y = -52; y <= 52; y += 13) ctx.lineTo(-130 + 260 * sk + (rnd(y * .7 + 3) - .5) * 26, y);
      ctx.lineTo(130, 52); ctx.lineTo(130, -52); ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#B8BEC6'; rrect(-130, -52, 260, 104, 10); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 9; i++) ctx.fillRect(-130 + i * 30, -52, 12, 104); ctx.restore();
      if (sk > 0 && sk < 1) { at(-130 + 260 * sk, -10 + Math.sin(t * 40) * 26, .3, 1, 1, () => coin(26, 'F', { tilt: .5 }));
        ctx.fillStyle = '#9AA1A9'; for (let i = 0; i < 8; i++) ctx.fillRect(-130 + 260 * sk + rnd(i + n) * 30, 58 + rnd(i * 2 + n) * 14, 5, 4); }
      // « brûlé » : the card chars at the corner, little paper flames
      if (burn > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; const g = ctx.createRadialGradient(158, 86, 10, 158, 86, 200 * burn);
        g.addColorStop(0, 'rgba(40,20,10,.85)'); g.addColorStop(1, 'rgba(40,20,10,0)'); ctx.fillStyle = g; rrect(-158, -86, 316, 172, 16); ctx.fill(); ctx.restore();
        for (let i = 0; i < 4; i++) { const fl = Math.floor(n / 2), h = (26 + 24 * rnd(fl * 1.3 + i)) * clamp(burn * 3);
          at(96 + i * 22, 82 - i * 30, (rnd(fl + i) - .5) * .3, 1, 1, () => { ctx.fillStyle = i % 2 ? C.orange : C.amber; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(-14, -h * .6, 0, -h); ctx.quadraticCurveTo(14, -h * .6, 12, 0); ctx.closePath(); ctx.fill(); }); }
        for (let i = 0; i < 4; i++) { const s = (t * .9 + i / 4) % 1; ctx.save(); ctx.globalAlpha = .35 * (1 - s) * clamp(burn * 3); ctx.fillStyle = '#8A8290';
          ctx.beginPath(); ctx.arc(120 + i * 12 + s * 30, 20 - s * 120, 10 + s * 16, 0, 7); ctx.fill(); ctx.restore(); } }
    });
  }
  // ---- the Douala street: pousseur → taxi → pin MBOPPI
  function street(t, n, V, ex) {
    const en = eOutCubic(prog(t, V.pousseur - .66, V.pousseur - .2)), ts = stepT(n), gy = 1196;
    ctx.save(); ctx.translate(0, (1 - en) * 380 + ex * 620);
    // background: flat paper façades
    const fac = [[40, 170, 190, '#E6C79C'], [220, 150, 150, '#D9CFE8'], [380, 190, 210, '#EAD9B8'], [600, 160, 170, '#F1DCC4'], [780, 210, 200, '#D8E3CF']];
    for (const [x, fw, fh, col] of fac) { withShadow(3, () => { ctx.fillStyle = col; ctx.fillRect(x, gy - fh, fw, fh); });
      ctx.fillStyle = 'rgba(35,22,41,.16)'; for (let r = 0; r < 2; r++) for (let c = 0; c < Math.floor(fw / 50); c++) ctx.fillRect(x + 18 + c * 50, gy - fh + 24 + r * 60, 26, 34); }
    // bendskin crossing in the background (right → left)
    const bx = lerp(1250, -250, prog(ts, V.pousseur - .3, V.mboppi + 1.6));
    at(bx, gy - 22, 0, -.36, .36, () => bendskin(t, { parcels: 2 }));
    // road
    ctx.fillStyle = '#6E6570'; ctx.fillRect(0, gy, W, 60); ctx.fillStyle = '#EDE7DB'; for (let x = (-ts * 120) % 80; x < W; x += 80) ctx.fillRect(x, gy + 26, 44, 6);
    // violet thread along the road → pin MBOPPI
    const tx = taxiX(ts, V), thr = prog(ts, V.taxi + .6, V.mboppi + .1);
    thread([[30, gy + 10], [300, gy + 6], [600, gy + 12], [904, gy + 8]], Math.max(prog(ts, V.pousseur - .1, V.taxi) * .6, .6 + .4 * thr), n, { w: 6 });
    const pk = pop(t, V.mboppi - .12, 13, .45);
    if (pk > 0) { const d = drop(t, V.mboppi - .12, 200, .16);
      ctx.save(); ctx.strokeStyle = C.kraftD; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(904, gy + 4 + d.y); ctx.lineTo(904, gy - 118 + d.y); ctx.stroke(); ctx.restore();
      at(904, gy + 8 + d.y, 0, 1, 1, () => pin(M.red));
      at(880, gy - 150 + d.y, .03, clamp(pk, 0, 1.15), clamp(pk, 0, 1.15), () => label('MBOPPI', 50, C.cream, C.violetD)); }
    // pousseur pulling his wooden cart
    const px = lerp(-150, 318, eOutCubic(prog(ts, V.pousseur - .3, V.taxi - .1))), walking = ts < V.taxi - .1;
    const hand = prog(ts, V.taxi + .05, V.taxi + .7);                             // cartons hop onto the taxi, one by one
    cart(px - 190, gy, ts, walking, hand, V);
    pousseur(px, gy, ts, walking, t > V.mboppi);
    taxi(tx, gy, ts, V);
    ctx.restore();
  }
  function taxiX(ts, V) { const arr = eOutBack(prog(ts, V.taxi - .25, V.taxi + .1), 1.1), go = eInOutCubic(prog(ts, V.taxi + .6, V.mboppi + .1));
    return lerp(1300, 560, arr) + (660 - 560) * go; }
  function cart(x, gy, ts, walking, hop, V) {
    const bob = walking ? Math.abs(Math.sin(ts * 9)) * 3 : 0;
    ctx.save(); ctx.strokeStyle = C.kraftD; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 100, gy - 70 - bob); ctx.lineTo(x + 170, gy - 92); ctx.stroke(); ctx.restore();   // handle
    at(x, gy - 34, walking ? ts * 6 : 0, 1, 1, () => { ctx.fillStyle = '#3B2B22'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = C.kraftL; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 2.1) * 30, Math.sin(i * 2.1) * 30); ctx.stroke(); } });
    withShadow(5, () => { ctx.fillStyle = '#A8763F'; ctx.fillRect(x - 110, gy - 80 - bob, 220, 22); });
    ctx.fillStyle = 'rgba(60,32,12,.3)'; for (let i = 0; i < 4; i++) ctx.fillRect(x - 110 + i * 55, gy - 80 - bob, 3, 22);
    // cartons (plain kraft) — they hop, one by one, onto the taxi roof
    [[-60, -118, 96, 76], [44, -118, 96, 76], [-8, -180, 90, 58]].forEach(([cx, cy, cw, chh], i) => {
      const k = clamp(hop * 3 - i), tx = taxiX(ts, V);
      const X = lerp(x + cx, tx + [-48, 48, 0][i], eInOutCubic(k)), Y = lerp(gy + cy - bob, gy - [190, 190, 255][i], eInOutCubic(k)) - Math.sin(k * Math.PI) * 90;
      at(X, Y, (i - 1) * .04 + Math.sin(k * Math.PI) * .4, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = C.kraft; ctx.fillRect(-cw / 2, -chh / 2, cw, chh); });
        ctx.fillStyle = TEX.kraft; ctx.fillRect(-cw / 2, -chh / 2, cw, chh); ctx.fillStyle = C.tape; ctx.fillRect(-cw / 2, -8, cw, 16); });
    });
  }
  function pousseur(x, gy, ts, walking, wave) {
    const ph = walking ? Math.floor(ts * 8) % 2 : 0, lean = walking ? .16 : 0;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#2B2230'; ctx.lineWidth = 22;                               // legs, alternating poses on twos
    for (const s of [-1, 1]) { const a = walking ? (ph ? s : -s) * .35 : 0; ctx.beginPath(); ctx.moveTo(x, gy - 96); ctx.lineTo(x + Math.sin(a) * 90, gy - 6); ctx.stroke(); }
    at(x, gy - 96, lean, 1, 1, () => {
      ctx.fillStyle = '#2F78BD'; rrect(-34, -104, 68, 110, 22); ctx.fill();          // shirt
      ctx.strokeStyle = SKIN[2]; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(-10, -80); ctx.lineTo(-70, -30); ctx.lineTo(-104, 8); ctx.stroke();   // arm back to the handle
      if (wave) { const a = Math.sin(ts * 14) * .4; ctx.beginPath(); ctx.moveTo(14, -86); ctx.lineTo(44 + a * 20, -150); ctx.stroke(); }
      ctx.fillStyle = SKIN[2]; ctx.beginPath(); ctx.arc(8, -136, 30, 0, 7); ctx.fill();
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(8, -144, 31, Math.PI, 0); ctx.fill(); ctx.fillRect(8, -148, 44, 9);   // cap
      ctx.fillStyle = '#140C10'; ctx.beginPath(); ctx.arc(24, -134, 4, 0, 7); ctx.fill();
    });
    ctx.restore();
  }
  function taxi(x, gy, ts, V) {
    if (x > 1260) return;
    const moving = ts < V.taxi + .1 || (ts > V.taxi + .6 && ts < V.mboppi + .1), b = moving ? (rnd(Math.floor(ts * 15) * 1.7) - .5) * 4 : 0;
    at(x, gy + b, 0, 1, 1, () => {
      withShadow(8, () => { ctx.fillStyle = '#F4C21B'; ctx.beginPath(); ctx.moveTo(-150, -34); ctx.lineTo(-146, -86); ctx.lineTo(-86, -92); ctx.lineTo(-54, -140); ctx.lineTo(62, -140); ctx.lineTo(100, -92); ctx.lineTo(148, -84); ctx.lineTo(152, -34); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#9CC3E6'; ctx.beginPath(); ctx.moveTo(-72, -94); ctx.lineTo(-48, -130); ctx.lineTo(0, -130); ctx.lineTo(0, -94); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -94); ctx.lineTo(10, -130); ctx.lineTo(56, -130); ctx.lineTo(86, -94); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#231629'; ctx.fillRect(-150, -52, 302, 8); ctx.fillStyle = '#FFF6D0'; ctx.fillRect(140, -80, 10, 14);
      ctx.fillStyle = C.ink; ctx.fillRect(-60, -148, 120, 8);                       // roof rack
      for (const wx of [-92, 94]) at(wx, -30, moving ? ts * 14 : 0, 1, 1, () => { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); });
      if (moving) { ctx.strokeStyle = 'rgba(35,22,41,.3)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { const yy = -40 - i * 34; ctx.beginPath(); ctx.moveTo(-170, yy); ctx.lineTo(-230 - 30 * rnd(i + Math.floor(ts * 15)), yy); ctx.stroke(); } }
    });
  }

  registerScene({
    id: 'costs', z: 25,
    when: t => t >= TL.seg('S5').start - .5 && t < TL.ch('repit').start + .1,
    draw(t, n) {
      if (!T) T = times();
      ctx.save(); ctx.beginPath(); ctx.rect(0, Y0, W, Y1 - Y0); ctx.clip();
      const V = [['taux', vTaux], ['camion', vCamion], ['bateau', vBateau], ['douane', vDouane], ['frais', vFrais]];
      for (const [k, fn] of V) { const v = T[k]; if (t >= v.a && t < v.b) { ctx.save(); fn(t, n, v); ctx.restore(); } }
      ctx.restore();
    },
  });
})();

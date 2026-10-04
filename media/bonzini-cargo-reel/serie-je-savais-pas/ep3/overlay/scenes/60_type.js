'use strict';
// =============================================================================================
// « C'EST PAS ÇA. » — type (adapted from « PAS REÇU. » 60_type.js and ep2 to the morning wax counter).
//   TY_world(t, L)  inside the camera: TOI's opening subtitle (+ the incoming plate's shadow), speaker pills that follow
//                   their plate (TOI amber, TON FOURNISSEUR · CHINE steel grey), the « Boutique · Mboppi » tag, the world
//                   texts no module has taken over: stamp « ÉCRIS TOUT » and the violet note on the sheet, « PAREIL ✓ »
//                   on the polaroid, the note « collée par ton fournisseur sur chaque carton ».
//   TY_draw(t, L)   screen space: series chip « JE SAVAIS PAS. · 3/5 », the meme header, « QUI A TORT ? », the bands
//                   « LA PHOTO NE DIT PAS TOUT. » (N1b), the lesson (N2), « LA PROCHAINE FOIS, FAIS UNE FICHE. » (N3a), the
//                   4-line sample caption (N4, N4b, N4c), the roles band, the end card (logo + name + service
//                   line, ritual stamp « MAINTENANT, TU SAIS. », CTA pill + drawn arrow, tag line).
// Every text comes from SCORE.TEXTS() = [t0, t1, id, text, style, takeover]; when window[takeover] exists the module draws
// it and this layer skips it. '|' = line break, '||' = column break, *…* = emphasis, a line starting with '^' is big.
// Texts that belong to an object (LA PHOTO, ÉCHANTILLON, À GARDER, BZ-482913 · EXEMPLE) are drawn by that object.
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, T = S.T, A = S.A, kk = S.kk, ease = S.ease, easeOut = S.easeOut;
  const CREAM = '#FFF6E8', PAPER = '#FBF6EC', INK = '#1A1426', ORANGE = '#FE560D', AMBER = '#F3A745', AMBER_INK = '#B35F00', VIOL = '#7B4BFF', VIOL_D = '#5B2BDF',
    STEEL = '#5E6878', KRAFT = '#D2AB78';
  const has = n => typeof window[n] === 'function';
  const OBJECT = new Set(['photoLabel', 'parcelLabel', 'kraftTag', 'labelCode']);
  // QA: a text that starts at 0 is also on for the motion-blur sub-frames of frame 0 (t < 0): it was drawn at half opacity
  const textsAt = t => S.TEXTS().filter(([a, b, , , st, own]) => (t >= a || a <= 0) && t < b && !OBJECT.has(st) && !(own && has(own)));
  const inOut = (t, a, b, fi = .12, fo = .12) => Math.min(easeOut(kk(t, a, a + fi)), 1 - kk(t, b - fo, b));
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;

  // ---------- helpers ----------
  function pill(x, y, label, fill, color, a, size = 44, o = {}) {
    if (a <= 0) return 0;
    ctx.save(); ctx.globalAlpha *= a; ctx.font = SAT(size); ctx.letterSpacing = (o.ls || 0) + 'px';
    const w = ctx.measureText(label).width + size * 1.1, h = size + 26;
    ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.s) ctx.scale(o.s, o.s);
    ctx.shadowColor = 'rgba(20,8,4,.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
    ctx.fillStyle = fill; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 4; rrect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h / 2 - 5); ctx.stroke(); }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2);
    ctx.restore();
    return w;
  }
  /** rich line: segments split on *…* (odd = emphasis) */
  const segs = l => l.replace(/^\^/, '').split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
  function lineW(l, f) { ctx.save(); ctx.font = f; let w = 0; for (const q of segs(l)) w += ctx.measureText(q.s).width; ctx.restore(); return w; }
  function richLine(l, x, y, f, col, emph, align = 'center') {
    const w = lineW(l, f); let cx = align === 'center' ? x - w / 2 : x;
    ctx.save(); ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (const q of segs(l)) { ctx.fillStyle = q.e ? emph : col; ctx.fillText(q.s, cx, y); cx += ctx.measureText(q.s).width; }
    ctx.restore();
  }
  /** sizes for a block of lines: '^' lines are 1.55× bigger; all fit maxW (keeps the ratio) */
  function sizes(lines, base, maxW, min = 46) {
    let k = 1; for (const l of lines) { const z = base * (l[0] === '^' ? 1.55 : 1), w = lineW(l, SAT(z)); if (w > maxW) k = Math.min(k, maxW / w); }
    return lines.map(l => Math.max(min, Math.floor(base * (l[0] === '^' ? 1.55 : 1) * k)));
  }
  /** cached starved-ink stamp sprite (box, 1–2 lines) */
  function stampSprite(key, lines, size, color) {
    const id = 'tystamp_' + key + size; const c = makeCanvasCached(id, 1100, Math.round(size * 1.15 * lines.length + 120)), g = c.getContext('2d');
    if (!c._done) {
      g.font = SAT(size); const lw = Math.max(...lines.map(l => g.measureText(l).width)), lh = size * 1.08, bh = lh * lines.length + 40, bw = lw + 70;
      const x0 = (1100 - bw) / 2, y0 = (c.height - bh) / 2;
      g.strokeStyle = color; g.lineWidth = Math.max(7, size * .08); rrectOn(g, x0, y0, bw, bh, 14); g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, 550, y0 + 20 + lh * (i + .5) + size * .04));
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { g.globalAlpha = .2 + rnd(i * 1.7 + size) * .5; g.beginPath(); g.arc(x0 + rnd(i * 1.1 + 3) * bw, y0 + rnd(i * 2.9 + 1) * bh, .6 + rnd(i * 3.3) * 2.2, 0, 7); g.fill(); }
      c._done = true; c._bw = bw; c._bh = bh;
    }
    return c;
  }
  function stamp(key, lines, x, y, size, color, k, a = 1, rot = -.07, comp = 'source-over') {
    if (k <= 0 || a <= 0) return;
    const c = stampSprite(key, lines, size, color), sc = k < 1 ? 1.7 - .7 * easeOut(k) : 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha *= a * Math.min(1, k * 2); ctx.globalCompositeOperation = comp;
    ctx.drawImage(c, -550, -c.height / 2); ctx.restore();
  }
  /** a panel (screen) behind a block of lines: 'dark' (ink, cream text) or 'cream' (paper, ink text) */
  function panel(w, h, kind, a) {
    ctx.save(); ctx.globalAlpha *= a; ctx.shadowColor = 'rgba(10,4,2,.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = kind === 'dark' ? 'rgba(16,9,24,.92)' : PAPER; rrect(-w / 2, -h / 2, w, h, 26); ctx.fill(); ctx.restore();
  }
  function block(t, a, b, s, kind, y, base, emph, o = {}) {
    const lines = s.split('|'), zs = sizes(lines, base, o.maxW || 900), lh = zs.map(z => z * 1.12), Hf = lh.reduce((p, q) => p + q, 0) + 48;
    // QA: a line that comes in later (o.lineIn) grows the panel downwards when it arrives (no empty reserved row before)
    const H0 = o.lineIn ? lh.reduce((p, q, i) => p + q * Math.min(1, o.lineIn(i) * 1.6), 0) + 48 : Hf;
    const w = Math.max(...lines.map((l, i) => lineW(l, SAT(zs[i])))) + 84, al = inOut(t, a, b, .14, .14), pop = 1.08 - .08 * easeOut(kk(t, a, a + .18));
    ctx.save(); ctx.translate(G.cx, y - (Hf - H0) / 2); ctx.scale(pop, pop); panel(w, H0, kind, al);
    let yy = -H0 / 2 + 24;
    lines.forEach((l, i) => { yy += lh[i]; const la = o.lineIn ? o.lineIn(i) : 1; if (la <= 0) return;
      ctx.save(); ctx.globalAlpha *= al * la; ctx.translate(0, (1 - la) * 14); richLine(l, 0, yy - zs[i] * .22, SAT(zs[i]), kind === 'dark' ? CREAM : INK, emph); ctx.restore(); });
    ctx.restore();
  }

  // ---------- world space ----------
  function world(t, L) {
    // TOI's opening subtitle (white, black outline) with the amber plate's shadow tightening on it
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'subtitle') {
        const sb = S.subtitle(t); if (!sb || sb.a <= 0) continue;
        const sh = sb.shadow;
        if (sh > 0) { ctx.save(); ctx.globalAlpha = .55 * sh; const sw = G.plateW.amber * (1.5 - .5 * sh), shh = G.plateH.amber * (1.5 - .5 * sh);
          softPath(() => rrect(sb.x - sw / 2 + 40 * (1 - sh), sb.y - shh / 2 + 30, sw, shh, 30), 40 - 30 * sh, 'rgba(20,8,4,.9)'); ctx.restore(); }
        const lines = ['Mes sacs', 'sont arrivés !'];
        ctx.save(); ctx.font = SAT(88); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        lines.forEach((l, i) => { const y = sb.y - 48 + i * 96; ctx.lineWidth = 16; ctx.strokeStyle = '#0B0710'; ctx.strokeText(l, sb.x, y); ctx.fillStyle = '#FFFFFF'; ctx.fillText(l, sb.x, y); });
        ctx.restore();
      }
      if (st === 'label') {                                  // the shop label, pinned on the cloth (kraft tag)
        const al = a <= 0 ? 1 - kk(t, b - .3, b) : inOut(t, a, b, .2, .3), x = G.label.x, y = G.label.y;   // there from frame 0
        ctx.save(); ctx.translate(x, y); ctx.rotate(.05); ctx.globalAlpha = al;
        ctx.font = SAT(44, 700); const w = ctx.measureText(s).width + 60, h = 80;
        ctx.shadowColor = 'rgba(20,8,4,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6;
        ctx.fillStyle = lit('#D9B98C', x, y, L, .3); rrect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#3B2412'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 3);
        ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(-w / 2 + 18, -h / 2 + 16, 9, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (st === 'stampFiche') {                              // « ÉCRIS TOUT » at the head of the sheet
        const F = S.fiche(t); if (!F) continue; const g = S.ficheGeo(F);
        ctx.save(); ctx.translate(g.stamp.x, g.stamp.y); ctx.rotate(g.rot); ctx.scale(g.s, g.s);
        stamp('tout', [s], 0, 0, 86, ORANGE, F.stamp, 1, -.05, 'multiply'); ctx.restore();
      }
      if (st === 'noteViolet') {                              // the violet note, pinned at the foot of the sheet
        const F = S.fiche(t); if (!F || F.note <= 0) continue; const g = S.ficheGeo(F), lines = s.split('|'), k = F.note, sc = 1.35 - .35 * easeOut(k);
        ctx.save(); ctx.translate(g.note.x, g.note.y); ctx.rotate(g.rot + .02); ctx.scale(g.s * sc, g.s * sc); ctx.globalAlpha *= Math.min(1, k * 2);
        const nw = S.FICHE.noteW, nh = S.FICHE.noteH;
        ctx.shadowColor = 'rgba(30,10,60,.4)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; ctx.fillStyle = VIOL; rrect(-nw / 2, -nh / 2, nw, nh, 12); ctx.fill(); ctx.shadowColor = 'transparent';
        lines.forEach((l, i) => text(l, 0, -nh / 2 + 66 + i * 58, { font: SAT(50), align: 'center', color: CREAM }));
        ctx.fillStyle = '#FFD86B'; ctx.beginPath(); ctx.arc(-nw / 2 + 22, -nh / 2 + 20, 10, 0, 7); ctx.fill();
        ctx.restore();
      }
      if (st === 'stampAmber') {                              // « PAREIL ✓ » stamped on the polaroid
        const P = S.polaroid(t); if (!P || P.pareil <= 0) continue;
        ctx.save(); ctx.translate(P.x - 30 * P.s, P.y + 40 * P.s); ctx.rotate(P.rot - .12);            // text right edge < 960
        stamp('pareil', ['PAREIL ✓'], 0, 0, 64, '#E58A00', P.pareil, 1, 0); ctx.restore();
      }
      if (st === 'annot') {                                   // « collée par ton fournisseur sur chaque carton »
        const br = S.brand(t), bc = S.bigCarton(t); if (!br || !bc) continue;
        const al = br.labelNote * (1 - br.out), lines = s.split('|'), x = G.annot.x, y = G.annot.y;
        ctx.save(); ctx.globalAlpha *= al;
        ctx.fillStyle = 'rgba(16,9,24,.86)'; rrect(x - 340, y - 58, 680, 122, 20); ctx.fill();
        lines.forEach((l, i) => text(l, x, y - 6 + i * 54, { font: `800 46px Shantell`, align: 'center', color: CREAM }));
        ctx.strokeStyle = CREAM; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();   // a drawn arrow up to the label
        ctx.moveTo(x + 300, y - 50); ctx.quadraticCurveTo(x + 330, y - 110, x + 240, y - 150); ctx.moveTo(x + 240, y - 150); ctx.lineTo(x + 272, y - 156); ctx.moveTo(x + 240, y - 150); ctx.lineTo(x + 256, y - 122); ctx.stroke();
        ctx.restore();
      }
    }
    // speaker pills
    for (const p of S.pills(t)) {
      if (p.who === 'toi') pill(p.x, p.y, 'TOI', AMBER, INK, p.a ?? 1, 44);
      if (p.who === 'fournisseur') pill(p.x, p.y, 'TON FOURNISSEUR · CHINE', STEEL, CREAM, p.a ?? 1, 42, { rot: p.rot });   // QA: 34 → 42 px (it says who answers)
    }
  }

  // ---------- screen space ----------
  function screen(t, L) {
    chipSeries();
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'memeBand') memeBand(t, s);
      if (st === 'pillBig') {
        const k = kk(t, a, a + .22), bnc = 1 + .14 * Math.exp(-(t - a) * 7) * Math.sin((t - a) * 20), al = 1 - kk(t, b - .15, b);
        ctx.save(); ctx.translate(G.qui.x, G.qui.y); ctx.rotate(-.03); ctx.scale(bnc * easeOut(k), bnc * easeOut(k)); ctx.globalAlpha *= al;
        pill(0, 0, s, ORANGE, '#FFFFFF', 1, 96); ctx.restore();
      }
      if (st === 'bandDark') block(t, a, b, s, 'dark', G.top.y, 72, ORANGE);   // QA: 66 → 72 px (THE lesson of the film)
      if (st === 'bandCream') block(t, a, b, s, 'cream', G.top.y, 96, ORANGE);
      // the sample caption, 4 lines: 1–2 with N4 (« L'ÉCHANTILLON, / C'EST UN SEUL SAC. »), 3 with N4b, 4 on « Garde »
      if (st === 'caption2') block(t, a, b, s, 'cream', G.top.y, 62, ORANGE, { lineIn: i => i < 2 ? 1 : i === 2 ? easeOut(kk(t, A.capL3, A.capL3 + .2)) : easeOut(kk(t, A.garde, A.garde + .2)) });
      if (st === 'role') roles(t, a, b, id, s);
      if (st === 'brand') {
        const al = inOut(t, a, b, .3, .1), k = easeOut(kk(t, a, a + .35));
        ctx.save(); ctx.globalAlpha *= al; ctx.font = '800 66px DMSans'; const tw = ctx.measureText(s).width, lg = 112, gap = 22, x0 = G.cx - (lg + gap + tw) / 2;
        drawLogo(x0 + lg / 2, G.end.logoY - 4 - 16 * (1 - k), lg, { alpha: k });
        text(s, x0 + lg + gap, G.end.logoY + 22, { font: '800 66px DMSans', color: CREAM }); ctx.restore();
      }
      if (st === 'service') { const al = inOut(t, a, b, .3, .1); ctx.save(); ctx.globalAlpha *= al; serviceLine(s, G.cx, G.end.serviceY + (1 - easeOut(kk(t, a, a + .3))) * 16); ctx.restore(); }
      if (st === 'stampEnd') {
        const k = kk(t, a, a + .12), al = inOut(t, a, b, .01, .1), lines = s.split('|');
        ctx.save(); ctx.globalAlpha *= al * Math.min(1, k * 3); ctx.translate(G.cx, G.end.stampY); ctx.rotate(-.035);
        ctx.shadowColor = 'rgba(10,4,2,.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillStyle = PAPER; rrect(-380, -150, 760, 300, 18); ctx.fill(); ctx.restore();
        stamp('end', lines, G.cx, G.end.stampY, 108, ORANGE, k, al, -.06, 'multiply');
      }
      if (st === 'cta') {
        const k = kk(t, a, a + .25), bounce = 1 + .12 * Math.exp(-(t - a) * 6) * Math.sin((t - a) * 18), al = 1 - kk(t, b - .1, b);
        ctx.save(); ctx.translate(G.cx, G.end.ctaY); ctx.scale(bounce * easeOut(k), bounce * easeOut(k)); ctx.globalAlpha *= al;
        pill(0, 0, s, AMBER, INK, 1, 56);
        ctx.strokeStyle = AMBER; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';          // drawn arrow → the comments
        const ay = 62 + 6 * Math.sin(t * 8); ctx.beginPath(); ctx.moveTo(0, ay); ctx.bezierCurveTo(10, ay + 14, -8, ay + 26, 0, ay + 44); ctx.moveTo(-18, ay + 26); ctx.lineTo(0, ay + 46); ctx.lineTo(18, ay + 26); ctx.stroke();
        ctx.restore();
      }
      if (st === 'tagLine') {
        const al = inOut(t, a, b, .3, .1), lines = s.split('|'), k = easeOut(kk(t, a, a + .4));
        ctx.save(); ctx.globalAlpha *= al; ctx.fillStyle = 'rgba(16,9,24,.78)'; rrect(G.cx - 400, G.end.tagY - 52, 800, 124, 20); ctx.fill();
        lines.forEach((l, i) => text(l, G.cx, G.end.tagY + i * 54 + (1 - k) * 10, { font: SAT(44, 700), align: 'center', color: CREAM }));
        ctx.restore();
      }
    }
  }
  function memeBand(t, s) {
    const mb = S.memeBand(t); if (!mb) return; const cols = s.split('||').map(c => c.split('|'));
    const y = G.meme.y, h = G.meme.h, fold = mb.out;
    ctx.save(); ctx.translate(G.cx, y - h / 2); ctx.scale(1, 1 - fold); ctx.translate(-G.cx, -(y - h / 2));   // folds up like a paper flap
    ctx.shadowColor = 'rgba(10,4,2,.5)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8; ctx.fillStyle = PAPER; ctx.fillRect(28, y - h / 2, 1024, h); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(26,20,38,.65)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(G.cx, y - h / 2 + 18); ctx.lineTo(G.cx, y + h / 2 - 18); ctx.stroke();
    cols.forEach((c, i) => { const x = i ? G.meme.xR : G.meme.xL, z1 = 50, z2 = Math.min(84, Math.floor(84 * 450 / Math.max(1, lineW(c[1], SAT(84)))));
      text(c[0], x, y - 20, { font: SAT(z1, 700), align: 'center', color: INK }); text(c[1], x, y + 62, { font: SAT(z2), align: 'center', color: i ? ORANGE : INK }); });
    ctx.restore();
  }
  function roles(t, a, b, id, s) {
    if (id !== 'role1') return;                               // the two sentences share one panel; role2's lines appear on their word
    const R2 = S.TEXTS().find(q => q[2] === 'role2'), lines = s.split('|').concat(R2[3].split('|'));
    const zs = sizes(lines, 64, 920), lh = zs.map(z => z * 1.16), g2 = easeOut(kk(t, R2[0] - .05, R2[0] + .2));
    const H0 = lh[0] + lh[1] + (lh[2] + lh[3]) * g2 + 52, Hf = lh.reduce((p, q) => p + q, 0) + 52;   // the panel grows when line 2 comes
    const w = Math.max(...lines.map((l, i) => lineW(l, SAT(zs[i])))) + 90, al = inOut(t, a, b, .2, .2);
    ctx.save(); ctx.translate(G.cx, G.top.y - (Hf - H0) / 2); panel(w, H0, 'cream', al);
    let yy = -H0 / 2 + 26;
    lines.forEach((l, i) => { yy += lh[i]; const la = i < 2 ? easeOut(kk(t, a, a + .2)) : easeOut(kk(t, R2[0], R2[0] + .2)); if (la <= 0) return;
      ctx.save(); ctx.globalAlpha *= al * la; ctx.translate(0, (1 - la) * 14); richLine(l, 0, yy - zs[i] * .2, SAT(zs[i]), INK, i < 2 ? AMBER_INK : VIOL_D); ctx.restore(); });
    ctx.restore();
  }
  function chipSeries() {
    const x = G.chip.x, y = G.chip.y, f1 = SAT(36), a = 'JE SAVAIS PAS.', b = '3/5';
    ctx.save(); ctx.font = f1; const w1 = ctx.measureText(a).width, w2 = ctx.measureText(b).width, h = 62, w = w1 + w2 + 92;
    ctx.shadowColor = 'rgba(10,4,2,.45)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5; ctx.fillStyle = CREAM; rrect(x, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(a, x + 26, y + 2);
    ctx.fillStyle = 'rgba(26,20,38,.45)'; ctx.beginPath(); ctx.arc(x + 26 + w1 + 20, y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = ORANGE; ctx.fillText(b, x + 26 + w1 + 40, y + 2); ctx.restore();
  }
  function serviceLine(l, x, y) {
    // « → » drawn as a shape (font-safe): split around it
    const f = SAT(46, 700), parts = l.split('→');
    ctx.save(); ctx.font = f; const aw = 48; const ws = parts.map(p => ctx.measureText(p).width); const tot = ws.reduce((q, v) => q + v, 0) + (parts.length - 1) * aw;
    let cx = x - tot / 2; ctx.fillStyle = CREAM; ctx.textBaseline = 'middle';
    parts.forEach((p, i) => { ctx.fillText(p, cx, y); cx += ws[i]; if (i < parts.length - 1) { ctx.strokeStyle = CREAM; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 8, y); ctx.lineTo(cx + aw - 10, y); ctx.moveTo(cx + aw - 22, y - 11); ctx.lineTo(cx + aw - 9, y); ctx.lineTo(cx + aw - 22, y + 11); ctx.stroke(); cx += aw; } });
    ctx.restore();
  }
  return { world, screen, pill, stamp, block, chipSeries };
})();
function TY_world(t, L) { TY.world(t, L); }
function TY_draw(t, L) { TY.screen(t, L); }

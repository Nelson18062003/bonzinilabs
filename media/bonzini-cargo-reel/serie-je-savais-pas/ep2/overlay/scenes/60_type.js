'use strict';
// =============================================================================================
// « TU PAIES DE L'AIR. » — type (adapted from « PAS REÇU. » 60_type.js to the Kraft & Fil day table).
//   TY_world(t, L)  inside the camera: speaker pills that follow their plate (TOI amber, LE BATEAU grey), and the world
//                   texts a module has not taken over yet (« AU m³ » stamp on the carton, AVANT / APRÈS, the readout
//                   « VOLUME : • m³ », « MESURÉ ✓ », the hand-written tag line on the loop carton).
//   TY_draw(t, L)   screen space: series chip « JE SAVAIS PAS. · 2/5 », the fixed pill « CHEZ TON FOURNISSEUR », the
//                   formula, the key-sentence captions (torn paper strips, emphasis in orange), the « ENSUITE : » band,
//                   the end card (logo + name + service line, stamp « MAINTENANT, TU SAIS. », CTA pill + drawn arrow).
// Every text comes from SCORE.TEXTS() = [t0, t1, id, text, style, takeover]; when window[takeover] exists the module
// draws it and this layer skips it. '|' = line break, *…* = emphasis (orange).
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, T = S.T, A = S.A, kk = S.kk, ease = S.ease, easeOut = S.easeOut;
  const CREAM = '#FFF6E8', PAPER = '#FBF6EC', INK = '#231629', ORANGE = '#FE560D', AMBER = '#F3A745', VIOL = '#7B4BFF', VIOL_D = '#5B2BDF',
    GREY = '#6B7380', KRAFT = '#D2AB78', KRAFT_T = 'rgba(205,160,104,.92)';
  const has = n => typeof window[n] === 'function';
  const textsAt = t => S.TEXTS().filter(([a, b, , , , own]) => t >= a && t < b && !(own && has(own)));
  const inOut = (t, a, b, fi = .12, fo = .12) => Math.min(easeOut(kk(t, a, a + fi)), 1 - kk(t, b - fo, b));
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;

  // ---------- helpers ----------
  function pill(x, y, label, fill, color, a, size = 44, o = {}) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.font = SAT(size); ctx.letterSpacing = (o.ls || 0) + 'px';
    const w = ctx.measureText(label).width + size * 1.1, h = size + 26;
    ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.s) ctx.scale(o.s, o.s);
    ctx.shadowColor = 'rgba(60,32,12,.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
    ctx.fillStyle = fill; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 4; ctx.setLineDash(o.dash || []); rrect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h / 2 - 5); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2);
    ctx.restore();
    return w;
  }
  /** rich line: segments split on *…* (odd = emphasis) */
  const segs = l => l.split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
  function lineW(l, f) { ctx.save(); ctx.font = f; let w = 0; for (const q of segs(l)) w += ctx.measureText(q.s).width; ctx.restore(); return w; }
  function richLine(l, x, y, f, col, emph, align = 'center') {
    const w = lineW(l, f); let cx = align === 'center' ? x - w / 2 : x;
    ctx.save(); ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (const q of segs(l)) { ctx.fillStyle = q.e ? emph : col; ctx.fillText(q.s, cx, y); cx += ctx.measureText(q.s).width; }
    ctx.restore();
  }
  /** a torn paper strip (Kraft & Fil caption) centred at (0,0) */
  function strip(w, h, seed, fill = PAPER) {
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 9;
    ctx.fillStyle = fill; ctx.beginPath(); const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 3 + seed, 3, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 9 + seed, 3, 12);
    ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = KRAFT_T; at(-w / 2 + 18, -h / 2 + 6, -.55, 1, 1, () => ctx.fillRect(-48, -17, 96, 34)); at(w / 2 - 18, -h / 2 + 6, .55, 1, 1, () => ctx.fillRect(-48, -17, 96, 34));
  }
  /** fit a block of lines into maxW: returns the font size (≤ size, ≥ min) */
  function fit(lines, size, maxW, min = 46, w = 900) { let z = size; for (const l of lines) { const lw = lineW(l, SAT(size, w)); if (lw > maxW) z = Math.min(z, size * maxW / lw); } return Math.max(min, Math.floor(z)); }
  /** cached starved-ink stamp sprite (box, 1–2 lines) */
  function stampSprite(key, lines, size, color, fam = 'Satoshi', wght = 900) {
    const id = 'tystamp_' + key + size; const c = makeCanvasCached(id, 1100, Math.round(size * 1.15 * lines.length + 120)), g = c.getContext('2d');
    if (!c._done) {
      g.font = `${wght} ${size}px ${fam}`; const lw = Math.max(...lines.map(l => g.measureText(l).width)), lh = size * 1.08, bh = lh * lines.length + 40, bw = lw + 70;
      const x0 = (1100 - bw) / 2, y0 = (c.height - bh) / 2;
      g.strokeStyle = color; g.lineWidth = Math.max(7, size * .08); rrectOn(g, x0, y0, bw, bh, 14); g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, 550, y0 + 20 + lh * (i + .5) + size * .04));
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { g.globalAlpha = .25 + rnd(i * 1.7 + size) * .6; g.beginPath(); g.arc(x0 + rnd(i * 1.1 + 3) * bw, y0 + rnd(i * 2.9 + 1) * bh, .6 + rnd(i * 3.3) * 2.4, 0, 7); g.fill(); }
      c._done = true; c._bw = bw; c._bh = bh;
    }
    return c;
  }
  function stamp(key, lines, x, y, size, color, k, a = 1, rot = -.07) {
    if (k <= 0 || a <= 0) return;
    const c = stampSprite(key, lines, size, color), sc = k < 1 ? 1.7 - .7 * easeOut(k) : 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha *= a * Math.min(1, k * 2); ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(c, -550, -c.height / 2); ctx.restore();
  }
  function check(x, y, s, col, lw = 10) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - s * .45, y); ctx.lineTo(x - s * .1, y + s * .35); ctx.lineTo(x + s * .5, y - s * .4); ctx.stroke(); ctx.restore(); }

  // ---------- world space ----------
  function world(t, L) {
    for (const p of S.pills(t)) {
      if (p.fixed) continue;
      if (p.who === 'toi') pill(p.x, p.y, 'TOI', AMBER, INK, p.a ?? 1, 46);
      if (p.who === 'bateau') pill(p.x, p.y, 'LE BATEAU', GREY, CREAM, p.a ?? 1, 44, { rot: p.rot });
    }
    const hero = S.heroCarton(t), loop = S.loopCarton(t);
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'stampM3' && hero) {
        const g = S.cartonGeo(hero), j = S.cartonJit(hero, t), k = hero.m3k, al = 1 - kk(t, A.flank - .05, A.flank + .15);
        stamp('m3', [s], g.cx + j.x, g.cy + j.y, 104, ORANGE, k, al, -.09 + j.r);
      }
      if (st === 'splitLabels') {
        const sp = S.split(t); if (!sp) continue; const [l1, l2] = s.split('|');
        for (const [lab, x, col] of [[l1, G.split.L, INK], [l2, G.split.R, ORANGE]]) {
          at(x, G.split.labelY - (1 - sp.labels) * 40, x < G.cx ? -.03 : .03, 1, 1, () => { ctx.globalAlpha *= sp.labels; strip(330, 116, x < G.cx ? 4 : 8); text(lab, 0, 34, { font: `900 92px Stencil`, align: 'center', color: col, ls: 4 }); });
        }
      }
      if (st === 'readout') {
        const b = S.bz(t), k = b ? b.readout : 0, al = inOut(t, a, b ? A.endcard : a + 1, .01, .2) * (b ? 1 - b.out : 0);
        if (k <= 0 || al <= 0) continue;
        at(G.bz.readout.x, G.bz.readout.y - (1 - k) * 60, -.025, 1, 1, () => {
          ctx.globalAlpha *= al; strip(470, 128, 21, CREAM);
          const f = `800 52px Martian`; ctx.font = f; const w1 = ctx.measureText('VOLUME : ').width, w2 = ctx.measureText(' m³').width, dw = 34, x0 = -(w1 + dw + w2) / 2;
          text('VOLUME : ', x0, 20, { font: f, color: INK }); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x0 + w1 + dw / 2, 2, 12, 0, 7); ctx.fill(); text(' m³', x0 + w1 + dw, 20, { font: f, color: INK });
        });
      }
      if (st === 'stampCheck') {
        const b = S.bz(t); if (!b) continue;
        const k = b.measured, x = G.bz.readout.x + 150, y = G.bz.readout.y + 118;
        stamp('mesure', [s + '    '], x, y, 84, VIOL_D, k, 1 - b.out, -.1);
        if (k >= 1) at(x, y, -.1, 1, 1, () => check(178, -4, 64, VIOL_D, 12));
      }
      if (st === 'tagHand' && loop) {
        const g = S.cartonGeo(loop), lines = s.split('|'), k = loop.writeTag, al = inOut(t, a, b, .05, .12);
        const j = S.cartonJit(loop, t); ctx.save(); ctx.globalAlpha *= al; ctx.translate(g.cx + j.x, g.cy - 50 * g.s + j.y); ctx.rotate(-.03 + j.r);
        lines.forEach((l, i) => { const kl = kk(k, i / lines.length, (i + 1) / lines.length); if (kl <= 0) return; ctx.save(); ctx.beginPath(); ctx.rect(-300, i * 64 - 56, 600 * kl, 76); ctx.clip();
          text(l, 0, i * 64, { font: `800 50px Shantell`, align: 'center', color: INK }); ctx.restore(); });
        ctx.restore();
      }
    }
  }

  // ---------- screen space ----------
  function screen(t, L) {
    // series chip (whole film, the loop included)
    chipSeries();
    // the fixed pill of the repack, then it drops off at ENSUITE
    for (const p of S.pills(t)) if (p.fixed) pill(p.x, p.y, 'CHEZ TON FOURNISSEUR', KRAFT, INK, p.a, 44, { rot: p.rot, border: 'rgba(35,22,41,.45)', dash: [10, 7] });
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'formula') formulaBlock(t, s);
      if (st === 'formulaSub') { const f = S.formula(t); if (f) { ctx.save(); ctx.globalAlpha *= f.a; const k = f.sub; ctx.beginPath(); ctx.rect(540 - 300, 586, 600 * k, 90); ctx.clip();
        text(s, 540, 646, { font: `800 62px Shantell`, align: 'center', color: INK }); ctx.restore();
        if (k > 0 && k < 1) marker(540 - 230 + 460 * k, 640, 2.7, INK); } }
      if (st === 'caption' || st === 'captionBZ') caption(t, a, b, id, s, st === 'captionBZ' ? G.capBZY : G.capY);
      if (st === 'band') {
        const bd = S.band(t); if (!bd) continue; const x = -W * (1 - bd.in) + W * bd.out;
        ctx.save(); ctx.translate(G.cx + x, 960); ctx.rotate(-.03);
        ctx.shadowColor = 'rgba(60,32,12,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillStyle = TEX.kraft; ctx.fillRect(-W, -110, 2 * W, 220); ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255,240,210,.25)'; ctx.fillRect(-W, -110, 2 * W, 8); ctx.fillStyle = 'rgba(90,60,30,.25)'; ctx.fillRect(-W, 102, 2 * W, 8);
        text(s, 0, 48, { font: SAT(132), align: 'center', color: INK, ls: 2 }); ctx.restore();
      }
      if (st === 'brand') {
        const al = inOut(t, a, b, .3, .1), k = easeOut(kk(t, a, a + .35));
        ctx.save(); ctx.globalAlpha *= al; ctx.font = '800 64px DMSans'; const tw = ctx.measureText(s).width, lg = 112, gap = 22, x0 = G.cx - (lg + gap + tw) / 2;
        drawLogo(x0 + lg / 2, G.end.logoY - 4 - 16 * (1 - k), lg, { alpha: k });
        text(s, x0 + lg + gap, G.end.logoY + 22, { font: '800 64px DMSans', color: INK }); ctx.restore();
      }
      if (st === 'service') {
        const al = inOut(t, a, b, .3, .1), lines = s.split('|');
        ctx.save(); ctx.globalAlpha *= al;
        lines.forEach((l, i) => serviceLine(l, G.cx, G.end.serviceY + i * 58 + (1 - easeOut(kk(t, a, a + .3))) * 16, i === 1));
        ctx.restore();
      }
      if (st === 'stampEnd') stamp('end', s.split('|'), G.cx, G.end.stampY, 112, ORANGE, kk(t, a, a + .12), inOut(t, a, b, .01, .1), -.06);
      if (st === 'cta') {
        const k = kk(t, a, a + .25), bounce = 1 + .12 * Math.exp(-(t - a) * 6) * Math.sin((t - a) * 18), al = 1 - kk(t, b - .1, b);
        ctx.save(); ctx.translate(G.end.ctaX, G.end.ctaY); ctx.scale(bounce * easeOut(k), bounce * easeOut(k)); ctx.globalAlpha *= al;
        pill(0, 0, s, AMBER, INK, 1, 56);
        ctx.strokeStyle = AMBER; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';          // drawn arrow → the comments
        const ay = 62 + 6 * Math.sin(t * 8); ctx.beginPath(); ctx.moveTo(0, ay); ctx.bezierCurveTo(10, ay + 14, -8, ay + 26, 0, ay + 44); ctx.moveTo(-18, ay + 26); ctx.lineTo(0, ay + 46); ctx.lineTo(18, ay + 26); ctx.stroke();
        ctx.restore();
      }
    }
  }
  function chipSeries() {
    const x = G.chip.x, y = G.chip.y, f1 = SAT(36), a = 'JE SAVAIS PAS.', b = '2/5';
    ctx.save(); ctx.font = f1; const w1 = ctx.measureText(a).width, w2 = ctx.measureText(b).width, h = 62, w = w1 + w2 + 92;
    ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5; ctx.fillStyle = INK; rrect(x, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = CREAM; ctx.textBaseline = 'middle'; ctx.fillText(a, x + 26, y + 2);
    ctx.fillStyle = 'rgba(255,246,232,.55)'; ctx.beginPath(); ctx.arc(x + 26 + w1 + 20, y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = ORANGE; ctx.fillText(b, x + 26 + w1 + 40, y + 2); ctx.restore();
  }
  function formulaBlock(t, s) {
    const f = S.formula(t); if (!f) return; const lines = s.split('|');
    ctx.save(); ctx.globalAlpha *= f.a;
    const y0 = 324, lh = 100;
    if (f.box > 0) { ctx.save(); ctx.globalAlpha *= f.box; ctx.strokeStyle = ORANGE; ctx.lineWidth = 9; rrect(540 - 330, y0 - 98, 660, lh * 3 + 36, 18); ctx.stroke(); ctx.restore(); }
    lines.forEach((l, i) => { const k = f.words[i]; if (k <= 0) return; const sc = 1.5 - .5 * easeOut(k);
      ctx.save(); ctx.translate(540, y0 + i * lh); ctx.scale(sc, sc); ctx.globalAlpha *= Math.min(1, k * 2);
      text(l, 0, 0, { font: `900 104px Stencil`, align: 'center', color: ORANGE, ls: 5 }); ctx.restore(); });
    ctx.restore();
  }
  // QA (stage 3): a line starting with '^' is a BIG line (title size, ≥ 96 px) — the key words of the PHRASE-test
  // (« DES CARTONS / BIEN REMPLIS. ») are written as a title, not as body text. While the fixed pill « CHEZ TON
  // FOURNISSEUR » is up, the caption's top stays under it (y ≥ 312).
  function caption(t, a, b, id, s, cy) {
    const raw = s.split('|'), big = raw.map(l => l[0] === '^'), lines = raw.map(l => l.replace(/^\^/, ''));
    const al = inOut(t, a, b, .14, .14), seed = id.length * 7 + id.charCodeAt(0);
    const sm = lines.filter((l, i) => !big[i]), bg = lines.filter((l, i) => big[i]);
    const z = sm.length ? fit(sm, 76, 860) : 76, zb = bg.length ? fit(bg, 116, 860, 96) : 0;
    const sz = lines.map((l, i) => big[i] ? zb : z), lhs = sz.map((q, i) => q * (big[i] ? 1.04 : 1.14));
    const h = lhs.reduce((p, q) => p + q, 0) + 64, w = Math.max(...lines.map((l, i) => lineW(l, SAT(sz[i])))) + 96;
    if (S.pills(t).some(p => p.fixed && p.a > .01)) cy = Math.max(cy, 312 + h / 2);
    const rise = (1 - easeOut(kk(t, a, a + .18))) * 26 - kk(t, b - .14, b) * 20, rot = (rnd(seed) - .5) * .035;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(G.cx, cy + rise); ctx.rotate(rot);
    strip(w, h, seed);
    let y = -h / 2 + 32;
    lines.forEach((l, i) => { richLine(l, 0, y + lhs[i] / 2 + sz[i] * .36, SAT(sz[i]), INK, ORANGE); y += lhs[i]; });
    ctx.restore();
  }
  function serviceLine(l, x, y, second) {
    // « → » drawn as a shape (font-safe): split around it
    const f = SAT(44, 700), parts = l.split('→');
    ctx.save(); ctx.font = f; const aw = 46; const ws = parts.map(p => ctx.measureText(p).width); const tot = ws.reduce((q, v) => q + v, 0) + (parts.length - 1) * aw;
    let cx = x - tot / 2; ctx.fillStyle = INK; ctx.textBaseline = 'middle';
    parts.forEach((p, i) => { ctx.fillText(p, cx, y); cx += ws[i]; if (i < parts.length - 1) { ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 8, y); ctx.lineTo(cx + aw - 10, y); ctx.moveTo(cx + aw - 22, y - 11); ctx.lineTo(cx + aw - 9, y); ctx.lineTo(cx + aw - 22, y + 11); ctx.stroke(); cx += aw; } });
    ctx.restore();
  }
  return { world, screen, pill, stamp, caption, chipSeries };
})();
function TY_world(t, L) { TY.world(t, L); }
function TY_draw(t, L) { TY.screen(t, L); }

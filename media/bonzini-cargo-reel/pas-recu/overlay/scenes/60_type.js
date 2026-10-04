'use strict';
// =============================================================================================
// « PAS REÇU. » — type. TY_world(t, L): inside the camera (speaker pills that follow their plate, day stamps, the
// shop label, the « gars » line). TY_draw(t, L): screen space (narration bands, end card, call to comment).
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, T = S.T, kk = S.kk, ease = S.ease, easeOut = S.easeOut;
  const CREAM = '#FFF6E8', INK = '#1A1426', ORANGE = '#FE560D', AMBER = '#F3A745', VIOL = '#7B4BFF', VIOL_D = '#5B2BDF', STEEL = '#5E6878';
  const textsAt = t => S.TEXTS().filter(([a, b]) => t >= a && t < b);
  const inOut = (t, a, b, fi = .12, fo = .12) => Math.min(easeOut(kk(t, a, a + fi)), 1 - kk(t, b - fo, b));
  const jj = (i, t, amp) => { const n = Math.floor(t * 15); return { x: (rnd(i * 7.3 + n * 1.9) - .5) * 2 * amp, y: (rnd(i * 3.1 + n * 2.7) - .5) * 2 * amp }; };

  function pill(x, y, label, fill, color, a, size = 34) {
    ctx.save(); ctx.globalAlpha *= a; ctx.font = `900 ${size}px Satoshi`;
    const w = ctx.measureText(label).width + 40, h = size + 22;
    ctx.shadowColor = 'rgba(8,4,18,.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = fill; rrect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 2);
    ctx.restore();
  }
  function plate(cx, cy, w, h, a, fill = 'rgba(12,7,26,.80)') {
    ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = fill; rrect(cx - w / 2, cy - h / 2, w, h, 26); ctx.fill(); ctx.restore();
  }
  function wrapLines(s, font, maxW) {
    if (s.includes('|')) return s.split('|');
    ctx.font = font; if (ctx.measureText(s).width <= maxW) return [s];
    const ws = s.split(' '); let best = null;
    for (let i = 1; i < ws.length; i++) { const a = ws.slice(0, i).join(' '), b = ws.slice(i).join(' '); const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || w < best.w) best = { w, l: [a, b] }; }
    return best.l;
  }
  // a stamped word (orange, starved ink, slightly crooked) — cached sprite per word
  function stampWord(s, x, y, size, a, k, rot = -.08) {
    const c = makeCanvasCached('ty_stamp_' + s + size, 760, size * 2 + 20), g = c.getContext('2d');
    if (!c._done) {
      g.font = `900 ${size}px Satoshi`; const w = g.measureText(s).width + 44, h = size + 30, x0 = (760 - w) / 2, y0 = 10;
      g.strokeStyle = ORANGE; g.lineWidth = 7; rrectOn(g, x0, y0, w, h, 10); g.stroke();
      g.fillStyle = ORANGE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 380, y0 + h / 2 + 3);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 700; i++) { g.globalAlpha = .3 + rnd(i * 1.7 + size) * .7; g.beginPath(); g.arc(x0 + rnd(i * 1.1) * w, y0 + rnd(i * 2.9) * h, .6 + rnd(i * 3.3) * 2.2, 0, 7); g.fill(); }
      c._done = true; c._h = h;
    }
    const sc = 1.6 - .6 * easeOut(k);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha *= a * Math.min(1, k * 2);
    ctx.drawImage(c, -380, -(c._h / 2 + 10)); ctx.restore();
  }

  // ---------- world space ----------
  function world(t, L) {
    // the shop label, pinned on the cloth (kraft tag)
    for (const [a, b, id, s] of textsAt(t)) if (id === 'label') {
      const al = inOut(t, a, b, .2, .4), x = G.label.x, y = G.label.y;
      ctx.save(); ctx.translate(x, y); ctx.rotate(.05); ctx.globalAlpha = al;
      ctx.font = '700 38px Satoshi'; const w = ctx.measureText(s).width + 52, h = 70;
      ctx.shadowColor = 'rgba(8,4,18,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
      ctx.fillStyle = lit('#D2AB78', x, y, L, .3); rrect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.fillStyle = lit('#3B2412', x, y, L, .3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 3);
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(-w / 2 + 16, -h / 2 + 14, 8, 0, 7); ctx.fill();   // push pin
      ctx.restore();
    }
    // the day stamp (only in the « before »)
    const d = S.day(t);
    if (d) stampWord(d.s, G.days.x, G.days.y, 74, d.a, kk(t, d.t0, d.t0 + .1), -.09);
    // speaker pills
    for (const p of S.pills(t)) {
      if (p.who === 'toi') pill(p.x, p.y, 'TOI', AMBER, INK, p.a ?? 1);
      else pill(p.x, p.y, 'TON FOURNISSEUR · CHINE', STEEL, CREAM, p.a ?? 1);
    }
    // « …LE GARS M'A DIT QUE C'EST FAIT. » — small, trembling, under the shrunken amber plate
    for (const [a, b, id, s] of textsAt(t)) if (id === 'gars') {
      const A = S.amber(t), al = inOut(t, a, b, .2, .15), y = (A ? A.y + 178 : 1420);
      ctx.save(); ctx.globalAlpha = al; ctx.font = '700 50px Satoshi'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = wrapLines(s, '700 50px Satoshi', 820), w = Math.max(...lines.map(l => ctx.measureText(l).width));
      plate(G.cx, y + (lines.length - 1) * 30, w + 56, lines.length * 60 + 34, .85);
      lines.forEach((l, i) => { const o = jj(i + 3, t, 1.6); ctx.fillStyle = CREAM; ctx.fillText(l, G.cx + o.x, y + i * 60 + o.y); });
      ctx.restore();
    }
  }

  // ---------- screen space ----------
  function screen(t, L) {
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'bandDark' || st === 'bandCream') {
        const al = inOut(t, a, b, .14, .14), pop = 1.1 - .1 * easeOut(kk(t, a, a + .16));
        const font = '900 70px Satoshi', lines = wrapLines(s, font, 860);
        ctx.save(); ctx.translate(G.cx, G.band.y); ctx.scale(pop, pop); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)), lh = 80, h = lines.length * lh + 44;
        if (st === 'bandCream') { ctx.save(); ctx.globalAlpha = al; ctx.shadowColor = 'rgba(8,4,18,.6)'; ctx.shadowBlur = 24; ctx.fillStyle = CREAM; rrect(-w / 2 - 36, -h / 2, w + 72, h, 26); ctx.fill(); ctx.restore(); }
        else plate(0, 0, w + 72, h, al * .95);
        ctx.globalAlpha = al; ctx.fillStyle = st === 'bandCream' ? VIOL_D : CREAM;
        lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh + 3));
        ctx.restore();
      }
      if (id === 'slogan') {
        const al = inOut(t, a, b, .2, .1);
        // logo + wordmark
        ctx.save(); ctx.globalAlpha = easeOut(kk(t, a, a + .3));
        const lk = easeOut(kk(t, a, a + .35)); drawLogo(330, G.logo.y + 8 - 20 * (1 - lk), 104, { alpha: lk });
        ctx.font = '800 64px DMSans'; ctx.fillStyle = CREAM; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Bonzini Labs', 402, G.logo.y + 2);
        ctx.restore();
        // slogan stamped word by word
        const lines = s.split('|'); let wi = 0;
        ctx.save(); ctx.font = '900 60px Satoshi'; ctx.textBaseline = 'middle';
        lines.forEach((l, li) => {
          const words = l.split(' '); const total = ctx.measureText(l).width; let x = G.cx - total / 2;
          for (const wd of words) {
            const t0 = a + .3 + wi * .07, k = easeOut(kk(t, t0, t0 + .12)); const ww = ctx.measureText(wd + ' ').width;
            ctx.globalAlpha = al * k; ctx.fillStyle = li === lines.length - 1 ? AMBER : CREAM; ctx.textAlign = 'left';
            ctx.fillText(wd, x, G.slogan.y + li * 70 + (1 - k) * 14); x += ww; wi++;
          }
        });
        ctx.restore();
      }
      if (id === 'url') { ctx.save(); ctx.globalAlpha = inOut(t, a, b, .2, .1) * .9; ctx.font = '500 32px Martian'; ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, G.cx, G.slogan.y + 3 * 70 + 6); ctx.restore(); }
      if (id === 'cta') {
        const k = kk(t, a, a + .25), bounce = 1 + .12 * Math.exp(-(t - a) * 6) * Math.sin((t - a) * 18);
        ctx.save(); ctx.translate(G.cx, G.cta.y); ctx.scale(bounce * easeOut(k), bounce * easeOut(k));
        pill(0, 0, s, AMBER, INK, 1, 52);
        // hand-drawn arrow pointing down to the comments
        ctx.strokeStyle = AMBER; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const ay = 62 + 6 * Math.sin(t * 8); ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(0, ay + 38); ctx.moveTo(-16, ay + 22); ctx.lineTo(0, ay + 40); ctx.lineTo(16, ay + 22); ctx.stroke();
        ctx.restore();
      }
    }
  }
  return { world, screen };
})();
function TY_world(t, L) { TY.world(t, L); }
function TY_draw(t, L) { TY.screen(t, L); }

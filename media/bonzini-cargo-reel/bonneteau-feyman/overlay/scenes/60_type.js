'use strict';
// =============================================================================================
// Kinetic type (band y 1300-1500, x <= 960) + the brand moment (12.0-14.0 s): checklist, headline, signature.
// =============================================================================================
(function () {
  const S = window.SCORE, kk = S.kk, ease = S.ease, easeOut = S.easeOut;
  const CREAM = '#FFF6E8', ORANGE = '#FE560D', AMBER = '#F3A745', VIOL = '#A947FE', BAND_Y = 1395, MAXW = 800, CX = 525;
  const STY = {
    order: { f: '900 76px Satoshi', lh: 84 }, tease: { f: '700 66px Brico', lh: 76 },
    stamp: { f: '900 104px Satoshi', lh: 110 }, order88: { f: '900 88px Satoshi', lh: 96 }, shake: { f: '800 80px Brico', lh: 88 }, shake2: { f: '900 108px Satoshi', lh: 112 },
  };
  function wrap(s, fnt) {
    ctx.font = fnt; if (ctx.measureText(s).width <= MAXW) return [s];
    const words = s.split(' '); let best = null;
    for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || w < best.w) best = { w, l: [a, b] }; }
    return best.l;
  }
  function plate(x, y, w, h, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(12,7,26,.74)'; rrect(x - w / 2, y - h / 2, w, h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,232,.10)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  // jitter that changes every 2 frames (stop-motion nervousness), deterministic
  const jj = (i, f, amp) => ({ x: (rnd(i * 7.3 + Math.floor(f / 2) * 1.9) - .5) * 2 * amp, y: (rnd(i * 3.1 + Math.floor(f / 2) * 2.7) - .5) * 2 * amp, r: (rnd(i * 5.9 + Math.floor(f / 2) * .7) - .5) * .06 * amp / 6 });

  function lineText(s, x, y, st, f, a, o = {}) {
    ctx.font = STY[st].f; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(s).width; let cx = x - w / 2;
    if (st === 'shake' || st === 'shake2') {          // letter by letter, trembling
      const amp = st === 'shake2' ? 6 : 3;
      for (let i = 0; i < s.length; i++) { const ch = s[i], cw = ctx.measureText(ch).width, d = jj(i + (o.seed || 0), f, amp);
        ctx.save(); ctx.translate(cx + cw / 2 + d.x, y + d.y); ctx.rotate(d.r); ctx.globalAlpha = a;
        ctx.fillStyle = st === 'shake2' && (Math.floor(f / 2) + i) % 5 === 0 ? ORANGE : CREAM; ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore(); cx += cw; }
      return w;
    }
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = o.color || CREAM; ctx.textAlign = 'center'; ctx.fillText(s, x, y); ctx.restore();
    return w;
  }

  function stamp(s, f, f0, f1) {                       // « TU VAS PERDRE. » — slammed rubber stamp, a bit crooked
    const k = easeOut(kk(f, f0, f0 + 3)), out = 1 - kk(f, f1 - 3, f1);
    const sc = 1.9 - .9 * k, a = Math.min(1, k * 1.4) * out;
    ctx.save(); ctx.translate(CX, BAND_Y); ctx.rotate(-.07); ctx.scale(sc, sc); ctx.globalAlpha = a;
    ctx.font = STY.stamp.f; const w = ctx.measureText(s).width + 70, h = 150;
    const c = makeCanvasCached('stamp_' + s, Math.ceil(w + 20), h + 20), g = c.getContext('2d');
    if (!c._done) {
      g.translate(10, 10); g.strokeStyle = ORANGE; g.lineWidth = 9; rrectOn(g, 4, 4, w - 8, h - 8, 14); g.stroke();
      g.font = STY.stamp.f; g.fillStyle = ORANGE; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, w / 2, h / 2 + 4);
      g.globalCompositeOperation = 'destination-out';     // starved ink
      for (let i = 0; i < 900; i++) { const r = .6 + rnd(i * 3.3) * 2.4; g.globalAlpha = .35 + rnd(i * 1.7) * .65; g.beginPath(); g.arc(rnd(i * 1.1) * w, rnd(i * 2.9) * h, r, 0, 7); g.fill(); }
      c._done = true;
    }
    ctx.shadowColor = 'rgba(254,86,13,.45)'; ctx.shadowBlur = 24;
    ctx.fillStyle = 'rgba(12,7,26,.62)'; rrect(-w / 2, -h / 2, w, h, 16); ctx.fill(); ctx.shadowBlur = 0;
    ctx.drawImage(c, -w / 2 - 10, -h / 2 - 10);
    ctx.restore();
  }

  function caption(f) {
    for (const [f0, f1, s, st] of S.TEXTS) {
      if (f < f0 || f > f1) continue;
      if (st === 'stamp') { stamp(s, f, f0, f1 + 1); continue; }
      const inK = easeOut(kk(f, f0, f0 + (st === 'order' ? 3 : 5))), out = 1 - kk(f, f1 - 2, f1 + 1), a = Math.min(inK, out);
      const lines = wrap(s, STY[st].f), lh = STY[st].lh;
      ctx.font = STY[st].f; const w = Math.max(...lines.map(l => ctx.measureText(l).width));
      const pop = st === 'order' ? 1.18 - .18 * inK : 1, dy = st === 'tease' ? (1 - inK) * 22 : 0;
      ctx.save(); ctx.translate(CX, BAND_Y + dy); ctx.scale(pop, pop);
      plate(0, 0, w + 72, lines.length * lh + 46, a * .95);
      lines.forEach((l, i) => lineText(l, 0, (i - (lines.length - 1) / 2) * lh + 3, st, f, a, { seed: i * 31 }));
      ctx.restore();
    }
  }

  // ---------- brand moment ----------
  const STEPS = ['Paiement créé', 'Fournisseur réglé', 'Preuve de paiement'];
  function brand(f) {
    if (f < 360 || f >= 424) return;
    const vis = Math.min(easeOut(kk(f, 361, 368)), 1 - ease(kk(f, 416, 423)));
    // signature (top)
    ctx.save(); ctx.globalAlpha = vis;
    drawLogo(222, 268, 104);
    ctx.font = '800 54px DMSans'; ctx.fillStyle = CREAM; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Bonzini Labs', 290, 244);
    ctx.font = '500 40px DMSans'; ctx.fillStyle = 'rgba(255,246,232,.80)'; ctx.fillText('& Bonzini Trading Cargo', 290, 298);
    ctx.restore();
    // checklist — one line per container, lit on its ding
    STEPS.forEach((s, i) => {
      const on = easeOut(kk(f, 372 + i * 15, 378 + i * 15)); if (on <= 0) return;
      const y = 448 + i * 104, a = on * vis, x0 = 150;
      ctx.save(); ctx.globalAlpha = a; ctx.translate((1 - on) * -30, 0);
      ctx.fillStyle = 'rgba(26,14,58,.78)'; rrect(x0, y - 42, 750, 84, 42); ctx.fill();
      ctx.strokeStyle = AMBER; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = VIOL; ctx.beginPath(); ctx.arc(x0 + 42, y, 29, 0, 7); ctx.fill();
      ctx.font = '800 36px Stencil'; ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x0 + 42, y + 2);
      ctx.font = '500 44px Martian'; ctx.textAlign = 'left'; ctx.fillStyle = CREAM; ctx.fillText(s, x0 + 92, y + 2);
      ctx.strokeStyle = AMBER; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const p = easeOut(kk(f, 375 + i * 15, 381 + i * 15)); ctx.beginPath(); ctx.moveTo(x0 + 680, y + 2); ctx.lineTo(x0 + 680 + 12 * Math.min(1, p * 2), y + 2 + 12 * Math.min(1, p * 2));
      if (p > .5) ctx.lineTo(x0 + 692 + 22 * (p - .5) * 2, y + 14 - 26 * (p - .5) * 2); ctx.stroke();
      ctx.restore();
    });
    // headline in the band
    const h1 = f < 390 ? ['LE FEYMAN CACHE.'] : ['BONZINI TE MONTRE', 'LA PREUVE.'];
    const f0 = f < 390 ? 361 : 390, f1 = f < 390 ? 389 : 420;
    const a = Math.min(easeOut(kk(f, f0, f0 + 4)), 1 - kk(f, f1 - 3, f1));
    ctx.font = '900 88px Satoshi'; const w = Math.max(...h1.map(l => ctx.measureText(l).width));
    ctx.save(); ctx.translate(CX, BAND_Y); const pop = 1.12 - .12 * easeOut(kk(f, f0, f0 + 4)); ctx.scale(pop, pop);
    plate(0, 0, w + 80, h1.length * 96 + 50, a);
    h1.forEach((l, i) => lineText(l, 0, (i - (h1.length - 1) / 2) * 96 + 3, 'order88', f, a, { color: i === 1 ? AMBER : CREAM }));
    ctx.restore();
  }

  registerScene({ id: 'type', z: 60, draw(t) {
    const f = S.fmod(t * 30);
    caption(f); brand(f);
  } });
})();

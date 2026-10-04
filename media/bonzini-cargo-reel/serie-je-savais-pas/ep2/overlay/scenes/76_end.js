'use strict';
// =============================================================================================
// « TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5) — M2 « Bonzini & end », part 2: the end card (prefix BZ_).
//   BZ_end(st, t, L, space)   st = SCORE.endcard(t) = {k, service, cta, stamp, tag, out}; compose calls it twice:
//     'screen'  the logo (its four pieces snap together) + « Bonzini Trading Cargo » (y G.end.logoY), the verified
//               service lines in a cream panel (y 404 / 462, « → » drawn as a shape), the series' ritual stamp
//               « MAINTENANT, TU SAIS. » (orange, y G.end.stampY, on A.stampEnd), the series' amber CTA pill
//               « Écris [CBM] en commentaire » (bounces once on A.cta) + its hand-drawn orange arrow ↓.
//     'world'   « Tague celui qui / remplit ses cartons / de papier » written in marker on the loop carton's front face
//               (SCORE.loopCarton(t).writeTag), glued to it (cartonJit + st.rot), scaled with it.
//   Takes over the texts 'brand', 'service', 'stampEnd', 'cta', 'tag' (strings read from SCORE.TEXTS()).
//   Everything is gone at A.out (fade A.out − .15 → A.out): the last frames are the trembling carton alone (the loop).
// BZ_ritualStamp / BZ_ctaPill are the series' shared pieces (episode 1, « copy as is »): same stamp, same pill in all 5.
// One local change in BZ_ctaPill: the typing cursor sits 18 px further from the keyword and is thinner, so « CBM| »
// can never read « CBMI » on a phone (a 3-letter word ending in a vertical stroke).
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, kk = S.kk, eOut = S.easeOut, spr = S.spr, cl = S.cl;
  const B = window.BZ_lib, P = B.P;
  const txt = id => { const r = S.TEXTS().find(q => q[2] === id); return r ? r[3] : ''; };
  const fadeOut = t => 1 - kk(t, A.out - .15, A.out);

  // the soft cream halo behind the brand block (keeps it crisp on the violet-dimmed table)
  const halo = () => B.sprite('endHalo', 1080, 560, () => {
    ctx.save(); ctx.scale(1, .42); const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 560);
    g.addColorStop(0, 'rgba(255,253,246,.92)'); g.addColorStop(.5, 'rgba(255,251,242,.55)'); g.addColorStop(1, 'rgba(255,250,240,0)');
    ctx.fillStyle = g; B.circle(0, 0, 560); ctx.fill(); ctx.restore();
  });
  /** cached torn paper strip (the captions' material) pinned by two violet washi tapes (Bonzini) */
  const paperStrip = (w, h) => B.sprite('endStrip' + Math.round(w) + 'x' + Math.round(h), w + 120, h + 90, () => {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 31, 3, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 37, 3, 12);
    const path = () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); };
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.30)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 20000 + 5; ctx.shadowOffsetY = 9;
    ctx.translate(-20000, 0); path(); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    path(); ctx.fillStyle = '#FBF6EC'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    for (let i = 0; i < 500; i++) { const x = -w / 2 + rnd(i * 1.9 + 4) * w, y = -h / 2 + rnd(i * 2.3 + 8) * h, a = rnd(i * 3.1) * 3, l = 3 + rnd(i * 4.7) * 9;
      ctx.strokeStyle = rnd(i * 5.3) > .5 ? 'rgba(150,115,75,.08)' : 'rgba(255,255,255,.5)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(123,75,255,.80)';                               // pinned at the bottom corners: the brand line stays clear
    at(-w / 2 + 22, h / 2 - 6, .55, 1, 1, () => ctx.fillRect(-46, -15, 92, 30));
    at(w / 2 - 22, h / 2 - 6, -.55, 1, 1, () => ctx.fillRect(-46, -15, 92, 30));
  });
  const PIECES = [['wingTop', -1, -.8, -.9], ['wingBot', -1, .9, .8], ['amber', 1, -.7, .7], ['orange', .9, .9, -.8]];
  const NAME_F = '900 72px DMSans', LOGO = 124, GAP = 24;
  const SERV_F = '800 44px Satoshi', ARW = 50;
  /** a service line, « → » drawn as a shape (font-safe) */
  function serviceLine(l, cx, y, col) {
    const parts = l.split('→'), ws = parts.map(p => measure(p, SERV_F)), tot = ws.reduce((a, b) => a + b, 0) + (parts.length - 1) * ARW;
    let x = cx - tot / 2;
    parts.forEach((p, i) => {
      text(p, x, y, { font: SERV_F, color: col }); x += ws[i];
      if (i < parts.length - 1) { const ay = y - 15; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x + 9, ay); ctx.lineTo(x + ARW - 11, ay); ctx.moveTo(x + ARW - 24, ay - 12); ctx.lineTo(x + ARW - 10, ay); ctx.lineTo(x + ARW - 24, ay + 12); ctx.stroke(); ctx.restore(); x += ARW; }
    });
    return tot;
  }
  function screenPart(st, t, L) {
    const fo = fadeOut(t); if (fo <= 0) return;
    const d = t - (A.endcard + .1);
    ctx.save(); ctx.globalAlpha *= fo;
    // halo
    const hk = eOut(cl(d / .45)); if (hk > 0) { ctx.save(); ctx.globalAlpha *= hk; B.blit(halo(), G.cx, G.end.logoY + 90); ctx.restore(); }
    // the lockup: logo (pieces fly in and snap) + « Bonzini Trading Cargo »
    const name = txt('brand') || 'Bonzini Trading Cargo', nw = measure(name, NAME_F, -1), x0 = G.cx - (LOGO + GAP + nw) / 2, ly = G.end.logoY;
    if (d > 0) {
      const offsets = {};
      PIECES.forEach(([role, dx, dy, r], i) => { const p = cl(spr(d - .04 * i, 12, .62), 0, 1.04), q = 1 - p; offsets[role] = [dx * 170 * q, dy * 170 * q, .22 * r * Math.max(0, q), cl(p * 3)]; });
      ctx.save(); ctx.shadowColor = 'rgba(40,16,80,.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
      drawLogo(x0 + LOGO / 2, ly - 4, LOGO, { offsets }); ctx.restore();
      const nk = eOut(kk(t, A.endcard + .18, A.endcard + .5));
      if (nk > 0) { ctx.save(); ctx.globalAlpha *= nk; text(name, x0 + LOGO + GAP, ly + 26 + 22 * (1 - nk), { font: NAME_F, color: P.ink, ls: -1 }); ctx.restore(); }
    }
    // the verified service lines, in a cream panel
    const sk = st.service;
    if (sk > 0) {
      const lines = (txt('service') || '').split('|'), y0 = G.end.serviceY, lh = 58, rise = 16 * (1 - sk);
      const pw = Math.max(...lines.map(l => measure(l.replace('→', ''), SERV_F) + (l.includes('→') ? ARW : 0))) + 70, ph = lh * lines.length + 40;
      ctx.save(); ctx.globalAlpha *= sk;
      at(G.cx, y0 - 46 + rise + ph / 2, -.008, 1, 1, () => B.blit(paperStrip(pw, ph)));        // a torn cream strip, violet washi tape
      lines.forEach((l, i) => serviceLine(l, G.cx, y0 + 15 + i * lh + rise, P.vioInk));
      ctx.restore();
    }
    ctx.restore();
    // the series' ritual stamp
    BZ_ritualStamp(G.cx, G.end.stampY, st.stamp, { alpha: fo, since: t - A.stampEnd });
    // the CTA pill + the hand-drawn arrow ↓ hanging from « commentaire » (drawn on, then bobbing ≈ 1.2 Hz)
    const word = ((txt('cta') || '').match(/Écris (.+?) en commentaire/) || [0, 'CBM'])[1];
    ctx.save(); ctx.globalAlpha *= fo;
    const geo = BZ_ctaPill(G.end.ctaX, G.end.ctaY, word, { k: st.cta, since: t - A.cta, t });
    const ak = kk(t, A.cta + .2, A.cta + .55);
    if (ak > 0 && geo) {
      const ax = geo.x1 - 44, ay = G.end.ctaY + geo.h / 2 + 12 + 5 * Math.sin((t - A.cta - .55) * 7.5) * kk(t, A.cta + .55, A.cta + .9);
      ctx.strokeStyle = P.orange; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const k1 = cl(ak / .65), k2 = cl((ak - .6) / .4), Lh = 60;
      ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.bezierCurveTo(ax + 8, ay + Lh * .35 * k1, ax - 6, ay + Lh * .7 * k1, ax + 4, ay + Lh * k1); ctx.stroke();
      if (k2 > 0) { ctx.beginPath(); ctx.moveTo(ax - 17, ay + Lh - 22 + 16 * (1 - k2)); ctx.lineTo(ax + 4, ay + Lh + 2); ctx.lineTo(ax + 4 + 19 * k2, ay + Lh - 20 + 16 * (1 - k2)); ctx.stroke(); }
    }
    ctx.restore();
  }

  // « Tague celui qui / remplit ses cartons / de papier », marker on the loop carton (glued, scaled with it)
  const TAG_F = 'CaveatBrush', TAG_Z = 64;
  function worldPart(st, t, L) {
    const lc = S.loopCarton(t); if (!lc) return;
    const fo = fadeOut(t), k = cl(lc.writeTag ?? st.tag); if (fo <= 0 || k <= 0) return;
    const lines = (txt('tag') || '').split('|').filter(Boolean); if (!lines.length) return;
    ctx.save(); ctx.globalAlpha *= fo;
    const g = B.cartonXf(lc, t), sc = g.s / G.end.loopS, z = TAG_Z * sc, f = `400 ${z.toFixed(1)}px ${TAG_F}`, lh = 70 * sc;
    const ws = lines.map(l => measure(l, f)), tot = lines.reduce((a, l) => a + l.length, 0);
    let acc = 0, head = null;
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    lines.forEach((l, i) => {
      const a0 = acc / tot, a1 = (acc += l.length) / tot, kl = cl((k - a0) / (a1 - a0)); if (kl <= 0) return;
      const y = g.cy + (i - (lines.length - 1) / 2) * lh + z * .30 - 6 * sc, x0 = g.cx - ws[i] / 2 + (i - 1) * 6 * sc;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 12, y - z * 1.05, (ws[i] + 24) * kl, z * 1.45); ctx.clip();
      text(l, x0, y, { font: f, color: '#2A1A2E' }); ctx.restore();
      if (kl < 1) head = [x0 + ws[i] * kl, y - z * .25];
    });
    ctx.restore();
    if (head) marker(head[0], head[1], -.5, '#2A1A2E');                  // the felt pen writing it
    ctx.restore();
  }
  window.BZ_end = (st, t, L, space) => { if (!st) return; space === 'world' ? worldPart(st, t, L) : screenPart(st, t, L); };
})();

// =============================================================================================
// REUSABLE IN THE 5 EPISODES (from episode 1's 70_bonzini.js, « copy as is »; kit.js only).
// =============================================================================================
/** « MAINTENANT, TU SAIS. » — the series' ritual stamp. Orange rubber stamp, two lines (« MAINTENANT, » / « TU SAIS. »,
 *  Big Shoulders Stencil 112 px), double border, starved ink, printed in multiply. ≈ 690 × 262 px: centred on x = 540 it
 *  stays inside x 195…885 (clear of the right-hand UI band). (x, y) = centre in the current transform; k = landing 0..1
 *  (the rubber comes down: 1.5 → 1, ink appears); o = {alpha, since (s since the impact: ink spread), rot, color}. */
function BZ_ritualStamp(x, y, k, o = {}) {
  if (k <= 0) return;
  const col = o.color || '#FE560D', key = 'ritual' + col;
  const C2 = BZ_ritualStamp.cache || (BZ_ritualStamp.cache = {});
  let sp = C2[key];
  if (!sp) {
    const f = '900 112px Stencil', l1 = 'MAINTENANT,', l2 = 'TU SAIS.', w = Math.ceil(Math.max(measure(l1, f, 4), measure(l2, f, 4)) + 96), h = 262, sc = 2;
    const c = makeCanvas((w + 30) * sc, (h + 30) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 30) / 2, (h + 30) / 2);
      g.strokeStyle = col; g.lineWidth = 11; rrect(-w / 2, -h / 2, w, h, 20); g.stroke();
      g.lineWidth = 3.5; rrect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30, 11); g.stroke();
      text(l1, 2, -14, { font: f, align: 'center', color: col, ls: 4 });
      text(l2, 2, 92, { font: f, align: 'center', color: col, ls: 4 });
      g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .45;
      g.drawImage(TEX.starve, -w / 2 - 15, -h / 2 - 15, w + 30, h + 30); g.globalAlpha = .3; g.drawImage(TEX.starve, 80, 30, 360, 200, -w / 2, -h / 2, w, h);
    } finally { ctx = prev; }
    sp = C2[key] = { c, w: w + 30, h: h + 30 };
  }
  const e = 1 - Math.pow(1 - Math.min(1, k), 3), since = o.since ?? 1;
  const s = (k < 1 ? 1.5 - .5 * e : 1) * (1 + .028 * Math.exp(-Math.max(0, since) * 12));
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.05); ctx.scale(s, s);
  ctx.globalAlpha *= (o.alpha ?? 1) * Math.min(1, k * 2);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  ctx.restore();
}
/** the series' CTA pill « Écris [WORD] en commentaire »: amber pill with thickness, the keyword typed in a cream field
 *  (orange stencil + a 1 Hz cursor). Width ≈ 820 px for a 5-letter word (x 130…950 centred on 540). (x, y) = centre;
 *  o = {k (0..1 appear), since (s since it appeared: one bounce), t (seconds, for the cursor)}. Returns {x0, x1, h}. */
function BZ_ctaPill(x, y, word, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return null;
  const C2 = BZ_ctaPill.cache || (BZ_ctaPill.cache = {});
  let sp = C2[word];
  if (!sp) {
    const fA = '900 50px Satoshi', fK = '900 66px Stencil', wE = measure('Écris', fA), wC = measure('en commentaire', fA), wK = measure(word, fK, 3) + 72;
    const gap = 18, pad = 34, w = Math.ceil(wE + gap + wK + gap + wC + 2 * pad), h = 104, sc = 2;
    const c = makeCanvas((w + 80) * sc, (h + 90) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 80) / 2, (h + 90) / 2 - 12);
      g.save(); g.shadowColor = 'rgba(60,24,40,.34)'; g.shadowBlur = 22 * sc; g.shadowOffsetY = 12 * sc;
      g.fillStyle = '#B86F1A'; rrect(-w / 2, -h / 2 + 8, w, h, h / 2); g.fill(); g.restore();                     // thickness + soft shadow
      const pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#FAC06A'); pg.addColorStop(1, '#EE9A30');
      g.fillStyle = pg; rrect(-w / 2, -h / 2, w, h, h / 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2.5; rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, h / 2 - 4); g.stroke();
      let cx = -w / 2 + pad;
      text('Écris', cx, 18, { font: fA, color: '#231629' }); cx += wE + gap;
      g.fillStyle = 'rgba(120,60,0,.28)'; rrect(cx, -36 + 3, wK, 76, 16); g.fill();
      g.fillStyle = '#FFF8EC'; rrect(cx, -38, wK, 76, 16); g.fill();
      text(word, cx + 20, 24, { font: fK, color: '#FE560D', ls: 3 });
      sp = { cursor: cx + wK - 24 }; cx += wK + gap;
      text('en commentaire', cx, 18, { font: fA, color: '#231629' });
    } finally { ctx = prev; }
    sp = C2[word] = { c, w: w + 80, h: h + 90, pw: w, ph: h, cursor: sp.cursor };
  }
  const d = o.since ?? 1, e = 1 - Math.pow(1 - Math.min(1, k), 3);
  const s = e * (1 + .13 * Math.exp(-Math.max(0, d) * 6) * Math.sin(Math.max(0, d) * 16));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.012); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2); ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2 + 12, sp.w, sp.h); ctx.restore();
  const tt = o.t ?? 0;
  if (Math.floor(tt * 2) % 2 === 0) { ctx.fillStyle = '#FE560D'; ctx.globalAlpha *= Math.min(1, k * 2); ctx.fillRect(sp.cursor, -22, 4, 44); }
  ctx.restore();
  return { x0: x - sp.pw / 2, x1: x + sp.pw / 2, h: sp.ph };
}

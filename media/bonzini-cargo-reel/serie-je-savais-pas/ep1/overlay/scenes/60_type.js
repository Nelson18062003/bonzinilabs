'use strict';
// =============================================================================================
// « TCHAC ! » — type (adapted from « PAS REÇU. » 60_type.js to the Kraft & Fil paper table).
//   TY_world(t, L, n): inside the camera — the hook price tag + its stamp « PAYÉE 5 000 F EN CHINE », TOI's cards and pill.
//   TY_draw(t, L, n):  screen space — series chip « JE SAVAIS PAS. · 1/5 », « EXEMPLE FICTIF », « TU GAGNES COMBIEN ? »,
//                      « Tu dis combien ? ↓ », the rule band, the Bonzini band, and the end card / ritual stamp / CTA pill
//                      (handed to BZ_endcard / BZ_ritual / BZ_cta when the Bonzini module defines them).
// Colour roles: amber = TOI · orange = alerts, stamps, the cuts · violet ONLY with Bonzini · ink on cream paper.
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, kk = S.kk, ease = S.ease, easeOut = S.easeOut, spr = S.spr;
  const has = n => typeof window[n] === 'function';
  const CREAM = '#FBF6EC', INK = '#231629', INK_S = '#4A3A52', ORANGE = '#FE560D', AMBER = '#F3A745', VIOL = '#7B4BFF', VIOL_D = '#5B2BDF';
  const textsAt = t => S.TEXTS().filter(([a, b]) => t >= a && t < b);
  const get = (t, id) => textsAt(t).find(x => x[2] === id);
  const inOut = (t, a, b, fi = .14, fo = .14) => Math.min(easeOut(kk(t, a, a + fi)), 1 - kk(t, b - fo, b));
  const jj = (i, t, amp) => { const q = Math.floor(t * 12); return { x: (rnd(i * 7.3 + q * 1.9) - .5) * 2 * amp, y: (rnd(i * 3.1 + q * 2.7) - .5) * 2 * amp }; };

  function pill(x, y, label, fill, color, a, size = 34, o = {}) {
    ctx.save(); ctx.globalAlpha *= a; ctx.font = `900 ${size}px Satoshi`;
    const w = ctx.measureText(label).width + size * 1.2, h = size + 24;
    ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.s) ctx.scale(o.s, o.s);
    ctx.shadowColor = 'rgba(60,32,12,.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
    ctx.fillStyle = fill; rrect(o.left ? 0 : -w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, o.left ? w / 2 : 0, 2);
    ctx.restore(); return w;
  }
  /** torn cream paper card centred at (0,0) */
  function card(w, h, seed = 3, fill = CREAM, lift = 10) {
    withShadow(lift, () => { ctx.fillStyle = fill; ctx.beginPath(); const tp = tornLine(-w / 2, -h / 2, w / 2, -h / 2, seed, 2.4, 12), bt = tornLine(w / 2, h / 2, -w / 2, h / 2, seed + 5, 2.4, 12);
      ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  function tape(x, y, r = 0, len = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-len / 2, -15, len, 30); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(-len / 2, -11, len, 4); }); }

  // =========================================================================================== world
  function hookTag(t) {
    const hk = S.hook(t); if (!hk) return;
    const g = hk.tag, w = g.w, h = g.h;
    at(g.x, g.y, g.rot, g.s, g.s, () => {
      // kraft price tag with a grommet and string to its pin
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 34, -h / 2 + 34); ctx.bezierCurveTo(-w / 2 - 10, -h / 2 - 10, -w / 2 - 40, -h / 2 + 30, -w / 2 - 60, -h / 2 + 4); ctx.stroke();
      withShadow(10, () => { ctx.fillStyle = '#D9B98A'; ctx.beginPath(); const c = 40;
        ctx.moveTo(-w / 2 + c, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + c, h / 2); ctx.lineTo(-w / 2, h / 2 - c); ctx.lineTo(-w / 2, -h / 2 + c); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .35; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.globalAlpha /= .35;
      ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(-w / 2 + 34, -h / 2 + 34, 15, 0, 7); ctx.fill(); ctx.fillStyle = C.table; ctx.beginPath(); ctx.arc(-w / 2 + 34, -h / 2 + 34, 7, 0, 7); ctx.fill();
      text('1 PAIRE · REVENDUE', 16, -h / 2 + 76, { font: font(FF.body, 46, 800), align: 'center', color: INK });
      text('10 000 F À MBOPPI', 16, -h / 2 + 138, { font: font(FF.body, 50, 800), align: 'center', color: INK });
      ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 30, -h / 2 + 168); ctx.lineTo(w / 2 - 24, -h / 2 + 168); ctx.stroke(); ctx.setLineDash([]);
      // « PAYÉE 5 000 F EN CHINE » — orange rubber stamp on « payée »
      const k = hk.stamp; if (k > 0) { const sq = hk.stampSq || { sx: 1, sy: 1 }, sc = 1.6 - .6 * easeOut(k);
        at(14, h / 2 - 66, -.05, sc * sq.sx, sc * sq.sy, () => { ctx.globalAlpha *= Math.min(1, k * 2.5);
          stampText('PAYÉE 5 000 F EN CHINE', 0, 0, font(FF.stencil, 50, 900), ORANGE, { box: true, boxW: 6, h: 76, starve: .3, ls: 1 }); }); }
    });
  }
  /** TOI's speech card in the slot, amber « TOI » pill on its corner */
  function toiCard(t, id, a, b, s) {
    const lines = s.split('|'), small = id === 'toi2';
    const k = spr(t - a, 13, .55), al = 1 - kk(t, b - .15, b);
    if (k <= 0 || al <= 0) return;
    // v2: card 2 « Quoi ? / Zéro franc ? » 64 px in a 500 px card (was « …zéro ?! » 80 px / 380 px), 12 px right of the slot so
    // its left edge keeps ≈ 45 px of air; its tail stops at the calculator's edge
    const fs = small ? 64 : 60, lh = fs * 1.08, w = small ? 500 : 430, h = lines.length * lh + 64;
    const P = small ? G.slot : G.toi1, x = P.x + (small ? 12 : (1 - Math.min(1, k)) * 420), y = P.y;
    const tr = small ? jj(5, t, 2.5) : { x: 0, y: 0 };
    at(x + tr.x, y + tr.y, small ? .03 : -.025, small ? Math.min(1.1, k) : 1, small ? Math.min(1.1, k) : 1, () => {
      ctx.globalAlpha *= al;
      card(w, h, small ? 41 : 17, '#FFFFFF', 12);
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath();                                   // speech tail: up to the calculator (card 1) / right (card 2)
      if (small) { ctx.moveTo(w / 2 - 6, 4); ctx.lineTo(w / 2 + 26, 24); ctx.lineTo(w / 2 - 6, 40); } else { ctx.moveTo(-40, -h / 2 + 4); ctx.lineTo(10, -h / 2 - 46); ctx.lineTo(30, -h / 2 + 4); }
      ctx.closePath(); ctx.fill();
      lines.forEach((l, i) => text(l, 0, -h / 2 + 32 + fs * .86 + i * lh, { font: font('Satoshi', fs, 900), align: 'center', color: INK }));
      pill(-w / 2 + 18, -h / 2 - 4, 'TOI', AMBER, INK, 1, 34, { left: true, rot: -.04 });
    });
  }
  function toiSmall(t, a, b) {                     // the shrunken, trembling TOI pill (the key moment, before « Quoi ? Zéro franc ? »)
    const toi2 = get(t, 'toi2'); if (toi2) return;
    const al = inOut(t, a, b, .2, .2); if (al <= 0) return;
    const j = jj(9, t, 3);
    pill(G.slot.x + j.x, G.slot.y + j.y, 'TOI', AMBER, INK, al, 40, { s: .9, rot: .05 });
  }
  function world(t, L, n) {
    hookTag(t);
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'toiCard') toiCard(t, id, a, b, s);
      if (st === 'toiSmall') toiSmall(t, a, b);
    }
  }

  // =========================================================================================== screen
  function chip(t) {
    ctx.save(); ctx.font = '900 34px Satoshi'; const a = 'JE SAVAIS PAS.', b = ' · 1/5';
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, w = wa + wb + 44, h = 58, x = G.chip.x, y = G.chip.y;
    ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = INK; rrect(x, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.textBaseline = 'middle'; ctx.fillStyle = CREAM; ctx.fillText(a, x + 22, y + 2); ctx.fillStyle = AMBER; ctx.fillText(b, x + 22 + wa, y + 2);
    ctx.restore();
  }
  function exemple(t) {
    at(G.exemple.x + 150, G.exemple.y, -.03, 1, 1, () => {
      withShadow(5, () => { ctx.fillStyle = '#D9B98A'; rrect(-150, -30, 300, 60, 6); ctx.fill(); });
      text('EXEMPLE FICTIF', 0, 13, { font: font(FF.stencil, 40, 900), align: 'center', color: INK, ls: 3 });
      tape(-140, -24, -.6, 60);
    });
  }
  function title(t, a, b) {                       // « TU GAGNES COMBIEN ? » — orange, big, lands like a stamp
    const k = kk(t, a, a + .18), al = 1 - kk(t, b - .2, b); if (k <= 0 || al <= 0) return;
    // QA: it stays up through the cuts (the question the calculator answers); once the dare pill has gone it settles
    // a little smaller and higher (112 → 96 px) so the scissors' handles keep their air
    const sk = ease(kk(t, A.dare + 1.45, A.dare + 1.85)), sc = (1.35 - .35 * easeOut(k)) * (1 - .14 * sk);
    at(G.head.x, G.head.y - 40 * sk, -.03, sc, sc, () => { ctx.globalAlpha *= Math.min(1, k * 2) * al;
      ctx.save(); ctx.translate(5, 7); text('TU GAGNES COMBIEN ?', 0, 40, { font: font(FF.stencil, 112, 900), align: 'center', color: 'rgba(60,32,12,.18)', ls: 2 }); ctx.restore();
      text('TU GAGNES COMBIEN ?', 0, 40, { font: font(FF.stencil, 112, 900), align: 'center', color: ORANGE, ls: 2 }); });
  }
  function dare(t, a, b) {                        // « Tu dis combien ? ↓ » — amber pill, bounces once
    const al = inOut(t, a, b, .12, .2); if (al <= 0) return;
    const d = t - a, bounce = 1 + .16 * Math.exp(-d * 6) * Math.sin(d * 16), s = easeOut(kk(t, a, a + .2)) * bounce;
    pill(G.head.x, G.head.y + 118, 'Tu dis combien ? ↓', AMBER, INK, al, 46, { s, rot: .02 });
  }
  function rule(t, a, b) {                        // the rule, on a torn paper band: ink + orange
    const al = 1 - kk(t, b - .25, b); if (al <= 0) return;
    const [k1, k2, k3] = S.ruleParts(t), x = G.rule.x, y = G.rule.y;
    const w = 900, h = 430, pop = 1.06 - .06 * easeOut(k1), hv = 180 + 125 * easeOut(k2) + 125 * easeOut(k3);   // the band unrolls with the lines
    at(x, y, -.02, pop, pop, () => { ctx.globalAlpha *= al * Math.min(1, k1 * 3);
      at(0, -h / 2 + hv / 2, 0, 1, 1, () => card(w, hv, 23, CREAM, 14)); tape(-w / 2 + 30, -h / 2 + 8, -.5); tape(w / 2 - 30, -h / 2 + 8, .5);
      text('COMPTE TOUT.', 0, -h / 2 + 136, { font: font(FF.stencil, 132, 900), align: 'center', color: INK, ls: 3 });
      if (k2 > 0) { ctx.save(); ctx.globalAlpha *= k2; text('AVANT DE FIXER', 0, -h / 2 + 262 + 14 * (1 - k2), { font: font(FF.stencil, 112, 900), align: 'center', color: ORANGE, ls: 3 }); ctx.restore(); }
      if (k3 > 0) { ctx.save(); ctx.globalAlpha *= k3; text('TON PRIX.', 0, -h / 2 + 384 + 14 * (1 - k3), { font: font(FF.stencil, 124, 900), align: 'center', color: ORANGE, ls: 3 });
        const wd = measure('TON PRIX.', font(FF.stencil, 124, 900), 3) / 2, kq = easeOut(kk(t, A.rule2 + .55, A.rule2 + 1.0));
        ctx.strokeStyle = ORANGE; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-wd, -h / 2 + 404); ctx.quadraticCurveTo(0, -h / 2 + 418, -wd + 2 * wd * kq, -h / 2 + 400); ctx.stroke(); ctx.restore(); }
    });
  }
  function bzBand(t, a, b) {                      // the Bonzini promise (violet: the brand is on screen)
    const al = inOut(t, a, b, .18, .2); if (al <= 0) return;
    const l2 = kk(t, A.bzLine2, A.bzLine2 + .2);   // QA: held ≥ 1.4 s (A.bzLine2)
    at(G.bzBand.x, G.bzBand.y + (1 - al) * 20, .015, 1, 1, () => { ctx.globalAlpha *= al;
      withShadow(10, () => { ctx.fillStyle = CREAM; rrect(-450, -92, 900, 184, 24); ctx.fill(); });
      ctx.fillStyle = VIOL; rrect(-450, -92, 14, 184, 6); ctx.fill();
      text('TON COLIS, PESÉ ET MESURÉ', 0, -18, { font: font('Satoshi', 58, 900), align: 'center', color: VIOL_D });
      if (l2 > 0) { ctx.save(); ctx.globalAlpha *= l2; text('EN CHINE', 0, 58, { font: font('Satoshi', 66, 900), align: 'center', color: INK, ls: 2 }); ctx.restore(); }
    });
  }
  // ---- end card (fallbacks: the Bonzini module takes over with BZ_endcard / BZ_ritual / BZ_cta)
  function endFB(E) {
    ctx.save(); ctx.globalAlpha *= E.a;
    const lk = Math.min(1.12, E.logoK); if (lk > 0) drawLogo(G.end.logo.x, G.end.logo.y, 270 * lk);
    if (E.nameK > 0) text('Bonzini Trading Cargo', G.cx, G.end.name.y + 20 * (1 - E.nameK), { font: font(FF.brand, 80, 900), align: 'center', color: INK, alpha: E.nameK });
    if (E.lineK > 0) text('Groupage mer et air · Chine → Douala', G.cx, G.end.line.y, { font: font(FF.body, 46, 800), align: 'center', color: VIOL_D, alpha: E.lineK });
    ctx.restore();
  }
  function ritualFB(E) {
    const k = E.ritualK; if (k <= 0) return; const sc = 1.5 - .5 * easeOut(k);
    at(G.end.ritual.x, G.end.ritual.y, -.05, sc, sc, () => { ctx.globalAlpha *= Math.min(1, k * 2) * E.a;
      stampText('MAINTENANT, TU SAIS.', 0, 0, font(FF.stencil, 104, 900), ORANGE, { box: true, boxW: 10, h: 150, starve: .3, ls: 3 }); });
  }
  function ctaFB(E, t) {
    const k = E.ctaK; if (k <= 0) return;
    const d = t - A.cta, bounce = 1 + .14 * Math.exp(-d * 6) * Math.sin(d * 16);
    ctx.save(); ctx.globalAlpha *= E.a; ctx.translate(G.end.cta.x, G.end.cta.y); ctx.scale(bounce * easeOut(k), bounce * easeOut(k));
    pill(0, 0, 'Écris CALCUL en commentaire', AMBER, INK, 1, 52);   // v2: 52 px so the pill ends ≤ x 960
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';    // hand-drawn arrow down to the comments
    const ay = 66 + 6 * Math.sin(t * 6); ctx.beginPath(); ctx.moveTo(-4, ay); ctx.quadraticCurveTo(8, ay + 22, 0, ay + 46); ctx.moveTo(-18, ay + 26); ctx.lineTo(0, ay + 48); ctx.lineTo(17, ay + 27); ctx.stroke();
    ctx.restore();
    if (E.shareK > 0) text('Partage à l’ami qui fait encore × 2', G.cx, G.end.share.y, { font: font('Satoshi', 46, 700), align: 'center', color: INK_S, alpha: E.shareK * E.a });
  }
  function screen(t, L, n) {
    chip(t); exemple(t);
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'title') title(t, a, b);
      if (st === 'dare') dare(t, a, b);
      if (st === 'rule') rule(t, a, b);
      if (st === 'bzBand') bzBand(t, a, b);
    }
    const E = S.endcard(t);
    if (E) {
      has('BZ_endcard') ? BZ_endcard(E, t, L, n) : endFB(E);
      has('BZ_ritual') ? BZ_ritual(E, t, L, n) : ritualFB(E);
      has('BZ_cta') ? BZ_cta(E, t, L, n) : ctaFB(E, t);
    }
  }
  return { world, screen };
})();
function TY_world(t, L, n) { TY.world(t, L, n); }
function TY_draw(t, L, n) { TY.screen(t, L, n); }

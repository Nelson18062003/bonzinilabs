'use strict';
// =============================================================================================
// 56_sign — S30 « Bonzini Trading Cargo. Payez le juste droit. Ni plus, ni moins. » (screen space, during the crane shot)
//  The camera (10_layout) pulls back and turns the whole diorama upright: the road runs from the quay (bottom) to Mboppi (top)
//  in the left half of the frame (x ≈ 270–600). The signature is a clean paper card laid on the kraft table NEXT to it, in the
//  right column (x ≥ 604, text never beyond x 960), so the full road stays readable.
//   · « Bonzini »: the card is set down; the logo assembles (drawLogo); « Bonzini » · « Trading » · « Cargo » arrive on their word.
//   · « Payez »: strip « PAYEZ LE / JUSTE DROIT. »; « juste »: an orange felt underline under JUSTE DROIT.
//   · « Ni »: amber strip « NI PLUS, / NI MOINS. » — it tips like a balance on « plus », then « moins », and settles level.
//   · photo credits on a dark pill (FF.body 23 px): « Photos : BACHELOR45 / Le Sorcier (CC BY 4.0) · migmasat (domaine public)
//     · jdnx, Bernard Spragg (illustrations) ».
//   · captions are hidden for S30 (every spoken word is written on the card).
// z 56. Top-level names: none (IIFE). Scene id F56_sign.
// =============================================================================================
(() => {
  const CX = 794, CARD = { x0: 604, x1: 984, y0: 222, y1: 1000 }, TW = 330;          // text column centre / max width
  const LOGO = { y: 350, s: 196 }, NAME_Y = 556, SUB_Y = 614, S1 = { y: 742 }, S2 = { y: 902 };
  const CRED = ['Photos : BACHELOR45 /', 'Le Sorcier (CC BY 4.0) ·', 'migmasat (domaine public) ·', 'jdnx, Bernard Spragg', '(illustrations)'];
  const PILL = { y0: 1026, lh: 30 };
  let T = null;
  function tm() {
    if (T) return T;
    const o = {};
    o.B = tw('S30', 'Bonzini', 0); o.Tr = Math.max(tw('S30', 'Trading', 0), o.B + .3); o.Ca = Math.max(tw('S30', 'Cargo', 0), o.Tr + .2);
    o.card = o.B - .22;
    o.Pa = Math.max(tw('S30', 'Payez', 0), o.Ca + .3); o.Ju = Math.max(tw('S30', 'juste', 0), o.Pa + .2); o.Dr = Math.max(te('S30', 'droit', 0), o.Ju + .2);
    o.N1 = Math.max(tw('S30', 'Ni', 0), o.Dr + .1); o.Pl = Math.max(tw('S30', 'plus', 0), o.N1 + .15); o.Mo = Math.max(tw('S30', 'moins', 0), o.Pl + .3);
    o.cred = o.Pa + .35;
    addShake(o.card + .28, 4, .1); addShake(o.Pa + .05, 4, .1); addShake(o.N1 + .05, 4, .1);
    T = o; return T;
  }
  const sp = (x, w = 14, z = .45) => (x <= 0 ? 0 : spring(x, w, z));
  function tornRect(w, h, seed, fill, lift = 10) {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, seed, 3.5, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, seed + 4, 3.5, 12);
    withShadow(lift, () => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  function tape(x, y, r, w = 90) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-w / 2, -16, w, 32); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2, -12, w, 5); }); }

  function card(t, n) {
    const k = tm(), d = drop(t, k.card, 220, .28); if (!d.a) return;
    const w = CARD.x1 - CARD.x0, h = CARD.y1 - CARD.y0;
    at((CARD.x0 + CARD.x1) / 2, (CARD.y0 + CARD.y1) / 2 + d.y, .006, d.sx, d.sy, () => {
      withShadow(14, () => { ctx.fillStyle = '#FFFDF7'; rrect(-w / 2, -h / 2, w, h, 14); ctx.fill(); });
      ctx.strokeStyle = 'rgba(169,71,254,.28)'; ctx.lineWidth = 3; ctx.setLineDash([12, 9]); rrect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 9); ctx.stroke(); ctx.setLineDash([]);
      tape(-w / 2 + 34, -h / 2 + 6, -.55); tape(w / 2 - 34, -h / 2 + 6, .55);
    });
  }
  function logoAndName(t, n) {
    const k = tm(), ts = stepT(n);
    if (ts >= k.B - .05) {                                            // the logo assembles piece by piece (on twos)
      const from = { wingTop: [-150, -60, -.8], wingBot: [-150, 70, .8], amber: [30, -170, .6], orange: [150, 60, -.6] }, order = { amber: 0, wingTop: 1, wingBot: 2, orange: 3 }, off = {};
      for (const r in from) { const q = clamp(sp(ts - (k.B - .05 + order[r] * .07), 14, .55), 0, 1.15), f = from[r]; off[r] = [f[0] * (1 - q), f[1] * (1 - q), f[2] * (1 - q), clamp(q * 3)]; }
      withShadow(8, () => drawLogo(CX, LOGO.y, LOGO.s, { offsets: off }));
    }
    const f = font(FF.brand, 84, 900), word = 'Bonzini', ww = measure(word, f), x0 = CX - ww / 2;
    for (let i = 0; i < word.length; i++) {
      const q = clamp(sp(ts - k.B - .1 - i * .04, 16, .45), 0, 1.25); if (q <= 0) continue;
      const pre = measure(word.slice(0, i), f), lw = measure(word[i], f);
      at(x0 + pre + lw / 2, NAME_Y + (1 - clamp(q)) * 30, 0, q, q, () => text(word[i], 0, 0, { font: f, align: 'center', color: C.ink }));
    }
    const sf = font(FF.brand, 44, 800), a = 'Trading', b = 'Cargo', gap = measure(' ', sf), wa = measure(a, sf), wb = measure(b, sf), sx = CX - (wa + gap + wb) / 2;
    for (const [s, x, tt] of [[a, sx, k.Tr], [b, sx + wa + gap, k.Ca]]) {
      const q = clamp(sp(ts - tt + .03, 15, .5), 0, 1.2); if (q <= 0) continue;
      at(x, SUB_Y - (1 - clamp(q)) * 26, 0, 1, 1, () => text(s, 0, 0, { font: sf, color: C.violetD, alpha: clamp(q * 2) }));
    }
  }
  /** a two-line torn paper strip, centred on the text column */
  function strip2(lines, y, fill, col, seed, rot, t0, t, n) {
    const q = eOutBack(clamp(prog(stepT(n), t0 - .06, t0 + .24)), 1.3); if (q <= 0) return;
    const f = font(FF.stencil, 60, 900), w = Math.max(...lines.map(s => measure(s, f, 3))) + 44, h = 142, j = jit(560 + seed, n, .4);
    at(CX + (1 - clamp(q)) * 260 + j.x, y + j.y, rot + j.r, 1, 1, () => {
      ctx.globalAlpha *= clamp(q * 2);
      tornRect(w, h, seed, fill, 10);
      lines.forEach((s, i) => text(s, 0, -h / 2 + 62 + i * 64, { font: f, align: 'center', color: col, ls: 3 }));
      if (seed === 8) {                                                // « juste »: orange felt underline under JUSTE DROIT.
        const k = tm(), p = eOutCubic(prog(stepT(n), k.Ju, k.Ju + clamp(k.Dr + .1 - k.Ju, .25, .5))); if (p > 0) {
          const lw = measure(lines[1].replace('.', ''), f, 3), x0 = -measure(lines[1], f, 3) / 2 - 4, y1 = -h / 2 + 62 + 64 + 14;
          ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
          for (let i = 0; i <= 20; i++) { const u = i / 20; if (u > p) break; const x = x0 + (lw + 8) * u, yy = y1 + Math.sin(u * 8) * 2.2 - u * 3; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); ctx.restore(); }
      }
    });
  }
  function slogan(t, n) {
    const k = tm();
    strip2(['PAYEZ LE', 'JUSTE DROIT.'], S1.y, C.cream, C.ink, 8, -.02, k.Pa, t, n);
    const tilt = -.06 * sp(t - k.Pl, 9, .35) + .12 * sp(t - k.Mo, 9, .35) - .06 * sp(t - k.Mo - .45, 9, .35);   // a balance: plus ↙, moins ↘, level
    strip2(['NI PLUS,', 'NI MOINS.'], S2.y, C.amber, C.ink, 9, .015 + tilt, k.N1, t, n);
  }
  function credits(t) {
    const k = tm(), a = eOutCubic(prog(t, k.cred, k.cred + .5)); if (a <= 0) return;
    const f = font(FF.body, 23, 700), w = Math.max(...CRED.map(s => measure(s, f))) + 40, h = CRED.length * PILL.lh + 26;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(35,22,41,.82)'; rrect(CX - w / 2, PILL.y0, w, h, 16); ctx.fill();
    CRED.forEach((s, i) => text(s, CX, PILL.y0 + 13 + 22 + i * PILL.lh, { font: f, align: 'center', color: '#FFFDF7' }));
    ctx.restore();
  }
  function draw(t, n) {
    const k = tm(); if (t < k.card) return;
    const sh = shake(t, n);
    ctx.save(); ctx.translate(sh.x * .5, sh.y * .5);
    card(t, n); logoAndName(t, n); slogan(t, n); credits(t);
    ctx.restore();
  }
  captionHide((tt, p) => !!p && p.seg === 'S30');                    // every spoken word of S30 is on the card
  registerScene({ id: 'F56_sign', z: 56, draw(t, n) { if (!TLD || t < ss('S30', -1.5)) return; draw(t, n); } });
})();

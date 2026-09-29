'use strict';
// CTA + signature (S22–S23): a fresh 10 000 F note back on the table with the scissors hovering (loops to frame 0),
// the comment bubble types the keyword, share chip; then the note flips into the Bonzini logo, brand + tagline, tape seals the film.
// Configured by window.OUTRO (05_config.js).
(() => {
  let O = null;
  function cfg() {
    const c = window.OUTRO; if (!c) return null;
    return { ...c, cta: TL.seg(c.ctaSeg), brand: TL.seg(c.brandSeg),
      kw: TL.wt(c.ctaSeg, c.keywordWord || c.keyword), bz: TL.wt(c.brandSeg, c.brandWord || 'bonzini'),
      t1: TL.wt(c.brandSeg, c.tagWord1), t2: TL.wt(c.brandSeg, c.tagWord2), sh: c.shareWord ? TL.wt(c.ctaSeg, c.shareWord) : null };
  }
  registerScene({
    id: 'outro', z: 60, when: t => window.OUTRO && TLD.segments.some(s => s.id === window.OUTRO.ctaSeg) && t >= TL.seg(window.OUTRO.ctaSeg).start - .5,
    draw(t, n) {
      if (!O) O = cfg(); if (!O) return;
      const ts = stepT(n), cx = W / 2;
      // --- the loop note + hovering scissors (same composition as frame 0)
      const nIn = drop(t, O.cta.start - .25, 700, .18), flip = prog(t, O.bz - .45, O.bz - .05);
      if (flip < 1) at(cx, 430 + nIn.y, -.012, .82 * nIn.sx * Math.max(.02, Math.cos(flip * Math.PI / 2)), .82 * nIn.sy, () => {
        withShadow(6, () => banknote(880, 420, { value: 10000, serial: 'SPÉCIMEN' }));
        stampText('SPÉCIMEN', 190, 150, font(FF.stencil, 40, 900), 'rgba(123,34,214,.9)', { alpha: .7, ls: 6 });
      });
      const sIn = eOutCubic(prog(t, O.cta.start, O.cta.start + .6)), sOut = eInCubic(prog(t, O.bz - .6, O.bz - .2));
      if (sIn > 0 && sOut < 1) at(lerp(W + 250, 560, sIn) + sOut * 800, 170, Math.PI / 2 + .08, 1.1, 1.1, () => withShadow(22, () => scissors(.35 + .15 * Math.sin(t * 7))));
      // --- CTA: comment bubble types the keyword, heart pops
      const cin = spring(t - (O.cta.start + .2), 10, .55), cout = eInOutCubic(prog(t, O.bz - .5, O.bz - .1));
      if (cin > 0 && cout < 1) at(cx - cout * 1200, 860, (rnd(3) - .5) * .04, clamp(cin, 0, 1.15), clamp(cin, 0, 1.15), () => {
        text('Écrivez en commentaire', 0, -130, { font: font(FF.hand, 56, 800), align: 'center', color: C.inkSoft });
        commentBubble(620, O.keyword + ' ✂', prog(t, O.kw - .1, O.kw + .45), n, { size: 76, h: 160 });
        const hp = spring(t - (O.kw + .5), 12, .45); if (hp > 0) at(250, -70, .2, clamp(hp, 0, 1.2), clamp(hp, 0, 1.2), () => { ctx.fillStyle = M.red; ctx.beginPath(); ctx.moveTo(0, 26);
          ctx.bezierCurveTo(-60, -10, -30, -60, 0, -30); ctx.bezierCurveTo(30, -60, 60, -10, 0, 26); ctx.fill(); });
      });
      if (O.sh != null) { const sp = spring(t - (O.sh - .05), 11, .5);
        if (sp > 0 && cout < 1) chip(cx + cout * 1200, 1085, O.shareLabel || 'Partagez', { s: clamp(sp, 0, 1.1), fill: C.violetD, size: 48, rot: -.02 }); }
      // --- logo grows out of the flipped note
      const lg = spring(t - (O.bz - .08), 9, .5);
      if (lg > 0) drawLogo(cx, 430, 330 * clamp(lg, 0, 1.15));
      const b1 = prog(ts, O.bz, O.bz + .25);
      if (b1 > 0) { text('BONZINI', cx, 740 + (1 - b1) * 30, { font: font(FF.brand, 150, 900), align: 'center', color: C.ink, alpha: b1, ls: 4 });
        text('TRADING CARGO', cx, 825 + (1 - b1) * 30, { font: font(FF.stencil, 78, 800), align: 'center', color: C.violetD, alpha: b1, ls: 14 }); }
      const a1 = prog(ts, O.t1, O.t1 + .2), a2 = prog(ts, O.t2, O.t2 + .2);
      if (a1 > 0) paperNote(cx, 975, measure(O.tag1, font(FF.body, 60, 800)) + 90, 104, -.02, () => text(O.tag1, 0, 21, { font: font(FF.body, 60, 800), align: 'center', color: C.ink }), { seed: 71, h: 8 });
      if (a2 > 0) { const f = font(FF.hand, 68, 800); text(O.tag2, cx, 1120, { font: f, align: 'center', color: C.violetD, alpha: a2 });
        const w = measure(O.tag2, f) / 2, k = eOutCubic(prog(t, O.t2 + .2, O.t2 + .7)); ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - w, 1148); ctx.quadraticCurveTo(cx, 1164, cx - w + 2 * w * k, 1144); ctx.stroke(); ctx.restore(); }
      const fine = prog(t, O.t2 + .4, O.t2 + .8);
      if (fine > 0) text('Exemple fictif : chiffres illustratifs, pas des tarifs.', cx, 1215, { font: font(FF.body, 30, 600), align: 'center', color: C.inkSoft, alpha: fine });
      // --- Bonzini tape unrolls along the bottom at the end
      const tp = eInOutCubic(prog(t, O.brand.end + .2, O.brand.end + 1.0));
      if (tp > 0) { ctx.save(); ctx.translate(0, 1380); ctx.rotate(-.05);
        ctx.fillStyle = C.amber; ctx.fillRect(-40, -60, (W + 80) * tp, 120);
        ctx.save(); ctx.beginPath(); ctx.rect(-40, -60, (W + 80) * tp, 120); ctx.clip();
        for (let x = -20; x < W + 100; x += 420) { text('BONZINI', x, 24, { font: font(FF.stencil, 72, 900), color: C.ink, ls: 6 }); drawLogo(x + 330, 0, 70); }
        ctx.restore(); ctx.restore(); }
      const fo = prog(t, TLD.duration - .5, TLD.duration);
      if (fo > 0) { ctx.fillStyle = `rgba(242,234,219,${fo})`; ctx.fillRect(0, 0, W, H); }
    },
  });
  captionHide(t => O && t >= O.bz - .3);                  // the signature is on screen: no caption strip over it
})();

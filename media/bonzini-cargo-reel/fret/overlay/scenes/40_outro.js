'use strict';
// outro (S10): the thread wraps the carton and ties a bow → the Bonzini logo → brand line → Bonzini tape seals the film.
// + tape-wipe transitions between chapters.
(() => {
  let O = null;
  function bow(k, n) {                              // two loops + tails, violet, drawn progressively
    const loops = [[[0, 0], [-60, -70], [-150, -40], [-120, 30], [0, 0]], [[0, 0], [60, -70], [150, -40], [120, 30], [0, 0]], [[0, 0], [-40, 90], [-90, 170]], [[0, 0], [40, 90], [100, 160]]];
    loops.forEach((L, i) => thread(curve(L, 10), clamp(k * 4 - i), n, { w: 9 }));
    if (k > .9) { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); }
  }
  registerScene({
    id: 'outro', z: 40, when: t => t >= TL.ch('outro').start - .1,
    draw(t, n) {
      if (!O) O = { ch: TL.ch('outro'), s: TL.seg('S10'), bz: TL.wt('S10', 'bonzini'), cargo: TL.wt('S10', 'cargo'), code: TL.wt('S10', 'code'), colis: TL.wt('S10', 'colis'), transp: TL.wt('S10', 'transparence') };
      const ts = stepT(n), ch = O.ch;
      const cin = spring(ts - ch.start, 10, .5);
      const cx = W / 2, cy = 560;
      // wrapping: thread crosses the carton horizontally then vertically before the bow
      const wrap1 = eInOutCubic(prog(t, ch.start + .15, ch.start + .55)), wrap2 = eInOutCubic(prog(t, ch.start + .4, ch.start + .8));
      const bk = prog(t, O.bz - .25, O.bz + .45);
      const toLogo = eInOutCubic(prog(t, O.cargo - .1, O.cargo + .45));
      at(cx, cy + (1 - clamp(cin)) * 900, 0, 1 - .25 * toLogo, 1 - .25 * toLogo, () => {
        ctx.globalAlpha = 1 - toLogo;
        withShadow(10, () => carton(520, 380, { seed: 88, tape: false }));
        thread([[-300, 0], [300, 0]], wrap1, n, { w: 9 }); thread([[0, -230], [0, 230]], wrap2, n, { w: 9 });
        if (bk > 0) at(0, 0, 0, 1, 1, () => bow(bk, n));
        ctx.globalAlpha = 1;
      });
      // logo grows out of the knot
      if (toLogo > 0) {
        const s = spring(t - (O.cargo - .1), 9, .45);
        drawLogo(cx, cy, 380 * clamp(s, 0, 1.2), { alpha: clamp(toLogo * 1.5) });
      }
      const b1 = prog(ts, O.cargo, O.cargo + .25);
      if (b1 > 0) { text('BONZINI', cx, 900 + (1 - b1) * 30, { font: font(FF.brand, 150, 900), align: 'center', color: C.ink, alpha: b1, ls: 4 });
        text('TRADING CARGO', cx, 985 + (1 - b1) * 30, { font: font(FF.stencil, 78, 800), align: 'center', color: C.violetD, alpha: b1, ls: 14 }); }
      // three beats: votre code · vos colis · en toute transparence
      const c1 = prog(ts, O.code, O.code + .15), c2 = prog(ts, O.colis, O.colis + .15), c3 = prog(ts, O.transp, O.transp + .2);
      if (c1 > 0) chip(310, 1110, 'Votre code', { s: eOutBack(c1), fill: C.violetD, size: 46, rot: -.03 });
      if (c2 > 0) chip(770, 1110, 'Vos colis', { s: eOutBack(c2), fill: C.ink, size: 46, rot: .03 });
      if (c3 > 0) { text('en toute transparence', cx, 1235, { font: font(FF.hand, 60, 700), align: 'center', color: C.violetD, alpha: c3 });
        ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); const w = 330 * eOutCubic(prog(t, O.transp + .2, O.transp + .6));
        ctx.moveTo(cx - 330, 1258); ctx.quadraticCurveTo(cx, 1272, cx - 330 + 2 * w, 1252); ctx.stroke(); ctx.restore(); }
      // Bonzini tape unrolls along the bottom at the end
      const tp = eInOutCubic(prog(t, O.s.end + .15, O.s.end + 1.0));
      if (tp > 0) {
        ctx.save(); ctx.translate(0, 1560); ctx.rotate(-.05);
        ctx.fillStyle = C.amber; ctx.fillRect(-40, -60, (W + 80) * tp, 120);
        ctx.save(); ctx.beginPath(); ctx.rect(-40, -60, (W + 80) * tp, 120); ctx.clip();
        for (let x = -20; x < W + 100; x += 420) { text('BONZINI', x, 24, { font: font(FF.stencil, 72, 900), color: C.ink, ls: 6 }); drawLogo(x + 330, 0, 70); }
        ctx.restore(); ctx.restore();
      }
      // final fade to paper (last 0.5 s)
      const fo = prog(t, TLD.duration - .5, TLD.duration);
      if (fo > 0) { ctx.fillStyle = `rgba(242,234,219,${fo})`; ctx.fillRect(0, 0, W, H); }
    },
  });
  // ---------------------------------------------------------------- tape-wipe transitions
  const WIPES = ['track', 'resell', 'modes', 'tip', 'outro'];
  registerScene({
    id: 'wipes', z: 80,
    draw(t, n) {
      for (const id of WIPES) {
        const c = TL.ch(id), k = prog(t, c.start - .3, c.start + .3); if (k <= 0 || k >= 1) continue;
        const x = lerp(-1500, 1500, eInOutCubic(k));
        ctx.save(); ctx.translate(W / 2 + x, H / 2 - 120); ctx.rotate(-.35);
        ctx.fillStyle = C.amber; const top = tornLine(-700, -330, 700, -330, 3, 5, 14), bot = tornLine(700, 330, -700, 330, 7, 5, 14);
        ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath();
        ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 20; ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-700, -300, 1400, 26);
        for (let i = -2; i <= 2; i++) text('BONZINI', i * 420, 40, { font: font(FF.stencil, 110, 900), color: 'rgba(35,22,41,.8)', align: 'center', ls: 8 });
        ctx.restore();
      }
    },
  });
})();

'use strict';
// Series tag: big « DOUANE · APPRENDS À FAIRE — PARTIE 1 » strip during the hook, then a small chip top-left for the whole video
// (hidden during the sign-off). z 70: above scenes, below wipes & captions.
(() => {
  registerScene({
    id: 'tag', z: 70,
    draw(t, n) {
      const s1 = TL.seg('S1'), sign = TL.ch('sign').start;
      if (t > sign - .2) return;
      const tb = TL.wt('S1', 'bloqué', s1.end - .3), shrink = eInOutCubic(prog(t, tb - .35, tb + .05));   // big → chip right before the cut to the port photo
      const x = lerp(W / 2, 250, shrink), y = lerp(236, 196, shrink), sc = lerp(1, .52, shrink);
      const inK = pop(t, .05, 18, .5);
      at(x, y + (1 - clamp(inK)) * -60, -.02 * (1 - shrink), sc * clamp(inK, 0, 1.1), sc * clamp(inK, 0, 1.1), () => {
        const w = 800, h = 132;
        withShadow(8, () => { ctx.fillStyle = C.ink; rrect(-w / 2, -h / 2, w, h, 20); ctx.fill(); });
        ctx.fillStyle = DC.green; rrect(-w / 2 + 12, -h / 2 + 12, 250, h - 24, 12); ctx.fill();
        text('DOUANE', -w / 2 + 137, 22, { font: font(FF.stencil, 70, 900), align: 'center', color: DC.yellow, ls: 4 });
        text('APPRENDS À FAIRE', -w / 2 + 290, -4, { font: font(FF.body, 40, 800), color: C.cream });
        text('PARTIE 1', -w / 2 + 290, 42, { font: font(FF.stencil, 44, 900), color: C.amber, ls: 4 });
        ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(w / 2 - 50, 0, 18 + 3 * Math.sin(t * 5), 0, 7); ctx.fill();
      });
    },
  });
})();

'use strict';
// Series cartouche top-left, BD style: « DOUANE · APPRENDS À FAIRE — PARTIE 2 » (z 70). Hidden during the sign-off chapter.
registerScene({ id: 'tag', z: 70, draw(t, n) {
  const sign = TL.ch('signature').start; if (t > sign - .3) return;
  const k = clamp(spring(t - .3, 14, .6), 0, 1.1); if (k <= 0) return;
  ctx.save(); ctx.translate(40 + 205, 196); ctx.rotate(-.015); ctx.scale(k, k);
  const w = 410, h = 74;
  withShadow(8, () => { ctx.fillStyle = BD.ink; ctx.fillRect(-w / 2, -h / 2, w, h); });
  ctx.fillStyle = BD.recit; ctx.fillRect(-w / 2 + 8, -h / 2 + 8, 150, h - 16);
  text('DOUANE', -w / 2 + 83, 13, { font: font(FF.bd, 40, 400), align: 'center', color: BD.ink, ls: 2 });
  text('APPRENDS À FAIRE', -w / 2 + 170, -5, { font: font(FF.let, 24, 700), color: '#FFF4D6' });
  text('PARTIE 2', -w / 2 + 170, 24, { font: font(FF.bd, 28, 400), color: BD.amber, ls: 3 });
  ctx.restore();
} });

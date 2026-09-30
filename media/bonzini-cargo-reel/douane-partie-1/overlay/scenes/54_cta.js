'use strict';
// =============================================================================================
// 54_cta — S29 « Et vous, quelle étape vous fait encore peur ? Dites-le en commentaire. » (⑧ Mboppi, screen space)
//  · « Et vous »: Junior opens his hands towards us.
//  · « quelle étape »: the stations of the road come back as six small paper buttons, one after the other, in the order of
//    the journey: TRANSITAIRE · 3 QUESTIONS · NOTE · SCANNER · QUITTANCE · BON À ENLEVER
//    (each with a tiny mark of its station). NO « OUI » button, no « NON MERCI » button.
//  · « peur »: the buttons shiver once.
//  · « Dites-le en commentaire »: one big EMPTY comment bubble opens under them (blinking cursor only);
//    « commentaire »: the margouillat on the shelf turns its head towards us (34_mboppi).
//  · before the crane shot (S30) everything is unpinned and leaves.
// Layout at the S29 zoom (≈ 1.17): buttons between the margouillat (above) and Junior's head (below); the bubble under his chin,
// above the caption band. z 46 buttons · 47 comment bubble. Top-level names: none (IIFE). Scene ids F54_*.
// =============================================================================================
(() => {
  const BTN = [
    { label: 'TRANSITAIRE', x: 305, y: 524, icon: 'glasses' }, { label: '3 QUESTIONS', x: 725, y: 524, icon: 'dots' },
    { label: 'NOTE', x: 305, y: 611, icon: 'ticket' }, { label: 'SCANNER', x: 725, y: 611, icon: 'arch' },
    { label: 'QUITTANCE', x: 305, y: 698, icon: 'receipt' }, { label: 'BON À ENLEVER', x: 725, y: 698, icon: 'stamp' },
  ];
  const BH = 74, FS = 44, BUB = { x: 540, y: 1010, w: 840, h: 170 };
  let T = null;
  function tm() {
    if (T) return T;
    const o = {};
    o.vous = tw('S29', 'vous', -.2); o.b0 = tw('S29', 'quelle', -.05); o.step = .15;
    o.peur = tw('S29', 'peur', 0); o.bub = tw('S29', 'Dites', -.05); o.com = tw('S29', 'commentaire', 0);
    o.out = Math.min(se('S29', .02), CUT_BEFORE()); o.out1 = o.out + .3;
    BTN.forEach((b, i) => addShake(o.b0 + i * o.step + .06, 1.5, .06));   // paper « tic » per button (sound cues)
    addShake(o.bub + .1, 3, .1);
    T = o; return T;
  }
  const CUT_BEFORE = () => ss('S30', -1.0);                           // leave before the crane shot really moves
  const E = (t, a, d) => eInOutCubic(prog(t, a, a + d));

  // ---------- Junior: « Et vous ? » (hands open towards us) ------------------------------------------
  poseHook('junior', (t) => {
    if (!TLD) return null; const k = tm();
    if (t < k.vous - .1 || t > k.out1) return null;
    const ts = Math.floor(t * 15) / 15, a = E(ts, k.vous - .1, .25) * (1 - E(ts, k.b0 + .7, .3));
    return { face: t < k.bub ? 'smile' : 'grin', look: 0, arms: [[lerp(158, 250, a), lerp(262, 60, a)], [lerp(158, 250, a), lerp(262, 60, a)]] };
  });

  // ---------- the six station buttons --------------------------------------------------------------------
  function icon(kind) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'glasses') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 8, 0, 6.5, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(-1.5, -1); ctx.lineTo(1.5, -1); ctx.stroke(); }
    else if (kind === 'dots') { [C.violet, '#C77A12', C.orange].forEach((c, i) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-10 + i * 10, 0, 5.5, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-10 + i * 10, 0, 3.6, 0, 7); ctx.fill(); }); }
    else if (kind === 'ticket') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(11, -9); ctx.lineTo(11, 9); ctx.lineTo(-8, 9); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-7, 0, 3, 0, 7); ctx.fill(); }
    else if (kind === 'arch') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(-11, -9); ctx.lineTo(11, -9); ctx.lineTo(11, 10); ctx.stroke(); ctx.fillStyle = 'rgba(127,231,255,.95)'; ctx.fillRect(-7, -5, 14, 14); }
    else if (kind === 'receipt') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-8, -11); ctx.lineTo(8, -11); ctx.lineTo(8, 9); for (let x = 8; x > -8; x -= 4) { ctx.lineTo(x - 2, 6); ctx.lineTo(x - 4, 9); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(35,22,41,.5)'; ctx.fillRect(-5, -6, 10, 2); ctx.fillRect(-5, -1, 7, 2); }
    else { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rrect(-12, -8, 24, 16, 3); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-7, -3, 14, 2.5); ctx.fillRect(-7, 1.5, 10, 2.5); }
    ctx.restore();
  }
  const ICOL = { glasses: DC.blue, dots: C.violetD, ticket: '#C77A12', arch: '#1B6B86', receipt: DC.green, stamp: DC.red };
  function button(b, i) {
    const f = font(FF.body, FS, 800), tw_ = measure(b.label, f), w = tw_ + 118, h = BH;
    withShadow(8, () => { ctx.fillStyle = '#FFFDF7'; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); });
    ctx.strokeStyle = 'rgba(35,22,41,.14)'; ctx.lineWidth = 2; rrect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h / 2 - 5); ctx.stroke();
    ctx.fillStyle = ICOL[b.icon]; ctx.beginPath(); ctx.arc(-w / 2 + 42, 0, 26, 0, 7); ctx.fill();
    at(-w / 2 + 42, 0, 0, 1.15, 1.15, () => icon(b.icon));
    text(b.label, -w / 2 + 82, FS * .36, { font: f, color: C.ink });
  }
  function drawButtons(t, n) {
    const k = tm(); if (t < k.b0 - .05 || t > k.out1 + .4) return;
    const ts = stepT(n);
    BTN.forEach((b, i) => {
      const t0 = k.b0 + i * k.step, s = clamp(spring(ts - t0, 15, .5), 0, 1.2); if (s <= .01) return;
      const o = eInCubic(prog(t, k.out + i * .03, k.out1 + i * .03)); if (o >= 1) return;
      const shiver = t > k.peur && t < k.peur + .45 ? Math.sin((t - k.peur) * 60 + i) * .035 * (1 - (t - k.peur) / .45) : 0;
      const j = jit(540 + i, n, .35);
      at(b.x + j.x, b.y + j.y - o * 60, (i % 2 ? .012 : -.014) + shiver + j.r, s * (1 - o), s * (1 - o), () => button(b, i));
    });
  }
  // ---------- the big empty comment bubble ----------------------------------------------------------------
  function drawBubble(t, n) {
    const k = tm(); if (t < k.bub - .05 || t > k.out1 + .3) return;
    const s = clamp(spring(stepT(n) - k.bub, 13, .5), 0, 1.15) * (1 - eInCubic(prog(t, k.out + .1, k.out1 + .1)));
    if (s <= .01) return;
    at(BUB.x, BUB.y, -.01, s, s, () => commentBubble(BUB.w, '', 0, n, { h: BUB.h, size: 56 }));
  }
  const inWin = t => TLD && t > ss('S29', -.5) && t < ss('S30', 1);
  registerScene({ id: 'F54_buttons', z: 46, draw(t, n) { if (!inWin(t)) return; drawButtons(t, n); } });
  registerScene({ id: 'F54_bubble', z: 47, draw(t, n) { if (!inWin(t)) return; drawBubble(t, n); } });
})();

'use strict';
// Chapter transitions (money edition): a giant banknote, the Bonzini tape, or a receipt sheet sweeps across.
// Every chapter start except the first gets one; override with window.WIPE_STYLE = { chapterId: 'note'|'tape'|'receipt'|'none' }.
(() => {
  const DUR = .62;
  function noteWipe(k, i) {                                  // a giant note stood on its side sweeps left → right
    const x = lerp(-1500, 1500, eInOutCubic(k)), r = (Math.PI / 2 - .1) * (i % 2 ? 1 : -1);
    at(W / 2 + x, H / 2, r, 1, 1, () => {
      ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.28)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 26;
      banknote(2500, 1300, { value: [10000, 5000, 2000][i % 3], serial: 'BZ ' + String(482913 + i * 7) }); ctx.restore();
    });
  }
  function tapeWipe(k, i) {                                  // three strips of Bonzini tape, staggered
    for (let s = 0; s < 4; s++) {
      const x = lerp(-2100, 2100, eInOutCubic(clamp(k + (s - 1.5) * .02)));
      ctx.save(); ctx.translate(W / 2 + x * (s % 2 ? -1 : 1), H / 2 + (s - 1.5) * 560); ctx.rotate(-.35);
      ctx.fillStyle = C.amber; const top = tornLine(-1300, -380, 1300, -380, 3 + i + s, 5, 14), bot = tornLine(1300, 380, -1300, 380, 7 + i + s, 5, 14);
      ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath();
      ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 20; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-1300, -350, 2600, 26);
      for (let j = -3; j <= 3; j++) text('BONZINI', j * 420 + (s % 2) * 210, 40, { font: font(FF.stencil, 120, 900), color: 'rgba(35,22,41,.8)', align: 'center', ls: 8 });
      ctx.restore();
    }
  }
  function receiptWipe(k, i) {
    const y = lerp(-2300, 2300, eInOutCubic(k));
    at(W / 2, H / 2 + y, .04 * (i % 2 ? 1 : -1), 1, 1, () => {
      const w = 1300, h = 2300; ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.25)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 20;
      ctx.fillStyle = M.paper; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2);
      for (let x = -w / 2; x < w / 2; x += 36) { ctx.lineTo(x + 18, -h / 2 - 22); ctx.lineTo(x + 36, -h / 2); }
      ctx.lineTo(w / 2, h / 2); for (let x = w / 2; x > -w / 2; x -= 36) { ctx.lineTo(x - 18, h / 2 + 22); ctx.lineTo(x - 36, h / 2); } ctx.closePath(); ctx.fill(); ctx.restore();
      for (let r = 0; r < 26; r++) { const yy = -h / 2 + 120 + r * 84, lw = 300 + rnd(r * 3.1 + i) * 380;
        ctx.fillStyle = 'rgba(35,22,41,.16)'; ctx.fillRect(-w / 2 + 160, yy, lw, 26); ctx.fillRect(w / 2 - 160 - 170, yy, 170, 26); }
    });
  }
  const STY = ['note', 'receipt', 'tape'];
  registerScene({
    id: 'wipes', z: 80,
    draw(t, n) {
      const chs = TLD.chapters;
      for (let i = 1; i < chs.length; i++) {
        const c = chs[i], k = prog(t, c.start - DUR / 2, c.start + DUR / 2); if (k <= 0 || k >= 1) continue;
        const st = (window.WIPE_STYLE && window.WIPE_STYLE[c.id]) || STY[(i - 1) % STY.length];
        if (st === 'none') continue;
        if (st === 'note') noteWipe(k, i); else if (st === 'receipt') receiptWipe(k, i); else tapeWipe(k, i);
      }
    },
  });
})();

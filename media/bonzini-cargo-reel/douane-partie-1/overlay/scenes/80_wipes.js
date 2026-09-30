'use strict';
// Chapter transitions (customs edition): a giant passport page turns across, the Bonzini tape, or a barrier-striped band.
// Every chapter start except the first gets one; override with window.WIPE_STYLE = { chapterId: 'page'|'tape'|'stripes'|'none' }.
(() => {
  const DUR = .62;
  function pageWipe(k, i) {                                  // passport page (visa page) sweeps right → left, hinged feel
    const e = eInOutCubic(k), x = lerp(1700, -1700, e), sk = Math.sin(e * Math.PI) * .18;
    ctx.save(); ctx.translate(W / 2 + x, H / 2); ctx.transform(1, 0, -sk, 1, 0, 0); ctx.rotate(-.05);
    const w = 1500, h = 2400;
    ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = -24; ctx.fillStyle = '#F4EEDC'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(14,107,78,.16)'; ctx.lineWidth = 2;                         // guilloche waves
    for (let r = 0; r < 34; r++) { ctx.beginPath(); for (let xx = -w / 2; xx <= w / 2; xx += 20) { const y = -h / 2 + 60 + r * 70 + Math.sin(xx * .012 + r * .7) * 18; xx === -w / 2 ? ctx.moveTo(xx, y) : ctx.lineTo(xx, y); } ctx.stroke(); }
    ctx.fillStyle = 'rgba(14,107,78,.10)'; ctx.fillRect(-w / 2, -h / 2, 70, h);
    const labs = ['ENTRÉE', 'SORTIE', 'CONTRÔLÉ', 'VU'], cols = [DC.green, C.orange, C.violetD, DC.blue];
    for (let s = 0; s < 3; s++) { const j = (i + s) % 4; at(-260 + s * 300, -500 + s * 420, (s - 1) * .25, 1, 1, () => roundStamp(labs[j], '✓', 170, cols[j], { alpha: .75 })); }
    ctx.restore();
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
  function stripesWipe(k, i) {                               // a huge barrier arm (red/white) swings down across the frame
    const e = eInOutCubic(k), ang = lerp(-1.75, 1.75, e);
    ctx.save(); ctx.translate(-120, H / 2); ctx.rotate(ang);
    ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20; ctx.fillStyle = '#fff'; ctx.fillRect(0, -1150, 2600, 2300); ctx.shadowColor = 'transparent';
    for (let x = 0; x < 2600; x += 420) { ctx.fillStyle = DC.red; ctx.beginPath(); ctx.moveTo(x, -1150); ctx.lineTo(x + 210, -1150); ctx.lineTo(x + 210 + 500, 1150); ctx.lineTo(x + 500, 1150); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const STY = ['page', 'tape', 'stripes'];
  registerScene({
    id: 'wipes', z: 80,
    draw(t, n) {
      const chs = TLD.chapters;
      for (let i = 1; i < chs.length; i++) {
        const c = chs[i], k = prog(t, c.start - DUR / 2, c.start + DUR / 2); if (k <= 0 || k >= 1) continue;
        const st = (window.WIPE_STYLE && window.WIPE_STYLE[c.id]) || STY[(i - 1) % STY.length];
        if (st === 'none') continue;
        if (st === 'page') pageWipe(k, i); else if (st === 'stripes') stripesWipe(k, i); else tapeWipe(k, i);
      }
    },
  });
})();

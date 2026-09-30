'use strict';
// Backdrop of the diorama: a tall paper sky panel standing behind the road (horizontal parallax .55), far silhouettes
// (port cranes on the Kribi side, the city on the Douala side), paper clouds, and the time of day (screen-space tint).
(() => {
  const PX = .55, Y0 = GROUND - 1450, Y1 = GROUND - 30;
  const LX0 = (X.sea - 600) * PX, LX1 = (X.mboppi + 1400) * PX;
  /** time of day → sky colours and a multiply tint */
  function daylight(t) {
    const K = [
      { t: 0, top: '#F4EEDF', bot: '#D9E7EE', tint: null },
      { t: ss('S21', -1), top: '#F4EEDF', bot: '#D9E7EE', tint: null },
      { t: ss('S21', .5), top: '#FBE3B8', bot: '#F2B877', tint: 'rgba(255,196,120,.16)' },          // Friday, late afternoon
      { t: ss('S25', -.4), top: '#FBE3B8', bot: '#F2B877', tint: 'rgba(255,196,120,.16)' },
      { t: ss('S25', 1.2), top: '#E7A36F', bot: '#6C4A8C', tint: 'rgba(120,70,150,.22)' },           // evening road
      { t: tw('S25', 'étagères', -.4), top: '#E7A36F', bot: '#6C4A8C', tint: 'rgba(120,70,150,.22)' },
      { t: tw('S25', 'étagères', .3), top: '#FFF6E6', bot: '#E1EDF2', tint: null },                  // Saturday morning
    ];
    let a = K[0], b = K[0];
    for (let i = 1; i < K.length; i++) if (t >= K[i - 1].t) { a = K[i - 1]; b = K[i]; }
    const k = t >= K[K.length - 1].t ? 1 : prog(t, a.t, b.t); return { a, b, k: eInOutCubic(k) };
  }
  const mix = (c1, c2, k) => { const h = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)); const A = h(c1), B = h(c2); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };
  function crane(x, s, col) { at(x, Y1, 0, s, s, () => { ctx.fillStyle = col; ctx.fillRect(-10, -520, 20, 520); ctx.fillRect(-220, -520, 440, 22); ctx.fillRect(-160, -500, 14, 180); ctx.fillRect(150, -500, 14, 120);
    ctx.fillRect(-60, -30, 120, 30); ctx.beginPath(); ctx.moveTo(-10, -520); ctx.lineTo(0, -600); ctx.lineTo(10, -520); ctx.fill(); }); }
  function building(x, w, h, col, seed) { ctx.fillStyle = col; ctx.fillRect(x - w / 2, Y1 - h, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; for (let r = 0; r < Math.floor(h / 60) - 1; r++) for (let c = 0; c < Math.floor(w / 46); c++) if (rnd(seed + r * 7 + c) > .35) ctx.fillRect(x - w / 2 + 14 + c * 46, Y1 - h + 30 + r * 60, 20, 26); }
  function cloud(x, y, s, a) { at(x, y, 0, s, s, () => { ctx.fillStyle = `rgba(255,255,255,${a})`; for (const [dx, dy, r] of [[-90, 10, 70], [0, -20, 95], [100, 5, 75], [40, 30, 70], [-40, 30, 60]]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill(); } }); }
  registerScene({
    id: 'backdrop', z: 12,
    draw(t, n) {
      const d = daylight(t), top = mix(d.a.top, d.b.top, d.k), bot = mix(d.a.bot, d.b.bot, d.k);
      ctx.save(); worldBegin(t, { px: PX });
      // the standing paper panel (a flat of the diorama) with its shadow on the table
      withShadow(26, () => { const g = ctx.createLinearGradient(0, Y0, 0, Y1); g.addColorStop(0, top); g.addColorStop(1, bot); ctx.fillStyle = g; ctx.fillRect(LX0, Y0, LX1 - LX0, Y1 - Y0); });
      ctx.strokeStyle = 'rgba(120,90,60,.25)'; ctx.lineWidth = 6; ctx.strokeRect(LX0, Y0, LX1 - LX0, Y1 - Y0);
      for (let i = 0; i < 26; i++) cloud(LX0 + 300 + i * 260 + rnd(i) * 120 + Math.sin(t * .05 + i) * 30, Y0 + 180 + rnd(i * 3.3) * 380, .7 + rnd(i * 5.1) * .6, .55);
      // far port (Kribi side): cranes and a ship silhouette
      const far = 'rgba(70,90,110,.28)';
      for (let i = 0; i < 5; i++) crane((X.sea + 300 + i * 420) * PX, .9 + rnd(i) * .3, far);
      at((X.quai + 900) * PX, Y1 - 60, 0, 1, 1, () => { ctx.fillStyle = far; ctx.beginPath(); ctx.moveTo(-420, 0); ctx.lineTo(420, 0); ctx.lineTo(360, 90); ctx.lineTo(-380, 90); ctx.fill(); ctx.fillRect(-300, -90, 520, 90); ctx.fillRect(160, -180, 90, 90); });
      // the city (Douala side): buildings getting denser towards Mboppi
      for (let i = 0; i < 38; i++) { const x = (X.caisse + i * 110) * PX + rnd(i * 2.7) * 40; building(x, 60 + rnd(i * 1.9) * 80, 160 + rnd(i * 4.3) * (220 + i * 10), 'rgba(90,70,110,.20)', i * 13); }
      ctx.restore();
    },
  });
  // time-of-day tint over the whole diorama (multiply), above stations and actors, under the HUD and captions
  registerScene({ id: 'daytint', z: 65, draw(t, n) {
    const d = daylight(t), tint = d.k < .5 ? d.a.tint : d.b.tint, ta = d.a.tint && d.b.tint ? 1 : (d.a.tint ? 1 - d.k : d.k);
    if (tint) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = ta; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  } });
})();

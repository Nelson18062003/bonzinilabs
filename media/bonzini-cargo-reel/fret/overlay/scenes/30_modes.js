'use strict';
// modes (S6) → sea (S7) → air (S8) → tip (S9)
(() => {
  // ------- paper shapes (local coords, ~ 300 wide) -------
  const BOAT = [[-150, -10], [150, -10], [100, 70], [-100, 70]];                      // hull
  const SAIL = [[-10, -20], [-10, -170], [90, -20]];
  const PLANE = [[150, 0], [-120, -95], [-60, 0], [-120, 95]];                         // dart seen from above
  function poly(pts, fill, o = {}) { ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.stroke(); } }
  function morph(a, b, k) { return a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]); }
  function paperBoat(k = 1, cargo = 0) {
    // cargo containers on deck
    if (cargo > 0) { const cols = [C.sea, C.orange, C.violetD, C.amber, C.sea];
      cols.forEach((c, i) => { const d = spring(cargo * 2 - i * .12, 12, .5); if (d <= 0) return;
        ctx.fillStyle = c; rrect(-120 + i * 48, -52 - (1 - clamp(d)) * 120, 44, 42, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-116 + i * 48, -46 - (1 - clamp(d)) * 120, 36, 4); }); }
    poly(SAIL, '#FFFFFF', { stroke: 'rgba(35,22,41,.15)' }); poly([[-10, -20], [-10, -170], [30, -20]], '#EDE7F3');
    poly(BOAT, C.cream, { stroke: 'rgba(35,22,41,.18)' });
    ctx.fillStyle = C.sea; ctx.fillRect(-118, 18, 236, 22);                              // blue band like the SEA label
    poly([[-150, -10], [-100, 70], [-60, -10]], 'rgba(35,22,41,.08)'); poly([[150, -10], [100, 70], [60, -10]], 'rgba(35,22,41,.12)');
  }
  function paperPlane() {
    poly(PLANE, C.cream, { stroke: 'rgba(35,22,41,.18)' });
    poly([[150, 0], [-120, -95], [-60, 0]], '#FFFFFF'); poly([[150, 0], [-60, 0], [-120, 95]], '#E9E1D2');
    ctx.save(); ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(-120, -95); ctx.lineTo(-60, 0); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = C.air; ctx.lineWidth = 12; for (let x = -140; x < 160; x += 34) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x + 40, -60); ctx.stroke(); } ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(-60, 0); ctx.stroke();
  }
  function title(word, color, y, k, sub, band) {
    if (k <= 0) return;
    at(W / 2, y + (1 - k) * -60, 0, 1, 1, () => {
      ctx.globalAlpha *= k;
      text(word, 0, 0, { font: font(FF.stencil, 210, 900), color, align: 'center', ls: 6 });
      if (sub) { const f = font(FF.body, 40, 800), w = measure(sub, f) + 60;
        ctx.save(); ctx.fillStyle = band; rrect(-w / 2, 34, w, 64, 32); ctx.fill(); ctx.restore();
        text(sub, 0, 79, { font: f, color: '#fff', align: 'center' }); }
    });
  }
  function waves(t, n, y0, amp = 1) {             // torn blue paper strips, parallax, on twos
    const ts = stepT(n); const cols = ['#9CC3E6', '#5E9ED6', '#2F78BD', C.sea];
    cols.forEach((c, L) => {
      const y = y0 + L * 70, sp = 40 + L * 30, ph = ts * sp * .02 + L;
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-20, H);
      for (let x = -20; x <= W + 20; x += 18) ctx.lineTo(x, y + Math.sin(x * .012 + ph) * 16 * amp + (rnd(x * .3 + L * 7) - .5) * 5);
      ctx.lineTo(W + 20, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 18) { const yy = y + Math.sin(x * .012 + ph) * 16 * amp + (rnd(x * .3 + L * 7) - .5) * 5; x === -20 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
    });
  }
  function cube(k) {                               // folding-ruler 1 m³ cube, edges appear one by one
    const s = 150, P = (x, y, z) => [(x - y) * s * .87, (x + y) * s * .5 - z * s];
    const E = [[[0, 0, 0], [1, 0, 0]], [[1, 0, 0], [1, 1, 0]], [[1, 1, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 1]], [[1, 0, 0], [1, 0, 1]],
               [[1, 1, 0], [1, 1, 1]], [[0, 1, 0], [0, 1, 1]], [[0, 0, 1], [1, 0, 1]], [[1, 0, 1], [1, 1, 1]], [[1, 1, 1], [0, 1, 1]], [[0, 1, 1], [0, 0, 1]]];
    E.forEach(([a, b], i) => { const e = clamp(k * E.length - i); if (e <= 0) return; const p0 = P(...a), p1 = P(...b), p = [lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e)];
      ctx.strokeStyle = '#F6C54A'; ctx.lineWidth = 16; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p); ctx.stroke();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; const L = Math.hypot(p[0] - p0[0], p[1] - p0[1]);
      for (let d = 12; d < L; d += 15) { const q = [p0[0] + (p[0] - p0[0]) * d / L, p0[1] + (p[1] - p0[1]) * d / L]; ctx.beginPath(); ctx.arc(q[0], q[1], 1.5, 0, 7); ctx.stroke(); } });
    if (k >= 1) text('1 m³', 0, -s * .5, { font: font(FF.mono, 64, 800), align: 'center', color: C.ink });
  }
  function springScale(k, t) {                     // hanging spring scale with a small parcel
    const stretch = 40 + 90 * clamp(spring(t, 8, .3), 0, 1.4);
    ctx.fillStyle = '#2B2230'; ctx.beginPath(); ctx.arc(0, -140, 16, 0, 7); ctx.fill();
    ctx.fillStyle = '#D9D2C4'; rrect(-38, -130, 76, 150, 14); ctx.fill(); ctx.fillStyle = C.cream; rrect(-26, -118, 52, 124, 8); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; for (let y = -110; y < 0; y += 12) { ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(-6, y); ctx.stroke(); }
    ctx.fillStyle = C.orange; ctx.fillRect(-24, -110 + clamp(stretch / 130) * 100, 48, 5);
    ctx.strokeStyle = '#6A6070'; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i <= 14; i++) ctx.lineTo((i % 2 ? 12 : -12), 20 + i * stretch / 14); ctx.stroke();
    at(0, 40 + stretch + 60, 0, 1, 1, () => withShadow(6, () => carton(150, 110, { seed: 77 })));
    text('kg', 70, -40, { font: font(FF.mono, 60, 800), color: C.ink });
  }

  let M = null;
  function times() {
    return { md: TL.ch('modes'), sea: TL.ch('sea'), air: TL.ch('air'), tip: TL.ch('tip'),
      deux: TL.wt('S6', 'deux'), voy: TL.wt('S6', 'voyager'),
      mar: TL.wt('S7', 'maritime'), cont: TL.wt('S7', 'conteneur'), m3: TL.wt('S7', 'metre'), eco: TL.wt('S7', 'economique'), vol: TL.wt('S7', 'volumes'),
      aer: TL.wt('S8', 'aerien'), avion: TL.wt('S8', 'avion'), kilo: TL.wt('S8', 'kilo'), rap: TL.wt('S8', 'rapide'), urg: TL.wt('S8', 'urgent'), pet: TL.wt('S8', 'petits'),
      ret: TL.wt('S9', 'retenez'), bleue: TL.wt('S9', 'bleue'), bateau: TL.wt('S9', 'bateau'), rouge: TL.wt('S9', 'rouge'), avion2: TL.wt('S9', 'avion') };
  }

  registerScene({
    id: 'modes', z: 30, when: t => t >= TL.ch('modes').start - .1 && t < TL.ch('tip').end + .1,
    draw(t, n) {
      if (!M) M = times();
      const ts = stepT(n);
      // ---------------- modes: one sheet → boat + plane
      if (t < M.sea.start + .6) {
        const k0 = spring(ts - M.md.start - .05, 10, .5), split = eInOutCubic(prog(t, M.deux - .1, M.deux + .45)), fold = eInOutCubic(prog(t, M.deux + .25, M.voy + .1));
        const leave = eInCubic(prog(t, M.sea.start - .2, M.sea.start + .5));
        title('2 FAÇONS', C.ink, 360, eOutCubic(prog(t, M.deux - .2, M.deux + .2)) * (1 - leave), 'de voyager', C.violetD);
        const L = [[-150, -110], [0, -110], [0, 110], [-150, 110]], R = [[0, -110], [150, -110], [150, 110], [0, 110]];
        // left half → boat
        at(W / 2 - split * 250 - leave * 900, 800 + (1 - clamp(k0)) * 900, -.04 * split, 1.6 + .15 * fold, 1.6 + .15 * fold, () => withShadow(14, () => {
          if (fold < 1) { ctx.globalAlpha = 1 - fold; poly(morph(L, [[-150, -10], [150, -10], [100, 70], [-100, 70]], fold), C.cream, { stroke: 'rgba(35,22,41,.18)' }); ctx.globalAlpha = 1; }
          if (fold > 0) { ctx.globalAlpha = fold; at(0, 0, 0, .5 + .5 * fold, .5 + .5 * fold, () => paperBoat()); ctx.globalAlpha = 1; }
        }));
        at(W / 2 + split * 250 + leave * 900, 800 + (1 - clamp(k0)) * 900, .04 * split, 1.6 + .15 * fold, 1.6 + .15 * fold, () => withShadow(14, () => {
          if (fold < 1) { ctx.globalAlpha = 1 - fold; poly(morph(R, PLANE, fold), C.cream, { stroke: 'rgba(35,22,41,.18)' }); ctx.globalAlpha = 1; }
          if (fold > 0) { ctx.globalAlpha = fold; at(0, 0, -.35 * fold, .5 + .5 * fold, .5 + .5 * fold, () => paperPlane()); ctx.globalAlpha = 1; }
        }));
        if (split > .5 && fold < .05) { ctx.strokeStyle = C.violet; ctx.lineWidth = 4; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(W / 2, 600); ctx.lineTo(W / 2, 1000); ctx.stroke(); ctx.setLineDash([]); }
      }
      // ---------------- sea
      if (t >= M.sea.start - .3 && t < M.air.start + .5) {
        const inK = eOutCubic(prog(t, M.sea.start - .3, M.sea.start + .3)), outK = eInCubic(prog(t, M.air.start - .15, M.air.start + .45));
        ctx.save(); ctx.translate(-outK * W, 0);
        title('MARITIME', C.sea, 330, prog(t, M.mar - .2, M.mar + .15), 'SEA CARGO · 海运', C.sea);
        waves(t, n, 1010 + (1 - inK) * 500, 1);
        const bx = lerp(-220, 640, prog(ts, M.sea.start, M.air.start + .4)), bob = Math.sin(ts * 3) * 10;
        at(bx, 905 + bob + (1 - inK) * 500, Math.sin(ts * 2.4) * .04, 1.75, 1.75, () => paperBoat(1, prog(t, M.cont - .1, M.cont + .8)));
        waves(t, n, 1090 + (1 - inK) * 500, .7);
        const c1 = prog(ts, M.cont, M.cont + .15), c2 = prog(ts, M.m3, M.m3 + .15), c3 = prog(ts, M.eco, M.eco + .15);
        if (c1 > 0) chip(300, 520, 'En conteneur', { check: true, checkFill: C.sea, s: eOutBack(c1), size: 46, rot: -.03 });
        if (c2 > 0) { chip(300, 640, 'Facturé au m³', { check: true, checkFill: C.sea, s: eOutBack(c2), size: 46, rot: .02 });
          at(800, 700, 0, .9, .9, () => cube(prog(t, M.m3, M.m3 + 1.0))); }
        if (c3 > 0) chip(W / 2, 1175, 'Plus économique · gros volumes', { check: true, checkFill: C.amber, fill: C.cream, color: C.ink, s: eOutBack(c3), size: 44 });
        ctx.restore();
      }
      // ---------------- air
      if (t >= M.air.start - .3 && t < M.tip.start + .4) {
        const inK = eOutCubic(prog(t, M.air.start - .3, M.air.start + .35)), outK = eInCubic(prog(t, M.tip.start - .15, M.tip.start + .35));
        ctx.save(); ctx.translate(W * (1 - inK) - outK * W, 0);
        // torn-paper clouds
        for (let i = 0; i < 5; i++) { const x = ((rnd(i * 3.1) * 1400 - stepT(n) * (60 + i * 25)) % 1400 + 1400) % 1400 - 160, y = 520 + i * 110;
          ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x, y, 130, 42, 0, 0, 7); ctx.ellipse(x + 70, y - 22, 80, 40, 0, 0, 7); ctx.fill(); }
        title('AÉRIEN', C.air, 330, prog(t, M.aer - .2, M.aer + .15), 'AIR CARGO · 空运', C.air);
        // string + plane zipping along it with orange smears
        const s0 = [-160, 1180], s1 = [W + 260, 880], pk = eInOutCubic(prog(ts, M.air.start + .1, M.avion + 1.6));
        ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...s0); ctx.lineTo(...s1); ctx.stroke();
        const px = lerp(s0[0], s1[0], .12 + .88 * pk), py = lerp(s0[1], s1[1], .12 + .88 * pk), ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]);
        const spd = pk > 0 && pk < 1 ? 1 : .3;
        for (let i = 1; i <= 4; i++) { ctx.strokeStyle = `rgba(254,86,13,${.35 * spd / i})`; ctx.lineWidth = 16 - i * 3; ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * 60, py - Math.sin(ang) * 60 + (i - 2.5) * 16);
          ctx.lineTo(px - Math.cos(ang) * (120 + i * 60), py - Math.sin(ang) * (120 + i * 60) + (i - 2.5) * 16); ctx.stroke(); }
        at(px, py, ang, 1.5, 1.5, () => withShadow(60, () => paperPlane()));
        const c1 = prog(ts, M.avion, M.avion + .15), c2 = prog(ts, M.kilo, M.kilo + .15), c3 = prog(ts, M.rap, M.rap + .15), c4 = prog(ts, M.pet, M.pet + .15);
        if (c1 > 0) chip(290, 520, 'En avion', { check: true, checkFill: C.air, s: eOutBack(c1), size: 46, rot: -.03 });
        if (c2 > 0) { chip(310, 640, 'Facturé au kilo', { check: true, checkFill: C.air, s: eOutBack(c2), size: 46, rot: .02 });
          at(850, 600, 0, .95, .95, () => springScale(1, ts - M.kilo)); }
        if (c3 > 0) chip(330, 800, 'Plus rapide', { check: true, checkFill: C.orange, fill: C.cream, color: C.ink, s: eOutBack(c3), size: 46 });
        const u = prog(ts, M.urg, M.urg + .1);
        if (u > 0) at(770, 1080, -.12, 1 + .25 * (1 - u), 1 + .25 * (1 - u), () => withShadow(4, () => { ctx.fillStyle = C.orange; rrect(-150, -48, 300, 96, 10); ctx.fill();
          text('URGENT', 0, 22, { font: font(FF.stencil, 70, 900), color: '#fff', align: 'center', ls: 4 }); }));
        if (c4 > 0) chip(330, 1060, 'Petits colis', { check: true, checkFill: C.orange, fill: C.cream, color: C.ink, s: eOutBack(c4), size: 44 });
        ctx.restore();
      }
      // ---------------- tip: blue label = boat, red label = plane
      if (t >= M.tip.start - .3 && t < M.tip.end + .1) {
        const inK = eOutCubic(prog(t, M.tip.start - .2, M.tip.start + .3)), outK = eInCubic(prog(t, M.tip.end - .3, M.tip.end));
        ctx.save(); ctx.translate(0, -outK * 1700);
        const nt = prog(t, M.ret - .15, M.ret + .15);
        if (nt > 0) paperNote(W / 2, 250 - (1 - nt) * 40, 460, 120, -.03, () => text('Retenez !', 0, 22, { font: font(FF.hand, 70, 800), align: 'center', color: C.violetD }), { seed: 44 });
        const rows = [['sea', M.bleue, M.bateau, '= bateau', 560], ['air', M.rouge, M.avion2, '= avion', 900]];
        rows.forEach(([mode, t0, t1, lab, y], i) => {
          const k = spring(stepT(n) - (t0 - .25), 11, .45); if (k <= 0) return;
          const x = lerp(i ? W + 500 : -500, 400, clamp(k, 0, 1.08));
          at(x, y + (1 - inK) * 400, i ? .03 : -.03, .78, .78, () => withShadow(16, () => shipLabel(640, 400, mode, 'BZ-482913', { seed: 7 + i })));
          const lk = prog(stepT(n), t1 - .1, t1 + .1);
          if (lk > 0) { at(830, y + 10, 0, eOutBack(lk), eOutBack(lk), () => { ctx.save(); mode === 'sea' ? paperBoatMini() : paperPlaneMini(); ctx.restore(); });
            text(lab, 830, y + 160, { font: font(FF.body, 56, 800), align: 'center', color: mode === 'sea' ? C.sea : C.air, alpha: lk }); }
        });
        ctx.restore();
      }
      function paperBoatMini() { ctx.scale(.8, .8); paperBoat(); }
      function paperPlaneMini() { ctx.scale(.75, .75); ctx.rotate(-.35); paperPlane(); }
    },
  });
})();

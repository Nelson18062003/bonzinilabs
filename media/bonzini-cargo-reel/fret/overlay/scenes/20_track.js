'use strict';
// track (S4): Guangzhou → scan → "à votre nom" → pesé → mesuré → the thread laces through 5 tickets → Douala.
// resell (S5): the reseller's carton opens, 4 client cartons each with their own code, thread splits, "TRANSPARENCE TOTALE".
(() => {
  const CODE = 'BZ-482913';
  let T = null;
  function times() {
    const ch = TL.ch('track');
    return { ch, gz: TL.wt('S4', 'guangzhou'), scan: TL.wt('S4', 'scan'), nom: TL.wt('S4', 'nom'), votre: TL.wt('S4', 'votre'),
      pese: TL.wt('S4', 'pese'), mesure: TL.wt('S4', 'mesure'), suivi: TL.wt('S4', 'suivi'), retrait: TL.wt('S4', 'retrait'), douala: TL.wt('S4', 'douala'),
      end: ch.end };
  }
  const TICKETS = [
    ['Reçu', 'Guangzhou'], ['Chargé', 'conteneur ou avion'], ['En route', 'mer ou air'], ['Arrivé', 'Douala'], ['Retrait', 'avec votre code'],
  ];
  function ticketPos(i) { return [i % 2 ? 640 : 500, 600 + i * 128]; }

  registerScene({
    id: 'track', z: 20, when: t => TL.in(t, 'track', .1, .1),
    draw(t, n) {
      if (!T) T = times();
      const ts = stepT(n), ch = T.ch;
      const inK = eOutCubic(prog(t, ch.start, ch.start + .35)), outK = eInCubic(prog(t, ch.end - .3, ch.end));
      // phase 2 (tracking): parcel shrinks to the top-left, tickets take the stage
      const ph = eInOutCubic(prog(t, T.suivi - .35, T.suivi + .25));
      const px = lerp(W / 2, 250, ph), py = lerp(640, 330, ph), ps = lerp(1, .46, ph);
      ctx.save(); ctx.translate(0, outK * -1600);
      // --- the parcel with its label ---
      const j = jit(300, n, .5);
      at(px + j.x, py + j.y + (1 - inK) * 900, j.r, ps, ps, () => {
        // scale under it (pesé)
        const pk = prog(ts, T.pese - .25, T.pese + .1);
        if (pk > 0) at(0, 150 - (1 - eOutBack(pk)) * 60, 0, 1, 1, () => withShadow(4, () => scaleDevice(520, spring(ts - T.pese, 9, .35))));
        withShadow(pk > 0 ? 10 : 6, () => carton(460, 350, { seed: 91, tape: false, label: () => at(0, -10, -.02, .62, .62, () => shipLabel(640, 400, 'sea', CODE)) }));
        // tape measure (mesuré)
        const mk = prog(ts, T.mesure - .05, T.mesure + .45);
        if (mk > 0) { at(-230, 205, 0, 1, 1, () => tapeMeasure(460, eOutCubic(mk)));
          at(260, -175, 0, 1, 1, () => tapeMeasure(350, eOutCubic(prog(ts, T.mesure + .15, T.mesure + .55)), true)); }
      });
      // Guangzhou note
      const gz = env(t, T.gz - .15, T.suivi - .2, .3, .3);
      if (gz > 0) paperNote(W / 2, 250 - (1 - gz) * 40, 640, 120, -.02, () => {
        pin0(-270, -6); text('Guangzhou · entrepôt', 12, 20, { size: 56, wght: 800, align: 'center' }); }, { seed: 21 });
      // scanner + laser
      const sk = env(t, T.scan - .45, T.nom + .2, .3, .35);
      if (sk > 0 && ph < .5) {
        const sx = lerp(W + 200, 830, eOutCubic(sk)), sy = 575, beam = env(t, T.scan - .05, T.scan + .55, .05, .1);
        laser(sx - 8, sy, W / 2 - 60, 520, 690, beam * (0.8 + .2 * Math.sin(t * 60)));
        at(sx, sy, .05, 1, 1, () => withShadow(40, () => scanner(beam)));
      }
      // "à votre nom" chip
      const ck = prog(ts, T.votre - .05, T.votre + .2);
      const ckOut = 1 - prog(ts, T.pese - .3, T.pese - .1);
      if (ck > 0 && ckOut > 0) chip(W / 2, 915, 'À votre nom · ' + CODE, { check: true, s: eOutBack(ck) * ckOut, size: 44 });
      // "Pesé ✓" / "Mesuré ✓"
      if (ph < 1) {
        const a1 = prog(ts, T.pese, T.pese + .15), a2 = prog(ts, T.mesure + .2, T.mesure + .35);
        if (a1 > 0) chip(300, 1085, 'Pesé', { check: true, s: eOutBack(a1) * (1 - ph), fill: C.cream, color: C.ink, size: 44 });
        if (a2 > 0) chip(740, 1085, 'Mesuré', { check: true, s: eOutBack(a2) * (1 - ph), fill: C.cream, color: C.ink, size: 44 });
      }
      // --- tickets + thread (suivi à chaque étape → Douala) ---
      if (ph > 0) {
        const t0 = T.suivi, t1 = T.douala + .35, pts = [[px + 80 * ps, py + 20]];
        TICKETS.forEach((_, i) => { const [x, y] = ticketPos(i); pts.push([x - 235 + 38, y]); pts.push([x - 235 + 38 + (i % 2 ? -60 : 60), y + 64]); });
        const path = curve(pts, 10);
        const pk = eInOutCubic(prog(t, t0, t1));
        TICKETS.forEach(([a, b], i) => {
          const [x, y] = ticketPos(i), app = spring(ts - (t0 - .15 + i * .1), 12, .45); if (app <= 0) return;
          const reached = pk * (TICKETS.length) > i + .35;
          const jj = jit(200 + i, n, .5);
          at(x + jj.x, y + jj.y, (i % 2 ? .03 : -.03) + jj.r, app, app, () => withShadow(6, () => ticket(470, 112, a, b, {
            fill: i === 3 && t > T.douala ? '#FFE8C2' : C.cream, done: reached ? prog(t, t0 + (i + .4) * (t1 - t0) / 5, t0 + (i + .7) * (t1 - t0) / 5) : 0 })));
        });
        const head = thread(path, pk, n, { w: 7 });
        if (head && pk < 1) { ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(head[0], head[1], 9, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    },
  });
  function pin0(x, y) { ctx.save(); ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(x, y - 14, 18, Math.PI * .85, Math.PI * 2.15); ctx.lineTo(x, y + 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(x, y - 14, 7, 0, 7); ctx.fill(); ctx.restore(); }

  // ---------------------------------------------------------------- resell
  const SUBS = [['BZ-731406', 190, 930], ['BZ-290518', 420, 1075], ['BZ-864132', 660, 1075], ['BZ-517209', 890, 930]];
  let R = null;
  registerScene({
    id: 'resell', z: 20, when: t => TL.in(t, 'resell', .1, .1),
    draw(t, n) {
      if (!R) R = { ch: TL.ch('resell'), q: TL.wt('S5', 'vous'), chacun: TL.wt('S5', 'chacun'), code: TL.wt('S5', 'code'), transp: TL.wt('S5', 'transparence') };
      const ts = stepT(n), ch = R.ch, outK = eInCubic(prog(t, ch.end - .3, ch.end));
      ctx.save(); ctx.translate(0, -outK * 1700);
      // question note
      const qn = env(t, R.q - .1, R.transp - .1, .3, .3);
      if (qn > 0) paperNote(W / 2, 240 - (1 - qn) * 40, 560, 120, .025, () => text('Vous revendez ?', 0, 20, { font: font(FF.hand, 64, 700), align: 'center', color: C.violetD }), { seed: 33 });
      // big reseller carton, flaps open on "Chacun"
      const bin = spring(ts - (ch.start + .05), 10, .5), open = eOutBack(prog(ts, R.chacun - .15, R.chacun + .25));
      const bx = W / 2, by = 590;
      at(bx, by + (1 - clamp(bin)) * 900, 0, 1, 1, () => {
        withShadow(10, () => carton(470, 330, { seed: 55, tape: open < .05, seam: open < .05, label: () => {
          if (open >= .05) { ctx.fillStyle = '#6E4E2C'; rrect(-215, -145, 430, 290, 6); ctx.fill(); }
          else at(0, 0, 0, .55, .55, () => { ctx.fillStyle = C.cream; rrect(-260, -80, 520, 160, 14); ctx.fill(); text('VOTRE COMPTE', 0, 22, { font: font(FF.stencil, 76, 800), align: 'center' }); });
        } }));
        if (open >= .05) {                         // 4 flaps folding outward (top view)
          const fl = [[0, -165, 470, 150, 0], [0, 165, 470, 150, Math.PI], [-235, 0, 330, 150, -Math.PI / 2], [235, 0, 330, 150, Math.PI / 2]];
          fl.forEach(([x, y, w, h, r], i) => at(x, y, r, 1, 1, () => { ctx.save(); ctx.scale(1, -open);
            ctx.fillStyle = TEX.kraft; rrect(-w / 2, 0, w, h, 4); ctx.fill(); ctx.fillStyle = 'rgba(90,60,30,.25)'; ctx.fillRect(-w / 2, 0, w, 10); ctx.restore(); }));
        }
      });
      // client cartons pop out along arcs + thread strands
      SUBS.forEach(([code, x, y], i) => {
        const t0 = R.chacun + .05 + i * .12, k = spring(ts - t0, 11, .42); if (k <= 0) return;
        const cx = lerp(bx, x, clamp(k)), cy = lerp(by, y, clamp(k)) - Math.sin(Math.PI * clamp(k)) * 160;
        const strand = [[bx, by + 60], [lerp(bx, x, .5), by + 250], [x, y - 70]];
        thread(curve(strand, 12), eOutCubic(prog(t, t0 + .1, t0 + .6)), n, { w: 5 });
        const j = jit(600 + i, n, .6);
        at(cx + j.x, cy + j.y, (i - 1.5) * .06 + j.r, clamp(k, 0, 1.15) * .86, clamp(k, 0, 1.15) * .86, () => withShadow(6, () => carton(250, 190, { seed: 60 + i, tape: false, label: () => {
          ctx.fillStyle = C.cream; rrect(-110, -44, 220, 88, 10); ctx.fill();
          const sk = prog(ts, R.code - .1 + i * .1, R.code + i * .1);
          if (sk > 0) stampText(code, 0, 2, font(FF.mono, 38, 800), C.violet, { starve: .35, alpha: sk });
        } })));
        const lk = prog(ts, R.code + .25 + i * .08, R.code + .45 + i * .08);
        if (lk > 0) text('Client ' + (i + 1), x, y + 150, { size: 44, wght: 800, align: 'center', alpha: lk });
      });
      // TRANSPARENCE TOTALE stamp
      if (t >= R.transp) {
        const k = t - R.transp, sc = k < .07 ? 1.3 : 1 + .06 * Math.exp(-k * 9);
        at(W / 2, 790, -.12, sc, sc, () => stampText('TRANSPARENCE TOTALE', 0, 0, font(FF.stencil, 104, 900), C.violetD, { box: true, h: 150, boxW: 10, starve: .35 }));
      }
      ctx.restore();
    },
  });
})();

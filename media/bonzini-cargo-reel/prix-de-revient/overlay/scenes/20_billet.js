'use strict';
// THE SPINE (S1 → S12, then S22 loop): a 10 000 F spécimen note cut live into 7 slices sized to each cost,
// tailor's scissors snapping on every « tchac », the RESTE SUR LE BILLET calculator, 7 kraft envelopes.
// Layout contract: note centre (540, 500) 880×420 · envelopes row y≈815 · vignettes zone y 880–1230 (other scenes) · captions 1250–1430.
const BILLET = {
  cx: 540, cy: 500, w: 880, h: 420,
  frac: [.50, .015, .02, .08, .30, .035, .05],
  value: [5000, 150, 200, 800, 3000, 350, 500],
  label: ['FOURNISSEUR', 'TAUX + FRAIS', 'CAMION CHINE', 'BATEAU', 'DOUANE', 'PETITS FRAIS', 'PERTES'],
  envY: 815,
};
(() => {
  const B = BILLET;
  let T = null;
  function times() {
    const w = (s, k, nth = 0) => TL.wt(s, k, null, nth);
    // cut k happens at these moments (S8 = two strokes: half at first tchac, the rest at the second)
    const cut = [w('S2', 'tchac'), w('S5', 'tchac'), w('S6', 'tchac'), w('S7', 'tchac'), w('S8', 'tchac', 1), w('S9', 'tchac'), w('S11', 'tchac')];
    return { cut, cut8a: w('S8', 'tchac', 0), s1: TL.seg('S1'), s12: TL.seg('S12'), rien: w('S12', 'rien'), zero: w('S12', 'zero'),
      s13: TL.seg('S13'), s22: TL.seg('S22'), s23: TL.seg('S23'), decouper: w('S1', 'decouper'), devant: w('S1', 'devant'),
      maigrit2: w('S2', 'maigrit'), maigrit7: w('S7', 'maigrit'), maintenant: w('S4', 'maintenant') };
  }
  const edges = () => { const e = [-B.w / 2]; for (const f of B.frac) e.push(e[e.length - 1] + f * B.w); return e; };   // local x of cut lines
  const envX = k => 90 + k * 150;
  // how much of slice k is gone at t: 0 = attached, 1 = gone. S8 has two strokes.
  function gone(k, t) {
    if (k === 4) return t >= T.cut[4] ? 1 : t >= T.cut8a ? .5 : 0;
    return t >= T.cut[k] ? 1 : 0;
  }
  // horizontal offset that keeps the remaining piece centred (eases after every cut)
  function remainCentre(t) { const e = edges(); let k = 0; while (k < 7 && gone(k, t) >= 1) k++; if (k >= 7) return 0;
    const l = gone(4, t) === .5 && k === 4 ? (e[4] + e[5]) / 2 : e[k]; return (l + B.w / 2) / 2; }
  function noteOffset(t) { const c = lastCut(t); if (!c) return 0; const before = -remainCentre(c - .01), after = -remainCentre(t);
    return lerp(before, after, eInOutCubic(prog(t, c + .25, c + .85))); }
  function removedValue(t) { let v = 0; B.value.forEach((x, k) => { v += x * gone(k, t); }); return v; }

  // ------------------------------------------------------------------ persistent chrome
  function exempleStamp(t, n) {
    const a = clamp(t / .25) * (1 - prog(t, TL.seg('S19').end + .2, TL.seg('S19').end + .6));
    if (a <= 0) return;
    at(140, 200, -.07, .8, .8, () => stampText('EXEMPLE FICTIF', 0, 0, font(FF.stencil, 44, 900), C.violetD, { box: true, boxW: 5, h: 70, alpha: a * .9, ls: 3 }));
  }
  function calcPlate(t, n) {                                  // "RESTE SUR LE BILLET" LCD plate, top-right
    const a = env(t, .15, T.s12.end + 1.2, .3, .4); if (a <= 0) return;
    const v = 10000 - removedValue(t), shown = Math.round(countTo(v + lastDrop(t), v, prog(t, lastCut(t), lastCut(t) + .35)));
    const flash = t - lastCut(t) < .25 && lastCut(t) > 0;
    at(830, 215, .02, 1, 1, () => { ctx.globalAlpha *= a;
      withShadow(10, () => { ctx.fillStyle = '#2B2230'; rrect(-190, -78, 380, 156, 22); ctx.fill(); });
      ctx.fillStyle = flash ? '#F7D6CF' : M.lcd; rrect(-170, -30, 340, 92, 12); ctx.fill();
      text('RESTE SUR LE BILLET', 0, -44, { font: font(FF.mono, 22, 800), align: 'center', color: C.amber, ls: 1 });
      text(fmtN(shown) + ' F', 150, 40, { font: font(FF.mono, 58, 800), align: 'right', color: v === 0 && t > T.cut[6] ? M.red : M.lcdInk });
    });
  }
  function lastCut(t) { let c = 0; for (const x of [...T.cut, T.cut8a]) if (t >= x && x > c) c = x; return c; }
  function lastDrop(t) {                                    // value removed at the last cut (for the rolling digits)
    const c = lastCut(t); if (!c) return 0;
    if (c === T.cut8a) return B.value[4] * .5; if (c === T.cut[4]) return B.value[4] * .5;
    const k = T.cut.indexOf(c); return k >= 0 ? B.value[k] : 0;
  }
  function envelopes(t, n) {
    const a = env(t, T.cut[0] - .6, T.s12.end + 1.0, .4, .4); if (a <= 0) return;
    B.label.forEach((lab, k) => {
      const x = envX(k), y = B.envY, full = t >= T.cut[k] + .45 || (k === 4 && t >= T.cut8a + .45);
      const pop = full ? spring(t - (k === 4 && t < T.cut[4] + .45 ? T.cut8a : T.cut[k]) - .45, 14, .4) : 0, j = jit(k + 300, n, .5);
      at(x + j.x, y + j.y, (k % 2 ? .03 : -.03), 1 + .08 * Math.sin(clamp(pop) * Math.PI), 1 + .08 * Math.sin(clamp(pop) * Math.PI), () => {
        ctx.globalAlpha *= a;
        withShadow(4, () => { ctx.fillStyle = C.kraftL; rrect(-66, -44, 132, 88, 6); ctx.fill(); });
        ctx.fillStyle = TEX.kraft; ctx.globalAlpha *= .55; rrect(-66, -44, 132, 88, 6); ctx.fill(); ctx.globalAlpha /= .55;
        ctx.fillStyle = 'rgba(90,60,30,.35)'; ctx.beginPath(); ctx.moveTo(-66, -44); ctx.lineTo(0, 4); ctx.lineTo(66, -44); ctx.closePath(); ctx.fill();
        if (full) { ctx.strokeStyle = C.violet; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-66, -2); ctx.lineTo(66, -2); ctx.stroke(); }
        const f = font(FF.stencil, 21, 800); const parts = lab.split(' ');
        const l1 = parts.length > 1 ? parts.slice(0, -1).join(' ') : lab, l2 = parts.length > 1 ? parts[parts.length - 1] : '';
        text(l1, 0, l2 ? 20 : 30, { font: f, align: 'center', color: C.ink, ls: 1 }); if (l2) text(l2, 0, 40, { font: f, align: 'center', color: C.ink, ls: 1 });
        if (full) handText(fmtN(B.value[k]), 0, -56, 40, { color: k === 4 ? M.red : C.violetD, pen: false });
      });
    });
  }
  // ------------------------------------------------------------------ the note
  function noteArea(t, n) {
    const e = edges();
    // before the first cut: slam in (frame 3), pencil cut-lines draw during S1
    const land = drop(t, -.02, 260, .16);
    const leftGone = (() => { let k = 0; while (k < 7 && gone(k, t) >= 1) k++; return k; })();   // number of fully removed slices from the left
    const x0 = e[leftGone] + (leftGone === 4 && gone(4, t) === .5 ? 0 : 0);
    const half8 = gone(4, t) === .5;
    const cutX = half8 ? (e[4] + e[5]) / 2 : null;
    const zoom = 1 + .03 * clamp(t / 4) - .03 * eInOutCubic(prog(t, T.cut[0] + .2, T.cut[0] + 1.2));
    const off = noteOffset(t);
    at(B.cx + off, B.cy + land.y, -.012, zoom * land.sx, zoom * land.sy, () => {
      // pencil outline of the full note (visible once pieces are gone)
      ctx.save(); ctx.strokeStyle = 'rgba(60,50,70,.35)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; rrect(-B.w / 2, -B.h / 2, B.w, B.h, 14); ctx.stroke(); ctx.restore();
      if (leftGone < 7) {
        const clipL = half8 ? cutX : e[leftGone];
        withShadow(6, () => banknote(B.w, B.h, { value: 10000, serial: 'SPÉCIMEN', clip: [clipL, B.w / 2 + 2] }));
        // pencil cut lines (drawn during S1)
        const pk = prog(t, T.decouper - .9, T.decouper - .1);
        ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.lineWidth = 3; ctx.setLineDash([12, 9]);
        for (let i = 1; i < 7; i++) { if (e[i] <= clipL + 1) continue; const kk = clamp(pk * 7 - (i - 1)); if (kk <= 0) continue;
          ctx.beginPath(); ctx.moveTo(e[i], -B.h / 2 - 16); ctx.lineTo(e[i], -B.h / 2 - 16 + (B.h + 32) * kk); ctx.stroke(); }
        ctx.restore();
        // SPÉCIMEN micro-stamp
        ctx.save(); ctx.beginPath(); ctx.rect(clipL, -B.h / 2, B.w / 2 - clipL, B.h); ctx.clip();
        stampText('SPÉCIMEN', 190, 150, font(FF.stencil, 40, 900), 'rgba(123,34,214,.9)', { alpha: .7, ls: 6 }); ctx.restore();
      } else {
        // crumbs of paper where the note was
        for (let i = 0; i < 26; i++) { ctx.fillStyle = i % 3 ? '#E7E4C4' : '#CFE3C9'; at((rnd(i * 3.3) - .5) * B.w * .9, (rnd(i * 5.1) - .5) * B.h * .8, rnd(i) * 6, 1, 1, () => ctx.fillRect(-7, -4, 14, 8)); }
      }
      // S1 gag: a small corner flies at "découper"
      const cf = t - T.decouper; if (cf > 0 && cf < 1.2) at(-B.w / 2 + 40 + cf * 300, -B.h / 2 + 40 - cf * 700 + 900 * cf * cf, cf * 9, 1 - cf * .4, 1 - cf * .4, () => { ctx.fillStyle = '#CFE3C9'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(60, 0); ctx.lineTo(0, 44); ctx.closePath(); ctx.fill(); });
    });
    // flying slices → envelopes
    for (let k = 0; k < 7; k++) {
      const strokes = k === 4 ? [[T.cut8a, e[4], (e[4] + e[5]) / 2], [T.cut[4], (e[4] + e[5]) / 2, e[5]]] : [[T.cut[k], e[k], e[k + 1]]];
      for (const [tc, a, b] of strokes) {
        const s = t - tc; if (s < 0 || s > .75) continue;
        const k1 = eInOutCubic(clamp(s / .6)), x = lerp(B.cx + noteOffset(tc - .01) + (a + b) / 2, envX(k), k1), y = lerp(B.cy, B.envY - 10, k1) - Math.sin(k1 * Math.PI) * 120;
        const sc = lerp(1, .12, k1), rot = (k % 2 ? 1 : -1) * k1 * 1.2;
        at(x, y, rot, sc, sc, () => withShadow(12, () => banknote(B.w, B.h, { value: 10000, serial: 'SPÉCIMEN', clip: [a, b], alpha: 1 - clamp((s - .6) / .15) }) , 0));
      }
    }
  }
  // scissors choreography: hover at the next cut line, snap on the cut time
  function scissorsDance(t, n) {
    const e = edges();
    const cuts = [[T.cut[0], e[1]], [T.cut[1], e[2]], [T.cut[2], e[3]], [T.cut[3], e[4]], [T.cut8a, (e[4] + e[5]) / 2], [T.cut[4], e[5]], [T.cut[5], e[6]], [T.cut[6], e[7] - 2]];
    const tIn = 0, tOut = T.s12.start + .4;                                          // on screen from frame 0 (hook composition)
    if (t < tIn || t > T.rien + .6) return;
    // current target = next cut not yet done (or last)
    let i = cuts.findIndex(([tc]) => t < tc + .25); if (i < 0) i = cuts.length - 1;
    const [tc, lx] = cuts[i], prev = i > 0 ? cuts[i - 1] : [T.decouper - 1.2, -90];     // hover over the right half until « découper »
    const travel = eInOutCubic(prog(t, prev[0] + .3, Math.min(prev[0] + .9, tc - .25)));
    let x = B.cx + noteOffset(t) + lerp(prev[1], lx, travel), snap = t - tc;
    const park = eInOutCubic(prog(t, T.cut[6] + .4, T.cut[6] + 1.2));            // after the last cut: glide over the empty outline
    if (park > 0) x = lerp(x, B.cx - 60, park);
    const open = snap < 0 ? .45 + .12 * Math.sin(t * 9) : snap < .1 ? .45 * (1 - snap / .1) : snap < .3 ? .45 * ((snap - .1) / .2) : .45;
    const dy = snap >= 0 && snap < .2 ? 40 * Math.sin(snap / .2 * Math.PI) : 0;
    const enter = eOutCubic(prog(t, tIn, tIn + .45)), leave = eInCubic(prog(t, T.rien + .15, T.rien + .6));
    const X = x + leave * 900, Y = lerp(-320, B.cy - B.h / 2 - 95, enter) + dy;
    at(X, Y, Math.PI / 2 + .08, 1.25, 1.25, () => withShadow(22, () => scissors(t > T.s12.start && t < T.rien + .6 ? .02 + .3 * (1 - prog(t, T.rien - .1, T.rien + .1)) : open)));
  }
  // ------------------------------------------------------------------ headlines (torn strips)
  function strip(str, y, a, o = {}) {
    if (a <= 0) return; const f = font(o.fam || FF.stencil, o.size || 84, 900), w = measure(str, f, o.ls ?? 4) + 80;
    ctx.save(); ctx.globalAlpha *= clamp(a);
    paperNote(W / 2, y + (1 - clamp(a)) * 30, w, (o.size || 84) * 1.35, o.rot ?? -.02, () => {
      if (o.parts) { let x = -w / 2 + 40; for (const [s, c] of o.parts) { text(s, x, (o.size || 84) * .36, { font: f, color: c, ls: o.ls ?? 4 }); x += measure(s, f, o.ls ?? 4); } }
      else text(str, 0, (o.size || 84) * .36, { font: f, align: 'center', color: o.color || C.ink, ls: o.ls ?? 4 });
    }, { seed: o.seed || 5, h: 10, fill: o.fill });
    ctx.restore();
  }
  registerScene({
    id: 'billet', z: 30,
    when: t => t < TL.ch('ticket').start,
    draw(t, n) {
      if (!T) T = times();
      noteArea(t, n);
      envelopes(t, n);
      scissorsDance(t, n);
      calcPlate(t, n);
      // S1 headline
      const h1 = t < .5 ? 1 : env(t, .35, T.s1.end + .5, .25, .3);
      strip('OÙ PARTENT VOS 10 000 F ?', 900, h1, { size: 74, parts: [['OÙ PARTENT VOS ', C.ink], ['10 000 F', C.orange], [' ?', C.ink]], seed: 11 });
      // refrain strips
      const r2 = env(t, T.maigrit2 - .15, T.maigrit2 + 1.1, .12, .3), r7 = env(t, T.maigrit7 - .15, T.maigrit7 + 1.1, .12, .3);
      strip('TCHAC ! LE BILLET MAIGRIT.', 1150, Math.max(r2, r7), { size: 70, color: C.ink, fill: C.amber, rot: .02, seed: 23 });
      // S12 reveal plate
      const z = spring(t - (T.zero - .05), 10, .45);
      if (z > 0 && t < T.s12.end + 1.0) { const a = 1 - prog(t, T.s12.end + .6, T.s12.end + 1.0);
        ctx.save(); ctx.globalAlpha *= a;
        at(W / 2, 1000, 0, 1, 1, () => confetti(t - T.zero, 50, 7));
        at(W / 2, 1000, -.03, clamp(z, 0, 1.15), clamp(z, 0, 1.15), () => { withShadow(16, () => { ctx.fillStyle = M.red; rrect(-470, -130, 940, 260, 26); ctx.fill(); });
          text('PRIX CHINOIS × 2', 0, -24, { font: font(FF.stencil, 92, 900), align: 'center', color: C.cream, ls: 4 });
          text('= 0 F DE BÉNÉFICE', 0, 88, { font: font(FF.brand, 84, 900), align: 'center', color: '#FFE36E' }); });
        ctx.restore(); }
    },
  });
  registerScene({ id: 'exemple', z: 79, when: t => t < TL.seg('S19').end + .7 && !(t >= TL.ch('ticket').start && t < TL.ch('formule').start), draw(t, n) { if (!T) T = times(); exempleStamp(t, n); } });   // the lot ticket carries its own stamp
  captionHide(t => T && t >= T.zero - .1 && t < T.s12.end + .8);    // the red plate carries the line
})();

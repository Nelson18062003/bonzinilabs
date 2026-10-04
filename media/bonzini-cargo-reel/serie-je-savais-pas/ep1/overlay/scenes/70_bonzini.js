'use strict';
// =============================================================================================
// « JE SAVAIS PAS. » · 1/5 — « TCHAC ! » — M2 « Bonzini & end » (prefix BZ_). Functions only: 50_compose.js and the type
// layer (60_type.js) call them with the state the score computed. VIOLET APPEARS ONLY HERE (from A.brandIn).
// No figure anywhere near the brand: no weight, size, price or date; the dial and the tape carry ticks only; the only
// code is the fictional BZ-000000 of the series' sea label. Bonzini = cargo (groupage mer et air, Chine → Douala,
// pesé et mesuré dès Guangzhou), never customs, never a payment here.
//
//   World (inside the camera):
//     BZ_light(t, L)               violet brand light on the table (wash deepening to the edges + a luminous pool from
//                                  above, baked once into a lit copy of the table, blended by L.violet); returns at once
//                                  when L.violet <= 0; reaches exactly 0 one frame before T.end (the loop seam).
//     BZ_reception(st, t, L, n)    st = SCORE.reception(t): the kraft carton (sea label BZ-000000), the hand-held scanner
//                                  and its violet laser sweep, the platform scale (dial: ticks only), the two tape
//                                  measures (ticks only) + violet dimension marks, the violet stamps PESÉ ✓ / MESURÉ ✓.
//     BZ_plate(st, t, L, n)        st = SCORE.plate(t): the glossy violet enamel plate « BONZINI TRADING CARGO ».
//   Screen space (called by TY_draw with E = SCORE.endcard(t)):
//     BZ_endcard(E, t, L, n)       the logo (its four pieces snap together), « Bonzini Trading Cargo »,
//                                  « Groupage mer et air · Chine → Douala ».
//     BZ_ritual(E, t, L, n)        the series ritual stamp « MAINTENANT, TU SAIS. » → BZ_ritualStamp (reusable, below).
//     BZ_cta(E, t, L, n)           amber pill « Écris [TCHAC] en commentaire » + hand-drawn arrow ↓ + the share line.
//     BZ_loop(k, t, L, n)          last call of the frame: paper whoosh behind the six slices flying back (gone before
//                                  the last frame, so frame N−1 = frame 0).
//   Reusable in the 5 episodes (kit.js only, no SCORE): BZ_ritualStamp(x, y, k, o), BZ_ctaPill(x, y, word, o).
// Every time is read from SCORE.A / SCORE.T or from the state; every static look is cached in an offscreen sprite.
// =============================================================================================
(function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T;
  const kk = S.kk, ease = S.ease, eOut = S.easeOut, eIn = S.easeIn, spr = S.spr;
  const FR = 1 / S.FPS;
  const P = {
    vio: '#7033FF', vioD: '#5B2BDF', vioDD: '#3B17A8', vioEdge: '#22105A', vioInk: '#4A1FC2',
    orange: '#FE560D', ink: '#231629', inkS: '#4A3A52', cream: '#FBF6EC', creamW: '#FFF8EC',
  };
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  // ------------------------------------------------------------------ sprite cache
  // draw(w, h) runs with the global ctx swapped to an offscreen canvas (every kit helper works), origin at the centre.
  const CACHE = {};
  function sprite(key, w, h, draw, sc = 1, ox = w / 2, oy = h / 2) {     // (ox, oy) = where the origin sits in the sprite
    const hit = CACHE[key]; if (hit) return hit;
    const c = makeCanvas(Math.ceil(w * sc), Math.ceil(h * sc)), g = c.getContext('2d'), prev = ctx;
    ctx = g; try { g.scale(sc, sc); g.translate(ox, oy); draw(w, h); } finally { ctx = prev; }
    return (CACHE[key] = { c, w, h, ox, oy });
  }
  const blit = (s, x = 0, y = 0) => ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
  /** a pre-blurred soft shadow of a rounded rect (shadowBlur once, at build time) */
  function shadowSprite(key, w, h, r, blur, col) {
    return sprite(key, w + blur * 5, h + blur * 5, () => {
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = blur; ctx.shadowOffsetX = 20000; ctx.fillStyle = '#000';
      rrect(-w / 2 - 20000, -h / 2, w, h, r); ctx.fill(); ctx.restore();
    });
  }
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); };
  /** a glowing stroke without shadowBlur (≈ free): the path is stroked wide and faint, then narrow and bright */
  function glowStroke(path, rgb, a, w) {
    for (const [m, q] of [[5, .10], [3, .18], [1.8, .35], [1, 1]]) { ctx.strokeStyle = `rgba(${rgb},${(a * q).toFixed(3)})`; ctx.lineWidth = w * m; path(); ctx.stroke(); }
  }

  // =========================================================================================== LIGHT
  // multiply wash: near-white lavender where the light falls, deeper violet at the edges (1/4 res, baked below)
  const OV = { x: -60, y: -100, w: W + 120, h: H + 200 };                 // the table's overscan (camera pushes/shakes)
  const tint = () => sprite('lt_tint', OV.w / 4, OV.h / 4, (w, h) => {
    const cy = (820 - (OV.y + OV.h / 2)) / 4;                             // pool centred on the action (carton / plate)
    ctx.save(); ctx.translate(0, cy); ctx.scale(1, 1.35);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 230);
    g.addColorStop(0, '#F6F2FF'); g.addColorStop(.42, '#E3D9FF'); g.addColorStop(.78, '#BBA6F8'); g.addColorStop(1, '#9277EC');
    ctx.fillStyle = g; ctx.fillRect(-w, -h, 2 * w, 2 * h); ctx.restore();
  });
  // screen glow: a luminous violet pool from above + the sign light along the top edge
  const glow = () => sprite('lt_glow', OV.w / 4, OV.h / 4, (w, h) => {
    const cy = (760 - (OV.y + OV.h / 2)) / 4;
    ctx.save(); ctx.translate(0, cy); ctx.scale(1, 1.2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 220);
    g.addColorStop(0, 'rgba(165,125,255,.34)'); g.addColorStop(.55, 'rgba(130,90,255,.14)'); g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-w, -h, 2 * w, 2 * h); ctx.restore();
    const top = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + 200);
    top.addColorStop(0, 'rgba(140,100,255,.30)'); top.addColorStop(1, 'rgba(140,100,255,0)');
    ctx.fillStyle = top; ctx.fillRect(-w / 2, -h / 2, w, 200);
  });
  /** the violet amount actually drawn: L.violet, but at exactly 0 from one frame before the loop point */
  const violetOf = (t, L) => t >= A.loop ? Math.min(L.violet, 1 - ease(kk(t, A.loop, T.end - 1.5 * FR))) : L.violet;
  // the lit table is baked ONCE (table × wash, then + glow) in the table texture's own space, so a frame costs a single
  // source-over blit instead of two full-screen multiply/screen composites (≈ 8 ms instead of ≈ 32 ms here)
  let LIT = null;
  function litTable() {
    if (LIT) return LIT;
    const tw = TEX.table.width, th = TEX.table.height, c = makeCanvas(tw, th), g = c.getContext('2d');
    g.drawImage(TEX.table, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.drawImage(tint().c, 0, 0, tw, th);
    g.globalCompositeOperation = 'screen'; g.drawImage(glow().c, 0, 0, tw, th);
    return (LIT = c);
  }
  function light(t, L) {
    const v = violetOf(t, L); if (v <= .002) return;
    ctx.save(); ctx.globalAlpha = v; ctx.drawImage(litTable(), OV.x, OV.y, OV.w, OV.h); ctx.restore();
  }

  // =========================================================================================== THE ENAMEL PLATE
  const PW = 860, PH = 232, PR = 36;
  function rivet(x, y) {
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 10); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.5, '#CFCAD9'); g.addColorStop(1, '#6D6680');
    ctx.fillStyle = 'rgba(20,6,60,.45)'; circle(x + 1.5, y + 2.5, 10); ctx.fill();
    ctx.fillStyle = g; circle(x, y, 9.5); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,60,.7)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 5.5, y + 3); ctx.lineTo(x + 5.5, y - 3); ctx.stroke();
  }
  const plateSprite = () => sprite('plate', PW + 12, PH + 24, () => {
    ctx.fillStyle = P.vioEdge; rrect(-PW / 2, -PH / 2 + 9, PW, PH, PR); ctx.fill();                          // steel edge (thickness)
    const g = ctx.createLinearGradient(0, -PH / 2, 0, PH / 2);
    g.addColorStop(0, '#8450FF'); g.addColorStop(.5, '#6629F4'); g.addColorStop(1, '#4C1AD0');
    ctx.fillStyle = g; rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.fill();
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    for (let i = 0; i < 900; i++) { ctx.fillStyle = rnd(i * 3.3) > .5 ? 'rgba(255,255,255,.045)' : 'rgba(10,0,40,.06)'; ctx.fillRect(-PW / 2 + rnd(i * 1.7) * PW, -PH / 2 + rnd(i * 2.9) * PH, 2, 2); }
    const sh = ctx.createLinearGradient(0, PH / 2 - 60, 0, PH / 2); sh.addColorStop(0, 'rgba(15,0,50,0)'); sh.addColorStop(1, 'rgba(15,0,50,.28)');
    ctx.fillStyle = sh; ctx.fillRect(-PW / 2, PH / 2 - 60, PW, 60);
    ctx.restore();
    ctx.strokeStyle = '#F6EDDC'; ctx.lineWidth = 5; rrect(-PW / 2 + 16, -PH / 2 + 16, PW - 32, PH - 32, PR - 14); ctx.stroke();   // pinstripe
    // the logo on a cream enamel roundel
    const rx = -PW / 2 + 126;
    ctx.fillStyle = 'rgba(16,4,56,.38)'; circle(rx + 2, 6, 83); ctx.fill();
    const rg = ctx.createRadialGradient(rx - 22, -26, 10, rx, 0, 84); rg.addColorStop(0, '#FFFDF7'); rg.addColorStop(1, '#EFE5D1');
    ctx.fillStyle = rg; circle(rx, 0, 81); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.lineWidth = 3; circle(rx, 0, 72); ctx.stroke();
    drawLogo(rx, 0, 132);
    // lettering (embossed: a deep-violet offset under cream)
    const tx = 104;
    text('BONZINI', tx, 18 + 5, { font: font('Satoshi', 112, 900), align: 'center', color: '#2A0C7E', ls: 5 });
    text('BONZINI', tx, 18, { font: font('Satoshi', 112, 900), align: 'center', color: P.creamW, ls: 5 });
    text('TRADING CARGO', tx, 78 + 3, { font: font('Satoshi', 40, 900), align: 'center', color: '#2A0C7E', ls: 12 });
    text('TRADING CARGO', tx, 78, { font: font('Satoshi', 40, 900), align: 'center', color: '#E2D5FF', ls: 12 });
    // glaze: the upper half catches the light
    ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip();
    const hg = ctx.createLinearGradient(0, -PH / 2, 0, -8); hg.addColorStop(0, 'rgba(255,255,255,.30)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-PW / 2, -PH / 2); ctx.lineTo(PW / 2, -PH / 2); ctx.lineTo(PW / 2, -30); ctx.bezierCurveTo(PW / 4, -2, -PW / 4, -14, -PW / 2, -4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; rrect(-PW / 2 + 3, -PH / 2 + 3, PW - 6, PH - 6, PR - 3); ctx.stroke();
    ctx.restore();
    for (const [x, y] of [[-PW / 2 + 36, -PH / 2 + 36], [PW / 2 - 36, -PH / 2 + 36], [-PW / 2 + 36, PH / 2 - 36], [PW / 2 - 36, PH / 2 - 36]]) rivet(x, y);
  }, 2);
  const plateShadow = () => shadowSprite('plateSh', PW, PH, PR, 24, 'rgba(34,10,80,1)');
  function plate(st, t, L, n) {
    if (!st || st.a <= 0) return;
    const off = 1 - st.a, up = eOut(cl(off * 1.6));                       // exit: it lifts off, up and towards the lens
    const air = Math.max(1 - eIn(cl(st.k)), .7 * up), persp = 1 + .16 * air;   // falling from above → closer to the lens
    st = { ...st, y: st.y - 760 * up };
    ctx.save(); ctx.globalAlpha *= cl(1 - off * off);
    at(st.x + 6 + 60 * air, st.y + 16 + 150 * air, st.rot, st.sx * (1 + .3 * air), st.sy * (1 + .3 * air), () => { ctx.globalAlpha *= .42 * (1 - .65 * air); blit(plateShadow()); });
    at(st.x, st.y, st.rot, st.s * st.sx * persp, st.s * st.sy * persp, () => {
      blit(plateSprite(), 0, 0);
      const sw = st.sweep;                                                // a reflection crossing the enamel
      if (sw > 0 && sw < 1) {
        ctx.save(); rrect(-PW / 2, -PH / 2, PW, PH, PR); ctx.clip(); ctx.globalCompositeOperation = 'screen';
        const x = -PW / 2 - 260 + (PW + 520) * ease(sw);
        ctx.transform(1, 0, -.45, 1, 0, 0);
        const g = ctx.createLinearGradient(x - 110, 0, x + 110, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.42, 'rgba(255,255,255,.22)'); g.addColorStop(.5, 'rgba(255,255,255,.55)'); g.addColorStop(.58, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 120, -PH, 240, PH * 2);
        ctx.restore();
      }
    });
    // landing: paper dust kicked from under the plate
    const d = t - A.plate;
    if (d >= 0 && d < .6) {
      const q = d / .6;
      for (let i = 0; i < 18; i++) {
        const side = i % 3 === 0 ? -1 : 1, x0 = st.x + (rnd(i * 4.1) - .5) * PW * .95, y0 = st.y + side * PH / 2;
        const vx = (x0 - st.x) / PW * 260 + (rnd(i * 7.7) - .5) * 90, vy = side * (50 + rnd(i * 2.3) * 110);
        const x = x0 + vx * (1 - Math.pow(1 - q, 2)) * .6, y = y0 + vy * (1 - Math.pow(1 - q, 2)) * .6;
        ctx.fillStyle = `rgba(250,244,255,${(.75 * (1 - q)).toFixed(3)})`; circle(x, y, 2 + 4 * rnd(i * 5.3) * (1 - q * .5)); ctx.fill();
      }
    }
    ctx.restore();
  }

  // =========================================================================================== THE RECEPTION
  const CW = 440, CH = 300;                                                // carton top face
  const LAB = { x: 62, y: 60, w: 252, h: 168, r: -.045 };                  // the sea label, carton-local
  const cartonSprite = () => sprite('carton', CW + 50, CH + 50, () => {
    const side = ctx.createLinearGradient(0, CH / 2 - 10, 0, CH / 2 + 16); side.addColorStop(0, '#8A6036'); side.addColorStop(1, '#6E4A27');
    ctx.fillStyle = side; rrect(-CW / 2 + 7, -CH / 2 + 12, CW + 3, CH + 4, 7); ctx.fill();                 // visible sides (bottom/right)
    ctx.fillStyle = TEX.kraft; rrect(-CW / 2, -CH / 2, CW, CH, 5); ctx.fill();
    const vol = ctx.createLinearGradient(-CW / 2, -CH / 2, CW / 2, CH / 2); vol.addColorStop(0, 'rgba(255,240,215,.20)'); vol.addColorStop(1, 'rgba(90,55,20,.14)');
    ctx.fillStyle = vol; rrect(-CW / 2, -CH / 2, CW, CH, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,210,.45)'; ctx.lineWidth = 2; rrect(-CW / 2 + 2, -CH / 2 + 2, CW - 4, CH - 4, 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,50,20,.35)'; ctx.lineWidth = 1.5; rrect(-CW / 2, -CH / 2, CW, CH, 5); ctx.stroke();
    // the flaps' seam + a scuff or two
    ctx.strokeStyle = 'rgba(80,50,22,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-CW / 2 + 4, 0); ctx.lineTo(CW / 2 - 4, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-CW / 2 + 4, 3); ctx.lineTo(CW / 2 - 4, 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,.18)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = -CW / 2 + 30 + rnd(i * 3.1) * (CW - 60), y = -CH / 2 + 20 + rnd(i * 5.7) * (CH - 40); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 + rnd(i) * 20, y + (rnd(i * 2.2) - .5) * 8); ctx.stroke(); }
    // clear brown packing tape over the seam, wrapping over the edges, torn ends
    ctx.fillStyle = 'rgba(176,122,58,.50)'; ctx.beginPath();
    const tp = tornLine(-CW / 2 - 8, -30, CW / 2 + 10, -30, 17, 1.2, 9), bt = tornLine(CW / 2 + 10, 30, -CW / 2 - 8, 30, 29, 1.2, 9);
    ctx.moveTo(...tp[0]); for (const p of tp) ctx.lineTo(...p); for (const p of bt) ctx.lineTo(...p); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,250,235,.22)'; ctx.fillRect(-CW / 2 - 6, -24, CW + 14, 6);
    ctx.strokeStyle = 'rgba(255,250,235,.16)'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const x = -CW / 2 + 60 + i * 95 + rnd(i) * 30; ctx.beginPath(); ctx.moveTo(x, -28); ctx.quadraticCurveTo(x + 8, 0, x - 4, 28); ctx.stroke(); }
    // generic handling marks printed on the kraft (this way up · keep dry): no text
    ctx.save(); ctx.translate(-CW / 2 + 92, -CH / 2 + 78); ctx.strokeStyle = 'rgba(40,26,18,.62)'; ctx.fillStyle = 'rgba(40,26,18,.62)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeRect(-62, -38, 124, 76);
    for (const dx of [-30, -6]) { ctx.beginPath(); ctx.moveTo(dx, 22); ctx.lineTo(dx, -14); ctx.stroke(); ctx.beginPath(); ctx.moveTo(dx - 9, -8); ctx.lineTo(dx, -24); ctx.lineTo(dx + 9, -8); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.arc(32, -2, 18, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(32, -2); ctx.lineTo(32, 20); ctx.arc(26, 20, 6, 0, Math.PI); ctx.stroke();
    ctx.restore();
    // the series' blue sea label (fictional code), slapped over the tape
    at(LAB.x, LAB.y, LAB.r, 1, 1, () => {
      ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.28)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2; ctx.fillStyle = P.cream; rrect(-LAB.w / 2, -LAB.h / 2, LAB.w, LAB.h, 10); ctx.fill(); ctx.restore();
      shipLabel(LAB.w, LAB.h, 'sea', 'BZ-000000', { seed: 11 });
    });
  });
  const cartonShadow = () => shadowSprite('cartonSh', CW + 10, CH + 14, 8, 18, 'rgba(34,12,64,1)');
  // --- scanner (hand-held, top view): window at the origin, body along +x, grip along +y
  const scannerSprite = () => sprite('scanner', 290, 280, () => {
    ctx.save();
    // grip
    const gg = ctx.createLinearGradient(150, 0, 236, 0); gg.addColorStop(0, '#2E2836'); gg.addColorStop(1, '#16121C');
    ctx.fillStyle = gg; rrect(152, 10, 78, 200, 30); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 60; y < 196; y += 14) ctx.fillRect(160, y, 62, 5);
    ctx.fillStyle = P.vioD; rrect(132, 40, 26, 58, 9); ctx.fill();                                              // trigger
    // head
    const hg = ctx.createLinearGradient(0, -50, 0, 50); hg.addColorStop(0, '#4A4356'); hg.addColorStop(.45, '#2C2634'); hg.addColorStop(1, '#17121D');
    ctx.fillStyle = hg; rrect(-6, -50, 262, 100, 34); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; rrect(16, -42, 220, 12, 6); ctx.fill();
    ctx.fillStyle = '#100C14'; rrect(-14, -40, 34, 80, 12); ctx.fill();                                         // nose bezel
    const wg = ctx.createLinearGradient(-10, -32, -10, 32); wg.addColorStop(0, '#9C7BFF'); wg.addColorStop(1, '#4A1FC2');
    ctx.fillStyle = wg; rrect(-10, -32, 18, 64, 7); ctx.fill();                                               // violet window
    ctx.fillStyle = P.vio; circle(196, -16, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(194, -18, 2); ctx.fill();   // LED
    ctx.restore();
  }, 1, 24, 60);
  // --- platform scale (top view): steel deck under the carton, the round dial on its left side (ticks only, no figure)
  const SW = 520, SH = 360, DIAL = { x: -SW / 2 - 70, y: 26, r: 80 };
  const scaleSprite = () => sprite('scale', SW + 2 * (70 + 80) + 60, SH + 80, () => {
    ctx.save(); ctx.shadowColor = 'rgba(34,12,64,.32)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#6E6680'; rrect(DIAL.x, DIAL.y - 30, 90, 60, 14); ctx.fill();                              // neck
    const fr = ctx.createLinearGradient(0, -SH / 2, 0, SH / 2); fr.addColorStop(0, '#A49CB4'); fr.addColorStop(1, '#6F6782');
    ctx.fillStyle = fr; rrect(-SW / 2, -SH / 2, SW, SH, 28); ctx.fill();
    const dr = ctx.createLinearGradient(0, DIAL.y - DIAL.r, 0, DIAL.y + DIAL.r); dr.addColorStop(0, '#5B5470'); dr.addColorStop(1, '#2F2A3A');
    ctx.fillStyle = dr; circle(DIAL.x, DIAL.y, DIAL.r); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; rrect(-SW / 2 + 2, -SH / 2 + 2, SW - 4, SH - 4, 26); ctx.stroke();
    const pg = ctx.createLinearGradient(-SW / 2, -SH / 2, SW / 2, SH / 2); pg.addColorStop(0, '#F4F1F8'); pg.addColorStop(1, '#CEC8D8');
    ctx.fillStyle = pg; rrect(-SW / 2 + 12, -SH / 2 + 12, SW - 24, SH - 24, 18); ctx.fill();                   // brushed steel deck
    ctx.save(); rrect(-SW / 2 + 12, -SH / 2 + 12, SW - 24, SH - 24, 18); ctx.clip();
    for (let i = 0; i < 160; i++) { ctx.strokeStyle = rnd(i * 2.1) > .5 ? 'rgba(255,255,255,.4)' : 'rgba(80,70,100,.09)'; ctx.lineWidth = 1; const y = -SH / 2 + rnd(i * 1.3) * SH; ctx.beginPath(); ctx.moveTo(-SW / 2, y); ctx.lineTo(SW / 2, y + (rnd(i) - .5) * 3); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(70,60,90,.25)'; ctx.lineWidth = 2; rrect(-SW / 2 + 12, -SH / 2 + 12, SW - 24, SH - 24, 18); ctx.stroke();
    for (const [x, y] of [[-SW / 2 + 28, -SH / 2 + 28], [SW / 2 - 28, -SH / 2 + 28], [-SW / 2 + 28, SH / 2 - 28], [SW / 2 - 28, SH / 2 - 28]]) { ctx.fillStyle = '#A9A2B6'; circle(x, y, 6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(x - 1.5, y - 1.5, 2); ctx.fill(); }
    // dial face: cream, ink ticks, a violet band where the needle settles — never a numeral
    const fg = ctx.createRadialGradient(DIAL.x - 18, DIAL.y - 20, 6, DIAL.x, DIAL.y, 68); fg.addColorStop(0, '#FFFDF8'); fg.addColorStop(1, '#ECE4D4');
    ctx.fillStyle = fg; circle(DIAL.x, DIAL.y, 66); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineCap = 'round';
    for (let i = 0; i <= 24; i++) { const a = -Math.PI / 2 - 2.2 + i * 4.4 / 24, maj = i % 6 === 0, r0 = maj ? 42 : 50;
      ctx.lineWidth = maj ? 4 : 2; ctx.beginPath(); ctx.moveTo(DIAL.x + Math.cos(a) * r0, DIAL.y + Math.sin(a) * r0); ctx.lineTo(DIAL.x + Math.cos(a) * 58, DIAL.y + Math.sin(a) * 58); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(112,51,255,.4)'; ctx.lineWidth = 9; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.arc(DIAL.x, DIAL.y, 31, -Math.PI / 2 + .02, -Math.PI / 2 + .62); ctx.stroke();
  });
  const dialGlass = () => sprite('dialGlass', 170, 170, () => {
    ctx.fillStyle = P.vioDD; circle(0, 0, 9); ctx.fill(); ctx.fillStyle = '#D9CCFF'; circle(-2, -2, 3); ctx.fill();
    ctx.save(); circle(0, 0, 66); ctx.clip(); const g = ctx.createLinearGradient(-60, -60, 30, 30); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(.45, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-16, -22, 56, 34, -.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; circle(0, 0, 74); ctx.stroke();
  });
  // --- tape measure: the case sits at a corner, the blade runs out along the edge (ticks only, never a numeral)
  const tapeCase = () => sprite('tapeCase', 96, 96, () => {
    ctx.fillStyle = 'rgba(34,12,64,.3)'; rrect(-30, -28, 68, 68, 20); ctx.fill();
    const g = ctx.createLinearGradient(0, -34, 0, 34); g.addColorStop(0, '#3E3746'); g.addColorStop(1, '#1D1923');
    ctx.fillStyle = g; rrect(-34, -34, 68, 68, 20); ctx.fill();
    ctx.fillStyle = '#F2C230'; rrect(-25, -25, 50, 50, 13); ctx.fill();
    ctx.fillStyle = '#2B2530'; circle(0, 0, 14); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; circle(-4, -4, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; rrect(-30, -31, 60, 8, 4); ctx.fill();
  });
  /** blade from the origin along +x (or +y) for len·k, the case at the origin (pops in with the first centimetres) */
  function tapeRun(len, vertical, k) {
    if (k <= 0) return;
    const L = len * k;
    ctx.save(); if (vertical) ctx.rotate(Math.PI / 2);
    if (L > 1) {
      ctx.fillStyle = 'rgba(34,12,64,.22)'; ctx.fillRect(3, -8, L, 26);                                        // its shadow
      const g = ctx.createLinearGradient(0, -13, 0, 13); g.addColorStop(0, '#FFE07A'); g.addColorStop(1, '#E9B524');
      ctx.fillStyle = g; ctx.fillRect(0, -13, L, 26);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      for (let x = 34; x < L - 2; x += 11) { const big = Math.round((x - 34) / 11) % 5 === 0; ctx.beginPath(); ctx.moveTo(x, -13); ctx.lineTo(x, big ? 3 : -5); ctx.stroke(); }
      ctx.fillStyle = '#8E8A96'; ctx.fillRect(L - 2, -16, 8, 32);                                              // the hook at the tip
    }
    const pop = cl(k * 8); ctx.translate(-6, 0); if (vertical) ctx.rotate(-Math.PI / 2); ctx.scale(pop, pop); blit(tapeCase());
    ctx.restore();
  }
  /** violet dimension mark along an edge (no figure): line, end ticks, arrowheads */
  function dimMark(len, vertical, k) {
    if (k <= 0) return;
    ctx.save(); if (vertical) ctx.rotate(Math.PI / 2);
    ctx.globalAlpha *= k; ctx.strokeStyle = P.vioD; ctx.fillStyle = P.vioD; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const L = len * eOut(k);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.moveTo(L, -14); ctx.lineTo(L, 14); ctx.stroke();
    for (const [x, d] of [[0, 1], [L, -1]]) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + d * 16, -8); ctx.lineTo(x + d * 16, 8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // --- the violet rubber stamps PESÉ ✓ / MESURÉ ✓ (cached, starved ink, drawn check)
  const STF = font(FF.stencil, 84, 900);
  function stampSprite(label) {
    const tw = measure(label, STF, 3), w = tw + 70 + 26 + 64, h = 120;
    return sprite('st_' + label, w + 24, h + 24, () => {
      ctx.fillStyle = P.vioD; ctx.strokeStyle = P.vioD;
      text(label, -w / 2 + 32, 30, { font: STF, color: P.vioD, ls: 3 });
      const cx = -w / 2 + 32 + tw + 26 + 30;                               // the check, drawn with the same ink
      ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(cx - 28, 2); ctx.lineTo(cx - 8, 24); ctx.lineTo(cx + 30, -28); ctx.stroke();
      ctx.lineWidth = 7; rrect(-w / 2, -h / 2, w, h, 16); ctx.stroke();
      ctx.lineWidth = 2.5; rrect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 10); ctx.stroke();
      ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .42;
      ctx.drawImage(TEX.starve, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24); ctx.globalAlpha = .25; ctx.drawImage(TEX.starve, 120, 40, 300, 150, -w / 2, -h / 2, w, h);
    });
  }
  function stamp(label, k, since, p, seed) {
    if (k <= 0) return;
    const sp = stampSprite(label), x = Math.min(p.x, 945 - sp.w / 2 + 12), y = p.y;   // keep its right edge left of x = 960
    const sc = (k < 1 ? 1.45 - .45 * eOut(k) : 1) * (1 + .03 * Math.exp(-Math.max(0, since) * 14));
    at(x, y, -.055 + (rnd(seed) - .5) * .03, sc, sc, () => {
      ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2.2); ctx.globalCompositeOperation = 'multiply'; blit(sp); ctx.restore();
      if (k >= 1 && since < .5) {                                         // ink specks thrown by the impact
        ctx.save(); ctx.fillStyle = P.vioD; ctx.globalAlpha *= .7;
        for (let i = 0; i < 7; i++) { const a = rnd(seed * 7 + i) * Math.PI * 2, r = sp.w * .5 + 8 + rnd(seed + i * 3) * 26; circle(Math.cos(a) * r * .9, Math.sin(a) * r * .4, 1.5 + rnd(i + seed) * 3); ctx.fill(); }
        ctx.restore();
      }
    });
  }
  const SCAN_DY = 170;          // the scanner is held lower than its state anchor so its body clears the enamel plate
  function reception(st0, t, L, n) {
    if (!st0 || st0.a <= 0) return;
    // the carton, scale, scanner, scan and tape are stop-motion (on twos): read them at the frame centre so the motion-blur
    // sub-frames hold ONE pose (the score's step2 boundary falls on even frames: sub-frames would straddle two poses);
    // the exit (a) and the stamps keep the real t (smooth, blurred)
    const q = S.reception(n / S.FPS) || st0;
    const st = { ...q, a: st0.a, pese: st0.pese, mesure: st0.mesure };
    const c = st.carton, cg = jit(811, n, .5);
    // exit: the score's fade (1 − a, an ease-in) is turned back into linear progress so the whole group is whisked off
    // to the left in its first 60 % — the table is clear before « Bonzini Trading Cargo » arrives
    const off = Math.cbrt(cl(1 - st.a)), gx = -820 * ease(cl(off / .6));
    ctx.save(); ctx.globalAlpha *= cl(1 - off * off);
    // 1 — the scale slides in under the carton from the right (stop-motion: st.scale.a is already on twos)
    const sa = st.scale.a, sx = st.scale.x + gx + (1 - eOut(sa)) * 760, sy = st.scale.y - 70;   // deck centred under the carton
    if (sa > 0) {
      at(sx, sy, .008, 1, 1, () => blit(scaleSprite()));
      const dx = sx + DIAL.x, dy = sy + DIAL.y, a = -Math.PI / 2 - 2.2 + 4.4 * cl(.1 + .48 * st.scale.needle, 0, 1);   // the needle settles
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(34,12,64,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(dx + 3, dy + 4); ctx.lineTo(dx + 3 + Math.cos(a) * 54, dy + 4 + Math.sin(a) * 54); ctx.stroke();
      ctx.strokeStyle = P.vioD; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(dx - Math.cos(a) * 14, dy - Math.sin(a) * 14); ctx.lineTo(dx + Math.cos(a) * 56, dy + Math.sin(a) * 56); ctx.stroke();
      ctx.restore();
      at(dx, dy, 0, 1, 1, () => blit(dialGlass()));
      if (st.pese > 0) { ctx.save(); glowStroke(() => circle(dx, dy, 74), '112,51,255', st.pese, 4); ctx.restore(); }
    }
    // 2 — the carton (lifted while the scale slides under it, lands on « pesé »)
    const air = cl((G.carton.y - c.y) / 14);
    const cx = c.x + gx + cg.x, cy = c.y + cg.y, cr = c.rot + cg.r, cs = c.s * (1 + .045 * air);
    at(cx + 4 + 16 * air, cy + 9 + 26 * air, cr, cs * (1 + .05 * air), cs * (1 + .05 * air), () => { ctx.globalAlpha *= .5 - .22 * air; blit(cartonShadow()); });
    at(cx, cy, cr, cs, cs, () => {
      blit(cartonSprite());
      // the scan: a violet laser line sweeps across the label, the scanned part glows; then the label is registered
      const lab = () => { ctx.translate(LAB.x, LAB.y); ctx.rotate(LAB.r); };
      if (st.beam || (st.scan > 0 && st.scan < 1)) {
        const lx = -LAB.w / 2 - 6 + (LAB.w + 12) * st.scan;
        ctx.save(); lab(); rrect(-LAB.w / 2, -LAB.h / 2, LAB.w, LAB.h, 10); ctx.clip();
        ctx.fillStyle = 'rgba(112,51,255,.24)'; ctx.fillRect(-LAB.w / 2, -LAB.h / 2, lx + LAB.w / 2, LAB.h);
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createLinearGradient(lx - 40, 0, lx + 40, 0); g.addColorStop(0, 'rgba(140,90,255,0)'); g.addColorStop(.5, 'rgba(150,100,255,.9)'); g.addColorStop(1, 'rgba(140,90,255,0)');
        ctx.fillStyle = g; ctx.fillRect(lx - 40, -LAB.h / 2, 80, LAB.h);
        ctx.restore();
        ctx.save(); lab(); ctx.lineCap = 'round';
        glowStroke(() => { ctx.beginPath(); ctx.moveTo(lx, -LAB.h / 2 - 12); ctx.lineTo(lx, LAB.h / 2 + 12); }, '122,69,255', 1, 7);
        ctx.fillStyle = '#F6F1FF'; ctx.fillRect(lx - 1.5, -LAB.h / 2 - 12, 3, LAB.h + 24); ctx.restore();
      }
      const done = t - (A.scan + .4);                                     // registered: violet rim + a check badge
      if (done > 0) {
        ctx.save(); lab();
        const rim = Math.exp(-done * 3.5);
        if (rim > .02) glowStroke(() => rrect(-LAB.w / 2 - 4, -LAB.h / 2 - 4, LAB.w + 8, LAB.h + 8, 13), '112,51,255', .9 * rim, 5);
        const b = cl(spr(done, 15, .45), 0, 1.25);
        at(LAB.w / 2 - 8, -LAB.h / 2 + 2, 0, b, b, () => {
          ctx.fillStyle = 'rgba(34,12,64,.3)'; circle(2, 4, 27); ctx.fill();
          ctx.fillStyle = P.vio; circle(0, 0, 26); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; circle(0, 0, 26); ctx.stroke();
          ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-11, 1); ctx.lineTo(-3, 10); ctx.lineTo(12, -9); ctx.stroke();
        });
        ctx.restore();
      }
      // 3 — the tapes: one along the top edge, one down the right edge (cases at the top corners); the violet
      //     dimension marks stay once measured
      const tk = st.tape, kA = cl(tk / .6), kB = cl((tk - .4) / .6), dimK = Math.max(cl((tk - .82) / .18), st.mesure);
      at(-CW / 2 - 4, -CH / 2 - 34, 0, 1, 1, () => { dimMark(CW + 8, false, dimK); tapeRun(CW + 8, false, kA); });
      at(CW / 2 + 36, -CH / 2 + 4, 0, 1, 1, () => { dimMark(CH, true, dimK); tapeRun(CH, true, kB); });
    });
    // 4 — the hand-held scanner (top-right), aimed at the label; its violet fan sweeps the label with st.scan
    const sc = st.scanner;
    if (sc && sc.a > 0 && sc.x < W + 260 && off <= 0) {
      const j = jit(812, n, .7), ca = Math.cos(cr), sa2 = Math.sin(cr);
      const wp = (lx, ly) => [cx + (ca * lx - sa2 * ly) * cs, cy + (sa2 * lx + ca * ly) * cs];   // carton-local → world
      const lxs = LAB.x - LAB.w / 2 - 6 + (LAB.w + 12) * st.scan;
      const p1 = wp(lxs, LAB.y - LAB.h / 2 - 14), p2 = wp(lxs, LAB.y + LAB.h / 2 + 14), tg = wp(LAB.x, LAB.y);
      const ox = sc.x + j.x, oy = sc.y + SCAN_DY + j.y, aim = Math.atan2(tg[1] - oy, tg[0] - ox) + Math.PI;
      if (st.beam) {
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, g = ctx.createLinearGradient(ox, oy, mx, my);
        g.addColorStop(0, 'rgba(160,110,255,.8)'); g.addColorStop(1, 'rgba(130,80,255,.28)');
        const nx = Math.cos(aim + Math.PI / 2) * 14, ny = Math.sin(aim + Math.PI / 2) * 14;
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox + nx, oy + ny); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(ox - nx, oy - ny); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(235,225,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(mx, my); ctx.stroke();
        const rg = ctx.createRadialGradient(ox, oy, 2, ox, oy, 80); rg.addColorStop(0, 'rgba(200,170,255,.95)'); rg.addColorStop(1, 'rgba(140,90,255,0)');
        ctx.fillStyle = rg; circle(ox, oy, 80); ctx.fill();
        ctx.restore();
      }
      at(ox + 10, oy + 18, aim, 1, 1, () => { ctx.save(); ctx.globalAlpha *= .28; ctx.fillStyle = '#220C40'; rrect(-6, -50, 262, 100, 34); ctx.fill(); rrect(152, 10, 78, 200, 30); ctx.fill(); ctx.restore(); });
      at(ox, oy, aim, 1, 1, () => blit(scannerSprite()));
    }
    // 5 — the violet stamps, printed on the table (they fade with the exit; they never sit right of x = 960)
    ctx.globalAlpha *= cl(1 - off * 2.2);
    stamp('PESÉ', st.pese, t - A.stampPese, G.stamps.pese, 3);
    stamp('MESURÉ', st.mesure, t - A.stampMes, G.stamps.mesure, 7);
    ctx.restore();
  }

  // =========================================================================================== END CARD
  const halo = () => sprite('halo', 620, 620, () => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
    g.addColorStop(0, 'rgba(255,253,246,.95)'); g.addColorStop(.45, 'rgba(255,251,242,.6)'); g.addColorStop(1, 'rgba(255,250,240,0)');
    ctx.fillStyle = g; circle(0, 0, 300); ctx.fill();
  });
  const PIECES = [['wingTop', -1, -.8, -.9], ['wingBot', -1, .9, .8], ['amber', 1, -.7, .7], ['orange', .9, .9, -.8]];
  const fadeA = E => Math.pow(cl(E.a), 2.5);                             // the end card clears fast at the loop
  function endcard(E, t, L, n) {
    if (!E || E.a <= 0) return;
    const lo = G.end.logo, d = t - A.endcard;
    ctx.save(); ctx.globalAlpha *= fadeA(E);
    const hk = eOut(cl(d / .45));
    if (hk > 0) { ctx.save(); ctx.globalAlpha *= hk; at(lo.x, lo.y + 10, 0, .7 + .3 * hk, .7 + .3 * hk, () => blit(halo())); ctx.restore(); }
    // the logo: its four pieces fly in and snap together, then a single violet ring
    const offsets = {};
    PIECES.forEach(([role, dx, dy, r], i) => {                         // (drawLogo rotates about the logo centre: keep it small)
      const p = cl(spr(d - .04 * i, 12, .62), 0, 1.04), q = 1 - p;
      offsets[role] = [dx * 300 * q, dy * 300 * q, .22 * r * Math.max(0, q), cl(p * 3)];
    });
    const lk = cl(E.logoK, 0, 1.12);                                      // cut-paper logo: a soft shadow lifts it off the table
    if (lk > 0) { ctx.save(); ctx.shadowColor = 'rgba(40,16,80,.30)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 9;
      drawLogo(lo.x, lo.y, 270 * (.82 + .18 * lk), { offsets }); ctx.restore(); }
    // « Bonzini Trading Cargo » + the verified service line
    if (E.nameK > 0) { const k = eOut(E.nameK);
      ctx.save(); ctx.globalAlpha *= E.nameK; text('Bonzini Trading Cargo', G.cx, G.end.name.y + 26 * (1 - k), { font: font(FF.brand, 84, 900), align: 'center', color: P.ink, ls: -1 }); ctx.restore(); }
    if (E.lineK > 0) { const k = eOut(E.lineK), f = font(FF.body, 48, 800), s = 'Groupage mer et air · Chine → Douala', w = measure(s, f);
      ctx.save(); ctx.globalAlpha *= E.lineK;
      ctx.fillStyle = 'rgba(255,251,244,.72)'; rrect(G.cx - w / 2 - 26, G.end.line.y - 46 + 18 * (1 - k), w + 52, 66, 33); ctx.fill();
      text(s, G.cx, G.end.line.y + 18 * (1 - k), { font: f, align: 'center', color: P.vioInk }); ctx.restore(); }
    ctx.restore();
  }
  function ritual(E, t, L, n) {
    if (!E || E.a <= 0) return;
    BZ_ritualStamp(G.end.ritual.x, G.end.ritual.y, E.ritualK, { alpha: fadeA(E), since: t - A.ritual });
  }
  function cta(E, t, L, n) {
    if (!E || E.a <= 0) return;
    const P0 = G.end.cta;
    ctx.save(); ctx.globalAlpha *= fadeA(E);
    const geo = BZ_ctaPill(P0.x, P0.y, 'TCHAC', { k: E.ctaK, since: t - A.cta, t });
    // the hand-drawn arrow ↓ hanging from the end of « commentaire », drawn on, then bobbing gently (≈ 1.2 Hz)
    const ak = kk(t, A.cta + .2, A.cta + .55);
    if (ak > 0 && geo) {
      const ax = geo.x1 - 44, ay = P0.y + geo.h / 2 + 12 + 5 * Math.sin((t - A.cta - .55) * 7.5) * kk(t, A.cta + .55, A.cta + .9);
      ctx.save(); ctx.strokeStyle = P.orange; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const k1 = cl(ak / .65), k2 = cl((ak - .6) / .4), Lh = 60;           // short: it points at the comments, not at the share line
      ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.bezierCurveTo(ax + 8, ay + Lh * .35 * k1, ax - 6, ay + Lh * .7 * k1, ax + 4, ay + Lh * k1); ctx.stroke();
      if (k2 > 0) { ctx.beginPath(); ctx.moveTo(ax - 17, ay + Lh - 22 + 16 * (1 - k2)); ctx.lineTo(ax + 4, ay + Lh + 2); ctx.lineTo(ax + 4 + 19 * k2, ay + Lh - 20 + 16 * (1 - k2)); ctx.stroke(); }
      ctx.restore();
    }
    // the share line (left of the arrow), « × 2 » circled in orange felt pen
    if (E.shareK > 0) {
      const f = font('Satoshi', 44, 700), fb = font('Satoshi', 46, 900), s1 = 'Partage à l’ami qui fait encore', s2 = '× 2', gap = 22;
      const w1 = measure(s1, f), w2 = measure(s2, fb), x1 = Math.min(G.cx + (w1 + gap + w2) / 2, (geo ? geo.x1 - 44 : 906) - 40), x0 = x1 - (w1 + gap + w2);
      const y = G.end.share.y + 16 * (1 - eOut(E.shareK));
      ctx.save(); ctx.globalAlpha *= E.shareK;
      text(s1, x0, y, { font: f, color: P.ink }); text(s2, x0 + w1 + gap, y, { font: fb, color: P.ink });   // QA: s1 in full ink (inkS was too faint on violet at 50 % brightness)
      const ck = kk(t, A.share + .35, A.share + .75);
      if (ck > 0) at(x0 + w1 + gap + w2 / 2, y - 16, -.08, 1, 1, () => handCircle(w2 / 2 + 16, 33, ck, P.orange, 5, 4));
      ctx.restore();
    }
    ctx.restore();
  }

  // =========================================================================================== THE LOOP SEAM
  // paper whoosh behind the six slices flying back (they are drawn by MC_note / the fallback); nothing in the last frames
  function loop(k, t, L, n) {
    if (k <= 0 || t >= T.end - 2.5 * FR) return;
    const now = S.note(t).pieces.filter(p => p.reform), before = S.note(t - .05).pieces.filter(p => p.reform);
    if (!now.length) return;
    const cam = S.camera(t), w = S.G.note.w, h = S.G.note.h;
    ctx.save(); ctx.translate(cam.cx + cam.sx, cam.cy + cam.sy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy);
    for (const p of now) {
      const q = before.find(b => b.i === p.i); if (!q) continue;
      const dx = p.x - q.x, dy = p.y - q.y, sp = Math.hypot(dx, dy); if (sp < 8) continue;
      const a = cl((.8 - p.k) / .5) * cl(sp / 160);                      // only while flying fast, gone well before the seam
      if (a <= .02) continue;
      const ux = dx / sp, uy = dy / sp, pw = (p.b - p.a) * w * p.s, ph = h * p.s, len = Math.min(420, sp * 2.2);
      // a soft wake: a translucent quad trailing the slice, paper-coloured air pushed aside
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(uy, ux));
      const half = .5 * Math.max(Math.abs(pw * uy) + Math.abs(ph * ux) * 0, Math.min(pw, ph)) + .25 * Math.abs(-uy * pw + ux * ph);
      const g = ctx.createLinearGradient(0, 0, -len, 0); g.addColorStop(0, `rgba(90,70,60,${(.16 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(90,70,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -half); ctx.quadraticCurveTo(-len * .5, -half * .7, -len, 0); ctx.quadraticCurveTo(-len * .5, half * .7, 0, half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${(.5 * a).toFixed(3)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (const o of [-.55, .1, .6]) { ctx.beginPath(); ctx.moveTo(-len * .15, o * half); ctx.lineTo(-len * (.55 + .2 * rnd(p.i * 5 + o)), o * half * .8); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }

  // =========================================================================================== exports
  window.BZ_light = (t, L) => { if (!L || L.violet <= 0) return; light(t, L); };
  window.BZ_reception = reception;
  window.BZ_plate = plate;
  window.BZ_endcard = endcard;
  window.BZ_ritual = ritual;
  window.BZ_cta = cta;
  window.BZ_loop = loop;
})();

// =============================================================================================
// REUSABLE IN THE 5 EPISODES (kit.js only: makeCanvas, rrect, text/font/measure, rnd, TEX.starve, at). Copy as is.
// =============================================================================================
/** « MAINTENANT, TU SAIS. » — the series' ritual stamp. Orange rubber stamp, two lines (« MAINTENANT, » / « TU SAIS. »,
 *  Big Shoulders Stencil 112 px), double border, starved ink, printed in multiply. ≈ 690 × 262 px: centred on x = 540 it
 *  stays inside x 195…885 (clear of the right-hand UI band). (x, y) = centre in the current transform; k = landing 0..1
 *  (the rubber comes down: 1.5 → 1, ink appears); o = {alpha, since (s since the impact: ink spread), rot, color}. */
function BZ_ritualStamp(x, y, k, o = {}) {
  if (k <= 0) return;
  const col = o.color || '#FE560D', key = 'ritual' + col;
  const C2 = BZ_ritualStamp.cache || (BZ_ritualStamp.cache = {});
  let sp = C2[key];
  if (!sp) {
    const f = '900 112px Stencil', l1 = 'MAINTENANT,', l2 = 'TU SAIS.', w = Math.ceil(Math.max(measure(l1, f, 4), measure(l2, f, 4)) + 96), h = 262, sc = 2;
    const c = makeCanvas((w + 30) * sc, (h + 30) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 30) / 2, (h + 30) / 2);
      g.strokeStyle = col; g.lineWidth = 11; rrect(-w / 2, -h / 2, w, h, 20); g.stroke();
      g.lineWidth = 3.5; rrect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30, 11); g.stroke();
      text(l1, 2, -14, { font: f, align: 'center', color: col, ls: 4 });
      text(l2, 2, 92, { font: f, align: 'center', color: col, ls: 4 });
      g.globalCompositeOperation = 'destination-out'; g.globalAlpha = .45;
      g.drawImage(TEX.starve, -w / 2 - 15, -h / 2 - 15, w + 30, h + 30); g.globalAlpha = .3; g.drawImage(TEX.starve, 80, 30, 360, 200, -w / 2, -h / 2, w, h);
    } finally { ctx = prev; }
    sp = C2[key] = { c, w: w + 30, h: h + 30 };
  }
  const e = 1 - Math.pow(1 - Math.min(1, k), 3), since = o.since ?? 1;
  const s = (k < 1 ? 1.5 - .5 * e : 1) * (1 + .028 * Math.exp(-Math.max(0, since) * 12));
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.05); ctx.scale(s, s);
  ctx.globalAlpha *= (o.alpha ?? 1) * Math.min(1, k * 2);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
  ctx.restore();
}
/** the series' CTA pill « Écris [WORD] en commentaire »: amber pill with thickness, the keyword typed in a cream field
 *  (orange stencil + a 1 Hz cursor). Width ≈ 820 px for a 5-letter word (x 130…950 centred on 540). (x, y) = centre;
 *  o = {k (0..1 appear), since (s since it appeared: one bounce), t (seconds, for the cursor)}. Returns {x0, x1, h}. */
function BZ_ctaPill(x, y, word, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return null;
  const C2 = BZ_ctaPill.cache || (BZ_ctaPill.cache = {});
  let sp = C2[word];
  if (!sp) {
    const fA = '900 50px Satoshi', fK = '900 66px Stencil', wE = measure('Écris', fA), wC = measure('en commentaire', fA), wK = measure(word, fK, 3) + 54;
    const gap = 18, pad = 34, w = Math.ceil(wE + gap + wK + gap + wC + 2 * pad), h = 104, sc = 2;
    const c = makeCanvas((w + 80) * sc, (h + 90) * sc), g = c.getContext('2d'), prev = ctx;
    ctx = g;
    try {
      g.scale(sc, sc); g.translate((w + 80) / 2, (h + 90) / 2 - 12);
      g.save(); g.shadowColor = 'rgba(60,24,40,.34)'; g.shadowBlur = 22 * sc; g.shadowOffsetY = 12 * sc;
      g.fillStyle = '#B86F1A'; rrect(-w / 2, -h / 2 + 8, w, h, h / 2); g.fill(); g.restore();                     // thickness + soft shadow
      const pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#FAC06A'); pg.addColorStop(1, '#EE9A30');
      g.fillStyle = pg; rrect(-w / 2, -h / 2, w, h, h / 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2.5; rrect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, h / 2 - 4); g.stroke();
      let cx = -w / 2 + pad;
      text('Écris', cx, 18, { font: fA, color: '#231629' }); cx += wE + gap;
      g.fillStyle = 'rgba(120,60,0,.28)'; rrect(cx, -36 + 3, wK, 76, 16); g.fill();
      g.fillStyle = '#FFF8EC'; rrect(cx, -38, wK, 76, 16); g.fill();
      text(word, cx + 20, 24, { font: fK, color: '#FE560D', ls: 3 });
      sp = { cursor: cx + wK - 26 }; cx += wK + gap;
      text('en commentaire', cx, 18, { font: fA, color: '#231629' });
    } finally { ctx = prev; }
    sp = C2[word] = { c, w: w + 80, h: h + 90, pw: w, ph: h, cursor: sp.cursor };
  }
  const d = o.since ?? 1, e = 1 - Math.pow(1 - Math.min(1, k), 3);
  const s = e * (1 + .13 * Math.exp(-Math.max(0, d) * 6) * Math.sin(Math.max(0, d) * 16));
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.012); ctx.scale(s, s);
  ctx.save(); ctx.globalAlpha *= Math.min(1, k * 2); ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2 + 12, sp.w, sp.h); ctx.restore();
  const tt = o.t ?? 0;
  if (Math.floor(tt * 2) % 2 === 0) { ctx.fillStyle = 'rgba(35,22,41,.55)'; ctx.globalAlpha *= Math.min(1, k * 2); ctx.fillRect(sp.cursor + 9, -24, 3, 48); }   // QA: thin ink caret, clear of the C
  ctx.restore();
  return { x0: x - sp.pw / 2, x1: x + sp.pw / 2, h: sp.ph };
}

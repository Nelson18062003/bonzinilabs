'use strict';
// =============================================================================================
// 52_partie2 — S28 « Partie 2 : les taxes, la conformité, la simulation, le transitaire. » on Junior's counter (⑧ Mboppi).
//  A WORLD object (it stays where it is put: S29 and the S30 crane shot still see it): a manila folder « PARTIE 2 », the same
//  look as the kit's folder() (manila #E9C98E, top-left tab, inner line, coloured index tabs on the right edge, a coloured dot
//  per line), laid out to fit between Junior and the framed quittance.
//   · end of S27 / camera move: the folder is set down upright on the counter (paper thud).
//   · « taxes » · « conformité » · « simulation » · « transitaire »: each line is written and its index tab slides out, one per
//     word — Les taxes · La conformité · La simulation · Le transitaire.
//   · then Junior's bundle — the three cards QUOI ? · COMBIEN ? · D'OÙ ? and his green goods' passport (violet ribbon) — rises
//     from behind the counter (his hand) and slides into the folder; their tops stay peeking out of it.
//   · then the folder is laid down flat on the counter (it frees the frame for S29; it stays there, visible).
// z 34: in front of Junior (32), just behind the counter's front slab (34_mboppi, z 35), so the slab hides its bottom edge.
// Local units = screen px at the S28 zoom (1.2); world scale 1 / 1.2. Top-level names: none (IIFE). Scene id F52_folder.
// =============================================================================================
(() => {
  const ZL = 1.2, FW = 450, FH = 520;                                  // folder size (local units)
  const FC = { x: 8369, y: 930 - FH / 2 / ZL };                        // folder centre (world): bottom edge at world y 930 (counter top 916)
  const TABS = ['Les taxes', 'La conformité', 'La simulation', 'Le transitaire'], TABC = [C.violet, C.amber, C.orange, DC.green];
  const WORDS = ['taxes', 'conformité', 'simulation', 'transitaire'];
  const MANILA = '#E9C98E';
  const QC = ['#7B22D6', '#C77A12', C.orange], QW = ['QUOI ?', 'COMBIEN ?', "D'OÙ ?"];
  let T = null;
  function tm() {
    if (T) return T;
    const o = {};
    o.drop = ss('S28', -.32); o.land = o.drop + .32;                  // set down as the camera settles on the counter
    o.tab = WORDS.map(w => tw('S28', w, -.05));
    for (let i = 1; i < 4; i++) o.tab[i] = Math.max(o.tab[i], o.tab[i - 1] + .5);
    o.b0 = Math.max(tw('S28', 'transitaire', .15), o.tab[3] + .2); o.b1 = o.b0 + .55; o.b2 = o.b1 + .12; o.b3 = o.b2 + .42;
    o.lay0 = Math.max(o.b3 + .1, se('S28', .1)); o.lay1 = o.lay0 + .42;
    addShake(o.land, 5, .12);                                          // the folder is set down (sound cue)
    addShake(o.b3 - .05, 2, .08);                                      // the bundle drops in
    addShake(o.lay1, 4, .1);                                           // laid flat
    T = o; return T;
  }
  const E = (t, a, d) => eInOutCubic(prog(t, a, a + d));
  const toLocal = (x, y) => [(x - FC.x) * ZL, (y - FC.y) * ZL];

  // ---------- Junior: looks at the folder, hands his bundle over ---------------------------------------
  const IDLE = [158, 262];
  poseHook('junior', (t) => {
    if (!TLD) return null; const k = tm();
    if (t < k.land || t > k.lay1 + .2) return null;
    const ts = Math.floor(t * 15) / 15;
    const up = E(ts, k.b0 - .15, .3) * (1 - E(ts, k.b3 - .1, .3));
    return { face: t > k.tab[0] - .2 ? 'grin' : 'smile', look: .55, arms: [IDLE, [lerp(158, 250, up), lerp(262, 20, up)]] };
  });

  // ---------- the story objects (small replicas, same colours as at the guichet / in 46_passeport) ----------
  function card(i) {
    const w = 150, h = 190;
    withShadow(5, () => { ctx.fillStyle = '#FFFDF7'; rrect(-w / 2, -h / 2, w, h, 12); ctx.fill(); });
    ctx.save(); rrect(-w / 2, -h / 2, w, h, 12); ctx.clip(); ctx.fillStyle = QC[i]; ctx.fillRect(-w / 2, -h / 2, w, 48); ctx.restore();
    const f0 = font(FF.stencil, 30, 900), fs = Math.min(30, 30 * (w - 20) / measure(QW[i], f0, 2));
    text(QW[i], 0, -h / 2 + 36, { font: font(FF.stencil, fs, 900), align: 'center', color: '#fff', ls: 2 });
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, -h / 2 + 10, 6, 0, 7); ctx.fill();
    if (i === 0) at(0, 20, 0, 1, 1, () => sneaker(118, { color: '#3F6FB5', accent: '#F3F0E8', lift: 3 }));
    else if (i === 1) { const bl = [['#FFE2C2', 50], ['#3E6E8E', 22], ['#EBD9FF', -6]]; for (const [c, y] of bl) { withShadow(2, () => { ctx.fillStyle = c; rrect(-46, y - 12, 92, 24, 5); ctx.fill(); }); } }
    else { at(-26, 22, 0, 1, 1, () => iconFactory(40, C.inkSoft)); at(24, 38, 0, 1, 1, () => iconCheck(26)); }
  }
  function passport() {
    const w = 170, h = 214;
    ctx.fillStyle = C.violet; ctx.beginPath(); ctx.moveTo(-w / 2 + 16, h / 2 - 10); ctx.lineTo(-w / 2 + 38, h / 2 - 10); ctx.lineTo(-w / 2 + 38, h / 2 + 40); ctx.lineTo(-w / 2 + 27, h / 2 + 30); ctx.lineTo(-w / 2 + 16, h / 2 + 40); ctx.closePath(); ctx.fill();
    withShadow(6, () => { ctx.fillStyle = DC.green; rrect(-w / 2, -h / 2, w, h, 12); ctx.fill(); });
    ctx.strokeStyle = 'rgba(246,197,74,.9)'; ctx.lineWidth = 3; rrect(-w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 7); ctx.stroke();
    text('PASSEPORT', 0, -h / 2 + 48, { font: font(FF.stencil, 28, 900), align: 'center', color: DC.yellow, ls: 2 });
    text('DE LA MARCHANDISE', 0, -h / 2 + 68, { font: font(FF.body, 12.5, 800), align: 'center', color: DC.yellow });
    at(0, 26, 0, 1, 1, () => carton(64, 46, { seed: 5 }));
  }
  /** the bundle: 3 cards fanned + the passport in front; p = 0 at Junior's hand … 1 inside the folder */
  function bundle(t) {
    const k = tm(); if (t < k.b0) return;
    const hand = (() => { const st = actorAt('junior', t); return st ? toLocal(st.x + 35, st.y + 75) : toLocal(8085, 905); })();
    const BS = .72, hh = 107 * BS;                                    // bundle scale, half height of its tallest item
    const hover = [0, -FH / 2 - hh - 4], inside = [0, -FH / 2 + hh - 24];  // just above the folder · inside, tops peeking 24 above it
    const u = eOutCubic(prog(t, k.b0, k.b1)), v = eInOutCubic(prog(t, k.b2, k.b3));
    let x, y, s, fan;
    if (t < k.b2) { const c = [hand[0] + 40, hover[1] - 70]; x = (1 - u) * (1 - u) * hand[0] + 2 * u * (1 - u) * c[0] + u * u * hover[0];
      y = (1 - u) * (1 - u) * hand[1] + 2 * u * (1 - u) * c[1] + u * u * hover[1]; s = lerp(.45, BS, u); fan = u; }
    else { x = lerp(hover[0], inside[0], v); y = lerp(hover[1], inside[1], v); s = BS; fan = 1 - v; }
    const pos = [[-80, 12, -.28], [0, -14, 0], [80, 12, .28]];      // fanned: the three coloured headers read above the passport
    ctx.save(); ctx.globalAlpha *= clamp(u * 5);
    at(x, y, 0, s, s, () => {
      pos.forEach(([dx, dy, r], i) => at(dx * fan, dy * fan, r * fan, 1, 1, () => card(i)));
      at(34 * fan, 40 * fan + 12, .08 * fan, lerp(1, .85, fan), lerp(1, .85, fan), () => passport());
    });
    ctx.restore();
  }

  // ---------- the folder -------------------------------------------------------------------------------
  function tabStrip(i, k) {                                            // index tab sliding out of the right edge
    if (k <= 0) return; const y = -FH / 2 + 180 + i * 86 - 34;
    at(FW / 2 - 70 + 76 * eOutBack(clamp(k)), y, 0, 1, 1, () => withShadow(4, () => { ctx.fillStyle = TABC[i]; rrect(-20, -26, 70, 52, 12); ctx.fill(); }));
  }
  function folderBody(t, det = 1) {
    const k = tm();
    withShadow(12, () => { ctx.fillStyle = MANILA; rrect(-FW / 2, -FH / 2, FW, FH, 20); ctx.fill(); rrect(-FW / 2, -FH / 2 - 44, FW * .38, 70, 16); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-FW / 2 + 10, -FH / 2 + 8, FW - 20, 6);
    if (det <= 0) return; ctx.save(); ctx.globalAlpha *= det;
    ctx.strokeStyle = 'rgba(120,80,30,.25)'; ctx.lineWidth = 3; rrect(-FW / 2 + 18, -FH / 2 + 18, FW - 36, FH - 36, 12); ctx.stroke();
    text('PARTIE 2', -FW / 2 + 40, -FH / 2 + 110, { font: font(FF.stencil, 96, 900), color: C.ink, ls: 4 });
    ctx.fillStyle = C.orange; ctx.fillRect(-FW / 2 + 42, -FH / 2 + 124, 150, 6);
    TABS.forEach((lab, i) => {
      const q = E(t, k.tab[i], .45); if (q <= 0) return; const y = -FH / 2 + 180 + i * 86;
      at(-FW / 2 + 54, y - 15, 0, clamp(spring(t - k.tab[i], 16, .5), 0, 1.2), clamp(spring(t - k.tab[i], 16, .5), 0, 1.2), () => { ctx.fillStyle = TABC[i]; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fill(); });
      const f = font(FF.body, 46, 800), w = measure(lab, f);
      ctx.save(); ctx.beginPath(); ctx.rect(-FW / 2 + 80, y - 50, (w + 20) * q, 70); ctx.clip(); text(lab, -FW / 2 + 86, y, { font: f, color: C.ink }); ctx.restore();
    });
    ctx.restore();
  }
  function drawFolder(t, n) {
    const k = tm(); if (t < k.drop) return;
    const d = drop(t, k.drop, 260, .32), lay = eInCubic(prog(t, k.lay0, k.lay1));
    const sq = lay >= 1 ? Math.exp(-(t - k.lay1) * 10) * Math.cos((t - k.lay1) * 34) * .12 : 0;
    const sy = lerp(1, .085, lay) * (1 + sq), sk = Math.sin(lay * Math.PI) * -.12;
    ctx.save(); ctx.translate(FC.x, FC.y + FH / 2 / ZL); ctx.scale(1 / ZL, 1 / ZL);   // pivot = bottom edge centre, local units
    ctx.translate(0, d.y * ZL); ctx.transform(1, 0, sk, 1, 0, 0); ctx.scale(d.sx, d.sy * sy); ctx.translate(0, -FH / 2);
    TABS.forEach((_, i) => tabStrip(i, E(t, k.tab[i] + .05, .4)));
    const det = 1 - clamp(lay * 2.2);                                  // lying flat: only the manila edge and the coloured tabs remain
    if (det > 0) { ctx.save(); ctx.globalAlpha *= det; bundle(t); ctx.restore(); }
    folderBody(t, det);
    ctx.restore();
  }
  const inWin = t => TLD && t > ss('S28', -1.2);
  registerScene({ id: 'F52_folder', z: 34, draw(t, n) { if (!inWin(t)) return; tm(); if (!inView(FC.x, FC.y, 420, t) && Math.abs(camAt(t).r) < .01) return; ctx.save(); worldBegin(t); drawFolder(t, n); ctx.restore(); } });
})();

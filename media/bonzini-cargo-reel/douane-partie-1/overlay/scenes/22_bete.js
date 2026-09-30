'use strict';
// =============================================================================================
// 22_bete — chapitre « bete » (S2 + S3)
// S2 « La douane ? La bête noire de tout le monde. Pourtant… vous la connaissez déjà. »
//  · théâtre de papier en 3 plans (colline arrière, Junior, colline avant) ; Junior inquiet (sueur).
//  · « La » : deux cornes pointent derrière la colline ; « douane » : la bête noire MONTE (ressort), ses yeux suivent Junior,
//    la table s'assombrit ; « bête » : bande « LA BÊTE NOIRE » claque ; « noire » : la bête mâchouille.
//  · « tout le monde » : 4 petites silhouettes papier surgissent et tremblent, des « ?! » poppent.
//  · « Pourtant » : flèche manuscrite autour de la bête, la bande est barrée, la bête se replie et disparaît ;
//    « vous » : un panneau d'aéroport (DÉPARTS / ARRIVÉES) se déplie, suspendu par deux ficelles ;
//    Junior réfléchit (main au menton) puis sourit et pointe le panneau sur « connaissez ».
// S3 « À l'aéroport : passeport, questions, rayons X. Vos cartons ? Pareil. »
//  · le panneau monte en en-tête, un avion traverse sur « aéroport » ;
//  · 3 cartes claquent une par mot (colonne gauche) : passeport bordeaux + tampon VU, bulle « ? »,
//    valise sur tapis sous un portique : le faisceau cyan la révèle en négatif ;
//  · « cartons » : 3 cartes kraft glissent en face (colonne droite) : passeport vert + papiers, carton + 3 « ? »,
//    vrai tirage (conteneurs) balayé aux rayons X qui révèle des rangées de cartons ;
//  · « Pareil » : trois « = » déchirés relient les colonnes, bande « PAREIL ! » ambre claque.
// =============================================================================================
(() => {
  let reg = false, TT = null, PH_T = null, PH_X = null;
  const k01 = (t, a, d) => clamp((t - a) / Math.max(1e-3, d));
  const MON = [620, 1275, 560], JUN = [212, 1238, .78], PANEL = [618, 818, 620, 330], HEAD = [540, 362, .6];
  const SIL = [[790, '#5B4A66'], [878, '#9C7447'], [962, '#C77A12'], [1046, '#4A3A52']];
  const ROWY = [590, 834, 1078], LX = 258, RX = 822, CWD = 440, CHT = 220;

  function times() {
    if (TT) return TT;
    const ch = TL.ch('bete'), s2 = TL.seg('S2'), s3 = TL.seg('S3');
    const g2 = (w, fb) => TL.wt('S2', w, fb), g3 = (w, fb) => TL.wt('S3', w, fb);
    TT = { ch, s2, s3, douane: g2('douane'), bete: g2('bete'), noire: g2('noire'), tout: g2('tout'), monde: g2('monde'),
      pourtant: g2('pourtant'), vous: g2('vous'), conn: g2('connaissez'), deja: g2('deja'),
      aero: g3('aeroport'), pass: g3('passeport'), quest: g3('questions'), ray: g3('rayons'), vos: g3('vos'), cart: g3('cartons'), pareil: g3('pareil') };
    TT.x0 = Math.max(s2.end - .1, s3.start - .5); TT.x1 = Math.max(TT.x0 + .32, s3.start + .02);
    TT.unfold = Math.max(TT.vous - .1, TT.pourtant + .45);
    return TT;
  }

  // ------------------------------------------------------------------ photo (same cleaning as the hook: marks painted out)
  const MARKS = [[106, 465, 18, 22], [18, 515, 18, 22], [103, 520, 14, 22], [18, 565, 18, 22], [170, 614, 18, 22], [12, 668, 16, 12],
    [195, 511, 30, 12], [240, 559, 16, 11], [160, 410, 12, 9], [242, 405, 12, 9], [450, 615, 14, 11], [497, 567, 17, 22], [515, 630, 17, 22],
    [532, 612, 12, 12], [566, 515, 17, 22], [565, 575, 17, 22], [762, 540, 17, 22], [675, 492, 104, 14], [1005, 508, 30, 12],
    [542, 265, 16, 17], [669, 251, 17, 17], [14, 348, 16, 17]];
  function photos() {
    if (PH_T) return true;
    const im = ph('containers_cranes'); if (!im) return false;
    const w = im.naturalWidth, h = im.naturalHeight, c = makeCanvas(w, h), g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    for (let pass = 0; pass < 2; pass++) for (const [x, y, rx, ry] of MARKS) { g.save(); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.clip(); g.filter = 'blur(10px)'; g.drawImage(c, 0, 0); g.restore(); }
    const d = g.getImageData(0, 0, w, h), p = d.data, L = new Float32Array(w * h);
    for (let i = 0, j = 0; i < p.length; i += 4, j++) L[j] = (p[i] * .299 + p[i + 1] * .587 + p[i + 2] * .114) / 255;
    // violet tritone
    const t = makeCanvas(w, h), tg = t.getContext('2d'), td = tg.createImageData(w, h), q = td.data;
    const S = [23, 11, 38], M = [112, 46, 190], Lc = [247, 240, 255];
    for (let j = 0; j < L.length; j++) { let l = clamp((L[j] - .06) / .86); l = l * l * (3 - 2 * l);
      const a = l < .5 ? S : M, b = l < .5 ? M : Lc, k = l < .5 ? l * 2 : (l - .5) * 2, i = j * 4;
      q[i] = a[0] + (b[0] - a[0]) * k; q[i + 1] = a[1] + (b[1] - a[1]) * k; q[i + 2] = a[2] + (b[2] - a[2]) * k; q[i + 3] = 255; }
    tg.putImageData(td, 0, 0);
    // x-ray negative (edges + inverted density, cyan)
    const x = makeCanvas(w, h), xg = x.getContext('2d'), xd = xg.createImageData(w, h), r = xd.data;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const j = yy * w + xx, gx = xx > 0 && xx < w - 1 ? L[j + 1] - L[j - 1] : 0, gy = yy > 0 && yy < h - 1 ? L[j + w] - L[j - w] : 0;
      const e = Math.min(1, Math.hypot(gx, gy) * 3.2), v = clamp((1 - L[j]) * .5 + e * .9), i = j * 4;
      r[i] = 14 + 80 * v; r[i + 1] = 30 + 205 * v; r[i + 2] = 60 + 195 * v; r[i + 3] = 255; }
    xg.putImageData(xd, 0, 0);
    PH_T = t; PH_X = x; return true;
  }

  // ------------------------------------------------------------------ S2 pieces
  function hill(y0, amp, seed, fill, tint) {
    const pts = []; for (let x = -80; x <= W + 80; x += 12) pts.push([x, y0 + Math.sin(x * .0055 + seed) * amp + (rnd(seed * 13 + x * .31) - .5) * 5]);
    ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.32)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = -8;       // paper layer casts its shadow on the layer behind
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(-80, H + 400); for (const p of pts) ctx.lineTo(...p); ctx.lineTo(W + 80, H + 400); ctx.closePath(); ctx.fill(); ctx.restore();
    if (tint) { ctx.fillStyle = tint; ctx.beginPath(); ctx.moveTo(-80, H + 400); for (const p of pts) ctx.lineTo(...p); ctx.lineTo(W + 80, H + 400); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,240,210,.35)'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1] + 3) : ctx.moveTo(p[0], p[1] + 3)); ctx.stroke();
  }
  function silhouette(col, look, fear) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, 0, 60, 54, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -86, 38, 0, 7); ctx.fill();
    for (const s of [-1, 1]) { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.ellipse(s * 13, -92, 9, fear ? 12 : 9, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#140C10'; ctx.beginPath(); ctx.arc(s * 13 + look * 4, -90, 4.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#2A1420'; if (fear) { ctx.beginPath(); ctx.ellipse(0, -66, 7, 9, 0, 0, 7); ctx.fill(); }
    else { ctx.strokeStyle = '#2A1420'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, -72, 10, .3, Math.PI - .3); ctx.stroke(); }
  }
  function burst(txt, col) {
    withShadow(6, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 40 : 52; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); });
    text(txt, 0, 17, { font: font(FF.hand, 50, 800), align: 'center', color: col });
  }
  /** airport sign (dark blue, yellow lettering, pictograms) — generic, no logo */
  function airportSign(w, h, n) {
    withShadow(16, () => { ctx.fillStyle = '#17294A'; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 4; rrect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 14); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(-w / 2 + 26, -2, w - 52, 4);
    [['DÉPARTS', -1], ['ARRIVÉES', 1]].forEach(([lab, s]) => {
      const y = s * h / 4;
      ctx.fillStyle = '#FFFDF7'; rrect(-w / 2 + 34, y - 50, 100, 100, 14); ctx.fill();
      at(-w / 2 + 84, y, s * .55, 1.55, 1.55, () => iconPlane('#17294A'));
      text(lab, -w / 2 + 164, y + 27, { font: font(FF.stencil, 76, 900), color: DC.yellow, ls: 4 });
      ctx.strokeStyle = DC.yellow; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const ax = w / 2 - 58, d = s < 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(ax - 26 * d, y); ctx.lineTo(ax + 26 * d, y); ctx.moveTo(ax + 8 * d, y - 18); ctx.lineTo(ax + 26 * d, y); ctx.lineTo(ax + 8 * d, y + 18); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(-w / 2 + w * .45, -h / 2); ctx.lineTo(-w / 2 + w * .2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fill();
  }

  // ------------------------------------------------------------------ S3 cards
  function card(kraft) {
    withShadow(12, () => { ctx.fillStyle = kraft ? DC.greenL : DC.paper; rrect(-CWD / 2, -CHT / 2, CWD, CHT, 20); ctx.fill(); });
    if (kraft) { ctx.save(); rrect(-CWD / 2, -CHT / 2, CWD, CHT, 20); ctx.clip(); ctx.strokeStyle = 'rgba(14,107,78,.10)'; ctx.lineWidth = 2;        // guilloche, passport-page feel
      for (let r = 0; r < 9; r++) { ctx.beginPath(); for (let x = -CWD / 2; x <= CWD / 2; x += 10) { const y = -CHT / 2 + 14 + r * 26 + Math.sin(x * .03 + r) * 6; x === -CWD / 2 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); } ctx.restore(); }
    ctx.strokeStyle = kraft ? 'rgba(14,107,78,.45)' : 'rgba(35,22,41,.10)'; ctx.lineWidth = 3; rrect(-CWD / 2 + 10, -CHT / 2 + 10, CWD - 20, CHT - 20, 14); ctx.stroke();
  }
  function label(s, col) {
    const f0 = font(FF.stencil, 60, 900), wd = measure(s, f0, 2), fs = Math.max(44, Math.min(60, 60 * 206 / wd));
    text(s, 100, 20, { font: font(FF.stencil, fs, 900), align: 'center', color: col, ls: 2 });
  }
  function vuStamp(col) { stampText('VU', 0, 0, font(FF.stencil, 64, 900), col, { box: true, h: 92, boxW: 7, starve: .45 }); }
  function humanPassport() {
    at(-126, 0, -.08, 1, 1, () => {
      withShadow(6, () => { ctx.fillStyle = '#7A1F2B'; rrect(-64, -84, 128, 168, 12); ctx.fill(); });
      ctx.strokeStyle = 'rgba(246,197,74,.85)'; ctx.lineWidth = 3; rrect(-54, -74, 108, 148, 8); ctx.stroke();
      text('PASSEPORT', 0, -32, { font: font(FF.stencil, 21, 900), align: 'center', color: DC.yellow, ls: 0 });
      ctx.fillStyle = 'rgba(246,197,74,.85)'; ctx.fillRect(-34, 30, 68, 5); ctx.fillRect(-24, 44, 48, 5);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-64, -84, 10, 168);
    });
  }
  function speech(w, h, fill, stroke) {
    withShadow(6, () => { ctx.fillStyle = fill; rrect(-w / 2, -h / 2, w, h, 34); ctx.fill(); ctx.beginPath(); ctx.moveTo(-w * .25, h / 2 - 6); ctx.lineTo(-w * .42, h / 2 + 38); ctx.lineTo(-w * .05, h / 2 - 6); ctx.closePath(); ctx.fill(); });
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 4; rrect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 28); ctx.stroke(); }
  }
  /** big suitcase pictogram; xray = negative view with the contents outlined in cyan */
  function suitcaseBody(xray) {
    if (!xray) {
      ctx.fillStyle = '#2B2230'; rrect(-30, -74, 60, 28, 11); ctx.fill(); ctx.fillStyle = DC.paper; rrect(-19, -67, 38, 13, 6); ctx.fill();
      withShadow(5, () => { ctx.fillStyle = C.orange; rrect(-82, -54, 164, 112, 18); ctx.fill(); });
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(-48, -54, 11, 112); ctx.fillRect(37, -54, 11, 112);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; rrect(-74, -47, 148, 15, 7); ctx.fill();
      ctx.fillStyle = C.amber; ctx.fillRect(-50, 4, 15, 20); ctx.fillRect(35, 4, 15, 20);
    } else {
      ctx.fillStyle = '#0E2440'; rrect(-82, -54, 164, 112, 18); ctx.fill();
      ctx.strokeStyle = XRAY; ctx.lineWidth = 3; ctx.stroke(); rrect(-30, -74, 60, 28, 11); ctx.stroke();
      ctx.fillStyle = 'rgba(127,231,255,.3)'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-68, 36); ctx.lineTo(-66, 4); ctx.quadraticCurveTo(-64, -8, -50, -8); ctx.lineTo(-36, -8); ctx.quadraticCurveTo(-30, 8, -12, 12);        // a sneaker
      ctx.lineTo(4, 16); ctx.quadraticCurveTo(18, 22, 16, 36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-64, 28); ctx.lineTo(12, 28); ctx.stroke();
      rrect(30, -26, 26, 62, 9); ctx.fill(); ctx.stroke(); rrect(37, -40, 12, 16, 4); ctx.fill(); ctx.stroke();                                                        // a bottle
      ctx.beginPath(); ctx.arc(-40, -30, 11, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(-14, -30, 11, 0, 7); ctx.fill(); ctx.stroke();                // rolled socks
    }
  }
  /** « rayons X » : a cyan beam sweeps the suitcase left → right, the scanned part shows its inside in negative */
  function suitcaseScan(t, T, n) {
    const k = eInOutCubic(k01(t, T.ray - .04, .55)), lx = lerp(-100, 100, k), b = pop(t, T.ray - .1, 14, .5);
    at(-120, 8, -.03, 1, 1, () => {
      ctx.save(); ctx.beginPath(); ctx.rect(lx, -100, 220, 200); ctx.clip(); suitcaseBody(false); ctx.restore();
      if (k > 0) { ctx.save(); ctx.beginPath(); ctx.rect(-120, -100, lx + 120, 200); ctx.clip(); suitcaseBody(true); ctx.restore(); }
      ctx.save(); ctx.strokeStyle = k > 0 ? '#1B9CC4' : 'rgba(35,22,41,.35)'; ctx.lineWidth = 6; ctx.lineCap = 'round';                // scanner viewfinder corners
      const bx = 96 * b, by = 86 * b;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(sx * bx, sy * (by - 22)); ctx.lineTo(sx * bx, sy * by); ctx.lineTo(sx * (bx - 22), sy * by); ctx.stroke(); }
      ctx.restore();
      if (k > 0 && k < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(lx - 50, 0, lx + 4, 0); g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(1, 'rgba(170,245,255,.9)');
        ctx.fillStyle = g; ctx.fillRect(lx - 50, -92, 54, 184); ctx.fillStyle = 'rgba(230,252,255,1)'; ctx.fillRect(lx - 2, -92, 4, 184); ctx.restore(); }
    });
  }
  function miniSheet(w, h, band) {
    withShadow(5, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.fillStyle = band; ctx.fillRect(-w / 2, -h / 2, w, h * .17);
    ctx.fillStyle = 'rgba(35,22,41,.18)'; for (let i = 0; i < 5; i++) ctx.fillRect(-w / 2 + 12, -h / 2 + h * .3 + i * h * .13, w * (i % 2 ? .55 : .75), 5);
  }
  function goodsPapers() {
    [[36, DC.blue, -.16], [88, C.violetD, 0], [138, DC.green, .15]].forEach(([x, b, r], i) => at(x, -4 + i * 3, r, 1, 1, () => miniSheet(112, 146, b)));
    at(-112, 4, -.06, .6, .6, () => goodsPassport(220, 294, 0));            // drawn big then scaled: keeps the cover lettering inside
    at(66, 66, -.16, .85, .85, () => vuStamp(DC.green));
  }
  function goodsQuestions(n) {
    at(-116, 44, -.06, 1, 1, () => { withShadow(6, () => { ctx.fillStyle = C.kraftD; rrect(-76, -55, 152, 110, 6); ctx.fill(); }); juniorCarton(152, 110); });
    const w = jit(231, n, .6);
    at(52 + w.x, -34 + w.y, .04 + w.r, 1, 1, () => {                     // keeps the last « ? » left of x 960
      speech(226, 112, '#FFFDF7', 'rgba(35,22,41,.18)');
      QCOL.forEach((c, i) => text('?', -64 + i * 64, 28, { font: font(FF.stencil, 82, 900), align: 'center', color: c }));
    });
  }
  function goodsXray(t, T) {
    const pw = 396, phh = 188, b = 9;
    withShadow(6, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-pw / 2 - b, -phh / 2 - b, pw + 2 * b, phh + 2 * b); });
    ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, -phh / 2, pw, phh); ctx.clip();
    const have = photos(), o = { zoom: 1.05, fx: .45, fy: .56 };
    if (have) photoCover(PH_T, -pw / 2, -phh / 2, pw, phh, o); else { ctx.fillStyle = '#6A4FA0'; ctx.fillRect(-pw / 2, -phh / 2, pw, phh); }
    const kr = eInOutCubic(k01(t, T.cart - .02, Math.max(.5, T.pareil + .35 - T.cart))), bx = -pw / 2 + pw * kr;
    if (kr > 0 && have) {
      ctx.save(); ctx.beginPath(); ctx.rect(-pw / 2, -phh / 2, bx + pw / 2, phh); ctx.clip();
      photoCover(PH_X, -pw / 2, -phh / 2, pw, phh, o);
      // rows of cartons revealed inside the containers
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
        const x = -pw / 2 + 18 + c * 42 + (r % 2) * 10, y = -8 + r * 30;
        ctx.fillStyle = 'rgba(127,231,255,.22)'; ctx.fillRect(x, y, 34, 24); ctx.strokeStyle = XRAY; ctx.lineWidth = 2; ctx.strokeRect(x, y, 34, 24);
        ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x + 34, y + 12); ctx.stroke();
      }
      ctx.restore();
      if (kr < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(bx - 44, 0, bx + 6, 0); g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(1, 'rgba(170,245,255,.95)');
        ctx.fillStyle = g; ctx.fillRect(bx - 44, -phh / 2, 50, phh); ctx.fillStyle = 'rgba(230,252,255,1)'; ctx.fillRect(bx - 2, -phh / 2, 4, phh); ctx.restore(); }
    }
    const g = ctx.createLinearGradient(-pw / 2, -phh / 2, pw / 2, phh / 2); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-pw / 2, -phh / 2, pw, phh);
    ctx.restore();
    ctx.fillStyle = C.tape; at(-pw / 2 + 8, -phh / 2 - 6, -.6, 1, 1, () => ctx.fillRect(-36, -12, 72, 24)); at(pw / 2 - 8, phh / 2 + 6, -.6, 1, 1, () => ctx.fillRect(-36, -12, 72, 24));
    creditTag(CREDIT.containers_cranes, 140, 150);
  }
  function equals() {
    for (const s of [-1, 1]) {
      ctx.fillStyle = C.amber; const top = tornLine(-48, s * 17 - 11, 48, s * 17 - 11, 40 + s * 7, 2.5, 8), bot = tornLine(48, s * 17 + 11, -48, s * 17 + 11, 50 + s * 3, 2.5, 8);
      withShadow(6, () => { ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
    }
  }

  // ------------------------------------------------------------------ the scene
  registerScene({
    id: 'bete', z: 30,
    when: t => TL.in(t, 'bete', .4, .4),
    draw(t, n) {
      const T = times();
      if (t < T.ch.start || t >= T.ch.end) return;                  // cuts happen under the wipes
      if (!reg) { reg = true; addShake(T.douane + .36, 9); addShake(T.bete, 5); addShake(T.pass, 6); addShake(T.quest, 6); addShake(T.ray, 6); addShake(T.pareil + .1, 12); }
      const sh = shake(t, n); ctx.translate(sh.x, sh.y);
      const ts = stepT(n), d = drift(t, 22, 6);
      const kx = eInOutCubic(k01(ts, T.x0, T.x1 - T.x0));             // S2 → S3 transition
      const sink = 1000 * eInCubic(k01(ts, T.x0, (T.x1 - T.x0) * .85));

      // mood: the table darkens while the monster is up
      const dim = .3 * env(t, T.douane - .05, T.pourtant + .5, .35, .5);
      if (dim > 0) { const g = ctx.createRadialGradient(W / 2, 900, 200, W / 2, 900, 1200); g.addColorStop(0, `rgba(23,11,38,${dim * .6})`); g.addColorStop(1, `rgba(23,11,38,${dim * 1.6})`); ctx.fillStyle = g; ctx.fillRect(-60, -60, W + 120, H + 120); }

      // strings of the airport sign (behind everything else)
      const uk = clamp(spring(t - T.unfold, 13, .5), 0, 1.15);
      const px = lerp(PANEL[0], HEAD[0], kx), py = lerp(PANEL[1], HEAD[1], kx), psc = lerp(1, HEAD[2], kx);
      const swing = (1 - kx) * .03 * Math.sin(ts * 2.3) + (t >= T.aero ? .05 * Math.exp(-(t - T.aero) * 5) * Math.sin((t - T.aero) * 20) : 0);
      if (t >= T.unfold && kx < 1) { ctx.save(); ctx.globalAlpha = 1 - kx; ctx.strokeStyle = 'rgba(35,22,41,.6)'; ctx.lineWidth = 3;
        for (const s of [-1, 1]) { const ax = px + d.x + s * PANEL[2] * .36 * psc, ay = py + d.y - PANEL[3] / 2 * psc; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - s * 130, -20); ctx.stroke(); } ctx.restore(); }   // V-hang: keeps clear of the series chip

      // ---------------- S2 : stage
      if (t < T.x1) {
        // strip « LA BÊTE NOIRE » (slams on « bête », struck on « Pourtant », flies away at the transition)
        const sl = slam(t, T.bete, 1.8);
        if (sl.a > 0) {
          const j = jit(221, n, .8), up = 700 * eInCubic(k01(ts, T.x0, (T.x1 - T.x0) * .8));
          at(540 + d.x * .6 + j.x, 386 + d.y * .6 + j.y - up, -.03 + j.r - up * .0006, sl.s, sl.s, () => {
            ctx.globalAlpha *= sl.a;
            const w = strip('LA BÊTE NOIRE', { size: 90, fill: C.ink, color: C.cream, seed: 7 });
            const ks = eOutCubic(k01(t, T.pourtant, .28));
            if (ks > 0) { ctx.strokeStyle = DC.red; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-w / 2 + 26, 12); ctx.lineTo(-w / 2 + 26 + (w - 52) * ks, -14 * ks); ctx.stroke(); }
          });
        }
        // the monster (behind the back hill)
        const peek = eOutBack(k01(t, Math.min(T.s2.start - .12, T.ch.start + .4), .22)), rise = eOutBack(k01(t, T.douane - .06, .45));
        const off = lerp(lerp(740, 575, peek), 0, rise);
        const fold = eInOutCubic(k01(t, T.pourtant + .26, .34)), mA = 1 - clamp((fold - .55) / .45);
        if (off < 700 && mA > 0) {
          const look = t < T.tout ? -1 : t < T.pourtant ? .9 : 0;
          const chew = t >= T.bete - .05 && t < T.monde + .25 ? (Math.floor(n / 4) % 2 ? .15 : 1) : 1;
          const br = 1 + .018 * Math.sin(ts * 5.5), mj = jit(222, n, 1);
          at(MON[0] + d.x * .8 + mj.x, MON[1] + off + d.y * .8, mj.r, 1 / br * (1 + .02 * (1 - rise)), br, () => {
            ctx.globalAlpha *= mA; monster(MON[2], 1, { n, look, mouth: chew, fold, label: 'DOUANE ?' }); });
          const pf = t - (T.pourtant + .45);                              // poof of black paper bits as it folds away
          if (pf > 0 && pf < .6) for (let i = 0; i < 14; i++) { const a = rnd(i * 2.7) * Math.PI * 2, v = 260 + rnd(i * 4.1) * 380, s = pf;
            at(MON[0] + Math.cos(a) * v * s, MON[1] - 180 + Math.sin(a) * v * s * .8 + 500 * s * s, a + s * 8, 1, 1, () => { ctx.globalAlpha = clamp((.6 - s) / .25); ctx.fillStyle = i % 4 ? '#17111B' : C.cream; ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(14, -4); ctx.lineTo(2, 12); ctx.closePath(); ctx.fill(); }); }
        }
        // hand-drawn arrow circling the monster on « Pourtant »
        const ka = eOutCubic(k01(t, T.pourtant - .04, .38)), aA = 1 - k01(t, T.pourtant + .55, .25);
        if (ka > 0 && aA > 0) { ctx.save(); ctx.globalAlpha = aA; handArrow([[300, 800], [400, 600], [640, 540], [890, 640], [950, 900], [880, 1150], [760, 1215]], ka, C.violetD, 11); ctx.restore(); }

        // back hill + « tout le monde » silhouettes peeking over it
        ctx.save(); ctx.translate(d.x * .9, d.y * .9 + sink * .8);
        SIL.forEach(([x, col], i) => {
          const k = pop(t, T.tout - .12 + i * .06, 15, .45); if (k <= 0) return;
          const scared = t < T.pourtant, happy = t >= T.conn ? Math.max(0, Math.sin(clamp((t - T.conn - i * .05) / .32) * Math.PI)) * 30 : 0;
          const j = jit(240 + i, n, scared ? 4 : .6);
          at(x + j.x, 1262 + (1 - k) * 150 + j.y - happy, j.r * 3, 1, 1, () => silhouette(col, scared ? -1 : -.4, scared));
        });
        hill(1232, 10, 1.3, TEX.kraft, 'rgba(255,245,225,.18)');
        [[800, 1088, '?!', DC.red], [872, 1004, '!', C.orange], [922, 1078, '?!', C.violetD]].forEach(([x, y, s, c], i) => {
          const k = pop(t, T.tout + .02 + i * .1, 17, .4), out = k01(t, T.pourtant + .1, .2); if (k <= 0 || out >= 1) return;
          const j = jit(250 + i, n, 1.5), sc = k * (1 - out);
          at(x + j.x, y + j.y, (i - 1) * .12, sc, sc, () => burst(s, c));
        });
        ctx.restore();

        // the airport sign unfolds where the monster was (then travels to the header, see below)
        // Junior (in front of the back hill, behind the front hill)
        {
          const face = t < T.pourtant ? 'worry' : t < T.conn ? 'think' : 'grin';
          const arms = t < T.pourtant ? ['idle', 'idle'] : t < T.conn ? ['idle', 'chin'] : ['idle', 'point'];
          const look = t < T.douane ? (Math.floor(ts * 2.4) % 2 ? .8 : -.6) : t < T.pourtant ? .9 : t < T.conn ? .2 : 1;
          const blink = ((n + 11) % 67) < 3, j = jit(223, n, t < T.pourtant && t > T.douane ? 2.2 : .7);
          const inK = clamp(spring(t - T.ch.start - .05, 12, .55), 0, 1.1);
          const hop = t >= T.conn ? Math.max(0, Math.sin(clamp((t - T.conn) / .3) * Math.PI)) * 36 : 0;
          at(JUN[0] + d.x * 1.2 + j.x, JUN[1] + d.y * 1.2 + j.y + (1 - inK) * 460 - hop + sink, -.03 + j.r, JUN[2], JUN[2], () =>
            junior({ face, arms, look, blink, sweat: face === 'worry', tilt: face === 'think' ? .08 : 0 }));
        }
        ctx.save(); ctx.translate(d.x * 1.3, d.y * 1.3 + sink); hill(1402, 16, 2.6, '#8A6238', 'rgba(60,32,12,.08)'); ctx.restore();
      }

      // ---------------- the airport sign (S2 end → S3 header)
      if (t >= T.unfold && t < T.pareil + .1) {
        const aP = t >= T.aero ? 1 + .08 * Math.exp(-(t - T.aero) * 6) * Math.sin((t - T.aero) * 22) : 1;
        at(px + d.x, py - PANEL[3] / 2 * psc + d.y, swing, psc * aP, psc * aP * uk, () => { ctx.translate(0, PANEL[3] / 2); airportSign(PANEL[2], PANEL[3], n); });
      }

      // ---------------- S3
      if (t >= T.x0) {
        // a plane crosses on « l'aéroport »
        const kp = k01(t, T.aero - .06, .75);
        if (kp > 0 && kp < 1) {
          const x = lerp(-140, W + 140, kp), y = 540 - 60 * Math.sin(kp * Math.PI);
          ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 5; ctx.setLineDash([16, 14]); ctx.lineCap = 'round'; ctx.beginPath();
          for (let i = 0; i <= 20; i++) { const kk = Math.max(0, kp - .3 + i * .015), xx = lerp(-140, W + 140, kk), yy = 540 - 60 * Math.sin(kk * Math.PI); i ? ctx.lineTo(xx - 70, yy + 4) : ctx.moveTo(xx - 70, yy + 4); }
          ctx.stroke(); ctx.restore();
          at(x, y, -.2 * Math.cos(kp * Math.PI), 2.6, 2.6, () => withShadow(8, () => iconPlane(C.violetD)));
        }
        const TW = [T.pass, T.quest, T.ray], rotL = [-.045, .03, -.02], rotR = [.035, -.03, .025];
        // dashed slots wait for the cards (left on « l'aéroport », right on « Vos »)
        [[LX, T.aero + .1, TW], [RX, T.vos - .05, [T.cart - .24, T.cart - .15, T.cart - .06]]].forEach(([x, t0, tin], c) => ROWY.forEach((y, i) => {
          const k = pop(t, t0 + i * .08, 15, .5), gone = t >= tin[i] + (c ? .1 : -.02); if (k <= 0 || gone) return;
          at(x + d.x * .7, y + d.y * .7, (c ? rotR : rotL)[i] * .5, k, k, () => {
            ctx.save(); ctx.setLineDash([18, 14]); ctx.lineDashOffset = -ts * 40; ctx.strokeStyle = c ? 'rgba(14,107,78,.6)' : 'rgba(123,34,214,.45)'; ctx.lineWidth = 5;
            rrect(-CWD / 2, -CHT / 2, CWD, CHT, 20); ctx.stroke(); ctx.restore();
            ctx.globalAlpha *= .5; at(0, 0, c ? 0 : -.3, 1.4, 1.4, () => c ? carton(90, 64, { seed: 9 }) : iconPlane(C.violetD));
          });
        }));
        // left column: the airport (slams on each word)
        TW.forEach((tw, i) => {
          const sl = slam(t, tw, 1.85); if (sl.a <= 0) return;
          const j = jit(260 + i, n, .7), br = 1 + .008 * Math.sin(ts * 4 + i);
          at(LX + d.x + j.x, ROWY[i] + d.y + j.y, rotL[i] + j.r, sl.s * br, sl.s * br, () => {
            ctx.globalAlpha *= sl.a; card(false);
            if (i === 0) { humanPassport(); at(-58, 60, -.18, .8, .8, () => vuStamp(DC.blue)); label('PASSEPORT', '#7A1F2B'); }
            if (i === 1) { at(-120, -8, .05 * Math.sin(ts * 3), 1, 1, () => { speech(160, 120, C.violet); text('?', 0, 40, { font: font(FF.stencil, 112, 900), align: 'center', color: '#fff' }); }); label('QUESTIONS', C.violetD); }
            if (i === 2) { suitcaseScan(t, T, n); label('RAYONS X', DC.blue); }
          });
        });
        // right column: your cartons (slide in on « cartons »)
        [0, 1, 2].forEach(i => {
          const kr = k01(ts, T.cart - .24 + i * .09, .3); if (kr <= 0) return;
          const e = eOutBack(kr, 1.4), j = jit(270 + i, n, .7), land = t - (T.cart + .06 + i * .09);
          const sq = land > 0 ? Math.exp(-land * 10) * Math.cos(land * 34) * .05 : 0;
          at(lerp(W + 420, RX, e) + d.x + j.x, ROWY[i] + d.y + j.y, lerp(.35, rotR[i], eOutCubic(kr)) + j.r, 1 + sq, 1 - sq, () => {
            card(true);
            if (i === 0) goodsPapers();
            if (i === 1) goodsQuestions(n);
            if (i === 2) goodsXray(t, T);
          });
        });
        // « Pareil » : torn « = » between each pair, then the amber strip
        [0, 1, 2].forEach(i => { const k = pop(t, T.pareil - .04 + i * .07, 16, .42); if (k <= 0) return;
          const j = jit(280 + i, n, .6); at(540 + d.x + j.x, ROWY[i] + d.y + j.y, (i - 1) * .06 + j.r, k, k, equals); });
        const sp = slam(t, T.pareil + .1, 2);
        if (sp.a > 0) { const j = jit(290, n, .8); at(540 + d.x + j.x, 356 + d.y + j.y, -.04 + j.r, sp.s, sp.s, () => { ctx.globalAlpha *= sp.a; strip('PAREIL !', { size: 104, fill: C.amber, color: C.ink, seed: 9 }); }); }
      }
    },
  });
})();

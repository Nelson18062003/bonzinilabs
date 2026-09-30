'use strict';
// =============================================================================================
// 60_export — chapitre « export » (S12)
// « Vous exportez ? Ça se déclare aussi, même sans rien à payer. »
//  · coupe (sous le volet « page ») : vrai tirage du port de Kribi (duotone vert clair, positif), light leak, Ken Burns.
//  · « Vous »      : Mireille (exportatrice, foulard wax) surgit du bas en serrant son sac de POIVRE DE PENJA.
//  · « exportez »  : bande orange « VOUS EXPORTEZ ? » qui claque ; flèche orange qui SORT du port vers le large,
//                    un petit sac file dessus ; puce « EXPORT ».
//  · « Ça »        : passage RAYONS X sur le sac (grains de poivre en négatif cyan) — même contrôle qu'à l'import.
//  · « se déclare » : le passeport ORANGE de la marchandise tombe (écrasement), s'ouvre : page d'identité (le sac,
//                    « Mireille · Penja ») + DÉCLARATION (Poivre / Cameroun / EXPORT) écrite au feutre.
//  · « aussi »     : tampon rond « SORTIE » qui claque (tremblement, éclats d'encre).
//  · « même »      : la bande orange s'arrache, « MÊME SANS RIEN À PAYER » (vert) claque à sa place.
//  · « sans » / « rien » : un papier jaune glisse de derrière le passeport : « + certificat d'origine », « + phytosanitaire
//                    (selon le produit) ».  « payer » : Mireille fait un clin d'œil, pouce levé.
// Aucun montant, aucun taux (rester général : « rien à payer » n'est pas une promesse chiffrée). Kribi = positif seulement.
// La scène possède l'image de TL.ch('export').start à .end (coupe franche sous les volets) : elle repeint la table d'abord.
// =============================================================================================
(() => {
  const CH = 'export', SEG = 'S12';
  const PHOTO = { x: 492, y: 612, w: 720, h: 420, r: -.03 };
  const DUO_K = ['#12503F', '#FFF4DA'];                              // duotone vert « lumineux » (positif)
  const MIR = { x: 858, y: 1028, s: .68 };                           // Mireille (poitrine)
  const SACK = { dx: -2, dy: 106, w: 232, h: 262 };                  // sac, relatif à la poitrine (px écran)
  const PASS = { x: 402, y: 1030, w: 290, h: 392 };                  // x = charnière : page droite [x, x+w], page gauche [x-w, x]
  const NOTE = { x: 318, y: 756, r: -.035 };
  const HEAD_Y = 312;
  const ARROW = [[74, 36], [-20, -6], [-140, -58], [-296, -138]];    // flèche EXPORT, repère du tirage
  let T = null, reg = false;

  function times() {
    const c = TL.ch(CH), w = k => TL.wt(SEG, k);
    const o = { c0: c.start, c1: c.end };
    let prev = -1e9;
    for (const k of ['vous', 'exportez', 'ca', 'se', 'declare', 'aussi', 'meme', 'sans', 'rien', 'payer']) { const v = Math.max(w(k), prev + .1); o[k] = v; prev = v; }
    o.rise = Math.min(o.vous - .1, Math.max(o.c0 + .14, o.vous - .3));             // pops as the page wipe clears, lands on « Vous »
    o.land = o.ca + .14;                                             // passport lands on « Ça » (drop starts .2 before)
    o.xr0 = clamp(o.ca + .34, o.land + .1, Math.max(o.land + .1, o.declare - .32));   // x-ray pass on the sack
    o.open = Math.max(o.declare, o.land + .2);
    o.stamp = Math.max(o.aussi, o.open + .28);
    o.swap = o.meme;
    o.wink = o.payer;
    return o;
  }

  // ---------------------------------------------------------------------------- helpers (file-local)
  const settle = (t, t0, f = 10, w = 36, a = .07) => t > t0 ? Math.exp(-(t - t0) * f) * Math.cos((t - t0) * w) * a : 0;
  function _ex_tape(x, y, r, w = 104) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-w / 2, -17, w, 34); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2, -13, w, 5); }); }
  function _ex_burst(k, r0, col, count = 10) {
    if (k <= 0 || k >= 1) return; ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = 9 * (1 - k) + 1;
    for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + .3, ra = r0 + 40 * k, rb = ra + 46 * (1 - k) + 10;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * ra, Math.sin(a) * ra); ctx.lineTo(Math.cos(a) * rb, Math.sin(a) * rb); ctx.stroke(); }
    ctx.restore();
  }
  /** jute sack body outline (same silhouette as sack()) */
  function _ex_sackPath(w, h) {
    ctx.beginPath(); ctx.moveTo(-w * .42, -h * .38); ctx.quadraticCurveTo(-w * .56, h * .1, -w * .46, h * .48); ctx.quadraticCurveTo(0, h * .56, w * .46, h * .48);
    ctx.quadraticCurveTo(w * .56, h * .1, w * .42, -h * .38); ctx.quadraticCurveTo(0, -h * .3, -w * .42, -h * .38); ctx.closePath();
  }
  /** the pepper sack with a big readable label; xr = x-ray reveal 0..1, xa = x-ray alpha */
  function _ex_sack(w, h, xr, xa, n) {
    sack(w, h, '', { lift: 12 });
    at(0, h * .08, -.03, 1, 1, () => {
      withShadow(3, () => { ctx.fillStyle = '#FFFBF1'; rrect(-94, -60, 188, 120, 10); ctx.fill(); });
      ctx.strokeStyle = C.orange; ctx.lineWidth = 4; rrect(-86, -52, 172, 104, 7); ctx.stroke();
      text('POIVRE', 0, -6, { font: font(FF.stencil, 52, 900), align: 'center', color: C.ink, ls: 3 });
      text('DE PENJA', 0, 40, { font: font(FF.stencil, 44, 900), align: 'center', color: C.orange, ls: 2 });
    });
    if (xa <= 0 || xr <= 0) return;
    const bx = -w * .6 + w * 1.2 * clamp(xr);
    ctx.save(); ctx.globalAlpha *= xa; ctx.beginPath(); ctx.rect(-w, -h, bx + w, h * 2); ctx.clip();
    _ex_sackPath(w, h); ctx.fillStyle = '#0B1B33'; ctx.fill();
    ctx.save(); _ex_sackPath(w, h); ctx.clip();
    ctx.strokeStyle = 'rgba(127,231,255,.12)'; ctx.lineWidth = 1.5;
    for (let x = -w / 2; x < w / 2; x += 20) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    const fl = Math.floor(n / 2) % 2;
    for (let i = 0; i < 150; i++) {                                    // peppercorns in negative
      const x = (rnd(i * 3.17 + 1) - .5) * w * .92, y = -h * .3 + rnd(i * 5.31 + 2) * h * .8, r = 4 + rnd(i * 7.7) * 4;
      ctx.fillStyle = `rgba(127,231,255,${.35 + rnd(i * 1.9) * .45})`; ctx.beginPath(); ctx.arc(x + fl * .8, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(230,252,255,.55)'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .35, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = XRAY; ctx.lineWidth = 3; _ex_sackPath(w, h); ctx.stroke();
    ctx.restore();
    if (xr > 0 && xr < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= xa;
      const g = ctx.createLinearGradient(bx - 44, 0, bx + 6, 0); g.addColorStop(0, 'rgba(90,220,255,0)'); g.addColorStop(1, 'rgba(160,240,255,.9)');
      ctx.fillStyle = g; ctx.fillRect(bx - 44, -h * .56, 50, h * 1.08); ctx.fillStyle = 'rgba(225,252,255,.95)'; ctx.fillRect(bx - 2, -h * .58, 5, h * 1.12); ctx.restore(); }
  }
  /** the ORANGE goods' passport, hinge at x=0 : right page [0,w] (visas), cover swings to the left page [-w,0] (declaration). k = open 0..1 */
  function _ex_passport(w, h, k, wr) {
    const open = eInOutCubic(clamp(k)), sx = Math.cos(open * Math.PI);
    withShadow(10, () => { ctx.fillStyle = '#EFE6D2'; rrect(4, -h / 2 + 6, w, h, 14); ctx.fill(); });            // page block (thickness)
    ctx.fillStyle = '#F7F2E4'; rrect(0, -h / 2, w, h, 14); ctx.fill();
    if (open > .02) _ex_visaPage(w, h);
    const sg = ctx.createLinearGradient(0, 0, 26, 0); sg.addColorStop(0, 'rgba(60,32,12,.22)'); sg.addColorStop(1, 'rgba(60,32,12,0)'); ctx.fillStyle = sg; ctx.fillRect(0, -h / 2, 26, h);
    if (sx >= 0) at(0, 0, 0, Math.max(sx, .001), 1, () => _ex_cover(w, h));
    else at(0, 0, 0, -sx, 1, () => _ex_declaration(w, h, wr));
  }
  function _ex_cover(w, h) {
    withShadow(8, () => { ctx.fillStyle = '#D24A0C'; rrect(0, -h / 2, w, h, 14); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, -h / 2, 12, h);
    ctx.strokeStyle = 'rgba(255,227,168,.85)'; ctx.lineWidth = 4; rrect(16, -h / 2 + 16, w - 32, h - 32, 10); ctx.stroke();
    text('PASSEPORT', w / 2, -h * .22, { font: font(FF.stencil, 48, 900), align: 'center', color: '#FFE3A8', ls: 4 });
    text('DE LA MARCHANDISE', w / 2, -h * .22 + 38, { font: font(FF.body, 22, 800), align: 'center', color: '#FFE3A8' });
    at(w / 2, h * .08, -.04, 1, 1, () => sack(84, 100, '', { lift: 4 }));
    ctx.fillStyle = C.ink; rrect(34, h * .28, w - 68, 62, 10); ctx.fill();
    text('EXPORT', w / 2, h * .28 + 47, { font: font(FF.stencil, 48, 900), align: 'center', color: '#FFE3A8', ls: 6 });
  }
  /** right page : a visa page (guilloche + faint grid), waiting for its stamp */
  function _ex_visaPage(w, h) {
    ctx.save(); rrect(0, -h / 2, w, h, 14); ctx.clip();
    ctx.strokeStyle = 'rgba(214,72,11,.13)'; ctx.lineWidth = 2;
    for (let r = 0; r < 13; r++) { ctx.beginPath(); for (let x = 10; x <= w - 6; x += 12) { const y = -h / 2 + 26 + r * 30 + Math.sin(x * .045 + r * .9) * 6; x === 10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
    ctx.strokeStyle = 'rgba(214,72,11,.22)'; ctx.setLineDash([8, 7]); rrect(22, -h / 2 + 52, w - 44, h - 76, 12); ctx.stroke(); ctx.setLineDash([]);
    text('CACHETS', w / 2, -h / 2 + 38, { font: font(FF.stencil, 26, 900), align: 'center', color: 'rgba(214,72,11,.55)', ls: 6 });
    ctx.restore();
  }
  /** left page (inside of the cover, drawn in [-w,0]) : the DÉCLARATION, rows written with the marker (wr 0..1) */
  function _ex_declaration(w, h, wr) {
    withShadow(4, () => { ctx.fillStyle = '#F7F2E4'; rrect(-w, -h / 2, w, h, 14); ctx.fill(); });
    at(-w / 2, 0, -.01, 1, 1, () => docSheet('declaration', w - 28, h - 28, { rows: [], lift: 2 }));
    const rows = [['Produit', 'Poivre'], ['Origine', 'Cameroun'], ['Régime', 'EXPORT']];
    rows.forEach(([lab, val], i) => {
      const y = -h / 2 + 14 + (h - 28) * .16 + 70 + i * 84, x = -w + 36;
      text(lab, x, y, { font: font(FF.body, 26, 700), color: C.inkSoft });
      ctx.strokeStyle = DC.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.lineTo(-38, y + 60); ctx.stroke();
      const k = clamp(wr * rows.length - i);
      if (k > 0) handText(val, x, y + 48, 44, { align: 'left', write: k, color: i === 2 ? '#B53D08' : C.ink, pen: k < 1 });
    });
  }
  /** yellow slip tucked behind the passport: extra export papers */
  function _ex_note(k1, k2) {
    const f = font(FF.hand, 44, 800), L = ["+ certificat d'origine", '+ phytosanitaire', '(selon le produit)'];
    const w = Math.max(...L.map(s => measure(s, f))) + 70, h = 212;
    withShadow(10, () => { ctx.fillStyle = '#FFE36E'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2 - 26); ctx.lineTo(w / 2 - 26, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 26); ctx.lineTo(w / 2 - 26, h / 2); ctx.lineTo(w / 2 - 22, h / 2 - 22); ctx.closePath(); ctx.fill();
    _ex_tape(-w / 2 + 40, -h / 2 + 2, -.45, 96);
    const x0 = -w / 2 + 34;
    handText(L[0], x0, -h / 2 + 64, 44, { align: 'left', write: k1, pen: k1 > 0 && k1 < 1, color: C.ink });
    handText(L[1], x0, -h / 2 + 124, 44, { align: 'left', write: clamp(k2 * 1.6), pen: k2 > 0 && k2 < .62, color: C.ink });
    handText(L[2], x0 + 34, -h / 2 + 182, 44, { align: 'left', write: clamp(k2 * 1.6 - .6), pen: false, color: '#8A5A12' });
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                                                // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.exportez, 7); addShake(T.land, 5); addShake(T.stamp, 15); addShake(T.swap + .02, 7); }
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); paperTable(n); ctx.restore();
    const ts = stepT(n), dr = drift(t, 60, 5), cam = 1 + .03 * prog(t, T.c0, T.c1);
    ctx.save();
    ctx.translate(540, 830); ctx.scale(cam, cam); ctx.rotate(dr.r); ctx.translate(-540, -830);

    // ------------------------------------------------ the Kribi print (background layer: drifts less = parallax)
    const kb = prog(t, T.c0, T.c1), pj = jit(601, n, .3);
    at(PHOTO.x - dr.x * .35 + pj.x, PHOTO.y - dr.y * .35 + pj.y, PHOTO.r + pj.r, 1, 1, () => {
      photoPrint('kribi_crane', PHOTO.w, PHOTO.h, { fx_kind: 'duo', cols: DUO_K, zoom: lerp(1.03, 1.1, kb), fx: lerp(.5, .47, kb), fy: .4, lift: 14, border: 16,
        develop: .35 + .65 * eOutCubic(prog(t, T.c0 - .1, T.c0 + .55)) });
      creditTag(CREDIT.kribi_crane, PHOTO.w / 2 - 10, -PHOTO.h / 2 + 42);
      // EXPORT route : out of the port, towards the open sea
      const ak = eOutCubic(prog(ts, T.exportez + .06, T.exportez + .5));
      if (ak > 0) { handArrow(ARROW, ak, 'rgba(255,248,232,.9)', 22); handArrow(ARROW, ak, C.orange, 11); }
      const sk = prog(ts, T.exportez + .1, T.exportez + 1.1);
      if (sk > 0 && sk < 1) { const pts = curve(ARROW, 12), i = Math.min(pts.length - 2, Math.floor(eInOutCubic(sk) * (pts.length - 1))), p = pts[i], q = pts[i + 1];
        const hop = Math.abs(Math.sin(sk * Math.PI * 5)) * 10;
        at(p[0], p[1] - 34 - hop, Math.atan2(q[1] - p[1], q[0] - p[0]) * .15, 1, 1, () => { ctx.globalAlpha *= clamp((1 - sk) * 6); sack(58, 70, '', { lift: 8 }); }); }
      const ck = clamp(pop(ts, T.exportez + .42, 15, .45), 0, 1.2);
      if (ck > 0) chip(ARROW[3][0] + 6, ARROW[3][1] - 62, 'EXPORT', { fill: C.orange, color: C.ink, size: 48, rot: -.06, s: ck });
    });

    // ------------------------------------------------ the extra-papers slip (tucked behind the passport)
    if (t >= T.sans - .12) {
      const e = eOutBack(prog(ts, T.sans - .12, T.sans + .16)), j = jit(602, n, .5), s1 = settle(t, T.sans + .16, 12, 34, .05);
      at(NOTE.x + dr.x * .6 + j.x, NOTE.y + dr.y * .6 + j.y + (1 - e) * 170, NOTE.r + j.r + (1 - clamp(e)) * .12, 1 + s1, 1 - s1, () =>
        _ex_note(prog(t, T.sans, T.sans + .3), prog(t, T.rien - .04, T.rien + .5)));
    }

    // ------------------------------------------------ the orange passport : drops, opens, gets the SORTIE stamp
    if (t >= T.land - .2) {
      const d = drop(ts, T.land - .2, 520, .2), j = jit(603, n, .45);
      const open = prog(ts, T.open, T.open + .3), wr = prog(t, T.open + .16, T.stamp + .05);
      const hit = settle(t, T.stamp, 11, 38, .04);
      at(PASS.x + dr.x * .7 + j.x, PASS.y + dr.y * .7 + j.y + d.y, -.025 + j.r, d.sx * (1 + hit), d.sy * (1 - hit), () => {
        _ex_passport(PASS.w, PASS.h, open, wr);
        if (t >= T.stamp - .1) { const sl = slam(t, T.stamp, 2.1);
          at(PASS.w * .5 + 4, 18, -.2, sl.s, sl.s, () => { roundStamp('SORTIE · EXPORT · SORTIE · EXPORT · ', 'SORTIE', 130, '#D6480B', { alpha: sl.a * .95, rot: .1 });
            _ex_burst(prog(t, T.stamp, T.stamp + .26), 140, '#D6480B', 11); }); }
      });
      if (d.landed && t < T.land + .3) { const k = prog(t, T.land, T.land + .3); ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (const s of [-1, 1]) { const x = PASS.x + PASS.w / 2 + s * (PASS.w / 2 + 16 + 30 * k); ctx.beginPath(); ctx.moveTo(x, PASS.y + PASS.h / 2 - 10); ctx.lineTo(x + s * 22, PASS.y + PASS.h / 2 - 4 - 16 * k); ctx.stroke(); } ctx.restore(); }
    }

    // ------------------------------------------------ Mireille + her pepper sack (foreground: drifts more)
    if (t >= T.rise) {
      const rk = clamp(spring(ts - T.rise, 11, .5), 0, 1.15), j = jit(604, n, .4);
      const mx = MIR.x + dr.x * 1.1 + j.x, my = MIR.y + dr.y * 1.1 + j.y + (1 - rk) * 560, s = MIR.s, br = Math.sin(t * 3.1) * .012;
      const face = t < T.exportez ? 'smile' : t < T.open ? 'grin' : t < T.wink ? 'smile' : 'wink';
      const look = t >= T.ca && t < T.swap ? -1 : t >= T.swap ? -.3 : .2;
      const thumb = t >= T.wink - .04, blink = face !== 'wink' && (n % 71) < 3;
      const HL = [165, 150], HR = thumb ? 'thumb' : [165, 150];
      const tilt = Math.sin(t * 1.7) * .03 + (thumb ? .05 : 0);
      at(mx, my, 0, s, s * (1 + br), () => mireille({ face, look, blink, tilt, arms: [HL, HR] }));
      // the sack (hugged), x-ray pass on « Ça »
      const xr = prog(ts, T.xr0, T.xr0 + .34), xa = 1 - prog(t, T.xr0 + .5, T.xr0 + .8);
      const sw = Math.sin(t * 2.3) * .02 + (thumb ? .06 : 0), sq = settle(t, T.rise + .2, 9, 30, .06);
      at(mx + SACK.dx, my + SACK.dy, sw, 1 + sq, 1 - sq, () => _ex_sack(SACK.w, SACK.h, xr, xa, n));
      // fists over the sack (drawn after it so she really holds it)
      ctx.fillStyle = SKIN[3];
      const fist = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 33 * s, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; ctx.stroke(); };
      fist(mx - HL[0] * s, my + HL[1] * s); if (!thumb) fist(mx + HL[0] * s, my + HL[1] * s);
      if (thumb) { const gk = prog(t, T.wink, T.wink + .45); if (gk > 0 && gk < 1) at(mx + 190, my - 40, 0, 1, 1, () => _ex_burst(gk, 34, C.amber, 8)); }
    }
    ctx.restore();                                                                        // end camera

    // ------------------------------------------------ header : « VOUS EXPORTEZ ? » → torn away → « MÊME SANS RIEN À PAYER »
    const d2 = drift(t, 61, 3);
    if (t >= T.exportez - .1) {
      const rip = eInCubic(prog(ts, T.swap - .06, T.swap + .16));
      if (rip < 1) { const sl = slam(t, T.exportez, 1.8);
        at(540 + d2.x - rip * 700, HEAD_Y + d2.y - rip * 260, -.03 - rip * .7, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('VOUS EXPORTEZ ?', { size: 84, fill: C.orange, color: C.ink, seed: 6 }); }); }
    }
    if (t >= T.swap - .06) { const sl = slam(t, T.swap + .04, 1.9);
      at(540 + d2.x, HEAD_Y + 4 + d2.y, .02, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip('MÊME SANS RIEN À PAYER', { size: 66, fill: DC.green, color: '#FFF6E6', seed: 9 }); }); }

    // light leak on the cut to the photo
    ctx.save(); ctx.globalAlpha = .8; lightLeak(prog(t, T.c0 - .1, T.c0 + .85), 17); ctx.restore();
  }

  registerScene({ id: 'export', z: 60, when: t => TL.in(t, CH, .4, .4), draw });
})();

'use strict';
// =============================================================================================
// 65_bonzini — chapitre « bonzini » (S13, S14)
// S13 « Chez Bonzini, on veut que vous réussissiez. Bientôt dans l'application : vos frais de douane estimés
//       en quelques questions. »
//  · coupe (sous le volet « ruban Bonzini ») : Junior (importateur, violet) et Mireille (exportatrice, wax) côte à côte.
//  · « Chez »       : petit saut (écrasement/étirement en deux), des cœurs papier montent entre eux.
//  · « Bonzini »    : le logo s'assemble (ailes violettes, U ambre, n orange qui volent en place).
//  · « on veut… »   : bande papier écrite au feutre « On veut que vous / réussissiez ! ».
//  · « réussissiez » : TOPE-LÀ (les deux mains claquent), confettis, grand cœur, light leak doux.
//  · « Bientôt »    : la caméra glisse sur la table : tout monte, le téléphone papier arrive ; pastille « BIENTÔT · APERÇU ».
//  · « application » : écran d'accueil (vraie capture) ; bandeau opaque « Estimation indicative : le montant final est
//                     fixé par la douane » (les sous-titres descendent un peu pendant ce plan).
//  · « frais / douane » : recherche « mèches » + doigt qui tape la suggestion ; « estimés » : fiche produit ;
//    « quelques » : formulaire rempli (défile) ; « questions » : résultat (La valeur taxée → Sur la déclaration (DAU),
//                     surlignés ligne par ligne ; défilement court : les lignes de taux n'entrent jamais dans l'écran).
// S14 « D'abord au Cameroun, puis ailleurs en Afrique. »
//  · « D'abord »    : le téléphone rétrécit et se plante comme une épingle sur une petite carte papier (Yaoundé).
//  · « Cameroun »   : le pays s'allume en vert (onde), pastille « 1 », bande « D'ABORD LE CAMEROUN ».
//  · « puis ailleurs » : anneaux papier concentriques qui s'élargissent sur les pays voisins (jamais nommés) qui se
//                     colorent tour à tour ; puce « PUIS AILLEURS EN AFRIQUE… ».
// Captures autorisées ici SEULEMENT : app_home, app_m_sugg, app_m_product, app_sim_05_filled, app_m_result.
// Aucun tarif, frais ou délai Bonzini. La scène possède l'image de TL.ch('bonzini').start à .end (coupe sous les volets).
// =============================================================================================
(() => {
  const CH = 'bonzini';
  const JUN = { x: 372, y: 1128, s: .78 }, MIB = { x: 708, y: 1128, s: .78 };
  const LOGO = { x: 540, y: 404, size: 340 };
  const BAND = { x: 540, y: 708, r: -.025, w: 690, h: 196 };
  const PH = { x: 548, y: 770, w: 540, h: 1006, r: -.03 };             // phone screen (frame adds bezel)
  const PH_SC = PH.w / 1170;                                             // screenshot px → screen px
  const DISC_Y = 1212;
  const MAPC = { x: 150, y: 374, w: 780, h: 756 };                     // paper map card
  const MS = 44, MOX = 546, MOY = 792;                                 // map: px per degree + geo origin on screen
  const SHOTS = ['app_home', 'app_m_sugg', 'app_m_product', 'app_sim_05_filled', 'app_m_result'];
  const PAN = 1500;
  let T = null, reg = false, NB = null;

  function times() {
    const c = TL.ch(CH), a = k => TL.wt('S13', k), b = k => TL.wt('S14', k);
    const o = { c0: c.start, c1: c.end };
    let prev = -1e9; const put = (k, v) => { v = Math.max(v, prev + .08); o[k] = v; prev = v; };
    for (const k of ['chez', 'bonzini', 'on', 'veut', 'reussi', 'bientot', 'application', 'frais', 'douane', 'estimes', 'quelques', 'questions']) put(k, a(k));
    for (const k of ['dabord', 'cameroun', 'puis', 'ailleurs', 'afrique']) put(k, b(k));
    o.pan0 = Math.max(o.reussi + .32, o.bientot - .22); o.pan1 = o.pan0 + .42;
    o.stampB = o.pan1 + .06;
    o.disc = Math.max(o.application, o.pan1 + .1);
    o.scr = [-1e9, o.frais - .06, o.estimes - .05, Math.max(o.quelques - .1, o.estimes + .3), 0];
    o.scr[4] = Math.max(o.questions + .26, o.scr[3] + .4);
    o.tap = o.douane - .02;
    o.shrink0 = Math.max(o.dabord - .06, o.scr[4] + .35); o.shrink1 = o.shrink0 + .5;
    o.map = o.shrink0 - .06;
    o.lit = Math.max(o.cameroun, o.shrink1 + .05);
    o.rings = [o.puis + .02, o.ailleurs, Math.min(o.ailleurs + .32, o.c1 - .4)];
    return o;
  }

  // ---------------------------------------------------------------------------- helpers (file-local)
  const settle = (t, t0, f = 10, w = 36, a = .07) => t > t0 ? Math.exp(-(t - t0) * f) * Math.cos((t - t0) * w) * a : 0;
  const lerpA = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
  function _bz_tape(x, y, r, w = 104) { at(x, y, r, 1, 1, () => { ctx.fillStyle = C.tape; ctx.fillRect(-w / 2, -17, w, 34); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-w / 2, -13, w, 5); }); }
  function _bz_burst(k, r0, col, count = 12, lw = 9) {
    if (k <= 0 || k >= 1) return; ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineWidth = lw * (1 - k) + 1;
    for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + .2, ra = r0 + 50 * k, rb = ra + 56 * (1 - k) + 10;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * ra, Math.sin(a) * ra); ctx.lineTo(Math.cos(a) * rb, Math.sin(a) * rb); ctx.stroke(); }
    ctx.restore();
  }
  function _bz_torn(w, h, seed, fill) {
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, seed, 3.5, 12), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, seed + 4, 3.5, 12);
    withShadow(10, () => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); });
  }
  /** balanced 2-line split of a sentence for a given font */
  function _bz_split(str, f) {
    const ws = str.split(' '); let best = null;
    for (let k = 1; k < ws.length; k++) { const a = ws.slice(0, k).join(' '), b = ws.slice(k).join(' '), m = Math.max(measure(a, f), measure(b, f)); if (!best || m < best.m) best = { m, a, b }; }
    return best;
  }
  function _bz_hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function _bz_mix(a, b, k) { const p = _bz_hex(a), q = _bz_hex(b); return `rgb(${Math.round(lerp(p[0], q[0], k))},${Math.round(lerp(p[1], q[1], k))},${Math.round(lerp(p[2], q[2], k))})`; }

  // ---------------------------------------------------------------------------- beat A : the duo, the logo, the promise
  function hearts(t) {
    const h0 = Math.min(T.chez, T.c0 + .08); if (t < h0) return;
    for (let i = 0; i < 26; i++) {
      const t0 = h0 + i * .15, k = (t - t0) / 1.6; if (k <= 0 || k >= 1) continue;
      const side = i % 2 ? 1 : -1, x = 540 + side * (40 + rnd(i * 3.1) * 140) + Math.sin(k * 6 + i) * 26, y = 1010 - 640 * eOutCubic(k);
      const s = (34 + rnd(i * 5.3) * 34) * (k < .12 ? eOutBack(k / .12) : 1), a = k > .7 ? (1 - k) / .3 : 1;
      at(x, y, Math.sin(k * 5 + i) * .25, 1, 1, () => { ctx.globalAlpha *= a; withShadow(6, () => iconHeart(s, [C.orange, C.violet, C.amber, '#E8475F'][i % 4])); });
    }
  }
  function logo(t, n) {
    if (t < T.bonzini - .06) return;
    const FROM = { wingTop: [-430, -170, -.9], wingBot: [-430, 190, .9], amber: [30, -420, .6], orange: [440, 80, -.7] }, off = {};
    Object.entries(FROM).forEach(([role, f], i) => { const sp = clamp(spring(stepT(n) - (T.bonzini - .06 + i * .05), 13, .5), 0, 1.2);
      off[role] = [f[0] * (1 - sp), f[1] * (1 - sp), f[2] * (1 - sp), clamp(sp * 4)]; });
    const br = 1 + .015 * Math.sin(t * 3.4), j = jit(651, n, .4);
    at(j.x, j.y, j.r, 1, 1, () => withShadow(14, () => drawLogo(LOGO.x, LOGO.y, LOGO.size * br, { offsets: off })));
  }
  function band(t, n) {
    if (t < T.on - .14) return;
    const e = eOutBack(prog(stepT(n), T.on - .14, T.on + .1)), j = jit(652, n, .5), hit = settle(t, T.on + .1, 12, 34, .05);
    at(BAND.x + j.x, BAND.y + j.y + (1 - e) * -120, BAND.r + j.r + (1 - clamp(e)) * -.1, 1 + hit, 1 - hit, () => {
      ctx.globalAlpha *= clamp(e * 2);
      _bz_torn(BAND.w, BAND.h, 41, C.cream);
      _bz_tape(-BAND.w / 2 + 30, -BAND.h / 2 + 4, -.5); _bz_tape(BAND.w / 2 - 30, -BAND.h / 2 + 4, .5);
      const w1 = prog(t, T.on, T.reussi - .04), w2 = prog(t, T.reussi, T.reussi + .42);
      handText('On veut que vous', 0, -14, 64, { write: w1, color: C.ink, pen: w1 > 0 && w1 < 1 });
      const r2 = handText('réussissiez !', 0, 66, 68, { write: w2, color: C.violetD, pen: false });
      const u = prog(t, T.reussi + .36, T.reussi + .6);
      if (u > 0) { ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath();
        const x0 = r2.x0 - 6, x1 = x0 + (r2.wd + 12) * u; ctx.moveTo(x0, 84); ctx.quadraticCurveTo((x0 + x1) / 2, 98, x1, 82); ctx.stroke(); ctx.restore(); }
    });
  }
  function duo(t, n) {
    const ts = stepT(n), up = prog(ts, T.reussi - .16, T.reussi), after = t >= T.reussi;
    const hopK = t >= T.chez ? (t - T.chez) : -1, hop = hopK >= 0 && hopK < .36 ? Math.sin(hopK / .36 * Math.PI) : 0;
    const clapHop = after && t - T.reussi < .4 ? Math.sin((t - T.reussi) / .4 * Math.PI) : 0;
    const face = t < T.chez ? 'smile' : 'grin';
    const lk = t >= T.veut && t < T.reussi ? 1 : 0;
    const wig = after ? Math.sin(t * 16) * 10 * Math.exp(-(t - T.reussi) * 2) : 0;
    const P = (who, side, blinkOff, sx, fn) => {
      const pp = who, j = jit(653 + side, n, .4), y = pp.y + j.y - (hop * 46 + clapHop * 30) * (side < 0 ? 1 : .9);
      const sq = hop > 0 ? 1 + .06 * Math.sin(hopK / .36 * Math.PI * 2) : 1, br = 1 + .01 * Math.sin(t * 3 + side);
      const raise = [lerp(158, 215, up), lerp(262, -230, up) + wig * side];
      at(pp.x + j.x, y, j.r + (side < 0 ? .02 : -.02) * lk, pp.s / sq, pp.s * sq * br, () =>
        fn({ face, look: lk * (side < 0 ? 1 : -1), blink: (n + blinkOff) % 83 < 3, tilt: Math.sin(t * 1.6 + side) * .025 + lk * .06 * (side < 0 ? 1 : -1),
          arms: side < 0 ? ['idle', raise] : [raise, 'idle'] }));
    };
    P(JUN, -1, 0, 1, junior);
    P(MIB, 1, 40, 1, mireille);
    if (after) {                                                                            // TOPE-LÀ !
      const s = t - T.reussi;
      at(540, 944, 0, 1, 1, () => { _bz_burst(prog(t, T.reussi, T.reussi + .3), 44, C.ink, 12, 8); confetti(s, 46, 7); });
      const hk = clamp(pop(t, T.reussi + .04, 13, .45), 0, 1.25) * (1 - .35 * prog(t, T.reussi + .45, T.reussi + .9)), hy = 930 - 60 * eOutCubic(prog(t, T.reussi, T.reussi + .8));
      if (hk > 0) at(540, hy, Math.sin(t * 6) * .08, hk, hk, () => withShadow(12, () => iconHeart(112, '#E8475F')));
    }
  }

  // ---------------------------------------------------------------------------- beat B : the paper phone + real screenshots
  function shot(i, x, y, w, h, t) {
    const name = SHOTS[i]; let sc = 0;
    if (name === 'app_sim_05_filled') sc = 330 * eInOutCubic(prog(t, T.scr[3] + .2, T.scr[3] + .7));
    if (name === 'app_m_result') sc = 60 * eInOutCubic(prog(t, T.scr[4] + .1, T.scr[4] + .9));
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    screenShot(name, x, y, w, h, sc);
    if (name === 'app_m_result') {                                                          // computed customs value: blurred like the source's amounts
      ctx.save(); ctx.beginPath(); ctx.rect(x + 664 * PH_SC, y + (1100 - sc) * PH_SC, 440 * PH_SC, 400 * PH_SC); ctx.clip();
      ctx.filter = 'blur(4px)'; screenShot(name, x, y, w, h, sc); ctx.filter = 'none';
      ctx.fillStyle = 'rgba(240,240,244,.35)'; ctx.fillRect(x + 664 * PH_SC, y + (1100 - sc) * PH_SC, 440 * PH_SC, 400 * PH_SC); ctx.restore();
    }
    if (name === 'app_m_result') {                                                          // highlighter, line by line
      const hl = [[1018, 1080, 430], [1644, 1706, 670]];
      hl.forEach(([y0, y1, x1], j) => { const k = eOutCubic(prog(t, T.scr[4] + .12 + j * .3, T.scr[4] + .3 + j * .3)); if (k <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = j ? 'rgba(254,86,13,.35)' : 'rgba(169,71,254,.32)';
        ctx.fillRect(x + 86 * PH_SC, y + (y0 - sc) * PH_SC, (x1 - 86) * PH_SC * k, (y1 - y0) * PH_SC); ctx.restore(); });
    }
  }
  function screen(x, y, w, h, t) {
    let i = 0; for (let j = 1; j < T.scr.length; j++) if (t >= T.scr[j]) i = j;
    const k = i > 0 ? eOutCubic(prog(t, T.scr[i], T.scr[i] + .2)) : 1;
    if (k < 1) { shot(i - 1, x - w * .3 * k, y, w, h, t); ctx.fillStyle = `rgba(35,22,41,${.25 * k})`; ctx.fillRect(x, y, w, h); }
    const nx = x + w * (1 - k);
    if (k < 1) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 24; ctx.shadowOffsetX = -8; ctx.fillStyle = '#fff'; ctx.fillRect(nx, y, w, h); ctx.restore(); }
    shot(i, nx, y, w, h, t);
  }
  function sticker(t, n) {                                                                  // round paper sticker, orange stamp « BIENTÔT »
    if (t < T.stampB - .1) return;
    const sl = slam(t, T.stampB, 2.2), j = jit(655, n, .4);
    at(PH.w / 2 + 50 + j.x, -PH.h / 2 - 8 + j.y, .18, sl.s, sl.s, () => {
      ctx.globalAlpha *= sl.a;
      withShadow(14, () => { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(0, 0, 146, 0, 7); ctx.fill(); });
      _bz_tape(-30, -150, -.2, 120);
      roundStamp('APERÇU · APERÇU · APERÇU · ', 'BIENTÔT', 132, '#E0500E', { rot: -.05 });
      _bz_burst(prog(t, T.stampB, T.stampB + .26), 150, '#E0500E', 12, 8);
    });
  }
  function finger(t) {
    if (t < T.frais - .04 || t > T.estimes + .3) return;
    const x = -PH.w / 2 + 560 * PH_SC, y = -PH.h / 2 + 960 * PH_SC;
    const inK = eOutCubic(prog(t, T.frais - .04, T.frais + .2)), outK = eInCubic(prog(t, T.estimes + .02, T.estimes + .3));
    const dx = (1 - inK + outK) * 190, dy = (1 - inK + outK) * 330;
    fingerTap(x + dx, y + dy, prog(t, T.tap - .08, T.tap + .26), { skin: SKIN[1], sleeve: C.violet });
  }
  function phone(t, n, cx, cy, sc, rot, sticky = true) {
    at(cx, cy, rot, sc, sc, () => {
      phoneFrame(PH.w, PH.h, (x, y, w, h) => screen(x, y, w, h, t), { lift: 18 });
      finger(t);
      if (sticky) sticker(t, n);
    });
  }
  function disclaimer(t, n) {
    if (t < T.disc - .1 || t > T.shrink0 + .45) return;
    const f = font(FF.body, 44, 700), sp = _bz_split('Estimation indicative : le montant final est fixé par la douane', f);
    const w = sp.m + 120, h = 150, j = jit(656, n, .4);
    const inK = eOutBack(prog(stepT(n), T.disc - .1, T.disc + .14)), outK = eInCubic(prog(t, T.shrink0 + .12, T.shrink0 + .4));
    at(540 + j.x, DISC_Y + j.y + (1 - clamp(inK)) * 240 + outK * 420, -.012 + j.r, 1, 1, () => {
      _bz_torn(w, h, 57, '#FFFDF7');
      _bz_tape(-w / 2 + 24, -h / 2 + 2, -.5, 90); _bz_tape(w / 2 - 24, -h / 2 + 2, .5, 90);
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(-w / 2 + 30, -26, 10, 0, 7); ctx.fill();
      text(sp.a, 0, -12, { font: f, align: 'center', color: C.ink });
      text(sp.b, 0, 46, { font: f, align: 'center', color: C.inkSoft });
    });
  }

  // ---------------------------------------------------------------------------- beat C : the map
  const geoXY = (p) => [MOX + p[0] * MS, MOY + p[1] * MS];
  function neighbours() {                                                                   // visible centroid of each neighbour inside the card
    if (NB) return NB; const g = geo(); NB = [];
    if (!g) return NB;
    const inCard = ([x, y]) => x > MAPC.x + 40 && x < MAPC.x + MAPC.w - 40 && y > MAPC.y + 40 && y < MAPC.y + MAPC.h - 40;
    ['NGA', 'TCD', 'CAF', 'COG', 'GAB', 'GNQ'].forEach((k, i) => { if (!g[k]) return; let sx = 0, sy = 0, c = 0;
      for (const r of g[k].rings) for (const p of r) { const q = geoXY(p); if (inCard(q)) { sx += q[0]; sy += q[1]; c++; } }
      if (c) NB.push({ k, x: sx / c, y: sy / c, i }); });
    return NB;
  }
  const CEN = [546, 748];
  function ringR(t, t0) { return 60 + 1050 * eOutCubic(prog(t, t0, t0 + 1.3)); }
  function mapCard(t, n) {
    const g = geo(); if (!g) return;
    const { x, y, w, h } = MAPC;
    withShadow(16, () => { ctx.fillStyle = '#FBF7EE'; rrect(x, y, w, h, 12); ctx.fill(); });
    ctx.save(); rrect(x + 16, y + 16, w - 32, h - 32, 6); ctx.clip();
    ctx.fillStyle = '#CFE0EC'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(11,95,165,.15)'; ctx.lineWidth = 3; const ph = stepT(n) * .9;
    for (let i = 0; i < 11; i++) { const yy = y + 50 + i * 72; ctx.beginPath(); for (let xx = x; xx <= x + w; xx += 16) { const v = yy + Math.sin(xx * .022 + i * 1.7 + ph) * 5; xx === x ? ctx.moveTo(xx, v) : ctx.lineTo(xx, v); } ctx.stroke(); }
    // land that is neither Cameroon nor a drawn neighbour (north & east), so only the Gulf stays blue
    ctx.fillStyle = '#EADBC2'; ctx.beginPath(); [[-15, -20], [20, -20], [20, 20], [-2.3, 20], [-2.3, 1.2], [-9, -.3], [-15, -.3]].forEach((p, i) => { const q = geoXY(p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.fill();
    const path = rings => { ctx.beginPath(); for (const r of rings) { r.forEach((p, i) => { const q = geoXY(p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); } };
    const tints = ['#FFD2BC', '#E6D2FF', '#FCE0B4'];
    for (const nb of neighbours()) {
      const k = g[nb.k]; path(k.rings); ctx.fillStyle = '#EADBC2'; ctx.fill();
      const d = Math.hypot(nb.x - CEN[0], nb.y - CEN[1]), tk = Math.max(0, ...T.rings.map(r0 => clamp((ringR(t, r0) - d) / 140)));
      if (tk > 0) { ctx.save(); ctx.globalAlpha *= tk; ctx.fillStyle = tints[nb.i % 3]; ctx.fill(); ctx.restore(); }
      ctx.strokeStyle = 'rgba(120,90,60,.35)'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Cameroon lights up on « Cameroun »
    const lit = eOutCubic(prog(t, T.lit - .04, T.lit + .3)), pulse = t > T.lit ? .5 + .5 * Math.sin((t - T.lit) * 5) : 0;
    path(g.CMR.rings);
    ctx.save(); ctx.shadowColor = `rgba(31,168,106,${.55 * lit})`; ctx.shadowBlur = 30 * lit; ctx.fillStyle = _bz_mix('#CFE6DA', '#3FC08A', lit); ctx.fill(); ctx.restore();
    ctx.strokeStyle = DC.green; ctx.lineWidth = 4 + 3 * lit + 2 * pulse * lit; ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(35,22,41,.14)'; ctx.lineWidth = 2; rrect(x + 16, y + 16, w - 32, h - 32, 6); ctx.stroke();
    // light-up wave: the outline echoes outward
    const wv = prog(t, T.lit, T.lit + .6);
    if (wv > 0 && wv < 1) { ctx.save(); ctx.globalAlpha = 1 - wv; ctx.translate(CEN[0], CEN[1]); ctx.scale(1 + .25 * wv, 1 + .25 * wv); ctx.translate(-CEN[0], -CEN[1]);
      path(g.CMR.rings); ctx.strokeStyle = '#1FA86A'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore(); }
  }
  function rings(t, n) {
    T.rings.forEach((t0, i) => { if (t < t0) return; const r = ringR(t, t0), a = 1 - prog(t, t0 + .5, t0 + 1.3); if (a <= 0) return;
      const col = [C.orange, C.violet, C.amber][i % 3];
      ctx.save(); ctx.globalAlpha *= a;
      ctx.strokeStyle = 'rgba(60,32,12,.16)'; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(CEN[0] + 6, CEN[1] + 9, r, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#FFFDF7'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(CEN[0], CEN[1], r, 0, 7); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([22, 14]); ctx.lineDashOffset = -stepT(n) * 60; ctx.beginPath(); ctx.arc(CEN[0], CEN[1], r, 0, 7); ctx.stroke();
      ctx.restore(); });
    for (const nb of neighbours()) {                                                        // « bientôt ici » markers on each neighbour
      const d = Math.hypot(nb.x - CEN[0], nb.y - CEN[1]), tr = T.rings.map(r0 => r0 + Math.max(0, d - 60) / 1050 * .45).find(x => t >= x);
      if (tr == null) continue; const k = clamp(pop(t, tr, 14, .45), 0, 1.25), b = 1 + .08 * Math.sin(t * 5 + nb.i);
      at(nb.x, nb.y, 0, k * b, k * b, () => { ctx.save(); ctx.fillStyle = 'rgba(255,253,247,.9)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.fill();
        ctx.strokeStyle = [C.orange, C.violetD, '#C77A12'][nb.i % 3]; ctx.lineWidth = 5; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.restore(); });
    }
  }
  function land(t, t0, dur = .24, from = 1.35) {
    if (t < t0) return null; const k = (t - t0) / dur;
    if (k < 1) { const e = k * k; return { s: lerp(from, 1, e), sq: 0, a: clamp(k * 5) }; }
    const s = t - t0 - dur; return { s: 1, sq: Math.exp(-s * 10) * Math.cos(s * 36) * .06, a: 1 };
  }

  // ---------------------------------------------------------------------------- draw
  function draw(t, n) {
    if (!T) T = times();
    if (t < T.c0 || t >= T.c1) return;                                                      // hard cut under the wipes
    if (!reg) { reg = true; addShake(T.reussi, 6); addShake(T.pan1, 5); addShake(T.stampB, 13); addShake(T.shrink1, 4); addShake(T.lit, 6);
      captionY((tt, p) => T && tt >= T.disc - .1 && tt < T.shrink0 + .36 ? 1402 : null); }
    const sh = shake(t, n); ctx.translate(sh.x, sh.y);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); paperTable(n); ctx.restore();
    const ts = stepT(n), dr = drift(t, 65, 5);
    const pe = eInOutCubic(prog(ts, T.pan0, T.pan1)), pan = PAN * pe, land1 = settle(t, T.pan1, 9, 30, .5) * 18;

    // ------------------------------------------------ beat A (slides up and away on « Bientôt »)
    if (pe < 1) {
      ctx.save(); ctx.translate(dr.x, dr.y);
      at(0, -pan * 1.12, 0, 1, 1, () => hearts(t));
      at(0, -pan * 1.2, 0, 1, 1, () => logo(t, n));
      at(0, -pan * 1.1, 0, 1, 1, () => band(t, n));
      at(0, -pan, 0, 1, 1, () => duo(t, n));
      ctx.restore();
      ctx.save(); ctx.globalAlpha = .55; lightLeak(prog(t, T.reussi - .1, T.reussi + .9), 29); ctx.restore();
    }

    // ------------------------------------------------ beat C : the map (lands under the shrinking phone)
    const ml = land(ts, T.map);
    if (ml) { const d2 = drift(t, 66, 4);
      at(540 + d2.x, 752 + d2.y, d2.r, ml.s * (1 + ml.sq), ml.s * (1 - ml.sq), () => { ctx.globalAlpha *= ml.a; ctx.translate(-540, -752); mapCard(t, n); rings(t, n); }); }

    // ------------------------------------------------ the phone : rises with the pan, then shrinks into a pin on Cameroon
    if (pe > 0) {
      const sk = eInOutCubic(prog(ts, T.shrink0, T.shrink1));
      const pin = geoXY(geo() && geo()._cities['Yaoundé'] ? geo()._cities['Yaoundé'] : [-.975, 2.13]);
      const small = .13, tgt = [pin[0], pin[1] - (PH.h / 2 + 53) * small - 8];
      const d3 = drift(t, 67, 5 * (1 - sk));
      const bob = sk >= 1 ? Math.sin((t - T.shrink1) * 4.2) * 5 : 0, lsq = settle(t, T.shrink1, 11, 34, .12);
      const p = lerpA([PH.x + d3.x, PH.y + d3.y + PAN * (1 - pe) + land1], tgt, sk);
      const cy = p[1] - Math.sin(sk * Math.PI) * 140 + bob;
      const sc = lerp(1, small, sk), rot = lerp(PH.r + Math.sin(t * 1.1) * .008 + d3.r, .08, sk);
      if (sk > .5) { ctx.save(); ctx.globalAlpha = clamp((sk - .5) * 2) * .35; ctx.fillStyle = '#3C200C'; ctx.beginPath(); ctx.ellipse(pin[0] + 4, pin[1] + 3, 26 - bob, 8, 0, 0, 7); ctx.fill(); ctx.restore(); }
      at(p[0], cy, 0, 1 + lsq, 1 - lsq, () => phone(t, n, 0, 0, sc, rot));
      // pastille « 1 » on « Cameroun »
      const bk = clamp(pop(t, T.lit + .06, 14, .45), 0, 1.25);
      if (bk > 0) at(p[0] + 58, cy - 72, -.08, bk, bk, () => { withShadow(8, () => { ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill(); });
        ctx.strokeStyle = '#FFFDF7'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 33, 0, 7); ctx.stroke();
        text('1', 0, 20, { font: font(FF.brand, 56, 900), align: 'center', color: '#FFFDF7' }); });
    }
    disclaimer(t, n);

    // ------------------------------------------------ S14 headlines
    const d4 = drift(t, 68, 3);
    if (t >= T.lit - .1) { const sl = slam(t, T.lit, 1.9);
      at(540 + d4.x, 330 + d4.y, -.02, sl.s, sl.s, () => { ctx.globalAlpha *= sl.a; strip("D'ABORD LE CAMEROUN", { size: 74, fill: DC.green, color: '#FFF6E6', seed: 12 }); }); }
    if (t >= T.puis - .06) { const ck = clamp(pop(ts, T.puis - .06, 14, .45), 0, 1.2), j = jit(657, n, .5);
      chip(540 + j.x + d4.x, 1178 + j.y, 'PUIS AILLEURS EN AFRIQUE…', { fill: C.violetD, color: '#FFFFFF', size: 48, rot: .015, s: ck }); }
  }

  registerScene({ id: 'bonzini', z: 65, when: t => TL.in(t, CH, .4, .4), draw });
})();

// =============================================================================================================
// P9 – P11 · MARDI (S10 – S13) — « ② LA CONFORMITÉ »
//   P9  BG3 étal de mèches (flouté : profondeur de champ), lumière du matin, comptoir de Christelle au premier plan :
//       Tantine Mireille entre par la gauche en marchant (M5, profil) la proforma à la main, se pose en M2 ; Christelle C1 ;
//       poussée sur la proforma : tampon « PLUS DE 2 M F FOB », bandeau FOB, note au pinceau ; recul, Boris (B5, marche)
//       traverse le fond avec son carton, puis les deux vignettes LA VALEUR · LA QUALITÉ.
//   P10 BG5 comptoir en plongée : appel vidéo du fournisseur (téléphone de Christelle) ; la main de Mireille trace la
//       frise « CHAQUE PAPIER A SON MOMENT » en trois zones ; le passeport vert reçoit « AVANT LE DÉPART ✓ » en fin de
//       zone ; travelling gauche → droite jusqu'au petit bateau de ⑤.
//   P11 BG5 plus serré : la carte d'avertissement tombe (25 %), Boris B3 en incrustation ; puis les ciseaux s'approchent
//       de la proforma, tampon rouge « INTERDIT », Mireille M1 hoche la tête en incrustation.
// Everything is wrapped in an IIFE (all scene files share one global scope). Times come from the voice timeline only.
// =============================================================================================================
(() => {
  'use strict';
  // ---------- cast, light, palette ----------------------------------------------------------------------------------
  const K = (who, n) => `cast/${who}_${n}`, has = k => !!img(k);
  const PHC = 0, PHM = 3.3, PHB = 5.7, PHF = 1.7;                   // breathing phases: Christelle, Mireille, Boris, supplier
  const HM = 644, HB = 672, GY = 1716;                                // P11 insets: heights and feet line on BG3 (P9 uses U9/FY9 below)
  const MORNING = { mul: '#F5EDDF', tint: '#FFD089', tintA: .07, rim: '#FFE4A6', rimA: .34, rimSide: 'left' };
  const VIO = '#6A22C9', RUST = '#8A3A12', ZG = '#2E7D4F', ZA = '#C26A12', ZB = '#1F5FA0';
  const CSLEEVE = { sleeve: '#2E8B57', dots: 'rgba(250,200,60,.9)' };   // Christelle's hand (same as Monday)

  // ---------- small helpers ---------------------------------------------------------------------------------------
  const WR = (txt, x, y, t, t0, dur, o) => (t0 == null ? 0 : writeOn(txt, x, y, t, t0, dur, o));
  function fitSize(txt, fam, size, maxW, min = 10) { let s = size; while (s > min && measure(txt, font(fam, s, 400)) > maxW) s -= .5; return s; }
  function arrowInk(x0, y0, x1, y1, o = {}) {
    inkLine(x0, y0, x1, y1, o); const a = Math.atan2(y1 - y0, x1 - x0), L = o.head || 14;
    inkLine(x1, y1, x1 - Math.cos(a - .5) * L, y1 - Math.sin(a - .5) * L, o); inkLine(x1, y1, x1 - Math.cos(a + .5) * L, y1 - Math.sin(a + .5) * L, o);
  }
  /** a polyline cut at fraction k of its length */
  function partial(P, k) {
    const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const lim = L[L.length - 1] * clamp(k), out = [P[0]];
    for (let i = 1; i < P.length; i++) { if (L[i] <= lim) out.push(P[i]); else { const u = (lim - L[i - 1]) / (L[i] - L[i - 1] || 1); out.push([lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u)]); break; } }
    return out;
  }
  /** hand-inked check mark (✓), drawn progressively */
  function checkInk(x, y, s, t, t0, dur = .28, color = ZG) {
    if (t0 == null || t < t0) return; const P = partial([[x - s * .5, y - s * .02], [x - s * .14, y + s * .36], [x + s * .58, y - s * .56]], (t - t0) / dur);
    if (P.length > 1) inkPath(P, { w: s * .17, color, seed: 7, wob: 1 });
  }
  /** circled step number (① … ⑤), inked: pops at t0 */
  function badge(nr, x, y, r, t, t0, color = BD.ink) {
    if (t0 == null || t < t0) return; const k = clamp(spring(t - t0, 18, .5), 0, 1.15);
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    inkCircle(0, 0, r, { w: r * .13, fill: color, seed: 30 + nr });
    text(String(nr), 0, r * .4, { font: font(FF.bd, r * 1.2, 400), align: 'center', color: '#FFF6E2' });
    ctx.restore();
  }
  /** cream-haloed Bangers line: legible over anything */
  function haloText(s, x, y, size, color, o = {}) {
    ctx.save(); ctx.font = font(o.fam || FF.bd, size, 400); ctx.letterSpacing = (o.ls ?? 1) + 'px'; ctx.textAlign = o.align || 'center'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.halo || 'rgba(255,244,222,.92)'; ctx.lineWidth = size * .22; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
  }
  /** pose change: the new pose is drawn, the old one on top fading out */
  function pupSwitch(a, b, ts, x, y, h, o, fade = .18) {
    const t = o.t; if (t < ts) { drawPuppet(a, x, y, h, o); return; }
    drawPuppet(b, x, y, h, o);
    const k = clamp((t - ts) / fade); if (k < 1) drawPuppet(a, x, y, h, Object.assign({}, o, { a: (o.a ?? 1) * (1 - k), shadow: false }));
  }
  // --- the procedural pose drawPuppet applies (same formulas), so that a prop can follow a hand / a balloon a mouth ---
  function pupRot(R, o) {
    const t = o.t ?? 0, ph = o.phase ?? 0, talk = o.talk || 0, E = o.energy ?? 1, beat = talk ? Math.sin(t * 5.1 + ph) : 0;
    const rot = Object.assign({}, o.rot || {});
    rot.chest = (rot.chest || 0) + Math.sin(t * 1.9 + ph) * .018 * E + Math.sin(t * .7 + ph) * .02 * E + (o.lean || 0) + beat * .025 * talk * E;
    rot.hips = (rot.hips || 0) + Math.sin(t * .7 + ph + 1) * .008 * E;
    rot.head = (rot.head || 0) + Math.sin(t * 1.1 + ph * 2) * .04 * E + (talk ? (Math.sin(t * 6.3 + ph) * .06 + Math.sin(t * 2.7) * .04) * talk * E : 0);
    if (R.gesture) for (const [bn, amp, fr] of R.gesture) rot[bn] = (rot[bn] || 0) + (Math.sin(t * fr + ph) * .6 + Math.sin(t * fr * 1.9 + ph) * .4) * amp * (talk ? 2.2 : .6) * E;
    return rot;
  }
  function pupLift(o) {
    const t = o.t ?? 0, ph = o.phase ?? 0, talk = o.talk || 0, E = o.energy ?? 1;
    let bounce = talk ? Math.abs(Math.sin(t * 5.1 + ph)) * .012 * talk * E : 0, hopY = 0;
    if (o.hop != null) { const u = (t - o.hop) / .45; if (u > 0 && u < 1) { hopY = Math.sin(u * Math.PI) * .07; bounce += (u < .15 ? -.04 * (1 - u / .15) : 0); } }
    return { hopY, bounce };
  }
  /** stage point of a puppet: spec { bone, end } | { mouth: true }; fb = [dx, dy] fallback in units of h (dx toward the facing side,
   *  dy from the top of the head) while the cut-out (or its rig) is missing */
  function pupAt(key, x, y, h, o, spec, fb) {
    const R = RIGS[key], dir = o.flip ? -1 : 1;
    if (!R) { const L = pupLift(o); return { x: x + dir * fb[0] * h, y: y - L.hopY * h - h + fb[1] * h, fb: true }; }
    const M = boneMats(R, pupRot(R, o), o.off || {}), end = (bn, e) => { const b = R.bones.find(q => q.n === bn); return b ? aff.ap(M[bn], b[e]) : [R.w / 2, R.h / 2]; };
    const q = spec.mouth ? (R.face ? aff.ap(M.head, R.face.mouth) : end('head', 'a')) : end(spec.bone, spec.end || 'b');
    const s = h / R.h, L = pupLift(o);
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce) };
  }
  /** the lower of the two wrists (the hand that holds a sheet) */
  function lowHand(key, x, y, h, o, fb) {
    if (!RIGS[key]) return pupAt(key, x, y, h, o, null, fb);
    const a = pupAt(key, x, y, h, o, { bone: 'armL_lo' }), b = pupAt(key, x, y, h, o, { bone: 'armR_lo' });
    return a.y > b.y ? a : b;
  }
  /** walking rotations (same formulas as drawPuppet's o.walk) — applied by hand so a held prop follows the arm */
  function walkPose(t, t0, speed, A) {
    const wp = (t - t0) * speed * Math.PI * 2;
    return { rot: { legL: Math.sin(wp) * .34 * A, legR: -Math.sin(wp) * .34 * A, shinL: Math.max(0, -Math.sin(wp + .5)) * .5 * A,
      shinR: Math.max(0, Math.sin(wp + .5)) * .5 * A, armL_up: -Math.sin(wp) * .28 * A, armR_up: Math.sin(wp) * .28 * A, chest: .03 * A },
      bob: Math.abs(Math.cos(wp)) * .014 * A };
  }
  // Boris' box tag « PAS AVANT SAMEDI » — measured on boris_1/3/5: the box's front face spans x ≈ +.03…+.14·h right of the
  // figure's centre (unflipped) and y ≈ .35….46·h below the top of the picture; his forearm crosses its left part, so the tag
  // sits on the free right part of the face. dy from the TOP of the picture; lift = extra vertical offset (walk bob, hop).
  const BOX = { dx: .112, dy: .40, s: .00027 };
  function borisTag(t, x, y, h, flip, lift = 0) { propTag(x + (flip ? -1 : 1) * BOX.dx * h, y - h + BOX.dy * h - lift, BOX.s * h, 'PAS AVANT SAMEDI', { t }); }
  /** one illustration drawn in a clipped screen rect with its own camera (insets) */
  function panel(t, R, key, cam, seed, fn) {
    const I = img(key), iw = 1000, ih = I ? 1000 * I.height / I.width : 1778;
    const cover = Math.max(R.w / iw, R.h / ih), sc = cover * cam.z, hw = R.w / 2 / sc, hh = R.h / 2 / sc;
    const cx = clamp(cam.x, Math.min(hw, iw / 2), Math.max(iw - hw, iw / 2)), cy = clamp(cam.y, Math.min(hh, ih / 2), Math.max(ih - hh, ih / 2));
    const c = { x: cx, y: cy, s: sc, ox: R.x + R.w / 2 + Math.sin(t * .45 + seed) * 2, oy: R.y + R.h / 2 + Math.sin(t * .31 + 1.3 + seed) * 2 };
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.fillStyle = '#1B1410'; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.translate(c.ox, c.oy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    if (I) ctx.drawImage(I, 0, 0, iw, ih);
    if (fn) fn(c);
    ctx.restore();
    return c;
  }
  const pScr = (c, p) => ({ x: c.ox + (p.x - c.x) * c.s, y: c.oy + (p.y - c.y) * c.s });
  /** an inset panel (screen px): white gutter + ink border, pops in at t0 and out at t1 */
  function inset(t, t0, t1, R, key, cam, seed, fn) {
    if (t < t0 || t > t1 + .3) return null;
    const k = clamp(spring(t - t0, 15, .55), 0, 1.12) * (1 - eInCubic(prog(t, t1, t1 + .3))); if (k <= .01) return null;
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2; let c = null;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.rotate(R.rot || 0); ctx.translate(-cx, -cy);
    withShadow(14, () => { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(R.x - 10, R.y - 10, R.w + 20, R.h + 20); });
    c = panel(t, R, key, cam, seed, fn);
    inkRect(R.x, R.y, R.w, R.h, { w: 5, seed: seed + 3 });
    ctx.restore();
    c.k = k; c.R = R; return c;
  }
  /** balloon tail: aims at the mouth, stops just above the head (never on the face) */
  const tailAbove = (m, topY, dx = 0) => [m.x + dx, Math.min(m.y - 14, topY - 12)];

  // ---------- THE PROFORMA (same drawing in P9, P10, P11) ------------------------------------------------------------
  // cream sheet, « PROFORMA », scribbled lines (no figure), a container and a bundle of mèches;
  // o.stampK 0..1 → violet stamp « PLUS DE 2 M F FOB » · o.cut 0..1 → scissor cut from the right edge
  function proforma(x, y, w, o = {}) {
    const h = w * 1.32;
    paperSheet(x, y, w, h, { rot: o.rot || 0, lift: o.lift ?? 12, seed: 17 }, () => {
      text('PROFORMA', w / 2, h * .13, { font: font(FF.bd, w * .14, 400), align: 'center', color: BD.ink, ls: 2 });
      inkLine(w * .14, h * .165, w * .86, h * .16, { w: Math.max(1.5, w * .014), color: BD.orange, seed: 3 });
      // container (ribbed box) + a bundle of mèches: what is ordered (no figure)
      ctx.save(); ctx.translate(w * .1, h * .22);
      ctx.fillStyle = '#C8553D'; ctx.fillRect(0, 0, w * .36, h * .12); inkRect(0, 0, w * .36, h * .12, { w: Math.max(1.2, w * .012), seed: 5 });
      for (let i = 1; i < 7; i++) inkLine(w * .36 * i / 7, h * .012, w * .36 * i / 7, h * .108, { w: Math.max(1, w * .007), color: 'rgba(30,21,18,.55)', seed: 6 + i, wob: .4 });
      ctx.restore();
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const bx = w * (.6 + i * .035); ctx.strokeStyle = ['#2A1A12', '#D9A441', '#7A3B1F'][i % 3]; ctx.lineWidth = Math.max(1.5, w * .02);
        ctx.beginPath(); ctx.moveTo(bx, h * .22); ctx.quadraticCurveTo(bx + w * .03, h * .28, bx - w * .01, h * .35); ctx.stroke(); }
      ctx.fillStyle = BD.amber; ctx.fillRect(w * .58, h * .21, w * .26, h * .025); ctx.restore();
      // handwriting-like lines (no letters, no figure)
      for (let i = 0; i < 6; i++) {
        const yy = h * (.42 + i * .068), L = w * (.42 + hash(i * 3.7) * .3), P = [];
        for (let k = 0; k <= 22; k++) { const u = k / 22; P.push([w * .1 + L * u, yy + Math.sin(u * 30 + i) * h * .008 + Math.sin(u * 71 + i * 2) * h * .004]); }
        inkPath(P, { w: Math.max(1, w * .009), color: '#5A4A3E', seed: 40 + i, wob: .3 });
        inkLine(w * .76, yy, w * .9, yy, { w: Math.max(1, w * .009), color: '#5A4A3E', seed: 50 + i, wob: .3 });
      }
      inkLine(w * .1, h * .83, w * .9, h * .83, { w: Math.max(1.2, w * .011), seed: 60 });
      inkPath(Array.from({ length: 12 }, (_, i) => [w * (.58 + i * .028), h * .9 + Math.sin(i * 1.9) * h * .018]), { w: Math.max(1.2, w * .011), color: '#2B3A8C', seed: 61 });  // signature
      if (o.cut > 0) {                                                     // the scissor cut: a dark jagged slit from the right edge
        const x1 = w, x0 = w * (1 - clamp(o.cut)), P = []; for (let xx = x1; xx >= x0; xx -= w * .02) P.push([xx, h * .5 + (hash(xx * .37) - .5) * h * .008]);
        if (P.length > 1) { inkPath(P, { w: Math.max(2, w * .012), color: '#1E1512', seed: 70, wob: .5 }); }
      }
      if (o.stampK > 0) boxStamp(w * .5, h * .66, ['PLUS DE', '2 M F FOB'], w * .17, VIO, o.stampK, { rot: -.16, seed: 81 });
    });
  }
  /** rectangular rubber stamp (double ink border, starved ink) — k 0..1 = the slam (scale 1.5 → 1) */
  function boxStamp(x, y, lines, size, color, k, o = {}) {
    if (k <= 0) return;
    const f = font(FF.bd, size, 400), lw = Math.max(...lines.map(l => measure(l, f, 2))), w = lw + size * 1.0, h = lines.length * size * 1.08 + size * .55;
    const s = 1 + (1 - eOutCubic(clamp(k))) * .5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.12); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 3) * (o.a ?? .95);
    ctx.fillStyle = o.fill || 'rgba(255,248,236,.5)'; ctx.fillRect(-w / 2, -h / 2, w, h);
    inkRect(-w / 2, -h / 2, w, h, { w: size * .14, color, seed: o.seed || 41 }); inkRect(-w / 2 + size * .2, -h / 2 + size * .2, w - size * .4, h - size * .4, { w: size * .05, color, seed: (o.seed || 41) + 1 });
    lines.forEach((l, i) => text(l, 0, -h / 2 + size * .3 + size * .86 + i * size * 1.08, { font: f, align: 'center', color, ls: 2 }));
    ctx.globalAlpha *= .5; ctx.fillStyle = '#F6EAD2';                     // starved ink
    for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.arc((hash(i * 3.1 + (o.seed || 0)) - .5) * w, (hash(i * 5.7) - .5) * h, size * (.02 + hash(i) * .05), 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ---------- drawn objects ----------------------------------------------------------------------------------------
  /** magnifying glass (lens radius r), handle to the lower right */
  function loupe(x, y, r, rot = .6) {
    ctx.save(); ctx.translate(x, y);
    ctx.save(); ctx.rotate(rot); ctx.fillStyle = '#4A2E1C'; rrect(r * .92, -r * .16, r * 1.1, r * .32, r * .12); ctx.fill(); inkRect(r * .92, -r * .16, r * 1.1, r * .32, { w: r * .07, seed: 91 }); ctx.restore();
    ctx.fillStyle = 'rgba(200,232,255,.32)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .38, r * .28, r * .12, -.6, 0, 7); ctx.fill();
    inkCircle(0, 0, r, { w: r * .14, seed: 92 }); ctx.restore();
  }
  /** a bunch of braids (mèches) tied at the top */
  function mecheBunch(x, y, len, cols, seed, sway = 0) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) { const ox = (i - 4.5) * len * .035, end = x + ox * 1.6 + (hash(seed + i) - .5) * len * .1 + sway;
      ctx.strokeStyle = BD.ink; ctx.lineWidth = len * .05; ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.bezierCurveTo(x + ox + len * .06, y + len * .35, x + ox - len * .06 + sway * .5, y + len * .7, end, y + len); ctx.stroke();
      ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = len * .032; ctx.stroke(); }
    ctx.fillStyle = BD.amber; ctx.fillRect(x - len * .2, y - len * .06, len * .4, len * .1); inkRect(x - len * .2, y - len * .06, len * .4, len * .1, { w: 2.2, seed });
    ctx.restore();
  }
  /** small cargo ship, side view, drawn on the strip (k 0..1 reveal) */
  function boat(x, y, s, t, k) {
    if (k <= 0) return; const bob = Math.sin(t * 2.2) * 3 * s, a = clamp(k * 2);
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.6) * .02); ctx.globalAlpha *= a;
    // stacked containers (pop one after the other)
    const cols = ['#C8553D', VIO, '#E2A33B', '#2F7D9A', '#E07A2E', '#7B4FC0'];
    for (let i = 0; i < 6; i++) { const kk = clamp((k - .3 - i * .08) / .15); if (kk <= 0) continue; const cx = -78 + (i % 3) * 52, cy = -52 - Math.floor(i / 3) * 30;
      ctx.save(); ctx.translate(cx, cy + (1 - kk) * -20); ctx.globalAlpha *= kk; ctx.fillStyle = cols[i]; ctx.fillRect(0, 0, 48, 28); inkRect(0, 0, 48, 28, { w: 2.5, seed: 100 + i }); ctx.restore(); }
    // bridge
    ctx.fillStyle = '#F4EBDD'; ctx.fillRect(80, -78, 34, 52); inkRect(80, -78, 34, 52, { w: 3, seed: 110 });
    ctx.fillStyle = '#2F7D9A'; ctx.fillRect(86, -70, 22, 9);
    ctx.fillStyle = '#E07A2E'; ctx.fillRect(98, -98, 10, 20); inkRect(98, -98, 10, 20, { w: 2.5, seed: 111 });
    // hull
    ctx.beginPath(); ctx.moveTo(-120, -22); ctx.lineTo(140, -22); ctx.lineTo(118, 22); ctx.lineTo(-100, 22); ctx.closePath();
    ctx.fillStyle = '#26324A'; ctx.fill(); ctx.fillStyle = '#C8302A'; ctx.fillRect(-106, 10, 220, 10);
    inkPath([[-120, -22], [140, -22], [118, 22], [-100, 22], [-120, -22]], { w: 4, seed: 112 });
    ctx.restore();
    // waves (independent of the bob)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
    for (let r = 0; r < 2; r++) { const P = []; for (let xx = -160; xx <= 180; xx += 10) P.push([xx, 30 + r * 16 + Math.sin(xx * .08 + t * 3 + r * 2) * 4]);
      inkPath(P, { w: 3, color: r ? 'rgba(31,95,160,.55)' : ZB, seed: 120 + r, wob: .3 }); }
    ctx.restore();
  }
  /** top-down drawn scissors: pivot at (0,0) (local), blades point to −x; open = half-angle (rad) */
  function scissors(open, s) {
    ctx.save(); ctx.scale(s, s);
    const blade = (sgn) => { ctx.save(); ctx.rotate(sgn * open);
      ctx.beginPath(); ctx.moveTo(14, sgn * 4); ctx.lineTo(-200, sgn * 2); ctx.quadraticCurveTo(-120, sgn * -22, 16, sgn * -14); ctx.closePath();
      const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, '#E9EEF3'); g.addColorStop(.5, '#B6C0CA'); g.addColorStop(1, '#8792A0');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BD.ink; ctx.lineJoin = 'round'; ctx.stroke();
      // handle ring
      ctx.beginPath(); ctx.ellipse(70, sgn * -26, 42, 28, sgn * .35, 0, 7); ctx.fillStyle = sgn > 0 ? '#E07A2E' : VIO; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(72, sgn * -26, 24, 13, sgn * .35, 0, 7); ctx.fillStyle = '#B77A45'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, sgn * -6); ctx.lineTo(34, sgn * -18); ctx.lineWidth = 10; ctx.strokeStyle = sgn > 0 ? '#E07A2E' : VIO; ctx.stroke();
      ctx.restore(); };
    withShadow(18, () => blade(1)); blade(-1);
    inkCircle(0, 0, 7, { w: 3, fill: '#5A6470', seed: 130 });
    ctx.restore();
  }
  /** the supplier on the video call, drawn (used only while cast/fournisseur_* is missing): pose 1 waves, pose 2 shows a
   *  sheet and gives a thumbs up. Local px of the phone screen (sw × sh). */
  function supplierDrawn(sw, sh, t, pose2, talk) {
    const cx = sw * .5, by = sh * .98, s = sw / 220, bob = Math.sin(t * 1.8) * 2 * s;
    ctx.save(); ctx.translate(0, bob);
    // shoulders / navy polo
    ctx.beginPath(); ctx.moveTo(cx - 100 * s, by); ctx.quadraticCurveTo(cx - 98 * s, by - 150 * s, cx - 40 * s, by - 172 * s); ctx.lineTo(cx + 40 * s, by - 172 * s);
    ctx.quadraticCurveTo(cx + 98 * s, by - 150 * s, cx + 100 * s, by); ctx.closePath(); ctx.fillStyle = '#23365C'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = '#F4F1EA'; ctx.beginPath(); ctx.moveTo(cx - 22 * s, by - 172 * s); ctx.lineTo(cx, by - 140 * s); ctx.lineTo(cx + 22 * s, by - 172 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
    // neck + head
    ctx.fillStyle = '#D9A273'; ctx.fillRect(cx - 14 * s, by - 196 * s, 28 * s, 30 * s);
    const hy = by - 238 * s + Math.sin(t * 1.1) * 2 * s;
    ctx.beginPath(); ctx.ellipse(cx, hy, 40 * s, 48 * s, 0, 0, 7); ctx.fillStyle = '#E2B184'; ctx.fill(); ctx.lineWidth = 3 * s; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, hy - 30 * s, 42 * s, 24 * s, 0, Math.PI, 0); ctx.fillStyle = '#1E1512'; ctx.fill();
    ctx.fillRect(cx - 42 * s, hy - 32 * s, 84 * s, 12 * s);
    const bl = ((t + .7) % 3.1) < .14;
    for (const ex of [-15, 15]) { if (bl) inkLine(cx + (ex - 6) * s, hy - 4 * s, cx + (ex + 6) * s, hy - 4 * s, { w: 2.5 * s, seed: 140 }); else { ctx.fillStyle = BD.ink; ctx.beginPath(); ctx.arc(cx + ex * s, hy - 4 * s, 4.5 * s, 0, 7); ctx.fill(); } }
    const mo = talk ? Math.abs(Math.sin(t * 11)) * 7 * s : 0;
    ctx.beginPath(); ctx.ellipse(cx, hy + 22 * s, 13 * s, 4 * s + mo, 0, 0, Math.PI); ctx.fillStyle = '#7A2B22'; ctx.fill(); ctx.lineWidth = 2.5 * s; ctx.stroke();
    if (!pose2) {                                                     // waving hand, right
      const a = Math.sin(t * 8) * .35; ctx.save(); ctx.translate(cx + 76 * s, by - 112 * s); ctx.rotate(.14 + a * .25);   // beside the head, never over the face
      ctx.fillStyle = '#23365C'; ctx.fillRect(-14 * s, -70 * s, 28 * s, 74 * s); ctx.strokeRect(-14 * s, -70 * s, 28 * s, 74 * s);
      ctx.translate(0, -78 * s); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -14 * s, 20 * s, 26 * s, 0, 0, 7); ctx.fillStyle = '#E2B184'; ctx.fill(); ctx.stroke();
      for (let f = 0; f < 4; f++) inkLine((-12 + f * 8) * s, -30 * s, (-14 + f * 9) * s, -48 * s, { w: 6 * s, color: '#C99467', seed: 150 + f });
      ctx.restore();
    } else {                                                          // a sheet held up (left) + thumbs up (right)
      ctx.save(); ctx.translate(cx - 70 * s, by - 150 * s); ctx.rotate(-.12);
      ctx.fillStyle = '#FFFDF6'; ctx.fillRect(-40 * s, -100 * s, 80 * s, 104 * s); inkRect(-40 * s, -100 * s, 80 * s, 104 * s, { w: 3 * s, seed: 160 });
      for (let i = 0; i < 5; i++) inkLine(-30 * s, (-82 + i * 16) * s, (12 + hash(i) * 16) * s, (-82 + i * 16) * s, { w: 2 * s, color: '#7A6A5A', seed: 161 + i });
      ctx.restore();
      ctx.save(); ctx.translate(cx + 70 * s, by - 150 * s + Math.sin(t * 5) * 3 * s);
      ctx.beginPath(); ctx.ellipse(0, 0, 22 * s, 18 * s, 0, 0, 7); ctx.fillStyle = '#E2B184'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4 * s, -26 * s, 8 * s, 16 * s, -.15, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  /** video-call screen content (no text, no logo): warehouse behind the supplier, small self view, red hang-up button */
  function callScreen(sw, sh, t, pose2, talk) {
    const I = img('bg/chine_entrepot');
    if (I) { const s = Math.max(sw / I.width, sh / I.height) * 1.25; ctx.drawImage(I, (sw - I.width * s) / 2, (sh - I.height * s) * .45, I.width * s, I.height * s); }
    else { ctx.fillStyle = '#6D7F8E'; ctx.fillRect(0, 0, sw, sh); }
    ctx.fillStyle = 'rgba(255,214,150,.16)'; ctx.fillRect(0, 0, sw, sh);
    const key = pose2 ? K('fournisseur', 2) : K('fournisseur', 1);
    if (has(key)) drawPuppet(key, sw * .5, sh * 1.62, sh * 1.5, { t, phase: PHF, talk, shadow: false });
    else supplierDrawn(sw, sh, t, pose2, talk);
    // self view (Christelle's green dress, just a colour patch) + hang-up button
    ctx.save(); ctx.fillStyle = '#2E8B57'; rrect(sw * .68, sh * .05, sw * .26, sh * .16, sw * .04); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#FFF6E2'; ctx.stroke();
    ctx.fillStyle = '#7B4526'; ctx.beginPath(); ctx.arc(sw * .81, sh * .11, sw * .045, 0, 7); ctx.fill();
    ctx.fillStyle = '#E2382C'; ctx.beginPath(); ctx.arc(sw * .5, sh * .9, sw * .085, 0, 7); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = sw * .022; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(sw * .5, sh * .92, sw * .04, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.restore();
  }
  /** top of the supplier's head in the phone screen's local px (the balloon tail stops there, never on the face) */
  function supplierHead(sw, sh, pose2) {
    const key = pose2 ? K('fournisseur', 2) : K('fournisseur', 1);
    if (has(key) && RIGS[key]) { const p = pupAt(key, sw * .5, sh * 1.62, sh * 1.5, { t: 0 }, { bone: 'head', end: 'b' }); return [p.x, p.y]; }
    if (has(key)) return [sw * .5, sh * .12];
    const s = sw / 220; return [sw * .5, sh * .98 - 292 * s];
  }

  // ---------- P9 overlays (screen px) ------------------------------------------------------------------------------
  function bandFOB(t, t0, t1) {
    if (t < t0 || t > t1 + .45) return;
    const k = eOutCubic(prog(t, t0, t0 + .5)) * (1 - eInCubic(prog(t, t1, t1 + .45)));
    ctx.save(); ctx.translate(0, (1 - k) * 340);
    kraftSheet(540, 1580, 1000, 232, { seed: 41, lift: 12, rot: -.01 }, (w, h) => {
      text('À PARTIR DE 2 000 000 F FOB', w / 2, 78, { font: font(FF.bd, 66, 400), align: 'center', color: BD.ink, ls: 2 });
      text('— le prix au port de départ,', w / 2, 140, { font: font(FF.letN, 50, 400), align: 'center', color: BD.ink });
      text('sans le fret maritime', w / 2, 196, { font: font(FF.letN, 50, 400), align: 'center', color: BD.ink });
    });
    ctx.restore();
  }
  function noteBrush(t, t0, t1) {
    if (t < t0 || t > t1 + .45) return;
    const k = eOutCubic(prog(t, t0, t0 + .35)) * (1 - eInCubic(prog(t, t1, t1 + .45)));
    const l1 = 'votre propre conteneur complet ?', l2 = 'même en dessous, vérifiez avec votre transitaire';
    const s2 = fitSize(l2, FF.brush, 48, 900, 40), d1 = .85, d2 = 1.25;
    ctx.save(); ctx.translate(0, (1 - k) * 260);
    paperSheet(540, 1808, 980, 168, { rot: .008, lift: 10, seed: 44, fill: '#FFF4DA' }, () => {});
    WR(l1, 540, 1782, t, t0 + .2, d1, { size: 48, fam: FF.brush, color: RUST, align: 'center' });
    WR(l2, 540, 1846, t, t0 + .2 + d1, d2, { size: s2, fam: FF.brush, color: RUST, align: 'center' });
    ctx.restore();
  }
  /** one of the two vignettes (wide strip, screen px): icon on the left, header + arrow + line, then a second line */
  function vignette(t, v) {
    if (t < v.t0) return;
    const k = clamp(spring(t - v.t0, 14, .55), 0, 1.1), x = 60, w = 960, h = 196, y = v.y;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.rotate(v.rot); ctx.translate(-(x + w / 2), -(y + h / 2));
    withShadow(12, () => { ctx.fillStyle = '#FFF9EC'; ctx.fillRect(x, y, w, h); });
    inkRect(x, y, w, h, { w: 4.5, seed: v.seed });
    // icon
    ctx.save(); ctx.beginPath(); ctx.rect(x + 10, y + 10, 176, h - 20); ctx.clip();
    ctx.fillStyle = v.kind === 'valeur' ? '#F1E1C2' : '#E9D2A8'; ctx.fillRect(x + 10, y + 10, 176, h - 20);
    const lx = x + 98 + Math.sin(t * 1.7 + v.seed) * 22, ly = y + 98 + Math.cos(t * 1.3 + v.seed) * 16;
    if (v.kind === 'valeur') {
      paperSheet(x + 96, y + 100, 104, 140, { rot: -.08, lift: 6, seed: 12 }, (pw, ph) => {
        for (let i = 0; i < 6; i++) inkLine(12, 22 + i * 18, 52 + hash(i) * 30, 22 + i * 18, { w: 2.2, color: '#7A6A5A', seed: 170 + i });
        inkLine(64, 112, 92, 112, { w: 3, color: BD.ink, seed: 177 }); });
    } else mecheBunch(x + 96, y + 30, 150, ['#2A1A12', '#D9A441', '#7A3B1F', '#3B2418'], 13, Math.sin(t * 1.4) * 4);
    loupe(lx, ly, 34, .7);
    ctx.restore(); inkRect(x + 10, y + 10, 176, h - 20, { w: 3, seed: v.seed + 1 });
    // header + arrow + line 1, line 2
    const fH = font(FF.bd, 54, 400), hw = measure(v.head, fH, 2), tx = x + 206;
    text(v.head, tx, y + 84, { font: fH, color: v.color, ls: 2 });
    const ax = tx + hw + 12, aK = clamp((t - v.a1) / .25);
    if (aK > 0) arrowInk(ax, y + 64, ax + 46 * aK, y + 64, { w: 5, color: BD.ink, seed: 9, head: 15 });
    const s1 = fitSize(v.l1, FF.letN, 50, x + w - 16 - (ax + 58), 44);
    WR(v.l1, ax + 58, y + 82, t, v.a1 + .15, v.d1, { size: s1, color: BD.ink });
    WR(v.l2, tx, y + 156, t, v.a2, v.d2, { size: fitSize(v.l2, FF.letN, 48, x + w - 20 - tx, 44), color: '#4A3A2E' });
    ctx.restore();
  }
  /** soft morning light on the stall (stage units): golden wash from the upper left + floating dust */
  function morning(t, c) {
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    const g = ctx.createLinearGradient(0, 0, 900, 1400); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(.6, 'rgba(255,214,140,.12)'); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1800); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) { const x0 = 80 + i * 210; const sg = ctx.createLinearGradient(x0, 300, x0 + 420, 1500);
      sg.addColorStop(0, 'rgba(255,226,170,0)'); sg.addColorStop(.35, 'rgba(255,226,170,.08)'); sg.addColorStop(1, 'rgba(255,226,170,0)'); ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(x0 - 110, 300); ctx.lineTo(x0 - 20, 300); ctx.lineTo(x0 + 520, 1800); ctx.lineTo(x0 + 330, 1800); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function dust(t) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) { const x = 60 + hash(i * 3.1) * 820 + Math.sin(t * .4 + i) * 30, y = 520 + ((hash(i * 7.3) * 800 - t * (8 + hash(i) * 10)) % 800 + 800) % 800;
      ctx.fillStyle = `rgba(255,236,190,${.25 + .35 * (.5 + .5 * Math.sin(t * 2 + i))})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + hash(i * 1.7) * 2.2, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  // ---------- P9 set: the wall of mèches seen out of focus (depth of field), Christelle's stall counter in the foreground --------
  // BG3 is a close-up of hanging goods with no floor: the two women stand BEHIND the counter (cropped at the knees by it), the
  // wall is softened so that its big bundles read as « behind », not as giant objects next to small people.
  const U9 = 830, HC9 = U9 * .98, HM9 = U9 * .92, HB9 = U9 * .96, FY9 = 1451, CT9 = 1199;   // heights · feet line (hidden) · counter top
  let BLUR9 = null;
  function wallBlur() {
    if (BLUR9) return BLUR9; const I = img('bg/etal_meches'); if (!I) return null;
    const cv = document.createElement('canvas'); cv.width = 520; cv.height = Math.round(520 * I.height / I.width);
    const g = cv.getContext('2d'); g.filter = 'blur(2.6px)'; g.drawImage(I, -10, -10, cv.width + 20, cv.height + 20);
    BLUR9 = cv; return cv;
  }
  function wallSoft(c) {
    const B = wallBlur(); if (!B) return;
    ctx.drawImage(B, 0, 0, 1000, c.ih);
    ctx.fillStyle = 'rgba(255,233,200,.10)'; ctx.fillRect(0, 0, 1000, c.ih);                    // a little atmosphere: pushes it back
  }
  /** Christelle's stall (same blue wax cloth as on Monday), seen from the aisle: board + cloth + bundles hanging over the edge */
  function stallFront(t) {
    const x0 = -40, x1 = 1040, w = x1 - x0, y = CT9, top = 30, edge = 22, y1 = 1810;
    ctx.save();
    // cloth
    ctx.fillStyle = '#1D5FA8'; ctx.fillRect(x0, y + top, w, y1 - y - top);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y + top, w, y1 - y - top); ctx.clip();
    for (let r = 0; r < 12; r++) for (let k = 0; k < 18; k++) { const cx = x0 + 18 + k * 62 + (r % 2) * 31, cy = y + top + 64 + r * 54;
      ctx.fillStyle = '#E8642A'; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, 7); ctx.fill(); ctx.fillStyle = '#F2C04A'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#123E70'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill(); }
    for (let i = 0; i < 9; i++) { const fx = x0 + 60 + i * 124 + hash(i * 2.3) * 30;                      // soft vertical folds
      const g = ctx.createLinearGradient(fx - 26, 0, fx + 26, 0); g.addColorStop(0, 'rgba(8,10,30,0)'); g.addColorStop(.5, 'rgba(8,10,30,.20)'); g.addColorStop(1, 'rgba(8,10,30,0)');
      ctx.fillStyle = g; ctx.fillRect(fx - 26, y + top, 52, y1 - y - top); }
    const sh = ctx.createLinearGradient(0, y + top, 0, y1); sh.addColorStop(0, 'rgba(10,6,24,.6)'); sh.addColorStop(.1, 'rgba(10,6,24,.22)'); sh.addColorStop(1, 'rgba(10,6,24,.5)');
    ctx.fillStyle = sh; ctx.fillRect(x0, y + top, w, y1 - y - top);
    ctx.restore();
    // board: top surface (seen from slightly above, lit by the morning) and its front edge
    ctx.fillStyle = '#B98450'; ctx.fillRect(x0, y, w, top);
    const lg = ctx.createLinearGradient(0, 0, 1000, 0); lg.addColorStop(0, 'rgba(255,226,170,.38)'); lg.addColorStop(1, 'rgba(255,226,170,0)');
    ctx.fillStyle = lg; ctx.fillRect(x0, y, w, top);
    ctx.fillStyle = '#7A4E28'; ctx.fillRect(x0, y + top, w, edge);
    for (let i = 0; i < 5; i++) inkLine(x0, y + 6 + i * 5.5, x1, y + 5 + i * 5.5, { w: 1.2, color: 'rgba(80,46,20,.35)', seed: 300 + i, step: 80, wob: 2 });
    inkLine(x0, y, x1, y, { w: 3.5, seed: 311, step: 60 }); inkLine(x0, y + top, x1, y + top, { w: 3, seed: 312, step: 60 }); inkLine(x0, y + top + edge, x1, y + top + edge, { w: 3.5, seed: 313, step: 60 });
    // goods on the board: folded packets of braids (no label, no price)
    const packs = [[120, '#2A1A12'], [205, '#D9A441'], [610, '#7A3B1F'], [905, '#8E2A3A']];
    for (const [px, col] of packs) { ctx.save(); ctx.translate(px, y + 14); ctx.rotate((hash(px) - .5) * .12);
      withShadow(3, () => { ctx.fillStyle = col; rrect(-44, -18, 88, 26, 9); ctx.fill(); });
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-36 + i * 22, -14); ctx.quadraticCurveTo(-30 + i * 22, -5, -36 + i * 22, 4); ctx.stroke(); }
      ctx.fillStyle = BD.amber; ctx.fillRect(-6, -19, 12, 28); inkRect(-44, -18, 88, 26, { w: 2.2, seed: px }); ctx.restore(); }
    // bundles hanging over the front edge (they sway a little)
    const cols = [['#2A1A12', '#3B2418'], ['#7A3B1F', '#A0522D'], ['#D9A441', '#B7862F'], ['#8E2A3A', '#6E1F2C'], ['#3B2418', '#2A1A12'],
      ['#B85A2B', '#8E4420'], ['#1E1512', '#3A2A20'], ['#C9973A', '#E0B458']];
    for (let i = 0; i < 8; i++) mecheBunch(30 + i * 136 + hash(i * 5.1) * 26, y + top + edge - 4, 230 + hash(i * 3.3) * 150, cols[i], 320 + i, Math.sin(t * 1.3 + i) * 4);
    ctx.restore();
  }
  /** a hand gripping the right edge of a held sheet (stage units, in the SHEET's frame: origin = sheet centre, ex = half width):
   *  the hand's side shows beyond the edge (drawn before the sheet), the thumb lies on the front (drawn after) */
  function gripHand(front, ex, ey, s, skin) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = BD.ink; ctx.lineWidth = 2.4 * s;
    if (!front) {                                               // back of the hand + knuckles, sticking out past the edge
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(ex + 7 * s, ey + 4 * s, 12 * s, 19 * s, -.15, 0, 7); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(ex + 2 * s, ey - 8 * s + i * 9 * s, 7 * s, 4.6 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    } else {                                                    // the thumb, over the front of the sheet, pointing up and in
      ctx.save(); ctx.translate(ex + 3 * s, ey + 2 * s); ctx.rotate(-2.35);
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(11 * s, 0, 14 * s, 6.2 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,214,180,.55)'; ctx.beginPath(); ctx.ellipse(19 * s, -.6 * s, 4 * s, 3.2 * s, 0, 0, 7); ctx.fill();   // nail
      ctx.restore();
    }
    ctx.restore();
  }

  /** BD shock marks around a head (screen px, drawn over the inset frame): radiating strokes that pop at t0 and quiver, a sweat
   *  drop that slides down the temple. (fx, fy) = face centre, h = character height in px */
  function surprise(t, t0, fx, fy, h) {
    if (t < t0) return; const u = t - t0, k = clamp(spring(u, 18, .45), 0, 1.15), q = Math.sin(u * 38) * Math.exp(-u * 3) * .02 * h;
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = -Math.PI * (.12 + i * .127), r0 = h * .118, r1 = r0 + h * (.045 + (i % 2) * .022) * k;
      inkLine(fx + Math.cos(a) * r0 + q, fy + Math.sin(a) * r0, fx + Math.cos(a) * r1 + q, fy + Math.sin(a) * r1, { w: h * .009, seed: 400 + i }); }
    const dy = Math.min(u, 2.2) * h * .016, dx = fx + h * .085, dy0 = fy - h * .02 + dy, ds = h * .02 * clamp(u / .25);
    ctx.fillStyle = '#9FD3F2'; ctx.beginPath(); ctx.moveTo(dx, dy0 - ds * 1.6); ctx.quadraticCurveTo(dx + ds, dy0, dx, dy0 + ds); ctx.quadraticCurveTo(dx - ds, dy0, dx, dy0 - ds * 1.6); ctx.fill();
    ctx.lineWidth = h * .005; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.restore();
  }

  // ---------- P10: the counter (tiled wide) and the frise ------------------------------------------------------------
  const FR = { x0: 470, x1: 2440, y0: 300, y1: 930, z1: 1440, z2: 1975 };     // strip extent · zone boundaries (stage units)
  const PASS = { x: 1250, y: 690, w: 320, rot: .05 };                            // the green passport, end of zone 1
  function counterTiles(c) {
    const I = img('bg/comptoir_dessus'); if (!I) return;
    for (const i of [-1, 1, 2, 3]) ctx.drawImage(I, i * 1000, 0, 1000, c.ih);
    for (const i of [0, 1, 2, 3]) { const x = i * 1000; ctx.fillStyle = 'rgba(40,20,8,.55)'; ctx.fillRect(x - 3, 0, 6, c.ih); inkLine(x, 0, x, c.ih, { w: 3.5, seed: 200 + i, step: 60 }); }
  }
  /** zone tag (filled ink label) */
  function zoneTag(x, y, label, color) {
    const f = font(FF.bd, 40, 400), w = measure(label, f, 2) + 44, h = 54;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.012);
    withShadow(4, () => { ctx.fillStyle = color; rrect(0, 0, w, h, 10); ctx.fill(); });
    inkRect(0, 0, w, h, { w: 3.5, seed: 210 + label.length });
    text(label, w / 2, h * .76, { font: f, align: 'center', color: '#FFF6E2', ls: 2 });
    ctx.restore(); return w;
  }
  /** sticky kraft label with 1–2 lines, pops at t0 (stage units) */
  function sticky(t, t0, x, y, w, lines, o = {}) {
    if (t0 == null || t < t0) return; const k = clamp(spring(t - t0, 16, .5), 0, 1.12);
    const h = lines.length * (o.lh || 42) + 22;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.rotate(o.rot ?? -.015); ctx.translate(-w / 2, -h / 2);
    withShadow(6, () => { ctx.fillStyle = o.fill || '#F6E7C4'; ctx.fillRect(0, 0, w, h); });
    inkRect(0, 0, w, h, { w: 2.5, seed: 220 + lines.length });
    ctx.fillStyle = 'rgba(243,167,69,.75)'; ctx.fillRect(w / 2 - 34, -10, 68, 22);   // tape
    lines.forEach((L, i) => { let xx = 16; const yy = 14 + (i + 1) * (o.lh || 42) - 8;
      for (const seg of L) { if (seg.arrow) { arrowInk(xx, yy - 11, xx + 34, yy - 11, { w: 3.5, color: BD.ink, seed: 225, head: 11 }); xx += 46; continue; }
        const f = font(seg.fam || FF.letN, seg.size || 36, 400); text(seg.s, xx, yy, { font: f, color: seg.color || BD.ink, ls: seg.fam === FF.bd ? 1 : 0 }); xx += measure(seg.s, f, seg.fam === FF.bd ? 1 : 0); } });
    ctx.restore();
  }
  /** pen-tip path for Mireille's marker: keys { t, x, y, w } (w = writing until the next key: linear) */
  function penAt(keys, t) {
    if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, writing: 0, lift: 0 };
    for (let i = 1; i < keys.length; i++) { const a = keys[i - 1], b = keys[i]; if (t < b.t) {
      const u = (t - a.t) / Math.max(.001, b.t - a.t);
      if (a.w) return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) + Math.sin(t * 31) * 1.6, writing: 1, lift: 0 };
      const e = eInOutCubic(u); return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), writing: 0, lift: Math.sin(u * Math.PI) }; } }
    const L = keys[keys.length - 1]; return { x: L.x, y: L.y, writing: 0, lift: 0 };
  }
  const PEN = { rot: -.36, s: 1.2, tip: [-40.2, -168.6] };                        // propHand 'pen': marker tip in local units
  function penHand(p, t) {
    const rot = PEN.rot + (p.writing ? Math.sin(t * 9) * .03 : 0), s = PEN.s * (1 + p.lift * .07), c = Math.cos(rot), sn = Math.sin(rot);
    const lx = PEN.tip[0] * s, ly = PEN.tip[1] * s, wx = p.x - (c * lx - sn * ly), wy = p.y - (sn * lx + c * ly);
    propHand(wx, wy, s, { rot, pose: 'pen', arm: 900, lift: 14 + p.lift * 16, pen: '#1E1512' });
  }

  // ---------- P11: the warning card (stage units, drawn around its centre) -------------------------------------------
  const CARD = { w: 850, h: 500 };
  function warningCard(t, S) {
    const w = CARD.w, h = CARD.h;
    withShadow(16, () => { ctx.fillStyle = '#FFF9EC'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.fillStyle = '#C8302A'; ctx.fillRect(-w / 2, -h / 2, w, 84);
    inkRect(-w / 2, -h / 2, w, h, { w: 5, seed: 231 }); inkLine(-w / 2, -h / 2 + 84, w / 2, -h / 2 + 84, { w: 4, seed: 232 });
    // warning triangle
    ctx.save(); ctx.translate(-w / 2 + 52, -h / 2 + 44);
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(30, 24); ctx.lineTo(-30, 24); ctx.closePath(); ctx.fillStyle = '#FFD25A'; ctx.fill();
    inkPath([[0, -30], [30, 24], [-30, 24], [0, -30]], { w: 4, seed: 233 }); inkLine(0, -12, 0, 8, { w: 6, seed: 234 }); inkCircle(0, 16, 3, { w: 3, fill: BD.ink, seed: 235 });
    ctx.restore();
    text('QUAND ILS SONT OBLIGATOIRES :', -w / 2 + 100, -h / 2 + 60, { font: font(FF.bd, fitSize('QUAND ILS SONT OBLIGATOIRES :', FF.bd, 46, w - 130), 400), color: '#FFF6E2', ls: 2 });
    const xL = -w / 2 + 40;
    WR("DÉCLARATION D'IMPORTATION", xL, -h / 2 + 156, t, S.l1, S.d1, { size: 52, fam: FF.bd, color: BD.ink });
    WR('+ RAPPORT DE VALEUR', xL, -h / 2 + 222, t, S.l2, S.d2, { size: 52, fam: FF.bd, color: BD.ink });
    if (t > S.l3 - .1) inkLine(xL, -h / 2 + 252, w / 2 - 40, -h / 2 + 250, { w: 2.5, color: 'rgba(30,21,18,.35)', seed: 236 });
    WR('les oublier = amende de', xL, -h / 2 + 320, t, S.l3, S.d3, { size: 46, color: BD.ink });
    if (t >= S.pct) { const k = clamp((t - S.pct) / .14), sc = 1 + (1 - eOutCubic(k)) * .7;
      ctx.save(); ctx.translate(xL + measure('les oublier = amende de', font(FF.letN, 46, 400)) + 130, -h / 2 + 330); ctx.rotate(-.06); ctx.scale(sc, sc); ctx.globalAlpha *= clamp(k * 3);
      haloText('25 %', 0, 0, 112, BD.red, { ls: 3 }); ctx.restore(); }
    WR('de la valeur taxable', xL, -h / 2 + 382, t, S.l4, S.d4, { size: 46, color: BD.ink });
    WR('(50 % en récidive)', xL, -h / 2 + 446, t, S.l5, S.d5, { size: 42, color: '#5A4636' });
  }

  shots(() => {
    // ---------------------------------------------- shot boundaries (voice) -------------------------------------------
    const T9 = shotStart('S10'), T10 = shotStart('S11'), T11 = ss('S12', .3), TEND = shotStart('S14');

    // =========================================== P9 · MARDI, la proforma ==============================================
    // Two-shot behind Christelle's counter (knees hidden by it): Tantine Mireille walks in from the left in profile (M5),
    // proforma in her front hand, and settles in M2 (mirrored, so the hand holding the sheet is the one toward Christelle);
    // Christelle (C1, mirrored to face her) says her line; push on the sheet for the stamp; pull back for the two vignettes,
    // while Boris crosses the far side of the aisle with his box; Mireille's line closes the shot.
    const mw0 = T9 + .05, mw1 = tw('S10', 'lit', .2), swF = .26;                         // Mireille walks in, then turns to M2
    const MX0 = -190, MX = 300, CX9 = 690;                                               // Mireille's mark · Christelle's place
    const bC0 = tw('S10', 'son', -.08), bC1 = bC0 + 1.85, cardOut = bC0 - .32;           // her line rides on « son propre conteneur »
    const push0 = bC1 - .25, push1 = push0 + .85;
    const stamp9 = tw('S10', 'FOB', .06);
    const band9 = tw('S10', 'sans', -.18), note9 = tw('S10', 'fret', -.1);
    const pull0 = tw('S10', 'Deux', -.2), pull1 = pull0 + 1.05;
    const vV = tw('S10', 'valeur', -.3), vQ = tw('S10', 'qualité', -.42), out9 = vV - .45;
    const bM0 = Math.min(te('S10', "l'autre", -.85), T10 - 1.95), bM1 = T10 - .04;
    const bw0 = pull1 - .45, bw1 = bw0 + 3.4;                                            // Boris crosses the far side, right → left
    const PW = 150, MSKIN = '#93522B';                                                    // proforma width (stage units) · Mireille's skin
    const M5 = K('mireille', 5), M2 = K('mireille', 2), C1 = K('christelle', 1);
    const mOpt = (t) => {
      const mu = prog(t, mw0, mw1), walking = t < mw1, mx = lerp(MX0, MX, 1 - Math.pow(1 - mu, 1.5));
      const wp = walking ? walkPose(t, mw0, 1.3, .55 * (1 - .6 * eInCubic(mu))) : { rot: {}, bob: 0 };
      const read = -.06 * env(t, mw1 + .2, pull0 + .3, .45, .45);                       // she bends her head toward the sheet
      wp.rot.head = (wp.rot.head || 0) + (walking ? 0 : read);
      return { key: walking ? M5 : M2, x: mx, y: FY9 - wp.bob * HM9,
        o: { t, phase: PHM, grade: MORNING, flip: !walking, talk: t > bM0 && t < bM1 ? 1 : 0, rot: wp.rot } };
    };
    /** the hand that holds the sheet: M5's front hand while walking, M2's hanging hand (mirrored: toward Christelle) after */
    const handM = (m) => m.key === M5 ? pupAt(M5, m.x, m.y, HM9, m.o, { bone: 'armL_lo' }) : lowHand(M2, m.x, m.y, HM9, m.o);
    const sheetAt = (t) => {
      const m = mOpt(t), h = handM(m), k = m.key === M2 ? eOutCubic(clamp((t - mw1) / swF)) : 1;
      let p = { x: h.x - PW * .4, y: h.y - PW * .3, hx: h.x, hy: h.y };
      if (k < 1) { const m5 = Object.assign({}, m, { key: M5, o: Object.assign({}, m.o, { flip: false, rot: walkPose(mw1, mw0, 1.3, .22).rot }) }), h5 = handM(m5);
        p = { x: lerp(h5.x - PW * .4, p.x, k), y: lerp(h5.y - PW * .3, p.y, k), hx: lerp(h5.x, h.x, k), hy: lerp(h5.y, h.y, k) }; }
      return p;
    };
    const PF = sheetAt(push1);                                                          // camera target for the push
    const ZP = 1.65, SP = 1.08 * ZP;                                                    // push zoom · its scale (px per stage unit)
    let c9 = null;
    defineShot({ id: 'P9', t0: T9, img: 'bg/etal_meches', seed: 9, inT: .7, inKind: 'page',
      cam: [{ t: T9, x: 420, y: 985, z: 1.44 }, { t: mw1 + .4, x: 514, y: 988, z: 1.35 }, { t: push0, x: 516, y: 988, z: 1.36, e: 'lin' },
        { t: push1, x: PF.x - 20 / SP, y: PF.y - 40 / SP, z: ZP }, { t: pull0, x: PF.x - 16 / SP, y: PF.y - 36 / SP, z: ZP * 1.03, e: 'lin' },
        { t: pull1, x: 514, y: 988, z: 1.33 }, { t: T10, x: 510, y: 990, z: 1.39, e: 'lin' }],
      stage(t, n, c) {
        c9 = c;
        wallSoft(c);
        morning(t, c);
        // Boris on the far side of the aisle: smaller, slightly softer and dimmer, his box tagged « PAS AVANT SAMEDI »
        const bu = prog(t, bw0, bw1);
        if (bu > 0 && bu < 1) { const bx = lerp(1120, -160, bu), bh = HB9 * .68, by = FY9 - 189, wp = (t - bw0) * 1.45 * Math.PI * 2, bob = Math.abs(Math.cos(wp)) * .014 * .8 * bh;
          ctx.save(); ctx.filter = 'blur(1.8px)';
          drawPuppet(K('boris', 5), bx, by, bh, { t, phase: PHB, grade: { mul: '#D2C5B2', tint: '#FFD9A6', tintA: .1 }, walk: { speed: 1.45, amp: .8 }, walkT0: bw0, shadow: false });
          borisTag(t, bx, by, bh, false, bob);
          ctx.restore(); }
        // Tantine Mireille: M5 walking in (profile, facing right), then M2 with the proforma in the hand toward Christelle
        const m = mOpt(t);
        if (m.key === M5) drawPuppet(M5, m.x, m.y, HM9, m.o);
        else { drawPuppet(M2, m.x, m.y, HM9, m.o);
          const k = clamp((t - mw1) / swF); if (k < 1) drawPuppet(M5, m.x, m.y, HM9, Object.assign({}, m.o, { flip: false, rot: walkPose(mw1, mw0, 1.3, .22).rot, a: 1 - k, shadow: false })); }
        const sp = sheetAt(t), srot = -.05 + Math.sin(t * 1.3) * .012, grip = (front) => at(sp.x, sp.y, srot, 1, 1, () => gripHand(front, PW * .5, PW * .3, 1, MSKIN));
        grip(false);
        proforma(sp.x, sp.y, PW, { rot: srot, lift: 8, stampK: clamp((t - stamp9) / .14) });
        grip(true);
        // Christelle (C1, proud, hands on her hips), mirrored to face Mireille: a hop on her line, then she leans in
        const ct = t > bC0 && t < bC1 ? 1 : 0;
        drawPuppet(C1, CX9, FY9, HC9, { t, phase: PHC, grade: MORNING, flip: true, talk: ct, hop: bC0 + .05,
          lean: .035 * env(t, pull1 - .3, T10 + 1, .5, .1) });
        stallFront(t);
        dust(t);
      },
      screen(t) {
        if (!c9) return;
        const fade = 1 - clamp((t - cardOut) / .3);
        if (fade > 0) { dayCard(t, T9 + .35, 'MARDI', { a: fade }); ctx.save(); ctx.globalAlpha *= fade; tabOnglet(t, T9 + .75, '② LA CONFORMITÉ'); ctx.restore(); }
        // Christelle's balloon, then Mireille's (above the heads, tails stop above the head)
        const co = { t, phase: PHC, flip: true, talk: 1, hop: bC0 + .05 };
        const cmS = pupAt(C1, CX9, FY9, HC9, co, { mouth: true }), cm = stageToScreen(c9, cmS.x, cmS.y);
        const cTop = stageToScreen(c9, CX9, FY9 - HC9).y;
        balloon(t, { t0: bC0, t1: bC1, text: 'Mon premier conteneur à moi, Tantine !', x: clamp(cm.x - 70, 330, 760), y: Math.max(200, cTop - 168), w: 470, size: 52, tail: tailAbove(cm, cTop, -18), seed: 21 });
        const m = mOpt(t), mmS = pupAt(M2, m.x, m.y, HM9, Object.assign({}, m.o, { flip: true }), { mouth: true }), ms = stageToScreen(c9, mmS.x, mmS.y);
        const mTop = stageToScreen(c9, m.x, m.y - HM9).y;
        balloon(t, { t0: bM0, t1: bM1, text: 'Chaque papier a son moment.', x: clamp(ms.x + 70, 335, 745), y: Math.max(330, mTop - 108), w: 560, size: 54, tail: tailAbove(ms, mTop, 6), seed: 22 });
        // bandeau FOB + brush note, then the two vignettes
        bandFOB(t, band9, out9);
        noteBrush(t, note9, out9);
        vignette(t, { t0: vV, y: 1468, rot: -.008, seed: 24, kind: 'valeur', head: 'LA VALEUR', color: '#1F5FA0', l1: 'rapport de valeur', l2: '(sur documents)',
          a1: vV + .25, d1: .6, a2: vV + 1.0, d2: .5 });
        vignette(t, { t0: vQ, y: 1688, rot: .006, seed: 26, kind: 'qualite', head: 'LA QUALITÉ', color: ZG, l1: 'certificat de conformité', l2: '(souvent inspection ou essais)',
          a1: vQ + .25, d1: .6, a2: vQ + .95, d2: .55 });
      } });
    addShake(stamp9, 12, .16);

    // =========================================== P10 · chaque papier a son moment =====================================
    const S = 'S11';
    const land10 = T10 + .14;                                                          // the proforma lands (raccord)
    const bF0 = T10 + .06, bF1 = Math.max(bF0 + 1.9, tw(S, "D'abord", -.06));            // supplier: « Payé samedi ? … »
    const bK0 = tw(S, "D'abord", -.04), bK1 = bK0 + 2.05;                               // Christelle (off-screen)
    const pick0 = tw(S, "D'abord", -.3), pick1 = pick0 + .75;                            // she picks up the phone
    const sw2 = tw(S, 'dépose', 0);                                                      // supplier X1a → X1b (sheet, thumbs up)
    // the marker strokes (zone 1)
    const L1 = { t0: tw(S, "D'abord", .18), d: .5 };
    const L2 = { t0: tw(S, 'déclaration', -.02) }; L2.d = Math.max(.8, te(S, "d'importation") - L2.t0);
    const lab2 = te(S, "d'importation", -.12);
    const L3 = { t0: tw(S, 'contrôle', -.04) }; L3.d = Math.max(.75, te(S, 'qualité', -.25) - L3.t0);
    const lab3 = L3.t0 + L3.d * .55;
    const pp0 = L3.t0 + L3.d - .05, pp1 = pp0 + .45, stampP = pp1 - .02;                 // push to the passport, stamp
    const tr0 = stampP + .6, tr1 = tr0 + .75;                                            // travelling to zones 2–3
    const L4 = { t0: Math.max(tr1 - .15, tw(S, 'il', .05)), d: .5 }, L4b = { t0: L4.t0 + .52, d: .3 };
    const L5 = { t0: L4b.t0 + .36 }; L5.d = Math.max(.6, te(S, 'définitive', -.2) - L5.t0);
    const lab4 = L5.t0 + L5.d + .05;
    const L6 = { t0: lab4 + .2, d: .35 }, L7 = { t0: L6.t0 + .4, d: .5 }, L8 = { t0: L7.t0 + .55, d: .45 };
    const boat0 = L8.t0 + .15;
    const bMi0 = Math.min(lab4 + .05, T11 - 2.05), bMi1 = T11 - .06;                     // Mireille (off-screen): the BESC
    const handOut = T10 + .55, pen0 = L1.t0 - .55;
    // geometry of the strip lines (stage units)
    const ZX1 = 540, ZX2 = 1545, ZX3 = 1995, BR = 23;                                     // text columns · badge radius
    const fB = s => font(FF.bd, s, 400), fP = s => font(FF.letN, s, 400);
    const X = {
      l1: ZX1 + 2 * BR + 14, l2: ZX1 + 2 * BR + 14, l3: ZX1 + 2 * BR + 14,
      l4a: ZX2 + 2 * BR + 12, l5: ZX2, l6: ZX3 + 2 * BR + 14, l7: ZX3, l8: ZX3,
    };
    const Y = { l1: 552, l2: 630, lab2: 650, l3: 812, lab3: 830, l4: 556, l5: 624, lab4: 650, l6: 562, l7: 630, l8: 690 };
    const W1 = measure('PROFORMA', fB(46), 0), W2s = fitSize("DÉCLARATION D'IMPORTATION", FF.bd, 46, 1080 - X.l2), W2 = measure("DÉCLARATION D'IMPORTATION", fB(W2s), 0);
    const W3 = measure('CONTRÔLE DE LA QUALITÉ', fB(46), 0), W4a = measure('le fournisseur ', fP(42), 0), W4b = measure('DÉPOSE', fB(46), 0);
    const W5 = measure('la facture définitive', fP(42), 0), W6 = measure('BESC', fB(60), 0), W7s = fitSize('au moins 2 jours avant', FF.letN, 42, 2370 - ZX3);
    const W7 = measure('au moins 2 jours avant', fP(W7s), 0), W8 = measure("l'arrivée du bateau", fP(42), 0);
    const tipY = (y, s) => y - s * .32;
    const PK = [
      { t: pen0 - .6, x: 1300, y: 1700 }, { t: L1.t0 - .05, x: X.l1, y: tipY(Y.l1, 46) },
      { t: L1.t0, x: X.l1, y: tipY(Y.l1, 46), w: 1 }, { t: L1.t0 + L1.d, x: X.l1 + W1, y: tipY(Y.l1, 46) },
      { t: L1.t0 + L1.d + .08, x: X.l1 + W1 + 42, y: Y.l1 - 21, w: 1 }, { t: L1.t0 + L1.d + .2, x: X.l1 + W1 + 58, y: Y.l1 - 4, w: 1 },
      { t: L1.t0 + L1.d + .48, x: X.l1 + W1 + 89, y: Y.l1 - 45 },                                                           // the ✓
      { t: L2.t0, x: X.l2, y: tipY(Y.l2, W2s), w: 1 }, { t: L2.t0 + L2.d, x: X.l2 + W2, y: tipY(Y.l2, W2s) },
      { t: L3.t0, x: X.l3, y: tipY(Y.l3, 46), w: 1 }, { t: L3.t0 + L3.d, x: X.l3 + W3, y: tipY(Y.l3, 46) },
      { t: pp0 + .35, x: 1150, y: 1180 }, { t: tr0 + .2, x: 1500, y: 1500 },             // the hand steps back while the stamp lands
      { t: L4.t0, x: X.l4a, y: tipY(Y.l4, 42), w: 1 }, { t: L4.t0 + L4.d, x: X.l4a + W4a, y: tipY(Y.l4, 42) },
      { t: L4b.t0, x: X.l4a + W4a, y: tipY(Y.l4, 46), w: 1 }, { t: L4b.t0 + L4b.d, x: X.l4a + W4a + W4b, y: tipY(Y.l4, 46) },
      { t: L5.t0, x: X.l5, y: tipY(Y.l5, 42), w: 1 }, { t: L5.t0 + L5.d, x: X.l5 + W5, y: tipY(Y.l5, 42) },
      { t: L6.t0, x: X.l6, y: tipY(Y.l6, 60), w: 1 }, { t: L6.t0 + L6.d, x: X.l6 + W6, y: tipY(Y.l6, 60) },
      { t: L7.t0, x: X.l7, y: tipY(Y.l7, W7s), w: 1 }, { t: L7.t0 + L7.d, x: X.l7 + W7, y: tipY(Y.l7, W7s) },
      { t: L8.t0, x: X.l8, y: tipY(Y.l8, 42), w: 1 }, { t: L8.t0 + L8.d, x: X.l8 + W8, y: tipY(Y.l8, 42) },
      { t: L8.t0 + L8.d + .7, x: 2330, y: 1480 },
    ];
    const PHONE = { x: 300, y: 1236, w: 240, rot: -.1 }, PRO = { x: 640, y: 1186, w: 230, rot: .07 };
    const CORNER = { x: 192, y: 1652, w: 228, rot: .06 };                                // low left, her hand visible under it
    let c10 = null;
    defineShot({ id: 'P10', t0: T10, img: 'bg/comptoir_dessus', seed: 10, free: true,
      cam: [{ t: T10, x: 452, y: 1160, z: 1.45 }, { t: pick0 - .05, x: 460, y: 1152, z: 1.46, e: 'lin' }, { t: pick1 + .3, x: 950, y: 836, z: 1.07 },
        { t: pp0, x: 958, y: 836, z: 1.08, e: 'lin' }, { t: pp1, x: 1150, y: 770, z: 1.3 }, { t: tr0, x: 1156, y: 770, z: 1.32, e: 'lin' },
        { t: tr1, x: 1950, y: 860, z: 1.05 }, { t: boat0 - .2, x: 1962, y: 860, z: 1.055, e: 'lin' }, { t: T11 + .6, x: 1957, y: 856, z: 1.055 }],
      stage(t, n, c) {
        c10 = c;
        counterTiles(c);
        // the kraft strip, taped to the counter
        kraftSheet((FR.x0 + FR.x1) / 2, (FR.y0 + FR.y1) / 2, FR.x1 - FR.x0, FR.y1 - FR.y0, { seed: 23, lift: 8 });
        ctx.fillStyle = 'rgba(243,167,69,.8)'; for (const [tx, ty, tr] of [[FR.x0 + 10, FR.y0 + 4, -.6], [FR.x1 - 10, FR.y0 + 4, .6], [(FR.x0 + FR.x1) / 2, FR.y0 - 2, .05]]) at(tx, ty, tr, 1, 1, () => ctx.fillRect(-46, -15, 92, 30));
        // title + timeline arrow + zones (already lettered by Mireille)
        const fT = fB(58), wT = measure('CHAQUE PAPIER A SON MOMENT', fT, 2);
        text('CHAQUE PAPIER A SON MOMENT', ZX1, 392, { font: fT, color: BD.ink, ls: 2 });
        inkLine(ZX1, 408, ZX1 + wT, 405, { w: 5, color: BD.orange, seed: 241 });
        arrowInk(ZX1 + wT + 34, 372, FR.x1 - 36, 372, { w: 5, color: BD.ink, seed: 242, head: 22 });
        for (const zx of [FR.z1, FR.z2]) { inkCircle(zx, 372, 9, { w: 3, fill: BD.amber, seed: 243 });
          for (let yy = 430; yy < 900; yy += 34) inkLine(zx, yy, zx, yy + 18, { w: 3, color: 'rgba(30,21,18,.55)', seed: 244 + yy }); }
        zoneTag(ZX1, 424, 'AVANT LE DÉPART', ZG); zoneTag(ZX2, 424, 'AU CHARGEMENT', ZA); zoneTag(ZX3, 424, "AVANT L'ARRIVÉE", ZB);
        // zone 1 — ① ② ③
        badge(1, ZX1 + BR, Y.l1 - 16, BR, t, L1.t0 - .05, ZG);
        WR('PROFORMA', X.l1, Y.l1, t, L1.t0, L1.d, { size: 46, fam: FF.bd });
        checkInk(X.l1 + W1 + 64, Y.l1 - 20, 44, t, L1.t0 + L1.d + .08, .4);
        badge(2, ZX1 + BR, Y.l2 - 16, BR, t, L2.t0 - .05, ZG);
        WR("DÉCLARATION D'IMPORTATION", X.l2, Y.l2, t, L2.t0, L2.d, { size: W2s, fam: FF.bd });
        sticky(t, lab2, X.l2, Y.lab2, 470, [[{ s: 'sur le Guichet unique,' }], [{ s: 'souvent par votre transitaire' }]], { lh: 44 });
        badge(3, ZX1 + BR, Y.l3 - 16, BR, t, L3.t0 - .05, ZG);
        WR('CONTRÔLE DE LA QUALITÉ', X.l3, Y.l3, t, L3.t0, L3.d, { size: 46, fam: FF.bd });
        sticky(t, lab3, X.l3, Y.lab3, 330, [[{ s: 'inspection ou essais' }]], { lh: 44, rot: .012 });
        // the green passport (Part 1) at the end of zone 1 — stamped « AVANT LE DÉPART ✓ » as the camera passes
        propPassport(PASS.x, PASS.y, PASS.w, { rot: PASS.rot, stamp: 'AVANT LE DÉPART ✓', stampK: clamp((t - stampP) / .14), lift: 12 });
        // zone 2 — ④
        badge(4, ZX2 + BR, Y.l4 - 15, BR, t, L4.t0 - .05, ZA);
        WR('le fournisseur ', X.l4a, Y.l4, t, L4.t0, L4.d, { size: 42 });
        WR('DÉPOSE', X.l4a + W4a, Y.l4, t, L4b.t0, L4b.d, { size: 46, fam: FF.bd });
        WR('la facture définitive', X.l5, Y.l5, t, L5.t0, L5.d, { size: 42 });
        sticky(t, lab4, ZX2, Y.lab4, 405, [[{ arrow: true }, { s: 'contrôle de ', size: 38 }, { s: 'LA VALEUR,', fam: FF.bd, size: 42, color: ZA }], [{ s: 'sur documents', size: 38 }]], { lh: 46 });
        if (t > lab4 + .1) { const k = clamp(spring(t - lab4 - .1, 14, .5), 0, 1.1); ctx.save(); ctx.translate(1720, 836); ctx.scale(k, k);
          paperSheet(0, 0, 96, 124, { rot: -.07, lift: 6, seed: 13 }, () => { for (let i = 0; i < 5; i++) inkLine(12, 20 + i * 18, 50 + hash(i) * 26, 20 + i * 18, { w: 2.2, color: '#7A6A5A', seed: 250 + i }); });
          loupe(30 + Math.sin(t * 1.8) * 10, 6 + Math.cos(t * 1.5) * 8, 30, .7); ctx.restore(); }
        // zone 3 — ⑤ the BESC, and the small boat
        badge(5, ZX3 + BR, Y.l6 - 18, BR, t, L6.t0 - .05, ZB);
        WR('BESC', X.l6, Y.l6, t, L6.t0, L6.d, { size: 60, fam: FF.bd, color: ZB });
        WR('au moins 2 jours avant', X.l7, Y.l7, t, L7.t0, L7.d, { size: W7s });
        WR("l'arrivée du bateau", X.l8, Y.l8, t, L8.t0, L8.d, { size: 42 });
        boat(2205, 818, .95, t, clamp((t - boat0) / .7));
        // the proforma, laid on the counter by Mireille's hand (raccord with P9)
        const dk = clamp((t - T10) / (land10 - T10)), ps = 1 + (1 - dk) * .18;
        ctx.save(); ctx.translate(PRO.x, PRO.y); ctx.scale(ps, ps); ctx.translate(-PRO.x, -PRO.y);
        proforma(PRO.x, PRO.y, PRO.w, { rot: PRO.rot, lift: 10 + (1 - dk) * 30, stampK: 1 }); ctx.restore();
        if (t < handOut + .6) { const ho = eInCubic(prog(t, handOut, handOut + .55));
          propHand(PRO.x + 40 + ho * 380, PRO.y + 70 + ho * 520, 1.2, { rot: -.3, pose: 'flat', arm: 900, lift: 10 }); }
        // Mireille's marker
        if (t > pen0 - .6) penHand(penAt(PK, t), t);
      },
      screen(t) {
        if (!c10) return;
        // Christelle's phone: lying on the counter (projected), then picked up into the lower-left corner
        const k = eInOutCubic(prog(t, pick0 - .02, pick1)), P = stageToScreen(c10, PHONE.x, PHONE.y), w0 = PHONE.w * c10.s;
        const x = lerp(P.x, CORNER.x, k), y = lerp(P.y, CORNER.y, k), w = lerp(w0, CORNER.w, k) * (1 + Math.sin(k * Math.PI) * .12), rot = lerp(PHONE.rot, CORNER.rot, k);
        const pose2 = t >= sw2, talkF = t > bF0 && t < bF1 ? 1 : 0;
        const ph = propPhone(x, y, w, { rot, lift: 12 + Math.sin(k * Math.PI) * 40, glow: 'rgba(255,236,170,.35)' }, (sw, sh) => callScreen(sw, sh, t, pose2, talkF));
        // her hand: reaches in from the lower left, grips the phone, stays with it
        const hIn = eOutCubic(prog(t, pick0 - .35, pick0 + .12));
        if (hIn > 0) { const s = w / 220, hx = x - Math.sin(rot) * ph.h * .6, hy = y + Math.cos(rot) * ph.h * .6;
          propHand(lerp(-160, hx, hIn), lerp(2100, hy, hIn), s, Object.assign({ rot: rot + .05, pose: 'flat', arm: 900, lift: 10 + Math.sin(k * Math.PI) * 30 }, CSLEEVE)); }
        // balloons: the supplier (from the phone screen), Christelle (off-screen, lower left), Mireille (off-screen, lower right)
        const mo = supplierHead(ph.sw, ph.sh, false), cr = Math.cos(rot), sr = Math.sin(rot), mx = mo[0] - ph.sw / 2, my = mo[1] - ph.sh / 2;
        const ms = { x: x + cr * mx - sr * my, y: y + sr * mx + cr * my };
        balloon(t, { t0: bF0, t1: bF1, text: 'Payé samedi ? Alors je charge lundi !', x: 770, y: 560, w: 470, size: 52, tail: [ms.x + 20, ms.y - 12], seed: 31 });
        balloon(t, { t0: bK0, t1: bK1, text: "Attends ! Les papiers d'abord.", x: 600, y: 1156, w: 760, size: 50, tail: [330, 1244], seed: 32, kind: 'shout' });
        balloon(t, { t0: bMi0, t1: bMi1, text: "Le BESC : deux jours avant l'arrivée !", x: 560, y: 1146, w: 640, size: 50, tail: [930, 1246], seed: 33 });
      } });
    addShake(land10, 4, .1); addShake(stampP, 13, .17);

    // =========================================== P11 · 25 % · INTERDIT ================================================
    const S12 = 'S12', S13 = 'S13';
    const cDrop = T11 + .12, cLand = cDrop + .34;
    const CS = { l1: Math.max(cLand + .1, tw(S12, 'déclaration', .1)), l2: tw(S12, 'rapport', -.1), l3: tw(S12, 'les', -.05), pct: tw(S12, '25', .04),
      l4: tw(S12, 'de', -.02, 2) };                                                    // nth 2: « déclaration » and « rapport de » also match « de »
    CS.d1 = Math.max(.7, te(S12, "d'importation") - CS.l1); CS.d2 = Math.max(.7, te(S12, 'valeur') - CS.l2); CS.d3 = Math.max(.6, te(S12, 'coûte') - CS.l3);
    CS.d4 = Math.max(.6, te(S12, 'taxable', -.2) - CS.l4); CS.l5 = CS.l4 + CS.d4 + .08; CS.d5 = .55;
    const cOut0 = Math.max(CS.l5 + CS.d5 + 1.2, ss(S13, -.3)), cOut1 = cOut0 + .55;      // the card slides away, the proforma shows
    const bo0 = tw(S12, 'les', -.4), bo1 = se(S12, .55);                                // Boris inset (top right)
    const bB0 = tw(S12, '25', .4), bB1 = Math.max(bB0 + 2, se(S12, .25));             // « Ékié ! Vingt-cinq pour cent ?! »
    const mi0 = ss(S13, -.3), mi1 = TEND - .45;                                          // Mireille inset (bottom left), nodding
    const leg0 = tw(S13, 'découper', -.1), leg1 = tw(S13, 'pour', -.05);                 // légende, two lines
    const sc0 = tw(S13, 'découper', .05), sc1 = sc0 + .9, cut1 = tw(S13, 'est', -.05);  // scissors: approach, then cut
    const stop = tw(S13, 'interdit', .03);                                               // stamp « INTERDIT »
    const PR11 = { x: 500, y: 838, w: 340, rot: -.05 };
    let c11 = null;
    defineShot({ id: 'P11', t0: T11, img: 'bg/comptoir_dessus', seed: 11, inT: .5, inKind: 'slide',
      cam: [{ t: T11, x: 500, y: 892, z: 1.0 }, { t: TEND, x: 500, y: 900, z: 1.06, e: 'lin' }],
      stage(t, n, c) {
        c11 = c;
        // the margouillat on the corner of the counter: throat puffed on « 25 % », push-ups on « interdit »
        propLizard(820, 1500, 1.7, t, { flip: true, phase: .8, puff: env(t, CS.pct, CS.pct + 2.4, .15, .4), pushAt: stop + .1, period: 4.4 });
        // the proforma (under the card), the scissors, the stamp
        const cutK = clamp((t - (sc1 - .05)) / (cut1 - sc1 + .05)) * .42;
        proforma(PR11.x, PR11.y, PR11.w, { rot: PR11.rot, lift: 10, stampK: 1, cut: t > sc1 ? cutK : 0 });
        if (t >= stop) { const k = clamp((t - stop) / .13), s = 1 + (1 - eOutCubic(k)) * .55;
          ctx.save(); ctx.translate(PR11.x + 6, PR11.y - 36); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 3);
          ctx.fillStyle = 'rgba(255,247,232,.84)'; ctx.beginPath(); ctx.arc(0, 0, 150, 0, 7); ctx.fill();
          bdStamp(0, 0, 162, 'INTERDIT', { color: BD.red, rot: -.2, size: 66, a: .96 }); ctx.restore(); }
        if (t > sc0 - .1 && t < stop + 1.4) {                       // scissors: from the right, snip into the sheet, recoil after the stamp
          const ca = Math.cos(PR11.rot), sa = Math.sin(PR11.rot), edge = PR11.w / 2;
          let tipX;                                                    // tip position along the sheet's mid-line (local x)
          if (t < sc1) tipX = lerp(edge + 520, edge + 6, eOutCubic(prog(t, sc0 - .1, sc1)));
          else if (t < stop) tipX = edge + 6 - (PR11.w * cutK);
          else tipX = lerp(edge + 6 - PR11.w * .42, edge + 620, eInCubic(prog(t, stop + .08, stop + 1.3))) + (t < stop + .25 ? Math.sin((t - stop) * 40) * 10 : 0);
          const open = t < sc1 ? .3 : t < stop ? .05 + .26 * (.5 + .5 * Math.cos((t - sc1) * Math.PI * 2 / .5)) : .34;
          const lx = tipX + 200 * 1.05, ly = 0;                         // pivot = tip + blade length
          ctx.save(); ctx.translate(PR11.x + ca * lx - sa * ly, PR11.y + sa * lx + ca * ly); ctx.rotate(PR11.rot); scissors(open, 1.05); ctx.restore();
        }
        // the warning card falls onto the counter, then slides away to the left
        if (t < cOut1) {
          const fk = clamp((t - cDrop) / (cLand - cDrop)), sq = t > cLand ? Math.exp(-(t - cLand) * 9) * Math.cos((t - cLand) * 38) * .03 : 0;
          const s = (1 + (1 - fk * fk) * .45) * (1 + sq), ok = eInCubic(prog(t, cOut0, cOut1));
          if (t >= cDrop) { ctx.save(); ctx.translate(500 - ok * 1150, 810 + ok * 40); ctx.rotate(-.025 - ok * .3 + (1 - fk) * .08); ctx.scale(s, s); ctx.globalAlpha *= clamp(fk * 4);
            warningCard(t, CS); ctx.restore(); }
        }
      },
      screen(t) {
        if (!c11) return;
        // légende above the proforma (S13)
        if (t >= leg0) { const k = clamp(spring(t - leg0, 15, .55), 0, 1.1);
          ctx.save(); ctx.translate(540, 470); ctx.scale(k, k); ctx.rotate(-.015);
          kraftSheet(0, 0, 900, 170, { seed: 61, lift: 12 }, () => {});
          WR('DÉCOUPER UNE COMMANDE', 0, -14, t, leg0 + .1, Math.max(.6, leg1 - leg0 - .2), { size: 56, fam: FF.bd, align: 'center' });
          WR('POUR PASSER SOUS LE SEUIL', 0, 52, t, leg1, Math.max(.7, te(S13, 'seuil') - leg1), { size: 56, fam: FF.bd, align: 'center' });
          ctx.restore(); }
        // Boris (B3, round eyes) — inset top right during S12, his balloon right after « 25 % »
        const RB = { x: 700, y: 262, w: 330, h: 320, rot: .02 };
        const bt = t > bB0 && t < bB1 ? 1 : 0, bOpt = { t, phase: PHB, grade: GRADE.shade, talk: bt, hop: CS.pct + .1 };
        let bm = null, bTop = null;
        const cb = inset(t, bo0, bo1, RB, 'bg/etal_meches', { x: 512, y: GY - HB * .85, z: 3.8 }, 41, (pc) => {
          drawPuppet(K('boris', 3), 500, GY, HB, bOpt);
          bm = pupAt(K('boris', 3), 500, GY, HB, bOpt, { mouth: true }, [.02, .15]); bTop = { x: 500, y: GY - HB };
        });
        if (cb && bm) { const p = pScr(cb, bm), f = pScr(cb, { x: bm.x, y: bm.y - HB * .045 });
          surprise(t, CS.pct + .08, f.x, f.y, HB * cb.s * cb.k);     // B3 smiles in the picture: the shock is drawn over the frame (lines, sweat drop)
          balloon(t, { t0: bB0, t1: bB1, text: 'Ékié ! Vingt-cinq pour cent ?!', x: 400, y: 418, w: 470, size: 52, tail: [Math.min(p.x, RB.x + 30), clamp(p.y, RB.y + 40, RB.y + RB.h - 40)], seed: 34, kind: 'shout' }); }
        // Tantine Mireille (M1, the exercise book against her chest) — inset bottom left during S13, nodding
        const RM = { x: 60, y: 1474, w: 330, h: 400, rot: -.02 };
        const nod = Math.sin((t - mi0) * Math.PI * 2 / .85) * .075 * env(t, mi0 + .3, mi1, .3, .3) + (t > stop && t < stop + .5 ? Math.sin((t - stop) / .5 * Math.PI) * .07 : 0);
        inset(t, mi0, mi1, RM, 'bg/etal_meches', { x: 486, y: GY - HM * .8, z: 4.0 }, 43, () => {
          drawPuppet(K('mireille', 1), 480, GY, HM, { t, phase: PHM, grade: MORNING, rot: { head: nod } });
        });
      } });
    addShake(cLand, 9, .14); addShake(CS.pct, 8, .12); addShake(stop, 16, .2);
  });
})();

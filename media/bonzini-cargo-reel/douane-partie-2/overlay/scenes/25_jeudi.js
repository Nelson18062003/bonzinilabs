// =============================================================================================================
// P15 – P17 · JEUDI (S18 – S19) — « ④ LE TRANSITAIRE » : le sketch du Roi du forfait
//   P15  bg/rue (la rue du marché, parasols jaunes) : travelling latéral gauche → droite au pas du trio — Boris B5 mène,
//        carton sous le bras (« J'ai un gars. Rapide, pas cher ! »), Christelle C5 et Junior J5 marchent derrière, de
//        profil ; pieds verrouillés au sol (la jambe d'appui ne glisse pas) ; cartouche JEUDI + onglet ④ LE TRANSITAIRE.
//   P16  bg/roi_forfait (la même rue vue de l'autre trottoir) : le « bureau » du Roi DESSINÉ par nous — grand parasol rayé
//        délavé, enseigne peinte « TRANSIT & DOUANE · TOUT · RAPIDE » clouée au mât et sur un poteau, table pliante avec
//        son fouillis de téléphones, chaise en plastique — le Roi R1 (téléphone levé), Boris B1 fier un pas en retrait,
//        Christelle C1 (mains sur les hanches) ; cartouche « LE ROI DU FORFAIT » ; ses deux bulles dans le silence ;
//        sur « découpe », le tampon rouge « INTERDIT » de mardi flashe 0,5 s.
//   P17  même décor : Christelle C2 « Ton agrément, il est où ? » → le Roi R1 « C'est écrit sur l'enseigne ! » ;
//        sur la voix, panoramique vers l'enseigne : le tampon « UN NOM ≠ UN AGRÉMENT » s'y imprime (le Roi se dégonfle :
//        R3 bras ballants, goutte de sueur ; Boris penaud), puis « · non agréé » s'écrit sous son nom ; retour :
//        Christelle « Non merci. Un devis écrit, ligne par ligne. », le Roi R4 hausse les épaules puis sort à droite en
//        marchant (R2, profil, téléphone à la main) : « Allô ? Allô ? ».
// Everything is wrapped in an IIFE (all scene files share one global scope). Times come from the voice timeline only.
// =============================================================================================================
(() => {
  'use strict';
  const K = (who, n) => `cast/${who}_${n}`, has = k => !!img(k);
  const PHC = 0, PHJ = 2.1, PHB = 5.7, PHR = 3.9;                  // breathing phases (Christelle, Junior, Boris as on the other days)
  // light: a sunny Thursday in the market street (sun from the left in bg/rue, from the right in its mirror bg/roi_forfait);
  // the characters a step back are a touch dimmer; the Roi stands in the shade of his parasol
  const STREET = { mul: '#F3E8D8', tint: '#FFD69C', tintA: .07, rim: '#FFE4AA', rimA: .26, rimSide: 'left' };
  const STREET_B = { mul: '#E4D9C8', tint: '#FFD69C', tintA: .07, rim: '#FFE4AA', rimA: .15, rimSide: 'left' };
  const SUN = { mul: '#F1E6D6', tint: '#FFD69C', tintA: .07, rim: '#FFE6B0', rimA: .3, rimSide: 'right' };
  const SUN_B = { mul: '#E1D5C4', tint: '#FFD69C', tintA: .07, rim: '#FFE6B0', rimA: .17, rimSide: 'right' };
  const UMBRA = { mul: '#E3D6C6', tint: '#FFB36B', tintA: .07, rim: '#FFD9A0', rimA: .18, rimSide: 'right' };
  const VIO = '#6A22C9';

  // ---------- scale (stage units: the street pictures are 1000 wide, 1780 tall) ---------------------------------------
  // Both pictures (bg/rue and its mirror bg/roi_forfait) are drawn from above eye level: the passers-by shrink toward the
  // vanishing point (horizon ≈ y 930). Measured on them: the man in blue, feet ≈ 1680, ≈ 390 tall; the woman in orange,
  // feet ≈ 1460, ≈ 270 tall. A standing figure with its feet at y is HP(y) tall (5 % generous: our cast is a step nearer).
  // Relative heights: Junior 1 · Christelle .98 · Boris .96 · Roi 1.
  const HP = (y, rel = 1) => .55 * (y - 930) * rel;
  /** drawn height of picture `key` when the character's standing picture `ref` is h tall (one pixel scale per character) */
  const hFor = (key, ref, h) => (RIGS[key] && RIGS[ref] ? h * RIGS[key].h / RIGS[ref].h : h);

  // P15 · the trio crosses the pavement left → right: Junior a step back (higher, smaller, dimmer), Boris leading, nearest
  const WALK = { v: 146, jun: { x: 155, y: 1726 }, chr: { x: 330, y: 1740 }, bor: { x: 505, y: 1750 } };
  // P16/P17 · the Roi's roadside « bureau », drawn on bg/roi_forfait (right of the pavement, on the sand)
  const CHR = { x: 470, y: 1748 }, BOR = { x: 566, y: 1690 }, ROI = { x: 682, y: 1742 };
  const HC = HP(CHR.y, .98), HB = HP(BOR.y, .96), HR = HP(ROI.y, 1);
  const TABLE = { x0: 768, x1: 916, top: 1535, back: 1497, foot: 1730, footB: 1702 };   // small folding table (top seen from above)
  const CHAIR = { x: 944, y: 1688 };                                                      // plastic chair behind the table
  const PARA = { x: 936, ground: 1703, ax: 898, ay: 928, r: 270 };   // the pole leans a little: the canopy shades the Roi                        // parasol: foot of the pole, apex, radius
  const SIGN = { x: 868, y: 1236, w: 250, rot: -.018, post: 754, ground: 1700 };          // painted board (centre), its post
  const SK = SIGN.w / 412, SH = 206 * SK;                                                 // the board is designed 412 × 206
  // Boris' box: top edge of its front face, measured on the pictures (rig px) — the tag « PAS AVANT SAMEDI » hangs from it
  const BOXPIN = { 'cast/boris_1': [346, 420], 'cast/boris_3': [350, 417], 'cast/boris_5': [360, 410] };

  // ---------- puppet helpers (same formulas as drawPuppet, so marks, tags and balloon tails follow the figures) --------
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
  /** stage point of an image point p (rig px): carried by bone `bone`, or (no bone) blended exactly like the mesh around it */
  const _near = {};
  function pupPt(key, x, y, h, o, p, bone) {
    const R = RIGS[key], dir = o.flip ? -1 : 1; if (!R) return { x, y: y - h * .8 };
    const M = boneMats(R, pupRot(R, o), o.off || {}), L = pupLift(o), s = h / R.h, mesh = PUP.meshes[key];
    let q;
    if (!bone && mesh) {
      const ck = key + ':' + p.join(','); let i = _near[ck];
      if (i == null) { let best = 1e12; mesh.V.forEach((v, j) => { const d = (v[0] - p[0]) ** 2 + (v[1] - p[1]) ** 2; if (d < best) { best = d; i = j; } }); _near[ck] = i; }
      q = [0, 0]; for (const { k, w } of mesh.W[i]) { const r = aff.ap(M[R.bones[k].n], p); q[0] += r[0] * w; q[1] += r[1] * w; }
    } else q = aff.ap(M[bone || 'chest'], p);
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce) };
  }
  /** mouth (stage units) — fb = fallback [dx, dy] in units of h while a picture or its rig is missing */
  function mouthOf(key, x, y, h, o, fb = [.02, .12]) {
    const R = RIGS[key];
    if (!R || !R.face) return { x: x + (o.flip ? -1 : 1) * fb[0] * h, y: y - h + fb[1] * h };
    return pupPt(key, x, y, h, o, R.face.mouth, R.face.bone || 'head');
  }
  /** a point beside the head (temple), for sweat drops and shock lines: side = +1 image right, -1 image left */
  function templeOf(key, x, y, h, o, side = 1) {
    const R = RIGS[key]; if (!R || !R.face) return { x, y: y - h * .9 };
    const [e0, e1] = R.face.eyes, ex = side > 0 ? Math.max(e0[0], e1[0]) : Math.min(e0[0], e1[0]);
    return pupPt(key, x, y, h, o, [ex + side * (R.face.jawW || 20) * 1.5, (e0[1] + e1[1]) / 2 - (R.face.eyeR || 8) * 2.2], R.face.bone || 'head');
  }
  /** rig px by which the lowest ankle rose above the picture's own ground (walk / rotations): pushed back down when drawn */
  const _bones = {};
  const boneOf = (R, n) => (_bones[R.w + ':' + R.h + n] ??= R.bones.find(b => b.n === n));
  function footLift(key, o) {
    const R = RIGS[key]; if (!R) return 0;
    const sL = boneOf(R, 'shinL'), sR = boneOf(R, 'shinR'); if (!sL || !sR) return 0;
    const M = boneMats(R, pupRot(R, o), o.off || {});
    return Math.max(sL.b[1], sR.b[1]) - Math.max(aff.ap(M.shinL, sL.b)[1], aff.ap(M.shinR, sR.b)[1]);
  }
  function legLen(R) {
    const d = n => { const b = boneOf(R, n); return b ? Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) : 0; };
    return (d('legL') + d('shinL') + d('legR') + d('shinR')) / 2 || R.h * .45;
  }
  /** walk rotations locked to the distance travelled: the stance foot moves back exactly as fast as the body goes on
   *  (stride per cycle = 1.36 · A · leg · cos(leg angle)); the knee bends during the swing of each leg */
  function walkRot(key, dist, h, A, o = {}) {
    const R = RIGS[key]; if (!R) return {};
    const stride = 1.36 * A * legLen(R) * .95 * h / R.h, wp = dist / stride * Math.PI * 2 + (o.ph0 || 0);
    const s = Math.sin(wp), c = Math.cos(wp);
    return { legL: s * .34 * A, legR: -s * .34 * A, shinL: Math.max(0, -c) * .5 * A, shinR: Math.max(0, c) * .5 * A,
      armL_up: -s * .28 * A * (o.armL ?? 1), armR_up: s * .28 * A * (o.armR ?? 1), chest: .03 * A, _wp: wp };
  }
  function addRot(a, b) { const r = Object.assign({}, a); for (const k in b || {}) r[k] = (r[k] || 0) + b[k]; delete r._wp; return r; }
  function shadowAt(x, y, w, h, a = 1) {
    ctx.save(); ctx.globalAlpha *= a * .9; ctx.fillStyle = BD.shadow; ctx.beginPath(); ctx.ellipse(x, y - h * .005, w * .36, h * .028, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  /** a walking figure: distance-locked legs, feet kept on the ground line y, its own contact shadow; returns the draw options */
  function walker(key, x, y, h, dist, A, o, wo = {}) {
    const R = RIGS[key], wr = walkRot(key, dist, h, A, wo), oo = Object.assign({}, o, { rot: addRot(wr, o.rot), shadow: false });
    const s = R ? h / R.h : 1, dy = footLift(key, oo) * s - (wo.bob ? Math.abs(Math.sin(wr._wp || 0)) * wo.bob * h : 0);
    if (R) shadowAt(x, y, R.w * s, h, o.a ?? 1);
    drawPuppet(key, x, y + dy, h, oo);
    return Object.assign(oo, { x, y: y + dy, h, key });
  }
  /** pose change: the new pose under, the old one fading out on top + a little squash at the feet (heights per picture) */
  function pupSwitch(a, b, ts, x, y, ha, hb, o, fade = .16) {
    const t = o.t;
    if (t < ts) { drawPuppet(a, x, y, ha, o); return; }
    const u = t - ts, pop = u < .18 ? Math.sin(u / .18 * Math.PI) : 0;
    ctx.save(); if (pop) { ctx.translate(x, y); ctx.scale(1 + .02 * pop, 1 - .03 * pop); ctx.translate(-x, -y); }
    drawPuppet(b, x, y, hb, o);
    const k = clamp(u / fade); if (k < 1) drawPuppet(a, x, y, ha, Object.assign({}, o, { a: (o.a ?? 1) * (1 - k), shadow: false }));
    ctx.restore();
  }
  /** pose track [[t, key], …]: draws the pose of time t (cross-fade on a change); hOf(key) gives each picture's height */
  function trackKey(keys, t) { let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++; return i; }
  function drawTrack(keys, x, y, hOf, o) {
    const i = trackKey(keys, o.t), [ts, key] = keys[i];
    if (i > 0 && o.t - ts < .2) pupSwitch(keys[i - 1][1], key, ts, x, y, hOf(keys[i - 1][1]), hOf(key), o); else drawPuppet(key, x, y, hOf(key), o);
    return key;
  }
  /** the tag « PAS AVANT SAMEDI » hanging from the top edge of the box Boris carries (follows the mesh around the box) */
  function borisTag(t, key, x, y, h, o, side = .012) {
    const pin = BOXPIN[key]; if (!pin || !RIGS[key]) return;
    const q = pupPt(key, x, y, h, o, pin), s = h / 1080, th = 58 * s, cx = q.x - (o.flip ? -1 : 1) * side * h, cy = q.y + th * 1.25;
    inkLine(q.x, q.y, cx, cy - th * .9, { w: 2, color: '#6B4A2A', seed: 63 });
    propTag(cx, cy, s, 'PAS AVANT SAMEDI', { t: t + (o.phase || 0) });
  }
  /** balloon tail: aims at the mouth but stops above the head (never on the face) */
  const tailAbove = (m, topY, dx = 0) => [m.x + dx, Math.min(m.y - 16, topY - 10)];
  const scr = (c, p) => stageToScreen(c, p.x, p.y);

  // ---------- BD marks (the pictures are limited: emotion is drawn over them) ------------------------------------------
  /** sweat drop (light blue, ink outline) that slides a little; k 0..1 over its life */
  function sweatDrop(x, y, s, k) {
    if (k <= 0 || k >= 1) return; ctx.save(); ctx.translate(x, y + k * 10 * s); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 5) * clamp((1 - k) * 4);
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.bezierCurveTo(7, -4, 10, 4, 0, 10); ctx.bezierCurveTo(-10, 4, -7, -4, 0, -16); ctx.closePath();
    ctx.fillStyle = '#BFE6FF'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(-2.5, 1, 2, 3.5, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  /** surprise lines: short radiating ink strokes above a head (x, y = head centre, r = radius), k grows them, a fades them */
  function surprise(x, y, r, k, a, seed = 1, n = 5) {
    if (k <= 0 || a <= 0) return; ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < n; i++) { const an = -Math.PI * (.12 + .76 * i / (n - 1)), r0 = r * (1 + .08 * hash(seed + i)), L = r * (.42 + .12 * hash(i + seed * 3)) * eOutCubic(clamp(k));
      inkLine(x + Math.cos(an) * r0, y + Math.sin(an) * r0, x + Math.cos(an) * (r0 + L), y + Math.sin(an) * (r0 + L), { w: Math.max(3.4, r * .085), seed: seed + i, step: 30 }); }
    ctx.restore();
  }
  /** shrug marks: short strokes springing up from a shoulder (x, y), dir = +1 to the image right; k 0..1 over their life */
  function shrugMarks(x, y, dir, s, k) {
    if (k <= 0 || k >= 1) return; const a = clamp(k * 5) * clamp((1 - k) * 3), up = eOutCubic(clamp(k * 1.6)) * 8 * s;
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < 3; i++) { const an = -Math.PI / 2 + dir * (.25 + i * .38), r0 = 10 * s + up, r1 = r0 + (13 - i * 2) * s;
      inkLine(x + Math.cos(an) * r0, y + Math.sin(an) * r0, x + Math.cos(an) * r1, y + Math.sin(an) * r1, { w: 3, seed: 340 + i, step: 20, wob: .4 }); }
    ctx.restore();
  }

  // ---------- the Roi's roadside office (BD style: ink outlines, flat colours) -----------------------------------------
  const ell = (x, y, rx, ry, fill) => { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); ctx.restore(); };
  const inkEll = (x, y, rx, ry, o = {}) => inkPath(Array.from({ length: 25 }, (_, i) => [x + Math.cos(i / 24 * Math.PI * 2) * rx, y + Math.sin(i / 24 * Math.PI * 2) * ry]), o);
  /** filled polygon + ink outline */
  function poly(P, fill, o = {}) {
    ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); P.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.restore();
    if (o.ink !== false) inkPath(P.concat([P[0]]), { w: o.w ?? 2.4, seed: o.seed ?? 1, wob: o.wob ?? .8 });
  }
  /** a tube (metal leg, pole): colour body + two ink edges */
  function tube(x0, y0, x1, y1, w, col, seed) {
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore();
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L * w / 2, ny = (x1 - x0) / L * w / 2;
    inkLine(x0 + nx, y0 + ny, x1 + nx, y1 + ny, { w: 1.7, seed, step: 26, wob: .6 }); inkLine(x0 - nx, y0 - ny, x1 - nx, y1 - ny, { w: 1.4, seed: seed + 1, step: 26, wob: .6 });
  }
  /** the soft round shade of the parasol on the sand (drawn first) */
  function parasolShade() {
    ctx.save(); const g = ctx.createRadialGradient(PARA.x - 90, PARA.ground + 14, 20, PARA.x - 90, PARA.ground + 14, 280);
    g.addColorStop(0, 'rgba(60,30,10,.24)'); g.addColorStop(1, 'rgba(60,30,10,0)'); ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(PARA.x - 90, PARA.ground + 14, 270, 60, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  /** the parasol's pole, planted in an old tyre filled with cement */
  function parasolPole() {
    const { x, ground, ax, ay } = PARA;
    ell(x, ground, 40, 13, '#2B2624'); inkEll(x, ground, 40, 13, { w: 2.2, seed: 360 });
    ell(x, ground - 4, 26, 8, '#A39C92'); inkEll(x, ground - 4, 26, 8, { w: 1.6, seed: 361 });
    tube(x, ground - 4, ax, ay + 30, 9, '#8E8A86', 362);
  }
  /** the big striped parasol, sun-bleached, seen from a little below; it sways gently in the breeze */
  function parasolCanopy(t) {
    const { ax, ay, r } = PARA, k = r / 262, sway = Math.sin(t * .9) * .01 + Math.sin(t * 2.3 + 1) * .004;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(sway); ctx.scale(k, k);
    const N = 8, rimY = 150, dip = 46, rim = i => { const a = Math.PI * (1 - i / N); return [Math.cos(a) * 262, rimY + Math.sin(a) * dip]; };
    const A = '#D88F6C', B = '#EEE3CB';                                                    // faded terracotta / cream
    for (let i = 0; i < N; i++) {
      const [x0, y0] = rim(i), [x1, y1] = rim(i + 1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 22;
      ctx.fillStyle = i % 2 ? B : A;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.closePath(); ctx.fill();
      const g = ctx.createLinearGradient(0, 0, 0, rimY + dip); g.addColorStop(0, 'rgba(255,250,235,.16)'); g.addColorStop(1, 'rgba(90,40,15,.18)');
      ctx.fillStyle = g; ctx.fill();
      // sun bleaching: a few pale blotches on the coloured panels
      if (!(i % 2)) { ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,240,215,.22)';
        for (let b = 0; b < 3; b++) { const u = .35 + hash(i * 7 + b) * .5; ctx.beginPath(); ctx.ellipse(mx * u, my * u, 18 + hash(i + b * 3) * 22, 9, hash(b) * 2, 0, 7); ctx.fill(); }
        ctx.restore(); }
      inkPath(Array.from({ length: 9 }, (_, q) => { const u = q / 8; return [(1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1]; }), { w: 3.2, seed: 210 + i });
      inkLine(0, -4, x0, y0, { w: 2.6, seed: 220 + i, step: 30 });
    }
    inkLine(0, -4, rim(N)[0], rim(N)[1], { w: 2.6, seed: 229, step: 30 });
    for (let i = 0; i < N; i++) {                                                          // fringe of little flaps under the rim
      const [x0, y0] = rim(i), [x1, y1] = rim(i + 1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 22, fl = Math.sin(t * 3.1 + i) * 2.4;
      ctx.fillStyle = i % 2 ? A : B;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.lineTo(x1, y1 + 16 + fl); ctx.quadraticCurveTo(mx, my + 20 + fl, x0, y0 + 16 + fl); ctx.closePath(); ctx.fill();
      inkPath(Array.from({ length: 9 }, (_, q) => { const u = q / 8; return [(1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, (1 - u) * (1 - u) * (y0 + 16) + 2 * u * (1 - u) * (my + 20) + u * u * (y1 + 16) + fl]; }), { w: 2.2, seed: 240 + i });
    }
    inkCircle(0, -12, 9, { w: 2.5, fill: '#4A3B33', seed: 250 });
    ctx.restore();
  }
  /** monobloc plastic chair (sun-faded red), behind the table: its backrest and right side show beside the table top */
  function plasticChair() {
    const { x, y } = CHAIR, col = '#C95A4C', dk = '#A2443A', lt = '#E07F70';
    tube(x - 30, y - 126, x - 36, y - 14, 8, dk, 370); tube(x + 30, y - 126, x + 36, y - 14, 8, dk, 371);          // back legs
    // backrest: wider at the top, arched top edge, three slots
    const top = y - 236, bot = y - 124, arch = (u) => top - Math.sin(u * Math.PI) * 10;
    const P = [[x - 36, bot]].concat(Array.from({ length: 9 }, (_, i) => { const u = i / 8; return [x - 44 + u * 88, arch(u)]; }), [[x + 36, bot]]);
    poly(P, col, { seed: 372, w: 2.6 });
    for (let i = 0; i < 3; i++) { const yy = top + 22 + i * 21, hw = 28 - i * 2; poly([[x - hw, yy], [x + hw, yy], [x + hw - 2, yy + 10], [x - hw + 2, yy + 10]], '#7A2E27', { w: 1.6, seed: 373 + i }); }
    ctx.save(); ctx.fillStyle = 'rgba(255,220,200,.25)'; ctx.fillRect(x - 38, top + 6, 10, 92); ctx.restore();       // sheen
    // seat and its rounded front lip
    poly([[x - 40, bot - 2], [x + 40, bot - 2], [x + 48, y - 106], [x - 48, y - 106]], lt, { seed: 376, w: 2.4 });
    poly([[x - 48, y - 106], [x + 48, y - 106], [x + 47, y - 97], [x - 47, y - 97]], dk, { seed: 377, w: 2 });
    // armrests curving from the backrest down to the front legs
    for (const d of [-1, 1]) inkPath([[x + d * 42, top + 70], [x + d * 52, top + 82], [x + d * 54, y - 112]], { w: 7, color: col, seed: 378 + d, wob: .3 });
    for (const d of [-1, 1]) inkPath([[x + d * 42, top + 70], [x + d * 52, top + 82], [x + d * 54, y - 112]], { w: 2, seed: 380 + d, wob: .3 });
    tube(x - 44, y - 100, x - 50, y, 8, col, 382); tube(x + 44, y - 100, x + 50, y, 8, col, 383);                    // front legs
    ell(x, y + 2, 58, 9, 'rgba(45,22,8,.18)');
  }
  /** the wooden post (left) and the painted board nailed between it and the parasol's pole; stampT prints the violet stamp */
  function roiSign(t, stampT) {
    const { x, y, rot, post, ground } = SIGN, top = y - SH / 2;
    tube(post, top + 18, post + 3, ground, 13, '#8A5C34', 380);                       // the post, planted in the sand
    ell(post + 3, ground, 14, 5, 'rgba(60,30,10,.3)');
    // the board (designed at 412 × 206, scaled)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot + Math.sin(t * 1.3) * .004); ctx.scale(SK, SK);
    const w = 412, h = 206;
    withShadow(6, () => { ctx.fillStyle = '#F3D27C'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();                 // planks + grain
    for (let k = 0; k < 3; k++) { const yy = -h / 2 + (k + 1) * h / 3; inkLine(-w / 2, yy, w / 2, yy + 2, { w: 2, color: 'rgba(120,70,20,.45)', seed: 260 + k, step: 26 }); }
    for (let i = 0; i < 26; i++) { const gx = -w / 2 + hash(i * 2.3) * w, gy = -h / 2 + hash(i * 4.1) * h, L = 30 + hash(i * 1.7) * 70;
      inkLine(gx, gy, gx + L, gy + (hash(i) - .5) * 4, { w: 1.4, color: 'rgba(150,95,35,.28)', seed: 270 + i, step: 20 }); }
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(120,60,10,.14)'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    inkRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, { w: 7, color: '#C8202F', seed: 280, wob: 2.2 });      // painted red border
    const s1 = fitSize('TRANSIT & DOUANE', FF.bd, 70, w - 100, 2), s2 = fitSize('TOUT · RAPIDE', FF.bd, 80, w - 120, 3);
    painted('TRANSIT & DOUANE', 0, -h / 2 + 104, s1, '#1C3E8C', { seed: 1 });
    painted('TOUT · RAPIDE', 0, -h / 2 + 196 - 10, s2, '#C8202F', { seed: 2, ls: 3 });
    const rx = measure('TOUT · RAPIDE', font(FF.bd, s2, 400), 3) / 2 + 12;                 // speed lines: it is a sign that boasts
    for (let k = 0; k < 3; k++) inkLine(rx, -h / 2 + 150 + k * 16, rx + 26 - k * 6, -h / 2 + 150 + k * 16, { w: 4, color: '#C8202F', seed: 290 + k });
    inkRect(-w / 2, -h / 2, w, h, { w: 4, seed: 285 });
    for (const [nx, ny] of [[-w / 2 + 12, -h / 2 + 12], [w / 2 - 12, -h / 2 + 12], [-w / 2 + 12, h / 2 - 12], [w / 2 - 12, h / 2 - 12]]) inkCircle(nx, ny, 5, { w: 2, fill: '#5B5650', seed: 295 });
    // wire lashings around the parasol pole (right end of the board)
    const px = (PARA.x + (PARA.ax - PARA.x) * ((PARA.ground - y) / (PARA.ground - PARA.ay)) - x) / SK;
    for (const ly of [-h / 2 + 30, h / 2 - 34]) for (let k = 0; k < 3; k++) inkLine(px - 14, ly + k * 7, px + 14, ly + k * 7 + 4, { w: 3, color: '#5A5550', seed: 300 + k });
    // the stamp prints across the board: violet box, big scale → 1, a small bounce
    if (stampT != null && t >= stampT) {
      const k = clamp((t - stampT) / .12), s = 1 + (1 - eOutCubic(k)) * .5, a = clamp(k * 3);
      ctx.save(); ctx.translate(6, 58); ctx.rotate(-.075); ctx.scale(s, s); ctx.globalAlpha *= a * .96;
      const bw = w * .92, bh = 96;
      ctx.fillStyle = 'rgba(255,250,240,.58)'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      inkRect(-bw / 2, -bh / 2, bw, bh, { w: 7, color: VIO, seed: 310, wob: 1.4 });
      inkRect(-bw / 2 + 9, -bh / 2 + 9, bw - 18, bh - 18, { w: 2.5, color: VIO, seed: 311, wob: 1 });
      neqLine(0, 22, fitSize('UN NOM  =  UN AGRÉMENT', FF.bd, 62, bw - 56, 2), VIO);
      ctx.restore();
    }
    ctx.restore();
  }
  /** the small folding table: metal X legs, a worn green plank top, and the Roi's clutter (second phone on a stand,
   *  a phone face down, power bank and tangled chargers, a receipt pad, a pen) */
  function foldTable(t) {
    const T = TABLE, bx0 = T.x0 + 12, bx1 = T.x1 - 8, ap = 9;
    ell((T.x0 + T.x1) / 2 + 8, T.foot - 4, 96, 15, 'rgba(45,22,8,.2)');
    tube(bx0 + 6, T.back + 6, bx1 - 10, T.footB, 5, '#7C8287', 390); tube(bx1 - 6, T.back + 6, bx0 + 10, T.footB, 5, '#7C8287', 392);
    poly([[T.x0, T.top], [T.x1, T.top], [T.x1, T.top + ap], [T.x0, T.top + ap]], '#3F6650', { seed: 394 });                // apron
    poly([[T.x0, T.top], [T.x1, T.top], [bx1, T.back], [bx0, T.back]], '#5F9070', { seed: 395 });                         // top
    for (let i = 1; i < 4; i++) { const u = i / 4; inkLine(lerp(T.x0, bx0, u), lerp(T.top, T.back, u), lerp(T.x1, bx1, u), lerp(T.top, T.back, u), { w: 1.3, color: 'rgba(25,45,30,.5)', seed: 396 + i, step: 24 }); }
    ctx.save(); ctx.fillStyle = 'rgba(240,230,200,.18)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(T.x0 + 20 + hash(i * 3.3) * 110, T.back + 8 + hash(i * 5.1) * 26, 9, 3, 0, 0, 7); ctx.fill(); } ctx.restore();
    tube(T.x0 + 8, T.top + ap, T.x1 - 14, T.foot, 5.5, '#8A9095', 400); tube(T.x1 - 8, T.top + ap, T.x0 + 14, T.foot, 5.5, '#8A9095', 402);
    // clutter (on the top, back to front)
    const mid = (T.top + T.back) / 2;
    poly([[T.x0 + 92, mid - 8], [T.x0 + 126, mid - 8], [T.x0 + 122, mid + 6], [T.x0 + 88, mid + 6]], '#F7F2E6', { w: 1.6, seed: 404 });   // receipt pad
    inkLine(T.x0 + 94, mid - 3, T.x0 + 118, mid - 3, { w: 1.4, color: '#C8202F', seed: 405 });
    tube(T.x0 + 96, mid + 10, T.x0 + 128, mid + 3, 3, '#2C5BB8', 406);                                                  // pen
    poly([[T.x0 + 46, mid + 2], [T.x0 + 78, mid + 2], [T.x0 + 76, mid + 13], [T.x0 + 44, mid + 13]], '#26252B', { w: 1.6, seed: 408 });  // phone, face down
    poly([[T.x0 + 18, mid - 6], [T.x0 + 38, mid - 6], [T.x0 + 37, mid + 4], [T.x0 + 17, mid + 4]], '#5E6670', { w: 1.6, seed: 409 });     // power bank
    inkPath(Array.from({ length: 14 }, (_, i) => { const u = i / 13; return [T.x0 + 36 + u * 46 + Math.sin(u * 9) * 5, mid + 2 + Math.sin(u * 7 + 1) * 6 + u * 12]; }), { w: 2.2, seed: 410, wob: .4 });
    inkPath(Array.from({ length: 12 }, (_, i) => { const u = i / 11; return [T.x0 + 30 + u * 20 + Math.cos(u * 8) * 6, mid + 4 + u * 22 + Math.sin(u * 6) * 4]; }), { w: 2.2, seed: 411, wob: .4 });   // a cable hangs over the edge
    // the second phone on a little stand, screen lit (no text, no brand)
    const px = T.x0 + 60, py = mid - 6, gl = .55 + .25 * Math.sin(t * 2.2);
    poly([[px - 8, py + 2], [px + 8, py + 2], [px + 6, py - 6], [px - 6, py - 6]], '#3A3940', { w: 1.4, seed: 412 });
    ctx.save(); ctx.translate(px, py - 4); ctx.rotate(-.12);
    rrect(-10, -36, 20, 36, 3); ctx.fillStyle = '#1F1D24'; ctx.fill(); rrect(-8, -34, 16, 31, 2); ctx.fillStyle = `rgba(150,215,255,${gl})`; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 3; i++) ctx.fillRect(-5, -29 + i * 8, 10 - i * 2, 3);
    ctx.lineWidth = 2; ctx.strokeStyle = BD.ink; rrect(-10, -36, 20, 36, 3); ctx.stroke(); ctx.restore();
  }
  /** fit a Bangers size to a width */
  function fitSize(txt, fam, size, maxW, ls = 0) { let s = size; while (s > 10 && measure(txt, font(fam, s, 400), ls) > maxW) s -= .5; return s; }
  /** text with a hand-painted look: a darker offset under-stroke, slightly uneven baseline */
  function painted(txt, x, y, size, color, o = {}) {
    const f = font(FF.bd, size, 400), ls = o.ls ?? 2, w = measure(txt, f, ls);
    let cx = x - w / 2;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i], cw = measure(ch, f, ls), dy = (hash(i * 3.7 + (o.seed || 0)) - .5) * size * .06, rr = (hash(i * 5.1 + (o.seed || 0)) - .5) * .05;
      ctx.save(); ctx.translate(cx + cw / 2, y + dy); ctx.rotate(rr);
      text(ch, 2.5, 3, { font: f, align: 'center', color: 'rgba(40,20,10,.35)' });
      text(ch, 0, 0, { font: f, align: 'center', color });
      ctx.restore(); cx += cw;
    }
  }
  /** « UN NOM ≠ UN AGRÉMENT » (the ≠ is inked by hand: the lettering font has no such glyph) */
  function neqLine(x, y, size, color) {
    const f = font(FF.bd, size, 400), a = 'UN NOM', b = 'UN AGRÉMENT', ls = 2, gap = size * .28, gw = size * .62;
    const wa = measure(a, f, ls), wb = measure(b, f, ls), tot = wa + gap * 2 + gw + wb, x0 = x - tot / 2;
    text(a, x0, y, { font: f, color, ls }); text(b, x0 + wa + gap * 2 + gw, y, { font: f, color, ls });
    const gx = x0 + wa + gap, gy = y - size * .36, lw = size * .1;
    inkLine(gx, gy - size * .13, gx + gw, gy - size * .13, { w: lw, color, seed: 301, wob: .6 });
    inkLine(gx, gy + size * .13, gx + gw, gy + size * .13, { w: lw, color, seed: 302, wob: .6 });
    inkLine(gx + gw * .72, gy - size * .36, gx + gw * .28, gy + size * .36, { w: lw, color, seed: 303, wob: .6 });
  }
  /** caption « LE ROI DU FORFAIT » (screen px, top right) + « · non agréé » written under it */
  function nameCard(t, t0, nonT0) {
    if (t < t0) return;
    const k = clamp(spring(t - t0, 15, .5), 0, 1.15), a = clamp((t - t0) / .12);
    const label = 'LE ROI DU FORFAIT', f = font(FF.bd, 58, 400), w = measure(label, f, 3) + 60, h = 58 * 1.35, x = 1020 - w, y = 250;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.rotate(-.02);
    withShadow(8, () => { ctx.fillStyle = BD.recit; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: 4.5, seed: 321 });
    text(label, 0, h * .3, { font: f, align: 'center', color: BD.ink, ls: 3 });
    ctx.restore();
    if (nonT0 != null && t >= nonT0 - .05) {                                     // a cream strip under the name, the words written in red
      const kk = clamp(spring(t - nonT0 + .05, 16, .55), 0, 1.1), sw = 330, sh = 78, sx = x + w - sw / 2 - 14, sy = y + h + 52;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(kk, kk); ctx.rotate(.025);
      withShadow(6, () => { ctx.fillStyle = '#FFF6E2'; ctx.fillRect(-sw / 2, -sh / 2, sw, sh); });
      inkRect(-sw / 2, -sh / 2, sw, sh, { w: 3, seed: 322 });
      writeOn('· non agréé', 0, 19, t, nonT0 + .08, .55, { size: 58, fam: FF.brush, color: BD.red, align: 'center' });
      ctx.restore();
    }
  }
  /** Tuesday's red « INTERDIT » stamp, flashing for half a second (screen px) */
  function interditFlash(t, t0, x, y, r = 128) {
    const d = .55; if (t < t0 || t > t0 + d) return;
    const u = t - t0, k = clamp(u / .1), s = 1 + (1 - eOutCubic(k)) * .55, a = clamp(u / .05) * clamp((t0 + d - t) / .15);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a;
    ctx.fillStyle = 'rgba(255,247,232,.72)'; ctx.beginPath(); ctx.arc(0, 0, r * .93, 0, 7); ctx.fill();
    bdStamp(0, 0, r, 'INTERDIT', { color: BD.red, rot: -.2, size: r * .41, a: .96 });
    ctx.restore();
  }
  /** everything of the office that stands behind the characters (back to front) */
  function officeBack(t, stampT, lizard) {
    parasolShade();
    plasticChair();
    parasolPole();
    roiSign(t, stampT);
    propLizard(SIGN.x - 70, SIGN.y - SH / 2 - 6, .52, t, lizard);
    parasolCanopy(t);
  }

  /** a copy of a cut-out with some rectangles (rig px) cleared — same rig; used for crop artefacts in a picture */
  function cleaned(key, rects) {
    const k2 = key + '_jeudi', I = img(key), R = RIGS[key]; if (!I || !R) return key;
    if (!img(k2)) { const cv = makeCanvas(I.width, I.height), g = cv.getContext('2d'), sx = I.width / R.w, sy = I.height / R.h; g.drawImage(I, 0, 0);
      for (const [x, y, w, h] of rects) g.clearRect(x * sx, y * sy, w * sx, h * sy); window.IMG[k2] = cv; RIGS[k2] = R; }
    return k2;
  }

  shots(() => {
    // ================================================ times (voice) ================================================
    const T15 = shotStart('S18'), T16 = tw('S18', 'Roi', -.3), T17 = se('S18', 3.6), TEND = shotStart('S20');
    const BG2 = has('bg/rue') ? 'bg/rue' : 'bg/mboppi_rue';
    const J5 = K('junior', 5), C5 = K('christelle', 5), B5 = K('boris', 5), C1 = K('christelle', 1), B1 = K('boris', 1);

    // =============================================== P15 · JEUDI, la rue ================================================
    const b15a = T15 + .3, b15b = T16;                                                    // « J'ai un gars. Rapide, pas cher ! » (≥ 1.8 s)
    const dist = t => WALK.v * (t - T15);
    const hJ = HP(WALK.jun.y, 1), hC = HP(WALK.chr.y, .98), hB = HP(WALK.bor.y, .96);
    let c15 = null, bor15 = null;
    defineShot({ id: 'P15', t0: T15, img: BG2, seed: 15, inT: .7, inKind: 'page',
      // the camera keeps pace with the trio: the street slides behind them (parallax between the picture and the walkers)
      cam: [{ t: T15, x: WALK.chr.x, y: 1262, z: 1.7 }, { t: T16, x: WALK.chr.x + WALK.v * (T16 - T15), y: 1262, z: 1.7, e: 'lin' }],
      stage(t, n, c) {
        c15 = c;
        const d = dist(t);
        // Junior, a step back (J5, walking profile)
        walker(J5, WALK.jun.x + d, WALK.jun.y, hFor(J5, K('junior', 1), hJ), d, .8, { t, phase: PHJ, grade: STREET_B, rot: { head: -.03 * env(t, b15a + .5, b15b, .3, .3) } }, { ph0: 1.9 });
        // Christelle (C5), a little nod as Boris announces his guy
        walker(C5, WALK.chr.x + d, WALK.chr.y, hFor(C5, C1, hC), d, .7, { t, phase: PHC, grade: STREET, rot: { head: .06 * env(t, b15a + .6, b15b, .3, .3) * (.6 + .4 * Math.sin(t * 7)) } }, { ph0: .4 });
        // Boris leads, nearest, his box under the arm (B5: the box arm stays still, a light bounce in his step); he talks
        const talk = t > b15a + .05 && t < b15b - .1 ? 1 : 0;
        bor15 = walker(B5, WALK.bor.x + d, WALK.bor.y, hFor(B5, B1, hB), d, .5, { t, phase: PHB, grade: STREET, talk }, { armL: 0, armR: .8, bob: .01, ph0: 3.1 });
        borisTag(t, B5, bor15.x, bor15.y, bor15.h, bor15);
      },
      screen(t) {
        dayCard(t, T15 + .35, 'JEUDI');
        tabOnglet(t, T15 + .75, '④ LE TRANSITAIRE');
        if (!c15 || !bor15) return;
        const o = Object.assign({}, bor15, { talk: 1 }), m = scr(c15, mouthOf(B5, bor15.x, bor15.y, bor15.h, o)), top = stageToScreen(c15, bor15.x, bor15.y - bor15.h).y;
        balloon(t, { t0: b15a, t1: b15b, text: "J'ai un gars. Rapide, pas cher !", x: clamp(m.x - 120, 330, 755), y: clamp(top - 190, 760, 940), w: 520, size: 54,
          tail: tailAbove(m, top, -6), seed: 15 });
      } });

    // =============================================== P16 · le Roi du forfait ============================================
    const name0 = tw('S18', 'Roi', .15);
    const r1a = se('S18', -.05), r2a = r1a + 1.85;                                        // two balloons, in the silence after the voice
    const flash = r2a + .45;                                                              // « … on découpe » → INTERDIT flashes
    const R1 = K('roi', 1), R2 = cleaned(K('roi', 2), [[0, 1056, 30, 52]]), R3 = K('roi', 3), R4 = K('roi', 4);   // roi_2: a stray shoe tip in its corner
    const hR = key => hFor(key, R1, HR), hBo = key => hFor(key, B1, HB), hCh = key => hFor(key, C1, HC);
    let c16 = null;
    defineShot({ id: 'P16', t0: T16, img: 'bg/roi_forfait', seed: 16, inT: .5, inKind: 'slide',
      // slow push toward the Roi (framed tight enough while the narrator's caption is up: faces stay above it)
      cam: [{ t: T16, x: 672, y: 1218, z: 1.58 }, { t: se('S18', .6), x: 680, y: 1226, z: 1.6 }, { t: T17, x: 690, y: 1240, z: 1.64 }],
      stage(t, n, c) {
        c16 = c;
        officeBack(t, null, { phase: .6, puff: env(t, flash, flash + 1.4, .12, .4), period: 4.2 });
        // Boris, proud of his « gars », one step back (B1, box under the arm)
        const bo = { t, phase: PHB, grade: SUN_B, hop: T16 + .55, lean: -.025 };
        drawPuppet(B1, BOR.x, BOR.y, HB, bo); borisTag(t, B1, BOR.x, BOR.y, HB, bo, .055);
        foldTable(t);
        // Christelle, hands on her hips, not convinced; she rears back when INTERDIT flashes
        drawPuppet(C1, CHR.x, CHR.y, HC, { t, phase: PHC, grade: SUN, hop: flash, lean: -.06 * env(t, flash, flash + 1.2, .15, .5) });
        // the Roi, phone up, under his parasol; he talks during both balloons and leans in on the second
        const talk = t > r1a && t < T17 - .1 ? 1 : 0;
        drawPuppet(R1, ROI.x, ROI.y, HR, { t, phase: PHR, grade: UMBRA, talk, hop: T16 + .9, lean: -.04 * env(t, r2a - .1, T17, .3, .2) });
        // Christelle's start: shock lines over her head
        const ct = templeOf(C1, CHR.x, CHR.y, HC, { t, phase: PHC }, 1);
        surprise(ct.x - 18, ct.y + 6, 44, prog(t, flash, flash + .25), env(t, flash, flash + 1, .05, .35), 31);
      },
      screen(t) {
        nameCard(t, name0, null);
        if (!c16) return;
        const o = { t, phase: PHR, talk: 1 }, m = scr(c16, mouthOf(R1, ROI.x, ROI.y, HR, o)), top = stageToScreen(c16, ROI.x, ROI.y - HR).y;
        // two balloons, one above the other, both kept until the cut so the second can be read; tails to his mouth
        // (left of the painted board, which must stay readable)
        balloon(t, { t0: r1a, t1: T17 + .2, text: 'Forfait douane, en liquide, sans détail !', x: 320, y: top - 560, w: 470, size: 54, tail: tailAbove(m, top, -14), seed: 16 });
        balloon(t, { t0: r2a, t1: T17 + .2, text: 'Et on découpe : tu passes sous le seuil !', x: 390, y: top - 292, w: 470, size: 54, tail: tailAbove(m, top, -8), seed: 17 });
        interditFlash(t, flash, 450, top - 300, 112);
      } });
    addShake(flash, 11, .16);

    // =============================================== P17 · « Non merci. » ================================================
    const q0 = T17 + .15, q1 = q0 + 1.85;                                                 // Christelle: « Ton agrément, il est où ? »
    const a0 = T17 + 1.45, a1 = ss('S19', .05);                                           // the Roi: « C'est écrit sur l'enseigne ! »
    const stampT = tw('S19', 'prouve');                                                   // UN NOM ≠ UN AGRÉMENT, printed on the board
    const non0 = tw('S19', "L'agrément");                                                 // « · non agréé » under his name
    const n0 = se('S19', -.55), n1 = n0 + 2.0;                                            // « Non merci. Un devis écrit, ligne par ligne. »
    const shrug = se('S19', -.1), wk0 = se('S19', .55);                                   // R4 shrug, then R2 walks out right on the phone
    const al0 = wk0 + .1, al1 = TEND + .3;                                                // « Allô ? Allô ? »
    const roiD = t => { const u = t - wk0 - .12; return u <= 0 ? 0 : u < .4 ? 255 * u * u / .8 : 255 * (u - .2); };
    const roiKeys = [[T17, R1], [stampT + .05, R3], [shrug, R4], [wk0, R2]];
    const chrKeys = [[T17, K('christelle', 2)], [q1 - .2, C1], [n0 - .1, K('christelle', 2)], [n1 - .1, C1]];
    let c17 = null, roiO = null;
    defineShot({ id: 'P17', t0: T17, img: 'bg/roi_forfait', seed: 17,
      cam: [{ t: T17, x: 640, y: 1150, z: 1.42 }, { t: ss('S19', -.35), x: 652, y: 1180, z: 1.5 },
        { t: tw('S19', 'enseigne', .05), x: 752, y: 1300, z: 2.0 }, { t: te('S19', 'rien'), x: 752, y: 1302, z: 2.04, e: 'lin' },
        { t: non0 + .5, x: 672, y: 1225, z: 1.6 }, { t: se('S19', .1), x: 672, y: 1225, z: 1.6, e: 'lin' },
        { t: wk0 + .9, x: 668, y: 1180, z: 1.5 }, { t: TEND, x: 668, y: 1178, z: 1.49 }],
      stage(t, n, c) {
        c17 = c;
        officeBack(t, stampT, { phase: .6, pushAt: stampT + .1, period: 4.2, look: env(t, non0, n1, .3, .4) });
        // Boris: still proud, then sheepish when the stamp falls (B3, head down, a sweat drop)
        const sheep = env(t, stampT + .05, TEND + 1, .35, .1);
        const bo = { t, phase: PHB, grade: SUN_B, hop: stampT + .1, lean: .05 * sheep, rot: { head: .1 * sheep } };
        const bk = drawTrack([[T17, B1], [stampT + .05, K('boris', 3)]], BOR.x, BOR.y, hBo, bo);
        borisTag(t, bk, BOR.x, BOR.y, hBo(bk), bo, .055);
        const bt = templeOf(bk, BOR.x, BOR.y, hBo(bk), bo, -1);
        sweatDrop(bt.x, bt.y, 1.15, prog(t, stampT + .25, stampT + 1.7));
        foldTable(t);
        // Christelle: C2 asks, C1 listens, C2 refuses (index up), C1 proud at the end
        const ctalk = (t > q0 && t < q1 - .3) || (t > n0 && t < n1 - .35) ? 1 : 0;
        drawTrack(chrKeys, CHR.x, CHR.y, hCh, { t, phase: PHC, grade: SUN, talk: ctalk, hop: n1 - .05, lean: .02 * ctalk });
        // the Roi: R1 (phone up) pitches his sign → R3 (arms down) deflates at the stamp → R4 (hands in pockets) shrugs →
        // R2 walks out right in front of his table, on the phone
        const ri = trackKey(roiKeys, t), rk = roiKeys[ri][1], d = roiD(t);
        const rtalk = (t > a0 && t < a1 - .1) || (t > al0 && t < al1) ? 1 : 0;
        const shr = env(t, shrug + .02, shrug + .62, .12, .25);
        const ro = { t, phase: PHR, grade: d > 180 ? SUN : UMBRA, talk: rtalk, hop: a0 + .05,
          lean: rtalk && t < a1 ? .05 * Math.sin(Math.min(1, (t - a0) / .4) * Math.PI / 2) : 0,
          rot: { chest: -.04 * shr }, off: { chest: [0, -14 * shr] } };
        if (rk === R2) {
          const x = ROI.x + d;
          if (t - wk0 < .18) { const k = clamp((t - wk0) / .18); drawPuppet(R4, ROI.x, ROI.y, hR(R4), Object.assign({}, ro, { a: 1 - k, shadow: false })); ctx.save(); ctx.globalAlpha *= k; }
          roiO = walker(R2, x, ROI.y, hR(R2), d, .8, Object.assign({}, ro, { off: {}, rot: {} }), { ph0: 0 });
          if (t - wk0 < .18) ctx.restore();
        } else {
          drawTrack(roiKeys.slice(0, 3), ROI.x, ROI.y, hR, ro);
          roiO = Object.assign({}, ro, { x: ROI.x, y: ROI.y, h: hR(rk), key: rk });
          // marks: a sweat drop when the stamp falls, shrug strokes on « Non merci »
          const tp = templeOf(rk, ROI.x, ROI.y, hR(rk), ro, 1);
          sweatDrop(tp.x, tp.y, 1.2, prog(t, stampT + .2, stampT + 1.6));
          const RR = RIGS[rk], sh = RR && boneOf(RR, 'armL_up');                           // his image-right shoulder (away from Boris)
          if (sh) { const q = pupPt(rk, ROI.x, ROI.y, hR(rk), ro, sh.a, 'chest'); shrugMarks(q.x + 6, q.y - 4, 1, 1.5, prog(t, shrug, shrug + .8)); }
        }
      },
      screen(t) {
        nameCard(t, T17 - 1, non0);
        if (!c17 || !roiO) return;
        // Christelle's balloons (left), the Roi's (right) — above the heads, tails toward the mouths
        const ck = K('christelle', 2), co = { t, phase: PHC, talk: 1 };
        const cm = scr(c17, mouthOf(ck, CHR.x, CHR.y, hCh(ck), co)), cTop = stageToScreen(c17, CHR.x, CHR.y - hCh(ck)).y;
        balloon(t, { t0: q0, t1: q1, text: 'Ton agrément, il est où ?', x: clamp(cm.x + 70, 270, 520), y: clamp(cTop - 200, 560, 860), w: 460, size: 54, tail: tailAbove(cm, cTop, 10), seed: 18 });
        const rm = scr(c17, mouthOf(roiO.key, roiO.x, roiO.y, roiO.h, Object.assign({}, roiO, { talk: 1 }))), rTop = stageToScreen(c17, roiO.x, roiO.y - roiO.h).y;
        balloon(t, { t0: a0, t1: a1, text: "C'est écrit sur l'enseigne !", x: clamp(rm.x + 60, 560, 800), y: clamp(rTop - 420, 380, 520), w: 440, size: 54, tail: tailAbove(rm, rTop, 4), seed: 19 });
        balloon(t, { t0: n0, t1: n1, text: 'Non merci. Un devis écrit, ligne par ligne.', x: clamp(cm.x + 110, 300, 520), y: clamp(cTop - 220, 560, 860), w: 520, size: 54, tail: tailAbove(cm, cTop, 10), seed: 20 });
        balloon(t, { t0: al0, t1: al1, text: 'Allô ? Allô ?', x: clamp(rm.x + 40, 790, 860), y: 600, w: 340, size: 56,
          tail: [Math.min(rm.x + 4, 1075), Math.min(rm.y - 20, rTop - 10)], seed: 21 });
      } });
    addShake(stampT, 14, .18);
  });
})();

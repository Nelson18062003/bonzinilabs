// ============================================================================================================
// 21_samedi — P1, P2, P3 (S1–S4) : samedi soir au maquis, la tontine tombe sur Christelle ; Tantine Mireille garde
// l'enveloppe ; Junior se souvient de sa promesse ; le fournisseur tient son prix jusqu'à samedi.
// Everything lives inside this IIFE (all scene files share one global scope).
// ============================================================================================================
(() => {
  'use strict';
  const NIGHT = GRADE.night;
  const K = (who, n) => `cast/${who}_${n}`;

  // ---------- one maquis layout for P1 and P2 (stage units on bg/maquis, 1000 × 1800) ----------------------
  // front row on the terrace floor in front of the table ; the back row stands behind the table, farther away
  // (smaller), so that every head sits near the same eye line (y ≈ 1000–1060)
  // front row : Mireille (left edge, flipped : she faces Christelle) · Christelle · … · Junior (right edge) ; back row, behind
  // the table : Nadège, Boris (scale .74 = their depth on this terrace). Relative heights : Junior 1, Christelle .98,
  // Mireille .92, Nadège 1, Boris .96.
  const JH = 760, JY = 1764;                                                         // Junior = 1.00
  const MIR = { x: 114, y: 1762, h: JH * .92 }, CHR = { x: 455, y: 1765, h: JH * .98 };
  const NAD = { x: 598, y: 1556, h: JH * .74 }, BOR = { x: 712, y: 1560, h: JH * .74 * .96 };
  const LIZ = { x: 622, y: 1430, s: .85 };                                           // margouillat on the table top
  const CHR1 = { x: 442, y: 1765, h: CHR.h }, JX1 = 895;                            // P1 : Christelle right next to Mireille
  // the front chairs and the table top are redrawn over the back row (they stand behind the table)
  const MASK = [[150, 1800], [150, 1372], [168, 1356], [240, 1346], [300, 1360], [308, 1408], [360, 1400], [500, 1392], [640, 1396],
    [692, 1404], [700, 1392], [748, 1370], [800, 1374], [838, 1388], [842, 1800]];
  function maskRedraw(c) {
    const I = img('bg/maquis'); if (!I) return;
    ctx.save(); ctx.beginPath(); MASK.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    ctx.drawImage(I, 0, 0, c.iw, c.ih); ctx.restore();
  }

  // ---------- puppet helpers ------------------------------------------------------------------------------------
  /** the procedural pose drawPuppet applies (same formulas), so that a prop can follow a hand */
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
  /** stage point of a puppet. spec = { bone, end: 'a'|'b' } (a bone end) | { mouth: true } | { hands: true } (mid-point of
   *  both wrists). fb = [dx, dy] fallback in units of h (dx toward the side the character faces, dy from the top of the head) */
  function pupAt(key, x, y, h, o, spec, fb) {
    const R = RIGS[key], dir = o.flip ? -1 : 1;
    if (!R) { const L = pupLift(o); return { x: x + dir * fb[0] * h, y: y - L.hopY * h - h + fb[1] * h, fb: true }; }
    const M = boneMats(R, pupRot(R, o), o.off || {}), end = (bn, e) => { const b = R.bones.find(q => q.n === bn); return b ? aff.ap(M[bn], b[e]) : [R.w / 2, R.h / 2]; };
    let q;
    if (spec.mouth) q = R.face ? aff.ap(M.head, R.face.mouth) : end('head', 'a');
    else if (spec.hands) { const a = end('armL_lo', 'b'), b = end('armR_lo', 'b'); q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    else q = end(spec.bone, spec.end || 'b');
    const s = h / R.h, L = pupLift(o);
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce) };
  }
  /** pose track: keys [{ t, pose: { k, flip, rot, hop … } }] → a pose change is a clean cut (as in cut-out animation) with a
   *  small squash-and-settle pop at the feet, never a double exposure */
  function drawTrack(keys, x, y, h, o) {
    const S = poseAt(keys, o.t, .01), P = S.pose, pop = S.since >= 0 && S.since < .16 && keys[0].pose !== P ? Math.sin(S.since / .16 * Math.PI) : 0;
    ctx.save(); if (pop) { ctx.translate(x, y); ctx.scale(1 + .025 * pop, 1 - .035 * pop); ctx.translate(-x, -y); }
    drawPuppet(P.k, x, y, h, Object.assign({}, o, P));
    ctx.restore();
    return P;
  }
  const on = (t, a, b) => (t >= a && t <= b ? 1 : 0);
  /** balloon tail target: a screen point near a stage point (the top of the speaker's head, or beside the mouth) */
  const tailAt = (c, p, dx = 0, dy = 0) => { const s = stageToScreen(c, p.x, p.y); return [s.x + dx, s.y + dy]; };
  /** apply the exact placement drawPuppet uses, so that fn draws in the picture's own pixels (unflipped), with its bones */
  function inRig(key, x, y, h, o, fn) {
    const R = RIGS[key]; if (!R) return false;
    const M = boneMats(R, pupRot(R, o), o.off || {}), s = h / R.h, L = pupLift(o);
    ctx.translate(x, y - L.hopY * h); ctx.scale(o.flip ? -1 : 1, 1 + L.bounce); ctx.translate(-R.w / 2 * s, -h); ctx.scale(s, s);
    fn(M, R); return true;
  }

  // ---------- Mireille brandishes the TONTINE envelope ------------------------------------------------------------
  // None of her pictures raises an arm (and rotating one that far tears the cut-out), so her hanging basket forearm
  // (mireille_4, left of the picture) is masked out and redrawn raised from the elbow, the envelope in her fist.
  const MK = K('mireille', 4), MSKIN = '#6C412A', MSKIN_D = '#4A2916', MSKIN_L = '#8E5A38';
  const MIR_CUT = [[-90, 462, 'armR_up'], [156, 462, 'armR_up'], [141, 520, 'armR_up'], [124, 586, 'armR_up'], [108, 646, 'hips'],
    [96, 700, 'hips'], [88, 760, 'hips'], [80, 820, 'hips'], [72, 872, 'hips'], [-90, 872, 'hips']];
  const MIR_ELB = [116.7, 477];
  /** options for Mireille : the hidden forearm's procedural gesture is cancelled (it would drag the dress) */
  function mirOpts(o) {
    const R = RIGS[MK], rot = Object.assign({}, o.rot || {});
    if (R && R.gesture) for (const [bn, amp, fr] of R.gesture) if (bn === 'armR_lo') {
      const t = o.t ?? 0, ph = o.phase ?? 0, E = o.energy ?? 1, talk = o.talk || 0;
      rot[bn] = (rot[bn] || 0) - (Math.sin(t * fr + ph) * .6 + Math.sin(t * fr * 1.9 + ph) * .4) * amp * (talk ? 2.2 : .6) * E; }
    return Object.assign({}, o, { rot });
  }
  /** where the envelope is (stage units) for a given arm pose : { x, y } of its centre */
  function mirArm(M, arm) {
    const E = aff.ap(M.armR_up, MIR_ELB), dx = -Math.sin(arm.th), dy = -Math.cos(arm.th), L = 192;
    const Wr = [E[0] + dx * L, E[1] + dy * L], F = [Wr[0] + dx * 22, Wr[1] + dy * 22], ew = arm.w || 224, eh = ew * .6;
    const er = -arm.th * .55 + (arm.rot || 0), C = [F[0] + dx * (eh * .5 - 6) - Math.cos(er) * ew * .06, F[1] + dy * (eh * .5 - 6) - Math.sin(er) * ew * .06];
    return { E, Wr, F, C, dx, dy, ew, er };
  }
  function drawMireilleEnv(x, y, h, o0, arm) {
    const o = mirOpts(o0), R = RIGS[MK];
    if (!R) { drawPuppet(MK, x, y, h, o); return; }
    const m0 = ctx.getTransform();
    ctx.save();
    inRig(MK, x, y, h, o, (M) => {
      ctx.beginPath(); ctx.rect(-3000, -3000, R.w + 6000, R.h + 6000);
      MIR_CUT.forEach(([px, py, bn], i) => { const q = aff.ap(M[bn], [px, py]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
      ctx.closePath(); ctx.clip('evenodd');
    });
    ctx.setTransform(m0);
    drawPuppet(MK, x, y, h, o);
    ctx.restore();
    ctx.save();
    inRig(MK, x, y, h, o, (M) => {
      const A = mirArm(M, arm), { E, Wr, F, dx, dy } = A, nx = -dy, ny = dx;
      // the bare bit of upper arm between the sleeve hem and the elbow, redrawn so the bend always reads as one arm
      const Hm = aff.ap(M.armR_up, [110, 428]);
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(Hm[0], Hm[1]); ctx.lineTo(E[0], E[1]);
      ctx.lineWidth = 58; ctx.strokeStyle = BD.ink; ctx.stroke(); ctx.lineWidth = 50; ctx.strokeStyle = MSKIN_D; ctx.stroke();
      // forearm (bare : her sleeves stop above the elbow), shaded, inked like the picture
      const P = [[E[0] + nx * 27, E[1] + ny * 27], [Wr[0] + nx * 20, Wr[1] + ny * 20], [Wr[0] - nx * 20, Wr[1] - ny * 20], [E[0] - nx * 26, E[1] - ny * 26]];
      const g = ctx.createLinearGradient(E[0] + nx * 26, E[1] + ny * 26, E[0] - nx * 26, E[1] - ny * 26);
      g.addColorStop(0, MSKIN_D); g.addColorStop(.45, MSKIN); g.addColorStop(1, MSKIN_L);
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      ctx.quadraticCurveTo((P[0][0] + P[1][0]) / 2 + nx * 5, (P[0][1] + P[1][1]) / 2 + ny * 5, P[1][0], P[1][1]); ctx.lineTo(P[2][0], P[2][1]);
      ctx.quadraticCurveTo((P[2][0] + P[3][0]) / 2 - nx * 3, (P[2][1] + P[3][1]) / 2 - ny * 3, P[3][0], P[3][1]);
      ctx.arc(E[0], E[1], 26.5, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
      ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BD.ink; ctx.lineJoin = 'round'; ctx.stroke();
      // fist behind the envelope's lower edge
      ctx.beginPath(); ctx.ellipse(F[0], F[1], 31, 27, Math.atan2(dy, dx), 0, 7); ctx.fillStyle = MSKIN; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(A.C[0], A.C[1]); if (o.flip) ctx.scale(-1, 1);                    // the lettering never reads mirrored
      propEnvelope(0, 0, A.ew, { rot: o.flip ? -A.er : A.er, label: 'TONTINE', lift: 6, fill: '#C99A66' }); ctx.restore();
      // curled fingers over the front of the envelope + thumb
      const ex = Math.cos(A.er), ey = Math.sin(A.er);
      for (let i = 0; i < 4; i++) { const u = (i - 1.5) * 17, cx = F[0] + ex * u - dx * 8, cy = F[1] + ey * u - dy * 8;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(A.er); ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 14.5, 0, 0, 7);
        ctx.fillStyle = i === 3 ? MSKIN_L : MSKIN; ctx.fill(); ctx.lineWidth = 3.2; ctx.strokeStyle = BD.ink; ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.translate(F[0] - ex * 30 + dx * 4, F[1] - ey * 30 + dy * 4); ctx.rotate(A.er - .9); ctx.beginPath(); ctx.ellipse(0, 0, 9, 17, 0, 0, 7);
      ctx.fillStyle = MSKIN; ctx.fill(); ctx.lineWidth = 3.2; ctx.stroke(); ctx.restore();
    });
    ctx.restore();
  }
  /** stage point of the envelope centre (for balloons / tails) */
  function mirEnvAt(x, y, h, o0, arm) {
    const o = mirOpts(o0), R = RIGS[MK]; if (!R) return { x: x - h * .2, y: y - h * .85 };
    const M = boneMats(R, pupRot(R, o), o.off || {}), A = mirArm(M, arm), s = h / R.h, L = pupLift(o), dir = o.flip ? -1 : 1;
    return { x: x + dir * (A.C[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + A.C[1] * s) * (1 + L.bounce) };
  }

  // ---------- small BD marks (stage units, around a head point) ---------------------------------------------------
  function bdMarks(kind, p, s, t, t0, t1) {
    if (t < t0 || t > t1) return;
    const k = Math.min(clamp((t - t0) / .12), clamp((t1 - t) / .2)), pop = clamp(spring(t - t0, 16, .5), 0, 1.15);
    ctx.save(); ctx.globalAlpha *= k; ctx.translate(p.x, p.y); ctx.scale(s * pop, s * pop);
    if (kind === 'surprise') {                                  // three strokes bursting above the head + « ! »
      [[-1.1, 0], [-.5, 0], [.1, 0]].forEach(([a], i) => { const r0 = 46, r1 = 76 + (i === 1 ? 10 : 0), aa = a - .5;
        inkLine(Math.cos(aa) * r0, Math.sin(aa) * r0, Math.cos(aa) * r1, Math.sin(aa) * r1, { w: 4.5, seed: 140 + i }); });
      text('!', 62, -40, { font: font(FF.bd, 44, 400), align: 'center', color: BD.orange });
    } else if (kind === 'laugh') {                              // little laugh lines on both sides of the face, shaking
      const j = Math.sin(t * 30) * 2;
      for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const a = sd * (.35 + i * .32), r0 = 52, r1 = 70;
        inkLine(sd * 6 + Math.sin(a) * r0 + j, -Math.cos(a) * r0 * .6 + 18 + i * 4, sd * 6 + Math.sin(a) * r1 + j, -Math.cos(a) * r1 * .6 + 18 + i * 4, { w: 3.5, seed: 150 + i + sd }); }
    } else if (kind === 'sweat') {
      const dy = (t - t0) * 18; ctx.beginPath(); ctx.moveTo(0, -14 + dy); ctx.quadraticCurveTo(11, 4 + dy, 0, 10 + dy); ctx.quadraticCurveTo(-11, 4 + dy, 0, -14 + dy);
      ctx.fillStyle = '#BFE6FF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BD.ink; ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- atmosphere : garland, grill smoke -------------------------------------------------------------------
  function rgba(hex, a) { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; }
  function garland(t, x0, y0, x1, y1, sag, seed) {
    const N = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40)), pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.3 + u * 5) * 2]); }
    inkPath(pts, { w: 2.6, color: 'rgba(18,12,10,.9)', seed, wob: .6 });
    const cols = ['#FFC15A', '#F26A21', '#A66BFF', '#FFE27A', '#FF6B5A'];
    for (let i = 1; i < N; i++) {
      const [bx, by0] = pts[i], by = by0 + 12, col = cols[(i + seed) % 5], tw = .6 + .4 * Math.sin(t * (1.6 + hash(i + seed) * 2.4) + i * 1.9);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, 40); g.addColorStop(0, rgba(col, .55 * tw)); g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(bx - 40, by - 40, 80, 80); ctx.restore();
      inkLine(bx, by0, bx, by - 6, { w: 2, color: 'rgba(18,12,10,.9)', seed: i });
      ctx.beginPath(); ctx.ellipse(bx, by, 6.5, 9, 0, 0, 7); ctx.fillStyle = rgba(col, .75 + .25 * tw); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(18,12,10,.8)'; ctx.stroke();
    }
  }
  function smoke(t, x0, y0, k = 1) {
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const u = (t * .085 + i / 7) % 1, r = 50 + u * 210, x = x0 + u * 230 + Math.sin(t * .6 + i * 2.1) * 34, y = y0 - u * 950;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r), a = .13 * Math.sin(u * Math.PI) * k;
      g.addColorStop(0, `rgba(236,214,190,${a})`); g.addColorStop(1, 'rgba(236,214,190,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
  /** draw fn into an offscreen layer, then composite it with alpha a (clean fades for overlapping shapes) */
  let _lay = null;
  function layered(a, fn) {
    if (a >= .999) { fn(); return; }
    if (a <= .001) return;
    if (!_lay) { _lay = document.createElement('canvas'); _lay.width = W; _lay.height = H; }
    const main = ctx, m = main.getTransform(); ctx = _lay.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.setTransform(m);
    try { fn(); } finally { ctx = main; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= a; ctx.drawImage(_lay, 0, 0); ctx.restore();
  }

  // ---------- the Part 1 ticket : header « NOTE PRÉVUE · estimation » kept readable, the prop's own orange slip stapled
  // just under it (same drawing as propTicket, only moved down) -------------------------------------------------------
  function ticketSlip(x, y, w, o = {}) {
    const h = w * 1.45, sw = w * 1.02, sh = w * .5, dy = w * .37;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
    propTicket(0, 0, w, { lift: o.lift ?? 8 });
    ctx.save(); ctx.translate(0, dy);
    ctx.save(); ctx.translate(w * .08, -h / 2 + w * .02); ctx.rotate(.06); ctx.beginPath(); ctx.rect(-sw / 2 - 3, -8, sw + 6, sh + 11); ctx.restore(); ctx.clip();
    propTicket(0, 0, w, { slip: true, lift: 0 });
    ctx.restore();
    ctx.restore();
  }

  // ---------- thought cloud with a picture inside (screen px) -----------------------------------------------------
  function thinkCloud(t, t0, t1, cx, cy, w, h, head, inside) {
    if (t < t0 || t > t1 + .3) return;
    const k = clamp(spring(t - t0, 11, .62), 0, 1.12), a = Math.min(clamp((t - t0) / .12), clamp((t1 + .3 - t) / .3));
    layered(a, () => {
      [[.2, 12], [.4, 18], [.62, 26]].forEach(([u, r], i) => { if (t - t0 < i * .09) return;
        inkCircle(lerp(head.x, cx, u), lerp(head.y, cy + h * .42, u), r, { w: 4, fill: '#FFFFFF', seed: 30 + i }); });
      ctx.save(); ctx.translate(cx, cy + Math.sin(t * 1.4) * 4); ctx.scale(k, k);
      const L = []; for (let i = 0; i < 16; i++) { const u = i / 16 * Math.PI * 2; L.push([Math.cos(u) * w * .43, Math.sin(u) * h * .4, (w + h) * (.075 + hash(i * 3.1 + 2) * .025)]); }
      withShadow(10, () => { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.ellipse(0, 0, w * .47, h * .45, 0, 0, 7); ctx.fill(); });
      for (const [x, y, r] of L) inkCircle(x, y, r, { w: 5, fill: '#FFFFFF', seed: 40 + x });
      ctx.fillStyle = '#FFFFFF'; for (const [x, y, r] of L) { ctx.beginPath(); ctx.arc(x, y, r - 3.5, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(0, 0, w * .44, h * .41, 0, 0, 7); ctx.fill();
      inside(w, h, t - t0);
      ctx.restore();
    });
  }
  /** the dream : Christelle's stall overflowing with braids, under a lettered garland « FÊTES » */
  function dreamStall(w, h, dt) {
    const iw = w * .76, ih = h * .66, x = -iw / 2, y = -ih / 2 + h * .04, I = img('bg/etal_meches_fetes');
    ctx.save(); rrect(x, y, iw, ih, 26); ctx.clip();
    if (I) { const z = 1 + .07 * clamp(dt / 2.6), sw = I.width / z, sh = sw * ih / iw; ctx.drawImage(I, (I.width - sw) / 2, I.height * .04, sw, sh, x, y, iw, ih); }
    else { ctx.fillStyle = '#C98A3C'; ctx.fillRect(x, y, iw, ih); }
    const g = ctx.createLinearGradient(0, y, 0, y + ih); g.addColorStop(0, 'rgba(255,214,140,.2)'); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, iw, ih);
    ctx.restore();
    inkRect(x, y, iw, ih, { w: 4, seed: 51 });
    // garland of pennants lettered F Ê T E S across the top of the picture
    const letters = ['F', 'Ê', 'T', 'E', 'S'], cols = [BD.violet, BD.amber, BD.orange, BD.violet, BD.amber], gy = y + 6;
    const P = u => [lerp(x - 16, x + iw + 16, u), gy + 30 * 4 * u * (1 - u)];
    inkPath(Array.from({ length: 21 }, (_, i) => P(i / 20)), { w: 3, seed: 52 });
    letters.forEach((L, i) => {
      const u = (i + 1) / 6, [fx, fy] = P(u), sw = Math.sin(dt * 3 + i * 1.3) * .07, pop = clamp(spring(dt - .15 - i * .08, 14, .5), 0, 1.1);
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(sw); ctx.scale(pop, pop);
      ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(36, 0); ctx.lineTo(0, 84); ctx.closePath(); ctx.fillStyle = cols[i]; ctx.fill();
      inkPath([[-36, 0], [36, 0], [0, 84], [-36, 0]], { w: 3, seed: 53 + i });
      text(L, 0, 50, { font: font(FF.bd, 50, 400), align: 'center', color: i === 1 || i === 4 ? BD.ink : '#FFF9EC' });
      ctx.restore();
    });
  }

  // ---------- the ticket zoomed in an inset panel that grows out of Junior's hand (screen px) ---------------------
  function ticketInset(t, t0, t1, bx, by, bw, bh, from) {
    if (t < t0 || t > t1 + .3) return;
    const k = clamp(spring(t - t0, 10, .7), 0, 1.06), a = Math.min(clamp((t - t0) / .1), clamp((t1 + .3 - t) / .3));
    const u = Math.min(1, k), cx = lerp(from.x, bx + bw / 2, u), cy = lerp(from.y, by + bh / 2, u), s = lerp(.16, 1, k);
    ctx.save(); ctx.globalAlpha *= a;
    inkCircle(from.x, from.y, 66, { w: 4, color: 'rgba(255,226,122,.95)', seed: 61 });          // ring on the real ticket
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(-.015);
    withShadow(14, () => { ctx.fillStyle = '#2B1D2E'; ctx.fillRect(-bw / 2, -bh / 2, bw, bh); });
    ctx.save(); ctx.beginPath(); ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.clip();
    const g = ctx.createRadialGradient(0, -bh * .2, 20, 0, 0, bw * .8); g.addColorStop(0, '#6A4632'); g.addColorStop(1, '#241722'); ctx.fillStyle = g; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    const tw = bw * .86; ticketSlip(-6, -bh / 2 + tw * .725 + 22 + Math.sin(t * 2) * 3, tw, { rot: -.025 + Math.sin(t * 1.3) * .008, lift: 12 });
    ctx.restore();
    inkRect(-bw / 2, -bh / 2, bw, bh, { w: 6, seed: 62 }); inkRect(-bw / 2 + 9, -bh / 2 + 9, bw - 18, bh - 18, { w: 2, color: 'rgba(255,249,236,.5)', seed: 63 });
    ctx.restore();
  }

  // ---------- phone screen of P3 (stage units, drawn inside propPhone) -------------------------------------------
  function supplierChat(t, sw, sh, tMsg) {
    ctx.fillStyle = '#F4EBDD'; ctx.fillRect(0, 0, sw, sh);
    ctx.fillStyle = '#E3D3BD'; ctx.fillRect(0, 0, sw, 150);                                      // chat header
    inkLine(0, 150, sw, 150, { w: 2, color: 'rgba(30,21,18,.5)', seed: 71 });
    inkCircle(sw / 2, 62, 30, { w: 3, fill: '#B98A5E', seed: 72 });                               // generic avatar
    ctx.save(); ctx.fillStyle = '#F4EBDD'; ctx.beginPath(); ctx.arc(sw / 2, 54, 11, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(sw / 2, 84, 18, 11, 0, Math.PI, 0); ctx.fill(); ctx.restore();
    text('FOURNISSEUR · CHINE', sw / 2, 128, { font: font(FF.bd, 22, 400), align: 'center', color: BD.ink, ls: 1 });
    if (t > tMsg - .55 && t < tMsg) { ctx.save(); ctx.fillStyle = '#FFFFFF'; rrect(18, 176, 84, 42, 20); ctx.fill(); ctx.fillStyle = '#8A7A6A';      // typing…
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(40 + i * 20, 197 - Math.max(0, Math.sin(t * 12 - i)) * 5, 5, 0, 7); ctx.fill(); } ctx.restore(); }
    if (t >= tMsg) {
      const k = clamp(spring(t - tMsg, 14, .55), 0, 1.1), lines = ['Prix bloqué', "jusqu'à samedi", 'prochain.'];
      ctx.save(); ctx.translate(14, 172); ctx.scale(k, k);
      withShadow(4, () => { ctx.fillStyle = '#FFFFFF'; rrect(0, 0, sw - 34, 132, 18); ctx.fill(); });
      inkRect(0, 0, sw - 34, 132, { w: 2.2, color: 'rgba(30,21,18,.55)', seed: 73 });
      lines.forEach((l, i) => text(l, 16, 38 + i * 37, { font: font(FF.letN, 31, 400), color: BD.ink }));
      ctx.restore();
    }
  }
  /** P3 countdown page (the new right page of the tontine book, local page coords) */
  function countdownPage(t, pw, ph, T) {
    const x = pw * .2, s = 35, y0 = ph * .3;
    writeOn('LUN · MAR · MER ·', x, y0, t, T.l1, .5, { size: s, fam: FF.letN, color: '#24160E' });
    writeOn('JEU · VEN · SAM', x, y0 + s * 1.9, t, T.l2, .5, { size: s, fam: FF.letN, color: '#24160E' });
    writeOn("→ L'ENVELOPPE", x, y0 + s * 4.1, t, T.l3, .55, { size: s + 5, fam: FF.bd, color: BD.orange, underline: true, ucolor: BD.violet });
  }
  const scribbles = (seed, n) => (pw, ph) => { for (let i = 0; i < n; i++) inkLine(pw * .22, ph * (.24 + i * .1), pw * (.5 + hash(i + seed) * .35), ph * (.24 + i * .1) - 2, { w: 2.2, color: 'rgba(40,40,90,.45)', seed: seed + i, wob: 2.4 }); };

  shots(() => {
    // ======================================================================================================
    // P1 — S1 — ouverture franche (cut, t0 = 0) : Mireille brandit l'enveloppe « TONTINE » et refuse ; Christelle tend la main
    // ======================================================================================================
    const T2 = shotStart('S2'), T3 = ss('S4', .4);
    const CK = K('christelle', 2), CK1 = K('christelle', 1);
    const BAL1 = { t0: .1, t1: 2.95 };
    const HOP = [.85, 2.25];                                               // Christelle jumps twice toward the envelope
    const C1AT = 3.25, GARDE = tw('S1', 'garde', -.15);
    const yank = t => HOP.reduce((s, h) => s + env(t, h - .08, h + .62, .1, .38), 0);
    // Mireille (flipped : she faces Christelle) holds the envelope up at her side ; she wags it while she talks, snatches it up
    // toward her head each time Christelle jumps, then keeps it close on « garde l'enveloppe »
    const mirO = t => ({ t, phase: .6, grade: NIGHT, flip: true, talk: on(t, BAL1.t0, BAL1.t1), lean: .04 * yank(t), rot: { head: .05 * yank(t), armR_up: .1 } });
    const wag = t => env(t, BAL1.t0, BAL1.t1, .2, .3);
    const mirArmAt = t => ({ th: .4 - .3 * yank(t) - .2 * eInOutCubic(prog(t, GARDE, GARDE + .5)) + Math.sin(t * 7.2) * .07 * wag(t),
      rot: Math.sin(t * 7.2 + .8) * .05 * wag(t) });
    const chrKeys1 = [{ t: 0, pose: { k: CK, flip: true } }, { t: C1AT, pose: { k: CK1, flip: true } }];
    const chrO = t => ({ t, phase: 0, grade: NIGHT, lean: t < C1AT ? .05 + .05 * yank(t) : .02, hop: t < 1.6 ? HOP[0] : HOP[1],
      rot: t < C1AT ? { armL_up: -.14, armL_lo: .12 } : {} });
    const nadKeys1 = [{ t: 0, pose: { k: K('nadege', 1) } }, { t: tw('S1', 'mais', -.1), pose: { k: K('nadege', 3), hop: tw('S1', 'mais') } }];
    const borKeys1 = [{ t: 0, pose: { k: K('boris', 2) } }, { t: tw('S1', 'tombe', -.1), pose: { k: K('boris', 4), hop: tw('S1', 'tombe') } }];
    // camera : 1.05 s tight on Mireille, the envelope and Christelle's reaching hand (z 2.4), then ONE continuous pull-back
    // (z ≈ 1.4 at 2.2 s, as the correction asks) to the whole band (z 1.1, bottom-aligned so the envelope clears the caption) — keys sampled from one smooth curve, no stop-and-go
    const CAM0 = { x: 233, y: 1259, z: 2.15 }, CAM9 = { x: 485, y: 992, z: 1.1 }, CA1 = 1.05;
    const camP1 = [Object.assign({ t: 0 }, CAM0), { t: CA1, x: CAM0.x + 3, y: CAM0.y + 4, z: 2.2, e: 'lin' }];
    for (let tt = CA1 + 1 / 15; tt < T2 + .02; tt += 1 / 15) {
      const u = clamp((tt - CA1) / (T2 - CA1)), e = (1 - Math.pow(1 - u, 4)) * smooth(clamp((tt - CA1) / .5));
      camP1.push({ t: tt, x: lerp(CAM0.x + 3, CAM9.x, e), y: lerp(CAM0.y + 4, CAM9.y, e), z: Math.exp(lerp(Math.log(2.2), Math.log(CAM9.z), e)), e: 'lin' });
    }
    let c1 = null;
    defineShot({ id: 'P1', t0: 0, img: 'bg/maquis', seed: 21, inT: 0, inKind: 'cut', cam: camP1,
      stage(t, n, c) {
        c1 = c;
        parallax(c, .93, () => { ctx.translate(-500 * .07, -905 * .07); garland(t, 250, 742, 760, 676, 70, 3); });
        smoke(t, 20, 1780, .9);
        // back row (behind the table) : Boris is stunned the tontine falls on Christelle, Nadège bursts out laughing on « mais »
        drawTrack(borKeys1, BOR.x, BOR.y, BOR.h, { t, phase: 3.3, grade: NIGHT, a: .96 });
        drawTrack(nadKeys1, NAD.x, NAD.y, NAD.h, { t, phase: 2.1, grade: NIGHT, a: .96 });
        maskRedraw(c);
        propLizard(LIZ.x, LIZ.y, LIZ.s, t, { flip: true, phase: 1.2, period: 5.2 });
        // front row : Junior at the right edge, watching ; Christelle reaching ; Mireille and the envelope in front
        drawPuppet(K('junior', 1), JX1, JY, JH, { t, phase: 4.4, grade: NIGHT, flip: true });
        drawTrack(chrKeys1, CHR1.x, CHR1.y, CHR1.h, chrO(t));
        drawMireilleEnv(MIR.x, MIR.y, MIR.h, mirO(t), mirArmAt(t));
        const bh = pupAt(K('boris', 2), BOR.x, BOR.y, BOR.h, { t, phase: 3.3 }, { bone: 'head', end: 'b' }, [0, 0]);
        bdMarks('surprise', { x: bh.x, y: bh.y + 30 }, .9, t, tw('S1', 'tombe'), tw('S1', 'tombe', .9));
        const nh = pupAt(K('nadege', 3), NAD.x, NAD.y, NAD.h, { t, phase: 2.1 }, { bone: 'head', end: 'a' }, [0, .2]);
        bdMarks('laugh', { x: nh.x + 4, y: nh.y - 62 }, .9, t, tw('S1', 'mais'), tw('S1', 'mais', 1.3));
      },
      screen(t) {
        if (!c1) return;
        const hd = pupAt(MK, MIR.x, MIR.y, MIR.h, mirO(t), { bone: 'head', end: 'b' }, [.02, 0]), hs = stageToScreen(c1, hd.x, hd.y);
        // the balloon rides down with her head as the camera pulls back (short tail), never below the sky
        balloon(t, { t0: BAL1.t0, t1: BAL1.t1, text: "Pas de note de douane, pas d'enveloppe !", x: 300, y: clamp(hs.y - 250, 372, 740), w: 470, kind: 'shout', size: 52, seed: 5,
          tail: tailAt(c1, hd, 0, -6) });
        dayCard(t, BAL1.t1 + .2, 'SAMEDI SOIR · MBOPPI', { size: 54 });
      } });

    // ======================================================================================================
    // P2 — S2, S3 — la case glisse (plan moyen à deux) : Christelle veut payer ce soir, rêve de son étal des fêtes ; Junior
    // s'avance avec le ticket de la partie 1 (bordereau orange) ; « Attends… » → « Droit plus TVA. Je connais ! »
    // Mireille stands just left of this tighter framing (out of picture).
    // ======================================================================================================
    const W0 = tw('S3', 'Junior', -.2), W1 = W0 + .85, JX0 = 905, JX2 = 790;     // he steps in from the right edge
    const B1 = { t0: ss('S2', .1), t1: tw('S2', 'mèches', .2) };
    const TH = { t0: tw('S2', 'mèches', .3), t1: tw('S3', 'Junior', .1) };
    const INS = { t0: W1 + .2, t1: te('S3', 'promesse', .55) };
    const B2 = { t0: te('S3', 'promesse', -.05), t1: se('S3', -.2) };
    const B3 = { t0: se('S3', -.25), t1: ss('S4', .15) };
    const chrKeys = [{ t: T2, pose: { k: K('christelle', 2) } }, { t: B3.t0 - .1, pose: { k: K('christelle', 1) } }];
    const junKeys = [{ t: T2, pose: { k: K('junior', 1), flip: true } }, { t: W0, pose: { k: K('junior', 5), flip: true } }, { t: W1, pose: { k: K('junior', 2), flip: true } }];
    const junX = t => lerp(JX0, JX2, eInOutCubic(prog(t, W0, W1)) * .2 + prog(t, W0, W1) * .8);
    const junO = t => ({ t, phase: 4.4, grade: NIGHT, flip: true, talk: on(t, B2.t0, B2.t1), lean: .04 * env(t, B2.t0, B2.t1, .3, .4) + .03 * env(t, B1.t1 - .6, B1.t1 + .6, .3, .4),
      walk: t >= W0 && t < W1 ? { speed: .95, amp: .9 } : null, walkT0: W0 });
    const chr2O = t => ({ t, phase: 0, grade: NIGHT, talk: on(t, B1.t0, B1.t1) || on(t, B3.t0, B3.t1), hop: B3.t0 + .05,
      rot: { head: -.12 * env(t, TH.t0, TH.t1, .5, .5) } });
    const palm = t => pupAt(K('junior', 2), junX(t), JY, JH, junO(t), { bone: 'armL_lo', end: 'b' }, [.33, .27]);
    const SURP2 = B1.t1 - .35;
    let c2 = null;
    defineShot({ id: 'P2', t0: T2, img: 'bg/maquis', seed: 22, inT: .7, inKind: 'slide',
      // y 2000 = bottom-aligned (the camera clamps) : feet stay in frame, faces stay above the caption band
      cam: [{ t: T2, x: 590, y: 2000, z: 1.24 }, { t: TH.t0 + 1, x: 596, y: 2000, z: 1.27 }, { t: W0, x: 598, y: 2000, z: 1.28, e: 'lin' },
        { t: W1 + .1, x: 626, y: 2000, z: 1.34 }, { t: B2.t0, x: 632, y: 2000, z: 1.38 }, { t: T3, x: 630, y: 2000, z: 1.42 }],
      stage(t, n, c) {
        c2 = c;
        parallax(c, .93, () => { ctx.translate(-500 * .07, -905 * .07); garland(t, 250, 742, 760, 676, 70, 3); });
        smoke(t, 20, 1780, .6);
        drawTrack([{ t: T2, pose: { k: K('boris', 2) } }, { t: SURP2, pose: { k: K('boris', 4), hop: SURP2 + .05 } }], BOR.x, BOR.y, BOR.h, { t, phase: 3.3, grade: NIGHT, a: .96 });
        drawPuppet(K('nadege', 1), NAD.x, NAD.y, NAD.h, { t, phase: 2.1, grade: NIGHT, hop: B1.t1 - .2, a: .96 });
        maskRedraw(c);
        propLizard(LIZ.x, LIZ.y, LIZ.s, t, { flip: true, phase: 3.1, period: 7.5, pushAt: tw('S3', 'avant', -.1) });
        const bh = pupAt(K('boris', 4), BOR.x, BOR.y, BOR.h, { t, phase: 3.3 }, { bone: 'head', end: 'b' }, [0, 0]);
        bdMarks('surprise', { x: bh.x, y: bh.y + 30 }, .9, t, SURP2 + .05, SURP2 + .95);
        drawTrack(chrKeys, CHR.x, CHR.y, CHR.h, chr2O(t));
        drawTrack(junKeys, junX(t), JY, JH, junO(t));
        if (t >= W1) {                                                     // the Part 1 ticket, standing on his open palm
          const p = palm(t), k = clamp(spring(t - W1 - .05, 13, .55), 0, 1.1);
          ctx.save(); ctx.translate(p.x + 4, p.y + 6); ctx.scale(k, k); ticketSlip(0, -54, 70, { rot: -.12 + Math.sin(t * 3.7) * .03, lift: 6 }); ctx.restore();
        }
      },
      screen(t) {
        if (!c2) return;
        const ch2 = pupAt(K('christelle', 2), CHR.x, CHR.y, CHR.h, chr2O(t), { bone: 'head', end: 'b' }, [.06, 0]);
        const ch1 = pupAt(K('christelle', 1), CHR.x, CHR.y, CHR.h, chr2O(t), { bone: 'head', end: 'b' }, [.06, 0]);
        const jh = pupAt(K('junior', 2), junX(t), JY, JH, junO(t), { bone: 'head', end: 'b' }, [.02, 0]);
        balloon(t, { t0: B1.t0, t1: B1.t1, text: 'Mon fournisseur, je le paie ce soir !', x: 470, y: 680, w: 560, seed: 7, tail: tailAt(c2, ch2, -6, -4) });
        const hs = stageToScreen(c2, ch2.x, ch2.y);
        thinkCloud(t, TH.t0, TH.t1, clamp(hs.x, 340, 700), 520, 600, 440, { x: hs.x, y: hs.y - 14 }, dreamStall);
        const pp = palm(t), ps = stageToScreen(c2, pp.x, pp.y - 50);
        ticketInset(t, INS.t0, INS.t1, 30, 250, 540, 520, ps);
        balloon(t, { t0: B2.t0, t1: B2.t1, text: "Attends. Et la douane, tu l'as comptée ?", x: 790, y: 500, w: 430, seed: 8, tail: tailAt(c2, jh, -10, -4) });
        balloon(t, { t0: B3.t0, t1: B3.t1, text: 'Droit plus TVA. Je connais !', x: 330, y: 560, w: 470, seed: 9, tail: tailAt(c2, ch1, 0, -6) });
      } });

    // ======================================================================================================
    // P3 — S4 — plongée sur la table : la main de Mireille pose le cahier ; le fournisseur tient son prix ; la page tourne sur
    // le compte à rebours ; la main reste sur l'enveloppe ; Christelle (hors champ) relève le défi
    // ======================================================================================================
    const PH = { x: 215, y: 520, w: 260, rot: -.12 }, CA = { x: 610, y: 980, w: 620, rot: .03 }, EN = { x: 470, y: 1420, w: 380, rot: -.07 };
    const LAND = T3 + .5, TMSG = tw('S4', 'tient'), TURN0 = tw('S4', 'semaine', -.1), TURN1 = TURN0 + .75;
    const CD = { l1: TURN1 + .05, l2: TURN1 + .55, l3: tw('S4', 'vraie', -.1) };
    const B4 = { t0: se('S4', -1.05), t1: shotStart('S5', -.1) };                // ≥ 1.8 s on screen
    const REST = { x: 835, y: 1555, r: -1.05 };
    // Mireille's hand : holds the book → lets go → takes the page corner → turns the page → rests on the envelope
    const handAt = t => {
      const d = 1 - eOutCubic(prog(t, T3, LAND)), hold = { x: CA.x + 190 + 60 * d, y: CA.y + 300 + 90 * d, r: -.28 };
      const corner = { x: CA.x + CA.w / 2 + 34, y: CA.y + 70, r: -1.3 };
      if (t < TURN0 - .9) return Object.assign(hold, { lift: 14 + 30 * d });
      if (t < TURN0) { const u = eInOutCubic(prog(t, TURN0 - .9, TURN0)); return { x: lerp(hold.x, corner.x, u), y: lerp(hold.y, corner.y, u), r: lerp(hold.r, corner.r, u), lift: 14 + 18 * Math.sin(u * Math.PI) }; }
      const TL = TURN0 + (TURN1 - TURN0) * .42;                          // she lets the page go just before the spine : it falls by itself
      if (t < TL) { const u = eInOutCubic(prog(t, TURN0, TURN1)); return { x: CA.x + (CA.w / 2 + 34) * Math.cos(u * Math.PI), y: CA.y + 70 - 26 * Math.sin(u * Math.PI), r: -1.3, lift: 22 }; }
      const u0 = eInOutCubic(.42), from = { x: CA.x + (CA.w / 2 + 34) * Math.cos(u0 * Math.PI), y: CA.y + 70 - 26 * Math.sin(u0 * Math.PI) };
      const u = eInOutCubic(prog(t, TL, TL + .7)), pat = env(t, TL + 1.2, TL + 1.55, .1, .2);
      return { x: lerp(from.x, REST.x, u), y: lerp(from.y, REST.y, u) - 40 * Math.sin(u * Math.PI), r: lerp(-1.3, REST.r, u), lift: 14 + 30 * Math.sin(u * Math.PI) + 10 * pat };
    };
    let c3 = null;
    defineShot({ id: 'P3', t0: T3, img: 'bg/table_maquis_dessus', seed: 23, inT: 0, inKind: 'cut',
      cam: [{ t: T3, x: 480, y: 820, z: 1.1 }, { t: T3 + .3, x: 475, y: 812, z: 1.12, e: 'lin' }, { t: TMSG + .5, x: 300, y: 600, z: 1.75 },
        { t: TURN0 - .6, x: 304, y: 604, z: 1.78, e: 'lin' }, { t: TURN0 + .45, x: 600, y: 1005, z: 1.3 }, { t: shotStart('S5', .7), x: 598, y: 1012, z: 1.36, e: 'lin' }],
      stage(t, n, c) {
        c3 = c;
        propEnvelope(EN.x, EN.y, EN.w, { rot: EN.rot, label: 'TONTINE', lift: 8 });
        const buzz = env(t, TMSG - .02, TMSG + .35, .02, .1) * Math.sin(t * 90) * .012;
        propPhone(PH.x, PH.y, PH.w, { rot: PH.rot + buzz, glow: t > TMSG - .6 ? 'rgba(255,196,110,.55)' : null }, (sw, sh) => supplierChat(t, sw, sh, TMSG));
        // the book comes down from Mireille's side and lands (thump)
        const d = 1 - eOutCubic(prog(t, T3, LAND)), turn = eInOutCubic(prog(t, TURN0, TURN1));
        ctx.save(); ctx.translate(CA.x + 60 * d, CA.y + 90 * d); ctx.scale(1 + .1 * d, 1 + .1 * d);
        propCahier(0, 0, CA.w, { rot: CA.rot, lift: 8 + 40 * d, turn, fnNext: (pw, ph) => countdownPage(t, pw, ph, CD) }, scribbles(80, 6), scribbles(90, 5));
        ctx.restore();
        const h = handAt(t); propHand(h.x, h.y, 1.9, { rot: h.r, pose: 'flat', lift: h.lift, arm: 1100 });
      },
      screen(t) {
        balloon(t, { t0: B4.t0, t1: B4.t1, text: 'Samedi, tu verras, Tantine !', x: 330, y: 480, w: 520, seed: 11, tail: [-40, 650] });
      } });
    addShake(LAND, 6, .14);                                                // the book lands on the table (sound cue)
  });
})();

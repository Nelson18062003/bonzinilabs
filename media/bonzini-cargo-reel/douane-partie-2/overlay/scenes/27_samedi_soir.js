// ============================================================================================================
// 27_samedi_soir — P23, P24, P25 (S25–S27) : samedi soir au maquis, le dénouement.
//   P23  (fade) Tantine Mireille (M4) tend l'enveloppe « TONTINE » fermée (tenue dans la main posée sur la hanche) ; Christelle (C3) émue, main sur la bouche ;
//        bulle « Estimation bien faite : paie ton fournisseur ! ». Raccord en plongée (P23b, BG9) : la main de Christelle
//        prend l'enveloppe de la main de Mireille ; sur la table la proforma finale (une ligne rayée et réécrite, tampon
//        « TOUJOURS PLUS DE 2 M F FOB »), la note « ESTIMATION » ; sa main au feutre lettre « DOUANE · MIS DE CÔTÉ ».
//   P24  (cut) Boris (B4) tient son carton « PAS AVANT SAMEDI » devant lui, le tend et l'ouvre : un cadre vide « MA PREMIÈRE
//        QUITTANCE » en sort ; Christelle, Junior, Nadège éclatent de rire ; poussée sur le carton.
//   P25  (cut) la bande composée (Christelle et son cadre, Junior qui rougit, Nadège, Boris, le margouillat) + Mireille
//        M2 au bord gauche ; le cahier de tontine ouvert « PROCHAIN TOUR : BORIS » ; « Merci pour ton “Attends !”,
//        Junior. » → « À la prochaine commande… » → la bande : « … on saura avant ! ».
// Everything lives inside this IIFE (all scene files share one global scope).
// ============================================================================================================
(() => {
  'use strict';
  const NIGHT = GRADE.night, NIGHT_BACK = Object.assign({}, GRADE.night, { mul: '#8990C0', rimA: .3 });   // back row : a touch dimmer
  const K = (who, n) => `cast/${who}_${n}`;
  const PHC = 0, PHJ = 2.1, PHN = 4.3, PHB = 5.7, PHM = 3.3;              // breathing phases (same as the other days)
  const VIO = '#6A22C9', CHR_SLEEVE = { sleeve: '#2E8B57', dots: 'rgba(250,200,60,.9)' };

  // ---------- the maquis layout of P1/P2 (stage units on bg/maquis, 1000 × 1800) -----------------------------------
  // front row on the terrace floor (feet y 1764) ; back row behind the table (feet y ≈ 1556, ×.74 : farther away)
  const JH = 760, JY = 1764, BY = 1556, BACK = .74;
  const HC = JH * .98, HM = JH * .92, HB = JH * .96, HN = JH;
  const MASK = [[150, 1800], [150, 1372], [168, 1356], [240, 1346], [300, 1360], [308, 1408], [360, 1400], [500, 1392], [640, 1396],
    [692, 1404], [700, 1392], [748, 1370], [800, 1374], [838, 1388], [842, 1800]];
  function maskRedraw(c) {                                                  // the table and front chairs, over the back row
    const I = img('bg/maquis'); if (!I) return;
    ctx.save(); ctx.beginPath(); MASK.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    ctx.drawImage(I, 0, 0, c.iw, c.ih); ctx.restore();
  }

  // ---------- puppet helpers (same formulas as drawPuppet, so that props follow hands and balloons follow mouths) ------
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
  /** stage point of a rig-pixel point p carried by a bone (default the head) — null when the rig is missing */
  function pupPoint(key, x, y, h, o, p, bone = 'head') {
    const R = RIGS[key]; if (!R) return null;
    const dir = o.flip ? -1 : 1, M = boneMats(R, pupRot(R, o), o.off || {}), q = aff.ap(M[bone] || aff.I(), p), s = h / R.h, L = pupLift(o);
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce), s };
  }
  /** spec = { bone, end } | { mouth: true } | { hands: true } ; fb = [dx (toward the facing side), dy from the head top] in h */
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
  /** pose track: keys [{ t, pose: { k, …opts } }] → clean cut + small squash-and-settle pop at the feet */
  function drawTrack(keys, x, y, h, o) {
    const S = poseAt(keys, o.t, .01), P = S.pose, pop = S.since >= 0 && S.since < .16 && keys[0].pose !== P ? Math.sin(S.since / .16 * Math.PI) : 0;
    ctx.save(); if (pop) { ctx.translate(x, y); ctx.scale(1 + .025 * pop, 1 - .035 * pop); ctx.translate(-x, -y); }
    drawPuppet(P.k, x, y, h, Object.assign({}, o, P));
    ctx.restore();
    return P;
  }
  const keyAt = (keys, t) => poseAt(keys, t, .01).pose;
  const on = (t, a, b) => (t >= a && t <= b ? 1 : 0);
  /** balloon tail: aims at the mouth but stops above the head top (never on the face) */
  const tailTo = (c, mouth, top, dx = 0) => { const m = stageToScreen(c, mouth.x, mouth.y), tp = stageToScreen(c, top.x, top.y); return [m.x + dx, Math.min(m.y - 16, tp.y - 10)]; };
  const mouthOf = (key, x, y, h, o, fb = [.04, .16]) => pupAt(key, x, y, h, o, { mouth: true }, fb);
  const topOf = (key, x, y, h, o) => pupAt(key, x, y, h, o, { bone: 'head', end: 'b' }, [.03, 0]);
  /** centre and radius of the head (from the rig's face), following the head bone */
  function headOf(key, x, y, h, o) {
    const R = RIGS[key]; if (!R || !R.face) return { x, y: y - h * .9, r: h * .07 };
    const F = R.face, ex = (F.eyes[0][0] + F.eyes[1][0]) / 2, ey = (F.eyes[0][1] + F.eyes[1][1]) / 2, d = F.mouth[1] - ey;
    const c = pupPoint(key, x, y, h, o, [ex, ey - d * .3]);
    return { x: c.x, y: c.y, r: d * 2.2 * h / R.h };
  }

  // ---------- BD marks (stage units, drawn over the puppets) --------------------------------------------------------
  /** laugh lines: on each side of the head two short concentric arcs and a little spark, jiggling */
  function laughLines(c, t, t0, t1) {
    const k = env(t, t0, t1, .1, .25); if (k <= 0) return; const pop = clamp(spring(t - t0, 16, .45), 0, 1.2), w = Math.max(3, c.r * .085);
    ctx.save(); ctx.globalAlpha *= k;
    for (const sd of [-1, 1]) {
      const jig = Math.sin(t * 22 + sd) * .05;
      for (let i = 0; i < 2; i++) { const rr = c.r * (1.08 + i * .2) * (.9 + .1 * pop), a0 = (sd > 0 ? 0 : Math.PI) - .38 + jig, pts = [];
        for (let j = 0; j <= 8; j++) { const a = a0 + j / 8 * .76 * pop; pts.push([c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr]); }
        inkPath(pts, { w, seed: 240 + i * 2 + sd }); }
      const a = (sd > 0 ? 0 : Math.PI) - sd * .85 + jig, r0 = c.r * 1.12, L = c.r * .3 * pop;
      inkLine(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, c.x + Math.cos(a) * (r0 + L), c.y + Math.sin(a) * (r0 + L), { w, seed: 250 + sd });
    }
    ctx.restore();
  }
  /** little four-point sparkles around a head (emotion, joy) */
  function sparkles(c, t, t0, t1, n = 3, seed = 0) {
    const k = env(t, t0, t1, .12, .3); if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= k;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * .62 + (hash(i + seed) - .5) * .3, r0 = c.r * (1.35 + .15 * hash(i * 3 + seed));
      const p = clamp(spring(t - t0 - i * .09, 15, .4), 0, 1.25), s = c.r * .17 * p * (1 + .15 * Math.sin(t * 9 + i * 2));
      const x = c.x + Math.cos(a) * r0, y = c.y + Math.sin(a) * r0;
      ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s * .8, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s * .8, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.closePath();
      ctx.fillStyle = '#FFE27A'; ctx.fill(); ctx.lineWidth = Math.max(2, c.r * .035); ctx.strokeStyle = BD.ink; ctx.stroke();
    }
    ctx.restore();
  }
  /** a tear of joy rolling down from an eye corner */
  function tearDrop(x, y, s, t, t0, t1) {
    const k = env(t, t0, t1, .2, .3); if (k <= 0) return; const u = clamp((t - t0) / (t1 - t0));
    ctx.save(); ctx.translate(x, y + u * 22 * s); ctx.scale(s * (.5 + .5 * k), s * (.5 + .5 * k)); ctx.globalAlpha *= k;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.bezierCurveTo(6, -10, 13, 0, 12, 7); ctx.bezierCurveTo(11, 15, -11, 15, -12, 7); ctx.bezierCurveTo(-13, 0, -6, -10, 0, -22); ctx.closePath();
    ctx.fillStyle = '#A9DCF5'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-4, 3, 2.5, 5, -.3, 0, 7); ctx.fill();
    ctx.restore();
  }
  /** a drawn thumb (side view) laid over something held: base at (x, y), pointing along rot (0 = up) */
  function thumb(x, y, s, rot, skin) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(-8.5, -20); ctx.arc(0, -20, 8.5, Math.PI, 0); ctx.lineTo(8, 8); ctx.closePath();
    ctx.fillStyle = skin; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = 'rgba(240,200,170,.55)'; ctx.beginPath(); ctx.ellipse(0, -21, 4, 5.5, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- atmosphere : garland (lights up at nightfall), grill smoke, dusk sky ---------------------------------------
  function rgba(hex, a) { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; }
  function garland(t, x0, y0, x1, y1, sag, seed, lit = 1) {
    const N = Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40)), pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.3 + u * 5) * 2]); }
    inkPath(pts, { w: 2.6, color: 'rgba(18,12,10,.9)', seed, wob: .6 });
    const cols = ['#FFC15A', '#F26A21', '#A66BFF', '#FFE27A', '#FF6B5A'];
    for (let i = 1; i < N; i++) {
      const on1 = clamp(lit * (N + 1) - i), [bx, by0] = pts[i], by = by0 + 12, col = cols[(i + seed) % 5];
      const tw = (.6 + .4 * Math.sin(t * (1.6 + hash(i + seed) * 2.4) + i * 1.9)) * on1;
      if (on1 > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, 40 + 14 * Math.max(0, 1 - Math.abs(on1 - .7) * 3)); g.addColorStop(0, rgba(col, .55 * tw)); g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g; ctx.fillRect(bx - 56, by - 56, 112, 112); ctx.restore(); }
      inkLine(bx, by0, bx, by - 6, { w: 2, color: 'rgba(18,12,10,.9)', seed: i });
      ctx.beginPath(); ctx.ellipse(bx, by, 6.5, 9, 0, 0, 7); ctx.fillStyle = on1 > 0 ? rgba(col, .75 + .25 * tw) : 'rgba(80,70,64,.85)'; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(18,12,10,.8)'; ctx.stroke();
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
  function duskSky(k) {                                                     // end of the day : the sky turns from dusk to night
    if (k <= 0) return;
    ctx.save(); const g = ctx.createLinearGradient(0, 0, 0, 1150);
    g.addColorStop(0, `rgba(255,128,70,${.55 * k})`); g.addColorStop(.55, `rgba(255,170,90,${.35 * k})`); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1150); ctx.restore();
  }

  // ---------- the proforma (same drawing as P9–P11, 23_mardi) : the FINAL version — one line struck and rewritten by hand,
  // stamp « TOUJOURS PLUS DE 2 M F FOB » (no figure) ---------------------------------------------------------------------
  function boxStamp(x, y, lines, size, color, k, o = {}) {
    if (k <= 0) return;
    const f = font(FF.bd, size, 400), lw = Math.max(...lines.map(l => measure(l, f, 2))), w = lw + size * 1.0, h = lines.length * size * 1.08 + size * .55;
    const s = 1 + (1 - eOutCubic(clamp(k))) * .5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.12); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 3) * (o.a ?? .95);
    ctx.fillStyle = o.fill || 'rgba(255,248,236,.5)'; ctx.fillRect(-w / 2, -h / 2, w, h);
    inkRect(-w / 2, -h / 2, w, h, { w: size * .14, color, seed: o.seed || 41 }); inkRect(-w / 2 + size * .2, -h / 2 + size * .2, w - size * .4, h - size * .4, { w: size * .05, color, seed: (o.seed || 41) + 1 });
    lines.forEach((l, i) => text(l, 0, -h / 2 + size * .3 + size * .86 + i * size * 1.08, { font: f, align: 'center', color, ls: 2 }));
    ctx.globalAlpha *= .5; ctx.fillStyle = '#F6EAD2';                       // starved ink
    for (let i = 0; i < 46; i++) { ctx.beginPath(); ctx.arc((hash(i * 3.3 + 7) - .5) * w * .94, (hash(i * 5.9 + 1) - .5) * h * .9, .6 + hash(i * 1.7) * 1.8, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function proformaFinal(x, y, w, o = {}) {
    const h = w * 1.32;
    paperSheet(x, y, w, h, { rot: o.rot || 0, lift: o.lift ?? 12, seed: 17 }, () => {
      text('PROFORMA', w / 2, h * .13, { font: font(FF.bd, w * .14, 400), align: 'center', color: BD.ink, ls: 2 });
      inkLine(w * .14, h * .165, w * .86, h * .16, { w: Math.max(1.5, w * .014), color: BD.orange, seed: 3 });
      ctx.save(); ctx.translate(w * .1, h * .22);                            // container + a bundle of mèches (no figure)
      ctx.fillStyle = '#C8553D'; ctx.fillRect(0, 0, w * .36, h * .12); inkRect(0, 0, w * .36, h * .12, { w: Math.max(1.2, w * .012), seed: 5 });
      for (let i = 1; i < 7; i++) inkLine(w * .36 * i / 7, h * .012, w * .36 * i / 7, h * .108, { w: Math.max(1, w * .007), color: 'rgba(30,21,18,.55)', seed: 6 + i, wob: .4 });
      ctx.restore();
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const bx = w * (.6 + i * .035); ctx.strokeStyle = ['#2A1A12', '#D9A441', '#7A3B1F'][i % 3]; ctx.lineWidth = Math.max(1.5, w * .02);
        ctx.beginPath(); ctx.moveTo(bx, h * .22); ctx.quadraticCurveTo(bx + w * .03, h * .28, bx - w * .01, h * .35); ctx.stroke(); }
      ctx.fillStyle = BD.amber; ctx.fillRect(w * .58, h * .21, w * .26, h * .025); ctx.restore();
      for (let i = 0; i < 6; i++) {                                         // handwriting-like lines (no letters, no figure)
        const yy = h * (.42 + i * .068), L = w * (.42 + hash(i * 3.7) * .3), P = [];
        for (let k = 0; k <= 22; k++) { const u = k / 22; P.push([w * .1 + L * u, yy + Math.sin(u * 30 + i) * h * .008 + Math.sin(u * 71 + i * 2) * h * .004]); }
        inkPath(P, { w: Math.max(1, w * .009), color: '#5A4A3E', seed: 40 + i, wob: .3 });
        inkLine(w * .76, yy, w * .9, yy, { w: Math.max(1, w * .009), color: '#5A4A3E', seed: 50 + i, wob: .3 });
        if (i === 1) {                                                      // the order line, struck out and rewritten by hand (smaller)
          inkLine(w * .08, yy - h * .004, w * .92, yy + h * .002, { w: Math.max(2, w * .012), color: BD.red, seed: 90, wob: .8 });
          const Q = []; for (let k = 0; k <= 16; k++) { const u = k / 16; Q.push([w * .2 + w * .36 * u, yy - h * .036 + Math.sin(u * 26) * h * .009 + Math.sin(u * 61) * h * .004]); }
          inkPath(Q, { w: Math.max(1.6, w * .011), color: '#2B3A8C', seed: 91, wob: .4 });
          inkLine(w * .76, yy - h * .036, w * .87, yy - h * .036, { w: Math.max(1.6, w * .011), color: '#2B3A8C', seed: 92, wob: .4 });
          inkPath([[w * .15, yy - h * .01], [w * .175, yy - h * .05], [w * .2, yy - h * .01]], { w: Math.max(1.4, w * .009), color: '#2B3A8C', seed: 93 });   // insertion caret
        }
      }
      inkLine(w * .1, h * .83, w * .9, h * .83, { w: Math.max(1.2, w * .011), seed: 60 });
      inkPath(Array.from({ length: 12 }, (_, i) => [w * (.58 + i * .028), h * .9 + Math.sin(i * 1.9) * h * .018]), { w: Math.max(1.2, w * .011), color: '#2B3A8C', seed: 61 });
      boxStamp(w * .5, h * .7, ['TOUJOURS', 'PLUS DE', '2 M F FOB'], o.stampSize || w * .11, VIO, 1, { rot: -.13, seed: 81 });
    });
  }
  /** the yellow « ESTIMATION » stamp (as in P14, 24_mercredi) */
  function estimationStamp(x, y, w, rot = -.1) {
    const h = w * .25;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    withShadow(6, () => { ctx.fillStyle = '#FFD84A'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: Math.max(3, w * .012), seed: 21 }); inkRect(-w / 2 + w * .025, -h / 2 + w * .025, w * .95, h - w * .05, { w: Math.max(1.5, w * .005), seed: 22 });
    text('ESTIMATION', 0, h * .24, { font: font(FF.bd, h * .66, 400), align: 'center', color: BD.ink, ls: w * .012 });
    ctx.fillStyle = 'rgba(255,248,214,.6)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((hash(i * 3.1) - .5) * w * .96, (hash(i * 5.7) - .5) * h * .9, (.5 + hash(i) * 1.6) * w / 300, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  /** Christelle's note (kraft, pinned) : neat lines, no figure, the ESTIMATION stamp */
  function noteEstimation(x, y, w, h, rot) {
    kraftSheet(x, y, w, h, { seed: 7, pin: true, lift: 12, rot }, (ww, hh) => {
      inkPath(Array.from({ length: 14 }, (_, k) => [ww * .2 + ww * .6 * k / 13, hh * .13 + Math.sin(k * 1.7) * 3]), { w: 5, color: '#2A1C14', seed: 141, wob: .5 });
      inkLine(ww * .14, hh * .18, ww * .86, hh * .18, { w: 3.5, color: BD.orange, seed: 142 });
      for (let i = 0; i < 7; i++) {
        const yy = hh * (.29 + i * .085), L = ww * (.36 + hash(i * 5.3 + 2) * .22), P = [];
        for (let k = 0; k <= 18; k++) { const u = k / 18; P.push([ww * .1 + L * u, yy + Math.sin(u * 27 + i) * 3 + Math.sin(u * 63 + i) * 1.4]); }
        inkPath(P, { w: 2.6, color: '#3A2A1E', seed: 150 + i, wob: .3 });
        inkLine(ww * .74, yy, ww * .9, yy, { w: 2.6, color: '#3A2A1E', seed: 160 + i, wob: .3 });
      }
      inkLine(ww * .1, hh * .9, ww * .9, hh * .9, { w: 3.5, color: '#2A1C14', seed: 170 });
      estimationStamp(ww * .5, hh * .62, ww * .86, -.12);
    });
  }

  // ---------- the empty frame « MA PREMIÈRE QUITTANCE » (Boris' present) — o.label false hides the label ----------------
  const FRM = { w: 170, h: 206 };
  function quittanceFrame(x, y, rot, o = {}) {
    const fw = o.w || FRM.w, fh = o.h || FRM.h;
    propFrame(x, y, fw, fh, { rot, lift: o.lift ?? 8 }, (iw, ih) => {
      ctx.save(); ctx.setLineDash([9, 8]); ctx.strokeStyle = 'rgba(110,84,58,.6)'; ctx.lineWidth = 2.5;      // the empty place, waiting
      ctx.strokeRect(iw * .17, ih * .1, iw * .66, ih * .44); ctx.restore();
    });
    if (o.label === false) return;
    // the hand-lettered sticker « MA PREMIÈRE QUITTANCE », taped across the lower part of the frame
    const sz = o.size || 30, f = font(FF.bd, sz, 400), lw = Math.max(measure('MA PREMIÈRE', f, 1), measure('QUITTANCE', f, 1)) + 20, lh = sz * 2.25;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.translate(0, fh * .2); ctx.rotate(-.04);
    withShadow(3, () => { ctx.fillStyle = '#FFF3D2'; ctx.fillRect(-lw / 2, -lh / 2, lw, lh); });
    inkRect(-lw / 2, -lh / 2, lw, lh, { w: 2.2, seed: 181 });
    ctx.fillStyle = 'rgba(243,167,69,.75)'; ctx.fillRect(-lw / 2 - 8, -lh / 2 - 6, 30, 14); ctx.fillRect(lw / 2 - 22, -lh / 2 - 6, 30, 14);   // tape
    text('MA PREMIÈRE', 0, -lh / 2 + sz * 1.0, { font: f, align: 'center', color: BD.ink, ls: 1 });
    text('QUITTANCE', 0, -lh / 2 + sz * 2.0, { font: f, align: 'center', color: BD.red, ls: 1 });
    ctx.restore();
  }

  // ---------- Boris' box, opened : the same drawing as propCarton (colours, ink, hatch, tag) but its flaps fold OUT —
  // the back flap stands up behind, the side flaps open left and right, the front one folds down over the face — so that
  // the frame rising from it stays visible down to the front edge. (x, y) = centre of the front face.
  function borisBox(x, y, w, o = {}) {
    const h = w * .72, d = w * .32, dx = d * .6, dy = d * .6, k = clamp(o.open || 0), kf = Math.max(0, o.open || 0);
    const FL = [-w / 2, -h / 2], FR = [w / 2, -h / 2], BR = [w / 2 + dx, -h / 2 - dy], BL = [-w / 2 + dx, -h / 2 - dy];
    const poly = (P, fill, ink = 3, seed = 70) => { ctx.beginPath(); P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (ink) inkPath(P.concat([P[0]]), { w: ink, seed }); };
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
    if (k > 0) {                                                            // back flap, standing up behind the opening
      const L = d * 1.05 * kf; poly([BL, BR, [BR[0] + 6 * k, BR[1] - L], [BL[0] + 6 * k, BL[1] - L]], '#D49A57', 3, 75);
    }
    withShadow(o.lift ?? 8, () => { ctx.fillStyle = '#C8904F'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    if (k <= 0) {                                                           // closed : top face + tape (as propCarton)
      poly([FL, BL, BR, FR], '#DDA965', 0);
      ctx.fillStyle = 'rgba(235,225,190,.75)'; ctx.beginPath(); ctx.moveTo(-w * .08 + d * .3, -h / 2 - d * .6); ctx.lineTo(w * .08 + d * .3, -h / 2 - d * .6); ctx.lineTo(w * .08, -h / 2); ctx.lineTo(-w * .08, -h / 2); ctx.closePath(); ctx.fill();
      ctx.fillRect(-w * .08, -h / 2, w * .16, h * .35);
    } else poly([[FL[0] + 5, FL[1] - 1], [BL[0] + 3, BL[1] + 3], [BR[0] - 5, BR[1] + 3], [FR[0] - 3, FR[1] - 1]], '#5B3A1C', 0);
    ctx.fillStyle = '#A9743C'; ctx.beginPath(); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(w / 2 + dx, -h / 2 - dy); ctx.lineTo(w / 2 + dx, h / 2 - dy); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
    hatch(w / 2, -h / 2 - dy, dx, h, { gap: 12, w: 1.6 });
    if (k > 0 && o.inside) {                                                // what rises from the box : clipped at the front edge
      ctx.save(); ctx.beginPath(); ctx.rect(-w * 2, -h * 8, w * 4, h * 8 - h / 2); ctx.clip(); o.inside(w, h, k, { x: d * .3, y: -h / 2 - d * .3 }); ctx.restore();
    }
    if (k > 0) {                                                            // side flaps folding out, front flap folded down
      const sx = d * .95 * kf, sy = d * .3 * kf;
      poly([FL, BL, [BL[0] - sx, BL[1] - sy], [FL[0] - sx, FL[1] - sy]], '#E4B574', 3, 76);
      poly([FR, BR, [BR[0] + sx * .7, BR[1] - sy], [FR[0] + sx * .7, FR[1] - sy]], '#D9A562', 3, 77);
      const fd = h * .26 * k; poly([[FL[0] + 2, FL[1]], [FR[0] - 2, FR[1]], [FR[0] - 6, FR[1] + fd], [FL[0] + 6, FL[1] + fd]], '#E4B574', 3, 78);
    }
    inkRect(-w / 2, -h / 2, w, h, { w: 3.5, seed: 72 });
    inkPath([[-w / 2, -h / 2], [-w / 2 + dx, -h / 2 - dy], [w / 2 + dx, -h / 2 - dy], [w / 2 + dx, h / 2 - dy], [w / 2, h / 2]], { w: 3.5, seed: 73 });
    inkLine(w / 2, -h / 2, w / 2 + dx, -h / 2 - dy, { w: 3, seed: 74 });
    if (o.tag !== false) propTag(-w * .06, h * (k > 0 ? .14 : -.02), w / 320, 'PAS AVANT SAMEDI', { t: o.t, rot: -.05 });
    ctx.restore();
  }

  // ---------- small acting detail : Junior's blush -----------------------------------------------------
  function blush(key, x, y, h, o, k) {
    if (k <= 0) return; const R = RIGS[key]; if (!R || !R.face) return;
    const E = R.face.eyes, mx = (E[0][0] + E[1][0]) / 2, er = R.face.eyeR || 9;
    for (const e of E) {
      const p = pupPoint(key, x, y, h, o, [e[0] + (e[0] - mx) * .35, e[1] + er * 2.1]); if (!p) continue;
      const rx = er * 1.5 * p.s, ry = er * .7 * p.s;
      ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = 'rgba(228,62,78,.42)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, 7); ctx.fill();
      for (let i = -1; i <= 1; i++) inkLine(p.x + i * rx * .45 - rx * .12, p.y + ry * .45, p.x + i * rx * .45 + rx * .12, p.y - ry * .45, { w: 1.8, color: 'rgba(170,30,50,.8)', seed: 190 + i, wob: .3 });
      ctx.restore();
    }
  }


  // ---------- the pen hand (top-down) : wrist position so that the felt-tip touches the point « tip » --------------------
  // propHand 'pen': the tip sits at (-40.2, -168.7) in the hand's local units (fingers up), before rotation and scale.
  function penWrist(tip, rot, s) { const c = Math.cos(rot), sn = Math.sin(rot), lx = -40.2 * s, ly = -168.7 * s; return { x: tip.x - (lx * c - ly * sn), y: tip.y - (lx * sn + ly * c) }; }
  const loc2stage = (E, lx, ly) => ({ x: E.x + lx * Math.cos(E.rot) - ly * Math.sin(E.rot), y: E.y + lx * Math.sin(E.rot) + ly * Math.cos(E.rot) });

  shots(() => {
    // ======================================================================================================
    // P23 — S25 — fade, rideau de fin de journée : le ciel passe à la nuit, les guirlandes s'allument. Deux-plan serré :
    // Tantine Mireille (M4) tient l'enveloppe « TONTINE » dans la main posée sur sa hanche (sa main derrière, le pouce
    // dessiné par-dessus) et la pousse vers Christelle sur « rend » ; Christelle (C3, main sur la bouche) est émue :
    // petit saut, tête penchée, larme de joie, étincelles. L'enveloppe reste au-dessus du récitatif.
    // ======================================================================================================
    const T23 = shotStart('S25'), CUT = te('S25', 'enveloppe', .15);
    const B23 = { t0: ss('S25', .25), t1: te('S25', 'enveloppe', -.1) };
    const REND = tw('S25', 'rend', -.08);
    const MIR = { x: 335, y: 1745, h: HM }, CHR = { x: 640, y: 1745, h: HC };
    const MK = K('mireille', 4), CK = K('christelle', 3);
    const mirO = t => ({ t, phase: PHM, grade: NIGHT, talk: on(t, B23.t0, B23.t1), lean: .06 * env(t, REND, CUT + 2, .4, .2) - .01 });
    const chrO = t => ({ t, phase: PHC, grade: NIGHT, flip: true, hop: tw('S25', 'Tantine', .1), lean: .02 + .05 * env(t, REND + .15, CUT + 2, .5, .2),
      rot: { head: .07 * Math.sin(clamp((t - T23) / 1.2) * Math.PI / 2) } });
    const ENV23 = { w: 150, size: 30 };
    /** the envelope in Mireille's hand on her hip (image right, toward Christelle); on « rend » it slides out toward her */
    const envAt = t => {
      const hd = pupAt(MK, MIR.x, MIR.y, MIR.h, mirO(t), { bone: 'armL_lo', end: 'b' }, [.076, .473]);
      const off = clamp(eOutBack(clamp((t - REND) / .5)), 0, 1.12);
      return { x: hd.x + MIR.h * .072 + 18 * off, y: hd.y - MIR.h * .03 - 10 * off + Math.sin(t * 1.7) * 1.5, rot: -.09 - .07 * off + Math.sin(t * 1.3) * .012 };
    };
    let c23 = null;
    defineShot({ id: 'P23', t0: T23, img: 'bg/maquis', seed: 27, inT: .9, inKind: 'fade',
      // the camera stays on the two women (y clamped to the bottom of the picture) and pushes in slowly
      cam: [{ t: T23, x: 490, y: 1400, z: 1.55 }, { t: tw('S25', 'Tantine'), x: 494, y: 1400, z: 1.61 }, { t: CUT, x: 497, y: 1400, z: 1.7, e: 'lin' }],
      stage(t, n, c) {
        c23 = c;
        duskSky(1 - eInOutCubic(prog(t, T23, T23 + 1.9)));
        const lit = eInOutCubic(prog(t, T23 + .25, T23 + 1.7));
        parallax(c, .93, () => { ctx.translate(-500 * .07, -905 * .07);
          garland(t, 250, 742, 760, 676, 70, 3, lit); garland(t, 640, 640, 1010, 700, 46, 8, lit); garland(t, -30, 872, 1030, 846, 64, 5, lit); });
        smoke(t, 20, 1780, .7);
        const mo = mirO(t), co = chrO(t);
        drawPuppet(MK, MIR.x, MIR.y, MIR.h, mo);
        const e = envAt(t);
        propEnvelope(e.x, e.y, ENV23.w, { rot: e.rot, label: 'TONTINE', size: ENV23.size, lift: 12 });
        {                                                                   // her thumb over the left edge (the hand is behind)
          const lx = -ENV23.w / 2 - 2, ly = -ENV23.w * .1, c0 = Math.cos(e.rot), s0 = Math.sin(e.rot);
          thumb(e.x + lx * c0 - ly * s0, e.y + lx * s0 + ly * c0, MIR.h / 700, e.rot + 1.3, '#6A3520');
        }
        drawPuppet(CK, CHR.x, CHR.y, CHR.h, co);
        const hc = headOf(CK, CHR.x, CHR.y, CHR.h, co), R = RIGS[CK];
        sparkles(hc, t, REND + .3, CUT + .4, 3, 2);
        if (R && R.face) { const p = pupPoint(CK, CHR.x, CHR.y, CHR.h, co, [R.face.eyes[1][0] - 26, R.face.eyes[1][1] + 40]); tearDrop(p.x, p.y, CHR.h / 1700, t, REND + .45, CUT + .3); }
      },
      screen(t) {
        if (!c23) return;
        const o = mirO(t), m = mouthOf(MK, MIR.x, MIR.y, MIR.h, o), tp = topOf(MK, MIR.x, MIR.y, MIR.h, o);
        balloon(t, { t0: B23.t0, t1: B23.t1, text: 'Estimation bien faite : paie ton fournisseur !', x: 330, y: 352, w: 620, size: 50, seed: 31, tail: tailTo(c23, m, tp, 10) });
        dayCard(t, T23 + .6, 'SAMEDI SOIR');
      } });

    // ======================================================================================================
    // P23b — S25 (fin) — raccord en plongée sur la table (BG9) : la main de Christelle prend l'enveloppe des mains de
    // Mireille et la pose ; proforma finale + note ESTIMATION ; sa main au feutre lettre la seconde enveloppe.
    // ======================================================================================================
    const PRO = { x: 292, y: 566, w: 336, rot: -.07 }, NOTE = { x: 742, y: 590, w: 300, h: 404, rot: .06 };
    const ENT = { x: 302, y: 1004, w: 330, rot: -.09 }, END_ = { x: 688, y: 1012, w: 412, rot: .045 };
    const HO = { x: 505, y: 805, rot: .05 };                                // the hand-off point, between the two rows
    const G0 = CUT + .45, GM = G0 + .55, LANDT = GM + .02;                  // grip → carried → lands
    const W1 = Math.max(LANDT + .05, tw('S25', 'met', .02)), D1 = W1 + .62;
    const M0 = Math.max(D1 + .22, tw('S25', 'part', -.15)), M1 = Math.max(M0 + .55, Math.min(M0 + .85, shotStart('S26', -.55)));
    const LETTER = { size1: 60, size2: 40 };
    const eh = END_.w * .6, Y1 = eh * .27, Y2 = eh * .27 + 47;
    const wD = () => measure('DOUANE', font(FF.brush, LETTER.size1, 400)), wM = () => measure('MIS DE CÔTÉ', font(FF.letN, LETTER.size2, 400));
    // the envelope « TONTINE » : in Mireille's hand → carried by Christelle → on the table
    const envT = t => {
      if (t < G0) return { x: HO.x + Math.sin(t * 2.2) * 3, y: HO.y + Math.sin(t * 1.7) * 3, rot: HO.rot, lift: 30 };
      const u = eInOutCubic(prog(t, G0 + .05, LANDT));
      return { x: lerp(HO.x, ENT.x, u), y: lerp(HO.y, ENT.y, u) - 50 * Math.sin(u * Math.PI), rot: lerp(HO.rot, ENT.rot, u), lift: lerp(30, 8, u) + 20 * Math.sin(u * Math.PI) };
    };
    // the pen tip path (stage) : enters from the bottom right, writes the two lines, underlines, lifts away
    const penTip = t => {
      const d0 = loc2stage(END_, -wD() / 2, Y1 - 14), m0 = loc2stage(END_, -wM() / 2, Y2 - 10), off = { x: 940, y: 1640 };
      const writeD = k => loc2stage(END_, -wD() / 2 + wD() * k, Y1 - 16 + Math.sin(k * 38) * 9);
      const writeM = k => loc2stage(END_, -wM() / 2 + wM() * k, Y2 - 11 + Math.sin(k * 44) * 6);
      if (t < W1) { const u = eInOutCubic(prog(t, CUT + .35, W1 - .04)); return { x: lerp(off.x, d0.x, u), y: lerp(off.y, d0.y, u), lift: 26 }; }
      if (t < D1) return Object.assign(writeD(prog(t, W1, D1)), { lift: 6 });
      if (t < M0) { const u = eInOutCubic(prog(t, D1, M0)), a = writeD(1); return { x: lerp(a.x, m0.x, u), y: lerp(a.y, m0.y, u) - 18 * Math.sin(u * Math.PI), lift: 6 + 14 * Math.sin(u * Math.PI) }; }
      if (t < M1) return Object.assign(writeM(prog(t, M0, M1)), { lift: 6 });
      const U0 = M1 + .05, U1 = U0 + .32;
      if (t < U1) { const u = prog(t, U0, U1), p = loc2stage(END_, -wM() / 2 + wM() * u, Y2 + LETTER.size2 * .22); return { x: p.x, y: p.y, lift: 6 }; }
      const u = eOutCubic(prog(t, U1, U1 + .6)), p = loc2stage(END_, wM() / 2, Y2 + 9);
      return { x: p.x + 70 * u, y: p.y + 60 * u, lift: 6 + 26 * u };
    };
    let c23b = null;
    defineShot({ id: 'P23b', t0: CUT, img: 'bg/table_maquis_dessus', seed: 28, inT: 0, inKind: 'cut',
      cam: [{ t: CUT, x: 500, y: 889, z: 1.0 }, { t: LANDT, x: 516, y: 898, z: 1.05 }, { t: M0, x: 530, y: 900, z: 1.1 }, { t: shotStart('S26'), x: 534, y: 902, z: 1.12, e: 'lin' }],
      stage(t, n, c) {
        c23b = c;
        proformaFinal(PRO.x, PRO.y, PRO.w, { rot: PRO.rot, lift: 10, stampSize: 40 });
        noteEstimation(NOTE.x, NOTE.y, NOTE.w, NOTE.h, NOTE.rot);
        // the second envelope, lettered on the voice
        propEnvelope(END_.x, END_.y, END_.w, { rot: END_.rot, label: '', lift: 8 });
        ctx.save(); ctx.translate(END_.x, END_.y); ctx.rotate(END_.rot);
        writeOn('DOUANE', 0, Y1, t, W1, D1 - W1, { size: LETTER.size1, fam: FF.brush, color: '#24160E', align: 'center' });
        writeOn('MIS DE CÔTÉ', 0, Y2, t, M0, M1 - M0, { size: LETTER.size2, fam: FF.letN, color: '#24160E', align: 'center', underline: true, ucolor: BD.orange, uw: 4 });
        ctx.restore();
        // the tontine envelope and the two hands of the hand-off
        const e = envT(t);
        if (t < G0 + .65) {                                                 // Mireille's hand (orange sleeve, blue dots) comes from the far side
          const r = eInCubic(prog(t, G0 + .05, G0 + .65)), hx = t < G0 ? e.x : HO.x, hy = t < G0 ? e.y : HO.y;     // she lets go, her hand goes back up
          propHand(hx + 100 - 24 * r, hy - 210 - 900 * r, 1.55, { rot: Math.PI + .3 - .1 * r, pose: 'flat', lift: 22 + 20 * r, arm: 1300 });
        }
        propEnvelope(e.x, e.y, ENT.w, { rot: e.rot, label: 'TONTINE', lift: e.lift });
        {                                                                   // Christelle's left hand : reaches, grips, carries, lets go, withdraws
          const reach = eOutCubic(prog(t, CUT, G0)), back = eInOutCubic(prog(t, LANDT + .25, LANDT + .85));
          const grip = { x: e.x - 240, y: e.y + 172 }, from = { x: 40, y: 1950 }, away = { x: -120, y: 1990 };   // fingers on the left edge: the label stays readable
          const hx = t < G0 ? lerp(from.x, grip.x, reach) : lerp(grip.x, away.x, back), hy = t < G0 ? lerp(from.y, grip.y, reach) : lerp(grip.y, away.y, back);
          if (back < 1) propHand(hx, hy, 1.55, Object.assign({ rot: .5, pose: 'flat', lift: 12 + 18 * (1 - reach) + 20 * back, arm: 1300 }, CHR_SLEEVE));
        }
        // Christelle's right hand with the felt-tip
        if (t > CUT + .3) { const p = penTip(t), rot = -.48, s = 1.45, wr = penWrist(p, rot, s);
          propHand(wr.x, wr.y, s, Object.assign({ rot, pose: 'pen', lift: p.lift, arm: 1300 }, CHR_SLEEVE)); }
      } });


    // ======================================================================================================
    // P24 — S26 — Boris ouvre enfin son carton « PAS AVANT SAMEDI » : un cadre vide « MA PREMIÈRE QUITTANCE ».
    // Boris (B4) tient le carton dessiné devant lui, à hauteur du ventre (ses mains dessous) ; sur
    // « pour » il le tend vers Christelle ; il s'ouvre sur « ouvre », le cadre en sort ; poussée de la caméra sur le
    // carton ; Christelle, Junior et Nadège éclatent de rire. Le carton reste au-dessus du récitatif.
    // ======================================================================================================
    const T24 = shotStart('S26'), T24E = shotStart('S27'), SW = tw('S26', 'pour', -.05), OP = tw('S26', 'ouvre', .02), RISE = OP + .3;
    const LAUGH = te('S26', 'carton', -.28);
    const BB = { t1: shotStart('S27', -.04) }; BB.t0 = Math.min(tw('S26', 'ouvre', .45), BB.t1 - 1.85);
    const C24 = { x: 255, y: 1745, h: HC }, B24 = { x: 520, y: 1705, h: HB }, J24 = { x: 735, y: 1740, h: JH }, N24 = { x: 628, y: BY, h: HN * BACK };
    const BK24 = K('boris', 4);                                             // the cleanest face; his hands are behind the box
    const borO = t => ({ t, phase: PHB, grade: NIGHT, hop: t < SW ? tw('S26', 'Boris', .05) : SW + .02, talk: on(t, BB.t0, BB.t1),
      lean: -.045 * env(t, SW, T24E + 1, .3, .2) });
    const cK = [{ t: T24, pose: { k: K('christelle', 1) } }, { t: LAUGH, pose: { k: K('christelle', 3), hop: LAUGH + .02 } }];
    const chrO24 = t => ({ t, phase: PHC, grade: NIGHT, lean: .04 * env(t, OP - .3, LAUGH, .35, .2) });
    const jK = [{ t: T24, pose: { k: K('junior', 1) } }, { t: LAUGH + .14, pose: { k: K('junior', 3), hop: LAUGH + .16 } }];
    const junO24 = t => ({ t, phase: PHJ, grade: NIGHT, flip: true, lean: .045 * env(t, OP - .2, LAUGH + .1, .35, .2) });
    const nadO24 = t => ({ t, phase: PHN, grade: NIGHT_BACK, flip: true, hop: LAUGH + .28, rot: { head: .08 * env(t, LAUGH + .2, T24E + 1, .2, .2) } });
    const BOXW = .28 * B24.h, FW = { w: 150, h: 182 };
    /** the box, held in front of his belly (his hands in his pockets are under it); on « pour » he holds it out to Christelle */
    const boxAt = t => {
      const o = borO(t), R = RIGS[BK24];
      const q = R ? pupPoint(BK24, B24.x, B24.y, B24.h, o, [R.w / 2 - .035 * R.h, .51 * R.h], 'hips') : { x: B24.x - .035 * B24.h, y: B24.y - .49 * B24.h };
      const e = eOutBack(clamp((t - SW) / .4), 1.6);
      return { x: q.x - .03 * B24.h * e, y: q.y - .012 * B24.h * e, w: BOXW * (1 + .05 * e), rot: -.03 - .03 * e + Math.sin(t * 2.4) * .01 };
    };
    let c24 = null;
    defineShot({ id: 'P24', t0: T24, img: 'bg/maquis', seed: 29, inT: 0, inKind: 'cut',
      cam: [{ t: T24, x: 505, y: 1400, z: 1.6 }, { t: SW - .15, x: 505, y: 1400, z: 1.62 }, { t: SW + .5, x: 503, y: 1400, z: 1.66 },
        { t: LAUGH, x: 503, y: 1400, z: 1.72 }, { t: T24E, x: 504, y: 1400, z: 1.75, e: 'lin' }],
      stage(t, n, c) {
        c24 = c;
        parallax(c, .93, () => { ctx.translate(-500 * .07, -905 * .07); garland(t, 250, 742, 760, 676, 70, 3); garland(t, 640, 640, 1010, 700, 46, 8); garland(t, -30, 872, 1030, 846, 64, 5); });
        smoke(t, 20, 1780, .5);
        const no = nadO24(t); drawPuppet(K('nadege', 1), N24.x, N24.y, N24.h, no);
        maskRedraw(c);
        drawPuppet(BK24, B24.x, B24.y, B24.h, borO(t));
        {                                                                   // the box held out : it opens, the frame rises
          const b = boxAt(t), open = clamp(eOutBack(clamp(prog(t, OP, OP + .4)), 1.6), 0, 1.12), rise = clamp(spring(t - RISE, 9, .62), 0, 1.06) * .8;
          borisBox(b.x, b.y, b.w, { t, open, rot: b.rot, lift: 10,
            inside: (w, h, k, O) => { if (rise > 0) quittanceFrame(O.x, O.y + FW.h * .5 - FW.h * rise, Math.sin(t * 1.8) * .025 - .03, { w: FW.w, h: FW.h, lift: 6, size: 30 }); } });
        }
        const jo = junO24(t), jp = drawTrack(jK, J24.x, J24.y, J24.h, jo);
        const co = chrO24(t), cp = drawTrack(cK, C24.x, C24.y, C24.h, co);
        // the laugh : BD laugh lines on Christelle, Junior, Nadège
        laughLines(headOf(cp.k, C24.x, C24.y, C24.h, Object.assign({}, co, cp)), t, LAUGH + .05, T24E + .4);
        laughLines(headOf(jp.k, J24.x, J24.y, J24.h, Object.assign({}, jo, jp)), t, LAUGH + .18, T24E + .4);
        laughLines(headOf(K('nadege', 1), N24.x, N24.y, N24.h, no), t, LAUGH + .3, T24E + .4);
      },
      screen(t) {
        if (!c24) return;
        const o = borO(t), m = mouthOf(BK24, B24.x, B24.y, B24.h, o), tp = topOf(BK24, B24.x, B24.y, B24.h, o);
        balloon(t, { t0: BB.t0, t1: BB.t1, text: 'Pour ta première quittance !', x: 740, y: 214, w: 520, size: 54, seed: 33, tail: tailTo(c24, m, tp, -6) });
      } });
    addShake(OP + .08, 5, .12);                                             // the flaps pop open (sound cue)

    // ======================================================================================================
    // P25 — S27 — la bande au complet autour de la table : Tantine Mireille (M2, souriante) à gauche, Christelle, Junior au premier
    // rang ; Nadège et Boris (sans carton : il l'a offert) derrière la table du fond ; le cahier « PROCHAIN TOUR : BORIS »,
    // le cadre et le margouillat sur la table rouge au premier plan. « Merci pour ton “Attends !”, Junior. » (Junior
    // rougit) → « À la prochaine commande… » → toute la bande : « … on saura avant ! » (une bulle, une queue par bouche).
    // ======================================================================================================
    const T25 = shotStart('S27'), TEND = shotStart('S28');
    const BC = { t0: ss('S27', -.2), t1: se('S27', .1) };
    const BJ = { t0: se('S27', -.02), t1: se('S27', 1.95) };
    const BG = { t0: se('S27', .98) }; BG.t1 = Math.max(TEND + .12, BG.t0 + 1.85);
    const BLUSH = tw('S27', 'fois', -.05);
    const M25 = { x: 168, y: 1738, h: HM * .98 }, C25 = { x: 330, y: JY, h: HC }, J25 = { x: 770, y: JY, h: JH };
    const N25 = { x: 495, y: BY, h: HN * BACK }, B25 = { x: 615, y: BY + 4, h: HB * BACK };
    const MK25 = K('mireille', 2), CK25 = K('christelle', 1), NK25 = K('nadege', 1), BK25 = K('boris', 4);   // M2 / B4 : the cleanest faces
    const FGT = { x: 500, y0: 1500, rx: 640, ry: 330 }, BOOK = { x: 560, y: 1660, w: 400 }, LIZ = { x: 846, y: 1540, s: 1.3 };
    const FRT = { x: 286, y: 1640, k: 1.0 };                              // Boris' frame, standing on the table in front of Christelle
    const shout = t => on(t, BG.t0, BG.t1);
    const cO25 = t => ({ t, phase: PHC, grade: NIGHT, talk: on(t, BC.t0, BC.t1) || shout(t), lean: .03 * env(t, BC.t0, BC.t1, .3, .3), hop: BG.t0 + .05 });
    const jK25 = [{ t: T25, pose: { k: K('junior', 1) } }, { t: BJ.t0 - .08, pose: { k: K('junior', 2) } }, { t: BG.t0 - .02, pose: { k: K('junior', 3), hop: BG.t0 + .1 } }];
    const jO25 = t => ({ t, phase: PHJ, grade: NIGHT, flip: true, talk: on(t, BJ.t0, BJ.t1) || shout(t),
      rot: { head: .1 * env(t, BLUSH, BJ.t0, .4, .3) }, lean: -.03 * env(t, BLUSH, BJ.t0, .4, .3) });
    const nO25 = t => ({ t, phase: PHN, grade: NIGHT_BACK, talk: shout(t), hop: t < BG.t0 ? BLUSH + .32 : BG.t0 + .2 });
    const bO25 = t => ({ t, phase: PHB, grade: NIGHT_BACK, talk: shout(t), hop: BG.t0 + .14 });
    const mO25 = t => ({ t, phase: PHM, grade: NIGHT, talk: shout(t), hop: t < BG.t0 ? BLUSH + .4 : BG.t0 + .08 });
    /** the red plastic maquis table close to the camera (the same table as the top-down shots), back edge at y0 */
    function fgTable(T) {
      const cy = T.y0 + T.ry, ell = (rx, ry, oy = 0) => { ctx.beginPath(); ctx.ellipse(T.x, cy + oy, rx, ry, 0, 0, 7); };
      ctx.save();
      ctx.fillStyle = 'rgba(14,6,4,.5)'; ell(T.rx + 14, T.ry + 10, 30); ctx.fill();
      ctx.fillStyle = PR.tableD; ell(T.rx, T.ry, 16); ctx.fill();
      ctx.fillStyle = PR.table; ell(T.rx, T.ry); ctx.fill();
      ctx.strokeStyle = PR.tableD; ctx.lineWidth = 14; ell(T.rx - 34, T.ry - 22); ctx.stroke();
      ctx.globalAlpha = .2; ctx.strokeStyle = '#FF8A7A'; ctx.lineWidth = 5; for (const k of [.32, .5, .68]) { ell(T.rx * k, T.ry * k, T.ry * .18); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const g = ctx.createLinearGradient(0, T.y0, 0, T.y0 + T.ry * 1.4); g.addColorStop(0, 'rgba(255,186,100,.28)'); g.addColorStop(.45, 'rgba(60,30,70,.12)'); g.addColorStop(1, 'rgba(12,12,44,.5)');
      ctx.fillStyle = g; ell(T.rx, T.ry); ctx.fill();
      inkPath(Array.from({ length: 73 }, (_, i) => { const a = i / 72 * Math.PI * 2; return [T.x + Math.cos(a) * T.rx, cy + Math.sin(a) * T.ry]; }), { w: 6, seed: 221, wob: 1.2 });
      ctx.restore();
    }
    /** the tontine book lying open on that table, lettered « PROCHAIN TOUR : BORIS » (letters less squashed than the page) */
    function bookOnTable(B) {
      const PY = .6, TY = 1.32, pw = B.w / 2;
      ctx.save(); ctx.translate(B.x, B.y); ctx.scale(1, PY); ctx.rotate(-.02);
      propCahier(0, 0, B.w, { lift: 7, cover: '#2F6FB2' }, null, null);
      const f = font(FF.bd, 40, 400), fb = font(FF.bd, 56, 400);
      ctx.save(); ctx.scale(1, TY);
      text('PROCHAIN', -pw / 2 + 6, -10 / TY, { font: f, align: 'center', color: '#24160E', ls: 1 });
      text('TOUR :', -pw / 2 + 6, 58 / TY, { font: f, align: 'center', color: '#24160E', ls: 1 });
      const bw = measure('BORIS', fb, 2);
      text('BORIS', pw / 2 + 6, 26 / TY, { font: fb, align: 'center', color: BD.violet, ls: 2 });
      inkLine(pw / 2 + 6 - bw / 2, 44 / TY, pw / 2 + 6 + bw / 2, 41 / TY, { w: 4.5, color: BD.orange, seed: 211 });
      ctx.restore(); ctx.restore();
    }
    let c25 = null;
    defineShot({ id: 'P25', t0: T25, img: 'bg/maquis', seed: 30, inT: 0, inKind: 'cut',
      cam: [{ t: T25, x: 478, y: 1000, z: 1.12 }, { t: BJ.t0, x: 482, y: 1040, z: 1.19 }, { t: TEND + .6, x: 486, y: 1070, z: 1.25 }],
      stage(t, n, c) {
        c25 = c;
        parallax(c, .93, () => { ctx.translate(-500 * .07, -905 * .07); garland(t, 250, 742, 760, 676, 70, 3); garland(t, 640, 640, 1010, 700, 46, 8); garland(t, -30, 872, 1030, 846, 64, 5); });
        smoke(t, 20, 1780, .5);
        // back row, behind the far table (smaller, a touch dimmer)
        const no = nO25(t), bo = bO25(t);
        drawPuppet(NK25, N25.x, N25.y, N25.h, no);
        drawPuppet(BK25, B25.x, B25.y, B25.h, bo);
        maskRedraw(c);
        // front row : Tantine Mireille (left, a little behind), Christelle, Junior
        const mo = mO25(t), co = cO25(t);
        drawPuppet(MK25, M25.x, M25.y, M25.h, mo);
        drawPuppet(CK25, C25.x, C25.y, C25.h, co);
        const jo = jO25(t), jp = drawTrack(jK25, J25.x, J25.y, J25.h, jo), jop = Object.assign({}, jo, jp);
        blush(jp.k, J25.x, J25.y, J25.h, jop, eOutCubic(prog(t, BLUSH, BLUSH + .4)));
        // they laugh at Junior's blush, then everybody cheers
        laughLines(headOf(MK25, M25.x, M25.y, M25.h, mo), t, BLUSH + .4, BJ.t0 + .5);
        laughLines(headOf(NK25, N25.x, N25.y, N25.h, no), t, BLUSH + .32, BJ.t0 + .3);
        for (const [k, P, o, sd] of [[MK25, M25, mo, 1], [CK25, C25, co, 2], [NK25, N25, no, 3], [BK25, B25, bo, 4], [jp.k, J25, jop, 5]])
          sparkles(headOf(k, P.x, P.y, P.h, o), t, BG.t0 + .05 * sd, BG.t1 + .3, 2, sd * 7);
        // foreground : the band's table, the open tontine book, the frame, the margouillat (closest layer)
        parallax(c, 1.1, () => { ctx.translate(500 * .1, 1000 * .1);
          fgTable(FGT); bookOnTable(BOOK);
          ctx.save(); ctx.fillStyle = 'rgba(20,8,6,.35)'; ctx.beginPath(); ctx.ellipse(FRT.x + 18, FRT.y - 4, FRM.w * FRT.k * .55, 16, 0, 0, 7); ctx.fill(); ctx.restore();
          ctx.save(); ctx.translate(FRT.x, FRT.y); ctx.scale(FRT.k, FRT.k);
          quittanceFrame(0, -FRM.h / 2, -.05 + Math.sin(t * 1.3) * .006, { lift: 10 }); ctx.restore();
          propLizard(LIZ.x, LIZ.y, LIZ.s, t, { flip: true, phase: 2.2, period: 6.1, pushAt: BG.t0 + .1, puff: .8 * env(t, BG.t0, BG.t1 + .5, .2, .3) }); });
      },
      screen(t) {
        if (!c25) return;
        const co = cO25(t), cm = mouthOf(CK25, C25.x, C25.y, C25.h, co), ct = topOf(CK25, C25.x, C25.y, C25.h, co);
        balloon(t, { t0: BC.t0, t1: BC.t1, text: 'Merci pour ton “Attends !”, Junior.', x: 330, y: 570, w: 520, size: 54, seed: 41, tail: tailTo(c25, cm, ct, -34) });
        const jp = keyAt(jK25, t), jo = Object.assign({}, jO25(t), jp), jm = mouthOf(jp.k, J25.x, J25.y, J25.h, jo), jt = topOf(jp.k, J25.x, J25.y, J25.h, jo);
        balloon(t, { t0: BJ.t0, t1: BJ.t1, text: 'À la prochaine commande…', x: 790, y: 380, w: 440, size: 54, seed: 42, tail: tailTo(c25, jm, jt, -6) });
        // the whole band : one shout balloon, one tail per mouth (Mireille, Christelle, Nadège, Boris, Junior)
        if (t >= BG.t0 && t <= BG.t1 + .25) {
          const mo = mO25(t), no = nO25(t), bo = bO25(t);
          const mouths = [[mouthOf(MK25, M25.x, M25.y, M25.h, mo), topOf(MK25, M25.x, M25.y, M25.h, mo)], [cm, ct],
            [mouthOf(NK25, N25.x, N25.y, N25.h, no), topOf(NK25, N25.x, N25.y, N25.h, no)],
            [mouthOf(BK25, B25.x, B25.y, B25.h, bo), topOf(BK25, B25.x, B25.y, B25.h, bo)], [jm, jt]];
          const base = { t0: BG.t0, t1: BG.t1, text: '… on saura avant !', x: 440, y: 660, w: 700, size: 62, kind: 'shout', seed: 43 };
          for (const [m, tp] of mouths) balloon(t, Object.assign({}, base, { tail: tailTo(c25, m, tp) }));
        }
      } });
  });
})();

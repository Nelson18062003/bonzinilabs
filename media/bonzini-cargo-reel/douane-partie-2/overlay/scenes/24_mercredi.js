// =============================================================================================================
// P12 – P14 · MERCREDI (S14 – S17) — « ③ la simulation » chez Junior, l'étal de baskets (bg/etal_baskets)
//   P12  wide shot of the stall: Junior in front of his shelf, his framed « QUITTANCE · PAYÉ » on the plank wall above
//        (the margouillat on it), Nadège phone up, Christelle; Boris walks up the street with his box; slow push toward
//        Nadège, whose phone lights up violet.
//   P13  full-frame drawn phone: « 4 GESTES » ticked gesture by gesture on the voice, swipe to a generic SIMPA screen,
//        then pull back into Nadège's hand at the stall; Boris pokes his head in from the right: « Même moi, je peux ? »
//   P14  medium shot: « Calculé. C'est exact ! » → yellow ESTIMATION stamp (Nadège pouts), push into the phone where the
//        three round stamps fall on the voice, pull back: Christelle teases, Nadège bursts out laughing.
// Everything is wrapped in an IIFE (all scene files share one global scope). Times come from the voice timeline only.
// =============================================================================================================
(() => {
  'use strict';
  const BG = 'bg/etal_baskets';
  // light: midday sun from the upper right of the street (the moto's shadow falls to the left) — warm, rim on the right;
  // whoever stands a step back gets a little dimmer
  const SUN = { mul: '#F4EADB', tint: '#FFD69C', tintA: .06, rim: '#FFE2A8', rimA: .26, rimSide: 'right' };
  const BACK = { mul: '#E2D8C9', tint: '#FFD69C', tintA: .07, rim: '#FFE2A8', rimA: .16, rimSide: 'right' };
  const PHC = 0, PHJ = 2.1, PHN = 4.3, PHB = 5.7;                 // breathing phases (same as the other days)
  const VIO = '#6A22C9', VIOL = '#8B3DFF', TEAL = '#17736B', OCHRE = '#B8740F', GREEN = '#2E7D4F';

  // ---------- one layout of the stall for the three shots (stage units on bg/etal_baskets: 1000 × 1780) ---------------
  // The picture is painted at eye level (horizon ≈ y 600–650: heads of the passers-by, vanishing lines of the shelf), so a
  // standing figure keeps its head near that line wherever it stands: its height follows from its feet line. It also
  // matches the shelf (a sneaker at the front of the shelf ≈ 1/6 of Junior). Relative heights: Junior 1 · Christelle .98 ·
  // Nadège 1 · Boris .96.
  const HP = (y, rel = 1) => Math.round(.89 * (y - 596) * rel);
  const at = (x, y, rel = 1) => ({ x, y, h: HP(y, rel) });
  const JUN = at(165, 1700), NAD = at(440, 1745), CHR = at(682, 1725, .98);
  const JUN14 = at(285, 1640);                   // P14: Junior a step back (« en retrait »), feet on the sand in front of the crates
  const BOR = at(850, 1455, .96);                // Boris a step back in the street: face, box and tag clear of Christelle
  const BOR0 = at(888, 1250, .96);               // P12: where his walk up the street starts
  const BOR13 = at(850, 1462, .96);              // P13: he pokes his head in from the right, behind Christelle
  const FRAME = { x: 150, y: 410, w: 170, h: 126, rot: -.025 };   // Junior's « diploma », on the plank wall above the top shelf
  const LIZ = { x: 247, y: 428, s: .78 };                           // the margouillat, clinging to the wall beside the frame, head up
  // Nadège's phone in her pictures (rig px of the picture; it follows the hand's bone), drawn width (rig px) that covers it
  const PHONE = { a: { p: [338, 210], w: 60, rot: .05 }, b: { p: [354, 160], w: 46, rot: .02 } };
  const phoneOf = key => (/nadege_[13]/.test(key) ? PHONE.a : PHONE.b);
  // Boris' box: top edge of its front face, measured on the pictures (rig px); the tag « PAS AVANT SAMEDI » hangs from it
  const BOXPIN = { 'cast/boris_1': [346, 420], 'cast/boris_5': [360, 410] };

  // ---------- puppet helpers (same formulas as drawPuppet, so props and marks can follow a bone) ---------------------
  const K = (who, n) => `cast/${who}_${n}`;
  const walkPh = o => (o.t - (o.walkT0 || 0)) * (o.walk.speed || 1.6) * Math.PI * 2;
  function pupRot(R, o) {
    const t = o.t ?? 0, ph = o.phase ?? 0, talk = o.talk || 0, E = o.energy ?? 1, beat = talk ? Math.sin(t * 5.1 + ph) : 0;
    const rot = Object.assign({}, o.rot || {});
    rot.chest = (rot.chest || 0) + Math.sin(t * 1.9 + ph) * .018 * E + Math.sin(t * .7 + ph) * .02 * E + (o.lean || 0) + beat * .025 * talk * E;
    rot.hips = (rot.hips || 0) + Math.sin(t * .7 + ph + 1) * .008 * E;
    rot.head = (rot.head || 0) + Math.sin(t * 1.1 + ph * 2) * .04 * E + (talk ? (Math.sin(t * 6.3 + ph) * .06 + Math.sin(t * 2.7) * .04) * talk * E : 0);
    if (R.gesture) for (const [bn, amp, fr] of R.gesture) rot[bn] = (rot[bn] || 0) + (Math.sin(t * fr + ph) * .6 + Math.sin(t * fr * 1.9 + ph) * .4) * amp * (talk ? 2.2 : .6) * E;
    if (o.walk) { const wp = walkPh(o), A = o.walk.amp ?? 1;
      rot.legL = (rot.legL || 0) + Math.sin(wp) * .34 * A; rot.legR = (rot.legR || 0) - Math.sin(wp) * .34 * A;
      rot.armL_up = (rot.armL_up || 0) - Math.sin(wp) * .28 * A; rot.armR_up = (rot.armR_up || 0) + Math.sin(wp) * .28 * A; rot.chest += .03 * A; }
    return rot;
  }
  function pupLift(o) {
    const t = o.t ?? 0, ph = o.phase ?? 0, talk = o.talk || 0, E = o.energy ?? 1;
    let bounce = talk ? Math.abs(Math.sin(t * 5.1 + ph)) * .012 * talk * E : 0, hopY = 0;
    if (o.hop != null) { const u = (t - o.hop) / .45; if (u > 0 && u < 1) { hopY = Math.sin(u * Math.PI) * .07; bounce += (u < .15 ? -.04 * (1 - u / .15) : 0); } }
    const walkBob = o.walk ? Math.abs(Math.cos(walkPh(o))) * .014 * (o.walk.amp ?? 1) : 0;
    return { hopY: hopY + walkBob, bounce };
  }
  /** stage position of a point of the picture (rig px) carried by a bone (+ its rotation r) */
  function pupPt(key, x, y, h, o, q0, bone) {
    const R = RIGS[key]; if (!R) return { x, y: y - h / 2, r: 0 };
    const dir = o.flip ? -1 : 1, L = pupLift(o), M = boneMats(R, pupRot(R, o), o.off || {}), m = bone ? M[bone] : null;
    const q = m ? aff.ap(m, q0) : q0, s = h / R.h;
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce), r: m ? dir * Math.atan2(m[1], m[0]) : 0 };
  }
  const mouthOf = (key, x, y, h, o) => { const R = RIGS[key]; return R && R.face ? pupPt(key, x, y, h, o, R.face.mouth, 'head') : { x, y: y - h * .87 }; };
  /** centre and radius of the head (from the rig's face: eyes and mouth), following the head bone */
  function headOf(key, x, y, h, o) {
    const R = RIGS[key]; if (!R || !R.face) return { x, y: y - h * .9, r: h * .07 };
    const F = R.face, ex = (F.eyes[0][0] + F.eyes[1][0]) / 2, ey = (F.eyes[0][1] + F.eyes[1][1]) / 2, d = F.mouth[1] - ey;
    const c = pupPt(key, x, y, h, o, [ex, ey - d * .3], 'head');
    return { x: c.x, y: c.y, r: d * 2.2 * h / R.h };
  }
  /** pose change: the new pose under, the old one fading out on top (short cross-fade) + a little squash at the feet */
  function pupSwitch(a, b, ts, x, y, h, o, fade = .16) {
    const t = o.t;
    if (t < ts) { drawPuppet(a, x, y, h, o); return a; }
    const u = t - ts, pop = u < .18 ? Math.sin(u / .18 * Math.PI) : 0;
    ctx.save(); if (pop) { ctx.translate(x, y); ctx.scale(1 + .02 * pop, 1 - .03 * pop); ctx.translate(-x, -y); }
    drawPuppet(b, x, y, h, o);
    const k = clamp(u / fade); if (k < 1) drawPuppet(a, x, y, h, Object.assign({}, o, { a: (o.a ?? 1) * (1 - k), shadow: false }));
    ctx.restore();
    return b;
  }
  /** pose track [[t, key], …] → the key at time t (+ the previous one, for a cross-fade) */
  function track(keys, t) { let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++; return { key: keys[i][1], prev: i ? keys[i - 1][1] : null, ts: keys[i][0] }; }
  function drawTrack(keys, x, y, h, o) {
    const S = track(keys, o.t);
    if (S.prev && o.t - S.ts < .2) return pupSwitch(S.prev, S.key, S.ts, x, y, h, o);
    drawPuppet(S.key, x, y, h, o); return S.key;
  }
  /** Nadège's phone (the one in her picture) in stage units { x, y, w, rot } */
  function phoneStage(key, o, A = NAD) {
    const P = phoneOf(key), R = RIGS[key], q = pupPt(key, A.x, A.y, A.h, o, P.p, 'armL_lo');
    return { x: q.x, y: q.y, w: P.w * A.h / (R ? R.h : 1252), rot: P.rot + q.r };
  }
  /** the tag « PAS AVANT SAMEDI » hanging from the top edge of the box Boris carries (follows his arm) */
  function borisTag(t, key, x, y, h, o) {
    const pin = BOXPIN[key]; if (!pin) return;
    const q = pupPt(key, x, y, h, o, pin, 'armL_up'), s = h / 1300, th = 58 * s;   // sized to the box, not to the screen
    const cx = q.x - (o.flip ? -1 : 1) * .02 * h, cy = q.y + th * 1.3;               // hangs a touch toward his body
    inkLine(q.x, q.y, cx, cy - th * .9, { w: 2, color: '#6B4A2A', seed: 63 });
    propTag(cx, cy, s, 'PAS AVANT SAMEDI', { t: t + (o.phase || 0) });
  }

  // ---------- BD marks (stage units, drawn over the puppets) --------------------------------------------------------
  /** laugh lines: on each side of the head two short concentric arcs and a little spark, jiggling (c = head centre + radius) */
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
  /** surprise lines: three strokes above the head that pop out at t0 */
  function surpriseLines(c, t, t0, t1) {
    const k = env(t, t0, t1, .08, .3); if (k <= 0) return; const sp = clamp(spring(t - t0, 18, .45), 0, 1.25);
    ctx.save(); ctx.globalAlpha *= k;
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * .5 + .25, r0 = c.r * 1.2, L = c.r * .45 * sp;
      inkLine(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0, c.x + Math.cos(a) * (r0 + L), c.y + Math.sin(a) * (r0 + L), { w: Math.max(3, c.r * .085), seed: 230 + i }); }
    ctx.restore();
  }
  /** sweat drop on the temple, sliding a little */
  function sweatDrop(x, y, s, t, t0, t1) {
    const k = env(t, t0, t1, .15, .25); if (k <= 0) return; const u = clamp((t - t0) / (t1 - t0));
    ctx.save(); ctx.translate(x, y + u * 14 * s); ctx.scale(s * (.6 + .4 * k), s * (.6 + .4 * k)); ctx.globalAlpha *= k;
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.bezierCurveTo(6, -10, 13, 0, 12, 7); ctx.bezierCurveTo(11, 15, -11, 15, -12, 7); ctx.bezierCurveTo(-13, 0, -6, -10, 0, -22); ctx.closePath();
    ctx.fillStyle = '#A9DCF5'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-4, 3, 2.5, 5, -.3, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- the stall ------------------------------------------------------------------------------------------------
  /** the sneakers carry no brand: paint out the curved marks the painting left on three shoes (soft-edged patches) */
  const LOGO = [
    [[446, 1460], [480, 1461], [506, 1465], [510, 1484], [507, 1503], [494, 1509], [468, 1500], [449, 1490], [436, 1478]],   // big white pair, front
    [[277, 1261], [301, 1260], [319, 1268], [330, 1281], [323, 1295], [300, 1296], [279, 1289]],                          // blue heel, low shelf
    [[0, 1194], [15, 1194], [29, 1211], [27, 1233], [11, 1240], [0, 1238]],                                                // green pair, bottom left
  ];
  const LOGOC = ['#DCDDE1', '#D3D6DC', '#2F7F55'];
  function eraseLogos() {
    ctx.save(); ctx.filter = 'blur(1.6px)';
    LOGO.forEach((P, i) => { ctx.fillStyle = LOGOC[i]; ctx.beginPath(); P.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); });
    ctx.restore();
  }
  /** the framed receipt « QUITTANCE · PAYÉ » (Part 1), hung like a diploma on the plank wall */
  function quittanceFrame() {
    propFrame(FRAME.x, FRAME.y, FRAME.w, FRAME.h, { rot: FRAME.rot, lift: 8, mat: '#EFE3C8' }, (w, h) => {
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(.015);
      const pw = w * .9, ph = h * .9, fs = fitSize('QUITTANCE', FF.bd, 44, pw - 14, 24, 1);
      ctx.fillStyle = '#FFFDF5'; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      inkRect(-pw / 2, -ph / 2, pw, ph, { w: 1.6, color: 'rgba(30,21,18,.5)', seed: 5 });
      text('QUITTANCE', 0, -ph / 2 + fs * 1.05, { font: font(FF.bd, fs, 400), align: 'center', color: BD.ink, ls: 1 });
      inkLine(-pw * .36, -ph / 2 + fs * 1.3, pw * .36, -ph / 2 + fs * 1.3, { w: 1.8, color: '#9A8C80', seed: 7 });
      ctx.save(); ctx.translate(pw * .04, ph * .2); ctx.rotate(-.1);
      inkRect(-pw * .36, -ph * .19, pw * .72, ph * .38, { w: 3.5, color: GREEN, seed: 9 });
      text('PAYÉ', 0, ph * .12, { font: font(FF.bd, ph * .34, 400), align: 'center', color: GREEN, ls: 2 });
      ctx.restore();
      ctx.restore();
    });
  }
  /** the whole stall dressing, shared by the three shots */
  function stall(t, o = {}) {
    eraseLogos();
    quittanceFrame();
    ctx.save(); ctx.translate(LIZ.x, LIZ.y); ctx.rotate(Math.PI / 2);         // on the wall, feet on the frame's edge, tail down
    propLizard(0, 0, LIZ.s, t, Object.assign({ flip: true }, o)); ctx.restore();
  }

  // ---------- atmosphere ------------------------------------------------------------------------------------------
  /** midday sun: three soft beams from the upper right that drift slowly, and dust motes floating in them (foreground
   *  parallax layer, it moves faster than the stall when the camera moves) */
  function sunLight(t, c, k = 1) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      const x0 = 1060 - i * 300 + Math.sin(t * .23 + i * 1.7) * 70, bw = 110 + i * 40, run = 560;
      const g = ctx.createLinearGradient(x0, 250, x0 - run, 1800);
      g.addColorStop(0, 'rgba(255,214,150,0)'); g.addColorStop(.35, `rgba(255,214,150,${(.07 + .03 * Math.sin(t * .5 + i)) * k})`); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 250); ctx.lineTo(x0 + bw, 250); ctx.lineTo(x0 + bw - run, 1800); ctx.lineTo(x0 - run, 1800); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    parallax(c, 1.18, () => {
      ctx.save();
      for (let i = 0; i < 36; i++) {
        const sp = .025 + hash(i * 1.3) * .035, u = (hash(i * 3.1) + t * sp) % 1, x = hash(i * 7.3) * 1000 + Math.sin(t * .7 + i) * 14, y = 1650 - u * 1250;
        const a = Math.sin(u * Math.PI) * (.55 + .45 * Math.sin(t * 2.3 + i * 1.7)) * k;
        ctx.fillStyle = `rgba(255,240,200,${(.5 * a).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.6 + hash(i * 2.2) * 2.4, 0, 7); ctx.fill();
      }
      ctx.restore();
    });
  }
  /** violet glow of Nadège's phone (stage units), k 0..1 */
  function phoneGlow(t, p, k, R0 = 150) {
    if (k <= 0) return;
    const pul = 1 + .08 * Math.sin(t * 3.2), R1 = R0 * pul, r2 = R0 * .24;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R1);
    g.addColorStop(0, `rgba(150,90,255,${.42 * k})`); g.addColorStop(.35, `rgba(139,61,255,${.16 * k})`); g.addColorStop(1, 'rgba(139,61,255,0)');
    ctx.fillStyle = g; ctx.fillRect(p.x - R1, p.y - R1, 2 * R1, 2 * R1);
    g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r2);
    g.addColorStop(0, `rgba(235,215,255,${.75 * k})`); g.addColorStop(1, 'rgba(200,160,255,0)');
    ctx.fillStyle = g; ctx.fillRect(p.x - r2, p.y - r2, 2 * r2, 2 * r2);
    ctx.restore();
  }

  // ---------- phone card (card units = screen px when the phone fills the frame) ------------------------------------
  const PW = 1000, CW = 890, CHH = 1930;            // phone width at full frame; screen size in card units (propPhone ratios)
  /** phone in screen px: k = 0 → small, at `anchor` (screen {x, y, w, rot}); k = 1 → fills the frame. Returns its transform. */
  function phoneBig(t, n, k, anchor, card, o = {}) {
    const sh = shake(t, n), w = lerp(anchor.w, PW, k);
    const x = lerp(anchor.x, 540, k) + Math.sin(t * .9) * 4 * k + sh.x * k, y = lerp(anchor.y, 960, k) + Math.sin(t * .7 + 1) * 5 * k + sh.y * k;
    const rot = lerp(anchor.rot || 0, Math.sin(t * .5) * .005, k);
    ctx.save(); ctx.globalAlpha *= o.a ?? 1;
    propPhone(x, y, w, { rot, glow: o.glow, lift: 4 + 12 * (1 - k) }, (sw) => { const s = sw / CW; ctx.scale(s, s); card(); });
    ctx.restore();
    return { x, y, w, rot };
  }
  const cardPt = (P, cx, cy) => { const s = P.w * (1 - .11) / CW; return { x: P.x + (cx - CW / 2) * s, y: P.y + (cy - CHH / 2) * s, s }; };
  /** UI text printed on the screen (fade + small rise) */
  function printIn(s, x, y, t, t0, o = {}) {
    if (t0 == null || t < t0) return;
    const k = eOutCubic(clamp((t - t0) / (o.dur || .25)));
    ctx.save(); ctx.globalAlpha *= k; text(s, x, y + (1 - k) * 10, { font: font(o.fam || FF.letN, o.size || 46, o.wght || 400), align: o.align || 'left', color: o.color || BD.ink, ls: o.ls || 0 }); ctx.restore();
  }
  const WR = (s, x, y, t, t0, dur, o) => (t0 == null ? 0 : writeOn(s, x, y, t, t0, dur, o));
  function fitSize(s, fam, size, maxW, min = 30, ls = 0) { let z = size; while (z > min && measure(s, font(fam, z, 400), ls) > maxW) z -= .5; return z; }
  function arrowInk(x0, y0, x1, y1, o = {}) {
    inkLine(x0, y0, x1, y1, o); const a = Math.atan2(y1 - y0, x1 - x0), L = o.head || 12;
    inkLine(x1, y1, x1 - Math.cos(a - .5) * L, y1 - Math.sin(a - .5) * L, o); inkLine(x1, y1, x1 - Math.cos(a + .5) * L, y1 - Math.sin(a + .5) * L, o);
  }
  /** a chain « a → b → c » on one line, each word revealed at its own time (arrows drawn in ink, no glyph fallback) */
  function chain(parts, x, y, t, times, o) {
    const size = o.size || 44, f = font(o.fam || FF.letN, size, 400), aw = size * 1.15; let cx = x;
    parts.forEach((p, i) => {
      if (i || o.lead) { const ta = times[i] - .12;
        if (t >= ta) { const k = eOutCubic(clamp((t - ta) / .2)); arrowInk(cx + size * .12, y - size * .3, cx + size * .12 + (aw - size * .35) * k, y - size * .3, { w: size * .07, color: o.color || BD.ink, seed: 30 + i, head: size * .24 }); }
        cx += aw; }
      WR(p, cx, y, t, times[i], Math.max(.2, p.length * .035), { size, fam: o.fam || FF.letN, color: o.color || BD.ink });
      cx += measure(p, f) + size * .25;
    });
  }
  /** round checkbox that fills violet and gets a check at t0 */
  function tickBox(x, y, r, t, t0) {
    const on = t0 != null && t >= t0, u = on ? t - t0 : 0, s = on ? 1 + .25 * Math.sin(clamp(u / .25) * Math.PI) : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (on) { ctx.fillStyle = VIOL; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
    inkCircle(0, 0, r, { w: 4, color: on ? VIO : 'rgba(30,21,18,.55)', seed: 3 });
    if (on) { const p = clamp(u / .22); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = r * .24; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(-r * .45, 0); ctx.lineTo(-r * .45 + r * .3 * clamp(p * 2), r * .3 * clamp(p * 2));
      if (p > .5) ctx.lineTo(-r * .15 + r * .6 * clamp(p * 2 - 1), r * .3 - r * .72 * clamp(p * 2 - 1)); ctx.stroke(); }
    ctx.restore();
  }
  function iconQuoi(x, y, s) {                                     // violet « QUOI » badge: a magnifier on a tag
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-.08);
    withShadow(4, () => { ctx.fillStyle = VIOL; rrect(-34, -34, 68, 68, 14); ctx.fill(); });
    inkRect(-34, -34, 68, 68, { w: 3, seed: 61 });
    inkCircle(-5, -5, 15, { w: 5, color: '#FFFFFF', seed: 62 }); inkLine(6, 6, 20, 20, { w: 7, color: '#FFFFFF', seed: 63 });
    ctx.restore();
  }
  function iconCombien(x, y, s) {                                  // amber « COMBIEN » card (same drawing as the other days)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-.12);
    withShadow(3, () => { ctx.fillStyle = BD.amber; rrect(-18, -13, 36, 26, 5); ctx.fill(); });
    inkRect(-18, -13, 36, 26, { w: 2.2, seed: 71 }); inkLine(-11, -4, 10, -4, { w: 2, seed: 72 }); inkLine(-11, 4, 4, 4, { w: 2, seed: 73 });
    ctx.restore();
  }
  function statusBar(dark) {                                       // generic status icons (no figures, no brand)
    const col = dark ? 'rgba(255,255,255,.85)' : 'rgba(30,21,18,.7)';
    ctx.save(); ctx.fillStyle = col;
    for (let i = 0; i < 4; i++) ctx.fillRect(700 + i * 13, 74 - i * 7, 9, 10 + i * 7);
    ctx.strokeStyle = col; ctx.lineWidth = 3; rrect(770, 56, 52, 26, 6); ctx.stroke(); ctx.fillRect(774, 60, 34, 18); ctx.fillRect(824, 63, 5, 12);
    ctx.restore();
  }


  // « 4 GESTES · sur la proforma, avant de payer » — S: times (null = not yet). Layout in card units: the header stays
  // below the series tag (card y < 242), rows 1–3 end above the caption zone (card 1255–1455), row 4 sits under it.
  const HEAD = 425, ROWS = { r1: 505, r2: 745, r3: 1068, r4: 1560 };
  function header(fill, y1, title, sub, t, t0, o = {}) {
    ctx.fillStyle = '#FFF8EA'; ctx.fillRect(0, 0, CW, CHH);
    ctx.fillStyle = fill; ctx.fillRect(0, 0, CW, y1);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, y1 - 18 - i * 30, CW, 2);
    inkLine(0, y1, CW, y1, { w: 4, seed: 41, step: 40 });
    statusBar(true);
    printIn(title, CW / 2, o.ty || 330, t, t0, { fam: FF.bd, size: o.ts || 108, align: 'center', color: '#FFFFFF', ls: o.ls ?? 4 });
    printIn(sub, CW / 2, o.sy || 396, t, t0 == null ? null : t0 + .15, { size: fitSize(sub, FF.letN, 52, CW - 70), align: 'center', color: o.sc || '#F3E6FF' });
  }
  function cardGestes(t, S) {
    header(VIO, HEAD, '4 GESTES', 'sur la proforma, avant de payer', t, S.head);
    // the row being spoken is lit softly
    const band = (y0, y1, a0, a1) => { if (a0 == null || t < a0) return;
      const k = Math.min(eOutCubic(clamp((t - a0) / .3)), a1 == null ? 1 : clamp(1 - (t - a1) / .3)); if (k <= 0) return;
      ctx.save(); ctx.globalAlpha *= k * .9; ctx.fillStyle = 'rgba(139,61,255,.10)'; ctx.fillRect(14, y0, CW - 28, y1 - y0); ctx.fillStyle = VIOL; ctx.fillRect(14, y0, 7, y1 - y0); ctx.restore(); };
    band(HEAD + 8, 676, S.r1, S.r2); band(678, 1004, S.r2, S.r3); band(1006, 1232, S.r3, S.r4); band(1478, 1744, S.r4, S.swipe);
    const T = (s, y, t0) => WR(s, 112, y, t, t0, .45, { size: fitSize(s, FF.bd, 70, 720, 50, 1), fam: FF.bd });
    const sub = (s, y, t0, d) => WR(s, 112, y, t, t0, d, { size: fitSize(s, FF.letN, 52, CW - 140, 44) });
    const icon = (fn, y, t0) => { if (t0 == null || t < t0) return; const k = clamp(spring(t - t0 - .2, 16, .5), 0, 1.2); ctx.save(); ctx.translate(808, y); ctx.scale(k, k); fn(); ctx.restore(); };
    // 1 · LE CODE
    tickBox(56, ROWS.r1 - 24, 31, t, S.k1); T('1 · LE CODE', ROWS.r1, S.r1);
    icon(() => iconQuoi(0, 0, 1.05), ROWS.r1 - 26, S.r1);
    sub('description précise : matière, usage,', ROWS.r1 + 68, S.r1s, .75); sub('neuf ou usagé', ROWS.r1 + 126, S.r1s + .7, .4);
    inkLine(30, 676, CW - 30, 676, { w: 2, color: 'rgba(30,21,18,.18)', seed: 51 });
    // 2 · LA VALEUR
    tickBox(56, ROWS.r2 - 24, 31, t, S.k2); T('2 · LA VALEUR', ROWS.r2, S.r2);
    icon(() => iconCombien(0, 0, 2.3), ROWS.r2 - 26, S.r2);
    sub("marchandise + transport jusqu'au", ROWS.r2 + 68, S.r2a, .9); sub("port d'arrivée + assurance", ROWS.r2 + 126, S.r2b, .65);
    // in small: ¥ → F CFA (the arrow is drawn)
    if (S.r2c != null && t >= S.r2c) {
      const y = ROWS.r2 + 186, f = 40, c2 = '#5A4636';
      WR('¥', 112, y, t, S.r2c, .12, { size: f, color: c2 });
      const k = eOutCubic(clamp((t - S.r2c - .1) / .2)); if (k > 0) arrowInk(140, y - 13, 140 + 36 * k, y - 13, { w: 3.2, color: c2, seed: 33, head: 10 });
      WR('F CFA : au taux retenu par la douane,', 190, y, t, S.r2c + .2, .55, { size: f, color: c2 });
      WR('le jour de la déclaration', 112, y + 48, t, S.r2c + .7, .4, { size: f, color: c2 });
    }
    inkLine(30, 1004, CW - 30, 1004, { w: 2, color: 'rgba(30,21,18,.18)', seed: 52 });
    // 3 · LES TAXES, DANS L'ORDRE
    tickBox(56, ROWS.r3 - 24, 31, t, S.k3); T("3 · LES TAXES, DANS L'ORDRE", ROWS.r3, S.r3);
    chain(['droit', 'accises', 'petite redevance'], 112, ROWS.r3 + 70, t, S.c3.slice(0, 3), { size: 50 });
    chain(['TVA', 'petites taxes'], 112, ROWS.r3 + 130, t, S.c3.slice(3), { size: 50, lead: true });
    // (the caption zone stays empty) — 4 · VOTRE SITUATION
    inkLine(30, 1478, CW - 30, 1478, { w: 2, color: 'rgba(30,21,18,.18)', seed: 53 });
    tickBox(56, ROWS.r4 - 24, 31, t, S.k4); T('4 · VOTRE SITUATION', ROWS.r4, S.r4);
    sub('précompte · contrôles dès 2 M F FOB', ROWS.r4 + 68, S.r4a, .7); sub('(valeur, qualité) · frais du port', ROWS.r4 + 126, S.r4b, .6);
    ctx.fillStyle = 'rgba(30,21,18,.35)'; rrect(CW / 2 - 110, 1880, 220, 10, 5); ctx.fill();          // home indicator
  }
  // compact version for P14: the four gestures already ticked (titles only), under the stamps
  function cardGestesDone(t) {
    header(VIO, HEAD, '4 GESTES', 'sur la proforma, avant de payer', t, -9);
    ['1 · LE CODE', '2 · LA VALEUR', "3 · LES TAXES, DANS L'ORDRE", '4 · VOTRE SITUATION'].forEach((s, i) => {
      const y = 515 + i * 86; tickBox(56, y - 19, 26, t, -9);
      text(s, 106, y, { font: font(FF.bd, fitSize(s, FF.bd, 54, 720, 44, 1), 400), color: BD.ink, ls: 1 });
    });
    ctx.fillStyle = 'rgba(30,21,18,.35)'; rrect(CW / 2 - 110, 1880, 220, 10, 5); ctx.fill();
  }
  // generic SIMPA screen (drawn, no logo, no figure): title band, « en ligne, accessible à tous », the 4 steps, empty fields
  function cardSimpa(t, S) {
    header(TEAL, 470, 'SIMPA', 'simulateur officiel du Guichet unique', t, -9, { ty: 352, ts: 132, ls: 8, sy: 430, sc: '#DDF5F1' });
    ctx.fillStyle = '#F7FBFA'; ctx.fillRect(0, 474, CW, CHH - 474);
    // online line + globe icon
    if (t >= S.online) {
      const k = eOutCubic(clamp((t - S.online) / .3)), y = 572, f = font(FF.letN, 56, 400);
      ctx.save(); ctx.globalAlpha *= k;
      inkCircle(84, y - 18, 27, { w: 4, color: TEAL, seed: 81 }); ctx.save(); ctx.translate(84, y - 18); ctx.scale(.45, 1); inkCircle(0, 0, 27, { w: 3, color: TEAL, seed: 82 }); ctx.restore();
      inkLine(57, y - 18, 111, y - 18, { w: 3, color: TEAL, seed: 83 });
      text('en ligne, accessible à tous', 130, y, { font: f, color: BD.ink });
      ctx.restore();
      if (S.hl != null && t >= S.hl) { const x0 = 130 + measure('en ligne, ', f), x1 = 130 + measure('en ligne, accessible à tous', f), u = eOutCubic(clamp((t - S.hl) / .45));
        inkLine(x0, y + 14, x0 + (x1 - x0) * u, y + 12, { w: 8, color: BD.orange, seed: 84 }); }
    }
    // the four steps (a vertical stepper)
    const steps = [['opération'], ['produit'], ['facture', '(FOB, fret, assurance, en F CFA)'], ['finalisation']], ys = [714, 846, 978, 1166];
    if (t >= S.steps[0]) inkLine(84, ys[0], 84, ys[0] + (ys[3] - ys[0]) * eOutCubic(clamp((t - S.steps[0]) / (S.steps[3] - S.steps[0]))), { w: 4, color: 'rgba(23,115,107,.35)', seed: 85, step: 30 });
    steps.forEach((st, i) => {
      const t0 = S.steps[i]; if (t < t0) return;
      const u = t - t0, s = 1 + .2 * Math.sin(clamp(u / .25) * Math.PI), a = clamp(u / .15);
      ctx.save(); ctx.globalAlpha *= a;
      ctx.save(); ctx.translate(84, ys[i] - 19); ctx.scale(s, s);
      ctx.fillStyle = i === 0 ? TEAL : '#FFFFFF'; ctx.beginPath(); ctx.arc(0, 0, 33, 0, 7); ctx.fill();
      inkCircle(0, 0, 33, { w: 4, color: TEAL, seed: 86 + i });
      ctx.fillStyle = i === 0 ? '#FFFFFF' : TEAL; ctx.beginPath(); ctx.arc(0, 0, i === 0 ? 11 : 8, 0, 7); ctx.fill();      // no digits on screen
      ctx.restore();
      text(st[0], 142, ys[i] + (1 - a) * 8, { font: font(FF.letN, 58, 400), color: BD.ink });
      if (st[1]) text(st[1], 142, ys[i] + 60, { font: font(FF.letN, fitSize(st[1], FF.letN, 46, CW - 170, 40), 400), color: '#3E5552' });
      ctx.restore();
    });
    // under the caption zone: empty form fields and a « next » button (no text, no figure, no total)
    if (t >= S.steps[0]) {
      const a = clamp((t - S.steps[0]) / .3);
      ctx.save(); ctx.globalAlpha *= a;
      for (let i = 0; i < 3; i++) { const y = 1500 + i * 96; ctx.fillStyle = '#FFFFFF'; rrect(60, y, CW - 120, 66, 12); ctx.fill(); inkRect(60, y, CW - 120, 66, { w: 2.5, color: 'rgba(23,115,107,.5)', seed: 90 + i });
        ctx.fillStyle = 'rgba(23,115,107,.18)'; rrect(84, y + 24, 140 + 90 * hash(i + 4), 18, 9); ctx.fill(); }
      ctx.fillStyle = TEAL; rrect(CW - 290, 1786, 230, 74, 37); ctx.fill(); inkRect(CW - 290, 1786, 230, 74, { w: 3, seed: 95 });
      arrowInk(CW - 205, 1823, CW - 145, 1823, { w: 6, color: '#FFFFFF', seed: 96, head: 16 });
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(30,21,18,.35)'; rrect(CW / 2 - 110, 1880, 220, 10, 5); ctx.fill();
  }

  /** Nadège's pointing hand (screen px), fingertip at (x, y), finger along +x rotated by rot; press 0..1 pushes it in */
  function pointHand(x, y, s, rot, press = 0) {
    const skin = PR.skin;
    const parts = [
      () => { ctx.moveTo(-190, -42); ctx.lineTo(-760, -78); ctx.lineTo(-760, 92); ctx.lineTo(-190, 50); },                   // forearm
      () => rrect(-236, -50, 150, 104, 34),                                                                                   // fist
      () => ctx.ellipse(-160, -44, 56, 17, -.06, 0, 7),                                                                       // thumb
      () => { ctx.moveTo(-116, -15); ctx.lineTo(-15, -15); ctx.arc(-15, 0, 15, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-116, 15); },   // index
    ];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(press * 7, 0);
    ctx.save(); ctx.translate(9, 14); ctx.fillStyle = 'rgba(40,20,8,.22)';                                                    // soft shadow on the screen
    for (const p of parts) { ctx.beginPath(); p(); ctx.closePath(); ctx.fill(); } ctx.restore();
    parts.forEach((p, i) => {
      ctx.beginPath(); p(); ctx.closePath(); ctx.fillStyle = skin; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = BD.ink; ctx.lineJoin = 'round'; ctx.stroke();
      if (i === 0) { ctx.fillStyle = 'rgba(255,220,190,.12)'; ctx.fillRect(-700, -52, 500, 14); }
      if (i === 1) { ctx.strokeStyle = 'rgba(40,20,10,.55)'; ctx.lineWidth = 3; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-104, 2 + k * 17, 13, -Math.PI * .5, Math.PI * .5); ctx.stroke(); } }
    });
    ctx.strokeStyle = 'rgba(40,20,10,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-62, -9); ctx.quadraticCurveTo(-58, 0, -62, 9); ctx.stroke();
    ctx.fillStyle = 'rgba(255,232,214,.6)'; ctx.beginPath(); ctx.ellipse(-16, -5, 9, 6, 0, 0, 7); ctx.fill();                 // nail
    ctx.restore();
  }

  // ---------- stamps ---------------------------------------------------------------------------------------------------
  const _fit = {};
  /** round (or oval: o.ry) rubber stamp — ink rings + lines of Bangers fitted inside, slammed at t0 */
  function roundStamp(x, y, r, lines, col, t, t0, o = {}) {
    if (t0 == null || t < t0) return;
    const rx = r, ry = o.ry || r, u = t - t0, k = clamp(u / .12), s = 1 + (1 - eOutCubic(k)) * .8, a = clamp(u / .06), n = lines.length;
    const key = lines.join('|') + rx + 'x' + ry; let size = _fit[key];
    if (!size) { const ix = rx * .8, iy = ry * .8; size = o.size || 76;
      for (; size > 30; size -= 1) { const lh = size * 1.26; let ok = true;
        for (let i = 0; i < n && ok; i++) { const yy = Math.abs((i - (n - 1) / 2) * lh) + size * .45, ch = 2 * ix * Math.sqrt(Math.max(0, 1 - (yy / iy) * (yy / iy)));
          if (measure(lines[i], font(FF.bd, size, 400), 1) > ch - 12) ok = false; }
        if (ok) break; }
      _fit[key] = size; }
    const ring = (sc, w, seed) => { ctx.save(); ctx.scale(1, ry / rx); inkCircle(0, 0, rx * sc, { w: w * rx / ry, color: col, seed }); ctx.restore(); };
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.14); ctx.scale(s, s); ctx.globalAlpha *= a * .95;
    ctx.fillStyle = 'rgba(255,252,242,.6)'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
    ring(1, ry * .065, o.seed || 11); ring(.86, ry * .022, (o.seed || 11) + 1);
    const lh = size * 1.26;
    lines.forEach((l, i) => text(l, 0, (i - (n - 1) / 2) * lh + size * .38, { font: font(FF.bd, size, 400), align: 'center', color: col, ls: 1 }));
    ctx.fillStyle = 'rgba(255,250,238,.55)';                        // starved ink
    for (let i = 0; i < 50; i++) { const aa = hash(i * 3.7 + (o.seed || 0)) * 7, rr = Math.sqrt(hash(i * 5.1 + 2)); ctx.beginPath(); ctx.arc(Math.cos(aa) * rr * rx, Math.sin(aa) * rr * ry, .8 + hash(i) * 2.6, 0, 7); ctx.fill(); }
    ctx.restore();
    return size;
  }
  /** the yellow « ESTIMATION » stamp (rectangular, récitatif yellow with an ink border), at pose P { x, y, w, rot, a } */
  function estimationStamp(P, t, t0) {
    if (t < t0) return;
    const u = t - t0, k = clamp(u / .12), s = 1 + (1 - eOutCubic(k)) * .9, w = P.w, h = w * .25;
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot ?? -.1); ctx.scale(s, s); ctx.globalAlpha *= clamp(u / .06) * (P.a ?? 1);
    withShadow(6, () => { ctx.fillStyle = '#FFD84A'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: Math.max(3, w * .012), seed: 21 }); inkRect(-w / 2 + w * .025, -h / 2 + w * .025, w * .95, h - w * .05, { w: Math.max(1.5, w * .005), seed: 22 });
    const f = font(FF.bd, h * .66, 400);
    text('ESTIMATION', 0, h * .24, { font: f, align: 'center', color: BD.ink, ls: w * .012 });
    ctx.fillStyle = 'rgba(255,248,214,.6)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((hash(i * 3.1) - .5) * w * .96, (hash(i * 5.7) - .5) * h * .9, (.5 + hash(i) * 1.6) * w / 300, 0, 7); ctx.fill(); }
    ctx.restore();
  }


  /** balloon tail: aims at the mouth but stops above the head (never on the face) */
  const tailAbove = (m, topY, dx = 0) => [m.x + dx, Math.min(m.y - 16, topY - 10)];
  /** a speaker's anchors in screen px: mouth, top of the head */
  function speaker(c, key, A, o) {
    const m = mouthOf(key, A.x, A.y, A.h, o), hd = headOf(key, A.x, A.y, A.h, o);
    return { m: stageToScreen(c, m.x, m.y), top: stageToScreen(c, hd.x, hd.y - hd.r * 1.05).y, hx: stageToScreen(c, hd.x, hd.y).x };
  }

  shots(() => {
    // ================================================ times (voice) ================================================
    const T12 = shotStart('S14'), T13 = shotStart('S15'), T14 = shotStart('S17'), T15 = shotStart('S18');

    // =============================================== P12 · MERCREDI ================================================
    const glow0 = tw('S14', 'estime', -.05);
    const b12a = tw('S14', 'Nadège', .1), b12b = T13 - .3;
    const walk0 = T12 + .25, walk1 = tw('S14', 'Nadège', .1);       // Boris walks up the street, stops as Nadège speaks
    const nod12 = tw('S14', 'proforma', .1);                         // Christelle nods on « proforma »
    let c12 = null;
    defineShot({ id: 'P12', t0: T12, img: BG, seed: 12, inT: .7, inKind: 'page',
      cam: [{ t: T12, x: 500, y: 890, z: 1 }, { t: te('S14', 'Junior', .1), x: 498, y: 900, z: 1.03, e: 'lin' }, { t: T13, x: 482, y: 940, z: 1.12, e: 'io' }],
      stage(t, n, c) {
        c12 = c;
        stall(t, { phase: .8, pushAt: tw('S14', 'Mercredi', .1), period: 4.4 });
        // Boris walks up the street toward us (B5, the box held still under his arm), then stands (B1) and perks up when the phone lights
        if (t < walk1) {
          const p = prog(t, walk0, walk1), u = 1 - Math.pow(1 - p, 1.45), y = lerp(BOR0.y, BOR.y, u), A = { x: lerp(BOR0.x, BOR.x, u), y, h: HP(y, .96) };
          const amp = .62 * (1 - smooth(clamp((p - .82) / .18))), wo = { t, phase: PHB, grade: BACK, walk: { speed: 1.75, amp }, walkT0: walk0 };
          wo.rot = { armL_up: Math.sin(walkPh(wo)) * .28 * amp };                                 // the arm with the box does not swing
          drawPuppet(K('boris', 5), A.x, A.y, A.h, wo); borisTag(t, K('boris', 5), A.x, A.y, A.h, wo);
        } else {
          const bo = { t, phase: PHB, grade: BACK, hop: glow0 + .25 };
          pupSwitch(K('boris', 5), K('boris', 1), walk1, BOR.x, BOR.y, BOR.h, bo, .07); borisTag(t, K('boris', 1), BOR.x, BOR.y, BOR.h, bo);
        }
        // Junior in front of his shelf, under his diploma; a little hop on « chez Junior »
        drawPuppet(K('junior', 1), JUN.x, JUN.y, JUN.h, { t, phase: PHJ, grade: SUN, hop: te('S14', 'Junior', -.15) });
        // Christelle, proud (hands on hips), turned toward Nadège; two nods on « proforma »
        const nod = env(t, nod12, nod12 + .75, .05, .12) * (.5 - .5 * Math.cos(clamp((t - nod12) / .36) * Math.PI * 4));
        drawPuppet(K('christelle', 1), CHR.x, CHR.y, CHR.h, { t, phase: PHC, grade: SUN, flip: true, lean: .02, rot: { head: .11 * nod } });
        // Nadège, phone up: it lights up violet on « estime »; she talks during her balloon
        const no = { t, phase: PHN, grade: SUN, talk: t > b12a && t < b12b ? 1 : 0, energy: .75 };
        drawPuppet(K('nadege', 1), NAD.x, NAD.y, NAD.h, no);
        const ph = phoneStage(K('nadege', 1), no);
        phoneGlow(t, ph, eOutCubic(clamp((t - glow0) / .45)) * .85, 115);
        surpriseLines(headOf(K('boris', 1), BOR.x, BOR.y, BOR.h, { t, phase: PHB, hop: glow0 + .25 }), t, glow0 + .2, glow0 + 1.1);
        sunLight(t, c);
      },
      screen(t) {
        dayCard(t, T12 + .4, 'MERCREDI');
        tabOnglet(t, T12 + .8, '③ LA SIMULATION');
        if (!c12) return;
        // the balloon rides with the panel (anchored above her head in the scene), kept below the day cartouche and the tab
        const sp = speaker(c12, K('nadege', 1), NAD, { t, phase: PHN, talk: 1, energy: .75 });
        balloon(t, { t0: b12a, t1: b12b, text: "Proforma d'abord. Fournisseur après !", x: clamp(sp.hx + 50, 330, 700), y: clamp(sp.top - 175, 500, 760), w: 600, size: 52, tail: tailAbove(sp.m, sp.top, -4), seed: 12 });
      } });

    // =============================================== P13 · les 4 gestes, SIMPA ==========================================
    const S13 = {
      head: T13 - .4,
      r1: tw('S15', 'Un', -.05), r1s: te('S15', 'code', -.2),
      r2: tw('S15', 'Deux', -.05), r2a: tw('S15', 'valeur', -.05), r2b: tw('S15', 'assurance', -.2), r2c: te('S15', 'compris', -.35),
      r3: tw('S15', 'Trois', -.05), r4: tw('S15', 'Quatre', -.05), r4a: tw('S15', 'votre', -.1),
    };
    S13.k1 = Math.min(S13.r1s + 1.1, S13.r2 + .25); S13.k2 = te('S15', 'compris', .0); S13.k4 = te('S15', 'situation', .12); S13.r4b = S13.r4a + .7;
    const tx = tw('S15', 'taxes'), tor = te('S15', "l'ordre");
    S13.c3 = [tx - .1, tx + .18, tx + .45, Math.min(tor - .05, tx + .75), Math.min(tor + .12, tx + 1.0)];
    S13.k3 = Math.max(S13.c3[4] + .35, tor + .1);
    S13.swipe = Math.max(S13.k4 + .55, ss('S16', -.45));
    const sw1 = S13.swipe + .55;
    const SP = { online: sw1 + .1, steps: [sw1 + .5, sw1 + .85, sw1 + 1.2, sw1 + 1.75], hl: tw('S16', 'accessible') };
    const pb0 = Math.max(tw('S16', 'SIMPA', -.05), sw1 + 2.6), pb1 = pb0 + .65;                 // pull back into her hand
    const bor0 = pb1 - .25, bor1 = bor0 + .55;                                                 // Boris pokes his head in
    const b13a = Math.min(tw('S16', 'accessible'), pb1), b13b = T14 - .05;
    const j13 = b13a + .9, c13l = b13a + 1.15;                                                 // Junior, then Christelle laugh
    const cam13 = { x: 537, y: 950, z: 1.08 };
    let c13 = null;
    defineShot({ id: 'P13', t0: T13, img: BG, seed: 13,
      cam: [{ t: T13, x: 560, y: 905, z: 1.7 }, { t: pb0, x: 560, y: 905, z: 1.7, e: 'lin' }, { t: pb1 + .2, ...cam13 },
        { t: T14, x: cam13.x - 6, y: cam13.y + 4, z: cam13.z * 1.005, e: 'lin' }],
      stage(t, n, c) {
        c13 = c;
        stall(t, { phase: 1.9, period: 3.9 });
        // Boris: from behind the right edge he leans in, grinning, box under the arm (he stands a step back, behind Christelle)
        const u = eOutBack(clamp((t - bor0) / (bor1 - bor0)), 1.3), bo = { t, phase: PHB, grade: BACK, lean: -.06 * u, talk: t > b13a && t < b13b ? 1 : 0, hop: bor1 };
        const bx = lerp(1110, BOR13.x, u);
        if (t > bor0 - .05) { drawPuppet(K('boris', 1), bx, BOR13.y, BOR13.h, bo); borisTag(t, K('boris', 1), bx, BOR13.y, BOR13.h, bo); }
        // Junior laughs at Boris' question
        const jo = { t, phase: PHJ, grade: SUN, hop: j13 + .05 };
        drawTrack([[T13, K('junior', 1)], [j13, K('junior', 3)]], JUN.x, JUN.y, JUN.h, jo);
        // Christelle watches, then laughs too (hand on the mouth)
        const co = { t, phase: PHC, grade: SUN, flip: true, lean: .02 };
        drawTrack([[T13, K('christelle', 1)], [c13l, K('christelle', 3)]], CHR.x, CHR.y, CHR.h, co);
        // Nadège reads her phone (N2); the drawn phone (screen) lands on it in screen(), then hands over to the picture
        const no = { t, phase: PHN, grade: SUN, energy: .6 };
        drawPuppet(K('nadege', 2), NAD.x, NAD.y, NAD.h, no);
        phoneGlow(t, phoneStage(K('nadege', 2), no), clamp((t - pb1) / .4) * .8, 120);
        laughLines(headOf(K('junior', 3), JUN.x, JUN.y, JUN.h, jo), t, j13 + .1, T14 + .3);
        laughLines(headOf(K('christelle', 3), CHR.x, CHR.y, CHR.h, co), t, c13l + .15, T14 + .3);
        sunLight(t, c, .8);
      },
      screen(t, n) {
        if (!c13) return;
        const kin = eOutCubic(clamp((t - T13) / .45)), kout = eInOutCubic(clamp((t - pb0) / (pb1 - pb0)));
        const k = lerp(.86, 1, kin) * (1 - kout);
        if (k > .02) { ctx.save(); ctx.fillStyle = `rgba(20,12,8,${.45 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
        const o = { t, phase: PHN, energy: .6 }, ps = phoneStage(K('nadege', 2), o), pp = stageToScreen(c13, ps.x, ps.y);
        const swipe = eInOutCubic(clamp((t - S13.swipe) / (sw1 - S13.swipe))), pa = 1 - clamp((t - pb1 - .05) / .35);
        let Pp = null;
        if (pa > 0) Pp = phoneBig(t, n, k, { x: pp.x, y: pp.y, w: ps.w * c13.s, rot: ps.rot }, () => {
          if (swipe < 1) { ctx.save(); ctx.translate(-CW * 1.04 * swipe, 0); cardGestes(t, S13); ctx.restore(); }
          if (swipe > 0) { ctx.save(); ctx.translate(CW * 1.04 * (1 - swipe), 0); cardSimpa(t, SP); ctx.restore(); }
        }, { glow: k < .3 ? 'rgba(170,120,255,.55)' : null, a: pa });
        // Nadège's finger ticks each gesture on the screen (enters from the left edge, taps, leaves after the 4th)
        const fa = clamp((k - .95) / .05) * clamp((t - (T13 + .35)) / .3), fo = eInOutCubic(clamp((t - (S13.k4 + .3)) / .55)), fi = eOutCubic(clamp((t - (T13 + .35)) / .6));
        if (Pp && fa > 0 && fo < 1) {
          const taps = [[S13.k1, ROWS.r1], [S13.k2, ROWS.r2], [S13.k3, ROWS.r3], [S13.k4, ROWS.r4]];
          let cy = taps[0][1] - 24; for (let i = 1; i < 4; i++) cy = lerp(cy, taps[i][1] - 24, eInOutCubic(clamp((t - (taps[i][0] - .6)) / .5)));
          let press = 0; for (const [tk] of taps) press = Math.max(press, t > tk - .04 && t < tk + .2 ? Math.sin(clamp((t - tk + .04) / .24) * Math.PI) : 0);
          const hover = (1 - press) * Math.sin(t * 2.6) * 5, q = cardPt(Pp, 50 - (1 - fi) * 420 - fo * 460 + hover, cy + 4 + hover * .6 + (1 - fi) * 160 + fo * 200);
          ctx.save(); ctx.globalAlpha *= fa; pointHand(q.x, q.y, 1.4 * q.s, -.62, press); ctx.restore();
        }
        // Boris: « Même moi, je peux ? » (above his head, inside the frame)
        const bo = { t, phase: PHB, talk: 1, lean: -.06 }, sp = speaker(c13, K('boris', 1), BOR13, bo);
        balloon(t, { t0: b13a, t1: b13b, text: 'Même moi, je peux ?', x: clamp(sp.hx - 120, 240, 830), y: clamp(sp.top - 165, 330, 900), w: 440, size: 54, tail: tailAbove(sp.m, sp.top, -10), seed: 13 });
      } });
    for (const k of ['k1', 'k2', 'k3', 'k4']) addShake(S13[k], 3, .08);                             // ticks (soft clicks)
    addShake(S13.swipe + .05, 2, .1);

    // =============================================== P14 · ce n'est qu'une estimation ==================================
    const b14a = T14 + .05, b14b = Math.max(b14a + 1.85, tw('S17', 'estimation', .3));            // Nadège: « Calculé. C'est exact ! »
    const est = tw('S17', 'estimation', .02), n4 = est + .12;                                      // yellow stamp, Nadège pouts (N4)
    const push0 = Math.max(tw('S17', "l'outil", -.12), b14b + .05), push1 = push0 + .55;          // into her phone, on « l'outil estime »
    const st1 = Math.max(tw('S17', 'estime', .05), push1 + .1), st2 = tw('S17', 'commissionnaire', .1), st3 = tw('S17', 'douane', .05);
    const pull0 = Math.max(se('S17', -.25), st3 + 1.2), pull1 = pull0 + .55;
    const b14c = pull0 + .4, b14d = T15 + .3;                                                      // Christelle teases (after the voice)
    const n3 = b14c + .75;                                                                         // Nadège bursts out laughing
    const camMed = { x: 600, y: 1069, z: 1.25 };
    // her phone (N4, at rest) — the push aims at it
    const PH4 = (() => { const R = RIGS[K('nadege', 4)], s = R ? NAD.h / R.h : .8, w = R ? R.w : 436; return { x: NAD.x + (PHONE.b.p[0] - w / 2) * s, y: NAD.y - NAD.h + PHONE.b.p[1] * s }; })();
    let c14 = null, ph14 = null, nad14 = null;
    defineShot({ id: 'P14', t0: T14, img: BG, seed: 14,
      cam: [{ t: T14, ...camMed }, { t: push0, x: camMed.x + 4, y: camMed.y - 4, z: camMed.z * 1.03, e: 'lin' }, { t: push1, x: PH4.x, y: PH4.y + 30, z: 2.1 },
        { t: pull0, x: PH4.x, y: PH4.y + 30, z: 2.15, e: 'lin' }, { t: pull1, ...camMed }, { t: T15 + .7, x: camMed.x - 6, y: camMed.y, z: camMed.z * 1.03, e: 'lin' }],
      stage(t, n, c) {
        c14 = c;
        stall(t, { phase: 2.6, period: 4.1, pushAt: est + .1, puff: env(t, est, est + 1.6, .12, .4) });
        // Boris, a step back in the street, box under the arm; he laughs with the others at the end
        const bo = { t, phase: PHB, grade: BACK, hop: n3 + .2 };
        drawPuppet(K('boris', 1), BOR.x, BOR.y, BOR.h, bo); borisTag(t, K('boris', 1), BOR.x, BOR.y, BOR.h, bo);
        // Junior, a step back; he laughs with Nadège at the end
        const jo = { t, phase: PHJ, grade: BACK, hop: n3 + .35 };
        drawTrack([[T14, K('junior', 1)], [n3 + .3, K('junior', 3)]], JUN14.x, JUN14.y, JUN14.h, jo);
        // Christelle (index raised), teasing after the voice
        const ct = t > b14c && t < b14d - .3 ? 1 : 0, co = { t, phase: PHC, grade: SUN, flip: true, talk: ct, lean: .03 + .03 * ct, hop: b14c + .05 };
        drawPuppet(K('christelle', 2), CHR.x, CHR.y, CHR.h, co);
        // Nadège: N1 (sure of herself) → N4 (pout, at the stamp) → N3 (bursts out laughing: head thrown back, shoulders shaking)
        const lau = env(t, n3, T15 + 1, .15, .2), no = { t, phase: PHN, grade: SUN, talk: (t > b14a && t < b14b) || t > n3 + .05 ? 1 : 0, hop: t < n4 + .5 ? n4 : n3, energy: .75,
          rot: { head: -.08 * lau + Math.sin(t * 19) * .025 * lau, chest: Math.sin(t * 17) * .018 * lau } };
        const nk = drawTrack([[T14, K('nadege', 1)], [n4, K('nadege', 4)], [n3, K('nadege', 3)]], NAD.x, NAD.y, NAD.h, no);
        ph14 = phoneStage(K('nadege', t < n4 ? 1 : 4), no); nad14 = no;
        // BD marks: surprise + sweat drop at the stamp, laugh lines at the end
        const hN = headOf(nk, NAD.x, NAD.y, NAD.h, no);
        surpriseLines(hN, t, n4, n4 + .9);
        sweatDrop(hN.x - hN.r * 1.05, hN.y - hN.r * .25, hN.r / 40, t, n4 + .15, push0 + .1);
        sweatDrop(hN.x - hN.r * 1.05, hN.y - hN.r * .25, hN.r / 40, t, pull1, n3 - .05);
        laughLines(hN, t, n3 + .05, T15 + .5);
        laughLines(headOf(K('junior', 3), JUN14.x, JUN14.y, JUN14.h, jo), t, n3 + .4, T15 + .5);
        sunLight(t, c, .8);
      },
      screen(t, n) {
        if (!c14) return;
        const kin = eInOutCubic(clamp((t - push0) / (push1 - push0))), kout = eInOutCubic(clamp((t - pull0) / (pull1 - pull0))), k = kin * (1 - kout);
        const pp = stageToScreen(c14, ph14.x, ph14.y), anchor = { x: pp.x, y: pp.y, w: ph14.w * c14.s, rot: ph14.rot };
        if (k > .02) { ctx.save(); ctx.fillStyle = `rgba(20,12,8,${.45 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
        // the phone (only while we go in / come back), fading in from her hand and out once back in it
        const pa = t < pull0 ? clamp(kin / .12) : clamp(1 - (t - pull1) / .2);
        let P = null;
        if (pa > 0 && t >= push0) P = phoneBig(t, n, k, anchor, () => {
          cardGestesDone(t);
          roundStamp(214, 1046, 168, ["L'OUTIL", 'ESTIME'], VIO, t, st1, { rot: -.16, seed: 31 });
          roundStamp(626, 1040, 252, ['LE', 'COMMISSIONNAIRE', 'AGRÉÉ DÉCLARE'], OCHRE, t, st2, { ry: 196, rot: .08, seed: 41 });
          roundStamp(445, 1668, 205, ['LA DOUANE', 'VÉRIFIE', 'ET CALCULE'], GREEN, t, st3, { rot: -.08, seed: 51 });
        }, { a: pa });
        // the yellow ESTIMATION stamp: slammed at chest height between the two friends in the medium shot (never on a face),
        // then carried onto the phone's screen by the push
        if (t >= est) {
          const ch = stageToScreen(c14, NAD.x + 105, NAD.y - NAD.h * .7), over = { x: clamp(ch.x, 300, 780), y: clamp(ch.y, 700, 1150), w: 500, rot: -.08 };
          let pose = over;
          if (P) { const q = cardPt(P, 445, 700), on = { x: q.x, y: q.y, w: 660 * q.s, rot: -.1 + P.rot, a: pa };
            pose = t < pull0 ? { x: lerp(over.x, on.x, kin), y: lerp(over.y, on.y, kin), w: lerp(over.w, on.w, kin), rot: lerp(-.08, -.1, kin), a: 1 } : on; }
          else if (t >= push0) pose = null;
          if (pose) estimationStamp(pose, t, est);
        }
        // balloons
        const sN = speaker(c14, K('nadege', 1), NAD, Object.assign({}, nad14 || {}, { t, talk: 1 }));
        balloon(t, { t0: b14a, t1: b14b, text: "Calculé. C'est exact !", x: clamp(sN.hx - 30, 250, 640), y: Math.max(345, sN.top - 175), w: 420, size: 56, tail: tailAbove(sN.m, sN.top, 4), seed: 14 });
        const co = { t, phase: PHC, flip: true, talk: 1, lean: .06 }, sC = speaker(c14, K('christelle', 2), CHR, co);
        balloon(t, { t0: b14c, t1: b14d, text: 'Même le taux du droit peut bouger !', x: clamp(sC.hx + 20, 300, 790), y: Math.max(345, sC.top - 185), w: 470, size: 52, tail: tailAbove(sC.m, sC.top, -10), seed: 15 });
      } });
    addShake(est, 15, .16); addShake(st1, 13, .15); addShake(st2, 13, .15); addShake(st3, 15, .17);
  });
})();

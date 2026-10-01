// =============================================================================================================
// P18 – P22 · VENDREDI (S20 – S24) — chez Madame Ekambi, transitaire agréée en douane (bg/bureau_ekambi)
//   P18  page turn to Friday. The office: Ekambi E1 (quote raised in her hand) seated in her green chair behind the desk,
//        Boris B3 (his box « PAS AVANT SAMEDI » under the arm, sweating) by the window, Christelle walks in (C5) and
//        stops, proud (C1). A drawn desk fan sweeps the room and lifts the sheets: one of them flies across the frame.
//        Cartouches VENDREDI, « MADAME EKAMBI · TRANSITAIRE AGRÉÉE EN DOUANE » (+ « l'adresse de Tantine »),
//        bottom « AU CAMEROUN, L'AGRÉÉ DÉCLARE ». Balloon « Déclarations d'impôts à jour ? Sinon, pas d'import ! ».
//   P19  Boris the vexed « inspector » leans in → Ekambi E3 laughs, then E2 points to the frame on the wall; Christelle
//        C3 laughs. Push onto the frame « DÉCISION D'AGRÉMENT · au nom de la société » + card « CODE DÉCLARANT · N° ▢▢▢▢ ».
//   P20  tight on Ekambi E1: the quote, two columns written on the voice, no amount.
//   P21  Ekambi E2 unrolls the chain BANQUE · CARTE · TÉLÉPHONE · GUICHET OFFICIEL → QUITTANCE ÉLECTRONIQUE · gardez-la
//        → BON DE SORTIE; in the margin the Roi du forfait, struck through in red: « JAMAIS À UNE PERSONNE ».
//   P22  insert: a hand signs a generic « DÉCLARATION »; then Ekambi E4 close; in the back the fan steals a sheet that
//        lands on Boris' box (he « catches » it); balloon « Vos vrais papiers, et tôt ! » right after « c'est la vôtre ».
// Everything is wrapped in an IIFE (all scene files share one global scope). Times come from the voice timeline only.
// =============================================================================================================
(() => {
  'use strict';
  const K = (who, n) => `cast/${who}_${n}`;
  const BG = 'bg/bureau_ekambi';
  const PHC = 0, PHB = 5.7, PHE = 2.9;                               // breathing phases (Christelle, Boris as on the other days)
  // office light: afternoon sun through the louvre window (right); Christelle stands a little further from it
  const SUNW = { mul: '#F1E4D0', tint: '#FFD69C', tintA: .06, rim: '#FFE7B5', rimA: .3, rimSide: 'right' };
  const ROOM = { mul: '#E9DCC8', tint: '#FFC985', tintA: .06, rim: '#FFE3AA', rimA: .2, rimSide: 'right' };
  const S = 1000 / 944;                                              // painting px → stage units (the office is 944 × 1680)
  const P2S = pts => pts.map(([x, y]) => [x * S, y * S]);

  // ---------- layout (stage units: 1000 × 1780) -------------------------------------------------------------------------
  // what stands IN FRONT of the people behind the desk, traced on the painting (px): the desk top from its back edge, the
  // mug, the little jar and the dark mug standing on it, and everything below (desk front, old computer, floor)
  const DESK = P2S([[244, 958], [300, 945], [350, 929], [400, 913], [450, 905], [500, 899], [550, 893], [600, 881], [650, 869], [700, 857],
    [740, 848], [757, 839], [758, 800], [757, 752], [762, 746], [838, 746], [842, 752], [842, 768], [849, 772], [852, 790], [851, 820], [843, 830],
    [836, 836], [852, 837], [854, 832], [854, 792], [860, 783], [890, 783], [894, 792], [894, 834], [897, 834], [897, 775], [902, 765], [944, 760],
    [944, 1680], [244, 1680]]);
  const EKA = { x: 478, top: 520, h: 1100 };                         // body (hips) x — seated in her green chair, behind the desk
  const CHR = { x: 200, y: 1712, h: 1150 };                          // Christelle, standing in front (visitor side)
  const BOR = { x: 840, y: 1262, h: 780 };                           // Boris, by the window, behind the desk's right end
  const FAN = { x: 560, y: 1112, s: .85 };                           // a desk fan near the front edge of the desk
  const FRAME = { x: 330, y: 430, w: 232, h: 292, rot: -.012 };      // the agrément, framed on the wall (over the painted frame)
  const PAPERS = [{ x: 330, y: 1040, w: 96, d: 40, seed: 1 }, { x: 700, y: 1010, w: 110, d: 40, seed: 2 }];   // little stacks of sheets

  // ---------- puppet helpers (same formulas as drawPuppet, so balloons, tags and marks can find a point of the body) -------
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
  /** a point of the cut-out (rig px p, moved by bone) in stage units, for a puppet drawn with feet at (x, y), height h */
  function bonePt(key, x, y, h, o, p, bone) {
    const R = RIGS[key], dir = o.flip ? -1 : 1, L = pupLift(o);
    if (!R) return { x, y: y - h * .5 };
    const M = boneMats(R, pupRot(R, o), o.off || {}), q = aff.ap(M[bone] || M.chest, p), s = h / R.h;
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce) };
  }
  const headPt = (key, x, y, h, o, pick) => { const R = RIGS[key]; return R && R.face ? bonePt(key, x, y, h, o, pick(R), R.face.bone || 'head') : { x, y: y - h * .9 }; };
  const mouthOf = (key, x, y, h, o) => headPt(key, x, y, h, o, R => R.face.mouth);
  /** the temple on the image-right side of the face (sweat drops, vexed mark) */
  const templeOf = (key, x, y, h, o) => headPt(key, x, y, h, o, R => { const [a, b] = R.face.eyes, e = a[0] > b[0] ? a : b, d = Math.abs(a[0] - b[0]) || 30;
    return [e[0] + d * .75, e[1] - d * .55]; });
  /** the middle of the face (between the eyes) */
  const faceOf = (key, x, y, h, o) => headPt(key, x, y, h, o, R => { const [a, b] = R.face.eyes; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 6]; });
  /** x at which to draw a cut-out so that its hips land on body x bx (the pictures are not centred the same way) */
  const xFor = (key, bx, h) => { const R = RIGS[key]; if (!R) return bx; const hp = R.bones.find(b => b.n === 'hips'); return bx - (hp.a[0] - R.w / 2) * h / R.h; };
  /** pose track [[t, key], …] at body x: draws the pose of time t (short cross-fade + squash on a change); returns the key */
  function drawTrack(keys, bx, y, h, o) {
    let i = 0; while (i + 1 < keys.length && o.t >= keys[i + 1][0]) i++;
    const [ts, key] = keys[i], u = o.t - ts;
    if (i > 0 && u < .2) {
      const prev = keys[i - 1][1], pop = u < .18 ? Math.sin(u / .18 * Math.PI) : 0, xb = xFor(key, bx, h);
      ctx.save(); if (pop) { ctx.translate(xb, y); ctx.scale(1 + .02 * pop, 1 - .03 * pop); ctx.translate(-xb, -y); }
      drawPuppet(key, xb, y, h, o);
      const k = clamp(u / .16); if (k < 1) drawPuppet(prev, xFor(prev, bx, h), y, h, Object.assign({}, o, { a: (o.a ?? 1) * (1 - k), shadow: false }));
      ctx.restore();
    } else drawPuppet(key, xFor(key, bx, h), y, h, o);
    return key;
  }
  const keyAt = (keys, t) => { let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++; return keys[i][1]; };
  /** balloon tail: aims at the mouth but stops above the head (never on the face) */
  const tailAbove = (m, topY, dx = 0) => [m.x + dx, Math.min(m.y - 16, topY - 10)];
  const scr = (c, p) => stageToScreen(c, p.x, p.y);
  function fitSize(txt, fam, size, maxW, ls = 0, wt = 400) { let s = size; while (s > 10 && measure(txt, font(fam, s, wt), ls) > maxW) s -= .5; return s; }

  // ---------- the office: window repair, desk in front, the fan, the loose sheets, the frame on the wall -------------------
  /** the louvre window behind Ekambi and Boris: the painting lost its slats and mullion where a figure was erased —
   *  redraw them (painting px), same colours and slope as the intact ones */
  function windowFix() {
    ctx.save(); ctx.scale(S, S); ctx.lineJoin = 'round';
    const slat = (x0, x1, y0, sl, th, c0, c1, seed) => {
      const y = x => y0 + sl * (x - x0), quad = (d0, d1) => { ctx.beginPath(); ctx.moveTo(x0, y(x0) + d0); ctx.lineTo(x1, y(x1) + d0); ctx.lineTo(x1, y(x1) + d1); ctx.lineTo(x0, y(x0) + d1); ctx.closePath(); };
      ctx.fillStyle = 'rgba(40,24,6,.18)'; quad(th / 2, th / 2 + 5); ctx.fill();                                     // its shadow below
      const g = ctx.createLinearGradient(0, y0 - th / 2, 0, y0 + th / 2); g.addColorStop(0, c0); g.addColorStop(1, c1);
      ctx.fillStyle = g; quad(-th / 2, th / 2); ctx.fill();
      ctx.save(); ctx.globalAlpha *= .35; ctx.strokeStyle = '#4A2C0C'; ctx.lineWidth = .8;                        // wood grain
      for (let k = 0; k < 4; k++) { const xa = x0 + hash(seed + k) * (x1 - x0) * .7, xb = xa + 20 + hash(seed + k + 9) * 50, d = -th / 2 + 2 + k * 1.4;
        ctx.beginPath(); ctx.moveTo(xa, y(xa) + d); ctx.lineTo(Math.min(x1, xb), y(Math.min(x1, xb)) + d); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(226,184,122,.75)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0, y(x0) - th / 2 + 1.5); ctx.lineTo(x1, y(x1) - th / 2 + 1.5); ctx.stroke();
      ctx.strokeStyle = '#2E1A06'; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(x0, y(x0) - th / 2); ctx.lineTo(x1, y(x1) - th / 2); ctx.moveTo(x0, y(x0) + th / 2); ctx.lineTo(x1, y(x1) + th / 2); ctx.stroke();
    };
    // left pane: slats every ~54 px, rising 0.18 to the right (measured on the intact ones at x 580–620); lower ones in the shade
    slat(588, 772, 389, -.18, 8, '#A9773F', '#7A5128', 1);
    slat(588, 772, 443, -.18, 8, '#9C7039', '#6E4B24', 2);
    slat(588, 772, 496, -.18, 8, '#8E7239', '#5E4A20', 3);
    // its bottom rail
    ctx.fillStyle = '#6F4318'; ctx.fillRect(590, 545, 182, 17); ctx.strokeStyle = '#2E1704'; ctx.lineWidth = 2; ctx.strokeRect(590, 545, 182, 17);
    ctx.fillStyle = 'rgba(240,215,170,.5)'; ctx.fillRect(590, 563, 182, 3);
    // right pane: the short pieces next to the mullion
    slat(798, 852, 364, -.08, 8, '#B07D42', '#7E5528', 4); slat(798, 852, 427, -.08, 8, '#A47640', '#755026', 5); slat(798, 852, 488, -.08, 8, '#987040', '#6A4A24', 6);
    // the mullion between the two panes (dark side + sunlit face), same colours as its intact top
    const gm = ctx.createLinearGradient(0, 320, 0, 660); gm.addColorStop(0, '#693D15'); gm.addColorStop(1, '#5A3412');
    ctx.fillStyle = gm; ctx.fillRect(771, 322, 19, 338);
    ctx.fillStyle = '#B3854D'; ctx.fillRect(790, 322, 11, 338);
    ctx.save(); ctx.globalAlpha *= .3; ctx.strokeStyle = '#2E1A06'; ctx.lineWidth = .9;
    for (let k = 0; k < 5; k++) { const xx = 773 + k * 3.5, y0 = 330 + hash(k * 3.3) * 120; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx + .5, y0 + 90 + hash(k * 5.1) * 120); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,236,196,.28)'; ctx.fillRect(792, 322, 2, 338);
    ctx.strokeStyle = '#2A1503'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(770.5, 322); ctx.lineTo(770.5, 660); ctx.moveTo(801.5, 322); ctx.lineTo(801.5, 660); ctx.stroke();
    ctx.restore();
  }
  /** redraw the desk, its mugs and everything in front over whoever is behind them */
  function deskFront(c) {
    const I = img(BG); if (!I) return;
    ctx.save(); ctx.beginPath(); DESK.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip();
    ctx.drawImage(I, 0, 0, c.iw, c.ih); ctx.restore();
  }
  /** oscillation of the desk fan (rad): 0 faces us, > 0 turns toward our left (the visitors), < 0 toward Ekambi */
  const fanYaw = t => Math.sin(t * .8 + .4) * .8;
  /** how much the fan blows on a point left (dir -1) or right (+1) of it, 0..1 */
  const fanOn = (t, dir) => clamp(dir * Math.sin(fanYaw(t)) / Math.sin(.8));
  /** a small cream desk fan, ink outlines: base at (x, y), ~220 units tall at s = 1; the head oscillates, the blades spin */
  function deskFan(x, y, s, t) {
    const yaw = fanYaw(t), sy = Math.sin(yaw), cy = Math.cos(yaw), R = 64;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(40,20,8,.28)'; ctx.beginPath(); ctx.ellipse(6, 4, 74, 15, 0, 0, 7); ctx.fill();            // contact shadow
    ctx.fillStyle = '#DCD3BC'; ctx.beginPath(); ctx.ellipse(0, -4, 60, 15, 0, 0, Math.PI); ctx.lineTo(-60, -14); ctx.ellipse(0, -14, 60, 15, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#EFE8D6'; ctx.beginPath(); ctx.ellipse(0, -14, 60, 15, 0, 0, 7); ctx.fill();
    inkPath(Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 2; return [Math.cos(a) * 60, -14 + Math.sin(a) * 15]; }), { w: 3, seed: 401 });
    inkLine(-60, -14, -60, -4, { w: 3, seed: 402 }); inkLine(60, -14, 60, -4, { w: 3, seed: 403 });
    inkPath(Array.from({ length: 13 }, (_, i) => { const a = i / 12 * Math.PI; return [Math.cos(a) * 60, -4 + Math.sin(a) * 15]; }), { w: 3, seed: 404 });
    ctx.fillStyle = '#C7402F'; ctx.beginPath(); ctx.arc(30, -8, 5, 0, 7); ctx.fill();                                    // the red switch
    ctx.fillStyle = '#D6CDB5'; ctx.fillRect(-8, -122, 16, 110); inkRect(-8, -122, 16, 110, { w: 2.6, seed: 405 });
    ctx.translate(0, -158);
    const mx = -sy * 34, rx = R * (.3 + .7 * Math.abs(cy));
    ctx.fillStyle = '#CFC5AB'; ctx.beginPath(); ctx.ellipse(mx, 6, 24 + 10 * Math.abs(sy), 28, 0, 0, 7); ctx.fill();
    inkPath(Array.from({ length: 21 }, (_, i) => { const a = i / 20 * Math.PI * 2; return [mx + Math.cos(a) * (24 + 10 * Math.abs(sy)), 6 + Math.sin(a) * 28]; }), { w: 2.6, seed: 406 });
    ctx.save(); ctx.translate(sy * 8, 0); ctx.scale(rx / R, 1);
    ctx.fillStyle = 'rgba(160,190,200,.28)'; ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, 7); ctx.fill();
    const spin = t * 13.7;
    for (let k = 0; k < 3; k++) { ctx.save(); ctx.rotate(spin + k * Math.PI * 2 / 3);
      ctx.fillStyle = 'rgba(120,165,180,.55)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(26, -22, 10, -R + 10); ctx.quadraticCurveTo(-14, -R + 12, -8, -6); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R * .62, spin, spin + 1.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,21,18,.55)'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
    for (const r of [R * .45, R * .75]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
    ctx.restore();
    inkPath(Array.from({ length: 33 }, (_, i) => { const a = i / 32 * Math.PI * 2; return [sy * 8 + Math.cos(a) * rx, Math.sin(a) * R]; }), { w: 3.6, seed: 407 });
    ctx.fillStyle = '#E9E2CE'; ctx.beginPath(); ctx.ellipse(sy * 8 + sy * 4, 0, 12 * (.4 + .6 * Math.abs(cy)), 12, 0, 0, 7); ctx.fill();
    inkCircle(sy * 12, 0, 12, { w: 2.4, seed: 408 });
    if (Math.abs(sy) > .25) {                                          // the breeze: ink streaks leaving the cage on the side it faces
      const d = sy > 0 ? -1 : 1, a = (Math.abs(sy) - .25) / .5;
      ctx.save(); ctx.globalAlpha *= clamp(a) * .7;
      for (let k = 0; k < 3; k++) { const u = (t * 1.6 + k / 3) % 1, x0 = d * (rx + 10 + u * 120), yy = (k - 1) * 36 + Math.sin(t * 3 + k) * 6;
        inkLine(x0, yy, x0 + d * 46, yy - 4, { w: 3, color: `rgba(255,250,235,${(1 - u) * .9})`, seed: 410 + k, wob: 2 }); }
      ctx.restore();
    }
    ctx.restore();
  }
  /** a little stack of sheets lying on the desk top (foreshortened like the desk); the top sheet's front corner lifts in the breeze */
  function deskPaper(p, lift, t) {
    const { x, y, w, d, seed } = p, k = clamp(lift) * (.7 + .3 * Math.sin(t * 15 + seed * 2));
    const ex = [w, w * .135], dp = [d * .95, -d * .75];
    const P = (u, v, ox = 0, oy = 0) => [x - w / 2 + ex[0] * u + dp[0] * v + ox, y - w * .0675 + ex[1] * u + dp[1] * v + oy];
    ctx.save();
    for (let i = 2; i >= 0; i--) {
      const o = i * 3, A = P(0, 0, -o, o), B = P(1, 0, -o, o), C = P(1, 1, -o, o), D = P(0, 1, -o, o);
      if (i === 2) { ctx.fillStyle = 'rgba(40,20,8,.22)'; ctx.beginPath(); [A, B, C, D].forEach(([px, py], j) => j ? ctx.lineTo(px + 5, py + 5) : ctx.moveTo(px + 5, py + 5)); ctx.closePath(); ctx.fill(); }
      if (i === 0) break;
      ctx.fillStyle = i === 2 ? '#EDE4CF' : '#F6EFDD'; ctx.beginPath(); [A, B, C, D].forEach(([px, py], j) => j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill();
      inkPath([A, B, C], { w: 1.8, seed: 425 + i + seed });
    }
    const A = P(0, 0), B = P(1, 0), C = P(1, 1), D = P(0, 1), E = P(.5, 0), F = P(0, .45), A2 = [A[0] + 10 * k, A[1] - 26 * k];
    ctx.fillStyle = '#FFFAEE'; ctx.beginPath(); ctx.moveTo(...E); ctx.lineTo(...B); ctx.lineTo(...C); ctx.lineTo(...D); ctx.lineTo(...F); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.globalAlpha *= .45; for (let i = 0; i < 3; i++) { const v = .3 + i * .22; inkLine(...P(.12, v), ...P(.8, v), { w: 1.5, color: '#5A4A40', seed: 430 + i + seed }); } ctx.restore();
    if (k > .04) { ctx.fillStyle = 'rgba(40,20,8,.16)'; ctx.beginPath(); ctx.moveTo(...E); ctx.lineTo(...A); ctx.lineTo(...F); ctx.closePath(); ctx.fill(); }
    const g = ctx.createLinearGradient(A2[0], A2[1], E[0], E[1]); g.addColorStop(0, '#E6DCC4'); g.addColorStop(1, '#FFFAEE');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(...E); ctx.quadraticCurveTo(lerp(E[0], A2[0], .5), lerp(E[1], A2[1], .5) - 5 * k, ...A2); ctx.quadraticCurveTo(lerp(F[0], A2[0], .5) - 3 * k, lerp(F[1], A2[1], .5), ...F); ctx.closePath(); ctx.fill();
    inkPath([F, D, C, B, E], { w: 2, seed: 440 + seed }); inkPath([E, A2, F], { w: 2, seed: 441 + seed });
    ctx.restore();
  }
  const papersAndFan = (t, k = 1, fan = true) => { PAPERS.forEach(p => deskPaper(p, fanOn(t, p.x < FAN.x ? -1 : 1) * k, t)); if (fan) deskFan(FAN.x, FAN.y, FAN.s, t); };
  /** a sheet tumbling through the air along ctrl points (stage units), between t0 and t0 + dur; returns its position */
  function flySheet(t, t0, dur, ctrl, w, seed = 1, o = {}) {
    const u = (t - t0) / dur; if (u < 0 || u > 1) return null;
    const P = curve(ctrl, 18), f = (o.ease || (x => x))(u) * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f)), r = f - i;
    const x = lerp(P[i][0], P[i + 1][0], r), y = lerp(P[i][1], P[i + 1][1], r);
    const tumble = Math.cos(u * (o.spin ?? 9) + seed), rot = Math.sin(u * 6 + seed) * .7 + u * (o.rot ?? 2.2), h = w * 1.3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(Math.abs(tumble) < .12 ? .12 * Math.sign(tumble || 1) : tumble, 1);
    withShadow(18, () => { ctx.fillStyle = tumble > 0 ? '#FFF9EC' : '#EFE5CF'; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: 3, seed: 450 + seed });
    if (tumble > 0) { ctx.globalAlpha *= .55; for (let k = 0; k < 4; k++) inkLine(-w * .36, -h * .3 + k * h * .16, w * (.1 + hash(k + seed) * .25), -h * .3 + k * h * .16, { w: 2, color: '#5A4A40', seed: 460 + k }); }
    ctx.restore();
    if (o.lines !== false && u > .05 && u < .95) { const j = Math.max(0, i - 3), bx = P[j][0], by = P[j][1], dx = x - bx, dy = y - by, L = Math.hypot(dx, dy) || 1;
      ctx.save(); ctx.globalAlpha *= .4; for (let k = -1; k <= 1; k += 2) { const ox = -dy / L * k * w * .28, oy = dx / L * k * w * .28;
        inkLine(x - dx / L * w * .85 + ox, y - dy / L * w * .85 + oy, x - dx / L * w * 1.35 + ox, y - dy / L * w * 1.35 + oy, { w: 2.5, seed: 470 + k }); } ctx.restore(); }
    return { x, y };
  }

  // ---------- BD marks -------------------------------------------------------------------------------------------------------
  function sweatDrop(x, y, s, u) {
    if (u <= 0 || u >= 1) return;
    const a = clamp(u / .12) * clamp((1 - u) / .3), dy = eInCubic(u) * 70 * s, sq = 1 + Math.sin(u * 20) * .05;
    ctx.save(); ctx.translate(x, y + dy); ctx.scale(s, s * sq); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(5, -8, 12, 0, 12, 7); ctx.arc(0, 7, 12, 0, Math.PI); ctx.bezierCurveTo(-12, 0, -5, -8, 0, -20); ctx.closePath();
    ctx.fillStyle = '#A8DDF5'; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(-4, 5, 3, 5.5, -.3, 0, 7); ctx.fill();
    ctx.restore();
  }
  /** Boris sweats: two drops in a loop near his temple + three little worry strokes */
  function borisSweat(t, p, s, k = 1) {
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= k;
    sweatDrop(p.x, p.y, s, ((t * .8) % 1));
    sweatDrop(p.x + 16 * s, p.y + 30 * s, s * .75, ((t * .8 + .45) % 1));
    for (let i = 0; i < 3; i++) { const a = -.9 + i * .45, r0 = 34 * s, r1 = 58 * s + Math.sin(t * 9 + i) * 4 * s;
      inkLine(p.x + Math.cos(a) * r0, p.y - 26 * s + Math.sin(a) * r0, p.x + Math.cos(a) * r1, p.y - 26 * s + Math.sin(a) * r1, { w: 3.2 * s, seed: 480 + i }); }
    ctx.restore();
  }
  /** comic laugh marks: little strokes that pop on both sides of the head while somebody laughs (t0 … t1) */
  function laughMarks(t, p, r, t0, t1, seed = 0) {
    const a = env(t, t0, t1, .12, .25); if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    for (const d of [-1, 1]) for (let i = 0; i < 3; i++) {
      const ang = (d < 0 ? Math.PI : 0) + (i - 1) * .42 * d - .25 * d, j = Math.sin(t * 14 + i * 2 + seed) * .08 * r;
      const r0 = r * 1.05 + j, r1 = r * 1.35 + j + (i === 1 ? r * .1 : 0);
      inkLine(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0, p.x + Math.cos(ang) * r1, p.y + Math.sin(ang) * r1, { w: Math.max(3, r * .07), seed: 490 + i + seed + (d > 0 ? 5 : 0) });
    }
    ctx.restore();
  }
  /** the BD « vexed » vein (four curved brackets), pulsing, at p, size r, presence k */
  function vexMark(t, p, r, k) {
    if (k <= 0) return; const pulse = (1 + Math.sin(t * 11) * .09) * k;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(.2); ctx.scale(r * pulse, r * pulse); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(.22, -.95); ctx.quadraticCurveTo(.26, -.26, .95, -.22);
      ctx.strokeStyle = BD.ink; ctx.lineWidth = .36; ctx.stroke(); ctx.strokeStyle = '#E2382E'; ctx.lineWidth = .2; ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  /** little radiating « surprise » strokes above a head */
  function popLines(t, p, r, t0, dur = .7) {
    const u = (t - t0) / dur; if (u < 0 || u > 1) return;
    const a = clamp(u / .1) * clamp((1 - u) / .35), g = eOutCubic(clamp(u / .3));
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < 5; i++) { const ang = -Math.PI / 2 + (i - 2) * .42, r0 = r * (1 + .25 * g), r1 = r * (1.45 + .35 * g);
      inkLine(p.x + Math.cos(ang) * r0, p.y + Math.sin(ang) * r0, p.x + Math.cos(ang) * r1, p.y + Math.sin(ang) * r1, { w: Math.max(3, r * .09), seed: 520 + i }); }
    ctx.restore();
  }

  // ---------- the frame on the wall ----------------------------------------------------------------------------------------
  /** the agrément in its frame (lettered by us, no emblem) + the CODE DÉCLARANT card slipped in its corner */
  function agrementFrame(t, glow = 0) {
    const { x, y, w, h, rot } = FRAME;
    propFrame(x, y, w, h, { rot, lift: 8, mat: '#F4EBD6' }, (iw, ih) => {
      ctx.fillStyle = '#FFFBF0'; ctx.fillRect(iw * .07, ih * .06, iw * .86, ih * .88);
      inkRect(iw * .1, ih * .085, iw * .8, ih * .83, { w: 1.6, color: '#9A7A4A', seed: 501 });
      const s1 = fitSize('DÉCISION', FF.bd, 40, iw * .74, 2), s2 = fitSize("D'AGRÉMENT", FF.bd, 40, iw * .74, 2);
      text('DÉCISION', iw / 2, ih * .25, { font: font(FF.bd, s1, 400), align: 'center', color: BD.ink, ls: 2 });
      text("D'AGRÉMENT", iw / 2, ih * .25 + s2 * 1.05, { font: font(FF.bd, s2, 400), align: 'center', color: BD.ink, ls: 2 });
      inkLine(iw * .24, ih * .25 + s2 * 1.38, iw * .76, ih * .25 + s2 * 1.38, { w: 2.4, color: BD.green, seed: 502 });
      const s3 = fitSize('au nom de la société', FF.brush, 30, iw * .78);
      text('au nom de la société', iw / 2, ih * .25 + s2 * 2.35, { font: font(FF.brush, s3, 400), align: 'center', color: '#3A2A20' });
      ctx.save(); ctx.globalAlpha *= .45;
      for (let i = 0; i < 3; i++) { const yy = ih * (.66 + i * .065); inkLine(iw * .2, yy, iw * (.62 + hash(i + 3) * .18), yy, { w: 1.6, color: '#5A4A40', seed: 503 + i }); }
      ctx.restore();
      inkPath([[iw * .52, ih * .87], [iw * .58, ih * .83], [iw * .62, ih * .88], [iw * .68, ih * .82], [iw * .74, ih * .86], [iw * .8, ih * .84]], { w: 2, color: '#2B3A7A', seed: 507 });
    });
    if (glow > 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= glow * .5; ctx.strokeStyle = '#FFE7A0'; ctx.lineWidth = 10; ctx.shadowColor = '#FFE08A'; ctx.shadowBlur = 30; ctx.strokeRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12); ctx.restore(); }
    // the card, slipped into the lower-left corner of the frame (clear of « au nom de la société »)
    ctx.save(); ctx.translate(x - w * .3, y + h * .31); ctx.rotate(-.09);
    const cw = w * .66, ch = cw * .42;
    withShadow(6, () => { ctx.fillStyle = '#FFF3C9'; ctx.fillRect(-cw / 2, -ch / 2, cw, ch); });
    inkRect(-cw / 2, -ch / 2, cw, ch, { w: 2.4, seed: 510 });
    const fs = fitSize('CODE DÉCLARANT', FF.bd, 30, cw * .86, 1);
    text('CODE DÉCLARANT', 0, -ch * .08, { font: font(FF.bd, fs, 400), align: 'center', color: BD.ink, ls: 1 });
    const nf = font(FF.bd, fs * .95, 400), nw = measure('N°', nf, 1), bx = fs * .78, gap = fs * .16, tot = nw + gap * 2 + 4 * bx + 3 * gap, x0 = -tot / 2, by = ch * .3;
    text('N°', x0, by, { font: nf, color: BD.ink, ls: 1 });
    for (let i = 0; i < 4; i++) inkRect(x0 + nw + gap * 2 + i * (bx + gap), by - bx * .9, bx, bx, { w: 2, seed: 511 + i });
    ctx.restore();
  }

  // ---------- characters in the office -----------------------------------------------------------------------------------
  const eY = h => EKA.top + h;                                       // feet (hidden behind the desk) from the head line
  const ekX = key => xFor(key, EKA.x, EKA.h);
  function ekambi(t, keys, o = {}) { drawTrack(keys, EKA.x, eY(EKA.h), EKA.h, Object.assign({ t, phase: PHE, grade: SUNW, shadow: false }, o)); }
  const bo3 = K('boris', 3);
  function boris(t, o = {}) {
    const h = o.h ?? BOR.h, x = o.x ?? BOR.x, y = o.y ?? BOR.y, oo = Object.assign({ t, phase: PHB, grade: ROOM, shadow: false }, o);
    drawPuppet(bo3, x, y, h, oo);
    if (!o.tagLater) borisTag(t, x, y, h, oo);
    return Object.assign(oo, { x, y, h });
  }
  /** the tag « PAS AVANT SAMEDI » tied to the front-left top corner of the box Boris carries in B3 (follows his arm),
   *  hanging a little toward his hip so it stays clear of the mugs on the desk */
  function borisTag(t, x, y, h, o) {
    const pin = bonePt(bo3, x, y, h, o, [302, 418], 'armL_up'), s = h / 1250, th = 58 * s, cx = pin.x - .055 * h, cy = pin.y + th * 1.25;
    inkLine(pin.x, pin.y, cx, cy - th * .9, { w: 2, color: '#6B4A2A', seed: 63 });
    propTag(cx, cy, s, 'PAS AVANT SAMEDI', { t: t + PHB });
  }
  const boxTop = (x, y, h, o) => bonePt(bo3, x, y, h, o, [382, 393], 'armL_up');   // middle of the box's top face
  function christelle(t, keys, o = {}) {
    const R = k => (RIGS[k] ? RIGS[k].h : 1824) / 1824;               // same pixel scale for all her pictures
    let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
    const key = keys[i][1], prev = i > 0 ? keys[i - 1][1] : null, u = t - keys[i][0];
    const oo = Object.assign({ t, phase: PHC, grade: ROOM }, o), x = o.x ?? CHR.x;
    drawPuppet(key, xFor(key, x, CHR.h * R(key)), CHR.y, CHR.h * R(key), oo);
    if (prev && u < .16) drawPuppet(prev, xFor(prev, x, CHR.h * R(prev)), CHR.y, CHR.h * R(prev), Object.assign({}, oo, { a: 1 - u / .16, shadow: false }));
  }

  // ---------- screen captions ----------------------------------------------------------------------------------------------
  /** « MADAME EKAMBI » / « TRANSITAIRE AGRÉÉE EN DOUANE » (one line) + the cream strip « l'adresse de Tantine » under it.
   *  Placed beside the VENDREDI card when it fits, under it otherwise; the second line is written fast, then holds. */
  function nameCard(t, t0, l2T0, noteT0, tOut) {
    if (t < t0 || t > tOut + .3) return;
    const k = clamp(spring(t - t0, 15, .5), 0, 1.15), a = clamp((t - t0) / .12) * clamp((tOut + .3 - t) / .3);
    const l1 = 'MADAME EKAMBI', l2 = 'TRANSITAIRE AGRÉÉE EN DOUANE', f1 = font(FF.bd, 64, 400);
    const dayW = measure('VENDREDI', font(FF.bd, 62, 400), 3) + 60, room = 1030 - dayW - 28 - 60;      // free width left of the day card
    let s2 = 48; while (s2 > 44 && measure(l2, font(FF.bd, s2, 400), 2) + 64 > room) s2 -= .5;
    const w = Math.max(measure(l1, f1, 3), measure(l2, font(FF.bd, s2, 400), 2)) + 64, h = 172, x = 60, y = w <= room ? 252 : 352;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + h / 2); ctx.scale(k, k); ctx.rotate(-.012);
    withShadow(8, () => { ctx.fillStyle = BD.recit; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: 4.5, seed: 520 });
    text(l1, 0, -h / 2 + 72, { font: f1, align: 'center', color: BD.ink, ls: 3 });
    inkLine(-w / 2 + 30, -h / 2 + 92, w / 2 - 30, -h / 2 + 92, { w: 2.5, color: BD.orange, seed: 521 });
    ctx.save(); ctx.letterSpacing = '2px';
    writeOn(l2, 0, -h / 2 + 146, t, l2T0, .5, { size: s2, fam: FF.bd, align: 'center', color: '#3B2A1E' });
    ctx.restore();
    ctx.restore();
    if (t >= noteT0 - .05) {                                              // the handwritten note on a cream strip, pinned under the card
      const nf = font(FF.brush, 54, 400), nw = measure("l'adresse de Tantine", nf) + 120, nh = 78, kk = clamp(spring(t - noteT0 + .05, 16, .55), 0, 1.1);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + 30 + nw / 2, y + h + 44); ctx.scale(kk, kk); ctx.rotate(.02);
      withShadow(6, () => { ctx.fillStyle = '#FFF6E2'; ctx.fillRect(-nw / 2, -nh / 2, nw, nh); });
      inkRect(-nw / 2, -nh / 2, nw, nh, { w: 3, seed: 524 });
      writeOn("l'adresse de Tantine", -nw / 2 + 24, 18, t, noteT0 + .05, .6, { size: 54, fam: FF.brush, color: '#2B3A7A' });
      const u = clamp((t - noteT0 - .65) / .3);
      if (u > 0) { const ax = nw / 2 - 86, ay = 2;
        inkPath([[ax, ay], [ax + 34 * u, ay - 4 * u], [ax + 58 * u, ay + 4 * u]], { w: 4, color: BD.orange, seed: 522 });
        if (u >= 1) inkPath([[ax + 44, ay - 8], [ax + 60, ay + 4], [ax + 42, ay + 14]], { w: 4, color: BD.orange, seed: 523 }); }
      ctx.restore();
    }
  }
  /** small caption at the foot of the panel (yellow récitatif style) */
  function footCard(t, t0, label, y = 1560) {
    if (t < t0) return;
    const k = clamp(spring(t - t0, 15, .55), 0, 1.12), a = clamp((t - t0) / .12), f = font(FF.bd, 52, 400), w = measure(label, f, 2) + 60, h = 80;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(540, y); ctx.scale(k, k); ctx.rotate(.012);
    withShadow(8, () => { ctx.fillStyle = BD.recit; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: 4, seed: 530 });
    text(label, 0, 18, { font: f, align: 'center', color: BD.ink, ls: 2 });
    ctx.restore();
  }

  // ---------- P20 · the quote (screen px) ----------------------------------------------------------------------------------
  const QUOTE = { x: 45, y: 585, w: 990, h: 640 };
  const QC1 = { x: 88, w: 430 }, QC2 = { x: 568, w: 440 };
  function quoteSheet(t, T, view) {
    const { x, y, w, h } = QUOTE;
    ctx.save(); ctx.translate(view.px, view.py); ctx.scale(view.k, view.k); ctx.translate(-view.ax, -view.ay);
    paperSheet(x + w / 2, y + h / 2, w, h, { rot: -.008, lift: 18, lines: 54, top: 132, seed: 540 }, (W2, H2) => {
      const L = (sx, sy) => [sx - x, sy - y];
      const dv = clamp((t - T.sep) / .45); if (dv > 0) { const [dx, dy0] = L(540, 612), [, dy1] = L(540, 612 + 468 * dv); inkLine(dx, dy0, dx, dy1, { w: 3.5, seed: 541 }); }
      const h1 = "À L'ÉTAT", h2 = 'À MADAME EKAMBI';
      const s1 = fitSize(h1, FF.bd, 58, QC1.w, 2), s2 = fitSize(h2, FF.bd, 58, QC2.w, 2);
      ctx.save(); ctx.letterSpacing = '2px';
      writeOn(h1, ...L(QC1.x, 662), t, T.h1, .35, { size: s1, fam: FF.bd, color: '#B5452A' });
      writeOn(h2, ...L(QC2.x, 662), t, T.h2, .45, { size: s2, fam: FF.bd, color: '#5B2C9A' });
      ctx.restore();
      if (t > T.h1 + .3) inkLine(...L(QC1.x, 680), ...L(QC1.x + QC1.w * clamp((t - T.h1 - .3) / .3), 680), { w: 3, color: '#B5452A', seed: 542 });
      if (t > T.h2 + .4) inkLine(...L(QC2.x, 680), ...L(QC2.x + QC2.w * clamp((t - T.h2 - .4) / .3), 680), { w: 3, color: '#5B2C9A', seed: 543 });
      const LH = 58, o = { size: 48, fam: FF.letN, color: BD.ink };
      T.c1.forEach(([txt, t0, dur], i) => writeOn(txt, ...L(QC1.x, 738 + i * LH), t, t0, dur, Object.assign({}, o, { size: fitSize(txt, FF.letN, 50, QC1.w), color: i >= 3 ? '#7A2E1C' : BD.ink })));
      T.c2.forEach(([txt, t0, dur], i) => writeOn(txt, ...L(QC2.x, 738 + i * LH + (i >= 3 ? 20 : 0)), t, t0, dur, Object.assign({}, o, { size: fitSize(txt, FF.letN, 50, QC2.w) })));
      if (t > T.c2[2][1] + .2) { ctx.save(); ctx.globalAlpha *= clamp((t - T.c2[2][1] - .2) / .3) * .6; inkLine(...L(QC2.x + 10, 888), ...L(QC2.x + 200, 888), { w: 2, color: '#5B2C9A', seed: 544 }); ctx.restore(); }
      const ft = 'une même ligne ne se paie pas deux fois', fs = fitSize(ft, FF.brush, 54, 900);
      writeOn(ft, ...L(540, 1178), t, T.foot, .8, { size: fs, fam: FF.brush, color: '#2B3A7A', align: 'center', underline: true, ucolor: BD.orange });
    });
    ctx.restore();
  }

  // ---------- P21 · the payment chain (screen px) --------------------------------------------------------------------------
  function iconBank(s) {        // a plain bank building (no emblem)
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#F3E6C8'; ctx.beginPath(); ctx.moveTo(-60, -22); ctx.lineTo(0, -56); ctx.lineTo(60, -22); ctx.closePath(); ctx.fill(); inkPath([[-60, -22], [0, -56], [60, -22], [-60, -22]], { w: 3.5, seed: 601 });
    for (let i = 0; i < 4; i++) { const xx = -44 + i * 29; ctx.fillStyle = '#F3E6C8'; ctx.fillRect(xx - 7, -16, 14, 50); inkRect(xx - 7, -16, 14, 50, { w: 2.6, seed: 602 + i }); }
    ctx.fillStyle = '#E2CFA4'; ctx.fillRect(-64, 34, 128, 14); inkRect(-64, 34, 128, 14, { w: 3, seed: 607 });
    ctx.restore();
  }
  function iconCard(s) {
    ctx.save(); ctx.scale(s, s); ctx.rotate(-.12);
    withShadow(4, () => { ctx.fillStyle = '#2E8B57'; rrect(-62, -40, 124, 80, 10); ctx.fill(); });
    ctx.fillStyle = '#1E1512'; ctx.fillRect(-62, -24, 124, 14);
    ctx.fillStyle = '#F5D37A'; rrect(-48, 0, 26, 20, 4); ctx.fill(); inkRect(-48, 0, 26, 20, { w: 2, seed: 611 });
    ctx.lineWidth = 4; ctx.strokeStyle = BD.ink; rrect(-62, -40, 124, 80, 10); ctx.stroke();
    ctx.restore();
  }
  function iconPhone(s) {
    ctx.save(); ctx.scale(s, s);
    propPhone(0, 0, 54, { rot: .08, lift: 4 }, (sw, sh) => { ctx.fillStyle = '#DCEFE4'; ctx.fillRect(0, 0, sw, sh);
      ctx.strokeStyle = BD.green; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sw * .25, sh * .52); ctx.lineTo(sw * .45, sh * .64); ctx.lineTo(sw * .78, sh * .36); ctx.stroke(); });
    ctx.restore();
  }
  function iconCounter(s) {     // an official counter window (guichet), no emblem
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#E9D7B0'; ctx.fillRect(-62, -50, 124, 96); inkRect(-62, -50, 124, 96, { w: 3.4, seed: 621 });
    ctx.fillStyle = '#CFE6EE'; ctx.beginPath(); ctx.moveTo(-40, 16); ctx.lineTo(-40, -20); ctx.quadraticCurveTo(0, -46, 40, -20); ctx.lineTo(40, 16); ctx.closePath(); ctx.fill();
    inkPath([[-40, 16], [-40, -20], [0, -33], [40, -20], [40, 16]], { w: 3, seed: 622 });
    ctx.fillStyle = '#B98A55'; ctx.fillRect(-56, 16, 112, 12); inkRect(-56, 16, 112, 12, { w: 2.6, seed: 623 });
    inkLine(0, -30, 0, 16, { w: 2, color: 'rgba(30,21,18,.5)', seed: 624 });
    ctx.restore();
  }
  /** abstract, non-scannable « QR »: rounded dots, no finder pattern */
  function abstractQR(x, y, s, seed = 9) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-s / 2, -s / 2, s, s); inkRect(-s / 2, -s / 2, s, s, { w: 3, seed: 631 });
    const N = 13, c = (s - 18) / N; ctx.fillStyle = '#2A1E3A';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (hash(seed * 31 + i * 7.3 + j * 13.1) > .5) { rrect(-s / 2 + 9 + i * c + c * .1, -s / 2 + 9 + j * c + c * .1, c * .8, c * .8, c * .3); ctx.fill(); }
    ctx.restore();
  }
  /** the Roi du forfait (his R1 picture: sunglasses, phone up, showman smile) as a violet-inked bust in a round badge, struck in red */
  function roiStruck(t, x, y, s, t0, tStrike) {
    if (t < t0) return;
    const k = clamp(spring(t - t0, 14, .55), 0, 1.1), a = clamp((t - t0) / .12);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(k * s, k * s);
    withShadow(8, () => { ctx.fillStyle = '#FFF6E2'; ctx.beginPath(); ctx.arc(0, 0, 120, 0, 7); ctx.fill(); });
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 116, 0, 7); ctx.clip();
    const R1 = img(K('roi', 1));
    if (R1) {                                                     // head + shoulders + the phone, toned to violet ink (a silhouette that keeps his look)
      const c = makeCanvasCached('roiBust', 300, 300), g = c.getContext('2d'), k2 = 300 / (R1.width * .92);   // 92 % of the picture width fills the badge (head, shoulders, phone)
      g.clearRect(0, 0, 300, 300); g.drawImage(R1, 150 - R1.width * .49 * k2, 26 - R1.height * .004 * k2, R1.width * k2, R1.height * k2);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(58,34,92,.5)'; g.fillRect(0, 0, 300, 300); g.globalCompositeOperation = 'source-over';
      ctx.drawImage(c, -150, -132, 300, 300);
    }
    ctx.restore();
    inkCircle(0, 0, 118, { w: 6, seed: 642 });
    const u = clamp((t - tStrike) / .18);
    if (u > 0) { ctx.save(); ctx.lineCap = 'round';
      inkLine(-96, -96, -96 + 192 * u, -96 + 192 * u, { w: 20, color: BD.red, seed: 643 });
      if (u >= 1) { const v = clamp((t - tStrike - .18) / .18); inkLine(96, -96, 96 - 192 * v, -96 + 192 * v, { w: 20, color: BD.red, seed: 644 }); }
      inkCircle(0, 0, 118, { w: 10 * u, color: BD.red, seed: 645 });
      ctx.restore(); }
    ctx.restore();
  }
  function arrowInk(x0, y0, x1, y1, k, color = BD.orange, bend = 0) {
    if (k <= 0) return;
    const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
    const P = curve([[x0, y0], [mx, my], [x1, y1]], 14), n = Math.max(2, Math.round(P.length * clamp(k)));
    inkPath(P.slice(0, n), { w: 7, color, seed: 650 });
    if (k >= 1) { const a = Math.atan2(y1 - P[P.length - 3][1], x1 - P[P.length - 3][0]);
      inkPath([[x1 - Math.cos(a - .5) * 26, y1 - Math.sin(a - .5) * 26], [x1, y1], [x1 - Math.cos(a + .5) * 26, y1 - Math.sin(a + .5) * 26]], { w: 7, color, seed: 651 }); }
  }
  const popK = (t, t0) => clamp(spring(t - t0, 15, .5), 0, 1.15);
  function iconCell(t, t0, x, y, label, draw) {
    if (t < t0) return;
    const k = popK(t, t0), a = clamp((t - t0) / .1);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(k, k);
    withShadow(6, () => { ctx.fillStyle = '#FFF8E8'; rrect(-118, -112, 236, 224, 18); ctx.fill(); });
    inkPath([[-118, -94], [-118, 94], [-100, 112], [100, 112], [118, 94], [118, -94], [100, -112], [-100, -112], [-118, -94]], { w: 3.5, seed: 660 + (x | 0) % 7 });
    ctx.save(); ctx.translate(0, -26); draw(); ctx.restore();
    const lines = label.split('\n');
    lines.forEach((l, i) => text(l, 0, 70 + (i - (lines.length - 1)) * 42 + (lines.length > 1 ? 22 : 0), { font: font(FF.bd, fitSize(l, FF.bd, 44, 214, 1), 400), align: 'center', color: BD.ink, ls: 1 }));
    ctx.restore();
  }

  // ---------- P22 · the insert: a hand signs a generic declaration --------------------------------------------------------
  function deskWood() {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#8A5A33'); g.addColorStop(1, '#5E3A1F');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .35;
    for (let k = 0; k < 46; k++) { const y0 = k * 44 + hash(k) * 20; ctx.strokeStyle = hash(k * 3.1) > .5 ? '#4A2B14' : '#A9764A'; ctx.lineWidth = 1 + hash(k * 7) * 2.5;
      ctx.beginPath(); for (let x = -20; x <= W + 20; x += 40) { const yy = y0 + Math.sin(x / 170 + k) * 6 + Math.sin(x / 53 + k * 2) * 2; x < 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#2F5E4A'; ctx.save(); ctx.translate(540, 860); ctx.rotate(-.05); withShadow(6, () => ctx.fillRect(-470, -560, 940, 1120)); ctx.restore();   // green desk blotter
  }
  /** the pen tip of propHand pose 'pen' in hand-local units (before rotation/scale): see 12_props.js */
  const PEN_TIP = [-10 + 88 * Math.sin(-.35), -86 - 88 * Math.cos(-.35)];
  function handSigning(t, t0, dur, line) {
    const [x0, y0, x1] = line, N = 60, pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; pts.push([lerp(x0, x1, u), y0 - 18 * Math.sin(u * Math.PI * 7.5) * (1 - .4 * u) - 26 * Math.exp(-Math.pow((u - .18) * 9, 2)) + 10 * Math.sin(u * 3)]); }
    const k = clamp((t - t0) / dur), n = Math.max(1, Math.round(k * N));
    if (k > 0) inkPath(pts.slice(0, n + 1), { w: 5.5, color: '#1F2E6E', seed: 701, wob: 1 });
    const tip = k > 0 ? pts[n] : [x0 - 30, y0 - 50 + Math.sin(t * 3) * 6];
    const r = -.95, s = 2.0, c = Math.cos(r), sn = Math.sin(r), px = PEN_TIP[0] * s, py = PEN_TIP[1] * s, lift = k > 0 && k < 1 ? 0 : -14;
    const wx = tip[0] - (px * c - py * sn), wy = tip[1] - (px * sn + py * c) + lift;
    propHand(wx, wy, s, { rot: r, pose: 'pen', sleeve: '#6B3A1E', dots: false, arm: 700, pen: '#23305E', penTip: '#1F2E6E' });
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(r); ctx.scale(s, s);
    for (const [yy, ww] of [[34, 50], [48, 54]]) { ctx.fillStyle = '#E9B949'; ctx.fillRect(-ww, yy, ww * 2, 8); ctx.strokeStyle = BD.ink; ctx.lineWidth = 2; ctx.strokeRect(-ww, yy, ww * 2, 8); }
    ctx.restore();
  }

  shots(() => {
    // ================================================ times (voice) ================================================
    const T18 = shotStart('S20'), T19 = shotStart('S21'), T20 = shotStart('S22'), TEND = shotStart('S25');
    const T21 = ss('S23', -.12), T22 = ss('S24', -.1);                              // P20 and P21 keep their last lines a moment longer

    // =============================================== P18 · VENDREDI, chez Madame Ekambi ==============================
    const day0 = tw('S20', 'Vendredi', .15);
    const name0 = tw('S20', 'Madame'), l20 = name0 + .3, note0 = te('S20', 'Ekambi', .3);   // the card's 2nd line is written right away
    const foot0 = tw('S20', 'appelle');
    const b18a = te('S20', 'commissionnaire', -.75), b18b = T19 - .05;           // « Déclarations d'impôts à jour ? Sinon, pas d'import ! »
    const nameOut = b18a - .2;
    const fly18 = tw('S20', 'transitaire', .1);                                    // a sheet takes off from the desk and crosses the frame
    const nod18 = b18a + 1.0;                                                      // Christelle nods (her taxes are up to date)
    const cIn0 = T18 + .15, cIn1 = tw('S20', 'Madame', .15);                       // Christelle walks in (C5) and stops, proud (C1)
    const chrX18 = t => lerp(-290, CHR.x, 1 - Math.pow(1 - clamp((t - cIn0) / (cIn1 - cIn0)), 1.7));
    const E1 = K('ekambi', 1);
    let c18 = null;
    defineShot({ id: 'P18', t0: T18, img: BG, seed: 18, inT: .7, inKind: 'page',
      cam: [{ t: T18, x: 400, y: 905, z: 1.14 }, { t: cIn1 + .3, x: 480, y: 892, z: 1.08 }, { t: tw('S20', 'transitaire', .3), x: 530, y: 884, z: 1.05 }, { t: T19, x: 536, y: 886, z: 1.06, e: 'lin' }],
      stage(t, n, c) {
        c18 = c;
        windowFix();
        agrementFrame(t);
        // Boris by the window, his box under the arm, sheepish and sweating; the tax question makes him flinch
        const bo = boris(t, { tagLater: true, lean: (t > b18a + .3 ? -.03 : 0) + .015 * Math.sin(t * 1.3), hop: b18a + .5, rot: { head: .06 * env(t, b18a + .4, T19, .3, .2) } });
        ekambi(t, [[T18, E1]], { talk: t > b18a && t < b18b - .1 ? 1 : 0, rot: { head: -.05 * env(t, cIn1 - .4, TEND, .5, .1) + .04 * env(t, T18, cIn1 - .2, .1, .4) } });
        deskFront(c);
        borisTag(t, bo.x, bo.y, bo.h, bo);
        papersAndFan(t);
        borisSweat(t, templeOf(bo3, BOR.x, BOR.y, BOR.h, bo), 1.05, 1);
        // Christelle, proud (hands on hips), nods at the tax question; she leans back as the sheet flies past
        const nod = env(t, nod18, nod18 + .8, .15, .3) * Math.sin((t - nod18) * 9) * .06;
        const co = { t, phase: PHC, grade: ROOM, rot: { head: nod }, lean: -.035 * env(t, fly18 + .5, fly18 + 1.4, .2, .4) };
        const C5 = K('christelle', 5), C1 = K('christelle', 1), h5 = CHR.h * 1788 / 1824;
        if (t < cIn1) drawPuppet(C5, xFor(C5, chrX18(t), h5), CHR.y, h5, Object.assign({}, co, { walk: { speed: 1.35 }, walkT0: cIn0, rot: {} }));
        else { drawPuppet(C1, xFor(C1, CHR.x, CHR.h), CHR.y, CHR.h, Object.assign({}, co, { hop: cIn1 - .05 }));
          const k = clamp((t - cIn1) / .16); if (k < 1) drawPuppet(C5, xFor(C5, CHR.x, h5), CHR.y, h5, Object.assign({}, co, { a: 1 - k, shadow: false, rot: {} })); }
        // the sheet: off the desk by the fan, up between Ekambi's face and her raised quote, over both heads and out
        flySheet(t, fly18, 1.6, [[600, 1050], [578, 900], [575, 760], [592, 625], [578, 470], [440, 380], [190, 356], [-150, 330]], 104, 3, { ease: x => x * (1.35 - .35 * x) });
      },
      screen(t) {
        dayCard(t, day0, 'VENDREDI');
        nameCard(t, name0, l20, note0, nameOut);
        footCard(t, foot0, "AU CAMEROUN, L'AGRÉÉ DÉCLARE");
        if (!c18) return;
        const o = { t, phase: PHE, talk: 1 }, m = scr(c18, mouthOf(E1, ekX(E1), eY(EKA.h), EKA.h, o)), top = stageToScreen(c18, EKA.x, EKA.top).y;
        balloon(t, { t0: b18a, t1: b18b, text: "Déclarations d'impôts à jour ? Sinon, pas d'import !", x: clamp(m.x - 130, 320, 400), y: clamp(top - 175, 360, 390), w: 600, size: 52,
          tail: tailAbove(m, top, 10), seed: 18 });
      } });

    // =============================================== P19 · « Et vous, votre agrément ? » =================================
    const q0 = Math.max(T19 + .15, tw('S21', 'Boris', -.15)), q1 = q0 + 2.05;                                           // Boris: « Et vous, votre agrément ? Votre code ? »
    const laugh = q1 - .15, r0 = laugh + .55, r1 = T20 + .05;                      // Ekambi E3 laughs, then E2: « Au nom exact de ma société. »
    const push0 = r0 + .15, push1 = T20 - .2;
    const ekaKeys19 = [[T19, E1], [laugh, K('ekambi', 3)], [r0 - .1, K('ekambi', 2)]];
    const chrKeys19 = [[T19, K('christelle', 1)], [laugh + .1, K('christelle', 3)]];
    const bx19 = t => BOR.x - 12 * eInOutCubic(prog(t, T19, T19 + .5)) + 12 * eInOutCubic(prog(t, laugh + .3, laugh + 1));
    const bo19 = t => { const inspect = t < laugh + .3; return { t, phase: PHB, x: bx19(t), talk: t > q0 && t < q1 - .1 ? 1 : 0,
      lean: inspect ? -.055 * env(t, T19, laugh + .3, .4, .3) : .015 * Math.sin(t * 1.3), rot: { head: inspect ? -.1 * env(t, T19, laugh + .3, .4, .3) : .05 } }; };
    let c19 = null;
    defineShot({ id: 'P19', t0: T19, img: BG, seed: 19,
      cam: [{ t: T19, x: 548, y: 872, z: 1.1 }, { t: push0, x: 540, y: 860, z: 1.13 }, { t: push1, x: 372, y: 560, z: 1.42 }, { t: T20, x: 370, y: 556, z: 1.44, e: 'lin' }],
      stage(t, n, c) {
        c19 = c;
        windowFix();
        agrementFrame(t, env(t, r0, T20 + .3, .3, .2));
        // Boris the vexed « inspector » leans toward her; after her laugh he deflates and sweats again
        const bo = boris(t, Object.assign(bo19(t), { tagLater: true }));
        ekambi(t, ekaKeys19, { talk: t > r0 && t < r1 - .1 ? 1 : 0, hop: laugh + .05, rot: { head: t > laugh && t < r0 ? -.1 : (t >= r0 ? -.06 : 0) } });
        deskFront(c);
        borisTag(t, bo.x, bo.y, bo.h, bo);
        papersAndFan(t);
        const tp = templeOf(bo3, bo.x, BOR.y, BOR.h, bo);
        vexMark(t, { x: tp.x + 8, y: tp.y - 34 }, 30, env(t, q0 - .1, laugh + .35, .2, .25));
        borisSweat(t, tp, 1.05, clamp((t - laugh - .3) / .3));
        christelle(t, chrKeys19, { hop: laugh + .2 });
        const ek = keyAt(ekaKeys19, t), ef = faceOf(K('ekambi', 3), ekX(K('ekambi', 3)), eY(EKA.h), EKA.h, { t, phase: PHE, hop: laugh + .05, rot: { head: -.1 } });
        const C3 = K('christelle', 3), h3 = CHR.h * RIGS[C3].h / 1824, cf = faceOf(C3, xFor(C3, CHR.x, h3), CHR.y, h3, { t, phase: PHC, hop: laugh + .2 });
        if (ek === K('ekambi', 3)) laughMarks(t, ef, EKA.h * .085, laugh, r0 + .1, 1);
        laughMarks(t, cf, CHR.h * .085, laugh + .1, laugh + 1.6, 7);
      },
      screen(t) {
        if (!c19) return;
        const bo = Object.assign(bo19(t), { talk: 1 }), bm = scr(c19, mouthOf(bo3, bo.x, BOR.y, BOR.h, bo)), btop = stageToScreen(c19, bo.x, BOR.y - BOR.h).y;
        balloon(t, { t0: q0, t1: q1, text: 'Et vous, votre agrément ? Votre code ?', x: clamp(bm.x - 150, 420, 760), y: clamp(btop - 175, 330, 460), w: 500, size: 52, tail: tailAbove(bm, btop, -6), seed: 19 });
        const E2 = K('ekambi', 2), eo = { t, phase: PHE, talk: 1, rot: { head: -.06 } }, em = scr(c19, mouthOf(E2, ekX(E2), eY(EKA.h), EKA.h, eo)), etop = stageToScreen(c19, EKA.x, EKA.top).y;
        balloon(t, { t0: r0, t1: r1, text: 'Au nom exact de ma société.', x: clamp(em.x + 170, 560, 790), y: clamp(etop - 200, 380, 560), w: 440, size: 52, tail: tailAbove(em, etop, 14), seed: 20 });
      } });

    // =============================================== P20 · the quote, column by column ===================================
    const bq0 = T20 + .2, bq1 = bq0 + 1.95;                                        // « Un prix caché est un prix contesté. »
    const QT = { sep: tw('S22', 'sépare', -.05), h1: tw('S22', 'va', -.1), h2: tw('S22', 'honoraires', .05),
      c1: [['droits et taxes,'], ['refacturés'], ['sur quittance :'], ['droit · accises ·'], ['redevance · TVA ·'], ['petites taxes']],
      c2: [['honoraires officiels', te('S22', 'officiels', -.45), .45], ['(payés dans le système', tw('S22', 'payés'), .5], ['de la douane)', tw('S22', 'payés', .55), .35],
        ['autres prestations :', tw('S22', 'aussi'), .4], ['à part, par écrit', tw('S22', 'dans', .05), .4]],
      foot: tw('S22', 'système', -.1) };
    { let s0 = QT.h1 + .3; for (const l of QT.c1) { l[1] = s0; l[2] = .24; s0 += .17; } }
    const qView = t => { const r = eOutCubic(clamp((t - T20) / .6)), d = eInOutCubic(prog(t, T20 + .6, T21));
      return { k: 1 + .03 * d, ax: 540, ay: 905, px: 540, py: 905 + (1 - r) * 900 - 26 * d }; };
    let c20 = null;
    defineShot({ id: 'P20', t0: T20, img: BG, seed: 20,
      cam: [{ t: T20, x: 420, y: 896, z: 1.68 }, { t: T21, x: 428, y: 904, z: 1.72, e: 'lin' }],
      stage(t, n, c) {
        c20 = c;
        windowFix();
        agrementFrame(t);
        ekambi(t, [[T20, E1]], { talk: t > bq0 && t < bq1 - .1 ? 1 : 0, rot: { head: -.04 } });
        deskFront(c);
        papersAndFan(t, 1, false);
      },
      screen(t) {
        if (!c20) return;
        quoteSheet(t, QT, qView(t));
        const eo = { t, phase: PHE, talk: 1, rot: { head: -.04 } }, em = scr(c20, mouthOf(E1, ekX(E1), eY(EKA.h), EKA.h, eo)), etop = stageToScreen(c20, EKA.x, EKA.top).y;
        balloon(t, { t0: bq0, t1: bq1, text: 'Un prix caché est un prix contesté.', x: 250, y: clamp(etop + 90, 360, 400), w: 400, size: 52,
          tail: [em.x - 96, em.y - 10], seed: 21 });
      } });

    // =============================================== P21 · the official channel, never a person ========================
    const chainT = { bank: tw('S23', 'paie', -.05), card: tw('S23', "l'État", -.05), phone: tw('S23', 'par', .05), counter: tw('S23', 'canal'),
      arrow1: te('S23', 'officiel', -.3), never: tw('S23', 'jamais', -.05), strike: tw('S23', 'personne', -.05),
      receipt: tw('S23', 'contre', -.05), qr: tw('S23', 'quittance', -.05), keep: tw('S23', 'électronique', .1), arrow2: te('S23', 'électronique', -.45), exit: te('S23', 'électronique', -.2) };
    const BAND = { y: 590, h: 650 }, ROWA = 735, ROWB = 1075;
    defineShot({ id: 'P21', t0: T21, img: BG, seed: 21,
      cam: [{ t: T21, x: 392, y: 880, z: 1.75 }, { t: T22, x: 452, y: 884, z: 1.78, e: 'lin' }],
      stage(t, n, c) {
        windowFix();
        agrementFrame(t);
        ekambi(t, [[T21, K('ekambi', 2)]], { energy: 1.6, rot: { head: .03 } });
        deskFront(c);
        papersAndFan(t, 1, false);
      },
      screen(t) {
        // a kraft band unrolls (left → right), the view glides along it
        const un = eOutCubic(clamp((t - T21) / .55)), glide = (1 - eInOutCubic(prog(t, T21, T22))) * 30 - 15;
        if (un > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 40 + 1040 * un, H); ctx.clip();
          kraftSheet(540 + glide, BAND.y + BAND.h / 2, 1010, BAND.h, { rot: -.006, seed: 31, lift: 12 }); ctx.restore();
          if (un < 1) { const rx = 40 + 1040 * un; ctx.save(); ctx.fillStyle = PR.kraftD; ctx.fillRect(rx - 16, BAND.y - 6, 32, BAND.h + 12); inkRect(rx - 16, BAND.y - 6, 32, BAND.h + 12, { w: 3, seed: 32 }); ctx.restore(); } }
        ctx.save(); ctx.translate(glide, 0);
        const cells = [['bank', 'BANQUE', iconBank], ['card', 'CARTE', iconCard], ['phone', 'TÉLÉPHONE', iconPhone], ['counter', 'GUICHET\nOFFICIEL', iconCounter]];
        cells.forEach(([k, lab, fn], i) => iconCell(t, chainT[k], 172 + i * 238, ROWA, lab, () => fn(.95)));
        arrowInk(860, ROWA + 118, 300, ROWB - 152, clamp((t - chainT.arrow1) / .45), BD.orange, -.07);
        if (t >= chainT.receipt) {
          const k = popK(t, chainT.receipt), a = clamp((t - chainT.receipt) / .1);
          ctx.save(); ctx.globalAlpha *= a; ctx.translate(318, ROWB); ctx.scale(k, k);
          paperSheet(0, 0, 520, 300, { rot: .012, lift: 14, seed: 33 }, (w, h) => {
            if (t >= chainT.qr) { const kq = popK(t, chainT.qr); ctx.save(); ctx.translate(112, 150); ctx.scale(kq, kq); abstractQR(0, 0, 176, 4); ctx.restore(); }
            writeOn('QUITTANCE', 222, 104, t, chainT.qr + .05, .35, { size: 50, fam: FF.bd, color: BD.ink });
            writeOn('ÉLECTRONIQUE', 222, 160, t, chainT.qr + .3, .4, { size: fitSize('ÉLECTRONIQUE', FF.bd, 50, 280), fam: FF.bd, color: BD.ink });
            writeOn('gardez-la', 228, 240, t, chainT.keep, .45, { size: 58, fam: FF.brush, color: BD.green, underline: true, ucolor: BD.green });
          });
          ctx.restore();
        }
        arrowInk(600, ROWB, 690, ROWB, clamp((t - chainT.arrow2) / .3), BD.orange, 0);
        if (t >= chainT.exit) {
          const k = popK(t, chainT.exit), a = clamp((t - chainT.exit) / .1);
          ctx.save(); ctx.globalAlpha *= a; ctx.translate(850, ROWB); ctx.scale(k, k); ctx.rotate(-.03);
          withShadow(10, () => { ctx.fillStyle = '#DFF0E2'; rrect(-150, -130, 300, 260, 16); ctx.fill(); });
          inkPath([[-150, -112], [-150, 112], [-132, 130], [132, 130], [150, 112], [150, -112], [132, -130], [-132, -130], [-150, -112]], { w: 4, seed: 671 });
          ctx.strokeStyle = BD.green; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-46, -52); ctx.lineTo(-12, -18); ctx.lineTo(52, -86); ctx.stroke();
          text('BON DE', 0, 46, { font: font(FF.bd, 54, 400), align: 'center', color: BD.ink, ls: 2 });
          text('SORTIE', 0, 102, { font: font(FF.bd, 54, 400), align: 'center', color: BD.ink, ls: 2 });
          ctx.restore();
        }
        ctx.restore();
        // in the margin (under the narration): the Roi du forfait, struck in red — JAMAIS À UNE PERSONNE
        if (t >= chainT.never - .05) {
          const k = popK(t, chainT.never - .05), a = clamp((t - chainT.never + .05) / .1);
          ctx.save(); ctx.globalAlpha *= a; ctx.translate(540, 1665); ctx.scale(k, k); ctx.rotate(.012);
          withShadow(10, () => { ctx.fillStyle = '#FFF6E2'; ctx.fillRect(-470, -150, 940, 300); });
          inkRect(-470, -150, 940, 300, { w: 4, seed: 681 });
          ctx.restore();
          roiStruck(t, 540 - 310 * k, 1665, 1.08 * k, chainT.never, chainT.strike);
          if (t >= chainT.strike + .15) {
            const k2 = popK(t, chainT.strike + .15);
            ctx.save(); ctx.translate(705, 1665); ctx.scale(k2, k2); ctx.rotate(-.03);
            text('JAMAIS', 0, -16, { font: font(FF.bd, 96, 400), align: 'center', color: BD.red, ls: 4 });
            text('À UNE PERSONNE', 0, 68, { font: font(FF.bd, fitSize('À UNE PERSONNE', FF.bd, 70, 560, 2), 400), align: 'center', color: BD.red, ls: 2 });
            ctx.restore();
          }
        }
      } });
    addShake(chainT.strike, 12, .16);
    addShake(chainT.exit + .05, 7, .12);

    // =============================================== P22 · « c'est la vôtre » ===========================================
    const ins1 = te('S24', 'signe', -.1);                                          // insert: the hand signs (≈ 1.5 s from the cut)
    const sig0 = tw('S24', 'transitaire', .1), sig1 = tw('S24', 'signe', .25);
    const catch0 = te('S24', 'signe', .3), catchT = catch0 + 1.0;                  // the fan steals a sheet; it lands on Boris' box
    const nod22 = tw('S24', "c'est", -.05);                                         // « c'est la vôtre » : she nods
    const bv0 = te('S24', 'vôtre', -.4), bv1 = TEND + .3;                         // « Vos vrais papiers, et tôt ! »
    const B22 = { x: 718, y: 1290, h: 780 };                                       // Boris behind Ekambi's shoulder, his box just left of the mugs
    const E4 = K('ekambi', 4);
    const bo22 = t => ({ t, phase: PHB, x: B22.x, y: B22.y, h: B22.h, hop: catchT - .06,
      lean: -.035 * env(t, catchT - .1, catchT + .9, .1, .4) + .012 * Math.sin(t * 1.3), rot: { head: .07 * env(t, catchT, TEND, .3, .3) } });
    let c22 = null;
    defineShot({ id: 'P22', t0: T22, img: BG, seed: 22,
      cam: [{ t: T22, x: 596, y: 770, z: 1.56 }, { t: TEND, x: 592, y: 762, z: 1.64, e: 'lin' }],
      stage(t, n, c) {
        c22 = c;
        windowFix();
        agrementFrame(t);
        const bo = boris(t, bo22(t));
        ekambi(t, [[T22, E4]], { rot: { head: .02 * Math.sin(t * .8) + .07 * env(t, nod22, nod22 + .9, .25, .45) }, lean: .02 * env(t, nod22, TEND, .4, .2) });
        deskFront(c);
        papersAndFan(t, 1.2);
        // the sheet: off the desk, up past Ekambi's shoulder, over Boris' head, down onto his box
        const bt = boxTop(B22.x, B22.y, B22.h, bo);
        flySheet(t, catch0, catchT - catch0, [[600, 1010], [640, 840], [640, 620], [700, 440], [820, 470], [bt.x + 6, bt.y - 34], [bt.x, bt.y - 8]], 74, 7, { ease: x => 1 - (1 - x) * (1 - x) });
        if (t >= catchT) {                                                          // it settles flat on the box top and flutters a little
          const u = t - catchT, fl = Math.exp(-u * 3) * Math.sin(u * 16);
          ctx.save(); ctx.translate(bt.x, bt.y - 6); ctx.rotate(-.06 + fl * .05); ctx.scale(1, .42 + fl * .08);
          withShadow(6, () => { ctx.fillStyle = '#FFF9EC'; ctx.fillRect(-46, -36, 92, 72); }); inkRect(-46, -36, 92, 72, { w: 3, seed: 690 });
          ctx.globalAlpha *= .5; for (let k = 0; k < 3; k++) inkLine(-30, -16 + k * 16, 8 + hash(k + 7) * 20, -16 + k * 16, { w: 2, color: '#5A4A40', seed: 691 + k }); ctx.restore();
        }
        popLines(t, headPt(bo3, B22.x, B22.y, B22.h, bo, R => [(R.face.eyes[0][0] + R.face.eyes[1][0]) / 2, R.face.eyes[0][1] - 60]), 44, catchT - .02, .8);
      },
      screen(t) {
        if (c22) {
          const eo = { t, phase: PHE, talk: 1 }, em = scr(c22, mouthOf(E4, ekX(E4), eY(EKA.h), EKA.h, eo)), etop = stageToScreen(c22, EKA.x, EKA.top).y;
          balloon(t, { t0: bv0, t1: bv1, text: 'Vos vrais papiers, et tôt !', x: clamp(em.x - 20, 300, 520), y: clamp(etop - 150, 330, 470), w: 470, size: 54, tail: tailAbove(em, etop, 8), seed: 22 });
        }
        // the insert (full frame): the declaration is signed
        if (t < ins1 + .2) {
          const a = clamp((ins1 + .2 - t) / .2);
          ctx.save(); ctx.globalAlpha *= a;
          deskWood();
          paperSheet(540, 770, 760, 900, { rot: -.04, lift: 16, lines: 62, top: 250, seed: 703 }, (w, h) => {
            text('DÉCLARATION', w / 2, 150, { font: font(FF.bd, 92, 400), align: 'center', color: BD.ink, ls: 6 });
            inkLine(w * .2, 186, w * .8, 186, { w: 3, seed: 704 });
            ctx.save(); ctx.globalAlpha *= .5; for (let i = 0; i < 7; i++) inkLine(70, 290 + i * 62, 70 + (w - 140) * (.55 + hash(i * 3.3) * .4), 290 + i * 62, { w: 2.2, color: '#4A3A30', seed: 705 + i }); ctx.restore();
            inkLine(w * .45, 780, w * .9, 780, { w: 3, seed: 715 });
            handSigning(t, sig0, sig1 - sig0, [w * .45 + 12, 754, w * .88]);
          });
          ctx.restore();
        }
      } });
  });
})();

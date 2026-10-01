// ============================================================================================================
// 28_plus_tard — P26, P27, P28 (S28–S32) : l'épilogue, Bonzini, la question, la signature.
//   P26 (page « PLUS TARD ») l'étal des fêtes : Christelle (C1 → C2 → C1) fière ; au mur le cadre de Boris montre
//       « QUITTANCE · PAYÉ » ; épinglée à côté, l'enveloppe « DOUANE · MIS DE CÔTÉ », vide, flèche « → QUITTANCE » ;
//       bulle « Quittance reçue. Je la garde ! » ; bascule vers le comptoir : le ticket « NOTE PRÉVUE · estimation »
//       reçoit le tampon « CALCULÉE PAR LA DOUANE », deux barres proches « ESTIMÉ · CALCULÉ » (CALCULÉ un peu plus
//       haute, l'écart tient dans l'enveloppe) ; le margouillat dort sur le comptoir.
//   P27 (cut) un téléphone générique seul sur le comptoir (BG5) ; poussée dans l'écran (z 1 → 3,4). S29 : accueil de
//       l'app Bonzini (logo, aucun bouton, aucun montant) + cartouche « VOS FOURNISSEURS, RÉGLÉS EN FRANCS CFA ».
//       S30 : « Estimer mes droits · en quelques questions » (produit, valeur, transport…) + mention permanente
//       « Estimation · à faire confirmer par un commissionnaire agréé en douane ».
//   P28 (cut) l'étal au crépuscule, le margouillat tourne la tête vers nous ; grande bulle de commentaire vide ;
//       S32 : le rideau métallique peint (logo Bonzini, « BONZINI TRADING CARGO », « PAYEZ LE JUSTE DROIT. NI PLUS,
//       NI MOINS. ») descend ; le margouillat se glisse dessous au dernier moment ; tenue finale.
// Everything lives inside this IIFE (all scene files share one global scope).
// ============================================================================================================
(() => {
  'use strict';
  const SHADE = GRADE.shade;
  const K = (who, n) => `cast/${who}_${n}`;
  const PHC = 0;                                                           // Christelle's breathing phase (same as the other days)
  const INK = '#24160E';

  // ---------- puppet helpers (same formulas as drawPuppet, so balloons follow mouths) ----------------------------------
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
  /** stage point of a puppet: spec { mouth: true } | { bone, end } ; fb = fallback [dx, dy] in units of h (rig missing) */
  function pupAt(key, x, y, h, o, spec, fb) {
    const R = RIGS[key], dir = o.flip ? -1 : 1;
    if (!R) { const L = pupLift(o); return { x: x + dir * fb[0] * h, y: y - L.hopY * h - h + fb[1] * h }; }
    const M = boneMats(R, pupRot(R, o), o.off || {}), end = (bn, e) => { const b = R.bones.find(q => q.n === bn); return b ? aff.ap(M[bn], b[e]) : [R.w / 2, R.h / 2]; };
    const q = spec.mouth ? (R.face ? aff.ap(M.head, R.face.mouth) : end('head', 'a')) : end(spec.bone, spec.end || 'b');
    const s = h / R.h, L = pupLift(o);
    return { x: x + dir * (q[0] - R.w / 2) * s, y: y - L.hopY * h + (-h + q[1] * s) * (1 + L.bounce) };
  }
  /** pose track: keys [{ t, pose: { k, …opts } }] → the new pose, the old one fading out on top (.16 s), small pop at the feet */
  function drawTrack(keys, x, y, h, o) {
    const S = poseAt(keys, o.t, .16), P = S.pose;
    const pop = S.prev ? Math.sin(clamp(S.since / .16) * Math.PI) : 0;
    ctx.save(); if (pop) { ctx.translate(x, y); ctx.scale(1 + .02 * pop, 1 - .03 * pop); ctx.translate(-x, -y); }
    drawPuppet(P.k, x, y, h, Object.assign({}, o, P));
    if (S.prev) drawPuppet(S.prev.k, x, y, h, Object.assign({}, o, S.prev, { a: (o.a ?? 1) * (1 - S.k), shadow: false }));
    ctx.restore();
    return P;
  }
  const keyAt = (keys, t) => poseAt(keys, t, .16).pose;
  const on = (t, a, b) => (t >= a && t <= b ? 1 : 0);
  /** balloon tail: aims at the mouth but stops above the head top (never on the face) */
  const tailTo = (c, mouth, top, dx = 0) => { const m = stageToScreen(c, mouth.x, mouth.y), tp = stageToScreen(c, top.x, top.y); return [m.x + dx, Math.min(m.y - 16, tp.y - 14)]; };

  // ---------- the stall (same drawing as the Monday shots, 22_lundi : wax-print counter, braids over the edge) ----------
  function mecheBundle(x, y, len, col, seed, sway = 0) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const ox = (i - 4) * 4.4, end = x + ox * 1.5 + (hash(seed + i) - .5) * 14 + sway;
      ctx.strokeStyle = BD.ink; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(x + ox, y); ctx.bezierCurveTo(x + ox + 8, y + len * .35, x + ox - 8 + sway * .5, y + len * .7, end, y + len); ctx.stroke();
      ctx.strokeStyle = i % 3 === 1 ? 'rgba(255,255,255,.25)' : col; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.stroke(); }
    ctx.fillStyle = BD.amber; ctx.fillRect(x - 22, y - 8, 44, 12); inkRect(x - 22, y - 8, 44, 12, { w: 2.2, seed });
    ctx.restore();
  }
  /** trestle counter seen from the front: wooden top at y0, the wax-print valance (same motif as Monday) down to yv,
   *  then the shade under the table (legs, a basket, a box) down to the floor yf; braids hang over the edge */
  function stallCounter(x0, x1, y0, yv, yf, t) {
    const w = x1 - x0; ctx.save();
    // under the table: shade, legs, a basket and a closed box (no text)
    ctx.fillStyle = 'rgba(40,22,10,.55)'; ctx.fillRect(x0 + 6, yv - 10, w - 12, yf - yv + 10);
    for (const lx of [x0 + 26, x1 - 34]) { ctx.fillStyle = '#6E4424'; ctx.fillRect(lx, yv - 10, 20, yf - yv + 6); inkRect(lx, yv - 10, 20, yf - yv + 6, { w: 2.5, seed: 70 + lx % 7 }); }
    ctx.save(); ctx.translate(x0 + w * .3, yf - 4);                       // basket of braids
    ctx.fillStyle = '#C58B3E'; ctx.beginPath(); ctx.moveTo(-70, -96); ctx.lineTo(70, -96); ctx.lineTo(56, 0); ctx.lineTo(-56, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,20,.6)'; ctx.lineWidth = 2; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-70 + k * 3, -96 + k * 19); ctx.lineTo(70 - k * 3, -96 + k * 19); ctx.stroke(); }
    inkPath([[-70, -96], [70, -96], [56, 0], [-56, 0]], { w: 3, seed: 81, close: true });
    for (let k = 0; k < 5; k++) { ctx.strokeStyle = ['#2A1A12', '#8E2A3A', '#D9A441', '#3B2418', '#7A3B1F'][k]; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(-44 + k * 22, -96, 16, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
    ctx.save(); ctx.translate(x0 + w * .68, yf - 2); ctx.fillStyle = '#C8904F'; ctx.fillRect(-80, -110, 160, 110); ctx.fillStyle = '#A9743C'; ctx.fillRect(-80, -110, 160, 14);
    inkRect(-80, -110, 160, 110, { w: 3, seed: 82 }); ctx.fillStyle = 'rgba(235,225,190,.7)'; ctx.fillRect(-12, -110, 24, 50); ctx.restore();
    ctx.fillStyle = 'rgba(20,10,4,.25)'; ctx.fillRect(x0 + 6, yv - 10, w - 12, 30);
    // valance (wax print)
    const cloth = () => { ctx.beginPath(); ctx.moveTo(x0, y0 + 22); ctx.lineTo(x1, y0 + 22); const n = Math.round(w / 27); for (let i = 0; i <= n; i++) ctx.lineTo(x1 - w * i / n, yv - (i % 2 ? 12 : 0)); ctx.closePath(); };
    withShadow(10, () => { ctx.fillStyle = '#1D5FA8'; cloth(); ctx.fill(); });
    ctx.save(); cloth(); ctx.clip();
    for (let r = 0; r * 58 < yv - y0; r++) for (let cx = x0 + 18 + (r % 2) * 27; cx < x1 + 30; cx += 54) { const cy = y0 + 64 + r * 58;
      ctx.fillStyle = '#F26A21'; ctx.beginPath(); ctx.arc(cx, cy, 19, 0, 7); ctx.fill(); ctx.fillStyle = '#F5C542'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#123E70'; ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(20,10,4,.2)'; ctx.fillRect(x0, y0 + 22, w, 34);
    ctx.restore();
    inkPath([[x0, y0 + 22], [x0, yv], [x1, yv], [x1, y0 + 22]], { w: 3.5, seed: 62 });
    withShadow(6, () => { ctx.fillStyle = '#9A6433'; ctx.fillRect(x0 - 14, y0, w + 28, 24); });
    ctx.fillStyle = 'rgba(255,230,190,.25)'; ctx.fillRect(x0 - 14, y0 + 2, w + 28, 5);
    inkRect(x0 - 14, y0, w + 28, 24, { w: 3.5, seed: 61 });
    const cols = ['#2A1A12', '#7A3B1F', '#D9A441', '#8E2A3A', '#3B2418'], nb = Math.max(2, Math.round(w / 150));
    for (let i = 0; i < nb; i++) mecheBundle(x0 + 34 + i * (w - 68) / (nb - 1), y0 + 14, 110 + hash(i * 3.3) * 50, cols[i % 5], 70 + i, Math.sin(t * 1.3 + i) * 3);
    ctx.restore();
  }
  /** beaten-earth floor in front of the stall, from y0 to the bottom of the stage */
  function floorStrip(y0, ih) {
    ctx.save();
    const g = ctx.createLinearGradient(0, y0, 0, ih); g.addColorStop(0, '#9C7A58'); g.addColorStop(1, '#B89270');
    ctx.fillStyle = g; ctx.fillRect(-40, y0, 1080, ih - y0 + 40);
    ctx.fillStyle = 'rgba(40,22,10,.35)'; ctx.fillRect(-40, y0, 1080, 16);
    for (let i = 0; i < 70; i++) { const x = hash(i * 2.7) * 1000, y = y0 + 20 + hash(i * 4.9) * (ih - y0), r = 2 + hash(i) * 5;
      ctx.fillStyle = hash(i * 1.3) > .5 ? 'rgba(70,45,25,.3)' : 'rgba(255,235,205,.25)'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * .7, 0, 0, 7); ctx.fill(); }
    inkLine(-40, y0, 1040, y0, { w: 4, seed: 91, step: 40 });
    ctx.restore();
  }
  /** a string of festive bulbs across the stall (lit 0..1 : off by day, glowing at dusk) */
  function lightString(t, x0, y0, x1, y1, sag, lit, seed = 5) {
    const N = Math.max(4, Math.round((x1 - x0) / 62)), P = [];
    for (let i = 0; i <= N; i++) { const u = i / N; P.push([lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.2 + u * 5) * 2]); }
    inkPath(P, { w: 2.6, color: 'rgba(18,12,10,.9)', seed, wob: .6 });
    const cols = ['#FFC15A', '#F26A21', '#A66BFF', '#FFE27A', '#FF6B5A'];
    for (let i = 1; i < N; i++) { const [bx, by0] = P[i], by = by0 + 13, col = cols[(i + seed) % 5], tw = (.65 + .35 * Math.sin(t * (1.5 + hash(i + seed) * 2.2) + i * 1.9)) * lit;
      if (tw > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(bx, by, 0, bx, by, 46);
        const v = parseInt(col.slice(1), 16); g.addColorStop(0, `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${.6 * tw})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(bx - 46, by - 46, 92, 92); ctx.restore(); }
      inkLine(bx, by0, bx, by - 6, { w: 2, color: 'rgba(18,12,10,.9)', seed: i });
      ctx.beginPath(); ctx.ellipse(bx, by, 7, 10, 0, 0, 7); ctx.fillStyle = lit > .05 ? col : 'rgba(235,225,205,.9)'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(18,12,10,.85)'; ctx.stroke(); }
  }
  /** the stall's plank wall (where Christelle pins her papers) */
  function plankWall(x0, y0, x1, y1, seed = 3) {
    ctx.save(); const cols = ['#B98450', '#A9743F', '#C28F59', '#B07A44'], pw = 74;
    withShadow(8, () => { ctx.fillStyle = '#A9743F'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); });
    for (let x = x0, i = 0; x < x1; x += pw, i++) {
      const ww = Math.min(pw, x1 - x), top = y0 + (hash(i * 3.1 + seed) - .5) * 10;
      ctx.fillStyle = cols[i % 4]; ctx.fillRect(x, top, ww, y1 - top);
      ctx.globalAlpha = .32; for (let k = 0; k < 4; k++) { const gx = x + ww * (.18 + k * .22) + (hash(i * 7 + k) - .5) * 8;
        inkLine(gx, top + 6, gx + (hash(i + k * 3) - .5) * 10, y1, { w: 1.3, color: '#5A3418', seed: 300 + i * 4 + k, step: 60, wob: 4 }); }
      ctx.globalAlpha = 1;
      inkLine(x, top, x, y1, { w: 3, seed: 320 + i, step: 60 });
      inkLine(x, top, x + ww, top, { w: 3, seed: 340 + i });
      for (const ny of [top + 26, y1 - 40]) { ctx.fillStyle = '#4A4A50'; ctx.beginPath(); ctx.arc(x + ww / 2, ny, 4.5, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  /** festive paper bunting between two points (sways) */
  function bunting(t, x0, y0, x1, y1, sag, n, seed = 1) {
    const cols = [BD.violet, BD.amber, BD.orange, BD.green, '#E84A6F'], P = [];
    for (let i = 0; i <= n; i++) { const u = i / n; P.push([lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.4 + u * 6 + seed) * 2.5]); }
    inkPath(P, { w: 2.4, color: 'rgba(30,21,18,.9)', seed: 400 + seed, wob: .5 });
    for (let i = 0; i < n; i++) { const a = P[i], b = P[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, sw = Math.sin(t * 2.1 + i * 1.7 + seed) * 5;
      ctx.beginPath(); ctx.moveTo(a[0] + 3, a[1] + 1); ctx.lineTo(b[0] - 3, b[1] + 1); ctx.lineTo(mx + sw, my + 46); ctx.closePath();
      ctx.fillStyle = cols[(i + seed) % 5]; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = BD.ink; ctx.stroke(); }
  }

  /** tinsel garland (festive « guirlande ») along a sagging curve: fuzzy metallic strands + twinkling glints */
  function tinsel(t, x0, y0, x1, y1, sag, o = {}) {
    const cols = o.cols || ['#F3C93E', '#E5A21C', '#FFE58A', '#B8761A'], r = o.r || 11, sd = o.seed || 0;
    const N = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / 3.4)), P = [];
    for (let i = 0; i <= N; i++) { const u = i / N; P.push([lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u) + Math.sin(t * 1.3 + u * 7 + sd) * 1.6]); }
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = o.core || 'rgba(95,52,10,.6)'; ctx.lineWidth = r * 1.15; ctx.beginPath(); P.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    cols.forEach((c, ci) => { ctx.strokeStyle = c; ctx.lineWidth = 2.3; ctx.beginPath();
      P.forEach(([x, y], i) => { for (let k = 0; k < 2; k++) { const s = sd * 31 + i * 7.3 + k * 3.1 + ci * 1.7, a = hash(s) * Math.PI * 2, L = r * (.5 + hash(s + .5) * .65);
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); } });
      ctx.stroke(); });
    for (let i = 3; i < N; i += 11) { const [x, y] = P[i], tw = Math.sin(t * (2 + hash(i + 3 + sd) * 3) + i * 1.3); if (tw < .5) continue; const L = r * 2.5 * (tw - .5);
      ctx.strokeStyle = 'rgba(255,255,236,.95)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke(); }
    ctx.restore();
  }
  /** a hank of braids standing on a shelf: plaited strands (chevrons), a paper band (blank — no text, no brand),
   *  a cellophane sheen; loose ends are drawn separately (packEnds) so they hang over the shelf edge */
  function braidPack(x, yb, w, h, col, seed) {
    ctx.save();
    const path = () => { ctx.beginPath(); ctx.moveTo(x - w / 2, yb); ctx.lineTo(x - w / 2 + 2, yb - h + w * .42); ctx.quadraticCurveTo(x - w / 2 + 3, yb - h, x, yb - h); ctx.quadraticCurveTo(x + w / 2 - 3, yb - h, x + w / 2 - 2, yb - h + w * .42); ctx.lineTo(x + w / 2, yb); ctx.closePath(); };
    ctx.fillStyle = col; path(); ctx.fill();
    ctx.save(); path(); ctx.clip();
    const n = 5, sw = w / n, ch = 7;
    ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.38)'; ctx.beginPath();                      // the plaits: chevrons down each strand
    for (let k = 0; k < n; k++) { const sx = x - w / 2 + sw * (k + .5); for (let yy = yb - h + 6 + (k % 2) * 3; yy < yb; yy += ch) { ctx.moveTo(sx - sw * .42, yy); ctx.lineTo(sx, yy + 3.2); ctx.lineTo(sx + sw * .42, yy); } }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.beginPath();
    for (let k = 0; k < n; k++) { const sx = x - w / 2 + sw * (k + .5); for (let yy = yb - h + 9 + (k % 2) * 3; yy < yb; yy += ch) { ctx.moveTo(sx - sw * .3, yy); ctx.lineTo(sx - sw * .05, yy + 2); } }
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - w / 2, yb - h + w * .3, w, 6);                     // the tie at the fold
    ctx.fillStyle = '#F4EBD6'; ctx.fillRect(x - w / 2, yb - h * .5, w, h * .15);                         // paper band, blank
    ctx.fillStyle = [BD.violet, BD.orange, BD.amber, '#2E9A60'][Math.floor(hash(seed * 1.7) * 4)]; ctx.fillRect(x - w / 2, yb - h * .5 + h * .105, w, h * .045);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(x - w * .3, yb - h); ctx.lineTo(x - w * .12, yb - h); ctx.lineTo(x - w * .28, yb); ctx.lineTo(x - w * .46, yb); ctx.closePath(); ctx.fill();   // cellophane sheen
    ctx.restore();
    path(); ctx.lineWidth = 2.4; ctx.strokeStyle = BD.ink; ctx.stroke();
    ctx.restore();
  }
  /** loose braid ends falling over the front of the shelf board (x centre, y = board top) */
  function packEnds(x, y, w, col, seed, t) {
    ctx.save(); ctx.lineCap = 'round';
    const n = 4 + Math.floor(hash(seed * 2.9) * 3), sway = Math.sin(t * 1.1 + seed) * 2;
    for (let i = 0; i < n; i++) { const sx = x - w * .35 + w * .7 * i / (n - 1), L = 30 + hash(seed + i * 1.3) * 34, ex = sx + (hash(seed * 3 + i) - .5) * 10 + sway;
      ctx.beginPath(); ctx.moveTo(sx, y - 4); ctx.quadraticCurveTo(sx + 3, y + L * .5, ex, y + L);
      ctx.strokeStyle = BD.ink; ctx.lineWidth = 5.6; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3.4; ctx.stroke(); }
    ctx.restore();
  }
  /** the full shelves behind Christelle (« ses étagères pleines »): wooden uprights, boards, rows of braid packs */
  function shelfUnit(t, x0, x1, y0, yf) {
    const W = x1 - x0, rows = Array.from({ length: 6 }, (_, i) => y0 + (yf - 22 - y0) * (i + 1) / 6), cols = ['#2A1A12', '#7A3B1F', '#D9A441', '#8E2A3A', '#3B2418', '#E0A23A', '#5B2C83', '#1F5FA0', '#C2512A', '#141010'];
    ctx.save();
    withShadow(10, () => { ctx.fillStyle = '#5E3B20'; ctx.fillRect(x0, y0, W, yf - y0); });               // the dark inside of the unit
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x0, y0, W, 30);
    rows.forEach((ry, r) => {
      let px = x0 + 34 + hash(r * 5.1) * 10, k = 0; const ends = [];
      while (px < x1 - 30) { const s = r * 40 + k, w = 44 + hash(s * 1.9) * 16, h = 112 + hash(s * 2.3) * 40, col = cols[Math.floor(hash(s * 3.7) * cols.length)];
        braidPack(px + w / 2, ry, w, h, col, s); if (hash(s * 5.3) > .45) ends.push([px + w / 2, w, col, s]); px += w + 3 + hash(s * 4.1) * 7; k++; }
      ctx.fillStyle = 'rgba(30,16,6,.35)'; ctx.fillRect(x0, ry, W, 8);
      withShadow(5, () => { ctx.fillStyle = '#A8703A'; ctx.fillRect(x0, ry, W, 20); });
      ctx.fillStyle = 'rgba(255,230,190,.28)'; ctx.fillRect(x0, ry + 1, W, 4);
      inkRect(x0, ry, W, 20, { w: 3, seed: 700 + r });
      for (const [ex, ew, ec, es] of ends) packEnds(ex, ry + 2, ew, ec, es, t);
    });
    for (const ux of [x0, x1 - 26]) { withShadow(6, () => { ctx.fillStyle = '#9A6433'; ctx.fillRect(ux, y0, 26, yf - y0); }); inkRect(ux, y0, 26, yf - y0, { w: 3, seed: 720 + ux % 9 }); }
    ctx.fillStyle = 'rgba(28,16,8,.16)'; ctx.fillRect(x0, y0, W, yf - y0);                               // a step back in depth: Christelle reads in front
    ctx.restore();
  }

  // ---------- the wall documents ---------------------------------------------------------------------------------------
  /** Boris' frame, now filled: a generic « QUITTANCE » with a « PAYÉ » stamp (no figure) */
  function quittanceFrame(x, y, w, h, rot, t) {
    propFrame(x, y, w, h, { rot, lift: 10, mat: '#F4EBD6' }, (iw, ih) => {
      ctx.fillStyle = '#FFFDF5'; ctx.fillRect(iw * .1, ih * .07, iw * .8, ih * .86);
      inkRect(iw * .1, ih * .07, iw * .8, ih * .86, { w: 2, seed: 501 });
      text('QUITTANCE', iw / 2, ih * .25, { font: font(FF.bd, iw * .17, 400), align: 'center', color: BD.ink, ls: 1 });
      inkLine(iw * .2, ih * .29, iw * .8, ih * .29, { w: 2.4, color: BD.orange, seed: 502 });
      for (let i = 0; i < 5; i++) { const yy = ih * (.4 + i * .085), L = iw * (.28 + hash(i * 4.1 + 2) * .22);
        inkLine(iw * .2, yy, iw * .2 + L, yy, { w: 2, color: '#8C7E72', seed: 510 + i, wob: .4 });
        inkLine(iw * .64, yy, iw * .8, yy, { w: 2, color: '#8C7E72', seed: 520 + i, wob: .4 }); }
      bdStamp(iw * .56, ih * .74, iw * .27, 'PAYÉ', { color: '#1F7A4A', rot: -.22, size: iw * .17, a: .9 });
    });
    // the nail and the string it hangs from
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    inkPath([[-w * .3, -h / 2 + 4], [0, -h / 2 - 34], [w * .3, -h / 2 + 4]], { w: 2.2, color: '#5B3A1E', seed: 530 });
    ctx.fillStyle = '#4A4A50'; ctx.beginPath(); ctx.arc(0, -h / 2 - 36, 5, 0, 7); ctx.fill();
    ctx.restore();
  }
  /** the second envelope « DOUANE · MIS DE CÔTÉ » — now empty: its flap is open, nothing inside; pinned to the wall */
  function emptyEnvelope(x, y, w, rot) {
    const h = w * .6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    // open flap, folded up above the top edge
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2 - h * .5); ctx.lineTo(w / 2, -h / 2); ctx.closePath();
    withShadow(6, () => { ctx.fillStyle = '#D9AE7E'; ctx.fill(); });
    inkPath([[-w / 2, -h / 2], [0, -h / 2 - h * .5], [w / 2, -h / 2]], { w: 3, seed: 541 });
    inkCircle(0, -h / 2 - h * .43, w * .04, { w: 2, fill: BD.red, seed: 6 });                // the torn half of the red sticker
    // body
    withShadow(8, () => { ctx.fillStyle = PR.kraft; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.fillStyle = '#7A5230'; ctx.beginPath(); ctx.moveTo(-w / 2 + 4, -h / 2 + 3); ctx.lineTo(w / 2 - 4, -h / 2 + 3); ctx.lineTo(0, -h / 2 + h * .2); ctx.closePath(); ctx.fill();   // the empty inside
    ctx.fillStyle = 'rgba(120,70,30,.16)'; ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(-w * .06, -h * .08); ctx.lineTo(w * .06, -h * .08); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
    inkPath([[-w / 2, h / 2], [-w * .06, -h * .08], [w * .06, -h * .08], [w / 2, h / 2]], { w: 2, color: 'rgba(30,21,18,.55)', seed: 542 });
    inkRect(-w / 2, -h / 2, w, h, { w: 4, seed: 4 });
    text('DOUANE', 0, h * .2, { font: font(FF.brush, w * .155, 400), align: 'center', color: INK });
    text('MIS DE CÔTÉ', 0, h * .2 + w * .14, { font: font(FF.letN, w * .13, 400), align: 'center', color: INK });
    const mw = measure('MIS DE CÔTÉ', font(FF.letN, w * .13, 400));
    inkLine(-mw / 2, h * .2 + w * .168, mw / 2, h * .2 + w * .168, { w: 3.5, color: BD.orange, seed: 3 });
    inkCircle(-w * .36, -h * .3, w * .035, { w: 2.4, fill: BD.red, seed: 9 });                  // push-pin
    ctx.restore();
  }

  // ---------- the counter documents ------------------------------------------------------------------------------------
  function woodBlock(x, y, w) {                                           // small wooden stand with a slot (base at y)
    withShadow(4, () => { ctx.fillStyle = '#8C5A30'; ctx.fillRect(x - w / 2, y - 24, w, 24); });
    ctx.fillStyle = 'rgba(255,220,170,.3)'; ctx.fillRect(x - w / 2, y - 24, w, 5);
    inkRect(x - w / 2, y - 24, w, 24, { w: 2.6, seed: 551 });
  }
  /** kraft card with two hand-drawn bars « ESTIMÉ · CALCULÉ » (no figure); kE/kC grow 0..1; kEnv: the little envelope in the gap */
  function barsCard(x, yb, w, h, rot, kE, kC, kEnv) {
    kraftSheet(x, yb - h / 2 - 16, w, h, { rot, seed: 23, lift: 10 }, (ww, hh) => {
      const base = hh * .7, hE = hh * .4, hC = hh * .47, bw = ww * .24, xE = ww * .25, xC = ww * .62;
      ctx.save(); ctx.setLineDash([6, 7]); ctx.strokeStyle = 'rgba(30,21,18,.4)'; ctx.lineWidth = 2;          // the two empty bars, waiting
      ctx.strokeRect(xE - bw / 2, base - hE, bw, hE); ctx.strokeRect(xC - bw / 2, base - hC, bw, hC); ctx.restore();
      inkLine(ww * .06, base, ww * .94, base, { w: 3, seed: 561 });
      const bar = (cx, hb, k, col, seed) => { if (k <= 0) return; const hk = hb * eOutBack(clamp(k), 1.2);
        ctx.fillStyle = col; ctx.fillRect(cx - bw / 2, base - hk, bw, hk); hatch(cx - bw / 2, base - hk, bw, hk, { gap: 13, w: 1.6, color: 'rgba(30,21,18,.22)' });
        inkRect(cx - bw / 2, base - hk, bw, hk, { w: 3, seed }); };
      bar(xE, hE, kE, BD.amber, 562); bar(xC, hC, kC, '#2E9A60', 563);
      const lf = font(FF.bd, ww * .118, 400);
      text('ESTIMÉ', xE, base + ww * .15, { font: lf, align: 'center', color: BD.ink, ls: 1 });
      text('CALCULÉ', xC, base + ww * .15, { font: lf, align: 'center', color: BD.ink, ls: 1 });
      if (kEnv > 0) {                                                     // the gap : dashed level + a tiny envelope (no text)
        ctx.save(); ctx.globalAlpha *= clamp(kEnv * 2); ctx.setLineDash([7, 6]); ctx.strokeStyle = 'rgba(30,21,18,.7)'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(xE + bw / 2, base - hE); ctx.lineTo(xC + bw / 2 + 8, base - hE); ctx.stroke(); ctx.restore();
        const bx = xC + bw / 2 + 8, s = eOutBack(clamp(kEnv), 1.6), ew = ww * .17, eh = ew * .64, ex = bx + 6 + ew / 2, ey = base - (hE + hC) / 2;
        ctx.save(); ctx.globalAlpha *= clamp(kEnv * 2);                          // bracket on the gap
        inkPath([[bx - 2, base - hC], [bx + 4, base - hC + 3], [bx + 4, base - hE - 3], [bx - 2, base - hE]], { w: 2.6, seed: 564 }); ctx.restore();
        ctx.save(); ctx.translate(ex, ey); ctx.scale(s, s);                      // the little « mis de côté » envelope (no text)
        withShadow(3, () => { ctx.fillStyle = PR.kraftL; ctx.fillRect(-ew / 2, -eh / 2, ew, eh); }); inkRect(-ew / 2, -eh / 2, ew, eh, { w: 2.2, seed: 565 });
        inkPath([[-ew / 2, -eh / 2], [0, eh * .1], [ew / 2, -eh / 2]], { w: 1.8, seed: 566 });
        ctx.fillStyle = BD.red; ctx.beginPath(); ctx.arc(0, eh * .08, ew * .07, 0, 7); ctx.fill();
        ctx.restore();
      }
    });
  }
  /** the stamp falling on the ticket (scale 1.4 → 1, impact strokes) */
  function stampFall(x, y, r, label, t, ts) {
    if (t < ts - .12) return;
    const u = clamp((t - ts + .12) / .12), s = lerp(1.45, 1, eInCubic(u)), a = clamp(u * 1.6) * .92;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    bdStamp(0, 0, r, label, { color: '#1F7A4A', rot: -.2, size: r * .29, a });
    ctx.restore();
    const k = (t - ts) / .3; if (k > 0 && k < 1) {
      for (let i = 0; i < 8; i++) { const an = i / 8 * Math.PI * 2 + .3, r0 = r * (1.08 + k * .3), r1 = r0 + r * .22 * (1 - k);
        inkLine(x + Math.cos(an) * r0, y + Math.sin(an) * r0, x + Math.cos(an) * r1, y + Math.sin(an) * r1, { w: 4 * (1 - k) + 1, seed: 570 + i }); } }
  }

  // ---------- small BD caption (screen px) : « PLUS TARD », the yellow cartouche of the Bonzini shot -------------------
  function capBox(t, t0, lines, o = {}) {
    if (t < t0) return; const k = clamp(spring(t - t0, 15, .5), 0, 1.15), a = clamp((t - t0) / .12) * (o.a ?? 1); if (a <= 0) return;
    const f = font(FF.bd, o.size || 58, 400), lh = (o.size || 58) * 1.12, w = Math.max(...lines.map(l => measure(l, f, 3))) + 64, h = lines.length * lh + (o.size || 58) * .55;
    const x = o.x ?? 1030 - w / 2, y = o.y ?? 250 + h / 2;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(o.rot ?? -.015);
    withShadow(8, () => { ctx.fillStyle = o.fill || BD.recit; ctx.fillRect(-w / 2, -h / 2, w, h); });
    inkRect(-w / 2, -h / 2, w, h, { w: 4.5, seed: o.seed || 601 });
    lines.forEach((l, i) => text(l, 0, -h / 2 + (o.size || 58) * .28 + lh * (i + .82), { font: f, align: 'center', color: o.color || BD.ink, ls: 3 }));
    ctx.restore();
  }

  // ---------- P27 : the phone screens (local px of the screen, sw × sh) -----------------------------------------------
  function statusBar(sw, col = 'rgba(30,21,18,.55)') {
    ctx.fillStyle = col; ctx.fillRect(14, 8, 18, 4); for (let i = 0; i < 3; i++) ctx.fillRect(sw - 40 + i * 6, 12 - i * 2, 4, 2 + i * 2); ctx.fillRect(sw - 20, 7, 10, 6);
  }
  /** Bonzini home screen: the logo, soft blank cards (no button, no amount, no rate, no name) */
  function homeScreen(sw, sh, t, tw0) {
    const g = ctx.createLinearGradient(0, 0, 0, sh); g.addColorStop(0, '#F5ECFF'); g.addColorStop(.45, '#FFF8EE'); g.addColorStop(1, '#FFF3E2');
    ctx.fillStyle = g; ctx.fillRect(0, 0, sw, sh); statusBar(sw);
    // the logo assembles (wings, amber, orange fly in) then breathes
    const u = t - tw0, sp = r => clamp(spring(u - r, 11, .55), 0, 1.2), L = { wingTop: sp(.05), wingBot: sp(.15), amber: sp(.25), orange: sp(.35) };
    const off = {}; const from = { wingTop: [-90, -70, -.6], wingBot: [-90, 80, .6], amber: [100, -40, .5], orange: [80, 90, -.5] };
    for (const k in from) { const q = L[k]; off[k] = [from[k][0] * (1 - q), from[k][1] * (1 - q), from[k][2] * (1 - q), clamp(q * 2)]; }
    const ls = sw * .58 * (1 + Math.sin(t * 2.2) * .012);
    ctx.save(); ctx.globalAlpha *= .5; ctx.fillStyle = 'rgba(169,71,254,.12)'; ctx.beginPath(); ctx.arc(sw / 2, sh * .27, sw * .38 * clamp(u * 2), 0, 7); ctx.fill(); ctx.restore();
    drawLogo(sw / 2, sh * .27, ls, { offsets: off });
    // blank cards (rounded, tinted) — abstract content, no text
    const card = (y, hh, tint, k) => { if (k <= 0) return; ctx.save(); ctx.globalAlpha *= clamp(k); ctx.translate(0, (1 - eOutCubic(clamp(k))) * 24);
      ctx.fillStyle = '#FFFFFF'; rrect(sw * .08, y, sw * .84, hh, 12); ctx.fill(); ctx.strokeStyle = 'rgba(30,21,18,.35)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(sw * .19, y + hh / 2, hh * .26, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(30,21,18,.14)'; rrect(sw * .32, y + hh * .3, sw * .42, 7, 3.5); ctx.fill(); rrect(sw * .32, y + hh * .58, sw * .28, 6, 3); ctx.fill();
      ctx.restore(); };
    card(sh * .5, sh * .1, 'rgba(169,71,254,.55)', (u - .7) * 3); card(sh * .62, sh * .1, 'rgba(243,167,69,.75)', (u - .85) * 3); card(sh * .74, sh * .1, 'rgba(254,86,13,.6)', (u - 1) * 3);
    // bottom nav : four abstract icons
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(0, sh * .9, sw, sh * .1); ctx.fillStyle = 'rgba(30,21,18,.12)'; ctx.fillRect(0, sh * .9, sw, 1.5);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i === 0 ? 'rgba(169,71,254,.85)' : 'rgba(30,21,18,.25)'; ctx.beginPath(); ctx.arc(sw * (.17 + i * .22), sh * .95, 6.5, 0, 7); ctx.fill(); }
  }
  /** « Estimer mes droits » : question rows (no figure) + the permanent mention */
  function simScreen(sw, sh, t, A) {
    ctx.fillStyle = '#FFFBF3'; ctx.fillRect(0, 0, sw, sh); statusBar(sw);
    ctx.fillStyle = 'rgba(169,71,254,.10)'; ctx.fillRect(0, 0, sw, 128);
    drawLogo(sw - 30, 40, 34);
    writeOn('Estimer mes droits', 16, 96, t, A.title, .55, { size: 21, fam: FF.let, weight: 700, color: BD.ink });
    writeOn('en quelques questions', 17, 119, t, A.sub, .5, { size: 15, fam: FF.letN, color: '#5A4636' });
    const rows = ['produit', 'valeur', 'transport', '…'];
    rows.forEach((lab, i) => {
      const t0 = A.rows[i]; if (t < t0) return; const k = eOutCubic(clamp((t - t0) / .3)), y = 140 + i * 50;
      ctx.save(); ctx.globalAlpha *= k * (lab === '…' ? .55 : 1); ctx.translate((1 - k) * 40, 0);
      ctx.fillStyle = '#FFFFFF'; rrect(12, y, sw - 24, 40, 10); ctx.fill(); ctx.strokeStyle = 'rgba(30,21,18,.45)'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = i === 0 ? BD.violet : i === 1 ? BD.amber : i === 2 ? BD.orange : 'rgba(30,21,18,.3)'; ctx.beginPath(); ctx.arc(30, y + 20, 6, 0, 7); ctx.fill();
      text(lab, 44, y + 26, { font: font(FF.letN, 17, 400), color: BD.ink });
      if (lab !== '…') {                                                   // empty field, then a tick when answered
        ctx.fillStyle = 'rgba(30,21,18,.08)'; rrect(sw * .5, y + 11, sw * .3, 18, 6); ctx.fill();
        const kc = clamp((t - A.ticks[i]) / .25);
        ctx.beginPath(); ctx.arc(sw - 30, y + 20, 9, 0, 7); ctx.fillStyle = kc > 0 ? '#2E9A60' : '#FFFFFF'; ctx.fill(); ctx.strokeStyle = 'rgba(30,21,18,.5)'; ctx.lineWidth = 1.6; ctx.stroke();
        if (kc > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sw - 35, y + 20); ctx.lineTo(sw - 31, y + 24 * 1); ctx.lineTo(sw - 31 + 7 * kc, y + 24 - 9 * kc); ctx.stroke(); }
      }
      ctx.restore();
    });
    // permanent mention, bottom of the screen
    const by = sh - 100; ctx.fillStyle = '#FFE9B8'; rrect(8, by, sw - 16, 90, 10); ctx.fill(); ctx.strokeStyle = 'rgba(30,21,18,.4)'; ctx.lineWidth = 1.6; ctx.stroke();
    const mf = font(FF.letN, 15, 400);
    ['Estimation · à faire confirmer', 'par un commissionnaire', 'agréé en douane'].forEach((l, i) => text(l, sw / 2, by + 26 + i * 24, { font: mf, align: 'center', color: '#3A2A1E' }));
  }
  /** soft leaf shadows drifting over the planks (keeps the still phone shot alive) */
  function leafShadows(t, ih) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 9; i++) { const x = (hash(i * 3.7) * 1200 - 100) + Math.sin(t * .23 + i) * 40, y = hash(i * 5.1) * ih + Math.cos(t * .17 + i * 2) * 30, r = 120 + hash(i * 2.2) * 140;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(90,60,40,.32)'); g.addColorStop(1, 'rgba(90,60,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }
    ctx.restore();
  }

  // ---------- P28 : the comment balloon (screen px) and the painted shutter ---------------------------------------------
  function commentBalloon(t, B) {
    if (t < B.t0 || t > B.t1 + .3) return;
    const k = clamp(spring(t - B.t0, 13, .55), 0, 1.15), a = Math.min(clamp((t - B.t0) / .1), clamp((B.t1 + .3 - t) / .3));
    const cx = 540, cy = 690, bw = 880, bh = 660;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.scale(k, k);
    const pts = []; for (let i = 0; i < 48; i++) { const u = i / 48 * Math.PI * 2, r = 1 + (vnoise(i * .9, 7) - .5) * .03;
      const kx = Math.pow(Math.abs(Math.cos(u)), .55) * Math.sign(Math.cos(u)), ly = Math.pow(Math.abs(Math.sin(u)), .55) * Math.sign(Math.sin(u)); pts.push([kx * bw / 2 * r, ly * bh / 2 * r]); }
    const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
    const tail = [[90, bh / 2 - 26], [172, bh / 2 + 158], [196, bh / 2 - 34]];   // points down to the margouillat, stops above the caption
    withShadow(12, () => { ctx.fillStyle = '#FFFFFF'; path(); ctx.fill(); ctx.beginPath(); ctx.moveTo(...tail[0]); ctx.lineTo(...tail[1]); ctx.lineTo(...tail[2]); ctx.closePath(); ctx.fill(); });
    inkPath(tail, { w: 5, seed: 611 }); ctx.fillStyle = '#FFFFFF'; path(); ctx.fill(); inkPath(pts.concat([pts[0]]), { w: 5.5, seed: 612 });
    const L = (s, y, size, col, t0, o = {}) => { if (t < t0) return; const q = clamp(spring(t - t0, 16, .6), 0, 1.1);
      ctx.save(); ctx.translate(0, y); ctx.scale(q, q); ctx.globalAlpha *= clamp((t - t0) / .1); text(s, 0, 0, Object.assign({ font: font(o.fam || FF.bd, size, o.w || 400), align: 'center', color: col, ls: o.ls ?? 2 }, o)); ctx.restore(); };
    L('VOTRE NOTE :', -bh / 2 + 112, 66, BD.ink, B.l1);
    if (t >= B.l2) {                                                        // AVANT (violet) OU APRÈS (orange)
      const q = clamp(spring(t - B.l2, 16, .6), 0, 1.1), f = font(FF.bd, 92, 400), wA = measure('AVANT ', f, 2), wO = measure('OU ', f, 2), wP = measure('APRÈS', f, 2), x0 = -(wA + wO + wP) / 2;
      ctx.save(); ctx.translate(0, -bh / 2 + 222); ctx.scale(q, q); ctx.globalAlpha *= clamp((t - B.l2) / .1);
      text('AVANT', x0, 0, { font: f, color: BD.violet, ls: 2 }); text('OU', x0 + wA, 0, { font: f, color: BD.ink, ls: 2 }); text('APRÈS', x0 + wA + wO, 0, { font: f, color: BD.orange, ls: 2 });
      ctx.restore();
    }
    L('AVOIR PAYÉ', -bh / 2 + 308, 66, BD.ink, B.l3);
    L('VOTRE FOURNISSEUR ?', -bh / 2 + 384, 66, BD.ink, B.l3 + .25);
    {                                                                       // the empty answer field (caret blinking) — the balloon waits for YOUR note
      const q = clamp((t - B.l1 - .2) / .3);
      ctx.save(); ctx.globalAlpha *= q; ctx.setLineDash([3, 12]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(30,21,18,.45)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-300, -bh / 2 + 422); ctx.lineTo(300, -bh / 2 + 422); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha *= q; inkRect(-270, -bh / 2 + 528, 540, 64, { w: 3, seed: 613, fill: '#FBF7EF' });
      if (Math.floor((t - B.l1) * 2.2) % 2 === 0) { ctx.fillStyle = BD.ink; ctx.fillRect(-250, -bh / 2 + 540, 5, 40); }
      ctx.restore();
      L('EN COMMENTAIRE', -bh / 2 + 492, 58, BD.violet, B.l4, { fam: FF.let, w: 700, ls: 1 });
    }
    ctx.restore();
  }
  /** rolling metal shutter from the top of the stage down to yb (stage units), painted sign; S = slogan reveal 0..1 per line */
  function shutter(yb, t, S, ih) {
    const x0 = -40, x1 = 1040, top = Math.min(0, yb - ih);
    ctx.save();
    withShadow(16, () => { ctx.fillStyle = '#7F8C99'; ctx.fillRect(x0, top, x1 - x0, yb - top); });
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top, x1 - x0, yb - top); ctx.clip();
    for (let y = yb - 34, i = 0; y > top - 30; y -= 26, i++) {             // corrugated slats (they travel with the shutter)
      ctx.fillStyle = i % 2 ? '#8E9AA6' : '#76838F'; ctx.fillRect(x0, y, x1 - x0, 26);
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x0, y + 3, x1 - x0, 3); ctx.fillStyle = 'rgba(20,24,30,.28)'; ctx.fillRect(x0, y + 22, x1 - x0, 4);
    }
    // the painted sign (cream panel, letters and logo), placed relative to the bottom edge
    const P = { x: 70, w: 860, y: yb - 1250, h: 830 };
    ctx.save(); ctx.globalAlpha *= .96; ctx.fillStyle = '#F6EEDC'; rrect(P.x, P.y, P.w, P.h, 26); ctx.fill(); ctx.restore();
    ctx.save(); rrect(P.x, P.y, P.w, P.h, 26); ctx.clip(); ctx.globalAlpha = .16;            // the slats show through the paint
    for (let y = yb - 34; y > P.y - 30; y -= 26) { ctx.fillStyle = '#2B3540'; ctx.fillRect(P.x, y + 22, P.w, 4); } ctx.restore();
    inkPath([[P.x + 8, P.y + 4], [P.x + P.w - 6, P.y + 2], [P.x + P.w - 2, P.y + P.h - 6], [P.x + 4, P.y + P.h - 2]], { w: 5, color: BD.violet, seed: 621, close: true });
    drawLogo(500, P.y + 175, 260);
    const fb = font(FF.bd, 128, 400), ft = font(FF.bd, 70, 400), fs = font(FF.bd, 62, 400);
    text('BONZINI', 500, P.y + 425, { font: fb, align: 'center', color: '#5B1FB0', ls: 6 });
    text('TRADING CARGO', 500, P.y + 510, { font: ft, align: 'center', color: BD.orange, ls: 8 });
    inkLine(240, P.y + 545, 760, P.y + 541, { w: 5, color: BD.amber, seed: 622 });
    const brush = (s, y, k, col) => { if (k <= 0) return; const w = measure(s, fs, 3); ctx.save(); ctx.beginPath(); ctx.rect(500 - w / 2 - 10, y - 70, (w + 20) * k, 96); ctx.clip();
      text(s, 500, y, { font: fs, align: 'center', color: col, ls: 3 }); ctx.restore(); };
    brush('PAYEZ LE JUSTE DROIT.', P.y + 665, S[0], BD.ink);
    brush('NI PLUS, NI MOINS.', P.y + 760, S[1], '#5B1FB0');
    ctx.restore();
    // bottom bar with its handle, guide rails at the sides
    withShadow(6, () => { ctx.fillStyle = '#4F5862'; ctx.fillRect(x0, yb - 30, x1 - x0, 30); });
    inkLine(x0, yb - 30, x1, yb - 30, { w: 3, seed: 623 }); inkLine(x0, yb, x1, yb, { w: 4, seed: 624 });
    ctx.fillStyle = '#2E343B'; rrect(470, yb - 22, 60, 14, 6); ctx.fill();
    ctx.restore();
  }


  shots(() => {
    const T26 = shotStart('S28'), T27 = shotStart('S29'), T28 = shotStart('S31');
    // ---------- the stall layout (stage units on bg/etal_meches_fetes, 1000 × 1800), shared by P26 and P28 ----------
    const FLOOR = 1545;                                                    // where the stall meets the beaten-earth floor
    const CT = 1200, CV = 1330, CF = 1582, CX0 = -20, CX1 = 632;           // counter: top, valance hem, feet ; x range
    const CHR = { x: 790, y: 1590, h: 720 };                               // Christelle (.98 × Junior 735), feet on the floor
    const BOARD = { x0: 30, x1: 612, y0: 520, y1: CT };                    // plank back wall of the counter (left)
    const SHELF = { x0: 600, x1: 1040, y0: 520 };                          // « ses étagères pleines » (right, behind Christelle)
    const ENV = { x: 207, y: 676, w: 210, rot: -.05 };                     // high on the wall: out of the counter close-up
    const FRM = { x: 470, y: 850, w: 160, h: 198, rot: .03 };
    const ARW = { x: 326, y: 668, size: 36 };                              // « → QUITTANCE », right of the envelope
    const TIX = { x: 285, w: 150 }, BARS = { x: 475, w: 160, h: 205 }, LIZ = { x: 330, s: .62 };
    const arwEnd = () => ARW.x + 46 + measure('QUITTANCE', font(FF.brush, ARW.size, 400));
    const arrowPts = () => { const e = arwEnd(); return curve([[e + 8, ARW.y - 14], [e + 36, ARW.y + 22], [FRM.x + FRM.w * .28, FRM.y - FRM.h / 2 - 8]], 10); };
    /** « → QUITTANCE » : a brushed arrow, then the word, written on (k 0..1 of the word) */
    function arrowWord(t, t0, dur) {
      const ka = clamp((t - t0) / .2); if (ka <= 0) return 0;
      const ax = ARW.x, ay = ARW.y - ARW.size * .3, L = 34 * ka;
      inkPath([[ax, ay], [ax + L, ay]], { w: 4.5, color: BD.red, seed: 633 });
      if (ka >= 1) inkPath([[ax + 22, ay - 10], [ax + 35, ay], [ax + 22, ay + 10]], { w: 4.5, color: BD.red, seed: 634 });
      return writeOn('QUITTANCE', ARW.x + 46, ARW.y, t, t0 + .15, dur, { size: ARW.size, fam: FF.brush, color: BD.red });
    }
    function drawArrow(u) {
      const P = arrowPts(), m = Math.max(2, Math.round(P.length * u));
      inkPath(P.slice(0, m), { w: 4.5, color: BD.red, seed: 631 });
      if (u >= 1) { const a = P[P.length - 1], b = P[P.length - 3], an = Math.atan2(a[1] - b[1], a[0] - b[0]);
        inkPath([[a[0] - Math.cos(an - .55) * 18, a[1] - Math.sin(an - .55) * 18], a, [a[0] - Math.cos(an + .55) * 18, a[1] - Math.sin(an + .55) * 18]], { w: 4.5, color: BD.red, seed: 632 }); }
    }
    /** the stall set: plank wall, full shelves, the awning beam with tinsel, bunting, lights, the envelope and the frame */
    function set(t, lit, lightsLater) {
      plankWall(BOARD.x0, BOARD.y0, BOARD.x1, BOARD.y1, 3);
      shelfUnit(t, SHELF.x0, SHELF.x1, SHELF.y0, FLOOR);
      const r1 = SHELF.y0 + (FLOOR - 22 - SHELF.y0) / 6;
      tinsel(t, SHELF.x0 + 10, r1 + 6, SHELF.x1, r1 + 4, 30, { r: 10, seed: 4, cols: ['#E8394A', '#B81E2E', '#FF7A7A', '#2E9A60'], core: 'rgba(90,10,20,.6)' });
      withShadow(8, () => { ctx.fillStyle = '#8A5A2E'; ctx.fillRect(-40, 494, 1100, 28); }); inkRect(-40, 494, 1100, 28, { w: 3.5, seed: 740 });
      bunting(t, BOARD.x0 + 4, 526, BOARD.x1 - 6, 530, 16, 8, 2);
      tinsel(t, -40, 506, 1060, 510, 0, { r: 12, seed: 1 });             // gold tinsel wrapped along the beam
      emptyEnvelope(ENV.x, ENV.y, ENV.w, ENV.rot);
      quittanceFrame(FRM.x, FRM.y, FRM.w, FRM.h, FRM.rot, t);
      if (!lightsLater) lightString(t, SHELF.x0 - 10, 524, 1050, 528, 34, lit, 7);
    }

    // ======================================================================================================
    // P26 — S28 — page « PLUS TARD » : Christelle fière, la quittance encadrée, l'enveloppe vide ; puis le comptoir.
    // ======================================================================================================
    const B26 = { t0: T26 + .72 }; B26.t1 = Math.max(B26.t0 + 1.9, te('S28', 'note', -.1));
    const TILT0 = B26.t1 + .05, TILT1 = TILT0 + .85;
    const STAMP = Math.max(TILT1 + .08, tw('S28', 'mauvaise'));
    const GE = Math.max(STAMP + .3, tw('S28', 'surprise', .02)), GC = Math.max(GE + .3, tw('S28', 'part', -.08)), GENV = Math.max(GC + .35, tw('S28', 'mise'));
    const AW0 = tw('S28', 'douane', -.05), AW1 = AW0 + .75;
    addShake(STAMP, 13, .16);
    const cK = [{ t: T26, pose: { k: K('christelle', 1) } },
      { t: B26.t0 - .1, pose: { k: K('christelle', 2), hop: B26.t0 + .05 } },
      { t: B26.t1 + .2, pose: { k: K('christelle', 1), hop: STAMP + .04 } }];
    const chrO = t => ({ t, phase: PHC, grade: SHADE, flip: true, talk: on(t, B26.t0, B26.t1), lean: .025 * env(t, B26.t0, B26.t1, .3, .3) });
    let c26 = null;
    defineShot({ id: 'P26', t0: T26, img: 'bg/etal_meches_fetes', seed: 26, inT: .7, inKind: 'page',
      cam: [{ t: T26, x: 515, y: 1040, z: 1.16 }, { t: TILT0, x: 512, y: 1036, z: 1.2 },
        { t: TILT1, x: 385, y: 1130, z: 2.3 }, { t: T27, x: 385, y: 1132, z: 2.36, e: 'lin' }],
      stage(t, n, c) {
        c26 = c;
        floorStrip(FLOOR, c.ih);
        set(t, .4);
        // « → QUITTANCE », lettered beside the envelope, then its arrow down into the frame
        if (arrowWord(t, AW0, AW1 - AW0) >= 1) drawArrow(eOutCubic(clamp((t - AW1 - .15) / .3)));
        stallCounter(CX0, CX1, CT, CV, CF, t);
        // on the counter : the margouillat asleep (jolted by the stamp), the Part 1 ticket on its stand, the bars card
        woodBlock(TIX.x, CT + 2, 70);
        propTicket(TIX.x, CT - 18 - TIX.w * .725, TIX.w, { rot: -.05, lift: 10 });
        stampFall(TIX.x + 4, CT - 18 - TIX.w * .62, TIX.w * .52, 'CALCULÉE PAR LA DOUANE', t, STAMP);
        woodBlock(BARS.x, CT + 2, 78);
        barsCard(BARS.x, CT - 6, BARS.w, BARS.h, .035, (t - GE) / .45, (t - GC) / .45, (t - GENV) / .4);
        // the margouillat asleep at the foot of the ticket, jolted awake by the stamp (then dozes off again)
        const jolt = env(t, STAMP, STAMP + .4, .04, .32);
        ctx.save(); ctx.translate(0, -26 * jolt); propLizard(LIZ.x, CT - 3, LIZ.s, t, { sleep: t < STAMP || t > GENV + .7, phase: .9, look: env(t, STAMP + .05, GENV + .7, .1, .25) }); ctx.restore();
        // Christelle, proud, beside her counter, in front of her full shelves (C1 → C2 shows the frame → C1)
        drawTrack(cK, CHR.x, CHR.y, CHR.h, chrO(t));
      },
      screen(t) {
        const fade = 1 - clamp((t - TILT0) / .3);
        capBox(t, T26 + .3, ['PLUS TARD'], { size: 58, a: fade, seed: 641 });
        dayCard(t, T26 + .75, 'À L\'APPROCHE DES FÊTES', { size: 46, y: 352, a: fade });
        if (c26 && t >= B26.t0 && t <= B26.t1 + .3) {
          const o = chrO(t), P = keyAt(cK, t), oo = Object.assign({}, o, P),
            m = pupAt(P.k, CHR.x, CHR.y, CHR.h, oo, { mouth: true }, [.04, .16]), tp = pupAt(P.k, CHR.x, CHR.y, CHR.h, oo, { bone: 'head', end: 'b' }, [.03, 0]);
          balloon(t, { t0: B26.t0, t1: B26.t1, text: 'Quittance\u00A0reçue. Je\u00A0la\u00A0garde !', x: 840, y: 566, w: 420, size: 48, seed: 26, tail: tailTo(c26, m, tp, 4) });
        }
      } });

    // ======================================================================================================
    // P27 — S29, S30 — un téléphone générique, seul sur une surface neutre ; poussée dans l'écran.
    // ======================================================================================================
    const PH = { x: 500, y: 900, w: 270 };
    const WAKE = T27 + .3, SWAP = ss('S30', -.2);
    const A30 = { title: Math.max(ss('S30', .3), tw('S30', 'Bonzini', .05)), sub: tw('S30', 'droits', -.05),
      rows: [tw('S30', 'taxes', -.05), tw('S30', 'importation', .05), tw('S30', 'estimés', .1), tw('S30', 'quelques', .05)] };
    A30.ticks = [tw('S30', 'avant', -.05), tw('S30', 'payer', -.1), tw('S30', 'fournisseur', -.05)];
    const CART = { t0: tw('S29', 'réglez', -.25), t1: se('S29', .35) };
    defineShot({ id: 'P27', t0: T27, img: 'bg/comptoir_dessus', seed: 27, inT: 0, inKind: 'cut',
      cam: [{ t: T27, x: 500, y: 900, z: 1.0 }, { t: WAKE + .4, x: 500, y: 900, z: 1.04 }, { t: se('S29', -.3), x: 500, y: 872, z: 1.85 },
        { t: SWAP + .3, x: 500, y: 838, z: 2.2 }, { t: tw('S30', 'questions', .2), x: 500, y: 905, z: 3.3 }, { t: T28, x: 500, y: 907, z: 3.42, e: 'lin' }],
      stage(t, n, c) {
        leafShadows(t, c.ih);
        const buzz = env(t, WAKE, WAKE + .35, .02, .1), jx = Math.sin(t * 90) * 2.5 * buzz;
        const wake = clamp((t - WAKE) / .25), slide = eInOutCubic(clamp((t - SWAP) / .45));
        propPhone(PH.x + jx, PH.y, PH.w, { rot: 0, lift: 14, screen: '#1F1D24', glow: wake > 0 ? `rgba(169,71,254,${.25 * wake})` : null }, (sw, sh) => {
          if (wake <= 0) { ctx.fillStyle = '#1F1D24'; ctx.fillRect(0, 0, sw, sh); return; }
          ctx.save(); ctx.globalAlpha *= wake;
          if (slide < 1) { ctx.save(); ctx.translate(-sw * slide, 0); homeScreen(sw, sh, t, WAKE); ctx.restore(); }
          if (slide > 0) { ctx.save(); ctx.translate(sw * (1 - slide), 0); simScreen(sw, sh, t, A30); ctx.restore(); }
          ctx.restore();
          const u = ((t - WAKE) * .16) % 1.6 - .3, gx = u * (sw + sh);                  // a slow sheen sliding over the glass
          const g = ctx.createLinearGradient(gx - 60, 0, gx + 60, sh * .35); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.13)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, sw, sh);
        });
      },
      screen(t) {
        capBox(t, CART.t0, ['VOS FOURNISSEURS,', 'RÉGLÉS EN FRANCS CFA'], { size: 60, x: 540, y: 380, a: 1 - clamp((t - CART.t1) / .3), seed: 651 });
      } });

    // ======================================================================================================
    // P28 — S31, S32 — l'étal au crépuscule ; la question ; le rideau peint descend ; le margouillat file dessous.
    // ======================================================================================================
    const BQ = { t0: ss('S31', -.05), t1: 0, l1: ss('S31', .1), l2: tw('S31', 'avant', -.05), l3: tw('S31', 'avoir', -.05), l4: tw('S31', 'Dites', -.05) };
    const SH0 = ss('S32', -.55), SH1 = SH0 + 1.15, SLIP0 = te('S32', 'moins', -.62), SLIP1 = SLIP0 + .66, CLOSE = SLIP1 + .08;
    const SL = [[tw('S32', 'Payez', -.05), te('S32', 'droit', .05)], [tw('S32', 'Ni', -.05), te('S32', 'moins', .02)]];
    const YSHUT = FLOOR + 40, YPAUSE = YSHUT - 82; BQ.t1 = SH1;
    addShake(SH1, 8, .18); addShake(CLOSE, 16, .2);
    const LZ = { x: 590, y: 1652, s: 2.3 };
    defineShot({ id: 'P28', t0: T28, img: 'bg/etal_meches_fetes', seed: 28, inT: 0, inKind: 'cut',
      cam: [{ t: T28, x: 500, y: 900, z: 1.0 }, { t: SH0, x: 500, y: 905, z: 1.04 }, { t: che('signature'), x: 500, y: 905, z: 1.04 }],
      stage(t, n, c) {
        floorStrip(FLOOR, c.ih);
        set(t, 1, true);
        arrowWord(t, -9, .1); drawArrow(1);
        stallCounter(CX0, CX1, CT, CV, CF, t);
        // dusk: warm multiply + violet sky at the top + the festive bulbs lit
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#E58A55'; ctx.globalAlpha = .78; ctx.fillRect(-60, -60, 1120, c.ih + 120);
        const g = ctx.createLinearGradient(0, 0, 0, c.ih); g.addColorStop(0, 'rgba(60,35,120,.75)'); g.addColorStop(.45, 'rgba(150,70,100,.25)'); g.addColorStop(1, 'rgba(70,35,45,.35)');
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(-60, -60, 1120, c.ih + 120); ctx.restore();
        lightString(t, SHELF.x0 - 10, 524, 1050, 528, 34, 1, 7);            // the shelf bulbs glow over the dusk
        { const tw = .5 + .5 * Math.sin(t * 2.3); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .1 + .05 * tw;   // warm spill on the tinsel
          const gg = ctx.createLinearGradient(0, 480, 0, 760); gg.addColorStop(0, '#FFB45A'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(-40, 480, 1100, 280); ctx.restore(); }
        // the margouillat on the floor : turns its head to us, push-ups on « après », puffs on « commentaire »,
        // then slips under the shutter at the last moment
        const look = env(t, ss('S31', -.1), SH0 + .3, .35, .35) + .9 * env(t, SLIP0 - .75, SLIP0 - .05, .15, .12);
        const run = clamp((t - SLIP0) / (SLIP1 - SLIP0)), lx = LZ.x + 190 * eInCubic(clamp(run * 1.25)), ly = LZ.y - 122 * eInOutCubic(clamp((run - .25) / .75)), ls = 1 - .24 * run;
        if (t < CLOSE + .05) { ctx.save(); ctx.translate(lx, ly); ctx.rotate(run > 0 && run < 1 ? Math.sin(t * 38) * .07 : 0); ctx.scale(ls, ls);
          propLizard(0, 0, LZ.s, t, { phase: 2.2, period: 99, look: clamp(look), pushAt: run > 0 ? SLIP0 : tw('S31', 'après', -.1),
            puff: .85 * env(t, tw('S31', 'commentaire', -.1), se('S31', .6), .15, .3) });
          ctx.restore(); }
        // the comment balloon (screen px, under the shutter)
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); commentBalloon(t, BQ); ctx.restore();
        // the shutter : drops on « Bonzini Trading Cargo », stops just above the floor, closes once the margouillat is in
        if (t >= SH0 - .05) {
          const d1 = clamp((t - SH0) / (SH1 - SH0)), drop = d1 < 1 ? eInCubic(d1) : 1, bounce = t > SH1 ? Math.exp(-(t - SH1) * 7) * Math.sin((t - SH1) * 22) * 10 : 0;
          let yb = lerp(-40, YPAUSE, drop) - bounce;
          if (t > CLOSE - .12) yb = lerp(YPAUSE, YSHUT, eInCubic(clamp((t - CLOSE + .12) / .12)));
          shutter(yb, t, [clamp((t - SL[0][0]) / (SL[0][1] - SL[0][0])), clamp((t - SL[1][0]) / (SL[1][1] - SL[1][0]))], c.ih);
          ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(240,170,120,.32)'; ctx.fillRect(-60, -60, 1120, yb + 60); ctx.restore();   // dusk light on the metal
        }
        lightString(t, -30, 252, 1030, 262, 40, 1, 5);                     // the festive bulbs hang from the awning, in front
      } });
  });
})();

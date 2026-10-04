'use strict';
// =============================================================================================
// K — THE MARGOUILLAT of « PAS REÇU. »: Agama agama, male in breeding colours (fire-orange head, cobalt body, banded
// tail), seen from above, lying on the left edge of the wax cloth at SCORE.G.gecko, body pointing up-right. He is the
// audience's stand-in and the comic relief. Same look and finish as the validated lizard of the previous film; the acting
// is re-driven from the score. Functions only (no registerScene). Reads SCORE (01_score.js) and the light API (02_light.js).
//
//   K_gecko(t, L, g)   draws him (world px: call it inside the camera transform), his own soft shadow included.
//                      t = seconds (float: motion-blur sub-frames ok), L = SCORE.light(t), g = SCORE.gecko(t) (optional).
//                      Returns the pose.
//   K_mouth(t)         {x, y} world px of the mouth (between the jaws when it gapes): where the letters P, A, S go in.
//   K_geckoPose(t)     the pose alone (debug / sync).
//
// Acting — every act window is read from SCORE.gecko(t) itself (scanned once at 240 Hz), every extra beat from SCORE.T:
//   idle     breathing, blinks every ~3 s, tail-tip flicks, the head on g.target in jerky lizard saccades (11° steps),
//            the pupils do the fine tracking (side-eye when the head is clamped at ±70°).
//   hop      the slam: startled hop off the cloth (shadow separates), recoil backwards then a slow creep forward,
//            eyes wide, brows up, tail flick.
//   tennis   the match: the head follows g.target through a stiff spring (ω 34): it snaps between the steel and the
//            amber plate on every fall / rebound, eyes leading; a tail flick on each impact.
//   squint   « LA PREUVE ? »: lids half shut, brows down, the head creeps forward, peering at the amber plate;
//            the eyes pop open at the crush.
//   pushups  the ✓: front legs straighten, chest up, three head bobs (agama display), head brightens.
//   gulp     NEW pose, for P, A, S: eyes on the letter, a small pull-back, the head strikes ~18 px forward, the jaw
//            gapes (the head pitches up off the lower jaw: dark mouth, pink tongue), CHOMP, eyes squeezed shut while a
//            lump travels down the throat into the belly — which gets rounder after each letter.
//            Before the first one: a hungry tongue flick at the P.
//   hic      a tiny hop, the head jerks, the mouth pops open and lets out a small dust puff.
//   smug     half-closed lids, chin up, full belly, slow breathing, one lazy lick.
// Look: ink #1A1426 with a heavier line on the side away from the bulb, gouache body (flank darkening, form shadow away
// from the light, dorsal sheen, warm rim on the edge facing the bulb, scale texture), every colour through lit() sampled
// where the part sits — sampled halfway towards the pool centre (a character fill, KL = .5: outside the pool he would sink
// into the night and vanish on a phone). Geometry: body units are px on the table plane; the plane goes to the screen
// with a depth foreshortening SQ = .77; lifts (z) are screen px up, like the rest of the film. Placement: the native rig
// is drawn ×1.18 with its mid-trunk at G.gecko + (−14, +34), so the head (≈ 148, 1395) stays clear of the amber plate's
// corner at its biggest (×1.16, « J'AI PAYÉ !!! ») and the body clear of the CTA pill. Cost ≈ 1.2–1.8 ms a call.
// Motion blur (window.MB > 1): drawn directly at a quantized time, one tap per frame at rest, two taps (n ± ¼) while
// he moves, so his saccades stay crisp.
// =============================================================================================
const K_ = (function () {
  const S = window.SCORE, G = S.G, T = S.T, TAU = Math.PI * 2, D2R = Math.PI / 180;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const sst = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const bump = (d, len) => d > 0 && d < len ? Math.sin(Math.PI * d / len) : 0;
  const eo = x => 1 - Math.pow(1 - cl(x), 3);

  const SQ = .77;                       // table plane → screen (depth foreshortening)
  const SC = 1.1;                       // body units → px (native rig, drawn around G.gecko)
  // placement: the native rig is drawn through a uniform transform — a bit larger than the previous film for a phone,
  // its anchor (mid-trunk) moved down-left of G.gecko so the head stays clear of the amber plate's corner at its biggest
  const KS = 1.18, PX = G.gecko.x - 14, PY = G.gecko.y + 34;
  const toW = p => ({ x: PX + (p.x - G.gecko.x) * KS, y: PY + (p.y - G.gecko.y) * KS });   // native → world
  const toN = p => ({ x: G.gecko.x + (p.x - PX) / KS, y: G.gecko.y + (p.y - PY) / KS });   // world → native
  const KL = .5;                        // character fill: his colours are sampled this much closer to the pool centre
  const TH = -56 * D2R, CTH = Math.cos(TH), STH = Math.sin(TH);   // body heading on the table (screen ≈ −49°, up-right)
  const LEN = 190, DS = 2, NS = LEN / DS + 1, S_ANCHOR = 70, I_ANCHOR = S_ANCHOR / DS;   // anchor = mid-trunk
  const HINGE = 28;                     // jaw hinge (s units): the upper head pitches up about it when he gapes
  const INK = '#1A1426';
  const COL = {
    snout: '#FFC23A', head: '#FF8526', jowl: '#FF5520', neck: '#E85030',
    body: '#5282FF', bodyHi: '#B2C8FF', leg: '#5A7CF6', toe: '#3A50C0', fleck: '#CCDAFF',
    pale: '#EEF3FF', band: '#FF7A2A', ring: '#24185A', tip: '#1D1636',
    eye: '#F8EDCF', iris: '#D88A24', pupil: '#120A1C', hi: '#FFF1D8', rim: '#FFC07A',
    jaw: '#FFB347', mouth: '#4A0F22', mouthD: '#2A0614', tongue: '#F0788A', dust: '#E9DDC8',
  };

  // ---------- half-width profile (units), Catmull-Rom through keys ----------
  const WK = [[0, 0], [1.2, 3.4], [5, 6.8], [11, 9.4], [18, 11.4], [25, 12.9], [30, 12.6], [35, 10.0], [41, 8.8], [49, 10.8],
    [59, 13.4], [70, 14.4], [82, 13.6], [92, 11.4], [100, 8.8], [110, 6.8], [130, 4.9], [152, 3.4], [172, 2.0], [190, .6]];
  function wAt(s) {
    let i = 0; while (i < WK.length - 2 && WK[i + 1][0] < s) i++;
    const p0 = WK[Math.max(0, i - 1)], p1 = WK[i], p2 = WK[i + 1], p3 = WK[Math.min(WK.length - 1, i + 2)];
    const h = p2[0] - p1[0], t = cl((s - p1[0]) / h);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * h, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * h;
    const t2 = t * t, t3 = t2 * t;
    return Math.max(0, (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2);
  }
  let W0 = null, TEXC = null, PAT = null, FLECKS = null;
  const mk = () => ({ u: new Float64Array(NS), v: new Float64Array(NS), ph: new Float64Array(NS), z: new Float64Array(NS), w: new Float64Array(NS),
    lx: new Float64Array(NS), ly: new Float64Array(NS), rx: new Float64Array(NS), ry: new Float64Array(NS), cx: new Float64Array(NS), cy: new Float64Array(NS) });
  const A = mk(), J = mk();             // A = the body as drawn; J = the same body with the jaw shut (the lower jaw)

  // ---------- gouache + scale texture (one 128² tile, neutral grey 128 = no change under 'overlay') ----------
  function hp(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function pn(x, y, P, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = q => ((q % P) + P) % P;
    const a = hp(m(xi), m(yi), s), b = hp(m(xi + 1), m(yi), s), c = hp(m(xi), m(yi + 1), s), d = hp(m(xi + 1), m(yi + 1), s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function build() {
    if (W0) return;
    W0 = new Float64Array(NS); for (let i = 0; i < NS; i++) W0[i] = wAt(i * DS);
    const N = 128; TEXC = makeCanvas(N, N); const g = TEXC.getContext('2d'), id = g.createImageData(N, N), d = id.data;
    const RH = 128 / 40, CW = 128 / 34;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const row = Math.floor(y / RH), off = (row & 1) ? CW / 2 : 0;
      const sx = ((x + off) % CW) / CW - .5, sy = (y % RH) / RH - .5;
      const e = Math.max(Math.abs(sx) * 1.05, Math.abs(sy));
      const scale = -26 * sst(.3, .5, e) + 12 * (.45 - Math.hypot(sx, sy)) + (hp(row, Math.floor((x + off) / CW), 9) - .5) * 10;
      const blot = (pn(x / 16, y / 16, 8, 3) - .5) * 34 + (pn(x / 8, y / 8, 16, 5) - .5) * 16;
      const n = 128 + scale + blot + (hp(x, y, 11) - .5) * 10, i = (y * N + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = cl(n, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    PAT = ctx.createPattern(TEXC, 'repeat');
    FLECKS = []; for (let i = 0; i < 14; i++) FLECKS.push({ s: 50 + rnd(i * 3.1 + 7) * 48, l: (rnd(i * 5.7 + 2) - .5) * 1.3, r: .55 + rnd(i * 2.3 + 1) * .6 });
  }

  // ---------- the score, read once: act windows, beats, and the head / eye followers ----------
  const HZ = 240;
  let SEG = null, YAW = null, EYE = null, NT = 0, BLINKS = null, FLICKS = null;
  // neck pivot (rest position) on the table: the head aims from here
  const NX = G.gecko.x + CTH * 36 * SC, NY = G.gecko.y + STH * 36 * SC * SQ;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const aimOf = w => { const p = toN(w); return wrap(Math.atan2((p.y - NY) / SQ, p.x - NX) - TH); };
  /** what he looks at: the score's target, except that from the end card on he only has eyes for the next letter */
  function lookAt(t, g) {
    const R = S.LETTER_REST, Tg = T.gulps;
    if (t >= T.endcard - .1 && t < T.hic) {
      let i = 0; while (i < 3 && t >= Tg[i] + .22) i++;
      if (i < 3) return R[i];
    }
    return g.target;
  }
  function buildScore() {
    if (SEG) return;
    NT = Math.ceil(S.DUR * HZ) + 2; SEG = []; YAW = new Float32Array(NT); EYE = new Float32Array(NT);
    const raw = new Float32Array(NT), rawC = new Float32Array(NT);
    let cur = null;
    // the tennis match is played with the whole head: the aim swings ×1.7 around the middle of the two plates
    const mid = (aimOf({ x: G.cx, y: G.amberY }) + aimOf({ x: G.cx, y: G.steelHigh })) / 2;
    for (let i = 0; i < NT; i++) {
      const t = i / HZ, g = S.gecko(t), key = g.act + '|' + g.n;
      if (!cur || cur.key !== key) { if (cur) cur.t1 = t; cur = { key, act: g.act, n: g.n, t0: t, t1: 1e9 }; SEG.push(cur); }
      let a = aimOf(lookAt(t, g));
      if (g.act === 'tennis') a = mid + wrap(a - mid) * 1.7;
      if (i > 0) a = raw[i - 1] + wrap(a - raw[i - 1]);   // unwrapped
      raw[i] = a; rawC[i] = cl(a, -70 * D2R, 70 * D2R);
    }
    // the head: a stiff, slightly under-damped spring (a snap with a hint of overshoot); the eyes: much faster
    const fol = (src, dst, w, z) => { let y = src[0], v = 0; const h = 1 / HZ; for (let i = 0; i < NT; i++) { const acc = w * w * (src[i] - y) - 2 * z * w * v; v += acc * h; y += v * h; dst[i] = y; } };
    fol(rawC, YAW, 34, .62); fol(raw, EYE, 80, .85);
    // idle blinks (~every 3 s) and tail-tip flicks, deterministic; plus a flick on every impact of the film
    BLINKS = []; for (let b = .9, i = 0; b < S.DUR; i++) { BLINKS.push(b); b += 2.6 + 1.2 * rnd(i * 4.7 + 1); }
    FLICKS = []; for (let b = 2.2, i = 0; b < S.DUR; i++) { FLICKS.push(b); b += 2.4 + 1.6 * rnd(i * 2.9 + 5); }
    FLICKS.push(T.slam + .03, ...T.falls.map(x => x + .02), ...T.rebounds.map(x => x + .02), T.proof + .03, T.crush + .42, T.stamp + .03, T.check + .02);
    FLICKS.sort((a, b) => a - b);
  }
  const tab = (arr, t) => { const q = cl(t * HZ, 0, NT - 1.001), i = Math.floor(q), f = q - i; return arr[i] + (arr[i + 1] - arr[i]) * f; };
  /** the last window of that act starting at or before t (or null) */
  function seg(act, t) { let r = null; for (const s of SEG) { if (s.t0 > t) break; if (s.act === act) r = s; } return r; }
  function segN(act, n, t) { let r = null; for (const s of SEG) { if (s.t0 > t) break; if (s.act === act && s.n === n) r = s; } return r; }
  const inSeg = (s, t) => s && t >= s.t0 && t < s.t1;

  // ---------- acting ----------
  function pose(t) {
    buildScore();
    const P = { t };
    // the head: follower + lizard saccades (hold, snap, hold); the pupils do the rest
    const yf = tab(YAW, t), STEP = 11 * D2R, q = yf / STEP, n = Math.floor(q);
    P.yaw = STEP * (n + sst(.36, .64, q - n));
    P.look = cl(tab(EYE, t) - P.yaw, -1.5, 1.5);
    P.yawV = Math.abs(tab(YAW, t + 1 / 60) - tab(YAW, t - 1 / 60)) * 30;      // rad/s, for the motion-blur taps
    let wide = 0, zAll = 0, zHead = 0, zChest = 0, push = 0, bob = 0, lid = .12, brow = 0, lunge = 0, gape = 0, recoil = 0;
    let squeeze = 0, tongue = 0, bulge = 0, bulgeS = 30, full = 0, puff = -1, bright = 0, mv = P.yawV > .6;
    // hop — startled by the slam: off the cloth, a recoil backwards, then a slow, curious creep forward again
    const H = seg('hop', t);
    if (H) {
      const d = t - H.t0;
      zAll += 20 * bump(d, .32);
      recoil = 11 * sst(0, .18, d) * (1 - sst(.55, 2.4, d));
      wide = Math.max(wide, cl(d / .05) * (1 - sst(.45, .95, d)));
      zHead += 12 * cl(d / .1) * (1 - sst(.32, .8, d));
      if (d < 1) mv = true;
    }
    // small flinches at the other big impacts (the stamp, the crush) and when the letters land near him
    for (const [t0, a] of [[T.stamp, .9], [T.crush + .4, .7], ...T.letters.map(x => [x + .22, .45])]) {
      const d = t - t0; if (d > 0 && d < .7) { wide = Math.max(wide, a * cl(d / .05) * (1 - sst(.2, .6, d))); zAll += a * 4 * bump(d, .2); if (d < .3) mv = true; }
    }
    // tennis — the snaps come from the follower; each impact also widens the eyes a touch
    if (inSeg(seg('tennis', t), t)) {
      for (const e of T.falls) { const d = t - e; if (d > 0 && d < .4) wide = Math.max(wide, .45 * cl(d / .04) * (1 - sst(.12, .4, d))); }
    }
    // squint — « LA PREUVE ? »: suspicious, lids half shut, brows down, creeping forward
    const Q = seg('squint', t);
    let squint = 0;
    if (Q && t < Q.t1 + .3) {
      squint = sst(Q.t0 + .05, Q.t0 + .4, t) * (1 - sst(Q.t1 - .55, Q.t1 - .1, t));
      lunge += squint * (3 + 4 * sst(Q.t0, Q.t1, t));
      zHead -= 2 * squint;
    }
    // push-ups — joy at the ✓: three bobs, the head flushes brighter (agama display)
    const U = seg('pushups', t);
    if (inSeg(U, t)) {
      const k = (t - U.t0) / (U.t1 - U.t0);
      push = sst(0, .08, k) * (1 - sst(.86, .98, k));
      const ph = (k - .05) / .27;
      bob = ph > 0 && ph < 3 ? Math.pow(Math.sin(Math.PI * (ph % 1)), .75) : 0;
      bright = push; mv = true;
    }
    zChest += push * (10 + 14 * bob);
    zHead += push * (-4 + 20 * bob * bob);
    // gulps — P, A, S: strike, gape, chomp, eyes squeezed while the lump goes down; the belly fills up
    for (let i = 0; i < 3; i++) {
      const d = t - T.gulps[i];
      full += sst(.36, .56, d);
      if (d < -.2 || d > .62) continue;
      mv = true;
      lunge += -3 * sst(-.17, -.09, d) * (1 - sst(-.09, -.05, d)) + 18 * eo(kk(d, -.09, .0)) * (1 - sst(.1, .34, d));
      gape = Math.max(gape, sst(-.08, -.02, d) * (1 - sst(.07, .11, d)));
      zHead += -2 * sst(-.17, -.09, d) * (1 - sst(-.09, -.04, d)) + 5 * bump(d - .1, .2);
      squeeze = Math.max(squeeze, sst(.08, .12, d) * (1 - sst(.3, .4, d)));
      if (d > .08 && d < .56) { const k = kk(d, .1, .52); bulgeS = 22 + 46 * sst(0, 1, k); bulge = Math.max(bulge, (11 - 6 * k) * sst(.08, .14, d) * (1 - sst(.82, 1, k))); }
      wide = Math.max(wide, .5 * sst(-.2, -.12, d) * (1 - sst(0, .06, d)));          // eyes on the prize
    }
    // a hungry tongue flick at the P just before the first gulp, a lazy lick once he is smug
    for (const [t0, a] of [[T.gulps[0] - .62, 1], [T.gulps[0] - .44, .8], [T.hic + 1.3, .75]]) { const d = t - t0; if (d > 0 && d < .16) { tongue = Math.max(tongue, a * Math.sin(Math.PI * d / .16)); mv = true; } }
    // hic — a tiny hop, the head jerks up, the mouth pops open and lets out a puff
    const C = seg('hic', t);
    if (C) {
      const d = t - C.t0;
      if (d < 1) {
        zAll += 7 * bump(d, .2); zHead += 6 * bump(d, .16); gape = Math.max(gape, .45 * bump(d - .02, .17));
        wide = Math.max(wide, .75 * cl(d / .04) * (1 - sst(.15, .35, d)));
        puff = d; if (d < .5) mv = true;
      }
    }
    // smug — half-closed lids, chin up, slow breathing
    const M = seg('smug', t);
    let smug = 0;
    if (M) { smug = sst(M.t0, M.t0 + .5, t); zHead += 3 * smug; }
    // lids & brows
    lid = Math.max(lid, squint * (.5 + .16 * (Q ? sst(Q.t0, Q.t1, t) : 0)), .44 * smug);
    lid *= (1 - wide) * (1 - .85 * push);
    let blink = 0;
    for (const b of BLINKS) { const d = t - b; if (d > 0 && d < .24) blink = Math.max(blink, d < .067 ? d / .067 : d < .12 ? 1 : 1 - (d - .12) / .12); }
    blink *= 1 - cl(Math.max(wide, push, gape, squeeze) * 4);
    P.lid = Math.max(lid, blink, squeeze);
    P.squeeze = squeeze;
    P.brow = cl(.95 * squint + .5 * smug + .6 * squeeze - 1.1 * wide - .4 * push, -1, 1);   // + = frown (suspicious), − = raised
    P.wide = wide; P.push = push; P.bob = bob; P.bright = bright;
    P.zAll = zAll; P.zChest = zChest; P.zHead = zHead; P.lunge = lunge; P.gape = gape; P.recoil = recoil;
    P.tongue = tongue; P.bulge = bulge; P.bulgeS = bulgeS; P.full = full; P.puff = puff; P.smug = smug;
    // body
    P.breath = Math.sin(TAU * t / (1.6 + .5 * smug)) * (1 + .5 * smug);
    P.trunkBend = .05 * Math.sin(TAU * t / 16 + 1.3);
    let flick = 0;
    for (const t0 of FLICKS) { const d = (t - t0) * 30; if (d > 0 && d < 24) { flick += Math.sin(d * .95) * Math.exp(-d / 5) * (1 - d / 24); if (d < 14) mv = true; } }
    P.flick = 1.2 * flick;
    P.sway = .10 * Math.sin(TAU * t / 8 + .6) + .05 * Math.sin(TAU * t / 3.2 + 2.1) - .18 * push + .06 * smug;
    P.mv = mv;
    return P;
  }
  function kk(t, a, b) { return cl((t - a) / (b - a)); }

  // ---------- the spine ----------
  function bendAt(s, P) {
    const ysh = .16 * P.yaw;
    if (s <= 33) return P.yaw;
    if (s <= 54) return ysh + (P.yaw - ysh) * (1 - sst(33, 54, s));
    if (s <= 100) return ysh * (1 - sst(54, 84, s)) + P.trunkBend * Math.sin(Math.PI * (s - 54) / 46);
    const u = (s - 100) / (LEN - 100);
    return -.35 * u - 1.5 * u * u + P.sway * u + P.flick * u * u * u;   // the tail sweeps to the lizard's right (towards the pool), tip curling
  }
  function zAt(s, P, gape) {
    return P.zAll + P.zChest * (1 - sst(50, 92, s)) + P.zHead * (1 - sst(28, 44, s)) + (s < HINGE ? 23 * gape * (HINGE - s) / HINGE : 0);
  }
  function spine(P, B, gape, jaw = 0) {
    const { u, v, ph, z, w } = B;
    for (let i = 0; i < NS; i++) { const s = i * DS; ph[i] = TH + bendAt(s, P); z[i] = zAt(s, P, gape); }
    const rx = -CTH * P.recoil / SC, ry = -STH * P.recoil / SC;
    u[I_ANCHOR] = rx; v[I_ANCHOR] = ry;
    for (let i = I_ANCHOR; i > 0; i--) {   // a lifted front pitches up: its plan view shortens (it rises instead of reaching)
      const a = (ph[i] + ph[i - 1]) / 2, dz = Math.max(0, z[i - 1] - z[i]), sh = DS - Math.min(DS * .8, dz * .55);
      u[i - 1] = u[i] + sh * Math.cos(a); v[i - 1] = v[i] + sh * Math.sin(a);
    }
    for (let i = I_ANCHOR; i < NS - 1; i++) { const a = (ph[i] + ph[i + 1]) / 2; u[i + 1] = u[i] - DS * Math.cos(a); v[i + 1] = v[i] - DS * Math.sin(a); }
    if (P.lunge) {                            // the strike: head and neck reach along the head's heading, the trunk follows a little
      const a = ph[Math.round(15 / DS)], lu = Math.cos(a) * P.lunge / SC, lv = Math.sin(a) * P.lunge / SC;
      for (let i = 0; i < NS; i++) { const k = 1 - sst(18, 66, i * DS); if (k <= 0) break; u[i] += lu * k; v[i] += lv * k; }
    }
    if (jaw > 0) {                            // the lower jaw drops forward a little (cartoon read of the open mouth)
      for (let i = 0; i * DS < HINGE; i++) { const k = jaw * 7 * (HINGE - i * DS) / HINGE; u[i] += Math.cos(ph[i]) * k; v[i] += Math.sin(ph[i]) * k; }
    }
    for (let i = 0; i < NS; i++) {
      const s = i * DS, br = 1 + .05 * P.breath * sst(46, 60, s) * (1 - sst(88, 100, s));
      let ww = W0[i] * br * (1 + .011 * (z[i] - P.zAll));
      ww += P.full * 1.15 * sst(46, 62, s) * (1 - sst(84, 100, s));                       // the belly, a little rounder per letter
      if (P.bulge > 0) { const e = (s - P.bulgeS) / 7.5; ww += P.bulge * Math.exp(-e * e); }   // the lump going down the throat
      w[i] = ww;
    }
  }
  function project(B, dz = 0) {
    const { u, v, ph, z, w, lx, ly, rx, ry, cx, cy } = B, X0 = G.gecko.x, Y0 = G.gecko.y;
    for (let i = 0; i < NS; i++) {
      const nu = -Math.sin(ph[i]), nv = Math.cos(ph[i]);
      cx[i] = X0 + SC * u[i]; cy[i] = Y0 + SC * v[i] * SQ - z[i];
      lx[i] = X0 + SC * (u[i] - nu * w[i]); ly[i] = Y0 + SC * (v[i] - nv * w[i]) * SQ - z[i];
      rx[i] = X0 + SC * (u[i] + nu * w[i]); ry[i] = Y0 + SC * (v[i] + nv * w[i]) * SQ - z[i];
    }
  }
  const scr = (uu, vv, zz) => ({ x: G.gecko.x + SC * uu, y: G.gecko.y + SC * vv * SQ - zz });
  function at(arr, s) { const q = cl(s / DS, 0, NS - 1), i = Math.min(NS - 2, Math.floor(q)), t = q - i; return arr[i] + (arr[i + 1] - arr[i]) * t; }
  function solve(P) {
    if (P.gape > .001) { spine(P, J, 0, P.gape); project(J); }
    spine(P, A, P.gape); project(A);
  }

  // ---------- paths ----------
  function smoothTo(xs, ys, first) {      // quadratic through midpoints
    if (first) ctx.moveTo(xs[0], ys[0]); else ctx.lineTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length - 1; i++) ctx.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[i + 1]) / 2, (ys[i] + ys[i + 1]) / 2);
    ctx.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
  }
  /** outline of the stretch [a, b] of the body (s units), width scaled by k, shifted by (ox, oy) */
  function bodyPath(a, b, k = 1, ox = 0, oy = 0, B = A) {
    const { cx, cy, lx, ly, rx, ry } = B, Lx = [], Ly = [], Rx = [], Ry = [];
    // adaptive sampling: fine round the snout and the tail tip, coarse along the trunk (the path cost is what matters)
    const ss = [a]; for (let q = a; q < b;) { q += q < 12 ? 1.5 : q > LEN - 10 ? 2.5 : 4.5; ss.push(Math.min(q, b)); }
    for (const s of ss) {
      const c0 = at(cx, s), c1 = at(cy, s);
      Lx.push(c0 + (at(lx, s) - c0) * k + ox); Ly.push(c1 + (at(ly, s) - c1) * k + oy);
      Rx.push(c0 + (at(rx, s) - c0) * k + ox); Ry.push(c1 + (at(ry, s) - c1) * k + oy);
    }
    smoothTo(Lx, Ly, true); Rx.reverse(); Ry.reverse(); smoothTo(Rx, Ry, false); ctx.closePath();
  }
  const silhouette = (k, ox, oy) => bodyPath(0, LEN, k, ox, oy);
  /** soft (blurred) fill / stroke via a pushed shadow — castShadow()'s look without ctx.filter */
  function soft(path, blur, color, stroke, lw, rule) {
    const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b), push = (ctx.canvas.width + 600 + 6 * blur * sc) / (m.a || 1);
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = Math.max(0, 2 * blur * sc); ctx.shadowOffsetX = -push * m.a; ctx.shadowOffsetY = -push * m.b;
    ctx.translate(push, 0); ctx.beginPath(); path();
    if (stroke) { ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.stroke(); } else { ctx.fillStyle = '#000'; ctx.fill(rule || 'nonzero'); }
    ctx.restore();
  }
  const parse = s => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number);
  const rgba = (s, a) => { const c = parse(s); return `rgba(${c[0]},${c[1]},${c[2]},${cl(a).toFixed(3)})`; };
  const mixc = (s1, s2, k) => { const a = parse(s1), b = parse(s2); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`; };
  /** capsule from a (radius ra) to b (radius rb), added to the current path */
  function capsule(a, b, ra, rb) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3, ang = Math.atan2(dy, dx), al = Math.asin(cl((ra - rb) / d, -1, 1));
    ctx.moveTo(a.x + Math.cos(ang + Math.PI / 2 + al) * ra, a.y + Math.sin(ang + Math.PI / 2 + al) * ra);
    ctx.arc(a.x, a.y, ra, ang + Math.PI / 2 + al, ang - Math.PI / 2 - al);
    ctx.arc(b.x, b.y, rb, ang - Math.PI / 2 - al, ang + Math.PI / 2 + al); ctx.closePath();
  }

  // ---------- legs ----------
  // base frame: x forward along the heading, y to the lizard's right. Joint at spine s; knee (bent); foot; toe fan (deg) & lengths
  const LEGS = [
    { s: 94, front: false, knee: [-12, 26], foot: [-35, 29], fan: [-52, -26, -4, 18, 42], len: [4.6, 7.6, 10.2, 13, 7], r: [4.2, 2.9, 2.1] },
    { s: 52, front: true, knee: [6, 24], foot: [28, 29], fan: [-60, -29, -3, 24, 52], len: [4.8, 7.2, 8.8, 7.8, 5.4], r: [3.6, 2.5, 1.9] },
  ];
  const b2t = (x, y) => ({ u: x * CTH - y * STH, v: x * STH + y * CTH });
  function legGeo(P, lg, side) {
    const i = lg.s / DS, { u, v, ph, z, w } = A;
    const nu = -Math.sin(ph[i]), nv = Math.cos(ph[i]);
    const Jt = { u: u[i] + nu * side * w[i] * .45, v: v[i] + nv * side * w[i] * .45, z: z[i] };
    const ru = -CTH * P.recoil / SC, rv = -STH * P.recoil / SC;          // the feet go back with the recoil
    const F0 = b2t(lg.foot[0], lg.foot[1] * side), F = { u: F0.u + ru, v: F0.v + rv, z: P.zAll };
    const K0r = b2t(lg.knee[0], lg.knee[1] * side), K0 = { u: K0r.u + ru, v: K0r.v + rv };
    // push-up: the front legs straighten (the elbow slides to the middle of shoulder–hand and rises with them)
    const ext = lg.front ? P.push * (.6 + .4 * P.bob) : 0;
    const mid = { u: (Jt.u + F.u) / 2 + nu * side * 2, v: (Jt.v + F.v) / 2 + nv * side * 2 };
    const K = { u: K0.u + (mid.u - K0.u) * ext, v: K0.v + (mid.v - K0.v) * ext, z: P.zAll + (Jt.z - P.zAll) * (.3 + .3 * ext) };
    const base = Math.atan2(F.v - K0.v, F.u - K0.u), toes = [];
    for (let t = 0; t < 5; t++) {
      const a = base + lg.fan[t] * D2R * side * (lg.front ? 1 : -1), L = lg.len[t], c = (t - 2) * .14 * side * (lg.front ? 1 : -1);
      toes.push({ m: { u: F.u + Math.cos(a - c) * L * .55, v: F.v + Math.sin(a - c) * L * .55 }, e: { u: F.u + Math.cos(a) * L, v: F.v + Math.sin(a) * L } });
    }
    return { J: Jt, K, F, toes };
  }
  /** all four legs in batched passes (one path per pass: a few canvas calls instead of ~80) */
  function drawLegs(legs, C) {
    const o = C.lo, sp = [];
    for (const [lg, g] of legs) {
      const Jp = scr(g.J.u, g.J.v, g.J.z), K = scr(g.K.u, g.K.v, g.K.z), F = scr(g.F.u, g.F.v, g.F.z);
      sp.push({ lg, g, J: Jp, K, F, r: lg.r, toes: g.toes.map(t => ({ m: scr(t.m.u, t.m.v, g.F.z), e: scr(t.e.u, t.e.v, g.F.z) })) });
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // toes: ink, then a lit core
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.beginPath();
    for (const q of sp) for (const t of q.toes) { ctx.moveTo(q.F.x, q.F.y); ctx.quadraticCurveTo(t.m.x, t.m.y, t.e.x, t.e.y); }
    ctx.stroke();
    ctx.strokeStyle = C.toe; ctx.lineWidth = 1.0; ctx.beginPath();
    for (const q of sp) for (const t of q.toes) { ctx.moveTo(q.F.x, q.F.y); ctx.quadraticCurveTo(t.m.x, t.m.y, t.e.x + (t.m.x - t.e.x) * .2, t.e.y + (t.m.y - t.e.y) * .2); }
    ctx.stroke();
    // limbs: ink capsules (heavier away from the bulb), shade, the lit body of the limb pushed towards the bulb, a sheen
    const off = (q, k) => ({ x: q.x - o.x * k, y: q.y - o.y * k });
    const sh = (q, k) => ({ x: q.x + o.x * k, y: q.y + o.y * k - (1 - Math.hypot(o.x, o.y)) * k * .6 });
    ctx.fillStyle = C.ink; ctx.beginPath();
    for (const { J: Jp, K, F, r } of sp) { capsule(off(Jp, .8), off(K, .8), r[0] + 1.5, r[1] + 1.4); capsule(off(K, .8), off(F, .8), r[1] + 1.4, r[2] + 1.3); }
    ctx.fill();
    ctx.fillStyle = C.legD; ctx.beginPath();
    for (const { J: Jp, K, F, r } of sp) { capsule(Jp, K, r[0], r[1]); capsule(K, F, r[1], r[2]); }
    ctx.fill();
    ctx.fillStyle = C.leg; ctx.beginPath();
    for (const { J: Jp, K, F, r } of sp) { capsule(sh(Jp, r[0] * .3), sh(K, r[1] * .3), r[0] * .72, r[1] * .72); capsule(sh(K, r[1] * .3), sh(F, r[2] * .3), r[1] * .72, r[2] * .7); }
    ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = C.sheen; ctx.lineWidth = 1.5; ctx.beginPath();
    for (const { J: Jp, K, F, r } of sp) { const a1 = sh(Jp, r[0] * .55), a2 = sh(K, r[1] * .55), a3 = sh({ x: (K.x + F.x) / 2, y: (K.y + F.y) / 2 }, r[2] * .5); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.lineTo(a3.x, a3.y); }
    ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(C.ink, .35); ctx.lineWidth = .7; ctx.beginPath();
    for (const { K, r } of sp) { ctx.moveTo(K.x + r[1] * .9, K.y); ctx.arc(K.x, K.y, r[1] * .9, 0, TAU); }
    ctx.stroke();
  }

  /** the mouth (world px): between the jaws, just inside the snout */
  function mouthOf(P) {
    const a = A.ph[0], fx = Math.cos(a) * SC * 2.5, fy = Math.sin(a) * SC * SQ * 2.5;  // just ahead of the snout tip
    const ux = at(A.cx, 2) + fx, uy = at(A.cy, 2) + fy;
    if (P.gape <= .001) return { x: ux, y: uy };
    const k = .78 * cl(P.gape * 2);                                                     // into the maw, towards the lower jaw
    return { x: ux + (at(J.cx, 6) - ux) * k, y: uy + (at(J.cy, 6) - uy) * k };
  }

  // ---------- draw ----------
  function draw(t, L) {
    build();
    const P = pose(t);
    solve(P);
    const { cx, cy } = A, X0 = G.gecko.x, Y0 = G.gecko.y;
    const lp = (x, y) => { const w = toW({ x, y }); return [w.x + (L.x - w.x) * KL, w.y + (POOL_Y - w.y) * KL]; };
    const lk = lightAt(...lp(X0 + 30, Y0 - 30), L).k, lv = cl(L.violet || 0), on = cl(L.on);
    // light direction on screen (from the lizard towards the bulb); the brand light comes from straight above
    let ldx = L.x - X0, ldy = (POOL_Y - 330) - Y0; const ln = Math.hypot(ldx, ldy) || 1; ldx /= ln; ldy /= ln;
    const dirW = on * (1 - lv), lo = { x: ldx * dirW, y: ldy * dirW };
    const hx = at(cx, 16), hy = at(cy, 16), tx = at(cx, 145), ty = at(cy, 145);
    const c = (hex, x, y, b = 1) => lit(hex, ...lp(x, y), L, b);
    const ink = c(INK, X0, Y0, 0);
    const legs = []; for (const lg of LEGS) for (const side of [-1, 1]) legs.push([lg, legGeo(P, lg, side)]);

    ctx.save();
    ctx.translate(PX, PY); ctx.scale(KS, KS); ctx.translate(-X0, -Y0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';

    // 1 — shadows on the cloth: the flat body (lifted parts fall further away) + legs; then a tight contact shadow
    const so = z => lv > .5 ? { x: 0, y: 2 + z * .55 } : { x: -ldx * (2.4 + .42 * z), y: -ldy * (2.4 + .42 * z) * .55 + z * .62 };
    {
      const sa = cl(.5 + .4 * lk + .2 * lv) * Math.max(on, lv, .35);
      const { u, v, ph, w, z } = A, Lx = [], Ly = [], Rx = [], Ry = [];
      for (let i = 0; i < NS; i++) {
        const nu = -Math.sin(ph[i]), nv = Math.cos(ph[i]), o = so(z[i]), ww = w[i] * .92;
        Lx.push(X0 + SC * (u[i] - nu * ww) + o.x); Ly.push(Y0 + SC * (v[i] - nv * ww) * SQ + o.y);
        Rx.push(X0 + SC * (u[i] + nu * ww) + o.x); Ry.push(Y0 + SC * (v[i] + nv * ww) * SQ + o.y);
      }
      Rx.reverse(); Ry.reverse();
      const Tq = (q, zz) => { const o = so(zz); return { x: X0 + SC * q.u + o.x, y: Y0 + SC * q.v * SQ + o.y }; };
      soft(() => {
        smoothTo(Lx, Ly, true); smoothTo(Rx, Ry, false); ctx.closePath();
        for (const [lg, g] of legs) { const Jp = Tq(g.J, g.J.z), K = Tq(g.K, g.K.z), F = Tq(g.F, g.F.z); capsule(Jp, K, lg.r[0] * .9, lg.r[1] * .9); capsule(K, F, lg.r[1] * .9, lg.r[2] + 1.2); }
      }, 2.6 + P.zAll * .12, `rgba(8,4,18,${(sa * (1 - .35 * cl(P.zAll / 14))).toFixed(3)})`);
      // contact shadow right under the belly where it touches the table
      const ca = .42 * (1 - cl(P.zAll / 5));
      if (ca > .01) {
        const { lx, ly, rx, ry } = A, Ax = [], Ay = [], Bx = [], By = [];
        for (let i = 20; i < NS; i++) { const zz = A.z[i]; if (zz > 3) continue; Ax.push((lx[i] + cx[i]) / 2); Ay.push((ly[i] + cy[i]) / 2 + zz + 2.5); Bx.push((rx[i] + cx[i]) / 2); By.push((ry[i] + cy[i]) / 2 + zz + 2.5); }
        if (Ax.length > 2) { Bx.reverse(); By.reverse(); soft(() => { smoothTo(Ax, Ay, true); smoothTo(Bx, By, false); ctx.closePath(); }, 2.6, `rgba(6,3,14,${ca.toFixed(3)})`); }
      }
    }
    // 2 — legs, under the body
    drawLegs(legs, { ink, lo, legD: c(COL.toe, X0, Y0, .2), leg: c(COL.leg, X0, Y0, 1), toe: c(COL.leg, X0, Y0, .7),
      sheen: rgba(c(COL.bodyHi, X0, Y0, 1), cl(.15 + 1.2 * lk * on + .3 * lv)) });

    // the head frame (rigid head: x forward, y to the lizard's right)
    const s0 = 15, HX = at(cx, s0), HY = at(cy, s0), HA = at(A.ph, s0), hs = 1 + .011 * (at(A.z, s0) - P.zAll);
    const headFrame = () => { ctx.translate(HX, HY); ctx.scale(SC * hs, SC * hs * SQ); ctx.rotate(HA); };

    // 2b — the gape: the lower jaw stays down on the cloth while the head pitches up off it — the open mouth shows below
    if (P.gape > .001) {
      const jx = at(J.cx, 8), jy = at(J.cy, 8);
      ctx.fillStyle = ink; ctx.beginPath(); bodyPath(0, 30, 1.06, -lo.x * 1.2, -lo.y * 1.2 + .4, J); ctx.fill();
      ctx.lineWidth = 2.6; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.fillStyle = c(COL.jaw, jx, jy, 1.1); ctx.beginPath(); bodyPath(0, 30, 1.03, 0, 0, J); ctx.fill();
      // the inside: a deep red throat (darker towards the back), the pink tongue lying in it
      const mg = ctx.createLinearGradient(at(J.cx, 2), at(J.cy, 2), at(J.cx, 22), at(J.cy, 22));
      mg.addColorStop(0, c(COL.mouth, jx, jy, .9)); mg.addColorStop(1, c(COL.mouthD, jx, jy, 0));
      ctx.fillStyle = mg; ctx.beginPath(); bodyPath(1.8, 27, .8, 0, 0, J); ctx.fill();
      ctx.save(); ctx.translate(at(J.cx, 12), at(J.cy, 12)); ctx.scale(SC, SC * SQ); ctx.rotate(at(J.ph, 12));
      ctx.fillStyle = c(COL.tongue, jx, jy, 1.1); ctx.beginPath(); ctx.ellipse(0, 0, 5.6, 3.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(c('#FFC6CE', jx, jy, 1.2), .6); ctx.beginPath(); ctx.ellipse(1.6, -1.1, 2.2, 1.1, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(c(COL.mouthD, jx, jy, 0), .55); ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(4.2, 0); ctx.lineTo(-3.5, 0); ctx.stroke();
      ctx.restore();
    }
    // 2c — the tongue flick (under the snout: it comes out of the mouth)
    if (P.tongue > .01) {
      ctx.save(); headFrame();
      const L1 = 15.5 + 11 * P.tongue;
      ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = 4.6; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(L1, 0); ctx.stroke();
      ctx.strokeStyle = c(COL.tongue, HX, HY, 1); ctx.lineWidth = 3.0; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(L1, 0); ctx.stroke();
      ctx.fillStyle = c(COL.tongue, HX, HY, 1.2); ctx.beginPath(); ctx.arc(L1, 0, 2.3, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // 3 — body ink underlay: heavier on the side away from the bulb (a brushed, living line — boils on twos)
    const boil = Math.floor(Math.round(t * 30) / 2), bj = (rnd(boil * 1.7 + 3) - .5) * .45;
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineJoin = 'round';
    ctx.beginPath(); silhouette(1, -lo.x * 1.2 + bj * .4, -lo.y * 1.2 + .4); ctx.lineWidth = 2.5 + bj; ctx.stroke();

    // 4 — colour zones (gouache base), each lit where it sits
    const body = c(COL.body, X0, Y0, .9);
    ctx.fillStyle = body; ctx.beginPath(); silhouette(1); ctx.fill();
    {
      const p0x = at(cx, 0), p0y = at(cy, 0), p1x = at(cx, 56), p1y = at(cy, 56);
      const g = ctx.createLinearGradient(p0x, p0y, p1x, p1y), br = P.bright * .35, B = x => br > 0 ? mixc(x, 'rgb(255,214,120)', br) : x;
      g.addColorStop(0, B(c(COL.snout, p0x, p0y, 1))); g.addColorStop(.28, B(c(COL.head, hx, hy, 1))); g.addColorStop(.55, B(c(COL.jowl, hx, hy, .9)));
      g.addColorStop(.7, c(COL.neck, at(cx, 40), at(cy, 40), .8)); g.addColorStop(.86, body); g.addColorStop(1, body);
      ctx.fillStyle = g; ctx.beginPath(); bodyPath(0, 58); ctx.fill();
    }
    {
      const zone = (a, b, col) => { ctx.fillStyle = col; ctx.beginPath(); bodyPath(a, b, 1.04); ctx.fill(); };
      const ax = at(cx, 116), ay = at(cy, 116), pale = c(COL.pale, ax, ay, 1.2), band = c(COL.band, tx, ty, 1.45);
      const gp = ctx.createLinearGradient(at(cx, 102), at(cy, 102), at(cx, 113), at(cy, 113));
      gp.addColorStop(0, body); gp.addColorStop(1, pale);
      ctx.fillStyle = gp; ctx.beginPath(); bodyPath(102, 128, 1.04); ctx.fill();
      const gb = ctx.createLinearGradient(at(cx, 125), at(cy, 125), at(cx, 132), at(cy, 132));
      gb.addColorStop(0, pale); gb.addColorStop(1, band);
      ctx.fillStyle = gb; ctx.beginPath(); bodyPath(125, 178, 1.04); ctx.fill();
      zone(178, LEN, c(COL.tip, at(cx, 184), at(cy, 184), .9));
      const ringB = rgba(c(COL.body, ax, ay, .8), .85), ring = c(COL.ring, tx, ty, .8);
      ctx.fillStyle = ringB; ctx.beginPath(); for (const q0 of [110, 118]) bodyPath(q0, q0 + 2.2, 1.04); ctx.fill();
      ctx.fillStyle = ring; ctx.beginPath(); for (const q0 of [143, 154, 165]) bodyPath(q0, q0 + 2.4, 1.04); ctx.fill();
    }

    // 5 — gouache modelling, clipped to the body: flank darkening, form shadow away from the bulb, dorsal sheen, rim, texture
    ctx.save(); ctx.beginPath(); silhouette(1); ctx.clip();
    ctx.fillStyle = 'rgba(12,6,30,.26)'; ctx.beginPath(); silhouette(1); silhouette(.8); ctx.fill('evenodd');
    {
      const fx = X0 - lo.x * 70, fy = Y0 - lo.y * 70, nx = X0 + lo.x * 50, ny = Y0 + lo.y * 50, fa = .42 * Math.max(dirW, .2);
      const gfs = ctx.createLinearGradient(fx, fy, nx, ny); gfs.addColorStop(0, `rgba(10,5,26,${fa.toFixed(3)})`); gfs.addColorStop(1, 'rgba(10,5,26,0)');
      ctx.fillStyle = gfs; ctx.fillRect(X0 - 110, Y0 - 140, 230, 280);
      ctx.fillStyle = `rgba(10,5,26,${(fa * .45).toFixed(3)})`; ctx.beginPath(); silhouette(1); silhouette(1, lo.x * 4, lo.y * 4); ctx.fill('evenodd');
    }
    ctx.globalCompositeOperation = 'screen';
    const shA = cl(.3 + 1.6 * lk * on + .7 * lv, 0, 1), shC = c(COL.bodyHi, X0, Y0, 1);
    for (const [k, a] of [[.46, .16], [.22, .22]]) {
      ctx.fillStyle = rgba(shC, a * shA); ctx.beginPath(); bodyPath(4, 104, k, lo.x * 1.4, lo.y * 1.4); bodyPath(106, 176, k * .85, lo.x * 1.1, lo.y * 1.1); ctx.fill();
    }
    // the lump going down: a round glint on it, so it reads as a volume (a letter in the throat)
    if (P.bulge > .3) {
      const bx = at(cx, P.bulgeS), by = at(cy, P.bulgeS), r = (6 + P.bulge * 1.1) * SC, ka = cl(P.bulge / 5);
      ctx.globalCompositeOperation = 'source-over';
      const gs = ctx.createRadialGradient(bx, by, r * .55, bx, by, r * 1.15);              // the lump's own form shadow (a ring)
      gs.addColorStop(0, 'rgba(20,6,30,0)'); gs.addColorStop(.5, `rgba(20,6,30,${(.3 * ka).toFixed(3)})`); gs.addColorStop(1, 'rgba(20,6,30,0)');
      ctx.fillStyle = gs; ctx.fillRect(bx - r * 1.2, by - r * 1.2, 2.4 * r, 2.4 * r);
      ctx.globalCompositeOperation = 'screen';
      const gl = ctx.createRadialGradient(bx + lo.x * 3 - 1, by + lo.y * 3 - 3, 0, bx, by - 1, r * .9);
      gl.addColorStop(0, rgba(c(COL.hi, bx, by, 1.2), .7 * ka)); gl.addColorStop(1, rgba(c(COL.hi, bx, by, 1.2), 0));
      ctx.fillStyle = gl; ctx.fillRect(bx - r, by - r, 2 * r, 2 * r);
    }
    if (dirW > .02) {
      const rimA = cl(.35 + 2.2 * lk) * dirW;
      ctx.fillStyle = rgba(c(COL.rim, hx, hy, 1.15), .7 * rimA); ctx.beginPath(); silhouette(1); silhouette(1, -lo.x * 2.6, -lo.y * 2.6); ctx.fill('evenodd');
    }
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .45;
    PAT.setTransform(new DOMMatrix().translate(X0, Y0).scale(SC, SC * SQ).rotate(TH / D2R));
    ctx.fillStyle = PAT; ctx.fillRect(X0 - 110, Y0 - 140, 230, 280);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(c(COL.fleck, X0, Y0, 1), .38);                // pale cobalt flecks on the back
    ctx.beginPath();
    for (const fl of FLECKS) {
      const s = fl.s, x = at(cx, s), y = at(cy, s), ww = at(A.w, s) * fl.l, a = at(A.ph, s), ex = x - Math.sin(a) * ww * SC, ey = y + Math.cos(a) * ww * SC * SQ;
      ctx.moveTo(ex + fl.r * 1.4, ey); ctx.ellipse(ex, ey, fl.r * 1.4, fl.r, a, 0, TAU);
    }
    ctx.fill();
    ctx.restore();

    // 6 — the thin top ink line
    ctx.strokeStyle = rgba(ink, .9); ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    ctx.beginPath(); silhouette(1); ctx.stroke();

    // 7 — nuchal crest + neck folds (screen space, along the spine)
    ctx.fillStyle = ink; ctx.strokeStyle = rgba(ink, .75); ctx.lineCap = 'round';
    ctx.beginPath(); for (let k = 0; k <= 12; k++) { const s = 33 + k * 1.8; k ? ctx.lineTo(at(cx, s), at(cy, s)) : ctx.moveTo(at(cx, s), at(cy, s)); }
    ctx.strokeStyle = rgba(ink, .2); ctx.lineWidth = 3.2; ctx.stroke(); ctx.strokeStyle = rgba(ink, .32); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = rgba(c(COL.snout, at(cx, 40), at(cy, 40), 1.1), .32); ctx.beginPath();
    for (let k = 0; k < 5; k++) { const s = 35 + k * 4, x = at(cx, s) + lo.x * .5, y = at(cy, s) + lo.y * .5, r = .75 - k * .08; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
    ctx.fill();
    ctx.lineWidth = .8; ctx.strokeStyle = rgba(ink, .32);
    for (const s of [41]) for (const sd of [-1, 1]) {
      const x = at(cx, s), y = at(cy, s), a = at(A.ph, s), ww = at(A.w, s) * .95 * SC, nx = -Math.sin(a) * sd, ny = Math.cos(a) * sd * SQ, fx = Math.cos(a), fy = Math.sin(a) * SQ;
      ctx.beginPath(); ctx.moveTo(x + nx * ww * .5, y + ny * ww * .5); ctx.quadraticCurveTo(x + nx * ww * .82 - fx * 1.6, y + ny * ww * .82 - fy * 1.6, x + nx * ww, y + ny * ww); ctx.stroke();
    }

    // 8 — head details in the head's own frame
    ctx.save();
    headFrame();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = rgba(ink, .82); ctx.beginPath();
    for (const sd of [-1, 1]) { ctx.ellipse(12.4, sd * 3.4, 1.15, .7, sd * .5, 0, TAU); ctx.closePath(); ctx.ellipse(-15.2, sd * 10.6, 2.4, 1.6, sd * .25, 0, TAU); ctx.closePath(); }
    ctx.fill();
    ctx.strokeStyle = rgba(ink, .85); ctx.lineWidth = .9; ctx.beginPath();
    for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { ctx.moveTo(-16.5 - k * 1.4, sd * (11.9 + k * .15)); ctx.lineTo(-18.2 - k * 1.5, sd * (13.9 + k * .3)); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgba(c(COL.hi, HX, HY, 1.15), .45 * shA); ctx.beginPath(); ctx.ellipse(1 + lo.x * 2, 0, 7, 2.6, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // the eyes: bulging domes on the sides of the head; pupils on the target; lids & brows act (both eyes per pass)
    const eyeC = c(COL.eye, HX, HY, 1.15), irisC = c(COL.iris, HX, HY, .9), pupC = c(COL.pupil, HX, HY, 0), lidC = c(COL.head, HX, HY, .9), lidHi = c(COL.snout, HX, HY, 1.15);
    const catch_ = cl(.45 + 1.8 * lk * on + .6 * lv), es = 1 + .2 * P.wide, rx = 4.7 * es, ry = 4.1 * es, ex = .3;
    const la2 = P.look * .9, pr = 2.5 * (1 - .3 * P.wide), pd = 1.9 * es, SDS = [-1, 1];
    const pup = sd => ({ x: ex + Math.cos(la2) * pd, y: sd * 9.6 + Math.sin(la2) * pd + sd * .45 });
    const pass = (fill, fn) => { ctx.beginPath(); for (const sd of SDS) fn(sd, sd * 9.6); fill ? ctx.fill() : ctx.stroke(); };
    ctx.fillStyle = lidC; pass(1, (sd, ey) => { ctx.ellipse(ex - .3, ey + sd * .3, rx + 1.7, ry + 1.5, 0, 0, TAU); ctx.closePath(); });     // skin bulge
    ctx.strokeStyle = rgba(ink, .75); ctx.lineWidth = 1.1;
    pass(0, (sd, ey) => { const a0 = sd * Math.PI / 2 - 1.4; ctx.moveTo(ex - .3 + Math.cos(a0) * (rx + 1.7), ey + sd * .3 + Math.sin(a0) * (ry + 1.5)); ctx.ellipse(ex - .3, ey + sd * .3, rx + 1.7, ry + 1.5, 0, a0, a0 + 2.8); });
    ctx.save(); ctx.beginPath(); for (const sd of SDS) { ctx.ellipse(ex, sd * 9.6, rx, ry, 0, 0, TAU); ctx.closePath(); } ctx.clip();
    ctx.fillStyle = eyeC; ctx.fillRect(ex - rx - 1, -9.6 - ry - 1, 2 * rx + 2, 19.2 + 2 * ry + 2);
    ctx.fillStyle = irisC; pass(1, sd => { const q = pup(sd); ctx.moveTo(q.x + pr + .9, q.y); ctx.arc(q.x, q.y, pr + .9, 0, TAU); });
    ctx.fillStyle = pupC; pass(1, sd => { const q = pup(sd); ctx.moveTo(q.x + pr, q.y); ctx.arc(q.x, q.y, pr, 0, TAU); });
    ctx.fillStyle = 'rgba(30,14,30,.28)'; pass(1, (sd, ey) => { ctx.ellipse(ex - 1.3, ey - sd * 2.6, rx, ry * .65, 0, 0, TAU); ctx.closePath(); });   // the dome's own shade
    ctx.fillStyle = `rgba(255,250,236,${(.95 * catch_).toFixed(3)})`;
    pass(1, sd => { const q = pup(sd), x = q.x + 1.1 + lo.x * .4, y = q.y - sd * .2 - .9; ctx.moveTo(x + .95, y); ctx.arc(x, y, .95, 0, TAU); });
    if (P.lid > .01) {   // the upper lid slides over the top of the eyeball: from above, from the inner side outwards
      const L1 = cl(P.lid), bow = 1.8 * (1 - L1);
      const e0 = (sd, ey) => ey - sd * (ry + .5), e1 = (sd, ey) => e0(sd, ey) + sd * (2 * ry + 1) * L1;
      ctx.fillStyle = lidC;
      pass(1, (sd, ey) => { const a = e0(sd, ey), b = e1(sd, ey); ctx.moveTo(ex - rx - 2, a - sd * 2); ctx.lineTo(ex + rx + 2, a - sd * 2); ctx.lineTo(ex + rx + 2, b - sd * .5); ctx.quadraticCurveTo(ex, b + sd * bow, ex - rx - 2, b - sd * .5); ctx.closePath(); });
      ctx.strokeStyle = rgba(lidHi, .5); ctx.lineWidth = 1;
      pass(0, (sd, ey) => { const b = e1(sd, ey); ctx.moveTo(ex - rx * .55, b - sd * 1.6); ctx.quadraticCurveTo(ex, b - sd * 1.6 + sd * bow * .8, ex + rx * .55, b - sd * 1.6); });
      ctx.strokeStyle = ink; ctx.lineWidth = 1.25;
      pass(0, (sd, ey) => { const b = e1(sd, ey); ctx.moveTo(ex - rx - 2, b - sd * .5); ctx.quadraticCurveTo(ex, b + sd * bow, ex + rx + 2, b - sd * .5); });
    }
    ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.05; pass(0, (sd, ey) => { ctx.moveTo(ex + rx, ey); ctx.ellipse(ex, ey, rx, ry, 0, 0, TAU); });
    if (P.squeeze > .05) {   // eyes squeezed shut while he swallows: crow's-feet creases
      ctx.strokeStyle = rgba(ink, .9 * P.squeeze); ctx.lineWidth = 1.4;
      pass(0, (sd, ey) => { for (const a of [-.5, 0, .5]) { const r0 = rx + 2.2, r1 = rx + 4.6; ctx.moveTo(ex - Math.cos(a) * r0, ey + Math.sin(a) * r0 * sd); ctx.lineTo(ex - Math.cos(a) * r1, ey + Math.sin(a) * r1 * sd); } });
    }
    const bf = Math.max(0, P.brow), bu = Math.max(0, -P.brow);
    ctx.lineWidth = 1.5 + .8 * bf;
    pass(0, (sd, ey) => {
      ctx.moveTo(ex + 1.2 + 2.6 * bf - 1.6 * bu, ey - sd * (ry + 1.0 - 1.6 * bf + .6 * bu));
      ctx.quadraticCurveTo(ex - rx - 1.6 - 1.8 * bu, ey - sd * (ry + .9 + .4 * bu), ex - rx - 1.2 - 1.2 * bu, ey + sd * (ry * .55 - .2 * bf));
    });
    ctx.restore();

    // 9 — the hic: a small dust puff out of the mouth, drifting forward and up, fading
    if (P.puff >= 0 && P.puff < .9) {
      const m = mouthOf(P), a = at(A.ph, 4), fx = Math.cos(a), fy = Math.sin(a) * SQ, fn = Math.hypot(fx, fy) || 1, dx = fx / fn, dy = fy / fn;
      const PF = [[0, 0, 1], [.03, -.9, .8], [.05, .9, .75], [.08, -.2, .6], [.1, .4, .5]];   // delay, spread, size
      for (let j = 0; j < PF.length; j++) {
        const [dl, sp, sz] = PF[j], u = kk(P.puff, .03 + dl, .78 + dl); if (u <= 0 || u >= 1) continue;
        const e = eo(u), r = (3 + 9 * e) * sz + 1.5;
        const dist = (6 + 26 * e) * (1 - .25 * j / PF.length), px = m.x + dx * dist - dy * sp * 9 * e, py = m.y + dy * dist + dx * sp * 9 * e - 14 * e;
        const al = .85 * Math.pow(1 - u, 1.25), col = c(COL.dust, px, py, 1.3);
        const gr = ctx.createRadialGradient(px - r * .25, py - r * .3, 0, px, py, r);
        gr.addColorStop(0, rgba(col, al)); gr.addColorStop(.55, rgba(col, al * .8)); gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
    P.mouth = toW(mouthOf(P));
    return P;
  }

  /** the mouth at t (world px), without drawing */
  let MC = { t: NaN, m: null };
  function mouth(t) {
    if (MC.t === t) return MC.m;
    build();
    const P = pose(t); solve(P);
    MC = { t, m: toW(mouthOf(P)) }; return MC.m;
  }
  /** true when the lizard itself moves fast enough to deserve its own 2-tap motion blur (head snaps stay crisp) */
  function moving(t) { build(); return pose(t).mv; }

  return { draw, pose: t => { build(); return pose(t); }, mouth, moving };
})();

/** the margouillat. Stills (MB = 1) draw at t. With motion blur on (window.MB > 1) every sub-frame draws him directly
 *  (≈ 1.3 ms) at a quantized time: the frame's own time while he holds still (crisp), n − ¼ or n + ¼ while he moves
 *  (a 2-tap blur of his own), so his saccades stay snappy instead of smearing. Returns the pose. */
function K_gecko(t, L, g) {
  if (!(window.MB > 1)) return K_.draw(t, L);
  const f = t * 30, n = Math.round(f);
  return K_.draw(K_.moving(n / 30) ? (Math.floor(2 * f) / 2 + .25) / 30 : n / 30, L);
}
function K_mouth(t) { return K_.mouth(t); }
function K_geckoPose(t) { return K_.pose(t); }

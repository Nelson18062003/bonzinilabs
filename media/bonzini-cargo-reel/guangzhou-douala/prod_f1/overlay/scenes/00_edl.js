'use strict';
// =============================================================================================
// 00_edl.js — THE MULTI-CLIP EDIT CORE (node + browser). Everything here is a pure function of the film time t and touches
// no canvas: the score (01_score.js) builds its EDL with EDL.build(cfg) and gets back need(t) / needs() (frames to decode
// and to prepare), active(t) (what is on screen and how each shot moves), overlays(t) (doors, flash, seams), shutter /
// CUTS (motion blur that never straddles a hard cut), ambience() (the clips' own sound, speed-matched) and audit() (the
// checks of tools/check_score.js). 05_footage.js draws exactly what active(t) / overlays(t) say.
//
// SHOT  {id, clip, t0, t1,                    film seconds; the shot owns [t0, t1) (+ the overlap of its transitions)
//        src:  {in, speed = 1}                src = in + (t − t0)·speed   (speed 0 = freeze, < 0 = reverse)
//            | {keys: [[t, src]…], interp: 'smooth' | 'linear', rel}   film t (absolute; rel: true = from t0) → source s.
//                                             'smooth' = monotone cubic (no overshoot: a ramp never runs backwards)
//            | function (t) → src seconds
//        blend: true                          slow motion: crossfade the two neighbour frames when |speed| < .95
//        crop: {cx, cy, w | h | zoom} | [[t, {…}]…] | {keys, interp: 'ease' | 'smooth' | 'linear'} | function (t)
//                                             SOURCE DISPLAY px (after autorotation). The window has the aspect of the
//                                             shot's screen region (9:16 full, 9:8 top/bottom, any for windows / cards);
//                                             zoom = relative to the largest such window. w is interpolated in log space.
//                                             clamp: true (default) keeps the window inside the source (audit reports it)
//        rot:  deg | [[t, deg]…] | function   rotation of the footage inside its region (tilted footage, dutch angle)
//        layout: 'full' | 'top' | 'bottom' | 'left' | 'right'
//              | {kind: 'window', x, y, w, h, r, border, borderColor, shadow}       a cinema window / inset (screen px)
//              | {kind: 'card', x, y, w, h, tilt, border, shadow, r}               a photo card (content rect, tilt deg)
//              | function (t) → one of these                                       animated layout
//        hide: [{t0, t1, box: [x, y, w, h] | keys: [[s, [x, y, w, h]]…], kind: 'mosaic' | 'blur' | 'cover',
//                color, cells, strength, pad, r, on: 'src' | 'film'}]   SOURCE px; t0 / t1 / keys in SOURCE seconds by
//                                             default (glued to the frames: a re-timed shot keeps its boxes), on: 'film'
//                                             = film seconds. cfg.hide[clip] applies to every shot of that clip.
//        grade: {exposure (stops), contrast (−1…1), sat (×), warmth (−1…1), vignette (0…1), tint: [css, a]} | function
//                                             merged over cfg.grade (the series look)
//        in / out: 'cut' | {type: 'whip', dir, dur} | {type: 'flash', dur} | {type: 'doors', dur, color, logo}
//                | {type: 'slide', dir, dur} | {type: 'iris', dur, cx, cy} | {type: 'fade', dur}
//                                             `in` pairs with the shot(s) that END at this t0 in an overlapping region
//                                             (or in.from: [ids]): whip / doors / flash switch AT t0 (no overlap); slide,
//                                             iris, fade are centred on t0 (both shots drawn dur/2 either side). `out`
//                                             is used only when no following shot links it (the shot leaves alone).
//        shake: [[t, amp px, hz = 11]…]       damped shakes (a slam, a stamp)     cam: function (t) → {dx, dy, s, r}
//        amb: false | {mode: 'hold' | 'match', g: dB, in}   the clip's own sound under the shot (lib/mix.py): 'hold' =
//                                             real time from the shot's first source time; 'match' = follows the picture's
//                                             time map (varispeed: ramps, slow motion, reverse; freezes fade out)
//        z }                                  draw order (default: the order of cfg.shots; later = on top)
// =============================================================================================
(function () {
const FPS = 30, SW = 1080, SH = 1920;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
const EASE = {
  linear: x => cl(x),
  inOut: x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  inOutSine: x => .5 - .5 * Math.cos(Math.PI * cl(x)),
  out: x => 1 - Math.pow(1 - cl(x), 3), in: x => Math.pow(cl(x), 3),
  outQuart: x => 1 - Math.pow(1 - cl(x), 4), inQuad: x => cl(x) * cl(x),
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)),
};
const DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const R6 = x => Math.round(x * 1e6) / 1e6;

// ---------------------------------------------------------------------------------------------------------------------
// interpolation
// ---------------------------------------------------------------------------------------------------------------------
/** monotone cubic Hermite (Fritsch–Carlson) through [[x, y]…]; linear extrapolation with the end chords */
function monotone(keys) {
  const xs = keys.map(k => +k[0]), ys = keys.map(k => +k[1]), n = xs.length;
  if (n === 1) return () => ys[0];
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const q = 3 / Math.sqrt(s); m[i] = q * a * d[i]; m[i + 1] = q * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0] + d[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + d[n - 2] * (x - xs[n - 1]);
    let i = 0; while (i < n - 2 && x >= xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}
function linearK(keys, extrapolate = true) {
  const n = keys.length;
  return x => {
    if (n === 1) return +keys[0][1];
    let i = 0; while (i < n - 2 && x >= keys[i + 1][0]) i++;
    const [x0, y0] = keys[i], [x1, y1] = keys[i + 1];
    const u = (x - x0) / (x1 - x0);
    return extrapolate ? y0 + (y1 - y0) * u : y0 + (y1 - y0) * cl(u);
  };
}
/** eased segments between keys (each move starts and lands softly), held before the first / after the last key */
function easeK(keys, ease = EASE.inOut) {
  const n = keys.length;
  return x => {
    if (n === 1 || x <= keys[0][0]) return +keys[0][1];
    if (x >= keys[n - 1][0]) return +keys[n - 1][1];
    let i = 0; while (i < n - 2 && x >= keys[i + 1][0]) i++;
    return lerp(+keys[i][1], +keys[i + 1][1], ease(kk(x, keys[i][0], keys[i + 1][0])));
  };
}
function scalarFn(keys, interp) {
  if (interp === 'smooth') return monotone(keys);
  if (interp === 'linear') return linearK(keys, false);
  return easeK(keys);
}
/** keys of objects [[t, {a, b…}]…] → t → object; fields listed in LOG are interpolated in log space (zoom reads even) */
const LOG = { w: 1, h: 1, zoom: 1 };
function objKeys(keys, interp = 'ease') {
  const fields = [...new Set(keys.flatMap(k => Object.keys(k[1] || {})))];
  const fns = {};
  for (const f of fields) {
    const ks = keys.filter(k => k[1] && typeof k[1][f] === 'number').map(k => [k[0], LOG[f] ? Math.log(k[1][f]) : k[1][f]]);
    if (!ks.length) continue;
    const g = scalarFn(ks, interp); fns[f] = LOG[f] ? (t => Math.exp(g(t))) : g;
  }
  return t => { const o = {}; for (const f in fns) o[f] = fns[f](t); return o; };
}

// ---------------------------------------------------------------------------------------------------------------------
// layouts (screen regions)
// ---------------------------------------------------------------------------------------------------------------------
const NAMED = {
  full: { kind: 'full', x: 0, y: 0, w: SW, h: SH },
  top: { kind: 'top', x: 0, y: 0, w: SW, h: SH / 2 }, bottom: { kind: 'bottom', x: 0, y: SH / 2, w: SW, h: SH / 2, seam: true },
  left: { kind: 'left', x: 0, y: 0, w: SW / 2, h: SH }, right: { kind: 'right', x: SW / 2, y: 0, w: SW / 2, h: SH, seam: true },
};
function normLayout(l) {
  if (!l) return NAMED.full;
  if (typeof l === 'string') { if (!NAMED[l]) throw new Error(`EDL: unknown layout « ${l} »`); return NAMED[l]; }
  const kind = l.kind || (l.tilt !== undefined ? 'card' : 'window');
  if (NAMED[kind] && l.x === undefined) return Object.assign({}, NAMED[kind], l);
  const o = Object.assign({ kind, x: 0, y: 0, w: SW, h: SH, r: kind === 'card' ? 10 : 28, border: kind === 'card' ? 18 : 0, shadow: .55, tilt: 0 }, l);
  return o;
}
function layoutFn(spec) {
  if (typeof spec === 'function') return t => normLayout(spec(t));
  const L = normLayout(spec); return () => L;
}
const rectOf = R => ({ x: R.x, y: R.y, w: R.w, h: R.h });
function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
const sameRect = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h) < 1;

// ---------------------------------------------------------------------------------------------------------------------
// transitions
// ---------------------------------------------------------------------------------------------------------------------
const TR_DEF = {
  cut: {}, whip: { dir: 'left', dur: .30, travel: .62, smear: .42 }, flash: { dur: .30, color: '#FFF4E2' },
  doors: { dur: .80, color: '#3D4650', logo: false }, slide: { dir: 'left', dur: .45 }, iris: { dur: .60, ring: true },
  fade: { dur: .40 },
};
const OVERLAP = { slide: true, iris: true, fade: true };          // both shots drawn across the window (centred on the cut)
function normTr(x) {
  if (!x || x === 'cut') return null;
  const o = typeof x === 'string' ? { type: x } : Object.assign({}, x);
  if (!TR_DEF[o.type]) throw new Error(`EDL: unknown transition « ${o.type} »`);
  if (o.type === 'cut') return null;
  return Object.assign({}, TR_DEF[o.type], o);
}
const extentOf = (R, ux) => ux ? R.w : R.h;
/** how far a slide travels: a pane slides by its own extent; a window / card from beyond the screen edge */
function travelOf(R, ux, uy) {
  if (NAMED[R.kind]) return ux ? R.w : R.h;
  const m = 90 + .5 * Math.hypot(R.w, R.h) * Math.abs(Math.sin((R.tilt || 0) * Math.PI / 180));
  if (ux > 0) return R.x + R.w + m; if (ux < 0) return SW - R.x + m; if (uy < 0) return SH - R.y + m; return R.y + R.h + m;
}

// ---------------------------------------------------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------------------------------------------------
function build(cfg) {
  const CLIPS = cfg.clips || {}, HIDE = cfg.hide || {}, MUST = cfg.mustHide || {}, GRADE0 = cfg.grade || {};
  const shots = cfg.shots.map((s, i) => normShot(s, i));
  const byId = {}; for (const s of shots) { if (byId[s.id]) throw new Error(`EDL: duplicate shot id ${s.id}`); byId[s.id] = s; }

  function srcFn(spec, t0) {
    if (typeof spec === 'function') return spec;
    if (Array.isArray(spec)) spec = { keys: spec };
    if (spec && spec.keys) {
      const ks = spec.keys.map(k => [k[0] + (spec.rel ? t0 : 0), k[1]]);
      return spec.interp === 'linear' ? linearK(ks, true) : monotone(ks);
    }
    const a = (spec && spec.in) || 0, v = spec && spec.speed !== undefined ? spec.speed : 1;
    return t => a + (t - t0) * v;
  }
  function cropFn(spec, t0) {
    if (typeof spec === 'function') return spec;
    if (Array.isArray(spec)) spec = { keys: spec };
    if (spec && spec.keys) return objKeys(spec.keys.map(k => [k[0] + (spec.rel ? t0 : 0), k[1]]), spec.interp || 'ease');
    const o = Object.assign({}, spec || {}); return () => o;
  }
  function scalarSpec(spec, t0, dflt = 0) {
    if (spec === undefined || spec === null) return () => dflt;
    if (typeof spec === 'function') return spec;
    if (typeof spec === 'number') return () => spec;
    const ks = (Array.isArray(spec) ? spec : spec.keys).map(k => [k[0] + (spec.rel ? t0 : 0), k[1]]);
    return scalarFn(ks, spec.interp || 'ease');
  }
  function normHide(h, owner) {
    const o = Object.assign({ kind: 'mosaic', on: 'src', owner }, h);
    if (o.keys) { const ks = o.keys; const n = ks.length;
      o.boxAt = s => { if (s <= ks[0][0]) return ks[0][1]; if (s >= ks[n - 1][0]) return ks[n - 1][1];
        let i = 0; while (i < n - 2 && s >= ks[i + 1][0]) i++; const u = (s - ks[i][0]) / (ks[i + 1][0] - ks[i][0]);
        return ks[i][1].map((v, j) => lerp(v, ks[i + 1][1][j], u)); };
      if (o.t0 === undefined) o.t0 = ks[0][0]; if (o.t1 === undefined) o.t1 = ks[n - 1][0];
    } else { const b = o.box; o.boxAt = () => b; }
    o.activeAt = (s, t) => { const x = o.on === 'film' ? t : s; return (o.t0 === undefined || x >= o.t0 - 1e-6) && (o.t1 === undefined || x <= o.t1 + 1e-6); };
    return o;
  }
  function normShot(s, i) {
    const c = CLIPS[s.clip];
    if (!c) throw new Error(`EDL: shot ${s.id}: clip « ${s.clip} » not in data/clips.json (run tools/prep_clips.py --index)`);
    const o = Object.assign({}, s, { i, z: s.z !== undefined ? s.z : i, dims: { w: c.w, h: c.h }, dur: c.dur,
      nf: c.frames || Math.floor(c.dur * FPS + 1e-6) });
    o.srcAt = srcFn(s.src, s.t0);
    o.layoutAt = layoutFn(s.layout);
    o.rawCrop = cropFn(s.crop, s.t0);
    o.rotAt = scalarSpec(s.rot, s.t0, 0);
    o.clamp = s.clamp !== false;
    o.hides = [...(HIDE[s.clip] || []).map(h => normHide(h, 'clip')), ...(s.hide || []).map(h => normHide(h, s.id))];
    const g = s.grade; o.gradeAt = typeof g === 'function' ? (t => Object.assign({}, GRADE0, g(t))) : (() => Object.assign({}, GRADE0, g || {}));
    o.trIn = normTr(s.in); o.trOut = normTr(s.out);
    o.shakes = (s.shake || []).map(q => ({ t: q[0], amp: q[1], hz: q[2] || 11 }));
    return o;
  }
  /** the crop window at t (SOURCE px) for region R: {cx, cy, w, h, rot, asp, clamped (px moved), fits} */
  function cropAt(s, t, R) {
    R = R || s.layoutAt(t);
    const asp = s.aspect || R.w / R.h, D = s.dims, raw = s.rawCrop(t) || {};
    const cover = Math.min(D.w, D.h * asp);
    let w = raw.w !== undefined ? raw.w : raw.h !== undefined ? raw.h * asp : cover / (raw.zoom || 1);
    let h = w / asp, cx = raw.cx !== undefined ? raw.cx : D.w / 2, cy = raw.cy !== undefined ? raw.cy : D.h / 2;
    const rot = s.rotAt(t) || 0, a = rot * Math.PI / 180, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    const bw = w * ca + h * sa, bh = w * sa + h * ca;                     // the rotated window's bounding box
    let moved = 0; const fits = bw <= D.w + .5 && bh <= D.h + .5;
    if (s.clamp && fits) {
      const nx = cl(cx, bw / 2, D.w - bw / 2), ny = cl(cy, bh / 2, D.h - bh / 2);
      moved = Math.hypot(nx - cx, ny - cy); cx = nx; cy = ny;
    }
    return { cx, cy, w, h, rot, asp, moved, fits };
  }
  // ---- link the transitions ----
  const CUTS0 = [];
  for (const B of shots) {
    B.win = [B.t0, B.t1];
    if (!B.trIn) { if (B.t0 > 1e-9) CUTS0.push(B.t0); continue; }
    const tr = B.trIn; tr.t = B.t0;
    const RB = rectOf(B.layoutAt(B.t0 + 1e-4));
    const partners = tr.from ? tr.from.map(id => byId[id]).filter(Boolean)
      : shots.filter(P => P !== B && Math.abs(P.t1 - B.t0) < 1e-6 && overlapArea(rectOf(P.layoutAt(P.t1 - 1e-4)), RB) > 0);
    tr.partners = partners.map(P => P.id); tr.linked = partners.length > 0;
    for (const P of partners) P.outLink = Object.assign({}, tr, { to: B.id, same: sameRect(rectOf(P.layoutAt(P.t1 - 1e-4)), RB) });
    if (tr.type === 'doors' || tr.type === 'flash') CUTS0.push(B.t0);    // the switch happens behind closed doors / white
  }
  for (const S of shots) {
    if (S.trIn && OVERLAP[S.trIn.type] && S.trIn.linked) S.win[0] = S.t0 - S.trIn.dur / 2;
    if (S.outLink && OVERLAP[S.outLink.type]) S.win[1] = S.t1 + S.outLink.dur / 2;
    if (S.trOut && !S.outLink) S.trOut.t = S.t1; else S.trOut = null;
  }
  const extraCuts = (cfg.cuts || []).slice();
  const CUTS = () => [...new Set([...CUTS0, ...extraCuts].map(R6))].sort((a, b) => a - b);

  // ---- per-shot motion (screen px) ----
  function fxOf(s, t, R) {
    const fx = { dx: 0, dy: 0, sc: 1, rot: 0, smear: 0, ux: 1, uy: 0, mirror: false, expo: 0, alpha: 1, iris: null, edge: null };
    const add = o => { if (!o) return; for (const k of ['dx', 'dy', 'expo']) if (o[k]) fx[k] += o[k];
      if (o.sc) fx.sc *= o.sc; if (o.alpha !== undefined) fx.alpha *= o.alpha; if (o.mirror) fx.mirror = true;
      if (o.smear && o.smear > fx.smear) { fx.smear = o.smear; fx.ux = o.ux; fx.uy = o.uy; }
      if (o.iris) fx.iris = o.iris; if (o.edge) fx.edge = o.edge; };
    if (s.trIn) add(trIn(s.trIn, t, R));
    if (s.outLink) add(trOutLinked(s.outLink, t, R));
    if (s.trOut) add(trOutSolo(s.trOut, t, R));
    for (const q of s.shakes) { const d = t - q.t; if (d >= 0 && d < .6) { const a = q.amp * Math.exp(-d * 9); fx.dx += a * .7 * Math.sin(d * q.hz * 6.283 + 1.3); fx.dy += a * Math.cos(d * q.hz * 6.283); } }
    if (s.cam) { const c = s.cam(t) || {}; fx.dx += c.dx || 0; fx.dy += c.dy || 0; fx.sc *= c.s || 1; fx.rot += c.r || 0; }
    return fx;
  }
  function slideE(p) { return EASE.outQuart(p); }
  function slideV(p) { return 4 * Math.pow(1 - cl(p), 3); }               // d(outQuart)/dp
  function trIn(tr, t, R) {
    const d = tr.dur, t0 = tr.t, [ux, uy] = DIR[tr.dir || 'left'] || DIR.left;
    if (tr.type === 'whip') {
      if (t >= t0 + d / 2) return null;
      const q = 1 - kk(t, t0, t0 + d / 2), D = extentOf(R, ux) * tr.travel, e = Math.pow(q, 2.2);
      return { dx: -ux * D * e, dy: -uy * D * e, smear: tr.smear * extentOf(R, ux) * Math.pow(q, 1.3), ux, uy, mirror: true, expo: .45 * q * q, sc: 1 + .05 * q };
    }
    if (tr.type === 'slide') {
      const a = tr.linked ? t0 - d / 2 : t0, p = kk(t, a, a + d); if (p >= 1) return null;
      const X = travelOf(R, ux, uy), off = (1 - slideE(p)) * X, v = slideV(p) * X / d;
      return { dx: -ux * off, dy: -uy * off, smear: v * .5 / FPS * .7, ux, uy, edge: { ux, uy, off, a: 1 - p } };
    }
    if (tr.type === 'iris') {
      const a = tr.linked ? t0 - d / 2 : t0, p = kk(t, a, a + d); if (p >= 1) return null;
      const cx = tr.cx !== undefined ? tr.cx : R.x + R.w / 2, cy = tr.cy !== undefined ? tr.cy : R.y + R.h / 2;
      const far = Math.max(...[[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
      return { iris: { cx, cy, r: Math.max(0, EASE.inOut(p) * (far + 30)), ring: tr.ring, p } };
    }
    if (tr.type === 'fade') { const a = tr.linked ? t0 - d / 2 : t0; return { alpha: EASE.inOutSine(kk(t, a, a + d)) }; }
    if (tr.type === 'doors' || tr.type === 'flash') { const k = 1 - kk(t, t0, t0 + d * .5); return k > 0 ? { expo: tr.type === 'flash' ? .5 * k * k : 0 } : null; }
    return null;
  }
  function trOutLinked(tr, t, R) {
    const d = tr.dur, t0 = tr.t, [ux, uy] = DIR[tr.dir || 'left'] || DIR.left;
    if (tr.type === 'whip') {
      if (t < t0 - d / 2) return null;
      const p = kk(t, t0 - d / 2, t0), D = extentOf(R, ux) * tr.travel, e = Math.pow(p, 2.2);
      return { dx: ux * D * e, dy: uy * D * e, smear: tr.smear * extentOf(R, ux) * Math.pow(p, 1.3), ux, uy, mirror: true, expo: .45 * p * p, sc: 1 + .05 * p };
    }
    if (tr.type === 'slide') {
      if (t < t0 - d / 2) return null;
      const p = kk(t, t0 - d / 2, t0 + d / 2), e = slideE(p);
      return tr.same ? { dx: ux * .30 * e * extentOf(R, ux), dy: uy * .30 * e * extentOf(R, ux), mirror: true, expo: -.55 * e } : { expo: -.35 * e };
    }
    if (tr.type === 'iris') { if (t < t0 - d / 2) return null; return { expo: -.30 * kk(t, t0 - d / 2, t0 + d / 2) }; }
    if (tr.type === 'flash') { const k = kk(t, t0 - d * .35, t0); return k > 0 ? { expo: .6 * k * k } : null; }
    return null;
  }
  function trOutSolo(tr, t, R) {
    const d = tr.dur, t1 = tr.t, [ux, uy] = DIR[tr.dir || 'left'] || DIR.left;
    if (tr.type === 'whip') { if (t < t1 - d / 2) return null; const p = kk(t, t1 - d / 2, t1), D = extentOf(R, ux) * tr.travel, e = Math.pow(p, 2.2);
      return { dx: ux * D * e, dy: uy * D * e, smear: tr.smear * extentOf(R, ux) * Math.pow(p, 1.3), ux, uy, mirror: false, expo: .3 * p * p }; }
    if (tr.type === 'slide') { if (t < t1 - d) return null; const p = kk(t, t1 - d, t1), X = travelOf(R, ux, uy), e = EASE.in(p);
      return { dx: ux * X * e, dy: uy * X * e, smear: 3 * p * p * X / d * .5 / FPS * .7, ux, uy, edge: { ux: -ux, uy: -uy, off: X * e, a: p } }; }
    if (tr.type === 'iris') { if (t < t1 - d) return null; const p = kk(t, t1 - d, t1);
      const cx = tr.cx !== undefined ? tr.cx : R.x + R.w / 2, cy = tr.cy !== undefined ? tr.cy : R.y + R.h / 2;
      return { iris: { cx, cy, r: (1 - EASE.inOut(p)) * (Math.hypot(R.w, R.h) / 2 + 30), ring: tr.ring, p: 1 - p } }; }
    if (tr.type === 'fade') { if (t < t1 - d) return null; return { alpha: 1 - EASE.inOutSine(kk(t, t1 - d, t1)) }; }
    if (tr.type === 'flash') { const k = kk(t, t1 - d * .35, t1); return k > 0 ? { expo: .6 * k * k } : null; }
    return null;
  }

  // ---- what is on screen ----
  /** [{shot, fx, R (screen region), crop, src (source s), speed, frames: [{f, a}]}] sorted by z */
  function active(t) {
    const out = [];
    for (const s of shots) {
      if (t < s.win[0] - 1e-9 || t >= s.win[1] - 1e-9) continue;
      const R = s.layoutAt(t), fx = fxOf(s, t, R);
      if (fx.alpha <= 0) continue;
      const src = s.srcAt(t), v = (s.srcAt(t + 1 / 240) - s.srcAt(t - 1 / 240)) * 120;
      out.push({ shot: s, fx, R, crop: cropAt(s, t, R), src, speed: v, frames: framesOf(s, src, v) });
    }
    return out.sort((a, b) => a.shot.z - b.shot.z);
  }
  function framesOf(s, src, v) {
    const q = cl(src, 0, s.dur) * FPS, top = s.nf - 1;
    if (s.blend && Math.abs(v) < .95) {
      const f0 = Math.floor(q + 1e-6), a = q - f0;
      if (a > 1e-3 && f0 + 1 <= top) return [{ f: Math.min(top, Math.max(0, f0)), a: 1 }, { f: f0 + 1, a }];
    }
    return [{ f: Math.min(top, Math.max(0, Math.round(q))), a: 1 }];
  }
  /** the frames to decode for time t: [{clip, f}] */
  function need(t) {
    const o = []; for (const a of active(t)) for (const q of a.frames) o.push({ clip: a.shot.clip, f: q.f });
    return o;
  }
  /** overlays drawn above the footage: doors, flash, pane seams. [{kind, R, …state}] */
  function overlays(t) {
    const o = [];
    for (const s of shots) {
      for (const [tr, solo] of [[s.trIn, false], [s.trOut, true]]) {
        if (!tr || (tr.type !== 'doors' && tr.type !== 'flash')) continue;
        const d = tr.dur, t0 = tr.t, R = s.layoutAt(Math.min(Math.max(t, s.t0), s.t1 - 1e-4));
        if (tr.type === 'doors') {
          const st = doorsState(tr, t, solo);                 // at(t') = the state at another instant (in-frame motion blur)
          if (st) o.push(Object.assign({ kind: 'doors', R, tr, z: s.z + .5, at: u => doorsState(tr, u, solo) }, st));
        } else {
          const a = t < t0 ? EASE.inQuad(kk(t, t0 - d * .35, t0)) : (solo ? 0 : Math.exp(-(t - t0) / (d * .22)) * (t < t0 + d * .65 ? 1 : 0));
          if (a > .002) o.push({ kind: 'flash', R, a: a * (tr.peak || .92), color: tr.color, z: s.z + .5 });
        }
      }
    }
    for (const a of active(t)) if (a.R.seam && a.fx.alpha > .5) o.push({ kind: 'seam', R: a.R, z: a.shot.z + .4 });
    return o.sort((a, b) => a.z - b.z);
  }
  /** container doors: close over the outgoing shot (accelerating, slam just before the cut), hold, open on the new one */
  function doorsState(tr, t, solo) {
    const d = tr.dur, t0 = tr.t, ts = t0 - Math.min(.03, d * .05), tOpen = t0 + d * .10;
    const a = tr.linked || solo ? t0 - d / 2 : ts, b = solo ? ts + .25 : t0 + d / 2;
    if (t < a || t >= b) return null;
    let th;
    if (t < ts) th = (Math.PI / 2) * (1 - EASE.inQuad(kk(t, a, ts)));
    else if (t < tOpen || solo) th = (4 * Math.PI / 180) * Math.exp(-(t - ts) * 16) * Math.abs(Math.sin((t - ts) * 38));
    else th = (Math.PI / 2) * EASE.inOut(kk(t, tOpen, b)) + (4 * Math.PI / 180) * Math.exp(-(t - ts) * 16) * Math.abs(Math.sin((t - ts) * 38));
    const ds = t - ts, shake = ds > 0 ? 14 * Math.exp(-ds * 10) : 0;
    return { theta: Math.min(Math.PI / 2, th), shakeX: shake * Math.sin(ds * 61), shakeY: shake * .6 * Math.cos(ds * 47),
      dark: 1 - Math.min(1, th / (Math.PI / 2)), slam: ts };
  }

  // ---- motion blur: sub-samples of frame n that never straddle a hard cut ----
  function shutter(n, mb) {
    const tc = n / FPS; if (!(mb > 1)) return [tc];
    const cuts = CUTS();
    return Array.from({ length: mb }, (_, k) => {
      let t = (n + (k / (mb - 1) - .5) * .5) / FPS;
      for (const c of cuts) { if (t < c && c <= tc) t = c; else if (tc < c && c <= t) t = c - 1e-4; }
      return Math.max(0, t);
    });
  }

  // ---- preparation: what prep_clips.py must extract ----
  /** per shot: {shot, clip, src_in, src_out, scale (screen px per source px, max over the shot), frames} */
  function needs() {
    const out = [];
    for (const s of shots) {
      let lo = 1e9, hi = -1e9, sc = 0;
      for (let t = s.win[0]; t < s.win[1]; t += 1 / 120) {
        const R = s.layoutAt(t), c = cropAt(s, t, R), fx = fxOf(s, t, R), src = cl(s.srcAt(t), 0, s.dur);
        lo = Math.min(lo, src); hi = Math.max(hi, src); sc = Math.max(sc, R.w / c.w * fx.sc);
      }
      const f0 = Math.max(0, Math.floor(lo * FPS) - 1), f1 = Math.min(s.nf - 1, Math.ceil(hi * FPS) + 1);
      out.push({ shot: s.id, clip: s.clip, src_in: R6(f0 / FPS), src_out: R6(f1 / FPS), scale: Math.round(sc * 1000) / 1000, frames: f1 - f0 + 1 });
    }
    return out;
  }
  /** exact frame set for the render (every shutter sub-sample of every frame) — {clip: Set(f)} */
  function frameSet(N, mb = 6) {
    const o = {};
    for (let n = 0; n < N; n++) for (const t of shutter(n, mb)) for (const q of need(t)) (o[q.clip] = o[q.clip] || new Set()).add(q.f);
    return o;
  }

  // ---- the clips' own sound under the picture (lib/mix.py) ----
  /** [{shot, clip, t0, t1, mode, g, in, map: [[t, s]…] (match), fadeIn, fadeOut}] */
  function ambience() {
    const out = [];
    for (const s of shots) {
      if (s.amb === false) continue;
      const A_ = Object.assign({ mode: 'hold', g: 0 }, s.amb || {});
      const fi = s.trIn ? Math.max(.03, Math.min(.25, s.trIn.dur / 2)) : .03;
      const fo = s.outLink ? Math.max(.03, Math.min(.25, s.outLink.dur / 2)) : s.trOut ? Math.max(.03, s.trOut.dur / 2) : .03;
      const t0 = Math.max(0, s.win[0] - (s.trIn && !OVERLAP[s.trIn.type] ? fi / 2 : 0)), t1 = s.win[1] + (s.outLink && !OVERLAP[s.outLink.type] ? fo / 2 : 0);
      const seg = { shot: s.id, clip: s.clip, t0: R6(t0), t1: R6(t1), mode: A_.mode, g: A_.g, fadeIn: fi, fadeOut: fo,
        in: R6(A_.in !== undefined ? A_.in : cl(s.srcAt(t0), 0, s.dur)) };
      if (A_.mode === 'match') {
        seg.map = []; for (let t = t0; t < t1 - 1e-9; t += .01) seg.map.push([R6(t), R6(s.srcAt(t))]);
        seg.map.push([R6(t1), R6(s.srcAt(t1))]);                                  // the map reaches the segment's end exactly
      }
      out.push(seg);
    }
    return out;
  }

  // ---- audit (tools/check_score.js, tools/qa.js) ----
  function audit(N) {
    const err = [], warn = [], info = [];
    const step = 1 / 60;
    for (const s of shots) {
      let worstOut = 0, worstAt = 0, clampMax = 0, clampAt = 0, nofit = null, srcOut = null;
      for (let t = s.win[0]; t < s.win[1]; t += step) {
        const R = s.layoutAt(t), c = cropAt(s, t, R), src = s.srcAt(t);
        if (!c.fits && nofit === null) nofit = t;
        if (c.moved > clampMax) { clampMax = c.moved; clampAt = t; }
        if ((src < -1e-6 || src > s.dur + 1e-6) && srcOut === null) srcOut = [t, src];
        const a = c.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
        for (const [px, py] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const x = c.cx + (px * c.w / 2) * co - (py * c.h / 2) * si, y = c.cy + (px * c.w / 2) * si + (py * c.h / 2) * co;
          const o = Math.max(-x, x - s.dims.w, -y, y - s.dims.h);
          if (o > worstOut) { worstOut = o; worstAt = t; }
        }
      }
      if (nofit !== null) err.push(`${s.id} (${s.clip}): the crop window cannot fit in the ${s.dims.w}×${s.dims.h} source from t ${nofit.toFixed(3)} (zoom out / smaller window / less rotation)`);
      else if (worstOut > .5) err.push(`${s.id} (${s.clip}): the crop leaves the source by ${worstOut.toFixed(1)} px at t ${worstAt.toFixed(3)} (black edge)`);
      if (clampMax > 1) warn.push(`${s.id} (${s.clip}): the requested crop was moved ${clampMax.toFixed(1)} px to stay inside the source (t ${clampAt.toFixed(3)}): fix the keys`);
      if (srcOut) warn.push(`${s.id} (${s.clip}): source time ${srcOut[1].toFixed(3)} outside 0–${s.dur} at t ${srcOut[0].toFixed(3)} (frame clamped = frozen)`);
      if (s.trIn && !s.trIn.linked && ['whip', 'slide', 'iris', 'fade', 'doors'].includes(s.trIn.type) && s.t0 > 1e-6) info.push(`${s.id}: « ${s.trIn.type} » in without a partner (enters alone)`);
      if (s.t1 <= s.t0) err.push(`${s.id}: t1 ≤ t0`);
    }
    // must-hide regions: out of the visible window, or covered by a hide box of that shot, at every sampled time
    for (const s of shots) {
      const must = (MUST[s.clip] || []).map(h => normHide(h, 'must'));
      if (!must.length) continue;
      let bad = null;
      for (let t = s.win[0]; t < s.win[1] && !bad; t += step) {
        const R = s.layoutAt(t), c = cropAt(s, t, R), src = cl(s.srcAt(t), 0, s.dur), sf = Math.round(src * FPS) / FPS;
        for (const m of must) {
          if (!m.activeAt(sf, t)) continue;
          const b = m.boxAt(sf); if (!visibleIn(b, c)) continue;
          const hs = s.hides.filter(h => h.activeAt(sf, t)).map(h => h.boxAt(sf));
          const cov = gridPts(b).every(([x, y]) => !visibleIn([x, y, 0, 0], c) || hs.some(h => x >= h[0] - .5 && x <= h[0] + h[2] + .5 && y >= h[1] - .5 && y <= h[1] + h[3] + .5));
          if (!cov) { bad = `${s.id} (${s.clip}): must-hide « ${m.why || 'region'} » [${b.map(v => v.toFixed(0)).join(', ')}] visible and not covered at t ${t.toFixed(3)} (src ${sf.toFixed(3)})`; break; }
        }
      }
      if (bad) err.push(bad); else info.push(`${s.id}: must-hide regions of ${s.clip} out of frame or covered`);
    }
    // screen coverage: a 9×16 grid of points must be covered at every frame (else black shows)
    if (N) {
      let hole = null;
      for (let n = 0; n < N && !hole; n++) {
        const t = n / FPS, act = active(t), cov = cfg.covered ? (cfg.covered(t) || []) : [];
        if (overlays(t).some(o => o.kind === 'doors' && o.dark > .98)) continue;
        for (let i = 0; i < 9 && !hole; i++) for (let j = 0; j < 16 && !hole; j++) {
          const x = (i + .5) * SW / 9, y = (j + .5) * SH / 16;
          if (!act.some(a => x >= a.R.x && x < a.R.x + a.R.w && y >= a.R.y && y < a.R.y + a.R.h) && !cov.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) hole = `no footage under (${x.toFixed(0)}, ${y.toFixed(0)}) at t ${t.toFixed(3)} (frame ${n}): black shows`;
        }
      }
      if (hole) warn.push(hole);
    }
    return { err, warn, info };
  }
  function visibleIn(b, c) {                    // box [x, y, w, h] intersects the (rotated) crop window?
    const a = -c.rot * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
    const pts = [[b[0], b[1]], [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]], [b[0], b[1] + b[3]], [b[0] + b[2] / 2, b[1] + b[3] / 2]];
    const loc = pts.map(([x, y]) => [(x - c.cx) * co - (y - c.cy) * si, (x - c.cx) * si + (y - c.cy) * co]);
    const minX = Math.min(...loc.map(p => p[0])), maxX = Math.max(...loc.map(p => p[0])), minY = Math.min(...loc.map(p => p[1])), maxY = Math.max(...loc.map(p => p[1]));
    return maxX > -c.w / 2 && minX < c.w / 2 && maxY > -c.h / 2 && minY < c.h / 2;
  }
  /** a 9×7 grid of points of a box: a must-hide box is covered when every VISIBLE point lies in some hide box (union) */
  const gridPts = b => { const o = []; for (let i = 0; i <= 8; i++) for (let j = 0; j <= 6; j++) o.push([b[0] + b[2] * i / 8, b[1] + b[3] * j / 6]); return o; };

  return { shots, byId, active, need, needs, frameSet, overlays, shutter, CUTS, cropAt, fxOf, ambience, audit, doorsState };
}

const EDL = { FPS, SW, SH, build, monotone, linearK, easeK, objKeys, scalarFn, EASE, DIR, cl, lerp, kk, R6, NAMED, normLayout };
if (typeof window !== 'undefined') window.EDL = EDL;
if (typeof module !== 'undefined') module.exports = EDL;
})();

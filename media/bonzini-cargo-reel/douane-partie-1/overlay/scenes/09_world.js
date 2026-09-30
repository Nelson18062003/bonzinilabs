'use strict';
// =============================================================================================
// ONE CONTINUOUS WORLD — a big paper diorama the camera travels through (V2: story & coherence).
// Everything that belongs to the world is drawn in WORLD coordinates inside worldBegin(t) … ctx.restore().
// The layout (stations, camera keys, actors, route) is declared by 10_layout.js with the helpers below;
// key times are functions of the voice timeline (TL), resolved lazily on the first draw.
// =============================================================================================
const WORLD = { stations: {}, camKeys: null, camFn: null, actors: {}, route: null, routeFn: null, _ready: false };

// ---------- camera -------------------------------------------------------------------------------
/** declare the camera path: fn() returns [{t, x, y, z = 1, r = 0, ease = 'io'|'out'|'in'|'lin'|'hold'}] sorted by t.
 *  Between two keys the camera eases from the previous to the next; 'hold' = jump cut at t. */
function defineCamera(fn) { WORLD.camFn = fn; WORLD.camKeys = null; }
const _ease = { io: eInOutCubic, out: eOutCubic, in: eInCubic, lin: x => x, hold: x => (x >= 1 ? 1 : 0), soft: x => x * x * (3 - 2 * x) };
function _resolve() {
  if (WORLD._ready) return;
  WORLD._ready = true;
  if (WORLD.camFn) WORLD.camKeys = WORLD.camFn().filter(k => isFinite(k.t)).sort((a, b) => a.t - b.t);
  for (const a of Object.values(WORLD.actors)) if (a.fn) a.keys = a.fn().filter(k => isFinite(k.t)).sort((p, q) => p.t - q.t);
  if (WORLD.routeFn) WORLD.route = WORLD.routeFn();
}
/** camera state at time t: {x, y, z, r}; keys carry an optional `dur` (move duration ending at t; default: from the previous key) */
function camAt(t) {
  _resolve();
  const K = WORLD.camKeys; if (!K || !K.length) return { x: W / 2, y: H / 2, z: 1, r: 0 };
  if (t <= K[0].t) return { x: K[0].x, y: K[0].y, z: K[0].z ?? 1, r: K[0].r ?? 0 };
  for (let i = 1; i < K.length; i++) {
    const a = K[i - 1], b = K[i]; if (t > b.t) continue;
    const t0 = b.dur != null ? Math.max(a.t, b.t - b.dur) : a.t, k = (_ease[b.ease || 'io'] || _ease.io)(prog(t, t0, b.t));
    const za = a.z ?? 1, zb = b.z ?? 1, z = Math.exp(lerp(Math.log(za), Math.log(zb), k));   // log-zoom interpolation feels linear
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z, r: lerp(a.r ?? 0, b.r ?? 0, k) };
  }
  const L = K[K.length - 1]; return { x: L.x, y: L.y, z: L.z ?? 1, r: L.r ?? 0 };
}
/** hand-held breathing added on top of the camera (px in screen space) */
function camBreath(t) { return { x: Math.sin(t * .61) * 3.5 + Math.sin(t * 1.37) * 1.2, y: Math.cos(t * .47) * 3 + Math.sin(t * 1.11) * 1, r: Math.sin(t * .29) * .0025 }; }
/** enter world space (call inside a scene's draw; ctx is saved/restored by the engine) */
function worldBegin(t, o = {}) {
  const c = camAt(t), b = o.still ? { x: 0, y: 0, r: 0 } : camBreath(t), p = o.parallax ?? 1, sh = shake(t, Math.round(t * FPS));
  ctx.translate(W / 2 + b.x + sh.x, H / 2 + b.y + sh.y); ctx.rotate(c.r + b.r); ctx.scale(c.z, c.z);   // registered impacts shake the whole world
  if (o.px != null) ctx.translate(-c.x * o.px, -c.y);   // horizontal-only parallax layer: place objects at (worldX * px, worldY)
  else ctx.translate(-c.x * p, -c.y * p);    // parallax layer p < 1: place its objects at (worldX * p, worldY * p)
  return c;
}
/** world → screen (for HUD elements that must follow something in the world) */
function worldToScreen(x, y, t) { const c = camAt(t), b = camBreath(t), sh = shake(t, Math.round(t * FPS)), cs = Math.cos(c.r + b.r), sn = Math.sin(c.r + b.r), dx = (x - c.x) * c.z, dy = (y - c.y) * c.z;
  return { x: W / 2 + b.x + sh.x + dx * cs - dy * sn, y: H / 2 + b.y + sh.y + dx * sn + dy * cs }; }
/** is a world-space circle (x,y,r) visible at time t? (cheap culling) */
function inView(x, y, r, t) { const c = camAt(t), hw = W / 2 / c.z + r + 60, hh = H / 2 / c.z + r + 60; return Math.abs(x - c.x) < hw && Math.abs(y - c.y) < hh; }

// ---------- stations -----------------------------------------------------------------------------
/** declare a station: name → {x, y, w, h, label} (world coordinates of its centre) */
function station(name, s) { WORLD.stations[name] = s; return s; }
const ST = n => WORLD.stations[n] || { x: 0, y: 0, w: 0, h: 0 };

// ---------- actors (persistent characters/props that walk between stations) -----------------------
/** declare an actor: draw(t, n, st) draws it at its local origin; fn() returns keys [{t, x, y, s = 1, face = 1, pose}] */
function actor(name, fn, draw, o = {}) { WORLD.actors[name] = { fn, draw, keys: null, z: o.z ?? 0 }; }
/** actor state at t: position interpolated between keys, `moving` true while travelling (drives the walk bob) */
function actorAt(name, t) {
  _resolve(); const a = WORLD.actors[name]; if (!a || !a.keys || !a.keys.length) return null; const K = a.keys;
  if (t <= K[0].t) return Object.assign({ moving: false, k: 0 }, K[0]);
  for (let i = 1; i < K.length; i++) {
    const p = K[i - 1], q = K[i]; if (t > q.t) continue;
    const t0 = q.dur != null ? Math.max(p.t, q.t - q.dur) : p.t, k = (_ease[q.ease || 'io'] || _ease.io)(prog(t, t0, q.t));
    const moving = t > t0 && t < q.t && (Math.abs(q.x - p.x) + Math.abs(q.y - p.y) > 4);
    return Object.assign({}, k < .5 ? p : q, { x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), s: lerp(p.s ?? 1, q.s ?? 1, k), moving, k, a: lerp(p.a ?? 1, q.a ?? 1, k) });
  }
  return Object.assign({ moving: false, k: 1 }, K[K.length - 1]);
}
/** paper walk: bob + slight rock on twos while moving */
function walkBob(t, n, moving, seed = 1) { if (!moving) return { y: 0, r: 0 }; const s = stepT(n) * 7 + seed; return { y: -Math.abs(Math.sin(s)) * 18, r: Math.sin(s) * .05 }; }
function drawActor(name, t, n) {
  const st = actorAt(name, t); if (!st || (st.a ?? 1) <= 0.01) return;
  const b = walkBob(t, n, st.moving, name.length);
  ctx.save(); ctx.globalAlpha *= clamp(st.a ?? 1); ctx.translate(st.x, st.y + b.y); ctx.rotate(b.r); ctx.scale((st.s ?? 1) * (typeof st.face === 'number' ? st.face : 1), st.s ?? 1);
  WORLD.actors[name].draw(t, n, st); ctx.restore();
}

// ---------- the route (the carton's journey, drawn progressively) ----------------------------------
/** declare the route: fn() returns { pts: [[x,y],...] (world), prog: t => 0..1 } */
function defineRoute(fn) { WORLD.routeFn = fn; }
/** dashed paper route + a solid violet thread for the part already travelled */
function drawRoute(t, n) {
  _resolve(); const R = WORLD.route; if (!R) return; const pts = curve(R.pts, 10), p = clamp(R.prog(t));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(120,90,60,.28)'; ctx.lineWidth = 16; ctx.setLineDash([2, 34]); ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(...q) : ctx.moveTo(...q)); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  if (p > 0) thread(pts, p, n, { w: 9, color: C.violet });
}

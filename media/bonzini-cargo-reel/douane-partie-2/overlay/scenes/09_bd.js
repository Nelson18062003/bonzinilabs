'use strict';
// ============================================================================================================
// BD ANIMÉE — core for « DOUANE · Apprends à faire · Partie 2 » (illustrated motion comic)
//   Shots  : defineShot({ id, t0, t1, img, cam: [keys], layers?, draw?, inT?, inKind? })  — one comic panel on screen
//   Camera : keys { t, x, y, z, r } in the shot's illustration pixels (z = 1 → the illustration covers 1080×1920)
//   Actors : actor(img, { x, y, h, flip, t, breathe, shadow, a })  — a cut-out standing with feet at (x, y) in stage pixels
//   Poses  : poseAt(keys, t) → { pose, prev, k }  (short cross-fade + squash when the pose changes)
//   Talk   : balloon(t, { t0, t1, text, x, y, w, tail, kind })  — hand-inked speech balloon, screen pixels
//   Paper  : inkRect / inkLine / inkCircle  — wobbly ink strokes for hand-drawn documents
// Time is always given by the voice timeline helpers (tw, te, ss, se) defined in 10_plan.js.
// ============================================================================================================
FF.bd = 'Bangers'; FF.let = 'Kalam'; FF.letN = 'PatrickHand'; FF.brush = 'CaveatBrush';
const BD = { ink: '#1E1512', paper: '#FFF9EC', recit: '#FFE27A', recitEdge: '#1E1512', violet: '#8B3DFF', orange: '#F26A21', amber: '#F5A524',
  green: '#2E8B57', red: '#D7263D', teal: '#1F9E9A', shadow: 'rgba(40,20,8,.28)' };
const img = k => (window.IMG || {})[k];

// ---------- camera shakes (impacts; also dumped as sound cues by render.mjs --dump-shakes) --------------------------
const _shakes = [];
function addShake(t0, amp = 14, dur = .14) { _shakes.push({ t0, amp, dur }); }
function shake(t, n) { let x = 0, y = 0;
  for (const s of _shakes) { const k = (t - s.t0) / s.dur; if (k < 0 || k > 1) continue; const a = s.amp * (1 - k);
    x += (rnd(n * 3.1 + s.t0) - .5) * 2 * a; y += (rnd(n * 5.7 + s.t0) - .5) * 2 * a; }
  return { x, y }; }

// ---------- deterministic noise ------------------------------------------------------------------------------
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function vnoise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u); }

// ---------- ink strokes (hand-drawn look) --------------------------------------------------------------------
/** polyline with a gently varying width and a tiny wobble — reads as a pen line */
function inkPath(pts, o = {}) {
  const w = o.w ?? 5, seed = o.seed ?? 1, wob = o.wob ?? 1.6;
  ctx.save(); ctx.strokeStyle = o.color || BD.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let pass = 0; pass < (o.passes ?? 1); pass++) {
    ctx.lineWidth = w * (pass ? .55 : 1); ctx.globalAlpha *= pass ? .6 : 1;
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const dx = (vnoise(i * .7 + pass * 3, seed) - .5) * wob, dy = (vnoise(i * .7 + 9 + pass * 3, seed) - .5) * wob;
      i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy); });
    if (o.close) ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
function subdiv(a, b, step = 18) { const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); }
function inkLine(x0, y0, x1, y1, o = {}) { inkPath(subdiv([x0, y0], [x1, y1], o.step), o); }
function inkRect(x, y, w, h, o = {}) {
  const P = [...subdiv([x, y], [x + w, y]), ...subdiv([x + w, y], [x + w, y + h]).slice(1), ...subdiv([x + w, y + h], [x, y + h]).slice(1), ...subdiv([x, y + h], [x, y]).slice(1)];
  if (o.fill) { ctx.save(); ctx.fillStyle = o.fill; ctx.beginPath(); P.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.restore(); }
  inkPath(P, Object.assign({ close: true }, o));
}
function inkCircle(cx, cy, r, o = {}) {
  const n = Math.max(16, Math.round(r / 5)), P = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, rr = r * (1 + (vnoise(i * .5, o.seed ?? 3) - .5) * .05); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
  if (o.fill) { ctx.save(); ctx.fillStyle = o.fill; ctx.beginPath(); P.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill(); ctx.restore(); }
  inkPath(P, Object.assign({ close: true }, o));
}
/** hatching inside a rect (for shadows on drawn props) */
function hatch(x, y, w, h, o = {}) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); const g = o.gap ?? 14;
  for (let k = -h; k < w; k += g) inkLine(x + k, y + h, x + k + h, y, { w: o.w ?? 2, color: o.color || 'rgba(30,21,18,.35)', seed: k, wob: 1 }); ctx.restore(); }

// ---------- lettering -----------------------------------------------------------------------------------------
function letter(txt, x, y, o = {}) { text(txt, x, y, Object.assign({ font: font(o.fam || FF.let, o.size || 48, o.weight || 700), color: o.color || BD.ink }, o)); }
function wrapLines(txt, maxW, f) {
  const words = txt.split(/ (?!\u00A0)/), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && measure(t, f) > maxW) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// ---------- camera ----------------------------------------------------------------------------------------------
/** interpolate camera keys (eased per segment); key.e = 'io' (default) | 'o' | 'lin' */
function camAtKeys(keys, t) {
  if (!keys || !keys.length) return { x: 0, y: 0, z: 1, r: 0 };
  if (t <= keys[0].t) return keys[0];
  for (let i = 1; i < keys.length; i++) { const a = keys[i - 1], b = keys[i]; if (t < b.t) {
    const u = (t - a.t) / (b.t - a.t), e = b.e === 'lin' ? u : b.e === 'o' ? eOutCubic(u) : eInOutCubic(u);
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), e)), r: lerp(a.r || 0, b.r || 0, e) }; } }
  return keys[keys.length - 1];
}
/** Stage units: the shot's illustration is 1000 units wide (height = 1000 × ih / iw). Camera keys { x, y } are the stage point at the
 *  screen centre; z = 1 → the illustration exactly covers 1080×1920. A slow drift keeps still frames alive. */
function stageBegin(shot, t, o = {}) {
  const c = Object.assign({}, camAtKeys(shot.cam, t)), I = shot.img ? img(shot.img) : null;
  const iw = 1000, ih = I ? 1000 * I.height / I.width : 1000 * H / W, cover = Math.max(W / iw, H / ih);
  const br = o.still ? 0 : 1, bx = Math.sin(t * .45 + (shot.seed || 0)) * 3 * br, by = Math.sin(t * .31 + 1.3 + (shot.seed || 0)) * 2.5 * br;
  const sh = shake(t, Math.round(t * FPS));
  // never show outside the illustration: clamp the centre so the visible window stays inside [0, iw] × [0, ih]
  const sc = cover * c.z, hw = W / 2 / sc, hh = H / 2 / sc;
  if (!shot.free) { c.x = clamp(c.x, Math.min(hw, iw / 2), Math.max(iw - hw, iw / 2)); c.y = clamp(c.y, Math.min(hh, ih / 2), Math.max(ih - hh, ih / 2)); }
  ctx.translate(W / 2 + bx + sh.x, H / 2 + by + sh.y); ctx.rotate(c.r || 0); ctx.scale(sc, sc); ctx.translate(-c.x, -c.y);
  return Object.assign(c, { cover, iw, ih, s: sc });
}
/** a parallax layer: content in stage coords, moving at rate p with the camera (1 = stage, <1 = farther/background, >1 = closer/foreground) */
function parallax(c, p, fn) { ctx.save(); ctx.translate(c.x * (1 - p), c.y * (1 - p)); fn(); ctx.restore(); }
/** stage → screen for a point, given the camera returned by stageBegin (for balloons anchored to a character) */
function stageToScreen(c, x, y) { return { x: W / 2 + (x - c.x) * c.s, y: H / 2 + (y - c.y) * c.s }; }

// ---------- actors (cut-outs) ------------------------------------------------------------------------------------
/** pose keys [{ t, pose }] → current pose + cross-fade */
function poseAt(keys, t, fade = .16) {
  let i = 0; while (i + 1 < keys.length && t >= keys[i + 1].t) i++;
  const cur = keys[i], prev = i > 0 ? keys[i - 1] : null, k = prev ? clamp((t - cur.t) / fade) : 1;
  return { pose: cur.pose, prev: prev && k < 1 ? prev.pose : null, k, since: t - cur.t };
}
/** position keys [{ t, x, y, e }] → { x, y, moving } */
function posAt(keys, t) {
  if (!keys || !keys.length) return { x: 0, y: 0, moving: 0 };
  if (t <= keys[0].t) return Object.assign({ moving: 0 }, keys[0]);
  for (let i = 1; i < keys.length; i++) { const a = keys[i - 1], b = keys[i]; if (t < b.t) {
    const u = (t - a.t) / (b.t - a.t), e = b.e === 'lin' ? u : eInOutCubic(u), mv = Math.hypot(b.x - a.x, b.y - a.y) > 4 ? 1 : 0;
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), moving: mv, dir: Math.sign(b.x - a.x), u }; } }
  return Object.assign({ moving: 0 }, keys[keys.length - 1]);
}
/** draw one cut-out with feet at (x, y), height h (stage px). o.flip mirrors, o.breathe (default on), o.a alpha, o.squash 0..1 */
function drawCut(key, x, y, h, o = {}) {
  const I = img(key); if (!I) { ctx.save(); ctx.fillStyle = 'rgba(255,0,255,.4)'; ctx.fillRect(x - h * .15, y - h, h * .3, h); ctx.restore(); return; }
  const s = h / I.height, w = I.width * s, t = o.t ?? 0, ph = o.phase ?? 0;
  const br = o.breathe === false ? 0 : 1, sy = 1 + Math.sin(t * 2.1 + ph) * .006 * br, rot = Math.sin(t * .9 + ph) * .006 * br + (o.lean || 0);
  const sq = o.squash || 0;
  if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= (o.a ?? 1) * .9; ctx.fillStyle = BD.shadow; ctx.beginPath(); ctx.ellipse(x, y - h * .005, w * .36, h * .028, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.translate(x, y); ctx.rotate(rot); ctx.scale((o.flip ? -1 : 1) * (1 + sq * .03), sy * (1 - sq * .04));
  ctx.drawImage(I, -w / 2 + (o.dx || 0) * w, -h, w, h); ctx.restore();
}
/** full actor: pose keys + position keys; walking adds a bob and alternates poses listed in o.walk */
function actor(t, a) {
  const P = posAt(a.pos, t), S = poseAt(a.poses, t, a.fade ?? .16);
  const bob = P.moving ? Math.abs(Math.sin((t - (a.t0 || 0)) * 5.2)) * a.h * .012 : 0;
  let pose = S.pose;
  if (P.moving && a.walk) pose = a.walk[Math.floor((t - (a.t0 || 0)) * 3.2) % a.walk.length];
  const flip = a.flip ?? (P.moving && a.faceDir ? P.dir !== a.faceDir : false);
  const base = Object.assign({ t, phase: a.phase || 0, flip }, a.o || {});
  if (S.prev && !P.moving) { drawCut(S.prev, P.x, P.y - bob, a.h, Object.assign({}, base, { a: (base.a ?? 1) * (1 - S.k), shadow: false })); }
  const pop = S.prev ? Math.sin(S.k * Math.PI) : 0;
  drawCut(pose, P.x, P.y - bob, a.h, Object.assign({}, base, { a: (base.a ?? 1) * (S.prev && !P.moving ? S.k : 1), squash: pop }));
  return P;
}

// ---------- balloons ---------------------------------------------------------------------------------------------
/** speech balloon (screen px). kind: 'talk' | 'think' | 'shout' | 'whisper'. tail = [x, y] target (mouth). */
function balloon(t, b) {
  if (t < b.t0 || t > b.t1 + .25) return;
  const _c = (window.__cues = window.__cues || {}); _c['b' + b.t0.toFixed(2)] = { t: b.t0, k: 'balloon', kind: b.kind || 'talk', x: b.x };   // sound cue (dumped by render.mjs --dump-cues)
  const inK = clamp(spring(t - b.t0, 16, .55), 0, 1.2), outK = clamp((b.t1 + .25 - t) / .25), s = Math.max(.001, Math.min(inK, 1.2)) , a = Math.min(clamp((t - b.t0) / .08), outK);
  const txt = b.text.replace(/ ([?!:;»])/g, '\u00A0$1').replace(/« /g, '«\u00A0');
  const f = font(b.fam || FF.let, b.size || 54, 700), maxW = b.w || 560, lines = wrapLines(txt, maxW - 70, f), lh = (b.size || 54) * 1.12;
  const tw = Math.max(...lines.map(l => measure(l, f))), bw = Math.max(200, tw + 88), bh = lines.length * lh + 64, size = b.size || 54;
  const cx = b.x, cy = b.y;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.scale(s, s); ctx.rotate(b.rot || 0);
  const tail = b.tail ? [(b.tail[0] - cx) / s, (b.tail[1] - cy) / s] : null;
  // shape: ellipse-ish rounded balloon (+ spikes for 'shout', bubbles for 'think')
  const pts = []; const n = 44;
  for (let i = 0; i < n; i++) { const u = i / n * Math.PI * 2; let rx = bw / 2, ry = bh / 2;
    let r = 1 + (vnoise(i * .9, (b.seed || 1)) - .5) * .035; if (b.kind === 'shout') r *= i % 2 ? 1.16 : .94;
    const k = Math.pow(Math.abs(Math.cos(u)), .7) * Math.sign(Math.cos(u)), l = Math.pow(Math.abs(Math.sin(u)), .7) * Math.sign(Math.sin(u));
    pts.push([k * rx * r, l * ry * r]); }
  ctx.fillStyle = b.fill || '#FFFFFF';
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
  withShadow(10, () => { path(); ctx.fill(); });
  if (tail && b.kind !== 'think') {                                      // tail: a curved wedge towards the speaker
    const ang = Math.atan2(tail[1], tail[0]), bx0 = Math.cos(ang) * bw * .36, by0 = Math.sin(ang) * bh * .36, nx = -Math.sin(ang) * 26, ny = Math.cos(ang) * 26;
    ctx.beginPath(); ctx.moveTo(bx0 + nx, by0 + ny); ctx.quadraticCurveTo(lerp(bx0, tail[0], .5) + nx * .4, lerp(by0, tail[1], .5) + ny * .4, tail[0], tail[1]);
    ctx.quadraticCurveTo(lerp(bx0, tail[0], .55) - nx * .1, lerp(by0, tail[1], .55) - ny * .1, bx0 - nx, by0 - ny); ctx.closePath(); ctx.fill();
    inkPath([[bx0 + nx, by0 + ny], [lerp(bx0, tail[0], .5) + nx * .4, lerp(by0, tail[1], .5) + ny * .4], tail, [lerp(bx0, tail[0], .55) - nx * .1, lerp(by0, tail[1], .55) - ny * .1], [bx0 - nx, by0 - ny]], { w: 4.5, seed: 5 });
    ctx.fillStyle = b.fill || '#FFFFFF'; path(); ctx.fill();
  }
  if (tail && b.kind === 'think') [[.55, 22], [.75, 14], [.9, 9]].forEach(([u, r], i) => inkCircle(tail[0] * u, tail[1] * u, r, { w: 4, fill: '#fff', seed: i + 7 }));
  inkPath(pts.concat([pts[0]]), { w: b.kind === 'whisper' ? 3 : 5, seed: b.seed || 2 });
  lines.forEach((l, i) => text(l, 0, -bh / 2 + 32 + size * .82 + i * lh, { font: f, align: 'center', color: b.color || BD.ink }));
  ctx.restore();
}

// ---------- paper documents (hand-inked) ---------------------------------------------------------------------------
/** a sheet of paper with ink border and ruled lines; fn draws the content in local coords (0,0 = top-left) */
function paperSheet(x, y, w, h, o, fn) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0);
  withShadow(o.lift ?? 14, () => { ctx.fillStyle = o.fill || BD.paper; ctx.fillRect(-w / 2, -h / 2, w, h); });
  if (o.lines) { ctx.save(); ctx.globalAlpha *= .35; for (let yy = -h / 2 + (o.top || 110); yy < h / 2 - 30; yy += o.lines) inkLine(-w / 2 + 30, yy, w / 2 - 30, yy, { w: 1.6, color: '#7A8CA8', seed: yy, wob: .8 }); ctx.restore(); }
  inkRect(-w / 2, -h / 2, w, h, { w: 3.5, seed: o.seed || 4 });
  ctx.translate(-w / 2, -h / 2); if (fn) fn(w, h); ctx.restore();
}
/** a round rubber stamp (ink colour, slightly starved) */
function bdStamp(x, y, r, label, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot ?? -.18); ctx.globalAlpha *= o.a ?? .92;
  inkCircle(0, 0, r, { w: r * .07, color: o.color || BD.red, seed: 11 }); inkCircle(0, 0, r * .82, { w: r * .03, color: o.color || BD.red, seed: 12 });
  const f = font(FF.bd, o.size || r * .36, 400), ls = wrapLines(label, r * 1.45, f);
  ls.forEach((l, i) => text(l, 0, (i - (ls.length - 1) / 2) * r * .38 + r * .13, { font: f, align: 'center', color: o.color || BD.red, ls: 2 }));
  ctx.restore();
}

// ---------- shots & transitions -----------------------------------------------------------------------------------
const SHOTS = [], _builders = []; let _built = false;
function defineShot(s) { SHOTS.push(s); SHOTS.sort((a, b) => a.t0 - b.t0); return s; }
/** shot files register a builder; it runs once the voice timeline is loaded (first frame) */
function shots(fn) { _builders.push(fn); }
function buildShots() { if (_built) return; _built = true; for (const f of _builders) f();
  const _c = (window.__cues = window.__cues || {}); SHOTS.forEach((sh, i) => { if (i) _c['s' + sh.t0.toFixed(2)] = { t: sh.t0, k: 'shot', kind: sh.inKind || 'cut', id: sh.id }; }); }
const _off = [null, null];
function offCanvas(i) { if (!_off[i]) { _off[i] = document.createElement('canvas'); _off[i].width = W; _off[i].height = H; } return _off[i]; }
function drawShotInto(s, t, n, target) {
  const main = ctx; ctx = target.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.fillStyle = '#1B1410'; ctx.fillRect(0, 0, W, H);
  try { ctx.save(); drawShot(s, t, n); ctx.restore(); } finally { ctx = main; }
}
function drawShot(s, t, n) {
  if (s.draw) { s.draw(t, n, s); return; }
  ctx.save(); const c = stageBegin(s, t); const I = img(s.img); if (I) ctx.drawImage(I, 0, 0, c.iw, c.ih); if (s.stage) s.stage(t, n, c, s); ctx.restore();
  if (s.screen) { ctx.save(); s.screen(t, n, s); ctx.restore(); }
}
/** transition kinds: cut · fade · slide (new panel slides in from the right with a white gutter) · page (page turn) · iris · up (panel slides up) */
function composeTransition(A, B, t, n, k, kind) {
  const ca = offCanvas(0), cb = offCanvas(1); drawShotInto(A, t, n, ca); drawShotInto(B, t, n, cb);
  const e = eInOutCubic(k);
  if (kind === 'fade') { ctx.drawImage(ca, 0, 0); ctx.globalAlpha = e; ctx.drawImage(cb, 0, 0); ctx.globalAlpha = 1; return; }
  if (kind === 'slide' || kind === 'up') {
    const dx = kind === 'slide' ? W + 36 : 0, dy = kind === 'up' ? H + 36 : 0;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(ca, -dx * e, -dy * e); ctx.drawImage(cb, dx * (1 - e), dy * (1 - e));
    return;
  }
  if (kind === 'page') {                                             // the old page lifts and turns away to the left, revealing B
    ctx.drawImage(cb, 0, 0);
    const x = W * (1 - e); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H); ctx.clip(); ctx.drawImage(ca, 0, 0); ctx.restore();
    const g = ctx.createLinearGradient(x - 90, 0, x + 40, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.7, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 90, 0, 130, H);
    ctx.save(); ctx.fillStyle = '#FFF6E2'; ctx.globalAlpha = .9; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60 * Math.sin(e * Math.PI), 0); ctx.lineTo(x + 20 * Math.sin(e * Math.PI), H); ctx.lineTo(x, H); ctx.fill(); ctx.restore();
    return;
  }
  if (kind === 'iris') { ctx.drawImage(ca, 0, 0); ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H * .45, Math.hypot(W, H) * .6 * e, 0, 7); ctx.clip(); ctx.drawImage(cb, 0, 0); ctx.restore(); return; }
  ctx.drawImage(k < .5 ? ca : cb, 0, 0);
}
registerScene({ id: 'shots', z: 10, draw(t, n) {
  buildShots();
  let i = SHOTS.findIndex((s, j) => t >= s.t0 && (j === SHOTS.length - 1 || t < SHOTS[j + 1].t0));
  if (i < 0) { if (SHOTS.length && t < SHOTS[0].t0) i = 0; else return; }
  const s = SHOTS[i], d = s.inT ?? 0;
  if (i > 0 && d > 0 && t < s.t0 + d && (s.inKind || 'cut') !== 'cut') { composeTransition(SHOTS[i - 1], s, t, n, (t - s.t0) / d, s.inKind); return; }
  drawShot(s, t, n);
} });

// ---------- finishing: warm grade, vignette, paper grain (unifies illustrations and hand-drawn overlays) -------------
let _grainTex = null;
registerScene({ id: 'finish', z: 88, draw(t, n) {
  ctx.save(); const g = ctx.createRadialGradient(W / 2, H * .46, H * .28, W / 2, H * .5, H * .78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,14,4,.34)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (!_grainTex) { _grainTex = makeCanvas(512, 512); const gx = _grainTex.getContext('2d'), id = gx.createImageData(512, 512);
    for (let i = 0; i < id.data.length; i += 4) { const v = 128 + (hash(i * .37) - .5) * 70; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; } gx.putImageData(id, 0, 0); }
  ctx.globalCompositeOperation = 'overlay'; const ox = (n * 37) % 512, oy = (n * 91) % 512;
  for (let x = -ox; x < W; x += 512) for (let y = -oy; y < H; y += 512) ctx.drawImage(_grainTex, x, y);
  ctx.restore();
} });

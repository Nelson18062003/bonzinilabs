'use strict';
// ============================================================================================================
// PUPPETS — real cartoon animation on the illustrated cut-outs (mesh deformation, WebGL, like a 2D skeletal rig)
//   RIGS[key] = { bones: [{ n, p (parent), a: [x,y] pivot, b: [x,y] tip }], face: { eyes: [[x,y],[x,y]], eyeR, mouth: [x,y], chin: [x,y], skin } }
//     coordinates in pixels of the ORIGINAL cut-out (rig.w × rig.h); the texture may be larger (upscaled): everything scales.
//   puppet(key, pose) → a canvas with the deformed character (same size as the image + margin), ready for drawCut-like drawing.
//   pose = { rot: { boneName: radians }, jaw: 0..1, blink: 0..1, sway, t }
// ============================================================================================================
const RIGS = {};
const PUP = { gl: null, cv: null, prog: null, meshes: {}, tex: {}, M: .18 };   // M = margin around the image (fraction of width)
function pupGL() {
  if (PUP.gl) return PUP.gl;
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 2048;
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true, alpha: true });
  const vs = `attribute vec2 p; attribute vec2 uv; uniform vec2 size; varying vec2 v; void main(){ v = uv; gl_Position = vec4(p.x / size.x * 2.0 - 1.0, 1.0 - p.y / size.y * 2.0, 0.0, 1.0); }`;
  const fs = `precision mediump float; varying vec2 v; uniform sampler2D tex; void main(){ gl_FragColor = texture2D(tex, v); }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  gl.useProgram(pr); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  PUP.gl = gl; PUP.cv = cv; PUP.prog = pr; PUP.loc = { p: gl.getAttribLocation(pr, 'p'), uv: gl.getAttribLocation(pr, 'uv'), size: gl.getUniformLocation(pr, 'size') };
  PUP.pbuf = gl.createBuffer(); PUP.uvbuf = gl.createBuffer(); PUP.ibuf = gl.createBuffer();
  return gl;
}
/** build (once) the mesh for an image: a grid over the opaque parts, with per-vertex bone weights */
function pupMesh(key) {
  if (PUP.meshes[key]) return PUP.meshes[key];
  const I = img(key), R = RIGS[key]; if (!I || !R) return null;
  const sx = I.width / R.w, sy = I.height / R.h, cell = R.cell || 9;               // grid step in rig px
  const cols = Math.ceil(R.w / cell), rows = Math.ceil(R.h / cell);
  const probe = document.createElement('canvas'); probe.width = R.w; probe.height = R.h; const pg = probe.getContext('2d'); pg.drawImage(I, 0, 0, R.w, R.h);
  const A = pg.getImageData(0, 0, R.w, R.h).data, opaque = (x, y) => { x = clamp(Math.round(x), 0, R.w - 1); y = clamp(Math.round(y), 0, R.h - 1); return A[(y * R.w + x) * 4 + 3] > 4; };
  const vid = new Map(), V = [], idx = [];
  const vtx = (i, j) => { const k = i + ',' + j; if (!vid.has(k)) { vid.set(k, V.length); V.push([Math.min(i * cell, R.w), Math.min(j * cell, R.h)]); } return vid.get(k); };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let any = false; for (let yy = 0; yy <= 2 && !any; yy++) for (let xx = 0; xx <= 2 && !any; xx++) any = opaque(i * cell + xx * cell / 2, j * cell + yy * cell / 2);
    if (!any) continue;
    const a = vtx(i, j), b = vtx(i + 1, j), c = vtx(i, j + 1), d = vtx(i + 1, j + 1); idx.push(a, b, c, b, d, c);
  }
  // weights: inverse distance to each bone segment (sharp falloff), top 3
  const segD = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1, u = clamp(((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L); return Math.hypot(p[0] - (a[0] + vx * u), p[1] - (a[1] + vy * u)); };
  const W = V.map(p => { let ws = R.bones.map((bn, k) => ({ k, w: 1 / Math.pow(segD(p, bn.a, bn.b) + (bn.soft ?? 6), R.fall || 4) })); ws.sort((x, y) => y.w - x.w); ws = ws.slice(0, 3); const s = ws.reduce((q, z) => q + z.w, 0); return ws.map(z => ({ k: z.k, w: z.w / s })); });
  const m = PUP.M * R.w, UV = new Float32Array(V.length * 2); V.forEach((p, i) => { UV[i * 2] = p[0] / R.w; UV[i * 2 + 1] = p[1] / R.h; });
  const mesh = { V, W, idx: new Uint16Array(idx), UV, sx, sy, m, R, P: new Float32Array(V.length * 2) };
  // texture
  const gl = pupGL(), tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, I); mesh.tex = tex;
  mesh.out = document.createElement('canvas'); mesh.out.width = Math.round((R.w + 2 * m) * sx); mesh.out.height = Math.round((R.h + 2 * m) * sy);
  PUP.meshes[key] = mesh; return mesh;
}
/** 2D affine helpers: [a, b, c, d, e, f] maps (x, y) → (a x + c y + e, b x + d y + f) */
const aff = { I: () => [1, 0, 0, 1, 0, 0], mul: (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]],
  rotAt: (r, x, y) => { const c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, x - c * x + s * y, y - s * x - c * y]; }, tr: (x, y) => [1, 0, 0, 1, x, y],
  ap: (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]] };
/** bone world matrices from local rotations (each bone rotates around its pivot a, children inherit) */
function boneMats(R, rot = {}, off = {}) {
  const M = {};
  for (const bn of R.bones) { const par = bn.p ? M[bn.p] : aff.I(); const o = off[bn.n] || [0, 0];
    M[bn.n] = aff.mul(par, aff.mul(aff.tr(o[0], o[1]), aff.rotAt(rot[bn.n] || 0, bn.a[0], bn.a[1]))); }
  return M;
}
/** render the deformed puppet; returns { cv, m (margin, rig px), M (bone matrices), sx, sy } */
function puppet(key, pose = {}) {
  const mesh = pupMesh(key); if (!mesh) return null;
  const { V, W, R, P, m, sx, sy } = mesh, M = boneMats(R, pose.rot || {}, pose.off || {}), mats = R.bones.map(b => M[b.n]);
  const F = R.face, jaw = clamp(pose.jaw || 0), chin = F && F.chin, mouth = F && F.mouth;
  for (let i = 0; i < V.length; i++) {
    let p = V[i];
    if (jaw > 0 && chin) {                                               // lower face drops a little: the mouth opens
      const dy = p[1] - mouth[1], r = Math.hypot((p[0] - chin[0]) / (F.jawW || 26), (p[1] - chin[1]) / (F.jawH || 22));
      if (dy > -2 && r < 1.6) { const k = (1 - smooth(clamp((r - .6) / 1))) * clamp((dy + 2) / 8); p = [p[0], p[1] + k * jaw * (F.jawDrop || 4)]; }
    }
    let x = 0, y = 0; for (const { k, w } of W[i]) { const q = aff.ap(mats[k], p); x += q[0] * w; y += q[1] * w; }
    P[i * 2] = (x + m) * sx; P[i * 2 + 1] = (y + m) * sy;
  }
  const gl = pupGL(), cw = mesh.out.width, ch = mesh.out.height;
  gl.viewport(0, PUP.cv.height - ch, cw, ch); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(PUP.loc.size, cw, ch);
  gl.bindBuffer(gl.ARRAY_BUFFER, PUP.pbuf); gl.bufferData(gl.ARRAY_BUFFER, P, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(PUP.loc.p); gl.vertexAttribPointer(PUP.loc.p, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, PUP.uvbuf); gl.bufferData(gl.ARRAY_BUFFER, mesh.UV, gl.STATIC_DRAW); gl.enableVertexAttribArray(PUP.loc.uv); gl.vertexAttribPointer(PUP.loc.uv, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, PUP.ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.DYNAMIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, mesh.tex); gl.drawElements(gl.TRIANGLES, mesh.idx.length, gl.UNSIGNED_SHORT, 0);
  const o = mesh.out.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, cw, ch);
  o.drawImage(PUP.cv, 0, 0, cw, ch, 0, 0, cw, ch);
  // blink: skin-coloured lids close over the eyes, with a lash line (follows the head bone)
  if (F && (pose.blink || 0) > .05) {
    const hm = M[F.bone || 'head'] || aff.I(), b = clamp(pose.blink);
    o.save(); o.scale(sx, sy); o.translate(m, m);
    for (const e of F.eyes) { const q = aff.ap(hm, e), rx = F.eyeR || 9, ry = (F.eyeRy || 7) * b;
      o.fillStyle = F.skin || '#8A5230'; o.beginPath(); o.ellipse(q[0], q[1] - (F.eyeRy || 7) + ry, rx, ry + .5, 0, 0, 7); o.fill();
      o.strokeStyle = '#1E1512'; o.lineWidth = 1.6; o.beginPath(); o.ellipse(q[0], q[1] - (F.eyeRy || 7), rx, ry * 2, 0, Math.PI * .1, Math.PI * .9); o.stroke(); }
    o.restore();
  }
  // grade: tint the character to sit in the shot's light (night blue, golden hour…) + optional warm rim from one side
  if (pose.grade) { const g = pose.grade; o.save(); o.globalCompositeOperation = 'source-atop';
    if (g.mul) { o.globalCompositeOperation = 'multiply'; o.fillStyle = g.mul; o.fillRect(0, 0, cw, ch); o.globalCompositeOperation = 'destination-in'; o.drawImage(PUP.cv, 0, 0, cw, ch, 0, 0, cw, ch); o.globalCompositeOperation = 'source-atop'; }
    if (g.tint) { o.globalAlpha = g.tintA ?? .2; o.fillStyle = g.tint; o.fillRect(0, 0, cw, ch); o.globalAlpha = 1; }
    if (g.rim) { const gr = o.createLinearGradient(g.rimSide === 'left' ? 0 : cw, 0, g.rimSide === 'left' ? cw * .45 : cw * .55, 0);
      gr.addColorStop(0, g.rim); gr.addColorStop(1, 'rgba(0,0,0,0)'); o.globalCompositeOperation = 'source-atop'; o.globalAlpha = g.rimA ?? .35; o.fillStyle = gr; o.fillRect(0, 0, cw, ch); }
    o.restore(); }
  return { cv: mesh.out, m, M, sx, sy, R };
}
function smooth(u) { return u * u * (3 - 2 * u); }
/** draw an animated puppet with feet at (x, y) stage units, height h — like drawCut, but alive */
function drawPuppet(key, x, y, h, o = {}) {
  const R = RIGS[key]; if (!R) return drawCut(key, x, y, h, o);
  const t = o.t ?? 0, ph = o.phase ?? 0, talk = o.talk || 0;
  const rot = Object.assign({}, o.rot || {});
  // procedural life (cartoon amplitude): breathing, sway, head nods while talking, gesture beats, a blink every ~3.4 s,
  // an excited hop (o.hop = time of the hop), and a lean toward the listener (o.lean, radians)
  const E = o.energy ?? 1, beat = talk ? Math.sin(t * 5.1 + ph) : 0;
  rot.chest = (rot.chest || 0) + Math.sin(t * 1.9 + ph) * .018 * E + Math.sin(t * .7 + ph) * .02 * E + (o.lean || 0) + beat * .025 * talk * E;
  rot.hips = (rot.hips || 0) + Math.sin(t * .7 + ph + 1) * .008 * E;
  rot.head = (rot.head || 0) + Math.sin(t * 1.1 + ph * 2) * .04 * E + (talk ? (Math.sin(t * 6.3 + ph) * .06 + Math.sin(t * 2.7) * .04) * talk * E : 0);
  if (R.gesture) for (const [bn, amp, fr] of R.gesture) rot[bn] = (rot[bn] || 0) + (Math.sin(t * fr + ph) * .6 + Math.sin(t * fr * 1.9 + ph) * .4) * amp * (talk ? 2.2 : .6) * E;
  // walk cycle (side-view walking poses): thighs swing, the back knee bends, arms counter-swing, the body bobs
  let walkBob = 0;
  if (o.walk) { const wp = (t - (o.walkT0 || 0)) * (o.walk.speed || 1.6) * Math.PI * 2, A = o.walk.amp ?? 1;
    rot.legL = (rot.legL || 0) + Math.sin(wp) * .34 * A; rot.legR = (rot.legR || 0) - Math.sin(wp) * .34 * A;
    rot.shinL = (rot.shinL || 0) + Math.max(0, -Math.sin(wp + .5)) * .5 * A; rot.shinR = (rot.shinR || 0) + Math.max(0, Math.sin(wp + .5)) * .5 * A;
    rot.armL_up = (rot.armL_up || 0) - Math.sin(wp) * .28 * A; rot.armR_up = (rot.armR_up || 0) + Math.sin(wp) * .28 * A;
    rot.chest += .03 * A; walkBob = Math.abs(Math.cos(wp)) * .014 * A; }
  const blinkT = (t + ph * 1.7) % 3.4, blink = blinkT < .16 ? Math.sin(blinkT / .16 * Math.PI) : 0;
  const jaw = talk ? clamp(Math.abs(Math.sin(t * 11 + ph)) * .7 + Math.abs(Math.sin(t * 17.3)) * .4) * talk : 0;
  let bounce = talk ? Math.abs(Math.sin(t * 5.1 + ph)) * .012 * talk * E : 0, hopY = 0;
  if (o.hop != null) { const u = (t - o.hop) / .45; if (u > 0 && u < 1) { hopY = Math.sin(u * Math.PI) * .07; bounce += (u < .15 ? -.04 * (1 - u / .15) : 0); } }
  const pp = puppet(key, { rot, jaw, blink, off: o.off, grade: o.grade });
  if (!pp) return;
  const s = h / R.h, w = pp.cv.width / pp.sx * s, hh = pp.cv.height / pp.sy * s, m = pp.m * s;
  if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= (o.a ?? 1) * .9; ctx.fillStyle = BD.shadow; ctx.beginPath(); ctx.ellipse(x, y - h * .005, R.w * s * .36, h * .028, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.translate(x, y - (hopY + walkBob) * h); ctx.scale(o.flip ? -1 : 1, 1 + bounce); ctx.scale(1, 1);
  ctx.drawImage(pp.cv, -R.w * s / 2 - m, -h - m, w, hh); ctx.restore();
}

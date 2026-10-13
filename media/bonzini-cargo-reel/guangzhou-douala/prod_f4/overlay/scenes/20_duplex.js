'use strict';
// =============================================================================================
// 20_duplex.js — M-DUPLEX, the graphic system « DUPLEX » shared by the 4 films of the series (rush2/SERIE.md §3.1–3.6,
// §3.10; the contract is MODULES.md §5). Everything is drawn in screen space from the score's states:
//   DX_under(t, n)   the night ground of the signature (+ a soft glow), under the panel window
//   DX_draw(t, n)    1 the band-route: depth shadows, the night body (true motion blur of its edges during a glide),
//                      the marching dashed route amber → orange (travelled part full, the rest at 50 %), the glint of a
//                      glide, the drawn kraft parcel = progress (it hops with a glide)
//                    2 the band phrases (Satoshi 900, LÀ-BAS amber / ICI orange) + the drawn felt underline
//                    3 the real-voice karaoke in the band (header « vraie voix · … », live 16-bar waveform, 2 lines:
//                      the word being said cross-fades 700 → 900 in a fixed slot, so nothing reflows)
//                    4 the flag pills (drawn flags: China 1 + 4 stars aimed at the big one; Cameroon + star)
//                    5 the stamps (§3.6): double frame, procedural ink, 1,6 → 1 slam in 4 frames, 14 ink grains, the
//                      whole-screen red/blue split on the hit frame; C'EST FORT ! leaves smeared with the filé
//                    6 the filé's ±6 px red/blue split (signature.whip)
//                    7 the signature (§3.10): panel edge, subtitle box, the violet plate (drop, tonk squash, one sheen),
//                      the amber call pill with its drawn bouncing arrow
//                    8 the logo pill + « VRAIES IMAGES » (on top, never split)
//   DX_wordBox(subId, word)  → {x, y, w, h, size, cx, cy, baseline}: where the karaoke draws that word NOW (window.__t)
//                    x, y = top-left of the word's cap box (its 900-weight slot), cx, cy = its centre (M-MAP lands MERCI)
// REUSABLE (films 3 and 4): no film value lives here — strings, times, positions and colours all come from window.SCORE
// (band, texts, subtitles, pills, logo, progress, stamps, signature, G, COL, KEYCOL, TEXTS); a missing state = not drawn.
// LOOK below is only the look of the series.
// Pure in t (the integer frame n only picks the single red/blue frame of a stamp hit); no Math.random (kit rnd), no
// ctx.filter; static looks are cached sprites built on first use (the fonts are loaded by then).
// =============================================================================================
(function () {
  const S = window.SCORE; if (!S) return;
  const COL = S.COL, G = S.G, kk = S.kk, cl = S.cl, lp = S.lerp, easeOut = S.easeOut, ease = S.ease, backOut = S.backOut;
  const PI = Math.PI, TAU = 2 * Math.PI;
  const has = k => typeof S[k] === 'function';
  const call = (k, t, d = null) => (has(k) ? S[k](t) : d);
  const col = k => (k && COL[k]) || k || COL.white;
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;
  const MONO = (z, w = 400) => `${w} ${z}px Martian`;
  const CAP = .745;                                   // Satoshi cap height / em (Chromium: « H » 900 at 60 px = 45 px)

  // ---------- the LOOK of the series (no film value here) ----------
  const LOOK = {
    band: { alpha: .92, top: [22, 27, 58], body: [16, 20, 43], shUp: [34, .30], shDown: [30, .26], hair: .07,
      march: 18, ahead: .50, glint: .85, hop: 12, ls: 1 },
    head: { size: 36, weight: 700, alpha: .85, base: 28 }, // review 2: Satoshi 700 36 px white 85 % (Martian 30 px read ≈ 10 px on a phone)
    kara: { said: .78, coming: .36, keySaid: 1, padBox: 28, rise: 12 },
    wave: { bars: 16, pitch: 6, bw: 3.6, hMin: 3.5, hMax: 30, lag: .045 },
    pill: { padL: 16, gap: 16, padR: 26, ls: .6, ring: 2.5, dot: .62 },
    stamp: { slam: 1.6, frames: 4, rgb: 6, dust: 14, inner: 3, gap: 6, outer: 8, rIn: 9, rOut: 16 },
    plate: { r: 26, fall: 260, logo: 80 },
    cta: { r: 54, padL: 56, keyPadX: 22, keyR: 18 },
  };

  // ---------- small kit ----------
  const MC = document.createElement('canvas').getContext('2d'), MW = new Map();
  /** text width (cached) — font, letter spacing, font-stretch */
  function tw(s, font, ls = 0, stretch = 'normal') {
    const k = font + '|' + ls + '|' + stretch + '|' + s; let w = MW.get(k);
    if (w === undefined) { MC.font = font; MC.letterSpacing = ls + 'px'; MC.fontStretch = stretch; w = MC.measureText(s).width; MW.set(k, w); }
    return w;
  }
  const MB_ = new Map();
  /** ink bounds of a string {asc, desc} (cached) */
  function inkOf(s, font) {
    const k = font + '|' + s; let m = MB_.get(k);
    if (!m) { MC.font = font; MC.letterSpacing = '0px'; MC.fontStretch = 'normal'; const q = MC.measureText(s); m = { asc: q.actualBoundingBoxAscent, desc: q.actualBoundingBoxDescent }; MB_.set(k, m); }
    return m;
  }
  const SPR = new Map();
  /** a cached sprite: draw(g, w, h) in logical px, stored at `res` × for crisp downscaled blits */
  function sprite(key, w, h, draw, res = 1) {
    let c = SPR.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * res)); c.height = Math.max(1, Math.ceil(h * res));
    const g = c.getContext('2d'); g.scale(res, res); draw(g, w, h); c._w = w; c._h = h; SPR.set(key, c); return c;
  }
  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  const hex = h => { const v = parseInt(String(h).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const rgba = (h, a) => { const [r, g, b] = Array.isArray(h) ? h : hex(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * k)); };
  /** a 5-point star centred (cx, cy), outer radius R, one point aimed along angle a0 */
  function star(g, cx, cy, R, a0 = -PI / 2) {
    const r = R * .382; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = a0 + i * PI / 5, q = i % 2 ? r : R; i ? g.lineTo(cx + q * Math.cos(a), cy + q * Math.sin(a)) : g.moveTo(cx + q * Math.cos(a), cy + q * Math.sin(a)); }
    g.closePath();
  }
  const nrm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const NRMU = s => String(s).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
  let ROWS = null;
  const rows = () => ROWS || (ROWS = has('TEXTS') ? S.TEXTS() : []);

  // =====================================================================================================================
  // 1 · THE BAND-ROUTE (§3.2)
  // =====================================================================================================================
  /** seconds between two shutter samples (the engine averages MB samples over half a frame) */
  const shutterDt = () => { const mb = window.MB || 1; return mb > 1 ? .5 / (mb - 1) / FPS : .5 / FPS; };
  function bandSpeed(t) { const e = 1 / 600, a = S.band(t - e), b = S.band(t + e); return (b.y0 - a.y0) / (2 * e); }
  function routeLine(y, lw, x0, x1, dashOff) {
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, COL.amber); g.addColorStop(1, COL.orange);
    ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.lineCap = 'butt'; ctx.setLineDash(G.band.dash || [14, 10]); ctx.lineDashOffset = dashOff;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
  }
  /** how far the band travels between two shutter samples (px): the length of its motion smear */
  const bandSmear = t => Math.min(150, Math.abs(bandSpeed(t)) * shutterDt());
  let LAY = null;
  const layerCanvases = () => LAY || (LAY = (() => { const a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = b.width = W; a.height = b.height = H;
    return { a, ac: a.getContext('2d'), b, bc: b.getContext('2d') }; })());
  /** draw() into a layer, then lay it down as the mean of k copies spread over ±L/2 vertically: the true box motion blur
   *  of everything that rides the band (text, karaoke, parcel, orange pill), so a glide reads as one smear, not ghosts */
  function withSmear(L, yA, yB, draw) {
    if (!(L > 1.5)) { draw(); return; }
    const Ly = layerCanvases(), main = ctx, y0 = Math.max(0, Math.floor(yA)), y1 = Math.min(H, Math.ceil(yB)), h = y1 - y0;
    if (h <= 0) return;
    Ly.ac.setTransform(1, 0, 0, 1, 0, 0); Ly.ac.globalAlpha = 1; Ly.ac.globalCompositeOperation = 'source-over'; Ly.ac.clearRect(0, y0, W, h);
    Ly.ac.setTransform(main.getTransform());
    ctx = Ly.ac; try { ctx.save(); draw(); ctx.restore(); } finally { ctx = main; }
    const k = Math.min(18, Math.max(3, Math.ceil(L / 2))), Y0 = Math.max(0, Math.floor(y0 - L / 2 - 1)), Y1 = Math.min(H, Math.ceil(y1 + L / 2 + 1)), bc = Ly.bc;
    bc.setTransform(1, 0, 0, 1, 0, 0); bc.globalAlpha = 1; bc.globalCompositeOperation = 'source-over'; bc.clearRect(0, Y0, W, Y1 - Y0);
    bc.globalCompositeOperation = 'lighter'; bc.globalAlpha = 1 / k;
    for (let i = 0; i < k; i++) bc.drawImage(Ly.a, 0, y0, W, h, 0, y0 - L / 2 + L * (i + .5) / k, W, h);
    bc.globalCompositeOperation = 'source-over'; bc.globalAlpha = 1;
    main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.drawImage(Ly.b, 0, Y0, W, Y1 - Y0, 0, Y0, W, Y1 - Y0); main.restore();
  }
  function drawBand(t) {
    // G.band.lock {frames, cap} (film 4 review 4; absent = films 1-3 as reviewed): the body and the route are drawn at the
    // FRAME's time (like the stops / phrases that ride them, crisp) — the shutter samples no longer spread the whole body
    // over its travel (a see-through smear on the first frame of a glide); its edges keep a ramp of ≤ `frames` frame of
    // travel, capped at `cap` px, and the dashed route stays crisp under the stops
    const lock = G.band.lock;
    if (lock) t = Math.round(t * FPS) / FPS;
    const b = S.band(t); if (!b || !(b.a > .003) || b.y0 > H + 40) return;
    const L = lock ? Math.min(lock.cap || 40, Math.abs(bandSpeed(t)) * (lock.frames || .3) / FPS) : bandSmear(t), h2 = L / 2, B = LOOK.band;
    const y0 = b.y0, y1 = b.y1, bh = y1 - y0;
    ctx.save(); ctx.globalAlpha *= b.a;
    // depth: the band lies ON the two windows — a soft shadow across each edge
    let g = ctx.createLinearGradient(0, y0 - B.shUp[0] - h2, 0, y0 - h2 * .5);
    g.addColorStop(0, 'rgba(4,5,14,0)'); g.addColorStop(1, `rgba(4,5,14,${B.shUp[1]})`);
    ctx.fillStyle = g; ctx.fillRect(0, y0 - B.shUp[0] - h2, W, B.shUp[0] + h2 * .5);
    g = ctx.createLinearGradient(0, y1 + h2 * .5, 0, y1 + B.shDown[0] + h2);
    g.addColorStop(0, `rgba(4,5,14,${B.shDown[1]})`); g.addColorStop(1, 'rgba(4,5,14,0)');
    ctx.fillStyle = g; ctx.fillRect(0, y1 + h2 * .5, W, B.shDown[0] + h2 * .5);
    // the body: night at 92 %, a breath lighter at the top. In a glide each edge is a linear ramp as long as the band
    // travels between two shutter samples = the box motion blur of a moving edge (the samples merge into one smear)
    const top = y0 - h2, tot = bh + L, f = L / tot;
    g = ctx.createLinearGradient(0, top, 0, top + tot);
    g.addColorStop(0, rgba(B.top, L > .5 ? 0 : B.alpha)); g.addColorStop(f, rgba(B.top, B.alpha));
    g.addColorStop(f + (1 - 2 * f) * .45, rgba(B.body, B.alpha)); g.addColorStop(1 - f, rgba(B.body, B.alpha)); g.addColorStop(1, rgba(B.body, L > .5 ? 0 : B.alpha));
    ctx.fillStyle = g; ctx.fillRect(0, top, W, tot);
    ctx.fillStyle = `rgba(255,255,255,${B.hair})`; ctx.fillRect(0, y1 - 1.5 - h2 * .3, W, 1.5);       // a hairline closes the bottom edge
    // the route: 4 px dashes (14 / 10) graded amber → orange, marching gently towards Douala (left → right); the part
    // already travelled by the parcel at full strength, the rest at 50 % (the line IS the progress bar)
    const dsh = G.band.dash || [14, 10], lw0 = G.band.line || 4, Ll = lock ? 0 : L;                 // the route's width (film 4: 8)
    const pg = call('progress', t), px = pg ? cl(pg.x, 0, W) : W, lw = lw0 + Ll, la = lw0 / lw, ly = y0 + lw0 / 2, off = -((t * B.march) % (dsh[0] + dsh[1]));
    ctx.save(); ctx.beginPath(); ctx.rect(0, ly - lw, px, 2 * lw); ctx.clip(); ctx.globalAlpha *= la; routeLine(ly, lw, 0, W, off); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(px, ly - lw, W - px, 2 * lw); ctx.clip(); ctx.globalAlpha *= la * B.ahead; routeLine(ly, lw, 0, W, off); ctx.restore();
    // the glint of a glide: a light runs along the route while the band moves (the whoosh, seen)
    if (b.glide && b.glide.p > 0 && b.glide.p < 1) {
      const p = b.glide.p, gx = lp(-200, W + 200, easeOut(p)), gi = Math.pow(Math.sin(PI * p), .6) * B.glint, gh = Math.max(4, lw * .9);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let gg = ctx.createLinearGradient(gx - 260, 0, gx + 40, 0);                  // a comet: long warm tail, bright head
      gg.addColorStop(0, 'rgba(254,86,13,0)'); gg.addColorStop(.75, `rgba(255,170,90,${(gi * .55).toFixed(3)})`); gg.addColorStop(.93, `rgba(255,236,200,${gi.toFixed(3)})`); gg.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = gg; ctx.fillRect(gx - 260, ly - gh / 2, 300, gh);
      ctx.translate(gx + 12, ly); ctx.scale(1, .22);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
      rg.addColorStop(0, `rgba(255,220,160,${(gi * .55).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = rg; ctx.fillRect(-70, -70, 140, 140); ctx.restore();
    }
    ctx.restore();
  }
  // ---------- the drawn kraft parcel (28 × 22, amber tape) ----------
  function parcelSprite(w, h) {
    return sprite(`dx_parcel_${w}_${h}`, w + 8, h + 8, (g) => {
      g.translate(4, 4);
      const body = g.createLinearGradient(0, 0, w * .4, h); body.addColorStop(0, '#DDB683'); body.addColorStop(.55, COL.kraft); body.addColorStop(1, '#B28554');
      g.fillStyle = body; rr(g, 0, 0, w, h, 2.6); g.fill();
      g.fillStyle = 'rgba(120,80,40,.30)'; g.fillRect(w - 4.2, 1, 3.4, h - 2);                     // the side in shade
      g.strokeStyle = 'rgba(110,72,36,.55)'; g.lineWidth = .7; g.beginPath(); g.moveTo(1.2, h * .30); g.lineTo(w - 1.2, h * .30); g.stroke();   // flap seam
      const tx = w * .5 - 3.2;                                                                          // amber tape over the top
      g.fillStyle = 'rgba(243,167,69,.95)'; g.fillRect(tx, 0, 6.4, h);
      g.fillStyle = 'rgba(255,236,200,.55)'; g.fillRect(tx + .6, 0, 1.1, h);
      g.fillStyle = 'rgba(160,96,30,.35)'; g.fillRect(tx + 5.6, 0, .8, h);
      g.fillStyle = '#F6EBD6'; rr(g, 3, h * .52, 7.2, 6.4, .8); g.fill();                              // the little label
      g.fillStyle = 'rgba(35,22,41,.55)'; g.fillRect(4.2, h * .52 + 1.8, 4.8, .7); g.fillRect(4.2, h * .52 + 3.6, 3.4, .7);
      g.strokeStyle = 'rgba(90,58,26,.7)'; g.lineWidth = .8; rr(g, .4, .4, w - .8, h - .8, 2.3); g.stroke();
      g.strokeStyle = 'rgba(255,240,215,.45)'; g.lineWidth = .7; g.beginPath(); g.moveTo(2, .9); g.lineTo(w - 3, .9); g.stroke();   // lit top edge
    }, 4);
  }
  function drawParcel(t) {
    const pg = call('progress', t); if (!pg || !(pg.a > .003)) return;
    const b = S.band(t), gl = b && b.glide, p = gl ? gl.p : 0, w = pg.w || 28, h = pg.h || 22;
    const hop = gl && gl.from && gl.to && gl.to !== 'off' ? Math.sin(PI * p) * LOOK.band.hop : 0;     // it hops with the band
    const P = G.band.pos || {}, dir = gl && gl.from && P[gl.to] !== undefined ? Math.sign(P[gl.to] - P[gl.from]) : 0;
    const tilt = -dir * Math.sin(TAU * p) * .14;
    ctx.save(); ctx.globalAlpha *= pg.a;
    ctx.fillStyle = `rgba(0,0,0,${(.35 * (1 - hop / (LOOK.band.hop * 1.6))).toFixed(3)})`;               // contact shadow on the line
    ctx.beginPath(); ctx.ellipse(pg.x, pg.y + .5, w * .55, 2.4, 0, 0, TAU); ctx.fill();
    ctx.translate(pg.x, pg.y - hop); ctx.rotate(tilt);
    const spr = parcelSprite(w, h); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(spr, -w / 2 - 4, -h - 4, w + 8, h + 8);
    ctx.restore();
  }

  // =====================================================================================================================
  // 2 · THE BAND PHRASES + THE FELT UNDERLINE
  // =====================================================================================================================
  /** an orange felt-pen stroke of length L (drawn: wobble, pressure, streaks of a felt tip), cached */
  function feltSprite(L, color, seed) {
    L = Math.max(20, Math.round(L));
    return sprite(`dx_felt_${L}_${color}_${seed}`, L + 40, 48, (g) => {
      const N = Math.max(6, Math.round(L / 18)), pts = [];
      for (let i = 0; i <= N; i++) { const u = i / N; pts.push([20 + u * L, 25 + (rnd(seed * 7.1 + i * 1.7) - .5) * 1.6 - 4 * u + 1.2 * Math.sin(u * PI * 1.4 + seed)]); }
      const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
        g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
      g.lineWidth = 10; path(); g.stroke();
      g.globalAlpha = .9; g.lineWidth = 11.5; g.beginPath(); g.moveTo(pts[0][0] - 1, pts[0][1]); g.lineTo(pts[1][0] * .3 + pts[0][0] * .7, pts[0][1]); g.stroke();   // the pen lands: more ink
      g.globalAlpha = 1;
      const [r, gg, bb] = hex(color);
      g.strokeStyle = `rgba(${Math.round(r * .78)},${Math.round(gg * .7)},${Math.round(bb * .7)},.30)`; g.lineWidth = 3.4; path(); g.stroke();   // pooled ink in the middle
      g.globalCompositeOperation = 'destination-out';                               // the streaks of a felt tip
      for (let k = 0; k < Math.round(L / 6); k++) {
        const x = 20 + rnd(seed + k * 3.3) * L, y = 25 - 4 * (x - 20) / L + (rnd(seed + k * 5.9) - .5) * 8, l = 8 + rnd(seed + k * 2.2) * 40;
        g.strokeStyle = `rgba(0,0,0,${(.12 + .22 * rnd(seed + k * 4.4)).toFixed(3)})`; g.lineWidth = .7 + rnd(seed + k * 6.6) * .8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y - l * 4 / L); g.stroke();
      }
    }, 2);
  }
  /** felt underline from x0 to x1 under baseline y, revealed to p (0..1) with a round head while it draws */
  function feltUnder(x0, x1, y, p, color, seed) {
    if (!(p > 0)) return;
    const L = x1 - x0 + 16, spr = feltSprite(L, color, seed), xs = x0 - 8 - 20, ys = y - 25;
    const head = x0 - 8 + L * easeOut(cl(p));
    ctx.save(); ctx.beginPath(); ctx.rect(xs, ys - 10, head - xs, 70); ctx.clip();
    ctx.drawImage(spr, xs, ys, spr._w, spr._h); ctx.restore();
    if (p < 1) { const u = (head - x0 + 8) / L; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(head, y - 4 * u + .5, 4.6, 0, TAU); ctx.fill(); }
  }
  function drawTexts(t) {
    const B = LOOK.band;
    for (const x of call('texts', t, []) || []) {
      if (!(x.a > .003)) continue;
      let z = x.size; const maxW = (x.maxX || G.band.textMaxX) - x.x;
      for (const line of x.lines) { const s = line.map(w => w.w).join(' '), w = tw(s, SAT(z), B.ls); if (w > maxW) z = Math.floor(z * maxW / w); }
      const f = SAT(z), sp = tw(' ', f, B.ls);
      x.lines.forEach((line, i) => {
        const al = x.a * (x.alpha && x.alpha[i] !== undefined ? x.alpha[i] : 1); if (!(al > .003)) return;
        const base = Math.round(x.y0 + i * x.lead + x.lead / 2 + CAP * z / 2) + (x.dy || 0);
        ctx.save(); ctx.globalAlpha *= al; ctx.font = f; ctx.letterSpacing = B.ls + 'px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        let xx = x.x; const spans = [];
        for (const w of line) {
          const w0 = xx;
          for (const sg of w.segs) { ctx.fillStyle = col(sg.color); ctx.fillText(sg.s, xx, base); xx += tw(sg.s, f, B.ls); }
          spans.push({ w: NRMU(w.w), x0: w0, x1: xx - B.ls }); xx += sp;
        }
        const u = x.underline;
        if (u && u.line === i && u.p > 0) {
          const seq = String(u.word).split(' ').map(NRMU).filter(Boolean);
          for (let k = 0; k + seq.length <= spans.length; k++) {
            if (seq.every((q, j) => spans[k + j].w === q)) { feltUnder(spans[k].x0, spans[k + seq.length - 1].x1, base + 13, u.p, col(u.color), 3 + i * 7 + k); break; }
          }
        }
        ctx.restore();
      });
    }
  }

  // =====================================================================================================================
  // 3 · THE REAL-VOICE SUBTITLES (§3.5) — band or box
  // =====================================================================================================================
  const subRowOf = id => rows().find(r => r[2] === id);
  const GEO = new Map();
  /** the fixed slots of a card: each word owns its 900-weight width (the 700 / 900 cross-fade never reflows) */
  function subGeo(s) {
    const key = s.id + '|' + s.mode; let g = GEO.get(key); if (g) return g;
    const box = s.box, pad = LOOK.kara.padBox;
    const x0 = s.mode === 'box' ? box.x0 + pad : G.band.textX, x1 = s.mode === 'box' ? box.x1 - pad : G.band.textMaxX;
    let z = s.layout.size;
    const lw = (l, q) => l.reduce((m, w, i) => m + tw(w.w, SAT(q)) + (i ? tw(' ', SAT(q)) : 0), 0);
    const mx = Math.max(...s.lines.map(l => lw(l, z)));
    if (mx > x1 - x0) z = Math.floor(z * (x1 - x0) / mx);
    const sp = tw(' ', SAT(z));
    // each slot is the mean of the 700 and 900 widths: the said words keep a natural spacing and the word being said
    // (900, centred on its slot) only eats ≈ 2 % of each neighbouring space
    const lines = s.lines.map(l => { let x = 0; return l.map(w => { const w9 = tw(w.w, SAT(z)), w7 = tw(w.w, SAT(z, 700)), o = { x, w9, w7, ws: (w7 + w9) / 2 }; x += o.ws + sp; return o; }); });
    g = { x0, x1, size: z, lines }; GEO.set(key, g); return g;
  }
  /** per word: k = « being said » 0..1, sd = said 0..1, colour — punctuation and unmatched tokens follow their neighbour */
  function wordStates(s, t) {
    const flat = []; s.lines.forEach((l, i) => l.forEach((w, j) => flat.push({ i, j, w, s: w.s, e: w.e })));
    let prev = null; for (const q of flat) { if (q.s !== null && q.s !== undefined) prev = q; else if (prev) { q.s = prev.s; q.e = prev.e; } }
    let next = null; for (let k = flat.length - 1; k >= 0; k--) { const q = flat[k]; if (q.s !== null && q.s !== undefined) next = q; else if (next) { q.s = next.s; q.e = next.e; } }
    const KC = S.KEYCOL || {};
    for (const q of flat) {
      if (q.s === null || q.s === undefined) { q.k = 0; q.sd = 1; } else {
        q.k = Math.min(easeOut(kk(t, q.s - .01, q.s + .035)), 1 - kk(t, q.e + .05, q.e + .11));   // ≈ 1 frame: no mushy double weight
        q.sd = kk(t, q.s - .02, q.s + .05);
      }
      const n = nrm(q.w.w), kc = Object.keys(KC).find(c => n.startsWith(c));
      q.key = kc ? KC[kc] : null;
      q.color = q.key === 'violet' ? COL.violet : (q.key && q.sd > 0 ? col(q.key) : COL.white);
      q.keyK = q.key && q.key !== 'violet' ? q.sd : 0;
    }
    return flat;
  }
  function envAt(voice, u, band) {
    const VE = window.VOICE_ENV, V = VE && VE.voices && VE.voices[voice]; if (!V) return null;
    const arr = band === undefined ? V.rms : V.bands && V.bands.length ? V.bands[band % V.bands.length] : V.rms;
    const x = u * (VE.fps || 60), i = Math.floor(x), f = x - i; if (i < 0 || i >= arr.length - 1) return 0;
    return arr[i] + (arr[i + 1] - arr[i]) * f;
  }
  /** the live waveform: 16 bars, symmetric (a syllable starts in the middle and ripples out), amber while the voice speaks */
  function wave(s, t, xL, yC) {
    const L = LOOK.wave, voice = s.env ? s.env.voice : s.voice, u = s.env ? s.env.u : 0, mid = (L.bars - 1) / 2;
    for (let i = 0; i < L.bars; i++) {
      const d = Math.abs(i - mid), lag = d * L.lag;
      const e = envAt(voice, u - lag); const e0 = e === null ? .15 + .1 * Math.sin(t * 9 + i) : e;
      const bv = envAt(voice, u - lag, i), v = cl(e === null ? e0 : .62 * e0 + .38 * (bv === null ? e0 : bv) * (e0 > .03 ? 1 : 0));
      const shape = .5 + .5 * Math.cos(d / mid * PI / 2), h = L.hMin + (L.hMax - L.hMin) * v * shape;
      const on = cl(v * 5);
      ctx.fillStyle = rgba(mix(COL.grey, COL.amber, on), .55 + .45 * on);
      rr(ctx, xL + i * L.pitch, yC - h / 2, L.bw, h, L.bw / 2); ctx.fill();
    }
  }
  /** the subtitle cards to draw at t (a card leaving cross-fades with the one that follows it at its end) */
  function subsAt(t) {
    const s = call('subtitles', t); if (!s) return [];
    const out = [{ s, a: s.a, dy: s.t1 !== undefined ? -14 * easeOut(kk(t, s.t1, s.t1 + .12)) : 0 }];
    if (s.t1 !== undefined && t >= s.t1) {
      const nx = rows().find(r => (r[4] === 'sub2' || r[4] === 'sub') && r[2] !== s.id && Math.abs(r[0] - s.t1) < .03);
      if (nx) {
        const s2 = call('subtitles', Math.max(t, s.t1 + .125)) || null;
        if (s2 && s2.id === nx[2]) {
          const b = S.band(t), a = easeOut(kk(t, s2.t0 + .04, s2.t0 + .15)) * (s2.mode === 'band' ? b.a : 1);   // a beat after the old one starts to leave
          const box = s2.mode === 'box' ? s2.box : { x0: s2.box.x0, x1: s2.box.x1, y0: b.y0, y1: b.y1 }, dy = box.y0 - s2.box.y0;
          out.push({ s: Object.assign({}, s2, { box, layout: Object.assign({}, s2.layout, { headY: s2.layout.headY + dy, line1Y: s2.layout.line1Y + dy, line2Y: s2.layout.line2Y + dy }), env: { voice: s2.voice, u: t - (S.T[s2.voice] || 0) } }), a, dy: 0 });
        }
      }
    }
    return out;
  }
  function drawSub(s, A, t, o = {}) {
    if (!(A > .003)) return;
    const geo = subGeo(s), Lk = LOOK.kara, rise = Lk.rise * (1 - easeOut(kk(t, s.t0, s.t0 + .2)));
    // a card that follows another one in place (same voice block) keeps the header still: only its lines rise
    const chained = rows().some(r => (r[4] === 'sub2' || r[4] === 'sub') && r[2] !== s.id && Math.abs(r[1] - s.t0) < .03);
    if (o.head !== false) { ctx.save(); ctx.translate(0, chained ? 0 : rise); drawHead(s, o.headA !== undefined ? o.headA : A, t, geo); ctx.restore(); }
    ctx.save(); ctx.translate(0, rise + (o.dy || 0)); drawLines(s, A, t, geo); ctx.restore();
  }
  function drawHead(s, A, t, geo) {
    if (s.mode === 'box') {
      const B = s.box;
      ctx.save(); ctx.globalAlpha *= A; ctx.shadowColor = 'rgba(0,0,0,.40)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      ctx.fillStyle = rgba(COL.night, .88); rr(ctx, B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, G.sigSub && G.sigSub.r || 20); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1.5;
      rr(ctx, B.x0 + .75, B.y0 + .75, B.x1 - B.x0 - 1.5, B.y1 - B.y0 - 1.5, (G.sigSub && G.sigSub.r || 20) - .75); ctx.stroke(); ctx.restore();
    }
    // header « vraie voix · … » + the live waveform (x 850–946)
    if (!(A > .003)) return;
    const hb = s.layout.headY + LOOK.head.base;
    ctx.save(); ctx.globalAlpha *= A;
    const hz = (G.sub && G.sub.headSize) || LOOK.head.size, hf = SAT(hz, LOOK.head.weight);
    ctx.font = hf; ctx.letterSpacing = '0px'; ctx.fillStyle = `rgba(255,255,255,${LOOK.head.alpha})`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
    const hx = geo.x0, wx0 = (G.sub && G.sub.waveX0) || 850, room = wx0 - 18 - hx, hw = tw(s.head, hf, 0);
    if (hw > room) { ctx.save(); ctx.translate(hx, hb); ctx.scale(room / hw, 1); ctx.fillText(s.head, 0, 0); ctx.restore(); } else ctx.fillText(s.head, hx, hb);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    wave(s, t, wx0, hb - 10);
    ctx.restore();
  }
  function drawLines(s, A, t, geo) {
    const Lk = LOOK.kara;
    // the 2 karaoke lines
    const z = geo.size, f7 = SAT(z, 700), f9 = SAT(z, 900), st = wordStates(s, t), bases = [s.layout.line1Y, s.layout.line2Y];
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    for (const q of st) {
      const slot = geo.lines[q.i] && geo.lines[q.i][q.j]; if (!slot) continue;
      const cx = geo.x0 + slot.x + slot.ws / 2, y = Math.round(bases[q.i] !== undefined ? bases[q.i] : bases[1] + (q.i - 1) * s.layout.lead);
      const isV = q.key === 'violet', rest = isV ? lp(.5, .92, q.sd) : lp(Lk.coming, Lk.said, q.sd) + (Lk.keySaid - Lk.said) * q.keyK;
      ctx.fillStyle = q.color;
      if (q.k < .999) { ctx.font = f7; ctx.globalAlpha = A * rest * (1 - q.k); ctx.fillText(q.w.w, cx, y); }
      if (q.k > .001) { ctx.font = f9; ctx.globalAlpha = A * q.k; ctx.fillText(q.w.w, cx, y); }
    }
    ctx.restore();
  }
  function drawSubs(t, mode, sg) {
    const L = subsAt(t).filter(q => q.s.mode === mode); if (!L.length) return;
    if (mode === 'box' && sg && sg.cta && sg.cta.t0 !== undefined) {         // the call pill takes the box's place: no double exposure
      const k = 1 - kk(t, sg.cta.t0, sg.cta.t0 + .05); for (const q of L) q.a *= k;
    }
    const lead = L.reduce((m, q) => (q.a > m.a ? q : m), L[0]), headA = Math.max(...L.map(q => q.a));
    for (const q of L) drawSub(q.s, q.a, t, { dy: q.dy, head: q === lead, headA });   // the header is drawn once (no double)
  }
  /** where the karaoke draws `word` of card subId NOW: {x, y, w, h, size, cx, cy, baseline} (screen px) */
  function wordBox(subId, word) {
    const t = typeof window.__t === 'number' ? window.__t : 0, row = subRowOf(subId); if (!row) return null;
    const tt = cl(t, row[0] + 1e-3, row[1] - 1e-3);
    let s = call('subtitles', tt); if (!s || s.id !== subId) s = call('subtitles', Math.min(row[1] - 1e-3, row[0] + .13));
    if (!s || s.id !== subId) return null;
    const geo = subGeo(s), k = nrm(word);
    for (let i = 0; i < s.lines.length; i++) for (let j = 0; j < s.lines[i].length; j++) {
      if (!nrm(s.lines[i][j].w).startsWith(k)) continue;
      const slot = geo.lines[i][j], rise = LOOK.kara.rise * (1 - easeOut(kk(tt, s.t0, s.t0 + .2)));
      const base = (i === 0 ? s.layout.line1Y : s.layout.line2Y + (i - 1) * s.layout.lead) + rise, h = CAP * geo.size;
      const cx = geo.x0 + slot.x + slot.ws / 2;
      return { x: cx - slot.w9 / 2, y: base - h, w: slot.w9, h, size: geo.size, cx, cy: base - h / 2, baseline: base };
    }
    return null;
  }

  // =====================================================================================================================
  // 4 · THE PILLS (§3.4) — drawn flags
  // =====================================================================================================================
  function flagSprite(code, w, h) {
    return sprite(`dx_flag_${code}_${w}_${h}`, w + 8, h + 8, (g) => {
      g.translate(4, 4); g.save(); rr(g, 0, 0, w, h, 4); g.clip();
      if (code === 'CN') {                                    // 30 × 20 grid: big star (5,5) r 3; small (10,2) (12,4) (12,7) (10,9) r 1, each aimed at the big one
        const u = w / 30; g.fillStyle = '#EE1C25'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFDE00';
        star(g, 5 * u, 5 * u, 3 * u); g.fill();
        for (const [x, y] of [[10, 2], [12, 4], [12, 7], [10, 9]]) { star(g, x * u, y * u, u, Math.atan2(5 - y, 5 - x)); g.fill(); }
      } else {                                                // Cameroon: green · red · yellow, the yellow star in the red band
        const c = ['#007A5E', '#CE1126', '#FCD116']; c.forEach((k, i) => { g.fillStyle = k; g.fillRect(i * w / 3 - .3, 0, w / 3 + .6, h); });
        g.fillStyle = '#FCD116'; star(g, w / 2, h / 2 + h * .01, h * .175); g.fill();
      }
      const sh = g.createLinearGradient(0, 0, w, h);          // a breath of cloth: light upper-left, shade lower-right
      sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.12)');
      g.fillStyle = sh; g.fillRect(0, 0, w, h); g.restore();
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .8; rr(g, .4, .4, w - .8, h - .8, 3.6); g.stroke();
    }, 3);
  }
  function drawPill(p) {
    if (!p || !(p.a > .003)) return;
    const Lp = LOOK.pill, h = p.y1 - p.y0, z = (G.pillG && G.pillG.size) || 40, f = SAT(z), [fw, fh] = (G.pillG && G.pillG.flag) || [54, 36];
    const parts = String(p.text).split(' · '), sep = ' · ', ls = Lp.ls;
    const tW = parts.reduce((m, q, i) => m + tw(q, f, ls) + (i ? tw(sep, f, ls) : 0), 0);
    const w = Lp.padL + fw + Lp.gap + tW + Lp.padR, x = p.x, y = p.y0, c = col(p.color), r = Math.min(h / 2, (G.pillG && G.pillG.r) || 30);
    ctx.save(); ctx.globalAlpha *= p.a; ctx.translate(0, p.dy || 0);
    ctx.shadowColor = 'rgba(8,6,22,.40)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(mix(c, '#FFFFFF', .12), 1)); g.addColorStop(1, c);
    ctx.fillStyle = g; rr(ctx, x, y, w, h, r); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + r * .7, y + 1.4); ctx.lineTo(x + w - r * .7, y + 1.4); ctx.stroke();
    const fx = x + Lp.padL, fy = y + (h - fh) / 2;                                            // the flag, ringed in white like a sticker
    ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(ctx, fx - Lp.ring, fy - Lp.ring, fw + 2 * Lp.ring, fh + 2 * Lp.ring, 4 + Lp.ring); ctx.fill();
    const fs = flagSprite(p.flag === 'CN' ? 'CN' : 'CM', fw, fh); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(fs, fx - 4, fy - 4, fw + 8, fh + 8);
    ctx.font = f; ctx.letterSpacing = ls + 'px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const base = Math.round(y + h / 2 + CAP * z / 2); let xx = fx + fw + Lp.gap; const tc = p.textColor || COL.ink;
    parts.forEach((q, i) => {
      if (i) { ctx.fillStyle = tc; ctx.globalAlpha *= Lp.dot; ctx.fillText(sep, xx, base); ctx.globalAlpha /= Lp.dot; xx += tw(sep, f, ls); }
      ctx.fillStyle = tc; ctx.fillText(q, xx, base); xx += tw(q, f, ls);
    });
    ctx.restore();
  }

  // =====================================================================================================================
  // 5 · THE STAMPS (§3.6)
  // =====================================================================================================================
  /** the stamp: Satoshi 900 capitals, double frame (8 + 3 px, gap 6), procedural ink (≈ 15 % starved), cached */
  function stampSprite(lines, size, color) {
    const key = `dx_stamp_${lines.join('|')}_${size}_${color}`, f = SAT(size), ls = Math.round(size * .015), Ls = LOOK.stamp;
    const lh = size * .9, ws = lines.map(l => tw(l, f, ls) - ls), ink0 = inkOf(lines[0], f), inkN = inkOf(lines[lines.length - 1], f);
    // optical balance: the frame is set on the CAPITALS; accents and the cedilla reach half-way into the padding
    const capH = CAP * size, top = -(capH + .55 * Math.max(0, ink0.asc - capH)), bot = (lines.length - 1) * lh + .55 * inkN.desc;
    const inkW = Math.max(...ws), inkH = bot - top;
    const pad = Math.round(size * .16), m = pad + Ls.inner + Ls.gap + Ls.outer, fw = inkW + 2 * m, fh = inkH + 2 * m, marg = 26;
    const spr = sprite(key, fw + 2 * marg, fh + 2 * marg, (g, cw, ch) => {
      const ox = marg, oy = marg, cx = cw / 2, seed = lines.join('').length * 7.3 + size;
      g.fillStyle = color; g.strokeStyle = color; g.lineJoin = 'round';
      // the double frame, with the slight unevenness of rubber
      const frame = (inset, lw, r) => {
        const x0 = ox + inset + lw / 2, y0 = oy + inset + lw / 2, w = fw - 2 * inset - lw, h = fh - 2 * inset - lw;
        g.lineWidth = lw; rr(g, x0, y0, w, h, r); g.stroke();
      };
      frame(0, Ls.outer, Ls.rOut); frame(Ls.outer + Ls.gap, Ls.inner, Ls.rIn);
      // the letters, centred line by line
      g.font = f; g.letterSpacing = ls + 'px'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      lines.forEach((l, i) => { const x = cx - ws[i] / 2, y = oy + m - top + i * lh; g.fillText(l, x, y); g.lineWidth = 1.2; g.strokeText(l, x, y); });
      // ink: tone first (pooled darker / starved lighter clouds), then the holes
      g.globalCompositeOperation = 'source-atop';
      for (let i = 0; i < 18; i++) {
        const x = ox + rnd(seed + i * 3.1) * fw, y = oy + rnd(seed + i * 4.7) * fh, r = 40 + rnd(seed + i * 5.3) * 120, dk = rnd(seed + i * 6.1) > .5;
        const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, dk ? 'rgba(90,20,0,.16)' : 'rgba(255,240,215,.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      g.globalCompositeOperation = 'destination-out';
      const area = fw * fh;
      for (let i = 0; i < area / 34; i++) {                                    // fine speckles
        g.fillStyle = `rgba(0,0,0,${(.45 + .55 * rnd(seed + i * 1.37)).toFixed(3)})`;
        g.beginPath(); g.arc(ox + rnd(seed + i * 2.11) * fw, oy + rnd(seed + i * 3.07) * fh, .45 + 1.25 * Math.pow(rnd(seed + i * 4.03), 2), 0, TAU); g.fill();
      }
      for (let i = 0; i < Math.round(area / 3400); i++) {                      // starved patches (clusters of small bites)
        const x = ox + rnd(seed + i * 7.7) * fw, y = oy + rnd(seed + i * 8.9) * fh, n = 8 + Math.round(rnd(seed + i * 9.1) * 12), R = 10 + rnd(seed + i * 2.9) * 26;
        for (let j = 0; j < n; j++) { const a = rnd(seed + i * 13 + j * 1.9) * TAU, d = Math.sqrt(rnd(seed + i * 17 + j * 2.3)) * R;
          g.fillStyle = `rgba(0,0,0,${(.30 + .5 * rnd(seed + i * 19 + j)).toFixed(3)})`; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * .7, .8 + rnd(seed + i * 23 + j) * 2.8, 0, TAU); g.fill(); }
      }
      for (let i = 0; i < Math.round(area / 2800); i++) {                      // drag streaks of the rubber
        const x = ox + rnd(seed + i * 5.5) * fw, y = oy + rnd(seed + i * 6.6) * fh, l = 18 + rnd(seed + i * 7.1) * 70, a = -.25 + rnd(seed + i * 8.2) * .2;
        g.strokeStyle = `rgba(0,0,0,${(.18 + .3 * rnd(seed + i * 9.9)).toFixed(3)})`; g.lineWidth = .7 + rnd(seed + i * 3.9) * 1.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      for (let i = 0; i < Math.round((fw + fh) / 9); i++) {                     // bitten edges of the outer frame
        const u = rnd(seed + i * 11.3), onH = rnd(seed + i * 12.1) > fh / (fw + fh), side = rnd(seed + i * 13.7) > .5;
        const x = onH ? ox + u * fw : ox + (side ? fw : 0), y = onH ? oy + (side ? fh : 0) : oy + u * fh;
        g.fillStyle = 'rgba(0,0,0,.85)'; g.beginPath(); g.arc(x + (rnd(seed + i * 3.3) - .5) * 4, y + (rnd(seed + i * 4.4) - .5) * 4, 1 + rnd(seed + i * 5.5) * 3, 0, TAU); g.fill();
      }
    }, 1);
    spr._fw = fw; spr._fh = fh; return spr;
  }
  /** the dark halo under a stamp (tight + wide), pre-blurred once: amber on kraft, orange on a crowd stay readable */
  function haloSprite(spr, key) {
    const M = 60;
    return sprite('dx_halo_' + key, spr._w + 2 * M, spr._h + 2 * M, (g) => {
      const off = 4000, w = spr._w, h = spr._h;          // draw the stamp far away: only its shadow lands on the canvas
      g.shadowOffsetX = off; g.shadowColor = 'rgba(12,6,24,.62)'; g.shadowBlur = 7; g.drawImage(spr, M - off, M, w, h);
      g.shadowColor = 'rgba(12,6,24,.42)'; g.shadowBlur = 26; g.drawImage(spr, M - off, M, w, h);
    }, 1);
  }
  /** a stamp never covers the top chrome (flag pill, logo, « VRAIES IMAGES »): it sits just under it if its window is short */
  const chromeY = () => Math.max((G.pillG && G.pillG.y1) || 230, (G.logo && G.logo.textY1) || 270) + 14;
  function drawStamp(st, t) {
    const age = st.age; if (!(age >= 0) || !(st.a > .003)) return;
    const Ls = LOOK.stamp, c = col(st.color), spr = stampSprite(st.lines, st.size, c), w = spr._w, h = spr._h;
    const k = kk(age, 0, Ls.frames / FPS), sc = st.scale * (Ls.slam - (Ls.slam - 1) * easeOut(k));
    const alpha = st.a * (.55 + .45 * kk(age, 0, 1.5 / FPS));
    const ra = Math.abs((st.rot || 0) * PI / 180), hh = st.scale * (spr._fh / 2 * Math.cos(ra) + spr._fw / 2 * Math.sin(ra));
    const cy = Math.max(st.cy, chromeY() + hh);
    if (st.halo) {                                                  // review 2: a night pool under the stamp (amber on amber rolls)
      const Hh = st.halo, w = call('windows', t, {}) || {}, R = w[st.ride] && w[st.ride].rect, rad = Hh.r * Math.max(.6, st.scale);
      const ka = Hh.a * st.a * easeOut(kk(age, 0, .10));
      if (R && ka > .003) {
        ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
        const g = ctx.createRadialGradient(st.cx, cy, 0, st.cx, cy, rad);
        g.addColorStop(0, rgba(Hh.color, ka)); g.addColorStop(.55, rgba(Hh.color, ka * .75)); g.addColorStop(1, rgba(Hh.color, 0));
        ctx.fillStyle = g; ctx.fillRect(st.cx - rad, cy - rad, 2 * rad, 2 * rad); ctx.restore();
      }
    }
    ctx.save(); ctx.translate(st.cx, cy); ctx.rotate((st.rot || 0) * PI / 180); ctx.scale(sc, sc);
    const sm = st.smear || 0;
    if (sm > 1) {                                                   // the filé: it leaves smeared with the image
      for (let i = 6; i >= 1; i--) { ctx.globalAlpha = alpha * .42 * (1 - i / 7); ctx.drawImage(spr, -w / 2 - sm * i / 6 / sc, -h / 2, w, h); }
    }
    ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high';
    const hs = haloSprite(spr, st.lines.join('|') + st.size + c); ctx.drawImage(hs, -hs._w / 2, -hs._h / 2 + 3, hs._w, hs._h);
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    // 14 grains of ink thrown by the hit, which stay where they land
    if (age > .5 / FPS) {
      const q = easeOut(kk(age, .5 / FPS, 5 / FPS)), seed = st.size + st.lines.join('').length * 3.1;
      for (let i = 0; i < Ls.dust; i++) {
        const a = rnd(seed + i * 2.71) * TAU, ex = Math.cos(a), ey = Math.sin(a);
        const rx = spr._fw / 2 + 6 + rnd(seed + i * 3.9) * 26, ry = spr._fh / 2 + 4 + rnd(seed + i * 5.1) * 20, d = 10 + rnd(seed + i * 6.3) * 30;
        const x = ex * (rx + d * q), y = ey * (ry + d * q * .7), r = 1.6 + rnd(seed + i * 7.7) * 3.6;
        ctx.globalAlpha = alpha * (.65 + .35 * rnd(seed + i * 8.1)); ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        if (rnd(seed + i * 9.3) > .55) { ctx.beginPath(); ctx.arc(x + ex * r * 1.3, y + ey * r * 1.1, r * .55, 0, TAU); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  /** the whole screen's red / blue split (±d px): red reads from the right, blue from the left */
  function rgbSplit(d) {
    const di = Math.round(d); if (di < 1) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, W, H), a = img.data, src = a.slice(), row = W * 4;
    for (let y = 0; y < H; y++) {
      const o = y * row;
      for (let x = 0; x < W; x++) { const i = o + x * 4; a[i] = src[o + Math.min(W - 1, x + di) * 4]; a[i + 2] = src[o + Math.max(0, x - di) * 4 + 2]; }
    }
    ctx.putImageData(img, 0, 0); ctx.restore();
  }

  // =====================================================================================================================
  // 6 · THE SIGNATURE (§3.10)
  // =====================================================================================================================
  function nightSprite() {
    return sprite('dx_night', W, H, (g) => {
      g.fillStyle = COL.night; g.fillRect(0, 0, W, H);
      const P = G.panel || { x: 24, y: 190, w: 1032, h: 527 }, cx = P.x + P.w / 2, cy = P.y + P.h * .7;
      let rg = g.createRadialGradient(cx, cy, 40, cx, cy, 1150); rg.addColorStop(0, 'rgba(46,54,112,.55)'); rg.addColorStop(.55, 'rgba(30,36,80,.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      rg = g.createRadialGradient(W / 2, H * .5, H * .35, W / 2, H * .5, H * .78); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(2,3,10,.55)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    });
  }
  function whiteMark(g, cx, cy, markW) {                          // the Bonzini mark in white (its pieces span 60 % of the 100-unit box)
    if (!LOOK_LOGO()) return;
    const s = markW / 60; g.save(); g.translate(cx, cy); g.scale(s, s); g.translate(-50, -50); g.fillStyle = '#FFFFFF';
    for (const pc of LOGO) g.fill(pc.path); g.restore();
  }
  const LOOK_LOGO = () => typeof LOGO !== 'undefined' && LOGO && LOGO.length;
  function plateSprite(P) {
    const w = P.x1 - P.x0, h = P.y1 - P.y0, r = LOOK.plate.r;
    return sprite(`dx_plate_${w}_${h}_${P.line1}_${P.line2}`, w, h, (g) => {
      const gr = g.createLinearGradient(0, 0, w * .35, h * 1.6); gr.addColorStop(0, rgba(mix(COL.violet, '#FFFFFF', .08), 1)); gr.addColorStop(.5, COL.violet); gr.addColorStop(1, COL.violetD);
      g.fillStyle = gr; rr(g, 0, 0, w, h, r); g.fill();
      g.save(); rr(g, 0, 0, w, h, r); g.clip();
      const gl = g.createLinearGradient(0, 0, 0, h * .55); gl.addColorStop(0, 'rgba(255,255,255,.16)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl; g.fillRect(0, 0, w, h * .55);
      const bt = g.createLinearGradient(0, h * .7, 0, h); bt.addColorStop(0, 'rgba(40,0,90,0)'); bt.addColorStop(1, 'rgba(40,0,90,.22)');
      g.fillStyle = bt; g.fillRect(0, h * .7, w, h * .3);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.30)'; g.lineWidth = 1.5; rr(g, .75, .75, w - 1.5, h - 1.5, r - .75); g.stroke();
      const lx0 = (P.logoX0 || P.x0 + 30) - P.x0, lx1 = (P.logoX1 || P.x0 + 110) - P.x0;
      whiteMark(g, (lx0 + lx1) / 2, h / 2, lx1 - lx0);
      const x = lx1 + 20, z1 = P.size1 || 50, z2 = P.size2 || 40, f1 = SAT(z1), f2 = SAT(z2, 700);
      const b1 = P.route ? Math.round(30 + CAP * z1) : Math.round(h / 2 - 8), b2 = P.route ? Math.round(b1 + 18 + CAP * z2) : Math.round(h / 2 + 8 + CAP * z2 + 6);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#FFFFFF';
      let s1 = 1; const w1 = tw(P.line1, f1), maxW = w - 36 - x; if (w1 > maxW) s1 = maxW / w1;
      g.save(); g.translate(x, b1); g.scale(s1, 1); g.font = f1; g.fillText(P.line1, 0, 0); g.restore();
      g.globalAlpha = .9; g.font = f2; const w2 = tw(P.line2, f2);
      g.save(); g.translate(x, b2); if (w2 > maxW) g.scale(maxW / w2, 1); g.fillText(P.line2, 0, 0); g.restore();
    }, 1);
  }
  /** review 2: the plate's route row — a dashed line under « Chine → Douala » and the kraft parcel travelling on it (in a loop
   *  while the narrator speaks, at rest before; it holds with the freeze): {x0, x1, y} in screen px */
  function plateRoute(P) {
    const lx1 = (P.logoX1 || P.x0 + 110), x = lx1 + 20, f2 = SAT(P.size2 || 40, 700), seg = String(P.line2).split(' · ')[0];
    return { x0: x + 4, x1: x + tw(seg, f2) - 4, y: P.y1 - 34 };
  }
  function drawPlateRoute(sg, P, t, al) {
    if (!P.route) return;
    const r = plateRoute(P), Ld = 14, Lg = 10, lw = 5;
    ctx.save(); ctx.globalAlpha *= al;
    const g = ctx.createLinearGradient(r.x0, 0, r.x1, 0); g.addColorStop(0, COL.amber); g.addColorStop(1, COL.orange);
    ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.setLineDash([Ld, Lg]); ctx.lineDashOffset = -((t * 22) % (Ld + Lg));
    ctx.beginPath(); ctx.moveTo(r.x0, r.y); ctx.lineTo(r.x1, r.y); ctx.stroke(); ctx.setLineDash([]);
    for (const [xx, c] of [[r.x0, COL.amber], [r.x1, COL.orange]]) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(xx, r.y, 8, 0, TAU); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(xx, r.y, 5, 0, TAU); ctx.fill(); }
    const t0 = sg.route0 !== undefined ? sg.route0 : P.t0 + .6, trip = 1.6, u = t < t0 ? 0 : ((t - t0) % trip) / trip, k = t < t0 ? 0 : easeInOut(Math.min(1, u / .82));
    const px = lp(r.x0 + 10, r.x1 - 10, k), hop = Math.sin(PI * k) * 6;
    if (t >= t0 && u > .82) {                                       // it lands in Douala: an orange ring
      const q = (u - .82) / .18; ctx.strokeStyle = rgba(COL.orange, 1 - q); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x1, r.y, 8 + 16 * q, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha *= (t >= t0 && u > .9) ? 1 - (u - .9) / .1 : 1;
    ctx.fillStyle = 'rgba(30,0,60,.35)'; ctx.beginPath(); ctx.ellipse(px, r.y + 2, 17, 3, 0, 0, TAU); ctx.fill();
    const spr = parcelSprite(32, 25); ctx.drawImage(spr, px - 16 - 4, r.y - 25 - 4 - hop, 40, 33);
    ctx.restore();
  }
  const easeInOut = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  function drawPlate(sg, t) {
    const P = sg.plate; if (!P || !(P.a > 0)) return;
    const w = P.x1 - P.x0, h = P.y1 - P.y0, cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2;
    const tf = sg.freezeAt !== undefined ? Math.min(t, sg.freezeAt) : t, land = P.t0 + .25, d = tf - land;
    const dy = -(1 - P.drop) * LOOK.plate.fall, al = P.a * easeOut(kk(tf, P.t0, P.t0 + .08));
    const sq = d > 0 ? .045 * Math.exp(-d * 16) * Math.sin(d * 46) : 0;   // the « tonk »: a short squash on landing
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(cx, cy + dy + h / 2); ctx.scale(1 + sq * .6, 1 - sq); ctx.translate(-cx, -(cy + h / 2));
    ctx.shadowColor = 'rgba(4,2,16,.55)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 18 + 30 * (1 - cl(P.drop));
    ctx.drawImage(plateSprite(P), P.x0, P.y0, w, h); ctx.shadowColor = 'transparent';
    const sw = kk(tf, land + .10, land + .85);                       // one sheen crosses the plate once it has landed
    if (sw > 0 && sw < 1) {
      ctx.save(); rr(ctx, P.x0, P.y0, w, h, LOOK.plate.r); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      const x = P.x0 - 220 + (w + 440) * ease(sw); ctx.translate(x, cy); ctx.transform(1, 0, -.5, 1, 0, 0);
      const g = ctx.createLinearGradient(-90, 0, 90, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,240,255,.20)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-90, -h, 180, 2 * h); ctx.restore();
    }
    drawPlateRoute(sg, P, tf, 1);
    ctx.restore();
  }
  function ctaSprite(P) {
    const w = P.x1 - P.x0, h = P.y1 - P.y0, Lc = LOOK.cta;
    return sprite(`dx_cta_${w}_${h}_${P.line1}_${P.line2}`, w, h, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, rgba(mix(COL.amber, '#FFFFFF', .12), 1)); gr.addColorStop(1, rgba(mix(COL.amber, '#C9761A', .25), 1));
      g.fillStyle = gr; rr(g, 0, 0, w, h, Lc.r); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(Lc.r * .8, 1.6); g.lineTo(w - Lc.r * .8, 1.6); g.stroke();
      const x = Lc.padL, z1 = P.size1 || 48, z2 = P.size2 || 88, arrowL = (P.arrowX0 || P.x1 - 70) - P.x0;
      g.fillStyle = COL.ink; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.font = SAT(z1, 700); g.fillText(P.line1, x, Math.round(28 + CAP * z1 + 6));
      // line 2: « Écris *COLIS* » — the verb in 700, the *word* in 900 inside a white key (« type this »)
      const segs = String(P.line2).split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
      const pad = Lc.keyPadX, room = arrowL - 44 - x;
      let z = z2; const widthAt = q => segs.reduce((m, sg) => m + (sg.e ? tw(sg.s.trim(), SAT(q)) + 2 * pad : tw(sg.s, SAT(q, 700))), 0);
      if (widthAt(z) > room) z = Math.floor(z * room / widthAt(z));
      const base = h - 46; let xx = x;
      for (const sg of segs) {
        if (sg.e) {
          const s = sg.s.trim(), ww = tw(s, SAT(z)), kh = CAP * z + 30, ky = base - CAP * z - 15;
          g.save(); g.shadowColor = 'rgba(80,40,0,.30)'; g.shadowBlur = 10; g.shadowOffsetY = 3; g.fillStyle = '#FFFFFF'; rr(g, xx, ky, ww + 2 * pad, kh, Lc.keyR); g.fill(); g.restore();
          g.font = SAT(z); g.fillStyle = COL.ink; g.fillText(s, xx + pad, base); xx += ww + 2 * pad;
        } else { g.font = SAT(z, 700); g.fillStyle = COL.ink; g.fillText(sg.s, xx, base); xx += tw(sg.s, SAT(z, 700)); }
      }
    }, 1);
  }
  /** the drawn arrow ↓ (felt-ink stroke): draws itself, then bobs at 2 Hz */
  function arrow(P, t) {
    const x0 = P.arrowX0 || P.x1 - 70, x1 = P.arrowX1 || P.x1 - 10, ax = (x0 + x1) / 2, hw = (x1 - x0) / 2 - 7;
    const d = easeOut(kk(t, P.t0 + .14, P.t0 + .40)), hk = easeOut(kk(t, P.t0 + .34, P.t0 + .50));
    const bob = 8 * Math.sin((t - P.t0 - .5) * TAU * 2) * kk(t, P.t0 + .45, P.t0 + .7);
    const ya = P.y0 + 86 + bob, yb = P.y1 - 46 + bob, ye = ya + (yb - ya) * d;
    if (d <= 0) return;
    ctx.save(); ctx.strokeStyle = COL.ink; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax - 2, ya); ctx.bezierCurveTo(ax + 7, ya + (ye - ya) * .35, ax - 6, ya + (ye - ya) * .7, ax, ye); ctx.stroke();
    if (hk > 0) { ctx.beginPath(); ctx.moveTo(ax - hw * hk, yb - hw * .95 * hk); ctx.lineTo(ax, yb); ctx.lineTo(ax + hw * .92 * hk, yb - hw * hk); ctx.stroke(); }
    ctx.restore();
  }
  function drawCTA(sg, t) {
    const P = sg.cta; if (!P || !(P.a > 0)) return;
    const tf = sg.freezeAt !== undefined ? Math.min(t, sg.freezeAt) : t, k = kk(tf, P.t0, P.t0 + .32);
    const w = P.x1 - P.x0, h = P.y1 - P.y0, cx = (P.x0 + P.x1) / 2, cy = (P.y0 + P.y1) / 2, sc = .78 + .22 * backOut(k, 2.4);
    ctx.save(); ctx.globalAlpha *= P.a * Math.min(1, k * 4); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(4,2,16,.50)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14;
    ctx.drawImage(ctaSprite(P), P.x0, P.y0, w, h); ctx.shadowColor = 'transparent';
    arrow(P, tf);
    ctx.restore();
  }
  function panelEdge(sg, t) {
    const P = sg.panel; if (!P || !P.on || t < sg.whip.t1) return;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2; rr(ctx, P.x + 1, P.y + 1, P.w - 2, P.h - 2, (P.r || 24) - 1); ctx.stroke(); ctx.restore();
  }

  // =====================================================================================================================
  // 7 · THE LOGO PILL + « VRAIES IMAGES »
  // =====================================================================================================================
  function drawLogoPill(t) {
    const L = call('logo', t); if (!L || !(L.a > .003)) return;
    const w = L.x1 - L.x0, h = L.y1 - L.y0;
    ctx.save(); ctx.globalAlpha *= L.a;
    ctx.shadowColor = 'rgba(8,6,22,.38)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4; ctx.fillStyle = '#FFFFFF'; rr(ctx, L.x0, L.y0, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    // the mark + « Bonzini » (violet = Bonzini)
    const mw = h * .70, z = Math.round(h * .40), f = SAT(z), word = 'Bonzini', ww = tw(word, f, .2), gap = 5, tot = mw + gap + ww, x = L.x0 + (w - tot) / 2;
    if (LOOK_LOGO()) drawLogo(x + mw / 2, L.y0 + h / 2, mw / .6);
    ctx.font = f; ctx.letterSpacing = '.2px'; ctx.fillStyle = COL.violetD; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(word, x + mw + gap, Math.round(L.y0 + h / 2 + CAP * z / 2));
    // « VRAIES IMAGES »
    const tz = L.textSize || 30; ctx.font = MONO(tz, 500); ctx.letterSpacing = '1px'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    { const mw = tw(L.text, MONO(tz, 500), 1), cx1 = L.textX1 + 10, cx0 = L.textX1 - mw - 12;   // review 2: a night chip (60 %): readable on a white sky
      ctx.fillStyle = rgba(COL.night, .60); rr(ctx, cx0, L.textY0 - 3, cx1 - cx0, L.textY1 - L.textY0 + 6, 10); ctx.fill(); }
    ctx.shadowColor = 'rgba(0,0,0,.60)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = '#FFFFFF';
    ctx.fillText(L.text, L.textX1 + 1, Math.round((L.textY0 + L.textY1) / 2 + tz * .36));
    ctx.restore();
  }

  // =====================================================================================================================
  // ENTRY POINTS
  // =====================================================================================================================
  /** after the signature's freeze everything holds (clean loop to image 0): the module's clock stops there */
  function clock(t) { const sg = call('signature', t); return sg && sg.freeze && sg.freezeAt !== undefined && t > sg.freezeAt ? sg.freezeAt : t; }
  function DX_under(t, n) {
    t = clock(t);
    const sg = call('signature', t); if (!sg || !sg.background || !sg.background.on) return;
    ctx.drawImage(nightSprite(), 0, 0);
  }
  /** pass 'blur' (every motion-blur sub-sample: the band, its parcel, the stamps, the signature's plate and call) · pass
   *  'crisp' (once per frame, after the accumulation: the band phrases and the karaoke — with the stamps' shake, they ride
   *  the band — then the subtitle box, the badges and the logo, never shaken) · no pass = both (stills, stand-alone use) */
  function DX_draw(t, n, pass) {
    t = clock(t);
    const sg = call('signature', t), st = call('stamps', t, []) || [];
    const b = S.band(t), P = call('pills', t, {}) || {};
    if (pass === 'crisp') {                                         // never shaken: the hit moves the footage, the band and the stamp,
      drawTexts(t); drawSubs(t, 'band'); drawSubs(t, 'box', sg);     // the type holds still (readable, and inside the safe zones)
      drawPill(P.D); drawPill(P.G);
      drawLogoPill(t);
      return;
    }
    drawBand(t);
    const yA = b.y0 - 60, yB = b.y1 + 120;
    withSmear(bandSmear(t), yA, yB, () => { drawParcel(t); if (!pass) { drawTexts(t); drawSubs(t, 'band'); } });
    if (!pass) { drawPill(P.D); drawPill(P.G); }
    for (const s of st) drawStamp(s, t);
    // the red / blue split: the single frame of a stamp hit (the first frame at / after it), and the filé
    let split = 0;
    const hit = (call('stamps', n / FPS, []) || []).some(s => s.age >= 0 && s.age < 1 / FPS - 1e-6);
    if (hit) split = LOOK.stamp.rgb;
    if (sg && sg.whip && sg.whip.p > 0 && sg.whip.p < 1) split = Math.max(split, (sg.whip.rgb || 6) * Math.sin(PI * sg.whip.p));
    if (split >= 1) rgbSplit(split);
    if (!pass) drawSubs(t, 'box', sg);
    if (sg) { panelEdge(sg, t); drawPlate(sg, t); drawCTA(sg, t); }
    if (!pass) drawLogoPill(t);
  }
  window.DX_under = DX_under;
  window.DX_draw = DX_draw;
  window.DX_wordBox = wordBox;
})();

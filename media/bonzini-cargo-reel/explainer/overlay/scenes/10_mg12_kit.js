'use strict';
// Shared drawing kit for scenes s1 (L'ACHAT) and s2 (LE GROUPAGE). Namespaced on window.MG12 so it never
// collides with other scene files (all scene scripts share one global scope).
(function () {
  const K = (window.MG12 = window.MG12 || {});

  // ---------------- colour ----------------
  const RGB = {};
  K.rgb = h => { if (RGB[h]) return RGB[h]; const n = parseInt(h.slice(1), 16); return (RGB[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]); };
  const MIX = {};
  K.mix = (a, b, k) => {
    const key = a + b + k.toFixed(3); if (MIX[key]) return MIX[key];
    const A = K.rgb(a), B = K.rgb(b);
    return (MIX[key] = '#' + A.map((x, i) => Math.round(lerp(x, B[i], clamp(k))).toString(16).padStart(2, '0')).join(''));
  };
  K.shade = (h, k) => (k >= 0 ? K.mix(h, '#FFFFFF', k) : K.mix(h, '#000000', -k));
  K.rgba = (h, a) => { const A = K.rgb(h); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };

  // ---------------- timing ----------------
  /** start time of `word` in segment, falling back to a fraction of the segment (robust to transcript changes) */
  K.wt = (segId, word, frac, nth = 0) => {
    const w = TL.word(segId, word, nth); if (w) return w.s;
    const s = TL.seg(segId); return s ? s.start + frac * (s.end - s.start) : 0;
  };
  K.we = (segId, word, frac, nth = 0) => {
    const w = TL.word(segId, word, nth); if (w) return w.e;
    const s = TL.seg(segId); return s ? s.start + frac * (s.end - s.start) : 0;
  };
  /** eased 0..1 over [a, a+d] */
  K.ramp = (t, a, d, ease = eOutCubic) => ease(prog(t, a, a + d));

  // ---------------- projection ----------------
  /** axonometric projection: returns P(u,v,z) -> [x,y]. eu/ev = screen vectors of the ground axes. */
  K.proj = (ox, oy, s = 1, eu = [0.866, 0.5], ev = [-0.866, 0.5]) =>
    (u, v, z = 0) => [ox + (u * eu[0] + v * ev[0]) * s, oy + (u * eu[1] + v * ev[1] - z) * s];

  K.path = pts => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
  K.fillPoly = (pts, fill, stroke = null, lw = 2) => {
    K.path(pts);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  };
  K.seg = (a, b, col, lw = 2, alpha = 1) => {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
  };

  /**
   * shaded box in projection P. (cu,cv) = footprint centre, z0 = base height, w (u) x d (v) x h.
   * o: {top,front,right} explicit colours, edge colour, lw, hi (highlight edge colour), alpha
   */
  K.box = (P, cu, cv, z0, w, d, h, col, o = {}) => {
    const hw = w / 2, hd = d / 2, z1 = z0 + h;
    const a = P(cu - hw, cv + hd, z0), b = P(cu + hw, cv + hd, z0), c = P(cu + hw, cv - hd, z0);
    const a2 = P(cu - hw, cv + hd, z1), b2 = P(cu + hw, cv + hd, z1), c2 = P(cu + hw, cv - hd, z1), d2 = P(cu - hw, cv - hd, z1);
    const edge = o.edge || K.shade(col, -0.55), lw = o.lw ?? 2;
    ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1); ctx.lineJoin = 'round';
    K.fillPoly([a2, b2, b, a], o.front || col, edge, lw);
    K.fillPoly([b2, c2, c, b], o.right || K.shade(col, -0.28), edge, lw);
    K.fillPoly([d2, c2, b2, a2], o.top || K.shade(col, 0.22), edge, lw);
    if (o.hi !== false) { // crisp light rim on the two near top edges
      ctx.strokeStyle = o.hi || K.shade(col, 0.55); ctx.lineWidth = Math.max(1, lw * 0.75); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(c2[0], c2[1]); ctx.stroke();
    }
    ctx.restore();
    return { a, b, c, a2, b2, c2, d2 };
  };

  /** soft elliptical ground shadow */
  K.shadow = (x, y, rx, ry, a = 0.5) => {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(.6, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  /** soft coloured glow blob */
  K.glow = (x, y, r, col, a = 0.5, sy = 1) => {
    if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(1, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, K.rgba(col, .9)); g.addColorStop(.4, K.rgba(col, .35)); g.addColorStop(1, K.rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };

  /**
   * readable label on a solid plate, centred at (cx, cy). Returns {x,y,w,h}.
   * o: size, weight, fam, color, pad, h, accent (colour bar on the left), alpha, border, ls, minW
   */
  K.label = (text, cx, cy, o = {}) => {
    const size = o.size || 48, weight = o.weight || 800, fam = o.fam || FONT.body, ls = o.ls ?? 0;
    const font = `${weight} ${size}px ${fam}`;
    const tw = measure(text, font, ls), padX = o.pad ?? 30, accW = o.accent ? 22 : 0;
    const w = Math.max(o.minW || 0, tw + padX * 2 + accW), h = o.h || Math.round(size * 1.62);
    const x = cx - w / 2, y = cy - h / 2;
    plate(x, y, w, h, { alpha: o.alpha ?? 1, r: o.r ?? 20, border: o.border ?? 'rgba(169,71,254,.75)', accent: o.accent, fill: o.fill || 'rgba(12,7,28,.9)' });
    txt(text, cx + accW / 2, cy + size * 0.36, { font, color: o.color || ICE, align: 'center', alpha: o.alpha ?? 1, ls, shadowBlur: 6 });
    return { x, y, w, h };
  };

  /** expanding ripple ring on the ground (ellipse) */
  K.ripple = (x, y, r, sy, col, a, lw = 3) => {
    if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.scale(1, sy);
    ctx.strokeStyle = col; ctx.lineWidth = lw / Math.max(.3, sy); ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  };

  /** quadratic bezier point */
  K.qb = (a, c, b, k) => [(1 - k) * (1 - k) * a[0] + 2 * (1 - k) * k * c[0] + k * k * b[0], (1 - k) * (1 - k) * a[1] + 2 * (1 - k) * k * c[1] + k * k * b[1]];

  /** point in polygon (ray casting) */
  K.inside = (poly, x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  /** dust puff (deterministic) around (x,y) at progress p 0..1 */
  K.puff = (x, y, p, seed, n = 7, spread = 60, col = '#CBBBEF') => {
    if (p <= 0 || p >= 1) return;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (0.05 + 0.9 * (i + rnd(seed + i) * .6) / n), sp = spread * (0.6 + 0.6 * rnd(seed * 3 + i));
      const q = eOutCubic(p), px = x + Math.cos(ang) * sp * q * (i % 2 ? 1 : -1), py = y - Math.sin(ang) * sp * .35 * q;
      const r = 5 + 13 * q * (0.6 + rnd(seed + i * 7) * .6);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, K.rgba(col, .5 * (1 - p))); g.addColorStop(1, K.rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
})();

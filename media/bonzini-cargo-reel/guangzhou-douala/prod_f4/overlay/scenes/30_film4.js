'use strict';
// =============================================================================================
// 30_film4.js — the film-4 graphics of « ELLE VA OÙ, CETTE MACHINE ? » (rush2/SERIE.md §5.4), as LAYERS (50_compose.js
// draws window.LAYERS by z: < 60 between the footage and the shared module 20_duplex.js, ≥ 60 above it). Everything is
// read from window.SCORE (SCORE.F4, band, A, G, COL); 20_duplex.js is used unchanged (its parcel and band texts are
// switched off by the score: progress().a = 0, texts() = []).
//   z  8  M2 · the soft light on the machine: +0,4 EV in a radial mask that follows the machine's centre (hand-checked keys)
//   z 14  M4 · the amber light sweep (8,00–8,60) and the white wind strokes. (Review 4: the dashed TRAIL through the air is
//         gone — it was drawn ON the machine, a scratch across the subject at 360 px, and the machine fills the frame so a
//         trail hidden behind it would not show)
//   z 55  the night card under C'EST FORT ! (contrast on the bright street of v40)
//   z 70  the band, film 4: the 5 stops on the dashed route (review 4: 36-px rings, white 4-px rim, that fill orange with
//         their white step digit), the 52 × 40 kraft parcel that hops onto each reached stop (0,25 s, a 1,2× pop on landing),
//         the numbered orange discs, the question and the 5 step phrases, the orange
//         felt check of step 5. FRAME-LOCKED: whatever rides the band is placed at band(n / 30), the frame's own time, so
//         it stays crisp while the band body glides (the shutter samples of the band are smeared by 20_duplex.js only).
// Pure in t (n only for the frame lock); no Math.random (kit rnd), no ctx.filter; static looks are cached sprites.
// =============================================================================================
(function () {
  const S = window.SCORE; if (!S || !S.F4) return;
  const F4 = S.F4, COL = S.COL, G = S.G, kk = S.kk, cl = S.cl, lp = S.lerp, easeOut = S.easeOut, ease = S.ease, backOut = S.backOut;
  const PI = Math.PI, TAU = 2 * PI, CAP = .745;
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;
  const hex = h => { const v = parseInt(String(h).slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const rgba = (h, a) => { const [r, g, b] = Array.isArray(h) ? h : hex(h); return `rgba(${r},${g},${b},${a})`; };
  const MC = document.createElement('canvas').getContext('2d'), MW = new Map();
  function tw(s, font) { const k = font + '|' + s; let w = MW.get(k); if (w === undefined) { MC.font = font; MC.letterSpacing = '0px'; w = MC.measureText(s).width; MW.set(k, w); } return w; }
  const SPR = new Map();
  function sprite(key, w, h, draw, res = 1) {
    let c = SPR.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * res)); c.height = Math.max(1, Math.ceil(h * res));
    const g = c.getContext('2d'); g.scale(res, res); draw(g, w, h); c._w = w; c._h = h; SPR.set(key, c); return c;
  }
  function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  let OFF = null;
  const off = (w, h) => { if (!OFF) { OFF = document.createElement('canvas'); OFF.g = OFF.getContext('2d'); } if (OFF.width < w || OFF.height < h) { OFF.width = Math.max(OFF.width, Math.ceil(w)); OFF.height = Math.max(OFF.height, Math.ceil(h)); } OFF.g.setTransform(1, 0, 0, 1, 0, 0); OFF.g.globalAlpha = 1; OFF.g.globalCompositeOperation = 'source-over'; OFF.g.clearRect(0, 0, OFF.width, OFF.height); return OFF; };

  // =====================================================================================================================
  // z 8 · M2: the soft light on the machine (+0,4 EV, radial): the frame's own pixels added back through a radial mask
  // =====================================================================================================================
  function light(ctx, t) {
    const L = F4.light(t); if (!L || !(L.a > .003)) return;
    const r = L.r * 1.6, x0 = Math.floor(L.x - r), y0 = Math.floor(L.y - r), d = Math.ceil(2 * r);
    const O = off(d, d), g = O.g;
    g.drawImage(ctx.canvas, x0, y0, d, d, 0, 0, d, d);
    g.globalCompositeOperation = 'destination-in';
    const rg = g.createRadialGradient(L.x - x0, L.y - y0, 0, L.x - x0, L.y - y0, r);
    rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(.45, 'rgba(0,0,0,.85)'); rg.addColorStop(.75, 'rgba(0,0,0,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, d, d);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (Math.pow(2, L.ev) - 1) * L.a;
    ctx.drawImage(O, 0, 0, d, d, x0, y0, d, d);
    // a breath of warm light on top (amber, very soft): the machine is « lit », not just brighter
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .22 * L.a;
    const wg = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r); wg.addColorStop(0, COL.amber); wg.addColorStop(1, 'rgba(243,167,69,0)');
    ctx.fillStyle = wg; ctx.fillRect(x0, y0, d, d);
    ctx.restore();
  }

  // =====================================================================================================================
  // z 14 · M4: the trail, the wind, the light sweep
  // =====================================================================================================================
  /** 3 white wind strokes (40 %): long tapered gusts that cross the air around the machine towards the shop's side */
  function wind(ctx, t) {
    const T = F4.trail(t); if (!T || !(T.a > .003)) return;
    const [b0, b1] = T.bbox, cx = (b0[0] + b1[0]) / 2, cy = (b0[1] + b1[1]) / 2, hw = (b1[0] - b0[0]) / 2, hh = (b1[1] - b0[1]) / 2;
    const G3 = [{ dx: -.30, dy: -1.12, L: 420, bend: 26, ph: 0 }, { dx: .62, dy: -.70, L: 340, bend: 18, ph: .38 }, { dx: -.55, dy: 1.10, L: 460, bend: -22, ph: .70 }];
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineCap = 'round';
    for (const g of G3) {
      const cyc = 1.25, u = ((T.age / cyc + g.ph) % 1 + 1) % 1, a = Math.pow(Math.sin(PI * u), 1.2) * .40 * T.a * kk(T.age, .2, .6); if (!(a > .004)) continue;
      const x = cx + g.dx * hw + 260 - 520 * ease(u), y = Math.max(800, cy + g.dy * hh), L = g.L;
      for (let i = 0; i < 14; i++) {                                              // tapered: thick in the middle, thin at both ends
        const u0 = i / 14, u1 = (i + 1) / 14, w = 1.5 + 11 * Math.sin(PI * (u0 + u1) / 2);
        const X = q => x - L / 2 + L * q, Y = q => y - g.bend * Math.sin(PI * q);
        ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(X(u0), Y(u0)); ctx.lineTo(X(u1), Y(u1)); ctx.stroke();
      }
    }
    ctx.restore();
  }
  /** the amber light sweep (8,00–8,60): a broad warm band of light with a bright core crosses the picture diagonally */
  function sweep(ctx, t) {
    const Sw = F4.sweep(t); if (!Sw) return;
    const p = Sw.p, a = Math.pow(Math.sin(PI * cl(p)), .7); if (!(a > .003)) return;
    const ang = -PI / 5, L = 2800, cx = lp(-420, 1500, ease(p)), cy = lp(260, 1660, ease(p));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(cx, cy); ctx.rotate(ang);
    let g = ctx.createLinearGradient(-300, 0, 300, 0);
    g.addColorStop(0, 'rgba(243,167,69,0)'); g.addColorStop(.30, `rgba(243,167,69,${(.16 * a).toFixed(3)})`); g.addColorStop(.5, `rgba(243,167,69,${(.30 * a).toFixed(3)})`);
    g.addColorStop(.70, `rgba(243,167,69,${(.16 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(243,167,69,0)');
    ctx.fillStyle = g; ctx.fillRect(-300, -L / 2, 600, L);
    g = ctx.createLinearGradient(-46, 0, 46, 0);
    g.addColorStop(0, 'rgba(255,230,180,0)'); g.addColorStop(.5, `rgba(255,236,200,${(.42 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255,230,180,0)');
    ctx.fillStyle = g; ctx.fillRect(-46, -L / 2, 92, L);
    ctx.restore();
  }

  // =====================================================================================================================
  // z 70 · the band of film 4
  // =====================================================================================================================
  const STOPD = G.stops.d;
  /** the kraft parcel (28 × 22, amber tape) — the series' look */
  function parcelSprite(w, h) {
    return sprite(`f4_parcel_${w}_${h}`, w + 8, h + 8, (g) => {
      g.translate(4, 4);
      const body = g.createLinearGradient(0, 0, w * .4, h); body.addColorStop(0, '#DDB683'); body.addColorStop(.55, COL.kraft); body.addColorStop(1, '#B28554');
      g.fillStyle = body; rr(g, 0, 0, w, h, 2.6); g.fill();
      g.fillStyle = 'rgba(120,80,40,.30)'; g.fillRect(w - 4.2, 1, 3.4, h - 2);
      g.strokeStyle = 'rgba(110,72,36,.55)'; g.lineWidth = .7; g.beginPath(); g.moveTo(1.2, h * .30); g.lineTo(w - 1.2, h * .30); g.stroke();
      const tx = w * .5 - 3.2; g.fillStyle = 'rgba(243,167,69,.95)'; g.fillRect(tx, 0, 6.4, h);
      g.fillStyle = 'rgba(255,236,200,.55)'; g.fillRect(tx + .6, 0, 1.1, h); g.fillStyle = 'rgba(160,96,30,.35)'; g.fillRect(tx + 5.6, 0, .8, h);
      g.fillStyle = '#F6EBD6'; rr(g, 3, h * .52, 7.2, 6.4, .8); g.fill();
      g.fillStyle = 'rgba(35,22,41,.55)'; g.fillRect(4.2, h * .52 + 1.8, 4.8, .7); g.fillRect(4.2, h * .52 + 3.6, 3.4, .7);
      g.strokeStyle = 'rgba(90,58,26,.7)'; g.lineWidth = .8; rr(g, .4, .4, w - .8, h - .8, 2.3); g.stroke();
      g.strokeStyle = 'rgba(255,240,215,.45)'; g.lineWidth = .7; g.beginPath(); g.moveTo(2, .9); g.lineTo(w - 3, .9); g.stroke();
    }, 4);
  }
  /** the 5 stops: a 36-px ring (night inside, white 4-px rim) that fills orange with its white step digit when the parcel
   *  lands on it (a short pop, then an orange ring opens and fades) */
  function drawStops(ctx, t, y, a) {
    const Sg = G.stops, rim = Sg.ring || 4;
    for (const s of F4.stops(t)) {
      const x = s.x, r = STOPD / 2;
      ctx.save(); ctx.globalAlpha *= a;
      ctx.shadowColor = 'rgba(0,0,0,.40)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
      ctx.fillStyle = COL.night; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = rim; ctx.beginPath(); ctx.arc(x, y, r - rim / 2, 0, TAU); ctx.stroke();
      if (s.fill > 0) {                                                   // filled orange + the digit, a short pop
        const f = cl(s.fill), sc = 1 + .25 * Math.sin(PI * f) * (f < 1 ? 1 : 0);
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        ctx.globalAlpha = a * cl(f * 1.5);
        ctx.fillStyle = COL.orange; ctx.beginPath(); ctx.arc(0, 0, r - rim + .5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = rim; ctx.beginPath(); ctx.arc(0, 0, r - rim / 2, 0, TAU); ctx.stroke();
        const z = Sg.digit || 24; ctx.font = SAT(z); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(s.k), 0, Math.round(CAP * z / 2));
        ctx.restore();
      }
      if (s.burst > 0 && s.burst < 1) {                                   // the landing burst: an orange ring that opens and fades
        const b = easeOut(s.burst); ctx.globalAlpha = a * (1 - s.burst) * .9; ctx.strokeStyle = COL.orange; ctx.lineWidth = 5 * (1 - b) + 1.5;
        ctx.beginPath(); ctx.arc(x, y, r + 26 * b, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }
  /** the 52 × 40 parcel (the series' 28 × 22 kraft sprite, drawn at 4× and scaled: same look, bigger): it stands ON the ring
   *  of the stop it reached (on the line before step 1), hops 0,25 s to the next one and pops 1,2× when it lands */
  function drawParcel(ctx, t, y, a) {
    const h = F4.parcel(t), w = G.parcel.w, hh = G.parcel.h, k = w / 28, r = STOPD / 2, Sg = G.stops;
    const base = q => (q ? y - r + 1 : y);                                // standing height: on a ring (stop q ≥ 1) or on the line
    const yb = h.k ? lp(base(h.k - 1), base(h.k), ease(h.p)) : base(0);
    const d = h.land !== undefined ? t - h.land : -1, pop = d >= 0 && d < .24 ? ((Sg.pop || 1.2) - 1) * Math.sin(PI * d / .24) : 0;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.fillStyle = `rgba(0,0,0,${(.35 * (1 - h.lift / (Sg.hopH * 1.4))).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(h.x, yb + .5, w * .5 * (1 - .3 * h.lift / Sg.hopH), 3.4, 0, 0, TAU); ctx.fill();
    ctx.translate(h.x, yb - h.lift); ctx.scale((1 + .6 * h.squash) * (1 + pop), (1 - h.squash) * (1 + pop));
    ctx.rotate(h.p < 1 ? -.18 * Math.sin(PI * h.p) : 0);
    const spr = parcelSprite(28, 22); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(spr, -w / 2 - 4 * k, -hh - 4 * k, w + 8 * k, hh + 8 * k);
    ctx.restore();
  }
  /** the numbered orange disc */
  function disc(ctx, k, cx, cy, sc, a) {
    if (!(sc > .01) || !(a > .003)) return;
    const R = G.step.disc / 2;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    const g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, '#FF7A3C'); g.addColorStop(1, COL.orange);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.font = SAT(G.step.num); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(k), 0, Math.round(CAP * G.step.num / 2) + 1);
    ctx.restore();
  }
  /** a felt check mark (orange), drawn along its path to p */
  function feltCheck(ctx, x, y, s, p, color) {
    if (!(p > 0)) return;
    const P = [[0, .52], [.34, .88], [1, 0]].map(([u, v]) => [x + u * s, y + v * s]);
    const L1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), L2 = Math.hypot(P[2][0] - P[1][0], P[2][1] - P[1][1]), Lt = (L1 + L2) * easeOut(cl(p));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
    const path = () => { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      if (Lt <= L1) { const u = Lt / L1; ctx.lineTo(lp(P[0][0], P[1][0], u), lp(P[0][1], P[1][1], u)); }
      else { ctx.lineTo(P[1][0], P[1][1]); const u = (Lt - L1) / L2; ctx.lineTo(lp(P[1][0], P[2][0], u), lp(P[1][1], P[2][1], u)); } };
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 6; ctx.lineWidth = s * .16; path(); ctx.stroke(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(160,40,0,.35)'; ctx.lineWidth = s * .05; path(); ctx.stroke();      // the pooled ink of a felt tip
    ctx.restore();
  }
  function drawSteps(ctx, t, b) {
    const Gs = G.step;
    for (const s of F4.steps) {
      if (t < s.t0 || t >= s.out1) continue;
      const ain = s.t0 < 0 ? 1 : easeOut(kk(t, s.t0, s.t0 + .15)), aout = 1 - kk(t, s.out0, s.out1), a = ain * aout * b.a; if (!(a > .003)) continue;
      const dy = 24 * (1 - ain), z = s.size, n = s.lines.length, lead = Gs.lead, y0 = b.y0 + (G.band.h - lead * n) / 2 + 4;
      // fit inside x ≤ 960
      let zz = z; for (const l of s.lines) { const w = tw(l.replace(/\*/g, ''), SAT(zz)); if (s.x + w > G.band.textMaxX) zz = Math.floor(zz * (G.band.textMaxX - s.x) / w); }
      const f = SAT(zz);
      let lastEnd = 0, lastBase = 0;
      s.lines.forEach((l, i) => {
        const base = Math.round(y0 + i * lead + lead / 2 + CAP * zz / 2) + dy;
        ctx.save(); ctx.globalAlpha *= a; ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
        let x = s.x; l.split('*').forEach((seg, j) => { if (!seg) return; ctx.fillStyle = j % 2 ? COL.orange : '#FFFFFF'; ctx.fillText(seg, x, base); x += tw(seg, f); });
        ctx.restore(); lastEnd = x; lastBase = base;
      });
      if (s.k > 0) {                                                       // the numbered disc pops in
        const firstC = Math.round(y0 + lead / 2) + dy * 0, pk = s.t0 < 0 ? 1 : kk(t, s.t0, s.t0 + .28), sc = backOut(pk, 2.6);
        disc(ctx, s.k, Gs.discX + Gs.disc / 2, n > 1 ? firstC + 2 : Math.round(b.y0 + G.band.h / 2 + 4), sc, a);
      }
      if (s.check) {
        const p = kk(t, s.check.t0, s.check.t1), cs = 78;
        ctx.save(); ctx.globalAlpha *= aout * b.a; feltCheck(ctx, lastEnd + 34, lastBase - cs * .92, cs, p, COL.orange); ctx.restore();
      }
    }
  }
  function bandLayer(ctx, t, n) {
    const tf = Math.max(0, n / 30), b = S.band(tf);                       // frame-locked position (crisp)
    if (!b || !(b.a > .003) || b.y0 > 1930) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const y = b.y0 + (G.band.line || 4) / 2;                            // on the dashed route (20_duplex.js: y0 + line / 2)
    drawStops(ctx, t, y, b.a);
    drawParcel(ctx, t, y - 1, b.a);
    drawSteps(ctx, t, b);
    ctx.restore();
  }

  // =====================================================================================================================
  // z 55 · the backing of C'EST FORT ! (the stamp falls on v40's bright street — beige, yellow truck, pink facade: an
  // orange stamp on that is a same-hue stamp): a soft night card the size of the stamp's frame, under it, with its slam,
  // rotation, push / shake and its exit in the filé — the same geometry as 20_duplex.js' stamp sprite (§3.6)
  // =====================================================================================================================
  function stampFrame(lines, size) {
    const f = SAT(size), ls = Math.round(size * .015), lh = size * .9;
    MC.font = f; MC.letterSpacing = ls + 'px'; const ws = lines.map(l => MC.measureText(l).width - ls); MC.letterSpacing = '0px';
    const m0 = MC.measureText(lines[0]), mN = MC.measureText(lines[lines.length - 1]); MC.font = f;
    const capH = CAP * size, top = -(capH + .55 * Math.max(0, m0.actualBoundingBoxAscent - capH)), bot = (lines.length - 1) * lh + .55 * mN.actualBoundingBoxDescent;
    const m = Math.round(size * .16) + 3 + 6 + 8; return { fw: Math.max(...ws) + 2 * m, fh: bot - top + 2 * m };
  }
  let SF = null;
  function stampBacking(ctx, t) {
    for (const st of (S.stamps(t) || [])) {
      const age = st.age; if (!(age >= 0) || !(st.a > .003)) continue;
      const fr = SF || (SF = stampFrame(st.lines, st.size)), ra = Math.abs((st.rot || 0) * PI / 180);
      const k = kk(age, 0, 4 / 30), sc = st.scale * (1.6 - .6 * easeOut(k)), al = st.a * (.55 + .45 * kk(age, 0, 1.5 / 30));
      const hh = st.scale * (fr.fh / 2 * Math.cos(ra) + fr.fw / 2 * Math.sin(ra)), chromeY = Math.max(G.pillG.y1, G.logo.textY1) + 14, cy = Math.max(st.cy, chromeY + hh);
      const fx = S.screenFx(t), w = fr.fw + 34, h = fr.fh + 34;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (fx.s !== 1 || fx.dx || fx.dy) { ctx.translate(540 + fx.dx, 960 + fx.dy); ctx.scale(fx.s, fx.s); ctx.translate(-540, -960); }
      ctx.translate(st.cx - (st.smear || 0) * .5, cy); ctx.rotate((st.rot || 0) * PI / 180); ctx.scale(sc, sc);
      ctx.globalAlpha = al * .78; ctx.shadowColor = 'rgba(6,8,22,.55)'; ctx.shadowBlur = 40;
      ctx.fillStyle = rgba(COL.night, .72); rr(ctx, -w / 2, -h / 2, w, h, 30); ctx.fill();
      ctx.restore();
    }
  }

  (window.LAYERS = window.LAYERS || []).push(
    { id: 'f4_light', z: 8, t0: S.A.c2, t1: S.A.c3, draw: (ctx, t, n) => light(ctx, t) },
    { id: 'f4_m4', z: 14, t0: S.A.c4, t1: S.A.c5, draw: (ctx, t, n) => { sweep(ctx, t); wind(ctx, t); } },
    { id: 'f4_stamp', z: 55, t0: S.A.fort, t1: S.A.whip + .12, draw: (ctx, t, n) => stampBacking(ctx, t) },
    { id: 'f4_band', z: 70, t0: 0, t1: S.A.F + .5, draw: (ctx, t, n) => bandLayer(ctx, t, n) },
  );
  window.F4_draw = () => {};                                               // the TEXTS() takeover name of the band rows
})();

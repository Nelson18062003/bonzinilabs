'use strict';
// =============================================================================================
// 60_type.js — the TYPE base kit of the series (rush1 60_type.js generalised). TY_draw(t, n) is called by 50_compose.js
// after the footage and the graphic layers; every string comes from SCORE.TEXTS() = [t0, t1, id, text, style, takeover,
// opt]; when window[takeover] exists that module draws the text and this layer skips it. '|' = line break, *…* = emphasis
// (opt.ecol; violet ONLY for Bonzini words — the default emphasis colour is amber). Every style draws INSIDE opt.box
// ({x0, y0, x1, y1}, screen px; defaults from SCORE.G): text is shrunk to fit, never pushed out (tools/check_score.js
// audits the boxes against the safe zones).
//   'mention'  provenance chip, top-left: dark pill, red « live » dot, « VRAIE VIDÉO » (opt.cut: no fade-in on a hard cut)
//   'title'    kinetic title plate: each word rises out of its line's mask (stagger .07 s, expo ease), soft dark shade
//              behind; leaves upward at t1 (opt: size, ecol, align, shade: false)
//   'label'    small chip on a pane (« LÀ-BAS · ON CHARGE »): wipe-in from the left, accent bar (opt.accent)
//   'sub'      REAL-VOICE subtitle: white box, « vraie voix » badge + live waveform (data/voice_env.json → window.VOICE_ENV,
//              tools/voice_env.py), karaoke on the word times of data/timing.json (spoken = ink, current = amber
//              highlighter, coming = 28 % ink); the score's text is matched to the ASR words in order (opt.voice = id)
//   'stamp'    rubber stamp (starved ink), slams in with a bounce + ink specks (opt.color, box.size, box.rot)
//   'cta'      the amber CTA pill: line 1 + the *word* + a drawn arrow ↓ (felt stroke, then a bob)
// opt.ride = a shot id: the text moves with that shot's transition (whip, slide…) and is clipped to its region.
// TY_boxes() → {id: {x, y, w, h}} the boxes drawn on the last frame (for layers that point at a text).
// Pure functions of t; no ctx.filter, no Math.random.
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, T = S.T, kk = S.kk, cl = S.cl, lerp = S.lerp, COL = S.COL;
  const easeOut = S.easeOut, backOut = S.backOut, outExpo = S.EASE.outExpo;
  const has = n => typeof window[n] === 'function';
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;
  const SHADOW = 'rgba(6,2,12,.62)';
  const BOXES = {};
  const inOut = (t, a, b, fi = .12, fo = .12) => Math.min(fi > 0 ? easeOut(kk(t, a, a + fi)) : 1, fo > 0 ? 1 - kk(t, b - fo, b) : 1);
  const segs = l => l.split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
  const wOf = (s, f, ls = 0) => { ctx.save(); ctx.font = f; ctx.letterSpacing = ls + 'px'; const w = ctx.measureText(s).width; ctx.restore(); return w; };
  const fitSize = (lines, size, maxW, min, f) => { let z = size; for (const l of lines) { const w = wOf(l.replace(/\*/g, ''), f(size)); if (w > maxW) z = Math.min(z, size * maxW / w); } return Math.max(min, Math.floor(z)); };
  const boxOf = (o, dflt) => (o && o.box) || dflt;
  const fadeOut = (b, o) => (b > T.end || (o && o.ride)) ? 0 : .15;      // a text riding a shot leaves with it
  /** text with a soft dark shadow (video), optional dark outline under the fill */
  function vtext(s, x, y, f, color, o = {}) {
    ctx.save(); ctx.font = f; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = (o.ls || 0) + 'px';
    if (o.outline) {
      ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = o.outline; ctx.lineWidth = o.outlineW || 12;
      ctx.shadowColor = SHADOW; ctx.shadowBlur = o.blur ?? 22; ctx.shadowOffsetY = 5; ctx.strokeText(s, x, y); ctx.shadowColor = 'transparent';
    } else if (o.shadow !== false) { ctx.shadowColor = SHADOW; ctx.shadowBlur = o.blur ?? 18; ctx.shadowOffsetY = 4; }
    ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
  }

  // ---------- mention ----------
  function mention(t, a, b, s, o) {
    const fi = (a <= 0 || o.cut) ? 0 : .12, al = inOut(t, a, b, fi, fadeOut(b)); if (al <= 0) return;
    const M = boxOf(o, G.mention), h = M.y1 - M.y0, z = M.size || 40, f = SAT(z, 700), dot = 30;
    const tw = Math.min(wOf(s, f, 1), (M.x1 - M.x0) - dot - 44), w = tw + dot + 44;
    ctx.save(); ctx.globalAlpha *= al;
    ctx.fillStyle = 'rgba(0,0,0,.60)'; rrect(M.x0, M.y0, w, h, 12); ctx.fill();
    ctx.fillStyle = '#FF3B30'; ctx.beginPath(); ctx.arc(M.x0 + 26, M.y0 + h / 2, 8, 0, 7); ctx.fill();
    ctx.font = f; ctx.letterSpacing = '1px'; ctx.fillStyle = COL.white; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(s, M.x0 + 22 + dot, M.y0 + h / 2 + 2, tw); ctx.restore();
    BOXES[o.id] = { x: M.x0, y: M.y0, w, h };
  }

  // ---------- kinetic title ----------
  function title(t, a, b, s, o) {
    const B = boxOf(o, G.title), lines = s.split('|'), bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    let z = fitSize(lines, o.size || B.size || 150, bw, 40, q => SAT(q)); z = Math.min(z, Math.floor(bh / (lines.length * 1.0)));
    const lh = z * 1.0, top = B.y0 + (bh - lines.length * lh) / 2, ecol = o.ecol || COL.amber;
    const out = kk(t, b - .32, b); if (out >= 1 || t < a) return;
    if (o.shade !== false) {                                     // a soft dark band behind (readable on any footage)
      const sa = .42 * easeOut(kk(t, a, a + .3)) * (1 - out), y0 = B.y0 - 90, y1 = B.y1 + 90, gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, 'rgba(8,4,14,0)'); gr.addColorStop(.3, `rgba(8,4,14,${sa.toFixed(3)})`); gr.addColorStop(.7, `rgba(8,4,14,${sa.toFixed(3)})`); gr.addColorStop(1, 'rgba(8,4,14,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, y0, G.W, y1 - y0);
    }
    let q = 0;
    lines.forEach((l, i) => {
      const words = l.split(' '), base = top + i * lh + z * .84, f = SAT(z), sp = wOf(' ', f);
      const ws = words.map(w => ({ w, segs: segs(w), width: segs(w).reduce((m, g) => m + wOf(g.s, f), 0) }));
      const lw = ws.reduce((m, w) => m + w.width, 0) + sp * (ws.length - 1);
      let x = o.align === 'left' ? B.x0 : B.x0 + (bw - lw) / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(B.x0 - 60, base - z * .98, bw + 120, z * 1.24); ctx.clip();   // the line's mask
      for (const w of ws) {
        const k = outExpo(kk(t, a + .07 * q, a + .07 * q + .5)), ko = easeOut(kk(t, b - .32 + .05 * i, b - .05 + .05 * i));
        const dy = (1 - k) * lh * 1.05 - ko * lh * 1.45;           // far enough that a descender (ç) leaves the mask too
        let xx = x; ctx.globalAlpha = 1 - ko * ko;
        for (const g of w.segs) {
          vtext(g.s, xx, base + dy, f, g.e ? ecol : COL.white, { align: 'left', ls: 1, outline: g.e ? COL.outline : null, outlineW: 12, blur: 20 });
          xx += wOf(g.s, f);
        }
        x += w.width + sp; q++;
      }
      ctx.restore();
    });
    BOXES[o.id] = { x: B.x0, y: B.y0, w: bw, h: bh };
  }

  // ---------- label chip ----------
  function label(t, a, b, s, o) {
    const al = inOut(t, a, b, 0, fadeOut(b, o)); if (al <= 0) return;
    const B = boxOf(o, G.labTop), h = B.y1 - B.y0, z = B.size || 40, f = SAT(z, 800), acc = 12, pad = 26;
    const tw = Math.min(wOf(s, f, 1.5), (B.x1 - B.x0) - acc - 2 * pad), w = tw + acc + 2 * pad;
    const k = S.EASE.outQuart(kk(t, a, a + .32));
    ctx.save(); ctx.globalAlpha *= al;
    ctx.beginPath(); ctx.rect(B.x0, B.y0 - 30, w * k + 1, h + 60); ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(12,8,18,.78)'; rrect(B.x0, B.y0, w, h, 10); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = o.accent || COL.amber; rrect(B.x0, B.y0, acc, h, 4); ctx.fill();
    ctx.font = f; ctx.letterSpacing = '1.5px'; ctx.fillStyle = COL.white; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, B.x0 + acc + pad - 18 * (1 - k), B.y0 + h / 2 + 2, tw); ctx.restore();
    BOXES[o.id] = { x: B.x0, y: B.y0, w, h };
  }

  // ---------- the « vraie voix » subtitle (karaoke on the real word times) ----------
  const nrm = w => String(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const TIMED = {};
  /** the score's tokens matched in order to the ASR words of the voice: [[{tok, e (emph), s, e}…] per line] */
  function timedLines(id, text, voice) {
    const k = id + '|' + text; if (TIMED[k]) return TIMED[k];
    const ws = S.wordsOf ? S.wordsOf(voice) : []; let j = 0, last = null;
    const lines = text.split('|').map(l => l.split(' ').filter(Boolean).map(tok => {
      const key = nrm(tok.replace(/\*/g, '')); let hit = null;
      if (key) for (let k2 = j; k2 < Math.min(ws.length, j + 4); k2++) { const w = nrm(ws[k2].w); if (w && (w.startsWith(key) || key.startsWith(w))) { hit = ws[k2]; j = k2 + 1; break; } }
      if (hit) last = hit;
      return { tok, s: hit ? hit.s : key ? (last ? last.e : null) : -1e9, e: hit ? hit.e : key ? (last ? last.e : null) : -1e9, punct: !key };
    }));
    TIMED[k] = { lines, timed: ws.length > 0 }; return TIMED[k];
  }
  function envAt(voice, u, band) {
    const V = window.VOICE_ENV && window.VOICE_ENV.voices && window.VOICE_ENV.voices[voice]; if (!V) return null;
    const fps = window.VOICE_ENV.fps || 60, arr = band === undefined ? V.rms : V.bands[band % V.bands.length], i = Math.round(u * fps);
    return i >= 0 && i < arr.length ? arr[i] : 0;
  }
  function wave(x, y, t, voice) {
    const t0 = T[voice], sp = S.speech ? S.speech(voice) : [t0, t0], on = t >= sp[0] && t < sp[1] + .05;
    for (let i = 0; i < 5; i++) {
      const e = envAt(voice, t - t0 - i * .014, i);
      const v = e === null ? (on ? .35 + .65 * Math.abs(Math.sin(t * (13 + 3 * i) + i * 1.9)) : .2) : cl(e);
      const h = 7 + 28 * (on ? Math.max(.12, v) : .12 + .06 * (i % 2));
      ctx.fillStyle = on ? COL.orange : COL.grey; rrect(x + i * 11, y - h / 2, 6, h, 3); ctx.fill();
    }
  }
  function subtitle(t, a, b, s, o) {
    const al = inOut(t, a, b, .15, fadeOut(b)); if (al <= 0) return;
    const B = boxOf(o, G.sub), rise = (1 - easeOut(kk(t, a, a + .18))) * 18, TL = timedLines(o.id, s, o.voice);
    const head = o.head || 'vraie voix', hz = B.head || 38, lz0 = B.line || 60;
    const maxW = (B.x1 - B.x0) - 64, z = fitSize(TL.lines.map(l => l.map(q => q.tok).join(' ')), lz0, maxW, 40, q => SAT(q));
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(0, rise); const gA = ctx.globalAlpha;
    ctx.shadowColor = 'rgba(0,0,0,.40)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(255,255,255,.97)'; rrect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, 26); ctx.fill(); ctx.shadowColor = 'transparent';
    const bx = (B.x0 + B.x1) / 2, hf = SAT(hz, 700), hw = wOf(head, hf), hx = bx - (hw + 64) / 2;
    wave(hx, B.y0 + 36, t, o.voice);
    ctx.font = hf; ctx.fillStyle = COL.grey; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(head, hx + 64, B.y0 + 50);
    const top = B.y0 + 66, bot = B.y1 - 12, mid = (top + bot) / 2, lh = z * 1.16, f = SAT(z), sp = wOf(' ', f);
    TL.lines.forEach((l, i) => {
      const y = mid - (TL.lines.length - 1) * lh / 2 + i * lh + z * .345;
      const ws = l.map(q => ({ q, segs: segs(q.tok), w: segs(q.tok).reduce((m, g) => m + wOf(g.s, f), 0) }));
      let x = bx - (ws.reduce((m, w) => m + w.w, 0) + sp * (ws.length - 1)) / 2;
      for (const w of ws) {
        const q = w.q, said = !TL.timed || q.punct || (q.s !== null && t >= q.s), cur = TL.timed && !q.punct && q.s !== null && t >= q.s && t < q.e + .06;
        if (cur) {                                             // the amber highlighter under the word being said
          const k = easeOut(kk(t, q.s, q.s + .10));
          ctx.fillStyle = `rgba(243,167,69,${(.85 * k).toFixed(3)})`; rrect(x - 8, y - z * .80, (w.w + 16) * (.4 + .6 * k), z * 1.02, 10); ctx.fill();
        }
        let xx = x;
        for (const g of w.segs) {
          ctx.font = f; ctx.textAlign = 'left'; ctx.globalAlpha = gA * (said ? 1 : .28);
          ctx.fillStyle = g.e ? COL.violetD : COL.ink; ctx.fillText(g.s, xx, y); xx += wOf(g.s, f);
        }
        ctx.globalAlpha = gA; x += w.w + sp;
      }
    });
    ctx.restore();
    BOXES[o.id] = { x: B.x0, y: B.y0, w: B.x1 - B.x0, h: B.y1 - B.y0 };
  }

  // ---------- rubber stamp ----------
  function stampSprite(s, size, color) {
    const c = makeCanvasCached(`ty_stamp_${s}_${size}_${color}`, 1200, Math.round(size * 1.9)), g = c.getContext('2d');
    if (!c._done) {
      g.font = SAT(size); g.letterSpacing = '4px'; const tw = g.measureText(s).width, bw = tw + 90, bh = size * 1.12, x0 = (1200 - bw) / 2, y0 = (c.height - bh) / 2;
      g.strokeStyle = color; g.lineWidth = Math.max(8, size * .085); rrectOn(g, x0, y0, bw, bh, 18); g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 600, c.height / 2 + size * .05);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 1100; i++) { g.globalAlpha = .25 + rnd(i * 1.7 + size) * .6; g.beginPath(); g.arc(x0 + rnd(i * 1.1 + 3) * bw, y0 + rnd(i * 2.9 + 1) * bh, .6 + rnd(i * 3.3) * 2.6, 0, 7); g.fill(); }
      c._done = true; c._w = bw; c._h = bh;
    }
    return c;
  }
  function stamp(t, a, b, s, o) {
    const B = boxOf(o, G.stamp), k = kk(t, a, a + .09); if (k <= 0) return;
    const al = Math.min(1, k * 2) * (fadeOut(b, o) === 0 ? 1 : 1 - kk(t, b - .12, b)); if (al <= 0) return;
    const color = o.color || COL.orange, c = stampSprite(s, B.size || 118, color), fit = Math.min(1, (B.x1 - B.x0) / (c._w + 20), (B.y1 - B.y0) / (c._h + 20));
    const d = t - a - .09, sc = fit * ((1.8 - .8 * easeOut(k)) + (d > 0 ? .05 * Math.exp(-d * 18) * Math.sin(d * 50) : 0));
    const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((B.rot || -6) * Math.PI / 180); ctx.scale(sc, sc); ctx.globalAlpha *= al; const gA = ctx.globalAlpha;
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.drawImage(c, -600, -c.height / 2); ctx.shadowColor = 'transparent';
    if (d > 0) for (let i = 0; i < 9; i++) {                 // ink specks thrown by the hit
      const ang = rnd(i * 4.1 + 2) * Math.PI * 2, r0 = c._w * .45 + rnd(i * 2.2) * 60, sz = 3 + rnd(i * 3.3) * 7;
      ctx.fillStyle = color; ctx.globalAlpha = gA * .85; ctx.beginPath(); ctx.arc(Math.cos(ang) * r0, Math.sin(ang) * r0 * .45, sz, 0, 7); ctx.fill();
    }
    ctx.restore();
    BOXES[o.id] = { x: B.x0, y: B.y0, w: B.x1 - B.x0, h: B.y1 - B.y0 };
  }

  // ---------- CTA pill ----------
  function cta(t, a, b, s, o) {
    const P = boxOf(o, G.pill), k = kk(t, a, a + .32); if (k <= 0) return;
    const sc = .6 + .4 * backOut(k, 2.2), al = Math.min(1, k * 4), [l1, l2] = s.split('|'), w = P.x1 - P.x0, h = P.y1 - P.y0, cy = (P.y0 + P.y1) / 2, cx = (P.x0 + P.x1) / 2;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 10;
    ctx.fillStyle = o.fill || COL.amber; rrect(P.x0, P.y0, w, h, 52); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = COL.ink;
    const f1 = SAT(fitSize([l1], P.size1 || 46, w - 80, 30, q => SAT(q, 700)), 700); ctx.font = f1; ctx.fillText(l1, cx, P.y0 + 60);
    const word = (l2 || '').replace(/\*/g, ''), aw = 56, z2 = fitSize([word], P.size2 || 88, w - 120 - aw, 40, q => SAT(q)), f2 = SAT(z2), ww = wOf(word, f2, 3), x0 = cx - (ww + 24 + aw) / 2;
    ctx.font = f2; ctx.letterSpacing = '3px'; ctx.textAlign = 'left'; ctx.fillText(word, x0, P.y1 - 24); ctx.letterSpacing = '0px';
    const d = easeOut(kk(t, a + .15, a + .45)), bob = 7 * Math.sin((t - a) * 7) * kk(t, a + .45, a + .7), ax = x0 + ww + 24 + aw / 2, ay0 = P.y0 + 84 + bob, ay1 = P.y1 - 26 + bob;
    if (d > 0) {
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const ye = ay0 + (ay1 - ay0) * Math.min(1, d / .7);
      ctx.beginPath(); ctx.moveTo(ax - 2, ay0); ctx.bezierCurveTo(ax + 8, ay0 + (ye - ay0) * .35, ax - 8, ay0 + (ye - ay0) * .65, ax, ye); ctx.stroke();
      const hk = kk(d, .7, 1); if (hk > 0) { ctx.beginPath(); ctx.moveTo(ax - 20 * hk, ay1 - 20 * hk); ctx.lineTo(ax, ay1); ctx.lineTo(ax + 20 * hk, ay1 - 20 * hk); ctx.stroke(); }
    }
    ctx.restore();
    BOXES[o.id] = { x: P.x0, y: P.y0, w, h };
  }

  // ---------- dispatch ----------
  const STYLES = { mention, title, label, sub: subtitle, stamp, cta };
  function draw(t, n) {
    for (const [a, b, id, s, st, own, opt] of S.TEXTS()) {
      if (!(t >= a && t < b) || (own && has(own))) continue;
      const fn = STYLES[st]; if (!fn) continue;           // an unknown style belongs to a module (its takeover)
      ctx.save();
      if (opt && opt.ride) {                               // the text rides a shot: moves with its transition, clipped to it
        const r = S.active(t).find(q => q.shot.id === opt.ride); if (!r) { ctx.restore(); continue; }
        ctx.beginPath(); ctx.rect(r.R.x, r.R.y, r.R.w, r.R.h); ctx.clip(); ctx.translate(r.fx.dx, r.fx.dy);
        ctx.globalAlpha *= r.fx.alpha * cl(1 - r.fx.smear / 140);              // gone before the smear would ghost it
      }
      fn(t, a, b, s, Object.assign({ id }, opt || {})); ctx.restore();
    }
  }
  return { draw, vtext, stampSprite, STYLES, boxes: () => BOXES };
})();
function TY_draw(t, n) { TY.draw(t, n); }
function TY_boxes() { return TY.boxes(); }

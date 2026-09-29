// 01_hook.js — opening: scan-line reveal + kinetic question on a solid band, synced to V01.
// Also defines window.BZF (shared helpers for 01_hook / 02_brand / 19_outro / 30_chapters).
(() => {
  'use strict';

  // ------------------------------------------------------------------ shared helpers (BZF)
  const BZF = (window.BZF = window.BZF || {});

  /** word object whose raw text equals `str` exactly (for punctuation tokens like "?") */
  BZF.wordExact = (segId, str, nth = 0) => {
    const s = TL.seg(segId); if (!s || !s.words) return null; let c = 0;
    for (const w of s.words) if (w.w.trim() === str) { if (c++ === nth) return w; }
    return null;
  };
  /** largest font size in [min,max] so that `s` fits maxW */
  BZF.fit = (s, weight, fam, maxW, max, min, ls = 0) => {
    let sz = max;
    while (sz > min && measure(s, `${weight} ${sz}px ${fam}`, ls) > maxW) sz -= 2;
    return sz;
  };
  /** first narration/speech segment that starts inside chapter `id` */
  BZF.firstSeg = id => {
    const c = TL.ch(id);
    return TL.data.segments.find(s => s.start >= c.start - .01 && s.start < c.end) || null;
  };
  /** brand gradient across [x0,x1] */
  BZF.brandGrad = (x0, x1, y0 = 0, y1 = 0) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, VIOLET); g.addColorStop(.5, AMBER); g.addColorStop(1, ORANGE); return g;
  };
  /** 4-point sparkle */
  BZF.sparkle = (x, y, s, color, alpha) => {
    if (alpha <= 0 || s <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .22, -s * .22); ctx.lineTo(s, 0); ctx.lineTo(s * .22, s * .22);
    ctx.lineTo(0, s); ctx.lineTo(-s * .22, s * .22); ctx.lineTo(-s, 0); ctx.lineTo(-s * .22, -s * .22); ctx.closePath(); ctx.fill(); ctx.restore();
  };

  let LOGO_CLIP = null;
  BZF.logoClip = () => {
    if (!LOGO_CLIP && LOGO.length) { LOGO_CLIP = new Path2D(); for (const pc of LOGO) LOGO_CLIP.addPath(pc.path); }
    return LOGO_CLIP;
  };

  /**
   * Bonzini logo assembly: amber from above, orange from below, wings from the sides,
   * lock at `tLock` with flash + shockwave + spark burst, then rotating rings, breathing glow and shimmer.
   * o: {x, y, size, tLock, fly, alpha, shimmerAt:[t...], rings:true}
   */
  BZF.logoAssembly = (t, o) => {
    const { x, y, size, tLock } = o, fly = o.fly ?? .72, A = o.alpha ?? 1;
    if (t < tLock - fly || A <= 0) return;
    const S = size / 100, p = prog(t, tLock - fly, tLock), lock = t >= tLock;
    ctx.save(); ctx.globalAlpha *= A;
    // back glow
    const gA = lock ? eOutCubic(prog(t, tLock, tLock + .5)) * (.82 + .18 * Math.sin((t - tLock) * 2.4)) : eInCubic(p) * .5;
    const R = size * 1.25, rg = ctx.createRadialGradient(x, y, 0, x, y, R);
    rg.addColorStop(0, `rgba(169,71,254,${.46 * gA})`); rg.addColorStop(.45, `rgba(254,86,13,${.10 * gA})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    // rotating dashed rings after lock
    if (lock && o.rings !== false) {
      const ra = eOutCubic(prog(t, tLock + .04, tLock + .6));
      for (const [r, sp, dash, col, lw] of [[.40, .35, [18, 12], 'rgba(234,246,255,.5)', 2.5], [.45, -.22, [4, 10], 'rgba(243,167,69,.75)', 3], [.50, .12, [60, 20, 4, 20], 'rgba(169,71,254,.7)', 2.5]]) {
        ctx.save(); ctx.globalAlpha *= ra; ctx.translate(x, y); ctx.rotate((t - tLock) * sp); ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = lw;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(0, 0, size * r * lerp(.82, 1, ra), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    // pieces
    const D = o.dist ?? 900;
    const mv = { amber: [0, -1, -.8], orange: [0, 1, .8], wingTop: [-1, 0, -.18], wingBot: [1, 0, .18] };
    const offs = k => { const r = {}; for (const role in mv) { const [mx, my, rot] = mv[role], q = 1 - k; r[role] = [mx * D * q, my * D * .82 * q, rot * q, 1]; } return r; };
    let sx = 0, sy = 0;
    if (lock) { const d = Math.pow(1 - prog(t, tLock, tLock + .32), 2), f = Math.floor(t * 30); sx = (rnd(f * 3.1) - .5) * 18 * d; sy = (rnd(f * 5.7) - .5) * 18 * d; }
    if (!lock) {
      for (const [dp, ga] of [[.12, .16], [.06, .3]]) drawLogo(x, y, size, { offsets: offs(eInCubic(clamp(p - dp))), alpha: ga * clamp(p * 2.2), glow: false });
    }
    const k = eInCubic(p);
    drawLogo(x + sx, y + sy, size, { offsets: offs(k), alpha: clamp(p * 2.4), glowBlur: (lock ? 24 + 8 * Math.sin((t - tLock) * 3) : 14) * S });
    if (lock) {
      // flash
      const fl = 1 - prog(t, tLock, tLock + .32);
      if (fl > 0) {
        const fr = size * 1.05, fg = ctx.createRadialGradient(x, y, 0, x, y, fr);
        fg.addColorStop(0, `rgba(255,255,255,${.9 * fl})`); fg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = fg; ctx.fillRect(x - fr, y - fr, fr * 2, fr * 2);
      }
      // shockwaves
      const p1 = prog(t, tLock, tLock + .85), p2 = prog(t, tLock + .08, tLock + .95);
      if (p1 < 1) ring(x, y, size * .3 + size * 1.9 * eOutExpo(p1), VIOLET, 9 * (1 - p1) + 1, 1 - p1);
      if (p2 > 0 && p2 < 1) ring(x, y, size * .25 + size * 1.3 * eOutExpo(p2), AMBER, 6 * (1 - p2) + 1, 1 - p2);
      // spark burst
      const q = prog(t, tLock, tLock + .7);
      if (q < 1) for (let i = 0; i < 22; i++) {
        const ang = (i / 22) * Math.PI * 2 + rnd(i * 3.3) * .3, d = size * (.32 + (.45 + rnd(i * 7.1) * .55) * eOutExpo(q));
        BZF.sparkle(x + Math.cos(ang) * d, y + Math.sin(ang) * d, (5 + rnd(i * 2.2) * 9) * (1 - q), i % 3 ? '#FFFFFF' : AMBER, 1 - q);
      }
      // shimmer sweeps
      for (const ts of (o.shimmerAt || [tLock + 1.1])) {
        const sw = prog(t, ts, ts + .7); if (sw <= 0 || sw >= 1) continue;
        const clip = BZF.logoClip(); if (!clip) continue;
        const sxp = lerp(x - size * .45, x + size * .45, eInOutCubic(sw)), sg = ctx.createLinearGradient(sxp - size * .14, 0, sxp + size * .14, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save(); ctx.translate(x, y); ctx.scale(S, S); ctx.translate(-50, -50); ctx.clip(clip);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = sg; ctx.fillRect(x - size, y - size, size * 2, size * 2); ctx.restore();
      }
    }
    ctx.restore();
  };

  // ------------------------------------------------------------------ hook scene
  const SEG = 'V01';
  const SZ = 104, LH = 128;                 // question type size / line height
  const BY = 712;                           // band centre
  const PAD = 58;
  const BH = LH * 3 + PAD * 2 - 20;         // band height
  const FNT = sz => `800 ${sz}px ${FONT.body}`;

  /** lay out a line of words centred on 540; returns [{s, x, w}] */
  function layoutLine(words, sz) {
    const f = FNT(sz), sp = measure(' ', f);
    const ws = words.map(s => measure(s, f)); const tot = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let x = 540 - tot / 2; const out = [];
    words.forEach((s, i) => { out.push({ s, x, w: ws[i] }); x += ws[i] + sp; });
    return out;
  }

  /** kinetic word slam: scale-down + rise + ghost trail. */
  function slamWord(t, wd, y, ts, o = {}) {
    if (t < ts) return;
    const sz = o.size || SZ, k = prog(t, ts, ts + .5), a = eOutCubic(prog(t, ts, ts + .12));
    const from = 1 + Math.min((o.from || 1.38) - 1, 120 / Math.max(1, wd.w));   // overshoot ≤ ~60 px per side
    const e = eOutExpo(k), sc = lerp(from, 1, e), dy = lerp(22, 0, e);
    const cx = wd.x + wd.w / 2, cy = y - sz * .36;
    // words after the first grow from their left edge so they never collide with the previous word
    const ax = o.anchorLeft ? (sc - 1) * wd.w / 2 : 0;
    ctx.save(); ctx.translate(cx + ax, cy + dy);
    if (k < .55) { // motion ghost
      ctx.save(); ctx.scale(sc * 1.08, sc * 1.08);
      txt(wd.s, 0, sz * .36, { font: FNT(sz), color: o.color || '#FFFFFF', align: 'center', alpha: a * .22 * (1 - k / .55), shadow: false });
      ctx.restore();
    }
    ctx.scale(sc, sc);
    txt(wd.s, 0, sz * .36, { font: FNT(sz), color: o.color || '#FFFFFF', align: 'center', alpha: a, glow: o.glow || null, glowBlur: 26, shadowBlur: 18 });
    ctx.restore();
  }

  function band(t, openK, n) {
    if (openK <= 0) return;
    const h = BH * openK, y0 = BY - h / 2;
    ctx.save();
    // soft shadow falloff above / below
    const sh = ctx.createLinearGradient(0, y0 - 90, 0, y0 + h + 90);
    const f = 90 / (h + 180);
    sh.addColorStop(0, 'rgba(5,3,14,0)'); sh.addColorStop(f, 'rgba(5,3,14,.45)'); sh.addColorStop(1 - f, 'rgba(5,3,14,.45)'); sh.addColorStop(1, 'rgba(5,3,14,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, y0 - 90, W, h + 180);
    // body
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(10,6,26,.93)'); g.addColorStop(.5, 'rgba(14,8,34,.95)'); g.addColorStop(1, 'rgba(10,6,26,.93)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, h);
    // inner violet glow drifting
    const gx = 540 + Math.sin(t * .9) * 260, rg = ctx.createRadialGradient(gx, BY, 0, gx, BY, 520);
    rg.addColorStop(0, 'rgba(169,71,254,.20)'); rg.addColorStop(1, 'rgba(169,71,254,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, y0, W, h);
    // scanline texture
    ctx.fillStyle = 'rgba(255,255,255,.028)';
    for (let yy = y0 + ((t * 40) % 6); yy < y0 + h; yy += 6) ctx.fillRect(0, yy, W, 1.5);
    // accent edges (grow from centre)
    const lw = W * eOutExpo(clamp(openK * 1.1));
    ctx.save(); ctx.shadowColor = VIOLET; ctx.shadowBlur = 18;
    ctx.fillStyle = BZF.brandGrad(0, W); ctx.fillRect(540 - lw / 2, y0 - 3, lw, 6);
    ctx.fillStyle = 'rgba(169,71,254,.95)'; ctx.fillRect(540 - lw / 2, y0 + h - 2, lw, 3);
    ctx.restore();
    // HUD ticks on the edges
    const ta = clamp((openK - .6) / .4);
    if (ta > 0) {
      ctx.globalAlpha *= ta; ctx.strokeStyle = 'rgba(234,246,255,.55)'; ctx.lineWidth = 3;
      for (const sx of [28, W - 28]) { ctx.beginPath(); ctx.moveTo(sx, BY - 46); ctx.lineTo(sx, BY + 46); ctx.stroke(); }
      ctx.fillStyle = AMBER; for (const sx of [28, W - 28]) { ctx.fillRect(sx - 4, BY - 4 + Math.sin(t * 3) * 30, 8, 8); }
    }
    ctx.restore();
  }

  function drawHook(t, n) {
    const C = TL.ch('hook'), END = C.end;
    const wt = (s, nth = 0) => TL.wt(SEG, s, null, nth);
    const tVous = wt('vous'), tAch = wt('achetez'), tVos = wt('vos'), tMar = wt('marchandises'), tEn = wt('en'), tChine = wt('chine');
    const qw = BZF.wordExact(SEG, '?'); const tQ = qw ? qw.s : (TL.word(SEG, 'chine')?.e ?? tChine + .4);
    const tDec = wt('decouvrez'), tJus = wt('jusqu'), tVous2 = wt('vous', 1), tEt = wt('etape');

    // ---- 0) scan-line reveal (first 0.4 s)
    const sp = prog(t, .02, .4);
    if (sp < 1) {
      const y = lerp(-30, H + 30, eInOutCubic(sp));
      ctx.save();
      ctx.fillStyle = 'rgba(7,4,16,.97)'; ctx.fillRect(0, y, W, H - y);          // not yet scanned
      const tg = ctx.createLinearGradient(0, y - 220, 0, y);
      tg.addColorStop(0, 'rgba(169,71,254,0)'); tg.addColorStop(1, 'rgba(169,71,254,.42)');
      ctx.fillStyle = tg; ctx.fillRect(0, y - 220, W, 220);
      ctx.shadowColor = CYAN; ctx.shadowBlur = 34; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, y - 2.5, W, 5);
      ctx.shadowColor = VIOLET; ctx.shadowBlur = 44; ctx.fillStyle = 'rgba(92,240,255,.75)'; ctx.fillRect(0, y - 7, W, 14);
      ctx.shadowBlur = 0;
      for (let i = 0; i < 28; i++) { // sparks riding the line
        const x = rnd(i * 3.1) * W, s = 2 + rnd(i * 5.7) * 4;
        ctx.fillStyle = i % 3 ? '#fff' : AMBER; ctx.fillRect(x + Math.sin(t * 40 + i) * 14, y - s / 2 - rnd(i) * 14, s * 3.2, s);
      }
      ctx.restore();
    }
    // flash + interference slices right after the scan
    const fl = prog(t, .36, .62);
    if (fl > 0 && fl < 1) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,236,250,${.30 * (1 - eOutCubic(fl))})`; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 7; i++) {
        const yy = rnd(i * 9.1 + Math.floor(t * 30)) * H, hh = 3 + rnd(i * 4.4) * 18;
        ctx.fillStyle = i % 2 ? `rgba(169,71,254,${.35 * (1 - fl)})` : `rgba(92,240,255,${.25 * (1 - fl)})`; ctx.fillRect(0, yy, W, hh);
      }
      ctx.restore();
    }

    // ---- 1) band
    const openK = eOutExpo(prog(t, .34, .82));
    const outK = eInCubic(prog(t, END - .12, END + .12));
    band(t, openK * (1 - outK), n);
    if (outK >= 1) return;

    const aOut = 1 - outK;
    ctx.save(); ctx.globalAlpha *= aOut;
    const y1 = BY - LH + 36, y2 = BY + 36, y3 = BY + LH + 36;       // baselines (cap-centred)
    const bandTop = BY - BH / 2, bandH = BH;

    // ---- swap bar geometry (at "Découvrez")
    const sw0 = tDec - .06, sw1 = sw0 + .42, swp = prog(t, sw0, sw1);
    const barX = lerp(-80, W + 80, eInOutCubic(swp));

    // ---- message 1: "Vous achetez / vos marchandises / en Chine ?"
    if (swp < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(barX, bandTop - 60, W, bandH + 120); ctx.clip();
      const L1 = layoutLine(['Vous', 'achetez'], SZ), L2 = layoutLine(['vos', 'marchandises'], SZ), L3 = layoutLine(['en', 'Chine', '?'], SZ);
      slamWord(t, L1[0], y1, tVous - .1); slamWord(t, L1[1], y1, tAch - .08, { anchorLeft: true });
      slamWord(t, L2[0], y2, tVos - .08); slamWord(t, L2[1], y2, tMar - .08, { anchorLeft: true });
      slamWord(t, L3[0], y3, tEn - .08);
      // "Chine" amber + glow pulse + underline swipe
      const cg = t >= tChine ? .55 + .45 * Math.exp(-(t - tChine) * 3) : .5;
      slamWord(t, L3[1], y3, tChine - .08, { color: AMBER, glow: `rgba(243,167,69,${cg})`, from: 1.6, anchorLeft: true });
      const ul = eOutExpo(prog(t, tChine + .12, tChine + .5));
      if (ul > 0) {
        ctx.save(); ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 16;
        rrect(L3[1].x, y3 + 20, L3[1].w * ul, 9, 4); ctx.fill(); ctx.restore();
      }
      // "?" drops in with a twist
      if (t >= tQ - .06) {
        const k = prog(t, tQ - .06, tQ + .4), wd = L3[2];
        ctx.save(); ctx.translate(wd.x + wd.w / 2, y3 - 38); ctx.rotate(-.5 * (1 - eOutBack(k))); ctx.scale(lerp(1.9, 1, eOutExpo(k)), lerp(1.9, 1, eOutExpo(k)));
        txt('?', 0, 38, { font: FNT(SZ), color: AMBER, align: 'center', alpha: eOutCubic(clamp(k * 4)), glow: 'rgba(243,167,69,.7)', glowBlur: 24 });
        ctx.restore();
      }
      ctx.restore();
    }

    // ---- message 2: "De la Chine… / jusqu'à vous / [étape par étape]"
    if (swp > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(-10, bandTop - 60, barX + 10, bandH + 120); ctx.clip();
      const M1 = layoutLine(['De', 'la', 'Chine…'], SZ), M2 = layoutLine(['jusqu’à', 'vous'], SZ);
      // M1 words land as the bar passes over them
      for (const wd of M1) {
        let pp = 0; for (let i = 0; i <= 40; i++) { if (lerp(-80, W + 80, eInOutCubic(i / 40)) >= wd.x + wd.w * .3) { pp = i / 40; break; } }
        const ts = lerp(sw0, sw1, pp) - .04;
        const isC = wd.s.startsWith('Chine');
        slamWord(t, wd, y1, ts, isC ? { color: AMBER, glow: 'rgba(243,167,69,.55)', from: 1.25 } : { from: 1.25 });
      }
      slamWord(t, M2[0], y2, tJus - .12); slamWord(t, M2[1], y2, tVous2 - .1, { anchorLeft: true });
      // route bridge (China → you) filling the pause before "jusqu'à vous"
      const rA = sw1 - .12, rB = tJus - .1, rk = prog(t, rA, rB), rOut = prog(t, tJus - .16, tJus + .12);
      if (rk > 0 && rOut < 1) {
        const x0 = 150, x1 = 930, yy = BY - 8, hx = lerp(x0, x1, eInOutCubic(rk));
        ctx.save(); ctx.globalAlpha *= 1 - eInCubic(rOut);
        ctx.setLineDash([16, 12]); ctx.lineDashOffset = -t * 60; ctx.strokeStyle = 'rgba(234,246,255,.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(hx, yy); ctx.stroke(); ctx.setLineDash([]);
        const tr = ctx.createLinearGradient(hx - 220, 0, hx, 0); tr.addColorStop(0, 'rgba(243,167,69,0)'); tr.addColorStop(1, 'rgba(243,167,69,.9)');
        ctx.fillStyle = tr; ctx.fillRect(Math.max(x0, hx - 220), yy - 3, Math.min(220, hx - x0), 6);
        ctx.beginPath(); ctx.arc(x0, yy, 9, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.fill();
        pin(x1, yy - 14, 30, ORANGE);
        ctx.shadowColor = AMBER; ctx.shadowBlur = 22; ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(hx, yy, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // arrival marker under "vous"
      const vu = eOutExpo(prog(t, tVous2 + .1, tVous2 + .5));
      if (vu > 0) { ctx.save(); ctx.fillStyle = BZF.brandGrad(M2[1].x, M2[1].x + M2[1].w); ctx.shadowColor = ORANGE; ctx.shadowBlur = 14; rrect(M2[1].x, y2 + 22, M2[1].w * vu, 8, 4); ctx.fill(); ctx.restore(); }
      // amber pill "étape par étape"
      const t3 = tEt - .16, pk = eOutExpo(prog(t, t3, t3 + .5));
      if (pk > 0) {
        const s3 = 'étape par étape', f3 = FNT(SZ - 8), tw = measure(s3, f3), pw = tw + 76, ph = 118;
        const px = 540 - pw / 2, py = y3 - 88;
        ctx.save();
        ctx.shadowColor = 'rgba(243,167,69,.55)'; ctx.shadowBlur = 30;
        rrect(px, py, pw * pk, ph, 22); ctx.fillStyle = AMBER; ctx.fill(); ctx.shadowBlur = 0;
        ctx.clip();
        txt(s3, 540, y3 + 2 + (1 - pk) * 14, { font: f3, color: '#170B02', align: 'center', shadow: false });
        // shine sweep
        const shp = prog(t, t3 + .55, t3 + 1.15);
        if (shp > 0 && shp < 1) {
          const sx = lerp(px - 120, px + pw + 120, shp), sg = ctx.createLinearGradient(sx - 80, 0, sx + 80, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sg; ctx.fillRect(px, py, pw, ph);
        }
        ctx.restore();
        // step chevrons flowing on both sides
        for (let i = 0; i < 3; i++) {
          const a = pk * (.35 + .65 * (0.5 + 0.5 * Math.sin(t * 6 - i * 1.1)));
          for (const side of [-1, 1]) {
            const cx = 540 + side * (pw / 2 + 34 + i * 26), cy = py + ph / 2;
            ctx.save(); ctx.globalAlpha *= a * (1 - i * .22); ctx.strokeStyle = AMBER; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(cx - side * 8, cy - 14); ctx.lineTo(cx + side * 6, cy); ctx.lineTo(cx - side * 8, cy + 14); ctx.stroke(); ctx.restore();
          }
        }
      }
      ctx.restore();
    }

    // ---- the swap bar itself
    if (swp > 0 && swp < 1) {
      ctx.save();
      const tg = ctx.createLinearGradient(barX - 160, 0, barX, 0);
      tg.addColorStop(0, 'rgba(169,71,254,0)'); tg.addColorStop(1, 'rgba(169,71,254,.45)');
      ctx.fillStyle = tg; ctx.fillRect(barX - 160, bandTop, 160, bandH);
      ctx.shadowColor = CYAN; ctx.shadowBlur = 30; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(barX - 3, bandTop - 24, 6, bandH + 48);
      ctx.shadowColor = VIOLET; ctx.shadowBlur = 40; ctx.fillStyle = 'rgba(92,240,255,.7)'; ctx.fillRect(barX - 8, bandTop - 10, 16, bandH + 20);
      ctx.restore();
    }
    ctx.restore();
  }

  registerScene({ id: 'hook', z: 30, when: t => t < TL.ch('hook').end + .15, draw: (t, n) => drawHook(t, n) });
})();

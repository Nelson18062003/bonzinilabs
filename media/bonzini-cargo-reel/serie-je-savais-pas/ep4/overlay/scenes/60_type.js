'use strict';
// =============================================================================================
// « PATRON, ATTENDS ! » — type (from « PAS REÇU. » 60_type.js, the night wax counter).
//   TY_world(t, L)  inside the camera: speaker pills that follow their object (TA COMMANDE kraft, TOI amber,
//                   TON FOURNISSEUR · CHINE steel), the shop label « Boutique · Mboppi », and the world texts a module has
//                   not taken over yet (the pinned tag « Entrepôt · Foyer Balengou »).
//   TY_draw(t, L)   screen space: series chip « JE SAVAIS PAS. · 4/5 », TA COMMANDE's lines (kraft speech cards, written
//                   big), the dark band of the reflex (v2: signed with TA COMMANDE's tab), THE RULE (cream band stamped word by
//                   word, its 3-line sub-line « avant de payer, … »), and the fallbacks of the
//                   texts M1 / M2 take over (« FAUX MESSAGE », the Bonzini caption, the end card: brand, service line,
//                   stamp « MAINTENANT, TU SAIS. », CTA pill « Écris ALLÔ en commentaire » + drawn arrow, tag line).
// Every text comes from SCORE.TEXTS() = [t0, t1, id, text, style, owner]; when window[owner] is a function the module
// draws it and this layer skips it. '|' = line break, *…* = emphasis (orange).
// =============================================================================================
const TY = (function () {
  const S = window.SCORE, G = S.G, T = S.T, A = S.A, kk = S.kk, ease = S.ease, easeOut = S.easeOut;
  const CREAM = '#FFF6E8', INK = '#1A1426', ORANGE = '#FE560D', AMBER = '#F3A745', STEEL = '#5E6878',
    KRAFT = '#D7B07A', KRAFT_D = '#8A6236', KINK = '#2A1A0C';
  const has = n => typeof window[n] === 'function';
  const textsAt = t => S.TEXTS().filter(([a, b, , , st, own]) => t >= a && t < b && st !== 'object' && st !== 'objectMinor' && !(own && has(own)));
  const inOut = (t, a, b, fi = .12, fo = .12) => Math.min(easeOut(kk(t, a, a + fi)), 1 - kk(t, b - fo, b));
  const SAT = (z, w = 900) => `${w} ${z}px Satoshi`;

  // ---------- helpers ----------
  function pill(x, y, label, fill, color, a, size = 40, o = {}) {
    if (a <= 0) return 0;
    ctx.save(); ctx.globalAlpha *= a; ctx.font = SAT(size, o.w || 900); ctx.letterSpacing = (o.ls || 0) + 'px';
    const w = ctx.measureText(label).width + size * 1.1, h = size + 26;
    ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.s) ctx.scale(o.s, o.s);
    ctx.shadowColor = 'rgba(8,4,18,.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    ctx.fillStyle = fill; rrect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 4; ctx.setLineDash(o.dash || []); rrect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, h / 2 - 5); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, 2);
    ctx.restore();
    return w;
  }
  const segs = l => l.split('*').map((s, i) => ({ s, e: i % 2 === 1 })).filter(q => q.s.length);
  const plain = l => l.replace(/\*/g, '');
  function lineW(l, f) { ctx.save(); ctx.font = f; let w = 0; for (const q of segs(l)) w += ctx.measureText(q.s).width; ctx.restore(); return w; }
  function richLine(l, x, y, f, col, emph, align = 'center') {
    const w = lineW(l, f); let cx = align === 'center' ? x - w / 2 : x;
    ctx.save(); ctx.font = f; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (const q of segs(l)) { ctx.fillStyle = q.e ? emph : col; ctx.fillText(q.s, cx, y); cx += ctx.measureText(q.s).width; }
    ctx.restore();
  }
  /** the font size (≤ size, ≥ min) at which every line fits maxW */
  function fit(lines, size, maxW, min = 46, w = 900) { let z = size; for (const l of lines) { const lw = lineW(l, SAT(size, w)); if (lw > maxW) z = Math.min(z, size * maxW / lw); } return Math.max(min, Math.floor(z)); }
  /** cached starved-ink stamp sprite (box, 1–2 lines) */
  function stampSprite(key, lines, size, color, fam = 'Satoshi', wght = 900) {
    const id = 'tystamp_' + key + size; const c = makeCanvasCached(id, 1100, Math.round(size * 1.15 * lines.length + 120)), g = c.getContext('2d');
    if (!c._done) {
      g.font = `${wght} ${size}px ${fam}`; const lw = Math.max(...lines.map(l => g.measureText(l).width)), lh = size * 1.08, bh = lh * lines.length + 40, bw = lw + 70;
      const x0 = (1100 - bw) / 2, y0 = (c.height - bh) / 2;
      g.strokeStyle = color; g.lineWidth = Math.max(7, size * .08); rrectOn(g, x0, y0, bw, bh, 14); g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, 550, y0 + 20 + lh * (i + .5) + size * .04));
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 900; i++) { g.globalAlpha = .25 + rnd(i * 1.7 + size) * .6; g.beginPath(); g.arc(x0 + rnd(i * 1.1 + 3) * bw, y0 + rnd(i * 2.9 + 1) * bh, .6 + rnd(i * 3.3) * 2.4, 0, 7); g.fill(); }
      c._done = true; c._bw = bw; c._bh = bh;
    }
    return c;
  }
  /** a stamp slamming down (k 0..1 = impact progress), on the night: normal blending, a dark halo for separation */
  function stamp(key, lines, x, y, size, color, k, a = 1, rot = -.07) {
    if (k <= 0 || a <= 0) return;
    const c = stampSprite(key, lines, size, color), sc = k < 1 ? 1.7 - .7 * easeOut(k) : 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha *= a * Math.min(1, k * 2);
    ctx.fillStyle = 'rgba(12,6,24,.55)'; rrect(-c._bw / 2 - 18, -c._bh / 2 - 14, c._bw + 36, c._bh + 28, 22); ctx.fill();
    ctx.drawImage(c, -550, -c.height / 2); ctx.restore();
  }
  /** TA COMMANDE's lines: a kraft card (the parcel's own material), torn edges, a dark-kraft tab « TA COMMANDE » */
  function speechCard(t, a, b, s, cy, size, tab, seed, maxW = 880) {
    const lines = s.split('|'), al = a <= 0 ? 1 - kk(t, b - .14, b) : inOut(t, a, b, .1, .14);
    if (al <= 0) return;
    const z = fit(lines.map(plain), size, maxW), lh = z * 1.04, h = lines.length * lh + 64, w = Math.max(...lines.map(l => lineW(l, SAT(z)))) + 100;
    const pop = a <= 0 ? 1 : 1.14 - .14 * easeOut(kk(t, a, a + .16)), d = t - a, sh = d < .35 ? (rnd(Math.floor(t * 15) * 3.3 + seed) - .5) * 6 * (1 - d / .35) : 0;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(G.cx + sh, cy); ctx.rotate((rnd(seed) - .5) * .04); ctx.scale(pop, pop);
    ctx.shadowColor = 'rgba(6,3,14,.65)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
    ctx.fillStyle = KRAFT; ctx.beginPath();
    const top = tornLine(-w / 2, -h / 2, w / 2, -h / 2, 3 + seed, 3, 14), bot = tornLine(w / 2, h / 2, -w / 2, h / 2, 9 + seed, 3, 14);
    ctx.moveTo(...top[0]); for (const p of top) ctx.lineTo(...p); for (const p of bot) ctx.lineTo(...p); ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent';
    const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, 'rgba(255,236,200,.22)'); gr.addColorStop(1, 'rgba(90,50,10,.18)'); ctx.fillStyle = gr; ctx.fill();
    lines.forEach((l, i) => richLine(l, 0, -h / 2 + 32 + lh * (i + .5) + z * .36, SAT(z), KINK, ORANGE));
    if (tab) speakerTab(tab, w, h);
    ctx.restore();
  }
  /** the speaker's dark-kraft tab « TA COMMANDE », under the bottom-right corner of a card (w × h, centred on the origin) */
  function speakerTab(tab, w, h) {
    ctx.save(); ctx.font = SAT(32); const tw = ctx.measureText(tab).width + 36; ctx.translate(w / 2 - tw - 24, h / 2 + 2); ctx.rotate(-.03);
    ctx.shadowColor = 'rgba(6,3,14,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = KRAFT_D; rrect(0, -22, tw, 50, 10); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.fillStyle = CREAM; ctx.textBaseline = 'middle'; ctx.fillText(tab, 18, 4); ctx.restore();
  }

  // ---------- world space ----------
  function world(t, L) {
    for (const p of S.pills(t)) {
      if (p.who === 'cm') pill(p.x, p.y, 'TA COMMANDE', KRAFT, KINK, p.a ?? 1, 36, { s: p.s, border: 'rgba(42,26,12,.5)', dash: [9, 6] });
      if (p.who === 'toi') pill(p.x, p.y, 'TOI', AMBER, INK, p.a ?? 1, 40, { rot: p.rot, border: 'rgba(26,20,38,.55)' });
      if (p.who === 'sup') pill(p.x, p.y, 'TON FOURNISSEUR · CHINE', STEEL, CREAM, p.a ?? 1, 42);   // QA: 36 → 42 (who the honest plate is)
    }
    for (const [a, b, id, s, st] of textsAt(t)) {
      if (st === 'label' || st === 'tagBZ') {                    // kraft tags pinned on the cloth
        const al = inOut(t, a, b, .2, .3), x = st === 'label' ? G.label.x : G.bz.tag.x, y = st === 'label' ? G.label.y : G.bz.tag.y;
        ctx.save(); ctx.translate(x, y); ctx.rotate(st === 'label' ? .05 : -.06); ctx.globalAlpha = al;
        const ls = st === 'tagBZ' ? s.split(' · ').map((q, i, arr) => i < arr.length - 1 ? q + ' ·' : q) : [s], fz = st === 'label' ? 38 : 46;
        ctx.font = SAT(fz, 700); const w = Math.max(...ls.map(q => ctx.measureText(q).width)) + 56, h = ls.length * fz * 1.18 + 32;
        ctx.shadowColor = 'rgba(8,4,18,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
        ctx.fillStyle = st === 'label' ? lit('#D2AB78', x, y, L, .3) : '#D9B482'; rrect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = st === 'label' ? lit('#3B2412', x, y, L, .3) : '#2A1A0C'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ls.forEach((q, i) => ctx.fillText(q, 0, 3 + (i - (ls.length - 1) / 2) * fz * 1.18));
        ctx.fillStyle = st === 'tagBZ' ? '#7B4BFF' : ORANGE; ctx.beginPath(); ctx.arc(-w / 2 + 16, -h / 2 + 14, 8, 0, 7); ctx.fill();   // push pin
        ctx.restore();
      }
    }
  }

  // ---------- screen space ----------
  function screen(t, L) {
    for (const [a, b, id, s, st] of textsAt(t)) {
      // v2 (SCRIPT_V2.md §3): the cards keep SCORE.TEXTS()'s words; only the orange emphasis (*…*) is added here
      if (st === 'speech') speechCard(t, a, b, id === 'c2' ? 'CE N’EST|PEUT-ÊTRE *PAS*|*TON FOURNISSEUR !*' : id === 'c5' ? 'ON SE VOIT|À *DOUALA* !' : s, id === 'hook1' ? G.speechY + 30 : G.speechY, id === 'hook1' ? 140 : 104, id === 'hook1' ? null : 'TA COMMANDE', id.length * 7);
      if (st === 'speech2') speechCard(t, a, b, '*NE PAIE PAS*|SUR CE COMPTE !', G.speech2Y, 100, null, 13, 820);   // QA v2: « SUR CE COMPTE ! » fitted 880 px reached x 980 (y 900–1560): 820 px → 91 px, x 132–948
      if (st === 'band') band(t, a, b, 'APPELLE LE NUMÉRO|QUE TU *CONNAIS DÉJÀ.*', 'TA COMMANDE');
      if (st === 'rule') rule(t, a, b);
      if (st === 'stamp') stamp('faux', ['FAUX MESSAGE'], G.cx, G.fauxY, 104, ORANGE, kk(t, a, a + .14), inOut(t, a, b, .01, .2), -.08);
      if (st === 'caption') caption(t, a, b, s);
      if (st === 'brand') {
        const al = inOut(t, a, b, .3, .1), k = easeOut(kk(t, a, a + .35));
        ctx.save(); ctx.globalAlpha *= al; ctx.font = '800 66px DMSans'; const tw = ctx.measureText(s).width, lg = 112, gap = 22, x0 = G.cx - (lg + gap + tw) / 2;
        drawLogo(x0 + lg / 2, G.end.logoY - 4 - 16 * (1 - k), lg, { alpha: k });
        ctx.fillStyle = CREAM; ctx.textBaseline = 'middle'; ctx.fillText(s, x0 + lg + gap, G.end.logoY + 2); ctx.restore();
      }
      if (st === 'serviceEnd') { ctx.save(); ctx.globalAlpha *= inOut(t, a, b, .3, .1); serviceLine(s, G.cx, G.end.serviceY + (1 - easeOut(kk(t, a, a + .3))) * 16); ctx.restore(); }
      if (st === 'stampEnd') stamp('end', s.split('|'), G.cx, G.end.stampY, 112, ORANGE, kk(t, a, a + .12), inOut(t, a, b, .01, .1), -.06);
      if (st === 'cta') {
        const k = kk(t, a, a + .25), bounce = 1 + .12 * Math.exp(-(t - a) * 6) * Math.sin((t - a) * 18), al = 1 - kk(t, b - .1, b);
        ctx.save(); ctx.translate(G.cx, G.end.ctaY); ctx.scale(bounce * easeOut(k), bounce * easeOut(k)); ctx.globalAlpha *= al;
        pill(0, 0, s, AMBER, INK, 1, 54);
        ctx.strokeStyle = AMBER; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';          // drawn arrow → the comments
        const ay = 58 + 6 * Math.sin(t * 8); ctx.beginPath(); ctx.moveTo(0, ay); ctx.bezierCurveTo(10, ay + 14, -8, ay + 26, 0, ay + 44); ctx.moveTo(-18, ay + 26); ctx.lineTo(0, ay + 46); ctx.lineTo(18, ay + 26); ctx.stroke();
        ctx.restore();
      }
      if (st === 'tagLine') {
        const k = kk(t, a, a + .8), al = 1 - kk(t, b - .1, b);
        ctx.save(); ctx.globalAlpha *= al; ctx.beginPath(); ctx.rect(G.cx - 420, G.end.tagY - 60, 840 * k, 90); ctx.clip();
        ctx.font = '700 50px Shantell'; ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, G.cx, G.end.tagY); ctx.restore();
      }
    }
    chipSeries(t);                                // the series chip, on top of everything (the loop included)
  }
  function chipSeries(t) {
    const x = G.chip.x, y = G.chip.y, f1 = SAT(36), a = 'JE SAVAIS PAS.', b = '4/5';
    ctx.save(); ctx.font = f1; const w1 = ctx.measureText(a).width, w2 = ctx.measureText(b).width, h = 62, w = w1 + w2 + 92;
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; ctx.fillStyle = 'rgba(16,9,30,.92)'; rrect(x, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,246,232,.18)'; ctx.lineWidth = 2; rrect(x + 1, y - h / 2 + 1, w - 2, h - 2, h / 2 - 1); ctx.stroke();
    ctx.fillStyle = CREAM; ctx.textBaseline = 'middle'; ctx.fillText(a, x + 26, y + 2);
    ctx.fillStyle = 'rgba(255,246,232,.55)'; ctx.beginPath(); ctx.arc(x + 26 + w1 + 20, y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = ORANGE; ctx.fillText(b, x + 26 + w1 + 40, y + 2); ctx.restore();
  }
  /** the dark band of the reflex (night zone, top); v2: signed with TA COMMANDE's tab (C3 is the parcel's line) */
  function band(t, a, b, s, tab) {
    const lines = s.split('|'), al = inOut(t, a, b, .14, .16), z = fit(lines.map(plain), 84, 900), lh = z * 1.12, h = lines.length * lh + 56;
    const w = Math.max(...lines.map(l => lineW(l, SAT(z)))) + 90, pop = 1.08 - .08 * easeOut(kk(t, a, a + .18));
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(G.cx, G.bandY); ctx.scale(pop, pop);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 30; ctx.fillStyle = 'rgba(10,6,22,.9)'; rrect(-w / 2, -h / 2, w, h, 26); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,246,232,.16)'; ctx.lineWidth = 2; rrect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 22); ctx.stroke();
    lines.forEach((l, i) => richLine(l, 0, -h / 2 + 28 + lh * (i + .5) + z * .36, SAT(z), CREAM, ORANGE));
    if (tab) speakerTab(tab, w, h);
    ctx.restore();
  }
  /** THE RULE: cream band, ink and orange, 2 lines stamped word by word (A.ruleW), + the sub-line on « appelle » */
  // QA (stage 3): on 2 lines, « NOUVEAU COMPTE ? » only fitted 900 px at the 90 px floor (948 px wide, under the 96 px
  // title bar, 66 px from the frame edges). The rule is now a 4-line poster — one word per line, each stamped on its spoken
  // word (A.ruleW): NOUVEAU / COMPTE ? (ink, the « ? » orange) · ANCIEN / NUMÉRO. (orange), ≈ 128 px, x 200…880; the
  // sub-line wraps on 2 lines. The card grows DOWNWARD when the sub-line comes in (the 4 words never move).
  function rule(t, a, b) {
    const al = inOut(t, a, b, .14, .2), WORDS = ['NOUVEAU', 'COMPTE ?', 'ANCIEN', 'NUMÉRO.'];
    const z = fit(WORDS, 128, 700, 96), lh = z * 1.0;
    const sub = S.TEXTS().find(x => x[2] === 'ruleSub'), subK = sub ? easeOut(kk(t, sub[0], sub[0] + .3)) : 0;
    const fs = SAT(48, 700), subL = sub ? wrap2(sub[3], fs, 700) : [], slh = 58;
    const wW = Math.max(...WORDS.map(q => lineW(q, SAT(z)))), w = Math.max(wW, ...subL.map(q => lineW(q, fs))) + 120;
    const hW = 4 * lh + 64, hS = subL.length * slh + 26, top = G.ruleY - (hW + hS) / 2, h = hW + hS * subK;
    ctx.save(); ctx.globalAlpha *= al;
    ctx.translate(G.cx, top); ctx.rotate(-.012);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 12; ctx.fillStyle = CREAM; rrect(-w / 2, 0, w, h, 26); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(254,86,13,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-wW / 2, 34 + 2 * lh + 4); ctx.lineTo(wW / 2, 34 + 2 * lh + 4); ctx.stroke();   // question | answer
    ctx.font = SAT(z); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    WORDS.forEach((wd, i) => {
      const t0 = A.ruleW[i], k = kk(t, t0 - .04, t0 + .08); if (k <= 0) return;
      const ww = ctx.measureText(wd).width, y = 34 + lh * i + z * .78 + (i >= 2 ? 8 : 0), sc = 1.45 - .45 * easeOut(k);
      ctx.save(); ctx.translate(0, y - z * .35); ctx.scale(sc, sc); ctx.globalAlpha *= Math.min(1, k * 2);
      if (i < 2) {                                // « NOUVEAU COMPTE ? » ink, the « ? » orange
        const q = wd.indexOf('?'); ctx.fillStyle = INK; ctx.fillText(q < 0 ? wd : wd.slice(0, q), -ww / 2, z * .35);
        if (q >= 0) { ctx.fillStyle = ORANGE; ctx.fillText('?', -ww / 2 + ctx.measureText(wd.slice(0, q)).width, z * .35); }
      } else { ctx.fillStyle = ORANGE; ctx.fillText(wd, -ww / 2, z * .35); }   // « ANCIEN NUMÉRO. » orange
      ctx.restore();
    });
    if (subK > 0) { ctx.save(); ctx.globalAlpha *= subK; ctx.font = fs; ctx.fillStyle = INK; ctx.textAlign = 'center'; subL.forEach((q, i) => ctx.fillText(q, 0, hW + 30 + slh * i + (1 - subK) * 10)); ctx.restore(); }
    ctx.restore();
  }
  /** one line if it fits maxW, else 2 lines split at the space nearest the middle */
  function wrap2(s, f, maxW) {
    if (s.includes('|')) return s.split('|');
    if (lineW(s, f) <= maxW) return [s];
    const sp = [...s].map((c, i) => c === ' ' ? i : -1).filter(i => i > 0); if (!sp.length) return [s];
    const i = sp.reduce((best, j) => Math.abs(j - s.length / 2) < Math.abs(best - s.length / 2) ? j : best, sp[0]);
    return [s.slice(0, i), s.slice(i + 1)];
  }
  /** the Bonzini caption (fallback: M2 takes it over) */
  function caption(t, a, b, s) {
    const lines = s.split('|'), al = inOut(t, a, b, .14, .14), z = fit(lines, 72, 860), lh = z * 1.12, h = lines.length * lh + 50;
    const w = Math.max(...lines.map(l => lineW(l, SAT(z)))) + 90;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(G.cx, G.bz.serviceY + (1 - easeOut(kk(t, a, a + .18))) * 20);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 24; ctx.fillStyle = CREAM; rrect(-w / 2, -h / 2, w, h, 22); ctx.fill(); ctx.shadowColor = 'transparent';
    lines.forEach((l, i) => richLine(l, 0, -h / 2 + 25 + lh * (i + .5) + z * .36, SAT(z), INK, ORANGE));
    ctx.restore();
  }
  function serviceLine(l, x, y) {
    // « → » drawn as a shape (font-safe): split around it
    const f = SAT(46, 700), parts = l.split('→');
    ctx.save(); ctx.font = f; const aw = 50; const ws = parts.map(p => ctx.measureText(p).width); const tot = ws.reduce((q, v) => q + v, 0) + (parts.length - 1) * aw;
    let cx = x - tot / 2; ctx.fillStyle = CREAM; ctx.textBaseline = 'middle';
    parts.forEach((p, i) => { ctx.fillText(p, cx, y); cx += ws[i]; if (i < parts.length - 1) { ctx.strokeStyle = CREAM; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + 8, y); ctx.lineTo(cx + aw - 10, y); ctx.moveTo(cx + aw - 22, y - 11); ctx.lineTo(cx + aw - 9, y); ctx.lineTo(cx + aw - 22, y + 11); ctx.stroke(); cx += aw; } });
    ctx.restore();
  }
  return { world, screen, pill, stamp, stampSprite, speechCard, speakerTab, band, rule, caption, serviceLine, chipSeries, fit, richLine, lineW };
})();
function TY_world(t, L) { TY.world(t, L); }
function TY_draw(t, L) { TY.screen(t, L); }

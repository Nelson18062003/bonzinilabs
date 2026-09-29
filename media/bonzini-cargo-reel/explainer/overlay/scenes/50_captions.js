'use strict';
// ============================================================================================
// 50_captions.js — broadcast-grade karaoke captions for EVERY spoken segment.
//   vo (narrator)      : ink plate, subtle violet border + violet accent bar on the left.
//   sp (team on site)  : ink plate, amber border, amber tag « L'équipe sur place » with a mic,
//                        French quotes « … ».
// Pages are built from the word timings (TL data only, no hard-coded seconds): tokens are split
// into short pages (3–7 words, 1–2 balanced lines) by a small dynamic program, each page shows
// slightly before its first word and stays until the next one. An amber pill slides from word
// to word (ink text on it, clip-redrawn so the slide is exact); `emph` words stay amber.
// Zone: plate bottom-anchored at y 1424, centred on x 540, ≤ 928 px wide, tag ≥ 1150.
// ============================================================================================
(() => {
  const C = {
    size: 66, weight: 800, ls: -1.2, lineH: 82, padX: 40, padY: 20, maxLineW: 856, base: 63,
    cx: 540, bottom: 1424, radius: 18,
    lead: 0.14, hold: 0.6, mergeGap: 1.0,          // page timing (s)
    tIn: 0.15, tOut: 0.13, tMorph: 0.16, tSwap: 0.24, // transitions (s); tSwap = morph when the speaker changes
    pillPad: 10, pillUp: 56, pillDown: 16, pillR: 16, pillLead: 0.04, pillSlide: 0.08,
    gapExtra: 4,                                   // extra px between words (air around the pill)
    tagH: 54, tagGap: 10, tagSize: 36, showTag: false,
  };
  const UNSPOKEN = 'rgba(255,255,255,.84)', SPOKEN = '#FFFFFF';
  // words a page / line must not end on (article, preposition, possessive, auxiliary…)
  const HEAVY = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'un', 'une', 'en', 'a', 'au', 'aux', 'par', 'pour', 'dans',
    'sur', 'et', 'qui', 'que', 'sa', 'son', 'ses', 'vos', 'votre', 'notre', 'nos', 'il', 'ne', 'qua', 'jusqua', 'jusquen', 'chez',
    'avec', 'tres', 'ce', 'ces', 'cette', 'mon', 'ma', 'mes', 'leur', 'leurs', 'plusieurs', 'est', 'sont', 'ont', 'sera', 'ete']);
  const LIGHT = new Set(['nous', 'vous', 'elles', 'comment', 'plus', 'reste', 'toute', 'tout', 'meme']);
  // pairs that should stay together (brand, names, noun + adjective): break penalty
  const GLUE = new Set(['bonzini|trading', 'trading|cargo', 'foyer|balengou', 'marchandises|emballees', 'tres|chers', 'chers|clients',
    'toute|securite', 'meme|conteneur', 'espace|partage', 'etape|par', 'par|etape', 'colis|sont']);
  const BRAND = new Set(['bonzini|trading', 'trading|cargo']);
  /** break penalty between tokens a|b (0 = free): brand name 2, glued pair 1 */
  const glued = (a, b) => (!a || !b || /[,.:;?!…]/.test(a.tail)) ? 0 : BRAND.has(a.key + '|' + b.key) ? 2 : GLUE.has(a.key + '|' + b.key) ? 1 : 0;
  const FONT_S = () => `${C.weight} ${C.size}px ${FONT.body}`;
  const tw = s => (s ? measure(s, FONT_S(), C.ls) : 0);

  let PAGES = null;

  // ---------------- tokens ----------------
  const ALNUM = /[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ]/;
  function wordsOf(seg) {
    if (seg.words && seg.words.length) return seg.words;
    // fallback: no word timings -> spread the text over the segment by character count
    const ws = (seg.text || '').split(/\s+/).filter(Boolean), tot = ws.reduce((a, w) => a + w.length + 1, 0) || 1;
    let s = seg.start; const d = seg.end - seg.start;
    return ws.map(w => { const e = s + d * (w.length + 1) / tot; const o = { w, s, e }; s = e; return o; });
  }
  function tokens(seg) {
    const out = [];
    for (const w of wordsOf(seg)) {
      const raw = String(w.w).trim(); if (!raw) continue;
      if (!ALNUM.test(raw)) {                        // standalone punctuation -> glue to previous word
        const p = out[out.length - 1]; if (!p) continue;
        const sp = /^[?!;]/.test(raw) ? ' ' : /^:/.test(raw) ? ' ' : '';
        p.tail += sp + raw; p.e = Math.max(p.e, w.e); continue;
      }
      const m = raw.match(/^(.*[0-9A-Za-zÀ-ÖØ-öø-ÿŒœ])(.*)$/);
      let tail = m[2];
      tail = tail.replace(/^\s*([?!;])/, ' $1').replace(/^\s*:/, ' :');
      out.push({ core: m[1].replace(/'/g, '’'), tail, s: w.s, e: w.e, emph: !!w.emph, key: norm(m[1]) });
    }
    return out;
  }

  // ---------------- layout of one page ----------------
  function layout(toks, openQ, closeQ) {
    const n = toks.length, gap = tw(' ') + C.gapExtra;
    const items = toks.map((k, i) => {
      const last = i === n - 1;
      const tail = last && /^[.,]$/.test(k.tail) ? '' : k.tail;   // no dangling . or , at page end
      const it = { tok: k, pre: openQ && i === 0 ? '« ' : '', core: k.core, tail, post: closeQ && last ? ' »' : '' };
      it.preW = tw(it.pre); it.coreW = tw(it.core); it.tailW = tw(it.tail); it.postW = tw(it.post);
      it.w = it.preW + it.coreW + it.tailW + it.postW;
      // the pill covers the word + glued punctuation (",", ".", "…") but not spaced marks (" ?", " :")
      it.pillX = it.preW; it.pillW = it.coreW + (it.tail && !/^[   ]/.test(it.tail) ? it.tailW : 0);
      return it;
    });
    const lineW = (a, b) => { let w = 0; for (let i = a; i < b; i++) w += items[i].w + (i > a ? gap : 0); return w; };
    const build = brk => {
      const ranges = brk ? [[0, brk], [brk, n]] : [[0, n]];
      const lines = ranges.map(([a, b]) => ({ items: items.slice(a, b), w: lineW(a, b) }));
      for (const L of lines) { let x = -L.w / 2; for (const it of L.items) { it.x = x; x += it.w + gap; } }
      lines.forEach((L, li) => L.items.forEach(it => { it.line = li; }));
      const tw_ = Math.max(...lines.map(L => L.w));
      return { lines, items, textW: tw_, w: Math.min(936, tw_ + 2 * C.padX), h: lines.length * C.lineH + 2 * C.padY };
    };
    const w1 = lineW(0, n);
    if (w1 <= C.maxLineW) { const L = build(0); L.cost = 0; return L; }
    let best = null;
    for (let k = 1; k < n; k++) {
      const a = lineW(0, k), b = lineW(k, n);
      if (a > C.maxLineW || b > C.maxLineW) continue;
      const e = items[k - 1].tok, nx = items[k].tok; let c = 1.5 + Math.abs(a - b) / 90 + (a > b ? 0 : 0.5);   // slight pyramid preference
      if (/[,:;…]/.test(e.tail)) c -= 3; else if (/[.?!]/.test(e.tail)) c -= 4;
      else if (HEAVY.has(e.key)) c += 9; else if (LIGHT.has(e.key)) c += 3;
      c += glued(e, nx) * 10;
      if (HEAVY.has(nx.key) && !HEAVY.has(e.key) && !/[,:;….?!]/.test(e.tail)) c -= 1.5;   // natural phrase start (préposition, article…)
      if (!best || c < best.c) best = { k, c };
    }
    if (!best) return null;
    const L = build(best.k); L.cost = best.c; return L;
  }

  // ---------------- pagination (dynamic programming per segment) ----------------
  /** when a page starting at token j appears: slightly before its first word, never cutting the previous word short */
  function t0Of(toks, j) {
    const f = toks[j], pv = j > 0 ? toks[j - 1] : null; let t0 = f.s - C.lead;
    if (pv && pv.e > t0) t0 = Math.max(t0, Math.min(pv.e, f.s) - 0.06);
    return t0;
  }
  function pageCost(toks, j, i, L) {
    const n = toks.length, nw = i - j; let c = 5 + L.cost;
    if (nw === 1) c += 28; else if (nw === 2) c += 7; else if (nw >= 7) c += 4 + (nw - 7) * 8;
    const s0 = t0Of(toks, j), s1 = i < n ? t0Of(toks, i) : toks[n - 1].e + C.hold, dur = s1 - s0;
    if (dur < 1.02) c += 30 + (1.02 - dur) * 60; else if (dur < 1.35) c += (1.35 - dur) * 10;
    if (dur > 3.6) c += (dur - 3.6) * 5;
    if (i < n) {
      const last = toks[i - 1];
      if (/[.?!…:]/.test(last.tail)) c += 0; else if (/[,;]/.test(last.tail)) c += 1.5;
      else { c += 8; if (HEAVY.has(last.key)) c += 30; else if (LIGHT.has(last.key)) c += 10; }
      c += glued(last, toks[i]) * 15;
    }
    // a page must not open with the last word of the previous clause (« ici, au niveau… »)
    if (j > 0 && i - j > 1 && /[,;:]/.test(toks[j].tail) && !/[.?!…:,;]/.test(toks[j - 1].tail)) c += 7;
    return c;
  }
  function paginate(seg) {
    const toks = tokens(seg), n = toks.length, sp = seg.kind === 'sp';
    if (!n) return [];
    const best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1), lay = new Array(n + 1).fill(null);
    best[0] = 0;
    for (let i = 1; i <= n; i++) {
      for (let j = i - 1; j >= 0 && i - j <= 9; j--) {
        if (j < i - 1 && /[.?!]/.test(toks[j].tail)) break;            // sentence end inside -> invalid (and for smaller j)
        if (!isFinite(best[j])) continue;
        const L = layout(toks.slice(j, i), sp && j === 0, sp && i === n); if (!L) continue;
        const c = best[j] + pageCost(toks, j, i, L);
        if (c < best[i]) { best[i] = c; from[i] = j; lay[i] = L; }
      }
    }
    const pages = []; let i = n;
    if (!isFinite(best[n])) {                                          // should not happen: 1 word per page fallback
      return toks.map((k, q) => ({ seg, kind: seg.kind, toks: [k], L: layout([k], sp && q === 0, sp && q === n - 1), all: toks, j: q }));
    }
    while (i > 0) { const j = from[i]; pages.unshift({ seg, kind: seg.kind, toks: toks.slice(j, i), L: lay[i], all: toks, j }); i = j; }
    return pages;
  }

  function build() {
    const segs = TL.data.segments.filter(s => s.kind === 'vo' || s.kind === 'sp').slice().sort((a, b) => a.start - b.start);
    const all = [];
    for (const seg of segs) {
      const pages = paginate(seg);
      pages.forEach((p, q) => {
        const f = p.toks[0];
        p.t0 = t0Of(p.all, p.j);
        p.first = q === 0; p.last = q === pages.length - 1;
        p.chapter = TL.ch(seg.chapter) || TL.chAt(f.s);
      });
      all.push(...pages);
    }
    for (let q = 0; q < all.length; q++) {
      const p = all[q], nx = all[q + 1], lastTok = p.toks[p.toks.length - 1];
      p.prev = p.prev || null; p.next = null;
      if (!p.last) { p.t1 = nx.t0; p.next = nx; nx.prev = p; continue; }
      let t1 = lastTok.e + C.hold;
      if (p.chapter) t1 = Math.min(t1, p.chapter.end - 0.08);
      if (nx) {
        // one continuous plate (it morphs, even across a speaker change) when the next line follows closely
        const sameRun = nx.chapter === p.chapter && nx.t0 - lastTok.e < C.mergeGap;
        if (sameRun) { t1 = nx.t0; p.next = nx; nx.prev = p; }
        else t1 = Math.min(t1, nx.t0);
      }
      p.t1 = Math.max(t1, lastTok.e + 0.1);
    }
    for (const p of all) {
      p.rect = { x: C.cx - p.L.w / 2, y: C.bottom - p.L.h, w: p.L.w, h: p.L.h };
    }
    return all;
  }
  const pages = () => (PAGES || (PAGES = build()));
  const pageAt = t => pages().find(p => t >= p.t0 && t < p.t1) || null;

  // ---------------- drawing helpers ----------------
  const lerpR = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });

  /** plate; mix 0 = narrator (violet), 1 = team member (amber) — blends during a speaker change */
  function drawPlate(r, mix, alpha) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    rrect(r.x, r.y, r.w, r.h, C.radius);
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(24,14,50,.93)'); g.addColorStop(1, 'rgba(10,6,22,.94)');
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10;
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (mix < 1) {
      // violet accent bar flush with the left edge (clipped to the rounded plate)
      ctx.save(); ctx.globalAlpha *= 1 - mix; rrect(r.x, r.y, r.w, r.h, C.radius); ctx.clip();
      const vg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); vg.addColorStop(0, '#C07BFF'); vg.addColorStop(1, '#8A34F0');
      ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, 9, r.h);
      ctx.fillStyle = 'rgba(169,71,254,.28)'; ctx.fillRect(r.x + 9, r.y, 5, r.h);
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= 1 - mix; rrect(r.x, r.y, r.w, r.h, C.radius);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(169,71,254,.62)'; ctx.stroke(); ctx.restore();
    }
    if (mix > 0) {
      ctx.save(); ctx.globalAlpha *= mix; rrect(r.x, r.y, r.w, r.h, C.radius);
      ctx.shadowColor = 'rgba(243,167,69,.55)'; ctx.shadowBlur = 16;
      ctx.lineWidth = 3; ctx.strokeStyle = AMBER; ctx.stroke(); ctx.restore();
    }
    // hairline inner top highlight (premium glass edge)
    ctx.save(); rrect(r.x, r.y, r.w, r.h, C.radius); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(r.x + C.radius, r.y + 2.5); ctx.lineTo(r.x + r.w - C.radius, r.y + 2.5); ctx.stroke(); ctx.restore();
    ctx.restore();
  }

  function micIcon(x, y, s, color) {        // (x,y) = top-centre, s = height
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
    rrect(x - s * .19, y, s * .38, s * .56, s * .19); ctx.fill();
    ctx.lineWidth = Math.max(2.5, s * .085);
    ctx.beginPath(); ctx.arc(x, y + s * .34, s * .31, Math.PI * .02, Math.PI * .98); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + s * .66); ctx.lineTo(x, y + s * .86); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * .2, y + s * .9); ctx.lineTo(x + s * .2, y + s * .9); ctx.stroke();
    // capsule grille
    ctx.strokeStyle = 'rgba(243,167,69,.9)'; ctx.lineWidth = Math.max(1.5, s * .045);
    for (let i = 0; i < 3; i++) { const yy = y + s * (.16 + i * .12); ctx.beginPath(); ctx.moveTo(x - s * .09, yy); ctx.lineTo(x + s * .09, yy); ctx.stroke(); }
    ctx.restore();
  }

  function drawTag(r, alpha, rise) {
    if (alpha <= 0) return;
    const label = 'L’équipe sur place', f = `800 ${C.tagSize}px ${FONT.body}`;
    const lw = measure(label, f, 0), icon = 30, w = 22 + icon + 12 + lw + 26, h = C.tagH;
    const x = r.x, y = r.y - C.tagGap - h + rise;
    ctx.save(); ctx.globalAlpha *= alpha;
    rrect(x, y, w, h, 14);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    ctx.fillStyle = AMBER; ctx.fill(); ctx.shadowColor = 'transparent';
    micIcon(x + 22 + icon / 2, y + (h - 34) / 2, 34, INK);
    txt(label, x + 22 + icon + 12, y + h / 2 + 1, { font: f, color: INK, base: 'middle', shadow: false });
    ctx.restore();
  }

  function stateColor(it, t) {
    const spoken = t >= it.tok.s - C.pillLead;
    return spoken ? (it.tok.emph ? AMBER : SPOKEN) : UNSPOKEN;
  }

  /** pill rectangle for item (page-local coords → absolute) */
  function pillRect(p, it) {
    const bl = p.rect.y + C.padY + it.line * C.lineH + C.base;
    return { x: C.cx + it.x + it.pillX - C.pillPad, y: bl - C.pillUp, w: it.pillW + 2 * C.pillPad, h: C.pillUp + C.pillDown, line: it.line };
  }

  /** current pill {r, a} on page p at time t (or null) */
  function pillAt(p, t) {
    const items = p.L.items; let a = -1;
    for (let i = 0; i < items.length; i++) if (t >= items[i].tok.s - C.pillLead) a = i;
    if (a < 0) return null;
    const it = items[a], tok = it.tok;
    const nextTok = a + 1 < items.length ? items[a + 1].tok : (p.next && p.next.seg === p.seg ? p.next.toks[0] : null);
    let alpha = 1;
    if (!nextTok || nextTok.s - tok.e > 0.7) alpha = 1 - eInOutCubic(prog(t, tok.e + 0.22, tok.e + 0.42));
    if (alpha <= 0) return null;
    let r = pillRect(p, it);
    const k = prog(t, tok.s - C.pillLead, tok.s - C.pillLead + C.pillSlide);
    if (k < 1) {
      const pv = a > 0 ? items[a - 1] : null;
      if (pv && pv.line === it.line && tok.s - pv.tok.e < 0.5) r = lerpR(pillRect(p, pv), r, eOutExpo(k));
      else {                                                           // pop in (new line / after a pause)
        const e = eOutBack(k), sc = .72 + .28 * e, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        r = { x: cx - r.w * sc / 2, y: cy - r.h * sc / 2, w: r.w * sc, h: r.h * sc };
        alpha *= eOutCubic(clamp(k * 1.6));
      }
    }
    return { r, a: alpha };
  }

  function drawItems(p, t, dy, colorFn) {
    for (const L of p.L.lines) {
      const bl = p.rect.y + C.padY + L.items[0].line * C.lineH + C.base + dy;
      for (const it of L.items) {
        let x = C.cx + it.x;
        const col = colorFn(it);
        if (it.pre) { ctx.fillStyle = colorFn === inkFn ? INK : AMBER; ctx.fillText(it.pre, x, bl); } x += it.preW;
        ctx.fillStyle = col; ctx.fillText(it.core, x, bl); x += it.coreW;
        if (it.tail) { ctx.fillText(it.tail, x, bl); } x += it.tailW;
        if (it.post) { ctx.fillStyle = colorFn === inkFn ? INK : AMBER; ctx.fillText(it.post, x, bl); }
      }
    }
  }
  const inkFn = () => INK;

  /** page text (+ karaoke pill), clipped to the plate */
  function drawText(p, t, alpha, dy, clipR, withPill) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    rrect(clipR.x + 1, clipR.y + 1, clipR.w - 2, clipR.h - 2, C.radius); ctx.clip();
    ctx.font = FONT_S(); ctx.letterSpacing = C.ls + 'px'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    drawItems(p, t, dy, it => stateColor(it, t));
    const pl = withPill ? pillAt(p, t) : null;
    if (pl) {
      const r = { x: pl.r.x, y: pl.r.y + dy, w: pl.r.w, h: pl.r.h };
      ctx.save(); ctx.globalAlpha *= pl.a;
      rrect(r.x, r.y, r.w, r.h, Math.min(C.pillR, r.h / 2));
      ctx.shadowColor = 'rgba(243,167,69,.45)'; ctx.shadowBlur = 18; ctx.fillStyle = AMBER; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.clip();
      drawItems(p, t, dy, inkFn);
      ctx.restore();
    }
    ctx.restore();
  }

  registerScene({
    id: 'captions', z: 50,
    when: t => !!pageAt(t),
    draw: (t) => {
      const p = pageAt(t); if (!p) return;
      // plate envelope (only at run edges) + morph between consecutive pages of a run
      const kIn = p.prev ? 1 : eOutCubic(prog(t, p.t0, p.t0 + C.tIn));
      const kOut = p.next ? 1 : 1 - eInCubic(prog(t, p.t1 - C.tOut, p.t1));
      const a = Math.min(kIn, kOut);
      const rise = (1 - kIn) * 22 + (1 - kOut) * 8;
      const km = p.prev ? prog(t, p.t0, p.t0 + (p.prev.kind !== p.kind ? C.tSwap : C.tMorph)) : 1;
      let r = p.prev && km < 1 ? lerpR(p.prev.rect, p.rect, eOutCubic(km)) : { ...p.rect };
      r = { ...r, y: r.y + rise };
      // gentle scale on entry
      if (kIn < 1) { const sc = .965 + .035 * kIn; r = { x: C.cx - r.w * sc / 2, y: r.y + r.h * (1 - sc), w: r.w * sc, h: r.h * sc }; }

      // speaker style: 0 = narrator, 1 = team member; blends when a run changes speaker
      const swap = p.prev && p.prev.kind !== p.kind;
      const ks = swap ? eInOutCubic(prog(t, p.t0, p.t0 + C.tSwap)) : 1;
      const mix = p.kind === 'sp' ? ks : 1 - ks;
      if (mix > 0) {
        const tagIn = p.prev ? 1 : eOutCubic(prog(t, p.t0 + .03, p.t0 + C.tIn + .05));
        const ta = Math.min(tagIn, kOut) * mix;
        if (C.showTag || !TL.in(t, 's4') && !TL.in(t, 's5') && !TL.in(t, 's6')) drawTag(r, ta, (1 - tagIn) * 10 + (1 - mix) * 12);  // speaker chip is drawn by footage_hud
      }
      drawPlate(r, mix, a);
      if (km < 1) {                                  // swap text inside the morphing plate: out, then in (no overlap)
        drawText(p.prev, t, a * (1 - clamp(km / 0.3)), -8 * km, r, false);
        const kt = eOutCubic(prog(km, 0.3, 1));
        drawText(p, t, a * kt, (1 - kt) * 14, r, true);
      } else {
        const kt = p.prev ? 1 : eOutCubic(prog(t, p.t0 + .02, p.t0 + C.tIn + .03));
        drawText(p, t, a * kt, rise + (1 - kt) * 10, r, true);
      }
    },
  });

  // debug hook (read-only): page list for inspection
  window.__capPages = () => pages().map(p => ({ seg: p.seg.id, kind: p.kind, t0: +p.t0.toFixed(2), t1: +p.t1.toFixed(2),
    lines: p.L.lines.map(L => L.items.map(it => it.pre + it.core + it.tail + it.post).join(' ')), w: Math.round(p.L.w), run: !!p.next }));
})();

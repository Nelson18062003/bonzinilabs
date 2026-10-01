'use strict';
// Captions on a torn paper strip, bottom zone (y ≈ 1250–1450). Spoken word gets a violet highlighter swipe.
(() => {
  const FS = 60, F = () => font(FF.body, FS, 800), MAXW = 860, CY = 1340;
  // added by f1: 30 px ink microphone glyph for the team-quote strips (§1.5)
  function capMic(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    rrect(-6, -15, 12, 20, 6); ctx.fill(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -3, 10, .12 * Math.PI, .88 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, 13); ctx.moveTo(-6, 14); ctx.lineTo(6, 14); ctx.stroke(); ctx.restore();
  }
  // added by f1: the end card carries the words — no caption from V11 end to the end (§1.5)
  if (typeof captionHide === 'function') captionHide(t => TLD && t >= TL.seg('V11').end);
  let PAGES = null;
  function paginate() {
    const pages = [];
    const END = /[.?!…:][\s\u00A0]*»?$/;
    // glue lone punctuation tokens (« » : ! ? ;) to their word with a no-break space, so no page is just « » »
    const glue = (ws) => { const out = [];
      ws.forEach(w => { const last = out[out.length - 1];
        if (/^[»:!?;%][,.]?$/.test(w.w) && last) { last.w += (/^[!?;]/.test(w.w) ? '\u202F' : '\u00A0') + w.w; last.e = w.e; }   // f1: U+202F before ! ? ;
        else if (last && last.w === '«') { out[out.length - 1] = { ...w, w: '«\u00A0' + w.w }; }
        else out.push({ ...w }); });
      for (const w of out) w.w = w.w.replace(/'/g, '\u2019');   // added by f1: typographic apostrophe (display only)
      return out; };
    const LIM = MAXW * 1.85, width = ws => measure(ws.map(x => x.w).join(' '), F());
    const PAUSE = w => END.test(w.w) || /,$/.test(w.w);
    // a page never ends on a small linking word (« …une boîte en | fer »)
    const WEAK = /^(le|la|les|un|une|des|de|du|en|à|au|aux|et|ou|dans|sur|par|pour|sans|avec|que|qui|ce|sa|son|ses|votre|vos|notre|nos|leur|se|ne|plus|pas|il|elle|est|c'est)$/i;
    for (const s of TLD.segments) {
      const SW = glue(s.words); let i = 0;
      while (i < SW.length) {
        let j = i, cur = [];
        while (j < SW.length) {
          const w = SW[j], next = SW[j + 1]; cur.push(w); j++;
          if (!next) break;
          const rest = SW.slice(j); const restSentence = rest.findIndex(x => END.test(x.w)) + 1 || rest.length;
          if (END.test(w.w) || (/,$/.test(w.w) && cur.length >= 3 && restSentence >= 3)) break;
          if (width(cur.concat(next)) <= LIM) continue;
          // too long: if the clause ends within a few words, split clause into two balanced pages; else back off weak words
          const tail = []; for (let q = j; q < SW.length; q++) { tail.push(SW[q]); if (PAUSE(SW[q])) break; }
          if (tail.length <= 4) {
            const all = cur.concat(tail); let best = null;
            for (let k = 2; k <= all.length - 2; k++) { const la = width(all.slice(0, k)), lb = width(all.slice(k)); if (la > LIM || lb > LIM) continue;
              const m = Math.max(la, lb) + (WEAK.test(all[k - 1].w) ? 600 : 0); if (!best || m < best.m) best = { m, k }; }
            if (best) { pages.push({ seg: s.id, words: all.slice(0, best.k) }); cur = all.slice(best.k); j = i + all.length; }
          } else while (cur.length > 2 && WEAK.test(cur[cur.length - 1].w)) { cur.pop(); j--; }
          break;
        }
        pages.push({ seg: s.id, words: cur }); i = j;
      }
    }
    // added by f1: pages of the team quotes (Q1–Q6) are wrapped in « … » (narrow no-break spaces) — §1.5
    for (const p of pages) if (/^Q/.test(p.seg)) { p.q = true; const a = p.words[0], b = p.words[p.words.length - 1];
      p.words = p.words.map(w => ({ ...w })); p.words[0].w = '«\u202F' + a.w; p.words[p.words.length - 1].w += '\u202F»'; }
    window.CAP_PAGES = pages;
    // timing: page shows from first word - .12 to next page start (or last word end + .5)
    pages.forEach((p, i) => { p.t0 = p.words[0].s - .12; const nx = pages[i + 1];
      p.t1 = nx && nx.seg === p.seg ? nx.words[0].s - .12 : p.words[p.words.length - 1].e + .45; });
    // layout: 1–2 balanced lines
    for (const p of pages) {
      const ws = p.words.map(w => ({ ...w, wd: measure(w.w, F()) })), sp = measure(' ', F()) + 4;
      const tot = ws.reduce((a, w) => a + w.wd, 0) + sp * (ws.length - 1);
      let lines = [ws];
      if (tot > MAXW) { let best = null; for (let k = 1; k < ws.length; k++) { const a = ws.slice(0, k), b = ws.slice(k);
        const la = a.reduce((s, w) => s + w.wd, 0) + sp * (a.length - 1), lb = b.reduce((s, w) => s + w.wd, 0) + sp * (b.length - 1);
        if (!best || Math.max(la, lb) < best.m) best = { m: Math.max(la, lb), k }; } lines = [ws.slice(0, best.k), ws.slice(best.k)]; }
      const lh = FS * 1.18; p.h = lines.length * lh + 56; p.w = 0; p.items = [];
      lines.forEach((L, li) => { const lw = L.reduce((s, w) => s + w.wd, 0) + sp * (L.length - 1); p.w = Math.max(p.w, lw);
        let x = -lw / 2; for (const w of L) { p.items.push({ ...w, x, y: -p.h / 2 + 28 + FS * .92 + li * lh }); x += w.wd + sp; } });
      p.w += 90;
      if (p.q) { p.w += 56; for (const it of p.items) it.x += 28; }   // added by f1: mic glyph slot
    }
    return pages;
  }
  registerScene({
    id: 'captions', z: 90,
    draw(t, n) {
      if (!PAGES) PAGES = paginate();
      const p = PAGES.find(q => t >= q.t0 && t < q.t1); if (!p) return;
      if (window.CAPTION_HIDE && window.CAPTION_HIDE(t, p)) return;           // scenes may hide captions during big-number beats
      const cy = window.CAPTION_Y ? window.CAPTION_Y(t, p) : CY;
      const a = Math.min(eOutCubic(prog(t, p.t0, p.t0 + .14)), clamp((p.t1 - t) / .12));
      const rot = (rnd(PAGES.indexOf(p) * 3.3) - .5) * .03, rise = (1 - a) * 18;
      ctx.save(); ctx.globalAlpha = a;
      paperNote(W / 2, cy + rise, p.w, p.h, rot, () => {
        const cur = p.items.find(w => t >= w.s && t < w.e + .05);
        if (cur) {                                   // highlighter swipe behind the spoken word
          const k = eOutCubic(prog(t, cur.s, cur.s + .12)), j = jit(p.items.indexOf(cur) + 70, n, .6);
          ctx.save(); ctx.fillStyle = 'rgba(169,71,254,.30)'; ctx.beginPath();
          const x0 = cur.x - 8, y0 = cur.y - FS * .78 + j.y, w = (cur.wd + 16) * k, h = FS * .92;
          ctx.moveTo(x0, y0 + 4); ctx.lineTo(x0 + w, y0); ctx.lineTo(x0 + w - 3, y0 + h); ctx.lineTo(x0 + 2, y0 + h + 3); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        for (const w of p.items) {
          const spoken = t >= w.s;
          text(w.w, w.x, w.y, { font: F(), color: spoken ? C.ink : 'rgba(35,22,41,.45)' });
        }
        if (p.q) capMic(-p.w / 2 + 40, 0);   // added by f1: « the real team speaking »
      }, { seed: PAGES.indexOf(p) * 5, h: 8, fill: p.q ? '#E6C79C' : undefined });
      ctx.restore();
    },
  });
})();

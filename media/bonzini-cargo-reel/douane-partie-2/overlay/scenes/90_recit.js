'use strict';
// BD récitatif: the narrator's words in a yellow comic caption box (ink border), bottom zone (y ≈ 1250–1450).
// The spoken word is inked dark, the others stay soft; a small orange brush underline follows the voice.
(() => {
  const FS = 56, F = () => font(FF.let, FS, 700), MAXW = 860, CY = 1345;
  let PAGES = null;
  function paginate() {
    const pages = [];
    const END = /[.?!…:][\s\u00A0]*»?$/;
    // glue lone punctuation tokens (« » : ! ? ;) to their word with a no-break space, so no page is just « » »
    const glue = (ws) => { const out = [];
      ws.forEach(w => { const last = out[out.length - 1];
        if (/^[»:!?;%][,.]?$/.test(w.w) && last) { last.w += '\u00A0' + w.w; last.e = w.e; }
        else if (last && last.w === '«') { out[out.length - 1] = { ...w, w: '«\u00A0' + w.w }; }
        else out.push({ ...w }); });
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
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, cy + rise); ctx.rotate(rot);
      const bw = p.w, bh = p.h, seed = PAGES.indexOf(p) * 5 + 1;
      withShadow(12, () => { ctx.fillStyle = BD.recit; ctx.fillRect(-bw / 2, -bh / 2, bw, bh); });
      inkRect(-bw / 2, -bh / 2, bw, bh, { w: 4.5, seed });
      const cur = p.items.find(w => t >= w.s && t < w.e + .05);
      for (const w of p.items) {
        const spoken = t >= w.s;
        text(w.w, w.x, w.y, { font: F(), color: spoken ? BD.ink : 'rgba(30,21,18,.42)' });
      }
      if (cur) { const k = eOutCubic(prog(t, cur.s, cur.s + .14)); ctx.save(); ctx.globalAlpha *= .85;
        inkLine(cur.x - 4, cur.y + 12, cur.x - 4 + (cur.wd + 8) * k, cur.y + 10, { w: 6, color: BD.orange, seed: seed + 3, wob: 2 }); ctx.restore(); }
      ctx.restore();
    },
  });
})();

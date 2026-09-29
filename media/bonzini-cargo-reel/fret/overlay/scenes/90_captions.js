'use strict';
// Captions on a torn paper strip, bottom zone (y ≈ 1250–1450). Spoken word gets a violet highlighter swipe.
(() => {
  const FS = 60, F = () => font(FF.body, FS, 800), MAXW = 860, CY = 1340;
  let PAGES = null;
  function paginate() {
    const pages = [];
    for (const s of TLD.segments) {
      let cur = [];
      const flush = () => { if (cur.length) { pages.push({ seg: s.id, words: cur }); cur = []; } };
      s.words.forEach((w, i) => {
        cur.push(w);
        const txt = cur.map(x => x.w).join(' ');
        const endPunct = /[.?!…:]$/.test(w.w), comma = /,$/.test(w.w);
        const next = s.words[i + 1];
        if (!next) return flush();
        const tooLong = measure(txt + ' ' + next.w, F()) > MAXW * 1.85;
        const rest = s.words.slice(i + 1); const restSentence = rest.findIndex(x => /[.?!…:]$/.test(x.w)) + 1 || rest.length;
        if (endPunct || tooLong || (comma && cur.length >= 3 && restSentence >= 3)) flush();
      });
      flush();
    }
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
      if (p.seg === 'S10' && /transparence/.test(p.words.map(w => w.w).join(' ')) && t >= TL.wt('S10', 'transparence')) return;
      const a = Math.min(eOutCubic(prog(t, p.t0, p.t0 + .14)), clamp((p.t1 - t) / .12));
      const rot = (rnd(PAGES.indexOf(p) * 3.3) - .5) * .03, rise = (1 - a) * 18;
      ctx.save(); ctx.globalAlpha = a;
      paperNote(W / 2, CY + rise, p.w, p.h, rot, () => {
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
      }, { seed: PAGES.indexOf(p) * 5, h: 8 });
      ctx.restore();
    },
  });
})();

'use strict';
// World ground: seamless cream paper in WORLD coordinates (it scrolls with the camera, so every camera move is felt),
// large soft mottling, and world-fixed desk clutter declared by the layout (groundProps). z 1, under everything.
(() => {
  let PAT = null;
  function makePattern() {
    const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d');
    g.fillStyle = C.table; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {                          // mottles, wrapped so the tile is seamless
      const x = rnd(i * 9.1 + 3) * S, y = rnd(i * 7.7 + 5) * S, r = 60 + rnd(i * 6.3) * 180, light = rnd(i * 2.2) > .45;
      for (const [ox, oy] of [[0, 0], [-S, 0], [S, 0], [0, -S], [0, S], [-S, -S], [S, S], [-S, S], [S, -S]]) {
        const rg = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); const col = light ? '255,252,244' : '226,204,168';
        rg.addColorStop(0, `rgba(${col},${light ? .16 : .07})`); rg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = rg; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r); } }
    for (let i = 0; i < 2600; i++) {                        // fibres
      const x = rnd(i * 1.1 + 11) * S, y = rnd(i * 2.3 + 13) * S, a = rnd(i * 3.7) * Math.PI, l = 4 + rnd(i * 4.1) * 14;
      g.strokeStyle = rnd(i * 5.9) > .5 ? 'rgba(150,115,75,.08)' : 'rgba(255,255,255,.42)'; g.lineWidth = .8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    return ctx.createPattern(c, 'repeat');
  }
  registerScene({
    id: 'ground', z: 1,
    draw(t, n) {
      if (!PAT) PAT = makePattern();
      ctx.save(); const c = worldBegin(t), hw = W / 2 / c.z * 1.5 + 200, hh = H / 2 / c.z * 1.5 + 200;
      ctx.fillStyle = PAT; ctx.fillRect(c.x - hw, c.y - hh, 2 * hw, 2 * hh);
      if (window.groundProps) window.groundProps(t, n, c);  // world-fixed clutter from the layout
      ctx.restore();
      // screen-space vignette (lamp over the table)
      const vg = ctx.createRadialGradient(W / 2, H * .45, H * .38, W / 2, H * .5, H * .95);
      vg.addColorStop(0, 'rgba(120,80,40,0)'); vg.addColorStop(1, 'rgba(120,80,40,.13)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    },
  });
})();

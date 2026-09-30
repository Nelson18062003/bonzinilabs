'use strict';
// The diorama board (the stage floor along the whole road), the violet thread, and the persistent actors.
// z 18: board + thread (under station props) · z 32: actors (between station back layers z 20–28 and front layers z 34–38)
(() => {
  const X0 = X.sea - 400, X1 = X.mboppi + 1100;
  function board() {
    // floor: kraft board seen slightly from above; front edge with a paper lip and shadow on the table
    const y0 = GROUND - 40, y1 = GROUND + 150;
    withShadow(18, () => { ctx.fillStyle = TEX.kraft; ctx.fillRect(X0, y0, X1 - X0, y1 - y0); });
    ctx.fillStyle = 'rgba(255,240,210,.22)'; ctx.fillRect(X0, y0, X1 - X0, 8);
    ctx.fillStyle = C.kraftD; ctx.fillRect(X0, y1 - 26, X1 - X0, 26);
    ctx.strokeStyle = 'rgba(90,60,30,.25)'; ctx.lineWidth = 3; ctx.setLineDash([26, 18]);
    ctx.beginPath(); ctx.moveTo(X0, GROUND + 48); ctx.lineTo(X1, GROUND + 48); ctx.stroke(); ctx.setLineDash([]);
  }
  registerScene({ id: 'stage', z: 18, draw(t, n) { ctx.save(); worldBegin(t); board(); drawRoute(t, n); ctx.restore(); } });
  registerScene({ id: 'actors', z: 32, draw(t, n) {
    ctx.save(); worldBegin(t);
    for (const name of ['mireille', 'junior']) { const st = actorAt(name, t); if (st && inView(st.x, st.y, 400, t)) drawActor(name, t, n); }
    ctx.restore();
  } });
})();

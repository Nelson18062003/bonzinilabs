const S = require('../overlay/scenes/01_score.js');
// continuity: max per-frame jump of hands/containers (px) — catches teleports
let worst = { L: [0, 0], R: [0, 0], C: [0, 0] };
for (let f = 0; f < 480; f++) {
  for (const s of ['L', 'R']) { const a = S.hand(s, f), b = S.hand(s, f + 1); const d = Math.hypot(b.x - a.x, b.y - a.y); if (d > worst[s][0]) worst[s] = [d, f]; }
  const A = S.containers(f), B = S.containers(f + 1);
  for (let i = 0; i < 3; i++) { const d = Math.hypot(B[i].x - A[i].x, B[i].y - A[i].y, B[i].z - A[i].z); if (d > worst.C[0]) worst.C = [d, f]; }
}
console.log('max jump per frame', JSON.stringify(worst));
for (const f of [0, 104, 165, 205, 219, 240, 300, 479]) console.log(f, 'slots', JSON.stringify(S.shuffleState(f).slot), 'R', JSON.stringify(S.hand('R', f)), 'parcel', S.parcel(f).mode);
// seam: state(479)->state(480)=state(0)
console.log('seam hands', JSON.stringify(S.hand('R', 479.99)), JSON.stringify(S.hand('R', 0)));

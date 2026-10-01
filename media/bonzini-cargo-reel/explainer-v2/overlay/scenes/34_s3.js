'use strict';
// =============================================================================================
// 34_s3 — S3 · 03 LE TRANSPORT — package C (prefix s3_) — final_storyboard §3 S3, §2.3 T4 (C's side) + T5, §2.4, §2.5, §6.
// V05 « Étape trois : le transport. Le conteneur traverse l’océan par bateau, de la Chine jusqu’en Afrique. Puis il
// continue sa route par camion, jusqu’à notre entrepôt. »  One idea: by sea from China to Africa, then by road to our warehouse.
//   s3_back  (z 20): T4 torn-paper sea rising, the paper cargo boat (our teal container on deck), sky props; the pull-back
//                    onto the paper map (land, China, dotted route), the boat token sailing with the violet thread behind
//                    it, the truck token, the map tearing in two over the blank hero print P4, the paper truck parking.
//   s3_front (z 50): our container flipping top → side view and dropping on the deck (T4), the CHINE / AFRIQUE strips and
//                    the push-pin (they ride the torn halves), the note tag « Notre entrepôt ».
//   Lead thread: hp_anchor('s3') = the « VOTRE COLIS » mini label of our container wherever it is (lid → deck → token →
//   truck token → paper truck). The hero stays hidden (s2 hid it under the lid).
// Shared with 40_s4.js (T5 continuous): s3_T(), s3_p4Rect(t), s3_p4Develop(t), s3_truckRest(t), S3_TRUCK, S3_P4FR.
// Every time is anchored on V05 / V06 words or the chapter boundaries; [s] in comments = current timeline (checks only).
// =============================================================================================
const S3_TRUCK = { x: 520, y: 1000, s: 1.45 };          // paper truck parked on P4 (box ≈ x 143–665, y 565–928)
const S3_P4FR = { fy: .40 };                            // P4 = B 6.0 still framing (real container ≈ print y 340–1036)
let s3_cacheT = null, s3_cacheTL = null;
/** all s3 anchors (lazy, cached per timeline) */
function s3_T() {
  if (s3_cacheT && s3_cacheTL === TLD) return s3_cacheT;
  const V = w => W_('V05', w), T = { s0: TL.ch('s3').start, s1: TL.ch('s3').end };
  T.tb = T.s0;                                          // T4 boundary [33.5]
  T.wave0 = T.tb - .4;                                  // the sea rises [33.1 → 33.7]
  T.boat0 = T.tb - .2; T.boat1 = T.tb + .4;             // boat slides in from the right [33.3 → 33.9]
  T.hand = T.tb + .1;                                   // B's last container pose (540, 760) s .3 lift 60 [33.6]
  T.flip1 = T.hand + .2;                                // top → side view, 3 poses on twos [33.6 → 33.8]
  T.land = T.boat1;                                     // container lands on the deck [33.9]
  T.etape = V('Étape'); T.tagOut = hp_after(T.etape, V('conteneur'));   // chapter tag 03 [35.10 → 37.20]
  T.pb0 = T.tagOut; T.pb1 = T.pb0 + .7;                 // pull-back onto the map [37.20 → 37.90]
  T.map0 = T.pb0 + .02; T.map1 = T.pb0 + .62;           // the map slides in beneath
  T.chine = Math.max(V('traverse'), T.map1 - .05);      // CHINE strip slaps on the map [37.57]
  T.sail0 = V('bateau'); T.afr = V('Afrique'); T.sail1 = T.afr + .3;    // boat token sails [38.10 → 39.78]
  T.afrStrip = T.afr + .1;                              // AFRIQUE strip [39.58]
  T.puis = V('Puis');                                   // truck token pops at the pin [40.02]
  T.hop0 = T.puis + .12; T.hop1 = T.hop0 + .3;          // container hops boat → truck token (3 poses) [40.14 → 40.44]
  T.route = V('route'); T.drive1 = T.route + .5;        // token drives the dashed line inland [41.12 → 41.62]
  T.tear0 = hp_after(T.afr, T.route + .26); T.tear1 = T.tear0 + .45;    // the map tears in two [41.58 → 42.03]
  T.truckIn = Math.max(V('camion'), T.tear1);           // paper truck drives in [42.03]
  T.truckStop = Math.max(V('notre'), T.truckIn + .6);   // … and parks [42.63]
  T.note = T.truckStop + .15;                           // « Notre entrepôt » pinned at NOTE [42.78]
  T.noteOut = W_('V06', 'Étape');                       // unpinned by s4 when tag 04 arrives [45.90]
  T.tick = T.s1 - .6;                                   // slot 3 check [43.9]
  T.exh0 = T.truckStop + .45; T.exh1 = W_('V06', 'arrivée') - .1;      // idle exhaust puffs, every 0.8 s [43.08 → 46.96]
  hp_hold('s3 CHINE', T.chine, T.tear0); hp_hold('s3 AFRIQUE', T.afrStrip, T.tear0); hp_hold('s3 note', T.note, T.noteOut);
  s3_cacheTL = TLD; return (s3_cacheT = T);
}
/** P4 (the blank hero print the map tears off) — current rect with its drift */
function s3_p4Rect(t) { const d = drift(t, 41, 3); return { x: HP_PRINT.x + d.x, y: HP_PRINT.y + d.y, w: HP_PRINT.w, h: HP_PRINT.h, rot: HP_PRINT.rot + d.r }; }
const S3_DEV = .45;                                     // P4 develop reached under the parked truck before V06·Étape
/** P4 slow develop 0 → .45 under the parked truck (s3 3.11): half linear, half smoothstep, so it keeps moving to the end */
function s3_p4Develop(t) { const T = s3_T(), k = prog(t, T.truckStop, T.noteOut); return S3_DEV * (.55 * k + .45 * k * k * (3 - 2 * k)); }
/** the parked paper truck's pose: idle engine shake on twos (the cut-out shivers ±1.5 px; hp_paperTruck bobs the body 2 px) */
function s3_truckRest(t) {
  const n2 = Math.floor(Math.round(t * 30) / 2), jy = [1.3, -1, .5, -1.5, .9, -.4][n2 % 6], jx = [.7, -.9, .3, 1, -.6, -.2][(n2 + 2) % 6];
  return { x: S3_TRUCK.x + jx, y: S3_TRUCK.y + jy, s: S3_TRUCK.s, r: 0, wheel: 0, bob: true };
}
/** idle exhaust: a small kraft puff leaves the stack behind the cab every 0.8 s (cut-paper discs, on twos).
 *  P = truck pose; puffs are emitted in [e0, e1); a = extra alpha. Used by s3 (parked) and s4 (until the truck lifts). */
const S3_STACK = [107, -270];                           // exhaust stack top, truck-local (the pipe rises behind the cab)
/** the exhaust stack behind the cab (truck-local; draw right after hp_paperTruck, same transform; bob = the body's bob flag) */
function s3_stack(t, bob) {
  const dy = bob ? (Math.floor(t * 15) % 2 ? -2 : 0) : 0;
  ctx.save(); ctx.translate(0, dy);
  withShadow(2, () => { ctx.fillStyle = '#2B2230'; rrect(102, -264, 11, 44, 3); ctx.fill(); });
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(104.5, -260, 2, 36);
  ctx.fillStyle = '#3A3040'; at(S3_STACK[0], -266, -.12, 1, 1, () => { rrect(-8.5, -3, 17, 6, 2); ctx.fill(); });
  ctx.restore();
}
function s3_exhaust(t, P, e0, e1, a = 1) {
  const ts = f1_twos(t), c = Math.cos(P.r || 0), sn = Math.sin(P.r || 0), lx = S3_STACK[0] * P.s, ly = S3_STACK[1] * P.s;
  const sx = P.x + lx * c - ly * sn, sy = P.y + lx * sn + ly * c - 4;
  if (a <= 0 || ts < e0) return;
  ctx.save();
  for (let i = 0; ; i++) {
    const t0 = e0 + i * .8; if (t0 >= e1 || t0 > ts) break;
    const u = ts - t0; if (u > .93) continue;
    const k = u / .93, g = Math.sqrt(k), al = a * (1 - k * k * k);
    for (let j = 0; j < 3; j++) {
      const r = (8 + 21 * g) * [1, .74, .58][j], ox = [0, 15, -12][j] * (.5 + g) - 38 * k - 6 * Math.sin(i * 1.7 + k * 3), oy = [0, -7, -12][j] * (.5 + g) - 118 * k;
      at(sx + ox, sy + oy, 0, 1, 1, () => {
        ctx.globalAlpha = al;
        withShadow(3, () => { ctx.fillStyle = '#BE9D6E'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); });
        ctx.globalAlpha = al * .9; ctx.fillStyle = '#E8D6B6'; ctx.beginPath(); ctx.arc(-r * .26, -r * .28, r * .52, 0, 7); ctx.fill();
      });
    }
  }
  ctx.restore();
}
/** the « Notre entrepôt » note tag's resting pose (≤ 2 px paper drift so it never sits dead still; s4 unpins it from here) */
function s3_notePose(t) { const d = drift(t, 52, 2); return { x: NOTE.x + d.x, y: NOTE.y + d.y, r: .015 + d.r * .6 }; }
/** screen point of the mini label's top on the paper truck at pose P (lead-thread knot) */
function s3_truckKnot(P) { const lx = -80, ly = -175 - 140 * .7 + 8, c = Math.cos(P.r), s = Math.sin(P.r); return [P.x + (lx * c - ly * s) * P.s, P.y + (lx * s + ly * c) * P.s]; }

(() => {
  const BOAT = { x: 560, y: 1060, s: 2.2 };              // boat stage at rest (sail top ≈ 686, hull ≈ 1038–1214)
  const OURS = { x: 21, y: -32, s: .34 };                // our side-view container on the deck (boat-local)
  const TOK_S = .52;                                     // boat token scale on the map
  const TRK_S = .3;                                      // truck token scale
  const MAP = { x0: 40, x1: 1040, y0: 330, y1: 1180, PX: 7.2, LON0: -19, MTOP: 54, cx: 540, cy: 755, rot: -.01 };
  const mX = lon => MAP.x0 + (lon - MAP.LON0) * MAP.PX;                 // lon (°) → map x
  const mY = yd => MAP.y0 + (yd + MAP.MTOP) * MAP.PX;                   // −mercator (°) → map y
  const merc = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
  const geo = (lon, lat) => [mX(lon), mY(-merc(lat))];
  const tw = t => f1_twos(t);

  // ---------------------------------------------------------------- the route (map space, resampled)
  let _route = null;
  function s3_route() {
    if (_route) return _route;
    const R = window.BZ_MAP.route, raw = [];
    for (let i = 0; i < R.length; i += 2) raw.push([mX(R[i] / 100), mY(R[i + 1] / 100)]);
    const d = window.BZ_MAP.pts.dest; raw.push([mX(d[0] / 10), mY(d[1] / 10)]);
    const pts = [raw[0]]; let acc = 0;                    // resample every ~6 px (smooth thread, arc-length lookups)
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
      for (let u = 6 - acc; u < L; u += 6) pts.push([lerp(a[0], b[0], u / L), lerp(a[1], b[1], u / L)]);
      acc = (acc + L) % 6;
    }
    pts.push(raw[raw.length - 1]);
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return (_route = { pts, len, tot: len[len.length - 1], pin: raw[raw.length - 1] });
  }
  /** point at arc length d along the route */
  function s3_routeAt(d) {
    const R = s3_route(); d = clamp(d, 0, R.tot);
    let lo = 0, hi = R.len.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R.len[m] <= d) lo = m; else hi = m; }
    const f = (d - R.len[lo]) / Math.max(1e-6, R.len[hi] - R.len[lo]);
    return [lerp(R.pts[lo][0], R.pts[hi][0], f), lerp(R.pts[lo][1], R.pts[hi][1], f)];
  }
  const DOCK = 175;                                       // the boat token stops this far before the pin (offshore)

  // ---------------------------------------------------------------- the paper map (cached art)
  let _map = null;
  const MOY = 270;                                       // cache canvas origin y (map space → cache: y − MOY)
  function s3_sheetPoly() {
    const P = [], add = a => { for (const p of a) P.push(p); };
    add(tornLine(MAP.x0, MAP.y0, MAP.x1, MAP.y0 + 2, 301, 3.5, 13)); add(tornLine(MAP.x1, MAP.y0 + 2, MAP.x1 - 2, MAP.y1, 307, 3.5, 13));
    add(tornLine(MAP.x1 - 2, MAP.y1, MAP.x0 + 2, MAP.y1 - 1, 311, 3.5, 13)); add(tornLine(MAP.x0 + 2, MAP.y1 - 1, MAP.x0, MAP.y0, 317, 3.5, 13));
    return P;
  }
  function s3_buildMap() {
    if (_map) return _map;
    const c = makeCanvas(1080, 980), prev = ctx, M = window.BZ_MAP, sheet = s3_sheetPoly();
    const sheetPath = () => f2_poly(sheet);
    try {
      ctx = c.getContext('2d'); ctx.translate(0, -MOY);
      // blue paper sheet
      ctx.fillStyle = '#9CC3E6'; sheetPath(); ctx.fill();
      ctx.save(); sheetPath(); ctx.clip();
      let g = ctx.createLinearGradient(MAP.x0, MAP.y0, MAP.x1, MAP.y1); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(20,60,110,.10)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1300);
      f2_fibres(sheetPath, .5);
      // graticule (no labels)
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.42)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 7]);
      for (let lon = -20; lon <= 140; lon += 20) { const x = mX(lon); ctx.beginPath(); ctx.moveTo(x, MAP.y0); ctx.lineTo(x, MAP.y1); ctx.stroke(); }
      for (const lat of [-40, -20, 0, 20, 40]) { const y = geo(0, lat)[1]; ctx.lineWidth = lat === 0 ? 2.2 : 1.6; ctx.beginPath(); ctx.moveTo(MAP.x0, y); ctx.lineTo(MAP.x1, y); ctx.stroke(); }
      ctx.restore();
      // land (cut kraftL paper pasted on the sheet, cream cut margin)
      const land = new Path2D();
      for (const r of M.land) { land.moveTo(mX(r[0] / 10), mY(r[1] / 10)); for (let i = 2; i < r.length; i += 2) land.lineTo(mX(r[i] / 10), mY(r[i + 1] / 10)); land.closePath(); }
      // ocean ticks (little paper-map wave marks, only on water)
      ctx.save(); ctx.strokeStyle = 'rgba(20,60,110,.22)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 260; i++) {
        const x = MAP.x0 + 30 + rnd(i * 4.17 + 3) * (MAP.x1 - MAP.x0 - 60), y = MAP.y0 + 30 + rnd(i * 7.31 + 1) * (MAP.y1 - MAP.y0 - 60);
        if ([[0, 0], [-22, -10], [22, 10], [22, -10], [-22, 10]].some(([dx, dy]) => ctx.isPointInPath(land, x + dx, y + dy))) continue;
        ctx.beginPath(); for (let k = 0; k < 2; k++) { const xx = x + k * 11; ctx.moveTo(xx - 5, y); ctx.quadraticCurveTo(xx - 2.5, y - 4, xx, y); ctx.quadraticCurveTo(xx + 2.5, y + 4, xx + 5, y); } ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(20,50,90,.35)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
      ctx.strokeStyle = '#F8F1E3'; ctx.lineWidth = 7; ctx.stroke(land); ctx.restore();
      ctx.fillStyle = '#EED6B0'; ctx.fill(land);
      ctx.save(); ctx.clip(land); f2_fibres(() => { ctx.beginPath(); ctx.rect(0, 0, 1080, 1300); }, .75); ctx.restore();
      ctx.save(); ctx.clip(land); g = ctx.createLinearGradient(0, MAP.y0, 0, MAP.y1); g.addColorStop(0, 'rgba(255,245,225,.20)'); g.addColorStop(1, 'rgba(120,80,40,.10)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1300); ctx.restore();
      ctx.strokeStyle = 'rgba(156,116,71,.6)'; ctx.lineWidth = 1.4; ctx.stroke(land);
      // China: kraft + violetD outline (as in s1)
      const cn = new Path2D();
      for (const r of M.china) { cn.moveTo(mX(r[0] / 10), mY(r[1] / 10)); for (let i = 2; i < r.length; i += 2) cn.lineTo(mX(r[i] / 10), mY(r[i + 1] / 10)); cn.closePath(); }
      ctx.fillStyle = TEX.kraft || C.kraft; ctx.fill(cn); ctx.save(); ctx.clip(cn); ctx.fillStyle = 'rgba(120,80,40,.12)'; ctx.fillRect(600, 250, 500, 400); ctx.restore();
      ctx.save(); ctx.clip(cn); g = ctx.createLinearGradient(1000, 330, 760, 600); g.addColorStop(0, 'rgba(255,240,215,.22)'); g.addColorStop(1, 'rgba(90,55,20,.16)'); ctx.fillStyle = g; ctx.fillRect(600, 250, 500, 400); ctx.restore();
      ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = C.violetD; ctx.lineWidth = 4.5; ctx.stroke(cn); ctx.restore();
      // the planned sea route: ink dots
      const R = s3_route(); ctx.fillStyle = 'rgba(74,58,82,.62)';
      for (let d = 8; d < R.tot - 4; d += 15) { const [x, y] = s3_routeAt(d); ctx.beginPath(); ctx.arc(x, y, 2.7, 0, 7); ctx.fill(); }
      // compass rose (no letters) in the South Atlantic
      s3_compass(140, 1090, 40);
      // fold creases (the map was folded in four)
      ctx.lineWidth = 2; for (const [a, b, d] of [[[540, MAP.y0], [541, MAP.y1], 1], [[MAP.x0, 756], [MAP.x1, 752], 0]]) {
        ctx.strokeStyle = 'rgba(255,255,255,.30)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.strokeStyle = 'rgba(20,50,90,.12)'; ctx.beginPath(); ctx.moveTo(a[0] + d * 2, a[1] + (1 - d) * 2); ctx.lineTo(b[0] + d * 2, b[1] + (1 - d) * 2); ctx.stroke(); }
      ctx.restore();
      f2_edge(sheetPath, .45, 2);
      // two amber tape pieces at the top corners
      ctx.fillStyle = C.tape; at(MAP.x0 + 34, MAP.y0 + 4, -.62, 1, 1, () => ctx.fillRect(-56, -18, 112, 36)); at(MAP.x1 - 34, MAP.y0 + 4, .62, 1, 1, () => ctx.fillRect(-56, -18, 112, 36));
    } finally { ctx = prev; }
    return (_map = { canvas: c, sheet });
  }
  function s3_compass(x, y, r) {
    at(x, y, -.12, 1, 1, () => {
      ctx.fillStyle = 'rgba(251,246,236,.55)'; ctx.beginPath(); ctx.arc(0, 0, r * 1.12, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(74,58,82,.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, 7); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, L = i % 2 ? r * .55 : r, w = i % 2 ? 6 : 9;
        ctx.save(); ctx.rotate(a);
        ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(w, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = i === 0 ? C.violetD : C.inkSoft; ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(-w, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.restore(); }
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fill();
    });
  }

  // ---------------------------------------------------------------- map pose (slide in, rest drift, torn halves)
  /** transform of the map (or of one half: 'L' | 'R' during the tear) → {dx, dy, r, cx, cy, lift} */
  function s3_mapXf(t, half) {
    const T = s3_T(), ts = tw(t), k = eOutCubic(prog(t, T.map0, T.map1)), d = drift(t, 33, 2.4);
    let dx = lerp(-1150, 0, k) + d.x, dy = lerp(160, 0, k) + d.y, r = lerp(-.16, MAP.rot, k < 1 ? eOutBack(k, 1.3) : 1) + d.r, lift = lerp(40, 8, k), cx = MAP.cx, cy = MAP.cy;
    if (half && t >= T.tear0) {
      const u = prog(ts, T.tear0, T.tear1), rip = eOutCubic(clamp(u / .25)), e = u * u;
      const sg = half === 'L' ? -1 : 1;
      dx += sg * (14 * rip + (half === 'L' ? 900 : 760) * e); dy += -18 * rip - 40 * e; r += sg * (.025 * rip + .08 * e); lift += 30 * rip;
      cx = half === 'L' ? (MAP.x0 + 600) / 2 : (600 + MAP.x1) / 2;
    }
    return { dx, dy, r, cx, cy, lift };
  }
  function s3_applyXf(X) { ctx.translate(X.cx + X.dx, X.cy + X.dy); ctx.rotate(X.r); ctx.translate(-X.cx, -X.cy); }
  function s3_mapPt(X, x, y) { const c = Math.cos(X.r), s = Math.sin(X.r), ux = x - X.cx, uy = y - X.cy; return [X.cx + X.dx + ux * c - uy * s, X.cy + X.dy + ux * s + uy * c]; }
  let _tear = null;
  function s3_tearLine() {
    if (_tear) return _tear;
    const pts = [];                                       // Africa (pin, tokens, AFRIQUE) stays on the left half, Asia (CHINE) on the right
    for (let y = 250, i = 0; y <= 1260; y += 18, i++) pts.push([lerp(612, 590, (y - 250) / 1010) + (rnd(i * 3.7 + 51) - .5) * 18, y]);
    return (_tear = pts);
  }
  function s3_halfPoly(half) {
    const L = s3_tearLine();
    return half === 'L' ? [[-200, 250], ...L, [-200, 1260]] : [...L, [1300, 1260], [1300, 250]];
  }

  // ---------------------------------------------------------------- boat, sea, sky (paper cut-outs)
  /** small cargo block (side view) */
  function s3_block(x0, y0, w, h, col, rib) {
    ctx.fillStyle = col; rrect(x0, y0, w, h, 1.5); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.fillStyle = rib; for (let x = x0 + 3; x < x0 + w - 2; x += 5) ctx.fillRect(x, y0 + 3, 1.6, h - 5);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x0, y0, w, 2); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x0, y0 + h - 3, w, 3);
    ctx.restore();
  }
  /** the folded-paper cargo boat (fret-episode silhouette), local units, origin = deck centre. o {ours (draw our container),
   *  oursSq [sx, sy] landing squash} */
  function s3_boat(o = {}) {
    const hull = [[-150, -10], [150, -10], [100, 70], [-100, 70]], hullP = () => f2_poly(hull);
    // sail + mast (behind the cargo)
    const sail = () => f2_poly([[-8, -22], [-8, -172], [92, -22]]);
    withShadow(3, () => { ctx.fillStyle = '#FFFFFF'; sail(); ctx.fill(); });
    f2_fibres(sail, .35);
    ctx.fillStyle = 'rgba(123,34,214,.06)'; f2_poly([[-8, -22], [-8, -172], [30, -22]]); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.14)'; ctx.lineWidth = 1; sail(); ctx.stroke();
    ctx.strokeStyle = '#4A3A52'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(-10, -182); ctx.stroke();
    ctx.fillStyle = C.amber; f2_poly([[-9, -182], [16, -175], [-9, -168]]); ctx.fill();
    // deck cargo (warm colours; ours is the only teal one)
    s3_block(-128, -52, 44, 42, C.amber, 'rgba(150,90,10,.35)');
    s3_block(-82, -52, 44, 42, C.kraftD, 'rgba(60,35,10,.35)');
    s3_block(-122, -92, 44, 40, '#E9DCC4', 'rgba(120,90,50,.30)');
    s3_block(78, -52, 44, 42, C.kraft, 'rgba(90,60,20,.35)');
    if (o.ours) { const q = o.oursSq || [1, 1]; at(OURS.x, -10, 0, OURS.s * q[0], OURS.s * q[1], () => at(0, -64, 0, 1, 1, () => hp_paperContainer('side', { label: true, lift: 3 }))); }
    // hull
    withShadow(o.lift ?? 5, () => { ctx.fillStyle = C.cream; hullP(); ctx.fill(); });
    f2_fibres(hullP, .45);
    ctx.save(); hullP(); ctx.clip();
    ctx.fillStyle = C.sea; ctx.fillRect(-160, 20, 320, 20); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(-160, 20, 320, 2.5);
    ctx.fillStyle = 'rgba(35,22,41,.09)'; f2_poly([[-150, -10], [-100, 70], [-62, -10]]); ctx.fill();
    ctx.fillStyle = 'rgba(35,22,41,.13)'; f2_poly([[150, -10], [100, 70], [62, -10]]); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.16)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-62, -10); ctx.lineTo(-100, 70); ctx.moveTo(62, -10); ctx.lineTo(100, 70); ctx.stroke();
    ctx.fillStyle = '#2B2230'; for (const x of [-42, -14, 14, 42]) { ctx.beginPath(); ctx.arc(x, 6, 4.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.5)'; for (const x of [-42, -14, 14, 42]) { ctx.beginPath(); ctx.arc(x - 1.2, 4.8, 1.3, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,250,240,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-148, -9); ctx.lineTo(148, -9); ctx.stroke();
    ctx.strokeStyle = 'rgba(35,22,41,.16)'; ctx.lineWidth = 1.2; hullP(); ctx.stroke();
  }
  /** boat-local point of our container's mini label top */
  const OURS_KNOT = [OURS.x + (150 - 80) * OURS.s, -10 - 64 * OURS.s + (2 - 140 * .3 + 4) * OURS.s];
  /** one torn-paper wave layer (i = 0 back … 3 front) with its top edge at y */
  function s3_wave(i, y, ts) {
    const cols = ['#9CC3E6', '#6FA9DC', '#3F86C8', '#2C74B8', '#2167AA', '#185C9E'], amp = [11, 13, 15, 16, 18, 20][i], k = .0108 - i * .0009, ph = ts * (1.1 + i * .32) + i * 1.9;
    const Y = x => y + Math.sin(x * k + ph) * amp + Math.sin(x * k * 2.3 - ph * 1.4 + i) * amp * .33 + (rnd(Math.round(x / 16) * 1.7 + i * 31) - .5) * 4;
    const P = []; for (let x = -40; x <= 1120; x += 16) P.push([x, Y(x)]);
    const path = () => { ctx.beginPath(); ctx.moveTo(-40, y + 1100); for (const p of P) ctx.lineTo(p[0], p[1]); ctx.lineTo(1120, y + 1100); ctx.closePath(); };
    withShadow(5, () => { ctx.fillStyle = cols[i]; path(); ctx.fill(); });
    f2_fibres(path, .4);
    ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.62)'; ctx.lineWidth = 3; ctx.beginPath(); P.forEach((p, j) => j ? ctx.lineTo(p[0], p[1] + 2) : ctx.moveTo(p[0], p[1] + 2)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.setLineDash([16, 12]); ctx.beginPath(); P.forEach((p, j) => j ? ctx.lineTo(p[0], p[1] + 14) : ctx.moveTo(p[0], p[1] + 14)); ctx.stroke();
    ctx.restore();
  }
  const WAVE_Y = [1078, 1132, 1188, 1262, 1420, 1610];   // layer tops; the boat sits between layers 1 and 2
  function s3_waveDy(i, t, T) {
    const ts = tw(t), a = T.wave0 + i * .05, rise = 1 - eOutBack(clamp((ts - a) / .4), 1.2);
    return 1000 * rise + 1100 * eInCubic(prog(t, T.pb0, T.pb0 + .4));
  }
  function s3_cloud(x, y, s, seed) {
    at(x, y, 0, s, s, () => {
      const path = () => { ctx.beginPath(); ctx.moveTo(-110, 30); ctx.lineTo(110, 30); ctx.arc(80, 4, 34, Math.PI * .5, Math.PI * 1.45, true);
        ctx.arc(28, -16, 46, -.2, Math.PI * 1.15, true); ctx.arc(-40, -2, 40, -.3, Math.PI * 1.1, true); ctx.arc(-86, 10, 26, -.4, Math.PI * .5, true); ctx.closePath(); };
      withShadow(9, () => { ctx.fillStyle = '#FFFFFF'; path(); ctx.fill(); });
      f2_fibres(path, .3); f2_edge(path, .5);
      ctx.fillStyle = 'rgba(156,195,230,.18)'; ctx.fillRect(-110, 18, 220, 12);
    });
  }
  function s3_sun(x, y, r, ts) {
    at(x, y, ts * .25, 1, 1, () => {
      withShadow(6, () => { ctx.fillStyle = C.amber; ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? r * 1.0 : r * 1.32; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#F7C066'; ctx.beginPath(); ctx.arc(0, 0, r * .82, 0, 7); ctx.fill();
      f2_fibres(() => { ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, 7); }, .35);
    });
  }
  function s3_gull(x, y, s, n, ph) {
    const up = Math.floor(n / 4 + ph) % 2 ? -10 : 4;
    at(x, y, 0, s, s, () => { ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(-24, up); ctx.quadraticCurveTo(-12, -8, 0, 4); ctx.quadraticCurveTo(12, -8, 24, up); ctx.stroke(); });
  }

  // ---------------------------------------------------------------- poses
  /** boat stage pose in SCREEN space (before / during the pull-back) */
  function s3_boatScreen(t, T) {
    const ts = tw(t), ki = eOutCubic(prog(t, T.boat0, T.boat1));
    const rock = .03 * Math.sin(ts * Math.PI * 2 / 1.7), bob = 6 * Math.sin(ts * Math.PI * 2 / 1.7 + 1.2);
    const u = ts - T.land, dip = u >= 0 && u < 1 ? 9 * Math.exp(-u * 6) * Math.sin(u * 16) : 0;
    return { x: lerp(1520, BOAT.x, ki), y: BOAT.y + bob + dip, s: BOAT.s, r: rock * ki - .06 * (1 - ki) * Math.sin(Math.PI * ki) };
  }
  /** arc-length position of the boat token on the route */
  function s3_tokD(t, T) { const R = s3_route(), k = eInOutCubic(prog(t, T.sail0, T.sail1)); return lerp(0, R.tot - DOCK, k); }
  /** boat token pose in MAP space */
  function s3_tokMap(t, T) {
    const ts = tw(t), d = s3_tokD(t, T), [x, y] = s3_routeAt(d), sailing = t > T.sail0 && t < T.sail1;
    const bob = (sailing ? 4 : 2) * Math.sin(ts * Math.PI * 2 / (sailing ? .5 : 1.6)), r = (sailing ? .07 : .03) * Math.sin(ts * Math.PI * 2 / (sailing ? .5 : 1.6) + 1);
    return { x, y: y - 14 + bob, s: TOK_S, r, mirror: false };
  }
  /** truck token (map space): pops at the pin on « Puis », drives inland on « route » */
  const TRK_OFF = [70, 52], TRK_RUN = [108, 18];
  function s3_trkMap(t, T) {
    const P = s3_route().pin, ts = tw(t), k = eInOutCubic(prog(ts, T.route, T.drive1)), driving = ts > T.route && ts < T.drive1;
    return { x: P[0] + TRK_OFF[0] + TRK_RUN[0] * k, y: P[1] + TRK_OFF[1] + TRK_RUN[1] * k + (driving && Math.floor(t * 15) % 2 ? -1.5 : 0), s: TRK_S, k,
      r: 0, pop: clamp(pop(ts, T.puis, 18, .45), 0, 1.3), wheel: TRK_RUN[0] * k / TRK_S / 40 };
  }
  /** container on the truck token: truck-local centre + scale (side view on the flatbed) */
  const ONTRK = { x: -80, y: -50 - 64 * 1.2, s: 1.2 };
  function s3_xfPt(P, lx, ly, mirror) { const sx = mirror ? -1 : 1, c = Math.cos(P.r), s = Math.sin(P.r), ax = lx * P.s * sx, ay = ly * P.s; return [P.x + ax * c - ay * s, P.y + ax * s + ay * c]; }

  // ---------------------------------------------------------------- the container in flight (T4) and the hop (map)
  /** T4: B's top-view container at (540, 760) s .3 → 3-pose paper flip → side view dropping onto the deck. → {x,y,s,sy,view,lift,r} */
  function s3_contT4(t, T) {
    const ts = tw(t), k = prog(ts, T.hand, T.flip1), pose = Math.min(3, Math.floor(k * 3 + 1e-6));
    if (t < T.flip1) {
      const sy = [1, .22, .42, 1][pose], view = pose < 2 ? 'top' : 'side';
      return { x: 540, y: 760 - 10 * pose, s: view === 'top' ? .3 : OURS.s * BOAT.s, sy, view, lift: 60 + 8 * pose, r: [0, .04, -.03, 0][pose] };
    }
    const B = s3_boatScreen(t, T), [tx, ty] = s3_xfPt(B, OURS.x, -10 - 64 * OURS.s, false), u = clamp((t - T.flip1) / (T.land - T.flip1));
    return { x: lerp(540, tx, eOutCubic(u)), y: lerp(730, ty, eInCubic(u)) - 30 * Math.sin(Math.PI * u) * (1 - u), s: OURS.s * BOAT.s, sy: 1, view: 'side', lift: lerp(68, 4, u), r: .05 * (1 - u) };
  }
  function s3_drawCont(C_, n) {
    at(C_.x, C_.y, C_.r, C_.s, C_.s * C_.sy, () => {
      if (C_.view === 'top') hp_paperContainer('top', { part: 'all', lid: 1, label: true, lift: C_.lift });
      else hp_paperContainer('side', { label: true, lift: C_.lift });
    });
  }
  /** our container hopping from the boat token to the truck token, map space (3 poses) → {x,y,s,r} */
  function s3_hopPose(t, T) {
    const ts = tw(t), k = prog(ts, T.hop0, T.hop1), pose = Math.min(3, Math.ceil(k * 3 - 1e-6));
    const B = s3_tokMap(T.hop0, T), A = s3_xfPt(B, OURS.x, -10 - 64 * OURS.s, B.mirror), Tk = s3_trkMap(T.hop1, T), Z = s3_xfPt(Tk, ONTRK.x, ONTRK.y, false);
    const q = [0, .38, .78, 1][pose], s0 = OURS.s * TOK_S, s1 = ONTRK.s * TRK_S;
    return { x: lerp(A[0], Z[0], q), y: lerp(A[1], Z[1], q) - [0, 46, 34, 0][pose], s: lerp(s0, s1, q), r: [0, -.18, .12, 0][pose], lift: [0, 26, 18, 0][pose] };
  }

  // ---------------------------------------------------------------- drawing: map content (one half or whole)
  function s3_drawTokens(t, n, T, half) {
    const ts = tw(t);
    // dashed marker road + truck token (left half, with Africa)
    if (half !== 'R' && ts >= T.puis) {
      const Tk = s3_trkMap(t, T), P = s3_route().pin;
      if (Tk.k > 0) { ctx.save(); ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.setLineDash([12, 10]);
        const a = [P[0] + TRK_OFF[0] - 50, P[1] + TRK_OFF[1] + 4], b = [P[0] + TRK_OFF[0] + TRK_RUN[0] * Tk.k - 30, P[1] + TRK_OFF[1] + TRK_RUN[1] * Tk.k + 4];
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore(); }
      const s = Tk.s * Tk.pop, onBed = ts >= T.hop1;
      at(Tk.x, Tk.y, 0, s, s, () => {
        ctx.save(); ctx.beginPath(); ctx.rect(-400, -400, 800, 800); ctx.rect(-263, -303, 366, 253); ctx.clip('evenodd');   // flatbed: no box
        hp_paperTruck(t, { label: false, wheel: Tk.wheel, lift: 4 }); ctx.restore();
        if (onBed) { const u = ts - T.hop1, q = u < .3 ? Math.exp(-u * 12) * Math.cos(u * 40) * .08 : 0;
          at(ONTRK.x, ONTRK.y + 64 * ONTRK.s * q, 0, ONTRK.s * (1 + q), ONTRK.s * (1 - q), () => hp_paperContainer('side', { label: true, lift: 3 })); }
      });
    }
    // the boat token (left half after the tear)
    if (half !== 'R' && t >= T.pb1) {
      const B = s3_tokMap(t, T), carrying = ts < T.hop0;
      at(B.x, B.y, B.r, B.s * (B.mirror ? -1 : 1), B.s, () => { const sq = carrying ? [1, 1] : null;
        s3_boatPatch(); s3_boat({ ours: carrying, oursSq: sq }); });
    }
    if (ts >= T.hop0 && ts < T.hop1 && half == null) { const H = s3_hopPose(t, T); at(H.x, H.y, H.r, H.s, H.s, () => at(0, 0, 0, 1, 1, () => hp_paperContainer('side', { label: true, lift: H.lift }))); }
  }
  /** a little torn-paper sea patch under the boat token (it floats on the map) */
  function s3_boatPatch(k = 1) {
    if (k <= 0) return; ctx.save(); ctx.translate(0, 70); ctx.scale(lerp(.6, 1, k), k); ctx.translate(0, -70);
    ctx.fillStyle = '#5E9ED6'; ctx.beginPath(); ctx.moveTo(-158, 66);
    for (let x = -158; x < 158; x += 26) ctx.quadraticCurveTo(x + 6.5, 50, x + 13, 60), ctx.quadraticCurveTo(x + 19.5, 70, x + 26, 60);
    ctx.lineTo(158, 86); ctx.lineTo(-158, 86); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-158, 62);
    for (let x = -158; x < 158; x += 26) ctx.quadraticCurveTo(x + 6.5, 52, x + 13, 62), ctx.quadraticCurveTo(x + 19.5, 72, x + 26, 62);
    ctx.stroke(); ctx.restore();
  }
  function s3_drawMapBack(t, n, T, half) {
    const M = s3_buildMap(), R = s3_route(), X = s3_mapXf(t, half);
    ctx.save(); s3_applyXf(X);
    if (half) { f2_poly(s3_halfPoly(half)); ctx.clip(); }
    ctx.save(); ctx.shadowColor = C.shadow + (.3 - .1 * clamp(X.lift / 200)) + ')'; ctx.shadowBlur = 6 + .5 * X.lift; ctx.shadowOffsetX = 4 + .35 * X.lift; ctx.shadowOffsetY = 7 + .6 * X.lift;
    ctx.drawImage(M.canvas, 0, MOY); ctx.restore();
    // the violet journey thread drawn behind the boat token
    const d = t >= T.sail0 ? s3_tokD(t, T) : 0;
    if (d > 2) { const pts = []; for (let i = 0; i < R.pts.length && R.len[i] <= d; i++) pts.push(R.pts[i]); pts.push(s3_routeAt(d)); ctx.save(); ctx.globalAlpha *= .92; thread(pts, 1, n, { w: 6 }); ctx.restore(); }
    s3_drawTokens(t, n, T, half);
    ctx.restore();
    if (half) {                                           // white fibrous torn edge along the tear (paper core)
      ctx.save(); s3_applyXf(X); f2_poly(M.sheet); ctx.clip(); ctx.lineJoin = 'round'; const L = s3_tearLine();
      ctx.strokeStyle = 'rgba(255,253,246,.95)'; ctx.lineWidth = 5; ctx.beginPath(); L.forEach((p, i) => i ? ctx.lineTo(p[0] + (half === 'L' ? -1 : 1), p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.restore();
    }
  }
  function s3_strips(t, n, T) {
    const ts = tw(t), pin = s3_route().pin;
    const kc = prog(ts, T.chine - .1, T.chine + .05), ka = prog(ts, T.afrStrip - .1, T.afrStrip + .05);
    const one = (str, at_, k, seed, rot) => { if (k <= 0) return; const s = lerp(1.35, 1, eInCubic(k)), u = ts - (seed === 1 ? T.chine : T.afrStrip) - .05, sq = u > 0 && u < .4 ? 1 - Math.exp(-u * 12) * Math.cos(u * 36) * .04 : 1;
      at(at_[0], at_[1], rot, s * sq, s * sq, () => { ctx.globalAlpha *= clamp(k * 2.5); strip(str, { size: 64, lift: lerp(30, 8, k), seed, pad: 34 });
        ctx.fillStyle = C.tape; at(-measure(str, font(FF.stencil, 64, 900), 3) / 2 - 30, -40, -.5, 1, 1, () => ctx.fillRect(-36, -13, 72, 26)); }); };
    one('CHINE', geo(93, 37), kc, 1, -.04);
    one('AFRIQUE', geo(15, 20), ka, 2, .03);
    // the push-pin at the Gulf of Guinea (unlabelled)
    const kp = pop(ts, T.afr, 18, .4); if (kp > 0) { const s = lerp(1.7, 1, clamp(kp)); at(pin[0], pin[1], 0, s, s, () => pushPin(0, 0, C.orange)); }
  }
  function s3_drawMapFront(t, n, T, half) {
    const X = s3_mapXf(t, half);
    ctx.save(); s3_applyXf(X); if (half) { f2_poly(s3_halfPoly(half)); ctx.clip(); }
    s3_strips(t, n, T); ctx.restore();
  }

  // ---------------------------------------------------------------- the paper truck (drives in, parks)
  function s3_truckPose(t, T) {
    const ts = tw(t);
    if (t >= T.truckStop) { const P = s3_truckRest(t), u = ts - T.truckStop; if (u < .5) { const q = Math.exp(-u * 10) * Math.cos(u * 34); P.r = -.03 * q; P.y -= 6 * Math.max(0, q) * (u < .12 ? 1 : .4); } return P; }
    const k = prog(ts, T.truckIn, T.truckStop), e = 1 - Math.pow(1 - k, 2.4), x = lerp(-470, S3_TRUCK.x, e);
    return { x, y: S3_TRUCK.y + (Math.floor(t * 15) % 2 ? -2 : 0), s: S3_TRUCK.s, r: .012 * Math.sin(ts * 40), wheel: (x + 470) / S3_TRUCK.s / 40, bob: true };
  }
  function s3_drawTruck(P, t) { at(P.x, P.y, P.r, P.s, P.s, () => { hp_paperTruck(t, { label: true, wheel: P.wheel, bob: P.bob, lift: 8 }); s3_stack(t, P.bob); }); }
  /** paper dust puffs behind the rear wheels while the truck drives in, and a little skid puff at the stop (on twos) */
  function s3_dust(t, T) {
    const ts = tw(t), puff = (x, y, r, a) => { ctx.globalAlpha = a; ctx.fillStyle = '#C8AE86'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.globalAlpha = a * .8; ctx.fillStyle = '#EADCC2'; ctx.beginPath(); ctx.arc(x - r * .22, y - r * .28, r * .62, 0, 7); ctx.fill(); };
    ctx.save();
    for (let i = 0; i < 9; i++) { const t0 = T.truckIn + .04 + i * .066; if (t0 > T.truckStop - .05) break;
      const u = ts - t0; if (u < 0 || u > .42) continue; const P = s3_truckPose(t0, T);
      puff(P.x - 285 * P.s - 90 * u, P.y - 16 - 40 * u - 8 * (i % 2), 12 + 40 * u, .7 * (1 - u / .42)); }
    const u = ts - T.truckStop; if (u >= 0 && u < .5) for (let j = 0; j < 4; j++) { const P = s3_truckRest(T.truckStop);
      puff(P.x + (150 + 40 * j) * P.s * .9 + 90 * u * (j - 1), P.y - 12 - 34 * u * (1 + j * .4), 10 + 30 * u, .65 * (1 - u / .5)); }
    ctx.restore();
  }
  /** horn « toot » marks at the cab's nose (two short ink bursts) */
  function s3_toot(t, T) {
    const ts = tw(t); ctx.save(); ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const t0 of [T.truckStop, T.truckStop + .18]) { const u = ts - t0; if (u < 0 || u > .16) continue;
      const P = s3_truckRest(t0), x = P.x + 272 * P.s, y = P.y - 120 * P.s, g = 1 - Math.abs(u - .08) / .08 * .4;
      for (const a of [-.55, 0, .55]) { ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 18, y + Math.sin(a) * 18); ctx.lineTo(x + Math.cos(a) * (18 + 34 * g), y + Math.sin(a) * (18 + 34 * g)); ctx.stroke(); } }
    ctx.restore();
  }
  /** the lead-thread knot of s3 (screen) */
  function s3_knot(t, T) {
    const ts = tw(t);
    if (t < T.land) { const Cn = s3_contT4(t, T);
      if (Cn.view === 'top') return [Cn.x + (410 + 4 - 92) * Cn.s, Cn.y + (-140 * .55 + 14) * Cn.s * Cn.sy];
      return [Cn.x + 70 * Cn.s, Cn.y + (-140 * .3 + 6) * Cn.s * Cn.sy]; }
    if (t < T.pb0) { const B = s3_boatScreen(t, T); return s3_xfPt(B, OURS_KNOT[0], OURS_KNOT[1], false); }
    if (t < T.pb1) { const B = s3_pullPose(t, T); return s3_xfPt(B, OURS_KNOT[0], OURS_KNOT[1], B.mirror); }
    const X = s3_mapXf(t, null);
    if (ts < T.hop0) { const B = s3_tokMap(t, T), p = s3_xfPt(B, OURS_KNOT[0], OURS_KNOT[1], B.mirror); return s3_mapPt(X, p[0], p[1]); }
    if (ts < T.hop1) { const H = s3_hopPose(t, T); return s3_mapPt(X, H.x + 70 * H.s, H.y + (-140 * .3 + 6) * H.s); }
    const Tk = s3_trkMap(t, T), lp = s3_xfPt(Tk, ONTRK.x + 70 * ONTRK.s, ONTRK.y + (-140 * .3 + 6) * ONTRK.s, false);
    const Xr = s3_mapXf(t, 'L'), onTok = s3_mapPt(Xr, lp[0], lp[1]);
    if (t < T.tear0 + .08) return onTok;
    const k = eInOutCubic(prog(t, T.tear0 + .08, T.truckIn + .3)), K = s3_truckKnot(s3_truckPose(t, T));
    return [lerp(onTok[0], K[0], k), lerp(onTok[1], K[1], k)];
  }
  /** boat pose during the pull-back (screen) */
  function s3_pullPose(t, T) {
    const k = eInOutCubic(prog(t, T.pb0, T.pb1)), A = s3_boatScreen(T.pb0, T), B = s3_tokMap(t, T), X = s3_mapXf(t, null), [bx, by] = s3_mapPt(X, B.x, B.y);
    return { x: lerp(A.x, bx, k), y: lerp(A.y, by, k) - 60 * Math.sin(Math.PI * k), s: lerp(BOAT.s, TOK_S, k), r: lerp(A.r, B.r + X.r, k), mirror: false, lift: 6 + 40 * Math.sin(Math.PI * k), k };
  }

  // ---------------------------------------------------------------- registrations
  hp_anchor('s3', t => { const T = s3_T(); if (t < T.hand) return null; return s3_knot(t, T); });
  hp_states('s3', t => (t < TL.ch('s5').start ? { visible: false } : {}));
  hp_tick(2, () => s3_T().tick);
  function s3_cues(T) {
    hp_sfx('waves_paper', T.wave0); hp_sfx('whoosh_soft', T.boat0); hp_sfx('thup', T.land); hp_sfx('waves_paper_loop', T.land);
    hp_sfx('paper_slide', T.map0); hp_sfx('paper_slap', T.chine); hp_sfx('horn_toy', T.sail0);
    hp_sfx('pin_click', T.afr); hp_sfx('paper_slap', T.afrStrip); hp_sfx('pop_soft', T.puis); hp_sfx('thup', T.hop1);
    hp_sfx('marker_squeak', T.route); hp_sfx('paper_tear', T.tear0); hp_sfx('truck_rumble_soft', T.truckIn);
    hp_sfx('horn_toy', T.truckStop); hp_sfx('horn_toy', T.truckStop + .18); hp_sfx('develop_whirr', T.truckStop); hp_sfx('pin_click', T.note);
  }

  registerScene({
    id: 's3_back', z: 20, when: t => TL.in(t, 's3', .45, 0),
    draw(t, n) {
      const T = s3_T(), ts = tw(t); s3_cues(T);
      // ---- the blank hero print P4 (under the map; revealed by the tear)
      if (t >= T.tear0 - .05) hp_printAt(s3_p4Rect(t), 'B', 6.0, Object.assign({}, S3_P4FR, { develop: s3_p4Develop(t), lift: 12 }));
      // ---- the map (whole, then two halves)
      if (t >= T.map0 && t < T.tear1) {
        if (t < T.tear0) s3_drawMapBack(t, n, T, null);
        else { s3_drawMapBack(t, n, T, 'L'); s3_drawMapBack(t, n, T, 'R'); }
      }
      // ---- the sea, the sky and the boat (until the boat is placed on the map)
      if (t < T.pb1 + .02) {
        const out = eInCubic(prog(ts, T.pb0, T.pb0 + .36)), ins = eOutBack(prog(ts, T.tb - .25, T.tb + .2), 1.4);
        if (out < 1 && ins > 0) {                         // sky props slide in on twos, then are swept off by the pull-back
          const din = 520 * (1 - ins);
          s3_sun(866 + 600 * out + din, 470 - 200 * out, 58, ts); s3_cloud(205 + 10 * Math.sin(ts * .6) - 700 * out - din, 610, .95, 1); s3_cloud(905 + 8 * Math.sin(ts * .5 + 2) + 700 * out + din, 810, .72, 2);
          if (out < .25) { s3_gull(330 - 900 * out, 470 - din * .3 - 600 * out, 1, n, 0); s3_gull(392 - 900 * out, 430 - din * .3 - 600 * out, .8, n, 1); }
        }
        for (let i = 0; i < 2; i++) { const dy = s3_waveDy(i, t, T); if (WAVE_Y[i] + dy < 1960) s3_wave(i, WAVE_Y[i] + dy, ts); }
        if (t < T.pb0) { if (t >= T.boat0) { const B = s3_boatScreen(t, T), u = ts - T.land, q = u >= 0 && u < .35 ? Math.exp(-u * 12) * Math.cos(u * 40) * .07 : 0;
            at(B.x, B.y, B.r, B.s, B.s, () => s3_boat({ ours: t >= T.land, oursSq: [1 + q, 1 - q] })); } }
        for (let i = 2; i < 6; i++) { const dy = s3_waveDy(i, t, T); if (WAVE_Y[i] + dy < 1960) s3_wave(i, WAVE_Y[i] + dy, ts); }
        if (t >= T.pb0 && t < T.pb1) { const B = s3_pullPose(t, T);           // picked up and placed on the map
          at(B.x, B.y, B.r, B.s, B.s, () => { s3_boatPatch(B.k); s3_boat({ ours: true, lift: B.lift / B.s }); }); }
      }
      // ---- the paper truck drives in and parks on P4 (s4 takes it over at the boundary)
      if (t >= T.truckIn) { const P = s3_truckPose(t, T); s3_dust(t, T); s3_drawTruck(P, t); if (t >= T.truckStop) s3_exhaust(t, P, T.exh0, T.exh1); }
    },
  });
  registerScene({
    id: 's3_front', z: 50, when: t => TL.in(t, 's3', .45, 0),
    draw(t, n) {
      const T = s3_T();
      if (t >= T.hand && t < T.land) s3_drawCont(s3_contT4(t, T), n);          // T4: flip + drop onto the deck
      if (t >= T.map0 && t < T.tear1) { if (t < T.tear0) s3_drawMapFront(t, n, T, null); else { s3_drawMapFront(t, n, T, 'L'); s3_drawMapFront(t, n, T, 'R'); } }
      if (t >= T.truckStop) s3_toot(t, T);
      if (t >= T.note - .1) { const k = clamp(pop(tw(t), T.note, 16, .45), 0, 1.2), N = s3_notePose(t); hp_tagNote([{ s: 'Notre entrepôt', size: 52 }], N.x, N.y, k, { rot: N.r, lift: 8 }); }
    },
  });
})();

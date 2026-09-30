'use strict';
// =============================================================================================
// 44_bete — LA BÊTE NOIRE for the whole film: Junior's fear, ONE character that shrinks as he learns.
// A black paper puppet (monster() from 08_props) standing far back (z 16: in front of the sky panel, behind every station and
// behind the stage board), in the right third of the frame, never over a real photo, never over the customs officer.
// Big → it stands on the stage floor; smaller → a kraft puppet stick holds it up above the rooftops (paper-theatre logic),
// so each size stays readable. Every shrink is a visible paper fold (the top flips down, back of the paper shows, then it
// settles smaller). Sizes (100 % ≈ 900 px tall at z 1): S2 rises 100 · S7 85 · S9 75 · S12 65 · S13 60 · S15 swells to 90 ·
// S16–S17 110 behind Junior's shoulder · S18 big fold 45 · S19 35 · S21 25 · S22 15 · S23 folds into a small paper margouillat
// (black body, orange folded head) that nods and hops onto the exiting truck (containerAt).
// exports: window.B44_lizard(len, o) — the margouillat (also used at Mboppi by 34_mboppi).
// =============================================================================================
(() => {
  const W0 = 400, HB = W0 * 1.05, HT = HB * 1.08;                     // monster(W0): body height HB, total height with horns HT
  const FD = .95;                                                     // one paper fold (s)
  let E = null, P = null, S = null, OFF = null;
  const zfOf = z => Math.pow(z, .55);                                 // far layer: zooms feel softer than on the stage
  const cutMid = () => { const c = CUT(); return c.t + c.dur * .5; };

  // ---------- the margouillat (shared) -----------------------------------------------------------
  /** paper agama lizard, side view facing right, origin = feet on the ground/wall line, len ≈ body + head length.
   *  o: { turn 0..1 (head turns to face us), nod 0..1 (push-up), run (leg phase), headFold 0..1 (orange head flap folding in), n } */
  function lizard(len, o = {}) {
    const s = len / 100, nod = clamp(o.nod || 0), run = o.run || 0, hf = o.headFold ?? 1, n = o.n || 0;
    ctx.save(); ctx.scale(s, s);
    ctx.save(); ctx.fillStyle = 'rgba(40,20,10,.22)'; ctx.beginPath(); ctx.ellipse(0, 2, 70, 7, 0, 0, 7); ctx.fill(); ctx.restore();
    const legs = (x, ph) => { const a = Math.sin(run + ph) * .5; at(x, -10, 0, 1, 1, () => { ctx.strokeStyle = '#17111B'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * 16 + 8, 8); ctx.lineTo(Math.sin(a) * 16 + 16, 10); ctx.stroke(); }); };
    legs(-30, 0); legs(24, Math.PI);
    ctx.save(); ctx.translate(-20, -12); ctx.rotate(-nod * .22); ctx.translate(20, 12);            // push-up: the front lifts
    // tail
    ctx.fillStyle = '#17111B'; ctx.beginPath(); ctx.moveTo(-34, -20); ctx.quadraticCurveTo(-80, -22, -104, -8); ctx.quadraticCurveTo(-122, 2, -136, -10);
    ctx.quadraticCurveTo(-118, 8, -96, 2); ctx.quadraticCurveTo(-70, -6, -34, -6); ctx.closePath(); ctx.fill();
    // body (torn-edge black paper)
    ctx.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2, r = 1 + (rnd(i * 3.3 + Math.floor(n / 2) % 3) - .5) * .08;
      const x = Math.cos(a) * 42 * r, y = -16 + Math.sin(a) * 12 * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,130,.35)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 9, -22); ctx.lineTo(-22 + i * 9, -12); ctx.stroke(); }
    legs(-24, Math.PI * .5); legs(30, Math.PI * 1.5);
    // head: orange origami fold (profile), turning to face us
    const tn = clamp(o.turn || 0);
    at(44, -26, 0, 1, 1, () => {
      if (tn < .5) { ctx.scale(1 - tn * 2, 1); at(0, 0, 0, 1, hf, () => {
        ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(22, -8); ctx.lineTo(36, 4); ctx.lineTo(8, 12); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#C44109'; ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(22, -8); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(14, -1, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#140C10'; ctx.beginPath(); ctx.arc(16, -1, 3.2, 0, 7); ctx.fill(); }); }
      else { ctx.scale(tn * 2 - 1, 1); at(4, 0, 0, 1, hf, () => {
        ctx.fillStyle = C.orange; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(20, -4); ctx.lineTo(12, 16); ctx.lineTo(-12, 16); ctx.lineTo(-20, -4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#C44109'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(20, -4); ctx.lineTo(0, 2); ctx.lineTo(-20, -4); ctx.closePath(); ctx.fill();
        for (const sx of [-1, 1]) { ctx.fillStyle = '#FFFDF7'; ctx.beginPath(); ctx.arc(sx * 9, 4, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#140C10'; ctx.beginPath(); ctx.arc(sx * 9, 5, 3.2, 0, 7); ctx.fill(); } }); }
    });
    ctx.restore(); ctx.restore();
  }
  window.B44_lizard = lizard;

  // ---------- the story of the bête (lazy time tables) ---------------------------------------------
  function ev() {
    if (E) return E;
    E = [
      { t: tw('S7', 'passe', 0), to: .85, kind: 'fold' },
      { t: te('S9', 'arrivée', .15), to: .75, kind: 'fold' },
      { t: te('S12', 'départ', .15), to: .65, kind: 'fold' },
      { t: te('S13', 'sortie', .1), to: .60, kind: 'fold' },
      { t: tw('S15', 'repense', 0), to: .90, kind: 'grow', dur: 1.3 },
      { t: tw('S16', 'choisi', 0), to: 1.10, kind: 'grow', dur: 1.1 },
      { t: tw('S18', 'correspond', 0), to: .45, kind: 'fold', dur: 1.35 },
      { t: te('S19', 'marchandise', .1), to: .35, kind: 'fold' },
      { t: tw('S21', 'quittance', .2), to: .25, kind: 'fold' },
      { t: te('S22', 'sort', .1), to: .15, kind: 'fold' },
      { t: tw('S23', 'bête', 0), to: .08, kind: 'fold' },
    ].filter(e => isFinite(e.t) && e.t < 1e4).sort((a, b) => a.t - b.t);
    for (const e of E) if (e.kind === 'fold') { e.dur = e.dur || FD; addShake(e.t + .42 * e.dur / FD, 4, .1); }          // paper fold (sound cue)
    return E;
  }
  function pos() {
    if (P) return P;
    P = [
      { t: 0, sx: 850, lean: 0 },
      { t: ss('S3', -.1), dur: 1.0, sx: 1000, lean: 0 },
      { t: ss('S5', -.3), dur: 1.1, sx: 1075, lean: 0 },
      { t: tw('S6', 'porte', 0), dur: 2.4, sx: 870, lean: 0 },
      { t: tw('S10', 'trois', .3), dur: 1.6, sx: 1015, lean: .1, ly: 260 },             // at the counter: off to the right edge and up, never behind the officer
      { t: se('S15', .6), dur: 3.4, sx: 990, lean: -.12 },
      { t: cutMid() + .0005, dur: 0, jx: 20, lean: -.07 },
      { t: tw('S18', 'correspond', .95), dur: .95, sx: 880, lean: 0 },
      { t: tw('S23', 'barrière', 0), dur: 2.2, wx: X.barriere + 260, lean: 0 },
    ];
    return P;
  }
  function st() {
    if (S) return S;
    S = { rise: tw('S2', 'bête', -.15), blink4: tw('S4', 'saurez', 0), down0: tw('S23', 'bête', 0), down1: tw('S23', 'bête', .75),
      morph0: tw('S23', 'bête', FD + .05), morph1: tw('S23', 'bête', FD + .5), nod0: tw('S23', 'margouillat', -.1), nod1: tw('S23', 'margouillat', .35),
      hop0: tw('S23', 'margouillat', .35), hop1: tw('S23', 'margouillat', .78) };
    addShake(S.rise + .45, 6, .14);                                                 // it rises (paper whoosh + thud)
    addShake(S.hop1, 3, .1);                                                        // the margouillat lands on the container
    return S;
  }
  /** size at t: { pct, fold: {k, from, to} | null } */
  function sizeAt(t) {
    let pct = 1;
    for (const e of ev()) {
      if (t < e.t) break;
      const d = e.dur;
      if (t < e.t + d) { const k = (t - e.t) / d;
        if (e.kind === 'fold') { const f = { k, d, from: pct, to: e.to }; return { pct: foldPct(f), fold: f }; }
        return { pct: lerp(pct, e.to, clamp(spring(k * d, 9, .45), 0, 1.15)), fold: null, grow: true }; }
      pct = e.to;
    }
    return { pct, fold: null };
  }
  function lagX(t) {                                                              // far plane: it trails the camera a little
    const cm = cutMid(); let t0 = t - .45; if (t0 < cm && t >= cm) t0 = cm + .001;
    const c = camAt(t), c0 = camAt(t0); return clamp(-(c.x - c0.x) * .45 * c.z, -240, 240);
  }
  function keyX(k, t) {
    if (k.sx != null) return k.sx + lagX(t);
    if (k.jx != null) { const j = actorAt('junior', t); return worldToScreen((j ? j.x : 0) + k.jx, GROUND, t).x; }
    return worldToScreen(k.wx, GROUND, t).x;
  }
  function placeAt(t) {
    const K = pos(); let x = keyX(K[0], t), lean = K[0].lean || 0, ly = K[0].ly || 0;
    for (let i = 1; i < K.length; i++) { const k = K[i];
      if (t >= k.t) { x = keyX(k, t); lean = k.lean || 0; ly = k.ly || 0; continue; }
      if (k.dur > 0 && t > k.t - k.dur) { const e = eInOutCubic(prog(t, k.t - k.dur, k.t)); x = lerp(x, keyX(k, t), e); lean = lerp(lean, k.lean || 0, e); ly = lerp(ly, k.ly || 0, e); }
      break; }
    return { x, lean, ly };
  }

  // ---------- drawing ------------------------------------------------------------------------------
  function lids(bl) {                                                             // eyelids (blink): black paper over the eyes
    if (bl <= 0) return; const r = W0 * .105, ey = -HB * .62;
    for (const s of [-1, 1]) { const ex = s * W0 * .17; ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, r + 1, 0, 7); ctx.clip();
      ctx.fillStyle = '#17111B'; ctx.fillRect(ex - r - 2, ey - r - 2, 2 * r + 4, (2 * r + 4) * clamp(bl)); ctx.restore(); }
  }
  function beast(o) { monster(W0, o.rise, { n: o.n, look: o.look, mouth: o.mouth }); if (o.rise >= 1) lids(o.blink); }
  /** the fold: the top of the puppet flips down over its own face (the back of the paper shows), then unfolds — smaller */
  const CF = .58;                                                                 // crease at 58 % of the height: the flap covers the face
  function foldAngle(f) { const k = f.k * f.d, a = .42 * f.d / FD, h = .1 * f.d / FD;
    if (k < a) return Math.PI * eInOutCubic(k / a); if (k < a + h) return Math.PI; return Math.PI * (1 - eInOutCubic(clamp((k - a - h) / (f.d - a - h)))); }
  function foldPct(f) { const k = f.k * f.d, a = .42 * f.d / FD, h = .1 * f.d / FD; return lerp(f.from, f.to, eInOutCubic(clamp((k - a - h * .5) / (f.d - a - h * .5)))); }
  function folded(o, f) {
    const yc = -CF * HT, th = foldAngle(f), cth = Math.cos(th);
    if (th < .01) { beast(o); return; }
    const main = ctx;
    ctx.save(); ctx.beginPath(); ctx.rect(-W0, yc, 2 * W0, -yc + 60); ctx.clip(); beast(o); ctx.restore();
    if (!OFF) OFF = makeCanvas(W, H);
    const g = OFF.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(ctx.getTransform());
    try { ctx = g; ctx.save(); ctx.translate(0, yc); ctx.scale(1, Math.abs(cth) < .03 ? .03 * (cth < 0 ? -1 : 1) : cth); ctx.translate(0, -yc);
      ctx.beginPath(); ctx.rect(-W0, -HT * 1.3, 2 * W0, HT * 1.3 + yc); ctx.clip(); beast(Object.assign({}, o, { blink: 0 })); ctx.restore();
      if (cth < 0) {                                                               // the back of the paper: grey-violet, fibres, a light edge
        g.globalCompositeOperation = 'source-atop'; ctx.save(); ctx.translate(0, yc); ctx.scale(1, cth); ctx.translate(0, -yc);
        ctx.fillStyle = '#4E4360'; ctx.fillRect(-W0, -HT * 1.3, 2 * W0, HT * 1.3 + yc);
        ctx.strokeStyle = 'rgba(200,185,215,.28)'; ctx.lineWidth = 2; for (let i = 0; i < 40; i++) { const x = (rnd(i * 2.3) - .5) * W0 * .8, y = yc - rnd(i * 5.1) * HT * .42; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 5); ctx.stroke(); }
        ctx.restore(); g.globalCompositeOperation = 'source-over';
      } else { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(90,70,110,${(1 - cth) * .55})`; g.fillRect(0, 0, W, H); g.restore(); }
    } finally { ctx = main; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(OFF, 0, 0); ctx.restore();
    ctx.strokeStyle = 'rgba(210,195,225,.75)'; ctx.lineWidth = 4 / Math.max(.2, Math.hypot(ctx.getTransform().a, ctx.getTransform().b)); ctx.beginPath(); ctx.moveTo(-W0 * .47, yc); ctx.lineTo(W0 * .47, yc); ctx.stroke();
  }
  function blinkAt(t) {
    const S0 = st(); let b = 0;
    for (const t0 of [S0.blink4, S0.blink4 + .38]) b = Math.max(b, env(t, t0, t0 + .22, .07, .1));
    const per = 3.7, ph = (t + 1.3) % per; if (ph < .16) b = Math.max(b, Math.sin(ph / .16 * Math.PI));
    return b;
  }
  function drawBete(t, n) {
    const S0 = st(); if (t < S0.rise || t > S0.morph1 + .05) return;
    const rise = clamp(prog(t, S0.rise, S0.rise + 1.15)), c = camAt(t), zf = zfOf(c.z);
    const sz = sizeAt(t), pl = placeAt(t);
    const pctBase = sz.pct;
    let hb = Math.max(0, 640 - 495 * pctBase);                                       // puppet-stick height (world units)
    hb *= 1 - eInOutCubic(prog(t, S0.down0, S0.down1));                              // S23: it slides down its stick
    const board = worldToScreen(c.x, GROUND - 40, t).y, bx = pl.x, by = board - (hb + (pl.ly || 0)) * zf;
    const j = actorAt('junior', t), js = j ? worldToScreen(j.x, j.y - 80, t) : { x: 0 };
    const look = clamp((js.x - bx) / 380, -1, 1) * .9, mouth = clamp(.25 + .75 * (pctBase - .1) / .9) * (.85 + .15 * Math.sin(stepT(n) * 1.7));
    const breath = 1 + .012 * Math.sin(stepT(n) * 2.4), hop = 0;
    const o = { rise, n, look, mouth, blink: blinkAt(t) };
    ctx.save(); ctx.beginPath(); ctx.rect(-50, -50, W + 100, board + 50); ctx.clip();
    if (hb > 2) { const s = 900 * pctBase * zf / HT, top = by + (1 - eOutBack(rise)) * HB * .9 * s - 40 * s;   // the kraft puppet stick
      if (top < board) { ctx.fillStyle = C.kraftD; ctx.fillRect(bx - 7 * zf, top, 14 * zf, board - top + 20); ctx.fillStyle = 'rgba(255,240,210,.35)'; ctx.fillRect(bx - 5 * zf, top, 3 * zf, board - top + 20); } }
    let mk = 1; if (t > S0.morph0) mk = 1 - eInCubic(prog(t, S0.morph0, S0.morph1));   // S23: crumples into the margouillat
    if (sz.fold) { const s = 900 * sz.pct * zf / HT; at(bx, by + hop, pl.lean, s * mk, s * breath * mk, () => folded(o, sz.fold)); }
    else { const s = 900 * sz.pct * zf / HT; at(bx, by + hop, pl.lean + (1 - mk) * .8, s * mk, s * breath * mk, () => beast(o)); }
    ctx.restore();
  }
  // the margouillat (S23): pops out of the crumpled bête, nods, hops onto the exiting truck and rides out
  function drawLizard(t, n) {
    const S0 = st(); if (t < S0.morph0 + .1) return;
    const c = containerAt(t); if (t > S0.hop1 && !c) return;
    const A = window.A20_CONT || { h: 360, top: 18, deck: 110 }, L = 72;
    const x0 = X.barriere + 260, y0 = GROUND - 36;
    ctx.save(); worldBegin(t);
    let x = x0, y = y0, face = -1, rot = 0, sc = eOutBack(prog(t, S0.morph0 + .1, S0.morph1 + .15), 2.2);
    const hf = eOutCubic(prog(t, S0.morph1 - .05, S0.morph1 + .3));
    const nod = t > S0.nod0 && t < S0.nod1 ? Math.abs(Math.sin(prog(t, S0.nod0, S0.nod1) * Math.PI * 3)) : 0;
    if (t >= S0.hop0) {
      const tc = containerAt(Math.min(t, S0.hop1)) || { x: X.barriere }, x1 = tc.x + 70, y1 = GROUND - A.deck - A.h - A.top * .5;
      const p = prog(t, S0.hop0, S0.hop1), e = Math.sin(p * Math.PI / 2);
      x = lerp(x0, x1, e); y = lerp(y0, y1, p) - 4 * 170 * p * (1 - p); rot = lerp(.5, 0, p) * (p < 1 ? 1 : 0);
      if (t >= S0.hop1 && c) { x = c.x + 70; y = y1 + (c.moving ? Math.abs(Math.sin(stepT(n) * 14)) * -3 : 0); face = t > S0.hop1 + .12 ? 1 : lerp(-1, 1, prog(t, S0.hop1, S0.hop1 + .12)); }
    }
    at(x, y, rot, face * sc, sc, () => lizard(L, { n, nod, turn: 0, headFold: hf, run: 0 }));
    ctx.restore();
  }

  registerScene({ id: 'B44_bete', z: 16, draw(t, n) { st(); ev(); drawBete(t, n); } });
  registerScene({ id: 'B44_lizard', z: 39, draw(t, n) { drawLizard(t, n); } });
})();

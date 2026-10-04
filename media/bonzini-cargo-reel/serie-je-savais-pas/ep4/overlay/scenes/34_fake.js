'use strict';
// =============================================================================================
// M1 « TA COMMANDE & the fake message » · 34_fake.js — the fake message, its fall, the margouillat's snack.
// Functions only (no registerScene). Reads SCORE (01_score.js), the light API (02_light.js), PL_noise / PL_tintAt
// (30_plates.js) and K_mouth (40_gecko.js) when they exist.
//
//   CM_bubble(b, t, L)   b = SCORE.bubble(t). A bottle-green LACQUERED plate shaped like a message bubble (a tail at the
//                        bottom left; NO real app UI). At rest ONE baked sprite (its soft cast shadow, its 14 px thickness, a
//                        ghosted feyman wax motif in the lacquer, a raised mustard bead rim, the bulb's falloff and the clear
//                        coat's broad sheen); while it falls from above the frame (A.bubble − .22 → A.bubble) the shadow
//                        gathers at the landing spot. Live on top: the bulb's hard reflection (follows the sway), the 3 lines
//                        (Satoshi 900 ≈ 64 px, cream, inlaid), three glossy candy hearts popping at A.hearts (b.hearts, a
//                        sparkle each) and beating at « cœurs » (b.pulse, pink glow). The blurred account field « •••• •••• »
//                        is baked. Trembles on twos (b.shake), squeezes under the steel at A.stamp, three cracks glowing
//                        orange (white-hot running tips, branches) grow from the top centre (b.crack). Not drawn once b.broken.
//   CM_fake(pq, t, L)    pq = SCORE.pillQ(t). Takes over 'pillQ' and 'pas'. The sender's sticker « « TON FOURNISSEUR » ? »
//                        (44 px, die-cut white margin, near-black green vinyl, mustard rim, cream text, the « ? » orange)
//                        slaps onto the bubble's top-left edge at A.pillQ and rides it (tremble included). From A.shatter it
//                        is drawn by CM_fx ('over', above the flying debris): knocked into the air it drifts to the middle
//                        (x G.cx, y G.fauxY − 120: under the steel plate, above « FAUX MESSAGE ») while the steel still
//                        covers it, then PEELS like a sticker (pq.peel: a slanted fold sweeps left → right, the flap shows
//                        its paper back, then flutters away) revealing the orange pill « PAS TON FOURNISSEUR » (52 px,
//                        « PAS » first), held to A.rule.
//   CM_fx(t, L, layer)   'under' (on the cloth, before the plates): the shadows of the flying pieces and the pieces that came
//                        to rest. 'over' (above the world): the bubble's landing dust (A.bubble), the steel stamp's dust and
//                        the orange sparks of the cracks / the shatter, the pieces in the air, the hearts (always above: they
//                        roll in front of the parcel), the stamp's shock ring, the sticker, then « FAUX MESSAGE ».
//                        Takes over 'faux'.
//     · the SHATTER (A.shatter), driven by the slow clock SCORE.slow(t, A.shatter) (×0.5 until A.slow1): the plate breaks
//       along its cracks into a fan of jagged lacquer shards (8 sectors × 5 rings around the impact, clipped to the plate,
//       sharing their edges: the three cracks ARE three of the fan's rays) whose sides glow hot at first; they burst out
//       (jump at us, tumble, some flip over, bounce, slide) and are gone by story-τ .78. The message breaks into chips of
//       1–2 letters (debris, never a word) that skitter in decreasing hops to the margouillat and settle smaller beside
//       him (all left of x 720). The 3 hearts skitter the same way and land on G.heartRest exactly at A.roll[i] (the
//       « clink »), rolling an exact number of turns (they end upright).
//     · heart 0 is GULPED at A.gulp: a little hop into K_mouth(t) over [A.gulp − .15, A.gulp], gone at A.gulp + .04.
//       Hearts 1–2 deflate before A.cont; the letters fade over [A.rule − .1, A.rule + .4] (THE RULE stays alone).
//     · « FAUX MESSAGE » (SCORE.fauxStamp(t), drawn 40 px under fs.y so it clears the sticker): a starved orange rubber
//       stamp, double frame, 104 px, slammed from the camera (k: scale 1.65 → 1), ink flare, shock ring, ink specks, dust;
//       a dark baked halo keeps it readable on the night; held to A.rule.
// All motion = closed-form functions of t (sub-frames interpolate cleanly). Deterministic (rnd with fixed seeds), no
// ctx.filter: blurs are pushed shadows baked into sprites. Perf notes (this software Chromium): a rotated drawImage costs
// ≈ 0.3 ms and stroking a jagged path ≈ 3× filling it, so the debris is vector and BATCHED (one Path2D per material: ≈ 8
// fills for ~60 pieces) and the stamp is baked at its angle. Sprites build lazily (≈ 60 ms once per page). Cost per
// sub-frame: bubble ≈ 2–3 ms (≈ 6 ms while the cracks glow), the fall ≈ 12–20 ms at its peak (A.shatter → +1 s), < 1 ms
// otherwise.
// =============================================================================================
const CM_F = (function () {
  const S = window.SCORE, G = S.G, A = S.A, T = S.T, TAU = Math.PI * 2;
  const B = G.bubble, BW = B.w, BH = B.h, BR = 54, SS = 1;
  const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
  const sst = x => { x = cl(x); return x * x * (3 - 2 * x); };
  const eo = x => 1 - Math.pow(1 - cl(x), 3);
  const mix = (a, b, k) => a + (b - a) * k;
  const R = (i, s = 0) => rnd(i * 7.31 + s * 113.17 + 1.7);
  const q2 = t => Math.floor(Math.round(t * 30) / 2);          // on twos (the sub-frames of one frame agree)
  const has = n => typeof window[n] === 'function';
  const CREAM = '#FFF3D6', ORANGE = '#FE560D', MUSTARD = '#D9A21E', INKG = '#0B2016';
  const FONT = (z, w = 900) => `${w} ${z}px Satoshi`;
  // sprite bounds of the bubble (local coords, centre of the plate = 0, 0): the tail hangs below
  const X0 = -BW / 2 - 12, Y0 = -BH / 2 - 12, SW = BW + 24, SH = BH + 108;
  const DEP = { x: 1.8, y: 14 };                                 // the plate's thickness (baked: the bulb is above, a little left)
  const ROW_Y = BH / 2 - 60;                                     // the bottom row: account field (left), hearts (right)
  const PAD = 56;                                                // text margin

  // =============================================================================================
  // GEOMETRY
  // =============================================================================================
  /** the bubble's outline (rounded plate + a tail at the bottom left), inset by i */
  function outline(g, i = 0) {
    const w = BW / 2 - i, h = BH / 2 - i, r = Math.max(4, BR - i), xl = -BW / 2;
    g.moveTo(-w + r, -h); g.lineTo(w - r, -h); g.arcTo(w, -h, w, -h + r, r);
    g.lineTo(w, h - r); g.arcTo(w, h, w - r, h, r);
    g.lineTo(xl + 168 - i * .4, h);
    g.bezierCurveTo(xl + 120 - i * .2, h + 4, xl + 70 + i * .3, h + 30 - i * .9, xl + 26 + i * 1.6, h + 70 - i * 2.1);   // the tail's tip
    g.bezierCurveTo(xl + 52 + i * .6, h + 44 - i * 1.4, xl + 62 + i * .3, h + 22 - i, xl + 64 + i * .2, h);
    g.lineTo(-w + r, h); g.arcTo(-w, h, -w, h - r, r);
    g.lineTo(-w, -h + r); g.arcTo(-w, -h, -w + r, -h, r); g.closePath();
  }
  function heartPath(g, x, y, r) {
    g.moveTo(x, y + r * .92);
    g.bezierCurveTo(x - r * 1.32, y + r * .12, x - r * 1.12, y - r * 1.02, x, y - r * .36);
    g.bezierCurveTo(x + r * 1.12, y - r * 1.02, x + r * 1.32, y + r * .12, x, y + r * .92); g.closePath();
  }
  /** where heart i sits on the bubble (local) */
  const heartOn = i => ({ x: BW / 2 - 74 - (2 - i) * 70, y: ROW_Y + 2 });

  // ---------- text layout (measured once the fonts are in) ----------
  let LAY = null;
  function layout() {
    if (LAY) return LAY;
    const g = makeCanvas(8, 8).getContext('2d'); g.letterSpacing = '0px';
    let z = 68; g.font = FONT(z);
    const maxW = BW - 2 * PAD - 4, wm = Math.max(...S.MSG.map(l => g.measureText(l).width));
    if (wm > maxW) z = Math.floor(z * maxW / wm);
    g.font = FONT(z);
    const cap = g.measureText('H').actualBoundingBoxAscent, lh = Math.round(z * 1.12);
    const top = -BH / 2 + 34, bot = ROW_Y - 34, blockH = cap + 2 * lh, y1 = top + (bot - top - blockH) / 2 + cap;
    const x0 = -BW / 2 + PAD;
    const lines = S.MSG.map((s, i) => ({ s, y: y1 + i * lh }));
    const glyphs = [];
    lines.forEach((L1, li) => {
      for (let k = 0; k < L1.s.length; k++) {
        const ch = L1.s[k]; if (ch === ' ') continue;
        const xa = g.measureText(L1.s.slice(0, k)).width, xb = g.measureText(L1.s.slice(0, k + 1)).width, m = g.measureText(ch);
        glyphs.push({ ch, li, k, x0: x0 + xa, w: xb - xa, base: L1.y, asc: Math.max(cap, m.actualBoundingBoxAscent), desc: Math.max(0, m.actualBoundingBoxDescent) });
      }
    });
    return (LAY = { z, cap, lh, x0, lines, glyphs });
  }

  // =============================================================================================
  // SPRITES (built once)
  // =============================================================================================
  let FACE = null;
  function waxMotif(g) {
    // the feyman's wax, ghosted in the lacquer: rings, seeds and dots (low contrast, never fights the text)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
      const cx = -BW / 2 + 40 + c * 128 + (r % 2) * 64, cy = -BH / 2 + 30 + r * 118;
      g.lineWidth = 7; g.strokeStyle = 'rgba(150,235,180,.055)'; g.beginPath(); g.arc(cx, cy, 44, 0, TAU); g.stroke();
      g.lineWidth = 4; g.strokeStyle = 'rgba(232,180,50,.07)'; g.beginPath(); g.arc(cx, cy, 28, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(232,180,50,.06)'; g.beginPath(); g.arc(cx, cy, 11, 0, TAU); g.fill();
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + r; g.fillStyle = 'rgba(150,235,180,.05)'; g.beginPath(); g.arc(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58, 4, 0, TAU); g.fill(); }
    }
  }
  function accountField(g) {
    const x = -BW / 2 + PAD - 6, w = 300, h = 54, y = ROW_Y - h / 2;
    g.save();
    g.fillStyle = 'rgba(2,18,9,.62)'; g.beginPath(); rrectOn(g, x, y, w, h, h / 2); g.fill();
    g.save(); g.beginPath(); rrectOn(g, x, y, w, h, h / 2); g.clip();               // inset: dark lip on top, a lit lip below
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 5; g.beginPath(); rrectOn(g, x - 1, y + 1.5, w + 2, h + 6, h / 2); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(170,240,200,.16)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x + h / 2, y + h - .5); g.lineTo(x + w - h / 2, y + h - .5); g.stroke();
    // the account number, blurred (no figure, no name): pushed shadows only (no ctx.filter)
    g.font = '700 40px Martian'; g.textBaseline = 'middle'; g.textAlign = 'center'; g.letterSpacing = '0px';
    const push = 6000;
    for (const [bl, a] of [[11, .9], [5, .55]]) {
      g.save(); g.shadowColor = `rgba(255,240,212,${a})`; g.shadowBlur = bl * SS; g.shadowOffsetX = push * SS; g.fillStyle = '#000';
      g.fillText('•••• ••••', x + w / 2 - push, y + h / 2 + 2); g.restore();
    }
    g.restore();
  }
  function buildFace() {
    if (FACE) return FACE;
    const c = makeCanvas(Math.ceil(SW * SS), Math.ceil(SH * SS)), g = c.getContext('2d');
    g.scale(SS, SS); g.translate(-X0, -Y0);
    for (let i = 12; i >= 1; i--) {                                                   // the lacquered slab's side
      const f = i / 12, c0 = [18, 66, 38], c1 = [4, 24, 13];
      g.fillStyle = `rgb(${mix(c0[0], c1[0], f) | 0},${mix(c0[1], c1[1], f) | 0},${mix(c0[2], c1[2], f) | 0})`;
      g.save(); g.translate(DEP.x * f, DEP.y * f); g.beginPath(); outline(g, 0); g.fill(); g.restore();
    }
    g.save(); g.translate(DEP.x, DEP.y); g.beginPath(); g.moveTo(-BW / 2 + BR, BH / 2 - .8); g.lineTo(BW / 2 - BR, BH / 2 - .8);
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(120,200,150,.3)'; g.stroke(); g.restore();
    g.save(); g.beginPath(); outline(g, 0); g.clip();
    let gr = g.createLinearGradient(0, -BH / 2, 0, BH / 2 + 70);
    gr.addColorStop(0, '#2F8A5B'); gr.addColorStop(.42, '#1F6142'); gr.addColorStop(1, '#0D3A23');
    g.fillStyle = gr; g.fillRect(X0, Y0, SW, SH);
    waxMotif(g);
    if (typeof PL_noise === 'function') {                                            // orange-peel of thick lacquer
      g.globalCompositeOperation = 'overlay'; g.globalAlpha = .14;
      g.drawImage(PL_noise(Math.ceil(SW * SS / 2), Math.ceil(SH * SS / 2), 41, 46), X0, Y0, SW, SH);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    }
    const vg = g.createRadialGradient(0, -24, BH * .32, 0, -24, BW * .64);              // the lacquer pools darker at the edges
    vg.addColorStop(0, 'rgba(0,16,7,0)'); vg.addColorStop(1, 'rgba(0,16,7,.46)'); g.fillStyle = vg; g.fillRect(X0, Y0, SW, SH);
    const lb = g.createLinearGradient(0, BH * .1, 0, BH / 2);                            // a cooler reflection low on the face
    lb.addColorStop(0, 'rgba(120,220,170,0)'); lb.addColorStop(.7, 'rgba(120,220,170,.05)'); lb.addColorStop(1, 'rgba(120,220,170,0)'); g.fillStyle = lb; g.fillRect(X0, BH * .1, SW, BH);
    accountField(g);
    g.restore();
    // the raised mustard bead along the rim, its dark bed, its groove and its highlight
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); outline(g, 15); g.strokeStyle = 'rgba(0,10,4,.42)'; g.lineWidth = 15; g.stroke();
    gr = g.createLinearGradient(0, -BH / 2, 0, BH / 2 + 50);
    gr.addColorStop(0, '#FFE58A'); gr.addColorStop(.3, '#E8B53A'); gr.addColorStop(.62, '#C08A16'); gr.addColorStop(1, '#7E540A');
    g.beginPath(); outline(g, 14); g.strokeStyle = gr; g.lineWidth = 10; g.stroke();
    const hl = g.createLinearGradient(0, -BH / 2, 0, BH / 2);
    hl.addColorStop(0, 'rgba(255,250,220,.85)'); hl.addColorStop(.45, 'rgba(255,250,220,.15)'); hl.addColorStop(1, 'rgba(255,250,220,0)');
    g.beginPath(); outline(g, 11.8); g.strokeStyle = hl; g.lineWidth = 2.2; g.stroke();
    g.beginPath(); outline(g, 20.5); g.strokeStyle = 'rgba(0,12,5,.38)'; g.lineWidth = 2; g.stroke();
    // the plate's own bevel: lit top edge, dark bottom edge
    const bv = g.createLinearGradient(0, -BH / 2, 0, BH / 2 + 60);
    bv.addColorStop(0, 'rgba(220,255,235,.55)'); bv.addColorStop(.35, 'rgba(220,255,235,.08)'); bv.addColorStop(.6, 'rgba(0,0,0,.05)'); bv.addColorStop(1, 'rgba(0,0,0,.5)');
    g.beginPath(); outline(g, 1.6); g.strokeStyle = bv; g.lineWidth = 3.2; g.stroke();
    g.restore();
    return (FACE = c);
  }
  // ---------- the hearts: glossy candy (sprite + its thickness) ----------
  let HEART = null; const HR = 25, HSS = 1.6;
  function buildHeart() {
    if (HEART) return HEART;
    const n = Math.ceil(HR * 3.2 * HSS), mk = () => { const c = makeCanvas(n, n), g = c.getContext('2d'); g.scale(HSS, HSS); g.translate(HR * 1.6, HR * 1.6); return [c, g]; };
    const [c, g] = mk();
    g.beginPath(); heartPath(g, 0, 0, HR);
    let rg = g.createRadialGradient(-HR * .38, -HR * .42, HR * .1, 0, 0, HR * 1.25);
    rg.addColorStop(0, '#FF8FA0'); rg.addColorStop(.35, '#FF3D5E'); rg.addColorStop(.78, '#D3143A'); rg.addColorStop(1, '#8E0A24');
    g.fillStyle = rg; g.fill();
    g.save(); g.clip();
    rg = g.createLinearGradient(0, HR * .2, 0, HR); rg.addColorStop(0, 'rgba(255,120,150,0)'); rg.addColorStop(1, 'rgba(255,150,170,.35)'); g.fillStyle = rg; g.fillRect(-HR * 2, -HR * 2, HR * 4, HR * 4);   // rim light below
    g.restore();
    g.lineWidth = 1.6; g.strokeStyle = 'rgba(80,4,20,.85)'; g.stroke();
    g.save(); g.translate(-HR * .42, -HR * .38); g.rotate(-.6); g.scale(1, .55);           // candy highlights
    rg = g.createRadialGradient(0, 0, 0, 0, 0, HR * .36); rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(.5, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(-HR, -HR, 2 * HR, 2 * HR); g.restore();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(HR * .38, -HR * .46, HR * .09, 0, TAU); g.fill();
    const [s, gs] = mk(); gs.beginPath(); heartPath(gs, 0, 0, HR); gs.fillStyle = '#5C0618'; gs.fill();
    const [h, gh] = mk(); gh.beginPath(); heartPath(gh, 0, 0, HR); gh.fillStyle = '#000'; gh.shadowColor = 'rgba(255,90,140,1)'; gh.shadowBlur = 14 * HSS; gh.shadowOffsetX = 4000 * HSS; gh.translate(-4000, 0); gh.beginPath(); heartPath(gh, 0, 0, HR); gh.fill();
    return (HEART = { c, s, h, n, o: HR * 1.6 });
  }
  /** a heart at (x, y) (its centre), scale sc, rotation rot; glow 0..1 (pink halo); flat = its thickness towards us */
  function drawHeart(x, y, sc, rot, glow = 0, al = 1) {
    if (sc <= .01 || al <= .01) return;
    const H = buildHeart(), sz = H.n / HSS, o = H.o;
    ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
    if (glow > .01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= glow * .9; ctx.drawImage(H.h, -o, -o, sz, sz); ctx.restore(); }
    ctx.drawImage(H.s, -o + 1.2, -o + 4, sz, sz);                                           // its candy thickness
    ctx.drawImage(H.c, -o, -o, sz, sz);
    ctx.restore();
  }
  // ---------- dust: one baked cloud ----------
  let PUFF = null;
  function buildPuff() {
    if (PUFF) return PUFF;
    const c = makeCanvas(96, 96), g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 48 + (R(i, 31) - .5) * 30, y = 48 + (R(i, 32) - .5) * 26, r = 16 + R(i, 33) * 18;
      const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(236,224,204,.42)'); rg.addColorStop(1, 'rgba(236,224,204,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 96, 96);
    }
    return (PUFF = c);
  }
  /** dust puffs from emitters [{x, y, nx, ny}] (outward normals); k 0..1 = life */
  function puffs(ems, k, L, seed = 0, size = 1) {
    if (k <= 0 || k >= 1) return;
    const P0 = buildPuff(), grow = 1 - Math.pow(1 - k, 2.2), fade = Math.pow(1 - k, 1.3) * cl(k * 10);
    ctx.save();
    ems.forEach((e, i) => {
      const sp = .5 + .7 * R(i, seed + 1), d = (14 + 70 * sp * grow) * size, r = (34 + 46 * grow * (.6 + .6 * R(i, seed + 2))) * size;
      const x = e.x + e.nx * d + (R(i, seed + 3) - .5) * 20, y = e.y + e.ny * d * .7 - 18 * grow * R(i, seed + 4);
      const lk = lightAt(x, y, L).k; ctx.globalAlpha = fade * (.45 + .55 * lk) * (.6 + .4 * R(i, seed + 5));
      ctx.drawImage(P0, x - r, y - r, 2 * r, 2 * r);
    });
    ctx.restore();
  }

  // =============================================================================================
  // THE BUBBLE (live)
  // =============================================================================================
  const tintAt = (x, y, L) => typeof PL_tintAt === 'function' ? PL_tintAt(x, y, L) : [1, 1, 1];
  const rgbm = (c, a = 1) => `rgba(${cl(c[0] * 255, 0, 255) | 0},${cl(c[1] * 255, 0, 255) | 0},${cl(c[2] * 255, 0, 255) | 0},${a})`;
  /** soft cast shadow of the plate (baked once at half resolution: a pushed shadowBlur, no ctx.filter) */
  let SHAD = null; const SHS = .5, SHM = 70;
  function buildShadow() {
    if (SHAD) return SHAD;
    const w = BW + 2 * SHM, h = BH + 2 * SHM + 70, c = makeCanvas(Math.ceil(w * SHS), Math.ceil(h * SHS)), g = c.getContext('2d');
    g.scale(SHS, SHS); g.translate(w / 2, BH / 2 + SHM);
    g.shadowColor = 'rgba(6,3,14,1)'; g.shadowBlur = 22 * SHS; g.shadowOffsetX = 9000 * SHS; g.translate(-9000, 0);
    g.fillStyle = '#000'; g.beginPath(); outline(g, 0); g.fill();
    return (SHAD = { c, w, h, ox: -w / 2, oy: -(BH / 2 + SHM) });
  }
  /** cast shadow at the landing spot: gathers and sharpens while the plate falls from above the frame */
  function plateBody(P, hgt, L) {
    const q = lightAt(P.x, B.y, L), z = 10 + hgt * .6, o = shadowOff(P.x, B.y, z, L);
    const a = (.62 * Math.max(q.k, .35) + .2) * (1 - Math.min(.9, hgt / 1000)), grow = 1 + hgt * .0005, SD = buildShadow();
    ctx.save(); ctx.globalAlpha *= Math.min(.95, a); ctx.translate(P.x + o.x + DEP.x * .6, B.y + o.y + DEP.y * .6); if (P.rot) ctx.rotate(P.rot); ctx.scale(P.sx * grow, P.sy * grow);
    ctx.drawImage(SD.c, SD.ox, SD.oy, SD.w, SD.h); ctx.restore();
  }
  function lightPass(P, L) {
    const tn = tintAt(P.x, P.y, L), t2 = tintAt(P.x + 300, P.y + 150, L), t3 = tintAt(P.x - 320, P.y - 160, L);
    ctx.save(); ctx.beginPath(); outline(ctx, 0); ctx.clip(); ctx.globalCompositeOperation = 'multiply';
    const gr = ctx.createLinearGradient(-BW / 2, -BH / 2, BW / 2, BH / 2); gr.addColorStop(0, rgbm(t3)); gr.addColorStop(.5, rgbm(tn)); gr.addColorStop(1, rgbm(t2));
    ctx.fillStyle = gr; ctx.fillRect(X0, Y0, SW, SH); ctx.restore();
  }
  /** the bulb's hard reflection near the top edge (live: it follows the sway; small, so no clip) */
  function gloss(P, L, k = 1) {
    const lx = cl(L.x - P.x, -200, 200), on = k * L.on * (.6 + .4 * lightAt(P.x, P.y, L).k);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(lx * .55, -BH / 2 + 31); ctx.scale(1, .19);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 130);
    rg.addColorStop(0, `rgba(255,250,232,${(.62 * on).toFixed(3)})`); rg.addColorStop(.18, `rgba(255,242,205,${(.3 * on).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = rg; ctx.fillRect(-130, -130, 260, 260); ctx.restore();
  }
  /** the plate at rest, baked once: its soft cast shadow, its thickness, the face lit by the bulb (a static falloff
   *  across the plate) and the broad sheen of the clear coat. One drawImage a frame (≈ 3 ms instead of ≈ 10). */
  let BODY = null; const BX0 = X0 - 44, BY0 = Y0 - 24, BSW = SW + 104, BSH = SH + 76;
  function buildBody() {
    if (BODY) return BODY;
    const L = S.light(A.bubble + 1.3), F = buildFace(), SD = buildShadow(), c = makeCanvas(BSW, BSH), g = c.getContext('2d');
    g.translate(-BX0, -BY0);
    const q = lightAt(B.x, B.y, L), o = shadowOff(B.x, B.y, 10, L), a = Math.min(.95, .62 * Math.max(q.k, .35) + .2);
    g.globalAlpha = a; g.drawImage(SD.c, o.x + DEP.x * .6 + SD.ox, o.y + DEP.y * .6 + SD.oy, SD.w, SD.h); g.globalAlpha = 1;
    // the face, lit (multiply clipped to the plate + its thickness), then the clear coat's broad sheen
    const L2 = makeCanvas(Math.ceil(SW), Math.ceil(SH)), l2 = L2.getContext('2d'); l2.translate(-X0, -Y0); l2.drawImage(F, X0, Y0, SW, SH);
    const tn = tintAt(B.x, B.y, L), t2 = tintAt(B.x + 300, B.y + 150, L), t3 = tintAt(B.x - 320, B.y - 160, L);
    l2.globalCompositeOperation = 'multiply';
    const gr = l2.createLinearGradient(-BW / 2, -BH / 2, BW / 2, BH / 2); gr.addColorStop(0, rgbm(t3)); gr.addColorStop(.5, rgbm(tn)); gr.addColorStop(1, rgbm(t2));
    l2.fillStyle = gr; l2.fillRect(X0, Y0, SW, SH);
    l2.globalCompositeOperation = 'destination-in'; l2.drawImage(F, X0, Y0, SW, SH);
    l2.globalCompositeOperation = 'source-over';
    l2.save(); l2.beginPath(); outline(l2, 0); l2.clip(); l2.globalCompositeOperation = 'lighter';
    l2.translate((L.x - B.x) * .32, -BH * .3); l2.scale(1, .3);
    const rg = l2.createRadialGradient(0, 0, 0, 0, 0, BW * .56), on = L.on * (.6 + .4 * q.k);
    rg.addColorStop(0, `rgba(170,255,205,${(.13 * on).toFixed(3)})`); rg.addColorStop(.6, `rgba(150,240,190,${(.045 * on).toFixed(3)})`); rg.addColorStop(1, 'rgba(150,240,190,0)');
    l2.fillStyle = rg; l2.fillRect(-BW, -BW, 2 * BW, 2 * BW); l2.restore();
    g.drawImage(L2, X0, Y0, SW, SH);
    return (BODY = c);
  }
  function text(lay, L) {
    ctx.save(); ctx.font = FONT(lay.z); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    ctx.fillStyle = 'rgba(1,14,6,.6)'; for (const l of lay.lines) ctx.fillText(l.s, lay.x0 + 1.2, l.y + 4);          // inlaid: dark seat
    ctx.fillStyle = 'rgba(170,240,200,.22)'; for (const l of lay.lines) ctx.fillText(l.s, lay.x0 - .6, l.y - 1.6);   // lit lip above
    ctx.fillStyle = CREAM; for (const l of lay.lines) ctx.fillText(l.s, lay.x0, l.y);
    ctx.restore();
  }
  function heartsOn(b, t) {
    for (let i = 0; i < 3; i++) {
      const k = b.hearts[i]; if (k <= 0) continue;
      const p = heartOn(i), pop = S.backOut(k, 3), beat = 1 + .34 * b.pulse;
      drawHeart(p.x, p.y - 4 * b.pulse, (.3 + .7 * pop) * beat, (i - 1) * .08 * (1 - k), b.pulse);
      const sp = kk(t, A.hearts[i], A.hearts[i] + .35);                     // a pop of sparkles
      if (sp > 0 && sp < 1) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 6; j++) {
          const a = j / 6 * TAU + i, d = 26 + 30 * eo(sp), r = 3.2 * (1 - sp);
          ctx.fillStyle = `rgba(255,${200 + 40 * (j % 2)},${215},${(1 - sp).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  // ---------- the fan of breaks: 8 sectors × 5 rings around the impact (top centre); 3 rays = the 3 glowing cracks ----------
  const RAYS = [-5, 20, 42, 64, 90, 116, 138, 160, 185].map(d => d * Math.PI / 180);
  const RINGS = [0, 85, 185, 300, 440, 700];
  const CRACKS = [4, 5, 3];                                  // straight down first, then down-left, down-right
  const O = { x: 0, y: -BH / 2 + 4 };
  const nz = (i, x) => { const xi = Math.floor(x), f = x - xi, u = f * f * (3 - 2 * f); return mix(R(i * 977 + xi, 5), R(i * 977 + xi + 1, 5), u) * 2 - 1; };
  const jagRay = (j, r) => nz(j + 11, r / 21) * 10 * Math.min(1, r / 40);
  const jagRing = (i, a) => i === 0 ? 0 : nz(i + 51, a * 8) * 15;
  function rayPt(j, rho) { const a = RAYS[j], dx = Math.cos(a), dy = Math.sin(a), o = jagRay(j, rho); return { x: O.x + dx * rho - dy * o, y: O.y + dy * rho + dx * o }; }
  const ringR = (i, a) => RINGS[i] + jagRing(i, a);
  const corner = (i, j) => rayPt(j, ringR(i, RAYS[j]));
  function raySeg(j, i0, i1) {
    const r0 = ringR(i0, RAYS[j]), r1 = ringR(i1, RAYS[j]), n = Math.max(1, Math.round(Math.abs(r1 - r0) / 15)), pts = [];
    for (let k = 1; k <= n; k++) pts.push(rayPt(j, mix(r0, r1, k / n)));
    return pts;
  }
  function ringSeg(i, j0, j1) {
    if (i === 0) return [corner(0, j1)];
    const a0 = RAYS[j0], a1 = RAYS[j1], n = Math.max(1, Math.round(Math.abs(a1 - a0) * RINGS[i] / 17)), pts = [];
    for (let k = 1; k < n; k++) { const a = mix(a0, a1, k / n), r = ringR(i, a); pts.push({ x: O.x + Math.cos(a) * r, y: O.y + Math.sin(a) * r }); }
    pts.push(corner(i, j1)); return pts;
  }
  function cellPoly(i, j) { return [corner(i, j), ...ringSeg(i, j, j + 1), ...raySeg(j + 1, i, i + 1), ...ringSeg(i + 1, j + 1, j), ...raySeg(j, i + 1, i).slice(0, -1)]; }
  // the three cracks, as polylines (local), each with its length and two short branches
  let CRK = null;
  function crackData() {
    if (CRK) return CRK;
    CRK = CRACKS.map((j, ci) => {
      const pts = []; for (let r = 0; r <= 700; r += 12) pts.push(rayPt(j, r));
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      // stop where the ray leaves the plate
      let n = pts.length; for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (Math.abs(p.x) > BW / 2 - 4 || p.y > BH / 2 - 4) { n = i + 1; break; } }
      const br = [.34, .62].map((f, bi) => {
        const k = Math.max(1, Math.round(f * (n - 1))), p = pts[k], a = RAYS[j] + (bi ? -1 : 1) * (.7 + .3 * R(ci * 3 + bi, 61)), l = 46 + 34 * R(ci * 3 + bi, 62), q = [p];
        for (let s = 1; s <= 4; s++) q.push({ x: p.x + Math.cos(a) * l * s / 4 + (R(ci * 9 + bi * 4 + s, 63) - .5) * 9, y: p.y + Math.sin(a) * l * s / 4 + (R(ci * 9 + bi * 4 + s, 64) - .5) * 9 });
        return { pts: q, at: f };
      });
      return { pts: pts.slice(0, n), cum: cum.slice(0, n), len: cum[n - 1], delay: ci * .12, br };
    });
    return CRK;
  }
  /** a polyline up to length Lp */
  function polyTo(pts, cum, Lp) {
    ctx.moveTo(pts[0].x, pts[0].y); let tip = pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (cum[i] >= Lp) { const f = (Lp - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); tip = { x: mix(pts[i - 1].x, pts[i].x, f), y: mix(pts[i - 1].y, pts[i].y, f) }; ctx.lineTo(tip.x, tip.y); return tip; }
      ctx.lineTo(pts[i].x, pts[i].y); tip = pts[i];
    }
    return null;
  }
  function cracks(k, t) {
    const D = crackData(), tips = [], heat = .85 + .15 * Math.sin(t * 37);
    const path = () => {
      for (const c of D) {
        const p = eo(cl((k - c.delay) / (1 - c.delay))); if (p <= 0) continue;
        const tip = polyTo(c.pts, c.cum, p * c.len); if (tip && p < 1) tips.push(tip);
        for (const b of c.br) { const pb = cl((p - b.at) / .3); if (pb <= 0) continue; const cb = [0]; for (let i = 1; i < b.pts.length; i++) cb.push(cb[i - 1] + Math.hypot(b.pts[i].x - b.pts[i - 1].x, b.pts[i].y - b.pts[i - 1].y)); polyTo(b.pts, cb, pb * cb[cb.length - 1]); }
      }
    };
    ctx.save(); ctx.beginPath(); outline(ctx, 0); ctx.clip(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); tips.length = 0; path(); ctx.strokeStyle = 'rgba(2,10,5,.92)'; ctx.lineWidth = 7; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[24, .12], [9, .36]]) { ctx.strokeStyle = `rgba(255,86,16,${(a * heat).toFixed(3)})`; ctx.lineWidth = w; ctx.stroke(); }
    ctx.strokeStyle = `rgba(255,214,160,${(.95 * heat).toFixed(3)})`; ctx.lineWidth = 2.4; ctx.stroke();
    for (const p of tips) {
      const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22); rg.addColorStop(0, 'rgba(255,246,225,1)'); rg.addColorStop(.3, 'rgba(255,130,40,.6)'); rg.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = rg; ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
    }
    ctx.restore();
    return tips;
  }
  /** the bubble's pose at t (with the tremble on twos and the squeeze under the steel) */
  function bubblePose(b, t) {
    let x = b.x, y = b.y, sx = b.s * b.sx, sy = b.s * b.sy;
    if (b.shake > 0) { const n = q2(t); x += (R(n, 1) - .5) * 10 * b.shake; y += (R(n, 2) - .5) * 6 * b.shake; }
    if (t >= A.stamp) { const d = t - A.stamp, q = Math.exp(-d * 9) * Math.cos(d * 30) * .05; sx *= 1 + q * .6; sy *= 1 - q; }
    return { x, y, rot: b.rot || 0, sx, sy };
  }
  function drawBubble(b, t, L) {
    if (!b || b.broken || (b.a ?? 1) <= 0) return;
    const lay = layout(), P = bubblePose(b, t), hgt = Math.max(0, B.y - P.y), gs = 1 + hgt * .00035;
    ctx.save(); ctx.globalAlpha *= b.a ?? 1;
    if (hgt > .5) {                                                         // still falling from above the frame
      plateBody(P, hgt, L);
      ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot); ctx.scale(P.sx * gs, P.sy * gs); ctx.drawImage(buildFace(), X0, Y0, SW, SH); lightPass(P, L); ctx.restore();
    } else { ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot); ctx.scale(P.sx, P.sy); ctx.drawImage(buildBody(), BX0, BY0, BSW, BSH); ctx.restore(); }
    ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot); ctx.scale(P.sx * gs, P.sy * gs);
    gloss(P, L, 1 - .6 * cl(b.crack * 2));
    text(lay, L);
    heartsOn(b, t);
    if (b.crack > 0) cracks(b.crack, t);
    ctx.restore();
    ctx.restore();
  }

  // =============================================================================================
  // THE SHATTER — pieces, drawn as vectors (a rotated drawImage costs ≈ 0.3 ms here, a polygon fill ≈ 0.06 ms)
  // =============================================================================================
  let PIECES = null;
  /** the plate's convex body (rounded rect, no tail) as a polygon, clockwise on screen */
  function rrPoly(n = 8) {
    const pts = [], w = BW, h = BH, r = BR, c = [[w / 2 - r, -h / 2 + r, -Math.PI / 2], [w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI]];
    for (const [cx, cy, a0] of c) for (let k = 0; k <= n; k++) { const a = a0 + k / n * Math.PI / 2; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
    return pts;
  }
  /** Sutherland–Hodgman: any polygon clipped by a convex one */
  function clipConvex(subj, clip) {
    let out = subj;
    for (let i = 0; i < clip.length && out.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], inp = out; out = [];
      const side = p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      for (let j = 0; j < inp.length; j++) {
        const P = inp[j], Q = inp[(j + 1) % inp.length], sp = side(P), sq = side(Q);
        if (sp >= 0) out.push(P);
        if ((sp >= 0) !== (sq >= 0)) { const f = sp / (sp - sq); out.push({ x: P.x + (Q.x - P.x) * f, y: P.y + (Q.y - P.y) * f }); }
      }
    }
    return out;
  }
  function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q.x * r.y - r.x * q.y; } return a / 2; }
  function polyCentroid(p) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length], c = q.x * r.y - r.x * q.y; a += c; cx += (q.x + r.x) * c; cy += (q.y + r.y) * c; }
    return Math.abs(a) < 1e-6 ? p[0] : { x: cx / (3 * a), y: cy / (3 * a) };
  }
  /** the tail as a polygon (the same curves as outline(…, 0)) */
  function tailPoly() {
    const xl = -BW / 2, h = BH / 2, pts = [], bz = (p0, p1, p2, p3, n) => { for (let k = 1; k <= n; k++) { const u = k / n, v = 1 - u; pts.push({ x: v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], y: v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1] }); } };
    pts.push({ x: xl + 168, y: h });
    bz([xl + 168, h], [xl + 120, h + 4], [xl + 70, h + 30], [xl + 26, h + 70], 7);
    bz([xl + 26, h + 70], [xl + 52, h + 44], [xl + 62, h + 22], [xl + 64, h], 5);
    return pts;
  }
  /** the lacquer's colour at a point of the face (the sprite's gradient + its edge pooling), 0..255 */
  function faceRGB(x, y) {
    const y0 = -BH / 2, y2 = BH / 2 + 70, y1 = y0 + .42 * (y2 - y0), C0 = [47, 138, 91], C1 = [31, 97, 66], C2 = [13, 58, 35];
    const c = y < y1 ? [0, 1, 2].map(i => mix(C0[i], C1[i], cl((y - y0) / (y1 - y0)))) : [0, 1, 2].map(i => mix(C1[i], C2[i], cl((y - y1) / (y2 - y1))));
    const r = Math.hypot(x, y + 24), v = .46 * cl((r - BH * .32) / (BW * .64 - BH * .32));
    return [mix(c[0], 0, v), mix(c[1], 16, v), mix(c[2], 7, v)];
  }
  const SHADE_RGB = [0, 1, 2, 3, 4].map(i => { const g = 30 + (110 - 30) * i / 4; return [g * .36, g, g * .63]; });
  const rgbS = (c, a = 1) => `rgba(${cl(c[0], 0, 255) | 0},${cl(c[1], 0, 255) | 0},${cl(c[2], 0, 255) | 0},${a})`;
  const mulT = (c, tn) => [c[0] * tn[0], c[1] * tn[1], c[2] * tn[2]];
  /** a jagged rectangle (chip) */
  function chipPoly(x0, y0, x1, y1, seed) {
    const pts = [], j = s => (R(seed * 13 + s, 71) - .5) * 6;
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([px, py], ci, arr) => {
      const [qx, qy] = arr[(ci + 1) % 4];
      for (let s = 0; s < 3; s++) { const f = s / 3; pts.push({ x: mix(px, qx, f) + (s ? j(ci * 3 + s) : j(ci + 40) * .5), y: mix(py, qy, f) + (s ? j(ci * 3 + s + 20) : j(ci + 50) * .5) }); }
    });
    return pts;
  }
  /** a piece from a local polygon: its points relative to the centroid, its lacquer shade */
  function makePiece(poly, extra = {}) {
    const c = polyCentroid(poly), pts = poly.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
    const col = faceRGB(c.x, c.y), lum = (col[1] - 30) / (110 - 30), shade = Math.max(0, Math.min(SHADES - 1, Math.round(lum * (SHADES - 1))));
    return { pts, cx: c.x, cy: c.y, col, shade, r: Math.sqrt(Math.abs(polyArea(poly))), ...extra };
  }
  function launch(pc, k, o = {}) {
    const x0 = B.x + pc.cx, y0 = B.y + pc.cy, dx = x0 - (B.x + O.x), dy = y0 - (B.y + O.y), d = Math.hypot(dx, dy) || 1;
    const v = (o.v0 || 460) * (1 + 1.3 * R(k, 1)) * (1.3 - Math.min(1, d / 600)), top = y0 < B.y - 40;
    return { ...pc, x0, y0, vx: dx / d * v * (o.lat || 1) + (R(k, 2) - .5) * 120, vy: dy / d * v * .8 + 90 + 120 * R(k, 3),
      vz: (o.vz0 || 520) * (1 + R(k, 4)) * (top ? .7 : 1), w: (R(k, 5) - .5) * 11, flip: R(k, 6) < (o.flips ?? .4) ? Math.PI : 0, g: 2800, e: .3, seed: k };
  }
  function buildPieces() {
    if (PIECES) return PIECES;
    const lay = layout(), out = [], body = rrPoly();
    // 1. lacquer shards: the fan of breaks clipped to the plate, and the tail
    let k = 0;
    for (let i = 0; i < RINGS.length - 1; i++) for (let j = 0; j < RAYS.length - 1; j++) {
      const p = clipConvex(cellPoly(i, j), body); if (p.length < 3 || Math.abs(polyArea(p)) < 160) continue;
      out.push(launch(makePiece(p, { kind: 'shard' }), k++, { lat: 1.5 }));
    }
    out.push(launch(makePiece(tailPoly(), { kind: 'shard', tail: true }), k++));
    // 2. the message breaks into chips of 1–2 letters (debris, never a readable word), cut where they sat
    const chunks = []; let cur = null;
    lay.glyphs.forEach((gl, gi) => {
      if (cur && cur.n < cur.target && gl.li === cur.li && gl.k === cur.last.k + 1) { cur.gs.push(gl); cur.n++; cur.last = gl; return; }
      cur = { li: gl.li, gs: [gl], n: 1, last: gl, target: R(gi, 70) < .4 ? 2 : 1 }; chunks.push(cur);
    });
    chunks.forEach((ch, ci) => {
      const g0 = ch.gs[0], g1 = ch.gs[ch.gs.length - 1], asc = Math.max(...ch.gs.map(g => g.asc)), dsc = Math.max(...ch.gs.map(g => g.desc));
      const poly = chipPoly(g0.x0 - 8, g0.base - asc - 12, g1.x0 + g1.w + 8, g0.base + Math.max(13, dsc + 9), ci);
      const pc = makePiece(poly, { kind: 'letter', txt: ch.gs.map(g => g.ch).join('') });
      pc.tx = g0.x0 - pc.cx; pc.ty = g0.base - pc.cy;
      const kk2 = 100 + ci, P1 = launch(pc, kk2, { v0: 380, vz0: 420, flips: 0 });
      {                                                                         // they all skitter away to the margouillat
        const u = R(kk2, 8), v = R(kk2, 9);
        P1.dest = u < .55 ? { x: 190 + 330 * (u / .55), y: 1446 + 92 * v } : { x: 452 + 270 * ((u - .55) / .45), y: 1300 + 150 * v };
        P1.ta = .4 + .55 * R(kk2, 10); P1.H0 = 110 + 130 * R(kk2, 11); P1.rotEnd = (R(kk2, 12) - .5) * 1.6;
      }
      out.push(P1);
    });
    // 3. the three hearts
    for (let i = 0; i < 3; i++) {
      const p = heartOn(i), x0 = B.x + p.x, y0 = B.y + p.y, ta = Math.max(.12, S.slow(A.roll[i], A.shatter)), dest = G.heartRest[i];
      const dist = Math.hypot(dest.x - x0, dest.y - y0), turns = Math.max(1, Math.round(dist / (TAU * HR * 1.6)));
      out.push({ kind: 'heart', i, x0, y0, dest, ta, H0: 150 - 25 * i, turns, seed: 300 + i, r: HR });
    }
    return (PIECES = out);
  }
  // ---------- closed-form motion ----------
  function hop(vz, tau, g, e, nb) { let v = vz; for (let b = 0; b <= nb; b++) { const d = 2 * v / g; if (tau < d) return v * tau - g * tau * tau / 2; tau -= d; v *= e; } return 0; }
  /** state of piece p at story time tau ≥ 0 since the shatter: {x, y (on the cloth), z, rot, fy (flip cos), air, sc} */
  function pieceState(p, tau) {
    if (p.dest) {                                                     // skittering to a destination in decreasing hops
      const v = Math.min(1, tau / p.ta), u = 1 - Math.pow(1 - v, 1.7);
      const nx = p.dest.x - p.x0, ny = p.dest.y - p.y0, len = Math.hypot(nx, ny) || 1, cv = (R(p.seed, 13) - .5) * 90;
      const x = mix(p.x0, p.dest.x, u) - ny / len * cv * Math.sin(Math.PI * u), y = mix(p.y0, p.dest.y, u) + nx / len * cv * Math.sin(Math.PI * u);
      const z = p.H0 * Math.abs(Math.sin(Math.PI * 3 * Math.pow(v, .8))) * Math.pow(1 - v, 1.25);
      const rot = p.kind === 'heart' ? -TAU * p.turns * u : mix(0, p.rotEnd + TAU * Math.round(R(p.seed, 14) * 2), u);
      const set = tau > p.ta ? Math.exp(-(tau - p.ta) * 9) * Math.sin((tau - p.ta) * 26) : 0;      // a little settle on arrival
      return { x, y, z, rot: rot + .12 * set, fy: 1, air: v < 1, sc: (1 + z * .0016) * (p.kind === 'heart' ? 1 : mix(1, .62, u)) };
    }
    const t1 = 2 * p.vz / p.g, tf = .2;
    let x, y, rot;
    if (tau < t1) { x = p.x0 + p.vx * tau; y = p.y0 + p.vy * tau; rot = p.w * tau; }
    else { const s = tau - t1, k = tf * (1 - Math.exp(-s / tf)) * .45; x = p.x0 + p.vx * (t1 + k); y = p.y0 + p.vy * (t1 + k); rot = p.w * (t1 + k * 1.4); }
    const z = Math.max(0, tau < t1 ? p.vz * tau - p.g * tau * tau / 2 : hop(p.vz * p.e, tau - t1, p.g, p.e, 1));
    const tl = t1 + 2 * p.vz * p.e / p.g * (1 + p.e);
    return { x, y, z, rot, fy: Math.cos(p.flip * sst(kk(tau, 0, t1 + .05))), air: tau < tl, sc: 1 + z * .0013 };
  }
  /** the debris goes: letters and shards at the rule, hearts 1–2 deflate before the container */
  function pieceAlpha(p, t) {
    if (p.kind === 'heart') return p.i === 0 ? (t >= A.gulp + .04 ? 0 : 1) : 1 - kk(t, A.gulp + .25 + .08 * p.i, A.gulp + .5 + .08 * p.i);
    return 1 - kk(t, A.rule - .1, A.rule + .4);
  }
  function mouth(t) {
    if (has('K_mouth')) { try { const m = K_mouth(t); if (m && isFinite(m.x) && isFinite(m.y)) return m; } catch (e) { /* fallback */ } }
    return { x: G.gecko.x + 40, y: G.gecko.y - 30 };
  }
  /** heart 0's gulp: a little hop from its rest into the margouillat's mouth over [A.gulp − .15, A.gulp], gone at + .04 */
  function gulpState(st, t) {
    const t0 = A.gulp - .15; if (t < t0) return st;
    const m = mouth(t), u = kk(t, t0, A.gulp), ant = kk(u, 0, .3), p = Math.pow(kk(u, .3, 1), 1.8);
    return { ...st, x: mix(st.x, m.x, p) + 6 * Math.sin(Math.PI * ant) * (1 - p), y: mix(st.y, m.y + HR * .3, p), z: 34 * 4 * p * (1 - p), sc: (1 - .45 * p) * (1 - kk(t, A.gulp, A.gulp + .04)), rot: st.rot - .9 * p };
  }
  function drawPieceShadow(p, st, L, al) {
    const z = st.z, a = al * .5 / (1 + z * .01), o = shadowOff(st.x, st.y, z, L);
    if (a < .01) return;
    const rx = (p.kind === 'heart' ? HR * 1.05 : p.r * .55) * (1 + z * .003), ry = (p.kind === 'heart' ? HR * .45 : p.r * .32) * (1 + z * .003);
    ctx.fillStyle = `rgba(6,3,14,${a.toFixed(3)})`; ctx.beginPath(); ctx.ellipse(st.x + o.x * .6, st.y + o.y * .6 + 8, rx, ry, 0, 0, TAU); ctx.fill();
  }
  /** a heart of the fall (they are few and round: one sprite each) */
  function drawHeartPiece(st, al) {
    const y = st.y - st.z; if (st.x < -140 || st.x > 1220 || y > 2060 || y < -140) return;
    drawHeart(st.x, y - HR * .3, .95 * st.sc * (.35 + .65 * al), st.rot, 0, al);   // hearts 1–2 deflate
  }

  /** every lacquer piece of a layer in a handful of batched fills (one path per material: ≈ 7 calls for ~55 pieces,
   *  instead of ~5 calls each); the letters' glyphs are the only per-piece calls */
  const SHADES = 5;
  function drawPieces(list, L, hot, al) {
    if (!list.length || al <= 0) return;
    const tn = tintAt(540, 1050, L), lay = layout();
    const thick = new Path2D(), backs = new Path2D(), lip = new Path2D(), faces = [], txt = [];
    for (let i = 0; i < SHADES; i++) faces.push(new Path2D());
    const add = (path, pts, x, y, c, s, sc, fy, ox = 0, oy = 0) => {
      for (let i = 0; i < pts.length; i++) {
        const px = pts[i].x * sc, py = pts[i].y * sc * fy, X = x + ox + c * px - s * py, Y = y + oy + s * px + c * py;
        i ? path.lineTo(X, Y) : path.moveTo(X, Y);
      }
      path.closePath();
    };
    for (const { p, st } of list) {
      const y = st.y - st.z; if (st.x < -140 || st.x > 1220 || y > 2060 || y < -140) continue;
      const c = Math.cos(st.rot), s = Math.sin(st.rot), sc = st.sc, fy = Math.max(.07, Math.abs(st.fy));
      add(thick, p.pts, st.x, y, c, s, sc, fy, 1.4 * sc, 5.5 * sc);
      if (st.fy > 0) {
        add(faces[p.shade], p.pts, st.x, y, c, s, sc, fy); add(lip, p.pts, st.x, y, c, s, sc, fy, -1.3 * sc, -2 * sc);
        if (p.txt) txt.push({ p, x: st.x, y, c, s, sc, fy });
      } else add(backs, p.pts, st.x, y, c, s, sc, fy);
    }
    ctx.save(); ctx.globalAlpha *= al;
    // its thickness (fills only: stroking these jagged paths costs 3× a fill here); while the break is fresh, the side glows
    const th = [mix(7, 255, hot * .9), mix(34, 104, hot * .9), mix(19, 28, hot * .9)];
    ctx.fillStyle = rgbS(hot > .01 ? th : mulT(th, tn)); ctx.fill(thick);
    ctx.fillStyle = rgbS(mulT([12, 48, 28], tn)); ctx.fill(backs);
    ctx.fillStyle = rgbS(mulT([150, 236, 186], tn), .5); ctx.fill(lip);    // the lit lip of each broken edge (top-left)
    for (let i = 0; i < SHADES; i++) {                                   // lacquer lit by the bulb: brighter in the pool, sinking at its edge
      const c0 = SHADE_RGB[i], gr = ctx.createRadialGradient(L.x, POOL_Y - 60, 60, L.x, POOL_Y - 60, 980);
      gr.addColorStop(0, rgbS(mulT([c0[0] * 1.3 + 14, c0[1] * 1.22 + 10, c0[2] * 1.25 + 12], tn))); gr.addColorStop(.55, rgbS(mulT(c0, tn))); gr.addColorStop(1, rgbS(mulT([c0[0] * .45, c0[1] * .45, c0[2] * .5], tn)));
      ctx.fillStyle = gr; ctx.fill(faces[i]);
    }
    if (txt.length) {
      const base = ctx.getTransform();
      ctx.font = FONT(lay.z); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px'; ctx.fillStyle = CREAM;
      for (const q of txt) { ctx.setTransform(base); ctx.transform(q.c * q.sc, q.s * q.sc, -q.s * q.sc * q.fy, q.c * q.sc * q.fy, q.x, q.y); ctx.fillText(q.p.txt, q.p.tx, q.p.ty); }
      ctx.setTransform(base);
    }
    ctx.restore();
  }
  /** the shadows of the pieces in the air, batched in 3 strengths */
  function drawShadows(list, L, al) {
    const bins = [new Path2D(), new Path2D(), new Path2D()], A3 = [.42, .28, .16];
    let any = false;
    for (const { p, st } of list) {
      if (st.z <= .5) continue;
      const z = st.z, o = shadowOff(st.x, st.y, z, L), b = z < 40 ? 0 : z < 110 ? 1 : 2;
      const rx = p.r * .55 * (1 + z * .003), ry = p.r * .32 * (1 + z * .003), cx = st.x + o.x * .6, cy = st.y + o.y * .6 + 8;
      bins[b].moveTo(cx + rx, cy); bins[b].ellipse(cx, cy, rx, ry, 0, 0, TAU); any = true;
    }
    if (!any) return;
    ctx.save(); for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(6,3,14,${(A3[i] * al).toFixed(3)})`; ctx.fill(bins[i]); } ctx.restore();
  }

  // =============================================================================================
  // THE STICKER « « TON FOURNISSEUR » ? » → « PAS TON FOURNISSEUR »
  // =============================================================================================
  let STK = null;
  function stickerGeo() {
    if (STK) return STK;
    const g = makeCanvas(8, 8).getContext('2d'); g.letterSpacing = '0px';
    const zq = 44, zp = 52; g.font = FONT(zq); const wq = g.measureText('« TON FOURNISSEUR »').width, wqm = g.measureText(' ?').width * 1.25;
    g.font = FONT(zp); const wp = g.measureText('PAS TON FOURNISSEUR').width;
    const w = wq + wqm + 66, wP = wp + 64, h = 80;
    return (STK = { zq, zp, wq, wqm, wp, w, wP, h });
  }
  const pillPath = (g, w, h, i = 0) => rrectOn(g, -w / 2 + i, -h / 2 + i, w - 2 * i, h - 2 * i, h / 2 - i);
  function stickerFront(K) {
    const w = K.w, h = K.h;
    ctx.fillStyle = '#F6F1E4'; ctx.beginPath(); pillPath(ctx, w + 14, h + 14); ctx.fill();          // die-cut white margin
    ctx.fillStyle = INKG; ctx.beginPath(); pillPath(ctx, w, h); ctx.fill();
    const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, 'rgba(255,255,255,.14)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
    ctx.fillStyle = gr; ctx.beginPath(); pillPath(ctx, w, h); ctx.fill();
    ctx.strokeStyle = MUSTARD; ctx.lineWidth = 4; ctx.beginPath(); pillPath(ctx, w, h, 7); ctx.stroke();
    ctx.font = FONT(K.zq); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.letterSpacing = '0px';
    const x0 = -(K.wq + K.wqm) / 2;
    ctx.fillStyle = CREAM; ctx.fillText('« TON FOURNISSEUR »', x0, 3);
    ctx.font = FONT(Math.round(K.zq * 1.25)); ctx.fillStyle = ORANGE; ctx.fillText('?', x0 + K.wq + K.wqm * .3, 3);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); rrectOn(ctx, -w / 2 + 22, -h / 2 + 9, w - 44, 9, 4.5); ctx.fill();   // vinyl gloss
  }
  function pasPill(K, a = 1) {
    const w = K.wP, h = K.h;
    ctx.save(); ctx.globalAlpha *= a;
    const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, '#FF7A3A'); gr.addColorStop(.5, ORANGE); gr.addColorStop(1, '#D9400A');
    ctx.fillStyle = gr; ctx.beginPath(); pillPath(ctx, w, h); ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,210,.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); pillPath(ctx, w, h, 5); ctx.stroke();
    ctx.font = FONT(K.zp); ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.letterSpacing = '0px';
    ctx.fillStyle = 'rgba(90,20,0,.55)'; ctx.fillText('PAS TON FOURNISSEUR', 1, 5);
    ctx.fillStyle = '#FFF6E8'; ctx.fillText('PAS TON FOURNISSEUR', 0, 2);
    ctx.restore();
  }
  /** where the sticker is: riding the bubble, then (after the shatter) knocked into the air, drifting to the middle */
  function stickerPose(pq, t) {
    let x = pq.x, y = pq.y, rot = -.035, s = 1, lift = 0;
    const b = S.bubble(Math.min(t, A.shatter - .01));
    if (b && t < A.shatter && b.shake > 0) { const n = q2(t); x += (R(n, 1) - .5) * 10 * b.shake; y += (R(n, 2) - .5) * 6 * b.shake; }
    const k0 = kk(t, A.pillQ - .15, A.pillQ + .02);                        // slaps down onto the bubble
    if (t < A.pillQ + .02) { s = 1.35 - .35 * eo(k0); rot = -.12 + .085 * eo(k0); lift = 40 * (1 - k0); }
    else { const q = S.squash(t, A.pillQ + .02, .1, 30, 10); s = q.sx; }
    if (t >= A.shatter) {
      const k = sst(kk(t, A.shatter, A.peel + .1)), bob = Math.sin((t - A.shatter) * 3.1) * 4 * k;
      x = mix(x, G.cx, k); y = mix(y, G.fauxY - 120, k) + bob; rot = mix(rot, -.015, k) + .02 * Math.sin((t - A.shatter) * 2.3) * k; lift = 26 * k;
    }
    return { x, y, rot, s, lift };
  }
  function drawSticker(pq, t, L) {
    if (!pq || pq.a <= 0) return;
    const K = stickerGeo(), st = stickerPose(pq, t), w = K.w + 14, h = K.h + 14, peel = cl(pq.peel || 0);
    ctx.save(); ctx.globalAlpha *= pq.a;
    // its shadow (on the bubble, then on the cloth far below while it hangs in the air)
    { const so = 8 + st.lift * .9, sa = .45 - .2 * cl(st.lift / 30);
      ctx.save(); ctx.translate(st.x + 4 + st.lift * .2, st.y + so); ctx.rotate(st.rot); ctx.scale(st.s, st.s);
      ctx.fillStyle = `rgba(4,2,10,${(sa * (1 - kk(peel, .6, 1))).toFixed(3)})`; for (const gg of [0, 5, 10]) { ctx.beginPath(); pillPath(ctx, w + gg, h + gg); ctx.fill(); }
      ctx.restore(); }
    ctx.translate(st.x, st.y); ctx.rotate(st.rot); ctx.scale(st.s, st.s);
    if (peel <= 0) { stickerFront(K); ctx.restore(); return; }
    // the fold sweeps from left to right (slanted), the flap folds over to the right showing its paper back
    const f = sst(kk(peel, .1, .78)), det = sst(kk(peel, .66, 1)), tanA = .32, xf = mix(-w / 2 - h * .5, w / 2 + h * .45, f);
    const lineClip = (side) => { ctx.beginPath(); if (side < 0) { ctx.moveTo(-w, -h); ctx.lineTo(xf - h * tanA, -h); ctx.lineTo(xf + h * tanA, h); ctx.lineTo(-w, h); } else { ctx.moveTo(w, -h); ctx.lineTo(xf - h * tanA, -h); ctx.lineTo(xf + h * tanA, h); ctx.lineTo(w, h); } ctx.closePath(); ctx.clip(); };
    // 1. what was under it: « PAS TON FOURNISSEUR » (revealed where peeled; all of it once the flap is gone)
    ctx.save(); if (det < 1) lineClip(-1); pasPill(K, 1); ctx.restore();
    // a slap when it is all revealed
    // 2. the part still stuck
    if (f < 1) { ctx.save(); lineClip(1); stickerFront(K); ctx.restore();
      ctx.save(); lineClip(1); const sg = ctx.createLinearGradient(xf, 0, xf + 60, 0); sg.addColorStop(0, 'rgba(0,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.beginPath(); pillPath(ctx, w, h); ctx.fill(); ctx.restore(); }
    // 3. the flap: the peeled part mirrored over the fold, foreshortened (it lifts off), paper back, shaded at the fold
    {
      const ang = Math.atan(tanA), c = .78 - .25 * det;
      ctx.save();
      ctx.translate(-160 * det, -150 * det * det); ctx.rotate(-.5 * det);
      ctx.globalAlpha *= 1 - det;
      ctx.translate(xf, 0); ctx.rotate(-ang); ctx.scale(-c, 1); ctx.rotate(ang); ctx.translate(-xf, 0);
      ctx.save(); lineClip(-1); ctx.beginPath(); pillPath(ctx, w, h);
      const bg = ctx.createLinearGradient(xf, 0, xf - w * .7, 0); bg.addColorStop(0, '#CFC6B4'); bg.addColorStop(.18, '#F4EEE0'); bg.addColorStop(1, '#E3DAC6');
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = 'rgba(120,100,70,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      ctx.restore();
    }
    ctx.restore();
  }

  // =============================================================================================
  // « FAUX MESSAGE » — the starved orange rubber stamp
  // =============================================================================================
  let STAMP = null;
  function buildStamp() {
    if (STAMP) return STAMP;
    const z = 104, g0 = makeCanvas(8, 8).getContext('2d'); g0.font = FONT(z); g0.letterSpacing = '2px';
    let tw = g0.measureText('FAUX MESSAGE').width; const zz = tw > 780 ? Math.floor(z * 780 / tw) : z; g0.font = FONT(zz); tw = g0.measureText('FAUX MESSAGE').width;   // QA: 780 → 96 px (title ≥ 96; was 91), text x 157…923
    const bw = tw + 76, bh = zz * .98 + 64, ss = 1, cw = Math.ceil((bw + 40) * ss), ch = Math.ceil((bh + 40) * ss);
    const c = makeCanvas(cw, ch), g = c.getContext('2d'); g.scale(ss, ss); g.translate((bw + 40) / 2, (bh + 40) / 2);
    g.strokeStyle = ORANGE; g.fillStyle = ORANGE; g.lineJoin = 'round';
    g.lineWidth = 9; g.beginPath(); rrectOn(g, -bw / 2, -bh / 2, bw, bh, 16); g.stroke();
    g.lineWidth = 3; g.beginPath(); rrectOn(g, -bw / 2 + 13, -bh / 2 + 13, bw - 26, bh - 26, 9); g.stroke();
    g.font = FONT(zz); g.letterSpacing = '2px'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FAUX MESSAGE', 0, zz * .05);
    // starved ink: uneven pressure (soft holes) and dry speckles
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) { const x = (R(i, 81) - .5) * bw, y = (R(i, 82) - .5) * bh, r = 8 + 26 * R(i, 83); const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(0,0,0,${(.18 + .22 * R(i, 84)).toFixed(3)})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    for (let i = 0; i < 1100; i++) { g.globalAlpha = .3 + R(i, 85) * .6; g.beginPath(); g.arc((R(i, 86) - .5) * (bw + 10), (R(i, 87) - .5) * (bh + 10), .5 + R(i, 88) * 2.1, 0, TAU); g.fill(); }
    for (let i = 0; i < 9; i++) { g.globalAlpha = .55; g.lineWidth = 1.4 + R(i, 89) * 2; g.beginPath(); const y = (R(i, 90) - .5) * bh, x = (R(i, 91) - .5) * bw; g.moveTo(x, y); g.lineTo(x + 40 + 90 * R(i, 92), y + (R(i, 93) - .5) * 6); g.stroke(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // the halo that keeps it readable on the night (baked: pushed shadow of the box)
    const hc = makeCanvas(cw, ch), hg = hc.getContext('2d'); hg.scale(ss, ss); hg.translate((bw + 40) / 2, (bh + 40) / 2);
    hg.shadowColor = 'rgba(8,4,18,.93)'; hg.shadowBlur = 16 * ss; hg.shadowOffsetX = 8000 * ss; hg.fillStyle = '#000'; hg.beginPath(); rrectOn(hg, -bw / 2 - 8000 - 6, -bh / 2 - 6, bw + 12, bh + 12, 22); hg.fill();
    const gc = makeCanvas(cw, ch), gg = gc.getContext('2d'); gg.shadowColor = 'rgba(255,90,20,1)'; gg.shadowBlur = 14 * ss; gg.shadowOffsetX = 8000; gg.drawImage(c, -8000, 0);
    // baked at its final angle (a rotated drawImage costs ~3× an axis-aligned one here)
    const fs0 = S.fauxStamp(A.fauxStamp), rot = fs0 ? fs0.rot : -.08, ca = Math.abs(Math.cos(rot)), sa = Math.abs(Math.sin(rot));
    const RW = Math.ceil(cw * ca + ch * sa) + 4, RH = Math.ceil(cw * sa + ch * ca) + 4;
    const rotd = (srcs) => { const r = makeCanvas(RW, RH), g2 = r.getContext('2d'); g2.translate(RW / 2, RH / 2); g2.rotate(rot); for (const [img, al] of srcs) { g2.globalAlpha = al; g2.drawImage(img, -cw / 2, -ch / 2); } return r; };
    const both = rotd([[hc, .95], [c, 1]]), glow = rotd([[gc, 1]]);
    return (STAMP = { both, glow, w: RW, h: RH, bw, bh, rot });
  }
  const STAMP_DY = 40;                                                   // a little lower than the bubble's centre: clear of the sticker
  function drawStampFx(fs, t, L) {
    if (!fs || fs.a <= 0 || fs.k <= 0) return;
    const ST = buildStamp(), d = t - A.fauxStamp, x = fs.x, y = fs.y + STAMP_DY;
    if (d > 0 && d < .5) {
      const u = d / .5, ur = kk(d, 0, .28);
      if (ur < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,120,50,${(.55 * (1 - ur)).toFixed(3)})`; ctx.lineWidth = 16 * (1 - ur) + 2;
        ctx.beginPath(); ctx.ellipse(x, y, ST.bw * (.52 + .2 * eo(ur)), ST.bh * (.62 + .5 * eo(ur)), fs.rot, 0, TAU); ctx.stroke(); ctx.restore(); }
      puffs([[-1, 0], [1, 0], [-.6, .8], [.6, .8]].map(([nx, ny]) => ({ x: x + nx * ST.bw * .45, y: y + ny * ST.bh * .45, nx, ny })), u, L, 40, .8);
    }
  }
  function drawStamp(fs, t, L) {
    if (!fs || fs.a <= 0 || fs.k <= 0) return;
    const ST = buildStamp(), k = fs.k, sc = k < 1 ? 1.65 - .65 * eo(k) : 1, a = fs.a * Math.min(1, k * 2.2);
    const d = t - A.fauxStamp, x = fs.x, y = fs.y + STAMP_DY;
    ctx.save(); ctx.translate(x, y); if (fs.rot !== ST.rot) ctx.rotate(fs.rot - ST.rot); ctx.scale(sc, sc);
    ctx.globalAlpha = a; ctx.drawImage(ST.both, -ST.w / 2, -ST.h / 2, ST.w, ST.h);
    const gl = d < 0 ? .3 : .6 * Math.exp(-d * 4);                       // the fresh ink flares on impact
    if (gl > .02) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * gl; ctx.drawImage(ST.glow, -ST.w / 2, -ST.h / 2, ST.w, ST.h); }
    ctx.restore();
    // ink specks thrown off by the slam
    if (d > 0 && d < .9) {
      ctx.save(); ctx.fillStyle = ORANGE;
      for (let i = 0; i < 16; i++) {
        const ang = R(i, 95) * TAU, r0 = .5 + .25 * R(i, 96), dd = eo(kk(d, 0, .12)), px = x + Math.cos(ang) * ST.bw * r0 * (1 + .18 * dd), py = y + Math.sin(ang) * ST.bh * r0 * (1.2 + .3 * dd);
        ctx.globalAlpha = fs.a * .8 * (1 - kk(d, .5, .9)) * dd; ctx.beginPath(); ctx.arc(px, py, 2 + 4 * R(i, 97), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  // =============================================================================================
  // SPARKS (stamp, shatter) and the landing / stamp dust
  // =============================================================================================
  function sparks(t, L) {
    const draws = [];
    if (t >= A.stamp && t < A.shatter + 1.2) {                                // from the cracks' tips while they run, then the burst
      const tau = S.slow(t, A.stamp), D = crackData();
      for (let i = 0; i < 18; i++) {
        const c = D[i % 3], t0 = .02 + .16 * R(i, 51), life = .22 + .25 * R(i, 52); const u = (tau - t0) / life; if (u <= 0 || u >= 1) continue;
        const pp = c.pts[Math.min(c.pts.length - 1, Math.floor((.15 + .8 * R(i, 53)) * c.pts.length))], a = R(i, 54) * TAU, v = 260 + 380 * R(i, 55), s = tau - t0;
        draws.push({ x: B.x + pp.x + Math.cos(a) * v * s, y: B.y + pp.y + Math.sin(a) * v * s * .6 + 900 * s * s - 120 * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6 + 1800 * s - 120, u });
      }
      const ts = S.slow(t, A.shatter);
      if (t >= A.shatter) for (let i = 0; i < 22; i++) {
        const life = .3 + .35 * R(i, 56), u = ts / life; if (u <= 0 || u >= 1) continue;
        const a = Math.PI * (.05 + .9 * R(i, 57)) * (R(i, 58) < .2 ? -1 : 1), v = 380 + 520 * R(i, 59), ox = (R(i, 60) - .5) * BW * .8, oy = -BH / 2 + 30 + R(i, 61) * BH * .6;
        draws.push({ x: B.x + ox + Math.cos(a) * v * ts, y: B.y + oy + Math.sin(a) * v * ts * .7 + 1000 * ts * ts - 200 * ts, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7 + 2000 * ts - 200, u });
      }
    }
    if (!draws.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const d of draws) {
      const sp = Math.hypot(d.vx, d.vy) || 1, l = Math.min(26, sp * .025), dx = d.vx / sp * l, dy = d.vy / sp * l, a = 1 - d.u;
      ctx.strokeStyle = `rgba(255,110,30,${(.5 * a).toFixed(3)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(d.x - dx, d.y - dy); ctx.lineTo(d.x, d.y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,226,170,${a.toFixed(3)})`; ctx.lineWidth = 1.8; ctx.stroke();
    }
    ctx.restore();
  }
  const edgeEmitters = (n, scale = 1) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), side = i % 3;
      if (side === 0) out.push({ x: B.x + (u - .5) * BW * scale, y: B.y + BH / 2 * scale, nx: (u - .5) * .6, ny: 1 });
      else if (side === 1) out.push({ x: B.x - BW / 2 * scale, y: B.y + (u - .5) * BH * scale, nx: -1, ny: .2 });
      else out.push({ x: B.x + BW / 2 * scale, y: B.y + (u - .5) * BH * scale, nx: 1, ny: .2 });
    }
    return out;
  };
  let EM_LAND = null, EM_STAMP = null;

  // =============================================================================================
  // PUBLIC
  // =============================================================================================
  function fx(t, L, layer) {
    // the bubble lands (A.bubble), the steel stamps it (A.stamp): dust spilling from under it
    if (layer === 'over') {
      if (t >= A.bubble && t < A.bubble + .9) { EM_LAND = EM_LAND || edgeEmitters(12); puffs(EM_LAND, kk(t, A.bubble, A.bubble + .9), L, 10, .9); }
      if (t >= A.stamp && t < A.stamp + 1.2) { EM_STAMP = EM_STAMP || edgeEmitters(9, 1.02); puffs(EM_STAMP, kk(S.slow(t, A.stamp), 0, .6), L, 20, 1.15); }
      sparks(t, L);
    }
    if (t >= A.shatter && t < A.cont) {
      const tau = S.slow(t, A.shatter), PS = buildPieces(), P = S.parcel(t);
      const items = [];
      for (const p of PS) {
        const al = pieceAlpha(p, t); if (al <= 0) continue;
        let st = pieceState(p, tau);
        if (p.kind === 'heart' && p.i === 0) st = gulpState(st, t);
        items.push({ p, st, al });
      }
      const hot = 1 - kk(tau, .06, .5), sh = items.filter(it => it.p.kind === 'shard'), le = items.filter(it => it.p.kind === 'letter');
      const alS = 1 - kk(tau, .42, .78), alL = le.length ? le[0].al : 0;
      if (layer === 'under') {
        if (alS > 0) { drawShadows(sh, L, alS); drawPieces(sh.filter(it => !it.st.air), L, hot, alS); }
        drawShadows(le, L, alL); drawPieces(le.filter(it => !it.st.air), L, hot, alL);
      } else {
        if (alS > 0) drawPieces(sh.filter(it => it.st.air), L, hot, alS);
        drawPieces(le.filter(it => it.st.air), L, hot, alL);
        for (const it of items) if (it.p.kind === 'heart') { drawPieceShadow(it.p, it.st, L, it.al); drawHeartPiece(it.st, it.al); }
      }
    }
    if (layer === 'over') {
      const fs = S.fauxStamp(t);
      drawStampFx(fs, t, L);
      if (t >= A.shatter) { const pq = S.pillQ(t); if (pq) drawSticker(pq, t, L); }
      drawStamp(fs, t, L);
    }
  }
  function fake(pq, t, L) { if (t < A.shatter) drawSticker(pq, t, L); }

  return { drawBubble, fake, fx, layout, buildPieces, pieceState, stickerPose };
})();
function CM_bubble(b, t, L) { CM_F.drawBubble(b, t, L); }
function CM_fake(pq, t, L) { CM_F.fake(pq, t, L); }
function CM_fx(t, L, layer) { CM_F.fx(t, L, layer); }

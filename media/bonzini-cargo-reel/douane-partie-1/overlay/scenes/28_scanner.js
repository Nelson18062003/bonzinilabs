'use strict';
// =============================================================================================
// 28_scanner — ④ L'ARCHE DU SCANNER, the day after (S16–S20). World x ≈ 3860–4930 (X.scanner = 4300).
//  Always there (world): a big paper drive-through arch « SCANNER » (hazard stripes, cyan emitters, a status lamp that turns
//          green on « Tout correspond »), Junior's container on a plain flatbed truck (containerAt: static from the cut to
//          S23 − 1.8 s; the truck is exported as window.D28_truck for the exit), the officer's booth « CONTRÔLE » (window,
//          ledge, lightbox with the cyan image, shelf with the book « LA DOUANE COMPARE », paper tray) and the friendly
//          officer (officerFig, green cap, no badge).
//  S16  THE hard cut: Mireille's diary page (mireilleDiary, huge) sweeps right→left, « MER. → JEU. », and covers the frame
//          while the camera jumps (CUT()). Thursday: the truck rolls in behind Junior & Mireille and stops under the arch on
//          « scanner »; cyan glow + one slow scanning curtain (the shoe boxes show in negative inside the moving slit).
//          Junior: paper heart thumping on his chest, cheeks puffed; Mireille « C'est un contrôle normal. Respire. », her
//          hand on his shoulder, he breathes out (paper puff). The bête (44) stands at 110 % behind his shoulder.
//  S17  « compare » : pinned close-up (screen) out of the booth: L'IMAGE (cyan x-ray) ↔ LA LISTE, the finger goes down the
//          rows (ticks); « le prix » : the invoice's price bar ↔ the book « LA DOUANE COMPARE » (the bar lands in the known
//          zone). Hold ≥ 1 s in near-silence, the officer nods.
//  S18  « Tout correspond » : 46 stamps « CONTRÔLÉ » (round) → match cut: a violet « ? » sticker of the same size appears on
//          the stamp; Junior's phone (juniorPhone, message) is under it; pull back; the sticker peels off (seal 1→0), the kraft
//          flap opens (flap 0→1): « Non merci. Vrai prix, vraie description. » Warm light. The phone shrinks back into his
//          pocket; Mireille « Bien joué ! ».
//  S19  BIG INSERT (screen, ≈ 750 px wide, board centred y 720): a paper board is pinned and a beam balance comes down from
//          the flies into it — tiny coin + tag « le droit en moins » on the left pan; on « amende » a whole container
//          « AMENDE » falls into the right pan and crashes it down (Junior gasps); from « valeur » « jusqu'à la valeur /
//          de la marchandise » is hand-lettered in red on the board; held ≈ 4 s; the board goes, the balance shrinks
//          back into the world (hangs left of the officer, heavy pan on the ledge), then is pulled up to the flies.
//  S20  close-up of Junior's declaration (700 × 470, key text 60–80 px, right of his raised hand): « Douala » in pencil
//          (it arrived at Kribi) is circled; Junior's hand goes up (violet ticks around his index); the officer strikes it
//          (no eraser) and writes « Kribi » next to it; stamp « SIGNALÉE À TEMPS ».
//          « Le vrai secret » : 46 stamps the passport cover; three chips VRAIS · COMPLETS · À L'AVANCE under it.
// z 21 arch back · 24 truck + container + scan slit · 26 arch front · 28 booth back · 29 officer · 33 heart/breath (on Junior)
// · 36 booth front + ledge props + balance (world) · 45 balance insert (screen) · 46 bubbles · 47 close-ups · 48 chips
// · 50 phone · 54 sticker · 56 warm light
// · 58 diary page.
// =============================================================================================
(() => {
  const AX = X.scanner, Y = h => GROUND - h;
  const AR = { x0: AX - 440, x1: AX + 440, pw: 78, top: Y(700), bh: 104 };            // arch: outer span, pillar width, top, beam height
  const BO = { x0: 4560, x1: 4900, roof: Y(596), ledge: Y(236) };                       // the officer's booth
  const OFX = 4730;                                                                     // officer (inside the booth)
  const LB = { x: 4822, y: Y(430), w: 100, h: 78 };                                     // lightbox (back wall, right of the officer's head)
  const SH = { x: 4622, y: Y(470) };                                                    // shelf with the book (back wall, left)
  const TRAY = { x: 4605 }, DECL = { x: 4876 };                                          // paper tray (ledge, left) · Junior's declaration (ledge, right end)
  // the S19 balance — drawn in its own units (= screen px when it is the big insert); in the world at scale BAL.ws.
  // BI: insert slot (pivot x/y, arm L, pan strings S, pan width pw, bowl depth bd, tipped angle th) + the paper card behind it.
  const BI = { x: 575, y: 470, L: 215, S: 214, pw: 250, bd: 34, th: .42, card: { x: 565, y: 720, w: 780, h: 730 } };
  const BAL = { x: 4596, ws: .38 };                                                     // world spot: hangs from the flies left of the officer's face, the heavy pan resting on the ledge
  BAL.piv = BO.ledge - 4 - BAL.ws * (BI.L * Math.sin(BI.th) + BI.S + BI.bd);
  const NAVY = '#0D2536', CYAN = '#8BEBFF', CAB = '#E2B04A';
  const OSKIN = SKIN[2], OSLEEVE = '#E7DFC9', JSKIN = SKIN[1];
  const cont = () => window.A20_CONT || { w: 680, h: 360, depth: 46, top: 18, deck: 110, color: '#2E6B8A' };
  const visX = (x0, x1, t, m = 140) => { const c = camAt(t); if (Math.abs(c.r) > .01) return true; const hw = W / 2 / c.z + m; return x1 > c.x - hw && x0 < c.x + hw; };

  // ---------- time table (lazy: TL is known at draw time) -----------------------------------------
  let K = null;
  function keys() {
    if (K) return K;
    const c = CUT(), cm = c.t + c.dur * .5;
    const k = {
      cm, sw0: cm - .62, sw1: cm + .62,                                                   // diary page sweep (covers the frame at the jump)
      drive0: tw('S16', 'lendemain', 0), drive1: te('S16', 'scanner', .25),
      glow0: te('S16', 'scanner', .1), beam0: te('S16', 'scanner', .4), beam1: tw('S16', 'Respire', .5), glow1: se('S16', .6),
      puff0: tw('S16', 'Mireille', 0), resp: tw('S16', 'Respire', 0), bub0: tw('S16', 'cest', -.15), bub1: se('S16', .95),
      cmp: tw('S17', 'compare', 0), img: tw('S17', 'image', 0), lst: tw('S17', 'liste', 0), prix: tw('S17', 'prix', 0),
      dou: tw('S17', 'douane', 0), con: te('S17', 'connait', 0),
      tout: tw('S18', 'Tout', 0), corr: tw('S18', 'correspond', 0), car: tw('S18', 'Car', 0), rep: tw('S18', 'repondu', 0), non: tw('S18', 'Non', 0), s18e: se('S18', 0),
      pay: tw('S19', 'payer', 0), am: tw('S19', 'amende', 0), jq: tw('S19', 'jusqu', 0), s19e: se('S19', 0),
      err: tw('S20', 'erreur', 0), bon: tw('S20', 'bonne', 0), sig: tw('S20', 'signalee', 0), tmp: tw('S20', 'temps', 0), sanc: te('S20', 'sanctionnee', 0),
      s20e: se('S20', 0), r21: tw('S21', 'regle', 0),
    };
    // S17 close-up: out before the passport (46) flies in for « correspond »
    const w46 = window.P46 && P46.window('S18');
    k.pIn = w46 ? w46.tIn : k.corr - 1.0;
    k.cOut1 = Math.min(k.pIn - .08, k.con + 1.55); k.cOut0 = k.cOut1 - .38;
    k.swapB = k.prix - .35;                                                               // the officer swaps list → invoice + book
    k.nod0 = k.cOut1 - .05; k.nod1 = k.nod0 + .9;
    // S18 match cut & phone
    k.m0 = k.car; k.pb0 = k.car + .55; k.pb1 = k.car + 1.25;
    k.peel0 = Math.max(k.pb1 - .45, k.rep - .1); k.peel1 = k.peel0 + .42; k.flap0 = k.peel1 - .06; k.flap1 = Math.max(k.flap0 + .4, k.non + .1);   // open as « Non merci » is said
    k.leak0 = k.non - .1; k.out0 = k.s18e + .25; k.out1 = k.out0 + .5; k.leak1 = k.out1 + .4;
    k.bj0 = k.out1 - .05; k.bj1 = Math.min(k.pay - .2, k.bj0 + 3.2);
    // S19 balance (big screen insert): down from the flies as the camera reaches the booth · AMENDE crashes on « amende »
    //   · « jusqu'à la valeur / de la marchandise » hand-lettered from « valeur » · hold · settles back into the world
    //   (hangs over the ledge, the heavy pan resting on it) · pulled back up to the flies as S20 opens.
    k.val = tw('S19', 'valeur', 0, 1); k.mar = te('S19', 'marchandise', 0);
    k.bi0 = Math.max(k.bj1 + .45, k.am - 1.05); k.bi1 = k.bi0 + .67;                      // insert in: the board is pinned, the balance comes down
    k.drop0 = k.am - .36; k.hit = k.am;
    k.wr0 = k.val; k.wr1 = k.val + .5; k.wr2 = Math.max(k.wr1 + .5, k.mar - .45);          // end of line 1 · end of line 2
    k.co0 = Math.max(k.s19e + .2, k.wr2 + .75); k.co1 = k.co0 + .2;                       // the board goes (insert held ≈ 4 s)
    k.bo0 = k.co0 + .17; k.bo1 = k.bo0 + .45;                                              // the balance settles back into the world, over the ledge
    k.rise0 = k.bo1 + .2; k.rise1 = k.rise0 + .4; k.up1 = k.rise1;                        // … and is pulled back up to the flies
    k.bal0 = k.bi0;                                                                       // (officer: watches the balance from here)
    // S20 declaration close-up + chips
    k.d0 = Math.max(k.rise0 + .1, k.err - .2); k.circ = Math.max(k.err + .05, k.d0 + .3); k.hand = k.bon - .05; k.fix0 = k.sig; k.fix1 = k.sig + .75; k.stamp = k.tmp + .05;
    const w20 = window.P46 && P46.window('S20');
    k.p20 = w20 ? w20.tIn : tw('S20', 'vrais', -1.15); k.p20e = w20 ? w20.tEnd : tw('S20', 'avance', 1.4);
    k.dOut0 = Math.min(k.p20 - .15, k.sanc + .7); k.dOut1 = k.dOut0 + .38;
    const a = tw('S20', 'vrais', 0), b = Math.max(tw('S20', 'complets', 0), a + .7), cc = Math.max(tw('S20', 'avance', 0), b + .7);
    k.chips = [a, b, cc];
    return (K = k);
  }
  let SHK = false;
  function lazyShakes() {
    if (SHK) return; SHK = true; const k = keys();
    addShake(k.drive1 - .1, 3, .12);                                                      // the truck brakes under the arch
    addShake(k.hit, 16, .18);                                                             // the AMENDE container crashes on the balance
    addShake(k.stamp, 8, .12);                                                            // « SIGNALÉE À TEMPS »
    addShake(k.bi1 - .12, 3, .1);                                                         // the balance lands (insert)
    addShake(k.bo1 - .02, 2, .08);                                                        // … and settles back on the ledge (world)
  }

  // =============================================================================================
  // WORLD — the arch
  // =============================================================================================
  function glowK(t) { const k = keys(); return clamp(prog(t, k.glow0, k.glow0 + .45)) * (1 - clamp(prog(t, k.glow1, k.glow1 + .7))); }
  function beamX(t) { const k = keys(), c = cont(); return lerp(AX - c.w / 2 - 30, AX + c.w / 2 + 50, eInOutCubic(prog(t, k.beam0, k.beam1))); }
  function archBack(t, n) {
    const x0 = AR.x0 + AR.pw, x1 = AR.x1 - AR.pw, y0 = AR.top + AR.bh;
    // the tunnel's inside (a darker paper flat behind the truck)
    ctx.fillStyle = '#C9C2B4'; ctx.fillRect(x0, y0, x1 - x0, GROUND - y0);
    ctx.fillStyle = 'rgba(40,30,50,.10)'; for (let x = x0 + 40; x < x1; x += 80) ctx.fillRect(x, y0, 3, GROUND - y0);
    const g = glowK(t);
    if (g > 0) {                                                                          // local cyan glow (never the whole frame)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, y0, 0, GROUND); gr.addColorStop(0, `rgba(80,210,255,${.34 * g})`); gr.addColorStop(1, `rgba(80,210,255,${.08 * g})`);
      ctx.fillStyle = gr; ctx.fillRect(x0, y0, x1 - x0, GROUND - y0);
      ctx.restore();
    }
  }
  function archFront(t, n) {
    const { x0, x1, pw, top, bh } = AR, g = glowK(t), k = keys();
    // pillars (with a side face for depth)
    for (const px of [x0, x1 - pw]) {
      withShadow(12, () => { ctx.fillStyle = '#D9D2C4'; ctx.fillRect(px, top, pw, GROUND - top); });
      ctx.fillStyle = '#BDB5A6'; ctx.fillRect(px + pw - 14, top + bh, 14, GROUND - top - bh);
      ctx.fillStyle = DC.yellow; for (let y = GROUND - 150; y < GROUND - 10; y += 44) { ctx.save(); ctx.beginPath(); ctx.rect(px, y, pw, 22); ctx.clip();
        ctx.fillStyle = '#231629'; for (let s = -2; s < 6; s++) { ctx.beginPath(); ctx.moveTo(px + s * 26, y + 22); ctx.lineTo(px + s * 26 + 13, y + 22); ctx.lineTo(px + s * 26 + 35, y); ctx.lineTo(px + s * 26 + 22, y); ctx.closePath(); ctx.fill(); } ctx.restore(); }
      ctx.fillStyle = 'rgba(35,22,41,.18)'; ctx.fillRect(px, GROUND - 160, pw, 4);
    }
    // the beam
    withShadow(14, () => { ctx.fillStyle = '#E4DDCF'; ctx.fillRect(x0 - 20, top, x1 - x0 + 40, bh); });
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 - 20, top, x1 - x0 + 40, 6);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20, top + bh - 22, x1 - x0 + 40, 22); ctx.clip(); ctx.fillStyle = DC.yellow; ctx.fillRect(x0 - 20, top + bh - 22, x1 - x0 + 40, 22);
    ctx.fillStyle = '#231629'; for (let x = x0 - 40; x < x1 + 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, top + bh); ctx.lineTo(x + 18, top + bh); ctx.lineTo(x + 40, top + bh - 22); ctx.lineTo(x + 22, top + bh - 22); ctx.closePath(); ctx.fill(); } ctx.restore();
    text('SCANNER', AX - 60, top + 66, { font: font(FF.stencil, 64, 900), align: 'center', color: C.ink, ls: 8 });
    // emitter strip under the beam (cyan LEDs light up with the scan)
    ctx.fillStyle = '#3A3040'; ctx.fillRect(x0 + pw, top + bh, x1 - x0 - 2 * pw, 16);
    for (let x = x0 + pw + 24, i = 0; x < x1 - pw - 10; x += 46, i++) { const on = g > 0 ? .35 + .65 * g * (.6 + .4 * Math.sin(stepT(n) * 9 + i)) : 0;
      ctx.fillStyle = on > 0 ? `rgba(139,235,255,${on})` : '#1E2A33'; ctx.fillRect(x, top + bh + 4, 22, 8); }
    // status lamp on the left pillar: amber while scanning, green from « Tout correspond »
    const lx = x0 + pw / 2, ly = top + bh + 70, ok = t >= k.corr, scanning = g > .05 && !ok;
    ctx.fillStyle = '#2B2230'; rrect(lx - 24, ly - 24, 48, 48, 10); ctx.fill();
    const col = ok ? '#2BD47E' : scanning ? (Math.floor(stepT(n) * 3) % 2 ? '#F3A745' : '#9A6420') : '#4A4150';
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx, ly, 15, 0, 7); ctx.fill();
    if (ok || scanning) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(lx, ly, 4, lx, ly, 60); gg.addColorStop(0, ok ? 'rgba(43,212,126,.5)' : 'rgba(243,167,69,.45)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(lx - 60, ly - 60, 120, 120); ctx.restore(); }
    // the scanning curtain (a vertical sheet of cyan light) + a light pool on the stage floor
    if (g > 0) {
      const bx = beamX(t), bk = env(t, keys().beam0 - .05, keys().beam1 + .05, .2, .2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pool = ctx.createRadialGradient(AX, GROUND + 20, 20, AX, GROUND + 20, 520); pool.addColorStop(0, `rgba(90,220,255,${.22 * g})`); pool.addColorStop(1, 'rgba(90,220,255,0)');
      ctx.fillStyle = pool; ctx.beginPath(); ctx.ellipse(AX, GROUND + 20, 520, 70, 0, 0, 7); ctx.fill();
      if (bk > 0) { const gr = ctx.createLinearGradient(bx - 70, 0, bx + 16, 0); gr.addColorStop(0, 'rgba(90,220,255,0)'); gr.addColorStop(.8, `rgba(150,240,255,${.55 * bk})`); gr.addColorStop(1, `rgba(220,252,255,${.9 * bk})`);
        ctx.fillStyle = gr; ctx.fillRect(bx - 70, top + bh + 16, 86, GROUND - top - bh - 16); ctx.fillStyle = `rgba(235,253,255,${.95 * bk})`; ctx.fillRect(bx - 2, top + bh + 16, 5, GROUND - top - bh - 16); }
      ctx.restore();
    }
  }

  // =============================================================================================
  // WORLD — the truck (exported) and the scan slit on the container
  // =============================================================================================
  /** plain flatbed truck, cab-over, facing right. origin = ground under the container centre. o: { spin (wheel angle), n, idle } */
  function truck28(o = {}) {
    const A = cont(), deck = A.deck, spin = o.spin || 0, n = o.n || 0;
    const wheel = x => at(x, -44, spin, 1, 1, () => { ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill();
      ctx.fillStyle = '#9A9FA6'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill(); ctx.strokeStyle = '#231629'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 2.09) * 20, Math.sin(i * 2.09) * 20); ctx.stroke(); } });
    // chassis
    withShadow(6, () => { ctx.fillStyle = '#2B2230'; ctx.fillRect(-372, -deck, 790, 28); });
    ctx.fillStyle = '#3A3040'; ctx.fillRect(-360, -deck + 28, 760, 12);
    ctx.fillStyle = '#4A4150'; for (const x of [-300, -120, 60, 240]) ctx.fillRect(x, -deck + 8, 26, 12);
    ctx.fillStyle = '#231629'; rrect(-330, -94, 250, 26, 10); ctx.fill();                      // rear mudguard
    wheel(-266); wheel(-150); wheel(480);
    // exhaust stack behind the cab
    ctx.fillStyle = '#9A9FA6'; rrect(372, -470, 14, 370, 6); ctx.fill(); ctx.fillStyle = '#6E737A'; ctx.fillRect(372, -470, 14, 10);
    // the cab (cab-over, side view, windscreen on the right)
    const iy = o.idle ? Math.round(Math.sin(n * 2.1)) * 1.5 : 0;
    ctx.save(); ctx.translate(0, iy);
    withShadow(10, () => { ctx.fillStyle = CAB; ctx.beginPath(); ctx.moveTo(392, -74); ctx.lineTo(392, -420); ctx.lineTo(552, -420); ctx.quadraticCurveTo(586, -420, 588, -380); ctx.lineTo(592, -74); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(392, -420, 180, 8);
    ctx.fillStyle = '#5A5060'; ctx.fillRect(392, -150, 200, 14);                                // stripe
    ctx.fillStyle = '#9CC3E6'; ctx.beginPath(); ctx.moveTo(470, -392); ctx.lineTo(560, -392); ctx.quadraticCurveTo(572, -392, 574, -376); ctx.lineTo(576, -270); ctx.lineTo(470, -270); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(480, -386); ctx.lineTo(500, -386); ctx.lineTo(478, -278); ctx.lineTo(472, -278); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.arc(514, -318, 22, 0, 7); ctx.fill(); ctx.fillRect(492, -298, 44, 28);   // the driver (generic silhouette)
    ctx.fillStyle = '#231629'; ctx.beginPath(); ctx.ellipse(516, -336, 26, 9, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(35,22,41,.35)'; ctx.lineWidth = 3; ctx.strokeRect(460, -404, 124, 316);                            // door
    ctx.fillStyle = '#6E737A'; ctx.fillRect(480, -176, 24, 7);                                                                  // handle
    ctx.fillStyle = '#6E737A'; ctx.fillRect(596, -398, 6, 80); ctx.fillStyle = '#231629'; rrect(596, -338, 16, 40, 4); ctx.fill();   // mirror
    ctx.fillStyle = '#3A3040'; rrect(580, -104, 26, 34, 6); ctx.fill();                                                          // bumper
    ctx.fillStyle = C.amber; rrect(584, -130, 12, 18, 4); ctx.fill();                                                           // light
    ctx.fillStyle = '#231629'; rrect(420, -76, 150, 12, 5); ctx.fill();                                                         // step
    ctx.restore();
    // the container, as on the quay (20_quai)
    if (typeof window.A20_container === 'function') at(0, -deck, 0, 1, 1, () => window.A20_container({ n }));
    else { ctx.fillStyle = A.color; ctx.fillRect(-A.w / 2, -deck - A.h, A.w, A.h); }
  }
  window.D28_truck = truck28;
  /** x-ray negative of the container side (navy + cyan outlines of the stacked shoe boxes with sneakers), origin = bottom centre */
  function xShoe(s) {
    ctx.beginPath(); ctx.moveTo(-.5 * s, .16 * s); ctx.lineTo(.48 * s, .16 * s); ctx.quadraticCurveTo(.54 * s, -.02 * s, .3 * s, -.06 * s);
    ctx.lineTo(.04 * s, -.14 * s); ctx.quadraticCurveTo(-.12 * s, -.32 * s, -.32 * s, -.3 * s); ctx.lineTo(-.47 * s, -.28 * s); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-.5 * s, .06 * s); ctx.lineTo(.46 * s, .06 * s); ctx.stroke();
  }
  function xrayPattern(x0, y0, w, h, cols, rows, o = {}) {
    ctx.fillStyle = NAVY; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(139,235,255,.18)'; ctx.lineWidth = Math.max(1, w / 400); for (let x = x0; x < x0 + w; x += w / 14) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + h); ctx.stroke(); }
    const pad = w * .04, bw = (w - 2 * pad) / cols, bh = (h - 2 * pad) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const bx = x0 + pad + c * bw, by = y0 + pad + r * bh, lit = o.rowLit != null ? (o.rowLit(r) ?? 1) : 1;
      ctx.save(); ctx.globalAlpha *= lit;
      ctx.fillStyle = 'rgba(139,235,255,.10)'; ctx.fillRect(bx + bw * .06, by + bh * .08, bw * .88, bh * .84);
      ctx.strokeStyle = CYAN; ctx.lineWidth = Math.max(1.5, bw * .035); ctx.strokeRect(bx + bw * .06, by + bh * .08, bw * .88, bh * .84);
      ctx.lineWidth = Math.max(1.2, bw * .028); at(bx + bw / 2, by + bh * .58, 0, 1, 1, () => xShoe(Math.min(bw * .72, bh * 1.3)));
      ctx.restore();
    }
    ctx.strokeStyle = CYAN; ctx.lineWidth = Math.max(2, w / 160); ctx.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
  }
  function scanSlit(t, cx) {                                                             // the negative shows inside (and just behind) the curtain
    const k = keys(), A = cont(); if (t < k.beam0 - .05 || t > k.beam1 + .7) return;
    const bx = beamX(t), fade = 1 - clamp(prog(t, k.beam1, k.beam1 + .6));
    const sx0 = cx - A.w / 2 + 20, sy0 = GROUND - A.deck - A.h + 16, sw = A.w - 40, sh = A.h - 34;
    ctx.save(); ctx.beginPath(); ctx.rect(sx0, sy0, sw, sh); ctx.clip();
    const g = ctx.createLinearGradient(bx - 260, 0, bx, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.7, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    const off = makeCanvasCached('d28slit', 760, 420), og = off.getContext('2d');
    // draw the x-ray pattern into an offscreen canvas, then mask it with the moving gradient
    og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, 760, 420); og.globalCompositeOperation = 'source-over';
    const main = ctx; try { ctx = og; xrayPattern(0, 0, sw, sh, 6, 3); } finally { ctx = main; }
    og.globalCompositeOperation = 'destination-in';
    const lg = og.createLinearGradient(bx - sx0 - 280, 0, bx - sx0 + 6, 0); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(.75, 'rgba(0,0,0,.9)'); lg.addColorStop(1, 'rgba(0,0,0,1)');
    og.fillStyle = lg; og.fillRect(0, 0, Math.max(0, Math.min(760, bx - sx0 + 6)), 420); og.globalCompositeOperation = 'source-over';
    og.clearRect(Math.max(0, bx - sx0 + 6), 0, 760, 420);
    ctx.globalAlpha *= fade; ctx.drawImage(off, sx0, sy0);
    ctx.restore();
  }
  /** truck position while at the scanner: rolls in from the left during S16, then parked */
  function truckState(t) {
    const k = keys(), c = containerAt(t); if (!c || !c.onTruck || c.moving || Math.abs(c.x - AX) > 1) return null;
    const D0 = 900, u = prog(t, k.drive0, k.drive1), e = u * u * (3 - 2 * u), x = c.x - D0 * (1 - e);
    return { x, moving: u > 0 && u < 1, spin: -(x - c.x) / 44, idle: u <= 0 };
  }
  function truckThread(x, n) {                                                            // the violet thread still tied to the lashing ring
    const A = cont(), p1 = [x + 120, GROUND - A.deck - 12], p0 = [x + 60, GROUND + 80];
    thread([p0, [lerp(p0[0], p1[0], .5) - 16, lerp(p0[1], p1[1], .5) + 10], p1], 1, n, { w: 7, color: C.violet });
    ctx.fillStyle = C.violetD; ctx.beginPath(); ctx.arc(p1[0], p1[1] + 2, 8, 0, 7); ctx.fill();
  }

  // =============================================================================================
  // WORLD — the officer's booth, the officer, the ledge props, the balance
  // =============================================================================================
  function lightboxImage(x, y, w, h, on) {
    withShadow(6, () => { ctx.fillStyle = '#3A3040'; rrect(x - w / 2 - 8, y - h / 2 - 8, w + 16, h + 16, 8); ctx.fill(); });
    if (on <= 0) { ctx.fillStyle = '#1B2530'; ctx.fillRect(x - w / 2, y - h / 2, w, h); return; }
    ctx.save(); ctx.globalAlpha *= clamp(on); xrayPattern(x - w / 2, y - h / 2, w, h, 4, 3); ctx.restore();
    if (on < 1) { ctx.fillStyle = `rgba(27,37,48,${1 - on})`; ctx.fillRect(x - w / 2, y - h / 2, w, h); }
  }
  function bookCover(w, h, o = {}) {                                                     // « LA DOUANE COMPARE », closed, centred
    withShadow(o.lift ?? 5, () => { ctx.fillStyle = DC.green; rrect(-w / 2, -h / 2, w, h, 6); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-w / 2, -h / 2, w * .12, h);
    ctx.strokeStyle = 'rgba(246,197,74,.85)'; ctx.lineWidth = Math.max(1.5, w * .025); rrect(-w / 2 + w * .16, -h / 2 + h * .07, w * .76, h * .86, 4); ctx.stroke();
    if (o.title !== false) { const f = font(FF.stencil, w * .2, 900);
      ['LA', 'DOUANE', 'COMPARE'].forEach((s, i) => text(s, w * .06, -h * .16 + i * w * .21, { font: f, align: 'center', color: DC.yellow, ls: 1 })); }
  }
  function boothBack(t, n) {
    const k = keys();
    withShadow(14, () => { ctx.fillStyle = '#D3E0DA'; ctx.fillRect(BO.x0 + 8, BO.roof, BO.x1 - BO.x0 - 16, GROUND - BO.roof); });
    ctx.strokeStyle = 'rgba(40,70,60,.10)'; ctx.lineWidth = 3; for (let x = BO.x0 + 50; x < BO.x1 - 10; x += 48) { ctx.beginPath(); ctx.moveTo(x, BO.roof + 10); ctx.lineTo(x, GROUND); ctx.stroke(); }
    // shelf + the book (it goes into the officer's hand during S17 B)
    ctx.fillStyle = C.kraftD; ctx.fillRect(SH.x - 58, SH.y, 116, 10);
    const bookOut = t >= k.swapB + .2 && t < k.cOut1 + .15;
    if (!bookOut) at(SH.x + 4, SH.y - 44, 0, 1, 1, () => bookCover(64, 88, { title: false }));
    ctx.fillStyle = '#7B22D6'; ctx.fillRect(SH.x - 44, SH.y - 60, 16, 60); ctx.fillStyle = '#1D4577'; ctx.fillRect(SH.x - 26, SH.y - 52, 14, 52);
    // lightbox: the cyan image appears when the scan ends and stays
    lightboxImage(LB.x, LB.y, LB.w, LB.h, clamp(prog(t, k.glow1 - .2, k.glow1 + .4)));
  }
  // --- the officer ---
  const PROP_LIST = () => at(0, -30, -.06, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-60, -80, 120, 160); });
    ctx.fillStyle = C.amber; ctx.fillRect(-60, -80, 120, 28); ctx.strokeStyle = 'rgba(199,122,18,.7)'; ctx.lineWidth = 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.strokeRect(-48 + c * 24, -38 + r * 36, 18, 22); });
  const PROP_INV = () => at(0, -30, .05, 1, 1, () => { withShadow(4, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-60, -80, 120, 160); });
    ctx.fillStyle = C.violetD; ctx.fillRect(-60, -80, 120, 28); ctx.fillStyle = 'rgba(35,22,41,.2)'; for (let i = 0; i < 4; i++) ctx.fillRect(-46, -36 + i * 30, 80 - (i % 2) * 30, 6);
    ctx.fillStyle = 'rgba(243,167,69,.5)'; ctx.fillRect(-54, 22, 108, 24); ctx.fillStyle = C.violet; ctx.fillRect(-40, 30, 60, 9); });
  const PROP_BOOK = () => at(10, -40, 0, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = DC.green; rrect(-118, -78, 236, 150, 8); ctx.fill(); });
    ctx.fillStyle = '#FBF6EC'; ctx.fillRect(-110, -72, 108, 138); ctx.fillRect(2, -72, 108, 138);
    ctx.fillStyle = 'rgba(35,22,41,.18)'; for (let i = 0; i < 5; i++) { ctx.fillRect(-98, -50 + i * 22, 84, 5); } ctx.fillStyle = 'rgba(14,107,78,.35)'; ctx.fillRect(18, -10, 76, 34); });
  const PROP_PENCIL = () => at(0, -20, -.7, 1, 1, () => { ctx.fillStyle = C.amber; rrect(-9, -90, 18, 110, 4); ctx.fill(); ctx.fillStyle = '#E8C9A0'; ctx.beginPath(); ctx.moveTo(-9, 20); ctx.lineTo(9, 20); ctx.lineTo(0, 44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.moveTo(-3, 36); ctx.lineTo(3, 36); ctx.lineTo(0, 44); ctx.closePath(); ctx.fill(); });
  const REST = [92, 172];
  function officerX(t) { return OFX; }
  function officerState(t, n) {
    const k = keys(), o = { face: 'smile', arms: [REST, REST], look: 0, blink: ((t + .7) % 4.1) < .12 }; let extra = null;
    if (t < k.cmp - 1.3) o.look = t > k.drive0 && t < k.glow1 ? -.7 : -.3;                          // S16: he watches the truck and the scan
    else if (t < k.swapB) {                                                                         // S17 A: the list + pointing at the lightbox
      const up = clamp(prog(t, k.cmp - 1.3, k.cmp - .9));
      o.arms = [[lerp(REST[0], 70, up), lerp(REST[1], 130, up)], t >= k.cmp - .25 ? 'point' : REST]; if (up > .5) { o.handProp = PROP_LIST; o.handSide = -1; }
      o.look = t >= k.lst - .15 ? -.3 : .55; o.face = 'smile';
    } else if (t < k.cOut1 + .15) {                                                                 // S17 B: invoice (left) + the book (right)
      const reach = env(t, k.swapB, k.swapB + .45, .2, .2);
      o.arms = [reach > 0 ? [lerp(70, 224, reach), lerp(150, -380, reach)] : [70, 150], [70, 130]]; o.face = 'smile'; o.look = -.2;
      o.handProp = PROP_INV; o.handSide = 1; if (t >= k.swapB + .2) extra = { at: [70, 150], draw: PROP_BOOK };
    } else if (t < k.nod1 + .6) {                                                                   // the nod (friendly): all good
      o.face = 'smile'; const s = prog(t, k.nod0, k.nod1); o.tilt = Math.sin(s * Math.PI * 3) * .07 * (1 - s); o.look = -.2;
    } else if (t < k.bal0) o.look = -.5;
    else if (t < k.up1) { o.look = t < k.hit ? -.4 : .5; if (t > k.hit + .1 && t < k.hit + 1.2) { const s = prog(t, k.hit + .1, k.hit + 1.2); o.tilt = Math.sin(s * Math.PI * 2) * .06 * (1 - s); } }   // watches the balance, a knowing nod
    else if (t < k.dOut1 + .3) {                                                                    // S20: the declaration, the correction, the stamp
      o.look = -.4; o.face = t > k.stamp ? 'smile' : 'think';
      if (t > k.fix0 - .3 && t < k.fix1 + .15) { const j = Math.sin(stepT(n) * 24) * 8; o.arms = [REST, [150 + j, 120]]; o.handProp = PROP_PENCIL; o.handSide = 1; }
      else if (t > k.stamp - .35 && t < k.stamp + .25) o.arms = [REST, [150, t < k.stamp ? 40 : 150]];
    } else if (t < k.chips[2] + 1.6) { o.look = -.3; const s = prog(t, k.chips[2], k.chips[2] + .9); o.tilt = Math.sin(s * Math.PI * 2) * .05 * (1 - s); }
    return { o, extra };
  }
  function officerDraw(t, n) {
    const { o, extra } = officerState(t, n), x = officerX(t), moving = Math.abs(officerX(t + .05) - x) > .5;
    at(x, feetY, 0, FIG_S, FIG_S, () => { officerFig(Object.assign({ walk: moving ? stepT(n) * 1.9 : null }, o)); if (extra) at(-extra.at[0], extra.at[1], 0, 1, 1, extra.draw); });
  }
  // --- booth front + ledge props ---
  function trayProps(t) {
    const x = TRAY.x, y = BO.ledge;
    ctx.fillStyle = '#5A4A3A'; ctx.fillRect(x - 62, y - 50, 124, 6);
    [[C.amber, -.03, 0], [C.violetD, .04, 6], [DC.green, -.01, 12]].forEach(([c, r, dx]) => at(x - 6 + dx, y - 6, r, 1, 1, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-46, -58, 92, 58); ctx.fillStyle = c; ctx.fillRect(-46, -58, 92, 12); }));
    withShadow(4, () => { ctx.fillStyle = '#7A5A3A'; rrect(x - 66, y - 24, 132, 24, 5); ctx.fill(); });
  }
  function boothFront(t, n) {
    const { x0, x1, roof, ledge } = BO;
    withShadow(12, () => { ctx.fillStyle = '#D8CCB2'; ctx.fillRect(x0, ledge + 18, x1 - x0, GROUND - ledge - 18); });
    ctx.strokeStyle = 'rgba(90,60,30,.25)'; ctx.lineWidth = 3; for (let x = x0 + 85; x < x1 - 20; x += 85) { ctx.beginPath(); ctx.moveTo(x, ledge + 26); ctx.lineTo(x, GROUND - 8); ctx.stroke(); }
    ctx.fillStyle = DC.green; rrect(x0 + 40, ledge + 70, x1 - x0 - 80, 16, 6); ctx.fill();
    ctx.fillStyle = '#BFAF8F'; ctx.fillRect(x0, roof, 24, ledge - roof); ctx.fillRect(x1 - 24, roof, 24, ledge - roof);
    // ledge (the guichet)
    withShadow(8, () => { ctx.fillStyle = C.kraftD; ctx.fillRect(x0 - 34, ledge, x1 - x0 + 68, 22); });
    ctx.fillStyle = 'rgba(255,240,210,.3)'; ctx.fillRect(x0 - 34, ledge, x1 - x0 + 68, 5);
    // roof + sign « CONTRÔLE »
    withShadow(12, () => { ctx.fillStyle = DC.green; rrect(x0 - 36, roof - 74, x1 - x0 + 72, 82, 10); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(x0 - 36, roof - 74, x1 - x0 + 72, 6);
    text('CONTRÔLE', (x0 + x1) / 2, roof - 16, { font: font(FF.stencil, 56, 900), align: 'center', color: DC.yellow, ls: 5 });
    trayProps(t);
  }
  // --- the S19 balance: ONE paper beam balance on a string from the flies. It comes down as a big screen insert (on a taped
  //     paper board) as the camera reaches the booth; the AMENDE container crashes its pan down on « amende »; « jusqu'à la
  //     valeur / de la marchandise » is hand-lettered on the board from « valeur »; then the balance shrinks back into the
  //     world (hanging over the ledge, the heavy pan resting on it) and is pulled back up to the flies as S20 opens.
  //     balanceArt() draws it in its own units (origin = pivot; = screen px in the insert); the world draws it at BAL.ws. ---
  const WOOD = '#6B4A2A';
  function balanceTheta(t) {
    const k = keys(), rest = -.035 + Math.sin(t * 2.2) * .008;                                    // a tiny coin: it barely tips
    if (t < k.hit) { const s = t - (k.bi1 - .15); return rest + (s > 0 ? .07 * Math.exp(-s * 3.2) * Math.sin(s * 7.5) : 0); }   // settles after landing
    const s = t - k.hit; if (s < .08) return lerp(rest, BI.th, (s / .08) * (s / .08));
    return BI.th - Math.abs(Math.exp(-s * 6) * Math.sin(s * 22)) * .07;                          // crash + small bounces
  }
  function amendeBox(w, h) {                                                                      // the fine: a whole container. origin = bottom centre
    const A = cont(), col = A.color || '#2E6B8A', d = 18;
    ctx.fillStyle = '#224F66'; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 + d, -d * .6); ctx.lineTo(w / 2 + d, -h - d * .6); ctx.lineTo(w / 2, -h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4A8CAD'; ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(w / 2, -h); ctx.lineTo(w / 2 + d, -h - d * .6); ctx.lineTo(-w / 2 + d, -h - d * .6); ctx.closePath(); ctx.fill();
    withShadow(10, () => { ctx.fillStyle = col; ctx.fillRect(-w / 2, -h, w, h); });
    for (let x = -w / 2 + 10; x < w / 2 - 8; x += 20) { ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(x, -h + 10, 8, h - 20); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x + 8, -h + 10, 4, h - 20); }
    ctx.fillStyle = '#224F66'; ctx.fillRect(-w / 2, -h, w, 10); ctx.fillRect(-w / 2, -10, w, 10);
    const f = font(FF.stencil, 70, 900), lw = Math.max(measure('AMENDE', f, 3) + 36, w * .8);
    at(0, -h / 2, -.025, 1, 1, () => { withShadow(3, () => { ctx.fillStyle = C.cream; ctx.fillRect(-lw / 2, -46, lw, 92); });
      text('AMENDE', 0, 26, { font: f, align: 'center', color: DC.red, ls: 3 }); });
  }
  function balPan(w, d) {                                                                         // origin = rim centre, bowl d deep
    ctx.fillStyle = '#B8A06A'; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, d * 2, w / 2, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,238,200,.35)'; ctx.beginPath(); ctx.ellipse(-w * .18, d * .45, w * .16, d * .16, .08, 0, 7); ctx.fill();
    ctx.fillStyle = '#8E7440'; rrect(-w / 2 - 5, -6, w + 10, 12, 6); ctx.fill();
  }
  function kraftTag(lines, col, size, swing) {                                                    // hangs from (0,0): thread + kraft tag, hand-lettered lines
    const f = font(FF.hand, size, 800), w = Math.max(...lines.map(l => measure(l, f))) + 50, lh = size * 1.02, top = 22, h = 44 + lines.length * lh;
    at(0, 0, swing, 1, 1, () => {
      ctx.strokeStyle = 'rgba(60,40,20,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, top + 16); ctx.stroke();
      withShadow(6, () => { ctx.fillStyle = C.kraftL; ctx.beginPath(); ctx.moveTo(-w / 2 + 24, top); ctx.lineTo(w / 2 - 24, top); ctx.lineTo(w / 2, top + 24); ctx.lineTo(w / 2, top + h);
        ctx.lineTo(-w / 2, top + h); ctx.lineTo(-w / 2, top + 24); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, top + 16, 9, 0, 7); ctx.fill(); ctx.fillStyle = C.kraftD; ctx.beginPath(); ctx.arc(0, top + 16, 4, 0, 7); ctx.fill();
      lines.forEach((l, i) => text(l, 0, top + 30 + size * .8 + i * lh, { font: f, align: 'center', color: col }));
    });
  }
  function balanceArt(t, n) {
    const k = keys(), th = balanceTheta(t), L = BI.L, S = BI.S, PW = BI.pw, BD = BI.bd;
    const ex = Math.cos(th) * L, ey = Math.sin(th) * L, lx = -ex, ly = -ey, rx = ex, ry = ey;
    // the string up to the flies + the handle ring
    ctx.strokeStyle = 'rgba(35,22,41,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, -2800); ctx.stroke();
    ctx.strokeStyle = WOOD; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, -34, 17, 0, 7); ctx.stroke();
    // the little dial under the pivot: its needle shows the tip
    withShadow(4, () => { ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 92, Math.PI * .22, Math.PI * .78); ctx.closePath(); ctx.fill(); });
    ctx.strokeStyle = 'rgba(35,22,41,.55)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let j = -2; j <= 2; j++) { const a = Math.PI / 2 + j * .16, r0 = j ? 72 : 64; ctx.strokeStyle = j ? 'rgba(35,22,41,.5)' : '#1FA86A';
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * 86, Math.sin(a) * 86); ctx.stroke(); }
    // pans: strings, bowls; the coin + its tag on the left
    for (const [ax, ay] of [[lx, ly], [rx, ry]]) { const pb = ay + S;
      ctx.strokeStyle = 'rgba(60,40,20,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - PW * .46, pb); ctx.moveTo(ax, ay); ctx.lineTo(ax + PW * .46, pb); ctx.stroke();
      at(ax, pb, 0, 1, 1, () => balPan(PW, BD)); }
    const s = t - k.hit, hop = s > 0 && s < .7 ? Math.sin(s / .7 * Math.PI) * 120 : 0, lpb = ly + S;
    at(lx + 10, lpb - 12 - hop, s > 0 && s < .7 ? s * 9 : 0, 1, 1, () => coin(28, '', { tilt: .5 }));      // the tiny coin « le droit en moins »
    const gl = env(t, k.bi1 - .05, Math.min(k.bi1 + .7, k.drop0 + .15), .15, .3);                         // a glint on it as the balance lands
    if (gl > 0) at(lx + 30, lpb - 30, 0, gl, gl, () => { ctx.fillStyle = '#FFF6D0'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 26; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); });
    const sw = .035 * Math.sin(t * 1.7) + (s > 0 ? .2 * Math.exp(-s * 2.6) * Math.sin(s * 8) : 0) + .12 * Math.exp(-Math.max(0, t - k.bi1) * 3) * Math.sin(Math.max(0, t - k.bi1) * 6);
    at(lx, lpb + BD + 2, 0, 1, 1, () => kraftTag(['le droit', 'en moins'], C.ink, 60, sw));
    // beam + needle + pivot
    withShadow(8, () => { ctx.strokeStyle = WOOD; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(rx, ry); ctx.stroke(); });
    ctx.strokeStyle = 'rgba(255,230,190,.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(lx * .94, ly * .94 - 5); ctx.lineTo(rx * .94, ry * .94 - 5); ctx.stroke();
    for (const [ax, ay] of [[lx, ly], [rx, ry]]) { ctx.fillStyle = WOOD; ctx.beginPath(); ctx.arc(ax, ay, 13, 0, 7); ctx.fill(); }
    at(0, 0, th, 1, 1, () => { ctx.fillStyle = WOOD; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(0, 84); ctx.closePath(); ctx.fill(); });
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill(); ctx.fillStyle = WOOD; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
    // the fine: a whole container falls from the flies into the right pan (in front of everything), the pan's rim over its foot
    if (t >= k.drop0) {
      const dk = prog(t, k.drop0, k.hit), fall = (1 - dk * dk) * 1400, rpb = ry + S;
      const sq = t > k.hit ? Math.exp(-(t - k.hit) * 9) * Math.cos((t - k.hit) * 38) * .07 : 0;
      if (dk > 0 && dk < 1) { ctx.save(); ctx.strokeStyle = 'rgba(35,22,41,.28)'; ctx.lineWidth = 6; ctx.lineCap = 'round';          // speed lines
        for (const dx of [-90, 0, 90]) { ctx.beginPath(); ctx.moveTo(rx + dx, rpb - fall - 190 - 160 * dk); ctx.lineTo(rx + dx, rpb - fall - 190); ctx.stroke(); } ctx.restore(); }
      at(rx, rpb - 2 - fall, 0, 1 + sq, 1 - sq, () => amendeBox(296, 150));
      ctx.fillStyle = '#8E7440'; rrect(rx - PW / 2 - 5, rpb - 6, PW + 10, 12, 6); ctx.fill();
      if (s > 0 && s < .45) { const p = s / .45; ctx.fillStyle = `rgba(230,210,180,${.8 * (1 - p)})`;                                // paper dust from the crash
        for (let i = 0; i < 6; i++) { const sd = i % 2 ? 1 : -1, j = Math.floor(i / 2); ctx.beginPath();
          ctx.arc(rx + sd * (PW / 2 + 10 + p * (150 + 40 * j)), rpb + 10 - p * (30 + 30 * j) * rnd(i + 3), 12 + p * 30, 0, 7); ctx.fill(); } }
    }
  }
  /** SCREEN: the insert (board + balance), from the flies to the slot, then back into its world spot */
  function balanceInsert(t, n) {
    const k = keys(); if (t < k.bi0 || t >= k.bo1) return;
    const sh = shake(t, n), q = eInOutCubic(prog(t, k.bo0, k.bo1)), ci = prog(t, k.bi0, k.bi0 + .3), co = prog(t, k.co0, k.co1);
    ctx.save(); ctx.translate(sh.x * .7, sh.y * .7);
    // the board (taped paper) is pinned first, carries the hand-lettered line, and is unpinned just before the balance goes back
    const ca = clamp(ci * 6) * (1 - co), cs = lerp(.9, 1, eOutBack(ci, 1.6)) * lerp(1, .96, co), B = BI.card;
    if (ca > 0) { ctx.save(); ctx.globalAlpha *= ca;
      at(B.x, B.y, 0, cs, cs, () => paperNote(0, 0, B.w, B.h, -.006, () => {
        const x = BI.x - B.x + 30;
        handText("jusqu'à la valeur", x, 205, 62, { write: prog(t, k.wr0, k.wr1), color: DC.red });
        handText('de la marchandise', x, 282, 62, { write: prog(t, k.wr1, k.wr2), color: DC.red });
      }, { fill: '#F4EBDA', seed: 23, h: 14 }));
      ctx.restore(); }
    const u = prog(t, k.bi0 + .05, k.bi1), dropIn = (1 - eOutBack(u, 1.2)) * 1150;
    const w0 = worldToScreen(BAL.x, BAL.piv, t), zs = BAL.ws * camAt(t).z;
    const x = lerp(BI.x, w0.x - sh.x * .7, q), y = lerp(BI.y - dropIn, w0.y - sh.y * .7, q), s = lerp(1, zs, q);
    at(x, y, 0, s, s, () => balanceArt(t, n));
    ctx.restore();
  }
  /** WORLD: the balance hanging over the ledge after the insert, then pulled back up to the flies */
  function balance(t, n) {
    const k = keys(); if (t < k.bo1 || t > k.rise1) return;
    const lift = eInCubic(prog(t, k.rise0, k.rise1)) * 1500;
    at(BAL.x, BAL.piv - lift, 0, BAL.ws, BAL.ws, () => balanceArt(t, n));
  }
  // --- the S20 declaration standing on the ledge (world) ---
  function declSmall(t) {
    const k = keys(); if (t < ss('S19', 0) || t > k.chips[2] + 3) return;                   // already on the ledge when the camera reaches the booth
    at(DECL.x, BO.ledge, -.03, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-56, -104, 112, 104); });
      ctx.fillStyle = DC.green; ctx.fillRect(-56, -104, 112, 20); ctx.fillStyle = 'rgba(35,22,41,.2)'; for (let i = 0; i < 3; i++) ctx.fillRect(-44, -72 + i * 18, 76 - (i % 2) * 20, 5);
      if (t > k.circ + .5) { ctx.strokeStyle = M.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-14, -18, 30, 10, 0, 0, 7); ctx.stroke(); }
      if (t > k.stamp) { ctx.strokeStyle = DC.blue; ctx.lineWidth = 3; ctx.strokeRect(12, -64, 36, 20); } });
  }

  // =============================================================================================
  // WORLD — Junior: the paper heart, held breath, the puff
  // =============================================================================================
  function beat(t, per) { const ph = ((t % per) + per) % per / per; return Math.exp(-ph * 30) + .6 * Math.exp(-Math.max(0, ph - .17) * 30) * (ph > .17 ? 1 : 0); }
  function heart(t, n) {
    const k = keys(), st = actorAt('junior', t); if (!st || t < k.cm + .4 || t > k.corr + 1.4) return;
    if (!visX(st.x - 100, st.x + 100, t)) return;
    const a = clamp(prog(t, k.cm + .4, k.cm + .9)) * (1 - clamp(prog(t, k.corr + .6, k.corr + 1.4)));
    const per = t < k.resp + .4 ? .5 : t < k.corr ? .72 : 1.1, b = beat(t, per), s = 1 + .32 * b;
    const b0 = walkBob(t, n, st.moving, 'junior'.length);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(st.x, st.y + b0.y); ctx.scale(FIG_S, FIG_S);
    at(-58, 92, -.08, s, s, () => { withShadow(4, () => iconHeart(82, '#E0283C')); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-14, -8, 9, 5, -.6, 0, 7); ctx.fill(); });
    if (b > .35) { ctx.strokeStyle = `rgba(224,40,60,${.8 * b})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (const [dx, dy, r] of [[-120, 60, -.5], [4, 50, .5], [-128, 118, -.2], [12, 118, .2]]) at(dx, dy, r, 1, 1, () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx < -50 ? -22 : 22, 0); ctx.stroke(); }); }
    // held breath (puffed cheeks) while Mireille speaks, then the puff on « Respire »
    const look = st.look ?? 0, hx = look * 8, hy = -150;
    const cheeks = env(t, k.puff0 + .3, k.resp + .15, .25, .12);
    if (cheeks > 0) for (const sx of [-1, 1]) { const cxk = hx + sx * 78, cyk = hy + 46, r = 30 * cheeks;
      ctx.fillStyle = SKIN[1]; ctx.beginPath(); ctx.arc(cxk, cyk, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cxk, cyk, r, sx > 0 ? -1.2 : Math.PI - 1.9, sx > 0 ? 1.9 : Math.PI + 1.2); ctx.stroke();
      ctx.fillStyle = `rgba(255,190,170,${.3 * cheeks})`; ctx.beginPath(); ctx.arc(cxk - sx * 4, cyk - 4, 14 * cheeks, 0, 7); ctx.fill(); }
    const pf = prog(t, k.resp + .15, k.resp + 1.05);
    if (pf > 0 && pf < 1) { ctx.save(); ctx.globalAlpha *= 1 - pf; ctx.fillStyle = '#FFFFFF';
      for (const [dx, dy, r] of [[0, 0, 26], [34, -10, 20], [58, 6, 16]]) { ctx.beginPath(); ctx.arc(hx + 60 + dx + pf * 170, hy + 70 + dy - pf * 40, r * (.6 + pf), 0, 7); ctx.fill(); } ctx.restore(); }
    ctx.restore();
  }

  // =============================================================================================
  // POSES — Junior, Mireille
  // =============================================================================================
  const IDLE = [158, 262], HIP = [175, 200], THUMB = [235, 10], SHOULDER = [236, 44], RAISE = [215, -270];
  const mixA = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
  const win = (t, a, b, fi = .35, fo = .35) => eInOutCubic(clamp(prog(t, a, a + fi))) * (1 - eInOutCubic(clamp(prog(t, b - fo, b))));
  poseHook('junior', (t, st) => {
    const k = keys(); if (t < k.cm || t > k.r21 || (st && st.moving)) return null;               // walking (S21): the walk cycle plays
    if (t < k.tout) return { face: 'worry', look: t < k.glow1 ? .75 : .5 };                         // worried until « Tout correspond »
    if (t < k.out1) return { face: 'grin', look: .2 };
    if (t < k.bj1 + .6) { const h = win(t, k.out1, k.bj1 + .6, .3, .4); return { face: 'grin', arms: [mixA(IDLE, HIP, h), mixA(IDLE, HIP, h)], look: -.4 }; }   // proud
    if (t > k.hit && t < k.hit + 1.1) return { face: 'shock', look: .7 };                         // the AMENDE crash makes him jump
    const r = win(t, k.hand - .1, k.stamp + .7, .35, .4);                                          // he raises his hand at the window
    if (r > 0) return { face: 'smile', arms: ['idle', r > .97 ? 'raise' : mixA(IDLE, RAISE, r)], look: .6 };
    const pr = win(t, k.chips[2] - .3, k.r21, .4, .3);                                            // stands tall, proud
    if (pr > 0) return { face: 'grin', arms: [mixA(IDLE, HIP, pr), mixA(IDLE, HIP, pr)] };
    return { face: 'smile' };
  });
  function mirShoulder(t) { const k = keys(); return win(t, k.resp - .45, k.bub1 + .5, .45, .35); }
  poseHook('mireille', (t, st) => {
    const k = keys(); if (t < k.cm || t > se('S21', 0)) return null;
    const fold = typeof window.MIREILLE_FOLDER22 === 'function';                                   // she keeps her orange-ribboned folder (as in S6–S15)
    if (st && st.moving) return fold ? { handProp: window.MIREILLE_FOLDER22, handSide: -1 } : null;
    const o = fold ? { handProp: window.MIREILLE_FOLDER22, handSide: -1, arms: ['hold', IDLE] } : {};
    const sh = mirShoulder(t), th = win(t, k.bj0 - .15, k.bj1 + .25, .3, .3);
    if (sh > 0) Object.assign(o, { arms: ['hold', mixA(IDLE, SHOULDER, sh)], look: .7, face: 'smile' });   // her hand on Junior's shoulder
    else if (th > 0) Object.assign(o, { arms: ['hold', th > .97 ? 'thumb' : mixA(IDLE, THUMB, th)], look: .6, face: 'grin' });
    else if (t < k.tout) Object.assign(o, { look: .6, face: 'smile' });
    return o;
  });
  /** her hand resting on Junior's shoulder must show IN FRONT of him (actors are drawn Mireille first) */
  function mireilleHandOver(t, n) {
    const sh = mirShoulder(t); if (sh < .96) return; const st = actorAt('mireille', t); if (!st) return;
    const pat = Math.max(0, Math.sin((t - keys().resp) * 5)) * 3;
    ctx.save(); ctx.translate(st.x, st.y); ctx.scale(FIG_S, FIG_S);
    ctx.strokeStyle = SKIN[3]; ctx.lineWidth = 50; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(SHOULDER[0] - 70, SHOULDER[1] + 26); ctx.lineTo(SHOULDER[0], SHOULDER[1] + pat); ctx.stroke();
    ctx.fillStyle = SKIN[3]; ctx.beginPath(); ctx.ellipse(SHOULDER[0] + 6, SHOULDER[1] + pat, 36, 30, -.2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(SHOULDER[0] + 6, SHOULDER[1] + pat, 36, 30, -.2, 0, 7); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(SHOULDER[0] + 12 + i * 10, SHOULDER[1] + pat + 12); ctx.lineTo(SHOULDER[0] + 18 + i * 10, SHOULDER[1] + pat + 26); ctx.stroke(); }
    ctx.restore();
  }

  // =============================================================================================
  // SCREEN — bubbles
  // =============================================================================================
  function paperBubble(x, y, w, h, tail, stroke) {
    withShadow(10, () => { ctx.fillStyle = '#FFFDF7'; rrect(x - w / 2, y - h / 2, w, h, 34); ctx.fill();
      if (tail) { const bx = clamp(tail.x, x - w / 2 + 60, x + w / 2 - 60), by = tail.y < y ? y - h / 2 + 4 : y + h / 2 - 4;
        ctx.beginPath(); ctx.moveTo(bx - 30, by); ctx.lineTo(tail.x, tail.y); ctx.lineTo(bx + 30, by); ctx.closePath(); ctx.fill(); } });
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 5; rrect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16, 28); ctx.stroke(); }
  }
  function mireilleHead(t) { const st = actorAt('mireille', t); return st ? worldToScreen(st.x, st.y - 150 * FIG_S - 40, t) : { x: 150, y: 760 }; }
  function bubbleS16(t) {
    const k = keys(); if (t < k.bub0 || t > k.bub1 + .35) return;
    const kin = clamp(spring(t - k.bub0, 13, .55), 0, 1.1), out = eInCubic(prog(t, k.bub1, k.bub1 + .35)), hd = mireilleHead(t);
    const l1w = measure("C'est un contrôle normal.", font(FF.hand, 50, 800)), w = l1w + 90, h = 236, cx = clamp(40 + w / 2, 0, 540), cy = 520, sc = kin * (1 - out * .3);
    ctx.save(); ctx.globalAlpha *= 1 - out;
    at(cx, cy + out * 60, -.015, sc, sc, () => {
      paperBubble(0, 0, w, h, { x: (hd.x - cx) / sc, y: (hd.y - 30 - cy) / sc }, C.orange);
      const l1 = "C'est un contrôle normal.";
      handText(l1, -w / 2 + 42, -h / 2 + 92, 50, { align: 'left', write: eOutCubic(prog(t, k.bub0 + .1, tw('S16', 'normal', .35))), pen: false, color: C.ink });
      handText('Respire.', -w / 2 + 42, -h / 2 + 176, 62, { align: 'left', write: eOutCubic(prog(t, k.resp - .05, k.resp + .45)), pen: false, color: C.orange });
    });
    ctx.restore();
  }
  function bubbleBienJoue(t) {
    const k = keys(); if (t < k.bj0 || t > k.bj1 + .35) return;
    const kin = clamp(spring(t - k.bj0, 13, .5), 0, 1.12), out = eInCubic(prog(t, k.bj1, k.bj1 + .35)), hd = mireilleHead(t);
    const cx = 330, cy = 470, w = 430, h = 130;
    ctx.save(); ctx.globalAlpha *= 1 - out;
    at(cx, cy, -.03, kin, kin, () => { paperBubble(0, 0, w, h, { x: (hd.x - cx) / Math.max(.2, kin), y: (hd.y - 30 - cy) / Math.max(.2, kin) }, C.orange);
      text('Bien joué !', 0, 22, { font: font(FF.hand, 64, 800), align: 'center', color: C.orange }); });
    ctx.restore();
  }

  // =============================================================================================
  // SCREEN — S17 close-up (pinboard): L'IMAGE ↔ LA LISTE · LE PRIX ↔ LA DOUANE COMPARE
  // =============================================================================================
  const CL = { board: { x: 382, y: 648, w: 690, h: 690 }, img: { x: 186, y: 468 }, list: { x: 560, y: 470 }, inv: { x: 186, y: 842 }, book: { x: 560, y: 846 } };
  function tag(txt, x, y, col, r = -.03) { const f = font(FF.stencil, 46, 900), w = measure(txt, f, 3) + 36;
    at(x, y, r, 1, 1, () => { withShadow(5, () => { ctx.fillStyle = col; rrect(-w / 2, -30, w, 60, 10); ctx.fill(); }); text(txt, 0, 17, { font: f, align: 'center', color: '#fff', ls: 3 }); }); }
  function tick(x, y, k, col = '#1FA86A', s = 1) {
    if (k <= 0) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 8 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const P = [[x - 14 * s, y], [x - 3 * s, y + 12 * s], [x + 20 * s, y - 16 * s]], k1 = clamp(k * 2), k2 = clamp(k * 2 - 1);
    ctx.beginPath(); ctx.moveTo(...P[0]); ctx.lineTo(lerp(P[0][0], P[1][0], k1), lerp(P[0][1], P[1][1], k1)); if (k2 > 0) ctx.lineTo(lerp(P[1][0], P[2][0], k2), lerp(P[1][1], P[2][1], k2)); ctx.stroke(); ctx.restore();
  }
  function dblArrow(x0, x1, y, k, col = C.ink) {
    if (k <= 0) return; const xe = lerp(x0, x1, eOutCubic(k));
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + xe) / 2, y - 10, xe, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0 + 18, y - 14); ctx.lineTo(x0, y); ctx.lineTo(x0 + 18, y + 14); ctx.stroke();
    if (k >= 1) { ctx.beginPath(); ctx.moveTo(x1 - 18, y - 14); ctx.lineTo(x1, y); ctx.lineTo(x1 - 18, y + 14); ctx.stroke(); }
    ctx.restore();
  }
  function rowLitA(t, r) { const k = keys(), tr = k.lst + .12 + r * .32; return t >= tr ? 1 : .55; }
  function itemImage(t) {                                                                 // the cyan x-ray print, 3 rows × 4 boxes
    const w = 250, h = 196, k = keys();
    withShadow(10, () => { ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24); });
    ctx.save(); xrayPattern(-w / 2, -h / 2, w, h, 4, 3, { rowLit: r => rowLitA(t, r) }); ctx.restore();
    const sk = prog(t, k.img, k.img + .7); if (sk > 0 && sk < 1) { const y = -h / 2 + h * sk; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,250,255,.8)'; ctx.fillRect(-w / 2, y - 2, w, 4); ctx.restore(); }
    ctx.fillStyle = C.tape; at(-w / 2 + 16, -h / 2 - 10, -.5, 1, 1, () => ctx.fillRect(-36, -12, 72, 24)); at(w / 2 - 16, -h / 2 - 10, .5, 1, 1, () => ctx.fillRect(-36, -12, 72, 24));
  }
  function itemList(t) {                                                                   // the packing list: rows of 4 boxes (same as the image)
    const w = 244, h = 290, k = keys();
    withShadow(10, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.fillStyle = C.amber; ctx.fillRect(-w / 2, -h / 2, w, 70);
    const f = font(FF.stencil, 46, 900); text('LA LISTE', 0, -h / 2 + 52, { font: f, align: 'center', color: C.ink, ls: 3 });
    for (let r = 0; r < 3; r++) { const y = -h / 2 + 108 + r * 62, lit = rowLitA(t, r);
      ctx.save(); ctx.globalAlpha *= .45 + .55 * lit; ctx.strokeStyle = '#C77A12'; ctx.lineWidth = 3;
      for (let c = 0; c < 4; c++) { ctx.strokeRect(-w / 2 + 20 + c * 40, y - 18, 32, 34); ctx.save(); ctx.lineWidth = 2; at(-w / 2 + 36 + c * 40, y + 4, 0, 1, 1, () => xShoe(24)); ctx.restore(); }
      ctx.restore();
      ctx.strokeStyle = DC.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w / 2 + 16, y + 26); ctx.lineTo(w / 2 - 16, y + 26); ctx.stroke();
      tick(w / 2 - 36, y, prog(t, k.lst + .12 + r * .32, k.lst + .3 + r * .32)); }
    // the officer's finger slides down the rows
    const fk = env(t, k.lst - .15, k.lst + 1.3, .15, .25); if (fk > 0) { const yy = -h / 2 + 108 + clamp(prog(t, k.lst, k.lst + .96)) * 124;
      ctx.save(); ctx.globalAlpha *= fk; at(-w / 2 - 4, yy + 18, -1.35, .62, .62, () => { ctx.fillStyle = OSKIN; rrect(-22, -10, 44, 130, 22); ctx.fill(); ctx.fillStyle = OSLEEVE; rrect(-34, 110, 68, 140, 26); ctx.fill(); }); ctx.restore(); }
  }
  function itemInvoice(t) {                                                                // the invoice: the price line, a violet bar (no figure)
    const w = 244, h = 290, k = keys();
    withShadow(10, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-w / 2, -h / 2, w, h); });
    ctx.fillStyle = C.violetD; ctx.fillRect(-w / 2, -h / 2, w, 70);
    text('FACTURE', 0, -h / 2 + 52, { font: font(FF.stencil, 46, 900), align: 'center', color: '#fff', ls: 3 });
    ctx.fillStyle = 'rgba(35,22,41,.16)'; for (let i = 0; i < 2; i++) ctx.fillRect(-w / 2 + 22, -h / 2 + 100 + i * 30, 160 - i * 50, 8);
    const hi = clamp(prog(t, k.prix + .1, k.prix + .45)); ctx.fillStyle = `rgba(243,167,69,${.45 * hi})`; ctx.fillRect(-w / 2 + 10, -h / 2 + 160, w - 20, 70);
    text('Prix', -w / 2 + 22, -h / 2 + 208, { font: font(FF.hand, 46, 800), color: C.ink });
    const slide = eInOutCubic(prog(t, k.dou - .1, k.dou + .55)); if (slide < .02) { ctx.fillStyle = C.violet; rrect(-w / 2 + 120, -h / 2 + 184, 96, 20, 6); ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(169,71,254,.4)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeRect(-w / 2 + 120, -h / 2 + 184, 96, 20); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(35,22,41,.16)'; ctx.fillRect(-w / 2 + 22, -h / 2 + 256, 120, 8);
  }
  function itemBook(t) {                                                                   // the open book: known prices = a green zone on a scale
    const w = 300, h = 300, k = keys();
    withShadow(10, () => { ctx.fillStyle = DC.green; rrect(-w / 2 - 10, -h / 2 - 8, w + 20, h + 16, 10); ctx.fill(); });
    ctx.fillStyle = '#FBF6EC'; ctx.fillRect(-w / 2, -h / 2, w / 2 - 3, h); ctx.fillRect(3, -h / 2, w / 2 - 3, h);
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(-6, -h / 2, 12, h);
    // running title across the spread (≥ 44 px)
    ctx.fillStyle = DC.green; ctx.fillRect(-w / 2, -h / 2, w, 112);
    text('LA DOUANE', 0, -h / 2 + 48, { font: font(FF.stencil, 46, 900), align: 'center', color: DC.yellow, ls: 3 });
    text('COMPARE', 0, -h / 2 + 96, { font: font(FF.stencil, 46, 900), align: 'center', color: DC.yellow, ls: 3 });
    // the scale: a ruler with the known zone
    const sy = 40, x0 = -w / 2 + 26, x1 = w / 2 - 26;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, sy + 30); ctx.lineTo(x1, sy + 30); ctx.stroke();
    for (let i = 0; i <= 10; i++) { const x = lerp(x0, x1, i / 10); ctx.beginPath(); ctx.moveTo(x, sy + 30); ctx.lineTo(x, sy + (i % 5 ? 20 : 12)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(31,168,106,.28)'; ctx.fillRect(lerp(x0, x1, .34), sy - 26, lerp(x0, x1, .72) - lerp(x0, x1, .34), 52);
    ctx.strokeStyle = '#1FA86A'; ctx.lineWidth = 4; ctx.strokeRect(lerp(x0, x1, .34), sy - 26, lerp(x0, x1, .72) - lerp(x0, x1, .34), 52);
    ctx.fillStyle = 'rgba(35,22,41,.16)'; for (let i = 0; i < 2; i++) ctx.fillRect(x0, sy + 58 + i * 26, 200 - i * 60, 8);
    tick(lerp(x0, x1, .86), sy, prog(t, k.con - .15, k.con + .25), '#1FA86A', 1.2);
  }
  function priceBar(t) {                                                                   // the violet bar flies from the invoice line into the book's zone
    const k = keys(), s = eInOutCubic(prog(t, k.dou - .1, k.dou + .55)); if (s <= .02) return;
    const iw = 244, ih = 290, bw = 300, bh = 300;
    const a = { x: CL.inv.x - iw / 2 + 120 + 48, y: CL.inv.y - ih / 2 + 194 }, b = { x: CL.book.x + lerp(-bw / 2 + 26, bw / 2 - 26, .53), y: CL.book.y - bh / 2 + 40 + 150 };
    const x = lerp(a.x, b.x, s), y = lerp(a.y, b.y, s) - Math.sin(s * Math.PI) * 90;
    at(x, y, (1 - s) * -.2, 1, 1, () => { withShadow(8, () => { ctx.fillStyle = C.violet; rrect(-48, -10, 96, 20, 6); ctx.fill(); }); });
  }
  function closeUp17(t, n) {
    const k = keys(); if (t < k.cmp - .15 || t > k.cOut1) return;
    const out = eInCubic(prog(t, k.cOut0, k.cOut1));
    const hand = worldToScreen(officerX(t), feetY + 70, t), lbS = worldToScreen(LB.x, LB.y, t);
    const fly = (t0, from, slot, fn) => {                                                 // pop from the world, then settle; exit back into the booth
      const u = prog(t, t0, t0 + .45); if (u <= 0) return; const e = eOutCubic(u), s = lerp(.18, 1, e) * lerp(1, .15, out);
      const x = lerp(lerp(from.x, slot.x, e), hand.x, out), y = lerp(lerp(from.y, slot.y, e), hand.y, out) - Math.sin(u * Math.PI) * 40;
      ctx.save(); ctx.globalAlpha *= clamp(u * 4) * (1 - clamp((out - .7) / .3)); at(x, y, (1 - e) * .3 + (slot.r || 0), s, s, () => fn(t)); ctx.restore();
    };
    // the pinboard behind the items (cream paper, taped)
    const bk = eOutCubic(prog(t, k.cmp - .15, k.cmp + .25)) * (1 - out), grow = eInOutCubic(prog(t, k.prix - .35, k.prix + .1));
    const bh = lerp(360, CL.board.h, grow), by = CL.board.y - CL.board.h / 2 + bh / 2;
    if (bk > 0) { ctx.save(); ctx.globalAlpha *= bk; paperNote(CL.board.x, by, CL.board.w, bh, -.008, () => {}, { fill: '#F4EBDA', seed: 17, h: 14 }); ctx.restore(); }
    fly(k.cmp - .1, lbS, CL.img, itemImage);
    fly(k.cmp + .08, hand, CL.list, itemList);
    const ta = clamp(prog(t, k.cmp + .35, k.cmp + .6)) * (1 - out);
    if (ta > 0) { ctx.save(); ctx.globalAlpha *= ta; tag("L'IMAGE", CL.img.x - 10, CL.img.y - 140, '#0F4C6E', -.04); ctx.restore(); }
    ctx.save(); ctx.globalAlpha *= 1 - out; dblArrow(CL.img.x + 152, CL.list.x - 132, CL.img.y, prog(t, k.img + .1, k.img + .5), C.ink); ctx.restore();
    fly(k.prix - .2, hand, CL.inv, itemInvoice);
    fly(k.prix - .02, worldToScreen(officerX(t) - 35, feetY + 55, t), CL.book, itemBook);
    ctx.save(); ctx.globalAlpha *= 1 - out; dblArrow(CL.inv.x + 132, CL.book.x - 170, CL.inv.y, prog(t, k.prix + .35, k.prix + .75), C.ink); ctx.restore();
    if (out < .5) priceBar(t);
  }

  // =============================================================================================
  // SCREEN — S20 close-up: the honest mistake, reported in time
  // =============================================================================================
  // the sheet sits right of Junior's raised hand (screen x < 250 at this camera) and under nothing: x 250–950, y 305–775
  const DS = { x: 600, y: 540, w: 700, h: 470 };
  function raisedHand(x, y, k) {                                                           // Junior's hand (violet sleeve) goes up, index raised
    if (k <= 0) return; const e = eOutBack(clamp(k), 1.4), wig = Math.sin(clamp(k) * 12) * .06 * (1 - clamp(k));
    at(x, y + (1 - e) * 260, -.12 + wig, 1, 1, () => { ctx.save(); ctx.shadowColor = 'rgba(60,32,12,.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12;
      ctx.fillStyle = C.violet; rrect(-46, 60, 92, 300, 34); ctx.fill();
      ctx.fillStyle = JSKIN; rrect(-40, -40, 80, 110, 30); ctx.fill(); rrect(-14, -120, 28, 100, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,210,.35)'; rrect(-8, -112, 14, 30, 7); ctx.fill(); ctx.restore(); });
    if (k > .6 && k < 2.2) { ctx.save(); ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.lineCap = 'round'; const a = clamp((k - .6) * 3) * clamp((2.2 - k) * 2);
      ctx.globalAlpha *= a; for (const [dx, dy, r] of [[-70, -110, -.6], [70, -110, .6], [0, -150, 0]]) at(x + dx, y + dy, r, 1, 1, () => { ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); }); ctx.restore(); }
  }
  /** « moi ! » — three violet strokes spring out around Junior's raised index (world hand, screen overlay) while he signals the slip */
  function handTicks(t) {
    const k = keys(), J = actorAt('junior', t); if (!J || t < k.hand + .2 || t > k.fix1 + .6) return;
    const tip = worldToScreen(J.x + 219 * FIG_S, J.y - 336 * FIG_S, t), z = camAt(t).z; if (tip.x < 20 || tip.x > W - 20) return;
    const a = eOutCubic(prog(t, k.hand + .2, k.hand + .45)) * (1 - clamp(prog(t, k.fix1 + .2, k.fix1 + .6))), g = lerp(.7, 1, eOutBack(clamp(prog(t, k.hand + .2, k.hand + .55)), 2));
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = C.violet; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (const [ang, d] of [[-2.75, 34], [-2.1, 38], [-1.45, 40]]) { const r0 = d * g * z * .8, r1 = r0 + 26 * z * .8;   // up-left: clear of the sheet
      ctx.beginPath(); ctx.moveTo(tip.x + Math.cos(ang) * r0, tip.y + Math.sin(ang) * r0); ctx.lineTo(tip.x + Math.cos(ang) * r1, tip.y + Math.sin(ang) * r1); ctx.stroke(); }
    ctx.restore();
  }
  function closeUp20(t, n) {
    const k = keys(); if (t < k.d0 - .05 || t > k.dOut1) return;
    const e = eOutCubic(prog(t, k.d0 - .05, k.d0 + .4)), out = eInCubic(prog(t, k.dOut0, k.dOut1));
    const from = worldToScreen(DECL.x, BO.ledge - 52, t), s = lerp(.16, 1, e) * lerp(1, .16, out);
    const x = lerp(lerp(from.x, DS.x, e), from.x, out), y = lerp(lerp(from.y, DS.y, e), from.y, out);
    ctx.save(); ctx.globalAlpha *= clamp(prog(t, k.d0 - .05, k.d0 + .1)) * (1 - clamp((out - .6) / .4));
    // Junior's raised hand (under the sheet's lower-left corner)
    const J = actorAt('junior', t), js = J ? worldToScreen(J.x, J.y, t) : { x: -999 };
    if (out < .3 && (js.x < -60 || js.x > W + 60)) raisedHand(170, 930, (t - k.hand) / .45);   // Junior is off-frame: his hand enters the close-up
    at(x, y, -.02, s, s, () => {
      const { w, h } = DS, L = -w / 2 + 36;
      withShadow(14, () => { ctx.fillStyle = DC.paper; ctx.fillRect(-w / 2, -h / 2, w, h); });
      ctx.fillStyle = DC.green; ctx.fillRect(-w / 2, -h / 2, w, 92);
      text('DÉCLARATION', 0, -h / 2 + 68, { font: font(FF.stencil, 64, 900), align: 'center', color: '#fff', ls: 4 });
      ctx.fillStyle = 'rgba(35,22,41,.14)'; for (let i = 0; i < 3; i++) ctx.fillRect(L, -h / 2 + 122 + i * 30, 330 - i * 80, 10);
      const ly = 160;                                                                     // the field (baseline of the hand-written line)
      text("Port d'arrivée :", L, ly - 92, { font: font(FF.body, 56, 800), color: C.inkSoft });
      const f = font(FF.hand, 80, 800), wx = L + 24, ww = measure('Douala', f);
      text('Douala', wx, ly, { font: f, color: '#6B6470' });                              // written in pencil (the honest slip)
      ctx.strokeStyle = DC.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, ly + 20); ctx.lineTo(w / 2 - 30, ly + 20); ctx.stroke();
      at(wx + ww / 2, ly - 26, -.04, 1, 1, () => handCircle(ww * .64, 56, prog(t, k.circ, k.circ + .55), M.red, 8, 5));
      // the correction: struck (not erased) + « Kribi » written next to it + stamp
      const fk = prog(t, k.fix0, k.fix0 + .3); if (fk > 0) { ctx.save(); ctx.strokeStyle = DC.green; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(wx - 8, ly - 22); ctx.lineTo(wx - 8 + (ww + 16) * eOutCubic(fk), ly - 27); ctx.stroke(); ctx.restore(); }
      const wk = prog(t, k.fix0 + .3, k.fix1); if (wk > 0) { const r = handText('→ Kribi', wx + ww + 30, ly, 80, { align: 'left', write: wk, pen: false, color: DC.green });
        if (wk < 1) at(r.x0 + r.wd * wk + 8, ly - 26, 0, .9, .9, () => marker(0, 0, -.5, DC.green)); }
      const sk = t - k.stamp; if (sk > -.1) { const sl = slam(t, k.stamp, 1.8);
        at(w / 2 - 172, -h / 2 + 170, .07, sl.s, sl.s, () => { ctx.save(); ctx.globalAlpha *= sl.a;
          stampText('SIGNALÉE', 0, -33, font(FF.stencil, 60, 900), DC.blue, { ls: 3, starve: .35 });
          stampText('À TEMPS', 0, 36, font(FF.stencil, 60, 900), DC.blue, { ls: 3, starve: .35 });
          ctx.strokeStyle = DC.blue; ctx.globalAlpha *= .85; ctx.lineWidth = 7; rrect(-150, -86, 300, 160, 16); ctx.stroke(); ctx.restore(); }); }
    });
    ctx.restore();
  }
  function chips20(t) {
    const k = keys(); if (t < k.chips[0] - .1 || t > k.p20e + .5) return;
    const L = [['VRAIS', C.violetD], ['COMPLETS', '#C77A12'], ["À L'AVANCE", '#D84406']], f = font(FF.body, 44, 800);
    const ws = L.map(([s]) => measure(s, f) + 64), gap = 14, tot = ws.reduce((a, b) => a + b, 0) + gap * 2, y = 884;
    const out = eInCubic(prog(t, k.p20e, k.p20e + .45));
    let x = 540 - tot / 2;
    L.forEach(([s, col], i) => { const kk = clamp(spring(t - k.chips[i], 15, .5), 0, 1.15); const cx = x + ws[i] / 2; x += ws[i] + gap; if (kk <= 0) return;
      ctx.save(); ctx.globalAlpha *= clamp(kk * 3) * (1 - out); chip(cx, y + out * 40, s, { fill: col, color: '#fff', s: kk, rot: (i - 1) * .02, size: 44 }); ctx.restore(); });
  }

  // =============================================================================================
  // SCREEN — S18: the match cut (round stamp → round « ? » sticker) and the phone
  // =============================================================================================
  const PHW = 820, PHH = 1000;
  function stickerLocal() { const w = PHW, h = PHH, b = w * .05, sx = -w / 2 + b, sy = -h / 2 + b * 2.2, sw = w - 2 * b, u = sw / 100;
    const by = sy + 36 * u, ay = by + 46 * u, aw = 86 * u, ah = 26 * u, ax = sx + sw - 5 * u - aw; return { x: ax + aw / 2, y: ay + ah / 2, r: 9 * u, u }; }
  function stampPos(t) {
    const k = keys(), p = window.P46 && P46.stampScreen('CONTROLE', Math.min(t, k.car + .4));
    return p ? { x: p.x, y: p.y, r: p.r } : { x: 678, y: 376, r: 124 };
  }
  function phonePose(t) {
    const k = keys(), L = stickerLocal(), P = stampPos(t);
    const s0 = P.r / L.r, c0 = { x: P.x - L.x * s0, y: P.y - L.y * s0 }, s1 = .98, c1 = { x: 540, y: 722 };             // whole phone below the series tag, above the captions
    const e = eInOutCubic(prog(t, k.pb0, k.pb1));
    let s = Math.exp(lerp(Math.log(s0), Math.log(s1), e)), x = lerp(c0.x, c1.x, e), y = lerp(c0.y, c1.y, e), a = clamp(prog(t, k.m0, k.m0 + .3));
    if (t > k.out0) { const st = actorAt('junior', t), to = st ? worldToScreen(st.x + 66, st.y + 146, t) : { x: 520, y: 1190 }, q = eInCubic(prog(t, k.out0, k.out1));
      const sE = .075; s = Math.exp(lerp(Math.log(s1), Math.log(sE), q)); x = lerp(c1.x, to.x - L.x * sE, q); y = lerp(c1.y, to.y - L.y * sE, q); a *= 1 - clamp((q - .75) / .25); }
    return { x, y, s, a };
  }
  function phoneS18(t, n) {
    const k = keys(); if (t < k.m0 || t > k.out1) return;
    const P = phonePose(t), flap = eInOutCubic(prog(t, k.flap0, k.flap1));
    const draw = () => at(P.x, P.y, 0, P.s, P.s, () => juniorPhone(PHW, PHH, { screen: 'message', seal: 0, flap, lift: 22 }));
    if (P.a >= .999) { draw(); return; }
    // fading: paint the phone opaque off-screen first (so the hidden reply never shows through the kraft flap), then fade it
    const off = makeCanvasCached('d28phone', W, H), g = off.getContext('2d'), main = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    try { ctx = g; draw(); } finally { ctx = main; }
    ctx.save(); ctx.globalAlpha *= P.a; ctx.drawImage(off, 0, 0); ctx.restore();
  }
  function stickerS18(t, n) {
    const k = keys(); if (t < k.m0 || t > k.peel1 + .1) return;
    const P = phonePose(t), L = stickerLocal(), seal = 1 - eInOutCubic(prog(t, k.peel0, k.peel1));
    const lx = L.x + (1 - seal) * 30 * L.u, ly = L.y - (1 - seal) * 40 * L.u, rot = (1 - seal) * 1.2;
    const fin = clamp(prog(t, k.m0, k.m0 + .22)), pulse = 1 + .12 * Math.sin(clamp(prog(t, k.m0, k.m0 + .35)) * Math.PI);
    const curl = 1 - .35 * Math.sin((1 - seal) * Math.PI);                                // the paper sticker curls as it peels
    ctx.save(); ctx.globalAlpha *= fin;
    at(P.x + lx * P.s, P.y + ly * P.s, rot + (1 - fin) * .08, pulse, pulse * curl, () => qSticker(L.r * P.s, seal));
    ctx.restore();
  }
  function warmLight(t) {
    const k = keys(), p = prog(t, k.leak0, k.leak1); if (p <= 0 || p >= 1) return;
    const a = Math.sin(p * Math.PI);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const P = phonePose(t), L = stickerLocal(), cx = P.x + 0 * P.s, cy = P.y + L.y * P.s;
    const g = ctx.createRadialGradient(cx, cy, 40, cx, cy, 760); g.addColorStop(0, `rgba(255,200,120,${.2 * a})`); g.addColorStop(.6, `rgba(255,170,90,${.07 * a})`); g.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }

  // =============================================================================================
  // SCREEN — S16: the hard cut, Mireille's diary page « MER. → JEU. »
  // =============================================================================================
  function diarySweep(t, n) {
    const k = keys(); if (t < k.sw0 || t > k.sw1) return;
    const u = 2 * prog(t, k.sw0, k.sw1) - 1, a = .2, f = a * u + (1 - a) * u * u * u;       // −1..1, slow while it covers the frame
    const w = 1640, h = w * 1.25, x = 540 - 1560 * f, y = 985 + 26 * f, r = -.04 * f;
    at(x, y, r, 1, 1, () => {
      mireilleDiary(w, '', { lift: 46 });
      // Mireille's big day label on the page: « MER. » (struck) → « JEU. » (circled)
      const f1 = font(FF.stencil, 170, 900), f2 = font(FF.stencil, 250, 900);
      text('MER.', 0, -300, { font: f1, align: 'center', color: 'rgba(35,22,41,.55)', ls: 8 });
      const mw = measure('MER.', f1, 8);
      ctx.save(); ctx.strokeStyle = C.orange; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-mw / 2 - 20, -350); ctx.lineTo(mw / 2 + 20, -370); ctx.stroke(); ctx.restore();
      handArrow([[0, -250], [-12, -200], [0, -150]], 1, C.ink, 12);
      text('JEU.', 0, 150, { font: f2, align: 'center', color: C.orange, ls: 10 });
      at(0, 60, -.03, 1, 1, () => handCircle(measure('JEU.', f2, 10) * .66, 150, 1, C.violet, 12, 9));
      text('scanner', 40, 340, { font: font(FF.hand, 86, 800), align: 'center', color: C.ink });
    });
  }

  // =============================================================================================
  // scenes
  // =============================================================================================
  registerScene({ id: 'D28_archBack', z: 21, draw(t, n) {
    keys(); lazyShakes(); if (t < keys().cm - .01 || !visX(AR.x0, AR.x1, t)) return;
    ctx.save(); worldBegin(t); archBack(t, n); ctx.restore();
  } });
  registerScene({ id: 'D28_truck', z: 24, draw(t, n) {
    const T = truckState(t); if (!T || !visX(T.x - 400, T.x + 620, t)) return;
    ctx.save(); worldBegin(t);
    ctx.fillStyle = 'rgba(60,32,12,.18)'; ctx.beginPath(); ctx.ellipse(T.x + 100, GROUND + 4, 520, 16, 0, 0, 7); ctx.fill();
    at(T.x, GROUND, 0, 1, 1, () => truck28({ n, spin: T.spin, idle: T.idle || !T.moving }));
    if (!T.moving) truckThread(T.x, n);
    scanSlit(t, T.x);
    if (T.idle && t > keys().cm) { const s = (t * 1.3) % 1; ctx.save(); ctx.globalAlpha *= .5 * (1 - s); ctx.fillStyle = '#D9D2C4';   // idle exhaust puffs
      ctx.beginPath(); ctx.arc(T.x + 380 - s * 40, GROUND - 480 - s * 80, 16 + s * 22, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.restore();
  } });
  registerScene({ id: 'D28_archFront', z: 26, draw(t, n) {
    if (t < keys().cm - .01 || !visX(AR.x0, AR.x1, t)) return;
    ctx.save(); worldBegin(t); archFront(t, n); ctx.restore();
  } });
  registerScene({ id: 'D28_boothBack', z: 28, draw(t, n) {
    if (t < keys().cm - .01 || !visX(BO.x0 - 40, BO.x1 + 40, t)) return;
    ctx.save(); worldBegin(t); boothBack(t, n); officerDraw(t, n); ctx.restore();
  } });
  registerScene({ id: 'D28_heart', z: 33, draw(t, n) { ctx.save(); worldBegin(t); heart(t, n); mireilleHandOver(t, n); ctx.restore(); } });
  registerScene({ id: 'D28_boothFront', z: 36, draw(t, n) {
    if (t < keys().cm - .01 || !visX(BO.x0 - 60, BO.x1 + 60, t)) return;
    ctx.save(); worldBegin(t); boothFront(t, n); declSmall(t); balance(t, n); ctx.restore();
  } });
  registerScene({ id: 'D28_balance', z: 45, draw(t, n) { balanceInsert(t, n); } });
  registerScene({ id: 'D28_bubbles', z: 46, draw(t, n) { bubbleS16(t); bubbleBienJoue(t); } });
  registerScene({ id: 'D28_closeups', z: 47, draw(t, n) { closeUp17(t, n); handTicks(t); const sh = shake(t, n); ctx.save(); ctx.translate(sh.x * .6, sh.y * .6); closeUp20(t, n); ctx.restore(); } });
  registerScene({ id: 'D28_chips', z: 48, draw(t, n) { chips20(t); } });
  registerScene({ id: 'D28_phone', z: 50, draw(t, n) { phoneS18(t, n); } });
  registerScene({ id: 'D28_sticker', z: 54, draw(t, n) { stickerS18(t, n); } });
  registerScene({ id: 'D28_warm', z: 56, draw(t, n) { warmLight(t); } });
  registerScene({ id: 'D28_diary', z: 58, draw(t, n) { diarySweep(t, n); } });
})();

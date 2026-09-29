'use strict';
// ============================================================================================
// 20_footage_hud.js — pedagogical HUD over the three footage chapters.
//   s4 L'ARRIVÉE      : V06 callout on the container · speaker tag (Q1/Q2) · target lock + « ARRIVÉ »
//                       badge (Q1) · unloading module with « EN TOUTE SÉCURITÉ » shield (Q2)
//   s5 LE DÉCHARGEMENT: « L'ENTREPÔT BONZINI » header + info chips (V07) · speaker tag (Q3/Q4) ·
//                       « COLIS DÉCHARGÉS » badge (Q4) · tracked callouts CARTONS / MARCHANDISES
//                       EMBALLÉES / SACS + « Rangé en sécurité » badge (V08)
//   s6 LE RETRAIT     : « À VOUS DE JOUER » call-to-action pointing at the parcels (V09) · speaker
//                       tag (Q5) · big pick-up location card on the blurred background (Q5, look 'mg')
// Zone: y 320–1110 only (stepper above, captions below). Every time comes from TL (segments, words,
// shots); tracked object positions are keyed to the SOURCE time of the shot on screen and pushed
// through the same camera zoom/shake the compositor applies (lib/composite.py).
// ============================================================================================
(() => {
  // ---------------- tracked objects: [source seconds, x, y] in un-zoomed frame pixels ----------------
  // (template-matched on the stabilised clips, smoothed; entries/exits extrapolated off-frame)
  const TRACKS = {
    cartons: { clip: 'A', d: [[9.4,1115,585],[9.55,1060,592],[9.72,953,604],[9.8,921,607],[9.88,879,612],[9.96,846,616],[10.04,823,619],[10.12,806,620],[10.2,791,620],[10.28,776,620],[10.36,755,620],[10.44,726,621],[10.52,688,621],[10.6,642,622],[10.68,591,623],[10.76,536,623],[10.84,482,622],[10.92,431,622],[11.0,386,623],[11.08,347,625],[11.16,311,629],[11.24,280,635],[11.32,250,643],[11.4,218,651],[11.48,180,658],[11.56,139,662],[11.8,20,678],[11.95,-60,682]] },
    bale: { clip: 'A', d: [[9.7,1040,918],[9.85,990,920],[10.0,939,924],[10.08,928,926],[10.16,913,929],[10.24,898,929],[10.32,882,929],[10.4,858,929],[10.48,826,930],[10.56,784,930],[10.64,736,931],[10.72,683,931],[10.8,629,931],[10.88,576,932],[10.96,528,934],[11.04,486,937],[11.12,451,941],[11.2,421,948],[11.28,393,955],[11.36,366,963],[11.44,334,971],[11.52,295,978],[11.6,247,983],[11.68,196,986],[11.95,-40,1000],[12.1,-120,1004]] },
    sack: { clip: 'A', d: [[10.8,1110,1085],[10.9,1040,1087],[11.0,981,1089],[11.08,960,1092],[11.16,930,1097],[11.24,904,1103],[11.32,880,1109],[11.4,854,1114],[11.48,823,1118],[11.56,784,1120],[11.64,736,1121],[11.72,677,1122],[11.8,607,1123],[11.88,528,1122],[11.96,445,1119],[12.04,359,1119],[12.12,276,1120],[12.2,204,1122],[12.28,150,1122],[12.5,-40,1120],[12.6,-110,1120]] },
    bigsack: { clip: 'A', d: [[11.8,1180,975],[11.92,1080,970],[12.04,959,967],[12.12,918,969],[12.2,853,968],[12.28,794,965],[12.36,745,962],[12.44,699,961],[12.52,654,961],[12.6,603,963],[12.68,547,965],[12.76,488,968],[12.84,428,970],[12.92,372,974],[13.0,322,978],[13.08,279,981],[13.16,246,984],[13.24,219,985],[13.32,197,984],[13.4,176,981],[13.48,159,978],[13.56,144,973],[13.85,40,950],[14.0,-60,940]] },
    stack: { clip: 'A', d: [[17.2,1060,800],[17.32,1000,797],[17.44,949,795],[17.52,939,796],[17.6,910,798],[17.68,843,802],[17.76,770,804],[17.84,691,801],[17.92,604,795],[18.0,513,785],[18.08,419,776],[18.16,329,767],[18.24,252,762],[18.45,205,772],[18.75,205,790],[19.05,198,815],[19.35,180,860],[19.6,130,945],[19.8,-40,1000],[19.95,-180,1030]] },
  };

  // ---------------- camera mapping (mirror of composite.py « camera life ») ----------------
  let CAM = null;
  function camInit() {
    if (CAM && CAM.data === TL.data) return CAM;
    const chs = TL.data.chapters.slice(1).map(c => c.start);
    const cuts = TL.data.shots.slice(1).map(s => s.start).filter(s => chs.every(c => Math.abs(s - c) > .05));
    return (CAM = { data: TL.data, chs, cuts });
  }
  function cam(t) {
    const { chs, cuts } = camInit();
    const s = TL.shotAt(t) || TL.data.shots[TL.data.shots.length - 1], n = Math.round(t * FPS);
    let z = 1, dx = 0, dy = 0;
    if (s.look === 'full') z *= 1 + .035 * prog(t, s.start, s.end);
    for (const c of chs) if (c <= t && t < c + .45) {
      const k = (t - c) / .45; z *= 1 + .08 * (1 - eOutExpo(k)); const d = (1 - k) ** 2;
      dx += (rnd(n * 3 + 1) - .5) * 14 * d; dy += (rnd(n * 5 + 2) - .5) * 14 * d;
    }
    for (const c of cuts) if (c <= t && t < c + .3) z *= 1 + .03 * (1 - eOutExpo((t - c) / .3));
    return { z, dx, dy };
  }
  const toScreen = (x, y, t) => { const c = cam(t); return [W / 2 + (x - W / 2) * c.z + c.dx, H / 2 + (y - H / 2) * c.z + c.dy]; };

  /** non-uniform Catmull-Rom through the track table at source time src */
  function trackRaw(name, src) {
    const d = TRACKS[name].d;
    if (src < d[0][0] || src > d[d.length - 1][0]) return null;
    let i = 0; while (i < d.length - 2 && src > d[i + 1][0]) i++;
    const P0 = d[Math.max(0, i - 1)], P1 = d[i], P2 = d[i + 1], P3 = d[Math.min(d.length - 1, i + 2)];
    const h = P2[0] - P1[0], u = clamp((src - P1[0]) / h);
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    const o = [];
    for (const k of [1, 2]) {
      const m1 = (P2[k] - P0[k]) / Math.max(1e-6, P2[0] - P0[0]), m2 = (P3[k] - P1[k]) / Math.max(1e-6, P3[0] - P1[0]);
      o.push(h00 * P1[k] + h10 * h * m1 + h01 * P2[k] + h11 * h * m2);
    }
    return o;
  }
  /** on-screen position of a tracked object at timeline time t (null when its shot is not on screen) */
  function trackAt(name, t) {
    const s = TL.shotAt(t);
    if (!s || s.clip !== TRACKS[name].clip) return null;
    const r = trackRaw(name, s.src + (t - s.start) * s.speed);
    if (!r) return null;
    const [x, y] = toScreen(r[0], r[1], t);
    return { x, y, vis: clamp((x - 30) / 110) * clamp((W - 30 - x) / 110) };
  }
  const STEP = 1 / FPS;
  function firstVisible(name, from, maxDur = 3) {
    for (let t = from; t < from + maxDur; t += STEP) { const p = trackAt(name, t); if (p && p.x > 90 && p.x < W - 60) return t; }
    return null;
  }
  function leaves(name, from, maxDur = 5) {
    let seen = false;
    for (let t = from; t < from + maxDur; t += STEP) {
      const p = trackAt(name, t);
      if (p && p.x < W - 90) seen = true;
      if (seen && (!p || p.x < 150)) return t;
    }
    return from + maxDur;
  }

  // ---------------- timings (all derived from TL; cached per timeline) ----------------
  let TT = null;
  const shotIn = (ch, pred) => TL.data.shots.find(s => s.start >= ch.start - 1e-3 && s.start < ch.end && pred(s));
  const cardEnd = id => { // end of the chapter title card flight (mirror of 30_chapters.js timing)
    const c = TL.ch(id), seg = TL.data.segments.find(s => s.start >= c.start - .01 && s.start < c.end);
    const tS = c.start + .15, tN = seg ? seg.start : c.start + 1.4;
    return Math.max(tN + .22, tS + 1.25) + .58;
  };
  function times() {
    if (TT && TT.data === TL.data) return TT;
    const s4 = TL.ch('s4'), s5 = TL.ch('s5'), s6 = TL.ch('s6'), seg = id => TL.seg(id), wt = (a, b, f) => TL.wt(a, b, f);
    const T = { data: TL.data };
    // ---- s4
    const b2 = shotIn(s4, s => s.clip === 'B2');
    T.v06 = { tIn: Math.max(cardEnd('s4') + .1, Math.max(wt('V06', 'voici'), b2 ? b2.start : 0) + .06), tOut: seg('Q1').start };
    const cutQ2 = shotIn(s4, s => s.start > seg('Q1').start + .5) || { start: seg('Q2').start };
    T.q1 = { tIn: seg('Q1').start + .06, tLock: wt('Q1', 'conteneur'), tBadge: wt('Q1', 'entrepot'), tOut: Math.min(seg('Q1').end + .3, cutQ2.start + .02) };
    T.q2 = { tIn: wt('Q2', 'decharge') - .25, tSec: wt('Q2', 'securite'), tOut: s4.end - .06 };
    // ---- s5
    T.v07 = { tIn: cardEnd('s5') + .08, tOut: seg('Q3').start, c1: wt('V07', 'vide'), c2: wt('V07', 'ranges') };
    T.v07.cOut = Math.max(seg('Q3').start + .6, T.v07.c2 + 2.9);
    T.q4 = { tIn: wt('Q4', 'decharges'), tOut: Math.min(seg('Q4').end + .55, seg('V08').start + .15) };
    // V08: each label enters on its word (or when its object comes into view), gets a ✓ on « rangé »,
    // and holds ≥ 2 s readable; the « Rangé en sécurité » badge lands on « sécurité ».
    const lab = (names, word, tOut) => {
      const w = wt('V08', word);
      const fv = firstVisible(names[0], w - .4, 3.5);
      const tIn = Math.max(w, fv == null ? w : fv - .12);
      const tLeave = leaves(names[names.length - 1], tIn, 6);
      return { tIn, tLeave, tOut: Math.max(tOut, tIn + 2.9) };
    };
    const vSec = wt('V08', 'securite'), vRange = wt('V08', 'range');
    T.v08 = {
      cartons: lab(['cartons'], 'cartons', vSec + .25), bale: lab(['bale'], 'marchandises', vSec + .6),
      sack: lab(['sack', 'bigsack'], 'sacs', vSec + 1.3), tick: vRange, badge: vSec, bOut: s5.end - .1,
    };
    // ---- s6
    const mg = shotIn(s6, s => s.look === 'mg');
    T.card = { tIn: mg ? mg.start : wt('Q5', 'niveau'), tHi: wt('Q5', 'balengou'), tOut: s6.end - .08 };
    T.card.tSteps = Math.max(T.card.tHi + .45, T.card.tIn + 1.1);
    T.v09 = { tIn: Math.max(cardEnd('s6') + .1, wt('V09', 'il') - .35), tOut: seg('Q5').start + .1 };
    // ---- speaker chips (merge quotes that follow each other)
    T.spk = [
      [seg('Q1').start, seg('Q2').end + .15],
      [seg('Q3').start, seg('Q4').end + .15],
      [seg('Q5').start + .12, T.card.tIn - .05],
    ];
    return (TT = T);
  }

  // ---------------- small drawing kit ----------------
  const INKP = 'rgba(11,7,24,.9)';
  const F_UI = (sz, w = 700) => `${w} ${sz}px ${FONT.ui}`;
  const F_BODY = (sz, w = 800) => `${w} ${sz}px ${FONT.body}`;
  const F_DISP = (sz, w = 900) => `${w} ${sz}px ${FONT.display}`;
  /** group envelope: a = alpha (eased in/out), k = seconds since tIn, x = exit progress 0..1 */
  const grp = (t, tIn, tOut, fin = .3, fout = .32) => ({ a: env(t, tIn, tOut, fin, fout), k: t - tIn, x: eInCubic(prog(t, tOut - fout, tOut)) });

  /** readable leader: dark under-stroke + white line, drawn to progress p; returns the head */
  function leader(pts, p, alpha = 1) {
    if (p <= 0 || alpha <= 0) return null;
    ctx.save(); ctx.globalAlpha *= alpha;
    polyline(pts, p, 'rgba(8,5,20,.72)', 10);
    const head = polyline(pts, p, '#FFFFFF', 4, 'rgba(169,71,254,.95)');
    ctx.restore(); return head;
  }
  /** object marker: pulse ring + white ring + amber core */
  function marker(x, y, k, t, seed = 0, alpha = 1) {
    if (k <= 0 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha * clamp(k * 1.6);
    const r = 13 * eOutBack(clamp(k));
    const ph = (t * .85 + seed * .37) % 1;
    ring(x, y, r + 10 + 42 * eOutCubic(ph), AMBER, 3, (1 - ph) * .85 * clamp(k * 2 - 1));
    ctx.beginPath(); ctx.arc(x, y, r + 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8,5,20,.55)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#FFFFFF'; ctx.shadowColor = VIOLET; ctx.shadowBlur = 14; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * .62, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 18; ctx.fill();
    ctx.restore();
  }
  /** plate that opens from an anchor ('left' | 'center' | 'right'); k = 0..1 */
  function openPlate(x, y, w, h, k, o = {}) {
    if (k <= 0) return;
    const e = eOutExpo(clamp(k)), ww = Math.max(h * .9, w * e);
    const x0 = o.from === 'center' ? x + (w - ww) / 2 : o.from === 'right' ? x + w - ww : x;
    plate(x0, y, ww, h, { r: o.r ?? 20, fill: o.fill || INKP, border: o.border, lw: o.lw ?? 3, accent: e > .6 ? o.accent : null, alpha: clamp(k * 3) });
  }
  /** one diagonal light sweep across a plate (p 0..1), clipped to its rounded rect */
  function shine(x, y, w, h, r, p) {
    if (p <= 0 || p >= 1) return;
    ctx.save(); rrect(x, y, w, h, r); ctx.clip();
    const cx = lerp(x - h, x + w + h, eInOutCubic(p));
    const g = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,240,215,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.transform(1, 0, -.35, 1, .35 * (y + h / 2), 0); ctx.fillRect(cx - 90, y, 180, h);
    ctx.restore();
  }
  /** text line that wipes in (left or centre) and settles; o as txt() */
  function lineIn(s, x, y, k, o = {}) {
    if (k <= 0) return;
    const m = o.font && o.font.match(/(\d+)px/);           // wipeText sizes its mask from o.size
    wipeText(s, x, y, clamp(k), m && !o.size ? { ...o, size: +m[1] } : o);
  }
  /** check glyph in a circle (drawn — no font glyph needed) */
  function checkBadge(x, y, r, p, t0k, color = AMBER) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(243,167,69,.16)'; ctx.fill();
    ctx.lineWidth = Math.max(3, r * .09); ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.001, eOutCubic(clamp(p * 1.6)))); ctx.stroke();
    ctx.restore();
    checkMark(x, y + r * .04, r * 1.05, eOutCubic(clamp(p * 1.6 - .5)), color, Math.max(5, r * .17));
    if (t0k > 0 && t0k < 1) { ring(x, y, r + 70 * eOutExpo(t0k), color, 3, 1 - t0k); ring(x, y, r + 36 * eOutExpo(t0k), '#fff', 2, (1 - t0k) * .7); }
  }
  /** microphone icon (drawn), s ≈ icon height */
  function mic(cx, cy, s, color) {
    ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = s * .085; ctx.lineCap = 'round';
    const cw = s * .38, chh = s * .58, top = cy - s * .5;
    rrect(cx - cw / 2, top, cw, chh, cw / 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, top + chh * .52, s * .31, .08 * Math.PI, .92 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, top + chh * .52 + s * .31); ctx.lineTo(cx, cy + s * .43);
    ctx.moveTo(cx - s * .2, cy + s * .45); ctx.lineTo(cx + s * .2, cy + s * .45); ctx.stroke();
    ctx.restore();
  }
  /** speech activity 0..1 from the word timings of the quote on air (smoothed) */
  function speech(t) {
    let acc = 0;
    for (let i = 0; i < 4; i++) {
      const tt = t - i * .035, s = TL.segAt(tt);
      if (s && s.kind === 'sp' && s.words) for (const w of s.words) if (tt >= w.s - .02 && tt <= w.e + .05) { acc += 1; break; }
    }
    return acc / 4;
  }
  // =========================================================== speaker tag (all quotes)
  function drawSpeaker(t, T) {
    for (let i = 0; i < T.spk.length; i++) {
      const [a0, b0] = T.spk[i];
      const tIn = a0 + .04, tOut = b0;
      if (t < tIn || t > tOut) continue;
      const g = grp(t, tIn, tOut, .25, .35); if (g.a <= 0) continue;
      const X = 40, Y = 334, Hh = 100, R = Hh / 2, cx = X + R, cy = Y + R;
      const t1 = "L'équipe Bonzini", t2 = ' · sur place';
      const w1 = measure(t1, F_BODY(46, 800)), w2 = measure(t2, F_BODY(46, 700));
      const Wd = Hh + 18 + w1 + w2 + 26 + 5 * 14 + 30;
      const kIcon = eOutBack(clamp(g.k / .35)), kOpen = prog(g.k, .12, .62), kTxt = prog(g.k, .3, .8);
      const ex = g.x;
      ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(-40 * eInCubic(ex), 0);
      // pill
      if (kOpen > 0) {
        const e = eOutExpo(kOpen) * (1 - ex), ww = Math.max(Hh, Wd * e);
        ctx.save(); rrect(X, Y, ww, Hh, R); ctx.fillStyle = INKP; ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8; ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(243,167,69,.9)'; ctx.stroke();
        ctx.clip();
        const tx = X + Hh + 16;
        txt(t1, tx, Y + 66, { font: F_BODY(46, 800), color: '#FFFFFF', alpha: clamp(kTxt * 1.5) * (1 - ex), shadow: false });
        txt(t2, tx + w1, Y + 66, { font: F_BODY(46, 700), color: AMBER, alpha: clamp(kTxt * 1.5 - .3) * (1 - ex), shadow: false });
        // live voice bars
        const act = speech(t), bx = tx + w1 + w2 + 26;
        for (let j = 0; j < 5; j++) {
          const wv = .35 + .65 * Math.abs(Math.sin(t * (6.3 + j * 1.9) + j * 1.7) * Math.cos(t * (2.1 + j * .7) + j));
          const hh = 10 + 40 * act * wv * clamp(kTxt * 2 - .6);
          ctx.fillStyle = j % 2 ? ORANGE : AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 10;
          rrect(bx + j * 14, cy - hh / 2, 8, hh, 4); ctx.fill();
        }
        ctx.restore();
      }
      // mic disc
      ctx.save(); ctx.translate(cx, cy); ctx.scale(kIcon * (1 - .25 * ex), kIcon * (1 - .25 * ex));
      ctx.beginPath(); ctx.arc(0, 0, R - 9, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 22; ctx.fill();
      ctx.restore();
      if (kIcon > .2) mic(cx, cy, 50 * clamp(kIcon), INK);
      const act = speech(t), ph = (t * 1.3) % 1;
      if (act > 0) ring(cx, cy, R - 6 + 26 * eOutCubic(ph), AMBER, 3, (1 - ph) * .8 * act * clamp(kIcon));
      ctx.restore();
    }
  }

  // =========================================================== s4 · V06 callout on the container
  function drawV06(t, T) {
    const { tIn, tOut } = T.v06; const g = grp(t, tIn, tOut, .25, .32); if (g.a <= 0) return;
    const fl = Math.sin(t * 1.7) * 5;
    const DX = 690, DY = 700 + fl;                  // container body (fills the frame in this shot)
    const PX = 60, PY = 372, PH = 184;
    const l1 = 'LE CONTENEUR', l2 = "Arrivé devant l'entrepôt";
    const PW = Math.max(measure(l1, F_DISP(64), 2), measure(l2, F_BODY(48, 700))) + 88;
    const k = g.k;
    ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(0, -14 * g.x);
    // leader: plate bottom → 45° elbow → container
    const ax = 560, ay = PY + PH;
    const pts = [[DX, DY], [ax, Math.max(ay + 20, DY - (DX - ax))], [ax, ay]];
    marker(DX, DY, prog(k, 0, .35), t, 1);
    leader(pts, eOutCubic(prog(k, .12, .5)));
    // brackets around the marker area (container panel)
    const bk = eOutBack(prog(k, .2, .55));
    if (bk > 0) brackets(DX - 110 * bk, DY - 80 * bk, DX + 110 * bk, DY + 80 * bk, 28, ICE, 4, .85 * clamp(bk), VIOLET);
    openPlate(PX, PY, PW, PH, prog(k, .22, .6), { accent: AMBER });
    lineIn(l1, PX + 44, PY + 86, prog(k, .33, .72), { font: F_DISP(64), ls: 2, color: '#FFFFFF', glow: 'rgba(169,71,254,.6)' });
    lineIn(l2, PX + 44, PY + 150, prog(k, .48, .88), { font: F_BODY(48, 700), color: AMBER });
    ctx.restore();
  }

  // =========================================================== s4 · Q1 target lock + ARRIVÉ badge
  function drawQ1(t, T, n) {
    const { tIn, tLock, tBadge, tOut } = T.q1; const g = grp(t, tIn, tOut, .3, .35); if (g.a <= 0) return;
    const B = [72, 468, 1008, 1084], cx = (B[0] + B[2]) / 2, cy = 780;
    const pre = eOutCubic(prog(t, tIn, tLock)), locked = t >= tLock;
    const snap = eOutBack(prog(t, tLock, tLock + .35));
    const inf = locked ? lerp(26, 0, snap) + 5 * Math.sin((t - tLock) * 2.6) * clamp((t - tLock - .35) / .4) : lerp(150, 26, pre);
    const jit = locked ? 0 : (rnd(n * 7) - .5) * 5 * (1 - pre);
    ctx.save(); ctx.globalAlpha *= g.a;
    const col = locked ? AMBER : ICE, glow = locked ? 'rgba(243,167,69,.9)' : VIOLET;
    brackets(B[0] - inf + jit, B[1] - inf, B[2] + inf + jit, B[3] + inf, 86, col, locked ? 6 : 4, clamp(pre * 1.3) * (1 - .35 * g.x), glow);
    // lock flash
    if (locked) { const q = prog(t, tLock, tLock + .7); ring(cx, cy, 40 + 420 * eOutExpo(q), AMBER, 4, (1 - q) * .9); }
    // crosshair (fades out when the badge lands)
    const bIn = prog(t, tBadge - .05, tBadge + .35);
    const ca = clamp(pre * 1.4) * (1 - bIn);
    if (ca > 0) {
      ctx.save(); ctx.globalAlpha *= ca; ctx.translate(cx, cy);
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.shadowColor = glow; ctx.shadowBlur = 14;
      const r = locked ? 54 : 54 + 60 * (1 - pre);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10)); ctx.lineTo(Math.cos(a) * (r + 44), Math.sin(a) * (r + 44)); ctx.stroke(); }
      ctx.rotate(t * .9); ctx.setLineDash([14, 16]); ctx.lineWidth = 2.5; ctx.globalAlpha *= .7;
      ctx.beginPath(); ctx.arc(0, 0, r + 70, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // scan sweep inside the locked box (subtle life)
    if (locked) {
      const sp = ((t - tLock) * .45) % 1, y = lerp(B[1] + 10, B[3] - 10, eInOutCubic(sp));
      const la = .55 * clamp((t - tLock) / .4) * (1 - bIn * .6);
      ctx.save(); ctx.globalAlpha *= la;
      const gr = ctx.createLinearGradient(0, y - 90, 0, y); gr.addColorStop(0, 'rgba(92,240,255,0)'); gr.addColorStop(1, 'rgba(92,240,255,.16)');
      ctx.fillStyle = gr; ctx.fillRect(B[0] + 8, y - 90, B[2] - B[0] - 16, 90);
      ctx.fillStyle = 'rgba(200,255,255,.8)'; ctx.shadowColor = CYAN; ctx.shadowBlur = 18; ctx.fillRect(B[0] + 8, y - 1.5, B[2] - B[0] - 16, 3);
      ctx.restore();
    }
    // ARRIVÉ badge
    if (t >= tBadge - .05) {
      const bk = t - tBadge, st = eOutBack(clamp(bk / .4)), ba = clamp(bk / .18 + .3);
      const PW = 660, PH = 210, px = cx - PW / 2, py = cy - PH / 2;
      ctx.save(); ctx.globalAlpha *= ba; ctx.translate(cx, cy); const sc = lerp(1.18, 1, st); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
      plate(px, py, PW, PH, { r: 26, border: 'rgba(243,167,69,.95)', lw: 4, fill: 'rgba(11,7,24,.92)' });
      checkBadge(px + 112, cy, 66, clamp(bk / .55), prog(bk, .35, 1.05));
      txt('ARRIVÉ', px + 212, cy + 12, { font: F_DISP(84), ls: 3, color: '#FFFFFF', glow: 'rgba(243,167,69,.55)' });
      lineIn("à l'entrepôt", px + 216, cy + 72, prog(bk, .3, .75), { font: F_BODY(46, 700), color: AMBER });
      shine(px, py, PW, PH, 26, prog(bk, .45, 1.25));
      ctx.restore();
    }
    ctx.restore();
  }

  // =========================================================== s4 · Q2 unloading module
  function unloadIcon(x, y, s, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = s * .1; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(x - s * .5, y - s * .05); ctx.lineTo(x - s * .5, y + s * .5); ctx.lineTo(x + s * .5, y + s * .5); ctx.lineTo(x + s * .5, y - s * .05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - s * .55); ctx.lineTo(x, y + s * .22); ctx.moveTo(x - s * .22, y); ctx.lineTo(x, y + s * .22); ctx.lineTo(x + s * .22, y); ctx.stroke();
    ctx.restore();
  }
  function drawQ2(t, T, n) {
    const { tIn, tSec, tOut } = T.q2; const g = grp(t, tIn, tOut, .3, .35); if (g.a <= 0) return;
    const X = 60, Y = 470, Wd = 960, Hh = 304, k = g.k;
    const open = prog(k, 0, .5);
    ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(0, -16 * g.x);
    openPlate(X, Y, Wd, Hh, open, { accent: VIOLET, r: 24 });
    if (open > .45) {
      unloadIcon(X + 72, Y + 66, 52, AMBER);
      lineIn(decrypt('DÉCHARGEMENT', prog(k, .2, .65), 41), X + 128, Y + 88, prog(k, .2, .55), { font: F_DISP(56), ls: 2, color: '#FFFFFF' });
      // progress
      const fill = eInOutCubic(prog(t, tIn + .45, tSec));
      const pct = Math.round(fill * 100);
      txt(`${pct} %`, X + Wd - 40, Y + 88, { font: `700 52px ${FONT.mono}`, color: pct >= 100 ? AMBER : ICE, align: 'right', alpha: clamp(prog(k, .35, .6)), glow: pct >= 100 ? 'rgba(243,167,69,.8)' : null });
      const N = 24, bx = X + 40, bw = Wd - 80, by = Y + 122, bh = 62, gap = 7, sw = (bw - gap * (N - 1)) / N;
      const barIn = prog(k, .3, .75);
      for (let i = 0; i < N; i++) {
        const on = fill * N - i;                  // partial segment fill
        const sx = bx + i * (sw + gap), vis = clamp(barIn * N * 1.4 - i * .9);
        if (vis <= 0) continue;
        ctx.save(); ctx.globalAlpha *= vis;
        rrect(sx, by, sw, bh, 6); ctx.fillStyle = 'rgba(234,246,255,.12)'; ctx.fill();
        if (on > 0) {
          const c = i / N < .66 ? VIOLET : i / N < .86 ? AMBER : ORANGE;
          ctx.save(); rrect(sx, by, sw, bh, 6); ctx.clip();
          ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 14; ctx.fillRect(sx, by + bh * (1 - clamp(on)), sw, bh * clamp(on));
          ctx.restore();
        }
        ctx.restore();
      }
      // travelling glint on the filled part
      if (fill > 0 && fill < 1) {
        const hx = bx + bw * fill;
        ctx.save(); ctx.globalAlpha *= .9; ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = CYAN; ctx.shadowBlur = 24;
        ctx.fillRect(hx - 2, by - 8, 4, bh + 16); ctx.restore();
      }
      // safety row
      const sa = prog(k, .55, .95), hit = t >= tSec, hk = prog(t, tSec, tSec + .7);
      const shX = X + 74, shY = Y + 244;
      const pulse = hit ? 1 + .3 * Math.sin(Math.PI * prog(t, tSec, tSec + .45)) : 1;
      ctx.save(); ctx.translate(shX, shY); ctx.scale(pulse, pulse);
      shield(0, 0, 34, hit ? AMBER : 'rgba(234,246,255,.75)', clamp(sa * 1.4), 'rgba(12,7,28,.7)');
      ctx.restore();
      if (hit && hk < 1) { ring(shX, shY, 40 + 90 * eOutExpo(hk), AMBER, 3, 1 - hk); }
      lineIn('EN TOUTE SÉCURITÉ', X + 128, Y + 262, sa, {
        font: F_UI(52), ls: 3, color: hit ? AMBER : ICE, alpha: hit ? 1 : .78,
        glow: hit ? `rgba(243,167,69,${.85 * (1 - .5 * hk)})` : null, glowBlur: 26,
      });
    }
    ctx.restore();
  }

  // =========================================================== s5 · V07 header + info chips
  function chip(x, y, label, k, t0k, alpha = 1) {
    if (k <= 0) return 0;
    const font = F_BODY(46, 700), tw = measure(label, font), h = 88, w = 36 + 52 + 18 + tw + 34;
    ctx.save(); ctx.globalAlpha *= alpha;
    openPlate(x, y, w, h, k, { border: 'rgba(243,167,69,.85)', r: 44 });
    if (k > .3) {
      const p = prog(k, .3, 1);
      checkBadge(x + 36 + 26, y + h / 2, 24, p, t0k);
      lineIn(label, x + 36 + 52 + 18, y + 61, p, { font, color: '#FFFFFF' });
    }
    ctx.restore();
    return w;
  }
  function drawV07(t, T) {
    const { tIn, tOut, c1, c2, cOut } = T.v07;
    const g = grp(t, tIn, tOut, .3, .32);
    if (g.a > 0) {
      const X = 60, Y = 370, Hh = 118, label = "L'ENTREPÔT BONZINI", font = F_UI(62), tw = measure(label, font, 2);
      const Wd = 40 + 70 + 22 + tw + 44, k = g.k;
      ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(-30 * g.x, 0);
      openPlate(X, Y, Wd, Hh, prog(k, 0, .5), { accent: ORANGE, border: 'rgba(169,71,254,.9)' });
      if (k > .15) {
        const pk = eOutBack(prog(k, .15, .55)), px = X + 40 + 35, py = Y + Hh / 2 + 6;
        for (const [o, sd] of [[0, 0], [.5, 1]]) { const q = ((t * .7 + o) % 1); ring(px, py + 14, 10 + 40 * eOutCubic(q), ORANGE, 2.5, (1 - q) * .8 * clamp(pk)); }
        ctx.save(); ctx.translate(px, py); ctx.scale(pk, pk); pin(0, 0, 52); ctx.restore();
      }
      lineIn(label, X + 40 + 70 + 22, Y + 82, prog(k, .25, .75), { font, ls: 2, color: '#FFFFFF' });
      ctx.restore();
    }
    // chips (y 790–878, left half + right half; outside the right-column no-go zone)
    const ga = env(t, c1 - .05, cOut, .25, .32);
    if (ga > 0) {
      ctx.save(); ctx.globalAlpha *= ga; ctx.translate(0, 14 * eInCubic(prog(t, cOut - .32, cOut)));
      const w1 = chip(60, 790, 'Conteneur vidé', prog(t, c1, c1 + .55), prog(t, c1 + .35, c1 + 1.1));
      chip(60 + (w1 || 400) + 22, 790, "Colis à l'abri", prog(t, c2, c2 + .55), prog(t, c2 + .35, c2 + 1.1));
      ctx.restore();
    }
  }

  // =========================================================== s5 · Q4 « COLIS DÉCHARGÉS » badge
  function drawQ4(t, T) {
    const { tIn, tOut } = T.q4; const g = grp(t, tIn, tOut, .2, .35); if (g.a <= 0) return;
    const k = g.k, cx = 540, PW = 860, PH = 360, px = cx - PW / 2, py = 520;
    const st = eOutBack(clamp(k / .45));
    ctx.save(); ctx.globalAlpha *= g.a * clamp(k / .15 + .2);
    ctx.translate(cx, py + PH / 2); const sc = lerp(1.2, 1, st) * (1 - .04 * g.x); ctx.scale(sc, sc); ctx.translate(-cx, -(py + PH / 2));
    plate(px, py, PW, PH, { r: 28, border: 'rgba(243,167,69,.95)', lw: 4, fill: 'rgba(11,7,24,.92)' });
    checkBadge(cx, py + 104, 64, clamp(k / .6), prog(k, .4, 1.2));
    txt('COLIS DÉCHARGÉS', cx, py + 250, { font: F_UI(74), ls: 2, color: '#FFFFFF', align: 'center', glow: 'rgba(169,71,254,.55)' });
    lineIn('en toute sécurité', cx, py + 318, prog(k, .15, .5), { font: F_BODY(50, 700), color: AMBER, align: 'center' });
    shine(px, py, PW, PH, 28, prog(k, .5, 1.3));
    ctx.restore();
  }

  // =========================================================== s5 · V08 tracked callouts + badge
  /** one tracked label: plate + a leader/marker to each of its objects while on screen, ✓ stamp on « rangé » */
  function trackedLabel(t, L, o, tick) {
    const g = grp(t, L.tIn, L.tOut, .25, .3); if (g.a <= 0) return;
    const font = o.font, lines = o.lines;
    const tw = Math.max(...lines.map(s => measure(s, font, o.ls || 0)));
    const PW = tw + 72, PH = o.lh * lines.length + 34;
    // plate x follows its object (o.follow of its motion), frozen once the object has left the frame
    let pcx = W / 2 + (o.bias || 0);
    if (o.follow) {
      const pa = trackAt(o.tracks[0], Math.min(t, L.tLeave - .03));
      if (pa) pcx += (pa.x - W / 2) * o.follow;
    }
    pcx = clamp(pcx, o.xMin + PW / 2, o.xMax - PW / 2);
    const PX = pcx - PW / 2, PY = o.y, k = g.k;
    ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(0, -10 * g.x);
    o.tracks.forEach((name, i) => {
      const p = trackAt(name, t); if (!p || p.vis <= 0) return;
      const kk = i ? clamp((t - L.tIn - .2) / .3) : prog(k, 0, .3);
      const below = p.y > PY + PH;
      const ax = clamp(p.x, PX + 34, PX + PW - 34), ay = below ? PY + PH : PY;
      const pts = [[p.x, p.y], [ax, lerp(p.y, ay, .45)], [ax, ay]];
      marker(p.x, p.y, kk, t, o.seed + i, p.vis);
      if (leader(pts, eOutCubic(i ? kk : prog(k, .06, .34)), p.vis) && kk > .5) {
        ctx.save(); ctx.globalAlpha *= p.vis; ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = VIOLET; ctx.shadowBlur = 10; ctx.fill(); ctx.restore();
      }
    });
    openPlate(PX, PY, PW, PH, prog(k, .1, .42), { accent: AMBER, from: 'center' });
    lines.forEach((s, i) => lineIn(s, PX + 36, PY + 17 + o.lh * (i + 1) - o.lh * .24, prog(k, .18 + i * .1, .5 + i * .1), { font, ls: o.ls || 0, color: '#FFFFFF' }));
    // ✓ stamp on the plate corner
    if (t >= tick) {
      const q = clamp((t - tick) / .35), e = eOutBack(q), sx = PX + PW + 8, sy = PY - 2;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(e, e);
      ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.shadowBlur = 18; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
      if (q > .3) checkMark(sx, sy + 1, 26 * e, eOutCubic(clamp((q - .3) / .5)), INK, 5);
      const r = prog(t, tick, tick + .6); if (r < 1) ring(sx, sy, 25 + 40 * eOutExpo(r), AMBER, 2.5, 1 - r);
    }
    ctx.restore();
  }
  function drawV08(t, T) {
    const V = T.v08;
    trackedLabel(t, V.cartons, { tracks: ['cartons'], lines: ['CARTONS'], font: F_UI(56), ls: 3, lh: 62, y: 398, follow: .62, xMin: 40, xMax: 1040, seed: 1 }, V.tick);
    trackedLabel(t, V.bale, { tracks: ['bale'], lines: ['MARCHANDISES', 'EMBALLÉES'], font: F_UI(52), ls: 2, lh: 60, y: 712, follow: .55, xMin: 40, xMax: 820, seed: 2 }, V.tick + .1);
    trackedLabel(t, V.sack, { tracks: ['sack', 'bigsack'], lines: ['SACS'], font: F_UI(56), ls: 3, lh: 62, y: 736, follow: 0, bias: 330, xMin: 700, xMax: 1010, seed: 3 }, V.tick + .2);
    // « Rangé en sécurité ✓ »
    const g = grp(t, V.badge, V.bOut, .25, .35);
    if (g.a > 0) {
      const k = g.k, label = 'Rangé en sécurité', font = F_BODY(64, 800), tw = measure(label, font);
      const PW = 64 + 90 + 26 + tw + 30 + 70 + 44, PH = 156, px = W / 2 - PW / 2, py = 526;
      const st = eOutBack(clamp(k / .45));
      ctx.save(); ctx.globalAlpha *= g.a * clamp(k / .15 + .2); ctx.translate(W / 2, py + PH / 2);
      const sc = lerp(1.16, 1, st); ctx.scale(sc, sc); ctx.translate(-W / 2, -(py + PH / 2)); ctx.translate(0, -12 * g.x);
      plate(px, py, PW, PH, { r: 26, border: 'rgba(243,167,69,.95)', lw: 4, fill: 'rgba(11,7,24,.92)' });
      const sx = px + 64 + 40, sy = py + PH / 2;
      const sp = prog(k, .1, .5), hk = prog(k, .35, 1.1);
      ctx.save(); ctx.translate(sx, sy); const pu = 1 + .22 * Math.sin(Math.PI * prog(k, .35, .75)); ctx.scale(pu, pu); shield(0, 0, 50, AMBER, clamp(sp * 1.5)); ctx.restore();
      if (hk > 0 && hk < 1) ring(sx, sy, 50 + 80 * eOutExpo(hk), AMBER, 3, 1 - hk);
      const tx = sx + 50 + 40;
      lineIn(label, tx, sy + 22, prog(k, .2, .65), { font, color: '#FFFFFF' });
      checkMark(tx + tw + 30 + 30, sy, 58, eOutCubic(prog(k, .6, 1.0)), AMBER, 9);
      shine(px, py, PW, PH, 26, prog(k, .7, 1.5));
      ctx.restore();
    }
  }

  // =========================================================== s6 · V09 call-to-action
  function chevrons(x, y, s, t, a) {
    ctx.save(); ctx.globalAlpha *= a; ctx.lineWidth = s * .16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.6 - i * .22) % 1, al = .25 + .75 * Math.max(0, Math.sin(Math.PI * ph));
      ctx.strokeStyle = i === 2 ? ORANGE : AMBER; ctx.globalAlpha = a * al; ctx.shadowColor = AMBER; ctx.shadowBlur = 12;
      const cx = x + i * s * .62;
      ctx.beginPath(); ctx.moveTo(cx - s * .22, y - s * .4); ctx.lineTo(cx + s * .18, y); ctx.lineTo(cx - s * .22, y + s * .4); ctx.stroke();
    }
    ctx.restore();
  }
  function drawV09(t, T) {
    const { tIn, tOut } = T.v09; const g = grp(t, tIn, tOut, .3, .35); if (g.a <= 0) return;
    const X = 60, Y = 380, Wd = 960, Hh = 222, k = g.k;
    ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(0, -16 * g.x);
    const p = trackAt('stack', t);
    if (p && p.vis > 0) {
      const ax = clamp(p.x, X + 60, X + Wd - 60), ay = Y + Hh;
      leader([[p.x, p.y], [ax, lerp(p.y, ay, .5)], [ax, ay]], eOutCubic(prog(k, .45, .85)), p.vis);
      marker(p.x, p.y, prog(k, .35, .7), t, 4, p.vis);
    }
    openPlate(X, Y, Wd, Hh, prog(k, 0, .5), { accent: ORANGE, border: 'rgba(243,167,69,.9)', r: 24 });
    lineIn(decrypt('À VOUS DE JOUER', prog(k, .15, .55), 91), X + 48, Y + 96, prog(k, .15, .5), { font: F_DISP(66), ls: 2, color: AMBER, glow: 'rgba(243,167,69,.55)' });
    lineIn('Venez récupérer vos colis', X + 50, Y + 176, prog(k, .3, .7), { font: F_BODY(56, 800), color: '#FFFFFF' });
    shine(X, Y, Wd, Hh, 24, prog(k, .55, 1.35));
    const ca = prog(k, .7, 1.1);
    if (ca > 0) chevrons(X + Wd - 150, Y + 158, 50, t, ca);
    ctx.restore();
  }

  // =========================================================== s6 · pick-up location card
  function drawCard(t, T, n) {
    const { tIn, tHi, tSteps, tOut } = T.card; const g = grp(t, tIn, tOut, .35, .35); if (g.a <= 0) return;
    const district = String(CONFIG.district || '').trim();
    const dY = district ? 56 : 0;
    const X = 50, Y = 380, Wd = 980, Hh = 686 + dY, cx = W / 2, k = g.k;
    const open = eOutExpo(prog(k, 0, .55));
    ctx.save(); ctx.globalAlpha *= g.a; ctx.translate(cx, Y + Hh / 2); const sc = 1 - .03 * g.x; ctx.scale(sc, sc); ctx.translate(-cx, -(Y + Hh / 2));
    // card body opens vertically from its centre
    if (open > 0) {
      const hh = Math.max(40, Hh * open), yy = Y + (Hh - hh) / 2;
      plate(X, yy, Wd, hh, { r: 30, fill: 'rgba(11,7,24,.92)', border: 'rgba(169,71,254,.9)', lw: 3 });
      ctx.save(); rrect(X, yy, Wd, hh, 30); ctx.clip();
      const rg = ctx.createRadialGradient(cx, Y + 130, 0, cx, Y + 130, 520);
      rg.addColorStop(0, 'rgba(254,86,13,.20)'); rg.addColorStop(.5, 'rgba(169,71,254,.08)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(X, yy, Wd, hh);
      // faint map grid (texture)
      ctx.strokeStyle = 'rgba(169,71,254,.12)'; ctx.lineWidth = 1;
      for (let gx = X + 20; gx < X + Wd; gx += 56) { ctx.beginPath(); ctx.moveTo(gx, yy); ctx.lineTo(gx, yy + hh); ctx.stroke(); }
      for (let gy = Y + 18; gy < Y + Hh; gy += 56) { ctx.beginPath(); ctx.moveTo(X, gy); ctx.lineTo(X + Wd, gy); ctx.stroke(); }
      ctx.restore();
      brackets(X + 14, yy + 14, X + Wd - 14, yy + hh - 14, 46, AMBER, 4, clamp(open * 1.5 - .5), 'rgba(243,167,69,.8)');
    }
    if (open > .6) {
      // pin + radar
      const px = cx, py = Y + 110, pk = eOutBack(prog(k, .3, .75)), RR = 60;
      const rA = clamp(prog(k, .45, .8));
      ctx.save(); ctx.globalAlpha *= rA;
      ctx.strokeStyle = 'rgba(234,246,255,.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 8]);
      ctx.beginPath(); ctx.arc(px, py + 30, RR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.translate(px, py + 30); ctx.rotate(t * 1.5);
      const sg = ctx.createLinearGradient(0, 0, RR, 0); sg.addColorStop(0, 'rgba(254,86,13,0)'); sg.addColorStop(1, 'rgba(254,86,13,.55)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, RR, -.55, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 3; i++) { const q = ((t - tIn) * .75 + i / 3) % 1; ring(px, py + 30, 14 + (RR - 8) * eOutCubic(q), ORANGE, 3, (1 - q) * .85 * rA); }
      if (t >= tHi) { const q = prog(t, tHi, tHi + .9); ring(px, py + 30, 20 + 200 * eOutExpo(q), AMBER, 4, (1 - q)); }
      ctx.save(); ctx.translate(px, py + 30); ctx.scale(pk, pk); ctx.translate(0, -30 - 26 * (1 - clamp(pk))); pin(0, 0, 70); ctx.restore();
      // texts
      lineIn('POINT DE RETRAIT', cx, Y + 250, prog(k, .4, .85), { font: F_UI(50), ls: 7, color: AMBER, align: 'center' });
      lineIn('Entrepôt Bonzini Trading Cargo', cx, Y + 326, prog(k, .55, 1.05), { font: F_BODY(56, 800), color: '#FFFFFF', align: 'center' });
      // FOYER BALENGOU (highlight when spoken)
      const hk = prog(t, tHi - .08, tHi + .45), hi = eOutCubic(hk);
      const fy = Y + 452, fFont = F_UI(94), fw = measure('FOYER BALENGOU', fFont, 2);
      const fIn = prog(k, .7, 1.2);
      if (hi > 0) {
        const bw = fw + 64, bh = 114, bx = cx - bw / 2, by = fy - 89;
        ctx.save(); ctx.globalAlpha *= hi;
        rrect(bx, by, bw * eOutExpo(hk), bh, 18); ctx.fillStyle = 'rgba(243,167,69,.16)'; ctx.fill();
        ctx.restore();
        brackets(bx - 18 * (1 - hi), by - 12 * (1 - hi), bx + bw + 18 * (1 - hi), by + bh + 12 * (1 - hi), 30, AMBER, 5, hi, 'rgba(243,167,69,.9)');
      }
      lineIn('FOYER BALENGOU', cx, fy, fIn, { font: fFont, ls: 2, align: 'center', color: hi > .5 ? AMBER : ICE, glow: hi > 0 ? `rgba(243,167,69,${.8 * hi})` : null, glowBlur: 30 });
      shine(X, Y, Wd, Hh, 30, prog(t, tHi + .1, tHi + 1.0));
      if (district) lineIn(district, cx, fy + 62, prog(k, .9, 1.35), { font: F_UI(48), ls: 2, color: ICE, align: 'center' });
      // divider
      const dv = eOutExpo(prog(t, tSteps - .3, tSteps + .3));
      if (dv > 0) {
        const dyy = Y + 506 + dY, lg = ctx.createLinearGradient(X + 80, 0, X + Wd - 80, 0);
        lg.addColorStop(0, 'rgba(169,71,254,0)'); lg.addColorStop(.5, 'rgba(243,167,69,.9)'); lg.addColorStop(1, 'rgba(169,71,254,0)');
        ctx.save(); ctx.fillStyle = lg; ctx.fillRect(cx - (Wd / 2 - 80) * dv, dyy, (Wd - 160) * dv, 3); ctx.restore();
      }
      // 2-step mini guide
      const steps = [['1', "Venez à l'entrepôt"], ['2', 'Récupérez vos colis']];
      const sFont = F_BODY(46, 700), sw = Math.max(...steps.map(s => measure(s[1], sFont)));
      const gx = cx - (64 + 22 + sw) / 2;
      steps.forEach(([num, label], i) => {
        const sk = prog(t, tSteps + i * .3, tSteps + i * .3 + .45); if (sk <= 0) return;
        const yy = Y + 562 + dY + i * 68, e = eOutBack(clamp(sk * 1.3));
        ctx.save(); ctx.globalAlpha *= clamp(sk * 2);
        ctx.beginPath(); ctx.arc(gx + 30, yy, 28 * e, 0, Math.PI * 2); ctx.fillStyle = i ? ORANGE : AMBER; ctx.shadowColor = i ? ORANGE : AMBER; ctx.shadowBlur = 16; ctx.fill();
        ctx.restore();
        txt(num, gx + 30, yy + 14, { font: F_BODY(40, 800), color: INK, align: 'center', shadow: false, alpha: clamp(sk * 2) });
        lineIn(label, gx + 64 + 22, yy + 16, sk, { font: sFont, color: '#FFFFFF' });
      });
      const cn = prog(t, tSteps + .25, tSteps + .6);
      
    }
    ctx.restore();
  }

  // =========================================================== registration
  registerScene({
    id: 'footage_hud', z: 20,
    when: t => t >= TL.ch('s4').start && t < TL.ch('s6').end,
    draw: (t, n) => {
      const T = times();
      if (t < TL.ch('s5').start) { drawV06(t, T); drawQ1(t, T, n); drawQ2(t, T, n); }
      else if (t < TL.ch('s6').start) { drawV07(t, T); drawQ4(t, T); drawV08(t, T); }
      else { drawV09(t, T); drawCard(t, T, n); }
      drawSpeaker(t, T);
    },
  });
})();

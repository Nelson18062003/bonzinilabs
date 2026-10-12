'use strict';
// =============================================================================================
// « TROUVE LE MOT. » — M1 · 20_chrono.js — THE CHRONO (UI, screen space, on top of everything).
//   CH_chrono(t, n, st)   called by 50_compose.js with st = SCORE.chrono(tq), tq = n / FPS (a digit never ghosts across a
//                         tic: every motion-blur sub-sample of a frame gets the same chrono).
//   A little dark stopwatch (x 840–1010, y 160–350: disc r 85, crown at y ≥ 151) carrying:
//   • the amber RING, cut into 7 one-second segments, that empties CONTINUOUSLY clockwise like a clock hand (st.ring
//     1 → 0 over 0 … 7 s), a bright head dot on the moving edge; orange from « 2 » (st.warm); empty at the STOP;
//     refilled ANTI-clockwise to 6/7 in the rewind (the hand runs back) and amber again;
//   • the DIGIT 7 → 0 (110 px Satoshi 900), changed once per second exactly on the tic (TICK(k) = beats 1 and 3 of the
//     makossa), with a small knock (drop-in + pop; harder and a jiggle on the loud tics « 2 » « 1 »), white then orange;
//   • the STOP: the crown is pressed, the « 0 » jolts (spring), the watch shakes with the stamp, one orange shock ring;
//   • the ROLLING COUNTER 0 → 6 during the rewind (st.roll, st.digit float): the digits slide upward through a drum
//     window (clipped, faded top and bottom), with a vertical motion streak at speed — a counter that rolls, never a blink;
//   • the PULSE on « début » (st.pulse): the « 6 » swells once, the ring thickens and glows, one amber ripple;
//   • « secondes » (TEXTS id chronoLabel, 44 px) under it on a soft dark scrim; the exit = st.a / st.dy.
// Pure function of (t, n, st); deterministic (no Math.random, no Date); never ctx.filter (shadowBlur only). Reads
// SCORE.A (pulse ripple), SCORE.TEXTS() (the exact string), SCORE.COL. No literal action time.
// =============================================================================================
(function () {
  const S = window.SCORE, COL = S.COL, A = S.A, cl = S.cl, easeOut = S.easeOut;
  const TAU = Math.PI * 2, TOP = -Math.PI / 2;
  const WHITE = '#FFFFFF', CREAM = '#FFF3DC';
  const rgb = h => hexRgb(h);                                             // 02_light.js
  const mix = (c1, c2, k) => { const a = rgb(c1), b = rgb(c2); k = cl(k); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };
  const rgba = (c, al) => { const a = rgb(c); return `rgba(${a[0]},${a[1]},${a[2]},${cl(al).toFixed(3)})`; };
  let LABEL = null;
  const labelText = () => { if (LABEL === null) { const q = S.TEXTS().find(x => x[2] === 'chronoLabel'); LABEL = q ? q[3] : ''; } return LABEL; };

  // ---------- the digit drum (offscreen, DW × DW, centre = (DW/2, DW/2)) ----------
  const DW = 200;
  /** digit(s) into the drum canvas: integer → one glyph; float → the rolling strip, streaked along its speed (px / frame) */
  function drum(st, color, streak) {
    const c = makeCanvasCached('ch_drum', DW, DW), g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, DW, DW);
    g.font = `900 ${st.digitSize}px Satoshi`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = color;
    const base = DW / 2 + st.digitSize * .355, SP = st.digitSize * .96;   // cap-centred baseline · drum pitch
    const rolling = st.roll && Math.abs(st.digit - Math.round(st.digit)) > 1e-3;
    if (!rolling) { g.fillText(String(Math.round(st.digit)), DW / 2, base); return { c, rolling: false }; }
    const d0 = Math.floor(st.digit), fr = st.digit - d0;
    const strip = off => { for (let k = -1; k <= 2; k++) { const d = d0 + k; if (d < 0 || d > 9) continue; g.fillText(String(d), DW / 2, base + (k - fr) * SP + off); } };
    const K = streak > 1.5 ? Math.min(32, Math.ceil(streak / 1.5) + 1) : 1;   // ≤ 1.5 px between copies: no banding
    if (K === 1) strip(0);
    else { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 / K; for (let k = 0; k < K; k++) strip((k / (K - 1) - .5) * streak); }
    // the drum's curvature: digits fade out towards the top and bottom of the window
    g.globalAlpha = 1; g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(0, 0, 0, DW);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.14, 'rgba(0,0,0,.9)'); gr.addColorStop(.3, 'rgba(0,0,0,0)');   // the settled digit
    gr.addColorStop(.7, 'rgba(0,0,0,0)'); gr.addColorStop(.86, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,1)');    // (y .31–.69) stays clear
    g.fillStyle = gr; g.fillRect(0, 0, DW, DW); g.globalCompositeOperation = 'source-over';
    return { c, rolling: true };
  }

  // ---------- the watch body (disc + crown + side nub) ----------
  function body(cx, cy, r, press, warm) {
    const rim = 'rgba(255,244,228,.30)', dark0 = 'rgba(34,24,44,.84)', dark1 = 'rgba(10,6,16,.80)';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
    // crown (stem + cap), pressed by `press` px at the STOP
    const yc = cy - r;
    ctx.fillStyle = dark1; rrect(cx - 8, yc - 12 + press, 16, 18, 3); ctx.fill();
    ctx.fillStyle = dark0; rrect(cx - 17, yc - 19 + press, 34, 10, 4); ctx.fill();
    // side nub (upper right, the lap button)
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4.2); ctx.fillStyle = dark0; rrect(r - 6, -6, 14, 12, 3); ctx.fill(); ctx.restore();
    // disc
    const gr = ctx.createRadialGradient(cx - r * .35, cy - r * .45, r * .1, cx, cy, r);
    gr.addColorStop(0, dark0); gr.addColorStop(1, dark1);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = rim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, TAU); ctx.stroke();
    rrect(cx - 17, yc - 19 + press, 34, 10, 4); ctx.stroke();
    // the « time's up » blush of the face (orange, faint) once warm
    if (warm > 0) { ctx.fillStyle = rgba(COL.orange, .10 * warm); ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ---------- the ring ----------
  function ring(cx, cy, R, lw, frac, col, glow, glowCol) {
    ctx.save(); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();   // track
    const a0 = TOP + TAU * (1 - frac), a1 = TOP + TAU;                   // remaining: from the head (clockwise hand) to 12 o'clock
    if (frac > .0015) {
      if (glow > 0) { ctx.shadowColor = rgba(glowCol, glow); ctx.shadowBlur = 22; }
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255,238,206,.40)'; ctx.lineWidth = 2.2;  // enamel sheen on the inner side
      ctx.beginPath(); ctx.arc(cx, cy, R - lw * .26, a0, a1); ctx.stroke();
    }
    // 7 one-second cuts (the face's colour), over track and arc
    ctx.strokeStyle = 'rgba(14,8,22,.92)'; ctx.lineWidth = 3;
    for (let k = 0; k < 7; k++) { const a = TOP + k * TAU / 7, c = Math.cos(a), s = Math.sin(a); ctx.beginPath(); ctx.moveTo(cx + c * (R - lw / 2 - 1), cy + s * (R - lw / 2 - 1)); ctx.lineTo(cx + c * (R + lw / 2 + 1), cy + s * (R + lw / 2 + 1)); ctx.stroke(); }
    // the head: a bright bead on the moving edge (hidden when the ring is empty)
    if (frac > .0015) {
      const c = Math.cos(a0), s = Math.sin(a0), hx = cx + c * R, hy = cy + s * R;
      ctx.shadowColor = rgba(col, .95); ctx.shadowBlur = 14;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(hx, hy, lw / 2 + 2.5, 0, TAU); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(hx, hy, lw / 2 - 1.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- draw ----------
  function draw(t, n, st) {
    if (!st || st.a <= 0) return;
    const cx = st.cx, cy = st.cy, r = st.r, R = r - 13, LW = 13;
    const warm = cl(st.warm);
    const col = mix(COL.amber, COL.orange, warm);
    // knock on each tic (none on tic 0 = the cover frame); loud tics (« 2 », « 1 ») harder + a jiggle
    const tk = st.tick > 0 && st.tickAge < 1 ? st.tickAge : 9, amp = st.loud ? .12 : .065;
    const kn = tk < 9 ? amp * Math.exp(-tk * 15) : 0;
    const dropY = tk < 9 ? -12 * Math.exp(-tk * 22) : 0;
    const jig = st.loud && tk < 9 ? .055 * Math.exp(-tk * 9) * Math.sin(tk * 42) : 0;
    // the STOP: shake with the stamp (mostly sideways, never above the safe line), crown pressed, the « 0 » jolts
    const sa = st.stopAge;
    let shx = 0, shy = 0, press = 0, pop = 0, shock = -1;
    if (sa >= 0) {
      const d = sa * S.FPS; if (d < 8) { const q = 9 * Math.exp(-d * .5) * Math.cos(d * 2.3); shx = q; shy = Math.abs(q) * .25; }
      press = 6 * (sa < .06 ? 1 : Math.exp(-(sa - .06) * 14));
      pop = .32 * Math.exp(-sa * 9) * Math.cos(sa * 24);
      if (sa < .36) shock = sa / .36;                                     // ≤ 1.22 r: stays below the safe line (y 150)
    }
    // the « début » pulse + its ripple
    const pl = cl(st.pulse), rp = A.pulse !== undefined && t >= A.pulse && t < A.pulse + .5 ? (t - A.pulse) / .5 : -1;
    // the roll's speed (digits / s) → streak (px over a 180° shutter)
    let streak = 0;
    if (st.roll) { const h = 1 / 120, s1 = S.chrono(t - h), s2 = S.chrono(t + h); if (s1 && s2) streak = Math.abs(s2.digit - s1.digit) / (2 * h) * st.digitSize * .96 / (2 * S.FPS); }

    ctx.save();
    ctx.globalAlpha *= st.a; ctx.translate(shx, st.dy + shy);

    // soft dark scrim behind « secondes » (readable over any footage, no hard box)
    const ly = st.label.y1 - 8;
    ctx.save(); ctx.translate(cx, ly - st.label.size * .36); ctx.scale(1, .42);
    const sg = ctx.createRadialGradient(0, 0, 10, 0, 0, 130); sg.addColorStop(0, 'rgba(6,2,12,.50)'); sg.addColorStop(1, 'rgba(6,2,12,0)');
    ctx.fillStyle = sg; ctx.fillRect(-130, -130, 260, 260); ctx.restore();

    ctx.save();                                                          // the watch (the loud tics jiggle it, not the label)
    if (jig) { ctx.translate(cx, cy); ctx.rotate(jig); ctx.translate(-cx, -cy); }
    body(cx, cy, r, press, warm * (sa >= 0 ? 1 : .6));

    // shock ring at the STOP / amber ripple on « début » (strokes, never a flash)
    if (shock >= 0) { ctx.save(); ctx.strokeStyle = rgba(COL.orange, .85 * (1 - shock)); ctx.lineWidth = 1 + 6 * (1 - shock); ctx.beginPath(); ctx.arc(cx, cy, r * (1 + .22 * easeOut(shock)), 0, TAU); ctx.stroke(); ctx.restore(); }
    if (rp >= 0) { ctx.save(); ctx.strokeStyle = rgba(COL.amber, .7 * (1 - rp)); ctx.lineWidth = 1 + 5 * (1 - rp); ctx.beginPath(); ctx.arc(cx, cy, r * (1 + .2 * easeOut(rp)), 0, TAU); ctx.stroke(); ctx.restore(); }

    // the ring (thicker on the knock / pulse; glows orange on the loud tics, amber on the pulse)
    const glow = Math.max(st.loud && tk < 9 ? .8 * Math.exp(-tk * 7) : 0, .9 * pl);
    ring(cx, cy, R, LW + 40 * kn + 5 * pl, cl(st.ring), col, glow, pl > .01 ? COL.amber : COL.orange);

    // the digit (drum), knocked / popped / pulsed; the rolling drum is clipped to the face inside the ring. In the hunt
    // the digit is orange from its own tic (« 2 », « 1 », « 0 »): never a half-tinted digit on the frame of a tic
    const zero = sa >= 0 && !st.roll && Math.round(st.digit) === 0;
    const dWarm = sa < 0 ? (st.tick >= 5 ? 1 : 0) : zero ? 1 : warm;
    const dCol = mix(WHITE, COL.orange, dWarm);
    const dr = drum(st, dCol, streak);
    const sc = 1 + kn * 1.4 + pop + .22 * pl;
    ctx.save();
    if (dr.rolling) { ctx.beginPath(); ctx.arc(cx, cy, R - LW / 2 - 2, 0, TAU); ctx.clip(); }
    ctx.translate(cx, cy + dropY); ctx.scale(sc, sc);
    ctx.shadowColor = dWarm > .02 ? rgba(COL.orange, .55 * dWarm) : 'rgba(0,0,0,.45)'; ctx.shadowBlur = dWarm > .02 ? 16 : 8;
    if (pl > .01) { ctx.shadowColor = rgba(COL.amber, .8 * pl); ctx.shadowBlur = 20; }
    ctx.drawImage(dr.c, -DW / 2, -DW / 2);
    ctx.restore();
    ctx.restore();                                                       // end of the watch

    // « secondes »
    const s = labelText();
    if (s) {
      ctx.save(); ctx.font = `700 ${st.label.size}px Satoshi`; ctx.letterSpacing = '1px'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; ctx.fillStyle = WHITE; ctx.fillText(s, cx, ly);
      ctx.restore();
    }
    ctx.restore();
  }
  window.CH_M1 = { draw, drum };
})();
function CH_chrono(t, n, st) { window.CH_M1.draw(t, n, st); }

'use strict';
// =============================================================================================
// V2 LAYOUT — « La route du conteneur » : ONE paper diorama, read from LEFT (the sea, Kribi) to RIGHT (Mboppi).
// Ground line (where feet stand) at world y = GROUND. Stations along x. The camera travels; nothing teleports
// except at the single hard cut (S16, Mireille's diary page « MER. → JEU. »).
// All key times are functions of the voice timeline (TL), resolved lazily on the first draw.
// =============================================================================================
const GROUND = 1150;
const X = { sea: -700, quai: 520, porte: 1300, transit: 2300, guichet: 3300, scanner: 4300, caisse: 5200, barriere: 6100, route: 7150, mboppi: 8200 };
window.WIPE_CUTS = {};                                     // no wipes at all: the camera moves, or the diary page cuts (S16)

// ---------- time helpers (TL-based) -------------------------------------------------------------
const tw = (seg, word, off = 0, nth = 0) => TL.wt(seg, word, null, nth) + off;          // start of a word
const te = (seg, word, off = 0, nth = 0) => TL.we(seg, word, null, nth) + off;          // end of a word
const ss = (seg, off = 0) => TL.seg(seg).start + off;
const se = (seg, off = 0) => TL.seg(seg).end + off;
const chs = (id, off = 0) => TL.ch(id).start + off;
const che = (id, off = 0) => TL.ch(id).end + off;
/** the hard cut (S16): Mireille's diary page sweeps the frame; the camera jumps while the page covers it */
const CUT = () => ({ t: ss('S16', -.55), dur: .5 });

// ---------- stations (centres, world coordinates) --------------------------------------------------
station('quai', { x: X.quai, y: GROUND, label: 'QUAI · KRIBI' });
station('porte', { x: X.porte, y: GROUND, label: 'LA PORTE DU PAYS' });
station('transit', { x: X.transit, y: GROUND, label: 'TRANSIT' });
station('guichet', { x: X.guichet, y: GROUND, label: 'GUICHET DES DOUANES' });
station('scanner', { x: X.scanner, y: GROUND, label: 'SCANNER' });
station('caisse', { x: X.caisse, y: GROUND, label: 'PAIEMENT' });
station('barriere', { x: X.barriere, y: GROUND, label: 'SORTIE' });
station('route', { x: X.route, y: GROUND, label: 'DOUALA · MBOPPI' });
station('mboppi', { x: X.mboppi, y: GROUND, label: 'JUNIOR · BASKETS' });

/** camera centre y so that the ground line sits at screen y `gy` for zoom z */
const camY = (z, gy = 1210) => GROUND - (gy - H / 2) / z;
const shot = (t, x, z = 1, o = {}) => Object.assign({ t, x, y: camY(z, o.gy ?? 1210), z }, o);

// ---------- camera ----------------------------------------------------------------------------------
defineCamera(() => {
  const c = CUT();
  return [
    // ACT 1 — the stakes at Mboppi (empty shelves), then ONE long right→left travelling to the container at Kribi
    shot(0, X.mboppi, .95, { gy: 1260 }),
    shot(2.0, X.mboppi, .95, { gy: 1260 }),
    shot(2.7, X.mboppi - 300, .34, { gy: 1250, ease: 'io' }),
    shot(tw('S2', 'Dedans', -.4), X.quai + 250, .34, { gy: 1250, ease: 'soft' }),        // calmer travelling (≈ 4 s)
    shot(tw('S2', 'Dedans', .1), X.quai, 1.0, { ease: 'io', dur: .5 }),
    shot(tw('S2', 'baskets', .2), X.quai, 1.18, { dur: .8 }),
    shot(tw('S2', 'Devant', 0), X.quai + 380, .78, { dur: .9 }),
    // S3–S4: push on Junior's phone (the phone itself is a screen-space overlay)
    shot(ss('S3', -.1), X.quai - 170, 1.9, { gy: 1500, dur: 1.0 }),
    shot(se('S4', .2), X.quai - 170, 1.9, { gy: 1500 }),
    shot(ss('S5', -.3), X.quai + 120, 1.0, { dur: 1.1 }),
    // ACT 2 — left→right only, at the characters' pace
    shot(tw('S6', 'porte', 0), X.porte - 120, .92, { dur: 2.4 }),
    shot(se('S7', 0), X.porte - 60, 1.08, { dur: 2.2 }),
    shot(tw('S8', 'transitaire', .2), X.transit, 1.0, { dur: 2.2 }),
    shot(tw('S9', 'facture', -.2), X.transit + 40, 1.28, { dur: .9 }),
    shot(se('S9', .3), X.transit + 40, 1.28),
    shot(tw('S10', 'trois', 0), X.guichet, 1.0, { dur: 2.0 }),
    shot(tw('S10', 'Quoi', 0), X.guichet - 120, 1.35, { gy: 1380, dur: .7 }),
    shot(tw('S11', 'Combien', 0), X.guichet + 30, 1.35, { gy: 1380, dur: .7 }),
    shot(tw('S12', 'où', -.1), X.guichet + 160, 1.35, { gy: 1380, dur: .7 }),
    shot(tw('S13', 'poivre', 0), X.guichet + 170, 1.12, { dur: .9 }),
    shot(tw('S14', 'note', 0), X.guichet + 80, 1.3, { gy: 1370, dur: 1.0 }),
    shot(se('S14', 0), X.guichet + 80, 1.36, { gy: 1390, ease: 'lin' }),
    // S15: slow push on Junior's face (he is at guichet − 330)
    shot(se('S15', .6), X.guichet - 330, 2.1, { gy: 1650, dur: 3.4, ease: 'soft' }),
    // ACT 3 — HARD CUT under the diary page → the scanner, next day
    shot(c.t + c.dur * .5, X.guichet - 330, 2.1, { gy: 1650 }),
    shot(c.t + c.dur * .5 + .001, X.scanner - 80, .95, { ease: 'hold' }),
    shot(tw('S17', 'compare', 0), X.scanner + 200, 1.3, { dur: 1.2 }),
    shot(se('S17', .2), X.scanner + 200, 1.36, { ease: 'lin' }),
    shot(tw('S18', 'Car', -.1), X.scanner - 250, 1.5, { gy: 1450, dur: .9 }),
    shot(se('S18', .6), X.scanner - 250, 1.5, { gy: 1450 }),
    shot(tw('S19', 'amende', -.4), X.scanner + 460, 1.3, { gy: 1380, dur: 1.1 }),
    shot(se('S20', 0), X.scanner + 500, 1.34, { gy: 1390, ease: 'lin' }),
    // ACT 4 — the way out
    shot(tw('S21', 'règle', 0), X.caisse, 1.1, { dur: 2.0 }),
    shot(tw('S22', 'bon', 0), X.caisse + 80, 1.3, { dur: .8 }),
    shot(tw('S23', 'barrière', 0), X.barriere, .9, { dur: 2.2 }),
    shot(tw('S23', 'margouillat', .3), X.barriere + 120, 1.1, { dur: 1.0 }),
    shot(tw('S24', 'poivre', 0), X.barriere - 150, .7, { dur: 1.2 }),
    // EPILOGUE — the evening road home, then Saturday at Mboppi
    shot(ss('S25', -.2), X.route, .5, { gy: 1260, dur: 2.2 }),
    shot(tw('S25', 'étagères', 0), X.mboppi, .95, { gy: 1260, dur: 1.4 }),
    shot(tw('S25', 'diplôme', 0), X.mboppi + 260, 1.5, { gy: 1500, dur: 1.0 }),
    shot(ss('S26', 0), X.mboppi - 60, 1.15, { gy: 1300, dur: 1.2 }),
    shot(tw('S26', 'réussissiez', 0), X.mboppi - 60, 1.15, { gy: 1300 }),
    shot(ss('S27', 0), X.mboppi - 150, 1.8, { gy: 1560, dur: .8 }),
    shot(se('S27', .2), X.mboppi - 150, 1.8, { gy: 1560 }),
    shot(ss('S28', 0), X.mboppi + 40, 1.2, { gy: 1300, dur: .9 }),
    shot(se('S29', .1), X.mboppi + 40, 1.15, { gy: 1300, ease: 'lin' }),
    // S30: the crane — pull back and rotate 90°: the whole road stands upright in the 9:16 frame (quai at the bottom, Mboppi at the top)
    { t: tw('S30', 'Payez', 0), x: (X.quai + X.mboppi) / 2, y: GROUND - 120, z: .205, r: -Math.PI / 2, dur: 2.6, ease: 'io' },
    { t: se('S30', 3), x: (X.quai + X.mboppi) / 2, y: GROUND - 120, z: .2, r: -Math.PI / 2, ease: 'lin' },
  ];
});

// ---------- actors ----------------------------------------------------------------------------------
const FIG_S = .5;                                          // figures ≈ 460 px tall at z 1
const feetY = GROUND - 640 * FIG_S;                        // actor origin (chest) so that feet sit on the ground
const _poseHooks = {};
/** stations can override an actor's pose/face for a time window: poseHook('junior', t => t in window ? {face:'shock', arms:[...]} : null) */
function poseHook(name, fn) { (_poseHooks[name] = _poseHooks[name] || []).push(fn); }
function _pose(name, t, st) { const o = {}; for (const f of _poseHooks[name] || []) { const r = f(t, st); if (r) Object.assign(o, r); } return o; }
const figDraw = (fig, name) => (t, n, st) => {                // fig = global function name, resolved at draw time (12_cast loads later)
  const walk = st.moving ? stepT(n) * 1.9 : null, p = _pose(name, t, st);
  ctx.scale(FIG_S, FIG_S); window[fig](Object.assign({ walk, face: st.face || 'smile', look: st.look ?? 0 }, st.o || {}, p));
};
actor('junior', () => {
  const c = CUT();
  return [
    { t: 0, x: X.quai - 170, y: feetY, face: 'smile' },
    { t: tw('S2', 'Devant', 0), x: X.quai - 170, y: feetY, face: 'worry' },
    { t: ss('S5', 0), x: X.quai - 170, y: feetY, face: 'worry' },
    { t: tw('S6', 'porte', 0), x: X.porte - 260, y: feetY, face: 'smile', dur: 2.4 },
    { t: tw('S8', 'transitaire', 0), x: X.transit - 190, y: feetY, dur: 2.2 },
    { t: tw('S10', 'trois', 0), x: X.guichet - 330, y: feetY, dur: 2.0 },
    { t: c.t + c.dur * .5, x: X.guichet - 330, y: feetY, face: 'worry' },
    { t: c.t + c.dur * .5 + .001, x: X.scanner - 330, y: feetY, face: 'worry', ease: 'hold' },
    { t: tw('S18', 'Tout', 0), x: X.scanner - 330, y: feetY, face: 'grin' },
    { t: tw('S19', 'amende', -.3), x: X.scanner + 120, y: feetY, face: 'grin', dur: 1.5 },
    { t: tw('S21', 'règle', 0), x: X.caisse - 210, y: feetY, face: 'smile', dur: 2.0 },
    { t: tw('S23', 'barrière', 0), x: X.barriere - 260, y: feetY, face: 'grin', dur: 2.2 },
    { t: tw('S23', 'margouillat', 1.2), x: X.barriere + 520, y: feetY, a: 0, dur: 1.4 },  // climbs into the truck cab (leaves frame right)
    { t: ss('S25', -.3), x: X.mboppi - 150, y: feetY, a: 0, ease: 'hold' },
    { t: tw('S25', 'étagères', -.3), x: X.mboppi - 150, y: feetY, a: 1, face: 'grin', dur: .4 },
  ];
}, figDraw('juniorFig', 'junior'));
actor('mireille', () => {
  const c = CUT();
  return [
    { t: 0, x: X.porte + 200, y: feetY, a: 0 },
    { t: ss('S6', -1.6), x: X.porte + 200, y: feetY, a: 0, face: 'smile' },
    { t: ss('S6', -1.2), x: X.porte + 200, y: feetY, a: 1, dur: .3 },
    { t: ss('S6', .2), x: X.quai + 150, y: feetY, face: 'smile', dur: 1.4 },       // walks in from the port entrance
    { t: tw('S6', 'porte', 0), x: X.porte - 100, y: feetY, dur: 2.4 },
    { t: tw('S8', 'transitaire', 0), x: X.transit - 330, y: feetY, dur: 2.2 },
    { t: tw('S10', 'trois', 0), x: X.guichet + 330, y: feetY, dur: 2.0 },
    { t: c.t + c.dur * .5, x: X.guichet + 330, y: feetY },
    { t: c.t + c.dur * .5 + .001, x: X.scanner - 520, y: feetY, ease: 'hold' },
    { t: tw('S21', 'règle', 0), x: X.caisse + 330, y: feetY, dur: 2.8 },
    { t: tw('S23', 'barrière', 0), x: X.barriere - 420, y: feetY, dur: 2.2 },
    { t: tw('S24', 'poivre', 0), x: X.barriere - 40, y: feetY, dur: 1.2 },
    { t: se('S24', .3), x: X.barriere - 40, y: feetY },
    { t: ss('S25', -.3), x: X.barriere - 40, y: feetY, a: 0, ease: 'io', dur: .6 },
  ];
}, figDraw('mireilleFig', 'mireille'));

/** the container (and the truck that carries it from the scanner onwards) — drawn by 20_quai / 28_scanner / 32_barriere through containerAt(t) */
function containerAt(t) {
  const c = CUT(), t16 = c.t + c.dur * .5;
  if (t < t16) return { x: X.quai + 150, y: GROUND, onTruck: false };
  const out0 = tw('S23', 'barrière', 0), out1 = tw('S23', 'margouillat', 1.6);
  if (t < out0 - 1.8) return { x: X.scanner, y: GROUND, onTruck: true, inArch: t < tw('S18', 'Tout', .3) };
  if (t < out0) return { x: lerp(X.scanner, X.barriere - 120, eInOutCubic(prog(t, out0 - 1.8, out0))), y: GROUND, onTruck: true, moving: true };
  if (t < out1) return { x: lerp(X.barriere - 120, X.barriere + 900, eInCubic(prog(t, tw('S23', 'margouillat', .4), out1))), y: GROUND, onTruck: true, moving: t > tw('S23', 'margouillat', .4) };
  return null;                                               // gone towards Mboppi
}

// ---------- the violet thread (the container's road): tied to the empty shelf, laid right→left during the S1 travelling ----
defineRoute(() => ({
  pts: [[X.mboppi - 60, GROUND + 70], [X.route, GROUND + 90], [X.barriere, GROUND + 80], [X.caisse, GROUND + 90], [X.scanner, GROUND + 80],
        [X.guichet, GROUND + 90], [X.transit, GROUND + 80], [X.porte, GROUND + 90], [X.quai + 260, GROUND + 70]],
  prog: t => prog(t, 2.7, tw('S2', 'Dedans', -.4)),
}));

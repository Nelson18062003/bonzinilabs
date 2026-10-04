'use strict';
// =============================================================================================
// « JE SAVAIS PAS. » · 1/5 — « TCHAC ! » Prix chinois × 2 = ? — THE SCORE.
// ONE source of truth for picture AND sound (contract: SP/serie/PIPELINE.md). 1080×1920, 30 fps, seconds.
//   T[id]   = START of the speech of voice line `id` (ids of data/script.json). T.end = film duration.
//   DUR[id] = speech duration. Both are overwritten by data/timing.json (window.TIMING / node: read from disk).
//   W(id, prefix, nth, fallback) = absolute time of the nth word of `id` starting with `prefix` (accent/case-insensitive,
//             prefix may be an array), else T[id] + fallback (the fallback is scaled when the take is longer/shorter).
//   A       = every action time, DERIVED from T / DUR / W after the TIMING merge. Never a free literal.
// Every object state is a pure function of t. Loaded by the browser (window.SCORE) AND by node (module.exports).
// Own IIFE scope: kit.js already declares W (width), H, FPS, C, TL… — nothing here leaks to the global scope.
// =============================================================================================
(function () {
const FPS = 30;
// ---------- voice keys: v2 storyboard defaults (SCRIPT_V2.md §6.1 — clear diction at 3.6 syllables/s, the §6.3 silences;
// ids of data/script_v2.json, unchanged). The W()/WE() fallback seconds below are measured on these values. ----------
const T = { N1: .40, N2: 3.91, T1: 6.81, N3: 9.55, N4: 12.09, N5: 14.46, N6: 17.38, N7: 23.0, T2: 27.97, N8: 29.68, N9: 33.24, N10: 39.47, end: 44.54 };
const DUR0 = { N1: 3.06, N2: 2.5, T1: 2.14, N3: 1.94, N4: 1.67, N5: 2.22, N6: 5.02, N7: 4.47, T2: 1.31, N8: 3.06, N9: 5.83, N10: 4.47 };
const DUR = { ...DUR0 };
let WORDS = {};
let TM = null;
if (typeof window !== 'undefined' && window.TIMING) TM = window.TIMING;
else if (typeof require !== 'undefined') { try { TM = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'data', 'timing.json'), 'utf8')); } catch (e) { } }
if (TM) {
  for (const [k, v] of Object.entries(TM)) if (typeof v === 'number') T[k] = v;
  if (TM.dur) Object.assign(DUR, TM.dur);
  if (TM.words) WORDS = TM.words;
}
const N = Math.round(T.end * FPS);

// ---------- word anchors ----------
const nrm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const unel = s => String(s).replace(/^(?:[a-z]{1,2}|qu|jusqu)['’]/i, '');
const scaleFb = (id, fb) => fb * ((DUR[id] && DUR0[id]) ? DUR[id] / DUR0[id] : 1);
/** the nth word of line `id` starting with `prefix` → {s, e} absolute, or null */
function word(id, prefix, nth = 0) {
  const ws = WORDS[id]; if (!ws || T[id] == null) return null;
  const ps = (Array.isArray(prefix) ? prefix : [prefix]).map(nrm); let c = 0;
  for (const w of ws) {
    const f = [nrm(w.w), nrm(unel(w.w))];
    if (f.some(x => x && ps.some(p => x.startsWith(p)))) { if (c++ === nth) return { s: T[id] + w.s, e: T[id] + w.e }; }
  }
  return null;
}
/** absolute START time of the nth word starting with prefix, else T[id] + fallback */
function W(id, prefix, nth = 0, fallback = 0) { const w = word(id, prefix, nth); return w ? w.s : T[id] + scaleFb(id, fallback); }
/** absolute END time of that word, else T[id] + fallback */
function WE(id, prefix, nth = 0, fallback = 0) { const w = word(id, prefix, nth); return w ? w.e : T[id] + scaleFb(id, fallback); }
const END = id => T[id] + DUR[id];                     // end of the speech of `id`

// ---------- maths ----------
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const kk = (t, a, b) => b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a));
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - cl(x), 3);
const easeIn = x => x * x * x;
const lerpv = (a, b, k) => a + (b - a) * k;
const step2 = t => Math.floor(t * 15 + 1e-6) / 15;   // stop-motion « on twos »: hold every pose 2 frames (sub-frames too)
/** damped spring response 0→1 */
function spr(t, w = 16, z = .45) { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
/** landing squash after an impact at t0: {sx, sy} */
function squash(t, t0, amt = .2, freq = 30, damp = 9) {
  if (t < t0) return { sx: 1, sy: 1 };
  const s = t - t0, q = Math.exp(-s * damp) * Math.cos(s * freq) * amt; return { sx: 1 + q * .8, sy: 1 - q };
}
const rndS = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };   // deterministic, node-safe

// =============================================================================================
// A — every action time, derived (comments = value on the v2 defaults, SCRIPT_V2.md §6.2). « tchac » is no longer
// said: every cut is a sound effect alone, in the silence AFTER its line; every impact sits at the end of a word or in a
// silence, never at the start of a key word.
// =============================================================================================
const A = {};
// hook: the scissors snap at frame 0 (film origin) and once more 0.2 s later, both BEFORE the voice (N1 starts at 0.4 s)
A.snips = [0, Math.max(.12, T.N1 - .2)];                          // 0 / 0.20
A.cut1 = Math.min(END('N1') + .03, T.N2 - .12);                  // 3.49 TCHAC 1 (sound alone), between N1 and N2
A.slide1 = [A.cut1 + .27, A.cut1 + .87];                         // 3.76–4.36 the left half slides into FOURNISSEUR (on twos)
A.calcIn = A.cut1 + .05;                                         // the calculator enters « RESTE SUR LE BILLET »
A.stampBuy = W('N2', 'pay', 0, 1.1) + .2;                        // 5.21 stamp « PAYÉE 5 000 F EN CHINE » on « payée »
A.ding1 = Math.max(A.slide1[1] + .05, END('N2') + .05);          // 6.46 cash « ding »: after N2 (it used to sit on « Chine, tu l'as »)
A.challenge = Math.max(END('N2') + .06, A.stampBuy + 1.4);       // 6.61 « TU GAGNES COMBIEN ? » lands; PAYÉE held ≥ 1.4 s (§6.3: T.T1 ≥ challenge + .05)
A.toiIn = T.T1 - .12;                                            // 6.69 TOI's card slides in
A.ask = [W('T1', 'cinq', 0, 1.3), W('T1', 'cinq', 0, 1.3) + .62]; // 8.11 / 8.73 « 5 000 ? » blinks twice on the calculator (< 3 Hz)
A.dare = WE('T1', 'franc', 0, 1.9) + .05;                        // 8.76 « Tu dis combien ? ↓ » at the end of « francs »
A.tics = [END('T1') + .05, END('T1') + .3, END('T1') + .55];     // 9.0 / 9.25 / 9.5 three tic-tacs AFTER TOI; makossa in on the last (§6.3: T.N3 ≥ tics[2] + .05)
A.flyDur = .45;                                                  // a cut slice flies into its envelope (the first one: A.slide1)
// each envelope enters the slot on its label word, stays until its slice has landed (the couple « −X / RESTE Y » is held)
A.cutT = END('N3') + .1;                                         // 11.59 TCHAC 2 (sound alone), after « mille francs »
A.landT = A.cutT + .05 + A.flyDur;
A.envT = W('N3', 'transp', 0, .55) - .25;                         // 9.85 « Mais le transport » → TRANSPORT envelope in the slot
A.amtT = Math.min(W('N3', 'mil', 0, 1.4), A.envT + .6);           // 10.45 « −1 000 » written (on « mille » at the latest)
A.cutD1 = END('N4') + .1;                                        // 13.86 double TCHAC (sound alone), after « trois mille francs »
A.cutD2 = A.cutD1 + .3;                                          // 14.16 (music skips a beat here)
A.landD = A.cutD2 + .05 + A.flyDur;
A.envD = Math.max(W('N4', 'douane', 0, .28) - .25, A.landT + .1); // 12.19 DOUANE ≈ .2 s before « douane »
A.amtD = Math.min(W('N4', 'trois', 0, .85), A.envD + .6);         // 12.79 « −3 000 » on « trois mille » at the latest
A.sticker = A.amtD + .5;                                         // 13.29 yellow sticker « EXEMPLE / dépend du / produit »
A.cutF = END('N5') + .1;                                         // 16.78 TCHAC 4 (sound alone), after « cinq cents francs »
A.landF = A.cutF + .05 + A.flyDur;
A.envF = Math.max(W('N5', 'frais', 0, .85) - .25, A.landD + .1);  // 15.06
A.amtF = Math.min(W('N5', 'cinq', 0, 1.4), A.envF + .6);          // 15.66 « −500 » on « cinq cents » at the latest
A.doodles = [0, 1, 2, 3].map(i => A.amtF + .35 + .16 * i);      // taux · pousseur · taxi · crédit, drawn one by one
A.boxIn = A.landF + .1;                                          // 17.38 the shoe box drops in as soon as the last slice is in (the picture before the words)
A.lid = A.boxIn + .15;                                           // 17.53 lid off: two LEFT feet, seen during « Dans ta commande »
A.feet = A.lid + .15;                                            // 17.68 (§6.3: feet ≤ W(N6,'cinq') − .5)
A.stampInv = WE('N6', 'pas', 0, 2.8) + .02;                      // 20.20 « 5 PAIRES SUR 100 : NE SE VENDENT PAS » right AFTER « pas »
A.cutI = END('N6') + .1;                                         // 22.50 the last bit of the note → the box (sound alone, after « même »)
A.zeroCalc = A.cutI + .5;                                        // the calculator lands on 0 F
A.scExit = [A.cutI + .4, A.cutI + .85];                         // QA: the scissors fly off after the last cut (always a .45 s window)
A.musicCut = END('N6') + .1;                                     // 22.50 music cut dead: the key moment (= cutI)
A.boxOut = Math.max(A.musicCut, A.cutI + .05 + A.flyDur + .15);  // QA: the box leaves for the row once the last slice is in
// the strip « payées quand même : −500 par paire vendue » lands during the 2nd sentence (« Tu les as payées quand même »),
// just before « payées », and stays ≥ 1.45 s before the stamp fades at the music cut (stamps(): until musicCut + .3)
A.invSub = Math.min(Math.max(A.stampInv + .25, W('N6', 'pay', 0, 3.9) - .45), A.musicCut + .3 - 1.75);   // 20.84
A.coinSpin = A.musicCut + .15;                                   // a coin spins in the silence…
A.zeroEq = W('N7', ['zer', 'zero', '0'], 0, 3.6);                // 26.60 « = 0 » printed on « zéro »
A.zeroStamp = END('N7') + .02;                                   // 27.49 the giant card lands (stamp_big) AFTER « franc », in the silence
A.zeroFall = Math.min(T.N7 + .1, A.zeroStamp - .75);             // 23.10 slow fall while she says « Ton prix, c'était le prix chinois fois deux »
A.coinSettle = A.zeroStamp + .25;                                // 27.74 …the coin lies down (« ting »), before TOI (§6.3: T.T2 ≥ coinSettle + .2)
A.toiShrink = T.N7 - .1;                                         // the small TOI pill trembles
A.outlineOut = W('N8', 'compt', 0, .55) - .3;                    // the pencil outline of the note goes with the rule
A.toiZeroEnd = Math.max(END('T2') + .15, T.T2 + 1.45);           // 29.43 « Quoi ? Zéro franc ? » held ≥ 1.4 s
A.major = T.N8 - .1;                                             // 29.58 the makossa comes back in major
A.rule1 = W('N8', 'compt', 0, .55);                              // 30.23 « COMPTE TOUT. »
A.rule2 = W('N8', 'avant', 0, 1.1);                              // 30.78 « AVANT DE FIXER TON PRIX. »
A.stack = [0, 1, 2, 3, 4].map(i => Math.max(A.major + .4, A.toiZeroEnd + .3) + .25 * i);   // QA: on the eighth notes (120 BPM), once TOI's card has left the slot
A.pileLabel = Math.max(W('N8', 'tout', 0, .85), A.stack[0] + .1); // 30.53 « TOUT CE QUE TU PAIES » on « tout »
A.calcOut = A.stack[0] - .2;
A.brandIn = T.N9 - .12;                                          // 33.12 violet light; every figure leaves the frame
A.clearOut = [A.brandIn, A.brandIn + .5];
A.figOut = [A.brandIn - .3, A.brandIn + .2];                     // QA: the pile (every figure) is gone before the plate lands; the tag (no figure) leaves with clearOut
// felt-pen arrow pile → price tag « TON VRAI PRIX »: on « fixer », but early enough for the tag to be read ≥ 1.4 s before the
// brand clears the table (§6.3: brandIn − priceTag ≥ 1.4)
A.arrow = Math.max(A.stack[4] + .3, Math.min(W('N8', 'fix', 0, 1.95) - .15, A.brandIn - 1.8));   // 31.32
A.priceTag = A.arrow + .35;                                      // 31.67
A.sig = W('N9', 'bonz', 0, .55) - .05;                           // 33.74 balafon signature on « Bonzini »
A.plate = W('N9', 'bonz', 0, .55);                               // 33.79 enamel plate « BONZINI TRADING CARGO » lands
A.cartonIn = Math.min(W('N9', 'colis', 0, 2.75) - .45, A.plate + .45);   // QA: slides in right after the plate lands
A.scan = W('N9', 'colis', 0, 2.75);                              // 35.99 violet laser sweep + bip
A.bandBz = W('N9', 'colis', 0, 2.75) - .25;                      // 35.74 « TON COLIS, PESÉ ET MESURÉ / EN CHINE »
A.weigh = W('N9', 'pes', 0, 3.6);                                // 36.84 on the scale (« tonk »), needle settles
A.stampPese = A.weigh + .3;
A.measure = W('N9', 'mesur', 0, 4.45);                           // 37.69 tape measure along the edges (« mesuré » = syllable 17 of 21: 16 / 3.6)
A.stampMes = A.measure + .45;                                    // 38.14 (§6.4: if it masks « en Chine », → WE('N9','chin') + .02)
A.chine = W('N9', 'chin', 0, 5.4);                               // 38.64 « en Chine » (said; replaces « dès Guangzhou »)
A.endcard0 = END('N9') + .1;
A.bzLine2 = Math.max(A.bandBz + .3, Math.min(A.chine - .12, A.endcard0 - 1.55));   // 37.62 QA: line 2 « EN CHINE », held ≥ 1.4 s
A.endcard = A.endcard0;                                          // 39.17 logo + « Groupage mer et air · Chine → Douala »
A.cta = Math.max(W('N10', 'ecri', 0, 0), A.endcard + .15);       // 39.47 CTA pill « Écris CALCUL en commentaire ↓ » on « Écris »
A.share = A.cta + .55;
A.gulps = [A.cta + .55, A.cta + 1.05];                           // the margouillat swallows two crumbs of the note
A.ritual = W('N10', 'maint', 0, 3.08);                           // 42.55 « MAINTENANT, TU SAIS. » stamp (§6.3: T.end ≥ ritual + 1.9)
A.loop = T.end - .5;                                             // 44.04 → the note re-forms: last frame = frame 0
A.finalChord = A.loop - .25;
A.crumbs = A.cutD1;                                              // two crumbs fly off the note at the douane double cut

// ---------- layout (screen px, world = table coordinates before the camera) ----------
const G = {
  cx: 540,
  chip: { x: 44, y: 182 }, exemple: { x: 44, y: 250 },             // series chip + « EXEMPLE FICTIF » (screen space, top-left)
  head: { x: 540, y: 400 },                                        // headline zone (tag, title, stamps, plate, end card)
  sneaker: { x: 250, y: 410 }, tag: { x: 702, y: 392, w: 500, h: 300 },
  note: { x: 540, y: 760, w: 860, h: 380 },                        // the 10 000 F SPÉCIMEN note
  slot: { x: 285, y: 1118 },                                       // the active slot (middle-left): envelope / box / « Quoi ? Zéro franc ? » / pile
  toi1: { x: 765, y: 1372 },                                       // TOI's first card, under the calculator (the row is still empty)
  calc: { x: 765, y: 1112, w: 380, h: 250 },                       // « RESTE SUR LE BILLET »
  row: { y: 1436, xs: [305, 447, 589, 731, 873], s: .4 },          // done envelopes (+ the box last), bottom
  env: { w: 380, h: 250 },                                         // envelope size at s = 1 (active slot)
  box: { w: 400, h: 250 },
  zero: { x: 540, y: 760 },                                        // giant stamp « PRIX CHINOIS × 2 = 0 »
  rule: { x: 540, y: 560 }, pile: { x: 285, y: 1150 }, priceTag: { x: 765, y: 1135 },
  carton: { x: 540, y: 840 }, bzBand: { x: 528, y: 1268 }, stamps: { pese: { x: 255, y: 1085 }, mesure: { x: 830, y: 1085 } },
  end: { logo: { x: 540, y: 470 }, name: { y: 690 }, line: { y: 772 }, ritual: { x: 540, y: 975 }, cta: { x: 530, y: 1210 }, share: { y: 1370 } },   // QA: share line clear of the margouillat's head; v2: CTA centred on x 530 so « CALCUL »'s pill ends ≤ x 960
  gecko: { x: 112, y: 1420 },
  crumbs: [{ x: 238, y: 1338 }, { x: 290, y: 1352 }, { x: 330, y: 1366 }],
};
// the example (fictional, validated — SERIE.md « Faits utilisés »): one pair sold 10 000 F, pieces of the note
const EDGES = [0, .5, .6, .75, .9, .95, 1];                        // FOURNISSEUR · TRANSPORT · DOUANE (2 strokes) · PETITS FRAIS · INVENDUS
const PIECE_VALUE = [5000, 1000, 1500, 1500, 500, 500];
const PIECE_DEST = [0, 1, 2, 2, 3, 4];                             // envelope index (4 = the shoe box)
const PIECE_CUT = () => [A.cut1, A.cutT, A.cutD1, A.cutD2, A.cutF, A.cutI];
const ITEMS = [                                                    // the four envelopes + the shoe box (index 4)
  { id: 'four', label: 'FOURNISSEUR', amount: -5000 },
  { id: 'transport', label: 'TRANSPORT', amount: -1000, art: 'truckBoat', sub: 'camion en Chine + bateau' },
  { id: 'douane', label: 'DOUANE', amount: -3000, art: 'sticker', sticker: 'EXEMPLE|dépend du|produit' },
  { id: 'frais', label: 'PETITS FRAIS', amount: -500, art: 'doodles', doodles: ['taux', 'pousseur', 'taxi', 'crédit'] },
  { id: 'box', label: '5 PAIRES SUR 100 : NE SE VENDENT PAS', amount: -500, sub: 'payées quand même : −500 par paire vendue' },
];
// when each item enters the slot, when it leaves for the row, its amount writing time
const itemTimes = () => [
  { in: A.cut1 - .05, toRow: A.envT - .05, amt: A.slide1[1] - .05 },   // FOURNISSEUR stays through the challenge
  { in: A.envT, toRow: A.envD - .05, amt: A.amtT },
  { in: A.envD, toRow: A.envF - .05, amt: A.amtD },
  { in: A.envF, toRow: A.boxIn - .05, amt: A.amtF },
  { in: A.boxIn, toRow: A.boxOut, amt: A.stampInv },
];

// =============================================================================================
// THE NOTE, ITS PIECES, THE SCISSORS
// =============================================================================================
/** when piece i lands in its envelope / the box */
const landAt = i => i === 0 ? A.slide1[1] : PIECE_CUT()[i] + .05 + A.flyDur;
/** number of pieces cut off at t (0..6) */
const nCut = t => PIECE_CUT().filter(c => t >= c).length;
/** horizontal offset (local px) that keeps the remaining part centred, eased after every cut */
function noteOffset(t) {
  const cuts = PIECE_CUT(), w = G.note.w; let off = 0;
  for (let i = 0; i < 5; i++) {                                    // after the 6th cut nothing remains
    const target = -(EDGES[i + 1] / 2) * w, k = ease(kk(t, cuts[i] + .25, cuts[i] + .85));
    off = lerpv(off, target, k);
  }
  return off;
}
/** where a piece goes: its destination item's position at time t */
function pieceTarget(i, t) { const it = item(PIECE_DEST[i], t); return it ? { x: it.x, y: it.y - 10 * it.s, s: it.s } : { x: G.slot.x, y: G.slot.y, s: 1 }; }
/** the note: {x, y, s, rot, w, h, off (local x offset of the remaining part), from (fraction where the remaining part
 *  starts), pieces: [{i, a, b (fractions), x, y, s, rot, alpha, k (0..1 flight)}] (flying or re-forming pieces only),
 *  outline (0..1 dashed pencil outline of the full note), reform (0..1 the loop), cutLines (0..1 pencil cut marks)} */
function note(t) {
  const cuts = PIECE_CUT(), nc = nCut(t), w = G.note.w, h = G.note.h;
  let s = 1 + .03 * ease(kk(t, 0, A.cut1)) - .03 * ease(kk(t, A.cut1 + .1, A.cut1 + .8));
  const sq = squash(t, A.cut1, .025);
  const off = noteOffset(t);
  const pieces = [];
  for (let i = 0; i < 6; i++) {
    const tc = cuts[i]; if (t < tc) continue;
    const st = i === 0 ? A.slide1[0] : tc + .05, dur = i === 0 ? A.slide1[1] - A.slide1[0] : A.flyDur;
    const tt = i === 0 ? step2(t) : t;                              // the first slide is stop-motion on twos
    const k = kk(tt, st, st + dur); if (k >= 1) continue;
    const a = EDGES[i], b = EDGES[i + 1], o0 = noteOffset(tc - .01);
    const x0 = G.note.x + o0 + ((a + b) / 2 - .5) * w, y0 = G.note.y, tg = pieceTarget(i, st + dur);
    const e = ease(k), sz = (b - a) * w;
    const sEnd = Math.min(.95, (G.env.w * .62 * tg.s) / Math.max(sz, 1));   // shrinks to fit the envelope mouth
    pieces.push({ i, a, b, x: lerpv(x0, tg.x, e), y: lerpv(y0, tg.y, e) - Math.sin(e * Math.PI) * (i === 0 ? 40 : 140),
      s: lerpv(1, sEnd, e), rot: (i % 2 ? 1 : -1) * e * (i === 0 ? .12 : .9), alpha: 1 - kk(k, .88, 1), k });
  }
  // crumbs: two tiny bits fly off at the douane cut, land by the margouillat (drawn by compose; read by the gecko)
  // the loop: six pieces fly back in from outside and click together at T.end (= frame 0)
  const reform = kk(t, A.loop, T.end);
  if (t >= A.loop) {
    for (let i = 0; i < 6; i++) {
      const a = EDGES[i], b = EDGES[i + 1], ang = -2.2 + i * .9, R = 1300;
      const k = easeOut(kk(t, A.loop + i * .03, T.end - .04));
      const x1 = G.note.x + ((a + b) / 2 - .5) * w, y1 = G.note.y;
      pieces.push({ i, a, b, x: lerpv(x1 + Math.cos(ang) * R, x1, k), y: lerpv(y1 + Math.sin(ang) * R, y1, k), s: 1, rot: (1 - k) * (i % 2 ? .8 : -.8), alpha: 1, k, reform: true });
    }
  }
  return {
    x: G.note.x, y: G.note.y, s, sx: sq.sx, sy: sq.sy, rot: -.012, w, h, off,
    from: EDGES[Math.min(nc, 6)], visible: nc < 6, pieces,
    outline: t < A.outlineOut ? kk(t, A.cut1, A.cut1 + .3) : 1 - kk(t, A.outlineOut, A.outlineOut + .4),
    cutLines: 1 - kk(t, A.musicCut - .2, A.musicCut), reform,
    crumbs: kk(t, A.crumbs, A.crumbs + .55),
  };
}
/** the scissors: {x, y, rot, s, open (0 closed … 1 wide), a, snap (s since the last snap, or -1)} — pivot in world px,
 *  blades pointing down along the cut line */
function scissors(t) {
  const cuts = PIECE_CUT(), w = G.note.w, hy = G.note.y - 40;          // hover: pivot just above the middle of the note
  const lineX = (i, tt) => {                                        // world x of cut i's line at time tt
    const f = i < 5 ? EDGES[i + 1] : (EDGES[5] + EDGES[6]) / 2;
    return G.note.x + noteOffset(tt) + (f - .5) * w;
  };
  const snaps = [...A.snips, ...cuts].sort((a, b) => a - b);
  let last = -1; for (const s of snaps) if (t >= s) last = s;
  const sn = last < 0 ? -1 : t - last;
  // open amount: hover breathing, snap shut, re-open
  let open = .55 + .1 * Math.sin(t * 7);
  if (sn >= 0 && sn < .08) open = .55 * (1 - sn / .08);
  else if (sn >= .08 && sn < .3) open = .55 * ((sn - .08) / .22);
  // target cut line: the next cut not yet done
  let i = cuts.findIndex(c => t < c + .2); if (i < 0) i = 5;
  const tc = cuts[i], prevT = i > 0 ? cuts[i - 1] : -1;
  const fromX = i > 0 ? lineX(i - 1, prevT + .3) : lineX(0, 0);
  const travel = i > 0 ? ease(kk(t, prevT + .3, Math.min(prevT + .9, tc - .2))) : 1;
  let x = lerpv(fromX, lineX(i, t), travel), y = hy - 60 * Math.sin(Math.PI * travel);   // lifts a little while travelling
  // the cut stroke: the blades push down the line as they snap
  const d = t - tc; if (d > -.06 && d < .35) y += 120 * Math.sin(Math.PI * cl((d + .06) / .41));
  // exit after the last cut, back for the loop
  const out = easeIn(kk(t, A.scExit[0], A.scExit[1])), back = easeOut(kk(t, A.loop, T.end));
  if (t >= A.loop) { x = lerpv(1400, lineX(0, 0), back); y = hy; open = .55 + .1 * Math.sin(t * 7) * (1 - back); }   // QA: lands on frame 0's opening (.55)
  else x += out * 900;
  return { x, y, rot: Math.PI / 2 + .08, s: 1.1, open, a: t >= A.loop || out < 1 ? 1 : 0, snap: sn };   // on screen from frame 0
}

// =============================================================================================
// ENVELOPES + BOX (items), CALCULATOR, STAMPS, PILE
// =============================================================================================
/** item k at t: null or {k, id, label, amount, x, y, s, rot, a, fill (0..n pieces in), amountK (0..1 marker writing),
 *  art (0..1 the drawing / sticker / doodles), active (1 = in the slot, big; 0 = on the row), lid, feet (box only), stack} */
function item(k, t) {
  const tm = itemTimes()[k], D = ITEMS[k];
  if (t < tm.in - .02 || t >= A.clearOut[1] + .1) return null;
  const slot = G.slot, row = { x: G.row.xs[k], y: G.row.y };
  let x, y, s, rot = (k % 2 ? .035 : -.03), a = 1;
  // enter: slides in from the left edge to the slot (box: drops from above)
  const ein = k === 4 ? spr(t - tm.in, 13, .5) : easeOut(kk(t, tm.in, tm.in + .32));
  if (k === 4) { x = slot.x; y = lerpv(slot.y - 520, slot.y, cl(ein, 0, 1.08)); s = 1; }
  else { x = lerpv(-260, slot.x, ein); y = slot.y; s = 1; }
  // to the row (shrinks)
  const tr = ease(kk(t, tm.toRow, tm.toRow + .45));
  if (tr > 0) { x = lerpv(slot.x, row.x, tr); y = lerpv(slot.y, row.y, tr) - Math.sin(tr * Math.PI) * 60; s = lerpv(1, G.row.s, tr); rot = lerpv(rot, (k % 2 ? .05 : -.04), tr); }
  // the rule: on the beat, every item jumps onto the pile in the slot
  const ts = A.stack[k], st = ease(kk(t, ts - .3, ts));
  if (st > 0) { const px = G.pile.x + (k % 2 ? 14 : -12), py = G.pile.y - k * 34; x = lerpv(x, px, st); y = lerpv(y, py, st) - Math.sin(st * Math.PI) * 120; s = lerpv(s, .62, st); rot = lerpv(rot, (rndS(k + 3) - .5) * .16, st); }
  // the brand: everything with a figure leaves the frame
  const out = easeIn(kk(t, A.figOut[0] + k * .03, A.figOut[1]));
  if (out > 0) { x -= out * 900; rot -= out * .4; }
  const fill = PIECE_DEST.reduce((n, d, i) => n + (d === k && t >= landAt(i) ? 1 : 0), 0);
  const land = (() => { for (let i = 5; i >= 0; i--) if (PIECE_DEST[i] === k && t >= landAt(i)) return landAt(i); return null; })();
  const sq = land != null ? squash(t, land, .08) : { sx: 1, sy: 1 };
  const amountK = kk(t, tm.amt, tm.amt + .4);
  let art = 0;
  if (k === 1) art = kk(t, tm.in + .25, tm.in + .9);                 // felt-pen truck + boat drawn while it slides in
  if (k === 2) art = kk(t, A.sticker, A.sticker + .15);              // yellow sticker slapped
  if (k === 3) art = kk(t, A.doodles[0], A.doodles[3] + .3);         // 4 doodles, one by one
  const o = { k, id: D.id, label: D.label, amount: D.amount, sub: D.sub, sticker: D.sticker, doodles: D.doodles,
    x, y, s, sx: sq.sx, sy: sq.sy, rot, a, fill, amountK, art, active: 1 - tr, stack: st, out };
  if (k === 4) { o.lid = kk(t, A.lid, A.lid + .18); o.feet = kk(t, A.feet, A.feet + .2); o.boing = t >= A.feet ? squash(t, A.feet, .12, 34, 7) : null; }
  return o;
}
const items = t => [0, 1, 2, 3, 4].map(k => item(k, t)).filter(Boolean);
/** RESTE SUR LE BILLET: what has landed so far, rolling */
function resteAt(t) {
  const cuts = PIECE_CUT(); let v = 10000;
  for (let i = 0; i < 6; i++) {
    const st = i === 0 ? A.slide1[0] : cuts[i] + .05, dur = i === 0 ? A.slide1[1] - A.slide1[0] : .45;
    v -= PIECE_VALUE[i] * easeOut(kk(i === 0 ? step2(t) : t, st, st + dur));
  }
  return Math.max(0, Math.round(v / 10) * 10);
}
/** the calculator: null or {x, y, s, rot, a, value (rounded, rolling), label, ask (true = « 5 000 ? » blink on),
 *  zero (0..1 red « 0 F »), flash (0..1 after a change)} */
function calc(t) {
  if (t < A.calcIn || t >= A.calcOut + .5) return null;
  const ein = easeOut(kk(t, A.calcIn, A.calcIn + .35)), out = easeIn(kk(t, A.calcOut, A.calcOut + .45));
  const x = lerpv(1320, G.calc.x, ein) + out * 700, y = G.calc.y;
  const cuts = PIECE_CUT(); let flash = 0;
  for (let i = 0; i < 6; i++) { const d = t - landAt(i); if (d >= 0 && d < .3) flash = 1 - d / .3; }
  let ask = false;
  for (const a0 of A.ask) if (t >= a0 && t < a0 + .3) ask = true;   // two slow blinks (≈ 1.6 Hz)
  return { x, y, s: 1, rot: .018, a: 1, value: resteAt(t), label: 'RESTE SUR LE BILLET', ask, zero: kk(t, A.zeroCalc - .1, A.zeroCalc + .1), flash };
}
/** the stamps owned by the money module: [{id, text, sub, x, y, rot, s, k (0..1 landing), a}] */
function stamps(t) {
  const out = [];
  // « 5 PAIRES SUR 100 : NE SE VENDENT PAS » (after « pas ») + its sub-line (A.invSub, during « Tu les as payées quand même »)
  if (t >= A.stampInv - .12 && t < A.musicCut + .3) {
    const k = kk(t, A.stampInv - .12, A.stampInv);
    out.push({ id: 'invendables', text: '5 PAIRES SUR 100 :|NE SE VENDENT PAS', sub: 'payées quand même : −500 par paire vendue', subK: kk(t, A.invSub, A.invSub + .24),
      x: G.head.x, y: G.head.y + 10, rot: -.035, s: 1, k, a: 1 - kk(t, A.musicCut, A.musicCut + .3) });
  }
  // the giant « PRIX CHINOIS × 2 = 0 », falling in slow motion during N7; « = 0 » printed on « zéro » (A.zeroEq), the card
  // lands after « franc » (A.zeroStamp)
  if (t >= A.zeroFall && t < A.rule1 + .2) {
    const k = kk(t, A.zeroFall, A.zeroStamp);
    out.push({ id: 'zero', text: 'PRIX CHINOIS × 2|= 0', x: G.zero.x, y: G.zero.y, rot: -.05, s: lerpv(1.1, 1, easeIn(k)), k, eqK: kk(t, A.zeroEq - .05, A.zeroEq + .25),
      a: Math.min(kk(t, A.zeroFall, A.zeroFall + .2), 1 - kk(t, A.rule1 - .1, A.rule1 + .2)), landed: t >= A.zeroStamp ? squash(t, A.zeroStamp, .1) : null });
  }
  return out;
}
/** the pile of the rule: {x, y, label, labelK, arrowK, tag, tagK, a} or null */
function pile(t) {
  if (t < A.stack[0] - .3 || t >= A.clearOut[1] + .1) return null;
  const out = easeIn(kk(t, A.figOut[0], A.figOut[1])), outT = easeIn(kk(t, A.clearOut[0], A.clearOut[1]));
  return { x: G.pile.x - out * 900, y: G.pile.y, label: 'TOUT CE QUE TU PAIES', labelK: kk(t, A.pileLabel, A.pileLabel + .25),
    arrowK: kk(t, A.arrow, A.arrow + .45) * (1 - kk(t, A.figOut[0], A.figOut[0] + .18)),   /* QA: the arrow retracts as the pile leaves */ tag: 'TON VRAI PRIX', tagK: spr(t - A.priceTag, 12, .5),
    tagX: G.priceTag.x + outT * 700, tagY: G.priceTag.y, a: 1 };
}
/** the hook props (frame-0 composition): the paper sneaker and its kraft price tag « 1 PAIRE · REVENDUE 10 000 F À MBOPPI »
 *  (stamped « PAYÉE 5 000 F EN CHINE » on « payée »). They leave at the challenge and come back for the loop.
 *  null or {sneaker:{x,y,rot,s}, tag:{x,y,rot,s,w,h}, stamp (0..1 landing), a} */
function hook(t) {
  const out = easeIn(kk(t, A.challenge - .05, A.challenge + .3)), back = easeOut(kk(t, A.loop, T.end - .04));
  const k = t >= A.loop ? 1 - back : out;                         // 0 = in place
  if (k >= 1) return null;
  return { sneaker: { x: G.sneaker.x - k * 700, y: G.sneaker.y - k * 80, rot: -.06 - k * .5, s: 1 },
    tag: { x: G.tag.x + k * 720, y: G.tag.y - k * 60, rot: .035 + k * .4, s: 1, w: G.tag.w, h: G.tag.h },
    stamp: t < A.loop ? kk(t, A.stampBuy - .1, A.stampBuy) : 0, stampSq: t >= A.stampBuy && t < A.loop ? squash(t, A.stampBuy, .08) : null, a: 1 };
}
/** the margouillat's crumbs (two bits of the note): [{x, y, rot, s, a}] — they wait by him, then go into his mouth */
function crumbs(t) {
  if (t < A.crumbs || t >= A.gulps[1] + .3) return [];
  const out = [];
  for (let i = 0; i < 2; i++) {
    const k = kk(t, A.crumbs + i * .06, A.crumbs + .55 + i * .06), e = easeOut(k);
    const x0 = G.note.x + noteOffset(A.crumbs) + (EDGES[2] - .5) * G.note.w, y0 = G.note.y + 60;
    const r = G.crumbs[i]; let x = lerpv(x0, r.x, e), y = lerpv(y0, r.y, e) - Math.sin(e * Math.PI) * 260, s = 1, a = 1;
    const g = A.gulps[i]; if (t >= g - .12) { const q = kk(t, g - .12, g + .02); x = lerpv(r.x, G.gecko.x + 40, q); y = lerpv(r.y, G.gecko.y - 30, q); s = 1 - q; if (q >= 1) continue; }
    out.push({ x, y, rot: k * 6 + i, s, a, i });
  }
  return out;
}

// =============================================================================================
// BONZINI (violet only from here) + END
// =============================================================================================
/** the reception: null or {carton:{x,y,s,rot,lift}, scan (0..1 laser sweep), scanner:{x,y,rot,a,beam}, scale:{x,y,a,needle},
 *  tape (0..1 along the edges), pese (0..1 stamp), mesure (0..1 stamp), a} — stop-motion on twos */
function reception(t) {
  if (t < A.cartonIn - .1 || t >= A.loop) return null;
  const ts = step2(t), out = easeIn(kk(t, A.endcard - .05, A.endcard + .4));
  const cin = easeOut(kk(ts, A.cartonIn, A.cartonIn + .35));
  const onScale = easeOut(kk(ts, A.weigh - .3, A.weigh));
  const c = { x: lerpv(-300, G.carton.x, cin) - out * 1000, y: G.carton.y - 14 * onScale + 14 * kk(ts, A.weigh, A.weigh + .08), s: 1, rot: -.02, lift: onScale };
  return {
    carton: c, a: 1 - out,
    scan: kk(ts, A.scan, A.scan + .4), beam: t >= A.scan - .05 && t < A.scan + .5 ? 1 : 0,
    scanner: { x: 1010 - 120 * easeOut(kk(ts, A.scan - .4, A.scan - .1)) + 400 * easeIn(kk(ts, A.scan + .5, A.scan + .8)), y: 600, rot: 2.6, a: 1 },
    scale: { x: G.carton.x - out * 1000, y: G.carton.y + 70, a: kk(ts, A.weigh - .5, A.weigh - .3), needle: t < A.weigh ? 0 : cl(spr(t - A.weigh, 9, .3), 0, 1.3) },
    tape: easeOut(kk(ts, A.measure, A.measure + .4)) * (1 - kk(ts, A.stampMes + .2, A.stampMes + .45)),
    pese: kk(t, A.stampPese - .1, A.stampPese), mesure: kk(t, A.stampMes - .1, A.stampMes),
  };
}
/** the enamel plate « BONZINI TRADING CARGO »: null or {x, y, s, rot, a, k (landing 0..1), sweep (0..1 reflection)} */
function plate(t) {
  if (t < A.plate - .3 || t >= A.endcard + .4) return null;
  const k = kk(t, A.plate - .3, A.plate), y = lerpv(-200, G.head.y, easeIn(k)), sq = t >= A.plate ? squash(t, A.plate, .07) : { sx: 1, sy: 1 };
  return { x: G.head.x, y, s: 1, sx: sq.sx, sy: sq.sy, rot: -.02, a: 1 - kk(t, A.endcard, A.endcard + .4), k, sweep: kk(t, A.plate + .2, A.plate + 1.0) };
}
/** end card: null or {k (0..1 build), logoK, nameK, lineK, ritualK, ctaK, shareK, a (fades for the loop)} */
function endcard(t) {
  if (t < A.endcard || t >= T.end) return null;
  return { k: kk(t, A.endcard, A.endcard + .5), logoK: spr(t - A.endcard, 9, .5), nameK: kk(t, A.endcard + .15, A.endcard + .4),
    lineK: kk(t, A.endcard + .3, A.endcard + .6), ritualK: kk(t, A.ritual - .12, A.ritual), ctaK: kk(t, A.cta, A.cta + .25),
    shareK: kk(t, A.share, A.share + .3), a: 1 - kk(t, A.loop - .05, A.loop + .3) };
}
/** loop: 0..1 over the last half-second (the note re-forms, everything else clears) */
const loop = t => kk(t, A.loop, T.end);

// =============================================================================================
// TEXTS for the type layer: [t0, t1, id, text, style]   (« | » = line break)
// =============================================================================================
const TEXTS = () => [
  [0, T.end + 1, 'chip', 'JE SAVAIS PAS. · 1/5', 'chip'],
  [0, T.end + 1, 'exemple', 'EXEMPLE FICTIF', 'exemple'],
  [A.challenge, Math.max(A.stampInv - .1, A.challenge + 1.5), 'title', 'TU GAGNES COMBIEN ?', 'title'],
  [A.dare, A.dare + 1.45, 'dare', 'Tu dis combien ? ↓', 'dare'],
  [A.toiIn, Math.max(A.dare - .05, A.toiIn + 1.45), 'toi1', 'Facile !|Je gagne|5 000 F !', 'toiCard'],
  [A.toiShrink, A.toiZeroEnd, 'toiPill', 'TOI', 'toiSmall'],
  [T.T2 - .05, A.toiZeroEnd, 'toi2', 'Quoi ?|Zéro franc ?', 'toiCard'],
  [A.rule1, A.brandIn + .1, 'rule', 'COMPTE TOUT.|AVANT DE FIXER|TON PRIX.', 'rule'],
  [A.bandBz, A.endcard, 'bzBand', 'TON COLIS, PESÉ ET MESURÉ|EN CHINE', 'bzBand'],
  [A.endcard, A.loop + .3, 'end', 'Bonzini Trading Cargo|Groupage mer et air · Chine → Douala', 'endcard'],
  [A.ritual - .12, A.loop + .3, 'ritual', 'MAINTENANT, TU SAIS.', 'ritual'],
  [A.cta, A.loop + .3, 'cta', 'Écris CALCUL en commentaire', 'cta'],
  [A.share, A.loop + .3, 'share', 'Partage à l’ami qui fait encore × 2', 'share'],
];
/** the « Tu dis combien ? » pill and the rule band are revealed in parts: helper for the type layer */
const ruleParts = t => [kk(t, A.rule1, A.rule1 + .2), kk(t, A.rule2, A.rule2 + .2), kk(t, A.rule2 + .35, A.rule2 + .55)];

// =============================================================================================
// LIGHT / CAMERA
// =============================================================================================
/** {x, y, on (0..1 soft daylight), violet (0..1 — ONLY with Bonzini)} */
function light(t) {
  const violet = t < A.brandIn ? 0 : t < A.loop ? easeOut(kk(t, A.brandIn, A.brandIn + .5)) : 1 - kk(t, A.loop, T.end);
  return { x: 560, y: 260, on: .6, violet };
}
/** {s, cx, cy, sx, sy, rot}: push 1.00 → 1.04 on the hook, hits on every cut, slow push on the zero */
function camera(t) {
  let s = 1 + .04 * ease(kk(t, 0, A.cut1)) - .04 * ease(kk(t, A.cut1 + .05, A.cut1 + .7));
  s += .05 * ease(kk(t, A.musicCut, A.zeroStamp)) * (1 - ease(kk(t, A.major, A.major + .6)));
  s += .02 * ease(kk(t, A.brandIn, A.brandIn + 1.2)) * (1 - ease(kk(t, A.endcard, A.endcard + .6)));
  let sx = 0, sy = 0;
  const hit = (t0, amp, frames = 6) => { const d = (t - t0) * 30; if (d >= 0 && d < frames * 1.6) { const a = amp * Math.exp(-d * 3 / frames) * Math.cos(d * 2.4); sx += a * .6; sy += a; } };
  hit(A.cut1, 5); hit(A.cutT, 4); hit(A.cutD1, 10); hit(A.cutD2, 10); hit(A.cutF, 4); hit(A.cutI, 5);
  hit(A.stampBuy, 2); hit(A.stampInv, 4); hit(A.zeroStamp, 9, 8); hit(A.plate, 3); hit(A.stampPese, 2); hit(A.stampMes, 2); hit(A.ritual, 3);
  return { s, cx: 540, cy: 860, sx, sy, rot: 0 };
}

// =============================================================================================
// THE MARGOUILLAT — act + target; and the adapter the « PAS REÇU. » rig reads (geckoView)
// =============================================================================================
/** {target:{x,y}, act:'idle'|'hop'|'tennis'|'squint'|'pushups'|'gulp'|'smug', k, n} */
function gecko(t) {
  let target = { x: G.note.x, y: G.note.y }, act = 'idle', k = 0, n = -1;
  const sc = scissors(t);
  if (t < A.challenge) target = { x: sc.x, y: sc.y + 120 };
  else if (t < T.N3) target = { x: G.head.x, y: G.head.y };                      // looks up at « TU GAGNES COMBIEN ? »
  else if (t < A.cutI + .6) {                                                     // the cuts: a tennis match scissors ↔ slot
    act = 'tennis';
    const cuts = PIECE_CUT(); let lastCut = -1; for (const c of cuts) if (t >= c) lastCut = c;
    target = lastCut > 0 && t - lastCut < .7 ? { x: G.slot.x, y: G.slot.y } : { x: sc.x, y: sc.y + 100 };
  }
  if (t >= A.crumbs && t < A.crumbs + .45) { act = 'hop'; k = kk(t, A.crumbs, A.crumbs + .45); }      // the double TCHAC: he jumps
  if (t >= A.cutI + .6 && t < A.major) target = { x: G.calc.x, y: G.calc.y };
  if (t >= T.N7 && t < A.toiZeroEnd) { act = 'squint'; target = { x: G.zero.x, y: G.zero.y }; }         // narrows his eyes at « × 2 = 0 »
  if (t >= A.major && t < A.brandIn) target = { x: G.pile.x, y: G.pile.y };
  if (t >= A.brandIn && t < A.endcard) target = { x: G.carton.x, y: G.carton.y };
  if (t >= A.stampMes && t < A.stampMes + 1) { act = 'pushups'; k = kk(t, A.stampMes, A.stampMes + 1); }  // MESURÉ ✓: joy
  if (t >= A.endcard) target = { x: G.end.cta.x, y: G.end.cta.y };
  for (let i = 0; i < 2; i++) if (t >= A.gulps[i] - .15 && t < A.gulps[i] + .35) { act = 'gulp'; n = i; k = kk(t, A.gulps[i] - .15, A.gulps[i] + .35); }
  if (t >= A.gulps[1] + .35 && t < A.loop) act = 'smug';
  if (t >= A.loop) { act = 'idle'; target = { x: sc.x, y: sc.y + 120 }; }   // QA: the loop — he watches the scissors come back (= frame 0)
  return { target, act, k, n };
}
/** the view of the score that the « PAS REÇU. » margouillat (40_gecko.js) reads at load: its own key names, mapped here */
function geckoView() {
  return {
    G: { gecko: G.gecko, cx: G.cx, amberY: G.slot.y, steelHigh: G.note.y },
    T: {
      gulps: [A.gulps[0], A.gulps[1], 1e4], endcard: A.endcard, hic: A.gulps[1] + .6,
      slam: A.crumbs, falls: [A.cut1, A.cutT, A.cutF], rebounds: [A.cutD2, A.cutI, A.zeroStamp + .3],
      proof: T.N7, crush: A.cutD2 - .4, stamp: A.zeroStamp, letters: [A.stampInv, A.plate, A.stampPese], check: A.stampMes,
    },
    LETTER_REST: G.crumbs, DUR: T.end, gecko,
  };
}

// =============================================================================================
// SOUND + MUSIC (names = the storyboard's sound column; the audio engine maps them)
// =============================================================================================
function soundCues() {
  const Q = []; const q = (t, name, g = 1, pan = 0) => Q.push({ t: +Math.max(0, t).toFixed(4), name, g, pan });
  A.snips.forEach(s => q(s, 'snip', .9, .15));                                   // two dry snips, close to the mic
  q(A.cut1, 'tchac', 1); q(A.slide1[0], 'paper_slide', .7, -.3); q(A.ding1, 'ding', .55, .3); q(A.stampBuy, 'stamp', .55, .25);
  A.tics.forEach((s, i) => q(s, 'tic', i === 2 ? .8 : .6, .2));
  q(A.envT, 'paper_slide', .45, -.4); q(A.cutT, 'tchac', 1); q(A.cutT + .05, 'paper_slide', .5); q(A.cutT + .12, 'horn', .5, .2);   // §6.4: .12 (at + .22 its 0.34 s ran into « La douane »)
  q(A.envD, 'paper_slide', .45, -.4); q(A.sticker, 'sticker', .5, -.2); q(A.cutD1, 'tchac_big', 1); q(A.cutD2, 'tchac_big', 1); q(A.cutD2 + .05, 'paper_slide', .5);
  q(A.envF, 'paper_slide', .45, -.4); A.doodles.forEach(d => q(d, 'marker', .25, -.3)); q(A.cutF, 'tchac', 1); q(A.cutF + .1, 'coin_roll', .6, .3);
  q(A.boxIn + .2, 'box_drop', .5, -.3); q(A.lid, 'lid', .8, -.2); q(A.feet, 'boing', .6, -.2); q(A.stampInv, 'stamp', .8); q(A.cutI, 'tchac', 1);
  q(A.zeroCalc, 'calc_zero', .5, .3); q(A.coinSpin, 'coin_spin', .6, .2); q(A.zeroStamp, 'stamp_big', 1); q(A.coinSettle, 'ting', .6, .2);
  A.stack.forEach((s, i) => q(s, 'stack', .35, -.3 + .15 * i)); q(A.arrow, 'marker', .35, .1); q(A.priceTag, 'pop', .35, .3);   // §6.4: under the rule (N8), ≤ .35
  q(A.brandIn, 'whoosh', .4); q(A.sig, 'bonzini_sig', 1); q(A.plate, 'plate', .8); q(A.scan, 'scan_beep', .7, .3); q(A.weigh, 'tonk', .8);
  q(A.stampPese, 'stamp', .7, -.3); q(A.stampMes, 'stamp', .7, .3);
  q(A.cta, 'pop', .7); A.gulps.forEach(g => q(g, 'gloup', .8, -.5)); q(A.ritual, 'stamp', .8); q(A.finalChord, 'final_chord', 1); q(A.loop, 'reform', .5);
  return Q.sort((a, b) => a.t - b.t);
}
/** the music plan (makossa, 120 BPM): silence → tense on the last tic-tac → skips a beat on the douane → cut dead on the
 *  key moment → major on the rule → balafon signature on « Bonzini » → dry cut at the end */
function music() {
  return { silentUntil: A.tics[2], tenseFrom: A.tics[2], skip: [A.cutD2], cut: A.musicCut, majorFrom: A.major, sigAt: A.sig, end: T.end, bpm: 120 };
}

const SCORE = { FPS, N, DUR, T, A, G, W, WE, word, ITEMS, EDGES, PIECE_VALUE, PIECE_DEST,
  note, scissors, hook, item, items, calc, resteAt, stamps, pile, crumbs, reception, plate, endcard, loop, TEXTS, ruleParts,
  light, camera, gecko, geckoView, soundCues, music, kk, ease, easeOut, easeIn, spr, squash, step2 };
if (typeof window !== 'undefined') window.SCORE = SCORE;
if (typeof module !== 'undefined') module.exports = SCORE;
})();

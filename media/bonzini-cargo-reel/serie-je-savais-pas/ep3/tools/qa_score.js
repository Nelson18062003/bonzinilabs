// ep3 « C'EST PAS ÇA. » v2 — QA of the score (SCRIPT_V2.md §6, §7.2, §7.3, §7.5): NaN, action order, key-text holds (≥ 1.4 s),
// simultaneous text blocks (≤ 3 before the end card), the re-timing constraints of the spec (tags after N1b, the music cut
// before N2, « ÉCRIS TOUT » after N3, the note read alone before N4, the silent key moment ≥ 2.65 s, the balafon signature
// before N5, the ritual stamp between N6 and N6b, `end`), the minimum silences of data/gaps.json, and « no loud cue starts
// inside a word » (word windows of the timing; a line's last word counted up to END(id), the ASR stamps it early).
//
// Source: --timing x.json (a candidate timing) › data/timing.json › the score's DEFAULTS. On the defaults it checks twice:
// as they are (SYL fallbacks, no words) and with synthetic words (the v2 lines of data/script*.json spread by syllable over
// DUR, a short pause at each comma of the tts text).
// Jitter runs (N): every take ±15 % long (its words scaled), placed like serie/retime.py — by default its --pauses rule
// (start = end of the previous take + max(gap, the default pause, data/gaps.json)), with --spacing its default rule (the
// default spacing + the cumulative shift, ≥ max(gap, gaps.json)); --harsh = every start ±.4 s (stress test, failures expected).
// The runs are tallied by issue.
// usage (from E): node tools/qa_score.js [runs=0] [--timing x.json] [--spacing | --harsh] [--gap 0.12] [--tail 0.9]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const E = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(E, 'overlay/scenes/01_score.js'), 'utf8');
const ARGS = process.argv.slice(2), opt = (k, d) => { const i = ARGS.indexOf(k); return i >= 0 ? ARGS[i + 1] : d; };
const GAP = +opt('--gap', .12), TAIL = +opt('--tail', .9), HARSH = ARGS.includes('--harsh'), SPACING = ARGS.includes('--spacing');
const runs = +(ARGS.find((a, i) => /^\d+$/.test(a) && !(i > 0 && /^--(timing|gap|tail)$/.test(ARGS[i - 1]))) || 0);
function load(tm) { const win = tm ? { TIMING: tm } : {}; const ctx = { window: win, console }; vm.createContext(ctx); vm.runInContext(SRC, ctx); return win.SCORE; }
const D0 = load(null);                                                  // the defaults (no timing at all)
const IDS = Object.keys(D0.T).filter(k => k !== 'end').sort((a, b) => D0.T[a] - D0.T[b]);
const GAPS = (() => { try { return JSON.parse(fs.readFileSync(path.join(E, 'data/gaps.json'), 'utf8')); } catch (e) { return {}; } })();
// SCRIPT_V2.md §7.3: these never start inside a word (a lowered cue, g ≤ .5, only warns: the cut plan's tonk on « c'est »)
const LOUD = ['boum', 'marbles', 'metal_set', 'card_flop', 'tag_stamp', 'stamp', 'tonk', 'stamp_big', 'carton_thud', 'bonzini_sig', 'gloup', 'clink'];

// ---------- synthetic words for the defaults ----------
const SYLL = { mes: 1, sacs: 1, sont: 1, arrives: 3, mais: 1, cest: 1, pas: 1, ca: 1, ton: 1, fournisseur: 3, a: 1, fait: 1, ce: 1, que: 1,
  tu: 1, as: 1, ecrit: 2, jai: 1, bonne: 1, qualite: 3, comme: 1, la: 1, photo: 2, ne: 1, dit: 1, tout: 1, le: 1, choisit: 2, necris: 2,
  prochaine: 2, fois: 1, fais: 1, une: 1, fiche: 1, ecris: 2, matiere: 2, taille: 1, les: 1, poignees: 2, et: 1, lemballage: 3,
  lechantillon: 4, un: 1, seul: 1, sac: 1, demandele: 3, dabord: 2, gardele: 2, pour: 1, comparer: 3, voila: 2, commande: 2, toi: 1,
  transport: 2, bonzini: 3, trading: 2, cargo: 2, mot: 1, en: 1, commentaire: 3, maintenant: 3, sais: 1 };
const key = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const syll = w => SYLL[key(w)] ?? Math.max(1, (key(w).replace(/e?s?$/, '').match(/[aeiouy]+/g) || []).length);
function lines() {
  for (const f of ['script.json', 'script_v2.json']) {
    try { const j = JSON.parse(fs.readFileSync(path.join(E, 'data', f), 'utf8')); const m = {}; for (const s of j.segments) m[s.id] = s.tts || s.text;
      if (IDS.every(id => m[id])) return { m, f }; } catch (e) { }
  }
  throw new Error('no data/script*.json with the score ids ' + IDS.join(' '));
}
function synthWords(dur) {
  const { m } = lines(), W = {};
  for (const id of IDS) {
    const ws = m[id].split(/\s+/).filter(w => /[A-Za-zÀ-ÿ]/.test(w)), PAUSE = .6;          // a comma = .6 syllable of silence
    const units = ws.reduce((a, w) => a + syll(w) + (/[,:]$/.test(w) ? PAUSE : 0), 0), u = dur[id] / units; let x = 0;
    W[id] = ws.map(w => { const s = x; x += syll(w) * u; const r = { w: w.replace(/[,.!?:]+$/, ''), s: +s.toFixed(3), e: +x.toFixed(3) }; if (/[,:]$/.test(w)) x += PAUSE * u; return r; });
  }
  return W;
}

// ---------- the checks ----------
function check(S, words) {
  const A = S.A, T = S.T, D = S.DUR, END = id => T[id] + D[id], bad = [], warn = [], f2 = x => (+x).toFixed(2);
  const flat = Object.entries(A).flatMap(([k, v]) => Array.isArray(v) ? v.map((x, i) => [`${k}[${i}]`, x]) : [[k, v]]);
  for (const [k, v] of flat) if (!Number.isFinite(v)) bad.push(`A.${k} not finite`);
  const v = k => { const m = /^(\w+)\[(\d)\]$/.exec(k); return m ? A[m[1]][+m[2]] : A[k]; };
  // 1 — order of the actions (same moments, same order as v1; v2: the photo band, caption line 3)
  const order = [['bagLand', 'shadow0'], ['shadow0', 'slam'], ['slam', 'memeOut'], ['memeOut', 'qui'], ['qui', 'steel'], ['steel', 'clear'], ['clear', 'order'],
    ['order', 'bandPhoto'], ['bandPhoto', 'photoShiver'], ['photoShiver', 'tags[0]'], ['tags[2]', 'cut'], ['cut', 'band'], ['soggy0', 'soggy1'], ['soggy1', 'next'],
    ['next', 'sheet'], ['sheet', 'lines[0]'], ['lines[0]', 'lines[1]'], ['lines[1]', 'lines[2]'], ['lines[2]', 'lines[3]'], ['lines[3]', 'stampAll'], ['stampAll', 'note'],
    ['note', 'ficheAside'], ['capN4', 'ficheAside'], ['ficheAside', 'parcel'], ['parcel', 'unbox'], ['unbox', 'polaIn'], ['unbox', 'keep'], ['capL3', 'garde'], ['polaIn', 'pareil'],
    ['garde', 'pareil'], ['pareil', 'polaOut'], ['keep', 'taps[0]'], ['key', 'amberBack'], ['amberBack', 'taps[0]'], ['taps[2]', 'letters[0]'], ['letters[2]', 'recentre'],
    ['recentre', 'check'], ['check', 'violet'], ['violet', 'role1', .2], ['role1', 'gulps[0]'], ['gulps[0]', 'role2'], ['role2', 'labelNote'], ['role2', 'bzName'],
    ['gulps[2]', 'endcard'], ['endcard', 'cta'], ['cta', 'stampEnd'], ['stampEnd', 'loop'], ['loop', 'out']];
  for (const [a, b, tol = 1e-6] of order) if (!(v(a) <= v(b) + tol)) bad.push(`order ${a} ${f2(v(a))} > ${b} ${f2(v(b))}`);
  if (A.out > T.end) bad.push('out after the end');
  // 2 — the re-timing constraints of SCRIPT_V2.md (§6, §7.1, §7.2)
  const C = [   // [label, a, b]: a ≤ b
    ['BOUM after « arrivés » (slam ≥ END(T1))', END('T1') - .01, A.slam], ['BOUM before « Mais » (slam < T2)', A.slam, T.T2 - .01],
    ['steel lands after T2 (metal_set)', END('T2') - .01, A.steel], ['order card after N1 (card_flop)', END('N1') - .01, A.order],
    ['tags after « tout » (tags[0] ≥ END(N1b))', END('N1b') - .01, A.tags[0]], ['3rd tag + music cut before N2', A.cut, T.N2 - .02],
    ['« ÉCRIS TOUT » after N3 (stampAll ≥ END(N3))', END('N3') - .01, A.stampAll], ['« ÉCRIS TOUT » before N4', A.stampAll, T.N4 - .05],
    ['key moment after N4c (key ≥ END(N4c) − .1)', END('N4c') - .1, A.key], ['« C\'EST ÇA ✓ » before T4', A.check, T.T4],
    ['balafon signature after T4 (sig ≥ END(T4))', END('T4') - .01, A.sig], ['balafon signature before « La commande »', A.sig, T.N5 - .05],
    ['3rd gloup after « Cargo » (≥ END(N5b))', END('N5b') - .01, A.gulps[2]], ['ritual stamp after N6', END('N6') - .01, A.stampEnd], ['ritual stamp before N6b', A.stampEnd, T.N6b + .01],
    ['end ≥ END(N6b) + .9', Math.max(END('N6b') + .9, A.stampEnd + 1.8) - .005, T.end]];
  for (const [n, a, b] of C) if (!(a <= b)) bad.push(`§7 ${n}: ${f2(a)} > ${f2(b)}`);
  // never a gloup on « Bonzini » (its word window, or its syllable model without words)
  const bz0 = S.W('N5b', 'bonz|bond|bons', 0, S.SYL('N5b', 4, 11)), bz1 = S.WE('N5b', 'bonz|bond|bons', 0, S.SYL('N5b', 7, 11));
  A.gulps.forEach((g, i) => { if (g > bz0 - .05 && g < bz1) bad.push(`gloup ${i + 1} ${f2(g)} on « Bonzini » ${f2(bz0)}–${f2(bz1)}`); });
  const keyPause = T.T4 - END('N4c'), noteAlone = T.N4 - A.note;
  if (keyPause < 2.65 - .005) warn.push(`silent key moment END(N4c) → T4 ${f2(keyPause)} s < 2.65 (the big carton arrives ${f2(A.key - END('N4c'))} s after « comparer »)`);
  if (noteAlone < .6 - .005) warn.push(`the violet note is read alone ${f2(noteAlone)} s before N4 (< .6)`);
  if (A.next > T.N3a - .05) warn.push(`band « FAIS UNE FICHE. » ${f2(A.next)} not before N3a ${f2(T.N3a)}`);
  if (A.unbox > T.N4b) warn.push(`the sample comes out ${f2(A.unbox)} after N4b starts (${f2(T.N4b)})`);
  if (T.end > 45.005) warn.push(`film ${f2(T.end)} s > 45 s (DICTION.md; SCRIPT_V2.md §6 cut plan)`);
  // 3 — minimum silences before a line (data/gaps.json)
  for (let i = 1; i < IDS.length; i++) { const a = IDS[i - 1], b = IDS[i], g = T[b] - END(a); if (GAPS[b] != null && g < GAPS[b] - .005) warn.push(`silence ${a} → ${b} ${f2(g)} s < ${GAPS[b]} (gaps.json)`); if (g < -.005) bad.push(`voices overlap ${a} / ${b}`); }
  // 4 — key texts: [label, readable from, readable until] (≥ 1.4 s)
  const holds = [['sub', 0, A.slam], ['meme', 0, A.memeOut], ['C\'EST PAS ÇA', A.slam, A.clear], ['QUI A TORT', A.qui + .15, A.clear], ['steel IL A FAIT…', A.steel, A.clear],
    ['order card', A.order, A.next], ['LA PHOTO NE DIT PAS TOUT', A.bandPhoto + .14, A.band], ['tags ?', A.tags[2], A.lines[0]], ['lesson', A.band + .14, A.next - .14],
    ['FAIS UNE FICHE', A.next + .14, A.stampAll], ['ÉCRIS TOUT', A.stampAll, A.ficheAside], ['note (full size)', A.note, A.ficheAside], ['EMBALLAGE', A.lines[3], A.ficheAside],
    ['L\'ÉCHANTILLON, C\'EST UN SEUL SAC', A.capN4 + .14, A.capN4Out], ['DEMANDE-LE D\'ABORD', A.capL3 + .2, A.capN4Out], ['GARDE-LE POUR COMPARER', A.garde + .2, A.capN4Out],
    ['parcel label', A.parcel, A.parcelOut], ['PAREIL ✓', A.pareil, A.polaOut + .15], ['À GARDER', A.keep + .4, A.check + .35], ['C\'EST ÇA ✓', A.check, A.endcard],
    ['role1 LA COMMANDE', A.role1 + .25, A.endcard], ['role2 LE TRANSPORT', A.role2 + .25, A.endcard], ['BZ code', A.label, A.endcard], ['bzNote', A.labelNote + .3, A.endcard],
    ['brand', A.endcard + .35, A.loop], ['CTA', A.cta + .25, A.loop], ['tag line', A.tagLine + .4, A.loop], ['MAINTENANT', A.stampEnd, A.loop]];
  // every TEXTS row (fade-ins / fade-outs trimmed); 'sub' is crushed by the plate (no fade): its hold is ['sub', 0, slam] above
  for (const [id, a, b] of S.TEXTS().map(r => [r[2], r[0], r[1]])) if (id !== 'sub') holds.push([`text ${id}`, a <= 0 ? 0 : a + .14, b - .14]);
  for (const [id, a, b] of holds) if (b - a < 1.4 - 1e-6) bad.push(`hold ${id} ${f2(b - a)} s`);
  // 5 — simultaneous text blocks before the end card. One block each: a TEXTS row (object labels, the legal code, and rows
  // that live on another block excluded), a plate, the « ? » tags, the full-size sheet (with its stamp and note).
  const SKIP = new Set(['photo', 'label', 'parcelLbl', 'keep', 'bzCode', 'stampAll', 'note', 'role2', 'pareil']);
  let maxB = 0, at = 0;
  for (let t = 0; t < A.endcard; t += 1 / 30) {
    const tx = S.TEXTS().filter(r => t >= r[0] + .14 && t < r[1] - .14 && !SKIP.has(r[2])).length;
    const exitAt = { amber: A.clear, steel: A.clear, order: A.next }, F = S.fiche(t);   // a plate that has started its exit is handing off
    const n = tx + S.plates(t).filter(p => p.s > .5 && (p.a ?? 1) > .5 && p.y > 150 && p.y < 1700 && !(t >= exitAt[p.kind] + .14 && t < A.amberBack)).length + (S.tags(t).length ? 1 : 0) + (F && F.thumb < .5 ? 1 : 0);
    if (n > maxB) { maxB = n; at = t; }
  }
  if (maxB > 3) bad.push(`${maxB} text blocks at ${f2(at)}`);
  // 6 — no loud cue starts inside a word (10 ms tolerance at the edges); a line's last word ends at END(id) at the earliest
  if (words) for (const c of S.soundCues()) {
    if (!LOUD.includes(c.name)) continue;
    for (const id of IDS) for (const [i, w] of (words[id] || []).entries()) {
      const s = T[id] + w.s, e = T[id] + (i === words[id].length - 1 ? Math.max(w.e, D[id]) : w.e);
      if (c.t > s + .01 && c.t < e - .01) (c.g > .5 ? bad : warn).push(`loud cue ${c.name}${c.g > .5 ? '' : ' (g ' + c.g + ')'} @${f2(c.t)} inside « ${w.w} » (${id} ${f2(s)}–${f2(e)})`);
    }
  }
  return { bad, warn };
}

// ---------- 0 — the timing's words belong to the v2 lines (real timing only) ----------
// data/vocheck.json was written for the v1 takes and its keys (N1_s1.wav, N3_s1.wav, N4_s1.wav, N5_s1.wav, N6_s1.wav, …)
// are the v2 takes' file names too: retime.py attaches whatever words it finds under the file name, so a re-timing run
// BEFORE vocheck.py has been re-run on the v2 takes silently puts v1 word times under the v2 lines (W('N3','mati'),
// WE('N4','echant'), WEL('N5','toi')… then point at the wrong syllables). Two tests per line: the words' text against the
// v2 text (tokens compared on their first 4 letters: the ASR drops plurals / final letters), and the last word's end
// against the take's speech duration (the ASR stamps it at ≈ .7–1.0 × DUR).
function wordsMatch(S, words) {
  const bad = [], { m } = lines(), f2 = x => (+x).toFixed(2);
  const tok = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’-]/g, ' ').replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean).map(w => w.slice(0, 4));
  const bag = a => a.reduce((o, w) => (o[w] = (o[w] || 0) + 1, o), {});
  for (const id of IDS) {
    const ws = (words || {})[id]; if (!ws || !ws.length) continue;
    const a = bag(tok(ws.map(w => w.w).join(' '))), b = bag(tok(m[id]));
    const na = Object.values(a).reduce((x, y) => x + y, 0), nb = Object.values(b).reduce((x, y) => x + y, 0);
    const common = Object.keys(a).reduce((x, k) => x + Math.min(a[k], b[k] || 0), 0), r = common / Math.max(na, nb, 1);
    const eLast = ws[ws.length - 1].e, d = S.DUR[id];
    if (r < .5) bad.push(`words of ${id} do not match its v2 text (${Math.round(r * 100)} %: « ${ws.map(w => w.w).join(' ')} »): stale data/vocheck.json? re-run lib/vocheck.py on the v2 takes, then retime.py`);
    else if (eLast < .6 * d || eLast > d + .35) bad.push(`words of ${id} do not fit its take (last word ends ${f2(eLast)} s, speech ${f2(d)} s): stale data/vocheck.json? re-run lib/vocheck.py, then retime.py`);
  }
  return bad;
}

// ---------- run ----------
const TJ = opt('--timing') ? path.resolve(opt('--timing')) : path.join(E, 'data/timing.json');
let BASE = null, src;
if (fs.existsSync(TJ)) { BASE = JSON.parse(fs.readFileSync(TJ, 'utf8')); src = path.relative(E, TJ) || TJ; }
else if (opt('--timing')) throw new Error('no such timing: ' + TJ);
const out = [];   // [tag, {bad, warn}]
if (BASE) { const S0 = load(BASE), r = check(S0, BASE.words); r.bad.unshift(...wordsMatch(S0, BASE.words)); out.push(['real', r]); }
else {
  out.push(['defaults', check(D0, null)]);                                          // SYL fallbacks, no words
  const T0 = {}; for (const k in D0.T) T0[k] = D0.T[k];
  BASE = { ...T0, dur: { ...D0.DUR }, words: synthWords(D0.DUR) }; src = `score DEFAULTS + synthetic words (${lines().f})`;
  out.push(['default+words', check(load(BASE), BASE.words)]);
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const tally = {};
const P0 = {}; IDS.forEach((id, i) => { if (i) P0[id] = D0.T[id] - (D0.T[IDS[i - 1]] + D0.DUR[IDS[i - 1]]); });   // the storyboard's pauses
for (let r = 0; r < runs; r++) {
  const tm = JSON.parse(JSON.stringify(BASE)), ids = IDS.filter(id => tm[id] !== undefined);
  for (const id of ids) { const k = .85 + rnd() * .3; tm.dur[id] = +(tm.dur[id] * k).toFixed(3); if (tm.words && tm.words[id]) tm.words[id] = tm.words[id].map(w => ({ w: w.w, s: +(w.s * k).toFixed(3), e: +(w.e * k).toFixed(3) })); }
  let prevEnd = -1e9, shift = 0;
  ids.forEach((id, i) => {
    let st;
    if (HARSH) st = i ? Math.max(tm[id] + (rnd() - .5) * .8, prevEnd + .1) : tm[id];
    else if (SPACING) { const want = BASE[id] + shift + (rnd() - .5) * .2; st = Math.max(want, prevEnd + Math.max(GAP, GAPS[id] || 0), .05); shift = st - BASE[id]; }
    else st = i ? prevEnd + Math.max(GAP, P0[id], GAPS[id] || 0) : tm[id];      // retime.py --pauses
    tm[id] = +st.toFixed(3); prevEnd = st + tm.dur[id];
  });
  const last = ids[ids.length - 1];
  tm.end = +(prevEnd + Math.max(TAIL, D0.T.end - (D0.T[last] + D0.DUR[last]))).toFixed(2);
  const res = check(load(tm), tm.words);
  for (const [kind, list] of [['ERR', res.bad], ['warn', res.warn]]) for (const x of new Set(list.map(s => s.replace(/-?\d+\.\d+/g, '#')))) tally[kind + ' ' + x] = (tally[kind + ' ' + x] || 0) + 1;
}
const S = load(src.startsWith('score DEFAULTS') ? null : BASE);
console.log(`source: ${src} · ${IDS.length} ids ${IDS.join(' ')} · N ${S.N} · end ${S.T.end} s · ${S.soundCues().length} cues · gaps.json ${Object.keys(GAPS).length ? 'yes' : 'NO'}`);
let nb = 0;
for (const [tag, r] of out) {
  if (r.warn.length) console.log(`WARN [${tag}]\n  ` + r.warn.join('\n  '));
  if (r.bad.length) { nb += r.bad.length; console.log(`ERRORS [${tag}]\n  ` + r.bad.join('\n  ')); }
}
console.log(nb ? `${nb} error(s)` : 'OK — no issue');
if (runs) {
  console.log(`${runs} simulated re-timings (${HARSH ? 'harsh: starts ±.4 s' : SPACING ? 'retime.py default spacing + gaps.json' : 'retime.py --pauses + gaps.json'}, takes ±15 %, tail ≥ ${TAIL} s):`);
  const ks = Object.entries(tally).sort((a, b) => b[1] - a[1]); console.log(ks.length ? ks.map(([k, n]) => `  ${n}/${runs}  ${k}`).join('\n') : '  no issue');
}

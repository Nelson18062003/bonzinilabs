"""« JE SAVAIS PAS. » · 1/5 — « TCHAC ! » — the film's sound: 48 kHz stereo, exactly SCORE.T.end seconds, synthesised
(no samples) + the 12 voice takes.

ONE score drives picture and sound (contract: serie/PIPELINE.md). Everything is read LIVE through node from
overlay/scenes/01_score.js (which itself reads data/timing.json): SCORE.T (speech starts, end), SCORE.DUR (speech
durations), SCORE.A (action times), SCORE.soundCues() -> [{t, name, g, pan}], SCORE.music() -> {silentUntil, tenseFrom,
skip[], cut, majorFrom, sigAt, end, bpm}. When soundCues()/music() are missing or incomplete, the same anchors are derived
here from T / A / the words with the storyboard's rules (the score's functions always win when they exist). The score
actually used is snapshotted to audio/score_used.json (fallback if node is unavailable). Voices: data/voice_plan.json
(take, `at` = where the FILE starts in the film, stretch) + data/takes.json (speech on/off), trimmed to speech ±30 ms.
Move a cue in the score or a take in the plan, rerun, the sound follows.

Built on « PAS REÇU. » (SP/v3/lib/audio_recu.py, imported: event list, voice chain, sidechain duck + presence carve,
reverbs, master, onset/loudness checks, gloup, enamel-plate tonk, final chord) and the series' synth code (audio.py,
makossa.py, bikutsi.py, instruments.py -> money_sfx.py).

Music (makossa, 120 BPM, beat .5 s):
  0 .. tenseFrom       NO music: the dry snips, the first TCHAC, paper, the register ding, the 3 tic-tacs (room tone only)
  tenseFrom .. cut     TENSE F#-minor makossa in STOP-TIME: in on the last tic; the band leaves .22 s before every TCHAC and
                       re-enters ON it (each TCHAC = a downbeat + a chord change); on the douane double TCHAC it SKIPS A
                       BEAT (the 2nd TCHAC lands in a hole, the band returns one beat later on the same grid); the density
                       climbs at every cut (+skank +shaker, +16th picking +conga +4-on-floor, +claps +balafon tremolo), a
                       riser from the 4th cut grows into ...
  cut                  ... the TOTAL CUT (4 ms gate, reverb returns included): digital silence on the music bus; the coin
                       spins alone, the giant stamp falls in slow motion, the coin lies flat (« ting »), TOI's « …zéro ?! »
  majorFrom            A MAJOR: arrival hit on majorFrom, the full makossa on the pile's beat grid (the 5 stacks = beats)
  brandIn              break: whoosh + violet pad + shimmer; sigAt: the Bonzini signature, E6 -> G#6 (2nd note +.1 s)
  sig2 .. ritual       brand groove on a grid anchored on the signature's 2nd note (E | D, pad + bright balafon), then the
                       end card in A, full (gulps on beats)
  ritual               the band hits with the « MAINTENANT, TU SAIS. » stamp (on E) and rests; the pad holds E7sus4 -> E
  final_chord          the A-major final chord (V -> I), choked at T.end; the note re-forms with a reversed paper rush that
                       is cut dead on the last sample (the loop's first sample is the scissors' snip)
Mix: voices (R.voice_line chain: HP/EQ, leveller + word compressor, de-esser, -18 LUFS per line, small-room reverb);
music ducks 8 dB under any voice (+4 dB carve of 0.9-5 kHz, look-ahead, held through each line), soft SFX duck 4 dB,
impacts and the signature never duck. Master: HP 28 Hz, soft clip on the music and impact buses, true-peak limiter;
-14 LUFS integrated (pyloudnorm), TP <= -1 dBTP. Every SFX cue is levelled by its max momentary loudness: LVL[name] +
20·log10(g) (g = the score's gain).

usage:  cd E && nice -n 5 python3 lib/audio_ep1.py            -> audio/mix.wav, audio/stems/*.wav, audio/audio_report.json
        cd E && nice -n 5 python3 lib/audio_ep1.py --sheet    -> + out/chk_audio_sheet.jpg (spectrograms, levels, tables)
        cd E && nice -n 5 python3 lib/audio_ep1.py --gallery  -> audio/sfx_gallery.wav (every SFX once, 0.5 s apart)
API:    build(sheet=False) -> report dict · score() · sfx_<name>() -> np.ndarray (onset at sample 0)
"""
import os, sys, json, math, re, subprocess, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
X = os.path.abspath(os.environ.get('EP_DIR') or os.path.join(HERE, '..'))     # the episode folder E (EP_DIR: test on a copy)
SP = os.path.abspath(os.path.join(HERE, '..', '..', '..'))                     # the scratch root
V3LIB = os.path.join(SP, 'v3', 'lib')
if not os.path.isdir(V3LIB): V3LIB = os.path.join(SP, 'pas-recu', 'lib')   # repo layout: the « PAS REÇU. » sound library
if V3LIB in sys.path: sys.path.remove(V3LIB)
sys.path.insert(0, V3LIB)
import audio_recu as R                                                         # « PAS REÇU. » (imports audio, dsp, makossa…)
import numpy as np
from audio import ns, tt, nz, ex, m2f, bp, panst, place, tail_fade, grains
AU, dsp, SR, mk, bk, I = R.A, R.dsp, R.SR, R.mk, R.bk, R.I

SCORE_JS = os.path.join(X, 'overlay', 'scenes', '01_score.js')
TIMING_JSON = os.path.join(X, 'data', 'timing.json')
PLAN_JSON = os.path.join(X, 'data', 'voice_plan.json')
TAKES_JSON = os.path.join(X, 'data', 'takes.json')
VOCHECK_JSON = os.path.join(X, 'data', 'vocheck.json')
VO_DIR = os.path.join(X, 'audio', 'vo')
OUT_A = os.path.join(X, 'audio')
SNAP = os.path.join(OUT_A, 'score_used.json')
REPORT = os.path.join(OUT_A, 'audio_report.json')
SNAPPED = os.path.join(OUT_A, 'words_snapped.json')
SHEET = os.path.join(X, 'out', 'chk_audio_sheet.jpg')

VOX_TRIM = {'T2': -1.0}                         # « …zéro ?! » small, stunned voice (still far above the cut silence)
R.VO_DIR, R.CACHE, R.VOX_TRIM = VO_DIR, os.path.join(OUT_A, '.cache'), VOX_TRIM   # R.voice_line reads these globals

BEAT, S16, BAR = 0.5, 0.125, 2.0
BRK = 0.22                                      # stop-time: the band leaves .22 s before each TCHAC, re-enters ON it
SIG_GAP = 0.10                                  # the signature's 2nd note, .1 s after the 1st (the series' signature)
DUCK_DB, SFX_DUCK_DB = 8.0, 4.0
G_TENSE, G_MAJOR, G_BRAND = 10 ** (-9.5 / 20), 10 ** (-11 / 20), 10 ** (-12 / 20)
G_SIG = 10 ** (-1.0 / 20)
MUSIC = ('groove', 'brand', 'final', 'sig')
DUCKED = {'groove': DUCK_DB, 'brand': DUCK_DB, 'sfx': SFX_DUCK_DB}
SENDS = {'groove': ('room', .08), 'brand': ('plate', .22), 'final': ('room', .10), 'sig': ('plate', .18), 'sfx': ('room', .07),
         'hit': ('room', .09), 'vox': ('vroom', .15)}
ROOM_LUFS = -56.0                               # the paper table's room tone (pre-master), exactly periodic
# SFX levels: max momentary loudness (LUFS, pre-master, voices at -18 LUFS per line) of a cue at g = 1
LVL = {'snip': -19, 'tchac': -13, 'tchac_big': -12, 'paper_slide': -22, 'stamp': -17, 'ding': -18, 'tic': -19,
       'horn': -19, 'sticker': -20, 'marker': -21, 'coin_roll': -21, 'box_drop': -18, 'lid': -21, 'boing': -18,
       'calc_zero': -19, 'coin_spin': -24, 'stamp_big': -15, 'ting': -19, 'stack': -20, 'pop': -20, 'whoosh': -19,
       'bonzini_sig': -22.5, 'plate': -21, 'scan_beep': -19, 'tonk': -20, 'gloup': -18, 'reform': -18}
HIT = ('tchac', 'tchac_big', 'stamp_big')       # impact bus: never ducked, soft-clipped
SWELL = ('reform',)                             # cues whose onset is a soft take-off (checked on placement too)
PM = mk.PROG_MINOR                               # F#m D E C#m
CH = {'A': ('A', [64, 69, 73, 76], 45), 'D': ('D', [66, 69, 74, 78], 50), 'E': ('E', [64, 68, 71, 76], 52)}
BRAND_PROG = [CH['E'], CH['D'], CH['A'], CH['E']]  # brand (E | D) -> end card (A | E) -> final A (V -> I)

def log(*a): print(*a, flush=True)
fm = R.fm

# =====================================================================================================================
# the score (live) + fallbacks derived from T / A / words
# =====================================================================================================================
def _nrm(s):
    s = unicodedata.normalize('NFD', str(s).lower())
    return re.sub(r'[^a-z0-9]', '', ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn'))
def _unel(s): return re.sub(r"^(?:[a-z]{1,2}|qu|jusqu)['’]", '', str(s), flags=re.I)

def word_at(T, words, lid, prefix, nth=0, end=False):
    """absolute start (or end) of the nth word of line `lid` starting with `prefix` (list ok), like SCORE.W / WE"""
    ps = [_nrm(p) for p in (prefix if isinstance(prefix, (list, tuple)) else [prefix])]; c = 0
    for w in (words or {}).get(lid, []):
        f = [_nrm(w['w']), _nrm(_unel(w['w']))]
        if any(x and any(x.startswith(p) for p in ps) for x in f):
            if c == nth: return T[lid] + (w['e'] if end else w['s'])
            c += 1
    return None

DUR0 = {'N1': .85, 'N2': 1.6, 'T1': 2.0, 'N3': 1.8, 'N4': 2.4, 'N5': 2.4, 'N6': 3.4, 'N7': 2.5, 'T2': .6, 'N8': 4.0, 'N9': 4.4, 'N10': 3.1}

def derive_A(T, DUR, words):
    """python mirror of the score's A (only what the sound needs) — used when the score exposes no A"""
    def W(i, p, nth=0, fb=0.0, end=False):
        v = word_at(T, words, i, p, nth, end)
        return v if v is not None else T[i] + fb * (DUR.get(i, DUR0[i]) / DUR0[i])
    E = lambda i: T[i] + DUR.get(i, DUR0[i])
    A = {}
    A['snips'] = [0, T['N1'] + DUR.get('N1', .85) * .5]
    A['cut1'] = min(E('N1') + .03, T['N2'] - .12); A['slide1'] = [A['cut1'] + .27, A['cut1'] + .87]
    A['stampBuy'] = W('N2', 'achet') + .2; A['ding1'] = A['slide1'][1] + .05
    A['tics'] = [E('T1') - 1.0, E('T1') - .5, E('T1')]; A['flyDur'] = .45
    A['cutT'] = W('N3', ['tch', 'chak'], 0, 1.4); A['landT'] = A['cutT'] + .5; A['envT'] = W('N3', 'transp', 0, .15) - .25
    A['cutD1'] = W('N4', ['tch', 'chak'], 0, 1.7); A['cutD2'] = W('N4', ['tch', 'chak'], 1, 2.0); A['landD'] = A['cutD2'] + .5
    A['envD'] = max(W('N4', 'douane', 0, .15) - .25, A['landT'] + .1); A['amtD'] = min(W('N4', 'trois', 0, .75), A['envD'] + .6)
    A['sticker'] = A['amtD'] + .5
    A['cutF'] = W('N5', ['tch', 'chak'], 0, 2.0); A['landF'] = A['cutF'] + .5; A['envF'] = max(W('N5', 'frais', 0, .55) - .25, A['landD'] + .1)
    A['amtF'] = min(W('N5', 'cinq', 0, 1.1), A['envF'] + .6); A['doodles'] = [A['amtF'] + .35 + .16 * i for i in range(4)]
    A['boxIn'] = max(T['N6'] - .15, A['landF'] + .1); A['lid'] = A['boxIn'] + .2; A['feet'] = A['lid'] + .22
    A['stampInv'] = W('N6', 'cent', 0, 1.0) + .1; A['cutI'] = W('N6', ['tch', 'chak'], 0, 3.0); A['zeroCalc'] = A['cutI'] + .5
    A['musicCut'] = E('N6') + .1; A['coinSpin'] = A['musicCut'] + .15
    A['zeroStamp'] = W('N7', ['zer', 'zero'], 0, 2.2); A['zeroFall'] = min(T['N7'] + .1, A['zeroStamp'] - .75)
    A['coinSettle'] = min(A['zeroStamp'] + .45, T['T2'] - .1)
    A['toiZeroEnd'] = max(E('T2') + .15, T['T2'] + 1.45); A['major'] = T['N8'] - .1
    A['stack'] = [max(A['major'] + .4, A['toiZeroEnd'] + .05) + .5 * i for i in range(5)]
    A['arrow'] = max(W('N8', 'fix', 0, 3.0) - .15, A['stack'][4] + .3); A['priceTag'] = max(W('N8', 'prix', 0, 3.55), A['arrow'] + .35)
    A['brandIn'] = T['N9'] - .12; A['sig'] = W('N9', 'bonz', 0, .3) - .05; A['plate'] = W('N9', 'bonz', 0, .3)
    A['scan'] = W('N9', 'colis', 0, 1.9); A['weigh'] = W('N9', 'pes', 0, 2.6); A['stampPese'] = A['weigh'] + .3
    A['measure'] = W('N9', 'mesur', 0, 3.05); A['stampMes'] = A['measure'] + .45
    A['endcard'] = E('N9') + .1; A['cta'] = max(W('N10', 'ecri'), A['endcard'] + .15); A['gulps'] = [A['cta'] + .55, A['cta'] + 1.05]
    A['ritual'] = W('N10', 'maint', 0, 1.7); A['loop'] = T['end'] - .5; A['finalChord'] = A['loop'] - .25
    return A

def derive_cues(A):
    """python mirror of SCORE.soundCues() (names of the storyboard's sound column)"""
    Q = []
    def q(t, name, g=1.0, pan=0.0): Q.append(dict(t=round(max(0.0, t), 4), name=name, g=g, pan=pan))
    for s in A['snips']: q(s, 'snip', .9, .15)
    q(A['cut1'], 'tchac'); q(A['slide1'][0], 'paper_slide', .7, -.3); q(A['ding1'], 'ding', .55, .3); q(A['stampBuy'], 'stamp', .55, .25)
    for i, s in enumerate(A['tics']): q(s, 'tic', .8 if i == 2 else .6, .2)
    q(A['envT'], 'paper_slide', .45, -.4); q(A['cutT'], 'tchac'); q(A['cutT'] + .05, 'paper_slide', .5); q(A['cutT'] + .22, 'horn', .5, .2)
    q(A['envD'], 'paper_slide', .45, -.4); q(A['sticker'], 'sticker', .5, -.2); q(A['cutD1'], 'tchac_big'); q(A['cutD2'], 'tchac_big')
    q(A['cutD2'] + .05, 'paper_slide', .5)
    q(A['envF'], 'paper_slide', .45, -.4)
    for d in A['doodles']: q(d, 'marker', .25, -.3)
    q(A['cutF'], 'tchac'); q(A['cutF'] + .1, 'coin_roll', .6, .3)
    q(A['boxIn'] + .2, 'box_drop', .5, -.3); q(A['lid'], 'lid', .8, -.2); q(A['feet'], 'boing', .8, -.2); q(A['stampInv'], 'stamp', .8)
    q(A['cutI'], 'tchac'); q(A['zeroCalc'], 'calc_zero', .5, .3); q(A['coinSpin'], 'coin_spin', .6, .2); q(A['zeroStamp'], 'stamp_big')
    q(A['coinSettle'], 'ting', .6, .2)
    for i, s in enumerate(A['stack']): q(s, 'stack', .55, -.3 + .15 * i)
    q(A['arrow'], 'marker', .5, .1); q(A['priceTag'], 'pop', .5, .3)
    q(A['brandIn'], 'whoosh', .4); q(A['sig'], 'bonzini_sig'); q(A['plate'], 'plate', .8); q(A['scan'], 'scan_beep', .7, .3)
    q(A['weigh'], 'tonk', .8); q(A['stampPese'], 'stamp', .7, -.3); q(A['stampMes'], 'stamp', .7, .3)
    q(A['cta'], 'pop', .7)
    for g in A['gulps']: q(g, 'gloup', .8, -.5)
    q(A['ritual'], 'stamp', .8); q(A['finalChord'], 'final_chord'); q(A['loop'], 'reform', .5)
    return sorted(Q, key=lambda c: c['t'])

def derive_music(A, T):
    return dict(silentUntil=A['tics'][2], tenseFrom=A['tics'][2], skip=[A['cutD2']], cut=A['musicCut'], majorFrom=A['major'],
                sigAt=A['sig'], end=T['end'], bpm=120)

_SC = None
def score():
    """{T, DUR, A, cues, music, words, src, derived[]} — live from 01_score.js, completed by derivation when needed"""
    global _SC
    if _SC is not None: return _SC
    js = ("const S=require(%s);const o={T:S.T,DUR:S.DUR,A:S.A||null,cues:null,music:null};"
          "try{if(typeof S.soundCues==='function')o.cues=S.soundCues()}catch(e){o.cues_err=String(e)}"
          "try{if(typeof S.music==='function')o.music=S.music()}catch(e){o.music_err=String(e)}"
          "console.log(JSON.stringify(o))") % json.dumps(SCORE_JS)
    try:
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60, check=True, cwd=X)
        d = json.loads(r.stdout); d['src'] = '01_score.js (live, node)'
    except Exception as e:
        d = json.load(open(SNAP)); d['src'] = f'audio/score_used.json (snapshot; node failed: {str(e)[:120]})'
    try: d['words'] = json.load(open(TIMING_JSON)).get('words', {})
    except Exception: d['words'] = d.get('words', {})
    T = d['T']; d['derived'] = []
    if not d.get('A'):
        d['A'] = derive_A(T, d.get('DUR') or {}, d['words']); d['derived'].append('A')
    if not d.get('cues'):
        d['cues'] = derive_cues(d['A']); d['derived'].append('cues')
    dm = None
    if not isinstance(d.get('music'), dict): d['music'] = {}
    need = ('silentUntil', 'tenseFrom', 'skip', 'cut', 'majorFrom', 'sigAt', 'end')
    if any(k not in d['music'] for k in need):
        dm = derive_music(d['A'] if all(k in d['A'] for k in ('tics', 'cutD2', 'musicCut', 'major', 'sig')) else derive_A(T, d.get('DUR') or {}, d['words']), T)
        for k in need:
            if k not in d['music']: d['music'][k] = dm[k]; d['derived'].append('music.' + k)
    names = {c['name'] for c in d['cues']}
    if 'bonzini_sig' not in names:
        d['cues'].append(dict(t=d['music']['sigAt'], name='bonzini_sig', g=1, pan=0)); d['derived'].append('cue bonzini_sig')
    if 'final_chord' not in names:
        d['cues'].append(dict(t=T['end'] - .75, name='final_chord', g=1, pan=0)); d['derived'].append('cue final_chord')
    d['cues'] = sorted(d['cues'], key=lambda c: c['t'])
    d['dur'] = float(T['end'])
    if d['src'].startswith('01_score'):
        try:
            os.makedirs(OUT_A, exist_ok=True)
            json.dump({k: d[k] for k in ('T', 'DUR', 'A', 'cues', 'music')}, open(SNAP, 'w'), indent=1)
        except Exception: pass
    _SC = d
    return d

def voice_plan():
    """[{id, file, at, stretch, on, off, words}] sorted by film speech start (plan + takes; ASR words from vocheck)"""
    plan = json.load(open(PLAN_JSON)); takes = json.load(open(TAKES_JSON))
    try: vc = json.load(open(VOCHECK_JSON))
    except Exception: vc = {}
    out = []
    for lid, p in plan.items():
        tk = takes[lid]; assert tk['file'] == p['file'], (lid, tk['file'], p['file'])
        out.append(dict(id=lid, file=p['file'], at=float(p['at']), stretch=float(p.get('stretch', 1.0)), on=float(tk['on']),
                        off=float(tk['off']), words=[w for w in vc.get(p['file'], {}).get('words', []) if w['e'] > w['s']
                                                      and any(ch.isalnum() for ch in w['w'])]))
    return sorted(out, key=lambda v: v['at'] + v['on'] * v['stretch'])

def speech_segments(v, floor_db=-38.0, merge=.06, min_len=.025):
    """speech segments of a take in FILM time: 5-ms RMS above max-38 dB, gaps < 60 ms merged, blips < 25 ms dropped"""
    import soundfile as sf
    y, sr = sf.read(os.path.join(VO_DIR, v['file'])); y = y if y.ndim == 1 else y.mean(1)
    w = int(.005 * sr); e = np.sqrt(np.maximum(np.convolve(y ** 2, np.ones(w) / w, 'same'), 0)); edb = 20 * np.log10(e + 1e-9)
    act = edb > edb.max() + floor_db
    idx = np.flatnonzero(np.diff(np.r_[0, act.astype(int), 0])); m = []
    for a, b in zip(idx[::2], idx[1::2]):
        if m and a - m[-1][1] < int(merge * sr): m[-1] = (m[-1][0], b)
        else: m.append((a, b))
    return [(v['at'] + a / sr * v['stretch'], v['at'] + b / sr * v['stretch']) for a, b in m if b - a > int(min_len * sr)]

_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze',
      'quinze', 'seize']
def fr_num(n):
    """French words for 0 <= n < 1 000 000 (enough for the ASR digit tokens of the series)"""
    if n < 17: return _U[n]
    if n < 20: return 'dix-' + _U[n - 10]
    if n < 100:
        d, u = divmod(n, 10); base = {2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'soixante', 8: 'quatre-vingt', 9: 'quatre-vingt'}[d]
        if d in (7, 9): return base + ('-et-' if n == 71 else '-') + fr_num(10 + u)
        if u == 0: return base + ('s' if d == 8 else '')
        return base + ('-et-un' if u == 1 and d != 8 else '-' + _U[u])
    if n < 1000:
        c, r = divmod(n, 100); head = 'cent' if c == 1 else _U[c] + ' cent' + ('s' if r == 0 else '')
        return head + ('' if r == 0 else ' ' + fr_num(r))
    k, r = divmod(n, 1000); head = 'mille' if k == 1 else fr_num(k) + ' mille'
    return head + ('' if r == 0 else ' ' + fr_num(r))

def asr_words_fr(w, prev=None):
    """an ASR digit token written as the spoken French words (« 0. » -> « zéro. », « 102 » -> « cent deux »; « 000 » after a
    number -> « mille »), punctuation kept; anything else unchanged"""
    m = re.match(r'^(\d+)(\D*)$', w.strip())
    if not m: return w
    d, tail = m.groups()
    if set(d) == {'0'} and len(d) == 3 and prev is not None and re.match(r'^\d+', prev.strip()): return 'mille' + tail
    return fr_num(int(d)) + tail

def snap_words(sc, lines, min_pause=.12):
    """the ASR (vocheck -> timing.json) stamps a word that follows a pause at the START of the pause. For every word whose
    span [s, e] contains the end of a pause (>= 80 ms, s inside it or before it), the speech onset after that pause is
    the word's real start (pauses >= 120 ms: shorter gaps are plosive closures; a line's first word never moves). Digit
    tokens are also rewritten as spoken French words so the score's prefixes match (« 0. » -> « zéro. »). Returns ({id: [{w, s, e}]} relative to T[id], same shape as timing.json words; [audit rows])"""
    T = sc['T']; out = {}; rows = []
    for v in lines:
        lid = v['id']; segs = v.get('segs') or speech_segments(v); ws = sc['words'].get(lid, [])
        pauses = [(b0, a1) for (a0, b0), (a1, b1) in zip(segs, segs[1:]) if a1 - b0 >= min_pause]
        new = []
        for j, w in enumerate(ws):
            s0, e0 = T[lid] + w['s'], T[lid] + w['e']
            cand = [p for p in pauses if s0 + .005 < p[1] < e0 - .03] if j else []        # the first word starts the speech
            s1 = max(cand, key=lambda p: p[1] - max(p[0], s0))[1] if cand else s0
            wf = asr_words_fr(w['w'], ws[j - 1]['w'] if j else None)
            new.append(dict(w=wf, s=round(s1 - T[lid], 4), e=w['e'], **({'asr': w['w']} if wf != w['w'] else {})))
            if abs(s1 - s0) > .03 or wf != w['w']:
                rows.append(dict(id=lid, w=w['w'], fr=wf, asr=s0, speech=s1, d_ms=(s1 - s0) * 1000))
        out[lid] = new
    return out, rows

# sync-critical cues of episode 1 (README « T / W anchors »): (cue name, nth) -> (line, word prefixes, nth word, design offset)
SYNC = [(('tchac', 1), ('N3', ['tch', 'chak'], 0, 0.0)), (('tchac_big', 0), ('N4', ['tch', 'chak'], 0, 0.0)),
        (('tchac_big', 1), ('N4', ['tch', 'chak'], 1, 0.0)), (('tchac', 2), ('N5', ['tch', 'chak'], 0, 0.0)),
        (('tchac', 3), ('N6', ['tch', 'chak'], 0, 0.0)), (('stamp_big', 0), ('N7', ['zer', 'zero', '0'], 0, 0.0)),
        (('stamp', 0), ('N2', ['achet'], 0, .2)), (('stamp', 1), ('N6', ['cent', '102'], 0, .1)),
        (('bonzini_sig', 0), ('N9', ['bonz'], 0, -.05)), (('plate', 0), ('N9', ['bonz'], 0, 0.0)),
        (('scan_beep', 0), ('N9', ['colis'], 0, 0.0)), (('tonk', 0), ('N9', ['pes'], 0, 0.0)),
        (('pop', 1), ('N10', ['ecri'], 0, 0.0)), (('stamp', 4), ('N10', ['maint'], 0, 0.0))]

def sync_audit(sc, snapped):
    """cue time vs the word it is meant to sit on: ASR word (what the score used) and measured speech onset (snapped)"""
    T = sc['T']; rows = []; occ = {}
    for c in sc['cues']:
        k = occ.get(c['name'], 0); occ[c['name']] = k + 1
        for (nm, nth), (lid, pre, wn, off) in SYNC:
            if nm == c['name'] and nth == k and lid in T:
                a = word_at(T, sc['words'], lid, pre, wn); b = word_at(T, snapped, lid, pre, wn)
                rows.append(dict(cue=c['name'], t=c['t'], line=lid, word='/'.join(pre), off=off,
                                 asr=a, speech=b, err_asr=None if a is None else (c['t'] - a - off) * 1000,
                                 err_speech=None if b is None else (c['t'] - b - off) * 1000))
    return rows

# =====================================================================================================================
# SFX (all synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0; peak-normalised — levels set by LVL)
# =====================================================================================================================
def _norm(y, pk=1.0): return y / (np.abs(y).max() + 1e-12) * pk
def _tick(seed, n_ms=1.5, hp=3000.0): k = ns(n_ms / 1000); return dsp.hp(nz(k, seed), hp) * np.linspace(1, 0, k)
def _subdrop(g=1.0):
    """the series' sub drop (0.9 s) with a cos² fade over its last 0.25 s (it ends at -18 dB otherwise: a click)"""
    y = I.sub_drop(g); k = ns(.25); y[-k:] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    return y

def _fade_at(y, t_end, fade=.03):
    """cos² fade ending at t_end (s), silence after (for reused sounds whose parts stop inside the array)"""
    y = np.array(y, float); b = min(len(y), ns(t_end)); a = max(0, b - ns(fade))
    w = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2
    if y.ndim == 1: y[a:b] *= w; y[b:] = 0
    else: y[a:b] *= w[:, None]; y[b:] = 0
    return y

def _coin(t, seed, decay=.06, f=3920.0):
    """a small coin's ring (inharmonic modes of a thin disc)"""
    return R._modes(t, 1.0, ((f, 1.0, decay), (f * 1.47, .6, decay * .7), (f * 2.09, .35, decay * .45), (f * 2.9, .18, decay * .3)), seed)

def sfx_snip(seed=401, close=.068):
    """a dry snip in the air, very close to the mic: the pivot ticks at 0, the blades' edges scrape (stick-slip grains
    exciting the blade modes, the contact point runs to the tips so the band climbs 3.4 -> 6.8 kHz), the blades hit
    their stop at +close (bright steel clack + ring), the handles knock and the knuckles thump (proximity)"""
    n = ns(.32); t = tt(n); u = np.clip(t / close, 0, 1); on = (t < close).astype(float)
    env = np.minimum(1, t / .0015) * on * (.5 + .5 * u)
    g = grains(n, 4500, seed, .0004, (.2, 1)) * env
    y = dsp.tv_biquad(nz(n, seed + 1) * (.3 * env + g), 'bp', 3400 * 2 ** u, 2.5) * 1.6
    zing = sum(a * np.sin(2 * np.pi * np.cumsum(f * (1 + .06 * u)) / SR + i) for i, (f, a) in enumerate(((3170, .5), (4810, .35), (6930, .18))))
    y += zing * dsp.onepole_lp(env, 60.0) * .22
    i = ns(close); tm = tt(n - i)
    clack = R._modes(tm, 1.0, ((2630, .8, .020), (4170, .6, .013), (5890, .4, .009), (8350, .2, .005)), seed + 2)
    clack += np.sin(2 * np.pi * 390 * tm) * np.exp(-tm / .011) * .5 + np.sin(2 * np.pi * 140 * tm) * np.exp(-tm / .02) * .3
    c = _tick(seed + 3); clack[:len(c)] += c * 1.2
    y[i:] += clack * np.minimum(1, tm / .0002) * 1.1
    tk = R._click(3600, seed + 4); y[:len(tk)] += tk * .45
    y[:ns(.03)] += np.sin(2 * np.pi * 120 * t[:ns(.03)]) * np.exp(-t[:ns(.03)] / .012) * .25
    return _norm(y * np.minimum(1, t / .0003))

def sfx_tchac(seed=411, big=False):
    """THE signature paper TCHAC: big orange scissors through a thick banknote in one stroke.
    0: the blades bite (fibre crack + a chest thump: the camera's hit); 0..close: « TCH », the paper shears between the
    blades (dense fibre crackle in two bands + a fricative hiss, climbing as the cut runs to the tips, a thin blade zing);
    close: « AC », the blades slam shut (bright steel clack + handle knock) and the cut half flaps (papery « fp »).
    big = the douane's grave TCHAC: slower stroke, lower clack, chest + sub-drop"""
    close = .088 if big else .075
    n = ns(1.5 if big else .8); t = tt(n); u = np.clip(t / close, 0, 1)
    env = np.minimum(1, t / .0012) * np.clip((close - t) / .006, 0, 1) * (.72 + .28 * np.sin(np.pi * u))
    st = np.zeros((n, 2))
    for ch in range(2):
        cr = grains(n, 3400, seed + 10 * ch, .0006, (.15, 1)) * env
        lo = (1400 if big else 1800) * 1.6 ** u
        y = dsp.tv_biquad(nz(n, seed + 10 * ch + 1) * cr, 'bp', lo, 1.1) * 3.0 + dsp.hp(nz(n, seed + 10 * ch + 2) * cr, 5200) * 1.3
        y += dsp.tv_biquad(nz(n, seed + 10 * ch + 3), 'bp', (2900 if big else 3300) * 1.35 ** u, .9) * env * .5
        st[:, ch] = y
    m = st.mean(1); st = .7 * m[:, None] + .3 * st                                   # a touch wide, never hollow in mono
    zing = sum(a * np.sin(2 * np.pi * np.cumsum(f * (1 + .05 * u)) / SR + i) for i, (f, a) in enumerate(((2950, .5), (4460, .3))))
    mono = zing * dsp.onepole_lp(env, 60.0) * .10
    # the bite
    c = _tick(seed + 4, 4.0, 2200); mono[:len(c)] += c * 1.4
    f0 = (48 if big else 58) + (150 if big else 120) * np.exp(-t / (.025 if big else .018))
    mono += dsp.softclip(np.sin(2 * np.pi * np.cumsum(f0) / SR) * np.exp(-t / (.11 if big else .06)) * 1.5, 1.2) * (.9 if big else .55)
    if big:
        sd = _subdrop(1.0); mono[:len(sd)] += sd[:n] * .55
    # the « AC »
    i = ns(close); tm = tt(n - i); k = .82 if big else 1.0
    ac = R._modes(tm, 1.0, ((2380 * k, .8, .026), (3720 * k, .6, .017), (5310 * k, .42, .011), (7650 * k, .22, .007)), seed + 5)
    ac += np.sin(2 * np.pi * 330 * k * tm) * np.exp(-tm / .013) * .6
    c = _tick(seed + 6, 2.0, 3000); ac[:len(c)] += c * 1.3
    ac *= np.minimum(1, tm / .0002)
    mono[i:] += ac * (2.6 if big else 2.4)
    j = i + ns(.010); tf = tt(n - j)                                                  # the cut half flaps
    mono[j:] += (bp(nz(n - j, seed + 7), 950, .9) * np.exp(-tf / .018) * .7 + bp(nz(n - j, seed + 8), 2600, 1.0) * np.exp(-tf / .010) * .35)
    st += mono[:, None]
    st *= np.minimum(1, t / .0003)[:, None]
    return _norm(st)

def sfx_paper_slide(dur=.45, seed=421, stepped=False, flight=False):
    """paper sliding over kraft: a grab (paper flick) at 0, fine fibre friction (grains through two bands) + soft air,
    a papery settle at the end. stepped = stop-motion on twos (a small jerk every 1/15 s); flight = a slice flying
    into its envelope (more air, less friction, lands with a soft « fp »)"""
    n = ns(dur + .14); t = tt(n); u = np.clip(t / dur, 0, 1)
    shape = np.minimum(1, t / .010) * (t < dur) * (.6 + .4 * np.sin(np.pi * u))
    if stepped: shape = shape * (.3 + .7 * np.exp(-((t * 15) % 1) / .22))
    g = grains(n, 900 if flight else 1500, seed, .0009, (.2, 1)) * shape
    y = bp(nz(n, seed + 1) * g, 2600, .8) + .55 * bp(nz(n, seed + 2) * g, 1100, .9)
    if flight:
        w = np.zeros(n); wh = dsp.lp(I.whoosh(dur, seed + 3, 500, 3600), 7000)[:n]; w[:len(wh)] = wh
        y = y * .5 + _norm(w, np.abs(y).max() * .8)
    y += bp(nz(n, seed + 4), 3800, .6) * shape * .10
    fl = I.paper(seed + 5); y[:len(fl)] += fl * (1.2 if not flight else .8)
    i = ns(dur); tl = tt(n - i)
    y[i:] += (np.sin(2 * np.pi * 170 * tl) * np.exp(-tl / .02) * .35 + bp(nz(n - i, seed + 6), 1500, .8) * np.exp(-tl / .012) * .6)
    return _norm(y * np.minimum(1, t / .0004))

def sfx_ding(seed=431):
    """a small GENERIC register bell: the lever's clack, then one bright bell strike (2.64 kHz, inharmonic partials)"""
    n = ns(1.3); t = tt(n); y = np.zeros(n)
    c = bp(nz(ns(.02), seed), 1900, 2.0) * ex(ns(.02), .004) * 1.4; y[:len(c)] += c
    tb = tt(n - ns(.012)); b = sum(a * np.sin(2 * np.pi * 2637 * r * tb + seed + j) * np.exp(-tb / (.30 / r ** .5))
                                   for j, (r, a) in enumerate(((1, 1), (2.76, .5), (5.4, .25), (8.93, .12)))) / 1.9
    y[ns(.012):] += b * np.minimum(1, tb / .0005) * .9
    return _norm(y * np.minimum(1, t / .0003))

def sfx_tic(k=0, seed=441):
    """the clock's escapement: « tic » (k even, higher) / « tac » (k odd): a hard click, the wooden case, a tiny ring"""
    hi = k % 2 == 0; n = ns(.12); t = tt(n); f = 2100 if hi else 1500
    y = R._modes(t, 1.0, ((f, 1, .010), (f * 2.32, .55, .006), (f * 3.9, .25, .004)), seed + k)
    y += np.sin(2 * np.pi * (620 if hi else 480) * t) * np.exp(-t / .018) * .5
    c = _tick(seed + 7 + k, 1.2, 4000); y[:len(c)] += c * .8
    return _norm(y * np.minimum(1, t / .0002))

def sfx_horn(seed=451, dur=.34):
    """a VERY short ship horn (the felt-pen boat): reed-like saws a fifth apart (Bb2 + F3, one detuned), a scoop up at the
    start, brassy formants (450 Hz, 1.1 kHz), quick release"""
    n = ns(dur + .08); t = tt(n)
    env = np.minimum(1, t / .012) ** 1.2 * np.clip((dur - t) / .06, 0, 1)
    scoop = 2 ** (-1.0 / 12 * np.exp(-t / .03)); y = np.zeros(n)
    for f, a in ((116.54, 1.0), (174.61, .55), (116.54 * 1.005, .5)):
        ph = np.cumsum(f * scoop) / SR; y += a * (2 * (ph % 1) - 1)
    y = dsp.lp(y, 1700)
    y = bp(y, 450, 1.2) + bp(y, 1100, 1.6) * .6 + dsp.lp(y, 280) * .45
    c = _tick(seed, 2.0, 1500); y[:len(c)] += c * .02
    return _norm(y * env * (1 + .03 * np.sin(2 * np.pi * 5 * t)))

def sfx_sticker(seed=461):
    """the yellow sticker slapped on the envelope: a thumb pat on paper, the adhesive's « tsk » and a short crinkle"""
    n = ns(.25); t = tt(n)
    y = bp(nz(n, seed), 700, 1.0) * np.exp(-t / .010) + np.sin(2 * np.pi * np.cumsum(180 + 120 * np.exp(-t / .01)) / SR) * np.exp(-t / .03) * .6
    c = bp(nz(ns(.002), seed + 1), 3500, 1.0) * .9; y[:len(c)] += c
    i = ns(.045); tl = tt(n - i)
    y[i:] += bp(nz(n - i, seed + 2), 4200, 1.5) * np.exp(-tl / .006) * .45
    y += bp(nz(n, seed + 3) * grains(n, 700, seed + 4, .0008, (.2, 1), shape=np.exp(-t / .05)), 4500, .9) * .8
    return _norm(y * np.minimum(1, t / .0003))

def sfx_marker(dur=.13, seed=471, strokes=1):
    """felt pen on kraft: the tip touches (soft tick), fibrous friction (2-4.5 kHz) driven by the stroke speed, a thin
    wavering squeak of the felt; `strokes` lifts and lands again (the arrow: shaft + head)"""
    n = ns(dur + .03); t = tt(n); ph = (t * strokes / dur)
    speed = (np.sin(np.pi * (ph % 1)) ** .35) * (t < dur) * np.minimum(1, (ph % 1) / .03)
    fr = bp(nz(n, seed), 3000, 1.0) * (.45 + .55 * grains(n, 1100, seed + 1, .0010, (.3, 1)) / .5) + .4 * bp(nz(n, seed + 2), 1800, 1.2)
    f = 1500 + 280 * np.sin(2 * np.pi * 5.3 * t + seed) + 200 * np.clip(t / dur, 0, 1)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .10 + np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * .04
    y = (fr * .5 + tone) * dsp.onepole_lp(speed, 90.0)
    for s in range(strokes):
        c = _tick(seed + 3 + s, 2.0, 2200); i = ns(s * dur / strokes); y[i:i + len(c)] += c[:n - i] * .5
    return _norm(y * np.minimum(1, t / .0004))

def _strike(seed, a=1.0, decay=.02, f=3920.0):
    k = ns(max(.05, decay * 5)); tk = tt(k)
    y = _coin(tk, seed, decay, f) * a; c = _tick(seed + 1, 1.0, 4500); y[:len(c)] += c * a * .5
    return y * np.minimum(1, tk / .0002)

def sfx_coin_roll(dur=1.25, seed=481):
    """a coin knocked off the note rolls across the table: rotation clicks slowing 9 -> 4 Hz over a rolling rumble,
    then Euler's-disk wobble (clicks accelerating 6 -> 40 Hz) and it lies flat with a small clink"""
    roll, wob = dur * .62, dur * .30
    n = ns(dur + .5); t = tt(n); y = np.zeros(n); r = np.random.default_rng(seed)
    tk = 0.0; j = 0
    while tk < roll:
        u = tk / roll; place(y, _strike(seed + j, (.6 if j else 1.0) * (1 - .3 * u), .03), ns(tk)); tk += 1 / (9 - 5 * u) * r.uniform(.9, 1.1); j += 1
    while tk < roll + wob:
        u = (tk - roll) / wob; place(y, _strike(seed + j, .25 + .45 * u, .012, 3920 * (1 + .02 * u)), ns(tk)); tk += 1 / (6 + 34 * u ** 1.5); j += 1
    place(y, _strike(seed + 999, .9, .09), ns(dur))
    rum = dsp.lp(nz(n, seed + 5), 700) * (t < roll) * (1 - t / roll).clip(0, 1) * .12 * np.minimum(1, t / .01)
    return _norm(dsp.hp(y + rum, 120))

def sfx_box_drop(seed=491):
    """the shoe box lands in the slot: a hollow cardboard thud (cavity 150 Hz + walls 420 Hz), a papery slap, one small
    bounce (the score's spring)"""
    n = ns(.6); t = tt(n)
    def thud(m, s, a):
        tm = tt(m)
        return (np.sin(2 * np.pi * np.cumsum(150 + 70 * np.exp(-tm / .015)) / SR) * np.exp(-tm / .07) * .9
                + np.sin(2 * np.pi * 420 * tm) * np.exp(-tm / .03) * .4 + bp(nz(m, s), 900, .9) * np.exp(-tm / .012)) * a
    y = thud(n, seed, 1.0); i = ns(.11); y[i:] += thud(n - i, seed + 1, .3)
    c = _tick(seed + 2, 2.0, 1500); y[:len(c)] += c * .5
    return _norm(y * np.minimum(1, t / .0004))

def sfx_lid(seed=501):
    """the lid comes off: a grab, cardboard rubbing up the walls (short rising scrape), then the air « fwop »"""
    n = ns(.35); t = tt(n); d = .085; u = np.clip(t / d, 0, 1)
    env = np.minimum(1, t / .004) * (t < d)
    y = dsp.tv_biquad(nz(n, seed) * (.4 + grains(n, 1200, seed + 1, .0008, (.2, 1))), 'bp', 900 * 2.2 ** u, 1.2) * env
    c = _tick(seed + 2, 2.5, 1800); y[:len(c)] += c * .8
    i = ns(d); tm = tt(n - i)
    y[i:] += np.sin(2 * np.pi * np.cumsum(220 + 260 * (1 - np.exp(-tm / .015))) / SR) * np.exp(-tm / .035) * .9   # fwop: cavity opens
    y[i:] += dsp.lp(nz(n - i, seed + 3), 1200) * np.exp(-tm / .02) * .5
    return _norm(y * np.minimum(1, t / .0004))

def sfx_boing(seed=511, dur=.7):
    """comic spring « boiiing » (the two left feet): a jaw-harp twang — pitch springs up to B3 with a fast vibrato that
    decays, a nasal formant sweeping /o/ -> /i/, a thin metallic spring zing on top"""
    n = ns(dur); t = tt(n)
    f = 247 * (1 - .22 * np.exp(-t / .03)) * (1 + .09 * np.exp(-t / .22) * np.sin(2 * np.pi * 13 * t))
    ph = np.cumsum(f) / SR; src = np.tanh(2.2 * (2 * (ph % 1) - 1))
    fc = 520 + 1700 * (1 - np.exp(-t / .06)) * (.75 + .25 * np.sin(2 * np.pi * 13 * t) * np.exp(-t / .2))
    y = dsp.tv_biquad(src, 'bp', fc, 4.0) * 1.2 + dsp.lp(src, 600) * .35
    y += np.sin(2 * np.pi * np.cumsum(f * 10.5) / SR) * np.exp(-t / .12) * .08
    y *= np.minimum(1, t / .003) * np.exp(-t / .26)
    return _norm(y)

def sfx_calc_zero(seed=521):
    """the calculator falls to 0: a key click, then two falling LCD beeps (E6 -> E5)"""
    y = np.zeros(ns(.45)); k = I.mf.calc_key(seed); y[:len(k)] += k * 1.2
    for tb, f, d in ((.04, 1318.5, .07), (.13, 659.3, .16)):
        b = I.mf.calc_beep(f, d); place(y, b * 1.4, ns(tb))
    return _norm(y)

def sfx_coin_spin(dur=2.9, seed=531):
    """a coin set spinning in the silence: the flick (tick + ring), a faint whirr, then Euler's-disk wobble — the rattle
    rate climbs 8 -> 46 Hz and grows as it goes down; it ENDS just before the settle (the « ting » cue lies it flat)"""
    n = ns(dur); t = tt(n); y = np.zeros(n)
    s = _strike(seed, 1.0, .25); y[:len(s)] += s[:n]
    y += bp(nz(n, seed + 1), 4400, 5.0) * .05 * np.minimum(1, t / .05) * (1 - .5 * t / dur)
    tk = .18; j = 0; r = np.random.default_rng(seed + 2)
    while tk < dur - .01:
        u = tk / dur; a = .10 + .55 * u ** 1.6
        place(y, _strike(seed + 10 + j, a, .010 + .01 * (1 - u), 3920 * (1 + .015 * u)), ns(tk))
        tk += 1 / (8 + 38 * u ** 2.2) * r.uniform(.92, 1.08); j += 1
    y[-ns(.004):] *= np.linspace(1, 0, ns(.004))
    return _norm(dsp.hp(y, 300))

def sfx_ting(seed=541):
    """the coin lies flat: one clear high « ting » (long ring) on a short flat clap of the disc"""
    n = ns(.9); t = tt(n)
    y = _coin(t, seed, .32) + .5 * np.sin(2 * np.pi * 1180 * t) * np.exp(-t / .012)
    c = _tick(seed + 1, 1.0, 4500); y[:len(c)] += c * .6
    return _norm(y * np.minimum(1, t / .0002))

def sfx_stamp_big(seed=551):
    """the giant stamp « PRIX CHINOIS × 2 = 0 » lands in slow motion (×0.5): the « PAS REÇU. » big stamp read at 0.62 speed
    (lower, heavier, longer) + a sub drop + a crisp first contact; above 160 Hz the hit stays short (« …zéro » reads
    through), the low end rings"""
    s = R.sfx_big_stamp(seed); pos = np.arange(0, len(s) - 1, .62); y = np.interp(pos, np.arange(len(s)), s)
    n = len(y); t = tt(n)
    sd = _subdrop(1.0); y[:len(sd)] += sd[:n] * .7
    c = _tick(seed + 1, 3.0, 2500); y[:len(c)] += c * 1.2
    lo, hi = dsp.zp_split(y, 160, 2)
    y = lo * 1.1 + hi * np.where(t < .05, 1.0, np.exp(-(t - .05) / .05))
    return _norm(y * np.minimum(1, t / .0003))

def sfx_fall_slow(dur, seed=556):
    """the giant stamp's slow-motion fall (pre-roll, untagged): dark air sweeping down, swelling, cut AT the impact"""
    n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 1400 * (220 / 1400) ** u, 1.0) * u ** 1.8
    y += np.sin(2 * np.pi * np.cumsum(90 - 40 * u) / SR) * u ** 3 * .25
    y[-ns(.003):] *= np.linspace(1, 0, ns(.003))
    return _norm(y, .5)

def sfx_stack(i=0, seed=561):
    """an envelope (or the box) jumps onto the pile, on the beat: a papery plop (soft thud + slap), a tone higher each time"""
    n = ns(.3); t = tt(n); f0 = 150 * 2 ** (2 * i / 12)
    y = np.sin(2 * np.pi * np.cumsum(f0 + 90 * np.exp(-t / .012)) / SR) * np.exp(-t / .05) * .8
    y += bp(nz(n, seed + i), 1300 * 2 ** (2 * i / 12), .9) * np.exp(-t / .012) * .9 + bp(nz(n, seed + 20 + i), 3400, 1.0) * np.exp(-t / .006) * .4
    return _norm(y * np.minimum(1, t / .0004))

def sfx_whoosh(seed=566, dur=.32):
    """the violet light comes on and every figure leaves the frame: the series' cloth whoosh (flap at the start)"""
    return _norm(AU.sfx_whoosh(seed, dur))

def sfx_plate(seed=321):
    """the enamel plate « BONZINI TRADING CARGO » lands: the « PAS REÇU. » plate landing (series set-down + wooden tonk),
    faded inside its array (its set-down stops at .2 s)"""
    return _norm(_fade_at(R.sfx_tonk(seed), .2, .04))

def sfx_scan_beep(seed=571):
    """a GENERIC barcode-scanner beep: one clean 2.85 kHz tone, 110 ms, slightly square (odd harmonics), soft edges,
    over the violet laser's thin electric sweep"""
    n = ns(.5); t = tt(n); d = .11
    env = np.clip(t / .003, 0, 1) * np.clip((d - t) / .008, 0, 1)
    f = 2850; y = (np.sin(2 * np.pi * f * t) + .18 * np.sin(2 * np.pi * 3 * f * t) + .06 * np.sin(2 * np.pi * 5 * f * t)) * env
    y = dsp.lp(y, 9000)
    sw = dsp.tv_biquad(nz(n, seed), 'bp', 5000 + 3000 * np.sin(np.pi * np.clip(t / .4, 0, 1)), 6.0) * np.sin(np.pi * np.clip(t / .4, 0, 1)) * .25
    return _norm(y + sw)

def sfx_scale(seed=581):
    """the carton set on the scale (« tonk »): a hollow cardboard thump on the steel platform (cavity 210 Hz + platform
    modes 620 / 1370 / 2140 Hz), the spring's short low wobble, the needle's two ticks settling"""
    n = ns(.7); t = tt(n)
    y = np.sin(2 * np.pi * np.cumsum(210 + 90 * np.exp(-t / .012)) / SR) * np.exp(-t / .05) * .9
    y += R._modes(t, 1.0, ((620, .7, .16), (1370, .45, .10), (2140, .3, .06), (3310, .15, .04)), seed)
    y += bp(nz(n, seed + 1), 800, .9) * np.exp(-t / .010) * .8
    y += np.sin(2 * np.pi * 95 * t * (1 + .05 * np.sin(2 * np.pi * 9 * t))) * np.exp(-t / .12) * .35
    for tk, a in ((.16, .25), (.27, .15)):
        c = R._click(3100, seed + int(tk * 100)); place(y, c * a, ns(tk))
    c = _tick(seed + 2, 2.0, 1500); y[:len(c)] += c * .6
    return _norm(y * np.minimum(1, t / .0003))

def sfx_reform(dur=.5, seed=591):
    """the note re-forms for the loop: six paper pieces take off 30 ms apart (flicks), then fly back in a reversed paper
    rush that swells into frame 0 and is cut dead on the last sample (the loop's first sample is the scissors' snip)"""
    n = ns(dur); t = tt(n); u = t / dur; y = np.zeros(n)
    for i in range(6): place(y, I.paper(seed + i) * (1.0 - .08 * i), ns(i * .03))
    rush = dsp.tv_biquad(nz(n, seed + 10) * (.5 + grains(n, 900, seed + 11, .001, (.2, 1))), 'bp', 1800 * 3 ** u, .9)
    y += rush * u ** 2.0 * .9
    y[-ns(.0015):] *= np.linspace(1, 0, ns(.0015))
    return _norm(y)

def sfx_signature():
    """the Bonzini signature (series, « PAS REÇU. »): two clear rising bright-balafon notes E6 -> G#6, the 2nd SIG_GAP s
    later with a high glass partial — returns [(sig, dt, rel_gain, pan)]"""
    return [(AU.balafon_bright(88, 5800, .75), 0.0, .94, -.15), (AU.balafon_bright(92, 5801, .7), SIG_GAP, 1.0, .15),
            (AU._bell(m2f(100), .8, .3, 1, .002) * .5, SIG_GAP, .33, .15)]

# =====================================================================================================================
# levels + cue placement
# =====================================================================================================================
def mom_max(x):
    """max momentary loudness (400 ms, K-weighted, LUFS) of an event (mono = centre-panned)"""
    x = x if x.ndim == 2 else panst(x, 0.0)
    if len(x) < ns(.45): x = np.vstack([x, np.zeros((ns(.45) - len(x), 2))])
    _, lm = dsp.lufs_momentary(x, .01)
    return float(lm.max())

def put_cue(M, c, i, parts, name=None):
    """parts: [(stem, sig, dt, rel_gain, pan, tagged)] scaled together so that the cue reaches LVL[name] + 20 log10(g)"""
    name = name or c['name']
    L = max(dt + len(s) / SR for _, s, dt, _, _, _ in parts) - min(dt for _, _, dt, _, _, _ in parts)
    d0 = min(dt for _, _, dt, _, _, _ in parts); buf = np.zeros((ns(L) + 2, 2))
    for _, s, dt, gr, p, _ in parts: R.place_at(buf, R.stereo_of(np.asarray(s, float), gr, p), ns(dt - d0))
    G = 10 ** ((LVL[name] - mom_max(buf)) / 20) * c['g']
    for stem, s, dt, gr, p, tagged in parts:
        M.put(stem, s, c['t'] + dt, gr * G, p, tag=('cue', i) if tagged else None, fade=name not in SWELL)
    return G

# =====================================================================================================================
# music
# =====================================================================================================================
def tense_segments(plan, cues):
    """stop-time segments of the F#m groove: [(re-entry, stop, is_skip_entry)] — in on tenseFrom, out BRK before each
    TCHAC, back ON it (or one beat later when the TCHAC is the plan's skip)"""
    t0, cut = plan['tenseFrom'], plan['cut']
    skips = [s for s in plan.get('skip', []) if t0 < s < cut]
    marks = sorted({round(c['t'], 4) for c in cues if c['name'] in ('tchac', 'tchac_big') and t0 + .3 < c['t'] < cut - .1}
                   | {round(s, 4) for s in skips})
    starts, stops, flags = [t0], [], [False]
    for m in marks:
        sk = any(abs(m - s) < .05 for s in skips)
        stops.append(m - BRK); starts.append(m + (BEAT if sk else 0.0)); flags.append(sk)
    stops.append(cut)
    return [(a, e, f) for a, e, f in zip(starts, stops, flags) if e - a > .05]

def compose_tense(M, plan, cues):
    segs = tense_segments(plan, cues); bar = 0
    for k, (a, e, _) in enumerate(segs):
        lev = min(k, 3)
        for b in range(max(1, int(math.ceil((e - a) / BAR - 1e-6)))):
            t0 = a + b * BAR; tones = PM[bar % 4][1]
            def put(sig, t, g=1.0, p=0.0, _e=e, _k=k, _t0=t0, _b=b):
                if t < _e - 1e-6:
                    first = _k == 0 and _b == 0 and t - _t0 < .02
                    M.put('groove', sig, t, g * G_TENSE, p, cut=True, tag='music_in' if first else ('seg', _k))
            mk.groove(put, t0, bar, level='tense', prog=PM)                       # quarter picking, bass, hats, kick 1&3, rim 2&4
            for j in range(16):                                                  # density climbs at every cut
                tj = t0 + j * S16 + (.012 if j % 2 else 0.0)
                if lev >= 1 and mk.RHY[j]:
                    put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4000 + 16 * bar + j, mute=1), tj, .16, -.45)
                if lev >= 1 and j % 2 == 0: put(AU.rattle(4100 + 16 * bar + j, .045, .9, 1.0), tj, .22 if j % 4 == 0 else .15, .35)
                if lev >= 2 and j % 4:
                    put(mk.guitar(m2f(tones[mk.PICK[j] % len(tones)] + 12), .2, bright=.62, decay=.99, seed=4200 + 16 * bar + j, mute=.5), tj, .12, .45)
                if lev >= 2 and j % 4 == 2: put(AU.conga(62 if j % 8 == 2 else 57, 4300 + 16 * bar + j, slap=j % 8 == 6), tj, .40, -.3)
                if lev >= 3:
                    for h in range(2):
                        m = tones[(j + h) % len(tones)] + 12 + (12 if j >= 8 else 0)
                        put(bk.balafon(m2f(m), .25, 4400 + 32 * bar + 2 * j + h), tj + h * S16 / 2, .10 + .06 * j / 16, -.45)
            for bb in range(4):
                tb = t0 + bb * BEAT
                if lev >= 2 and bb % 2 == 1: put(mk.kick(), tb, .55)
                if lev >= 3 and bb in (1, 3): put(AU.clap(4500 + bb + 4 * bar), tb, .45, -.1)
            bar += 1
    if len(segs) >= 3:                                                           # riser from the 4th cut into the TOTAL cut
        a = segs[-2][0]; d = plan['cut'] - a + .1; n = ns(d); u = tt(n) / d
        y = dsp.tv_biquad(nz(n, 4600), 'bp', 900 * 7 ** u, 2.0) * u ** 2.0 * .6
        y += (np.sin(2 * np.pi * np.cumsum(185 * 2 ** (2 * u)) / SR) + np.sin(2 * np.pi * np.cumsum(185.6 * 2 ** (2 * u)) / SR)) * u ** 2.5 * .05
        M.put('groove', y, a, .55 * G_TENSE, 0, cut=True, tag='riser')
    return segs

def major_grid(plan, cues):
    """first downbeat of the major section: on the pile's stack grid when the stacks are regular beats, else majorFrom"""
    m0 = plan['majorFrom']; st = sorted(c['t'] for c in cues if c['name'] == 'stack' and c['t'] > m0 - .01)
    if len(st) >= 2 and all(abs((b - a) - BEAT) < .02 for a, b in zip(st, st[1:])):
        return st[0] - math.floor((st[0] - m0 + 1e-6) / BEAT) * BEAT, 'stack grid'
    return m0, 'majorFrom'

def compose_rule(M, plan, cues, stop):
    """A-major full makossa from the arrival (majorFrom) on the stack grid until the brand break"""
    m0 = plan['majorFrom']; first, src = major_grid(plan, cues)
    nb = max(0, int(math.ceil((stop - first) / BAR - 1e-6)))
    for b in range(nb):
        a = first + BAR * b
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if t < stop - 1e-6: M.put('groove', sig, t, g * G_MAJOR, p, tag=('maj', _b))
        mk.groove(put, a, b, level='full', prog=mk.PROG)
        tones = mk.PROG[b % 4][1]
        for j in range(16):
            tj = a + j * S16 + (.012 if j % 2 else 0.0)
            if j % 2 == 0: put(AU.rattle(5300 + 16 * b + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
            if j in (6, 14): put(AU.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * b + j, .6), tj, .16, -.4)
            if j % 8 == 4: put(AU.conga(64 if j == 4 else 59, 5500 + 16 * b + j, slap=j == 12), tj, .30, -.3)
    on_beat = abs(first - m0) < .03
    tag = 'major_in'
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), m0, 1.0 * G_MAJOR, 0, tag=tag)
    M.put('brand', AU.soft_pad([69, 73, 76], 2.2, 1.0), m0, .55 * G_MAJOR, 0, tag=tag)
    M.put('brand', AU.sfx_shimmer(5600, .5), m0, .22 * G_MAJOR, 0, tag=tag)
    if on_beat: M.put('groove', mk.kick(), m0, .5 * G_MAJOR, 0, tag=tag)
    else: M.put('groove', mk.bass(m2f(45), .25, .6), m0, .35 * G_MAJOR, 0, tag=tag)      # a pickup into the first downbeat
    return first, src

def compose_brand_end(M, sc, plan, cues):
    """violet break -> signature -> brand groove (E | D) on the signature's grid -> end card (A | E), full -> the band
    hits with the ritual stamp and rests (pad E7sus4 -> E) -> the final chord (cue)"""
    A = sc['A']; T = sc['T']
    sig = plan['sigAt']; s2 = sig + SIG_GAP
    v_in = next((c['t'] for c in cues if c['name'] == 'whoosh' and sig - 1.0 < c['t'] < sig), A.get('brandIn', sig - .18))
    t_final = next((c['t'] for c in cues if c['name'] == 'final_chord'), T['end'] - .75)
    endcard = A.get('endcard', T['N9'] + sc['DUR'].get('N9', 4.4) + .1)
    ritual = A.get('ritual')
    if ritual is None or not (s2 < ritual < t_final): ritual = t_final - 1.0
    # the violet light, as a sound: an E(add9) pad swell + a glass shimmer under the signature
    M.put('brand', AU.soft_pad([64, 71, 76, 78], s2 - v_in + .7, 1.0), v_in, .55 * G_BRAND, 0, tag='violet')
    M.put('brand', AU.sfx_shimmer(5900, .35), v_in, .16 * G_BRAND, 0, tag='violet')
    stop = ritual - .01; nb = max(1, int(math.ceil((stop - s2) / BAR - 1e-6))); bars = []
    for b in range(nb):
        a = s2 + BAR * b; full = a >= endcard - .3; G = G_MAJOR if full else G_BRAND
        name, tones, root = BRAND_PROG[b % 4]; bars.append((a, name, 'full' if full else 'brand'))
        def put(sig_, t, g=1.0, p=0.0, _b=b, _G=G):
            if t < stop - 1e-6: M.put('groove', sig_, t, g * _G, p, tag=('brandbar', _b))
        mk.groove(put, a, b, level='full' if full else 'lite', prog=BRAND_PROG)
        def putb(sig_, t, g=1.0, p=0.0, _b=b, _G=G):
            if t < stop - 1e-6: M.put('brand', sig_, t, g * _G, p, tag=('brandbar', _b))
        if not full:
            for bb, semi in ((0, 0), (2, 0), (3, 7)):
                put(mk.bass(m2f(root + semi - 12), .4 if bb < 3 else .2, .3), a + bb * BEAT, .40)
            for j in range(0, 16, 2): put(AU.rattle(6200 + 16 * b + j, .04, .7, 1.1), a + j * S16 + (.012 if j % 4 else 0), .10 if j % 4 else .14, .35)
            putb(AU.soft_pad([tones[0], tones[2], tones[3], tones[1] + 12], BAR + .3, 1.0), a, .42)
            for e8, step in {1: 0, 2: 1, 3: 2, 5: 3, 6: 2, 9: 1, 10: 2, 11: 3, 13: 4, 14: 3}.items():
                m = (tones + [tones[0] + 12, tones[1] + 12])[step] + 12
                putb(AU.balafon_bright(m, 6000 + 16 * b + e8, .7), a + e8 * BEAT / 2, .20 + .02 * (e8 % 3), -.35 + .25 * (e8 % 3))
        else:
            for j in range(16):
                tj = a + j * S16 + (.012 if j % 2 else 0.0)
                put(AU.rattle(6300 + 16 * b + j, .04, .8, 1.1), tj, .15 if j % 4 else .2, .35)
                if j in (6, 14): putb(AU.balafon_bright(tones[(j // 6 + b) % 4] + 12, 6400 + 16 * b + j, .6), tj, .18, -.4)
                if j % 8 == 4: put(AU.conga(64 if j == 4 else 59, 6500 + 16 * b + j, slap=j == 12), tj, .32, -.3)
            for bb in (1, 3): put(AU.clap(6600 + 4 * b + bb), a + bb * BEAT, .30, .1)
    # the ritual: unison hit on E with the stamp, then the pad holds the dominant until the final chord
    tag = 'ritual_hit'
    M.put('groove', mk.kick(), ritual, .75 * G_MAJOR, 0, tag=tag); M.put('groove', mk.bass(m2f(40), .35, .6), ritual, .5 * G_MAJOR, 0, tag=tag)
    M.put('groove', I.stab([52, 56, 59, 64], .16, 1.0), ritual, 1.0 * G_MAJOR, 0, tag=tag); M.put('groove', AU.clap(6700), ritual, .35 * G_MAJOR, -.1, tag=tag)
    M.put('brand', AU.balafon_bright(76, 6701, .8), ritual, .30 * G_MAJOR, -.2, tag=tag)
    mid = ritual + (t_final - ritual) * .5
    M.put('brand', AU.soft_pad([64, 69, 71, 74], mid - ritual + .35, 1.0), ritual, .50 * G_MAJOR, 0)
    M.put('brand', AU.soft_pad([64, 68, 71, 76], t_final - mid + .12, 1.0), mid, .50 * G_MAJOR, 0)
    M.put('brand', I.bass_sub(40, t_final - ritual), ritual, .35 * G_MAJOR, 0)
    return dict(v_in=v_in, s2=s2, ritual=ritual, t_final=t_final, endcard=endcard, bars=bars)

# =====================================================================================================================
# ambience
# =====================================================================================================================
def room_tone(N, seed=601):
    """the paper table's room: faint, EXACTLY periodic air (circularly filtered noise, 120 Hz - 6 kHz, pinkish tilt,
    two decorrelated channels) — the loop has no seam and the cut is a room, not a digital hole"""
    f = np.fft.rfftfreq(N, 1 / SR); shape = ((f > 120) & (f < 6000)) / np.sqrt(np.maximum(f, 1) / 300)
    out = np.zeros((N, 2))
    for ch in range(2):
        y = np.fft.irfft(np.fft.rfft(nz(N, seed + ch)) * shape, N); out[:, ch] = y / (y.std() + 1e-12)
    return out

# =====================================================================================================================
# compose everything
# =====================================================================================================================
def compose(sc, lines):
    T, DUR, cues, plan, A = sc['T'], sc['dur'], sc['cues'], sc['music'], sc['A']
    M = R.Mix(DUR); info = {}
    # ---- voices ---------------------------------------------------------------------------------------------------
    vinfo = []
    for v in lines:
        y, t0, on, off, inf = R.voice_line(v)
        M.put('vox', y, t0, 1.0, 0.0, tag=('vox', v['id']), fade=False)
        vinfo.append(dict(v, sig_len=len(y) / SR, t0=t0, t1=t0 + len(y) / SR, film_on=on, film_off=off, **inf))
    # ---- music ----------------------------------------------------------------------------------------------------
    info['segments'] = compose_tense(M, plan, cues)
    v_in = next((c['t'] for c in cues if c['name'] == 'whoosh' and plan['sigAt'] - 1.0 < c['t'] < plan['sigAt']), A.get('brandIn', plan['sigAt'] - .18))
    info['major_first'], info['major_src'] = compose_rule(M, plan, cues, v_in - .02)
    info['brand'] = compose_brand_end(M, sc, plan, cues)
    # ---- room tone ------------------------------------------------------------------------------------------------
    N = ns(DUR); rt = room_tone(N)
    M.put('amb', rt * 10 ** ((ROOM_LUFS - dsp.lufs_integrated(rt)) / 20), 0.0, 1.0, fade=False)
    # ---- cues -----------------------------------------------------------------------------------------------------
    unknown = []; cnt = {}
    names_t = lambda nm: sorted(c['t'] for c in cues if c['name'] == nm)
    tchacs = names_t('tchac') + names_t('tchac_big')
    slide1 = A.get('slide1'); fly = A.get('flyDur', .45)
    for i, c in enumerate(cues):
        t, name, g, pan = c['t'], c['name'], c['g'], c['pan']; sd = 7000 + 37 * i; k = cnt.get(name, 0); cnt[name] = k + 1
        P = None
        if name == 'snip': P = [('sfx', sfx_snip(sd), 0, 1, pan, True)]
        elif name == 'tchac': P = [('hit', sfx_tchac(sd), 0, 1, pan, True)]
        elif name == 'tchac_big': P = [('hit', sfx_tchac(sd, big=True), 0, 1, pan, True)]
        elif name == 'paper_slide':
            if slide1 and abs(t - slide1[0]) < .01: s = sfx_paper_slide(slide1[1] - slide1[0], sd, stepped=True)
            elif any(0 < t - x < .12 for x in tchacs): s = sfx_paper_slide(fly, sd, flight=True)
            else: s = sfx_paper_slide(.34, sd)
            P = [('sfx', s, 0, 1, pan, True)]
        elif name == 'stamp': s = AU.sfx_stamp(sd); P = [('sfx', _norm(s), 0, 1, pan, True)]
        elif name == 'ding': P = [('sfx', sfx_ding(sd), 0, 1, pan, True)]
        elif name == 'tic': P = [('sfx', sfx_tic(k, sd), 0, 1, pan, True)]
        elif name == 'horn': P = [('sfx', sfx_horn(sd), 0, 1, pan, True)]
        elif name == 'sticker': P = [('sfx', sfx_sticker(sd), 0, 1, pan, True)]
        elif name == 'marker':
            arrow = (A.get('arrow') is not None and abs(t - A['arrow']) < .01) or g >= .4
            P = [('sfx', sfx_marker(.42, sd, 2) if arrow else sfx_marker(.12, sd, 1), 0, 1, pan, True)]
        elif name == 'coin_roll': P = [('sfx', sfx_coin_roll(1.25, sd), 0, 1, pan, True)]
        elif name == 'box_drop': P = [('sfx', sfx_box_drop(sd), 0, 1, pan, True)]
        elif name == 'lid': P = [('sfx', sfx_lid(sd), 0, 1, pan, True)]
        elif name == 'boing': P = [('sfx', sfx_boing(sd), 0, 1, pan, True)]
        elif name == 'calc_zero': P = [('sfx', sfx_calc_zero(sd), 0, 1, pan, True)]
        elif name == 'coin_spin':
            nxt = [x for x in names_t('ting') if x > t + .3]
            P = [('sfx', sfx_coin_spin((nxt[0] - t - .005) if nxt else 2.5, sd), 0, 1, pan, True)]
        elif name == 'ting': P = [('sfx', sfx_ting(sd), 0, 1, pan, True)]
        elif name == 'stamp_big':
            fall = max(.2, t - A['zeroFall']) if A.get('zeroFall') is not None else .7
            P = [('hit', sfx_stamp_big(sd), 0, 1, pan, True), ('sfx', sfx_fall_slow(fall, sd + 1), -fall, .5, 0, False)]
        elif name == 'stack': P = [('sfx', sfx_stack(k, sd), 0, 1, pan, True)]
        elif name == 'pop': P = [('sfx', _norm(I.pop(sd)), 0, 1, pan, True)]
        elif name == 'whoosh': P = [('sfx', sfx_whoosh(sd), 0, 1, pan, True)]
        elif name == 'bonzini_sig':
            P = [('sig', s, dt, gr * G_SIG, p, True) for s, dt, gr, p in sfx_signature()]
        elif name == 'plate': P = [('sfx', sfx_plate(sd), 0, 1, pan, True)]
        elif name == 'scan_beep': P = [('sfx', sfx_scan_beep(sd), 0, 1, pan, True)]
        elif name == 'tonk': P = [('sfx', sfx_scale(sd), 0, 1, pan, True)]
        elif name == 'gloup': P = [('sfx', R.sfx_gloup(k, sd), 0, 1, pan, True)]
        elif name == 'reform': P = [('sfx', sfx_reform(max(.1, DUR - t), sd), 0, 1, pan, True)]
        elif name == 'final_chord':
            R.G_FINAL = 10 ** (-9 / 20); R.compose_final(M, t, ('cue', i)); continue
        else: unknown.append(name); continue
        put_cue(M, c, i, P)
    return M, vinfo, unknown, info

# =====================================================================================================================
# render + mixdown
# =====================================================================================================================
def gate(N, t_cut, t_on=None, fade=.004): return R.gate(N, t_cut, t_on, fade)

def render(M, sc, fx=True):
    plan = sc['music']; DUR = sc['dur']
    N = ns(DUR + R.TAIL); raw = {}
    for stem, sig, t, g, p, cut, tag in M.ev:
        k = (stem, cut)
        if k not in raw: raw[k] = np.zeros((N, 2))
        R.place_at(raw[k], R.stereo_of(sig, g, p), ns(t))
    ir = R.irs(); gc = gate(N, plan['cut']); out = {}; dry_vox = None
    for (stem, cut), x in raw.items():
        if stem == 'vox': dry_vox = x.copy()
        s = SENDS.get(stem)
        if s and fx: x = x + dsp.reverb(x, ir[s[0]], wet=s[1])
        if cut: x = x * gc[:, None]
        out[stem] = out.get(stem, 0) + x
    return out, dry_vox

def mixdown(st, dry_vox, sc, spans, t_back):
    """stems -> ducked stems + premaster (N = T.end exactly)"""
    DUR = sc['dur']; N = ns(DUR); plan = sc['music']
    d1, act = R.duck_db(dry_vox[:N], spans)
    st = {k: v[:N].copy() for k, v in st.items()}
    for k, depth in DUCKED.items():
        if k in st: st[k] *= dsp.undb(d1 * depth)[:, None]
    for k in ('groove', 'brand'):
        if k in st: st[k] = R.carve(st[k], d1)
    pre = np.ones(N); pre[:ns(plan['tenseFrom'])] = 0                         # the music events start exactly there
    hole = gate(N, plan['cut'], t_on=t_back)                                  # the zero-phase carve smears ~1e-4: the music
    end = gate(N, DUR - .04, fade=.06)                                       # is digital silence before tenseFrom and in the cut
    for k in MUSIC:
        if k in st: st[k] *= (pre * hole * end)[:, None]
    music = sum(st[k] for k in MUSIC if k in st)
    P = AU.sclip(music, .7) + st.get('sfx', 0) + AU.sclip(st.get('hit', np.zeros((N, 2))), .5) + st.get('amb', 0) + st['vox']
    return st, P, d1, act

# =====================================================================================================================
# build + checks
# =====================================================================================================================
def build(sheet=False):
    import soundfile as sf, pyloudnorm as pyln
    sc = score(); T, DUR, plan = sc['T'], sc['dur'], sc['music']; N = ns(DUR)
    lines = voice_plan()
    for v in lines: v['segs'] = speech_segments(v)
    snapped, snap_rows = snap_words(sc, lines)
    try: json.dump(dict(note='PROPOSED word starts snapped to the measured speech onsets (lib/audio_ep1.py snap_words); same shape as '
                             'data/timing.json "words" (relative to T[id]). Not applied: the score reads data/timing.json.',
                        moved=snap_rows, words=snapped), open(SNAPPED, 'w'), indent=1)
    except Exception as e: log('[E1] words_snapped.json failed:', e)
    sync = sync_audit(sc, snapped)
    for v in lines:                                                          # word-level checks on the snapped spans (file time)
        T_ = sc['T']; ws = snapped.get(v['id'])
        if ws and v['id'] in T_:
            v['words'] = [dict(w=w['w'], s=(T_[v['id']] + w['s'] - v['at']) / v['stretch'], e=(T_[v['id']] + w['e'] - v['at']) / v['stretch'])
                          for w in ws if w['e'] > w['s'] and any(ch.isalnum() for ch in w['w'])]
    log(f'[E1] score: {sc["src"]} · {len(sc["cues"])} cues · T.end {DUR} s · derived: {sc["derived"] or "nothing (score functions used)"}')
    log(f'[E1] music plan: {json.dumps(plan)}')
    M, vinfo, unknown, info = compose(sc, lines)
    if unknown: log('[E1] WARNING unhandled cue names:', unknown)
    log(f'[E1] {len(M.ev)} events · rendering')
    st, dry_vox = render(M, sc)
    t_back = min(e[2] for e in M.ev if e[0] in MUSIC and not e[5] and e[2] > plan['cut'])
    st, P, d1, act = mixdown(st, dry_vox, sc, [(v['film_on'], v['film_off']) for v in vinfo], t_back)
    Y, g, gl = R.master(P)
    tp = R.true_peak_db(Y); ceil = -1.3
    while tp > -1.0 and ceil > -3:
        ceil -= (tp + 1.0) + .05; Y, g, gl = R.master(P, ceiling=ceil); tp = R.true_peak_db(Y)
    assert len(Y) == N
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'vox': st['vox'], 'music': sum(st[k] for k in MUSIC if k in st), 'sfx': st['sfx'], 'hits': st['hit'], 'amb': st['amb']}
    for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    # ---------------- checks ----------------
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    rep = dict(sr=sr, n=len(Z), dur=len(Z) / sr, channels=Z.shape[1], master_gain_db=g, limiter_ceiling_db=ceil,
               lufs=meter.integrated_loudness(Z), tp_dbtp=R.true_peak_db(Z), sample_peak_db=20 * math.log10(np.abs(Z).max()),
               max_gr_db=float(-20 * np.log10(gl.min())), clipped=int((np.abs(Z) >= .9999).sum()),
               dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())], src=sc['src'], derived=sc['derived'], plan=plan,
               target_n=N, exact_length=len(Z) == N)
    rep['lra'] = R.lra(Z)
    rep['seam'] = dict(step=float(np.abs(Z[0] - Z[-1]).max()), local_p99=float(np.percentile(np.abs(np.diff(Z[-ns(.03):], axis=0)), 99)))
    mus = stems['music'] * G; vox = stems['vox'] * G; rest = (stems['sfx'] + stems['hits'] + stems['amb']) * G
    vox_ph, oth_ph = R.phone(vox), R.phone(mus + rest)
    # cue table
    rows = []
    for i, c in enumerate(sc['cues']):
        t, name = c['t'], c['name']
        o, place0 = R.iso_onset(M, ('cue', i))
        if o is None: rows.append(dict(t=t, name=name, kind='-', on=None, err=None, place=None, mix=None, mix_err=None, note='no event')); continue
        f = AU.flux_onset(Z, t)
        err = (o - t) * 1000
        note = ''
        if name in SWELL: err = (place0 - t) * 1000; note = 'swell: placement onset (-60 dB)'
        rows.append(dict(t=t, name=name, kind='alone', on=o, err=err, place=place0, mix=f, mix_err=None if f is None else (f - t) * 1000, note=note))
    for tag, t_ref, label in (('music_in', plan['tenseFrom'], 'music in (tenseFrom)'), ('major_in', plan['majorFrom'], 'major (majorFrom)'),
                              ('ritual_hit', info['brand']['ritual'], 'band hit on the ritual stamp')):
        o, _ = R.iso_onset(M, tag)
        if o is not None:
            f = AU.flux_onset(Z, t_ref)
            rows.append(dict(t=t_ref, name=tag, kind='alone', on=o, err=(o - t_ref) * 1000, place=None, mix=f,
                             mix_err=None if f is None else (f - t_ref) * 1000, note=label))
    # the cut: last time the music stem is above -60 dB re its pre-cut level, near plan.cut
    tc = plan['cut']; e = R.env_db(mus); pre_ = e[ns(tc - .3):ns(tc - .01)].max()
    idx = ns(tc - .3) + int(np.nonzero(e[ns(tc - .3):ns(tc + .2)] > pre_ * 1e-3)[0].max())
    rows.append(dict(t=tc, name='cut', kind='music off (-60 dB)', on=idx / SR, err=(idx / SR - tc) * 1000, place=None, mix=None, mix_err=None,
                     note=f'music max |x| in [cut, next music {t_back:.3f}) = {float(np.abs(mus[ns(tc):ns(t_back)]).max()):.1e}'))
    rows.sort(key=lambda r: r['t'])
    rep['cues'] = rows
    rep['cues_ok'] = all(r['err'] is not None and abs(r['err']) <= 15 for r in rows)
    # music silences + the skip hole
    rep['music_before'] = float(np.abs(mus[:ns(plan['tenseFrom'])]).max())
    rep['cut'] = dict(t=tc, t_back=t_back, music_max=float(np.abs(mus[ns(tc):ns(t_back)]).max()),
                      music_pre_rms_db=20 * math.log10(np.sqrt(np.mean(mus[ns(tc) - ns(.5):ns(tc)] ** 2)) + 1e-12),
                      mix_rms_db=20 * math.log10(np.sqrt(np.mean(Z[ns(tc):ns(t_back)] ** 2)) + 1e-12))
    segs = info['segments']; holes = []
    for k in range(1, len(segs)):
        a0, b0 = segs[k - 1][1], segs[k][0]
        def rms(a, b): return 20 * math.log10(np.sqrt(np.mean(mus[ns(a):ns(b)] ** 2)) + 1e-12)
        holes.append(dict(a=a0, b=b0, skip=segs[k][2], rms_in=rms(a0 + .02, b0 - .005), rms_before=rms(a0 - .5, a0)))
    rep['segments'] = [dict(k=k, a=a, e=e_, skip=f) for k, (a, e_, f) in enumerate(segs)]
    rep['holes'] = holes
    # beat grids vs musical-sync cues
    grid = []
    mf = info['major_first']; s2 = info['brand']['s2']
    for c in sc['cues']:
        if c['name'] in ('tchac', 'tchac_big') and plan['tenseFrom'] < c['t'] < plan['cut']:
            a = max((s[0] for s in segs if s[0] <= c['t'] + 1e-6), default=None)
            sk = any(abs(c['t'] - s) < .05 for s in plan.get('skip', []))
            ref = c['t'] if not sk else c['t']
            grid.append(dict(name=c['name'], t=c['t'], beat=ref if not sk else None, err=0.0 if not sk else None,
                             note='skip: lands in the hole' if sk else 'band re-enters ON it'))
        if c['name'] == 'stack' or (c['name'] == 'tic' and False):
            k = round((c['t'] - mf) / BEAT); grid.append(dict(name='stack', t=c['t'], beat=mf + k * BEAT, err=(c['t'] - mf - k * BEAT) * 1000, note='major grid'))
        if c['name'] in ('gloup', 'tonk', 'stamp') and c['t'] > s2 - .01:
            k = round((c['t'] - s2) / BEAT * 4) / 4; grid.append(dict(name=c['name'], t=c['t'], beat=s2 + k * BEAT, err=(c['t'] - s2 - k * BEAT) * 1000,
                                                                     note='brand grid (nearest 16th)'))
    rep['grid'] = grid
    rep['major'] = dict(first=mf, src=info['major_src'], majorFrom=plan['majorFrom'])
    rep['brand'] = {k: v for k, v in info['brand'].items() if k != 'bars'}; rep['brand_bars'] = info['brand']['bars']
    # voices
    vrows = []; prev = None
    for v in vinfo:
        a, b = ns(v['film_on']), ns(v['film_off'])
        ev = R.env_db(vox, .01); seg = ev[ns(v['t0']):ns(v['t1'])]; thr = seg.max() * 10 ** (-30 / 20)
        nzi = np.nonzero(seg > thr)[0]
        m_on, m_off = v['t0'] + nzi[0] / SR, v['t0'] + nzi[-1] / SR
        margin = 10 * math.log10(R.kpow(vox, a, b) / R.kpow(mus, a, b))
        margin_all = 10 * math.log10(R.kpow(vox, a, b) / R.kpow(mus + rest, a, b))
        wm = []; lp = R.kpow(vox, a, b); nskip = 0
        for w in v['words']:
            wa = ns(v['at'] + max(w['s'], v['on']) * v['stretch']); wb = ns(v['at'] + min(w['e'], v['off']) * v['stretch'])
            if wb - wa > ns(.04) and R.kpow(vox, wa, wb) < lp * .01: nskip += 1; continue
            if wb - wa > ns(.04): wm.append((w['w'], 10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus, wa, wb)),
                                             10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus + rest, wa, wb)),
                                             10 * math.log10(R.kpow(vox_ph, wa, wb) / R.kpow(oth_ph, wa, wb))))
        by_stem = {k: round(10 * math.log10(R.kpow(vox, a, b) / R.kpow(x * G, a, b)), 1) for k, x in st.items() if k != 'vox'}
        wmus = min(wm, key=lambda x: x[1])[0] if wm else None
        gap = None if prev is None else v['t0'] - prev['t1']
        sgap = None if prev is None else v['film_on'] - prev['film_off']
        vrows.append(dict(id=v['id'], file=v['file'], at=v['at'], stretch=v['stretch'], t0=v['t0'], t1=v['t1'], on=v['film_on'],
                          off=v['film_off'], T=T.get(v['id']), T_err_ms=None if T.get(v['id']) is None else (v['film_on'] - T[v['id']]) * 1000,
                          m_on=m_on, m_off=m_off, margin=margin, margin_all=margin_all,
                          word_min=min((x[1] for x in wm), default=None), word_worst_music=wmus, by_stem=by_stem, word_min_all=min((x[2] for x in wm), default=None),
                          word_worst=min(wm, key=lambda x: x[2])[0] if wm else None, gap=gap, speech_gap=sgap, words_checked=len(wm), words_pause=nskip,
                          phone=10 * math.log10(R.kpow(vox_ph, a, b) / R.kpow(oth_ph, a, b)),
                          phone_word_min=min((x[3] for x in wm), default=None), phone_word=min(wm, key=lambda x: x[3])[0] if wm else None,
                          lufs=float(dsp.lufs_integrated(vox[ns(v['t0']):ns(v['t1'])])), deess=v['deess_max_db'], ds_frac=v['deess_frac']))
        prev = v
    rep['voices'] = vrows
    rep['voices_overlap'] = any(r['gap'] is not None and r['gap'] < 0 for r in vrows)
    rep['voices_ok'] = (not rep['voices_overlap']) and all(r['margin'] >= 10 for r in vrows)
    rep['duck_max_db'] = float(-d1.min() * DUCK_DB)
    rep['speech_segments'] = {v['id']: [(round(a, 3), round(b, 3)) for a, b in v['segs']] for v in lines}
    rep['words_moved'] = snap_rows; rep['sync'] = sync
    # report
    log(f'[E1] mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s @ {sr} Hz x{rep["channels"]} (target {N} samples: {rep["exact_length"]}) · '
        f'{rep["lufs"]:.2f} LUFS · TP {rep["tp_dbtp"]:.2f} dBTP · sample peak {rep["sample_peak_db"]:.2f} dBFS · '
        f'LRA {fm(rep["lra"], ".1f")} LU · master {g:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB (ceiling {ceil:.2f}) · clipped {rep["clipped"]}')
    log('[E1] cues (alone = the cue\'s own events rendered alone, 10 % of max of a 1-ms envelope; mix = spectral-flux onset in mix.wav)')
    for r in rows:
        log(f'    {r["t"]:7.3f}  {r["name"]:12s} {r["kind"]:18s} {fm(r["err"], "+6.1f", "", " ms")}   mix {fm(r["mix_err"], "+6.1f", "   -  ", " ms")}  {r["note"]}')
    log(f'[E1] cues within 15 ms: {rep["cues_ok"]}')
    log('[E1] tense segments: ' + ' · '.join(f'#{s["k"]} {s["a"]:.3f}-{s["e"]:.3f}{" (skip entry)" if s["skip"] else ""}' for s in rep['segments']))
    log('[E1] stop-time holes (music RMS dBFS inside vs the .5 s before): ' + ' · '.join(f'{h["a"]:.2f}-{h["b"]:.2f}{" SKIP" if h["skip"] else ""} '
                                                                                      f'{h["rms_in"]:.0f}/{h["rms_before"]:.0f}' for h in holes))
    log(f'[E1] major grid first downbeat {mf:.3f} ({info["major_src"]}; majorFrom {plan["majorFrom"]:.3f}) · brand grid from {s2:.3f} · ritual {info["brand"]["ritual"]:.3f}')
    log('[E1] grid: ' + ' · '.join(f'{x["name"]}@{x["t"]:.3f} {fm(x["err"], "+.0f", "-", " ms")}' for x in grid))
    log('[E1] voices')
    for r in vrows:
        log(f'    {r["id"]:3s} {r["file"]:11s} region {r["t0"]:7.3f}-{r["t1"]:7.3f} speech {r["on"]:7.3f}-{r["off"]:7.3f} (T {r["T"]}, {fm(r["T_err_ms"], "+.1f")} ms) '
            f'· over music {r["margin"]:5.1f} dB (worst word {r["word_worst_music"]} {fm(r["word_min"], ".1f")}) · over all {r["margin_all"]:5.1f} dB (worst {r["word_worst"]} {fm(r["word_min_all"], ".1f")}) '
            f'· phone {r["phone"]:5.1f} dB · by stem {r["by_stem"]} · gap {fm(r["gap"], ".3f", "  -  ", "")} · {r["lufs"]:.1f} LUFS · de-ess {r["deess"]:.1f} dB')
    log(f'[E1] voices overlap: {rep["voices_overlap"]} · all >= 10 dB over the music: {all(r["margin"] >= 10 for r in vrows)}')
    log(f'[E1] music before tenseFrom: max |x| {rep["music_before"]:.1e} · cut at {tc:.3f}: music max |x| {rep["cut"]["music_max"]:.1e} until {t_back:.3f} '
        f'(pre-cut music {rep["cut"]["music_pre_rms_db"]:.1f} dBFS RMS; mix in the cut {rep["cut"]["mix_rms_db"]:.1f} dBFS RMS)')
    log('[E1] ASR word starts that sit in a pause (snapped to the measured speech onset; proposal in audio/words_snapped.json):')
    for r in snap_rows: log(f'    {r["id"]:3s} {r["w"]:12s} -> {r["fr"]:16s} ASR {r["asr"]:7.3f} -> speech {r["speech"]:7.3f}  ({r["d_ms"]:+5.0f} ms)')
    log('[E1] voice sync of word-anchored cues (cue - (word + design offset)): vs the ASR word the score used | vs the measured speech onset')
    for r in sync: log(f'    {r["cue"]:11s} {r["t"]:7.3f}  {r["line"]:3s} {r["word"]:13s} off {r["off"]:+.2f}  ASR {fm(r["err_asr"], "+6.0f", "     -", " ms")}  '
                       f'| speech {fm(r["err_speech"], "+6.0f", "     -", " ms")}')
    log(f'[E1] loop seam (end -> start): step {rep["seam"]["step"]:.4f} vs local sample-step p99 {rep["seam"]["local_p99"]:.4f}')
    try: json.dump(rep, open(REPORT, 'w'), indent=1, default=float)
    except Exception as e: log('[E1] report json failed:', e)
    if sheet: make_sheet(Z, stems, G, d1, rep, sc, vinfo, info)
    rep['snapped'] = snapped
    return rep

# =====================================================================================================================
# sheet
# =====================================================================================================================
def make_sheet(Z, stems, G, d1, rep, sc, vinfo, info, path=SHEET):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    T, DUR, plan = sc['T'], sc['dur'], sc['music']; br = info['brand']
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#16110c', 'figure.facecolor': '#0d0a07', 'text.color': '#f1e8dc',
                         'axes.labelcolor': '#f1e8dc', 'xtick.color': '#c9b8a2', 'ytick.color': '#c9b8a2', 'axes.edgecolor': '#4a3b2c'})
    fig = plt.figure(figsize=(20, 32), dpi=100)
    fig.subplots_adjust(top=.955, bottom=.01, left=.05, right=.96)
    gs = fig.add_gridspec(8, 3, height_ratios=[3.4, 1.0, 2.2, 1.5, 1.8, 1.5, 3.0, 1.9], hspace=.48, wspace=.14)
    ccol = {'tchac': '#ff6a2a', 'tchac_big': '#ff3a3a', 'stamp_big': '#ff3a3a', 'stamp': '#ff9a4a', 'snip': '#ffb27a',
            'bonzini_sig': '#b48cff', 'plate': '#b48cff', 'whoosh': '#b48cff', 'scan_beep': '#b48cff', 'tonk': '#b48cff',
            'final_chord': '#ffd84a', 'tic': '#ffd84a', 'reform': '#3ee0ff'}
    vcol = lambda lid: '#ffb24a' if lid.startswith('T') else '#d9c4ff'
    xt = np.arange(0, DUR + .01, 1.0)
    def marks(ax, labels=False):
        ax.axvspan(0, plan['tenseFrom'], color='#ffffff', alpha=.035)
        ax.axvspan(plan['cut'], plan['majorFrom'], color='#3ee0ff', alpha=.07)
        for c in sc['cues']:
            ax.axvline(c['t'], ymin=.94 if labels else 0, ymax=1, color=ccol.get(c['name'], '#9fe08a'), lw=.9, alpha=.9 if labels else .22)
    # 1 spectrogram
    ax = fig.add_subplot(gs[0, :]); m = Z.mean(1)
    f, t, S_ = sps.stft(m, SR, nperseg=4096, noverlap=4096 - 240)
    P = 20 * np.log10(np.abs(S_) + 1e-9); fl = np.geomspace(30, 18000, 420); rr = np.interp(fl, f, np.arange(len(f)))
    Pi = P[np.round(rr).astype(int)]; top = np.percentile(Pi, 99.8)
    ax.pcolormesh(t, fl, Pi, vmin=top - 85, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(30, 18000)
    ax.set_xlim(0, DUR); ax.set_xticks(xt); ax.set_ylabel('Hz')
    ax.set_title('mix.wav — log spectrogram · cue ticks + names (top) · voice speech spans (bottom bars: amber = TOI, lilac = narrator) · '
                 'grey = no music · cyan = TOTAL cut window (cut -> majorFrom)', loc='left', pad=70)
    marks(ax, True)
    for c in sc['cues']:
        ax.text(c['t'], 19500, c['name'], rotation=90, fontsize=6.3, va='bottom', ha='center', color=ccol.get(c['name'], '#9fe08a'))
    for v in vinfo:
        ax.plot([v['film_on'], v['film_off']], [36, 36], color=vcol(v['id']), lw=6, solid_capstyle='butt')
        ax.text((v['film_on'] + v['film_off']) / 2, 40, v['id'], ha='center', fontsize=8, color='w')
    for x0, lab in ((0, 'no music: snips · TCHAC · tic-tac'), (plan['tenseFrom'], 'TENSE F#m (stop-time on every TCHAC)'),
                    (plan['cut'], 'CUT · coin · stamp'), (plan['majorFrom'], 'A MAJOR (stack grid)'),
                    (br['v_in'], 'violet · signature · brand E|D'), (br['endcard'], 'end card A, full'), (br['ritual'], 'ritual · pad · final')):
        ax.text(x0 + .05, 62, lab, fontsize=7.5, color='w', alpha=.9)
    for a, e, sk in info['segments']: ax.axvline(a, ymin=0, ymax=.06, color='#ffd84a', lw=1.5)
    # 2 waveform
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#ffd9b0'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, DUR); ax.set_ylim(-1, 1); ax.set_xticks(xt)
    for s in (1, -1): ax.axhline(s * 10 ** (-1 / 20), color='r', lw=.5, ls='--')
    ax.set_title(f'waveform (L up / |R| down) · ±1 dBFS lines · TP {rep["tp_dbtp"]:.2f} dBTP · sample peak {rep["sample_peak_db"]:.2f} dBFS', loc='left')
    marks(ax)
    # 3 levels
    ax = fig.add_subplot(gs[2, :])
    def mom(x, hop=.02): tm, lm = dsp.lufs_momentary(x, hop); return tm, np.maximum(lm, -80)
    for x, lab, col, lw in ((Z, 'mix', '#ffffff', 1.2), (stems['vox'] * G, 'voices', '#ffb24a', 1.0), (stems['music'] * G, 'music (ducked)', '#3ee0ff', 1.0),
                            ((stems['sfx'] + stems['hits']) * G, 'sfx + impacts', '#ff5a5a', .8), (stems['amb'] * G, 'room tone', '#9fe08a', .7)):
        tm, lm = mom(x); ax.plot(tm, lm, color=col, lw=lw, label=lab)
    ts, ls = dsp.lufs_shortterm(Z, .05); ax.plot(ts, ls, color='#ffd84a', lw=1, ls='--', label='mix short-term (3 s)')
    for v in vinfo: ax.axvspan(v['film_on'], v['film_off'], color=vcol(v['id']), alpha=.09)
    for r in rep['voices']:
        ax.text((r['on'] + r['off']) / 2, -5, f'{r["id"]}\n+{r["margin"]:.1f}', ha='center', va='top', fontsize=7.5,
                color='#9fe08a' if r['margin'] >= 10 else '#ff5a5a')
    ax.set_xlim(0, DUR); ax.set_ylim(-75, -2); ax.set_xticks(xt); ax.axhline(-14, color='w', lw=.5, ls=':')
    ax2 = ax.twinx(); ax2.plot(np.arange(len(d1))[::240] / SR, d1[::240] * DUCK_DB, color='#ff7ad9', lw=1, label='music duck (dB)')
    ax2.set_ylim(-40, 2); ax2.set_ylabel('duck dB', color='#ff7ad9')
    ax.legend(loc='lower left', ncol=6, fontsize=7, facecolor='#16110c'); ax2.legend(loc='lower right', fontsize=7, facecolor='#16110c')
    ax.set_title(f'momentary loudness (400 ms) per stem, post master gain · integrated {rep["lufs"]:.2f} LUFS · '
                 f'numbers = voice over music bed during each line (dB, K-weighted, speech span; ≥ 10 required)', loc='left')
    marks(ax)
    # 4 zooms (envelopes)
    segs = info['segments']; sk = next((s for s in segs if s[2]), None)
    zskip = (sk[0] - BEAT - BRK - .6, sk[0] + .5) if sk else (plan['tenseFrom'], plan['tenseFrom'] + 1.2)
    zs = [(plan['cut'] - .35, plan['cut'] + .35, f'the TOTAL cut at {plan["cut"]:.3f}: music stem (cyan) vs mix', 'cut'),
          (zskip[0], zskip[1], f'douane: TCHAC TCHAC, the band skips a beat (hole {sk[0] - BEAT - BRK:.2f}-{sk[0]:.2f})' if sk else 'music in', 'skip'),
          (DUR - .9, DUR, f'final chord at {br["t_final"]:.2f}, reform rush, dry cut at {DUR:.2f}', 'end')]
    for j, (a0, a1, title, kind) in enumerate(zs):
        ax = fig.add_subplot(gs[3, j]); a, b = ns(a0), min(len(Z), ns(a1)); xs = np.arange(a, b) / SR
        e_mix = 20 * np.log10(R.env_db(Z[a:b], .002) + 1e-9); e_mus = 20 * np.log10(R.env_db((stems['music'] * G)[a:b], .002) + 1e-9)
        ax.plot(xs, e_mix, color='#ffffff', lw=.8, label='mix'); ax.plot(xs, e_mus, color='#3ee0ff', lw=.9, label='music')
        if kind != 'cut': ax.plot(xs, 20 * np.log10(R.env_db(((stems['hits'] + stems['sfx']) * G)[a:b], .002) + 1e-9), color='#ff5a5a', lw=.8, label='sfx+hits')
        if kind == 'cut': ax.axvline(plan['cut'], color='#3ee0ff', lw=1.2)
        for c in sc['cues']:
            if a0 <= c['t'] <= a1: ax.axvline(c['t'], color=ccol.get(c['name'], '#9fe08a'), lw=.8, alpha=.7)
        ax.set_ylim(-110, 0); ax.set_xlim(a0, a1); ax.set_title(title, loc='left', fontsize=8); ax.legend(fontsize=7, facecolor='#16110c')
        ax.set_ylabel('dBFS (2-ms RMS)')
    # 4b zoom spectrograms
    for j, (a0, a1, title) in enumerate(((0.0, 3.0, 'opening: snips · TCHAC 1 · slide on twos · stamp · ding (no music)'),
                                         (plan['cut'] - .2, plan['majorFrom'] + .6, 'cut: coin spin · slow stamp · ting · « …zéro ?! » · A major'),
                                         (br['v_in'] - .2, br['v_in'] + 3.4, 'brand: whoosh · signature E6->G#6 · plate · scan · tonk · stamps'))):
        ax = fig.add_subplot(gs[4, j]); a, b = ns(max(0, a0)), ns(a1)
        f, t, S_ = sps.stft(m[a:b], SR, nperseg=2048, noverlap=2048 - 120)
        P = 20 * np.log10(np.abs(S_) + 1e-9); fl = np.geomspace(40, 16000, 300); rr = np.interp(fl, f, np.arange(len(f)))
        Pi = P[np.round(rr).astype(int)]; top = np.percentile(Pi, 99.7)
        ax.pcolormesh(t + max(0, a0), fl, Pi, vmin=top - 80, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(40, 16000)
        for c in sc['cues']:
            if a0 <= c['t'] <= a1:
                ax.axvline(c['t'], ymin=.9, ymax=1, color=ccol.get(c['name'], '#9fe08a'), lw=1.2)
                ax.text(c['t'], 17000, c['name'], rotation=90, fontsize=6, va='bottom', ha='center', color=ccol.get(c['name'], '#9fe08a'))
        for v in vinfo:
            if v['film_off'] > a0 and v['film_on'] < a1: ax.axvspan(max(a0, v['film_on']), min(a1, v['film_off']), ymin=0, ymax=.03, color=vcol(v['id']))
        ax.set_xlim(max(0, a0), a1); ax.set_title(title, loc='left', fontsize=8, pad=36)
    # 5 grids + the signature
    ax = fig.add_subplot(gs[5, :2])
    for a, e, skp in segs:
        tb = a
        while tb < e: ax.axvline(tb, color='#ffd84a', lw=.8, alpha=.5); tb += BEAT
    for k in range(1, len(segs)): ax.axvspan(segs[k - 1][1], segs[k][0], color='#ff5a5a' if not segs[k][2] else '#ff00aa', alpha=.18)
    tb = info['major_first']
    while tb < br['v_in']: ax.axvline(tb, color='#9fe08a', lw=.8, alpha=.5); tb += BEAT
    tb = br['s2']
    while tb < br['ritual']: ax.axvline(tb, color='#b48cff', lw=.8, alpha=.5); tb += BEAT
    for c in sc['cues']: ax.plot([c['t']], [.62], 'v', color=ccol.get(c['name'], '#9fe08a'), ms=6)
    for v in vinfo:
        for a, b in v['segs']: ax.plot([a, b], [.25, .25], color=vcol(v['id']), lw=5, solid_capstyle='butt')
    for r in rep['words_moved']:
        if abs(r['d_ms']) > 30: ax.annotate('', xy=(r['speech'], .38), xytext=(r['asr'], .38), arrowprops=dict(arrowstyle='->', color='#ff5a5a', lw=1.2))
    ax.set_xlim(0, DUR); ax.set_ylim(0, 1); ax.set_xticks(xt); ax.set_yticks([])
    ax.set_title('beat grids · gold = tense stop-time segments (re-anchored ON each TCHAC) · red = breaks, magenta = the skipped beat · green = A-major\n'
                 'grid (stacks) · violet = brand/end grid · triangles = cues · bars = MEASURED speech segments · red arrows = ASR word start -> real speech onset',
                 loc='left', fontsize=7.2)
    ax = fig.add_subplot(gs[5, 2]); sg = plan['sigAt']; a0, a1 = sg - .15, sg + .75; a, b = ns(a0), ns(a1)
    f, t, S_ = sps.stft(m[a:b], SR, nperseg=2048, noverlap=2048 - 64)
    P = 20 * np.log10(np.abs(S_) + 1e-9); top = np.percentile(P, 99.8)
    ax.pcolormesh(t + a0, f, P, vmin=top - 70, vmax=top, cmap='magma', shading='auto'); ax.set_ylim(200, 4000)
    for fq, lab in ((1318.5, 'E6'), (1661.2, 'G#6')): ax.axhline(fq, color='#b48cff', lw=.6, ls=':'); ax.text(a1 - .02, fq + 40, lab, color='#b48cff', ha='right', fontsize=7)
    for x0, lab in ((sg, 'note 1'), (sg + SIG_GAP, 'note 2')): ax.axvline(x0, color='#b48cff', lw=1); ax.text(x0, 3800, lab, color='#b48cff', fontsize=7)
    ax.set_title(f'the Bonzini signature at sigAt = {sg:.3f} (E6 -> G#6, +{SIG_GAP:.2f} s) over « Bonzini » (mix)', loc='left', fontsize=8)
    # 6 cue table (2 columns) + grid / sync table
    ax = fig.add_subplot(gs[6, :]); ax.axis('off')
    hd = f'{"t":>7}  {"cue":12s} {"alone":>8} {"err":>8}   {"mix":>8} {"err":>8}'
    L = [f'{r["t"]:7.3f}  {r["name"]:12s} {fm(r["on"], "8.3f", "       -")} {fm(r["err"], "+6.1f", "     -", "ms")}   '
         f'{fm(r["mix"], "8.3f", "       -")} {fm(r["mix_err"], "+6.1f", "     -", "ms")}' for r in rep['cues']]
    h = (len(L) + 1) // 2
    ax.text(0, .97, '\n'.join([hd] + L[:h]), family='monospace', fontsize=7.0, va='top')
    ax.text(.31, .97, '\n'.join([hd] + L[h:]), family='monospace', fontsize=7.0, va='top')
    G2 = ['VOICE SYNC: cue - (word + offset)', f'{"cue":11s} {"t":>7} {"line":4s} {"word":10s} {"off":>5}  {"vs ASR":>7} {"vs speech":>9}']
    G2 += [f'{r["cue"][:11]:11s} {r["t"]:7.3f} {r["line"]:4s} {r["word"][:10]:10s} {r["off"]:+5.2f}  {fm(r["err_asr"], "+5.0f", "    -")}ms {fm(r["err_speech"], "+7.0f", "      -")}ms'
           for r in rep['sync']]
    G2 += ['', 'ASR words: start in a pause -> speech onset; digits -> words'] + [
        f'{r["id"]:3s} {r["w"][:9]:9s}>{r["fr"][:12]:12s} {r["asr"]:7.3f}>{r["speech"]:7.3f} ({r["d_ms"]:+4.0f})' for r in rep['words_moved']]
    G2 += ['', 'grid: ' + ' · '.join(f'{x["name"]} {fm(x["err"], "+.0f", "-")}' for x in rep['grid'] if x['name'] in ('stack', 'gloup', 'tonk'))]
    G2 += ['tense segments: ' + ' '.join(f'{s_["a"]:.2f}-{s_["e"]:.2f}{"*" if s_["skip"] else ""}' for s_ in rep['segments']) + '  (* skip)']
    ax.text(.62, .97, '\n'.join(G2), family='monospace', fontsize=6.9, va='top', color='#ffe2c4')
    ok = rep['cues_ok']
    ax.text(0, 1.03, f'every cue within 15 ms of the SCORE (alone): {ok} · music before tenseFrom max |x| = {rep["music_before"]:.1e} · music in the cut '
                     f'[{plan["cut"]:.3f}, {rep["cut"]["t_back"]:.3f}) max |x| = {rep["cut"]["music_max"]:.1e} · mix = spectral-flux onset in mix.wav · '
                     f'VOICE SYNC (right): the score\'s word anchors vs the measured speech', fontsize=8, va='top', color='#9fe08a' if ok else '#ff5a5a')
    # 7 voice table + loudness
    ax = fig.add_subplot(gs[7, :]); ax.axis('off')
    L = [f'{"id":3s} {"take":11s} {"region":>15}  {"speech (plan)":>15}  {"T.id":>6} {"err":>5}  {"gap":>6}  {"LUFS":>6}  '
         f'{"/music":>7} {"word min":>8}  {"/all":>6} {"worst word (all)":>20}  {"phone":>6} {"worst word (phone)":>20}  de-ess']
    for r in rep['voices']:
        L.append(f'{r["id"]:3s} {r["file"]:11s} {r["t0"]:7.3f}-{r["t1"]:7.3f}  {r["on"]:7.3f}-{r["off"]:7.3f}  '
                 f'{fm(r["T"], "6.3f", "     -")} {fm(r["T_err_ms"], "+5.0f", "    -")}  {fm(r["gap"], "6.3f", "   -  ", "")}  {r["lufs"]:6.1f}  {r["margin"]:+6.1f}  '
                 f'{fm(r["word_min"], "+6.1f", "   -", "")}    {r["margin_all"]:+6.1f} {(r["word_worst"] or "-")[:12]:>12} {fm(r["word_min_all"], "+6.1f", "", "")}   '
                 f'{r["phone"]:+6.1f} {(r["phone_word"] or "-")[:12]:>12} {fm(r["phone_word_min"], "+6.1f", "", "")}   {r["deess"]:4.1f} dB')
    L.append('')
    L.append(f'voices overlap: {rep["voices_overlap"]} · every line >= 10 dB over the music bed: {all(r["margin"] >= 10 for r in rep["voices"])} · '
             f'duck {rep["duck_max_db"]:.1f} dB + {R.CARVE_DB:.0f} dB carve of 0.9-5 kHz (look-ahead 100 ms, att 35 ms, rel 220 ms, held through each line, '
             f'gaps < .4 s held) · soft SFX duck {SFX_DUCK_DB:.0f} dB · impacts + signature never duck · phone = 300 Hz-8 kHz band, voice vs everything else')
    L.append(f'mix.wav: {rep["n"]} samples = {rep["dur"]:.6f} s @ {rep["sr"]} Hz, {rep["channels"]} ch (= T.end: {rep["exact_length"]}) · integrated '
             f'{rep["lufs"]:.2f} LUFS (pyloudnorm) · true peak {rep["tp_dbtp"]:.2f} dBTP (8x) · sample peak {rep["sample_peak_db"]:.2f} dBFS · '
             f'LRA {fm(rep["lra"], ".1f")} LU · master {rep["master_gain_db"]:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB · clipped {rep["clipped"]} · '
             f'loop seam step {rep["seam"]["step"]:.4f} (local p99 {rep["seam"]["local_p99"]:.4f})')
    L.append(f'score: {rep["src"]} · derived here: {rep["derived"] or "nothing"} · word margins use the ASR word spans with their starts snapped to the measured speech onsets')
    ax.text(0, 1, '\n'.join(L), family='monospace', fontsize=7.4, va='top')
    fig.suptitle('« JE SAVAIS PAS. » · 1/5 « TCHAC ! » — audio check sheet (lib/audio_ep1.py)', x=.01, y=.997, ha='left', fontsize=14, color='w')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=100, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    log('[E1] sheet ->', path)

# =====================================================================================================================
# gallery (every SFX once, levelled, 0.5 s apart) — to audition / inspect the synthesis alone
# =====================================================================================================================
def gallery(path=os.path.join(OUT_A, 'sfx_gallery.wav')):
    items = [('snip', sfx_snip()), ('tchac', sfx_tchac()), ('tchac_big', sfx_tchac(big=True)), ('paper_slide', sfx_paper_slide(.6, stepped=True)),
             ('paper_slide', sfx_paper_slide(.45, flight=True)), ('stamp', _norm(AU.sfx_stamp(41))), ('ding', sfx_ding()), ('tic', sfx_tic(0)),
             ('tic', sfx_tic(1)), ('horn', sfx_horn()), ('sticker', sfx_sticker()), ('marker', sfx_marker(.12)), ('marker', sfx_marker(.42, strokes=2)),
             ('coin_roll', sfx_coin_roll()), ('box_drop', sfx_box_drop()), ('lid', sfx_lid()), ('boing', sfx_boing()), ('calc_zero', sfx_calc_zero()),
             ('coin_spin', sfx_coin_spin(2.9)), ('ting', sfx_ting()), ('stamp_big', sfx_stamp_big()), ('stack', sfx_stack(0)), ('stack', sfx_stack(4)),
             ('pop', _norm(I.pop(1))), ('whoosh', sfx_whoosh()), ('plate', sfx_plate()), ('scan_beep', sfx_scan_beep()), ('tonk', sfx_scale()),
             ('gloup', R.sfx_gloup(0, 1)), ('reform', sfx_reform())]
    out = [np.zeros((ns(.3), 2))]; t = .3; toc = []
    for name, s in items:
        s = s if s.ndim == 2 else panst(s, 0); s = s * 10 ** ((LVL[name] - mom_max(s)) / 20)
        toc.append((round(t, 2), name)); out += [s, np.zeros((ns(.5), 2))]; t += len(s) / SR + .5
    y = np.vstack(out); y = y * 10 ** ((-16 - dsp.lufs_integrated(y)) / 20)
    dsp.save(path, y, 'PCM_24'); log('[E1] gallery ->', path); log('   ', toc)

if __name__ == '__main__':
    if '--gallery' in sys.argv: gallery()
    else: build(sheet='--sheet' in sys.argv)

"""« TROUVE LE MOT. » — Bonsoir, bonsoir (rush edit) — the film's sound: 48 kHz stereo, exactly SCORE.T.end seconds.
Built on « PAS REÇU. » (v3/lib/audio_recu.py, imported as R: voice chain, sidechain duck, carve, onset checks, series SFX)
and the series' synth code (audio.py, makossa.py, bikutsi.py, instruments.py), on the model of serie/ep2/lib/audio_ep2.py.

ONE score drives picture and sound: SCORE.T, SCORE.A, SCORE.REAL, SCORE.soundCues() and SCORE.music() are read LIVE from
overlay/scenes/01_score.js through node (which itself reads data/timing.json). Fallbacks, in order: audio/score_cues.json
(the last live read, if its DUR still matches data/timing.json), then a python replica of the score's chain (§5.5).
Narrator takes: data/takes.json ({id: {file, on, off, dur}}, chosen by vocheck) — each line's speech start (`on`) is placed
ON the score's T[id]; no takes.json -> the film is built without narrator (said in the log and the report).

The REAL voice (rush1/work/audio48.wav, never the 16-kHz copy): only the three spans of SCORE.REAL are ever read
(R1 r 0.00-1.78, R2 r 7.70-9.60, R1b r 0.55-1.78; r 1.78-7.70 is never played), each placed at its film time on its own
pictures. Chain: light spectral gate (STFT, attenuation <= 6 dB, noise profile = 20th percentile of the played spans),
HP 120 Hz and +2.5 dB presence at 3 kHz, both ZERO-PHASE (no delay), one gain per extract (R1 = R1b), the score's fades.
No resampling, no stretch, no pitch change: the samples keep their count and their timing (checked: length, x-corr lag,
pyin f0 ratio). Never reversed (the rewind is synthetic, fed by the hunt's makossa).

Street bed (replaces the rush's street from r 1.78; no voice can be in it): noise shaped on the mean spectrum of r 0.00-0.50,
EXACTLY periodic over the film (circular FFT) so the loop has no seam, slow traffic swell (whole cycles per film), one far
electric scooter in the hunt's gap between N1 and N2. Level = the street of R1 as played (K-weighted), then a gain profile:
-6 dB under the real extracts (150-ms crossfade at r 1.78), low under the narrator, lower at the STOP / answer, low under
the card, street only (and back up) in the last 0.3 s. Checked with the weak ASR (faster-whisper small) on the bed alone.

Music (makossa, 120 BPM, beat .5 s; the chrono tics are beats 1 and 3):
  0 .. music.tenseFrom      no music (the rush's own street, the real « Bonsoir, bonsoir », wood tics, a shaker rise)
  tenseFrom (2.00)          the tense F#m makossa drops DRY on the downbeat (kick + stab + bass) — F#m | D | E7
  ticks[5] (5.00)           « la makossa monte d'un cran »: skank, shaker 8ths, congas, four-on-the-floor, a riser
  music.cut (7.00)          TOTAL CUT (4-ms gate, reverb returns included) under the STOP stamp; the E7 is left hanging
  music.sigAt (9.45)        the Bonzini signature on the ellipse: E6 -> G#6 balafon (.1 s apart) + bell; nothing else
  music.majorFrom (15.95)   A MAJOR full makossa with the plate (stab, violet pad, shimmer) — its beat stretched (.45-.58 s)
                            so music.motifAt lands on a downbeat; the band stops there
  music.motifAt (20.15)     the guitar ALONE: « bon-soir, bon-soir » (2 + 2 notes, the voice's contour: up, up, the last
                            one sliding down 3 semitones like the man's « -soir »), choked at music.end (20.60)
  music.noMusic             digital silence under the real voices and in the call (checked)
Voices: R.voice_line (trim ±30 ms, 24 -> 48 kHz soxr VHQ, EQ, leveller + compressor, de-esser, -18 LUFS per line),
  small-room reverb. Music ducks DUCK_DB 12 dB under the narrator (+ R.CARVE_DB 6 dB carve of 0.9-5 kHz), the motif with a
  fast duck of its own, soft SFX SFX_DUCK_DB 9 dB, the stamp HIT_DUCK_DB 6 dB, the signature HIT_DUCK_DB 6 dB.
Master: HP 28 Hz + true-peak limiter run on the premaster tiled x3 (middle kept: the loop seam is in steady state);
  -14 LUFS integrated (pyloudnorm), TP <= -1 dBTP; the last 0.3 s are the street alone.

usage:  nice -n 5 python3 lib/audio_rush.py                      -> audio/mix.wav, audio/stems/*.wav, audio/audio_report.json
        nice -n 5 python3 lib/audio_rush.py --sheet [PATH]       -> + out/chk_audio_sheet.jpg
        options: --takes PATH (another takes.json) · --out DIR (instead of audio/) · --n6w (the WhatsApp variant: N6w take, timed on N6w by the
                 score (BZ_VARIANT=wa), written to audio_wa/ + out/chk_audio_sheet_wa.jpg; render with render.mjs --n6w)
                 --no-asr (skip the ASR check of the street bed) · --words (per-word margins)
API:    build(sheet=None) -> report dict · score() · compose(sc, lines) · sfx_<name>() -> np.ndarray (onset at sample 0)
"""
import os, sys, json, math, re, subprocess, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.abspath(os.path.join(HERE, '..'))                       # rush1/prod
SP = os.path.abspath(os.path.join(P, '..', '..'))                    # the scratchpad
V3LIB = os.path.join(SP, 'v3', 'lib')
if not os.path.isdir(V3LIB): V3LIB = os.path.join(SP, 'pas-recu', 'lib')   # repo layout: the « PAS REÇU. » sound library
if V3LIB not in sys.path: sys.path.insert(0, V3LIB)
import audio_recu as R                       # « PAS REÇU. »: imports audio (dsp, makossa, bikutsi, instruments) in order
import numpy as np
from scipy.ndimage import uniform_filter, uniform_filter1d
from audio import ns, tt, nz, ex, m2f, bp, panst, place, tail_fade, grains
A, dsp, SR, mk, bk, I = R.A, R.dsp, R.SR, R.mk, R.bk, R.I

def _arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('--'): return sys.argv[i + 1]
        return True
    return default

SCORE_JS = os.path.join(P, 'overlay', 'scenes', '01_score.js')
TIMING_JSON = os.path.join(P, 'data', 'timing.json')
TAKES_JSON = os.path.abspath(_arg('--takes', os.path.join(P, 'data', 'takes.json')))
VOCHECK_JSON = os.path.join(P, 'data', 'vocheck.json')
RUSH_WAV = os.path.join(P, '..', 'work', 'audio48.wav')                # rush1/work (scratch) = trouve-le-mot/work (repo)
# --n6w = the WhatsApp-status variant (STORYBOARD §6): the score reads BZ_VARIANT=wa (N6w's duration → T.end, the pill
# « Réponds-lui en message : »), and nothing of the main film is overwritten (audio_wa/, out/chk_audio_sheet_wa.jpg)
WA = '--n6w' in sys.argv
if WA: os.environ['BZ_VARIANT'] = 'wa'
_o = _arg('--out'); OUT_A = os.path.abspath(_o) if isinstance(_o, str) else os.path.join(P, 'audio_wa' if WA else 'audio')
CUES_DUMP = os.path.join(OUT_A, 'score_cues.json')
SHEET = os.path.join(P, 'out', 'chk_audio_sheet_wa.jpg' if WA else 'chk_audio_sheet.jpg')
# the voice chain of R reads these module globals at call time
R.TAKES_JSON = TAKES_JSON; R.VOCHECK_JSON = VOCHECK_JSON; R.VO_DIR = os.path.join(P, 'audio', 'vo')
R.CACHE = os.path.join(OUT_A, '.cache')
R.VOX_TRIM = {}                                # clear diction: every narrator line levelled the same

TAIL = 3.0
BEAT = 0.5
SIG_GAP = 0.10                                # the series signature: E6 then G#6 .1 s later
DUCK_DB, SFX_DUCK_DB, HIT_DUCK_DB = 12.0, 9.0, 6.0   # the voice first: music -12 dB under the narrator
CARVE_DB = 6.0
R.CARVE_DB = CARVE_DB
BED_DUCK_DB = 3.0                             # the street leans back a little more under the narrator
G_TENSE, G_MAJOR, G_BRAND = R.G_TENSE, R.G_MAJOR, R.G_BRAND
REAL_LUFS = -18.5                             # the real voice's speech span (narrator lines: R.VOX_LUFS = -18)
REAL_SPREAD_DB = 3.0                          # R2's gain stays within ±3 dB of R1's (one street, one man)
GATE_MAX_DB = 6.0                             # spectral gate: never more than 6 dB of attenuation
REAL_HP, PRES_F, PRES_DB = 120.0, 3000.0, 2.5
# street bed profile, dB re the street of R1 as played (§2 sound column, §5.6)
BED = dict(under_real=-6.0, hunt=-10.5, low=-13.0, card=-15.0, cta=-10.5, edge=-3.0, xfade=.15)
MUSIC = ('groove', 'brand', 'motif', 'sig')
BAND = ('groove', 'brand', 'motif')
DUCKED = {'groove': DUCK_DB, 'brand': DUCK_DB, 'sig': HIT_DUCK_DB, 'sfx': SFX_DUCK_DB, 'hit': HIT_DUCK_DB, 'tic': HIT_DUCK_DB}
SENDS = {'groove': ('room', .08), 'brand': ('plate', .24), 'motif': ('room', .10), 'sig': ('plate', .24),
         'sfx': ('room', .06), 'hit': ('room', .08), 'tic': ('room', .05), 'vox': ('vroom', .15)}
KNOWN_CUES = ('tic_wood', 'shaker_rise', 'whoosh', 'stamp_big', 'buzzer_soft', 'rewind', 'swell_rise', 'focus_click',
              'bonzini_sig', 'felt', 'whoosh_back', 'paper_lift', 'tonk', 'pop', 'pill_drop', 'music_cut', 'cut_dry')

def log(*a): print(*a, flush=True)
fm = R.fm
def rng(seed): return np.random.default_rng(seed)
def nrm(y, pk=.5): return y / (np.abs(y).max() + 1e-12) * pk
def smooth01(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def db(x): return 20 * math.log10(max(float(x), 1e-20))

# =====================================================================================================================
# score (live) + fallbacks
# =====================================================================================================================
_SC = None
def score():
    """{dur, T, DUR, A, REAL, words, cues[{t, name, g, pan, d?}], music{…}, src}"""
    global _SC
    if _SC is not None: return _SC
    tm = {}
    if os.path.exists(TIMING_JSON):
        try: tm = json.load(open(TIMING_JSON))
        except Exception as e: log(f'[RU] WARNING data/timing.json unreadable ({e}): the score defaults')
    js = ("const S=require(%s);const o={T:S.T,DUR:S.DUR,A:S.A,REAL:S.REAL||null,N:S.N};"
          "o.cues=typeof S.soundCues==='function'?S.soundCues():null;o.music=typeof S.music==='function'?S.music():null;"
          "o.warn=typeof S.check==='function'?S.check():[];console.log(JSON.stringify(o))") % json.dumps(SCORE_JS)
    d, why = None, ''
    try:
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60, check=True, cwd=P)
        d = json.loads(r.stdout.strip().splitlines()[-1]); d['src'] = '01_score.js (live)'
    except Exception as e: why = f'node failed: {str(e)[:200]}'
    tdur = {k: v for k, v in (tm.get('dur') or {}).items() if isinstance(v, (int, float)) and v > 0}
    if WA and 'N6w' in tdur: tdur['N6'] = tdur['N6w']                 # the variant is timed on N6w (as 01_score.js)
    der = derive_score({**DUR0, **tdur}, tm.get('words', {}))
    if d:
        for k in ('cues', 'music', 'REAL'):
            if not d.get(k): d[k] = der[k]; d['src'] += f' + {k} derived in python ({k} missing in the score)'
        miss = [k for k in der['music'] if k not in d['music']]
        for k in miss: d['music'][k] = der['music'][k]
        if miss: d['src'] += f' + music keys derived: {miss}'
        for k, v in der['A'].items(): d['A'].setdefault(k, v)
    if d is None:
        try:
            j = json.load(open(CUES_DUMP))
            want = {**DUR0, **tdur}
            if all(abs(j['DUR'].get(k, -9) - v) < 1e-9 for k, v in want.items() if k in DUR0):
                d = j; d['src'] = f'audio/score_cues.json (last live read; {why})'
        except Exception: pass
    if d is None:
        d = der; d['src'] = f'python replica of the score ({why})'
    d['dur'] = float(d['T']['end']); d['words'] = tm.get('words', {}); d['timing'] = bool(tm)
    d['cues'] = sorted(d['cues'], key=lambda c: c['t'])
    if d['src'].startswith('01_score.js'):
        os.makedirs(os.path.dirname(CUES_DUMP), exist_ok=True)
        json.dump({k: d[k] for k in ('T', 'DUR', 'A', 'REAL', 'cues', 'music')}, open(CUES_DUMP, 'w'), indent=1)
    _SC = d
    return d

# the score's DEFAULT keys (§5.5 default column; DUR = 01_score.js DUR0)
T0 = dict(R1=0.0, N1=2.15, N2=4.55, N3=7.10, N4=9.65, R2=13.88, N5=16.10, R1b=20.60, N6=22.00, end=25.05)
DUR0 = dict(N1=1.67, N2=2.22, N3=1.25, N4=3.70, N5=4.10, N6=2.75)

def _deacc(s): return re.sub('[̀-ͯ]', '', unicodedata.normalize('NFD', str(s).lower()))
def _forms(w):
    r = _deacc(w); return [re.sub('[^a-z0-9]', '', r), re.sub('[^a-z0-9]', '', re.sub(r"^(?:[a-z]{1,2}|qu|jusqu)['’]", '', r))]
def find_word(words, i, prefix, nth=0):
    """the nth word {w, s, e} of line i starting with prefix ('a|b' = either prefix), exactly as 01_score.js word()"""
    ks = [k for k in (re.sub('[^a-z0-9]', '', _deacc(p)) for p in str(prefix).split('|')) if k]; c = 0
    for w in (words or {}).get(i) or []:
        if any(x.startswith(k) for x in _forms(w['w']) for k in ks):
            if c == nth: return w
            c += 1
    return None

def derive_score(DUR, words):
    """python replica of 01_score.js (§5.5 chain, REAL, soundCues(), music()) — used only when node or a function is
    missing. Mirrors the score line for line."""
    T = dict(T0); DUR = dict(DUR); a = {}
    cl = lambda x, lo, hi: max(lo, min(hi, x))
    END = lambda i: T[i] + DUR[i]
    SYL = lambda i, k, n: DUR[i] * k / n
    def W(i, p, nth=0, fb=0.0): w = find_word(words, i, p, nth); return T[i] + (w['s'] if w else fb)
    SEC = 1.0; TICK = lambda k: a['chrono0'] + k * SEC
    a['chrono0'] = 0.0; a['musicIn'] = TICK(2); a['stop'] = TICK(7)
    T['R1'] = 0.0; T['N1'] = a['musicIn'] + .15
    a['pan1'] = 2.90; a['pan1e'] = a['pan1'] + (3.40 - 2.90) / 2; a['pan2'] = a['pan1e'] + (4.90 - 3.40); a['pan2e'] = a['pan2'] + (5.60 - 4.90) / 2
    T['N2'] = cl(6.85 - DUR['N2'], END('N1') + .25, 4.55); a['hint'] = T['N2']
    T['N3'] = a['stop'] + .10; a['rew'] = END('N3'); a['splice'] = a['rew'] + .25; a['zoom'] = a['rew'] + .50; a['ring'] = a['zoom'] + .60
    T['N4'] = a['ring'] + .20; a['answer'] = a['ring'] + .15; a['hand'] = a['ring'] + .45
    a['arrow'] = W('N4', 'bonz', 0, SYL('N4', 2, 12)); a['pulse'] = W('N4', 'debut', 0, SYL('N4', 10, 12))
    a['out'] = END('N4') + .20; a['whip'] = a['out'] + .15; a['live'] = a['out'] + .25
    T['R2'] = a['live'] + (7.70 - 7.62); a['sub2'] = a['live'] + .05
    a['card'] = a['live'] + 2.00; a['plate'] = a['card'] + .15; T['N5'] = a['card'] + .30
    a['chine'] = W('N5', 'chin', 0, SYL('N5', 10, 14)); a['doua'] = W('N5', 'doua', 0, SYL('N5', 12, 14))
    a['route'] = T['N5'] + .35; a['by'] = T['N5'] + 1.40
    a['cta'] = END('N5') + .40; T['R1b'] = a['cta']; a['sub3'] = a['cta'] + .05; a['ctaFreeze'] = a['cta'] + (2.00 - .55)
    a['pill'] = a['cta'] + 1.25; T['N6'] = a['pill'] + .15; T['end'] = END('N6') + .30; a['end'] = T['end']
    a['stopPeel'] = a['rew'] + .10; a['question'] = a['stop'] + .15
    R6 = lambda x: round(x * 1e6) / 1e6
    T = {k: R6(v) for k, v in T.items()}; a = {k: R6(v) for k, v in a.items()}
    REAL = dict(R1=dict(id='R1', t=T['R1'], src=[0.00, 1.78], fadeIn=0, fadeOut=.06, speech=[T['R1'] + .60, T['R1'] + 1.70], text='Bonsoir, bonsoir.'),
                R2=dict(id='R2', t=T['R2'], src=[7.70, 9.60], fadeIn=.06, fadeOut=.08, speech=[T['R2'] + .02, T['R2'] + 1.87],
                        text='Merci de faire confiance à Bonzini Trading.'),
                R1b=dict(id='R1b', t=T['R1b'], src=[0.55, 1.78], fadeIn=.04, fadeOut=.06, speech=[T['R1b'] + .05, T['R1b'] + 1.15], text='Bonsoir, bonsoir.'))
    for r_ in REAL.values(): r_['end'] = R6(r_['t'] + r_['src'][1] - r_['src'][0]); r_['speech'] = [R6(x) for x in r_['speech']]
    a['sub1'] = REAL['R1']['speech'][0] + .15; a['sub1out'] = REAL['R1']['speech'][1] + .65
    Q = []
    def q(t, name, g=1, pan=0, d=None):
        if 0 <= t < T['end']:
            c = dict(t=round(t, 4), name=name, g=g, pan=pan)
            if d is not None: c['d'] = round(d, 4)
            Q.append(c)
    for k in range(7): q(TICK(k), 'tic_wood', 1.0 if k >= 5 else .6, .25)
    q(a['musicIn'] - .25, 'shaker_rise', .5, 0, .25)
    q(a['pan1'], 'whoosh', .6, -.4, a['pan1e'] - a['pan1'] + .1); q(a['pan2'], 'whoosh', .6, .4, a['pan2e'] - a['pan2'] + .1)
    q(a['stop'], 'stamp_big', 1, 0); q(a['stop'] + .02, 'buzzer_soft', .5)
    q(a['rew'], 'rewind', .8, 0, a['zoom'] - a['rew'])
    q(a['zoom'], 'swell_rise', .5, 0, a['ring'] - a['zoom']); q(a['ring'] - .02, 'focus_click', .6)
    q(a['ring'], 'bonzini_sig', 1, 0); q(a['ring'], 'felt', .5, 0, .40); q(a['arrow'], 'felt', .4, .1, .35)
    q(a['out'], 'whoosh_back', .6, 0, a['live'] - a['out'])
    q(a['card'], 'paper_lift', .7, 0); q(a['plate'], 'tonk', .8)
    q(a['route'], 'felt', .35, -.2, .5); q(a['chine'], 'pop', .45, -.25); q(a['chine'] + .03, 'felt', .3, -.2, .25)
    q(a['doua'], 'pop', .45, .25); q(a['doua'] + .03, 'felt', .3, .2, .25)
    q(a['pill'], 'pill_drop', .6, 0)
    mus = dict(bpm=120, beat=BEAT, grid0=a['musicIn'], ticks=[TICK(k) for k in range(7)], silentUntil=a['musicIn'],
               tenseFrom=a['musicIn'], cut=a['stop'], sigAt=a['ring'], majorFrom=a['plate'], motifAt=R6(a['cta'] - .45),
               end=a['cta'], voiceEndN5=R6(END('N5')), noMusic=[[REAL['R2']['t'], REAL['R2']['end']], [a['cta'], T['end']]],
               duck=dict(narrator=12), streetOnlyFrom=R6(T['end'] - .30))
    return dict(T=T, DUR=DUR, A=a, REAL=REAL, cues=sorted(Q, key=lambda c: c['t']), music=mus, N=int(round(T['end'] * 30)), warn=[])

# =====================================================================================================================
# narrator lines (data/takes.json, placed ON the score's T)
# =====================================================================================================================
def voice_lines(sc):
    """[{id, file, at, stretch, on, off, words}] — speech start `on` of the chosen take placed at T[id]; [] if no takes"""
    if not os.path.exists(TAKES_JSON): return [], f'no takes file ({TAKES_JSON}): built WITHOUT narrator'
    try: takes = json.load(open(TAKES_JSON))
    except Exception as e: return [], f'takes file unreadable ({e}): built WITHOUT narrator'
    try: vc = json.load(open(VOCHECK_JSON))
    except Exception: vc = {}
    out, miss = [], []
    for i in ('N1', 'N2', 'N3', 'N4', 'N5', 'N6'):
        src = 'N6w' if (i == 'N6' and '--n6w' in sys.argv) else i
        tk = takes.get(src)
        if not tk or i not in sc['T'] or not os.path.exists(os.path.join(R.VO_DIR, tk.get('file', ''))): miss.append(src); continue
        on, off = float(tk['on']), float(tk['off'])
        st = float(tk.get('stretch', 1.0))         # takes.json « stretch »: the take played × st slower (make_timing.py scales dur/words alike)
        out.append(dict(id=i, take=src, file=tk['file'], at=sc['T'][i] - on * st, stretch=st, on=on, off=off,
                        words=[w for w in vc.get(tk['file'], {}).get('words', []) if w['e'] > w['s'] and any(ch.isalnum() for ch in w['w'])]))
    msg = f'{len(out)} narrator lines from {os.path.relpath(TAKES_JSON, P)}' + (f' (missing: {miss})' if miss else '')
    return out, msg

# =====================================================================================================================
# the REAL voice (audio48.wav spans only)
# =====================================================================================================================
_RUSH = {}
def rush_mono():
    if 'y' not in _RUSH:
        import soundfile as sf
        y, sr = sf.read(RUSH_WAV); assert sr == SR, sr
        _RUSH['y'] = (y.mean(1) if y.ndim > 1 else y).astype(float)
    return _RUSH['y']

def span(a, b):
    """exactly the samples of rush seconds [a, b) — the ONLY way this file reads the rush"""
    y = rush_mono(); i, j = ns(a), min(len(y), ns(b))
    _RUSH.setdefault('read', []).append((round(a, 4), round(b, 4)))
    return y[i:j].copy()

STFT = dict(nperseg=2048, noverlap=2048 - 256, window='hann')
def noise_profile(REAL):
    """per-bin 20th percentile of |X| over the played spans (street dominates the quiet frames)"""
    import scipy.signal as sps
    if 'noise' not in _RUSH:
        mags = []
        for k in ('R1', 'R2'):
            if k in REAL: _, _, X = sps.stft(span(*REAL[k]['src']), SR, **STFT); mags.append(np.abs(X))
        _RUSH['noise'] = np.percentile(np.concatenate(mags, 1), 20, axis=1) + 1e-9
    return _RUSH['noise']

def spectral_gate(x, noise, max_db=GATE_MAX_DB, lo_db=3.0, hi_db=12.0):
    """light STFT gate: a bin <= lo_db over the noise floor loses max_db, >= hi_db loses nothing (linear in between),
    smoothed over 5 bins x 3 frames; zero-padded at the edges (nothing outside the span leaks in); timing unchanged"""
    import scipy.signal as sps
    _, _, X = sps.stft(x, SR, boundary='zeros', padded=True, **STFT)
    snr = 20 * np.log10(np.abs(X) / noise[:, None] + 1e-12)
    att = np.clip((hi_db - snr) / (hi_db - lo_db), 0, 1) * max_db
    att = np.clip(uniform_filter(att, size=(5, 3), mode='nearest'), 0, max_db)
    _, y = sps.istft(X * 10 ** (-att / 20), SR, boundary=True, **STFT)
    return y[:len(x)], float(att.max()), float(att.mean())

def zp_eq(x):
    """HP 120 Hz (2nd-order Butterworth run forward + backward) and +2.5 dB presence at 3 kHz (half gain, forward +
    backward): zero-phase, the words do not move by a sample"""
    import scipy.signal as sps
    y = sps.sosfiltfilt(sps.butter(2, REAL_HP, 'hp', fs=SR, output='sos'), x)
    b, a = R.dsp._rbj('peak', PRES_F, .9, PRES_DB / 2)
    return sps.filtfilt(b, a, y)

def kms(x):
    """K-weighted mean square, as LUFS (a mono signal as it is placed in the mix: centre-panned, -3 dB per channel)"""
    y = dsp.kweight(panst(x, 0) if x.ndim == 1 else x)
    return 10 * math.log10(float(np.mean(np.sum(y ** 2, 1))) + 1e-20) - .691

def real_extracts(sc):
    """{rid: dict(sig = mono film signal (gain + fades), t, raw, proc, gain_db, gate_max_db, ...)} + the street level"""
    REAL = sc['REAL']; noise = noise_profile(REAL); out = {}
    for k, r_ in REAL.items():
        raw = span(*r_['src']); g, gmax, gmean = spectral_gate(raw, noise)
        proc = zp_eq(g)
        a, b = ns(r_['speech'][0] - r_['t']), ns(r_['speech'][1] - r_['t'])
        out[k] = dict(id=k, t=float(r_['t']), src=list(r_['src']), raw=raw, proc=proc, gate_max_db=gmax, gate_mean_db=gmean,
                      L_speech=kms(proc[max(0, a):b]), fadeIn=float(r_.get('fadeIn', 0)), fadeOut=float(r_.get('fadeOut', 0)),
                      speech=list(r_['speech']), end=float(r_['end']), text=r_.get('text', ''))
    base = out['R1'] if 'R1' in out else next(iter(out.values()))
    g1 = REAL_LUFS - base['L_speech']
    for k, e in out.items():
        gd = g1 if k in ('R1', 'R1b') else float(np.clip(REAL_LUFS - e['L_speech'], g1 - REAL_SPREAD_DB, g1 + REAL_SPREAD_DB))
        fi = e['fadeIn']
        if e['t'] < 1e-6: fi = max(fi, .025)                         # film frame 0 = the loop seam: 25 ms, no click
        y = e['proc'] * dsp.undb(gd); n = len(y)
        if fi > 0: k_ = ns(fi); y[:k_] *= np.sin(np.linspace(0, np.pi / 2, k_)) ** 2
        if e['fadeOut'] > 0: k_ = ns(e['fadeOut']); y[n - k_:] *= np.cos(np.linspace(0, np.pi / 2, k_)) ** 2
        e.update(sig=y, gain_db=gd, fade_in_used=fi)
    st = base['proc'][:ns(max(.05, min(.55, base['speech'][0] - base['t'] - .05)))]   # R1 before « Bonsoir »: the street
    street = kms(st) + g1
    return out, street

# =====================================================================================================================
# the street bed (periodic, no voice)
# =====================================================================================================================
def street_shape(N):
    """magnitude response on rfftfreq(N): sqrt of the mean spectrum (Welch) of r 0.00-0.50, 1/3-octave smoothed"""
    import scipy.signal as sps
    f, Pw = sps.welch(span(0.0, 0.50), SR, nperseg=4096)
    lf = np.log2(np.maximum(f, 1)); sm = np.empty_like(Pw)
    for i in range(len(f)): sm[i] = Pw[np.abs(lf - lf[i]) <= 1 / 6].mean()
    fN = np.fft.rfftfreq(N, 1 / SR)
    mag = np.sqrt(np.interp(fN, f, sm)) * (fN > 30) / (1 + (fN / 9000) ** 6)
    return mag, fN

def far_scooter(dur=2.8, seed=7101):
    """a far electric scooter passing (no engine: motor whine + its harmonics, a faint PWM whistle, tyre hiss), Doppler
    ±2.5 %, distance law, air absorption, panned L -> R"""
    n = ns(dur); t = tt(n); x = (t - dur / 2) / .55
    near = 1 / (1 + x ** 2)
    dop = 1 - .025 * np.tanh(x)
    ph = 2 * np.pi * np.cumsum(305 * dop) / SR
    wh = (np.sin(ph) * .5 + .30 * np.sin(2 * ph + .7) + .14 * np.sin(3 * ph + 1.9) + .07 * np.sin(5 * ph + .3)) * .35
    pwm = np.sin(2 * np.pi * np.cumsum(2150 * dop) / SR) * .03
    tyre = bp(nz(n, seed), 900, .7) * .5 + bp(nz(n, seed + 1), 2600, .9) * .2 + dsp.lp(nz(n, seed + 2), 160) * .4
    y = (wh + pwm + tyre * .6) * near
    y = dsp.tv_biquad(y, 'lp', 1800 + 3200 * near, .707)
    y *= np.clip(t / .3, 0, 1) * np.clip((dur - t) / .3, 0, 1)
    return panst(y / (np.abs(y).max() + 1e-9), .6 * np.tanh(x))

def bed_profile(N, sc):
    """gain (dB re the street of R1) — key points from the score, cos² ramps between them"""
    T, A_, REAL, mp = sc['T'], sc['A'], sc['REAL'], sc['music']; end = sc['dur']; xf = BED['xfade']
    u, h, lo, cd, ct, e = BED['under_real'], BED['hunt'], BED['low'], BED['card'], BED['cta'], BED['edge']
    END = lambda i: T[i] + sc['DUR'][i]
    pts = [(0.0, e), (.15, u)]
    r1, r2, r1b = REAL.get('R1'), REAL.get('R2'), REAL.get('R1b')
    if r1: pts += [(r1['end'] - .09, u), (r1['end'] - .09 + xf, 0.0)]             # the 150-ms crossfade at r 1.78
    pts += [(mp['tenseFrom'] - .05, 0.0), (T['N1'], h)]                           # the street recedes under the music hit
    pts += [(A_['stop'], h), (A_['stop'] + .15, lo)]                              # STOP: « fond de rue bas »
    if r2: pts += [(A_['out'], lo), (r2['t'] - .03, u), (r2['end'] - .08, u), (A_['card'] + .20, cd)]
    if r1b: pts += [(r1b['t'] - .05, cd), (r1b['t'] + .03, u), (r1b['end'] - .09, u), (T['N6'], ct)]
    pts += [(mp.get('streetOnlyFrom', end - .30), ct), (end, e)]                   # the last .3 s: the street alone, back up
    pts = sorted(pts, key=lambda p: p[0]); clean = [pts[0]]
    for p in pts[1:]:
        if p[0] > clean[-1][0] + 1e-6: clean.append(p)
    t = np.arange(N) / SR; g = np.full(N, clean[-1][1])
    for (t0, g0), (t1, g1) in zip(clean, clean[1:]):
        m = (t >= t0) & (t < t1); g[m] = g0 + (g1 - g0) * smooth01((t[m] - t0) / (t1 - t0))
    g[t < clean[0][0]] = clean[0][1]
    return g, clean

def street_bed(N, sc, street_lufs, seed=7001):
    """the replacement street: EXACTLY periodic (circular FFT, swell in whole cycles) + one far scooter; level = the
    street of R1 as played, then the profile. Returns (bed (N, 2), profile dB, key points, scooter centre)"""
    dur = N / SR; mag, fN = street_shape(N); t = np.arange(N) / SR
    sh = lambda s: np.fft.irfft(np.fft.rfft(nz(N, s)) * mag, N)
    c, d1, d2 = sh(seed), sh(seed + 1), sh(seed + 2)
    lo = lambda x: np.fft.irfft(np.fft.rfft(x) * (fN < 400), N)                      # circular split: stays periodic
    swell = 1 + .30 * np.sin(2 * np.pi * 2 * t / dur + 1.1) + .15 * np.sin(2 * np.pi * 5 * t / dur + .4)   # slow traffic
    out = np.zeros((N, 2))
    for ch, dd in enumerate((d1, d2)):
        x = c + .30 * dd; xl = lo(x); out[:, ch] = xl * swell + (x - xl) * (1 + .4 * (swell - 1))
    out *= dsp.undb(street_lufs - kms(out))
    T, DUR = sc['T'], sc['DUR']
    tc = (T['N1'] + DUR['N1'] + T['N2']) / 2 if all(k in T for k in ('N1', 'N2')) else 4.2   # the gap between N1 and N2
    sc_ = far_scooter(); i0 = ns(tc - len(sc_) / SR / 2)
    lvl = np.sqrt(np.mean(out[i0:i0 + len(sc_)] ** 2)) * dsp.undb(1.0)               # peak about the bed's RMS: far
    out[i0:i0 + len(sc_)] += sc_ * lvl / (np.sqrt(np.mean(sc_ ** 2)) + 1e-12) * .55
    g, pts = bed_profile(N, sc)
    return out * dsp.undb(g)[:, None], g, pts, tc

# =====================================================================================================================
# event list (cut = None or (t_cut, fade): the event dies at t_cut, its reverb return included)
# =====================================================================================================================
class Mix:
    def __init__(self, dur): self.dur = dur; self.ev = []
    def put(self, stem, sig, t, g=1.0, pan=0.0, cut=None, tag=None, fade=True):
        sig = np.array(sig, float)
        if fade: sig = tail_fade(sig)
        if t < 0: sig = sig[ns(-t):]; t = 0.0
        self.ev.append((stem, sig, float(t), float(g), float(pan), cut, tag))

# =====================================================================================================================
# small synthesis helpers (ep2)
# =====================================================================================================================
def stick_slip(n, rate, seed, amp=(.4, 1.0)):
    r = rng(seed); rate = np.broadcast_to(np.asarray(rate, float), (n,))
    ph = np.cumsum(np.maximum(rate, 1.0)) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[0] = 1.0; imp[idx] = r.uniform(*amp, len(idx))
    return imp

def wander(n, seed, scale, hz=8.0):
    x = dsp.onepole_lp(rng(seed).standard_normal(n), hz); x = x - x.mean()
    return x / (np.abs(x).max() + 1e-12) * scale

def thud(f_hi, f_lo, tau_f, tau, n, drive=1.0):
    t = tt(n); return np.sin(2 * np.pi * np.cumsum(f_lo + (f_hi - f_lo) * np.exp(-t / tau_f)) / SR) * np.exp(-t / tau) * drive

def hollow(t, seed, modes=((175, 1, .04), (262, .6, .03), (410, .35, .02)), glide=None):
    return R._modes(t, 1.0, modes, seed, glide)

def tick(f, seed, n=None): return R._click(f, seed, n)

# =====================================================================================================================
# SFX (all synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0)
# =====================================================================================================================
def sfx_tic_wood(seed=801, k=0, loud=False):
    """the chrono's soft wooden tic (a beat of the makossa): the series' wood knock, tic / tac alternating, the last two
    (« 2 », « 1 » in orange) heavier: a lower body and a brighter click"""
    f = 1250.0 if k % 2 == 0 else 1100.0
    y = A.wood(f * (.92 if loud else 1.0), seed, 1.0)
    if loud:
        n = len(y); t = tt(n)
        y = y + .45 * np.sin(2 * np.pi * 520 * t) * np.exp(-t / .03) + .18 * np.sin(2 * np.pi * 3300 * t) * np.exp(-t / .006)
    return nrm(y)

def sfx_shaker_rise(dur=.25, seed=811):
    """a little shaker rise into the music's downbeat: strokes every 32nd at 120 BPM, seed-cloud floor growing,
    cut dead at the end (the makossa hit takes it)"""
    dur = max(.1, dur); n = ns(dur); u = tt(n) / dur
    env = grains(n, 1.0, seed, .0011, (.3, 1), shape=200 + 600 * u ** 1.3)
    y = dsp.hp(bp(nz(n, seed + 1) * env, 6500, .8) + .35 * bp(nz(n, seed + 2) * env, 2400, 1.1), 1800) * .5
    step = BEAT / 8
    for k in range(int(dur / step + 1e-9)):
        place(y, A.rattle(seed + 10 + k, .04, 1.0, .9 + .4 * k * step / dur) * (.6 + .4 * (k % 2 == 0)), ns(k * step))
    y = y * (.35 + .65 * u ** 1.4)
    y[-ns(.003):] *= np.linspace(1, 0, ns(.003))
    return nrm(y)

def sfx_whoosh(seed, dur=.32, p0=-.5, p1=.5, lo=350, hi=3200, flap=.6, peak=.3):
    """a paper / air whoosh: band and level peaking at `peak` x dur then dying away, panned along its path, a flick at
    its start (ep2)"""
    dur = max(.12, dur); n = ns(dur); t = tt(n); u = t / dur
    sh = np.where(u < peak, (u / peak) ** 1.5, np.exp(-(u - peak) / (.28 * (1 - peak))))
    w = dsp.tv_biquad(nz(n, seed), 'bp', lo + (hi - lo) * sh, .9) * np.maximum(sh, .25 * np.minimum(1, t / .004))
    w = w / (np.abs(w).max() + 1e-9) * np.clip((dur - t) / .02, 0, 1)
    f = I.paper(seed + 1); f = f / (np.abs(f).max() + 1e-9) * flap
    y = w.copy(); y[:len(f)] += f[:n]
    return panst(y, p0 + (p1 - p0) * smooth01(u)) * .5

def sfx_stamp_big(seed=671):
    """the STOP stamp: the series' stamp doubled (rubber + table thud + paper slap), a chest thump with a short sub, a dead
    body; above 160 Hz a hit, not a tail (N3 « Stop ! » starts 100 ms later) (ep2)"""
    n = ns(1.2); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    s = I.stamp(seed + 1); y[:len(s)] += s * .7
    y += dsp.softclip(thud(110, 40, .03, .16, n, 1.6), 1.3) * .9
    y += hollow(t, seed + 2, ((140, 1, .07), (215, .7, .05), (330, .45, .035))) * .5
    tk = dsp.hp(nz(ns(.003), seed + 3), 3000) * np.linspace(1, 0, ns(.003)) * .8; y[:len(tk)] += tk
    lo, hi = dsp.zp_split(y, 160, 2)
    y = lo + hi * np.where(t < .05, 1.0, np.exp(-(t - .05) / .07))
    y *= np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_buzzer_soft(seed=821, dur=.22):
    """a soft « wrong / time's up » buzzer: two detuned pulse tones (146 / 151 Hz) through a warm low-pass, a 31-Hz
    flutter, quick attack, short decay — under the stamp, out of « Stop ! »'s way"""
    n = ns(dur); t = tt(n)
    y = sum(dsp.pulse(f, n, .35) for f in (146.0, 151.0)) * .5
    y = dsp.lp(dsp.lp(y, 1500), 1500) * (1 + .25 * np.sin(2 * np.pi * 31 * t))
    y += .25 * np.sin(2 * np.pi * 73 * t)
    y *= np.minimum(1, t / .005) * np.exp(-t / .16) * np.clip((dur - t) / .04, 0, 1)
    return nrm(y)

def sfx_rewind_tape(src, dur, seed=301):
    """the rewind under the picture (r 7.60 -> 5.70 | 2.80 -> 1.00): a tape reading the HUNT'S MAKOSSA backwards (never the
    rush), fast, a short spin-up with the picture, then braking to a stop on the landing (the pitch falls: « hauteur qui
    descend »); transport whine following the speed, tape hiss, a clack at the start, the release clunk at the end"""
    dur = max(.2, dur); n = ns(dur); t = tt(n); u = t / dur
    rate = np.where(u < .35, 9 + 3 * np.sin(np.pi / 2 * u / .35), .15 + 11.85 * np.cos(np.pi / 2 * np.clip((u - .35) / .65, 0, 1)) ** 1.6)
    rate = rate * (1 + .02 * np.sin(2 * np.pi * 9 * t))
    src = np.asarray(src, float)
    if len(src) < ns(.2): src = nz(ns(3.0), seed + 7) * .1                          # no music rendered: noise-fed
    pos = np.clip(len(src) - 1 - np.cumsum(rate), 0, len(src) - 1)
    y = np.interp(pos, np.arange(len(src)), src)
    y = dsp.lp(dsp.hp(y, 300), 6000)
    y = y / (np.abs(y).max() + 1e-9) * (.55 + .45 * np.sin(np.pi * np.clip(u / .4, 0, 1) / 2)) * np.minimum(1, t / .006)
    y += np.sin(2 * np.pi * np.cumsum(170 * rate) / SR) * .10 * (.4 + .6 * rate / 12)
    y += dsp.tv_biquad(nz(n, seed), 'bp', 1500 + 300 * rate, 1.2) * .07
    y[-ns(.006):] *= np.linspace(1, 0, ns(.006))
    out = np.zeros(n + ns(.25)); out[:n] += y
    c = A.sfx_tap(seed); out[:len(c)] += c * .9
    cl = A.sfx_setdown(seed + 1); out[n:n + len(cl)] += cl[:len(out) - n] * .5
    return out / (np.abs(out).max() + 1e-9) * .6

def sfx_swell_rise(dur, seed=831):
    """« souffle montant » under the push x1 -> x4: breath of air, band rising 380 Hz -> 5 kHz, level rising from a
    defined start, stopped just before the focus click"""
    dur = max(.15, dur - .015); n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 380 * (5000 / 380) ** (u ** .9), 1.3) * (.30 + .70 * u ** 1.6)
    y += dsp.tv_biquad(nz(n, seed + 1), 'bp', 7000, 1.0) * .12 * u ** 2
    y *= np.minimum(1, t / .004); y[-ns(.012):] *= np.linspace(1, 0, ns(.012))
    return nrm(y)

def sfx_focus_click(seed=841):
    """the lens finds focus: a crisp double « tk-tk » (9 ms apart) of a small mechanism, a tiny body"""
    out = np.zeros(ns(.08))
    for k, (dt, f, a) in enumerate(((0, 3600, 1.0), (.009, 4300, .6))):
        c = tick(f, seed + k, ns(.03)); place(out, c * a, ns(dt))
    out[:ns(.03)] += thud(900, 600, .003, .006, ns(.03)) * .25
    return nrm(out)

def sfx_felt(seed=501, dur=.36, squeak=1.0, attack=.012):
    """a felt-tip pen drawn on (the ellipse, the arrow, the route): fibre friction + the intermittent squeak (ep2)"""
    dur = max(.08, dur); n = ns(dur); t = tt(n); r = rng(seed)
    env = np.minimum(1, t / attack) * np.clip((dur - t) / .07, 0, 1) * (.75 + .25 * np.sin(2 * np.pi * 3 * t + r.uniform(0, 6)))
    fric = dsp.butter(nz(n, seed), 'bp', [1800, 6500], 2)
    gr = grains(n, 160, seed + 1, .003, (.2, 1)); fric *= .55 + .45 * gr / (gr.max() + 1e-9)
    imp = stick_slip(n, 950 * (1 + wander(n, seed + 2, .07, 12)), seed + 3, (.6, 1))
    sq = bp(imp, 2300, 9) + .6 * bp(imp, 3600, 10)
    gate = np.clip(dsp.onepole_lp((rng(seed + 4).random(n // 480 + 1) > .45).repeat(480)[:n].astype(float), 40), 0, 1)
    sq = sq / (np.abs(sq).max() + 1e-9) * gate * squeak
    y = (fric / (np.abs(fric).max() + 1e-9) * .8 + sq * .6) * env
    y[:ns(.003)] += bp(nz(ns(.003), seed + 5), 3000, 1) * np.linspace(1, 0, ns(.003)) * .8
    return nrm(y)

def sfx_carton_creak(seed=411, dur=.5):
    n = ns(dur); t = tt(n); u = t / dur
    rate = 30 + 12 * np.sin(2 * np.pi * 1.7 * t + .5) + wander(n, seed, 10, 6)
    imp = stick_slip(n, rate, seed + 1)
    body = sum(a * bp(imp, f, q) for f, q, a in ((190, 3.5, 1.0), (430, 4.5, .8), (820, 5, .55), (1500, 5, .35), (2600, 4, .2)))
    fib = bp(nz(n, seed + 2), 2400, .8) * np.convolve(imp, ex(ns(.012), .003))[:n] * .02
    y = (body + fib) * np.minimum(1, t / .002) * (.6 + .4 * np.sin(np.pi * u)) * np.clip((dur - t) / .08, 0, 1)
    return nrm(y)

def sfx_paper_lift(seed=511, dur=.45):
    """the kraft sheet rises over the picture: a short paper creak, the sheet's air (« fwoo », rising), the edge's
    rustle (ep2)"""
    n = ns(dur); t = tt(n); u = t / dur
    y = np.zeros(n); c = sfx_carton_creak(seed, .25); y[:len(c)] += c * .8
    y += dsp.tv_biquad(nz(n, seed + 1), 'bp', 500 * (2400 / 500) ** u, 1.2) * np.sin(np.pi * u) ** 1.5 * .35
    y += bp(nz(n, seed + 2), 4200, .9) * grains(n, 300, seed + 3, .001, (.2, 1), shape=np.sin(np.pi * u)) * .5
    y[:ns(.003)] += bp(nz(ns(.003), seed + 4), 2500, 1) * np.linspace(1, 0, ns(.003)) * .6
    return nrm(y)

def sfx_pill_drop(seed=611):
    """the amber pill « Réponds-lui en commentaire » pops in: a soft pop, then its bounce settling on the picture"""
    y = np.zeros(ns(.4)); p = I.pop(seed); p = p / (np.abs(p).max() + 1e-9); y[:len(p)] += p
    s = A.sfx_setdown(seed + 1); place(y, s / np.abs(s).max() * .45, ns(.10))
    s = A.sfx_setdown(seed + 2); place(y, s / np.abs(s).max() * .18, ns(.17))
    return nrm(y)

# =====================================================================================================================
# music
# =====================================================================================================================
TENSE_PROG = [('F#m', [66, 69, 73, 78], 42), ('D', [66, 69, 74, 78], 50), ('E7', [64, 68, 71, 74], 52)]

def compose_tense(M, mp):
    """the tense F#m makossa from music().tenseFrom (a downbeat) to music().cut: F#m | D | E7 (left hanging), level
    'tense'; from ticks[5] (« monte d'un cran ») + skank, shaker 8ths, congas, four-on-the-floor and a riser into the cut"""
    t0, cut = mp['tenseFrom'], mp['cut']; bt = mp.get('beat', BEAT) or BEAT; bar = 4 * bt
    ticks = mp.get('ticks') or []
    climb = ticks[5] if len(ticks) > 5 and t0 + bt <= ticks[5] < cut - bt else None
    CUT = (cut, .004)
    nb = max(1, int(math.ceil((cut - t0) / bar - 1e-9)))
    for b in range(nb):
        tb = t0 + b * bar; ch = TENSE_PROG[min(b, len(TENSE_PROG) - 1)]; name, tones, root = ch
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if t0 - 1e-6 <= t < cut - 1e-6: M.put('groove', sig, t, g * G_TENSE, p, cut=CUT, tag=('tense', _b))
        mk.groove(put, tb, b, beat=bt, level='tense', prog=[ch] * 4)
        for j in range(16):
            tj = tb + j * bt / 4 + (.012 if j % 2 else 0.0); hot = climb is not None and tj >= climb - 1e-6
            if hot and mk.RHY[j]: put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4000 + 16 * b + j, mute=1), tj, .16, -.45)
            if j % 2 == 0 and (hot or j % 4 == 2): put(A.rattle(4100 + 16 * b + j, .045, .9, 1.0), tj, (.22 if j % 4 == 0 else .15) if hot else .12, .35)
            if hot and j % 4 == 2: put(A.conga(62 if j % 8 == 2 else 57, 4300 + 16 * b + j, slap=j % 8 == 6), tj, .40, -.3)
        for q in range(4):
            tq = tb + q * bt
            if climb is not None and tq >= climb - 1e-6 and q % 2 == 1: put(mk.kick(), tq, .55)
    tag = 'music_in'                                                                   # the dry drop ON the downbeat
    M.put('groove', mk.kick(), t0, .65 * G_TENSE, 0, cut=CUT, tag=tag)
    M.put('groove', I.stab([m - 12 for m in TENSE_PROG[0][1]], .20, 1.0), t0, .60 * G_TENSE, 0, cut=CUT, tag=tag)
    M.put('groove', mk.bass(m2f(TENSE_PROG[0][2] - 12), .45, .8), t0, .50 * G_TENSE, 0, cut=CUT, tag=tag)
    M.put('groove', A.clap(4500), t0, .30 * G_TENSE, -.1, cut=CUT, tag=tag)
    if climb is not None:
        tag = 'climb'
        ch = TENSE_PROG[min(int((climb - t0) // bar), len(TENSE_PROG) - 1)]
        M.put('groove', mk.kick(), climb, .5 * G_TENSE, 0, cut=CUT, tag=tag)
        M.put('groove', I.stab([m - 12 for m in ch[1]], .14, 1.0), climb, .40 * G_TENSE, 0, cut=CUT, tag=tag)
        d = min(1.6, cut - climb); n = ns(d + .1); u = np.clip(tt(n) / d, 0, 1)        # riser into the cut, killed by the gate
        M.put('groove', dsp.tv_biquad(nz(n, 4600), 'bp', 900 * 7 ** u, 2.0) * u ** 1.8 * .6, cut - d, .30 * G_TENSE, 0, cut=CUT, tag=tag)
    return dict(a=t0, cut=cut, climb=climb, beat=bt, bars=nb)

def compose_major(M, mp):
    """A-major full makossa from music().majorFrom (the plate) to music().motifAt, where the band stops: the beat is
    stretched (.45-.58 s) so the stop lands ON a downbeat; last bar = E (V) before the guitar's « bon-soir »"""
    a = mp['majorFrom']; stop = mp.get('motifAt', mp['end'] - .45)
    sp = stop - a; k = max(4, int(round(sp / BEAT))); bt = sp / k if .45 <= sp / k <= .58 else BEAT
    nb = max(1, int(math.ceil(sp / (4 * bt) - 1e-9)))
    seq = [mk.PROG[b % 2] for b in range(nb)]
    if nb >= 2: seq[-1] = mk.PROG[2]
    CUT = (stop, .025)
    for b in range(nb):
        tb = a + 4 * bt * b
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if t < stop - 1e-6: M.put('groove', sig, t, g * G_MAJOR, p, cut=CUT, tag='major_in' if (_b == 0 and t - a < .02) else ('major', _b))
        mk.groove(put, tb, b, beat=bt, level='full', prog=[seq[b]] * 4)
        name, tones, root = seq[b]
        for j in range(16):
            tj = tb + j * bt / 4 + (.012 if j % 2 else 0.0)
            if j % 2 == 0: put(A.rattle(5300 + 16 * b + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
            if j in (6, 14): put(A.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * b + j, .6), tj, .16, -.4)
            if j % 8 == 4: put(A.conga(64 if j == 4 else 59, 5500 + 16 * b + j, slap=j == 12), tj, .30, -.3)
    tag = 'major_in'                                                                   # the arrival with the violet plate
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), a, 1.0 * G_MAJOR, 0, cut=CUT, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], min(2.2, sp), 1.0), a, .55 * G_MAJOR, 0, cut=CUT, tag=tag)
    M.put('groove', mk.kick(), a, .5 * G_MAJOR, 0, cut=CUT, tag=tag)
    M.put('brand', A.sfx_shimmer(5600, .5), a, .22 * G_MAJOR, 0, cut=CUT, tag=tag)
    return dict(a=a, stop=stop, beat=bt, bars=nb, chords=[s[0] for s in seq])

# « bon-soir, bon-soir »: (offset in a .45-s window, MIDI, slide in cents on the tail) — the man's contour (R1, pyin):
# each « bon-soir » rises, the second higher, its « -soir » falling ~3.5 st (131 -> 107 Hz): up, up, the last sliding down
MOTIF = ((0.00, 69, 0), (0.10, 73, -60), (0.21, 73, 0), (0.31, 76, -300))

def compose_motif(M, mp):
    """the guitar ALONE from music().motifAt: 2 + 2 notes, choked at music().end (the cut to the man's real voice)"""
    t0, t1 = mp.get('motifAt', mp['end'] - .45), mp['end']; k = (t1 - t0) / .45
    CUT = (t1, .012); notes = []
    for j, (off, m, cents) in enumerate(MOTIF):
        y = mk.guitar(m2f(m), .6, bright=.72, decay=.996, seed=6600 + j)
        if cents: y = A.bend(y, cents, .045, .16)
        t = t0 + off * k
        M.put('motif', y, t, (.80, .85, 1.05, .90)[j % 4] * G_MAJOR * 2.2, -.15 + .1 * j, cut=CUT, tag=('motif', j)); notes.append((t, m, cents))
    return dict(a=t0, end=t1, notes=notes)

# =====================================================================================================================
# compose everything
# =====================================================================================================================
def first(cues, name, after=-1.0, before=1e9):
    return next((c['t'] for c in cues if c['name'] == name and after < c['t'] < before), None)

def compose(sc, lines):
    T, DUR, cues, mp, A_ = sc['T'], sc['dur'], sc['cues'], sc['music'], sc['A']
    M = Mix(DUR); plan = {}
    # ---- narrator --------------------------------------------------------------------------------------------------
    vinfo = []
    for v in lines:
        y, t0, on, off, info = R.voice_line(v)
        M.put('vox', y, t0, 1.0, 0.0, tag=('vox', v['id']), fade=False)
        vinfo.append(dict(v, sig_len=len(y) / SR, t0=t0, t1=t0 + len(y) / SR, film_on=on, film_off=off, **info))
    # ---- the real voice ---------------------------------------------------------------------------------------------
    real, street = real_extracts(sc)
    for k, e in real.items(): M.put('real', e['sig'], e['t'], 1.0, 0.0, tag=('real', k), fade=False)
    plan['real'] = {k: {x: e[x] for x in ('t', 'src', 'gain_db', 'gate_max_db', 'gate_mean_db', 'L_speech', 'fadeIn', 'fadeOut', 'fade_in_used', 'end')}
                    for k, e in real.items()}
    plan['street_lufs'] = street
    # ---- music ------------------------------------------------------------------------------------------------------
    plan['tense'] = compose_tense(M, mp)
    plan['major'] = compose_major(M, mp)
    plan['motif'] = compose_motif(M, mp)
    sig_cut = (A_.get('out', mp['sigAt'] + 3.5), .03)                                 # the signature dies with the dezoom
    # ---- the street bed ---------------------------------------------------------------------------------------------
    bed, gprof, pts, tsc = street_bed(ns(DUR), sc, street)
    M.put('amb', bed, 0.0, 1.0, fade=False, tag='bed'); plan['bed'] = dict(points=pts, scooter=tsc, levels=BED)
    # ---- cues -------------------------------------------------------------------------------------------------------
    unknown = []; ntic = 0
    for i, c in enumerate(cues):
        t, name, g, pan = c['t'], c['name'], c.get('g', 1), c.get('pan', 0); tag = ('cue', i); sd = 7000 + 37 * i
        d = c.get('d')
        Pp = lambda stem, sig, gain, p=pan, fade=True, cut=None: M.put(stem, sig, t, gain, p, tag=tag, fade=fade, cut=cut)
        if name == 'tic_wood': Pp('tic', sfx_tic_wood(sd, ntic, g >= .99), 1.25 * g, pan); ntic += 1     # a beat: 6-dB duck, no bus clip
        elif name == 'shaker_rise': Pp('sfx', sfx_shaker_rise(d or (mp['tenseFrom'] - t)), .42 * g / .5, 0)
        elif name == 'whoosh':
            dd = d or .35; p0 = .5 if pan < 0 else -.5
            Pp('sfx', sfx_whoosh(sd, dd, p0, -p0, 380, 3400, .5, .35), .30 * g / .6, 0)
        elif name == 'stamp_big': Pp('hit', sfx_stamp_big(), .95 * g, 0)
        elif name == 'buzzer_soft': Pp('sfx', sfx_buzzer_soft(), .30 * g / .5, 0)
        elif name == 'rewind':
            src = R.render_tag(M, lambda e: e[0] == 'groove' and e[5] is not None and abs(e[5][0] - mp['cut']) < 1e-9, mp['tenseFrom'], mp['cut'])
            Pp('sfx', sfx_rewind_tape(src, d or .5), .40 * g / .8, 0); plan['rewind'] = dict(fed='the hunt makossa (dry), read backwards', t=t, d=d or .5)
        elif name == 'swell_rise': Pp('sfx', sfx_swell_rise(d or .6), .20 * g / .5, 0)
        elif name == 'focus_click': Pp('sfx', sfx_focus_click(), .55 * g / .6, 0)
        elif name == 'bonzini_sig':                                                    # the series signature, unchanged
            M.put('sig', A.balafon_bright(88, 5800, 1.2), t, .17 * g, -.15, cut=sig_cut, tag=tag)
            M.put('sig', A.balafon_bright(92, 5801, 1.0), t + SIG_GAP, .18 * g, .15, cut=sig_cut, tag=tag)
            M.put('sig', A._bell(m2f(100), .8, .3, 1, .002) * .5, t + SIG_GAP, .06 * g, .15, cut=sig_cut, tag=tag)
            plan['sig'] = (t, t + SIG_GAP)
        elif name == 'felt': Pp('sfx', sfx_felt(sd, d or .36), .20 * g / .45, pan)
        elif name == 'whoosh_back':
            dd = d or .25; pk = float(np.clip(((A_.get('whip', t + .6 * dd)) - t) / dd, .2, .8))
            Pp('sfx', sfx_whoosh(sd, dd, .5, -.5, 330, 3000, .45, pk), .30 * g / .6, 0)
        elif name == 'paper_lift': Pp('sfx', sfx_paper_lift(), .30 * g / .7, .1)
        elif name == 'tonk': Pp('sfx', R.sfx_tonk(), .40 * g / .8, 0)
        elif name == 'pop': Pp('sfx', I.pop(sd), .36 * g / .45, pan)
        elif name == 'pill_drop': Pp('sfx', sfx_pill_drop(), .40 * g / .6, 0)
        elif name in ('music_cut', 'cut_dry'): pass                                    # the gates (mixdown)
        else:                                                                          # a cue added later by the picture team
            fam = next((k for k in ('whoosh', 'stamp', 'pop', 'tic', 'felt', 'marker', 'paper', 'click', 'buzz', 'swell', 'rise')
                        if k in name), None)
            sig = {'whoosh': lambda: sfx_whoosh(sd, d or .32), 'stamp': lambda: sfx_stamp_big(sd), 'pop': lambda: I.pop(sd),
                   'tic': lambda: sfx_tic_wood(sd), 'felt': lambda: sfx_felt(sd, d or .3), 'marker': lambda: sfx_felt(sd, d or .3),
                   'paper': lambda: sfx_paper_lift(sd), 'click': lambda: sfx_focus_click(sd), 'buzz': lambda: sfx_buzzer_soft(sd),
                   'swell': lambda: sfx_swell_rise(d or .5, sd), 'rise': lambda: sfx_swell_rise(d or .5, sd)}.get(fam)
            if sig:
                stem = 'hit' if fam == 'stamp' else 'sfx'; Pp(stem, sig(), (.6 if fam == 'stamp' else .25) * g)
                unknown.append(f'{name}~{fam}')
            else: unknown.append(name)
    return M, vinfo, real, unknown, plan

# =====================================================================================================================
# render + mix + master
# =====================================================================================================================
def gate(N, t_cut, t_on=None, fade=.004):
    """1 before t_cut (raised-cosine fade ending exactly at t_cut), 0 after (until t_on if given)"""
    g = np.ones(N); a, b = ns(t_cut - fade), min(N, ns(t_cut))
    if b > a: g[a:b] = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2
    g[b:N if t_on is None else min(N, ns(t_on))] = 0
    return g

def render(M, sc, fx=True):
    DUR = sc['dur']; N = ns(DUR + TAIL); raw = {}
    for stem, sig, t, g, p, c, tag in M.ev:
        k = (stem, c)
        if k not in raw: raw[k] = np.zeros((N, 2))
        R.place_at(raw[k], R.stereo_of(sig, g, p), ns(t))
    ir = R.irs(); out = {}; dry_vox = np.zeros((N, 2))
    for (stem, c), x in raw.items():
        if stem == 'vox': dry_vox = dry_vox + x
        s = SENDS.get(stem)
        if s and fx: x = x + dsp.reverb(x, ir[s[0]], wet=s[1])
        if c is not None: x = x * gate(N, c[0], fade=c[1])[:, None]                    # reverb returns die with it
        out[stem] = out.get(stem, 0) + x
    for k in ('vox', 'real', 'amb') + MUSIC + ('sfx', 'hit', 'tic'):
        if k not in out: out[k] = np.zeros((N, 2))
    return out, dry_vox

def mixdown(st, dry_vox, sc, spans, nar_spans, plan):
    """stems -> ducked stems + premaster (N = DUR exactly). The music masks (head, STOP hole, after the end, the real
    voices) and the street-only tail are applied AFTER every filter, so they are digital silence"""
    DUR = sc['dur']; N = ns(DUR); mp, A_ = sc['music'], sc['A']
    d1, act = R.duck_db(dry_vox[:N], spans)
    d2, _ = R.duck_db(dry_vox[:N], nar_spans, look=.05, att=.02, rel=.06, hold=.05)   # the motif: back as soon as « Douala » ends
    st = {k: v[:N].copy() for k, v in st.items()}
    for k, depth in DUCKED.items(): st[k] *= dsp.undb(d1 * depth)[:, None]
    st['motif'] *= dsp.undb(d2 * DUCK_DB)[:, None]
    so = mp.get('streetOnlyFrom', DUR - .30)
    d3, _ = R.duck_db(dry_vox[:N], nar_spans)                                          # the street: narrator only, slow,
    rel = 1 - smooth01((np.arange(N) / SR - so) / .2)                                   # fully released before the loop point
    st['amb'] *= dsp.undb(d3 * rel * BED_DUCK_DB)[:, None]
    for k in ('groove', 'brand'): st[k] = R.carve(st[k], d1, CARVE_DB)
    t = np.arange(N) / SR
    band = np.ones(N); band[:ns(mp['tenseFrom'])] = 0                                  # nothing before the drop
    band *= gate(N, mp['cut'], t_on=mp['majorFrom'], fade=.004)                       # the STOP hole (until the plate)
    band *= gate(N, mp['end'], fade=.012)                                              # nothing after the motif
    sigm = np.zeros(N); sigm[ns(mp['sigAt']):ns(A_.get('out', mp['sigAt'] + 3.5))] = 1.0
    noreal = np.ones(N)
    for a, b in mp.get('noMusic', []): noreal[ns(a):ns(b)] = 0
    for r_ in sc['REAL'].values(): noreal[ns(r_['t']):ns(r_['end'])] = 0              # never music under a real voice
    for k in BAND: st[k] *= (band * noreal)[:, None]
    st['sig'] *= (sigm * noreal)[:, None]
    tailg = np.ones(N); m = t >= so                                                    # the last .3 s: the street alone
    tailg[m] = np.cos(np.pi / 2 * np.clip((t[m] - so) / max(.05, DUR - .08 - so), 0, 1)) ** 2
    for k in st:
        if k != 'amb': st[k] *= tailg[:, None]
    music = sum(st[k] for k in MUSIC)
    Pm = A.sclip(music, .7) + st['sfx'] + A.sclip(st['hit'], .5) + st['tic'] + st['amb'] + st['vox'] + st['real']
    plan['masks'] = dict(band_from=mp['tenseFrom'], hole=[mp['cut'], mp['majorFrom']], band_end=mp['end'],
                         sig=[mp['sigAt'], A_.get('out')], street_only_from=so)
    return st, Pm, d1, act

def master_loop(Pm, target=-14.0, ceiling=-1.3):
    """HP 28 Hz + true-peak limiter on the premaster tiled x3, the middle copy kept (steady state across the loop seam);
    gain iterated until the middle copy reads `target` LUFS"""
    import pyloudnorm as pyln
    meter = pyln.Meter(SR); N = len(Pm)
    P3 = dsp.butter(np.concatenate([Pm, Pm, Pm]), 'hp', 28, 2)
    g = target - meter.integrated_loudness(P3[N:2 * N])
    for _ in range(10):
        Y3, gl3 = dsp.limiter(P3 * dsp.undb(g), ceiling_db=ceiling, lookahead=.003, release=.08)
        Y, gl = Y3[N:2 * N], gl3[N:2 * N]
        L = meter.integrated_loudness(Y)
        if abs(L - target) < .02: break
        g += target - L
    return Y, g, gl

# =====================================================================================================================
# checks
# =====================================================================================================================
def xcorr_lag(a, b, maxlag=480):
    """lag (samples) of the max cross-correlation of b against a, searched in ±maxlag (300-3400 Hz band)"""
    import scipy.signal as sps
    sos = sps.butter(4, [300, 3400], 'bandpass', fs=SR, output='sos')
    a = sps.sosfiltfilt(sos, a); b = sps.sosfiltfilt(sos, b); n = min(len(a), len(b)); a, b = a[:n], b[:n]
    c = sps.correlate(b, a, mode='full', method='fft'); mid = n - 1
    w = c[mid - maxlag:mid + maxlag + 1]; k = int(np.argmax(w)) - maxlag
    return k, float(w.max() / (np.sqrt(np.sum(a ** 2) * np.sum(b ** 2)) + 1e-20))

def f0_compare(raw, proc, a, b):
    """pyin (70-220 Hz: a male voice, no octave jump) on the same frames of the raw span and the processed one:
    medians over the frames voiced in both and the median of the frame-by-frame ratio (a speed or pitch change shows here)"""
    import librosa
    tr = lambda x: librosa.pyin(x[a:b].astype(np.float32), fmin=70, fmax=220, sr=SR, frame_length=4096, hop_length=480)
    f1, v1, _ = tr(raw); f2, v2, _ = tr(proc); both = v1 & v2
    if not both.any(): return None, None, None, 0
    return float(np.median(f1[both])), float(np.median(f2[both])), float(np.median(f2[both] / f1[both])), int(both.sum())

def click_ratio(x, t, w=.004, ctx=.10):
    """max |Δx| within ±w of t over the 99.5th percentile of |Δx| in the ±ctx around it (a click reads >> 1.5)"""
    m = x.mean(1) if x.ndim > 1 else x; d = np.abs(np.diff(m)); i = ns(t)
    a, b = max(0, i - ns(w)), min(len(d), i + ns(w)); A0, B0 = max(0, i - ns(ctx)), min(len(d), i + ns(ctx))
    ref = np.concatenate([d[A0:a], d[b:B0]])
    return float(d[a:b].max() / (np.percentile(ref, 99.5) + 1e-12)) if len(ref) and b > a else None

HALLUC = re.compile(r"amara|sous-titr|abonnez|merci d'avoir regard", re.I)   # Whisper's stock hallucinations on noise
def asr_bed(bed, windows, model='small'):
    """the weak ASR (listen_test.py's settings: phone band-pass 300-7000 Hz, normalised, faster-whisper small, no context,
    no VAD) on the street bed ALONE: every window must give no word"""
    import scipy.signal as sps
    from faster_whisper import WhisperModel
    Mw = WhisperModel(model, device='cpu', compute_type='int8', cpu_threads=2)
    sos = sps.butter(4, [300, 7000], 'bandpass', fs=SR, output='sos'); out = []
    for a, b in windows:
        y = bed[ns(a):ns(b)]; y = y.mean(1) if y.ndim > 1 else y; y = sps.sosfiltfilt(sos, y)
        y16 = sps.resample_poly(y, 1, 3); y16 = (y16 / (np.abs(y16).max() + 1e-9) * .9).astype(np.float32)
        segs, _ = Mw.transcribe(y16, language='fr', word_timestamps=True, beam_size=1, condition_on_previous_text=False, vad_filter=False)
        segs = list(segs)
        sg = [dict(a=round(a + sg_.start, 2), b=round(a + sg_.end, 2), text=sg_.text.strip(), no_speech=round(sg_.no_speech_prob, 2),
                   logprob=round(sg_.avg_logprob, 2), words=[(round(a + w.start, 2), w.word.strip(), round(w.probability, 2)) for w in (sg_.words or [])],
                   halluc=bool(sg_.no_speech_prob >= .5 or HALLUC.search(sg_.text))) for sg_ in segs]
        out.append(dict(win=[a, b], words=[w for x in sg if not x['halluc'] for w in x['words']], flagged=[x['text'] for x in sg if x['halluc']],
                        text=' '.join(x['text'] for x in sg), segs=sg))
    return out

def cue_level(M, tag, G):
    evs = [e for e in M.ev if e[6] == tag]
    if not evs: return None
    t0 = min(e[2] for e in evs); t1 = max(e[2] + len(e[1]) / SR for e in evs)
    buf = np.zeros((ns(t1 - t0) + ns(.45), 2))
    for e in evs: R.place_at(buf, R.stereo_of(e[1], e[3], e[4]), ns(e[2] - t0))
    _, lm = dsp.lufs_momentary(buf * G, .02)
    return float(np.max(lm)) if len(lm) else None

def build(sheet=None):
    import soundfile as sf, pyloudnorm as pyln
    try:
        if os.nice(0) < 5: os.nice(5 - os.nice(0))
    except Exception: pass
    sc = score(); T, DUR, mp, A_ = sc['T'], sc['dur'], sc['music'], sc['A']; N = ns(DUR)
    lines, vmsg = voice_lines(sc)
    log(f'[RU] score: {sc["src"]} · timing.json {"yes" if sc["timing"] else "NO (defaults)"} · {len(sc["cues"])} cues · DUR {DUR} s · '
        f'music {json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in mp.items() if not isinstance(v, (list, dict))})}')
    if sc.get('warn'): log('[RU] score warnings:', sc['warn'])
    log(f'[RU] narrator: {vmsg}')
    M, vinfo, real, unknown, plan = compose(sc, lines)
    if unknown: log('[RU] WARNING cue names without a dedicated sound:', unknown)
    log(f'[RU] {len(M.ev)} events · rendering')
    st, dry_vox = render(M, sc)
    nar_spans = [(v['film_on'], v['film_off']) for v in vinfo]
    spans = nar_spans + [tuple(r_['speech']) for r_ in sc['REAL'].values()]
    st, Pm, d1, act = mixdown(st, dry_vox, sc, spans, nar_spans, plan)
    Y, g, gl = master_loop(Pm); tp = R.true_peak_db(Y); ceil = -1.3
    while tp > -1.0 and ceil > -3:
        ceil -= (tp + 1.0) + .05; Y, g, gl = master_loop(Pm, ceiling=ceil); tp = R.true_peak_db(Y)
    assert len(Y) == N
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'vox': st['vox'], 'real': st['real'], 'music': sum(st[k] for k in MUSIC), 'sfx': st['sfx'], 'hits': A.sclip(st['hit'], .5) + st['tic'], 'amb': st['amb']}
    for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    # ---------------- checks ----------------
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    loopZ = np.concatenate([Z[-ns(.5):], Z[:ns(.5)]])
    rep = dict(sr=sr, n=len(Z), dur=len(Z) / sr, frames_30fps=len(Z) / sr * 30, channels=Z.shape[1], master_gain_db=g, limiter_ceiling_db=ceil,
               lufs=meter.integrated_loudness(Z), tp_dbtp=R.true_peak_db(Z), tp_seam_dbtp=R.true_peak_db(loopZ),
               sample_peak_db=db(np.abs(Z).max()), max_gr_db=float(-20 * np.log10(gl.min())), clipped=int((np.abs(Z) >= .9999).sum()),
               src=sc['src'], timing=sc['timing'], narrator=vmsg, narrator_lines=len(vinfo), lra=R.lra(Z),
               dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())], unknown=unknown, score_warn=sc.get('warn', []))
    mus = stems['music'] * G; band = sum(st[k] for k in BAND) * G; sigs = st['sig'] * G
    vox = stems['vox'] * G; realS = stems['real'] * G; rest = (stems['sfx'] + stems['hits'] + stems['amb']) * G
    # cues
    rows = []
    for i, c in enumerate(sc['cues']):
        t, name = c['t'], c['name']
        o, _ = R.iso_onset(M, ('cue', i))
        if o is None: rows.append(dict(t=t, name=name, kind='-', on=None, err=None, mix=None, mix_err=None, lvl=None, note='no event')); continue
        f = A.flux_onset(Z, t)
        rows.append(dict(t=t, name=name, kind='alone', on=o, err=(o - t) * 1000, mix=f, mix_err=None if f is None else (f - t) * 1000,
                         lvl=cue_level(M, ('cue', i), G), note=c.get('note', '')))
    anchors = [('music_in', mp['tenseFrom'], 'music().tenseFrom: the dry drop'), ('climb', plan['tense']['climb'], 'ticks[5]: « monte d\'un cran »'),
               ('major_in', mp['majorFrom'], 'music().majorFrom: A major + violet pad')]
    anchors += [(('motif', j), tn, f'motif note {j + 1} (MIDI {m}{", slide " + str(cn) + " c" if cn else ""})') for j, (tn, m, cn) in enumerate(plan['motif']['notes'])]
    for tag, tref, note in anchors:
        if tref is None: continue
        o, _ = R.iso_onset(M, tag)
        if o is None: continue
        f = A.flux_onset(Z, tref)
        rows.append(dict(t=tref, name=tag if isinstance(tag, str) else f'motif_{tag[1] + 1}', kind='alone', on=o, err=(o - tref) * 1000, mix=f,
                         mix_err=None if f is None else (f - tref) * 1000, lvl=cue_level(M, tag, G), note=note))
    if plan.get('sig'):
        s2 = plan['sig'][1]; f = A.flux_onset(Z, s2)
        rows.append(dict(t=s2, name='sig note 2', kind='placed', on=s2, err=0.0, mix=f, mix_err=None if f is None else (f - s2) * 1000, lvl=None, note='G#6, SIG_GAP after E6'))
    em = R.env_db(mus)
    def music_off(t):
        pre = em[max(0, ns(t - .3)):ns(t - .01)].max()
        nzi = np.nonzero(em[ns(t - .3):ns(t + .2)] > pre * 1e-3)[0]
        return (ns(t - .3) + int(nzi.max())) / SR if len(nzi) else None
    for t_, nm, nt in ((mp['cut'], 'music_cut', 'TOTAL cut under the STOP stamp'), (plan['major']['stop'], 'band_stop', 'the band stops: guitar alone'),
                       (mp['end'], 'music_end', 'the motif choked: cut to R1b')):
        x = band if nm != 'band_stop' else sum(st[k] for k in ('groove', 'brand')) * G
        e_ = R.env_db(x); pre = e_[max(0, ns(t_ - .3)):ns(t_ - .01)].max(); nzi = np.nonzero(e_[ns(t_ - .3):ns(t_ + .2)] > pre * 1e-3)[0]
        off = (ns(t_ - .3) + int(nzi.max())) / SR if len(nzi) else None
        rows.append(dict(t=t_, name=nm, kind='off -60dB', on=off, err=None if off is None else (off - t_) * 1000, mix=None, mix_err=None, lvl=None, note=nt))
    rep['cues'] = rows
    rep['cues_ok'] = all(r['err'] is not None and abs(r['err']) <= 15 for r in rows)
    # music silence windows (digital)
    mx = lambda x, a, b: float(np.abs(x[ns(a):ns(b)]).max()) if ns(b) > ns(a) else 0.0
    sil = [dict(win='head [0, tenseFrom)', a=0.0, b=mp['tenseFrom'], band=mx(band, 0, mp['tenseFrom']), sig=mx(sigs, 0, mp['tenseFrom'])),
           dict(win='STOP hole [cut, sigAt)', a=mp['cut'], b=mp['sigAt'], band=mx(band, mp['cut'], mp['sigAt']), sig=mx(sigs, mp['cut'], mp['sigAt'])),
           dict(win='answer [sigAt, out) band only', a=mp['sigAt'], b=A_['out'], band=mx(band, mp['sigAt'], A_['out']), sig=None),
           dict(win='[out, majorFrom)', a=A_['out'], b=mp['majorFrom'], band=mx(band, A_['out'], mp['majorFrom']), sig=mx(sigs, A_['out'], mp['majorFrom'])),
           dict(win='after end [end, T.end)', a=mp['end'], b=DUR, band=mx(band, mp['end'], DUR), sig=mx(sigs, mp['end'], DUR))]
    for k, r_ in sc['REAL'].items():
        sil.append(dict(win=f'under {k} [{r_["t"]:.2f}, {r_["end"]:.2f})', a=r_['t'], b=r_['end'], band=mx(band, r_['t'], r_['end']), sig=mx(sigs, r_['t'], r_['end'])))
    rep['music_silence'] = sil
    rep['music_silence_ok'] = all(s['band'] == 0.0 and (s['sig'] in (None, 0.0)) for s in sil)
    # the real voice: untouched (length, lag, pitch), in the mix at its place
    rrows = []
    for k, e in real.items():
        n = len(e['raw']); lag, cc = xcorr_lag(e['raw'], e['proc'])
        a, b = ns(e['speech'][0] - e['t']), ns(e['speech'][1] - e['t'])
        f_raw, f_pro, f_rat, nv = f0_compare(e['raw'], e['proc'], a, b)
        i0 = ns(e['t']); mixed = realS[i0:i0 + n].mean(1) / G
        lag2, cc2 = xcorr_lag(e['sig'], mixed)
        rrows.append(dict(id=k, film=[e['t'], e['end']], src=e['src'], samples=n, samples_expected=ns(e['src'][1]) - ns(e['src'][0]),
                          lag_proc=lag, corr_proc=cc, lag_mix=lag2, corr_mix=cc2, f0_raw=f_raw, f0_proc=f_pro, voiced_frames=nv,
                          f0_ratio=f_rat, gain_db=e['gain_db'], gate_max_db=e['gate_max_db'],
                          gate_mean_db=e['gate_mean_db'], fade_in=e['fade_in_used'], fade_out=e['fadeOut'],
                          speech_lufs=float(dsp.lufs_integrated(realS[ns(e['speech'][0]):ns(e['speech'][1])])) if ns(e['speech'][1]) > ns(e['speech'][0]) else None))
    rep['real'] = rrows
    rep['rush_spans_read'] = sorted(set(map(tuple, _RUSH.get('read', []))))
    srcs = [tuple(e['src']) for e in real.values()]
    rep['never_played_ok'] = all((b <= 1.78 + 1e-9 or a >= 7.70 - 1e-9) and any(a >= x0 - 1e-9 and b <= x1 + 1e-9 for x0, x1 in srcs)
                                 for a, b in rep['rush_spans_read'])
    rep['real_ok'] = all(r_['samples'] == r_['samples_expected'] and r_['lag_proc'] == 0 and r_['lag_mix'] == 0 and
                         (r_['f0_ratio'] is None or abs(r_['f0_ratio'] - 1) < .006) and r_['gate_max_db'] <= GATE_MAX_DB + 1e-9 for r_ in rrows)
    # splices / seam
    spl = []; ra = realS + stems['amb'] * G                                             # the street's continuity
    for k, r_ in sc['REAL'].items():
        if r_['t'] > 1e-6: spl.append((f'{k} in', r_['t'], ra, 'real + bed'))
        spl.append((f'{k} out', r_['end'], ra, 'real + bed'))
    spl += [('band stop', plan['major']['stop'], sum(st[k] for k in ('groove', 'brand')) * G, 'band stem'),
            ('motif end', mp['end'], st['motif'] * G, 'motif stem'), ('music end', mp['end'], Z, 'mix')]
    rep['splices'] = [dict(name=nm, t=t_, on=on_, ratio=click_ratio(x_, t_)) for nm, t_, x_, on_ in spl]
    beds = (stems['amb'] + stems['real'] + stems['vox'] + stems['music'] + stems['sfx']) * G           # all but the t = 0 tic (a cue ON frame 0)
    loopB = np.concatenate([beds[-ns(.5):], beds[:ns(.5)]])
    rep['seam'] = dict(step=float(np.abs(Z[0] - Z[-1]).max()), local_p99=float(np.percentile(np.abs(np.diff(Z[-ns(.03):], axis=0)), 99)),
                       ratio=click_ratio(loopB, .5), ratio_mix=click_ratio(loopZ, .5),
                       note='ratio = the mix without the hits stem (the chrono tic at 0.00 is a cue ON the loop point); ratio_mix includes it')
    rep['clicks_ok'] = all((s['ratio'] or 0) < 2.0 for s in rep['splices']) and rep['seam']['ratio'] < 2.0
    # voices (narrator) vs everything
    vrows = []; prev = None
    if vinfo: vox_ph, oth_ph = R.phone(vox), R.phone(mus + rest + realS)
    for v in vinfo:
        a, b = ns(v['film_on']), ns(v['film_off'])
        pm = R.kpow(mus, a, b); no_music = pm < 1e-12
        margin = None if no_music else 10 * math.log10(R.kpow(vox, a, b) / pm)
        margin_all = 10 * math.log10(R.kpow(vox, a, b) / R.kpow(mus + rest + realS, a, b))
        phone = 10 * math.log10(R.kpow(vox_ph, a, b) / R.kpow(oth_ph, a, b))
        wm = []
        for w in v['words']:
            wa = ns(v['at'] + max(w['s'], v['on']) * v['stretch']); wb = ns(v['at'] + min(w['e'], v['off']) * v['stretch'])
            if wb - wa > ns(.04): wm.append((w['w'], 10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus, wa, wb)),
                                            10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus + rest + realS, wa, wb))))
        vrows.append(dict(id=v['id'], take=v['take'], file=v['file'], on=v['film_on'], off=v['film_off'], T=T.get(v['id']), margin=margin, no_music=no_music,
                          margin_all=margin_all, phone=phone, word_min=min((x[1] for x in wm), default=None), word_min_all=min((x[2] for x in wm), default=None),
                          word_worst=min(wm, key=lambda x: x[2])[0] if wm else None, gap=None if prev is None else v['film_on'] - prev['film_off'],
                          lufs=float(dsp.lufs_integrated(vox[ns(v['t0']):ns(v['t1'])])), words_m=wm))
        prev = v
    rep['voices'] = vrows
    allsp = sorted([(v['film_on'], v['film_off'], v['id']) for v in vinfo] + [(r_['speech'][0], r_['speech'][1], k) for k, r_ in sc['REAL'].items()])
    rep['voices_overlap'] = [f'{x[2]}/{y[2]}' for x, y in zip(allsp, allsp[1:]) if y[0] < x[1] - 1e-6]
    rep['voices_ok'] = (not rep['voices_overlap']) and all(r_['no_music'] or r_['margin'] >= 10 for r_ in vrows)
    rep['duck_max_db'] = float(-d1.min() * DUCK_DB)
    # the bed
    amb = stems['amb'] * G
    rep['bed'] = dict(points=plan['bed']['points'], levels=BED, scooter=plan['bed']['scooter'], street_lufs_prem=plan['street_lufs'],
                      rms_db={nm: db(np.sqrt(np.mean(amb[ns(a):ns(b)] ** 2))) for nm, a, b in
                              (('hunt', T['N1'], mp['cut']), ('stop+answer', mp['cut'], A_['out']), ('card', A_['card'] + .3, A_['cta'] - .1),
                               ('cta', T['N6'], DUR - .3), ('last .3 s', DUR - .3, DUR))},
                      r1_street_rms_db=db(np.sqrt(np.mean(realS[:ns(.5)] ** 2))))
    if '--no-asr' not in sys.argv:
        log('[RU] ASR (faster-whisper small) on the street bed alone …')
        try:
            rep['bed']['asr'] = asr_bed(amb, [(sc['REAL']['R1']['end'] if 'R1' in sc['REAL'] else 1.78, mp['cut']), (mp['cut'], A_['live']), (0.0, DUR)])
            rep['bed']['asr_ok'] = all(not w['words'] for w in rep['bed']['asr'])
            rep['bed']['asr_control'] = asr_bed(realS, [(r_['t'], r_['end']) for r_ in sc['REAL'].values()])   # the same ASR DOES hear words
        except Exception as e: rep['bed']['asr'] = f'failed: {e}'; rep['bed']['asr_ok'] = None
    # report
    plan_out = {k: v for k, v in plan.items() if k != 'real'}
    rep['plan'] = plan_out
    json.dump(rep, open(os.path.join(OUT_A, 'audio_report.json'), 'w'), indent=1, default=lambda o: o.tolist() if hasattr(o, 'tolist') else str(o))
    log(f'[RU] mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s ({rep["frames_30fps"]:.2f} frames) @ {sr} Hz x{rep["channels"]} · {rep["lufs"]:.2f} LUFS · '
        f'TP {rep["tp_dbtp"]:.2f} dBTP (across the seam {rep["tp_seam_dbtp"]:.2f}) · sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · '
        f'master {g:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB (ceiling {ceil:.2f}) · clipped {rep["clipped"]}')
    log('[RU] cues (alone = the cue\'s own events rendered alone, 10 % of the max of a 1-ms envelope; mix = spectral-flux onset in mix.wav; LUFS-M = the cue alone, post master gain)')
    for r_ in rows:
        log(f'    {r_["t"]:7.3f}  {r_["name"]:13s} {r_["kind"]:9s} {fm(r_["err"], "+6.1f", "   -  ", " ms")}   mix {fm(r_["mix_err"], "+6.1f", "   -  ", " ms")}'
            f'   {fm(r_["lvl"], "6.1f", "    - ", " LUFS-M")}  {r_["note"]}')
    log(f'[RU] cues within 15 ms: {rep["cues_ok"]}')
    log(f'[RU] tense {plan["tense"]["a"]:.2f}-{plan["tense"]["cut"]:.2f} climb {plan["tense"]["climb"]} · major {plan["major"]["a"]:.2f}-{plan["major"]["stop"]:.2f} '
        f'beat {plan["major"]["beat"]:.4f} {plan["major"]["chords"]} · motif {[(round(t_, 3), m) for t_, m, _ in plan["motif"]["notes"]]} -> {plan["motif"]["end"]:.2f}')
    log('[RU] music digital silence: ' + ' · '.join(f'{s["win"]} band {s["band"]:.1e}' + (f' sig {s["sig"]:.1e}' if s['sig'] is not None else '') for s in sil)
        + f' -> {rep["music_silence_ok"]}')
    log('[RU] real voice (lag = x-corr of the processed extract vs the raw source, mix = vs the placed stem; f0 = pyin median on the speech span)')
    for r_ in rrows:
        log(f'    {r_["id"]:3s} film {r_["film"][0]:6.3f}-{r_["film"][1]:6.3f} src r {r_["src"][0]:.2f}-{r_["src"][1]:.2f} · {r_["samples"]} samples '
            f'(= {r_["samples_expected"]}) · lag {r_["lag_proc"]} / mix {r_["lag_mix"]} (corr {r_["corr_proc"]:.3f} / {r_["corr_mix"]:.3f}) · f0 '
            f'{fm(r_["f0_raw"], ".1f")} -> {fm(r_["f0_proc"], ".1f")} Hz (x{fm(r_["f0_ratio"], ".4f")}) · gain {r_["gain_db"]:+.1f} dB · gate max '
            f'{r_["gate_max_db"]:.1f} dB (mean {r_["gate_mean_db"]:.1f}) · fades {r_["fade_in"] * 1000:.0f}/{r_["fade_out"] * 1000:.0f} ms · speech {fm(r_["speech_lufs"], ".1f")} LUFS')
    log(f'[RU] rush spans read: {rep["rush_spans_read"]} · r 1.78-7.70 never played: {rep["never_played_ok"]} · real voice untouched: {rep["real_ok"]}')
    log('[RU] splices (click ratio, < 2 = no click): ' + ' · '.join(f'{s["name"]} {s["t"]:.3f}: {fm(s["ratio"], ".2f")}' for s in rep['splices'])
        + f' · loop seam {rep["seam"]["ratio"]:.2f} without the tic at 0.00 ({rep["seam"]["ratio_mix"]:.2f} with it) · step {rep["seam"]["step"]:.4f} vs p99 {rep["seam"]["local_p99"]:.4f}')
    if vrows:
        log('[RU] narrator')
        for r_ in vrows:
            log(f'    {r_["id"]:3s} {r_["file"]:10s} speech {r_["on"]:7.3f}-{r_["off"]:7.3f} (T {r_["T"]}) · over music '
                f'{"no music" if r_["no_music"] else format(r_["margin"], "5.1f") + " dB"} (worst word {fm(r_["word_min"], ".1f")}) · over all '
                f'{r_["margin_all"]:5.1f} dB (worst {r_["word_worst"]} {fm(r_["word_min_all"], ".1f")}) · phone band {r_["phone"]:5.1f} dB · gap {fm(r_["gap"], ".3f")} · {r_["lufs"]:.1f} LUFS')
            if '--words' in sys.argv: log('        ' + ' '.join(f'{w}[{a:+.0f}/{b:+.0f}]' for w, a, b in r_['words_m']))
    else: log('[RU] narrator: NONE in this mix (no takes)')
    log(f'[RU] voices overlap: {rep["voices_overlap"] or "none"} · duck {rep["duck_max_db"]:.1f} dB + carve {CARVE_DB:.0f} dB')
    b_ = rep['bed']
    log(f'[RU] street bed: R1 street {b_["r1_street_rms_db"]:.1f} dBFS RMS · bed ' + ' · '.join(f'{k} {v:.1f}' for k, v in b_['rms_db'].items())
        + f' dBFS RMS · scooter at {b_["scooter"]:.2f} s')
    if isinstance(b_.get('asr'), list):
        for w in b_['asr']: log(f'    ASR bed {w["win"][0]:.2f}-{w["win"][1]:.2f}: words {w["words"] or "none"}' + (f' · flagged as Whisper\'s no-speech hallucination: {w["flagged"]} '
                                f'(no_speech {[x["no_speech"] for x in w["segs"] if x["halluc"]]})' if w['flagged'] else ''))
        log(f'[RU] bed ASR: no word on 1.78-7.00, 7.00-13.80 and the whole film: {b_["asr_ok"]}')
        for w in b_.get('asr_control', []): log(f'    control (same ASR, real-voice stem {w["win"][0]:.2f}-{w["win"][1]:.2f}): « {w["text"]} »')
    log(f'[RU] loop seam (end -> start): step {rep["seam"]["step"]:.4f} vs local p99 {rep["seam"]["local_p99"]:.4f}')
    if sheet: make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, sheet if isinstance(sheet, str) else SHEET)
    return rep

# =====================================================================================================================
# sheet
# =====================================================================================================================
def make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, path=SHEET):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    T, DUR, mp, cues, A_ = sc['T'], sc['dur'], sc['music'], sc['cues'], sc['A']
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#120d1e', 'figure.facecolor': '#0b0814', 'text.color': '#e8e2f4',
                         'axes.labelcolor': '#e8e2f4', 'xtick.color': '#b9b0cc', 'ytick.color': '#b9b0cc', 'axes.edgecolor': '#3a3050'})
    fig = plt.figure(figsize=(22, 30), dpi=100)
    fig.subplots_adjust(top=.935, bottom=.01, left=.045, right=.965)
    gs = fig.add_gridspec(7, 12, height_ratios=[3.2, 1.0, 2.3, 1.6, 1.7, 1.9, 2.2], hspace=.55, wspace=.5)
    hot = {'stamp_big': '#ff5a5a', 'buzzer_soft': '#ff8a3a', 'rewind': '#7fffd4', 'bonzini_sig': '#b48cff', 'tonk': '#b48cff',
           'tic_wood': '#ffd84a', 'focus_click': '#7fffd4', 'swell_rise': '#7fffd4'}
    ccol = lambda nm: hot.get(nm, '#9fe08a')
    xt = np.arange(0, DUR + .01, 1.0); m = Z.mean(1)
    REAL = sc['REAL']
    def marks(ax, labels=False):
        ax.axvspan(mp['cut'], mp['majorFrom'], color='#3ee0ff', alpha=.05)
        for r_ in REAL.values(): ax.axvspan(r_['t'], r_['end'], color='#ff7ad9', alpha=.07)
        for c in cues: ax.axvline(c['t'], ymin=.94 if labels else 0, ymax=1, color=ccol(c['name']), lw=.9, alpha=.9 if labels else .2)
    def spec(ax, x, a0, a1, nper, top_pct, rng_db, fl):
        f, t, S_ = sps.stft(x, SR, nperseg=nper, noverlap=nper - nper // 16)
        Pw = 20 * np.log10(np.abs(S_) + 1e-9); rr = np.interp(fl, f, np.arange(len(f))); Pi = Pw[np.round(rr).astype(int)]; top = np.percentile(Pi, top_pct)
        ax.pcolormesh(t + a0, fl, Pi, vmin=top - rng_db, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(fl[0], fl[-1]); ax.set_xlim(a0, a1)
    # 1 spectrogram
    ax = fig.add_subplot(gs[0, :])
    spec(ax, m, 0, DUR, 4096, 99.8, 85, np.geomspace(30, 18000, 420)); ax.set_xticks(xt); ax.set_ylabel('Hz')
    ax.set_title('mix.wav — log spectrogram · cue ticks + names (top) · speech spans (bottom bars: pink = REAL voice, white = narrator) · '
                 'pink bands = real-voice extracts · cyan = no band music (STOP -> plate)', loc='left', pad=78)
    marks(ax, True)
    for c in cues: ax.text(c['t'], 19500, c['name'], rotation=90, fontsize=6.2, va='bottom', ha='center', color=ccol(c['name']))
    for v in vinfo:
        ax.plot([v['film_on'], v['film_off']], [36, 36], color='#e8e2f4', lw=6, solid_capstyle='butt'); ax.text((v['film_on'] + v['film_off']) / 2, 41, v['id'], ha='center', fontsize=8, color='w')
    for k, r_ in REAL.items():
        ax.plot(r_['speech'], [36, 36], color='#ff7ad9', lw=6, solid_capstyle='butt'); ax.text(sum(r_['speech']) / 2, 41, k, ha='center', fontsize=8, color='#ff7ad9')
    lab = [(0, 'R1 real street + voice · no music'), (mp['tenseFrom'], 'TENSE F#m makossa'), (mp['cut'], 'CUT · stamp · rewind · zoom'),
           (mp['sigAt'], 'signature · answer (no music)'), (REAL['R2']['t'] if 'R2' in REAL else 13.9, 'R2'), (mp['majorFrom'], 'A MAJOR (card)'),
           (mp.get('motifAt', mp['end'] - .45), 'motif'), (mp['end'], 'R1b · call (street only)')]
    for i, (x0, lb) in enumerate(lab): ax.text(x0 + .05, 60 if i % 2 == 0 else 85, lb, fontsize=7.5, color='w', alpha=.9)
    # 2 waveform
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#c9b6ff'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, DUR); ax.set_ylim(-1, 1); ax.set_xticks(xt)
    for s in (1, -1): ax.axhline(s * 10 ** (-1 / 20), color='r', lw=.5, ls='--')
    ax.set_title(f'waveform (L up / |R| down) · ±1 dBFS lines · TP {rep["tp_dbtp"]:.2f} dBTP (seam {rep["tp_seam_dbtp"]:.2f}) · sample peak {rep["sample_peak_db"]:.2f} dBFS', loc='left'); marks(ax)
    # 3 levels
    ax = fig.add_subplot(gs[2, :])
    def mom(x, hop=.02): tm, lm = dsp.lufs_momentary(x, hop); return tm, np.maximum(lm, -80)
    for x, lb, col, lw in ((Z, 'mix', '#ffffff', 1.2), (stems['vox'] * G, 'narrator', '#ffb24a', 1.0), (stems['real'] * G, 'REAL voice (+ its street)', '#ff7ad9', 1.0),
                           (stems['music'] * G, 'music (ducked)', '#3ee0ff', 1.0), ((stems['sfx'] + stems['hits']) * G, 'sfx + stamp', '#ff5a5a', .8),
                           (stems['amb'] * G, 'street bed', '#9fe08a', 1.0)):
        tm, lm = mom(x); ax.plot(tm, lm, color=col, lw=lw, label=lb)
    ts, ls = dsp.lufs_shortterm(Z, .05); ax.plot(ts, ls, color='#ffd84a', lw=1, ls='--', label='mix short-term (3 s)')
    for r_ in rep['voices']:
        txt = 'no\nmusic' if r_['no_music'] else f'+{r_["margin"]:.1f}'
        ax.text((r_['on'] + r_['off']) / 2, -5, f'{r_["id"]}\n{txt}', ha='center', va='top', fontsize=7.5, color='#9fe08a' if (r_['no_music'] or r_['margin'] >= 10) else '#ff5a5a')
    ax.set_xlim(0, DUR); ax.set_ylim(-75, -2); ax.set_xticks(xt); ax.axhline(-14, color='w', lw=.5, ls=':')
    ax2 = ax.twinx(); ax2.plot(np.arange(len(d1))[::240] / SR, d1[::240] * DUCK_DB, color='#ff7ad9', lw=1, label='music duck (dB)')
    gb, _ = bed_profile(ns(DUR), sc); ax2.plot(np.arange(len(gb))[::240] / SR, gb[::240], color='#9fe08a', lw=1, ls=':', label='bed profile (dB re R1 street)')
    ax2.set_ylim(-40, 2); ax2.set_ylabel('dB', color='#ff7ad9')
    ax.legend(loc='lower left', ncol=7, fontsize=7, facecolor='#120d1e'); ax2.legend(loc='lower right', fontsize=7, facecolor='#120d1e')
    ax.set_title(f'momentary loudness (400 ms) per stem, post master gain · integrated {rep["lufs"]:.2f} LUFS · numbers = narrator over the music bed (dB, K-weighted)'
                 + ('' if vinfo else ' · NO NARRATOR in this mix (no takes)'), loc='left'); marks(ax)
    # 4 envelope zooms
    r1e = REAL['R1']['end'] if 'R1' in REAL else 1.78
    zs = [(r1e - .45, mp['tenseFrom'] + .35, f'R1 out ({r1e:.2f}) -> street bed (150 ms) -> the drop at {mp["tenseFrom"]:.2f}', 'r1'),
          (mp['cut'] - .3, mp['cut'] + .5, f'TOTAL cut at music().cut = {mp["cut"]:.3f} under the stamp', 'cut'),
          (mp['end'] - .55, mp['end'] + .45, f'motif -> choked at {mp["end"]:.2f} -> R1b', 'end'),
          (-.4, .4, 'LOOP SEAM: the last .4 s then the first .4 s (t < 0 = end of the film)', 'seam')]
    for j, (a0, a1, title, kind) in enumerate(zs):
        ax = fig.add_subplot(gs[3, 3 * j:3 * j + 3])
        if kind == 'seam':
            k = ns(.4); cat = lambda x: np.concatenate([x[-k:], x[:k]]); xs = (np.arange(2 * k) - k) / SR
            e = lambda x: 20 * np.log10(R.env_db(cat(x), .002) + 1e-9)
        else:
            a, b = ns(max(0, a0)), min(len(Z), ns(a1)); xs = np.arange(a, b) / SR
            e = lambda x: 20 * np.log10(R.env_db(x[a:b], .002) + 1e-9)
        ax.plot(xs, e(Z), color='#ffffff', lw=.8, label='mix'); ax.plot(xs, e(stems['music'] * G), color='#3ee0ff', lw=.9, label='music')
        ax.plot(xs, e(stems['amb'] * G), color='#9fe08a', lw=.7, label='bed'); ax.plot(xs, e(stems['real'] * G), color='#ff7ad9', lw=.8, label='real')
        ax.set_ylim(-110, 0); ax.set_xlim(xs[0], xs[-1]); ax.set_title(title, loc='left', fontsize=7.2); ax.legend(fontsize=6.5, facecolor='#120d1e', ncol=2)
        ax.set_ylabel('dBFS (2-ms RMS)')
    # 5 zoom spectrograms
    zz = [(0.0, mp['tenseFrom'] + .6, 'R1 (real) · tics · shaker · the drop'), (mp['cut'] - .2, mp['sigAt'] + .7, 'STOP stamp + buzzer · rewind · swell · click · signature'),
          ((REAL['R2']['t'] - .4) if 'R2' in REAL else 13.4, mp['majorFrom'] + .6, 'whoosh back · R2 (real) · paper · tonk · A major'),
          (mp.get('motifAt', mp['end'] - .45) - .8, min(DUR, mp['end'] + 1.6), 'band stop · motif « bon-soir, bon-soir » · R1b')]
    for j, (a0, a1, title) in enumerate(zz):
        ax = fig.add_subplot(gs[4, 3 * j:3 * j + 3]); a, b = ns(max(0, a0)), min(len(m), ns(a1))
        spec(ax, m[a:b], a / SR, b / SR, 2048, 99.7, 80, np.geomspace(40, 16000, 300))
        for c in cues:
            if a0 <= c['t'] <= a1: ax.axvline(c['t'], ymin=.9, ymax=1, color=ccol(c['name']), lw=1.2); ax.text(c['t'], 17000, c['name'], rotation=90, fontsize=5.8, va='bottom', ha='center', color=ccol(c['name']))
        ax.set_title(title, loc='left', fontsize=7.3, pad=40)
    # 6 cue table
    ax = fig.add_subplot(gs[5, :]); ax.axis('off')
    hd = f'{"t":>7} {"cue":14s} {"alone":>7} {"mix":>7} {"LUFS-M":>6}'
    L = [f'{r_["t"]:7.3f} {str(r_["name"])[:14]:14s} {fm(r_["err"], "+6.1f", "     -")} {fm(r_["mix_err"], "+6.1f", "     -")} {fm(r_["lvl"], "6.1f", "     -")}' for r_ in rep['cues']]
    h = int(math.ceil(len(L) / 3))
    for j in range(3): ax.text(j / 3, .93, '\n'.join([hd] + L[j * h:(j + 1) * h]), family='monospace', fontsize=7.0, va='top')
    ax.text(0, 1.03, f'every cue / musical anchor within 15 ms (alone): {rep["cues_ok"]} · music digital silence (head, STOP hole, under the real voices, after the end): '
                     f'{rep["music_silence_ok"]} · off rows = music below -60 dB re the level just before', fontsize=7.8, va='top', color='#9fe08a' if rep['cues_ok'] else '#ff5a5a')
    # 7 voices + real + loudness
    ax = fig.add_subplot(gs[6, :]); ax.axis('off')
    L = ['REAL VOICE  film            src r        samples   lag proc/mix  corr       f0 raw -> proc (ratio)    gain   gate max/mean  fades     speech']
    for r_ in rep['real']:
        L.append(f'{r_["id"]:4s} {r_["film"][0]:7.3f}-{r_["film"][1]:7.3f}  {r_["src"][0]:.2f}-{r_["src"][1]:.2f}  {r_["samples"]:7d}={r_["samples_expected"]:<7d} '
                 f'{r_["lag_proc"]:+3d} / {r_["lag_mix"]:+3d}     {r_["corr_proc"]:.3f}  {fm(r_["f0_raw"], "6.1f")} -> {fm(r_["f0_proc"], "6.1f")} ({fm(r_["f0_ratio"], ".4f")})  '
                 f'{r_["gain_db"]:+5.1f}  {r_["gate_max_db"]:.1f}/{r_["gate_mean_db"]:.1f} dB   {r_["fade_in"] * 1000:3.0f}/{r_["fade_out"] * 1000:3.0f} ms  {fm(r_["speech_lufs"], ".1f")} LUFS')
    L.append(f'rush spans read: {rep["rush_spans_read"]} · r 1.78-7.70 never played: {rep["never_played_ok"]} · untouched (length, lag 0, f0 frame ratio ±0.6 %, gate <= 6 dB): {rep["real_ok"]}')
    L.append('')
    if rep['voices']:
        L.append(f'{"id":3s} {"take":10s} {"speech":>15}  {"T":>6}  {"gap":>6}  {"LUFS":>6}  {"/music":>8} {"word min":>8}  {"/all":>6} {"worst word (all)":>20}  {"phone":>6}')
        for r_ in rep['voices']:
            L.append(f'{r_["id"]:3s} {r_["file"]:10s} {r_["on"]:7.3f}-{r_["off"]:7.3f}  {r_["T"] if r_["T"] is not None else float("nan"):6.3f}  {fm(r_["gap"], "6.3f", "   -  ")}  {r_["lufs"]:6.1f}  '
                     f'{"no mus." if r_["no_music"] else format(r_["margin"], "+7.1f"):>8} {fm(r_["word_min"], "+6.1f", "   -"):>8}  {r_["margin_all"]:+6.1f} {(r_["word_worst"] or "-")[:12]:>12} {fm(r_["word_min_all"], "+6.1f")}  {r_["phone"]:+6.1f}')
    else: L.append('NARRATOR: none in this mix (data/takes.json missing) — rerun once the takes are chosen')
    L.append(f'voices overlap: {rep["voices_overlap"] or "none"} · duck {rep["duck_max_db"]:.1f} dB + {CARVE_DB:.0f} dB carve 0.9-5 kHz · motif fast duck · soft SFX {SFX_DUCK_DB:.0f} dB · stamp & signature {HIT_DUCK_DB:.0f} dB')
    sp_ = ' · '.join(f'{s["name"]} {fm(s["ratio"], ".2f")}' for s in rep['splices'])
    L.append(f'splice click ratios (< 2 = clean): {sp_} · loop seam {rep["seam"]["ratio"]:.2f}')
    b_ = rep['bed']; asr = b_.get('asr')
    L.append(f'street bed: R1 street {b_["r1_street_rms_db"]:.1f} dBFS RMS · ' + ' · '.join(f'{k} {v:.1f}' for k, v in b_['rms_db'].items()) + ' dBFS RMS · scooter '
             f'{b_["scooter"]:.2f} s · ASR (small) on the bed alone: ' + ('; '.join(f'{w["win"][0]:.2f}-{w["win"][1]:.2f}: {len(w["words"])} words' + (' (+ flagged hallucination)' if w['flagged'] else '') for w in asr) if isinstance(asr, list) else str(asr))
             + (' · control on the real voice: ' + ' | '.join(f'« {w["text"]} »' for w in b_.get('asr_control', [])) if b_.get('asr_control') else ''))
    L.append(f'mix.wav: {rep["n"]} samples = {rep["dur"]:.6f} s @ {rep["sr"]} Hz, {rep["channels"]} ch · integrated {rep["lufs"]:.2f} LUFS · true peak {rep["tp_dbtp"]:.2f} dBTP '
             f'(seam {rep["tp_seam_dbtp"]:.2f}) · sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master {rep["master_gain_db"]:+.2f} dB · '
             f'limiter max GR {rep["max_gr_db"]:.1f} dB · clipped {rep["clipped"]}')
    L.append(f'score: {rep["src"]} · timing.json: {"yes" if rep["timing"] else "no (defaults)"} · narrator: {rep["narrator"]}')
    ax.text(0, 1, '\n'.join(L), family='monospace', fontsize=7.2, va='top')
    fig.suptitle('« TROUVE LE MOT. » — Bonsoir, bonsoir · audio check sheet (lib/audio_rush.py)', x=.01, y=.997, ha='left', fontsize=15, color='w')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=100, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    log('[RU] sheet ->', path)

if __name__ == '__main__':
    sh = _arg('--sheet')
    build(sheet=os.path.abspath(sh) if isinstance(sh, str) else (SHEET if sh else None))

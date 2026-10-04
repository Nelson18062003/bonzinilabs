"""« TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5) — the film's sound: 48 kHz stereo, exactly SCORE.T.end seconds,
synthesised (no samples) + the 10 voice takes. Built on « PAS REÇU. » (v3/lib/audio_recu.py, imported as R: voice chain,
sidechain duck, carve, master, onset checks, series SFX) and the series' synth code (audio.py, makossa.py, bikutsi.py,
instruments.py).

ONE score drives picture and sound: SCORE.T, SCORE.soundCues() and SCORE.music() are read LIVE from
overlay/scenes/01_score.js through node (which itself reads data/timing.json). Fallbacks, in order: audio/score_cues.json
(the last live read, if its T still matches data/timing.json), then a python replica of the score's A block. The voices
come from data/voice_plan.json (file start `at`, `stretch`) + data/takes.json (speech on/off). Move a cue, rerun.

Music (makossa, 120 BPM, beat .5 s; series code makossa.groove / guitar / bass / kit, bikutsi balafon, instruments.*):
  0 .. music.tenseFrom      no music: the compressed-air POUF already under way at frame 0, the carton creak, the soft
                            generic ka-ching, the margouillat's claws; only the day room breathes
  tenseFrom .. music.cut    TENSE F#-minor groove in STOP-TIME: the band re-enters ON the picture's hits (each one a
                            downbeat, a .22-s break before it): enter (F#m D) | the thick-cardboard BOUM (F#m) | the
                            MEASURE, its grid = the three tape-measure clacs (C#m) | the formula stamp -> the void (D E7)
                            + riser. Density climbs at every hit. The cut leaves the E7 hanging.
  music.cut                 TOTAL CUT (4 ms gate, reverb returns included) on TOI's realisation: cricket, sweat drops,
                            then the packing ASMR in the silence (fold, cutter, pffuit, THE tape « scriiitch », gloup)
  music.majorFrom           A MAJOR (the E7 resolves) full makossa under N5/N6, stop-time accent on « ENSUITE : »
  sigAt                     Bonzini signature: two clear rising balafon notes E6 -> G#6 (.1 s apart, the series' exact
                            signature), then the violet section: soft pad + bright balafon on a grid anchored so the
                            « MESURÉ ✓ » stamp lands on a beat: D(add9, lydian) -> E7sus4 -> A at the stamp
  stamp .. end              A-major makossa from the stamp; it breaks and slams back ON the ritual stamp; the band stops
                            on an E accent, the final A chord lands on its cue, choked dead at cut_dry
Voices: R.voice_line (trim ±30 ms, 24 -> 48 kHz soxr VHQ, Rubber Band if stretch != 1, EQ, leveller + compressor, de-esser,
  per-line loudness -18 LUFS), small-room reverb. Music ducks 8 dB under any voice (+4 dB carve of 0.9-5 kHz), soft SFX
  4 dB; impacts and the ASMR tape are never ducked.
Master: HP 28 Hz, bus soft-clips, true-peak limiter; -14 LUFS integrated (pyloudnorm), TP <= -1 dBTP.

usage:  nice -n 5 python3 lib/audio_ep2.py           -> audio/mix.wav, audio/stems/*.wav, report
        nice -n 5 python3 lib/audio_ep2.py --sheet   -> + out/chk_audio_sheet.jpg
API:    build(sheet=False) -> report dict · score() · compose(sc, lines) · sfx_<name>() -> np.ndarray (onset at sample 0)
"""
import os, sys, json, math, re, subprocess, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(os.path.join(HERE, '..'))
SP = os.path.abspath(os.path.join(E, '..', '..'))
V3LIB = os.path.join(SP, 'v3', 'lib')
if not os.path.isdir(V3LIB): V3LIB = os.path.join(SP, 'pas-recu', 'lib')   # repo layout: the « PAS REÇU. » sound library
if V3LIB not in sys.path: sys.path.insert(0, V3LIB)
import audio_recu as R                       # « PAS REÇU. »: imports audio (dsp, makossa, bikutsi, instruments) in order
import numpy as np
from audio import ns, tt, nz, ex, m2f, bp, panst, place, tail_fade, grains
A, dsp, SR, mk, bk, I = R.A, R.dsp, R.SR, R.mk, R.bk, R.I

SCORE_JS = os.path.join(E, 'overlay', 'scenes', '01_score.js')
TIMING_JSON = os.path.join(E, 'data', 'timing.json')
OUT_A = os.path.join(E, 'audio')
CUES_DUMP = os.path.join(OUT_A, 'score_cues.json')
SHEET = os.path.join(E, 'out', 'chk_audio_sheet.jpg')
# the voice chain of R reads these module globals at call time
R.PLAN_JSON = os.path.join(E, 'data', 'voice_plan.json'); R.TAKES_JSON = os.path.join(E, 'data', 'takes.json')
R.VOCHECK_JSON = os.path.join(E, 'data', 'vocheck.json'); R.VO_DIR = os.path.join(E, 'audio', 'vo')
R.CACHE = os.path.join(OUT_A, '.cache')
R.VOX_TRIM = {'T1': +0.5, 'T2': -1.0}        # « Mais mon carton est léger ! » outraged · « …j'ai payé… » small voice

TAIL = 3.0
BEAT = 0.5
BRK = 0.22                                    # stop-time: the band leaves the last .22 s before each hit it re-enters on
SIG_GAP = 0.10                                # the series signature: E6 then G#6 .1 s later (as in « PAS REÇU. »)
DUCK_DB, SFX_DUCK_DB = R.DUCK_DB, R.SFX_DUCK_DB
G_TENSE, G_MAJOR, G_BRAND, G_FINAL = R.G_TENSE, R.G_MAJOR, R.G_BRAND, R.G_FINAL
MUSIC = ('groove', 'brand', 'final')
DUCKED = {'groove': DUCK_DB, 'brand': DUCK_DB, 'final': DUCK_DB, 'sfx': SFX_DUCK_DB}
SENDS = {'groove': ('room', .08), 'brand': ('plate', .24), 'final': ('room', .10), 'sfx': ('room', .06),
         'hit': ('room', .08), 'asmr': ('vroom', .07), 'vox': ('vroom', .15)}
STEMS = ('vox', 'music', 'sfx', 'hits', 'asmr', 'amb')

def log(*a): print(*a, flush=True)
fm = R.fm
def rng(seed): return np.random.default_rng(seed)
def nrm(y, pk=.5): return y / (np.abs(y).max() + 1e-12) * pk
def smooth01(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)

# =====================================================================================================================
# score (live) + fallbacks
# =====================================================================================================================
_SC = None
def score():
    """{dur, T, DUR, words, cues[{t, name, g, pan}], music{silentUntil, tenseFrom, cut, majorFrom, sigAt, end}, src}"""
    global _SC
    if _SC is not None: return _SC
    tm = json.load(open(TIMING_JSON))
    js = ("const S=require(%s);const o={T:S.T,DUR:S.DUR,A:S.A};"
          "o.cues=typeof S.soundCues==='function'?S.soundCues():null;o.music=typeof S.music==='function'?S.music():null;"
          "console.log(JSON.stringify(o))") % json.dumps(SCORE_JS)
    d, why = None, ''
    try:
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60, check=True, cwd=E)
        d = json.loads(r.stdout.strip().splitlines()[-1]); d['src'] = '01_score.js (live)'
    except Exception as e: why = f'node failed: {e}'
    der = derive_score(dict(d['T']) if d else {k: v for k, v in tm.items() if isinstance(v, (int, float))},
                       dict(d['DUR']) if d and d.get('DUR') else tm.get('dur', {}), tm.get('words', {}))
    if d and not d.get('cues'):
        d['cues'] = der['cues']; d['src'] += ' + cues derived in python (soundCues() missing)'
    if d and not d.get('music'):
        d['music'] = der['music']; d['src'] += ' + music derived in python (music() missing)'
    if d:
        miss = [k for k in der['music'] if k not in d['music']]
        for k in miss: d['music'][k] = der['music'][k]
        if miss: d['src'] += f' + music keys derived: {miss}'
    if d is None:
        try:
            j = json.load(open(CUES_DUMP))
            if all(abs(j['T'].get(k, -9) - v) < 1e-9 for k, v in tm.items() if isinstance(v, (int, float))):
                d = j; d['src'] = f'audio/score_cues.json (last live read; {why})'
        except Exception: pass
    if d is None:
        d = der; d['src'] = f'python replica of the score ({why})'
    d['dur'] = float(d['T']['end']); d['words'] = tm.get('words', {})
    d['cues'] = sorted(d['cues'], key=lambda c: c['t'])
    if d['src'].startswith('01_score.js'):
        os.makedirs(OUT_A, exist_ok=True)
        json.dump({k: d[k] for k in ('T', 'DUR', 'cues', 'music')}, open(CUES_DUMP, 'w'), indent=1)
    _SC = d
    return d

def derive_score(T, DUR, words):
    """python replica of 01_score.js (A block, soundCues(), music()) — used only when node or a function is missing"""
    T = dict(T); DUR = dict(DUR)
    deacc = lambda s: unicodedata.normalize('NFD', str(s).lower()).encode('ascii', 'ignore').decode()
    def forms(w):
        r = deacc(w); return [re.sub('[^a-z0-9]', '', r), re.sub('[^a-z0-9]', '', re.sub(r"^(?:[a-z]{1,2}|qu|jusqu)'", '', r))]
    def word(i, p, nth=0):
        k = re.sub('[^a-z0-9]', '', deacc(p)); c = 0
        for w in words.get(i, []):
            if any(x.startswith(k) for x in forms(w['w'])):
                if c == nth: return w
                c += 1
    W = lambda i, p, nth=0, fb=0: T[i] + (word(i, p, nth)['s'] if word(i, p, nth) else fb)
    WE = lambda i, p, nth=0, fb=0: T[i] + (word(i, p, nth)['e'] if word(i, p, nth) else fb)
    END = lambda i: T[i] + DUR.get(i, 2.0)
    cl = lambda x, a, b: max(a, min(b, x))
    a = {}
    a['hop'] = T['N1'] + .05; a['burstPeak'] = T['N1'] + .4; a['toiUp'] = T['T1'] - .1
    a['bateauShadow'] = T['N2'] + .15; a['bateauFall'] = W('N2', 'place', 0, 1.0); a['stampM3'] = W('N2', 'cube', 0, 2.15)
    a['bateauOut'] = max(END('N2') - .05, a['bateauFall'] + 1.45)   # QA stage 3 (mirrors 01_score.js)
    a['mes0'] = a['bateauOut'] + .35; gap = cl((T['N3'] - .45 - a['mes0']) / 2.8, .3, .5)
    a['mes1'] = a['mes0'] + gap; a['mes2'] = a['mes0'] + 2 * gap; a['formula'] = a['mes0'] + 2.8 * gap
    a['flank'] = T['N3'] - .1; a['hatch0'] = W('N3', 'carton', 0, .15) + .15; a['vide'] = W('N3', 'vide', 0, 1.68)
    a['cut'] = T['T2'] - .2; a['toiSmall'] = T['T2'] - .05
    a['pose1'] = W('N4', 'ton', 0, .55); a['pose2'] = max(W('N4', 'cartons', 0, 1.6), a['pose1'] + .75)
    a['pose3'] = max(W('N4', 'remplis', 0, 2.45), a['pose2'] + .75); a['split'] = T['N5'] - .1
    a['chase'] = min(a['pose3'] + .2, a['split'] - .45); a['gulp'] = a['chase'] + .55
    a['gauge0'] = T['N5'] + .1; a['gauge1'] = a['gauge0'] + .7; a['hic'] = a['gauge1'] + .55
    a['glass'] = T['N6'] + .05; a['wrap0'] = W('N6', 'pas', 0, 1.2) - .15
    a['wrap1'] = max(a['wrap0'] + .5, W('N6', 'protection', 0, 1.55) + .35)
    a['ensuite'] = END('N6') + .1; a['violet'] = max(T['N7'] - .15, a['ensuite'] + .25); a['label'] = a['violet'] + .3
    a['sig'] = W('N7', 'bonzini', 0, .25) - .05; a['plateBZ'] = W('N7', 'bonzini', 0, .25)
    a['scan'] = W('N7', 'cartons', 0, 1.9); a['tape'] = W('N7', 'sont', 0, 2.35) - .1
    a['volume'] = max(W('N7', 'mesures', 0, 2.55) + .1, a['tape'] + .3); a['airStrike'] = a['volume'] + .3
    a['measured'] = max(WE('N7', 'mesures', 0, 3.0) + .1, a['airStrike'] + .3)
    a['endcard'] = max(T['N8'] - .15, a['measured'] + 1.45); a['cta'] = max(T['N8'], a['endcard'] + .15); a['stampEnd'] = W('N8', 'maintenant', 0, 1.9) - .1; a['loop'] = T['end'] - .55
    Q = []
    def q(t, name, g=1, pan=0):
        if 0 <= t < T['end']: Q.append(dict(t=round(t, 4), name=name, g=g, pan=pan))
    q(0, 'pouf_air'); q(.02, 'carton_creak', .7); q(a['burstPeak'] - .1, 'kaching_soft', .55, -.2); q(a['hop'], 'gecko_skitter', .35, -.6)
    q(a['toiUp'], 'boing', .6); q(a['bateauShadow'], 'whoosh_low', .4); q(a['bateauFall'], 'boum_carton'); q(a['bateauFall'] + .03, 'letters_splash', .7)
    q(a['stampM3'], 'stamp')
    for i, m in enumerate((a['mes0'], a['mes1'], a['mes2'])): q(m, 'clac', .9, -.2 + .2 * i); q(m + .04, 'felt', .45)
    q(a['formula'], 'stamp', .8); q(a['flank'], 'paper_lift', .7); q(a['hatch0'], 'fill_fffff', .6); q(a['vide'], 'tic', .6)
    q(a['cut'], 'music_cut'); q(a['cut'] + .1, 'cricket', .5); q(a['toiSmall'] + 1.1, 'sweat_drop', .7); q(a['toiSmall'] + 2.1, 'sweat_drop', .5)
    q(a['pose1'], 'carton_fold', .8); q(a['pose2'], 'cutter', .7); q(a['pose2'] + .05, 'carton_fold', .8); q(a['pose2'] + .1, 'pffuit', .6)
    q(a['pose3'], 'scotch_scriiitch', 1.1); q(a['chase'], 'pffuit', .8, -.3); q(a['gulp'], 'gloup', .9, -.6); q(a['hic'], 'hic', .5, -.6)
    q(a['split'], 'whoosh', .5); q(a['gauge0'], 'gauge_fill', .4, -.3); q(a['gauge0'] + .05, 'gauge_fill', .3, .3)
    q(a['glass'], 'pop_soft', .5, .3); q(a['wrap0'] + .1, 'bubble_wrap', .6, .3); q(a['wrap1'], 'bubble_plop', .8, .3)
    q(a['ensuite'], 'whoosh', .8); q(a['ensuite'] + .05, 'pill_drop', .4)
    q(a['violet'], 'violet_hum', .4); q(a['sig'], 'bonzini_sig'); q(a['plateBZ'], 'tonk', .8); q(a['label'], 'label_slap', .5)
    q(a['scan'], 'bip', .8, .3); q(a['tape'], 'tape_measure', .8); q(a['volume'], 'tic', .6); q(a['airStrike'], 'marker_strike', .6, .3)
    q(a['measured'], 'stamp'); q(a['endcard'], 'whoosh_soft', .5); q(a['cta'], 'pop', .7); q(a['stampEnd'], 'stamp_big')
    q(a['loop'], 'carton_rattle', .6); q(T['end'] - .5, 'final_chord'); q(T['end'] - .02, 'cut_dry')
    mus = dict(silentUntil=a['toiUp'] - .1, tenseFrom=a['toiUp'] - .1, cut=a['cut'], majorFrom=a['split'], sigAt=a['sig'], end=T['end'])
    return dict(T=T, DUR=DUR, A=a, cues=sorted(Q, key=lambda c: c['t']), music=mus)

def voice_plan(): return R.voice_plan()

# =====================================================================================================================
# small synthesis helpers
# =====================================================================================================================
def stick_slip(n, rate, seed, amp=(.4, 1.0)):
    """impulse train following an instantaneous rate (Hz, scalar or array): friction that sticks and slips"""
    r = rng(seed); rate = np.broadcast_to(np.asarray(rate, float), (n,))
    ph = np.cumsum(np.maximum(rate, 1.0)) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[0] = 1.0; imp[idx] = r.uniform(*amp, len(idx))
    return imp

def wander(n, seed, scale, hz=8.0):
    """smooth zero-mean random modulation, peak ±scale"""
    x = dsp.onepole_lp(rng(seed).standard_normal(n), hz); x = x - x.mean()
    return x / (np.abs(x).max() + 1e-12) * scale

def thud(f_hi, f_lo, tau_f, tau, n, drive=1.0):
    t = tt(n); return np.sin(2 * np.pi * np.cumsum(f_lo + (f_hi - f_lo) * np.exp(-t / tau_f)) / SR) * np.exp(-t / tau) * drive

def hollow(t, seed, modes=((175, 1, .04), (262, .6, .03), (410, .35, .02)), glide=None):
    """the damped body of a cardboard box (low Q: cardboard is dead)"""
    return R._modes(t, 1.0, modes, seed, glide)

def tick(f, seed, n=None): return R._click(f, seed, n)

# =====================================================================================================================
# SFX (all synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0)
# =====================================================================================================================
def sfx_pouf_air(seed=401, dur=1.2):
    """compressed-air « POUF » already under way at frame 0 (the AIR cloud bursting out of the carton): a low air
    « whump » (LP noise + a 78 -> 46 Hz body), a broadband hiss whose band falls 3.2 kHz -> 700 Hz, the paper cloud's
    flutter (crinkle grains), stereo-wide. Loud for ~60 ms, -12 dB by ~110 ms (N1's « Dans ce » starts at .1 s), then a
    soft tail. Starts at 72 % of its peak: the burst is caught in progress (and the loop's dry cut leads straight into it)"""
    n = ns(dur); t = tt(n)
    env = np.where(t < .02, .72 + .28 * t / .02, 1.0) * np.exp(-np.maximum(t - .02, 0) / .04)
    tail = .07 * np.exp(-t / .35) * np.minimum(1, t / .06)
    whump = dsp.lp(nz(n, seed), 380) * env * 2.4
    body = thud(78, 46, .05, .12, n) * (.8 + .2 * np.minimum(1, t / .02))
    fc = 700 + 2500 * np.exp(-t / .12)
    out = np.zeros((n, 2))
    for c in range(2):
        hiss = dsp.tv_biquad(nz(n, seed + 1 + c), 'bp', fc * (1 + .04 * c), .9) * (env + tail) * 1.15
        flut = bp(nz(n, seed + 3 + c), 3800, .8) * grains(n, 420, seed + 5 + c, .0012, (.2, 1), shape=np.exp(-t / .12))
        out[:, c] = whump + body * .9 + hiss + flut * .4
    return out / np.abs(out).max()

def sfx_carton_creak(seed=411, dur=.5):
    """cardboard flaps forced open: slow stick-slip (wandering 18-45 Hz) exciting the board's dead modes
    (190 / 430 / 820 / 1500 / 2600 Hz, low Q) + the fibres' crackle"""
    n = ns(dur); t = tt(n); u = t / dur
    rate = 30 + 12 * np.sin(2 * np.pi * 1.7 * t + .5) + wander(n, seed, 10, 6)
    imp = stick_slip(n, rate, seed + 1)
    body = sum(a * bp(imp, f, q) for f, q, a in ((190, 3.5, 1.0), (430, 4.5, .8), (820, 5, .55), (1500, 5, .35), (2600, 4, .2)))
    fib = bp(nz(n, seed + 2), 2400, .8) * np.convolve(imp, ex(ns(.012), .003))[:n] * .02
    y = (body + fib) * np.minimum(1, t / .002) * (.6 + .4 * np.sin(np.pi * u)) * np.clip((dur - t) / .08, 0, 1)
    return nrm(y)

def sfx_kaching_soft(seed=421):
    """a soft, GENERIC « ka-ching »: the series' register (two clacks, drawer, bell, coins), low-passed and quiet"""
    return nrm(dsp.lp(I.mf.cash_register(seed), 5200))

def sfx_skitter(seed=431, dur=.32):
    """the margouillat's claws on kraft paper: two quick bursts of tiny ticks + a short paper scrape"""
    out = np.zeros(ns(dur + .05)); r = rng(seed)
    for k, tk in enumerate((0, .022, .041, .066, .15, .171, .197)):
        place(out, tick(r.uniform(2600, 4200), seed + k, ns(.02)) * r.uniform(.4, 1.0) * (1 if k else 1.2), ns(tk))
    n = ns(.07); sc = bp(nz(n, seed + 20), 3000, .9) * grains(n, 900, seed + 21, .0008, (.2, 1)) * np.sin(np.pi * tt(n) / .07) * 2
    place(out, sc, 0)
    return nrm(out)

def sfx_boing(seed=441, dur=.55, f0=277.18):
    """TOI's plate springs up (« rebond »): a twangy saw starting sharp then wobbling around C#4 (11 Hz spring, decaying),
    through a formant sliding « bo- » (500 Hz) -> « -ing » (1.9 kHz), a little thump at the start"""
    n = ns(dur); t = tt(n)
    f = f0 * (1 + .16 * np.exp(-t / .12) * np.sin(2 * np.pi * 11 * t) + .25 * np.exp(-t / .03))
    ph = np.cumsum(f) / SR
    saw = dsp.lp(2 * (ph % 1.0) - 1, 6000)
    y = dsp.tv_biquad(saw, 'bp', 500 + 1400 * np.clip(t / .12, 0, 1), 3.0) * 1.6 + .5 * np.sin(2 * np.pi * ph)
    y *= np.minimum(1, t / .004) * np.exp(-t / .22)
    y += thud(150, 90, .01, .03, n) * .5
    return nrm(y)

def sfx_whoosh_low(dur, seed=451):
    """the thick plate « LE BATEAU » comes down: a low air push growing toward the impact (band 160 -> 520 Hz),
    a breath of high air, cut dead AT the impact (the BOUM owns it)"""
    dur = max(.15, dur); n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 160 * (520 / 160) ** u, 1.1) * (.35 + .65 * u ** 2)
    y += dsp.tv_biquad(nz(n, seed + 1), 'bp', 1200 * 2 ** u, 1.0) * .25 * u ** 2
    y *= np.minimum(1, t / .003); y[-ns(.003):] *= np.linspace(1, 0, ns(.003))
    return nrm(y)

def sfx_boum_carton(seed=461):
    """thick cardboard slammed on cardboard (« LE BATEAU » crushes TOI's plate): a heavy, DULL boum — chest thump
    120 -> 46 Hz, the series' sub_drop, the boards' dead modes (120-760 Hz, low Q, strike glide), the table's wooden knock,
    a papery slap and the crushed plate's crunch. No clang: cardboard. Above 400 Hz it is over in ~35 ms: it lands ON
    « place » and must not mask it"""
    n = ns(1.6); t = tt(n)
    y = dsp.softclip(thud(120, 46, .03, .14, n, 1.9), 1.4)
    s = tail_fade(I.sub_drop(1.0).copy(), 250); y[:len(s)] += s[:n] * .8          # the series' sub_drop ends on a step: fade it
    y += hollow(t, seed + 1, ((122, 1, .06), (188, .8, .045), (265, .6, .04), (370, .45, .03), (520, .3, .025), (760, .2, .018)),
                1 + .03 * np.exp(-t / .015)) * .7
    w = A.wood(105, seed + 2, 1.0); y[:len(w)] += w * .6
    sl = bp(nz(ns(.012), seed + 3), 1800, .7) * np.linspace(1, 0, ns(.012)) * 2.0; y[:len(sl)] += sl
    y += bp(nz(n, seed + 4), 2600, .8) * grains(n, 1500, seed + 5, .0012, (.3, 1), shape=np.exp(-t / .03)) * 1.2
    lo, hi = dsp.zp_split(y, 400, 2)
    y = lo + hi * np.where(t < .035, 1.0, np.exp(-(t - .035) / .025))
    y *= np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_letters_splash(seed=471, letters=12, dur=.7):
    """TOI's amber paper letters squirt out of the crushed plate: a paper « pfrt » burst, then each letter lands on the
    kraft (paper flick + soft tick), spread in pan, smaller and smaller"""
    out = np.zeros((ns(dur + .2), 2)); r = rng(seed)
    b = bp(nz(ns(.08), seed), 2200, .7) * ex(ns(.08), .02); place(out, panst(b, 0), 0)
    for j in range(letters):
        tl = .05 + .55 * r.random() ** 1.3
        f = I.paper(seed + 10 + j); k = tick(r.uniform(900, 1600), seed + 40 + j) * .35
        sig = np.zeros(max(len(f), len(k))); sig[:len(f)] += f; sig[:len(k)] += k
        place(out, panst(sig * r.uniform(.35, .8) * (1 - .4 * tl / dur), r.uniform(-.85, .85)), ns(tl))
    return nrm(out)

def sfx_stamp_carton(seed=481, hollow_g=1.0):
    """a rubber stamp on cardboard: the series' stamp (rubber + table thud + paper slap) + the carton's hollow body"""
    n = ns(.6); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    y += hollow(t, seed + 1) * .45 * hollow_g
    lo, hi = dsp.zp_split(y, 300, 2)                                         # above 300 Hz a hit, not a tail: it lands on words
    y = lo + hi * np.where(t < .03, 1.0, np.exp(-(t - .03) / .03))
    return y / np.abs(y).max()

def sfx_tape_clac(seed=491):
    """the tape measure snaps against the carton (« clac »): the case's plastic click, the thin steel blade's slap and
    its short « brr » flutter (the curved blade wobbling at ~28 Hz), a hollow knock on the cardboard"""
    n = ns(.35); t = tt(n)
    blade = R._modes(t, 1.0, ((1180, 1, .03), (2050, .7, .022), (3420, .5, .015), (5160, .3, .01), (7300, .15, .006)), seed + 1)
    blade *= 1 + .6 * np.sin(2 * np.pi * 28 * t) * np.exp(-t / .05)
    y = blade * .6 + hollow(t, seed + 3, ((210, 1, .04), (330, .6, .03))) * .8 + thud(180, 110, .01, .03, n) * .5
    c = tick(2900, seed); y[:len(c)] += c * .8
    sl = dsp.hp(nz(ns(.004), seed + 2), 2500) * np.linspace(1, 0, ns(.004)) * .9; y[:len(sl)] += sl
    y *= np.minimum(1, t / .0003)
    return y / np.abs(y).max()

def sfx_felt(seed=501, dur=.36, squeak=1.0, attack=.012):
    """a felt-tip pen drawn along the carton (« le feutre qui crisse »): fibre friction (1.8-6.5 kHz) with the stroke's
    speed bumps, and the squeak: an intermittent stick-slip pulse train (~950 Hz, jittered) through two tight formants"""
    n = ns(dur); t = tt(n); r = rng(seed)
    env = np.minimum(1, t / attack) * np.clip((dur - t) / .07, 0, 1) * (.75 + .25 * np.sin(2 * np.pi * 3 * t + r.uniform(0, 6)))
    fric = dsp.butter(nz(n, seed), 'bp', [1800, 6500], 2)
    fric *= .55 + .45 * grains(n, 160, seed + 1, .003, (.2, 1)) / (grains(n, 160, seed + 1, .003, (.2, 1)).max() + 1e-9)
    imp = stick_slip(n, 950 * (1 + wander(n, seed + 2, .07, 12)), seed + 3, (.6, 1))
    sq = bp(imp, 2300, 9) + .6 * bp(imp, 3600, 10)
    gate = np.clip(dsp.onepole_lp((rng(seed + 4).random(n // 480 + 1) > .45).repeat(480)[:n].astype(float), 40), 0, 1)
    sq = sq / (np.abs(sq).max() + 1e-9) * gate * squeak
    y = (fric / (np.abs(fric).max() + 1e-9) * .8 + sq * .6) * env
    y[:ns(.003)] += bp(nz(ns(.003), seed + 5), 3000, 1) * np.linspace(1, 0, ns(.003)) * .8      # the nib touches
    return nrm(y)

def sfx_paper_lift(seed=511, dur=.55):
    """the carton's flank lifts like a cut-paper lid: a short cardboard hinge creak, the flap's air (« fwoo », rising),
    the paper edge's rustle"""
    n = ns(dur); t = tt(n); u = t / dur
    y = np.zeros(n); c = sfx_carton_creak(seed, .3); y[:len(c)] += c * 1.0
    y += dsp.tv_biquad(nz(n, seed + 1), 'bp', 500 * (2400 / 500) ** u, 1.2) * np.sin(np.pi * u) ** 1.5 * .35
    y += bp(nz(n, seed + 2), 4200, .9) * grains(n, 300, seed + 3, .001, (.2, 1), shape=np.sin(np.pi * u)) * .5
    y[:ns(.003)] += bp(nz(ns(.003), seed + 4), 2500, 1) * np.linspace(1, 0, ns(.003)) * .6
    return nrm(y)

def sfx_fill(dur, seed=521):
    """the void fills with blue hatching (« fffff » that rises): breathy noise, band rising 450 Hz -> 3.8 kHz, level rising,
    the hatching strokes as soft pencil grains; ends just before the « tic »"""
    dur = max(.3, dur); n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 450 * (3800 / 450) ** u, 1.6) * (.5 + .5 * u ** 1.5)
    y += bp(nz(n, seed + 1), 5000, 1) * grains(n, 40, seed + 2, .02, (.3, 1)) * .3 * u
    y *= np.minimum(1, t / .004) * np.clip((dur - t) / .04, 0, 1)
    return nrm(y)

def sfx_tic(seed=531, f=2650.0):
    """a small dry « tic » (a pencil tip on card): sharp click + tiny ring"""
    return nrm(tick(f, seed))

def sfx_carton_fold(seed=541, land=.2):
    """a cardboard flap folded on its crease: the fibres crack (« krrk », grains climbing), the board flexes (a short dead
    creak), the flap lands (papery « thup ») at `land` = the picture's pose squash (pose + .2)"""
    land = max(.08, land); n = ns(land + .25); t = tt(n); cr = max(.05, land - .04)
    shape = (t < cr) * (.3 + .7 * np.clip(t / cr, 0, 1))
    y = bp(nz(n, seed), 2400, .7) * grains(n, 1.0, seed + 1, .0009, (.3, 1), shape=1100 * shape) * 1.4
    y += bp(nz(n, seed + 2), 900, 1.0) * grains(n, 1.0, seed + 3, .0015, (.3, 1), shape=300 * shape) * .7
    c = sfx_carton_creak(seed + 4, .26); y[:len(c)] += c * .25
    i = ns(land); tl = tt(n - i)
    y[i:] += thud(200, 120, .01, .035, n - i) * .7 + bp(nz(n - i, seed + 5), 1500, .8) * np.exp(-tl / .008) * .9
    y[:ns(.003)] += bp(nz(ns(.003), seed + 6), 2000, 1) * np.linspace(1, 0, ns(.003)) * 1.0
    return nrm(y)

def sfx_cutter(seed=551, cut=.22):
    """a box cutter: the blade ratchets out (3 tight plastic clicks), slices the cardboard (« zzrrt »: torn fibres +
    the blade's faint scrape), a last snick"""
    n = ns(.09 + cut + .1); t = tt(n); y = np.zeros(n)
    for k in range(3): place(y, tick(3400 + 300 * k, seed + k, ns(.02)) * (.9 - .15 * k), ns(.028 * k))
    i0 = ns(.09); m = ns(cut); tm = tt(m); u = tm / cut
    tear = (1 + .8 * wander(m, seed + 5, 1, 90))
    sl = dsp.butter(nz(m, seed + 6), 'bp', [1500, 4500], 2) * tear * (.5 + .5 * grains(m, 2500, seed + 7, .0005, (.2, 1)) /
                                                                       (grains(m, 2500, seed + 7, .0005, (.2, 1)).max() + 1e-9))
    sl += np.sin(2 * np.pi * np.cumsum(3100 + 300 * u) / SR) * .12
    sl *= np.minimum(1, tm / .01) * np.clip((cut - tm) / .03, 0, 1)
    y[i0:i0 + m] += sl / (np.abs(sl).max() + 1e-9) * .7
    place(y, dsp.hp(tick(4200, seed + 9, ns(.02)), 2000) * .6, i0 + m)
    return nrm(y)

def sfx_pffuit(seed=561, dur=.34):
    """« pffuit »: air pushed out of a carton — a soft « pff » burst, then the « -uit » of the air (band rising 1.1 ->
    2.9 kHz, a little tonal), quick fall at the end"""
    n = ns(dur); t = tt(n)
    pff = dsp.lp(nz(n, seed), 1600) * np.exp(-t / .03) * 1.0
    fc = 1100 * (2900 / 1100) ** np.clip((t - .05) / (dur * .7), 0, 1)
    sh = np.sin(np.pi * np.clip((t - .03) / (dur - .03), 0, 1)) ** 1.2
    uit = dsp.tv_biquad(nz(n, seed + 1), 'bp', fc, 4.0) * sh * 1.4 + np.sin(2 * np.pi * np.cumsum(fc) / SR) * sh * .06
    y = (pff + uit) * np.minimum(1, t / .003)
    return nrm(y)

def sfx_scotch(seed=571, run=.35, lead=.05, press=.2):
    """THE ASMR moment: packing tape pulled across the carton (« scriiitch »), synced to the picture: the tape runs from
    cue - `lead` to cue - lead + `run` with an ease-out (fast, then slowing), the carton squashes at cue + `press`.
    The adhesive peel is a stick-slip: a dense, jittered impulse train whose rate follows the pull's speed (~1.1 kHz at the
    cue, falling to ~140 Hz as the tape stops: the pitch of the « iii » drops, its end turns to crackles) through the
    tape's resonances (1.3 / 2.65 / 3.6 / 5.4 / 8.2 kHz, weighted by bandwidth so the screech sits at 2-4 kHz), crackle on
    top, the roll rumbling under it; on the squash the tape is slapped flat (hollow thump + paper « fwap »), torn on the
    dispenser teeth (« tchk »), then a palm smooths it (two soft strokes). Stereo: travels L -> R with the tape head,
    the two channels decorrelated (own stick-slip jitter)"""
    n = ns(.8); t = tt(n)
    u = np.clip((t + lead) / run, 0, 1); k = 1 - (1 - u) ** 3; v = (1 - u) ** 2          # tape position, speed (0..1)
    stop = run - lead
    rate = 140 + 1150 * v ** .8
    penv = np.minimum(1, t / .004) * (.3 + .7 * v ** .5) * np.clip((stop + .02 - t) / .03, 0, 1)
    a = (-.55 + 1.1 * k + 1) * np.pi / 4
    bands = ((1300, 5, .75), (2650, 6, 1.0), (3600, 7, .85), (5400, 6, .35), (8200, 4, .10))
    out = np.zeros((n, 2))
    for c in range(2):
        imp = stick_slip(n, rate * (1 + wander(n, seed + 3 * c, .18, 60)), seed + 7 * c + 1, (.2, 1))
        peel = sum(w / math.sqrt(f / q) * bp(imp, f, q) for f, q, w in bands)
        peel /= np.abs(peel[:ns(stop)]).max() + 1e-9
        crk = dsp.hp(nz(n, seed + 11 + c), 3000) * grains(n, 2400, seed + 13 + c, .0004, (.2, 1)); crk /= np.abs(crk).max() + 1e-9
        rum = dsp.lp(nz(n, seed + 17 + c), 220) * (1 + .5 * np.sin(2 * np.pi * 7.5 * t)); rum /= np.abs(rum).max() + 1e-9
        tearn = dsp.butter(nz(n, seed + 19 + c), 'bp', [1800, 7000], 2) * np.convolve(imp, ex(ns(.004), .0008))[:n]   # adhesive tearing
        tearn /= np.abs(tearn).max() + 1e-9
        out[:, c] = (peel + tearn * .35 + crk * .15 + rum * .10 * v) * penv * (np.cos(a) if c == 0 else np.sin(a))
    g0 = dsp.hp(nz(ns(.015), seed + 21), 1500) * grains(ns(.015), 9000, seed + 22, .0003, (.3, 1)); g0 /= np.abs(g0).max() + 1e-9
    place(out, panst(g0 * np.linspace(1, .3, len(g0)) * .7, -.4), 0)                                  # « scr- »: the grab
    i = ns(press); m = n - i; tl = tt(m)                                                               # slapped flat on the squash
    slap = hollow(tl, seed + 25) * .22 + bp(nz(m, seed + 26), 1500, .8) * np.exp(-tl / .010) * .40
    place(out, panst(slap * np.minimum(1, tl / .0008), .45), i)
    j = ns(press + .04); tear = bp(nz(ns(.035), seed + 23), 3200, .8) * grains(ns(.035), 6000, seed + 24, .0004, (.3, 1))
    place(out, panst(tear / (np.abs(tear).max() + 1e-9) * np.linspace(1, .2, len(tear)) * .55, .6), j)   # « tchk »
    j = ns(press + .08); m = ns(.42); tm = tt(m)                                                       # the palm smooths it: 2 strokes
    hump = np.sin(np.pi * np.clip(tm / .2, 0, 1)) ** 2 + .7 * np.sin(np.pi * np.clip((tm - .2) / .2, 0, 1)) ** 2
    sw = dsp.butter(nz(m, seed + 27), 'bp', [1200, 4200], 2) * hump * .06
    place(out, np.stack([sw * .8, sw], 1), j)
    out *= np.minimum(1, t / .0005)[:, None]
    rms = np.sqrt(np.mean(out[:ns(stop)] ** 2))                            # the stick-slip buzz is very peaky: saturate it softly
    out = A.sclip(out, 2.2 * rms)                                          # (crest ~ -8 dB, a little grit) so the limiter never pumps on it
    return out / np.abs(out).max()

def sfx_whoosh(seed, dur=.32, p0=-.5, p1=.5, lo=350, hi=3200, flap=.6, peak=.3):
    """a paper whoosh (the split screen, the ENSUITE band, the end card): air swept across, its band and level peaking at
    `peak` x dur then dying away (out of the next word's way), panned along its path, a paper flick at its start"""
    n = ns(dur); t = tt(n); u = t / dur
    sh = np.where(u < peak, (u / peak) ** 1.5, np.exp(-(u - peak) / (.28 * (1 - peak))))
    w = dsp.tv_biquad(nz(n, seed), 'bp', lo + (hi - lo) * sh, .9) * np.maximum(sh, .25 * np.minimum(1, t / .004))
    w = w / (np.abs(w).max() + 1e-9) * np.clip((dur - t) / .02, 0, 1)
    f = I.paper(seed + 1); f = f / (np.abs(f).max() + 1e-9) * flap
    y = w.copy(); y[:len(f)] += f[:n]
    return panst(y, p0 + (p1 - p0) * smooth01(u)) * .5

def sfx_gauge_fill(seed=581, dur=.7, top=1.0):
    """a gauge fills (no figure): a soft click, then a rising « fill » — resonant noise gliding up (glass-tube timbre)
    with fine ratchet ticks that speed up; `top` = how far it climbs (the short gauge stops lower)"""
    n = ns(dur); t = tt(n); u = t / dur
    fc = 420 * (1 + 3.2 * top * u ** .8)
    y = dsp.tv_biquad(nz(n, seed), 'bp', fc, 6.0) * (.4 + .6 * u) * 2 + np.sin(2 * np.pi * np.cumsum(fc) / SR) * .12 * (.4 + .6 * u)
    for tk in np.cumsum(1 / (18 + 22 * np.linspace(0, top, 40))):
        if tk < dur - .05: place(y, tick(2400, seed + int(tk * 1000), ns(.015)) * .12, ns(tk))
    y *= np.minimum(1, t / .005) * np.clip((dur - t) / .06, 0, 1)
    place(y, tick(1800, seed + 1, ns(.02)) * .6, 0)
    return nrm(y)

def sfx_bubble_plop(seed=591, small=False):
    """one bubble popped (« plop »): a needle-sharp crack (broadband, 0.8 ms), the trapped air's « -lop » (pitch dropping
    1.1 kHz -> 420 Hz in ~18 ms, 30 ms decay), a tiny plastic ring"""
    n = ns(.25); t = tt(n); k = .6 if small else 1.0
    y = np.sin(2 * np.pi * np.cumsum(420 * k ** .3 + 680 * np.exp(-t / .006)) / SR) * np.exp(-t / (.03 * k)) * np.minimum(1, t / .0006)
    y += .12 * np.sin(2 * np.pi * 3100 * t) * np.exp(-t / .02)
    cr = dsp.hp(nz(ns(.004), seed), 1800) * np.exp(-tt(ns(.004)) / .0008) * 1.6; y[:len(cr)] += cr
    return nrm(y)

def sfx_bubble_wrap(dur, seed=601):
    """bubble wrap rolled around the glass: plastic film crinkle (bright grains, two bands), the sheet's soft swish,
    and a few small bubbles popping under the pressure"""
    dur = max(.3, dur); n = ns(dur); t = tt(n); u = t / dur
    move = .5 + .5 * np.sin(np.pi * u) ** .6
    y = bp(nz(n, seed), 5200, .9) * grains(n, 1.0, seed + 1, .0008, (.2, 1), shape=320 * move)
    y += bp(nz(n, seed + 2), 2400, 1.0) * grains(n, 1.0, seed + 3, .0015, (.2, 1), shape=120 * move) * .6
    y += dsp.tv_biquad(nz(n, seed + 4), 'bp', 900 + 1200 * u, .8) * move * .12
    r = rng(seed + 5)
    for k in range(3): place(y, sfx_bubble_plop(seed + 10 + k, small=True) * .5, ns(r.uniform(.2, .85) * dur))
    y[:ns(.003)] += bp(nz(ns(.003), seed + 6), 4000, 1) * np.linspace(1, 0, ns(.003)) * 1.2
    y *= np.clip((dur - t) / .05, 0, 1)
    return nrm(y)

def sfx_pill_drop(seed=611):
    """the pill « CHEZ TON FOURNISSEUR » comes unstuck and drops: a short peel (« tchk »), a paper flutter, a soft tap"""
    n = ns(.45); t = tt(n); y = np.zeros(n)
    m = ns(.05); pe = bp(nz(m, seed), 3000, .8) * grains(m, 5000, seed + 1, .0004, (.3, 1)) * np.linspace(1, .3, m)
    y[:m] += pe / (np.abs(pe).max() + 1e-9)
    fl = bp(nz(n, seed + 2), 2200, .9) * (.5 + .5 * np.sin(2 * np.pi * 18 * t)) * np.clip((t - .04) / .03, 0, 1) * np.clip((.27 - t) / .1, 0, 1) * .35
    y += fl; s = A.sfx_setdown(seed); place(y, s / np.abs(s).max() * .5, ns(.27))
    return nrm(y)

def sfx_violet_hum(seed=621, dur=.7):
    """the violet light switches on: a soft switch « tk », then a warm electric swell (detuned sines A4 / E5 / E6, the
    brand pad's own tones) with a whisper of shimmer, fading as the pad takes over"""
    n = ns(dur); t = tt(n)
    env = np.minimum(1, t / .2) ** 1.5 * np.clip((dur - t) / .35, 0, 1)
    y = (np.sin(2 * np.pi * 440 * t) + np.sin(2 * np.pi * 441.8 * t + 1) + .6 * np.sin(2 * np.pi * 659.26 * t + 2)
         + .25 * np.sin(2 * np.pi * 1318.5 * t + 3)) * env * .25
    y += bp(nz(n, seed), 6000, 1.2) * env * .05
    s = A.sfx_tap(seed); y[:len(s)] += s * .5
    return nrm(y)

def sfx_label_slap(seed=631):
    """the sea-cargo label slapped on the carton: a flat paper « fwap », the adhesive « tk », a hollow tap on the box"""
    n = ns(.3); t = tt(n)
    y = bp(nz(n, seed), 1500, .8) * np.exp(-t / .012) * 1.2 + dsp.hp(nz(n, seed + 1), 4000) * np.exp(-t / .004) * .5
    y += hollow(t, seed + 2, ((180, 1, .035), (290, .6, .025))) * .5
    y *= np.minimum(1, t / .0004)
    return nrm(y)

def sfx_scan_bip(seed=641, beep_at=.05):
    """the violet scan: the laser's thin « zzt » sweep from the cue (beam on), then ONE generic beep (2.4 kHz, soft square,
    110 ms) at the picture's beep (+50 ms)"""
    n = ns(.35); t = tt(n); d = .11; tb = t - beep_at
    b = (np.sign(np.sin(2 * np.pi * 2400 * tb)) * .3 + np.sin(2 * np.pi * 2400 * tb) * .7) * np.clip(tb / .002, 0, 1) * np.clip((d - tb) / .01, 0, 1)
    y = dsp.lp(b, 7000)
    sw = dsp.tv_biquad(nz(n, seed), 'bp', 1500 * (6500 / 1500) ** np.clip(t / .16, 0, 1), 3.5) * np.clip(t / .004, 0, 1) * np.clip((.16 - t) / .08, 0, 1) * .9
    return nrm(y + sw)

def sfx_tape_measure(seed=651, run=.27):
    """the tape measure runs along the small carton: the button click, the steel blade ratcheting out of its case (metal
    ticks, 55 -> 120 per second), the blade's hiss, then the lock « clac »"""
    n = ns(run + .4); t = tt(n); y = np.zeros(n)
    place(y, tick(3100, seed, ns(.03)) * .8, 0)
    tk = 0.012
    while tk < run - .02:
        tt_ = tt(ns(.02)); m = R._modes(tt_, 1.0, ((2900, 1, .004), (4600, .6, .003)), seed + int(tk * 1e4)) * .25
        place(y, m, ns(tk)); tk += 1 / (55 + 65 * tk / run)
    y[:ns(run)] += bp(nz(ns(run), seed + 3), 5000, .9) * np.sin(np.pi * tt(ns(run)) / run) * .08
    c = sfx_tape_clac(seed + 4); place(y, c * .55, ns(run))
    return nrm(y)

def sfx_marker_strike(seed=661):
    """the AIR cloud struck through with one quick felt-pen line: a fast fibrous « sssht » with a short squeak"""
    return sfx_felt(seed, .2, squeak=.7, attack=.005)

def sfx_stamp_big(seed=671):
    """the ritual stamp « MAINTENANT, TU SAIS. »: the series' stamp doubled (rubber + table thud + paper slap), a chest
    thump with a short sub, the kraft table's dead body; above 160 Hz it is a hit, not a tail (N8 goes on 100 ms later)"""
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

def sfx_carton_rattle(dur, seed=681):
    """the big closed carton of frame 0 trembles (the loop: it is about to burst open again): its corners knock on the
    table at a jittery 13-17 Hz (alternating L/R), the sandals shuffle inside, the flaps buzz; it GROWS to the last
    sample (no fade: the loop's POUF takes over)"""
    dur = max(.2, dur); n = ns(dur); t = tt(n); u = t / dur; r = rng(seed)
    out = np.zeros((n + ns(.1), 2)); tk = 0.0; k = 0
    while tk < dur:
        m = ns(.08); tm = tt(m)
        kn = hollow(tm, seed + k, ((160 * r.uniform(.95, 1.05), 1, .025), (245, .6, .02), (390, .3, .012))) + thud(140, 90, .008, .02, m) * .6
        kn[:ns(.002)] += bp(nz(ns(.002), seed + 500 + k), 2200, 1) * .5
        place(out, panst(kn * (.45 + .55 * tk / dur) * r.uniform(.7, 1.0), .25 if k % 2 else -.25), ns(tk))
        tk += 1 / (13 + 4 * r.random()); k += 1
    inside = dsp.lp(nz(n, seed + 1), 450) * grains(n, 6, seed + 2, .02, (.3, 1)) * 2.0
    buzz = bp(nz(n, seed + 3), 1200, 1.2) * (.5 + .5 * np.sin(2 * np.pi * 15 * t)) * .12
    out[:n] += panst((inside + buzz) * (.4 + .6 * u), 0)
    return out[:n] / np.abs(out[:n]).max()

def room_bed(N, dur, cut, back, seed=691):
    """the packing room by day: soft air, EXACTLY periodic over the film (circularly filtered noise, 3 breaths per film)
    so the loop has no seam: pink-ish 55 Hz - 1.4 kHz + a whisper of high air, decorrelated L/R; it leans in a little
    during the music's dead cut (cut -> back)"""
    t = np.arange(N) / SR; f = np.fft.rfftfreq(N, 1 / SR)
    shape = np.where(f > 55, 1 / np.sqrt(np.maximum(f, 1)), 0) / (1 + (f / 1400) ** 4)
    out = np.zeros((N, 2))
    for c in range(2):
        y = np.fft.irfft(np.fft.rfft(nz(N, seed + c)) * shape, N); y /= y.std()
        h = np.fft.irfft(np.fft.rfft(nz(N, seed + 10 + c)) * ((f > 3000) & (f < 9000)), N); h /= h.std()
        out[:, c] = y * .0020 + h * .0003
    breath = 1 + .22 * np.sin(2 * np.pi * 3 * t / dur + 1.0)
    lift = 1 + .45 * np.clip((t - cut - .25) / 1.2, 0, 1) * np.clip((back - t) / .5, 0, 1)
    return out * (breath * lift)[:, None]

# =====================================================================================================================
# music
# =====================================================================================================================
CH = {nm: (nm, tones, root) for nm, tones, root in mk.PROG_MINOR + mk.PROG}
CH['E7'] = ('E7', [64, 68, 71, 74], 52)
TENSE_CHORDS = {'enter': ['F#m', 'D'], 'boum': ['F#m'], 'stamp': ['D'], 'measure': ['C#m'], 'void': ['D', 'E7']}

def tense_plan(cues, mp):
    """stop-time segments of the F#-minor groove, anchored on the picture's hits: [{k, a, e, role, beat}]
    enter = music().tenseFrom · boum = the boum_carton cue · measure = the first tape-measure clac (its grid = the clacs'
    spacing) · void = the formula stamp after the clacs. Each segment stops BRK before the next anchor; the last at cut."""
    t0, cut = mp['tenseFrom'], mp['cut']
    ins = [c for c in cues if t0 + .3 < c['t'] < cut - .3]
    an = [(t0, 'enter', BEAT)]
    b = next((c['t'] for c in ins if c['name'] == 'boum_carton'), None)
    cl = [c['t'] for c in ins if c['name'] == 'clac']
    if b is not None: an.append((b, 'boum', BEAT))     # (the « AU m³ » stamp on « cube » is NOT an anchor: a band re-entry
                                                        #  under the word cost it 7 dB; the stamp stays an SFX on the word)
    if cl:
        bm = float(np.median(np.diff(cl))) if len(cl) > 1 else BEAT
        an.append((cl[0], 'measure', bm if .42 <= bm <= .6 else BEAT))   # 100-143 BPM, else the clacs ride the 120 grid
        f = next((c['t'] for c in ins if c['name'] == 'stamp' and c['t'] > cl[-1] + .05), None)
        if f is not None: an.append((f, 'void', BEAT))
    an.sort(); keep = [an[0]]
    for x in an[1:]:
        if x[0] - keep[-1][0] >= .6: keep.append(x)
    return [dict(k=k, a=a, e=(keep[k + 1][0] - BRK if k + 1 < len(keep) else cut), role=role, beat=bt)
            for k, (a, role, bt) in enumerate(keep)]

def compose_tense(M, segs, spans=()):
    gbar = 0
    for s in segs:
        k, a, e, role, bt = s['k'], s['a'], s['e'], s['role'], s['beat']
        def put(sig, t, g=1.0, p=0.0, _a=a, _e=e, _k=k):
            if _a - 1e-6 <= t < _e - 1e-6:
                M.put('groove', sig, t, g * G_TENSE, p, cut=True, tag='music_in' if (_k == 0 and t - _a < .02) else ('seg', _k))
        names = TENSE_CHORDS.get(role, ['F#m']); bl = 4 * bt; s16 = bt / 4
        nb = max(1, int(math.ceil((e - a) / bl - 1e-9)))
        for b in range(nb):
            tb = a + b * bl; ch = CH[names[min(b, len(names) - 1)]]; name, tones, root = ch
            mk.groove(put, tb, gbar, beat=bt, level='tense', prog=[ch] * 4)
            for j in range(16):
                tj = tb + j * s16 + (.012 if j % 2 else 0.0)
                if role != 'enter' and mk.RHY[j]:
                    put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4000 + 16 * gbar + j, mute=1), tj, .16, -.45)
                if role != 'enter' and j % 2 == 0: put(A.rattle(4100 + 16 * gbar + j, .045, .9, 1.0), tj, .22 if j % 4 == 0 else .15, .35)
                if role in ('measure', 'void') and j % 4 == 2: put(A.conga(62 if j % 8 == 2 else 57, 4300 + 16 * gbar + j, slap=j % 8 == 6), tj, .40, -.3)
                if role == 'void' and j % 4:
                    put(mk.guitar(m2f(tones[mk.PICK[j] % len(tones)] + 12), .2, bright=.62, decay=.99, seed=4200 + 16 * gbar + j, mute=.5), tj, .12, .45)
                if role == 'void' and b == nb - 1:
                    for h in range(2):
                        put(bk.balafon(m2f(tones[(j + h) % len(tones)] + 12 + (12 if j >= 8 else 0)), .25, 4400 + 32 * gbar + 2 * j + h),
                            tj + h * s16 / 2, .10 + .06 * j / 16, -.45)
            for q in range(4):
                tq = tb + q * bt
                if role in ('measure', 'void') and q % 2 == 1: put(mk.kick(), tq, .55)          # four on the floor
                if role == 'void' and q in (1, 3): put(A.clap(4500 + 4 * gbar + q), tq, .45, -.1)
            gbar += 1
        if role != 'enter':                                                                    # the band lands WITH the hit
            ch = CH[names[0]]; talking = any(x - .05 <= a <= y for x, y in spans)
            put(mk.kick(), a, .55)
            if not talking: put(I.stab([m - 12 for m in ch[1]], .18, 1.0), a, .55, 0)     # under a word: the kick only
        if s is segs[-1]:                                                                      # riser into the cut, killed by the gate
            d = min(2.2, e - a); n = ns(d + .1); u = np.clip(tt(n) / d, 0, 1)
            M.put('groove', dsp.tv_biquad(nz(n, 4600), 'bp', 900 * 7 ** u, 2.0) * u ** 1.8 * .6, e - d, .36 * G_TENSE, 0, cut=True, tag=('seg', k))

def compose_major1(M, a, stop, acc_t):
    """A-major full makossa from music().majorFrom (the E7 left hanging at the cut resolves) to the ENSUITE stop;
    the band breaks BRK before the band « ENSUITE : » and hits ON it (an E accent), an E pad bridges to the violet"""
    nb = max(1, int(math.ceil((stop - a) / 2.0 - 1e-9)))
    for b in range(nb):
        tb = a + 2.0 * b
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if t < stop - 1e-6: M.put('groove', sig, t, g * G_MAJOR, p, tag='major_in' if (_b == 0 and t - a < .02) else ('maj1', _b))
        mk.groove(put, tb, b, level='full', prog=mk.PROG)
        name, tones, root = mk.PROG[b % 4]
        for j in range(16):
            tj = tb + j * .125 + (.012 if j % 2 else 0.0)
            if j % 2 == 0: put(A.rattle(5300 + 16 * b + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
            if j in (6, 14): put(A.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * b + j, .6), tj, .16, -.4)
            if j % 8 == 4: put(A.conga(64 if j == 4 else 59, 5500 + 16 * b + j, slap=j == 12), tj, .30, -.3)
    tag = 'major_in'
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), a, 1.0 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], 2.2, 1.0), a, .55 * G_MAJOR, 0, tag=tag)
    M.put('groove', mk.kick(), a, .5 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.sfx_shimmer(5600, .5), a, .22 * G_MAJOR, 0, tag=tag)
    if acc_t is not None:
        tag = 'ensuite_hit'
        M.put('groove', mk.kick(), acc_t, .75 * G_MAJOR, 0, tag=tag); M.put('groove', mk.bass(m2f(40), .35, .6), acc_t, .5 * G_MAJOR, 0, tag=tag)
        M.put('groove', I.stab([52, 56, 59, 64], .14, 1.0), acc_t, .95 * G_MAJOR, 0, tag=tag); M.put('groove', A.clap(5650), acc_t, .35 * G_MAJOR, -.1, tag=tag)
        M.put('brand', A.soft_pad([64, 68, 71], .75, 1.0), acc_t, .35 * G_MAJOR, 0, tag=tag)

def brand_anchor(sig_t, stamp_t):
    """the violet grid: anchored so the « MESURÉ ✓ » stamp lands exactly on a beat, its downbeat next to the signature"""
    k = max(3, int(round((stamp_t - sig_t) / BEAT)))
    return stamp_t - k * BEAT, k

def compose_brand(M, sig_t, stamp_t):
    """violet section (« PAS REÇU. »'s brand sound): soft pad, bass and the bright balafon on the violet grid:
    D(add9, lydian with the signature's G#) -> E7sus4 (2 beats before the stamp) -> A at the stamp (compose_end)"""
    v0, nbt = brand_anchor(sig_t, stamp_t)
    put = lambda sig, t, g=1.0, p=0.0, tag=None: M.put('brand', sig, t, g * G_BRAND, p, tag=tag)
    beats = lambda b: v0 + b * BEAT
    sus = beats(nbt - 2)
    put(A.soft_pad([62, 66, 69, 76], sus - v0 + .35, 1.0), v0, .55, 0)
    put(A.soft_pad([64, 69, 71, 74], stamp_t - sus + .30, 1.0), sus, .55, 0)
    for b, m, d in ((0, 38, .9), (2, 33, .9), (4, 38, .45), (5, 37, .45), (6, 38, .9), (8, 33, .9)):
        if beats(b) < sus - .01: put(mk.bass(m2f(m), d, .3), beats(b), .40, 0)
    put(mk.bass(m2f(40), .45, .3), sus, .42, 0); put(mk.bass(m2f(35), .45, .3), sus + BEAT, .42, 0)
    pat = {2: 81, 3: 85, 5: 88, 6: 85, 8: 81, 9: 85, 10: 88, 11: 90}
    for e8, m in pat.items():
        if beats(e8 / 2) < sus - .01 and beats(e8 / 2) > sig_t + SIG_GAP + .1:
            put(A.balafon_bright(m, 5000 + e8), beats(e8 / 2), .20, -.3 + .2 * (e8 % 3))
    climb = [(0, 81), (.5, 83), (1, 86), (1.5, 88), (2, 88), (2.5, 91), (2.75, 93), (3.0, 95), (3.25, 98), (3.5, 100)]
    for e8, m in climb:
        tk = sus + e8 * BEAT / 2
        if tk < stamp_t - .01: put(A.balafon_bright(m, 5100 + int(e8 * 4)), tk, .17 + .025 * e8, -.2 + .15 * (int(e8 * 2) % 3))
    return v0, nbt

def compose_end(M, a, hit2, t_final):
    """A-major makossa from the « MESURÉ ✓ » stamp (arrival: stab, pad swell, kick, shimmer), a break BRK before the
    ritual stamp and the band slams back ON it, lighter (« lite »: no kick/bass/hats) under « Maintenant, tu sais. ».
    The last phrase is a slight ritardando (beat = (final - ritual stamp) / round(.. / .5), kept within .45-.58 s) so the
    final A chord (« -PAM », R.compose_final, on its cue) lands ON a downbeat; the band stops on an E accent (« pa- ») one
    beat before; choked by cut_dry"""
    segs = [(a, (hit2 - BRK) if hit2 else None)] + ([(hit2, None)] if hit2 else [])
    stop = None; bar = 0; beat2 = BEAT
    for si, (s0, s1) in enumerate(segs):
        bt = BEAT
        if s1 is None:                                                  # last phrase: a slight ritardando so the final chord
            k = max(2, int(round((t_final - s0) / BEAT)))               # lands ON a downbeat; the band stops one beat before it
            if .45 <= (t_final - s0) / k <= .58: bt = (t_final - s0) / k
            beat2 = bt; kk_ = int(math.floor((t_final - .3 - s0) / bt + 1e-9)); stop = s0 + max(kk_, 1) * bt; s1 = stop
        nb = max(1, int(math.ceil((s1 - s0) / (4 * bt) - 1e-9)))
        for b in range(nb):
            tb = s0 + 4 * bt * b
            def put(sig, t, g=1.0, p=0.0, _s1=s1, _si=si, _b=b):
                if t < _s1 - 1e-6: M.put('groove', sig, t, g * G_MAJOR, p, tag=('end', _si, _b))
            prog = mk.PROG[bar % 4]
            mk.groove(put, tb, 8 + bar, beat=bt, level='full' if si == 0 else 'lite', prog=[prog] * 4)
            name, tones, root = prog
            for j in range(16):
                tj = tb + j * bt / 4 + (.012 if j % 2 else 0.0)
                if j % 2 == 0: put(A.rattle(5800 + 16 * bar + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
                if si == 0 and j in (6, 14): put(A.balafon_bright(tones[(j // 6 + bar) % 4] + 12, 5900 + 16 * bar + j, .6), tj, .16, -.4)
                if si == 0 and j % 8 == 4: put(A.conga(64 if j == 4 else 59, 6000 + 16 * bar + j, slap=j == 12), tj, .30, -.3)
            bar += 1
        if si == 1:                                                     # back ON the ritual stamp
            M.put('groove', mk.kick(), s0, .6 * G_MAJOR, 0, tag='hit2_band'); M.put('groove', I.stab([57, 61, 64, 69], .18, 1.0), s0, .8 * G_MAJOR, 0, tag='hit2_band')
    tag = 'arrival_A'
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), a, 1.0 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], 2.2, 1.0), a, .55 * G_MAJOR, 0, tag=tag)
    M.put('groove', mk.kick(), a, .55 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.sfx_shimmer(6100, .5), a, .22 * G_MAJOR, 0, tag=tag)
    M.put('brand', I.bass_sub(33, .5), a, .35 * G_MAJOR, 0, tag=tag)
    if stop is not None and stop < t_final - .15:                       # the « pa- » on E: V -> I with the final chord
        M.put('groove', mk.kick(), stop, .7 * G_MAJOR, 0, tag='stop'); M.put('groove', mk.bass(m2f(40), .18, .6), stop, .5 * G_MAJOR, 0, tag='stop')
        M.put('groove', I.stab([52, 56, 59, 64], .10, 1.0), stop, .9 * G_MAJOR, 0, tag='stop'); M.put('groove', A.clap(6150), stop, .35 * G_MAJOR, -.1, tag='stop')
    return stop, beat2

# =====================================================================================================================
# compose everything
# =====================================================================================================================
def first(cues, name, after=-1.0, before=1e9):
    return next((c['t'] for c in cues if c['name'] == name and after < c['t'] < before), None)

def compose(sc, lines):
    T, DUR, cues, mp = sc['T'], sc['dur'], sc['cues'], sc['music']
    M = R.Mix(DUR); plan = {}
    # ---- voices ---------------------------------------------------------------------------------------------------
    vinfo = []
    for v in lines:
        y, t0, on, off, info = R.voice_line(v)
        M.put('vox', y, t0, 1.0, 0.0, tag=('vox', v['id']), fade=False)
        vinfo.append(dict(v, sig_len=len(y) / SR, t0=t0, t1=t0 + len(y) / SR, film_on=on, film_off=off, **info))
    # ---- music ----------------------------------------------------------------------------------------------------
    segs = tense_plan(cues, mp); compose_tense(M, segs, [(v['film_on'], v['film_off']) for v in vinfo]); plan['segs'] = segs
    t_final = first(cues, 'final_chord') or DUR - .5
    t_dry = first(cues, 'cut_dry') or DUR - .02
    ens = first(cues, 'whoosh', mp['majorFrom'] + 1.0, mp['sigAt'])                 # the « ENSUITE : » band (the whoosh before the brand)
    m1_stop = (ens - BRK) if ens else mp['sigAt'] - .6
    compose_major1(M, mp['majorFrom'], m1_stop, ens); plan['major1'] = dict(a=mp['majorFrom'], stop=m1_stop, accent=ens)
    stamp_ok = first(cues, 'stamp', mp['sigAt'], t_final)                            # « MESURÉ ✓ »
    hit2 = first(cues, 'stamp_big', stamp_ok or mp['sigAt'], t_final - .6)
    if stamp_ok:
        v0, nbt = compose_brand(M, mp['sigAt'], stamp_ok); plan['brand'] = dict(v0=v0, beats=nbt, stamp=stamp_ok)
        stop, beat2 = compose_end(M, stamp_ok, hit2, t_final)
    else:
        stop, beat2 = compose_end(M, mp['sigAt'] + 1.0, hit2, t_final)
    plan['end'] = dict(a=stamp_ok, hit2=hit2, stop=stop, final=t_final, dry=t_dry, beat2=beat2)
    # ---- the day room ------------------------------------------------------------------------------------------------
    plan['back'] = mp['majorFrom']
    M.put('amb', room_bed(ns(DUR), DUR, mp['cut'], mp['majorFrom']), 0.0, 1.0, fade=False)
    # ---- cues -------------------------------------------------------------------------------------------------------
    unknown = []; ntic = 0
    talking = lambda x: any(v['film_on'] - .02 <= x <= v['film_off'] for v in vinfo)
    for i, c in enumerate(cues):
        t, name, g, pan = c['t'], c['name'], c.get('g', 1), c.get('pan', 0); tag = ('cue', i); sd = 7000 + 37 * i
        nxt = lambda nm, _t=t: first(cues, nm, _t + 1e-6)
        P = lambda stem, sig, gain, p=pan, fade=True: M.put(stem, sig, t, gain, p, tag=tag, fade=fade)
        if name == 'pouf_air': P('hit', sfx_pouf_air(), .85 * g, 0)
        elif name == 'carton_creak': P('sfx', sfx_carton_creak(), .48 * g / .7, .15)
        elif name == 'kaching_soft': P('sfx', sfx_kaching_soft(), .20 * g / .55)
        elif name == 'gecko_skitter': P('sfx', sfx_skitter(), .25 * g / .35)
        elif name == 'boing': P('sfx', sfx_boing(), .26 * g / .6)
        elif name == 'whoosh_low': P('sfx', sfx_whoosh_low((nxt('boum_carton') or t + .7) - t), .30 * g / .4, 0)
        elif name == 'boum_carton': P('hit', sfx_boum_carton(), 1.0 * g, 0)
        elif name == 'letters_splash': P('sfx', sfx_letters_splash(), .40 * g / .7, 0)
        elif name == 'stamp': P('hit', sfx_stamp_carton(sd), .66 * g * (.7 if talking(t) else 1.0), .1)   # on a word: -3 dB
        elif name == 'clac': P('hit', sfx_tape_clac(sd), .66 * g / .9)
        elif name == 'felt': P('sfx', sfx_felt(sd), .22 * g / .45, .1)
        elif name == 'paper_lift': P('sfx', sfx_paper_lift(), .30 * g / .7, .1)
        elif name == 'fill_fffff': P('sfx', sfx_fill((nxt('tic') or t + 1.5) - t - .03), .14 * g / .6, 0)
        elif name == 'tic': P('sfx', sfx_tic(sd, 2650 if ntic == 0 else 3150), .55 * g / .6); ntic += 1
        elif name in ('music_cut', 'cut_dry'): pass                                    # the gates (mixdown)
        elif name == 'cricket': P('amb', A.sfx_cricket(), .16 * g / .5, -.6)
        elif name == 'sweat_drop': P('sfx', R.sfx_plic(sd), .30 * g / .7, .15)
        elif name == 'carton_fold':                                                    # lands on the pose squash (pose + .2)
            pose = max([d['t'] for d in cues if d['name'] in ('cutter',) and t - .12 <= d['t'] < t] or [t])
            P('sfx', sfx_carton_fold(sd, pose + .2 - t), .32 * g / .8)
        elif name == 'cutter': P('sfx', sfx_cutter(), .38 * g / .7, .1)
        elif name == 'pffuit': P('sfx', sfx_pffuit(sd), .26 * g / .6)
        elif name == 'scotch_scriiitch':
            y = sfx_scotch(); off = [v['film_off'] for v in vinfo if t <= v['film_off'] < t + .15]
            if off:                                                                    # « …remplis » still ending: let it finish
                d = off[0] + .03 - t; r_ = dsp.undb(-12 * (1 - smooth01(tt(len(y)) / d)))
                y = y * r_[:, None]; plan['scotch_head'] = dict(until=off[0] + .03, db=-12)
            P('asmr', y, .31 * g / 1.1)
        elif name == 'gloup': P('sfx', R.sfx_gloup(0, sd), .28 * g / .8)
        elif name == 'whoosh': P('sfx', sfx_whoosh(sd, .34, -.5, .5), .28 * g / .5)
        elif name == 'gauge_fill': P('sfx', sfx_gauge_fill(sd, .7, 1.0 if pan < 0 else .45), .16 * g / .4)
        elif name == 'hic': P('sfx', R.sfx_hic(), .45 * g / .6)
        elif name == 'pop_soft': P('sfx', I.pop(sd), .26 * g / .5)
        elif name == 'bubble_wrap': P('sfx', sfx_bubble_wrap((nxt('bubble_plop') or t + 1.2) - t - .04), .18 * g / .6)
        elif name == 'bubble_plop': P('hit', sfx_bubble_plop(), .75 * g / .8)
        elif name == 'pill_drop': P('sfx', sfx_pill_drop(), .22 * g / .4, -.2)
        elif name == 'violet_hum': P('brand', sfx_violet_hum(), .16 * g / .4, 0)
        elif name == 'bonzini_sig':                                                    # the series signature, unchanged
            M.put('brand', A.balafon_bright(88, 5800, 1.2), t, .17 * g, -.15, tag=tag)
            M.put('brand', A.balafon_bright(92, 5801, 1.0), t + SIG_GAP, .18 * g, .15, tag=tag)
            M.put('brand', A._bell(m2f(100), .8, .3, 1, .002) * .5, t + SIG_GAP, .06 * g, .15, tag=tag)
            plan['sig'] = (t, t + SIG_GAP)
        elif name == 'tonk': P('sfx', R.sfx_tonk(), .38 * g / .8, 0)
        elif name == 'label_slap': P('sfx', sfx_label_slap(), .50 * g / .5, .15)
        elif name == 'bip': P('sfx', sfx_scan_bip(), .16 * g / .8)
        elif name == 'tape_measure': P('sfx', sfx_tape_measure(), .42 * g / .8, .1)
        elif name == 'marker_strike': P('sfx', sfx_marker_strike(), .24 * g / .6)
        elif name == 'whoosh_soft': P('sfx', sfx_whoosh(sd, .30, .45, -.15, 300, 2200, .4), .30 * g / .5)
        elif name == 'pop': P('sfx', I.pop(sd), .40 * g / .7, 0)
        elif name == 'stamp_big': P('hit', sfx_stamp_big(), 1.0 * g, 0)
        elif name == 'carton_rattle': P('sfx', sfx_carton_rattle(DUR - t), .32 * g / .6, 0, fade=False)
        elif name == 'final_chord': R.compose_final(M, t, tag)
        else:                                                                          # a cue added later by the visual team
            fam = next((k for k in ('whoosh', 'stamp', 'pop', 'tic', 'clac', 'fold', 'paper') if k in name), None)
            sig = {'whoosh': lambda: sfx_whoosh(sd), 'stamp': lambda: sfx_stamp_carton(sd), 'pop': lambda: I.pop(sd),
                   'tic': lambda: sfx_tic(sd), 'clac': lambda: sfx_tape_clac(sd), 'fold': lambda: sfx_carton_fold(sd),
                   'paper': lambda: sfx_paper_lift(sd)}.get(fam)
            if sig: P('sfx', sig(), .25 * g); unknown.append(f'{name}~{fam}')
            else: unknown.append(name)
    return M, vinfo, unknown, plan

# =====================================================================================================================
# render + mix
# =====================================================================================================================
def render(M, sc, fx=True):
    DUR, cut = sc['dur'], sc['music']['cut']
    N = ns(DUR + TAIL); raw = {}
    for stem, sig, t, g, p, c, tag in M.ev:
        k = (stem, c)
        if k not in raw: raw[k] = np.zeros((N, 2))
        R.place_at(raw[k], R.stereo_of(sig, g, p), ns(t))
    ir = R.irs(); gc = R.gate(N, cut); out = {}; dry_vox = None
    for (stem, c), x in raw.items():
        if stem == 'vox': dry_vox = x.copy()
        s = SENDS.get(stem)
        if s and fx: x = x + dsp.reverb(x, ir[s[0]], wet=s[1])
        if c: x = x * gc[:, None]
        out[stem] = out.get(stem, 0) + x
    for k in ('vox', 'groove', 'brand', 'final', 'sfx', 'hit', 'asmr', 'amb'):
        if k not in out: out[k] = np.zeros((N, 2))
    return out, dry_vox

def mixdown(st, dry_vox, sc, spans, t_back, t_dry):
    """stems -> ducked stems + premaster (N = DUR exactly); the music hole (cut -> next music) and the dry end are
    applied AFTER every filter so they stay digital silence"""
    DUR = sc['dur']; N = ns(DUR)
    d1, act = R.duck_db(dry_vox[:N], spans)
    st = {k: v[:N].copy() for k, v in st.items()}
    for k, depth in DUCKED.items(): st[k] *= dsp.undb(d1 * depth)[:, None]
    for k in ('groove', 'brand'): st[k] = R.carve(st[k], d1)
    hole = R.gate(N, sc['music']['cut'], t_on=t_back)
    dry = R.gate(N, t_dry, fade=.012)
    head = np.ones(N); head[:ns(sc['music']['tenseFrom'])] = 0.0                # the zero-phase carve pre-rings a few 1e-3: no music before it
    for k in MUSIC: st[k] *= (hole * dry * head)[:, None]
    music = sum(st[k] for k in MUSIC)
    P = A.sclip(music, .7) + st['sfx'] + A.sclip(st['hit'], .5) + st['asmr'] + st['amb'] + st['vox']
    return st, P, d1, act

# =====================================================================================================================
# checks + build
# =====================================================================================================================
def grid_rows(sc, plan):
    """every musical hit vs the grid in force: tense segments (anchor + beat), violet grid, end grids"""
    cues, rows = sc['cues'], []
    for c in cues:
        if c['name'] not in ('boum_carton', 'stamp', 'clac'): continue
        seg = [s for s in plan['segs'] if s['a'] - 1e-6 <= c['t'] < s['e'] + BRK + 1e-6]
        if not seg: continue
        s = seg[-1]; x = (c['t'] - s['a']) / s['beat']; k = round(x)
        k16 = round(x * 4) / 4
        rows.append(dict(name=c['name'], t=c['t'], grid=f"{s['role']} #{s['k']}", beat=s['a'] + k * s['beat'], err=(x - k) * s['beat'] * 1000,
                         err16=(x - k16) * s['beat'] * 1000))
    b = plan.get('brand')
    if b:
        for nm, tc in (('sig note 1', plan.get('sig', (None,))[0]), ('sig note 2', plan.get('sig', (None, None))[1]), ('MESURÉ stamp', b['stamp'])):
            if tc is None: continue
            x = (tc - b['v0']) / BEAT; k = round(x); k16 = round(x * 4) / 4
            rows.append(dict(name=nm, t=tc, grid='violet', beat=b['v0'] + k * BEAT, err=(x - k) * BEAT * 1000, err16=(x - k16) * BEAT * 1000))
    e = plan['end']
    if e.get('hit2'):
        rows.append(dict(name='ritual stamp', t=e['hit2'], grid='end (anchor)', beat=e['hit2'], err=0.0, err16=0.0))
        b2 = e.get('beat2', BEAT); x = (e['final'] - e['hit2']) / b2; k = round(x)
        rows.append(dict(name='stop accent', t=e['stop'], grid=f'end rit. {60 / b2:.0f}bpm', beat=e['stop'], err=0.0, err16=0.0))
        rows.append(dict(name='final chord', t=e['final'], grid=f'end rit. {60 / b2:.0f}bpm', beat=e['hit2'] + k * b2, err=(x - k) * b2 * 1000,
                         err16=(x - round(x * 4) / 4) * b2 * 1000))
    return rows

def cue_level(M, tag, G):
    """max momentary loudness (400 ms) of a cue's own events rendered alone, dry, post master gain"""
    evs = [e for e in M.ev if e[6] == tag]
    if not evs: return None
    t0 = min(e[2] for e in evs); t1 = max(e[2] + len(e[1]) / SR for e in evs)
    buf = np.zeros((ns(t1 - t0) + ns(.45), 2))
    for e in evs: R.place_at(buf, R.stereo_of(e[1], e[3], e[4]), ns(e[2] - t0))
    _, lm = dsp.lufs_momentary(buf * G, .02)
    return float(np.max(lm)) if len(lm) else None

def build(sheet=False):
    import soundfile as sf, pyloudnorm as pyln
    try:
        if os.nice(0) < 5: os.nice(5 - os.nice(0))
    except Exception: pass
    sc = score(); T, DUR, mp = sc['T'], sc['dur'], sc['music']; N = ns(DUR)
    lines = voice_plan()
    log(f'[E2] score: {sc["src"]} · {len(sc["cues"])} cues · DUR {DUR} s · music {json.dumps({k: round(v, 3) for k, v in mp.items()})}')
    M, vinfo, unknown, plan = compose(sc, lines)
    if unknown: log('[E2] WARNING cue names without a dedicated sound:', unknown)
    log(f'[E2] {len(M.ev)} events · rendering')
    st, dry_vox = render(M, sc)
    seg_rows = []
    for s in plan['segs']:
        ne = sum(1 for ev in M.ev if ev[6] == ('seg', s['k']) or (s['k'] == 0 and ev[6] == 'music_in'))
        seg_rows.append(dict(s, events=ne, rate=ne / (s['e'] - s['a']), lufs=float(dsp.lufs_integrated(st['groove'][ns(s['a']):ns(s['e'])]))))
    t_back = min(e[2] for e in M.ev if e[0] in MUSIC and not e[5] and e[2] > mp['cut'])
    t_dry = plan['end']['dry']
    st, P, d1, act = mixdown(st, dry_vox, sc, [(v['film_on'], v['film_off']) for v in vinfo], t_back, t_dry)
    Y, g, gl = R.master(P)
    tp = R.true_peak_db(Y); ceil = -1.3
    while tp > -1.0 and ceil > -3:
        ceil -= (tp + 1.0) + .05; Y, g, gl = R.master(P, ceiling=ceil); tp = R.true_peak_db(Y)
    assert len(Y) == N
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'vox': st['vox'], 'music': sum(st[k] for k in MUSIC), 'sfx': st['sfx'], 'hits': st['hit'], 'asmr': st['asmr'], 'amb': st['amb']}
    for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    # ---------------- checks ----------------
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    rep = dict(sr=sr, n=len(Z), dur=len(Z) / sr, channels=Z.shape[1], master_gain_db=g, limiter_ceiling_db=ceil,
               lufs=meter.integrated_loudness(Z), tp_dbtp=R.true_peak_db(Z), sample_peak_db=20 * math.log10(np.abs(Z).max()),
               max_gr_db=float(-20 * np.log10(gl.min())), clipped=int((np.abs(Z) >= .9999).sum()), src=sc['src'], lra=R.lra(Z),
               dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())], unknown=unknown)
    rep['seam'] = dict(step=float(np.abs(Z[0] - Z[-1]).max()), local_p99=float(np.percentile(np.abs(np.diff(Z[-ns(.03):], axis=0)), 99)))
    mus = stems['music'] * G; vox = stems['vox'] * G; rest = (stems['sfx'] + stems['hits'] + stems['asmr'] + stems['amb']) * G
    vox_ph, oth_ph = R.phone(vox), R.phone(mus + rest)
    em = R.env_db(mus)
    def music_off(t):
        pre = em[max(0, ns(t - .3)):ns(t - .01)].max()
        nzi = np.nonzero(em[ns(t - .3):ns(t + .2)] > pre * 1e-3)[0]
        return (ns(t - .3) + int(nzi.max())) / SR if len(nzi) else None
    rows = []
    for i, c in enumerate(sc['cues']):
        t, name = c['t'], c['name']
        if name in ('music_cut', 'cut_dry'):
            off = music_off(t); post = float(np.abs(mus[ns(t):(ns(t_back) if name == 'music_cut' else N)]).max())
            rows.append(dict(t=t, name=name, kind='music off -60dB', on=off, err=None if off is None else (off - t) * 1000, mix=None, mix_err=None,
                             lvl=None, note=f'music max |x| after = {post:.1e}'))
            continue
        o, _ = R.iso_onset(M, ('cue', i))
        if o is None: rows.append(dict(t=t, name=name, kind='-', on=None, err=None, mix=None, mix_err=None, lvl=None, note='no event')); continue
        f = A.flux_onset(Z, t)
        rows.append(dict(t=t, name=name, kind='alone', on=o, err=(o - t) * 1000, mix=f, mix_err=None if f is None else (f - t) * 1000,
                         lvl=cue_level(M, ('cue', i), G), note=''))
    for tag, tref, note in (('music_in', mp['tenseFrom'], 'music().tenseFrom'), ('major_in', mp['majorFrom'], 'music().majorFrom'),
                            ('ensuite_hit', plan['major1']['accent'], 'ENSUITE accent (whoosh cue)'),
                            ('arrival_A', plan['end']['a'], 'A arrival = MESURÉ stamp'), ('hit2_band', plan['end']['hit2'], 'band back ON the ritual stamp')):
        if tref is None: continue
        o, _ = R.iso_onset(M, tag)
        if o is None: continue
        f = A.flux_onset(Z, tref)
        rows.append(dict(t=tref, name=tag, kind='alone', on=o, err=(o - tref) * 1000, mix=f, mix_err=None if f is None else (f - tref) * 1000,
                         lvl=cue_level(M, tag, G), note=note))
    if plan.get('sig'):                                                    # the signature's 2nd note (not a separate cue)
        s2 = plan['sig'][1]; evs = [e for e in M.ev if e[6] and e[6][0] == 'cue' and abs(e[2] - s2) < 1e-9]
        rows.append(dict(t=s2, name='sig note 2', kind='placed', on=evs[0][2] if evs else None, err=0.0 if evs else None, mix=A.flux_onset(Z, s2),
                         mix_err=None, lvl=None, note='G#6, SIG_GAP after note 1'))
        if rows[-1]['mix'] is not None: rows[-1]['mix_err'] = (rows[-1]['mix'] - s2) * 1000
    rep['cues'] = rows
    rep['cues_ok'] = all(r['err'] is not None and abs(r['err']) <= 15 for r in rows)
    rep['grid'] = grid_rows(sc, plan); rep['segments'] = seg_rows; rep['plan'] = plan
    # voices
    vrows = []; prev = None
    for v in vinfo:
        a, b = ns(v['film_on']), ns(v['film_off'])
        ev = R.env_db(vox, .01); seg = ev[ns(v['t0']):ns(v['t1'])]; thr = seg.max() * 10 ** (-30 / 20)
        nzi = np.nonzero(seg > thr)[0]; m_on, m_off = v['t0'] + nzi[0] / SR, v['t0'] + nzi[-1] / SR
        pm = R.kpow(mus, a, b); no_music = pm < 1e-12
        margin = 10 * math.log10(R.kpow(vox, a, b) / pm)
        margin_all = 10 * math.log10(R.kpow(vox, a, b) / R.kpow(mus + rest, a, b))
        wm = []; lp = R.kpow(vox, a, b); nskip = 0
        for w in v['words']:
            wa = ns(v['at'] + max(w['s'], v['on']) * v['stretch']); wb = ns(v['at'] + min(w['e'], v['off']) * v['stretch'])
            if wb - wa > ns(.04) and R.kpow(vox, wa, wb) < lp * .01: nskip += 1; continue
            if wb - wa > ns(.04): wm.append((w['w'], 10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus, wa, wb)),
                                             10 * math.log10(R.kpow(vox, wa, wb) / R.kpow(mus + rest, wa, wb)),
                                             10 * math.log10(R.kpow(vox_ph, wa, wb) / R.kpow(oth_ph, wa, wb))))
        vrows.append(dict(id=v['id'], file=v['file'], at=v['at'], stretch=v['stretch'], t0=v['t0'], t1=v['t1'], on=v['film_on'], off=v['film_off'],
                          T=T.get(v['id']), m_on=m_on, m_off=m_off, margin=margin, no_music=no_music, margin_all=margin_all,
                          word_min=min((x[1] for x in wm), default=None), word_min_all=min((x[2] for x in wm), default=None),
                          word_worst=min(wm, key=lambda x: x[2])[0] if wm else None, words_checked=len(wm), words_pause=nskip,
                          gap=None if prev is None else v['t0'] - prev['t1'], speech_gap=None if prev is None else v['film_on'] - prev['film_off'],
                          phone=10 * math.log10(R.kpow(vox_ph, a, b) / R.kpow(oth_ph, a, b)),
                          phone_word_min=min((x[3] for x in wm), default=None), phone_word=min(wm, key=lambda x: x[3])[0] if wm else None,
                          lufs=float(dsp.lufs_integrated(vox[ns(v['t0']):ns(v['t1'])])), deess=v['deess_max_db'], words_m=wm))
        prev = v
    rep['voices'] = vrows
    rep['voices_overlap'] = any(r['gap'] is not None and r['gap'] < 0 for r in vrows)
    rep['voices_ok'] = (not rep['voices_overlap']) and all(r['margin'] >= 10 for r in vrows)
    a_, b_ = ns(mp['cut']), ns(t_back)
    rep['cut'] = dict(t=mp['cut'], t_back=t_back, music_max=float(np.abs(mus[a_:b_]).max()),
                      music_pre_rms_db=20 * math.log10(np.sqrt(np.mean(mus[a_ - ns(.5):a_] ** 2)) + 1e-12),
                      mix_rms_db=20 * math.log10(np.sqrt(np.mean(Z[a_:b_] ** 2)) + 1e-12),
                      amb_rms_db=20 * math.log10(np.sqrt(np.mean((stems['amb'] * G)[a_:b_] ** 2)) + 1e-12))
    rep['dry'] = dict(t=t_dry, music_max_after=float(np.abs(mus[ns(t_dry):]).max()))
    rep['silent_head'] = dict(until=mp['silentUntil'], music_max=float(np.abs(mus[:ns(mp['silentUntil'])]).max()))
    rep['duck_max_db'] = float(-d1.min() * DUCK_DB)
    # the ASMR tape vs the voices
    sc_t = first(sc['cues'], 'scotch_scriiitch')
    if sc_t is not None:
        _, lm_mix = dsp.lufs_momentary(Z, .02); _, lm_asmr = dsp.lufs_momentary(stems['asmr'] * G, .02); tm_, lm_v = dsp.lufs_momentary(vox, .02)
        w = (tm_ >= sc_t) & (tm_ < sc_t + .9); vv = lm_v[lm_v > -50]
        sc_sig = (stems['asmr'] * G)[ns(sc_t):ns(sc_t + .8)].mean(1); spec = np.abs(np.fft.rfft(sc_sig)); fr = np.fft.rfftfreq(len(sc_sig), 1 / SR)
        rep['asmr'] = dict(t=sc_t, scotch_lufs_m=float(lm_asmr[w].max()), voice_lufs_m_median=float(np.median(vv)),
                           voice_lufs_m_p90=float(np.percentile(vv, 90)), mix_lufs_m=float(lm_mix[w].max()),
                           music_in_window=float(np.abs(mus[ns(sc_t):ns(sc_t + .9)]).max()),
                           centroid_hz=float((spec ** 2 * fr).sum() / (spec ** 2).sum()))
    # report
    log(f'[E2] mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s @ {sr} Hz x{rep["channels"]} · {rep["lufs"]:.2f} LUFS · TP {rep["tp_dbtp"]:.2f} dBTP · '
        f'sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master {g:+.2f} dB · limiter max GR '
        f'{rep["max_gr_db"]:.1f} dB (ceiling {ceil:.2f}) · clipped {rep["clipped"]}')
    log('[E2] cues (alone = the cue\'s own events rendered alone, 10 % of the max of a 1-ms envelope; mix = spectral-flux onset in mix.wav; '
        'LUFS-M = the cue alone, post master gain)')
    for r in rows:
        log(f'    {r["t"]:7.3f}  {r["name"]:16s} {r["kind"]:15s} {fm(r["err"], "+6.1f", "   -  ", " ms")}   mix {fm(r["mix_err"], "+6.1f", "   -  ", " ms")}'
            f'   {fm(r["lvl"], "6.1f", "    - ", " LUFS-M")}  {r["note"]}')
    log(f'[E2] cues within 15 ms: {rep["cues_ok"]}')
    log('[E2] tense segments: ' + ' · '.join(f'#{r["k"]} {r["role"]} {r["a"]:.3f}-{r["e"]:.3f} beat {r["beat"]:.3f} {r["rate"]:.0f} ev/s {r["lufs"]:.1f} LUFS'
                                           for r in seg_rows))
    log('[E2] grid: ' + ' · '.join(f'{x["name"]}@{x["t"]:.3f} [{x["grid"]}] {x["err"]:+.0f} (16th {x["err16"]:+.0f}) ms' for x in rep['grid']))
    log('[E2] voices')
    for r in vrows:
        log(f'    {r["id"]:3s} {r["file"]:10s} speech {r["on"]:7.3f}-{r["off"]:7.3f} (T {r["T"]}) measured {r["m_on"]:7.3f}-{r["m_off"]:7.3f} · '
            f'over music {"no music" if r["no_music"] else format(r["margin"], "5.1f") + " dB"} (worst word {fm(r["word_min"], ".1f")}) · over all '
            f'{r["margin_all"]:5.1f} dB (worst word {r["word_worst"]} {fm(r["word_min_all"], ".1f")}) · phone {r["phone"]:5.1f} (worst {r["phone_word"]} '
            f'{fm(r["phone_word_min"], ".1f")}) · gap {fm(r["gap"], ".3f")} · {r["lufs"]:.1f} LUFS')
    if '--words' in sys.argv:
        for r in vrows: log(f'    {r["id"]}: ' + ' '.join(f'{w}[{a:+.0f}/{b:+.0f}/{c:+.0f}]' for w, a, b, c in r['words_m']) + '   (word: over music / over all / phone)')
    log(f'[E2] voices overlap: {rep["voices_overlap"]} · all >= 10 dB over the music: {all(r["margin"] >= 10 for r in vrows)}')
    log(f'[E2] head silent until {mp["silentUntil"]:.3f}: music max |x| {rep["silent_head"]["music_max"]:.1e} · cut at {mp["cut"]:.3f}: music max |x| '
        f'{rep["cut"]["music_max"]:.1e} until the next music at {t_back:.3f} (pre-cut {rep["cut"]["music_pre_rms_db"]:.1f} dBFS RMS; mix in the hole '
        f'{rep["cut"]["mix_rms_db"]:.1f}, room {rep["cut"]["amb_rms_db"]:.1f} dBFS RMS) · after cut_dry {t_dry:.3f}: music max {rep["dry"]["music_max_after"]:.1e}')
    if 'asmr' in rep:
        a = rep['asmr']
        log(f'[E2] ASMR tape at {a["t"]:.3f}: {a["scotch_lufs_m"]:.1f} LUFS-M alone (voices: median {a["voice_lufs_m_median"]:.1f}, p90 '
            f'{a["voice_lufs_m_p90"]:.1f}) · mix {a["mix_lufs_m"]:.1f} · music under it max {a["music_in_window"]:.1e} · centroid {a["centroid_hz"]:.0f} Hz')
    log(f'[E2] loop seam (end -> start): step {rep["seam"]["step"]:.4f} vs local p99 {rep["seam"]["local_p99"]:.4f}')
    if sheet: make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, M)
    return rep

# =====================================================================================================================
# sheet
# =====================================================================================================================
def make_sheet(Z, stems, G, d1, rep, sc, vinfo, plan, M, path=SHEET):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    T, DUR, mp, cues = sc['T'], sc['dur'], sc['music'], sc['cues']
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#120d1e', 'figure.facecolor': '#0b0814', 'text.color': '#e8e2f4',
                         'axes.labelcolor': '#e8e2f4', 'xtick.color': '#b9b0cc', 'ytick.color': '#b9b0cc', 'axes.edgecolor': '#3a3050'})
    fig = plt.figure(figsize=(22, 34), dpi=100)
    fig.subplots_adjust(top=.955, bottom=.01, left=.045, right=.965)
    gs = fig.add_gridspec(9, 12, height_ratios=[3.4, 1.0, 2.3, 1.55, 1.7, 1.7, 1.35, 1.75, 1.9], hspace=.5, wspace=.5)
    hot = {'pouf_air': '#ff5a5a', 'boum_carton': '#ff5a5a', 'stamp_big': '#ff5a5a', 'stamp': '#ff8a3a', 'clac': '#ff8a3a',
           'scotch_scriiitch': '#7fffd4', 'bubble_plop': '#7fffd4', 'carton_fold': '#7fffd4', 'cutter': '#7fffd4',
           'bonzini_sig': '#b48cff', 'violet_hum': '#b48cff', 'tonk': '#b48cff', 'final_chord': '#ffd84a',
           'music_cut': '#3ee0ff', 'cut_dry': '#3ee0ff'}
    ccol = lambda nm: hot.get(nm, '#9fe08a')
    vcol = lambda lid: '#ffb24a' if lid.startswith('T') else '#e8e2f4'
    xt = np.arange(0, DUR + .01, 1.0); m = Z.mean(1)
    def marks(ax, labels=False):
        ax.axvspan(mp['cut'], mp['majorFrom'], color='#3ee0ff', alpha=.06)
        for c in cues: ax.axvline(c['t'], ymin=.94 if labels else 0, ymax=1, color=ccol(c['name']), lw=.9, alpha=.9 if labels else .22)
    def spec(ax, x, a0, a1, nper, top_pct, rng_db, fl):
        f, t, S_ = sps.stft(x, SR, nperseg=nper, noverlap=nper - nper // 16)
        P = 20 * np.log10(np.abs(S_) + 1e-9); rr = np.interp(fl, f, np.arange(len(f))); Pi = P[np.round(rr).astype(int)]; top = np.percentile(Pi, top_pct)
        ax.pcolormesh(t + a0, fl, Pi, vmin=top - rng_db, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(fl[0], fl[-1]); ax.set_xlim(a0, a1)
    # 1 spectrogram
    ax = fig.add_subplot(gs[0, :])
    spec(ax, m, 0, DUR, 4096, 99.8, 85, np.geomspace(30, 18000, 420)); ax.set_xticks(xt); ax.set_ylabel('Hz')
    ax.set_title('mix.wav — log spectrogram · cue ticks + names (top) · speech spans (bottom bars: amber = TOI, white = narrator) · '
                 'cyan = music TOTAL cut window (music().cut -> majorFrom) · gold ticks = musical anchors', loc='left', pad=78)
    marks(ax, True)
    for c in cues: ax.text(c['t'], 19500, c['name'], rotation=90, fontsize=6.2, va='bottom', ha='center', color=ccol(c['name']))
    for v in vinfo:
        ax.plot([v['film_on'], v['film_off']], [36, 36], color=vcol(v['id']), lw=6, solid_capstyle='butt')
        ax.text((v['film_on'] + v['film_off']) / 2, 41, v['id'], ha='center', fontsize=8, color='w')
    lab = [(0, 'no music: POUF · creak · ka-ching'), (mp['tenseFrom'], 'TENSE F#m stop-time'), (mp['cut'], 'CUT · cricket · sweat · packing ASMR'),
           (mp['majorFrom'], 'A MAJOR'), (plan['major1']['accent'] or mp['sigAt'] - .5, 'ENSUITE'), (mp['sigAt'], 'violet: sig · pad · balafon'),
           ((plan['end']['a'] or mp['sigAt'] + 3), 'A makossa · end card'), (plan['end']['final'], 'final')]
    for x0, lb in lab: ax.text(x0 + .05, 60, lb, fontsize=7.5, color='w', alpha=.9)
    anchors = [s['a'] for s in plan['segs']] + [mp['majorFrom']] + ([plan['brand']['v0']] if plan.get('brand') else []) + [x for x in (plan['end']['a'], plan['end']['hit2']) if x]
    for a in anchors: ax.axvline(a, ymin=0, ymax=.05, color='#ffd84a', lw=1.6)
    # 2 waveform
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#c9b6ff'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, DUR); ax.set_ylim(-1, 1); ax.set_xticks(xt)
    for s in (1, -1): ax.axhline(s * 10 ** (-1 / 20), color='r', lw=.5, ls='--')
    ax.set_title(f'waveform (L up / |R| down) · ±1 dBFS lines · TP {rep["tp_dbtp"]:.2f} dBTP · sample peak {rep["sample_peak_db"]:.2f} dBFS', loc='left'); marks(ax)
    # 3 levels
    ax = fig.add_subplot(gs[2, :])
    def mom(x, hop=.02): tm, lm = dsp.lufs_momentary(x, hop); return tm, np.maximum(lm, -80)
    for x, lb, col, lw in ((Z, 'mix', '#ffffff', 1.2), (stems['vox'] * G, 'voices', '#ffb24a', 1.0), (stems['music'] * G, 'music (ducked)', '#3ee0ff', 1.0),
                           ((stems['sfx'] + stems['hits']) * G, 'sfx + impacts', '#ff5a5a', .8), (stems['asmr'] * G, 'ASMR (tape, plop)', '#7fffd4', 1.0),
                           (stems['amb'] * G, 'room + cricket', '#9fe08a', .7)):
        tm, lm = mom(x); ax.plot(tm, lm, color=col, lw=lw, label=lb)
    ts, ls = dsp.lufs_shortterm(Z, .05); ax.plot(ts, ls, color='#ffd84a', lw=1, ls='--', label='mix short-term (3 s)')
    for v in vinfo: ax.axvspan(v['film_on'], v['film_off'], color=vcol(v['id']), alpha=.08)
    for r in rep['voices']:
        txt = 'no\nmusic' if r['no_music'] else f'+{r["margin"]:.1f}'
        ax.text((r['on'] + r['off']) / 2, -5, f'{r["id"]}\n{txt}', ha='center', va='top', fontsize=7.5,
                color='#9fe08a' if (r['no_music'] or r['margin'] >= 10) else '#ff5a5a')
    ax.set_xlim(0, DUR); ax.set_ylim(-75, -2); ax.set_xticks(xt); ax.axhline(-14, color='w', lw=.5, ls=':')
    ax2 = ax.twinx(); ax2.plot(np.arange(len(d1))[::240] / SR, d1[::240] * DUCK_DB, color='#ff7ad9', lw=1, label='music duck (dB)')
    ax2.set_ylim(-40, 2); ax2.set_ylabel('duck dB', color='#ff7ad9')
    ax.legend(loc='lower left', ncol=7, fontsize=7, facecolor='#120d1e'); ax2.legend(loc='lower right', fontsize=7, facecolor='#120d1e')
    ax.set_title(f'momentary loudness (400 ms) per stem, post master gain, pre-limiter · integrated {rep["lufs"]:.2f} LUFS · '
                 f'numbers = voice over the music bed during each line (dB, K-weighted, speech span)', loc='left'); marks(ax)
    # 4 envelope zooms
    stc = first(cues, 'scotch_scriiitch') or mp['cut'] + 5
    zs = [(mp['cut'] - .35, mp['cut'] + .45, f'the TOTAL cut at music().cut = {mp["cut"]:.3f}: music (cyan) vs mix (white), room (green)', 'cut'),
          (stc - .25, stc + 1.35, f'THE tape « scriiitch » at {stc:.3f} (ASMR stem, aqua) over the room; no music', 'asmr'),
          (DUR - .75, DUR, f'final chord {plan["end"]["final"]:.2f} · cut_dry {plan["end"]["dry"]:.3f} · rattle to the last sample', 'end')]
    for j, (a0, a1, title, kind) in enumerate(zs):
        ax = fig.add_subplot(gs[3, 4 * j:4 * j + 4]); a, b = ns(a0), min(len(Z), ns(a1)); xs = np.arange(a, b) / SR
        e = lambda x: 20 * np.log10(R.env_db(x[a:b], .002) + 1e-9)
        ax.plot(xs, e(Z), color='#ffffff', lw=.8, label='mix'); ax.plot(xs, e(stems['music'] * G), color='#3ee0ff', lw=.9, label='music')
        ax.plot(xs, e(stems['amb'] * G), color='#9fe08a', lw=.7, label='room')
        if kind == 'asmr': ax.plot(xs, e(stems['asmr'] * G), color='#7fffd4', lw=.9, label='asmr'); ax.plot(xs, e(stems['vox'] * G), color='#ffb24a', lw=.8, label='voice')
        if kind == 'cut': ax.axvline(mp['cut'], color='#3ee0ff', lw=1.2)
        if kind == 'end': ax.axvline(plan['end']['dry'], color='#3ee0ff', lw=1.2); ax.plot(xs, e(stems['sfx'] * G), color='#ff5a5a', lw=.7, label='sfx')
        ax.set_ylim(-110, 0); ax.set_xlim(a0, a1); ax.set_title(title, loc='left', fontsize=7.5); ax.legend(fontsize=6.5, facecolor='#120d1e', ncol=2)
        ax.set_ylabel('dBFS (2-ms RMS)')
    # 5 zoom spectrograms (2 rows of 3)
    b0 = (plan['major1']['accent'] or mp['sigAt'] - .6) - .2
    zz = [(0.0, mp['tenseFrom'] + .5, 'opening: POUF in progress · creak · skitter · ka-ching · boing · music in'),
          ((first(cues, 'whoosh_low') or 4) - .1, (first(cues, 'stamp', (first(cues, 'clac') or 6)) or 8) + .5, 'whoosh · BOUM on « place » · letters · AU m³ · 3 clacs + felt · formula'),
          (mp['cut'] - .3, mp['cut'] + 2.6, 'the cut · cricket · sweat drop (silence)'),
          ((first(cues, 'carton_fold') or 15.5) - .2, mp['majorFrom'] + .5, 'packing ASMR: fold · cutter · fold · pffuit · SCRIIITCH · pffuit · gloup · major'),
          (b0, (plan['brand']['stamp'] if plan.get('brand') else b0 + 4) + .6, 'ENSUITE accent · violet hum · signature E6->G#6 · tonk · label · bip · tape · tic · strike · MESURÉ'),
          ((plan['end']['hit2'] or DUR - 2.6) - .3, DUR, 'ritual stamp · « Maintenant, tu sais. » · E stop · final A · dry cut · rattle')]
    for j, (a0, a1, title) in enumerate(zz):
        ax = fig.add_subplot(gs[4 + j // 3, 4 * (j % 3):4 * (j % 3) + 4]); a, b = ns(max(0, a0)), min(len(m), ns(a1))
        spec(ax, m[a:b], a / SR, b / SR, 2048, 99.7, 80, np.geomspace(40, 16000, 300))
        for c in cues:
            if a0 <= c['t'] <= a1:
                ax.axvline(c['t'], ymin=.9, ymax=1, color=ccol(c['name']), lw=1.2)
                ax.text(c['t'], 17000, c['name'], rotation=90, fontsize=5.8, va='bottom', ha='center', color=ccol(c['name']))
        for v in vinfo:
            if v['film_off'] > a0 and v['film_on'] < a1: ax.axvspan(max(a0, v['film_on']), min(a1, v['film_off']), ymin=0, ymax=.03, color=vcol(v['id']))
        ax.set_title(title, loc='left', fontsize=7.3, pad=40)
    # 6 grids
    ax = fig.add_subplot(gs[6, :8])
    for s in plan['segs']:
        k = 0
        while s['a'] + k * s['beat'] < s['e']: ax.axvline(s['a'] + k * s['beat'], color='#ffd84a', lw=.8, alpha=.5); k += 1
        if s['k'] > 0: ax.axvspan(s['a'] - BRK, s['a'], color='#ff5a5a', alpha=.15)
    for a, e_, bt in ((mp['majorFrom'], plan['major1']['stop'], BEAT), (plan['end']['a'] or 0, (plan['end']['hit2'] or plan['end']['stop'] or 0) - BRK, BEAT),
                      (plan['end']['hit2'] or 0, (plan['end']['final'] + .01) if plan['end']['hit2'] else 0, plan['end']['beat2'])):
        tb = a
        while tb < e_: ax.axvline(tb, color='#ffd84a', lw=.8, alpha=.5); tb += bt
    if plan['end']['hit2']: ax.axvspan(plan['end']['hit2'] - BRK, plan['end']['hit2'], color='#ff5a5a', alpha=.15)
    if plan['major1']['accent']: ax.axvspan(plan['major1']['stop'], plan['major1']['accent'], color='#ff5a5a', alpha=.15)
    if plan.get('brand'):
        b = plan['brand']; tb = b['v0']
        while tb <= b['stamp'] + 1e-6: ax.axvline(tb, color='#b48cff', lw=.9, alpha=.6); tb += BEAT
    for c in cues: ax.plot([c['t']], [.5], 'v', color=ccol(c['name']), ms=5)
    ax.set_xlim(0, DUR); ax.set_xticks(xt); ax.set_yticks([])
    ax.set_title('beat grids: gold = makossa (stop-time segments anchored on the hits; the measure grid = the clacs), violet = brand grid '
                 '(the MESURÉ stamp on a beat) · red = stop-time breaks · triangles = cues', loc='left', fontsize=7.5)
    ax = fig.add_subplot(gs[6, 8:]); ax.axis('off')
    gl_ = ['hit            t        grid           beat   err  16th'] + [f'{x["name"][:13]:13s} {x["t"]:7.3f}  {x["grid"][:12]:12s} {x["beat"]:7.3f} {x["err"]:+5.0f} {x["err16"]:+5.0f}'
                                                                   for x in rep['grid']]
    gl_ += ['', 'segment     anchor-stop   beat  ev/s LUFS*'] + [f'#{r["k"]} {r["role"]:8s} {r["a"]:6.3f}-{r["e"]:6.3f} {r["beat"]:.3f} {r["rate"]:4.0f} {r["lufs"]:5.1f}'
                                                             for r in rep['segments']] + ['* un-ducked groove stem']
    ax.text(0, 1.05, '\n'.join(gl_), family='monospace', fontsize=6.6, va='top')
    # 7 cue table (3 columns)
    ax = fig.add_subplot(gs[7, :]); ax.axis('off')
    hd = f'{"t":>7} {"cue":16s} {"alone":>7} {"mix":>7} {"LUFS-M":>6}'
    L = [f'{r["t"]:7.3f} {r["name"][:16]:16s} {fm(r["err"], "+6.1f", "     -")} {fm(r["mix_err"], "+6.1f", "     -")} {fm(r["lvl"], "6.1f", "     -")}' for r in rep['cues']]
    h = int(math.ceil(len(L) / 3))
    for j in range(3): ax.text(j / 3, .93, '\n'.join([hd] + L[j * h:(j + 1) * h]), family='monospace', fontsize=7.0, va='top')
    ok = rep['cues_ok']
    ax.text(0, 1.03, f'every cue within 15 ms (alone, ms): {ok} · music_cut / cut_dry rows = music stem below -60 dB re the level just before; music max |x| in '
                     f'[cut, next music) = {rep["cut"]["music_max"]:.1e}, after cut_dry = {rep["dry"]["music_max_after"]:.1e} · mix = spectral-flux onset in mix.wav '
                     f'(masked cues may differ) · LUFS-M = the cue alone, post master gain', fontsize=7.8, va='top', color='#9fe08a' if ok else '#ff5a5a')
    # 8 voices + loudness
    ax = fig.add_subplot(gs[8, :]); ax.axis('off')
    L = [f'{"id":3s} {"take":10s} {"region":>15}  {"speech (plan)":>15}  {"T.id":>6}  {"measured":>15}  {"gap":>6}  {"LUFS":>6}  {"/music":>8} {"word min":>8}  '
         f'{"/all":>6} {"worst word (all)":>20}  {"phone":>6} {"worst word (phone)":>20}  de-ess']
    for r in rep['voices']:
        L.append(f'{r["id"]:3s} {r["file"]:10s} {r["t0"]:7.3f}-{r["t1"]:7.3f}  {r["on"]:7.3f}-{r["off"]:7.3f}  {r["T"] if r["T"] is not None else float("nan"):6.3f}  '
                 f'{r["m_on"]:7.3f}-{r["m_off"]:7.3f}  {fm(r["gap"], "6.3f", "   -  ")}  {r["lufs"]:6.1f}  '
                 f'{"no mus." if r["no_music"] else format(r["margin"], "+7.1f"):>8} {("   -" if (r["no_music"] or (r["word_min"] or 0) > 60) else fm(r["word_min"], "+6.1f", "   -")):>8}  '
                 f'{r["margin_all"]:+6.1f} {(r["word_worst"] or "-")[:12]:>12} {fm(r["word_min_all"], "+6.1f")}   {r["phone"]:+6.1f} '
                 f'{(r["phone_word"] or "-")[:12]:>12} {fm(r["phone_word_min"], "+6.1f")}   {r["deess"]:4.1f} dB')
    L.append('')
    L.append(f'voices overlap: {rep["voices_overlap"]} · every line >= 10 dB over the music bed: {all(r["margin"] >= 10 for r in rep["voices"])} · duck '
             f'{rep["duck_max_db"]:.1f} dB + {R.CARVE_DB:.0f} dB carve 0.9-5 kHz (look-ahead 100 ms, att 35, rel 220 ms) · soft SFX duck {SFX_DUCK_DB:.0f} dB · '
             f'impacts + ASMR never ducked · phone = 300 Hz-8 kHz, voice vs everything else')
    a = rep.get('asmr')
    if a: L.append(f'ASMR tape: {a["scotch_lufs_m"]:.1f} LUFS-M alone vs voices median {a["voice_lufs_m_median"]:.1f} / p90 {a["voice_lufs_m_p90"]:.1f} · '
                   f'music under it {a["music_in_window"]:.1e} · centroid {a["centroid_hz"]:.0f} Hz · head silent until {mp["silentUntil"]:.2f}: music max '
                   f'{rep["silent_head"]["music_max"]:.1e} · room in the cut {rep["cut"]["amb_rms_db"]:.1f} dBFS RMS')
    L.append(f'mix.wav: {rep["n"]} samples = {rep["dur"]:.6f} s @ {rep["sr"]} Hz, {rep["channels"]} ch · integrated {rep["lufs"]:.2f} LUFS (pyloudnorm) · '
             f'true peak {rep["tp_dbtp"]:.2f} dBTP (8x) · sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {fm(rep["lra"], ".1f")} LU · master '
             f'{rep["master_gain_db"]:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB · clipped {rep["clipped"]} · seam step {rep["seam"]["step"]:.4f} '
             f'(local p99 {rep["seam"]["local_p99"]:.4f})')
    L.append(f'score: {rep["src"]} · word margins use the ASR word times of data/vocheck.json (approximate)')
    ax.text(0, 1, '\n'.join(L), family='monospace', fontsize=7.4, va='top')
    fig.suptitle("« TU PAIES DE L'AIR. » (JE SAVAIS PAS. · 2/5) — audio check sheet (lib/audio_ep2.py)", x=.01, y=.997, ha='left', fontsize=15, color='w')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=100, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    log('[E2] sheet ->', path)

if __name__ == '__main__':
    build(sheet='--sheet' in sys.argv)

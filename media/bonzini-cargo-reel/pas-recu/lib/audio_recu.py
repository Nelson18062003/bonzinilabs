"""« PAS REÇU. » — the film's sound: 48 kHz stereo, exactly SCORE.DUR seconds, synthesised (no samples) + the 12 voice takes.

ONE score drives picture and sound: key times T and the cue list come live from overlay/scenes/01_score.js through node
(fallback: data/score_cues.json). The voices come from data/voice_plan.json (take, file start `at`, `stretch`) and
data/takes.json (speech on/off inside each file). Move a time in the score or a take in the plan, rerun, the sound follows.

Music (makossa, 120 BPM, beat .5 s; series code: makossa.groove / guitar / bass / kit, bikutsi balafon, instruments.*):
  0 .. T.amberForm       silence: only the bulb hum, the falling whistle, the BOUM and its debris
  T.amberForm .. T.proof the TENSE F#-minor groove (makossa.groove level 'tense', PROG_MINOR), in STOP-TIME: the re-timed
                         exchanges are not on one 120-BPM grid (falls/rebounds sit at .118/.018/.235 s mod .5), so the
                         band re-enters ON every steel fall (each fall = a downbeat, its rebound = the next beat, exactly
                         .5 s later) after a short break; tempo never moves, density climbs at every exchange
                         (seg 0 tense -> +skank +shaker -> +4-on-floor +16th picking +conga -> +claps +balafon tremolo +riser)
  T.proof                TOTAL CUT (4 ms gate, reverb returns included) — cricket, plic, squish, the mocking 3 notes
  T.rewind               the fight's own music read BACKWARDS by a tape that spins up (a tape stop, reversed) + riser
  T.violetIn - .1        Bonzini signature: two clear rising balafon notes E6 -> G#6 (the second ON T.violetIn)
  T.violetIn .. T.check  soft pad + bright balafon on a grid anchored at T.violetIn (T.stamp lands on its beat 8):
                         D(add9, lydian with the signature's G#) -> E7sus4 -> E at the stamp; clinks spell B6 G#6 E6 (the V)
  T.check .. end         A MAJOR full makossa (makossa.groove 'full', PROG), grid anchored at T.check (gulps + hic on beats);
                         the band stops after beat 2 of the last bar, final A-major chord at DUR-.5, choked: clean stop
Voices: trimmed to takes.json speech ±30 ms, short fades, 24 -> 48 kHz (soxr VHQ), time-stretched with Rubber Band
  (ffmpeg, formant-preserving, pitch kept) when stretch != 1; HP + EQ, slow leveller + word compressor, de-esser,
  per-line loudness, small-room reverb. Music ducks 8 dB under any voice (sidechain from the dry voice stem, look-ahead,
  smooth attack/release, gaps < .4 s held), soft SFX duck 3 dB, impacts never duck.
Master: HP 28 Hz, bus soft-clip on the impact bus, true-peak limiter; -14 LUFS integrated (pyloudnorm), TP <= -1 dBTP.

usage:  nice -n 5 python3 lib/audio_recu.py           -> audio/mix.wav, audio/stems/*.wav, report
        nice -n 5 python3 lib/audio_recu.py --sheet   -> + out/chk_audio_sheet.jpg (spectrogram, levels, zooms, tables)
API:    build(sheet=False) -> report dict   · score() · sfx_<name>() -> np.ndarray (onset at sample 0)
"""
import os, sys, json, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE in sys.path: sys.path.remove(HERE)
sys.path.insert(0, HERE)
import audio as A                 # the series' module: importing it first fixes the module order (dsp, makossa, bikutsi, instruments)
import numpy as np
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d
from audio import ns, tt, nz, ex, m2f, bp, panst, place, tail_fade, grains
dsp, SR, mk, bk, I = A.dsp, A.SR, A.mk, A.bk, A.I

X = A.X
SCORE_JS, CUES_JSON = A.SCORE_JS, A.CUES_JSON
PLAN_JSON = os.path.join(X, 'data', 'voice_plan.json')
TAKES_JSON = os.path.join(X, 'data', 'takes.json')
VOCHECK_JSON = os.path.join(X, 'data', 'vocheck.json')
VO_DIR = os.path.join(X, 'audio', 'vo')
OUT_A = os.path.join(X, 'audio')
CACHE = os.path.join(OUT_A, '.cache')
SHEET = os.path.join(X, 'out', 'chk_audio_sheet.jpg')

TAIL = 3.0
BEAT, S16 = 0.5, 0.125
BRK = 0.22                      # stop-time: the band leaves the last .22 s (at least) before each steel fall
DUCK_DB, SFX_DUCK_DB, CARVE_DB = 8.0, 4.0, 4.0
G_TENSE, G_MAJOR, G_BRAND, G_FINAL = 10 ** (-9.5 / 20), 10 ** (-11 / 20), 10 ** (-11 / 20), 10 ** (-9 / 20)   # bed levels under -18 LUFS voices
VOX_LUFS = -18.0                # per-line loudness in the vox stem (pre-master)
VOX_TRIM = {'T4': +1.0, 'T5': -1.0}            # « J'AI PAYÉ ! » shouted, « Euh… » tiny voice — still well above the bed
MUSIC = ('groove', 'brand', 'final')
DUCKED = {'groove': DUCK_DB, 'brand': DUCK_DB, 'sfx': SFX_DUCK_DB}
SENDS = {'groove': ('room', .08), 'brand': ('plate', .24), 'final': ('room', .10), 'sfx': ('room', .07),
         'hit': ('room', .09), 'vox': ('vroom', .15)}

def log(*a): print(*a, flush=True)
def fm(v, spec, none="-", suf=""): return none if v is None else format(v, spec) + suf

# =====================================================================================================================
# score + voice plan
# =====================================================================================================================
_SC = None
def score():
    """{dur, T, cues[{t, name, g, pan}], src} live from 01_score.js (node), else data/score_cues.json"""
    global _SC
    if _SC is not None: return _SC
    js = "const S=require(%s);console.log(JSON.stringify({dur:S.DUR,T:S.T,cues:S.soundCues()}))" % json.dumps(SCORE_JS)
    try:
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60, check=True)
        d = json.loads(r.stdout); d['src'] = '01_score.js (live)'
        try:
            j = json.load(open(CUES_JSON))
            d['json_in_step'] = (j.get('cues') == d['cues'] and abs(j.get('dur', 0) - d['dur']) < 1e-9)
        except Exception: d['json_in_step'] = False
    except Exception as e:
        d = json.load(open(CUES_JSON)); d['src'] = f'data/score_cues.json (fallback: {e})'; d['json_in_step'] = True
    _SC = d
    return d

def voice_plan():
    plan = json.load(open(PLAN_JSON)); takes = json.load(open(TAKES_JSON))
    try: vc = json.load(open(VOCHECK_JSON))
    except Exception: vc = {}
    out = []
    for lid, p in plan.items():
        tk = takes[lid]; assert tk['file'] == p['file'], (lid, tk['file'], p['file'])
        out.append(dict(id=lid, file=p['file'], at=float(p['at']), stretch=float(p['stretch']), on=float(tk['on']),
                        off=float(tk['off']), words=[w for w in vc.get(p['file'], {}).get('words', []) if w['e'] > w['s']
                                                      and any(ch.isalnum() for ch in w['w'])]))
    return sorted(out, key=lambda v: v['at'] + v['on'] * v['stretch'])

# =====================================================================================================================
# event list
# =====================================================================================================================
class Mix:
    """events (stem, sig, t, gain, pan, cut, tag). `cut` = dies with the TOTAL cut at T.proof (reverb returns included)."""
    def __init__(self, dur): self.dur = dur; self.ev = []
    def put(self, stem, sig, t, g=1.0, pan=0.0, cut=False, tag=None, fade=True):
        sig = np.array(sig, float)
        if fade: sig = tail_fade(sig)
        if t < 0: sig = sig[ns(-t):]; t = 0.0
        self.ev.append((stem, sig, float(t), float(g), float(pan), bool(cut), tag))

def stereo_of(sig, g, p): return sig * g if sig.ndim == 2 else panst(sig * g, p)

# =====================================================================================================================
# SFX (all synthesised, seeded; mono (n,) or stereo (n, 2); onset at sample 0)
# =====================================================================================================================
def _modes(t, f0, table, seed, glide=None, det=1.0):
    """sum of decaying sinusoidal modes (ratio, amp, decay s); optional strike glide (multiplies the frequency)"""
    r = np.random.default_rng(seed); g = 1.0 if glide is None else glide; y = np.zeros(len(t))
    for rt, a, d in table:
        ph = 2 * np.pi * np.cumsum(f0 * rt * det * g * np.ones(len(t))) / SR + r.uniform(0, 2 * np.pi)
        y += a * np.sin(ph) * np.exp(-t / d)
    return y

def sfx_fall_whistle(dur, seed=201):
    """cartoon falling whistle: sine gliding 1800 -> 500 Hz (exponential, accelerating), light vibrato that widens,
    breathy air on the pitch, grows as it nears the table, cut dead AT the impact"""
    n = ns(dur); t = tt(n); u = t / dur
    f = 1800 * (500 / 1800) ** (u ** 1.25)
    vib = 1 + .013 * np.sin(2 * np.pi * 5.6 * t) * (.35 + .65 * u)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + .10 * np.sin(2 * ph + .5) + .03 * np.sin(3 * ph)
    air = dsp.tv_biquad(nz(n, seed), 'bp', f * vib, 9.0) * .55
    y = (tone * .85 + air) * np.minimum(1, t / .008) * (.55 + .45 * u ** 1.5)
    y[-ns(.002):] *= np.linspace(1, 0, ns(.002))
    return y * .5

def sfx_boum(seed=211):
    """heavy steel plate slammed on the counter: pitch-dropping chest thump + the series' sub_drop + a big plate's
    inharmonic modes (with strike glide, a touch wide) + high clang partials + crack and the crushed letters' crunch"""
    n = ns(2.4); t = tt(n)
    f = 44 + 120 * np.exp(-t / .028)
    thump = dsp.softclip(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .12) * 1.8, 1.4)
    sub = np.zeros(n); s = I.sub_drop(1.0); sub[:len(s)] = s
    glide = 1 + .04 * np.exp(-t / .025)
    plate = ((1.00, 1.0, .45), (1.59, .80, .32), (2.14, .66, .25), (2.30, .55, .22), (2.65, .48, .19), (2.92, .40, .16),
             (3.50, .32, .13), (4.15, .26, .10), (5.03, .19, .08), (6.21, .14, .06), (7.90, .10, .045))     # rings ~.4 s: T2 follows
    clang = ((12.8, .30, .12), (18.8, .24, .09), (26.2, .19, .06), (36.7, .13, .045), (52.1, .08, .03))
    st = np.zeros((n, 2))
    for ch, det in enumerate((1.0, 1.0035)):
        st[:, ch] = _modes(t, 92.0, plate, seed + 1, glide, det) * .30 + _modes(t, 92.0, clang, seed + 2, glide, det) * .22
    crack = dsp.hp(nz(ns(.006), seed + 3), 2500) * np.linspace(1, 0, ns(.006)) * 1.3
    crunch = bp(nz(n, seed + 4), 2600, .8) * grains(n, 1800, seed + 5, .0012, (.3, 1), shape=np.exp(-t / .035)) * 1.5
    mono = thump + sub * .8 + crunch; mono[:len(crack)] += crack
    st += mono[:, None] * .75
    st *= np.minimum(1, t / .0004)[:, None]
    return st / np.abs(st).max()

def sfx_aie(seed=221, dur=.11):
    """the letters' tiny « aïe »: a chipmunk glottal source (saw, f0 rising then falling) through 3 formants sliding /a/ -> /i/"""
    n = ns(dur); t = tt(n); u = t / dur
    f0 = 640 * (1 + .42 * np.sin(np.pi * np.clip(u * 1.15, 0, 1)))
    src = dsp.lp(2 * (np.cumsum(f0) / SR % 1.0) - 1, 6500)
    k = np.clip((u - .22) / .5, 0, 1)
    y = (dsp.tv_biquad(src, 'bp', 850 + (330 - 850) * k, 5.0) + .8 * dsp.tv_biquad(src, 'bp', 1250 + (2700 - 1250) * k, 8.0)
         + .35 * dsp.tv_biquad(src, 'bp', 2900 + 500 * k, 10.0))
    y *= np.minimum(1, t / .004) * np.clip((dur - t) / .03, 0, 1)
    return y / (np.abs(y).max() + 1e-9) * .5

def _click(f, seed, n=None):
    n = n or ns(.045); t = tt(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / .007) + .4 * np.sin(2 * np.pi * f * 2.71 * t + 1) * np.exp(-t / .003)
    y += .3 * np.sin(2 * np.pi * f * .31 * t) * np.exp(-t / .010)
    c = bp(nz(ns(.002), seed), 5000, 1.0) * np.linspace(1, 0, ns(.002)) * .4; y[:len(c)] += c
    return y * np.minimum(1, t / .0002)

def sfx_marbles(seed=231, letters=16, dur=.9):
    """the subtitle's letters burst out like marbles: each one bounces on the cloth (shrinking gaps and levels),
    small hard clicks spread in pan, then a short rolling patter"""
    r = np.random.default_rng(seed); out = np.zeros((ns(dur + .2), 2))
    for j in range(letters):
        t0 = 0.0 if j == 0 else .10 * r.random() ** .6
        amp = 1.0 if j == 0 else r.uniform(.35, .75); gap = r.uniform(.07, .16); e = r.uniform(.55, .7)
        p = 0.0 if j == 0 else r.uniform(-.8, .8); f = r.uniform(1700, 3800); tk = t0; b = 0
        while gap > .012 and tk < dur:
            place(out, panst(_click(f * (1 + r.uniform(-.03, .03)), seed + 100 * j + b) * amp, p), ns(tk))
            tk += gap; gap *= e; amp *= .6; b += 1
    n = len(out); t = tt(n)
    roll = bp(nz(n, seed + 1), 3200, .8) * grains(n, 260, seed + 2, .0012, (.2, 1), shape=np.clip(t / .15, 0, 1) * np.exp(-t / .25))
    out += panst(roll * .45, .2)
    return out * .5

def sfx_creak(seed=241, dur=.55):
    """metal creak (the steel pushed up): stick-slip impulses at a wandering rate exciting resonant plate modes + friction"""
    n = ns(dur); t = tt(n); u = t / dur; r = np.random.default_rng(seed)
    wander = np.cumsum(r.standard_normal(n)) / np.sqrt(SR) * 4.0
    rate = 34 + 26 * np.sin(2 * np.pi * 1.3 * t + 1) + 10 * np.sin(2 * np.pi * 4.1 * t) + wander
    ph = np.cumsum(np.maximum(rate, 8)) / SR
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[0] = 1.0; imp[idx] = r.uniform(.45, 1.0, len(idx))
    body = sum(a * bp(imp, f, q) for f, q, a in ((410, 14, 1.0), (930, 18, .75), (1650, 22, .5), (2470, 25, .32), (3390, 25, .16)))
    fric = bp(nz(n, seed + 1), 1800, .7) * np.convolve(imp, ex(ns(.02), .004))[:n] * .25
    y = (body * 6 + fric) * np.minimum(1, t / .002) * (.65 + .35 * np.sin(np.pi * u)) * np.clip((dur - t) / .08, 0, 1)
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_whoosh_down(dur=.18, seed=245):
    """the steel's short fall into each clac (quiet, untagged): air sweeping down, cut at the impact"""
    n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 2600 * (500 / 2600) ** u, 1.4) * u ** 1.6
    y[-ns(.002):] *= np.linspace(1, 0, ns(.002))
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_clac_metal(seed=251):
    """the steel plate lands on the amber plate: the series' clac (thud, conga body, hollow ring) + plate modes,
    a bright clang, a stick click and a short sub"""
    n = ns(.9); t = tt(n)
    y = np.zeros(n); c = A.sfx_clac(seed); y[:len(c)] += c * .9
    y += _modes(t, 168.0, ((1, .5, .30), (1.59, .42, .24), (2.14, .36, .18), (2.65, .30, .14), (3.16, .24, .11), (4.15, .18, .08),
                           (5.40, .12, .06)), seed + 1) * .55
    y += _modes(t, 1.0, ((1340, .30, .10), (2210, .25, .07), (3170, .18, .05), (4630, .10, .03)), seed + 2) * .5
    y += np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-t / .02)) / SR) * np.exp(-t / .09) * .6
    tick = dsp.hp(nz(ns(.003), seed + 3), 3000) * np.linspace(1, 0, ns(.003)) * .8; y[:len(tick)] += tick
    y *= np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_ding_msg(seed=261):
    """a GENERIC soft message ding (one FM-bell note on E6, nothing like any app's tone)"""
    f = 1318.51; n = ns(.9); t = tt(n)
    mod = 1.1 * np.exp(-t / .05) * np.sin(2 * np.pi * f * 2.0 * t)
    y = (np.sin(2 * np.pi * f * t + mod) * np.exp(-t / .28) + .30 * np.sin(2 * np.pi * 2 * f * t + 1) * np.exp(-t / .12)
         + .12 * np.sin(2 * np.pi * f * 3.01 * t + 2) * np.exp(-t / .05))
    return y * (1 - np.exp(-t / .0015)) * .5

def sfx_slap(seed=271):
    """the amber plate's rebound: a slap (the series' clap) + flesh burst + the thick paint plate's body"""
    n = ns(.35); t = tt(n)
    y = np.zeros(n); c = A.clap(seed); y[:len(c)] += c * .7
    y += bp(nz(n, seed + 1), 1400, .7) * np.exp(-t / .010) * 1.4 + dsp.hp(nz(n, seed + 2), 3500) * np.exp(-t / .004) * .6
    y += np.sin(2 * np.pi * np.cumsum(120 + 90 * np.exp(-t / .012)) / SR) * np.exp(-t / .05) * .8
    y *= np.minimum(1, t / .0003)
    return y / np.abs(y).max()

def sfx_plic(seed=281):
    """a drop of sweat on the cloth: sine rising 1.1 -> 2.9 kHz in 28 ms + a tiny ring"""
    n = ns(.09); t = tt(n)
    f = 1100 * (2900 / 1100) ** np.minimum(1, t / .028)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .022) * np.minimum(1, t / .0008)
    y += .15 * np.sin(2 * np.pi * 2900 * t) * np.exp(-t / .03) * np.clip((t - .028) / .002, 0, 1)
    c = bp(nz(ns(.0015), seed), 4500, 1) * .3; y[:len(c)] += c
    return y * .5

def sfx_squish(seed=291, land=.40):
    """« pfffuit »: rubber squeak at contact, air escaping (band-pass falling 2.2 kHz -> 260 Hz), wet squelch,
    then the steel settles on the crêpe at +land (muffled thud + the series' dust puff)"""
    n = ns(land + .8); t = tt(n)
    sq = np.zeros(n); k = ns(.045); tk = tt(k)
    fsq = 950 - 250 * tk / .045
    sq[:k] = (np.sin(2 * np.pi * np.cumsum(fsq) / SR) + .4 * np.sin(4 * np.pi * np.cumsum(fsq) / SR)) * np.exp(-tk / .02) * .6
    env = np.clip(t / .03, 0, 1) * np.clip((land + .05 - t) / .12, 0, 1) * (.5 + .5 * np.sin(np.pi * np.clip(t / land, 0, 1)))
    air = dsp.tv_biquad(nz(n, seed), 'bp', 2200 * (260 / 2200) ** np.clip(t / land, 0, 1), 1.6) * env * 1.3
    wet = (bp(nz(n, seed + 1), 320, 5) + .6 * bp(nz(n, seed + 2), 720, 5)) * grains(n, 160, seed + 3, .004, (.3, 1)) * env * 6
    y = sq + air + wet
    i = ns(land); tl = tt(n - i)
    y[i:] += (np.sin(2 * np.pi * np.cumsum(65 + 50 * np.exp(-tl / .02)) / SR) * np.exp(-tl / .07) * .55
              + dsp.lp(nz(n - i, seed + 4), 700) * np.exp(-tl / .015) * .5)
    d = A.sfx_dust(seed + 5); y[i:i + len(d)] += d[:n - i] * .6
    y *= np.minimum(1, t / .0006)
    return y / (np.abs(y).max() + 1e-9) * .6

def sfx_rewind(src, dur, seed=301):
    """the fight read BACKWARDS by a tape that spins up (a tape stop, reversed): speed .2x -> 6x over `dur`, wow, tape hiss,
    a transport clack at 0, the end of the series' reverse_stamp (« un-stamp ») landing on the release clunk"""
    n = ns(dur); t = tt(n); u = t / dur
    rate = (.2 + 5.8 * u ** 1.5) * (1 + .02 * np.sin(2 * np.pi * 9 * t))
    pos = np.clip(len(src) - 1 - np.cumsum(rate), 0, len(src) - 1)
    y = np.interp(pos, np.arange(len(src)), src)
    y = dsp.lp(dsp.hp(y, 300), 6000)                                         # the chipmunk chatter, not the kick
    y = y / (np.abs(y).max() + 1e-9) * (.45 + .55 * u) * np.minimum(1, t / .01)
    y += np.sin(2 * np.pi * np.cumsum(170 * rate) / SR) * .10 * (.3 + .7 * u)   # the transport's whine follows the speed
    y += dsp.tv_biquad(nz(n, seed), 'bp', 2500 + 3500 * u, 1.2) * .06
    y[-ns(.006):] *= np.linspace(1, 0, ns(.006))
    out = np.zeros(n + ns(.25)); out[:n] += y
    c = A.sfx_tap(seed); out[:len(c)] += c * .9
    rs = I.reverse_stamp(seed); rs = rs[-ns(min(dur, .5)):]; out[n - len(rs):n] += rs * .15
    cl = A.sfx_setdown(seed + 1); out[n:n + len(cl)] += cl[:len(out) - n] * .5
    return out / (np.abs(out).max() + 1e-9) * .6

def sfx_riser(dur, seed=311):
    """into the brand light: noise band rising 600 Hz -> 7 kHz + two detuned sines gliding E4 -> E6 + sub swell;
    starts at a defined (soft) level, stops just before the signature"""
    n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 600 * (7000 / 600) ** u, 2.2) * (.30 + .70 * u ** 1.8)
    f = 329.63 * 4 ** u
    y += (np.sin(2 * np.pi * np.cumsum(f) / SR) + np.sin(2 * np.pi * np.cumsum(f * 1.006) / SR + 1)) * .06 * (.3 + .7 * u)
    y += np.sin(2 * np.pi * 41.2 * t) * u ** 2 * .25
    y *= np.minimum(1, t / .003); y[-ns(.025):] *= np.linspace(1, 0, ns(.025))
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_tonk(seed=321):
    """the enamel plate's soft landing: the series' set-down + a hollow wooden « tonk »"""
    y = np.zeros(ns(.25)); s = A.sfx_setdown(seed); y[:len(s)] += s; w = A.wood(310, seed + 1, .45); y[:len(w)] += w
    return y

def sfx_unfold(seed=331, dur=.42):
    """the plate unfolds into a receipt: paper flicks (series), crinkle grains, a flat « fwap » at the end"""
    n = ns(dur + .15); t = tt(n); y = np.zeros(n)
    for tk, a in ((0, 1.0), (.10, .7), (.19, .8), (.27, .6)):
        place(y, I.paper(seed + int(tk * 100)) * a, ns(tk))
    y += bp(nz(n, seed + 1), 4500, 1.0) * grains(n, 400, seed + 2, .0008, (.2, 1), shape=(t < dur - .05)) * .5
    i = ns(dur - .04); tl = tt(n - i)
    y[i:] += bp(nz(n - i, seed + 3), 1600, .8) * np.exp(-tl / .018) * .9 + np.sin(2 * np.pi * 160 * tl) * np.exp(-tl / .02) * .3
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_big_stamp(seed=341):
    """the receipt stamps the steel from below: rubber stamp + table thud (series), a short sub, the steel struck
    (plate modes) and the cracks growing (fine ticks over .35 s)"""
    n = ns(1.6); t = tt(n); y = np.zeros(n)
    s = A.sfx_stamp(seed); y[:len(s)] += s / np.abs(s).max()
    s = I.stamp(seed + 1); y[:len(s)] += s * .7
    y += dsp.softclip(np.sin(2 * np.pi * np.cumsum(40 + 70 * np.exp(-t / .03)) / SR) * np.exp(-t / .16) * 1.6, 1.3) * .9
    y += _modes(t, 130.0, ((1, .5, .7), (1.59, .4, .5), (2.14, .35, .4), (2.65, .28, .3), (3.5, .2, .22), (4.15, .15, .16),
                           (6.2, .08, .1)), seed + 2, 1 + .03 * np.exp(-t / .02)) * .45 * np.exp(-t / .35)   # N4 goes on
    cr = bp(nz(n, seed + 3), 3800, 1.5) * grains(n, 1.0, seed + 4, .0008, (.2, 1),
                                                   shape=140 * np.clip((t - .02) / .05, 0, 1) * np.exp(-np.maximum(t - .02, 0) / .25)) * .7
    y += cr
    tick = dsp.hp(nz(ns(.003), seed + 5), 3000) * np.linspace(1, 0, ns(.003)) * .8; y[:len(tick)] += tick
    lo, hi = dsp.zp_split(y, 160, 2)                                         # N4 (« …la preuve… ») runs through it: above the
    y = lo + hi * np.where(t < .05, 1.0, np.exp(-(t - .05) / .07))          # sub, the stamp is a big hit, not a long tail
    y *= np.minimum(1, t / .0004)
    return y / np.abs(y).max()

def sfx_clink(m, seed):
    """a steel letter drops on the table: high metallic ping (inharmonic, pitch sagging a little), then small bounces"""
    f = m2f(m); out = np.zeros(ns(.9))
    for k, (tk, a) in enumerate(((0, 1.0), (.105, .5), (.185, .3), (.245, .18), (.29, .1), (.322, .06))):
        n = ns(.6 if k == 0 else .25); t = tt(n); d = .20 if k == 0 else .07
        glide = 1 + .02 * np.exp(-t / .015) - .008 * np.minimum(1, t / .3)
        y = _modes(t, f, ((1, 1, d), (2.76, .45, d * .45), (5.40, .22, d * .2), (8.93, .10, d * .1)), seed + k, glide)
        c = dsp.hp(nz(ns(.002), seed + 10 + k), 3000) * .3; y[:len(c)] += c
        place(out, y * a * np.minimum(1, t / .0003), ns(tk))
    return out * .5

def sfx_buddy(seed=351):
    """the friendly check « tchink »: wooden knock + glassy tink + a short shimmer (series)"""
    w = A.wood(520, seed, 1.0); tk = A._bell(2793.83, .6, .22, seed, .0015) * .35
    m = np.zeros(ns(.6)); m[:len(w)] += w * .9; m[:len(tk)] += tk
    out = panst(m, 0); sh = A.sfx_shimmer(seed, .2) * .3
    o = np.zeros((max(len(out), len(sh)), 2)); o[:len(out)] += out; o[:len(sh)] += sh
    return o

def sfx_gloup(k, seed):
    """a gulp: a wet « gl » click then a pop whose pitch dives (each gulp a little lower)"""
    n = ns(.3); t = tt(n)
    f = 150 + (560 - 45 * k - 150) * np.exp(-t / .03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .07) * np.minimum(1, t / .002)
    y += dsp.lp(nz(n, seed), 500) * np.exp(-t / .03) * .35
    gl = bp(nz(ns(.012), seed + 1), 1200, 1.2) * np.linspace(1, 0, ns(.012)) * .5; y[:len(gl)] += gl
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_hic(seed=361, dur=.075):
    """a tiny « hic »: glottal catch + a voiced blip rising through an /i/ formant set"""
    n = ns(dur); t = tt(n); u = t / dur
    f0 = 560 + 260 * np.clip(u * 2, 0, 1)
    src = dsp.lp(2 * (np.cumsum(f0) / SR % 1.0) - 1, 6000)
    y = bp(src, 300, 4) + .9 * bp(src, 2500, 9) + .4 * bp(src, 3300, 10)
    y *= np.minimum(1, t / .003) * np.exp(-t / .03)
    b = bp(nz(ns(.008), seed), 2600, 1.0) * np.linspace(1, 0, ns(.008)) * .6; y[:len(b)] += b * np.abs(y).max() * 2
    return y / (np.abs(y).max() + 1e-9) * .5

def hum_bed(N, dur, T, seed=151):
    """the bulb over the counter: 100 Hz filament family (phone-audible through 300-700 Hz), a sway wobble, fine hiss.
    Integer cycles over the film (100 Hz x 29.1 s, sway = DUR/11, circular hiss) so the video loops without a seam;
    creeps forward a little in the awkward silence (T.proof -> T.rewind)"""
    t = np.arange(N) / SR
    y = sum(a * np.sin(2 * np.pi * 100 * h * t + .7 * h) for h, a in
            ((1, .45), (2, .30), (3, .24), (4, .14), (5, .11), (6, .07), (7, .05), (9, .025)))
    y += .12 * np.sin(2 * np.pi * 50 * t)
    y *= 1 + .07 * np.sin(2 * np.pi * t / (dur / 11))
    hs = np.fft.rfft(nz(N, seed)); f = np.fft.rfftfreq(N, 1 / SR); hs *= (f > 2500) & (f < 9000); hs = np.fft.irfft(hs, N)
    hs = hs / hs.std() * .010 * (1 + .6 * np.sin(2 * np.pi * 100 * t) ** 2)
    lift = 1 + .25 * np.clip((t - T['proof'] - .3) / 2.5, 0, 1) * np.clip((T['rewind'] + .1 - t) / .3, 0, 1)
    return (y * .02 + hs * .5) * lift * .7

def crackles(dur, T, seed=161):
    """[(t, sig, gain)] sparse filament crackles, denser in the awkward silence"""
    r = np.random.default_rng(seed); ev = []; t = 0.0
    while True:
        t += r.exponential(1 / (2.5 + (3.0 if T['proof'] <= t < T['rewind'] else 0)))
        if t >= dur - .05: break
        k = int(r.integers(1, 5)); y = np.zeros(ns(.03))
        for j in range(k):
            c = bp(nz(ns(.0025), int(r.integers(1e9))), r.uniform(2500, 6500), 1.2) * np.linspace(1, 0, ns(.0025))
            place(y, c * r.uniform(.3, 1), ns(r.uniform(0, .02)))
        ev.append((t, y, r.uniform(.010, .04)))
    return ev

# =====================================================================================================================
# music
# =====================================================================================================================
def tense_segments(T):
    """stop-time segments of the F#-minor groove: (anchor = downbeat, stop) — anchors on T.amberForm and every steel fall"""
    anchors = [T['amberForm']] + list(T['falls'])
    stops = [f - BRK for f in T['falls']] + [T['proof']]
    return list(zip(anchors, stops))

def compose_tense(M, T):
    PM = mk.PROG_MINOR
    for k, (a, e) in enumerate(tense_segments(T)):
        name, tones, root = PM[k % 4]
        def put(sig, t, g=1.0, p=0.0, _a=a, _e=e, _k=k):
            if t < _e - 1e-6:
                M.put('groove', sig, t, g * G_TENSE, p, cut=True, tag='music_in' if (_k == 0 and t - _a < .02) else ('seg', _k))
        mk.groove(put, a, k, level='tense', prog=PM)                          # series groove: quarter picking, bass, hats, kick 1&3, rim 2&4
        for j in range(16):                                                    # density climbs at every exchange
            tj = a + j * S16 + (.012 if j % 2 else 0.0)
            if k >= 1 and mk.RHY[j]:
                put(mk.guitar(m2f(tones[(j // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=4000 + 16 * k + j, mute=1), tj, .16, -.45)
            if k >= 1 and j % 2 == 0: put(A.rattle(4100 + 16 * k + j, .045, .9, 1.0), tj, .22 if j % 4 == 0 else .15, .35)
            if k >= 2 and j % 4:
                put(mk.guitar(m2f(tones[mk.PICK[j] % len(tones)] + 12), .2, bright=.62, decay=.99, seed=4200 + 16 * k + j, mute=.5), tj, .12, .45)
            if k >= 2 and j % 4 == 2: put(A.conga(62 if j % 8 == 2 else 57, 4300 + 16 * k + j, slap=j % 8 == 6), tj, .40, -.3)
            if k >= 3:
                for h in range(2):
                    m = tones[(j + h) % len(tones)] + 12 + (12 if j >= 8 else 0)
                    put(bk.balafon(m2f(m), .25, 4400 + 32 * k + 2 * j + h), tj + h * S16 / 2, .10 + .06 * j / 16, -.45)
        for b in range(4):
            tb = a + b * BEAT
            if k >= 2 and b % 2 == 1: put(mk.kick(), tb, .55)
            if k >= 3 and b in (1, 3): put(A.clap(4500 + b), tb, .45, -.1)
        if k == 3:                                                             # riser through the last exchange, cut dead by the gate
            d = e - a + .1; n = ns(d); u = tt(n) / d
            put(dsp.tv_biquad(nz(n, 4600), 'bp', 900 * 7 ** u, 2.0) * u ** 1.8 * .6, a, .5, 0)

def compose_brand(M, T, sig_t):
    """violet section: signature, pad, bass, bright balafon on a grid anchored at T.violetIn, E chord on the stamp"""
    v0, st, ck = T['violetIn'], T['stamp'], T['check']
    put = lambda stem, sig, t, g=1.0, p=0.0, tag=None: M.put(stem, sig, t, g * G_BRAND, p, tag=tag)
    beats = lambda b: v0 + b * BEAT
    n_beats = int(round((st - v0) / BEAT))                                    # the stamp lands on beat n (8)
    # pad: D(add9) -> E7sus4 (2 beats before the stamp) -> E (stamp) -> A at the check (major section)
    sus = beats(n_beats - 2)
    put('brand', A.soft_pad([62, 66, 69, 76], sus - v0 + .35, 1.0), v0, .55, 0)
    put('brand', A.soft_pad([64, 69, 71, 74], st - sus + .30, 1.0), sus, .55, 0)
    put('brand', A.soft_pad([64, 68, 71, 76], ck - st + .25, 1.0), st, .60, 0)
    # bass prepares the tonic: D . A . D C# | E B | E (sub on the stamp) -> A at the check
    for b, m, d in ((0, 38, .9), (2, 33, .9), (4, 38, .45), (5, 37, .45)):
        if beats(b) < sus - .01: put('brand', mk.bass(m2f(m), d, .3), beats(b), .40, 0)
    put('brand', mk.bass(m2f(40), .45, .3), sus, .42, 0); put('brand', mk.bass(m2f(35), .45, .3), sus + BEAT, .42, 0)
    put('brand', I.bass_sub(28, ck - st + .1), st, .55, 0)
    # bright balafon: lydian arpeggio, then an E7sus4 climb in eighths / sixteenths into the stamp
    pat = {2: 81, 3: 85, 5: 88, 6: 85, 8: 81, 9: 85, 10: 88, 11: 90}
    for e8, m in pat.items():
        if v0 + e8 * BEAT / 2 < sus - .01: put('brand', A.balafon_bright(m, 5000 + e8), v0 + e8 * BEAT / 2, .30, -.3 + .2 * (e8 % 3))
    climb = [(0, 81), (.5, 83), (1, 86), (1.5, 88), (2, 88), (2.5, 91), (2.75, 93), (3.0, 95), (3.25, 98), (3.5, 100)]
    for e8, m in climb:
        tk = sus + e8 * BEAT / 2
        if tk < st - .01: put('brand', A.balafon_bright(m, 5100 + int(e8 * 4)), tk, .24 + .03 * e8, -.2 + .15 * (int(e8 * 2) % 3))
    # the signature (cue tag set by the caller) and the E-major hit on the stamp
    put('brand', I.stab([52, 56, 59, 64], .25, 1.0), st, 1.2, 0, tag='stamp_chord')
    put('brand', A.balafon_bright(76, 5200), st, .35, -.2, tag='stamp_chord')
    put('brand', A.balafon_bright(88, 5201), st, .25, .2, tag='stamp_chord')

def compose_major(M, T, t0, t_final, tag):
    """A-major full makossa from the check, grid anchored on it; the band stops after beat 2 of the bar holding the final chord"""
    last = t0 + BAR_OF(t_final - t0) * 2.0                                   # the bar holding the final chord
    stop = last + BEAT if t_final - last > BEAT + .15 else last              # the groove plays its beat 1, then the hits
    nbars = int(math.ceil((t_final - t0) / 2.0))
    for b in range(nbars):
        a = t0 + 2.0 * b
        def put(sig, t, g=1.0, p=0.0, _b=b):
            if t < min(stop, t_final - .05) - 1e-6:
                M.put('groove', sig, t, g * G_MAJOR, p, tag=tag if (_b == 0 and t - t0 < .02) else ('maj', _b))
        mk.groove(put, a, b, level='full', prog=mk.PROG)
        name, tones, root = mk.PROG[b % 4]
        for j in range(16):
            tj = a + j * S16 + (.012 if j % 2 else 0.0)
            if j % 2 == 0: put(A.rattle(5300 + 16 * b + j, .04, .8, 1.1), tj, .14 if j % 4 else .19, .35)
            if j in (6, 14): put(A.balafon_bright(tones[(j // 6 + b) % 4] + 12, 5400 + 16 * b + j, .6), tj, .16, -.4)
            if j % 8 == 4: put(A.conga(64 if j == 4 else 59, 5500 + 16 * b + j, slap=j == 12), tj, .30, -.3)
    # the ending: a unison accent on the stop beat (« pa- »), silence, then the final chord (« -PAM », compose_final)
    if stop < t_final - .15:
        M.put('groove', mk.kick(), stop, .7 * G_MAJOR, 0); M.put('groove', mk.bass(m2f(45), .18, .6), stop, .5 * G_MAJOR, 0)
        M.put('groove', I.stab([57, 61, 64, 69], .10, 1.0), stop, .9 * G_MAJOR, 0); M.put('groove', A.clap(5650), stop, .35 * G_MAJOR, -.1)
    # the arrival: A-major stab, pad swell, a crash-like shimmer, extra kick (all tagged with the cue)
    M.put('groove', I.stab([57, 61, 64, 69], .22, 1.0), t0, 1.0 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.soft_pad([69, 73, 76], 2.2, 1.0), t0, .55 * G_MAJOR, 0, tag=tag)
    M.put('groove', mk.kick(), t0, .5 * G_MAJOR, 0, tag=tag)
    M.put('brand', A.sfx_shimmer(5600, .5), t0, .22 * G_MAJOR, 0, tag=tag)

def BAR_OF(x): return int(math.floor(x / 2.0 + 1e-9))

def compose_final(M, t, tag):
    """the final A-major chord: stab, strummed guitar, bass + sub, kick, balafon, pad — choked by the end gate (clean stop)"""
    M.put('final', I.stab([57, 61, 64, 69], .45, 1.0), t, 1.3 * G_FINAL, 0, tag=tag)
    for i, m in enumerate((45, 52, 57, 61, 64, 69)):
        M.put('final', mk.guitar(m2f(m), .55, bright=.7, decay=.995, seed=5700 + i), t + .008 * i, .30 * G_FINAL, -.3 + .12 * i, tag=tag)
    M.put('final', mk.bass(m2f(33), .5, .5), t, .55 * G_FINAL, 0, tag=tag); M.put('final', I.bass_sub(33, .5), t, .35 * G_FINAL, 0, tag=tag)
    M.put('final', mk.kick(), t, .8 * G_FINAL, 0, tag=tag); M.put('final', A.clap(5710), t, .35 * G_FINAL, -.1, tag=tag)
    M.put('final', A.balafon_bright(81, 5720), t, .35 * G_FINAL, -.25, tag=tag); M.put('final', A.balafon_bright(88, 5721), t, .30 * G_FINAL, .25, tag=tag)
    M.put('final', A.soft_pad([69, 73, 76], .6, 1.0), t, .5 * G_FINAL, 0, tag=tag)

# =====================================================================================================================
# voices
# =====================================================================================================================
def _stretch(y48, stretch, key):
    """Rubber Band via ffmpeg (formant preserved, pitch kept, latency compensated by the filter), cached"""
    if abs(stretch - 1.0) < 1e-9: return y48
    import soundfile as sf
    os.makedirs(CACHE, exist_ok=True)
    src = os.path.join(CACHE, f'{key}_in.wav'); dst = os.path.join(CACHE, f'{key}_x{stretch:.4f}.wav')
    sf.write(src, y48.astype(np.float32), SR, subtype='FLOAT')
    subprocess.run(['nice', '-n', '5', 'ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af',
                    f'rubberband=tempo={1 / stretch:.6f}:pitch=1:pitchq=quality:formant=preserved:transients=crisp:'
                    f'detector=compound:window=standard', '-c:a', 'pcm_f32le', dst], check=True)
    y, sr = sf.read(dst); assert sr == SR
    return y if y.ndim == 1 else y.mean(1)

def lufs_mono(y): return float(dsp.lufs_integrated(panst(y, 0)))

def deess(x, fc=4800.0, rel_db=-7.0, ratio=4.0, max_gr=10.0):
    """split-band de-esser: when the >4.8 kHz band carries more than `rel_db` of the whole (an « s », « ch »), that band
    alone is turned down (ratio 4, max 10 dB, 1 ms attack / 40 ms release); the low band is never touched"""
    lo, hi = dsp.zp_split(x, fc, 2)
    w = ns(.005)
    e_hi = np.sqrt(np.maximum(uniform_filter1d(hi ** 2, w), 0) + 1e-14); e_all = np.sqrt(np.maximum(uniform_filter1d(x ** 2, w), 0) + 1e-14)
    over = np.maximum(0, 20 * np.log10(e_hi / (e_all * 10 ** (rel_db / 20))))
    over *= e_all > np.percentile(e_all, 60) * .05                          # ignore the noise floor
    gr = -np.minimum(over * (1 - 1 / ratio), max_gr)
    blk = 48; gb = gr[:len(gr) // blk * blk].reshape(-1, blk).min(1)
    gs = dsp.smooth_gain_db(gb, .001, .04, blk / SR)
    g = np.interp(np.arange(len(x)), np.arange(len(gs)) * blk + blk / 2, gs)
    return lo + hi * dsp.undb(g), float(-g.min()), float(np.mean(g < -1.0))

def voice_line(v):
    """trim -> 48 kHz -> stretch -> chain. Returns (signal, film start, film speech on, film speech off, info)"""
    import soundfile as sf, soxr
    y, sr = sf.read(os.path.join(VO_DIR, v['file'])); y = y if y.ndim == 1 else y.mean(1)
    a = max(0.0, v['on'] - .030); b = min(len(y) / sr, v['off'] + .030)
    seg = y[int(round(a * sr)):int(round(b * sr))].astype(float)
    fi = ns(.010) * sr // SR if v['on'] - a >= .015 else max(1, int(.002 * sr))        # fade inside the 30-ms margin
    fo = int(.020 * sr)
    seg[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2; seg[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    y48 = soxr.resample(seg, sr, SR, quality='VHQ')
    y48 = _stretch(y48, v['stretch'], os.path.splitext(v['file'])[0])
    # chain: low cut, de-mud, presence; slow leveller + word compressor; de-esser; line loudness; peak safety
    x = dsp.butter(y48, 'hp', 85, 4)
    x = dsp.biquad(x, 'peak', 280, 1.0, -2.5); x = dsp.biquad(x, 'peak', 3200, .9, 3.0)
    x = x * dsp.undb(-20 - lufs_mono(x))
    x = dsp.compressor(x, thr_db=-27, ratio=2.0, att=.025, rel=.30, knee_db=6, detector='rms', rms_win=.03)
    x = dsp.compressor(x, thr_db=-22, ratio=3.0, att=.004, rel=.09, knee_db=6, detector='rms', rms_win=.008)
    x, ds_max, ds_frac = deess(x)
    x = x * dsp.undb(VOX_LUFS + VOX_TRIM.get(v['id'], 0.0) - lufs_mono(x))
    x = A.sclip(x, .9)                                                       # safety only
    t0 = v['at'] + a * v['stretch']
    return x, t0, v['at'] + v['on'] * v['stretch'], v['at'] + v['off'] * v['stretch'], dict(deess_max_db=ds_max, deess_frac=ds_frac)

def duck_db(vox, spans=(), look=.10, att=.035, rel=.22, hold=.40):
    """sidechain from the DRY voice stem -> gain curve in dB for depth 1 (multiply by the stem's depth):
    activity = 20-ms RMS above -32 dB re the voice's loud level, held through each line's speech span (takes.json),
    gaps < `hold` closed, look-ahead so the duck is
    complete at the first syllable, asymmetric one-pole smoothing (attack 35 ms, release 220 ms)"""
    m = vox if vox.ndim == 1 else vox.mean(1)
    env = np.sqrt(np.maximum(uniform_filter1d(m ** 2, ns(.02)), 0) + 1e-18)
    ref = np.percentile(env[env > 1e-5], 90) if np.any(env > 1e-5) else 1.0
    act = (env > ref * 10 ** (-32 / 20)).astype(np.uint8)
    for a, b in spans: act[ns(a):ns(b)] = 1                                   # a line's own pauses never release the duck
    L = ns(hold); act = minimum_filter1d(maximum_filter1d(act, L), L).astype(bool)
    k = ns(look); early = np.concatenate([act[k:], np.zeros(k, bool)])
    tgt = -(act | early).astype(float)
    blk = 48; tb = tgt[:len(tgt) // blk * blk].reshape(-1, blk).min(1)
    gs = dsp.smooth_gain_db(tb, att, rel, blk / SR)
    return np.interp(np.arange(len(m)), np.arange(len(gs)) * blk + blk / 2, gs), act

# =====================================================================================================================
# compose everything
# =====================================================================================================================
def compose(sc, lines):
    T, DUR, cues = sc['T'], sc['dur'], sc['cues']
    M = Mix(DUR)
    # ---- voices ---------------------------------------------------------------------------------------------------
    vinfo = []
    for v in lines:
        y, t0, on, off, info = voice_line(v)
        M.put('vox', y, t0, 1.0, 0.0, tag=('vox', v['id']), fade=False)
        vinfo.append(dict(v, sig_len=len(y) / SR, t0=t0, t1=t0 + len(y) / SR, film_on=on, film_off=off, **info))
    # ---- music ----------------------------------------------------------------------------------------------------
    compose_tense(M, T)
    sig_t = next((c['t'] for c in cues if c['name'] == 'bonzini_sig'), T['violetIn'] - .1)
    compose_brand(M, T, sig_t)
    # ---- the bulb ---------------------------------------------------------------------------------------------------
    N = ns(DUR)
    hb = hum_bed(N, DUR, T)
    M.put('amb', np.stack([hb, hb * .96], 1), 0.0, 1.0, fade=False)
    for t, y, g in crackles(DUR, T): M.put('amb', y, t, g * 1.4, .1)
    # ---- cues -------------------------------------------------------------------------------------------------------
    unknown = []; nclink = ngloup = 0; t_final = next((c['t'] for c in cues if c['name'] == 'final_chord'), DUR - .5)
    for i, c in enumerate(cues):
        t, name, g, pan = c['t'], c['name'], c['g'], c['pan']; tag = ('cue', i); sd = 7000 + 37 * i
        if name == 'fall_whistle': M.put('sfx', sfx_fall_whistle(T['slam'] - t), t, .19 * g, 0, tag=tag)
        elif name == 'boum': M.put('hit', sfx_boum(), t, 1.0 * g, 0, tag=tag)
        elif name == 'aie': M.put('sfx', sfx_aie(), t, .30 * g, -.1, tag=tag)
        elif name == 'marbles': M.put('sfx', sfx_marbles(), t, .55 * g, 0, tag=tag)
        elif name == 'day_stamp': s_ = A.sfx_stamp(sd); M.put('sfx', s_ / np.abs(s_).max(), t, .9 * g, .35, tag=tag)
        elif name == 'creak': M.put('sfx', sfx_creak(), t, .25 * g / .6, .1, tag=tag)
        elif name == 'clac':
            M.put('hit', sfx_clac_metal(sd), t, .70 * g, 0, tag=tag)
            M.put('sfx', sfx_whoosh_down(.18, sd), t - .18, .05, 0)                    # the fall itself (quiet, untagged)
        elif name == 'ding_msg': M.put('sfx', sfx_ding_msg(), t, .30 * g / .55, .25, tag=tag)
        elif name == 'slap': M.put('hit', sfx_slap(sd), t, .45 * g, 0, tag=tag)
        elif name == 'cut': pass                                                     # the gate itself (render)
        elif name == 'cricket': M.put('amb', A.sfx_cricket(), t, .16 * g / .5, -.6, tag=tag)
        elif name == 'plic': M.put('sfx', sfx_plic(), t, .30 * g / .7, .15, tag=tag)
        elif name == 'squish': M.put('sfx', sfx_squish(), t, .65 * g, 0, tag=tag)
        elif name == 'mock': M.put('groove', A.sfx_mock(), t, .30 * g, .4, tag=tag)
        elif name == 'rewind':
            src = render_tag(M, lambda e: e[5] or (e[0] == 'hit' and e[2] < T['proof']), T['proof'] - 2.0, T['proof'])
            M.put('groove', sfx_rewind(src, T['rewindEnd'] - t), t, .42 * g, 0, tag=tag)
        elif name == 'riser': M.put('brand', sfx_riser(sig_t - .02 - t), t, .18 * g / .7, 0, tag=tag)
        elif name == 'bonzini_sig':
            M.put('brand', A.balafon_bright(88, 5800, 1.2), t, .17 * g, -.15, tag=tag)
            M.put('brand', A.balafon_bright(92, 5801, 1.0), T['violetIn'], .18 * g, .15, tag=tag)
            M.put('brand', A._bell(m2f(100), .8, .3, 1, .002) * .5, T['violetIn'], .06 * g, .15, tag=tag)
        elif name == 'tonk': M.put('sfx', sfx_tonk(), t, .38 * g, 0, tag=tag)
        elif name == 'paper': M.put('sfx', sfx_unfold(), t, .55 * g / .8, .1, tag=tag)
        elif name == 'big_stamp': M.put('hit', sfx_big_stamp(), t, 1.0 * g, 0, tag=tag)
        elif name == 'clink':
            M.put('sfx', sfx_clink((95, 92, 88)[min(nclink, 2)], sd), t, .08 * g / .8, pan, tag=tag); nclink += 1
        elif name == 'major': compose_major(M, T, t, t_final, tag)
        elif name == 'buddy': M.put('sfx', sfx_buddy(), t, .15 * g, 0, tag=tag)
        elif name == 'gloup': M.put('sfx', sfx_gloup(ngloup, sd), t, .28 * g / .8, pan, tag=tag); ngloup += 1
        elif name == 'hic': M.put('sfx', sfx_hic(), t, .30 * g / .6, pan, tag=tag)
        elif name == 'pop': M.put('sfx', I.pop(sd), t, .40 * g / .7, 0, tag=tag)
        elif name == 'final_chord': compose_final(M, t, tag)
        else: unknown.append(name)
    return M, vinfo, unknown

# =====================================================================================================================
# render
# =====================================================================================================================
_IR = {}
def irs():
    if not _IR:
        _IR['room'] = dsp.make_ir(1.1, 1.0, .8, .35, predelay=.012, seed=3)           # the series' room / plate
        _IR['plate'] = dsp.make_ir(1.9, 1.6, 1.5, .9, predelay=.02, seed=5, bright=1.2)
        _IR['vroom'] = dsp.make_ir(.45, .32, .28, .14, predelay=.004, seed=9, bright=.8)   # the shop: small, dry-ish
    return _IR

def render_tag(M, pred, t0, t1):
    """mono dry render of the events matching pred(event), window [t0, t1) — source of the rewind"""
    buf = np.zeros(ns(t1 - t0))
    for e in M.ev:
        if not pred(e): continue
        st = stereo_of(e[1], e[3], e[4]).mean(1); place_at(buf, st, ns(e[2] - t0))
    return buf

def place_at(buf, sig, i):
    if i < 0: sig = sig[-i:]; i = 0
    place(buf, sig, i)

def gate(N, t_cut, t_on=None, fade=.004):
    """1 before t_cut (raised-cosine fade ending exactly at t_cut), 0 after (until t_on if given)"""
    g = np.ones(N); a, b = ns(t_cut - fade), ns(t_cut)
    g[a:b] = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2; g[b:N if t_on is None else ns(t_on)] = 0
    return g

def render(M, sc, fx=True):
    T, DUR = sc['T'], sc['dur']
    N = ns(DUR + TAIL); raw = {}
    for stem, sig, t, g, p, cut, tag in M.ev:
        k = (stem, cut)
        if k not in raw: raw[k] = np.zeros((N, 2))
        place_at(raw[k], stereo_of(sig, g, p), ns(t))
    ir = irs(); gc = gate(N, T['proof']); out = {}; dry_vox = None
    for (stem, cut), x in raw.items():
        if stem == 'vox': dry_vox = x.copy()
        s = SENDS.get(stem)
        if s and fx: x = x + dsp.reverb(x, ir[s[0]], wet=s[1])
        if cut: x = x * gc[:, None]
        out[stem] = out.get(stem, 0) + x
    return out, dry_vox

def mixdown(st, dry_vox, sc, spans=(), t_back=None):
    """stems -> ducked stems + premaster (N = DUR exactly)"""
    DUR = sc['dur']; N = ns(DUR)
    d1, act = duck_db(dry_vox[:N], spans)
    st = {k: v[:N].copy() for k, v in st.items()}
    for k, depth in DUCKED.items():
        if k in st: st[k] *= dsp.undb(d1 * depth)[:, None]
    for k in ('groove', 'brand'):                                            # + carve the presence band under the voice
        if k in st: st[k] = carve(st[k], d1)
    hole = gate(N, sc['T']['proof'], t_on=t_back)                            # the zero-phase carve smears a few 1e-4 into the
    for k in MUSIC:                                                          # cut window: the music stays digital silence
        if k in st: st[k] *= hole[:, None]                                   # from T.proof to the first music after it
    end = gate(N, DUR - .04, fade=.06)                                       # the final chord is choked: clean stop
    for k in MUSIC:
        if k in st: st[k] *= end[:, None]
    music = sum(st[k] for k in MUSIC if k in st)
    P = A.sclip(music, .7) + st.get('sfx', 0) + A.sclip(st.get('hit', np.zeros((N, 2))), .5) + st.get('amb', 0) + st['vox']
    return st, P, d1, act

def carve(x, d1, depth_db=CARVE_DB, lo=900.0, hi=5000.0):
    """extra dip of the 0.9-5 kHz band (zero-phase split, exact reconstruction) on the same sidechain curve"""
    l, rest = dsp.zp_split(x, lo, 2); m, h = dsp.zp_split(rest, hi, 2)
    return l + m * dsp.undb(d1 * depth_db)[:, None] + h

def master(P, target=-14.0, ceiling=-1.3):
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    P = dsp.butter(P, 'hp', 28, 2)
    g = target - meter.integrated_loudness(P)
    for _ in range(8):
        Y, gl = dsp.limiter(P * dsp.undb(g), ceiling_db=ceiling, lookahead=.003, release=.08)
        L = meter.integrated_loudness(Y)
        if abs(L - target) < .02: break
        g += target - L
    return Y, g, gl

def true_peak_db(y, os_=8):
    import scipy.signal as sps
    pad = np.zeros((256, y.shape[1])); up = sps.resample_poly(np.vstack([pad, y, pad]), os_, 1, axis=0)
    return 20 * math.log10(np.abs(up).max() + 1e-12)

# =====================================================================================================================
# checks
# =====================================================================================================================
def env_db(x, win=.001):
    m = x if x.ndim == 1 else x.mean(1)
    return np.sqrt(np.maximum(uniform_filter1d(m ** 2, max(1, ns(win))), 0) + 1e-20)

def iso_onset(M, tag, frac=.1):
    """onset of a cue rendered ALONE (its tagged events, dry, panned, summed mono): first time its 1-ms RMS envelope reaches
    `frac` of the event's max; also the placement (first sample above -60 dB re max)"""
    evs = [e for e in M.ev if e[6] == tag]
    if not evs: return None, None
    t0 = min(e[2] for e in evs) - .05; t1 = max(e[2] + len(e[1]) / SR for e in evs)
    buf = np.zeros(ns(t1 - t0) + 1)
    for e in evs: place_at(buf, stereo_of(e[1], e[3], e[4]).mean(1), ns(e[2] - t0))
    env = env_db(buf); mx = env.max()
    return t0 + int(np.argmax(env >= frac * mx)) / SR, t0 + int(np.argmax(np.abs(buf) >= 1e-3 * np.abs(buf).max())) / SR

_PH = {}
def phone(x):
    """what a phone speaker keeps: 300 Hz - 8 kHz (4th-order Butterworth)"""
    return dsp.butter(dsp.butter(x, 'hp', 300, 4), 'lp', 8000, 4)

def kpow(x, a, b):
    """K-weighted mean square of x[a:b] (stereo)"""
    if b <= a: return 1e-20
    y = dsp.kweight(x[a:b]); return float(np.mean(np.sum(y ** 2, axis=1))) + 1e-20

def lra(x):
    """EBU R128 loudness range: 3-s short-term blocks (hop .1 s), gates -70 LUFS abs / -20 LU rel, P95 - P10"""
    _, ls = dsp.lufs_shortterm(x, .1); ls = ls[ls > -70]
    if len(ls) == 0: return None
    p = 10 ** (ls / 10); ls = ls[ls > 10 * np.log10(np.mean(p)) - 20]
    return float(np.percentile(ls, 95) - np.percentile(ls, 10))

def build(sheet=False):
    import soundfile as sf, pyloudnorm as pyln
    sc = score(); T, DUR = sc['T'], sc['dur']; N = ns(DUR)
    lines = voice_plan()
    log(f'[R] score: {sc["src"]} · {len(sc["cues"])} cues · DUR {DUR} s · data/score_cues.json in step: {sc["json_in_step"]}')
    M, vinfo, unknown = compose(sc, lines)
    if unknown: log('[R] WARNING unhandled cue names:', unknown)
    log(f'[R] {len(M.ev)} events · rendering')
    st, dry_vox = render(M, sc)
    seg_rows = []
    for k, (a, e) in enumerate(tense_segments(T)):
        ne = sum(1 for ev in M.ev if ev[6] == ('seg', k) or (k == 0 and ev[6] == 'music_in'))
        seg_rows.append(dict(k=k, a=a, e=e, events=ne, rate=ne / (e - a), lufs=float(dsp.lufs_integrated(st['groove'][ns(a):ns(e)]))))
    t_back = min(e[2] for e in M.ev if e[0] in MUSIC and not e[5] and e[2] > T['proof'])
    st, P, d1, act = mixdown(st, dry_vox, sc, [(v['film_on'], v['film_off']) for v in vinfo], t_back)
    Y, g, gl = master(P)
    tp = true_peak_db(Y); ceil = -1.3
    while tp > -1.0 and ceil > -3:
        ceil -= (tp + 1.0) + .05; Y, g, gl = master(P, ceiling=ceil); tp = true_peak_db(Y)
    assert len(Y) == N
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'mix.wav'), Y, 'PCM_24')
    G = dsp.undb(g)
    stems = {'vox': st['vox'], 'music': sum(st[k] for k in MUSIC if k in st), 'sfx': st['sfx'], 'hits': st['hit'], 'amb': st['amb']}
    for k, v in stems.items(): dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), v * G, 'FLOAT')
    # ---------------- checks ----------------
    Z, sr = sf.read(os.path.join(OUT_A, 'mix.wav')); meter = pyln.Meter(SR)
    rep = dict(sr=sr, n=len(Z), dur=len(Z) / sr, channels=Z.shape[1], master_gain_db=g, limiter_ceiling_db=ceil,
               lufs=meter.integrated_loudness(Z), tp_dbtp=true_peak_db(Z), sample_peak_db=20 * math.log10(np.abs(Z).max()),
               lra=None, max_gr_db=float(-20 * np.log10(gl.min())), clipped=int((np.abs(Z) >= .9999).sum()),
               dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())], src=sc['src'])
    rep['lra'] = lra(Z)
    rep['seam'] = dict(step=float(np.abs(Z[0] - Z[-1]).max()), local_p99=float(np.percentile(np.abs(np.diff(Z[-ns(.03):], axis=0)), 99)))
    mus = stems['music'] * G; vox = stems['vox'] * G
    rest = (stems['sfx'] + stems['hits'] + stems['amb']) * G
    vox_ph, oth_ph = phone(vox), phone(mus + rest)
    # cue table
    rows = []
    for i, c in enumerate(sc['cues']):
        t, name = c['t'], c['name']
        if name == 'cut':
            e = env_db(mus); pre = e[ns(t - .3):ns(t - .01)].max()
            idx = ns(t - .3) + int(np.nonzero(e[ns(t - .3):ns(t + .2)] > pre * 1e-3)[0].max())
            post = float(np.abs(mus[ns(t):ns(t_back)]).max())
            rows.append(dict(t=t, name=name, kind='music off (-60 dB)', on=idx / SR, err=(idx / SR - t) * 1000, mix=None, mix_err=None,
                             note=f'music max |x| in [proof, next music) = {post:.1e}'))
            continue
        o, place0 = iso_onset(M, ('cue', i))
        if o is None: rows.append(dict(t=t, name=name, kind='-', on=None, err=None, mix=None, mix_err=None, note='no event')); continue
        f = A.flux_onset(Z, t)
        rows.append(dict(t=t, name=name, kind='alone', on=o, err=(o - t) * 1000, place=place0, mix=f,
                         mix_err=None if f is None else (f - t) * 1000, note=''))
    o, _ = iso_onset(M, 'music_in')
    rows.append(dict(t=T['amberForm'], name='music_in', kind='alone', on=o, err=(o - T['amberForm']) * 1000,
                     mix=A.flux_onset(Z, T['amberForm']), mix_err=None, note='T.amberForm (not a listed cue)'))
    if rows[-1]['mix'] is not None: rows[-1]['mix_err'] = (rows[-1]['mix'] - T['amberForm']) * 1000
    rep['cues'] = rows
    rep['cues_ok'] = all(r['err'] is not None and abs(r['err']) <= 15 for r in rows)
    # music grid: every impact vs the beat grid in force
    segs = tense_segments(T); grid = []
    for name, arr in (('fall', T['falls']), ('rebound', T['rebounds'])):
        for j, tc in enumerate(arr):
            a = max(s[0] for s in segs if s[0] <= tc + 1e-9); k = round((tc - a) / BEAT)
            grid.append(dict(name=f'{name}{j + 1}', t=tc, beat=a + k * BEAT, err=(tc - a - k * BEAT) * 1000))
    for name, tc in [('check', T['check'])] + [(f'gulp{j + 1}', x) for j, x in enumerate(T['gulps'])] + [('hic', T['hic'])]:
        k = round((tc - T['check']) / BEAT); grid.append(dict(name=name, t=tc, beat=T['check'] + k * BEAT, err=(tc - T['check'] - k * BEAT) * 1000))
    tv = np.array(list(T['falls']) + list(T['rebounds']))
    best = min(((max(abs(((tv - o_) / BEAT - np.round((tv - o_) / BEAT)) * BEAT)) * 1000, o_) for o_ in np.arange(0, .5, .0005)))
    rep['segments'] = seg_rows
    rep['grid'] = grid; rep['single_grid_best'] = dict(max_err_ms=best[0], origin=best[1])
    # voices
    vrows = []; prev = None
    for v in vinfo:
        a, b = ns(v['film_on']), ns(v['film_off'])
        ev = env_db(vox, .01); seg = ev[ns(v['t0']):ns(v['t1'])]; thr = seg.max() * 10 ** (-30 / 20)
        nzi = np.nonzero(seg > thr)[0]
        m_on, m_off = v['t0'] + nzi[0] / SR, v['t0'] + nzi[-1] / SR
        margin = 10 * math.log10(kpow(vox, a, b) / kpow(mus, a, b))
        margin_all = 10 * math.log10(kpow(vox, a, b) / kpow(mus + rest, a, b))
        wm = []; lp = kpow(vox, a, b); nskip = 0
        for w in v['words']:
            wa = ns(v['at'] + max(w['s'], v['on']) * v['stretch']); wb = ns(v['at'] + min(w['e'], v['off']) * v['stretch'])
            if wb - wa > ns(.04) and kpow(vox, wa, wb) < lp * .01: nskip += 1; continue      # a pause, not a word
            if wb - wa > ns(.04): wm.append((w['w'], 10 * math.log10(kpow(vox, wa, wb) / kpow(mus, wa, wb)),
                                             10 * math.log10(kpow(vox, wa, wb) / kpow(mus + rest, wa, wb)),
                                             10 * math.log10(kpow(vox_ph, wa, wb) / kpow(oth_ph, wa, wb))))
        gap = None if prev is None else v['t0'] - prev['t1']
        vrows.append(dict(id=v['id'], file=v['file'], at=v['at'], stretch=v['stretch'], t0=v['t0'], t1=v['t1'], on=v['film_on'],
                          off=v['film_off'], T=T.get(v['id']), m_on=m_on, m_off=m_off, margin=margin, margin_all=margin_all,
                          word_min=min((x[1] for x in wm), default=None), word_min_all=min((x[2] for x in wm), default=None),
                          word_worst=min(wm, key=lambda x: x[2])[0] if wm else None, gap=gap, words_checked=len(wm), words_pause=nskip,
                          phone=10 * math.log10(kpow(vox_ph, a, b) / kpow(oth_ph, a, b)),
                          phone_word_min=min((x[3] for x in wm), default=None), phone_word=min(wm, key=lambda x: x[3])[0] if wm else None,
                          lufs=float(dsp.lufs_integrated(vox[ns(v['t0']):ns(v['t1'])])), deess=v['deess_max_db'], ds_frac=v['deess_frac']))
        prev = v
    rep['voices'] = vrows
    rep['voices_overlap'] = any(r['gap'] is not None and r['gap'] < 0 for r in vrows)
    rep['voices_ok'] = (not rep['voices_overlap']) and all(r['margin'] >= 10 for r in vrows)
    # the cut
    a, b = ns(T['proof']), ns(t_back)
    rep['cut'] = dict(t_back=t_back, music_max=float(np.abs(mus[a:b]).max()), music_pre_rms_db=20 * math.log10(np.sqrt(np.mean(mus[a - ns(.5):a] ** 2)) + 1e-12),
                      mix_rms_db=20 * math.log10(np.sqrt(np.mean(Z[a:b] ** 2)) + 1e-12))
    rep['duck_max_db'] = float(-d1.min() * DUCK_DB)
    # report
    log(f'[R] mix.wav {rep["n"]} samples = {rep["dur"]:.6f} s @ {sr} Hz x{rep["channels"]} · {rep["lufs"]:.2f} LUFS · TP {rep["tp_dbtp"]:.2f} dBTP · '
        f'sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {rep["lra"] if rep["lra"] is None else round(rep["lra"], 1)} LU · '
        f'master {g:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB (ceiling {ceil:.2f}) · clipped {rep["clipped"]}')
    log('[R] cues (alone = the cue\'s own events rendered alone, 10 % of max of a 1-ms envelope; mix = spectral-flux onset in mix.wav)')
    for r in rows:
        log(f'    {r["t"]:7.3f}  {r["name"]:12s} {r["kind"]:18s} '
            f'{fm(r["err"], "+6.1f", "", " ms")}   mix {fm(r["mix_err"], "+6.1f", "   -  ", " ms")}  {r["note"]}')
    log(f'[R] cues within 15 ms: {rep["cues_ok"]}')
    log('[R] tense segments (un-ducked): ' + ' · '.join(f'#{r["k"]} {r["a"]:.3f}-{r["e"]:.3f} {r["rate"]:.0f} ev/s {r["lufs"]:.1f} LUFS' for r in seg_rows))
    log('[R] grid: ' + ' · '.join(f'{x["name"]} {x["err"]:+.1f}' for x in grid) + f' ms   (best single grid would be ±{best[0]:.0f} ms)')
    log('[R] voices')
    for r in vrows:
        log(f'    {r["id"]:3s} {r["file"]:10s} x{r["stretch"]:.2f} region {r["t0"]:7.3f}-{r["t1"]:7.3f} speech {r["on"]:7.3f}-{r["off"]:7.3f} '
            f'(T {r["T"]}) measured {r["m_on"]:7.3f}-{r["m_off"]:7.3f} · over music {r["margin"]:5.1f} dB (worst word {r["word_min"] if r["word_min"] is None else round(r["word_min"], 1)}) '
            f'· over all {r["margin_all"]:5.1f} dB (worst word {r["word_worst"]} {r["word_min_all"] if r["word_min_all"] is None else round(r["word_min_all"], 1)}) '
            f'· phone band over all {r["phone"]:5.1f} dB (worst word {r["phone_word"]} {fm(r["phone_word_min"], ".1f")}) '
            f'· gap {fm(r["gap"], ".3f", "  -  ", "")} · {r["lufs"]:.1f} LUFS · de-ess max {r["deess"]:.1f} dB')
    log(f'[R] voices overlap: {rep["voices_overlap"]} · all >= 10 dB over the music: {all(r["margin"] >= 10 for r in vrows)}')
    log(f'[R] loop seam (end -> start): step {rep["seam"]["step"]:.4f} vs local sample-step p99 {rep["seam"]["local_p99"]:.4f} (hum in integer cycles)')
    log(f'[R] cut at {T["proof"]}: music max |x| {rep["cut"]["music_max"]:.1e} until the next music at {t_back:.3f} (pre-cut music {rep["cut"]["music_pre_rms_db"]:.1f} dBFS RMS)')
    if sheet: make_sheet(Z, stems, G, d1, rep, sc, vinfo)
    return rep

# =====================================================================================================================
# sheet
# =====================================================================================================================
def make_sheet(Z, stems, G, d1, rep, sc, vinfo, path=SHEET):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    T, DUR = sc['T'], sc['dur']
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#120d1e', 'figure.facecolor': '#0b0814', 'text.color': '#e8e2f4',
                         'axes.labelcolor': '#e8e2f4', 'xtick.color': '#b9b0cc', 'ytick.color': '#b9b0cc', 'axes.edgecolor': '#3a3050'})
    fig = plt.figure(figsize=(20, 30), dpi=100)
    fig.subplots_adjust(top=.95, bottom=.012, left=.05, right=.96)
    gs = fig.add_gridspec(8, 3, height_ratios=[3.4, 1.0, 2.2, 1.5, 1.7, 1.3, 2.3, 1.9], hspace=.45, wspace=.14)
    ccol = {'boum': '#ff5a5a', 'big_stamp': '#ff5a5a', 'clac': '#ff8a3a', 'slap': '#ff8a3a', 'major': '#ffd84a', 'final_chord': '#ffd84a',
            'bonzini_sig': '#b48cff', 'riser': '#b48cff', 'rewind': '#b48cff', 'cut': '#3ee0ff', 'mock': '#ffd84a'}
    vcol = lambda lid: '#ffb24a' if lid.startswith('T') else '#b48cff'
    xt = np.arange(0, DUR + .01, 1.0)
    def marks(ax, labels=False, ymax=1.0):
        ax.axvspan(T['proof'], T['crush'] + .6, color='#3ee0ff', alpha=.06)
        for c in sc['cues']:
            ax.axvline(c['t'], ymin=.94 if labels else 0, ymax=1, color=ccol.get(c['name'], '#9fe08a'), lw=.9, alpha=.9 if labels else .25)
    # 1 spectrogram
    ax = fig.add_subplot(gs[0, :]); m = Z.mean(1)
    f, t, S_ = sps.stft(m, SR, nperseg=4096, noverlap=4096 - 240)
    P = 20 * np.log10(np.abs(S_) + 1e-9); fl = np.geomspace(30, 18000, 420); rr = np.interp(fl, f, np.arange(len(f)))
    Pi = P[np.round(rr).astype(int)]; top = np.percentile(Pi, 99.8)
    ax.pcolormesh(t, fl, Pi, vmin=top - 85, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(30, 18000)
    ax.set_xlim(0, DUR); ax.set_xticks(xt); ax.set_ylabel('Hz')
    ax.set_title('mix.wav — log spectrogram · cue ticks + names (top) · voice speech spans (bars, bottom: amber = TOI, violet = narrator) · '
                 'cyan = TOTAL cut window (T.proof -> mock)', loc='left', pad=66)
    marks(ax, True)
    for i, c in enumerate(sc['cues']):
        ax.text(c['t'], 19500, c['name'], rotation=90, fontsize=6.5, va='bottom', ha='center', color=ccol.get(c['name'], '#9fe08a'))
    for v in vinfo:
        ax.plot([v['film_on'], v['film_off']], [36, 36], color=vcol(v['id']), lw=6, solid_capstyle='butt')
        ax.text((v['film_on'] + v['film_off']) / 2, 40, v['id'], ha='center', fontsize=8, color='w')
    for x0, lab in ((0, 'silence + hum'), (T['amberForm'], 'TENSE F#m (stop-time)'), (T['proof'], 'CUT · cricket · plic · squish · mock'),
                    (T['rewind'], 'rewind · riser'), (T['violetIn'], 'violet: pad + balafon'), (T['check'], 'A MAJOR makossa')):
        ax.text(x0 + .05, 60, lab, fontsize=8, color='w', alpha=.9)
    for a, e in tense_segments(T): ax.axvline(a, ymin=0, ymax=.06, color='#ffd84a', lw=1.5)
    # 2 waveform
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#c9b6ff'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, DUR); ax.set_ylim(-1, 1); ax.set_xticks(xt); ax.axhline(10 ** (-1 / 20), color='r', lw=.5, ls='--'); ax.axhline(-10 ** (-1 / 20), color='r', lw=.5, ls='--')
    ax.set_title(f'waveform (L up / |R| down) · ±1 dBFS lines · TP {rep["tp_dbtp"]:.2f} dBTP · sample peak {rep["sample_peak_db"]:.2f} dBFS', loc='left')
    marks(ax)
    # 3 levels
    ax = fig.add_subplot(gs[2, :])
    def mom(x, hop=.02): tm, lm = dsp.lufs_momentary(x, hop); return tm, np.maximum(lm, -80)
    for x, lab, col, lw in ((Z, 'mix', '#ffffff', 1.2), (stems['vox'] * G, 'voices', '#ffb24a', 1.0), (stems['music'] * G, 'music (ducked)', '#3ee0ff', 1.0),
                            ((stems['sfx'] + stems['hits']) * G, 'sfx + impacts', '#ff5a5a', .8), (stems['amb'] * G, 'hum + amb', '#9fe08a', .7)):
        tm, lm = mom(x); ax.plot(tm, lm, color=col, lw=lw, label=lab)
    ts, ls = dsp.lufs_shortterm(Z, .05); ax.plot(ts, ls, color='#ffd84a', lw=1, ls='--', label='mix short-term (3 s)')
    for v in vinfo: ax.axvspan(v['film_on'], v['film_off'], color=vcol(v['id']), alpha=.10)
    for r in rep['voices']:
        ax.text((r['on'] + r['off']) / 2, -6, f'{r["id"]}\n+{r["margin"]:.1f}', ha='center', va='top', fontsize=7.5,
                color='#9fe08a' if r['margin'] >= 10 else '#ff5a5a')
    ax.set_xlim(0, DUR); ax.set_ylim(-70, -2); ax.set_xticks(xt); ax.axhline(-14, color='w', lw=.5, ls=':')
    ax2 = ax.twinx(); ax2.plot(np.arange(len(d1))[::240] / SR, d1[::240] * DUCK_DB, color='#ff7ad9', lw=1, label='music duck (dB)')
    ax2.set_ylim(-40, 2); ax2.set_ylabel('duck dB', color='#ff7ad9')
    ax.legend(loc='lower left', ncol=6, fontsize=7, facecolor='#120d1e'); ax2.legend(loc='lower right', fontsize=7, facecolor='#120d1e')
    ax.set_title(f'momentary loudness (400 ms) per stem, post master gain, pre-limiter · integrated {rep["lufs"]:.2f} LUFS · '
                 f'numbers = voice over music bed during each line (dB, K-weighted, speech span)', loc='left')
    marks(ax)
    # 4 zooms
    zs = [(T['proof'] - .35, T['proof'] + .35, f'the TOTAL cut at T.proof = {T["proof"]:.3f}: music stem (cyan) vs mix', 'cut'),
          (T['slam'] - .15, T['slam'] + .6, f'BOUM at T.slam = {T["slam"]:.3f} (impact bus peaks over everything)', 'boum'),
          (DUR - .7, DUR, f'final chord at {DUR - .5:.2f} and the clean stop at {DUR:.2f}', 'end')]
    for j, (a0, a1, title, kind) in enumerate(zs):
        ax = fig.add_subplot(gs[3, j]); a, b = ns(a0), min(len(Z), ns(a1)); xs = np.arange(a, b) / SR
        e_mix = 20 * np.log10(env_db(Z[a:b], .002) + 1e-9); e_mus = 20 * np.log10(env_db((stems['music'] * G)[a:b], .002) + 1e-9)
        ax.plot(xs, e_mix, color='#ffffff', lw=.8, label='mix'); ax.plot(xs, e_mus, color='#3ee0ff', lw=.9, label='music')
        if kind == 'boum': ax.plot(xs, 20 * np.log10(env_db((stems['hits'] * G)[a:b], .002) + 1e-9), color='#ff5a5a', lw=.8, label='impacts')
        if kind == 'cut': ax.axvline(T['proof'], color='#3ee0ff', lw=1.2)
        ax.set_ylim(-100, 0); ax.set_xlim(a0, a1); ax.set_title(title, loc='left', fontsize=8); ax.legend(fontsize=7, facecolor='#120d1e')
        ax.set_ylabel('dBFS (2-ms RMS)')
    # 4b zoom spectrograms
    for j, (a0, a1, title) in enumerate(((0.0, 2.4, 'opening: hum · whistle 1.8k->500 · BOUM · aïe · marbles · music in'),
                                         (T['rewind'] - .15, T['violetIn'] + .7, 'rewind (fight read backwards) · riser · signature E6->G#6 · tonk'),
                                         (T['stamp'] - .3, T['check'] + .9, 'stamp (E hit) · clinks B6 G#6 E6 · A-major arrival'))):
        ax = fig.add_subplot(gs[4, j]); a, b = ns(a0), ns(a1)
        f, t, S_ = sps.stft(m[a:b], SR, nperseg=2048, noverlap=2048 - 120)
        P = 20 * np.log10(np.abs(S_) + 1e-9); fl = np.geomspace(40, 16000, 300); rr = np.interp(fl, f, np.arange(len(f)))
        Pi = P[np.round(rr).astype(int)]; top = np.percentile(Pi, 99.7)
        ax.pcolormesh(t + a0, fl, Pi, vmin=top - 80, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(40, 16000)
        for c in sc['cues']:
            if a0 <= c['t'] <= a1:
                ax.axvline(c['t'], ymin=.9, ymax=1, color=ccol.get(c['name'], '#9fe08a'), lw=1.2)
                ax.text(c['t'], 17000, c['name'], rotation=90, fontsize=6, va='bottom', ha='center', color=ccol.get(c['name'], '#9fe08a'))
        for v in vinfo:
            if v['film_off'] > a0 and v['film_on'] < a1: ax.axvspan(max(a0, v['film_on']), min(a1, v['film_off']), ymin=0, ymax=.03, color=vcol(v['id']))
        ax.set_xlim(a0, a1); ax.set_title(title, loc='left', fontsize=8, pad=34)
    # 5 grid plot: impacts vs beats
    ax = fig.add_subplot(gs[5, :2])
    for a, e in tense_segments(T):
        for k in range(8):
            tb = a + k * BEAT
            if tb < e: ax.axvline(tb, color='#ffd84a', lw=.8, alpha=.5)
        ax.axvspan(e, a + 0, color='w', alpha=0)
    tb = T['check']
    while tb < DUR - .4: ax.axvline(tb, color='#ffd84a', lw=.8, alpha=.5); tb += BEAT
    v0 = T['violetIn']; tb = v0
    while tb <= T['stamp'] + 1e-6: ax.axvline(tb, color='#b48cff', lw=.8, alpha=.5); tb += BEAT
    for c in sc['cues']: ax.plot([c['t']], [.5], 'v', color=ccol.get(c['name'], '#9fe08a'), ms=6)
    for a, e in tense_segments(T): ax.axvspan(e, e + .0001, color='w')
    for a, e in tense_segments(T)[:-1]:
        nxt = [s for s in tense_segments(T) if s[0] > a][0][0]; ax.axvspan(e, nxt, color='#ff5a5a', alpha=.12)
    ax.set_xlim(0, DUR); ax.set_xticks(xt); ax.set_yticks([])
    ax.set_title(f'beat grids (gold = makossa grids: stop-time segments anchored on T.amberForm + each fall, then T.check; violet = brand grid from '
                 f'T.violetIn) · red = stop-time breaks · triangles = cues · single fixed grid would miss impacts by up to ±{rep["single_grid_best"]["max_err_ms"]:.0f} ms',
                 loc='left', fontsize=7.5)
    ax = fig.add_subplot(gs[5, 2]); ax.axis('off')
    gl = ['impact      t        beat     err'] + [f'{x["name"]:10s} {x["t"]:7.3f}  {x["beat"]:7.3f}  {x["err"]:+5.1f} ms' for x in rep['grid']]
    gl += ['', 'tense segment  anchor-stop      ev/s  LUFS*'] + [f'  #{r["k"]}       {r["a"]:6.3f}-{r["e"]:6.3f}  {r["rate"]:4.0f}  {r["lufs"]:5.1f}' for r in rep['segments']]
    gl += ['  * un-ducked groove stem']
    ax.text(0, 1, '\n'.join(gl), family='monospace', fontsize=7.5, va='top')
    # 6 cue table
    ax = fig.add_subplot(gs[6, :]); ax.axis('off')
    hd = f'{"t":>7}  {"cue":12s} {"alone":>8} {"err":>8}   {"mix":>8} {"err":>8}'
    L = [hd]
    for r in rep['cues']:
        L.append(f'{r["t"]:7.3f}  {r["name"]:12s} {fm(r["on"], "8.3f", "", "")} '
                 f'{fm(r["err"], "+6.1f", "", "ms")}   {fm(r["mix"], "8.3f", "     -  ", "")} '
                 f'{fm(r["mix_err"], "+6.1f", "     -", "ms")}')
    h = (len(L) + 2) // 2
    ax.text(0, .95, '\n'.join(L[:h]), family='monospace', fontsize=7.6, va='top')
    ax.text(.5, .95, '\n'.join([hd] + L[h:]), family='monospace', fontsize=7.6, va='top')
    ok = rep['cues_ok']
    ax.text(0, 1.02, f'every cue within 15 ms (alone): {ok} · « cut » = music stem below -60 dB re pre-cut level; music max |x| from T.proof to the mock = '
                     f'{rep["cut"]["music_max"]:.1e} · mix column = spectral-flux onset in mix.wav (masked cues are expected to differ: aie under the BOUM, ...)',
            fontsize=8, va='top', color='#9fe08a' if ok else '#ff5a5a')
    # 7 voice table + loudness
    ax = fig.add_subplot(gs[7, :]); ax.axis('off')
    L = [f'{"id":3s} {"take":10s} {"str":>5} {"region":>15}  {"speech (plan)":>15}  {"T.id":>6}  {"measured":>15}  {"gap":>6}  {"LUFS":>6}  '
         f'{"/music":>7} {"word min":>8}  {"/all":>6} {"worst word (all)":>22}  {"phone":>6} {"worst word (phone)":>22}  de-ess']
    for r in rep['voices']:
        L.append(f'{r["id"]:3s} {r["file"]:10s} {r["stretch"]:5.2f} {r["t0"]:7.3f}-{r["t1"]:7.3f}  {r["on"]:7.3f}-{r["off"]:7.3f}  '
                 f'{r["T"] if r["T"] is not None else float("nan"):6.3f}  {r["m_on"]:7.3f}-{r["m_off"]:7.3f}  '
                 f'{fm(r["gap"], "6.3f", "   -  ", "")}  {r["lufs"]:6.1f}  {r["margin"]:+6.1f}  '
                 f'{fm(r["word_min"], "+6.1f", "   -", "")}    {r["margin_all"]:+6.1f} '
                 f'{(r["word_worst"] or "-")[:12]:>12} {fm(r["word_min_all"], "+6.1f", "", "")}   {r["phone"]:+6.1f} '
                 f'{(r["phone_word"] or "-")[:12]:>12} {fm(r["phone_word_min"], "+6.1f", "", "")}   {r["deess"]:4.1f} dB')
    L.append('')
    L.append(f'voices overlap: {rep["voices_overlap"]} · every line >= 10 dB over the music bed: {all(r["margin"] >= 10 for r in rep["voices"])} · '
             f'duck {rep["duck_max_db"]:.1f} dB + {CARVE_DB:.0f} dB carve of 0.9-5 kHz (look-ahead 100 ms, att 35 ms, rel 220 ms, held through each line, gaps < .4 s held) · '
             f'soft SFX duck {SFX_DUCK_DB:.0f} dB · phone = 300 Hz-8 kHz band, voice vs everything else')
    L.append(f'mix.wav: {rep["n"]} samples = {rep["dur"]:.6f} s @ {rep["sr"]} Hz, {rep["channels"]} ch · integrated {rep["lufs"]:.2f} LUFS (pyloudnorm) · '
             f'true peak {rep["tp_dbtp"]:.2f} dBTP (8x) · sample peak {rep["sample_peak_db"]:.2f} dBFS · LRA {rep["lra"] if rep["lra"] is None else round(rep["lra"], 1)} LU · '
             f'master gain {rep["master_gain_db"]:+.2f} dB · limiter max GR {rep["max_gr_db"]:.1f} dB · clipped {rep["clipped"]} · '
             f'loop seam step {rep["seam"]["step"]:.4f} (local p99 {rep["seam"]["local_p99"]:.4f})')
    L.append(f'score: {rep["src"]} · word margins use the ASR word times of data/vocheck.json (approximate)')
    ax.text(0, 1, '\n'.join(L), family='monospace', fontsize=7.6, va='top')
    fig.suptitle('« PAS REÇU. » — audio check sheet (lib/audio_recu.py)', x=.01, y=.997, ha='left', fontsize=14, color='w')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fig.savefig(path, dpi=100, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    log('[R] sheet ->', path)

if __name__ == '__main__':
    build(sheet='--sheet' in sys.argv)

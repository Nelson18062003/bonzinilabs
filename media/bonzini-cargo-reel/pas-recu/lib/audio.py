"""« Le Bonneteau du Feyman » — module A: the 16.000-s loop soundtrack (48 kHz stereo, synthesised, no samples).

ONE score drives picture and sound: the cue list, the swaps, the reveal lifts and the bulb curve are read live from
overlay/scenes/01_score.js through node (fallback: data/score_cues.json + a replica of SCORE.light). Move a cue in the
score, rerun this file, the sound follows.

Music: bikutsi in 12/8, dotted quarter = 120 (bar 2.0 s, beat 0.5 s, triplet eighth 1/6 s), E minor, 8 bars:
  bar 1  « nuit » ostinato (muted guitar repeated notes, seed rattles, bulb hum); its downbeat is TAKEN by the THOK
         (0.133 s): the 0.0 slot is a breath + the parcel's rise, the guitar's E3 thumb note lands with the THOK
  bar 2  count 3-2-1 = wood taps on the beat, a rattle roll that climbs into the STAMP (3.0), guitar cut 3.0-3.5
  3.5-8  the groove enters with the first swap and builds by DENSITY only (tempo never moves):
         A 3.5-5.5  kick on the beat, bass, balafon answers, claps on 2 & 4, rattles 2 per beat
         B 5.5-7.0  claps double (every beat), rattles in triplet eighths, congas, 2nd guitar, busier balafon
         7.0        THE STEAL: drums break for two eighths, the ring TING owns beat 3 (a cloth rustle at -24 dB under it)
         C 7.33-8   peak: kick + clap on every 5-frame swap, rattles in sixteenth-triplets, guitar tremolo, riser
         harmony Em | Em D | C B7 — the dominant is left hanging by ...
  bar 5  ... the TOTAL cut at 8.000 (reverb tails included): only the bulb hum + crackle, then the hollow toks
  bar 6  cricket, dust, the mocking 3-note guitar (B A F#: a question, unresolved)
  bar 7  brand light: E MAJOR (the B7 finally resolves), glass shimmer swept L->R, bright balafon, soft pad,
         3 dings L / C / R rising B5 E6 G#6, bass walks down to the tonic
  bar 8  the « nuit » ostinato of bar 1 again (the bulb relights, the hum returns with the picture's flicker)
Loop: everything is an event in cycle time (t mod 16). Linear stage rendered two ways and compared:
  W = one cycle + 4 s tail folded with loopwrap.wrap()  /  M = three cycles + tail, keep the middle cycle.
Master (bus glue + true-peak limiter) runs on the periodic premaster tiled x3, middle cycle kept -> steady state at the seam.
-14 LUFS integrated (pyloudnorm), true peak <= -1 dBTP (8x oversampled check across the seam).

usage:  nice -n 5 python3 lib/audio.py            -> audio/loop.wav, audio/loop_x3.wav, audio/stems/*.wav + checks
        nice -n 5 python3 lib/audio.py --sheet    -> also out/chk_A_sheet.jpg (spectrogram, levels, seam, cue table)
API:    build(check=True, sheet=False) -> dict(report)   · cues() -> list   · SFX functions sfx_<name>(...) -> np.ndarray
"""
import os, sys, json, math, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
X = os.path.abspath(os.path.join(HERE, '..'))
for p in (os.path.join(X, '..', 'explainer', 'lib', 'audio'), HERE):
    p = os.path.abspath(p)
    if p in sys.path: sys.path.remove(p)
    sys.path.insert(0, p)
import numpy as np
import dsp
from dsp import SR
import makossa as mk          # loop/lib copies first (the module cache keeps them for instruments.py)
import bikutsi as bk
import instruments as I
import loopwrap as lw

LOOP_S, NL = 16.0, 768000
BAR, BEAT, E8 = 2.0, 0.5, 1.0 / 6.0
TAIL = 4.0
CUT_T = 8.0
SCORE_JS = os.path.join(X, 'overlay', 'scenes', '01_score.js')
CUES_JSON = os.path.join(X, 'data', 'score_cues.json')
OUT_A = os.path.join(X, 'audio')
SLOT_X = [272, 540, 808]

def ns(t): return int(round(t * SR))
def tt(n): return np.arange(n) / SR
def nz(n, seed): return np.random.default_rng(seed).standard_normal(n)
def ex(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def m2f(m): return 440.0 * 2 ** ((m - 69) / 12)
def bp(x, fc, q=.707): return dsp.biquad(x, 'bp', fc, q)
def xpan(x): return float(np.clip((x - 540) / 540 * .9, -1, 1))
def panst(x, p):
    p = np.asarray(p, float); a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], 1)
def place(buf, sig, i):
    m = min(len(sig), len(buf) - i)
    if m > 0: buf[i:i + m] += sig[:m]
def tail_fade(y, ms=30.0):
    """cos² fade over the last min(ms, 20 %) of a rendered sound: synthesised decays never end on a step"""
    k = min(ns(ms / 1000), len(y) // 5)
    if k > 1:
        w = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
        y[-k:] *= w if y.ndim == 1 else w[:, None]
    return y

def grains(n, rate, seed, tau=.0015, amp=(0.25, 1.0), shape=None):
    """sparse random impulses (Poisson-ish, `rate` per second, optional density shape) smeared by a short decay"""
    r = np.random.default_rng(seed); p = rate / SR * (np.ones(n) if shape is None else shape)
    imp = (r.random(n) < p) * r.uniform(*amp, n)
    k = ex(max(8, ns(tau * 6)), tau)
    return np.convolve(imp, k)[:n]

# =====================================================================================================================
# score (live from the picture)
# =====================================================================================================================
_SC = None
def score():
    """{cues, swaps, reveal, light[480] = (on, violet)} — from 01_score.js via node, else the JSON + a python replica"""
    global _SC
    if _SC is not None: return _SC
    js = ("const S=require(%s);const L=[];for(let f=0;f<480;f++){const l=S.light(f);L.push([l.on,l.violet])}"
          "console.log(JSON.stringify({cues:S.soundCues(),swaps:S.SWAPS,reveal:S.REVEAL,light:L}))") % json.dumps(SCORE_JS)
    try:
        r = subprocess.run(['node', '-e', js], capture_output=True, text=True, timeout=60, check=True)
        _SC = json.loads(r.stdout); _SC['src'] = '01_score.js (live)'
    except Exception as e:                                    # fallback: the dumped JSON + replica of SCORE.light
        d = json.load(open(CUES_JSON))
        sw = [[round(s['t'] * 30), round(s['dur'] * 30), s['a'], s['b']] for s in d['swaps']]
        def on(f):
            if 358 <= f < 364: return 1 - min(1, max(0, (f - 358) / 5))
            if 364 <= f < 420: return 0.0
            if 420 <= f < 432: return [0, 1, .2, 1, 1, .1, .8, 1, 1, 1, 1, 1][f - 420]
            return 1.0
        _SC = {'cues': d['cues'], 'swaps': sw, 'reveal': [[270, 0, 'L', 9], [285, 2, 'R', 9], [300, 1, 'L', 22]],
               'light': [[on(f), 0] for f in range(480)], 'src': 'data/score_cues.json (fallback: %s)' % e}
    return _SC
def cues(): return score()['cues']

def periodic_curve(vals, fps=30, smooth_ms=6.0):
    """per-frame values (480) -> per-sample periodic curve (linear between frames, circular smoothing)"""
    v = np.asarray(vals, float); t = np.arange(NL) / SR * fps
    i0 = np.floor(t).astype(int) % len(v); fr = t - np.floor(t)
    c = v[i0] * (1 - fr) + v[(i0 + 1) % len(v)] * fr
    k = max(1, ns(smooth_ms / 1000)); ker = np.zeros(NL); ker[:k] = 1 / k; ker = np.roll(ker, -k // 2)
    return np.real(np.fft.ifft(np.fft.fft(c) * np.fft.fft(ker)))

# =====================================================================================================================
# instruments (series instruments + small wrappers)
# =====================================================================================================================
def gtr(m, seed, bright=.5, dur=.16, mute=1.0, decay=.985):
    return mk.guitar(m2f(m), dur, bright=bright, decay=decay, seed=seed, mute=mute)

def balafon(m, seed, dur=.42): return bk.balafon(m2f(m), dur, seed)

def balafon_bright(m, seed, dur=1.1):
    """the brand balafon: the series' FM mallet + a longer, glassier sine core and a 4th-harmonic sparkle"""
    y = bk.balafon(m2f(m), dur, seed); n = len(y); t = tt(n); f = m2f(m)
    y = y * .8 + .42 * np.sin(2 * np.pi * f * t) * np.exp(-t / .32) * np.minimum(1, t / .002) \
        + .10 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / .05)
    return dsp.hp(y, 220)

def rattle(seed, dur=.055, density=1.0, bright=1.0):
    """seed rattle (hochet): a cloud of tiny seed clicks, front-loaded, two bands (seeds 7 kHz + gourd body 2.4 kHz)"""
    n = ns(dur + .025); r = np.random.default_rng(seed); k = int(14 * density) + 4
    imp = np.zeros(n); idx = (r.beta(1.2, 2.8, k) * ns(dur)).astype(int); np.add.at(imp, idx, r.uniform(.3, 1, k))
    imp[0] += 1.0                                                     # the hand's first throw = a crisp onset
    env = np.convolve(imp, ex(ns(.006), .0011))[:n]
    hi = bp(nz(n, seed + 7) * env, 6800 * (.85 + .3 * bright), .8)
    body = bp(nz(n, seed + 9) * env, 2400, 1.1) * .35
    y = dsp.hp(hi + body, 1800)
    return y / (np.abs(y).max() + 1e-9) * .5

def rattle_roll(dur, seed):
    """the count-down roll: grain density and level climb, cut dead at the end (the stamp lands there)"""
    n = ns(dur); u = tt(n) / dur
    env = grains(n, 1.0, seed, .0011, (.3, 1), shape=140 + 420 * u ** 1.3)
    floor = bp(nz(n, seed + 1) * env, 6500, .8) + .35 * bp(nz(n, seed + 2) * env, 2400, 1.1)
    y = dsp.hp(floor, 1800) * .6
    step = E8 / 2                                                     # strokes on every sixteenth-triplet (1/12 s)
    for k in range(int(round(dur / step))):
        place(y, rattle(seed + 10 + k, .045, 1.0, .9 + .4 * k / (dur / step)) * (.5 + .5 * (k % 2 == 0)), ns(k * step))
    y = y * (.12 + .88 * u ** 1.5)
    y[-ns(.003):] *= np.linspace(1, 0, ns(.003))
    return y / (np.abs(y).max() + 1e-9) * .5

def wood(f, seed, g=1.0):
    """count tap: a gloved fingertip on the wooden table edge (short modal knock)"""
    n = ns(.12); t = tt(n)
    y = .55 * np.sin(2 * np.pi * f * t) * np.exp(-t / .022) + .22 * np.sin(2 * np.pi * f * 2.71 * t) * np.exp(-t / .009)
    y += .35 * np.sin(2 * np.pi * f * .5 * t) * np.exp(-t / .03)
    c = bp(nz(ns(.004), seed), 3500, 1) * np.linspace(1, 0, ns(.004)) * .6; y[:len(c)] += c
    return y * np.minimum(1, t / .0006) * g

def mix(*sigs):
    out = np.zeros(max(len(x) for x in sigs))
    for x in sigs: out[:len(x)] += x
    return out

def conga(m, seed, slap=False, g=1.0): return tail_fade(I.conga(m, 1.0, seed, slap=slap)) * g

def clap(seed, g=1.0): return mix(I.clap(1.0, seed) * 1.6, mk.clap(seed) * .22) * g

def kick(g=1.0, seed=0):
    """bikutsi kick: tighter and higher than the series' house kick (less sub peak, more phone-audible knock)"""
    n = ns(.3); t = tt(n); f = 58 + 135 * np.exp(-t / .022)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .105)
    y += .35 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR) * np.exp(-t / .03)
    c = bp(nz(ns(.004), seed), 3000, .9) * np.linspace(1, 0, ns(.004)) * .5; y[:len(c)] += c
    return tail_fade(dsp.softclip(y * 1.7, 1.3) * .85 * g)

def bass(m, dur=.3, pop=.4): return mk.bass(m2f(m), dur, pop)

def soft_pad(notes, dur, g=1.0):
    """brand pad: sine + octave, slightly detuned, slow swell and release (the violet light, as a sound)"""
    n = ns(dur); t = tt(n); y = np.zeros(n)
    for i, m in enumerate(notes):
        f = m2f(m); y += np.sin(2 * np.pi * f * t + i) + .5 * np.sin(2 * np.pi * f * 1.003 * t + 2 * i) + .12 * np.sin(4 * np.pi * f * t)
    a = np.minimum(1, t / .22) ** 1.5 * np.clip((dur - t) / .3, 0, 1)
    return dsp.lp(y * a, 3200) / len(notes) * .3 * g

def bend(y, cents, t0, t1):
    """pitch bend of a rendered note by resampling: 0 cents until t0, `cents` at t1"""
    n = len(y); t = tt(n); r = 2 ** (cents / 1200 * np.clip((t - t0) / (t1 - t0), 0, 1))
    pos = np.cumsum(r) - r[0]; pos = pos[pos < n - 1]
    return np.interp(pos, np.arange(n), y)

# =====================================================================================================================
# SFX (all synthesised, seeded) — each returns mono (n,) or stereo (n, 2); onset at sample 0 unless stated
# =====================================================================================================================
def sfx_thok(seed=11):
    """the parcel slammed against the phone glass: chest thump + hollow cardboard knock + crush + two glass partials"""
    n = ns(.9); t = tt(n)
    f = 54 + 150 * np.exp(-t / .022)
    body = dsp.softclip(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .10) * 1.6, 1.3)
    knock = bp(nz(n, seed), 430, 1.8) * ex(n, .040) * 2.6 + bp(nz(n, seed + 1), 960, 2.5) * ex(n, .022) * 1.3
    fb = 205 * (1 + .25 * np.exp(-t / .012))                                           # the box's hollow « tho- » (phone-audible)
    knock += np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-t / .09) * .9
    knock += np.sin(2 * np.pi * 118 * t) * np.exp(-t / .08) * .5
    crush = dsp.hp(bp(nz(n, seed + 2), 2300, .7) * grains(n, 1400, seed + 3, .0015, (.3, 1), shape=np.exp(-t / .03)), 900) * .9
    glass = (.20 * np.sin(2 * np.pi * 2350 * t) * np.exp(-t / .14) + .12 * np.sin(2 * np.pi * 3870 * t + 1) * np.exp(-t / .10)
             + .05 * np.sin(2 * np.pi * 5730 * t + 2) * np.exp(-t / .05)) * (1 - np.exp(-t / .0012))
    tick = dsp.hp(nz(ns(.005), seed + 4), 5000) * np.linspace(1, 0, ns(.005)) * .5
    mono = body * .95 + knock + crush; mono[:len(tick)] += tick
    mono = np.tanh(mono / 1.1)                                                         # dense, not spiky: loud at a modest peak
    st = np.stack([mono, mono], 1)
    d = ns(.009); st[:, 0] += glass; st[d:, 1] += glass[:-d] * .9                     # the glass ring a touch wide
    st = st * np.minimum(1, t / .0004)[:, None]
    return st / np.abs(st).max()

def sfx_rise(dur=.17, seed=12):
    """the parcel flies from the sleeve to the lens (f0-f4): rising air + fabric flutter, cut dead AT the impact"""
    n = ns(dur); t = tt(n); u = t / dur
    y = dsp.tv_biquad(nz(n, seed), 'bp', 450 * (3400 / 450) ** u, 1.3) * u ** 2.0
    y *= 1 + .4 * np.sin(2 * np.pi * 41 * t)
    y[-ns(.0015):] *= np.linspace(1, 0, ns(.0015))
    return y * .9

def sfx_cloth(seed=0, dur=.3, fc=2600, attack=.006):
    """wax fabric rustle (granular), with a defined grab at the start"""
    n = ns(dur); t = tt(n)
    env = grains(n, 260, seed, .0016, (.2, 1)) * np.minimum(1, t / attack) * np.clip(1 - t / dur, 0, 1) ** .7
    y = bp(nz(n, seed + 1) * env, fc, .7) + .45 * bp(nz(n, seed + 2) * env, 950, .8)
    y[:ns(.004)] += bp(nz(ns(.004), seed + 3), 3000, 1) * np.linspace(1, 0, ns(.004)) * .6
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_clac(seed=21):
    """mini container dropped back on the wax cloth: muffled thud, low conga body, a short hollow-steel ring"""
    n = ns(.55); t = tt(n)
    thud = np.sin(2 * np.pi * np.cumsum(68 + 95 * np.exp(-t / .018)) / SR) * np.exp(-t / .085)
    mat = dsp.lp(nz(n, seed), 900) * ex(n, .022) * 1.3
    steel = sum(a * np.sin(2 * np.pi * f * t + i) * np.exp(-t / d) for i, (f, a, d) in
                enumerate(((612, .22, .07), (1043, .15, .05), (1588, .09, .04), (2290, .05, .03))))
    c = dsp.hp(nz(ns(.003), seed + 1), 1500) * np.linspace(1, 0, ns(.003)) * .5
    y = thud * .9 + mat + steel; y[:len(c)] += c
    cg = conga(47, seed); y[:len(cg)] += cg * .7
    return y * np.minimum(1, t / .0005)

def sfx_tap(seed=31):
    """gloved fingertip on the corrugated roof: woody click + a tiny steel ring"""
    n = ns(.14); t = tt(n)
    y = .5 * np.sin(2 * np.pi * 1180 * t) * np.exp(-t / .018) + .2 * np.sin(2 * np.pi * 2630 * t) * np.exp(-t / .008)
    y += .07 * np.sin(2 * np.pi * 3410 * t) * np.exp(-t / .035) + .4 * np.sin(2 * np.pi * 210 * t) * np.exp(-t / .02)
    c = bp(nz(ns(.003), seed), 4000, 1) * np.linspace(1, 0, ns(.003)) * .5; y[:len(c)] += c
    return y * np.minimum(1, t / .0005)

def sfx_slide(dur, seed, pa, pb, fast=False):
    """a swap: glove grabs the steel (onset), two containers slide over the wax cloth in opposite directions
    (granular friction + air), each panned along its own path, soft set-down at the end"""
    tail = .14; n = ns(dur + tail); t = tt(n); u = np.clip(t / dur, 0, 1)
    out = np.zeros((n, 2))
    shape = np.sin(np.pi * u) ** .55 * (t < dur) * np.minimum(1, t / .012)
    for k, (p0, p1) in enumerate(((pa, pb), (pb, pa))):
        g = grains(n, 900 if fast else 520, seed + 10 * k, .0012, (.15, 1)) * shape
        fr = bp(nz(n, seed + 10 * k + 1) * g, (2200 if fast else 1500) * (1 + .15 * k), .9)
        fr += .6 * bp(nz(n, seed + 10 * k + 2) * g, 600, .9)
        fr = dsp.lp(fr, 5200)
        out += panst(fr * .55, p0 + (p1 - p0) * u)
    air = dsp.lp(I.whoosh(dur, seed + 5, 300, 3600 if fast else 2200), 6000) * .22
    out[:len(air)] += panst(air, (pa + pb) / 2)
    grip = .3 * np.sin(2 * np.pi * 2900 * tt(ns(.03))) * ex(ns(.03), .006) + .4 * np.sin(2 * np.pi * 180 * tt(ns(.03))) * ex(ns(.03), .012)
    grip[:ns(.002)] += bp(nz(ns(.002), seed + 3), 3500, 1) * .8
    out[:len(grip)] += panst(grip, (pa + pb) / 2)
    i = ns(dur); m = n - i; tl = tt(m)
    land = (np.sin(2 * np.pi * 140 * tl) * np.exp(-tl / .03) * .5 + dsp.lp(nz(m, seed + 4), 700) * np.exp(-tl / .015) * .6)
    out[i:] += panst(land * (.6 if fast else .8), (pa + pb) / 2)
    return out

def sfx_stamp(seed=41):
    """« TU VAS PERDRE. »: rubber stamp + table thud + paper slap"""
    s = tail_fade(I.stamp(seed) * 1.0); n = ns(.5); y = np.zeros(n); y[:len(s)] += s
    th = tail_fade(I.mf.thud_s(1.0, 150, 48, seed)); y[:len(th)] += th * .8
    sl = bp(nz(ns(.03), seed + 1), 3200, .9) * ex(ns(.03), .006) * .7; y[:len(sl)] += sl
    return y * np.minimum(1, tt(n) / .0005)

def sfx_ting(seed=51):
    """the gold ring's glint: bright FM bell on E7 with a long, slowly beating tail (the diversion)"""
    n = ns(1.8); t = tt(n); f = 2637.0
    mod = 1.7 * np.exp(-t / .07) * np.sin(2 * np.pi * f * 1.41 * t)
    core = (np.sin(2 * np.pi * f * t + mod) * np.exp(-t / .6) + .40 * np.sin(2 * np.pi * f * 2.76 * t + 1) * np.exp(-t / .22)
            + .22 * np.sin(2 * np.pi * 3951.1 * t + 2) * np.exp(-t / .45)) * (1 - np.exp(-t / .0007))
    out = np.stack([core, core], 1)
    for ch, det in enumerate((1.0021, .9981)):                                      # slow shimmer, never a mono null
        out[:, ch] += .22 * np.sin(2 * np.pi * f * det * t + 3 * ch) * np.exp(-t / .8) * (1 - np.exp(-t / .004))
    gl = dsp.hp(nz(ns(.012), seed), 7000) * np.linspace(1, 0, ns(.012)) * .5
    out[:len(gl)] += gl[:, None]
    return out * .5

def sfx_tok(f0=330.0, seed=61, low=False):
    """a container lifted off the cloth: hollow cavity pop (pitch opens upward) + steel shell modes + glove click"""
    n = ns(1.0); t = tt(n); tau = .12 if low else .08
    fp = f0 * (.74 + .26 * (1 - np.exp(-t / .014)))
    pop = np.sin(2 * np.pi * np.cumsum(fp) / SR) * np.exp(-t / tau)
    shell = sum(a * np.sin(2 * np.pi * f0 * 1.9 * r * t + i) * np.exp(-t / (d * (1.4 if low else 1))) for i, (r, a, d) in
                enumerate(((1, .30, .16), (1.52, .2, .11), (2.31, .12, .08), (3.07, .07, .05), (4.2, .04, .035))))
    c = bp(nz(ns(.003), seed), 2600, 1.2) * np.linspace(1, 0, ns(.003)) * .4
    sub = np.sin(2 * np.pi * f0 * .5 * t) * np.exp(-t / (tau * 1.3)) * (.35 if low else .2)
    y = pop + shell + sub; y[:len(c)] += c
    return y * np.minimum(1, t / .0006) * (1.15 if low else 1.0)

def sfx_setdown(seed=0):
    """a lifted container put back on the cloth (derived from SCORE.REVEAL, not a listed cue): soft muffled tk"""
    n = ns(.2); t = tt(n)
    y = np.sin(2 * np.pi * 150 * t) * np.exp(-t / .03) * .6 + dsp.lp(nz(n, seed), 800) * np.exp(-t / .012) * .7
    y += .08 * np.sin(2 * np.pi * 612 * t) * np.exp(-t / .05)
    return y * np.minimum(1, t / .0008)

def sfx_cricket(seed=71, chirps=3, period=1 / 3):
    """« cri-cri »: periodic chirps of 3 pulses on ~4.7 kHz (the awkward-silence gag)"""
    n = ns(chirps * period + .1); y = np.zeros(n)
    for c in range(chirps):
        for p in range(3):
            k = ns(.014); tl = tt(k); f = 4720 * (1 + .004 * p)
            pulse = np.sin(2 * np.pi * f * tl) * np.sin(np.pi * tl / .014) ** 1.2 * (1 + .3 * np.sin(2 * np.pi * 190 * tl))
            place(y, pulse * (.85 + .15 * (c % 2)) * (1 - .12 * p), ns(c * period + p * .03))
    return y * .7

def sfx_dust(seed=81):
    """the « …Vide. » dust puff: a soft breath of dust + fine particle hiss"""
    n = ns(.7); t = tt(n); env = np.minimum(1, t / .012) * np.exp(-t / .2)
    y = dsp.hp(dsp.lp(nz(n, seed), 1500), 140) * env
    y += dsp.lp(dsp.hp(nz(n, seed + 1) * grains(n, 500, seed + 2, .001, (.2, 1)), 3000), 7000) * env * .18
    return y / (np.abs(y).max() + 1e-9) * .5

def sfx_mock(seed=91):
    """the mocking 3-note descending guitar (B4 A4 F#4), last note longer and bent down — returns (sig, onset offsets)"""
    notes = ((71, .20, .55), (69, .20, .55), (66, .62, .35))
    out = np.zeros(ns(1.2))
    for k, (m, d, mute) in enumerate(notes):
        y = mk.guitar(m2f(m), d, bright=.62, decay=.993, seed=seed + k, mute=mute)
        if k == 2: y = bend(y, -70, .14, .5)
        place(out, y * (1.0 if k < 2 else 1.1), ns(k * E8))
    return out

def sfx_bulb_off(seed=101):
    """filament « tink » and a dull electrical drop as the bulb dies"""
    n = ns(.4); t = tt(n)
    y = .25 * np.sin(2 * np.pi * 3150 * t) * np.exp(-t / .03) + .12 * np.sin(2 * np.pi * 4870 * t) * np.exp(-t / .02)
    y += dsp.lp(nz(n, seed), 320) * np.exp(-t / .05) * .9
    c = dsp.hp(nz(ns(.003), seed + 1), 3000) * np.linspace(1, 0, ns(.003)) * .5; y[:len(c)] += c
    return y * np.minimum(1, t / .0005)

def _bell(f, dur, tau, seed=0, soft=.003):
    n = ns(dur); t = tt(n)
    y = sum(a * np.sin(2 * np.pi * f * r * t + seed + i) * np.exp(-t / (tau / r ** .5)) for i, (r, a) in
            enumerate(((1, 1), (2.32, .28), (4.07, .12), (6.8, .04))))
    return y * np.minimum(1, t / soft)

def sfx_shimmer(seed=111, dur=.75):
    """the containers turn to violet glass, left to right: a sweep of glassy grains on E major + airy glass swell"""
    out = np.zeros((ns(dur + 1.0), 2)); r = np.random.default_rng(seed)
    notes = [88, 90, 92, 95, 97, 100, 102]              # E6 F#6 G#6 B6 C#7 E7 F#7
    k = 22
    for j in range(k):
        t0 = 0 if j == 0 else (j / k) * dur + r.uniform(0, dur / k)
        b = _bell(m2f(notes[r.integers(len(notes))]), .9, .28, j, .002)
        place(out, panst(b, -.8 + 1.6 * t0 / dur) * (r.uniform(.4, .8) if j else .9) * (1 - .35 * j / k), ns(t0))
    n = ns(dur + .3); t = tt(n); u = np.clip(t / dur, 0, 1)
    air = dsp.tv_biquad(nz(n, seed + 1), 'bp', 3000 * 3 ** u, 2.0) * np.sin(np.pi * np.clip(t / (dur + .3), 0, 1)) ** 1.5
    out[:n] += panst(air * .25, -.8 + 1.6 * u)
    return out * .55

def sfx_ding(k, seed=121):
    """step k (0,1,2) lights up: soft inharmonic ding, B5 / E6 / G#6, panned at its container (L, C, R)"""
    f = [987.77, 1318.51, 1661.22][k]
    y = _bell(f, 1.6, .75, seed + k, .004) + .25 * np.sin(2 * np.pi * f / 2 * tt(ns(1.6))) * ex(ns(1.6), .35)
    return panst(y * .5, [-.45, 0, .45][k])

def sfx_bulb_on(seed=131, g=1.0):
    """the bulb arcs back: a mains-rate buzz burst with a click"""
    n = ns(.16); t = tt(n)
    buzz = np.sign(np.sin(2 * np.pi * 100 * t)) * bp(nz(n, seed), 2200, .8) * .6
    buzz = (buzz + bp(nz(n, seed + 1), 4500, 1.2) * .5) * np.exp(-t / .035)
    c = dsp.hp(nz(ns(.003), seed + 2), 2500) * np.linspace(1, 0, ns(.003)) * .8; buzz[:len(c)] += c
    return buzz * np.minimum(1, t / .0005) * g

def sfx_whoosh(seed=141, dur=.3):
    """the right glove dives into its own sleeve: short cloth whoosh with a flap at the start"""
    n = ns(dur); t = tt(n)
    w = I.whoosh(dur, seed, 350, 2800); env = np.minimum(1, t / .02) * np.clip(1 - t / dur, 0, 1) ** .8
    w = w / (np.abs(w).max() + 1e-9) * env * .6
    c = sfx_cloth(seed + 1, .12, 3000, .002) * .6; w[:len(c)] += c
    return w

def hum_bed(on, crackle_seed=151):
    """the bulb, continuous and exactly periodic (16 s = 1600 cycles of 100 Hz): a singing filament (100 Hz family,
    audible on phones through its 300-700 Hz harmonics), slow sway wobble (2 s, the bulb's pendulum), gated by the
    score's light curve (off 12.1-14.0, flicker 14.0-14.4); plus a fixed-seed crackle (separate list of events)"""
    t = np.arange(NL) / SR
    y = sum(a * np.sin(2 * np.pi * 100 * h * t + .7 * h) for h, a in
            ((1, .45), (2, .30), (3, .24), (4, .14), (5, .11), (6, .07), (7, .05), (9, .025)))
    y += .12 * np.sin(2 * np.pi * 50 * t)
    y *= 1 + .07 * np.sin(2 * np.pi * t / 2.0)
    hiss = np.fft.rfft(nz(NL, crackle_seed)); f = np.fft.rfftfreq(NL, 1 / SR)
    hiss *= ((f > 2500) & (f < 9000)); hiss = np.fft.irfft(hiss, NL)            # circularly filtered = periodic
    hiss = hiss / hiss.std() * .010 * (1 + .6 * np.sin(2 * np.pi * 100 * t) ** 2)
    lift = 1 + .45 * np.clip((t - 8.0) / 3.5, 0, 1) * (t < 11.95)                # tension: it creeps forward in the silence
    return (y * .02 + hiss * .5) * on * lift

def crackles(on_frames, seed=161):
    """[(t, sig, gain)] fixed-seed filament crackles: ~4/s with the bulb on, denser in the silence and at the flickers"""
    r = np.random.default_rng(seed); ev = []; t = 0.0
    while t < LOOP_S:
        rate = 3.5 + (3.0 if 8.0 <= t < 11.9 else 0)
        t += r.exponential(1 / rate)
        if t >= LOOP_S: break
        f = int(t * 30) % 480
        if on_frames[f] < .5: continue
        k = r.integers(1, 6); n = ns(.03); y = np.zeros(n)
        for j in range(k):
            c = bp(nz(ns(.0025), int(r.integers(1e9))), r.uniform(2500, 6500), 1.2) * np.linspace(1, 0, ns(.0025))
            place(y, c * r.uniform(.3, 1), ns(r.uniform(0, .02)))
        ev.append((t, y, r.uniform(.012, .05)))
    for t in (14.033, 14.067, 14.167, 14.2):                                     # the relight sizzles (flicker frames)
        y = bp(nz(ns(.02), int(t * 1000)), 4000, .9) * ex(ns(.02), .004); ev.append((t, y, .06))
    return ev

# =====================================================================================================================
# the arrangement (events in cycle time)
# =====================================================================================================================
class Score:
    """events: (stem, signal, t mod 16, gain, pan, cut). `cut` events die with the 8.0 s total cut (reverbs included)."""
    MUSIC = ('gtr', 'bal', 'perc', 'bass', 'keys')
    def __init__(self): self.ev = []; self.marks = []
    BRAND_TRIM = 10 ** (-5.5 / 20)
    def put(self, stem, sig, t, g=1.0, pan=0.0, cut=None):
        t = t % LOOP_S
        if stem in self.MUSIC and 11.99 <= t < 13.99: g *= self.BRAND_TRIM          # the brand bar sits under the groove
        if stem == 'perc' and 3.4 <= t < CUT_T: g *= PERC_G                            # groove drums sit under the guitars
        if cut is None: cut = (3.0 - 1e-6 <= t < CUT_T) and stem != 'hum'
        sig = np.array(sig, float)
        if stem != 'hum' or len(sig) < NL: sig = tail_fade(sig)
        self.ev.append((stem, sig, t, g, pan, bool(cut)))

TONES = {'Em': [52, 59, 64, 67], 'D': [50, 57, 62, 66], 'C': [48, 55, 60, 64], 'B': [47, 54, 59, 63],
         'E': [52, 59, 64, 68], 'A': [57, 61, 64, 69], 'Bm': [59, 63, 66, 71]}
ROOT = {'Em': 40, 'D': 38, 'C': 36, 'B': 35, 'E': 40, 'A': 45, 'Bm': 47}
OST = [0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 3]
ACC = [1, 0, 0, .7, 0, .3, 1, 0, .3, .7, 0, .3]
NIGHT_UP = [64, 64, 59, 64, 64, 59, 62, 62, 59, 62, 67, 66]
NIGHT_ACC = [1, .45, .7, .9, .45, .7, 1, .45, .7, .9, .6, .75]
GTR_L, GTR_R, BAL_G, PERC_G = 3.2, 2.4, 1.5, .5      # groove balance: the guitar leads, the drums push
def groove_chord(t): return 'Em' if t < 5.0 else 'D' if t < 6.0 else 'C' if t < 7.0 else 'B'
def section(t): return 'A' if t < 5.5 else 'B' if t < 7.0 else 'S' if t < 7.333 else 'C'

def night_bar(S, t0, bar_id, skip=(), thok_hit=False, bright=0.0):
    """the « nuit » ostinato: muted repeated notes (E4 E4 B3 …), thumb E3 / D3 on beats 1 and 3, sparse rattles"""
    for k in range(12):
        tk = t0 + k * E8
        if k not in skip:
            a = NIGHT_ACC[k]
            S.put('gtr', gtr(NIGHT_UP[k], 700 + bar_id * 12 + k, .40 + .22 * a + bright), tk, (.20 + .13 * a), -.15)
        if k in (0, 6):
            m = 52 if k == 0 else 50
            if k == 0 and thok_hit: S.put('gtr', gtr(m, 800 + bar_id, .5, .22), t0 + 4 / 30, .36, 0)
            elif k not in skip: S.put('gtr', gtr(m, 800 + bar_id + k, .42, .2), tk, .30, 0)
        if k in (2, 5, 8, 11) and k not in skip: S.put('perc', rattle(900 + bar_id * 12 + k, .05, .7, .8), tk, .38, .35)
        if k in (0, 6) and k not in skip: S.put('perc', rattle(950 + bar_id * 12 + k, .035, .4, .6), tk, .18, .35)

def compose():
    S = Score(); sc = score()
    # ---------------- music ----------------------------------------------------------------------------------
    night_bar(S, 0.0, 0, skip=(0, 1), thok_hit=True)            # bar 1: the THOK takes the downbeat
    night_bar(S, 14.0, 7)                                         # bar 8: identical figure, so the seam is musical too
    # bar 2: count 3 · 2 · (stamp) — ostinato brightening, wood taps on the beat, a rattle roll that climbs into 3.0
    for k in range(6):
        a = NIGHT_ACC[k]
        S.put('gtr', gtr(NIGHT_UP[k], 1000 + k, .48 + .22 * a + .05 * k / 6), 2.0 + k * E8, .21 + .14 * a, -.15)
        if k == 0: S.put('gtr', gtr(52, 1010, .45, .2), 2.0, .30, 0)
    S.put('perc', wood(760, 1020), 2.0, .55, -.2); S.put('perc', wood(900, 1021), 2.5, .6, -.2)
    S.put('perc', rattle_roll(1.0, 1030), 2.0, .55, .3, cut=False)
    for m, tk in ((71, 3.0 + 10 * E8), (74, 3.0 + 10.5 * E8)):                 # balafon pickup into the groove
        S.put('bal', balafon(m, 1040 + m), tk, .26, -.4)
    # 3.5-8.0: the groove, density not tempo
    for j in range(21, 48):
        tk = j * E8; k = j % 12; ch = groove_chord(tk); tn = TONES[ch]; sec = section(tk); kb = j % 3
        hf = (j % 6)                                           # position in the half bar (1 chord per second)
        # rhythm guitar: the night figure on the chord tones (all eighths, muted, low)
        S.put('gtr', gtr(tn[[2, 2, 1, 2, 2, 1][hf]], 1100 + j, .45 + .2 * (kb == 0)), tk, (.13 + .07 * (kb == 0)) * GTR_R, -.2)
        # lead guitar: the bikutsi picking (series OST/ACC), tremolo in C
        if sec != 'C':
            m = tn[OST[k] % 4] + 12
            S.put('gtr', gtr(m, 1200 + j, .55 + .25 * ACC[k]), tk, (.15 + .10 * ACC[k]) * GTR_L, .35)
            if sec in ('B', 'S') and kb != 0:
                S.put('gtr', gtr(tn[(OST[k] + 2) % 4] + 24, 1300 + j, .6, .12), tk, .09 * GTR_L, -.35)
        else:
            for h in range(2):
                m = tn[3 - h] + 12
                S.put('gtr', gtr(m, 1350 + 2 * j + h, .7, .1), tk + h * E8 / 2, (.12 + .02 * h) * GTR_L, .35 if h == 0 else -.3)
        # balafon: answers (A), busier (B), tremolo climb (C)
        top, mid, low = tn[3] + 12, tn[2] + 12, tn[1] + 12
        if sec == 'A':
            note = {2: top, 4: mid}.get(hf) if (j // 6) % 2 == 0 else {1: low, 3: mid, 5: top}.get(hf)
            if note: S.put('bal', balafon(note, 1400 + j), tk, .24 * BAL_G, -.4)
        elif sec in ('B', 'S'):
            if hf != 1: S.put('bal', balafon([top, mid, low, mid, top, mid][hf], 1400 + j), tk, .21 * BAL_G, -.4)
        else:
            for h in range(2):
                S.put('bal', balafon([mid, top][h] + (12 if j >= 46 else 0), 1450 + 2 * j + h, .3), tk + h * E8 / 2, (.17 + .04 * (j - 44) / 4) * BAL_G, -.45)
        # rattles: 2 per beat (A) -> every triplet eighth (B) -> sixteenth-triplets (C); silent in the steal break
        if sec == 'A' and kb in (0, 2): S.put('perc', rattle(1500 + j, .05, 1.0, 1.0), tk, .30 if kb == 0 else .22, .35)
        if sec == 'B': S.put('perc', rattle(1500 + j, .045, 1.0, 1.1), tk, .30 if kb == 0 else .21, .35)
        if sec == 'C':
            for h in range(2): S.put('perc', rattle(1600 + 2 * j + h, .035, 1.0, 1.3), tk + h * E8 / 2, .30 if h == 0 else .2, .3 - .6 * h)
        # congas (B, C): the middle eighth of each beat
        if sec == 'B' and kb == 1: S.put('perc', conga(62 if (j // 3) % 2 else 57, 1700 + j, slap=(j // 3) % 2 == 1), tk, .45, -.3)
        if sec == 'C': S.put('perc', conga(64 if j % 2 else 59, 1700 + j, slap=True), tk + E8 / 2, .35, -.3)
    # kick / claps / bass
    for b in range(7, 16):                                      # beats 3.5 .. 7.5
        tb = b * BEAT; sec = section(tb)
        S.put('perc', kick(1.0, 1800 + b), tb, .85 if sec != 'S' else .75, 0)
        if sec == "C": continue
        if sec == 'B' and b % 2 == 1: S.put('perc', kick(.6, 1810 + b), tb + 2 * E8, .45, 0)     # the gallop
        if (sec == 'A' and b % 2 == 1) or sec == 'B': S.put('perc', clap(1820 + b), tb, .55, -.1)
    for j in (44, 45, 46, 47):                                  # C: a kick and a clap on every 5-frame swap
        S.put('perc', kick(1.0, 1830 + j), j * E8, .7, 0); S.put('perc', clap(1840 + j), j * E8, .5, -.1)
        S.put('perc', clap(1850 + j), j * E8 + E8 / 2, .22, .15)
    S.put('bass', bass(40, .3, .3), 3.5, .42)
    for t0, ch in ((4.0, 'Em'), (5.0, 'D'), (6.0, 'C')):
        r = ROOT[ch]
        for k, semi, d in ((0, 0, .34), (3, 12, .15), (5, 7, .15)):
            S.put('bass', bass(r + semi, d, .8 if semi == 12 else .3), t0 + k * E8, .42)
    for k in range(6):                                          # B7: a driving pedal, octave pops
        S.put('bass', bass(35 + (12 if k % 2 else 0), .15, .8 if k % 2 else .3), 7.0 + k * E8, .42)
    n = ns(.667); u = tt(n) / .667                              # riser through C, cut dead by the 8.0 gate
    rs = dsp.tv_biquad(nz(n, 1900), 'bp', 900 * 7 ** u, 2.0) * u ** 1.8
    S.put('perc', rs, 7.333, .5, 0)
    # (bar 6: the mock is a picture cue — see the SFX loop below)
    # ---------------- bar 7: brand moment, E major (the B7 left hanging at 8.0 resolves here) -------------------
    def chord_b(t): return 'E' if t < 13.0 else 'A' if t < 13.5 else 'Bm'
    for k in range(12):
        tk = 12.0 + k * E8; tn = TONES[chord_b(tk)]
        S.put('gtr', gtr(tn[OST[k] % 4] + 12, 2000 + k, .62 + .2 * ACC[k], .18, .6), tk, (.12 + .07 * ACC[k]) * 2.6, .3)
        S.put('perc', rattle(2100 + k, .04, .8, 1.3), tk, .17 if k % 3 == 0 else .11, .3)
    for b in range(4): S.put('perc', kick(.7, 2200 + b), 12.0 + b * BEAT, .55 if b % 2 == 0 else .4, 0)
    BAL7 = {0: (76, 83), 1: (80,), 3: (80,), 4: (76,), 6: (81, 85), 7: (88,), 9: (83, 87), 10: (85,), 11: (83,)}   # rests before each ding
    for k, ms in BAL7.items():
        for m in ms: S.put('bal', balafon_bright(m, 2300 + k * 3 + m), 12.0 + k * E8, .30 / len(ms) ** .3, -.35 + .1 * (m % 3))
    for t0, ch, d in ((12.0, 'E', 1.0), (13.0, 'A', .5), (13.5, 'Bm', .55)):
        S.put('keys', soft_pad([TONES[ch][1] + 12, TONES[ch][2] + 12, TONES[ch][3] + 12], d + .35), t0, .55 if t0 == 12 else .45, 0)
    for tk, m, d in ((12.0, 40, .45), (12.5, 52, .2), (12.833, 47, .15), (13.0, 45, .45), (13.5, 47, .15), (13.667, 45, .15), (13.833, 42, .15)):
        S.put('bass', bass(m, d, .4), tk, .42)
    S.put('bass', bass(40, .7, .3), 14.0, .40); S.put('bass', tail_fade(I.bass_sub(40, .7), 200), 14.0, .22)   # home: E, then night
    # ---------------- SFX from the picture score ---------------------------------------------------------------
    sw = {s[0]: s for s in sc['swaps']}; rev = {r[0] + 2: r for r in sc['reveal']}
    ting_rms = None
    for c in sc['cues']:
        t, name, g, f = c['f'] / 30.0, c['name'], c['g'], c['f']
        if name == 'thok':
            S.put('sfx', sfx_thok(), t, 1.15); S.put('sfx', sfx_rise(), t - .17, .4, .25)
            S.put('sfx', sfx_cloth(5, .14, 2200, .003), t - .17, .22, .3)                          # out of the sleeve
        elif name == 'cloth': S.put('sfx', sfx_cloth(f, .32, 2400), t, .55 * g, .15)
        elif name == 'clac': S.put('sfx', sfx_clac(f), t, .85, 0)
        elif name == 'tap': S.put('sfx', sfx_tap(f), t, .5 * g, .08)
        elif name == 'stamp': S.put('sfx', sfx_stamp(f), t, .95, 0)
        elif name in ('slide', 'slide_fast'):
            s0, d, a, b = sw.get(f, (f, 10, 0, 2))
            S.put('sfx', sfx_slide(d / 30, 3000 + f, xpan(SLOT_X[a]), xpan(SLOT_X[b]), name == 'slide_fast'), t, .5 * g)
        elif name == 'ting':
            tg = sfx_ting(); S.put('bell', tg, t, .42, cut=True); ting_rms = np.sqrt(np.mean((tg[:ns(.3)] * .42) ** 2))
        elif name == 'rustle':
            rs_ = sfx_cloth(f, .22, 3200, .004); rr = np.sqrt(np.sum(rs_ ** 2) / ns(.3) / 2)            # same 300-ms window; panned mono -> 1/2 power
            gain = (ting_rms or .05) * 10 ** (-24 / 20) / (rr + 1e-12)                                # -24 dB under the TING
            S.put('sfx', rs_, t, gain, .35, cut=True); S.marks.append(('rustle_gain_db', 20 * math.log10(gain)))
        elif name in ('tok', 'tok_low'):
            r0, slot = rev.get(f, (f - 2, 1))[:2]
            low = name == 'tok_low'
            S.put('sfx', sfx_tok(246.94 if low else 329.63, f, low), t, .42 if not low else .5, xpan(SLOT_X[slot]) * .8)
        elif name == 'cricket': S.put('amb', sfx_cricket(), t, .3 * g / .5, -.6)
        elif name == 'dust': S.put('sfx', sfx_dust(f), t, .45 * g / .7, 0)
        elif name == 'mock': S.put('gtr', sfx_mock(), t, .38, .25)
        elif name == 'bulb_off': S.put('sfx', sfx_bulb_off(), t, .4, 0)
        elif name == 'shimmer': S.put('bell', sfx_shimmer(), t, .14)
        elif name == 'ding':
            k = sum(1 for cc in sc['cues'] if cc['name'] == 'ding' and cc['f'] < f)
            S.put('bell', sfx_ding(min(k, 2)), t, .30)
        elif name == 'bulb_on': S.put('sfx', sfx_bulb_on(f, g), t, .42, 0)
        elif name == 'whoosh': S.put('sfx', sfx_whoosh(), t, .7 * g, .35)
    for r0, slot, _, up in sc['reveal']:                         # derived from the lifts: each lifted box is set back down
        S.put('sfx', sfx_setdown(r0 + slot), (r0 + up + 13) / 30.0, .16, xpan(SLOT_X[slot]) * .8)
    # ---------------- the bulb ---------------------------------------------------------------------------------
    on_f = [l[0] for l in sc['light']]
    on = periodic_curve(on_f, smooth_ms=6)
    S.put('hum', np.stack([hum_bed(on)] * 2, 1) * [1.0, .96], 0.0, 1.0, cut=False)
    for t, y, gk in crackles(on_f): S.put('hum', y, t, gk * 2.2, .1, cut=False)
    return S

# =====================================================================================================================
# render
# =====================================================================================================================
SEND = {'gtr': .10, 'bal': .16, 'perc': .06, 'bass': 0.0, 'keys': .22, 'sfx': .07, 'bell': .30, 'amb': .25, 'hum': 0.0}

def gate_cut():
    """1 before 8.0 (raised-cosine 4 ms fade ending exactly at 8.000), 0 until 14.0, 1 after (periodic)"""
    g = np.ones(NL); a, b = ns(CUT_T - .004), ns(CUT_T)
    g[a:b] = np.cos(np.linspace(0, np.pi / 2, b - a)) ** 2; g[b:ns(14.0)] = 0
    return g

def duck_ting(t0=7.0):
    g = np.ones(NL); t = tt(NL); depth = 1 - 10 ** (-3.5 / 20)
    sh = np.clip((t - t0 + .005) / .01, 0, 1) * np.clip(1 - (t - t0 - .15) / .3, 0, 1)
    return 1 - depth * sh

_IR = {}
def render(S, ncyc, tail=TAIL, fx=True):
    """events -> {(stem, cut): stereo} for cycles 0..ncyc-1 + tail, with the stem's reverb send and the periodic
    gates applied (all linear, so W = wrap(1 cycle) and M = middle of 3 cycles must agree to rounding)"""
    N = ns(LOOP_S * ncyc + tail); raw = {}
    for stem, sig, t, g, p, cut in S.ev:
        key = (stem, cut)
        if key not in raw: raw[key] = np.zeros((N, 2))
        st = sig * g if sig.ndim == 2 else panst(sig * g, p)
        for k in range(ncyc): place(raw[key], st, ns(t + LOOP_S * k))
    if not _IR:
        _IR['room'] = dsp.make_ir(1.1, 1.0, .8, .35, predelay=.012, seed=3)
        _IR['plate'] = dsp.make_ir(1.9, 1.6, 1.5, .9, predelay=.02, seed=5, bright=1.2)
    ir_room, ir_plate = _IR['room'], _IR['plate']
    gc = np.tile(gate_cut(), ncyc + 1)[:N]; dk = np.tile(duck_ting(), ncyc + 1)[:N]
    out = {}
    for (stem, cut), x in raw.items():
        w = SEND.get(stem, 0)
        if w > 0 and fx: x = x + dsp.reverb(x, ir_plate if stem in ('bell', 'keys') else ir_room, wet=w)
        if cut:
            if stem in Score.MUSIC: x = x * dk[:, None]
            x = x * gc[:, None]
        out[(stem, cut)] = x
    return out

def bus(st):
    """pointwise (memoryless) stem processing, applied AFTER the fold so periodicity is untouched:
    the drum bus is soft-clipped (kick peaks -4 dB, their odd harmonics make the kick audible on phones)"""
    out = dict(st)
    if 'perc' in out: c = .5; out['perc'] = c * np.tanh(out['perc'] / c)
    return out

def sclip(x, c): return c * np.tanh(x / c)

def mixbus(st):
    """stems -> premaster. Pointwise soft clippers (applied after the fold, periodicity untouched) take the
    transient peaks so the master limiter only polishes: music bus c=.7, one-shot SFX bus c=.5 (the THOK, CLAC
    and STAMP transients are clipped, their bodies are not ducked by limiter release)"""
    music = sum(st[k] for k in Score.MUSIC if k in st)
    fx = sum(st[k] for k in ('sfx', 'bell') if k in st)
    rest = sum(st[k] for k in ('amb', 'hum') if k in st)
    return sclip(music, .7) + sclip(fx, .5) + rest

def stems_to(out, combine=True):
    """merge the cut / uncut halves of each stem"""
    d = {}
    for (stem, cut), x in out.items(): d[stem] = d.get(stem, 0) + x
    return d

def master(P, gain_db=None, target=-14.0, ceiling=-1.25):
    """P: exactly periodic premaster (NL, 2). Bus HP + glue + makeup + true-peak limiter on P tiled x3, keep the middle."""
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    T3 = np.tile(P, (3, 1))
    T3 = dsp.butter(T3, 'hp', 28, 2)
    T3 = dsp.compressor(T3, thr_db=-20, ratio=1.7, att=.008, rel=.16, knee_db=8)
    g = gain_db if gain_db is not None else target - meter.integrated_loudness(T3[NL:2 * NL])
    for it in range(4):
        Y, _ = dsp.limiter(T3 * dsp.undb(g), ceiling_db=ceiling, lookahead=.003, release=.10)
        L = meter.integrated_loudness(Y[NL:2 * NL])
        if abs(L - target) < .03: break
        g += target - L
    return Y[NL:2 * NL].copy(), g

# =====================================================================================================================
# checks
# =====================================================================================================================
def true_peak_db(y, os_=8):
    import scipy.signal as sps
    T = np.tile(y, (3, 1)); up = sps.resample_poly(T, os_, 1, axis=0)
    a = np.abs(up[len(up) // 3:2 * len(up) // 3 + os_ * 2]).max()                # middle copy, seam on both sides
    return 20 * math.log10(a + 1e-12)

def onset_near(x, t, pre=.03, post=.06, ref=None):
    """onset of the event at ~t in signal x (mono): rise point of a 1-ms energy envelope above 30 % of the local max,
    searched from the last quiet point before the max (within [t-pre, t+post])"""
    m = x if x.ndim == 1 else x.mean(1)
    a, b = max(0, ns(t - pre)), min(len(m), ns(t + post))
    seg = m[a:b] ** 2; w = ns(.001); e = np.sqrt(np.convolve(seg, np.ones(w) / w, 'same'))
    if e.max() <= 0: return None
    pk = int(np.argmax(e)); thr = .3 * e[pk]; i = pk
    while i > 0 and e[i - 1] >= thr: i -= 1
    return (a + i) / SR

def onset_first(x, t, pre=.03, post=.3, frac=.1):
    """onset of an ISOLATED event near t: first time its 1-ms envelope exceeds `frac` of the event's max"""
    m = x if x.ndim == 1 else x.mean(1)
    a, b = max(0, ns(t - pre)), min(len(m), ns(t + post))
    w = ns(.001); e = np.sqrt(np.convolve(m[a:b] ** 2, np.ones(w) / w, 'same'))
    if e.max() <= 0: return None
    return (a + int(np.argmax(e >= frac * e.max()))) / SR

def flux_onset(x, t, win=.04):
    """spectral-flux onset (2.5 ms hop, 10 ms frames) nearest to t on the full mix"""
    import scipy.signal as sps
    m = x if x.ndim == 1 else x.mean(1)
    a, b = max(0, ns(t - win - .02)), min(len(m), ns(t + win + .02))
    seg = m[a:b]; hop = ns(.0025); nper = ns(.010)
    f, tt_, Z = sps.stft(seg, SR, nperseg=nper, noverlap=nper - hop, boundary=None, padded=False)
    mag = np.log1p(np.abs(Z) * 100); fl = np.maximum(0, np.diff(mag, axis=1)).sum(0)
    times = a / SR + tt_[1:]                                                         # frame centres
    sel = np.abs(times - t) <= win
    if not sel.any(): return None
    th = .35 * fl[sel].max()
    pk = [i for i in range(1, len(fl) - 1) if sel[i] and fl[i] >= th and fl[i] >= fl[i - 1] and fl[i] >= fl[i + 1]]
    if not pk: return None
    i = min(pk, key=lambda i: abs(times[i] - t)); return float(times[i])

def build(check=True, sheet=False, verbose=True, fast=False):
    sc = score(); S = compose()
    log = (lambda *a: print(*a, flush=True)) if verbose else (lambda *a: None)
    log(f'[A] score: {sc["src"]}; {len(sc["cues"])} cues; {len(S.ev)} events')
    # linear stage, two ways
    W = render(S, 1); Wst = bus({k: lw.wrap(v, NL) for k, v in stems_to(W).items()})
    PW = mixbus(Wst)
    rep = {}
    rep['fold_W_vs_M_maxabs'] = float('nan'); rep['vs_plain_4cycle_render_db'] = float('nan')
    if check and not fast:
        M = render(S, 3); PM = mixbus(bus({k: v[NL:2 * NL] for k, v in stems_to(M).items()}))
        rep['fold_W_vs_M_maxabs'] = float(np.abs(PW - PM).max()); rep['premaster_peak'] = float(np.abs(PW).max())
        log(f'[A] fold check: wrap(1 cycle) vs middle of 3 cycles  max|diff| = {rep["fold_W_vs_M_maxabs"]:.2e} (premaster peak {rep["premaster_peak"]:.3f})')
    Y, g = master(PW)
    os.makedirs(os.path.join(OUT_A, 'stems'), exist_ok=True)
    dsp.save(os.path.join(OUT_A, 'loop.wav'), Y, 'PCM_24')
    dsp.save(os.path.join(OUT_A, 'loop_x3.wav'), np.tile(Y, (3, 1)), 'PCM_24')
    order = ['gtr', 'bal', 'perc', 'bass', 'keys', 'sfx', 'bell', 'amb', 'hum']
    for k in order:
        if k in Wst: dsp.save(os.path.join(OUT_A, 'stems', f'{k}.wav'), Wst[k] * dsp.undb(g), 'FLOAT')
    rep['master_gain_db'] = g; rep['n_samples'] = len(Y); rep['marks'] = dict(S.marks)
    if not check: return rep
    import pyloudnorm as pyln
    import soundfile as sf
    Z, sr = sf.read(os.path.join(OUT_A, 'loop.wav')); Z3, _ = sf.read(os.path.join(OUT_A, 'loop_x3.wav'))
    meter = pyln.Meter(SR)
    rep.update(sr=sr, dur=len(Z) / sr, lufs=meter.integrated_loudness(Z), lufs_x3=meter.integrated_loudness(Z3),
               tp_dbtp=true_peak_db(Z), sample_peak_db=20 * math.log10(np.abs(Z).max()), dc=[float(Z[:, 0].mean()), float(Z[:, 1].mean())],
               clipped=int((np.abs(Z) >= .9999).sum()), seam_report_db=lw.seam_report(Z, SR))
    # seam numerics: step across the junction vs local sample-to-sample steps; HF burst at the seam vs around it
    j = len(Z); d_seam = np.abs(Z3[j] - Z3[j - 1]).max(); loc = np.abs(np.diff(Z3[j - ns(.01):j + ns(.01)], axis=0))
    hp = dsp.butter(Z3.mean(1), 'hp', 9000, 4); e = lambda a, b: np.sqrt(np.mean(hp[a:b] ** 2)) + 1e-12
    rep['seam_step'] = float(d_seam); rep['local_step_p50_p99'] = [float(np.percentile(loc, 50)), float(np.percentile(loc, 99))]
    rep['seam_hf_db_vs_neighbourhood'] = 20 * math.log10(e(j - ns(.002), j + ns(.002)) / e(j - ns(.1), j + ns(.1)))
    # ground truth: the master chain on 4 plain cycles (no wrap), middle cycle vs loop.wav
    if not fast:
        P4 = mixbus(bus(stems_to(render(S, 4))))
        T = dsp.butter(P4, 'hp', 28, 2); T = dsp.compressor(T, thr_db=-20, ratio=1.7, att=.008, rel=.16, knee_db=8)
        T, _ = dsp.limiter(T * dsp.undb(g), ceiling_db=-1.25, lookahead=.003, release=.10)
        rep['vs_plain_4cycle_render_db'] = 20 * math.log10(np.abs(T[2 * NL:3 * NL] - Y).max() + 1e-12)
    # per-bar / half-bar loudness
    rms = lambda a: 20 * math.log10(np.sqrt(np.mean(a ** 2)) + 1e-12)
    rep['bar_rms_db'] = [round(rms(Z[ns(2 * b):ns(2 * b + 2)]), 1) for b in range(8)]
    rep['half_rms_db'] = [round(rms(Z[ns(h):ns(h + 1)]), 1) for h in range(16)]
    # cue alignment: isolated (each cue event rendered alone through the same chain shape) + on the full mix
    rows = []
    for c in sc['cues']:
        t = c['f'] / 30.0; name = c['name']
        keep = ('gtr',) if name == 'mock' else ('sfx', 'bell', 'amb')
        only = Score(); only.ev = [e_ for e_ in S.ev if e_[0] in keep and abs(e_[2] - t) < 1e-6]
        src = lw.wrap(sum(stems_to(render(only, 1, fx=False)).values()), NL)
        o1 = onset_first(src, t); o2 = flux_onset(Z, t)
        rows.append(dict(f=c['f'], t=round(t, 4), name=name, stem_onset=None if o1 is None else round(o1, 4),
                         stem_err_ms=None if o1 is None else round((o1 - t) * 1000, 1),
                         mix_onset=None if o2 is None else round(o2, 4), mix_err_ms=None if o2 is None else round((o2 - t) * 1000, 1)))
    rep['cues'] = rows
    iso = lambda keep, t0: lw.wrap(sum(stems_to(render(type('S', (), {'ev': [e_ for e_ in S.ev if e_[0] in keep and abs(e_[2] - t0) < 1e-6]})(), 1, fx=False)).values()), NL)
    w = slice(ns(7.0), ns(7.3)); r_t = iso(('bell',), 7.0)[w]; r_r = iso(('sfx',), 211 / 30)[w]
    rep['rustle_vs_ting_db'] = 10 * math.log10(np.mean(r_r ** 2) / np.mean(r_t ** 2))
    rep['lr_corr_per_bar'] = [round(float(np.corrcoef(Z[ns(2 * b):ns(2 * b + 2), 0], Z[ns(2 * b):ns(2 * b + 2), 1])[0, 1]), 2) for b in range(8)]
    rep['cues_ok'] = all(r['stem_err_ms'] is not None and abs(r['stem_err_ms']) <= 10 for r in rows)
    log(f'[A] loop {rep["dur"]:.6f} s @ {sr} Hz · {rep["lufs"]:.2f} LUFS (x3 {rep["lufs_x3"]:.2f}) · TP {rep["tp_dbtp"]:.2f} dBTP · '
        f'sample peak {rep["sample_peak_db"]:.2f} dBFS · clipped {rep["clipped"]} · DC {rep["dc"][0]:+.1e}/{rep["dc"][1]:+.1e}')
    log(f'[A] seam: seam_report {rep["seam_report_db"]:+.2f} dB · step {rep["seam_step"]:.4f} vs local p50/p99 '
        f'{rep["local_step_p50_p99"][0]:.4f}/{rep["local_step_p50_p99"][1]:.4f} · HF at seam {rep["seam_hf_db_vs_neighbourhood"]:+.1f} dB · '
        f'vs plain 4-cycle render {rep["vs_plain_4cycle_render_db"]:.1f} dB')
    log('[A] bar RMS dBFS ' + ' | '.join(f'{v:6.1f}' for v in rep['bar_rms_db']))
    log('[A] cue table (stem onset = cue event alone in its stem; mix = spectral-flux onset in loop.wav)')
    for r in rows:
        log(f'    f{r["f"]:3d} {r["t"]:7.3f}s  {r["name"]:10s}  stem {r["stem_err_ms"]:+6.1f} ms   mix {r["mix_err_ms"] if r["mix_err_ms"] is not None else float("nan"):+6.1f} ms')
    log(f'[A] rustle vs ting (7.0-7.3 s, RMS): {rep["rustle_vs_ting_db"]:+.1f} dB · L/R correlation per bar {rep["lr_corr_per_bar"]}')
    if sheet: make_sheet(Z, Wst, g, rep, sc)
    return rep

def make_sheet(Z, Wst, g, rep, sc, path=None):
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import scipy.signal as sps
    path = path or os.path.join(X, 'out', 'chk_A_sheet.jpg')
    plt.rcParams.update({'font.size': 8, 'axes.facecolor': '#120d1e', 'figure.facecolor': '#0b0814', 'text.color': '#e8e2f4',
                         'axes.labelcolor': '#e8e2f4', 'xtick.color': '#b9b0cc', 'ytick.color': '#b9b0cc', 'axes.edgecolor': '#3a3050'})
    fig = plt.figure(figsize=(18, 22), dpi=110)
    gs = fig.add_gridspec(6, 2, height_ratios=[3.2, 1.2, 1.4, 1.6, 1.3, 3.6], hspace=.42, wspace=.12)
    m = Z.mean(1); col = {'thok': '#ff5a5a', 'ting': '#ffd84a', 'stamp': '#ff8a3a', 'clac': '#ff8a3a', 'ding': '#b48cff', 'shimmer': '#b48cff'}
    ax = fig.add_subplot(gs[0, :])
    f, t, S_ = sps.stft(m, SR, nperseg=4096, noverlap=4096 - 240)
    P = 20 * np.log10(np.abs(S_) + 1e-9); fl = np.geomspace(30, 18000, 420); rows = np.interp(fl, f, np.arange(len(f)))
    Pi = P[np.round(rows).astype(int)]; top = np.percentile(Pi, 99.8)
    ax.pcolormesh(t, fl, Pi, vmin=top - 85, vmax=top, cmap='magma', shading='auto'); ax.set_yscale('log'); ax.set_ylim(30, 18000)
    ax.set_xlim(0, 16); ax.set_ylabel('Hz'); ax.set_title('loop.wav — log spectrogram, bars (white), the 8.0 cut (cyan), cues (ticks)', loc='left')
    for b in range(9): ax.axvline(2 * b, color='w', lw=.6, alpha=.6)
    ax.axvline(8.0, color='#3ee0ff', lw=1.4)
    for c in sc['cues']:
        tc = c['f'] / 30; ax.axvline(tc, ymin=.93, ymax=1, color=col.get(c['name'], '#9fe08a'), lw=1.2)
        ax.text(tc, 19500, c['name'], rotation=90, fontsize=6.5, va='bottom', ha='center', color=col.get(c['name'], '#9fe08a'))
    for r0, slot, _, up in sc['reveal']:
        tc = (r0 + up + 13) / 30; ax.axvline(tc, ymin=.95, ymax=1, color='#888', lw=1, ls=':')
    for b, lab in enumerate(['1 nuit + THOK', '2 count · stamp', '3 groove A', '4 B · steal · C', '5 CUT · toks', '6 cricket · mock', '7 brand MAJOR', '8 nuit']):
        ax.text(2 * b + .05, 34, lab, fontsize=8, color='w', alpha=.85)
    ax = fig.add_subplot(gs[1, :]); tw = np.arange(len(m)) / SR
    ax.plot(tw, Z[:, 0], lw=.25, color='#c9b6ff'); ax.plot(tw, -np.abs(Z[:, 1]), lw=.25, color='#ffb24a', alpha=.6)
    ax.set_xlim(0, 16); ax.set_ylim(-1, 1); ax.axhline(10 ** (-1 / 20), color='r', lw=.5, ls='--'); ax.set_title('waveform (L up / |R| down), -1 dBFS line', loc='left')
    for b in range(9): ax.axvline(2 * b, color='w', lw=.5, alpha=.4)
    ax = fig.add_subplot(gs[2, :]); tm, lm = dsp.lufs_momentary(np.tile(Z, (2, 1)), .02); sel = (tm >= 16) & (tm < 32)
    ax.plot(tm[sel] - 16, lm[sel], color='#ffd84a', lw=1, label='momentary LUFS (400 ms)')
    ts, ls = dsp.lufs_shortterm(np.tile(Z, (3, 1)), .05); sel = (ts >= 16) & (ts < 32)
    ax.plot(ts[sel] - 16, ls[sel], color='#3ee0ff', lw=1, label='short-term LUFS (3 s)')
    hr = rep['half_rms_db']; ax.bar(np.arange(16) + .5, np.array(hr) + 60, bottom=-60, width=.9, color='#7a5cff', alpha=.35, label='RMS per half bar (dBFS)')
    ax.set_xlim(0, 16); ax.set_ylim(-60, -2); ax.axhline(-14, color='w', lw=.5, ls=':'); ax.legend(loc='lower left', fontsize=7, facecolor='#120d1e')
    ax.set_title(f'loudness — integrated {rep["lufs"]:.2f} LUFS, TP {rep["tp_dbtp"]:.2f} dBTP, bar RMS {rep["bar_rms_db"]}', loc='left')
    for b in range(9): ax.axvline(2 * b, color='w', lw=.5, alpha=.4)
    # stems
    ax = fig.add_subplot(gs[3, :]); cols = {'gtr': '#ffb24a', 'bal': '#ff7a3a', 'perc': '#9fe08a', 'bass': '#3ee0ff', 'keys': '#b48cff',
                                             'sfx': '#ff5a5a', 'bell': '#ffd84a', 'amb': '#7fffd4', 'hum': '#aaaaaa'}
    for k, v in Wst.items():
        tl_, l_ = dsp.lufs_momentary(np.tile(v * dsp.undb(g), (2, 1)), .02); sel = (tl_ >= 16) & (tl_ < 32)
        ax.plot(tl_[sel] - 16, l_[sel], lw=.9, color=cols.get(k, 'w'), label=k)
    ax.set_xlim(0, 16); ax.set_ylim(-70, -5); ax.legend(ncol=9, fontsize=7, loc='upper right', facecolor='#120d1e'); ax.set_title('stems — momentary LUFS (post makeup gain, pre-limiter)', loc='left')
    for b in range(9): ax.axvline(2 * b, color='w', lw=.5, alpha=.4)
    # seam zoom + cut zoom
    Z3 = np.tile(Z, (3, 1)); j = len(Z)
    ax = fig.add_subplot(gs[4, 0]); w = ns(.04); xs = (np.arange(-w, w)) / SR * 1000
    ax.plot(xs, Z3[j - w:j + w, 0], lw=.7, color='#c9b6ff', label='L'); ax.plot(xs, Z3[j - w:j + w, 1], lw=.7, color='#ffb24a', label='R')
    ax.axvline(0, color='#3ee0ff', lw=1); ax.set_title(f'seam (16.000 -> 0.000) ±40 ms · step {rep["seam_step"]:.4f} vs local p99 {rep["local_step_p50_p99"][1]:.4f} · '
                                                      f'HF {rep["seam_hf_db_vs_neighbourhood"]:+.1f} dB · seam_report {rep["seam_report_db"]:+.2f} dB', loc='left', fontsize=7)
    ax.set_xlabel('ms around the seam'); ax.legend(fontsize=7, facecolor='#120d1e')
    ax = fig.add_subplot(gs[4, 1]); a = ns(7.7); b = ns(8.4); xs = np.arange(a, b) / SR
    ax.plot(xs, Z[a:b, 0], lw=.4, color='#c9b6ff'); ax.axvline(8.0, color='#3ee0ff', lw=1); ax.set_title('the TOTAL cut at 8.000 s (7.7–8.4 s)', loc='left')
    # cue table
    ax = fig.add_subplot(gs[5, :]); ax.axis('off')
    lines = [f'{"f":>4} {"cue t":>7}  {"name":10s} {"stem onset":>10} {"err":>7}   {"mix onset":>9} {"err":>7}']
    for r in rep['cues']:
        lines.append(f'{r["f"]:4d} {r["t"]:7.3f}  {r["name"]:10s} {r["stem_onset"]:10.4f} {r["stem_err_ms"]:+6.1f}ms   '
                     f'{(r["mix_onset"] or float("nan")):9.4f} {(r["mix_err_ms"] if r["mix_err_ms"] is not None else float("nan")):+6.1f}ms')
    half = (len(lines) + 1) // 2
    ax.text(0, 1, '\n'.join(lines[:half]), family='monospace', fontsize=8.2, va='top')
    ax.text(.5, 1, '\n'.join([lines[0]] + lines[half:]), family='monospace', fontsize=8.2, va='top')
    ax.text(0, -.02, f'fold check wrap(1 cycle) vs middle of 3 cycles: {rep["fold_W_vs_M_maxabs"]:.1e} · vs plain 4-cycle master render: {rep["vs_plain_4cycle_render_db"]:.1f} dB · '
                     f'DC {rep["dc"][0]:+.1e}/{rep["dc"][1]:+.1e} · clipped samples {rep["clipped"]} · {rep["dur"]:.6f} s @ {rep["sr"]} Hz · cues within 10 ms: {rep["cues_ok"]}\n'
                     f'rustle vs TING (7.0-7.3 s RMS) {rep["rustle_vs_ting_db"]:+.1f} dB (masked by design: no mix onset) · L/R correlation per bar {rep["lr_corr_per_bar"]} · '
                     f'grey dotted ticks = set-downs derived from SCORE.REVEAL (not listed cues)',
            fontsize=8.5, va='top', color='#9fe08a' if rep['cues_ok'] else '#ff5a5a')
    fig.suptitle('Module A — « Le Bonneteau du Feyman » loop audio check', x=.01, ha='left', fontsize=14, color='w')
    fig.savefig(path, dpi=110, facecolor=fig.get_facecolor(), pil_kwargs={'quality': 88})
    plt.close(fig)
    print('[A] sheet ->', path)

if __name__ == '__main__':
    rep = build(check='--no-check' not in sys.argv, sheet='--sheet' in sys.argv, fast='--fast' in sys.argv)

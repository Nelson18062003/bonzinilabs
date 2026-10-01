"""« Le parcours de vos colis » — paper foley for the « Kraft & Fil » house style (48 kHz stereo, deterministic).

Every SFX is synthesised (no samples): dry, close, tactile paper / cardboard / tape / ink / thread sounds on a wooden
packing table, a touch of small-room air. Warm and playful, never sci-fi, never cartoon-loud.

Input  : the cue log of the animation code [{name, t0}] (render.mjs --dump-cues), default out/cues.json, fallback
         out/cues_prov.json, or the path given as argv[1]. Optional per-cue keys are honoured: `x` (px, 0..1080) -> pan.
Output : out/sfx.wav (stereo float, exactly the timeline duration), out/sfx_report.json (placements, drops, merges,
         music stops for lib/mix.py), and a palette table on stdout (name -> design, count, level, pan).

Rules (final_storyboard §1.10, §6):
- ≤ 2 SFX per 0.3 s: every gesture is an interval [first onset, last onset] (a `_xN` cue, or a run of the same name
  ≤ 0.2 s apart = one gesture); a 0.3 s window may touch at most 2 gestures. Lower-priority gestures are dropped
  (stamps > reveals > cardboard landings > slaps > folds/tears/flips > plucks/pins > whooshes > slides > markers > ticks).
  Beds (sea loop, truck idle, room tone, develop fizz) are not gestures.
- levels are set per design in LU relative to the stamp (each instance is loudness-normalised on its loudest 100 ms,
  K-weighted), ± 0.8 dB seeded jitter; stamps and the reveal hit are the most present, ticks and slides the quietest.
- foley under speech sits lower: -1.5 dB (cardboard landings -3 dB), stamps and the reveal excepted (mix.py adds
  its own -4 dB SFX duck under speech).
- no stacking on the music's big hits (out/music_hits.json): a cue that is not the same gesture (stamp, reveal,
  landing) and touches [hit − 0.05, hit + 0.15] is pulled down 3 dB (big) / 1.5 dB (soft, bed).
- `music_stop_beat` is a MUSIC instruction (no SFX): exported as out/sfx_report.json["music_stops"], read by mix.py.
- `paper_peel_off` ≤ 0.15 s before a `reveal_hit` is merged into the reveal (it becomes its lift-off pre-roll).
- unknown names fall back to their prefix family (paper_*, cardboard_*, whoosh_*, …) with a warning; suffixes
  `_light` / `_soft` / `_heavy` change weight and level, `_xN` = N hits spaced like the scene code spaces them.

usage: PYTHONDONTWRITEBYTECODE=1 nice -n 5 python3 lib/sfx.py [cues.json]   (then lib/mix.py)
"""
import os, sys, json, re, zlib
import numpy as np
import scipy.signal as sps

HERE = os.path.dirname(os.path.abspath(__file__))
X = os.path.dirname(HERE)
REEL = os.environ.get('BONZINI_REEL', '/home/user/bonzinilabs/media/bonzini-cargo-reel')
for _p in (os.path.join(REEL, 'explainer', 'lib', 'audio'), os.path.join(REEL, 'douane-partie-2', 'lib')):
    if _p not in sys.path: sys.path.insert(0, _p)
import dsp                                   # noqa: E402  (NB dsp.reverb returns the WET signal only)
from dsp import SR, ns, undb, add_at         # noqa: E402
import money_sfx as mf                       # noqa: E402  (snip, paper_flick)
import customs_sfx as cf                     # noqa: E402  (paper_rip, shutter)

OUT = os.path.join(X, 'out')
TL = json.load(open(os.path.join(X, 'data', 'timeline.json')))
DUR = float(TL['duration']); N = ns(DUR)
CHS = TL['chapters']
REF_LU = -20.0                                # loudest-100-ms loudness of a 0 dB design (stamp) before the final trim


# ============================================================================ small helpers
def tt(n): return np.arange(n) / SR
def nz(n, seed): return dsp.noise(n, seed)
def dexp(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def att(n, a): return np.minimum(1.0, np.arange(n) / max(1.0, a * SR))
def bp(x, lo, hi, o=2): return dsp.butter(x, 'bp', [lo, min(hi, SR * .45)], o)
def hpf(x, f, o=2): return dsp.butter(x, 'hp', f, o)
def lpf(x, f, o=2): return dsp.butter(x, 'lp', f, o)


def put(y, s, t, g=1.0):
    """mono add of s into y at t (s), clipped at the ends"""
    i = ns(t)
    if i < 0: s, i = s[-i:], 0
    m = min(len(s), len(y) - i)
    if m > 0: y[i:i + m] += g * s[:m]
    return y


def pad_to(x, n):
    return np.concatenate([x, np.zeros((n - len(x),) + x.shape[1:])]) if len(x) < n else x[:n]


def thump(n, f0, f1, tau_f, tau_a):
    """sine with an exponential pitch drop f0 -> f1 (starts at phase 0: no click)"""
    t = tt(n)
    f = f1 + (f0 - f1) * np.exp(-t / tau_f)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau_a)


def modes(n, freqs, taus, amps):
    """resonant body (table, carton): sum of damped sines struck at t = 0"""
    t = tt(n)
    return sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, tau, a in zip(freqs, taus, amps))


def crackle(dur, seed, rate0, rate1, lo=1500., hi=7000., d0=.0006, d1=.0025, jit=.6):
    """paper fibre crackle: Poisson micro-bursts (rate rate0 -> rate1 per s), each a decaying noise grain"""
    r = dsp.rng(seed)
    n = ns(dur)
    y = np.zeros(n + ns(.03))
    t = 0.0
    while True:
        rate = rate0 + (rate1 - rate0) * min(1.0, t / dur)
        t += r.exponential(1.0 / max(rate, 1e-3))
        if t >= dur: break
        d = r.uniform(d0, d1)
        m = max(8, ns(d * 5))
        g = r.standard_normal(m) * np.exp(-np.arange(m) / (d * SR)) * (1 - jit * r.random())
        put(y, g, t)
    return bp(y, lo, hi)[:n]


def friction(n, seed, lo, hi, grit=.6, grit_fc=40.):
    """surface friction (paper on paper, felt tip on paper): band noise with a slow random 'grit' AM"""
    base = bp(nz(n, seed), lo, hi)
    g = np.abs(lpf(nz(n, seed + 1), grit_fc))
    g /= (g.max() + 1e-9)
    return base * ((1 - grit) + 2 * grit * g)


def squeak(n, seed, f0, f1, rough=.35):
    """felt-tip / thread squeak: a gliding tone with a rough AM"""
    t = tt(n)
    u = t / max(t[-1], 1e-6)
    f = f0 + (f1 - f0) * u + 25 * np.sin(2 * np.pi * 23 * t + seed)
    am = 1 - rough + rough * np.abs(lpf(nz(n, seed + 7), 90)) * 3
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.clip(am, 0, 1.6)


def bell_env(n, a=.25):
    """smooth hump: rises over a*n samples, falls over the rest"""
    u = np.arange(n) / max(n - 1, 1)
    return np.where(u < a, np.sin(np.pi / 2 * u / a) ** 2, np.cos(np.pi / 2 * (u - a) / (1 - a)) ** 2)


def ks_pluck(f, dur, seed, g=.990, bright=2600.):
    """Karplus-Strong string (the violet cotton thread: dull, short) + a soft finger transient"""
    n = ns(dur)
    L = max(2, int(round(SR / f - .5)))
    exc = np.zeros(n)
    exc[:L] = lpf(nz(L, seed), bright) * np.hanning(L)
    a = np.zeros(L + 2); a[0] = 1.0; a[L] -= g * .5; a[L + 1] -= g * .5
    y = sps.lfilter([1.0], a, exc)
    y = lpf(y, 3200) * att(n, .002)
    y += bp(nz(n, seed + 1), 1200, 4500) * dexp(n, .002) * .12 * np.abs(y).max()
    return dsp.fade(y, .0005, .04)


def stereo_wide(sig_l, sig_r, w=.7):
    m, s = (sig_l + sig_r) / 2, (sig_l - sig_r) / 2 * w
    return np.stack([m + s, m - s], 1)


A_PENT = (57, 59, 61, 64, 66, 69, 71, 73, 76, 69)   # A-major pentatonic (the score is in A): one degree per chapter


# ============================================================================ the designs
# Each design: fn(c) -> mono | stereo | (signal, pre_roll_s). c: dict(seed, rng, var, t, ch, chi, k, run_i, run_n,
# pan, gap_next, nxt) — gap_next = time to the next impact cue (landing / slap) within 1 s, for whooshes and slides.
DESIGN = {}


def design(name, desc, prio, gain, send=.07, bed=False, spacing=.12):
    def deco(fn):
        DESIGN[name] = dict(fn=fn, desc=desc, prio=prio, gain=gain, send=send, bed=bed, spacing=spacing)
        return fn
    return deco


def _wt(c): return {'light': .62, 'soft': .5, 'heavy': 1.3}.get(c['var'], 1.0)


@design('stamp_thunk', 'rubber stamp on paper over the wooden table: 58 Hz thud + rubber smack + paper crack + table '
        'modes + ink-pad unstick; light in hook/brand, heavy (sub + things jumping on the table) in the recap',
        100, 0.0, send=.14)
def d_stamp(c):
    r, s, w = c['rng'], c['seed'], _wt(c)
    heavy = c['var'] == 'heavy'
    n = ns(.9)
    pre = .012
    press = lpf(nz(ns(pre), s), 900) * np.linspace(0, 1, ns(pre)) ** 3 * .12
    f = 1 + .05 * r.uniform(-1, 1)
    thud = dsp.softclip(thump(n, 170 * f, (48 if heavy else 58) * f, .022, .07 * (1.4 if heavy else w)) * 1.6, 1.2)
    smack = bp(nz(n, s + 1), 450 * f, 1500 * f) * dexp(n, .016) * .9
    crack = hpf(nz(n, s + 2), 2600) * dexp(n, .0025) * .45
    table = modes(n, np.array([92, 168, 247, 415, 640]) * f, [.1, .075, .055, .035, .022], [.5, .45, .3, .2, .12])
    y = thud * (1.0 if w >= 1 else .55) + smack + crack + table * min(w, 1.0) * .8
    put(y, crackle(.05, s + 3, 900, 1500, 1500, 5000) * .25, .11 + .02 * r.random())     # the stamp lifts off the ink
    if heavy:
        y += dsp.softclip(thump(n, 100, 48, .05, .15) * 1.1, 1.5)
        for k, dt in enumerate((.055, .09, .16)):                                      # things jump on the table
            m = ns(.03)
            put(y, bp(nz(m, s + 10 + k), 1500, 4200) * dexp(m, .004) * .18, dt + .01 * r.random())
    return np.concatenate([press, dsp.fade(y, .0003, .2)]), pre


@design('reveal_hit', 'PAPER -> REAL reveal on « voici »: the paper truck peels off the print (crackle + rising '
        'air, 0.28 s pre-roll; absorbs paper_peel_off) then a warm low boom (44 Hz) + big sheet flap + medium room',
        95, 0.0, send=.25)
def d_reveal(c):
    s = c['seed']
    pre = .28
    m = ns(pre)
    u = np.linspace(0, 1, m)
    lift = crackle(pre, s, 250, 1100, 1800, 7000) * u ** 1.5 * .35
    air = dsp.tv_biquad(nz(m, s + 1), 'bp', 400 + 1600 * u ** 2, .9) * u ** 2 * .5
    n = ns(1.4)
    boom = dsp.softclip(thump(n, 130, 52, .04, .2) * 2.0, 1.6)                   # driven: its 2nd harmonic reads on phones
    body = bp(nz(n, s + 2), 90, 420) * dexp(n, .09) * .6
    flap = bp(nz(n, s + 3), 300, 2200) * dexp(n, .035) * .55 * att(n, .002)
    crack = hpf(nz(n, s + 4), 2000) * dexp(n, .003) * .2
    tail = lpf(nz(n, s + 5), 1500) * dexp(n, .25) * att(n, .02) * .06
    y = np.concatenate([lift + air, boom + body + flap + crack + tail])
    return dsp.fade(y, .005, .3), pre


@design('cardboard_thud', 'the carton lands on the table: 62 Hz thump + hollow box modes (175/290/455 Hz) + '
        'cardboard crunch + air puffed out + paper flakes; heavier on the cold open, _light / _soft lighter and darker',
        85, -4.0, send=.1)
def d_thud(c):
    r, s, w = c['rng'], c['seed'], _wt(c)
    if c['t'] < .6 and not c['var']: w = 1.3                      # the cold-open landing (hook frame 0 -> 0.30)
    n = ns(.7)
    f = 1 + .06 * r.uniform(-1, 1)
    th = dsp.softclip(thump(n, 150 * f, 62 * f, .02, .075 * min(w, 1.2)) * 1.4, 1.1)
    box = modes(n, np.array([175, 290, 455, 700]) * f, [.07, .05, .035, .02], [.55, .4, .25, .12])
    crunch = bp(nz(n, s + 1), 600, 3200) * dexp(n, .014) * .45
    puff = lpf(nz(n, s + 2), 700) * dexp(n, .04) * att(n, .005) * .3
    y = th * w + box * min(1.0, w) + crunch * (.6 + .4 * w) + puff
    if w >= 1: put(y, crackle(.18, s + 3, 70, 15, 1500, 6000) * .5 * (w - .6), .02)
    if c['var'] == 'soft': y = lpf(y, 2200)
    return dsp.fade(y, .0003, .2)


@design('paper_slap', 'a sheet / torn strip slapped flat on the table: air puff, 0.35-5.5 kHz smack, crisp crack, '
        'paper flap, table knock (150/240/390 Hz); _light = brighter, less body', 80, -7.0)
def d_slap(c):
    r, s = c['rng'], c['seed']
    light = c['var'] in ('light', 'soft')
    f, d = 1 + .08 * r.uniform(-1, 1), 1 + .2 * r.uniform(-1, 1)
    pre = .008
    puff = lpf(nz(ns(pre), s), 1200) * np.linspace(0, 1, ns(pre)) ** 2 * .25
    n = ns(.35)
    imp = bp(nz(n, s + 1), 350 * f, 5500 * f) * dexp(n, .010 * d)
    crack = hpf(nz(n, s + 2), 2800) * dexp(n, .0025) * .5
    flap = bp(nz(n, s + 3), 700 * f, 1900 * f) * dexp(n, .03 * d) * .35 * att(n, .002)
    body = modes(n, np.array([150, 240, 390]) * f, [.05, .035, .022], [.5, .35, .2])
    y = imp + crack + flap + body * (.25 if light else .6)
    return np.concatenate([puff, dsp.fade(y, .0003, .1)]), pre


@design('sticker_slap', 'a sticker / post-it / label patted down: short bright pat + adhesive "tck" grab', 76, -10.0)
def d_sticker_slap(c):
    r, s = c['rng'], c['seed']
    n = ns(.2)
    f = 1 + .08 * r.uniform(-1, 1)
    y = bp(nz(n, s), 900 * f, 7000) * dexp(n, .006) + hpf(nz(n, s + 1), 3500) * dexp(n, .0015) * .6
    y += modes(n, np.array([210, 330]) * f, [.03, .02], [.25, .12])
    m = ns(.02)
    put(y, bp(nz(m, s + 2), 2500, 6000) * dexp(m, .001) * .3, .018 + .006 * r.random())
    return dsp.fade(y, .0003, .05)


@design('tape_press', 'violet tape pressed across the lid: short tape zip + thumb pat + rub', 74, -12.0)
def d_tape_press(c):
    s = c['seed']
    y = np.zeros(ns(.35))
    put(y, _tape_rip(.07, s, 260, 420) * .45, 0)
    m = ns(.12)
    put(y, bp(nz(m, s + 1), 400, 3500) * dexp(m, .008) * .8 + modes(m, [190, 320], [.03, .02], [.3, .15]), .06)
    put(y, friction(ns(.12), s + 2, 500, 2000, .5, 30) * bell_env(ns(.12), .3) * .25, .1)
    return dsp.fade(y, .0005, .05)


@design('thup', 'small goods / a carton hop and land: muted 120-260 Hz thup + cardboard tick, pitch varies per hop; '
        '_soft quieter and darker', 72, -14.0, spacing=.16)
def d_thup(c):
    r, s = c['rng'], c['seed']
    f = 1 + .14 * r.uniform(-1, 1)
    n = ns(.25)
    y = thump(n, 260 * f, 120 * f, .012, .045) * .9 + lpf(nz(n, s), 1800) * dexp(n, .012) * .35
    y += modes(n, [300 * f, 520 * f], [.03, .02], [.3, .15])
    if c['var'] == 'soft': y = lpf(y, 1800)
    return dsp.fade(y, .0003, .05)


@design('cardboard_bump', 'cartons nudge each other: small hollow knock (260/430/690 Hz)', 70, -14.0)
def d_bump(c):
    r, s = c['rng'], c['seed']
    f = 1 + .08 * r.uniform(-1, 1)
    n = ns(.22)
    y = thump(n, 200 * f, 110 * f, .012, .04) * .6 + modes(n, np.array([260, 430, 690]) * f, [.04, .03, .018], [.5, .3, .15])
    y += bp(nz(n, s), 900, 3500) * dexp(n, .006) * .3
    return dsp.fade(y, .0003, .04)


@design('confetti_paper', 'paper confetti burst from behind the carton: soft "pff" + a 1.1 s shower of tiny flicks '
        'and a few flutters, wide stereo', 70, -12.0, send=.12)
def d_confetti(c):
    r, s = c['rng'], c['seed']
    n = ns(1.5)
    L, R = np.zeros(n), np.zeros(n)
    m = ns(.12)
    pop = lpf(nz(m, s), 1200) * dexp(m, .02) * .6 + thump(m, 300, 150, .01, .03) * .3
    put(L, pop, 0); put(R, pop, 0)
    for k in range(48):
        t0 = .02 + r.exponential(.32)
        if t0 > 1.15: continue
        d = r.uniform(.0006, .003)
        g = bp(nz(ns(d * 6) + 16, s + 10 + k), 1800 + 3500 * r.random(), 9000) * np.exp(-np.arange(ns(d * 6) + 16) / (d * SR))
        g *= (1 - t0 / 1.3) * r.uniform(.25, .7)
        p = r.uniform(-.85, .85); a = (p + 1) * np.pi / 4
        put(L, g * np.cos(a), t0); put(R, g * np.sin(a), t0)
    for k in range(4):
        m = ns(.3)
        fl = bp(nz(m, s + 80 + k), 1200, 4000) * (.5 + .5 * np.sin(2 * np.pi * r.uniform(11, 17) * tt(m))) * bell_env(m) * .08
        p = r.uniform(-.7, .7); a = (p + 1) * np.pi / 4; t0 = .15 + .2 * k
        put(L, fl * np.cos(a), t0); put(R, fl * np.sin(a), t0)
    return dsp.fade(np.stack([L, R], 1), .0005, .1)


def _tape_rip(dur, s, f0=160., f1=540.):
    """packing tape pulled off the roll: stick-slip impulse train (its rate is the 'zzrrip' pitch) + adhesive hiss"""
    r = dsp.rng(s)
    n = ns(dur)
    u = np.linspace(0, 1, n)
    rate = (f0 + (f1 - f0) * u ** .7) * (1 + .08 * lpf(nz(n, s + 1), 30) * 8)
    ph = np.cumsum(rate / SR)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    imp = np.zeros(n)
    imp[idx] = r.uniform(.5, 1.0, len(idx)) * np.sign(r.standard_normal(len(idx)))
    y = bp(imp, 1200, 5500) * 2.5 + dsp.biquad(imp, 'peak', 2600, 3.0, 6.0) * .3
    y += bp(nz(n, s + 2), 2000, 7000) * .25
    y *= att(n, .015) * np.clip((dur - tt(n)) / .015, 0, 1)
    return y


@design('tape_rip', 'packing tape pulled across: stick-slip "zzrrip" rising 160 -> 540 Hz + adhesive hiss + end snap',
        68, -12.0)
def d_tape_rip(c):
    r, s = c['rng'], c['seed']
    dur = .3 * (1 + .12 * r.uniform(-1, 1))
    y = np.zeros(ns(dur + .1))
    put(y, _tape_rip(dur, s), 0)
    m = ns(.03)
    put(y, hpf(nz(m, s + 3), 3000) * dexp(m, .002) * .8, dur - .005)
    return dsp.fade(y, .001, .03)


@design('paper_tear', 'the map tears in two: fibre crackle (customs_sfx.paper_rip) + low fibrous rip, halves apart '
        'in stereo', 68, -12.0)
def d_tear(c):
    s = c['seed']
    dur = .45
    rip = cf.paper_rip(dur, s)
    n = len(rip)
    ev = lpf(np.abs(rip), 30); ev /= ev.max() + 1e-9
    fib = bp(nz(n, s + 1), 300, 1300) * ev * .5
    y = rip + fib
    L = y + .25 * crackle(dur, s + 2, 300, 600, 2000, 7000)[:n]
    R = y + .25 * crackle(dur, s + 3, 300, 600, 2000, 7000)[:n]
    return dsp.fade(stereo_wide(L, R, .8) * np.sqrt(.5), .002, .04)


@design('flap_fold', 'carton flaps fold (3 creases on twos): low air "fwmp" + crease click + small box knock', 66, -13.0)
def d_flap(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.45))
    for k in range(3):
        m = ns(.09)
        fw = lpf(nz(m, s + k), 700) * bell_env(m, .4) * .6
        cr = bp(nz(m, s + 10 + k), 1400, 4500) * dexp(m, .003) * .35
        kn = modes(m, [240 * (1 + .05 * k), 410], [.025, .015], [.25, .1])
        put(y, fw, .1 * k + .01 * r.random())
        put(y, cr + kn, .1 * k + .05 + .01 * r.random(), .8 + .2 * (k == 2))
    return dsp.fade(y, .002, .05)


@design('popup_fold', 'a pop-up (stall, warehouse) unfolds: 4 creases rising + a paper "pok" when it stands', 66, -12.0)
def d_popup(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.6))
    for k in range(4):
        m = ns(.06)
        put(y, bp(nz(m, s + k), 1100 + 350 * k, 3800 + 400 * k) * dexp(m, .004) * (.4 + .1 * k), .1 * k + .008 * r.random())
        put(y, lpf(nz(m, s + 20 + k), 600) * bell_env(m, .3) * .25, .1 * k)
    m = ns(.12)
    pok = thump(m, 380, 190, .01, .03) * .45 + bp(nz(m, s + 9), 600, 4000) * dexp(m, .006) * .5
    put(y, pok, .38)
    return dsp.fade(y, .001, .05)


@design('shutter_click', 'instant-camera shutter: double mechanical click (customs_sfx.shutter) + spring + body', 66, -13.0)
def d_shutter(c):
    s = c['seed']
    sh = cf.shutter(s)
    n = ns(.2)
    y = np.zeros(n)
    put(y, sh, 0)
    y += np.sin(2 * np.pi * 3100 * tt(n)) * dexp(n, .02) * .06 + thump(n, 260, 180, .01, .015) * .2
    return dsp.fade(y, .0003, .03)


@design('horn_toy', 'toy horn: the paper boat\'s single "pooot" (A3, reedy, scoop up) / the paper truck\'s double '
        'toot (E4, nasal) — soft, breathy, low-passed', 65, -13.0, send=.12)
def d_horn(c):
    r, s = c['rng'], c['seed']
    toot = c['run_n'] > 1                                         # two horns ≤ 0.2 s apart = the truck's beep-beep
    f0 = mtof_(64 if toot else 57)
    dur = .1 if toot else .42
    n = ns(dur + .08)
    t = tt(n)
    f = f0 * (1 - .06 * np.exp(-t / .03))
    x = dsp.pulse(f, n, .32) + .7 * dsp.pulse(f * 1.006, n, .3, .3)
    x = bp(x, 250, 2600) + dsp.biquad(x, 'peak', 1100 if toot else 700, 2.0, 5.0) * .5
    x += bp(nz(n, s), 800, 2400) * .05
    env = att(n, .025) * np.clip((dur - t) / .06, 0, 1) ** 1.2
    return dsp.fade(dsp.softclip(lpf(x * env, 2800) * .8, 1.1), .002, .04)


def mtof_(m): return float(dsp.mtof(m))


@design('card_flip', 'a card / ticket / post-it flips: quick air "fwip" + paper snap + soft settle', 64, -14.0)
def d_card_flip(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.3))
    m = ns(.11)
    u = np.linspace(0, 1, m)
    put(y, dsp.tv_biquad(nz(m, s), 'bp', 1200 + 3800 * u, 1.1) * bell_env(m, .6) * .5, 0)
    put(y, mf.paper_flick(s + 1) * .9, .095 + .01 * r.random())
    m = ns(.05)
    put(y, bp(nz(m, s + 2), 500, 3000) * dexp(m, .006) * .25, .15)
    return dsp.fade(y, .001, .03)


@design('card_deal', 'a photo print dealt onto the table: light flick, decelerating slide (0.3 s), landing pat', 63, -15.0)
def d_card_deal(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.45))
    m = ns(.03)
    put(y, bp(nz(m, s), 2000, 5500) * dexp(m, .004) * .4, 0)
    m = ns(.3)
    sl = friction(m, s + 1, 1300, 4500, .5, 40) * att(m, .01) * np.exp(-tt(m) / .12) * .45
    put(y, sl, .005)
    m = ns(.08)
    put(y, (bp(nz(m, s + 2), 500, 3200) * dexp(m, .007) + modes(m, [300, 520], [.02, .012], [.15, .08])) * .75,
        .3 + .02 * r.random())
    return dsp.fade(y, .001, .03)


@design('string_pluck', 'the violet thread plucked: dull Karplus-Strong cotton string, one A-major-pentatonic degree '
        'per chapter (the thread climbs with the journey; home A in the outro)', 62, -13.0, send=.1)
def d_pluck(c):
    r, s = c['rng'], c['seed']
    m = A_PENT[min(c['chi'], len(A_PENT) - 1)]
    if c['ch'] == 'outro' and c['k'] >= 1: m = 57                  # the last pull taut: low A, conclusive
    y = ks_pluck(mtof_(m) * (1 + .003 * r.uniform(-1, 1)), .7, s, .988)
    return y


@design('pop_soft', 'soft paper "pok" (a token pops up)', 60, -14.0)
def d_pop(c):
    s = c['seed']
    n = ns(.15)
    y = thump(n, 600, 280, .012, .035) * .8 + lpf(nz(n, s), 2000) * dexp(n, .006) * .25
    return dsp.fade(y, .0003, .03)


@design('paper_peel', 'a big sheet peeled off the table (T6 dive -> peel): fibre + adhesive crackle, rising, then '
        'the lifted sheet\'s air', 60, -14.0, send=.08)
def d_peel(c):
    s = c['seed']
    dur = .55
    n = ns(dur)
    u = np.linspace(0, 1, n)
    y = crackle(dur, s, 150, 750, 1200, 6500) * (.3 + .7 * u)
    y += friction(n, s + 1, 400, 1500, .7, 25) * u * .35
    m = ns(.25)
    tail = lpf(nz(m, s + 2), 1500) * bell_env(m, .2) * .25
    y = np.concatenate([y, np.zeros(ns(.2))])
    put(y, tail, dur - .05)
    return dsp.fade(y, .002, .05)


@design('paper_peel_off', 'short peel + lift of a cut-out (merged into reveal_hit when it leads it)', 60, -15.0)
def d_peel_off(c):
    s = c['seed']
    dur = .22
    n = ns(dur)
    u = np.linspace(0, 1, n)
    y = crackle(dur, s, 300, 1000, 1800, 7000) * u ** .8 + lpf(nz(n, s + 1), 1800) * u ** 2 * .2
    return dsp.fade(y, .002, .02)


@design('string_zip', 'the thread drops down the margin and zips into a bow: whizzing friction 0.9 -> 3.2 kHz + thin '
        'whistle + knot tick', 60, -15.0)
def d_zip(c):
    s = c['seed']
    dur = .6
    n = ns(dur)
    u = np.linspace(0, 1, n)
    fc = 900 + 2300 * np.sin(np.pi * np.clip(u * 1.2, 0, 1)) ** 1.5
    y = dsp.tv_biquad(nz(n, s), 'bp', fc, 3.0) * bell_env(n, .35)
    y += squeak(n, s + 1, 700, 1400, .5) * bell_env(n, .5) * .05
    y = np.concatenate([y, np.zeros(ns(.08))])
    m = ns(.03)
    put(y, bp(nz(m, s + 2), 1500, 5000) * dexp(m, .002) * .4, dur - .02)
    return dsp.fade(y, .003, .03)


@design('instant_eject', 'instant-camera eject: small geared motor buzz (95 Hz, 0.3 s) + the print sliding out',
        58, -16.0)
def d_eject(c):
    s = c['seed']
    dur = .3
    n = ns(dur)
    t = tt(n)
    f = 95 + 6 * np.sin(2 * np.pi * 9 * t)
    mot = dsp.pulse(f, n, .4) * (.75 + .25 * np.sign(np.sin(2 * np.pi * 38 * t)))
    mot = bp(mot, 250, 1800) * att(n, .02) * np.clip((dur - t) / .03, 0, 1) * .5
    y = np.concatenate([mot, np.zeros(ns(.1))])
    m = ns(.15)
    put(y, friction(m, s, 1500, 4000, .4, 40) * bell_env(m, .3) * .35, .14)
    for tk in (0, dur - .01):
        mm = ns(.015)
        put(y, bp(nz(mm, s + 3), 1800, 5000) * dexp(mm, .0015) * .35, tk)
    return dsp.fade(y, .001, .03)


@design('sticker_peel', 'a sticker lifts off: dense adhesive crackle accelerating, release tick', 58, -16.0)
def d_sticker_peel(c):
    s = c['seed']
    dur = .25
    n = ns(dur)
    u = np.linspace(0, 1, n)
    y = crackle(dur, s, 250, 1100, 2200, 8000, .0004, .0016) * (.3 + .7 * u ** .7)
    y += bp(nz(n, s + 1), 300, 900) * u * .12
    y = np.concatenate([y, np.zeros(ns(.05))])
    m = ns(.02)
    put(y, bp(nz(m, s + 2), 2000, 6000) * dexp(m, .0015) * .3, dur - .01)
    return dsp.fade(y, .002, .02)


@design('scissors_snip', 'scissors cut paper: metal shear (money_sfx.snip) + paper crunch', 58, -15.0, spacing=.18)
def d_snip(c):
    s = c['seed']
    y = np.concatenate([mf.snip(s), np.zeros(ns(.05))])
    put(y, crackle(.03, s + 1, 900, 900, 2000, 7000) * .5, .045)
    return dsp.fade(lpf(y, 9000), .0005, .03)


@design('knot_tie', 'knot cinched on the thread: two quick thread squeaks + a low tug pluck', 57, -15.0)
def d_knot(c):
    s = c['seed']
    y = np.zeros(ns(.45))
    for k, (t0, f0) in enumerate(((0, 1100), (.08, 1300))):
        m = ns(.05)
        put(y, (squeak(m, s + k, f0, f0 * 1.15, .6) * .3 + bp(nz(m, s + 5 + k), 1200, 4000) * .4) * bell_env(m, .3), t0)
    put(y, ks_pluck(150, .3, s + 9, .97, 1500) * .6, .13)
    return dsp.fade(y, .001, .04)


@design('rattle_goods', 'the goods settle inside the carton: a dozen small knocks + box resonance', 56, -16.0)
def d_rattle(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.6))
    m = ns(.2)
    put(y, modes(m, [180, 300], [.05, .03], [.25, .12]), 0)
    for k in range(12):
        t0 = r.random() ** 1.6 * .45
        f = r.uniform(700, 2400)
        m = ns(.03)
        put(y, bp(nz(m, s + k), f / 1.4, f * 1.4) * dexp(m, r.uniform(.004, .012)) * (1 - t0 / .6) * r.uniform(.3, .8), t0)
    return dsp.fade(y, .001, .05)


@design('pin_click', 'push-pin pressed into card/cork: bright plastic click + small body + punch-through tick',
        55, -15.0)
def d_pin(c):
    r, s = c['rng'], c['seed']
    n = ns(.12)
    f = 1 + .06 * r.uniform(-1, 1)
    y = bp(nz(n, s), 2500, 8000) * dexp(n, .0012) + np.sin(2 * np.pi * 2100 * f * tt(n)) * dexp(n, .006) * .2
    y += bp(nz(n, s + 1), 400, 1000) * dexp(n, .007) * .5
    m = ns(.02)
    put(y, bp(nz(m, s + 2), 2000, 6000) * dexp(m, .001) * .3, .012)
    return dsp.fade(y, .0002, .03)


@design('lid_scrape', 'the ribbed container lid slides on: paper scrape with rib ticks (28/s) + end bump', 55, -15.0)
def d_lid(c):
    s = c['seed']
    dur = .45
    n = ns(dur)
    t = tt(n)
    rib = dsp.onepole_lp((np.sin(2 * np.pi * 28 * t) > .55).astype(float), 300)
    y = friction(n, s, 500, 2600, .5, 30) * (.55 + .45 * rib) * att(n, .04) * np.clip((dur - t) / .06, 0, 1)
    ticks = np.zeros(n); ticks[np.nonzero(np.diff((np.sin(2 * np.pi * 28 * t) > .55).astype(int)) > 0)[0]] = 1
    y += bp(ticks, 1000, 3000) * .5
    y = np.concatenate([y, np.zeros(ns(.15))])
    m = ns(.12)
    put(y, modes(m, [260, 430], [.03, .02], [.4, .2]) + bp(nz(m, s + 1), 800, 3000) * dexp(m, .006) * .3, dur - .03)
    return dsp.fade(y, .002, .03)


@design('whoosh_whip', 'fast whip of paper through air (0.3 s), brighter, sweeping across the stereo field', 54, -14.0,
        send=.05)
def d_whip(c):
    s = c['seed']
    dur = .32
    n = ns(dur)
    u = np.linspace(0, 1, n)
    shape = np.exp(-((u - .45) / .18) ** 2)
    x = dsp.tv_biquad(nz(n, s), 'bp', 500 + 4000 * shape, .9) * shape ** 1.2
    x += lpf(nz(n, s + 1), 300) * shape ** 2 * .2
    y = np.concatenate([x, np.zeros(ns(.05))])
    put(y, mf.paper_flick(s + 2) * .25, 0)
    p0, p1 = c['pan'] if isinstance(c['pan'], tuple) else (-.35, .35)
    pp = np.concatenate([p0 + (p1 - p0) * u, np.full(len(y) - n, p1)])
    return dsp.fade(dsp.pan(y, pp), .003, .03)


@design('paper_rustle', 'paper rustle / crumple: fibre crackle over a soft rub', 52, -15.0)
def d_rustle(c):
    s = c['seed']
    dur = .35
    n = ns(dur)
    y = crackle(dur, s, 160, 50, 1200, 6500) + friction(n, s + 1, 600, 2500, .6, 20) * bell_env(n, .2) * .3
    return dsp.fade(y * bell_env(n, .1) ** .5, .002, .05)


@design('waves_paper', 'the paper sea rises: shaken-paper swell (slow wave AM + rustle), wide stereo', 52, -15.0, send=.05)
def d_waves(c):
    s = c['seed']
    dur = .9
    n = ns(dur)
    env = bell_env(n, .55)
    chans = []
    for k in range(2):
        w = bp(nz(n, s + k), 350, 2400) * (.6 + .4 * np.sin(2 * np.pi * (2.8 + .4 * k) * tt(n) + k) ** 2)
        w += crackle(dur, s + 5 + k, 60, 120, 1500, 6000) * .5
        chans.append(w * env)
    return dsp.fade(stereo_wide(*chans, .8), .01, .05)


@design('mic_tap', 'finger tap on the team badge\'s mic: soft proximity "bmp" + tiny click', 50, -17.0)
def d_mic(c):
    s = c['seed']
    n = ns(.3)
    y = thump(n, 140, 85, .01, .06) + hpf(nz(n, s), 1800) * dexp(n, .0015) * .25 + lpf(nz(n, s + 1), 300) * dexp(n, .05) * .3
    return dsp.fade(y, .0003, .05)


@design('whoosh_soft', 'soft air of a sheet / carton moving: 250 -> 1800 Hz breath peaking at the landing (length = time '
        'to the next impact cue, else 0.5 s), slight paper flutter', 50, -16.0, send=.05)
def d_whoosh(c):
    s = c['seed']
    dur = float(np.clip(c['gap_next'] or .5, .3, .9))
    n = ns(dur + .08)
    t = tt(n)
    u = t / dur
    pk = .85
    shape = np.where(u < pk, np.exp(-((u - pk) / .3) ** 2), np.exp(-((u - pk) / .1) ** 2))
    x = dsp.tv_biquad(nz(n, s), 'bp', 250 + 1550 * shape, .8) * shape ** 1.3
    x *= 1 + .25 * np.sin(2 * np.pi * 12 * t)
    x += lpf(nz(n, s + 1), 220) * shape ** 2 * .15
    if isinstance(c['pan'], tuple):
        p0, p1 = c['pan']
        return dsp.fade(dsp.pan(x, p0 + (p1 - p0) * np.clip(u, 0, 1)), .01, .03)
    return dsp.fade(x, .01, .03)


@design('paper_flutter', 'a paper tab let go: fluttering fall (flap AM 16 -> 10 Hz), 0.38 s', 50, -18.0, spacing=.07)
def d_flutter(c):
    r, s = c['rng'], c['seed']
    dur = .38
    n = ns(dur)
    t = tt(n)
    rate = 16 - 6 * t / dur
    am = .2 + .8 * (.5 + .5 * np.sin(2 * np.pi * np.cumsum(rate) / SR + r.random() * 6)) ** 2
    y = bp(nz(n, s), 900, 3800) * am * bell_env(n, .3)
    return dsp.fade(y, .005, .04)


@design('cardboard_creak', 'cardboard walls bending: slow stick-slip creak through 380 / 920 / 1900 Hz resonances',
        48, -17.0)
def d_creak(c):
    r, s = c['rng'], c['seed']
    dur = .45
    n = ns(dur)
    u = np.linspace(0, 1, n)
    rate = (18 + 37 * u) * (1 + .3 * lpf(nz(n, s), 15) * 10)
    ph = np.cumsum(np.abs(rate) / SR)
    imp = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0]
    imp[idx] = r.uniform(.5, 1, len(idx))
    y = sum(dsp.biquad(imp, 'bp', f, q) * g for f, q, g in ((380, 6, 1.0), (920, 5, .7), (1900, 4, .35)))
    y = (y + bp(nz(n, s + 1), 400, 1500) * .03) * bell_env(n, .4)
    return dsp.fade(y, .005, .04)


@design('paper_slide', 'paper slides on paper: gritty 0.9-4.2 kHz friction + soft hiss + stop tap (0.38 s)', 47, -18.0)
def d_slide(c):
    r, s = c['rng'], c['seed']
    dur = .38 * (1 + .12 * r.uniform(-1, 1))
    n = ns(dur)
    t = tt(n)
    env = att(n, .03) * np.clip((dur - t) / .09, 0, 1) ** 1.5
    y = (friction(n, s, 900, 4200, .55, 35) + lpf(nz(n, s + 1), 1500) * .25) * env
    y = np.concatenate([y, np.zeros(ns(.05))])
    m = ns(.03)
    put(y, bp(nz(m, s + 2), 400, 2500) * dexp(m, .006) * .3, dur - .02)
    if isinstance(c['pan'], tuple):
        p0, p1 = c['pan']
        return dsp.fade(dsp.pan(y, p0 + (p1 - p0) * np.clip(np.arange(len(y)) / n, 0, 1)), .002, .03)
    return dsp.fade(y, .002, .03)


@design('tape_stop', 'the clip slows down: projector sprocket ticks slowing + a soft descending hum ("vvvip"), subtle',
        46, -19.0)
def d_tape_stop(c):
    s = c['seed']
    dur = .34
    n = ns(dur + .05)
    t = tt(n)
    f = 55 + 420 * np.exp(-t / .12)
    y = lpf(dsp.saw(f, n), 900) * np.exp(-t / .16) * .25 * att(n, .01)
    tk, gap, k = 0.0, .022, 0
    while tk < dur:
        m = ns(.012)
        put(y, bp(nz(m, s + k), 1800, 5000) * dexp(m, .0012) * .5 * (1 - tk / dur), tk)
        tk += gap; gap *= 1.25; k += 1
    return dsp.fade(y, .001, .03)


@design('cloth_squeak', 'the bow tightens: two tiny cotton-thread squeaks', 45, -19.0)
def d_cloth(c):
    s = c['seed']
    y = np.zeros(ns(.2))
    for k in range(2):
        m = ns(.06)
        put(y, squeak(m, s + k, 950 + 150 * k, 1150 + 150 * k, .6) * bell_env(m, .3) * .4
            + bp(nz(m, s + 3 + k), 900, 3000) * bell_env(m, .3) * .25, .07 * k)
    return dsp.fade(y, .001, .02)


@design('marker_write', 'felt marker writes a word: 4-6 gritty strokes (1.8-5.2 kHz) with an occasional squeak, pen '
        'tap first', 44, -18.0)
def d_write(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.55))
    m = ns(.02)
    put(y, bp(nz(m, s), 1500, 4000) * dexp(m, .0015) * .3, 0)
    t0, k = .015, 0
    for k in range(int(r.integers(4, 7))):
        d = r.uniform(.045, .085)
        m = ns(d)
        st = friction(m, s + 10 + k, 1800, 5200, .7, 60) * bell_env(m, .25) ** .6
        if r.random() < .4: st += squeak(m, s + 30 + k, r.uniform(1500, 2000), r.uniform(1900, 2500)) * bell_env(m, .4) * .08
        put(y, st, t0)
        t0 += d + r.uniform(.012, .03)
        if t0 > .45: break
    return dsp.fade(y, .001, .03)


@design('marker_squeak', 'a check mark drawn: short down-stroke + longer up-stroke squeak (1.3 -> 2.3 kHz)', 42, -19.0)
def d_check_mark(c):
    r, s = c['rng'], c['seed']
    y = np.zeros(ns(.3))
    f = 1 + .08 * r.uniform(-1, 1)
    for k, (t0, d, f0, f1) in enumerate(((0, .06, 1200, 1400), (.08, .14, 1300, 2300))):
        m = ns(d)
        st = friction(m, s + k, 1500, 4500, .6, 50) * .7 + squeak(m, s + 5 + k, f0 * f, f1 * f) * .3
        put(y, st * bell_env(m, .2) ** .7, t0)
    return dsp.fade(y, .001, .02)


@design('highlighter_swipe', 'broad chisel highlighter swipe: soft 0.7-2.6 kHz felt friction (0.32 s)', 42, -19.0)
def d_hilite(c):
    s = c['seed']
    n = ns(.32)
    y = friction(n, s, 700, 2600, .4, 25) * bell_env(n, .25) ** .7 + squeak(n, s + 1, 800, 950, .7) * bell_env(n, .5) * .04
    return dsp.fade(y, .003, .03)


@design('felt_swipe', 'short soft felt swipe (highlighter zone), 0.2 s', 40, -20.0)
def d_felt(c):
    s = c['seed']
    n = ns(.2)
    return dsp.fade(friction(n, s, 700, 2400, .4, 25) * bell_env(n, .25) ** .7, .003, .02)


@design('paper_steps', 'a paper client\'s footstep: dull paper pat', 39, -19.0, spacing=.13)
def d_step(c):
    s = c['seed']
    n = ns(.12)
    y = bp(nz(n, s), 300, 3000) * dexp(n, .012) + thump(n, 160, 100, .01, .03) * .4
    return dsp.fade(lpf(y, 4000), .0005, .02)


@design('footprint_ticks', 'one footprint stamped: tiny rubber-stamp tick (×6 = the walk)', 38, -20.0, spacing=.1)
def d_foot(c):
    s = c['seed']
    n = ns(.1)
    y = thump(n, 220, 130, .01, .025) * .6 + bp(nz(n, s), 600, 2000) * dexp(n, .008) * .5 + hpf(nz(n, s + 1), 3000) * dexp(n, .001) * .15
    return dsp.fade(y, .0003, .02)


@design('check_tick', 'a check icon pops: pencil "tk" + tiny upward squeak', 36, -17.0)
def d_check_tick(c):
    s = c['seed']
    y = np.zeros(ns(.12))
    m = ns(.03)
    put(y, bp(nz(m, s), 1800, 5000) * dexp(m, .0015), 0)
    m = ns(.05)
    put(y, (squeak(m, s + 1, 1800, 2400, .5) * .15 + friction(m, s + 2, 1800, 4500, .5, 50) * .25) * bell_env(m, .2), .02)
    return dsp.fade(y, .0005, .02)


@design('clack_wood', 'a stepper tab clacks onto the thread: small woody click, pitch rising along a run '
        '(A-major pentatonic)', 35, -18.0)
def d_clack(c):
    r, s = c['rng'], c['seed']
    m = (69, 71, 73, 76, 78, 81, 83)[min(c['run_i'], 6)]
    f = mtof_(m)
    n = ns(.12)
    t = tt(n)
    y = np.sin(2 * np.pi * f * t) * dexp(n, .02) + np.sin(2 * np.pi * f * 2.76 * t) * dexp(n, .008) * .35
    y += bp(nz(n, s), 2000, 6000) * dexp(n, .001) * .4
    return dsp.fade(lpf(y, 6000) * att(n, .0005), .0002, .02)


@design('tab_ticks', 'a ripple along the stepper: 6 tiny tab ticks 0.075 s apart, panned left -> right', 34, -19.0)
def d_tab_ticks(c):
    s = c['seed']
    n = ns(.65)
    L, R = np.zeros(n), np.zeros(n)
    for k in range(6):
        m = ns(.03)
        tk = bp(nz(m, s + k), 2500, 6000) * dexp(m, .0012) + bp(nz(m, s + 10 + k), 900, 2500) * dexp(m, .01) * .3
        p = -.5 + .2 * k; a = (p + 1) * np.pi / 4
        put(L, tk * np.cos(a) * (1 - .04 * k), .075 * k); put(R, tk * np.sin(a) * (1 - .04 * k), .075 * k)
    return dsp.fade(np.stack([L, R], 1), .0005, .02)


@design('click_soft', 'soft snap (prints click into a row)', 33, -18.0)
def d_click(c):
    s = c['seed']
    n = ns(.06)
    y = bp(nz(n, s), 1200, 4000) * dexp(n, .002) + np.sin(2 * np.pi * 700 * tt(n)) * dexp(n, .008) * .2
    return dsp.fade(y, .0002, .01)


# ---------------------------------------------------------------------------- beds (not counted as gestures)
@design('develop_whirr', 'instant print developing: very low chemical fizz + soft swell + warm hum (0.7 s)', 20, -22.0,
        bed=True)
def d_develop(c):
    s = c['seed']
    dur = .75
    n = ns(dur)
    env = att(n, .2) * np.clip((dur - tt(n)) / .3, 0, 1)
    y = crackle(dur, s, 70, 90, 3000, 9000, .0004, .001) * .5 + bp(nz(n, s + 1), 1200, 3200) * .35
    y += lpf(np.cumsum(nz(n, s + 2)) / 200, 200) * .2
    return dsp.fade(hpf(y, 60) * env, .01, .05)


@design('waves_paper_loop', 'paper sea under the boat: two slow wave layers (2.2 / 2.7 s) + faint rustle, wide; runs '
        'until the next tear / truck / chapter end (≤ 9 s), faded in 0.8 s / out 1.5 s', 10, -25.0, send=0, bed=True)
def d_waves_loop(c):
    s = c['seed']
    dur = float(np.clip(c['bed_len'], 2.0, 9.0))
    n = ns(dur)
    t = tt(n)
    chans = []
    for k, P in enumerate((2.2, 2.7)):
        w = bp(nz(n, s + k), 250, 1500) * (.35 + .65 * np.sin(np.pi * t / P + k) ** 2)
        w += crackle(dur, s + 5 + k, 40, 40, 1500, 5000) * .25
        chans.append(w)
    env = np.minimum(1, t / .8) * np.clip((dur - t) / 1.5, 0, 1)
    return stereo_wide(*chans, .9) * env[:, None]


@design('truck_rumble_soft', 'the paper truck: toy engine putt (42 Hz, 9 Hz firing) + cardboard rattle + wheels on '
        'twos, driving in from the left; then a very low idle with exhaust puffs every 0.8 s until it is lifted off',
        10, -17.0, send=.03, bed=True)
def d_truck(c):
    r, s = c['rng'], c['seed']
    drive = float(np.clip(c['gap_next'] or .6, .4, 1.0))
    idle = float(np.clip(c['bed_len'] - drive, 0, 6.0))
    n = ns(drive + idle + .1)
    t = tt(n)
    env_d = np.clip(t / .15, 0, 1) * np.where(t < drive, 1.0, np.exp(-(t - drive) / .12))
    f = np.where(t < drive, 42 + 10 * np.clip(t / drive, 0, 1), 36)
    fire = np.where(t < drive, (np.sin(2 * np.pi * 9 * t) > 0), (np.sin(2 * np.pi * 6.5 * t) > 0)).astype(float)
    fire = dsp.onepole_lp(fire, 60)
    eng = hpf(lpf(dsp.pulse(f, n, .35), 240), 65, 4) * (.55 + .45 * fire) * .7    # harmonics carry the putt, no sub mud
    rat = crackle(drive + idle + .1, s, 160, 100, 900, 3500) * fire * .5
    idle_env = np.where(t < drive, 0.0, .22) * np.clip((drive + idle - t) / 1.2, 0, 1) * np.clip((t - drive) / .1, 0, 1)
    y = (eng + rat) * (env_d + idle_env)
    k = 0
    for tw in np.arange(1 / 15, drive, 2 / 15):                                        # wheels on twos
        m = ns(.02)
        put(y, bp(nz(m, s + 50 + k), 1500, 4000) * dexp(m, .002) * .12, tw); k += 1
    for tp in np.arange(drive + .45, drive + idle - .3, .8):                            # exhaust puffs
        m = ns(.12)
        put(y, lpf(nz(m, s + 90 + k), 900) * bell_env(m, .15) * .12, tp); k += 1
    p0, p1 = c['pan'] if isinstance(c['pan'], tuple) else (-.8, 0.0)
    pp = p0 + (p1 - p0) * np.clip(t / drive, 0, 1) ** .6
    return dsp.fade(dsp.pan(y, pp), .01, .05)


@design('room_tone_change', 'outside -> inside the warehouse: a soft air-pressure "whump" opening into a darker room '
        'hush that fades out over 3 s, wide', 10, -24.0, send=.3, bed=True)
def d_room(c):
    s = c['seed']
    dur = 3.5
    n = ns(dur)
    t = tt(n)
    env = np.clip(t / .35, 0, 1) ** 1.5 * np.exp(-np.maximum(t - .35, 0) / 1.1)
    chans = [hpf(lpf(np.cumsum(nz(n, s + k)) / 150, 800), 110, 4) for k in range(2)]
    y = stereo_wide(*chans, .9) * env[:, None]
    m = ns(.4)
    wh = lpf(nz(m, s + 5), 450) * bell_env(m, .6) * .5
    y[:m] += wh[:, None]
    return dsp.fade(y, .01, .2)


@design('music_stop_beat', 'MUSIC instruction (silent here): lib/mix.py gates the music from the cue to the next beat '
        'one beat later (the reveal hit lands in the hole, the groove comes back on the grid)', 0, 0.0, bed=True)
def d_music_stop(c):
    return None


FAMILY = (('stamp', 'stamp_thunk'), ('reveal', 'reveal_hit'), ('cardboard', 'cardboard_thud'), ('box', 'cardboard_bump'),
          ('carton', 'cardboard_thud'), ('paper_slide', 'paper_slide'), ('paper_peel', 'paper_peel'),
          ('paper', 'paper_slap'), ('sticker', 'sticker_slap'), ('tape', 'tape_press'), ('card', 'card_deal'),
          ('whoosh', 'whoosh_soft'), ('marker', 'marker_squeak'), ('pen', 'marker_write'), ('highlighter', 'highlighter_swipe'),
          ('felt', 'felt_swipe'), ('string', 'string_pluck'), ('thread', 'string_pluck'), ('knot', 'knot_tie'),
          ('pin', 'pin_click'), ('click', 'click_soft'), ('tick', 'check_tick'), ('thup', 'thup'), ('scissors', 'scissors_snip'),
          ('horn', 'horn_toy'), ('truck', 'truck_rumble_soft'), ('wave', 'waves_paper'), ('pop', 'pop_soft'),
          ('confetti', 'confetti_paper'), ('shutter', 'shutter_click'), ('flap', 'flap_fold'), ('fold', 'flap_fold'),
          ('mic', 'mic_tap'), ('tab', 'tab_ticks'), ('room', 'room_tone_change'), ('flutter', 'paper_flutter'),
          ('foot', 'footprint_ticks'), ('step', 'paper_steps'), ('develop', 'develop_whirr'), ('clack', 'clack_wood'))
VAR_DB = {'light': -3.5, 'soft': -8.0, 'heavy': -1.0}      # heavy = more weight (sub, rattle), not more level
SPEECH_DB = {'stamp_thunk': 0.0, 'reveal_hit': 0.0, 'cardboard_thud': -3.0}     # under speech (others: -1.5 dB)
SPEECH = [(g['start'] - .05, g['end'] + .1) for g in TL['segments']]
IMPACT = ('cardboard_thud', 'paper_slap', 'sticker_slap', 'thup', 'stamp_thunk', 'tape_press', 'card_deal')
SAME_GESTURE_AS_HIT = ('stamp_thunk', 'reveal_hit', 'cardboard_thud')

# Small stereo placement where the frame says so (final_storyboard positions; x 0..1080 -> pan ±0.6 max).
# (chapter, name) -> per-occurrence pan (in time order inside the chapter): number, or (from, to) for a move.
PAN_HINTS = {
    ('hook', 'card_deal'): [-.35, 0, .35],                                           # P1 (250) / P2 (540) / P3 (830)
    ('s1', 'paper_slap'): [0, .05, -.3, 0],                                          # tag / China / CHINE strip (330) / sign
    ('s2', 'paper_slide'): [(.45, 0)],                                              # container slides in from the right
    ('s2', 'cardboard_bump'): [-.4, .4, .45],                                        # client A (left) / client B (right)
    ('s2', 'felt_swipe'): [-.35, 0, .35],                                            # columns A / B / hero
    ('s2', 'lid_scrape'): [(.45, 0)],
    ('s2', 'sticker_slap'): [0, .3],                                                 # post-it / mini label (lid's right end)
    ('s3', 'whoosh_soft'): [(.5, 0)],                                                # the boat slides in from the right
    ('s3', 'paper_slide'): [(0, -.4), 0],                                            # post-it out up-left / map in
    ('s3', 'paper_slap'): [0, .4, -.3],                                              # tag / CHINE (840) / AFRIQUE (330)
    ('s3', 'horn_toy'): [.35, 0, 0],                                                 # boat token at China / truck toots
    ('s3', 'pin_click'): [-.3, 0],                                                   # Gulf of Guinea / note
    ('s3', 'truck_rumble_soft'): [(-.8, 0)],                                         # drives in from the left
    ('s4', 'paper_slide'): [0, (0, .45), (0, .45)],                                  # note out / P4 out right / P4b out right
    ('s4', 'card_deal'): [-.35, -.35],                                               # P4b, P4c dealt from the left
    ('s4', 'pin_click'): [-.2], ('s4', 'mic_tap'): [-.2],                            # badge (380, 380)
    ('s4', 'whoosh_soft'): [(.3, 0)],                                                # sticker glides into the doorway
    ('s4', 'whoosh_whip'): [(.2, -.2)],
    ('s5', 'paper_slide'): [0, (0, -.45), (0, .45), (0, -.45)],                       # up / out left / P5a out right / sweep left
    ('s5', 'card_deal'): [-.35, -.45, 0, .45],                                       # P5b from the left / polaroids 200·540·880
    ('s5', 'marker_write'): [-.45, 0, .45],                                          # captions cartons / sacs / emballées
    ('s5', 'thup_x2'): [(-.35, -.2), (.2, .35)],
    ('s5', 'pin_click'): [-.2, 0], ('s5', 'mic_tap'): [-.2],
    ('s6', 'footprint_ticks_x6'): [(-.6, -.45)], ('s6', 'paper_steps_x3'): [(-.5, -.25)],
    ('s6', 'check_tick'): [.25], ('s6', 'card_deal'): [.35], ('s6', 'paper_slide'): [(0, -.4)],
    ('s6', 'pin_click'): [-.2], ('s6', 'mic_tap'): [-.2], ('s6', 'string_zip'): [(.5, .4)], ('s6', 'cloth_squeak'): [.4],
    ('recap', 'paper_flutter_x6'): [(-.5, .5)], ('recap', 'cardboard_thud_light'): [-.45],
    ('outro', 'pin_click'): [-.2], ('outro', 'mic_tap'): [-.2],
}
RUN_PAN = {'clack_wood': (-.55, .55)}                                                # stepper tabs left -> right


# ============================================================================ cue sheet logic
def chapter_at(t):
    for i, c in enumerate(CHS):
        if c['start'] <= t < c['end']: return i, c['id']
    return len(CHS) - 1, CHS[-1]['id']


def resolve(name, warn):
    """name -> (design base, variant, repeats)"""
    m = re.match(r'^(.*)_x(\d+)$', name)
    k = int(m.group(2)) if m else 1
    base = m.group(1) if m else name
    var = ''
    for v in ('light', 'soft', 'heavy'):                     # whoosh_soft, pop_soft… are designs in their own right
        if base not in DESIGN and base.endswith('_' + v): base, var = base[:-len(v) - 1], v
    if base not in DESIGN:
        fam = next((d for p, d in FAMILY if base.startswith(p)), None)
        warn.append(f'unknown cue "{name}" -> family {fam or "click_soft (default, -6 dB)"}')
        if fam is None: base, var = 'click_soft', var or 'soft'
        else: base = fam
    return base, var, k


def seed_of(name, i): return (zlib.crc32(name.encode()) % 100000) * 97 + i * 7919


def load_cues(path):
    raw = json.load(open(path))
    if isinstance(raw, dict): raw = raw.get('cues', [])
    cues = [dict(c) for c in raw if isinstance(c, dict) and 'name' in c and 't0' in c and np.isfinite(c['t0'])]
    return sorted(cues, key=lambda c: (c['t0'], c['name']))


def plan(cues, hits):
    warn, merged, dropped = [], [], []
    ev = []
    for c in cues:
        base, var, k = resolve(c['name'], warn)
        D = DESIGN[base]
        chi, ch = chapter_at(c['t0'])
        if base == 'stamp_thunk' and not var: var = 'light' if ch in ('hook', 'brand') else ('heavy' if ch == 'recap' else '')
        ev.append(dict(name=c['name'], base=base, var=var, reps=k, t=float(c['t0']), ch=ch, chi=chi, x=c.get('x'),
                       span=(k - 1) * D['spacing'], prio=D['prio'] - (3 if var in ('light', 'soft') else 0), bed=D['bed']))
    # merge: paper_peel_off right before a reveal_hit becomes the reveal's pre-roll
    for e in ev:
        if e['base'] == 'paper_peel_off' and any(f['base'] == 'reveal_hit' and 0 <= f['t'] - e['t'] <= .15 for f in ev):
            e['merged'] = 'reveal_hit'; merged.append((e['t'], e['name'], 'reveal_hit (pre-roll)'))
    live = [e for e in ev if not e.get('merged')]
    # gestures: _xN cues and runs of the same name <= 0.2 s apart
    gest, last = [], {}
    for e in live:
        if e['bed']: e['g'] = None; continue
        p = last.get(e['name'])
        if p is not None and e['t'] - gest[p]['b'] <= .2 and e['reps'] == 1:
            G = gest[p]; G['m'].append(e); G['b'] = max(G['b'], e['t'] + e['span']); e['g'] = p
        else:
            e['g'] = len(gest); last[e['name']] = e['g']
            gest.append(dict(a=e['t'], b=e['t'] + e['span'], m=[e], prio=e['prio']))
    for G in gest:
        for i, e in enumerate(G['m']): e['run_i'], e['run_n'] = i, len(G['m'])
    acc = []

    def fits(G):
        iv = [(A['a'] - .3 + 1e-3, A['b']) for A in acc] + [(G['a'] - .3 + 1e-3, G['b'])]
        for p in sorted({v for a, b in iv for v in (a, b)}):
            if G['a'] - .3 <= p <= G['b'] and sum(1 for a, b in iv if a <= p <= b) > 2: return False
        return True
    for G in sorted(gest, key=lambda G: (-G['prio'], G['a'])):
        if fits(G): acc.append(G)
        else:
            for e in G['m']: e['dropped'] = True; dropped.append((e['t'], e['name']))
    for e in live:
        e.setdefault('run_i', 0); e.setdefault('run_n', 1)
    keep = [e for e in live if not e.get('dropped')]
    # context: occurrence index per (chapter, name), time to the next impact, bed length
    occ = {}
    for e in keep:
        key = (e['ch'], e['name']); e['k'] = occ.get(key, 0); occ[key] = e['k'] + 1
    for e in keep:
        nxt = [f['t'] - e['t'] for f in keep if f['base'] in IMPACT and .25 <= f['t'] - e['t'] <= 1.0]
        if e['base'] == 'truck_rumble_soft':
            nxt = [f['t'] - e['t'] for f in keep if f['base'] == 'horn_toy' and .3 <= f['t'] - e['t'] <= 1.0]
        e['gap_next'] = min(nxt) if nxt else None
        ends = {'waves_paper_loop': ('paper_tear', 'truck_rumble_soft', 'paper_peel', 'whoosh_whip'),
                'truck_rumble_soft': ('paper_peel_off', 'reveal_hit', 'whoosh_whip')}.get(e['base'], ())
        later = [f['t'] for f in ev if f['base'] in ends and f['t'] > e['t'] + .5]
        ch_end = CHS[e['chi']]['end'] if e['base'] == 'waves_paper_loop' else e['t'] + 6.0
        e['bed_len'] = min(later + [ch_end, e['t'] + 9.0]) - e['t']
        e['pan'] = pan_for(e)
        e['hit_db'] = 0.0
        e['speech_db'] = 0.0 if e['bed'] else (SPEECH_DB.get(e['base'], -1.5) if any(a <= e['t'] <= b for a, b in SPEECH) else 0.0)
        if e['base'] not in SAME_GESTURE_AS_HIT and not e['bed']:
            for h in hits:
                if e['t'] - .05 <= h['t'] + .15 and h['t'] - .05 <= e['t'] + e['span'] + .2:
                    e['hit_db'] = min(e['hit_db'], -3.0 if h['kind'] == 'hit_big' else -1.5)
    stops = []
    for e in ev:
        if e['base'] == 'music_stop_beat':
            beat = 60.0 / float(TL.get('bpm', 120))                   # back on the grid one beat later
            stops.append([round(e['t'], 3), round(float(np.ceil((e['t'] + .9 * beat) / beat) * beat), 3)])
    return keep, dropped, merged, warn, stops


def pan_for(e):
    if e.get('x') is not None:
        return float(np.clip((float(e['x']) / 540 - 1) * .6, -.6, .6))
    if e['name'] in RUN_PAN and e['run_n'] > 1:
        a, b = RUN_PAN[e['name']]
        return a + (b - a) * e['run_i'] / (e['run_n'] - 1)
    h = PAN_HINTS.get((e['ch'], e['name']))
    if h and e['k'] < len(h): return h[e['k']]
    if e['base'] == 'marker_squeak' and e['ch'] in ('s1', 's2', 's3', 's4', 's5', 's6'):
        i = int(e['ch'][1]) - 1
        if abs(CHS[e['chi']]['end'] - .7 - e['t']) < .3 or abs(CHS[e['chi']]['end'] - .6 - e['t']) < .3:
            return -.5 + .2 * i                                          # stepper slot check, tab i (x 60 -> 1020)
    j = dsp.rng(seed_of(e['name'], int(e['t'] * 100))).uniform(-.08, .08)
    return float(j)


# ============================================================================ render
def kloud100(x):
    y = dsp.kweight(dsp.stereo(x))
    p = np.sum(y ** 2, axis=1)
    w = ns(.1)
    if len(p) <= w: return -0.691 + 10 * np.log10(max(p.mean(), 1e-20))
    c = np.concatenate([[0.0], np.cumsum(p)])
    return -0.691 + 10 * np.log10(max(((c[w:] - c[:-w]) / w).max(), 1e-20))


def render(keep):
    dry = np.zeros((N, 2)); send_s = np.zeros((N, 2)); send_m = np.zeros((N, 2))
    rows = []
    for idx, e in enumerate(keep):
        D = DESIGN[e['base']]
        reps = e['reps']
        pans = e['pan']
        for h in range(reps):
            seed = seed_of(e['name'], idx * 16 + h)
            ctx = dict(seed=seed, rng=dsp.rng(seed), var=e['var'], t=e['t'], ch=e['ch'], chi=e['chi'], k=e['k'],
                       run_i=e['run_i'] + h, run_n=max(e['run_n'], reps), gap_next=e['gap_next'], bed_len=e['bed_len'], pan=pans)
            if reps > 1:
                if isinstance(pans, tuple): p = pans[0] + (pans[1] - pans[0]) * h / (reps - 1)
                else: p = pans if pans is not None else 0.0
                if e['base'] == 'footprint_ticks': p += (.06 if h % 2 else -.06)        # left / right foot
                ctx['pan'] = p
            out = D['fn'](ctx)
            if out is None: continue
            sig, pre = out if isinstance(out, tuple) else (out, 0.0)
            if sig.ndim == 1:
                pp = ctx['pan']
                if isinstance(pp, tuple): pp = pp[0] + (pp[1] - pp[0]) * np.linspace(0, 1, len(sig))
                sig = dsp.pan(sig, pp)
            jit = dsp.rng(seed + 3).uniform(-.8, .8)
            g_db = REF_LU + D['gain'] + VAR_DB.get(e['var'], 0.0) + jit + e['hit_db'] + e['speech_db'] - kloud100(sig)
            if reps > 1: g_db -= 1.5 * (h % 2) if e['base'] == 'footprint_ticks' else 0.0
            if e['base'] == 'clack_wood': g_db += 1.2 * (ctx['run_i'] / max(1, ctx['run_n'] - 1) - .5)
            t0 = e['t'] + h * D['spacing'] - pre
            g = undb(g_db)
            add_at(dry, sig, t0, g)
            snd = D['send'] * (1.6 if e['var'] == 'heavy' else 1.0)
            if e['base'] in ('reveal_hit', 'room_tone_change') or e['var'] == 'heavy': add_at(send_m, sig, t0, g * snd)
            elif snd: add_at(send_s, sig, t0, g * snd)
        rows.append(e)
    ir_s = dsp.make_ir(.7, .4, .32, .15, .004, seed=31, early=True, bright=.7)       # the packing room: small, dry
    ir_m = dsp.make_ir(1.6, 1.1, .9, .4, .012, seed=32, early=True, bright=.6)       # for the reveal / heavy stamp
    y = dry + dsp.reverb(send_s, ir_s, 1.0, 200, 9000) + dsp.reverb(send_m, ir_m, 1.0, 120, 7000)   # dry + wet
    y = dsp.butter(dsp.dc_block(y, 20), 'hp', 38, 2)                              # vertical video: nothing useful below
    return y, rows


def palette_table(cues, keep, dropped, merged):
    allc, kept = {}, {}
    for c in cues: allc[c['name']] = allc.get(c['name'], 0) + 1
    for e in keep: kept[e['name']] = kept.get(e['name'], 0) + 1
    lines = [f'{"cue name":<22} {"n":>3} {"kept":>4} {"dB":>6}  design']
    for name in sorted(allc, key=lambda n: (-allc[n], n)):
        base, var, k = resolve(name, [])
        D = DESIGN[base]
        lvl = D['gain'] + VAR_DB.get(var, 0.0)
        tag = (f'{base}' + (f' [{var}]' if var else '') + (f' ×{k} @{D["spacing"]:.2f}s' if k > 1 else '')) if base != name else ''
        lines.append(f'{name:<22} {allc[name]:>3} {kept.get(name, 0):>4} {lvl:>6.1f}  {(tag + " = ") if tag else ""}{D["desc"]}')
    return '\n'.join(lines)


def main():
    arg = [a for a in sys.argv[1:] if not a.startswith('-')]
    path = arg[0] if arg else next((p for p in (os.path.join(OUT, 'cues.json'), os.path.join(OUT, 'cues_prov.json')) if os.path.exists(p)), None)
    if not path: sys.exit('no cue file (out/cues.json / out/cues_prov.json)')
    cues = load_cues(path)
    hp_ = os.path.join(OUT, 'music_hits.json')
    hits = [h for h in json.load(open(hp_)) if h['kind'].startswith('hit') or h['kind'] == 'final_chord'] if os.path.exists(hp_) else []
    keep, dropped, merged, warn, stops = plan(cues, hits)
    y, rows = render(keep)
    y = y[:N]
    if len(y) < N: y = np.concatenate([y, np.zeros((N - len(y), 2))])
    pk = float(dsp.true_peak_env(y).max())
    y = y * undb(-3.0) / max(pk, 1e-9)
    y[-1] = 0.0
    dsp.save(os.path.join(OUT, 'sfx.wav'), y, 'FLOAT')
    rep = dict(cues_file=os.path.relpath(path, X), n_cues=len(cues), n_placed=len(keep), duration_s=DUR,
               lufs=round(float(dsp.lufs_integrated(y)), 2), warnings=warn, music_stops=stops,
               dropped=[dict(t=t, name=n) for t, n in dropped], merged=[dict(t=t, name=n, into=i) for t, n, i in merged],
               placed=[dict(t=round(e['t'], 3), name=e['name'], design=e['base'], var=e['var'], reps=e['reps'], chapter=e['ch'],
                            pan=e['pan'] if not isinstance(e['pan'], tuple) else list(e['pan']), hit_db=e['hit_db'],
                            speech_db=e.get('speech_db', 0.0)) for e in rows])
    json.dump(rep, open(os.path.join(OUT, 'sfx_report.json'), 'w'), indent=1, ensure_ascii=False)
    print(palette_table(cues, keep, dropped, merged))
    print(f'\ncues: {path}  ({len(cues)} cues -> {len(keep)} placed, {len(dropped)} dropped by the ≤2/0.3 s rule, {len(merged)} merged)')
    for t, n in dropped: print(f'  dropped {t:7.2f} {n}')
    for t, n, i in merged: print(f'  merged  {t:7.2f} {n} -> {i}')
    for e in rows:
        if e['hit_db']: print(f'  near a music hit {e["t"]:7.2f} {e["name"]} {e["hit_db"]:+.1f} dB')
    for w in warn: print('  WARNING', w)
    print(f'  music stops for mix.py: {stops}')
    print(f'sfx.wav  {len(y) / SR:.3f} s  stereo {SR} Hz  |  {rep["lufs"]} LUFS (peak-normalised to -3 dBTP; mix.py relevels)')


if __name__ == '__main__':
    main()

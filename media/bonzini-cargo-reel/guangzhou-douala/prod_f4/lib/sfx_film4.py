"""sfx_film4.py — the film-4 sound design of « ELLE VA OÙ, CETTE MACHINE ? » (SERIE §5.4 « son »), synthesised and seeded
(deterministic), mono (n,) or stereo (n, 2), onset at sample 0. lib/mix.py merges TABLE into its cue table and LVL into
SFX_LVL (each cue is levelled on its loudest 400 ms to LVL[name], SERIE dB in the finished mix, voice ≈ −14).

  pulse      the low pulse under the question (M1): soft sub thumps on the 100-bpm beat, a heartbeat's double
  hydraulic  the crane's hydraulics: an oily hiss + the pump's whine; note 'up' = the whine rises a tone (M3, « monte d'un ton »)
  chain      a chain rattling / tightening: clusters of small metallic clinks
  scrape     metal dragged on metal / concrete: stick-slip friction through steel resonances
  clank      a metallic hit (the blades on the door frame)            clonk   a deeper, hollow one (the chain takes the load)
  wind       wind over the street (gusting, wide)                     whoom   the deep swell of the turning machine
  creak      a chain creak                                            shimmer the amber light sweep: a soft rising glitter
  thunk      the machine's weight on the concrete: a deep heavy hit
"""
import numpy as np
from audio import ns, tt, nz, bp, panst, grains
import audio_recu as R
dsp, SR, A = R.dsp, R.SR, R.A

def _rng(seed): return np.random.default_rng(seed)
def _n(y, pk=.9): return y / (np.abs(y).max() + 1e-12) * pk
def _env(n, a, r):
    t = tt(n); d = n / SR; return np.minimum(1, t / max(a, 1e-3)) * np.clip((d - t) / max(r, 1e-3), 0, 1)

def pulse(seed, dur=2.2, bpm=100.0):
    n = ns(dur); y = np.zeros(n); beat = 60.0 / bpm
    for k in range(int(dur / beat) + 1):
        for j, (dt, g) in enumerate(((0, 1.0), (.17, .55))):                 # lub-dub
            i = ns(k * beat + dt); m = ns(.35)
            if i >= n: continue
            t = tt(m); s = np.sin(2 * np.pi * np.cumsum(46 + 30 * np.exp(-t / .03)) / SR) * np.exp(-t / .11) * g
            s[:ns(.002)] += dsp.lp(nz(ns(.002), seed + k * 2 + j), 900) * .25
            e = min(n, i + m); y[i:e] += s[:e - i]
    return _n(y * _env(n, .25, .3))

def hydraulic(seed, dur=1.2, note=''):
    n = ns(dur); t = tt(n); r = _rng(seed)
    up = 'up' in (note or '') or 'tone' in (note or '')
    f0 = 170.0 * (2 ** ((2.0 * np.clip(t / max(dur * .6, .1), 0, 1)) / 12) if up else 1.0)
    wob = 1 + .012 * np.sin(2 * np.pi * 5.3 * t + r.uniform(0, 6))
    ph = 2 * np.pi * np.cumsum(f0 * wob) / SR
    whine = (np.sin(ph) + .45 * np.sin(2 * ph + .3) + .22 * np.sin(3 * ph + 1.1) + .12 * np.sin(5 * ph))
    whine = dsp.lp(whine, 1800) * .45
    hiss = dsp.tv_biquad(nz(n, seed + 1), 'bp', 3200 + 900 * np.sin(2 * np.pi * .7 * t), .9) * (.6 + .4 * np.sin(2 * np.pi * 2.1 * t + 1.3) ** 2)
    rumble = dsp.lp(nz(n, seed + 2), 160) * .6
    y = _n(whine) * .55 + _n(hiss) * .35 + _n(rumble) * .30
    return _n(y * _env(n, .12, .25))

def _clink(seed, f=3200.0, d=.05):
    m = ns(d + .02); t = tt(m); r = _rng(seed)
    y = sum(np.sin(2 * np.pi * f * k * (1 + r.uniform(-.02, .02)) * t + r.uniform(0, 6)) * np.exp(-t / (d / k ** .6)) * a
            for k, a in ((1, 1), (1.47, .6), (2.13, .45), (2.91, .3)))
    y[:ns(.0015)] += nz(ns(.0015), seed + 7) * .5
    return y

def chain(seed, dur=.6, note=''):
    n = ns(dur + .1); y = np.zeros(n); r = _rng(seed); t = 0.0; k = 0
    while t < dur:
        i = ns(t); c = _clink(seed + 11 * k, r.uniform(2300, 4600), r.uniform(.025, .06)) * r.uniform(.4, 1)
        e = min(n, i + len(c)); y[i:e] += c[:e - i]; t += r.uniform(.012, .05); k += 1
    y = dsp.butter(y, 'hp', 900, 2)
    return _n(y * _env(n, .01, .08))

def scrape(seed, dur=2.0, note=''):
    n = ns(dur); t = tt(n); r = _rng(seed)
    rate = 55 * (1 + .5 * np.sin(2 * np.pi * .9 * t + r.uniform(0, 6))) * (1 + .3 * dsp.onepole_lp(r.standard_normal(n), 3) / .3)
    ph = np.cumsum(np.maximum(rate, 8)) / SR; idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[idx] = r.uniform(.3, 1, len(idx))
    body = bp(imp, 620, 6) + .7 * bp(imp, 1340, 8) + .5 * bp(imp, 2470, 9)
    fric = dsp.butter(nz(n, seed + 3), 'bp', [700, 4200], 2) * (.5 + .5 * (np.sin(2 * np.pi * 1.7 * t) ** 2))
    y = _n(body) * .7 + _n(fric) * .35
    return _n(y * _env(n, .08, .2) * (.7 + .3 * np.sin(2 * np.pi * .45 * t + 1)))

def clank(seed, low=False):
    n = ns(1.0); t = tt(n)
    modes = ((180, 1, .16), (410, .8, .12), (690, .6, .09), (1130, .45, .06), (1790, .3, .04)) if not low else \
            ((95, 1, .22), (150, .8, .18), (236, .55, .12), (370, .35, .08), (590, .2, .05))
    y = R._modes(t, 1.0, modes, seed, None)
    y[:ns(.003)] += dsp.hp(nz(ns(.003), seed + 1), 2000) * np.linspace(1, 0, ns(.003)) * (.6 if not low else .3)
    if low: y += np.sin(2 * np.pi * np.cumsum(60 + 40 * np.exp(-t / .02)) / SR) * np.exp(-t / .09) * .8
    return _n(y)

def wind(seed, dur=3.4):
    n = ns(dur); t = tt(n); r = _rng(seed)
    g = .55 + .45 * np.sin(2 * np.pi * .31 * t + .4) * np.sin(2 * np.pi * .13 * t + 2.0)
    l = dsp.tv_biquad(nz(n, seed), 'bp', 520 + 380 * np.sin(2 * np.pi * .21 * t), .7) * g
    rr = dsp.tv_biquad(nz(n, seed + 1), 'bp', 600 + 340 * np.sin(2 * np.pi * .17 * t + 1.1), .7) * g
    whistle = dsp.tv_biquad(nz(n, seed + 2), 'bp', 1900 + 500 * np.sin(2 * np.pi * .23 * t), 9) * g * .25
    y = np.stack([l + whistle, rr + whistle], 1) * _env(n, .5, .6)[:, None]
    return y / (np.abs(y).max() + 1e-9)

def whoom(seed, dur=1.3):
    n = ns(dur); t = tt(n); u = t / dur
    sw = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.4
    sub = np.sin(2 * np.pi * np.cumsum(38 + 26 * sw) / SR) * sw
    air = dsp.tv_biquad(nz(n, seed), 'lp', 220 + 600 * sw, .8) * sw
    return _n(_n(sub) * .8 + _n(air) * .45)

def creak(seed, dur=.5):
    n = ns(dur); t = tt(n); r = _rng(seed)
    rate = 140 * (1 + .25 * np.sin(2 * np.pi * 3 * t)) * (1 + .2 * t / dur)
    ph = np.cumsum(rate) / SR; idx = np.nonzero(np.diff(np.floor(ph)) > 0)[0] + 1
    imp = np.zeros(n); imp[idx] = r.uniform(.5, 1, len(idx))
    y = bp(imp, 880, 14) + .6 * bp(imp, 1750, 16) + .3 * bp(imp, 2650, 18)
    return _n(y * _env(n, .06, .12))

def shimmer(seed, dur=.8):
    n = ns(dur + .6); y = np.zeros(n); r = _rng(seed)
    for k in range(9):
        m = 98 + 2 * k + (k % 3)                                            # above the phone band's speech
        b = A._bell(440 * 2 ** ((m - 69) / 12), .5, .08, seed + k, .002) * (.35 + .65 * k / 8)
        i = ns(dur * k / 9); e = min(n, i + len(b)); y[i:e] += b[:e - i]
    y += dsp.butter(nz(n, seed + 20), 'bp', [5000, 11000], 2) * _env(n, dur * .5, .5) * .08
    return _n(y)

def thunk(seed):
    n = ns(1.0); t = tt(n)
    y = np.sin(2 * np.pi * np.cumsum(38 + 72 * np.exp(-t / .025)) / SR) * np.exp(-t / .16) * 1.0
    y += R._modes(t, 1.0, ((120, .7, .08), (190, .5, .06), (310, .3, .04)), seed, None) * .5
    y += dsp.lp(nz(n, seed + 1), 1200) * np.exp(-t / .03) * .5
    y += dsp.butter(nz(n, seed + 2), 'bp', [300, 2500], 2) * np.exp(-np.maximum(t - .02, 0) / .05) * (t > .02) * .15   # grit
    return _n(dsp.softclip(y, 1.2))

def table(c, i, d, sd, p):
    note = c.get('note') or ''
    return {
        'pulse': lambda: ('sfx', pulse(sd, d or 2.2)),
        'hydraulic': lambda: ('sfx', hydraulic(sd, d or 1.2, note)),
        'chain': lambda: ('sfx', chain(sd, d or .6, note)),
        'scrape': lambda: ('sfx', scrape(sd, d or 2.0, note)),
        'clank': lambda: ('hit', clank(sd)),
        'clonk': lambda: ('hit', clank(sd, low=True)),
        'wind': lambda: ('sfx', wind(sd, d or 3.4)),
        'whoom': lambda: ('sfx', whoom(sd, d or 1.3)),
        'creak': lambda: ('sfx', creak(sd, d or .5)),
        'shimmer': lambda: ('sig', shimmer(sd, d or .8)),
        'thunk': lambda: ('hit', thunk(sd)),
    }
LVL = {'pulse': -24, 'hydraulic': -27, 'chain': -26, 'scrape': -27, 'clank': -20, 'clonk': -20, 'wind': -28, 'whoom': -24, 'creak': -29,
       'shimmer': -30, 'thunk': -18}

# ---------------------------------------------------------------------------------------------------------------------
# the « nappe »: the music SUSPENDED at step 3 — a held, slowly breathing pad on the makossa's tonic (no groove)
# ---------------------------------------------------------------------------------------------------------------------
def nappe(dur, tones=(60, 64, 67), seed=4242):
    n = ns(dur); t = tt(n); y = np.zeros((n, 2)); r = _rng(seed)
    for k, m in enumerate(list(tones) + [tones[0] - 12, tones[1] + 12]):
        f = 440 * 2 ** ((m - 69) / 12)
        for side in (0, 1):
            det = 1 + (side - .5) * .006 + r.uniform(-.002, .002)
            ph = 2 * np.pi * np.cumsum(f * det * (1 + .002 * np.sin(2 * np.pi * (.17 + .05 * k) * t))) / SR
            v = np.sin(ph) + .3 * np.sin(2 * ph) + .12 * np.sin(3 * ph)
            y[:, side] += v * (.8 if k < 3 else .45)
    y = dsp.lp(y, 1400)
    breath = .75 + .25 * np.sin(2 * np.pi * .22 * t - 1.2)
    y *= (np.minimum(1, t / .35) * np.clip((dur - t) / .25, 0, 1) * breath)[:, None]
    return y / (np.abs(y).max() + 1e-9)

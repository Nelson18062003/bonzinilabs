"""Money foley for "prix de revient" (48 kHz mono float, deterministic). Import alongside dsp.
cash_register, coin_drop, coins_pour, printer, calc_key, snip, riffle, marker_squeak, buzzer, correct, drumroll, stamp_hit, whoosh_s, pop_s, thud_s"""
import os, sys, math
import numpy as np
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(F, '..', 'explainer', 'lib', 'audio'))
import dsp
from dsp import SR, ns

def nz(n, seed):
    x = dsp.noise(n, seed); return x[:, 0] if x.ndim > 1 else x
def ex(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def mix_at(y, s, t):
    i = ns(t); m = min(len(s), len(y) - i)
    if m > 0: y[i:i + m] += s[:m]
    return y

def bell(f=2640, dur=1.2, seed=0):
    n = ns(dur); t = np.arange(n) / SR
    parts = [(1, 1), (2.76, .5), (5.4, .25), (8.93, .12)]
    y = sum(a * np.sin(2 * np.pi * f * r * t + seed) * np.exp(-t / (dur * .45 / r ** .5)) for r, a in parts)
    return y / 1.9

def coin_hit(seed=0, f=None):
    r = np.random.default_rng(seed); f = f or 3000 + r.random() * 2500
    n = ns(.35); t = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * f * k * t + r.random() * 6) * np.exp(-t / (.12 / k)) * a for k, a in ((1, 1), (1.47, .6), (2.09, .4), (2.9, .25)))
    y += dsp.hp(nz(n, seed), 5000) * ex(n, .004) * .8
    return y * .5

def coin_drop(seed=0, bounces=4):
    """a coin dropped on a wooden table: hit + decaying bounces + short spin rattle"""
    y = np.zeros(ns(1.1)); t = 0.0; g = 1.0; dt = .16
    for b in range(bounces):
        mix_at(y, coin_hit(seed * 10 + b) * g, t); t += dt; dt *= .62; g *= .55
    rat = np.zeros(ns(.3))
    for k in range(14): c = coin_hit(seed * 50 + k, 4200) * .12 * (1 - k / 14); mix_at(rat, c, k * .018 * (1 - k / 30))
    mix_at(y, rat, t)
    return dsp.hp(y, 600)

def coins_pour(dur=.9, seed=0, n_coins=18):
    y = np.zeros(ns(dur + .4)); r = np.random.default_rng(seed)
    for k in range(n_coins): mix_at(y, coin_hit(seed * 100 + k) * (.35 + .5 * r.random()), r.random() ** 1.4 * dur)
    return dsp.hp(y, 500)

def drawer(seed=0):
    n = ns(.28); x = dsp.biquad(nz(n, seed), 'bp', 700, 1.0) * np.sin(np.linspace(0, np.pi, n)) * .7
    x[-ns(.05):] += dsp.lp(nz(ns(.05), seed + 1), 900) * ex(ns(.05), .01) * 1.5
    return x

def cash_register(seed=0):
    """ka-CHING: two mechanical clacks, drawer slide, bell, coins"""
    y = np.zeros(ns(1.6))
    for i, t in enumerate((0, .07)):
        c = dsp.biquad(nz(ns(.05), seed + i), 'bp', 1800, 2) * ex(ns(.05), .006) * 1.4; mix_at(y, c, t)
    mix_at(y, drawer(seed + 3), .12)
    mix_at(y, bell(2640, 1.3, seed) * .75, .14)
    mix_at(y, coins_pour(.35, seed + 5, 7) * .45, .2)
    return y

def printer(dur=1.0, seed=0, rate=90):
    """thermal receipt printer: stepper buzz + line ticks + paper feed hiss"""
    n = ns(dur); t = np.arange(n) / SR
    motor = np.sign(np.sin(2 * np.pi * 420 * t)) * .08 + np.sin(2 * np.pi * 840 * t) * .05
    motor = dsp.biquad(motor, 'bp', 1200, 1.5) * (0.6 + .4 * (np.sin(2 * np.pi * 11 * t) > 0))
    y = motor + dsp.biquad(nz(n, seed), 'bp', 3800, .9) * .05
    for k in range(int(dur * rate / 10)):
        c = dsp.hp(nz(ns(.01), seed + k), 2500) * ex(ns(.01), .002) * .5; mix_at(y, c, k * 10 / rate)
    e = np.minimum(1, np.minimum(t / .02, (dur - t) / .03)).clip(0, 1)
    tail = dsp.biquad(nz(ns(.12), seed + 99), 'hp', 3000) * ex(ns(.12), .03) * .4                      # tear-off
    y = y * e; y = np.concatenate([y, np.zeros(ns(.15))]); mix_at(y, tail, dur)
    return y * 1.3

def calc_key(seed=0):
    n = ns(.05); y = dsp.biquad(nz(n, seed), 'bp', 2400, 3) * ex(n, .005) * 1.2
    y += np.sin(2 * np.pi * 180 * np.arange(n) / SR) * ex(n, .01) * .3
    return y

def calc_beep(f=2300, dur=.07):
    n = ns(dur); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.minimum(1, np.minimum(t / .003, (dur - t) / .01)).clip(0, 1) * .35

def snip(seed=0):
    """scissors: metallic shear + click"""
    n = ns(.16); t = np.arange(n) / SR
    sh = dsp.biquad(nz(n, seed), 'bp', 5200, 2.5) * np.exp(-((t - .05) / .03) ** 2) * 1.2
    ring = np.sin(2 * np.pi * 3900 * t) * np.exp(-t / .03) * .15
    ck = dsp.hp(nz(ns(.01), seed + 1), 2000) * ex(ns(.01), .002); y = sh + ring; y[ns(.1):ns(.1) + len(ck)] += ck
    return y

def paper_flick(seed=0):
    n = ns(.09); x = dsp.biquad(nz(n, seed), 'bp', 3000, .7) * ex(n, .02); return x * 1.1
def riffle(count=8, dur=.8, seed=0):
    """counting banknotes: a flick per note, slightly accelerating"""
    y = np.zeros(ns(dur + .2))
    for k in range(count): mix_at(y, paper_flick(seed + k) * (.7 + .3 * (k % 2)), dur * (k / count) ** .9)
    return y

def marker_squeak(dur=.5, seed=0):
    n = ns(dur); t = np.arange(n) / SR
    f = 1400 + 500 * np.sin(2 * np.pi * 3.2 * t + seed)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * .05
    fr = dsp.biquad(nz(n, seed), 'bp', 2500, 1.2) * .5 * (np.abs(np.sin(2 * np.pi * 7 * t)) ** 2)
    return (tone + fr) * np.minimum(1, np.minimum(t / .03, (dur - t) / .05)).clip(0, 1)

def buzzer(dur=.55):
    n = ns(dur); t = np.arange(n) / SR
    y = dsp.saw(110, n) * .5 + dsp.saw(116.5, n) * .5
    return dsp.lp(y, 1600) * np.minimum(1, np.minimum(t / .01, (dur - t) / .05)).clip(0, 1) * .5

def correct():
    y = np.zeros(ns(.9))
    for i, f in enumerate((1318.5, 1760.0)): mix_at(y, bell(f, .7, i) * .6, i * .11)
    return y

def drumroll(dur=1.4, seed=0):
    n = ns(dur); y = np.zeros(n); t = 0.0; k = 0
    while t < dur:
        d = dsp.biquad(nz(ns(.06), seed + k), 'bp', 1800, .8) * ex(ns(.06), .015) + np.sin(2 * np.pi * 190 * np.arange(ns(.06)) / SR) * ex(ns(.06), .02) * .5
        mix_at(y, d * (.35 + .65 * t / dur), t); t += .045 - .015 * t / dur; k += 1
    return y

def stamp_hit(seed=0):
    n = ns(.25); t = np.arange(n) / SR; f = 60 + 130 * np.exp(-t / .03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .07)
    k = dsp.biquad(nz(ns(.1), seed), 'bp', 900, 5) * ex(ns(.1), .03) * 1.2; y[:len(k)] += k
    return y

def whoosh_s(dur=.5, seed=0, lo=300, hi=3500):
    n = ns(dur); x = nz(n, seed); env = np.sin(np.linspace(0, np.pi, n)) ** 2
    fc = lo + (hi - lo) * np.sin(np.linspace(0, np.pi, n)); y = np.zeros(n)
    for i in range(0, n, 256): y[i:i + 256] = dsp.biquad(x[i:i + 256], 'bp', float(fc[i]), .9)
    return y * env * 1.4

def pop_s(seed=0):
    n = ns(.08); t = np.arange(n) / SR; f = 520 + 420 * (t / .08)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * ex(n, .025) * .6

def thud_s(g=1.0, f0=140, f1=55, seed=0):
    n = ns(.22); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t / .03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .06)
    c = dsp.lp(nz(ns(.03), seed), 1500) * ex(ns(.03), .008) * .8; y[:len(c)] += c
    return y * g

def sad_trombone():
    """wah-wah-wah-waaah (comic loss), soft brass"""
    y = np.zeros(ns(2.4)); notes = [(311.1, .38), (293.7, .38), (277.2, .38), (261.6, 1.1)]; t0 = 0.0
    for f, d in notes:
        n = ns(d); t = np.arange(n) / SR; vib = 1 + (.012 * np.sin(2 * np.pi * 5.5 * t) if d > .5 else 0)
        s = dsp.lp(dsp.saw(f * vib, n) if np.isscalar(vib) else dsp.saw(f, n), 900 + 700 * np.exp(-t / .15))
        s *= np.minimum(1, np.minimum(t / .04, (d - t) / .08)).clip(0, 1) * .35; mix_at(y, s, t0); t0 += d + .03
    return y

if __name__ == '__main__':
    out = np.zeros(ns(16)); t = 0.2
    for fn in (cash_register, coin_drop, lambda: coins_pour(), printer, lambda: sum_keys(), snip, lambda: riffle(), marker_squeak, buzzer, correct, drumroll, sad_trombone):
        pass
    def sum_keys():
        y = np.zeros(ns(.8))
        for k in range(6): mix_at(y, calc_key(k), k * .12)
        mix_at(y, calc_beep(), .72); return y
    for s in (cash_register(), coin_drop(1), coins_pour(), printer(1.2), sum_keys(), snip(), riffle(), marker_squeak(), buzzer(), correct(), drumroll(), sad_trombone()):
        mix_at(out, s, t); t += len(s) / SR + .25
    out = out[:ns(t)]
    peak = np.max(np.abs(out)); out = out / peak * .8
    dsp.save(os.path.join(F, 'out', 'sfx_demo.wav'), np.stack([out, out], 1))
    print('demo', round(t, 1), 's; raw peak', round(float(peak), 2), 'nan?', bool(np.isnan(out).any()))

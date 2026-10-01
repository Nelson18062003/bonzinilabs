"""Ambience beds for part 2 (synthesised, license-free): market murmur, night at the maquis, office fan, street traffic."""
import numpy as np
from dsp import SR, ns
import dsp
def _noise(n, seed): return np.random.default_rng(seed).standard_normal(n)
def market(dur, seed=0):
    """crowd murmur: band-passed noise with slow random swells + scattered voice-like formant blips"""
    n = ns(dur); x = dsp.lp(dsp.hp(_noise(n, seed), 250), 2200)
    env = dsp.onepole_lp(np.abs(_noise(n, seed + 1)), .6); env = .6 + .8 * env / (env.max() + 1e-9)
    y = x * env * .25
    r = np.random.default_rng(seed + 2)
    for _ in range(int(dur * 3)):                                        # distant voices
        t = r.uniform(0, dur - .4); f = r.uniform(180, 420); d = r.uniform(.12, .3); k = ns(d)
        tt = np.arange(k) / SR; blip = np.sin(2 * np.pi * f * tt + 3 * np.sin(2 * np.pi * 6 * tt)) * np.hanning(k) * r.uniform(.03, .08)
        i = ns(t); y[i:i + k] += blip[:n - i]
    return y
def night(dur, seed=0):
    """crickets + a far-away radio groove hum"""
    n = ns(dur); y = dsp.lp(_noise(n, seed), 400) * .05
    r = np.random.default_rng(seed + 5)
    for c in range(3):
        f = r.uniform(3800, 5200); period = r.uniform(.45, .8); t = r.uniform(0, period)
        while t < dur - .2:
            for p in range(3):
                k = ns(.018); tt = np.arange(k) / SR; ch = np.sin(2 * np.pi * f * tt) * np.hanning(k) * .06
                i = ns(t + p * .035); y[i:i + k] += ch[:n - i]
            t += period * r.uniform(.8, 1.2)
    return y
def fan(dur, seed=0):
    n = ns(dur); tt = np.arange(n) / SR
    y = dsp.lp(_noise(n, seed), 700) * .18 * (1 + .15 * np.sin(2 * np.pi * 2.3 * tt)) + np.sin(2 * np.pi * 100 * tt) * .01
    return y
def street(dur, seed=0):
    n = ns(dur); y = dsp.lp(_noise(n, seed), 900) * .12
    r = np.random.default_rng(seed + 9)
    for _ in range(max(1, int(dur / 3))):                                # a passing motorbike
        t = r.uniform(0, max(.1, dur - 2)); k = ns(1.8); tt = np.arange(k) / SR; f = 85 + 30 * np.sin(np.pi * tt / 1.8)
        mb = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.hanning(k) * .05; i = ns(t); y[i:i + k] += dsp.lp(mb, 1200)[:n - i]
    return y

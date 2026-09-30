"""Customs foley (48 kHz mono float, deterministic): paper rip, x-ray scan, barrier, page turn, card flip, monster growl,
paper plane, shutter, riser, phone tap/type, chime. Reuses money_sfx primitives (stamp_hit, whoosh_s, pop_s, thud_s, bell…).
python3 customs_sfx.py -> out/customs_sfx_demo.wav"""
import os, sys, math
import numpy as np
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(F, '..', 'explainer', 'lib', 'audio')); sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, ns
from money_sfx import nz, ex, mix_at, bell, stamp_hit, whoosh_s, pop_s, thud_s, paper_flick, calc_key, calc_beep, marker_squeak, snip, drumroll

def paper_rip(dur=.45, seed=0):
    """tearing paper: dense crackle bursts through a moving band-pass, getting faster"""
    n = ns(dur); y = np.zeros(n); r = np.random.default_rng(seed); t = 0.0
    while t < dur - .01:
        m = ns(.004 + r.random() * .01); b = dsp.biquad(nz(m, int(t * 1e4) + seed), 'bp', 1800 + r.random() * 3500, 1.5) * (0.5 + r.random())
        mix_at(y, b * ex(m, .003), t); t += .004 + .012 * (1 - t / dur) * r.random()
    env = np.minimum(1, np.arange(n) / ns(.03)) * np.exp(-np.arange(n) / ns(dur * .9))
    return dsp.hp(y * env, 600) * 1.3

def xray_scan(dur=1.2, seed=0):
    """scanner pass: 100 Hz mains hum + rising whine + soft digital ticks"""
    n = ns(dur); t = np.arange(n) / SR
    hum = (np.sin(2 * np.pi * 100 * t) * .5 + np.sin(2 * np.pi * 200 * t) * .25 + np.sin(2 * np.pi * 300 * t) * .12)
    f = 1200 + 1800 * (t / dur); whine = np.sin(2 * np.pi * np.cumsum(f) / SR) * .12
    env = np.minimum(1, t / .15) * np.minimum(1, (dur - t) / .2).clip(0, 1)
    y = (hum + whine) * env * .6
    for k in range(int(dur / .12)): mix_at(y, calc_beep(3200 + 200 * (k % 3), .018) * .25, k * .12 + .05)
    return y

def barrier_clack(seed=0):
    """barrier arm hitting its rest: metallic clack + spring rattle"""
    y = thud_s(.9, 220, 80, seed).copy()
    n = ns(.35); t = np.arange(n) / SR
    rat = sum(np.sin(2 * np.pi * f * t + seed) for f in (740, 1130, 1710)) * np.exp(-t / .08) * (1 + .6 * np.sin(2 * np.pi * 28 * t)) * .18
    y2 = np.zeros(max(len(y), n)); y2[:len(y)] += y; y2[:n] += rat
    c = dsp.hp(nz(ns(.02), seed + 3), 2500) * ex(ns(.02), .004) * .9; y2[:len(c)] += c
    return y2

def page_turn(seed=0):
    return whoosh_s(.28, seed, 900, 5000) * .8 + np.pad(paper_flick(seed + 1), (0, max(0, ns(.28) - len(paper_flick(seed + 1)))))[:ns(.28)] * .8

def card_flip(seed=0):
    y = np.zeros(ns(.2)); mix_at(y, whoosh_s(.12, seed, 1500, 6000) * .6, 0); mix_at(y, paper_flick(seed + 2) * .9, .1); return y

def monster_growl(dur=1.1, seed=0):
    """comic low growl (not scary): detuned saws with vibrato through a lowpass, a little paper rustle"""
    n = ns(dur); t = np.arange(n) / SR; vib = 1 + .03 * np.sin(2 * np.pi * 6 * t)
    f = 72 * vib * (1 + .15 * np.sin(np.pi * t / dur))
    ph = np.cumsum(f) / SR; y = sum(((ph * k) % 1) * 2 - 1 for k in (1, 1.01, .5)) / 3
    y = dsp.tv_biquad(y, 'lp', 500, 2.0) if False else dsp.lp(y, 520, 1.5)
    env = np.minimum(1, t / .12) * np.minimum(1, (dur - t) / .25).clip(0, 1)
    rust = dsp.bp_ if False else dsp.biquad(nz(n, seed), 'bp', 2500, 1.2) * .06
    return (y * .8 + rust) * env

def plane_whoosh(seed=0):
    y = whoosh_s(.9, seed, 400, 6000); n = len(y); t = np.arange(n) / SR
    y = y + np.sin(2 * np.pi * np.cumsum(600 + 1600 * t / .9) / SR) * np.sin(np.pi * t / .9) ** 2 * .08
    return y

def shutter(seed=0):
    y = np.zeros(ns(.12)); c = dsp.biquad(nz(ns(.02), seed), 'bp', 3500, 2) * ex(ns(.02), .004); mix_at(y, c, 0); mix_at(y, c * .7, .055); return y * 1.2

def riser(dur=1.0, seed=0):
    n = ns(dur); t = np.arange(n) / SR; x = nz(n, seed); y = np.zeros(n)
    for i in range(0, n, 256): y[i:i + 256] = dsp.biquad(x[i:i + 256], 'bp', float(400 + 5000 * (t[i] / dur) ** 2), 1.2)
    return y * (t / dur) ** 2 * 1.2

def tap(seed=0):
    return calc_key(seed) * .8

def typing(nkeys=6, gap=.08, seed=0):
    y = np.zeros(ns(nkeys * gap + .1))
    for k in range(nkeys): mix_at(y, calc_key(seed + k) * .6, k * gap + (k % 2) * .01)
    return y

def chime(seed=0):
    y = np.zeros(ns(1.3)); mix_at(y, bell(1760, 1.1, seed) * .5, 0); mix_at(y, bell(2637, 1.0, seed + 1) * .4, .09); return y

def boom(seed=0):
    """sub drop for the hook stamp"""
    n = ns(1.2); t = np.arange(n) / SR; f = 38 + 60 * np.exp(-t / .08)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .45) * .9

def heart_pops(n=4, seed=0):
    y = np.zeros(ns(.2 * n + .1))
    for k in range(n): mix_at(y, pop_s(seed + k) * .8, k * .14)
    return y

def _normed(fn, pk=.9):
    def w(*a, **k):
        y = fn(*a, **k); m = float(np.max(np.abs(y))) or 1.0; return y * (pk / m)
    return w
for _n in ('paper_rip', 'xray_scan', 'barrier_clack', 'page_turn', 'card_flip', 'monster_growl', 'plane_whoosh', 'shutter', 'riser', 'typing', 'chime', 'boom', 'heart_pops'):
    globals()[_n] = _normed(globals()[_n], .5 if _n in ('xray_scan', 'monster_growl', 'riser', 'plane_whoosh') else .9)

if __name__ == '__main__':
    out = np.zeros(ns(20)); t = .2
    for s in (paper_rip(), xray_scan(), barrier_clack(), page_turn(), card_flip(), monster_growl(), plane_whoosh(), shutter(), riser(), typing(), chime(), boom(), heart_pops(), stamp_hit(3)):
        mix_at(out, s, t); t += len(s) / SR + .25
    out = out[:ns(t)]; peak = np.max(np.abs(out)); out = out / peak * .8
    os.makedirs(os.path.join(F, 'out'), exist_ok=True); dsp.save(os.path.join(F, 'out', 'customs_sfx_demo.wav'), np.stack([out, out], 1))
    print('demo', round(t, 1), 's; raw peak', round(float(peak), 2), 'nan?', bool(np.isnan(out).any()))

"""Bikutsi-flavoured groove (12/8 feel over the 120 BPM grid: beat = 0.5 s = dotted quarter, 3 eighths per beat).
Reuses the Karplus-Strong guitar / bass / kit from makossa.py, adds a balafon-like FM mallet.
groove(put, t0, bar, beat, level, prog): level ∈ 'lite' | 'full' | 'tense' | 'bass' | 'drums'
python3 bikutsi.py -> out/bikutsi_demo.wav"""
import os, sys, math
import numpy as np
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(F, '..', 'explainer', 'lib', 'audio')); sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, ns, undb
import makossa as mk

def m2f(m): return 440 * 2 ** ((m - 69) / 12)
def balafon(f, dur=.45, seed=0):
    """wooden mallet: FM with inharmonic ratio, fast decay, a little buzz (the gourd mirliton)"""
    n = ns(dur); t = np.arange(n) / SR; e = np.exp(-t / .09); ie = np.exp(-t / .012)
    y = np.sin(2 * np.pi * f * t + 2.2 * ie * np.sin(2 * np.pi * f * 3.93 * t)) * e
    y += .25 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / .05)
    bz = dsp.biquad(mk.nz(n, seed), 'bp', f * 4, 6) * np.exp(-t / .05) * .18
    y = (y + bz); y[:ns(.002)] *= np.linspace(0, 1, ns(.002))
    return y * .8

# E minor loop: Em – D – C – D (chord tones for the guitar ostinato, bass root)
PROG = [('Em', [52, 59, 64, 67], 40), ('D', [50, 57, 62, 66], 38), ('C', [48, 55, 60, 64], 36), ('D', [50, 57, 62, 66], 38)]
PROG_TENSE = [('Em', [52, 59, 64, 67], 40), ('Em', [52, 58, 64, 67], 40), ('C', [48, 55, 60, 64], 36), ('B', [47, 54, 59, 63], 35)]
OST = [0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 3]             # 12 eighths per bar: guitar picking order
ACC = [1, 0, 0, .7, 0, .3, 1, 0, .3, .7, 0, .3]        # accents (bikutsi drive: 1 and 3 strong, pushes before)
BAL = [None, None, 7, None, 5, None, None, 3, None, 5, None, 7]   # balafon answer (scale steps above root, pentatonic-ish)
PENT = [0, 3, 5, 7, 10, 12, 15]

def groove(put, t0, bar, beat=.5, level='full', prog=PROG):
    name, tones, root = prog[bar % 4]
    e8 = beat / 3
    for k in range(12):
        tt = t0 + k * e8
        if level in ('full', 'lite', 'tense'):
            m = tones[OST[k] % len(tones)] + 12
            g = (.16 + .12 * ACC[k]) * (.8 if level == 'lite' else 1)
            put(mk.guitar(m2f(m), .16, bright=.55 + .25 * ACC[k], decay=.985, seed=bar * 12 + k, mute=1), tt, g, .35 if k % 2 else -.1)
        if level in ('full',) and BAL[k] is not None:
            step = BAL[k]; mm = root + 24 + (step if step in PENT else 7)
            put(balafon(m2f(mm), .4, bar * 12 + k), tt, .22, -.45)
        if level in ('full', 'bass', 'tense') and k in (0, 5, 6, 9):
            semi = {0: 0, 5: 7, 6: 0, 9: 12}[k]
            put(mk.bass(m2f(root + semi - 12 + 12), .22 if k != 0 else .35, pop=.8 if k == 9 else .3), tt, .5, 0)
        if level != 'lite':
            put(mk.hat(bar * 12 + k), tt, .2 if k % 3 == 0 else .11, .25)
    for b in range(4):
        tb = t0 + b * beat
        if level in ('full', 'bass', 'tense', 'drums'): put(mk.kick(), tb, .7 if b % 2 == 0 else .55)
        if level in ('full', 'drums') and b in (1, 3): put(mk.clap(bar * 4 + b), tb + e8 * 2 * 0, .26, -.1)
        if level == 'tense' and b in (1, 3): put(mk.rim(bar * 4 + b), tb, .35, .2)

if __name__ == '__main__':
    DUR = 24.0; N = ns(DUR); L = np.zeros(N); R = np.zeros(N)
    def put(sig, t, g=1.0, p=0.0):
        i = ns(t)
        if i >= N: return
        s = sig[:N - i] * g; L[i:i + len(s)] += s * math.cos((p + 1) * math.pi / 4); R[i:i + len(s)] += s * math.sin((p + 1) * math.pi / 4)
    for b in range(12):
        lvl = 'lite' if b < 2 else 'tense' if 6 <= b < 8 else 'full'
        groove(put, b * 2.0, b, level=lvl, prog=PROG_TENSE if 6 <= b < 8 else PROG)
    y = np.stack([L, R], 1); y = dsp.reverb(y, dsp.make_ir(1.3, 1.1, .9, .5), wet=.12)
    y *= undb(-16 - dsp.lufs_integrated(y)); y, _ = dsp.limiter(y, ceiling_db=-1.0)
    os.makedirs(os.path.join(F, 'out'), exist_ok=True); dsp.save(os.path.join(F, 'out', 'bikutsi_demo.wav'), y)
    print('LUFS', round(dsp.lufs_integrated(y), 2), 'peak', round(float(np.max(np.abs(y))), 3), 'nan', bool(np.isnan(y).any()))

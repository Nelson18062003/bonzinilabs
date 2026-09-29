"""Makossa-flavoured instruments for the "prix de revient" episode (48 kHz, deterministic).
- guitar(): Karplus-Strong plucked string (lfilter comb, linear-interp fractional delay → in tune), bright picked tone
- bass():   round electric bass with a finger "pop" and slight pitch settle
- kick(), rim(), hat(), clap(): light dance-band kit
- groove(): 16th-note picking patterns over a I–IV–V–IV loop in A major (A, D, E, D)
python3 makossa.py  -> out/makossa_demo.wav (32 s) + level report"""
import os, sys, math
import numpy as np
import scipy.signal as sps
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(F, '..', 'explainer', 'lib', 'audio'))
import dsp
from dsp import SR, ns, undb

def m2f(m): return 440 * 2 ** ((m - 69) / 12)
def nz(n, seed):
    x = dsp.noise(n, seed); return x[:, 0] if x.ndim > 1 else x

def guitar(f, dur=.5, bright=.65, decay=.996, seed=0, mute=0.0):
    """Karplus-Strong: y[n] = x[n] + g·(a·y[n-N] + (1-a)·y[n-N-1]); loop delay N + (1-a) = SR/f."""
    n = ns(dur); P = SR / f; N = int(math.floor(P)); a = 1 - (P - N)             # two-tap average delays by (1-a)
    a = min(max(a, 0.0), 1.0)
    burst = nz(N + 2, seed) * 1.0
    burst = dsp.lp(burst, 1200 + 7000 * bright)                                  # pick brightness
    x = np.zeros(n); x[:len(burst)] = burst[:n]
    g = decay * (1 - .012 * mute)
    den = np.zeros(N + 2); den[0] = 1; den[N] = -g * a; den[N + 1] = -g * (1 - a)
    y = sps.lfilter([1.0], den, x)
    y = dsp.lp(y, 2500 + 5000 * bright) if mute else y
    t = np.arange(n) / SR
    y *= np.minimum(1, (dur - t) / .03).clip(0, 1)                                # damp at note end
    y = dsp.hp(y, 140)
    return y / (np.max(np.abs(y)) + 1e-9) * .6

def bass(f, dur=.25, pop=.5):
    n = ns(dur); t = np.arange(n) / SR
    ff = f * (1 + .03 * np.exp(-t / .02))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    y = np.sin(ph) + .35 * np.sin(2 * ph) * np.exp(-t / .06) + .12 * np.sin(3 * ph) * np.exp(-t / .03)
    env = np.minimum(1, t / .004) * np.exp(-t / .35) * np.minimum(1, (dur - t) / .02).clip(0, 1)
    y = y * env
    y[:ns(.012)] += nz(ns(.012), int(f)) * np.linspace(1, 0, ns(.012)) * .15 * pop
    return dsp.softclip(dsp.lp(y, 1400), 1.2) * .8

def kick():
    n = ns(.3); t = np.arange(n) / SR; f = 48 + 80 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .1)
def rim(seed=0):
    n = ns(.06); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 1650 * t) * np.exp(-t / .01) * .6 + dsp.biquad(nz(n, seed), 'bp', 3200, 3) * np.exp(-t / .006) * 1.4
    return y
def hat(seed=0, open_=False):
    n = ns(.18 if open_ else .05); t = np.arange(n) / SR
    return dsp.hp(nz(n, seed), 7500) * np.exp(-t / (.06 if open_ else .012)) * .8
def clap(seed=0):
    n = ns(.2); y = np.zeros(n); t = np.arange(n) / SR
    for k, d in enumerate((0, .008, .017, .025)):
        i = ns(d); m = n - i; y[i:] += dsp.biquad(nz(m, seed + k), 'bp', 1500, 1.2) * np.exp(-np.arange(m) / SR / (.008 if k < 3 else .06))
    return y * .9

# A major loop, bar-wise: (name, chord tones for picking (MIDI), bass root MIDI)
PROG = [('A', [64, 69, 73, 76], 45), ('D', [66, 69, 74, 78], 50), ('E', [64, 68, 71, 76], 52), ('D', [66, 69, 74, 78], 50)]
PROG_MINOR = [('F#m', [66, 69, 73, 78], 42), ('D', [66, 69, 74, 78], 50), ('E', [64, 68, 71, 76], 52), ('C#m', [64, 68, 73, 76], 49)]
PICK = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]          # 16th-note picking order (lead guitar)
RHY = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0]           # rhythm guitar skank (muted chops)
BASS = [(0, 0, .22), (3, 12, .12), (4, 7, .2), (6, 0, .12), (8, 0, .22), (10, 12, .12), (11, 7, .12), (12, 5, .2), (14, 7, .18)]  # (16th, semitones, dur)

def groove(buf_put, t0, bar, beat=.5, level='full', prog=PROG):
    """Write one bar starting at t0. level: 'full' | 'lite' (no kick/bass) | 'bass' (bass + hats) | 'tense'."""
    name, tones, root = prog[bar % 4]
    s16 = beat / 4
    for k in range(16):
        tt = t0 + k * s16
        swing = .012 if k % 2 else 0.0
        if level in ('full', 'lite') or (level == 'tense' and k % 4 == 0):
            m = tones[PICK[k] % len(tones)] + 12
            buf_put(guitar(m2f(m), .32, bright=.7, decay=.994, seed=bar * 16 + k), tt + swing, .22 if k % 4 else .28, .45)
        if level == 'full' and RHY[k]:
            buf_put(guitar(m2f(tones[(k // 2) % len(tones)]), .09, bright=.45, decay=.98, seed=900 + bar * 16 + k, mute=1), tt + swing, .16, -.45)
        if level in ('full', 'bass', 'tense'):
            for (st, semi, d) in BASS:
                if st == k: buf_put(bass(m2f(root + semi - 12), d * 1.6, pop=1 if semi == 12 else .4), tt + swing, .5 if level != 'tense' else .42, 0)
        if level != 'lite':
            buf_put(hat(bar * 16 + k, open_=(k == 14)), tt + swing, .22 if k % 2 == 0 else .13, .25)
    for b in range(4):
        tb = t0 + b * beat
        if level in ('full', 'bass'): buf_put(kick(), tb, .75)
        if level == 'tense' and b % 2 == 0: buf_put(kick(), tb, .7)
        if b in (1, 3) and level in ('full', 'bass', 'tense'): buf_put(clap(bar * 4 + b) if level == 'full' else rim(bar * 4 + b), tb, .32 if level == 'full' else .4, -.1)
        if level == 'full' and b in (0, 2): buf_put(rim(bar * 7 + b), tb + beat * .75, .22, .2)

if __name__ == '__main__':
    DUR = 32.0; N = ns(DUR); L = np.zeros(N); R = np.zeros(N)
    def put(sig, t, g=1.0, p=0.0):
        i = ns(t)
        if i >= N: return
        s = sig[:N - i] * g; L[i:i + len(s)] += s * math.cos((p + 1) * math.pi / 4); R[i:i + len(s)] += s * math.sin((p + 1) * math.pi / 4)
    for b in range(16):
        lvl = 'lite' if b < 2 else 'bass' if b < 4 else 'tense' if 8 <= b < 10 else 'full'
        groove(put, b * 2.0, b, level=lvl, prog=PROG_MINOR if 8 <= b < 10 else PROG)
    y = np.stack([L, R], 1); y = dsp.reverb(y, dsp.make_ir(1.4, 1.2, 1.0, .5), wet=.14)
    y *= undb(-16 - dsp.lufs_integrated(y)); y, _ = dsp.limiter(y, ceiling_db=-1.0)
    os.makedirs(os.path.join(F, 'out'), exist_ok=True); dsp.save(os.path.join(F, 'out', 'makossa_demo.wav'), y)
    # tuning check: spectral peak of a single A4 pluck
    g = guitar(440, 1.0); sp = np.abs(np.fft.rfft(g * np.hanning(len(g)))); fr = np.fft.rfftfreq(len(g), 1 / SR)
    print('LUFS', round(dsp.lufs_integrated(y), 2), 'peak', round(float(np.max(np.abs(y))), 3), '| A4 pluck peak Hz', round(float(fr[np.argmax(sp)]), 1))

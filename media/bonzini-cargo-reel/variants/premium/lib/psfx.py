"""PREMIUM sound design — minimal and soft: air swishes on the chapter titles, whooshes on the camera
moves and the 16.00 zoom-through, a chime on "confiance", a warm swell + light shimmer into the end card.
Tonal cues in D major. Adapted from reel/lib/sfx.py (building blocks), new cue sheet.

Run:  nice -n 5 python3 lib/psfx.py   -> out/sfx.wav (48 kHz stereo float, 45.000 s) + work/audio/sfx_cues.json
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp
from dsp import SR, N, ns, mtof, add_at, stereo, pan, undb

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(V, 'out')
REP = os.path.join(V, 'work', 'audio')
D6, FS6, A6, D7, FS7, A7, E7 = 86, 90, 93, 98, 102, 105, 100


def tt(n):
    return np.arange(n) / SR


def whoosh(dur, peak_at=0.55, f_lo=350, f_hi=4200, p0=-0.6, p1=0.6, seed=0, rumble=0.3, width=0.22):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    shape = np.exp(-((u - peak_at) / width) ** 2)
    fc = f_lo + (f_hi - f_lo) * shape
    x = dsp.tv_biquad(dsp.noise(n, 5000 + seed), 'bp', fc, 0.8) * shape ** 1.2
    x += rumble * dsp.butter(dsp.noise(n, 5001 + seed), 'lp', 240, 2) * shape ** 2
    p = p0 + (p1 - p0) * (1 / (1 + np.exp(-(u - peak_at) * 8)))
    return dsp.fade(pan(x, p), 0.01, 0.03)


def air(dur=0.7, seed=0, p=-0.5, f0=1800, f1=7000):
    """Very soft airy swish (for text reveals)."""
    n = ns(dur)
    t = tt(n)
    u = t / dur
    env = np.sin(np.pi * np.clip(u / 0.9, 0, 1)) ** 2
    x = dsp.tv_biquad(dsp.noise(n, 5100 + seed), 'bp', f0 * (f1 / f0) ** u, 1.1) * env
    return dsp.fade(pan(x, p + 0.4 * u), 0.005, 0.03)


def bell(midi, dur=1.8, idx=1.0, ratio=3.0, tau=0.6):
    n = ns(dur)
    t = tt(n)
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.2)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * (1 - np.exp(-t / 0.002))
    x += 0.2 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / (tau * 0.5))
    return dsp.fade(x, 0.0003, 0.1)


def thump(seed=0, f_end=62.0, tau=0.28):
    n = ns(1.4)
    t = tt(n)
    f = f_end + 60 * np.exp(-t / 0.04)
    x = dsp.softclip(dsp.sine(f, n) * np.exp(-t / tau) * 1.4, 1.2)
    x += dsp.butter(dsp.noise(n, 5200 + seed), 'bp', [150, 1200], 2) * np.exp(-t / 0.05) * 0.35
    x += dsp.butter(dsp.noise(n, 5201 + seed), 'hp', 3000, 2) * np.exp(-t / 0.25) * (1 - np.exp(-t / 0.01)) * 0.06
    return dsp.fade(x, 0.0003, 0.3)


def reverse_swell(dur, seed, ir, notes=(62, 66, 69, 74, 76)):
    """Reverse-reverb swell of a soft D(add9) chord that peaks exactly at the end of `dur`."""
    n = ns(dur)
    k = ns(0.2)
    src = np.zeros(n)
    src[:k] = dsp.noise(k, 5300 + seed) * np.exp(-tt(k) / 0.03) * 0.5
    src[:k] += sum(dsp.sine(mtof(m), k) for m in notes) * np.exp(-tt(k) / 0.08) * 0.35
    y = dsp.reverb(src, ir, 1.0, 250, 8000)[:n][::-1].copy()
    y *= (np.linspace(0, 1, n) ** 1.6)[:, None]
    y[-ns(0.004):] *= np.linspace(1, 0, ns(0.004))[:, None]
    return y


def shimmer(dur, seed, notes=(D7, FS7, A7, E7, 110), density=10, level=1.0):
    r = dsp.rng(5400 + seed)
    n = ns(dur + 1.5)
    buf = np.zeros((n, 2))
    k = max(1, int(density * dur))
    for j in range(k):
        t0 = (j / k) * dur + r.uniform(0, dur / k)
        b = bell(notes[r.integers(len(notes))], 1.2, 0.6, 2.0, 0.35)
        add_at(buf, pan(b, r.uniform(-0.7, 0.7)), t0, level * r.uniform(0.4, 0.8))
    return buf


def sweep_hiss(dur, seed, p0=-0.6, p1=0.6):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    x = dsp.tv_biquad(dsp.noise(n, 5500 + seed), 'bp', 3000 * (4.0 ** u), 2.0)
    return dsp.fade(pan(x * np.sin(np.pi * u) ** 1.5, p0 + (p1 - p0) * u), 0.01, 0.02)


def render():
    ir_big = dsp.make_ir(3.4, 3.0, 2.6, 1.1, 0.03, seed=41, bright=0.8)
    ir_small = dsp.make_ir(1.0, 0.8, 0.7, 0.35, 0.008, seed=42)
    dry = np.zeros((N, 2))
    wet = np.zeros((N, 2))
    wet_s = np.zeros((N, 2))
    cues = []

    def put(sig, t, gain_db, big=0.0, small=0.2, name=None):
        g = undb(gain_db)
        s = stereo(sig)
        add_at(dry, s, t, g)
        if big:
            add_at(wet, s, t, g * big)
        if small:
            add_at(wet_s, s, t, g * small)
        if name:
            cues.append((round(t, 3), name))

    # 0.00 opening: soft air bloom following the light leak (top-right -> left) + faint shimmer
    put(whoosh(1.6, 0.30, 500, 3800, 0.6, -0.5, 1, 0.15, 0.25), 0.0, -14, 0.5, 0.2, 'opening bloom')
    put(shimmer(0.9, 1, level=1.0), 0.12, -24, 0.7, 0.0, 'opening shimmer')
    # chapter reveals (titles on the left)
    for j, t in enumerate((3.72, 10.02, 25.86)):
        put(air(0.75, 10 + j, -0.55), t - 0.05, -12, 0.3, 0.2, 'chapter air')
    # 12.0-13.1 whip pan L -> R
    put(whoosh(1.0, 0.48, 300, 3600, -0.9, 0.9, 12, 0.35), 12.0, -12, 0.25, 0.2, 'whip whoosh')
    # 16.00 zoom-through: rising suck-in -> soft thump -> air out
    put(reverse_swell(0.55, 16, ir_small), 15.45, -13, 0.0, 0.0, 'suck-in')
    put(whoosh(0.62, 0.97, 500, 6000, -0.3, 0.1, 17, 0.2, 0.3), 15.40, -12, 0.2, 0.0, 'zoom whoosh in')
    put(thump(20, 61.7, 0.3), 16.0, -8, 0.35, 0.0, 'soft impact')
    put(whoosh(0.8, 0.18, 400, 3200, 0.1, 0.5, 18, 0.2, 0.3), 16.0, -17, 0.35, 0.0, 'air out')
    # 30.7 pillar pan
    put(whoosh(0.7, 0.5, 350, 2600, 0.7, -0.7, 30, 0.2), 30.62, -13, 0.2, 0.2, 'pan whoosh')
    # 38.20 "confiance": soft chime (D6 F#6 A6 + D7)
    ch = np.zeros((ns(3.0), 2))
    for j, (dt, mm) in enumerate(((0.0, D6), (0.07, FS6), (0.14, A6), (0.24, D7))):
        add_at(ch, pan(bell(mm, 2.4, 0.9, 3.0, 0.8), (-0.35, -0.1, 0.15, 0.35)[j]), dt, (0.9, 0.8, 0.7, 0.45)[j])
    put(ch, 38.20, -13, 0.55, 0.0, 'confiance chime')
    # 39.0-40.0 warm swell into the end card, light-sweep shimmer on the logo reveal, soft impact at 40
    put(reverse_swell(1.0, 39, ir_big), 39.0, -6, 0.0, 0.0, 'warm swell')
    put(sweep_hiss(0.75, 40, -0.6, 0.6), 39.50, -24, 0.4, 0.0, 'logo sweep')
    put(thump(40, 73.4, 0.4), 40.0, -9, 0.5, 0.0, 'end impact')
    put(shimmer(1.2, 41, (D7, FS7, A7, 110, 105), 9, 1.0), 40.02, -20, 0.8, 0.0, 'end shimmer')
    put(sweep_hiss(0.9, 42, -0.5, 0.5), 41.95, -23, 0.4, 0.0, 'logo sheen')

    y = dry + dsp.reverb(wet, ir_big, 0.55, 250, 8000) + dsp.reverb(wet_s, ir_small, 0.4, 400, 9000)
    y = dsp.butter(dsp.dc_block(y, 20), 'hp', 32, 2)
    return y, cues


def main():
    os.makedirs(REP, exist_ok=True)
    y, cues = render()
    y = y * undb(-3.0) / dsp.true_peak_env(y).max()
    y = y[:N]
    dsp.save(os.path.join(OUT, 'sfx.wav'), y, 'FLOAT')
    json.dump({'cues': cues, 'lufs': dsp.lufs_integrated(y)}, open(os.path.join(REP, 'sfx_cues.json'), 'w'), indent=1)
    dsp.report_png(os.path.join(REP, 'sfx.png'), y, 'premium sfx.wav', cues)
    print('sfx lufs', dsp.lufs_integrated(y), 'cues', len(cues))


if __name__ == '__main__':
    main()

"""HOLOGRAMME score: dark deep-tech / ambient techno, fully synthesized (no samples).

120 BPM, F minor, parallel dub-chord loop  Fm9 | Dbmaj7 | Bbm7 | Cm7  (one chord per bar = 2.0 s).
  0.00        impact (tuned F sub + glass FM cluster); 0-4 glass pad swell, sparse FM bells, sub drone
  4-8         rim clicks + shaker, glassy FM arp (8ths, filtered), long reese notes
  8-15        deep round kick 4/4 enters, offbeat hats, arp -> 16ths, filter opens
  15-16       build: rim roll, noise + FM riser, kick out
  16.00       DROP: kick, rim/clap 2&4, open hats, rolling off-beat reese bass, dub-chord stabs into
              3/16 delay + hall, glass arp. 24: FM perc 3-3-2 + fill; 32: FM bell motif + ride-tick
  38-40       breakdown (drums out) + riser; 40.00 final hit, Fm(add9) hold + bell echoes, fade 43.5-45

Run:  nice -n 5 python3 lib/music.py      -> out/music.wav
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, N, BEAT, BAR, ns, mtof, add_at, stereo, pan, undb

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(V, 'out')
REP = os.path.join(OUT, 'audio_report')
T = np.arange(N) / SR
S16 = BEAT / 4

PROG = ['Fm9', 'Db', 'Bbm', 'Cm']
PAD = {'Fm9': [53, 56, 60, 63, 67], 'Db': [53, 56, 60, 65], 'Bbm': [53, 56, 61, 65], 'Cm': [55, 58, 63, 67],
       'Fadd9': [53, 56, 60, 67, 72]}
STAB = {'Fm9': [56, 60, 63, 67], 'Db': [56, 60, 65, 68], 'Bbm': [56, 61, 65, 68], 'Cm': [58, 63, 67, 70]}
ROOT = {'Fm9': 41, 'Db': 37, 'Bbm': 34, 'Cm': 36}
ARP = {'Fm9': [72, 75, 79, 80, 84], 'Db': [72, 77, 80, 84, 85], 'Bbm': [73, 77, 80, 84, 85], 'Cm': [70, 75, 79, 82, 87]}


def chord(b):
    return PROG[b % 4]


def auto(points, log=False):
    ts = np.array([p[0] for p in points], float)
    vs = np.array([p[1] for p in points], float)
    return np.exp(np.interp(T, ts, np.log(vs))) if log else np.interp(T, ts, vs)


def z():
    return np.zeros((N, 2))


# ============================================================================ instruments
def kick(seed=0, soft=False):
    n = ns(0.7)
    t = np.arange(n) / SR
    f = 43.65 + 110 * np.exp(-t / 0.035) + 30 * np.exp(-t / 0.006)       # settles on F1
    body = dsp.sine(f, n) * np.exp(-t / (0.2 if soft else 0.3))
    body = dsp.softclip(body * 1.5, 1.2)
    click = dsp.butter(dsp.noise(n, seed + 3), 'bp', [2500, 6000], 2) * np.exp(-t / 0.0015) * (0.06 if soft else 0.12)
    return dsp.fade(body + click, 0.0005, 0.05)


def rim(seed=0, bright=1.0):
    n = ns(0.18)
    t = np.arange(n) / SR
    x = dsp.sine(1650 * bright, n) * np.exp(-t / 0.009) + 0.7 * dsp.sine(480, n) * np.exp(-t / 0.018)
    x += 0.5 * dsp.butter(dsp.noise(n, 40 + seed), 'bp', [2000, 9000], 2) * np.exp(-t / 0.004)
    return dsp.fade(x, 0.0002, 0.03)


def clap(seed=0):
    n = ns(0.4)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for d in (0.0, 0.008, 0.017):
        i = ns(d); env[i:] += np.exp(-(t[i:] - d) / 0.005)
    env += 0.5 * np.exp(-np.maximum(t - 0.02, 0) / 0.06) * (t > 0.02)
    x = dsp.butter(dsp.noise(n, 70 + seed), 'bp', [1100, 6500], 2) * env
    return dsp.fade(x, 0.0003, 0.05)


def hat(seed=0, open_=False):
    n = ns(0.35 if open_ else 0.06)
    t = np.arange(n) / SR
    x = dsp.butter(dsp.noise(n, 100 + seed), 'hp', 8500, 4)
    x += 0.3 * dsp.butter(sum(dsp.pulse(f, n, .5) for f in (3120, 4480, 6650)), 'hp', 7000, 2)
    x *= np.exp(-t / (0.11 if open_ else 0.014))
    return dsp.fade(x, 0.0003, 0.008)


def shaker(seed=0):
    n = ns(0.09)
    t = np.arange(n) / SR
    env = (t / 0.015) ** 2 * np.exp(-t / 0.022)
    env /= env.max()
    return dsp.fade(dsp.butter(dsp.noise(n, 200 + seed), 'bp', [6000, 13000], 2) * env, 0.001, 0.01)


def fm_perc(midi, seed=0, ratio=1.41, idx=4.0, tau=0.07):
    n = ns(0.3)
    t = np.arange(n) / SR
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.02)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau)
    return dsp.fade(x, 0.0003, 0.03)


def ride_tick(seed=0):
    n = ns(0.5)
    t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((3350, 4720, 6010, 7890))) / 4
    x = x * np.exp(-t / 0.18) + 0.4 * dsp.butter(dsp.noise(n, 300 + seed), 'hp', 7000, 2) * np.exp(-t / 0.05)
    return dsp.fade(dsp.butter(x, 'hp', 3000, 2), 0.0003, 0.05)


def reese(midi, dur, cut=420.0, seed=0, env_amt=500.0):
    n = ns(dur + 0.1)
    t = np.arange(n) / SR
    f = mtof(midi)
    x = 0.5 * dsp.saw(f * 2 ** (-11 / 1200), n, 0.1) + 0.5 * dsp.saw(f * 2 ** (11 / 1200), n, 0.6)
    fc = cut + env_amt * np.exp(-t / 0.09) + 80 * np.sin(2 * np.pi * 0.7 * t + seed)
    x = dsp.lp(x, np.maximum(fc, 60), 1.1)
    x = dsp.softclip(x * 1.8, 1.2)
    amp = dsp.adsr(n, 0.005, 0.2, 0.75, 0.05, dur)
    return dsp.fade(x * amp, 0.001, 0.01)


def sub(midi, dur, att=0.004):
    n = ns(dur + 0.08)
    t = np.arange(n) / SR
    return dsp.fade(dsp.sine(mtof(midi), n) * dsp.adsr(n, att, 0.1, 0.9, 0.05, dur), 0.001, 0.01)


def glass(midi, dur=0.35, idx=1.3, ratio=3.01, tau=0.16):
    """Glassy FM tone (slightly inharmonic modulator)."""
    n = ns(dur)
    t = np.arange(n) / SR
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.05)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * (1 - np.exp(-t / 0.002))
    x += 0.15 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / (tau * .6))
    return dsp.fade(x, 0.0003, 0.03)


def bell(midi, dur=2.0, idx=3.0, ratio=3.5, tau=0.7):
    n = ns(dur)
    t = np.arange(n) / SR
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.3)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * (1 - np.exp(-t / 0.003))
    x += 0.3 * np.sin(2 * np.pi * f * 4.02 * t) * np.exp(-t / (tau * 0.3))
    return dsp.fade(x, 0.0005, 0.2)


def stab(ch, seed=0, cut=1100.0):
    n = ns(0.5)
    t = np.arange(n) / SR
    x = np.zeros((n, 2))
    for j, m in enumerate(STAB[ch]):
        x += pan(0.5 * dsp.saw(mtof(m) * 2 ** (-6 / 1200), n, j * .21) + 0.5 * dsp.saw(mtof(m) * 2 ** (6 / 1200), n, j * .37), (-.3, .3, -.15, .15)[j])
    x = dsp.lp(x, cut * (0.35 + np.exp(-t / 0.05)), 1.3)
    x *= dsp.adsr(n, 0.003, 0.12, 0.0, 0.05, 0.14, curve=3)[:, None]
    return dsp.fade(x, 0.0005, 0.02)


def pad_chord(ch, dur, seed=0, att=0.5):
    n = ns(dur + 1.2)
    t = np.arange(n) / SR
    x = np.zeros((n, 2))
    r = dsp.rng(seed)
    for j, m in enumerate(PAD[ch]):
        for d in (-7, 0, 7):
            f = mtof(m) * 2 ** (d / 1200) * (1 + 0.0015 * np.sin(2 * np.pi * (0.3 + 0.2 * r.random()) * t + r.random() * 6))
            v = 0.6 * dsp.tri(f, n, r.random()) + 0.4 * dsp.sine(f * 2, n, r.random()) * 0.4
            x += pan(v, r.uniform(-.8, .8))
    x *= dsp.adsr(n, att, 0.8, 0.85, 1.0, dur)[:, None]
    return x / 6


def sub_boom(dur=3.0, f_end=43.65, tau=0.8):
    n = ns(dur)
    t = np.arange(n) / SR
    f = f_end + 70 * np.exp(-t / 0.08)
    x = dsp.softclip(dsp.sine(f, n) * np.exp(-t / tau) * 1.7, 1.4)
    return dsp.fade(x, 0.0005, 0.4)


def glass_hit(seed=0, notes=(77, 84, 91, 96)):
    buf = np.zeros((ns(3.0), 2))
    for j, m in enumerate(notes):
        add_at(buf, pan(bell(m, 2.8, 2.2, 3.5, 0.9), (-.5, .5, -.2, .2)[j % 4]), 0.0, 0.5)
    n = ns(1.0)
    nz = dsp.butter(dsp.noise(n, 500 + seed, ch=2), 'hp', 3000, 2) * np.exp(-np.arange(n) / SR / 0.12)[:, None]
    add_at(buf, nz, 0.0, 0.35)
    return buf


def riser(t0, t1, seed=0, f0=250, f1=8000, level=1.0):
    n = ns(t1 - t0)
    t = np.arange(n) / SR
    u = t / (t1 - t0)
    nz = dsp.noise(n, 900 + seed, ch=2)
    x = dsp.tv_biquad(nz, 'bp', f0 * (f1 / f0) ** (u ** 1.5), 1.6) * (u ** 2.2)[:, None]
    # rising FM sweep (glassy)
    f = mtof(53 + 24 * u ** 1.7)
    mod = np.sin(2 * np.pi * np.cumsum(f * 2.0) / SR) * (1 + 3 * u)
    fm = np.sin(2 * np.pi * np.cumsum(f) / SR + mod) * u ** 2.5 * 0.35
    y = (x + pan(fm, 0.0) * 1.0) * level
    y[-ns(0.004):] *= np.linspace(1, 0, ns(0.004))[:, None]
    return y


def reverse_swell(dur, ir, seed=0, notes=(65, 72, 77, 80)):
    n = ns(dur)
    k = ns(0.2)
    src = np.zeros(n)
    tt = np.arange(k) / SR
    src[:k] = sum(np.sin(2 * np.pi * mtof(m) * tt) for m in notes) * np.exp(-tt / 0.06) * 0.3 + dsp.noise(k, seed) * np.exp(-tt / 0.03) * 0.5
    y = dsp.reverb(src, ir, 1.0, 300, 9000)[:n][::-1].copy()
    y *= (np.linspace(0, 1, n) ** 1.6)[:, None]
    y[-ns(0.003):] *= np.linspace(1, 0, ns(0.003))[:, None]
    return y


# ============================================================================ arrangement
def sidechain(kick_times, depth, rel=0.09):
    g = np.ones(N)
    L = ns(0.45)
    tt = np.arange(L) / SR
    shape = np.where(tt < 0.004, tt / 0.004, np.exp(-(tt - 0.004) / rel))
    for tk, d in kick_times:
        i = ns(tk); n = min(L, N - i)
        g[i:i + n] = np.minimum(g[i:i + n], 1 - d * depth * shape[:n])
    return g


def render():
    st = {k: z() for k in ['kick', 'rim', 'hats', 'perc', 'bass', 'sub', 'pad', 'stab', 'arp', 'bell', 'impact', 'riser', 'air']}
    kicks = []
    K, Ks = kick(0), kick(1, soft=True)
    for i in range(int(45 / BEAT)):
        t = i * BEAT
        if 8.0 <= t < 15.0:
            add_at(st['kick'], Ks, t, 0.55 + 0.35 * (t - 8) / 7); kicks.append((t, 0.6))
        elif 16.0 <= t < 38.0:
            add_at(st['kick'], K, t, 1.0); kicks.append((t, 1.0))
    add_at(st['kick'], K, 40.0, 1.0); kicks.append((40.0, 1.0))

    # rim clicks: offbeat 8ths 4-15 (quiet), rim+clap on 2 & 4 in the drop
    for i in range(int(45 / (BEAT / 2))):
        t = i * BEAT / 2
        if 4.0 <= t < 15.0 and i % 2 == 1:
            add_at(st['rim'], pan(rim(i % 4, 1.0 + 0.05 * (i % 3)), 0.25 if (i // 2) % 2 else -0.25), t, 0.35 + 0.2 * (t - 4) / 11)
    for b in range(8, 19):
        for beat in (1, 3):
            t = b * BAR + beat * BEAT
            if 16.0 <= t < 38.0:
                add_at(st['rim'], pan(rim(b + beat), 0.05), t, 0.8)
                add_at(st['rim'], pan(clap(b + beat), -0.05), t + 0.004, 0.55)
    # rim roll 15-16
    for j, t in enumerate(list(np.arange(15.0, 15.5, .125)) + list(np.arange(15.5, 15.75, .0625)) + list(np.arange(15.75, 16.0, .03125))):
        u = t - 15.0
        add_at(st['rim'], pan(rim(j, 1.0 + 0.4 * u), 0.3 * np.sin(j * 1.3)), t, 0.12 + 0.6 * u ** 1.6)
    for j, t in enumerate(np.arange(39.0, 40.0, .0625)):
        u = t - 39.0
        add_at(st['rim'], pan(rim(j + 50, 1.2 + 0.4 * u), 0.0), t, 0.03 + 0.25 * u ** 2)

    # hats / shaker
    hc = [hat(s) for s in range(5)]
    ho = hat(0, True)
    for i in range(int(45 / S16)):
        t = i * S16
        q = i % 4
        if 4.0 <= t < 15.0:
            add_at(st['hats'], pan(shaker(i % 6), -0.35), t + 0.004, (0.25 if q else 0.4) * (0.6 + 0.4 * (t - 4) / 11))
            if t >= 8.0 and q == 2:
                add_at(st['hats'], pan(hc[i % 5], 0.3), t, 0.55)
        elif 16.0 <= t < 38.0:
            if q == 2:
                add_at(st['hats'], pan(ho, 0.2), t, 0.5 if t < 32 else 0.6)
            else:
                add_at(st['hats'], pan(hc[i % 5], 0.35 if q % 2 else -0.2), t, (0.5 if q == 0 else 0.28) * (1.1 if t >= 24 else 1.0))
            add_at(st['hats'], pan(shaker(i % 6), -0.45), t + 0.006, 0.18 if q % 2 else 0.1)
    # FM perc 3-3-2 from 24 + fills
    for b in range(12, 19):
        for s16, m in ((0, 60), (3, 67), (6, 63), (8, 72), (11, 60), (14, 67)):
            t = b * BAR + s16 * S16
            if 24.0 <= t < 38.0:
                add_at(st['perc'], pan(fm_perc(m, s16), (-0.5, 0.5)[s16 % 2]), t, 0.42 if s16 in (0, 8) else 0.3)
    for t0 in (23.5, 31.5):
        for j, m in enumerate((72, 67, 63, 60)):
            add_at(st['perc'], pan(fm_perc(m, j, 1.0, 2.5, 0.12), -0.45 + 0.3 * j), t0 + j * 0.125, 0.5)
    for i in range(int(45 / BEAT)):
        t = i * BEAT
        if 32.0 <= t < 38.0:
            add_at(st['perc'], pan(ride_tick(i), 0.45), t + BEAT / 2, 0.28)

    # bass: long reese 4-15, rolling off-beat 8ths in the drop; sub follows roots
    for b in range(2, 8):
        t = b * BAR
        ch = chord(b)
        dur = BAR - 0.05 if t + BAR <= 15.0 else 15.0 - t - 0.02
        add_at(st['bass'], pan(reese(ROOT[ch], dur, 260 + 30 * (b - 2), b, 200), 0), t, 0.55)
        add_at(st['sub'], pan(sub(ROOT[ch] - 12, dur, 0.02), 0), t, 0.55)
    for b in range(8, 19):
        ch = chord(b)
        for e in range(8):
            t = b * BAR + e * BEAT / 2
            if not (16.0 <= t < 38.0):
                continue
            if e % 2 == 1:        # off-beat reese
                m = ROOT[ch] + (12 if e == 7 and b % 2 else 0)
                add_at(st['bass'], pan(reese(m, 0.2, 380 if t < 24 else 460, b * 8 + e, 900), 0), t, 1.0)
        add_at(st['sub'], pan(sub(ROOT[ch] - 12, BAR - 0.06), 0), b * BAR, 0.8)
    for t0, dur, m, att, g in ((38.0, 2.0, 24, 0.4, 0.6), (40.0, 4.5, 29, 0.004, 0.75)):
        add_at(st['sub'], pan(sub(m, dur, att), 0), t0, g)

    # pad (glass): 0-45
    pad = z()
    for b in range(0, 20):
        add_at(pad, pad_chord(chord(b), BAR, b, 0.35 if b else 0.9), b * BAR)
    add_at(pad, pad_chord('Fadd9', 4.2, 99, 0.01), 40.0)
    cut = auto([(0, 300), (3.8, 1500), (4.0, 1100), (15.0, 2200), (15.95, 3800), (16.0, 1400), (37.9, 1700),
                (38.0, 1500), (39.95, 4200), (40.0, 3200), (45, 1400)], log=True)
    st['pad'] = dsp.hp(dsp.lp(pad, cut, 0.8), 140, 0.7)

    # dub chord stabs (drop only): steps 3 & 10 (+ 14 on bar 4)
    for b in range(8, 19):
        ch = chord(b)
        for s16 in ((3, 10) if b % 4 != 3 else (3, 10, 14)):
            t = b * BAR + s16 * S16
            if 16.0 <= t < 38.0:
                add_at(st['stab'], stab(ch, b * 16 + s16, 1000 if t < 24 else 1400), t, 0.8)

    # glass arp
    pat = [0, 2, 1, 3, 2, 4, 1, 3]
    for i in range(int(40 / S16)):
        t = i * S16
        b = int(t // BAR)
        ch = chord(b)
        tones = ARP[ch]
        q = i % 16
        m = tones[pat[i % 8]]
        if t < 1.0:
            continue
        if t < 8.0:
            if i % 2: continue
            vel = 0.35 + 0.25 * (t / 8)
            note = glass(m, 0.3, 0.8, 3.01, 0.12)
        elif t < 15.0:
            vel = (0.45 if q % 4 == 0 else 0.3) * (0.8 + 0.3 * (t - 8) / 7)
            note = glass(m, 0.3, 0.9 + 0.8 * (t - 8) / 7, 3.01, 0.12)
        elif t < 16.0:
            vel = 0.3 + 0.3 * (t - 15)
            note = glass(m + 12, 0.25, 1.5, 3.01, 0.08)
        elif t < 38.0:
            if t >= 24 and q in (5, 13):
                m += 12
            vel = 0.36 if q % 4 == 0 else 0.24
            note = glass(m, 0.28, 1.1, 3.01, 0.1)
        else:
            u = (t - 38) / 2
            vel = 0.25 + 0.3 * u
            note = glass(m + (12 if q % 2 else 0), 0.25, 0.8 + 1.5 * u, 3.01, 0.1)
        add_at(st['arp'], pan(note, 0.4 if i % 2 else -0.4), t, vel)
    for j, (dt, m) in enumerate(((0.0, 84), (0.375, 79), (0.75, 75), (1.125, 72), (1.5, 79), (2.25, 84))):
        add_at(st['arp'], pan(glass(m, 0.8, 1.0, 3.01, 0.3), (-.5, .5)[j % 2]), 40.0 + dt, 0.5 * 0.85 ** j)

    # FM bells: intro sparkle, variation motif @32, final echoes
    for t, m in ((0.5, 84), (1.25, 80), (2.0, 79), (2.9, 87), (3.5, 84)):
        add_at(st['bell'], pan(bell(m, 2.0, 2.0, 3.5, 0.6), 0.4 * np.sin(t * 3)), t, 0.35)
    motif = [(32.0, 84), (32.75, 80), (33.5, 79), (34.0, 75), (34.75, 80), (35.5, 77), (36.0, 79), (36.75, 75), (37.5, 72)]
    for j, (t, m) in enumerate(motif):
        add_at(st['bell'], pan(bell(m, 1.8, 2.5, 3.5, 0.5), 0.5 if j % 2 else -0.5), t, 0.4)
    for j, (dt, m) in enumerate(((0.0, 77), (0.02, 84), (0.04, 91))):
        add_at(st['bell'], pan(bell(m, 3.5, 2.0, 3.5, 1.1), (-.5, 0, .5)[j]), 40.0 + dt, 0.35)

    # impacts, risers, air
    for t0, g in ((0.0, 0.9), (16.0, 1.0), (40.0, 0.9)):
        add_at(st['impact'], pan(sub_boom(3.5 if t0 == 40 else 2.5, tau=0.7 if t0 == 40 else 0.45), 0), t0, g)
        add_at(st['impact'], glass_hit(int(t0)), t0, 0.5 * g)
    add_at(st['riser'], riser(14.0, 16.0, 1, 250, 9000, 1.0), 14.0)
    add_at(st['riser'], riser(38.0, 40.0, 2, 200, 10000, 0.8), 38.0)
    air = dsp.butter(dsp.noise(N, 999, ch=2), 'bp', [4000, 12000], 2)
    air_g = auto([(0, 0), (0.3, 1), (3.6, 1), (4.5, 0.25), (38.0, 0.25), (40.0, 1.0), (45, 1.0)]) * (0.6 + 0.4 * np.sin(2 * np.pi * T / 5.0))
    st['air'] = air * air_g[:, None]
    # data texture: tiny random high sine grains (intro + breakdown + outro)
    r = dsp.rng(5)
    for k in range(120):
        t = r.uniform(0.2, 44)
        if 4.0 < t < 38.0 and r.random() < .75:
            continue
        m = r.choice([96, 99, 101, 103, 104, 108])
        add_at(st['air'], pan(glass(m, 0.08, 0.5, 2.0, 0.02), r.uniform(-.9, .9)), t, 3.0 * r.uniform(.3, 1))
    return st, kicks


TARGET = {'kick': 0.0, 'bass': -3.0, 'sub': -5.0, 'rim': -9.0, 'hats': -12.0, 'perc': -17.0, 'pad': -10.0,
          'stab': -11.5, 'arp': -14.0, 'bell': -18.0}


def mixdown(st, kicks):
    drop = (T >= 16.0) & (T < 38.0)
    ref = dsp.lufs_integrated(st['kick'], drop)
    g = {}
    for k, tgt in TARGET.items():
        mask = drop if k != 'bell' else ((T >= 32.0) & (T < 38.0))
        l = dsp.lufs_integrated(st[k], mask)
        g[k] = undb(ref + tgt - l) if np.isfinite(l) else 1.0
    s = {k: st[k] * g.get(k, 1.0) for k in st}
    groove = dsp.lufs_integrated(sum(s[k] for k in TARGET), drop)

    def level(name, a, b, rel):
        l = dsp.lufs_integrated(st[name], (T >= a) & (T < b))
        g[name] = undb(groove + rel - l)
        s[name] = st[name] * g[name]
    level('impact', 16.0, 16.8, -1.5)
    level('riser', 15.3, 16.0, -8.0)
    level('air', 40.5, 43.0, -24.0)
    sc_b = sidechain(kicks, 0.9, 0.08)[:, None]
    sc_s = sidechain(kicks, 0.5, 0.14)[:, None]
    hall = dsp.make_ir(4.0, 3.6, 3.0, 1.1, 0.04, seed=31)
    room = dsp.make_ir(1.0, 0.8, 0.7, 0.3, 0.008, seed=32)

    drums = s['kick'] + s['rim'] + s['hats'] + s['perc']
    drums += dsp.reverb(s['rim'] * 0.8 + s['perc'] * 0.5, room, 0.4, 400, 9000)
    drums += dsp.reverb(s['rim'], hall, 0.12, 600, 7000)
    drums = dsp.compressor(drums, thr_db=-14, ratio=2.2, att=0.008, rel=0.12, knee_db=6)
    bass = dsp.biquad(dsp.hp(s['bass'], 35, 0.7) * sc_b, 'peak', 380, 1.0, -2.0) + s['sub'] * sc_b
    # dub delay (3/16) on stabs, dotted-8th on arp, quarter on bells, big hall on everything tonal
    dly = dsp.pingpong(s['stab'], 0.375, 0.55, 9, 2600, 300) + dsp.pingpong(s['arp'], 0.375, 0.4, 6, 5000, 500) + \
        dsp.pingpong(s['bell'], 0.5, 0.45, 6, 5500, 600, 'R')
    tonal = s['pad'] * sc_s + (s['stab'] + s['arp'] + s['bell']) * sc_s
    rev = dsp.reverb(s['pad'] * 0.4 + s['stab'] * 0.8 + s['arp'] * 0.6 + s['bell'] * 0.9, hall, 0.6, 250, 7000)
    syn = tonal + 0.5 * dly * sc_s + rev
    # voice pocket in the drop + intro (dip 350 Hz-3.5 kHz)
    pocket = dsp.biquad(dsp.biquad(syn, 'peak', 1400, 0.55, -4.5), 'peak', 450, 1.0, -2.0)
    pk = auto([(0, 0.5), (3.5, 0.5), (4.0, 0.2), (15.9, 0.2), (16.0, 1.0), (37.9, 1.0), (39.2, 0.0), (45, 0.0)])[:, None]
    syn = syn * (1 - pk) + pocket * pk
    fx = s['impact'] + s['riser'] + s['air']
    fx = fx + dsp.reverb(s['impact'] + 0.5 * s['riser'], hall, 0.35, 200, 6000)
    macro = undb(auto([(0, -5.5), (3.95, -5.5), (4.0, -4.5), (7.9, -4.0), (8.0, -3.0), (14.9, -2.0), (16.0, 0.0),
                       (37.95, 0.0), (38.0, -2.5), (39.9, -1.0), (40.0, 0.0), (45, 0.0)]))[:, None]
    mix = (drums + bass + syn) * macro + fx
    mix = dsp.butter(mix, 'hp', 28, 4)
    mix = dsp.biquad(mix, 'ls', 70, 0.7, -2.0)
    f = np.ones(N)
    m = T >= 43.5
    f[m] = np.cos((T[m] - 43.5) / 1.5 * np.pi / 2) ** 2
    mix *= f[:, None]
    mix = dsp.compressor(mix, thr_db=-16, ratio=1.8, att=0.02, rel=0.2, knee_db=8)
    mix *= undb(-14.0 - dsp.lufs_integrated(mix))
    mix = dsp.clipper(mix, -4.0)
    mix, gr = dsp.limiter(mix, -1.2, 0.004, 0.08)
    print('limiter GR max %.1f dB' % (-dsp.db(gr.min())))
    return mix, {k: float(20 * np.log10(v)) for k, v in g.items()}


def main():
    os.makedirs(REP, exist_ok=True)
    st, kicks = render()
    mix, gains = mixdown(st, kicks)
    mix = mix[:N]
    dsp.save(os.path.join(OUT, 'music.wav'), mix, 'FLOAT')
    info = {'lufs': dsp.lufs_integrated(mix), 'peak_dbfs': float(dsp.db(np.max(np.abs(mix)))), 'stem_gains_db': gains}
    json.dump(info, open(os.path.join(REP, 'music_info.json'), 'w'), indent=1)
    print(json.dumps(info, indent=1))


if __name__ == '__main__':
    main()

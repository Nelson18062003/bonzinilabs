"""Original score for the BONZINI TRADING CARGO reel — fully synthesized (no samples).

120 BPM, D minor, Dm - Bb - F - C (one chord per bar = 2.0 s), 45.000 s, locked to the picture:
  0.00        impact + power-on swell; bars 1-2 (0-4 s): pad + sub drone + filtered arp, no kick
  4-16        soft four-on-the-floor, clap 2&4, 16th hats, pumping 8th bass, arp filter opens
  15-16       riser + snare roll, kick out
  16.00       DROP (impact). 16-38 full groove, voice pocket kept clear (300 Hz-3.5 kHz)
  24 / 32     variations (shaker+ride layer / bell motif + open hats)
  38-40       breakdown (drums out) + riser
  40.00       final impact, sustained Dm(add9) + arp echoes, fade 43.5-45.0

Run:  nice -n 5 python3 lib/music.py      -> out/music.wav (+ out/audio_report/music_*.png, stems)
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, N, BEAT, BAR, ns, mtof, add_at, stereo, pan, undb

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(R, 'out')
REP = os.path.join(OUT, 'audio_report')
T = np.arange(N) / SR

PROG = ['Dm', 'Bb', 'F', 'C']
PAD_VOICING = {'Dm': [50, 53, 57, 62], 'Bb': [50, 53, 58, 62], 'F': [48, 53, 57, 60], 'C': [48, 52, 55, 60],
               'Dm9': [50, 57, 62, 64, 65]}
BASS_ROOT = {'Dm': 38, 'Bb': 34, 'F': 41, 'C': 36}
ARP_TONES = {'Dm': [62, 65, 69, 74], 'Bb': [62, 65, 70, 74], 'F': [65, 69, 72, 77], 'C': [64, 67, 72, 76]}


def chord_at_bar(k):          # k = 0-based bar index; bar k starts at 2k s
    return PROG[k % 4]


def auto(points, log=False):
    """Per-sample automation from [(t, v), ...] (linear or log interpolation)."""
    ts = np.array([p[0] for p in points], float)
    vs = np.array([p[1] for p in points], float)
    if log:
        return np.exp(np.interp(T, ts, np.log(vs)))
    return np.interp(T, ts, vs)


def z():
    return np.zeros((N, 2))


# ============================================================================ instruments
def kick(full=True, seed=0):
    n = ns(0.55)
    t = np.arange(n) / SR
    f = 50.0 + (125.0 if full else 95.0) * np.exp(-t / 0.028) + 40 * np.exp(-t / 0.004)
    body = dsp.sine(f, n) * np.exp(-t / (0.17 if full else 0.12))
    body = dsp.softclip(body * (1.8 if full else 1.2), 1.4)
    click = dsp.butter(dsp.noise(n, seed + 11), 'bp', [1800, 7000], 2) * np.exp(-t / 0.0025) * (0.35 if full else 0.12)
    x = dsp.fade(body + click, 0.0005, 0.03)
    return x


def clap(seed=0, bright=1.0):
    n = ns(0.45)
    t = np.arange(n) / SR
    nz = dsp.noise(n, 100 + seed)
    env = np.zeros(n)
    for k, d in enumerate([0.0, 0.009, 0.019]):
        i = ns(d)
        env[i:] += np.exp(-(t[i:] - d) / 0.006) * (0.8 if k < 2 else 1.0)
    env += 0.55 * np.exp(-np.maximum(t - 0.021, 0) / 0.075) * (t > 0.021)
    x = dsp.butter(nz, 'bp', [900, 5200 * bright], 2) * env
    x = dsp.biquad(x, 'peak', 1300, 1.2, 3.0)
    return dsp.fade(x, 0.0003, 0.05)


_HAT_F = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) * 1.9


def hat(open_=False, seed=0):
    n = ns(0.5 if open_ else 0.09)
    t = np.arange(n) / SR
    metal = sum(dsp.pulse(f, n, 0.5, phase0=(i * 0.137) % 1) for i, f in enumerate(_HAT_F)) / 6
    x = 0.55 * metal + 0.75 * dsp.noise(n, 200 + seed)
    x = dsp.butter(x, 'hp', 7200, 4)
    x = dsp.biquad(x, 'peak', 10500, 1.0, 3.0)
    x *= np.exp(-t / (0.16 if open_ else 0.024))
    return dsp.fade(x, 0.0005, 0.01)


def shaker(seed=0):
    n = ns(0.11)
    t = np.arange(n) / SR
    env = (t / 0.018) ** 2 * np.exp(-t / 0.028) if True else None
    env /= env.max()
    x = dsp.butter(dsp.noise(n, 300 + seed), 'bp', [5500, 12000], 2) * env
    return dsp.fade(x, 0.001, 0.01)


def ride(seed=0):
    n = ns(1.2)
    t = np.arange(n) / SR
    fr = [3150, 4420, 5310, 6880, 8230]
    x = sum(dsp.sine(f, n, (i * .31) % 1) * np.exp(-t / (0.35 + 0.1 * i)) for i, f in enumerate(fr)) / 5
    x += 0.5 * dsp.butter(dsp.noise(n, 400 + seed), 'hp', 6000, 2) * np.exp(-t / 0.3)
    return dsp.fade(dsp.butter(x, 'hp', 2500, 2) * (0.6 + 0.4 * np.exp(-t / 0.01)), 0.0005, 0.05)


def snare(seed=0, tune=1.0):
    n = ns(0.3)
    t = np.arange(n) / SR
    body = dsp.sine(185 * tune * (1 + 0.5 * np.exp(-t / 0.01)), n) * np.exp(-t / 0.06)
    nz = dsp.butter(dsp.noise(n, 500 + seed), 'bp', [1500, 9000], 2) * np.exp(-t / 0.09)
    return dsp.fade(0.6 * body + nz, 0.0003, 0.03)


def crash(seed=0, dur=2.6):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    r = dsp.rng(600 + seed)
    for ch in range(2):
        fr = r.uniform(2500, 11000, 24)
        metal = sum(dsp.sine(f, n, r.random()) for f in fr) / 24
        nz = dsp.noise(n, 610 + seed + ch)
        x = 0.35 * metal + nz
        x = dsp.butter(x, 'hp', 3500, 2)
        x = dsp.onepole_lp(x, 11000)
        out[:, ch] = x * (0.25 * np.exp(-t / 0.05) + 0.75 * np.exp(-t / 0.75))
    return dsp.fade(out, 0.0005, 0.3)


def tom(midi, seed=0):
    n = ns(0.35)
    t = np.arange(n) / SR
    f0 = mtof(midi)
    x = dsp.sine(f0 * (1 + 0.6 * np.exp(-t / 0.02)), n) * np.exp(-t / 0.14)
    x += 0.2 * dsp.butter(dsp.noise(n, 700 + seed), 'bp', [300, 3000], 2) * np.exp(-t / 0.02)
    return dsp.fade(dsp.softclip(x * 1.3, 1.2), 0.0005, 0.05)


def bass_note(midi, dur, cut_peak=900.0, cut_base=120.0, drive=1.6, seed=0):
    n = ns(dur + 0.08)
    t = np.arange(n) / SR
    f = mtof(midi)
    x = dsp.saw(f, n, 0.0) * 0.6 + dsp.saw(f * 1.004, n, 0.37) * 0.4
    env_f = cut_base + cut_peak * np.exp(-t / 0.075)
    x = dsp.lp(x, env_f, 1.4)
    sub = dsp.sine(f, n, 0.25) * 0.7
    amp = dsp.adsr(n, 0.003, 0.14, 0.7, 0.04, dur)
    y = dsp.softclip((x + sub) * amp * drive, 1.0)
    return dsp.fade(y, 0.001, 0.01)


def pluck(midi, cut=2000.0, env_amt=2.5, decay=0.16, q=2.2, n_s=0.42):
    n = ns(n_s)
    t = np.arange(n) / SR
    f = mtof(midi)
    x = 0.55 * dsp.pulse(f, n, 0.32) + 0.45 * dsp.saw(f * 1.003, n, 0.2)
    fc = np.minimum(cut * (1 + env_amt * np.exp(-t / 0.05)), 16000)
    x = dsp.lp(x, fc, q)
    x *= dsp.adsr(n, 0.002, decay, 0.0, 0.08, n_s - 0.1, curve=3.0)
    return dsp.fade(x, 0.0005, 0.02)


def bell(midi, dur=1.6, seed=0):
    """2-operator FM bell (ratio 3.5), soft attack, for the variation motif + final echoes."""
    n = ns(dur)
    t = np.arange(n) / SR
    f = mtof(midi)
    idx = 2.2 * np.exp(-t / 0.25)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * idx
    car = np.sin(2 * np.pi * f * t + mod)
    x = car * np.exp(-t / 0.55) * (1 - np.exp(-t / 0.002))
    return dsp.fade(x, 0.0005, 0.1)


def sub_boom(dur=3.0, f_end=36.71, f_start=95.0, tau=0.9, seed=0):
    n = ns(dur)
    t = np.arange(n) / SR
    f = f_end + (f_start - f_end) * np.exp(-t / 0.09)
    x = dsp.sine(f, n) * np.exp(-t / tau)
    x = dsp.softclip(x * 1.8, 1.5)                # 2nd/3rd harmonics make it read on phones
    return dsp.fade(x, 0.0005, 0.4)


def noise_burst(dur=1.2, seed=0):
    n = ns(dur)
    t = np.arange(n) / SR
    x = dsp.noise(n, 800 + seed, ch=2)
    x = dsp.lp(x, 400 + 9000 * np.exp(-t / 0.08), 0.8)
    return dsp.fade(x * np.exp(-t / 0.22)[:, None], 0.0005, 0.2)


def riser(t0, t1, seed=0, f0=300, f1=9000, pitch=(50, 62), level=1.0):
    """Noise riser (rising band-pass) + pitched supersaw riser; hard stop at t1."""
    n = ns(t1 - t0)
    t = np.arange(n) / SR
    u = t / (t1 - t0)
    nz = dsp.noise(n, 900 + seed, ch=2)
    fc = f0 * (f1 / f0) ** (u ** 1.6)
    x = dsp.tv_biquad(nz, 'bp', fc, 1.4)
    x = x * (u ** 2.2)[:, None] * 1.3
    m = pitch[0] + (pitch[1] - pitch[0]) * u ** 1.8
    ss = dsp.supersaw(mtof(m), n, voices=5, detune_cents=25, seed=seed)
    ss = dsp.lp(ss, 500 + 5000 * u ** 2, 1.0) * (u ** 2.5)[:, None] * 0.5
    y = (x + ss) * level
    y[-ns(0.004):] *= np.linspace(1, 0, ns(0.004))[:, None]
    return y


def reverse_cymbal(dur=1.0, seed=0):
    c = crash(seed, dur)[::-1].copy()
    return dsp.fade(c, 0.05, 0.004)


# ============================================================================ arrangement
def sidechain_curve(kick_times, depth, rel_tau=0.085, hold=0.012):
    """Gain curve (per sample) that dips on every kick: 3 ms attack, hold, exponential release."""
    g = np.ones(N)
    L = ns(0.45)
    tt = np.arange(L) / SR
    shape = np.where(tt < 0.003, tt / 0.003, np.where(tt < 0.003 + hold, 1.0,
                     np.exp(-(tt - 0.003 - hold) / rel_tau)))
    shape = np.where(tt < 0.003, shape, shape * (tt < 0.45))
    for tk, dpt in kick_times:
        i = ns(tk)
        n = min(L, N - i)
        g[i:i + n] = np.minimum(g[i:i + n], 1 - dpt * depth * shape[:n])
    return g


def render():
    stems = {k: z() for k in ['kick', 'clap', 'roll', 'hats', 'perc', 'cymbal', 'bass', 'pad', 'arp', 'lead', 'drone',
                              'impact', 'riser', 'power', 'air']}
    kick_times = []           # (t, depth scale) for sidechain

    # ------------------------------------------------------------------ drums
    K_full, K_soft = kick(True), kick(False)
    for i in range(int(45 / BEAT)):
        t = i * BEAT
        if 4.0 <= t < 15.0:
            add_at(stems['kick'], K_soft, t, 0.62 + 0.25 * (t - 4) / 11)
            kick_times.append((t, 0.6))
        elif 16.0 <= t < 38.0:
            add_at(stems['kick'], K_full, t, 1.0)
            kick_times.append((t, 1.0))
    add_at(stems['kick'], K_full, 40.0, 1.0)
    kick_times.append((40.0, 1.0))

    claps = [clap(s) for s in range(4)]
    for b in range(2, 19):            # bars 3..19 (4..38 s)
        for beat in (1, 3):
            t = b * BAR + beat * BEAT
            if (4.0 <= t < 15.0) or (16.0 <= t < 38.0):
                v = 0.55 if t < 15 else 0.85
                add_at(stems['clap'], pan(claps[(b + beat) % 4], 0.0), t, v)

    hats_c = [hat(False, s) for s in range(6)]
    hat_o = hat(True, 0)
    acc = [0.45, 0.28, 1.0, 0.32]
    for i in range(int(45 / (BEAT / 4))):
        t = i * BEAT / 4
        q = i % 4
        if 4.0 <= t < 15.0:
            ramp = 0.45 + 0.55 * (t - 4) / 11
            if t < 8.0 and q in (1, 3):
                continue                    # 8ths only for the first two bars of the groove
            add_at(stems['hats'], pan(hats_c[i % 6], 0.25 if q % 2 else -0.1), t, 0.85 * acc[q] * ramp)
        elif 16.0 <= t < 38.0:
            if q == 2:
                add_at(stems['hats'], pan(hat_o, 0.15), t, 0.55 if t < 32 else 0.7)
            else:
                add_at(stems['hats'], pan(hats_c[i % 6], 0.3 if q % 2 else -0.15), t, 0.6 * acc[q])
            if t >= 24.0 and q in (1, 3):   # variation A: shaker layer
                add_at(stems['perc'], pan(shaker(i % 5), -0.45), t + 0.006, 0.45 if q == 1 else 0.3)
    rd = ride(0)
    for i in range(int(45 / BEAT)):     # variation B: ride on the beat from 32
        t = i * BEAT
        if 32.0 <= t < 38.0:
            add_at(stems['perc'], pan(rd, 0.4), t, 0.33 if (i % 2) else 0.25)

    # snare roll 15-16 (8ths -> 16ths -> 32nds), rising
    times = list(np.arange(15.0, 15.5, 0.125)) + list(np.arange(15.5, 15.75, 0.0625)) + list(np.arange(15.75, 16.0, 0.03125))
    for j, t in enumerate(times):
        u = (t - 15.0) / 1.0
        s = snare(j, tune=1.0 + 0.5 * u)
        s = dsp.butter(s, 'hp', 150 + 900 * u, 2)
        add_at(stems['roll'], pan(s, 0.2 * np.sin(j)), t, 0.18 + 0.7 * u ** 1.5)
    # light roll 39-40 into the final hit
    for j, t in enumerate(np.arange(39.0, 40.0, 0.0625)):
        u = (t - 39.0)
        add_at(stems['roll'], pan(dsp.butter(snare(j + 40, 1.2 + 0.4 * u), 'hp', 400 + 1500 * u, 2), 0.0), t, 0.04 + 0.3 * u ** 2)

    # tom fills + reverse cymbals into the variations
    for t0 in (23.5, 31.5):
        for j, m in enumerate([57, 52, 48, 45]):
            add_at(stems['perc'], pan(tom(m, j), -0.4 + 0.27 * j), t0 + j * 0.125, 0.45)
        add_at(stems['cymbal'], reverse_cymbal(1.0, int(t0)), t0 - 0.5, 0.25)
    for t0, g in ((16.0, 0.8), (24.0, 0.45), (32.0, 0.5), (40.0, 0.9)):
        add_at(stems['cymbal'], crash(int(t0), 3.0 if t0 == 40 else 2.4), t0, g)
    add_at(stems['cymbal'], reverse_cymbal(1.5, 3), 14.5, 0.35)
    add_at(stems['cymbal'], reverse_cymbal(2.0, 5), 38.0, 0.35)

    # ------------------------------------------------------------------ bass (8ths, pumping)
    for b in range(2, 19):
        ch = chord_at_bar(b)
        root = BASS_ROOT[ch]
        for e in range(8):
            t = b * BAR + e * BEAT / 2
            if 15.0 <= t < 16.0:
                continue
            drop = t >= 16.0
            m = root + (12 if (drop and e in (3, 6)) else 0)
            vel = (0.8 if e % 2 else 1.0) * (0.75 if not drop else 1.0)
            note = bass_note(m, 0.2, cut_peak=(1300 if drop else 700) * vel, cut_base=110 if drop else 90, seed=b * 8 + e)
            add_at(stems['bass'], pan(note, 0.0), t, vel)
    # breakdown sustained sub (C) + final sustained D
    for (t0, dur, m, g) in ((38.0, 2.0, 36, 0.5), (40.0, 4.5, 38, 0.45)):
        n = ns(dur + 0.5)
        tt = np.arange(n) / SR
        x = dsp.sine(mtof(m), n) + 0.25 * dsp.lp(dsp.saw(mtof(m), n), 300, 0.7)
        env = dsp.adsr(n, 0.3 if t0 == 38 else 0.004, 0.8, 0.6, 0.5, dur)
        add_at(stems['bass'], pan(x * env, 0), t0, g)

    # ------------------------------------------------------------------ pad (supersaw chords)
    pad = z()
    bars = [(b, chord_at_bar(b)) for b in range(0, 20)] + [(20, 'Dm9')]
    for b, ch in bars:
        t0 = b * BAR
        dur = BAR if b < 20 else 5.0
        n = ns(dur + 0.6)
        seg = np.zeros((n, 2))
        for j, m in enumerate(PAD_VOICING[ch]):
            ss = dsp.supersaw(mtof(m), n, voices=7, detune_cents=16, seed=b * 10 + j)
            seg += ss * (0.9 if j else 1.0)
        env = dsp.adsr(n, 0.09 if b else 0.02, 0.6, 0.85, 0.45, dur)
        seg *= env[:, None]
        add_at(pad, seg, t0 - (0.02 if b else 0.0))
    pad_cut = auto([(0, 140), (0.9, 1700), (3.8, 1500), (4.0, 1300), (14.8, 2600), (15.95, 5200),
                    (16.0, 1050), (37.9, 1250), (38.0, 1100), (39.95, 4800), (40.0, 3000), (42.0, 2000), (45.0, 900)], log=True)
    pad = dsp.lp(pad, pad_cut, 0.9)
    pad = dsp.hp(pad, 110, 0.7)
    pad_gain = auto([(0, 0.0), (0.05, 1.0), (3.9, 1.0), (4.0, 0.8), (15.0, 0.8), (16.0, 0.62), (38.0, 0.62), (39.95, 1.0), (40.0, 1.0), (45, 1.0)])
    stems['pad'] = pad * pad_gain[:, None]

    # ------------------------------------------------------------------ sub drone + power-on (intro)
    n = ns(5.0)
    tt = np.arange(n) / SR
    drone = dsp.sine(mtof(26), n) * 0.8 + dsp.lp(dsp.saw(mtof(38), n), 220, 0.8) * 0.35
    denv = np.minimum(1, tt / 0.02) * np.where(tt < 3.4, 1.0, np.exp(-(tt - 3.4) / 0.45))
    add_at(stems['drone'], pan(drone * denv, 0), 0.0, 1.0)
    # power-on: filtered saw octave glide D1 -> D3 with opening filter (0.0 - 0.9 s)
    n = ns(1.4)
    tt = np.arange(n) / SR
    glide = 26 + 24 * (1 - np.exp(-tt / 0.28))
    pw = dsp.supersaw(mtof(glide), n, voices=5, detune_cents=20, seed=77)
    pw = dsp.lp(pw, 90 + 3000 * (1 - np.exp(-tt / 0.35)) * np.exp(-np.maximum(tt - 0.6, 0) / 0.3), 2.5)
    pw *= (np.minimum(1, tt / 0.01) * np.exp(-np.maximum(tt - 0.5, 0) / 0.3))[:, None]
    add_at(stems['power'], pw, 0.0, 0.8)

    # ------------------------------------------------------------------ arp
    arp = z()
    pat = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 2]
    sparse = {0, 3, 6, 10, 12, 14}
    for i in range(int(45 / (BEAT / 4))):
        t = i * BEAT / 4
        b = int(t // BAR)
        q = i % 16
        if t >= 40.0:
            break
        ch = chord_at_bar(b)
        tones = ARP_TONES[ch]
        m = tones[pat[q]]
        if t < 4.0:
            if t < 0.5:
                continue
            cut = 380 + 350 * (t / 4.0)
            vel = 0.55 if q % 4 == 0 else 0.4
            note = pluck(m - 12 if q % 8 == 7 else m, cut, 2.0, 0.14)
        elif t < 16.0:
            u = (t - 4.0) / 12.0
            cut = 700 * (4.5 ** u) if t < 15.0 else 3200 + 2500 * (t - 15.0)
            vel = (0.6 if q % 4 == 0 else 0.42) * (0.9 + 0.3 * u) * 0.7
            note = pluck(m, cut, 2.2, 0.14 + 0.06 * u)
        elif t < 38.0:
            if q not in sparse:
                continue
            m2 = m + 12
            if t >= 32.0 and q in (6, 14):
                m2 += 0
            cut = 2600 if t < 24 else 3200
            vel = 0.5 if q in (0, 10) else 0.38
            note = dsp.hp(pluck(m2, cut, 1.8, 0.11), 650, 0.7)
        else:   # breakdown: full 16ths opening with the riser
            u = (t - 38.0) / 2.0
            cut = 900 * (6 ** u)
            vel = (0.45 + 0.35 * u) * 0.5
            note = pluck(m, cut, 2.5, 0.12 + 0.1 * u)
        pp = -0.35 if (i % 2) else 0.35
        add_at(arp, pan(note, pp * (0.4 if t < 16 else 1.0)), t, vel)
    # final echoes (Dm add9) at 40
    for j, (dt, m) in enumerate([(0.0, 74), (0.25, 81), (0.5, 76), (0.75, 77), (1.0, 81), (1.5, 74)]):
        add_at(arp, pan(pluck(m, 2600, 2.0, 0.2), [-0.4, 0.4][j % 2]), 40.0 + dt, 0.55 * (0.9 ** j))
    stems['arp'] = arp

    # ------------------------------------------------------------------ bell motif (variation @32 + outro)
    motif = [(32.0, 81), (32.75, 77), (33.5, 76), (34.0, 74), (34.75, 77), (35.5, 74),
             (36.0, 72), (36.75, 76), (37.5, 81)]
    for j, (t, m) in enumerate(motif):
        add_at(stems['lead'], pan(bell(m + 12, 1.4, j), 0.5 if j % 2 else -0.5), t, 0.35)
    for j, (t, m) in enumerate([(40.0, 74), (40.02, 81), (40.04, 88)]):
        add_at(stems['lead'], pan(bell(m, 3.0, 50 + j), (-0.5, 0.0, 0.5)[j]), t, 0.35)

    # ------------------------------------------------------------------ impacts / risers
    for t0, g in ((0.0, 0.9), (16.0, 0.9), (40.0, 0.8)):
        add_at(stems['impact'], pan(sub_boom(3.5 if t0 == 40 else 2.5, tau=0.6 if t0 == 40 else (0.5 if t0 == 0 else 0.38)), 0), t0, g)
        add_at(stems['impact'], noise_burst(1.2, int(t0)), t0, 0.35 * g)
    add_at(stems['riser'], riser(14.0, 16.0, 1, 250, 9000, (50, 62), 1.0), 14.0)
    add_at(stems['riser'], riser(38.0, 40.0, 2, 200, 10000, (48, 62), 0.8), 38.0)
    # air layer (intro + outro atmosphere)
    air = dsp.butter(dsp.noise(N, 999, ch=2), 'bp', [5000, 14000], 2)
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * T / 4.0)
    air_g = auto([(0, 0), (0.3, 1), (3.6, 1), (4.4, 0.0), (39.0, 0.0), (40.0, 1.2), (45, 1.2)]) * lfo
    stems['air'] += air * air_g[:, None]
    return stems, kick_times


# ============================================================================ mixdown
TARGET_LU = {   # relative loudness of each stem inside the drop window (16-38 s); kick = 0
    'kick': 0.0, 'bass': -1.5, 'clap': -8.5, 'hats': -11.0, 'perc': -17.0, 'cymbal': -16.0,
    'pad': -9.0, 'arp': -13.0, 'lead': -19.0,
}


def mixdown(stems, kick_times):
    drop = (T >= 16.0) & (T < 38.0)
    ref = dsp.lufs_integrated(stems['kick'], drop)
    gains = {}
    for k, tgt in TARGET_LU.items():
        mask = drop if k != 'lead' else ((T >= 32.0) & (T < 38.0))
        l = dsp.lufs_integrated(stems[k], mask)
        gains[k] = undb(ref + tgt - l) if np.isfinite(l) else 1.0
    # non-drop stems are set relative to pad/kick by hand
    gains['drone'] = gains['pad'] * 0.5
    st = {k: stems[k] * gains.get(k, 1.0) for k in stems}
    groove = dsp.lufs_integrated(sum(st[k] for k in TARGET_LU), drop)   # groove loudness in the drop

    def level(name, a, b, rel_lu):
        l = dsp.lufs_integrated(stems[name], (T >= a) & (T < b))
        gains[name] = undb(groove + rel_lu - l)
        st[name] = stems[name] * gains[name]
    level('impact', 16.0, 16.8, -1.5)      # drop hit: momentarily above the groove
    level('riser', 15.3, 16.0, -8.0)      # build peaks just under the drop
    level('roll', 15.5, 16.0, -11.0)
    level('power', 0.0, 1.0, -9.0)
    level('air', 40.5, 43.0, -26.0)
    sc_bass = sidechain_curve(kick_times, 0.85, 0.07)[:, None]
    sc_syn = sidechain_curve(kick_times, 0.55, 0.11)[:, None]
    sc_arp = sidechain_curve(kick_times, 0.3, 0.09)[:, None]

    ir_hall = dsp.make_ir(3.2, 3.0, 2.4, 0.9, 0.03, seed=11)
    ir_room = dsp.make_ir(1.1, 0.9, 0.8, 0.35, 0.008, seed=12)

    drums = st['kick'] + st['clap'] + st['roll'] + st['hats'] + st['perc'] + st['cymbal']
    drums += dsp.reverb(st['clap'] + 0.3 * st['perc'], ir_room, 0.35, 300, 8000)
    drums = dsp.compressor(drums, thr_db=-14, ratio=2.5, att=0.008, rel=0.12, knee_db=6)

    bass = dsp.hp(st['bass'], 32, 0.7) * sc_bass
    bass = dsp.biquad(bass, 'peak', 420, 1.0, -2.0)        # leave room for the voice's low-mids

    syn = st['pad'] * sc_syn + st['drone'] + (st['arp'] + st['lead']) * sc_arp
    # tempo-synced ping-pong: dotted 8th on the arp, quarter on the bells
    dly = dsp.pingpong(st['arp'], 0.375, 0.42, 7, 4200, 500) + dsp.pingpong(st['lead'], 0.5, 0.45, 6, 5000, 600, 'R')
    rev = dsp.reverb(st['pad'] * 0.35 + st['arp'] * 0.6 + st['lead'] * 0.9 + st['drone'] * 0.2, ir_hall, 0.55, 250, 7500)
    syn = syn + 0.45 * dly * sc_arp + rev * sc_syn

    # voice pocket: during 16-38 dip the synth bus 350 Hz-3.5 kHz (crossfaded, smooth)
    pocket = dsp.biquad(syn, 'peak', 1400, 0.55, -4.5)
    pocket = dsp.biquad(pocket, 'peak', 450, 1.0, -2.0)
    pk = auto([(0, 0.4), (3.5, 0.4), (4.0, 0.0), (15.9, 0.0), (16.0, 1.0), (37.9, 1.0), (39.2, 0.0), (45, 0.0)])[:, None]
    syn = syn * (1 - pk) + pocket * pk

    fx = st['impact'] + st['riser'] + st['power'] + st['air']
    fx = fx + dsp.reverb(st['impact'] + 0.5 * st['riser'] + st['power'], ir_hall, 0.3, 200, 6000)

    # macro dynamics: intro < groove < drop, breakdown dips then rises (dB automation)
    macro = undb(auto([(0, -5.0), (3.95, -5.0), (4.0, -3.5), (14.9, -2.0), (16.0, 0.0), (37.95, 0.0),
                       (38.0, -2.5), (39.9, -1.0), (40.0, 0.0), (45, 0.0)]))[:, None]
    mix = (drums + bass + syn) * macro + fx
    mix = dsp.butter(mix, 'hp', 28, 4)
    mix = dsp.biquad(mix, 'ls', 70, 0.7, -2.5)       # tame sub energy (phones can't use it; saves headroom)
    # fade 43.5 -> 45.0 (equal-power cosine)
    f = np.ones(N)
    m = T >= 43.5
    f[m] = np.cos((T[m] - 43.5) / 1.5 * np.pi / 2) ** 2
    mix *= f[:, None]
    # bus glue + level + true-peak-safe limiter
    mix = dsp.compressor(mix, thr_db=-16, ratio=1.8, att=0.02, rel=0.2, knee_db=8)
    L = dsp.lufs_integrated(mix)
    mix *= undb(-14.0 - L)
    print("pre-limit peak dBFS", float(dsp.db(np.max(np.abs(mix)))))
    _pk = np.max(np.abs(mix), axis=1); _hot = _pk > undb(-4.0)
    print("samples over clip thr: %.3f%%; per-second max dB:" % (100 * _hot.mean()), [(s, round(float(dsp.db(_pk[s * SR:(s + 1) * SR].max())), 1)) for s in range(45) if _pk[s * SR:(s + 1) * SR].max() > undb(-2)])
    mix = dsp.clipper(mix, -4.0)
    mix, gr = dsp.limiter(mix, -1.2, 0.004, 0.08)
    print('limiter GR: max %.1f dB, >1 dB %.1f%% of time' % (-dsp.db(gr.min()), 100 * np.mean(gr < undb(-1))))
    for k, v in list(st.items()):
        st[k] = v
    return mix, {k: float(20 * np.log10(v)) for k, v in gains.items()}


def main():
    os.makedirs(REP, exist_ok=True)
    stems, kick_times = render()
    mix, gains = mixdown(stems, kick_times)
    mix = mix[:N]
    dsp.save(os.path.join(OUT, 'music.wav'), mix, 'FLOAT')
    info = {'lufs': dsp.lufs_integrated(mix), 'peak_dbfs': float(dsp.db(np.max(np.abs(mix)))),
            'stem_gains_db': gains, 'samples': len(mix)}
    json.dump(info, open(os.path.join(REP, 'music_info.json'), 'w'), indent=1)
    print(json.dumps(info, indent=1))
    sections = [(0, 4, 'INTRO'), (4, 15, 'GROOVE'), (15, 16, 'BUILD'), (16, 24, 'DROP'), (24, 32, 'VAR A'),
                (32, 38, 'VAR B'), (38, 40, 'BRKDN'), (40, 45, 'OUTRO')]
    marks = [(0, 'impact'), (16, 'DROP'), (24, 'var'), (32, 'var'), (38, 'brk'), (40, 'final'), (43.5, 'fade')]
    dsp.report_png(os.path.join(REP, 'music.png'), mix, 'music.wav', marks, sections)
    if '--stems' in sys.argv:
        for k, v in stems.items():
            dsp.save(os.path.join(REP, f'stem_{k}.wav'), v, 'FLOAT')


if __name__ == '__main__':
    main()

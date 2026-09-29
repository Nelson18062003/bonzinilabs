"""PREMIUM score — warm, emotional, confident cinematic cue. Fully synthesized, seeded, deterministic.

90 BPM (beat 0.667 s, bar 2.667 s), D major.  16.00 s = bar 7 downbeat, 40.00 s = bar 16 downbeat.
  bars 1-2   (0.00-5.33)   felt piano (broken chords, quarters) + warm pad + low drone          D  A/C#
  bars 3-5   (5.33-13.33)  + 8th ostinato, soft pulse bass, soft kick from 8.00                 Bm G  D
  bar 6      (13.33-16.0)  A(sus) build: pad opens, riser + reverse cymbal, drums out at 15.33  A
  16.00      cinematic hit (boom + taiko + cymbal bloom)
  bars 7-14  (16.0-37.33)  chorus: strings, piano melody, pulse bass, kick / snap / shaker      Bm G D A  x2
                            (2nd pass from 26.67 adds a bell counter-line + high strings)
  bar 15     (37.33-40.0)  breakdown: drums out, Gmaj7 -> Asus4, swell + riser                   Gmaj7 Asus4
  40.00      final hit, D(add9) bloom, piano echo, bells; fade 43.4-45.0

Run:  nice -n 5 python3 lib/pmusic.py   -> out/music.wav (+ work/audio/music.png)
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp
from dsp import SR, N, ns, mtof, add_at, stereo, pan, undb

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(V, 'out')
REP = os.path.join(V, 'work', 'audio')
T = np.arange(N) / SR
BPM = 90.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
E8 = BEAT / 2


def bar_t(k, beat=0.0):
    return k * BAR + beat * BEAT


def auto(points, log=False):
    ts = np.array([p[0] for p in points], float)
    vs = np.array([p[1] for p in points], float)
    return np.exp(np.interp(T, ts, np.log(vs))) if log else np.interp(T, ts, vs)


def z():
    return np.zeros((N, 2))


# note names -> midi
NM = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}


def m(s):
    return 12 * (int(s[-1]) + 1) + NM[s[:-1]]


CHORDS = {   # pad / strings voicing, bass root, broken-chord ostinato (r 5 8 9 10 9 8 5)
    'D':     dict(v=['D3', 'A3', 'D4', 'F#4'], root='D2', ost=['D4', 'A4', 'D5', 'E5', 'F#5', 'E5', 'D5', 'A4']),
    'A/C#':  dict(v=['C#3', 'A3', 'C#4', 'E4'], root='C#2', ost=['C#4', 'A4', 'C#5', 'E5', 'A5', 'E5', 'C#5', 'A4']),
    'Bm':    dict(v=['B2', 'F#3', 'B3', 'D4'], root='B1', ost=['B3', 'F#4', 'B4', 'C#5', 'D5', 'C#5', 'B4', 'F#4']),
    'G':     dict(v=['G2', 'D3', 'G3', 'B3'], root='G1', ost=['G3', 'D4', 'G4', 'A4', 'B4', 'A4', 'G4', 'D4']),
    'A':     dict(v=['A2', 'E3', 'A3', 'C#4'], root='A1', ost=['A3', 'E4', 'A4', 'B4', 'C#5', 'B4', 'A4', 'E4']),
    'Asus':  dict(v=['A2', 'E3', 'A3', 'D4'], root='A1', ost=['A3', 'E4', 'A4', 'B4', 'D5', 'B4', 'A4', 'E4']),
    'Gmaj7': dict(v=['G2', 'D3', 'F#3', 'B3'], root='G1', ost=['G3', 'D4', 'F#4', 'A4', 'B4', 'A4', 'F#4', 'D4']),
    'Dadd9': dict(v=['D3', 'A3', 'E4', 'F#4', 'A4'], root='D2', ost=['D4', 'A4', 'D5', 'E5', 'F#5', 'E5', 'D5', 'A4']),
}
# one chord per bar (bar index -> chord); bar 14 splits Gmaj7 | Asus4
SONG = ['D', 'A/C#', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'D', 'A', 'Gmaj7', 'Dadd9', 'Dadd9']


# ============================================================================ instruments
def piano(midi, vel=0.6, dur=2.0, seed=0):
    """Additive felt piano: inharmonic partials, 2 detuned strings, two-stage decay, hammer, damper."""
    f0 = float(mtof(midi))
    n = ns(dur + 1.6)
    t = np.arange(n) / SR
    r = dsp.rng(1000 + seed + int(midi) * 7)
    Bc = 0.00018
    x = np.zeros(n)
    bright = 0.30 + 0.70 * vel
    for k in range(1, 20):
        fk = k * f0 * np.sqrt(1 + Bc * k * k)
        if fk > 11000:
            break
        amp = (1.0 / k ** 1.12) * np.exp(-(k - 1) * (1.15 - bright) * 0.45)
        tau1 = 0.55 / (1 + 0.45 * (k - 1)) * (262.0 / f0) ** 0.45
        tau2 = tau1 * 7.0
        env = 0.62 * np.exp(-t / tau1) + 0.38 * np.exp(-t / tau2)
        det = 1 + (r.random() - .5) * 0.0012
        ph1, ph2 = r.random() * 2 * np.pi, r.random() * 2 * np.pi
        x += amp * env * (np.sin(2 * np.pi * fk * t + ph1) + 0.7 * np.sin(2 * np.pi * fk * det * t + ph2)) / 1.7
    ham = dsp.butter(dsp.noise(n, 2000 + seed), 'bp', [300, 3000], 2) * np.exp(-t / 0.006) * 0.05 * vel
    x = x + ham
    x *= 1 - np.exp(-t / 0.0025)
    x *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.22))
    x = dsp.onepole_lp(x, 2600 + 6500 * vel)          # felt: softer when played softly
    x *= vel ** 1.3
    p = np.clip((midi - 62) / 30.0, -0.5, 0.5)         # low notes left, high notes right (player's view)
    return dsp.fade(pan(x, p), 0.0005, 0.05)


def strings(midis, dur, seed=0, attack=0.6, release=1.0, cut=2400.0, bright=1.0):
    """Ensemble 'strings' pad: supersaw per note, delayed vibrato, slow attack, lowpassed, stereo."""
    n = ns(dur + release + 0.3)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for j, mm in enumerate(midis):
        f = mtof(mm) * (1 + 0.0035 * np.sin(2 * np.pi * (5.1 + 0.3 * j) * t + j) * np.minimum(1, t / 0.9))
        out += dsp.supersaw(f, n, voices=6, detune_cents=11, seed=seed * 13 + j) * 0.8
        out += stereo(dsp.tri(mtof(mm) * 0.5, n)) * 0.18
    env = dsp.adsr(n, attack, 1.0, 0.9, release, dur, curve=2.0)
    out *= env[:, None]
    out = dsp.lp(out, cut * bright, 0.6)
    out = dsp.hp(out, 120, 0.7)
    return out / np.sqrt(len(midis))


def warm_pad(midis, dur, seed=0, attack=0.9, release=1.4, cut=900.0):
    n = ns(dur + release + 0.3)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for j, mm in enumerate(midis):
        f = mtof(mm)
        out += dsp.supersaw(f, n, voices=5, detune_cents=7, seed=seed * 7 + j) * 0.6
        out += pan(dsp.pulse(f, n, 0.35 + 0.1 * np.sin(2 * np.pi * 0.2 * t)), (-0.4, 0.4)[j % 2]) * 0.35
    env = dsp.adsr(n, attack, 1.0, 0.95, release, dur, curve=2.0)
    out *= env[:, None]
    out = dsp.lp(out, cut, 0.7)
    out = dsp.hp(out, 150, 0.6)
    return out / np.sqrt(len(midis))


def glass(midis, dur, seed=0):
    n = ns(dur + 1.2)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for j, mm in enumerate(midis):
        f = mtof(mm)
        trem = 0.8 + 0.2 * np.sin(2 * np.pi * (0.35 + 0.1 * j) * t + j)
        x = (dsp.tri(f, n, 0.1 * j) + 0.4 * dsp.sine(f * 2.001, n)) * trem
        out += pan(x, (-0.6, 0.0, 0.6)[j % 3])
    out *= dsp.adsr(n, 0.8, 1.0, 0.9, 1.0, dur, curve=2.0)[:, None]
    return dsp.lp(out, 7000, 0.6) / len(midis)


def pulse_bass(midi, dur=0.30, vel=1.0, cut=520.0):
    n = ns(dur + 0.12)
    t = np.arange(n) / SR
    f = mtof(midi)
    x = 0.6 * dsp.saw(f, n, 0.1) + 0.5 * dsp.sine(f, n, 0.25)
    x = dsp.lp(x, cut * (1 + 1.2 * np.exp(-t / 0.05)), 0.9)
    x *= dsp.adsr(n, 0.004, 0.18, 0.55, 0.06, dur, curve=3.0)
    return dsp.fade(dsp.softclip(x * 1.3 * vel, 1.1), 0.001, 0.01)


def sub(midi, dur, attack=0.05):
    n = ns(dur + 0.5)
    t = np.arange(n) / SR
    x = dsp.sine(mtof(midi), n) + 0.12 * dsp.sine(mtof(midi) * 2, n)
    return x * dsp.adsr(n, attack, 1.0, 0.95, 0.4, dur, curve=2.0)


def kick(seed=0):
    n = ns(0.5)
    t = np.arange(n) / SR
    f = 46.0 + 70.0 * np.exp(-t / 0.035)
    x = dsp.sine(f, n) * np.exp(-t / 0.20)
    x = dsp.softclip(x * 1.4, 1.2)
    x += dsp.butter(dsp.noise(n, 3000 + seed), 'bp', [900, 4000], 2) * np.exp(-t / 0.002) * 0.08
    return dsp.fade(x, 0.0005, 0.05)


def snap(seed=0):
    n = ns(0.35)
    t = np.arange(n) / SR
    x = dsp.butter(dsp.noise(n, 3100 + seed), 'bp', [1200, 7000], 2)
    env = np.exp(-t / 0.018) + 0.25 * np.exp(-t / 0.09)
    x = x * env + 0.3 * dsp.sine(210 * (1 + 0.3 * np.exp(-t / 0.01)), n) * np.exp(-t / 0.04)
    return dsp.fade(x, 0.0003, 0.05)


def shaker(seed=0):
    n = ns(0.13)
    t = np.arange(n) / SR
    env = (t / 0.02) ** 2 * np.exp(-t / 0.03)
    env /= env.max()
    return dsp.fade(dsp.butter(dsp.noise(n, 3200 + seed), 'bp', [5000, 11000], 2) * env, 0.001, 0.01)


def bell(midi, dur=2.2, seed=0):
    n = ns(dur)
    t = np.arange(n) / SR
    f = mtof(midi)
    idx = 1.3 * np.exp(-t / 0.3)
    x = np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * f * 3.0 * t) * idx)
    x = x * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.002))
    x += 0.2 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.35)
    return dsp.fade(x, 0.0005, 0.2)


def boom(settle_midi, dur=3.5, tau=0.9):
    n = ns(dur)
    t = np.arange(n) / SR
    fe = float(mtof(settle_midi))
    f = fe + (fe * 2.4 - fe) * np.exp(-t / 0.07)
    x = dsp.sine(f, n) * np.exp(-t / tau)
    x = dsp.softclip(x * 1.5, 1.3)
    return dsp.fade(x, 0.0005, 0.5)


def taiko(seed=0):
    n = ns(1.4)
    t = np.arange(n) / SR
    f = 72 + 40 * np.exp(-t / 0.03)
    x = dsp.sine(f, n) * np.exp(-t / 0.35)
    x += dsp.butter(dsp.noise(n, 3300 + seed), 'bp', [80, 700], 2) * np.exp(-t / 0.06) * 0.8
    x += dsp.butter(dsp.noise(n, 3301 + seed), 'bp', [700, 3000], 2) * np.exp(-t / 0.012) * 0.3
    return dsp.fade(dsp.softclip(x * 1.2, 1.1), 0.0005, 0.2)


def cymbal(dur=3.5, seed=0, bright=1.0):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    r = dsp.rng(3400 + seed)
    for ch in range(2):
        fr = r.uniform(3000, 10000, 20)
        metal = sum(dsp.sine(f, n, r.random()) for f in fr) / 20
        x = 0.3 * metal + dsp.noise(n, 3410 + seed + ch)
        x = dsp.butter(x, 'hp', 3000, 2)
        x = dsp.onepole_lp(x, 7000 * bright)
        out[:, ch] = x * (0.2 * np.exp(-t / 0.04) + 0.8 * np.exp(-t / 1.1))
    return dsp.fade(out, 0.001, 0.4)


def swell(t0, t1, seed=0, f0=250.0, f1=6000.0):
    """Soft rising noise swell (band-pass sweep) that stops exactly at t1."""
    n = ns(t1 - t0)
    t = np.arange(n) / SR
    u = t / (t1 - t0)
    x = dsp.tv_biquad(dsp.noise(n, 3500 + seed, ch=2), 'bp', f0 * (f1 / f0) ** (u ** 1.5), 0.9)
    x *= (u ** 2.4)[:, None]
    x[-ns(0.01):] *= np.linspace(1, 0, ns(0.01))[:, None]
    return x


# ============================================================================ arrangement
def sidechain(kicks, depth, rel=0.16):
    g = np.ones(N)
    L = ns(0.6)
    tt = np.arange(L) / SR
    shape = np.where(tt < 0.005, tt / 0.005, np.exp(-(tt - 0.005) / rel))
    for tk in kicks:
        i = ns(tk)
        k = min(L, N - i)
        g[i:i + k] = np.minimum(g[i:i + k], 1 - depth * shape[:k])
    return g


def render():
    st = {k: z() for k in ['piano', 'melody', 'strings', 'pad', 'glass', 'bass', 'sub', 'kick', 'snap', 'shaker', 'bells', 'hits', 'cym', 'swell']}
    kicks = []

    # ---------------------------------------------------------------- piano: broken chords
    for k in range(0, 15):
        ch = SONG[k]
        if k == 14:          # breakdown bar: Gmaj7 (beats 0-2) | Asus4 (beats 2-4), held
            for b0, c in ((0, 'Gmaj7'), (2, 'Asus')):
                for j, nn in enumerate(CHORDS[c]['v'][1:] + [CHORDS[c]['ost'][4]]):
                    add_at(st['piano'], piano(m(nn), 0.42, 2 * BEAT, 90 + b0 + j), bar_t(k, b0) + 0.012 * j, 1.0)
                add_at(st['piano'], piano(m(CHORDS[c]['root']) + 12, 0.5, 2 * BEAT, 95 + b0), bar_t(k, b0), 1.0)
            continue
        ost = [m(x) for x in CHORDS[ch]['ost']]
        root = m(CHORDS[ch]['root']) + 12
        # left hand: root on 1 (and fifth on 3 in the chorus)
        add_at(st['piano'], piano(root, 0.50 if k < 6 else 0.58, BAR * (0.5 if k >= 6 else 1.0), k * 10), bar_t(k), 1.0)
        if k >= 6:
            add_at(st['piano'], piano(root + 7, 0.45, BAR * 0.5, k * 10 + 1), bar_t(k, 2), 1.0)
        if k < 2:            # intro: quarters, very soft
            for q in range(4):
                idx = [0, 2, 4, 2][q]
                add_at(st['piano'], piano(ost[idx], 0.38 + 0.06 * (q == 0), BEAT * 1.6, k * 10 + 2 + q), bar_t(k, q) + 0.004, 1.0)
        else:                # 8th ostinato
            vel0 = 0.34 if k < 6 else 0.30
            for e in range(8):
                if k == 5 and e >= 6:
                    continue          # breath before the hit
                acc = 1.12 if e in (0, 4) else (0.9 if e % 2 else 1.0)
                add_at(st['piano'], piano(ost[e], vel0 * acc, E8 * 1.8, k * 10 + 3 + e), bar_t(k, e * .5) + 0.003 * (e % 2), 1.0)

    # final D(add9) chord at 40.00: low octave + open voicing, let ring
    for j, nn in enumerate(['D2', 'D3', 'A3', 'D4', 'F#4', 'A4', 'E5']):
        add_at(st['piano'], piano(m(nn), 0.62 if j < 2 else 0.5, 4.2, 700 + j), 40.0 + 0.018 * j, 1.0)

    # ---------------------------------------------------------------- piano melody (chorus + outro)
    MEL = {
        6: [(0, 'F#5', 1.5), (1.5, 'E5', .5), (2, 'D5', 1), (3, 'C#5', 1)],
        7: [(0, 'D5', 1.5), (1.5, 'B4', .5), (2, 'D5', 1), (3, 'E5', 1)],
        8: [(0, 'F#5', 1.5), (1.5, 'A5', .5), (2, 'F#5', 1), (3, 'E5', 1)],
        9: [(0, 'E5', 2), (2, 'C#5', 1), (3, 'A4', 1)],
        10: [(0, 'F#5', 1.5), (1.5, 'E5', .5), (2, 'D5', 1), (3, 'F#5', 1)],
        11: [(0, 'G5', 1.5), (1.5, 'F#5', .5), (2, 'E5', 1), (3, 'D5', 1)],
        12: [(0, 'F#5', 1), (1, 'E5', 1), (2, 'D5', 1), (3, 'A5', 1)],
        13: [(0, 'A5', 2), (2, 'G5', 1), (3, 'E5', 1)],
        14: [(0, 'D5', 2), (2, 'E5', 2)],
        15: [(0, 'F#5', 2), (2, 'A5', 1), (3, 'E5', 1)],
        16: [(0, 'D5', 3)],
    }
    for k, notes in MEL.items():
        for j, (b, nn, d) in enumerate(notes):
            v = 0.62 if b == 0 else 0.52
            if k >= 15:
                v *= 0.9
            x = piano(m(nn), v, d * BEAT * 1.05, 500 + k * 10 + j)
            add_at(st['melody'], x, bar_t(k, b), 1.0)
            if k >= 10:              # octave doubling (soft) in the 2nd chorus / outro
                add_at(st['melody'], piano(m(nn) + 12, v * 0.55, d * BEAT, 600 + k * 10 + j), bar_t(k, b) + 0.006, 0.6)

    # ---------------------------------------------------------------- pad + strings
    for k in range(0, 16):
        ch = SONG[k]
        t0 = bar_t(k)
        if k == 14:
            for b0, c, d in ((0, 'Gmaj7', 2 * BEAT), (2, 'Asus', 2 * BEAT)):
                add_at(st['pad'], warm_pad([m(x) for x in CHORDS[c]['v']], d, k * 3 + b0, 0.25, 0.9, 1200), bar_t(k, b0), 1.0)
                add_at(st['strings'], strings([m(x) + 12 for x in CHORDS[c]['v'][1:]], d, k * 3 + b0, 0.35, 0.9, 3200), bar_t(k, b0), 1.0)
            continue
        dur = BAR if k < 15 else 45.0 - 40.0
        vo = [m(x) for x in CHORDS[ch]['v']]
        add_at(st['pad'], warm_pad(vo, dur, k, 0.9 if k == 0 else 0.35, 1.2 if k >= 15 else 0.7, 1300), t0 - (0 if k == 0 else 0.03), 1.0)
        if k < 6 or k >= 15:  # glass: soft high chord tones (air) in the intro / verse and the outro
            add_at(st['glass'], glass([x + 24 for x in vo[-3:]], dur, k), t0, 1.0)
        if k >= 6:
            hi = [x + 12 for x in vo[1:]]
            if k >= 10:
                hi = hi + [vo[-1] + 24]
            add_at(st['strings'], strings(hi, dur, k, 0.45 if k != 6 else 0.08, 1.4 if k >= 15 else 0.8,
                                          2600 if k < 10 else 3400), t0 - (0 if k in (6, 15) else 0.04), 1.0)
        elif k >= 3:          # verse: low, soft strings enter
            add_at(st['strings'], strings(vo[1:], dur, k, 0.8, 0.8, 1600), t0 - 0.04, 0.55)

    # ---------------------------------------------------------------- bass / sub
    for k in range(0, 16):
        ch = SONG[k] if k != 14 else 'Gmaj7'
        r = m(CHORDS[ch]['root'])
        t0 = bar_t(k)
        if k == 14:
            add_at(st['sub'], sub(r, 2 * BEAT, 0.2), t0, 0.7)
            add_at(st['sub'], sub(m('A1'), 2 * BEAT, 0.1), bar_t(k, 2), 0.8)
            continue
        add_at(st['sub'], sub(r, BAR if k < 15 else 5.0, 0.4 if k == 0 else 0.04), t0, 0.55 if k < 6 else (0.8 if k < 15 else 0.45))
        if 2 <= k <= 13:
            for e in range(8):
                tt = bar_t(k, e * .5)
                if k == 5 and e >= 4:
                    continue
                if k < 6 and e % 2:
                    vel = 0.5
                else:
                    vel = 0.8 if e % 2 else 1.0
                add_at(st['bass'], pulse_bass(r + 12, E8 * 0.9, vel, 420 if k < 6 else 600), tt, 0.7 if k < 6 else 1.0)

    # ---------------------------------------------------------------- drums
    K = kick()
    for k in range(3, 14):
        for b in (0, 2):
            tt = bar_t(k, b)
            if k == 5 and b == 2:
                continue
            g = 0.55 if k < 6 else 1.0
            add_at(st['kick'], stereo(K), tt, g)
            kicks.append(tt)
        if 4 <= k < 6:        # verse: a whisper of shaker
            for e in range(8):
                if k == 5 and e >= 4:
                    continue
                add_at(st['shaker'], pan(shaker(k * 8 + e), 0.35), bar_t(k, e * .5) + 0.004, 0.45 if e % 2 else 0.25)
        if k >= 6:
            add_at(st['kick'], stereo(K), bar_t(k, 3.5), 0.45)          # soft pickup
            kicks.append(bar_t(k, 3.5))
            for b in (1, 3):
                add_at(st['snap'], pan(snap(k * 4 + b), 0.05), bar_t(k, b), 1.0)
            for e in range(8):
                add_at(st['shaker'], pan(shaker(k * 8 + e), 0.35), bar_t(k, e * .5) + 0.004, 0.9 if e % 2 else 0.55)
    add_at(st['kick'], stereo(K), 40.0, 1.0)
    kicks.append(40.0)

    # ---------------------------------------------------------------- hits, cymbals, swells
    for tt, root, g in ((16.0, 'B1', 1.0), (40.0, 'D2', 1.0)):
        add_at(st['hits'], stereo(boom(m(root), 3.6, 0.8 if tt == 16 else 1.1)), tt, g)
        add_at(st['hits'], pan(taiko(int(tt)), 0.0), tt, 0.8 * g)
        add_at(st['hits'], pan(taiko(int(tt) + 1), -0.3), tt + BEAT * 0.5, 0.25 * g)
        add_at(st['cym'], cymbal(4.0 if tt == 40 else 3.2, int(tt)), tt, 0.9)
    for t0, t1, s in ((14.00, 16.0, 1), (37.60, 40.0, 2)):
        rc = cymbal(t1 - t0, 10 + s)[::-1].copy()
        rc *= np.linspace(0, 1, len(rc))[:, None] ** 1.2
        rc[-ns(0.004):] *= np.linspace(1, 0, ns(0.004))[:, None]
        add_at(st['cym'], rc, t0, 0.8)
        add_at(st['swell'], swell(t0, t1, s), t0, 1.0)
    for k in (8, 10, 12):                                           # soft crashes on phrase starts
        add_at(st['cym'], cymbal(2.4, 40 + k, 0.8), bar_t(k), 0.25)

    # ---------------------------------------------------------------- bells: counter-line (2nd chorus) + outro sparkle
    CL = [(10, 2.5, 'B5'), (10, 3.5, 'A5'), (11, 2.5, 'D6'), (11, 3.5, 'B5'), (12, 2.5, 'A5'), (12, 3.5, 'F#5'), (13, 2.5, 'E6'), (13, 3.5, 'C#6')]
    for j, (k, b, nn) in enumerate(CL):
        add_at(st['bells'], pan(bell(m(nn), 2.0, j), (-0.45, 0.45)[j % 2]), bar_t(k, b), 0.55)
    for j, (b, nn) in enumerate([(0, 'D6'), (0.5, 'A6'), (1.0, 'F#6'), (1.5, 'E6'), (2.5, 'A6'), (3.5, 'D7')]):
        add_at(st['bells'], pan(bell(m(nn), 2.6, 50 + j), (-0.5, 0.5)[j % 2]), 40.0 + b * BEAT, 0.6 * 0.88 ** j)
    return st, kicks


TARGET = {   # relative loudness inside the chorus window (16-37.3 s); piano+melody = 0
    'melody': 0.0, 'piano': -3.0, 'strings': -2.5, 'pad': -8.5, 'bass': -4.5, 'sub': -9.5,
    'kick': -6.0, 'snap': -14.0, 'shaker': -17.0, 'bells': -8.0, 'glass': -8.5,
}


def mixdown(st, kicks):
    ch = (T >= 16.2) & (T < 37.3)
    ref = dsp.lufs_integrated(st['melody'], ch)
    gains = {}
    for k, tgt in TARGET.items():
        mask = ch if k not in ('bells', 'glass') else (((T >= 26.6) & (T < 37.3)) if k == 'bells' else ((T >= 0.5) & (T < 13.3)))
        L = dsp.lufs_integrated(st[k], mask)
        gains[k] = float(undb(ref + tgt - L)) if np.isfinite(L) else 1.0
    s = {k: st[k] * gains.get(k, 1.0) for k in st}
    body = dsp.lufs_integrated(sum(s[k] for k in TARGET), ch)

    def level(name, a, b, rel):
        L = dsp.lufs_integrated(st[name], (T >= a) & (T < b))
        gains[name] = float(undb(body + rel - L))
        s[name] = st[name] * gains[name]
    level('hits', 16.0, 16.8, 0.5)
    level('cym', 15.2, 16.0, -9.0)
    level('swell', 15.0, 16.0, -9.0)

    sc_b = sidechain(kicks, 0.55)[:, None]
    sc_p = sidechain(kicks, 0.22, 0.22)[:, None]
    hall = dsp.make_ir(3.6, 3.4, 2.8, 1.2, 0.035, seed=31, bright=0.8)
    room = dsp.make_ir(1.2, 1.0, 0.8, 0.4, 0.01, seed=32)

    keys = s['piano'] + s['melody']
    keys = keys + dsp.reverb(keys, hall, 0.42, 200, 7000) + 0.25 * dsp.pingpong(s['melody'], BEAT * .75, 0.35, 5, 4000, 500)
    syn = (s['pad'] + s['strings']) * sc_p + s['glass'] + dsp.reverb(s['glass'], hall, 0.5, 600, 9000)
    syn = syn + dsp.reverb(s['strings'] * 0.6 + s['pad'] * 0.3, hall, 0.45, 250, 6500) * sc_p
    bells = s['bells'] + dsp.reverb(s['bells'], hall, 0.7, 400, 9000) + 0.35 * dsp.pingpong(s['bells'], BEAT, 0.4, 5, 6000, 800)
    low = dsp.hp(s['bass'], 35, 0.7) * sc_b + s['sub']
    drums = s['kick'] + s['snap'] + s['shaker']
    drums = drums + dsp.reverb(s['snap'] + 0.4 * s['shaker'], room, 0.4, 300, 8000)
    fx = s['hits'] + s['cym'] + s['swell']
    fx = fx + dsp.reverb(s['hits'] * 0.5 + s['cym'] * 0.4 + s['swell'] * 0.5, hall, 0.4, 150, 6000)

    macro = undb(auto([(0, 1.5), (5.2, 1.5), (5.4, 1.0), (13.3, 1.0), (15.9, 0.5), (16.0, 0.0), (26.6, 0.0),
                       (26.7, 0.6), (37.2, 0.6), (37.4, -2.0), (39.95, -0.5), (40.0, 0.5), (45, 0.5)]))[:, None]
    mix = (keys + syn + bells + low + drums) * macro + fx
    mix = dsp.butter(mix, 'hp', 30, 4)
    mix = dsp.biquad(mix, 'ls', 70, 0.7, -2.0)
    f = np.ones(N)
    mm = T >= 43.4
    f[mm] = np.cos((T[mm] - 43.4) / 1.6 * np.pi / 2) ** 2
    mix *= f[:, None]
    mix = dsp.compressor(mix, thr_db=-18, ratio=1.6, att=0.03, rel=0.25, knee_db=8)
    mix *= undb(-15.0 - dsp.lufs_integrated(mix))
    mix = dsp.clipper(mix, -3.0)
    mix, gr = dsp.limiter(mix, -1.5, 0.004, 0.1)
    print('limiter max GR %.1f dB' % (-dsp.db(gr.min())))
    return mix, {k: round(float(20 * np.log10(v)), 1) for k, v in gains.items()}


def main():
    os.makedirs(REP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    st, kicks = render()
    mix, gains = mixdown(st, kicks)
    mix = mix[:N]
    dsp.save(os.path.join(OUT, 'music.wav'), mix, 'FLOAT')
    info = {'lufs': dsp.lufs_integrated(mix), 'peak_dbfs': float(dsp.db(np.max(np.abs(mix)))), 'gains_db': gains}
    json.dump(info, open(os.path.join(REP, 'music_info.json'), 'w'), indent=1)
    print(json.dumps(info, indent=1))
    secs = [(0, 5.33, 'INTRO'), (5.33, 13.33, 'VERSE'), (13.33, 16, 'BUILD'), (16, 26.67, 'CHORUS 1'), (26.67, 37.33, 'CHORUS 2'),
            (37.33, 40, 'BRKDN'), (40, 45, 'OUTRO')]
    dsp.report_png(os.path.join(REP, 'music.png'), mix, 'premium music.wav (90 BPM, D major)', [(16.0, 'HIT'), (40.0, 'HIT')], secs)
    if '--stems' in sys.argv:
        for k, v in st.items():
            dsp.save(os.path.join(REP, f'stem_{k}.wav'), v, 'FLOAT')


if __name__ == '__main__':
    main()

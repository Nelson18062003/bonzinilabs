"""Sound-design stem for the reel (UI / HUD sounds, impacts, whooshes) — synthesized, seeded.

Every cue is a small synth function placed at an exact timeline time (see CUES at the bottom).
Tonal cues are in D minor (D, E, F, G, A, Bb, C). Levels are dB relative to the big impacts.

Run:  nice -n 5 python3 lib/sfx.py      -> out/sfx.wav (48 kHz stereo float, 45.000 s)
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, N, ns, mtof, add_at, stereo, pan, undb

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(R, 'out')
REP = os.path.join(OUT, 'audio_report')

D6, E6, F6, G6, A6, A5, D7, F7, A7 = 86, 88, 89, 91, 93, 81, 98, 101, 105


def tt(n):
    return np.arange(n) / SR


def layer(*parts):
    """Sum (signal, gain[, offset_s]) parts of different lengths into one stereo buffer."""
    L = max(len(p[0]) + (ns(p[2]) if len(p) > 2 else 0) for p in parts)
    buf = np.zeros((L, 2))
    for p in parts:
        add_at(buf, stereo(p[0]), p[2] if len(p) > 2 else 0.0, p[1])
    return buf


# ----------------------------------------------------------------------------- building blocks
def impact(big=1.0, seed=0, tail=1.6):
    """Cinematic hit: tight low thump + crack transient + debris air (stereo). Sub kept moderate
    because the music carries its own tuned sub boom on the same beats."""
    n = ns(tail + 0.4)
    t = tt(n)
    f = 73.42 + 90 * np.exp(-t / 0.035)          # settles on D2 (in key with the music's sub)
    thump = dsp.softclip(dsp.sine(f, n) * np.exp(-t / (0.22 * big)) * 1.6, 1.3)
    crack = dsp.butter(dsp.noise(n, seed + 1), 'bp', [900, 6500], 2) * np.exp(-t / 0.012)
    body = dsp.butter(dsp.noise(n, seed + 2), 'bp', [120, 900], 2) * np.exp(-t / 0.07)
    x = pan(0.9 * thump + 0.5 * crack + 0.6 * body, 0.0)
    debris = dsp.butter(dsp.noise(n, seed + 3, ch=2), 'hp', 2500, 2) * (np.exp(-t / (0.35 * big)) * (1 - np.exp(-t / 0.01)))[:, None] * 0.12
    return dsp.fade(x + debris, 0.0003, 0.3)


def chirp(f0, f1, dur, seed=0, crush=True):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    f = f0 * (f1 / f0) ** (u ** 0.7)
    x = dsp.sine(f * (1 + 0.01 * np.sin(2 * np.pi * 38 * t)), n)
    x += 0.25 * dsp.pulse(f * 0.5, n, 0.3)
    if crush:
        x = 0.7 * x + 0.3 * dsp.bitcrush(x, 5, 3)
    x = dsp.butter(x, 'lp', 9000, 2)
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 0.6
    return dsp.fade(x * env, 0.002, 0.01)


def scan_sweep(dur=0.5, f0=700, f1=9000, seed=0, p0=-0.8, p1=0.8):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    fc = f0 * (f1 / f0) ** u
    x = dsp.tv_biquad(dsp.noise(n, seed), 'bp', fc, 3.5)
    x += 0.15 * dsp.sine(fc * 0.5, n)
    env = np.sin(np.pi * u) ** 1.5
    return pan(x * env, p0 + (p1 - p0) * u)


def tick(seed, f=None, dur=0.006):
    r = dsp.rng(seed)
    n = ns(dur)
    t = tt(n)
    f = f or r.uniform(2800, 6200)
    x = dsp.sine(f, n) * np.exp(-t / 0.0012) + 0.3 * dsp.noise(n, seed) * np.exp(-t / 0.0005)
    return pan(dsp.fade(x, 0.0001, 0.001), r.uniform(-0.7, 0.7))


def ticks(t0, t1, rate, seed, level=1.0, fr=(2800, 6200)):
    """Stream of tiny data ticks with jittered timing (stereo buffer placed at t0)."""
    r = dsp.rng(seed)
    n = ns(t1 - t0 + 0.05)
    buf = np.zeros((n, 2))
    t = 0.0
    k = 0
    while t < t1 - t0:
        add_at(buf, tick(seed * 100 + k, r.uniform(*fr)), t, level * r.uniform(0.5, 1.0))
        t += r.exponential(1.0 / rate) + 0.012
        k += 1
    return buf


def glitch(dur, seed, hp_fc=1800, level=1.0, fall=False):
    """Digital chatter: 5-22 ms slices of crushed square/noise/tone with random pan + gaps."""
    r = dsp.rng(seed)
    n = ns(dur)
    out = np.zeros((n, 2))
    pos = 0
    while pos < n:
        L = int(r.uniform(0.005, 0.022) * SR)
        L = min(L, n - pos)
        kind = r.integers(0, 4)
        u = pos / n
        if kind == 0:
            f = r.choice([587, 880, 1175, 1760, 2349, 3520]) * (1 - 0.6 * u if fall else 1)
            s = dsp.pulse(f, L, r.uniform(0.2, 0.5))
        elif kind == 1:
            s = dsp.noise(L, int(r.integers(1e6)))
        elif kind == 2:
            s = dsp.sine(r.uniform(1500, 6000) * (1 - 0.5 * u if fall else 1), L)
        else:
            s = np.zeros(L)
        s = dsp.bitcrush(s, int(r.integers(3, 6)), int(r.integers(2, 10)))
        s = dsp.fade(s, 0.0004, 0.0006) if L > 60 else s
        out[pos:pos + L] += pan(s * r.uniform(0.4, 1.0), r.uniform(-0.8, 0.8))
        pos += L
    out = dsp.butter(out, 'hp', hp_fc, 2)
    out = dsp.butter(out, 'lp', 11000, 2)
    env = np.minimum(1, tt(n) / 0.004) * np.minimum(1, (dur - tt(n)) / 0.02)
    if fall:
        env *= np.linspace(1, 0.3, n)
    return out * env[:, None] * level


def beep(midi, dur=0.06, seed=0, bright=0.2):
    n = ns(dur + 0.25)
    t = tt(n)
    f = mtof(midi)
    x = dsp.sine(f, n) + bright * dsp.pulse(f, n, 0.5) * 0.3
    x = dsp.butter(x, 'lp', 6000, 2)
    env = np.minimum(1, t / 0.003) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.035))
    return dsp.fade(x * env, 0.0005, 0.02)


def click(seed=0):
    n = ns(0.05)
    t = tt(n)
    x = dsp.butter(dsp.noise(n, seed), 'bp', [2000, 9000], 2) * np.exp(-t / 0.0015)
    x += 0.5 * dsp.sine(160 * (1 + np.exp(-t / 0.004)), n) * np.exp(-t / 0.012)
    return dsp.fade(x, 0.0001, 0.005)


def bell(midi, dur=1.4, idx=1.6, ratio=3.5, tau=0.45):
    n = ns(dur)
    t = tt(n)
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.18)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0015))
    x += 0.25 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / (tau * 0.5))
    return dsp.fade(x, 0.0003, 0.1)


def whoosh(dur, peak_at=0.55, f_lo=350, f_hi=4200, p0=-0.6, p1=0.6, seed=0, rumble=0.4):
    """Air whoosh: band-passed noise with a bell-shaped cutoff/level trajectory and a pan move."""
    n = ns(dur)
    t = tt(n)
    u = t / dur
    shape = np.exp(-((u - peak_at) / 0.22) ** 2)
    fc = f_lo + (f_hi - f_lo) * shape
    nz = dsp.noise(n, seed)
    x = dsp.tv_biquad(nz, 'bp', fc, 0.9) * shape ** 1.2
    x += rumble * dsp.butter(dsp.noise(n, seed + 1), 'lp', 260, 2) * shape ** 2
    p = p0 + (p1 - p0) * (1 / (1 + np.exp(-(u - peak_at) * 9)))
    y = pan(x, p)
    return dsp.fade(y, 0.01, 0.03)


def reverse_swell(dur=1.0, seed=0, ir=None):
    """Reverse-reverb swell that peaks exactly at the end of `dur` (to hit the next downbeat)."""
    n = ns(dur)
    src = np.zeros(n)
    k = ns(0.12)
    src[:k] = dsp.noise(k, seed) * np.exp(-tt(k) / 0.03)
    tone = sum(dsp.sine(mtof(m), k) for m in (62, 69, 74, 76)) * np.exp(-tt(k) / 0.05) * 0.4
    src[:k] += tone
    wet = dsp.reverb(src, ir, 1.0, 300, 9000)[:n]
    y = wet[::-1].copy()
    y *= (np.linspace(0, 1, n) ** 1.5)[:, None]
    y[-ns(0.003):] *= np.linspace(1, 0, ns(0.003))[:, None]
    return y


def shimmer(dur, seed, notes=(D7, F7, A7, 100, 93, 96), density=14, level=1.0):
    r = dsp.rng(seed)
    n = ns(dur + 1.2)
    buf = np.zeros((n, 2))
    k = int(density * dur)
    for j in range(k):
        t0 = (j / k) * dur + r.uniform(0, dur / k)
        m = notes[r.integers(len(notes))]
        b = bell(m, 0.9, idx=0.8, ratio=2.0, tau=0.25)
        add_at(buf, pan(b, r.uniform(-0.8, 0.8)), t0, level * r.uniform(0.35, 0.8) * (1 - 0.4 * j / k))
    return buf


# ----------------------------------------------------------------------------- the cue sheet
def render():
    ir_small = dsp.make_ir(0.9, 0.7, 0.6, 0.3, 0.006, seed=21)
    ir_big = dsp.make_ir(3.0, 2.6, 2.2, 0.9, 0.025, seed=22)
    dry = np.zeros((N, 2))      # to small room
    wet = np.zeros((N, 2))      # to big hall (sent in addition to the dry signal)

    def put(sig, t, gain_db, send_big=0.0, send_small=0.25):
        g = undb(gain_db)
        s = stereo(sig)
        add_at(dry, s, t, g)
        if send_big:
            add_at(wet, s, t, g * send_big)
        if send_small:
            add_at(wet_small, s, t, g * send_small)

    wet_small = np.zeros((N, 2))
    cues = []

    def cue(t, name):
        cues.append((round(t, 3), name))

    # 0.00 deep impact + digital power-on chirp
    put(impact(1.2, 10, 2.0), 0.0, 0.0, 0.5); cue(0.0, 'impact')
    put(pan(chirp(220, 2600, 0.32, 1), -0.2), 0.03, -12, 0.25, 0.3); cue(0.03, 'power-on chirp')
    put(pan(beep(D7, 0.05, 1, 0.1), 0.3), 0.36, -18, 0.3); cue(0.36, 'power-on blip')
    # 0.05-0.55 scan sweep
    put(scan_sweep(0.5, 700, 9000, 3, -0.8, 0.8), 0.05, -16, 0.2); cue(0.05, 'scan sweep')
    # 0.2-0.6 data ticks
    put(ticks(0.2, 0.6, 35, 4), 0.2, -18, 0.0, 0.3); cue(0.2, 'data ticks')
    # title decrypt glitch bursts + lock
    for j, t in enumerate((0.40, 1.94, 2.46)):
        put(glitch(0.16, 40 + j, 2200, 1.0), t, -15, 0.15); cue(t, 'decrypt glitch')
    lock = layer((pan(click(5), 0), 0.9), (pan(beep(D6, 0.03, 5, 0.0), 0), 0.25), (pan(bell(D6, 0.9, 1.2, 3.5, 0.3), 0.1), 0.35))
    put(lock, 2.90, -9, 0.35); cue(2.9, 'title lock')
    # 3.25-3.45 glitch-out
    put(glitch(0.2, 50, 1500, 1.0, fall=True), 3.25, -14, 0.1); cue(3.25, 'glitch-out')
    # 3.7-4.2 target lock-on: 3 rising beeps + click
    for j, (t, m) in enumerate(((3.70, D6), (3.85, F6), (4.00, A6))):
        put(pan(beep(m, 0.05, j, 0.25), 0.1), t, -14 + j, 0.2); cue(t, 'lock beep')
    put(pan(click(6), 0.0), 4.20, -11, 0.15); cue(4.2, 'lock click')
    # 5.4-7.7 soft data ticks
    put(ticks(5.4, 7.6, 7, 7, fr=(3000, 5200)), 5.4, -11, 0.0, 0.4); cue(5.4, 'soft ticks')
    # 7.70 arrival confirm chime (A5 - D6 - A6 over C chord)
    ch = np.zeros((ns(2.0), 2))
    for j, (dt, m) in enumerate(((0.0, A5), (0.06, D6), (0.12, A6))):
        add_at(ch, pan(bell(m, 1.6, 1.4, 3.0, 0.5), (-0.3, 0.0, 0.3)[j]), dt, (0.9, 0.8, 0.6)[j])
    put(ch, 7.70, -13, 0.45); cue(7.7, 'arrival chime')
    # 9.96 soft UI panel whoosh
    put(whoosh(0.4, 0.45, 900, 4500, -0.3, 0.3, 8, 0.0), 9.86, -11, 0.15); cue(9.96, 'panel whoosh')
    # 12.0-12.9 whip-pan whoosh L -> R
    put(whoosh(0.9, 0.47, 300, 3800, -0.95, 0.95, 9, 0.5), 12.0, -8, 0.2); cue(12.0, 'whip whoosh')
    # 14.92 soft shield ping
    sp = layer((pan(bell(D6, 1.6, 0.7, 2.0, 0.55), -0.15), 1.0), (pan(bell(D6 + 12, 1.2, 0.5, 2.0, 0.35), 0.15), 0.3))
    put(sp, 14.92, -14, 0.5); cue(14.92, 'shield ping')
    # 16.00 transition: reverse whoosh in, impact, glitch burst, whoosh out
    put(layer((reverse_swell(0.5, 12, ir_small), 0.8), (whoosh(0.5, 0.97, 600, 6000, -0.4, 0.2, 13, 0.2), 1.0)), 15.5, -12); cue(15.5, 'suck-in')
    put(impact(1.0, 20, 1.6), 16.0, -1.5, 0.45); cue(16.0, 'impact')
    put(glitch(0.28, 60, 1200, 1.0), 16.0, -17, 0.2); cue(16.0, 'glitch burst')
    put(whoosh(0.6, 0.25, 500, 4000, 0.3, -0.5, 14, 0.3), 16.02, -18, 0.25); cue(16.02, 'whoosh out')
    # 16.2 UI blip, 21.7 UI pop
    put(pan(beep(A6, 0.03, 15, 0.1), 0.25), 16.2, -16, 0.15); cue(16.2, 'blip')
    n = ns(0.12); t = tt(n)
    pop = dsp.sine(1300 * np.exp(-t / 0.02) + 650, n) * np.exp(-t / 0.03)
    put(layer((pan(dsp.fade(pop, 0.0003, 0.02), -0.15), 1.0), (pan(click(16), 0), 0.4)), 21.7, -6, 0.15); cue(21.7, 'UI pop')
    # 23.9 check-mark ding (D6 -> A6)
    ding = pan(bell(D6, 1.2, 1.0, 3.5, 0.35), -0.15)
    add_at(ding, pan(bell(A6, 1.4, 1.0, 3.5, 0.45), 0.15), 0.09, 0.9)
    put(ding, 23.9, -12, 0.4); cue(23.9, 'check ding')
    # 25.8 card-open whoosh + radar pings
    put(whoosh(0.4, 0.55, 800, 5000, -0.4, 0.2, 17, 0.1), 25.7, -13, 0.2); cue(25.8, 'card whoosh')
    for j, t in enumerate((26.2, 27.2)):
        n = ns(1.4); x = dsp.sine(mtof(A5) * (1 + 0.004 * np.exp(-tt(n) / 0.05)), n) * np.exp(-tt(n) / 0.28) * (1 - np.exp(-tt(n) / 0.004))
        x = pan(dsp.fade(x, 0.0005, 0.1), (-0.2, 0.2)[j])
        x = x + 0.6 * dsp.pingpong(x, 0.25, 0.35, 4, 5000, 400)
        put(x, t, -13, 0.5); cue(t, 'radar ping')
    # 33.0 small blip
    put(pan(beep(D7, 0.025, 33, 0.1), 0.2), 33.0, -10, 0.2); cue(33.0, 'blip')
    # 38.2 shimmer on "confiance"
    put(shimmer(0.7, 38, level=1.0), 38.2, -15, 0.6); cue(38.2, 'shimmer')
    # 39.0 reverse swell into 40.00
    put(reverse_swell(1.0, 39, ir_big), 39.0, -3); cue(39.0, 'reverse swell')
    # 40.00 big impact + shimmer
    put(impact(1.4, 40, 2.4), 40.0, -3.0, 0.6); cue(40.0, 'impact')
    put(shimmer(1.0, 41, (D7, E6 + 12, F7, A7, 105, 110), 16, 1.0), 40.02, -16, 0.7); cue(40.02, 'shimmer')
    # 40.3-41.2 text decrypt ticks, 41.4 blip
    put(ticks(40.3, 41.2, 28, 40, fr=(2500, 7000)), 40.3, -16, 0.0, 0.3); cue(40.3, 'decrypt ticks')
    put(glitch(0.1, 70, 2500, 0.6), 40.3, -22, 0.1)
    put(pan(beep(A6, 0.035, 41, 0.1), 0.0), 41.4, -10, 0.3); cue(41.4, 'blip')

    y = dry + dsp.reverb(wet, ir_big, 0.6, 250, 8000) + dsp.reverb(wet_small, ir_small, 0.5, 400, 10000)
    y = dsp.dc_block(y, 20)
    # SFX never needs sub: keep < 40 Hz clean
    y = dsp.butter(y, 'hp', 35, 2)
    return y, cues


def main():
    os.makedirs(REP, exist_ok=True)
    y, cues = render()
    # normalise so the loudest impact peaks at -3 dBFS (true-peak-ish); mix sets the final level
    pk = dsp.true_peak_env(y).max()
    y = y * undb(-3.0) / pk
    y = y[:N]
    dsp.save(os.path.join(OUT, 'sfx.wav'), y, 'FLOAT')
    json.dump({'cues': cues, 'lufs': dsp.lufs_integrated(y)}, open(os.path.join(REP, 'sfx_cues.json'), 'w'), indent=1)
    dsp.report_png(os.path.join(REP, 'sfx.png'), y, 'sfx.wav', [(t, n) for t, n in cues])
    print('sfx lufs', dsp.lufs_integrated(y), 'cues', len(cues))


if __name__ == '__main__':
    main()

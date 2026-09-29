"""HOLOGRAMME sound design: holographic shimmers, data chirps, soft sonar pings, scan hums, de-rez /
re-form sweeps, projector power-up and "materialise" swell. Tonal cues in F minor. Synthesized, seeded.

Run:  nice -n 5 python3 lib/sfx.py      -> out/sfx.wav (+ out/audio_report/sfx_cues.json)
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, N, ns, mtof, add_at, stereo, pan, undb

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(V, 'out')
REP = os.path.join(OUT, 'audio_report')
PENTA = [77, 80, 82, 84, 87, 89, 92, 94, 96, 99]      # F minor pentatonic (F Ab Bb C Eb), octaves 5-7


def tt(n):
    return np.arange(n) / SR


def impact(seed=0, tail=1.8, big=1.0):
    n = ns(tail + 0.4)
    t = tt(n)
    f = 43.65 * 2 + 110 * np.exp(-t / 0.03)                   # settles on F2
    thump = dsp.softclip(dsp.sine(f, n) * np.exp(-t / (0.2 * big)) * 1.6, 1.3)
    crack = dsp.butter(dsp.noise(n, seed + 1), 'bp', [1500, 9000], 2) * np.exp(-t / 0.01)
    x = pan(0.9 * thump + 0.45 * crack, 0.0)
    glassy = np.zeros((n, 2))
    for j, m in enumerate((89, 96, 101)):
        g = glass(m, 1.6, 2.4, 2.76, 0.5)
        add_at(glassy, pan(g, (-.6, .6, 0)[j]), 0.0, 0.25)
    return dsp.fade(x + glassy, 0.0003, 0.3)


def glass(midi, dur=0.5, idx=1.2, ratio=2.0, tau=0.15):
    n = ns(dur)
    t = tt(n)
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.04)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0015))
    return dsp.fade(x, 0.0003, 0.02)


def shimmer(dur, seed, notes=PENTA[4:], density=22, level=1.0, rise=True):
    """Holographic shimmer: cloud of tiny glass grains with tremolo, optionally rising in pitch."""
    r = dsp.rng(seed)
    n = ns(dur + 0.6)
    buf = np.zeros((n, 2))
    k = max(3, int(density * dur))
    for j in range(k):
        u = j / k
        t0 = u * dur + r.uniform(0, dur / k)
        pool = notes[int(u * (len(notes) - 2)):] if rise else notes
        m = pool[r.integers(len(pool))]
        g = glass(m, 0.35, 0.8, 2.0, 0.08 + 0.06 * r.random())
        env = np.sin(np.pi * np.clip(u + 0.05, 0, 1)) ** 0.7
        add_at(buf, pan(g, r.uniform(-0.85, 0.85)), t0, level * env * r.uniform(0.4, 1.0))
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * 17 * tt(n))
    return buf * trem[:, None]


def chirp(f0, f1, dur, seed=0, p=0.0):
    """Data chirp: short FM sine sweep."""
    n = ns(dur)
    t = tt(n)
    u = t / dur
    f = f0 * (f1 / f0) ** u
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph + 0.8 * np.sin(ph * 1.5))
    x *= np.sin(np.pi * u) ** 0.5
    return pan(dsp.fade(x, 0.001, 0.004), p)


def data_burst(dur, rate, seed, fr=(2200, 7000), level=1.0):
    r = dsp.rng(seed)
    buf = np.zeros((ns(dur + 0.1), 2))
    t = 0.0
    while t < dur:
        f0 = r.uniform(*fr)
        f1 = f0 * r.choice([0.6, 1.5, 2.0])
        add_at(buf, chirp(f0, f1, r.uniform(0.012, 0.035), 0, r.uniform(-0.8, 0.8)), t, level * r.uniform(0.4, 1.0))
        t += r.exponential(1.0 / rate) + 0.01
    return buf


def tick(seed, f=3500):
    n = ns(0.01)
    t = tt(n)
    x = dsp.sine(f, n) * np.exp(-t / 0.0012) + 0.25 * dsp.noise(n, seed) * np.exp(-t / 0.0005)
    return dsp.fade(x, 0.0001, 0.001)


def sonar(midi, seed=0, tau=0.5):
    n = ns(1.8)
    t = tt(n)
    f = mtof(midi) * (1 + 0.012 * np.exp(-t / 0.03)) * (1 - 0.01 * (1 - np.exp(-t / 0.4)))
    x = dsp.sine(f, n) * np.exp(-t / tau) * (1 - np.exp(-t / 0.003))
    x += 0.2 * dsp.sine(f * 2.01, n) * np.exp(-t / (tau * 0.4))
    x = pan(dsp.fade(x, 0.0005, 0.2), 0.0)
    return x + 0.55 * dsp.pingpong(x, 0.25, 0.4, 5, 4500, 400)


def scan_hum(dur, seed=0, f0=500, f1=3500, p0=-0.5, p1=0.5):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    fc = f0 * (f1 / f0) ** u
    x = dsp.tv_biquad(dsp.noise(n, seed), 'bp', fc, 5.0) * 1.5
    hum = sum(dsp.sine(mtof(m) * (1 + 0.003 * np.sin(2 * np.pi * 5 * t + m)), n) for m in (65, 72, 77)) / 3
    x = x + 0.35 * hum * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t))
    env = np.sin(np.pi * u) ** 1.2
    return pan(x * env, p0 + (p1 - p0) * u)


def power_down(dur=0.3, seed=0):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    f = 2400 * (0.08 ** u)
    x = dsp.sine(f, n) * (1 - u) ** 1.5 + 0.3 * dsp.bitcrush(dsp.sine(f * 0.5, n), 4, 6) * (1 - u) ** 2
    return pan(dsp.fade(x, 0.001, 0.01), 0.0)


def derez(dur, seed=0):
    """De-rez: descending crushed sweep + voxel crackle (builds to the end)."""
    n = ns(dur)
    t = tt(n)
    u = t / dur
    f = 3000 * (0.12 ** u)
    x = dsp.bitcrush(dsp.pulse(f, n, 0.3), 3 + int(0), 8) * 0.4
    x = dsp.butter(x, 'hp', 300, 2)
    r = dsp.rng(seed)
    crack = np.zeros(n)
    for k in range(int(260 * dur)):
        i = int(r.uniform(0, n - 200)); L = int(r.uniform(20, 200))
        crack[i:i + L] += r.uniform(-1, 1) * (i / n) ** 1.5
    crack = dsp.butter(crack, 'hp', 2000, 2)
    y = pan(x * u ** 1.2, -0.3) + pan(crack * 0.6, 0.3)
    return y


def reform(seed=0):
    """Re-form after the cut: fast rising glass arpeggio + chirps (0.45 s)."""
    buf = np.zeros((ns(1.4), 2))
    for j, m in enumerate(PENTA[:9]):
        add_at(buf, pan(glass(m + 12, 0.4, 1.0, 2.0, 0.1), -0.8 + 0.2 * j), j * 0.045, 0.5 + 0.05 * j)
    add_at(buf, data_burst(0.45, 40, seed, (3000, 9000), 0.5), 0.0)
    return buf


def whoosh(dur, peak_at=0.5, f_lo=350, f_hi=4200, p0=-0.6, p1=0.6, seed=0):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    shape = np.exp(-((u - peak_at) / 0.22) ** 2)
    x = dsp.tv_biquad(dsp.noise(n, seed), 'bp', f_lo + (f_hi - f_lo) * shape, 0.9) * shape ** 1.2
    p = p0 + (p1 - p0) / (1 + np.exp(-(u - peak_at) * 9))
    return dsp.fade(pan(x, p), 0.01, 0.03)


def chime(notes, seed=0, spacing=0.07):
    buf = np.zeros((ns(2.5), 2))
    for j, m in enumerate(notes):
        add_at(buf, pan(glass(m, 1.8, 1.4, 3.5, 0.55), (-0.3, 0.3, 0.0)[j % 3]), j * spacing, 1.0 - 0.15 * j)
    n = ns(0.3)
    add_at(buf, pan(dsp.sine(87.3 * (1 + np.exp(-tt(n) / 0.01)), n) * np.exp(-tt(n) / 0.06), 0), 0.0, 0.5)
    return buf


def power_up(dur, seed=0):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    f = 43.65 * 2 * (1 + 1.0 * u ** 2)
    x = sum(dsp.sine(f * h, n) / h for h in (1, 2, 3, 4, 6))
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(4 + 26 * u ** 2) / SR)
    x = x * trem * u ** 1.5
    x = dsp.lp(x, 300 + 4000 * u ** 2, 1.2)
    y = pan(x, 0.0)
    y[-ns(0.004):] *= np.linspace(1, 0, ns(0.004))[:, None]
    return y


def reverse_swell(dur, ir, seed=0, notes=(65, 72, 77, 80, 84)):
    n = ns(dur)
    k = ns(0.2)
    src = np.zeros(n)
    t = tt(k)
    src[:k] = sum(np.sin(2 * np.pi * mtof(m) * t) for m in notes) * np.exp(-t / 0.06) * 0.3 + dsp.noise(k, seed) * np.exp(-t / 0.03) * 0.4
    y = dsp.reverb(src, ir, 1.0, 300, 9000)[:n][::-1].copy()
    y *= (np.linspace(0, 1, n) ** 1.5)[:, None]
    y[-ns(0.003):] *= np.linspace(1, 0, ns(0.003))[:, None]
    return y


def render():
    ir_s = dsp.make_ir(0.9, 0.7, 0.6, 0.3, 0.006, seed=41)
    ir_b = dsp.make_ir(3.4, 3.0, 2.5, 1.0, 0.03, seed=42)
    dry = np.zeros((N, 2)); wet_b = np.zeros((N, 2)); wet_s = np.zeros((N, 2))
    cues = []

    def put(sig, t, gain_db, big=0.0, small=0.25, name=None):
        g = undb(gain_db)
        s = stereo(sig)
        add_at(dry, s, t, g)
        if big: add_at(wet_b, s, t, g * big)
        if small: add_at(wet_s, s, t, g * small)
        if name: cues.append((round(t, 3), name))

    # 0.00 impact + hologram boot (slices assembling)
    put(impact(10, 2.0, 1.2), 0.0, 0.0, 0.5, name='impact')
    put(shimmer(0.6, 1, PENTA[3:], 40, 1.0), 0.02, -12, 0.4, name='boot shimmer')
    put(data_burst(0.6, 45, 2, (1800, 8000), 1.0), 0.03, -19, 0.0, 0.3, name='boot data')
    put(scan_hum(0.62, 3, 400, 6000, -0.2, 0.2), 0.02, -20, 0.2, name='scan')
    # typing of the hook label (on the spoken words) - soft ticks
    for j, t in enumerate((0.0, 0.4, 0.9, 1.72)):
        for c in range(4):
            put(pan(tick(j * 10 + c, 3000 + 400 * c), 0.2), t + 0.04 * c + 0.2 * (j == 0), -24)
    # 1.94 BONZINI line-art build, 2.2 fill scan, 2.46 TRADING CARGO, 2.9 lock
    put(shimmer(0.45, 5, PENTA[2:], 30, 1.0), 1.94, -8, 0.4, name='line-art shimmer')
    put(whoosh(0.45, 0.6, 1500, 7000, -0.3, 0.3, 6), 2.18, -22, 0.2, name='fill scan')
    put(shimmer(0.35, 7, PENTA[4:], 30, 0.8), 2.46, -11, 0.4, name='line-art shimmer 2')
    put(chime((84, 89), 8, 0.06), 2.9, -15, 0.4, name='title lock')
    put(power_down(0.25, 9), 3.22, -18, 0.2, name='title power-off')
    # 3.6 wireframe container build + scan plane
    put(data_burst(0.55, 30, 11, (2500, 8000), 1.0), 3.62, -12, 0.0, 0.3, name='wireframe data')
    put(scan_hum(0.8, 12, 400, 3000, -0.4, 0.4), 3.85, -13, 0.2, name='scan plane')
    put(sonar(84, 13, 0.35), 4.3, -12, 0.3, name='route ping')
    put(data_burst(2.0, 4, 14, (3000, 6000), 0.7), 5.4, -18, 0.0, 0.3, name='soft data')
    # 7.70 ARRIVÉ ✓
    put(chime((84, 89, 96), 15, 0.07), 7.70, -11, 0.45, name='arrival confirm')
    put(power_down(0.35, 16), 9.6, -13, 0.2, name='module off')
    put(shimmer(0.4, 17, PENTA[3:], 25, 0.8), 9.96, -11, 0.3, name='module on')
    # 10.9-15.0 parcels landing: pentatonic data blips, very soft
    for k in range(36):
        ta = 10.9 + k * 4.1 / 36
        m = PENTA[(k * 3) % 7] + 12
        put(pan(glass(m, 0.12, 0.6, 2.0, 0.03), -0.4 + 0.8 * ((k * 5) % 7) / 6), ta + 0.2, -19)
    cues.append((10.9, 'parcel blips'))
    # 12.0 whip pan
    put(whoosh(0.95, 0.47, 300, 3800, -0.95, 0.95, 18), 12.0, -9, 0.2, name='whip whoosh')
    put(data_burst(0.6, 35, 19, (1500, 5000), 0.8), 12.2, -22, 0.0, 0.2, name='tear crackle')
    # 14.92 shield
    put(sonar(89, 20, 0.6), 14.92, -9, 0.5, name='shield ping')
    # 15.55-16.0 de-rez, 16.00 impact, re-form
    put(derez(0.45, 21), 15.55, -14, 0.2, name='de-rez')
    put(reverse_swell(0.5, ir_s, 22), 15.5, -14, name='suck-in')
    put(impact(23, 1.8, 1.0), 16.0, -1.5, 0.45, name='impact')
    put(reform(24), 16.0, -13, 0.3, name='re-form')
    put(pan(glass(89, 0.3, 0.8, 2.0, 0.06), 0.3), 16.12, -18, 0.2, name='badge blip')
    put(shimmer(0.55, 25, PENTA[2:], 26, 0.8), 16.2, -14, 0.35, name='header line-art')
    put(power_down(0.3, 26), 21.2, -14, 0.2, name='header off')
    put(shimmer(0.4, 27, PENTA[3:], 25, 0.8), 21.66, -11, 0.3, name='module on')
    # 22.0-24.2 grid scan + detections + check
    put(scan_hum(2.2, 28, 300, 2500, -0.3, 0.3), 22.0, -15, 0.2, name='grid scan')
    for j, t in enumerate((22.25, 23.55)):
        put(data_burst(0.3, 50, 30 + j, (3000, 8000), 1.0), t, -14, 0.0, 0.3, name='detection')
    put(chime((80, 87, 92), 32, 0.07), 22.95, -12, 0.45, name='check confirm')
    put(shimmer(0.4, 33, PENTA[5:], 20, 0.7), 24.70, -13, 0.4, name='sécurité shimmer')
    put(power_down(0.3, 34), 25.45, -15, 0.2, name='module off')
    # 25.72 location card, pin, sonar rings
    put(shimmer(0.5, 35, PENTA[3:], 25, 0.8), 25.72, -12, 0.3, name='card on')
    put(pan(glass(84, 0.4, 1.5, 3.5, 0.1), 0.0), 25.9, -11, 0.3, name='pin pop')
    for j, t in enumerate((26.2, 27.2, 29.2, 31.88, 33.2)):
        put(sonar(89 if t != 31.88 else 96, 40 + j, 0.45), t, -10 if t != 31.88 else -7, 0.5, name='sonar ping')
    put(chime((89, 96), 46, 0.06), 33.5, -11, 0.35, name='chip confirm')
    put(power_down(0.3, 47), 34.35, -15, 0.2, name='module off')
    # 38.2 confiance shimmer
    put(shimmer(0.9, 48, PENTA[4:], 22, 1.0), 38.2, -9, 0.6, name='confiance shimmer')
    # 39.05 projector power-up -> 40.00 impact, scan rise, 41.15 materialise
    put(power_up(0.95, 49), 39.05, -5, 0.3, name='projector power-up')
    put(reverse_swell(1.0, ir_b, 50), 39.0, 0, name='reverse swell')
    put(impact(51, 2.4, 1.4), 40.0, -3.0, 0.6, name='impact')
    put(scan_hum(0.55, 52, 600, 9000, 0.0, 0.0), 40.0, -16, 0.3, name='scan rise')
    put(shimmer(0.5, 53, PENTA[2:], 30, 0.9), 40.3, -13, 0.4, name='name line-art')
    put(reverse_swell(0.45, ir_s, 54, (77, 84, 89, 96)), 40.95, -5, name='materialise swell')
    put(chime((77, 84, 89, 96), 55, 0.05), 41.4, -7, 0.6, name='materialise bloom')
    for c in range(12):
        put(pan(tick(200 + c, 2800 + 150 * (c % 5)), 0.1), 41.6 + c * 0.045, -26)
    put(pan(glass(89, 0.3, 0.8, 2.0, 0.06), 0.0), 42.15, -12, 0.3, name='blip')
    put(pan(glass(96, 0.3, 0.8, 2.0, 0.06), 0.0), 42.6, -12, 0.3, name='blip')
    put(shimmer(0.6, 56, PENTA[5:], 18, 0.6), 42.6, -15, 0.5, name='logo sweep')

    y = dry + dsp.reverb(wet_b, ir_b, 0.6, 250, 8000) + dsp.reverb(wet_s, ir_s, 0.5, 400, 10000)
    y = dsp.butter(dsp.dc_block(y, 20), 'hp', 35, 2)
    return y, cues


def main():
    os.makedirs(REP, exist_ok=True)
    y, cues = render()
    y = y * undb(-3.0) / dsp.true_peak_env(y).max()
    y = y[:N]
    dsp.save(os.path.join(OUT, 'sfx.wav'), y, 'FLOAT')
    json.dump({'cues': sorted(cues), 'lufs': dsp.lufs_integrated(y)}, open(os.path.join(REP, 'sfx_cues.json'), 'w'), indent=1)
    print('sfx lufs', dsp.lufs_integrated(y), 'cues', len(cues))


if __name__ == '__main__':
    main()

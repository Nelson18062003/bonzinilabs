"""UI sound design for the explainer — synthesized, seeded, every cue placed from data/timeline.json.

Canonical events (see SPEC): chapter start = whoosh + soft hit; title-card slam at ch.start + 0.15
(numbered chapters s1..s6, lighter card pop for other titled chapters except the brand); soft tuned pops
on flagged (`emph`) narration words, sparingly (>= 1.5 s apart, <= 2 per segment, never on top of another
cue); ship-horn swell at 'bateau', truck rumble at 'camion', check ding at 'déchargés', secure chime at
every 'sécurité', radar pings around 'Balengou', 6 rising blips on the recap's step words, shimmer at
'confiance', logo lock at the brand's 'Bonzini' and the big logo impact at the last VO segment (V11).
Tonal cues are in F major (the score's key).

Run:  nice -n 5 python3 lib/audio/sfx.py  -> out/sfx.wav (+ out/audio_report/sfx_cues.json, sfx.png)
"""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import dsp
import tl as tlmod
from dsp import SR, ns, mtof, add_at, stereo, pan, undb

E = tlmod.E
OUT = os.path.join(E, 'out')
REP = os.path.join(OUT, 'audio_report')
# F major pentatonic, high register
F5, G5, A5, C6, D6, F6, G6, A6, C7, D7, F7 = 77, 79, 81, 84, 86, 89, 91, 93, 96, 98, 101


def tt(n):
    return np.arange(n) / SR


def layer(*parts):
    L = max(len(p[0]) + (ns(p[2]) if len(p) > 2 else 0) for p in parts)
    buf = np.zeros((L, 2))
    for p in parts:
        add_at(buf, stereo(p[0]), p[2] if len(p) > 2 else 0.0, p[1])
    return buf


# ----------------------------------------------------------------------------- building blocks
def impact(big=1.0, seed=0, tail=1.6, f_end=87.31):
    """Hit: tuned low thump (F2) + crack transient + body + airy debris."""
    n = ns(tail + 0.4)
    t = tt(n)
    f = f_end + 80 * np.exp(-t / 0.035)
    thump = dsp.softclip(dsp.sine(f, n) * np.exp(-t / (0.2 * big)) * 1.5, 1.3)
    crack = dsp.butter(dsp.noise(n, seed + 1), 'bp', [900, 6000], 2) * np.exp(-t / 0.01)
    body = dsp.butter(dsp.noise(n, seed + 2), 'bp', [150, 900], 2) * np.exp(-t / 0.06)
    x = pan(0.9 * thump + 0.35 * crack + 0.5 * body, 0.0)
    debris = dsp.butter(dsp.noise(n, seed + 3, ch=2), 'hp', 3000, 2) * (np.exp(-t / (0.3 * big)) * (1 - np.exp(-t / 0.01)))[:, None] * 0.1
    return dsp.fade(x + debris, 0.0003, 0.3)


def soft_hit(seed=0, f_end=87.31):
    """Chapter-start hit: rounded thump + felt click + short air, no harsh crack."""
    n = ns(0.9)
    t = tt(n)
    f = f_end + 60 * np.exp(-t / 0.03)
    thump = dsp.sine(f, n) * np.exp(-t / 0.13)
    felt = dsp.butter(dsp.noise(n, seed), 'bp', [400, 2500], 2) * np.exp(-t / 0.012)
    air = dsp.butter(dsp.noise(n, seed + 1, ch=2), 'hp', 4000, 2) * (np.exp(-t / 0.18) * (1 - np.exp(-t / 0.006)))[:, None]
    return dsp.fade(pan(thump + 0.3 * felt, 0) + 0.08 * air, 0.0003, 0.2)


def whoosh(dur, peak_at=0.75, f_lo=350, f_hi=4200, p0=-0.6, p1=0.6, seed=0, rumble=0.3):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    shape = np.exp(-((u - peak_at) / 0.2) ** 2)
    shape[u > peak_at] = np.exp(-((u[u > peak_at] - peak_at) / 0.12) ** 2)
    fc = f_lo + (f_hi - f_lo) * shape
    x = dsp.tv_biquad(dsp.noise(n, seed), 'bp', fc, 0.9) * shape ** 1.2
    x += rumble * dsp.butter(dsp.noise(n, seed + 1), 'lp', 260, 2) * shape ** 2
    p = p0 + (p1 - p0) * (1 / (1 + np.exp(-(u - peak_at) * 9)))
    return dsp.fade(pan(x, p), 0.01, 0.03)


def click(seed=0):
    n = ns(0.05)
    t = tt(n)
    x = dsp.butter(dsp.noise(n, seed), 'bp', [2000, 8000], 2) * np.exp(-t / 0.0015)
    x += 0.5 * dsp.sine(170 * (1 + np.exp(-t / 0.004)), n) * np.exp(-t / 0.012)
    return dsp.fade(x, 0.0001, 0.005)


def slam(seed=0):
    """Title-card slam: punchy low-mid thud + snap transient + short bright metal 'shing'."""
    n = ns(0.7)
    t = tt(n)
    thud = dsp.sine(70 + 110 * np.exp(-t / 0.018), n) * np.exp(-t / 0.075)
    snapx = dsp.butter(dsp.noise(n, seed), 'bp', [1500, 7000], 2) * np.exp(-t / 0.006)
    shing = dsp.butter(dsp.noise(n, seed + 1, ch=2), 'bp', [3500, 9000], 2) * (np.exp(-t / 0.09) * (1 - np.exp(-t / 0.004)))[:, None]
    ring = sum(dsp.sine(mtof(m), n) for m in (F6, C7)) * np.exp(-t / 0.12) * 0.12
    return dsp.fade(pan(dsp.softclip(thud * 1.4, 1.2) + 0.35 * snapx + ring, 0) + 0.18 * shing, 0.0003, 0.15)


def pop(midi, seed=0):
    """Soft tuned UI pop (bubble): fast upward pitch blip + tiny click."""
    n = ns(0.16)
    t = tt(n)
    f = mtof(midi) * (0.75 + 0.25 * (1 - np.exp(-t / 0.012)))
    x = dsp.sine(f, n) * np.exp(-t / 0.035) * (1 - np.exp(-t / 0.0015))
    c = click(seed)
    x[:len(c)] += 0.12 * c
    return dsp.fade(x, 0.0003, 0.02)


def bell(midi, dur=1.4, idx=1.4, ratio=3.5, tau=0.45):
    n = ns(dur)
    t = tt(n)
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * ratio * t) * idx * np.exp(-t / 0.18)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau) * (1 - np.exp(-t / 0.0015))
    x += 0.25 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / (tau * 0.5))
    return dsp.fade(x, 0.0003, 0.1)


def check_ding(seed=0):
    """Check-mark: C6 -> F6 rising fourth, glassy, + tiny tick."""
    d = pan(bell(C6, 1.1, 1.0, 3.5, 0.3), -0.15)
    add_at(d, pan(bell(F6, 1.4, 1.0, 3.5, 0.42), 0.15), 0.085, 0.9)
    add_at(d, pan(click(seed), 0), 0.0, 0.25)
    return d


def secure_chime(seed=0):
    """'sécurité': warm shield chime — A5 + F6 soft FM, slower attack, no tick."""
    n = ns(1.6)
    t = tt(n)
    a = bell(A5, 1.6, 0.6, 2.0, 0.5) * (1 - np.exp(-t / 0.01))
    b = bell(F6, 1.4, 0.5, 2.0, 0.4)
    y = pan(a, -0.2)
    add_at(y, pan(b, 0.2), 0.05, 0.6)
    return y


def beep(midi, dur=0.05, bright=0.2):
    n = ns(dur + 0.25)
    t = tt(n)
    f = mtof(midi)
    x = dsp.sine(f, n) + bright * dsp.pulse(f, n, 0.5) * 0.3
    x = dsp.butter(x, 'lp', 6000, 2)
    env = np.minimum(1, t / 0.003) * np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.035))
    return dsp.fade(x * env, 0.0005, 0.02)


def radar_ping(midi=A5, seed=0, p=0.0):
    n = ns(1.4)
    t = tt(n)
    x = dsp.sine(mtof(midi) * (1 + 0.004 * np.exp(-t / 0.05)), n) * np.exp(-t / 0.28) * (1 - np.exp(-t / 0.004))
    x = pan(dsp.fade(x, 0.0005, 0.1), p)
    return x + 0.55 * dsp.pingpong(x, 0.25, 0.35, 4, 5000, 400)


def ship_horn(dur=2.6, seed=0):
    """Distant ship-horn-ish swell: F1/F2 detuned saws, low-passed, slow bloom, slight sag."""
    n = ns(dur)
    t = tt(n)
    u = t / dur
    env = np.minimum(1, (t / 0.45) ** 1.5) * np.minimum(1, np.maximum(0, (dur - t) / 0.9)) ** 1.3
    sag = 1 - 0.006 * u
    x = 0.6 * dsp.saw(mtof(41) * sag, n) + 0.45 * dsp.saw(mtof(41) * 1.004 * sag, n, 0.3) + 0.5 * dsp.saw(mtof(29) * sag, n, 0.6)
    x = dsp.lp(x, 180 + 420 * env, 1.1)
    x += 0.04 * dsp.butter(dsp.noise(n, seed), 'bp', [300, 1200], 2) * env
    return dsp.fade(pan(x * env, -0.1), 0.02, 0.05)


def truck_rumble(dur=2.0, seed=0):
    """Truck pass-by: engine pulse (~40 Hz with 7 Hz firing AM) + brown-noise rumble, L -> R."""
    n = ns(dur)
    t = tt(n)
    u = t / dur
    env = np.sin(np.pi * np.clip(u, 0, 1)) ** 1.6
    eng = dsp.pulse(38 + 6 * env, n, 0.3) * (0.7 + 0.3 * np.sin(2 * np.pi * 7.5 * t))
    eng = dsp.lp(eng, 160 + 260 * env, 0.9)
    brown = np.cumsum(dsp.noise(n, seed)) / 300
    brown = dsp.butter(dsp.butter(brown, 'hp', 30, 2), 'lp', 250, 2)
    x = (eng + 1.5 * brown / (np.abs(brown).max() + 1e-9)) * env
    x += 0.05 * dsp.butter(dsp.noise(n, seed + 1), 'bp', [1500, 4000], 2) * env ** 2   # tyre hiss
    return dsp.fade(pan(x, -0.7 + 1.4 * u), 0.02, 0.05)


def shimmer(dur, seed, notes=(C7, D7, F7, A6, F6, G6), density=14, level=1.0):
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


def scan_sweep(dur=0.5, f0=700, f1=9000, seed=0, p0=-0.8, p1=0.8):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    fc = f0 * (f1 / f0) ** u
    x = dsp.tv_biquad(dsp.noise(n, seed), 'bp', fc, 3.5)
    x += 0.15 * dsp.sine(fc * 0.5, n)
    return pan(x * np.sin(np.pi * u) ** 1.5, p0 + (p1 - p0) * u)


def reverse_swell(dur, seed, ir):
    n = ns(dur)
    src = np.zeros(n)
    k = ns(0.12)
    src[:k] = dsp.noise(k, seed) * np.exp(-tt(k) / 0.03)
    src[:k] += sum(dsp.sine(mtof(m), k) for m in (65, 72, 77, 81)) * np.exp(-tt(k) / 0.05) * 0.4
    y = dsp.reverb(src, ir, 1.0, 300, 9000)[:n][::-1].copy()
    y *= (np.linspace(0, 1, n) ** 1.5)[:, None]
    y[-ns(0.003):] *= np.linspace(1, 0, ns(0.003))[:, None]
    return y


# ----------------------------------------------------------------------------- the cue sheet
DEDICATED = ('bateau', 'camion', 'decharges', 'securite', 'balengou', 'confiance')
RECAP_WORDS = ('achat', 'groupage', 'transport', 'arrivee', 'dechargement', 'retrait')
POP_SPACING, POP_PER_SEG, POP_CLEAR, POP_AFTER_SLAM = 1.5, 2, 0.6, 3.0


def render(tl):
    N = ns(tl.duration)
    ir_small = dsp.make_ir(0.9, 0.7, 0.6, 0.3, 0.006, seed=21)
    ir_big = dsp.make_ir(3.0, 2.6, 2.2, 0.9, 0.025, seed=22)
    dry = np.zeros((N, 2))
    wet_big = np.zeros((N, 2))
    wet_small = np.zeros((N, 2))
    cues = []

    def put(sig, t, gain_db, name, send_big=0.0, send_small=0.2):
        g = undb(gain_db)
        s = stereo(sig)
        add_at(dry, s, t, g)
        if send_big:
            add_at(wet_big, s, t, g * send_big)
        if send_small:
            add_at(wet_small, s, t, g * send_small)
        if name:
            cues.append((round(float(t), 3), name))

    segs_in = lambda cid, kind=None: [s for s in tl.segments if s['chapter'] == cid and (kind is None or s['kind'] == kind)]
    # ---------------------------------------------------------------- chapter starts
    for i, c in enumerate(tl.chapters):
        t0 = float(c['start'])
        if t0 < 0.05:
            put(impact(1.1, 10, 2.0), 0.0, 0.0, 'IMPACT (open)', 0.4)
            put(scan_sweep(0.55, 600, 9000, 3, -0.8, 0.8), 0.04, -17, 'power-on sweep', 0.2)
            put(pan(beep(C7, 0.04, 0.1), 0.3), 0.42, -21, 'power-on blip', 0.3)
        else:
            wd = 0.8
            put(whoosh(wd, 0.78, 350, 4500, -0.7 if i % 2 else 0.7, 0.7 if i % 2 else -0.7, 100 + i, 0.25), t0 - 0.78 * wd, -8, f'{c["id"]} whoosh', 0.15)
            put(soft_hit(200 + i), t0, -7, f'{c["id"]} hit', 0.25)
        if c.get('num'):
            put(slam(300 + i), t0 + 0.15, -6.5, f'{c["id"]} title slam', 0.3)
        elif c.get('title') and c['id'] != 'brand' and t0 > 0.05:
            put(layer((pan(pop(C6, 5), 0), 1.0), (pan(click(6), 0), 0.5)), t0 + 0.15, -12, f'{c["id"]} title pop', 0.25)

    # ---------------------------------------------------------------- brand logo lock (music has the hit)
    brand = tl.ch('brand')
    if brand:
        v = segs_in('brand', 'vo')
        tb = tl.wt(v[0]['id'], 'bonzini') if v else None
        if tb is not None:
            put(layer((pan(click(7), 0), 0.9), (pan(bell(F6, 0.9, 1.0, 3.5, 0.3), 0.1), 0.3)), tb, -7, 'logo lock (brand)', 0.35)
            put(shimmer(0.6, 17, level=1.0), tb + 0.05, -15, 'logo shimmer', 0.5)

    # ---------------------------------------------------------------- dedicated word cues
    def first(prefix):
        m = tl.words_matching(prefix)
        return m[0] if m else (None, None)

    s, w = first('bateau')
    if w:
        put(ship_horn(2.6, 31), w['s'] - 0.25, -5.5, 'ship horn swell (bateau)', 0.6, 0.0)
    s, w = first('camion')
    if w:
        put(truck_rumble(2.0, 32), w['s'] - 0.5, -4.5, 'truck rumble (camion)', 0.0, 0.2)
    ding_times = []
    s, w = first('decharges')
    if w:
        put(check_ding(33), w['s'] + 0.05, -12, 'check ding (déchargés)', 0.4)
        ding_times.append(w['s'])
    for k, (s, w) in enumerate(tl.words_matching('securite')):
        if any(abs(w['s'] - d) < 1.5 for d in ding_times):
            continue
        put(secure_chime(40 + k), w['s'] + 0.05, -13, f'secure chime (sécurité {s["id"]})', 0.45)
        ding_times.append(w['s'])
    s, w = first('balengou')
    if w:
        b = w['s']
        for j, (dt, g) in enumerate(((-0.9, -13), (0.0, -10), (0.9, -14))):
            put(radar_ping(A5 if j != 1 else C6, 50 + j, (-0.3, 0.0, 0.3)[j]), b + dt, g, f'radar ping (Balengou{dt:+.1f})', 0.45)
    s, w = first('confiance')
    if w:
        put(shimmer(0.9, 60, level=1.0), w['s'] + 0.1, -16, 'shimmer (confiance)', 0.6)
    # recap: 6 rising blips on the step words, in order
    rc = segs_in('recap', 'vo')
    if rc:
        seg = rc[0]
        tcur = seg['start'] - 0.01
        notes = (F5, G5, A5, C6, D6, F6)
        k = 0
        for wd in seg['words']:
            if k >= len(RECAP_WORDS):
                break
            if wd['s'] > tcur and (tlmod.norm(wd['w']).startswith(RECAP_WORDS[k]) or tlmod.norm_elided(wd['w']).startswith(RECAP_WORDS[k])):
                put(pan(beep(notes[k], 0.05, 0.25), -0.5 + 0.2 * k), wd['s'], -8 + 0.6 * k, f'recap blip {k + 1} ({RECAP_WORDS[k]})', 0.3)
                tcur = wd['s']
                k += 1
    # final logo lock impact at the last VO segment of the outro (V11)
    ov = segs_in('outro', 'vo')
    if ov:
        th = ov[-1]['start']
        put(reverse_swell(1.0, 70, ir_big), th - 1.0, -8, 'reverse swell', 0.0, 0.0)
        put(impact(1.4, 71, 2.4), th, -2.0, 'LOGO LOCK IMPACT (V11)', 0.6)
        put(layer((pan(click(8), 0), 0.9), (pan(bell(F6, 1.2, 1.2, 3.5, 0.35), 0.1), 0.35)), th + 0.02, -10, 'logo lock click', 0.35)
        put(shimmer(1.2, 72, (C7, D7, F7, A6, 103, 105), 14, 1.0), th + 0.04, -17, 'logo shimmer', 0.7)

    # ---------------------------------------------------------------- sparse emphasis pops (VO only)
    busy = [t for t, _ in cues]
    slams = [t for t, n in cues if 'title' in n]      # the title card already stresses the step word
    skip_ch = {'brand', 'recap', 'outro'}
    last_pop = -9.0
    notes = (C6, D6, F6, G6, A6)
    npop = 0
    for s in tl.segments:
        if s['kind'] != 'vo' or s['chapter'] in skip_ch:
            continue
        per = 0
        for w in s.get('words', []):
            if not w.get('emph') or per >= POP_PER_SEG:
                continue
            nw = tlmod.norm(w['w'])
            if any(nw.startswith(d) for d in DEDICATED):
                continue
            t = w['s']
            if t - last_pop < POP_SPACING or any(abs(t - b) < POP_CLEAR for b in busy) \
                    or any(0 <= t - b < POP_AFTER_SLAM for b in slams):
                continue
            put(pan(pop(notes[npop % len(notes)], 80 + npop), (-0.35, 0.35)[npop % 2]), t, -6, f'pop ({w["w"].strip(".,:;!?")})', 0.0, 0.3)
            last_pop = t
            per += 1
            npop += 1

    y = dry + dsp.reverb(wet_big, ir_big, 0.6, 250, 8000) + dsp.reverb(wet_small, ir_small, 0.5, 400, 10000)
    y = dsp.dc_block(y, 20)
    y = dsp.butter(y, 'hp', 32, 2)
    cues.sort()
    return y, cues


def main(tl=None):
    tl = tl or tlmod.load()
    os.makedirs(REP, exist_ok=True)
    N = ns(tl.duration)
    y, cues = render(tl)
    pk = dsp.true_peak_env(y).max()
    y = (y * undb(-3.0) / pk)[:N]
    y[-1] = 0.0
    dsp.save(os.path.join(OUT, 'sfx.wav'), y, 'FLOAT')
    json.dump({'cues': cues, 'lufs': float(dsp.lufs_integrated(y)), 'duration_s': tl.duration},
              open(os.path.join(REP, 'sfx_cues.json'), 'w'), indent=1, ensure_ascii=False)
    dsp.report_png(os.path.join(REP, 'sfx.png'), y, 'sfx.wav', [(t, n) for t, n in cues if 'whoosh' not in n],
                   [(c['start'], c['end'], c['id']) for c in tl.chapters], px_per_s=12, height=700)
    print(f'sfx: {len(cues)} cues, {dsp.lufs_integrated(y):.1f} LUFS')
    return cues


if __name__ == '__main__':
    main()

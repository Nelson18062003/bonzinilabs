"""Original score for « Le parcours de vos colis » — fully synthesized, derived from data/timeline.json.

100 BPM (tempo read from the timeline), F major / D minor. Harmony I–V–vi–IV family, one chord per bar.
Every chapter start is a DOWNBEAT: bars are counted from each chapter start; a chapter whose length is
not a whole number of bars ends on a short "turnaround" bar (C9sus4 = Bb/C, 2–3 beats) or a 5-beat bar
(1 extra beat) that breaks the drums and reverses a cymbal into the next downbeat.

  hook   energetic intro, impact at 0 (four-on-the-floor, 16th plucks)
  brand  drums out, swell (pad filter + reverse cymbal + riser) -> HIT on the logo lock (TL word 'Bonzini')
  s1..s6 steady groove, one variation per chapter (kick pattern, bass figure, pluck pattern, bells)
  recap  build (filter opens, 16th hats, bells, snare lift + riser into the outro)
  outro  soft bed under the thank-you quote, reverse swell -> FINAL HIT at V11 start, Fadd9 tail that
         fades to silence exactly on the last sample.

Run:  nice -n 5 python3 lib/audio/music.py [--stems]  -> out/music.wav (+ out/audio_report/music*.png|json)
"""
import os, sys, json, math
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import dsp
import tl as tlmod
from dsp import SR, ns, mtof, add_at, stereo, pan, undb

E = tlmod.E
OUT = os.path.join(E, 'out')
REP = os.path.join(OUT, 'audio_report')

# ============================================================================ harmony (F major)
CHORDS = {   # pad voicing (warm, common-tone C4), bass root, pluck tones, bell tones
    'F':     dict(pad=[53, 57, 60, 64], bass=41, arp=[72, 76, 77, 81], bell=[81, 84, 88]),
    'C':     dict(pad=[52, 55, 60, 62], bass=36, arp=[72, 74, 76, 79], bell=[79, 84, 86]),
    'Dm':    dict(pad=[53, 57, 60, 62], bass=38, arp=[69, 72, 74, 77], bell=[81, 84, 86]),
    'Bb':    dict(pad=[53, 58, 60, 62], bass=34, arp=[70, 72, 74, 77], bell=[82, 84, 89]),
    'Csus':  dict(pad=[53, 58, 60, 62], bass=36, arp=[72, 74, 77, 79], bell=[84, 86, 89]),   # C9sus4 (Bb/C)
    'Fadd9': dict(pad=[53, 57, 60, 64, 67], bass=41, arp=[72, 77, 79, 81], bell=[77, 84, 91, 93]),
}
# per-chord bell phrase (step, midi, length in 16ths) — used where a style asks for 'motif' bells
MOTIF = {
    'F':    [(0, 81, 6), (6, 84, 4), (10, 88, 6)],
    'C':    [(0, 86, 6), (6, 84, 4), (10, 79, 6)],
    'Dm':   [(0, 81, 6), (6, 84, 4), (10, 86, 6)],
    'Bb':   [(0, 89, 8), (8, 86, 4), (12, 84, 4)],
    'Csus': [(0, 84, 6), (6, 86, 6)],
}

# ============================================================================ arrangement
KICK = {'four': {0, 4, 8, 12}, 'half': {0, 8}, 'half+': {0, 8, 10}, 'one': {0}, None: set()}
HATS = {'off8': {2, 6, 10, 14}, '16': set(range(16)), None: set()}
SHAKE = {'8': set(range(0, 16, 2)), '16': set(range(16)), None: set()}
ARP = {   # tone index per 16th (-1 = rest); tone index >= 4 = octave up of index-4
    'A': [0, -1, -1, 1, -1, -1, 2, -1, 3, -1, -1, 2, -1, -1, 1, -1],          # 3-3-2 dotted figure
    'B': [0, 1, 2, -1, 1, 2, 3, -1, 0, 1, 2, -1, 3, 2, 1, -1],                # flowing 16ths with breaths
    'C': [-1, -1, 0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 3, -1],        # sparse off-beats
    'D': [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 3, 2, 1],                    # full 16ths (energy)
    'E': [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 2, -1, 4, -1, 3, -1],            # straight 8ths
}
# style per chapter id (timing always comes from the timeline; unknown ids fall back by kind)
STYLES = {
    'hook':  dict(prog=['F', 'C', 'Dm', 'Bb'], kick='four', snap=0.9, hats='off8', shaker='16', bass='8th',
                  arp='D', arp_cut=(2300, 3000), arp_oct=0.35, pad=0.8, pad_cut=(1500, 1900), bells=None, level=(-2.0, -1.5), fill='snare'),
    's1':    dict(prog=['F', 'C', 'Dm', 'Bb'], kick='half', snap=0.8, hats=None, shaker='8', bass='half',
                  arp='A', arp_cut=(1700, 2100), arp_oct=0.0, pad=1.0, pad_cut=(1200, 1400), bells=None, level=(-3.0, -3.0), fill='soft'),
    's2':    dict(prog=['F', 'C', 'Dm', 'Bb'], kick='half+', snap=0.85, hats=None, shaker='16', bass='synco',
                  arp='B', arp_cut=(1800, 2300), arp_oct=0.0, pad=0.9, pad_cut=(1300, 1500), bells=None, level=(-2.6, -2.4), fill='soft'),
    's3':    dict(prog=['Dm', 'Bb', 'F', 'C'], kick='four', snap=0.9, hats='off8', shaker='16', bass='8th',
                  arp='A', arp_cut=(2100, 2700), arp_oct=0.3, pad=0.9, pad_cut=(1400, 1800), bells='first', level=(-2.0, -1.4), fill='snare'),
    's4':    dict(prog=['F', 'C', 'Dm', 'Bb'], kick='half', snap=0.55, hats=None, shaker='8', bass='whole',
                  arp='C', arp_cut=(1600, 1800), arp_oct=0.0, pad=1.0, pad_cut=(1100, 1300), bells=None, level=(-3.6, -3.4), fill='soft'),
    's5':    dict(prog=['F', 'Dm', 'Bb', 'C'], kick='half+', snap=0.8, hats=None, shaker='16', bass='synco',
                  arp='E', arp_cut=(1800, 2200), arp_oct=0.0, pad=0.95, pad_cut=(1200, 1500), bells=None, level=(-3.2, -2.8), fill='soft'),
    's6':    dict(prog=['F', 'C', 'Dm', 'Bb'], kick='half', snap=0.7, hats=None, shaker='8', bass='half',
                  arp='A', arp_cut=(1900, 2300), arp_oct=0.25, pad=1.0, pad_cut=(1300, 1600), bells='first', level=(-3.2, -2.6), fill='snare'),
    'recap': dict(prog=['Dm', 'Bb', 'F', 'C'], kick='four', snap=1.0, hats='16', shaker='16', bass='8th',
                  arp='D', arp_cut=(2000, 4200), arp_oct=0.45, pad=1.1, pad_cut=(1500, 3000), bells='motif', level=(-2.4, -0.8), fill='snare', riser=True),
    'brand': dict(special='brand'),
    'outro': dict(special='outro'),
}
FALLBACK = {'mg': 's2', 'footage': 's4'}


def style_for(c):
    return STYLES.get(c['id']) or STYLES[FALLBACK.get(c.get('kind'), 's1')]


# ============================================================================ instruments
def tt(n):
    return np.arange(n) / SR


def kick(soft=1.0):
    n = ns(0.5)
    t = tt(n)
    f = 47.0 + 85.0 * np.exp(-t / 0.032) + 30 * np.exp(-t / 0.004)
    body = dsp.sine(f, n) * np.exp(-t / 0.19)
    body = dsp.softclip(body * 1.5, 1.3)
    click = dsp.butter(dsp.noise(n, 11), 'bp', [1500, 5000], 2) * np.exp(-t / 0.002) * 0.12 * soft
    return dsp.fade(body + click, 0.0005, 0.03)


def snap(seed=0):
    """Finger-snap / soft rim: short band-passed noise double-transient + tiny wood body."""
    n = ns(0.3)
    t = tt(n)
    env = np.exp(-t / 0.004) * 0.7 + np.exp(-np.maximum(t - 0.007, 0) / 0.035) * (t > 0.007)
    x = dsp.butter(dsp.noise(n, 100 + seed), 'bp', [1300, 4800], 2) * env
    x = dsp.biquad(x, 'peak', 2200, 1.4, 4.0)
    x += 0.35 * dsp.sine(420 * (1 + 0.3 * np.exp(-t / 0.004)), n) * np.exp(-t / 0.02)
    return dsp.fade(x, 0.0003, 0.05)


_HAT_F = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) * 1.9


def hat(seed=0, open_=False):
    n = ns(0.4 if open_ else 0.08)
    t = tt(n)
    metal = sum(dsp.pulse(f, n, 0.5, phase0=(i * 0.137) % 1) for i, f in enumerate(_HAT_F)) / 6
    x = 0.45 * metal + 0.8 * dsp.noise(n, 200 + seed)
    x = dsp.butter(x, 'hp', 7800, 4)
    x = dsp.onepole_lp(x, 13000)
    x *= np.exp(-t / (0.12 if open_ else 0.02))
    return dsp.fade(x, 0.0005, 0.01)


def shaker(seed=0):
    n = ns(0.12)
    t = tt(n)
    env = (t / 0.02) ** 2 * np.exp(-t / 0.03)
    env /= env.max()
    x = dsp.butter(dsp.noise(n, 300 + seed), 'bp', [5000, 11000], 2) * env
    return dsp.fade(x, 0.001, 0.01)


def snare(seed=0, tune=1.0):
    n = ns(0.25)
    t = tt(n)
    body = dsp.sine(190 * tune * (1 + 0.4 * np.exp(-t / 0.01)), n) * np.exp(-t / 0.05)
    nz = dsp.butter(dsp.noise(n, 500 + seed), 'bp', [1800, 8000], 2) * np.exp(-t / 0.07)
    return dsp.fade(0.5 * body + nz, 0.0003, 0.03)


def crash(seed=0, dur=2.4, dark=8000):
    n = ns(dur)
    t = tt(n)
    out = np.zeros((n, 2))
    r = dsp.rng(600 + seed)
    for ch in range(2):
        fr = r.uniform(2500, 10000, 20)
        metal = sum(dsp.sine(f, n, r.random()) for f in fr) / 20
        x = 0.3 * metal + dsp.noise(n, 610 + seed + ch)
        x = dsp.butter(x, 'hp', 3000, 2)
        x = dsp.onepole_lp(x, dark)
        out[:, ch] = x * (0.2 * np.exp(-t / 0.04) + 0.8 * np.exp(-t / (dur * 0.3)))
    return dsp.fade(out, 0.0005, 0.3)


def reverse_cymbal(dur=1.0, seed=0, dark=9000):
    c = crash(seed, dur + 0.3, dark)[::-1].copy()[-ns(dur):]
    c *= (np.linspace(0, 1, len(c)) ** 1.5)[:, None]
    return dsp.fade(c, 0.05, 0.004)


def sub_boom(f_end, dur=2.5, tau=0.6, f_start=None):
    n = ns(dur)
    t = tt(n)
    f0 = f_start or f_end * 2.4
    f = f_end + (f0 - f_end) * np.exp(-t / 0.08)
    x = dsp.sine(f, n) * np.exp(-t / tau)
    x = dsp.softclip(x * 1.6, 1.4)
    return dsp.fade(x, 0.0005, 0.3)


def noise_burst(dur=1.0, seed=0, top=7000):
    n = ns(dur)
    t = tt(n)
    x = dsp.noise(n, 800 + seed, ch=2)
    x = dsp.lp(x, 300 + top * np.exp(-t / 0.07), 0.7)
    return dsp.fade(x * np.exp(-t / 0.2)[:, None], 0.0005, 0.2)


def riser(dur, seed=0, f0=300, f1=8000, level=1.0):
    n = ns(dur)
    t = tt(n)
    u = t / dur
    nz = dsp.noise(n, 900 + seed, ch=2)
    fc = f0 * (f1 / f0) ** (u ** 1.5)
    x = dsp.tv_biquad(nz, 'bp', fc, 1.2) * (u ** 2.0)[:, None]
    y = x * level
    y[-ns(0.004):] *= np.linspace(1, 0, ns(0.004))[:, None]
    return y


@lru_cache(maxsize=None)
def bass_note(midi, dur_q, bright=1.0):
    """Warm sub bass: sine fundamental + low-passed saw for phone-audible harmonics."""
    dur = dur_q / 1000.0
    n = ns(dur + 0.1)
    t = tt(n)
    f = mtof(midi)
    sub = dsp.sine(f, n, 0.25)
    saw = dsp.saw(f, n) * 0.5 + dsp.saw(f * 1.003, n, 0.4) * 0.5
    saw = dsp.lp(saw, 140 + 380 * bright * np.exp(-t / 0.09), 1.0)
    amp = dsp.adsr(n, 0.006, 0.2, 0.75, 0.06, dur)
    y = dsp.softclip((sub * 0.85 + saw * 0.45) * amp * 1.3, 1.0)
    return dsp.fade(y, 0.002, 0.02)


@lru_cache(maxsize=None)
def pluck(midi, cut_q, decay_ms=150, env_amt=2.2):
    """Tech pluck: pulse + saw through an enveloped low-pass, plus a sine body for warmth."""
    cut = float(cut_q)
    dec = decay_ms / 1000.0
    n = ns(0.5)
    t = tt(n)
    f = mtof(midi)
    x = 0.5 * dsp.pulse(f, n, 0.3) + 0.4 * dsp.saw(f * 1.004, n, 0.2)
    fc = np.minimum(cut * (1 + env_amt * np.exp(-t / 0.045)), 15000)
    x = dsp.lp(x, fc, 1.6)
    x += 0.5 * dsp.sine(f, n) * np.exp(-t / (dec * 1.4))
    x *= dsp.adsr(n, 0.002, dec, 0.0, 0.08, 0.4, curve=3.0)
    return dsp.fade(x, 0.0005, 0.03)


@lru_cache(maxsize=None)
def bell(midi, dur_ms=1600, idx=1.3):
    """2-op FM bell (ratio 3.5) with soft attack — tuned glassy tone, gentle index."""
    dur = dur_ms / 1000.0
    n = ns(dur)
    t = tt(n)
    f = mtof(midi)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * idx * np.exp(-t / 0.22)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / (dur * 0.35)) * (1 - np.exp(-t / 0.003))
    x += 0.2 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / (dur * 0.15))
    return dsp.fade(x, 0.0005, 0.1)


def pad_chord(notes, dur, seed, attack=0.12, release=0.6, voices=5, detune=13.0):
    n = ns(dur + release + 0.1)
    seg = np.zeros((n, 2))
    for j, m in enumerate(notes):
        seg += dsp.supersaw(mtof(m), n, voices=voices, detune_cents=detune, seed=seed * 10 + j) * (1.0 if j else 1.1)
        seg += pan(dsp.tri(mtof(m) * 0.5 if j == 0 else mtof(m), n) * 0.25, 0.0)   # soft body
    env = dsp.adsr(n, attack, 0.8, 0.8, release, dur)
    return seg * env[:, None]


# ============================================================================ planning
class Plan:
    """Bars (rhythm), chord spans (harmony) and section info — all derived from the timeline."""

    def __init__(self, tl):
        self.tl = tl
        B = tl.beat
        self.B, self.S16 = B, B / 4
        self.bars, self.spans, self.sections = [], [], []
        self.logo_t = None
        self.hit_t = None
        for c in tl.chapters:
            st = style_for(c)
            t0, t1 = float(c['start']), float(c['end'])
            sec = dict(id=c['id'], t0=t0, t1=t1, style=st)
            self.sections.append(sec)
            if st.get('special') == 'brand':
                self._brand(sec)
            elif st.get('special') == 'outro':
                self._outro(sec)
            else:
                for k, (bt, L) in enumerate(self._bar_layout(t0, t1)):
                    short = L < 4
                    ch = 'Csus' if short else st['prog'][k % len(st['prog'])]
                    self.bars.append(dict(t0=bt, beats=L, chord=ch, sec=sec, k=k))
                    self.spans.append((bt, bt + L * B, ch))
        self.spans.sort()

    def _bar_layout(self, t0, t1):
        B = self.B
        nb = int(math.floor((t1 - t0) / B + 1e-6))
        full, r = divmod(nb, 4)
        lens = [4] * full
        if r == 1 and full:
            lens[-1] = 5
        elif r:
            lens.append(r)
        out, t = [], t0
        for L in lens:
            out.append((t, L))
            t += L * B
        return out

    def _brand(self, sec):
        tl, B = self.tl, self.B
        t0, t1 = sec['t0'], sec['t1']
        v = next((s for s in tl.segments if s['chapter'] == sec['id']), None)
        logo = tl.wt(v['id'], 'bonzini') if v else None
        if logo is None or not (t0 + 0.8 < logo < t1 - 0.5):
            logo = t0 + 0.55 * (t1 - t0)
        self.logo_t = logo
        sec['logo'] = logo
        a = min(t0 + 4 * B, logo)
        self.spans += [(t0, a, 'Bb')] + ([(a, logo, 'Csus')] if logo - a > 0.2 else []) + [(logo, t1, 'F')]
        for k, (bt, L) in enumerate(self._bar_layout(t0, t1)):
            self.bars.append(dict(t0=bt, beats=L, chord=None, sec=sec, k=k))

    def _outro(self, sec):
        tl, B = self.tl, self.B
        t0, t1 = sec['t0'], tl.duration
        segs = [s for s in tl.segments if s['chapter'] == sec['id'] and s['kind'] == 'vo']
        hit = segs[-1]['start'] if segs else t0 + 0.4 * (t1 - t0)
        self.hit_t = hit
        sec['hit'] = hit
        # last on-grid beat at least 0.3 s before the hit starts the C9sus pickup
        pk = math.floor((hit - 0.3 - t0) / B + 1e-6) * B + t0
        pk = max(pk, t0)
        t, k = t0, 0
        while t < pk - 1e-6:
            e = min(t + 4 * B, pk)
            self.spans.append((t, e, ['F', 'Bb'][k % 2]))
            self.bars.append(dict(t0=t, beats=int(round((e - t) / B)), chord=['F', 'Bb'][k % 2], sec=sec, k=k))
            t, k = e, k + 1
        self.spans.append((pk, hit, 'Csus'))
        self.spans.append((hit, t1 + 1.0, 'Fadd9'))

    def chord_at(self, t):
        for a, b, c in self.spans:
            if a - 1e-6 <= t < b - 1e-6:
                return c
        return self.spans[-1][2] if t >= self.spans[-1][0] else self.spans[0][2]

    def sec_at(self, t):
        for s in self.sections:
            if s['t0'] - 1e-6 <= t < s['t1'] - 1e-6:
                return s
        return self.sections[-1]


# ============================================================================ render
def render(tl):
    N = ns(tl.duration)
    T = np.arange(N) / SR
    P = Plan(tl)
    B, S16 = P.B, P.S16
    r = dsp.rng(2024)
    names = ['kick', 'snap', 'hats', 'shaker', 'fill', 'cymbal', 'bass', 'pad', 'arp', 'bell', 'impact', 'riser', 'air']
    st = {k: np.zeros((N, 2)) for k in names}
    kicks = []                                   # (t, depth) for sidechain
    K = kick()
    snaps = [snap(s) for s in range(4)]
    hats = [hat(s) for s in range(6)]
    shk = [shaker(s) for s in range(5)]
    events = []                                  # (t, label) for the report

    def auto(points, log=False):
        ts = np.array([p[0] for p in points], float)
        vs = np.array([p[1] for p in points], float)
        return np.exp(np.interp(T, ts, np.log(vs))) if log else np.interp(T, ts, vs)

    pad_cut_pts, pad_gain_pts, macro_pts = [], [], []

    # ------------------------------------------------------------------ grooves (regular chapters)
    for sec in P.sections:
        stl = sec['style']
        if stl.get('special'):
            continue
        t0, t1 = sec['t0'], sec['t1']
        D = t1 - t0
        lv0, lv1 = stl['level']
        macro_pts += [(t0 + 0.002, lv0), (t1 - 0.002, lv1)]
        pc0, pc1 = stl['pad_cut']
        pad_cut_pts += [(t0 + 0.002, pc0), (t1 - 0.002, pc1)]
        pad_gain_pts += [(t0 + 0.002, stl['pad']), (t1 - 0.002, stl['pad'])]
        bars = [b for b in P.bars if b['sec'] is sec]
        for b in bars:
            ch = CHORDS[b['chord']]
            nsteps = b['beats'] * 4
            for q in range(nsteps):
                t = b['t0'] + q * S16
                p = q % 16
                last_beat = t >= t1 - B - 1e-6
                last_2 = t >= t1 - 2 * B - 1e-6
                u = (t - t0) / D
                beat_on = p % 4 == 0
                # kick
                if p in KICK[stl['kick']] and not last_beat and q < 16:
                    g = 1.0 if beat_on else 0.7
                    add_at(st['kick'], K, t, g)
                    kicks.append((t, g))
                # snap on 2 & 4
                if p in (4, 12) and not last_beat and q < 16:
                    add_at(st['snap'], pan(snaps[(q // 4 + b['k']) % 4], 0.05), t, stl['snap'])
                # hats
                if p in HATS[stl['hats']] and q < 16:
                    ramp = 1.0
                    if stl['hats'] == '16':
                        if u < 0.5 and p % 2 == 1:
                            continue
                        ramp = [1.0, 0.45, 0.75, 0.5][p % 4]
                    add_at(st['hats'], pan(hats[q % 6], 0.3 if p % 4 == 2 else -0.2), t, 0.8 * ramp)
                # shaker
                if p in SHAKE[stl['shaker']] and q < 16:
                    acc = [0.55, 0.3, 1.0, 0.35][p % 4]
                    add_at(st['shaker'], pan(shk[q % 5], -0.4), t + 0.004, acc * r.uniform(0.85, 1.0))
                # fill into the next chapter
                if stl.get('fill') == 'snare' and last_2:
                    v = (t - (t1 - 2 * B)) / (2 * B)
                    sn = dsp.butter(snare(q, 1.0 + 0.35 * v), 'hp', 250 + 700 * v, 2)
                    add_at(st['fill'], pan(sn, 0.15 * math.sin(q)), t, 0.12 + 0.5 * v ** 1.6)
                # arp
                pat = ARP[stl['arp']][p]
                if pat >= 0:
                    tone = ch['arp'][pat % 4] + (12 if pat >= 4 else 0)
                    c0, c1 = stl['arp_cut']
                    cut = int(round((c0 + (c1 - c0) * u) / 50.0) * 50)
                    vel = (0.95 if beat_on else 0.72) * r.uniform(0.9, 1.0)
                    pp = [-0.35, 0.35][q % 2]
                    add_at(st['arp'], pan(pluck(tone, cut, 150), pp), t, vel)
                    if stl.get('arp_oct', 0) > 0 and pat in (0, 2, 4):
                        add_at(st['arp'], pan(pluck(tone + 12, cut + 800, 110), -pp), t, vel * stl['arp_oct'])
            # bass
            bb = ch['bass']
            bs = stl['bass']
            notes = []
            if bs == 'whole':
                notes = [(0, nsteps)]
            elif bs == 'half':
                notes = [(s, min(8, nsteps - s)) for s in range(0, nsteps, 8)]
            elif bs == 'synco':
                fig = [(0, 3), (3, 3), (6, 2), (8, 3), (11, 3), (14, 2)]
                notes = [(s + 16 * k, L) for k in range(int(math.ceil(nsteps / 16))) for s, L in fig if s + 16 * k < nsteps]
            elif bs == '8th':
                notes = [(s, 2) for s in range(0, nsteps, 2)]
            for s, L in notes:
                t = b['t0'] + s * S16
                m = bb + (12 if (bs == 'synco' and s % 16 == 14) else 0)
                vel = 1.0 if s % 4 == 0 else 0.8
                dur_ms = int(L * S16 * 1000 * (0.92 if L <= 2 else 0.96))
                add_at(st['bass'], pan(bass_note(m, dur_ms, 1.0 if bs != 'whole' else 0.6), 0), t, vel)
            # bells
            if stl.get('bells') == 'first' and b['beats'] >= 4:
                m = ch['bell'][b['k'] % len(ch['bell'])]
                add_at(st['bell'], pan(bell(m, 1800, 1.0), [-0.45, 0.45][b['k'] % 2]), b['t0'] + (2 * B if b['k'] % 2 else 0), 0.55)
            elif stl.get('bells') == 'motif' and b['chord'] in MOTIF:
                for (s, m, L) in MOTIF[b['chord']]:
                    if s < nsteps:
                        add_at(st['bell'], pan(bell(m, 1400, 1.1), 0.4 if s % 8 else -0.4), b['t0'] + s * S16, 0.6)
        # chapter downbeat: soft crash + reverse cymbal lead-in (hook start handled by the impact)
        if t0 > 0.01:
            add_at(st['cymbal'], crash(int(t0 * 10), 2.0, 6000), t0, 0.4)
            events.append((t0, f'{sec["id"]} downbeat'))
        if stl.get('riser'):
            rd = min(2 * B * 2, D * 0.4)
            add_at(st['riser'], riser(rd, int(t1), 250, 7000), t1 - rd)
    # reverse cymbals into every chapter start (except 0 and the brand's own swell)
    for sec in P.sections:
        t0 = sec['t0']
        if t0 < 0.5:
            continue
        L = min(1.2, 2 * B)
        add_at(st['cymbal'], reverse_cymbal(L, int(t0 * 7)), t0 - L, 0.55)

    # ------------------------------------------------------------------ hook impact at 0
    hook = P.sections[0]
    ch0 = CHORDS[P.chord_at(0.0)]
    add_at(st['impact'], pan(sub_boom(mtof(ch0['bass'] - 12), 2.5, 0.45), 0), 0.0, 1.0)
    add_at(st['impact'], noise_burst(1.0, 1), 0.0, 0.35)
    add_at(st['cymbal'], crash(1, 2.6, 9000), 0.0, 0.9)
    events.append((0.0, 'IMPACT'))

    # ------------------------------------------------------------------ brand: swell -> logo hit
    for sec in P.sections:
        if sec['style'].get('special') != 'brand':
            continue
        t0, t1, logo = sec['t0'], sec['t1'], sec['logo']
        macro_pts += [(t0 + 0.002, -4.5), (logo - 0.01, -1.0), (logo + 0.01, 0.0), (t1 - 0.002, -2.5)]
        pad_cut_pts += [(t0 + 0.002, 550), (logo - 0.02, 3200), (logo + 0.02, 2400), (t1 - 0.002, 1500)]
        pad_gain_pts += [(t0 + 0.002, 0.8), (logo - 0.02, 1.25), (logo + 0.02, 1.1), (t1 - 0.002, 1.0)]
        # sub drone under the swell (root of the current chord)
        n = ns(logo - t0 + 0.3)
        tt_ = tt(n)
        dr = dsp.sine(mtof(CHORDS['Bb']['bass']), n) * np.minimum(1, tt_ / 0.4) * np.exp(-np.maximum(tt_ - (logo - t0), 0) / 0.05)
        add_at(st['bass'], pan(dr, 0), t0, 0.35)
        # arp: filtered pulse before the logo, brighter after it (on the global grid)
        k0 = int(math.ceil((t0 - 1e-6) / S16))
        k1 = int(math.floor((t1 - 1e-6) / S16))
        for k in range(k0, k1 + 1):
            t = k * S16
            if t >= t1 - 1e-6:
                break
            q = int(round((t - t0) / S16))
            p = q % 16
            chn = P.chord_at(t)
            before = t < logo - 1e-6
            if before:
                pat = ARP['A'][p]
                uu = min(1.0, max(0.0, (t - t0) / (logo - t0)))
                cut = int(round((600 + 1400 * uu ** 1.5) / 50) * 50)
                vel = 0.55 + 0.35 * uu
            else:
                if t < logo + 0.25:
                    continue
                pat = ARP['C'][p]
                cut, vel = 2200, 0.8
            if pat >= 0:
                tone = CHORDS[chn]['arp'][pat % 4]
                add_at(st['arp'], pan(pluck(tone, cut, 150), [-0.35, 0.35][q % 2]), t, vel)
            if not before and p % 2 == 0:
                add_at(st['shaker'], pan(shk[q % 5], -0.4), t + 0.004, [0.5, 0.3, 0.9, 0.3][p % 4] * 0.7)
        # swell + hit
        L = min(2.2, logo - t0)
        add_at(st['cymbal'], reverse_cymbal(L, 77, 10000), logo - L, 0.9)
        add_at(st['riser'], riser(max(0.5, logo - t0 - 0.3), 5, 250, 8000, 0.8), t0 + 0.3)
        add_at(st['impact'], pan(sub_boom(mtof(CHORDS['F']['bass'] - 12), 2.4, 0.4), 0), logo, 0.8)
        add_at(st['impact'], noise_burst(1.0, 2, 6000), logo, 0.3)
        add_at(st['cymbal'], crash(3, 3.0, 9000), logo, 0.8)
        for j, m in enumerate(CHORDS['F']['bell']):
            add_at(st['bell'], pan(bell(m, 2600, 1.2), (-0.5, 0.0, 0.5)[j]), logo + 0.02 * j, 0.8)
        add_at(st['cymbal'], crash(int(t0 * 10), 2.0, 7000), t0, 0.35)
        events += [(t0, 'brand downbeat'), (logo, 'LOGO HIT')]

    # ------------------------------------------------------------------ outro: bed -> final hit -> tail
    for sec in P.sections:
        if sec['style'].get('special') != 'outro':
            continue
        t0, hit, t1 = sec['t0'], sec['hit'], tl.duration
        macro_pts += [(t0 + 0.002, -3.5), (hit - 0.3, -2.5), (hit - 0.01, -1.5), (hit + 0.01, 0.0), (t1, 0.0)]
        pad_cut_pts += [(t0 + 0.002, 1200), (hit - 0.02, 2600), (hit + 0.02, 2800), (t1 - 3.0, 1800), (t1, 900)]
        pad_gain_pts += [(t0 + 0.002, 1.0), (hit - 0.02, 1.15), (hit + 0.02, 1.25), (t1, 1.25)]
        add_at(st['cymbal'], crash(int(t0 * 10), 2.4, 7000), t0, 0.45)
        # bed: sparse off-beat plucks + soft shaker + sustained bass until the pickup
        k0 = int(math.ceil((t0 - 1e-6) / S16))
        for k in range(k0, int(hit / S16) + 1):
            t = k * S16
            if t >= hit - 0.35:                      # leave the last moment to the swell (no flam on the hit)
                break
            q = int(round((t - t0) / S16))
            p = q % 16
            pat = ARP['C'][p]
            chn = P.chord_at(t)
            if pat >= 0:
                add_at(st['arp'], pan(pluck(CHORDS[chn]['arp'][pat], 1700, 170), [-0.35, 0.35][q % 2]), t, 0.75)
            if p % 4 == 2 and q < 32:
                add_at(st['shaker'], pan(shk[q % 5], -0.4), t + 0.004, 0.45)
        for a, b_, c in P.spans:
            if a >= t0 - 1e-6 and b_ <= hit + 1e-6 and b_ - a > 0.05:
                add_at(st['bass'], pan(bass_note(CHORDS[c]['bass'], int((b_ - a) * 950), 0.5), 0), a, 0.8)
        add_at(st['kick'], K, t0, 0.8)
        kicks.append((t0, 0.8))
        # swell into the hit
        L = min(1.8, hit - t0 - 0.2)
        add_at(st['cymbal'], reverse_cymbal(L, 91, 10000), hit - L, 1.0)
        add_at(st['riser'], riser(L, 9, 300, 9000, 0.9), hit - L)
        # FINAL HIT
        rootF = CHORDS['Fadd9']['bass']
        add_at(st['impact'], pan(sub_boom(mtof(rootF - 12), 4.0, 0.8), 0), hit, 0.9)
        add_at(st['impact'], noise_burst(1.4, 3, 7000), hit, 0.35)
        add_at(st['cymbal'], crash(5, 4.0, 9000), hit, 0.9)
        add_at(st['kick'], K, hit, 1.0)
        for j, m in enumerate(CHORDS['Fadd9']['bell']):
            add_at(st['bell'], pan(bell(m, 4200, 1.0), (-0.6, -0.2, 0.2, 0.6)[j]), hit + 0.015 * j, 0.75)
        # tail: arp echoes on a grid that starts at the hit (slowing down), sustained sub
        tail = t1 - hit
        seq = [84, 81, 79, 77, 76, 72, 77, 81]
        tt_ = 0.0
        for j, m in enumerate(seq):
            if hit + tt_ > t1 - 1.5:
                break
            add_at(st['arp'], pan(pluck(m, 2400, 190), [-0.45, 0.45][j % 2]), hit + tt_, 0.7 * 0.86 ** j)
            tt_ += S16 * 2 * (1 + 0.12 * j)
        n = ns(tail)
        x = dsp.sine(mtof(rootF - 12), n) * 0.8 + dsp.sine(mtof(rootF), n) * 0.35
        x *= np.minimum(1, tt(n) / 0.01) * np.exp(-tt(n) / 2.5)
        add_at(st['bass'], pan(x, 0), hit, 0.45)
        air = dsp.butter(dsp.noise(n, 999, ch=2), 'bp', [5000, 13000], 2)
        air *= (np.minimum(1, tt(n) / 0.4) * (0.7 + 0.3 * np.sin(2 * np.pi * tt(n) / 3.0)))[:, None]
        add_at(st['air'], air, hit, 1.0)
        events += [(t0, 'outro downbeat'), (hit, 'FINAL HIT')]

    # ------------------------------------------------------------------ pad (whole piece, chord spans)
    pad = np.zeros((N, 2))
    brand_t0 = next((x['t0'] for x in P.sections if x['style'].get('special') == 'brand'), None)
    for j, (a, b_, c) in enumerate(P.spans):
        if a >= tl.duration:
            continue
        b_ = min(b_, tl.duration)
        att = 0.12
        if brand_t0 is not None and abs(a - brand_t0) < 1e-6:
            att = 0.6                              # brand: slow swell in
        if P.hit_t is not None and abs(a - P.hit_t) < 1e-6:
            att = 0.004                            # final hit: immediate
        rel = 0.5 if b_ < tl.duration - 0.01 else 0.05
        notes = CHORDS[c]['pad']
        seg = pad_chord(notes, max(0.05, b_ - a), j, att, rel)
        add_at(pad, seg, a)
    pad_cut_pts.sort()
    pad_gain_pts.sort()
    pad = dsp.lp(pad, auto([(0, 1500)] + pad_cut_pts + [(tl.duration, 900)], log=True), 0.8)
    pad = dsp.hp(pad, 120, 0.7)
    st['pad'] = pad * auto([(0, 0.9)] + pad_gain_pts + [(tl.duration, 1.2)])[:, None]
    macro_pts.sort()
    macro = auto([(0, macro_pts[0][1])] + macro_pts + [(tl.duration, macro_pts[-1][1])])
    return st, kicks, macro, P, events


# ============================================================================ mixdown
TARGET = {   # integrated loudness (gated, i.e. "while playing") of each stem, LUFS, before bus processing
    'kick': -23.5, 'bass': -23.5, 'pad': -22.5, 'arp': -24.0, 'snap': -29.0, 'shaker': -35.0,
    'hats': -34.0, 'bell': -28.5, 'fill': -31.0, 'cymbal': -31.0, 'riser': -30.0, 'impact': -20.0, 'air': -40.0,
}


def sidechain_curve(N, kicks, depth, rel_tau=0.09, hold=0.01):
    g = np.ones(N)
    L = ns(0.45)
    tt_ = np.arange(L) / SR
    shape = np.where(tt_ < 0.004, tt_ / 0.004, np.where(tt_ < 0.004 + hold, 1.0, np.exp(-(tt_ - 0.004 - hold) / rel_tau)))
    for tk, d in kicks:
        i = ns(tk)
        n = min(L, N - i)
        if n > 0:
            g[i:i + n] = np.minimum(g[i:i + n], 1 - d * depth * shape[:n])
    return g


def mixdown(tl, st, kicks, macro, P):
    N = ns(tl.duration)
    T = np.arange(N) / SR
    gains = {}
    s = {}
    for k, v in st.items():
        L = dsp.lufs_integrated(v)
        gains[k] = float(TARGET[k] - L) if np.isfinite(L) else 0.0
        s[k] = v * undb(gains[k])
    sc_bass = sidechain_curve(N, kicks, 0.55, 0.08)[:, None]
    sc_pad = sidechain_curve(N, kicks, 0.28, 0.12)[:, None]
    sc_arp = sidechain_curve(N, kicks, 0.12, 0.08)[:, None]
    ir_hall = dsp.make_ir(2.8, 2.4, 2.0, 0.8, 0.03, seed=11)
    ir_room = dsp.make_ir(0.9, 0.7, 0.6, 0.3, 0.008, seed=12)

    drums = s['kick'] + s['snap'] + s['hats'] + s['shaker'] + s['fill'] + s['cymbal']
    drums = drums + dsp.reverb(s['snap'] + 0.5 * s['fill'] + 0.3 * s['shaker'], ir_room, 0.4, 350, 8000)
    drums = dsp.compressor(drums, thr_db=-18, ratio=2.0, att=0.01, rel=0.12, knee_db=6)
    bass = dsp.hp(s['bass'], 30, 0.7) * sc_bass
    bass = dsp.biquad(bass, 'peak', 380, 1.0, -2.0)
    syn = s['pad'] * sc_pad + s['arp'] * sc_arp + s['bell']
    dly = dsp.pingpong(s['arp'], 3 * P.S16, 0.35, 6, 4000, 500) + dsp.pingpong(s['bell'], P.B, 0.4, 5, 5000, 600, 'R')
    rev = dsp.reverb(s['pad'] * 0.3 + s['arp'] * 0.45 + s['bell'] * 0.9, ir_hall, 0.5, 250, 7000)
    syn = syn + 0.35 * dly * sc_arp + rev * sc_pad
    # keep a gentle pocket for the voice (300 Hz – 3.5 kHz) in the synth bus at all times
    syn = dsp.biquad(syn, 'peak', 1500, 0.6, -3.0)
    syn = dsp.biquad(syn, 'peak', 480, 1.0, -1.5)
    fx = s['impact'] + s['riser'] + s['air']
    fx = fx + dsp.reverb(s['impact'] * 0.6 + s['riser'] * 0.5, ir_hall, 0.3, 200, 6000)

    mix = (drums + bass + syn) * undb(macro)[:, None] + fx
    mix = dsp.butter(mix, 'hp', 28, 4)
    mix = dsp.biquad(mix, 'ls', 80, 0.7, -3.0)
    mix = dsp.biquad(mix, 'hs', 7500, 0.7, -2.0)      # gentle top: bright but not hissy under VO
    # final tail: equal-power fade that reaches exactly 0 on the last sample
    fl = min(3.0, max(0.5, tl.duration - (P.hit_t or tl.duration - 3.0) - 2.0))
    f = np.ones(N)
    m = T >= tl.duration - fl
    f[m] = np.cos((T[m] - (tl.duration - fl)) / fl * np.pi / 2) ** 2
    f[-1] = 0.0
    mix *= f[:, None]
    mix = dsp.compressor(mix, thr_db=-18, ratio=1.6, att=0.02, rel=0.25, knee_db=8)
    mix *= undb(-16.0 - dsp.lufs_integrated(mix))
    mix = dsp.clipper(mix, -3.0)
    mix, gr = dsp.limiter(mix, -1.5, 0.004, 0.1)
    mix[-1] = 0.0
    info = {'stem_gain_db': {k: round(v, 1) for k, v in gains.items()},
            'limiter_gr_max_db': round(float(-dsp.db(gr.min())), 2)}
    return mix, info


def sections_for_report(P):
    return [(s['t0'], s['t1'], s['id']) for s in P.sections]


def main(tl=None, stems=False):
    tl = tl or tlmod.load()
    os.makedirs(REP, exist_ok=True)
    st, kicks, macro, P, events = render(tl)
    mix, info = mixdown(tl, st, kicks, macro, P)
    N = ns(tl.duration)
    assert len(mix) == N
    dsp.save(os.path.join(OUT, 'music.wav'), mix, 'FLOAT')
    info.update({'duration_s': tl.duration, 'samples': N, 'bpm': tl.bpm,
                 'lufs': round(float(dsp.lufs_integrated(mix)), 2),
                 'peak_dbfs': round(float(dsp.db(np.max(np.abs(mix)))), 2),
                 'logo_hit': P.logo_t, 'final_hit': P.hit_t,
                 'chords': [(round(a, 3), round(b, 3), c) for a, b, c in P.spans],
                 'bars': [(round(b['t0'], 3), b['beats'], b['chord'], b['sec']['id']) for b in P.bars],
                 'events': [(round(t, 3), n) for t, n in sorted(events)]})
    json.dump(info, open(os.path.join(REP, 'music_info.json'), 'w'), indent=1)
    marks = [(t, n) for t, n in sorted(events)]
    dsp.report_png(os.path.join(REP, 'music.png'), mix, 'music.wav', marks, sections_for_report(P), px_per_s=12, height=700)
    if stems:
        for k, v in st.items():
            dsp.save(os.path.join(REP, f'stem_{k}.wav'), v, 'FLOAT')
    print(f"music: {tl.duration:.3f} s, {info['lufs']} LUFS, peak {info['peak_dbfs']} dBFS, logo hit {P.logo_t}, final hit {P.hit_t}")
    return info


if __name__ == '__main__':
    main(stems='--stems' in sys.argv)

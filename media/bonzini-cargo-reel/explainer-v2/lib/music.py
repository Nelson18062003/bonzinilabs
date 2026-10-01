"""« Le parcours de vos colis » — music bed: warm makossa / afro-pop groove, 120 BPM, A major, 130.0 s, deterministic.

Everything is derived from data/timeline.json (chapters, speech segments, bpm):
- Chapters start on the BEAT grid, not on the 4/4 bar grid, so bars are re-phased on every chapter start:
  each chapter = N full 4/4 bars + one short pickup bar (1-3 beats, on the dominant E) that carries the
  fill, the bass walk-up and the cymbal swell into the next chapter's downbeat hit.
- Arrangement (LEVEL per chapter): hook = light intro (pad, soft picking, shaker, bass enters) + rising pickup
  into the BIG hit at the brand chapter; s1 -> s2 -> s3 the groove builds (g1 -> g2 -> full); s4-s6 (real footage,
  on-site team voice) = thin, low 'bed' (no picking, no lead, no hats); recap = full groove again (big hit);
  outro = bed under Q6, lifts under V11, IV-V cadence -> final A-major chord ring-out after V11, faded by the end.
- Variation every 4 bars: picking / skank / bass patterns rotate per phrase, phrase-end fills (toms, snare,
  congas), diatonic bass walk-ups into every chapter.
- Lead guitar licks (diatonic thirds, soukous style) are placed ONLY in gaps between speech (checked against the
  timeline), and never in s4-s6. During speech nothing melodic sits on top: only the low-level picked ostinato.

House instruments are imported (not copied): prix-de-revient/lib/makossa.py (Karplus-Strong guitar, bass, kick,
rim, hat, clap) and explainer/lib/audio/dsp.py. Additions here: snare/toms for fills, shaker, conga, cymbal and
reverse-cymbal swell, warm pad.  NB dsp.reverb() returns the WET signal only -> dry + wet are summed below.

usage: PYTHONDONTWRITEBYTECODE=1 nice -n 5 python3 lib/music.py   -> out/music.wav, out/music_hits.json
"""
import os, sys, json, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
X = os.path.dirname(HERE)
REEL = os.environ.get('BONZINI_REEL', '/home/user/bonzinilabs/media/bonzini-cargo-reel')
sys.path.insert(0, os.path.join(REEL, 'explainer', 'lib', 'audio'))
sys.path.insert(0, os.path.join(REEL, 'prix-de-revient', 'lib'))
import dsp                                   # noqa: E402
from dsp import SR, ns, undb                 # noqa: E402
import makossa as mk                         # noqa: E402

TL = json.load(open(os.path.join(X, 'data', 'timeline.json')))
DUR = float(TL['duration']); N = ns(DUR)
BEAT = 60.0 / TL['bpm']; S16 = BEAT / 4; SWING = .012
CHS = TL['chapters']
SPEECH = [(s['start'], s['end'], s['kind'], s['id']) for s in TL['segments']]
LAST_SPEECH_END = max(s['end'] for s in TL['segments'])                     # V11 end (126.21)
FINAL_T = math.ceil((LAST_SPEECH_END + .12) / BEAT) * BEAT                   # final chord on the next beat (126.5)
FADE_FROM = DUR - 1.6                                                        # ring-out faded to silence by DUR


def speaking(a, b, pad=.08):
    return any(s - pad < b and a < e + pad for s, e, _, _ in SPEECH)


class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)

    def put(self, sig, t, g=1.0, p=0.0):
        i = ns(t)
        if i >= N or g == 0: return
        if i < 0: sig, i = sig[-i:], 0
        s = sig[:N - i] * g; a = (p + 1) * math.pi / 4
        self.L[i:i + len(s)] += s * math.cos(a); self.R[i:i + len(s)] += s * math.sin(a)

    def st(self): return np.stack([self.L, self.R], 1)


# ----------------------------------------------------------------------------- extra instruments (seeded)
def nz(n, seed): return mk.nz(n, seed)


def snare(seed=0):
    n = ns(.2); t = np.arange(n) / SR
    body = np.sin(2 * np.pi * np.cumsum(180 + 70 * np.exp(-t / .012)) / SR) * np.exp(-t / .045)
    sn = dsp.butter(nz(n, seed), 'bp', [1800, 7500], 2) * np.exp(-t / .06)
    return (body * .55 + sn * 1.3) * np.minimum(1, t / .0008)


def tom(f, seed=0):
    n = ns(.35); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * np.cumsum(f * (1 + .45 * np.exp(-t / .025))) / SR) * np.exp(-t / .16)
    y[:ns(.006)] += dsp.lp(nz(ns(.006), seed), 3000) * .3
    return y


def conga(kind='hi', seed=0):
    f = {'hi': 330., 'lo': 228.}[kind]
    n = ns(.25); t = np.arange(n) / SR
    ff = f * (1 + .08 * np.exp(-t / .015))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    y = (np.sin(ph) + .25 * np.sin(1.52 * ph) * np.exp(-t / .03)) * np.exp(-t / (.12 if kind == 'hi' else .16))
    y[:ns(.01)] += dsp.biquad(nz(ns(.01), seed), 'bp', 2200, 1.2) * np.exp(-np.arange(ns(.01)) / SR / .003) * .5
    return y * np.minimum(1, t / .001)


def shaker(seed=0):
    n = ns(.07); t = np.arange(n) / SR
    return dsp.butter(nz(n, seed), 'bp', [5500, 11000], 2) * np.minimum(1, t / .006) * np.exp(-t / .022)


_CYM_F = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)                    # 808-style metallic partial set


def cymbal(dur=1.8, seed=0, lpf=9000., tau=.55):
    n = ns(dur); t = np.arange(n) / SR
    met = sum(np.sign(np.sin(2 * np.pi * f * 3.1 * t + k)) for k, f in enumerate(_CYM_F)) / 6
    y = .75 * nz(n, seed) + .35 * met
    y = dsp.butter(dsp.butter(y, 'hp', 3000, 2), 'lp', lpf, 2)
    return y * np.minimum(1, t / .002) * np.exp(-t / tau)


def swell(dur, seed=0, lpf=8000.):
    """Reverse cymbal: rises to its peak exactly at the end (place it at hit_t - dur)."""
    c = cymbal(dur + .05, seed, lpf, tau=dur * .45)[::-1][-ns(dur):]           # keep the (reversed) attack at the end
    t = np.arange(len(c)) / SR
    return c * (t / dur) ** 1.5 * np.minimum(1, (dur - t) / .004).clip(0, 1)


def pad_note(m, dur, seed=0):
    n = ns(dur); f = mk.m2f(m)
    y = sum(dsp.saw(f * 2 ** (c / 1200), n, phase0=(seed * .37 + k * .29) % 1) for k, c in enumerate((-7, 0, 6)))
    return y / 3


def pad(chord, dur, lpf=1100., att=.25, rel=.45, seed=0):
    vo = PAD_V[chord]
    y = sum(pad_note(m, dur + rel, seed + i) for i, m in enumerate(vo)) / len(vo)
    y = dsp.butter(dsp.butter(y, 'lp', lpf, 2), 'hp', 150, 2)
    t = np.arange(len(y)) / SR
    env = np.minimum(1, t / att) * np.clip((dur + rel - t) / rel, 0, 1) ** 1.5
    return y * env


def strum(B, voicing, t, g, bright=.7, dur=1.4, decay=.996, seed=0, gap=.011, spread=.6, up=False):
    vs = voicing[::-1] if up else voicing
    k = len(vs)
    for i, m in enumerate(vs):
        B.put(mk.guitar(mk.m2f(m), dur, bright, decay, seed + i), t + i * gap, g * (1 - .04 * i), (i / max(1, k - 1) - .5) * spread)


# ----------------------------------------------------------------------------- harmony (A major)
CHORD = {  # picking tones (house voicings) + bass root (bass plays root-12)
    'A': ([64, 69, 73, 76], 45), 'D': ([66, 69, 74, 78], 50), 'E': ([64, 68, 71, 76], 52),
    'F#m': ([66, 69, 73, 78], 54), 'Bm': ([66, 71, 74, 78], 47)}
PAD_V = {'A': [57, 61, 64, 69], 'D': [57, 62, 66, 69], 'E': [56, 59, 64, 68], 'F#m': [57, 61, 66, 69], 'Bm': [59, 62, 66, 71]}
STRUM_V = {'A': [45, 52, 57, 61, 64, 69], 'A_hi': [57, 64, 69, 73, 76, 81], 'A_soft': [57, 64, 69, 73]}
SCALE = {9, 11, 1, 2, 4, 6, 8}


def snap(m):
    return m if m % 12 in SCALE else m - 1


PROG_BASE = {'hook': ['A', 'D', 'A', 'D'], 'brand': ['A', 'D', 'E', 'D'], 's1': ['A', 'D', 'E', 'D'],
             's2': ['A', 'F#m', 'Bm', 'D'], 's3': ['A', 'E', 'F#m', 'D'], 's4': ['A', 'D', 'E', 'D'],
             's5': ['A', 'D', 'E', 'D', 'A', 'D', 'E', 'D', 'F#m', 'D', 'A', 'D'],
             's6': ['A', 'D', 'E', 'D', 'A', 'D', 'F#m', 'D'], 'recap': ['A', 'D', 'E', 'D'], 'outro': ['A', 'D', 'E', 'D']}

# ----------------------------------------------------------------------------- patterns
PICK = {'a': mk.PICK,
        'b': [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 0],
        'c': [0, None, 2, 1, 3, None, 2, 1, 0, None, 2, 3, 1, None, 2, 1],
        'd': [3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 1, 2, 0, 1, 2, 3]}
RHY = {'a': mk.RHY, 'b': [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0], 'c': [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]}
BASS = {'a': mk.BASS,
        'b': [(0, 0, .18), (3, 7, .1), (4, 12, .1), (6, 0, .12), (7, 4, .1), (8, 7, .18), (10, 0, .1), (11, 4, .1), (12, 7, .15), (14, 9, .1), (15, 7, .08)],
        'c': [(0, 0, .3), (3, 0, .1), (4, 7, .15), (6, 12, .1), (8, 0, .25), (11, 7, .1), (12, 4, .15), (14, 7, .15)],
        'bed': [(0, 0, .6), (6, 7, .15), (8, 0, .35), (11, 12, .1), (14, 7, .2)],
        'bed2': [(0, 0, .45), (3, 7, .12), (8, 0, .3), (10, 4, .12), (12, 7, .25)]}
CONGA = [(2, 'hi', .55), (3, 'hi', .35), (6, 'lo', .8), (10, 'hi', .55), (11, 'hi', .35), (14, 'lo', .8), (15, 'lo', .45)]

#            kick 4otf  clap  rim   hat    shaker ost(+12) skank bass  pad   conga
LV = {
    'intro': dict(kick=0, four=0, clap=0, rim=0, hat=0, ohat=0, shk=.07, ost=.10, oct=0, obr=.45, sk=0, bass=0, pad=.20, cg=0),
    'lite':  dict(kick=.5, four=0, clap=0, rim=.14, hat=0, ohat=0, shk=.12, ost=.15, oct=12, obr=.6, sk=.12, bass=.42, pad=.08, cg=0),
    'g1':    dict(kick=.62, four=0, clap=0, rim=.2, hat=.15, ohat=0, shk=0, ost=.17, oct=12, obr=.7, sk=.15, bass=.46, pad=0, cg=0),
    'g2':    dict(kick=.72, four=1, clap=.28, rim=.18, hat=.2, ohat=0, shk=.11, ost=.18, oct=12, obr=.7, sk=.16, bass=.5, pad=0, cg=.14),
    'full':  dict(kick=.75, four=1, clap=.32, rim=.2, hat=.22, ohat=1, shk=.13, ost=.2, oct=12, obr=.72, sk=.17, bass=.52, pad=.05, cg=.18),
    'bed':   dict(kick=.4, four=0, clap=0, rim=.08, hat=0, ohat=0, shk=.06, ost=0, oct=0, obr=0, sk=.06, bass=.37, pad=.13, cg=0),
}
# per-chapter plan: level + per-4-bar-phrase rotations (variation every 4 bars)
PLAN = {
    'hook':  dict(level='intro', bass=['bed'], pick=['a'], rhy=['b'], cg=[0]),
    'brand': dict(level='lite', bass=['a'], pick=['a'], rhy=['b'], cg=[0]),
    's1':    dict(level='g1', bass=['a', 'b'], pick=['a', 'c'], rhy=['a', 'b'], cg=[0]),
    's2':    dict(level='g2', bass=['b', 'a'], pick=['b', 'a'], rhy=['a', 'c'], cg=[1, 1]),
    's3':    dict(level='full', bass=['c', 'b'], pick=['d', 'a'], rhy=['b', 'a'], cg=[1, 1]),
    's4':    dict(level='bed', bass=['bed', 'bed2', 'bed'], pick=['a'], rhy=['b'], cg=[0, 1, 0]),
    's5':    dict(level='bed', bass=['bed2', 'bed', 'bed2'], pick=['a'], rhy=['b', 'c', 'b'], cg=[1, 0, 1]),
    's6':    dict(level='bed', bass=['bed', 'bed2'], pick=['a'], rhy=['c', 'b'], cg=[0, 1]),
    'recap': dict(level='full', bass=['b', 'c'], pick=['a', 'b'], rhy=['a', 'c'], cg=[1, 1]),
    'outro': dict(level='bed', bass=['bed', 'a'], pick=['a'], rhy=['b'], cg=[0, 0]),
}
HIT_KIND = {'brand': 'hit_big', 's1': 'hit_soft', 's2': 'hit_soft', 's3': 'hit_soft', 's4': 'hit_bed', 's5': 'hit_bed',
            's6': 'hit_bed', 'recap': 'hit_big', 'outro': 'hit_soft'}
LEAD_OK = {'hook', 'brand', 's1', 's2', 's3', 'recap'}          # never in s4-s6 (team voice on site) nor under Q6/V11


def bar_level(cid, i, n):
    lv = PLAN[cid]['level']
    if cid == 'outro' and i >= 3: return 'lite'                  # V11 brand line: lift a little before the cadence
    return lv


def build_bars():
    bars, g = [], 0
    for ci, c in enumerate(CHS):
        cs = c['start']; ce = FINAL_T if ci == len(CHS) - 1 else c['end']
        beats = int(round((ce - cs) / BEAT))
        assert abs(cs / BEAT - round(cs / BEAT)) < 1e-6, f'chapter {c["id"]} not on the beat grid'
        nfull, rem = divmod(beats, 4)
        lens = [4] * nfull + ([rem] if rem else [])
        base = PROG_BASE[c['id']]
        chords = [base[i % len(base)] for i in range(len(lens))]; chords[-1] = 'E'
        t = cs
        for i, (nb, chd) in enumerate(zip(lens, chords)):
            bars.append(dict(t0=t, nb=nb, cid=c['id'], ci=ci, i=i, n=len(lens), chord=chd, g=g, ce=ce,
                             level=bar_level(c['id'], i, len(lens)), phrase=i // 4))
            t += nb * BEAT; g += 1
    return bars


# ----------------------------------------------------------------------------- one bar of groove
def play_bar(B, bar):
    t0, nb, cid, i, g = bar['t0'], bar['nb'], bar['cid'], bar['i'], bar['g']
    L = LV[bar['level']]; P = PLAN[cid]; ph = bar['phrase']
    tones, root = CHORD[bar['chord']]
    pick = PICK[P['pick'][ph % len(P['pick'])]]; rhy = RHY[P['rhy'][ph % len(P['rhy'])]]
    bpat = BASS[P['bass'][ph % len(P['bass'])]]; cg_on = P['cg'][ph % len(P['cg'])]
    walk_from = bar['ce'] - WALK_BEATS * BEAT - 1e-6            # chapter-end walk-up replaces the pattern there
    phrase_fill = (i % 4 == 3) and i < bar['n'] - 1 and nb == 4
    hook_intro = cid == 'hook'
    for k in range(nb * 4):
        tt = t0 + k * S16 + (SWING if k % 2 else 0.0)
        # picked ostinato (low level; bright but quiet)
        if L['ost'] and pick[k] is not None and not (hook_intro and i == 0 and k < 2):
            m = tones[pick[k] % 4] + L['oct']
            B['gtr'].put(mk.guitar(mk.m2f(m), .32, L['obr'], .994, seed=g * 16 + k), tt,
                         L['ost'] * (1.25 if k % 4 == 0 else 1.0), .45)
        # muted skank
        if L['sk'] and rhy[k]:
            B['gtr'].put(mk.guitar(mk.m2f(tones[(k // 2) % 4]), .09, .45 if bar['level'] != 'bed' else 0.0, .98,
                                   seed=900 + g * 16 + k, mute=1), tt, L['sk'], -.45)
        # bass
        if L['bass'] and tt < walk_from:
            for st, semi, d in bpat:
                if st == k:
                    m = snap(root + semi) - 12
                    B['bass'].put(mk.bass(mk.m2f(m), d * 1.6, pop=1 if semi == 12 else .4), tt, L['bass'], 0)
        # hats / shaker
        if L['hat']:
            if bar['level'] == 'g1':
                if k % 2 == 0: B['drm'].put(mk.hat(g * 16 + k), tt, L['hat'] * (1 if k % 4 == 2 else .7), .25)
            else:
                op = L['ohat'] and k == 14 and not phrase_fill
                B['drm'].put(mk.hat(g * 16 + k, open_=op), tt, L['hat'] if k % 2 == 0 else L['hat'] * .55, .25)
        if L['shk'] and not (hook_intro and i == 0):
            lvl = bar['level']
            if lvl in ('g2', 'full'): gk = L['shk'] * (1 if k % 4 == 2 else .55)
            elif lvl == 'bed': gk = L['shk'] if k % 4 == 2 else 0
            else: gk = (L['shk'] if k % 4 == 2 else L['shk'] * .55) if k % 2 == 0 else 0
            if gk: B['drm'].put(shaker(5000 + g * 16 + k), tt, gk, -.3)
        # congas
        if L['cg'] and cg_on:
            for st, kind, a in CONGA:
                if st == k and not (phrase_fill and k >= 12): B['drm'].put(conga(kind, 7000 + g * 16 + k), tt, L['cg'] * a, -.35)
        if bar['level'] == 'bed' and cg_on and k in (6, 14):                   # soft tumba in the bed phrases
            B['drm'].put(conga('lo', 7500 + g * 16 + k), tt, .09, -.35)
    for b in range(nb):
        tb = t0 + b * BEAT
        last_fill_beat = phrase_fill and b == 3
        if L['kick'] and (L['four'] or b % 2 == 0): B['drm'].put(mk.kick(), tb, L['kick'])
        if L['clap'] and b in (1, 3) and not last_fill_beat: B['drm'].put(mk.clap(g * 4 + b), tb, L['clap'], -.1)
        if L['rim']:
            lv = bar['level']
            if lv == 'g1' and b in (1, 3): B['drm'].put(mk.rim(g * 4 + b), tb, L['rim'], .2)
            elif lv in ('g2', 'full') and b in (0, 2): B['drm'].put(mk.rim(g * 7 + b), tb + BEAT * .75, L['rim'], .2)
            elif lv == 'lite' and b == 3: B['drm'].put(mk.rim(g * 4 + b), tb, L['rim'], .2)
            elif lv == 'bed' and b == 3 and not last_fill_beat: B['drm'].put(mk.rim(g * 4 + b), tb, L['rim'], .2)
    # pad (chord per bar, overlapping release)
    if L['pad']:
        B['pad'].put(pad(bar['chord'], nb * BEAT, seed=g), t0, L['pad'])
    if phrase_fill: phrase_end_fill(B, bar)


def phrase_end_fill(B, bar):
    """Small fill on beat 4 of every 4th bar (variation every 4 bars)."""
    t = bar['t0'] + 3 * BEAT; g = bar['g']; lv = bar['level']
    if lv in ('g1', 'g2', 'full', 'lite'):
        if g % 2 == 0:
            for j, f in enumerate((210, 165, 125)): B['drm'].put(tom(f, g * 3 + j), t + j * S16 * (1.33 if j else 1), .32 + .04 * j, .3 - .3 * j)
        else:
            for j in range(3): B['drm'].put(snare(g * 5 + j), t + BEAT * .25 + j * S16, .14 + .06 * j, -.05)
    elif lv == 'bed':
        for j, (kind, dt) in enumerate((('hi', 0), ('hi', S16), ('lo', 2 * S16), ('lo', 3 * S16))):
            B['drm'].put(conga(kind, 9000 + g * 4 + j), t + dt + (SWING if j % 2 else 0), .13, -.35)


# ----------------------------------------------------------------------------- chapter transitions
WALK_BEATS = 2


def walk_notes(target, n):
    """n diatonic approach notes into `target` (played bass MIDI). From above if the target is low (A1/B1)."""
    if target <= 35:
        above = [m for m in range(target + 1, target + 13) if m % 12 in SCALE][:n]
        return above[::-1]
    below = [m for m in range(target - 1, target - 13, -1) if m % 12 in SCALE][:n]
    seq = below[::-1]
    if (target - 1) % 12 not in SCALE: seq = seq[1:] + [target - 1]            # chromatic last step (D -> D# -> E)
    return seq


def transitions(B, bars, hits):
    by_ch = {}
    for b in bars: by_ch.setdefault(b['cid'], []).append(b)
    for ci, c in enumerate(CHS):
        cb = by_ch[c['id']]; ce = cb[0]['ce']
        nxt = CHS[ci + 1]['id'] if ci + 1 < len(CHS) else None
        lv_end = cb[-1]['level']
        target = (CHORD['A'][1]) - 12                                          # every chapter (and the end) lands on A
        # bass walk-up / walk-down over the last WALK_BEATS beats (8ths)
        wn = walk_notes(target, 2 * WALK_BEATS)
        gb = .3 if c['id'] == 'hook' else LV[lv_end]['bass'] * .95
        for j, m in enumerate(wn):
            tt = ce - WALK_BEATS * BEAT + j * BEAT / 2
            B['bass'].put(mk.bass(mk.m2f(m), .26, pop=.7), tt, gb * (.85 + .05 * j), 0)
        # drum fill into the next chapter (last beat; 2 beats into the big hits)
        kind = HIT_KIND.get(nxt, 'final')
        g = cb[-1]['g']
        if kind in ('hit_big', 'final') or c['id'] == 'hook':
            nb = 2 if c['id'] != 'hook' else 1.5
            k = int(nb * 4)
            for j in range(k):
                tt = ce - nb * BEAT + j * S16
                if speaking(tt, tt + .05, 0): continue
                B['drm'].put(snare(300 + g * 16 + j), tt, .08 + .2 * (j / k) ** 1.5, -.05)
            for j, f in enumerate((200, 150, 110)):
                tt = ce - BEAT + (j + 1) * S16
                if c['id'] != 'hook' and not speaking(tt, tt + .05, 0): B['drm'].put(tom(f, 400 + g * 3 + j), tt, .35, .3 - .3 * j)
        elif kind == 'hit_soft':
            for j, f in enumerate((220, 180, 150, 120)):
                B['drm'].put(tom(f, 500 + g * 4 + j), ce - BEAT + j * S16 + (SWING if j % 2 else 0), .26 + .03 * j, .35 - .25 * j)
        else:                                                                  # into a footage chapter: soft congas
            for j, (cg, dt) in enumerate((('hi', 0), ('hi', S16), ('lo', 2 * S16), ('hi', 3 * S16 - .01), ('lo', 3 * S16 + .06))):
                B['drm'].put(conga(cg, 600 + g * 5 + j), ce - BEAT + dt, .15, -.3)
        # swell + hit on the next downbeat
        if nxt is None: continue
        hit(B, CHS[ci + 1]['start'], kind, nxt, ci + 1, hits)
    final_chord(B, hits)


SWELL = {'hit_big': 1.0, 'hit_soft': .75, 'hit_bed': .5, 'final': 1.0}


def hit(B, t, kind, cid, ci, hits):
    sw = SWELL[kind]; seed = 100 * ci
    B['fx'].put(swell(sw, seed, 9000 if kind == 'hit_big' else 6500), t - sw,
                {'hit_big': .5, 'hit_soft': .3, 'hit_bed': .16}[kind], .1)
    if kind == 'hit_big':
        B['fx'].put(cymbal(2.6, seed + 1, 10000, .9), t, .42, -.15)
        B['drm'].put(mk.kick(), t, .45)
        B['bass'].put(mk.bass(mk.m2f(33), 1.4, 1), t, .55)
        strum(B['gtr'], STRUM_V['A'], t - .02, .2, .75, 1.6, .997, seed + 10)
        strum(B['gtr'], STRUM_V['A_hi'], t + .005, .13, .8, 1.3, .996, seed + 20, gap=.008, spread=.8)
    elif kind == 'hit_soft':
        B['fx'].put(cymbal(1.8, seed + 1, 7500, .55), t, .24, .2)
        strum(B['gtr'], STRUM_V['A'], t - .015, .15, .65, 1.2, .996, seed + 10)
    else:                                                                      # footage chapters: mellow, low
        B['fx'].put(cymbal(1.5, seed + 1, 5500, .45), t, .12, .25)
        strum(B['gtr'], STRUM_V['A_soft'], t - .012, .13, .4, 1.4, .996, seed + 10, gap=.014)
    hits.append(dict(t=round(t, 3), kind=kind, chapter=cid, swell_from=round(t - sw, 3)))


def final_chord(B, hits):
    t = FINAL_T
    B['fx'].put(swell(SWELL['final'], 990, 8000), t - SWELL['final'], .32, 0)
    ring = DUR - t + .2
    strum(B['gtr'], STRUM_V['A_hi'], t, .28, .62, ring, .9988, 700, gap=.045, spread=.9)
    strum(B['gtr'], [45, 52, 57], t - .01, .2, .5, ring, .999, 720, gap=.02, spread=.3)
    B['bass'].put(mk.bass(mk.m2f(33), min(2.8, ring), 1), t, .6)
    B['drm'].put(mk.kick(), t, .6)
    B['fx'].put(cymbal(ring, 991, 9000, 1.3), t, .3, -.1)
    B['pad'].put(pad('A', ring - .5, lpf=1400, att=.08, rel=.5, seed=995), t, .16)
    hits.append(dict(t=round(t, 3), kind='final_chord', chapter=CHS[-1]['id'], swell_from=round(t - SWELL['final'], 3),
                     ring_until=round(DUR, 3)))


# ----------------------------------------------------------------------------- lead licks (gaps only)
THIRDS = [(57, 61), (59, 62), (61, 64), (62, 66), (64, 68), (66, 69), (68, 71), (69, 73), (71, 74), (73, 76), (74, 78),
          (76, 80), (78, 81), (80, 83), (81, 85), (83, 86), (85, 88)]
LICKS = {   # (16th position, thirds index relative to the landing dyad, length in 16ths)
    'cascade': [(0, 7, 1), (1, 6, 1), (2, 5, 1), (3, 4, 1), (4, 5, 1), (5, 4, 1), (6, 3, 1), (7, 2, 1), (8, 1, 1), (9, 0, 3)],
    'call':    [(0, 2, 2), (2, 4, 1), (3, 2, 1), (4, 1, 2), (6, 2, 1), (7, 0, 3)],
    'bounce':  [(0, 0, 1), (1, 2, 1), (2, 4, 1), (3, 2, 1), (4, 5, 2), (6, 4, 1), (7, 2, 1), (8, 0, 2)],
    'short':   [(0, 2, 1), (1, 1, 1), (2, 0, 1), (3, 1, 1), (4, 0, 2)],
    'rise':    [(0, -5, 1), (1, -4, 1), (2, -3, 1), (3, -2, 1), (4, -1, 1), (5, 0, 1)],
}


def chord_at(bars, t):
    for b in bars:
        if b['t0'] - 1e-6 <= t < b['t0'] + b['nb'] * BEAT - 1e-6: return b['chord'], b['cid']
    return 'A', CHS[-1]['id']


def lick_span(name): return max(p for p, _, _ in LICKS[name]) * S16          # start of the landing note


def lick_plan(bars):
    """Licks answer the chapter hits (after the downbeat, before the next line) or lead into the next chapter.
    Each entry: (preferred templates, first start, latest start of the landing note, hard stop, landing dyad).
    Every window is a speech gap from the timeline; the hard stop is before the next spoken word."""
    plan = []
    nxt_speech = lambda t: min([s for s, e, _, _ in SPEECH if s > t], default=DUR)
    v1_end = max(e for s, e, _, _ in SPEECH if e <= CHS[1]['start'])
    h = CHS[1]['start']                                                   # pickup run into the brand hit (G#-B -> A)
    plan.append((['rise'], math.ceil((v1_end + .05) / S16) * S16, h - S16, h + .3, 13))
    rot = ['call', 'bounce', 'call', 'bounce']
    for ci, c in enumerate(CHS[1:], 1):                                   # answer the hit (brand: the hit speaks alone)
        if c['id'] not in LEAD_OK or c['id'] == 'brand': continue
        ns_ = nxt_speech(c['start'])
        plan.append(([rot[ci % 4], 'bounce', 'call', 'short'], c['start'] + BEAT / 2, ns_ - .3, ns_ - .03,
                     9 if c['id'] == 's2' else 7))
    for ci, c in enumerate(CHS[:-1]):                                     # lead INTO a footage chapter / the outro
        nxt = CHS[ci + 1]
        if c['id'] not in LEAD_OK or nxt['id'] in LEAD_OK: continue
        last_sp = max([e for s, e, _, _ in SPEECH if e <= nxt['start']], default=0)
        plan.append((['cascade', 'bounce', 'short'], math.ceil((last_sp + .15) / S16) * S16, nxt['start'] - S16,
                     min(nxt['start'] + .3, nxt_speech(nxt['start']) - .05), 8))
    return plan


def licks(B, bars, hits):
    for li, (prefs, a, last_max, stop, land) in enumerate(lick_plan(bars)):
        a = math.ceil(a / S16 - 1e-6) * S16
        fit = [nm for nm in prefs if a + lick_span(nm) <= last_max + 1e-6]
        if not fit: continue
        name = fit[0]; placed = []
        for pos, rel, ln in LICKS[name]:
            t = a + pos * S16 + (SWING if pos % 2 else 0)
            d = min(ln * S16 + .25, stop - t)
            assert d > .05 and not speaking(t, t + d, .02), (name, t)
            idx = min(max(land + rel, 0), len(THIRDS) - 1)
            for v, m in enumerate(THIRDS[idx]):
                B['lead'].put(mk.guitar(mk.m2f(m), d, .78, .995, seed=3000 + li * 64 + pos * 2 + v),
                              t + v * .004, .17 if v else .2, .25 + .12 * v)
            placed.append(t + d)
        hits.append(dict(t=round(a, 3), kind='lead_lick', chapter=chord_at(bars, a)[1], end=round(max(placed), 3), name=name))


# ----------------------------------------------------------------------------- render
def render():
    B = {k: Bus() for k in ('drm', 'bass', 'gtr', 'lead', 'pad', 'fx')}
    bars = build_bars(); hits = []
    for bar in bars:
        if bar['t0'] >= FINAL_T - 1e-6: break
        play_bar(B, bar)
    # very first moment: a soft opening pluck + pad swell under the start of V01
    strum(B['gtr'], STRUM_V['A_soft'], 0.02, .1, .45, 2.0, .997, 5, gap=.03)
    transitions(B, bars, hits)
    licks(B, bars, hits)
    S = {k: v.st() for k, v in B.items()}
    S['bass'] = dsp.butter(S['bass'], 'hp', 32, 2)
    dry = S['drm'] + S['bass'] + S['gtr'] + S['lead'] * .9 + S['pad'] + S['fx']
    send = S['drm'] * .07 + S['gtr'] * .2 + S['lead'] * .3 + S['pad'] * .3 + S['fx'] * .25
    wet = dsp.reverb(send, dsp.make_ir(1.6, 1.3, 1.1, .55, seed=11), wet=1.0, hp_fc=250, lp_fc=8000)   # WET only
    dly = dsp.pingpong(S['lead'], 3 * S16, fb=.32, taps=4, lp_fc=4500, hp_fc=400) * .16
    y = dry + wet * .55 + dly
    y = dsp.dc_block(y)
    y = y * undb(-18 - dsp.lufs_integrated(y))
    y = dsp.compressor(y, thr_db=-16, ratio=1.6, att=.015, rel=.25, knee_db=6)      # gentle glue
    y = y * undb(-16 - dsp.lufs_integrated(y))
    y, gr = dsp.limiter(y, ceiling_db=-1.0)
    i0 = ns(FADE_FROM); f = np.cos(np.linspace(0, np.pi / 2, N - i0)) ** 2
    y[i0:] *= f[:, None]
    return y, bars, hits, gr


def report(y, bars, hits, gr):
    print('music: LUFS', round(dsp.lufs_integrated(y), 2), '| sample peak', round(float(np.abs(y).max()), 3),
          '| limiter GR max dB', round(float(-dsp.db(gr.min())), 2), '| len s', len(y) / SR)
    sp = np.zeros(N, bool)
    for s, e, _, _ in SPEECH: sp[ns(s):ns(e)] = True
    mid = dsp.butter(y, 'bp', [1000, 4000], 4)
    for c in CHS:
        m = np.zeros(N, bool); m[ns(c['start']):ns(min(c['end'], DUR))] = True
        nb = sum(1 for b in bars if b['cid'] == c['id'])
        lens = [b['nb'] for b in bars if b['cid'] == c['id']]
        print(f"  {c['id']:6s} {c['start']:6.1f}-{c['end']:6.1f}  bars {nb:2d} {lens}  level {PLAN[c['id']]['level']:5s}"
              f"  LUFS {dsp.lufs_integrated(y, m):6.1f}  1-4k share during speech "
              f"{dsp.lufs_integrated(mid, m & sp) - dsp.lufs_integrated(y, m & sp):5.1f} LU")
    for h in hits: print('  hit', h)


def main():
    os.makedirs(os.path.join(X, 'out'), exist_ok=True)
    y, bars, hits, gr = render()
    dsp.save(os.path.join(X, 'out', 'music.wav'), y)
    hits.sort(key=lambda h: h['t'])
    json.dump(hits, open(os.path.join(X, 'out', 'music_hits.json'), 'w'), indent=1)
    report(y, bars, hits, gr)


if __name__ == '__main__':
    main()

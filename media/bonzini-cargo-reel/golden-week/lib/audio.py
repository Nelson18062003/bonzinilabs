"""ALERTE edition: tense groove (120 BPM, D minor) + desk foley synced to the animation + final mix.
Everything is derived from data/timeline.json with the same word lookups as the overlay scenes.
usage: python3 audio.py   -> out/music.wav, out/sfx.wav, out/final_mix.wav"""
import os, sys, json, re, unicodedata, math
import numpy as np
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(F, '..', 'explainer', 'lib', 'audio'))
import dsp
from dsp import SR, ns, undb

TL = json.load(open(os.path.join(F, 'data', 'timeline.json')))
DUR = TL['duration']; N = ns(DUR); BEAT = 0.5
def nrm(w): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode())
def seg(i): return next(s for s in TL['segments'] if s['id'] == i)
def ch(i): return next(c for c in TL['chapters'] if c['id'] == i)
def wt(sid, s, end=False):
    k = nrm(s)
    for w in seg(sid)['words']:
        f = [nrm(w['w']), nrm(re.sub(r"^(?:[a-zA-Z]{1,2}|qu|jusqu)['’]", '', w['w']))]
        if any(x.startswith(k) for x in f): return w['e'] if end else w['s']
    return seg(sid)['end' if end else 'start']
step = lambda t: math.floor(t * 30 / 2) * 2 / 30          # on twos, like the picture
R = np.random.default_rng(7)

# ------------------------------------------------------------------ instruments
def env_exp(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def fm_pluck(f, dur=.7, idx=2.2, ratio=3.5, tau=.22, bright=1.0):
    n = ns(dur); t = np.arange(n) / SR; e = env_exp(n, tau); ie = env_exp(n, tau * .35)
    y = np.sin(2 * np.pi * f * t + idx * bright * ie * np.sin(2 * np.pi * f * ratio * t)) * e
    y[:ns(.003)] *= np.linspace(0, 1, ns(.003)); return y
def bass_note(f, dur):
    n = ns(dur); t = np.arange(n) / SR; e = np.minimum(1, t / .01) * np.exp(-t / .5)
    y = (np.sin(2 * np.pi * f * t) + .35 * dsp.tri(f, n)) * e
    return dsp.softclip(dsp.lp(y, 900), 1.3)
def kick():
    n = ns(.35); t = np.arange(n) / SR; f = 50 + 70 * np.exp(-t / .04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .12)
def snap(seed):
    n = ns(.12); x = dsp.noise(n, seed)[:, 0] if dsp.noise(8, 0).ndim > 1 else dsp.noise(n, seed)
    x = dsp.biquad(x, 'bp', 2300, 1.4) * env_exp(n, .025); x[:ns(.002)] *= 3; return x * 1.6
def shaker(seed):
    n = ns(.07); x = dsp.noise(n, seed); x = x[:, 0] if x.ndim > 1 else x
    return dsp.hp(x, 6000) * np.sin(np.linspace(0, np.pi, n)) ** 2 * .6
def pad_chord(freqs, dur):
    n = ns(dur); t = np.arange(n) / SR; e = np.minimum(1, t / .8) * np.minimum(1, (dur - t) / .8)
    y = sum(np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.003 * t) for f in freqs) / len(freqs)
    return dsp.lp(y * e, 1800)

def m2f(m): return 440 * 2 ** ((m - 69) / 12)
PROG = [('Dm', [62, 65, 69], 38), ('Bb', [62, 65, 70], 46), ('F', [60, 65, 69], 41), ('C', [60, 64, 67], 36)]   # per bar
ARP = [0, 2, 1, 2, 0, 1, 2, 1]

def music():
    L = np.zeros(N); Rr = np.zeros(N)
    def put(sig, t, g=1.0, p=0.0):
        i = ns(t)
        if i >= N: return
        s = sig[:N - i] * g; L[i:i + len(s)] += s * math.cos((p + 1) * math.pi / 4); Rr[i:i + len(s)] += s * math.sin((p + 1) * math.pi / 4)
    sec = {c['id']: (c['start'], c['end']) for c in TL['chapters']}
    def in_(t, *ids): return any(sec[i][0] <= t < sec[i][1] for i in ids)
    bars = int(DUR / (4 * BEAT)) + 1
    end_groove = seg('S8')['end'] + .3
    for b in range(bars):
        t0 = b * 4 * BEAT; name, tri_, root = PROG[b % 4]
        if t0 >= DUR - 2: break
        full = in_(t0, 'what', 'effects', 'tip1', 'tip2', 'tip3', 'outro') and t0 < end_groove
        breakdown = in_(t0, 'cny')
        # pad
        put(pad_chord([m2f(m) for m in tri_], 4 * BEAT + .6), t0, .10 if not breakdown else .16)
        # kalimba arpeggio (8ths) — lighter in the hook, brighter in the air section
        for k in range(8):
            tt = t0 + k * BEAT / 2
            if tt >= end_groove + 1.5: break
            note = tri_[ARP[k]] + (12 if in_(tt, 'tip1', 'tip2', 'tip3') and k % 2 else 0)
            if in_(tt, 'hook') and k % 2: continue
            put(fm_pluck(m2f(note + 12), .6, 2.0, 3.5, .18, 1.2 if in_(tt, 'effects') else 1.0), tt, .13, (-.4 if k % 2 else .4))
        if t0 >= end_groove: continue
        # bass
        if not in_(t0, 'hook') and not breakdown:
            for k, (off, d) in enumerate([(0, .45), (1.5, .25), (2, .45), (3.5, .2)]):
                put(bass_note(m2f(root - (12 if root > 40 else 0)), d), t0 + off * BEAT, .30)
        # drums
        for k in range(4):
            tt = t0 + k * BEAT
            if full and k in (0, 2): put(kick(), tt, .55)
            if not breakdown and k in (1, 3): put(snap(b * 4 + k), tt, .30, .15)
            for h in range(2 if not in_(tt, 'effects') else 4):
                if not breakdown and not in_(tt, 'hook') or (in_(tt, 'hook') and h == 1):
                    put(shaker(b * 16 + k * 4 + h), tt + h * BEAT / (2 if not in_(tt, 'effects') else 4), .22, -.3)
    # ticking clock (tension) in hook and effects
    tk = 0.0
    while tk < DUR:
        if in_(tk, 'hook', 'effects'): put(click(900 + int(tk * 4), 3400) * .5, tk, .35, .5)
        tk += BEAT / 2
    # accents on the big beats
    def hit(t, g=.5):
        put(pad_chord([m2f(50), m2f(57), m2f(62), m2f(65)], 1.6) * 1.2, t, g)
        put(kick(), t, .6)
    for t in (wt('S1', 'alerte'), ch('what')['start'], wt('S3', 'resultat'), wt('S8', 'bonzini') - .1): hit(t, .45)
    # final chord ring-out
    fin = end_groove + .1
    for i, m in enumerate([62, 65, 69, 74, 77]): put(fm_pluck(m2f(m), 3.0, 1.6, 3.5, .9), fin + i * .07, .16, (i - 2) * .2)
    put(pad_chord([m2f(50), m2f(62), m2f(65), m2f(69)], max(.5, DUR - fin)), fin, .22)
    y = np.stack([L, Rr], 1)
    y = dsp.reverb(y, dsp.make_ir(1.6, 1.4, 1.1, .5), wet=.18) if hasattr(dsp, 'reverb') else y
    fo = ns(1.2); y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return y

# ------------------------------------------------------------------ foley
def nz(n, seed):
    x = dsp.noise(n, seed); return x[:, 0] if x.ndim > 1 else x
def thud(g=1.0, f0=140, f1=55, seed=0):
    n = ns(.22); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t / .03)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .06)
    c = dsp.lp(nz(ns(.03), seed), 1500) * env_exp(ns(.03), .008) * .8; y[:len(c)] += c
    return y * g
def stamp(seed=0):
    y = thud(1.2, 180, 60, seed); k = dsp.biquad(nz(ns(.12), seed + 1), 'bp', 900, 6) * env_exp(ns(.12), .03) * 1.4
    y[:len(k)] += k; return y
def click(seed=0, f=2600):
    n = ns(.04); y = dsp.hp(nz(n, seed), 3000) * env_exp(n, .003) * .9
    t = np.arange(n) / SR; y += np.sin(2 * np.pi * f * t) * env_exp(n, .008) * .4; return y
def rip(seed=0, dur=.4):
    n = ns(dur); x = nz(n, seed); fc = np.linspace(3500, 1200, n)
    y = np.zeros(n); blk = 256
    for i in range(0, n, blk): y[i:i + blk] = dsp.biquad(x[i:i + blk], 'bp', float(fc[i]), 1.2)
    gate = (np.random.default_rng(seed).random(n // 200 + 1) > .35).repeat(200)[:n] * .7 + .3
    return y * gate * np.sin(np.linspace(0, np.pi, n)) ** .5 * 1.6
def whoosh(dur=.6, seed=0, lo=300, hi=3500):
    n = ns(dur); x = nz(n, seed); env = np.sin(np.linspace(0, np.pi, n)) ** 2
    fc = lo + (hi - lo) * np.sin(np.linspace(0, np.pi, n)); y = np.zeros(n); blk = 256
    for i in range(0, n, blk): y[i:i + blk] = dsp.biquad(x[i:i + blk], 'bp', float(fc[i]), .9)
    return y * env * 1.4
def beep(f=1900, dur=.11):
    n = ns(dur); t = np.arange(n) / SR; y = np.sign(np.sin(2 * np.pi * f * t)) * .25 + np.sin(2 * np.pi * f * t) * .3
    y *= np.minimum(1, np.minimum(t / .004, (dur - t) / .01)); return dsp.lp(y, 5000)
def ding(m=86, dur=1.0): return fm_pluck(m2f(m), dur, 1.4, 3.5, .35) * .8
def boing(dur=.55):
    n = ns(dur); t = np.arange(n) / SR; f = 260 + 140 * np.exp(-t / .2) * np.sin(2 * np.pi * 9 * t)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .2) * .7
def zip_(dur=.45, rate=34, seed=0):
    y = np.zeros(ns(dur))
    for k in range(int(dur * rate)): c = click(seed + k, 3200); i = ns(k / rate); y[i:i + len(c)] += c[:len(y) - i] * .5
    return y
def pop(seed=0):
    n = ns(.08); t = np.arange(n) / SR; f = 520 + 420 * (t / .08)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, .025) * .6; c = click(seed, 2000)[:n]; y[:len(c)] += c * .5; return y
def rustle(dur=.45, seed=0):
    n = ns(dur); x = dsp.biquad(nz(n, seed), 'bp', 4200, .8)
    am = np.abs(np.random.default_rng(seed).standard_normal(n // 300 + 1)).repeat(300)[:n]
    return x * dsp.onepole_lp(am, 40) * np.sin(np.linspace(0, np.pi, n)) * 1.2
def horn(dur=1.3):
    n = ns(dur); t = np.arange(n) / SR; y = dsp.lp(dsp.saw(110, n) + .5 * dsp.saw(165, n), 700)
    return y * np.minimum(1, t / .25) * np.minimum(1, (dur - t) / .4) * .35
def waves(dur, seed=3):
    n = ns(dur); x = dsp.lp(np.cumsum(nz(n, seed)) * .02, 900); x -= dsp.lp(x, 40)
    sw = .55 + .45 * np.sin(2 * np.pi * .35 * np.arange(n) / SR); e = np.minimum(1, np.minimum(np.arange(n) / ns(.6), (n - np.arange(n)) / ns(.6)))
    return x * sw * e * 2.5
def chime(): y = np.zeros(ns(2.0))
def bell_arp(ms=(74, 78, 81, 86)):
    y = np.zeros(ns(2.2))
    for i, m in enumerate(ms): p = fm_pluck(m2f(m), 1.8, 1.6, 3.5, .5); i0 = ns(i * .07); y[i0:i0 + len(p)] += p[:len(y) - i0] * .6
    return y
def scribble(dur=.6, seed=0):
    n = ns(dur); x = dsp.hp(nz(n, seed), 2500); am = (np.sin(2 * np.pi * 14 * np.arange(n) / SR) * .5 + .5) ** 2
    return x * am * np.sin(np.linspace(0, np.pi, n)) * .6

def siren(dur=1.2):
    n = ns(dur); t = np.arange(n) / SR; f = np.where((t * 2.5) % 1 < .5, 740, 587)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * .4 + .15 * np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
    return dsp.lp(y, 3000) * np.minimum(1, np.minimum(t / .05, (dur - t) / .3)) * .6
def rattle(dur=.6, seed=0):                      # metal shutter rolling down
    y = np.zeros(ns(dur)); k = 0; tt = 0.0
    while tt < dur - .02: c = dsp.biquad(nz(ns(.02), seed + k), 'bp', 1400 + 300 * (k % 3), 3) * env_exp(ns(.02), .006); i = ns(tt); y[i:i + len(c)] += c[:len(y) - i] * .8; tt += .035 + .01 * (k % 2); k += 1
    y += dsp.lp(nz(len(y), seed + 99), 400) * .15 * np.linspace(1, .3, len(y)); return y
def grind(dur=1.3, seed=0):                      # gears slowing to a stop
    n = ns(dur); t = np.arange(n) / SR; f = 60 * (1 - t / dur) ** 1.5 + 8
    ph = np.cumsum(f) / SR; y = np.zeros(n)
    for i in np.where(np.diff(np.floor(ph * 12)) > 0)[0]: c = click(seed + i, 1500)[: n - i]; y[i:i + len(c)] += c * .6
    return y + dsp.lp(nz(n, seed), 300) * .2 * (1 - t / dur)
def buzz(dur=.35):
    n = ns(dur); t = np.arange(n) / SR; return np.sin(2 * np.pi * 150 * t) * (np.sin(2 * np.pi * 30 * t) > 0) * .35 * np.minimum(1, (dur - t) / .05)
def gong_pent(t0_list): pass

def sfx():
    L = np.zeros(N); Rr = np.zeros(N)
    def put(sig, t, g=1.0, p=0.0):
        i = ns(max(0.0, t))
        if i >= N: return
        s = sig[:N - i] * g; L[i:i + len(s)] += s * math.cos((p + 1) * math.pi / 4); Rr[i:i + len(s)] += s * math.sin((p + 1) * math.pi / 4)
    # hook: tapes slap, siren, ALERTE stamp, 7 "FERMÉ" stamps, "la Chine s'arrête"
    put(whoosh(.35, 1, 300, 3000), 0.0, .6, -.6); put(rip(2, .25), .1, .5, -.5); put(whoosh(.35, 3, 300, 3000), .12, .6, .6); put(rip(4, .25), .24, .5, .5)
    put(siren(1.3), .2, .35); put(stamp(5), wt('S1', 'alerte') - .05, 1.1)
    put(thud(.6, 150, 60, 6), wt('S1', 'importateurs'), .6)
    p0, p1 = wt('S1', 'premier'), wt('S1', 'octobre', True) + .5
    put(whoosh(.5, 7, 250, 2000), p0 - .4, .4)
    for d in range(7): put(stamp(10 + d) * .6, p0 + d * (p1 - p0) / 7, .8, (d - 3) * .15)
    put(thud(1.0, 110, 45, 20), wt('S1', 'chine'), .9)
    # what
    put(pop(30), wt('S2', 'golden'), .5); put(bell_arp((74, 77, 81, 86)), wt('S2', 'golden'), .5)
    for i, w in enumerate(('usines', 'fournisseurs', 'bureaux')): put(thud(.5, 140, 60, 31 + i), wt('S2', w) - .05, .6, (i - 1) * .6)
    for i in range(3): put(rattle(.6, 40 + i * 10), wt('S2', 'ferment') - .1 + i * .12, .6, (i - 1) * .6)
    put(stamp(50), wt('S2', 'semaine'), .9)
    # effects
    put(thud(.8, 130, 55, 60), wt('S3', 'resultat'), .6); put(grind(1.3, 61), wt('S3', 'production'), .7, -.5)
    put(stamp(62) * .7, wt('S3', 'production') + .75, .7, -.5)
    for i, dt in enumerate((-.1, .35, .8)): put(pop(70 + i), wt('S3', 'messages') + dt, .6, .5)
    put(buzz(), wt('S3', 'messages') + 1.2, .4, .5)
    for d in range(2): put(beep(700 - d * 60, .12), wt('S3', 'apres') + d * .25, .4)
    # tips
    put(whoosh(.6, 80, 250, 2200), ch('tip1')['start'] - .1, .5); put(thud(.8, 120, 50, 81), ch('tip1')['start'] + .3, .6)
    for w, sg, off in (('un', 'S4', 0), ('deux', 'S5', 1), ('trois', 'S6', 2)): put(pop(90 + off), wt(sg, w) - .1, .6)
    for w, sg, off in (('attendra', 'S4', 0), ('marge', 'S5', 1), ('annee', 'S6', 2)): put(stamp(95 + off) * .8, wt(sg, w), .8, .4)
    # CNY teaser: pentatonic chime + lanterns
    put(bell_arp((74, 76, 79, 81, 86)), wt('S7', 'nouvel') - .1, .7); put(whoosh(.5, 100, 300, 2000), wt('S7', 'nouvel') - .45, .4)
    put(scribble(.5, 101), wt('S7', 'six'), .5)
    # outro
    put(whoosh(.5, 110, 300, 3000), wt('S8', 'partagez') - .2, .5); put(pop(111), wt('S8', 'partagez'), .6)
    put(bell_arp(), wt('S8', 'bonzini') - .1, .7); put(scribble(.6, 112), wt('S8', 'previent'), .5)
    put(rip(113, .8), seg('S8')['end'] + .2, .5)
    # caution-tape wipes
    for cid in ('what', 'effects', 'tip1', 'cny', 'outro'):
        c = ch(cid)['start']; put(whoosh(.55, 120, 200, 2600), c - .3, .5); put(rip(121, .35), c - .1, .45)
    return np.stack([L, Rr], 1)

def main():
    voice = dsp.load(os.path.join(F, 'audio', 'voice.wav'), N)
    v = voice[:, 0]
    v = dsp.hp(v, 80); v = dsp.compressor(v, thr_db=-22, ratio=2.2, att=.006, rel=.12)
    v = v.mean(1) if v.ndim == 2 else v
    v = v * undb(-16 - dsp.lufs_integrated(np.stack([v, v], 1)))
    V = np.stack([v, v], 1)
    mu = music(); fx = sfx()
    # ducking from the speech intervals
    iv = [(s['start'] - .06, s['end'] + .1) for s in TL['segments']]
    g = np.ones(N)
    for a, b in iv: g[ns(a):ns(b)] = undb(-9)
    g = dsp.onepole_lp(g, 6.0)
    gf = dsp.onepole_lp(np.where(g < 1, undb(-3), 1.0), 6.0)
    fx = dsp.lp(fx, 9000)
    mu *= undb(-20.5 - dsp.lufs_integrated(mu)); fx *= undb(-23 - dsp.lufs_integrated(fx))
    mix = V + mu * g[:, None] + fx * gf[:, None]
    mix = dsp.compressor(mix, thr_db=-16, ratio=1.8, att=.01, rel=.2)
    mix = mix * undb(-14 - dsp.lufs_integrated(mix))
    mix, _ = dsp.limiter(mix, ceiling_db=-1.2)
    mix = mix * undb(-14 - dsp.lufs_integrated(mix)); mix, _ = dsp.limiter(mix, ceiling_db=-1.3)
    os.makedirs(os.path.join(F, 'out'), exist_ok=True)
    dsp.save(os.path.join(F, 'out', 'music.wav'), mu); dsp.save(os.path.join(F, 'out', 'sfx.wav'), fx)
    dsp.save(os.path.join(F, 'out', 'final_mix.wav'), mix, 'PCM_24')
    sp = np.zeros(N, bool)
    for a, b in iv: sp[ns(a):ns(b)] = True
    others = mu * g[:, None] + fx * gf[:, None]
    print('LUFS', round(dsp.lufs_integrated(mix), 2), 'dur', len(mix) / SR,
          '| voice-over-bed during speech (LU):', round(dsp.lufs_integrated(V, sp) - dsp.lufs_integrated(others, sp), 1))

if __name__ == '__main__':
    main()

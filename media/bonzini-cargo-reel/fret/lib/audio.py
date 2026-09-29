"""Music (warm hand-made groove, 120 BPM, D major) + desk foley synced to the animation + final mix.
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
PROG = [('D', [62, 66, 69], 38), ('A', [61, 64, 69], 45), ('Bm', [62, 66, 71], 47), ('G', [62, 67, 71], 43)]   # per bar
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
    end_groove = seg('S10')['end'] + .3
    for b in range(bars):
        t0 = b * 4 * BEAT; name, tri_, root = PROG[b % 4]
        if t0 >= DUR - 2: break
        full = in_(t0, 'label', 'track', 'resell', 'sea', 'air', 'tip') and t0 < end_groove
        breakdown = in_(t0, 'modes')
        # pad
        put(pad_chord([m2f(m) for m in tri_], 4 * BEAT + .6), t0, .10 if not breakdown else .16)
        # kalimba arpeggio (8ths) — lighter in the hook, brighter in the air section
        for k in range(8):
            tt = t0 + k * BEAT / 2
            if tt >= end_groove + 1.5: break
            note = tri_[ARP[k]] + (12 if in_(tt, 'air', 'outro') and k % 2 else 0)
            if in_(tt, 'hook') and k % 2: continue
            put(fm_pluck(m2f(note + 12), .6, 2.0, 3.5, .18, 1.2 if in_(tt, 'air') else 1.0), tt, .13, (-.4 if k % 2 else .4))
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
            for h in range(2 if not in_(tt, 'air') else 4):
                if not breakdown and not in_(tt, 'hook') or (in_(tt, 'hook') and h == 1):
                    put(shaker(b * 16 + k * 4 + h), tt + h * BEAT / (2 if not in_(tt, 'air') else 4), .22, -.3)
    # accents on the big beats
    def hit(t, g=.5):
        put(pad_chord([m2f(50), m2f(57), m2f(62), m2f(66)], 1.6) * 1.2, t, g)
        put(kick(), t, .6)
    for t in (wt('S2', 'bonzini') + .08, wt('S5', 'transparence'), ch('sea')['start'], wt('S10', 'cargo') - .1): hit(t, .45)
    # final chord ring-out
    fin = end_groove + .1
    for i, m in enumerate([62, 66, 69, 74, 78]): put(fm_pluck(m2f(m), 3.0, 1.6, 3.5, .9), fin + i * .07, .16, (i - 2) * .2)
    put(pad_chord([m2f(50), m2f(62), m2f(66), m2f(69)], DUR - fin), fin, .22)
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

def sfx():
    L = np.zeros(N); Rr = np.zeros(N)
    def put(sig, t, g=1.0, p=0.0):
        i = ns(max(0.0, t))
        if i >= N: return
        s = sig[:N - i] * g; L[i:i + len(s)] += s * math.cos((p + 1) * math.pi / 4); Rr[i:i + len(s)] += s * math.sin((p + 1) * math.pi / 4)
    # hook: 12 carton landings (same seeded delays as the picture), hop, shuffle
    for i in range(12):
        d = .05 + ((i * 5) % 12) * .045; put(thud(.55, 120 + (i % 4) * 10, 55, i), step(d + .3), .9, ((i % 3) - 1) * .5)
    for i in range(12): put(thud(.25, 150, 70, 40 + i), wt('S1', 'ressemblent') + .25 + i * .015, .5, ((i % 3) - 1) * .5)
    put(rustle(1.1, 5), wt('S1', 'alors'), .7); put(whoosh(.9, 6, 200, 1500), wt('S1', 'alors') + .1, .35)
    # code
    ts = wt('S2', 'bonzini') + .08
    put(whoosh(.5, 8, 400, 2500), ts - .5, .35); put(stamp(1), ts, 1.0)
    put(whoosh(.7, 9, 250, 1800), wt('S2', 'chaque'), .5); put(whoosh(.6, 10, 300, 2400), wt('S2', 'code') - .15, .4)
    bz, six, chf = wt('S2', 'bz'), wt('S2', 'six'), wt('S2', 'chiffres', True)
    for i in range(9):
        ti = bz + i * .12 if i < 3 else six + (i - 3) * ((chf + .2 - six) / 6)
        put(click(20 + i, 2400 + i * 40), step(ti + .2), .8, (i - 4) * .1); put(thud(.25, 200, 90, 30 + i), step(ti + .2), .5)
    put(stamp(2), wt('S2', 'toujours') + .1, .9)
    # label
    lab = ch('label')['start']; put(rustle(.5, 11), lab + .05, .6)
    for i in range(3): put(whoosh(.45, 12 + i, 300, 2000), lab + .25 + i * .12, .3, .6)
    for i, w in enumerate(['colle', 'chaque', 'carton']):
        tt = step(wt('S3', w) + .16); put(thud(.5, 160, 70, 50 + i), tt, .8, (i - 1) * .5); put(rip(60 + i, .3), tt + .03, .45, (i - 1) * .5)
    # tape-wipe transitions
    for cid in ('track', 'resell', 'modes', 'tip', 'outro'):
        c = ch(cid)['start']; put(whoosh(.6, 70, 200, 2600), c - .32, .5); put(rip(71, .45), c - .12, .55)
    # track
    put(pop(80), wt('S4', 'guangzhou'), .7); sc = wt('S4', 'scan')
    put(whoosh(.45, 81, 400, 3000), sc - .45, .35, .6); put(beep(), sc, .7); put(beep(2400, .08), sc + .14, .5)
    put(ding(86), wt('S4', 'votre'), .5); put(boing(), wt('S4', 'pese'), .6); put(zip_(.45, 34, 82), wt('S4', 'mesure'), .6)
    t0, t1 = wt('S4', 'suivi'), wt('S4', 'douala') + .35
    for i in range(5): tt = t0 + (i + .5) * (t1 - t0) / 5; put(click(90 + i, 1800), tt, .8, (-.3 if i % 2 else .3)); put(thud(.3, 180, 90, 95 + i), tt, .5)
    put(ding(90, 1.4), wt('S4', 'douala') + .1, .55)
    # resell
    rs = ch('resell')['start']; put(thud(.8, 110, 50, 100), rs + .25, .8); put(rustle(.6, 101), wt('S5', 'chacun') - .1, .7)
    for i in range(4): put(pop(110 + i), wt('S5', 'chacun') + .05 + i * .12, .7, (i - 1.5) * .4)
    for i in range(4): put(thud(.35, 190, 90, 120 + i), wt('S5', 'code') + i * .1, .6, (i - 1.5) * .4)
    put(stamp(3), wt('S5', 'transparence'), 1.0)
    # modes
    put(rip(130, .5), wt('S6', 'deux'), .6); put(rustle(.8, 131), wt('S6', 'deux') + .3, .6)
    # sea
    sea = ch('sea'); put(waves(sea['end'] - sea['start'] + .5, 140), sea['start'] - .2, .55); put(horn(), wt('S7', 'maritime') - .1, .5)
    for w in ('conteneur', 'metre', 'economique'): put(pop(141), wt('S7', w), .55)
    for k in range(12): put(click(150 + k, 2000), wt('S7', 'metre') + k / 12, .35)
    # air
    air = ch('air')['start']; put(whoosh(2.0, 160, 500, 5000), air + .1, .75); put(whoosh(.8, 161, 800, 6000), air + 1.3, .5, .6)
    for w in ('avion', 'kilo', 'rapide', 'petits'): put(pop(162), wt('S8', w), .55)
    put(boing(), wt('S8', 'kilo') + .05, .6); put(thud(.6, 200, 80, 163), wt('S8', 'urgent'), .8); put(rip(164, .2), wt('S8', 'urgent'), .4)
    # tip
    put(whoosh(.5, 170, 300, 2500), wt('S9', 'bleue') - .25, .45, -.5); put(whoosh(.5, 171, 300, 2500), wt('S9', 'rouge') - .25, .45, .5)
    put(pop(172), wt('S9', 'bateau'), .6); put(pop(173), wt('S9', 'avion'), .6); put(scribble(.5, 174), wt('S9', 'retenez'), .5)
    # outro
    oc = ch('outro')['start']; put(zip_(.35, 40, 180), oc + .15, .45); put(zip_(.35, 40, 181), oc + .4, .45)
    put(rustle(.4, 182), wt('S10', 'bonzini') - .1, .6); put(bell_arp(), wt('S10', 'cargo') - .1, .7)
    put(pop(183), wt('S10', 'code'), .55); put(pop(184), wt('S10', 'colis'), .55); put(scribble(.7, 185), wt('S10', 'transparence'), .5)
    put(rip(186, .9), seg('S10')['end'] + .15, .5)
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

"""« DOUANE · Partie 1 » — bikutsi groove (120 BPM grid, 12/8 feel, E minor) + customs foley + final mix.
Everything is derived from data/timeline.json with the same word lookups as the overlay scenes.
Scene-specific cues live in cues.py (CHAPTER_LEVEL, HITS, cues(put)) so this engine stays generic.
usage: python3 audio.py   -> out/music.wav, out/sfx.wav, out/final_mix.wav"""
import os, sys, json, re, unicodedata, math
import numpy as np
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(F, '..', 'explainer', 'lib', 'audio')); sys.path.insert(0, os.path.dirname(__file__))
import dsp
from dsp import SR, ns, undb
import makossa as mk
import bikutsi as bk
import customs_sfx as fx

TL = json.load(open(os.path.join(F, 'data', 'timeline.json')))
DUR = TL['duration']; N = ns(DUR); BEAT = 0.5; BAR = 4 * BEAT
def nrm(w): return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode())
def seg(i): return next(s for s in TL['segments'] if s['id'] == i)
def ch(i): return next(c for c in TL['chapters'] if c['id'] == i)
def wt(sid, s, end=False, nth=0):
    k = nrm(s); c = 0
    for w in seg(sid)['words']:
        f = [nrm(w['w']), nrm(re.sub(r"^(?:[a-zA-Z]{1,2}|qu|jusqu)['’]", '', w['w']))]
        if any(x.startswith(k) for x in f):
            if c == nth: return w['e'] if end else w['s']
            c += 1
    return seg(sid)['end' if end else 'start']
def chapter_at(t):
    for c in TL['chapters']:
        if c['start'] <= t < c['end']: return c['id']
    return TL['chapters'][-1]['id']

class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def put(self, sig, t, g=1.0, p=0.0):
        i = ns(max(0.0, t))
        if i >= N: return
        s = sig[:N - i] * g; self.L[i:i + len(s)] += s * math.cos((p + 1) * math.pi / 4); self.R[i:i + len(s)] += s * math.sin((p + 1) * math.pi / 4)
    def stereo(self): return np.stack([self.L, self.R], 1)

import cues                                       # CHAPTER_LEVEL, TENSE, END_SEG, hits(put, H), sfx(put, H)
H = sys.modules[__name__]                         # helpers handed to cues: H.wt, H.seg, H.ch, H.fx, H.mk, H.DUR

def music():
    b = Bus()
    end_groove = seg(cues.END_SEG)['end'] + .4
    bars = int(DUR / BAR) + 1
    for k in range(bars):
        t0 = k * BAR
        if t0 >= end_groove: break
        lvl, tense = cues.level_at(t0 + .01, H)
        if lvl == 'silent': continue
        bk.groove(b.put, t0, k, BEAT, lvl, bk.PROG_TENSE if tense else bk.PROG)
    cues.hits(b.put, H)
    # final chord ring-out (E minor add9, picked) + balafon sparkle
    fin = math.ceil(end_groove / BEAT) * BEAT
    for i, m in enumerate([40, 47, 52, 55, 59, 66]): b.put(mk.guitar(mk.m2f(m + 12), 3.2, .6, .9985, 700 + i), fin + i * .06, .3, (i - 2.5) * .15)
    for i, m in enumerate([76, 79, 83, 88]): b.put(bk.balafon(bk.m2f(m), .6, 800 + i), fin + .3 + i * .11, .18, .4 - i * .25)
    b.put(mk.bass(mk.m2f(28), 2.5, 1), fin, .6)
    y = b.stereo()
    y = dsp.reverb(y, dsp.make_ir(1.4, 1.2, 1.0, .5), wet=.14)
    fo = ns(1.2); y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return y

def sfx():
    b = Bus(); cues.sfx(b.put, H); return b.stereo()

def main():
    voice = dsp.load(os.path.join(F, 'audio', 'voice.wav'), N)
    v = voice[:, 0]
    v = dsp.hp(v, 80); v = dsp.compressor(v, thr_db=-22, ratio=2.2, att=.006, rel=.12)
    v = v.mean(1) if v.ndim == 2 else v
    v = v * undb(-16 - dsp.lufs_integrated(np.stack([v, v], 1)))
    V = np.stack([v, v], 1)
    mu = music(); fxb = sfx()
    iv = [(s['start'] - .06, s['end'] + .1) for s in TL['segments']]
    g = np.ones(N)
    for a, b in iv: g[ns(a):ns(b)] = undb(-9)
    g = dsp.onepole_lp(g, 6.0)
    gf = dsp.onepole_lp(np.where(g < 1, undb(-5), 1.0), 6.0)
    fxb = dsp.lp(fxb, 9500)
    mu *= undb(-21 - dsp.lufs_integrated(mu))
    lf = dsp.lufs_integrated(fxb)
    if np.isfinite(lf): fxb *= undb(-24.5 - lf)
    mix = V + mu * g[:, None] + fxb * gf[:, None]
    mix = dsp.compressor(mix, thr_db=-16, ratio=1.8, att=.01, rel=.2)
    mix = mix * undb(-14 - dsp.lufs_integrated(mix))
    mix, _ = dsp.limiter(mix, ceiling_db=-1.2)
    mix = mix * undb(-14 - dsp.lufs_integrated(mix)); mix, _ = dsp.limiter(mix, ceiling_db=-1.3)
    os.makedirs(os.path.join(F, 'out'), exist_ok=True)
    dsp.save(os.path.join(F, 'out', 'music.wav'), mu); dsp.save(os.path.join(F, 'out', 'sfx.wav'), fxb)
    dsp.save(os.path.join(F, 'out', 'final_mix.wav'), mix, 'PCM_24')
    sp = np.zeros(N, bool)
    for a, b in iv: sp[ns(a):ns(b)] = True
    others = mu * g[:, None] + fxb * gf[:, None]
    print('LUFS', round(dsp.lufs_integrated(mix), 2), 'dur', len(mix) / SR,
          '| voice-over-bed during speech (LU):', round(dsp.lufs_integrated(V, sp) - dsp.lufs_integrated(others, sp), 1))

if __name__ == '__main__':
    main()

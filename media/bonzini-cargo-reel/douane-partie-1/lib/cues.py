"""Cue sheet for « DOUANE · Partie 1 » V2 (« Le premier conteneur de Junior »): music follows the story, foley on the scenes' impacts.
Extra cues can be merged from data/cues_scenes.json: [{seg, word, nth, offset, sound, gain, pan}]."""
import os, json, math
import numpy as np

F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
END_SEG = 'S30'

def level_at(t, H):
    """(level, tense) for the bar starting at t. levels: silent | lite | tense | bass | drums | full"""
    S, s = H.wt, H.seg
    if t < s('S5')['start'] - .6: return ('lite', False)                  # soft groove: the stakes, the fear, the secret
    if t < s('S15')['start'] - .4: return ('full', False)                # walking groove from « J'arrive ! »
    if t < s('S18')['start'] - .6: return ('silent', False)              # S15 held note, S16–S17 near-silence + heartbeat (hits)
    if t < s('S19')['start'] - .3: return ('lite', False)                # S18 warm return
    if t < s('S21')['start'] - .5: return ('bass', False)                # conformity: calm, grounded
    if t < s('S23')['start'] - .5: return ('lite', False)                # payment, BAE
    if t < s('S25')['start'] - .4: return ('full', False)                # barrier: small triumph, the mirror
    if t < s('S26')['start'] - .5: return ('lite', False)                # evening road, Saturday
    return ('full', False)                                               # Bonzini, part 2, sign

def hits(put, H):
    mk, bk, fx = H.mk, H.bk, H.fx
    S, s = H.wt, H.seg
    # the doubt: one held chord under S15, then a heartbeat under the scanner (S16–S17)
    put(fx.pad((164.8, 246.9, 329.6), max(2.5, s('S16')['start'] - s('S15')['start'] + .6), 1), s('S15')['start'] - .5, .45)
    hb0 = s('S16')['start'] + .2; nb = int(max(4, (s('S18')['start'] - hb0) / (60 / 72)))
    put(fx.heartbeat(nb, 72, 2), hb0, .8)
    # the revelation: a warm balafon arpeggio on « correspond »
    tr = S('S18', 'correspond')
    for i, m in enumerate([64, 67, 71, 76, 79]): put(bk.balafon(bk.m2f(m), .5, 300 + i), tr + i * .09, .28, (i - 2) * .25)
    # the barrier: small triumph
    tb = S('S23', 'barriere')
    for i, m in enumerate([52, 59, 64, 67, 71]): put(mk.guitar(mk.m2f(m + 12), 1.4, .7, .997, 400 + i), tb + i * .05, .22, (i - 2) * .2)
    put(mk.kick(), tb, .6); put(mk.bass(mk.m2f(28), .8, 1), tb, .5)
    # accents
    for sid, w in (('S5', 'arrive'), ('S26', 'reussissiez'), ('S30', 'bonzini')):
        tt = S(sid, w); put(mk.kick(), tt, .5); put(mk.bass(mk.m2f(28), .5, 1), tt, .4)

def sfx(put, H):
    fx = H.fx
    S = lambda sid, w, nth=0, end=False: H.wt(sid, w, end=end, nth=nth)
    # impacts: one sound per camera shake registered by the scenes (data/shakes.json, dumped by render.mjs --dump-shakes)
    sp = os.path.join(F, 'data', 'shakes.json'); last = -9
    for i, k in enumerate(sorted(json.load(open(sp)), key=lambda x: x['t0']) if os.path.exists(sp) else []):
        t, a = k['t0'], k['amp']
        if t - last < .06: continue
        last = t
        if a >= 13: put(fx.stamp_hit(300 + i), t - .01, 1.0); put(fx.thud_s(.6, 120, 45, 400 + i), t, .45)
        elif a >= 9: put(fx.thud_s(.9, 160, 58, 400 + i), t - .01, .75); put(fx.paper_flick(500 + i), t - .03, .35)
        elif a >= 6: put(fx.thud_s(.6, 190, 80, 400 + i), t - .01, .5); put(fx.paper_flick(500 + i), t - .03, .3)
        else: put(fx.pop_s(600 + i), t - .01, .35); put(fx.paper_flick(500 + i), t - .02, .25)
    # extra per-scene cues (written after the scenes exist)
    p = os.path.join(F, 'data', 'cues_scenes.json')
    if os.path.exists(p):
        for i, c in enumerate(json.load(open(p))):
            try:
                t = S(c['seg'], c['word'], c.get('nth', 0), c.get('end', False)) if 'word' in c else H.seg(c['seg'])['start' if c.get('at', 'start') == 'start' else 'end']
                put(getattr(fx, c['sound'])(*c.get('args', [])), t + c.get('offset', 0), c.get('gain', .6), c.get('pan', 0))
            except Exception as e:
                print('cue skipped', c, e)

"""Cue sheet for « DOUANE · Partie 2 » (« La tontine de Christelle »): a Douala makossa groove that follows the week,
ambience beds per place (maquis at night, market, office), foley on the scenes' impacts and per-scene cues.
Extra cues can be merged from data/cues_scenes.json: [{seg, word, nth, offset, sound, gain, pan}]."""
import os, json
import numpy as np
import amb

F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
END_SEG = 'S32'
GENRE = 'makossa'
FINAL = ([45, 52, 57, 61, 64, 69], [76, 81, 85, 88], 33)          # A major ring-out (makossa key)

def level_at(t, H):
    """(level, tense) for the bar starting at t. levels: silent | lite | tense | bass | full"""
    s = H.seg
    if t < s('S5')['start'] - .8: return ('lite', False)                  # Saturday night: the tontine, the envelope, the pact
    if t < s('S10')['start'] - .8: return ('full', False)                 # Monday: market groove, the note grows line by line
    if t < s('S12')['start'] - .5: return ('bass', False)                 # Tuesday: conformity, grounded
    if t < s('S14')['start'] - .8: return ('tense', True)                 # the fine, splitting is forbidden
    if t < s('S18')['start'] - .8: return ('lite', False)                 # Wednesday: the simulation
    if t < s('S20')['start'] - .8: return ('full', False)                 # Thursday: the Roi du forfait (comic)
    if t < s('S25')['start'] - .8: return ('bass', False)                 # Friday: Madame Ekambi's office
    if t < s('S28')['start'] - .6: return ('full', False)                 # Saturday night: the envelope, the toast
    if t < s('S29')['start'] - .6: return ('lite', False)                 # later: the calculated note
    return ('full', False)                                                # Bonzini, question, signature

def hits(put, H):
    mk, bk, fx = H.mk, H.bk, H.fx
    S, s = H.wt, H.seg
    # the toast: a small triumph on « su avant »
    tb = S('S27', 'avant')
    for i, m in enumerate([57, 61, 64, 69, 73]): put(mk.guitar(mk.m2f(m + 12), 1.4, .7, .997, 400 + i), tb + i * .05, .22, (i - 2) * .2)
    put(mk.kick(), tb, .6); put(mk.bass(mk.m2f(33), .8, 1), tb, .5)
    # a warm balafon when the calculated note matches the envelope (épilogue)
    tr = S('S28', 'surprise')
    for i, m in enumerate([69, 73, 76, 81]): put(bk.balafon(bk.m2f(m), .5, 300 + i), tr + i * .09, .26, (i - 1.5) * .25)
    # accents
    for sid, w in (('S5', 'lundi'), ('S10', 'mardi'), ('S14', 'mercredi'), ('S18', 'jeudi'), ('S20', 'vendredi'), ('S25', 'samedi'), ('S29', 'bonzini')):
        tt = S(sid, w); put(mk.kick(), tt, .45); put(mk.bass(mk.m2f(33), .5, 1), tt, .35)

def sfx(put, H):
    fx = H.fx
    S = lambda sid, w, nth=0, end=False: H.wt(sid, w, end=end, nth=nth)
    sp = os.path.join(F, 'data', 'shakes.json'); last = -9
    for i, k in enumerate(sorted(json.load(open(sp)), key=lambda x: x['t0']) if os.path.exists(sp) else []):
        t, a = k['t0'], k['amp']
        if t - last < .06: continue
        last = t
        if a >= 13: put(fx.stamp_hit(300 + i), t - .01, 1.0); put(fx.thud_s(.6, 120, 45, 400 + i), t, .45)
        elif a >= 9: put(fx.thud_s(.9, 160, 58, 400 + i), t - .01, .75); put(fx.paper_flick(500 + i), t - .03, .35)
        elif a >= 6: put(fx.thud_s(.6, 190, 80, 400 + i), t - .01, .5); put(fx.paper_flick(500 + i), t - .03, .3)
        else: put(fx.pop_s(600 + i), t - .01, .35); put(fx.paper_flick(500 + i), t - .02, .25)
    # automatic BD foley from the render (render.mjs --dump-cues): balloon pops, page turns / slides, captions, pen writing
    ap = os.path.join(F, 'data', 'cues_auto.json'); lastw = -9
    for i, c in enumerate(json.load(open(ap)) if os.path.exists(ap) else []):
        t, k = c['t'], c['k']
        if k == 'balloon':
            pan = max(-.6, min(.6, ((c.get('x') or 540) - 540) / 700))
            if c.get('kind') == 'shout': put(fx.pop_s(700 + i), t, .42, pan); put(fx.whoosh_s(.25, 710 + i, 600, 4000), t - .04, .14, pan)
            elif c.get('kind') == 'think': put(fx.pop_s(720 + i), t, .2, pan); put(fx.pop_s(730 + i), t + .07, .14, pan)
            else: put(fx.pop_s(740 + i), t, .3, pan)
        elif k == 'shot':
            kd = c.get('kind')
            if kd == 'page': put(fx.page_turn(800 + i), t - .02, .55)
            elif kd in ('slide', 'up', 'iris'): put(fx.whoosh_s(.42, 810 + i, 250, 3200), t - .03, .26)
        elif k == 'card': put(fx.card_flip(820 + i), t, .35); put(fx.pop_s(830 + i), t + .02, .18)
        elif k == 'write' and c.get('dur', 0) >= .35 and t - lastw > .25:
            lastw = t; put(fx.marker_squeak(min(1.1, c['dur']), 840 + i), t, .1, .2)
    p = os.path.join(F, 'data', 'cues_scenes.json')
    if os.path.exists(p):
        for i, c in enumerate(json.load(open(p))):
            try:
                t = S(c['seg'], c['word'], c.get('nth', 0), c.get('end', False)) if 'word' in c else H.seg(c['seg'])['start' if c.get('at', 'start') == 'start' else 'end']
                put(getattr(fx, c['sound'])(*c.get('args', [])), t + c.get('offset', 0), c.get('gain', .6), c.get('pan', 0))
            except Exception as e:
                print('cue skipped', c, e)

def ambience(put, H):
    """place beds, cross-faded at the day changes (levels are normalised in audio.py)"""
    s = H.seg; DUR = H.DUR
    def bed(fn, a, b, seed, g=1.0):
        a = max(0, a); b = min(DUR, b)
        if b - a < .5: return
        y = fn(b - a, seed); n = len(y); f = min(n // 3, int(.6 * 48000))
        env = np.ones(n); env[:f] = np.linspace(0, 1, f); env[-f:] = np.linspace(1, 0, f); put(y * env, a, g)
    bed(amb.night, 0, s('S5')['start'] - .5, 1, 1.0)                      # Saturday night at the maquis
    bed(amb.market, s('S5')['start'] - .8, s('S18')['start'] - .5, 2, .9)  # Monday → Wednesday: the market
    bed(amb.street, s('S18')['start'] - .8, s('S20')['start'] - .5, 3, 1.0)  # Thursday: the port road
    bed(amb.fan, s('S20')['start'] - .8, s('S25')['start'] - .5, 4, .8)   # Friday: the office
    bed(amb.night, s('S25')['start'] - .8, s('S28')['start'] - .3, 5, 1.0)  # Saturday night
    bed(amb.market, s('S28')['start'] - .5, s('S29')['start'] + .5, 6, .7)  # later, the busy stall

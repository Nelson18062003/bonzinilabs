"""Cue sheet for « DOUANE · Partie 1 ». Music intensity over time + musical hits + customs foley.
Extra cues can be merged from data/cues_scenes.json: [{seg, word, nth, offset, sound, gain, pan}] or {seg, at:'start'|'end', ...}."""
import os, json, math
import numpy as np

F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
END_SEG = 'S17'

def level_at(t, H):
    """(level, tense) for the bar starting at t. levels: silent | lite | tense | bass | drums | full"""
    S = H.wt
    blocked = S('S1', 'bloque')
    if t < blocked - .05: return ('lite', False)                    # curious, light: hats + muted guitar
    if t < H.seg('S2')['start'] - .3: return ('silent', False)      # the stamp lands in silence
    if t < S('S2', 'pourtant') - .2: return ('tense', True)         # the « bête noire »
    if t < H.seg('S4')['start'] - .5: return ('lite', False)        # relief: the airport
    if t < H.seg('S11')['start'] - .3: return ('full', False)
    if t < S('S11', 'secret') - .3: return ('tense', True)          # wrong code, low value… fines & delays
    if t < H.seg('S13')['start'] - .3: return ('full', False)
    if t < H.seg('S14')['start'] - .2: return ('lite', False)       # warm, intimate: « on veut que vous réussissiez »
    return ('full', False)

def hits(put, H):
    mk, bk, fx = H.mk, H.bk, H.fx
    # hook: sub boom + low E on « bloqué »
    tb = H.wt('S1', 'bloque')
    put(fx.boom(1), tb, .9); put(mk.bass(mk.m2f(28), 1.2, 1), tb, .5)
    # the groove comes back on « Pourtant » with a balafon pickup
    tp = H.wt('S2', 'pourtant')
    for i, m in enumerate([64, 67, 71, 76]): put(bk.balafon(bk.m2f(m), .4, 300 + i), tp - .32 + i * .08, .22, (i - 1.5) * .3)
    # accents on the key words
    for sid, w in (('S4', 'porte'), ('S6', 'trois'), ('S8', 'taxe'), ('S10', 'tva'), ('S11', 'secret'), ('S13', 'reussissiez'), ('S17', 'bonzini')):
        tt = H.wt(sid, w); put(mk.kick(), tt, .6); put(mk.bass(mk.m2f(28), .5, 1), tt, .45)
    # balafon answers on each of the three questions
    for i, w in enumerate(('quoi', 'combien', 'dou')):
        tt = H.wt('S6', w); put(bk.balafon(bk.m2f(76 + (0, 3, 7)[i]), .45, 400 + i), tt, .3, (i - 1) * .5)

def sfx(put, H):
    fx = H.fx
    S = lambda sid, w, nth=0, end=False: H.wt(sid, w, end=end, nth=nth)
    seg = H.seg
    # --- impacts: one sound per camera shake registered by the scenes (data/shakes.json, dumped by render.mjs --dump-shakes)
    sp = os.path.join(F, 'data', 'shakes.json'); last = -9
    for i, k in enumerate(sorted(json.load(open(sp)), key=lambda x: x['t0']) if os.path.exists(sp) else []):
        t, a = k['t0'], k['amp']
        if t - last < .06: continue                       # merged double hits
        last = t
        if a >= 13: put(fx.stamp_hit(300 + i), t - .01, 1.0); put(fx.thud_s(.6, 120, 45, 400 + i), t, .45)
        elif a >= 9: put(fx.thud_s(.9, 160, 58, 400 + i), t - .01, .75); put(fx.paper_flick(500 + i), t - .03, .35)
        elif a >= 6: put(fx.thud_s(.6, 190, 80, 400 + i), t - .01, .5); put(fx.paper_flick(500 + i), t - .03, .3)
        else: put(fx.pop_s(600 + i), t - .01, .35); put(fx.paper_flick(500 + i), t - .02, .25)
    # --- textures on words
    # hook: passport springs, page rips, flash-cut to the port photo
    put(fx.page_turn(2), S('S1', 'passeport') - .05, .6, .2)
    put(fx.paper_rip(.5, 4), S('S1', 'manque'), .85, .35)
    tb = S('S1', 'bloque'); put(fx.whoosh_s(.3, 6, 800, 6000), tb - .28, .45); put(fx.shutter(5), tb - .06, .7)
    put(fx.barrier_clack(7), max(tb + .26, min(S('S1', 'au'), S('S1', 'port') - .2)), .7, -.3)
    # bête noire
    put(fx.monster_growl(1.1, 9), S('S2', 'douane') - .05, .75)
    put(fx.monster_growl(.5, 10), S('S2', 'noire'), .5)
    put(fx.page_turn(12), S('S2', 'pourtant'), .7); put(fx.card_flip(13), S('S2', 'pourtant') + .35, .6)
    put(fx.chime(14), S('S2', 'connaissez'), .4)
    put(fx.plane_whoosh(15), S('S3', 'aeroport') - .1, .45, -.2)
    put(fx.xray_scan(.9, 24), S('S3', 'rayons') - .05, .45, .3)
    put(fx.xray_scan(1.3, 25), S('S3', 'cartons') + .1, .5, .4)
    # porte
    put(fx.shutter(30), seg('S4')['start'] - .25, .5)
    put(fx.whoosh_s(.6, 33, 300, 2500), S('S4', 'entre') - .05, .5, -.5); put(fx.whoosh_s(.6, 34, 2500, 300), S('S4', 'sort') - .05, .5, .5)
    # papiers
    for i, w in enumerate(('facture', 'connaissement', 'declaration')): put(fx.paper_flick(43 + i), S('S5', w) - .08, .45, (i - 1) * .4)
    # questions
    for i, w in enumerate(('quoi', 'combien', 'dou')): put(fx.card_flip(50 + i), S('S6', w) - .1, .7, (i - 1) * .45)
    # quoi: loupes, code rolls, gauges
    put(fx.whoosh_s(.3, 60, 1200, 5000), S('S7', 'cuir') - .15, .35, -.4); put(fx.whoosh_s(.3, 61, 1200, 5000), S('S7', 'tissu') - .15, .35, .4)
    put(fx.typing(8, .045, 62), S('S7', 'deux') - .1, .45)
    put(fx.riser(.5, 71), S('S7', 'taux') - .45, .3)
    # combien
    put(fx.pop_s(85), S('S8', 'bateau'), .35)
    # d'où
    put(fx.whoosh_s(.5, 90, 400, 3000), S('S9', 'fabrication') - .3, .4); put(fx.chime(91), S('S9', 'fabrication') + .15, .3)
    put(fx.calc_beep(620, .16), S('S9', 'depart'), .35)
    # la note
    put(fx.whoosh_s(.5, 101, 3000, 400), S('S10', 'tva') - .25, .5)
    put(fx.marker_squeak(.6, 103), S('S10', 'compris'), .4)
    # conformité
    put(fx.marker_squeak(.6, 110), S('S11', 'mauvais'), .45); put(fx.marker_squeak(.5, 111), S('S11', 'valeur'), .45)
    put(fx.xray_scan(.8, 112), S('S11', 'valeur') + .3, .35, -.4)
    put(fx.typing(6, .11, 113), S('S11', 'retards') - .1, .3, .4)                 # the clock ticks
    put(fx.riser(.9, 114), S('S11', 'secret') - .9, .45)
    put(fx.chime(118), S('S11', 'avance') + .1, .35); put(fx.plane_whoosh(119), S('S11', 'avance') + .35, .5, .4)
    # export
    put(fx.whoosh_s(.5, 120, 300, 2200), S('S12', 'exportez') - .2, .45)
    # bonzini
    put(fx.heart_pops(4, 130), S('S13', 'reussissiez'), .5)
    put(fx.whoosh_s(.5, 131, 300, 2000), S('S13', 'application') - .25, .5)
    put(fx.tap(132), S('S13', 'douane') - .1, .6); put(fx.typing(6, .07, 133), S('S13', 'douane'), .4)
    put(fx.tap(140), S('S13', 'estimes'), .6); put(fx.tap(141), S('S13', 'questions'), .6)
    put(fx.whoosh_s(.8, 144, 300, 2500), S('S14', 'afrique') - .3, .45)
    # partie 2 · cta · sign
    for i, w in enumerate(('taxes', 'conformite', 'simulation', 'transitaire')): put(fx.card_flip(150 + i), S('S15', w) - .08, .5, (i - 1.5) * .3)
    put(fx.typing(9, .06, 160), S('S16', 'commentaire') - .3, .45)
    put(fx.whoosh_s(.6, 170, 300, 3000), seg('S17')['start'] - .3, .5)
    # scene builders' extra cues
    p = os.path.join(F, 'data', 'cues_scenes.json')
    if os.path.exists(p):
        for i, c in enumerate(json.load(open(p))):
            try:
                t = S(c['seg'], c['word'], c.get('nth', 0), c.get('end', False)) if 'word' in c else seg(c['seg'])['start' if c.get('at', 'start') == 'start' else 'end']
                put(getattr(fx, c['sound'])(), t + c.get('offset', 0), c.get('gain', .6), c.get('pan', 0))
            except Exception as e:
                print('cue skipped', c, e)

"""Cue sheet for « Votre vrai prix de revient ». Music intensity per chapter + hits + foley.
Scene builders' cues are merged from data/cues_scenes.json: [{seg, word, nth, offset, sound, gain, pan}] or {seg, at:'start'|'end', ...}."""
import os, json, math
import numpy as np

F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHAPTER_LEVEL = {
    'hook': 'silent', 'junior': 'lite', 'dream': 'full', 'dare': 'bass',
    'taux': 'full', 'camion': 'full', 'bateau': 'full', 'douane': 'tense', 'frais': 'full',
    'repit': 'lite', 'twist': 'tense', 'zero': 'silent', 'ticket': 'bass', 'haggle': 'full',
    'formule': 'full', 'prix': 'full', 'happy': 'full', 'marche': 'lite', 'reflexes': 'full',
    'bonzini': 'full', 'cta': 'full', 'sign': 'full',
}
TENSE = {'douane', 'twist', 'ticket'}
END_SEG = 'S23'

def hits(put, H):
    mk = H.mk
    # the groove kicks in right after « Devant vous. » (first bar of 'junior' is lite) — give it an upbeat pickup
    t = H.wt('S1', 'vous', end=True) + .15
    for i, m in enumerate([69, 73, 76]): put(mk.guitar(mk.m2f(m + 12), .4, .8, .995, 900 + i), t + i * .08, .25, (i - 1) * .3)
    # big accents
    for sid, w in (('S3', 'promis'), ('S12', 'zero'), ('S15', 'plancher'), ('S17', 'paye'), ('S23', 'bonzini')):
        tt = H.wt(sid, w)
        put(mk.kick(), tt, .7); put(mk.bass(mk.m2f(33), .6, 1), tt, .55)

def _sound(fx, name, seed):
    table = {
        'snip': lambda: fx.snip(seed), 'thud': lambda: fx.thud_s(1.0, 140, 55, seed), 'stamp': lambda: fx.stamp_hit(seed),
        'whoosh': lambda: fx.whoosh_s(.45, seed), 'whoosh_long': lambda: fx.whoosh_s(.8, seed, 200, 2600), 'pop': lambda: fx.pop_s(seed),
        'coin': lambda: fx.coin_drop(seed), 'coins': lambda: fx.coins_pour(.8, seed), 'register': lambda: fx.cash_register(seed),
        'printer': lambda: fx.printer(1.4, seed), 'printer_short': lambda: fx.printer(.6, seed), 'key': lambda: fx.calc_key(seed),
        'beep': lambda: fx.calc_beep(), 'riffle': lambda: fx.riffle(8, .8, seed), 'flick': lambda: fx.paper_flick(seed),
        'marker': lambda: fx.marker_squeak(.5, seed), 'marker_long': lambda: fx.marker_squeak(1.0, seed), 'buzzer': lambda: fx.buzzer(),
        'correct': lambda: fx.correct(), 'drumroll': lambda: fx.drumroll(1.2, seed), 'trombone': lambda: fx.sad_trombone(),
        'schling': lambda: fx.whoosh_s(.35, seed, 2500, 7000) + 0,
    }
    return table.get(name, table['pop'])()

def sfx(put, H):
    fx = H.fx
    S = lambda sid, w, nth=0, end=False: H.wt(sid, w, end=end, nth=nth)
    seg = H.seg
    # --- the note: slam, pencil lines, scissors enter, corner flies, EXEMPLE stamp
    put(fx.thud_s(1.2, 150, 50, 1), .1, 1.0); put(fx.paper_flick(2), .08, .6)
    put(fx.stamp_hit(3), .3, .5, -.6)
    dec = S('S1', 'decouper')
    put(fx.marker_squeak(.8, 4), dec - .9, .35, -.2)
    put(fx.whoosh_s(.35, 5, 2500, 7000), dec - .8, .55, .6)
    put(fx.snip(6), dec, .9, .2)
    # cuts: every tchac = snip + a slice whoosh + envelope flick + calculator key/beep
    cuts = [S('S2', 'tchac'), S('S5', 'tchac'), S('S6', 'tchac'), S('S7', 'tchac'), S('S8', 'tchac', 0), S('S8', 'tchac', 1), S('S9', 'tchac'), S('S11', 'tchac')]
    for i, tc in enumerate(cuts):
        heavy = i in (4, 5)
        put(fx.snip(10 + i), tc - .02, 1.1 if heavy else .95, .15)
        if heavy: put(fx.thud_s(.9, 110, 45, 20 + i), tc + .03, .7)
        put(fx.whoosh_s(.5, 30 + i, 400, 3000), tc + .05, .35, -.3)
        put(fx.paper_flick(40 + i), tc + .5, .6, -.4)
        for k in range(3): put(fx.calc_key(50 + i * 3 + k), tc + .12 + k * .07, .35, .6)
        put(fx.calc_beep(2300), tc + .36, .3, .6)
    # refrain strips
    for sid in ('S2', 'S7'): put(fx.stamp_hit(60), S(sid, 'maigrit') - .12, .7)
    # S4: MAINTENANT stamp
    put(fx.stamp_hit(61), S('S4', 'maintenant'), .9)
    # S12: scissors click in the air, silence, then the zero plate slams
    put(fx.snip(62), S('S12', 'rien') - .05, .5)
    put(fx.stamp_hit(63), S('S12', 'zero') - .05, 1.1); put(fx.thud_s(1.2, 120, 40, 64), S('S12', 'zero'), .8)
    put(fx.sad_trombone(), S('S12', 'zero') + .5, .35)
    # scene builders' cues
    p = os.path.join(F, 'data', 'cues_scenes.json')
    if os.path.exists(p):
        for i, c in enumerate(json.load(open(p))):
            try:
                if 'word' in c: t = S(c['seg'], c['word'], c.get('nth', 0), c.get('end', False))
                else: t = seg(c['seg'])['start' if c.get('at', 'start') == 'start' else 'end']
                put(_sound(fx, c['sound'], 100 + i), t + c.get('offset', 0), c.get('gain', .6), c.get('pan', 0))
            except Exception as e:
                print('cue skipped', c, e)

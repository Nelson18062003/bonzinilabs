"""Re-time the score on the real voice takes. Reads data/takes.json (speech on/off inside each file) and data/vocheck.json
(word times), writes data/timing.json (overrides SCORE.T, incl. `end`) and data/voice_plan.json (where each take starts
in the film, and its time-stretch). Rule: two people never talk at the same time; impacts fall between lines."""
import json, os
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
tk = json.load(open(f'{F}/data/takes.json')); vc = json.load(open(f'{F}/data/vocheck.json'))
STRETCH = {'T2': .86, 'N5': .92}                       # mild speed-ups (pitch kept) for the two long lines
dur = lambda k: tk[k]['dur'] * STRETCH.get(k, 1)
word = lambda k, w: next(x['s'] for x in vc[tk[k]['file']]['words'] if x['w'].lower().strip('.,!?«» ').startswith(w))
plan, T = {}, {}
def say(k, start):                                      # speech starts at `start`; returns speech end
    s = STRETCH.get(k, 1); plan[k] = {'file': tk[k]['file'], 'at': round(start - tk[k]['on'] * s, 3), 'stretch': s}
    T[k] = round(start, 3); return start + dur(k)
e = say('T1', .15);                     T['slam'] = round(e + .06, 3)
T['amberForm'] = T['slam'] + .35;       T['amberUp'] = T['slam'] + .8;  T['day0'] = T['slam'] + .45
e = say('T2', T['slam'] + .24)
f1 = e + .09;                           r1 = f1 + .5;  e = say('T3', r1 + .02)
f2 = max(e + .16, r1 + .9);             r2 = f2 + .5;  e = say('T4', r2 + .02)
f3 = e + .1;                            r3 = f3 + .5
T['falls'] = [round(f1, 3), round(f2, 3), round(f3, 3)]; T['rebounds'] = [round(r1, 3), round(r2, 3), round(r3, 3)]
T['proof'] = round(r3 + .56, 3);        e = say('T5', T['proof'] + .47); T['gars'] = round(T['T5'] + .05, 3)
T['crush'] = round(e + .15, 3);         e = say('N1', T['crush'] + .1)
T['rewind'] = round(e + .12, 3);        T['rewindEnd'] = round(T['rewind'] + .5, 3)
n2 = say('N2', T['rewind'] + .3);       T['violetIn'] = round(plan['N2']['at'] + word('N2', 'bonzini'), 3)   # lands on « Bonzini »
e = say('N3', n2 + .12);                T['unfold'] = round(e + .05, 3)
n4 = T['unfold'] + .1;                  e = say('N4', n4)
T['stamp'] = round(plan['N4']['at'] + word('N4', 'preuve'), 3)                                              # stamps on « preuve »
T['letters'] = [round(T['stamp'] + .4 + .35 * i, 3) for i in range(3)]
T['check'] = round(max(e + .1, T['letters'][2] + .45), 3); T['settle'] = round(T['check'] + .25, 3)   # .45 s for « REÇU. » to slide to the centre
e = say('T6', T['settle'] + .2);        T['clink'] = round(T['settle'] + .6, 3)
T['endcard'] = round(e + .15, 3);       e = say('N5', T['endcard'] + .1)
T['gulps'] = [round(T['endcard'] + .9 + .5 * i, 3) for i in range(3)]; T['hic'] = round(T['gulps'][2] + .5, 3)
T['cta'] = round(e - .3, 3);            e = say('N6', e + .17)
T['end'] = round(e + .6, 1)
for k in ('amberForm', 'amberUp', 'day0'): T[k] = round(T[k], 3)
json.dump(T, open(f'{F}/data/timing.json', 'w'), indent=1); json.dump(plan, open(f'{F}/data/voice_plan.json', 'w'), indent=1)
print(json.dumps(T)); print('end', T['end'], 's =', round(T['end'] * 30), 'frames')

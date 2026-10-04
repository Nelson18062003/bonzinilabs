"""Re-time an episode of « JE SAVAIS PAS. » on its chosen voice takes (contract: serie/PIPELINE.md).
usage: python3 retime.py EPISODE_DIR [--gap 0.12] [--stretch N5=0.92,…] [--tail 1.2] [--script data/script.json] [--pauses]
Reads   data/script.json (line order), data/takes.json ({id: {file, on, off, dur}}), data/vocheck.json (word times),
        the score's DEFAULT voice starts (node, with data/timing.json moved aside) → data/defaults.json.
Writes  data/timing.json  {<id>: speech start, end, dur: {id: s}, words: {id: [{w, s, e}] relative to speech start}}
        data/voice_plan.json {<id>: {file, at (where the FILE starts in the film), stretch}}
Rule: lines keep the storyboard's spacing (a cumulative shift absorbs longer takes), never overlap (gap ≥ --gap),
and the tail after the last line keeps its storyboard length.
--pauses: keep the storyboard's SILENCES instead (start = end of the previous take + the default pause T0[i] − (T0[prev] +
DUR0[prev])): every designed pause survives whatever the takes' lengths. E/data/gaps.json {id: s} = extra minimum silence
before a line."""
import json, os, sys, subprocess
import re
import numpy as np, soundfile as sf
_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
def fr_num(n):
    """French words for 0 <= n < 1 000 000 (the ASR writes numbers as digits; the score looks words up by prefix)"""
    if n < 17: return _U[n]
    if n < 20: return 'dix-' + _U[n - 10]
    if n < 100:
        d, u = divmod(n, 10); base = {2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'soixante', 8: 'quatre-vingt', 9: 'quatre-vingt'}[d]
        if d in (7, 9): return base + ('-et-' if n == 71 else '-') + fr_num(10 + u)
        if u == 0: return base + ('s' if d == 8 else '')
        return base + ('-et-un' if u == 1 and d != 8 else '-' + _U[u])
    if n < 1000:
        c, r = divmod(n, 100); head = 'cent' if c == 1 else _U[c] + ' cent' + ('s' if r == 0 else '')
        return head + ('' if r == 0 else ' ' + fr_num(r))
    k, r = divmod(n, 1000); head = 'mille' if k == 1 else fr_num(k) + ' mille'
    return head + ('' if r == 0 else ' ' + fr_num(r))
def asr_fr(w, prev=None):
    m = re.match(r'^(\d+)(\D*)$', w.strip())
    if not m: return w
    d, tail = m.groups()
    if set(d) == {'0'} and len(d) == 3 and prev is not None and re.match(r'^\d+', prev.strip()): return 'mille' + tail
    return fr_num(int(d)) + tail
def pauses_of(path, min_pause=.12, merge=.06):
    """silences inside a take (file seconds): the ASR stamps a word that follows a pause at the START of the pause"""
    y, sr = sf.read(path); y = y if y.ndim == 1 else y.mean(1)
    fr = int(.01 * sr); e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); on = e > max(e.max() * .04, 1e-4)
    idx = np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0])); segs = []
    for a, b in zip(idx[::2], idx[1::2]):
        if segs and (a - segs[-1][1]) / sr < merge: segs[-1] = (segs[-1][0], b)
        else: segs.append((a, b))
    segs = [(a / sr, b / sr) for a, b in segs]
    return [(b0, a1) for (a0, b0), (a1, b1) in zip(segs, segs[1:]) if a1 - b0 >= min_pause]
E = os.path.abspath(sys.argv[1]); a = sys.argv[2:]
GAP = float(a[a.index('--gap') + 1]) if '--gap' in a else .12
PAUSES = '--pauses' in a
MIN_TAIL = float(a[a.index('--tail') + 1]) if '--tail' in a else 1.2      # minimum film tail after the last line
STRETCH = dict((k, float(v)) for k, v in (x.split('=') for x in a[a.index('--stretch') + 1].split(','))) if '--stretch' in a else {}
D = lambda *p: os.path.join(E, 'data', *p)
order = [s['id'] for s in json.load(open(os.path.join(E, a[a.index('--script') + 1]) if '--script' in a else D('script.json')))['segments']]
takes = json.load(open(D('takes.json'))); vc = json.load(open(D('vocheck.json')))
# 1 — the storyboard defaults (score loaded WITHOUT timing.json)
tj = D('timing.json'); moved = os.path.exists(tj)
if moved: os.rename(tj, tj + '.off')
try:
    js = f"const S=require({json.dumps(os.path.join(E, 'overlay', 'scenes', '01_score.js'))}); console.log(JSON.stringify(Object.assign({{}}, S.T, {{dur: S.DUR || S.T.dur || {{}}}})))"
    T0 = json.loads(subprocess.run(['node', '-e', js], capture_output=True, text=True, check=True, cwd=E).stdout.strip().splitlines()[-1])
finally:
    if moved: os.rename(tj + '.off', tj)
json.dump(T0, open(D('defaults.json'), 'w'), indent=1)
lines = [i for i in order if i in takes]
missing = [i for i in order if i not in takes]
if missing: print('WARNING no take for', missing)
# 2 — place the lines
T, plan, dur, words = {}, {}, {}, {}
shift, prev_end, prev = 0.0, -1e9, None
D0 = T0.get('dur', {}) if isinstance(T0.get('dur'), dict) else {}
GAPS = json.load(open(D('gaps.json'))) if os.path.exists(D('gaps.json')) else {}
for i in lines:
    tk = takes[i]; st = STRETCH.get(i, 1.0); d = tk['dur'] * st
    desired = float(T0.get(i, prev_end + GAP)) + shift
    if PAUSES and prev is not None and i in T0 and prev in T0 and prev in D0:
        desired = prev_end + max(GAP, float(T0[i]) - (float(T0[prev]) + float(D0[prev])))
    start = max(desired, prev_end + max(GAP, float(GAPS.get(i, 0))), 0.05)
    prev = i
    shift = start - float(T0.get(i, start)); prev_end = start + d
    T[i] = round(start, 3); dur[i] = round(d, 3)
    plan[i] = {'file': tk['file'], 'at': round(start - tk['on'] * st, 3), 'stretch': st}
    ws = vc.get(tk['file'], {}).get('words', []); ps = pauses_of(os.path.join(E, 'audio', 'vo', tk['file'])); out = []
    for j, w in enumerate(ws):
        s0 = w['s']
        cand = [p for p in ps if s0 + .005 < p[1] < w['e'] - .03] if j else []    # a line's first word never moves
        s1 = max(cand, key=lambda p: p[1] - max(p[0], s0))[1] if cand else s0
        out.append({'w': asr_fr(w['w'], ws[j - 1]['w'] if j else None), 's': round(max(0, s1 - tk['on']) * st, 3), 'e': round(max(0, w['e'] - tk['on']) * st, 3)})
    words[i] = out
last = lines[-1]
tail = max(MIN_TAIL, float(T0.get('end', 0)) - (float(T0.get(last, 0)) + float(T0.get('dur', {}).get(last, dur[last]) if isinstance(T0.get('dur'), dict) else dur[last])))   # storyboard tail after the last line
T['end'] = round(prev_end + tail, 2); T['dur'] = dur; T['words'] = words
json.dump(T, open(D('timing.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(plan, open(D('voice_plan.json'), 'w'), indent=1)
tl = D('timeline_main.json')
if os.path.exists(tl):
    j = json.load(open(tl)); j['frames'] = round(T['end'] * 30); json.dump(j, open(tl, 'w'))
for i in lines: print(f"{i:4s} default {float(T0.get(i, 0)):6.2f} → {T[i]:6.2f}  ({dur[i]:.2f}s)")
print('end', T0.get('end'), '→', T['end'], f"({round(T['end'] * 30)} frames)")

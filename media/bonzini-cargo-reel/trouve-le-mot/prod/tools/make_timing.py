"""Voice timing for the rush edit: the score computes every START itself (its chain of anchors), so data/timing.json only
carries what the voices measure — dur[id] (speech duration) and words[id] = [{w, s, e}] relative to the speech start.
usage: python3 make_timing.py PROD_DIR        (reads data/takes.json, data/vocheck.json, audio/vo/*.wav)
Word starts that the ASR stamped at the start of a pause are snapped to the measured speech onset; digits → French words
(same rules as serie/retime.py)."""
import json, os, re, sys
import numpy as np, soundfile as sf
E = os.path.abspath(sys.argv[1]); D = lambda *p: os.path.join(E, 'data', *p)
_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
def fr_num(n):
    if n < 17: return _U[n]
    if n < 20: return 'dix-' + _U[n - 10]
    if n < 100:
        d, u = divmod(n, 10); base = {2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'soixante', 8: 'quatre-vingt', 9: 'quatre-vingt'}[d]
        if d in (7, 9): return base + '-' + fr_num(10 + u)
        return base + ('' if u == 0 else '-' + _U[u])
    if n < 1000: c, r = divmod(n, 100); return ('cent' if c == 1 else _U[c] + ' cent') + ('' if r == 0 else ' ' + fr_num(r))
    k, r = divmod(n, 1000); return ('mille' if k == 1 else fr_num(k) + ' mille') + ('' if r == 0 else ' ' + fr_num(r))
def asr_fr(w):
    m = re.match(r'^(\d+)(\D*)$', w.strip())
    return fr_num(int(m.group(1))) + m.group(2) if m else w
def pauses_of(path, min_pause=.12, merge=.06):
    y, sr = sf.read(path); y = y if y.ndim == 1 else y.mean(1)
    fr = int(.01 * sr); e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); on = e > max(e.max() * .04, 1e-4)
    idx = np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0])); segs = []
    for a, b in zip(idx[::2], idx[1::2]):
        if segs and (a - segs[-1][1]) / sr < merge: segs[-1] = (segs[-1][0], b)
        else: segs.append((a, b))
    segs = [(a / sr, b / sr) for a, b in segs]
    return [(b0, a1) for (a0, b0), (a1, b1) in zip(segs, segs[1:]) if a1 - b0 >= min_pause]
takes = json.load(open(D('takes.json'))); vc = json.load(open(D('vocheck.json')))
dur, words = {}, {}
for i, tk in takes.items():
    st = float(tk.get('stretch', 1.0))           # optional slow-down of a TTS take (lib/audio_rush.py plays it × st)
    dur[i] = round(tk['dur'] * st, 3)
    ws = vc.get(tk['file'], {}).get('words', []); ps = pauses_of(os.path.join(E, 'audio', 'vo', tk['file'])); out = []
    for j, w in enumerate(ws):
        s0 = w['s']; cand = [p for p in ps if s0 + .005 < p[1] < w['e'] - .03] if j else []
        s1 = max(cand, key=lambda p: p[1] - max(p[0], s0))[1] if cand else s0
        out.append({'w': asr_fr(w['w']), 's': round(max(0, s1 - tk['on']) * st, 3), 'e': round(max(0, w['e'] - tk['on']) * st, 3)})
    words[i] = out
json.dump({'dur': dur, 'words': words, 'note': 'speech durations + word times relative to each line\'s speech start; the score computes the starts'},
          open(D('timing.json'), 'w'), ensure_ascii=False, indent=1)
for i in takes: print(f"{i:4s} {takes[i]['file']:10s} dur {dur[i]:.2f}s" + (f" (×{takes[i]['stretch']} stretch)" if takes[i].get('stretch', 1) != 1 else '') + f"  words: {' '.join(w['w'] for w in words[i])}")

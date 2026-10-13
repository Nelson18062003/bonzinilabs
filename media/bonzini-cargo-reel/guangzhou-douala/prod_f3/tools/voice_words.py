"""voice_words.py — word times of the REAL voice segments, rebased to each segment's start, into data/timing.json.

usage:  python3 tools/voice_words.py [PROD] V1=v2:14.38:18.32 [V2=v3:52.20:58.90 …]   cut these segments
        python3 tools/voice_words.py [PROD] --score                                  cut every SCORE.VOICES segment
        options: --transcripts FILE (default PROD/../work/transcripts.json) · --replace (drop the ids not cut this time)
writes  PROD/data/timing.json = {dur: {id: s}, words: {id: [{w, s, e}]}, seg: {id: {clip, in, out}}, note}
        (the rush1 timing contract + seg). Word times are relative to the segment's `in` (the score places the segment
        at its film start T[id], so a word is at T[id] + w.s). Other ids already in the file are kept (merge).

A word belongs to the segment when its midpoint lies in [in, out]; s / e are clamped to [0, dur]. Whisper's leading
spaces are stripped; digits become French words (« 1 » → « un »), as rush1's make_timing.py. The ASR spelling is kept
(« Traini » …): the subtitles' TEXT is written in the score (corrected French), the karaoke only borrows the timing,
matching the score's words to these in order (60_type.js)."""
import json, os, re, sys, subprocess, argparse
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('prod', nargs='?', default=os.path.abspath(os.path.join(HERE, '..')))
ap.add_argument('segs', nargs='*'); ap.add_argument('--score', action='store_true')
ap.add_argument('--transcripts'); ap.add_argument('--replace', action='store_true')
a = ap.parse_args()
if a.prod and '=' in a.prod: a.segs.insert(0, a.prod); a.prod = os.path.abspath(os.path.join(HERE, '..'))
P = os.path.abspath(a.prod); TJ = os.path.join(P, 'data', 'timing.json')
TR = json.load(open(a.transcripts or os.path.join(P, '..', 'work', 'transcripts.json')))

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
    w = w.strip(); m = re.match(r'^(\d+)(\D*)$', w)
    return fr_num(int(m.group(1))) + m.group(2) if m else w

segs = []
for s in a.segs:
    m = re.match(r'^(\w+)=(v\d+):([\d.]+):([\d.]+)$', s)
    if not m: sys.exit(f'bad segment « {s} » (ID=CLIP:IN:OUT, e.g. V1=v2:14.38:18.32)')
    segs.append(dict(id=m.group(1), clip=m.group(2), **{'in': float(m.group(3)), 'out': float(m.group(4))}))
if a.score:
    js = "const S=require(%s);console.log(JSON.stringify(Object.values(S.VOICES).map(v=>({id:v.id,clip:v.clip,in:v.in,out:v.out}))))" % \
         json.dumps(os.path.join(P, 'overlay', 'scenes', '01_score.js'))
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=P)
    if r.returncode: sys.exit(r.stderr)
    segs += json.loads(r.stdout.strip().splitlines()[-1])
if not segs: sys.exit('no segment: ID=CLIP:IN:OUT … or --score')

tm = {} if a.replace or not os.path.exists(TJ) else json.load(open(TJ))
for k in ('dur', 'words', 'seg'): tm.setdefault(k, {})
for g in segs:
    tr = TR.get(g['clip'])
    if not tr: sys.exit(f"{g['clip']}: not in transcripts.json")
    a0, b0 = g['in'], g['out']; dur = round(b0 - a0, 3); out = []
    for sg in tr.get('segs', []):
        for w in sg.get('words', []):
            mid = (w['s'] + w['e']) / 2
            if a0 - 1e-6 <= mid <= b0 + 1e-6:
                out.append({'w': asr_fr(w['w']), 's': round(min(dur, max(0.0, w['s'] - a0)), 3), 'e': round(min(dur, max(0.0, w['e'] - a0)), 3),
                            'p': round(w.get('p', 1.0), 3)})
    tm['dur'][g['id']] = dur; tm['words'][g['id']] = out; tm['seg'][g['id']] = {'clip': g['clip'], 'in': a0, 'out': b0}
    print(f"{g['id']:4s} {g['clip']} {a0:.2f}–{b0:.2f} ({dur:.2f} s): " + ' '.join(f"{w['w']}[{w['s']:.2f}]" for w in out))
tm['note'] = 'real-voice segments: word times relative to each segment start (tools/voice_words.py from work/transcripts.json); the score places the segments'
json.dump(tm, open(TJ, 'w'), ensure_ascii=False, indent=1)
print(f'→ {os.path.relpath(TJ, P)} ({len(tm["words"])} segment(s))')

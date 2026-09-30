"""Provisional timeline (no audio): words spaced by length at 2.79 words/s, same layout rules as build_timeline.py."""
import json, os, math
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
script = json.load(open(os.path.join(F, 'data', 'script.json')))['segments']
t = 0.0; segs = []; prev = None
for s in script:
    toks = s['text'].split(' '); nw = sum(1 for x in toks if any(ch.isalnum() for ch in x)); dur = nw / 2.79 + .3
    gap = s['gap'] if 'gap' in s else 1.0 if not segs else 0.9 if s['chapter'] != prev else 0.5
    start = math.ceil((t + gap) / .25 - 1e-6) * .25; prev = s['chapter']
    L = [max(1, len(x)) + 3 for x in toks]; tot = sum(L); c = 0; ws = []
    for tok, l in zip(toks, L):
        a = start + dur * c / tot; c += l; ws.append({'w': tok, 's': round(a, 3), 'e': round(start + dur * c / tot, 3)})
    segs.append({'id': s['id'], 'chapter': s['chapter'], 'text': s['text'], 'start': start, 'end': round(start + dur, 3), 'words': ws}); t = start + dur
total = math.ceil((t + 3) / .5) * .5; chapters = []
for i, s in enumerate(segs):
    if chapters and chapters[-1]['id'] == s['chapter']: continue
    c0 = 0.0 if i == 0 else round(segs[i - 1]['end'] + (s['start'] - segs[i - 1]['end']) * .35, 3)
    chapters.append({'id': s['chapter'], 'start': c0, 'seg': s['id']})
for i in range(len(chapters)): chapters[i]['end'] = chapters[i + 1]['start'] if i + 1 < len(chapters) else total
json.dump({'fps': 30, 'width': 1080, 'height': 1920, 'duration': total, 'frames': int(round(total * 30)), 'bpm': 120, 'provisional': True,
           'chapters': chapters, 'segments': segs}, open(os.path.join(F, 'data', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
for c in chapters: print(f"{c['id']:11s} {c['start']:6.2f} -> {c['end']:6.2f}")
print('total', total)

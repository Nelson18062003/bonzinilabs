"""build_hides.py — work/h_*.json (made by tools/mkhide.py, checked on their sheets) → data/hides.json, read by the score.

data/hides.json = {params: {sigma, feather, margin} (SOURCE px, SERIE §3.8),
                   hide: {clip: [{name, t0, t1, keys: [[s, [x, y, w, h]]…], shape: 'rect'|'ellipse', why}]},
                   sig: {clip: hash}}            the bake signature (prep_clips.py re-bakes a clip whose hash changed)
Keys are SOURCE seconds / SOURCE display px; the score turns each entry into a hide {kind: 'gauss'} (baked into the
prepared frames by prep_clips.py, skipped by 05_footage.js) AND a must-hide of the same track (audited by qa.js)."""
import json, os, glob, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
PARAMS = {'sigma': 18, 'feather': 8, 'margin': 10}
out = {'params': PARAMS, 'hide': {}, 'sig': {}}
for f in sorted(glob.glob(os.path.join(P, 'work', 'h_*.json'))):
    d = json.load(open(f)); name = os.path.basename(f)[2:-5]
    # the interval reaches half a frame beyond the first / last key (keys are rounded to 1e-4 s: the boundary frame
    # would fall outside); outside the keys the box holds (00_edl.js / prep_clips.py clamp)
    e = {'name': name, 't0': round(d['keys'][0][0] - 1 / 60, 4), 't1': round(d['keys'][-1][0] + 1 / 60, 4), 'keys': d['keys'], 'shape': d.get('shape', 'rect'), 'why': d.get('why', '')}
    for k in ('margin', 'feather', 'sigma', 'grain', 'radius'):   # per-hide overrides (a tight box: margin 4 / feather 6); film 4 review 4:
                                                                   # grain (σ, 8-bit levels) put back inside the patch, radius (rounded corners)
        if k in d: e[k] = d[k]
    out['hide'].setdefault(d['clip'], []).append(e)
for clip, L in out['hide'].items():
    L.sort(key=lambda e: e['t0'])
    out['sig'][clip] = hashlib.sha1(json.dumps([PARAMS, L], sort_keys=True).encode()).hexdigest()[:12]
json.dump(out, open(os.path.join(P, 'data', 'hides.json'), 'w'), ensure_ascii=False, indent=0)
for clip, L in out['hide'].items(): print(clip, out['sig'][clip], ', '.join(f"{e['name']} r {e['t0']:.2f}–{e['t1']:.2f}" for e in L))

"""jersey_edge.py — film 4 (verify 13/10): the top edge of the green #23 jersey in v40 (collar + shoulder), per source frame,
so that the shoulder blurs v40_shL / shM / shR never act on the head: work/h_v40_sh*.json carry it as 'keep' (prep_clips.py
bakes the patch only BELOW the edge + off; the head and the neck stay sharp).

  python3 tools/jersey_edge.py [--write]     # → work/v40_jersey_edge.json (+ --write: the 'keep' of the three h_v40_sh*.json)

Per frame (source display px, 576 × 1024; frame f = source f/30 s) and per column x ∈ XS (5-px wide): the first row from
y 340 where ≥ 3 of 4 rows are jersey green (g − max(r, b) > 18, g > 60). Cleaned: a quadratic fit per frame, points more
than 5 px BELOW it rejected (the beige strap, a shadow) and re-interpolated; the median of frames f−1, f, f+1; on the left
(x 0–20) the edge never drops more than 1 px per 10 px; r 3,10–3,50 (frames 93–105): x 0–20 set 3 px above the four left
points (a dark letter at x 0–15 read as the edge — checked on raw / baked crops). Checked on overlays of the bake mask."""
import os, sys, json, subprocess, tempfile, shutil, glob
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.abspath(os.path.join(P, '..', 'src', 'v40.mp4'))
XS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; F0, F1 = 40, 125
tmp = tempfile.mkdtemp(dir=os.path.join(P, 'work'))
try:
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-vf', f"fps=30,select='between(n\\,{F0}\\,{F1})',scale=576:1024:flags=lanczos",
                    '-fps_mode', 'passthrough', '-start_number', str(F0), '-q:v', '2', os.path.join(tmp, 'f_%04d.jpg')], check=True)
    R = {}
    for f in range(F0, F1 + 1):
        im = cv2.imread(os.path.join(tmp, f'f_{f:04d}.jpg')).astype(int); b, g, r = im[..., 0], im[..., 1], im[..., 2]
        J = ((g - np.maximum(r, b)) > 18) & (g > 60); row = []
        for x in XS:
            c = J[340:560, max(0, x - 2):x + 3].mean(1) > .5; y = -1
            for i in range(len(c) - 4):
                if c[i:i + 4].sum() >= 3: y = 340 + i; break
            row.append(y)
        R[f] = row
finally:
    shutil.rmtree(tmp)
C = {}
for f, row in R.items():
    y = np.array(row, float); y[y < 0] = np.nan
    for _ in range(3):
        ok = ~np.isnan(y); fit = np.polyval(np.polyfit(np.array(XS)[ok], y[ok], 2), XS); bad = ok & ((y - fit) > 5)
        if not bad.any(): break
        y[bad] = np.nan
    ok = ~np.isnan(y); C[f] = np.interp(XS, np.array(XS)[ok], y[ok])
E = {}
for f in C:
    y = np.median(np.array([C[g] for g in (f - 1, f, f + 1) if g in C]), 0)
    for i in range(2, -1, -1): y[i] = min(y[i], y[i + 1] + 1)
    if 93 <= f <= 105:
        m = min(y[:4]) - 3; y[0] = min(y[0], m); y[1] = min(y[1], m); y[2] = min(y[2], m + 1)
    E[f] = [round(float(v), 1) for v in y]
json.dump({str(f): E[f] for f in sorted(E)}, open(os.path.join(P, 'work', 'v40_jersey_edge.json'), 'w'))
print(f'work/v40_jersey_edge.json: {len(E)} frames {F0}–{F1}')
if '--write' in sys.argv:
    keys = [[round(f / 30, 4), [round(v * 2) / 2 for v in E[f]]] for f in sorted(E) if 42 <= f <= 123]
    for n in 'LMR':
        q = os.path.join(P, 'work', f'h_v40_sh{n}.json'); d = json.load(open(q))
        d['keep'] = dict(d.get('keep', {}), t0=keys[0][0], t1=keys[-1][0], xs=XS, keys=keys, off=2.5, feather=1.5)
        json.dump(d, open(q, 'w'), ensure_ascii=False)
    print('keep written into work/h_v40_sh{L,M,R}.json — then: python3 tools/build_hides.py && BZ_VARIANTS=main,wa python3 tools/prep_clips.py --score')

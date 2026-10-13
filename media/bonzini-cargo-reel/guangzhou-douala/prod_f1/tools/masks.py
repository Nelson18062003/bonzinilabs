"""masks.py — the burned-in stickers of v1 / v2 / v3 (work/static_mask_vN.png), dilated by 8 px (SERIE §3.12), as row
intervals → data/masks.json = {dilate, clips: {vN: {w, h, rows: {y: [[x0, x1]…]}}}} (x1 exclusive, SOURCE display px).
tools/audit.js counts the mask pixels inside every visible crop window of every v1–v3 shot (must be 0)."""
import json, os
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
D = 8; out = {'dilate': D, 'clips': {}}
for v in ('v1', 'v2', 'v3'):
    m = cv2.imread(os.path.join(P, '..', 'work', f'static_mask_{v}.png'), 0) > 127
    m = cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * D + 1, 2 * D + 1))) > 0
    rows = {}
    for y in range(m.shape[0]):
        r = m[y]; 
        if not r.any(): continue
        d = np.diff(np.concatenate([[0], r.astype(np.int8), [0]])); a = np.nonzero(d == 1)[0]; b = np.nonzero(d == -1)[0]
        rows[str(y)] = [[int(x0), int(x1)] for x0, x1 in zip(a, b)]
    out['clips'][v] = {'w': int(m.shape[1]), 'h': int(m.shape[0]), 'rows': rows, 'pixels': int(m.sum())}
    print(v, m.shape, int(m.sum()), 'px dilated')
json.dump(out, open(os.path.join(P, 'data', 'masks.json'), 'w'))

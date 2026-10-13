"""hide_sheet.py [--step 3] [--h 150] [--out out/hides_baked.jpg] — the PREPARED frames (assets/clips, blurs baked) around
every hide box of data/hides.json, every 3rd frame of its interval that the film uses, the box outlined (thin red): the
check that each blur sits on its target and that nothing readable is left (SERIE §3.8, §3.12-6). One row per hide."""
import os, json, argparse
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser(); ap.add_argument('--step', type=int, default=3); ap.add_argument('--h', type=int, default=150)
ap.add_argument('--out', default=os.path.join(P, 'out', 'hides_baked.jpg')); ap.add_argument('--only'); ap.add_argument('--wrap', type=int, default=0); a = ap.parse_args()
H = json.load(open(os.path.join(P, 'data', 'hides.json')))
def box_at(ks, s):
    if s <= ks[0][0]: return ks[0][1]
    if s >= ks[-1][0]: return ks[-1][1]
    i = 0
    while i < len(ks) - 2 and s >= ks[i + 1][0]: i += 1
    u = (s - ks[i][0]) / (ks[i + 1][0] - ks[i][0]); return [ks[i][1][j] + (ks[i + 1][1][j] - ks[i][1][j]) * u for j in range(4)]
rows = []
for clip, L in H['hide'].items():
    d = os.path.join(P, 'assets', 'clips', clip); meta = json.load(open(os.path.join(d, 'meta.json'))); k = meta['k']
    for h in L:
        if a.only and h['name'] not in a.only.split(','): continue
        f0, f1 = int(round(h['t0'] * 30)), int(round(h['t1'] * 30)); tiles = []
        for f in range(f0, f1 + 1, a.step):
            p = os.path.join(d, f'f_{f:04d}.jpg')
            if not os.path.exists(p): continue
            im = cv2.imread(p); x, y, w, hh = box_at(h['keys'], f / 30); m = 50
            X0, Y0 = int(max(0, (x - m) * k)), int(max(0, (y - m) * k)); X1, Y1 = int(min(im.shape[1], (x + w + m) * k)), int(min(im.shape[0], (y + hh + m) * k))
            c = im[Y0:Y1, X0:X1].copy()
            cv2.rectangle(c, (int(x * k - X0), int(y * k - Y0)), (int((x + w) * k - X0), int((y + hh) * k - Y0)), (0, 0, 255), 1)
            c = cv2.resize(c, (max(1, int(c.shape[1] * a.h / c.shape[0])), a.h), interpolation=cv2.INTER_AREA)
            cv2.putText(c, f'{f / 30:.2f}', (4, 16), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1); tiles.append(c)
        if not tiles: continue
        lab = np.zeros((a.h, 170, 3), np.uint8); cv2.putText(lab, h['name'], (6, 30), cv2.FONT_HERSHEY_SIMPLEX, .55, (255, 255, 255), 1)
        cv2.putText(lab, f"{clip} r {h['t0']:.2f}-{h['t1']:.2f}", (6, 60), cv2.FONT_HERSHEY_SIMPLEX, .45, (200, 200, 200), 1)
        n = a.wrap or len(tiles)
        for i in range(0, len(tiles), n):
            rows.append(np.hstack([lab if i == 0 else np.zeros_like(lab)] + tiles[i:i + n]))
W = max(r.shape[1] for r in rows)
sheet = np.vstack([np.hstack([r, np.zeros((r.shape[0], W - r.shape[1], 3), np.uint8)]) for r in rows])
cv2.imwrite(a.out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 85]); print(a.out, sheet.shape[1], 'x', sheet.shape[0])

"""crop_sheet.py CLIP F0:F1:STEP X0,Y0,X1,Y1 OUT [--cols N] [--w PX] — the PREPARED frames (assets/clips, grade + blurs baked)
cropped to a SOURCE-px rectangle, one tile per frame (frame number printed): the 1:1 check of a baked blur (review 2)."""
import os, sys, json, argparse
import numpy as np, cv2
P = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ap = argparse.ArgumentParser(); ap.add_argument('clip'); ap.add_argument('frames'); ap.add_argument('rect'); ap.add_argument('out')
ap.add_argument('--cols', type=int, default=6); ap.add_argument('--w', type=int, default=0); a = ap.parse_args()
m = json.load(open(os.path.join(P, 'assets', 'clips', a.clip, 'meta.json'))); k = m['sw'] / m['dw']
f0, f1, st = map(int, a.frames.split(':')); x0, y0, x1, y1 = map(float, a.rect.split(','))
tiles = []
for f in range(f0, f1 + 1, st):
    p = os.path.join(P, 'assets', 'clips', a.clip, f'f_{f:04d}.jpg')
    if not os.path.exists(p): continue
    im = cv2.imread(p)[int(y0 * k):int(y1 * k), int(x0 * k):int(x1 * k)]
    if a.w: im = cv2.resize(im, (a.w, int(im.shape[0] * a.w / im.shape[1])), interpolation=cv2.INTER_AREA)
    cv2.putText(im, f'{a.clip} f{f} r{f / 30:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 0), 3)
    cv2.putText(im, f'{a.clip} f{f} r{f / 30:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 1)
    tiles.append(im)
cols = min(a.cols, len(tiles)); rows = (len(tiles) + cols - 1) // cols; th, tw = tiles[0].shape[:2]
sh = np.zeros((rows * (th + 4), cols * (tw + 4), 3), np.uint8)
for i, im in enumerate(tiles): r, c = divmod(i, cols); sh[r * (th + 4):r * (th + 4) + im.shape[0], c * (tw + 4):c * (tw + 4) + im.shape[1]] = im
cv2.imwrite(a.out, sh, [cv2.IMWRITE_JPEG_QUALITY, 88]); print(a.out, sh.shape[1], 'x', sh.shape[0])

"""grid.py DIR [--w 360] [--cols 7] [--out FILE] [--dim .5] — a contact sheet of rendered frames (NNNNN.jpg), each tile
360 px wide with its time (frame / 30); --dim also writes the same sheet at 50 % brightness (SERIE §3.12-7)."""
import os, sys, argparse, glob
import numpy as np, cv2
ap = argparse.ArgumentParser(); ap.add_argument('dir'); ap.add_argument('--w', type=int, default=360); ap.add_argument('--cols', type=int, default=7)
ap.add_argument('--out'); ap.add_argument('--dim', action='store_true'); a = ap.parse_args()
fs = sorted(glob.glob(os.path.join(a.dir, '*.jpg')) + glob.glob(os.path.join(a.dir, '*.png')))
tiles = []
for f in fs:
    im = cv2.imread(f); h = int(im.shape[0] * a.w / im.shape[1]); im = cv2.resize(im, (a.w, h), interpolation=cv2.INTER_AREA)
    n = int(os.path.splitext(os.path.basename(f))[0]); lab = f't {n / 30:.2f}'
    cv2.putText(im, lab, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 0), 3); cv2.putText(im, lab, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 1)
    tiles.append(im)
cols = min(a.cols, len(tiles)); rows = (len(tiles) + cols - 1) // cols; th = tiles[0].shape[0]
sheet = np.full((rows * (th + 6), cols * (a.w + 6), 3), 40, np.uint8)
for i, im in enumerate(tiles):
    r, c = divmod(i, cols); sheet[r * (th + 6):r * (th + 6) + th, c * (a.w + 6):c * (a.w + 6) + a.w] = im
out = a.out or os.path.join(a.dir, 'grid_360.jpg'); cv2.imwrite(out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 88]); print(out, sheet.shape[1], 'x', sheet.shape[0])
if a.dim: d = out.replace('.jpg', '_dim50.jpg'); cv2.imwrite(d, (sheet * .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88]); print(d)

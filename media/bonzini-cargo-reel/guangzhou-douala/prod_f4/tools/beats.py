"""beats.py FRAMES_DIR OUT.jpg t1,t2,… [--w 540] [--cols 4] — a sheet of the frames at given film times (frame = round(t·30))"""
import os, sys, cv2, numpy as np
d, out, ts = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(',')]
W = int(sys.argv[sys.argv.index('--w') + 1]) if '--w' in sys.argv else 540; C = int(sys.argv[sys.argv.index('--cols') + 1]) if '--cols' in sys.argv else 4
tiles = []
for t in ts:
    n = round(t * 30); im = cv2.imread(os.path.join(d, f'{n:05d}.jpg')); h = int(im.shape[0] * W / im.shape[1]); im = cv2.resize(im, (W, h), interpolation=cv2.INTER_AREA)
    lab = f't {t:.2f} (f {n})'; cv2.putText(im, lab, (8, h - 14), cv2.FONT_HERSHEY_SIMPLEX, .8, (0, 0, 0), 4); cv2.putText(im, lab, (8, h - 14), cv2.FONT_HERSHEY_SIMPLEX, .8, (0, 255, 255), 2); tiles.append(im)
r = (len(tiles) + C - 1) // C; th = tiles[0].shape[0]; S = np.full((r * (th + 6), C * (W + 6), 3), 40, np.uint8)
for i, im in enumerate(tiles): y, x = divmod(i, C); S[y * (th + 6):y * (th + 6) + th, x * (W + 6):x * (W + 6) + W] = im
cv2.imwrite(out, S, [cv2.IMWRITE_JPEG_QUALITY, 88]); print(out, S.shape)

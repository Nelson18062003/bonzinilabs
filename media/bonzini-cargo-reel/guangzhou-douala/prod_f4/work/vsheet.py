"""vsheet.py DIR OUTPREFIX FRAMES(comma list) [--w 360] [--cols 6] [--rows 4] — viewing sheets of rendered frames, labelled."""
import os, sys, cv2, numpy as np
d, pre, fr = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(',')]
w = int(sys.argv[sys.argv.index('--w') + 1]) if '--w' in sys.argv else 360
cols = int(sys.argv[sys.argv.index('--cols') + 1]) if '--cols' in sys.argv else 6
rows = int(sys.argv[sys.argv.index('--rows') + 1]) if '--rows' in sys.argv else 4
tiles = []
for n in fr:
    im = cv2.imread(os.path.join(d, f'{n:05d}.jpg')); h = int(im.shape[0] * w / im.shape[1]); im = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
    lab = f'{n / 30:.2f} f{n}'; cv2.putText(im, lab, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 0, 0), 3); cv2.putText(im, lab, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 255, 255), 1)
    tiles.append(im)
per = cols * rows; th = tiles[0].shape[0]
for k in range(0, len(tiles), per):
    ch = tiles[k:k + per]; r_ = (len(ch) + cols - 1) // cols
    sh = np.full((r_ * (th + 6), cols * (w + 6), 3), 40, np.uint8)
    for i, im in enumerate(ch):
        r, c = divmod(i, cols); sh[r * (th + 6):r * (th + 6) + th, c * (w + 6):c * (w + 6) + w] = im
    out = f'{pre}_{k // per}.jpg'; cv2.imwrite(out, sh, [cv2.IMWRITE_JPEG_QUALITY, 85]); print(out)

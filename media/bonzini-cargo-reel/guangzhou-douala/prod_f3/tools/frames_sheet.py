"""frames_sheet.py DIR OUT.jpg [--step 15] [--w 360] [--cols 10] [--from F0 --to F1] — a 360-px contact sheet of RENDERED frames
(every `step`-th frame of DIR/NNNNN.jpg), + OUT_dim50.jpg (50 % brightness)."""
import os, sys, glob, cv2, numpy as np
d, out = sys.argv[1], sys.argv[2]; arg = lambda k, v: type(v)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else v
st, W, C, F0, F1 = arg('--step', 15), arg('--w', 360), arg('--cols', 10), arg('--from', 0), arg('--to', 10 ** 6)
fs = [f for f in sorted(glob.glob(os.path.join(d, '*.jpg'))) if F0 <= int(os.path.basename(f)[:5]) <= F1 and (int(os.path.basename(f)[:5]) - F0) % st == 0]
tiles = []
for f in fs:
    im = cv2.imread(f); h = int(im.shape[0] * W / im.shape[1]); im = cv2.resize(im, (W, h), interpolation=cv2.INTER_AREA); n = int(os.path.basename(f)[:5])
    cv2.putText(im, f't {n / 30:.2f}', (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 0), 3); cv2.putText(im, f't {n / 30:.2f}', (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 1); tiles.append(im)
r = (len(tiles) + C - 1) // C; th = tiles[0].shape[0]; S = np.full((r * (th + 6), min(C, len(tiles)) * (W + 6), 3), 40, np.uint8)
for i, im in enumerate(tiles): y, x = divmod(i, C); S[y * (th + 6):y * (th + 6) + th, x * (W + 6):x * (W + 6) + W] = im
cv2.imwrite(out, S, [cv2.IMWRITE_JPEG_QUALITY, 85]); cv2.imwrite(out.replace('.jpg', '_dim50.jpg'), (S * .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 85]); print(out, S.shape[1], 'x', S.shape[0])

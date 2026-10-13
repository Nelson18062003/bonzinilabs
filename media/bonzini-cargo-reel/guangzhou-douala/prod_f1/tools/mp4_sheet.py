"""mp4_sheet.py FILM.mp4 OUT.jpg [--step .5] [--w 360] [--cols 10] — contact sheet of the FINAL file (decoded from the mp4, not
the render): one frame every `step` s (frame round(k·step·30)), each tile `w` px wide with its time; + OUT_dim50.jpg."""
import sys, os, subprocess, tempfile, glob, cv2, numpy as np
f, out = sys.argv[1], sys.argv[2]; arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
step, W, C = arg('--step', .5), arg('--w', 360), arg('--cols', 10)
with tempfile.TemporaryDirectory(dir=os.path.dirname(os.path.abspath(out))) as td:
    n = round(step * 30)
    subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', f"select='not(mod(n\\,{n}))',scale={W}:-2:flags=area", '-vsync', '0', '-q:v', '3', os.path.join(td, '%05d.jpg')], check=True)
    fs = sorted(glob.glob(os.path.join(td, '*.jpg'))); tiles = []
    for i, p in enumerate(fs):
        im = cv2.imread(p); h = im.shape[0]; lab = f't {i * step:.1f}'
        cv2.putText(im, lab, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 0), 3); cv2.putText(im, lab, (6, h - 10), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 1); tiles.append(im)
r = (len(tiles) + C - 1) // C; th = tiles[0].shape[0]; S = np.full((r * (th + 6), C * (W + 6), 3), 40, np.uint8)
for i, im in enumerate(tiles): y, x = divmod(i, C); S[y * (th + 6):y * (th + 6) + th, x * (W + 6):x * (W + 6) + W] = im
cv2.imwrite(out, S, [cv2.IMWRITE_JPEG_QUALITY, 88]); d = out.replace('.jpg', '_dim50.jpg'); cv2.imwrite(d, (S * .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])
print(out, S.shape[1], 'x', S.shape[0], f'({len(tiles)} frames)'); print(d)

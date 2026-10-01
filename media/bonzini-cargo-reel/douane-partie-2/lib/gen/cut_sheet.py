"""Cut a character sheet (plain background) into one transparent PNG per pose.
usage: cut_sheet.py sheet.png outdir name [n_expected]  → outdir/name_1.png … (left→right), trimmed, alpha-cleaned"""
import sys, os, numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
src, outdir, name = sys.argv[1], sys.argv[2], sys.argv[3]; nexp = int(sys.argv[4]) if len(sys.argv) > 4 else None
os.makedirs(outdir, exist_ok=True)
im = Image.open(src).convert('RGB')
cut = np.array(remove(im, session=new_session('isnet-anime')))
a = cut[:, :, 3]
a = np.where(a < 24, 0, a).astype(np.uint8)                     # kill faint haze
m = (a > 90).astype(np.uint8)
# split into n poses: cut at the emptiest column near each expected boundary (poses may touch)
colsum = m.sum(0).astype(float)
W = len(colsum)
xs = np.where(colsum > 2)[0]; L, R = xs[0], xs[-1] + 1
n = nexp or 1
cuts = [L]
for k in range(1, n):
    c = L + (R - L) * k / n; w = (R - L) / n * .45
    lo, hi = int(c - w), int(c + w)
    seg = colsum[lo:hi] + np.abs(np.arange(lo, hi) - c) * .02
    cuts.append(lo + int(np.argmin(seg)))
cuts.append(R)
merged = [[cuts[i], cuts[i + 1]] for i in range(n)]
print(name, 'poses found:', len(merged), [r[1] - r[0] for r in merged], '(expected', nexp, ')')
for i, (x0, x1) in enumerate(merged, 1):
    sub = cut[:, x0:x1].copy()
    sub[:, :, 3] = np.where(sub[:, :, 3] < 24, 0, sub[:, :, 3])
    ys = np.where(sub[:, :, 3].max(1) > 40)[0]; y0, y1 = max(0, ys[0] - 4), min(sub.shape[0], ys[-1] + 5)
    sub = sub[y0:y1]
    # keep only the largest connected blob (+ blobs touching it) to drop stray specks
    n, lab, st, _ = cv2.connectedComponentsWithStats((sub[:, :, 3] > 40).astype(np.uint8), 8)
    if n > 2:
        keep = np.zeros(n, bool); big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]); keep[big] = True
        for k in range(1, n):
            if st[k, cv2.CC_STAT_AREA] > 300: keep[k] = True
        sub[:, :, 3] = np.where(keep[lab] | (sub[:, :, 3] <= 40), sub[:, :, 3], 0)
    Image.fromarray(sub).save(os.path.join(outdir, f'{name}_{i}.png'))
    print(f'  {name}_{i}.png {sub.shape[1]}x{sub.shape[0]}')

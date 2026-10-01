"""Comic-book post-filter so every background shares the characters' look: edge-preserving smoothing, flat colour quantisation,
ink outlines (multi-scale edges), warm grade and paper grain. usage: toon.py in.png out.png [strength 0..1]"""
import sys, cv2, numpy as np
src, dst = sys.argv[1], sys.argv[2]; k = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
im = cv2.imread(src)[:, :, :3]; h, w = im.shape[:2]
sm = im.copy()
for _ in range(2): sm = cv2.bilateralFilter(sm, 9, 60, 9)
sm = cv2.edgePreservingFilter(sm, flags=1, sigma_s=40, sigma_r=.35)
# flat colours: k-means in Lab on a downscaled copy, then map
lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
small = cv2.resize(cv2.cvtColor(sm, cv2.COLOR_BGR2LAB), (w // 4, h // 4)).reshape(-1, 3).astype(np.float32)
K = 22; _, lab_small, centers = cv2.kmeans(small, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 3, cv2.KMEANS_PP_CENTERS)
d = ((lab[:, None, :] - centers[None, :, :]) ** 2).sum(-1) if lab.shape[0] < 3_000_000 else None
lbl = np.argmin(d, 1) if d is not None else np.zeros(lab.shape[0], int)
flat = cv2.cvtColor(centers[lbl].reshape(h, w, 3).astype(np.uint8), cv2.COLOR_LAB2BGR)
flat = cv2.addWeighted(flat, .75, sm, .25, 0)                       # keep a little gouache variation inside the flats
# ink: combine a fine and a coarse edge map, thin dark lines
g = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY)
e1 = cv2.Canny(cv2.GaussianBlur(g, (3, 3), 0), 40, 110); e2 = cv2.Canny(cv2.GaussianBlur(g, (7, 7), 0), 25, 70)
e = cv2.max(e1, cv2.dilate(e2, np.ones((2, 2), np.uint8)))
e = cv2.GaussianBlur(e.astype(np.float32) / 255, (3, 3), 0)
ink = np.array([28, 20, 24], np.float32)
out = flat.astype(np.float32) * (1 - e[..., None] * .85 * k) + ink * (e[..., None] * .85 * k)
# warm grade + paper grain
out = out * np.array([.93, 1.0, 1.06]) + np.array([0, 4, 10])
rng = np.random.default_rng(3); grain = rng.normal(0, 5, (h, w, 1))
out = np.clip(out + grain, 0, 255).astype(np.uint8)
cv2.imwrite(dst, out)

"""Remove the carrier lettering (white letters + star logo) painted on the blue container.
Mask = bright, low-saturation pixels enclosed by container-blue; fill = vertical normalized convolution of the
blue pixels (keeps the vertical corrugation ribs)."""
import cv2, numpy as np, sys

def blue_mask(hsv):
    h, s, v = hsv[..., 0].astype(np.int16), hsv[..., 1], hsv[..., 2]
    return ((h >= 82) & (h <= 108) & (s >= 70) & (v >= 60)).astype(np.uint8)

def letter_mask(img, close_k=(31, 51)):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    b = blue_mask(hsv)
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    s, v = hsv[..., 1], hsv[..., 2]
    light = ((s < 100) & (v > 105)).astype(np.uint8) & (1 - b)
    light = cv2.morphologyEx(light, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    H, W = b.shape
    n, lab, st, _ = cv2.connectedComponentsWithStats(light, 8)
    keep = np.zeros_like(light)
    k3 = np.ones((3, 3), np.uint8)
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if a < 20:
            continue
        x0, y0, x1, y1 = max(x - 6, 0), max(y - 6, 0), min(x + w + 6, W), min(y + h + 6, H)
        c = (lab[y0:y1, x0:x1] == i).astype(np.uint8)
        ring = cv2.dilate(c, k3, iterations=3) & (1 - c)
        rb = b[y0:y1, x0:x1][ring > 0]
        if not rb.size or rb.mean() < 0.42:
            continue
        if y == 0 and v[y0:y1, x0:x1][c > 0].mean() > 205:   # sky wedge above the container roof
            continue
        keep[y0:y1, x0:x1] |= c
    keep = cv2.dilate(keep, np.ones((7, 7), np.uint8))
    return keep, b

def clean(img, m, b):
    src = img.astype(np.float32)
    w = (b & (1 - m)).astype(np.float32)
    k = dict(ksize=(0, 0), sigmaX=1.2, sigmaY=40)
    num = cv2.GaussianBlur(src * w[..., None], **k)
    den = cv2.GaussianBlur(w, **k)[..., None]
    fill = num / np.maximum(den, 1e-4)
    # second, isotropic pass for spots with no blue straight above/below
    k2 = dict(ksize=(0, 0), sigmaX=14, sigmaY=14)
    fill2 = cv2.GaussianBlur(src * w[..., None], **k2) / np.maximum(cv2.GaussianBlur(w, **k2)[..., None], 1e-4)
    ok = (den > 0.02).astype(np.float32)
    fill = fill * ok + fill2 * (1 - ok)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.3)[..., None]
    out = src * (1 - a) + fill * a
    return np.clip(out, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    clip, times, out = sys.argv[1], [float(x) for x in sys.argv[2].split(',')], sys.argv[3]
    cap = cv2.VideoCapture(clip); fps = cap.get(cv2.CAP_PROP_FPS)
    tiles = []
    for t in times:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps))); ok, im = cap.read()
        m, b = letter_mask(im); c = clean(im, m, b)
        vis = im.copy(); vis[m > 0] = (0, 0, 255)
        tiles.append(np.hstack([im, vis, c]))
    cv2.imwrite(out, np.vstack(tiles) if len(tiles) < 4 else np.vstack([np.hstack(tiles[i:i + 2]) for i in range(0, len(tiles) - 1, 2)]))

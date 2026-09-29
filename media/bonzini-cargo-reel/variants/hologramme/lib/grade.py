"""HOLOGRAMME grade: cold cyan / teal-blue near-duotone, as seen through a holographic display.

    from grade import grade
    out = grade(bgr, t, clip)      # bgr uint8 1080x1920, deterministic, pure colour (no scanlines/grain)

Pipeline:
  1. adaptive levels from the (smoothed) per-source-frame luma stats of v1 (read-only npz)
  2. local contrast: CLAHE on luma (blended) so textures read in the monochrome world
  3. luma -> duotone gradient map (deep navy -> teal -> cyan -> ice)
  4. a whisper of the original chroma (~9 %) so the image still feels "real"
  5. holographic edge glow (Sobel at 1/2 res -> soft cyan halo) + highlight bloom
  6. navy vignette
"""
import os, sys, functools
import numpy as np, cv2

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import base  # noqa: E402

STATS = os.path.join(base.S, 'reel', 'assets', 'grade_stats.npz')
W, H = 1080, 1920
A_OFF = 16.0

# gradient map stops (position, RGB)
STOPS = [
    (0.00, (2, 5, 14)),
    (0.16, (3, 12, 30)),
    (0.36, (6, 36, 66)),
    (0.56, (12, 84, 124)),
    (0.74, (38, 150, 192)),
    (0.89, (125, 218, 240)),
    (1.00, (230, 252, 255)),
]
P = {
    'B': dict(mid=0.40, clahe=2.0, lt=0.55, chroma=0.10, edge=0.55, bloom=0.30, vig=0.45),
    'A': dict(mid=0.43, clahe=2.2, lt=0.65, chroma=0.09, edge=0.60, bloom=0.30, vig=0.42),
}


@functools.lru_cache(maxsize=1)
def _stats():
    z = np.load(STATS)
    return {'B': z['B'].copy(), 'A': z['A'].copy()}


def src_index(clip, t):
    if clip == 'B':
        return min(max(int(round(t * 30)), 0), base.CLIPS['B']['n'] - 1)
    return min(max(int((t - A_OFF) * 25 + 1e-6), 0), base.CLIPS['A']['n'] - 1)


@functools.lru_cache(maxsize=1)
def _duo_lut():
    x = np.linspace(0, 1, 256)
    lut = np.zeros((256, 1, 3), np.uint8)
    pos = np.array([s[0] for s in STOPS])
    for c in range(3):
        v = np.interp(x, pos, [s[1][c] for s in STOPS])
        lut[:, 0, 2 - c] = np.clip(np.round(v), 0, 255)      # store as BGR
    return lut


@functools.lru_cache(maxsize=2)
def _clahe(c):
    return cv2.createCLAHE(clipLimit=c, tileGridSize=(6, 10))


@functools.lru_cache(maxsize=2)
def _vignette(strength):
    yy, xx = np.mgrid[0:H // 4, 0:W // 4].astype(np.float32)
    nx = (xx + .5) / (W / 4) * 2 - 1
    ny = (yy + .5) / (H / 4) * 2 - 1
    d = np.sqrt((nx / 1.0) ** 2 + (ny / 1.1) ** 2)
    u = np.clip((d - 0.55) / 0.85, 0, 1)
    v = 1 - strength * (u * u * (3 - 2 * u))
    return cv2.resize(v, (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None].astype(np.float32)


def _levels_lut(clip, idx, mid):
    lo, med, hi = _stats()[clip][idx]
    lo = max(0.0, lo - 2.0)
    hi = max(hi, lo + 60.0)
    x = np.arange(256, dtype=np.float32)
    y = np.clip((x - lo) / (hi - lo), 0, 1)
    m = np.clip((med - lo) / (hi - lo), 0.05, 0.95)
    g = np.log(mid) / np.log(m)                                  # put the median at `mid`
    y = y ** g
    # soft toe / shoulder
    y = y * y * (3 - 2 * y) * 0.35 + y * 0.65
    return np.clip(y * 255 + .5, 0, 255).astype(np.uint8)


def grade(bgr, t, clip=None):
    if clip is None:
        clip = 'B' if t < A_OFF else 'A'
    p = P[clip]
    idx = src_index(clip, t)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    Y = cv2.LUT(gray, _levels_lut(clip, idx, p['mid']))
    # local contrast
    cl = _clahe(p['clahe']).apply(Y)
    Y = cv2.addWeighted(Y, 1 - p['lt'], cl, p['lt'], 0)
    # duotone map
    duo = cv2.LUT(cv2.merge([Y, Y, Y]), _duo_lut())
    # whisper of original chroma (deviation from grey), then back to uint8
    f = duo.astype(np.float32)
    dev = bgr.astype(np.float32) - gray[:, :, None].astype(np.float32)
    f += dev * p['chroma']
    # holographic edge glow (half res)
    hs = cv2.resize(Y, (W // 2, H // 2), interpolation=cv2.INTER_AREA)
    hs = cv2.GaussianBlur(hs, (0, 0), 1.0)
    gx = cv2.Sobel(hs, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(hs, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy) * (1 / 255.0)
    e = np.clip((mag - 0.18) / 0.9, 0, 1)
    e = cv2.GaussianBlur(e, (0, 0), 1.6) * 0.7 + cv2.GaussianBlur(e, (0, 0), 5.0) * 0.6
    e = cv2.resize(e, (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None]
    f += e * (np.float32([255, 235, 110]) * p['edge'])            # BGR cyan halo
    # bloom on highlights (quarter res)
    q = cv2.resize(f, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    lum = q.max(axis=2, keepdims=True)
    bl = np.clip((lum - 170) / 85, 0, 1) * q
    bl = cv2.GaussianBlur(bl, (0, 0), 9)
    f += cv2.resize(bl, (W, H), interpolation=cv2.INTER_LINEAR) * p['bloom']
    # vignette toward navy
    v = _vignette(p['vig'])
    f = f * v + np.float32([22, 8, 2]) * (1 - v)
    return np.clip(f, 0, 255).astype(np.uint8)


if __name__ == '__main__':
    import time
    out = os.path.join(os.path.dirname(_HERE), 'out', 'grade_preview')
    os.makedirs(out, exist_ok=True)
    ts = [float(x) for x in sys.argv[1].split(',')] if len(sys.argv) > 1 else [1.0, 5.0, 8.0, 12.5, 14.0, 17.0, 23.0, 28.0, 33.0, 37.0]
    th = []
    for t in ts:
        c, i = base.src_for(t)
        im = base.frame(c, i)
        t0 = time.time(); g = grade(im, t, c); dt = time.time() - t0
        print(f't={t} {dt*1000:.0f} ms')
        cv2.imwrite(os.path.join(out, f'g_{t:05.2f}.jpg'), g, [cv2.IMWRITE_JPEG_QUALITY, 90])
        th.append(np.hstack([cv2.resize(im, (270, 480)), cv2.resize(g, (270, 480))]))
    rows = [np.hstack(th[i:i + 5]) for i in range(0, len(th), 5)]
    rows = [np.hstack([r, np.zeros((480, 2700 - r.shape[1], 3), np.uint8)]) if r.shape[1] < 2700 else r for r in rows]
    cv2.imwrite(os.path.join(out, 'sheet.jpg'), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])

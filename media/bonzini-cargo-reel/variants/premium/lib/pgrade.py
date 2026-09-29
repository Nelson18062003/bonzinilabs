"""PREMIUM variant colour grade: warm, golden-hour, soft filmic contrast, halation.

    from pgrade import grade
    out = grade(bgr, t, clip=None)   # bgr uint8 1080x1920, t = final-timeline seconds

Built on the structure of the v1 grade (reel/lib/grade.py: adaptive exposure from smoothed low-res
statistics, CLAHE local tone + clarity folded into one luma offset, chroma at half res) but with a
completely different look:
  * warm white balance + golden highlights, neutral / faintly cool shadows (depth without teal),
  * lifted, milky blacks and a soft shoulder (filmic, never crunchy), gentle S-curve,
  * rich but natural saturation, cyan/blue hues pulled back so the frame reads warm,
  * halation: a wide, red-orange glow around bright areas (+ a soft warm bloom),
  * soft oval vignette.
Deterministic, ~50-70 ms per frame on one core.
"""
import os, sys, functools
import numpy as np, cv2

_HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.abspath(os.path.join(_HERE, '..'))
S = os.path.abspath(os.path.join(V, '..', '..'))
RLIB = os.path.join(S, 'reel', 'lib')
if RLIB not in sys.path:
    sys.path.append(RLIB)
import base  # noqa: E402  (read-only shared footage access from v1)

STATS_PATH = os.path.join(S, 'reel', 'assets', 'grade_stats.npz')   # read-only, from v1
A_OFF = 16.0

P = {
    'B': dict(
        wb_cr=6.5, wb_cb=-10.5,                   # warm white balance (luma-proportional chroma offsets)
        black_target=3.0, black_strength=0.85,
        mid_target=0.44, mid_strength=0.45,
        shoulder=0.60, white=0.93,               # soft highlight roll-off (overcast sky -> creamy)
        clahe_clip=1.4, lt_amt=0.45, lt_sigma=6.0,
        clarity=0.28, clarity_sigma=7.0,
        contrast=0.24, pivot=0.42,
        sat_cr=1.14, sat_cb=1.04, knee=84.0,
        density=0.16,
        sh_cr=-1.5, sh_cb=2.5, hi_cr=7.0, hi_cb=-13.0,   # split tone: faint cool shadows, golden highlights
        cool_desat=0.38,                          # pull back cyan / blue hues
        bloom=18.0, bloom_th=0.70,
        hal=0.55, hal_th=0.62,                   # halation strength / threshold
        lift=0.045, top=0.965,                   # milky blacks / soft whites
        vig=0.34,
    ),
    'A': dict(
        wb_cr=8.5, wb_cb=-13.5,
        black_target=2.0, black_strength=0.8,
        mid_target=0.44, mid_strength=0.55,
        shoulder=0.60, white=0.93,
        clahe_clip=1.3, lt_amt=0.55, lt_sigma=7.0,
        clarity=0.26, clarity_sigma=7.0,
        contrast=0.22, pivot=0.40,
        sat_cr=1.16, sat_cb=1.02, knee=84.0,
        density=0.14,
        sh_cr=-1.0, sh_cb=2.0, hi_cr=8.5, hi_cb=-15.0,
        cool_desat=0.28,
        bloom=16.0, bloom_th=0.72,
        hal=0.50, hal_th=0.64,
        lift=0.045, top=0.965,
        vig=0.36,
    ),
}
SW, SH = 270, 480


def _smooth(x, sigma):
    from scipy.ndimage import gaussian_filter1d
    return gaussian_filter1d(x, sigma, axis=0, mode='nearest')


@functools.lru_cache(maxsize=1)
def _stats():
    z = np.load(STATS_PATH)
    return {'B': z['B'], 'A': z['A']}


def _src_index(clip, t):
    if clip == 'B':
        return min(max(int(round(t * 30)), 0), base.CLIPS['B']['n'] - 1)
    return min(max(int((t - A_OFF) * 25 + 1e-6), 0), base.CLIPS['A']['n'] - 1)


_X = np.arange(256, dtype=np.float32) / 255.0


def _smoothstep(e0, e1, x):
    u = np.clip((x - e0) / (e1 - e0), 0, 1)
    return u * u * (3 - 2 * u)


@functools.lru_cache(maxsize=4)
def _vignette_small(strength):
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    nx = (xx + 0.5) / SW * 2 - 1
    ny = (yy + 0.5) / SH * 2 - 1
    d = np.sqrt((nx / 1.0) ** 2 + (ny / 1.08) ** 2)
    v = 1.0 - strength * _smoothstep(0.40, 1.40, d) ** 1.3
    return v.astype(np.float32)


@functools.lru_cache(maxsize=4)
def _ones(h, w):
    return np.ones((h, w), np.float32)


@functools.lru_cache(maxsize=4)
def _clahe(clip_limit):
    return cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(4, 6))


@functools.lru_cache(maxsize=4)
def _tone_lut(clip):
    """Soft filmic S-curve with lifted (milky) blacks and rolled-off whites."""
    p = P[clip]
    x = _X.astype(np.float64)
    c, pv = p['contrast'], p['pivot']
    lo = pv * (x / pv) ** (1 + c * 1.2)
    hi = 1 - (1 - pv) * ((1 - x) / (1 - pv)) ** (1 + c)
    y = np.where(x < pv, lo, hi)
    # toe: lift the blacks smoothly (strongest at 0, fades by ~0.35)
    y = p['lift'] * (1 - y) ** 2.2 + y * (1 - p['lift'] * 0.2)
    y = y * p['top']
    return np.clip(np.round(y * 255), 0, 255).astype(np.uint8)


@functools.lru_cache(maxsize=4)
def _chroma_luts(clip):
    p = P[clip]
    d = np.arange(256, dtype=np.float32) - 128.0
    k = p['knee']

    def knee(v):
        return k * np.tanh(v / k)
    cr = knee(d * p['sat_cr']).astype(np.float32)
    cb = knee(d * p['sat_cb']).astype(np.float32)
    yl = _X
    s = 1.0 - 0.28 * (1 - _smoothstep(0.02, 0.26, yl)) - 0.30 * _smoothstep(0.82, 1.0, yl)
    ws = (1 - _smoothstep(0.05, 0.50, yl)) * _smoothstep(0.0, 0.08, yl)
    wh = _smoothstep(0.40, 0.92, yl) * (1 - 0.35 * _smoothstep(0.95, 1.0, yl))
    ocr = (p['hi_cr'] * wh + p['wb_cr'] * yl + 128.0).astype(np.float32)
    ocb = (p['hi_cb'] * wh + p['wb_cb'] * yl + 128.0).astype(np.float32)
    scr = (p['sh_cr'] * ws).astype(np.float32)
    scb = (p['sh_cb'] * ws).astype(np.float32)
    return cr, cb, s.astype(np.float32), ocr, ocb, scr, scb


def _pre_lut(clip, st):
    p = P[clip]
    p1, p50, p99 = [float(v) / 255.0 for v in st]
    bp = p['black_strength'] * max(p1 - p['black_target'] / 255.0, 0.0)
    bp = min(bp, 0.12)
    m = (p50 - bp) / max(1 - bp, 1e-3)
    m = min(max(m, 0.05), 0.95)
    g = np.log(p['mid_target']) / np.log(m)
    g = 1.0 + p['mid_strength'] * (g - 1.0)
    g = float(np.clip(g, 0.72, 1.25))
    x = _X.astype(np.float64)
    x = np.clip((x - bp) / (1 - bp), 0, None) ** g
    s0, wt = p['shoulder'], p['white']
    a = (1 - s0) - (wt - s0)
    u = np.clip((x - s0) / (1 - s0), 0, 1)
    x = np.where(x > s0, s0 + (1 - s0) * u - a * u * u, x)
    return np.clip(np.round(x * 255), 0, 255).astype(np.uint8)


def clip_for(t):
    return 'B' if t < A_OFF else 'A'


def grade(bgr, t, clip=None):
    if clip is None:
        clip = clip_for(t)
    p = P[clip]
    h, w = bgr.shape[:2]
    st = _stats()[clip][_src_index(clip, t)]

    lut = _pre_lut(clip, st)
    Y = cv2.LUT(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), lut)
    hw, hh = w // 2, h // 2
    small = cv2.resize(bgr, (hw, hh), interpolation=cv2.INTER_AREA)
    half = cv2.cvtColor(cv2.LUT(small.reshape(hh, -1), lut).reshape(hh, hw, 3), cv2.COLOR_BGR2YCrCb)
    Yh, Crh, Cbh = cv2.split(half)

    ys = cv2.resize(Yh, (SW, SH), interpolation=cv2.INTER_AREA)
    ysf = ys.astype(np.float32)
    cl = _clahe(p['clahe_clip']).apply(ys).astype(np.float32)
    lt = cv2.GaussianBlur(cl - ysf, (0, 0), p['lt_sigma']) * p['lt_amt']
    blur = cv2.GaussianBlur(ysf, (0, 0), p['clarity_sigma'])
    yn = blur * (1.0 / 255.0)
    mid = (_smoothstep(0.03, 0.30, yn) * (1 - _smoothstep(0.70, 0.98, yn))).astype(np.float32)
    G = p['clarity'] * mid
    # bloom (soft, warm-white) and halation (wide, red-orange)
    y01 = ysf * (1.0 / 255.0)
    th = p['bloom_th']
    hl = np.clip((y01 - th) * (1.0 / (1 - th)), 0, 1)
    hl *= hl
    q = cv2.resize(hl, (SW // 2, SH // 2), interpolation=cv2.INTER_AREA)
    wide = cv2.resize(cv2.GaussianBlur(q, (0, 0), 9.0), (SW, SH), interpolation=cv2.INTER_LINEAR)
    bloom = (cv2.GaussianBlur(hl, (0, 0), 5.0) * 0.55 + wide * 0.45) * p['bloom']
    th2 = p['hal_th']
    hl2 = np.clip((y01 - th2) * (1.0 / (1 - th2)), 0, 1)
    q2 = cv2.resize(hl2, (SW // 3, SH // 3), interpolation=cv2.INTER_AREA)
    hal = cv2.resize(cv2.GaussianBlur(q2, (0, 0), 4.0), (SW, SH), interpolation=cv2.INTER_LINEAR)
    hal = np.clip(hal - 0.5 * hl2, 0, None) * p['hal']          # glow AROUND highlights, not on them
    v = _vignette_small(p['vig'])

    lcr, lcb, ls, ocr, ocb, scr, scb = _chroma_luts(clip)
    kcr = cv2.LUT(Crh, lcr)
    kcb = cv2.LUT(Cbh, lcb)
    # pull back cyan / blue (cb > 0, cr < 0) so the frame reads warm; keep a natural colour
    cool = np.clip((kcb - kcr - 6.0) * (1.0 / 38.0), 0, 1)
    ck = 1.0 - p['cool_desat'] * cool
    kcr = kcr * ck
    kcb = kcb * ck
    dens = cv2.magnitude(kcr, kcb)

    q2h = lambda m: cv2.resize(m, (hw, hh), interpolation=cv2.INTER_LINEAR)
    Yhf = Yh.astype(np.float32)
    U0h = cv2.add(q2h((lt + bloom + hal * 10.0 - G * blur) * v), cv2.multiply(q2h(G * v - (1.0 - v)), Yhf))
    U0h = cv2.scaleAdd(dens, -p['density'], U0h)
    U0u = cv2.resize(U0h, (w, h), interpolation=cv2.INTER_LINEAR)
    Y8 = cv2.add(Y, U0u, dtype=cv2.CV_8U)
    Y8 = cv2.LUT(Y8, _tone_lut(clip))

    Y8h = cv2.resize(Y8, (hw, hh), interpolation=cv2.INTER_AREA)
    s = cv2.LUT(Y8h, ls)
    bh = cv2.resize(bloom, (hw, hh), interpolation=cv2.INTER_LINEAR)
    hh_ = cv2.resize(hal, (hw, hh), interpolation=cv2.INTER_LINEAR)
    cr = cv2.add(cv2.multiply(kcr, s), cv2.LUT(Y8h, ocr))
    cb = cv2.add(cv2.multiply(kcb, s), cv2.LUT(Y8h, ocb))
    cr = cv2.add(cr, cv2.LUT(Y8h, scr))
    cb = cv2.add(cb, cv2.LUT(Y8h, scb))
    cr = cv2.scaleAdd(bh, 0.16, cr)
    cb = cv2.scaleAdd(bh, -0.24, cb)
    cr = cv2.scaleAdd(hh_, 34.0, cr)                 # halation: red-orange
    cb = cv2.scaleAdd(hh_, -30.0, cb)
    cr = cv2.convertScaleAbs(cr)
    cb = cv2.convertScaleAbs(cb)
    cr = cv2.resize(cr, (w, h), interpolation=cv2.INTER_LINEAR)
    cb = cv2.resize(cb, (w, h), interpolation=cv2.INTER_LINEAR)
    out = cv2.merge([Y8, cr, cb])
    return cv2.cvtColor(out, cv2.COLOR_YCrCb2BGR)


def make_previews(times=(0.5, 2.5, 5.0, 8.0, 11.0, 13.5, 15.5, 17.0, 20.0, 23.0, 27.0, 29.0, 33.0, 36.0, 39.5),
                  outdir=None):
    outdir = outdir or os.path.join(V, 'work', 'grade_preview')
    os.makedirs(outdir, exist_ok=True)
    rows_b, rows_a = [], []
    for t in times:
        f = base.base_at(t)
        g = grade(f, t)
        cv2.imwrite(os.path.join(outdir, f'full_{t:05.1f}.jpg'), g, [cv2.IMWRITE_JPEG_QUALITY, 92])
        rows_b.append(cv2.resize(f, (216, 384), interpolation=cv2.INTER_AREA))
        rows_a.append(cv2.resize(g, (216, 384), interpolation=cv2.INTER_AREA))
    sheet = []
    for i in range(0, len(times), 5):
        b = rows_b[i:i + 5]; a = rows_a[i:i + 5]
        pad = [np.zeros_like(b[0])] * (5 - len(b))
        sheet += [np.hstack(b + pad), np.hstack(a + pad)]
    cv2.imwrite(os.path.join(outdir, 'contact.jpg'), np.vstack(sheet), [cv2.IMWRITE_JPEG_QUALITY, 90])


if __name__ == '__main__':
    import time
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        make_previews()
        sys.exit(0)
    cv2.setNumThreads(1)
    f = base.base_at(20.0)
    grade(f, 20.0)
    t0 = time.perf_counter()
    for _ in range(20):
        grade(f, 20.0)
    print('ms/frame', (time.perf_counter() - t0) / 20 * 1000)

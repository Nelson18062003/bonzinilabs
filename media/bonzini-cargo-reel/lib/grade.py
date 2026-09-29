"""BONZINI "ARRIVAL PROTOCOL" colour grade.

    from grade import grade
    out = grade(bgr, t)              # bgr: uint8 HxWx3 (1080x1920 expected), t: final-timeline seconds
    out = grade(bgr, t, clip='B')    # force a clip's look (e.g. B handle frames used after t=16.0)

Pure, deterministic function of (pixels, t). No grain / scanlines (the compositor adds those).

Look: premium cinematic, slightly cool.  Teal/cyan-leaning deep shadows, warm-neutral highlights,
luma-preserving chroma work in YCrCb (skin and the orange truck stay natural), gentle S-curve,
soft-knee saturation (no neon clipping), large-radius clarity + low-clip CLAHE computed at 1/4 res
and applied as smooth gain/offset maps, soft highlight bloom, subtle vignette.

Per clip (hard cut at t = 16.0):
  B  overcast street: highlight shoulder (sky), adaptive black point (dehaze), clarity, more depth.
  A  dim grey warehouse: lifted midtones, stronger local contrast (CLAHE), cool shadows.

Temporal stability: exposure / black point adapt to per-source-frame luma statistics measured on the
stabilised LOW-RES source (work/{A,B}_stab.mkv) and smoothed over ~0.7 s, so the grade is identical
whether a frame comes from the Real-ESRGAN upscale or the Lanczos fallback, and never "pumps".
Statistics are cached in assets/grade_stats.npz.

Cost: ~45-65 ms (median, varies with load) per 1080x1920 frame on ONE thread measured while the machine was saturated
(Real-ESRGAN + other jobs, load ~6 on 4 cores); faster on an idle core.  `python3 lib/grade.py`
benchmarks, `python3 lib/grade.py preview` writes before/after sheets to out/grade_preview/.
"""
import os, sys, functools
import numpy as np, cv2

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
import base  # noqa: E402

R = os.path.abspath(os.path.join(_HERE, '..'))
STATS_PATH = os.path.join(R, 'assets', 'grade_stats.npz')
A_OFF = 16.0

# ----------------------------------------------------------------------------------------------
# Look parameters (per clip)
# ----------------------------------------------------------------------------------------------
P = {
    'B': dict(
        wb_cr=-3.0, wb_cb=2.0,        # white balance as luma-proportional chroma offsets (cooler)
        black_target=3.0, black_strength=0.9,    # adaptive black point -> dehaze
        mid_target=0.40, mid_strength=0.45,      # adaptive midtone gamma (on smoothed median)
        shoulder=0.68, white=0.95,                # highlight roll-off (overcast sky)
        clahe_clip=1.6, lt_amt=0.55, lt_sigma=5.0,  # local tone (CLAHE -> smooth offset map)
        clarity=0.45, clarity_sigma=6.0,          # large-radius local contrast (1/4-res sigma)
        contrast=0.30, pivot=0.42,                # S-curve
        sat_cr=1.08, sat_cb=1.12, knee=88.0,     # chroma gains + soft knee limit (anti-neon)
        density=0.22,                             # darken saturated colours (rich, not neon)
        sh_cr=-8.5, sh_cb=3.5, hi_cr=4.0, hi_cb=-6.0,   # split tone (YCrCb offsets)
        warm_protect=0.75,                        # keep skin / orange / yellow out of the teal
        bloom=24.0, bloom_th=0.74,
        vig=0.24,
    ),
    'A': dict(
        wb_cr=-1.5, wb_cb=1.0,
        black_target=2.0, black_strength=0.85,
        mid_target=0.40, mid_strength=0.55,
        shoulder=0.64, white=0.945,
        clahe_clip=1.4, lt_amt=0.7, lt_sigma=7.0,
        clarity=0.35, clarity_sigma=7.0,
        contrast=0.26, pivot=0.40,
        sat_cr=1.10, sat_cb=1.04, knee=88.0,
        density=0.18,
        sh_cr=-8.5, sh_cb=3.5, hi_cr=4.5, hi_cb=-5.5,
        warm_protect=0.75,
        bloom=18.0, bloom_th=0.76,
        vig=0.28,
    ),
}
SW, SH = 270, 480   # analysis resolution (1/4)


# ----------------------------------------------------------------------------------------------
# Temporal statistics (from low-res stabilised source: identical for AI / Lanczos frames)
# ----------------------------------------------------------------------------------------------
def _measure(clip):
    fr = base._lowres_all(clip)
    st = np.zeros((len(fr), 3), np.float32)
    for i, f in enumerate(fr):
        y = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        st[i] = np.percentile(y, [1.0, 50.0, 99.5])
    return st


def _smooth(x, sigma):
    from scipy.ndimage import gaussian_filter1d
    return gaussian_filter1d(x, sigma, axis=0, mode='nearest')


@functools.lru_cache(maxsize=1)
def _stats():
    if os.path.exists(STATS_PATH):
        z = np.load(STATS_PATH)
        return {'B': z['B'], 'A': z['A']}
    raw = {c: _measure(c) for c in 'BA'}
    out = {c: _smooth(raw[c], 0.7 * base.CLIPS[c]['fps']).astype(np.float32) for c in 'BA'}
    os.makedirs(os.path.dirname(STATS_PATH), exist_ok=True)
    np.savez(STATS_PATH, **out, B_raw=raw['B'], A_raw=raw['A'])
    return out


def _src_index(clip, t):
    if clip == 'B':
        return min(max(int(round(t * 30)), 0), base.CLIPS['B']['n'] - 1)
    return min(max(int((t - A_OFF) * 25 + 1e-6), 0), base.CLIPS['A']['n'] - 1)


# ----------------------------------------------------------------------------------------------
# Static caches
# ----------------------------------------------------------------------------------------------
_X = np.arange(256, dtype=np.float32) / 255.0


def _smoothstep(e0, e1, x):
    u = np.clip((x - e0) / (e1 - e0), 0, 1)
    return u * u * (3 - 2 * u)


@functools.lru_cache(maxsize=4)
def _vignette_small(strength):
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    nx = (xx + 0.5) / SW * 2 - 1
    ny = (yy + 0.5) / SH * 2 - 1
    # elliptical, slightly taller than wide so it frames a 9:16 picture; soft falloff
    d = np.sqrt((nx / 1.05) ** 2 + (ny / 1.12) ** 2)
    v = 1.0 - strength * _smoothstep(0.45, 1.35, d) ** 1.4
    return v.astype(np.float32)


@functools.lru_cache(maxsize=4)
def _ones(h, w):
    return np.ones((h, w), np.float32)


@functools.lru_cache(maxsize=4)
def _clahe(clip_limit):
    return cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(4, 6))


@functools.lru_cache(maxsize=4)
def _tone_lut(clip):
    """Y S-curve: gentle, pivot around lower mids, soft toe (deep but not crushed), soft shoulder."""
    p = P[clip]
    x = _X.astype(np.float64)
    c, pv = p['contrast'], p['pivot']
    # smooth sigmoid-ish contrast around pivot, blended with identity
    lo = pv * (x / pv) ** (1 + c * 1.2)
    hi = 1 - (1 - pv) * ((1 - x) / (1 - pv)) ** (1 + c)
    y = np.where(x < pv, lo, hi)
    y = 0.012 + (0.988 - 0.012) * y            # black ~3, white ~252 in Y (video-ish headroom)
    # Y is BT.601 full-range in OpenCV; keep it full range
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
    # luma-dependent saturation: film-like roll-off in deep shadows and near white
    s = 1.0 - 0.30 * (1 - _smoothstep(0.02, 0.28, yl)) - 0.35 * _smoothstep(0.80, 1.0, yl)
    # split-tone offsets (shadows teal, highlights warm-neutral), smooth weights
    ws = (1 - _smoothstep(0.05, 0.55, yl)) * _smoothstep(0.0, 0.08, yl)   # fades to 0 at pure black
    wh = _smoothstep(0.50, 0.95, yl) * (1 - 0.5 * _smoothstep(0.95, 1.0, yl))
    ocr = (p['hi_cr'] * wh + p['wb_cr'] * yl + 128.0).astype(np.float32)
    ocb = (p['hi_cb'] * wh + p['wb_cb'] * yl + 128.0).astype(np.float32)
    scr = (p['sh_cr'] * ws).astype(np.float32)
    scb = (p['sh_cb'] * ws).astype(np.float32)
    return cr, cb, s.astype(np.float32), ocr, ocb, scr, scb


def _pre_lut(clip, st):
    """Input tone LUT (same for B,G,R): adaptive black point, adaptive midtone gamma, highlight
    shoulder.  Applied per channel, so saturated highlights roll off naturally (no hue skew)."""
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
    # soft shoulder above p['shoulder']: C1-continuous quadratic, maps 1.0 -> p['white']
    s0, wt = p['shoulder'], p['white']
    a = (1 - s0) - (wt - s0)
    u = np.clip((x - s0) / (1 - s0), 0, 1)
    x = np.where(x > s0, s0 + (1 - s0) * u - a * u * u, x)
    return np.clip(np.round(x * 255), 0, 255).astype(np.uint8)


def clip_for(t):
    return 'B' if t < A_OFF else 'A'


# ----------------------------------------------------------------------------------------------
# Main entry
# ----------------------------------------------------------------------------------------------
def grade(bgr, t, clip=None):
    """Grade one BGR uint8 frame shown at final-timeline time t. Returns uint8, same shape."""
    if clip is None:
        clip = clip_for(t)
    p = P[clip]
    h, w = bgr.shape[:2]
    st = _stats()[clip][_src_index(clip, t)]

    # 1+2) input tone LUT.  Luma: LUT on full-res BT.601 luma.  Chroma: per-channel LUT on a
    #      half-res copy (chroma is processed at half res; it ends up 4:2:0 anyway)
    lut = _pre_lut(clip, st)
    Y = cv2.LUT(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), lut)
    hw, hh = w // 2, h // 2
    small = cv2.resize(bgr, (hw, hh), interpolation=cv2.INTER_AREA)
    half = cv2.cvtColor(cv2.LUT(small.reshape(hh, -1), lut).reshape(hh, hw, 3), cv2.COLOR_BGR2YCrCb)
    Yh, Crh, Cbh = cv2.split(half)

    # 3) luma maps at 1/4 res: local tone (CLAHE), clarity, bloom, vignette
    ys = cv2.resize(Yh, (SW, SH), interpolation=cv2.INTER_AREA)
    ysf = ys.astype(np.float32)
    cl = _clahe(p['clahe_clip']).apply(ys).astype(np.float32)
    lt = cv2.GaussianBlur(cl - ysf, (0, 0), p['lt_sigma']) * p['lt_amt']
    blur = cv2.GaussianBlur(ysf, (0, 0), p['clarity_sigma'])
    yn = blur * (1.0 / 255.0)
    mid = (_smoothstep(0.03, 0.30, yn) * (1 - _smoothstep(0.70, 0.98, yn))).astype(np.float32)
    G = p['clarity'] * mid
    th = p['bloom_th']
    hl = np.clip((ysf * (1.0 / 255.0) - th) * (1.0 / (1 - th)), 0, 1)
    hl *= hl
    q = cv2.resize(hl, (SW // 2, SH // 2), interpolation=cv2.INTER_AREA)
    wide = cv2.resize(cv2.GaussianBlur(q, (0, 0), 9.0), (SW, SH), interpolation=cv2.INTER_LINEAR)
    bloom = (cv2.GaussianBlur(hl, (0, 0), 6.0) * 0.6 + wide * 0.4) * p['bloom']
    v = _vignette_small(p['vig'])

    # chroma (half res) first: its magnitude drives the colour-density term of the luma offset
    lcr, lcb, ls, ocr, ocb, scr, scb = _chroma_luts(clip)
    kcr = cv2.LUT(Crh, lcr)                            # centred, gained, soft-knee'd chroma
    kcb = cv2.LUT(Cbh, lcb)
    dens = cv2.magnitude(kcr, kcb)

    # Everything is folded into ONE additive luma offset built at half res, so the full-res luma
    # path is a single add:  Y' = Y + U0,   U0 = v*(lt + bloom - G*blur) + (G*v - (1 - v))*Yh - d*|C|
    # (= vignette * (Y + clarity + local tone + bloom) with clarity/vignette acting at half-res
    #  frequencies; full-res micro-detail passes through untouched)
    q2h = lambda m: cv2.resize(m, (hw, hh), interpolation=cv2.INTER_LINEAR)
    Yhf = Yh.astype(np.float32)
    U0h = cv2.add(q2h((lt + bloom - G * blur) * v), cv2.multiply(q2h(G * v - (1.0 - v)), Yhf))
    U0h = cv2.scaleAdd(dens, -p['density'], U0h)
    U0u = cv2.resize(U0h, (w, h), interpolation=cv2.INTER_LINEAR)
    Y8 = cv2.add(Y, U0u, dtype=cv2.CV_8U)              # rounds + saturates to [0, 255]
    Y8 = cv2.LUT(Y8, _tone_lut(clip))

    # 4) chroma @ half res: luma-dependent saturation, WB + split tone (shadow teal is held back on
    #    warm hues: skin, the orange truck, yellow sacks), warm tint inside the bloom
    Y8h = cv2.resize(Y8, (hw, hh), interpolation=cv2.INTER_AREA)
    s = cv2.LUT(Y8h, ls)
    warm = cv2.subtract(kcr, kcb)                      # >0 for red / orange / yellow / skin
    warm = cv2.max(cv2.threshold(warm, 24.0, 0, cv2.THRESH_TRUNC)[1], 0.0)
    keep = cv2.scaleAdd(warm, -p['warm_protect'] / 24.0, _ones(hh, hw))
    bh = cv2.resize(bloom, (hw, hh), interpolation=cv2.INTER_LINEAR)
    cr = cv2.add(cv2.multiply(kcr, s), cv2.LUT(Y8h, ocr))
    cb = cv2.add(cv2.multiply(kcb, s), cv2.LUT(Y8h, ocb))
    cr = cv2.add(cr, cv2.multiply(cv2.LUT(Y8h, scr), keep))
    cb = cv2.add(cb, cv2.multiply(cv2.LUT(Y8h, scb), keep))
    cr = cv2.convertScaleAbs(cv2.scaleAdd(bh, 0.10, cr))
    cb = cv2.convertScaleAbs(cv2.scaleAdd(bh, -0.14, cb))
    cr = cv2.resize(cr, (w, h), interpolation=cv2.INTER_LINEAR)
    cb = cv2.resize(cb, (w, h), interpolation=cv2.INTER_LINEAR)
    out = cv2.merge([Y8, cr, cb])
    return cv2.cvtColor(out, cv2.COLOR_YCrCb2BGR)


# ----------------------------------------------------------------------------------------------
def _label(im, txt):
    cv2.putText(im, txt, (14, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 5, cv2.LINE_AA)
    cv2.putText(im, txt, (14, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
    return im


def make_previews(times=(1.0, 5.0, 8.0, 13.5, 17.0, 20.0, 23.0, 27.0, 31.0, 36.0), outdir=None):
    """Before/after sheets (half-res side by side) + one contact sheet of all 'after' frames."""
    outdir = outdir or os.path.join(R, 'out', 'grade_preview')
    os.makedirs(outdir, exist_ok=True)
    afters = []
    for t in times:
        f = base.base_at(t)
        g = grade(f, t)
        a = cv2.resize(f, (540, 960), interpolation=cv2.INTER_AREA)
        b = cv2.resize(g, (540, 960), interpolation=cv2.INTER_AREA)
        sheet = np.hstack([_label(a.copy(), f'BEFORE t={t:.1f}'), np.full((960, 8, 3), 20, np.uint8),
                           _label(b.copy(), f'AFTER  t={t:.1f}')])
        cv2.imwrite(os.path.join(outdir, f'cmp_{t:05.1f}.jpg'), sheet, [cv2.IMWRITE_JPEG_QUALITY, 92])
        cv2.imwrite(os.path.join(outdir, f'full_{t:05.1f}.jpg'), g, [cv2.IMWRITE_JPEG_QUALITY, 92])
        afters.append((cv2.resize(f, (270, 480), interpolation=cv2.INTER_AREA),
                       cv2.resize(g, (270, 480), interpolation=cv2.INTER_AREA)))
    rows = []
    for i in range(0, len(afters), 5):
        chunk = afters[i:i + 5]
        pad = [np.zeros_like(chunk[0][0])] * (5 - len(chunk))
        rows += [np.hstack([x[0] for x in chunk] + pad), np.hstack([x[1] for x in chunk] + pad)]
    cv2.imwrite(os.path.join(outdir, 'contact_before_after.jpg'), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 90])


if __name__ == '__main__':
    import time
    if len(sys.argv) > 1 and sys.argv[1] == 'preview':
        make_previews()
        sys.exit(0)
    cv2.setNumThreads(1)
    _stats()
    for tt in (8.0, 20.0, 31.0):
        f = base.base_at(tt)
        grade(f, tt)
        ts, cs = [], []
        for _ in range(40):
            t0, c0 = time.perf_counter(), time.process_time()
            grade(f, tt)
            ts.append(time.perf_counter() - t0)
            cs.append(time.process_time() - c0)
        ts, cs = np.array(ts) * 1000, np.array(cs) * 1000
        print(f'clip {clip_for(tt)} t={tt}: wall median {np.median(ts):.1f} ms (min {ts.min():.1f}), '
              f'cpu median {np.median(cs):.1f} ms /frame (1 thread)')

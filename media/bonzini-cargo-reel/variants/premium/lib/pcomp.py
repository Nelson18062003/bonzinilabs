"""PREMIUM compositor: footage -> warm grade -> slow Ken Burns push-ins -> zoom-through transition
-> end-card background -> brand-colour light leaks (screen) -> typography overlay -> film grain -> H.264.

usage: python3 pcomp.py [--start S] [--end E] [--workers N] [--out out/premium_master.mp4]
                        [--stills t1,t2,...] [--crf 17] [--no-overlay]
"""
import os, sys, argparse, subprocess, math, tempfile, shutil
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.abspath(os.path.join(HERE, '..'))
S = os.path.abspath(os.path.join(V, '..', '..'))
sys.path.insert(0, HERE)
sys.path.append(os.path.join(S, 'reel', 'lib'))
import base  # noqa: E402  (v1 shared footage access, read-only)
from pgrade import grade  # noqa: E402

W, H, FPS, N = 1080, 1920, 30, 1350
OVERLAY = os.environ.get('PREMIUM_OVERLAY', os.path.join(V, 'layers', 'overlay'))
MIX = os.path.join(V, 'out', 'final_mix.wav')
cv2.setNumThreads(2)

clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
prog = lambda t, a, b: clamp((t - a) / (b - a))
e_out_cubic = lambda x: 1 - (1 - x) ** 3
e_in_out_cubic = lambda x: 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
e_in_out_sine = lambda x: -(math.cos(math.pi * x) - 1) / 2
smooth = lambda x: x * x * (3 - 2 * x)

# ------------------------------------------------------------------ camera
# Slow continuous push-ins. Zoom "resets" only happen inside fast camera moves (whip pan at 12.55,
# pillar pan at 30.95) or at the 16.00 cut, eased over ~0.25 s so they are invisible.
SHOTS = [(0.0, 12.55, 1.000, 1.060), (12.55, 16.0, 1.000, 1.030), (16.0, 30.95, 1.000, 1.055), (30.95, 39.0, 1.000, 1.042)]
FOCUS = (540.0, 900.0)


def _kb_raw(t):
    for a, b, z0, z1 in SHOTS:
        if a <= t < b:
            return z0 + (z1 - z0) * (t - a) / (b - a)
    a, b, z0, z1 = SHOTS[-1]
    v = (z1 - z0) / (b - a)
    return z1 + v * (t - 39.0)


def kb_zoom(t):
    z = _kb_raw(t)
    for tc in (12.55, 30.95):          # ease the reset
        if tc - .14 <= t < tc + .14:
            za, zb = _kb_raw(tc - .1401), _kb_raw(tc + .1401)
            z = za + (zb - za) * smooth(prog(t, tc - .14, tc + .14))
    if t >= 39.0:                      # outro: gentle push into the end card, then slow drift
        z += .085 * e_in_out_cubic(prog(t, 39.0, 40.3)) + .03 * prog(t, 40.3, 45.0)
    return z


def transition(t):
    """(extra zoom, zoom-blur spread) for the 16.00 zoom-through."""
    if 15.50 <= t < 16.0:
        u = prog(t, 15.50, 16.0)
        return 1 + .38 * u ** 3, .11 * u ** 2
    if 16.0 <= t < 16.60:
        u = prog(t, 16.0, 16.60)
        return 1 + .30 * (1 - e_out_cubic(u)), .10 * (1 - u) ** 2.2
    return 1.0, 0.0


def affine(img, z, cx=FOCUS[0], cy=FOCUS[1], interp=cv2.INTER_CUBIC):
    if abs(z - 1) < 1e-4:
        return img
    M = np.float32([[z, 0, (1 - z) * cx], [0, z, (1 - z) * cy]])
    return cv2.warpAffine(img, M, (W, H), flags=interp, borderMode=cv2.BORDER_REFLECT)


def zoom_blur(img, spread):
    """Radial zoom blur: 8 log-spaced scales in [1, 1+spread] by 3 successive 2-tap averages."""
    if spread < .004:
        return img
    f = img.astype(np.float32)
    s = spread
    for _ in range(3):
        f = cv2.addWeighted(f, .5, affine(f, 1 + s, interp=cv2.INTER_LINEAR), .5, 0)
        s *= .5
    return np.clip(f, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ light leaks (brand colours)
LW, LH = 144, 256
_yy, _xx = np.mgrid[0:LH, 0:LW].astype(np.float32)
_U = (_xx + .5) / LW
_V = (_yy + .5) / LH * (16 / 9)
C_AMBER = np.float32([0x45, 0xA7, 0xF3]) / 255
C_ORANGE = np.float32([0x0D, 0x56, 0xFE]) / 255
C_VIOLET = np.float32([0xFE, 0x47, 0xA9]) / 255
C_WARMW = np.float32([.78, .92, 1.0])


def _blob(cx, cy, sx, sy, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    dx, dy = _U - cx, _V - cy
    a = dx * ca + dy * sa
    b = -dx * sa + dy * ca
    return np.exp(-.5 * ((a / sx) ** 2 + (b / sy) ** 2))


# (t0, t_peak, t1, amp, start xy, end xy, angle deg, violet weight, hot core, tail level after t1)
LEAKS = [
    (0.00, 0.50, 3.10, .80, (1.15, .10), (.15, 1.10), -32, .45, .35, 0.0),     # opening
    (3.50, 4.05, 5.40, .24, (-.25, 1.25), (.20, 1.05), 28, .25, 0.0, 0.0),     # "L'arrivée"
    (9.85, 10.35, 11.80, .20, (1.25, .55), (.85, .80), -25, .30, 0.0, 0.0),    # "Le déchargement"
    (15.40, 16.00, 16.95, 1.0, (-.30, 1.55), (1.25, .20), -38, .40, .75, 0.0),  # 16.00 transition
    (25.60, 26.10, 27.80, .26, (-.25, 1.10), (.25, .95), 22, .30, 0.0, 0.0),   # "Le retrait"
    (39.05, 40.00, 42.60, .78, (1.25, -.05), (.05, .95), -35, .45, .45, .16),  # end card
]


def leak(t):
    L = None
    for t0, tp, t1, amp, p0, p1, ang, vio, hot, tail in LEAKS:
        if t < t0 or (t > t1 and tail <= 0):
            continue
        if t <= tp:
            e = smooth(prog(t, t0, tp))
        elif t <= t1:
            e = 1 - (1 - tail / amp) * smooth(prog(t, tp, t1))
        else:
            e = tail / amp
        e *= amp * (1 + .07 * math.sin(2 * math.pi * 1.1 * t) + .04 * math.sin(2 * math.pi * 2.7 * t + 1.3))
        u = prog(t, t0, t1 + (3.0 if tail > 0 else 0.0))
        u = e_in_out_sine(u)
        cx, cy = p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u
        a = math.radians(ang)
        main = _blob(cx, cy, .30, .95, a)
        trail = _blob(cx - .22 * math.cos(a) + .1, cy - .22 * math.sin(a) + .15, .22, .70, a + .2)
        vi = _blob(cx + .45, cy - .35, .20, .45, a - .3)
        img = main[..., None] * C_AMBER + trail[..., None] * C_ORANGE * .9 + vi[..., None] * C_VIOLET * vio
        if hot > 0:
            img += (_blob(cx, cy, .13, .40, a) ** 1.5)[..., None] * C_WARMW * hot
        img *= e
        L = img if L is None else L + img
    if 15.75 <= t < 16.35:                     # warm wash hides the cut
        w = math.sin(math.pi * prog(t, 15.75, 16.35)) ** 2 * .42
        wash = (C_AMBER * .7 + C_WARMW * .3) * w
        L = wash[None, None, :] + (0 if L is None else L)
    if L is None:
        return None
    return np.clip(L, 0, 1).astype(np.float32)


def screen(img, L):
    Lf = cv2.resize(L, (W, H), interpolation=cv2.INTER_LINEAR)
    f = img.astype(np.float32) * (1 / 255)
    f = f + Lf - f * Lf
    return np.clip(f * 255 + .5, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ end-card background
_vig_end = None


def end_background(img, t):
    global _vig_end
    k = e_in_out_cubic(prog(t, 39.0, 40.3))
    if k <= 0:
        return img
    sig = 30 * k
    sm = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    if sig > .5:
        sm = cv2.GaussianBlur(sm, (0, 0), sig / 4)
    bl = cv2.resize(sm, (W, H), interpolation=cv2.INTER_LINEAR)
    f = cv2.addWeighted(img, 1 - min(1, k * 1.4), bl, min(1, k * 1.4), 0).astype(np.float32)
    if _vig_end is None:
        yy, xx = np.mgrid[0:H // 8, 0:W // 8].astype(np.float32)
        d = np.sqrt(((xx + .5) / (W / 8) * 2 - 1) ** 2 + (((yy + .5) / (H / 8) * 2 - 1) / 1.05) ** 2)
        v = 1 - .55 * np.clip((d - .35) / 1.0, 0, 1) ** 1.2
        _vig_end = cv2.resize(v, (W, H), interpolation=cv2.INTER_LINEAR)[..., None]
    warm = np.float32([.74, .88, 1.0])
    dark = 1 - .60 * k
    f = f * (1 - k + k * warm) * dark
    f = f * (1 - k + k * _vig_end)
    return np.clip(f, 0, 255).astype(np.uint8)


# ------------------------------------------------------------------ overlay / finishing
def overlay(img, n):
    p = os.path.join(OVERLAY, f'{n:05d}.png')
    if not os.path.exists(p):
        return img
    ov = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if ov is None or ov.shape[2] != 4:
        return img
    rows = np.flatnonzero(ov[:, :, 3].max(axis=1))
    if not len(rows):
        return img
    y0, y1 = int(rows[0]), int(rows[-1]) + 1                     # blend only the rows that carry graphics
    a = ov[y0:y1, :, 3:4].astype(np.float32) * (1 / 255)
    out = img.copy()
    out[y0:y1] = (img[y0:y1].astype(np.float32) * (1 - a) + ov[y0:y1, :, :3].astype(np.float32) * a + .5).astype(np.uint8)
    return out


def grain(img, n, amt=3.3):
    rng = np.random.default_rng(n * 7919 + 101)
    g = rng.standard_normal((H // 2, W // 2), dtype=np.float32) * amt
    g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
    g = cv2.merge([g, g, g])
    return np.clip(img.astype(np.float32) + g + .5, 0, 255).astype(np.uint8)


def render(n, use_overlay=True):
    t = n / FPS
    if t >= 41.92:
        clip, idx = 'A', base.CLIPS['A']['n'] - 1
    else:
        clip, idx = base.src_for(t)
    img = grade(base.frame(clip, idx), t, clip)
    zt, spread = transition(t)
    img = affine(img, kb_zoom(t) * zt)
    img = zoom_blur(img, spread)
    if 12.0 <= t < 13.1:                               # soften the whip pan a touch
        w = math.sin(math.pi * prog(t, 12.0, 13.1))
        k = 1 + int(30 * w)
        if k > 2:
            img = cv2.addWeighted(img, .5, cv2.blur(img, (k, 1)), .5, 0)
    if 30.7 <= t < 31.25:                              # and the pillar pan
        w = math.sin(math.pi * prog(t, 30.7, 31.25))
        k = 1 + int(22 * w)
        if k > 2:
            img = cv2.addWeighted(img, .6, cv2.blur(img, (k, 1)), .4, 0)
    img = end_background(img, t)
    if t < .40:                                        # fade up from black
        img = cv2.convertScaleAbs(img, alpha=e_out_cubic(prog(t, 0.0, .40)))
    L = leak(t)
    if L is not None:
        img = screen(img, L)
    if use_overlay:
        img = overlay(img, n)
    img = grain(img, n)
    if t >= 43.85:                                     # slow fade to black
        img = cv2.convertScaleAbs(img, alpha=1 - e_in_out_sine(prog(t, 43.85, 44.93)))
    return img


# ------------------------------------------------------------------ encode
def encode(frames, path, crf, use_overlay):
    cmd = ['nice', '-n', '5', 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
           '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf),
           '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-threads', '2',
           '-x264-params', 'keyint=60:min-keyint=30', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in frames:
        p.stdin.write(render(n, use_overlay).tobytes())
        if n % 60 == 0:
            print(f'[{os.getpid()}] frame {n}', flush=True)
    p.stdin.close()
    p.wait()
    if p.returncode:
        raise SystemExit(f'ffmpeg failed for {path}')


def worker(a):
    encode(*a)
    return a[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--end', type=float, default=45.0)
    ap.add_argument('--workers', type=int, default=2)
    ap.add_argument('--out', default=os.path.join(V, 'out', 'premium_master.mp4'))
    ap.add_argument('--stills', default=None)
    ap.add_argument('--crf', type=int, default=17)
    ap.add_argument('--no-overlay', action='store_true')
    a = ap.parse_args()
    use_ov = not a.no_overlay
    if a.stills:
        d = os.path.join(V, 'work', 'stills')
        os.makedirs(d, exist_ok=True)
        for s in a.stills.split(','):
            n = int(round(float(s) * FPS))
            cv2.imwrite(os.path.join(d, f'still_{n:05d}.jpg'), render(n, use_ov), [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('stills ->', d)
        return
    frames = list(range(int(round(a.start * FPS)), min(N, int(round(a.end * FPS)))))
    tmp = tempfile.mkdtemp(prefix='comp_', dir=os.path.join(V, 'work'))
    chunks = np.array_split(frames, a.workers)
    jobs = [([int(x) for x in c], os.path.join(tmp, f'part{i:02d}.mp4'), a.crf, use_ov) for i, c in enumerate(chunks) if len(c)]
    if a.workers > 1:
        import multiprocessing as mp
        with mp.get_context('fork').Pool(a.workers) as pool:
            parts = pool.map(worker, jobs)
    else:
        parts = [worker(j) for j in jobs]
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst]
    if os.path.exists(MIX):
        cmd += ['-ss', f'{frames[0] / FPS:.4f}', '-t', f'{len(frames) / FPS:.4f}', '-i', MIX, '-map', '0:v', '-map', '1:a',
                '-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
    cmd += ['-c:v', 'copy', '-movflags', '+faststart', '-shortest', a.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp)
    print('wrote', a.out)


if __name__ == '__main__':
    main()

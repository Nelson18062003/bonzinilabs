"""HOLOGRAMME compositor.

footage -> holo grade -> hologram boot (slices / pixel columns assemble) -> 16.00 "rebuild" (voxel lines
behind a scan beam) -> outro power-down -> holographic interference (rolling bands, flicker, line jitter,
bar-sync pulses) -> overlay PNGs (RGB-fringed, shimmering) -> scanlines + grain -> H.264 (+ audio).

usage: python3 composite.py [--start S] [--end E] [--workers N] [--out out/x.mp4] [--stills t1,t2] [--crf 17]
"""
import os, sys, argparse, subprocess, math, tempfile, shutil
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base
from grade import grade

V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
W, H, FPS, N = 1080, 1920, 30, 1350
OVERLAY = os.path.join(V, 'layers', 'overlay')
MIX = os.path.join(V, 'out', 'final_mix.wav')
cv2.setNumThreads(2)

clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
prog = lambda t, a, b: clamp((t - a) / (b - a))
e_out_expo = lambda x: 1.0 if x >= 1 else 1 - 2 ** (-10 * x)
e_out_cubic = lambda x: 1 - (1 - x) ** 3
e_in_out_cubic = lambda x: 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
e_in_cubic = lambda x: x ** 3


def rnd(i):
    x = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)


CYAN = np.float32([255, 238, 120])          # BGR
IMPACTS = [(0.0, .06, .5), (16.0, .07, .4), (40.0, .05, .5)]
BARS = [float(t) for t in range(4, 39, 2) if t != 16]
YY = np.arange(H, dtype=np.float32)


def beam_y(t):   # identical to overlay.html beamY()
    if 15.55 <= t < 16.0: return H * e_in_out_cubic(prog(t, 15.55, 16.0))
    if 16.0 <= t < 16.45: return H * e_out_cubic(prog(t, 16.0, 16.45))
    return None


def affine(img, z, dx=0.0, dy=0.0):
    if abs(z - 1) < 1e-4 and abs(dx) < .05 and abs(dy) < .05: return img
    M = np.float32([[z, 0, (1 - z) * W / 2 + dx], [0, z, (1 - z) * H / 2 + dy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def pixelate(img, b):
    small = cv2.resize(img, (max(1, W // b), max(1, H // b)), interpolation=cv2.INTER_AREA)
    return cv2.resize(small, (W, H), interpolation=cv2.INTER_NEAREST)


def voxel_lines(img, amt, seed):
    """Picture broken into voxels + horizontal lines drifting sideways, cyan-lit (amt 0..1)."""
    b = max(2, int(4 + 40 * amt))
    v = pixelate(img, b).astype(np.float32)
    out = v.copy()
    L = 6
    for g in range(H // L):
        r = rnd(seed * 0.37 + g * 1.91)
        dx = int((r - .5) * 2 * 170 * amt ** 1.4) if rnd(g * 3.3 + seed) < .7 else 0
        if dx: out[g * L:(g + 1) * L] = np.roll(v[g * L:(g + 1) * L], dx, axis=1)
    gap = ((YY // 3) % 2 == 1).astype(np.float32) * (0.75 * amt)
    out *= (1 - gap)[:, None, None]
    out = out * (1 - .25 * amt) + CYAN * (.22 * amt)
    return np.clip(out, 0, 255).astype(np.uint8)


def boot(img, t):
    """0-0.7 s: the image assembles from horizontal scan slices / pixel columns."""
    P = pixelate(img, 24)
    out = np.zeros_like(img)
    SL = 8
    ns = H // SL
    for i in range(ns):
        a_i = 0.02 + 0.40 * (i / ns) + 0.16 * rnd(i * 1.7)
        k = (t - a_i) / 0.16
        if k < 0: continue
        y0, y1 = i * SL, (i + 1) * SL
        if k >= 1:
            out[y0:y1] = img[y0:y1]; continue
        dx = int((rnd(i * 3.1) - .5) * 2 * 220 * (1 - k) ** 2)
        src = P if k < .55 else img
        band = np.roll(src[y0:y1], dx, axis=1).astype(np.float32)
        if k < .55:   # pixel-column dropouts while it is still voxels
            cols = np.array([rnd(i * 7.7 + c * 1.3) < (.55 - k) * 1.2 for c in range(W // 24)])
            band[:, np.repeat(cols, 24)[:W]] *= .15
        band = band * (.55 + .45 * k) + CYAN * (.55 * (1 - k))
        out[y0:y1] = np.clip(band, 0, 255).astype(np.uint8)
    return out


def interference(f, t, n):
    """f float32 HxWx3 -> rolling bands, travelling bright band, flicker, bar-sync pulse."""
    m = 1 + .03 * np.sin(2 * np.pi * (YY / 320 - t * .7))
    ph = (t % 3.4) / 3.4
    yc = -250 + ph * (H + 500)
    m += .09 * np.exp(-((YY - yc) / 26) ** 2) + .04 * np.exp(-((YY - yc + 90) / 60) ** 2)
    fl = 1 - .03 * rnd(n * 1.3)
    if rnd(n * 7.1) < .035: fl *= .88
    for T in BARS:
        if T <= t < T + .3: fl *= 1 + .05 * (1 - prog(t, T, T + .3)) ** 2
    m *= fl
    f *= m[:, None, None]
    if rnd(n * 2.9) < .08:   # hologram line jitter
        y0 = int(rnd(n * 4.3) * (H - 90)); h = 8 + int(rnd(n * 5.3) * 70)
        dx = int((rnd(n * 6.1) - .5) * 2 * 16) or 6
        f[y0:y0 + h] = np.roll(f[y0:y0 + h], dx, axis=1)
    return f


def overlay(f, n, t):
    p = os.path.join(OVERLAY, f'{n:05d}.png')
    if not os.path.exists(p): return f
    ov = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if ov is None or ov.shape[2] != 4: return f
    a = ov[:, :, 3].astype(np.float32) * (1 / 255)
    a *= (.95 + .05 * np.sin(2 * np.pi * (YY / 190 - t * 1.2)))[:, None]      # UI shimmer
    prem = ov[:, :, :3].astype(np.float32) * a[:, :, None]
    for c, dx in ((0, -2), (1, 0), (2, 2)):                                      # subtle RGB fringe (B left, R right)
        ac = np.roll(a, dx, axis=1) if dx else a
        pc = np.roll(prem[:, :, c], dx, axis=1) if dx else prem[:, :, c]
        f[:, :, c] = f[:, :, c] * (1 - ac) + pc
    return f


_scan = None
def finishing(f, n):
    global _scan
    if _scan is None:
        _scan = np.ones((H, 1, 1), np.float32); _scan[::3] = .92
    rng = np.random.default_rng(n * 7919 + 23)
    gr = rng.normal(0, 2.6, (H // 2, W // 2)).astype(np.float32)
    gr = cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None]
    return np.clip(f * _scan + gr, 0, 255).astype(np.uint8)


def render(n):
    t = n / FPS
    if t >= 41.92: clip, idx = 'A', base.CLIPS['A']['n'] - 1
    else: clip, idx = base.src_for(t)
    img = grade(base.frame(clip, idx), t, clip)
    # camera: soft zoom punches on the 3 hits, slow push in the outro
    z = 1.0
    for T, amt, dur in IMPACTS:
        if T <= t < T + dur: z *= 1 + amt * (1 - e_out_expo((t - T) / dur))
    if t >= 39.0: z *= 1 + .08 * e_in_cubic(prog(t, 39.0, 40.0)) + .05 * prog(t, 40.0, 45.0)
    img = affine(img, z)
    # whip pan (src B 12.0-13.1): horizontal smear + line tearing
    if 12.0 <= t < 13.1:
        w = math.sin(math.pi * prog(t, 12.0, 13.1))
        k = 1 + int(40 * w)
        if k > 2: img = cv2.addWeighted(img, .4, cv2.blur(img, (k, 1)), .6, 0)
        if w > .3:
            img = img.copy()
            for j in range(6):
                y0 = int(rnd(n * 3.7 + j) * (H - 60)); hh = 6 + int(rnd(n + j * 9.1) * 40)
                img[y0:y0 + hh] = np.roll(img[y0:y0 + hh], int((rnd(n * 1.1 + j) - .5) * 80 * w), axis=1)
    # 16.00 rebuild transition
    by = beam_y(t)
    if by is not None:
        img = img.copy(); by = int(by)
        if t < 16.0:
            u = prog(t, 15.55, 16.0)
            if by > 0: img[:by] = voxel_lines(img, .35 + .65 * u, n)[:by]
        else:
            u = prog(t, 16.0, 16.45)
            img[by:] = voxel_lines(img, 1 - .55 * u, n)[by:]
    f = img.astype(np.float32)
    if 16.0 <= t < 16.22: f = f + CYAN * (.75 * (1 - prog(t, 16.0, 16.22)))
    if 40.0 <= t < 40.3: f = f + CYAN * (.35 * (1 - prog(t, 40.0, 40.3)))
    # boot assembly
    if t < .7:
        f = boot(np.clip(f, 0, 255).astype(np.uint8), t).astype(np.float32)
    # outro: power-down -> dim blurred hologram field under the end card
    if t >= 39.0:
        k = e_in_out_cubic(prog(t, 39.0, 40.0))
        sig = 16 * k
        if sig > .5:
            sm = cv2.resize(f, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
            sm = cv2.GaussianBlur(sm, (0, 0), sig / 4)
            f = cv2.resize(sm, (W, H), interpolation=cv2.INTER_LINEAR)
        drop = k * .5
        if drop > .01 and t < 40.2:   # signal loss: random lines blank out
            for g in range(H // 4):
                if rnd(g * 1.7 + n * .31) < drop * .5: f[g * 4:g * 4 + 4] *= .25
        f *= 1 - .72 * k
    if .6 <= t < 39.6: f = interference(f, t, n)
    f = overlay(f, n, t)
    out = finishing(f, n)
    if t >= 44.3: out = cv2.convertScaleAbs(out, alpha=1 - prog(t, 44.3, 45.0))
    return out


def encode(frames, path, crf):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
           '-threads', '2', '-x264-params', 'keyint=60:min-keyint=30', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in frames:
        p.stdin.write(render(n).tobytes())
        if n % 50 == 0: print(f'[{os.getpid()}] frame {n}', flush=True)
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit(f'ffmpeg failed for {path}')


def worker(a):
    frames, path, crf = a
    encode(frames, path, crf)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=45.0)
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--out', default=os.path.join(V, 'out', 'hologramme_master.mp4'))
    ap.add_argument('--stills', default=None); ap.add_argument('--crf', type=int, default=17)
    a = ap.parse_args()
    if a.stills:
        d = os.path.join(V, 'out', 'stills'); os.makedirs(d, exist_ok=True)
        for s in a.stills.split(','):
            n = int(round(float(s) * FPS)); cv2.imwrite(os.path.join(d, f'still_{n:05d}.jpg'), render(n), [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('stills ->', d); return
    frames = list(range(int(round(a.start * FPS)), min(N, int(round(a.end * FPS)))))
    tmp = tempfile.mkdtemp(prefix='comp_', dir=os.path.join(V, 'tmp'))
    chunks = np.array_split(frames, a.workers)
    jobs = [([int(x) for x in c], os.path.join(tmp, f'part{i:02d}.mp4'), a.crf) for i, c in enumerate(chunks) if len(c)]
    if a.workers > 1:
        import multiprocessing as mp
        with mp.get_context('fork').Pool(a.workers) as pool: parts = pool.map(worker, jobs)
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

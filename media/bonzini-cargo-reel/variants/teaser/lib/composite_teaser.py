"""TEASER compositor: EDL (lib/timeline.py) -> graded source (v1 grade, explicit clip) with speed ramps
(frame blending / fast-forward motion blur) -> zoom punches, shake, whip smear, glitch + flash cuts,
outro blur -> overlay PNGs -> grain/scanlines -> H.264 (+ out/final_mix.wav).

usage: python3 composite_teaser.py [--start S] [--end E] [--workers 2] [--out out/x.mp4] [--stills t1,t2] [--crf 17] [--nooverlay]
"""
import os, sys, argparse, subprocess, math, tempfile, shutil, functools
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base
from grade import grade_src
import timeline as TLm
from timeline import SHOTS, FPS, NF, DUR, FLASH, GLITCH, BIG_HITS

V = TLm.V
W, H = 1080, 1920
OVERLAY = os.path.join(V, 'layers', 'overlay')
cv2.setNumThreads(2)

clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
prog = lambda t, a, b: clamp((t - a) / (b - a))
e_out_expo = lambda x: 1.0 if x >= 1 else 1 - 2 ** (-10 * x)
e_in_out_cubic = lambda x: 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
e_in_cubic = lambda x: x ** 3


def rnd(i):
    x = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)


SMALL_HITS = [(2.32, .045), (3.14, .03), (8.41, .045), (10.17, .04)]
A_FLASH = {206: ('A', 3), 209: ('A', 8)}     # 1-frame glitch previews of the warehouse before the 7.00 cut


def shot_at(t):
    for s in SHOTS:
        if s['a'] <= t < s['b']:
            return s
    return SHOTS[-1]


def src_time(s, t):
    ks = s['keys']
    if t <= ks[0][0]: return ks[0][1], 0.0
    for (t0, s0), (t1, s1) in zip(ks, ks[1:]):
        if t <= t1 or (t1, s1) == ks[-1]:
            sp = (s1 - s0) / (t1 - t0)
            return s0 + (min(t, t1) - t0) * sp, sp
    return ks[-1][1], 0.0


@functools.lru_cache(maxsize=10)
def graded(clip, idx):
    idx = max(0, min(idx, base.CLIPS[clip]['n'] - 1))
    return grade_src(base.frame(clip, idx), clip, idx)


_dis = None
@functools.lru_cache(maxsize=4)
def flow_small(clip, i0):
    """DIS optical flow graded(i0) -> graded(i0+1), computed at 1/4 res (px units of the 1/4 grid)"""
    global _dis
    if _dis is None:
        _dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    g = lambda i: cv2.resize(cv2.cvtColor(graded(clip, i), cv2.COLOR_BGR2GRAY), (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    return _dis.calc(g(i0), g(i0 + 1), None)


_grid = None
def interp(clip, i0, w):
    """motion-compensated in-between frame (optical flow), avoids blend ghosting on handheld motion"""
    global _grid
    if _grid is None:
        gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
        _grid = (gx, gy)
    F = cv2.resize(flow_small(clip, i0), (W, H), interpolation=cv2.INTER_LINEAR) * 4.0
    gx, gy = _grid
    a = cv2.remap(graded(clip, i0), gx - w * F[..., 0], gy - w * F[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    b = cv2.remap(graded(clip, i0 + 1), gx + (1 - w) * F[..., 0], gy + (1 - w) * F[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(a, 1 - w, b, w, 0).astype(np.float32)


def sample(clip, st, nearest=False):
    """source picture at fractional source time st (seconds): flow-interpolated in-betweens"""
    fps = base.CLIPS[clip]['fps']
    x = max(0.0, min(st * fps, base.CLIPS[clip]['n'] - 1))
    i0 = int(math.floor(x)); w = x - i0
    if nearest or w < 0.06 or i0 + 1 >= base.CLIPS[clip]['n']:
        return graded(clip, i0 if w < .5 or i0 + 1 >= base.CLIPS[clip]['n'] else i0 + 1).astype(np.float32)
    if w > 0.94: return graded(clip, i0 + 1).astype(np.float32)
    return interp(clip, i0, w)


def picture(t, n):
    if n in A_FLASH:
        c, i = A_FLASH[n]
        return graded(c, i).astype(np.float32), SHOTS[7]
    s = shot_at(t)
    st, sp = src_time(s, t)
    if abs(sp) > 1.6:     # fast-forward burst: crisp frame skipping (the radial zoom blur is added in render)
        img = sample(s['clip'], st, nearest=True)
    else:
        img = sample(s['clip'], st)
    return img, s


def zoom_shake(t, s):
    k = prog(t, s['a'], s['b'])
    z = s['z'][0] + (s['z'][1] - s['z'][0]) * (k if not s.get('outro') else e_in_cubic(prog(t, s['a'], 16.2)) * .8 + .2 * k)
    if s.get('punch'):
        z *= 1 + s['punch'] * (1 - e_out_expo(prog(t, s['a'], s['a'] + .32)))
    sx = sy = ca = 0.0
    for T in BIG_HITS:
        if T <= t < T + .45:
            d = (1 - (t - T) / .45) ** 2
            sx += (rnd(int(t * FPS) * 3 + 1) - .5) * 2 * 13 * d
            sy += (rnd(int(t * FPS) * 5 + 2) - .5) * 2 * 13 * d
            ca = max(ca, 9 * d)
    for T, amt in SMALL_HITS:
        if T <= t < T + .25:
            q = (t - T) / .25
            z *= 1 + amt * (1 - e_out_expo(q))
            sx += (rnd(int(t * FPS) * 7 + 3) - .5) * 2 * 5 * (1 - q) ** 2
            ca = max(ca, 4 * (1 - q) ** 2)
    return z, sx, sy, ca


def affine(img, z, fx, fy, dx, dy):
    if abs(z - 1) < 1e-4 and abs(dx) < .05 and abs(dy) < .05: return img
    M = np.float32([[z, 0, (1 - z) * fx * W + dx], [0, z, (1 - z) * fy * H + dy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def rgb_split(img, px, vertical=False):
    if px < .5: return img
    b, g, r = cv2.split(img); s = int(round(px)); ax = 0 if vertical else 1
    return cv2.merge([np.roll(b, -s, axis=ax), g, np.roll(r, s, axis=ax)])


def slice_glitch(img, amount, seed):
    out = img.copy(); y = 0; i = 0
    while y < H:
        h = 8 + int(rnd(seed * 17 + i) * 90)
        if rnd(seed * 7 + i * 13) < .55 * amount + .1:
            dx = int((rnd(seed * 29 + i * 3) - .5) * 2 * 130 * amount)
            out[y:y + h] = np.roll(img[y:y + h], dx, axis=1)
        y += h; i += 1
    if amount > .35 and rnd(seed * 3.3) < .6:
        y0 = int(rnd(seed * 5.1) * (H - 400)); hh = 120 + int(rnd(seed * 6.2) * 320)
        band = out[y0:y0 + hh]
        small = cv2.resize(band, (W // 24, max(1, hh // 24)), interpolation=cv2.INTER_AREA)
        out[y0:y0 + hh] = cv2.resize(small, (W, band.shape[0]), interpolation=cv2.INTER_NEAREST)
    return out


_ca = {}
def radial_ca(img, amt):
    if amt < .3: return img
    key = round(amt, 1)
    if key not in _ca:
        s = amt / math.hypot(W / 2, H / 2)
        _ca[key] = [cv2.invertAffineTransform(np.float32([[1 + k * s, 0, -k * s * W / 2], [0, 1 + k * s, -k * s * H / 2]])) for k in (1, -1)]
    Mr, Mb = _ca[key]
    b, g, r = cv2.split(img)
    r = cv2.warpAffine(r, np.float32(Mr), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    b = cv2.warpAffine(b, np.float32(Mb), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.merge([b, g, r])


def glitch_amount(t):
    g = 0.0
    for a, b, v in GLITCH:
        if a <= t < b:
            if v == 'in': g = max(g, .25 + .75 * e_in_cubic(prog(t, a, b)))
            elif v == 'out': g = max(g, 1 - e_out_expo(prog(t, a, b)))
            else: g = max(g, v * math.sin(math.pi * prog(t, a, b)))
    return g


def flash_amount(t):
    f = 0.0
    for T, amt in FLASH.items():
        d = .22 if amt > .5 else .14
        if T <= t < T + d:
            f = max(f, amt * (1 - prog(t, T, T + d)) ** 1.5)
    return f


_scan = None
def finishing(img, n):
    global _scan
    if _scan is None:
        _scan = np.ones((H, 1, 1), np.float32); _scan[::3] = .965
    rng = np.random.default_rng(n * 7919 + 17)
    gr = cv2.resize(rng.normal(0, 3.2, (H // 2, W // 2)).astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None]
    return np.clip(img * _scan + gr, 0, 255).astype(np.uint8)


def overlay(img, n):
    p = os.path.join(OVERLAY, f'{n:05d}.png')
    if not os.path.exists(p): return img
    ov = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if ov is None or ov.shape[2] != 4: return img
    a = ov[:, :, 3:4].astype(np.float32) * (1 / 255)
    return img * (1 - a) + ov[:, :, :3].astype(np.float32) * a


USE_OVERLAY = True


def render(n):
    t = n / FPS
    img, s = picture(t, n)
    img = np.clip(img, 0, 255).astype(np.uint8)
    z, sx, sy, ca = zoom_shake(t, s)
    fx, fy = s['f']
    img = affine(img, z, fx, fy, sx, sy)
    if s.get('whip'):   # whip pan smear + split
        w = math.sin(math.pi * prog(t, s['a'], s['b']))
        k = 1 + int(40 * w)
        if k > 2: img = cv2.addWeighted(img, .4, cv2.blur(img, (k, 1)), .6, 0)
        img = rgb_split(img, 8 * w)
    if s.get('ff'):     # speed burst: radial zoom blur ramping into the cut
        w = e_in_cubic(prog(t, s['a'] + .35, s['b']))
        if w > .03:
            acc = img.astype(np.float32) * .34
            for j in range(1, 5):
                acc += affine(img, 1 + .018 * j * w, .5, .5, 0, 0).astype(np.float32) * .165
            img = np.clip(acc, 0, 255).astype(np.uint8)
    g = glitch_amount(t)
    if g > 0:
        img = slice_glitch(img, g, n)
        img = rgb_split(img, 18 * g)
        if n in A_FLASH: img = rgb_split(cv2.bitwise_not(img) if n == 209 else img, 22, vertical=True)
    img = radial_ca(img, 1.5 + ca + 10 * g)
    f = flash_amount(t)
    if f > .002:
        col = np.array([255, 205, 240], np.float32) if t < 15 else np.array([255, 170, 210], np.float32)
        img = np.clip(img.astype(np.float32) + col * f, 0, 255).astype(np.uint8)
    if s.get('outro') and t >= 15.1:   # blur + desat + darken under the end card
        k = e_in_out_cubic(prog(t, 15.1, 16.0))
        sig = 20 * k
        if sig > .5:
            sm = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
            img = cv2.resize(cv2.GaussianBlur(sm, (0, 0), sig / 4), (W, H), interpolation=cv2.INTER_LINEAR)
        gray = cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        img = cv2.addWeighted(img, 1 - .45 * k, gray, .45 * k, 0)
        img = cv2.convertScaleAbs(img, alpha=1 - .68 * k)
    img = img.astype(np.float32)
    if USE_OVERLAY: img = overlay(img, n)
    img = finishing(img, n)
    if t >= 18.12: img = cv2.convertScaleAbs(img, alpha=1 - prog(t, 18.12, DUR - 1 / FPS))
    return img


def encode(frames, path, crf):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
           '-threads', '2', '-x264-params', 'keyint=30:min-keyint=15', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in frames:
        p.stdin.write(render(n).tobytes())
        if n % 50 == 0: print(f'[{os.getpid()}] frame {n}', flush=True)
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit(f'ffmpeg failed for {path}')


def worker(a):
    encode(*a); return a[1]


def main():
    global USE_OVERLAY, OVERLAY
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=DUR)
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--out', default=os.path.join(V, 'out', 'teaser_master.mp4'))
    ap.add_argument('--stills', default=None); ap.add_argument('--crf', type=int, default=17)
    ap.add_argument('--ovdir', default=None); ap.add_argument('--nooverlay', action='store_true'); ap.add_argument('--stilldir', default=os.path.join(V, 'tmp', 'stills'))
    a = ap.parse_args()
    USE_OVERLAY = not a.nooverlay
    if a.ovdir: OVERLAY = os.path.abspath(a.ovdir)
    if a.stills:
        os.makedirs(a.stilldir, exist_ok=True)
        for s in a.stills.split(','):
            n = int(round(float(s) * FPS)) if '.' in s else int(s)
            cv2.imwrite(os.path.join(a.stilldir, f'still_{n:05d}.jpg'), render(n), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print('stills ->', a.stilldir); return
    frames = list(range(int(round(a.start * FPS)), min(NF, int(round(a.end * FPS)))))
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
    mix = os.path.join(V, 'out', 'final_mix.wav')
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst]
    if os.path.exists(mix):
        cmd += ['-ss', f'{frames[0] / FPS:.4f}', '-t', f'{len(frames) / FPS:.4f}', '-i', mix, '-map', '0:v', '-map', '1:a',
                '-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
    cmd += ['-c:v', 'copy', '-movflags', '+faststart', a.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp)
    print('wrote', a.out)


if __name__ == '__main__':
    main()

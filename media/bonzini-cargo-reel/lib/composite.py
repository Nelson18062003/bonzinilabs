"""Final compositor: footage -> grade -> camera FX / glitch -> overlay layer -> finishing -> H.264 + audio.

usage: python3 composite.py [--start S] [--end E] [--workers N] [--out out/reel.mp4] [--stills t1,t2,...] [--crf 17]
"""
import os, sys, argparse, subprocess, math, tempfile, shutil
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base
from grade import grade

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
W, H, FPS, N = 1080, 1920, 30, 1350
OVERLAY = os.path.join(R, 'layers', 'overlay')
cv2.setNumThreads(2)

# ---------- easing / helpers ----------
clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
prog = lambda t, a, b: clamp((t - a) / (b - a))
e_out_expo = lambda x: 1.0 if x >= 1 else 1 - 2 ** (-10 * x)
e_in_out_cubic = lambda x: 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
e_in_cubic = lambda x: x ** 3
def rnd(i):
    x = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)

IMPACTS = [(0.0, .10, .50), (16.0, .15, .35), (40.0, .06, .45)]   # (time, zoom amount, duration)
BARS = [t for t in np.arange(4.0, 38.01, 2.0) if abs(t - 16.0) > .1]
A_FLASH = {476: 3, 479: 8}   # glitch "preview" frames of clip A during the B->A transition (frame -> A src frame)

def zoom_shake(t):
    z, sx, sy, ca = 1.0, 0.0, 0.0, 0.0
    for T, amt, dur in IMPACTS:
        if T <= t < T + dur:
            k = (t - T) / dur
            z *= 1 + amt * (1 - e_out_expo(k))
            d = (1 - k) ** 2
            sx += (rnd(int(t * FPS) * 3 + 1) - .5) * 2 * 11 * d
            sy += (rnd(int(t * FPS) * 5 + 2) - .5) * 2 * 11 * d
            ca = max(ca, 9 * d)
    for T in BARS:
        if T <= t < T + .25:
            z *= 1 + .012 * (1 - e_out_expo((t - T) / .25))
    if t >= 39.0:  # outro push-in then slow drift
        z *= 1 + .12 * e_in_cubic(prog(t, 39.0, 40.0)) + .06 * prog(t, 40.0, 45.0)
    return z, sx, sy, ca

def glitch_amount(t):
    if 15.70 <= t < 16.0: return .25 + .75 * e_in_cubic(prog(t, 15.70, 16.0))
    if 16.0 <= t < 16.35: return 1 - e_out_expo(prog(t, 16.0, 16.35)) * 1.0
    if 3.25 <= t < 3.45: return .25 * math.sin(math.pi * prog(t, 3.25, 3.45))
    return 0.0

# ---------- picture ops ----------
def affine(img, z, dx, dy):
    if abs(z - 1) < 1e-4 and abs(dx) < .05 and abs(dy) < .05: return img
    M = np.float32([[z, 0, (1 - z) * W / 2 + dx], [0, z, (1 - z) * H / 2 + dy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

def rgb_split(img, px, vertical=False):
    if px < .5: return img
    b, g, r = cv2.split(img)
    s = int(round(px))
    if vertical:
        r = np.roll(r, s, axis=0); b = np.roll(b, -s, axis=0)
    else:
        r = np.roll(r, s, axis=1); b = np.roll(b, -s, axis=1)
    return cv2.merge([b, g, r])

def slice_glitch(img, amount, seed):
    out = img.copy(); y = 0; i = 0
    while y < H:
        h = 8 + int(rnd(seed * 17 + i) * 90)
        if rnd(seed * 7 + i * 13) < .55 * amount + .1:
            dx = int((rnd(seed * 29 + i * 3) - .5) * 2 * 130 * amount)
            out[y:y + h] = np.roll(img[y:y + h], dx, axis=1)
        y += h; i += 1
    # blocky pixelation flicker on a random band
    if amount > .35 and rnd(seed * 3.3) < .6:
        y0 = int(rnd(seed * 5.1) * (H - 400)); hh = 120 + int(rnd(seed * 6.2) * 320)
        band = out[y0:y0 + hh]
        small = cv2.resize(band, (W // 24, max(1, hh // 24)), interpolation=cv2.INTER_AREA)
        out[y0:y0 + hh] = cv2.resize(small, (W, band.shape[0]), interpolation=cv2.INTER_NEAREST)
    return out

_ca_maps = {}
def radial_ca(img, amt):
    """radial chromatic aberration: R scaled out, B scaled in (amt = px at the corners)"""
    if amt < .3: return img
    key = round(amt, 1)
    if key not in _ca_maps:
        s = amt / math.hypot(W / 2, H / 2)
        _ca_maps[key] = [np.float32([[1 + k * s, 0, -k * s * W / 2], [0, 1 + k * s, -k * s * H / 2]]) for k in (1, -1)]
    Mr, Mb = _ca_maps[key]
    b, g, r = cv2.split(img)
    r = cv2.warpAffine(r, np.float32(cv2.invertAffineTransform(Mr)), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    b = cv2.warpAffine(b, np.float32(cv2.invertAffineTransform(Mb)), (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return cv2.merge([b, g, r])

def add_color(img, bgr, alpha):
    if alpha <= .002: return img
    return cv2.addWeighted(img, 1.0, np.full_like(img, 0) + np.uint8(bgr), alpha, 0)

_scan = None
def finishing(img, n):
    global _scan
    if _scan is None:
        _scan = np.ones((H, 1, 1), np.float32); _scan[::3] = .965
    rng = np.random.default_rng(n * 7919 + 17)
    gr = rng.normal(0, 3.2, (H // 2, W // 2)).astype(np.float32)
    gr = cv2.resize(gr, (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None]
    f = img.astype(np.float32) * _scan + gr
    return np.clip(f, 0, 255).astype(np.uint8)

def overlay(img, n):
    p = os.path.join(OVERLAY, f'{n:05d}.png')
    if not os.path.exists(p): return img
    ov = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if ov is None or ov.shape[2] != 4: return img
    a = ov[:, :, 3:4].astype(np.float32) * (1 / 255)
    return (img.astype(np.float32) * (1 - a) + ov[:, :, :3].astype(np.float32) * a).astype(np.uint8)

def laser_y(t): return H * e_in_out_cubic(clamp((t - .05) / .5))

# ---------- frame ----------
def render(n):
    t = n / FPS
    # source picture
    if n in A_FLASH:
        clip, idx = 'A', A_FLASH[n]
    elif t >= 41.92:
        clip, idx = 'A', base.CLIPS['A']['n'] - 1
    else:
        clip, idx = base.src_for(t)
    img = base.frame(clip, idx)
    img = grade(img, t, clip)
    # camera: zoom punches, shake, outro push
    z, sx, sy, ca = zoom_shake(t)
    g = glitch_amount(t)
    if 16.0 <= t < 16.35: z *= 1 + .15 * (1 - e_out_expo(prog(t, 16.0, 16.35))) / 1.15
    img = affine(img, z, sx, sy)
    # whip pan smear + split (src B 12.0-13.1)
    if 12.0 <= t < 13.1:
        w = math.sin(math.pi * prog(t, 12.0, 13.1))
        k = 1 + int(34 * w)
        if k > 2: img = cv2.addWeighted(img, .45, cv2.blur(img, (k, 1)), .55, 0)
        img = rgb_split(img, 7 * w)
    # glitch transition
    if g > 0:
        img = slice_glitch(img, g, n)
        img = rgb_split(img, 18 * g)
        if n in A_FLASH: img = rgb_split(cv2.bitwise_not(img) if n == 479 else img, 22, vertical=True)
    ca_total = 1.6 + ca + 10 * g
    img = radial_ca(img, ca_total)
    # flashes
    if 16.0 <= t < 16.2: img = add_color(img, (255, 200, 235), .9 * (1 - prog(t, 16.0, 16.2)))
    if 40.0 <= t < 40.3: img = add_color(img, (190, 150, 255), .55 * (1 - prog(t, 40.0, 40.3)))
    # outro: blur + darken + desaturate
    if t >= 39.0:
        k = e_in_out_cubic(prog(t, 39.0, 40.0))
        sig = 18 * k
        if sig > .5:
            sm = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
            sm = cv2.GaussianBlur(sm, (0, 0), sig / 4)
            img = cv2.resize(sm, (W, H), interpolation=cv2.INTER_LINEAR)
        gray = cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        img = cv2.addWeighted(img, 1 - .4 * k, gray, .4 * k, 0)
        img = cv2.convertScaleAbs(img, alpha=1 - .65 * k)
    # boot reveal: black below the laser line
    if t < .6:
        y = int(laser_y(t))
        img = img.copy(); img[y:] = 0
        if y > 0:
            y0 = max(0, y - 60)
            band = img[y0:y].astype(np.float32)
            ramp = np.linspace(0, .5, y - y0, dtype=np.float32)[:, None, None]
            img[y0:y] = np.clip(band * (1 + ramp) + 40 * ramp, 0, 255).astype(np.uint8)
    img = overlay(img, n)
    img = finishing(img, n)
    if t >= 44.3: img = cv2.convertScaleAbs(img, alpha=1 - prog(t, 44.3, 45.0))
    return img

# ---------- encode ----------
def encode(frames, path, crf):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
           '-x264-params', 'keyint=60:min-keyint=30', path]
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
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--out', default=os.path.join(R, 'out', 'reel.mp4'))
    ap.add_argument('--stills', default=None); ap.add_argument('--crf', type=int, default=17)
    a = ap.parse_args()
    if a.stills:
        d = os.path.join(R, 'out', 'comp_preview'); os.makedirs(d, exist_ok=True)
        for s in a.stills.split(','):
            n = int(round(float(s) * FPS)); cv2.imwrite(os.path.join(d, f'still_{n:05d}.jpg'), render(n), [cv2.IMWRITE_JPEG_QUALITY, 92])
        print('stills ->', d); return
    frames = list(range(int(round(a.start * FPS)), min(N, int(round(a.end * FPS)))))
    tmp = tempfile.mkdtemp(prefix='comp_', dir=os.path.join(R, 'out'))
    chunks = np.array_split(frames, a.workers)
    jobs = [([int(x) for x in c], os.path.join(tmp, f'part{i:02d}.mp4'), a.crf) for i, c in enumerate(chunks) if len(c)]
    if a.workers > 1:
        import multiprocessing as mp
        with mp.get_context('fork').Pool(a.workers) as pool: parts = pool.map(worker, jobs)
    else:
        parts = [worker(j) for j in jobs]
    lst = os.path.join(tmp, 'list.txt')
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    mix = os.path.join(R, 'out', 'final_mix.wav')
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst]
    if os.path.exists(mix):
        cmd += ['-ss', f'{frames[0] / FPS:.4f}', '-t', f'{len(frames) / FPS:.4f}', '-i', mix, '-map', '0:v', '-map', '1:a',
                '-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
    cmd += ['-c:v', 'copy', '-movflags', '+faststart', '-shortest', a.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp)
    print('wrote', a.out)

if __name__ == '__main__':
    main()

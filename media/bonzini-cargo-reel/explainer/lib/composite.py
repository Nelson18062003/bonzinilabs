"""Explainer compositor: timeline shots -> graded footage (+slow-mo blending) -> look (full / mg-blur)
-> camera life (Ken Burns, chapter punches, flashes) -> overlay layer -> grain -> H.264 + final mix.

usage: python3 composite.py [--start S] [--end E] [--workers N] [--out out/explainer.mp4]
                            [--stills t1,t2,...] [--sheet name] [--crf 18] [--layer overlay]
"""
import os, sys, json, argparse, subprocess, math, tempfile, shutil
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import footage

E = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TLD = json.load(open(os.path.join(E, 'data', 'timeline.json')))
W, H, FPS = 1080, 1920, 30
N = TLD['frames']
SHOTS = TLD['shots']
CH_STARTS = [c['start'] for c in TLD['chapters'][1:]]
CUTS = [s['start'] for s in SHOTS[1:] if all(abs(s['start'] - c) > .05 for c in CH_STARTS)]
cv2.setNumThreads(2)

clamp = lambda x, a=0.0, b=1.0: max(a, min(b, x))
prog = lambda t, a, b: clamp((t - a) / (b - a))
e_out_expo = lambda x: 1.0 if x >= 1 else 1 - 2 ** (-10 * x)
def rnd(i):
    x = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return x - math.floor(x)

def shot_at(t):
    for s in SHOTS:
        if s['start'] <= t < s['end']: return s
    return SHOTS[-1]

def affine(img, z, dx=0.0, dy=0.0):
    if abs(z - 1) < 1e-4 and abs(dx) < .05 and abs(dy) < .05: return img
    M = np.float32([[z, 0, (1 - z) * W / 2 + dx], [0, z, (1 - z) * H / 2 + dy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

def mg_look(img):
    sm = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    sm = cv2.GaussianBlur(sm, (0, 0), 4.0)
    img = cv2.resize(sm, (W, H), interpolation=cv2.INTER_LINEAR)
    gray = cv2.cvtColor(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
    return cv2.convertScaleAbs(cv2.addWeighted(img, .5, gray, .5, 0), alpha=.5)

_scan = None
def finishing(img, n):
    rng = np.random.default_rng(n * 7919 + 17)
    gr = cv2.resize(rng.normal(0, 2.6, (H // 2, W // 2)).astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None]
    return np.clip(img.astype(np.float32) + gr, 0, 255).astype(np.uint8)

def overlay(img, n, layer):
    p = os.path.join(E, 'layers', layer, f'{n:05d}.png')
    if not os.path.exists(p): return img
    ov = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if ov is None or ov.ndim != 3 or ov.shape[2] != 4: return img
    a = ov[:, :, 3:4].astype(np.float32) * (1 / 255)
    return (img.astype(np.float32) * (1 - a) + ov[:, :, :3].astype(np.float32) * a).astype(np.uint8)

def add_color(img, bgr, alpha):
    if alpha <= .002: return img
    return cv2.addWeighted(img, 1.0, np.full((H, W, 3), bgr, np.uint8), alpha, 0)

def render(n, layer='overlay'):
    t = n / FPS
    s = shot_at(t)
    src_t = s['src'] + (t - s['start']) * s['speed']
    img = footage.at(s['clip'], src_t, blend=s['speed'] < 0.97)
    if s['look'] == 'mg':
        img = mg_look(img)
    # camera life: slow push-in on full shots; punches on chapter starts and cuts
    z = 1.0; dx = dy = 0.0
    if s['look'] == 'full':
        z *= 1 + 0.035 * prog(t, s['start'], s['end'])
    for c in CH_STARTS:
        if c <= t < c + .45:
            k = (t - c) / .45; z *= 1 + .08 * (1 - e_out_expo(k))
            d = (1 - k) ** 2; dx += (rnd(n * 3 + 1) - .5) * 14 * d; dy += (rnd(n * 5 + 2) - .5) * 14 * d
    for c in CUTS:
        if c <= t < c + .3: z *= 1 + .03 * (1 - e_out_expo((t - c) / .3))
    img = affine(img, z, dx, dy)
    for c in CH_STARTS:
        if c <= t < c + .18: img = add_color(img, (255, 205, 235), .45 * (1 - (t - c) / .18))
    if t < .25: img = cv2.convertScaleAbs(img, alpha=t / .25)
    img = overlay(img, n, layer)
    img = finishing(img, n)
    tail = TLD['duration'] - .7
    if t > tail: img = cv2.convertScaleAbs(img, alpha=max(0.0, 1 - (t - tail) / .7))
    return img

def encode(frames, path, crf, layer):
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-profile:v', 'high', '-pix_fmt', 'yuv420p',
           '-x264-params', 'keyint=60:min-keyint=30', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in frames:
        p.stdin.write(render(n, layer).tobytes())
        if n % 150 == 0: print(f'[{os.getpid()}] frame {n}/{N}', flush=True)
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit('ffmpeg failed')

def worker(a):
    encode(*a); return a[1]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', type=float, default=0); ap.add_argument('--end', type=float, default=TLD['duration'])
    ap.add_argument('--workers', type=int, default=2); ap.add_argument('--out', default=os.path.join(E, 'out', 'explainer.mp4'))
    ap.add_argument('--stills', default=None); ap.add_argument('--sheet', default=None); ap.add_argument('--crf', type=int, default=18)
    ap.add_argument('--layer', default='overlay'); ap.add_argument('--audio', default=os.path.join(E, 'out', 'final_mix.wav'))
    a = ap.parse_args()
    if a.stills:
        d = os.path.join(E, 'out', 'preview'); os.makedirs(d, exist_ok=True); th = []
        for x in a.stills.split(','):
            n = int(math.floor(float(x) * FPS + 0.5)); im = render(n, a.layer)
            cv2.imwrite(os.path.join(d, f'still_{n:05d}.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 90])
            s = cv2.resize(im, (270, 480), interpolation=cv2.INTER_AREA)
            cv2.putText(s, f'{n / FPS:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 2); th.append(s)
        if a.sheet:
            cols = 6
            while len(th) % cols: th.append(np.zeros_like(th[0]))
            cv2.imwrite(os.path.join(d, a.sheet + '.jpg'), np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 85])
        print('stills ->', d); return
    frames = list(range(int(round(a.start * FPS)), min(N, int(round(a.end * FPS)))))
    tmp = tempfile.mkdtemp(prefix='comp_', dir=os.path.join(E, 'out'))
    jobs = [([int(x) for x in c], os.path.join(tmp, f'part{i:02d}.mp4'), a.crf, a.layer) for i, c in enumerate(np.array_split(frames, a.workers)) if len(c)]
    if a.workers > 1:
        import multiprocessing as mp
        with mp.get_context('fork').Pool(a.workers) as pool: parts = pool.map(worker, jobs)
    else:
        parts = [worker(j) for j in jobs]
    lst = os.path.join(tmp, 'list.txt'); open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst]
    if os.path.exists(a.audio):
        cmd += ['-ss', f'{frames[0] / FPS:.4f}', '-t', f'{len(frames) / FPS:.4f}', '-i', a.audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
    cmd += ['-c:v', 'copy', '-movflags', '+faststart', '-shortest', a.out]
    subprocess.run(cmd, check=True); shutil.rmtree(tmp); print('wrote', a.out)

if __name__ == '__main__':
    main()

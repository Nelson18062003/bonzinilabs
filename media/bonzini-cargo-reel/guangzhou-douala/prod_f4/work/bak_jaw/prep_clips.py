"""prep_clips.py — the footage frames the score needs, and nothing else (disk is tight).

usage:  python3 tools/prep_clips.py [PROD] --score                       the needs straight from the score (SCORE.needs())
        python3 tools/prep_clips.py [PROD] --needs needs.json              [{clip, src_in, src_out, crop?: {w}, pane_w?, scale?}…]
        python3 tools/prep_clips.py [PROD] --need v7:2.0:4.0[:SCALE] …     the same on the command line
        options: --src DIR (default PROD/../src) · --q 3 (JPEG quality, ffmpeg -q:v) · --max-long 2880 (cap of the stored
                 long side, px) · --margin 1.0 (× the scale asked) · --sharpen .35 | --no-sharpen (luma unsharp, only when
                 upscaled ≥ ×1.25) · --clean (delete the frames no need asks for) · --dry (plan only) · --index (only
                 rewrite data/clips.json)
writes  PROD/assets/clips/<clip>/f_NNNN.jpg   frame NNNN = source time NNNN/30 (ffmpeg autorotates, fps=30 normalises:
                                              29.97-fps phones too), Lanczos-scaled, JPEG q≈3
        PROD/assets/clips/<clip>/meta.json    {clip, dw, dh (display px), sw, sh (stored px), k = sw / dw, q, sharpen}
        PROD/data/clips.json                  {clip: {w, h (display px), dur, frames, rot}} — read by the score / render.mjs

SIZE. A need's scale = screen px per SOURCE px (pane width / crop width, max over the shot; the score computes it with the
shot's zoom and its transitions). A clip is stored at k = max(scale of its needs) × margin, capped by --max-long: a clip
only shown full-screen at 576 px wide is stored 1080 wide (k 1.875); one zoomed ×2 on a 9:8 pane is stored at k 3.75…
(capped); one shown in a small card is stored SMALLER than its source. Frames already on disk are skipped; when a new
need asks for more pixels than the clip's meta.json says, the clip's folder is re-made at the new size (said in the log).
The engine maps source px → image px with img.width / dw, so any stored size is valid.

No AI upscaling (Real-ESRGAN invents letters): Lanczos + a light luma unsharp. Deterministic. Prints the disk used.

BAKED (prod_f1, SERIE §3.1 / §3.8): the score's GRADE per city (SCORE.BAKE: Guangzhou exposure −0,10 / contrast +0,06;
Douala contrast +0,08 / saturation ×1,05 / warmth +0,05 — the engine's own formulas as ffmpeg lutrgb / eq) and the
GAUSSIAN BLURS of SCORE.HIDE (kind 'gauss': σ 18, feather 8, margin 10 SOURCE px × the stored scale; rect or ellipse,
keys interpolated like 00_edl.js) are cooked into the frames. meta.json keeps the bake signature: a clip whose grade
or blurs changed is re-made. Variants: BZ_VARIANTS=main,cut (default: BZ_VARIANT) prepares the union of their needs."""
import json, os, sys, subprocess, shutil, argparse, re, hashlib
import numpy as np, cv2
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('prod', nargs='?', default=os.path.abspath(os.path.join(HERE, '..')))
ap.add_argument('--score', action='store_true'); ap.add_argument('--needs'); ap.add_argument('--need', nargs='*', default=[])
ap.add_argument('--src'); ap.add_argument('--q', type=int, default=3); ap.add_argument('--max-long', type=int, default=2880)
ap.add_argument('--margin', type=float, default=1.0); ap.add_argument('--sharpen', type=float, default=.35)
ap.add_argument('--no-sharpen', action='store_true'); ap.add_argument('--clean', action='store_true')
ap.add_argument('--dry', action='store_true'); ap.add_argument('--index', action='store_true'); ap.add_argument('--workers', type=int, default=2)
a = ap.parse_args()
P = os.path.abspath(a.prod); SRC = os.path.abspath(a.src or os.path.join(P, '..', 'src'))
CL = os.path.join(P, 'assets', 'clips'); FPS = 30
def log(*x): print(*x, flush=True)

# ---------------------------------------------------------------------------------------------------------------------
# the clip index (display dims after autorotation)
# ---------------------------------------------------------------------------------------------------------------------
def write_index():
    idx = json.load(open(os.path.join(SRC, 'index.json'))); out = {}
    for e in idx:
        w, h = map(int, re.match(r'(\d+)x(\d+)', e['display']).groups())
        out[e['id']] = dict(w=w, h=h, dur=e['dur'], frames=int(e['dur'] * FPS + 1e-6), rot=e.get('rot', 0), audio=e.get('audio', True))
    os.makedirs(os.path.join(P, 'data'), exist_ok=True)
    json.dump(out, open(os.path.join(P, 'data', 'clips.json'), 'w'), indent=1)
    return out
CLIPS = write_index()
if a.index: log(f'data/clips.json: {len(CLIPS)} clips'); sys.exit(0)

# ---------------------------------------------------------------------------------------------------------------------
# needs
# ---------------------------------------------------------------------------------------------------------------------
needs = []
BAKE, HIDE, HP = {}, {}, {}
try: HSIG = json.load(open(os.path.join(P, 'data', 'hides.json'))).get('sig', {})
except Exception: HSIG = {}
VARIANTS = [v for v in (os.environ.get('BZ_VARIANTS') or os.environ.get('BZ_VARIANT') or 'main').split(',') if v]
for var in VARIANTS:
    js = ("const S=require(%s);const g=S.BAKE||{};console.log(JSON.stringify({needs:S.needs(),hide:S.HIDE||{},hp:S.HP||{},"
          "bake:Object.fromEntries(Object.keys(S.CLIPS).map(c=>[c,g.of?g[g.of(c)]:null]))}))") % json.dumps(os.path.join(P, 'overlay', 'scenes', '01_score.js'))
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True, cwd=P, env=dict(os.environ, BZ_VARIANT=var))
    if r.returncode: log(r.stderr); sys.exit('node could not evaluate the score')
    o = json.loads(r.stdout.strip().splitlines()[-1]); BAKE, HIDE, HP = o['bake'], o['hide'], o['hp']
    if a.score: needs += o['needs']
    log(f'score variant {var}: {len(o["needs"])} shot needs')
if a.needs: needs += json.load(open(a.needs))
for s in a.need:
    p = s.split(':'); n = dict(clip=p[0], src_in=float(p[1]), src_out=float(p[2]))
    if len(p) > 3: n['scale'] = float(p[3])
    needs.append(n)
if not needs and not a.clean: sys.exit('nothing to do: --score, --needs FILE or --need CLIP:IN:OUT[:SCALE]')

def scale_of(n, c):
    if n.get('scale'): return float(n['scale'])
    if n.get('crop') and n['crop'].get('w'): return float(n.get('pane_w', 1080)) / float(n['crop']['w'])
    return max(1080 / c['w'], 1920 / c['h'])                       # full screen, cover
plan = {}
for n in needs:
    c = CLIPS.get(n['clip'])
    if not c: sys.exit(f"unknown clip {n['clip']} (not in {SRC}/index.json)")
    f0 = max(0, int(round(float(n['src_in']) * FPS))); f1 = min(c['frames'] - 1, int(round(float(n['src_out']) * FPS)))
    q = plan.setdefault(n['clip'], dict(frames=set(), scale=0.0, why=[]))
    q['frames'].update(range(f0, f1 + 1)); q['scale'] = max(q['scale'], scale_of(n, c)); q['why'].append(n.get('shot', f'{f0}-{f1}'))

# ---------------------------------------------------------------------------------------------------------------------
# extraction
# ---------------------------------------------------------------------------------------------------------------------
def even(x): return max(2, int(round(x / 2)) * 2)
def runs(fs):
    fs = sorted(fs); out = []
    for f in fs:
        if out and f == out[-1][1] + 1: out[-1][1] = f
        else: out.append([f, f])
    return out
def ok(p): return os.path.exists(p) and os.path.getsize(p) > 1024
def grade_vf(g):
    """the engine's grade (05_footage.js) as pointwise ffmpeg filters: exposure (×2^e), contrast = overlay self-blend,
    saturation (eq), warmth = soft-light with #FF9A3C at |w|·1,6 (W3C soft-light per channel)"""
    if not g: return ''
    X = 'val/255'; out = []
    e, c, sat, w = g.get('exposure', 0), g.get('contrast', 0), g.get('sat', 1), g.get('warmth', 0)
    m = 2 ** e
    bp = g.get('black', 0)                           # black point (review 2, the panel): (x − b) / (1 − b), before the rest
    gm = g.get('gamma', 1)                           # film 4 review 4 (the panel): a mid-tone gamma after the black point
    ex = f'(max(0,{X}-{bp:.4f})/{1 - bp:.4f}*{m:.6f})' if bp else f'({X}*{m:.6f})'
    if abs(gm - 1) > 1e-4: ex = f'(pow(max(0,{X}-{bp:.4f})/{1 - bp:.4f},{gm:.4f})*{m:.6f})'
    ov = f'if(lt({ex},0.5),2*{ex}*{ex},1-2*(1-{ex})*(1-{ex}))'
    y = f'((1-{c:.4f})*{ex}+{c:.4f}*{ov})' if c else ex
    ch = f"clip(255*{y},0,255)"
    out.append(f"lutrgb=r='{ch}':g='{ch}':b='{ch}'")
    if abs(sat - 1) > 1e-3:                          # lum + (x − lum)·sat, in RGB (eq= works in YUV and shifts the hues)
        L = (.299, .587, .114); m = lambda i, j: (L[j] * (1 - sat) + (sat if i == j else 0))
        out.append('colorchannelmixer=' + ':'.join(f'{c}{d}={m(i, j):.5f}' for i, c in enumerate('rgb') for j, d in enumerate('rgb')))
    if abs(w) > 1e-3:
        A = min(1, abs(w) * 1.6)
        def sl(S):                                   # soft-light of backdrop X with constant S, mixed at A
            D = f'if(lte({X},0.25),((16*{X}-12)*{X}+4)*{X},sqrt({X}))'
            res = f'({X}-(1-2*{S:.4f})*{X}*(1-{X}))' if S <= .5 else f'({X}+(2*{S:.4f}-1)*({D}-{X}))'
            return f"clip(255*((1-{A:.4f})*{X}+{A:.4f}*{res}),0,255)"
        rgb = (255 / 255, 154 / 255, 60 / 255) if w > 0 else (60 / 255, 140 / 255, 255 / 255)
        out.append(f"lutrgb=r='{sl(rgb[0])}':g='{sl(rgb[1])}':b='{sl(rgb[2])}'")
    return ','.join(out)
def bake_sig(clip):
    return hashlib.sha1(json.dumps([BAKE.get(clip), HIDE.get(clip, []), HP], sort_keys=True).encode()).hexdigest()[:12]
def box_at(h, s):
    if 'keys' in h:
        ks = h['keys']
        if s <= ks[0][0]: return ks[0][1]
        if s >= ks[-1][0]: return ks[-1][1]
        i = 0
        while i < len(ks) - 2 and s >= ks[i + 1][0]: i += 1
        u = (s - ks[i][0]) / (ks[i + 1][0] - ks[i][0]); return [ks[i][1][j] + (ks[i + 1][1][j] - ks[i][1][j]) * u for j in range(4)]
    return h['box']
def blur_frame(path, clip, f, k):
    """the gaussian blurs active at source time f/30, in stored px (σ, feather, margin × k); True when the frame changed"""
    s = f / FPS; hs = [h for h in HIDE.get(clip, []) if h.get('kind') == 'gauss' and h.get('t0', -1e9) - 1e-6 <= s <= h.get('t1', 1e9) + 1e-6]
    if not hs: return False
    im = cv2.imread(path, cv2.IMREAD_COLOR).astype(np.float32); H_, W_ = im.shape[:2]
    for h in hs:
        sg, fe, mg = h.get('sigma', HP.get('sigma', 18)) * k, h.get('feather', HP.get('feather', 8)) * k, h.get('margin', HP.get('margin', 10)) * k
        x, y, w, hh = [v * k for v in box_at(h, s)]
        X0, Y0 = int(max(0, x - mg - 3 * sg)), int(max(0, y - mg - 3 * sg)); X1, Y1 = int(min(W_, x + w + mg + 3 * sg)), int(min(H_, y + hh + mg + 3 * sg))
        if X1 - X0 < 2 or Y1 - Y0 < 2: continue
        A = im[Y0:Y1, X0:X1]; ds = max(1.0, sg / 4)
        small = cv2.resize(A, (max(2, int(round((X1 - X0) / ds))), max(2, int(round((Y1 - Y0) / ds)))), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), sg / ds)
        Bl = cv2.resize(small, (X1 - X0, Y1 - Y0), interpolation=cv2.INTER_CUBIC)
        M = np.zeros((Y1 - Y0, X1 - X0), np.float32)
        rad = h.get('radius', 0) * k                       # film 4 review 4: rounded corners (SOURCE px), no « censor box »
        if rad > 0 and h.get('shape') != 'ellipse':
            ax0, ay0, ax1, ay1 = x - mg - X0, y - mg - Y0, x + w + mg - X0, y + hh + mg - Y0; rr_ = min(rad, (ax1 - ax0) / 2, (ay1 - ay0) / 2)
            cv2.rectangle(M, (int(round(ax0 + rr_)), int(round(ay0))), (int(round(ax1 - rr_)), int(round(ay1))), 1.0, -1)
            cv2.rectangle(M, (int(round(ax0)), int(round(ay0 + rr_))), (int(round(ax1)), int(round(ay1 - rr_))), 1.0, -1)
            for cx_, cy_ in ((ax0 + rr_, ay0 + rr_), (ax1 - rr_, ay0 + rr_), (ax0 + rr_, ay1 - rr_), (ax1 - rr_, ay1 - rr_)):
                cv2.circle(M, (int(round(cx_)), int(round(cy_))), int(round(rr_)), 1.0, -1, cv2.LINE_AA)
        elif h.get('shape') == 'ellipse':
            cv2.ellipse(M, (int(round(x + w / 2 - X0)), int(round(y + hh / 2 - Y0))), (int(round(w / 2 + mg)), int(round(hh / 2 + mg))), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
        else:
            cv2.rectangle(M, (int(round(x - mg - X0)), int(round(y - mg - Y0))), (int(round(x + w + mg - X0)), int(round(y + hh + mg - Y0))), 1.0, -1)
        M = cv2.GaussianBlur(M, (0, 0), max(.5, fe / 2))[..., None]
        if h.get('grain'):                                 # film 4 review 4: the source's own noise back inside the patch (luma,
            seed = (int(hashlib.sha1(str(h.get('name', '')).encode()).hexdigest()[:8], 16) + f * 7919) % (2 ** 32)   # deterministic per frame)
            gn = np.random.default_rng(seed).normal(0, float(h['grain']), (Y1 - Y0, X1 - X0)).astype(np.float32)
            Bl = Bl + cv2.GaussianBlur(gn, (0, 0), max(.5, .6 * k))[..., None] * 1.6
        im[Y0:Y1, X0:X1] = A * (1 - M) + Bl * M
    cv2.imwrite(path, np.clip(im + .5, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95])
    return True
def post_frame(path, clip, f, k):
    """spatial parts of the grade (review 2), in stored px: 'zones' [{t0, t1, clarity}] = local contrast (x + c·(x − blur σ 24
    stored px)) on the frames of that source span; 'sky' {y0, y1, ev} = an exposure ramp ev → 0 over SOURCE rows y0 → y1
    (smoothstep), full ev above y0. True when the frame changed."""
    g = BAKE.get(clip) or {}; s = f / FPS
    zs = [z for z in g.get('zones', []) if z['t0'] - 1e-6 <= s <= z['t1'] + 1e-6]; sky = g.get('sky'); hi = g.get('hi', 0)
    if not zs and not sky and not hi: return False
    im = cv2.imread(path, cv2.IMREAD_COLOR).astype(np.float32)
    for z in zs:
        bl = cv2.GaussianBlur(im, (0, 0), 24)
        im = im + z['clarity'] * (im - bl)
    if sky:
        H_ = im.shape[0]; y = (np.arange(H_, dtype=np.float32) + .5) / k
        u = np.clip((y - sky['y0']) / (sky['y1'] - sky['y0']), 0, 1); u = u * u * (3 - 2 * u)
        gain = (2.0 ** (sky['ev'] * (1 - u))).astype(np.float32)
        im = im * gain[:, None, None]
    if hi:                                             # film 4 review 4: 'hi' = highlights (−0,3: the milky sky of the panel), a
        lum = np.clip((.114 * im[..., 0] + .587 * im[..., 1] + .299 * im[..., 2]) / 255, 0, 1)   # gain × (1 + hi · smoothstep(.5, 1, luma))
        u = np.clip((lum - .5) / .5, 0, 1); u = u * u * (3 - 2 * u)
        im = im * (1 + hi * u)[..., None]
    cv2.imwrite(path, np.clip(im + .5, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 95])
    return True
def extract(clip, a0, b0, sw, sh, k):
    d = os.path.join(CL, clip); src = os.path.join(SRC, f'{clip}.mp4')
    vf = f"fps={FPS},select='between(n\\,{a0}\\,{b0})',scale={sw}:{sh}:flags=lanczos+accurate_rnd+full_chroma_int"
    if not a.no_sharpen and a.sharpen > 0 and k >= 1.25: vf += f',unsharp=5:5:{a.sharpen:.2f}:5:5:0'
    gv = grade_vf(BAKE.get(clip))
    if gv: vf += ',' + gv
    cmd = ['nice', '-n', '5', 'ffmpeg', '-v', 'error', '-y', '-t', f'{(b0 + 3) / FPS:.4f}', '-i', src, '-vf', vf, '-fps_mode', 'passthrough',
           '-q:v', str(a.q), '-qmin', '1', '-start_number', str(a0), os.path.join(d, 'f_%04d.jpg')]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return (clip, a0, b0, r.returncode, r.stderr.strip()[-300:])

jobs, report = [], []
for clip, q in sorted(plan.items(), key=lambda kv: int(re.sub(r'\D', '', kv[0]) or 0)):
    c = CLIPS[clip]; d = os.path.join(CL, clip); mp = os.path.join(d, 'meta.json')
    k = min(q['scale'] * a.margin, a.max_long / max(c['w'], c['h']))
    sw, sh = even(c['w'] * k), even(c['h'] * k)
    meta = json.load(open(mp)) if os.path.exists(mp) else None
    sig = bake_sig(clip)
    if meta and meta.get('k', 0) >= k * .99 and meta.get('q') == a.q and meta.get('bake') == sig: sw, sh, k = meta['sw'], meta['sh'], meta['k']   # keep the bigger stored size
    elif meta:
        why = 'the grade / blurs changed' if meta.get('bake') != sig and meta.get('k', 0) >= k * .99 else f'the score now asks k {k:.3f}'
        if meta.get('bake') != sig and meta.get('k', 0) >= k * .99: sw, sh, k = meta['sw'], meta['sh'], meta['k']
        log(f'{clip}: stored at k {meta.get("k")} ({meta.get("sw")}×{meta.get("sh")}), {why}: folder re-made')
        if not a.dry: shutil.rmtree(d)
    if not a.dry:
        os.makedirs(d, exist_ok=True)
        json.dump(dict(clip=clip, dw=c['w'], dh=c['h'], sw=sw, sh=sh, k=round(sw / c['w'], 4), q=a.q,
                       sharpen=0 if a.no_sharpen or k < 1.25 else a.sharpen, bake=sig, grade=BAKE.get(clip),
                       hides=[h.get('name') for h in HIDE.get(clip, [])], hides_sig=HSIG.get(clip)), open(mp, 'w'))
    miss = [f for f in q['frames'] if not ok(os.path.join(d, f'f_{f:04d}.jpg'))]
    rr = runs(miss)
    report.append((clip, len(q['frames']), len(miss), sw, sh, k, q['scale'], rr, q['why']))
    for r0, r1 in rr: jobs.append((clip, r0, r1, sw, sh, k))
for clip, nf, nm, sw, sh, k, sc, rr, why in report:
    log(f'{clip:4s} {nf:4d} frames needed ({", ".join(map(str, why))}) · scale asked ×{sc:.3f} → stored {sw}×{sh} (k {k:.3f}) · '
        f'{nm} to extract in {len(rr)} run(s) {[(x, y) for x, y in rr][:6]}{" …" if len(rr) > 6 else ""}')
if a.dry: sys.exit(0)
with ThreadPoolExecutor(max(1, a.workers)) as ex:
    for clip, a0, b0, rc, err in ex.map(lambda j: extract(*j), jobs):
        if rc: log(f'ERROR {clip} {a0}-{b0}: {err}')
nb = npf = 0
for clip, a0, b0, sw, sh, k in jobs:                       # the spatial grade, then the blurs, on the frames made by this run only
    kk_ = sw / CLIPS[clip]['w']
    for f in range(a0, b0 + 1):
        pth = os.path.join(CL, clip, f'f_{f:04d}.jpg')
        if ok(pth) and post_frame(pth, clip, f, kk_): npf += 1
        if ok(pth) and blur_frame(pth, clip, f, kk_): nb += 1
log(f'spatial grade on {npf} frame(s) · blurs baked into {nb} frame(s)')
bad = []
for clip, q in plan.items():
    d = os.path.join(CL, clip); m = [f for f in q['frames'] if not ok(os.path.join(d, f'f_{f:04d}.jpg'))]
    if m: bad.append(f'{clip}: {len(m)} frame(s) missing after extraction (first {m[:5]}; the source may be shorter)')
for b in bad: log('WARNING', b)

# ---------------------------------------------------------------------------------------------------------------------
# clean + disk
# ---------------------------------------------------------------------------------------------------------------------
if a.clean and os.path.isdir(CL):
    freed = 0
    for clip in sorted(os.listdir(CL)):
        d = os.path.join(CL, clip); keep = plan.get(clip, {}).get('frames', set())
        for fn in os.listdir(d):
            m = re.match(r'f_(\d{4})\.jpg$', fn)
            if m and int(m.group(1)) not in keep: freed += os.path.getsize(os.path.join(d, fn)); os.remove(os.path.join(d, fn))
        if not any(re.match(r'f_\d{4}\.jpg$', f) for f in os.listdir(d)): shutil.rmtree(d)
    log(f'--clean: {freed / 1048576:.1f} MiB freed')
tot = 0
if os.path.isdir(CL):
    for clip in sorted(os.listdir(CL), key=lambda s: int(re.sub(r'\D', '', s) or 0)):
        d = os.path.join(CL, clip); fs = [f for f in os.listdir(d) if f.endswith('.jpg')]
        sz = sum(os.path.getsize(os.path.join(d, f)) for f in fs); tot += sz
        log(f'  assets/clips/{clip}: {len(fs)} frames, {sz / 1048576:.1f} MiB')
du = shutil.disk_usage(P)
log(f'assets/clips total {tot / 1048576:.1f} MiB · disk free {du.free / 1073741824:.2f} GiB')

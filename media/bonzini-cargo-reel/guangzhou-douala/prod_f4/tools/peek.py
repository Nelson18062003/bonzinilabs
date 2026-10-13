"""peek.py — look at source frames (as prep_clips.py / track_box.py read them: fps=30 grid, autorotated display px).

usage:  python3 tools/peek.py CLIP T [T …] [--rect x0,y0,x1,y1 …] [--box x,y,w,h …] [--keys FILE.json] [--zoom 2]
                              [--crop x0,y0,x1,y1] [--cols 4] [--out out/peek_CLIP.jpg] [--grid]
        T = source seconds (a:b:step = a range); --rect = a frame window to draw (green, e.g. the visible crop);
        --box = a fixed box (yellow); --keys = hide keys [[s, [x, y, w, h]]…] or a list of hides {t0, t1, keys|box}
        (red, interpolated like 00_edl.js); --crop = only show this part of the source; --zoom = scale of the tiles.
writes  one sheet (time printed on each tile). Deterministic; source px everywhere."""
import json, os, sys, subprocess, argparse
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser()
ap.add_argument('clip'); ap.add_argument('times', nargs='+')
ap.add_argument('--rect', action='append', default=[]); ap.add_argument('--box', action='append', default=[])
ap.add_argument('--keys', action='append', default=[]); ap.add_argument('--crop'); ap.add_argument('--zoom', type=float, default=1.0)
ap.add_argument('--cols', type=int, default=4); ap.add_argument('--grid', type=int, default=0); ap.add_argument('--out'); ap.add_argument('--src', default=os.path.join(P, '..', 'src'))
a = ap.parse_args()

def display_dims(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation',
                          '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)['streams'][0]; w, h = s['width'], s['height']
    rot = next((abs(int(d.get('rotation', 0))) for d in s.get('side_data_list', []) if 'rotation' in d), 0)
    return (h, w) if rot % 180 == 90 else (w, h)

ts = []
for t in a.times:
    if ':' in t: x0, x1, st = map(float, t.split(':')); n = int(round((x1 - x0) / st)) + 1; ts += [round(x0 + i * st, 4) for i in range(n)]
    else: ts.append(float(t))
src = os.path.join(a.src, f'{a.clip}.mp4'); dw, dh = display_dims(src)
fs = sorted(set(int(round(t * 30)) for t in ts)); f0, f1 = fs[0], fs[-1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-t', f'{(f1 + 3) / 30:.4f}', '-i', src, '-vf', f"fps=30,select='between(n\\,{f0}\\,{f1})'",
                      '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, dh, dw, 3)

hides = []
for k in a.keys:
    d = json.load(open(k)) if os.path.exists(k) else json.loads(k)
    if isinstance(d, dict): d = [d]
    elif d and isinstance(d[0], list): d = [{'keys': d}]
    hides += d
def box_at(h, s):
    if 'keys' in h:
        ks = h['keys']; t0 = h.get('t0', ks[0][0]); t1 = h.get('t1', ks[-1][0])
        if s < t0 - 1e-6 or s > t1 + 1e-6: return None
        if s <= ks[0][0]: return ks[0][1]
        if s >= ks[-1][0]: return ks[-1][1]
        i = 0
        while i < len(ks) - 2 and s >= ks[i + 1][0]: i += 1
        u = (s - ks[i][0]) / (ks[i + 1][0] - ks[i][0]); return [ks[i][1][j] + (ks[i + 1][1][j] - ks[i][1][j]) * u for j in range(4)]
    if s < h.get('t0', -1e9) - 1e-6 or s > h.get('t1', 1e9) + 1e-6: return None
    return h['box']

cx0, cy0, cx1, cy1 = (map(int, a.crop.split(','))) if a.crop else (0, 0, dw, dh)
tiles = []
for t in ts:
    f = int(round(t * 30)); im = frames[min(len(frames) - 1, f - f0)].copy()
    for r in a.rect:
        x0, y0, x1, y1 = map(float, r.split(',')); cv2.rectangle(im, (int(x0), int(y0)), (int(x1), int(y1)), (0, 255, 0), 1)
    for b in a.box:
        x, y, w, h = map(float, b.split(',')); cv2.rectangle(im, (int(x), int(y)), (int(x + w), int(y + h)), (0, 255, 255), 1)
    for h in hides:
        b = box_at(h, f / 30)
        if b: cv2.rectangle(im, (int(round(b[0])), int(round(b[1]))), (int(round(b[0] + b[2])), int(round(b[1] + b[3]))), (0, 0, 255), 1)
    if a.grid:
        for gx in range(0, dw, a.grid):
            cv2.line(im, (gx, 0), (gx, dh), (255, 0, 255) if gx % (a.grid * 2) == 0 else (160, 0, 160), 1)
            cv2.putText(im, str(gx), (gx + 2, cy0 + 40), cv2.FONT_HERSHEY_PLAIN, .8, (255, 0, 255), 1)
        for gy in range(0, dh, a.grid):
            cv2.line(im, (0, gy), (dw, gy), (255, 0, 255) if gy % (a.grid * 2) == 0 else (160, 0, 160), 1)
            cv2.putText(im, str(gy), (cx0 + 2, gy - 2), cv2.FONT_HERSHEY_PLAIN, .8, (255, 0, 255), 1)
    im = im[cy0:cy1, cx0:cx1]
    if a.zoom != 1: im = cv2.resize(im, (int(im.shape[1] * a.zoom), int(im.shape[0] * a.zoom)), interpolation=cv2.INTER_LANCZOS4)
    cv2.putText(im, f'{a.clip} r {f / 30:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 0), 3)
    cv2.putText(im, f'{a.clip} r {f / 30:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 1)
    tiles.append(im)
cols = min(a.cols, len(tiles)); rows = (len(tiles) + cols - 1) // cols; th, tw = tiles[0].shape[:2]
sheet = np.zeros((rows * (th + 4), cols * (tw + 4), 3), np.uint8)
for i, im in enumerate(tiles):
    r, c = divmod(i, cols); sheet[r * (th + 4):r * (th + 4) + th, c * (tw + 4):c * (tw + 4) + tw] = im
out = a.out or os.path.join(P, 'out', f'peek_{a.clip}.jpg'); os.makedirs(os.path.dirname(out), exist_ok=True)
cv2.imwrite(out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 88]); print(out, sheet.shape[1], 'x', sheet.shape[0])

"""green_centre.py — the centre of the GREEN machine (film 4) on source frames, every N frames, for the hand-checked keys of
the trail (M4) and of the light (M2). The machine is the only saturated light-green object of v36–v40: its centre = the
centroid of the largest connected blob of green pixels (HSV h 35–85, s > 90, v > 70) inside an optional ROI.

usage:  python3 tools/green_centre.py CLIP T0 T1 [--every 3] [--roi x0,y0,x1,y1] [--sheet out/…jpg] [--json work/c_NAME.json]
prints  [[src_t, [cx, cy, area, x0, y0, x1, y1]]…]  (source display px)"""
import json, os, sys, subprocess, argparse
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser(); ap.add_argument('clip'); ap.add_argument('t0', type=float); ap.add_argument('t1', type=float)
ap.add_argument('--every', type=int, default=3); ap.add_argument('--roi'); ap.add_argument('--sheet'); ap.add_argument('--json')
ap.add_argument('--src', default=os.path.join(P, '..', 'src')); a = ap.parse_args()
def display_dims(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation',
                          '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)['streams'][0]; w, h = s['width'], s['height']
    rot = next((abs(int(d.get('rotation', 0))) for d in s.get('side_data_list', []) if 'rotation' in d), 0)
    return (h, w) if rot % 180 == 90 else (w, h)
src = os.path.join(a.src, f'{a.clip}.mp4'); dw, dh = display_dims(src)
f0, f1 = int(round(a.t0 * 30)), int(round(a.t1 * 30))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-t', f'{(f1 + 3) / 30:.4f}', '-i', src, '-vf', f"fps=30,select='between(n\\,{f0}\\,{f1})'",
                      '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, dh, dw, 3)
rx0, ry0, rx1, ry1 = map(int, a.roi.split(',')) if a.roi else (0, 0, dw, dh)
out = []; tiles = []
idx = list(range(0, len(frames), a.every)); idx += [len(frames) - 1] if idx[-1] != len(frames) - 1 else []
for i in idx:
    im = frames[i]; hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (35, 90, 70), (85, 255, 255))   # light green of the machine; roi = np.zeros_like(m); roi[ry0:ry1, rx0:rx1] = 255; m = cv2.bitwise_and(m, roi)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)); m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m)
    if n <= 1: out.append([round((f0 + i) / 30, 4), None]); continue
    big = st[1:, cv2.CC_STAT_AREA].max(); keep = [k for k in range(1, n) if st[k, cv2.CC_STAT_AREA] >= max(150, .03 * big)]
    sel = np.isin(lab, keep); ys, xs = np.nonzero(sel); ar = int(sel.sum())
    x, y, x1_, y1_ = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()); w, h = x1_ - x, y1_ - y
    cx, cy = (x + x1_) / 2, (y + y1_) / 2        # the centre of the machine = the centre of its green extent
    out.append([round((f0 + i) / 30, 4), [round(cx, 1), round(cy, 1), int(ar), int(x), int(y), int(x + w), int(y + h)]])
    if a.sheet:
        c = im.copy(); cv2.rectangle(c, (x, y), (x + w, y + h), (0, 255, 255), 1); cv2.drawMarker(c, (int(cx), int(cy)), (0, 0, 255), cv2.MARKER_CROSS, 24, 2)
        cv2.putText(c, f'{(f0 + i) / 30:.2f}', (6, 24), cv2.FONT_HERSHEY_SIMPLEX, .7, (0, 255, 255), 2)
        tiles.append(cv2.resize(c, (dw // 3, dh // 3), interpolation=cv2.INTER_AREA))
print(json.dumps(out))
if a.json: json.dump({'clip': a.clip, 'keys': out}, open(a.json, 'w'))
if a.sheet and tiles:
    cols = 10; rows = (len(tiles) + cols - 1) // cols; th, tw = tiles[0].shape[:2]
    S = np.zeros((rows * th, cols * tw, 3), np.uint8)
    for j, t in enumerate(tiles): r, c = divmod(j, cols); S[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = t
    cv2.imwrite(a.sheet, S, [cv2.IMWRITE_JPEG_QUALITY, 85]); print(a.sheet, file=sys.stderr)

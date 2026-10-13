"""zoomgrid.py CLIP T [T …] --crop x0,y0,x1,y1 [--zoom 4] [--step 10] [--cols 2] [--out FILE] [--pts JSON]
A magnified view of source frames (as prep_clips reads them: fps 30, display px) with a labelled coordinate grid in the
MARGINS (labels never cover the image), to key points by hand. --pts {"T": [[x, y], …]} draws given points (red) + polygon."""
import json, os, sys, subprocess, argparse
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser(); ap.add_argument('clip'); ap.add_argument('times', nargs='+')
ap.add_argument('--crop', required=True); ap.add_argument('--zoom', type=float, default=4); ap.add_argument('--step', type=int, default=10)
ap.add_argument('--cols', type=int, default=2); ap.add_argument('--out'); ap.add_argument('--pts'); ap.add_argument('--src', default=os.path.join(P, '..', 'src'))
a = ap.parse_args()
def dims(path):
    s = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', path], capture_output=True, text=True).stdout)['streams'][0]
    rot = next((abs(int(d.get('rotation', 0))) for d in s.get('side_data_list', []) if 'rotation' in d), 0)
    return (s['height'], s['width']) if rot % 180 == 90 else (s['width'], s['height'])
ts = []
for t in a.times:
    if ':' in t: x0, x1, st = map(float, t.split(':')); n = int(round((x1 - x0) / st)) + 1; ts += [round(x0 + i * st, 4) for i in range(n)]
    else: ts.append(float(t))
src = os.path.join(a.src, f'{a.clip}.mp4'); dw, dh = dims(src)
fs = sorted(set(int(round(t * 30)) for t in ts)); f0, f1 = fs[0], fs[-1]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-t', f'{(f1 + 3) / 30:.4f}', '-i', src, '-vf', f"fps=30,select='between(n\\,{f0}\\,{f1})'", '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, dh, dw, 3)
x0, y0, x1, y1 = map(int, a.crop.split(',')); Z = a.zoom; M = 46
pts = json.loads(a.pts) if a.pts else {}
tiles = []
for f in fs:
    im = frames[min(len(frames) - 1, f - f0)][y0:y1, x0:x1]
    im = cv2.resize(im, (int((x1 - x0) * Z), int((y1 - y0) * Z)), interpolation=cv2.INTER_CUBIC)
    H_, W_ = im.shape[:2]; can = np.full((H_ + 2 * M, W_ + 2 * M, 3), 30, np.uint8); can[M:M + H_, M:M + W_] = im
    for gx in range((x0 // a.step + 1) * a.step, x1, a.step):
        X = int(M + (gx - x0) * Z); maj = gx % (a.step * 5) == 0
        cv2.line(can, (X, M), (X, M + H_), (255, 0, 255) if maj else (150, 60, 150), 1)
        if maj or a.step * Z >= 40: cv2.putText(can, str(gx), (X - 14, M - 8), cv2.FONT_HERSHEY_SIMPLEX, .42, (255, 255, 0), 1); cv2.putText(can, str(gx), (X - 14, M + H_ + 30), cv2.FONT_HERSHEY_SIMPLEX, .42, (255, 255, 0), 1)
    for gy in range((y0 // a.step + 1) * a.step, y1, a.step):
        Y = int(M + (gy - y0) * Z); maj = gy % (a.step * 5) == 0
        cv2.line(can, (M, Y), (M + W_, Y), (255, 0, 255) if maj else (150, 60, 150), 1)
        if maj or a.step * Z >= 40: cv2.putText(can, str(gy), (2, Y + 5), cv2.FONT_HERSHEY_SIMPLEX, .42, (255, 255, 0), 1); cv2.putText(can, str(gy), (M + W_ + 3, Y + 5), cv2.FONT_HERSHEY_SIMPLEX, .42, (255, 255, 0), 1)
    key = f'{f / 30:.4f}'; pp = pts.get(key) or pts.get(str(round(f / 30, 2))) or pts.get(str(f))
    if pp:
        q = np.array([[M + (x - x0) * Z, M + (y - y0) * Z] for x, y in pp], np.int32)
        cv2.polylines(can, [q], True, (0, 0, 255), 2)
        for c in q: cv2.circle(can, tuple(int(v) for v in c), 5, (0, 0, 255), -1)
    cv2.putText(can, f'{a.clip} r {f / 30:.3f} (f {f})', (M, 18), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 255, 255), 1)
    tiles.append(can)
cols = min(a.cols, len(tiles)); rows = (len(tiles) + cols - 1) // cols; th, tw = tiles[0].shape[:2]
sheet = np.zeros((rows * th, cols * tw, 3), np.uint8)
for i, im in enumerate(tiles): r, c = divmod(i, cols); sheet[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = im
out = a.out or os.path.join(P, 'out', f'zoom_{a.clip}.jpg'); cv2.imwrite(out, sheet, [cv2.IMWRITE_JPEG_QUALITY, 90]); print(out, sheet.shape[1], 'x', sheet.shape[0])

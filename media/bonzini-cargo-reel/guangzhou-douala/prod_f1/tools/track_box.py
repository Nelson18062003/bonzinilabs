"""track_box.py — keyframes for a hide box (mosaic / blur / cover) that follows an object in a clip.

usage:  python3 tools/track_box.py CLIP T0 T1 X Y W H [--back] [--every 3] [--pad 4] [--search 60] [--src DIR] [--sheet OUT.jpg]
        CLIP = v7 · T0/T1 = SOURCE seconds · X Y W H = the box at T0, SOURCE DISPLAY px (after autorotation)
prints  a JSON list [[src_t, [x, y, w, h]], …] ready for SCORE.HIDE / shot.hide (keys), one key every `--every` frames
        (+ the last frame), padded by `--pad` px; the per-frame correlation is printed on stderr (< .6 = check by eye).

Frames are read exactly as prep_clips.py extracts them (fps=30, frame n = source time n/30, ffmpeg autorotation), so a
key at src_t = n/30 is glued to f_NNNN.jpg. Template matching (normalised cross-correlation) in a window around the last
position; the template is refreshed slowly (10 %) so a turning object is followed without drifting off a static one.
--back: the box is given at T1 and the track runs backwards (an object best seen at the END of the span); run both
ways and merge the keys where each correlation is high.
Deterministic; nothing is written except --sheet (a strip of the tracked crops to check by eye)."""
import json, os, sys, subprocess, argparse
import numpy as np, cv2

HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
ap = argparse.ArgumentParser()
ap.add_argument('clip'); ap.add_argument('t0', type=float); ap.add_argument('t1', type=float)
ap.add_argument('box', type=float, nargs=4)
ap.add_argument('--every', type=int, default=3); ap.add_argument('--pad', type=float, default=4)
ap.add_argument('--search', type=int, default=60); ap.add_argument('--src', default=os.path.join(P, '..', 'src'))
ap.add_argument('--sheet', default=None)
ap.add_argument('--back', action='store_true', help='the box is given at T1: track backwards (T1 → T0)')
a = ap.parse_args()

def display_dims(path):
    """display size after autorotation (ffprobe: coded size + rotation side data)"""
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
if a.back: frames = frames[::-1]
x, y, w, h = a.box; ix, iy, iw, ih = int(round(x)), int(round(y)), int(round(w)), int(round(h))
gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32) for f in frames]
tpl = gray[0][iy:iy + ih, ix:ix + iw].copy(); boxes = [(x, y)]; cc = [1.0]
for k in range(1, len(gray)):
    px, py = boxes[-1]; S = a.search
    x0, y0 = int(max(0, px - S)), int(max(0, py - S)); x1, y1 = int(min(dw, px + iw + S)), int(min(dh, py + ih + S))
    win = gray[k][y0:y1, x0:x1]
    if win.shape[0] < ih or win.shape[1] < iw: boxes.append((px, py)); cc.append(0.0); continue
    r = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED); _, mv, _, ml = cv2.minMaxLoc(r)
    # sub-pixel peak (parabola on the 3 neighbours)
    def sub(v, i, n):
        if 0 < i < n - 1:
            d = v[i - 1] - 2 * v[i] + v[i + 1]
            return i + (.5 * (v[i - 1] - v[i + 1]) / d if abs(d) > 1e-9 else 0)
        return i
    sx = sub(r[ml[1], :], ml[0], r.shape[1]); sy = sub(r[:, ml[0]], ml[1], r.shape[0])
    nx, ny = float(x0 + sx), float(y0 + sy); boxes.append((nx, ny)); cc.append(float(mv))
    jx, jy = int(round(nx)), int(round(ny))
    if mv > .7 and 0 <= jx and jx + iw <= dw and 0 <= jy and jy + ih <= dh:
        tpl = .9 * tpl + .1 * gray[k][jy:jy + ih, jx:jx + iw]
if a.back: boxes = boxes[::-1]; cc = cc[::-1]; frames = frames[::-1]
keys = []
for k in list(range(0, len(boxes), a.every)) + ([len(boxes) - 1] if (len(boxes) - 1) % a.every else []):
    bx, by = boxes[k]
    keys.append([round((f0 + k) / 30, 4), [round(bx - a.pad, 1), round(by - a.pad, 1), round(w + 2 * a.pad, 1), round(h + 2 * a.pad, 1)]])
print(json.dumps(keys))
print(f'# {a.clip} frames {f0}-{f1} ({len(boxes)}), display {dw}x{dh}; correlation min {min(cc):.2f} '
      f'(frames < .6: {[f0 + i for i, c in enumerate(cc) if c < .6][:12]})', file=sys.stderr)
if a.sheet:
    tiles = []
    for k in range(0, len(frames), max(1, len(frames) // 12)):
        bx, by = boxes[k]; m = 30
        X0, Y0 = int(max(0, bx - m)), int(max(0, by - m)); X1, Y1 = int(min(dw, bx + w + m)), int(min(dh, by + h + m))
        c = frames[k][Y0:Y1, X0:X1].copy()
        cv2.rectangle(c, (int(bx - X0), int(by - Y0)), (int(bx - X0 + w), int(by - Y0 + h)), (0, 255, 255), 1)
        tiles.append(cv2.resize(c, (int(c.shape[1] * 160 / c.shape[0]), 160)))
    cv2.imwrite(a.sheet, np.hstack(tiles))

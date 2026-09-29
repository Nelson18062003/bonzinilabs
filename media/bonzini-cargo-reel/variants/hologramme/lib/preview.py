"""Quick look: graded footage + an overlay layer dir -> contact sheet (+ full-res jpgs).
usage: python3 lib/preview.py LAYERDIR 10,60,75 out/prev/sheet.jpg [cols]"""
import sys, os, cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import base
from grade import grade
V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
def comp(n, layer):
    t = n / 30
    c, i = base.src_for(t)
    if t >= 41.92: c, i = 'A', 647
    im = grade(base.frame(c, i), t, c).astype(np.float32)
    if t >= 39.0: im *= 0.3
    p = os.path.join(layer, f'{n:05d}.png')
    if os.path.exists(p):
        ov = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32)
        a = ov[:, :, 3:4] / 255
        im = im * (1 - a) + ov[:, :, :3] * a
    return np.clip(im, 0, 255).astype(np.uint8)
if __name__ == '__main__':
    layer = os.path.abspath(sys.argv[1]); frames = [int(x) for x in sys.argv[2].split(',')]; out = sys.argv[3]
    cols = int(sys.argv[4]) if len(sys.argv) > 4 else 7
    os.makedirs(os.path.dirname(out), exist_ok=True)
    th = []
    for n in frames:
        im = comp(n, layer)
        cv2.imwrite(os.path.join(os.path.dirname(out), f'full_{n:05d}.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 90])
        s = cv2.resize(im, (270, 480), interpolation=cv2.INTER_AREA)
        cv2.putText(s, f'{n/30:.2f}s', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 200, 255), 2)
        th.append(s)
    while len(th) % cols: th.append(np.zeros_like(th[0]))
    cv2.imwrite(out, np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 85])

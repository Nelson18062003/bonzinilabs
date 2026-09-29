import sys, os, cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import base
try:
    from grade import grade
except Exception:
    grade = lambda im, t, clip=None: im
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
def comp(n, layer):
    t = n / 30
    im = grade(base.base_at(t), t).astype(np.float32)
    p = os.path.join(R, 'layers', layer, f'{n:05d}.png')
    if os.path.exists(p):
        ov = cv2.imread(p, cv2.IMREAD_UNCHANGED).astype(np.float32)
        a = ov[:, :, 3:4] / 255
        im = im * (1 - a) + ov[:, :, :3] * a
    return np.clip(im, 0, 255).astype(np.uint8)
if __name__ == '__main__':
    layer, frames, out = sys.argv[1], [int(x) for x in sys.argv[2].split(',')], sys.argv[3]
    cols = int(sys.argv[4]) if len(sys.argv) > 4 else 5
    th = []
    for n in frames:
        im = comp(n, layer)
        cv2.imwrite(os.path.join(os.path.dirname(out), f'full_{n:05d}.jpg'), im, [cv2.IMWRITE_JPEG_QUALITY, 88])
        s = cv2.resize(im, (324, 576), interpolation=cv2.INTER_AREA)
        cv2.putText(s, f'{n/30:.2f}s', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 2)
        th.append(s)
    while len(th) % cols: th.append(np.zeros_like(th[0]))
    cv2.imwrite(out, np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 85])

"""quad_track.py CLIP T_KEY T_OTHER QUADJSON — propagate a hand-keyed quadrilateral (4 corners, source px) from frame T_KEY
to every frame towards T_OTHER with an ECC homography on the region around the quad (gradient magnitude images), as a
STARTING POINT for hand keys (every result is drawn and checked by eye with zoomgrid.py --pts). Prints {t: [[x,y]×4]}."""
import json, sys, subprocess, os
import numpy as np, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); P = os.path.abspath(os.path.join(HERE, '..'))
clip, tk, to, q = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), np.array(json.loads(sys.argv[4]), np.float32)
dw, dh = 576, 1024
fk, fo = int(round(tk * 30)), int(round(to * 30)); f0, f1 = min(fk, fo), max(fk, fo)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-t', f'{(f1 + 3) / 30:.4f}', '-i', os.path.join(P, '..', 'src', clip + '.mp4'), '-vf', f"fps=30,select='between(n\\,{f0}\\,{f1})'", '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, dh, dw, 3)
def grad(im):
    g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32), (0, 0), 1.2)
    return cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
step = -1 if fo < fk else 1; out = {f'{fk / 30:.4f}': q.tolist()}; cur = q.copy()
for f in range(fk + step, fo + step, step):
    A, B = grad(fr[f - step - f0]), grad(fr[f - f0])
    mask = np.zeros((dh, dw), np.uint8); cv2.fillConvexPoly(mask, cur.astype(np.int32), 255)
    ring = cv2.dilate(mask, np.ones((9, 9), np.uint8)); 
    Wm = np.eye(3, dtype=np.float32)
    try:
        _, Wm = cv2.findTransformECC(A, B, Wm, cv2.MOTION_HOMOGRAPHY, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), ring, 5)
    except cv2.error as e:
        print('ECC failed at', f, file=sys.stderr)
    # Wm maps B coords -> A coords (template A): points in A → B = inv(Wm)
    Hi = np.linalg.inv(Wm); pts = cv2.perspectiveTransform(cur.reshape(-1, 1, 2), Hi).reshape(-1, 2)
    cur = pts.astype(np.float32); out[f'{f / 30:.4f}'] = [[round(float(x), 1), round(float(y), 1)] for x, y in cur]
print(json.dumps(out))

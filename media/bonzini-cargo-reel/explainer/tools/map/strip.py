import cv2, numpy as np, sys, glob, os
E = '/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/explainer'
t0, t1, step, out = float(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 10
th = []
t = t0
while t < t1 - 1e-6:
    n = int(round(t * 30)); p = f'{E}/layers/_map/{n:05d}.png'
    if os.path.exists(p):
        im = cv2.imread(p, cv2.IMREAD_UNCHANGED); a = im[:, :, 3:4] / 255.0
        bg = np.full(im.shape[:2] + (3,), (30, 12, 18), np.float32)
        c = (im[:, :, :3] * a + bg * (1 - a)).astype(np.uint8)[280:1160]
        c = cv2.resize(c, (180, 147), interpolation=cv2.INTER_AREA)
        cv2.putText(c, f'{t:.1f}', (4, 14), cv2.FONT_HERSHEY_SIMPLEX, .45, (0, 255, 255), 1); th.append(c)
    t += step
while len(th) % cols: th.append(np.zeros_like(th[0]))
cv2.imwrite(f'{E}/out/preview/{out}.jpg', np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 85])
print('ok', len(th))

import sys, cv2, numpy as np
sys.path.insert(0, '.')
import base
clip, step, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
fps = base.CLIPS[clip]['fps']; n = base.CLIPS[clip]['n']
a = int(sys.argv[4]) if len(sys.argv) > 4 else 0
b = int(sys.argv[5]) if len(sys.argv) > 5 else n
th = []
for i in range(a, b, step):
    p = f'{base.WORK}/{clip}_up/{i:05d}.png'
    im = cv2.imread(p)
    s = cv2.resize(im, (162, 288), interpolation=cv2.INTER_AREA)
    cv2.putText(s, f'{i/fps:.2f}', (4, 20), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 0), 4)
    cv2.putText(s, f'{i/fps:.2f}', (4, 20), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 255, 255), 2)
    th.append(s)
cols = 12
while len(th) % cols: th.append(np.zeros_like(th[0]))
cv2.imwrite(out, np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 80])

import sys, cv2, numpy as np
sys.path.insert(0, '.')
import base
from grade import grade_src
items = [s.split(':') for s in sys.argv[2].split(',')]
th = []
for clip, st in items:
    fps = base.CLIPS[clip]['fps']; idx = min(int(round(float(st) * fps)), base.CLIPS[clip]['n'] - 1)
    im = grade_src(base.frame(clip, idx), clip, idx)
    s = cv2.resize(im, (270, 480), interpolation=cv2.INTER_AREA)
    lab = f'{clip} {float(st):.2f}'
    cv2.putText(s, lab, (6, 26), cv2.FONT_HERSHEY_SIMPLEX, .8, (0, 0, 0), 5); cv2.putText(s, lab, (6, 26), cv2.FONT_HERSHEY_SIMPLEX, .8, (0, 255, 255), 2)
    th.append(s)
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 7
while len(th) % cols: th.append(np.zeros_like(th[0]))
cv2.imwrite(sys.argv[1], np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 85])

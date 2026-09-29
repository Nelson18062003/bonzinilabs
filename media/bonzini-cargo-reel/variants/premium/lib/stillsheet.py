"""Tile work/stills/still_NNNNN.jpg (selected frames) into a labelled sheet: stillsheet.py out.jpg n1,n2,... [cols] [w]"""
import sys, os, cv2, numpy as np
V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
out, frames = sys.argv[1], [int(x) for x in sys.argv[2].split(',')]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
w = int(sys.argv[4]) if len(sys.argv) > 4 else 300
h = int(w * 16 / 9)
th = []
for n in frames:
    im = cv2.imread(os.path.join(V, 'work', 'stills', f'still_{n:05d}.jpg'))
    s = cv2.resize(im, (w, h), interpolation=cv2.INTER_AREA)
    cv2.putText(s, f'{n/30:.2f}', (5, 20), cv2.FONT_HERSHEY_SIMPLEX, .55, (0, 255, 0), 2)
    th.append(s)
while len(th) % cols: th.append(np.zeros_like(th[0]))
cv2.imwrite(out, np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 88])

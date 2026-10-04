import sys, glob, os, cv2, numpy as np
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(glob.glob(os.path.join(d, '*.png')) + glob.glob(os.path.join(d, '*.jpg')))
th = []
for f in fs:
    im = cv2.resize(cv2.imread(f), (270, 480), interpolation=cv2.INTER_AREA)
    cv2.putText(im, f'{int(os.path.basename(f)[:5]) / 30:.2f}', (6, 22), cv2.FONT_HERSHEY_SIMPLEX, .6, (180, 40, 200), 2); th.append(im)
while len(th) % cols: th.append(np.full_like(th[0], 255))
cv2.imwrite(out, np.vstack([np.hstack(th[i:i + cols]) for i in range(0, len(th), cols)]), [cv2.IMWRITE_JPEG_QUALITY, 88])

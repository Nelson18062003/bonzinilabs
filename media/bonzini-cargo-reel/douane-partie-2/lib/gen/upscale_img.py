"""Upscale illustrations ×2 with Real-ESRGAN general x4v3 (then area-downscale to 2×). usage: upscale_img.py in.png out.png [scale=2]"""
import sys, os, time, torch, cv2, numpy as np
SP = os.environ.get('BZ_GEN_ROOT', '.')
sys.path.insert(0, SP)
from srvgg import load
torch.set_num_threads(int(os.environ.get('THREADS', '4')))
m = load(os.path.join(SP, 'models/realesr-general-x4v3.pth'))
src, dst = sys.argv[1], sys.argv[2]; sc = float(sys.argv[3]) if len(sys.argv) > 3 else 2
im = cv2.imread(src, cv2.IMREAD_UNCHANGED); alpha = im[:, :, 3] if im.shape[2] == 4 else None; rgb = im[:, :, :3]
t0 = time.time(); H, W = rgb.shape[:2]; T = 480; out = np.zeros((H * 4, W * 4, 3), np.float32)
for y in range(0, H, T):                     # tiles with 16 px overlap to bound memory
    for x in range(0, W, T):
        y0, x0 = max(0, y - 16), max(0, x - 16); y1, x1 = min(H, y + T + 16), min(W, x + T + 16)
        t = torch.from_numpy(rgb[y0:y1, x0:x1, ::-1].copy()).permute(2, 0, 1).float().div(255)[None]
        with torch.inference_mode(): r = m(t)[0].clamp(0, 1).permute(1, 2, 0).numpy()[:, :, ::-1]
        oy, ox = (y - y0) * 4, (x - x0) * 4; h, w = (min(H, y + T) - y) * 4, (min(W, x + T) - x) * 4
        out[y * 4:y * 4 + h, x * 4:x * 4 + w] = r[oy:oy + h, ox:ox + w]
res = cv2.resize((out * 255).round().astype(np.uint8), (int(W * sc), int(H * sc)), interpolation=cv2.INTER_AREA)
if alpha is not None: res = np.dstack([res, cv2.resize(alpha, (int(W * sc), int(H * sc)), interpolation=cv2.INTER_CUBIC)])
cv2.imwrite(dst, res); print(f'{src} → {dst} {res.shape[1]}x{res.shape[0]} in {time.time() - t0:.0f}s')

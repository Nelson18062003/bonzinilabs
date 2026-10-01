"""Footage prep for explainer v2: stabilised clip -> (B/B2: carrier lettering removed) -> Real-ESRGAN x4 (general v3)
-> 1080x1920 JPG q92 in foot/up/<clip>/NNNNN.jpg (even source frames only: prints play on twos). Resumable."""
import os, sys, time, cv2, numpy as np, torch
HERE = os.path.dirname(os.path.abspath(__file__)); E = os.path.dirname(HERE); S = os.path.dirname(E)
sys.path.insert(0, HERE); sys.path.insert(0, '/home/user/bonzinilabs/media/bonzini-cargo-reel/prep')
import cleanplate as cp
from srvgg import load
torch.set_num_threads(int(os.environ.get('THREADS', '3')))
m = load(os.path.join(S, 'models/realesr-general-x4v3.pth')).to(memory_format=torch.channels_last)
clips = sys.argv[1:] or ['B2', 'B', 'A']
for clip in clips:
    out = os.path.join(E, 'foot', 'up', clip); os.makedirs(out, exist_ok=True)
    cap = cv2.VideoCapture(os.path.join(S, 'work', f'{clip}_stab.mkv')); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    t0 = time.time(); done = 0
    for i in range(n):
        ok, fr = cap.read()
        if not ok: break
        if i % 2: continue                      # prints play on twos: even source frames only
        dst = f'{out}/{i:05d}.jpg'
        if os.path.exists(dst): continue
        if clip in ('B', 'B2'):
            mk, b = cp.letter_mask(fr); fr = cp.clean(fr, mk, b)
        x = torch.from_numpy(fr[:, :, ::-1].copy()).permute(2, 0, 1).float().div(255)[None].contiguous(memory_format=torch.channels_last)
        with torch.inference_mode(): y = m(x)
        y = (y[0].clamp(0, 1).permute(1, 2, 0).numpy()[:, :, ::-1] * 255).round().astype(np.uint8)
        y = cv2.resize(y, (1080, 1920), interpolation=cv2.INTER_AREA)
        cv2.imwrite(dst + '.tmp.jpg', y, [cv2.IMWRITE_JPEG_QUALITY, 92]); os.replace(dst + '.tmp.jpg', dst)
        done += 1
        if done % 20 == 0: print(f'{clip} {i}/{n} {(time.time()-t0)/done:.2f}s/f', flush=True)
    print('DONE', clip, n, flush=True)

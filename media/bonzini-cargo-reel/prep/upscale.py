import sys, os, time, torch, cv2, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from srvgg import load
torch.set_num_threads(int(os.environ.get('THREADS', '4')))
m = load(os.path.join(os.path.dirname(__file__), 'models/realesr-general-x4v3.pth')).to(memory_format=torch.channels_last)
for src, outdir in zip(sys.argv[1::2], sys.argv[2::2]):
    os.makedirs(outdir, exist_ok=True)
    cap = cv2.VideoCapture(src); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); i = 0; t0 = time.time()
    while True:
        ok, fr = cap.read()
        if not ok: break
        dst = f"{outdir}/{i:05d}.png"
        if not os.path.exists(dst):
            x = torch.from_numpy(fr[:, :, ::-1].copy()).permute(2, 0, 1).float().div(255)[None].contiguous(memory_format=torch.channels_last)
            with torch.inference_mode(): y = m(x)
            y = (y[0].clamp(0, 1).permute(1, 2, 0).numpy()[:, :, ::-1] * 255).round().astype(np.uint8)
            y = cv2.resize(y, (1080, 1920), interpolation=cv2.INTER_AREA)
            cv2.imwrite(dst + '.tmp.png', y, [cv2.IMWRITE_PNG_COMPRESSION, 1]); os.replace(dst + '.tmp.png', dst)
        i += 1
        if i % 10 == 0: print(f"{src} {i}/{n} {(time.time()-t0)/i:.2f}s/f", flush=True)
    print("DONE", src, i, flush=True)

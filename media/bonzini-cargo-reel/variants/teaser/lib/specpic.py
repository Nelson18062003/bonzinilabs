import soundfile as sf, numpy as np, cv2, sys
R='/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/reel/out/voice_stems/'
def pic(path, a, b, out, pxs=400, marks=()):
    x, sr = sf.read(path)
    if x.ndim > 1: x = x.mean(1)
    seg = x[int(a*sr):int(b*sr)]
    hop = sr // pxs; nfft = 1024
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(seg, (nfft//2, nfft//2)), nfft)[::hop]
    S = np.abs(np.fft.rfft(frames * np.hanning(nfft), axis=1))
    S = S[:, :int(8000 / (sr / nfft))]
    D = 20*np.log10(S + 1e-7); D = np.clip((D - D.max() + 80) / 80, 0, 1)
    img = (D.T[::-1] * 255).astype(np.uint8)
    img = cv2.resize(img, (img.shape[1], 300))
    img = cv2.applyColorMap(img, cv2.COLORMAP_MAGMA)
    # envelope
    e = np.sqrt(np.convolve(seg**2, np.ones(sr//100)/(sr//100), 'same'))[::hop][:img.shape[1]]
    ed = np.clip((20*np.log10(e+1e-9) + 70) / 70, 0, 1)
    env = np.zeros((120, img.shape[1], 3), np.uint8)
    for i, v in enumerate(ed): env[120-int(v*118):, i] = (200, 200, 200)
    img = np.vstack([img, env])
    for k in range(int(np.ceil(a*10)), int(b*10)+1):
        t = k/10; xx = int((t-a)*pxs)
        c = (0,255,255) if k % 5 == 0 else (90,90,90)
        cv2.line(img, (xx, 300 if k%5 else 0), (xx, 420), c, 1)
        if k % 5 == 0: cv2.putText(img, f'{t:.1f}', (xx+2, 14), cv2.FONT_HERSHEY_SIMPLEX, .45, (0,255,255), 1)
    for t, lab in marks:
        xx = int((t-a)*pxs); cv2.line(img, (xx, 0), (xx, 420), (0,255,0), 1); cv2.putText(img, lab, (xx+2, 34), cv2.FONT_HERSHEY_SIMPLEX, .45, (0,255,0), 1)
    cv2.imwrite(out, img)
if __name__ == '__main__':
    clip, a, b, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
    import json
    caps = json.load(open('/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/reel/data/captions.json'))
    off = 0 if clip == 'B' else 16.0
    marks = [(w['s'] - off, w['w']) for p in caps['pages'] if p['clip'] == clip for w in p['words'] if a <= w['s'] - off <= b]
    pic(R + f'{clip}_final.wav', a, b, out, 300, marks)

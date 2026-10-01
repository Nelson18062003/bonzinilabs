"""Fast fallback frames: even source frames at 360x640 (B/B2 cleaned) in foot/lo/<clip>/NNNNN.jpg."""
import os, sys, cv2
HERE = os.path.dirname(os.path.abspath(__file__)); E = os.path.dirname(HERE); S = os.path.dirname(E)
sys.path.insert(0, HERE); import cleanplate as cp
for clip in ['A', 'B', 'B2']:
    out = os.path.join(E, 'foot', 'lo', clip); os.makedirs(out, exist_ok=True)
    cap = cv2.VideoCapture(os.path.join(S, 'work', f'{clip}_stab.mkv')); i = 0
    while True:
        ok, fr = cap.read()
        if not ok: break
        if i % 2 == 0:
            if clip != 'A': m, b = cp.letter_mask(fr); fr = cp.clean(fr, m, b)
            cv2.imwrite(f'{out}/{i:05d}.jpg', fr, [cv2.IMWRITE_JPEG_QUALITY, 90])
        i += 1
    print(clip, i)

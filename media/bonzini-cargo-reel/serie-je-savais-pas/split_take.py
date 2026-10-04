"""Split a take generated as ONE utterance into two voice lines at its first long silence (a 1-word line such as « Allô ? »
comes out truncated when synthesised alone; said before the next sentence it gets its natural length).
usage: python3 split_take.py EP_DIR SRC_ID FIRST_ID SECOND_ID [--min-pause 0.3]
   e.g. python3 split_take.py ep4 T3x T3 T3b   : audio/vo/T3x_s4.wav → audio/vo/T3_s4.wav + audio/vo/T3b_s4.wav
The source takes are moved to audio/vo_raw/ (they are not voice lines of the script)."""
import sys, os, glob, shutil
import numpy as np, soundfile as sf
a = sys.argv[1:]; E = os.path.abspath(a[0]); SRC, A, B = a[1], a[2], a[3]
MINP = float(a[a.index('--min-pause') + 1]) if '--min-pause' in a else .3
VO, RAW = os.path.join(E, 'audio', 'vo'), os.path.join(E, 'audio', 'vo_raw'); os.makedirs(RAW, exist_ok=True)
for p in sorted(glob.glob(os.path.join(VO, f'{SRC}_s*.wav'))):
    k = os.path.basename(p)[len(SRC) + 2:-4]
    y, sr = sf.read(p); m = y if y.ndim == 1 else y.mean(1)
    fr = int(.01 * sr); e = np.sqrt(np.convolve(m ** 2, np.ones(fr) / fr, 'same')); on = e > max(e.max() * .04, 1e-4)
    idx = np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0])); segs = list(zip(idx[::2], idx[1::2]))
    gaps = [(b0, a1) for (a0, b0), (a1, b1) in zip(segs, segs[1:]) if (a1 - b0) / sr >= MINP]
    if not gaps: print(f'{os.path.basename(p)}: no pause ≥ {MINP}s — skipped'); continue
    b0, a1 = gaps[0]; cut = (b0 + a1) // 2
    first, second = y[:cut], y[cut:]
    sf.write(os.path.join(VO, f'{A}_s{k}.wav'), first, sr); sf.write(os.path.join(VO, f'{B}_s{k}.wav'), second, sr)
    shutil.move(p, os.path.join(RAW, os.path.basename(p)))
    sp1 = (b0 - segs[0][0]) / sr
    print(f'{SRC}_s{k} → {A}_s{k} (speech {sp1:.2f}s) + {B}_s{k}  (pause {(a1 - b0) / sr:.2f}s cut in the middle)')

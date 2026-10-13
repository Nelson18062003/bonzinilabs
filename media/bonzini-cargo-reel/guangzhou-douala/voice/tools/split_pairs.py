"""Split the two-sentence takes (lines.PAIRS) at their LONGEST inside pause (the sentence break) into two candidate takes
of the two lines: work/audio/vo/<PAIR>_s<k>.wav -> <first>_s<PAIR>-<k>.wav + <second>_s<PAIR>-<k>.wav (cut in the middle of
the pause; the source moves to work/audio/vo_raw/). After serie/split_take.py, which cut at the FIRST pause.
usage: python3 split_pairs.py [--min-pause 0.18]"""
import sys, os, glob, shutil
import numpy as np, soundfile as sf
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import PAIRS
V = os.path.abspath(os.path.join(H, '..')); VO = os.path.join(V, 'work', 'audio', 'vo'); RAW = os.path.join(V, 'work', 'audio', 'vo_raw')
os.makedirs(RAW, exist_ok=True)
MINP = float(sys.argv[sys.argv.index('--min-pause') + 1]) if '--min-pause' in sys.argv else .18
for pid, (A, B) in PAIRS.items():
    for p in sorted(glob.glob(os.path.join(VO, f'{pid}_s*.wav'))):
        k = os.path.basename(p)[len(pid) + 2:-4]
        y, sr = sf.read(p); m = y if y.ndim == 1 else y.mean(1)
        fr = int(.01 * sr); e = np.sqrt(np.convolve(m ** 2, np.ones(fr) / fr, 'same')); on = e > max(e.max() * .04, 1e-4)
        idx = np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0])); segs = list(zip(idx[::2], idx[1::2]))
        gaps = [(b0, a1) for (a0, b0), (a1, b1) in zip(segs, segs[1:]) if (a1 - b0) / sr >= MINP]
        if not gaps: print(f'{pid}_s{k}: no pause ≥ {MINP}s — skipped'); continue
        b0, a1 = (gaps[0] if A is None else max(gaps, key=lambda g: g[1] - g[0])); cut = (b0 + a1) // 2      # lead-in: its first pause
        if A: sf.write(os.path.join(VO, f'{A}_s{pid}-{k}.wav'), y[:cut], sr)
        sf.write(os.path.join(VO, f'{B}_s{pid}-{k}.wav'), y[cut:], sr)
        shutil.move(p, os.path.join(RAW, os.path.basename(p)))
        print(f'{pid}_s{k} → {A} ({b0 / sr:.2f}s) + {B}  (pause {(a1 - b0) / sr:.2f}s)')

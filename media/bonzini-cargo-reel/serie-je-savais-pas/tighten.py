"""Cap the silences INSIDE a take (the TTS sometimes holds ~0.9 s after « ! » or « ? » + <break>): every pause longer than
--cap (default 0.45 s) is shortened to --cap by cutting its middle (20 ms equal-power crossfade, room noise kept).
usage: python3 tighten.py EP_DIR [--cap 0.45] [--only N1,T2]
Raw takes are kept once in E/audio/vo_raw/ (never overwritten); E/audio/vo/<take>.wav is rewritten from the raw take,
so the script can be re-run with another cap."""
import sys, os, glob, shutil
import numpy as np, soundfile as sf
a = sys.argv[1:]; E = os.path.abspath(a[0])
CAP = float(a[a.index('--cap') + 1]) if '--cap' in a else .45
only = set(a[a.index('--only') + 1].split(',')) if '--only' in a else None
VO, RAW = os.path.join(E, 'audio', 'vo'), os.path.join(E, 'audio', 'vo_raw')
os.makedirs(RAW, exist_ok=True)
def pauses(y, sr, thr_rel=.04, merge=.06):
    fr = int(.01 * sr); e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); on = e > max(e.max() * thr_rel, 1e-4)
    idx = np.flatnonzero(np.diff(np.r_[0, on.astype(int), 0])); segs = []
    for s0, s1 in zip(idx[::2], idx[1::2]):
        if segs and (s0 - segs[-1][1]) / sr < merge: segs[-1] = (segs[-1][0], s1)
        else: segs.append((s0, s1))
    return [(b0, a1) for (a0, b0), (a1, b1) in zip(segs, segs[1:])]
for p in sorted(glob.glob(os.path.join(VO, '*_s*.wav'))):
    name = os.path.basename(p)
    if only and name.rsplit('_s', 1)[0] not in only: continue
    raw = os.path.join(RAW, name)
    if not os.path.exists(raw): shutil.copy2(p, raw)
    y, sr = sf.read(raw); mono = y if y.ndim == 1 else y.mean(1)
    xf = int(.02 * sr); keep = int(CAP * sr); out, last, cut = [], 0, 0.0
    for b0, a1 in pauses(mono, sr):
        if a1 - b0 <= keep + xf: continue
        m0 = b0 + keep // 2; m1 = a1 - keep // 2                     # cut [m0, m1), crossfade xf around the joint
        out.append(y[last:m0]); last = m1 - xf; cut += (m1 - m0) / sr
        if out[-1].shape[0] >= xf:
            t = np.linspace(0, np.pi / 2, xf); fo, fi = np.cos(t), np.sin(t)
            if y.ndim > 1: fo, fi = fo[:, None], fi[:, None]
            out[-1] = np.concatenate([out[-1][:-xf], out[-1][-xf:] * fo + y[last:last + xf] * fi]); last += xf
    out.append(y[last:]); z = np.concatenate(out)
    sf.write(p, z, sr)
    if cut > .005: print(f'{name:12s} -{cut:.2f}s  ({len(y) / sr:.2f} → {len(z) / sr:.2f})')

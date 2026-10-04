"""Seamless audio loops: render a piece longer than the loop (so reverbs/decays ring out), then fold everything that
rings past the loop end back onto the start. Played in a loop, the seam is inaudible because the start already
contains the tail of the previous pass.
usage: python3 loopwrap.py in.wav out.wav LOOP_SECONDS   (or import wrap)"""
import sys
import numpy as np, soundfile as sf

def wrap(y, n_loop):
    """y: (n,) or (n, ch) with n >= n_loop; returns exactly n_loop samples with the overhang folded onto the start."""
    y = np.asarray(y, float)
    out = y[:n_loop].copy()
    k = n_loop
    while k < len(y):                     # overhang longer than one loop folds again
        seg = y[k:k + n_loop]
        out[:len(seg)] += seg
        k += n_loop
    return out

def seam_report(y, sr):
    """level jump across the seam (last 5 ms vs first 5 ms, dB) — should be ~0"""
    m = int(.005 * sr)
    a = np.sqrt(np.mean(y[-m:] ** 2)) + 1e-9; b = np.sqrt(np.mean(y[:m] ** 2)) + 1e-9
    return 20 * np.log10(b / a)

if __name__ == '__main__':
    y, sr = sf.read(sys.argv[1]); n = int(round(float(sys.argv[3]) * sr))
    z = wrap(y, n); sf.write(sys.argv[2], z, sr)
    print(f'loop {n / sr:.3f}s, seam jump {seam_report(z, sr):+.2f} dB')

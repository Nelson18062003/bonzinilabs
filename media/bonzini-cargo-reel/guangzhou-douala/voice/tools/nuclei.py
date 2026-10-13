"""Syllable nuclei of a narrator take: peaks of the 300–2500 Hz energy (20 ms frames, smoothed 30 ms) that rise ≥ 4 dB
above the dips on both sides and lie within 30 dB of the loudest — one per spoken vowel (de Jong & Wempe style)."""
import numpy as np
from scipy.signal import butter, sosfiltfilt, find_peaks
def nuclei(y, sr, prom=4.0):
    b = sosfiltfilt(butter(4, [300, 2500], 'bandpass', fs=sr, output='sos'), y)
    h = int(.005 * sr); w = int(.02 * sr)
    e = np.array([np.mean(b[i:i + w] ** 2) for i in range(0, len(b) - w, h)]); db = 10 * np.log10(e + 1e-12)
    db = np.convolve(db, np.ones(6) / 6, 'same')
    pk, pr = find_peaks(db, prominence=prom, height=db.max() - 30, distance=int(.07 / .005))
    return (pk * h + w / 2) / sr
if __name__ == '__main__':
    import sys, soundfile as sf
    for p in sys.argv[1:]:
        y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y; n = nuclei(y, sr); print(f'{p.split("/")[-1]:16s} {len(n):2d} nuclei', np.round(n, 2))

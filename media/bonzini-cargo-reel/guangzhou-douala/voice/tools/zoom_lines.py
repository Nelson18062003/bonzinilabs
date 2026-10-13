"""Zoomed sheets of the final narrator files for marking words by eye: spectrogram 0–7 kHz, envelopes (broadband, F1 band
250–1200 Hz, > 3 kHz), 20-ms grid with labels every 0.1 s, current words.json marks (green = start, cyan = end).
usage: python3 zoom_lines.py OUT.png ID [ID …]"""
import sys, os, json
import numpy as np, soundfile as sf
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from scipy.signal import butter, sosfiltfilt
V = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
W = json.load(open(os.path.join(V, 'words.json'))) if os.path.exists(os.path.join(V, 'words.json')) else {}
out, ids = sys.argv[1], sys.argv[2:]
fig, ax = plt.subplots(2 * len(ids), 1, figsize=(26, 4.2 * len(ids)), gridspec_kw=dict(height_ratios=[2, 1.3] * len(ids)))
def env(y, sr, band, hop=.002, win=.012):
    b = sosfiltfilt(butter(4, band, 'bandpass' if isinstance(band, list) else 'hp', fs=sr, output='sos'), y)
    h, w = int(hop * sr), int(win * sr); c = np.cumsum(np.r_[0, b ** 2]); n = len(b); idx = np.arange(0, n, h)
    lo = np.clip(idx - w // 2, 0, n); hi = np.clip(idx + w // 2, 0, n)
    return idx / sr, 10 * np.log10((c[hi] - c[lo]) / np.maximum(hi - lo, 1) + 1e-12)
for n, lid in enumerate(ids):
    y, sr = sf.read(os.path.join(V, f'{lid}.wav')); y = y.mean(1) if y.ndim > 1 else y; T = len(y) / sr
    a, b = ax[2 * n], ax[2 * n + 1]
    a.specgram(y, NFFT=512, Fs=sr, noverlap=512 - 48, cmap='magma', vmin=-150); a.set_ylim(0, 7000); a.set_yticks([])
    for band, col in (([100, 8000], 'tab:blue'), ([250, 1200], 'tab:green'), (3000, 'tab:orange')):
        t, e = env(y, sr, band); b.plot(t, e, color=col, lw=.9)
    b.set_ylim(-75, 0)
    for q in (a, b):
        q.set_xlim(0, T); q.xaxis.set_major_locator(plt.MultipleLocator(.1)); q.xaxis.set_minor_locator(plt.MultipleLocator(.02))
        q.grid(which='major', alpha=.6, color='w' if q is a else 'k', lw=.6); q.grid(which='minor', alpha=.2, color='w' if q is a else 'k', lw=.4)
        q.tick_params(labelsize=8)
    for w in W.get(lid, []):
        for q in (a, b): q.axvline(w['s'], color='lime', lw=1.3); q.axvline(w['e'], color='cyan', lw=1, ls=':')
        a.text(w['s'] + .005, 6500, w['w'], color='lime', fontsize=11, va='top')
    a.set_title(lid, loc='left', fontsize=11)
fig.tight_layout(); fig.savefig(out, dpi=55); print(out)

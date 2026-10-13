"""Spectrogram + envelope of some narrator wavs with optional word marks (words.json), for checking by eye.
usage: python3 plot_lines.py OUT.png WAV [WAV …] [--words words.json]"""
import sys, os, json
import numpy as np, soundfile as sf
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
a = sys.argv[1:]; W = json.load(open(a[a.index('--words') + 1])) if '--words' in a else {}
if '--words' in a: i = a.index('--words'); a = a[:i] + a[i + 2:]
out, wavs = a[0], a[1:]
fig, ax = plt.subplots(len(wavs), 1, figsize=(14, 2.6 * len(wavs)), squeeze=False)
for n, p in enumerate(wavs):
    y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y; q = ax[n, 0]
    q.specgram(y, NFFT=1024, Fs=sr, noverlap=1024 - 96, cmap='magma', vmin=-140); q.set_ylim(0, 8000)
    h = int(.005 * sr); e = np.array([np.sqrt(np.mean(y[i:i + 2 * h] ** 2) + 1e-12) for i in range(0, len(y) - 2 * h, h)])
    t = np.arange(len(e)) * h / sr + h / sr; q2 = q.twinx(); q2.plot(t, 20 * np.log10(e), color='c', lw=.8); q2.set_ylim(-80, 0)
    lid = os.path.basename(p)[:-4]
    for w in W.get(lid, []):
        q.axvline(w['s'], color='lime', lw=1.2); q.axvline(w['e'], color='w', lw=.8, ls=':'); q.text(w['s'] + .005, 7300, w['w'], color='lime', fontsize=9)
    q.set_title(os.path.basename(p), fontsize=9, loc='left'); q.xaxis.set_major_locator(plt.MultipleLocator(.1)); q.tick_params(labelsize=7)
    q.grid(axis='x', alpha=.3)
fig.tight_layout(); fig.savefig(out, dpi=70); print(out)

"""Zoomed spectrogram of the vocals stem (1 ms hop, 10 ms grid) for phone-level marking by eye.
usage: python3 rv_zoom.py CLIP T0 T1 [NAME] [--marks real_words.json] -> voice/check/rvz_NAME.png"""
import sys, os, json
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.signal import butter, sosfiltfilt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import *
a = sys.argv[1:]
marks = json.load(open(a[a.index('--marks') + 1])) if '--marks' in a else None
if '--marks' in a: i = a.index('--marks'); a = a[:i] + a[i + 2:]
clip, t0, t1 = a[0], float(a[1]), float(a[2]); name = a[3] if len(a) > 3 else f'{clip}_{t0:.2f}'
y, sr = vocals(clip); z = y[int(t0 * sr):int(t1 * sr)]
t, eb, eh = envelopes(z, sr, hop=.001, win=.010); t = t + t0
lo = sosfiltfilt(butter(4, 400, 'lp', fs=sr, output='sos'), z)
_, el, _ = envelopes(lo, sr, hop=.001, win=.010)
W = max(14, (t1 - t0) * 22)
fig, ax = plt.subplots(2, 1, figsize=(W, 8), sharex=True, gridspec_kw=dict(height_ratios=[3, 2]))
ax[0].specgram(z, NFFT=512, Fs=sr, noverlap=512 - 44, xextent=(t0, t1), cmap='magma', vmin=-135)
ax[0].set_ylim(0, 9000)
ax[1].plot(t, eb, lw=.9, label='100–8k'); ax[1].plot(t, eh, lw=.9, label='>2.5k'); ax[1].plot(t, el[:len(t)], lw=.9, label='<400')
ax[1].legend(loc='lower right', fontsize=8); ax[1].set_ylim(eb.max() - 55, eb.max() + 3)
for q in ax:
    q.xaxis.set_major_locator(plt.MultipleLocator(.05)); q.xaxis.set_minor_locator(plt.MultipleLocator(.01))
    q.grid(which='major', alpha=.5, color='w' if q is ax[0] else 'k', lw=.6); q.grid(which='minor', alpha=.18, color='w' if q is ax[0] else 'k', lw=.4)
ax[1].tick_params(axis='x', labelsize=8, rotation=90)
for k, g in SEGS.items():
    if g['clip'] != clip: continue
    for x in (g['i'], g['o']):
        if t0 <= x <= t1:
            for q in ax: q.axvline(x, color='k' if q is ax[1] else 'w', lw=2)
    for m in MARKS4.get(k, []):
        if t0 <= m[2] <= t1:
            ax[1].axvline(m[2], color='red', lw=1, ls='--'); ax[1].text(m[2], eb.max() - 50, f"§4 {m[0]}{'↦' if m[1] == 'e' else ''}", color='red', fontsize=8, rotation=90)
    if marks and k in marks:
        for w in marks[k]['words']:
            s, e = g['i'] + w['s'], g['i'] + w['e']
            if t0 <= s <= t1:
                for q in ax: q.axvline(s, color='lime', lw=1.2)
                ax[0].text(s + .002, 8500, w['w'], color='lime', fontsize=10, va='top')
            if t0 <= e <= t1:
                for q in ax: q.axvline(e, color='cyan', lw=1, ls=':')
fig.suptitle(f'{clip} {t0:.2f}–{t1:.2f}  (vocals stem; 10 ms grid)')
fig.tight_layout(); OUT = os.path.join(R2, 'voice', 'check'); os.makedirs(OUT, exist_ok=True)
fig.savefig(os.path.join(OUT, f'rvz_{name}.png'), dpi=80); plt.close(fig); print(os.path.join(OUT, f'rvz_{name}.png'))

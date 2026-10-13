"""Spectrogram + envelopes of each real-voice segment with every set of marks, for checking by eye.
usage: python3 rv_plot.py [real_words.json] [--ids RV3,RV4] [--zoom WORD]   -> voice/check/rv_<id>.png"""
import sys, os, json
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import *
a = sys.argv[1:]
RW = json.load(open(a[0])) if a and a[0].endswith('.json') else None
ids = a[a.index('--ids') + 1].split(',') if '--ids' in a else list(SEGS)
OUT = os.path.join(R2, 'voice', 'check'); os.makedirs(OUT, exist_ok=True)
TR = json.load(open(os.path.join(WORK, 'transcripts.json')))
for k in ids:
    g = SEGS[k]; y, sr = vocals(g['clip'])
    t0, t1 = g['i'] - .35, g['o'] + .35
    z = y[int(t0 * sr):int(t1 * sr)]
    t, eb, eh = envelopes(z, sr); t = t + t0
    fig, ax = plt.subplots(3, 1, figsize=(max(12, (t1 - t0) * 5.5), 9), sharex=True, gridspec_kw=dict(height_ratios=[3, 2, 1]))
    ax[0].specgram(z, NFFT=1024, Fs=sr, noverlap=1024 - 128, xextent=(t0, t1), cmap='magma', vmin=-130)
    ax[0].set_ylim(0, 8000); ax[0].set_title(f"{k}  {g['clip']} {g['i']:.2f} → {g['o']:.2f}  « {g['text']} »")
    ax[1].plot(t, eb, lw=.8, label='100–8k dB'); ax[1].plot(t, eh, lw=.8, label='>2.5k dB'); ax[1].legend(loc='lower right', fontsize=7)
    ax[1].set_ylim(max(eb.min(), eb.max() - 60), eb.max() + 3); ax[1].grid(alpha=.3)
    ax[1].xaxis.set_major_locator(plt.MultipleLocator(.1)); ax[1].tick_params(axis='x', labelsize=6, rotation=90)
    for x in (g['i'], g['o']):
        for q in ax: q.axvline(x, color='k', lw=2)
    # transcripts.json words (gray, top row)
    for sg in TR[g['clip']]['segs']:
        for w in sg['words']:
            if t0 <= w['s'] <= t1:
                ax[2].axvspan(w['s'], w['e'], ymin=.70, ymax=.98, color='0.7', alpha=.6); ax[2].text(w['s'], .84, w['w'].strip(), fontsize=7, va='center')
    for x in [m[2] for m in MARKS4.get(k, [])]:
        for q in ax[:2]: q.axvline(x, color='red', lw=1, ls='--')
    for m in MARKS4.get(k, []): ax[2].text(m[2], .55, f"§4 {m[0]}{'↦' if m[1] == 'e' else ''}", color='red', fontsize=7, rotation=0, va='center')
    for m in MARKS81.get(k, []): ax[2].text(m[2], .38, f"§8 {m[0]}", color='purple', fontsize=7, va='center')
    if RW and k in RW:
        for w in RW[k]['words']:
            s, e = g['i'] + w['s'], g['i'] + w['e']
            ax[2].axvspan(s, e, ymin=.02, ymax=.28, color='tab:green', alpha=.5); ax[2].text(s, .15, w['w'], fontsize=7, va='center')
            for q in ax[:2]: q.axvline(s, color='lime', lw=.8); q.axvline(e, color='cyan', lw=.6, ls=':')
    ax[2].set_ylim(0, 1); ax[2].set_yticks([])
    fig.tight_layout(); fig.savefig(os.path.join(OUT, f'rv_{k}.png'), dpi=90); plt.close(fig)
    print('wrote', os.path.join(OUT, f'rv_{k}.png'))

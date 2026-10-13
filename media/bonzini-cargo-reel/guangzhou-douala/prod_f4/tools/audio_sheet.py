"""audio_sheet.py [AUDIO_DIR] [OUT.png] — momentary loudness (400 ms, hop 50 ms) of each stem and of the mix over the film,
with the score's voices, cues and music stops marked; + the mix's spectrogram (needs lib/mix.py --stems)."""
import sys, os, json, math, numpy as np, soundfile as sf
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'explainer', 'lib', 'audio')); import dsp
D = sys.argv[1] if len(sys.argv) > 1 else 'audio'; OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(D, 'audio_sheet.png')
sc = json.load(open(os.path.join(D, 'score_cues.json'))); SR = 48000
def mom(x, hop=.05):
    y = dsp.kweight(x); p = np.sum(y ** 2, 1); w = int(.4 * SR); h = int(hop * SR); c = np.concatenate([[0], np.cumsum(p)])
    idx = np.arange(0, len(p) - w, h); return (idx + w / 2) / SR, 10 * np.log10((c[idx + w] - c[idx]) / w + 1e-20) - .691
fig, ax = plt.subplots(2, 1, figsize=(26, 10), gridspec_kw=dict(height_ratios=[3, 2]))
cols = dict(voice='#e8e8e8', narr='#7fd3ff', amb='#7ccf6b', music='#f3a745', sfx='#fe560d')
for k, c in cols.items():
    x, _ = sf.read(os.path.join(D, 'stems', k + '.wav')); t, l = mom(x); ax[0].plot(t, np.maximum(l, -60), color=c, lw=1.4, label=k)
Z, _ = sf.read(os.path.join(D, 'mix.wav')); t, l = mom(Z); ax[0].plot(t, np.maximum(l, -60), color='#ff4fd8', lw=2, label='MIX')
for v in sc['voices']: ax[0].axvspan(v['speech'][0], v['speech'][1], color='#ffffff', alpha=.07)
for n in sc['narr']: ax[0].axvspan(n['t'], n['end'], color='#7fd3ff', alpha=.08)
for c in sc['cues']: ax[0].axvline(c['t'], color='#fe560d', alpha=.3, lw=.8); ax[0].text(c['t'], -58, c['name'], rotation=90, fontsize=7, color='#ffb38a')
for a, b in sc['music'].get('stops', []): ax[0].axvspan(a, b, color='#f3a745', alpha=.06, hatch='//')
ax[0].set_ylim(-60, -5); ax[0].set_xlim(0, sc['dur']); ax[0].legend(loc='upper right', ncol=6); ax[0].set_facecolor('#1b1b24'); ax[0].grid(alpha=.2)
ax[0].set_xticks(np.arange(0, sc['dur'], 1)); ax[0].set_title(f'{D}: momentary loudness per stem (post master) · white = real voice speech · blue = narrator · hatched = music stop')
f, tt_, S = __import__('scipy.signal', fromlist=['spectrogram']).spectrogram(Z.mean(1), SR, nperseg=2048, noverlap=1536)
ax[1].pcolormesh(tt_, f, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-120, vmax=-40); ax[1].set_ylim(0, 8000); ax[1].set_xlim(0, sc['dur'])
ax[1].set_xticks(np.arange(0, sc['dur'], 1))
plt.tight_layout(); plt.savefig(OUT, dpi=70); print(OUT)

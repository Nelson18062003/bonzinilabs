"""Which time-stretch sounds best on the narrator? (installed: ffmpeg rubberband filter (R2), ffmpeg atempo (WSOLA),
librosa phase vocoder; no rubberband CLI, no sox). Each method slows a few takes ×1.10; scored by
  - mcd: mel-cepstral distortion (dB, c1..c24) to the ORIGINAL after DTW alignment (timbre / phasiness damage, lower = better)
  - flux: onset sharpness kept = mean spectral-flux peak height at the original's onsets relative to the original (1 = kept)
  - asr: mean word probability of faster-whisper large-v3 (clean)
  - len: output / (input × 1.10) (must be 1.000)
and a spectrogram sheet voice/check/stretch_lab.png to look at.  usage: python3 stretch_lab.py TAKE.wav [TAKE.wav …]"""
import sys, os, subprocess, tempfile, json
import numpy as np, soundfile as sf, soxr, librosa
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from faster_whisper import WhisperModel
from scipy.signal import resample_poly
V = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ST = 1.10; SR = 48000
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from narr_eval_lib import METHODS
def run(y, m):
    if m == 'librosa': return librosa.effects.time_stretch(y.astype(np.float32), rate=1 / ST)
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav'); sf.write(src, y.astype(np.float32), SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', METHODS[m].format(t=1 / ST), '-c:a', 'pcm_f32le', dst], check=True)
        z, _ = sf.read(dst); return z if z.ndim == 1 else z.mean(1)
def mfcc(y): return librosa.feature.mfcc(y=y.astype(np.float32), sr=SR, n_mfcc=25, n_fft=1024, hop_length=240)[1:]
def mcd(a, b):
    """mean euclidean MFCC distance (c1..c24) along the DTW path — a relative scale"""
    A, B = mfcc(a), mfcc(b); D, wp = librosa.sequence.dtw(A, B, metric='euclidean')
    return float(np.mean([np.sqrt(np.sum((A[:, i] - B[:, j]) ** 2)) for i, j in wp]))
def flux_peaks(y, onsets_s, scale=1.0):
    S = np.abs(librosa.stft(y.astype(np.float32), n_fft=1024, hop_length=240)); f = np.maximum(0, np.diff(np.log1p(S), axis=1)).sum(0)
    t = np.arange(len(f)) * 240 / SR; return np.array([f[(t > o * scale - .03) & (t < o * scale + .03)].max() if np.any((t > o * scale - .03) & (t < o * scale + .03)) else 0 for o in onsets_s])
M = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
def asr_p(y):
    z = resample_poly(y, 1, 3).astype(np.float32); z = z / (np.abs(z).max() + 1e-9) * .9
    segs, _ = M.transcribe(z, language='fr', word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    ws = [w for s in segs for w in s.words]; return float(np.mean([w.probability for w in ws])) if ws else 0, ' '.join(w.word.strip() for w in ws)
res = {}; sheet = []
for p in sys.argv[1:]:
    y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y; y = soxr.resample(y, sr, SR, quality='VHQ')
    on = librosa.onset.onset_detect(y=y.astype(np.float32), sr=SR, hop_length=240, units='time')
    f0 = flux_peaks(y, on); p0, h0 = asr_p(y)
    row = dict(orig=dict(asr=round(p0, 3), heard=h0)); outs = {'orig': y}
    for m in METHODS:
        z = run(y, m); outs[m] = z
        fl = flux_peaks(z, on, ST); pr, hh = asr_p(z)
        row[m] = dict(mcd=round(mcd(y, z), 2), flux=round(float(np.mean(fl / (f0 + 1e-9))), 3), asr=round(pr, 3), len=round(len(z) / (len(y) * ST), 4), heard=hh)
        print(os.path.basename(p), m, row[m], flush=True)
    res[os.path.basename(p)] = row; sheet.append((os.path.basename(p), outs))
json.dump(res, open(os.path.join(V, 'work', 'stretch_lab.json'), 'w'), ensure_ascii=False, indent=1)
n = len(METHODS) + 1
fig, ax = plt.subplots(len(sheet), n, figsize=(4 * n, 3 * len(sheet)), squeeze=False)
for r, (name, outs) in enumerate(sheet):
    for c, (m, z) in enumerate(outs.items()):
        ax[r, c].specgram(z, NFFT=1024, Fs=SR, noverlap=1024 - 120, cmap='magma', vmin=-140); ax[r, c].set_ylim(0, 6000)
        ax[r, c].set_title(f'{name} {m}', fontsize=8); ax[r, c].tick_params(labelsize=6)
fig.tight_layout(); fig.savefig(os.path.join(V, 'check', 'stretch_lab.png'), dpi=70); print('sheet', os.path.join(V, 'check', 'stretch_lab.png'))

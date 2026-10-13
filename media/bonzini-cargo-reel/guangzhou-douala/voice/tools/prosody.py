"""Naturalness of a narrator take, from the signal: syllables (vowel nuclei, nuclei.py) cut at the dips of the F1-band
(250–1200 Hz) envelope or at pauses; pauses = ≥ 100 ms more than 35 dB under the line's peak.
prosody(y, sr, on, off) -> dict(max_syl (longest non-final syllable, s), last_syl (s), syl_lens, pauses [(a, b)], nuclei)
A drawl (« Uuun autre… », « Eeet elle… ») is one syllable held 0.5–0.8 s; a broken word (« co … lis ») is a pause where
the text has no break."""
import numpy as np
from scipy.signal import butter, sosfiltfilt
from nuclei import nuclei
def _env(y, sr, band, hop=.002, win=.016):
    b = sosfiltfilt(butter(4, band, 'bandpass', fs=sr, output='sos'), y)
    h, w = int(hop * sr), int(win * sr); c = np.cumsum(np.r_[0, b ** 2]); n = len(b); idx = np.arange(0, n, h)
    lo = np.clip(idx - w // 2, 0, n); hi = np.clip(idx + w // 2, 0, n)
    return idx / sr, 10 * np.log10((c[hi] - c[lo]) / np.maximum(hi - lo, 1) + 1e-12)
def pauses_of(y, sr, on, off, min_len=.10):
    t, e = _env(y, sr, [100, 8000]); e = np.convolve(e, np.ones(5) / 5, 'same'); pk = e[(t >= on) & (t <= off)].max()
    sil = e < pk - 35; out = []; k = np.searchsorted(t, on); j = np.searchsorted(t, off)
    while k < j:
        if sil[k]:
            k2 = k
            while k2 < j and sil[k2]: k2 += 1
            if (k2 - k) * .002 >= min_len: out.append((float(t[k]), float(t[k2 - 1])))
            k = k2
        else: k += 1
    return out
def prosody(y, sr, on, off):
    nu = [x for x in nuclei(y, sr) if on - .02 <= x <= off + .02]
    t, f1 = _env(y, sr, [250, 1200]); f1 = np.convolve(f1, np.ones(4) / 4, 'same')
    ps = pauses_of(y, sr, on, off)
    edges = []
    for a, b in zip(nu, nu[1:]):
        pz = [p for p in ps if a < p[0] and p[1] < b]
        if pz: edges.append((pz[0][0], pz[-1][1]))
        else:
            ia, ib = np.searchsorted(t, a), np.searchsorted(t, b); m = ia + int(np.argmin(f1[ia:ib])); edges.append((t[m], t[m]))
    lens = []
    for i in range(len(nu)):
        L = on if i == 0 else edges[i - 1][1]; R = off if i == len(nu) - 1 else edges[i][0]
        # a syllable after / before a pause starts / ends at the pause edge; the first / last at the speech span
        lens.append(float(R - L))
    pre = [i < len(nu) - 1 and edges[i][1] - edges[i][0] > .05 for i in range(len(nu))]      # followed by a pause
    inner = [L for i, L in enumerate(lens[:-1]) if not pre[i]]
    return dict(nuclei=nu, syl_lens=[round(x, 3) for x in lens], max_inner=max(inner) if inner else 0, max_any=max(lens) if lens else 0, max_syl=max(lens[:-1]) if len(lens) > 1 else (lens[0] if lens else 0),
                last_syl=lens[-1] if lens else 0, pauses=ps, f1=(t, f1))

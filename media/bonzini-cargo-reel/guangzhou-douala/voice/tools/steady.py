"""Drawl detector: the longest stretch of 'steady' loud voicing (log-mel frame-to-frame change below a threshold,
energy within 25 dB of the peak), in seconds, and where it is. A natural vowel of this narrator lasts 0.08–0.25 s;
the clear-diction setting sometimes holds a short word for 0.4–0.6 s (« Iiils filment… », « Eeet leees… »)."""
import numpy as np, librosa
def steady(y, sr, thr=0.9):
    S = librosa.power_to_db(librosa.feature.melspectrogram(y=y.astype(np.float32), sr=sr, n_fft=1024, hop_length=int(.01 * sr), n_mels=40), ref=np.max)
    e = S.max(0); loud = e > -25
    d = np.r_[0, np.sqrt(np.mean(np.diff(S, axis=1) ** 2, axis=0))]
    st = loud & (d < thr * np.median(d[loud])) if loud.any() else loud
    best, cur, end = 0, 0, 0
    for i, v in enumerate(st):
        cur = cur + 1 if v else 0
        if cur > best: best, end = cur, i
    return best * .01, (end - best + 1) * .01
if __name__ == '__main__':
    import sys, soundfile as sf
    for p in sys.argv[1:]:
        y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y; d, t = steady(y, sr); print(f'{p.split("/")[-1]:20s} steady {d:.2f}s at {t:.2f}')

"""Word times of a narrator line (clean TTS speech) without a phone aligner.
Vowel nuclei (peaks of the F1-band 250–1200 Hz envelope) are shared out among the written words by dynamic programming:
each word wants its spoken-syllable count (SYLW range; ±1 allowed at a cost, the nucleus picker is not exact), a pause must
not fall inside a word, a pause where the text has a break (, : ? !) should be between those two words, and each word's
nuclei should sit near the faster-whisper large-v3 word midpoint (weak weight: its times drift by 0.1–0.5 s).
Boundary = the pause edges between the two words, else the F1-band dip between their nuclei, walked back to where the dip
starts (the consonant's onset), so a word lights up on its first consonant.
align(y, sr, text, on, off, asr_words) -> ([{w, s, e}], info)   (seconds in y)"""
import re
import numpy as np
from scipy.signal import butter, sosfiltfilt, find_peaks
SYLW = {'là-bas': (2, 2), 'en': (1, 1), 'chine': (1, 1), 'on': (1, 1), 'charge': (1, 1), 'ici': (2, 2), 'à': (1, 1),
        'douala': (2, 3), 'reçoit': (2, 2), 'un': (1, 1), 'conteneur': (2, 3), 'part': (1, 1), 'autre': (1, 2), 'arrive': (2, 2),
        'une': (1, 1), 'voiture': (2, 2), 'tes': (1, 1), 'colis': (2, 2), 'sont': (1, 1), 'écris': (2, 2), 'réponds': (2, 2),
        'ils': (1, 1), 'filment': (1, 2), 'quoi': (1, 1), 'sort': (1, 1), 'du': (1, 1), 'et': (1, 1), 'les': (1, 1),
        'téléphones': (3, 3), 'sortent': (1, 2), 'aussi': (2, 2), 'faire': (1, 1), 'venir': (2, 2), 'machine': (2, 2),
        'elle': (1, 1), 'va': (1, 1), 'où': (1, 1), 'cette': (1, 1), 'grue': (1, 1), 'la': (1, 1), 'soulève': (2, 2),
        'passe': (1, 1), 'au-dessus': (3, 3), 'de': (1, 1), 'rue': (1, 1), 'devant': (2, 2), 'boutique': (2, 2), 'entre': (1, 1)}
def key(w): return re.sub(r'[^a-zàâçéèêëîïôûùüœ-]', '', w.lower())
def written_words(text):
    out = []
    for t in text.split():
        if out and not any(ch.isalnum() for ch in t): out[-1] += ' ' + t
        else: out.append(t)
    return out
def env(y, sr, band, hop=.002, win=.016):
    b = sosfiltfilt(butter(4, band, 'bandpass', fs=sr, output='sos'), y)
    h, w = int(hop * sr), int(win * sr); c = np.cumsum(np.r_[0, b ** 2]); n = len(b); idx = np.arange(0, n, h)
    lo = np.clip(idx - w // 2, 0, n); hi = np.clip(idx + w // 2, 0, n)
    return idx / sr, 10 * np.log10((c[hi] - c[lo]) / np.maximum(hi - lo, 1) + 1e-12)
def align(y, sr, text, on, off, asr_words=()):
    ww = written_words(text); M = len(ww)
    rng = [SYLW.get(key(w.split()[0]), (1, 3)) for w in ww]
    brk = [bool(re.search(r'[,:;?!.]', w)) for w in ww]                     # a break after word m
    t, eb = env(y, sr, [100, 8000]); eb = np.convolve(eb, np.ones(5) / 5, 'same')
    _, f1 = env(y, sr, [250, 1200]); f1 = np.convolve(f1, np.ones(6) / 6, 'same')
    inside = (t >= on) & (t <= off); pk = eb[inside].max()
    sil = eb < pk - 35; pauses = []; k = np.searchsorted(t, on); j = np.searchsorted(t, off)
    while k < j:                                                             # pauses ≥ 70 ms, 35 dB under the peak
        if sil[k]:
            k2 = k
            while k2 < j and sil[k2]: k2 += 1
            if (k2 - k) * .002 >= .07: pauses.append((float(t[k]), float(t[k2 - 1])))
            k = k2
        else: k += 1
    i0, i1 = np.searchsorted(t, on), np.searchsorted(t, off)                 # nuclei: F1-band peaks
    pkx, _ = find_peaks(f1[i0:i1], prominence=5, height=f1[i0:i1].max() - 25, distance=45)
    nu = [float(t[i0 + p]) for p in pkx]; K = len(nu)
    amid = {}
    if asr_words:
        A = [key(a['w']) for a in asr_words]
        for m, w in enumerate(ww):
            kw = key(w.split()[0])
            for q, a in enumerate(A):
                if a and (a == kw or (len(a) > 2 and (a.strip('-') in kw or kw in a))): amid[m] = (asr_words[q]['s'] + asr_words[q]['e']) / 2; A[q] = None; break
    def between(a, b): return [p for p in pauses if a < p[0] and p[1] < b]
    INF = 1e9
    D = np.full((M + 1, K + 1), INF); B = np.zeros((M + 1, K + 1), int); D[0][0] = 0   # words 0..m-1 on nuclei 0..k-1
    for m in range(M):
        lo, hi = rng[m]
        for k in range(K + 1):
            if D[m][k] >= INF: continue
            for c in range(0, min(K - k, hi + 2) + 1):
                if m == M - 1 and k + c != K: continue
                cost = 0 if lo <= c <= hi else (3.0 if c == 0 else 1.0 * (lo - c if c < lo else c - hi))
                g = nu[k:k + c]
                cost += 4.0 * sum(len(between(a, b)) for a, b in zip(g, g[1:]))   # a pause inside the word
                if c and m in amid: cost += .8 * abs(np.mean(g) - amid[m])
                if c and m < M - 1 and k + c < K:                                # the break after this word
                    has_p = bool(between(g[-1], nu[k + c]))
                    if brk[m] and not has_p and pauses: cost += .5
                    if has_p and not brk[m]: cost += .3
                if D[m][k] + cost < D[m + 1][k + c]: D[m + 1][k + c] = D[m][k] + cost; B[m + 1][k + c] = c
    counts = []; k = K
    for m in range(M, 0, -1): c = B[m][k]; counts.append(c); k -= c
    counts = counts[::-1]; idx = np.cumsum([0] + counts)
    bounds = []
    for m in range(M - 1):
        a = nu[idx[m + 1] - 1] if counts[m] else (bounds[-1][1] if bounds else on)
        b = nu[idx[m + 1]] if idx[m + 1] < K else off
        pz = between(a, b)
        if pz: bounds.append((pz[0][0], pz[-1][1])); continue
        ia, ib = np.searchsorted(t, a), np.searchsorted(t, b)
        if ib - ia < 3: bounds.append((float(t[ia]), float(t[ia]))); continue
        mm = ia + int(np.argmin(f1[ia:ib])); v = f1[mm]
        while mm > ia and f1[mm - 1] < v + 6: mm -= 1
        bounds.append((float(t[mm]), float(t[mm])))
    out = []
    for m, w in enumerate(ww):
        s = on if m == 0 else bounds[m - 1][1]; e = off if m == M - 1 else bounds[m][0]
        out.append(dict(w=w, s=round(float(s), 3), e=round(float(max(e, s + .03)), 3)))
    return out, dict(method='nuclei-dp', nuclei=K, counts=[int(c) for c in counts], cost=round(float(D[M][K]), 2),
                     pauses=[(round(a, 3), round(b, 3)) for a, b in pauses])

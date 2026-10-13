"""Shared pieces of the narrator tools: robust speech span, the series' sound-based word normaliser, stretch methods."""
import os, re, unicodedata
import numpy as np
from scipy.signal import butter, sosfiltfilt
V = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
_vs = open(os.path.join(V, '..', '..', 'serie', 'voice_score.py')).read(); _ns = dict(re=re, unicodedata=unicodedata)
exec(_vs[_vs.index('_U = '):_vs.index('def syl(')], _ns)
# exact homophones met here (sound, not spelling): « écrit » = « écris », « colie » = « colis », « il filme » = « ils filment »
_ns['HOMO'].update({'colie': 'coli', 'collie': 'coli', 'colli': 'coli', 'ecri': 'ecris', 'filment': 'filme', 'ils': 'il',
                    'reponds': 'repond', 'repons': 'repond', 'par': 'part'})          # « part » [paʁ] = « par »
toks = lambda t: _ns['canon'](_ns['toks'](t))

def span(y, sr):
    """speech on/off (serie/select_takes.py): 4 %-of-peak core, extended through contiguous weak edges (1.2 % broadband,
    1.5 % of the > 2 kHz envelope for fricatives), at most 150 ms before / 300 ms after"""
    fr = int(.01 * sr); env = lambda z: np.sqrt(np.convolve(z ** 2, np.ones(fr) / fr, 'same'))
    e = env(y); eh = env(sosfiltfilt(butter(4, 2000, 'hp', fs=sr, output='sos'), y))
    i0 = np.flatnonzero(e > max(e.max() * .04, 1e-4))
    if not len(i0): return 0, len(y) / sr
    i1 = np.flatnonzero(e > max(e.max() * .012, np.percentile(e, 20) * 4, 1e-5))
    i2 = np.flatnonzero(eh > max(eh.max() * .015, np.percentile(eh, 20) * 4, 1e-5))
    lo = np.concatenate([i1, i2]); a0, b0 = i0[0], i0[-1]; S = set(lo.tolist())
    def run(start, step):
        pos = start
        while (pos + step * fr // 2) in S or any((pos + step * k) in S for k in range(1, fr)): pos += step * fr // 2
        return pos
    aa = run(a0, -1) if any((lo < a0) & (lo >= a0 - int(.15 * sr))) else a0
    bb = run(b0, 1) if any((lo > b0) & (lo <= b0 + int(.30 * sr))) else b0
    return max(aa, a0 - int(.15 * sr)) / sr, min(bb, b0 + int(.30 * sr)) / sr

RB = 'rubberband=tempo={t:.6f}:pitch=1:pitchq=quality:formant=preserved:{x}'
METHODS = {
    'rb_crisp':  RB.replace('{x}', 'transients=crisp:detector=compound:window=standard'),
    'rb_mixed':  RB.replace('{x}', 'transients=mixed:detector=compound:window=standard'),
    'rb_smooth': RB.replace('{x}', 'transients=smooth:detector=soft:window=standard:smoothing=on'),
    'rb_short':  RB.replace('{x}', 'transients=crisp:detector=compound:window=short'),
    'atempo':    'atempo={t:.6f}',
    'librosa':   None,
}

def heard_tokens(ref, hyp):
    """hypothesis tokens with elided pieces re-joined when the join is a reference word: « D'Ouala » → « douala »
    (same sound [dwala]), « Là » « -bas » → « labas »; ref / hyp = token lists from toks()"""
    R = set(ref); out = []; i = 0
    while i < len(hyp):
        for n in (3, 2):
            j = ''.join(hyp[i:i + n])
            if len(hyp[i:i + n]) == n and j in R and hyp[i] not in R: out.append(j); i += n; break
        else: out.append(hyp[i]); i += 1
    return out

def share(ref_text, hyp_text):
    import difflib
    ref = toks(ref_text); hyp = heard_tokens(ref, toks(hyp_text))
    return sum(b.size for b in difflib.SequenceMatcher(None, ref, hyp).get_matching_blocks()) / max(1, len(ref)), hyp

"""Score TTS takes for INTELLIGIBILITY (not by ear — by a deliberately weak listener):
faster-whisper 'small' (no context, beam 1) on (a) the take through a phone-speaker band-pass and (b) the same with the
series' music bed underneath at 10 dB SNR. Score = share of the reference words recognised (numbers normalised to words).
Also: speaking rate (syllables / s of speech).  usage: python3 voice_score.py REF.json WAV... [--out scores.json]
REF.json = {"<key>": "reference text"}; a wav's key = the part of its name before the first '_s' or as mapped by --key."""
import sys, os, re, json, unicodedata, difflib
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly
from faster_whisper import WhisperModel
_U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize']
def fr_num(n):
    if n < 17: return _U[n]
    if n < 20: return 'dix-' + _U[n - 10]
    if n < 100:
        d, u = divmod(n, 10); base = {2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante', 7: 'soixante', 8: 'quatre-vingt', 9: 'quatre-vingt'}[d]
        if d in (7, 9): return base + '-' + fr_num(10 + u)
        return base + ('' if u == 0 else '-' + _U[u])
    if n < 1000: c, r = divmod(n, 100); return ('cent' if c == 1 else _U[c] + ' cent') + ('' if r == 0 else ' ' + fr_num(r))
    k, r = divmod(n, 1000); return ('mille' if k == 1 else fr_num(k) + ' mille') + ('' if r == 0 else ' ' + fr_num(r))
def toks(s):
    s = re.sub(r'(\d)[\s  .](\d{3})\b', r'\1\2', s)
    s = re.sub(r'\d+', lambda m: ' ' + fr_num(int(m.group())) + ' ', s)
    s = unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()
    return [w for w in re.split(r"[^a-z]+", s.replace('-', ' ')) if w]
HOMO = {'pere': 'paire', 'peres': 'paires', 'mettre': 'metre', 'x': 'fois', 'demandent': 'demande', 'ecrit': 'ecris', 'cartou': 'carton'}
def canon(ws):
    """compare SOUNDS, not spellings: exact French homophones in context, silent plural -s / -e (payé = payée, cube = cubes)"""
    out = []
    for w in ws:
        w = HOMO.get(w, w)
        if len(w) > 3 and w[-1] in 'sx': w = w[:-1]
        while len(w) > 2 and w.endswith('e') and w[-2] in 'aeiouy': w = w[:-1]
        if len(w) > 2 and w.endswith('y'): w = w[:-1] + 'i'          # paie = paye = payé = payée
        out.append(w)
    return out
def syl(t):
    n = 0
    for w in toks(t): w = w[:-1] if len(w) > 3 and w.endswith('e') else w; n += max(1, len(re.findall(r'[aeiouy]+', w)))
    return n
args = sys.argv[1:]; out = args[args.index('--out') + 1] if '--out' in args else None
if out: i = args.index('--out'); args = args[:i] + args[i + 2:]
REF = json.load(open(args[0])); wavs = args[1:]
BED = os.environ.get('BED')    # a music wav for the noisy condition
bed = None
if BED and os.path.exists(BED):
    b, bsr = sf.read(BED); b = b.mean(1) if b.ndim > 1 else b; bed = resample_poly(b, 1, 3) if bsr == 48000 else b
M = WhisperModel('small', device='cpu', compute_type='int8', cpu_threads=4)
sos = butter(4, [300, 7000], 'bandpass', fs=16000, output='sos')
def hear(y16):
    segs, _ = M.transcribe(y16.astype(np.float32), language='fr', beam_size=1, condition_on_previous_text=False, vad_filter=False)
    return ' '.join(s.text for s in segs)
res = {}
for p in wavs:
    name = os.path.basename(p)[:-4]; key = next((k for k in sorted(REF, key=len, reverse=True) if f'_{k}_' in f'_{name}_' or name.startswith(k + '_') or name == k), None)
    if key is None: continue
    y, sr = sf.read(p); y = y.mean(1) if y.ndim > 1 else y; g = np.gcd(sr, 16000); y = resample_poly(y, 16000 // g, sr // g)
    fr = 160; e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); idx = np.where(e > max(e.max() * .04, 1e-4))[0]
    sp = (idx[-1] - idx[0]) / 16000 if len(idx) else 1
    yb = sosfiltfilt(sos, y); yb = yb / (np.abs(yb).max() + 1e-9) * .8
    ref = canon(toks(REF[key])); score = {}
    for cond in ('clean', 'music'):
        z = yb.copy()
        if cond == 'music':
            if bed is None: continue
            bb = np.resize(bed[16000 * 3:], len(z)); bb = sosfiltfilt(sos, bb)
            vr = np.sqrt(np.mean(z[idx[0]:idx[-1]] ** 2)) if len(idx) else np.sqrt(np.mean(z ** 2)); br = np.sqrt(np.mean(bb ** 2)) + 1e-9
            z = z + bb * (vr / br) * 10 ** (-10 / 20)
        h = canon(toks(hear(z))); sm = difflib.SequenceMatcher(None, ref, h); ok = sum(bl.size for bl in sm.get_matching_blocks())
        score[cond] = round(ok / max(1, len(ref)), 3); score[cond + '_heard'] = ' '.join(h)
    res[name] = dict(key=key, rate=round(syl(REF[key]) / max(sp, .1), 2), speech=round(sp, 2), **score)
    print(f"{name:28s} clean {score.get('clean', 0) * 100:5.0f}%  music {score.get('music', 0) * 100:5.0f}%  {res[name]['rate']:4.1f} syl/s  « {score.get('music_heard', score.get('clean_heard'))} »", flush=True)
if out: json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)

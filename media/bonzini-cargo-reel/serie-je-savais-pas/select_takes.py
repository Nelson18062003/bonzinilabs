"""Pick, for every voice line, the take a listener understands best (weak ASR, phone band, music bed at 10 dB SNR).
usage: BED=music.wav python3 select_takes.py EP_DIR [--min 0.9] [--script data/script_v2.json]
       python3 select_takes.py EP_DIR --respan   (only recompute on/off/dur of the takes already in takes.json)
Writes E/data/take_scores.json (every take) and E/data/takes.json {id: {file, on, off, dur, music, clean, rate}}.
Rank = music + 0.3·clean − 0.15·(rate above 4.0 syl/s) − 0.15·(rate below 3.0) − 0.35 per key word missed (E/data/must.json
{id: ["word or phrase|variant", …]}, matched on the music AND the clean transcripts, token prefixes); prints the weak lines."""
import sys, os, json, glob, re, subprocess, tempfile
import numpy as np, soundfile as sf
H = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]; E = os.path.abspath(a[0])
MIN = float(a[a.index('--min') + 1]) if '--min' in a else .9
SCRIPT = os.path.join(E, a[a.index('--script') + 1]) if '--script' in a else os.path.join(E, 'data', 'script_v2.json')
segs = json.load(open(SCRIPT))['segments']
RESPAN = '--respan' in a
said = lambda s: re.sub(r'<break[^>]*>', ' ', s.get('tts', s['text'])).replace('…', ',')
ref = {s['id']: said(s) for s in segs}
wavs = sorted(glob.glob(os.path.join(E, 'audio', 'vo', '*_s*.wav')))
wavs = [w for w in wavs if os.path.basename(w).rsplit('_s', 1)[0] in ref]
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f: json.dump(ref, f, ensure_ascii=False); rp = f.name
sc_path = os.path.join(E, 'data', 'take_scores.json')
if not RESPAN: subprocess.run([sys.executable, os.path.join(H, 'voice_score.py'), rp, *wavs, '--out', sc_path], check=True)
sc = json.load(open(sc_path))
def span(p):
    """speech on/off of a take. A plain 4 %-of-peak gate misses weak edges (the « ch » of « fiche », a final « s »,
    a voiced decay): the mixer trims the take there, so the word lost its end. Edges are therefore taken from the
    broadband envelope at 1.2 % of peak AND the > 2 kHz envelope at 1.5 % of its peak (fricatives), above the noise floor."""
    from scipy.signal import butter, sosfiltfilt
    y, sr = sf.read(p); y = y if y.ndim == 1 else y.mean(1)
    fr = int(.01 * sr); env = lambda z: np.sqrt(np.convolve(z ** 2, np.ones(fr) / fr, 'same'))
    e = env(y); eh = env(sosfiltfilt(butter(4, 2000, 'hp', fs=sr, output='sos'), y))
    i0 = np.flatnonzero(e > max(e.max() * .04, 1e-4))                         # the core of the speech (old gate)
    if not len(i0): return (0, len(y) / sr)
    i1 = np.flatnonzero(e > max(e.max() * .012, np.percentile(e, 20) * 4, 1e-5))
    i2 = np.flatnonzero(eh > max(eh.max() * .015, np.percentile(eh, 20) * 4, 1e-5))
    lo = np.concatenate([i1, i2]); a0, b0 = i0[0], i0[-1]
    a = lo[(lo < a0) & (lo >= a0 - int(.15 * sr))]; b = lo[(lo > b0) & (lo <= b0 + int(.30 * sr))]
    # extend only through CONTIGUOUS weak signal (a soft onset / a trailing fricative), never to a separate noise
    def run(idx, start, step):
        pos = start; S = set(idx.tolist())
        while (pos + step * fr // 2) in S or any((pos + step * k) in S for k in range(1, fr)): pos += step * fr // 2
        return pos
    a = run(lo, a0, -1) if len(a) else a0; b = run(lo, b0, 1) if len(b) else b0
    a = max(a, a0 - int(.15 * sr)); b = min(b, b0 + int(.30 * sr))
    return a / sr, b / sr
sys.path.insert(0, H)
MUST = json.load(open(os.path.join(E, 'data', 'must.json'))) if os.path.exists(os.path.join(E, 'data', 'must.json')) else {}
_vs = open(os.path.join(H, 'voice_score.py')).read(); _ns = {}
_ns.update(re=re, unicodedata=__import__('unicodedata')); exec(_vs[_vs.index('_U = '):_vs.index('def syl(')], _ns)   # the scorer's own normaliser
toks = lambda t: _ns['canon'](_ns['toks'](t))
def found(phrase, heard):
    h = heard.split()
    for alt in phrase.split('|'):
        p = toks(alt)
        if any(all(h[i + j].startswith(p[j]) for j in range(len(p))) for i in range(len(h) - len(p) + 1)): return True
    return False
def missed(k, r):
    sid = k.rsplit('_s', 1)[0]
    return [ph for ph in MUST.get(sid, []) for c in ('music', 'clean') if c + '_heard' in r and not found(ph, r[c + '_heard'])]
def rank(r, k=''): return r.get('music', 0) + .3 * r.get('clean', 0) - .15 * max(0, r['rate'] - 4.0) - .15 * max(0, 3.0 - r['rate']) - .35 * len(missed(k, r))
takes, weak = {}, []
if RESPAN:
    t = json.load(open(os.path.join(E, 'data', 'takes.json')))
    for i, tk in t.items():
        on, off = span(os.path.join(E, 'audio', 'vo', tk['file'])); print(f"{i:5s} {tk['file']:11s} on {tk['on']:.3f}→{on:.3f}  off {tk['off']:.3f}→{off:.3f}")
        tk.update(on=round(on, 3), off=round(off, 3), dur=round(off - on, 3))
    json.dump(t, open(os.path.join(E, 'data', 'takes.json'), 'w'), indent=1); sys.exit(0)
for s in segs:
    cand = {k: v for k, v in sc.items() if k.rsplit('_s', 1)[0] == s['id']}
    if not cand: print('NO TAKE', s['id']); continue
    k = max(cand, key=lambda k: rank(cand[k], k)); r = cand[k]; miss = sorted(set(missed(k, r))); on, off = span(os.path.join(E, 'audio', 'vo', k + '.wav'))
    takes[s['id']] = dict(file=k + '.wav', on=round(on, 3), off=round(off, 3), dur=round(off - on, 3), music=r.get('music'), clean=r.get('clean'), rate=r['rate'])
    flag = ('  <-- WEAK' if r.get('music', 0) < MIN or miss else '') + (f'  missed {miss}' if miss else '')
    if flag: weak.append(s['id'])
    print(f"{s['id']:5s} {k:10s} music {r.get('music', 0) * 100:4.0f}%  clean {r.get('clean', 0) * 100:4.0f}%  {r['rate']:.1f} syl/s  {off - on:.2f}s  ({len(cand)} takes){flag}")
json.dump(takes, open(os.path.join(E, 'data', 'takes.json'), 'w'), indent=1)
print('WEAK:', ','.join(weak) if weak else 'none')

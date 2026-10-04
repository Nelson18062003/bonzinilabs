"""Pick, for every voice line, the take a listener understands best (weak ASR, phone band, music bed at 10 dB SNR).
usage: BED=music.wav python3 select_takes.py EP_DIR [--min 0.9] [--script data/script_v2.json]
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
said = lambda s: re.sub(r'<break[^>]*>', ' ', s.get('tts', s['text'])).replace('…', ',')
ref = {s['id']: said(s) for s in segs}
wavs = sorted(glob.glob(os.path.join(E, 'audio', 'vo', '*_s*.wav')))
wavs = [w for w in wavs if os.path.basename(w).rsplit('_s', 1)[0] in ref]
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f: json.dump(ref, f, ensure_ascii=False); rp = f.name
sc_path = os.path.join(E, 'data', 'take_scores.json')
subprocess.run([sys.executable, os.path.join(H, 'voice_score.py'), rp, *wavs, '--out', sc_path], check=True)
sc = json.load(open(sc_path))
def span(p):
    y, sr = sf.read(p); y = y if y.ndim == 1 else y.mean(1)
    fr = int(.01 * sr); e = np.sqrt(np.convolve(y ** 2, np.ones(fr) / fr, 'same')); idx = np.flatnonzero(e > max(e.max() * .04, 1e-4))
    return (idx[0] / sr, idx[-1] / sr) if len(idx) else (0, len(y) / sr)
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

"""Score TTS takes without listening: ASR match (faster-whisper large-v3), speech span, pitch median & expressiveness.
usage: python3 vocheck.py SCRIPT.json [ids...]  -> prints one line per take, writes data/vocheck.json"""
import sys, os, json, glob, difflib, re, unicodedata
import numpy as np, soundfile as sf, librosa
from faster_whisper import WhisperModel
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
script = {s['id']: s for s in json.load(open(sys.argv[1]))['segments']}
want = set(sys.argv[2:]) or set(script)
norm = lambda w: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode())
M = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
out = {}
for p in sorted(glob.glob(os.path.join(F, 'audio', 'vo', '*_s*.wav'))):
    sid = os.path.basename(p).split('_')[0]
    if sid not in want: continue
    segs, _ = M.transcribe(p, language='fr', word_timestamps=True, beam_size=5)
    ws = [w for s in segs for w in s.words]
    hyp = ' '.join(w.word.strip() for w in ws)
    a = [norm(x) for x in script[sid]['text'].split() if norm(x)]; b = [norm(x) for x in hyp.split() if norm(x)]
    r = difflib.SequenceMatcher(None, a, b).ratio()
    y, sr = sf.read(p); y = y if y.ndim == 1 else y.mean(1)
    f0, v, _ = librosa.pyin(y.astype(np.float32), fmin=60, fmax=450, sr=sr, frame_length=2048)
    fv = f0[v] if np.any(v) else np.array([1.0])
    semi = 12 * np.log2(fv / np.median(fv))
    span = (ws[0].start, ws[-1].end) if ws else (0, 0)
    out[os.path.basename(p)] = dict(id=sid, match=round(r, 2), start=round(span[0], 2), end=round(span[1], 2),
                                    f0=round(float(np.median(fv))), expr=round(float(np.std(semi)), 2), hyp=hyp,
                                    words=[dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3)) for w in ws])
    o = out[os.path.basename(p)]
    print(f"{os.path.basename(p):10s} match {o['match']:.2f}  speech {o['start']:.2f}-{o['end']:.2f}  f0 {o['f0']:3d}  expr {o['expr']:.2f}  :: {hyp}", flush=True)
old = json.load(open(os.path.join(F, 'data', 'vocheck.json'))) if os.path.exists(os.path.join(F, 'data', 'vocheck.json')) else {}
old.update(out); json.dump(old, open(os.path.join(F, 'data', 'vocheck.json'), 'w'), ensure_ascii=False, indent=1)

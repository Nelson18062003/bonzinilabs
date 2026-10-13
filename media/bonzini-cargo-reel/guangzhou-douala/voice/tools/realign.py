"""Re-run the word alignment of the final narrator files (voice/<id>.wav) -> voice/words.json, with the large-v3 words cached
in voice/work/final_asr.json; prints the words.  usage: python3 realign.py [--only N1,N2] [--asr]  (--asr: redo the ASR)"""
import sys, os, json
import numpy as np, soundfile as sf
from scipy.signal import resample_poly
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import LINES
from align_tts import align
V = os.path.abspath(os.path.join(H, '..')); a = sys.argv[1:]
only = set(a[a.index('--only') + 1].split(',')) if '--only' in a else None
TK = json.load(open(os.path.join(V, 'takes.json'))); WD = json.load(open(os.path.join(V, 'words.json')))
CA = os.path.join(V, 'work', 'final_asr.json'); cache = json.load(open(CA)) if os.path.exists(CA) and '--asr' not in a else {}
M = None
for lid in LINES:
    if lid not in TK or (only and lid not in only): continue
    y, sr = sf.read(os.path.join(V, f'{lid}.wav')); y = y.mean(1) if y.ndim > 1 else y
    if lid not in cache or only:
        if M is None:
            from faster_whisper import WhisperModel
            M = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
        y16 = resample_poly(y, 1, 3).astype(np.float32); pad = np.zeros(8000, np.float32)
        segs, _ = M.transcribe(np.concatenate([pad, y16 / (np.abs(y16).max() + 1e-9) * .9, pad]), language='fr', word_timestamps=True,
                               beam_size=5, condition_on_previous_text=False, vad_filter=False)
        cache[lid] = [dict(w=w.word.strip(), s=round(w.start - .5, 3), e=round(w.end - .5, 3)) for s_ in segs for w in s_.words]
    ws, info = align(y, sr, LINES[lid][0], TK[lid]['on'], TK[lid]['off'], cache[lid])
    WD[lid] = ws; TK[lid]['align'] = info
    print(f"{lid:5s} {info['counts']} cost {info['cost']}: " + ' '.join(f"{w['w']}[{w['s']:.2f}-{w['e']:.2f}]" for w in ws))
json.dump(cache, open(CA, 'w'), ensure_ascii=False, indent=1)
json.dump(WD, open(os.path.join(V, 'words.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(TK, open(os.path.join(V, 'takes.json'), 'w'), ensure_ascii=False, indent=1)

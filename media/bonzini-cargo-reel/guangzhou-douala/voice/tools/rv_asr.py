"""Word times of the real-voice segments from faster-whisper large-v3 (word timestamps), run on the demucs vocals stem with
1 s of context before and 0.6 s after each segment, prompted with the subtitle text. -> voice/work/rv_asr.json
{RVid: [{w, s, e, p}] in SOURCE seconds}. A second opinion next to work/transcripts.json (full-clip pass)."""
import sys, os, json
import numpy as np
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rv_common import *
M = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('THREADS', '2')))
out = {}
for k, g in SEGS.items():
    y, sr = vocals(g['clip']); a = max(0, g['i'] - 1.0); b = min(len(y) / sr, g['o'] + .6)
    z = resample_poly(y[int(a * sr):int(b * sr)], 160, 441).astype(np.float32); z = z / (np.abs(z).max() + 1e-9) * .9
    res = {}
    for name, prompt in (('prompt', g['text'].replace('…', '')), ('free', None)):
        segs, _ = M.transcribe(z, language='fr', word_timestamps=True, beam_size=5, initial_prompt=prompt, condition_on_previous_text=False, vad_filter=False)
        res[name] = [dict(w=w.word.strip(), s=round(a + w.start, 3), e=round(a + w.end, 3), p=round(w.probability, 3)) for s in segs for w in s.words]
        print(k, name, ' '.join(f"{w['w']}[{w['s']:.2f}-{w['e']:.2f}]" for w in res[name]), flush=True)
    out[k] = res
json.dump(out, open(os.path.join(R2, 'voice', 'work', 'rv_asr.json'), 'w'), ensure_ascii=False, indent=1)

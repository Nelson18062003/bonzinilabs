import sys, soundfile as sf, numpy as np, scipy.signal as sps
from faster_whisper import WhisperModel
m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=2)
x, sr = sf.read(sys.argv[1], always_2d=True); x = x.mean(1)
x = sps.resample_poly(x, 1, 3).astype(np.float32)
segs, info = m.transcribe(x, language='fr', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
for s in segs:
    print(f'[{s.start:5.2f}-{s.end:5.2f}] {s.text}')
    print('   ', ' '.join(f'{w.word.strip()}({w.start:.2f}-{w.end:.2f},{w.probability:.2f})' for w in s.words))

import sys, soundfile as sf, numpy as np
from faster_whisper import WhisperModel
V='/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/reel/out/voice_stems/'
m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=2)
for spec in sys.argv[1:]:
    clip, a, b = spec.split(':'); a = float(a); b = float(b)
    x, sr = sf.read(V + f'{clip}_final.wav')
    if x.ndim > 1: x = x.mean(1)
    seg = x[int(a*sr):int(b*sr)].astype(np.float32)
    # pad 0.5 s silence both sides, resample 48k->16k
    import scipy.signal as sps
    seg = sps.resample_poly(seg, 1, 3)
    seg = np.concatenate([np.zeros(8000, np.float32), seg / max(1e-6, np.abs(seg).max()) * .5, np.zeros(8000, np.float32)])
    segs, info = m.transcribe(seg, language='fr', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
    ws = [(w.word, round(w.start - .5 + a, 2), round(w.end - .5 + a, 2), round(w.probability, 2)) for s in segs for w in (s.words or [])]
    print(spec, ' '.join(w[0] for w in ws)); print('   ', ws, flush=True)

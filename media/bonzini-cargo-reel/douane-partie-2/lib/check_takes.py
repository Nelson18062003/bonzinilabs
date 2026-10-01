"""Transcribe alternate TTS takes (unbiased prompt) → audio/takes.json. usage: python3 check_takes.py S3_s2 S5_s2 ..."""
import sys, os, json
from faster_whisper import WhisperModel
F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
p = os.path.join(F, 'audio', 'takes.json'); res = json.load(open(p)) if os.path.exists(p) else {}
m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('ASR_THREADS', 2)))
for name in sys.argv[1:]:
    f = os.path.join(F, 'audio', 'vo', name + '.wav')
    segs, _ = m.transcribe(f, language='fr', beam_size=5, initial_prompt='Bonzini, tontine, douane.')
    res[name] = ' '.join(s.text.strip() for s in segs); print(name, '::', res[name], flush=True)
    json.dump(res, open(p, 'w'), ensure_ascii=False, indent=1)

"""Transcribe rush2 clips not yet in work/transcripts.json (faster-whisper large-v3, int8 CPU, VAD). Same format: {lang, prob, segs:[{s,e,t,lp,nsp,words}]}."""
import json, os, sys
from faster_whisper import WhisperModel
R = os.path.dirname(os.path.abspath(__file__)); W = os.path.join(R, 'work'); P = os.path.join(W, 'transcripts.json')
tr = json.load(open(P)); idx = json.load(open(os.path.join(R, 'src', 'index.json')))
m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
for e in idx:
    k = e['id']; wav = os.path.join(W, f'{k}_16.wav')
    if k in tr or not os.path.exists(wav) or e['dur'] < 1: continue
    segs, info = m.transcribe(wav, language='fr', vad_filter=True, word_timestamps=True, condition_on_previous_text=False)
    out = [dict(s=round(s.start, 2), e=round(s.end, 2), t=s.text.strip(), lp=round(s.avg_logprob, 2), nsp=round(s.no_speech_prob, 2),
                words=[dict(w=w.word.strip(), s=round(w.start, 2), e=round(w.end, 2), p=round(w.probability, 2)) for w in (s.words or [])]) for s in segs]
    tr[k] = dict(lang=info.language, prob=info.language_probability, segs=out)
    json.dump(tr, open(P, 'w'), ensure_ascii=False, indent=1)
    print(k, e['dur'], '|', ' / '.join(f"{s['s']}-{s['e']} lp{s['lp']} nsp{s['nsp']}: {s['t']}" for s in out) or '(rien)', flush=True)
print('DONE')

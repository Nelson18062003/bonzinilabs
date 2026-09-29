"""Lay the narration out on a 120 BPM grid -> data/timeline.json + audio/voice.wav.
Each segment starts on a beat after the previous one ends; word timings from faster-whisper (cached)."""
import json, os, math, re, difflib
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

F = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SR, BEAT = 48000, 0.5
script = json.load(open(os.path.join(F, 'data', 'script.json')))['segments']
# minimum breathing room before each segment (visual beats need time)
GAP = {'S1': 0.9, 'S2': 0.6, 'S3': 0.5, 'S4': 0.5, 'S5': 0.6, 'S6': 0.6, 'S7': 0.5, 'S8': 0.5, 'S9': 0.6, 'S10': 0.7}
TAIL = 3.0

def load(p):
    x, sr = sf.read(p, dtype='float32'); x = x if x.ndim == 1 else x.mean(1)
    g = math.gcd(sr, SR); return resample_poly(x, SR // g, sr // g).astype(np.float32)

_cache_p = os.path.join(F, 'audio', 'asr_cache.json')
_cache = json.load(open(_cache_p)) if os.path.exists(_cache_p) else {}
_m = None
def words(path):
    global _m
    key = f'{path}:{os.path.getmtime(path):.0f}'
    if key not in _cache:
        if _m is None:
            from faster_whisper import WhisperModel
            _m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)
        segs, _ = _m.transcribe(path, language='fr', word_timestamps=True, beam_size=5, initial_prompt='Bonzini, BZ, Guangzhou, Douala.')
        _cache[key] = [{'w': w.word.strip(), 's': w.start, 'e': w.end} for s in segs for w in s.words]
        json.dump(_cache, open(_cache_p, 'w'))
    return _cache[key]

norm = lambda w: re.sub(r"[^a-z0-9àâäçéèêëîïôöûùüÿœ]", '', w.lower())
def map_words(text, asr, t0):
    toks = text.split(); a = [norm(t) for t in toks]; b = [norm(w['w']) for w in asr]
    times = [None] * len(toks)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1): times[i1 + k] = (asr[j1 + k]['s'], asr[j1 + k]['e'])
        elif tag == 'replace':
            s0, e0 = asr[j1]['s'], asr[j2 - 1]['e']
            for k in range(i2 - i1): times[i1 + k] = (s0 + (e0 - s0) * k / (i2 - i1), s0 + (e0 - s0) * (k + 1) / (i2 - i1))
    for i in range(len(toks)):
        if times[i] is None:
            p = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            n = next((times[j][0] for j in range(i + 1, len(toks)) if times[j]), p + .3)
            times[i] = (p, max(p + .05, n))
    return [{'w': t, 's': round(t0 + s, 3), 'e': round(t0 + e, 3)} for t, (s, e) in zip(toks, times)]

def main():
    t = 0.0; segs = []; track = np.zeros(int(90 * SR), np.float32)
    for s in script:
        path = os.path.join(F, 'audio', 'vo', f"{s['id']}_s1.wav")
        ws = words(path)
        speech_end = ws[-1]['e'] + 0.12
        x = load(path)[:int((speech_end + 0.25) * SR)]
        x[-int(.12 * SR):] *= np.linspace(1, 0, int(.12 * SR))
        start = math.ceil((t + GAP[s['id']]) / BEAT - 1e-6) * BEAT
        i0 = int(start * SR); track[i0:i0 + len(x)] += x
        seg = {'id': s['id'], 'chapter': s['chapter'], 'text': s['text'], 'start': start, 'end': round(start + speech_end, 3),
               'words': map_words(s['text'], ws, start)}
        segs.append(seg); t = seg['end']
        print(f"{s['id']:4s} {start:6.2f} -> {seg['end']:6.2f}  {s['text'][:60]}")
    total = math.ceil((t + TAIL) / BEAT) * BEAT
    chapters = []
    for i, s in enumerate(segs):
        c0 = 0.0 if i == 0 else round(segs[i - 1]['end'] + (s['start'] - segs[i - 1]['end']) * 0.35, 3)
        chapters.append({'id': s['chapter'], 'start': c0, 'seg': s['id']})
    for i in range(len(chapters)): chapters[i]['end'] = chapters[i + 1]['start'] if i + 1 < len(chapters) else total
    track = track[:int(total * SR)]
    sf.write(os.path.join(F, 'audio', 'voice.wav'), np.stack([track, track], 1), SR, subtype='FLOAT')
    tl = {'fps': 30, 'width': 1080, 'height': 1920, 'duration': total, 'frames': int(round(total * 30)), 'bpm': 120,
          'chapters': chapters, 'segments': segs}
    json.dump(tl, open(os.path.join(F, 'data', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    print('total', total, 's', tl['frames'], 'frames')

if __name__ == '__main__':
    main()

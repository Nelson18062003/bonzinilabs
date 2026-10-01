"""Explainer V2: lay out narration (Kyutai takes) + team quotes (real, denoised) on a 120 BPM grid
-> data/timeline.json + audio/voice.wav (VO and quotes) + audio/voice_vo.wav / audio/voice_sp.wav (separate stems for the mix).
usage: python3 build_timeline.py            (takes from data/takes.json, default seed 1)
Chapter starts snap to the beat (0.5 s); word timings: VO by faster-whisper (cached), quotes by the v1 transcript."""
import json, os, math, re, difflib, sys
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

E = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); S = os.path.dirname(E)
SR, BEAT = 48000, 0.5
OLD = json.load(open(os.path.join(E, 'data', 'script_v1.json')))['segments']        # ids, kinds, chapters, quote src
TXT = {s['id']: s['text'] for s in json.load(open(os.path.join(E, 'data', 'tts_vo.json')))['segments']}
TAKES = json.load(open(os.path.join(E, 'data', 'takes.json'))) if os.path.exists(os.path.join(E, 'data', 'takes.json')) else {}
OLD_TL = json.load(open(os.path.join(E, 'data', 'timeline_prov.json')))             # v1 timeline: quote word timings
CHAPTERS = [  # id, number, title, lead-in before the first segment, tail after the last
    ('hook', '', '', 0.9, 0.6),
    ('brand', '', 'BONZINI TRADING CARGO', 0.8, 0.9),
    ('s1', '01', "L'ACHAT", 1.6, 1.0),
    ('s2', '02', 'LE GROUPAGE', 1.6, 1.0),
    ('s3', '03', 'LE TRANSPORT', 1.6, 1.0),
    ('s4', '04', "L'ARRIVÉE", 1.4, 0.6),
    ('s5', '05', 'LE DÉCHARGEMENT', 1.4, 0.6),
    ('s6', '06', 'LE RETRAIT', 1.4, 0.9),
    ('recap', '', 'EN RÉSUMÉ', 1.1, 1.2),
    ('outro', '', '', 0.6, 3.4),
]
GAP = 0.45

def load(p):
    x, sr = sf.read(p, dtype='float32'); x = x if x.ndim == 1 else x.mean(1)
    g = math.gcd(sr, SR); return resample_poly(x, SR // g, sr // g).astype(np.float32)
def lufs(x):
    import pyloudnorm as pyln
    return pyln.Meter(SR).integrated_loudness(np.asarray(x, np.float64))
def fade(x, fi=.012, fo=.05):
    x = x.copy(); a, b = int(fi * SR), int(fo * SR); x[:a] *= np.linspace(0, 1, a); x[-b:] *= np.linspace(1, 0, b); return x

_cp = os.path.join(E, 'audio', 'asr_cache.json'); _cache = json.load(open(_cp)) if os.path.exists(_cp) else {}; _m = None
def words(path):
    global _m
    key = f'{os.path.basename(path)}:{os.path.getmtime(path):.0f}'
    if key not in _cache:
        if _m is None:
            from faster_whisper import WhisperModel
            _m = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=int(os.environ.get('ASR_THREADS', 3)))
        segs, _ = _m.transcribe(path, language='fr', word_timestamps=True, beam_size=5, initial_prompt='Bonzini Trading Cargo, colis, groupage, conteneur.')
        _cache[key] = [{'w': w.word.strip(), 's': w.start, 'e': w.end} for s in segs for w in s.words]
        json.dump(_cache, open(_cp, 'w'), ensure_ascii=False)
    return _cache[key]

norm = lambda w: re.sub(r"[^a-z0-9àâäçéèêëîïôöûùüÿœ]", '', w.lower())
def map_words(text, asr, t0):
    toks = text.split(' '); a = [norm(t) for t in toks]; b = [norm(w['w']) for w in asr]
    times = [None] * len(toks)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1): times[i1 + k] = (asr[j1 + k]['s'], asr[j1 + k]['e'])
        elif tag == 'replace' and j2 > j1:
            s0, e0 = asr[j1]['s'], asr[j2 - 1]['e']
            for k in range(i2 - i1): times[i1 + k] = (s0 + (e0 - s0) * k / (i2 - i1), s0 + (e0 - s0) * (k + 1) / (i2 - i1))
    for i in range(len(toks)):
        if times[i] is None:
            p = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            n = next((times[j][0] for j in range(i + 1, len(toks)) if times[j]), p + .3)
            times[i] = (p, max(p + .05, n))
    return [{'w': t, 's': round(t0 + s, 3), 'e': round(t0 + e, 3)} for t, (s, e) in zip(toks, times)]

STEMS = {'A': os.path.join(S, 'reel', 'out', 'voice_stems', 'A_final.wav'), 'B': os.path.join(S, 'reel', 'out', 'voice_stems', 'B_final.wav')}
_st = {}
def quote_audio(seg):
    c = seg['clip']
    if c not in _st: _st[c] = load(STEMS[c])
    a, b = seg['src']; return fade(_st[c][int(a * SR):int(b * SR)], .03, .08)

def main():
    by_ch = {}
    for s in OLD: by_ch.setdefault(s['chapter'], []).append(s)
    t = 0.0; chapters, segments = [], []
    N = int(220 * SR); vo_tr, sp_tr = np.zeros(N, np.float32), np.zeros(N, np.float32)
    for cid, num, title, lead, tail in CHAPTERS:
        t = math.ceil(t / BEAT - 1e-6) * BEAT; c0 = t; t += lead
        for k, s in enumerate(by_ch[cid]):
            if k: t += GAP
            if s['kind'] == 'vo':
                take = TAKES.get(s['id'], 1); path = os.path.join(E, 'audio', 'vo', f"{s['id']}_s{take}.wav")
                ws = words(path); end = ws[-1]['e'] + .12
                x = load(path)[:int((end + .2) * SR)]
                x *= 10 ** ((-16.0 - lufs(x)) / 20); x = fade(x)
                d = len(x) / SR; t = round(t, 3)
                seg = {'id': s['id'], 'kind': 'vo', 'chapter': cid, 'start': t, 'end': round(t + end, 3), 'text': TXT[s['id']], 'take': take,
                       'words': map_words(TXT[s['id']], ws, t)}
                i0 = int(t * SR); vo_tr[i0:i0 + len(x)] += x
            else:
                x = quote_audio(s); d = len(x) / SR; t = round(t, 3)
                old = next(q for q in OLD_TL['segments'] if q['id'] == s['id'])
                seg = {'id': s['id'], 'kind': 'sp', 'chapter': cid, 'start': t, 'end': round(t + d, 3), 'text': s['text'], 'clip': s['clip'], 'src': s['src'],
                       'words': [{'w': w['w'], 's': round(w['s'] - old['start'] + t, 3), 'e': round(w['e'] - old['start'] + t, 3)} for w in old['words']]}
                i0 = int(t * SR); sp_tr[i0:i0 + len(x)] += x
            segments.append(seg); t = seg['end'] if s['kind'] == 'vo' else t + d
            print(f"{s['id']:4s} {seg['start']:7.2f} -> {seg['end']:7.2f}  {seg['text'][:56]}")
        t += tail
        chapters.append({'id': cid, 'num': num, 'title': title, 'start': round(c0, 3), 'end': round(t, 3)})
    total = math.ceil(t / BEAT) * BEAT
    for i in range(len(chapters) - 1): chapters[i]['end'] = chapters[i + 1]['start']
    chapters[-1]['end'] = total
    n = int(round(total * SR)); vo_tr, sp_tr = vo_tr[:n], sp_tr[:n]
    st = lambda x: np.stack([x, x], 1)
    sf.write(os.path.join(E, 'audio', 'voice_vo.wav'), st(vo_tr), SR, subtype='FLOAT')
    sf.write(os.path.join(E, 'audio', 'voice_sp.wav'), st(sp_tr), SR, subtype='FLOAT')
    sf.write(os.path.join(E, 'audio', 'voice.wav'), st(vo_tr + sp_tr), SR, subtype='FLOAT')
    tl = {'fps': 30, 'width': 1080, 'height': 1920, 'duration': total, 'frames': int(round(total * 30)), 'bpm': 120,
          'chapters': chapters, 'segments': segments, 'speech': [[s['start'], s['end']] for s in segments]}
    json.dump(tl, open(os.path.join(E, 'data', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    for c in chapters: print(f"  {c['id']:6s} {c['start']:7.2f} – {c['end']:7.2f}")
    print('total', total, 's', tl['frames'], 'frames')

if __name__ == '__main__':
    main()

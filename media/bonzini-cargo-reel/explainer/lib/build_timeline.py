"""Build data/timeline.json + audio/voice_track.wav from data/script.json and the chosen narration takes.

usage: python3 build_timeline.py [--vo kokoro|cb] [--no-align]
- Chapter starts are snapped to the 100 BPM beat grid (0.6 s) so the music can hit them.
- VO word timings come from faster-whisper word timestamps mapped onto the script text;
  team quotes (SP) use the v1 Whisper timings of the original clips.
- Shots tile the timeline: every instant has exactly one picture source (footage or 'mg').
"""
import json, os, sys, re, difflib, math
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
E = os.path.abspath(os.path.join(HERE, '..'))
S = os.path.abspath(os.path.join(E, '..'))
SR = 48000
BPM = 100.0
BEAT = 60.0 / BPM
args = sys.argv[1:]
VO_SRC = args[args.index('--vo') + 1] if '--vo' in args else 'kokoro'

script = json.load(open(os.path.join(E, 'data', 'script.json')))['segments']
CHAPTERS = [  # id, number, title, kind, lead-in before first segment, tail after last
    ('hook', '', '', 'footage', 1.0, 0.5),
    ('brand', '', 'BONZINI TRADING CARGO', 'mg', 0.6, 0.9),
    ('s1', '01', "L'ACHAT", 'mg', 1.5, 1.0),
    ('s2', '02', 'LE GROUPAGE', 'mg', 1.5, 1.0),
    ('s3', '03', 'LE TRANSPORT', 'mg', 1.5, 1.0),
    ('s4', '04', "L'ARRIVÉE", 'footage', 1.2, 0.5),
    ('s5', '05', 'LE DÉCHARGEMENT', 'footage', 1.2, 0.5),
    ('s6', '06', 'LE RETRAIT', 'footage', 1.2, 0.8),
    ('recap', '', 'EN RÉSUMÉ', 'mg', 1.0, 1.2),
    ('outro', '', '', 'footage', 0.5, 3.6),
]
GAP = 0.40  # between segments inside a chapter

# ---------------- audio loading ----------------
def load_mono(path, sr_out=SR):
    x, sr = sf.read(path, dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != sr_out:
        g = math.gcd(sr, sr_out); x = resample_poly(x, sr_out // g, sr // g).astype(np.float32)
    return x

def lufs(x, sr=SR):
    from scipy.signal import lfilter
    # K-weighting (BS.1770) for 48 kHz
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = lfilter(b2, a2, lfilter(b1, a1, x))
    blk = int(.4 * sr); hop = int(.1 * sr)
    ms = np.array([np.mean(y[i:i + blk] ** 2) for i in range(0, max(1, len(y) - blk), hop)])
    ms = ms[ms > 10 ** ((-70 + 0.691) / 10)]
    if not len(ms): return -70.0
    rel = 10 * np.log10(ms.mean()) - 0.691 - 10
    ms = ms[10 * np.log10(ms) - 0.691 > rel]
    return 10 * np.log10(ms.mean()) - 0.691

def vo_path(seg_id):
    if VO_SRC == 'cb':
        sel = os.path.join(E, 'audio', 'vo_cb', 'selected.json')
        choice = json.load(open(sel)) if os.path.exists(sel) else {}
        if seg_id in choice and choice[seg_id]:
            return choice[seg_id]
    return os.path.join(E, 'audio', 'vo_kokoro', seg_id + '.wav')

def trim_silence(x, thr_db=-45, pad=0.06):
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same')
    on = np.where(20 * np.log10(env + 1e-9) > thr_db)[0]
    if not len(on): return x
    a = max(0, on[0] - int(pad * SR)); b = min(len(x), on[-1] + int(pad * SR))
    return x[a:b]

def fade(x, fi=0.012, fo=0.04):
    x = x.copy(); n1, n2 = int(fi * SR), int(fo * SR)
    x[:n1] *= np.linspace(0, 1, n1); x[-n2:] *= np.linspace(1, 0, n2); return x

STEMS = {'A': os.path.join(S, 'reel', 'out', 'voice_stems', 'A_final.wav'),
         'B': os.path.join(S, 'reel', 'out', 'voice_stems', 'B_final.wav')}
_stem_cache = {}
def sp_audio(seg):
    c = seg['clip']
    if c not in _stem_cache: _stem_cache[c] = load_mono(STEMS[c])
    a, b = seg['src']
    return fade(_stem_cache[c][int(a * SR):int(b * SR)], 0.03, 0.08)

# ---------------- words ----------------
V1 = json.load(open(os.path.join(S, 'src', 'transcript_large-v3.json')))
def v1_words(clip, a, b):
    key = 'A_raw16k.wav' if clip == 'A' else 'B_clean16k.wav'
    return [w for s in V1[key]['segments'] for w in s['words'] if w['s'] >= a - 0.05 and w['e'] <= b + 0.05]

def tokens(text):
    return re.findall(r"[^\s]+", text)

def normw(w):
    return re.sub(r"[^a-zàâäçéèêëîïôöûùüÿœ0-9]", "", w.lower())

def map_words(script_text, asr_words, t0):
    """align script tokens to ASR word timings (difflib on normalised forms); interpolate gaps."""
    toks = tokens(script_text)
    a = [normw(t) for t in toks]; b = [normw(w['w']) for w in asr_words]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    times = [None] * len(toks)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal' or (tag == 'replace' and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = (asr_words[j1 + k]['s'], asr_words[j1 + k]['e'])
        elif tag == 'replace' and j2 > j1:
            s0, e0 = asr_words[j1]['s'], asr_words[j2 - 1]['e']
            for k in range(i2 - i1):
                times[i1 + k] = (s0 + (e0 - s0) * k / (i2 - i1), s0 + (e0 - s0) * (k + 1) / (i2 - i1))
    # fill remaining by interpolation
    for i in range(len(toks)):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(toks)) if times[j]), prev + 0.3)
            times[i] = (prev, max(prev + 0.05, nxt))
    return [{'w': t, 's': round(t0 + s, 3), 'e': round(t0 + e, 3)} for t, (s, e) in zip(toks, times)]

_whisper = None
_CACHE_P = os.path.join(E, 'audio', 'asr_cache.json')
_cache = json.load(open(_CACHE_P)) if os.path.exists(_CACHE_P) else {}
def asr_cached(src_path, tmp_path):
    key = f"{src_path}:{os.path.getmtime(src_path):.0f}"
    if key not in _cache:
        _cache[key] = asr(tmp_path); json.dump(_cache, open(_CACHE_P, 'w'))
    return _cache[key]

def asr(path):
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel('medium', device='cpu', compute_type='int8', cpu_threads=2)
    segs, _ = _whisper.transcribe(path, language='fr', word_timestamps=True, beam_size=5)
    return [{'w': w.word.strip(), 's': w.start, 'e': w.end} for s in segs for w in s.words]

EMPH = {'chine', 'groupage', 'conteneur', 'transport', 'bateau', 'camion', 'entrepôt', 'arrivée', 'déchargement',
        'déchargé', 'déchargés', 'retrait', 'colis', 'sécurité', 'balengou', 'confiance', 'merci', 'achat', 'bonzini',
        'trading', 'cargo', 'fournisseurs', 'étapes', 'six'}

# ---------------- layout ----------------
def main():
    align = '--no-align' not in args
    by_ch = {}
    for s in script: by_ch.setdefault(s['chapter'], []).append(s)
    t = 0.0; chapters = []; segments = []; track = np.zeros(int(200 * SR), np.float32)
    tmpdir = os.path.join(E, 'audio', '_tmp'); os.makedirs(tmpdir, exist_ok=True)
    for cid, num, title, kind, lead, tail in CHAPTERS:
        t = math.ceil(t / BEAT - 1e-6) * BEAT          # snap chapter start to the beat grid
        c0 = t; t += lead
        for k, s in enumerate(by_ch[cid]):
            if k: t += GAP
            if s['kind'] == 'vo':
                x = trim_silence(load_mono(vo_path(s['id'])))
                x = x * 10 ** ((-16.0 - lufs(x)) / 20)       # VO at the same loudness as the team stems
                x = fade(x)
            else:
                x = sp_audio(s)
            d = len(x) / SR
            i0 = int(round(t * SR)); track[i0:i0 + len(x)] += x
            seg = {'id': s['id'], 'kind': s['kind'], 'chapter': cid, 'start': round(t, 3), 'end': round(t + d, 3), 'text': s['text']}
            if s['kind'] == 'vo':
                seg['audio'] = vo_path(s['id'])
                if align:
                    p = os.path.join(tmpdir, s['id'] + '.wav'); sf.write(p, x, SR)
                    seg['words'] = map_words(s['text'], asr_cached(vo_path(s['id']), p), t)
            else:
                a, b = s['src']
                ws = [{'w': w['w'], 's': w['s'] - a, 'e': w['e'] - a} for w in v1_words(s['clip'], a, b)]
                seg['words'] = map_words(s['text'], ws, t)
                seg['clip'], seg['src'] = s['clip'], s['src']
            for w in seg.get('words', []):
                w['emph'] = normw(w['w']) in EMPH
            segments.append(seg); t += d
        t += tail
        chapters.append({'id': cid, 'num': num, 'title': title, 'kind': kind, 'start': round(c0, 3), 'end': round(t, 3)})
        print(f"{cid:6s} {c0:7.2f} -> {t:7.2f}")
    total = math.ceil(t * 30) / 30
    for i in range(len(chapters) - 1): chapters[i]['end'] = chapters[i + 1]['start']
    chapters[-1]['end'] = total
    shots = make_shots(chapters, segments, total)
    track = track[:int(round(total * SR))]
    os.makedirs(os.path.join(E, 'audio'), exist_ok=True)
    sf.write(os.path.join(E, 'audio', 'voice_track.wav'), np.stack([track, track], 1), SR, subtype='FLOAT')
    tl = {'fps': 30, 'width': 1080, 'height': 1920, 'duration': total, 'frames': int(round(total * 30)), 'bpm': BPM,
          'vo_source': VO_SRC, 'chapters': chapters, 'segments': segments, 'shots': shots,
          'speech': [[s['start'], s['end']] for s in segments]}
    json.dump(tl, open(os.path.join(E, 'data', 'timeline.json'), 'w'), ensure_ascii=False, indent=1)
    print('total', total, 's,', tl['frames'], 'frames; shots', len(shots))

def seg(segments, sid): return next(s for s in segments if s['id'] == sid)
def chap(chapters, cid): return next(c for c in chapters if c['id'] == cid)

def make_shots(chapters, segments, total):
    """Picture edit. Each shot: start/end (timeline), clip, src (source time at shot start), speed, look."""
    out = []
    def add(t0, t1, clip, src, speed=1.0, look='full'):
        if t1 - t0 > 1e-3: out.append({'start': round(t0, 3), 'end': round(t1, 3), 'clip': clip, 'src': round(src, 3), 'speed': speed, 'look': look})
    def fill(t0, t1, clip, src, avail, look='full'):
        """play clip from src; slow down (>=0.6x) if the source is shorter than the slot."""
        d = t1 - t0; sp = min(1.0, max(0.6, avail / d)) if d > 0 else 1.0
        add(t0, t1, clip, src, round(sp, 3), look)
    C = {c['id']: c for c in chapters}; G = {s['id']: s for s in segments}
    # hook: beat-cut montage (every 2 beats)
    h = C['hook']; cuts = [('B2', 11.3), ('A', 16.0), ('B', 4.6), ('A', 11.4), ('B2', 12.6), ('A', 21.8), ('B', 12.9)]
    t = h['start']; k = 0
    while t < h['end'] - 1e-3:
        t1 = min(h['end'], t + 2 * BEAT); c, s0 = cuts[k % len(cuts)]; add(t, t1, c, s0, 1.0, 'full'); t = t1; k += 1
    # motion-design chapters: blurred dark footage underneath
    add(C['brand']['start'], C['brand']['end'], 'B2', 11.0, 0.45, 'mg')
    add(C['s1']['start'], C['s1']['end'], 'A', 22.0, 0.35, 'mg')
    add(C['s2']['start'], C['s2']['end'], 'A', 16.0, 0.35, 'mg')
    add(C['s3']['start'], C['s3']['end'], 'B', 4.0, 0.35, 'mg')
    # s4 arrival
    c = C['s4']; v6 = G['V06']; q1 = G['Q1']; q2 = G['Q2']
    mid = c['start'] + (q1['start'] - c['start']) * 0.5
    fill(c['start'], mid, 'B', 0.0, 3.5)
    fill(mid, q1['start'], 'B2', 11.0, 3.6)
    add(q1['start'], q2['start'], 'B', 3.62)
    add(q2['start'], c['end'], 'B', 9.94, min(1.0, 6.6 / (c['end'] - q2['start'])))
    # s5 unloading
    c = C['s5']; q3 = G['Q3']; q4 = G['Q4']; v8 = G['V08']
    fill(c['start'], q3['start'], 'B2', 3.0, 6.6)
    add(q3['start'], q4['start'], 'A', 0.0)
    add(q4['start'], v8['start'], 'A', 5.55)
    fill(v8['start'], c['end'], 'A', 9.4, 6.0)
    # s6 pickup
    c = C['s6']; q5 = G['Q5']
    fill(c['start'], q5['start'], 'A', 15.6, 4.9)
    t_card = min(q5['start'] + 5.2, q5['end'] - 2.0)
    add(q5['start'], t_card, 'A', 20.4)
    add(t_card, c['end'], 'A', 20.4 + (t_card - q5['start']), 0.3, 'mg')
    # recap
    add(C['recap']['start'], C['recap']['end'], 'B2', 11.2, 0.4, 'mg')
    # outro: last quote on footage, then end card over blurred footage
    c = C['outro']; q6 = G['Q6']; v11 = G['V11']
    add(c['start'], v11['start'] - 0.2, 'A', 21.4, min(1.0, 4.5 / max(0.1, v11['start'] - 0.2 - c['start'])))
    add(v11['start'] - 0.2, total, 'B2', 12.0, 0.35, 'mg')
    out.sort(key=lambda s: s['start'])
    # sanity: contiguous coverage
    for a, b in zip(out, out[1:]):
        if abs(a['end'] - b['start']) > 0.02: print('WARN gap/overlap', a, b)
    return out

if __name__ == '__main__':
    main()

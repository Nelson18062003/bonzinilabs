"""Final narrator files from the chosen takes (voice/work/choice.json {id: {file, stretch, note}}):
raw take (24 kHz) → cut [on − 0.12, off + 0.12] → 48 kHz (soxr VHQ) → time-stretch × stretch (ffmpeg Rubber Band, pitch and
formants kept; or the method named in choice.json["_method"]) → speech span re-measured → trim to [on − 30 ms, off + 30 ms]
(10 ms fade-in / 20 ms fade-out inside the margins) → peak −3 dBFS → voice/<id>.wav (48 kHz mono PCM 24).
Then: voice/takes.json {id: {file, text, tts_text, dur, syl, rate, stretch, on, off, wav_dur, window, source, …}} and
voice/words.json {id: [{w, s, e}]} (written words; faster-whisper large-v3 word times on the final file, snapped to the
energy: pauses → their edges, run-together words → the energy dip; s / e relative to the start of the wav).
usage: python3 make_final.py [--only N1,N2]"""
import sys, os, re, json, subprocess, tempfile, difflib, unicodedata
import numpy as np, soundfile as sf, soxr
from scipy.signal import resample_poly
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, H)
from lines import LINES, RATE_MAX, STRETCH_MAX
from narr_eval_lib import span, toks, METHODS
from align_tts import align
V = os.path.abspath(os.path.join(H, '..')); VO = os.path.join(V, 'work', 'audio', 'vo'); SR = 48000
a = sys.argv[1:]; only = set(a[a.index('--only') + 1].split(',')) if '--only' in a else None
CH = json.load(open(os.path.join(V, 'work', 'choice.json'))); EV = json.load(open(os.path.join(V, 'work', 'take_eval.json')))
METHOD = CH.get('_method', 'rb_crisp')
SCRIPTS = {}
for fn in ('script_v2.json', 'script_B.json', 'script_C.json', 'script_D.json'):
    p = os.path.join(V, 'work', 'data', fn)
    if os.path.exists(p): SCRIPTS[fn] = {s['id']: s for s in json.load(open(p))['segments']}
RUNS = {'1': 'script_v2.json', '2': 'script_v2.json', '3': 'script_v2.json', '4': 'script_B.json', '5': 'script_C.json', '6': 'script_v2.json',
        '7': 'script_D.json', '8': 'script_v2.json', '9': 'script_D.json', '10': 'script_v2.json'}
def run_of(k):
    """take number → TTS run (runs 1–5: 6 takes each, k = 1…30; run 6: 12 takes, k = 61…72; run 7: 8 takes, k = 73…80)"""
    k = int(k); return '10' if k > 96 else '9' if k > 88 else '8' if k > 80 else '7' if k > 72 else '6' if k > 60 else str((k - 1) // 6 + 1)
def tts_text(take):
    """the text the TTS was given for this take (run → script); pairs: the pair's text"""
    name = take[:-4]; lid, k = name.rsplit('_s', 1)
    if '-' in k:                                  # split pair take <line>_s<PAIR>-<k>
        pid, kk = k.split('-'); sc = SCRIPTS[RUNS[run_of(kk)]].get(pid, {})
        return sc.get('tts') or sc.get('text'), pid
    s = SCRIPTS[RUNS[run_of(k)]].get(lid) or SCRIPTS['script_v2.json'][lid]
    return s.get('tts', s['text']), None
def stretch(y, st):
    if abs(st - 1) < 5e-4: return y
    if METHODS[METHOD] is None:
        import librosa; return librosa.effects.time_stretch(y.astype(np.float32), rate=1 / st).astype(float)
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav'); sf.write(src, y.astype(np.float32), SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', METHODS[METHOD].format(t=1 / st), '-c:a', 'pcm_f32le', dst], check=True)
        z, _ = sf.read(dst); return z if z.ndim == 1 else z.mean(1)

from faster_whisper import WhisperModel
BIG = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4)

def written_words(text):
    """subtitle tokens: punctuation that French sets apart (« : », « ? », « ! ») stays with the word before it"""
    out = []
    for t in text.split():
        if out and not any(ch.isalnum() for ch in t): out[-1] += ' ' + t
        else: out.append(t)
    return out
def env_db(y, hop=.002, win=.012):
    h, w = int(hop * SR), int(win * SR); c = np.cumsum(np.r_[0, y ** 2]); n = len(y); idx = np.arange(0, n, h)
    lo = np.clip(idx - w // 2, 0, n); hi = np.clip(idx + w // 2, 0, n)
    return idx / SR, 10 * np.log10((c[hi] - c[lo]) / np.maximum(hi - lo, 1) + 1e-12)
def align_words(y, text, on, off):
    y16 = resample_poly(y, 1, 3).astype(np.float32); pad = np.zeros(8000, np.float32)
    segs, _ = BIG.transcribe(np.concatenate([pad, y16 / (np.abs(y16).max() + 1e-9) * .9, pad]), language='fr', word_timestamps=True,
                             beam_size=5, condition_on_previous_text=False, vad_filter=False)
    asr = [dict(w=w.word.strip(), s=w.start - .5, e=w.end - .5) for s in segs for w in s.words]
    merged = []
    for w in asr:                                  # « Là » + « -bas », « c » + « 'est », lone punctuation
        if merged and (w['w'][:1] in "-'" or not any(ch.isalnum() for ch in w['w'])): merged[-1] = dict(w=merged[-1]['w'] + w['w'], s=merged[-1]['s'], e=w['e'])
        else: merged.append(dict(w))
    ww = written_words(text)
    # map written words to ASR words by sound
    A = [' '.join(toks(m['w'])) for m in merged]; B = [' '.join(toks(w)) for w in ww]
    sm = difflib.SequenceMatcher(None, B, A); mp = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size): mp[blk.a + k] = blk.b + k
    heard = ' '.join(m['w'] for m in merged)
    # boundaries: from the ASR where mapped, else spread by syllables between known neighbours
    starts = [merged[mp[i]]['s'] if i in mp else None for i in range(len(ww))]
    ends = [merged[mp[i]]['e'] if i in mp else None for i in range(len(ww))]
    starts[0] = on; ends[-1] = off
    sylw = [max(1, len(re.findall(r'[aeiouyàâéèêëîïôûùü]+', w.lower()))) for w in ww]
    for i in range(1, len(ww)):
        if starts[i] is None:
            j = next(k for k in range(i, len(ww) + 1) if k == len(ww) or starts[k] is not None)
            t0 = starts[i - 1]; t1 = starts[j] if j < len(ww) else off; tot = sum(sylw[i - 1:j]); acc = sum(sylw[i - 1:i])
            for k in range(i, j): starts[k] = t0 + (t1 - t0) * acc / tot; acc += sylw[k]
    t, e = env_db(y); floor = np.percentile(e, 10); peak = e.max(); thr = max(floor + 10, peak - 40)
    sp = np.convolve(e, np.ones(5) / 5, 'same') > thr
    out = []
    bnd = [starts[i] for i in range(1, len(ww))]
    snapped = []
    for i, b in enumerate(bnd):
        lo, hi = np.searchsorted(t, b - .12), np.searchsorted(t, b + .12)
        silent = np.flatnonzero(~sp[lo:hi])
        if len(silent) >= 20:                                           # ≥ 40 ms of pause near the ASR boundary
            runs = np.split(silent, np.flatnonzero(np.diff(silent) > 1) + 1); r = max(runs, key=len)
            if len(r) >= 20: snapped.append((t[lo + r[0]], t[min(lo + r[-1] + 1, len(t) - 1)])); continue
        lo2, hi2 = np.searchsorted(t, b - .06), np.searchsorted(t, b + .06)
        es = np.convolve(e, np.ones(3) / 3, 'same')[lo2:hi2] + 15 * np.abs(t[lo2:hi2] - b)
        x = t[lo2 + int(np.argmin(es))]; snapped.append((x, x))
    for i, w in enumerate(ww):
        s = on if i == 0 else snapped[i - 1][1]; en = off if i == len(ww) - 1 else snapped[i][0]
        out.append(dict(w=w, s=round(float(s), 3), e=round(float(max(en, s + .04)), 3)))
    return out, heard

takes, words = (json.load(open(os.path.join(V, f))) if os.path.exists(os.path.join(V, f)) else {} for f in ('takes.json', 'words.json'))
for lid, (text, syl, w0, w1, film, keys) in LINES.items():
    if lid not in CH or (only and lid not in only): continue
    c = CH[lid]; f = c['file']; ev = EV[f[:-4]]; st = float(c['stretch'])
    y, sr = sf.read(os.path.join(VO, f)); y = (y.mean(1) if y.ndim > 1 else y).copy()
    # the codec's start-up transient (a click in the first ~15 ms of some takes, before any speech) is not speech
    if not f.split('_s')[1].startswith(('P', 'L')): y[:int(.018 * sr)] *= 0.0
    on_r, off_r = span(y, sr)
    a0 = max(0.0, on_r - .12); b0 = min(len(y) / sr, off_r + .12)
    seg = y[int(a0 * sr):int(b0 * sr)].astype(float)
    if c.get('pause_add'):
        # lengthen the line's existing pause around `at` (raw take seconds) by `add` s: its quiet middle is repeated with
        # 20-ms equal-power crossfades (room tone of the take itself, no new silence, no edit inside a word)
        at, add = c['pause_add']['at'] - a0, c['pause_add']['add']
        fr = int(.01 * sr); e = np.sqrt(np.convolve(seg ** 2, np.ones(fr) / fr, 'same')); q = e < e.max() * .01
        i = int(at * sr); assert q[i], 'pause_add: not inside a pause'
        L = i; R = i
        while L > 0 and q[L - 1]: L -= 1
        while R < len(q) - 1 and q[R + 1]: R += 1
        m = (L + R) // 2; n = int(add * sr); xf = int(.02 * sr)
        piece = seg[m - n // 2 - xf:m + n // 2 + xf].copy()
        w = np.sin(np.linspace(0, np.pi / 2, xf)) ** 2
        head, tail = seg[:m], seg[m:]
        out_ = np.concatenate([head[:-xf], head[-xf:] * (1 - w) + piece[:xf] * w, piece[xf:-xf], piece[-xf:] * (1 - w) + tail[:xf] * w, tail[xf:]])
        print(f"  {lid}: pause {L / sr + a0:.2f}–{R / sr + a0:.2f} s lengthened by {(len(out_) - len(seg)) / sr:.3f} s"); seg = out_
    y48 = soxr.resample(seg, sr, SR, quality='VHQ'); P = int(.3 * SR)
    syl = int(c.get('syl', syl)); win = w1 - w0
    def build(st):
        z = stretch(np.r_[np.zeros(P), y48, np.zeros(P)], st)      # zero pads: the filter's start-up / flush never touch the speech
        on, off = span(z, SR)
        i0, i1 = max(0, int(round((on - .03) * SR))), min(len(z), int(round((off + .03) * SR)))
        out = z[i0:i1].copy(); fi, fo = int(.010 * SR), int(.020 * SR)
        out[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2; out[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        out = out / (np.abs(out).max() + 1e-12) * 10 ** (-3 / 20)
        on2, off2 = span(out, SR)                                   # measured on the FINAL file, as any check will measure it
        return out, on2, off2
    for _ in range(4):
        out, on2, off2 = build(st); d = off2 - on2
        if d > win - .004 and st > .985: st = round(st * (win - .008) / d, 4); continue          # over the window
        if syl / d > 3.17 and st < STRETCH_MAX - 1e-4: st = round(min(STRETCH_MAX, st * (syl / 3.15) / d), 4); continue   # over 3.2 syl/s
        break
    sf.write(os.path.join(V, f'{lid}.wav'), out.astype(np.float32), SR, subtype='PCM_24')
    dur = off2 - on2
    tt, pid = tts_text(f)
    takes[lid] = dict(file=f'{lid}.wav', text=text, tts_text=tt, dur=round(dur, 3), syl=syl, rate=round(syl / dur, 2), stretch=round(st, 3),
                      on=round(on2, 3), off=round(off2, 3), wav_dur=round(len(out) / SR, 3), window=[w0, w1], window_len=round(w1 - w0, 2),
                      fits=bool(dur <= w1 - w0 + 1e-6), film=film, source=f + (f' (split from the two-sentence take {pid})' if pid else ''),
                      stretch_method=METHOD if st > 1.0005 else None, note=c.get('note', ''))
    y16 = resample_poly(out, 1, 3).astype(np.float32); pad = np.zeros(8000, np.float32)
    segs, _ = BIG.transcribe(np.concatenate([pad, y16 / (np.abs(y16).max() + 1e-9) * .9, pad]), language='fr', word_timestamps=True,
                             beam_size=5, condition_on_previous_text=False, vad_filter=False)
    asr = [dict(w=w.word.strip(), s=w.start - .5, e=w.end - .5) for s_ in segs for w in s_.words]
    heard = ' '.join(a['w'] for a in asr)
    ws, how = align(out, SR, text, on2, off2, asr); takes[lid]['align'] = how
    words[lid] = ws; takes[lid]['asr_final'] = heard
    print(f"{lid:5s} {f:16s} ×{st:.3f} → {dur:.3f}s {syl / dur:.2f} syl/s (win {w1 - w0:.2f}{'' if dur <= w1 - w0 else ' OVER'})  « {heard} »  "
          + ' '.join(f"{w['w']}[{w['s']:.2f}-{w['e']:.2f}]" for w in ws), flush=True)
json.dump(takes, open(os.path.join(V, 'takes.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(words, open(os.path.join(V, 'words.json'), 'w'), ensure_ascii=False, indent=1)
